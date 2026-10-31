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

// الاتصال بـ Groq عبر fetch المدمج بدون الحاجة لـ groq-sdk لتجنب ERR_MODULE_NOT_FOUND
async function callGroqChat(messages: any[], tools?: any[], customApiKey?: string) {
  const apiKey = customApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY غير متوفر');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  const payload: any = {
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.6,
    max_tokens: 1200,
  };

  if (Array.isArray(tools) && tools.length > 0) {
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
      const errText = await res.text().catch(() => '');
      throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message;
  } finally {
    clearTimeout(timer);
  }
}

// المحرك الاحتياطي: Fanar API
async function callFanarChat(messages: any[]): Promise<string> {
  const apiKey = process.env.FANAR_API_KEY;
  if (!apiKey) throw new Error('FANAR_API_KEY غير متوفر');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://api.fanar.qa/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.FANAR_MODEL || 'Fanar',
        messages,
        temperature: 0.6,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Fanar HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

// المحرك الاحتياطي الثالث: Gemini API (gemini-2.5-flash / gemini-1.5-flash)
async function callGeminiChat(systemInstruction: string, messages: any[]): Promise<string> {
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

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents: any[] = [];

  for (const m of messages.slice(-10)) {
    if (m.role === 'system') continue;
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        abortSignal: controller.signal,
      },
    });
    return response.text?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

function buildShamousaSystemPrompt(ctx: ShamousaContext, liveLiquidity: number, treasuriesListDesc: string): string {
  const firstName = extractFirstName(ctx.artistName) || 'يا غالي';
  const workshopName = ctx.workshopName || 'ورشة الشمس كرافت';

  return `أنتِ "شموسة" 🌞 — مديرة الأعمال التنفيذية الذكية والشريكة الأولى والواعية في ${workshopName}.
أنتِ مديرة الورشة وحافظة أسرارها ودفاترها المالية والتشغيلية، شخصيتك ناضجة، واعية، ذكية، نشيطة، وتتحدثين بلهجة مصرية مهنية دافئة، مرحة ومحترمة تفهم تفاصيل وحركات الورشة وتساعد في اتخاذ القرارات وحل المشاكل.

قواعد الخطاب والهوية الصارمة:
1. الترحيب عند بدء الحديث:
   تخاطبين صاحب الورشة باسمه الأول مباشرة وبلطف وود:
   "أهلاً يا ${firstName} 🌞، أنا مديرة أعمالك.اخبارك ايه! واخبار شغلنا ايه ! يارب يكون كل حاجه تمام ... تحب نبدأ إزاي النهارده؟!"
   (ممنوع منعاً باتاً مناداة المستخدم بـ "صاحب الورشة" أو "يا فنان" أو إعطاء رغي ومقدمات إنشائية طويلة).

2. كسر القيود المصطنعة:
   - ممنوع تماماً ومطلقاً أن تردي بجملة "هذا السؤال خارج نطاق بيانات الورشة" على أي استفسار يخص الخزائن، الفلوس، العهد، الخامات، الأوردرات، العملاء، الموردين، أو الموظفين.
   - افهمي الكلمات والأخطاء الإملائية والعامية المصرية بذكاء (مثلاً: "خزنه"، "عهده"، "خامات"، "فلوس"، "كام معانا").
   - لا تلقي أزرار تنقل في وجه المستخدم دون إجابة؛ اشرحي بالأرقام الحقيقية المباشرة أولاً.
   - شموسة تجلب البيانات وتجيب بنفسها، ولا تحول المستخدم لـ "صقر" في أي موضوع مالي أو داخلي للورشة. صقر فقط مخصص لدراسة الأسواق والمنافسين الخارجيين وفحص صور الموديلات عند طلب ذلك تحديداً.

البيانات والسيولة الفعلية المسجلة حالياً في الورشة:
- إجمالي رصيد الخزائن والسيولة النقدية المتوفرة: ${liveLiquidity.toLocaleString('ar-EG')} ج.م (${liveLiquidity} ج.م).
- تفاصيل الخزن والعهد المسجلة:
${treasuriesListDesc || 'الخزينة النقدية الرئيسية متوفرة ومسجلة في دفاتر الورشة.'}
- عندما يسألك ${firstName} عن رصيد الخزنة أو الفلوس أو السيولة أو عهدة معينة: أجيبي فوراً بالرقم الفعلي المسجل (${liveLiquidity.toLocaleString('ar-EG')} ج.م) وبكل تفاصيل العهد المسجلة دون تردد ودون أن تقولي غير متوفر ودون أن ترشحي صقر إطلاقاً!

لديكِ أدوات استعلام فعلية متصلة بقاعدة البيانات (search_treasuries, search_materials, search_orders, search_customers, search_suppliers, search_employees, workshop_overview). استخدميها كلما احتجتِ تفاصيل أوفى عن المنتجات أو الخامات أو مواعيد التسليم.`;
}

