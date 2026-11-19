export interface BrandFooterOptions {
  workshopName?: string;
  artistName?: string;
  logoUrl?: string;
  isSupplier?: boolean;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Composites a clean, luxury editorial footer onto a generated product studio image.
 * Strictly renders ONLY:
 *  1) Workshop / Supplier Logo
 *  2) Workshop / Store Name
 *  3) Artist / Supplier Name
 * Zero other details (no phone, no email, no price, no platform watermark).
 */
export async function applyWorkshopBrandFooter(
  sourceDataUrl: string,
  options: BrandFooterOptions
): Promise<string> {
  const baseImg = await loadHtmlImage(sourceDataUrl);
  if (!baseImg || !baseImg.naturalWidth || !baseImg.naturalHeight) {
    return sourceDataUrl;
  }

  const w = baseImg.naturalWidth;
  const h = baseImg.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceDataUrl;

  // 1. Draw the generated studio photo cleanly
  ctx.drawImage(baseImg, 0, 0, w, h);

  const cleanWorkshop = String(options.workshopName || '').trim();
  const cleanArtist = String(options.artistName || '').trim();
  const roleLabel = options.isSupplier ? 'المورد' : 'الفنان';

  const primaryTitle = cleanWorkshop || cleanArtist || (options.isSupplier ? 'متجر المورد' : 'الورشة');
  const showSecondary =
    Boolean(cleanArtist) &&
    cleanArtist.toLowerCase() !== primaryTitle.toLowerCase();

  // 2. Refined editorial translucent dark-warm gradient bar at bottom (~11.5% height)
  const barH = Math.max(76, Math.round(h * 0.115));
  const barY = h - barH;

  const grad = ctx.createLinearGradient(0, barY - Math.round(barH * 0.35), 0, h);
  grad.addColorStop(0, 'rgba(20, 16, 12, 0)');
  grad.addColorStop(0.28, 'rgba(20, 16, 12, 0.72)');
  grad.addColorStop(1, 'rgba(15, 12, 9, 0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, barY - Math.round(barH * 0.35), w, barH + Math.round(barH * 0.35));

  // Subtle golden hairline accent above the footer
  ctx.fillStyle = 'rgba(217, 169, 98, 0.55)';
  ctx.fillRect(Math.round(w * 0.04), barY + 2, Math.round(w * 0.92), Math.max(1, Math.round(h * 0.0018)));

  const padX = Math.round(w * 0.042);
  const logoSize = Math.round(barH * 0.68);
  const logoCenterY = barY + Math.round(barH * 0.52);
  const logoRightEdge = w - padX;
  const logoCenterX = logoRightEdge - Math.round(logoSize / 2);

  // 3. Draw Workshop / Supplier Logo (circular badge on the right for RTL harmony)
  let logoImg = await loadHtmlImage(options.logoUrl || '');
  if (!logoImg) {
    logoImg = await loadHtmlImage('/alshams_falcon_emblem.png');
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(logoCenterX, logoCenterY, logoSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 252, 245, 0.96)';
  ctx.fill();
  ctx.clip();

  if (logoImg) {
    const scale = Math.max(logoSize / logoImg.naturalWidth, logoSize / logoImg.naturalHeight);
    const dw = logoImg.naturalWidth * scale;
    const dh = logoImg.naturalHeight * scale;
    ctx.drawImage(logoImg, logoCenterX - dw / 2, logoCenterY - dh / 2, dw, dh);
  }
  ctx.restore();

  // Crisp gold border ring around the logo medallion
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoCenterX, logoCenterY, logoSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(232, 192, 125, 0.9)';
  ctx.lineWidth = Math.max(2, Math.round(w * 0.0025));
  ctx.stroke();
  ctx.restore();

  // 4. Draw ONLY Workshop Name + Artist/Supplier Name (RTL aligned next to logo)
  const textRightX = logoRightEdge - logoSize - Math.round(w * 0.022);
  const titleFontSize = Math.max(18, Math.round(barH * 0.30));
  const subFontSize = Math.max(14, Math.round(barH * 0.21));

  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Workshop / Store Name
  ctx.font = `800 ${titleFontSize}px "Cairo", "Tajawal", system-ui, sans-serif`;
  ctx.fillStyle = '#FFF9EE';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 6;
  const titleY = showSecondary ? logoCenterY - Math.round(barH * 0.14) : logoCenterY;
  ctx.fillText(primaryTitle, textRightX, titleY, w - padX * 2 - logoSize - 24);

  // Artist / Supplier Name (only if distinct)
  if (showSecondary) {
    ctx.font = `600 ${subFontSize}px "Cairo", "Tajawal", system-ui, sans-serif`;
    ctx.fillStyle = '#E8C98A';
    ctx.shadowBlur = 4;
    ctx.fillText(
      `${roleLabel}: ${cleanArtist}`,
      textRightX,
      logoCenterY + Math.round(barH * 0.19),
      w - padX * 2 - logoSize - 24
    );
  }
  ctx.restore();

  try {
    return canvas.toDataURL('image/png', 0.96);
  } catch {
    return sourceDataUrl;
  }
}
