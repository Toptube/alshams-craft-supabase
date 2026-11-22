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

function calcPrice(item: SupplierCatalogItem, qty: number) {
  return resolveSupplierItemPricing(item, qty);
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

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

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

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, line) => sum + calcPrice(line.item, line.quantity).lineTotal, 0);
  }, [cart]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || cart.length === 0) return;

    if (!hasAuthSession) {
      const digits = String(supplier.phone || '').replace(/\D/g, '');
      const waPhone = digits.startsWith('0') ? `2${digits}` : digits;
      const lines = cart
        .map((c) => {
          const pr = calcPrice(c.item, c.quantity);
          return `- ${c.item.name} × ${c.quantity} ${c.item.unit} (${pr.lineTotal} ${supplier.currencySymbol})`;
        })
        .join('\n');
      const msg = `مرحباً "${supplier.brandName}"، أرغب في طلب الخامات التالية:\n${lines}\nالإجمالي: ${cartTotal} ${supplier.currencySymbol}\nالاسم: ${buyerName}\nالهاتف: ${buyerPhone}\n${notes}`;
      if (waPhone) {
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      }
      setToast('تم تجهيز تفاصيل الطلب عبر الواتساب!');
      setCart([]);
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
        notes: notes.trim(),
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
    themeSpec.heroLayout === 'swiss_minimal';

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
            : themeSpec.heroLayout === 'centered_maison' || themeSpec.heroLayout === 'noir_spotlight'
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
              : themeSpec.heroLayout === 'gallery_magazine'
              ? 'border-r-4 pr-4 sm:pr-6'
              : ''
          }`}
          style={
            themeSpec.heroLayout === 'centered_maison'
              ? { borderColor: themeSpec.heroBorder, backgroundColor: themeSpec.heroSubtleTint }
              : themeSpec.heroLayout === 'gallery_magazine'
              ? { borderColor: themeSpec.accentBg }
              : undefined
          }
        >
          <span
            style={{ color: themeSpec.accentText }}
            className="text-[11px] font-black tracking-wider"
          >
            {themeSpec.englishSignature} · متجر توريد خامات معتمد
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((it) => (
              <article
                key={it.id}
                style={surfaceStyle}
                className={`${themeSpec.cardRadiusClass} ${themeSpec.cardShadowClass} border overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5`}
              >
                <div>
                  <div
                    style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                    className={`relative w-full ${themeSpec.imageFrameClass} overflow-hidden border-b`}
                  >
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
                  <div className="p-4 space-y-2">
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
                        <span style={{ color: themeSpec.priceColor }} className="font-black">
                          {it.retailPrice.toLocaleString('ar-EG')} {activeSupplier.currencySymbol}
                        </span>
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
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => addToCart(it, 1)}
                    style={accentBtnStyle}
                    className={`w-full py-2.5 ${themeSpec.buttonRadiusClass} text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 transition`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة للسلة</span>
                  </button>
                </div>
              </article>
            ))}
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
