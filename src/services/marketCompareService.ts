/**
 * منظومة المقارنة المنفصلة (الميزان ⚖️) ومشاركة المفضلة والمقارنة وتنبيه توفير الشحن وطلب التسعير المجمّع (B2B RFQ)
 * - أوفلاين 100% — منفصلة تماماً عن سلة الشراء (تتيح إضافة حتى 12 منتج/خامة للمقارنة والتصفية قبل النقل للسلة).
 * - لا تخزّن أي بيانات داخلية أو تكاليف ورش؛ فقط الحقول العامة المعروضة للعميل.
 */

import type { WishlistItem } from './wishlistService';

export type CompareScope = 'artisan' | 'supplier';

export interface PublicCompareItem {
  id: string;
  scope: CompareScope;
  name: string;
  priceEgp: number;
  originalPriceEgp?: number;
  wholesalePriceEgp?: number;
  minWholesaleQty?: number;
  unitLabel?: string;
  craftOrCategory?: string;
  sizeLabel?: string;
  prepDays?: number;
  storeId?: string;
  storeName: string;
  storeSlug?: string;
  /** رقم الواتساب فقط إذا سمحت إعدادات خصوصية المتجر بذلك */
  publicWhatsapp?: string;
  imageUrl?: string;
  inStock: boolean;
  isFreeShipping?: boolean;
  ratingAvg?: number;
  addedAt: number;
}

export interface SameStoreShippingGroup {
  storeKey: string;
  storeName: string;
  itemIds: string[];
  itemNames: string[];
  count: number;
}

export interface CompareNarrowingRecommendation {
  summaryAr: string;
  topPicks: Array<{
    item: PublicCompareItem;
    badgeAr: string;
    reasonAr: string;
  }>;
  shippingTipAr?: string;
}

const COMPARE_STORAGE_KEY = 'alshams_public_compare_v1';
const MAX_COMPARE_PER_SCOPE = 12;

export function getAllCompareItems(): PublicCompareItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => x && x.id && x.scope) : [];
  } catch {
    return [];
  }
}

export function getCompareItemsByScope(scope: CompareScope): PublicCompareItem[] {
  return getAllCompareItems().filter((x) => x.scope === scope);
}

function persistCompareItems(items: PublicCompareItem[]): PublicCompareItem[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('alshams_compare_updated', { detail: items }));
    } catch {
      // ignore storage quota
    }
  }
  return items;
}

export function toggleCompareItem(
  item: Omit<PublicCompareItem, 'addedAt'>
): { items: PublicCompareItem[]; scopeItems: PublicCompareItem[]; added: boolean; limitReached?: boolean } {
  const all = getAllCompareItems();
  const exists = all.some((x) => x.id === item.id && x.scope === item.scope);
  if (exists) {
    const next = all.filter((x) => !(x.id === item.id && x.scope === item.scope));
    persistCompareItems(next);
    return {
      items: next,
      scopeItems: next.filter((x) => x.scope === item.scope),
      added: false,
    };
  }
  const sameScope = all.filter((x) => x.scope === item.scope);
  if (sameScope.length >= MAX_COMPARE_PER_SCOPE) {
    return {
      items: all,
      scopeItems: sameScope,
      added: false,
      limitReached: true,
    };
  }
  const next: PublicCompareItem[] = [{ ...item, addedAt: Date.now() }, ...all];
  persistCompareItems(next);
  return {
    items: next,
    scopeItems: next.filter((x) => x.scope === item.scope),
    added: true,
  };
}

export function removeCompareItem(id: string, scope: CompareScope): PublicCompareItem[] {
  const next = getAllCompareItems().filter((x) => !(x.id === id && x.scope === scope));
  persistCompareItems(next);
  return next.filter((x) => x.scope === scope);
}

export function clearCompareScope(scope: CompareScope): PublicCompareItem[] {
  const next = getAllCompareItems().filter((x) => x.scope !== scope);
  persistCompareItems(next);
  return [];
}

/**
 * تنبيه «وفّر شحن» الذكي: يكتشف أي منتجين أو أكثر من نفس الفنان أو المورد
 */
