/**
 * فحص جودة الصور محلياً 100% بالـ Canvas (بدون ذكاء اصطناعي)
 * - للصور المرفوعة من الجهاز (base64 data URLs): لا توجد قيود CORS -> يفحص الدقة، النسبة، السطوع، والحدة بالـ canvas.
 * - للروابط الخارجية (https://...): لو المتصفح حجبها بسبب CORS، يفحص الباقي (العدد، التكرار، الوصف) ويقول بصراحة إنه ما قدرش يفحص الجودة التقنية.
 */

export interface ImagePixelMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  aspectLabelAr: string;
  brightness: number; // 0..255
  brightnessStatus: 'dark' | 'good' | 'bright';
  sharpness: number; // edge gradient / Laplacian variance score
  sharpnessStatus: 'blurry' | 'acceptable' | 'sharp';
  resolutionStatus: 'low' | 'medium' | 'good';
}

export interface ImageQualityReport {
  sourceType: 'base64' | 'external_url' | 'invalid';
  label: string;
  inspectedWithCanvas: boolean;
  corsBlocked: boolean;
  metrics?: ImagePixelMetrics;
  issues: string[];
  positives: string[];
  honestNoticeAr?: string;
  summaryAr: string;
}

export interface ProductImagesBatchInspection {
  totalImages: number;
  duplicateCount: number;
  missingDescriptionCount: number;
  reports: ImageQualityReport[];
  summaryMarkdown: string;
}

export function classifyAspectRatio(width: number, height: number): { ratio: number; labelAr: string; isExtreme: boolean } {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const ratio = Number((safeW / safeH).toFixed(2));

  if (Math.abs(ratio - 1) <= 0.12) {
    return { ratio, labelAr: 'مربّعة (1:1 — ممتازة للمتجر والإنستجرام)', isExtreme: false };
  }
  if (ratio >= 0.72 && ratio <= 0.88) {
    return { ratio, labelAr: 'عمودية متوازنة (4:5 — ممتازة لعرض المنتجات)', isExtreme: false };
  }
  if (ratio >= 1.2 && ratio <= 1.85) {
    return { ratio, labelAr: 'أفقية متوازنة (4:3 / 16:9)', isExtreme: false };
  }
  if (ratio >= 0.5 && ratio < 0.72) {
    return { ratio, labelAr: 'طولية (ستوري/ريلز 9:16)', isExtreme: false };
  }
  return {
    ratio,
    labelAr: `نسبة غير متوازنة (${ratio}:1 — ممكن تتقصّ أطراف المنتج في العرض)`,
    isExtreme: true,
  };
}

/**
 * دالة حساب رياضية نقية للسطوع والحدة من مصفوفة بيكسلات RGBA
 * (مفصولة لتسهيل التشغيل في المتصفح والاختبار الآلي الدقيق بدون متصفح).
 */
export function computeCanvasPixelMetrics(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number
): ImagePixelMetrics {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const pixelCount = w * h;
  const gray = new Float32Array(pixelCount);

  let sumLum = 0;
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = rgba[idx] ?? 0;
    const g = rgba[idx + 1] ?? 0;
    const b = rgba[idx + 2] ?? 0;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    sumLum += lum;
  }

  const brightness = Number((sumLum / Math.max(1, pixelCount)).toFixed(1));
  const brightnessStatus: ImagePixelMetrics['brightnessStatus'] =
    brightness < 65 ? 'dark' : brightness > 218 ? 'bright' : 'good';

  // Laplacian-like gradient energy for sharpness estimation
  let lapSum = 0;
  let lapSqSum = 0;
  let innerCount = 0;
  if (w >= 3 && h >= 3) {
    for (let y = 1; y < h - 1; y++) {
      const rowOffset = y * w;
      for (let x = 1; x < w - 1; x++) {
        const c = gray[rowOffset + x];
        const lap =
          4 * c -
          gray[rowOffset + x - 1] -
          gray[rowOffset + x + 1] -
          gray[rowOffset - w + x] -
          gray[rowOffset + w + x];
        lapSum += Math.abs(lap);
        lapSqSum += lap * lap;
        innerCount += 1;
      }
    }
  }

  const meanAbsLap = innerCount > 0 ? lapSum / innerCount : 0;
  const lapVar = innerCount > 0 ? Math.sqrt(lapSqSum / innerCount) : 0;
  const sharpness = Number(((meanAbsLap * 0.6 + lapVar * 0.4)).toFixed(1));

  const sharpnessStatus: ImagePixelMetrics['sharpnessStatus'] =
    sharpness < 10 ? 'blurry' : sharpness < 18 ? 'acceptable' : 'sharp';

  const minDim = Math.min(w, h);
  const resolutionStatus: ImagePixelMetrics['resolutionStatus'] =
    minDim < 450 ? 'low' : minDim < 800 ? 'medium' : 'good';

  const aspect = classifyAspectRatio(w, h);

  return {
    width: w,
    height: h,
    aspectRatio: aspect.ratio,
    aspectLabelAr: aspect.labelAr,
    brightness,
    brightnessStatus,
    sharpness,
    sharpnessStatus,
    resolutionStatus,
  };
}

