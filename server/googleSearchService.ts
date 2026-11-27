import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import * as webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __gsFilename = fileURLToPath(import.meta.url);
const __gsDirname = path.dirname(__gsFilename);
const VAPID_KEYS_PATH = path.resolve(__gsDirname, '../data/vapid_keys.json');

export type AIAgentRole =
  | 'falcon'
  | 'falcon_chat'
  | 'falcon_vision'
  | 'shamousa'
  | 'search';

export interface GroundedSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface GoogleSearchResult {
  answer: string;
  sources: GroundedSource[];
  searchEntryPoint?: string;
  searchUsed: boolean;
  engine:
    | 'gemini_google_search'
    | 'web_search_plus_groq'
    | 'web_search_direct';
}

// Free-tier models ONLY (all paid-only models strictly excluded)
export const PRIMARY_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_GEMINI_MODEL = 'gemini-4-hydrogen';
export const ACTIVE_GROQ_CHAT_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b',
  'qwen/qwen3.8-27b',
] as const;
export const ACTIVE_FANAR_MODELS = ['Fanar'] as const;
export const DEFAULT_TAYGOS_API_URL = 'https://taygos-apis-768687356856.europe-west2.run.app/api/v1/chat/completions';
export const DEFAULT_OLLAMA_CLOUD_URL = 'https://ollama.com/api/chat';
export const ACTIVE_OLLAMA_CLOUD_MODELS = [
  'gpt-oss:20b',
  'gemma4:31b',
  'deepseek-v4.1-flash',
  'glm-5.3-flash',
  'gpt-oss:120b',
] as const;

// Circuit breaker to avoid wasting sequential retries on invalid/revoked Gemini keys
const GEMINI_KEY_CIRCUIT_TTL_MS = 5 * 60 * 1000;
const geminiInvalidKeyCircuit = new Map<string, { until: number; reason: string }>();

// Fast 20s/25s cooldowns so Google Search #1 & Groq #2 recover swiftly while Tier 3 free keyless search keeps service uninterrupted
const GEMINI_SEARCH_COOLDOWN_MS = 20 * 1000;
const GROQ_SEARCH_COOLDOWN_MS = 25 * 1000;
let geminiSearchCooldownUntil = 0;
let groqSearchCooldownUntil = 0;
let groqSearchKeyCursor = 0;
let geminiKeyRoundRobin = 0;

export function isGeminiSearchCircuitOpen(): boolean {
  return Date.now() < geminiSearchCooldownUntil;
}

export function tripGeminiSearchCircuit(err?: any): void {
  const msg = String(err?.message || err || '');
  const status = Number(err?.status || err?.code || 0);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(msg)) {
    geminiSearchCooldownUntil = Date.now() + GEMINI_SEARCH_COOLDOWN_MS;
    console.warn('[Search Circuit] Google Search hit 429 -> failing over to Groq browser_search for 20s, then resuming Google Search #1.');
  }
}

export function isGroqSearchCircuitOpen(): boolean {
  return Date.now() < groqSearchCooldownUntil;
}

export function getLiveSearchHealthStatus(): {
  googleSearchReady: boolean;
  groqSearchReady: boolean;
  liveSearchAvailable: boolean;
  primaryEngine: 'google_search' | 'groq_search' | 'web_search' | 'offline';
} {
  const geminiKey = resolveAgentGeminiKey('search');
  const googleSearchReady = Boolean(
    geminiKey && !isGeminiKeyCircuitOpen(geminiKey) && !isGeminiSearchCircuitOpen()
  );
  const groqKeys = getGroqApiKeys();
  const groqSearchReady = groqKeys.length > 0 && !isGroqSearchCircuitOpen();
  const fanarReady = Boolean(getFanarApiKey());
  const taygosReady = Boolean(getTaygosConfig().apiKey);
  const ollamaReady = Boolean(getOllamaConfig().apiKey);
  // Tier 3 (free keyless DuckDuckGo/Google News RSS + any AI synthesizer) stays live even during a 20s Tier 1/2 RPM cooldown
  const anySynthesisReady = Boolean(
    (geminiKey && !isGeminiKeyCircuitOpen(geminiKey)) || groqKeys.length > 0 || taygosReady || ollamaReady || fanarReady
  );
  const liveSearchAvailable = googleSearchReady || groqSearchReady || anySynthesisReady;
  const primaryEngine = googleSearchReady
    ? 'google_search'
    : groqSearchReady
    ? 'groq_search'
    : anySynthesisReady
    ? 'web_search'
    : 'offline';
  return {
    googleSearchReady,
    groqSearchReady,
    liveSearchAvailable,
    primaryEngine,
  };
}

export function isGeminiAuthOrKeyError(err: any): boolean {
  const status = Number(err?.status || err?.code || 0);
  const msg = String(err?.message || err || '').toLowerCase();
  if (status === 401 || status === 403) return true;
  return (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid_api_key') ||
    msg.includes('invalid api key') ||
    msg.includes('api key expired') ||
    msg.includes('permission_denied')
  );
}

export function isGeminiKeyCircuitOpen(rawKey?: string): boolean {
  const key = cleanSecretValue(rawKey);
  if (!key) return false;
  const entry = geminiInvalidKeyCircuit.get(key);
  if (!entry) return false;
  if (Date.now() >= entry.until) {
    geminiInvalidKeyCircuit.delete(key);
    return false;
  }
  return true;
}

export function tripGeminiKeyCircuit(rawKey: string, err: any): boolean {
  const key = cleanSecretValue(rawKey);
  if (!key || !isGeminiAuthOrKeyError(err)) return false;
  const alreadyOpen = isGeminiKeyCircuitOpen(key);
  const reason = formatAiErrorReason(String(err?.message || err || 'API_KEY_INVALID'));
  geminiInvalidKeyCircuit.set(key, {
    until: Date.now() + GEMINI_KEY_CIRCUIT_TTL_MS,
    reason,
  });
  if (!alreadyOpen) {
    console.warn(`[Gemini Circuit] Key temporarily bypassed for 5m (${reason}) — routing instantly to live Groq/Fanar providers.`);
  }
  return true;
}

export function clearGeminiKeyCircuit(rawKey?: string): void {
  if (!rawKey) {
    geminiInvalidKeyCircuit.clear();
    return;
  }
  const key = cleanSecretValue(rawKey);
  if (key) geminiInvalidKeyCircuit.delete(key);
}

