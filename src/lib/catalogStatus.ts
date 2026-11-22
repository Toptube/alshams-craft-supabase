import type { SavedProductRecord } from '../types';

export type CatalogStatusColor = 'red' | 'yellow' | 'green';

export interface ProductCatalogStatusInfo {
  color: CatalogStatusColor;
  shortLabel: string;
  badgeText: string;
  actionHint: string;
  isInStore: boolean;
  isCosted: boolean;
  dotClass: string;
  badgeClass: string;
  borderAccentClass: string;
}

export interface StoreProductStatusInfo {
  color: CatalogStatusColor;
  shortLabel: string;
  subNote?: string;
  actionHint: string;
  isVisible: boolean;
  isExportedToMarket: boolean;
  isApprovedInMarket: boolean;
  isPendingInMarket: boolean;
  dotClass: string;
  badgeClass: string;
  borderAccentClass: string;
}

/**
 * Determines whether a product has real calculated production cost from the Cost Calculator.
 */
export function isProductCosted(p: SavedProductRecord): boolean {
  if (p.isCosted === true) return true;
  if (p.directCatalogEntry === true) return false;
  const outputCost =
    Number(p.output?.unifiedBreakdown?.totalUnitCost || 0) ||
    Number(p.output?.totalDirectMaterialsCost || 0) +
      Number(p.output?.laborWage || 0) +
      Number(p.output?.packagingCost || 0) +
      Number(p.output?.transitFees || 0) +
      Number(p.output?.adminExpensesShare || 0);
  const cost = Number(p.costPrice || 0) || outputCost;
  return cost > 0;
}

/**
 * Determines whether a product is actively published/displayed in the artisan's Storefront.
 */
export function isProductInStore(p: SavedProductRecord): boolean {
  return Boolean(p.inStore && p.isPublishedInStore !== false);
}

/**
 * CATALOG 3-Color Status System (الكتالوج):
 * - RED (أحمر): Added to Catalog only, NOT yet displayed in My Store.
 *   Click action -> Export/display in My Store immediately (turns Yellow if uncosted, or Green if already costed).
 * - YELLOW (أصفر): Displayed in My Store, added directly WITHOUT Cost Calculator costing.
 *   Click action -> True import into the Cost Calculator (saving turns it Green automatically).
 * - GREEN (أخضر): Complete — calculated in Cost Calculator AND live in My Store.
 */
export function getProductCatalogStatus(p: SavedProductRecord): ProductCatalogStatusInfo {
  const inStore = isProductInStore(p);
  const costed = isProductCosted(p);

  if (!inStore) {
    return {
      color: 'red',
      shortLabel: 'بالكتالوج فقط',
      badgeText: 'غير معروض بالمتجر',
      actionHint: 'اضغط للعرض بالمتجر فوراً',
      isInStore: false,
      isCosted: costed,
      dotClass: 'bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.22)]',
      badgeClass:
        'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/35 hover:bg-rose-500/20',
      borderAccentClass: 'border-r-4 border-r-rose-500',
    };
  }

  if (!costed) {
    return {
      color: 'yellow',
      shortLabel: 'بالمتجر — بدون تكلفة',
      badgeText: 'معروض · بدون حاسبة تكاليف',
      actionHint: 'اضغط لاستيراد المنتج في حاسبة التكاليف',
      isInStore: true,
      isCosted: false,
      dotClass: 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]',
      badgeClass:
        'bg-amber-400/15 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-400/25',
      borderAccentClass: 'border-r-4 border-r-amber-400',
    };
  }

  return {
    color: 'green',
    shortLabel: 'مكتمل (مسعّر وبالمتجر)',
    badgeText: 'مكتمل · مسعّر ومعروض بالمتجر',
    actionHint: 'مرتبط بحاسبة التكاليف ومتاح بمتجرك',
    isInStore: true,
    isCosted: true,
    dotClass: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]',
    badgeClass:
      'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
    borderAccentClass: 'border-r-4 border-r-emerald-500',
  };
}