export function buildImageReportFromMetrics(
  metrics: ImagePixelMetrics,
  sourceType: 'base64' | 'external_url',
  label: string
): ImageQualityReport {
  const issues: string[] = [];
  const positives: string[] = [];

  if (metrics.resolutionStatus === 'low') {
    issues.push(`الدقة منخفضة (${metrics.width}×${metrics.height}) — يفضّل تصوير أقرب وبجودة أعلى عشان التفاصيل تبان واضحة.`);
  } else if (metrics.resolutionStatus === 'good') {
    positives.push(`دقة ممتازة (${metrics.width}×${metrics.height})`);
  } else {
    positives.push(`دقة مقبولة (${metrics.width}×${metrics.height})`);
  }

  const aspectInfo = classifyAspectRatio(metrics.width, metrics.height);
  if (aspectInfo.isExtreme) {
    issues.push(`نسبة الصورة (${metrics.aspectLabelAr}) — جرّب تصوّرها مربّعة 1:1 أو 4:5.`);
  } else {
    positives.push(`نسبة الأبعاد مناسبة: ${metrics.aspectLabelAr}`);
  }

  if (metrics.brightnessStatus === 'dark') {
    issues.push(`الإضاءة غامقة شوية (سطوع ${metrics.brightness}/255) — صوّر جنب شباك في ضوء النهار بدون فلاش مباشر.`);
  } else if (metrics.brightnessStatus === 'bright') {
    issues.push(`الإضاءة عالية أوي أو مبيّضة التفاصيل (سطوع ${metrics.brightness}/255) — خفّف الضوء المباشر.`);
  } else {
    positives.push(`الإضاءة والسطوع متوازنين (${metrics.brightness}/255)`);
  }

  if (metrics.sharpnessStatus === 'blurry') {
    issues.push(`الحدة ضعيفة شوية (الصورة مهزوزة أو مش مركّزة) — ثبّت الموبايل واضغط على القطعة قبل التصوير.`);
  } else if (metrics.sharpnessStatus === 'sharp') {
    positives.push(`حدة وتفاصيل واضحة (${metrics.sharpness})`);
  } else {
    positives.push(`الحدة مقبولة (${metrics.sharpness})`);
  }

  const summaryParts = [
    `📸 **فحص فني محلي لـ ${label}:**`,
    `• الدقة: **${metrics.width}×${metrics.height}** | النسبة: **${metrics.aspectLabelAr}**`,
    `• الإضاءة (السطوع): **${metrics.brightnessStatus === 'good' ? 'متوازنة ✅' : metrics.brightnessStatus === 'dark' ? 'غامقة 🟡' : 'عالية أوي 🟡'}** | الحدة: **${metrics.sharpnessStatus === 'sharp' ? 'واضحة ✅' : metrics.sharpnessStatus === 'acceptable' ? 'مقبولة ✅' : 'مهزوزة شوية 🟡'}**`,
  ];
  if (issues.length > 0) {
    summaryParts.push(`**نصايح تحسين سريعة:**\n${issues.map((i) => `• ${i}`).join('\n')}`);
  }

  return {
    sourceType,
    label,
    inspectedWithCanvas: true,
    corsBlocked: false,
    metrics,
    issues,
    positives,
    summaryAr: summaryParts.join('\n'),
  };
}

/**
 * فحص صورة واحدة بالـ Canvas في المتصفح (base64 بدون أي CORS، والروابط الخارجية بصراحة كاملة لو حُجبت).
 */
