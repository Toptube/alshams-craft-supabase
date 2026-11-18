import React, { useState } from 'react';
import { UnifiedPricingMode } from '../../types';
import { marginToMarkupPercent, markupToMarginPercent } from '../../utils/craftUnifiedFinancials';
import { NumberInput } from '../ui/NumberInput';
import { ChevronDown, ChevronUp, Zap, Clock, Layers, ShieldCheck } from 'lucide-react';

interface UnifiedPricingStep4PanelProps {
  currencySymbol: string;
  pricingMode: UnifiedPricingMode;
  onChangePricingMode: (m: UnifiedPricingMode) => void;
  profitMarginPercent: number;
  onChangeProfitMarginPercent: (v: number) => void;
  platformCommissionPercent: number;
  onChangePlatformCommissionPercent: (v: number) => void;
  advertisedDiscountPercent: number;
  onChangeAdvertisedDiscountPercent: (v: number) => void;
  vatPercent: number;
  onChangeVatPercent: (v: number) => void;

  // Time & Difficulty
  setupHours: number;
  onChangeSetupHours: (v: number) => void;
  productionHours: number;
  onChangeProductionHours: (v: number) => void;
  finishingHours: number;
  onChangeFinishingHours: (v: number) => void;
  hourlyRateOverride: number;
  onChangeHourlyRateOverride: (v: number) => void;
  difficultyMultiplier: number;
  onChangeDifficultyMultiplier: (v: number) => void;
  customDesignFee: number;
  onChangeCustomDesignFee: (v: number) => void;

  // Energy & Mold & Batch
  machinePowerKw: number;
  onChangeMachinePowerKw: (v: number) => void;
  machineRunHours: number;
  onChangeMachineRunHours: (v: number) => void;
  kwhPrice: number;
  onChangeKwhPrice: (v: number) => void;
  fuelGasCost: number;
  onChangeFuelGasCost: (v: number) => void;
  moldTotalCost: number;
  onChangeMoldTotalCost: (v: number) => void;
  moldExpectedUses: number;
  onChangeMoldExpectedUses: (v: number) => void;
  batchQuantity: number;
  onChangeBatchQuantity: (v: number) => void;
  goodPiecesCount: number;
  onChangeGoodPiecesCount: (v: number) => void;
  batchSetupCost: number;
  onChangeBatchSetupCost: (v: number) => void;
}

