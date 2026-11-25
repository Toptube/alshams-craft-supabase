import React, { useEffect, useRef, useState } from 'react';
import {
  Gift,
  Lock,
  RotateCcw,
  Scale,
  Send,
  Sparkles,
  Sun,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  MarketShamousaActiveFilter,
  MarketSurfaceMode,
  QUICK_GIFT_BUDGETS,
  QUICK_GIFT_OCCASIONS,
  SanitizedPublicCatalogItem,
  ShamousaMarketQuickOption,
  StorePrivacySettings,
  processMarketShamousaMessage,
  runQuickGiftWizardOffline,
} from '../../services/shamousaMarketEngine';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface MarketChatMsg {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  options?: ShamousaMarketQuickOption[];
  isLeadMagnetLocked?: boolean;
}

// ============================================================================
// 1) شريط الفلتر النشط أعلى شبكة المنتجات («إلغاء الفلتر / عرض الكل» + وفّر شحن)
// ============================================================================

interface ShamousaActiveFilterBarProps {
  activeFilter: MarketShamousaActiveFilter | null;
  totalCatalogCount: number;
  shippingSaveHintAr?: string | null;
  onClearFilter: () => void;
  onSortCheapest?: () => void;
  onOpenShamousa?: () => void;
  hidePrices?: boolean;
}

