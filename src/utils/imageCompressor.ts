export const MAX_ITEM_IMAGES = 3;

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  targetMaxKb?: number;
  initialQuality?: number;
  preserveTransparency?: boolean;
}

/**
 * Adaptive client-side image compressor for store products, raw materials, covers, and logos.
 * Resizes images inside max bounds and iteratively adjusts WebP/JPEG compression quality
 * until the payload stays comfortably under targetMaxKb to keep database rows lightweight.
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    targetMaxKb = 95,
    initialQuality = 0.8,
    preserveTransparency = false,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (!rawDataUrl) {
        reject(new Error('ملف الصورة فارغ'));
        return;
      }

      // Preserve vector SVGs as-is if small
      if (file.type === 'image/svg+xml' && rawDataUrl.length < targetMaxKb * 1024 * 1.4) {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة غير صالح أو تالف'));
      img.onload = () => {
        const naturalW = Math.max(1, img.naturalWidth || img.width || 1);
        const naturalH = Math.max(1, img.naturalHeight || img.height || 1);

        const initialScale = Math.min(1, maxWidth / naturalW, maxHeight / naturalH);
        let width = Math.max(1, Math.round(naturalW * initialScale));
        let height = Math.max(1, Math.round(naturalH * initialScale));

        const targetBase64Len = Math.round(targetMaxKb * 1024 * 1.37);

        const encodeAt = (w: number, h: number, mime: string, q: number): string => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return rawDataUrl;

          if (!preserveTransparency && mime === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
          } else {
            ctx.clearRect(0, 0, w, h);
          }

          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL(mime, q);
          return out;
        };

        const supportsWebp = (() => {
          try {
            const probe = document.createElement('canvas');
            probe.width = 2;
            probe.height = 2;
            return probe.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
          } catch {
            return false;
          }
        })();

        const primaryMime = supportsWebp ? 'image/webp' : preserveTransparency ? 'image/png' : 'image/jpeg';
        const qualitySteps = [initialQuality, 0.72, 0.62, 0.52, 0.42].filter(
          (q, idx, arr) => q <= initialQuality && arr.indexOf(q) === idx
        );

        let bestResult = rawDataUrl;

        for (let pass = 0; pass < 2; pass++) {
          const factor = pass === 0 ? 1 : 0.78;
          const passW = Math.max(120, Math.round(width * factor));
          const passH = Math.max(120, Math.round(height * factor));

          for (const q of qualitySteps) {
            const candidate = encodeAt(passW, passH, primaryMime, q);
            if (candidate.startsWith('data:image/')) {
              if (bestResult === rawDataUrl || candidate.length < bestResult.length) {
                bestResult = candidate;
              }
              if (candidate.length <= targetBase64Len) {
                resolve(candidate);
                return;
              }
            }
          }
        }

        // Fallback to JPEG if PNG with preserveTransparency exceeded budget and WebP wasn't available
        if (bestResult.length > targetBase64Len && !preserveTransparency && primaryMime !== 'image/jpeg') {
          const jpegFallback = encodeAt(Math.max(120, Math.round(width * 0.78)), Math.max(120, Math.round(height * 0.78)), 'image/jpeg', 0.58);
          if (jpegFallback.startsWith('data:image/jpeg') && jpegFallback.length < bestResult.length) {
            bestResult = jpegFallback;
          }
        }

        resolve(bestResult);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
