import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Check,
  Search,
  Share2,
  ShieldAlert,
  ShoppingCart,
  Star,
  Table2,
  Trash2,
  User,
  X,
  Plus,
  Flame,
  Tag,
  Ticket,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  SUPPLIER_SUPPLY_SECTIONS,
  SupplierCatalogItem,
  SupplierProfile,
  SupplierReview,
  resolveSupplierItemPricing,
} from '../../types/supplier';
import { MemberPersonalProfile } from '../../types/memberProfile';
import {
  fetchPublicSupplierStore,
  placeB2BSupplyOrder,
  submitSupplierReview,
} from '../../db/supplierService';
import { MemberPersonalProfileView } from '../profile/MemberPersonalProfileView';
import { playButtonClickSound, playErrorSound, playSuccessSound } from '../../lib/sounds';
import { resolveStorefrontTheme, StorefrontThemeId } from '../../lib/storefrontThemes';
import { ProductVideoThumbnail } from '../common/ProductVideoThumbnail';
import { ProductMediaCarousel } from '../common/ProductMediaCarousel';
import { StorePromoBannerDisplay } from '../store/StorePromoBannerDisplay';
import { isLimitedOfferCurrentlyActive } from '../../types/artisanStoreBuilder';
import { MarketCouponConfig } from '../../types/marketplaceBuilder';

interface SupplierPublicStoreViewProps {
  slug: string;
  profile?: UserProfile | null;
  onNavigateToSuppliersMarket: () => void;
  onNavigateToCentralMarket: () => void;
  onNavigateToApp?: () => void;
  previewThemeOverride?: StorefrontThemeId | string | null;
  isOwnerPreview?: boolean;
  onClosePreview?: () => void;
  localSupplierOverride?: Partial<SupplierProfile> | null;
}

interface CartLine {
  item: SupplierCatalogItem;
  quantity: number;
}

function getSupplierItemOfferMeta(item: SupplierCatalogItem) {
  const pd = item.productDiscount;
  const activePd = pd && pd.enabled && isLimitedOfferCurrentlyActive(pd) ? pd : undefined;
  const retailBase = Number(item.retailPrice || 0);
  let originalRetail = retailBase;
  let finalRetail = retailBase;
  let hasDiscount = false;
  let badgeText: string | undefined;
  let bogoLabel: string | undefined;
  let couponRequiredCode: string | undefined;
  let isFreeShipping = false;

  if (activePd) {
    const isCouponOnly = activePd.applyMode === 'coupon' && Boolean(activePd.linkedCouponCode?.trim());
    if (isCouponOnly) couponRequiredCode = activePd.linkedCouponCode!.trim().toUpperCase();

    if (activePd.type === 'before_after') {
      const orig = Number(activePd.originalPrice || retailBase);
      const after = Number(activePd.offerPrice || retailBase);
      if (orig > after && after > 0) {
        originalRetail = orig;
        if (!isCouponOnly) {
          finalRetail = after;
          hasDiscount = true;
        }
        const pct = Math.round(((orig - after) / orig) * 100);
        badgeText = activePd.badgeText?.trim() || (pct > 0 ? `خصم ${pct}%` : 'عرض خاص');
      }
    } else if (activePd.type === 'percent' && Number(activePd.value) > 0) {
      const pct = Math.min(90, Math.max(1, Number(activePd.value)));
      if (!isCouponOnly) {
        finalRetail = Math.max(0, Number((retailBase * (1 - pct / 100)).toFixed(2)));
        hasDiscount = finalRetail < originalRetail;
      }
      badgeText = activePd.badgeText?.trim() || `خصم ${pct}%`;
    } else if (activePd.type === 'fixed' && Number(activePd.value) > 0) {
      const val = Number(activePd.value);
      if (!isCouponOnly) {
        finalRetail = Math.max(0, Number((retailBase - val).toFixed(2)));
        hasDiscount = finalRetail < originalRetail;
      }
      badgeText = activePd.badgeText?.trim() || `وفر ${val}`;
    } else if (activePd.type === 'bogo') {
      const buyQ = Math.max(1, Number(activePd.buyQty) || 2);
      const freeQ = Math.max(1, Number(activePd.freeQty) || 1);
      bogoLabel = `اشتري ${buyQ} + ${freeQ} مجاناً`;
      badgeText = activePd.badgeText?.trim() || bogoLabel;
    } else if (activePd.type === 'free_shipping') {
      isFreeShipping = true;
      badgeText = activePd.badgeText?.trim() || 'شحن مجاني';
    } else if (activePd.type === 'special_offer') {
      badgeText = activePd.badgeText?.trim() || 'عرض خاص';
    }
  } else if (item.discountType === 'percent' && item.discountValue > 0) {
    finalRetail = Math.max(0, Number((retailBase * (1 - item.discountValue / 100)).toFixed(2)));
    hasDiscount = finalRetail < originalRetail;
    badgeText = `خصم ${item.discountValue}%`;
  } else if (item.discountType === 'fixed' && item.discountValue > 0) {
    finalRetail = Math.max(0, Number((retailBase - item.discountValue).toFixed(2)));
    hasDiscount = finalRetail < originalRetail;
    badgeText = `وفر ${item.discountValue}`;
  }

  return {
    originalRetail,
    finalRetail,
    hasDiscount,
    badgeText,
    bogoLabel,
    couponRequiredCode,
    isFreeShipping,
    isBestSeller: Boolean(pd?.isBestSeller),
    isSpecialOffer: Boolean(pd?.isSpecialOffer || hasDiscount || bogoLabel || activePd),
  };
}

function calcPrice(item: SupplierCatalogItem, qty: number) {
  const base = resolveSupplierItemPricing(item, qty);
  const meta = getSupplierItemOfferMeta(item);
  if (base.appliedMode === 'retail' && meta.hasDiscount && meta.finalRetail < base.unitPrice) {
    return {
      ...base,
      unitPrice: meta.finalRetail,
      lineTotal: Number((meta.finalRetail * Math.max(0.01, Number(qty || 1))).toFixed(2)),
    };
  }
  return base;
}