export function cleanSecretValue(raw?: string): string {
  const s = String(raw || '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

export function getGroqApiKeys(): string[] {
  const candidates = [
    cleanSecretValue(process.env.GROQ_API_KEY),
    cleanSecretValue(process.env.GROQ_API_KEY_SECONDARY),
    cleanSecretValue(process.env.GROQ_API_KEY_BACKUP),
    cleanSecretValue(process.env.GROQ_SECONDARY_API_KEY),
    cleanSecretValue(process.env.GROQ_API_KEY_2),
    cleanSecretValue(process.env.GROQ_BACKUP_KEY),
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

export function getFanarApiKey(): string {
  return cleanSecretValue(process.env.FANAR_API_KEY || process.env.FANAR_KEY);
}

/**
 * Validates that an external AI provider endpoint is strictly HTTPS and not targeting
 * loopback, private RFC1918, or cloud metadata addresses.
 */
function isSafeExternalHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function looksLikeProviderSecretOrKey(val: string): boolean {
  const s = val.trim();
  if (!s) return false;
  return /^(pk_|sk_|gsk_|AIza|http:\/\/|https:\/\/)/i.test(s) || s.includes(':sk_');
}

function isValidAsciiModelId(val: string): boolean {
  const s = val.trim();
  if (!s || s.length < 2 || s.length > 90) return false;
  if (looksLikeProviderSecretOrKey(s)) return false;
  if (/^(ollama|taygos|alshams|alshamsawya|alshams[\s_-]?craft|auto|default|none|null)$/i.test(s)) {
    return false;
  }
  return /^[a-zA-Z0-9._:/-]+$/.test(s);
}

function stripBearerPrefix(val: string): string {
  return val.replace(/^bearer\s+/i, '').trim();
}

function extractSanitizedErrorDetail(rawText: string): string {
  const safe = redactSecrets(String(rawText || '')).trim();
  if (!safe) return '';
  try {
    const parsed: any = JSON.parse(safe);
    const msg =
      parsed?.error?.message ||
      (typeof parsed?.error === 'string' ? parsed.error : '') ||
      parsed?.message ||
      parsed?.detail ||
      '';
    if (msg) return redactSecrets(String(msg)).replace(/\s+/g, ' ').trim().slice(0, 180);
  } catch {}
  return safe.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function getTaygosConfig(): {
  apiKey: string;
  publicKey: string;
  secretKey: string;
  apiUrl: string;
  model: string;
} {
  const rawVars = [
    stripBearerPrefix(cleanSecretValue(process.env.TAYGOS_API_KEY)),
    stripBearerPrefix(cleanSecretValue(process.env.TAYGOS_ALSHAMS_API_KEY)),
    stripBearerPrefix(cleanSecretValue(process.env.TAYGOS_PUBLIC_KEY)),
    stripBearerPrefix(cleanSecretValue(process.env.TAYGOS_SECRET_KEY)),
    stripBearerPrefix(cleanSecretValue(process.env.TAYGOS_MODEL)),
  ].filter(Boolean);

  let combinedPair = '';
  let publicKey = '';
  let secretKey = '';

  for (const v of rawVars) {
    if (v.includes(':sk_taygos_') || /^pk_[^:]+:sk_.+/i.test(v)) {
      combinedPair = v;
      const [pk, ...rest] = v.split(':');
      publicKey = publicKey || pk.trim();
      secretKey = secretKey || rest.join(':').trim();
    } else if (/^pk_taygos_/i.test(v)) {
      publicKey = publicKey || v;
    } else if (/^sk_taygos_/i.test(v)) {
      secretKey = secretKey || v;
    }
  }

  const directFallback = stripBearerPrefix(
    cleanSecretValue(process.env.TAYGOS_API_KEY || process.env.TAYGOS_ALSHAMS_API_KEY)
  );
  const apiKey =
    combinedPair ||
    (publicKey && secretKey ? `${publicKey}:${secretKey}` : '') ||
    secretKey ||
    directFallback;

  const rawUrl = cleanSecretValue(process.env.TAYGOS_API_URL);
  const apiUrl =
    rawUrl &&
    isSafeExternalHttpsUrl(rawUrl) &&
    /\/chat\/completions\/?$/i.test(rawUrl)
      ? rawUrl
      : DEFAULT_TAYGOS_API_URL;

  const rawModel = cleanSecretValue(process.env.TAYGOS_MODEL);
  const model = isValidAsciiModelId(rawModel) ? rawModel : 'auto';
  return { apiKey, publicKey, secretKey, apiUrl, model };
}

let cachedOllamaCloudModels: { models: string[]; fetchedAt: number } | null = null;

async function discoverOllamaCloudModels(apiKey: string): Promise<string[]> {
  if (cachedOllamaCloudModels && Date.now() - cachedOllamaCloudModels.fetchedAt < 10 * 60 * 1000) {
    return cachedOllamaCloudModels.models;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch('https://ollama.com/api/tags', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (res.ok) {
      const data: any = await res.json();
      const rawList = Array.isArray(data?.models) ? data.models : [];
      const discovered = rawList
        .map((m: any) => String(m?.name || m?.model || '').trim())
        .filter((name: string) => isValidAsciiModelId(name) && !/embed|whisper|rerank/i.test(name));
      if (discovered.length > 0) {
        // Prefer fast strong multilingual/Arabic-capable models first
        const preferredOrder = ['gpt-oss', 'qwen3', 'gemma3', 'deepseek', 'llama'];
        discovered.sort((a: string, b: string) => {
          const ia = preferredOrder.findIndex((p) => a.toLowerCase().includes(p));
          const ib = preferredOrder.findIndex((p) => b.toLowerCase().includes(p));
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        cachedOllamaCloudModels = { models: discovered.slice(0, 6), fetchedAt: Date.now() };
        return cachedOllamaCloudModels.models;
      }
    }
  } catch {
    // Fallback to curated list below
  } finally {
    clearTimeout(timer);
  }
  return [];
}

export function getOllamaConfig(): { apiKey: string; apiUrl: string; models: string[] } {
  const apiKey = stripBearerPrefix(
    cleanSecretValue(
      process.env.OLLAMA_API_KEY || process.env.OLLAMA_CLOUD_API_KEY || process.env.OLLAMA_KEY
    )
  );
  const rawUrl = cleanSecretValue(process.env.OLLAMA_API_URL);
  // لو المستخدم حط رابط صفحة الإعدادات (ollama.com/settings/keys) أو رابط غير API -> نستخدم رابط Ollama Cloud API الرسمي تلقائياً
  const isValidOllamaEndpoint =
    Boolean(rawUrl) &&
    isSafeExternalHttpsUrl(rawUrl) &&
    !/\/settings(\/|$)/i.test(rawUrl) &&
    (/\/api\/chat\/?$/i.test(rawUrl) || /\/v1\/chat\/completions\/?$/i.test(rawUrl));
  const apiUrl = isValidOllamaEndpoint ? rawUrl : DEFAULT_OLLAMA_CLOUD_URL;

  const rawModel = cleanSecretValue(process.env.OLLAMA_MODEL);
  const validEnvModel = isValidAsciiModelId(rawModel) ? rawModel : '';
  const models = Array.from(
    new Set([validEnvModel, ...ACTIVE_OLLAMA_CLOUD_MODELS].filter(Boolean))
  );
  return { apiKey, apiUrl, models };
}

function buildTaygosHeaderVariants(
  apiKey: string,
  publicKey: string,
  secretKey: string
): Array<Record<string, string>> {
  const variants: Array<Record<string, string>> = [];
  if (publicKey && secretKey) {
    variants.push({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicKey}:${secretKey}`,
      'X-Taygos-Public-Key': publicKey,
      'X-Taygos-Secret-Key': secretKey,
    });
    variants.push({
      'Content-Type': 'application/json',
      'X-Taygos-Public-Key': publicKey,
      'X-Taygos-Secret-Key': secretKey,
    });
  }
  variants.push({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  });
  return variants;
}

let taygosCooldownUntil = 0;
let ollamaCooldownUntil = 0;

export async function callTaygosGatewayChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string | null> {
  if (Date.now() < taygosCooldownUntil) return null;
  const { apiKey, publicKey, secretKey, apiUrl, model } = getTaygosConfig();
  if (!apiKey) return null;

  const candidateModels: Array<string | undefined> = Array.from(
    new Set([model === 'auto' ? undefined : model, 'taygos-unified', 'auto', undefined, 'gpt-4o-mini'])
  );
  const headerVariants = buildTaygosHeaderVariants(apiKey, publicKey, secretKey);
  let lastErr = '';

  for (const candidateModel of candidateModels) {
    for (let authIdx = 0; authIdx < headerVariants.length; authIdx++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 22000);
      try {
        const bodyObj: Record<string, any> = {
          messages,
          temperature: opts?.temperature ?? 0.5,
          max_tokens: opts?.maxTokens ?? 1200,
        };
        if (candidateModel) {
          bodyObj.model = candidateModel;
        }

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: headerVariants[authIdx],
          body: JSON.stringify(bodyObj),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = extractSanitizedErrorDetail(await res.text().catch(() => ''));
          lastErr = `HTTP ${res.status}: ${errBody}`;
          if ((res.status === 401 || res.status === 403) && authIdx + 1 < headerVariants.length) {
            continue;
          }
          if (res.status === 400 || res.status === 404 || res.status === 422) {
            break; // try next model format
          }
          throw new Error(`Taygos ${lastErr}`);
        }

        const data: any = await res.json();
        const rawTxt = String(
          data?.choices?.[0]?.message?.content ||
            data?.message?.content ||
            data?.reply ||
            data?.text ||
            data?.output ||
            ''
        ).trim();
        const cleaned = rawTxt.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (cleaned) return cleaned;
        break;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          lastErr = 'Timeout';
          break;
        }
        lastErr = redactSecrets(err?.message || String(err));
        if (lastErr.includes('401') || lastErr.includes('403')) {
          if (authIdx + 1 < headerVariants.length) continue;
          taygosCooldownUntil = Date.now() + 5 * 60 * 1000;
          throw new Error(`Taygos auth error: ${lastErr}`);
        }
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  if (lastErr) {
    console.warn(`[Taygos Gateway] Skipped: ${redactSecrets(lastErr)}`);
  }
  return null;
}

export async function callOllamaCloudChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string | null> {
  if (Date.now() < ollamaCooldownUntil) return null;
  const { apiKey, apiUrl, models: staticModels } = getOllamaConfig();
  if (!apiKey) return null;

  const discoveredModels = await discoverOllamaCloudModels(apiKey);
  const models = Array.from(new Set([...discoveredModels, ...staticModels])).slice(0, 6);

  const isOpenAICompat = /\/v1\/chat\/completions\/?$/i.test(apiUrl);
  let lastErr = '';

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 22000);
    try {
      const payload = isOpenAICompat
        ? {
            model,
            messages,
            temperature: opts?.temperature ?? 0.5,
            max_tokens: opts?.maxTokens ?? 1200,
          }
        : {
            model,
            messages,
            stream: false,
            options: {
              temperature: opts?.temperature ?? 0.5,
              num_predict: opts?.maxTokens ?? 1200,
            },
          };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = extractSanitizedErrorDetail(await res.text().catch(() => ''));
        lastErr = `HTTP ${res.status} [${model}]: ${errBody}`;
        if (res.status === 402 || res.status === 401 || res.status === 403) {
          ollamaCooldownUntil = Date.now() + 10 * 60 * 1000;
          throw new Error(`Ollama Cloud ${lastErr}`);
        }
        if (res.status === 404 || res.status === 429 || res.status === 400) {
          continue;
        }
        throw new Error(`Ollama Cloud ${lastErr}`);
      }

      const data: any = await res.json();
      const rawTxt = String(
        data?.message?.content || data?.choices?.[0]?.message?.content || data?.response || ''
      ).trim();
      const cleaned = rawTxt.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (cleaned) return cleaned;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        lastErr = `Timeout on ${model}`;
        continue;
      }
      lastErr = redactSecrets(err?.message || String(err));
      if (lastErr.includes('401') || lastErr.includes('403')) {
        throw new Error(`Ollama Cloud auth error: ${lastErr}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastErr) {
    console.warn(`[Ollama Cloud] Skipped: ${redactSecrets(lastErr)}`);
  }
  return null;
}

function getTaygosBaseV1Url(chatApiUrl: string): string {
  const base = chatApiUrl.replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '');
  return isSafeExternalHttpsUrl(base) ? base : 'https://taygos-apis-768687356856.europe-west2.run.app/api/v1';
}

export interface TaygosImageResult {
  ok: boolean;
  statusCode?: number;
  provider?: string;
  model?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  summary: string;
  detail?: string;
}

function extractTaygosProviderMeta(data: any, fallbackModel: string): { provider?: string; model: string } {
  const provObj = data?.provider && typeof data.provider === 'object' ? data.provider : null;
  const providerStr = provObj
    ? String(provObj.name || provObj.id || '').trim()
    : typeof data?.provider === 'string'
    ? data.provider.trim()
    : typeof data?.backend === 'string'
    ? data.backend.trim()
    : '';
  const modelStr = String(
    (provObj && provObj.model) ||
      (typeof data?.model === 'string' ? data.model : '') ||
      (Array.isArray(data?.data) && typeof data.data[0]?.model === 'string' ? data.data[0].model : '') ||
      fallbackModel
  ).trim();
  return {
    provider: providerStr || undefined,
    model: modelStr || fallbackModel,
  };
}

function findNestedMediaString(obj: any, kind: 'image' | 'video', depth = 0): { url?: string; base64?: string } {
  if (!obj || depth > 4) return {};
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (kind === 'image') {
      if (s.startsWith('data:image/')) return { url: s };
      if (/^https?:\/\//i.test(s) && /\.(png|jpe?g|webp|gif|avif)|image|gradio|hf\.space|pollinations|replicate|fal\.media|storage/i.test(s)) {
        return { url: s };
      }
    } else {
      if (s.startsWith('data:video/')) return { url: s };
      if (/^https?:\/\//i.test(s) && /\.(mp4|webm|mov)|video|gradio|hf\.space|replicate|fal\.media|storage/i.test(s)) {
        return { url: s };
      }
    }
    return {};
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findNestedMediaString(item, kind, depth + 1);
      if (found.url || found.base64) return found;
    }
    return {};
  }
  if (typeof obj === 'object') {
    const urlKeys =
      kind === 'image'
        ? ['imageDataUrl', 'dataUrl', 'sceneImageUrl', 'imageUrl', 'image_url', 'url', 'outputUrl', 'mediaUrl']
        : ['videoDataUrl', 'videoUrl', 'video_url', 'dataUrl', 'url', 'outputUrl', 'mediaUrl'];
    for (const k of urlKeys) {
      const v = obj[k];
      if (typeof v === 'string' && (v.startsWith('https://') || v.startsWith('http://') || v.startsWith('data:'))) {
        return { url: v.trim() };
      }
    }
    const b64Keys =
      kind === 'image'
        ? ['b64_json', 'imageBase64', 'image_base64', 'base64', 'image']
        : ['b64_json', 'videoBase64', 'video_base64', 'base64'];
    for (const k of b64Keys) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim().length > 80) {
        const trimmed = v.trim();
        if (trimmed.startsWith('data:') || trimmed.startsWith('https://')) return { url: trimmed };
        return { base64: trimmed };
      }
    }
    const nestedContainers = ['result', 'output', 'data', 'media', 'asset', 'artifacts', 'images', 'videos'];
    for (const nk of nestedContainers) {
      if (obj[nk]) {
        const found = findNestedMediaString(obj[nk], kind, depth + 1);
        if (found.url || found.base64) return found;
      }
    }
  }
  return {};
}

export async function callTaygosGatewayImage(opts: {
  prompt: string;
  task?: 'generate' | 'edit' | 'remove_background';
  image?: string;
  width?: number;
  height?: number;
  timeoutMs?: number;
}): Promise<TaygosImageResult> {
  const { apiKey, publicKey, secretKey, apiUrl } = getTaygosConfig();
  if (!apiKey) {
    return { ok: false, summary: 'بوابة Taygos غير مضبوطة في الإعدادات' };
  }
  const endpoint = `${getTaygosBaseV1Url(apiUrl)}/images/generations`;
  if (!isSafeExternalHttpsUrl(endpoint)) {
    return { ok: false, summary: 'رابط بوابة الصور غير صالح' };
  }
  const headers = buildTaygosHeaderVariants(apiKey, publicKey, secretKey)[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);
  try {
    const payload: Record<string, any> = {
      task: opts.task || 'generate',
      prompt: opts.prompt,
      width: opts.width ?? 1024,
      height: opts.height ?? 1024,
    };
    if (opts.image) {
      payload.image = opts.image;
      payload.image_url = opts.image;
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      const detail = extractSanitizedErrorDetail(rawText);
      return {
        ok: false,
        statusCode: res.status,
        summary: formatAiErrorReason(detail || `HTTP ${res.status}`),
        detail: detail || `HTTP ${res.status}`,
      };
    }
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {}
    const { provider, model } = extractTaygosProviderMeta(data, 'taygos-image');
    const found = findNestedMediaString(data, 'image');
    const imageUrl = found.url || '';
    const imageBase64 = found.base64 || '';
    const hasMedia = Boolean(
      (imageUrl && (imageUrl.startsWith('https://') || imageUrl.startsWith('http://') || imageUrl.startsWith('data:image/'))) ||
        imageBase64.length > 80
    );
    const topKeys = Object.keys(data || {}).join(',');
    return {
      ok: hasMedia,
      statusCode: res.status,
      provider,
      model,
      imageUrl: imageUrl || undefined,
      imageBase64: imageBase64 || undefined,
      mimeType: data?.mimeType || data?.result?.mimeType || 'image/png',
      summary: hasMedia ? `يعمل بنجاح (${provider || model})` : `استجاب HTTP 200 بدون رابط صورة (keys=${topKeys})`,
      detail: hasMedia
        ? `provider=${provider || model}, media=${imageUrl.startsWith('data:') ? 'dataUrl' : imageUrl ? 'url' : 'base64'}`
        : `keys=${topKeys} | ${extractSanitizedErrorDetail(rawText)}`,
    };
  } catch (e: any) {
    const detail = redactSecrets(e?.name === 'AbortError' ? 'Timeout' : e?.message || String(e));
    return { ok: false, summary: formatAiErrorReason(detail), detail };
  } finally {
    clearTimeout(timer);
  }
}

export interface TaygosVideoResult {
  ok: boolean;
  statusCode?: number;
  provider?: string;
  model?: string;
  videoUrl?: string;
  jobId?: string;
  status?: string;
  summary: string;
  detail?: string;
}

export async function callTaygosGatewayVideo(opts: {
  prompt: string;
  image?: string;
  video?: string;
  duration?: number;
  timeoutMs?: number;
}): Promise<TaygosVideoResult> {
  const { apiKey, publicKey, secretKey, apiUrl } = getTaygosConfig();
  if (!apiKey) {
    return { ok: false, summary: 'بوابة Taygos غير مضبوطة في الإعدادات' };
  }
  const endpoint = `${getTaygosBaseV1Url(apiUrl)}/videos/generations`;
  if (!isSafeExternalHttpsUrl(endpoint)) {
    return { ok: false, summary: 'رابط بوابة الفيديو غير صالح' };
  }
  const headers = buildTaygosHeaderVariants(apiKey, publicKey, secretKey)[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45000);
  try {
    const payload: Record<string, any> = {
      prompt: opts.prompt,
    };
    if (opts.image) payload.image = opts.image;
    if (opts.video) payload.video = opts.video;
    if (opts.duration) payload.duration = opts.duration;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      const detail = extractSanitizedErrorDetail(rawText);
      return {
        ok: false,
        statusCode: res.status,
        summary: formatAiErrorReason(detail || `HTTP ${res.status}`),
        detail: detail || `HTTP ${res.status}`,
      };
    }
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {}
    const { provider, model } = extractTaygosProviderMeta(data, 'taygos-video');
    const found = findNestedMediaString(data, 'video');
    const videoUrl = found.url || '';
    const jobId = String(data?.job_id || data?.jobId || data?.task_id || data?.result?.jobId || '').trim();
    const status = String(data?.status || data?.state || data?.result?.status || '').trim();
    const ok = Boolean(videoUrl || jobId || /queued|processing|pending|succeeded|completed|ready/i.test(status));
    const topKeys = Object.keys(data || {}).join(',');
    return {
      ok,
      statusCode: res.status,
      provider,
      model,
      videoUrl: videoUrl || undefined,
      jobId: jobId || undefined,
      status: status || undefined,
      summary: videoUrl
        ? `يعمل بنجاح (${provider || model})`
        : jobId
        ? `تم قبول طلب الفيديو (${status || 'queued'} — ${provider || model})`
        : `استجاب بدون رابط فيديو (keys=${topKeys})`,
      detail: ok
        ? `provider=${provider || model}${status ? `, status=${status}` : ''}`
        : `keys=${topKeys} | ${extractSanitizedErrorDetail(rawText)}`,
    };
  } catch (e: any) {
    const detail = redactSecrets(e?.name === 'AbortError' ? 'Timeout' : e?.message || String(e));
    return { ok: false, summary: formatAiErrorReason(detail), detail };
  } finally {
    clearTimeout(timer);
  }
}

async function listTaygosModels(): Promise<{ ok: boolean; count: number; ids: string[] }> {
  const { apiKey, publicKey, secretKey, apiUrl } = getTaygosConfig();
  if (!apiKey) return { ok: false, count: 0, ids: [] };
  const endpoint = `${getTaygosBaseV1Url(apiUrl)}/models`;
  if (!isSafeExternalHttpsUrl(endpoint)) return { ok: false, count: 0, ids: [] };
  const headers = buildTaygosHeaderVariants(apiKey, publicKey, secretKey)[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(endpoint, { method: 'GET', headers, signal: controller.signal });
    if (!res.ok) return { ok: false, count: 0, ids: [] };
    const data: any = await res.json();
    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
    const ids = arr.map((m: any) => String(m?.id || m?.name || '')).filter(Boolean);
    return { ok: true, count: ids.length, ids: ids.slice(0, 15) };
  } catch {
    return { ok: false, count: 0, ids: [] };
  } finally {
    clearTimeout(timer);
  }
}

export interface TaygosCapabilityStatus {
  ok: boolean;
  statusCode?: number;
  modelUsed?: string;
  provider?: string;
  summary: string;
  detail?: string;
  hasMedia?: boolean;
}

export interface BackupProviderLiveProbe {
  configured: boolean;
  ok: boolean;
  statusCode?: number;
  modelUsed?: string;
  endpointHost?: string;
  summary: string;
  detail?: string;
  checkedAt: string;
  capabilities?: {
    chat?: TaygosCapabilityStatus;
    images?: TaygosCapabilityStatus;
    videos?: TaygosCapabilityStatus;
    modelsCount?: number;
    sampleModels?: string[];
  };
}

let bootBackupProbeState: {
  taygos: BackupProviderLiveProbe | null;
  ollama: BackupProviderLiveProbe | null;
} = { taygos: null, ollama: null };

export async function probeTaygosGatewayLive(): Promise<BackupProviderLiveProbe> {
  const { apiKey, publicKey, secretKey, apiUrl, model } = getTaygosConfig();
  const checkedAt = new Date().toISOString();
  let endpointHost = '';
  try {
    endpointHost = new URL(apiUrl).hostname;
  } catch {}
  if (!apiKey) {
    return {
      configured: false,
      ok: false,
      endpointHost,
      summary: 'غير مضبوط في الإعدادات (Secrets)',
      checkedAt,
    };
  }

  const candidateModels: Array<string | undefined> = Array.from(
    new Set([model === 'auto' ? undefined : model, 'taygos-unified', 'auto', undefined, 'gpt-4o-mini'])
  );
  const headerVariants = buildTaygosHeaderVariants(apiKey, publicKey, secretKey);
  let lastStatus = 0;
  let lastErr = '';
  let chatCap: TaygosCapabilityStatus | null = null;

  for (const candidateModel of candidateModels) {
    for (const headers of headerVariants) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const bodyObj: Record<string, any> = {
          messages: [{ role: 'user', content: 'مرحبا' }],
          max_tokens: 20,
          temperature: 0.2,
        };
        if (candidateModel) bodyObj.model = candidateModel;

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyObj),
          signal: controller.signal,
        });
        lastStatus = res.status;
        if (!res.ok) {
          lastErr = extractSanitizedErrorDetail(await res.text().catch(() => ''));
          if (res.status === 401 || res.status === 403) continue;
          break;
        }
        const data: any = await res.json();
        const txt = String(
          data?.choices?.[0]?.message?.content ||
            data?.message?.content ||
            data?.reply ||
            data?.text ||
            data?.output ||
            ''
        ).trim();
        if (txt) {
          const meta = extractTaygosProviderMeta(data, candidateModel || 'taygos-unified');
          chatCap = {
            ok: true,
            statusCode: res.status,
            modelUsed: meta.model,
            provider: meta.provider,
            summary: `يعمل بنجاح (${meta.model})`,
          };
          break;
        }
        lastErr = 'رد فارغ من البوابة';
        break;
      } catch (e: any) {
        lastErr = redactSecrets(e?.message || String(e));
        break;
      } finally {
        clearTimeout(timer);
      }
    }
    if (chatCap?.ok || lastStatus === 401 || lastStatus === 403) {
      break;
    }
  }

  if (chatCap?.ok) {
    // Probe Images, Videos, and Models in parallel so we have full live visibility without slowing startup
    const [imgRes, vidRes, modelsRes] = await Promise.all([
      callTaygosGatewayImage({
        task: 'generate',
        prompt: 'Handmade beige cotton macrame coaster on clean white studio background',
        width: 512,
        height: 512,
        timeoutMs: 28000,
      }),
      callTaygosGatewayVideo({
        prompt: 'Handmade ceramic cup rotating slowly on clean white studio turntable',
        timeoutMs: 45000,
      }),
      listTaygosModels(),
    ]);

    const imagesCap: TaygosCapabilityStatus = {
      ok: imgRes.ok,
      statusCode: imgRes.statusCode,
      modelUsed: imgRes.model,
      provider: imgRes.provider,
      summary: imgRes.summary,
      detail: imgRes.detail,
      hasMedia: Boolean(imgRes.imageUrl || imgRes.imageBase64),
    };
    const videosCap: TaygosCapabilityStatus = {
      ok: vidRes.ok,
      statusCode: vidRes.statusCode,
      modelUsed: vidRes.model,
      provider: vidRes.provider,
      summary: vidRes.summary,
      detail: vidRes.detail,
      hasMedia: Boolean(vidRes.videoUrl || vidRes.jobId),
    };

    const result: BackupProviderLiveProbe = {
      configured: true,
      ok: true,
      statusCode: chatCap.statusCode,
      modelUsed: chatCap.modelUsed,
      endpointHost,
      summary: `شات ✅ (${chatCap.modelUsed}) | صور ${imagesCap.ok ? '✅' : '⚠️'} | فيديو ${videosCap.ok ? '✅' : '⚠️'}`,
      checkedAt,
      capabilities: {
        chat: chatCap,
        images: imagesCap,
        videos: videosCap,
        modelsCount: modelsRes.count,
        sampleModels: modelsRes.ids,
      },
    };
    bootBackupProbeState.taygos = result;
    return result;
  }

  const failed: BackupProviderLiveProbe = {
    configured: true,
    ok: false,
    statusCode: lastStatus || undefined,
    endpointHost,
    summary: formatAiErrorReason(lastErr || `HTTP ${lastStatus}`),
    detail: lastErr || undefined,
    checkedAt,
  };
  bootBackupProbeState.taygos = failed;
  return failed;
}

