import { GoogleGenAI } from '@google/genai';
import {
  cleanSecretValue,
  getCandidateGeminiModels,
  getGroqApiKeys,
  getFanarApiKey,
  isGeminiKeyCircuitOpen,
} from './googleSearchService.js';

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

function collectTranslationGeminiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY_SHAMOUSA,
    process.env.SHAMOUSA_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALCON_CHAT,
    process.env.FALCON_CHAT_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALCON_VISION,
    process.env.FALCON_VISION_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALCON,
    process.env.FALCON_GEMINI_API_KEY,
    process.env.GOOGLE_SEARCH_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
  ]
    .map((k) => cleanSecretValue(k))
    .filter((k) => k.length > 10);

  const unique = Array.from(new Set(candidates));
  const healthy = unique.filter((k) => !isGeminiKeyCircuitOpen(k));
  return healthy.length > 0 ? healthy : unique;
}

function extractJsonObject(raw: string): Record<string, string> | null {
  try {
    const cleaned = String(raw || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
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
        if (typeof v === 'string' && v.trim()) out[k] = v.trim();
      }
      return out;
    }
  } catch {}
  return null;
}

async function translateSingleViaMyMemory(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.slice(0, 480)
    )}&langpair=${encodeURIComponent(`${sourceLang}|${targetLang}`)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data: any = await res.json();
    const translated = String(data?.responseData?.translatedText || '').trim();
    if (
      translated &&
      !translated.toUpperCase().includes('MYMEMORY WARNING') &&
      translated.toLowerCase() !== text.trim().toLowerCase()
    ) {
      return translated;
    }
    return translated || null;
  } catch {
    return null;
  }
}

export async function translateFieldsBatch(
  fields: Record<string, string>,
  targetLang: string,
  sourceLang = 'ar'
): Promise<{ success: boolean; translations?: Record<string, string>; provider?: string; error?: string }> {
  const targetCode = String(targetLang || 'en').toLowerCase().trim();
  const sourceCode = String(sourceLang || 'ar').toLowerCase().trim();
  const targetName = LANG_NAMES[targetCode] || 'English';
  const sourceName = LANG_NAMES[sourceCode] || 'Arabic';

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
Translate every string value in the JSON object below from ${sourceName} into natural, attractive, commercial ${targetName} suitable for an online handmade craft storefront, product listing, size/color label, or artisan profile.
Strict rules:
- Keep ALL JSON keys EXACTLY unchanged.
- Return ONLY a valid raw JSON object (no markdown fences, no commentary, no thinking tags).
- Preserve brand tone, measurements (e.g. "سم" -> "cm", "متر" -> "m"), and numbers naturally.
- If a value is a short size or color name (e.g. "أوف وايت", "وسط 60×90 سم"), translate it concisely (e.g. "Off-White", "Medium 60×90 cm").

Input JSON:
${JSON.stringify(cleanFields, null, 2)}`;

  // 1. Primary: Gemini via @google/genai across all configured healthy keys & free-tier models
  const geminiKeys = collectTranslationGeminiKeys();
  const geminiModels = Array.from(
    new Set([...getCandidateGeminiModels(), 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'])
  ).slice(0, 3);

  for (const apiKey of geminiKeys.slice(0, 3)) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    for (const modelName of geminiModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        const text = response.text || '';
        const parsed = extractJsonObject(text);
        if (parsed && Object.keys(parsed).length > 0) {
          return { success: true, translations: parsed, provider: `gemini:${modelName}` };
        }
      } catch (err: any) {
        console.warn(
          `[TranslationService] Gemini model ${modelName} failed:`,
          String(err?.message || '').slice(0, 140)
        );
      }
    }
  }

  // 2. Secondary fallback: Groq fast LLMs across all configured Groq keys
  const groqKeys = getGroqApiKeys();
  const groqModels = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'allam-2-7b',
  ];

  for (const groqKey of groqKeys) {
    for (const model of groqModels) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 1600,
            messages: [
              {
                role: 'system',
                content:
                  'You are a precise e-commerce translator. Return ONLY a raw valid JSON object matching the exact input keys with translated values.',
              },
              { role: 'user', content: prompt },
            ],
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (groqRes.ok) {
          const data: any = await groqRes.json();
          const content = data?.choices?.[0]?.message?.content || '';
          const parsed = extractJsonObject(content);
          if (parsed && Object.keys(parsed).length > 0) {
            return { success: true, translations: parsed, provider: `groq:${model}` };
          }
        } else {
          const errText = await groqRes.text().catch(() => '');
          console.warn(
            `[TranslationService] Groq ${model} status ${groqRes.status}:`,
            errText.slice(0, 120)
          );
        }
      } catch (err: any) {
        console.warn(
          `[TranslationService] Groq ${model} failed:`,
          String(err?.message || '').slice(0, 120)
        );
      }
    }
  }

  // 3. Tertiary fallback: Fanar API if configured
  const fanarKey = getFanarApiKey();
  if (fanarKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);
      const fanarRes = await fetch('https://api.fanar.qa/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fanarKey}`,
        },
        body: JSON.stringify({
          model: 'Fanar',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'Return ONLY a valid raw JSON object matching the exact input keys.',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (fanarRes.ok) {
        const data: any = await fanarRes.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const parsed = extractJsonObject(content);
        if (parsed && Object.keys(parsed).length > 0) {
          return { success: true, translations: parsed, provider: 'fanar' };
        }
      }
    } catch (err: any) {
      console.warn('[TranslationService] Fanar fallback failed:', String(err?.message || '').slice(0, 120));
    }
  }

  // 4. Tier-4 emergency keyless public fallback (MyMemory) so translation stays resilient
  try {
    const entries = Object.entries(cleanFields);
    const out: Record<string, string> = {};
    for (const [k, val] of entries) {
      const tr = await translateSingleViaMyMemory(val, sourceCode, targetCode);
      if (tr) out[k] = tr;
    }
    if (Object.keys(out).length > 0) {
      return { success: true, translations: out, provider: 'mymemory' };
    }
  } catch {}

  return {
    success: false,
    error: 'تعذرت الترجمة التلقائية مؤقتاً — يمكنك كتابة الترجمة يدوياً في الحقول أدناه.',
  };
}
