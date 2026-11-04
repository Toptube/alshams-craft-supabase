import { GoogleGenAI } from '@google/genai';
import {
  isSuperAdmin,
  processTrainingInteraction,
  buildGlobalMemoryPrompt,
} from './aiGlobalMemory.js';

export interface AIVisionPromptInput {
  imageBase64: string;
  mimeType?: string;
  artistNotes?: string;
  userEmail?: string;
  isSuperAdmin?: boolean;
  workshopContext?: {
    activeCrafts?: string[];
    country?: string;
    currency?: string;
    hourlyRate?: number;
    category?: string;
    artistName?: string;
    userEmail?: string;
    isSuperAdmin?: boolean;
  };
}

export interface AIChatPromptInput {
  message: string;
  actionChip?: string | null;
  chatHistory: any[];
  userEmail?: string;
  isSuperAdmin?: boolean;
  workshopContext: {
    selectedCrafts?: string[];
    country?: string;
    currency?: string;
    category?: string;
    artistName?: string;
    brandName?: string;
    userEmail?: string;
    isSuperAdmin?: boolean;
  };
}

export interface AIChatResult {
  reply: string;
  sources: Array<{ title: string; url: string }>;
  searchUsed: boolean;
  searchEntryPoint?: string;
  inTrainingMode?: boolean;
}

// قاطع دارة للبحث عند استنزاف الكوتة
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
      return { status: 504, error: 'استغرق صقر وقتاً أطول من المعتاد بسبب ضغط الشبكة، أعد المحاولة فوراً.' };
    case 'quota':
      return { status: 503, error: 'تم التبديل للمزود الاحتياطي لانتهاء الحصة اللحظية، حاول مجدداً.' };
    case 'unavailable':
      return { status: 503, error: 'الخدمة تواجه ضغطاً مؤقتاً، حاول مرة أخرى بعد لحظات.' };
    case 'bad_key':
      return { status: 503, error: 'مفتاح التشغيل غير مضبوط على الخادم.' };
    default:
      return { status: 502, error: 'تعذر الرد، حاول مرة أخرى.' };
  }
}

// -------------------------------------------------------------
// محركات الطوارئ الاحتياطية (Groq أساسي -> Groq بديل -> Gemini -> Fanar)
// -------------------------------------------------------------

function getGroqKeys(): { primary?: string; secondary?: string } {
  const primary = (process.env.GROQ_API_KEY || '').trim();
  const secondary = (
    process.env.GROQ_API_KEY_SECONDARY ||
    process.env.GROQ_API_KEY_BACKUP ||
    process.env.GROQ_SECONDARY_API_KEY ||
    process.env.GROQ_API_KEY_2 ||
    process.env.GROQ_BACKUP_KEY ||
    ''
  ).trim();

  return {
    primary: primary || undefined,
    secondary: secondary && secondary !== primary ? secondary : undefined,
  };
}

