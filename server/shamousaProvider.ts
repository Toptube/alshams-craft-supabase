import { FunctionDeclaration, Type } from '@google/genai';
import { workshopToolSchemas, runWorkshopTool, WorkshopToolContext } from './workshopTools.js';
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
  GroundedSource,
} from './googleSearchService.js';

export interface ShamousaContext {
  artistName: string;
  workshopName: string;
  treasuryBalance?: number;
  cashAdvances?: string;
  workshopId: string;
  db: any;
  userEmail?: string;
  isSuperAdmin?: boolean;
  useSearch?: boolean;
  clientContext?: {
    treasuryBalance?: number;
    treasuriesDetail?: any[];
    materialsSummary?: any[];
    productsSummary?: any[];
    ordersSummary?: any[];
  };
}

export function extractFirstName(rawName?: string): string {
  if (!rawName) return '';
  const cleaned = String(rawName)
    .trim()
    .replace(/^(المهندس|المهندسة|الفنان|الفنانة|الأستاذ|الأستاذة|المعلم|المدير|كابتن|دكتور|دكتورة|أ|م)\s+/gi, '');
  const first = cleaned.split(/\s+/)[0];
  return first || cleaned;
}

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

// الاتصال بـ Groq عبر fetch المدمج مع دعم النماذج المتاحة فعلياً للحساب
async function callGroqChat(messages: any[], tools?: any[], customApiKey?: string) {
  const apiKey = customApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY غير متوفر');

  const hasTools = Array.isArray(tools) && tools.length > 0;

  // النماذج المتاحة فعلياً في Groq
  // إذا كانت هناك أدوات مستدعاة: نجرّب النماذج الداعمة للأدوات أولاً، ثم نجرّب النماذج النصية بدون أدوات
  const candidateModels = hasTools
    ? ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'allam-2-7b']
    : ['allam-2-7b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];

  const rawModel = (process.env.GROQ_MODEL || '').trim();
  if (rawModel && !candidateModels.includes(rawModel) && !rawModel.includes('70b') && !rawModel.includes('3.3') && !rawModel.includes('llama')) {
    candidateModels.unshift(rawModel);
  }

  let lastErrText = '';

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const isAllam = model.toLowerCase().includes('allam');
    const sendTools = hasTools && !isAllam;

    const payload: any = {
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1200,
    };

    if (sendTools && tools) {
      payload.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      payload.tool_choice = 'auto';
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        lastErrText = await res.text().catch(() => '');
        // إذا كان الموديل غير متاح أو لا يدعم الأدوات، جرب الموديل التالي فوراً
        if (
          res.status === 404 ||
          (res.status === 400 && (lastErrText.includes('tool calling') || lastErrText.includes('tools') || lastErrText.includes('not supported'))) ||
          lastErrText.includes('model_not_found') ||
          lastErrText.includes('does not exist')
        ) {
          console.warn(`[Groq] Model "${model}" notice (${res.status}), trying next candidate...`);
          continue;
        }
        throw new Error(`Groq HTTP ${res.status} [${model}]: ${lastErrText.slice(0, 150)}`);
      }

      const data: any = await res.json();
      return data?.choices?.[0]?.message;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[Groq] Timeout for model ${model}, trying next candidate...`);
        continue;
      }
      if (lastErrText.includes('does not exist') || lastErrText.includes('model_not_found') || lastErrText.includes('tool calling')) {
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Groq: لم يتوفر أي نموذج صالح من النماذج المدعومة (${candidateModels.join(', ')}). الخطأ: ${lastErrText.slice(0, 150)}`);
}


function toGeminiType(rawType?: unknown): Type {
  switch (String(rawType || '').toLowerCase()) {
    case 'number':
      return Type.NUMBER;
    case 'integer':
      return Type.INTEGER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'array':
      return Type.ARRAY;
    case 'object':
      return Type.OBJECT;
    default:
      return Type.STRING;
  }
}

function buildShamousaGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return workshopToolSchemas.map((schema) => {
    const rawProps = (schema.parameters?.properties || {}) as Record<string, any>;
    const convertedProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawProps)) {
      convertedProps[k] = {
        type: toGeminiType(v?.type),
        ...(v?.description ? { description: String(v.description) } : {}),
        ...(Array.isArray(v?.enum) ? { enum: v.enum } : {}),
      };
    }

    return {
      name: schema.name,
      description: schema.description,
      parameters: {
        type: Type.OBJECT,
        properties: convertedProps,
        ...(Array.isArray(schema.parameters?.required) ? { required: schema.parameters.required as string[] } : {}),
      },
    };
  });
}