export function detectSameStoreShippingGroups(
  items: Array<{ id: string; name?: string; productName?: string; storeId?: string; workshopId?: string; storeName?: string; brandName?: string }>
): SameStoreShippingGroup[] {
  const map = new Map<string, SameStoreShippingGroup>();
  for (const item of items) {
    const sName = (item.storeName || item.brandName || '').trim();
    const sKey = (item.storeId || item.workshopId || sName).trim().toLowerCase();
    if (!sKey || !sName) continue;
    const label = (item.name || item.productName || 'منتج').trim();
    const existing = map.get(sKey);
    if (existing) {
      existing.itemIds.push(item.id);
      existing.itemNames.push(label);
      existing.count += 1;
    } else {
      map.set(sKey, {
        storeKey: sKey,
        storeName: sName,
        itemIds: [item.id],
        itemNames: [label],
        count: 1,
      });
    }
  }
  return Array.from(map.values())
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count);
}

/**
 * مساعد شموسة الأوفلاين لتصفية قائمة المقارنة لأفضل 2–3 خيارات
 */
export function narrowCompareItemsWithShamousa(
  items: PublicCompareItem[],
  opts?: { maxBudgetEgp?: number; prioritizeFastDelivery?: boolean; hidePrices?: boolean }
): CompareNarrowingRecommendation {
  if (items.length === 0) {
    return {
      summaryAr: 'أضف منتجين أو أكتر للمقارنة (⚖️) عشان شموسة تصفّيهم وتختارلك الأنسب.',
      topPicks: [],
    };
  }

  const budgetFiltered =
    opts?.maxBudgetEgp && opts.maxBudgetEgp > 0
      ? items.filter((i) => i.priceEgp <= opts.maxBudgetEgp!)
      : items;
  const pool = budgetFiltered.length > 0 ? budgetFiltered : items;

  const sameStoreGroups = detectSameStoreShippingGroups(pool);
  const sameStoreIds = new Set(sameStoreGroups.flatMap((g) => g.itemIds));

  const picks: Array<{ item: PublicCompareItem; badgeAr: string; reasonAr: string }> = [];
  const pickedIds = new Set<string>();

  // 1) أفضل قيمة مقابل السعر (أو أفضل سعر جملة للموردين)
  const byPrice = [...pool].sort((a, b) => {
    const pa = a.scope === 'supplier' && a.wholesalePriceEgp ? a.wholesalePriceEgp : a.priceEgp;
    const pb = b.scope === 'supplier' && b.wholesalePriceEgp ? b.wholesalePriceEgp : b.priceEgp;
    return pa - pb;
  });
  if (byPrice[0]) {
    const it = byPrice[0];
    pickedIds.add(it.id);
    const priceNote = opts?.hidePrices
      ? 'خيار اقتصادي مناسب'
      : it.scope === 'supplier' && it.wholesalePriceEgp
      ? `سعر جملة مميز (${it.wholesalePriceEgp.toLocaleString('ar-EG')} ج.م)`
      : `الأوفر في قائمتك (${it.priceEgp.toLocaleString('ar-EG')} ج.م)`;
    picks.push({
      item: it,
      badgeAr: 'الأوفر سعراً 💰',
      reasonAr: `${priceNote}${it.isFreeShipping ? ' + شحن مجاني' : ''}.`,
    });
  }

  // 2) الأسرع استلاماً / المتوفر فوراً
  const fastest = [...pool]
    .filter((i) => !pickedIds.has(i.id))
    .sort((a, b) => {
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      return (a.prepDays ?? 5) - (b.prepDays ?? 5);
    })[0];
  if (fastest) {
    pickedIds.add(fastest.id);
    picks.push({
      item: fastest,
      badgeAr: fastest.inStock ? 'جاهز وسريع ⚡' : 'أسرع تجهيز ⏱️',
      reasonAr: fastest.prepDays
        ? `مدة التجهيز حوالي ${fastest.prepDays} أيام${sameStoreIds.has(fastest.id) ? ' ومن نفس المتجر لتوفير الشحن' : ''}.`
        : `متوفر للطلب المباشر من ${fastest.storeName}.`,
    });
  }

  // 3) الأعلى تقييماً أو ميزة توفير الشحن
  const third = [...pool]
    .filter((i) => !pickedIds.has(i.id))
    .sort((a, b) => {
      const bonusA = (sameStoreIds.has(a.id) ? 2 : 0) + (a.isFreeShipping ? 1.5 : 0) + (a.ratingAvg || 0);
      const bonusB = (sameStoreIds.has(b.id) ? 2 : 0) + (b.isFreeShipping ? 1.5 : 0) + (b.ratingAvg || 0);
      return bonusB - bonusA;
    })[0];
  if (third) {
    pickedIds.add(third.id);
    picks.push({
      item: third,
      badgeAr: sameStoreIds.has(third.id) ? 'يوفّر في الشحن 🚚' : 'خيار متوازن ⭐',
      reasonAr: sameStoreIds.has(third.id)
        ? `من نفس المتجر (${third.storeName}) — لو جمعته مع القطعة التانية هتدفع شحن واحد بس.`
        : `تقييم ممتاز وجودة متوازنة من ${third.storeName}.`,
    });
  }

  const shippingTipAr =
    sameStoreGroups.length > 0
      ? `💡 وفّر شحن: عندك ${sameStoreGroups[0].count} منتجات من «${sameStoreGroups[0].storeName}» — جمعهم في طلب واحد عشان تدفع شحن مرة واحدة!`
      : undefined;

  const budgetPrefix =
    opts?.maxBudgetEgp && budgetFiltered.length === 0
      ? `كل المنتجات في المقارنة أعلى من ${opts.maxBudgetEgp.toLocaleString('ar-EG')} ج.م، فاخترتلك أقرب ${picks.length} بدائل:`
      : `شموسة صفتلك ${items.length} اختيارات في المقارنة وطلعتلك أفضل ${picks.length} خيارات:`;

  return {
    summaryAr: budgetPrefix,
    topPicks: picks.slice(0, 3),
    shippingTipAr,
  };
}

