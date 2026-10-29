import { workshopToolSchemas, runWorkshopTool, WorkshopToolContext } from './workshopTools.js';
import { buildGlobalMemoryPrompt } from './aiGlobalMemory.js';

export interface ShamousaContext {
  artistName: string;
  workshopName: string;
  treasuryBalance?: number;
  cashAdvances?: string;
  workshopId: string;
  db: any;
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

// الاتصال بـ Groq عبر fetch المدمج بدون الحاجة لـ groq-sdk لتجنب ERR_MODULE_NOT_FOUND
async function callGroqChat(messages: any[], tools?: any[]) {
  const apiKey = process.env.GROQ_API_KEY;
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
async function callFanarChat(messages: any[]) {
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
): Promise<{ reply: string; handoffToFalcon?: boolean; provider: string }> {
  const toolCtx: WorkshopToolContext = {
    db: ctx.db,
    workshopId: ctx.workshopId,
    isSuperAdmin: Boolean(ctx.isSuperAdmin),
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

  // 1. المحاولة الأساسية عبر Groq مع Function Calling
  try {
    let assistantMsg = await callGroqChat(promptMessages, workshopToolSchemas);

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

      const secondTurnRes = await callGroqChat(secondTurnMessages);
      const reply = secondTurnRes?.content?.trim();
      if (reply) {
        return { reply, handoffToFalcon: false, provider: 'groq' };
      }
    }

    if (assistantMsg?.content) {
      return { reply: assistantMsg.content.trim(), handoffToFalcon: false, provider: 'groq' };
    }
  } catch (groqErr: any) {
    console.warn('[Shamousa] Groq failed, switching to Fanar fallback:', groqErr?.message);
  }

  // 2. المحرك الاحتياطي: Fanar API
  try {
    const fanarReply = await callFanarChat(promptMessages);
    if (fanarReply) {
      return { reply: fanarReply, handoffToFalcon: false, provider: 'fanar' };
    }
  } catch (fanarErr: any) {
    console.error('[Shamousa] Fanar fallback failed too:', fanarErr?.message);
  }

  // 3. Fallback محلي ذكي إذا تعذر الاتصال بأي مزود خارجي لضمان عدم توقف الرد على رصيد الخزينة
  const norm = userMessage.toLowerCase();
  if (norm.includes('خزن') || norm.includes('خزينه') || norm.includes('رصيد') || norm.includes('سيول') || norm.includes('فلوس') || norm.includes('معانا كام')) {
    const reply = `أهلاً يا ${extractFirstName(ctx.artistName) || 'صديقي'} 🌞، رصيد الخزائن والسيولة المتوفرة حالياً في الورشة هو **${liveLiquidity.toLocaleString('ar-EG')} ج.م**.\n${treasuriesDetailText ? `\nتفاصيل الأرصدة والعهد:\n${treasuriesDetailText}` : ''}`;
    return { reply, handoffToFalcon: false, provider: 'internal_cache' };
  }

  throw new Error('تعذر معالجة الطلب حالياً من جميع المزودات، يرجى المحاولة بعد قليل.');
}

// للتوافق مع أي استدعاء قديم
export const chatWithShamousa = handleShamousaChat;