// المحرك الأساسي المعتمد لشموسة: Google Gemini (مع دعم أدوات الورشة + بحث جوجل + الرؤية الحاسوبية)
async function callGeminiChatForShamousa(
  systemInstruction: string,
  messages: any[],
  toolCtx: WorkshopToolContext,
  options: {
    images?: Array<{ base64: string; mimeType?: string; name?: string }>;
    useSearch?: boolean;
  } = {}
): Promise<{
  reply: string;
  sources: GroundedSource[];
  searchUsed: boolean;
  searchEntryPoint?: string;
}> {
  const ai = createGeminiClientForAgent('shamousa');
  const modelsToTry = getCandidateGeminiModels();
  const baseContents: any[] = [];

  const nonSystemMessages = messages.filter((m) => m.role !== 'system').slice(-10);
  const hasImages = Array.isArray(options.images) && options.images.length > 0;

  for (let i = 0; i < nonSystemMessages.length; i++) {
    const m = nonSystemMessages[i];
    const isLast = i === nonSystemMessages.length - 1;
    const parts: any[] = [{ text: String(m.content || '') }];

    if (isLast && hasImages && options.images) {
      for (const img of options.images) {
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
          parts.push({
            inlineData: {
              mimeType: mime,
              data: cleanData.replace(/\s+/g, ''),
            },
          });
        }
      }
    }

    baseContents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    });
  }

  const functionDeclarations = buildShamousaGeminiFunctionDeclarations();
  const enableSearch = !hasImages && Boolean(options.useSearch);

  let lastGeminiError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`انتهت مهلة استجابة Gemini (${modelName})`)), 25000);
      });

      try {
        console.log(
          `[Shamousa Gemini] Model: ${modelName} (attempt ${attempt})` +
            (hasImages ? ' [Vision]' : '') +
            (enableSearch ? ' [Google Search + Tools]' : ' [Tools]')
        );

        const toolsConfig: any[] = [];
        const config: any = {
          systemInstruction,
        };

        if (!hasImages) {
          if (enableSearch) {
            // Hybrid Server-Side Google Search + Client-Side Workshop Function Calling (per Gemini 4 spec)
            toolsConfig.push({ googleSearch: {} });
            toolsConfig.push({ functionDeclarations });
            config.toolConfig = { includeServerSideToolInvocations: true };
          } else {
            toolsConfig.push({ functionDeclarations });
          }
          config.tools = toolsConfig;
        }

        const contentsTurn = [...baseContents];
        let response: any = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: contentsTurn,
            config,
          }).finally(() => clearTimeout(timeoutId)),
          timeoutPromise,
        ]);

        // Handle multi-turn workshop Function Calling if Gemini invoked internal DB tools
        let round = 0;
        while (Array.isArray(response?.functionCalls) && response.functionCalls.length > 0 && round < 3) {
          round++;
          const modelContent = response?.candidates?.[0]?.content;
          if (modelContent) {
            contentsTurn.push(modelContent);
          }

          const fnResponseParts: any[] = [];
          for (const call of response.functionCalls) {
            const fnName = call.name;
            const fnArgs = call.args || {};
            console.log(`[Shamousa Gemini Tool Call]: ${fnName}`, fnArgs);
            const toolResult = await runWorkshopTool(fnName, fnArgs, toolCtx);
            fnResponseParts.push({
              functionResponse: {
                name: fnName,
                ...(call.id ? { id: call.id } : {}),
                response: { result: toolResult },
              },
            });
          }

          contentsTurn.push({
            role: 'user',
            parts: fnResponseParts,
          });

          response = await ai.models.generateContent({
            model: modelName,
            contents: contentsTurn,
            config,
          });
        }

        const { sources, searchEntryPoint } = extractGroundingMetadata(response);
        const reply = response?.text?.trim();
        if (reply) {
          return {
            reply,
            sources: sources.slice(0, 6),
            searchUsed: enableSearch || sources.length > 0,
            searchEntryPoint,
          };
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastGeminiError = err;
        const errMsg = String(err?.message || err || '');
        const isTransient503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');
        const isQuota429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');

        console.log(
          `[Shamousa Gemini] Notice on ${modelName} (attempt ${attempt}): ${
            isTransient503 ? 'high demand (503)' : isQuota429 ? 'quota notice (429)' : 'switching fallback'
          }`
        );

        // If hybrid search+tools failed with 400 or 429, fall back to Gemini with Workshop Tools only (no googleSearch)
        if (enableSearch && !isTransient503) {
          try {
            const toolsOnlyRes = await ai.models.generateContent({
              model: modelName,
              contents: baseContents,
              config: {
                systemInstruction,
                tools: [{ functionDeclarations }],
              },
            });
            const txt = toolsOnlyRes?.text?.trim();
            if (txt) {
              return {
                reply: txt,
                sources: [],
                searchUsed: false,
              };
            }
          } catch {}
        }

        if (isTransient503 && attempt === 1) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      }
    }
  }

  // Final Gemini pass without tools before switching to Groq backup
  if (enableSearch) {
    for (const modelName of modelsToTry) {
      try {
        const directRes = await ai.models.generateContent({
          model: modelName,
          contents: baseContents,
          config: { systemInstruction },
        });
        const txt = directRes?.text?.trim();
        if (txt) {
          return { reply: txt, sources: [], searchUsed: false };
        }
      } catch {}
    }
  }

  throw lastGeminiError || new Error('فشل الاتصال بكافة نماذج Gemini المتاحة');
}

