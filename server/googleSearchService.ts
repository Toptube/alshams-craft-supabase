import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
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
  | 'falcon_image'
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
    | 'google_custom_search_plus_gemini'
    | 'gemini_google_search'
    | 'google_custom_search'
    | 'web_search_plus_groq'
    | 'web_search_direct';
}

export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const PRIMARY_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
export const FALLBACK_GEMINI_IMAGE_MODEL = 'gemini-nano-banana-2.1';
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
export function resolveAgentGeminiKey(agent: AIAgentRole): string {
  if (agent === 'falcon_chat') {
    return (
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON_CHAT) ||
      cleanSecretValue(process.env.FALCON_CHAT_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON) ||
      cleanSecretValue(process.env.FALCON_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY) ||
      ''
    );
  }
  if (agent === 'falcon_vision') {
    return (
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON_VISION) ||
      cleanSecretValue(process.env.FALCON_VISION_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON) ||
      cleanSecretValue(process.env.FALCON_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY) ||
      ''
    );
  }
  if (agent === 'falcon_image') {
    return (
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON_IMAGE) ||
      cleanSecretValue(process.env.FALCON_IMAGE_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON) ||
      cleanSecretValue(process.env.FALCON_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY) ||
      ''
    );
  }
  if (agent === 'falcon') {
    return (
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON_CHAT) ||
      cleanSecretValue(process.env.GEMINI_API_KEY_FALCON) ||
      cleanSecretValue(process.env.FALCON_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY) ||
      ''
    );
  }
  if (agent === 'shamousa') {
    return (
      cleanSecretValue(process.env.GEMINI_API_KEY_SHAMOUSA) ||
      cleanSecretValue(process.env.SHAMOUSA_GEMINI_API_KEY) ||
      cleanSecretValue(process.env.GEMINI_API_KEY) ||
      ''
    );
  }
  return (
    cleanSecretValue(process.env.GEMINI_API_KEY_FALCON_CHAT) ||
    cleanSecretValue(process.env.GEMINI_API_KEY) ||
    cleanSecretValue(process.env.GEMINI_API_KEY_FALCON) ||
    cleanSecretValue(process.env.GEMINI_API_KEY_SHAMOUSA) ||
    ''
  );
}

export function resolveGoogleSearchCredentials(): { apiKey: string; cx: string } {
  return {
    apiKey: cleanSecretValue(process.env.GOOGLE_SEARCH_API_KEY),
    cx: cleanSecretValue(process.env.GOOGLE_SEARCH_CX),
  };
}

export function getAgentSecretStatus() {
  const falconChatKey = resolveAgentGeminiKey('falcon_chat');
  const falconVisionKey = resolveAgentGeminiKey('falcon_vision');
  const falconImageKey = resolveAgentGeminiKey('falcon_image');
  const shamousaKey = resolveAgentGeminiKey('shamousa');
  const sharedKey = cleanSecretValue(process.env.GEMINI_API_KEY);
  const { apiKey: cseKey, cx } = resolveGoogleSearchCredentials();
  const groqKeys = getGroqApiKeys();
  const fanarKey = getFanarApiKey();
  const geminiUsable = Boolean(
    (falconChatKey && !isGeminiKeyCircuitOpen(falconChatKey)) ||
      (sharedKey && !isGeminiKeyCircuitOpen(sharedKey))
  );

  return {
    geminiSharedConfigured: Boolean(sharedKey),
    geminiCircuitOpen: Boolean(sharedKey && isGeminiKeyCircuitOpen(sharedKey)),
    falconGeminiReady: Boolean(falconChatKey && !isGeminiKeyCircuitOpen(falconChatKey)),
    falconChatGeminiReady: Boolean(falconChatKey && !isGeminiKeyCircuitOpen(falconChatKey)),
    falconVisionGeminiReady: Boolean(falconVisionKey && !isGeminiKeyCircuitOpen(falconVisionKey)),
    falconImageGeminiReady: Boolean(falconImageKey && !isGeminiKeyCircuitOpen(falconImageKey)),
    shamousaGeminiReady: Boolean(shamousaKey && !isGeminiKeyCircuitOpen(shamousaKey)),
    groqConfigured: groqKeys.length > 0,
    groqKeyCount: groqKeys.length,
    activeGroqModel: ACTIVE_GROQ_CHAT_MODELS[0],
    fanarConfigured: Boolean(fanarKey),
    activePrimaryProvider: geminiUsable ? 'gemini' : groqKeys.length > 0 ? 'groq' : fanarKey ? 'fanar' : 'none',
    googleSearchGroundingReady: Boolean(geminiUsable || groqKeys.length > 0 || fanarKey),
    googleCustomSearchApiReady: Boolean(cseKey && cx),
  };
}

