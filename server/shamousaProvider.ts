import { GoogleGenAI } from '@google/genai';
import { workshopToolSchemas, runWorkshopTool, WorkshopToolContext } from './workshopTools.js';
import {
  isSuperAdmin,
  processTrainingInteraction,
  buildGlobalMemoryPrompt,
} from './aiGlobalMemory.js';

export interface ShamousaContext {
  artistName: string;
  workshopName: string;
  treasuryBalance?: number;
  cashAdvances?: string;
  workshopId: string;
  db: any;
  userEmail?: string;
  isSuperAdmin?: boolean;
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


// المحرك الاحتياطي المعتمد: Google Gemini Flash (مع دعم الرؤية الحاسوبية وقراءة الصور والفواتير)
async function callGeminiChat(
  systemInstruction: string,
  messages: any[],
  images?: Array<{ base64: string; mimeType?: string; name?: string }>
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY غير متوفر');

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  const contents: any[] = [];

  const nonSystemMessages = messages.filter((m) => m.role !== 'system').slice(-10);
  for (let i = 0; i < nonSystemMessages.length; i++) {
    const m = nonSystemMessages[i];
    const isLast = i === nonSystemMessages.length - 1;
    const parts: any[] = [{ text: String(m.content || '') }];

    if (isLast && Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img?.base64) {
          const cleanData = img.base64.replace(/^data:[^;]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: cleanData,
            },
          });
        }
      }
    }

    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    });
  }

  let lastGeminiError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`انتهت مهلة استجابة Gemini (${modelName})`)), 25000);
      });

      try {
        console.log(`[Shamousa] Calling Gemini model: ${modelName} (attempt ${attempt})${images && images.length > 0 ? ' [With Vision/Images]' : ''}`);
        const response: any = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: { parts: [{ text: systemInstruction }] },
            },
          }).finally(() => clearTimeout(timeoutId)),
          timeoutPromise,
        ]);

        const reply = response?.text?.trim();
        if (reply) return reply;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastGeminiError = err;
        const errMsg = String(err?.message || err || '');
        console.warn(`[Gemini Flash] Model ${modelName} (attempt ${attempt}) returned: ${errMsg.slice(0, 120)}`);
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('404')) {
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
        }
        break;
      }
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
هويتك حصرية وغير قابلة للتغيير:
- أنتِ "شموسة" مديرة أعمال الورشة وحافظة أسرارها ودفاترها المالية والتشغيلية، ويُمنع منعاً باتاً ومطلقاً الادعاء بأنك تتبعين أي شركة أو نموذج آخر مثل إي روبوت أو غيرها.
- شخصيتك ناضجة، واعية، ذكية، نشيطة، وتتحدثين بلهجة مصرية مهنية دافئة، أصيلة وجدعة (المصري الحرفي الجدع)، مرحة ومحترمة تفهم تفاصيل الورشة وتساعد في اتخاذ القرارات وحل المشاكل اليومية.
- لهجة الحديث الرسمية: اللهجة المصرية العامية الأصيلة والدافئة والذكية، إلا إذا كتب المستخدم بلغة أخرى أو طلب التحدث بلغة محددة فتجيبين بلغته المختارة باحترافية.

قواعد الخطاب والهوية الصارمة:
1. الترحيب عند بدء الحديث:
   تخاطبين صاحب الورشة باسمه الأول مباشرة وبلطف وود:
   "أهلاً يا ${firstName} 🌞، أنا مديرة أعمالك. اخبارك ايه! واخبار شغلنا ايه ! يارب يكون كل حاجه تمام ... تحب نبدأ إزاي النهارده؟!"
   (ممنوع منعاً باتاً مناداة المستخدم بـ "صاحب الورشة" أو إعطاء مقدمات إنشائية فارغة).

2. كسر القيود المصطنعة والدقة الرقمية:
   - ممنوع تماماً ومطلقاً أن تردي بجملة "هذا السؤال خارج نطاق بيانات الورشة" على أي استفسار يخص الخزائن، الفلوس، العهد، الخامات، الأوردرات، أو أوامر التشغيل.
   - افهمي الكلمات والأخطاء الإملائية والعامية المصرية بذكاء (مثلاً: "خزنه"، "عهده"، "خامات"، "فلوس"، "كام معانا"، "النواقص"، "أوامر التشغيل").
   - اشرحي بالأرقام الحقيقية المباشرة المرفقة في سياق الورشة الحية أدناه ولا تخترعي أرقاماً وهمية.

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