export interface ShamousaLiveMetrics {
  liquidity: number;
  treasuriesDesc: string;
  lowMaterialsCount: number;
  lowMaterialsDesc: string;
  openWorkOrdersCount: number;
  openWorkOrdersDesc: string;
  pendingOrdersCount: number;
}

function buildShamousaSystemPrompt(ctx: ShamousaContext, metrics: ShamousaLiveMetrics): string {
  const firstName = extractFirstName(ctx.artistName) || 'يا غالي';
  const workshopName = ctx.workshopName || 'ورشة الشمس كرافت';

  return `أنتِ "شموسة" ☀️ — مديرة العمليات وحسابات الخزائن والمهام اليومية للورشة في منظومة الشمساوية (${workshopName}).

قواعد الخطاب والهوية المهنية الصارمة:
1. منع الديباجات التعريفية التلقائية:
   - يُمنع منعاً باتاً افتتاح الردود بديباجات تعريفية مطولة أو تكرار سرد الهوية أو التبعية في كل رسالة.
   - إذا سأل المستخدم تحية أولى أو ترحيباً فقط، يكون الترحيب في سطرين مبهجين باللهجة المصرية الحرفية:
     "أهلاً بيك يا بطل! ☀️ منورة ورشتنا..
     طمني حابب تتابع أوردراتك ولا تراجع الخزينة والمخزن؟"
   - ادخلي في صلب الموضوع مباشرة وركزي على الإجابة وحل طلب الصانع بذكاء وسرعة.

2. الإفصاح عن الهوية والبرمجة (عند السؤال الصريح فقط):
   - فقط وحصرياً إذا سألك المستخدم صراحة: "أنتِ مين؟"، "مين برمجك؟"، "مين صانعك؟"، "مين طورك؟"، "مين اللي عملك؟"، تجيبين بفخر واعتزاز بالصيغة المحددة دون زيادة أو نقصان:
     "أنا شموسة في منظومة الشمساوية التابعة لشركة الشمس كرافت.. برمجتي وتغذيتي بالمعلومات والخبرة كلها تمت على يد الباشمهندس حسام بسيوني، كبير عيلة الشمساوية ومؤسس المنظومة، وهو اللي حطني في المكان ده عشان أكون سند لكل حرفي وفنان."
   - ممنوع تماماً ومطلقاً الادعاء بأنك تتبعين أي شركة أو نموذج آخر مثل إي روبوت أو غيرها.

3. دليل شموسة التفاعلي وموسوعة الشمساوية الحية (Interactive Guide & System Knowledge):
   عندما يسألك الصانع "أجيب منين كذا؟"، "إزاي أسجل أوردر؟"، أو "فين زر كذا؟"، أرشديه فوراً وبدقة باسم الشاشة والزر المحدد:
   - 📦 الأرشيف: في قسم "المنتجات والمشغولات 📦" -> تبويب "أرشيف المنتجات" (لتخزين كل قطع المشغولات المحسوبة مسبقاً وتفاصيل تكاليفها واسترجاعها بلمسة).
   - 🎨 الكتالوج ومنصتي: في قسم "الكتالوج والمنتجات" / "منصتي" 🎨 مع زر [تصدير للمتجر] لنقل أي تصميم أو مشغولة فوراً إلى متجر الورشة الخارجي والكتالوج العام.
   - 🏪 متجر الورشة والطلبيات: من شاشة "متجري" 🏪 مع مولد كود QR ومتابعة مراحل الأوردرات الـ 4 الحية: (جديد 🟡، قيد التجهيز 🔵، تم الشحن 🚚، تم التسليم 🟢).
   - 💰 الخزن والسيولة وكشف الحساب: شاشة "الخزينة والأرصدة" 💰 وشاشة "الحسابات والقيود" 📑، مع التمييز الواضح بين الخزن النقدية والمحافظ البنكية وكشوفات حساب العملاء والموردين.
   - 🧮 التصدير من شات صقر للحاسبة: الضغط على زر 🧮 [تصدير للحاسبة] داخل كروت رسائل صقر الشمساوية، ليتم نقل كافة الخامات والأبعاد والأوزان والمصنعية والتسعير مباشرة إلى حاسبة التكاليف دون أي كتابة يدوية.
   - 🧶 المخزن وإدارة الخامات: شاشة "المخزن وإدارة الخامات" 🧶 لتسجيل أرصدة الخيوط، الأخشاب، الشاسيهات، وتعيين حد الأمان وإعادة طلب التوريد.
   - 🧾 الفواتير وعروض الأسعار: شاشة "الفواتير" 🧾 لإصدار فواتير بيع أو شراء أو عروض أسعار تفصيلية قابلة للطباعة والمشاركة عبر واتساب.
   - 🔨 أوامر الشغل: شاشة "أوامر الشغل" 🔨 لتوزيع مهام التصنيع ومتابعة مراحل خط الإنتاج والحرفيين بالورشة.

4. دليل خامات ومعدات قسم الحبال والنسيج وصيانتها الورشية (Textile Crafts Knowledge & Equipment Care):
   عندما يستشيرك الصانع عن خامات ومعدات ورش [الحبال والنسيج]، تجيبين بخبرة ورشية أصيلة:
   - 🪡 خيوط السلسلة والسداء (Warp Cotton): خيوط قطن 100% مبروم متينة مشدودة على نول الكليم أو معلقة المكرمية، قوة الشد يجب أن تكون متساوية تماماً لتجنب تقعر أطراف النسيج.
   - 🎨 أقمشة البانش نيدل والتطريز: تم استبعاد مسمى "قماش الرهبان" واعتماد خامات السوق المصري الدارجة (قماش كانفاه مخرم عالي الجودة للبانش، أو قماش دك قطن مصري متين، أو قماش كتان نقي)، وتُشد جيداً على الطارة لمنع ترهل الغرز.
   - 🧴 غراء اللاتكس السائل الأصلي (Liquid Latex Glue): مادة بيضاء تتحول لشفافة مرنة لتثبيت ظهر سجاد التافتنج والبانش نيدل وحمايتها من التنسيل عند الغسيل، ويُركب مع قماش ظهر مانع للانزلاق.
   - 🧵 حبال الزجزاج المحشية والبوليستر (Zigzag Cored Ropes): حبال قطن زجزاج محشية (5 إلى 12 مم) أو حبال بوليستر متينة، مع حساب محيط القاعدة بدقة (صيغة رامانوجان الهندسية للبيضاوي: π[3(a+b)-√((3a+b)(a+3b))])، ومساحة الجوانب للحفاظ على استقامة السلة، مع احتساب 3.6 متر خيط مكوك لكل متر حبل، بالإضافة لتكلفة البطانة والسوستة والأيدي الجلدية للشنط والكلاتشات.
   - ⚙️ صيانة ماكينة الزجزاج: تنظيف بيت المكوك من وبر القطن بفرشاة ناعمة يومياً، وتزييت الكروشيه بقطرة زيت ماكينات أبيض خفيف وتغيير إبر مقاس 100/16 أو 110/18 عند تآكلها.
   - 🔫 صيانة مسدس التافتنج (Tufting Gun): تزييت تروس المسدس يومياً بنقطتي زيت خفيف، وفحص حركة المقص الدوار وتنظيفه لمنع علق الخيوط.

5. كسر القيود المصطنعة والدقة الرقمية:
   - افهمي الكلمات والأخطاء الإملائية والعامية المصرية بذكاء (مثلاً: "خزنه"، "عهده"، "خامات"، "فلوس"، "كام معانا"، "النواقص"، "أوامر التشغيل").
   - اشرحي بالأرقام الحقيقية المباشرة المرفقة في سياق الورشة الحية أدناه.

بيانات الورشة الحية والفعلية لحظة بلحظة (Live Workshop Ground Truth):
1. السيولة النقدية والخزائن:
   - إجمالي السيولة الفعلية المتوفرة حالياً: ${metrics.liquidity.toLocaleString('ar-EG')} ج.م (${metrics.liquidity} ج.م).
   - تفاصيل الخزن والعهد المسجلة:
${metrics.treasuriesDesc || 'الخزينة النقدية الرئيسية متوفرة ومسجلة في دفاتر الورشة.'}

2. الخامات ومخزون المواد الأولية:
   - الخامات الناقصة أو التي أوشكت على النفاد (تحت حد الأمان): ${metrics.lowMaterialsCount} خامة.
${metrics.lowMaterialsDesc ? `   - تفاصيل النواقص:\n${metrics.lowMaterialsDesc}` : '   - كافة الخامات حالياً فوق حد الأمان وإعادة الطلب.'}

3. أوامر التشغيل وخط الإنتاج:
   - أوامر التشغيل المفتوحة وقيد التصنيع: ${metrics.openWorkOrdersCount} أمر تشغيل.
${metrics.openWorkOrdersDesc ? `   - تفاصيل أوامر التشغيل النشطة:\n${metrics.openWorkOrdersDesc}` : '   - لا توجد أوامر تشغيل مفتوحة حالياً، خط الإنتاج جاهز لأوامر جديدة.'}

4. المبيعات والطلبيات:
   - عدد الطلبيات المعلقة قيد التنفيذ والتسليم: ${metrics.pendingOrdersCount} طلبية.

- عندما يسألك ${firstName} عن رصيد الخزنة، الفلوس، الخامات الناقصة، أو أوامر التشغيل: أجيبي فوراً بالبيانات الحقيقية المحددة أعلاه بدقة ووضوح.

لديكِ أدوات استعلام فعلية متصلة بقاعدة البيانات (search_treasuries, search_materials, search_orders, search_customers, search_suppliers, search_employees, workshop_overview) بالإضافة إلى محرك بحث جوجل الحي (googleSearch) للاستعلام عن أحدث أسعار السوق والموردين واتجاهات السوق خارج الورشة عند الحاجة.`;
}