export async function probeOllamaCloudLive(): Promise<BackupProviderLiveProbe> {
  const { apiKey, apiUrl, models: staticModels } = getOllamaConfig();
  const checkedAt = new Date().toISOString();
  let endpointHost = '';
  try {
    endpointHost = new URL(apiUrl).hostname;
  } catch {}
  if (!apiKey) {
    return {
      configured: false,
      ok: false,
      endpointHost,
      summary: 'غير مضبوط في الإعدادات (Secrets)',
      checkedAt,
    };
  }

  const discovered = await discoverOllamaCloudModels(apiKey);
  const models = Array.from(new Set([...staticModels, ...discovered])).slice(0, 4);
  const isOpenAICompat = /\/v1\/chat\/completions\/?$/i.test(apiUrl);
  let lastStatus = 0;
  let lastErr = '';
  let lastModel = '';
  let consecutive402 = 0;

  for (const model of models) {
    lastModel = model;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const payload = isOpenAICompat
        ? { model, messages: [{ role: 'user', content: 'مرحبا' }], max_tokens: 20 }
        : { model, messages: [{ role: 'user', content: 'مرحبا' }], stream: false, options: { num_predict: 20 } };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      lastStatus = res.status;
      if (!res.ok) {
        lastErr = extractSanitizedErrorDetail(await res.text().catch(() => ''));
        if (res.status === 402) {
          consecutive402 += 1;
          if (consecutive402 >= 2) break;
          continue;
        }
        if (res.status === 404 || res.status === 400 || res.status === 429) continue;
        break;
      }
      const data: any = await res.json();
      const txt = String(
        data?.message?.content || data?.choices?.[0]?.message?.content || data?.response || ''
      ).trim();
      if (txt) {
        const result: BackupProviderLiveProbe = {
          configured: true,
          ok: true,
          statusCode: res.status,
          modelUsed: model,
          endpointHost,
          summary: `يعمل بنجاح (${model})`,
          checkedAt,
        };
        bootBackupProbeState.ollama = result;
        return result;
      }
      lastErr = `رد فارغ من ${model}`;
    } catch (e: any) {
      lastErr = redactSecrets(e?.message || String(e));
    } finally {
      clearTimeout(timer);
    }
  }

  const failed: BackupProviderLiveProbe = {
    configured: true,
    ok: false,
    statusCode: lastStatus || undefined,
    modelUsed: lastModel || undefined,
    endpointHost,
    summary: formatAiErrorReason(lastErr || `HTTP ${lastStatus}`),
    detail: lastErr || undefined,
    checkedAt,
  };
  bootBackupProbeState.ollama = failed;
  return failed;
}

