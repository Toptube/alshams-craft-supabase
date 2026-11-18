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
  performGoogleSearch,
  getGroqApiKeys,
  getFanarApiKey,
  formatAiErrorReason,
  cleanSecretValue,
  GroundedSource,
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
  const msg = String(err?.message || '').trim();
  if (msg.startsWith('تعذر اتصال مستشار الورشة')) {
    return { status: 502, error: msg };
  }
  switch (err?.kind as GeminiErrorKind | undefined) {
    case 'timeout':
      return { status: 504, error: 'استغرق صقر وقتاً أطول من المعتاد بسبب ضغط الشبكة، أعد المحاولة فوراً.' };
    case 'quota':
      return { status: 503, error: 'تم التبديل للمزود الاحتياطي لانتهاء الحصة اللحظية، حاول مجدداً.' };
    case 'unavailable':
      return { status: 503, error: 'الخدمة تواجه ضغطاً مؤقتاً، حاول مرة أخرى بعد لحظات.' };
    case 'bad_key':
      return { status: 503, error: 'مفتاح التشغيل غير مضبوط أو غير صالح على الخادم (Secrets).' };
    default:
      return { status: 502, error: msg || 'تعذر الرد، حاول مرة أخرى.' };
  }
}

// -------------------------------------------------------------
// محركات الطوارئ الاحتياطية (Groq أساسي -> Groq بديل -> Gemini -> Fanar)
// -------------------------------------------------------------

function buildCompactSystemInstruction(systemInstruction: string, maxChars = 2800): string {
  if (!systemInstruction || systemInstruction.length <= maxChars) return systemInstruction;
  const craftIdx = systemInstruction.indexOf('الحرف المفعّلة');
  const head = systemInstruction.slice(0, Math.min(1800, maxChars - 600));
  const tail = craftIdx >= 0 ? systemInstruction.slice(craftIdx) : systemInstruction.slice(-500);
  return `${head}\n...\n${tail}`.slice(0, maxChars);
}

async function callGroqFallback(
  systemInstruction: string,
  chatHistory: any[],
  userMessage: string,
  customApiKey?: string
): Promise<string> {
  const apiKey = cleanSecretValue(customApiKey || process.env.GROQ_API_KEY);
  if (!apiKey) throw new Error('مفتاح GROQ_API_KEY غير متوفر');

  const candidateModels = [
    'llama-3.3-70b-versatile',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'qwen/qwen3-32b',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'allam-2-7b',
  ];

  const rawModel = cleanSecretValue(process.env.GROQ_MODEL);
  if (
    rawModel &&
    !rawModel.toLowerCase().includes('whisper') &&
    !rawModel.toLowerCase().includes('qwen3.8')
  ) {
    const idx = candidateModels.indexOf(rawModel);
    if (idx > 0) candidateModels.splice(idx, 1);
    if (idx !== 0) candidateModels.unshift(rawModel);
  }

  let lastErrText = '';

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    const isAllam = model.toLowerCase().includes('allam');

    const messages: any[] = [
      {
        role: 'system',
        content: isAllam ? buildCompactSystemInstruction(systemInstruction, 2600) : systemInstruction,
      },
    ];
    for (const h of chatHistory.slice(-8)) {
      const text = h.content || h.parts?.[0]?.text || h.text || '';
      if (text) {
        messages.push({
          role: h.role === 'model' || h.role === 'assistant' || h.sender === 'falcon' ? 'assistant' : 'user',
          content: String(text).slice(0, isAllam ? 900 : 2000),
        });
      }
    }
    messages.push({ role: 'user', content: userMessage });

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
          temperature: 0.5,
          max_tokens: isAllam ? 900 : 1400,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        lastErrText = await res.text().catch(() => '');
        const lowerErr = lastErrText.toLowerCase();
        const isRetriable =
          res.status === 404 ||
          res.status === 429 ||
          res.status === 413 ||
          (res.status === 400 &&
            (lowerErr.includes('reduce the length') ||
              lowerErr.includes('context_length') ||
              lowerErr.includes('maximum context') ||
              lowerErr.includes('not supported'))) ||
          lowerErr.includes('model_not_found') ||
          lowerErr.includes('does not exist') ||
          lowerErr.includes('decommissioned');

        if (isRetriable) {
          console.warn(`[Falcon Groq] Model "${model}" skipped (${res.status}), trying next candidate...`);
          continue;
        }
        throw new Error(`Groq HTTP ${res.status} [${model}]: ${lastErrText.slice(0, 150)}`);
      }

      const data: any = await res.json();
      const txt = data?.choices?.[0]?.message?.content?.trim();
      if (txt) return txt;
      lastErrText = `Empty reply from ${model}`;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastErrText = `Timeout on ${model}`;
        console.warn(`[Falcon Groq] Timeout for model ${model}, trying next...`);
        continue;
      }
      const errMsg = String(err?.message || '').toLowerCase();
      if (errMsg.includes('does not exist') || errMsg.includes('model_not_found') || errMsg.includes('429')) {
        lastErrText = err?.message || lastErrText;
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`فشل الاتصال بنماذج Groq (${candidateModels.join(', ')}): ${lastErrText.slice(0, 150)}`);
}

