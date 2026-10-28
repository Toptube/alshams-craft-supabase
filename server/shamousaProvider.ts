import { GoogleGenAI } from '@google/genai';
import { workshopToolSchemas, runWorkshopTool, type WorkshopToolContext } from './workshopTools';

/**
 * "شموسة" — مساعد بيانات ورشة الفنان فقط.
 * -------------------------------------------------------------
 * قاعدة بيانات المشروع هي Supabase فقط، ولا نسمح بإدخال مزود أو مصدر بيانات بديل.
 *
 * ترتيب العمل:
 *  1) Groq — primary provider لبحث بيانات الورشة.
 *  2) Gemini — backup فقط إذا فشل Groq أو لم يتوفر.
 *  3) إذا سأل عن شيء خارج نطاق الورشة أو خارج البيانات الداخلية، نرسل إشارة [[FALCON]]
 *     ليفتح صقر الشمساوية، ويعمل هذا على Gemini + بحث Google حسب حالة الاستخدام.
 *
 * الهدف: شموسة قوية في البحث داخل بيانات الورشة فقط، وصقر هو المساعد العام.
 */

export interface ShamousaChatInput {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  ctx: WorkshopToolContext;
  brandName?: string;
  currency?: string;
}

export interface ShamousaChatResult {
  reply: string;
  handoffToFalcon: boolean;
  provider: 'groq' | 'gemini';
}

const HANDOFF_MARK = '[[FALCON]]';
const MAX_TOOL_ROUNDS = 4;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.SHAMOUSA_GROQ_MODEL || 'openai/gpt-oss-120b';
const GEMINI_MODEL = process.env.SHAMOUSA_GEMINI_MODEL || 'gemini-flash-lite-latest';
const SHAMOUSA_PROVIDER_ORDER = ['groq', 'gemini'] as const;

function buildSystemPrompt(brandName?: string, currency?: string): string {
  return `أنتِ "شموسة"، مساعد بيانات ورشة الفنان في منظومة الشمساوية${brandName ? `، وتعملين الآن لورشة "${brandName}"` : ''}.

اختصاصك الوحيد: البحث داخل بيانات هذه الورشة فقط (الخامات، المنتجات، الأكواد، الأسعار، الموردين، المواصفات).

القواعد:
- استخدمي الأدوات أولاً عند وجود سؤال عن بيانات الورشة: search_materials, search_products, get_product_details, workshop_overview.
- لو ما لقيتيش النتيجة في بيانات الورشة، قولي بوضوح إن هذا ليس موجودًا داخل بيانات الورشة واقترحي كلمة بحث أخرى.
- لا تختلقي منتجات أو أسعار أو أكواد.
- لا تردي على أسئلة خارج نطاق الورشة مثل التسعير الخارجي، تحليل الصور، الاستشارات الفنية، أو تصميمات/باترونات/دراسة السوق.
- إذا كان السؤال خارج النطاق أو يحتاج رأيًا خارجيًا أو صورة أو بحث عام، أضيفي علامة [[FALCON]] في آخر الرد، مع رسالة قصيرة جدًا تشير إلى أن هذا خارج اختصاصك.
- العملة: ${currency || 'ج.م'}.
- الإجابة قصيرة وواضحة بالعربي، وتُعرض غالبًا في نقاط.
- لا تذكري أي معرفات أو أسماء نماذج أو شركات.
`;
}

function finalize(text: string, provider: 'groq' | 'gemini'): ShamousaChatResult {
  const raw = (text || '').trim();
  const handoffToFalcon = raw.includes(HANDOFF_MARK);
  const reply = raw.replaceAll(HANDOFF_MARK, '').trim() || 'معلش، ما قدرتش أطلع رد واضح. جرّب تسأل بطريقة تانية.';
  return { reply, handoffToFalcon, provider };
}

function cleanHistory(history: ShamousaChatInput['history']) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content.slice(0, 2000) }))
    .slice(-8);
}

