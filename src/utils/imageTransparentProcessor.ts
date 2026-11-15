export interface ProcessedImageResult {
  dataUrl: string;
  originalBytes: number;
  finalBytes: number;
  width: number;
  height: number;
  format: 'svg' | 'webp' | 'png';
  backgroundRemoved: boolean;
}

/**
 * معالجة ذكية للصور والأيقونات المرفوعة من استوديو الهاتف أو الكمبيوتر:
 * 1) تحجيم فوري لتقليل المساحة دون فقدان الحدة.
 * 2) تفريغ الخلفية الموحدة (بيضاء/فاتحة أو داكنة/صلبة) من الحواف لتحويلها لخلفية شفافة احترافية.
 * 3) قص الحواف الفارغة تلقائياً (Auto-Trim).
 * 4) التحويل لصيغة مضغوطة شفافة (WebP / PNG أو غلاف SVG مدمج للأيقونات المصغرة).
 */
export async function processBrandAssetUpload(
  file: File,
  options: {
    maxDimension?: number;
    autoRemoveBg?: boolean;
    wrapAsCompactSvg?: boolean;
    bgTolerance?: number;
  } = {}
): Promise<ProcessedImageResult> {
  const {
    maxDimension = 320,
    autoRemoveBg = true,
    wrapAsCompactSvg = false,
    bgTolerance = 36,
  } = options;

  // 1. لو الملف SVG أصلاً، نضغطه ونعيده بأمان كـ data URL
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    const rawSvg = await file.text();
    const cleaned = rawSvg
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
    return {
      dataUrl,
      originalBytes: file.size,
      finalBytes: dataUrl.length,
      width: maxDimension,
      height: maxDimension,
      format: 'svg',
      backgroundRemoved: true,
    };
  }

  // 2. قراءة الصورة كـ HTMLImageElement
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذر قراءة الصورة المختارة، يرجى تجربة صورة أخرى.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const targetW = Math.max(16, Math.round((img.naturalWidth || maxDimension) * scale));
    const targetH = Math.max(16, Math.round((img.naturalHeight || maxDimension) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('المتصفح لا يدعم معالجة الصور حالياً.');
    }

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    // فحص هل الصورة تحتوي فعلاً على خلفية شفافة جاهزة
    let transparentPixels = 0;
    const sampleStep = Math.max(1, Math.floor((targetW * targetH) / 400));
    let totalSampled = 0;
    for (let i = 3; i < data.length; i += 4 * sampleStep) {
      totalSampled++;
      if (data[i] < 230) transparentPixels++;
    }
    const alreadyHasTransparency = totalSampled > 0 && transparentPixels / totalSampled > 0.06;

    let bgWasRemoved = false;

    // 3. إزالة الخلفية الموحدة عبر Flood-Fill متصل بالحواف الأربعة (لتجنب مسح تفاصيل داخل الرسمة)
    if (autoRemoveBg && !alreadyHasTransparency) {
      const cornerCoords = [
        0,
        (targetW - 1) * 4,
        (targetH - 1) * targetW * 4,
        ((targetH - 1) * targetW + (targetW - 1)) * 4,
      ];

      // متوسط لون الحواف إذا كانت متقاربة
      let refR = 0;
      let refG = 0;
      let refB = 0;
      let cornerCount = 0;
      for (const idx of cornerCoords) {
        if (data[idx + 3] > 200) {
          refR += data[idx];
          refG += data[idx + 1];
          refB += data[idx + 2];
          cornerCount++;
        }
      }

      if (cornerCount > 0) {
        refR /= cornerCount;
        refG /= cornerCount;
        refB /= cornerCount;

        // فحص تطابق الأركان لنتأكد أنها خلفية موحدة وليست صورة فوتوغرافية مزدحمة
        let maxCornerDiff = 0;
        for (const idx of cornerCoords) {
          const diff = Math.hypot(data[idx] - refR, data[idx + 1] - refG, data[idx + 2] - refB);
          if (diff > maxCornerDiff) maxCornerDiff = diff;
        }

        if (maxCornerDiff < bgTolerance * 1.6) {
          const totalPixels = targetW * targetH;
          const visited = new Uint8Array(totalPixels);
          const stack = new Int32Array(totalPixels);
          let sp = 0;

          const enqueueIfMatches = (px: number, py: number) => {
            if (px < 0 || px >= targetW || py < 0 || py >= targetH) return;
            const pIdx = py * targetW + px;
            if (visited[pIdx]) return;
            const dIdx = pIdx * 4;
            if (data[dIdx + 3] === 0) {
              visited[pIdx] = 1;
              stack[sp++] = pIdx;
              return;
            }
            const dist = Math.hypot(
              data[dIdx] - refR,
              data[dIdx + 1] - refG,
              data[dIdx + 2] - refB
            );
            if (dist <= bgTolerance) {
              visited[pIdx] = 1;
              stack[sp++] = pIdx;
            }
          };

          // بذر كل حواف الإطار
          for (let x = 0; x < targetW; x++) {
            enqueueIfMatches(x, 0);
            enqueueIfMatches(x, targetH - 1);
          }
          for (let y = 0; y < targetH; y++) {
            enqueueIfMatches(0, y);
            enqueueIfMatches(targetW - 1, y);
          }

          while (sp > 0) {
            const pIdx = stack[--sp];
            const dIdx = pIdx * 4;
            data[dIdx + 3] = 0; // شفافية كاملة

            const px = pIdx % targetW;
            const py = Math.floor(pIdx / targetW);
            enqueueIfMatches(px + 1, py);
            enqueueIfMatches(px - 1, py);
            enqueueIfMatches(px, py + 1);
            enqueueIfMatches(px, py - 1);
          }

          // تنعيم خفيف لحواف الماسك (Anti-alias Feathering)
          for (let y = 1; y < targetH - 1; y++) {
            for (let x = 1; x < targetW - 1; x++) {
              const pIdx = y * targetW + x;
              const dIdx = pIdx * 4;
              if (data[dIdx + 3] === 0) continue;
              const hasTransparentNeighbor =
                data[(pIdx - 1) * 4 + 3] === 0 ||
                data[(pIdx + 1) * 4 + 3] === 0 ||
                data[(pIdx - targetW) * 4 + 3] === 0 ||
                data[(pIdx + targetW) * 4 + 3] === 0;
              if (hasTransparentNeighbor) {
                const dist = Math.hypot(
                  data[dIdx] - refR,
                  data[dIdx + 1] - refG,
                  data[dIdx + 2] - refB
                );
                if (dist <= bgTolerance * 1.45) {
                  data[dIdx + 3] = Math.round(data[dIdx + 3] * 0.42);
                }
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          bgWasRemoved = true;
        }
      }
    }

    // 4. قص المساحات الشفافة الزائدة من الحواف (Auto-Trim)
    let minX = targetW;
    let minY = targetH;
    let maxX = -1;
    let maxY = -1;
    const trimmedData = ctx.getImageData(0, 0, targetW, targetH).data;
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        if (trimmedData[(y * targetW + x) * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    let finalCanvas = canvas;
    if (maxX >= minX && maxY >= minY) {
      const pad = 2;
      const sx = Math.max(0, minX - pad);
      const sy = Math.max(0, minY - pad);
      const sw = Math.min(targetW - sx, maxX - minX + 1 + pad * 2);
      const sh = Math.min(targetH - sy, maxY - minY + 1 + pad * 2);
      if (sw > 8 && sh > 8 && (sw < targetW - 4 || sh < targetH - 4)) {
        const outCanvas = document.createElement('canvas');
        outCanvas.width = sw;
        outCanvas.height = sh;
        const outCtx = outCanvas.getContext('2d');
        if (outCtx) {
          outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
          finalCanvas = outCanvas;
        }
      }
    }

    // 5. تصدير بصيغة WebP الشفافة المضغوطة (أو PNG كبديل مضمون)
    let dataUrl = '';
    let format: 'svg' | 'webp' | 'png' = 'webp';
    try {
      const webpUrl = finalCanvas.toDataURL('image/webp', 0.88);
      if (webpUrl.startsWith('data:image/webp')) {
        dataUrl = webpUrl;
        format = 'webp';
      } else {
        dataUrl = finalCanvas.toDataURL('image/png');
        format = 'png';
      }
    } catch {
      dataUrl = finalCanvas.toDataURL('image/png');
      format = 'png';
    }

    // خيار تغليف أيقونة مصغرة داخل SVG متجاوب عند الطلب
    if (wrapAsCompactSvg) {
      const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${finalCanvas.width} ${finalCanvas.height}" width="${finalCanvas.width}" height="${finalCanvas.height}"><image href="${dataUrl}" width="${finalCanvas.width}" height="${finalCanvas.height}" preserveAspectRatio="xMidYMid meet"/></svg>`;
      dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgWrapper)}`;
      format = 'svg';
    }

    return {
      dataUrl,
      originalBytes: file.size,
      finalBytes: dataUrl.length,
      width: finalCanvas.width,
      height: finalCanvas.height,
      format,
      backgroundRemoved: bgWasRemoved || alreadyHasTransparency,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