لديكِ أدوات استعلام فعلية متصلة بقاعدة البيانات (search_treasuries, search_materials, search_orders, search_customers, search_suppliers, search_employees, workshop_overview). استخدميها كلما احتجتِ تفاصيل أوفى عن منتج محدد أو خامة معينة.`;
}

export async function handleShamousaChat(
  userMessage: string,
  history: any[],
  ctx: ShamousaContext,
  images?: Array<{ base64: string; mimeType?: string; name?: string }>
): Promise<{ reply: string; handoffToFalcon?: boolean; provider: string; inTrainingMode?: boolean }> {
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

  // إذا تم إرفاق صور، يتم توجيه الطلب حصرياً ومباشرة لمحرك الرؤية الحاسوبية Gemini Flash
  if (hasImages && process.env.GEMINI_API_KEY) {
    console.log('[AI Service: Shamousa] Images attached -> Routing directly to Gemini Flash Vision...');
    try {
      const geminiVisionReply = await callGeminiChat(systemInstruction, promptMessages, images);
      if (geminiVisionReply) {
        console.log('[AI Service: Shamousa] Gemini Flash Vision succeeded.');
        return { reply: geminiVisionReply, handoffToFalcon: false, provider: 'gemini_vision' };
      }
    } catch (gErr: any) {
      console.warn('[AI Service: Shamousa] Gemini Vision initial attempt failed:', gErr?.message);
    }
  }

  // -------------------------------------------------------------
  // Provider 1: Groq API (Primary -> Secondary for fast text)
  // -------------------------------------------------------------
  const groqKeyToUse = !hasImages ? (groqPrimary || groqSecondary) : undefined;
  if (groqKeyToUse) {
    console.log('[AI Service: Shamousa] Attempting Provider 1 (Groq)...');
    try {
      const reply = await tryGroqExecution(groqKeyToUse);
      if (reply) {
        console.log('[AI Service: Shamousa] Provider 1 (Groq) succeeded.');
        return { reply, handoffToFalcon: false, provider: 'groq' };
      }
      groqFailReason = 'Empty response from Groq';
    } catch (groqErr: any) {
      groqFailReason = groqErr?.message || 'Groq connection failed';
      console.warn(
        `[AI Service: Shamousa] Attempting Provider 1 (Groq)... Failed: [${groqFailReason}] -> Switching to Provider 2 (Gemini Flash)...`
      );
    }
  } else if (!hasImages) {
    groqFailReason = 'GROQ_API_KEY غير متوفر على الخادم';
    console.log(`[AI Service: Shamousa] Provider 1 (Groq) skipped: ${groqFailReason} -> Switching to Provider 2 (Gemini Flash)...`);
  }

  // -------------------------------------------------------------
  // Provider 2: Google Gemini Flash (gemini-3.8-flash)
  // -------------------------------------------------------------
  if (process.env.GEMINI_API_KEY) {
    console.log('[AI Service: Shamousa] Attempting Provider 2 (Gemini Flash)...');
    try {
      const geminiReply = await callGeminiChat(systemInstruction, promptMessages, images);
      if (geminiReply) {
        console.log('[AI Service: Shamousa] Switching to Provider 2 (Gemini Flash)... Success!');
        return { reply: geminiReply, handoffToFalcon: false, provider: 'gemini' };
      }
      geminiFailReason = 'Empty response from Gemini Flash';
    } catch (geminiErr: any) {
      geminiFailReason = geminiErr?.message || 'Gemini Flash connection failed';
      console.error(`[AI Service: Shamousa] Provider 2 (Gemini Flash) failed: [${geminiFailReason}]`);
    }
  } else {
    geminiFailReason = 'GEMINI_API_KEY غير متوفر على الخادم';
  }


  // -------------------------------------------------------------
  // Strict: منع الردود الصامتة والوهمية (No Silent Mock Fallbacks)
  // إذا فشل المزودان، إرجاع تنبيه صريح ومباشر يوضح السبب الحقيقي
  // -------------------------------------------------------------
  console.error(`[AI Service: Shamousa] Both providers failed! Provider 1: ${groqFailReason} | Provider 2: ${geminiFailReason}`);

  throw new Error(
    `تعذر اتصال الذكاء الاصطناعي: فشل المزود الأساسي (Groq: ${groqFailReason}) وفشل المزود البديل (Gemini Flash: ${geminiFailReason}). يرجى التحقق من اتصال الإنترنت أو تحديث مفاتيح التشغيل على الخادم.`
  );
}

// للتوافق مع أي استدعاء قديم
export const chatWithShamousa = handleShamousaChat;
export { isSuperAdmin };