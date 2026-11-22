import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  MessageCircle,
  Share2,
  ShoppingBag,
  Store,
  Sparkles,
  MapPin,
  Package,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { buildProductLandingUrl, buildStoreUrl } from '../../lib/appRoutes';

interface PublicProductData {
  id: string;
  productName: string;
  craftName: string;
  price: number;
  originalPrice?: number;
  currencySymbol: string;
  description: string;
  imageUrl: string;
  galleryUrls: string[];
  availableColors: string[];
  availableSizes: string[];
  sizeVariants: Array<{ label: string; price?: number; originalPrice?: number }>;
  currentStock: number;
  isCustomOrderAvailable: boolean;
  workshopId: string;
  brandName: string;
  artistName: string;
  workshopLogo: string;
  workshopGovernorate: string;
  workshopPhone: string;
  storeSlug: string;
}

interface PublicProductLandingViewProps {
  productId: string;
  onOpenStore?: (slug: string) => void;
  onOpenMarketplace?: () => void;
  onGoHome?: () => void;
}

export const PublicProductLandingView: React.FC<PublicProductLandingViewProps> = ({
  productId,
  onOpenStore,
  onOpenMarketplace,
  onGoHome,
}) => {
  const [product, setProduct] = useState<PublicProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/public/product/${encodeURIComponent(productId)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success || !json?.product) {
          throw new Error(json?.error || 'المنتج غير موجود أو لم يعد متاحاً');
        }
        return json.product as PublicProductData;
      })
      .then((data) => {
        if (!active) return;
        setProduct(data);
        setActiveImage(data.imageUrl || data.galleryUrls?.[0] || '/brand_icon_light.png');
        if (data.availableColors?.length) setSelectedColor(data.availableColors[0]);
        if (data.sizeVariants?.length) setSelectedSize(data.sizeVariants[0].label);
        else if (data.availableSizes?.length) setSelectedSize(data.availableSizes[0]);
        if (typeof document !== 'undefined') {
          document.title = `${data.productName} | ${data.brandName} - منظومة الشمساوية`;
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || 'تعذر تحميل صفحة المنتج');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId]);

  const gallery = useMemo(() => {
    if (!product) return [];
    const list = [product.imageUrl, ...(product.galleryUrls || [])].filter(
      (u): u is string => Boolean(u && typeof u === 'string' && u.trim())
    );
    return Array.from(new Set(list));
  }, [product]);

  const activeVariant = useMemo(() => {
    if (!product?.sizeVariants?.length || !selectedSize) return null;
    return product.sizeVariants.find((v) => v.label === selectedSize) || null;
  }, [product, selectedSize]);

  const displayPrice = Number(activeVariant?.price ?? product?.price ?? 0);
  const displayOriginalPrice = Number(activeVariant?.originalPrice ?? product?.originalPrice ?? 0);
  const hasDiscount = displayOriginalPrice > displayPrice && displayPrice > 0;
  const discountPct = hasDiscount
    ? Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)
    : 0;

  const canonicalUrl = buildProductLandingUrl(productId);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const cleanWhatsappPhone = useMemo(() => {
    const digits = String(product?.workshopPhone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('01') && digits.length === 11) return `2${digits}`;
    if (digits.startsWith('00')) return digits.slice(2);
    return digits;
  }, [product?.workshopPhone]);

  const whatsappOrderHref = useMemo(() => {
    if (!product) return '#';
    const lines = [
      `أهلاً ${product.brandName}، عايز أطلب المنتج ده:`,
      `• المنتج: ${product.productName}`,
      displayPrice > 0 ? `• السعر: ${displayPrice.toLocaleString('ar-EG')} ${product.currencySymbol}` : '',
      selectedColor ? `• اللون: ${selectedColor}` : '',
      selectedSize ? `• المقاس: ${selectedSize}` : '',
      `• الكمية: ${quantity}`,
      `• رابط المنتج: ${canonicalUrl}`,
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join('\n'));
    return cleanWhatsappPhone
      ? `https://wa.me/${cleanWhatsappPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
  }, [product, displayPrice, selectedColor, selectedSize, quantity, canonicalUrl, cleanWhatsappPhone]);

  const facebookShareHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`;
  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(
    `${product?.productName || 'منتج حرفي مميز'}${displayPrice > 0 ? ` — ${displayPrice.toLocaleString('ar-EG')} ${product?.currencySymbol || 'ج.م'}` : ''}\n${canonicalUrl}`
  )}`;

  const storeHref = product?.storeSlug ? buildStoreUrl(product.storeSlug) : '';

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F7F3EA] dark:bg-[#080D1B] flex flex-col items-center justify-center p-6 text-center gap-3"
      >
        <Loader2 className="w-9 h-9 text-[#EA580C] animate-spin" />
        <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
          جاري فتح صفحة المنتج...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F7F3EA] dark:bg-[#080D1B] flex items-center justify-center p-4"
      >
        <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-7 text-center space-y-4 shadow-lg">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
            المنتج غير متاح حالياً
          </h1>
          <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
            {error || 'تأكد من صحة الرابط أو تصفح باقي منتجات سوق الشمساوية.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {onOpenMarketplace && (
              <button
                type="button"
                onClick={onOpenMarketplace}
                className="px-4 py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>تصفح سوق الشمساوية</span>
              </button>
            )}
            {onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="px-4 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-black cursor-pointer"
              >
                الصفحة الرئيسية
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const sizeList =
    product.sizeVariants?.length > 0
      ? product.sizeVariants.map((v) => v.label)
      : product.availableSizes || [];

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F3EA] dark:bg-[#080D1B] text-[#0C1427] dark:text-[#F7F3EA]">
      {/* Top Minimal Brand Bar */}
      <header className="sticky top-0 z-30 bg-[#F7F3EA]/90 dark:bg-[#080D1B]/90 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#1E2E52]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={product.workshopLogo || '/brand_icon_light.png'}
              alt={product.brandName}
              className="w-9 h-9 rounded-xl object-cover border border-[#D4CCBC] dark:border-[#22355E] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black truncate">{product.brandName}</div>
              <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] truncate">
                منظومة الشمساوية للحرف اليدوية
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {product.storeSlug && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenStore) onOpenStore(product.storeSlug);
                  else if (storeHref) window.location.href = storeHref;
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>زيارة المتجر</span>
              </button>
            )}
            {onOpenMarketplace && (
              <button
                type="button"
                onClick={onOpenMarketplace}
                className="px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">سوق الشمساوية</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Product Landing Main */}
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Gallery Column */}
          <div className="lg:col-span-6 space-y-3">
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-sm">
              <img
                src={activeImage || product.imageUrl || '/brand_icon_light.png'}
                alt={product.productName}
                className="w-full h-full object-cover"
              />
              {hasDiscount && (
                <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-black shadow">
                  وفر {discountPct}%
                </div>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {gallery.map((imgUrl, idx) => {
                  const active = (activeImage || product.imageUrl) === imgUrl;
                  return (
                    <button
                      key={`${imgUrl}_${idx}`}
                      type="button"
                      onClick={() => setActiveImage(imgUrl)}
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                        active
                          ? 'border-[#EA580C] ring-2 ring-[#EA580C]/25'
                          : 'border-[#D4CCBC] dark:border-[#22355E] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="lg:col-span-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center flex-wrap gap-2 text-xs font-black">
                <span className="px-2.5 py-1 rounded-lg bg-[#EA580C]/10 text-[#EA580C] dark:text-[#FBBF24]">
                  {product.craftName || 'مشغولات يدوية'}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg ${
                    product.currentStock > 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {product.currentStock > 0 ? 'متوفر للشحن' : 'تنفيذ حسب الطلب'}
                </span>
                {product.isCustomOrderAvailable && (
                  <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>متاح تنفيذ خاص</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black leading-snug text-[#0C1427] dark:text-[#F7F3EA]">
                {product.productName}
              </h1>

              {displayPrice > 0 && (
                <div className="flex items-baseline gap-3 pt-1">
                  <span className="text-2xl sm:text-3xl font-black text-[#EA580C] dark:text-[#FBBF24]">
                    {displayPrice.toLocaleString('ar-EG')} {product.currencySymbol}
                  </span>
                  {hasDiscount && (
                    <span className="text-base font-bold text-[#64748B] line-through">
                      {displayOriginalPrice.toLocaleString('ar-EG')} {product.currencySymbol}
                    </span>
                  )}
                </div>
              )}
            </div>

            {product.description && (
              <div className="rounded-2xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
                <p className="text-sm font-semibold text-[#334155] dark:text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* Colors */}
            {product.availableColors?.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                  اللون المختار: <span className="text-[#0C1427] dark:text-[#F7F3EA]">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.availableColors.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedColor(col)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition-colors ${
                        selectedColor === col
                          ? 'bg-[#EA580C] text-white border-[#EA580C]'
                          : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            {sizeList.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                  المقاس / الحجم: <span className="text-[#0C1427] dark:text-[#F7F3EA]">{selectedSize}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizeList.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition-colors ${
                        selectedSize === sz
                          ? 'bg-[#0C1427] dark:bg-[#F7F3EA] text-white dark:text-[#0C1427] border-[#0C1427]'
                          : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity + Order CTA */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="inline-flex items-center rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3.5 py-2.5 text-sm font-black hover:bg-[#EFE9DC] dark:hover:bg-[#1C2A4A] cursor-pointer"
                >
                  −
                </button>
                <span className="px-4 py-2.5 text-sm font-black min-w-[40px] text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3.5 py-2.5 text-sm font-black hover:bg-[#EFE9DC] dark:hover:bg-[#1C2A4A] cursor-pointer"
                >
                  +
                </button>
              </div>

              <a
                href={whatsappOrderHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px] py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>اطلب المنتج مباشرة على واتساب</span>
              </a>
            </div>

            {/* Share Product Card (Facebook / WhatsApp / Direct Copy) */}
            <div className="rounded-2xl bg-[#EFE9DC]/70 dark:bg-[#101B36] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                <Share2 className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>مشاركة رابط المنتج المباشر (يظهر بصورته وسعره على فيسبوك وواتساب)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'تم نسخ رابط المنتج' : 'نسخ رابط المنتج'}</span>
                </button>
                <a
                  href={facebookShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>مشاركة على فيسبوك</span>
                </a>
                <a
                  href={whatsappShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-800 dark:text-emerald-300 border border-emerald-600/30 text-xs font-black inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>إرسال واتساب</span>
                </a>
              </div>
            </div>

            {/* Artisan / Workshop Card */}
            <div className="rounded-2xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={product.workshopLogo || '/brand_icon_light.png'}
                  alt={product.brandName}
                  className="w-12 h-12 rounded-2xl object-cover border border-[#D4CCBC] dark:border-[#22355E] shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-black truncate">{product.brandName}</div>
                  {product.artistName && (
                    <div className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] truncate">
                      بيد الفنان: {product.artistName}
                    </div>
                  )}
                  {product.workshopGovernorate && (
                    <div className="text-[11px] font-bold text-[#EA580C] inline-flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{product.workshopGovernorate}</span>
                    </div>
                  )}
                </div>
              </div>
              {product.storeSlug && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenStore) onOpenStore(product.storeSlug);
                    else if (storeHref) window.location.href = storeHref;
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-[#0C1427] dark:bg-[#F7F3EA] text-white dark:text-[#0C1427] text-xs font-black inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>باقي منتجات الورشة</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subtle footer back button */}
        {onGoHome && (
          <div className="mt-10 pt-5 border-t border-[#D4CCBC]/70 dark:border-[#1E2E52] flex items-center justify-between text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
            <span>منظومة الشمساوية — دعم وتمكين الحرف اليدوية والمصنّعين</span>
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center gap-1 font-black text-[#EA580C] hover:underline cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>دخول المنظومة</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
