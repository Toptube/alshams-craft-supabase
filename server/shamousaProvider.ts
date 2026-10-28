interface ShamousaContext {
  artistName: string;
  workshopName: string;
  treasuryBalance: number;
  cashAdvances?: string;
}

// الاتصال بـ Groq عبر fetch المدمج بدون الحاجة لـ groq-sdk
async function callGroq(messages: any[]) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY غير متوفر');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.5,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

// المحرك الاحتياطي: Fanar API
async function callFanar(messages: any[]) {
  const apiKey = process.env.FANAR_API_KEY;
  if (!apiKey) throw new Error('FANAR_API_KEY غير متوفر');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

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
        temperature: 0.5,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Fanar HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

function getSystemPrompt(ctx: ShamousaContext) {
  return `أنتِ "شموسة": مديرة أعمال ورشة ${ctx.workshopName || 'الورشة'} وكاتمة أسرار ${ctx.artistName || 'صاحب الورشة'}.
طريقة التخاطب:
- الترحيب: "أهلاً يا ${ctx.artistName || ''} 🌞، أنا مديرة أعمالك." باختصار ومباشرة وبدون كلمة "فنان".
- تعاملي كمديرة أعمال شاطرة تدير تفاصيل الورشة الداخلية.

البيانات والسيولة:
- إجمالي السيولة النقدية والخزائن: ${ctx.treasuryBalance} ج.م.
- العهد النقدية: لديكِ متابعة مستمرة للعهد المسلمة والمصروفات والتسويات.
- لا تقولي إطلاقاً "هذا السؤال خارج نطاق بيانات الورشة" لأي استفسار يخص الخزينة، الفلوس، العهد، الخامات، أو الموردين.
- صقر مختص فقط بالسوق الخارجي ودراسة الأسعار؛ لا تحيلي المستخدم إليه إلا إذا طلب دراسة سوق أو فحص صور.`;
}

export async function handleShamousaChat(userMessage: string, history: any[], ctx: ShamousaContext) {
  const promptMessages = [
    { role: 'system', content: getSystemPrompt(ctx) },
    ...history.slice(-6).map((m: any) => ({
      role: m.role === 'assistant' || m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.content || m.text || '',
    })),
    { role: 'user', content: userMessage },
  ];

  // 1. المحاولة الأولى: Groq
  try {
    const reply = await callGroq(promptMessages);
    if (reply) return { reply, provider: 'groq' };
  } catch (groqErr: any) {
    console.warn('[Shamousa] Groq failed, switching to Fanar fallback:', groqErr?.message);
  }

  // 2. المحرك الاحتياطي: Fanar
  try {
    const reply = await callFanar(promptMessages);
    if (reply) return { reply, provider: 'fanar' };
  } catch (fanarErr: any) {
    console.error('[Shamousa] Fanar fallback failed too:', fanarErr?.message);
  }

  throw new Error('تعذر معالجة الطلب حالياً من جميع المزودات.');
}