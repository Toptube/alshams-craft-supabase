// ==============================================================================
// استوديو صور المنتجات لصقر الشمساوية — يعمل مباشرة عبر بوابة Taygos للصور
// مع دعم الأوضاع الثلاثة (للمتجر / في ورشتي / في منزل) + دمج ذكي للمنتج المرفوع
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
  /** When true, the returned imageDataUrl is an AI-generated empty studio backdrop and client should composite the user's real uploaded product onto it */
  compositeUploadedProduct?: boolean;
  /** When true, all cloud image queues inside Taygos were temporarily busy (502/503) and client should render the uploaded product on the built-in local studio backdrop */
  fallbackToLocalStudio?: boolean;
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

// Concise, high-hit-rate prompts (kept under ~180 chars so fast free models like FLUX-schnell & Pollinations never drop/502)
const MODE_SUBJECT_PROMPTS: Record<FalconStudioMode, string> = {
  store:
    'on white marble studio pedestal, softbox commercial product photography, cream minimalist background, crisp shadow, photorealistic',
  workshop:
    'on sunlit oak wood artisan workbench, soft blurred handmade craft tools and linen background, warm natural window light, photorealistic',
  home:
    'styled on natural wood coffee table in cozy sunlit beige Mediterranean living room, warm afternoon daylight, interior lifestyle photo',
};

const MODE_EMPTY_BACKDROP_PROMPTS: Record<FalconStudioMode, string> = {
  store:
    'Empty minimalist white marble studio pedestal on warm cream backdrop, softbox lighting, product display stage, no objects, photorealistic',
  workshop:
    'Empty sunlit light oak wooden craft workshop table in foreground, soft blurred cozy artisan shelves in background, warm daylight, no center object',
  home:
    'Empty natural wood coffee table in cozy sunlit beige living room, soft afternoon sunbeams, blurred linen sofa background, no center object',
};

