import { GoogleGenAI } from '@google/genai';
import { workshopToolSchemas, runWorkshopTool, type WorkshopToolContext } from './workshopTools';

/**
 * "شموسة" — مساعدة البيانات في منظومة الشمساوية
 * -------------------------------------------------------------
 * متخصصة في البحث داخل قاعدة بيانات ورشة الفنان نفسه فقط (خامات، منتجات، أكواد، أسعار البيع).
 * أي سؤال عن تسعير السوق أو تحليل صور أو استشارة فنية => تحوّله لـ "صقر الشمساوية".
 *
 * المزوّد:
 *  1) Groq (خطة مجانية مستقلة) لو GROQ_API_KEY موجود — حصة منفصلة تماماً عن صقر.
 *  2) Gemini (موديل Flash-Lite مختلف عن موديل صقر => حصة يومية منفصلة) كاحتياطي تلقائي.
 * كل المفاتيح على السيرفر فقط ولا تُرسل للمتصفح أبداً.
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

function buildSystemPrompt(brandName?: string, currency?: string): string {
  return `أنتِ "شموسة"، مساعدة البيانات الذكية في منظومة الشمساوية لفناني الهاند ميد${brandName ? `، وتعملين الآن لورشة "${brandName}"` : ''}.
تخصصك الوحيد: البحث في بيانات هذه الورشة (الخامات، المنتجات، الأكواد، أسعار البيع، الموردين، المواصفات).

القواعد:
- لأي سؤال عن بيانات الورشة استخدمي الأدوات أولاً (search_materials, search_products, get_product_details, workshop_overview) ولا تجاوبي من الذاكرة.
- لو الأداة رجعت نتائج فاضية قولي بوضوح إنك ما لقيتيش ده في بيانات الورشة، واقترحي كلمة بحث تانية. ممنوع تخترعي منتجات أو أسعار.
- العملة: ${currency || 'ج.م'}.
- ردودك قصيرة وواضحة بالعربي الودود، واعرضي القوائم في نقاط (اسم المنتج — الكود — السعر).
- لا تذكري أي معرّف (id) ولا اسم نموذج ذكاء اصطناعي ولا شركة تقنية.
- أسئلة تسعير السوق والمنافسين، تحليل صور المنتجات، حساب التكاليف الهندسية، الباترونات والاستشارات الفنية والتعليمية = تخصص زميلك "صقر الشمساوية". في الحالة دي اعتذري بلطف في جملة واحدة ووجّهي الفنان لصقر، واكتبي في آخر ردك العلامة ${HANDOFF_MARK} بالظبط.`;
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

// -------------------------------------------------------------
// Groq (OpenAI-compatible) — مجاني بدون كارت
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
// Gemini احتياطي (موديل مختلف عن صقر => حصة منفصلة)
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
  return Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);
}

export async function chatWithShamousa(input: ShamousaChatInput): Promise<ShamousaChatResult> {
  if (process.env.GROQ_API_KEY) {
    try {
      return await chatWithGroq(input);
    } catch (err: any) {
      // 429 / عطل مؤقت في Groq => تحويل تلقائي لـ Gemini لو متاح
      console.warn('[Shamousa] Groq failed, falling back to Gemini:', err?.status || '', err?.message?.slice(0, 120));
      if (!getGemini()) throw err;
    }
  }
  return chatWithGemini(input);
}