function getAvailableShamousaProviders(): Array<'groq' | 'gemini'> {
  const providers: Array<'groq' | 'gemini'> = [];
  for (const provider of SHAMOUSA_PROVIDER_ORDER) {
    if (provider === 'groq' && !!process.env.GROQ_API_KEY) providers.push('groq');
    if (provider === 'gemini' && !!process.env.GEMINI_API_KEY) providers.push('gemini');
  }
  return providers;
}

// -------------------------------------------------------------
// Groq (OpenAI-compatible) — primary provider
// -------------------------------------------------------------
async function chatWithGroq(input: ShamousaChatInput): Promise<ShamousaChatResult> {
  const apiKey = process.env.GROQ_API_KEY as string;
  const messages: any[] = [
    { role: 'system', content: buildSystemPrompt(input.brandName, input.currency) },
    ...cleanHistory(input.history),
    { role: 'user', content: input.message },
  ];
  const tools = workshopToolSchemas.map((t) => ({ type: 'function', function: t }));

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const body: any = {
      model: GROQ_MODEL,
      messages,
      temperature: 0.3,
      max_completion_tokens: 1024,
      ...(round < MAX_TOOL_ROUNDS ? { tools, tool_choice: 'auto' } : {}),
      ...(GROQ_MODEL.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
    };

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err: any = new Error(`Groq ${res.status}: ${errText.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }

    const data: any = await res.json();
    const msg = data?.choices?.[0]?.message || {};
    const calls: any[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (calls.length === 0) return finalize(msg.content || '', 'groq');

    messages.push({ role: 'assistant', content: msg.content || '', tool_calls: calls });
    for (const call of calls) {
      let args: any = {};
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await runWorkshopTool(call.function?.name || '', args, input.ctx);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return finalize('', 'groq');
}

// -------------------------------------------------------------
// Gemini — backup only
// -------------------------------------------------------------
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return geminiClient;
}

async function chatWithGemini(input: ShamousaChatInput): Promise<ShamousaChatResult> {
  const ai = getGemini();
  if (!ai) throw new Error('لا يوجد مزوّد متاح لشموسة');

  const contents: any[] = cleanHistory(input.history).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  while (contents.length && contents[0].role === 'model') contents.shift();
  contents.push({ role: 'user', parts: [{ text: input.message }] });

  const config: any = {
    systemInstruction: { parts: [{ text: buildSystemPrompt(input.brandName, input.currency) }] },
    tools: [
      {
        functionDeclarations: workshopToolSchemas.map((t) => ({
          name: t.name,
          description: t.description,
          parametersJsonSchema: t.parameters,
        })),
      },
    ],
  };

  let response: any = null;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    response = await ai.models.generateContent({ model: GEMINI_MODEL, contents, config });
    const calls = response.functionCalls || [];
    if (calls.length === 0) break;
    contents.push(response.candidates?.[0]?.content || { role: 'model', parts: calls.map((fc: any) => ({ functionCall: fc })) });
    const parts: any[] = [];
    for (const call of calls) {
      const result = await runWorkshopTool(call.name || '', call.args || {}, input.ctx);
      parts.push({ functionResponse: { id: call.id, name: call.name, response: result } });
    }
    contents.push({ role: 'user', parts });
  }

  return finalize(response?.text || '', 'gemini');
}

export function isShamousaAvailable(): boolean {
  return getAvailableShamousaProviders().length > 0;
}

export async function chatWithShamousa(input: ShamousaChatInput): Promise<ShamousaChatResult> {
  const providers = getAvailableShamousaProviders();
  if (!providers.length) {
    throw new Error('شموسة غير مفعّلة حالياً على الخادم');
  }

  for (const provider of providers) {
    try {
      if (provider === 'groq') return await chatWithGroq(input);
      if (provider === 'gemini') return await chatWithGemini(input);
    } catch (err: any) {
      console.warn(`[Shamousa] ${provider} failed, trying next provider:`, err?.status || '', err?.message?.slice(0, 120));
    }
  }

  throw new Error('كل مزوّدات شموسة غير متاحة الآن');
}

export const shamousaProviderOrder = SHAMOUSA_PROVIDER_ORDER;