export const UnifiedPricingStep4Panel: React.FC<UnifiedPricingStep4PanelProps> = (props) => {
  const [openTime, setOpenTime] = useState(false);
  const [openEnergyMold, setOpenEnergyMold] = useState(false);
  const [openBatch, setOpenBatch] = useState(false);

  const equivText =
    props.pricingMode === 'margin'
      ? `هامش ${props.profitMarginPercent}% من البيع ⇐ يساوي زيادة ${marginToMarkupPercent(props.profitMarginPercent)}% على التكلفة`
      : props.pricingMode === 'markup'
      ? `زيادة ${props.profitMarginPercent}% على التكلفة ⇐ يساوي هامش ${markupToMarginPercent(props.profitMarginPercent)}% من البيع`
      : `الوضع المعزول: تُضرب النسبة في تكلفة الخامات فقط (بدون مصنعية أو تشغيل)`;

  const maxSlider = props.pricingMode === 'margin' ? 80 : 300;

  return (
    <div className="space-y-3">
      {/* 1. Pricing Mode & Equivalence */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 to-stone-50 dark:from-stone-800/80 dark:to-stone-900 border border-amber-300/60 dark:border-stone-700 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>نظام التسعير المحاسبي المصحح (ث6)</span>
          </span>

          <div className="flex items-center gap-1 bg-white dark:bg-stone-950 p-1 rounded-xl border border-stone-200 dark:border-stone-700 text-[11px] font-bold">
            {(
              [
                { id: 'margin', label: 'هامش من البيع (r)' },
                { id: 'markup', label: 'زيادة على التكلفة (u)' },
                { id: 'insulated', label: 'المعزول (خامات فقط)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  props.onChangePricingMode(opt.id);
                  if (opt.id === 'margin' && props.profitMarginPercent > 80) {
                    props.onChangeProfitMarginPercent(35);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  props.pricingMode === opt.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Margin / Markup Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="font-mono text-base text-amber-600 dark:text-amber-400">
              {props.profitMarginPercent}%
            </span>
            <span className="text-stone-700 dark:text-stone-300">
              {props.pricingMode === 'margin'
                ? 'نسبة هامش الربح من سعر البيع: P = TC ÷ (1 − r − c)'
                : props.pricingMode === 'markup'
                ? 'نسبة الزيادة على التكلفة: P = TC × (1 + u) ÷ (1 − c)'
                : 'نسبة الربح المعزول (على الخامات فقط)'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={maxSlider}
            step="1"
            value={Math.min(maxSlider, props.profitMarginPercent)}
            onChange={(e) => props.onChangeProfitMarginPercent(Number(e.target.value))}
            className="w-full accent-amber-600 cursor-pointer"
          />
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
            {equivText}
          </p>
        </div>

        {/* Commission, Discount & VAT */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-amber-200/70 dark:border-stone-700">
          <div>
            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
              عمولة المنصة / الدفع (c%)
            </label>
            <NumberInput
              value={props.platformCommissionPercent}
              min={0}
              max={50}
              step={0.5}
              onChange={props.onChangePlatformCommissionPercent}
              className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
              الخصم المعلن (d%) ← سعر القائمة
            </label>
            <NumberInput
              value={props.advertisedDiscountPercent}
              min={0}
              max={75}
              step={1}
              onChange={props.onChangeAdvertisedDiscountPercent}
              className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
              ضريبة القيمة المضافة VAT (v%)
            </label>
            <NumberInput
              value={props.vatPercent}
              min={0}
              max={30}
              step={1}
              onChange={props.onChangeVatPercent}
              className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2. Time Breakdown & Difficulty & Design Fee (Collapsible) */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenTime(!openTime)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-extrabold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>حساب العمالة بالساعات + معامل الصعوبة + رسم التصميم (ث2)</span>
          </span>
          {openTime ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openTime && (
          <div className="p-3.5 pt-1 border-t border-stone-200 dark:border-stone-700 space-y-3">
            <p className="text-[10px] text-stone-500 dark:text-stone-400">
              عند إدخال الساعات (تجهيز + إنتاج + تشطيب) تُحسب أجرة اليد آلياً = (مجموع الساعات × الأجر × معامل الصعوبة). زمن التجفيف والانتظار لا يدخل أجراً!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold mb-1">ساعات التجهيز</label>
                <NumberInput value={props.setupHours} min={0} step={0.25} onChange={props.onChangeSetupHours} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">ساعات الإنتاج</label>
                <NumberInput value={props.productionHours} min={0} step={0.25} onChange={props.onChangeProductionHours} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">ساعات التشطيب</label>
                <NumberInput value={props.finishingHours} min={0} step={0.25} onChange={props.onChangeFinishingHours} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">أجر الساعة ({props.currencySymbol})</label>
                <NumberInput value={props.hourlyRateOverride} min={0} step={5} onChange={props.onChangeHourlyRateOverride} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">معامل الصعوبة (k_d)</label>
                <NumberInput value={props.difficultyMultiplier} min={0.5} max={3} step={0.1} onChange={props.onChangeDifficultyMultiplier} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">رسم التصميم المخصص ({props.currencySymbol})</label>
                <NumberInput value={props.customDesignFee} min={0} step={10} onChange={props.onChangeCustomDesignFee} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Energy & Mold Amortization (Collapsible) */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenEnergyMold(!openEnergyMold)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-extrabold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>الطاقة (كيلووات/ساعة + غاز) وإهلاك القوالب (ث3)</span>
          </span>
          {openEnergyMold ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openEnergyMold && (
          <div className="p-3.5 pt-1 border-t border-stone-200 dark:border-stone-700 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold mb-1">قدرة الجهاز (kW)</label>
              <NumberInput value={props.machinePowerKw} min={0} step={0.1} onChange={props.onChangeMachinePowerKw} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">ساعات التشغيل الفعلية</label>
              <NumberInput value={props.machineRunHours} min={0} step={0.25} onChange={props.onChangeMachineRunHours} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">سعر الـ kWh ({props.currencySymbol})</label>
              <NumberInput value={props.kwhPrice} min={0} step={0.05} onChange={props.onChangeKwhPrice} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">تكلفة الغاز/الوقود ({props.currencySymbol})</label>
              <NumberInput value={props.fuelGasCost} min={0} onChange={props.onChangeFuelGasCost} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">إجمالي سعر القالب ({props.currencySymbol})</label>
              <NumberInput value={props.moldTotalCost} min={0} onChange={props.onChangeMoldTotalCost} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">عدد استخدامات القالب</label>
              <NumberInput value={props.moldExpectedUses} min={1} onChange={props.onChangeMoldExpectedUses} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
            </div>
          </div>
        )}
      </div>

      {/* 4. Batch & Defect Yield (Collapsible) */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenBatch(!openBatch)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-extrabold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>حساب الدُفعة وتوزيع التالف على القطع السليمة (ث5)</span>
          </span>
          {openBatch ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openBatch && (
          <div className="p-3.5 pt-1 border-t border-stone-200 dark:border-stone-700 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold mb-1">عدد القطع في الدُفعة (n)</label>
              <NumberInput
                value={props.batchQuantity}
                min={1}
                onChange={(v) => {
                  props.onChangeBatchQuantity(v);
                  if (props.goodPiecesCount > v || props.goodPiecesCount === props.batchQuantity) {
                    props.onChangeGoodPiecesCount(v);
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">عدد القطع السليمة (n_good)</label>
              <NumberInput
                value={props.goodPiecesCount}
                min={1}
                max={Math.max(1, props.batchQuantity)}
                onChange={props.onChangeGoodPiecesCount}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">تكلفة إعداد الدُفعة ({props.currencySymbol})</label>
              <NumberInput value={props.batchSetupCost} min={0} onChange={props.onChangeBatchSetupCost} className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
