import React from 'react';
import { Clock, Flame, Gift, Sparkles, Star, Tag, TicketPercent } from 'lucide-react';
import { ProductDiscountConfig, ProductOfferType } from '../../types/artisanStoreBuilder';

interface ProductOfferEditorSectionProps {
  value: ProductDiscountConfig;
  onChange: (next: ProductDiscountConfig) => void;
  basePrice?: number;
  currencySymbol?: string;
  availableCouponCodes?: string[];
  sectionTitle?: string;
}

const QUICK_BADGES = [
  'عرض خاص',
  'سعر لفترة محدودة',
  'خصم حصري',
  'اشتري 2 + 1 مجاناً',
  'عرض اليوم',
  'كمية محدودة',
];

export const DEFAULT_PRODUCT_OFFER: ProductDiscountConfig = {
  enabled: false,
  type: 'percent',
  value: 10,
  applyMode: 'automatic',
  linkedCouponCode: '',
  originalPrice: undefined,
  offerPrice: undefined,
  buyQty: 2,
  freeQty: 1,
  isLimitedTime: false,
  startsAt: '',
  endsAt: '',
  badgeText: '',
  isBestSeller: false,
  isSpecialOffer: false,
};

export const ProductOfferEditorSection: React.FC<ProductOfferEditorSectionProps> = ({
  value,
  onChange,
  basePrice = 0,
  currencySymbol = 'ج.م',
  availableCouponCodes = [],
  sectionTitle = 'العروض والخصومات والتمييز داخل المتجر (اختياري)',
}) => {
  const safeVal: ProductDiscountConfig = { ...DEFAULT_PRODUCT_OFFER, ...(value || {}) };

  const patch = (partial: Partial<ProductDiscountConfig>) => {
    onChange({ ...safeVal, ...partial });
  };

  // Compute live preview of before/after price
  const computedPreview = (() => {
    if (!safeVal.enabled) return null;
    if (safeVal.type === 'before_after') {
      const before = Number(safeVal.originalPrice || basePrice || 0);
      const after = Number(safeVal.offerPrice || 0);
      if (before > after && after > 0) {
        const pct = Math.max(1, Math.round(((before - after) / before) * 100));
        return { before, after, pct };
      }
      return null;
    }
    if (safeVal.type === 'percent' && safeVal.value > 0 && basePrice > 0) {
      const after = Math.max(1, Math.round(basePrice * (1 - Math.min(90, safeVal.value) / 100)));
      return { before: basePrice, after, pct: Math.round(safeVal.value) };
    }
    if (safeVal.type === 'fixed' && safeVal.value > 0 && basePrice > 0) {
      const after = Math.max(1, Math.round(basePrice - safeVal.value));
      const pct = Math.max(1, Math.round(((basePrice - after) / basePrice) * 100));
      return { before: basePrice, after, pct };
    }
    return null;
  })();

  return (
    <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-3 text-xs">
      {/* Header + Quick Highlights */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
          <Tag className="w-4 h-4" />
          <span>{sectionTitle}</span>
        </h4>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => patch({ isBestSeller: !safeVal.isBestSeller })}
            className={`px-2.5 py-1 rounded-xl font-black text-[11px] border cursor-pointer transition inline-flex items-center gap-1 ${
              safeVal.isBestSeller
                ? 'bg-amber-500 border-amber-400 text-[#0C1427]'
                : 'bg-white dark:bg-[#060B18] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1]'
            }`}
          >
            <Star className={`w-3 h-3 ${safeVal.isBestSeller ? 'fill-[#0C1427]' : ''}`} />
            <span>الأكثر طلباً</span>
          </button>

          <button
            type="button"
            onClick={() => patch({ enabled: !safeVal.enabled })}
            className={`px-3 py-1 rounded-xl font-black text-[11px] border cursor-pointer transition inline-flex items-center gap-1 ${
              safeVal.enabled
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-white dark:bg-[#060B18] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA]'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>{safeVal.enabled ? 'العرض مفعل ✓' : 'تفعيل عرض / خصم'}</span>
          </button>
        </div>
      </div>

      {safeVal.enabled && (
        <div className="space-y-3 pt-1">
          {/* 1. Offer Type Picker */}
          <div>
            <label className="block font-bold mb-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
              نوع العرض أو الخصم على المنتج:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'percent', label: 'خصم نسبة %' },
                  { id: 'fixed', label: `خصم مبلغ (${currencySymbol})` },
                  { id: 'before_after', label: 'سعر قبل وبعد' },
                  { id: 'bogo', label: 'اشتري X + Y مجاناً' },
                  { id: 'free_shipping', label: 'شحن مجاني 🚚' },
                  { id: 'special_offer', label: 'شارة عرض خاص ✨' },
                ] as Array<{ id: ProductOfferType; label: string }>
              ).map((opt) => {
                const active = safeVal.type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const extra: Partial<ProductDiscountConfig> = { type: opt.id };
                      if (opt.id === 'before_after' && !safeVal.originalPrice && basePrice > 0) {
                        extra.originalPrice = basePrice;
                        extra.offerPrice = Math.max(1, Math.round(basePrice * 0.85));
                      }
                      if (opt.id === 'bogo' && !safeVal.buyQty) {
                        extra.buyQty = 2;
                        extra.freeQty = 1;
                      }
                      patch(extra);
                    }}
                    className={`px-2.5 py-2 rounded-xl border text-[11px] font-black cursor-pointer transition text-center ${
                      active
                        ? 'bg-[#EA580C] text-white border-[#C2410C] shadow-xs'
                        : 'bg-white dark:bg-[#060B18] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Dynamic Value Fields Based on Type */}
          {safeVal.type === 'percent' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1">نسبة الخصم (%)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={safeVal.value || 0}
                  onChange={(e) => patch({ value: Math.min(90, Math.max(0, Number(e.target.value) || 0)) })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
                />
              </div>
              {computedPreview && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between">
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">السعر الظاهر للعميل:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="line-through text-stone-400 text-[11px]">
                      {computedPreview.before.toLocaleString('ar-EG')}
                    </span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">
                      {computedPreview.after.toLocaleString('ar-EG')} {currencySymbol}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {safeVal.type === 'fixed' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1">قيمة الخصم الثابت ({currencySymbol})</label>
                <input
                  type="number"
                  min={1}
                  value={safeVal.value || 0}
                  onChange={(e) => patch({ value: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
                />
              </div>
              {computedPreview && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between">
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">السعر بعد الخصم:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="line-through text-stone-400 text-[11px]">
                      {computedPreview.before.toLocaleString('ar-EG')}
                    </span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">
                      {computedPreview.after.toLocaleString('ar-EG')} {currencySymbol}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {safeVal.type === 'before_after' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1">السعر قبل الخصم (مشطوب) ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={safeVal.originalPrice ?? basePrice ?? ''}
                  onChange={(e) => patch({ originalPrice: Math.max(0, Number(e.target.value) || 0) })}
                  placeholder="مثال: 650"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">السعر بعد الخصم (السعر الفعلي الآن) ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={safeVal.offerPrice ?? ''}
                  onChange={(e) => patch({ offerPrice: Math.max(0, Number(e.target.value) || 0) })}
                  placeholder="مثال: 490"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-emerald-500 font-mono font-black text-emerald-700 dark:text-emerald-300"
                />
              </div>
              {computedPreview && (
                <div className="sm:col-span-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-300 dark:border-emerald-700 text-[11px] font-black text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                  <span>سيظهر للعميل: السعر قبل {computedPreview.before.toLocaleString('ar-EG')} ← الآن {computedPreview.after.toLocaleString('ar-EG')} {currencySymbol}</span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white">توفير {computedPreview.pct}%</span>
                </div>
              )}
            </div>
          )}

          {safeVal.type === 'bogo' && (
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E]">
              <div>
                <label className="block font-bold mb-1 flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>عند شراء (عدد القطع):</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={safeVal.buyQty ?? 2}
                  onChange={(e) => patch({ buyQty: Math.max(1, parseInt(e.target.value, 10) || 2) })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">احصل مجاناً على (عدد):</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={safeVal.freeQty ?? 1}
                  onChange={(e) => patch({ freeQty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
                />
              </div>
              <div className="col-span-2 text-[11px] font-black text-[#C2410C] dark:text-amber-300">
                سيظهر على المنتج: «اشتري {safeVal.buyQty || 2} واحصل على {safeVal.freeQty || 1} مجاناً»
              </div>
            </div>
          )}

          {/* 3. Apply Mode: Automatic vs Coupon Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E]">
            <div>
              <label className="block font-bold mb-1 flex items-center gap-1">
                <TicketPercent className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>طريقة تفعيل العرض للعميل:</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => patch({ applyMode: 'automatic', linkedCouponCode: '' })}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-black cursor-pointer ${
                    (safeVal.applyMode || 'automatic') === 'automatic'
                      ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427]'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  تلقائي بدون كود
                </button>
                <button
                  type="button"
                  onClick={() => patch({ applyMode: 'coupon' })}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-black cursor-pointer ${
                    safeVal.applyMode === 'coupon'
                      ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427]'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  بواسطة كود خصم
                </button>
              </div>
            </div>

            {safeVal.applyMode === 'coupon' && (
              <div>
                <label className="block font-bold mb-1">كود الخصم المرتبط بالمنتج:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={safeVal.linkedCouponCode || ''}
                    onChange={(e) => patch({ linkedCouponCode: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="مثال: VIP20"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black uppercase"
                  />
                  {availableCouponCodes.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) patch({ linkedCouponCode: e.target.value });
                      }}
                      className="px-2 py-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold text-[11px]"
                    >
                      <option value="">اختر كود</option>
                      {availableCouponCodes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. Badge Label & Quick Presets */}
          <div className="space-y-1.5">
            <label className="block font-bold">الشارة الظاهرة على بطاقة المنتج في المتجر:</label>
            <input
              type="text"
              value={safeVal.badgeText || ''}
              onChange={(e) => patch({ badgeText: e.target.value })}
              placeholder="مثال: عرض خاص · سعر لفترة محدودة"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_BADGES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => patch({ badgeText: preset })}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black border cursor-pointer transition ${
                    safeVal.badgeText === preset
                      ? 'bg-[#EA580C] text-white border-[#C2410C]'
                      : 'bg-white dark:bg-[#060B18] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:border-[#EA580C]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Time Window: Open vs From -> To + Special Offer Section Toggle */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 font-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={safeVal.isLimitedTime}
                  onChange={(e) => patch({ isLimitedTime: e.target.checked })}
                  className="w-4 h-4 accent-[#EA580C]"
                />
                <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>تحديد فترة زمنية للعرض (أو اتركه مفتوحاً بدون وقت)</span>
              </label>

              <label className="inline-flex items-center gap-1.5 font-black cursor-pointer text-[#C2410C] dark:text-amber-300">
                <input
                  type="checkbox"
                  checked={safeVal.isSpecialOffer !== false}
                  onChange={(e) => patch({ isSpecialOffer: e.target.checked })}
                  className="w-4 h-4 accent-[#EA580C]"
                />
                <Sparkles className="w-3.5 h-3.5" />
                <span>إظهار في قسم «العروض الخاصة» بالمتجر</span>
              </label>
            </div>

            {safeVal.isLimitedTime && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold mb-1">يبدأ العرض من (اختياري):</label>
                  <input
                    type="datetime-local"
                    value={safeVal.startsAt ? safeVal.startsAt.slice(0, 16) : ''}
                    onChange={(e) =>
                      patch({
                        startsAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">ينتهي العرض في:</label>
                  <input
                    type="datetime-local"
                    value={safeVal.endsAt ? safeVal.endsAt.slice(0, 16) : ''}
                    onChange={(e) =>
                      patch({
                        endsAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-[11px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
