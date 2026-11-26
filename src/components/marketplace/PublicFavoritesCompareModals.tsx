import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Heart,
  MessageCircle,
  Scale,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import type { WishlistItem } from '../../services/wishlistService';
import {
  CompareScope,
  PublicCompareItem,
  buildCompareWhatsAppShareText,
  buildFacebookShareUrl,
  buildSupplierBulkRfqGroups,
  buildWhatsAppShareUrl,
  buildWishlistWhatsAppShareText,
  detectSameStoreShippingGroups,
  narrowCompareItemsWithShamousa,
} from '../../services/marketCompareService';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

// ============================================================================
// 1) درج المفضلة (❤️) — مع مشاركة واتساب وفيسبوك + نقل للمقارنة والسلة + وفّر شحن
// ============================================================================

interface PublicFavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: WishlistItem[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  onSelectProduct?: (id: string) => void;
  onMoveToCompare?: (item: WishlistItem) => void;
  compareIds?: Set<string>;
  formatPrice?: (egpPrice: number) => string;
  hidePrices?: boolean;
  isGuest?: boolean;
  onOpenRegister?: () => void;
  shareBaseUrl?: string;
}

export const PublicFavoritesDrawer: React.FC<PublicFavoritesDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemove,
  onClearAll,
  onSelectProduct,
  onMoveToCompare,
  compareIds,
  formatPrice,
  hidePrices = false,
  isGuest = false,
  onOpenRegister,
  shareBaseUrl,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sameStoreGroups = useMemo(() => detectSameStoreShippingGroups(items), [items]);
  const currentUrl =
    shareBaseUrl || (typeof window !== 'undefined' ? window.location.href : 'https://alshams.app');

  if (!isOpen) return null;

  const fmt = (egp: number) =>
    formatPrice ? formatPrice(egp) : `${Math.round(egp).toLocaleString('ar-EG')} ج.م`;

  const handleShareAllWhatsApp = () => {
    if (items.length === 0) return;
    playButtonClickSound();
    const txt = buildWishlistWhatsAppShareText(items, currentUrl, { hidePrices });
    const a = document.createElement('a');
    a.href = buildWhatsAppShareUrl(txt);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleShareAllFacebook = () => {
    if (items.length === 0) return;
    playButtonClickSound();
    const txt = buildWishlistWhatsAppShareText(items, currentUrl, { hidePrices });
    const a = document.createElement('a');
    a.href = buildFacebookShareUrl(currentUrl, txt);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleShareSingleWhatsApp = (item: WishlistItem) => {
    playButtonClickSound();
    const txt = buildWishlistWhatsAppShareText([item], currentUrl, { hidePrices });
    const a = document.createElement('a');
    a.href = buildWhatsAppShareUrl(txt);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleCopyList = async () => {
    const txt = buildWishlistWhatsAppShareText(items, currentUrl, { hidePrices });
    try {
      await navigator.clipboard.writeText(txt);
      playSuccessSound();
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  return (
    <div
      className="fixed inset-0 z-[115] bg-[#060B18]/70 backdrop-blur-xs flex justify-end"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#FAF7F0] dark:bg-[#0A1124] border-r border-[#D4CCBC] dark:border-[#22355E] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5DEC9] dark:border-[#1E2E52] bg-white dark:bg-[#0D162E] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-600 fill-rose-600 shrink-0" />
            <h2 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              المفضلة ({items.length})
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {items.length > 0 && onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#64748B] hover:text-rose-600 cursor-pointer"
              >
                مسح الكل
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1EAE0] dark:hover:bg-[#152447] cursor-pointer"
              aria-label="إغلاق المفضلة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Share Bar + Save Shipping Notice */}
        {items.length > 0 && (
          <div className="px-4 py-3 border-b border-[#E5DEC9] dark:border-[#1E2E52] bg-[#F7F3EA]/70 dark:bg-[#0D162E]/70 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleShareAllWhatsApp}
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>مشاركة واتساب</span>
              </button>
              <button
                type="button"
                onClick={handleShareAllFacebook}
                className="flex-1 px-3 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>مشاركة فيسبوك</span>
              </button>
              <button
                type="button"
                onClick={handleCopyList}
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] bg-white dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                title="نسخ القائمة"
              >
                {copiedId === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {sameStoreGroups.length > 0 && (
              <div className="rounded-xl bg-emerald-600/10 border border-emerald-600/25 px-3 py-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <Truck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  وفّر شحن: عندك {sameStoreGroups[0].count} منتجات من «{sameStoreGroups[0].storeName}» — جمعهم في طلب واحد بشحن واحد!
                </span>
              </div>
            )}
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Heart className="w-10 h-10 text-[#CBD5E1] dark:text-[#334155] mx-auto" />
              <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">قائمة المفضلة فاضية حالياً</p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                اضغط على القلب الأحمر (❤️) على أي منتج يعجبك عشان تحفظه أو تشاركه مع أهلك وأصحابك.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const inCompare = compareIds?.has(item.id);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#E5DEC9] dark:border-[#1E2E52] bg-white dark:bg-[#0D162E] p-3 flex items-start gap-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProduct?.(item.id);
                      onClose();
                    }}
                    className="w-16 h-16 rounded-xl overflow-hidden bg-[#F7F3EA] dark:bg-[#132040] shrink-0 cursor-pointer"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-rose-500">
                        <Heart className="w-5 h-5" />
                      </div>
                    )}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProduct?.(item.id);
                        onClose();
                      }}
                      className="text-right text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] line-clamp-1 cursor-pointer block w-full"
                    >
                      {item.productName}
                    </button>
                    <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {item.brandName && <span className="truncate">{item.brandName}</span>}
                      {!hidePrices && (
                        <>
                          {item.brandName && <span aria-hidden="true">·</span>}
                          <span className="font-mono tabular-nums font-black text-[#C2410C] dark:text-[#FBBF24]">
                            {fmt(item.egpPrice)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {onMoveToCompare && (
                        <button
                          type="button"
                          onClick={() => onMoveToCompare(item)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                            inCompare
                              ? 'bg-[#EA580C]/15 text-[#C2410C] dark:text-[#FBBF24]'
                              : 'bg-[#F7F3EA] dark:bg-[#132040] text-[#0C1427] dark:text-[#E2E8F0] hover:bg-[#EFE8DA]'
                          }`}
                        >
                          <Scale className="w-3 h-3" />
                          <span>{inCompare ? 'بالمقارنة ✓' : 'قارن'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleShareSingleWhatsApp(item)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-emerald-600/20"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>شارك</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="mr-auto p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-600 cursor-pointer"
                        aria-label="إزالة من المفضلة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Gentle Guest Registration Motivation */}
        {isGuest && onOpenRegister && (
          <div className="p-3.5 border-t border-[#E5DEC9] dark:border-[#1E2E52] bg-[#FFF8EB] dark:bg-[#111D3B] flex items-center justify-between gap-2 shrink-0">
            <p className="text-[11px] font-bold text-[#0C1427] dark:text-[#E2E8F0] leading-snug">
              سجّل حسابك مجاناً عشان تحفظ مفضلتك على كل أجهزتك وتستفيد بنقاط الترحيب!
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              className="px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>سجّل الآن</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2) شاشة المقارنة المنفصلة (الميزان ⚖️) — منفصلة تماماً عن السلة + تصفية شموسة + مشاركة + B2B RFQ للموردين
// ============================================================================

interface PublicCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: CompareScope;
  items: PublicCompareItem[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAddToCart?: (item: PublicCompareItem) => void;
  onSelectProduct?: (id: string) => void;
  formatPrice?: (egpPrice: number) => string;
  hidePrices?: boolean;
  disableDirectOrders?: boolean;
  buyerDefaults?: { name?: string; workshop?: string; governorate?: string };
}

export const PublicCompareModal: React.FC<PublicCompareModalProps> = ({
  isOpen,
  onClose,
  scope,
  items,
  onRemove,
  onClearAll,
  onAddToCart,
  onSelectProduct,
  formatPrice,
  hidePrices = false,
  disableDirectOrders = false,
  buyerDefaults,
}) => {
  const [innerFilter, setInnerFilter] = useState<'all' | 'cheapest' | 'ready' | 'same_store'>('all');
  const [showShamousaHelper, setShowShamousaHelper] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [showRfqPanel, setShowRfqPanel] = useState(false);
  const [rfqQuantities, setRfqQuantities] = useState<Record<string, number>>({});
  const [rfqBuyerName, setRfqBuyerName] = useState(buyerDefaults?.name || '');
  const [rfqWorkshop, setRfqWorkshop] = useState(buyerDefaults?.workshop || '');
  const [rfqNotes, setRfqNotes] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const sameStoreGroups = useMemo(() => detectSameStoreShippingGroups(items), [items]);
  const sameStoreItemIds = useMemo(
    () => new Set(sameStoreGroups.flatMap((g) => g.itemIds)),
    [sameStoreGroups]
  );

  const displayedItems = useMemo(() => {
    let list = [...items];
    if (innerFilter === 'ready') {
      list = list.filter((i) => i.inStock);
    } else if (innerFilter === 'same_store' && sameStoreItemIds.size > 0) {
      list = list.filter((i) => sameStoreItemIds.has(i.id));
    } else if (innerFilter === 'cheapest') {
      list.sort((a, b) => a.priceEgp - b.priceEgp);
    }
    return list;
  }, [items, innerFilter, sameStoreItemIds]);

  const shamousaRecommendation = useMemo(() => {
    if (!showShamousaHelper) return null;
    const maxBudget = Number(budgetLimit) > 0 ? Number(budgetLimit) : undefined;
    return narrowCompareItemsWithShamousa(items, {
      maxBudgetEgp: hidePrices ? undefined : maxBudget,
      hidePrices,
    });
  }, [showShamousaHelper, items, budgetLimit, hidePrices]);

  const rfqGroups = useMemo(() => {
    if (scope !== 'supplier' || !showRfqPanel) return [];
    return buildSupplierBulkRfqGroups(displayedItems, rfqQuantities, {
      name: rfqBuyerName,
      workshop: rfqWorkshop,
      governorate: buyerDefaults?.governorate,
      notes: rfqNotes,
    });
  }, [scope, showRfqPanel, displayedItems, rfqQuantities, rfqBuyerName, rfqWorkshop, buyerDefaults?.governorate, rfqNotes]);

  if (!isOpen) return null;

  const fmt = (egp: number) =>
    formatPrice ? formatPrice(egp) : `${Math.round(egp).toLocaleString('ar-EG')} ج.م`;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://alshams.app';

  const handleShareCompareWhatsApp = () => {
    if (displayedItems.length === 0) return;
    playButtonClickSound();
    const txt = buildCompareWhatsAppShareText(displayedItems, currentUrl, { hidePrices });
    const a = document.createElement('a');
    a.href = buildWhatsAppShareUrl(txt);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[118] bg-[#060B18]/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#FAF7F0] dark:bg-[#0A1124] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5DEC9] dark:border-[#1E2E52] bg-white dark:bg-[#0D162E] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                المقارنة ({items.length}/12)
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                مساحة مقارنة منفصلة تماماً عن السلة — صفّي اختياراتك بهدوء وانقل الأنسب فقط.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {items.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  setShowShamousaHelper((v) => !v);
                }}
                className="px-3 py-2 rounded-xl bg-[#0C1427] dark:bg-[#FBBF24] text-[#FBBF24] dark:text-[#0C1427] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>خلّي شموسة تساعدني أختار</span>
              </button>
            )}

            {items.length >= 1 && (
              <button
                type="button"
                onClick={handleShareCompareWhatsApp}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>شارك المقارنة واتساب</span>
              </button>
            )}

            {scope === 'supplier' && items.length >= 1 && (
              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  setShowRfqPanel((v) => !v);
                }}
                className="px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>اطلب تسعير مجمّع للكميات</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] text-[#475569] dark:text-[#94A3B8] cursor-pointer"
              aria-label="إغلاق المقارنة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-Toolbar: Internal Filters + Save-Shipping Alert */}
        {items.length > 0 && (
          <div className="px-4 py-2.5 border-b border-[#E5DEC9] dark:border-[#1E2E52] bg-[#F7F3EA]/70 dark:bg-[#0D162E]/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `الكل (${items.length})` },
                  ...(!hidePrices ? [{ id: 'cheapest', label: 'الأقل سعراً' }] : []),
                  { id: 'ready', label: 'متوفر وجاهز' },
                  ...(sameStoreGroups.length > 0 ? [{ id: 'same_store', label: 'نفس المتجر (وفّر شحن)' }] : []),
                ] as Array<{ id: 'all' | 'cheapest' | 'ready' | 'same_store'; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInnerFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition whitespace-nowrap ${
                    innerFilter === tab.id
                      ? 'bg-[#EA580C] text-white'
                      : 'bg-white dark:bg-[#132040] text-[#475569] dark:text-[#CBD5E1] border border-[#D4CCBC] dark:border-[#243968]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              تفريغ المقارنة
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Save Shipping Banner */}
          {sameStoreGroups.length > 0 && (
            <div className="rounded-2xl bg-emerald-600/10 border border-emerald-600/25 p-3 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                وفّر شحن: في قائمة المقارنة عندك <strong>{sameStoreGroups[0].count}</strong> عناصر من نفس {scope === 'supplier' ? 'المورّد' : 'المتجر'} («{sameStoreGroups[0].storeName}») — لو اخترتهم مع بعض هتدفع مصاريف شحن واحدة!
              </span>
            </div>
          )}

          {/* Shamousa Offline Compare Helper Panel */}
          {showShamousaHelper && shamousaRecommendation && (
            <div className="rounded-2xl border-2 border-[#EA580C]/40 dark:border-[#FBBF24]/40 bg-[#FFFDF8] dark:bg-[#111D3B] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    تصفية شموسة الذكية
                  </span>
                </div>
                {!hidePrices && (
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                      ميزانيتك القصوى (اختياري):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={budgetLimit}
                      onChange={(e) => setBudgetLimit(e.target.value)}
                      placeholder="مثلاً 500"
                      className="w-24 px-2.5 py-1 rounded-lg border border-[#D4CCBC] dark:border-[#243968] bg-white dark:bg-[#0A1124] text-xs font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]"
                    />
                  </div>
                )}
              </div>

              <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
                {shamousaRecommendation.summaryAr}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {shamousaRecommendation.topPicks.map((pick) => (
                  <div
                    key={pick.item.id}
                    className="rounded-xl border border-[#E5DEC9] dark:border-[#243968] bg-white dark:bg-[#0D162E] p-3 space-y-1.5"
                  >
                    <span className="text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24]">
                      {pick.badgeAr}
                    </span>
                    <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] line-clamp-1">
                      {pick.item.name}
                    </p>
                    <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-snug">
                      {pick.reasonAr}
                    </p>
                    {onAddToCart && !disableDirectOrders && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddToCart(pick.item);
                          playSuccessSound();
                        }}
                        className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black cursor-pointer"
                      >
                        انقل للسلة 🛒
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B2B Supplier Grouped RFQ Panel */}
          {scope === 'supplier' && showRfqPanel && displayedItems.length > 0 && (
            <div className="rounded-2xl border-2 border-[#EA580C]/40 bg-white dark:bg-[#0D162E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  📦 طلب تسعير مجمّع للكميات (B2B RFQ) — لكل مورد في قائمة المقارنة
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRfqPanel(false)}
                  className="text-xs font-bold text-[#64748B] hover:text-[#0C1427] cursor-pointer"
                >
                  إخفاء
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={rfqWorkshop}
                  onChange={(e) => setRfqWorkshop(e.target.value)}
                  placeholder="اسم ورشتك / براندك"
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] bg-[#FAF7F0] dark:bg-[#0A1124] text-xs text-[#0C1427] dark:text-[#F7F3EA]"
                />
                <input
                  type="text"
                  value={rfqBuyerName}
                  onChange={(e) => setRfqBuyerName(e.target.value)}
                  placeholder="اسم المسؤول"
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] bg-[#FAF7F0] dark:bg-[#0A1124] text-xs text-[#0C1427] dark:text-[#F7F3EA]"
                />
                <input
                  type="text"
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                  placeholder="ملاحظات (لون، ميعاد تسليم...)"
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] bg-[#FAF7F0] dark:bg-[#0A1124] text-xs text-[#0C1427] dark:text-[#F7F3EA]"
                />
              </div>

              <div className="space-y-2">
                {displayedItems.map((it) => (
                  <div
                    key={it.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FAF7F0] dark:bg-[#132040]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">{it.name}</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{it.storeName}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#64748B]">الكمية المطلوبة:</span>
                      <input
                        type="number"
                        min={1}
                        value={rfqQuantities[it.id] ?? it.minWholesaleQty ?? 5}
                        onChange={(e) =>
                          setRfqQuantities((prev) => ({ ...prev, [it.id]: Math.max(1, Number(e.target.value || 1)) }))
                        }
                        className="w-20 px-2 py-1 rounded-lg border border-[#D4CCBC] dark:border-[#243968] bg-white dark:bg-[#0A1124] text-xs font-mono tabular-nums text-center text-[#0C1427] dark:text-[#F7F3EA]"
                      />
                      <span className="text-[11px] text-[#64748B]">{it.unitLabel || 'وحدة'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {rfqGroups.map((grp) => (
                  <div
                    key={grp.storeKey}
                    className="rounded-xl border border-[#E5DEC9] dark:border-[#243968] p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">{grp.storeName}</p>
                      <p className="text-[11px] text-[#64748B]">{grp.itemsCount} خامات مجمّعة في رسالة واحدة</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(grp.messageText);
                            playSuccessSound();
                            setCopiedKey(grp.storeKey);
                            setTimeout(() => setCopiedKey(null), 2000);
                          } catch {}
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#243968] text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                      >
                        {copiedKey === grp.storeKey ? 'تم النسخ ✓' : 'نسخ'}
                      </button>
                      <a
                        href={buildWhatsAppShareUrl(grp.messageText, grp.publicWhatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>إرسال للمورّد</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison Grid */}
          {displayedItems.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Scale className="w-10 h-10 text-[#CBD5E1] dark:text-[#334155] mx-auto" />
              <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                قائمة المقارنة فاضية حالياً
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto">
                اضغط على أيقونة الميزان (⚖️) على أي عدد من المنتجات أو الخامات عشان تقارن السعر والمقاس ومدة التجهيز جنب بعض بدون ما تزحم سلة الشراء.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#E5DEC9] dark:border-[#1E2E52] bg-white dark:bg-[#0D162E] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-36 bg-[#F7F3EA] dark:bg-[#132040]">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#94A3B8]">
                          <Scale className="w-7 h-7" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/55 hover:bg-rose-600 text-white cursor-pointer transition"
                        aria-label="إزالة من المقارنة"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-3.5 space-y-2.5">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProduct?.(item.id);
                            onClose();
                          }}
                          className="text-right text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] line-clamp-2 cursor-pointer"
                        >
                          {item.name}
                        </button>
                        <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                          {item.storeName}
                        </p>
                      </div>

                      <dl className="divide-y divide-[#F1EAE0] dark:divide-[#1E2E52] text-xs">
                        {!hidePrices && (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <dt className="text-[#64748B] dark:text-[#94A3B8]">السعر</dt>
                            <dd className="font-mono tabular-nums font-black text-[#C2410C] dark:text-[#FBBF24]">
                              {fmt(item.priceEgp)}
                            </dd>
                          </div>
                        )}
                        {!hidePrices && scope === 'supplier' && item.wholesalePriceEgp && (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <dt className="text-[#64748B] dark:text-[#94A3B8]">سعر الجملة</dt>
                            <dd className="font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-400">
                              {fmt(item.wholesalePriceEgp)} ({item.minWholesaleQty || 5}+)
                            </dd>
                          </div>
                        )}
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <dt className="text-[#64748B] dark:text-[#94A3B8]">القسم / الحرفة</dt>
                          <dd className="font-bold text-[#0C1427] dark:text-[#E2E8F0] truncate max-w-[60%]">
                            {item.craftOrCategory || 'يدوي مميز'}
                          </dd>
                        </div>
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <dt className="text-[#64748B] dark:text-[#94A3B8]">
                            {scope === 'supplier' ? 'الوحدة' : 'المقاس'}
                          </dt>
                          <dd className="font-bold text-[#0C1427] dark:text-[#E2E8F0] truncate max-w-[60%]">
                            {item.sizeLabel || item.unitLabel || 'قياسي'}
                          </dd>
                        </div>
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <dt className="text-[#64748B] dark:text-[#94A3B8]">التوفر والتجهيز</dt>
                          <dd className="font-bold text-[#0C1427] dark:text-[#E2E8F0]">
                            {item.inStock
                              ? item.prepDays
                                ? `~${item.prepDays} أيام`
                                : 'متوفر الآن'
                              : 'بالطلب'}
                            {item.isFreeShipping ? ' · شحن مجاني' : ''}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="p-3 pt-0 flex items-center gap-2">
                    {onAddToCart && !disableDirectOrders && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddToCart(item);
                          playSuccessSound();
                        }}
                        className="flex-1 px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>نقل للسلة</span>
                      </button>
                    )}
                    {onSelectProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProduct(item.id);
                          onClose();
                        }}
                        className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                      >
                        التفاصيل
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