/**
 * STOREFRONT 3-Color Status System (متجري):
 * - GREEN (أخضر): Exported to Al-Shamsawya Central Market (سوق الشمساوية).
 * - YELLOW (أصفر): Visible in My Store ONLY (في متجري فقط — غير مصدّر لسوق الشمساوية بعد).
 * - RED (أحمر): Temporarily hidden from customers (قافل عليه الظهور مؤقتاً — العين رصاصي).
 */
export function getStoreProductStatus(p: SavedProductRecord): StoreProductStatusInfo {
  const isVisible = p.inStore !== false && p.isPublishedInStore !== false;
  const isExportedToMarket = Boolean(p.inMarket && p.marketStatus !== 'rejected');
  const isApprovedInMarket = Boolean(
    p.inMarket && (p.marketStatus === 'approved' || p.isMarketplaceApproved)
  );
  const isPendingInMarket = Boolean(
    p.inMarket && !isApprovedInMarket && p.marketStatus !== 'rejected'
  );

  if (!isVisible) {
    return {
      color: 'red',
      shortLabel: 'مخفي مؤقتاً',
      subNote: 'الظهور مغلق عن العملاء',
      actionHint: 'اضغط على العين لإعادة إظهار المنتج في متجرك',
      isVisible: false,
      isExportedToMarket,
      isApprovedInMarket,
      isPendingInMarket,
      dotClass: 'bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.22)]',
      badgeClass:
        'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/35',
      borderAccentClass: 'border-r-4 border-r-rose-500',
    };
  }

  if (isExportedToMarket) {
    return {
      color: 'green',
      shortLabel: isApprovedInMarket ? 'بسوق الشمساوية ✓' : 'مصدّر لسوق الشمساوية',
      subNote: isPendingInMarket ? 'بانتظار مراجعة الأدمن' : 'معروض بالمتجر والسوق',
      actionHint: isPendingInMarket
        ? 'تم التصدير لسوق الشمساوية وبانتظار اعتماد الأدمن'
        : 'مصدّر ومعروض في متجر الشمساوية',
      isVisible: true,
      isExportedToMarket: true,
      isApprovedInMarket,
      isPendingInMarket,
      dotClass: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]',
      badgeClass:
        'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
      borderAccentClass: 'border-r-4 border-r-emerald-500',
    };
  }

  return {
    color: 'yellow',
    shortLabel: 'في متجري فقط',
    subNote: 'غير مصدّر لسوق الشمساوية',
    actionHint: 'معروض في متجرك الخاص فقط — يمكنك تصديره لسوق الشمساوية',
    isVisible: true,
    isExportedToMarket: false,
    isApprovedInMarket: false,
    isPendingInMarket: false,
    dotClass: 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]',
    badgeClass:
      'bg-amber-400/15 text-amber-800 dark:text-amber-300 border-amber-500/40',
    borderAccentClass: 'border-r-4 border-r-amber-400',
  };
}

/**
 * Extracts YouTube video ID from standard, short, embed, or Shorts URLs.
 */
export function extractYouTubeId(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const m = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  return m?.[1] || null;
}

/**
 * Returns a lightweight static thumbnail URL for a product video link
 * without loading any heavy iframe or remote video file.
 */
export function getVideoThumbnailUrl(
  videoUrl?: string | null,
  fallbackImageUrl?: string | null
): string {
  const ytId = extractYouTubeId(videoUrl);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }
  return fallbackImageUrl || '/alshams_falcon_emblem.png';
}

export function detectVideoPlatformLabel(rawUrl?: string | null): string {
  const u = (rawUrl || '').toLowerCase();
  if (!u) return 'فيديو';
  if (u.includes('youtube.com/shorts')) return 'يوتيوب شورتس';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'يوتيوب';
  if (u.includes('tiktok.com')) return 'تيك توك';
  if (u.includes('instagram.com')) return 'إنستجرام';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'فيسبوك';
  if (u.includes('vimeo.com')) return 'فيميو';
  return 'فيديو المنتج';
}

export function isValidHttpVideoUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