async function enrichPromptToVisualEnglish(rawPrompt: string, craftHint: string): Promise<string> {
  const cleaned = rawPrompt.trim().slice(0, 350);
  if (!cleaned) return craftHint || 'handmade artisan craft product';

  const hasArabic = /[\u0600-\u06FF]/.test(cleaned);
  if (!hasArabic) return cleaned.slice(0, 140);

  try {
    const translated = await callTaygosGatewayChat(
      [
        {
          role: 'system',
          content:
            'Translate this Arabic handmade craft product into a concise English visual phrase (max 16 words) for product photography. Return ONLY the English phrase.',
        },
        {
          role: 'user',
          content: craftHint ? `${cleaned} (${craftHint})` : cleaned,
        },
      ],
      { temperature: 0.2, maxTokens: 45, timeoutMs: 5500 }
    );
    const trimmed = String(translated || '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (trimmed && trimmed.length >= 3 && !/[\u0600-\u06FF]/.test(trimmed)) {
      return trimmed.slice(0, 140);
    }
  } catch {
    // Graceful fallback below
  }
  return craftHint ? `${craftHint} handmade piece` : 'Egyptian handmade artisan craft product';
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

function extractImageDataUrl(res: { imageUrl?: string; imageBase64?: string; mimeType?: string }): string {
  if (res.imageUrl && (res.imageUrl.startsWith('data:image/') || res.imageUrl.startsWith('https://'))) {
    return res.imageUrl;
  }
  if (res.imageBase64) {
    return `data:${res.mimeType || 'image/png'};base64,${res.imageBase64}`;
  }
  return '';
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

  const safeUserPrompt = String(input.userPrompt || '').trim().slice(0, 350);
  const craftList = Array.isArray(input.workshopContext?.selectedCrafts)
    ? input.workshopContext?.selectedCrafts.filter(Boolean).slice(0, 2).join(', ')
    : '';
  const craftHint = [input.workshopContext?.category, craftList].filter(Boolean).join(' ').trim();
  const safeImageUri = normalizeImageDataUri(input.imageBase64, input.mimeType);

  const modeCaption =
    mode === 'store'
      ? 'تم تجهيز الصورة بإضاءة وخلفية استوديو احترافية جاهزة للعرض في متجرك وسوق الشمساوية.'
      : mode === 'workshop'
      ? 'تم تجهيز الصورة بأجواء ورشة حرفية دافئة تبرز قيمة الشغل اليدوي الأصيل.'
      : 'تم تجهيز الصورة داخل ديكور منزلي طبيعي يوضّح جمال القطعة في بيت العميل.';

  // =========================================================================
  // PATH A: User uploaded a real product photo
  // =========================================================================
  if (safeImageUri) {
    // Step 1: Try direct Taygos bg_edit (FLUX.1 Kontext) with short timeout
    const editRes = await callTaygosGatewayImage({
      task: 'bg_edit',
      prompt: `Place the exact handmade product seamlessly ${MODE_SUBJECT_PROMPTS[mode]}`,
      image: safeImageUri,
      width: 512,
      height: 512,
      timeoutMs: 14000,
    });

    if (editRes.ok) {
      const url = extractImageDataUrl(editRes);
      if (url) {
        return {
          ok: true,
          underConstruction: false,
          mode,
          imageDataUrl: url,
          mimeType: editRes.mimeType || 'image/png',
          provider: editRes.provider,
          model: editRes.model,
          message: `✨ **استوديو صقر (${modeLabelAr})**\n${modeCaption}\nتقدر تحمّل الصورة بأعلى دقة أو تضيف تذييل ورشتك بضغطة واحدة 👇`,
        };
      }
    }

    // Step 2: bg_edit Space was busy -> Generate an empty AI studio scene via Taygos (clean fast 512x512, NO base64 attached)
    // and let the client composite the artisan's REAL uploaded product onto that AI scene!
    const scenePrompt = safeUserPrompt
      ? `${MODE_EMPTY_BACKDROP_PROMPTS[mode]}, matching mood for ${await enrichPromptToVisualEnglish(safeUserPrompt, craftHint)}`
      : MODE_EMPTY_BACKDROP_PROMPTS[mode];

    const sceneRes = await callTaygosGatewayImage({
      task: 'generate',
      prompt: scenePrompt.slice(0, 220),
      width: 512,
      height: 512,
      timeoutMs: 22000,
    });

    if (sceneRes.ok) {
      const sceneUrl = extractImageDataUrl(sceneRes);
      if (sceneUrl) {
        return {
          ok: true,
          underConstruction: false,
          mode,
          imageDataUrl: sceneUrl,
          mimeType: sceneRes.mimeType || 'image/png',
          provider: sceneRes.provider,
          model: sceneRes.model,
          compositeUploadedProduct: true,
          message: `✨ **استوديو صقر (${modeLabelAr})**\nتم توليد خلفية الاستوديو السحابية عبر Taygos ودمج صورة منتجك الحقيقي عليها بدقة وإضاءة متناسقة!\nتقدر تحمّل الصورة أو تضيف تذييل ورشتك بضغطة واحدة 👇`,
        };
      }
    }

    // Step 3: All Taygos external free image queues (HuggingFace/Pollinations) are currently 502/503 ->
    // Signal instant Built-in Local Studio Renderer so the artisan NEVER hits a dead end!
    return {
      ok: true,
      underConstruction: false,
      mode,
      fallbackToLocalStudio: true,
      message: `✨ **استوديو صقر (${modeLabelAr})**\nتم تجهيز صورة منتجك فوراً عبر **الاستوديو المدمج** (نظراً لوجود ضغط مؤقت على طابور مزودي الصور المجانيين في Taygos الآن).\nتقدر تحمّل الصورة بأعلى دقة أو تضيف تذييل ورشتك بضغطة واحدة 👇`,
    };
  }

  // =========================================================================
  // PATH B: Text-only product studio generation (no photo uploaded)
  // =========================================================================
  const visualSubject = await enrichPromptToVisualEnglish(safeUserPrompt, craftHint);
  const finalPrompt = `Handmade ${visualSubject}, ${MODE_SUBJECT_PROMPTS[mode]}`.slice(0, 220);

  let genRes = await callTaygosGatewayImage({
    task: 'generate',
    prompt: finalPrompt,
    width: 512,
    height: 512,
    timeoutMs: 22000,
  });

  // One quick automatic retry on transient 502/503/429 (e.g., Api.Airforce 1 req/s limit or Pollinations hiccup)
  if (!genRes.ok && [429, 502, 503, 504].includes(Number(genRes.statusCode || 0))) {
    await new Promise((r) => setTimeout(r, 1400));
    genRes = await callTaygosGatewayImage({
      task: 'generate',
      prompt: finalPrompt,
      width: 512,
      height: 512,
      timeoutMs: 22000,
    });
  }

  if (genRes.ok) {
    const imageDataUrl = extractImageDataUrl(genRes);
    if (imageDataUrl) {
      return {
        ok: true,
        underConstruction: false,
        mode,
        imageDataUrl,
        mimeType: genRes.mimeType || 'image/png',
        provider: genRes.provider,
        model: genRes.model,
        message: `✨ **استوديو صقر (${modeLabelAr})**\n${modeCaption}\nتقدر تحمّل الصورة بأعلى دقة أو تضيف تذييل ورشتك بضغطة واحدة 👇`,
      };
    }
  }

  return {
    ok: false,
    underConstruction: false,
    mode,
    message:
      `مزودو توليد الصور المجانيون داخل بوابة Taygos عليهم ضغط مؤقت حالياً (HuggingFace / Pollinations).\n` +
      `💡 **الحل السريع الآن:** ارفع صورة منتجك من زر المرفقات 📎 وهجهّزها لك فوراً في الاستوديو بدون انتظار، أو جرّب التوليد بالوصف النصي مرة تانية بعد دقيقة.`,
  };
}
