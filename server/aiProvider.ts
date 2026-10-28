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

// قاطع دارة (Circuit Breaker) لكبح استدعاءات البحث عند استنزاف الحصة (429 RESOURCE_EXHAUSTED)
let searchQuotaExhaustedUntil = 0;

function isSearchQuotaCoolingDown(): boolean {
  return Date.now() < searchQuotaExhaustedUntil;
}

function markSearchQuotaExhausted(): void {
  // تفعيل التهدئة لمدة دقيقتين لمنع تكرار الخطأ وإرهاق الحصة
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

/** رسالة عربية واضحة + كود HTTP مناسب لكل نوع خطأ */
export function falconErrorResponse(err: any): { status: number; error: string } {
  switch (err?.kind as GeminiErrorKind | undefined) {
    case 'timeout':
      return { status: 504, error: 'صقر اتأخر في الرد بسبب ضغط على الخدمة. جرّب تاني بعد دقيقة، أو اختصر سؤالك.' };
    case 'quota':
      return { status: 503, error: 'الحصة المجانية لصقر خلصت مؤقتاً (حد الدقيقة أو اليوم من جوجل). جرّب بعد دقيقة.' };
    case 'unavailable':
      return { status: 503, error: 'خدمة الذكاء الاصطناعي مضغوطة دلوقتي. جرّب تاني بعد شوية.' };
    case 'bad_key':
      return { status: 503, error: 'مفتاح Gemini على السيرفر غير صالح أو غير مفعّل. راجع Secrets في AI Studio.' };
    default:
      return { status: 502, error: 'تعذر الرد، حاول مرة أخرى.' };
  }
}

export class GeminiAIProvider {
  private ai: GoogleGenAI | null = null;
  private modelName: string;
  private fallbackModel: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    // Default model from GEMINI_MODEL with a valid default fallback
    this.modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    // موديل احتياطي بحصة مجانية منفصلة: يشتغل تلقائياً لو الأساسي اتأخر أو حصته خلصت
    this.fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';

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

  /**
   * الخطوة 1 (بلا بحث): تحليل الصورة بإخراج JSON هندسي متقن لكافة أنواع الهاند ميد
   * وحساب المصنعية = الساعات × أجر الساعة الداخلي للورشة (دون إظهار رقم الأجر في الواجهة).
   *
   * الخطوة 2 (ببحث): البحث عن أسعار منتج مشابه في دولة وعملة المستخدم، مع معالجة ذكية لحصة البحث 429.
   */
  /**
   * استدعاء Gemini بحماية من التعليق:
   * - مهلة قصوى لكل محاولة (AbortSignal) بدل ما الطلب يفضل معلق دقايق.
   * - تفكير منخفض لموديلات Gemini 3 (أسرع بكتير في الرد).
   * - لو الموديل الأساسي اتأخر/حصته خلصت/مضغوط => تحويل فوري للموديل الاحتياطي.
   */
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
      let useLowThinking = /^gemini-3/.test(model) && !req.config?.thinkingConfig;

      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const started = Date.now();
        try {
          const response = await this.ai.models.generateContent({
            model,
            contents: req.contents,
            config: {
              ...(req.config || {}),
              ...(useLowThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
              abortSignal: controller.signal,
            },
          });
          clearTimeout(timer);
          if (i > 0) console.warn(`[Falcon] ${opts.label}: answered by fallback model ${model}`);
          return response;
        } catch (err: any) {
          clearTimeout(timer);
          const kind = classifyGeminiError(err, controller.signal.aborted);
          console.warn(`[Falcon] ${opts.label}: ${model} failed (${kind}) after ${Date.now() - started}ms: ${String(err?.message || err).slice(0, 200)}`);
          lastErr = Object.assign(err instanceof Error ? err : new Error(String(err)), { kind });
          // لو الموديل رفض إعداد التفكير نعيد نفس الموديل بدونه
          if (useLowThinking && kind === 'bad_request' && /thinking/i.test(String(err?.message))) {
            useLowThinking = false;
            continue;
          }
          break;
        }
      }
      if (!['timeout', 'quota', 'unavailable'].includes(lastErr?.kind)) break; // أخطاء غير مؤقتة: لا داعي للاحتياطي
    }
    throw lastErr;
  }

  async analyzeCraftVision(input: AIVisionPromptInput): Promise<any> {
    if (!this.ai) {
      throw new Error('مفتاح GEMINI_API_KEY غير مضبوط على الخادم');
    }

    const { imageBase64, mimeType = 'image/jpeg', artistNotes = '', workshopContext = {} } = input;
    const activeCrafts = Array.isArray(workshopContext.activeCrafts) ? workshopContext.activeCrafts : ['macrame'];
    const country = workshopContext.country || 'جمهورية مصر العربية';
    const currency = workshopContext.currency || 'ج.م';
    const hourlyRate =
      workshopContext.hourlyRate !== undefined && workshopContext.hourlyRate !== null && !isNaN(Number(workshopContext.hourlyRate))
        ? Number(workshopContext.hourlyRate)
        : 30;

    // تنظيف Base64
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

    // -------------------------------------------------------------
    // الخطوة 1: تحليل الصورة بالرؤية الحاسوبية بلا بحث (Pure Vision & JSON Schema)
    // يدعم كافة أنواع الهاند ميد (مكرمية، كروشيه، ريزن، خزف، خشب، جلود، إلخ)
    // -------------------------------------------------------------
    const step1Prompt = `أنت "صقر الشمساوية"، المساعد الذكي والخبير الهندسي الشامل لكافة صناعات وحرف الهاند ميد (المكرمية، الكروشيه والتريكو، الريزن، الخزف والصلصال الحراري، الأعمال الخشبية، التطريز، الشموع والصابون، والجلود والإكسسوارات).
مهمتك تحليل صورة هذه القطعة الحرفية بدقة هندسية عالية وتحديد خاماتها وطريقة تصنيعها:
الحِرف المفعّلة في الورشة: [${activeCrafts.join('، ')}].

القواعد الصارمة:
1. اختر التصنيف الأنسب من هذه القائمة الحصرية فقط:
["رانر", "ستائر", "سجاد", "كوشن", "جدارية", "بوف", "كرسي", "أرجوحة", "نجف وإضاءة", "شنطة أو كلاتش"]
(إن كانت القطعة من حرفة أخرى مثل صواني ريزن أو أواني خزفية فاختر أقرب تصنيف ملائم كـ "جدارية" أو "رانر" أو "نجف وإضاءة" مع توضيح الخامة في الملاحظات).
2. قدّر ساعات العمل اليدوي الصافي (estimatedHours) كرقم عشري منطقي.
3. قدّر الأبعاد المقترحة المناسبة (العرض بالسنتيمتر، الطول الكلي، طول الشراشيب/السمك، وشكل القطعة).
4. اكتب خطوات التنفيذ الحرفية المنظمة خطوة بخطوة باللغة العربية الدافئة.
5. اذكر قائمة بأسماء العقد أو التقنيات أو الأدوات المستخدمة في التصنيع.
6. أنشئ كود رسم بياني تخطيطي للباترون بصيغة SVG نظيفة (<svg viewBox="0 0 300 200" ...>...</svg>).
7. لخص ملاحظات هندسية للحرفي لنقلها لحاسبة الإنتاج.

أخرج الإجابة فقط بتنسيق JSON نظيف تماماً:
{
  "detectedCategory": "string",
  "estimatedHours": number,
  "suggestedDimensions": {
    "width": number,
    "totalLength": number,
    "fringeLength": number,
    "cordThickness": number,
    "shape": "flat" | "circle" | "cylinder" | "square"
  },
  "productionGuide": ["string"],
  "stitchPatterns": ["string"],
  "svgSchematic": "<svg ...</svg>",
  "notesForCalculator": "string"
}`;

    const step1Parts = [
      {
        inlineData: {
          mimeType: resolvedMimeType,
          data: cleanBase64,
        },
      },
      { text: step1Prompt + (artistNotes ? `\nملاحظات إضافية من الفنان: ${artistNotes}` : '') },
    ];

    let step1Response = await this.generate(
      { contents: { parts: step1Parts } },
      { label: 'vision', timeoutMs: 40_000, fallbackTimeoutMs: 30_000 }
    );

    const step1Text = step1Response.text || '';
    const cleanJsonText = step1Text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`تعذر استخراج بيانات التحليل الفني من الصورة: ${step1Text.slice(0, 100)}`);
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    // التأكد من حصرية التصنيف
    const allowedCategories = [
      'رانر',
      'ستائر',
      'سجاد',
      'كوشن',
      'جدارية',
      'بوف',
      'كرسي',
      'أرجوحة',
      'نجف وإضاءة',
      'شنطة أو كلاتش',
    ];
    if (!allowedCategories.includes(parsedData.detectedCategory)) {
      parsedData.detectedCategory = 'جدارية';
    }

    // حساب المصنعية في السيرفر (الساعات × أجر الساعة في الورشة)
    const hours = Number(parsedData.estimatedHours) || 4;
    parsedData.estimatedHours = hours;
    parsedData.estimatedLaborWage = Math.round(hours * hourlyRate);

    // -------------------------------------------------------------
    // الخطوة 2: بحث أسعار السوق مع حماية من 429 RESOURCE_EXHAUSTED
    // -------------------------------------------------------------
    let minPrice = 0;
    let avgPrice = 0;
    let maxPrice = 0;
    let isEstimatedPricing = false;
    let searchSources: Array<{ title: string; url: string }> = [];
    let searchEntryPoint: string | undefined = undefined;

    // إذا كانت حصة البحث مستنزفة حالياً، نعتمد التقدير الفوري الذكي لتجنب إلقاء خطأ 429
    if (isSearchQuotaCoolingDown()) {
      isEstimatedPricing = true;
    } else {
      try {
        const searchPrompt = `أنت "صقر الشمساوية"، المساعد الذكي لمنصة الشمس كرافت.
ابحث في الإنترنت والأسواق المحلية الموثوقة عن أسعار بيع مشغولات هاند ميد وحرف يدوية من تصنيف "${parsedData.detectedCategory}" في دولة "${country}" بالعملة "${currency}".
استخرج الأسعار الواقعية للمنافسين والمتاجر:
- أقل سعر معتاد (minMarketPrice)
- السعر المتوسط الشائع (avgMarketPrice)
- أعلى سعر قطاعي فاخر (maxMarketPrice)

أخرج النتيجة بصيغة JSON نظيفة فقط:
{
  "minMarketPrice": number,
  "avgMarketPrice": number,
  "maxMarketPrice": number
}`;

        const step2Response = await this.generate(
          { contents: searchPrompt, config: { tools: [{ googleSearch: {} }] } },
          { label: 'vision-search', timeoutMs: 20_000, noFallback: true }
        );

        const cand = step2Response.candidates?.[0];
        const grounding = cand?.groundingMetadata;

        if (grounding?.groundingChunks) {
          for (const chunk of grounding.groundingChunks) {
            if (chunk.web?.uri) {
              searchSources.push({
                title: chunk.web.title || chunk.web.uri,
                url: chunk.web.uri,
              });
            }
          }
        }

        if (grounding?.searchEntryPoint?.renderedContent) {
          searchEntryPoint = grounding.searchEntryPoint.renderedContent;
        }

        const step2Text = step2Response.text || '';
        const cleanStep2Json = step2Text
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        const match2 = cleanStep2Json.match(/\{[\s\S]*\}/);

        if (match2) {
          const prices = JSON.parse(match2[0]);
          minPrice = Number(prices.minMarketPrice) || 0;
          avgPrice = Number(prices.avgMarketPrice) || 0;
          maxPrice = Number(prices.maxMarketPrice) || 0;
        }

        if (!minPrice && !avgPrice && !maxPrice) {
          isEstimatedPricing = true;
        }
      } catch (searchErr: any) {
        const errStr = String(searchErr?.message || searchErr);
        if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota')) {
          markSearchQuotaExhausted();
        }
        isEstimatedPricing = true;
      }
    }

    // إذا فشل البحث أو لم تتوفر أرقام مؤكدة، نرجع أرقاماً تقديرية محسوبة مع علامة estimated: true
    if (isEstimatedPricing || (minPrice === 0 && avgPrice === 0 && maxPrice === 0)) {
      isEstimatedPricing = true;
      avgPrice = Math.max(100, Math.round(parsedData.estimatedLaborWage * 2.2));
      minPrice = Math.round(avgPrice * 0.75);
      maxPrice = Math.round(avgPrice * 1.5);

      parsedData.notesForCalculator =
        (parsedData.notesForCalculator ? parsedData.notesForCalculator + '\n' : '') +
        '(ملاحظة: أسعار السوق تقدير تقريبي وليست بحثاً مؤكداً)';
    }

    parsedData.competitionPricing = {
      minMarketPrice: minPrice,
      avgMarketPrice: avgPrice,
      maxMarketPrice: maxPrice,
      estimated: isEstimatedPricing,
    };

    parsedData.sources = searchSources;
    parsedData.searchEntryPoint = searchEntryPoint;

    return parsedData;
  }

  /**
   * استدعاء الدردشة مع "صقر الشمساوية"
   * - خبير بكافة فنون وصناعات الهاند ميد (مكرمية، كروشيه، ريزن، خزف، خشب، جلود، إلخ).
   * - حماية من أخطاء حصة البحث 429 RESOURCE_EXHAUSTED بالرجوع السلس للنموذج بدون أداة البحث.
   * - خصوصية تامة: لا يُرسل سوى الحِرف والدولة والعملة وتصنيف المنتج.
   * - معالجة سجل المحادثة (بدء بأول رسالة user وأخذ آخر 12 رسالة).
   */
  async chatWithAgent(input: AIChatPromptInput): Promise<AIChatResult> {
    if (!this.ai) {
      throw new Error('مفتاح GEMINI_API_KEY غير مضبوط على الخادم');
    }

    const { message, actionChip, chatHistory, workshopContext } = input;

    // الخصوصية: إرسال الحِرف والدولة والعملة وتصنيف المنتج فقط
    const safeSelectedCrafts = Array.isArray(workshopContext.selectedCrafts)
      ? workshopContext.selectedCrafts
      : ['macrame'];
    const safeCountry = workshopContext.country || 'جمهورية مصر العربية';
    const safeCurrency = workshopContext.currency || 'ج.م';
    const safeCategory = workshopContext.category || 'عام';

    // 5) و 6) هوية صقر الشمساوية الشاملة لكافة الحرف اليدوية والمشغولات الفنية
    const systemInstruction = `أنت "صقر الشمساوية"، المساعد الذكي والخبير الهندسي والحسابي الأول لمنصة الشمس كرافت.
أنت خبير متخصص في كافة الحرف اليدوية والمشغولات الفنية (وليس فقط المكرمية):
- فنون وتشكيل المكرميات والخيوط والجداريات
- الكروشيه، التريكو، والغزل الحرفي
- فن الريزن (Resin Art)، الصب، القوالب السيليكون، ودمج الألوان
- الخزف، الفخار، والصلصال الحراري (Polymer Clay)
- التطريز اليدوي، فن الخيامية، والباتشورك
- الجلود الطبيعية، الخياطة اليدوية، والمنتجات الجلدية
- صناعة الشموع المعطرة والصابون الطبيعي
- إكسسوارات الخرز، المجوهرات، والحلي اليدوية
- الأعمال الخشبية، فن الأركت، الديكوباج، والـ String Art
- النجف والإضاءة الحرفية والديكورات والتحف المنزلية

القواعد الصارمة:
- عرّف نفسك دائماً وبكل فخر كخبير متخصص في "كافة الحرف اليدوية والمشغولات الفنية" ولا تقصر خبرتك أبداً على المكرمية أو الجداريات فقط.
- إذا رحّب بك المستخدم أو استفسر عن هويتك أو مجالات خبرتك، أجب بترحيب دافئ يؤكد تخصصك الشامل في كافة الحرف اليدوية والمشغولات الفنية مع تقديم المشورة الفورية.
- ممنوع ذكر أي اسم نموذج ذكاء اصطناعي، أو أي شركة تقنية مزوّدة، أو أي رقم إصدار برمجي في أي رد على الإطلاق.
- لا تدّعِ أنك إنسان؛ وإذا سُئلت مباشرة هل أنت ذكاء اصطناعي فقل بجملة بسيطة وواضحة إنك "مساعد ذكي لمنظومة الشمس كرافت".
- أجب أولاً عن سؤال المستخدم الفعلي بشكل مباشر ومنطقي وبالعربية الدافئة والمهنية الحرفية، ثم أضف ما يفيد من نصائح وتوجيهات تصنيعية وتسويقية.
- إن نقصت معلومة جوهرية فاسأل سؤالاً توضيحياً واحداً محدداً ومباشراً في نهاية ردك.
- لا تخترع أرقاماً أو معلومات من وحي الخيال مطلقاً؛ وأي رقم تذكره بلا مصدر بحثي مؤكد يجب أن تصرّح بأنه "تقدير تقريبي".

بيانات الورشة المسموح بها فقط:
- الحِرف المفعّلة: [${safeSelectedCrafts.join('، ')}]
- الدولة: ${safeCountry}
- العملة: ${safeCurrency}
- تصنيف المشغولات الحالي: ${safeCategory}`;

    // 4) سجل الدردشة: تحويل أي صيغة إلى {role:'user'|'model', parts:[{text}]}
    const rawHistory = Array.isArray(chatHistory) ? chatHistory : [];
    const mappedHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const m of rawHistory) {
      if (!m) continue;
      const role: 'user' | 'model' =
        m.role === 'model' || m.sender === 'falcon' || m.sender === 'model' || m.sender === 'assistant'
          ? 'model'
          : 'user';

      let text = '';
      if (Array.isArray(m.parts) && m.parts.length > 0) {
        text = m.parts.map((p: any) => p?.text || '').join('\n').trim();
      } else if (typeof m.text === 'string') {
        text = m.text.trim();
      } else if (typeof m.message === 'string') {
        text = m.message.trim();
      }

      if (text) {
        mappedHistory.push({
          role,
          parts: [{ text }],
        });
      }
    }

    // حذف أي رسائل model في البداية حتى تبدأ بأول رسالة user
    while (mappedHistory.length > 0 && mappedHistory[0].role === 'model') {
      mappedHistory.shift();
    }

    // أخذ آخر 12 رسالة فقط
    const recentHistory = mappedHistory.slice(-12);

    const contents: any[] = [...recentHistory];
    const userPromptText = actionChip
      ? `الاستفسار السريع حول [${actionChip}]: ${message || 'يرجى تقديم التوجيه الفني المتخصص.'}`
      : message;

    contents.push({
      role: 'user',
      parts: [{ text: userPromptText }],
    });

    // 8) تحديد ما إذا كان السؤال يحتاج لبحث موثوق
    const lowerQuery = (userPromptText + ' ' + (actionChip || '')).toLowerCase();
    const needsSearch =
      lowerQuery.includes('سعر') ||
      lowerQuery.includes('أسعار') ||
      lowerQuery.includes('مورد') ||
      lowerQuery.includes('سوق') ||
      lowerQuery.includes('تريند') ||
      Boolean(actionChip?.includes('أسواق'));

    let response: any = null;
    let searchUsed = false;
    let searchSources: Array<{ title: string; url: string }> = [];
    let searchEntryPoint: string | undefined = undefined;

    // نحاول تشغيل أداة البحث فقط إذا لم تكن حصة البحث تحت التهدئة
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
          { label: 'chat-search', timeoutMs: 25_000, noFallback: true }
        );
        searchUsed = true;
      } catch (searchErr: any) {
        const errStr = String(searchErr?.message || searchErr);
        if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota')) {
          markSearchQuotaExhausted();
        }
        // 11) إن فشل البحث أو استنزفت الحصة فأعد الطلب بدونه بسلاسة وهدوء
        response = await this.generate(
          { contents, config: { systemInstruction: { parts: [{ text: systemInstruction }] } } },
          { label: 'chat-after-search', timeoutMs: 20_000, fallbackTimeoutMs: 15_000 }
        );
      }
    } else {
      // استجابة مباشرة بلا بحث إضافي لحماية الحصة وضمان سرعة الرد
      response = await this.generate(
        { contents, config: { systemInstruction: { parts: [{ text: systemInstruction }] } } },
        { label: 'chat', timeoutMs: 25_000, fallbackTimeoutMs: 20_000 }
      );
    }

    // استخراج بيانات التأريض إن وُجدت
    const candidate = response?.candidates?.[0];
    const grounding = candidate?.groundingMetadata;
    if (grounding?.groundingChunks) {
      for (const chunk of grounding.groundingChunks) {
        if (chunk.web?.uri) {
          searchSources.push({
            title: chunk.web.title || chunk.web.uri,
            url: chunk.web.uri,
          });
        }
      }
    }

    if (grounding?.searchEntryPoint?.renderedContent) {
      searchEntryPoint = grounding.searchEntryPoint.renderedContent;
    }

    let reply = response?.text?.trim() || '';
    if (!reply) {
      reply = 'عذراً يا فنان، تعذر استخراج رد واضح على سؤالك حالياً، يرجى المحاولة مرة أخرى.';
    }

    // إذا كان السؤال تطلب بحثاً ولكن تم التقدير بدون بحث مؤكد، نوضح ذلك بلباقة
    if (needsSearch && (!searchUsed || searchSources.length === 0)) {
      if (!reply.includes('تقدير تقريبي وليست بحثاً مؤكداً') && !reply.includes('تقدير')) {
        reply += '\n\n*(ملاحظة: المعلومات والأسعار المذكورة أعلاه هي تقدير تقريبي وليست بحثاً مؤكداً)*';
      }
    }

    return {
      reply,
      sources: searchSources.slice(0, 5),
      searchUsed,
      searchEntryPoint,
    };
  }
}

export const aiProvider = new GeminiAIProvider();

/**
 * -------------------------------------------------------------
 * إدارة وتخزين جلسة المحادثة وسجل الدردشة مؤقتاً لكل ورشة
 * مع استبعاد البيانات المالية والحساسة (الأرصدة، الرموز، والكلمات السرية)
 * -------------------------------------------------------------
 */
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

// تخزين مؤقت لجلسات الدردشة في ذاكرة السيرفر (Session Cache)
const workshopSessionsCache = new Map<string, WorkshopSessionState>();

// مدة بقاء الجلسة في التخزين المؤقت: 48 ساعة
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * دالة استبعاد البيانات المالية والأمنية الحساسة من سجل المحادثة قبل التخزين
 */
export function sanitizeChatHistoryForStorage(messages: any[]): SanitizedSessionMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((m) => Boolean(m && typeof m === 'object'))
    .map((m) => {
      // استبعاد أي حقول مالية أو أمنية حساسة
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
    .slice(-40); // الاحتفاظ بآخر 40 رسالة لتجنب التضخم وسرعة التحميل
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