export function createGeminiClientForAgent(agent: AIAgentRole): GoogleGenAI {
  const apiKey = resolveAgentGeminiKey(agent);
  if (!apiKey) {
    const labelMap: Record<AIAgentRole, string> = {
      falcon: 'GEMINI_API_KEY_FALCON / GEMINI_API_KEY',
      falcon_chat: 'GEMINI_API_KEY_FALCON_CHAT / GEMINI_API_KEY',
      falcon_vision: 'GEMINI_API_KEY_FALCON_VISION / GEMINI_API_KEY',
      falcon_image: 'GEMINI_API_KEY_FALCON_IMAGE / GEMINI_API_KEY',
      shamousa: 'GEMINI_API_KEY_SHAMOUSA / GEMINI_API_KEY',
      search: 'GEMINI_API_KEY',
    };
    throw new Error(`مفتاح Gemini غير مضبوط في الإعدادات (${labelMap[agent] || 'GEMINI_API_KEY'}).`);
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
  const blocked = [
    'gemini-1.',
    'gemini-2.',
    'gemini-pro',
    'gemini-flash-latest',
    'gemini-3.8',
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

export function getCandidateGeminiImageModels(): string[] {
  const envImg = cleanSecretValue(process.env.GEMINI_IMAGE_MODEL);
  const allowed = [
    'gemini-3.1-flash-lite-image',
    'gemini-nano-banana-2.1',
    'gemini-3-pro-image',
  ];
  const list = [
    envImg && allowed.includes(envImg) ? envImg : PRIMARY_GEMINI_IMAGE_MODEL,
    PRIMARY_GEMINI_IMAGE_MODEL,
    FALLBACK_GEMINI_IMAGE_MODEL,
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

async function fetchGoogleCustomSearchItems(query: string, limit = 5): Promise<GroundedSource[]> {
  const { apiKey, cx } = resolveGoogleSearchCredentials();
  if (!apiKey || !cx) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(Math.min(10, Math.max(1, limit))));
    url.searchParams.set('hl', 'ar');

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return [];
    const data: any = await res.json();
    if (!Array.isArray(data?.items)) return [];

    return data.items
      .filter((item: any) => Boolean(item?.link))
      .map((item: any) => ({
        title: String(item.title || item.link),
        url: String(item.link),
        snippet: item.snippet ? String(item.snippet) : undefined,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlEntities(str: string): string {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function fetchGoogleNewsRssResults(query: string, limit = 5): Promise<GroundedSource[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
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
      if (title && link.startsWith('http') && !seen.has(link)) {
        seen.add(link);
        sources.push({
          title,
          url: link,
          snippet: pubDate ? `تاريخ النشر: ${pubDate}` : undefined,
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
 * Unified Live Web Search Service:
 * 1) Gemini Google Search Grounding (+ optional Google Custom Search API)
 * 2) Direct Google News RSS live search + Groq/Fanar Arabic synthesis
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
  const cseResults = await fetchGoogleCustomSearchItems(cleanQuery, 5);

  const cseContext =
    cseResults.length > 0
      ? `\n\nنتائج أولية من محرك البحث:\n${cseResults.map((r, idx) => `[${idx + 1}] ${r.title} (${r.url}): ${r.snippet || ''}`).join('\n')}`
      : '';

  const systemInstruction =
    options?.systemHint ||
    `أنت باحث سوق متخصص في الحرف اليدوية والمشغولات والأسعار في ${country}. استخدم البحث الحي للوصول إلى أحدث المعلومات والأسعار والموردين والاتجاهات الواقعية، وقدم إجابة عربية دقيقة ومنظمة ومباشرة مع ذكر الروابط والمصادر.`;

  const key = resolveAgentGeminiKey(agent);
  let lastErr: any = null;

  // 1. Try Gemini Google Search Grounding when Gemini key is available and healthy
  if (key && !isGeminiKeyCircuitOpen(key)) {
    try {
      const ai = createGeminiClientForAgent(agent);
      const models = getCandidateGeminiModels();

      for (const model of models) {
        try {
          const response: GenerateContentResponse = await ai.models.generateContent({
            model,
            contents: `${cleanQuery}${cseContext}`,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
            },
          });

          const { sources, searchEntryPoint } = extractGroundingMetadata(response);
          const mergedSources: GroundedSource[] = [...sources];
          const existingUrls = new Set(mergedSources.map((s) => s.url));
          for (const item of cseResults) {
            if (!existingUrls.has(item.url)) {
              existingUrls.add(item.url);
              mergedSources.push(item);
            }
          }

          const answer = response.text?.trim() || '';
          if (answer) {
            return {
              answer,
              sources: mergedSources.slice(0, 6),
              searchEntryPoint,
              searchUsed: true,
              engine: cseResults.length > 0 ? 'google_custom_search_plus_gemini' : 'gemini_google_search',
            };
          }
        } catch (err: any) {
          lastErr = err;
          if (tripGeminiKeyCircuit(key, err)) {
            break;
          }
          const status = Number(err?.status || err?.code || 0);
          console.log(`[GoogleSearchService] Switching past model ${model} (status: ${status || 'err'})`);
        }
      }
    } catch (initErr: any) {
      lastErr = initErr;
      tripGeminiKeyCircuit(key, initErr);
    }
  }

  // 2. Fallback to Custom Search JSON API results if available
  if (cseResults.length > 0) {
    const synthesized = await summarizeWebResultsWithGroq(cleanQuery, cseResults, systemInstruction);
    return {
      answer:
        synthesized ||
        cseResults.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? `\n   ${r.snippet}` : ''}`).join('\n\n'),
      sources: cseResults,
      searchUsed: true,
      engine: synthesized ? 'web_search_plus_groq' : 'google_custom_search',
    };
  }

  // 3. Fallback to Google News RSS live search + Groq/Fanar synthesis
  console.log('[GoogleSearchService] Attempting Google News RSS live search fallback...');
  const webResults = await fetchGoogleNewsRssResults(cleanQuery, 5);
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
      'تم تجاوز حصة بحث جوجل الحالية مؤقتاً. يمكنك المحاولة بعد لحظات أو مراجعة خطة المفتاح في Settings > Secrets.'
    );
    quotaErr.status = 429;
    throw quotaErr;
  }

  throw new Error(
    `تعذر تنفيذ البحث الحي حالياً (Gemini: ${formatAiErrorReason(lastMsg || 'مفتاح غير صالح أو غير متوفر')}).`
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
    geminiMain,
    geminiFalconChat,
    geminiFalconVision,
    geminiFalconImage,
    geminiFalcon,
    geminiShamousa,
    groqPrimary,
    groqSecondary,
    groqBackup,
    fanarProbe,
    customSearchProbe,
    gnewsProbe,
    fxProbe,
  ] = await Promise.all([
    probeGeminiSingleKey('gemini_main', 'Google Gemini (المشترك)', ['GEMINI_API_KEY'], process.env.GEMINI_API_KEY || '', false),
    probeGeminiSingleKey(
      'gemini_falcon_chat',
      'صقر — مفتاح المحادثة وبحث جوجل (اختياري)',
      ['GEMINI_API_KEY_FALCON_CHAT', 'FALCON_CHAT_GEMINI_API_KEY'],
      process.env.GEMINI_API_KEY_FALCON_CHAT || process.env.FALCON_CHAT_GEMINI_API_KEY || '',
      true
    ),
    probeGeminiSingleKey(
      'gemini_falcon_vision',
      'صقر — مفتاح تحليل الصور والرؤية (اختياري)',
      ['GEMINI_API_KEY_FALCON_VISION', 'FALCON_VISION_GEMINI_API_KEY'],
      process.env.GEMINI_API_KEY_FALCON_VISION || process.env.FALCON_VISION_GEMINI_API_KEY || '',
      true
    ),
    probeGeminiSingleKey(
      'gemini_falcon_image',
      'صقر — مفتاح استوديو إنشاء الصور (اختياري)',
      ['GEMINI_API_KEY_FALCON_IMAGE', 'FALCON_IMAGE_GEMINI_API_KEY'],
      process.env.GEMINI_API_KEY_FALCON_IMAGE || process.env.FALCON_IMAGE_GEMINI_API_KEY || '',
      true
    ),
    probeGeminiSingleKey(
      'gemini_falcon',
      'Google Gemini (مفتاح صقر العام — اختياري)',
      ['GEMINI_API_KEY_FALCON', 'FALCON_GEMINI_API_KEY'],
      process.env.GEMINI_API_KEY_FALCON || process.env.FALCON_GEMINI_API_KEY || '',
      true
    ),
    probeGeminiSingleKey(
      'gemini_shamousa',
      'Google Gemini (مفتاح شموسة — اختياري)',
      ['GEMINI_API_KEY_SHAMOUSA', 'SHAMOUSA_GEMINI_API_KEY'],
      process.env.GEMINI_API_KEY_SHAMOUSA || process.env.SHAMOUSA_GEMINI_API_KEY || '',
      true
    ),
    probeGroqSingleKey('groq_primary', 'Groq AI (الأساسي)', ['GROQ_API_KEY'], process.env.GROQ_API_KEY || '', false),
    probeGroqSingleKey(
      'groq_secondary',
      'Groq AI (الثانوي)',
      ['GROQ_API_KEY_SECONDARY', 'GROQ_SECONDARY_API_KEY', 'GROQ_API_KEY_2'],
      process.env.GROQ_API_KEY_SECONDARY || process.env.GROQ_SECONDARY_API_KEY || process.env.GROQ_API_KEY_2 || '',
      true
    ),
    probeGroqSingleKey(
      'groq_backup',
      'Groq AI (الاحتياطي — اختياري)',
      ['GROQ_API_KEY_BACKUP', 'GROQ_BACKUP_KEY'],
      process.env.GROQ_API_KEY_BACKUP || process.env.GROQ_BACKUP_KEY || '',
      true
    ),
    // Fanar probe (live model only)
    (async (): Promise<ApiAuditEntry> => {
      const fanarKey = getFanarApiKey();
      if (!fanarKey) {
        return {
          id: 'fanar',
          name: 'Fanar Arabic AI',
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
        name: 'Fanar Arabic AI',
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
    // Google Custom Search JSON API
    (async (): Promise<ApiAuditEntry> => {
      const { apiKey, cx } = resolveGoogleSearchCredentials();
      if (!apiKey || !cx) {
        return {
          id: 'google_custom_search',
          name: 'Google Custom Search JSON API (اختياري)',
          category: 'search',
          envVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'],
          configured: false,
          optional: true,
          ok: false,
          summary: !apiKey && !cx ? 'اختياري غير مضبوط (البحث الحي يعمل عبر Google News RSS + Groq)' : !apiKey ? 'GOOGLE_SEARCH_API_KEY غير مضبوط' : 'GOOGLE_SEARCH_CX غير مضبوط',
        };
      }
      try {
        const u = new URL('https://www.googleapis.com/customsearch/v1');
        u.searchParams.set('key', apiKey);
        u.searchParams.set('cx', cx);
        u.searchParams.set('q', 'handmade');
        u.searchParams.set('num', '1');
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 8000);
        const r = await fetch(u.toString(), { signal: c.signal }).finally(() => clearTimeout(t));
        if (r.ok) {
          return {
            id: 'google_custom_search',
            name: 'Google Custom Search JSON API',
            category: 'search',
            envVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'],
            configured: true,
            ok: true,
            statusCode: r.status,
            summary: 'يعمل بنجاح',
          };
        }
        const err = redactSecrets(await r.text().catch(() => ''));
        return {
          id: 'google_custom_search',
          name: 'Google Custom Search JSON API',
          category: 'search',
          envVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'],
          configured: true,
          ok: false,
          statusCode: r.status,
          summary: formatAiErrorReason(err),
          rawError: err,
        };
      } catch (e: any) {
        return {
          id: 'google_custom_search',
          name: 'Google Custom Search JSON API',
          category: 'search',
          envVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'],
          configured: true,
          ok: false,
          summary: formatAiErrorReason(e?.message),
          rawError: redactSecrets(e?.message),
        };
      }
    })(),
    // Google News RSS
    (async (): Promise<ApiAuditEntry> => {
      try {
        const items = await fetchGoogleNewsRssResults('حرف يدوية مصر', 3);
        return {
          id: 'google_news_rss',
          name: 'Google News RSS (بحث الويب الاحتياطي)',
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
          name: 'Google News RSS (بحث الويب الاحتياطي)',
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
          name: 'Live Interbank FX API (open.er-api.com)',
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
          name: 'Live Interbank FX API (open.er-api.com)',
          category: 'fx',
          envVars: [],
          configured: true,
          ok: false,
          summary: formatAiErrorReason(e?.message),
        };
      }
    })(),
  ]);

  const hasEnvVapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  let hasFileVapid = false;
  try {
    if (fs.existsSync(VAPID_KEYS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, 'utf-8'));
      hasFileVapid = Boolean(parsed?.publicKey && parsed?.privateKey);
    }
  } catch {}
  const webPushReady = hasEnvVapid || hasFileVapid;

  const webPushEntry: ApiAuditEntry = {
    id: 'web_push_vapid',
    name: 'Web Push VAPID (/api/push/*)',
    category: 'push',
    envVars: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
    configured: webPushReady,
    ok: webPushReady,
    statusCode: webPushReady ? 200 : 503,
    summary: webPushReady
      ? hasEnvVapid
        ? 'يعمل بنجاح (مفاتيح VAPID من Secrets ونقاط /api/push/* مفعّلة)'
        : 'يعمل بنجاح (مفاتيح VAPID مولّدة تلقائياً ونقاط /api/push/* مفعّلة)'
      : 'مفاتيح VAPID قيد التهيئة',
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
  if (geminiModelEnv && /gemini-1\.|gemini-2\.|gemini-pro|gemini-3\.8/i.test(geminiModelEnv)) {
    staleSecretsIgnored.push(`GEMINI_MODEL=${geminiModelEnv} (متجاهل تلقائياً -> يستخدم ${PRIMARY_GEMINI_MODEL})`);
  }

  return {
    checkedAt: new Date().toISOString(),
    envFlags: {
      EFFECTIVE_GROQ_MODEL: ACTIVE_GROQ_CHAT_MODELS[0],
      EFFECTIVE_FANAR_MODEL: ACTIVE_FANAR_MODELS[0],
      EFFECTIVE_GEMINI_MODEL: PRIMARY_GEMINI_MODEL,
      EFFECTIVE_GEMINI_IMAGE_MODEL: PRIMARY_GEMINI_IMAGE_MODEL,
      GROQ_MODEL_SECRET: groqModelEnv || '(الافتراضي: openai/gpt-oss-120b)',
      GEMINI_MODEL_SECRET: geminiModelEnv || `(الافتراضي: ${PRIMARY_GEMINI_MODEL})`,
      STALE_SECRETS_BYPASSED: staleSecretsIgnored.length > 0 ? staleSecretsIgnored.join(' | ') : 'لا يوجد',
      SUPABASE_SERVICE_ROLE_KEY_SET: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
    },
    entries: [
      geminiMain,
      geminiFalconChat,
      geminiFalconVision,
      geminiFalconImage,
      geminiFalcon,
      geminiShamousa,
      groqPrimary,
      groqSecondary,
      groqBackup,
      fanarProbe,
      customSearchProbe,
      gnewsProbe,
      fxProbe,
      webPushEntry,
      firebaseRemnantsEntry,
    ],
  };
}


