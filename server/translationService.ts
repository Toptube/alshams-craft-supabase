import { GoogleGenAI } from '@google/genai';

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  tr: 'Turkish',
  nl: 'Dutch',
};

function resolveTranslationGeminiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.FALCON_GEMINI_API_KEY,
    process.env.SHAMOUSA_GEMINI_API_KEY,
    process.env.GOOGLE_SEARCH_GEMINI_API_KEY,
    process.env.API_KEY,
  ];
  for (const k of candidates) {
    if (k && k.trim().length > 10) return k.trim();
  }
  return '';
}

function extractJsonObject(raw: string): Record<string, string> | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v.trim();
      }
      return out;
    }
  } catch {}
  return null;
}

export async function translateFieldsBatch(
  fields: Record<string, string>,
  targetLang: string,
  sourceLang = 'ar'
): Promise<{ success: boolean; translations?: Record<string, string>; error?: string }> {
  const targetName = LANG_NAMES[targetLang] || 'English';
  const sourceName = LANG_NAMES[sourceLang] || 'Arabic';

  const cleanFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (typeof v === 'string' && v.trim()) {
      cleanFields[k] = v.trim().slice(0, 1800);
    }
  }
  if (Object.keys(cleanFields).length === 0) {
    return { success: false, error: 'لا توجد نصوص للترجمة' };
  }

  const prompt = `You are a professional e-commerce & handmade craft brand translator.
Translate every value in the following JSON object from ${sourceName} into natural, attractive, commercial ${targetName} suitable for an online handmade craft storefront or artisan profile.
Rules:
- Keep ALL JSON keys EXACTLY unchanged.
- Return ONLY a valid raw JSON object (no markdown fences, no commentary).
- Preserve brand tone, measurements, and numbers naturally.

Input JSON:
${JSON.stringify(cleanFields, null, 2)}`;

  // 1. Primary: Gemini 3.1 Flash Lite via @google/genai
  const geminiKey = resolveTranslationGeminiKey();
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.25,
        },
      });
      const text = response.text || '';
      const parsed = extractJsonObject(text);
      if (parsed && Object.keys(parsed).length > 0) {
        return { success: true, translations: parsed };
      }
    } catch (err: any) {
      console.warn('[TranslationService] Gemini fallback triggered:', err?.message?.slice(0, 120));
    }
  }

  // 2. Secondary fallback: Groq fast LLM if configured
  const groqKey = (
    process.env.GROQ_API_KEY ||
    process.env.FALCON_GROQ_API_KEY ||
    process.env.SHAMOUSA_GROQ_API_KEY ||
    ''
  ).trim();
  if (groqKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'Return ONLY a valid JSON object matching the input keys.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (groqRes.ok) {
        const data: any = await groqRes.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const parsed = extractJsonObject(content);
        if (parsed && Object.keys(parsed).length > 0) {
          return { success: true, translations: parsed };
        }
      }
    } catch (err: any) {
      console.warn('[TranslationService] Groq fallback failed:', err?.message?.slice(0, 120));
    }
  }

  return {
    success: false,
    error: 'تعذرت الترجمة التلقائية مؤقتاً — يمكنك كتابة الترجمة يدوياً في الحقول أدناه.',
  };
}
