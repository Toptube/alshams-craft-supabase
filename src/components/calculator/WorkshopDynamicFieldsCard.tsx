import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Sliders,
  RotateCcw,
  Save,
  Layers,
  Info,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  clearCraftCalibrations,
  getDefaultParamsForWorkshop,
  getSavedCraftCalibrations,
  getWorkshopSpec,
  saveCraftCalibrations,
  WorkshopSpec,
} from '../../utils/craftEquationsEngine';
import { MAIN_SECTIONS, SUB_CRAFTS_REGISTRY } from '../../registry/craftsRegistry';
import { NumberInput } from '../ui/NumberInput';

interface WorkshopDynamicFieldsCardProps {
  craftId: string;
  params: Record<string, number | string | boolean>;
  onChangeParams: (next: Record<string, number | string | boolean>) => void;
  calibrations: Record<string, number>;
  onChangeCalibrations: (next: Record<string, number>) => void;
  onApplySuggestedHourlyRate?: (rate: number) => void;
  // Fusion-specific props when craftId === 'craft_fusion'
  fusionPrimaryCraftId?: string;
  onChangeFusionPrimaryCraftId?: (id: string) => void;
  fusionSecondaryCraftId?: string;
  onChangeFusionSecondaryCraftId?: (id: string) => void;
  fusionSecondaryParams?: Record<string, number | string | boolean>;
  onChangeFusionSecondaryParams?: (next: Record<string, number | string | boolean>) => void;
}

