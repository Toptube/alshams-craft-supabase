// ==============================================================================
// استوديو صور المنتجات لصقر الشمساوية — يعمل مباشرة عبر بوابة Taygos للصور
// يدعم الأوضاع الثلاثة: للمتجر (store) / في ورشتي (workshop) / في منزل (home)
// ==============================================================================

import {
  callTaygosGatewayChat,
  callTaygosGatewayImage,
  getTaygosConfig,
} from './googleSearchService.js';

export type FalconStudioMode = 'store' | 'workshop' | 'home';

export interface FalconStudioInput {
  mode: FalconStudioMode;
  imageBase64?: string;
  mimeType?: string;
  userPrompt?: string;
  workshopContext?: {
    selectedCrafts?: string[];
    category?: string;
    brandName?: string;
    artistName?: string;
    accountRole?: 'artisan' | 'supplier' | string;
    country?: string;
  };
}

export interface FalconStudioResult {
  ok: boolean;
  underConstruction: false;
  mode: FalconStudioMode;
  imageDataUrl?: string;
  mimeType?: string;
  provider?: string;
  model?: string;
  message: string;
}

export const FALCON_STUDIO_UNDER_CONSTRUCTION_MESSAGE =
  'استوديو صقر لتجهيز صور المنتجات يعمل الآن عبر بوابة الصور السحابية.';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_BASE64_LENGTH = 10 * 1024 * 1024; // ~7.5MB decoded

const MODE_LABELS_AR: Record<FalconStudioMode, string> = {
  store: 'للمتجر (عرض تجاري احترافي)',
  workshop: 'في ورشتي (بيئة الورشة الحرفية)',
  home: 'في منزل (ديكور منزلي دافئ)',
};

const MODE_SCENE_PROMPTS: Record<FalconStudioMode, string> = {
  store:
    'Clean luxury commercial e-commerce product photography, centered on a refined warm travertine and off-white marble studio pedestal, crisp softbox lighting, subtle natural contact shadow, minimalist neutral cream backdrop, ultra-sharp handmade texture detail, catalog hero shot, 8k photographic realism, no text, no watermark.',
  workshop:
    'Warm authentic artisan craft workshop photography, placed naturally on a sunlit light oak wooden craft table, soft out-of-focus handmade tools, cotton yarn spools and linen cloth softly blurred in the background, golden natural window light, rich tactile craft textures, editorial handmade brand look, 8k photographic realism, no text, no watermark.',
  home:
    'Cozy modern sunlit living room lifestyle interior photography, styled tastefully on a natural wood coffee table or woven linen console in a warm beige Mediterranean home, soft afternoon sunlight, gentle bokeh plants and neutral decor, inviting editorial lifestyle shot, 8k photographic realism, no text, no watermark.',
};

async function enrichPromptToVisualEnglish(rawPrompt: string, craftHint: string): Promise<string> {
  const cleaned = rawPrompt.trim().slice(0, 500);
  if (!cleaned) return craftHint || 'handmade artisan craft product';

  // If already primarily ASCII English, keep directly without extra round-trip
  const hasArabic = /[\u0600-\u06FF]/.test(cleaned);
  if (!hasArabic) return cleaned;

  try {
    const translated = await callTaygosGatewayChat(
      [
        {
          role: 'system',
          content:
            'Translate this Arabic handmade craft product description into a concise, vivid English visual subject phrase (max 28 words) suitable for a product photography prompt. Return ONLY the English phrase with no quotes or extra words.',
        },
        {
          role: 'user',
          content: craftHint ? `${cleaned} (Craft: ${craftHint})` : cleaned,
        },
      ],
      { temperature: 0.2, maxTokens: 70, timeoutMs: 7000 }
    );
    const trimmed = String(translated || '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (trimmed && trimmed.length >= 4 && !/[\u0600-\u06FF]/.test(trimmed)) {
      return trimmed.slice(0, 260);
    }
  } catch {
    // Graceful fallback below
  }
  return craftHint ? `${craftHint}, handmade artisan piece (${cleaned})` : `handmade artisan craft piece (${cleaned})`;
}

function normalizeImageDataUri(rawBase64?: string, rawMime?: string): string | undefined {
  if (!rawBase64 || typeof rawBase64 !== 'string') return undefined;
  const trimmed = rawBase64.trim();
  if (!trimmed || trimmed.length > MAX_BASE64_LENGTH) return undefined;

  if (trimmed.startsWith('data:image/')) {
    const match = trimmed.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) return undefined;
    const mime = match[1].toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(mime)) return undefined;
    return `data:${mime};base64,${match[2].replace(/\s+/g, '')}`;
  }

  const safeMime =
    rawMime && ALLOWED_IMAGE_MIMES.has(rawMime.toLowerCase())
      ? rawMime.toLowerCase()
      : 'image/jpeg';
  const cleanB64 = trimmed.replace(/\s+/g, '');
  if (cleanB64.length < 64) return undefined;
  return `data:${safeMime};base64,${cleanB64}`;
}