export async function analyzeImageQualityWithCanvas(
  src: string | null | undefined,
  label = 'الصورة'
): Promise<ImageQualityReport> {
  const clean = String(src || '').trim();
  if (!clean) {
    return {
      sourceType: 'invalid',
      label,
      inspectedWithCanvas: false,
      corsBlocked: false,
      issues: ['مفيش صورة مرفوعة.'],
      positives: [],
      summaryAr: `⚠️ مفيش صورة مرفوعة لـ ${label}.`,
    };
  }

  const isBase64 = clean.startsWith('data:image/');
  const isHttp = /^https?:\/\//i.test(clean);
  if (!isBase64 && !isHttp) {
    return {
      sourceType: 'invalid',
      label,
      inspectedWithCanvas: false,
      corsBlocked: false,
      issues: ['رابط الصورة غير صحيح (لازم يبدأ بـ https:// أو يكون مرفوع من الجهاز).'],
      positives: [],
      summaryAr: `⚠️ رابط ${label} غير مكتمل أو غير صالح.`,
    };
  }

  // في بيئة بدون متصفح/Canvas (مثلاً Node) أو لو الرابط خارجي محجوب بـ CORS
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
    if (isBase64) {
      const base64Part = clean.split(',')[1] || '';
      const approxBytes = Math.round((base64Part.length * 3) / 4);
      const isTiny = approxBytes > 0 && approxBytes < 9000;
      return {
        sourceType: 'base64',
        label,
        inspectedWithCanvas: false,
        corsBlocked: false,
        issues: isTiny ? [`حجم الصورة صغير جداً (${Math.max(1, Math.round(approxBytes / 1024))} ك.ب) وممكن تطلع مبكسلة.`] : [],
        positives: isTiny ? [] : ['صورة مرفوعة من الجهاز (جاهزة لفحص الـ Canvas داخل المتصفح)'],
        summaryAr: isTiny
          ? `⚠️ ${label} حجمها صغير جداً (${Math.max(1, Math.round(approxBytes / 1024))} ك.ب).`
          : `✅ ${label} مرفوعة من الجهاز بصيغة صالحة.`,
      };
    }

    const honest =
      'الصورة دي رابط خارجي والمتصفح بيحجب فحص جودتها التقنية (الدقة والسطوع والحدة) بسبب قيود الحماية (CORS)، فراجعت لك العدد والتكرار والوصف بس بصراحة.';
    return {
      sourceType: 'external_url',
      label,
      inspectedWithCanvas: false,
      corsBlocked: true,
      issues: [],
      positives: ['الرابط الخارجي مكتوب بصيغة https سليمة'],
      honestNoticeAr: honest,
      summaryAr: `ℹ️ ${label}: ${honest}`,
    };
  }

  // تحميل الصورة داخل المتصفح وفحصها بالـ Canvas
  return new Promise<ImageQualityReport>((resolve) => {
    try {
      const img = new Image();
      if (isHttp) {
        img.crossOrigin = 'anonymous';
      }

      const timeoutId = window.setTimeout(() => {
        const honest = isHttp
          ? 'ما قدرتش أفحص جودة الصورة دي تقنياً لأن الرابط الخارجي محجوب بحماية المتصفح (CORS) أو بطيء — فراجعت لك العدد والتكرار والوصف بس بصراحة.'
          : 'تعذر قراءة الصورة في الوقت المحدد لفحص الـ Canvas.';
        resolve({
          sourceType: isBase64 ? 'base64' : 'external_url',
          label,
          inspectedWithCanvas: false,
          corsBlocked: isHttp,
          issues: [],
          positives: [],
          honestNoticeAr: honest,
          summaryAr: `ℹ️ ${label}: ${honest}`,
        });
      }, 4000);

      img.onload = () => {
        window.clearTimeout(timeoutId);
        try {
          const naturalW = img.naturalWidth || img.width;
          const naturalH = img.naturalHeight || img.height;
          // عيّنة فحص سريعة وخفيفة للسطوع والحدة (أقصى ضلع 240 بكسل لعدم تجميد الشاشة)
          const maxSample = 240;
          const scale = Math.min(1, maxSample / Math.max(1, naturalW, naturalH));
          const sw = Math.max(1, Math.round(naturalW * scale));
          const sh = Math.max(1, Math.round(naturalH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('no_2d_ctx');
          ctx.drawImage(img, 0, 0, sw, sh);
          const imageData = ctx.getImageData(0, 0, sw, sh);

          const sampledMetrics = computeCanvasPixelMetrics(imageData.data, sw, sh);
          // نرجّع الدقة الأصلية الحقيقية للصورة مش دقة العيّنة المصغّرة
          const realAspect = classifyAspectRatio(naturalW, naturalH);
          const minDim = Math.min(naturalW, naturalH);
          const realResStatus: ImagePixelMetrics['resolutionStatus'] =
            minDim < 450 ? 'low' : minDim < 800 ? 'medium' : 'good';

          const finalMetrics: ImagePixelMetrics = {
            ...sampledMetrics,
            width: naturalW,
            height: naturalH,
            aspectRatio: realAspect.ratio,
            aspectLabelAr: realAspect.labelAr,
            resolutionStatus: realResStatus,
          };

          resolve(buildImageReportFromMetrics(finalMetrics, isBase64 ? 'base64' : 'external_url', label));
        } catch {
          // SecurityError عند getImageData على رابط خارجي محجوب بـ CORS
          const honest =
            'ما قدرتش أفحص جودة الصورة دي بالـ Canvas لأنها رابط خارجي محجوب بقيود المتصفح (CORS)، فراجعت لك العدد والتكرار والوصف بس بصراحة.';
          resolve({
            sourceType: isBase64 ? 'base64' : 'external_url',
            label,
            inspectedWithCanvas: false,
            corsBlocked: true,
            issues: [],
            positives: ['الرابط شغال وبيفتح'],
            honestNoticeAr: honest,
            summaryAr: `ℹ️ ${label}: ${honest}`,
          });
        }
      };

      img.onerror = () => {
        window.clearTimeout(timeoutId);
        const honest = isHttp
          ? 'ما قدرتش أفحص جودة الصورة دي لأن الرابط الخارجي محجوب بقيود المتصفح (CORS) أو مش بيسمح بالقراءة — راجعت العدد والتكرار والوصف بس بصراحة.'
          : 'تعذر فتح الصورة المرفوعة لفحصها.';
        resolve({
          sourceType: isBase64 ? 'base64' : 'external_url',
          label,
          inspectedWithCanvas: false,
          corsBlocked: isHttp,
          issues: isBase64 ? ['تعذر قراءة ملف الصورة المرفوع.'] : [],
          positives: [],
          honestNoticeAr: honest,
          summaryAr: `ℹ️ ${label}: ${honest}`,
        });
      };

      img.src = clean;
    } catch {
      const honest = 'تعذر فحص جودة الصورة تقنياً، لكن راجعت باقي بيانات الصور (العدد، التكرار، والوصف).';
      resolve({
        sourceType: isBase64 ? 'base64' : 'external_url',
        label,
        inspectedWithCanvas: false,
        corsBlocked: isHttp,
        issues: [],
        positives: [],
        honestNoticeAr: honest,
        summaryAr: `ℹ️ ${label}: ${honest}`,
      });
    }
  });
}

/**
 * فحص مجموعة صور لمنتج أو معرض أعمال: العدد + التكرار + الوصف + فحص Canvas لكل صورة مرفوعة من الجهاز + صراحة كاملة مع الروابط الخارجية.
 */
export async function inspectProductImagesBatch(params: {
  images: Array<{ url: string; caption?: string; label?: string }>;
}): Promise<ProductImagesBatchInspection> {
  const seen = new Set<string>();
  let duplicateCount = 0;
  let missingDescriptionCount = 0;
  const reports: ImageQualityReport[] = [];

  for (let i = 0; i < params.images.length; i++) {
    const item = params.images[i];
    const cleanUrl = String(item.url || '').trim();
    if (!cleanUrl) continue;

    if (seen.has(cleanUrl)) {
      duplicateCount += 1;
    } else {
      seen.add(cleanUrl);
    }

    if (!String(item.caption || '').trim()) {
      missingDescriptionCount += 1;
    }

    const rep = await analyzeImageQualityWithCanvas(cleanUrl, item.label || `صورة رقم ${i + 1}`);
    reports.push(rep);
  }

  const corsCount = reports.filter((r) => r.corsBlocked).length;
  const lines: string[] = [
    `🖼️ **ملخص فحص الصور (${reports.length} صور):**`,
    `• الصور المكررة: **${duplicateCount}** | صور بدون وصف: **${missingDescriptionCount}**`,
  ];

  if (corsCount > 0) {
    lines.push(
      `• ℹ️ **بصراحة:** في **${corsCount}** صورة بروابط خارجية المتصفح بيمنع فحص جودتها التقنية (الدقة/السطوع/الحدة) بسبب قيود CORS، ففحصت لك العدد والتكرار والوصف بس.`
    );
  }

  reports.slice(0, 4).forEach((r) => {
    if (r.issues.length > 0) {
      lines.push(`• 🟡 **${r.label}:** ${r.issues[0]}`);
    } else if (r.inspectedWithCanvas && r.metrics) {
      lines.push(`• ✅ **${r.label}:** جودتها كويسة (${r.metrics.width}×${r.metrics.height} — إضاءة ${r.metrics.brightnessStatus === 'good' ? 'متوازنة' : 'تحتاج تعديل'}).`);
    }
  });

  return {
    totalImages: reports.length,
    duplicateCount,
    missingDescriptionCount,
    reports,
    summaryMarkdown: lines.join('\n'),
  };
}
