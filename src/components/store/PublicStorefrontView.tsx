import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Phone,
  Search,
  Star,
  CheckCircle2,
  ShieldCheck,
  Truck,
  ArrowRight,
  ExternalLink,
  Share2,
  Layers,
  Tag,
  X,
  Plus,
  Minus,
  MessageCircle,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  fetchPublicStorefrontBySlug,
  CloudMarketplaceProduct,
  PublicWorkshopStoreData,
} from '../../db/marketplaceCloud';
import {
  addToCart,
  getStoredCart,
  OFFICIAL_SUPPORT_PHONE,
} from '../../services/marketplaceCartService';
import { MarketplaceCartModal } from '../marketplace/MarketplaceCartModal';
import { playSuccessSound, playAddToCartSound, triggerHaptic } from '../../lib/sounds';

interface PublicStorefrontViewProps {
  slug: string;
  onNavigateToApp?: () => void;
}

export const PublicStorefrontView: React.FC<PublicStorefrontViewProps> = ({
  slug,
  onNavigateToApp,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [storeData, setStoreData] = useState<PublicWorkshopStoreData | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cartItemsCount, setCartItemsCount] = useState<number>(0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Selected product modal
  const [selectedProduct, setSelectedProduct] = useState<CloudMarketplaceProduct | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Update cart count from local storage
  const refreshCartCount = () => {
    try {
      const items = getStoredCart();
      const total = items.reduce((sum, item) => sum + item.quantity, 0);
      setCartItemsCount(total);
    } catch {}
  };

  useEffect(() => {
    refreshCartCount();
    const handleCartUpdate = () => refreshCartCount();
    window.addEventListener('alshams_cart_updated', handleCartUpdate);
    return () => window.removeEventListener('alshams_cart_updated', handleCartUpdate);
  }, []);

  // Fetch Store Data
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setErrorNotice(null);
      try {
        const data = await fetchPublicStorefrontBySlug(slug);
        if (isMounted) {
          if (data && data.workshop) {
            setStoreData(data);
          } else {
            // Build safe fallback representation from slug
            const decoded = decodeURIComponent(slug).replace(/-/g, ' ');
            setStoreData({
              workshop: {
                id: slug,
                brandName: decoded || 'ورشة الشمساوية الحرفية',
                artistName: 'فنان الشمساوية',
                phoneNumber: OFFICIAL_SUPPORT_PHONE,
                country: 'مصر',
                currencySymbol: 'ج.م',
                ratingStars: 5,
                medal: 'gold',
                logoUrl: '/alshams_falcon_emblem.png',
              },
              products: [],
            });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorNotice('تعذر جلب معروضات المتجر حالياً، يرجى إعادة المحاولة.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Available categories
  const categories = useMemo(() => {
    if (!storeData?.products || storeData.products.length === 0) {
      return [{ id: 'all', name: 'كافة المعروضات' }];
    }
    const cats = new Set<string>();
    storeData.products.forEach((p) => {
      if (p.craft_name) cats.add(p.craft_name);
      else if (p.category) cats.add(p.category);
    });
    return [
      { id: 'all', name: 'كافة المعروضات' },
      ...Array.from(cats).map((c) => ({ id: c, name: c })),
    ];
  }, [storeData]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!storeData?.products) return [];
    return storeData.products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.product_name || '').toLowerCase().includes(q) ||
        (p.store_description || '').toLowerCase().includes(q) ||
        (p.craft_name || '').toLowerCase().includes(q);

      const matchCat =
        selectedCategory === 'all' ||
        p.craft_name === selectedCategory ||
        p.category === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [storeData, searchQuery, selectedCategory]);

  const workshop = storeData?.workshop;
  const brandName = workshop?.brandName || 'ورشة الشمساوية';
  const artistName = workshop?.artistName || 'فنان الشمساوية';
  const currencySymbol = workshop?.currencySymbol || 'ج.م';
  const phone = workshop?.phoneNumber || OFFICIAL_SUPPORT_PHONE;

  const handleShareStore = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      playSuccessSound();
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleOpenProduct = (p: CloudMarketplaceProduct) => {
    setSelectedProduct(p);
    setSelectedQuantity(1);
    setSelectedColor(p.available_colors?.[0] || '');
    setSelectedSize(p.available_sizes?.[0] || '');
    setCustomNotes('');
  };

  const handleAddToCart = (p: CloudMarketplaceProduct) => {
    playAddToCartSound();
    triggerHaptic();

    addToCart({
      id: 'cart_' + Date.now(),
      productId: p.id,
      productName: p.product_name,
      price: p.store_price || p.retail_price || 0,
      quantity: selectedQuantity,
      imageUrl: p.image_url,
      craftName: p.craft_name,
      workshopId: p.workshop_id || workshop?.id,
      artistName: artistName,
      selectedColor: selectedColor || undefined,
      selectedSize: selectedSize || undefined,
      customNotes: customNotes || undefined,
    });

    setAddedToast(`✓ تم إضافة "${p.product_name}" إلى سلة المشتريات! يمكنك إتمام الطلب وسداد العربون (33%).`);
    setTimeout(() => setAddedToast(null), 3500);
    setSelectedProduct(null);
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans selection:bg-amber-500 selection:text-white" dir="rtl">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-amber-500 text-stone-950 font-black text-sm shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-stone-950" />
          <span>{addedToast}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Logo & Artisan Brand with Link to Central Marketplace */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 flex items-center justify-center overflow-hidden p-1 shadow-inner shrink-0">
              {workshop?.logoUrl ? (
                <img
                  src={workshop.logoUrl}
                  alt={brandName}
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="font-black text-sm text-amber-600 dark:text-amber-400">
                  {brandName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-base sm:text-lg text-stone-900 dark:text-white leading-tight">
                  {brandName}
                </h1>
                {/* Central Marketplace Clickable Badge */}
                <a
                  href="/#/market"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/40 transition cursor-pointer"
                  title="الانتقال إلى سوق الشمساوية المركزي"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                  <span>عائلة الشمساوية 🛍️</span>
                </a>
              </div>
              <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
                بأنامل الفنان: <strong className="text-amber-600 dark:text-amber-400 font-black">{artistName}</strong>
              </p>
            </div>
          </div>

          {/* Right Actions: Central Market Button, Cart & Share */}
          <div className="flex items-center gap-2">
            <a
              href="/#/market"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-500/30 transition cursor-pointer"
            >
              <span>السوق المركزي 🌟</span>
            </a>

            <button
              type="button"
              onClick={handleShareStore}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="مشاركة رابط المتجر"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4 text-amber-600" />}
              <span className="hidden sm:inline">{copiedLink ? 'تم النسخ!' : 'مشاركة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 sm:px-3.5 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              title="سلة المشتريات"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">السلة</span>
              {cartItemsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-stone-950 text-amber-400 text-[11px] font-black flex items-center justify-center">
                  {cartItemsCount}
                </span>
              )}
            </button>

            {onNavigateToApp && (
              <button
                type="button"
                onClick={onNavigateToApp}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 text-amber-300 text-xs font-bold transition cursor-pointer"
              >
                <span>دخول الحرفيين</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner with Workshop Branding */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-right max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>مشغولات يدوية وديكورات أصلية بضمان شركة الشمس كرافت</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-stone-950 dark:text-white leading-tight">
              أهلاً بكم في متجر <span className="text-amber-600 dark:text-amber-400">"{brandName}"</span>
            </h2>

            <p className="text-sm sm:text-base font-medium text-stone-600 dark:text-stone-300 leading-relaxed">
              استكشف تشكيلتنا الحصرية من المشغولات اليدوية والديكورات العصرية المصنوعة بأعلى معايير الحرفة والدقة من خامات طبيعية مصرية منتقاة.
            </p>

            {/* Central Guarantee & Official Support Hotline */}
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <a
                href={`tel:${OFFICIAL_SUPPORT_PHONE}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <Phone className="w-4 h-4 text-stone-950" />
                <span>خدمة عملاء ودعم شركة الشمس كرافت: {OFFICIAL_SUPPORT_PHONE}</span>
              </a>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>سداد الدفعة المقدمة 33% المركزي بضمان شركة الشمس كرافت</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-600 dark:text-stone-400">
                <Truck className="w-4 h-4 text-amber-500" />
                <span>شحن وتوصيل آمن لباب البيت</span>
              </div>
            </div>
          </div>

          {/* Quick Workshop Stats Card */}
          <div className="w-full md:w-auto p-5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-500/30 shadow-xl flex flex-row md:flex-col gap-4 justify-around min-w-[240px]">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <p className="text-xs font-bold text-stone-500 dark:text-stone-400">تقييم الجودة والحرفة</p>
            </div>
            <div className="h-full w-px md:w-full md:h-px bg-stone-200 dark:bg-stone-800" />
            <div className="text-center">
              <p className="text-lg font-black text-stone-900 dark:text-white">
                {storeData?.products?.length || 0}
              </p>
              <p className="text-xs font-bold text-stone-500 dark:text-stone-400">قطعة معروضة للبيع</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Storefront Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في معروضات الورشة..."
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs sm:text-sm font-bold border-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Categories Pill/Tab Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-750'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Artisanal Skeleton Loader */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 space-y-4 animate-pulse shadow-sm"
              >
                <div className="w-full aspect-square rounded-xl bg-stone-200 dark:bg-stone-800" />
                <div className="space-y-2">
                  <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded-md w-3/4" />
                  <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded-md w-1/2" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="h-5 bg-stone-200 dark:bg-stone-800 rounded-md w-1/3" />
                  <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded-xl w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Notice */}
        {errorNotice && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-bold text-center">
            {errorNotice}
          </div>
        )}

        {/* Products Grid */}
        {!loading && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((p) => {
              const displayPrice = p.store_price || p.retail_price || 0;
              const hasColors = p.available_colors && p.available_colors.length > 0;

              return (
                <div
                  key={p.id}
                  className="group rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 transition-all duration-200 shadow-sm hover:shadow-xl flex flex-col justify-between overflow-hidden"
                >
                  {/* Image container */}
                  <div
                    className="relative w-full aspect-square bg-stone-100 dark:bg-stone-800 overflow-hidden cursor-pointer"
                    onClick={() => handleOpenProduct(p)}
                  >
                    <img
                      src={p.image_url || '/alshams_falcon_emblem.png'}
                      alt={p.product_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/alshams_falcon_emblem.png';
                      }}
                    />

                    {/* Craft Badge */}
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-black bg-stone-950/80 text-amber-300 backdrop-blur-xs">
                      {p.craft_name || p.category}
                    </span>

                    {/* Stock Badge */}
                    {p.current_stock > 0 ? (
                      <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/90 text-white backdrop-blur-xs">
                        جاهز للتسليم
                      </span>
                    ) : (
                      <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-600/90 text-white backdrop-blur-xs">
                        تنفيذ بالطلب
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <h3
                        onClick={() => handleOpenProduct(p)}
                        className="font-black text-sm sm:text-base text-stone-900 dark:text-white line-clamp-1 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                        title={p.product_name}
                      >
                        {p.product_name}
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                        {p.store_description || 'مشغولة يدوية فاخرة مصنوعة بدقة وعناية واهتمام بأدق التفاصيل.'}
                      </p>
                    </div>

                    {/* Color indicators if available */}
                    {hasColors && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-bold text-stone-400">الألوان:</span>
                        {p.available_colors!.slice(0, 3).map((col, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price and Cart Buttons */}
                    <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-stone-400 block">السعر</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                            {displayPrice.toLocaleString('ar-EG')}
                          </span>
                          <span className="text-xs font-bold text-stone-500">{currencySymbol}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddToCart(p)}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs transition flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer active:scale-95"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>أضف للسلة (عربون 33%)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-16 px-4 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-2xl">
              🎨
            </div>
            <h3 className="text-lg font-black text-stone-900 dark:text-white">
              لا توجد قطع معروضة مطابقة للبحث
            </h3>
            <p className="text-xs sm:text-sm font-medium text-stone-500 dark:text-stone-400 max-w-md mx-auto">
              جرب تغيير كلمات البحث أو استعراض تصنيف آخر لرؤية إبداعات الورشة.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-black text-xs transition cursor-pointer"
            >
              عرض كافة المعروضات
            </button>
          </div>
        )}
      </main>

      {/* Floating Cart Button for Instant Mobile Checkout */}
      {cartItemsCount > 0 && (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-5 left-5 z-40 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs flex items-center gap-2.5 shadow-2xl shadow-amber-500/40 active:scale-95 transition cursor-pointer border-2 border-stone-950/20"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-stone-950" />
            <span className="absolute -top-2 -right-2 px-1.5 py-0.2 rounded-full bg-stone-950 text-amber-300 font-mono text-[10px] font-black">
              {cartItemsCount}
            </span>
          </div>
          <span>سلة المشتريات (عربون 33%) 🛒</span>
        </button>
      )}

      {/* Product Details & Ordering Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-7 space-y-6 shadow-2xl relative text-right">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-500 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Product Header */}
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <div className="w-full sm:w-48 aspect-square rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shrink-0">
                <img
                  src={selectedProduct.image_url || '/alshams_falcon_emblem.png'}
                  alt={selectedProduct.product_name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-2 flex-1">
                <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  {selectedProduct.craft_name || selectedProduct.category}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white">
                  {selectedProduct.product_name}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-stone-600 dark:text-stone-300 leading-relaxed">
                  {selectedProduct.store_description || 'مشغولة يدوية فاخرة تم تصنيعها بإتقان.'}
                </p>

                {/* Price Display */}
                <div className="pt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {(selectedProduct.store_price || selectedProduct.retail_price || 0).toLocaleString('ar-EG')}
                  </span>
                  <span className="text-xs font-bold text-stone-500">{currencySymbol}</span>
                </div>
              </div>
            </div>

            {/* Customization Options */}
            <div className="space-y-4 pt-3 border-t border-stone-200 dark:border-stone-800">
              {/* Color Selection */}
              {selectedProduct.available_colors && selectedProduct.available_colors.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-stone-700 dark:text-stone-300">
                    اختيار اللون المفضل:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.available_colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          selectedColor === c
                            ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {selectedProduct.available_sizes && selectedProduct.available_sizes.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-stone-700 dark:text-stone-300">
                    اختيار المقاس المفضل:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.available_sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSize(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          selectedSize === s
                            ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black text-stone-700 dark:text-stone-300">
                  الكمية المطلوبة:
                </span>
                <div className="flex items-center gap-3 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-stone-700 flex items-center justify-center font-bold text-stone-700 dark:text-stone-200 cursor-pointer shadow-xs"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black w-6 text-center">{selectedQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedQuantity((q) => q + 1)}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-stone-700 flex items-center justify-center font-bold text-stone-700 dark:text-stone-200 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Custom Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-600 dark:text-stone-400">
                  ملاحظات أو تخصيصات خاصة للفنان (اختياري):
                </label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="مثال: يرجى جعل الحبل أطول 10 سم، أو تفضيل تغليف هدية..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold border-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>

            {/* Deposit Breakdown Callout */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>الدفعة المقدمة عند الطلب (33%):</span>
              </span>
              <span className="font-black font-mono text-sm text-amber-700 dark:text-amber-300">
                {Math.round(((selectedProduct.store_price || selectedProduct.retail_price || 0) * selectedQuantity) * 0.33).toLocaleString('ar-EG')} {currencySymbol}
              </span>
            </div>

            {/* Actions: Single Cart Action with Al-Shams Central Guarantee */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => handleAddToCart(selectedProduct)}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>إضافة إلى سلة المشتريات وتأكيد الطلب بالعربون (33%)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {isCartOpen && (
        <MarketplaceCartModal
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          customerUser={null}
          onOpenCustomerAuth={() => {}}
          onOrderSuccess={() => {
            setIsCartOpen(false);
            setAddedToast('✓ تم تسجيل طلبك بنجاح! سيتواصل معك فريق شركة الشمس كرافت لتأكيد الشحن.');
            setTimeout(() => setAddedToast(null), 5000);
          }}
        />
      )}

      {/* Unified Elegant Footer */}
      <footer className="mt-16 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 py-8 px-4 sm:px-6 text-center space-y-3">
        {/* Line 1: Orange prominent branding */}
        <p className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
          منظومة الشمساوية للفنون والأعمال اليدوية
        </p>

        {/* Line 2: Prominent WhatsApp support button */}
        <div className="flex items-center justify-center pt-1">
          <a
            href="https://wa.me/201000996059"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition cursor-pointer active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>الدعم الفني للمنظومة 🟢</span>
          </a>
        </div>
      </footer>
    </div>
  );
};
