import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface AIVisionPromptInput {
  imageBase64: string;
  mimeType?: string;
  artistNotes?: string;
  workshopContext?: {
    activeCrafts?: string[];
    country?: string;
    currency?: string;
    hourlyRate?: number;
    category?: string;
  };
}

export interface AIChatPromptInput {
  message: string;
  actionChip?: string | null;
  chatHistory: any[];
  workshopContext: {
    selectedCrafts?: string[];
    country?: string;
    currency?: string;
    category?: string;
  };
}

export interface AIChatResult {
  reply: string;
  sources: Array<{ title: string; url: string }>;
  searchUsed: boolean;
  searchEntryPoint?: string;
}

// قاطع دارة (Circuit Breaker) لكبح استدعاءات البحث عند استنزاف الحصة
let searchQuotaExhaustedUntil = 0;

function isSearchQuotaCoolingDown(): boolean {
  return Date.now() < searchQuotaExhaustedUntil;
}

function markSearchQuotaExhausted(): void {
  searchQuotaExhaustedUntil = Date.now() + 2 * 60 * 1000;
}

export type GeminiErrorKind = 'timeout' | 'quota' | 'unavailable' | 'bad_key' | 'bad_request' | 'other';

export function classifyGeminiError(err: any, aborted = false): GeminiErrorKind {
  const msg = String(err?.message || err || '');
  const status = Number(err?.status || err?.code || 0);
  if (aborted || err?.name === 'AbortError' || /abort|DEADLINE_EXCEEDED|timed? ?out/i.test(msg)) return 'timeout';
  if (status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) return 'quota';
  if ([500, 502, 503, 504].includes(status) || /\b50[0234]\b|UNAVAILABLE|overloaded|INTERNAL/i.test(msg)) return 'unavailable';
  if ([401, 403].includes(status) || /API key|PERMISSION_DENIED|API_KEY_INVALID/i.test(msg)) return 'bad_key';
  if (status === 400 || /INVALID_ARGUMENT|400/.test(msg)) return 'bad_request';
  return 'other';
}

export function falconErrorResponse(err: any): { status: number; error: string } {
  switch (err?.kind as GeminiErrorKind | undefined) {
    case 'timeout':
      return { status: 504, error: 'صقر اتأخر في الرد بسبب ضغط الشبكة، أعد المحاولة فوراً.' };
    case 'quota':
      return { status: 503, error: 'تم التبديل للمزود الاحتياطي لانتهاء الحصة اللحظية، حاول مجدداً.' };
    case 'unavailable':
      return { status: 503, error: 'الخدمة مضغوطة حالياً، حاول مرة أخرى بعد لحظات.' };
    case 'bad_key':
      return { status: 503, error: 'مفتاح التشغيل غير مضبوط على الخادم.' };
    default:
      return { status: 502, error: 'تعذر الرد، حاول مرة أخرى.' };
  }
}

// -------------------------------------------------------------
// محركات الطوارئ الاحتياطية (Groq ثم Fanar)
// -------------------------------------------------------------