/**
 * بناء رسالة مشاركة المفضلة عبر واتساب (منتج واحد أو القائمة كلها)
 */
export function buildWishlistWhatsAppShareText(
  items: WishlistItem[],
  pageUrl: string,
  opts?: { hidePrices?: boolean; referralCode?: string }
): string {
  const shareUrl = appendReferralParamIfAny(pageUrl, opts?.referralCode);
  if (items.length === 1) {
    const p = items[0];
    const priceStr = opts?.hidePrices ? '' : ` — السعر: ${p.egpPrice.toLocaleString('ar-EG')} ج.م`;
    return `☀️ شوف القطعة اليدوية دي اللي عجبتني في الشمساوية:\n• ${p.productName}${priceStr}${p.brandName ? `\n• المتجر: ${p.brandName}` : ''}\n🔗 ${shareUrl}`;
  }
  const lines = items.slice(0, 10).map((p, idx) => {
    const priceStr = opts?.hidePrices ? '' : ` (${p.egpPrice.toLocaleString('ar-EG')} ج.م)`;
    return `${idx + 1}. ${p.productName}${priceStr}${p.brandName ? ` — ${p.brandName}` : ''}`;
  });
  return `❤️ دي قائمتي المفضلة في الشمساوية (${items.length} منتجات):\n${lines.join('\n')}\n\n🔗 تصفح القائمة: ${shareUrl}`;
}

/**
 * بناء رسالة مشاركة المقارنة عبر واتساب (لمساعدة الأهل والأصدقاء في الاختيار السريع)
 */