export const ShamousaActiveFilterBar: React.FC<ShamousaActiveFilterBarProps> = ({
  activeFilter,
  totalCatalogCount,
  shippingSaveHintAr,
  onClearFilter,
  onSortCheapest,
  onOpenShamousa,
  hidePrices = false,
}) => {
  if (!activeFilter) return null;

  return (
    <div
      className="rounded-2xl border border-[#EA580C]/40 dark:border-[#FBBF24]/40 bg-[#FFFDF8] dark:bg-[#0F1B38] p-3 sm:p-3.5 flex flex-col gap-2 shadow-xs"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sun className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
          <p className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
            فلتر شموسة النشط: <span className="text-[#C2410C] dark:text-[#FBBF24]">{activeFilter.labelAr}</span>
          </p>
          <span className="text-xs font-mono tabular-nums text-[#64748B] dark:text-[#94A3B8] shrink-0">
            ({activeFilter.matchedIds.length} من {totalCatalogCount})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {!hidePrices && onSortCheapest && activeFilter.sortBy !== 'price_asc' && (
            <button
              type="button"
              onClick={onSortCheapest}
              className="px-2.5 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#243968] bg-white dark:bg-[#132040] text-[11px] font-bold text-[#0C1427] dark:text-[#E2E8F0] hover:border-[#EA580C] cursor-pointer whitespace-nowrap"
            >
              رتّب من الأرخص
            </button>
          )}
          {onOpenShamousa && (
            <button
              type="button"
              onClick={onOpenShamousa}
              className="px-2.5 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#243968] bg-white dark:bg-[#132040] text-[11px] font-bold text-[#0C1427] dark:text-[#E2E8F0] hover:border-[#EA580C] cursor-pointer whitespace-nowrap"
            >
              عدّل الطلب مع شموسة
            </button>
          )}
          <button
            type="button"
            onClick={onClearFilter}
            className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            <span>إلغاء الفلتر / عرض الكل</span>
          </button>
        </div>
      </div>

      {shippingSaveHintAr && (
        <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 pt-1 border-t border-[#E5DEC9] dark:border-[#1E2E52]">
          <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{shippingSaveHintAr}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2) ويدجت «شموسة» الأوفلاين للأسواق والمتاجر الخاصة (تفلتر الصفحة + هدية سريعة + Lead Magnet)
// ============================================================================

interface ShamousaMarketAssistantWidgetProps {
  mode: MarketSurfaceMode;
  catalog: SanitizedPublicCatalogItem[];
  storeName?: string;
  privacy?: StorePrivacySettings;
  isAuthenticated?: boolean;
  compareCount: number;
  favoritesCount: number;
  activeFilter: MarketShamousaActiveFilter | null;
  onApplyFilter: (filter: MarketShamousaActiveFilter | null, shippingHint?: string | null) => void;
  onOpenCompare: () => void;
  onOpenFavorites: () => void;
  onOpenRegister?: () => void;
  externalOpenSignal?: number;
}

function renderBoldLines(text: string) {
  return text.split('\n').map((line, lineIdx) => (
    <p key={lineIdx} className={lineIdx > 0 ? 'mt-1' : ''}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-black text-[#0C1427] dark:text-[#FBBF24]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </p>
  ));
}

export const ShamousaMarketAssistantWidget: React.FC<ShamousaMarketAssistantWidgetProps> = ({
  mode,
  catalog,
  storeName,
  privacy,
  isAuthenticated = false,
  compareCount,
  favoritesCount,
  activeFilter,
  onApplyFilter,
  onOpenCompare,
  onOpenFavorites,
  onOpenRegister,
  externalOpenSignal,
}) => {
  const isSupplierSurface = mode === 'suppliers_market' || mode === 'supplier_storefront';
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [leadMagnetModalOpen, setLeadMagnetModalOpen] = useState(false);
  const [messages, setMessages] = useState<MarketChatMsg[]>(() => [
    {
      id: 'welcome_mkt',
      role: 'assistant',
      text: isSupplierSurface
        ? `أهلاً بيك يا فندم في **${storeName || 'سوق الموردين'}** ☀️\nأنا **شموسة** (أوفلاين 100%) — قولي بتدور على أنهي خامة أو ميزانية وهفلترلك الشاشة قدامك فوراً!`
        : `أهلاً وسهلاً بيك في **${storeName || 'سوق الشمسية'}** ☀️\nأنا **شموسة** — قولي بتدور على هدية أو قطعة إيه (وميزانيتك لو حابب) وهفلترلك المنتجات قدامك في ثانية!`,
      options: isSupplierSurface
        ? [
            { id: 'w_s1', label: 'خامات بسعر الجملة 📦', action: 'query', payload: 'خامات جملة' },
            { id: 'w_s2', label: 'الأرخص سعراً 💰', action: 'query', payload: 'رتب الأرخص' },
            { id: 'w_s3', label: 'افتح المقارنة (⚖️)', action: 'open_compare' },
          ]
        : [
            { id: 'w_a1', label: 'معالج هدية سريعة 🎁', action: 'query', payload: 'هدية سريعة' },
            ...(!privacy?.hidePrices
              ? [{ id: 'w_a2', label: 'هدايا تحت 500 ج.م 💰', action: 'query' as const, payload: 'تحت 500 جنيه' }]
              : []),
            { id: 'w_a3', label: 'افتح المقارنة (⚖️)', action: 'open_compare' },
          ],
    },
  ]);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalOpenSignal && externalOpenSignal > 0) {
      setIsOpen(true);
    }
  }, [externalOpenSignal]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [messages, isOpen]);

  const pushUserAndReply = (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed) return;
    playButtonClickSound();

    const res = processMarketShamousaMessage({
      rawQuery: trimmed,
      mode,
      catalog,
      storeName,
      privacy,
      isAuthenticated,
      compareCount,
      favoritesCount,
    });

    if (res.clearFilter) {
      onApplyFilter(null, null);
    } else if (res.filterToApply) {
      onApplyFilter(res.filterToApply, res.shippingSaveHintAr || null);
      playSuccessSound();
    }

    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', text: trimmed },
      {
        id: `a_${Date.now() + 1}`,
        role: 'assistant',
        text: res.text,
        options: res.options,
        isLeadMagnetLocked: res.isLeadMagnetLocked,
      },
    ]);
  };

  const handleOptionClick = (opt: ShamousaMarketQuickOption) => {
    playButtonClickSound();
    if (opt.action === 'clear_filter') {
      onApplyFilter(null, null);
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: opt.label },
        {
          id: `a_${Date.now() + 1}`,
          role: 'assistant',
          text: `تمام ☀️ لغيت الفلتر وعرضتلك كل المعروضات (${catalog.length}) على الشاشة.`,
        },
      ]);
      return;
    }
    if (opt.action === 'open_compare') {
      onOpenCompare();
      return;
    }
    if (opt.action === 'open_favorites') {
      onOpenFavorites();
      return;
    }
    if (opt.action === 'open_register') {
      if (onOpenRegister) {
        setLeadMagnetModalOpen(true);
      }
      return;
    }
    if (opt.action === 'gift_occasion' && opt.payload) {
      const occ = QUICK_GIFT_OCCASIONS.find((o) => o.id === opt.payload);
      if (privacy?.hidePrices) {
        const res = runQuickGiftWizardOffline(opt.payload, 'any_budget', catalog, privacy);
        if (res.filterToApply) onApplyFilter(res.filterToApply, res.shippingSaveHintAr || null);
        setMessages((prev) => [
          ...prev,
          { id: `u_${Date.now()}`, role: 'user', text: opt.label },
          { id: `a_${Date.now() + 1}`, role: 'assistant', text: res.text, options: res.options },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: opt.label },
        {
          id: `a_${Date.now() + 1}`,
          role: 'assistant',
          text: `اختيار رائع (${occ?.labelAr || opt.label})! 💰 **الخطوة التانية والأخيرة:** ميزانيتك في حدود كام؟`,
          options: QUICK_GIFT_BUDGETS.map((b) => ({
            id: `bud_${b.id}`,
            label: b.labelAr,
            action: 'gift_budget',
            payload: `${opt.payload}|${b.id}`,
          })),
        },
      ]);
      return;
    }
    if (opt.action === 'gift_budget' && opt.payload) {
      const [occId, budId] = opt.payload.split('|');
      const res = runQuickGiftWizardOffline(occId, budId, catalog, privacy);
      if (res.filterToApply) {
        onApplyFilter(res.filterToApply, res.shippingSaveHintAr || null);
        playSuccessSound();
      }
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: opt.label },
        { id: `a_${Date.now() + 1}`, role: 'assistant', text: res.text, options: res.options },
      ]);
      return;
    }
    if (opt.action === 'query' && opt.payload) {
      pushUserAndReply(opt.payload);
    }
  };

  return (
    <>
      {/* Floating Shamousa Launcher (Clean, Non-Overlapping Bottom-Left in RTL) */}
      <div className="fixed bottom-4 left-4 z-[92] flex flex-col items-start gap-2" dir="rtl">
        {!isOpen && (
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setIsOpen(true);
            }}
            className="group flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-l from-[#EA580C] to-[#D97706] hover:from-[#C2410C] hover:to-[#B45309] text-white shadow-[0_8px_24px_rgba(234,88,12,0.38)] border border-white/25 cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]"
            aria-label="اسأل شموسة للبحث والفلترة"
          >
            <Sun className="w-5 h-5 text-amber-200 shrink-0" />
            <span className="text-xs font-black whitespace-nowrap">
              {activeFilter ? `شموسة (${activeFilter.matchedIds.length})` : 'اسأل شموسة ☀️'}
            </span>
          </button>
        )}

        {isOpen && (
          <div className="w-[calc(100vw-2rem)] sm:w-[370px] max-h-[76vh] rounded-3xl border border-[#D4CCBC] dark:border-[#243968] bg-[#FAF7F0] dark:bg-[#0A1124] shadow-2xl flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="px-4 py-3 bg-gradient-to-l from-[#EA580C] to-[#C2410C] text-white flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4 text-amber-200" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black leading-tight truncate">شموسة التسوق</h3>
                  <p className="text-[10px] text-amber-100 truncate">
                    فلترة فورية ذكية · {storeName || (isSupplierSurface ? 'سوق الموردين' : 'سوق الشمسية')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {compareCount > 0 && (
                  <button
                    type="button"
                    onClick={onOpenCompare}
                    className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                    title="افتح المقارنة"
                  >
                    <Scale className="w-3 h-3" />
                    <span className="font-mono tabular-nums">{compareCount}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
                  aria-label="إغلاق شموسة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Action Strip */}
            <div className="px-3 py-2 bg-white dark:bg-[#0D162E] border-b border-[#E5DEC9] dark:border-[#1E2E52] flex items-center gap-1.5 overflow-x-auto shrink-0">
              {!isSupplierSurface && (
                <button
                  type="button"
                  onClick={() => pushUserAndReply('هدية سريعة')}
                  className="px-2.5 py-1 rounded-lg bg-[#FFF5E6] dark:bg-[#172647] text-[#C2410C] dark:text-[#FBBF24] text-[11px] font-black inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Gift className="w-3 h-3" />
                  <span>هدية سريعة</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenCompare}
                className="px-2.5 py-1 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] text-[#0C1427] dark:text-[#E2E8F0] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Scale className="w-3 h-3 text-[#EA580C]" />
                <span>المقارنة ({compareCount})</span>
              </button>
              {activeFilter && (
                <button
                  type="button"
                  onClick={() => onApplyFilter(null, null)}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/10 text-rose-700 dark:text-rose-300 text-[11px] font-black inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إلغاء الفلتر</span>
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white rounded-tr-sm'
                        : 'bg-white dark:bg-[#132040] border border-[#E5DEC9] dark:border-[#243968] text-[#0C1427] dark:text-[#F7F3EA] rounded-tl-sm'
                    }`}
                  >
                    {renderBoldLines(m.text)}
                  </div>

                  {m.options && m.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-w-[95%]">
                      {m.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleOptionClick(opt)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                            opt.action === 'open_register'
                              ? 'bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-xs'
                              : 'bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#2B4378] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inputVal.trim()) return;
                pushUserAndReply(inputVal);
                setInputVal('');
              }}
              className="p-2.5 bg-white dark:bg-[#0D162E] border-t border-[#E5DEC9] dark:border-[#1E2E52] flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={
                  isSupplierSurface
                    ? 'اكتب الخامة أو الكمية (مثلاً: خيط قطن جملة)...'
                    : 'اكتب طلبك (مثلاً: هدية تحت 400 جنيه)...'
                }
                className="flex-1 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] bg-[#FAF7F0] dark:bg-[#0A1124] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white cursor-pointer shrink-0"
                aria-label="إرسال"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Lead Magnet Registration Modal (Technical Problems Full Unlock) */}
      {leadMagnetModalOpen && (
        <div
          className="fixed inset-0 z-[130] bg-[#060B18]/75 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setLeadMagnetModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#EA580C]/40 bg-[#FAF7F0] dark:bg-[#0D162E] p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-[#EA580C]/15 text-[#EA580C] flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    افتح مكتبة الحلول الفنية كاملة مجاناً
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    22 مشكلة فنية + الخامات البديلة الموحدة + تحذيرات السلامة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeadMagnetModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
              سجّل حسابك المجاني في الشمساوية في 30 ثانية (أو بكود مدربك/مورّدك) عشان تفتح باقي خطوات الحلول الفنية، خامات التخصص الموحدة، وتستلم نقاطك الترحيبية فوراً!
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLeadMagnetModalOpen(false);
                  onOpenRegister?.();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب مجاني الآن</span>
              </button>
              <button
                type="button"
                onClick={() => setLeadMagnetModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#243968] text-xs font-bold text-[#475569] dark:text-[#CBD5E1] cursor-pointer"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
