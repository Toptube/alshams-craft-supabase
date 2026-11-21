import { GoogleGenAI } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export type NeuralTtsPersona = 'shamousa' | 'falcon';

export interface NeuralTtsAudioResult {
  buffer: Buffer;
  contentType: 'audio/wav' | 'audio/mpeg';
  engine: 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts' | 'egyptian_neural';
}

interface CacheEntry {
  result: NeuralTtsAudioResult;
  expiresAt: number;
}

const AUDIO_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_ITEMS = 120;
const CACHE_TTL_MS = 30 * 60 * 1000;

// Per-key cooldown so one invalid/quota-limited key NEVER blocks process.env.GEMINI_API_KEY
const keyCooldownUntil = new Map<string, number>();

function cleanEnvKey(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * IMPORTANT: Put platform `process.env.GEMINI_API_KEY` FIRST because it has direct access
 * to `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts`, then try any custom keys.
 */
function getTtsGeminiKeys(persona: NeuralTtsPersona): string[] {
  const ordered =
    persona === 'shamousa'
      ? [
          process.env.GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_SHAMOUSA,
          process.env.SHAMOUSA_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON_CHAT,
          process.env.GEMINI_API_KEY_FALCON,
        ]
      : [
          process.env.GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON_CHAT,
          process.env.GEMINI_API_KEY_FALCON,
          process.env.GEMINI_API_KEY_SHAMOUSA,
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
 * Ensures Gemini audio bytes are wrapped in a valid RIFF WAV container (24kHz mono 16-bit LE).
 * Gemini 3.8 unary returns complete WAV (starts with "RIFF"); raw PCM is automatically wrapped.
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
 * - Uses flagship `gemini-3.8-flash-tts` (Voice Design) first, then `gemini-3.8-flash-lite-tts`.
 * - Shamousa: Kore — warm, cheerful, charming colloquial Egyptian woman
 * - Falcon:   Fenrir — deep, noble, charismatic Egyptian gentleman & proud artisan knight
 */
async function synthesizeWithGeminiTts(
  text: string,
  persona: NeuralTtsPersona
): Promise<NeuralTtsAudioResult | null> {
  const keys = getTtsGeminiKeys(persona);
  if (keys.length === 0) return null;

  const voiceName = persona === 'shamousa' ? 'Kore' : 'Fenrir';
  const style =
    persona === 'shamousa'
      ? 'Warm, cheerful, charming Egyptian woman speaking natural Cairo colloquial Arabic (عامية مصرية لطيفة ومريحة ومرحة) with elegance, friendliness, smiling human inflection, natural breath and rhythm — never robotic'
      : 'Deep, resonant, dignified, charismatic Egyptian gentleman and proud noble artisan knight speaking confident Cairo colloquial Arabic (عامية مصرية راقية بفخامة وعزة ووقار) with warmth, strength, authority, and natural human cadence — never robotic';

  const models: Array<'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts'> = [
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
  ];

  const now = Date.now();
  for (const apiKey of keys) {
    const keyTag = apiKey.slice(-6);
    const coolUntil = keyCooldownUntil.get(keyTag) || 0;
    if (now < coolUntil) continue;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    for (const model of models) {
      const t0 = Date.now();
      try {
        const response: any = await Promise.race([
          ai.models.generateContent({
            model,
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
            setTimeout(() => reject(new Error('GEMINI_TTS_TIMEOUT')), 9000)
          ),
        ]);

        const parts = response?.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((p: any) => p?.inlineData?.data);
        const base64Audio: string | undefined = audioPart?.inlineData?.data;
        if (base64Audio && base64Audio.length > 100) {
          const rawBytes = Buffer.from(base64Audio, 'base64');
          const wavBuffer = ensureWavBuffer(rawBytes, 24000);
          console.log(
            `[Neural TTS] OK persona=${persona} engine=${model} bytes=${wavBuffer.length} ms=${Date.now() - t0}`
          );
          return {
            buffer: wavBuffer,
            contentType: 'audio/wav',
            engine: model,
          };
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        const status = Number(err?.status || err?.code || 0);
        console.warn(
          `[Neural TTS] Gemini attempt failed (${model}, key=...${keyTag}, status=${status}): ${msg.slice(0, 140)}`
        );
        if (status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(msg)) {
          keyCooldownUntil.set(keyTag, Date.now() + 2 * 60 * 1000);
          break; // try next key
        }
        if (status === 403 || status === 401 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
          keyCooldownUntil.set(keyTag, Date.now() + 5 * 60 * 1000);
          break; // try next key
        }
        // On 404 or model-specific error, continue to next model (e.g. flash-lite-tts) or next key
      }
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
      ? { rate: '+4%', pitch: '+3Hz' }
      : { rate: '-2%', pitch: '-5Hz' };

  const t0 = Date.now();
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
        setTimeout(() => reject(new Error('EGYPTIAN_NEURAL_TIMEOUT')), 9000)
      ),
    ]);

    if (buffer && buffer.length > 200) {
      console.log(
        `[Neural TTS] OK persona=${persona} engine=${voice} bytes=${buffer.length} ms=${Date.now() - t0}`
      );
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
    setTimeout(() => {
      try {
        tts.close();
      } catch {}
    }, 80);
  }
}

/**
 * Main Entry: Synthesizes natural, expressive Egyptian human speech for Shamousa & Falcon.
 * Priority:
 *  1) Cache hit (0ms)
 *  2) Gemini 3.8 Expressive Human Voice (`gemini-3.8-flash-tts` -> `gemini-3.8-flash-lite-tts`)
 *  3) Native Egyptian Neural Voices (`ar-EG-SalmaNeural` / `ar-EG-ShakirNeural` — unlimited & free)
 */
export async function synthesizePersonaSpeech(
  rawText: string,
  persona: NeuralTtsPersona
): Promise<NeuralTtsAudioResult | null> {
  const text = String(rawText || '').trim().slice(0, 420);
  if (!text) return null;

  const cacheKey = `${persona}:${text}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // Tier 1: Gemini 3.8 flagship expressive Egyptian voice
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