export async function generateFalconStudioImage(
  input: FalconStudioInput
): Promise<FalconStudioResult> {
  const mode: FalconStudioMode =
    input.mode === 'workshop' ? 'workshop' : input.mode === 'home' ? 'home' : 'store';
  const modeLabelAr = MODE_LABELS_AR[mode];

  const { apiKey } = getTaygosConfig();
  if (!apiKey) {
    return {
      ok: false,
      underConstruction: false,
      mode,
      message:
        '⚠️ بوابة الصور غير مفعّلة حالياً في إعدادات السيرفر. يرجى التأكد من تفعيل مفتاح بوابة الصور في الإعدادات.',
    };
  }

  const safeUserPrompt = String(input.userPrompt || '').trim().slice(0, 500);
  const craftList = Array.isArray(input.workshopContext?.selectedCrafts)
    ? input.workshopContext?.selectedCrafts.filter(Boolean).slice(0, 3).join(', ')
    : '';
  const craftHint = [input.workshopContext?.category, craftList].filter(Boolean).join(' - ').trim();
  const safeImageUri = normalizeImageDataUri(input.imageBase64, input.mimeType);

  const visualSubject = await enrichPromptToVisualEnglish(
    safeUserPrompt || (safeImageUri ? 'the uploaded handmade craft product, preserving its exact shape, colors, pattern, and materials' : ''),
    craftHint || 'Egyptian handmade craft product'
  );

  const scenePrompt = MODE_SCENE_PROMPTS[mode];
  const finalPrompt = safeImageUri
    ? `Keep the exact handmade product from the reference image unchanged in shape, weave, texture, and colors, and place it seamlessly in this new scene: ${scenePrompt} Subject details: ${visualSubject}.`
    : `Professional studio product photo of ${visualSubject}. ${scenePrompt}`;

  // 1) If an image was uploaded, try edit mode first so Taygos routes to Kontext/background-edit when available
  let res = safeImageUri
    ? await callTaygosGatewayImage({
        task: 'edit',
        prompt: finalPrompt,
        image: safeImageUri,
        width: 1024,
        height: 1024,
        timeoutMs: 40000,
      })
    : null;

  // 2) Direct generate mode (primary for text-only, automatic fallback if edit endpoint isn't supported for this call)
  if (!res || !res.ok) {
    res = await callTaygosGatewayImage({
      task: 'generate',
      prompt: finalPrompt,
      image: safeImageUri,
      width: 1024,
      height: 1024,
      timeoutMs: 40000,
    });
  }

  if (!res.ok) {
    return {
      ok: false,
      underConstruction: false,
      mode,
      message: `تعذر تجهيز صورة الاستوديو (${modeLabelAr}) حالياً: ${res.summary || 'الخدمة مشغولة مؤقتاً — جرّب مرة تانية بعد لحظات.'}`,
    };
  }

  let imageDataUrl = '';
  if (res.imageUrl && (res.imageUrl.startsWith('data:image/') || res.imageUrl.startsWith('https://'))) {
    imageDataUrl = res.imageUrl;
  } else if (res.imageBase64) {
    const mime = res.mimeType || 'image/png';
    imageDataUrl = `data:${mime};base64,${res.imageBase64}`;
  }

  if (!imageDataUrl) {
    return {
      ok: false,
      underConstruction: false,
      mode,
      message: 'استجابت بوابة الصور بدون ملف صورة قابل للعرض — يرجى المحاولة مرة أخرى.',
    };
  }

  const modeCaption =
    mode === 'store'
      ? 'تم تجهيز الصورة بإضاءة وخلفية استوديو احترافية جاهزة للعرض في متجرك وسوق الشمساوية.'
      : mode === 'workshop'
      ? 'تم تجهيز الصورة بأجواء ورشة حرفية دافئة تبرز قيمة الشغل اليدوي الأصيل.'
      : 'تم تجهيز الصورة داخل ديكور منزلي طبيعي يوضّح جمال القطعة في بيت العميل.';

  return {
    ok: true,
    underConstruction: false,
    mode,
    imageDataUrl,
    mimeType: res.mimeType || 'image/png',
    provider: res.provider,
    model: res.model,
    message: `✨ **استوديو صقر (${modeLabelAr})**\n${modeCaption}\nتقدر تحمّل الصورة بأعلى دقة أو تضيف تذييل ورشتك بضغطة واحدة 👇`,
  };
}
