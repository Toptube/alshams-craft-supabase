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
  engine:
    | 'google_custom_search_plus_gemini'
    | 'gemini_google_search'
    | 'google_custom_search'
    | 'groq_compound_search'
    | 'web_search_plus_groq'
    | 'web_search_direct';
}

export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

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
  if (agent === 'falcon') {
    return (
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
  const falconKey = resolveAgentGeminiKey('falcon');
  const shamousaKey = resolveAgentGeminiKey('shamousa');
  const sharedKey = cleanSecretValue(process.env.GEMINI_API_KEY);
  const { apiKey: cseKey, cx } = resolveGoogleSearchCredentials();
  const groqKeys = getGroqApiKeys();
  const fanarKey = getFanarApiKey();

  return {
    geminiSharedConfigured: Boolean(sharedKey),
    falconGeminiReady: Boolean(falconKey),
    shamousaGeminiReady: Boolean(shamousaKey),
    groqConfigured: groqKeys.length > 0,
    fanarConfigured: Boolean(fanarKey),
    googleSearchGroundingReady: Boolean(falconKey || shamousaKey || sharedKey || groqKeys.length > 0),
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

async function fetchDuckDuckGoHtmlResults(query: string, limit = 5): Promise<GroundedSource[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlshamsBot/1.0)',
        'Accept-Language': 'ar,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const html = await res.text();
    const sources: GroundedSource[] = [];
    const seen = new Set<string>();

    // Extract result anchor tags
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippets: string[] = [];
    let sMatch: RegExpExecArray | null;
    while ((sMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(decodeHtmlEntities(sMatch[1]));
    }

    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = linkRegex.exec(html)) !== null && sources.length < limit) {
      let href = match[1];
      if (href.includes('uddg=')) {
        try {
          const parsed = new URL(href.startsWith('//') ? `https:${href}` : href, 'https://duckduckgo.com');
          const target = parsed.searchParams.get('uddg');
          if (target) href = decodeURIComponent(target);
        } catch {}
      } else if (href.startsWith('//')) {
        href = `https:${href}`;
      }
      const title = decodeHtmlEntities(match[2]);
      if (href.startsWith('http') && !seen.has(href) && title) {
        seen.add(href);
        sources.push({
          title,
          url: href,
          snippet: snippets[idx] || undefined,
        });
      }
      idx++;
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

async function searchWithGroqCompound(
  query: string,
  systemInstruction: string
): Promise<{ result: { answer: string; sources: GroundedSource[] } | null; errorReason?: string }> {
  const groqKeys = getGroqApiKeys();
  if (groqKeys.length === 0) return { result: null, errorReason: 'مفتاح Groq غير مضبوط' };

  const compoundModels = ['groq/compound', 'groq/compound-mini', 'compound-beta', 'compound-beta-mini'];
  let lastError = '';
  for (const apiKey of groqKeys) {
    for (const model of compoundModels) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 22000);
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
              { role: 'user', content: query },
            ],
            max_tokens: 1400,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errTxt = await res.text().catch(() => '');
          lastError = `Groq ${model} (${res.status}): ${formatAiErrorReason(errTxt || String(res.status))}`;
          console.log('[GoogleSearchService Compound skip]:', model, res.status, errTxt.slice(0, 160));
          continue;
        }
        const data: any = await res.json();
        const message = data?.choices?.[0]?.message;
        const answer = String(message?.content || '').trim();
        if (!answer) continue;

        const sources: GroundedSource[] = [];
        const seen = new Set<string>();

        // Extract tool search results returned by groq/compound if present
        if (Array.isArray(message?.executed_tools)) {
          for (const tool of message.executed_tools) {
            const results = tool?.search_results?.results;
            if (Array.isArray(results)) {
              for (const r of results) {
                if (r?.url && !seen.has(r.url)) {
                  seen.add(r.url);
                  sources.push({
                    title: String(r.title || r.url),
                    url: String(r.url),
                    snippet: r.content ? String(r.content).slice(0, 200) : undefined,
                  });
                }
              }
            }
          }
        }

        // Also capture any markdown URLs in answer
        const urlMatches = answer.match(/https?:\/\/[^\s)\]]+/g) || [];
        for (const rawUrl of urlMatches) {
          const cleanUrl = rawUrl.replace(/[.,;!?]+$/, '');
          if (!seen.has(cleanUrl)) {
            seen.add(cleanUrl);
            sources.push({ title: cleanUrl, url: cleanUrl });
          }
        }

        return { result: { answer, sources: sources.slice(0, 6) } };
      } catch (err: any) {
        lastError = formatAiErrorReason(err?.message);
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { result: null, errorReason: lastError || undefined };
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

  const models = ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instant'];
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
        const txt = String(data?.choices?.[0]?.message?.content || '').trim();
        if (txt) return txt;
      } catch {
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

/**
 * Unified Live Web Search Service:
 * 1) Gemini Google Search Grounding (+ optional Google Custom Search API)
 * 2) Groq Compound live web search (groq/compound / compound-beta)
 * 3) Direct web search (Custom Search / DuckDuckGo HTML / Google News RSS) + Groq Llama 3.3 70B synthesis
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

  // 1. Try Gemini Google Search Grounding when Gemini key is available
  if (key) {
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
          const status = Number(err?.status || err?.code || 0);
          console.log(`[GoogleSearchService] Switching past model ${model} (status: ${status || 'err'})`);
        }
      }
    } catch (initErr: any) {
      lastErr = initErr;
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

  // 3. Fallback to Groq Compound live web search engine
  console.log('[GoogleSearchService] Gemini search unavailable, attempting Groq Compound live web search...');
  const compoundAttempt = await searchWithGroqCompound(cleanQuery, systemInstruction);
  if (compoundAttempt.result && compoundAttempt.result.answer) {
    return {
      answer: compoundAttempt.result.answer,
      sources: compoundAttempt.result.sources,
      searchUsed: true,
      engine: 'groq_compound_search',
    };
  }

  // 4. Fallback to DuckDuckGo HTML / Google News RSS live search + Groq synthesis
  console.log('[GoogleSearchService] Attempting web RSS/HTML search fallback...');
  const ddgResults = await fetchDuckDuckGoHtmlResults(cleanQuery, 5);
  const gnewsResults = ddgResults.length > 0 ? [] : await fetchGoogleNewsRssResults(cleanQuery, 5);
  const webResults = ddgResults.length > 0 ? ddgResults : gnewsResults;
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

  const compoundDetail = compoundAttempt.errorReason ? ` | محرك البحث البديل: ${compoundAttempt.errorReason}` : '';
  throw new Error(
    `تعذر تنفيذ البحث الحي حالياً (Gemini: ${formatAiErrorReason(lastMsg || 'مفتاح غير صالح أو غير متوفر')}${compoundDetail}).`
  );
}