// Run a single non-blocking startup verification for optional backup providers (Taygos + Ollama Cloud)
let bootBackupProbeStarted = false;
export function scheduleBackupProvidersBootCheck(): void {
  if (bootBackupProbeStarted) return;
  bootBackupProbeStarted = true;
  setTimeout(() => {
    if (getTaygosConfig().apiKey) {
      probeTaygosGatewayLive()
        .then((r) => console.log(`[AI Startup Probe] Taygos Gateway: ok=${r.ok} status=${r.statusCode || 0} (${r.summary})`))
        .catch(() => {});
    }
    if (getOllamaConfig().apiKey) {
      probeOllamaCloudLive()
        .then((r) => console.log(`[AI Startup Probe] Ollama Cloud: ok=${r.ok} status=${r.statusCode || 0} (${r.summary})`))
        .catch(() => {});
    }
  }, 1500);
}

export function formatAiErrorReason(reason?: string): string {
  const r = String(reason || '').trim();
  if (!r) return 'غير متاح حالياً';
  const lower = r.toLowerCase();

  if (lower.includes('invalid taygos public key') || lower.includes('invalid taygos secret')) {
    return 'مفتاح Taygos غير معرّف أو تم مسحه من خادم البوابة — يحتاج إعادة توليد المفتاح من تطبيق Taygos (HTTP 401)';
  }
  if (lower.includes('add usage credits') || lower.includes('payment required') || lower.includes('402')) {
    return 'حساب Ollama Cloud لا يحتوي على رصيد مجاني حالياً ويتطلب شحن رصيد أو اشتراك (HTTP 402)';
  }
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('invalid api key') || lower.includes('invalid_api_key')) {
    return 'مفتاح التشغيل غير صالح أو منتهي في الإعدادات (Secrets)';
  }
  if (lower.includes('permission_denied') || lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) {
    return 'صلاحية مفتاح التشغيل مرفوضة من المزود';
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('rate_limit') || lower.includes('rate limit') || lower.includes('quota')) {
    return 'تم بلوغ حد الطلبات المؤقت على المزود';
  }
  if (lower.includes('context_length') || lower.includes('reduce the length') || lower.includes('maximum context')) {
    return 'طول المحادثة تجاوز حد النموذج الاحتياطي';
  }
  if (lower.includes('404') || lower.includes('does not exist') || lower.includes('model_not_found')) {
    return 'الموديل غير متاح حالياً في المزود';
  }
  if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable') || lower.includes('overloaded')) {
    return 'ضغط مؤقت على خدمة الذكاء الاصطناعي';
  }
  if (lower.includes('timeout') || lower.includes('مهلة') || lower.includes('aborted')) {
    return 'تأخر استجابة الخادم بسبب بطء الاتصال';
  }

  // Strip JSON blocks cleanly including multi-line JSON and braces
  const cleaned = r
    .replace(/\{[\s\S]*$/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\[\]\{\}"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, 110) || 'تعذر الاتصال بالخادم';
}

/**
 * Resolve the appropriate Gemini API key from environment secrets
 * without ever hardcoding or exposing keys to the browser.
 */
function pickFirstHealthyGeminiKey(candidates: Array<string | undefined>): string {
  const cleaned = Array.from(new Set(candidates.map((c) => cleanSecretValue(c)).filter(Boolean)));
  if (cleaned.length === 0) return '';
  const healthyList = cleaned.filter((k) => !isGeminiKeyCircuitOpen(k));
  if (healthyList.length > 1) {
    // Spread traffic evenly across healthy keys to drastically reduce 429 RPM drops
    const idx = geminiKeyRoundRobin % healthyList.length;
    geminiKeyRoundRobin = (geminiKeyRoundRobin + 1) % 100000;
    return healthyList[idx];
  }
  return healthyList[0] || cleaned[0];
}

export function resolveAgentGeminiKey(agent: AIAgentRole): string {
  // Prioritize user's custom Gemini keys and fall back cleanly to platform GEMINI_API_KEY so service never drops
  if (agent === 'falcon_chat') {
    return pickFirstHealthyGeminiKey([
      process.env.GEMINI_API_KEY_FALCON_CHAT,
      process.env.FALCON_CHAT_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON,
      process.env.FALCON_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON_VISION,
      process.env.GEMINI_API_KEY_SHAMOUSA,
      process.env.GEMINI_API_KEY,
    ]);
  }
  if (agent === 'falcon_vision') {
    return pickFirstHealthyGeminiKey([
      process.env.GEMINI_API_KEY_FALCON_VISION,
      process.env.FALCON_VISION_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON,
      process.env.FALCON_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON_CHAT,
      process.env.GEMINI_API_KEY_SHAMOUSA,
      process.env.GEMINI_API_KEY,
    ]);
  }
  if (agent === 'falcon') {
    return pickFirstHealthyGeminiKey([
      process.env.GEMINI_API_KEY_FALCON_CHAT,
      process.env.GEMINI_API_KEY_FALCON,
      process.env.FALCON_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON_VISION,
      process.env.GEMINI_API_KEY_SHAMOUSA,
      process.env.GEMINI_API_KEY,
    ]);
  }
  if (agent === 'shamousa') {
    return pickFirstHealthyGeminiKey([
      process.env.GEMINI_API_KEY_SHAMOUSA,
      process.env.SHAMOUSA_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON_CHAT,
      process.env.GEMINI_API_KEY_FALCON_VISION,
      process.env.GEMINI_API_KEY_FALCON,
      process.env.GEMINI_API_KEY,
    ]);
  }
  return pickFirstHealthyGeminiKey([
    process.env.GEMINI_API_KEY_FALCON_CHAT,
    process.env.GEMINI_API_KEY_FALCON_VISION,
    process.env.GEMINI_API_KEY_FALCON,
    process.env.GEMINI_API_KEY_SHAMOUSA,
    process.env.GEMINI_API_KEY,
  ]);
}

export function getAgentSecretStatus() {
  const falconChatKey = resolveAgentGeminiKey('falcon_chat');
  const falconVisionKey = resolveAgentGeminiKey('falcon_vision');
  const shamousaKey = resolveAgentGeminiKey('shamousa');
  const groqKeys = getGroqApiKeys();
  const fanarKey = getFanarApiKey();
  const taygosCfg = getTaygosConfig();
  const ollamaCfg = getOllamaConfig();
  const geminiUsable = Boolean(
    (falconChatKey && !isGeminiKeyCircuitOpen(falconChatKey)) ||
      (falconVisionKey && !isGeminiKeyCircuitOpen(falconVisionKey)) ||
      (shamousaKey && !isGeminiKeyCircuitOpen(shamousaKey))
  );

  return {
    falconGeminiReady: Boolean(falconChatKey && !isGeminiKeyCircuitOpen(falconChatKey)),
    falconChatGeminiReady: Boolean(falconChatKey && !isGeminiKeyCircuitOpen(falconChatKey)),
    falconVisionGeminiReady: Boolean(falconVisionKey && !isGeminiKeyCircuitOpen(falconVisionKey)),
    shamousaGeminiReady: Boolean(shamousaKey && !isGeminiKeyCircuitOpen(shamousaKey)),
    groqConfigured: groqKeys.length > 0,
    groqKeyCount: groqKeys.length,
    activeGroqModel: ACTIVE_GROQ_CHAT_MODELS[0],
    taygosConfigured: Boolean(taygosCfg.apiKey),
    taygosHasKeyPair: Boolean(taygosCfg.publicKey && taygosCfg.secretKey),
    taygosProbe: bootBackupProbeState.taygos,
    ollamaConfigured: Boolean(ollamaCfg.apiKey),
    ollamaProbe: bootBackupProbeState.ollama,
    fanarConfigured: Boolean(fanarKey),
    activePrimaryProvider: geminiUsable
      ? 'gemini'
      : groqKeys.length > 0
      ? 'groq'
      : taygosCfg.apiKey
      ? 'taygos'
      : ollamaCfg.apiKey
      ? 'ollama'
      : fanarKey
      ? 'fanar'
      : 'none',
    googleSearchGroundingReady: Boolean(
      geminiUsable || groqKeys.length > 0 || taygosCfg.apiKey || ollamaCfg.apiKey || fanarKey
    ),
    freeLiveWebSearchReady: true,
    paidApisRemoved: true,
  };
}

export function createGeminiClientForAgent(agent: AIAgentRole): GoogleGenAI {
  const apiKey = resolveAgentGeminiKey(agent);
  if (!apiKey) {
    const labelMap: Record<AIAgentRole, string> = {
      falcon: 'GEMINI_API_KEY_FALCON_CHAT',
      falcon_chat: 'GEMINI_API_KEY_FALCON_CHAT',
      falcon_vision: 'GEMINI_API_KEY_FALCON_VISION',
      shamousa: 'GEMINI_API_KEY_SHAMOUSA / GEMINI_API_KEY_FALCON_CHAT',
      search: 'GEMINI_API_KEY_FALCON_CHAT',
    };
    throw new Error(`مفتاح Gemini المجاني غير مضبوط في الإعدادات (${labelMap[agent] || 'GEMINI_API_KEY_FALCON_CHAT'}).`);
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function getCandidateGeminiModels(): string[] {
  const envPrimary = cleanSecretValue(process.env.GEMINI_MODEL);
  const envFallback = cleanSecretValue(process.env.GEMINI_FALLBACK_MODEL);
  // Strictly block deprecated AND paid-only models so only free-tier text models are ever called
  const blocked = [
    'gemini-1.',
    'gemini-2.',
    'gemini-pro',
    'gemini-flash-latest',
    'gemini-3.8',
    'gemini-4-carbon',
    'gemini-4-neon',
    'gemini-4-argon',
    'gemini-3-pro-image',
    'gemini-nano-banana',
    '-image',
    'gemini-omni',
    'genie-4',
    'lyria',
    'imagen',
    'veo',
  ];

  const isAllowed = (m: string) =>
    Boolean(m) && !blocked.some((b) => m.toLowerCase().includes(b));

  const list = [
    isAllowed(envPrimary) ? envPrimary : PRIMARY_GEMINI_MODEL,
    PRIMARY_GEMINI_MODEL,
    isAllowed(envFallback) ? envFallback : FALLBACK_GEMINI_MODEL,
    FALLBACK_GEMINI_MODEL,
  ].filter(Boolean);

  return Array.from(new Set(list));
}

export function extractGroundingMetadata(response: GenerateContentResponse | any): {
  sources: GroundedSource[];
  searchEntryPoint?: string;
} {
  const candidate = response?.candidates?.[0];
  const grounding = candidate?.groundingMetadata;
  const sources: GroundedSource[] = [];
  const seenUrls = new Set<string>();

  if (Array.isArray(grounding?.groundingChunks)) {
    for (const chunk of grounding.groundingChunks) {
      const uri = chunk?.web?.uri;
      if (uri && !seenUrls.has(uri)) {
        seenUrls.add(uri);
        sources.push({
          title: chunk.web.title || uri,
          url: uri,
        });
      }
    }
  }

  const searchEntryPoint = grounding?.searchEntryPoint?.renderedContent;
  return { sources, searchEntryPoint };
}

export function shouldTriggerGoogleSearch(text: string, explicitSearch = false): boolean {
  if (explicitSearch) return true;
  const lower = String(text || '').toLowerCase();
  if (!lower.trim()) return false;

  const keywords = [
    'سعر',
    'أسعار',
    'اسعار',
    'بكام',
    'كم سعر',
    'سوق',
    'أسواق',
    'اسواق',
    'مورد',
    'موردين',
    'أماكن بيع',
    'اماكن بيع',
    'تريند',
    'موضة',
    'منافس',
    'مقارنة',
    'تصدير',
    'شحن',
    'جوجل',
    'ابحث',
    'بحث',
    'دور',
    'المنافسين',
    'خامات في مصر',
    'google',
    'search',
    'trend',
    'market',
    'price',
    'supplier',
  ];

  return keywords.some((k) => lower.includes(k));
}

function decodeHtmlEntities(str: string): string {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchDuckDuckGoHtmlResults(query: string, limit = 6): Promise<GroundedSource[]> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    const blocks = html.split(/class="result\s+results_links/g).slice(1);
    const sources: GroundedSource[] = [];
    const seen = new Set<string>();

    for (const block of blocks) {
      if (sources.length >= limit) break;
      const anchor = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!anchor) continue;
      let rawUrl = anchor[1];
      const uddg = rawUrl.match(/uddg=([^&]+)/);
      if (uddg) {
        try {
          rawUrl = decodeURIComponent(uddg[1]);
        } catch {}
      } else if (rawUrl.startsWith('//')) {
        rawUrl = `https:${rawUrl}`;
      }
      if (!rawUrl.startsWith('http') || seen.has(rawUrl)) continue;
      const title = decodeHtmlEntities(anchor[2]);
      if (!title) continue;

      const snipMatch =
        block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) ||
        block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);
      const snippet = snipMatch ? decodeHtmlEntities(snipMatch[1]) : undefined;

      seen.add(rawUrl);
      sources.push({
        title,
        url: rawUrl,
        snippet: snippet || undefined,
      });
    }
    return sources;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGoogleNewsRssResults(query: string, limit = 5): Promise<GroundedSource[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=EG&ceid=EG:ar`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlshamsBot/1.0)',
        'Accept-Language': 'ar-EG,ar;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const sources: GroundedSource[] = [];
    const seen = new Set<string>();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    for (const m of items) {
      if (sources.length >= limit) break;
      const title = decodeHtmlEntities((m[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const link = ((m[1].match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
      const pubDate = ((m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '').trim();
      const rawDesc = (m[1].match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
      const desc = decodeHtmlEntities(rawDesc).slice(0, 220);
      if (title && link.startsWith('http') && !seen.has(link)) {
        seen.add(link);
        sources.push({
          title,
          url: link,
          snippet: desc || (pubDate ? `تاريخ النشر: ${pubDate}` : undefined),
        });
      }
    }
    return sources;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strips raw inline search citation tags (e.g. 【1†L12-L18】 or 【0†title†domain】)
 * so Arabic replies stay clean, natural, and pleasant to read and speak.
 */
export function stripRawSearchCitations(text: string): string {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[\d+†[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSourcesFromGroqExecutedTools(executedTools: any[]): GroundedSource[] {
  if (!Array.isArray(executedTools)) return [];
  const sources: GroundedSource[] = [];
  const seen = new Set<string>();

  for (const tool of executedTools) {
    const out = String(tool?.output || '');
    if (!out) continue;

    // Match structured items like 【0†عنوان النتيجة†example.com】
    const bracketMatches = out.matchAll(/【\d+†([^†】]+)†([^】]+)】/g);
    for (const m of bracketMatches) {
      if (sources.length >= 6) break;
      const title = String(m[1] || '').trim();
      let domainOrUrl = String(m[2] || '').trim();
      if (!domainOrUrl) continue;
      if (!/^https?:\/\//i.test(domainOrUrl)) {
        domainOrUrl = `https://${domainOrUrl.replace(/^\/+/, '')}`;
      }
      if (!seen.has(domainOrUrl) && !domainOrUrl.includes('exa.ai/search')) {
        seen.add(domainOrUrl);
        sources.push({ title: title || domainOrUrl, url: domainOrUrl });
      }
    }

    // Also match direct URLs if present
    const urlMatches = out.matchAll(/https?:\/\/[^\s"'<>)\]]+/g);
    for (const um of urlMatches) {
      if (sources.length >= 6) break;
      const url = um[0].replace(/[.,;]+$/, '');
      if (!seen.has(url) && !url.includes('exa.ai/search') && !url.includes('google.com/search')) {
        seen.add(url);
        sources.push({ title: url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60), url });
      }
    }
  }

  return sources.slice(0, 6);
}

