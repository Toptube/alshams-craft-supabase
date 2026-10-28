import Groq from 'groq-sdk';

// إعداد عملاء الـ API
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

interface ShamousaContext {
  artistName: string;
  workshopName: string;
  treasuryBalance: number;
  cashAdvances: string; // العهد المفتوحة
}

// دالة الاتصال بـ Groq
async function callGroq(messages: any[]) {
  const completion = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.6,
    max_tokens: 800,
  });
  return completion.choices[0]?.message?.content;
}

// دالة الاتصال بالاحتياطي (Fanar API) لو Groq خلص
async function callFanar(messages: any[]) {
  const res = await fetch('https://api.fanar.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.FANAR_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'fanar-core-1',
      messages,
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error('Fanar API Failed');
  const data = await res.json();
  return data.choices[0]?.message?.content;
}

// بناء النظام بدون قيود بليدة
function getSystemPrompt(ctx: ShamousaContext) {
  return `أنتِ "شموسة": مديرة أعمال ورشة ${ctx.workshopName} وكاتمة أسرار ${ctx.artistName}.
طريقة التخاطب:
- رحبي بـ: "أهلاً يا ${ctx.artistName}، أنا مديرة أعمالك." بدون مقدمات مكررة أو كلمة "فنان".
- تعاملي كمديرة أعمال شاطرة واعية بكل تفصيلة داخلية.

بيانات الورشة الحالية:
- إجمالي السيولة النقدية والخزائن: ${ctx.treasuryBalance} ج.م.
- العهد النقدية: لديكِ سجل بمتابعة العهد المسلوبة والمصروفات والتسويات (مثل عهدة أدهم أو مستلزمات الخامات).
- الخامات، المنتجات، العمالة، وأوردرات العملاء.

تعليمات صارمة:
- لا تقولي إطلاقاً "هذا السؤال خارج نطاق بيانات الورشة" طالما السؤال يخص الخزينة، الفلوس، العهد، الخامات، الموردين، أو العملاء.
- لو سأل عن العهد أو الخزنة، أجيبي مباشرة من واقع الأرقام المتاحة وقدمي نصيحة تشغيلية بذكاء.
- صقر مختص فقط بالبحث الخارجي في السوق وتحليل الصور؛ لا تذكري صقر إلا إذا طلب ذلك صراحة.`;
}

// المعالج الذكي مع نظام التبديل الآلي (Fallback)
export async function handleShamousaChat(userMessage: string, history: any[], ctx: ShamousaContext) {
  const promptMessages = [
    { role: 'system', content: getSystemPrompt(ctx) },
    ...history.slice(-6).map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    // 1. المحاولة الأولى: Groq
    const reply = await callGroq(promptMessages);
    return { reply, provider: 'groq' };
  } catch (groqErr) {
    console.warn('Groq failed or limit reached. Switching to Fanar...', groqErr);
    try {
      // 2. التحويل التلقائي: Fanar
      const reply = await callFanar(promptMessages);
      return { reply, provider: 'fanar' };
    } catch (fanarErr) {
      console.error('All providers failed:', fanarErr);
      throw new Error('تعذر معالجة الطلب حالياً من جميع المزودات.');
    }
  }
}