import { GoogleGenAI } from '@google/genai';
import {
  isSuperAdmin,
  processTrainingInteraction,
  buildGlobalMemoryPrompt,
} from './aiGlobalMemory.js';
import {
  resolveAgentGeminiKey,
  createGeminiClientForAgent,
  getCandidateGeminiModels,
  extractGroundingMetadata,
  shouldTriggerGoogleSearch,
} from './googleSearchService.js';

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
  useSearch?: boolean;
  images?: Array<{ base64: string; mimeType?: string; name?: string }>;
  workshopContext: {
    selectedCrafts?: string[];
    country?: string;
    currency?: string;
    category?: string;
    artistName?: string;
    brandName?: string;
    userEmail?: string;
    isSuperAdmin?: boolean;
    hourlyRate?: number;
    liveLiquidity?: number;
    lowMaterialsCount?: number;
    openWorkOrdersCount?: number;
    pendingOrdersCount?: number;
  };
}

export interface AIChatResult {
  reply: string;
  sources: Array<{ title: string; url: string }>;
  searchUsed: boolean;
  searchEntryPoint?: string;
  inTrainingMode?: boolean;
  visionAnalysis?: any;
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
  private getClient(): GoogleGenAI {
    return createGeminiClientForAgent('falcon');
  }

  isAvailable(): boolean {
    return Boolean(resolveAgentGeminiKey('falcon'));
  }

  private async generate(
    req: { contents: any; config?: any },
    opts: { label: string; timeoutMs: number }
  ): Promise<any> {
    const ai = this.getClient();
    const uniqueModels = getCandidateGeminiModels();
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
            ai.models.generateContent({
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
          const isTransient503 = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
          console.log(`[Falcon Gemini] Notice on ${model} (attempt ${attempt}): ${isTransient503 ? 'temporary demand spike (503)' : 'trying fallback'}`);
          if (isTransient503 && attempt === 1) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          break;
        }
      }
    }

