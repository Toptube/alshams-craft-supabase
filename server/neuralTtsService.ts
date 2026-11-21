import { GoogleGenAI } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export type NeuralTtsPersona = 'shamousa' | 'falcon';

export interface NeuralTtsAudioResult {
  buffer: Buffer;
  contentType: 'audio/wav' | 'audio/mpeg';
  engine: 'gemini_neural' | 'egyptian_neural';
}

interface CacheEntry {
  result: NeuralTtsAudioResult;
  expiresAt: number;
}

const AUDIO_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_ITEMS = 100;
const CACHE_TTL_MS = 30 * 60 * 1000;

// Independent TTS cooldown so TTS rate limits NEVER affect chat keys
let geminiTtsCooldownUntil = 0;

function cleanEnvKey(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

function getTtsGeminiKeys(persona: NeuralTtsPersona): string[] {
  const ordered =
    persona === 'shamousa'
      ? [
          process.env.GEMINI_API_KEY_SHAMOUSA,
          process.env.SHAMOUSA_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON_CHAT,
          process.env.GEMINI_API_KEY_FALCON,
          process.env.GEMINI_API_KEY,
        ]
      : [
          process.env.GEMINI_API_KEY_FALCON_CHAT,
          process.env.GEMINI_API_KEY_FALCON,
          process.env.GEMINI_API_KEY_SHAMOUSA,
          process.env.GEMINI_API_KEY,
        ];
  return Array.from(new Set(ordered.map(cleanEnvKey).filter(Boolean)));
}

function putCache(key: string, result: NeuralTtsAudioResult): void {
  if (AUDIO_CACHE.size >= MAX_CACHE_ITEMS) {
    const oldestKey = AUDIO_CACHE.keys().next().value;
    if (oldestKey) AUDIO_CACHE.delete(oldestKey);
  }
  AUDIO_CACHE.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCache(key: string): NeuralTtsAudioResult | null {
  const hit = AUDIO_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    AUDIO_CACHE.delete(key);
    return null;
  }
  return hit.result;
}

/**
 * Ensures Gemini audio bytes are wrapped in a valid RIFF WAV container.
 * Gemini 3.8 unary returns complete WAV (starts with "RIFF"), while raw L16 PCM
 * (24kHz mono 16-bit LE) gets a standard 44-byte WAV header automatically.
 */
function ensureWavBuffer(raw: Buffer, sampleRate = 24000): Buffer {
  if (raw.length >= 12 && raw.subarray(0, 4).toString('ascii') === 'RIFF') {
    return raw;
  }
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + raw.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(raw.length, 40);
  return Buffer.concat([header, raw]);
}

function escapeForSsml(input: string): string {
  return input
    .replace(/&/g, ' و ')
    .replace(/[<>]/g, ' ')
    .replace(/"/g, ' ')
    .replace(/'/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Tier 1: Real Expressive Gemini 3.8 Neural Human Voice (Free-Tier `@google/genai`)
 * - Shamousa: Kore — warm, cheerful, classy colloquial Egyptian woman
 * - Falcon: Fenrir — deep, noble, charismatic Egyptian gentleman & artisan knight
 */
async function synthesizeWithGeminiTts(
  text: string,
  persona: NeuralTtsPersona
): Promise<NeuralTtsAudioResult | null> {
  if (Date.now() < geminiTtsCooldownUntil) return null;
  const keys = getTtsGeminiKeys(persona);
  if (keys.length === 0) return null;

  const voiceName = persona === 'shamousa' ? 'Kore' : 'Fenrir';
  const style =
    persona === 'shamousa'
      ? 'Warm, cheerful, charismatic Egyptian woman speaking natural colloquial Egyptian Arabic with elegance, comfort, and light warmth — lively, human, and never robotic'
      : 'Noble, deep, resonant, charismatic Egyptian gentleman and proud artisan knight speaking confident colloquial Egyptian Arabic with wisdom, pride, warmth, and natural human cadence — never robotic';

  for (const apiKey of keys.slice(0, 2)) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    try {
      const response: any = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: { style },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GEMINI_TTS_TIMEOUT')), 6500)
        ),
      ]);

      const inlineData = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio: string | undefined = inlineData?.data;
      if (base64Audio && base64Audio.length > 100) {
        const rawBytes = Buffer.from(base64Audio, 'base64');
        const wavBuffer = ensureWavBuffer(rawBytes, 24000);
        return {
          buffer: wavBuffer,
          contentType: 'audio/wav',
          engine: 'gemini_neural',
        };
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      const status = Number(err?.status || err?.code || 0);
      if (status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(msg)) {
        // Cool down Gemini TTS for 3 minutes and immediately use native Egyptian neural voices
        geminiTtsCooldownUntil = Date.now() + 3 * 60 * 1000;
        break;
      }
      if (status === 404 || /NOT_FOUND|not found/i.test(msg)) {
        geminiTtsCooldownUntil = Date.now() + 5 * 60 * 1000;
        break;
      }
      // Try next key or fall through to Tier 2
    }
  }

  return null;
}

/**
 * Tier 2: 100% Free Unlimited Native Egyptian Neural Voices (`msedge-tts`)
 * - Shamousa: ar-EG-SalmaNeural (authentic warm cheerful Egyptian woman)
 * - Falcon:   ar-EG-ShakirNeural (authentic deep noble Egyptian gentleman)
 */
async function synthesizeWithEgyptianNeuralTts(
  text: string,
  persona: NeuralTtsPersona
): Promise<NeuralTtsAudioResult | null> {
  const safeText = escapeForSsml(text);
  if (!safeText) return null;

  const voice = persona === 'shamousa' ? 'ar-EG-SalmaNeural' : 'ar-EG-ShakirNeural';
  const prosody =
    persona === 'shamousa'
      ? { rate: '+3%', pitch: '+2Hz' }
      : { rate: '-2%', pitch: '-4Hz' };

  const tts = new MsEdgeTTS();
  try {
    const buffer = await Promise.race([
      (async () => {
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(safeText, prosody);
        return await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          audioStream.on('data', (chunk: any) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          audioStream.on('end', () => resolve(Buffer.concat(chunks)));
          audioStream.on('error', (err: any) => reject(err));
        });
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('EGYPTIAN_NEURAL_TIMEOUT')), 7000)
      ),
    ]);

    if (buffer && buffer.length > 200) {
      return {
        buffer,
        contentType: 'audio/mpeg',
        engine: 'egyptian_neural',
      };
    }
    return null;
  } catch (err: any) {
    console.warn('[Egyptian Neural TTS Notice]:', err?.message || err);
    return null;
  } finally {
    // Close cleanly after stream completion without risking uncaught socket errors
    setTimeout(() => {
      try {
        tts.close();
      } catch {}
    }, 50);
  }
}

/**
 * Main Entry: Synthesizes natural, non-robotic Egyptian human speech for Shamousa & Falcon.
 * Priority:
 *  1) Cache hit (0ms)
 *  2) Gemini 3.8 Neural Voice (Kore / Fenrir with Egyptian colloquial persona design)
 *  3) Native Egyptian Neural Voices (ar-EG-SalmaNeural / ar-EG-ShakirNeural — 100% free & unlimited)
 */
export async function synthesizePersonaSpeech(
  rawText: string,
  persona: NeuralTtsPersona
): Promise<NeuralTtsAudioResult | null> {
  const text = String(rawText || '').trim().slice(0, 380);
  if (!text) return null;

  const cacheKey = `${persona}:${text}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // Tier 1: Gemini 3.8 expressive human voice
  const geminiAudio = await synthesizeWithGeminiTts(text, persona);
  if (geminiAudio) {
    putCache(cacheKey, geminiAudio);
    return geminiAudio;
  }

  // Tier 2: Unlimited native Egyptian neural voices (Salma / Shakir)
  const egyptianNeural = await synthesizeWithEgyptianNeuralTts(text, persona);
  if (egyptianNeural) {
    putCache(cacheKey, egyptianNeural);
    return egyptianNeural;
  }

  return null;
}