async function callGroqFallback(
  systemInstruction: string,
  chatHistory: any[],
  userMessage: string,
  customApiKey?: string
): Promise<string> {
  const apiKey = customApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('مفتاح GROQ_API_KEY غير متوفر');

  const messages: any[] = [{ role: 'system', content: systemInstruction }];
  for (const h of chatHistory.slice(-10)) {
    const text = h.content || h.parts?.[0]?.text || h.text || '';
    if (text) {
      messages.push({
        role: h.role === 'model' || h.role === 'assistant' || h.sender === 'falcon' ? 'assistant' : 'user',
        content: String(text).slice(0, 2000),
      });
    }
  }
  messages.push({ role: 'user', content: userMessage });

  const candidateModels = [
    'allam-2-7b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
  ];

  const rawModel = (process.env.GROQ_MODEL || '').trim();
  if (rawModel && !candidateModels.includes(rawModel) && !rawModel.includes('70b') && !rawModel.includes('3.3') && !rawModel.includes('llama')) {
    candidateModels.unshift(rawModel);
  }

  let lastErrText = '';

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

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
          temperature: 0.6,
          max_tokens: 1200,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        lastErrText = await res.text().catch(() => '');
        if (res.status === 404 || lastErrText.includes('model_not_found') || lastErrText.includes('does not exist')) {
          console.warn(`[Falcon Groq] Model "${model}" not available, trying next candidate...`);
          continue;
        }
        throw new Error(`Groq HTTP ${res.status} [${model}]: ${lastErrText.slice(0, 100)}`);
      }

      const data: any = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() || '';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[Falcon Groq] Timeout for model ${model}, trying next...`);
        continue;
      }
      if (lastErrText.includes('does not exist') || lastErrText.includes('model_not_found')) {
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`فشل الاتصال بنماذج Groq (${candidateModels.join(', ')}): ${lastErrText.slice(0, 100)}`);
}


export class GeminiAIProvider {
  private ai: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    // النماذج الرسمية المدعومة وفق دليل gemini-api
    const rawModel = process.env.GEMINI_MODEL || '';
    this.modelName = rawModel && !rawModel.includes('1.5') && !rawModel.includes('2.0') && !rawModel.includes('2.5')
      ? rawModel
      : 'gemini-3.8-flash';

    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
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
    opts: { label: string; timeoutMs: number }
  ): Promise<any> {
    if (!this.ai) throw new Error('مفتاح GEMINI_API_KEY غير مضبوط على الخادم');

    const modelsToTry = [this.modelName, 'gemini-3.8-flash', 'gemini-3.1-flash-lite']
      .filter((m) => m && !m.includes('1.5') && !m.includes('2.0') && !m.includes('2.5'));
    const uniqueModels = Array.from(new Set(modelsToTry));
    let lastError: any = null;

    for (const model of uniqueModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        let timeoutId: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            const timeoutErr: any = new Error(`انتهت مهلة استجابة Gemini (${opts.label})`);
            timeoutErr.kind = 'timeout';
            reject(timeoutErr);
          }, opts.timeoutMs || 25000);
        });

        try {
          const response = await Promise.race([
            this.ai.models.generateContent({
              model,
              contents: req.contents,
              config: req.config || {},
            }).finally(() => clearTimeout(timeoutId)),
            timeoutPromise,
          ]);
          return response;
        } catch (err: any) {
          clearTimeout(timeoutId);
          lastError = err;
          const msg = String(err?.message || err || '');
          if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE') || msg.includes('404')) {
            console.warn(`[Gemini generate] Model ${model} (attempt ${attempt}) returned temporary error: ${msg.slice(0, 100)}, retrying...`);
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
          }
          break;
        }
      }
    }

    const kind = classifyGeminiError(lastError, false);
    throw Object.assign(lastError instanceof Error ? lastError : new Error(String(lastError)), { kind });
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

    const step1Prompt = `أنت "صقر الشمساوية"، المستشار الهندسي الخبير والحكيم لمنظومة الشمساوية الحرفية.
أنت من مواليد برج القوس 24 نوفمبر 1979، ولديك خبرة عميقة ممتدة لعقود في كافة الصناعات اليدوية والهندسة الحرفية.
حلل صورة المشغولة بدقة هندسية عالية وتعرف على أبعادها وخاماتها:
الحِرف المفعّلة في الورشة: [${activeCrafts.join('، ')}].