export const WorkshopDynamicFieldsCard: React.FC<WorkshopDynamicFieldsCardProps> = ({
  craftId,
  params,
  onChangeParams,
  calibrations,
  onChangeCalibrations,
  onApplySuggestedHourlyRate,
  fusionPrimaryCraftId = 'macrame',
  onChangeFusionPrimaryCraftId,
  fusionSecondaryCraftId = 'resin',
  onChangeFusionSecondaryCraftId,
  fusionSecondaryParams = {},
  onChangeFusionSecondaryParams,
}) => {
  const [showCalibrations, setShowCalibrations] = useState(false);
  const [calSavedToast, setCalSavedToast] = useState(false);

  const isFusion = craftId === 'craft_fusion';
  const activeCraftId = isFusion ? fusionPrimaryCraftId : craftId;
  const spec: WorkshopSpec | undefined = getWorkshopSpec(activeCraftId);
  const secondarySpec: WorkshopSpec | undefined = isFusion ? getWorkshopSpec(fusionSecondaryCraftId) : undefined;

  useEffect(() => {
    if (!spec) return;
    const saved = getSavedCraftCalibrations(spec.craftId);
    if (Object.keys(saved).length > 0) {
      onChangeCalibrations({ ...saved });
    }
  }, [spec?.craftId]);

  const handleParamUpdate = (key: string, val: number | string | boolean) => {
    onChangeParams({ ...params, [key]: val });
  };

  const handleCalUpdate = (key: string, val: number) => {
    onChangeCalibrations({ ...calibrations, [key]: val });
  };

  const handleSaveCalibrationLocal = () => {
    if (!spec) return;
    const mergedCal: Record<string, number> = {};
    for (const f of spec.fields) {
      if (f.isCalibration) {
        const val = calibrations[f.key] ?? params[f.key] ?? f.defaultValue;
        mergedCal[f.key] = Number(val) || Number(f.defaultValue) || 0;
      }
    }
    saveCraftCalibrations(spec.craftId, mergedCal);
    setCalSavedToast(true);
    setTimeout(() => setCalSavedToast(false), 2500);
  };

  const handleResetDefaults = () => {
    if (!spec) return;
    clearCraftCalibrations(spec.craftId);
    onChangeCalibrations({});
    onChangeParams(getDefaultParamsForWorkshop(spec.craftId));
  };

  const primaryInputFields = spec ? spec.fields.filter((f) => !f.isCalibration) : [];
  const calibrationFields = spec ? spec.fields.filter((f) => f.isCalibration) : [];

  if (!spec && !isFusion) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 1. Universal Multi-Craft Fusion Selector (when craft_fusion is active) */}
      {isFusion && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-50 to-amber-50/60 dark:from-indigo-950/30 dark:to-amber-950/20 border border-indigo-200 dark:border-indigo-800/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-200/70 dark:border-indigo-800/50 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-200">
                دمج أي ورشتين من الـ 14 قسماً (Multi-Craft Fusion)
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
              ت_ك = Σ أجزاء بدون تكرار
            </span>
          </div>

          <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
            كل جزء يحتفظ بمعادلة ورشته وهالكه وزمنه بشكل مستقل تماماً ثم يُجمعان في بطاقة منتج واحد دون احتساب أي خامة أو زمن مرتين.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
              <label className="block text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300">
                الورشة / الجزء الأول:
              </label>
              <select
                value={fusionPrimaryCraftId}
                onChange={(e) => onChangeFusionPrimaryCraftId?.(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              >
                {MAIN_SECTIONS.map((sec) => {
                  const crafts = SUB_CRAFTS_REGISTRY.filter(
                    (c) => c.mainSectionId === sec.id && c.id !== 'craft_fusion'
                  );
                  if (crafts.length === 0) return null;
                  return (
                    <optgroup key={sec.id} label={sec.nameAr}>
                      {crafts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-800 space-y-1.5">
              <label className="block text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
                الورشة / الجزء الثاني المدمج:
              </label>
              <select
                value={fusionSecondaryCraftId}
                onChange={(e) => {
                  const newId = e.target.value;
                  onChangeFusionSecondaryCraftId?.(newId);
                  onChangeFusionSecondaryParams?.(getDefaultParamsForWorkshop(newId));
                }}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              >
                {MAIN_SECTIONS.map((sec) => {
                  const crafts = SUB_CRAFTS_REGISTRY.filter(
                    (c) => c.mainSectionId === sec.id && c.id !== 'craft_fusion'
                  );
                  if (crafts.length === 0) return null;
                  return (
                    <optgroup key={sec.id} label={sec.nameAr}>
                      {crafts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameAr}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 2. Primary Workshop Spec Card */}
      {spec && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-amber-400/50 dark:border-amber-700/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                {isFusion ? `[الجزء 1] مواصفات ومعادلة: ${spec.nameAr}` : `معادلة الورشة: ${spec.nameAr}`}
              </h3>
              {spec.isNewStar && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  جديدة ★
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                {spec.isYieldOrNestingBased
                  ? 'هالك بالتعشيق / العائد (بدون ازدواج)'
                  : `الهالك المرجعي: ${spec.defaultWastePercent}% على الصافي`}
              </span>
              {onApplySuggestedHourlyRate && (
                <button
                  type="button"
                  onClick={() =>
                    onApplySuggestedHourlyRate(
                      Math.round((spec.indicativeHourlyRateRange[0] + spec.indicativeHourlyRateRange[1]) / 2)
                    )
                  }
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-amber-500/20 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition cursor-pointer"
                  title="تطبيق متوسط أجر الساعة التوضيحي في خطوة 4"
                >
                  أجر الساعة الاسترشادي: {spec.indicativeHourlyRateRange[0]}–{spec.indicativeHourlyRateRange[1]} ج/س
                </button>
              )}
            </div>
          </div>

          {/* Safety Warning Banner (Critical for Cold Process Soap, Lighting, Resin, Polyester) */}
          {spec.safetyWarning && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400/70 dark:border-rose-700 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{spec.safetyWarning}</p>
            </div>
          )}

          {/* Formula Reference Strip */}
          <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 text-[11px] font-bold text-amber-950 dark:text-amber-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{spec.formulaSummaryAr}</span>
          </div>

          {/* Standard Measurement & Recipe Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {primaryInputFields.map((field) => {
              const currentVal = params[field.key] ?? field.defaultValue;
              return (
                <div key={field.key} className="space-y-1">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    {field.labelAr}
                    {field.unitAr && <span className="text-[10px] text-stone-400 mr-1">({field.unitAr})</span>}
                  </label>

                  {field.type === 'select' && field.options ? (
                    <select
                      value={String(currentVal)}
                      onChange={(e) => handleParamUpdate(field.key, e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {field.options.map((opt) => (
                        <option key={String(opt.value)} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <NumberInput
                      value={Number(currentVal) || 0}
                      min={field.min}
                      max={field.max}
                      step={field.step || 1}
                      onChange={(v) => handleParamUpdate(field.key, v)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}

                  {field.hintAr && (
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight">{field.hintAr}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calibration Constants Drawer */}
          {calibrationFields.length > 0 && (
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCalibrations(!showCalibrations)}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>
                    {showCalibrations
                      ? 'إخفاء ثوابت المعايرة المخصصة للورشة'
                      : `معايرة ثوابت الورشة (${calibrationFields.length} ثوابت: الكثافة / التغطية / التعشيق)`}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  {calSavedToast && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> تم حفظ معايرتك
                    </span>
                  )}
                  {showCalibrations && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveCalibrationLocal}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        <Save className="w-3 h-3" /> حفظ للورشة
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> الافتراضي
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showCalibrations && (
                <div className="mt-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calibrationFields.map((field) => {
                    const val =
                      calibrations[field.key] ?? Number(params[field.key] ?? field.defaultValue);
                    return (
                      <div key={field.key} className="space-y-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          ⚙️ {field.labelAr}
                          {field.unitAr && <span className="text-[10px] text-stone-400 mr-1">({field.unitAr})</span>}
                        </label>
                        <NumberInput
                          value={Number(val) || 0}
                          min={field.min}
                          max={field.max}
                          step={field.step || 0.01}
                          onChange={(v) => {
                            handleCalUpdate(field.key, v);
                            handleParamUpdate(field.key, v);
                          }}
                          className="w-full px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 text-xs font-bold font-mono outline-none"
                        />
                        {field.hintAr && (
                          <p className="text-[10px] text-stone-500">{field.hintAr}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Secondary Workshop Spec Card in Fusion Mode */}
      {isFusion && secondarySpec && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/40 dark:bg-stone-900 border border-indigo-300 dark:border-indigo-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-200/70 dark:border-indigo-800/50 pb-2.5">
            <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-200">
              [الجزء 2 المدمج] معادلة: {secondarySpec.nameAr}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              هالك {secondarySpec.defaultWastePercent}%
            </span>
          </div>

          {secondarySpec.safetyWarning && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-900 dark:text-rose-200 text-[11px] font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{secondarySpec.safetyWarning}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {secondarySpec.fields.filter((f) => !f.isCalibration).map((field) => {
              const cur = fusionSecondaryParams[field.key] ?? field.defaultValue;
              return (
                <div key={field.key} className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                    {field.labelAr}
                    {field.unitAr && <span className="text-[10px] text-stone-400 mr-1">({field.unitAr})</span>}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select
                      value={String(cur)}
                      onChange={(e) =>
                        onChangeFusionSecondaryParams?.({
                          ...fusionSecondaryParams,
                          [field.key]: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold outline-none"
                    >
                      {field.options.map((opt) => (
                        <option key={String(opt.value)} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <NumberInput
                      value={Number(cur) || 0}
                      min={field.min}
                      max={field.max}
                      step={field.step || 1}
                      onChange={(v) =>
                        onChangeFusionSecondaryParams?.({
                          ...fusionSecondaryParams,
                          [field.key]: v,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold font-mono outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