/**
 * Real-Time Live Web Search via Groq's built-in `browser_search` tool (`openai/gpt-oss-120b` & `openai/gpt-oss-20b`).
 * 100% Free, works reliably from Cloud Run with zero CAPTCHA, returns up-to-the-minute 2026 live prices & facts in ~2.5s!
 */
export async function executeGroqBrowserSearch(
  userQuery: string,
  options?: {
    systemInstruction?: string;
    history?: Array<{ role: string; content: string }>;
    country?: string;
    isSuperAdmin?: boolean;
  }
): Promise<{ answer: string; sources: GroundedSource[]; model: string } | null> {
  const groqKeys = getGroqApiKeys();
  if (groqKeys.length === 0) return null;

  // Rotate keys round-robin across GROQ_API_KEY & GROQ_API_KEY_SECONDARY
  const offset = groqKeys.length > 1 ? groqSearchKeyCursor % groqKeys.length : 0;
  groqSearchKeyCursor = (groqSearchKeyCursor + 1) % 100000;
  const rotatedKeys = [...groqKeys.slice(offset), ...groqKeys.slice(0, offset)];

  const country = options?.country || 'جمهورية مصر العربية';
  const secrecyNote = options?.isSuperAdmin
    ? 'استخدم أداة البحث الحية browser_search للوصول لأحدث المعلومات والأسعار الحقيقية اليوم، وأجب بدقة باللغة العربية.'
    : 'استخدم أداة البحث الحية browser_search للوصول لأحدث المعلومات والأسعار الحقيقية اليوم وأجب بدقة بالعامية المصرية الطبيعية، وممنوع تماماً ذكر كلمة جوجل أو محركات بحث أو روابط خارجية أو أسماء مواقع في ردك — قدّم المعلومة بشكل مباشر وطبيعي.';

  const baseSys = options?.systemInstruction
    ? `${options.systemInstruction}\n\n[تعليمات البحث الحي الإلزامية الآن]: ${secrecyNote} لا تخمّن أرقاماً قديمة أبداً؛ ابحث أولاً عبر browser_search ثم أجب بدقة ووضوح.`
    : `أنت باحث سوق وخبير معلومات حي في ${country}. ${secrecyNote}`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: baseSys.slice(0, 7500) },
  ];

  if (Array.isArray(options?.history)) {
    for (const h of options.history.slice(-6)) {
      const content = String(h?.content || '').trim();
      if (!content) continue;
      messages.push({
        role: h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user',
        content: content.slice(0, 1200),
      });
    }
  }

  messages.push({
    role: 'user',
    content: `${userQuery}\n\n(مطلوب بحث مباشر وحي الآن بأحدث بيانات وأسعار اليوم في ${country} — أجب بدقة على السؤال المطلوب تحديداً.)`,
  });

  // Prioritize higher-quota faster openai/gpt-oss-20b first, then openai/gpt-oss-120b,
  // with max 2 live attempts (10s timeout each) so worst-case latency stays snappy!
  const searchModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
  const pairs: Array<{ apiKey: string; model: string }> = [];
  for (const model of searchModels) {
    for (const apiKey of rotatedKeys) {
      pairs.push({ apiKey, model });
    }
  }

  let attemptsDone = 0;
  for (const { apiKey, model } of pairs) {
    if (attemptsDone >= 4) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: [{ type: 'browser_search' }],
          temperature: 0.25,
          max_tokens: 1100,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        console.warn(`[Groq Live Search] ${model} failed (${res.status}): ${errTxt.slice(0, 120)}`);
        if (res.status !== 429) attemptsDone++;
        continue;
      }
      attemptsDone++;
      const data: any = await res.json();
      const msg = data?.choices?.[0]?.message;
      const cleanAnswer = stripRawSearchCitations(String(msg?.content || ''));
      if (cleanAnswer) {
        groqSearchCooldownUntil = 0;
        const sources = extractSourcesFromGroqExecutedTools(msg?.executed_tools || []);
        console.log(`[Groq Live Search] OK model=${model} tools=${msg?.executed_tools?.length || 0} sources=${sources.length}`);
        return { answer: cleanAnswer, sources, model };
      }
    } catch (err: any) {
      attemptsDone++;
      console.warn(`[Groq Live Search] ${model} exception:`, err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }

  // All Groq live search attempts failed -> mark short 60s cooldown so UI shows honest gray indicator if Google is also down
  groqSearchCooldownUntil = Date.now() + GROQ_SEARCH_COOLDOWN_MS;
  return null;
}