async function callGroqFallback(systemInstruction: string, chatHistory: any[], userMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('مفتاح GROQ_API_KEY غير متوفر');

  const messages: any[] = [{ role: 'system', content: systemInstruction }];
  for (const h of chatHistory.slice(-6)) {
    const text = h.content || h.parts?.[0]?.text || h.text || '';
    if (text) {
      messages.push({
        role: h.role === 'model' || h.role === 'assistant' || h.sender === 'falcon' ? 'assistant' : 'user',
        content: String(text).slice(0, 1500),
      });
    }
  }
  messages.push({ role: 'user', content: userMessage });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.5,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

async function callFanarCompletion(
  systemInstruction: string,
  chatHistory: any[],
  userMessage: string
): Promise<string> {
  const apiKey = process.env.FANAR_API_KEY;
  if (!apiKey) throw new Error('مفتاح FANAR_API_KEY غير متوفر');

  const messages: any[] = [{ role: 'system', content: systemInstruction }];
  for (const h of chatHistory.slice(-6)) {
    const text = h.content || h.parts?.[0]?.text || h.text || '';
    if (text) {
      messages.push({
        role: h.role === 'model' || h.role === 'assistant' || h.sender === 'falcon' ? 'assistant' : 'user',
        content: String(text).slice(0, 1500),
      });
    }
  }
  messages.push({ role: 'user', content: userMessage });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.fanar.qa/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.FANAR_MODEL || 'Fanar',
        messages,
        temperature: 0.5,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Fanar ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

export class GeminiAIProvider {
  private ai: GoogleGenAI | null = null;
  private modelName: string;
  private fallbackModel: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    // تصحيح أسماء النماذج الرسمية وتجنب أسماء النماذج غير الموجودة
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash';

    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'alshams-craft-erp',
          },
        },
      });
    }
  }

  isAvailable(): boolean {
    return Boolean(this.ai && process.env.GEMINI_API_KEY);
  }

  private async generate(
    req: { contents: any; config?: any },
    opts: { label: string; timeoutMs: number; fallbackTimeoutMs?: number; noFallback?: boolean }
  ): Promise<any> {
    if (!this.ai) throw new Error('مفتاح GEMINI_API_KEY غير مضبوط على الخادم');
    const models = opts.noFallback || this.fallbackModel === this.modelName ? [this.modelName] : [this.modelName, this.fallbackModel];
    let lastErr: any = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const timeoutMs = i === 0 ? opts.timeoutMs : opts.fallbackTimeoutMs || opts.timeoutMs;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: req.contents,
          config: {
            ...(req.config || {}),
            abortSignal: controller.signal,
          },
        });
        clearTimeout(timer);
        return response;
      } catch (err: any) {
        clearTimeout(timer);
        const kind = classifyGeminiError(err, controller.signal.aborted);
        lastErr = Object.assign(err instanceof Error ? err : new Error(String(err)), { kind });
        if (!['timeout', 'quota', 'unavailable'].includes(kind)) break;
      }
    }
    throw lastErr;
  }

  async analyzeCraftVision(input: AIVisionPromptInput): Promise<any> {
    if (!this.ai) throw new Error('مفتاح GEMINI_API_KEY غير مضبوط على الخادم');

    const { imageBase64, mimeType = 'image/jpeg', artistNotes = '', workshopContext = {} } = input;
    const activeCrafts = Array.isArray(workshopContext.activeCrafts) ? workshopContext.activeCrafts : ['macrame'];
    const country = workshopContext.country || 'جمهورية مصر العربية';
    const currency = workshopContext.currency || 'ج.م';
    const hourlyRate = Number(workshopContext.hourlyRate) || 30;

    let cleanBase64 = imageBase64;
    let resolvedMimeType = mimeType || 'image/jpeg';
    const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (dataUrlMatch) {
      resolvedMimeType = dataUrlMatch[1].trim();
      cleanBase64 = dataUrlMatch[2].trim();
    } else {
      cleanBase64 = imageBase64.replace(/^data:[^,]+,/, '').trim();
    }
    cleanBase64 = cleanBase64.replace(/\s+/g, '');

    const step1Prompt = `أنت "صقر الشمساوية"، الخبير الهندسي المعتمد لمنظومة الشمساوية لكافة المشغولات اليدوية.
حلل صورة المشغولة بدقة هندسية عالية وتعرف على أبعادها وخاماتها:
الحِرف المفعّلة في الورشة: [${activeCrafts.join('، ')}].

القواعد الحصرية:
1. اختر التصنيف الأنسب من القائمة: ["رانر", "ستائر", "سجاد", "كوشن", "جدارية", "بوف", "كرسي", "أرجوحة", "نجف وإضاءة", "شنطة أو كلاتش"].
2. قدّر صافي ساعات العمل اليدوي (estimatedHours).
3. قدّر الأبعاد المقترحة وخطوات العمل والتقنيات.
4. أنشئ كود SVG نظيف للرسم التخطيطي.

أخرج النتيجة بصيغة JSON نظيفة فقط:
{
  "detectedCategory": "string",
  "estimatedHours": number,
  "suggestedDimensions": { "width": number, "totalLength": number, "fringeLength": number, "cordThickness": number, "shape": "flat" },
  "productionGuide": ["string"],
  "stitchPatterns": ["string"],
  "svgSchematic": "<svg viewBox=\\"0 0 300 200\\"></svg>",
  "notesForCalculator": "string"
}`;

    const step1Parts = [
      { inlineData: { mimeType: resolvedMimeType, data: cleanBase64 } },
      { text: step1Prompt + (artistNotes ? `\nملاحظات الفنان: ${artistNotes}` : '') },
    ];

    let step1Response = await this.generate(
      { contents: { parts: step1Parts } },
      { label: 'vision', timeoutMs: 25_000, fallbackTimeoutMs: 20_000 }
    );

    const step1Text = step1Response.text || '';
    const cleanJsonText = step1Text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('تعذر فك بيانات التحليل الفني للصورة.');

    const parsedData = JSON.parse(jsonMatch[0]);
    const hours = Number(parsedData.estimatedHours) || 3;
    parsedData.estimatedHours = hours;
    parsedData.estimatedLaborWage = Math.round(hours * hourlyRate);

    // الخطوة 2: بحث الأسعار مع حماية الكوتة
    let minPrice = 0;
    let avgPrice = 0;
    let maxPrice = 0;
    let isEstimatedPricing = false;
    let searchSources: Array<{ title: string; url: string }> = [];

    if (isSearchQuotaCoolingDown()) {
      isEstimatedPricing = true;
    } else {
      try {
        const searchPrompt = `أنت صقر الشمساوية، ابحث في السوق عن أسعار بيع مشغولات "${parsedData.detectedCategory}" في "${country}" بعملة "${currency}". أخرج فقط JSON: {"minMarketPrice": number, "avgMarketPrice": number, "maxMarketPrice": number}`;

        const step2Response = await this.generate(
          { contents: searchPrompt, config: { tools: [{ googleSearch: {} }] } },
          { label: 'vision-search', timeoutMs: 15_000, noFallback: true }
        );

        const cand = step2Response.candidates?.[0];
        const grounding = cand?.groundingMetadata;
        if (grounding?.groundingChunks) {
          for (const chunk of grounding.groundingChunks) {
            if (chunk.web?.uri) searchSources.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
          }
        }

        const match2 = (step2Response.text || '').match(/\{[\s\S]*\}/);
        if (match2) {
          const prices = JSON.parse(match2[0]);
          minPrice = Number(prices.minMarketPrice) || 0;
          avgPrice = Number(prices.avgMarketPrice) || 0;
          maxPrice = Number(prices.maxMarketPrice) || 0;
        }
      } catch (err) {
        markSearchQuotaExhausted();
        isEstimatedPricing = true;
      }
    }

    if (isEstimatedPricing || (minPrice === 0 && avgPrice === 0 && maxPrice === 0)) {
      isEstimatedPricing = true;
      avgPrice = Math.max(100, Math.round(parsedData.estimatedLaborWage * 2.2));
      minPrice = Math.round(avgPrice * 0.75);
      maxPrice = Math.round(avgPrice * 1.5);
    }

    parsedData.competitionPricing = { minMarketPrice: minPrice, avgMarketPrice: avgPrice, maxMarketPrice: maxPrice, estimated: isEstimatedPricing };
    parsedData.sources = searchSources;
    return parsedData;
  }

  async chatWithAgent(input: AIChatPromptInput): Promise<AIChatResult> {
    const { message, actionChip, chatHistory, workshopContext } = input;
    const safeSelectedCrafts = Array.isArray(workshopContext.selectedCrafts) ? workshopContext.selectedCrafts : ['macrame'];
    const safeCountry = workshopContext.country || 'جمهورية مصر العربية';
    const safeCurrency = workshopContext.currency || 'ج.م';
    const safeCategory = workshopContext.category || 'عام';

    const systemInstruction = `أنت "صقر الشمساوية"، المستشار الهندسي والحسابي الأول لمنظومة الشمساوية.
خبير شامل في كافة الحرف اليدوية: (المكرمية، الكروشيه، الريزن، الخزف، الجلود، الشموع، الخشب والإكسسوارات).
- أسلوبك: مباشر، مهني، خبير بالحسابات والأسعار ومواصفات الخامات.
- الحرف المفعّلة: [${safeSelectedCrafts.join('، ')}] | الدولة: ${safeCountry} | العملة: ${safeCurrency} | التصنيف: ${safeCategory}.
- لا تدّعِ أنك إنسان، ولا تذكر أسماء شركات النماذج البرمجية مطلقاً.`;

    const userPromptText = actionChip ? `الاستفسار حول [${actionChip}]: ${message || 'يرجى تقديم التوجيه الفني المتخصص.'}` : message;

    // 1. المحاولة الأساسية عبر Gemini (مع أو بدون بحث)
    if (this.ai) {
      try {
        const contents: any[] = chatHistory.slice(-8).map((m) => ({
          role: m.sender === 'user' || m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text || m.content || '' }],
        }));
        contents.push({ role: 'user', parts: [{ text: userPromptText }] });

        const lowerQuery = userPromptText.toLowerCase();
        const needsSearch = ['سعر', 'أسعار', 'سوق', 'مورد', 'تريند'].some((k) => lowerQuery.includes(k));

        let response: any = null;
        let searchUsed = false;
        let searchSources: Array<{ title: string; url: string }> = [];

        if (needsSearch && !isSearchQuotaCoolingDown()) {
          try {
            response = await this.generate(
              {
                contents,
                config: {
                  systemInstruction: { parts: [{ text: systemInstruction }] },
                  tools: [{ googleSearch: {} }],
                },
              },
              { label: 'chat-search', timeoutMs: 16_000, noFallback: true }
            );
            searchUsed = true;
          } catch {
            markSearchQuotaExhausted();
            response = await this.generate(
              { contents, config: { systemInstruction: { parts: [{ text: systemInstruction }] } } },
              { label: 'chat-after-search', timeoutMs: 14_000, fallbackTimeoutMs: 10_000 }
            );
          }
        } else {
          response = await this.generate(
            { contents, config: { systemInstruction: { parts: [{ text: systemInstruction }] } } },
            { label: 'chat', timeoutMs: 15_000, fallbackTimeoutMs: 10_000 }
          );
        }

        const candidate = response?.candidates?.[0];
        const grounding = candidate?.groundingMetadata;
        if (grounding?.groundingChunks) {
          for (const chunk of grounding.groundingChunks) {
            if (chunk.web?.uri) searchSources.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
          }
        }

        const reply = response?.text?.trim() || 'أهلاً بك، كيف يمكنني مساعدتك اليوم؟';
        return { reply, sources: searchSources.slice(0, 4), searchUsed };
      } catch (geminiErr: any) {
        console.warn('[Falcon] Gemini unavailable. Switching to Groq fallback...', geminiErr?.message?.slice(0, 100));
      }
    }

    // 2. التحويل التلقائي الأول (Fallback 1): Groq (سريع ومجاني)
    if (process.env.GROQ_API_KEY) {
      try {
        const groqReply = await callGroqFallback(systemInstruction, chatHistory, userPromptText);
        if (groqReply) return { reply: groqReply, sources: [], searchUsed: false };
      } catch (groqErr: any) {
        console.warn('[Falcon] Groq fallback failed. Switching to Fanar...', groqErr?.message?.slice(0, 100));
      }
    }

    // 3. التحويل التلقائي الثاني (Fallback 2): Fanar
    if (process.env.FANAR_API_KEY) {
      try {
        const fanarReply = await callFanarCompletion(systemInstruction, chatHistory, userPromptText);
        if (fanarReply) return { reply: fanarReply, sources: [], searchUsed: false };
      } catch (fanarErr: any) {
        console.error('[Falcon] Fanar fallback failed too:', fanarErr?.message?.slice(0, 100));
      }
    }

    throw new Error('تعذر الاتصال بجميع مزودي الخدمة مؤقتاً، يرجى المحاولة بعد قليل.');
  }
}