export const SupplierPublicStoreView: React.FC<SupplierPublicStoreViewProps> = ({
  slug,
  profile,
  onNavigateToSuppliersMarket,
  onNavigateToCentralMarket,
  onNavigateToApp,
  previewThemeOverride,
  isOwnerPreview = false,
  onClosePreview,
  localSupplierOverride,
}) => {
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberPersonalProfile | null>(null);
  const [items, setItems] = useState<SupplierCatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SupplierCatalogItem | null>(null);
  const [reviews, setReviews] = useState<SupplierReview[]>([]);
  const [ratingAvg, setRatingAvg] = useState(5);
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [suspendedMsg, setSuspendedMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'price_table' | 'reviews'>('catalog');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState(profile?.phoneNumber || '');
  const [buyerName, setBuyerName] = useState(profile?.artistName || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'offers' | 'bestsellers'>('all');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<MarketCouponConfig | null>(null);
  const [couponErr, setCouponErr] = useState('');

  const hasAuthSession = Boolean(profile && profile.id);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await fetchPublicSupplierStore(slug);
      if (!mounted) return;
      if (!res || !res.supplier) {
        setSupplier(null);
        setMemberProfile(null);
        setItems([]);
        setReviews([]);
        setSuspendedMsg(null);
      } else if (res.suspended) {
        setSupplier(res.supplier);
        setMemberProfile(null);
        setItems([]);
        setReviews([]);
        setSuspendedMsg(res.suspensionReason || 'متجر المورد غير متاح للعرض حالياً.');
      } else {
        setSupplier(res.supplier);
        setMemberProfile(res.memberProfile || null);
        setItems(res.items);
        setReviews(res.reviews || []);
        setRatingAvg(Number(res.ratingAvg ?? res.supplier.ratingStars ?? 5));
        setSuspendedMsg(null);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || !hasAuthSession || !revComment.trim()) return;
    setRevSubmitting(true);
    const res = await submitSupplierReview(supplier.id, {
      rating: revRating,
      comment: revComment.trim(),
      workshopId: profile?.workshopId || profile?.tenantId || profile?.id || '',
      reviewerName: profile?.artistName || 'فنان بالشمساوية',
      reviewerBrand: profile?.brandName || 'ورشة بالشمساوية',
      reviewerRole: (profile as any)?.accountRole || 'artisan',
    });
    setRevSubmitting(false);
    if (res.success && res.review) {
      playSuccessSound();
      setReviews((prev) => [res.review!, ...prev]);
      if (res.ratingAvg) setRatingAvg(res.ratingAvg);
      setRevComment('');
      setToast('تم نشر تقييمك للمورد بنجاح');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const storeCoupons = useMemo<MarketCouponConfig[]>(() => {
    const cfg = localSupplierOverride?.storeConfig || supplier?.storeConfig;
    const rich = Array.isArray(cfg?.richCoupons) ? cfg!.richCoupons! : [];
    if (rich.length > 0) return rich;
    const legacy = Array.isArray(cfg?.coupons) ? cfg!.coupons! : [];
    return legacy.map((c, idx) => ({
      id: `sup-cpn-${idx}-${c.code}`,
      code: c.code,
      type: c.type || 'percent',
      value: Number(c.discountPercent ?? c.value ?? 0),
      minOrder: c.minOrder,
      description: c.description,
      active: c.active,
      visible: true,
      createdAt: new Date().toISOString(),
      buyQty: c.buyQty,
      freeQty: c.freeQty,
      endsAt: c.endsAt,
      showInBanner: c.showInBanner,
    }));
  }, [localSupplierOverride?.storeConfig, supplier?.storeConfig]);

  const orderedItems = useMemo(() => {
    const orderIds =
      localSupplierOverride?.storeConfig?.productOrderIds ||
      supplier?.storeConfig?.productOrderIds ||
      [];
    if (orderIds.length === 0) {
      return [...items].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    }
    const rank = new Map(orderIds.map((id, idx) => [id, idx]));
    return [...items].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : 9999 + (a.sortOrder ?? 0);
      const rb = rank.has(b.id) ? rank.get(b.id)! : 9999 + (b.sortOrder ?? 0);
      return ra - rb;
    });
  }, [items, localSupplierOverride?.storeConfig?.productOrderIds, supplier?.storeConfig?.productOrderIds]);

  const { specialOfferItems, bestSellerItems } = useMemo(() => {
    const offers: SupplierCatalogItem[] = [];
    const bests: SupplierCatalogItem[] = [];
    orderedItems.forEach((it) => {
      const meta = getSupplierItemOfferMeta(it);
      if (meta.isSpecialOffer) offers.push(it);
      if (meta.isBestSeller) bests.push(it);
    });
    return { specialOfferItems: offers, bestSellerItems: bests };
  }, [orderedItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const offerSet = new Set(specialOfferItems.map((i) => i.id));
    const bestSet = new Set(bestSellerItems.map((i) => i.id));
    return orderedItems.filter((i) => {
      const matchFilter =
        catalogFilter === 'all' ||
        (catalogFilter === 'offers' && offerSet.has(i.id)) ||
        (catalogFilter === 'bestsellers' && bestSet.has(i.id));
      if (!matchFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
      );
    });
  }, [orderedItems, searchQuery, catalogFilter, specialOfferItems, bestSellerItems]);

  const addToCart = (item: SupplierCatalogItem, qty = 1) => {
    playButtonClickSound();
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { item, quantity: qty }];
    });
    setToast(`تم إضافة "${item.name}" للسلة`);
    setTimeout(() => setToast(null), 2500);
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, line) => sum + calcPrice(line.item, line.quantity).lineTotal, 0);
  }, [cart]);

  const cartCouponDiscount = useMemo(() => {
    if (!appliedCoupon || cartSubtotal <= 0) return 0;
    if (appliedCoupon.minOrder && cartSubtotal < appliedCoupon.minOrder) return 0;
    if (appliedCoupon.type === 'percent') {
      return Number(((cartSubtotal * Math.max(0, appliedCoupon.value)) / 100).toFixed(2));
    }
    if (appliedCoupon.type === 'fixed') {
      return Math.min(cartSubtotal, Math.max(0, Number(appliedCoupon.value)));
    }
    if (appliedCoupon.type === 'bogo') {
      const buyQ = Math.max(1, Number(appliedCoupon.buyQty) || 2);
      const freeQ = Math.max(1, Number(appliedCoupon.freeQty) || 1);
      const groupSize = buyQ + freeQ;
      const units: number[] = [];
      cart.forEach((line) => {
        const pr = calcPrice(line.item, line.quantity);
        for (let k = 0; k < Math.floor(line.quantity); k += 1) units.push(pr.unitPrice);
      });
      units.sort((a, b) => a - b);
      const freeCount = Math.floor(units.length / groupSize) * freeQ;
      return freeCount > 0 ? Number(units.slice(0, freeCount).reduce((s, p) => s + p, 0).toFixed(2)) : 0;
    }
    return 0;
  }, [appliedCoupon, cartSubtotal, cart]);

  const cartTotal = useMemo(() => Math.max(0, Number((cartSubtotal - cartCouponDiscount).toFixed(2))), [cartSubtotal, cartCouponDiscount]);

  const handleApplySupplierCoupon = () => {
    setCouponErr('');
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponErr('أدخل كود الخصم أولاً');
      return;
    }
    const found = storeCoupons.find((c) => c.active && c.code.trim().toUpperCase() === code);
    if (!found) {
      setAppliedCoupon(null);
      setCouponErr('كود الخصم غير صحيح أو غير مفعل لدى المورد.');
      playErrorSound();
      return;
    }
    if (found.endsAt && new Date(found.endsAt).getTime() < Date.now()) {
      setAppliedCoupon(null);
      setCouponErr('انتهت صلاحية هذا الكود.');
      playErrorSound();
      return;
    }
    if (found.minOrder && cartSubtotal < found.minOrder) {
      setAppliedCoupon(null);
      setCouponErr(`الحد الأدنى لهذا الكود ${found.minOrder.toLocaleString('ar-EG')} ${supplier?.currencySymbol || 'ج.م'}`);
      playErrorSound();
      return;
    }
    if (found.type === 'bogo') {
      const need = Math.max(1, Number(found.buyQty) || 2) + Math.max(1, Number(found.freeQty) || 1);
      const totalQty = cart.reduce((s, l) => s + Math.floor(l.quantity), 0);
      if (totalQty < need) {
        setAppliedCoupon(null);
        setCouponErr(`عرض اشتري وخذ مجاناً يتطلب ${need} وحدات على الأقل بالسلة.`);
        playErrorSound();
        return;
      }
    }
    setAppliedCoupon(found);
    playSuccessSound();
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || cart.length === 0) return;

    const couponNote = appliedCoupon
      ? `\nكود الخصم المطبق: ${appliedCoupon.code} (${
          appliedCoupon.type === 'free_shipping'
            ? 'شحن مجاني'
            : `خصم ${cartCouponDiscount.toLocaleString('ar-EG')} ${supplier.currencySymbol}`
        })`
      : '';

    if (!hasAuthSession) {
      const digits = String(supplier.phone || '').replace(/\D/g, '');
      const waPhone = digits.startsWith('0') ? `2${digits}` : digits;
      const lines = cart
        .map((c) => {
          const pr = calcPrice(c.item, c.quantity);
          return `- ${c.item.name} × ${c.quantity} ${c.item.unit} (${pr.lineTotal} ${supplier.currencySymbol})`;
        })
        .join('\n');
      const msg = `مرحباً "${supplier.brandName}"، أرغب في طلب الخامات التالية:\n${lines}${couponNote}\nالإجمالي النهائي: ${cartTotal} ${supplier.currencySymbol}\nالاسم: ${buyerName}\nالهاتف: ${buyerPhone}\n${notes}`;
      if (waPhone) {
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      }
      setToast('تم تجهيز تفاصيل الطلب عبر الواتساب!');
      setCart([]);
      setAppliedCoupon(null);
      setCouponInput('');
      setIsCartOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const wid = profile?.workshopId || profile?.tenantId || profile?.id || '';
      const res = await placeB2BSupplyOrder({
        supplierId: supplier.id,
        workshopId: wid,
        orderSource: 'direct_supplier_store',
        items: cart.map((c) => ({
          catalogItemId: c.item.id,
          name: c.item.name,
          unit: c.item.unit,
          quantity: c.quantity,
          retailPrice: c.item.retailPrice,
          wholesalePrice: c.item.wholesalePrice,
          minWholesaleQty: c.item.minWholesaleQty,
          tierPricing: c.item.tierPricing,
          discountType: c.item.discountType,
          discountValue: c.item.discountValue,
        })),
        notes: `${notes.trim()}${couponNote}`.trim(),
        buyerInfo: {
          workshopBrand: profile?.brandName || 'ورشة بالمنظومة',
          name: buyerName.trim() || profile?.artistName || 'فنان',
          phone: buyerPhone.trim() || profile?.phoneNumber || '',
          country: profile?.country || 'مصر',
        },
      });
      if (res.success) {
        playSuccessSound();
        setCart([]);
        setAppliedCoupon(null);
        setCouponInput('');
        setNotes('');
        setIsCartOpen(false);
        setToast(`تم إرسال طلبك المباشر إلى "${supplier.brandName}" بنجاح!`);
      } else {
        playErrorSound();
        setToast(res.error || 'تعذر إرسال الطلب');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const effectiveSupplier: SupplierProfile | null = useMemo(() => {
    if (!supplier && !localSupplierOverride) return null;
    if (!supplier && localSupplierOverride) {
      return {
        id: profile?.supplierId || profile?.id || 'preview',
        brandName: localSupplierOverride.brandName || profile?.brandName || 'متجر المورد',
        ownerName: profile?.artistName || 'المورد',
        storeSlug: localSupplierOverride.storeSlug || slug,
        phone: localSupplierOverride.phone || profile?.phoneNumber || '',
        country: profile?.country || 'مصر',
        governorate: localSupplierOverride.governorate || profile?.governorate || '',
        currencyCode: profile?.currency || 'EGP',
        currencySymbol: profile?.currencySymbol || 'ج.م',
        supplySections: (profile as any)?.supplySections || [],
        ratingStars: 5,
        logoUrl: profile?.logoUrl || '',
        storeConfig: localSupplierOverride.storeConfig || profile?.storeConfig || {},
        ...localSupplierOverride,
      } as SupplierProfile;
    }
    if (supplier && localSupplierOverride) {
      return {
        ...supplier,
        ...localSupplierOverride,
        storeConfig: {
          ...(supplier.storeConfig || {}),
          ...(localSupplierOverride.storeConfig || {}),
        },
      };
    }
    return supplier;
  }, [supplier, localSupplierOverride, profile, slug]);

  const themeSpec = useMemo(
    () => resolveStorefrontTheme(previewThemeOverride || effectiveSupplier?.storeConfig?.themePreset),
    [previewThemeOverride, effectiveSupplier?.storeConfig?.themePreset]
  );
  const isCenteredHero =
    themeSpec.heroLayout === 'centered_maison' ||
    themeSpec.heroLayout === 'noir_spotlight' ||
    themeSpec.heroLayout === 'swiss_minimal' ||
    themeSpec.heroLayout === 'arch_crest';

  if (loading && !localSupplierOverride) {
    return (
      <div
        style={{ backgroundColor: themeSpec.pageBg, color: themeSpec.inkColor }}
        className="min-h-screen flex items-center justify-center"
        dir="rtl"
      >
        <div
          style={{ borderColor: themeSpec.accentBg, borderTopColor: 'transparent' }}
          className="w-10 h-10 border-4 rounded-full animate-spin"
        />
      </div>
    );
  }

  if (!effectiveSupplier || (suspendedMsg && !isOwnerPreview)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2ECE1] dark:bg-[#060B18] p-4" dir="rtl">
        <div className="max-w-md w-full rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black">
            {supplier ? supplier.brandName : 'متجر المورد غير متاح'}
          </h2>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
            {suspendedMsg || 'لم يتم العثور على هذا المتجر أو تم نقله.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onNavigateToSuppliersMarket}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
            >
              تصفح سوق الموردين
            </button>
            <button
              type="button"
              onClick={onNavigateToCentralMarket}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black cursor-pointer"
            >
              سوق الشمساوية
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeSupplier = effectiveSupplier;
  const sectionNames = (activeSupplier.supplySections || [])
    .map((id) => SUPPLIER_SUPPLY_SECTIONS.find((s) => s.id === id)?.titleAr)
    .filter(Boolean);

  const softBtnStyle: React.CSSProperties = {
    backgroundColor: themeSpec.softBg,
    borderColor: themeSpec.borderColor,
    color: themeSpec.inkColor,
  };
  const accentBtnStyle: React.CSSProperties = {
    backgroundColor: themeSpec.accentBg,
    color: themeSpec.accentInk,
  };
  const surfaceStyle: React.CSSProperties = {
    backgroundColor: themeSpec.surfaceBg,
    borderColor: themeSpec.borderColor,
    color: themeSpec.inkColor,
  };

  return (
    <div
      style={{ backgroundColor: themeSpec.pageBg, color: themeSpec.inkColor }}
      className="min-h-screen pb-20 transition-colors duration-300"
      dir="rtl"
    >
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-black shadow-xl">
          {toast}
        </div>
      )}

      <header
        style={surfaceStyle}
        className="sticky top-0 z-30 backdrop-blur-md border-b px-3 sm:px-6 py-3 transition-colors duration-300"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={
                isOwnerPreview && onClosePreview
                  ? onClosePreview
                  : hasAuthSession && onNavigateToApp
                  ? onNavigateToApp
                  : onNavigateToSuppliersMarket
              }
              style={softBtnStyle}
              className={`px-3 py-2 ${themeSpec.buttonRadiusClass} border text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0`}
            >
              <ArrowRight className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
              <span>{isOwnerPreview ? 'عودة للوحة المتجر' : hasAuthSession ? 'رجوع' : 'سوق الموردين'}</span>
            </button>
            <img
              src={activeSupplier.logoUrl || '/alshams_falcon_emblem.png'}
              alt={activeSupplier.brandName}
              style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
              className={`w-10 h-10 ${themeSpec.buttonRadiusClass} border object-contain p-0.5 shrink-0`}
            />
            <div className="min-w-0">
              <h1
                style={{ color: themeSpec.inkColor }}
                className={`text-sm sm:text-base ${themeSpec.titleWeightClass} truncate flex items-center gap-2`}
              >
                <span>{activeSupplier.brandName}</span>
                <span
                  style={{ color: themeSpec.accentText }}
                  className="inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  {ratingAvg.toFixed(1)}
                </span>
              </h1>
              <p style={{ color: themeSpec.mutedColor }} className="text-[11px] truncate">
                {activeSupplier.governorate || activeSupplier.country}
                {sectionNames.length > 0 ? ` · ${sectionNames.join('، ')}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              style={softBtnStyle}
              className={`px-3 py-2 ${themeSpec.buttonRadiusClass} border text-xs font-black flex items-center gap-1.5 cursor-pointer`}
            >
              <User className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
              <span className="hidden sm:inline">الصفحة الشخصية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              style={softBtnStyle}
              className={`px-3 py-2 ${themeSpec.buttonRadiusClass} border text-xs font-bold flex items-center gap-1 cursor-pointer`}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Share2 className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
              )}
              <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'مشاركة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              style={accentBtnStyle}
              className={`px-3.5 py-2 ${themeSpec.buttonRadiusClass} text-xs font-black flex items-center gap-1.5 cursor-pointer hover:opacity-90`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>السلة</span>
              {cart.length > 0 && (
                <span
                  style={{ backgroundColor: themeSpec.badgeBg, color: themeSpec.badgeInk }}
                  className="px-1.5 py-0.5 rounded-full font-mono text-[10px]"
                >
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Supplier Animated/Static Promotional Banner + Active Coupons */}
      <StorePromoBannerDisplay
        banner={activeSupplier.storeConfig?.promoBanner}
        currencySymbol={activeSupplier.currencySymbol}
        coupons={storeCoupons}
        onSelectCouponCode={(code) => {
          navigator.clipboard?.writeText(code).catch(() => {});
          setCouponInput(code);
          setToast(`تم نسخ وتجهيز كود الخصم "${code}" للسلة`);
          setTimeout(() => setToast(null), 3000);
        }}
      />

      {themeSpec.showKineticTicker && (
        <div
          style={{
            backgroundColor: themeSpec.accentBg,
            color: themeSpec.accentInk,
            borderColor: themeSpec.borderColor,
          }}
          className="border-b-2 py-2 px-4 overflow-hidden select-none"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 text-[11px] sm:text-xs font-black whitespace-nowrap overflow-x-auto scrollbar-none">
            <span>★ {activeSupplier.brandName}</span>
            <span>·</span>
            <span>توريد خامات جملة وقطاعي</span>
            <span>·</span>
            <span>{items.length} صنف متاح للتوريد الفوري ★</span>
          </div>
        </div>
      )}

      {/* World-Class Architectural Supplier Hero Banner */}
      <section
        style={{
          backgroundColor: themeSpec.heroBg,
          borderColor: themeSpec.heroBorder,
          color: themeSpec.inkColor,
        }}
        className={`relative border-b transition-colors duration-300 ${
          themeSpec.heroLayout === 'swiss_minimal'
            ? 'py-10 sm:py-12 px-3 sm:px-6'
            : themeSpec.heroLayout === 'centered_maison' ||
              themeSpec.heroLayout === 'noir_spotlight' ||
              themeSpec.heroLayout === 'arch_crest'
            ? 'py-8 sm:py-10 px-3 sm:px-6'
            : 'py-6 sm:py-8 px-3 sm:px-6'
        }`}
      >
        {themeSpec.heroLayout === 'noir_spotlight' && (
          <div
            className="absolute top-0 inset-x-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent 5%, ${themeSpec.accentBg} 50%, transparent 95%)`,
            }}
          />
        )}
        <div
          className={`max-w-7xl mx-auto flex flex-col gap-3 ${
            isCenteredHero ? 'items-center text-center' : 'items-start text-right'
          } ${
            themeSpec.heroLayout === 'centered_maison'
              ? 'p-5 sm:p-7 border rounded-2xl'
              : themeSpec.heroLayout === 'arch_crest'
              ? 'p-6 sm:p-8 border-2 rounded-t-[120px] rounded-b-3xl'
              : themeSpec.heroLayout === 'pop_kinetic'
              ? 'p-5 sm:p-7 border-2 rounded-3xl shadow-[5px_5px_0px_#18181B]'
              : themeSpec.heroLayout === 'gallery_magazine'
              ? 'border-r-4 pr-4 sm:pr-6'
              : ''
          }`}
          style={
            themeSpec.heroLayout === 'centered_maison' ||
            themeSpec.heroLayout === 'arch_crest' ||
            themeSpec.heroLayout === 'pop_kinetic'
              ? { borderColor: themeSpec.heroBorder, backgroundColor: themeSpec.surfaceBg }
              : themeSpec.heroLayout === 'gallery_magazine'
              ? { borderColor: themeSpec.accentBg }
              : undefined
          }
        >
          <span
            style={{ color: themeSpec.accentText }}
            className="text-[11px] font-black tracking-wider"
          >
            {themeSpec.architectureTagAr} · متجر توريد خامات معتمد
          </span>
          <h2
            style={{ color: themeSpec.inkColor }}
            className={`text-2xl sm:text-3xl ${themeSpec.titleWeightClass} leading-tight`}
          >
            {activeSupplier.brandName}
          </h2>
          {activeSupplier.storeConfig?.tagline && (
            <p
              style={{ color: themeSpec.accentText }}
              className="text-xs sm:text-sm font-black max-w-2xl"
            >
              {activeSupplier.storeConfig.tagline}
            </p>
          )}
          {(memberProfile?.storyText || activeSupplier.storeConfig?.description) && (
            <p
              style={{ color: themeSpec.mutedColor }}
              className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap max-w-3xl"
            >
              {memberProfile?.storyText || activeSupplier.storeConfig?.description}
            </p>
          )}
          {activeSupplier.storeConfig?.shippingNote && (
            <p style={{ color: themeSpec.inkColor }} className="text-[11px] font-bold opacity-85">
              الشحن والتسليم: {activeSupplier.storeConfig.shippingNote}
            </p>
          )}
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 space-y-5">
        <div
          style={surfaceStyle}
          className={`${themeSpec.cardRadiusClass} border p-4 flex flex-wrap items-center justify-between gap-3`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'catalog' as const, label: `كتالوج الخامات (${items.length})`, icon: Boxes },
              { id: 'price_table' as const, label: 'جدول الأسعار والشرائح', icon: Table2 },
              { id: 'reviews' as const, label: `تقييمات الورش (${reviews.length})`, icon: Star },
            ].map((tabItem) => {
              const IconComp = tabItem.icon;
              const isSelected = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setActiveTab(tabItem.id)}
                  style={isSelected ? accentBtnStyle : softBtnStyle}
                  className={`px-3.5 py-2 ${themeSpec.buttonRadiusClass} border text-xs font-black cursor-pointer flex items-center gap-1.5 transition hover:opacity-90`}
                >
                  <IconComp
                    className={`w-3.5 h-3.5 ${
                      tabItem.id === 'reviews' && !isSelected ? 'fill-amber-400 text-amber-500' : ''
                    }`}
                  />
                  <span>{tabItem.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: themeSpec.mutedColor }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في أصناف المورد..."
              style={{
                backgroundColor: themeSpec.softBg,
                borderColor: themeSpec.borderColor,
                color: themeSpec.inkColor,
              }}
              className={`w-full h-9 pr-9 pl-3 ${themeSpec.inputRadiusClass} border text-xs font-bold outline-none`}
            />
          </div>

          {activeTab === 'catalog' && (specialOfferItems.length > 0 || bestSellerItems.length > 0) && (
            <div className="w-full flex flex-wrap items-center gap-1.5 pt-2 border-t" style={{ borderColor: themeSpec.borderColor }}>
              <button
                type="button"
                onClick={() => setCatalogFilter('all')}
                style={catalogFilter === 'all' ? accentBtnStyle : softBtnStyle}
                className={`px-3 py-1.5 ${themeSpec.buttonRadiusClass} border text-[11px] font-black cursor-pointer`}
              >
                كافة الخامات ({orderedItems.length})
              </button>
              {specialOfferItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCatalogFilter('offers')}
                  style={catalogFilter === 'offers' ? accentBtnStyle : softBtnStyle}
                  className={`px-3 py-1.5 ${themeSpec.buttonRadiusClass} border text-[11px] font-black cursor-pointer`}
                >
                  🔥 العروض الخاصة ({specialOfferItems.length})
                </button>
              )}
              {bestSellerItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCatalogFilter('bestsellers')}
                  style={catalogFilter === 'bestsellers' ? accentBtnStyle : softBtnStyle}
                  className={`px-3 py-1.5 ${themeSpec.buttonRadiusClass} border text-[11px] font-black cursor-pointer`}
                >
                  ⭐ الأكثر طلباً ({bestSellerItems.length})
                </button>
              )}
            </div>
          )}
        </div>

        {activeTab === 'reviews' ? (
          <section
            style={surfaceStyle}
            className={`${themeSpec.cardRadiusClass} border p-4 sm:p-5 space-y-4`}
          >
            <div
              style={{ borderColor: themeSpec.borderColor }}
              className="flex items-center justify-between border-b pb-3"
            >
              <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span>تقييمات ومراجعات الورش ({reviews.length}) · متوسط {ratingAvg.toFixed(1)} / 5</span>
              </h2>
            </div>

            {hasAuthSession && !isOwnerPreview && (
              <form
                onSubmit={handleSubmitReview}
                style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                className={`p-4 ${themeSpec.cardRadiusClass} border space-y-2.5`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">أضف تقييم ورشتك لهذا المورد:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <button key={st} type="button" onClick={() => setRevRating(st)} className="p-1 cursor-pointer">
                        <Star className={`w-4 h-4 ${st <= revRating ? 'fill-amber-400 text-amber-500' : 'text-stone-400'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={2}
                  required
                  value={revComment}
                  onChange={(e) => setRevComment(e.target.value)}
                  placeholder="اكتب رأيك في جودة الخامات والأسعار ومواعيد التسليم..."
                  style={{
                    backgroundColor: themeSpec.surfaceBg,
                    borderColor: themeSpec.borderColor,
                    color: themeSpec.inkColor,
                  }}
                  className={`w-full p-2.5 ${themeSpec.inputRadiusClass} border text-xs font-bold outline-none`}
                />
                <button
                  type="submit"
                  disabled={revSubmitting}
                  style={accentBtnStyle}
                  className={`px-4 py-2 ${themeSpec.buttonRadiusClass} text-xs font-black cursor-pointer disabled:opacity-50`}
                >
                  {revSubmitting ? 'جاري النشر...' : 'إرسال التقييم'}
                </button>
              </form>
            )}

            {reviews.length === 0 ? (
              <p style={{ color: themeSpec.mutedColor }} className="text-center py-8 text-xs font-bold">
                لا توجد تقييمات مسجلة لهذا المورد بعد.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                    className={`p-3.5 ${themeSpec.cardRadiusClass} border space-y-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{rev.reviewerBrand || rev.reviewerName}</span>
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        ))}
                      </span>
                    </div>
                    <p style={{ color: themeSpec.mutedColor }} className="text-xs">{rev.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : activeTab === 'price_table' ? (
          <div
            style={surfaceStyle}
            className={`${themeSpec.cardRadiusClass} border overflow-x-auto`}
          >
            <table className="w-full text-right text-xs">
              <thead
                style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                className="border-b"
              >
                <tr>
                  <th className="p-3 font-black">الخامة</th>
                  <th className="p-3 font-black">الوحدة</th>
                  <th className="p-3 font-black">سعر القطاعي</th>
                  <th className="p-3 font-black">سعر الجملة</th>
                  <th className="p-3 font-black">شرائح الكميات</th>
                  <th className="p-3 font-black">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr
                    key={it.id}
                    style={{ borderColor: themeSpec.borderColor }}
                    className="border-t"
                  >
                    <td className="p-3 font-black">{it.name}</td>
                    <td className="p-3">{it.unit}</td>
                    <td
                      style={{ color: themeSpec.priceColor }}
                      className="p-3 font-mono tabular-nums font-bold"
                    >
                      {it.retailPrice.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                    </td>
                    <td
                      style={{ color: themeSpec.accentText }}
                      className="p-3 font-mono tabular-nums font-black"
                    >
                      {it.wholesalePrice > 0
                        ? `${it.wholesalePrice.toLocaleString('ar-EG')} ${activeSupplier.currencySymbol} (≥${it.minWholesaleQty})`
                        : '—'}
                    </td>
                    <td
                      style={{ color: themeSpec.mutedColor }}
                      className="p-3 font-mono tabular-nums text-[11px]"
                    >
                      {it.tierPricing && it.tierPricing.length > 0
                        ? it.tierPricing.map((t) => `≥${t.minQty}: ${t.unitPrice}`).join(' · ')
                        : '—'}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => addToCart(it, 1)}
                        style={accentBtnStyle}
                        className={`px-3 py-1 ${themeSpec.buttonRadiusClass} text-[11px] font-black cursor-pointer`}
                      >
                        + للسلة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            style={surfaceStyle}
            className={`${themeSpec.cardRadiusClass} border p-10 text-center space-y-2`}
          >
            <Boxes className="w-8 h-8 mx-auto opacity-60" style={{ color: themeSpec.accentText }} />
            <p className="text-sm font-black">لا توجد خامات مضافة في الكتالوج العام بعد</p>
            <p style={{ color: themeSpec.mutedColor }} className="text-xs">
              بمجرد إضافة أصنافك في كتالوج الخامات ستظهر هنا تلقائياً بنفس تصميم سمة {themeSpec.nameAr}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Supplier Discovery Spotlights */}
            {catalogFilter === 'all' && !searchQuery.trim() && (specialOfferItems.length > 0 || bestSellerItems.length > 0) && (
              <div className="space-y-3">
                {specialOfferItems.length > 0 && (
                  <section style={surfaceStyle} className={`${themeSpec.cardRadiusClass} border p-3.5 space-y-2.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-500" />
                        <span>العروض الخاصة والتخفيضات</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setCatalogFilter('offers')}
                        style={{ color: themeSpec.accentText }}
                        className="text-[11px] font-black hover:underline cursor-pointer"
                      >
                        عرض الكل ←
                      </button>
                    </div>
                    <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                      {specialOfferItems.slice(0, 8).map((it) => {
                        const meta = getSupplierItemOfferMeta(it);
                        return (
                          <button
                            key={`sup-offer-${it.id}`}
                            type="button"
                            onClick={() => setSelectedItem(it)}
                            style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                            className="w-36 sm:w-44 shrink-0 rounded-xl border overflow-hidden text-right cursor-pointer flex flex-col"
                          >
                            <div className="relative h-24 w-full overflow-hidden">
                              {meta.badgeText && (
                                <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black">
                                  {meta.badgeText}
                                </span>
                              )}
                              <img src={it.images?.[0] || '/alshams_falcon_emblem.png'} alt={it.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-2 space-y-0.5">
                              <p className="text-[11px] font-black truncate">{it.name}</p>
                              <div className="flex items-baseline gap-1 font-mono text-xs">
                                <span className="font-black" style={{ color: themeSpec.priceColor }}>
                                  {meta.finalRetail.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                                </span>
                                {meta.hasDiscount && (
                                  <span className="text-[10px] line-through opacity-65">
                                    {meta.originalRetail.toLocaleString('ar-EG')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {bestSellerItems.length > 0 && (
                  <section style={surfaceStyle} className={`${themeSpec.cardRadiusClass} border p-3.5 space-y-2.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                        <span>الأكثر طلباً من الورش</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setCatalogFilter('bestsellers')}
                        style={{ color: themeSpec.accentText }}
                        className="text-[11px] font-black hover:underline cursor-pointer"
                      >
                        عرض الكل ←
                      </button>
                    </div>
                    <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                      {bestSellerItems.slice(0, 8).map((it) => {
                        const meta = getSupplierItemOfferMeta(it);
                        return (
                          <button
                            key={`sup-best-${it.id}`}
                            type="button"
                            onClick={() => setSelectedItem(it)}
                            style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                            className="w-36 sm:w-44 shrink-0 rounded-xl border overflow-hidden text-right cursor-pointer flex flex-col"
                          >
                            <div className="relative h-24 w-full overflow-hidden">
                              <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black">
                                ⭐ الأكثر طلباً
                              </span>
                              <img src={it.images?.[0] || '/alshams_falcon_emblem.png'} alt={it.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-2 space-y-0.5">
                              <p className="text-[11px] font-black truncate">{it.name}</p>
                              <div className="flex items-baseline gap-1 font-mono text-xs">
                                <span className="font-black" style={{ color: themeSpec.priceColor }}>
                                  {meta.finalRetail.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                                </span>
                                {meta.hasDiscount && (
                                  <span className="text-[10px] line-through opacity-65">
                                    {meta.originalRetail.toLocaleString('ar-EG')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

          <div
            className={`grid gap-4 ${
              themeSpec.cardLayout === 'horizontal_split'
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {filteredItems.map((it, idx) => {
              const isBentoHero = themeSpec.cardLayout === 'bento_featured' && idx === 0;
              const isHorizontal = themeSpec.cardLayout === 'horizontal_split' || isBentoHero;
              const isArch = themeSpec.cardLayout === 'arch_dome';
              const isPolaroid = themeSpec.cardLayout === 'polaroid_pop';
              const offerMeta = getSupplierItemOfferMeta(it);

              return (
                <article
                  key={it.id}
                  style={surfaceStyle}
                  className={`${themeSpec.cardRadiusClass} ${themeSpec.cardShadowClass} ${
                    isPolaroid ? 'border-2 p-2.5' : 'border'
                  } ${isBentoHero ? 'sm:col-span-2' : ''} overflow-hidden flex ${
                    isHorizontal ? 'flex-row items-stretch' : 'flex-col justify-between'
                  } transition-all duration-200 hover:-translate-y-0.5`}
                >
                  <div
                    onClick={() => setSelectedItem(it)}
                    className={`cursor-pointer ${
                      isHorizontal ? 'w-32 sm:w-44 shrink-0' : 'w-full'
                    }`}
                  >
                    <div
                      style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                      className={`relative w-full ${
                        isHorizontal ? 'h-full min-h-[140px]' : themeSpec.imageFrameClass
                      } overflow-hidden ${
                        isArch
                          ? 'rounded-t-[999px] rounded-b-xl mx-auto mt-2 w-[calc(100%-16px)] border'
                          : isPolaroid
                          ? 'rounded-xl border-2'
                          : isHorizontal
                          ? 'border-l'
                          : 'border-b'
                      }`}
                    >
                      {offerMeta.badgeText && (
                        <span
                          style={{ backgroundColor: themeSpec.badgeBg, color: themeSpec.badgeInk }}
                          className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-black shadow-xs"
                        >
                          {offerMeta.badgeText}
                        </span>
                      )}
                      {offerMeta.isBestSeller && (
                        <span className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-amber-400/95 text-slate-950 text-[9px] font-black shadow-xs flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-slate-950" />
                          الأكثر طلباً
                        </span>
                      )}
                      {it.videoUrl && (
                        <div className="absolute bottom-2 right-2 z-10">
                          <ProductVideoThumbnail
                            videoUrl={it.videoUrl}
                            fallbackImage={it.images?.[0]}
                            title={it.name}
                            compact
                          />
                        </div>
                      )}
                      <img
                        src={it.images?.[0] || '/alshams_falcon_emblem.png'}
                        alt={it.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className={`flex-1 flex flex-col justify-between min-w-0 ${isArch ? 'text-center' : ''}`}>
                    <div onClick={() => setSelectedItem(it)} className="p-4 space-y-2 cursor-pointer">
                      <h3 className={`text-sm ${themeSpec.titleWeightClass}`}>{it.name}</h3>
                      {it.description && (
                        <p style={{ color: themeSpec.mutedColor }} className="text-[11px] line-clamp-2">
                          {it.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-xs pt-1">
                        <div
                          style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                          className={`p-2 ${themeSpec.buttonRadiusClass} border`}
                        >
                          <span style={{ color: themeSpec.mutedColor }} className="block text-[10px] font-sans">
                            القطاعي
                          </span>
                          <div className="flex items-baseline gap-1 flex-wrap">
                            <span style={{ color: themeSpec.priceColor }} className="font-black">
                              {offerMeta.finalRetail.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                            </span>
                            {offerMeta.hasDiscount && (
                              <span style={{ color: themeSpec.mutedColor }} className="text-[10px] line-through opacity-70">
                                {offerMeta.originalRetail.toLocaleString('ar-EG')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            backgroundColor: themeSpec.heroSubtleTint,
                            borderColor: themeSpec.heroBorder,
                          }}
                          className={`p-2 ${themeSpec.buttonRadiusClass} border`}
                        >
                          <span style={{ color: themeSpec.accentText }} className="block text-[10px] font-sans font-bold">
                            جملة (×{it.minWholesaleQty})
                          </span>
                          <span style={{ color: themeSpec.accentText }} className="font-black">
                            {it.wholesalePrice > 0
                              ? `${it.wholesalePrice.toLocaleString('ar-EG')} ${activeSupplier.currencySymbol}`
                              : '—'}
                          </span>
                        </div>
                      </div>
                      {(offerMeta.bogoLabel || offerMeta.couponRequiredCode) && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {offerMeta.bogoLabel && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black">
                              🎁 {offerMeta.bogoLabel}
                            </span>
                          )}
                          {offerMeta.couponRequiredCode && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black font-mono">
                              <Tag className="w-2.5 h-2.5" />
                              بكود: {offerMeta.couponRequiredCode}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => addToCart(it, 1)}
                        style={accentBtnStyle}
                        className={`w-full py-2.5 ${themeSpec.buttonRadiusClass} ${
                          isPolaroid ? 'border-2 border-[#18181B]' : ''
                        } text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 transition`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة للسلة</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          </div>
        )}

        {/* Synced Supplier Story & Showcase Gallery (Max 6) */}
        {(Boolean((memberProfile?.storyText || activeSupplier.storeConfig?.description || '').trim()) ||
          (memberProfile?.showcasePosts && memberProfile.showcasePosts.length > 0)) && (
          <section
            style={surfaceStyle}
            className={`${themeSpec.cardRadiusClass} border p-4 sm:p-5 space-y-4`}
          >
            <div
              style={{ borderColor: themeSpec.borderColor }}
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5"
            >
              <h2 className="text-sm sm:text-base font-black">
                نبذة عن المورد ومعرض التوريدات المميزة
              </h2>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                style={{ color: themeSpec.accentText }}
                className="text-xs font-black hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>عرض الصفحة الشخصية</span>
              </button>
            </div>

            {(memberProfile?.storyText || activeSupplier.storeConfig?.description) && (
              <p style={{ color: themeSpec.mutedColor }} className="text-xs sm:text-sm leading-relaxed">
                {memberProfile?.storyText || activeSupplier.storeConfig?.description}
              </p>
            )}

            {memberProfile?.showcasePosts && memberProfile.showcasePosts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {memberProfile.showcasePosts.slice(0, 6).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                    className={`group text-right ${themeSpec.cardRadiusClass} border overflow-hidden transition cursor-pointer flex flex-col`}
                  >
                    <div className={`${themeSpec.imageFrameClass} w-full overflow-hidden`}>
                      <img
                        src={post.imageUrl}
                        alt={post.caption || 'صورة من معرض المورد'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                    {post.caption && (
                      <p className="p-2.5 text-xs font-bold line-clamp-2">
                        {post.caption}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex justify-end"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCartOpen(false);
          }}
        >
          <div
            style={surfaceStyle}
            className="w-full max-w-md h-full border-r flex flex-col"
          >
            <div
              style={{ borderColor: themeSpec.borderColor }}
              className="p-4 border-b flex items-center justify-between"
            >
              <h2 className="text-sm font-black">سلة المشتريات من {activeSupplier.brandName}</h2>
              <button type="button" onClick={() => setIsCartOpen(false)} className="p-1.5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((line) => {
                const pr = calcPrice(line.item, line.quantity);
                return (
                  <div
                    key={line.item.id}
                    style={{ backgroundColor: themeSpec.softBg }}
                    className={`p-3 ${themeSpec.buttonRadiusClass} space-y-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{line.item.name}</span>
                      <button
                        type="button"
                        onClick={() => setCart((p) => p.filter((c) => c.item.id !== line.item.id))}
                        className="text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span>
                        {pr.unitPrice} × {line.quantity} ({pr.isWholesale ? 'جملة' : 'قطاعي'})
                      </span>
                      <span className="font-black">
                        {pr.lineTotal.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                      </span>
                    </div>
                  </div>
                );
              })}

              {cart.length > 0 && storeCoupons.some((c) => c.active) && (
                <div
                  style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                  className={`p-3 ${themeSpec.buttonRadiusClass} border space-y-2`}
                >
                  <label className="text-[11px] font-black flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                    كود خصم المورد
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="أدخل الكود..."
                      dir="ltr"
                      style={{ backgroundColor: themeSpec.surfaceBg, borderColor: themeSpec.borderColor, color: themeSpec.inkColor }}
                      className={`flex-1 h-9 px-2.5 ${themeSpec.inputRadiusClass} border text-xs font-mono font-bold uppercase`}
                    />
                    <button
                      type="button"
                      onClick={handleApplySupplierCoupon}
                      style={accentBtnStyle}
                      className={`px-3 h-9 ${themeSpec.buttonRadiusClass} text-xs font-black cursor-pointer`}
                    >
                      تطبيق
                    </button>
                  </div>
                  {couponErr && <p className="text-[10px] font-bold text-rose-500">{couponErr}</p>}
                  {appliedCoupon && (
                    <div className="flex items-center justify-between text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      <span>
                        ✓ كود {appliedCoupon.code} ({appliedCoupon.type === 'free_shipping' ? 'شحن مجاني' : `خصم ${cartCouponDiscount.toLocaleString('ar-EG')} ${activeSupplier.currencySymbol}`})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponInput('');
                        }}
                        className="text-rose-500 text-[10px] underline cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              )}

              {cart.length > 0 && (
                <form id="sup-store-checkout" onSubmit={handleCheckout} className="space-y-2 pt-2">
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="الاسم أو اسم الورشة *"
                    style={{
                      backgroundColor: themeSpec.softBg,
                      borderColor: themeSpec.borderColor,
                      color: themeSpec.inkColor,
                    }}
                    className={`w-full h-9 px-3 ${themeSpec.inputRadiusClass} border text-xs font-bold`}
                  />
                  <input
                    type="text"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="رقم الهاتف / واتساب *"
                    style={{
                      backgroundColor: themeSpec.softBg,
                      borderColor: themeSpec.borderColor,
                      color: themeSpec.inkColor,
                    }}
                    className={`w-full h-9 px-3 ${themeSpec.inputRadiusClass} border text-xs font-bold`}
                  />
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات إضافية..."
                    style={{
                      backgroundColor: themeSpec.softBg,
                      borderColor: themeSpec.borderColor,
                      color: themeSpec.inkColor,
                    }}
                    className={`w-full p-2.5 ${themeSpec.inputRadiusClass} border text-xs font-bold`}
                  />
                </form>
              )}
            </div>
            {cart.length > 0 && (
              <div
                style={{ borderColor: themeSpec.borderColor }}
                className="p-4 border-t space-y-2"
              >
                {cartCouponDiscount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>خصم الكود ({appliedCoupon?.code}):</span>
                    <span className="font-mono tabular-nums">
                      -{cartCouponDiscount.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black">
                  <span>الإجمالي:</span>
                  <span style={{ color: themeSpec.priceColor }} className="font-mono tabular-nums">
                    {cartTotal.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                  </span>
                </div>
                <button
                  type="submit"
                  form="sup-store-checkout"
                  disabled={submitting}
                  style={accentBtnStyle}
                  className={`w-full py-3 ${themeSpec.buttonRadiusClass} text-xs font-black cursor-pointer`}
                >
                  {hasAuthSession ? 'إرسال طلب التوريد للورشة' : 'إرسال الطلب عبر الواتساب'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedItem && (
        <div
          className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={surfaceStyle}
            className={`w-full sm:max-w-lg max-h-[92vh] overflow-y-auto ${themeSpec.cardRadiusClass} border shadow-2xl`}
          >
            {/* معرض الصور والفيديو الموحد (الفيديو آخر شريحة بدون تقسيم) */}
            <ProductMediaCarousel
              images={selectedItem.images || []}
              videoUrl={selectedItem.videoUrl}
              title={selectedItem.name}
              topRightOverlay={
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              }
              topLeftOverlay={
                selectedItem.unit ? (
                  <span className="px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold">
                    {selectedItem.unit}
                  </span>
                ) : undefined
              }
            />

            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <h3 className={`text-lg ${themeSpec.titleWeightClass}`}>{selectedItem.name}</h3>
                {selectedItem.unit && (
                  <span style={{ color: themeSpec.mutedColor }} className="text-[11px] font-bold">
                    الوحدة: {selectedItem.unit}
                  </span>
                )}
              </div>

              {selectedItem.description && (
                <p
                  style={{ color: themeSpec.mutedColor }}
                  className="text-xs leading-relaxed whitespace-pre-line"
                >
                  {selectedItem.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 font-mono tabular-nums text-xs">
                <div
                  style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                  className={`p-3 ${themeSpec.buttonRadiusClass} border`}
                >
                  <span style={{ color: themeSpec.mutedColor }} className="block text-[10px] font-sans">
                    سعر القطاعي
                  </span>
                  <span style={{ color: themeSpec.priceColor }} className="text-base font-black">
                    {selectedItem.retailPrice.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: themeSpec.heroSubtleTint,
                    borderColor: themeSpec.heroBorder,
                  }}
                  className={`p-3 ${themeSpec.buttonRadiusClass} border`}
                >
                  <span style={{ color: themeSpec.accentText }} className="block text-[10px] font-sans font-bold">
                    سعر الجملة (×{selectedItem.minWholesaleQty})
                  </span>
                  <span style={{ color: themeSpec.accentText }} className="text-base font-black">
                    {selectedItem.wholesalePrice > 0
                      ? `${selectedItem.wholesalePrice.toLocaleString('ar-EG')} ${activeSupplier.currencySymbol}`
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedItem, 1);
                    setSelectedItem(null);
                  }}
                  style={accentBtnStyle}
                  className={`flex-1 py-3 ${themeSpec.buttonRadiusClass} text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 transition`}
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة للسلة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  style={{
                    backgroundColor: themeSpec.softBg,
                    borderColor: themeSpec.borderColor,
                    color: themeSpec.inkColor,
                  }}
                  className={`px-4 py-3 ${themeSpec.buttonRadiusClass} border text-xs font-bold cursor-pointer`}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isProfileModalOpen && activeSupplier?.id && (
        <MemberPersonalProfileView
          mode="modal"
          targetMemberId={activeSupplier.id}
          currentUserProfile={profile || null}
          onClose={() => setIsProfileModalOpen(false)}
          onOpenStore={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
};
