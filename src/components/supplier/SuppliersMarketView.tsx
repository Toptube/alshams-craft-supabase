import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Layers,
  Megaphone,
  MessageSquare,
  Plus,
  Minus,
  RefreshCw,
  Scale,
  Search,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Table2,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  MarketEntryMapped,
  fetchSuppliersMarket,
  fetchSupplierOfferAlerts,
  fetchSupplierReviews,
  submitSupplierReview,
  placeB2BSupplyOrder,
} from '../../db/supplierService';
import {
  SUPPLIER_SUPPLY_SECTIONS,
  SupplierCatalogItem,
  SupplierOfferAlert,
  SupplierProfile,
  SupplierReview,
  resolveSupplierItemPricing,
} from '../../types/supplier';
import {
  SuppliersMarketBuilderConfig,
  getStoredSuppliersMarketBuilderConfig,
} from '../../types/suppliersMarketBuilder';
import { MARKET_THEME_PRESETS } from '../../types/marketplaceBuilder';
import { playSuccessSound, playButtonClickSound, playErrorSound } from '../../lib/sounds';

interface SuppliersMarketViewProps {
  profile?: UserProfile | null;
  onNavigateBack?: () => void;
  onNavigateToMyOrders?: () => void;
  onOpenSupplierStore?: (slug: string) => void;
  onNavigateToCentralMarket?: () => void;
}

interface B2BCartLine {
  item: SupplierCatalogItem;
  supplier: SupplierProfile;
  quantity: number;
  variantLabel?: string;
}

const BUSINESS_TYPE_AR: Record<string, string> = {
  online: 'متجر أونلاين',
  shop: 'محل تجاري',
  factory: 'مصنع / مستورد',
};

function computeEffectiveLinePrice(item: SupplierCatalogItem, qty: number) {
  return resolveSupplierItemPricing(item, qty);
}