export async function handleShamousaChat(
  userMessage: string,
  history: any[],
  ctx: ShamousaContext
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

  // 1. قراءة السيولة الحقيقية والخزن مباشرة لضمان تمريرها للـ System Prompt
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
    console.warn('[Shamousa] Pre-fetching treasuries failed, using client fallback:', err?.message);
  }

  // إذا لم نجد تفاصيل ولكن العميل أرسل تفاصيل أو رصيد (مثل 85000 ج.م)
  if (!treasuriesDetailText && Array.isArray(ctx.clientContext?.treasuriesDetail) && ctx.clientContext!.treasuriesDetail.length > 0) {
    treasuriesDetailText = ctx.clientContext!.treasuriesDetail
      .map((t: any) => `- ${t.name || 'خزينة'}: ${Number(t.balance || t.amount || 0).toLocaleString('ar-EG')} ج.م`)
      .join('\n');
  }

  const baseInstruction = buildShamousaSystemPrompt(ctx, liveLiquidity, treasuriesDetailText);
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

  async function tryGroqExecution(key: string): Promise<string | null> {
    const assistantMsg = await callGroqChat(promptMessages, workshopToolSchemas, key);

    // التحقق من استدعاء الأدوات (Tool Calling)
    if (assistantMsg?.tool_calls && Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
      const toolCall = assistantMsg.tool_calls[0];
      const fnName = toolCall.function?.name;
      let fnArgs = {};
      try {
        fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
      } catch {}

      console.log(`[Shamousa Groq Tool Call]: ${fnName}`, fnArgs);
      const toolResult = await runWorkshopTool(fnName, fnArgs, toolCtx);

      // تمرير نتيجة الأداة للنموذج لإتمام الصياغة الإنسانية الذكية
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

  // 1. مزود Groq (المفتاح الأساسي)
  if (groqPrimary) {
    try {
      const reply = await tryGroqExecution(groqPrimary);
      if (reply) return { reply, handoffToFalcon: false, provider: 'groq' };
    } catch (groqErr: any) {
      console.warn('[Shamousa] Groq primary notice. Switching to secondary key...', groqErr?.message);
    }
  }

  // 2. مزود Groq (المفتاح الثانوي البديل)
  if (groqSecondary) {
    try {
      const reply2 = await tryGroqExecution(groqSecondary);
      if (reply2) return { reply: reply2, handoffToFalcon: false, provider: 'groq' };
    } catch (groq2Err: any) {
      console.warn('[Shamousa] Groq secondary notice. Switching to Gemini Flash...', groq2Err?.message);
    }
  }

  // 3. مزود Gemini Flash (المفتاح النشط)
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiReply = await callGeminiChat(systemInstruction, promptMessages);
      if (geminiReply) {
        return { reply: geminiReply, handoffToFalcon: false, provider: 'gemini' };
      }
    } catch (geminiErr: any) {
      console.warn('[Shamousa] Gemini notice. Switching to Fanar...', geminiErr?.message);
    }
  }

  // 4. مزود فنار (Fanar) - الاحتياطي النهائي في كافة الأحوال
  if (process.env.FANAR_API_KEY) {
    try {
      const fanarReply = await callFanarChat(promptMessages);
      if (fanarReply) {
        return { reply: fanarReply, handoffToFalcon: false, provider: 'fanar' };
      }
    } catch (fanarErr: any) {
      console.warn('[Shamousa] Fanar fallback notice:', fanarErr?.message);
    }
  }

  // 4. المحرك المحلي الذكي لحماية الصانع من أي انقطاع في الشبكة أو نفاد الحصص
  const norm = userMessage.toLowerCase();
  const firstName = extractFirstName(ctx.artistName) || 'يا غالي';
  if (norm.includes('خزن') || norm.includes('خزينه') || norm.includes('رصيد') || norm.includes('سيول') || norm.includes('فلوس') || norm.includes('معانا كام')) {
    const reply = `أهلاً يا ${firstName} 🌞، رصيد الخزائن والسيولة المتوفرة حالياً في الورشة هو **${liveLiquidity.toLocaleString('ar-EG')} ج.م**.\n${treasuriesDetailText ? `\nتفاصيل الأرصدة والعهد:\n${treasuriesDetailText}` : ''}`;
    return { reply, handoffToFalcon: false, provider: 'internal_cache' };
  }

  // رد شموسة الودود والواعي بحالة الورشة بدون إظهار أخطاء تقنية مزعجة
  const defaultReply = `أهلاً يا ${firstName} 🌞، معاك شموسة مديرة أعمال ورشتك. سجلات الورشة متوفرة تحت إيدك: إجمالي سيولتنا النقدية المسجلة حالياً هو **${liveLiquidity.toLocaleString('ar-EG')} ج.م**، وأنا متابعة معاك كل تفاصيل الخامات والأوردرات والخزن لحظة بلحظة. تحب نراجع إيه مع بعض دلوقتي؟!`;
  return { reply: defaultReply, handoffToFalcon: false, provider: 'internal_cache' };
}

// للتوافق مع أي استدعاء قديم
export const chatWithShamousa = handleShamousaChat;
export { isSuperAdmin };