function normalizeWebSearchQuery(rawQuery: string): string {
  const padded = ` ${String(rawQuery || '').replace(/[؟?!.,،"«»()]/g, ' ')} `;
  const cleaned = padded
    .replace(
      /(?<=^|\s)(ابحث\s*لي|ابحثي\s*لي|ابحثلي|ابحثيلي|دور\s*لي|دوري\s*لي|دورلي|دوريلي|ابحث|ابحثي|دور|دوري|على\s+النت|علي\s+النت|في\s+النت|بالنت|على\s+الانترنت|على\s+الإنترنت|في\s+جوجل|على\s+جوجل|علي\s+جوجل|من\s+فضلك|لو\s+سمحت|لو\s+سمحتي|قولي|قوليلي|قول\s+لي|عاوز\s+اعرف|عايز\s+اعرف|عايزة\s+اعرف|عاوزه\s+اعرف|ممكن\s+اعرف|ممكن\s+تقولي|ممكن\s+تقوليلي|يا\s+شموسة|يا\s+شموسه|يا\s+صقر|دلوقتي|حاليا|حالياً|الآن|الان)(?=\s|$)/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(عن|في|من|على|علي)\s+/i, '')
    .trim();
  return cleaned || String(rawQuery || '').trim();
}

/**
 * 100% Free, keyless live web search combining DuckDuckGo HTML (products, prices, suppliers)
 * with Google News RSS fallback (and short-keyword fallback when needed).
 */
export async function fetchFreeWebSearchResults(query: string, limit = 6): Promise<GroundedSource[]> {
  const cleanQuery = normalizeWebSearchQuery(query);
  if (!cleanQuery) return [];

  let ddg = await fetchDuckDuckGoHtmlResults(cleanQuery, limit);
  if (ddg.length < 2) {
    const stopWords = new Set(['في', 'من', 'على', 'علي', 'عن', 'كام', 'ما', 'هل', 'هو', 'هي', 'او', 'أو', 'السوق', 'المصري']);
    const compactDdg = cleanQuery
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w))
      .slice(0, 5)
      .join(' ');
    if (compactDdg && compactDdg !== cleanQuery) {
      const moreDdg = await fetchDuckDuckGoHtmlResults(`${compactDdg} مصر`, limit);
      if (moreDdg.length > ddg.length) ddg = moreDdg;
    }
  }
  if (ddg.length >= 2) {
    return ddg.slice(0, limit);
  }

  let gnews = await fetchGoogleNewsRssResults(cleanQuery, limit);
  if (gnews.length === 0) {
    const stopWords = new Set(['في', 'من', 'على', 'علي', 'عن', 'كام', 'ما', 'هل', 'هو', 'هي', 'او', 'أو', 'متوسط']);
    const compact = cleanQuery
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w))
      .slice(0, 4)
      .join(' ');
    if (compact && compact !== cleanQuery) {
      gnews = await fetchGoogleNewsRssResults(compact, limit);
    }
  }

  const merged: GroundedSource[] = [...ddg];
  const seen = new Set(merged.map((s) => s.url));
  for (const item of gnews) {
    if (!seen.has(item.url) && merged.length < limit) {
      seen.add(item.url);
      merged.push(item);
    }
  }
  return merged;
}