export const SuppliersMarketView: React.FC<SuppliersMarketViewProps> = ({
  profile,
  onNavigateBack,
  onNavigateToMyOrders,
  onOpenSupplierStore,
  onNavigateToCentralMarket,
}) => {
  const [marketCfg, setMarketCfg] = useState<SuppliersMarketBuilderConfig>(() =>
    getStoredSuppliersMarketBuilderConfig()
  );
  const [entries, setEntries] = useState<MarketEntryMapped[]>([]);
  const [offerAlerts, setOfferAlerts] = useState<SupplierOfferAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'suppliers' | 'materials' | 'compare'>(
    () => getStoredSuppliersMarketBuilderConfig().defaultViewMode || 'suppliers'
  );
  const [compareSortBy, setCompareSortBy] = useState<'retail_asc' | 'wholesale_asc' | 'rating_desc'>('wholesale_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [governorateFilter, setGovernorateFilter] = useState<string>('all');
  const [wholesaleOnly, setWholesaleOnly] = useState<boolean>(false);

  // Price Sheet & Reviews Modal
  const [priceSheetEntry, setPriceSheetEntry] = useState<MarketEntryMapped | null>(null);
  const [modalTab, setModalTab] = useState<'prices' | 'reviews'>('prices');
  const [modalReviews, setModalReviews] = useState<SupplierReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // B2B Cart State
  const [cart, setCart] = useState<B2BCartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [buyerName, setBuyerName] = useState(profile?.artistName || '');
  const [buyerWorkshopBrand, setBuyerWorkshopBrand] = useState(profile?.brandName || '');
  const [buyerPhone, setBuyerPhone] = useState(profile?.phoneNumber || '');
  const [buyerGovernorate, setBuyerGovernorate] = useState(profile?.governorate || '');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  const hasAuthSession = Boolean(profile && profile.id);

  useEffect(() => {
    const syncHandler = (e: any) => {
      const next = e?.detail || getStoredSuppliersMarketBuilderConfig();
      setMarketCfg(next);
    };
    window.addEventListener('alshams_suppliers_market_builder_updated', syncHandler);
    return () => window.removeEventListener('alshams_suppliers_market_builder_updated', syncHandler);
  }, []);

  const activeThemeMeta =
    MARKET_THEME_PRESETS[marketCfg.themePreset || 'shams_sand'] || MARKET_THEME_PRESETS.shams_sand;

  const activeSections = useMemo(() => {
    return (marketCfg.sectionsOrder || []).filter((s) => s.enabled !== false);
  }, [marketCfg.sectionsOrder]);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4500);
  };

  const loadMarket = async () => {
    setLoading(true);
    try {
      const [list, alerts] = await Promise.all([fetchSuppliersMarket(), fetchSupplierOfferAlerts()]);
      setEntries(list);
      setOfferAlerts(alerts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarket();
  }, []);

  const openSupplierModal = async (entry: MarketEntryMapped, initialTab: 'prices' | 'reviews' = 'prices') => {
    setPriceSheetEntry(entry);
    setModalTab(initialTab);
    setReviewsLoading(true);
    const revRes = await fetchSupplierReviews(entry.supplier.id);
    setModalReviews(revRes.reviews);
    setReviewsLoading(false);
  };

  const handleSubmitSupplierReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceSheetEntry || !hasAuthSession || !reviewComment.trim()) return;
    setReviewSubmitting(true);
    const res = await submitSupplierReview(priceSheetEntry.supplier.id, {
      rating: reviewRating,
      comment: reviewComment.trim(),
      workshopId: profile?.workshopId || profile?.tenantId || profile?.id || '',
      reviewerName: profile?.artistName || 'فنان بالشمساوية',
      reviewerBrand: profile?.brandName || 'ورشة بالشمساوية',
      reviewerRole: (profile as any)?.accountRole || 'artisan',
    });
    setReviewSubmitting(false);
    if (res.success && res.review) {
      playSuccessSound();
      setModalReviews((prev) => [res.review!, ...prev]);
      setReviewComment('');
      setReviewRating(5);
      setEntries((prev) =>
        prev.map((ent) =>
          ent.supplier.id === priceSheetEntry.supplier.id
            ? { ...ent, ratingAvg: res.ratingAvg ?? ent.ratingAvg, reviewsCount: res.reviewsCount ?? ent.reviewsCount }
            : ent
        )
      );
      showToast('شكراً لك! تم نشر تقييم الورشة بنجاح.');
    } else {
      playErrorSound();
      showToast(res.error || 'تعذر نشر التقييم', true);
    }
  };

  const governorates = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => {
      if (e.supplier.governorate) s.add(e.supplier.governorate);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const featuredSet = new Set(marketCfg.featuredSupplierIds || []);
    const list = entries.filter((entry) => {
      if (sectionFilter !== 'all') {
        const hasSection =
          entry.supplier.supplySections.includes(sectionFilter as any) ||
          entry.items.some((i) => i.sectionId === sectionFilter);
        if (!hasSection) return false;
      }
      if (governorateFilter !== 'all' && (entry.supplier.governorate || '') !== governorateFilter) {
        return false;
      }
      if (wholesaleOnly && !entry.hasWholesale) return false;
      if (!q) return true;
      return (
        entry.supplier.brandName.toLowerCase().includes(q) ||
        entry.supplier.ownerName.toLowerCase().includes(q) ||
        (entry.supplier.governorate || '').toLowerCase().includes(q) ||
        entry.supplier.suppliedMaterials.some((m) => m.toLowerCase().includes(q)) ||
        entry.items.some((i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
      );
    });
    return list.sort((a, b) => {
      const aPin = featuredSet.has(a.supplier.id) ? 1 : 0;
      const bPin = featuredSet.has(b.supplier.id) ? 1 : 0;
      return bPin - aPin;
    });
  }, [entries, searchQuery, sectionFilter, governorateFilter, wholesaleOnly, marketCfg.featuredSupplierIds]);

  const flatMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows: { item: SupplierCatalogItem; supplier: SupplierProfile; ratingAvg: number; reviewsCount: number }[] = [];
    filteredEntries.forEach((entry) => {
      entry.items.forEach((item) => {
        if (sectionFilter !== 'all' && item.sectionId !== sectionFilter) return;
        if (wholesaleOnly && !(item.wholesalePrice > 0)) return;
        if (
          q &&
          !item.name.toLowerCase().includes(q) &&
          !(item.description || '').toLowerCase().includes(q) &&
          !entry.supplier.brandName.toLowerCase().includes(q)
        ) {
          return;
        }
        rows.push({
          item,
          supplier: entry.supplier,
          ratingAvg: entry.ratingAvg ?? entry.supplier.ratingStars ?? 5,
          reviewsCount: entry.reviewsCount ?? entry.supplier.reviewsCount ?? 0,
        });
      });
    });
    return rows;
  }, [filteredEntries, sectionFilter, wholesaleOnly, searchQuery]);

  const comparedMaterials = useMemo(() => {
    return [...flatMaterials].sort((a, b) => {
      if (compareSortBy === 'rating_desc') {
        return b.ratingAvg - a.ratingAvg;
      }
      if (compareSortBy === 'retail_asc') {
        return Number(a.item.retailPrice || 999999) - Number(b.item.retailPrice || 999999);
      }
      const bestA =
        a.item.tierPricing && a.item.tierPricing.length > 0
          ? Math.min(...a.item.tierPricing.map((t) => t.unitPrice))
          : a.item.wholesalePrice > 0
          ? a.item.wholesalePrice
          : a.item.retailPrice;
      const bestB =
        b.item.tierPricing && b.item.tierPricing.length > 0
          ? Math.min(...b.item.tierPricing.map((t) => t.unitPrice))
          : b.item.wholesalePrice > 0
          ? b.item.wholesalePrice
          : b.item.retailPrice;
      return bestA - bestB;
    });
  }, [flatMaterials, compareSortBy]);

  const addToB2BCart = (item: SupplierCatalogItem, supplier: SupplierProfile, initialQty = 1) => {
    playButtonClickSound();
    // Enforce single-supplier cart clarity or alert user if switching
    if (cart.length > 0 && cart[0].supplier.id !== supplier.id) {
      setCart([{ item, supplier, quantity: initialQty }]);
      showToast(`تم بدء طلب توريد جديد لدى "${supplier.brandName}"`);
      setIsCartOpen(true);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + initialQty };
        return next;
      }
      return [...prev, { item, supplier, quantity: initialQty }];
    });
    showToast(`تم إضافة "${item.name}" إلى سلة التوريد`);
  };

  const updateCartQty = (itemId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((c) => c.item.id !== itemId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, quantity: Number(nextQty) } : c))
    );
  };

  const cartSummary = useMemo(() => {
    let subtotal = 0;
    let totalSavings = 0;
    let wholesaleLines = 0;
    cart.forEach((line) => {
      const pricing = computeEffectiveLinePrice(line.item, line.quantity);
      subtotal += pricing.lineTotal;
      totalSavings += pricing.savingsPerUnit * line.quantity;
      if (pricing.isWholesale) wholesaleLines += 1;
    });
    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalSavings: Number(totalSavings.toFixed(2)),
      wholesaleLines,
      supplier: cart[0]?.supplier || null,
    };
  }, [cart]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartSummary.supplier || cart.length === 0) return;

    if (!hasAuthSession) {
      playErrorSound();
      showToast('يرجى تسجيل الدخول بحساب ورشتك لإرسال طلب توريد B2B، أو التواصل مع المورد مباشرة عبر الواتساب.', true);
      return;
    }

    setSubmitting(true);
    try {
      const wid = profile?.workshopId || profile?.tenantId || profile?.id || '';
      const res = await placeB2BSupplyOrder({
        supplierId: cartSummary.supplier.id,
        workshopId: wid,
        orderSource: 'suppliers_market',
        items: cart.map((c) => ({
          catalogItemId: c.item.id,
          name: c.item.name,
          unit: c.item.unit,
          variantLabel: c.variantLabel,
          quantity: c.quantity,
          retailPrice: c.item.retailPrice,
          wholesalePrice: c.item.wholesalePrice,
          minWholesaleQty: c.item.minWholesaleQty,
          tierPricing: c.item.tierPricing,
          discountType: c.item.discountType,
          discountValue: c.item.discountValue,
        })),
        notes: orderNotes.trim(),
        buyerInfo: {
          workshopBrand: buyerWorkshopBrand.trim() || profile?.brandName || 'ورشة بالشمساوية',
          name: buyerName.trim() || profile?.artistName || 'فنان',
          phone: buyerPhone.trim() || profile?.phoneNumber || '',
          country: profile?.country || 'مصر',
          governorate: buyerGovernorate.trim(),
        },
      });

      if (res.success && res.order) {
        playSuccessSound();
        setCart([]);
        setOrderNotes('');
        setIsCartOpen(false);
        showToast(`تم إرسال طلب التوريد رقم ${res.order.orderNumber} إلى "${cartSummary.supplier.brandName}" بنجاح! يمكنك اعتماده وترحيله للمخزن من شاشة مورديني.`);
      } else {
        playErrorSound();
        showToast(res.error || 'تعذر إرسال طلب التوريد', true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSectionFilter('all');
    setGovernorateFilter('all');
    setWholesaleOnly(false);
  };

  const handleBackAction = () => {
    if (hasAuthSession && onNavigateBack) {
      onNavigateBack();
    } else if (onNavigateToCentralMarket) {
      onNavigateToCentralMarket();
    } else {
      resetFilters();
    }
  };

  return (
    <div className="min-h-screen bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] pb-20" dir="rtl">
      {toast && (
        <div
          className={`fixed bottom-5 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50 px-4 py-3 rounded-2xl text-xs font-black shadow-2xl flex items-center justify-between gap-2 border ${
            toast.isError
              ? 'bg-rose-700 text-white border-rose-400/50'
              : 'bg-emerald-700 text-white border-emerald-400/50'
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="p-0.5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Configurable Ticker Banner */}
      {marketCfg.tickerBanner?.enabled && marketCfg.tickerBanner?.text && (
        <div
          className="px-4 py-2 text-center text-[11px] sm:text-xs font-black"
          style={{
            backgroundColor: marketCfg.tickerBanner.bgColor || '#0C1427',
            color: marketCfg.tickerBanner.bgColor === '#E9E2D4' ? '#0C1427' : '#FBBF24',
          }}
        >
          {marketCfg.tickerBanner.text}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] px-3 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleBackAction}
              className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>{hasAuthSession ? 'رجوع' : 'سوق الشمساوية'}</span>
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-black flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>{marketCfg.heroTitle || 'سوق موردين الشمساوية للخامات (B2B)'}</span>
              </h1>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] font-medium hidden sm:block">
                {marketCfg.heroSubtitle || 'مصانع وتجار خامات الهاند ميد المعتمدون — تسعير قطاعي وجملة تلقائي ومباشر لورشتك'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {marketCfg.b2bPolicy?.whatsappSupportEnabled && marketCfg.b2bPolicy?.whatsappSupportPhone && (
              <a
                href={`https://wa.me/${marketCfg.b2bPolicy.whatsappSupportPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black hidden sm:flex items-center gap-1.5"
              >
                <span>{marketCfg.b2bPolicy.whatsappSupportLabel || 'دعم التوريد'}</span>
              </a>
            )}
            {hasAuthSession && onNavigateToMyOrders && (
              <button
                type="button"
                onClick={onNavigateToMyOrders}
                className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Truck className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <span className="hidden sm:inline">مورديني وطلبات التوريد</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadMarket}
              className="p-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
              title="تحديث الأسعار"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-3.5 py-2 rounded-xl text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              style={{ backgroundColor: activeThemeMeta.accentBg || '#EA580C' }}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>سلة التوريد</span>
              {cart.length > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-[#0C1427] text-[#FBBF24] font-mono tabular-nums text-[11px] flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 space-y-5">
        {marketCfg.marketStatus === 'maintenance' && (
          <section className="rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4 text-center space-y-1">
            <p className="text-sm font-black text-amber-900 dark:text-amber-200">
              تنبيه إدارة سوق موردين الشمساوية
            </p>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {marketCfg.maintenanceMessage}
            </p>
          </section>
        )}

        {marketCfg.heroEnabled && (
          <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p
                className="text-[11px] font-black"
                style={{ color: activeThemeMeta.accentTextLight }}
              >
                {marketCfg.heroEyebrow}
              </p>
              <h2 className="text-base sm:text-lg font-black">{marketCfg.heroTitle}</h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] max-w-2xl">
                {marketCfg.heroSubtitle}
              </p>
            </div>
          </section>
        )}

        {/* Filter & Search Bar */}
        <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-[#475569] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المورد، نوع الخيط/الخرز/الريزن، أو المحافظة..."
                className="w-full h-10 pr-10 pl-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="md:col-span-3">
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كافة أقسام الخامات</option>
                {activeSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.titleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                value={governorateFilter}
                onChange={(e) => setGovernorateFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كل المحافظات</option>
                {governorates.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWholesaleOnly((v) => !v)}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-black cursor-pointer transition ${
                  wholesaleOnly
                    ? 'bg-[#EA580C] text-white border-[#EA580C]'
                    : 'bg-[#EFE9DC] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                {wholesaleOnly ? 'جملة فقط ✓' : 'أسعار الجملة'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode('suppliers')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'suppliers'
                    ? 'bg-[#0C1427] text-[#F7F3EA] dark:bg-[#F7F3EA] dark:text-[#0C1427]'
                    : 'bg-[#EFE9DC] dark:bg-[#132040]'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>دليل الموردين ({filteredEntries.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('materials')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'materials'
                    ? 'bg-[#0C1427] text-[#F7F3EA] dark:bg-[#F7F3EA] dark:text-[#0C1427]'
                    : 'bg-[#EFE9DC] dark:bg-[#132040]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>كافة الخامات المعروضة ({flatMaterials.length})</span>
              </button>
              {marketCfg.featureToggles?.showComparisonTab !== false && (
                <button
                  type="button"
                  onClick={() => setViewMode('compare')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'compare'
                      ? 'bg-[#EA580C] text-white'
                      : 'bg-amber-500/15 text-[#9A3412] dark:text-amber-200 border border-amber-500/30'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>مقارنة أسعار الموردين</span>
                </button>
              )}
            </div>

            {(searchQuery || sectionFilter !== 'all' || governorateFilter !== 'all' || wholesaleOnly) && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24] hover:underline cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            )}
          </div>
        </section>

        {/* Supplier Offer & New Stock Alerts Strip */}
        {marketCfg.featureToggles?.showOfferAlertsStrip !== false && offerAlerts.length > 0 && (
          <section className="rounded-2xl bg-[#0C1427] dark:bg-[#132040] text-[#F7F3EA] border border-[#22355E] p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-black text-[#FBBF24]">
              <span className="flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 shrink-0" />
                <span>تنبيهات العروض والوصول الجديد للخامات ({offerAlerts.length})</span>
              </span>
              <span className="text-[10px] font-bold text-[#CBD5E1]">اضغط على العرض لزيارة متجر المورد</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {offerAlerts.slice(0, 6).map((al) => (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => {
                    const slug = al.supplierSlug || al.supplierId;
                    if (onOpenSupplierStore) onOpenSupplierStore(slug);
                    else window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
                  }}
                  className="min-w-[240px] max-w-[300px] shrink-0 text-right p-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-[#FBBF24] truncate">{al.supplierBrand}</span>
                    {al.discountBadge && (
                      <span className="text-[10px] font-black text-emerald-300 shrink-0">{al.discountBadge}</span>
                    )}
                  </div>
                  <p className="text-xs font-black text-white truncate">{al.title}</p>
                  <p className="text-[10px] text-[#CBD5E1] line-clamp-1">{al.message}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
              جاري تحميل دليل الموردين وجداول الأسعار...
            </p>
          </div>
        ) : viewMode === 'suppliers' ? (
          filteredEntries.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-12 text-center space-y-2">
              <Store className="w-10 h-10 mx-auto text-[#EA580C]/60" />
              <h3 className="text-sm font-black">لا يوجد موردون مطابقون للبحث حالياً</h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                جرّب تغيير القسم أو المحافظة، أو تصفح كل الأقسام.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntries.map((entry) => {
                const { supplier, items } = entry;
                const slug = supplier.storeSlug || supplier.id;
                const secNames = supplier.supplySections
                  .map((id) => SUPPLIER_SUPPLY_SECTIONS.find((s) => s.id === id)?.titleAr)
                  .filter(Boolean);
                const bizLabels = supplier.businessTypes.map((b) => BUSINESS_TYPE_AR[b] || b).join(' · ');

                return (
                  <article
                    key={supplier.id}
                    className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col justify-between gap-4 hover:border-[#EA580C] transition"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={supplier.logoUrl || '/alshams_falcon_emblem.png'}
                            alt={supplier.brandName}
                            className="w-12 h-12 rounded-xl object-contain bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-1 shrink-0"
                          />
                          <div className="min-w-0">
                            <h2 className="text-sm font-black truncate flex items-center gap-1.5">
                              <span>{supplier.brandName}</span>
                              {marketCfg.featuredSupplierIds?.includes(supplier.id) && (
                                <span className="text-[10px] font-black text-[#EA580C] dark:text-[#FBBF24] shrink-0">
                                  ★ مميز
                                </span>
                              )}
                            </h2>
                            <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] truncate">
                              {bizLabels} · {supplier.governorate || supplier.country}
                            </p>
                            {marketCfg.featureToggles?.showWorkshopReviews !== false && (
                              <button
                                type="button"
                                onClick={() => openSupplierModal(entry, 'reviews')}
                                className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-300 mt-0.5 hover:underline cursor-pointer"
                              >
                                <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                <span className="font-mono tabular-nums">{(entry.ratingAvg ?? 5).toFixed(1)}</span>
                                <span>· {(entry.reviewsCount ?? 0) > 0 ? `${entry.reviewsCount} تقييم ورشة` : 'قيّم المورد'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24] shrink-0">
                          {items.length} صنف
                        </span>
                      </div>

                      {/* Specialization Summary */}
                      <div className="p-2.5 rounded-xl bg-[#EFE9DC]/75 dark:bg-[#132040]/80 border border-[#D4CCBC]/70 dark:border-[#22355E] space-y-1 text-[11px]">
                        <div className="font-bold text-[#334155] dark:text-[#CBD5E1]">
                          <span className="text-[#475569] dark:text-[#94A3B8]">التخصص: </span>
                          {secNames.length > 0 ? secNames.join('، ') : 'خامات هاند ميد'}
                        </div>
                        {supplier.suppliedMaterials.length > 0 && (
                          <p className="text-[#475569] dark:text-[#94A3B8] line-clamp-2">
                            أبرز الخامات: {supplier.suppliedMaterials.slice(0, 4).join('، ')}
                          </p>
                        )}
                      </div>

                      {/* Transparent Price Range */}
                      <div className="grid grid-cols-2 gap-2 text-center font-mono tabular-nums">
                        <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                          <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">
                            يبدأ القطاعي من
                          </span>
                          <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            {entry.minRetailPrice > 0
                              ? `${entry.minRetailPrice.toLocaleString('ar-EG')} ${supplier.currencySymbol}`
                              : '—'}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                          <span className="block text-[10px] font-sans text-emerald-800 dark:text-emerald-300">
                            سعر الجملة يبدأ من
                          </span>
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                            {entry.minWholesalePrice > 0
                              ? `${entry.minWholesalePrice.toLocaleString('ar-EG')} ${supplier.currencySymbol}`
                              : 'بالطلب'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                      <button
                        type="button"
                        onClick={() => openSupplierModal(entry, 'prices')}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#1A2B54] text-[#F7F3EA] text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Table2 className="w-3.5 h-3.5 text-[#FBBF24]" />
                        <span>الأسعار والتقييمات</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenSupplierStore) onOpenSupplierStore(slug);
                          else window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
                        }}
                        className="py-2 px-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>المتجر</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : viewMode === 'compare' ? (
          <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D4CCBC] dark:border-[#22355E]">
              <div>
                <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#EA580C]" />
                  <span>مقارنة أسعار الخامات بين الموردين ({comparedMaterials.length})</span>
                </h2>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  قارن سعر القطاعي، الجملة، شرائح الكميات، والمحافظة وتقييم الورش لاختيار أنسب عرض لورشتك
                </p>
              </div>
              <select
                value={compareSortBy}
                onChange={(e) => setCompareSortBy(e.target.value as any)}
                className="h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
              >
                <option value="wholesale_asc">الأرخص بالجملة / الشرائح أولاً</option>
                <option value="retail_asc">الأرخص بالقطاعي أولاً</option>
                <option value="rating_desc">الأعلى تقييماً من الورش</option>
              </select>
            </div>

            {comparedMaterials.length === 0 ? (
              <p className="py-10 text-center text-xs font-bold text-[#475569]">
                اكتب اسم الخامة في شريط البحث بالأعلى (مثل: مكرمية، ريزن، خرز) لمقارنة عروض الموردين.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D4CCBC] dark:border-[#22355E]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
                    <tr>
                      <th className="p-3 font-black">الخامة والمورد</th>
                      <th className="p-3 font-black">تقييم الورش</th>
                      <th className="p-3 font-black">سعر القطاعي</th>
                      <th className="p-3 font-black">الجملة / الحد الأدنى</th>
                      <th className="p-3 font-black">شرائح الكميات</th>
                      <th className="p-3 font-black">المتوفر</th>
                      <th className="p-3 font-black">طلب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                    {comparedMaterials.map(({ item, supplier, ratingAvg, reviewsCount }, idx) => (
                      <tr key={`${supplier.id}_${item.id}`} className="hover:bg-[#EFE9DC]/40 dark:hover:bg-[#132040]/40">
                        <td className="p-3">
                          <div className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            {idx === 0 && <span className="text-emerald-600 dark:text-emerald-400 ml-1">★ الأفضل سعراً</span>}
                            {item.name}
                          </div>
                          <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                            {supplier.brandName} · {supplier.governorate || supplier.country}
                          </div>
                        </td>
                        <td className="p-3 font-mono tabular-nums">
                          <span className="inline-flex items-center gap-1 font-black text-amber-700 dark:text-amber-300">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            {ratingAvg.toFixed(1)}
                          </span>
                          <span className="block text-[10px] text-[#475569]">({reviewsCount})</span>
                        </td>
                        <td className="p-3 font-mono tabular-nums font-bold">
                          {item.retailPrice.toLocaleString('ar-EG')} {supplier.currencySymbol} / {item.unit}
                        </td>
                        <td className="p-3 font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-400">
                          {item.wholesalePrice > 0
                            ? `${item.wholesalePrice.toLocaleString('ar-EG')} ${supplier.currencySymbol} (≥${item.minWholesaleQty})`
                            : '—'}
                        </td>
                        <td className="p-3 text-[11px] font-mono tabular-nums">
                          {item.tierPricing && item.tierPricing.length > 0
                            ? item.tierPricing.map((t) => `≥${t.minQty}: ${t.unitPrice}`).join(' · ')
                            : '—'}
                        </td>
                        <td className="p-3 font-mono tabular-nums">
                          {item.stockQty} {item.unit}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => addToB2BCart(item, supplier, item.wholesalePrice > 0 ? item.minWholesaleQty : 1)}
                            className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black cursor-pointer whitespace-nowrap"
                          >
                            + للسلة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : flatMaterials.length === 0 ? (
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-12 text-center text-xs font-bold text-[#475569]">
            لا توجد خامات مطابقة لخيارات التصفية الحالية.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flatMaterials.map(({ item, supplier }) => (
              <article
                key={item.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <img
                    src={item.images?.[0] || '/alshams_falcon_emblem.png'}
                    alt={item.name}
                    className="w-full aspect-[4/3] object-cover border-b border-[#D4CCBC] dark:border-[#22355E]"
                  />
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black line-clamp-2">{item.name}</h3>
                      <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] shrink-0">
                        / {item.unit}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24]">
                      المورد: {supplier.brandName} · {supplier.governorate || supplier.country}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono tabular-nums text-xs">
                      <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                        <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">
                          سعر القطاعي
                        </span>
                        <span className="font-black">
                          {item.retailPrice.toLocaleString('ar-EG')} {supplier.currencySymbol}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                        <span className="block text-[10px] font-sans text-emerald-800 dark:text-emerald-300">
                          جملة (من {item.minWholesaleQty} {item.unit})
                        </span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300">
                          {item.wholesalePrice > 0
                            ? `${item.wholesalePrice.toLocaleString('ar-EG')} ${supplier.currencySymbol}`
                            : 'قطاعي فقط'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addToB2BCart(item, supplier, 1)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة لطلب التوريد</span>
                  </button>
                  {item.wholesalePrice > 0 && item.minWholesaleQty > 1 && (
                    <button
                      type="button"
                      onClick={() => addToB2BCart(item, supplier, item.minWholesaleQty)}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer"
                      title={`إضافة كمية الجملة (${item.minWholesaleQty})`}
                    >
                      جملة ×{item.minWholesaleQty}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Supplier Full Price Sheet & Workshop Reviews Modal */}
      {priceSheetEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPriceSheetEntry(null);
          }}
        >
          <div className="w-full max-w-4xl max-h-[88vh] rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black">
                  {priceSheetEntry.supplier.brandName}
                </h2>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                  {priceSheetEntry.supplier.businessTypes.map((b) => BUSINESS_TYPE_AR[b] || b).join(' · ')} ·{' '}
                  {priceSheetEntry.supplier.governorate || priceSheetEntry.supplier.country}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalTab('prices')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                    modalTab === 'prices'
                      ? 'bg-[#0C1427] text-white dark:bg-[#EA580C]'
                      : 'bg-[#EFE9DC] dark:bg-[#132040]'
                  }`}
                >
                  جدول الأسعار ({priceSheetEntry.items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('reviews')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer inline-flex items-center gap-1 ${
                    modalTab === 'reviews'
                      ? 'bg-[#0C1427] text-white dark:bg-[#EA580C]'
                      : 'bg-[#EFE9DC] dark:bg-[#132040]'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span>تقييمات الورش ({modalReviews.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriceSheetEntry(null)}
                  className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {modalTab === 'prices' ? (
                priceSheetEntry.items.length === 0 ? (
                  <p className="text-center py-8 text-xs text-[#475569]">
                    لم يدرج هذا المورد أصنافاً في الكتالوج العام بعد.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[#D4CCBC] dark:border-[#22355E]">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
                        <tr>
                          <th className="p-3 font-black">الخامة</th>
                          <th className="p-3 font-black">الوحدة</th>
                          <th className="p-3 font-black">القطاعي</th>
                          <th className="p-3 font-black">الجملة</th>
                          <th className="p-3 font-black">شرائح الكميات</th>
                          <th className="p-3 font-black">المخزون</th>
                          <th className="p-3 font-black">طلب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                        {priceSheetEntry.items.map((it) => (
                          <tr key={it.id} className="hover:bg-[#EFE9DC]/40 dark:hover:bg-[#132040]/40">
                            <td className="p-3 font-black">{it.name}</td>
                            <td className="p-3">{it.unit}</td>
                            <td className="p-3 font-mono tabular-nums font-bold">
                              {it.retailPrice.toLocaleString('ar-EG')} {priceSheetEntry.supplier.currencySymbol}
                            </td>
                            <td className="p-3 font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-400">
                              {it.wholesalePrice > 0
                                ? `${it.wholesalePrice.toLocaleString('ar-EG')} ${priceSheetEntry.supplier.currencySymbol} (≥${it.minWholesaleQty})`
                                : '—'}
                            </td>
                            <td className="p-3 font-mono tabular-nums text-[11px]">
                              {it.tierPricing && it.tierPricing.length > 0
                                ? it.tierPricing.map((t) => `≥${t.minQty}: ${t.unitPrice}`).join(' · ')
                                : '—'}
                            </td>
                            <td className="p-3 font-mono tabular-nums">{it.stockQty}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => addToB2BCart(it, priceSheetEntry.supplier, 1)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#EA580C] text-white text-[11px] font-black cursor-pointer"
                              >
                                + أضف
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {hasAuthSession && (
                    <form
                      onSubmit={handleSubmitSupplierReview}
                      className="p-4 rounded-2xl bg-[#EFE9DC]/70 dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[#EA580C]" />
                          <span>أضف تقييم ورشتك لهذا المورد</span>
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setReviewRating(st)}
                              className="p-1 cursor-pointer"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  st <= reviewRating
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-stone-400'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        required
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="شارك الورش الأخرى رأيك في جودة الخامات وسرعة الشحن والالتزام..."
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                      <button
                        type="submit"
                        disabled={reviewSubmitting}
                        className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer disabled:opacity-50"
                      >
                        {reviewSubmitting ? 'جاري النشر...' : 'نشر التقييم'}
                      </button>
                    </form>
                  )}

                  {reviewsLoading ? (
                    <p className="text-center py-6 text-xs font-bold text-[#475569]">جاري تحميل تقييمات الورش...</p>
                  ) : modalReviews.length === 0 ? (
                    <p className="text-center py-8 text-xs font-bold text-[#475569]">
                      لا توجد مراجعات مسجلة لهذا المورد بعد. كن أول ورشة تشارك تجربتها!
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {modalReviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-3.5 rounded-2xl bg-[#EFE9DC]/50 dark:bg-[#132040]/50 border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black">
                              {rev.reviewerBrand || rev.reviewerName}
                              {rev.reviewerBrand && rev.reviewerName ? ` · ${rev.reviewerName}` : ''}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-amber-500">
                              {Array.from({ length: rev.rating }).map((_, i) => (
                                <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                              ))}
                            </span>
                          </div>
                          <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{rev.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* B2B Cart & Checkout Drawer */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex justify-end"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCartOpen(false);
          }}
        >
          <div className="w-full max-w-md h-full bg-[#F7F3EA] dark:bg-[#0D162E] border-r border-[#D4CCBC] dark:border-[#22355E] shadow-2xl flex flex-col">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <h2 className="text-sm font-black flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#EA580C]" />
                <span>طلب توريد خامات ({cart.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 space-y-2 text-xs text-[#475569]">
                  <ShoppingBag className="w-10 h-10 mx-auto opacity-40" />
                  <p className="font-bold">سلة التوريد فارغة حالياً.</p>
                </div>
              ) : (
                <>
                  {cartSummary.supplier && (
                    <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-bold">
                      المورد: <span className="font-black">{cartSummary.supplier.brandName}</span>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {cart.map((line) => {
                      const pr = computeEffectiveLinePrice(line.item, line.quantity);
                      const remainingForWholesale =
                        line.item.wholesalePrice > 0 && !pr.isWholesale
                          ? Math.max(0, (line.item.minWholesaleQty || 1) - line.quantity)
                          : 0;
                      return (
                        <div
                          key={line.item.id}
                          className="p-3 rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-black">{line.item.name}</h4>
                              <p className="text-[11px] font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]">
                                {pr.unitPrice.toLocaleString('ar-EG')} {line.supplier.currencySymbol} / {line.item.unit} ·{' '}
                                <strong className={pr.isWholesale ? 'text-emerald-600' : 'text-[#C2410C]'}>
                                  {pr.isWholesale ? 'سعر الجملة ✓' : 'قطاعي'}
                                </strong>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateCartQty(line.item.id, 0)}
                              className="text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {remainingForWholesale > 0 && (
                            <button
                              type="button"
                              onClick={() => updateCartQty(line.item.id, line.item.minWholesaleQty)}
                              className="w-full py-1 px-2 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black cursor-pointer text-right"
                            >
                              زِد {remainingForWholesale} {line.item.unit} لتفعيل سعر الجملة ({line.item.wholesalePrice}{' '}
                              {line.supplier.currencySymbol})
                            </button>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateCartQty(line.item.id, line.quantity - 1)}
                                className="w-7 h-7 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) => updateCartQty(line.item.id, Number(e.target.value) || 1)}
                                className="w-14 h-7 text-center rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black"
                              />
                              <button
                                type="button"
                                onClick={() => updateCartQty(line.item.id, line.quantity + 1)}
                                className="w-7 h-7 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="font-mono tabular-nums text-xs font-black">
                              {pr.lineTotal.toLocaleString('ar-EG')} {line.supplier.currencySymbol}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form id="b2b-checkout-form" onSubmit={handleCheckout} className="space-y-2.5 pt-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
                    <input
                      type="text"
                      value={buyerWorkshopBrand}
                      onChange={(e) => setBuyerWorkshopBrand(e.target.value)}
                      placeholder="اسم الورشة"
                      className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="اسم المسؤول"
                        className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                      <input
                        type="text"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="رقم الهاتف"
                        className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                    </div>
                    <input
                      type="text"
                      value={buyerGovernorate}
                      onChange={(e) => setBuyerGovernorate(e.target.value)}
                      placeholder="المحافظة / عنوان الاستلام"
                      className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    />
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="ملاحظات التجهيز أو الألوان المطلوبة..."
                      className="w-full p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    />
                  </form>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-3 bg-[#EFE9DC]/60 dark:bg-[#132040]/60">
                <div className="space-y-1 text-xs">
                  {cartSummary.totalSavings > 0 && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-black">
                      <span>وفر الجملة المكتسب:</span>
                      <span className="font-mono tabular-nums">
                        {cartSummary.totalSavings.toLocaleString('ar-EG')} {cartSummary.supplier?.currencySymbol}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black">
                    <span>الإجمالي التقديري:</span>
                    <span className="font-mono tabular-nums text-[#C2410C] dark:text-[#FBBF24]">
                      {cartSummary.subtotal.toLocaleString('ar-EG')} {cartSummary.supplier?.currencySymbol}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  form="b2b-checkout-form"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'جاري إرسال طلب التوريد...' : 'تأكيد وإرسال طلب التوريد للمورد'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