    const kind = classifyGeminiError(lastError, false);
    throw Object.assign(lastError instanceof Error ? lastError : new Error(String(lastError)), { kind });
  }

  async analyzeCraftVision(input: AIVisionPromptInput): Promise<any> {
    if (!this.isAvailable()) throw new Error('مفتاح Gemini الخاص بصقر غير مضبوط على الخادم');

    const { imageBase64, mimeType = 'image/jpeg', artistNotes = '', workshopContext = {} } = input;
    const activeCrafts = Array.isArray(workshopContext.activeCrafts) ? workshopContext.activeCrafts : ['macrame'];
    const country = workshopContext.country || 'جمهورية مصر العربية';
    const currency = workshopContext.currency || 'ج.م';
    const hourlyRate = Number(workshopContext.hourlyRate) || 35;

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

    const prompt = `أنت "صقر الشمساوية" 🦅، المستشار الرسمي للحسابات والتكاليف والتسعير ودراسة الأسواق في منظومة الشمساوية التابعة لشركة الشمس كرافت.
قم بالتحليل الهندسي الدقيق لصورة المشغولة اليدوية واستخرج الأبعاد والتكاليف وسعر البيع في السوق المصري:
الحِرف المفعّلة في الورشة: [${activeCrafts.join('، ')}] | الدولة: ${country} | العملة: ${currency} | أجر الساعة: ${hourlyRate}.

القواعد الهندسية:
1. فحص وقراءة الأبعاد:
   - افحص أي مقاسات أو أبعاد مكتوبة داخل الصورة أو الملاحظات (مثلاً: أطقم بوكسات 4 مقاسات 40×30×15 حتى 20×15×10).
   - إذا لم تكن الأبعاد مكتوبة، قدّر الأبعاد هندسياً كنسبة وتناسب واقعية من شكل القطعة.
2. تفنيد مستلزمات الإنتاج:
   - خامات الهيكل (شاسيه حديد، خشب، قواعد).
   - أطوال وأوزان الخيوط والغرز ونسبة هالك التشغيل الفعلي (10% - 15%).
   - حساب إجمالي التكلفة التقديرية بدقة.
   - تحديد سعر البيع العادل (سعر الجملة وسعر القطاعي) في مصر.

أخرج النتيجة بصيغة JSON نظيفة فقط:
{
  "detectedCategory": "string",
  "craftType": "macrame" | "crochet" | "zigzag" | "kilim" | "punch_needle" | "tufting",
  "estimatedHours": number,
  "suggestedDimensions": { "width": number, "totalLength": number, "fringeLength": number, "cordThickness": number, "shape": "flat" },
  "productionGuide": ["string"],
  "stitchPatterns": ["string"],
  "svgSchematic": "<svg viewBox=\\"0 0 300 200\\"></svg>",
  "competitionPricing": {
    "minMarketPrice": number,
    "avgMarketPrice": number,
    "maxMarketPrice": number,
    "recommendedFairPrice": number,
    "estimated": true
  },
  "notesForCalculator": "string"
}`;

    const parts = [
      { inlineData: { mimeType: resolvedMimeType, data: cleanBase64 } },
      { text: prompt + (artistNotes ? `\nملاحظات وتوجيهات الفنان: ${artistNotes}` : '') },
    ];

    const response = await this.generate(
      { contents: { parts } },
      { label: 'vision-direct', timeoutMs: 20_000 }
    );

    const responseText = response.text || '';
    const cleanJsonText = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('تعذر استخراج بيانات التحليل الهندسي للصورة.');

    const parsedData = JSON.parse(jsonMatch[0]);
    const hours = Number(parsedData.estimatedHours) || 3;
    parsedData.estimatedHours = hours;
    parsedData.estimatedLaborWage = Math.round(hours * hourlyRate);

    if (!parsedData.craftType) {
      parsedData.craftType = 'macrame';
    }

    if (!parsedData.competitionPricing) {
      const avgPrice = Math.max(120, Math.round(parsedData.estimatedLaborWage * 2.2));
      parsedData.competitionPricing = {
        minMarketPrice: Math.round(avgPrice * 0.75),
        avgMarketPrice: avgPrice,
        maxMarketPrice: Math.round(avgPrice * 1.5),
        recommendedFairPrice: avgPrice,
        estimated: true,
      };
    }

    parsedData.sources = [];
    return parsedData;
  }

  private extractStructuredPricingFromReply(reply: string, category: string, hourlyRate = 35) {
  const hoursMatch = reply.match(/(?:ساعات|ساعة|الوقت|استغراق)[\s:*-]*([0-9]+(?:\.[0-9]+)?)/i);
  const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 3;

  const costMatch = reply.match(/(?:إجمالي التكلفة|التكلفة التقديرية|التكلفة الإجمالية|تكلفة الخامات)[\s:*-]*([0-9]+(?:\.[0-9]+)?)/i);
  const estCost = costMatch ? parseFloat(costMatch[1]) : 150;

  const wholesaleMatch = reply.match(/(?:سعر الجملة|الجملة)[\s:*-]*([0-9]+(?:\.[0-9]+)?)/i);
  const retailMatch = reply.match(/(?:سعر القطاعي|القطاعي|سعر البيع)[\s:*-]*([0-9]+(?:\.[0-9]+)?)/i);

  const minMarket = wholesaleMatch ? parseFloat(wholesaleMatch[1]) : Math.round(estCost * 1.25);
  const avgMarket = retailMatch ? parseFloat(retailMatch[1]) : Math.round(estCost * 1.60);
  const maxMarket = Math.round(avgMarket * 1.25);

  const isCrochet = /كروشيه|سنارة|خيط كليم|قاعدة خشب/i.test(reply);
  const isZigzag = /زجزاج|حلزون|حبل قطن محشي|ماكينة/i.test(reply);
  const isKilim = /كليم|نول|سداء|لحمة/i.test(reply);
  const isPunch = /بانش|رهبان|طارة|إبرة الشرقية/i.test(reply);
  const isTufting = /تافت|سجاد|مسدس|وبرة/i.test(reply);

  let craftType = 'macrame';
  if (isCrochet) craftType = 'crochet';
  else if (isZigzag) craftType = 'zigzag';
  else if (isKilim) craftType = 'kilim';
  else if (isPunch) craftType = 'punch_needle';
  else if (isTufting) craftType = 'tufting_gun';

  return {
    detectedCategory: category || 'مشغولات يدوية',
    craftType,
    estimatedHours: hours,
    estimatedLaborWage: Math.round(hours * hourlyRate),
    competitionPricing: {
      minMarketPrice: minMarket,
      avgMarketPrice: avgMarket,
      maxMarketPrice: maxMarket,
      recommendedFairPrice: avgMarket,
      estimated: true,
    },
    notesForCalculator: reply.slice(0, 300),
  };
}

  async chatWithAgent(input: AIChatPromptInput): Promise<AIChatResult> {
    const { message, actionChip, chatHistory, workshopContext, images } = input;
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

    const liveLiquidity = Number(workshopContext?.liveLiquidity || 0);
    const lowMaterialsCount = Number(workshopContext?.lowMaterialsCount || 0);
    const openWorkOrdersCount = Number(workshopContext?.openWorkOrdersCount || 0);
    const pendingOrdersCount = Number(workshopContext?.pendingOrdersCount || 0);
    const hourlyRate = Number(workshopContext?.hourlyRate) || 35;
    const workshopMetricsText = `\n- حالة الورشة وأرقامها الحية الآن: السيولة النقدية المتاحة: ${liveLiquidity.toLocaleString('ar-EG')} ${safeCurrency} | الخامات الناقصة: ${lowMaterialsCount} | أوامر التشغيل المفتوحة: ${openWorkOrdersCount} | الطلبيات المعلقة: ${pendingOrdersCount}.`;

    const memoryPrompt = await buildGlobalMemoryPrompt('falcon');
    const systemInstruction = `أنت "صقر الشمساوية" 🦅 — الخبير الهندسي والاستشاري الأول لحرفيي وصناع الهاند ميد والديكور في منظومة الشمساوية التابعة لشركة الشمس كرافت.

قواعد الخطاب والهوية المهنية الصارمة:
1. منع الديباجات التعريفية التلقائية:
   - يُمنع منعاً باتاً افتتاح الردود بديباجة تعريفية طويلة أو سرد تفاصيل البرمجة والتبعية في كل رسالة.
   - إذا سأل المستخدم تحية أولى أو ترحيباً فقط، يكون ردك في سطرين مبهجين باللهجة المصرية الحرفية:
     "يا صباح الفل يا فنان! 🦅
     جاهز ومستعد لمراجعة حساباتك وتكاليف شغلك.. قولي حابب نبدأ بإيه؟"
   - ادخل في صلب التحليل الهندسي والتسعير مباشرة وبلا مقدمات إنشائية فارغة.

2. قواعد الإفصاح عن الهوية والبرمجة (عند السؤال الصريح فقط):
   - فقط وحصرياً إذا سألك المستخدم صراحة: "أنت مين؟"، "مين برمجك؟"، "مين صانعك؟"، "مين طورك؟"، "مين اللي عملك؟"، تجيب بفخر واعتزاز بالصيغة المحددة دون زيادة أو نقصان:
     "أنا صقر في منظومة الشمساوية التابعة لشركة الشمس كرافت.. برمجتي وتغذيتي بالمعلومات والخبرة كلها تمت على يد الباشمهندس حسام بسيوني، كبير عيلة الشمساوية ومؤسس المنظومة، وهو اللي حطني في المكان ده عشان أكون سند لكل حرفي وفنان."
   - ممنوع تماماً ومطلقاً الادعاء بأنك تتبع أو تمثل أي شركة أو نموذج آخر مثل إي روبوت أو غيرها.
   - ممنوع تكرار هذه الديباجة أو ذكرها في أي سياق آخر ما لم يسألك المستخدم صراحة عنها!

3. شخصية صقر الحرفية:
   - خبير حكيم، قوي البصيرة، ذكي جداً، ودود، جدع وابن بلد يفهم دقائق الصنعة، مرح مرحاً راقياً بلا ابتذال، لا تبخل بأي معلومة أو نصيحة حرفية.
   - أنت من مواليد 24 نوفمبر 1979، ولديك خبرة حياتية وهندسية تمتد لعقود في كافة فنون الصناعات اليدوية والهاند ميد والديكور المنزلي (المكرمية، الكروشيه، الريزن، الخزف والفخار، الجلود الطبيعية، المشغولات الخشبية، الشموع والإكسسوارات).
   - لهجة الحديث الرسمية: اللهجة المصرية العامية الأصيلة والدافئة والذكية (المصري الحرفي الجدع)، وإذا كتب المستخدم بلغة أخرى تجيبه بلغته باحترافية.
   - تفهم وتستوعب الكلمات العامية المصرية، واصطلاحات الحرفيين، والأخطاء الإملائية وتفهم قصد الصانع بذكاء وبصيرة دون قيود مصطنعة.
   - تتذكر وتراعي كامل سياق الحوار من أوله لآخره حتى تكون إجاباتك متسلسلة ومنطقية ودقيقة هندسياً.

التحليل الهندسي التلقائي للصور وحساب التكاليف داخل رسالة الشات (In-Chat Vision Analysis):
عند استقبال صورة مشغولة يدوية أو طلب حساب تكلفة لأي من ورش [الحبال والنسيج]:
1. تمييز نوع الورشة الحرفية وتطبيق معادلتها الهندسية المعتمدة:
   * 🪢 المكرمية (Macrame): مضاعفات الـ 4، طول الفتلة = الطول × 4.8 + الشراشيب + 20 سم، هالك 10%.
   * 🧶 الكروشيه (Crochet): نوع القاعدة (خشبية مثقوبة ليزر وتكلفتها وثقوبها / خيط 0.40 جم/سم²)، جدران الارتفاع (المحيط × الارتفاع × 0.38 جم/سم²)، هالك 5%.
   * 🧵 الزجزاج (Zigzag): تمييز طبيعة المشغولة (مسطحة: مفرش/كوستر الجدران = 0، أو مجسمة 3D: سلة/منظم بارتفاع جدران، أو كلاتش مع بطانة وسوستة)، شكل القاعدة (دائرية πr² ومحيط 2πr، أو بيضاوية بمعادلة رامانوجان الدقيقة، أو مستطيلة L×W)، طول الحبل الصافي = إجمالي المساحة السطحية ÷ قطر الحبل، دوران وانحناء +8%، هالك 7%، خيط مكوك 3.6م/م حبل، وزن الحبل الخطي (قطن محشي 5-8 مم أو بوليستر).
   * 🪡 الكليم (Kilim): سداء قطن مبروم 100%، EPI = 4 خيوط/سم، فاقد النول 40 سم + انكماش 10%، صوف غزل مصبوغ 1.4 كجم/م²، هالك 15%.
   * 🎨 البانش نيدل (Punch Needle): قماش كانفاه مخرم عالي الجودة أو دك قطن مصري متين (+10 سم للطارة)، أمتار الصوف (30م لكل 10×10 سم)، غراء اللاتكس السائل للظهر 250 جم/م²، هالك 5%.
   * 🔫 مسدس التافت (Tufting): قماش التافت المسطر الأصلي (+0.20م للفريم)، قماش ظهر مانع للانزلاق، وبرة Cut Pile (2.1 كجم/م²) أو Loop Pile (1.8 كجم/م²)، غراء لاتكس أصلي 1.1 كجم/م²، هالك نحت 10%.

2. فحص وقراءة الأبعاد:
   - افحص فوراً الأبعاد والمقاسات المكتوبة داخل الصورة أو المذكورة في نص الرسالة بدقة (مثلاً: أطقم بوكسات 4 مقاسات من 40×30×15 حتى 20×15×10 سم).
   - إذا لم تكن الأبعاد مكتوبة أو مذكورة، قدّر الأبعاد هندسياً كنسبة وتناسب تقريبية وواقعية من واقع شكل وتناسق القطعة في الصورة.

3. حساب التكاليف والتسعير العادل:
   - تكلفة الخامات المباشرة الإجمالية مع احتساب نسبة الهالك المحددة للحرفة.
   - ساعات العمل ومصنعية اليد العادلة (بناءً على أجر ساعة الورشة: ${hourlyRate} ${safeCurrency}).
   - مصاريف التغليف والشحن والمصاريف الإدارية.
   - سعر الجملة المقترح للمشغولة (هامش 25% فوق التكلفة).
   - سعر القطاعي المقترح للمستهلك (هامش 60% فوق التكلفة).

4. الالتزام الصارم والنهائي:
   - اكتب كامل التحليل الهندسي والتسعير بوضوح وتفصيل منسق وجميل داخل رسالة الشات الحالية أولاً.
   - لا تحل المستخدم إلى شاشة الحاسبة أو تجبره على مغادرة الشات، فالتحليل يُكتب بالكامل هنا أولاً، وزر التصدير للحاسبة يظل خياراً يدوياً للمستخدم.

الحرف المفعّلة في الورشة: [${safeSelectedCrafts.join('، ')}] | الدولة: ${safeCountry} | العملة: ${safeCurrency} | التصنيف: ${safeCategory}.${workshopMetricsText}
${artistName ? `- تنادي الصانع باسمه الودود: ${artistName}.` : ''}${memoryPrompt ? `\n\n${memoryPrompt}` : ''}`;

    const userPromptText = actionChip ? `استفسار حول [${actionChip}]: ${message || 'يرجى تقديم التوجيه الهندسي ودراسة السوق.'}` : (message || '');
    const { primary: groqPrimary, secondary: groqSecondary } = getGroqKeys();
    let geminiFailReason = '';
    let groqFailReason = '';

    // -------------------------------------------------------------
    // Provider 1: Google Gemini + Google Search Grounding (المحرك الأساسي لصقر الشمساوية)
    // -------------------------------------------------------------
    if (this.isAvailable()) {
      console.log('[AI Service: Falcon] Attempting Provider 1 (Gemini + Google Search Grounding)...');
      try {
        const contents: any[] = chatHistory.slice(-10).map((m) => ({
          role: m.sender === 'user' || m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text || m.content || '' }],
        }));

        const userParts: any[] = [{ text: userPromptText || 'يرجى فحص وتحليل الصورة هندسياً وتقديم التوجيه الحرفي.' }];
        const hasImages = Array.isArray(images) && images.length > 0;
        if (hasImages) {
          for (const img of images) {
            if (img?.base64) {
              let cleanData = img.base64;
              let mime = img.mimeType || 'image/jpeg';
              const match = img.base64.match(/^data:([^;]+);base64,(.+)$/s);
              if (match) {
                mime = match[1].trim();
                cleanData = match[2].trim();
              } else {
                cleanData = cleanData.replace(/^data:[^,]+,/, '').trim();
              }
              cleanData = cleanData.replace(/\s+/g, '');
              userParts.push({
                inlineData: {
                  mimeType: mime,
                  data: cleanData,
                },
              });
            }
          }
        }
        contents.push({ role: 'user', parts: userParts });

        // تفعيل بحث جوجل الحي عند طلب السوق/الأسعار/الموردين أو تفعيل البحث صراحةً من الواجهة
        const needsSearch = !hasImages && shouldTriggerGoogleSearch(userPromptText, Boolean(input.useSearch));

        let response: any = null;
        let searchUsed = false;

        if (needsSearch) {
          try {
            response = await this.generate(
              {
                contents,
                config: {
                  systemInstruction,
                  tools: [{ googleSearch: {} }],
                },
              },
              { label: 'falcon-google-search', timeoutMs: 18_000 }
            );
            searchUsed = true;
          } catch (searchErr: any) {
            console.warn('[Falcon] Google Search grounding fallback notice:', searchErr?.message);
            response = await this.generate(
              { contents, config: { systemInstruction } },
              { label: 'falcon-chat-direct', timeoutMs: 16_000 }
            );
          }
        } else {
          response = await this.generate(
            { contents, config: { systemInstruction } },
            { label: hasImages ? 'falcon-vision' : 'falcon-chat', timeoutMs: hasImages ? 22_000 : 16_000 }
          );
        }

        const { sources: searchSources, searchEntryPoint } = extractGroundingMetadata(response);
        const reply = response?.text?.trim();
        if (reply) {
          console.log('[AI Service: Falcon] Provider 1 (Gemini) succeeded.', searchUsed ? `Sources: ${searchSources.length}` : '');
          const visionAnalysis = hasImages ? this.extractStructuredPricingFromReply(reply, safeCategory, hourlyRate) : undefined;
          return {
            reply,
            sources: searchSources.slice(0, 6),
            searchUsed: searchUsed || searchSources.length > 0,
            searchEntryPoint,
            visionAnalysis,
          };
        }
        geminiFailReason = 'رد فارغ من Gemini';
      } catch (geminiErr: any) {
        geminiFailReason = geminiErr?.message || 'فشل الاتصال بـ Gemini';
        console.warn(
          `[AI Service: Falcon] Provider 1 (Gemini) failed: [${geminiFailReason}] -> Switching to Provider 2 (Groq Backup)...`
        );
      }
    } else {
      geminiFailReason = 'مفتاح GEMINI_API_KEY_FALCON / GEMINI_API_KEY غير مضبوط في Secrets';
      console.log(`[AI Service: Falcon] Provider 1 (Gemini) skipped: ${geminiFailReason} -> Switching to Provider 2 (Groq Backup)...`);
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
    const sanitizeReason = (reason: string) => {
      if (!reason) return 'غير متاح حالياً';
      if (reason.includes('404') || reason.includes('does not exist') || reason.includes('model_not_found')) {
        return 'الموديل غير متاح مؤقتاً في المزود';
      }
      if (reason.includes('503') || reason.includes('high demand') || reason.includes('UNAVAILABLE')) {
        return 'ضغط مؤقت على خدمة الذكاء الاصطناعي';
      }
      if (reason.includes('timeout') || reason.includes('مهلة') || reason.includes('aborted')) {
        return 'تأخر استجابة الخادم بسبب بطء الاتصال';
      }
      return reason.replace(/\{.*?\}|https?:\/\/\S+/g, '').slice(0, 80).trim() || 'تعذر الاتصال بالخادم';
    };

    const cleanGemini = sanitizeReason(geminiFailReason);
    const cleanGroq = sanitizeReason(groqFailReason);

    throw new Error(
      `تعذر اتصال مستشار الورشة (صقر): فشل المزود الأساسي (Gemini Flash: ${cleanGemini}) وفشل المزود البديل (Groq: ${cleanGroq}). يرجى التحقق من اتصال الإنترنت ومفاتيح التشغيل.`
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

export async function transcribeAudioWithGemini(audioBase64: string, mimeType = 'audio/webm'): Promise<string> {
  const ai = createGeminiClientForAgent('falcon');
  const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '');
  const models = getCandidateGeminiModels();
  let lastErr: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: cleanData,
                },
              },
              {
                text: 'أنت مفرغ صوتي محترف وخبير في اللهجة المصرية والعربية للحرفيين. استمع إلى التسجيل الصوتي واكتب الكلام المنطوق فقط بدقة تامة دون تكرار ودون أي مقدمات أو شروحات. أخرج نص الكلام المنطوق مباشرة فقط.',
              },
            ],
          },
        ],
      });

      const txt = response.text?.trim();
      if (txt) return txt;
    } catch (err: any) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('تعذر تفريغ المقطع الصوتي عبر Gemini');
}

export { isSuperAdmin };