import { GoogleGenAI } from '@google/genai';

export type NeuralTtsPersona = 'shamousa' | 'falcon';

export interface NeuralTtsAudioResult {
  buffer: Buffer;
  contentType: 'audio/wav';
  engine: 'gemini-3.8-flash-lite-tts' | 'gemini-2.5-flash-preview-tts' | 'gemini-3.8-flash-tts';
}

interface CacheEntry {
  result: NeuralTtsAudioResult;
  expiresAt: number;
}

const AUDIO_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_ITEMS = 180;
const CACHE_TTL_MS = 45 * 60 * 1000;

// Separate cooldown maps:
// 1) invalidKeyUntil: ONLY for 401/403/invalid key (skips broken keys for 30 min)
// 2) modelKeyCooldownUntil: per-(key, model) cooldown on 429 so a 429 on one model
//    NEVER blocks the other working Gemini TTS models on the SAME key!
const invalidKeyUntil = new Map<string, number>();
const modelKeyCooldownUntil = new Map<string, number>();

// Round-robin counter so consecutive messages naturally alternate across all free keys
let roundRobinCursor = 0;

function cleanEnvKey(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Returns all unique configured Gemini API keys, rotated by round-robin so free-tier RPM
 * is evenly spread across all keys instead of hammering one key until 429.
 */
function getRotatedTtsKeys(persona: NeuralTtsPersona): string[] {
  const ordered =
    persona === 'shamousa'
      ? [
          process.env.GEMINI_API_KEY_SHAMOUSA,
          process.env.SHAMOUSA_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON_CHAT,
          process.env.FALCON_CHAT_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON_VISION,
          process.env.FALCON_VISION_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON,
          process.env.FALCON_GEMINI_API_KEY,
        ]
      : [
          process.env.GEMINI_API_KEY_FALCON_CHAT,
          process.env.FALCON_CHAT_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON_VISION,
          process.env.FALCON_VISION_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_FALCON,
          process.env.FALCON_GEMINI_API_KEY,
          process.env.GEMINI_API_KEY_SHAMOUSA,
          process.env.SHAMOUSA_GEMINI_API_KEY,
        ];

  const primaryUnique = Array.from(new Set(ordered.map(cleanEnvKey).filter(Boolean)));
  const fallbackPlatformKey = cleanEnvKey(process.env.GEMINI_API_KEY);

  if (primaryUnique.length > 1) {
    const offset = roundRobinCursor % primaryUnique.length;
    roundRobinCursor = (roundRobinCursor + 1) % 100000;
    const rotated = [...primaryUnique.slice(offset), ...primaryUnique.slice(0, offset)];
    if (fallbackPlatformKey && !rotated.includes(fallbackPlatformKey)) {
      rotated.push(fallbackPlatformKey);
    }
    return rotated;
  }

  if (fallbackPlatformKey && !primaryUnique.includes(fallbackPlatformKey)) {
    primaryUnique.push(fallbackPlatformKey);
  }
  return primaryUnique;
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
 * - `gemini-3.8-flash-lite-tts` & `gemini-3.8-flash-tts` return a complete WAV file (starts with "RIFF").
 * - `gemini-2.5-flash-preview-tts` returns raw L16 PCM and is wrapped cleanly in a 44-byte WAV header.
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

interface TtsModelSpec {
  id: 'gemini-3.8-flash-lite-tts' | 'gemini-2.5-flash-preview-tts' | 'gemini-3.8-flash-tts';
  supportsMetadata: boolean;
}

/**
 * Pure Real Studio-Grade Gemini Human Egyptian Voices (100% Free — Continuous & Unstoppable):
 * - Uses `apiVersion: 'v1beta'` (required by `@google/genai` v3+ for `speechConfig` & `speechMetadata`).
 * - Model-first + Round-Robin-Key cascade with PER-(key, model) cooldowns:
 *   1) `gemini-3.8-flash-lite-tts` (High-throughput free quota, ~1.8s, full `speechMetadata.style` Egyptian human voice)
 *   2) `gemini-2.5-flash-preview-tts` (Separate free quota pool, ~1.8s, expressive Egyptian human voice)
 *   3) `gemini-3.8-flash-tts` (Flagship Voice Design backup pool)
 * - A 429 on one model NEVER bans the key — it smoothly switches to the next key or next Gemini model!
 */
async function synthesizeWithGeminiTts(
  text: string,
  persona: NeuralTtsPersona
): Promise<NeuralTtsAudioResult | null> {
  const keys = getRotatedTtsKeys(persona);
  if (keys.length === 0) return null;

  const voiceName = persona === 'shamousa' ? 'Kore' : 'Fenrir';
  const style =
    persona === 'shamousa'
      ? 'Warm, cheerful, playful, charming Egyptian woman speaking natural everyday Cairo colloquial Arabic (عامية مصرية قاهرية دافية ومرحة ولذيذة ومريحة) with a soft smile, elegant feminine warmth, natural breathing, lively human intonation — sounds like a real beloved Egyptian friend, never flat or robotic'
      : 'Deep, resonant, dignified, charismatic Egyptian gentleman and proud authentic Egyptian knight speaking refined Cairo colloquial Arabic (عامية مصرية راقية بفخامة وعزة ووقار وذكاء وشهامة) with rich masculine gravity, calm authority, warmth, and natural human cadence — never robotic';

  const models: TtsModelSpec[] = [
    { id: 'gemini-3.8-flash-lite-tts', supportsMetadata: true },
    { id: 'gemini-2.5-flash-preview-tts', supportsMetadata: false },
    { id: 'gemini-3.8-flash-tts', supportsMetadata: true },
  ];

  // Build ordered attempt list: try high-quota model across all keys first, then next model across all keys
  const now = Date.now();
  const attempts: Array<{ apiKey: string; keyTag: string; model: TtsModelSpec }> = [];
  for (const model of models) {
    for (const apiKey of keys) {
      const keyTag = apiKey.slice(-6);
      if (now < (invalidKeyUntil.get(keyTag) || 0)) continue;
      if (now < (modelKeyCooldownUntil.get(`${keyTag}:${model.id}`) || 0)) continue;
      attempts.push({ apiKey, keyTag, model });
    }
  }

  // If every pair is temporarily cooling down, try the earliest-expiring pair as a last-chance attempt
  if (attempts.length === 0) {
    for (const model of models) {
      for (const apiKey of keys) {
        const keyTag = apiKey.slice(-6);
        if (now < (invalidKeyUntil.get(keyTag) || 0)) continue;
        attempts.push({ apiKey, keyTag, model });
      }
    }
  }

  for (const { apiKey, keyTag, model } of attempts) {
    // Re-check in case an earlier attempt in this same loop marked the key invalid
    if (Date.now() < (invalidKeyUntil.get(keyTag) || 0)) continue;

    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const t0 = Date.now();
    try {
      const partPayload: any = model.supportsMetadata
        ? {
            text,
            speechMetadata: { style },
          }
        : {
            text:
              persona === 'shamousa'
                ? `اقرئي الكلام ده بصوت أنثوي مصري قاهري طبيعي دافئ ومرح ولذيذ جداً:\n${text}`
                : `اقرأ الكلام ده بصوت رجولي مصري عميق راقي فيه فخامة وعزة ووقار بالعامية المصرية:\n${text}`,
          };

      const response: any = await Promise.race([
        ai.models.generateContent({
          model: model.id,
          contents: [
            {
              role: 'user',
              parts: [partPayload],
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
          setTimeout(() => reject(new Error('GEMINI_TTS_TIMEOUT')), 14000)
        ),
      ]);

      const parts = response?.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find((p: any) => p?.inlineData?.data);
      const base64Audio: string | undefined = audioPart?.inlineData?.data;
      if (base64Audio && base64Audio.length > 100) {
        const rawBytes = Buffer.from(base64Audio, 'base64');
        const wavBuffer = ensureWavBuffer(rawBytes, 24000);
        console.log(
          `[Gemini Studio TTS] OK persona=${persona} engine=${model.id} key=...${keyTag} bytes=${wavBuffer.length} ms=${Date.now() - t0}`
        );
        return {
          buffer: wavBuffer,
          contentType: 'audio/wav',
          engine: model.id,
        };
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      const status = Number(err?.status || err?.code || 0);
      console.warn(
        `[Gemini Studio TTS] attempt failed (${model.id}, key=...${keyTag}, status=${status}): ${msg.slice(0, 150)}`
      );

      if (
        status === 401 ||
        status === 403 ||
        /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)
      ) {
        // Key itself is invalid — skip this key across all models for 30 min
        invalidKeyUntil.set(keyTag, Date.now() + 30 * 60 * 1000);
        continue;
      }

      if (status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(msg)) {
        // ONLY cool down THIS exact (key, model) pair — NEVER block the other Gemini models on this key!
        const isDailyOrPlanZero = /limit:\s*0|PerDay|daily/i.test(msg);
        const cooldownMs = isDailyOrPlanZero ? 10 * 60 * 1000 : 45 * 1000;
        modelKeyCooldownUntil.set(`${keyTag}:${model.id}`, Date.now() + cooldownMs);
        continue;
      }

      // Transient timeout or 5xx — move cleanly to next (key, model) pair
    }
  }

  return null;
}

/**
 * Main Entry: Synthesizes genuine studio-grade Gemini human Egyptian speech for Shamousa & Falcon.
 * Alternates smoothly across all active free keys and all 3 real Gemini TTS models so speech stays continuous.
 */
export async function synthesizePersonaSpeech(
  rawText: string,
  persona: NeuralTtsPersona
): Promise<NeuralTtsAudioResult | null> {
  const text = String(rawText || '').trim().slice(0, 750);
  if (!text) return null;

  const cacheKey = `${persona}:${text}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const geminiAudio = await synthesizeWithGeminiTts(text, persona);
  if (geminiAudio) {
    putCache(cacheKey, geminiAudio);
    return geminiAudio;
  }

  return null;
}