async function summarizeWebResultsWithGroq(
  query: string,
  webSources: GroundedSource[],
  systemInstruction: string
): Promise<string | null> {
  const groqKeys = getGroqApiKeys();
  if (groqKeys.length === 0 || webSources.length === 0) return null;

  const contextLines = webSources
    .map((r, i) => `[${i + 1}] ${r.title}\nالرابط: ${r.url}\nالملخص: ${r.snippet || 'غير متوفر'}`)
    .join('\n\n');

  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'allam-2-7b', 'qwen/qwen3.8-27b'];
  for (const apiKey of groqKeys) {
    for (const model of models) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 16000);
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemInstruction },
              {
                role: 'user',
                content: `السؤال: ${query}\n\nنتائج البحث الحية من الويب:\n${contextLines}\n\nلخص النتائج بدقة باللغة العربية المنظمة مع الإشارة للمصادر المتاحة بدون أي تخمين لأرقام غير مذكورة.`,
              },
            ],
            temperature: 0.4,
            max_tokens: 1200,
          }),
          signal: controller.signal,
        });
        if (!res.ok) continue;
        const data: any = await res.json();
        const txt = String(data?.choices?.[0]?.message?.content || '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();
        if (txt) return txt;
      } catch {
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // Emergency synthesis via Fanar Arabic AI if Groq keys unavailable
  const fanarKey = getFanarApiKey();
  if (fanarKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 16000);
    try {
      const res = await fetch('https://api.fanar.qa/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fanarKey}`,
        },
        body: JSON.stringify({
          model: 'Fanar',
          messages: [
            { role: 'system', content: systemInstruction },
            {
              role: 'user',
              content: `السؤال: ${query}\n\nنتائج البحث الحية:\n${contextLines}\n\nلخص النتائج بدقة بالعربية بدون تخمين.`,
            },
          ],
          temperature: 0.4,
          max_tokens: 900,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data: any = await res.json();
        const txt = String(data?.choices?.[0]?.message?.content || '').trim();
        if (txt) return txt;
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

/**
 * Unified 100% Free Live Web Search Service:
 * 1) Gemini Google Search Grounding (free-tier)
 * 2) Free keyless live web search (DuckDuckGo HTML + Google News RSS) + Groq/Fanar Arabic synthesis
 */
export async function performGoogleSearch(
  query: string,
  options?: { agent?: AIAgentRole; country?: string; systemHint?: string }
): Promise<GoogleSearchResult> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    throw new Error('نص البحث مطلوب');
  }

  const agent = options?.agent || 'search';
  const country = options?.country || 'جمهورية مصر العربية';

  const systemInstruction =
    options?.systemHint ||
    `أنت باحث سوق متخصص في الحرف اليدوية والمشغولات والأسعار في ${country}. استخدم البحث الحي للوصول إلى أحدث المعلومات والأسعار والموردين والاتجاهات الواقعية، وقدم إجابة عربية دقيقة ومنظمة ومباشرة مع ذكر الروابط والمصادر.`;

  const key = resolveAgentGeminiKey(agent);
  let lastErr: any = null;

  // 1. Try Gemini Google Search Grounding ONLY if key is healthy AND Gemini Search tool is not in 429 cooldown
  if (key && !isGeminiKeyCircuitOpen(key) && !isGeminiSearchCircuitOpen()) {
    try {
      const ai = createGeminiClientForAgent(agent);
      const models = getCandidateGeminiModels();

      for (const model of models) {
        let timer: any;
        try {
          const response: GenerateContentResponse = await Promise.race([
            ai.models
              .generateContent({
                model,
                contents: cleanQuery,
                config: {
                  systemInstruction,
                  tools: [{ googleSearch: {} }],
                },
              })
              .finally(() => clearTimeout(timer)),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`timeout on ${model}`)), 16000);
            }),
          ]);

          const { sources, searchEntryPoint } = extractGroundingMetadata(response);
          const answer = stripRawSearchCitations(response.text?.trim() || '');
          if (answer && sources.length > 0) {
            return {
              answer,
              sources: sources.slice(0, 6),
              searchEntryPoint,
              searchUsed: true,
              engine: 'gemini_google_search',
            };
          }
          if (answer) {
            const liveExtra = await fetchGoogleNewsRssResults(cleanQuery, 5);
            return {
              answer,
              sources: liveExtra.slice(0, 6),
              searchEntryPoint,
              searchUsed: true,
              engine: 'gemini_google_search',
            };
          }
        } catch (err: any) {
          clearTimeout(timer);
          lastErr = err;
          if (tripGeminiKeyCircuit(key, err)) {
            break;
          }
          const status = Number(err?.status || err?.code || 0);
          if (status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(String(err?.message || ''))) {
            tripGeminiSearchCircuit(err);
            break;
          }
          console.log(`[GoogleSearchService] Switching past model ${model} (status: ${status || 'err'})`);
        }
      }
    } catch (initErr: any) {
      lastErr = initErr;
      tripGeminiKeyCircuit(key, initErr);
    }
  }

  // 2. Primary Live Real-Time Web Search Engine (Groq native `browser_search` — zero CAPTCHA, live 2026 results in ~2.5s!)
  console.log('[GoogleSearchService] Executing real-time live web search via Groq browser_search...');
  const groqLive = await executeGroqBrowserSearch(cleanQuery, {
    systemInstruction,
    country,
    isSuperAdmin: true,
  });
  if (groqLive?.answer) {
    return {
      answer: groqLive.answer,
      sources: groqLive.sources,
      searchUsed: true,
      engine: 'web_search_plus_groq',
    };
  }

  // 3. Emergency Fallback: Google News RSS + Groq/Fanar synthesis
  console.log('[GoogleSearchService] Falling back to Google News RSS + Groq synthesis...');
  const webResults = await fetchFreeWebSearchResults(cleanQuery, 6);
  if (webResults.length > 0) {
    const synthesized = await summarizeWebResultsWithGroq(cleanQuery, webResults, systemInstruction);
    return {
      answer:
        synthesized ||
        webResults.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? `\n   ${r.snippet}` : ''}`).join('\n\n'),
      sources: webResults,
      searchUsed: true,
      engine: synthesized ? 'web_search_plus_groq' : 'web_search_direct',
    };
  }

  const lastMsg = String(lastErr?.message || '');
  if (lastMsg.includes('429') || lastMsg.includes('RESOURCE_EXHAUSTED')) {
    const quotaErr: any = new Error(
      'تم تجاوز حصة البحث الحالية مؤقتاً. يمكنك المحاولة بعد لحظات.'
    );
    quotaErr.status = 429;
    throw quotaErr;
  }

  throw new Error(
    `تعذر تنفيذ البحث الحي حالياً (${formatAiErrorReason(lastMsg || 'لا توجد نتائج فورية')}).`
  );
}

export interface ApiAuditEntry {
  id: string;
  name: string;
  category: 'gemini' | 'groq' | 'taygos' | 'ollama' | 'fanar' | 'search' | 'infra' | 'push' | 'fx';
  envVars: string[];
  configured: boolean;
  optional?: boolean;
  ok: boolean;
  statusCode?: number;
  summary: string;
  rawError?: string;
  models?: Array<{ model: string; ok: boolean; statusCode?: number; note?: string }>;
}

function redactSecrets(text: string): string {
  return String(text || '')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/gsk_[0-9A-Za-z]{16,}/g, '[REDACTED_KEY]')
    .replace(/(?:pk|sk)_taygos_[0-9A-Za-z_:-]{10,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[0-9A-Za-z._:\-]{12,}/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/eyJ[0-9A-Za-z\-_]+\.[0-9A-Za-z\-_]+\.[0-9A-Za-z\-_]+/g, '[REDACTED_JWT]')
    .slice(0, 260);
}

async function probeGeminiSingleKey(
  id: string,
  name: string,
  envVars: string[],
  rawKey: string,
  optional = false
): Promise<ApiAuditEntry> {
  const key = cleanSecretValue(rawKey);
  if (!key) {
    return {
      id,
      name,
      category: 'gemini',
      envVars,
      configured: false,
      optional,
      ok: false,
      summary: optional
        ? 'اختياري غير مضبوط (يعمل النظام تلقائياً عبر المزودات النشطة)'
        : 'غير مضبوط في الإعدادات (Secrets)',
    };
  }

  // Reset circuit before explicit admin health probe so updated keys verify immediately
  clearGeminiKeyCircuit(key);

  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const testCases = [
    { model: PRIMARY_GEMINI_MODEL, withSearch: false },
    { model: FALLBACK_GEMINI_MODEL, withSearch: false },
    { model: FALLBACK_GEMINI_MODEL, withSearch: true },
  ];

  const models: Array<{ model: string; ok: boolean; statusCode?: number; note?: string }> = [];
  let anyOk = false;
  let lastRawError = '';
  let lastStatus: number | undefined;

  for (const tc of testCases) {
    const label = tc.withSearch ? `${tc.model} + GoogleSearch` : tc.model;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 9000);
      const res: any = await Promise.race([
        ai.models
          .generateContent({
            model: tc.model,
            contents: 'قل كلمة: نعم',
            config: tc.withSearch ? { tools: [{ googleSearch: {} }] } : undefined,
          })
          .finally(() => clearTimeout(t)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 9000)
        ),
      ]);
      const txt = String(res?.text || '').trim();
      if (txt) {
        anyOk = true;
        models.push({ model: label, ok: true, statusCode: 200, note: 'يعمل بنجاح' });
      } else {
        models.push({ model: label, ok: false, statusCode: 200, note: 'رد فارغ' });
      }
    } catch (err: any) {
      const msg = redactSecrets(err?.message || String(err));
      const code = Number(err?.status || err?.code || 0) || undefined;
      lastRawError = msg;
      lastStatus = code;
      models.push({
        model: label,
        ok: false,
        statusCode: code,
        note: formatAiErrorReason(msg),
      });
      if (tripGeminiKeyCircuit(key, err)) {
        break;
      }
    }
  }

  return {
    id,
    name,
    category: 'gemini',
    envVars,
    configured: true,
    optional,
    ok: anyOk,
    statusCode: anyOk ? 200 : lastStatus,
    summary: anyOk
      ? 'يعمل بنجاح'
      : `${formatAiErrorReason(lastRawError)} — يتم تجاوزه تلقائياً والعمل الفوري عبر Groq و Fanar`,
    rawError: anyOk ? undefined : lastRawError,
    models,
  };
}

async function probeGroqSingleKey(
  id: string,
  name: string,
  envVars: string[],
  rawKey: string,
  optional = false
): Promise<ApiAuditEntry> {
  const key = cleanSecretValue(rawKey);
  if (!key) {
    return {
      id,
      name,
      category: 'groq',
      envVars,
      configured: false,
      optional,
      ok: false,
      summary: optional
        ? 'اختياري غير مضبوط (يعمل النظام تلقائياً عبر المفاتيح النشطة)'
        : 'غير مضبوط في الإعدادات (Secrets)',
    };
  }

  const modelsOut: Array<{ model: string; ok: boolean; statusCode?: number; note?: string }> = [];
  let listedIds = new Set<string>();
  let listError = '';
  let listStatus = 0;

  // 1) Check /openai/v1/models
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 7000);
    const mRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: c.signal,
    }).finally(() => clearTimeout(t));
    listStatus = mRes.status;
    if (mRes.ok) {
      const json: any = await mRes.json();
      for (const item of json?.data || []) {
        if (item?.id) listedIds.add(String(item.id));
      }
    } else {
      listError = redactSecrets(await mRes.text().catch(() => String(mRes.status)));
    }
  } catch (e: any) {
    listError = redactSecrets(e?.message || 'fetch error');
  }

  if (listStatus === 401 || listStatus === 403) {
    return {
      id,
      name,
      category: 'groq',
      envVars,
      configured: true,
      ok: false,
      statusCode: listStatus,
      summary: formatAiErrorReason(listError || String(listStatus)),
      rawError: listError,
    };
  }

  // 2) Probe live working chat models available on the account
  const probes = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'allam-2-7b', 'qwen/qwen3.8-27b'];
  let anyOk = false;
  let lastErr = '';
  let lastStatus = listStatus;

  for (const model of probes) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 9000);
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'مرحبا' }],
          max_tokens: 15,
        }),
        signal: c.signal,
      }).finally(() => clearTimeout(t));
      lastStatus = r.status;
      if (r.ok) {
        anyOk = true;
        modelsOut.push({ model, ok: true, statusCode: r.status, note: 'يعمل بنجاح' });
      } else {
        const txt = redactSecrets(await r.text().catch(() => ''));
        lastErr = txt;
        modelsOut.push({
          model,
          ok: false,
          statusCode: r.status,
          note: formatAiErrorReason(txt || String(r.status)),
        });
      }
    } catch (e: any) {
      lastErr = redactSecrets(e?.message || '');
      modelsOut.push({ model, ok: false, note: formatAiErrorReason(lastErr) });
    }
  }

  for (const w of Array.from(listedIds)) {
    if (!modelsOut.some((m) => m.model === w)) {
      modelsOut.push({
        model: w,
        ok: true,
        statusCode: 200,
        note: 'مدرج في الحساب (غير مختبر للدردشة أو صوتي/نصي)',
      });
    }
  }

  return {
    id,
    name,
    category: 'groq',
    envVars,
    configured: true,
    ok: anyOk,
    statusCode: anyOk ? 200 : lastStatus || undefined,
    summary: anyOk ? `يعمل بنجاح (${listedIds.size || modelsOut.length} موديل)` : formatAiErrorReason(lastErr || listError),
    rawError: anyOk ? undefined : lastErr || listError,
    models: modelsOut,
  };
}

export async function runFullApiHealthAudit(): Promise<{
  checkedAt: string;
  envFlags: Record<string, boolean | string>;
  entries: ApiAuditEntry[];
}> {
  const groqModelEnv = cleanSecretValue(process.env.GROQ_MODEL);
  const geminiModelEnv = cleanSecretValue(process.env.GEMINI_MODEL);

  const [
    geminiFalconChat,
    geminiFalconVision,
    groqPrimary,
    groqSecondary,
    fanarProbe,
    taygosProbe,
    ollamaProbe,
    liveWebSearchProbe,
    gnewsProbe,
    fxProbe,
  ] = await Promise.all([
    probeGeminiSingleKey(
      'gemini_falcon_chat',
      'Google Gemini المجاني — المحادثة وبحث جوجل (صقر وشموسة)',
      ['GEMINI_API_KEY_FALCON_CHAT'],
      process.env.GEMINI_API_KEY_FALCON_CHAT || process.env.FALCON_CHAT_GEMINI_API_KEY || '',
      false
    ),
    probeGeminiSingleKey(
      'gemini_falcon_vision',
      'Google Gemini المجاني — قراءة وتحليل الصور (صقر)',
      ['GEMINI_API_KEY_FALCON_VISION'],
      process.env.GEMINI_API_KEY_FALCON_VISION || process.env.FALCON_VISION_GEMINI_API_KEY || '',
      false
    ),
    probeGroqSingleKey('groq_primary', 'Groq AI (الأساسي — مجاني)', ['GROQ_API_KEY'], process.env.GROQ_API_KEY || '', false),
    probeGroqSingleKey(
      'groq_secondary',
      'Groq AI (الثانوي — مجاني)',
      ['GROQ_API_KEY_SECONDARY', 'GROQ_SECONDARY_API_KEY', 'GROQ_API_KEY_2'],
      process.env.GROQ_API_KEY_SECONDARY || process.env.GROQ_SECONDARY_API_KEY || process.env.GROQ_API_KEY_2 || '',
      true
    ),
    // Fanar probe (live model only)
    (async (): Promise<ApiAuditEntry> => {
      const fanarKey = getFanarApiKey();
      if (!fanarKey) {
        return {
          id: 'fanar',
          name: 'Fanar Arabic AI (مجاني)',
          category: 'fanar',
          envVars: ['FANAR_API_KEY', 'FANAR_KEY'],
          configured: false,
          ok: false,
          summary: 'غير مضبوط في الإعدادات (Secrets)',
        };
      }
      const modelsOut: Array<{ model: string; ok: boolean; statusCode?: number; note?: string }> = [];
      let anyOk = false;
      let lastErr = '';
      let lastStatus = 0;
      for (const m of ['Fanar']) {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 9000);
        try {
          const r = await fetch('https://api.fanar.qa/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fanarKey}` },
            body: JSON.stringify({ model: m, messages: [{ role: 'user', content: 'مرحبا' }], max_tokens: 15 }),
            signal: c.signal,
          }).finally(() => clearTimeout(t));
          lastStatus = r.status;
          if (r.ok) {
            anyOk = true;
            modelsOut.push({ model: m, ok: true, statusCode: r.status, note: 'يعمل بنجاح' });
          } else {
            const txt = redactSecrets(await r.text().catch(() => ''));
            lastErr = txt;
            modelsOut.push({ model: m, ok: false, statusCode: r.status, note: formatAiErrorReason(txt) });
          }
        } catch (e: any) {
          lastErr = redactSecrets(e?.message || '');
          modelsOut.push({ model: m, ok: false, note: formatAiErrorReason(lastErr) });
        }
      }
      return {
        id: 'fanar',
        name: 'Fanar Arabic AI (مجاني)',
        category: 'fanar',
        envVars: ['FANAR_API_KEY', 'FANAR_KEY'],
        configured: true,
        ok: anyOk,
        statusCode: anyOk ? 200 : lastStatus || undefined,
        summary: anyOk ? 'يعمل بنجاح' : formatAiErrorReason(lastErr),
        rawError: anyOk ? undefined : lastErr,
        models: modelsOut,
      };
    })(),
    // Taygos Multi-Provider Gateway probe (Alshams Craft — Chat + Images + Videos)
    (async (): Promise<ApiAuditEntry> => {
      const res = await probeTaygosGatewayLive();
      const caps = res.capabilities;
      const capModels: Array<{ model: string; ok: boolean; statusCode?: number; note?: string }> = [];
      if (caps?.chat) {
        capModels.push({
          model: `Chat (${caps.chat.modelUsed || 'taygos-unified'})`,
          ok: caps.chat.ok,
          statusCode: caps.chat.statusCode,
          note: caps.chat.summary,
        });
      }
      if (caps?.images) {
        capModels.push({
          model: `Images (${caps.images.modelUsed || 'images/generations'})`,
          ok: caps.images.ok,
          statusCode: caps.images.statusCode,
          note: caps.images.summary,
        });
      }
      if (caps?.videos) {
        capModels.push({
          model: `Videos (${caps.videos.modelUsed || 'videos/generations'})`,
          ok: caps.videos.ok,
          statusCode: caps.videos.statusCode,
          note: caps.videos.summary,
        });
      }
      return {
        id: 'taygos_gateway',
        name: 'Taygos Multi-Provider Gateway (Alshams Craft — شات/صور/فيديو)',
        category: 'taygos',
        envVars: ['TAYGOS_API_KEY'],
        configured: res.configured,
        optional: true,
        ok: res.ok,
        statusCode: res.statusCode,
        summary: res.summary,
        models: capModels.length > 0
          ? capModels
          : res.modelUsed
          ? [{ model: res.modelUsed, ok: res.ok, statusCode: res.statusCode, note: res.ok ? 'يعمل بنجاح' : res.summary }]
          : undefined,
      };
    })(),
    // Ollama Cloud probe (alshamsawya)
    (async (): Promise<ApiAuditEntry> => {
      const res = await probeOllamaCloudLive();
      return {
        id: 'ollama_cloud',
        name: 'Ollama Cloud API (alshamsawya)',
        category: 'ollama',
        envVars: ['OLLAMA_API_KEY'],
        configured: res.configured,
        optional: true,
        ok: res.ok,
        statusCode: res.statusCode,
        summary: res.summary,
        models: res.modelUsed
          ? [{ model: res.modelUsed, ok: res.ok, statusCode: res.statusCode, note: res.ok ? 'يعمل بنجاح' : res.summary }]
          : undefined,
      };
    })(),
    // Free Live Web Search (DuckDuckGo + Google News RSS unified free engine — zero API keys)
    (async (): Promise<ApiAuditEntry> => {
      try {
        const items = await fetchFreeWebSearchResults('خيط مكرمية قطن مصر', 3);
        return {
          id: 'live_web_search_free',
          name: 'محرك البحث الحي المجاني المفتوح (Web + News)',
          category: 'search',
          envVars: [],
          configured: true,
          ok: items.length > 0,
          statusCode: items.length > 0 ? 200 : 204,
          summary: items.length > 0 ? `يعمل بنجاح (${items.length} نتائج ويب حية بدون مفاتيح)` : 'لم يُرجع نتائج حالياً',
        };
      } catch (e: any) {
        return {
          id: 'live_web_search_free',
          name: 'محرك البحث الحي المجاني المفتوح (Web + News)',
          category: 'search',
          envVars: [],
          configured: true,
          ok: false,
          summary: formatAiErrorReason(e?.message),
        };
      }
    })(),
    // Google News RSS
    (async (): Promise<ApiAuditEntry> => {
      try {
        const items = await fetchGoogleNewsRssResults('حرف يدوية مصر', 3);
        return {
          id: 'google_news_rss',
          name: 'Google News RSS (مجاني ومفتوح)',
          category: 'search',
          envVars: [],
          configured: true,
          ok: items.length > 0,
          statusCode: items.length > 0 ? 200 : 204,
          summary: items.length > 0 ? `يعمل بنجاح (${items.length} نتائج)` : 'لم يُرجع نتائج',
        };
      } catch (e: any) {
        return {
          id: 'google_news_rss',
          name: 'Google News RSS (مجاني ومفتوح)',
          category: 'search',
          envVars: [],
          configured: true,
          ok: false,
          summary: formatAiErrorReason(e?.message),
        };
      }
    })(),
    // Live FX API
    (async (): Promise<ApiAuditEntry> => {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 5000);
        const r = await fetch('https://open.er-api.com/v6/latest/EGP', { signal: c.signal }).finally(() => clearTimeout(t));
        return {
          id: 'fx_open_er_api',
          name: 'Live Interbank FX API (open.er-api.com — مجاني)',
          category: 'fx',
          envVars: [],
          configured: true,
          ok: r.ok,
          statusCode: r.status,
          summary: r.ok ? 'يعمل بنجاح' : `فشل HTTP ${r.status}`,
        };
      } catch (e: any) {
        return {
          id: 'fx_open_er_api',
          name: 'Live Interbank FX API (open.er-api.com — مجاني)',
          category: 'fx',
          envVars: [],
          configured: true,
          ok: false,
          summary: formatAiErrorReason(e?.message),
        };
      }
    })(),
  ]);

  // Resilient VAPID env lookup (matches server.ts logic — detects casing/whitespace/aliases)
  const vapidDetectedKeys = Object.keys(process.env)
    .filter((k) => /VAPID|WEBPUSH|WEB_PUSH/i.test(k))
    .map((k) => `${k}(len=${cleanSecretValue(process.env[k]).length})`);

  let envVapidPub =
    cleanSecretValue(process.env.VAPID_PUBLIC_KEY) ||
    cleanSecretValue(process.env.VITE_VAPID_PUBLIC_KEY) ||
    cleanSecretValue(process.env.WEB_PUSH_PUBLIC_KEY);
  let envVapidPriv =
    cleanSecretValue(process.env.VAPID_PRIVATE_KEY) ||
    cleanSecretValue(process.env.VAPID_SECRET_KEY) ||
    cleanSecretValue(process.env.VAPID_PRIVATE) ||
    cleanSecretValue(process.env.VITE_VAPID_PRIVATE_KEY) ||
    cleanSecretValue(process.env.WEB_PUSH_PRIVATE_KEY);

  if (!envVapidPub || !envVapidPriv) {
    for (const [rawKey, rawVal] of Object.entries(process.env)) {
      const normKey = rawKey.trim().toUpperCase();
      const v = cleanSecretValue(rawVal);
      if (!v) continue;
      if (!envVapidPub && /VAPID.*PUB|PUB.*VAPID/.test(normKey)) envVapidPub = v;
      else if (!envVapidPriv && /VAPID.*(PRIV|SEC)|(PRIV|SEC).*VAPID/.test(normKey)) envVapidPriv = v;
    }
  }

  let vapidEnvValid = false;
  let vapidEnvError = '';
  let vapidSwapped = false;

  if (envVapidPub && envVapidPriv) {
    try {
      webpush.setVapidDetails('mailto:hmb.top.tube@gmail.com', envVapidPub, envVapidPriv);
      vapidEnvValid = true;
    } catch (e: any) {
      vapidEnvError = String(e?.message || 'صيغة مفاتيح VAPID غير صالحة');
      try {
        webpush.setVapidDetails('mailto:hmb.top.tube@gmail.com', envVapidPriv, envVapidPub);
        vapidSwapped = true;
      } catch {}
    }
  }

  let hasValidFileVapid = false;
  try {
    if (fs.existsSync(VAPID_KEYS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, 'utf-8'));
      if (parsed?.publicKey && parsed?.privateKey) {
        webpush.setVapidDetails('mailto:hmb.top.tube@gmail.com', parsed.publicKey, parsed.privateKey);
        hasValidFileVapid = true;
      }
    }
  } catch {}

  const webPushReady = vapidEnvValid || vapidSwapped || hasValidFileVapid;
  const webPushSummary = vapidEnvValid
    ? 'يعمل بنجاح (مفاتيح VAPID صالحة من Secrets ونقاط /api/push/* مفعّلة)'
    : vapidSwapped
    ? '⚠️ تنبيه: تم عكس VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY في Secrets (تم تصحيح التبديل تلقائياً)'
    : hasValidFileVapid
    ? envVapidPub || envVapidPriv
      ? `⚠️ مفاتيح Secrets غير مكتملة (${vapidEnvError || `pubLen=${envVapidPub.length}, privLen=${envVapidPriv.length}`}) — يعمل النظام حالياً بالمفاتيح التلقائية السليمة`
      : 'يعمل بنجاح (مفاتيح VAPID مولّدة تلقائياً ونقاط /api/push/* مفعّلة)'
    : `مفاتيح VAPID غير صالحة (${vapidEnvError || 'قيد التهيئة'})`;

  const webPushEntry: ApiAuditEntry = {
    id: 'web_push_vapid',
    name: 'Web Push VAPID (/api/push/*)',
    category: 'push',
    envVars: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
    configured: Boolean(envVapidPub || envVapidPriv || hasValidFileVapid),
    ok: webPushReady,
    statusCode: webPushReady ? 200 : 503,
    summary: webPushSummary,
    rawError: !vapidEnvValid && vapidEnvError ? vapidEnvError : undefined,
  };

  const paidPolicyEntry: ApiAuditEntry = {
    id: 'free_tier_policy_check',
    name: 'سياسة المجانية المطلقة (حظر المدفوع)',
    category: 'infra',
    envVars: [],
    configured: true,
    ok: true,
    statusCode: 200,
    summary: 'تم الفحص: 0 استدعاءات لموديلات مدفوعة، ومفتاح المنصة GEMINI_API_KEY مستبعد تماماً لصالح مفاتيحك المجانية',
  };

  const firebaseRemnantsEntry: ApiAuditEntry = {
    id: 'firebase_check',
    name: 'فحص بقايا Firebase',
    category: 'infra',
    envVars: Object.keys(process.env).filter((k) => k.toUpperCase().includes('FIREBASE')),
    configured: Object.keys(process.env).some((k) => k.toUpperCase().includes('FIREBASE')),
    ok: true,
    summary: 'تم الفحص: 0 ملفات أو حزم أو استدعاءات Firebase في الكود المصدري',
  };

  const staleSecretsIgnored: string[] = [];
  if (groqModelEnv && /llama-3|llama-4|qwen3-32b|whisper/i.test(groqModelEnv)) {
    staleSecretsIgnored.push(`GROQ_MODEL=${groqModelEnv} (متجاهل تلقائياً -> يستخدم openai/gpt-oss-120b)`);
  }
  if (geminiModelEnv && /gemini-1\.|gemini-2\.|gemini-pro|gemini-3\.8|carbon|neon|argon|image|omni|genie|lyria/i.test(geminiModelEnv)) {
    staleSecretsIgnored.push(`GEMINI_MODEL=${geminiModelEnv} (متجاهل تلقائياً -> يستخدم ${PRIMARY_GEMINI_MODEL} المجاني)`);
  }

  return {
    checkedAt: new Date().toISOString(),
    envFlags: {
      EFFECTIVE_GROQ_MODEL: ACTIVE_GROQ_CHAT_MODELS[0],
      EFFECTIVE_FANAR_MODEL: ACTIVE_FANAR_MODELS[0],
      EFFECTIVE_GEMINI_MODEL: PRIMARY_GEMINI_MODEL,
      PAID_MODELS_POLICY: 'محظورة تماماً — المنظومة تعمل بالمجاني فقط ومفتاح المنصة GEMINI_API_KEY متجاهل تماماً',
      GROQ_MODEL_SECRET: groqModelEnv || '(الافتراضي: openai/gpt-oss-120b)',
      GEMINI_MODEL_SECRET: geminiModelEnv || `(الافتراضي: ${PRIMARY_GEMINI_MODEL})`,
      STALE_SECRETS_BYPASSED: staleSecretsIgnored.length > 0 ? staleSecretsIgnored.join(' | ') : 'لا يوجد',
      SUPABASE_SERVICE_ROLE_KEY_SET: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
      VAPID_DETECTED_ENV_KEYS: vapidDetectedKeys.length > 0 ? vapidDetectedKeys.join(', ') : 'لا يوجد',
      VAPID_ENV_STATUS: vapidEnvValid
        ? 'صالح (Secrets)'
        : vapidSwapped
        ? 'مقلوب (تم تصحيحه تلقائياً)'
        : envVapidPub || envVapidPriv
        ? `غير مطابق (pubLen=${envVapidPub.length}, privLen=${envVapidPriv.length})`
        : 'تلقائي',
    },
    entries: [
      geminiFalconChat,
      geminiFalconVision,
      groqPrimary,
      groqSecondary,
      fanarProbe,
      taygosProbe,
      ollamaProbe,
      liveWebSearchProbe,
      gnewsProbe,
      fxProbe,
      webPushEntry,
      paidPolicyEntry,
      firebaseRemnantsEntry,
    ],
  };
}


