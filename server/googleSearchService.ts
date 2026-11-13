import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

export type AIAgentRole = 'falcon' | 'shamousa' | 'search';

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
  engine: 'google_custom_search_plus_gemini' | 'gemini_google_search' | 'google_custom_search';
}

export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

/**
 * Resolve the appropriate Gemini API key from environment secrets
 * without ever hardcoding or exposing keys to the browser.
 */
export function resolveAgentGeminiKey(agent: AIAgentRole): string {
  if (agent === 'falcon') {
    return (
      process.env.GEMINI_API_KEY_FALCON ||
      process.env.FALCON_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();
  }
  if (agent === 'shamousa') {
    return (
      process.env.GEMINI_API_KEY_SHAMOUSA ||
      process.env.SHAMOUSA_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();
  }
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY_FALCON ||
    process.env.GEMINI_API_KEY_SHAMOUSA ||
    ''
  ).trim();
}

export function resolveGoogleSearchCredentials(): { apiKey: string; cx: string } {
  return {
    apiKey: (process.env.GOOGLE_SEARCH_API_KEY || '').trim(),
    cx: (process.env.GOOGLE_SEARCH_CX || '').trim(),
  };
}

export function getAgentSecretStatus() {
  const falconKey = resolveAgentGeminiKey('falcon');
  const shamousaKey = resolveAgentGeminiKey('shamousa');
  const sharedKey = (process.env.GEMINI_API_KEY || '').trim();
  const { apiKey: cseKey, cx } = resolveGoogleSearchCredentials();

  return {
    geminiSharedConfigured: Boolean(sharedKey),
    falconGeminiReady: Boolean(falconKey),
    shamousaGeminiReady: Boolean(shamousaKey),
    googleSearchGroundingReady: Boolean(falconKey || shamousaKey || sharedKey),
    googleCustomSearchApiReady: Boolean(cseKey && cx),
  };
}

export function createGeminiClientForAgent(agent: AIAgentRole): GoogleGenAI {
  const apiKey = resolveAgentGeminiKey(agent);
  if (!apiKey) {
    throw new Error(
      `مفتاح Gemini غير مضبوط في الإعدادات (${agent === 'falcon' ? 'GEMINI_API_KEY_FALCON / GEMINI_API_KEY' : agent === 'shamousa' ? 'GEMINI_API_KEY_SHAMOUSA / GEMINI_API_KEY' : 'GEMINI_API_KEY'}).`
    );
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
  const envPrimary = (process.env.GEMINI_MODEL || '').trim();
  const envFallback = (process.env.GEMINI_FALLBACK_MODEL || '').trim();
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

/**
 * Unified Google Search Service powered by Gemini Google Search Grounding
 * (+ optional Google Custom Search JSON API enrichment when GOOGLE_SEARCH_API_KEY & CX are configured).
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

  const key = resolveAgentGeminiKey(agent);
  if (!key) {
    if (cseResults.length > 0) {
      return {
        answer: cseResults.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? `\n   ${r.snippet}` : ''}`).join('\n\n'),
        sources: cseResults,
        searchUsed: true,
        engine: 'google_custom_search',
      };
    }
    throw new Error('مفتاح GEMINI_API_KEY غير مضبوط في الإعدادات لتشغيل البحث.');
  }

  const ai = createGeminiClientForAgent(agent);
  const models = getCandidateGeminiModels();
  let lastErr: any = null;

  const cseContext =
    cseResults.length > 0
      ? `\n\nنتائج أولية من محرك البحث:\n${cseResults.map((r, idx) => `[${idx + 1}] ${r.title} (${r.url}): ${r.snippet || ''}`).join('\n')}`
      : '';

  const systemInstruction =
    options?.systemHint ||
    `أنت باحث سوق متخصص في الحرف اليدوية والمشغولات والأسعار في ${country}. استخدم بحث جوجل للوصول إلى أحدث المعلومات والأسعار والموردين والاتجاهات الواقعية، وقدم إجابة عربية دقيقة ومنظمة ومباشرة مع ذكر الروابط والمصادر.`;

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
      const status = Number(err?.status || err?.code || 0);
      console.log(`[GoogleSearchService] Switching past model ${model} (status: ${status || 'err'})`);
    }
  }

  if (cseResults.length > 0) {
    return {
      answer: cseResults.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? `\n   ${r.snippet}` : ''}`).join('\n\n'),
      sources: cseResults,
      searchUsed: true,
      engine: 'google_custom_search',
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

  throw lastErr || new Error('تعذر تنفيذ بحث جوجل في الوقت الحالي.');
}