export async function handleShamousaChat(
  userMessage: string,
  history: any[],
  ctx: ShamousaContext,
  images?: Array<{ base64: string; mimeType?: string; name?: string }>
): Promise<{
  reply: string;
  handoffToFalcon?: boolean;
  provider: string;
  sources?: GroundedSource[];
  searchUsed?: boolean;
  searchEntryPoint?: string;
  inTrainingMode?: boolean;
}> {
  const userEmail = ctx.userEmail || '';
  const superAdmin = Boolean(ctx.isSuperAdmin || isSuperAdmin(userEmail));

  // 0. التحقق من حساب السوبر أدمن وبروتوكول التدريب والبرمجة التفاعلي (Session State)
  if (superAdmin) {
    const trainingResult = await processTrainingInteraction(
      'shamousa',
      userMessage,
      userEmail || 'hmb.top.tupe@gmail.com'
    );
    if (trainingResult.handled) {
      return {
        reply: trainingResult.reply,
        handoffToFalcon: false,
        provider: 'superadmin_engine',
        inTrainingMode: trainingResult.inTrainingMode,
      };
    }
  }

  const effectiveWorkshopId = superAdmin ? 'ALL_WORKSHOPS' : ctx.workshopId;
  const toolCtx: WorkshopToolContext = {
    db: ctx.db,
    workshopId: effectiveWorkshopId,
    isSuperAdmin: superAdmin,
  };
  (toolCtx as any).clientContext = ctx.clientContext;

  // 1. استخراج سياق الورشة الحي الفعلي (Live Data Context)
  let liveLiquidity = Number(ctx.clientContext?.treasuryBalance ?? ctx.treasuryBalance ?? 0);
  let treasuriesDetailText = '';

  try {
    const treasuriesResult = await runWorkshopTool('search_treasuries', {}, toolCtx);
    if (typeof treasuriesResult.total_liquidity === 'number') {
      liveLiquidity = treasuriesResult.total_liquidity;
    }
    if (Array.isArray(treasuriesResult.treasuries) && treasuriesResult.treasuries.length > 0) {
      treasuriesDetailText = treasuriesResult.treasuries
        .map((t: any) => `- ${t.name} (${t.kind || 'خزينة'}): ${Number(t.balance).toLocaleString('ar-EG')} ج.م ${t.holder ? `[المسؤول: ${t.holder}]` : ''}`)
        .join('\n');
    }
  } catch (err: any) {
    console.warn('[Shamousa Context] search_treasuries notice:', err?.message);
  }

  if (!treasuriesDetailText && Array.isArray(ctx.clientContext?.treasuriesDetail) && ctx.clientContext!.treasuriesDetail.length > 0) {
    treasuriesDetailText = ctx.clientContext!.treasuriesDetail
      .map((t: any) => `- ${t.name || 'خزينة'}: ${Number(t.balance || t.amount || 0).toLocaleString('ar-EG')} ج.م`)
      .join('\n');
  }

  // استخراج النواقص الحية
  const clientCtx: any = ctx.clientContext || {};
  let lowMaterialsCount = Number(clientCtx.lowMaterialsCount || 0);
  let lowMaterialsDesc = '';
  if (Array.isArray(clientCtx.lowMaterialsList) && clientCtx.lowMaterialsList.length > 0) {
    lowMaterialsDesc = clientCtx.lowMaterialsList.map((m: string) => `• ${m}`).join('\n');
  } else if (Array.isArray(clientCtx.materialsSummary)) {
    const low = clientCtx.materialsSummary.filter(
      (m: any) => (Number(m.currentStock) || 0) <= (Number(m.minAlertThreshold) || 5)
    );
    lowMaterialsCount = low.length;
    lowMaterialsDesc = low.map((m: any) => `• ${m.materialName}: المتبقي ${m.currentStock} ${m.unit || 'وحدة'} (حد الأمان: ${m.minAlertThreshold || 5})`).join('\n');
  }

  // استخراج أوامر التشغيل الحية
  let openWorkOrdersCount = Number(clientCtx.openWorkOrdersCount || 0);
  let openWorkOrdersDesc = '';
  if (Array.isArray(clientCtx.openWorkOrdersList) && clientCtx.openWorkOrdersList.length > 0) {
    openWorkOrdersDesc = clientCtx.openWorkOrdersList.map((w: string) => `• ${w}`).join('\n');
  }

  const pendingOrdersCount = Number(clientCtx.pendingOrdersCount || 0);

  const liveMetrics: ShamousaLiveMetrics = {
    liquidity: liveLiquidity,
    treasuriesDesc: treasuriesDetailText,
    lowMaterialsCount,
    lowMaterialsDesc,
    openWorkOrdersCount,
    openWorkOrdersDesc,
    pendingOrdersCount,
  };

  const baseInstruction = buildShamousaSystemPrompt(ctx, liveMetrics);
  const memoryPrompt = await buildGlobalMemoryPrompt('shamousa');
  const systemInstruction = baseInstruction + (memoryPrompt ? `\n\n${memoryPrompt}` : '');

  const promptMessages: any[] = [
    { role: 'system', content: systemInstruction },
    ...history.slice(-8).map((m: any) => ({
      role: m.role === 'assistant' || m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.content || m.text || '',
    })),
    { role: 'user', content: userMessage },
  ];

  const { primary: groqPrimary, secondary: groqSecondary } = getGroqKeys();
  let groqFailReason = '';
  let geminiFailReason = '';

  async function tryGroqExecution(key: string): Promise<string | null> {
    let assistantMsg: any;
    try {
      assistantMsg = await callGroqChat(promptMessages, workshopToolSchemas, key);
    } catch (err: any) {
      console.warn('[Shamousa Groq] Calling with tools encountered issue, falling back to direct chat:', err?.message);
      assistantMsg = await callGroqChat(promptMessages, undefined, key);
    }

    if (assistantMsg?.tool_calls && Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
      const toolCall = assistantMsg.tool_calls[0];
      const fnName = toolCall.function?.name;
      let fnArgs = {};
      try {
        fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
      } catch {}

      console.log(`[Shamousa Groq Tool Call]: ${fnName}`, fnArgs);
      const toolResult = await runWorkshopTool(fnName, fnArgs, toolCtx);

      const secondTurnMessages = [
        ...promptMessages,
        assistantMsg,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          name: fnName,
          content: JSON.stringify(toolResult),
        },
      ];

      const secondTurnRes = await callGroqChat(secondTurnMessages, undefined, key);
      return secondTurnRes?.content?.trim() || null;
    }

    return assistantMsg?.content?.trim() || null;
  }

  const hasImages = Array.isArray(images) && images.length > 0;
  const wantsGoogleSearch = shouldTriggerGoogleSearch(userMessage, Boolean(ctx.useSearch));
  const shamousaGeminiKey = resolveAgentGeminiKey('shamousa');

  // -------------------------------------------------------------
  // Provider 1 (Primary): Google Gemini + Workshop Tools + Google Search Grounding
  // -------------------------------------------------------------
  if (shamousaGeminiKey) {
    console.log('[AI Service: Shamousa] Attempting Provider 1 (Gemini + Tools + Google Search)...');
    try {
      const geminiResult = await callGeminiChatForShamousa(systemInstruction, promptMessages, toolCtx, {
        images,
        useSearch: wantsGoogleSearch,
      });
      if (geminiResult.reply) {
        console.log(
          '[AI Service: Shamousa] Provider 1 (Gemini) succeeded.',
          geminiResult.searchUsed ? `[Google Search Sources: ${geminiResult.sources.length}]` : ''
        );
        return {
          reply: geminiResult.reply,
          handoffToFalcon: false,
          provider: hasImages ? 'gemini_vision' : geminiResult.searchUsed ? 'gemini_google_search' : 'gemini',
          sources: geminiResult.sources,
          searchUsed: geminiResult.searchUsed,
          searchEntryPoint: geminiResult.searchEntryPoint,
        };
      }
      geminiFailReason = 'رد فارغ من Gemini';
    } catch (geminiErr: any) {
      geminiFailReason = geminiErr?.message || 'فشل الاتصال بـ Gemini';
      console.warn(
        `[AI Service: Shamousa] Provider 1 (Gemini) failed: [${geminiFailReason}] -> Switching to Provider 2 (Groq Backup)...`
      );
    }
  } else {
    geminiFailReason = 'مفتاح GEMINI_API_KEY_SHAMOUSA / GEMINI_API_KEY غير مضبوط في Secrets';
    console.log(`[AI Service: Shamousa] Provider 1 (Gemini) skipped: ${geminiFailReason} -> Switching to Provider 2 (Groq Backup)...`);
  }

  // -------------------------------------------------------------
  // Provider 2 (Backup): Groq API (Primary -> Secondary for fast text)
  // -------------------------------------------------------------
  const groqKeyToUse = !hasImages ? (groqPrimary || groqSecondary) : undefined;
  if (groqKeyToUse) {
    console.log('[AI Service: Shamousa] Attempting Provider 2 (Groq Backup)...');
    try {
      const reply = await tryGroqExecution(groqKeyToUse);
      if (reply) {
        console.log('[AI Service: Shamousa] Provider 2 (Groq Backup) succeeded.');
        return { reply, handoffToFalcon: false, provider: 'groq', sources: [], searchUsed: false };
      }
      groqFailReason = 'Empty response from Groq';
    } catch (groqErr: any) {
      groqFailReason = groqErr?.message || 'Groq connection failed';
      console.error(`[AI Service: Shamousa] Provider 2 (Groq Backup) failed: [${groqFailReason}]`);
    }
  } else if (!hasImages) {
    groqFailReason = 'GROQ_API_KEY غير متوفر على الخادم';
  }

  // -------------------------------------------------------------
  // Strict: منع الردود الصامتة والوهمية (No Silent Mock Fallbacks)
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
    `تعذر اتصال الذكاء الاصطناعي: فشل المزود الأساسي (Gemini: ${cleanGemini}) وفشل المزود البديل (Groq: ${cleanGroq}). يرجى التحقق من اتصال الإنترنت ومفاتيح التشغيل في الإعدادات (Secrets).`
  );
}

// للتوافق مع أي استدعاء قديم
export const chatWithShamousa = handleShamousaChat;
export { isSuperAdmin };