export function buildCompareWhatsAppShareText(
  items: PublicCompareItem[],
  pageUrl: string,
  opts?: { hidePrices?: boolean; referralCode?: string }
): string {
  const shareUrl = appendReferralParamIfAny(pageUrl, opts?.referralCode);
  const top = items.slice(0, 5);
  const blocks = top.map((it, idx) => {
    const parts: string[] = [`${idx + 1}) ${it.name}`];
    if (!opts?.hidePrices) {
      parts.push(
        it.scope === 'supplier' && it.wholesalePriceEgp
          ? `السعر: ${it.priceEgp.toLocaleString('ar-EG')} ج.م (جملة ${it.wholesalePriceEgp.toLocaleString('ar-EG')} ج.م من ${it.minWholesaleQty || 5} ${it.unitLabel || 'وحدة'})`
          : `السعر: ${it.priceEgp.toLocaleString('ar-EG')} ج.م`
      );
    }
    if (it.sizeLabel) parts.push(`المقاس/الوحدة: ${it.sizeLabel}`);
    if (it.prepDays) parts.push(`التجهيز: ~${it.prepDays} أيام`);
    parts.push(`المتجر: ${it.storeName}`);
    return parts.join(' | ');
  });
  return `⚖️ محتار بين الاختيارات دي في الشمساوية — رأيك أختار أنهي واحد؟\n\n${blocks.join('\n')}\n\n🔗 الرابط: ${shareUrl}`;
}

export function buildWhatsAppShareUrl(text: string, phone?: string): string {
  const cleanPhone = (phone || '').replace(/[^\d]/g, '');
  if (cleanPhone.length >= 10) {
    const intl = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildFacebookShareUrl(pageUrl: string, quoteText: string, referralCode?: string): string {
  const shareUrl = appendReferralParamIfAny(pageUrl, referralCode);
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(quoteText)}`;
}

/**
 * بناء طلب عرض سعر مجمّع للكميات (B2B RFQ) من شاشة المقارنة في سوق الموردين
 */
export function buildSupplierBulkRfqGroups(
  items: PublicCompareItem[],
  quantities: Record<string, number>,
  buyer: { name?: string; workshop?: string; governorate?: string; notes?: string }
): Array<{
  storeKey: string;
  storeName: string;
  publicWhatsapp?: string;
  itemsCount: number;
  messageText: string;
}> {
  const grouped = new Map<string, { storeName: string; publicWhatsapp?: string; lines: PublicCompareItem[] }>();
  for (const it of items) {
    const key = (it.storeId || it.storeName).toLowerCase();
    const cur = grouped.get(key);
    if (cur) cur.lines.push(it);
    else grouped.set(key, { storeName: it.storeName, publicWhatsapp: it.publicWhatsapp, lines: [it] });
  }

  return Array.from(grouped.entries()).map(([storeKey, grp]) => {
    const lineTexts = grp.lines.map((it, idx) => {
      const q = Math.max(1, Number(quantities[it.id] || it.minWholesaleQty || 5));
      return `${idx + 1}. ${it.name} — الكمية المطلوبة: ${q} ${it.unitLabel || 'وحدة'}`;
    });
    const header = `📦 طلب تسعير مجمّع للكميات (من سوق الموردين — الشمساوية)\nإلى: ${grp.storeName}`;
    const buyerBlock = [
      buyer.workshop ? `• الورشة: ${buyer.workshop}` : '',
      buyer.name ? `• المسؤول: ${buyer.name}` : '',
      buyer.governorate ? `• المحافظة: ${buyer.governorate}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const footer =
      (buyer.notes?.trim() ? `\n📝 ملاحظات: ${buyer.notes.trim()}\n` : '\n') +
      'نرجو إفادتنا بأفضل سعر جملة وميعاد التوريد والشحن الموحّد لكل القائمة معاً.';

    const messageText = [header, buyerBlock, '\n📋 قائمة الخامات:', lineTexts.join('\n'), footer]
      .filter(Boolean)
      .join('\n');

    return {
      storeKey,
      storeName: grp.storeName,
      publicWhatsapp: grp.publicWhatsapp,
      itemsCount: grp.lines.length,
      messageText,
    };
  });
}

function appendReferralParamIfAny(url: string, refCode?: string): string {
  if (!refCode || !refCode.trim()) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('ref', refCode.trim());
    return parsed.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}ref=${encodeURIComponent(refCode.trim())}`;
  }
}
