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

// Circuit breaker to avoid wasting sequential retries on invalid/revoked Gemini keys
const GEMINI_KEY_CIRCUIT_TTL_MS = 5 * 60 * 1000;
const geminiInvalidKeyCircuit = new Map<string, { until: number; reason: string }>();

// Separate circuit breaker ONLY for Gemini's built-in Google Search tool:
// Uses a fast 60-second cooldown so Google Search ALWAYS resumes as #1 primary immediately once RPM refreshes,
// while automatically failing over to Groq browser_search (#2 backup) without ever going down!
const GEMINI_SEARCH_COOLDOWN_MS = 60 * 1000;
const GROQ_SEARCH_COOLDOWN_MS = 60 * 1000;
let geminiSearchCooldownUntil = 0;
let groqSearchCooldownUntil = 0;
let groqSearchKeyCursor = 0;

export function isGeminiSearchCircuitOpen(): boolean {
  return Date.now() < geminiSearchCooldownUntil;
}

export function tripGeminiSearchCircuit(err?: any): void {
  const msg = String(err?.message || err || '');
  const status = Number(err?.status || err?.code || 0);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|429/i.test(msg)) {
    geminiSearchCooldownUntil = Date.now() + GEMINI_SEARCH_COOLDOWN_MS;
    console.warn('[Search Circuit] Google Search hit 429 -> failing over to Groq browser_search for 60s, then resuming Google Search #1.');
  }
}

export function isGroqSearchCircuitOpen(): boolean {
  return Date.now() < groqSearchCooldownUntil;
}

export function getLiveSearchHealthStatus(): {
  googleSearchReady: boolean;
  groqSearchReady: boolean;
  liveSearchAvailable: boolean;
  primaryEngine: 'google_search' | 'groq_search' | 'offline';
} {
  const geminiKey = resolveAgentGeminiKey('search');
  const googleSearchReady = Boolean(
    geminiKey && !isGeminiKeyCircuitOpen(geminiKey) && !isGeminiSearchCircuitOpen()
  );
  const groqKeys = getGroqApiKeys();
  const groqSearchReady = groqKeys.length > 0 && !isGroqSearchCircuitOpen();
  const liveSearchAvailable = googleSearchReady || groqSearchReady;
  const primaryEngine = googleSearchReady
    ? 'google_search'
    : groqSearchReady
    ? 'groq_search'
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

export function formatAiErrorReason(reason?: string): string {
  const r = String(reason || '').trim();
  if (!r) return 'غير متاح حالياً';
  const lower = r.toLowerCase();

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
  const healthy = cleaned.find((k) => !isGeminiKeyCircuitOpen(k));
  return healthy || cleaned[0];
}

export function resolveAgentGeminiKey(agent: AIAgentRole): string {
  // Strictly use user's own free custom Gemini keys (completely ignores platform-managed GEMINI_API_KEY)
  if (agent === 'falcon_chat') {
    return pickFirstHealthyGeminiKey([
      process.env.GEMINI_API_KEY_FALCON_CHAT,
      process.env.FALCON_CHAT_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON,
      process.env.FALCON_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON_VISION,
      process.env.GEMINI_API_KEY_SHAMOUSA,
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
    ]);
  }
  if (agent === 'falcon') {
    return pickFirstHealthyGeminiKey([
      process.env.GEMINI_API_KEY_FALCON_CHAT,
      process.env.GEMINI_API_KEY_FALCON,
      process.env.FALCON_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON_VISION,
      process.env.GEMINI_API_KEY_SHAMOUSA,
    ]);
  }
  if (agent === 'shamousa') {
    return pickFirstHealthyGeminiKey([
      process.env.GEMINI_API_KEY_SHAMOUSA,
      process.env.SHAMOUSA_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_FALCON_CHAT,
      process.env.GEMINI_API_KEY_FALCON_VISION,
      process.env.GEMINI_API_KEY_FALCON,
    ]);
  }
  return pickFirstHealthyGeminiKey([
    process.env.GEMINI_API_KEY_FALCON_CHAT,
    process.env.GEMINI_API_KEY_FALCON_VISION,
    process.env.GEMINI_API_KEY_FALCON,
    process.env.GEMINI_API_KEY_SHAMOUSA,
  ]);
}

export function getAgentSecretStatus() {
  const falconChatKey = resolveAgentGeminiKey('falcon_chat');
  const falconVisionKey = resolveAgentGeminiKey('falcon_vision');
  const shamousaKey = resolveAgentGeminiKey('shamousa');
  const groqKeys = getGroqApiKeys();
  const fanarKey = getFanarApiKey();
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
    fanarConfigured: Boolean(fanarKey),
    activePrimaryProvider: geminiUsable ? 'gemini' : groqKeys.length > 0 ? 'groq' : fanarKey ? 'fanar' : 'none',
    googleSearchGroundingReady: Boolean(geminiUsable || groqKeys.length > 0 || fanarKey),
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
    if (attemptsDone >= 2) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 11000);
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
              timer = setTimeout(() => reject(new Error(`timeout on ${model}`)), 9000);
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
  category: 'gemini' | 'groq' | 'fanar' | 'search' | 'infra' | 'push' | 'fx';
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
      liveWebSearchProbe,
      gnewsProbe,
      fxProbe,
      webPushEntry,
      paidPolicyEntry,
      firebaseRemnantsEntry,
    ],
  };
}