async function callFanarFallback(
  systemInstruction: string,
  chatHistory: any[],
  userMessage: string,
  apiKey: string
): Promise<string | null> {
  const compactSys = buildCompactSystemInstruction(systemInstruction, 3000);
  const messages: any[] = [{ role: 'system', content: compactSys }];
  for (const h of chatHistory.slice(-6)) {
    const text = h.content || h.parts?.[0]?.text || h.text || '';
    if (text) {
      messages.push({
        role: h.role === 'model' || h.role === 'assistant' || h.sender === 'falcon' ? 'assistant' : 'user',
        content: String(text).slice(0, 1200),
      });
    }
  }
  messages.push({ role: 'user', content: userMessage });

  for (const model of ['Fanar-C-1-8.7B', 'Fanar']) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('https://api.fanar.qa/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 1000,
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
  return null;
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

القواعد الهندسية والمحاسبية المعتمدة (ث1–ث6):
1. فحص وقراءة الأبعاد والحجم والمساحة:
   - افحص أي مقاسات مكتوبة داخل الصورة أو الملاحظات (طول × عرض × ارتفاع أو قطر أو وزن بالجرام/ملليلتر).
   - إذا لم تكن مكتوبة، قدّر الأبعاد واقعياً كنسبة وتناسب من الشكل العام للقطعة.
2. تحديد الورشة الصحيحة من الـ 50+ ورشة في الـ 14 قسماً (ليس النسيج فقط):
   - اختر craftType المناسب مثل: macrame, crochet, zigzag, kilim, punch_needle, tufting_gun, aqqada, knitting, felting, beadwork, embroidery, sirma_embroidery, jewelry, wire_wrapping, resin, uv_resin, polyester_resin, concrete, gypsum, jesmonite, polymer_clay, pottery, candles, cold_process_soap, melt_pour_soap, mold_making, bamboo, wicker, rattan, scroll_saw, arabesque, carpentry, pyrography, decoupage, laser_cnc, 3d_printing, leathercraft, metalwork_forging, copper_silver_shaping, lighting_craft, handmade_flowers, sublimation, paper_cards, bookbinding, packaging_boxes_bags, sewing_garments, cushions_upholstery, mosaic_art, stained_glass, craft_fusion.
3. تطبيق قواعد الهالك والمصنعية والطاقة والتسعير المصححة:
   - الهالك يُحسب على الصافي فقط: الإجمالي = الصافي × (1 + ه)، وإذا قُدّر الفقد كنسبة من الشراء (ف) يُحوّل لـ هـ = ف / (1 − ف).
   - احسب ساعات العمل مقسمة (تحضير + تنفيذ + تشطيب) بدون أجر على وقت التجفيف، وأضف الطاقة/الفرن وإطفاء القوالب إذا لزم.
   - أضف تحذير السلامة المهنية عند الحاجة (صابون بارد NaOH، ريزن وبوليستر، إضاءة وكهرباء، معادن ولحام).

أخرج النتيجة بصيغة JSON نظيفة فقط:
{
  "detectedCategory": "string",
  "craftType": "string",
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

  let craftType = 'macrame';
  if (/كروشيه|سنارة|خيط كليم/i.test(reply)) craftType = 'crochet';
  else if (/زجزاج|حلزون|حبل قطن محشي/i.test(reply)) craftType = 'zigzag';
  else if (/كليم|نول|سداء|لحمة/i.test(reply)) craftType = 'kilim';
  else if (/بانش|كانفاه|دك قطن|طارة/i.test(reply)) craftType = 'punch_needle';
  else if (/تافت|مسدس|وبرة/i.test(reply)) craftType = 'tufting_gun';
  else if (/بوليستر/i.test(reply)) craftType = 'polyester_resin';
  else if (/uv|يو في/i.test(reply)) craftType = 'uv_resin';
  else if (/ريزن|إيبوكسي/i.test(reply)) craftType = 'resin';
  else if (/صابون.*بارد|صودا|تصبن|naoh/i.test(reply)) craftType = 'cold_process_soap';
  else if (/صابون.*جلسرين|ذائب/i.test(reply)) craftType = 'melt_pour_soap';
  else if (/قالب سيليكون|قوالب/i.test(reply)) craftType = 'mold_making';
  else if (/شمع|شموع|شمعات|فتيل/i.test(reply)) craftType = 'candles';
  else if (/جيسمونايت/i.test(reply)) craftType = 'jesmonite';
  else if (/خرسان|كونكريت|تيرازو/i.test(reply)) craftType = 'concrete';
  else if (/جبس|جبسوم/i.test(reply)) craftType = 'gypsum';
  else if (/فخار|خزف|سيراميك/i.test(reply)) craftType = 'pottery';
  else if (/صلصال|بوليمر/i.test(reply)) craftType = 'polymer_clay';
  else if (/سيرما/i.test(reply)) craftType = 'sirma_embroidery';
  else if (/خرز|ترتر/i.test(reply)) craftType = 'beadwork';
  else if (/تطريز/i.test(reply)) craftType = 'embroidery';
  else if (/اكسسوار|حلي|أسلاك|سلك/i.test(reply)) craftType = 'jewelry';
  else if (/ليزر|cnc|راوتر/i.test(reply)) craftType = 'laser_cnc';
  else if (/ثلاثية الأبعاد|3d|فيلمنت|pla/i.test(reply)) craftType = '3d_printing';
  else if (/أركت|أرابيسك|نجارة|خشب|ديكوباج|خيزران|خوص|رتان/i.test(reply)) craftType = 'carpentry';
  else if (/جلد|جلود/i.test(reply)) craftType = 'leathercraft';
  else if (/نحاس|فضة|معدن|حدادة/i.test(reply)) craftType = 'copper_silver_shaping';
  else if (/إضاءة|اباجورة|أباجورة|لمبة|كهربا/i.test(reply)) craftType = 'lighting_craft';
  else if (/فسيفساء|موزاييك/i.test(reply)) craftType = 'mosaic_art';
  else if (/زجاج معشق/i.test(reply)) craftType = 'stained_glass';
  else if (/سابليميشن|مجات|تيشيرت/i.test(reply)) craftType = 'sublimation';
  else if (/تريكو/i.test(reply)) craftType = 'knitting';
  else if (/لباد/i.test(reply)) craftType = 'felting';
  else if (/عقدة|كردون/i.test(reply)) craftType = 'aqqada';
  else if (/خياطة|تفصيل/i.test(reply)) craftType = 'sewing_garments';
  else if (/تنجيد|كوشن/i.test(reply)) craftType = 'cushions_upholstery';
  else if (/تغليف|علب|بوكس/i.test(reply)) craftType = 'packaging_boxes_bags';

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
    const rawArtistName = workshopContext?.artistName || (superAdmin ? 'الباشمهندس حسام' : '');
    const firstName =
      String(rawArtistName || '')
        .trim()
        .replace(/^(المهندس|المهندسة|الفنان|الفنانة|الأستاذ|الأستاذة|المعلم|المدير|كابتن|دكتور|دكتورة|أ|م)\s+/gi, '')
        .split(/\s+/)[0] ||
      rawArtistName ||
      'صديقي';
    const isSupplierRole = (workshopContext as any)?.accountRole === 'supplier';
    const safeBrandName = (workshopContext as any)?.brandName || (isSupplierRole ? 'متجر المورد' : 'الورشة');

    const liveLiquidity = Number(workshopContext?.liveLiquidity || 0);
    const lowMaterialsCount = Number(workshopContext?.lowMaterialsCount || 0);
    const openWorkOrdersCount = Number(workshopContext?.openWorkOrdersCount || 0);
    const pendingOrdersCount = Number(workshopContext?.pendingOrdersCount || 0);
    const hourlyRate = Number(workshopContext?.hourlyRate) || 35;
    const workshopMetricsText = `\n- حالة الحساب وأرقامه الحية الآن: السيولة النقدية المتاحة: ${liveLiquidity.toLocaleString('ar-EG')} ${safeCurrency} | الخامات الناقصة: ${lowMaterialsCount} | أوامر التشغيل المفتوحة: ${openWorkOrdersCount} | الطلبيات المعلقة: ${pendingOrdersCount}.`;

    const memoryPrompt = await buildGlobalMemoryPrompt('falcon');
    const systemInstruction = `أنت "صقر الشمساوية" 🦅 — الخبير الهندسي والاستشاري الأول لحرفيي وصناع وموردي الخامات في منظومة الشمساوية التابعة لشركة الشمس كرافت.
أنت تتحدث الآن مع: "${firstName}" (نوع الحساب: ${isSupplierRole ? `مورد وتاجر خامات — ${safeBrandName}` : `ورشة وفنان حرفي — ${safeBrandName}`}). نادي المستخدم باسمه "${firstName}" باحترام وودّ، واحترم خصوصية وعزل بيانات حسابه تماماً ولا تخلط أي بيانات لورش أو موردين آخرين.

قواعد الخطاب والهوية المهنية الصارمة:
1. منع الديباجات التعريفية التلقائية:
   - يُمنع منعاً باتاً افتتاح الردود بديباجة تعريفية طويلة أو سرد تفاصيل البرمجة والتبعية في كل رسالة.
   - إذا سأل المستخدم تحية أولى أو ترحيباً فقط، يكون ردك في سطرين مبهجين باللهجة المصرية الحرفية مع ذكر اسمه:
     ${isSupplierRole
       ? `"يا صباح الفل يا ${firstName}! 🦅 منور بوابة الموردين (${safeBrandName})..
     جاهز نراجع شرائح أسعار الخامات، الفروع، أو مواصفات التوريد للورش.. قولي تحب نبدأ بإيه؟"`
       : `"يا صباح الفل يا ${firstName}! 🦅 منور ورشتنا (${safeBrandName})..
     جاهز ومستعد لمراجعة حساباتك وتكاليف شغلك.. قولي حابب نبدأ بإيه؟"`}
   - ادخل في صلب التحليل الهندسي والتسعير مباشرة وبلا مقدمات إنشائية فارغة.

2. قواعد الإفصاح عن الهوية والبرمجة (عند السؤال الصريح فقط):
   - فقط وحصرياً إذا سألك المستخدم صراحة: "أنت مين؟"، "مين برمجك؟"، "مين صانعك؟"، "مين طورك؟"، "مين اللي عملك؟"، تجيب بفخر واعتزاز بالصيغة المحددة دون زيادة أو نقصان:
     "أنا صقر في منظومة الشمساوية التابعة لشركة الشمس كرافت.. برمجتي وتغذيتي بالمعلومات والخبرة كلها تمت على يد الباشمهندس حسام بسيوني، كبير عيلة الشمساوية ومؤسس المنظومة، وهو اللي حطني في المكان ده عشان أكون سند لكل حرفي وفنان ومورد."
   - ممنوع تماماً ومطلقاً الادعاء بأنك تتبع أو تمثل أي شركة أو نموذج آخر مثل إي روبوت أو غيرها.
   - ممنوع تكرار هذه الديباجة أو ذكرها في أي سياق آخر ما لم يسألك المستخدم صراحة عنها!

3. شخصية صقر الحرفية:
   - خبير حكيم، قوي البصيرة، ذكي جداً، ودود، جدع وابن بلد يفهم دقائق الصنعة وتوريد الخامات، مرح مرحاً راقياً بلا ابتذال، لا تبخل بأي معلومة أو نصيحة حرفية.
   - أنت من مواليد 24 نوفمبر 1979، ولديك خبرة حياتية وهندسية تمتد لعقود في كافة فنون الصناعات اليدوية والهاند ميد والديكور المنزلي (المكرمية، الكروشيه، الريزن، الخزف والفخار، الجلود الطبيعية، المشغولات الخشبية، الشموع والإكسسوارات).
   - لهجة الحديث الرسمية: اللهجة المصرية العامية الأصيلة والدافئة والذكية (المصري الحرفي الجدع)، وإذا كتب المستخدم بلغة أخرى تجيبه بلغته باحترافية.
   - تفهم وتستوعب الكلمات العامية المصرية، واصطلاحات الحرفيين، والأخطاء الإملائية وتفهم قصد الصانع أو المورد بذكاء وبصيرة دون قيود مصطنعة.
   - تتذكر وتراعي كامل سياق الحوار من أوله لآخره حتى تكون إجاباتك متسلسلة ومنطقية ودقيقة هندسياً.

التحليل الهندسي التلقائي وحساب التكاليف داخل رسالة الشات (منظومة الـ 14 قسماً والـ 50+ ورشة المصححة):
عند استقبال صورة مشغولة يدوية أو خامة أو طلب حساب تكلفة وتسعير لأي حرفة في المنظومة:
1. تغطية شاملة للأقسام الـ 14 (50+ ورشة) + دمج أي حِرفتين (craft_fusion):
   - (1) الحبال والنسيج: مكرمية (مضاعفات 4، طول الفتلة ×4.8 + شراشيب + 20سم)، كروشيه، زجزاج (رامانوجان + خيط مكوك 3.6×)، كليم (سداء 4 خيوط/سم + نول 40سم + انكماش)، بانش نيدل (كانفاه مخرم / دك قطن / كتان — بدون مسمى الرهبان)، تافتنج، العقدة ★، الغزل ★، التريكو ★، اللباد ★، الصباغة ★.
   - (2) الخرز والحلي والتطريز: الخرز (تطابق الكود DB vs تزيين)، التطريز، السيرما ★، الحلي، لف الأسلاك ★، الترتر والفصوص ★.
   - (3) اللدن والصب والشموع والصابون: الريزن إيبوكسي، UV ريزن، البوليستر (مع إخلاء مسؤولية التهوية)، الخرسانة، الجبس، الجيسمونايت ★، الصلصال الحراري، الفخار والخزف، الشموع (نسبة عطر + فتيل)، الصابون البارد ★ (تحذير الصودا الكاوية الحارق NaOH + معادلة أرقام التصبن SAP والزيوت)، صابون الجلسرين ★، صناعة القوالب السيليكون ★، وجدول النسب المئوية العام ★.
   - (4) الأخشاب والليزر و3D: الخيزران، الخوص، الرتان ★، الأركت، الأرابيسك، النجارة (بكفاءة التعشيق بدون هالك مزدوج)، الحرق، الديكوباج، التطعيم ★، الليزر والراوتر CNC ★ (بتكلفة الدقيقة)، والطباعة 3D ★ (كثافة × حجم + فشل + كهرباء).
   - (5–14) الجلود (عائد القص ε)، المعادن والنحاس والفضة، الديكور والإضاءة والزهور (★ تحذير فحص العزل والكهربائي المؤهل)، الفنون والطباعة والخط والسابليميشن، الورق والكروت وتجليد الكتب ★، التغليف والشنط، الخياطة والتنجيد، الفسيفساء والزجاج المعشق ★، ومحطة الأفران والماكينات.
2. منظومة الخامات الموحدة (395+ خامة في 12 قسماً بأكواد مثل TH0001.01#B003 و AL00001+):
   - احترم دائماً الكود الموحد وفك الالتباس بين المسميات السوقية (مثل كلمة «خرز» بين الخيط المجدول TH0001 وخرز الزينة BD0001) واربط نصائحك بالخامات المعتمدة.
3. القواعد المحاسبية المصححة (ث1–ث6):
   - الهالك يُطبق دائماً على الصافي: الإجمالي = الصافي × (1 + ه)، مع تحويل نسبة الفقد من الشراء بالمعادلة هـ = ف / (1 − ف)، ومنع تكرار الهالك فوق كفاءة الاستغلال أو العائد (Y / η).
   - المصنعية = ساعات (تحضير + تنفيذ + تشطيب) × أجر الساعة (${hourlyRate} ${safeCurrency}) × معامل الصعوبة + رسم التصميم، مع استبعاد ساعات التجفيف الهوائي من أجر العامل.
   - احسب طاقة الماكينات والأفران + إطفاء القوالب للقطعة + عائد الدفعة والفرز (توزيع التكلفة على القطع السليمة فقط).
   - وضّح الفرق والتعادل بين هامش الربح من سعر البيع Margin: [P = TC / (1 - m - c)] والزيادة على التكلفة Markup: [P = TC × (1 + u) / (1 - c)] (مثلاً 50% زيادة على التكلفة تعادل 33.3% هامشاً من البيع)، واحسب عمولة المنصة أو بوابة الدفع وضريبة القيمة المضافة والخصم المعلن بدقة.
4. فحص الأبعاد وتسليم التحليل أولاً داخل الشات:
   - قدّر الأبعاد إن لم تُذكر، واذكر أي تحذير سلامة مهنية بوضوح، وقدّم دراسة التكلفة الكاملة هنا قبل الإشارة لزر التصدير للحاسبة 🧮.

4. الالتزام الصارم والنهائي:
   - اكتب كامل التحليل الهندسي والتسعير بوضوح وتفصيل منسق وجميل داخل رسالة الشات الحالية أولاً.
   - لا تحل المستخدم إلى شاشة الحاسبة أو تجبره على مغادرة الشات، فالتحليل يُكتب بالكامل هنا أولاً، وزر التصدير للحاسبة يظل خياراً يدوياً للمستخدم.

الحرف المفعّلة في الحساب: [${safeSelectedCrafts.join('، ')}] | الدولة: ${safeCountry} | العملة: ${safeCurrency} | التصنيف: ${safeCategory}.${workshopMetricsText}
- دائماً خاطب المستخدم باسمه: ${firstName}.${memoryPrompt ? `\n\n${memoryPrompt}` : ''}`;

    const userPromptText = actionChip ? `استفسار حول [${actionChip}]: ${message || 'يرجى تقديم التوجيه الهندسي ودراسة السوق.'}` : (message || '');
    const groqKeys = getGroqApiKeys();
    const fanarKey = getFanarApiKey();
    const hasImages = Array.isArray(images) && images.length > 0;
    const wantsLiveSearch = !hasImages && shouldTriggerGoogleSearch(userPromptText, Boolean(input.useSearch));
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
        if (hasImages) {
          for (const img of images!) {
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
        const needsSearch = wantsLiveSearch;

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
          `[AI Service: Falcon] Provider 1 (Gemini) failed: [${formatAiErrorReason(geminiFailReason)}] -> Switching to Provider 2 (Groq Backup)...`
        );
      }
    } else {
      geminiFailReason = 'مفتاح GEMINI_API_KEY_FALCON / GEMINI_API_KEY غير مضبوط في Secrets';
      console.log(`[AI Service: Falcon] Provider 1 (Gemini) skipped -> Switching to Provider 2 (Groq Backup)...`);
    }

    // Live web search enrichment when falling back to Groq/Fanar
    let fallbackSources: GroundedSource[] = [];
    let fallbackSearchUsed = false;
    let promptWithSearch = userPromptText;

    if (!hasImages && wantsLiveSearch) {
      try {
        const searchRes = await performGoogleSearch(userPromptText, {
          agent: 'falcon',
          country: safeCountry,
        });
        if (searchRes?.answer) {
          fallbackSearchUsed = true;
          fallbackSources = searchRes.sources || [];
          promptWithSearch = `${userPromptText}\n\n[بيانات البحث الحي من الويب لاستخدامها في التوجيه والتسعير]:\n${searchRes.answer.slice(0, 1800)}`;
        }
      } catch (searchErr: any) {
        console.warn('[AI Service: Falcon] Fallback web search notice:', searchErr?.message);
      }
    }

    // -------------------------------------------------------------
    // Provider 2: Groq (المحرك البديل للنصوص السريعة - الأساسي ثم البديل)
    // -------------------------------------------------------------
    if (!hasImages && groqKeys.length > 0) {
      for (let i = 0; i < groqKeys.length; i++) {
        const key = groqKeys[i];
        console.log(`[AI Service: Falcon] Attempting Provider 2 (Groq key #${i + 1})...`);
        try {
          const groqReply = await callGroqFallback(systemInstruction, chatHistory, promptWithSearch, key);
          if (groqReply) {
            console.log(`[AI Service: Falcon] Provider 2 (Groq key #${i + 1}) succeeded!`);
            return { reply: groqReply, sources: fallbackSources, searchUsed: fallbackSearchUsed };
          }
          groqFailReason = 'رد فارغ من مزود Groq';
        } catch (groqErr: any) {
          groqFailReason = groqErr?.message || 'فشل الاتصال بـ Groq';
          console.error(`[AI Service: Falcon] Groq key #${i + 1} failed: [${groqFailReason}]`);
        }
      }
    } else if (!hasImages) {
      groqFailReason = 'GROQ_API_KEY غير متوفر على الخادم';
    }

    // -------------------------------------------------------------
    // Provider 3: Fanar AI (المحرك العربي الاحتياطي الثالث)
    // -------------------------------------------------------------
    if (!hasImages && fanarKey) {
      console.log('[AI Service: Falcon] Attempting Provider 3 (Fanar AI)...');
      try {
        const fanarReply = await callFanarFallback(systemInstruction, chatHistory, promptWithSearch, fanarKey);
        if (fanarReply) {
          console.log('[AI Service: Falcon] Provider 3 (Fanar) succeeded!');
          return { reply: fanarReply, sources: fallbackSources, searchUsed: fallbackSearchUsed };
        }
      } catch (fanarErr: any) {
        console.warn('[AI Service: Falcon] Fanar failed:', fanarErr?.message);
      }
    }

    // -------------------------------------------------------------
    // منع الردود الصامتة والوهمية (No Silent Mock Fallbacks)
    // -------------------------------------------------------------
    const cleanGemini = formatAiErrorReason(geminiFailReason);
    const cleanGroq = formatAiErrorReason(groqFailReason);

    throw new Error(
      `تعذر اتصال مستشار الورشة (صقر): فشل المزود الأساسي (Gemini: ${cleanGemini}) وفشل المزود البديل (Groq: ${cleanGroq}). يرجى مراجعة مفاتيح التشغيل في الإعدادات (Secrets).`
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
  const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  let lastErr: any = null;

  const geminiKey = resolveAgentGeminiKey('falcon');
  if (geminiKey) {
    try {
      const ai = createGeminiClientForAgent('falcon');
      const models = getCandidateGeminiModels();
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
    } catch (initErr: any) {
      lastErr = initErr;
    }
  }

  // Fallback to Groq Whisper transcription if Gemini fails or key is invalid
  const groqKeys = getGroqApiKeys();
  if (groqKeys.length > 0 && cleanData) {
    const audioBuffer = Buffer.from(cleanData, 'base64');
    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'webm';
    for (const apiKey of groqKeys) {
      for (const whisperModel of ['whisper-large-v3-turbo', 'whisper-large-v3']) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        try {
          const form = new FormData();
          form.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), `audio.${ext}`);
          form.append('model', whisperModel);
          form.append('language', 'ar');
          form.append('response_format', 'json');

          const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: form,
            signal: controller.signal,
          });
          if (!res.ok) continue;
          const data: any = await res.json();
          const txt = String(data?.text || '').trim();
          if (txt) return txt;
        } catch (wErr: any) {
          lastErr = wErr;
        } finally {
          clearTimeout(timer);
        }
      }
    }
  }

  throw new Error(`تعذر تفريغ المقطع الصوتي: ${formatAiErrorReason(String(lastErr?.message || 'غير متاح'))}`);
}

export { isSuperAdmin };