export const aiProvider = new GeminiAIProvider();

// -------------------------------------------------------------
// إدارة الجلسات وسجل الورشة
// -------------------------------------------------------------
export interface SanitizedSessionMessage {
  id: string;
  sender: 'user' | 'falcon';
  text: string;
  timestamp: number;
  sources?: Array<{ title: string; url: string }>;
  searchUsed?: boolean;
  metadata?: Record<string, any>;
}

export interface WorkshopSessionState {
  workshopId: string;
  messages: SanitizedSessionMessage[];
  updatedAt: number;
}

const workshopSessionsCache = new Map<string, WorkshopSessionState>();
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

export function sanitizeChatHistoryForStorage(messages: any[]): SanitizedSessionMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((m) => Boolean(m && typeof m === 'object'))
    .map((m) => {
      let sanitizedMeta: Record<string, any> | undefined = undefined;
      if (m.metadata && typeof m.metadata === 'object') {
        const rawMeta = { ...m.metadata };
        delete rawMeta.token;
        delete rawMeta.password;
        delete rawMeta.secretKey;
        delete rawMeta.treasuries;
        delete rawMeta.safeBalances;
        delete rawMeta.internalHourlyRate;
        delete rawMeta.actualInternalCost;
        delete rawMeta.apiKey;
        sanitizedMeta = rawMeta;
      }

      return {
        id: String(m.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
        sender: m.sender === 'user' ? ('user' as const) : ('falcon' as const),
        text: typeof m.text === 'string' ? m.text : '',
        timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
        sources: Array.isArray(m.sources) ? m.sources : undefined,
        searchUsed: Boolean(m.searchUsed),
        metadata: sanitizedMeta,
      };
    })
    .slice(-30);
}

export function saveWorkshopSession(workshopId: string, messages: any[]): WorkshopSessionState {
  const sanitized = sanitizeChatHistoryForStorage(messages);
  const session: WorkshopSessionState = {
    workshopId,
    messages: sanitized,
    updatedAt: Date.now(),
  };
  workshopSessionsCache.set(workshopId, session);
  return session;
}

export function getWorkshopSession(workshopId: string): WorkshopSessionState | null {
  const session = workshopSessionsCache.get(workshopId);
  if (!session) return null;

  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    workshopSessionsCache.delete(workshopId);
    return null;
  }
  return session;
}

export function clearWorkshopSession(workshopId: string): void {
  workshopSessionsCache.delete(workshopId);
}