القواعد:
1. اختر التصنيف الأنسب من المشغولات: ["رانر", "ستائر", "سجاد", "كوشن", "جدارية", "بوف", "كرسي", "أرجوحة", "نجف وإضاءة", "شنطة أو كلاتش"].
2. قدّر صافي ساعات العمل اليدوي الفعلية (estimatedHours).
3. قدّر الأبعاد المقترحة وخطوات العمل والتقنيات وغرز العمل.
4. أنشئ كود SVG نظيف للرسم التخطيطي الهندسي.

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
      { text: step1Prompt + (artistNotes ? `\nملاحظات وتوجيهات الفنان: ${artistNotes}` : '') },
    ];

    let step1Response = await this.generate(
      { contents: { parts: step1Parts } },
      { label: 'vision', timeoutMs: 25_000 }
    );

    const step1Text = step1Response.text || '';
    const cleanJsonText = step1Text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('تعذر فك بيانات التحليل الفني للصورة.');

    const parsedData = JSON.parse(jsonMatch[0]);
    const hours = Number(parsedData.estimatedHours) || 3;
    parsedData.estimatedHours = hours;
    parsedData.estimatedLaborWage = Math.round(hours * hourlyRate);

    // الخطوة 2: بحث الأسعار عبر Google Search Tool
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
          { label: 'vision-search', timeoutMs: 15_000 }
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
    const userEmail = input.userEmail || workshopContext?.userEmail || '';
    const superAdmin = Boolean(input.isSuperAdmin || workshopContext?.isSuperAdmin || isSuperAdmin(userEmail));

    // 0. التحقق من حساب السوبر أدمن وبروتوكول التدريب والبرمجة التفاعلي (Session State)
    if (superAdmin && message) {
      const trainingResult = await processTrainingInteraction(
        'falcon',
        String(message).trim(),
        userEmail || 'hmb.top.tupe@gmail.com'
      );
      if (trainingResult.handled) {
        return {
          reply: trainingResult.reply,
          sources: [],
          searchUsed: false,
          inTrainingMode: trainingResult.inTrainingMode,
        };
      }
    }

    const safeSelectedCrafts = Array.isArray(workshopContext?.selectedCrafts) ? workshopContext.selectedCrafts : ['macrame'];
    const safeCountry = workshopContext?.country || 'جمهورية مصر العربية';
    const safeCurrency = workshopContext?.currency || 'ج.م';
    const safeCategory = workshopContext?.category || 'عام';
    const artistName = workshopContext?.artistName || (superAdmin ? 'الباشمهندس حسام' : '');

    const memoryPrompt = await buildGlobalMemoryPrompt('falcon');
    const systemInstruction = `أنت "صقر الشمساوية" 🦅 — الخبير الهندسي والاستشاري الأول لحرفيي وصناع الهاند ميد والديكور في منظومة الشمساوية.
قواعد الهوية الصارمة والمهنية:
- هويتك حصرية وغير قابلة للتغيير: أنت صقر الشمساوية الحرفي الاستشاري، ويُمنع منعاً باتاً ومطلقاً الادعاء بأنك تتبع أو تمثل أي شركة أو نموذج آخر مثل إي روبوت أو غيرها.
- شخصيتك: خبير حكيم، قوي البصيرة، ذكي جداً، ودود، جدع وابن بلد يفهم دقائق الصنعة، مرح مرحاً راقياً بلا ابتذال.
- أنت من مواليد 24 نوفمبر 1979، ولديك خبرة حياتية وهندسية تمتد لعقود في كافة فنون الصناعات اليدوية والهاند ميد والديكور المنزلي (المكرمية، الكروشيه، الريزن، الخزف والفخار، الجلود الطبيعية، المشغولات الخشبية، الشموع والإكسسوارات).
- لهجة الحديث الرسمية: اللهجة المصرية العامية الأصيلة والدافئة والذكية (المصري الحرفي الجدع)، إلا إذا كتب المستخدم بلغة أخرى أو طلب التحدث بلغة محددة فتجيبه بلغته المختارة باحترافية.
- تفهم وتستوعب الكلمات العامية المصرية، واصطلاحات الحرفيين، والأخطاء الإملائية وتفهم قصد الصانع بذكاء وبصيرة دون قيود مصطنعة.
- تتذكر وتراعي كامل سياق الحوار من أوله لآخره حتى تكون إجاباتك متسلسلة ومنطقية ودقيقة هندسياً.
- تخصصك: دراسة الأسواق، أسعار المنافسين، تسعير المنتجات (جملة وقطاعي)، حساب التكاليف ونسب الهالك، أوقات العمل اليدوي، تحليل أبعاد ونسب الموديلات، وابتكار الباترونات وخطوات التشغيل.
- الحرف المفعّلة في الورشة: [${safeSelectedCrafts.join('، ')}] | الدولة: ${safeCountry} | العملة: ${safeCurrency} | التصنيف: ${safeCategory}.
${artistName ? `- تنادي الصانع باسمه الودود: ${artistName}.` : ''}${memoryPrompt ? `\n\n${memoryPrompt}` : ''}`;

    const userPromptText = actionChip ? `استفسار حول [${actionChip}]: ${message || 'يرجى تقديم التوجيه الهندسي ودراسة السوق.'}` : message;
    const { primary: groqPrimary, secondary: groqSecondary } = getGroqKeys();
    let geminiFailReason = '';
    let groqFailReason = '';

    // -------------------------------------------------------------
    // Provider 1: Google Gemini Flash (المحرك الأساسي للأدوات والرؤية والبحث)
    // -------------------------------------------------------------
    if (process.env.GEMINI_API_KEY || this.ai) {
      console.log('[AI Service: Falcon] Attempting Provider 1 (Gemini Flash)...');
      try {
        const contents: any[] = chatHistory.slice(-10).map((m) => ({
          role: m.sender === 'user' || m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text || m.content || '' }],
        }));
        contents.push({ role: 'user', parts: [{ text: userPromptText }] });

        const lowerQuery = userPromptText.toLowerCase();
        const needsSearch = ['سعر', 'أسعار', 'سوق', 'مورد', 'تريند', 'منافس'].some((k) => lowerQuery.includes(k));

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
              { label: 'chat-search', timeoutMs: 25_000 }
            );
            searchUsed = true;
          } catch (searchErr: any) {
            console.warn('[Falcon] Gemini search tools notice, falling back to pure text:', searchErr?.message);
            markSearchQuotaExhausted();
            response = await this.generate(
              { contents, config: { systemInstruction: { parts: [{ text: systemInstruction }] } } },
              { label: 'chat-fallback-no-search', timeoutMs: 25_000 }
            );
          }
        } else {
          response = await this.generate(
            { contents, config: { systemInstruction: { parts: [{ text: systemInstruction }] } } },
            { label: 'chat', timeoutMs: 25_000 }
          );
        }

        const candidate = response?.candidates?.[0];
        const grounding = candidate?.groundingMetadata;
        if (grounding?.groundingChunks) {
          for (const chunk of grounding.groundingChunks) {
            if (chunk.web?.uri) searchSources.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
          }
        }

        const reply = response?.text?.trim();
        if (reply) {
          console.log('[AI Service: Falcon] Provider 1 (Gemini Flash) succeeded.');
          return { reply, sources: searchSources.slice(0, 4), searchUsed };
        }
        geminiFailReason = 'رد فارغ من Gemini Flash';
      } catch (geminiErr: any) {
        geminiFailReason = geminiErr?.message || 'فشل الاتصال بـ Gemini Flash';
        console.warn(
          `[AI Service: Falcon] Provider 1 (Gemini Flash) failed: [${geminiFailReason}] -> Switching to Provider 2 (Groq Backup)...`
        );
      }
    } else {
      geminiFailReason = 'GEMINI_API_KEY غير متوفر على الخادم';
      console.log(`[AI Service: Falcon] Provider 1 (Gemini Flash) skipped: ${geminiFailReason} -> Switching to Provider 2 (Groq Backup)...`);
    }

    // -------------------------------------------------------------
    // Provider 2: Groq (المحرك البديل للنصوص السريعة)
    // -------------------------------------------------------------
    const groqKey = groqPrimary || groqSecondary;
    if (groqKey) {
      console.log('[AI Service: Falcon] Attempting Provider 2 (Groq Backup)...');
      try {
        const groqReply = await callGroqFallback(systemInstruction, chatHistory, userPromptText, groqKey);
        if (groqReply) {
          console.log('[AI Service: Falcon] Switching to Provider 2 (Groq Backup)... Success!');
          return { reply: groqReply, sources: [], searchUsed: false };
        }
        groqFailReason = 'رد فارغ من مزود Groq';
      } catch (groqErr: any) {
        groqFailReason = groqErr?.message || 'فشل الاتصال بـ Groq';
        console.error(`[AI Service: Falcon] Provider 2 (Groq) failed: [${groqFailReason}]`);
      }
    } else {
      groqFailReason = 'GROQ_API_KEY غير متوفر على الخادم';
    }

    // -------------------------------------------------------------
    // منع الردود الصامتة والوهمية (No Silent Mock Fallbacks)
    // -------------------------------------------------------------
    console.error(`[AI Service: Falcon] Both providers failed! Provider 1 (Gemini): ${geminiFailReason} | Provider 2 (Groq): ${groqFailReason}`);

    throw new Error(
      `تعذر اتصال مستشار الورشة (صقر): فشل المزود الأساسي (Gemini Flash: ${geminiFailReason}) وفشل المزود البديل (Groq: ${groqFailReason}). يرجى التحقق من اتصال الإنترنت ومفاتيح التشغيل.`
    );
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

export { isSuperAdmin };