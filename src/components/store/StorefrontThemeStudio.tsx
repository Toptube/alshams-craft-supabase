import React from 'react';
import { Check, Eye, Sparkles, X, Palette } from 'lucide-react';
import {
  StorefrontThemeId,
  StorefrontThemeSpec,
  WORLD_STOREFRONT_THEME_LIST,
  normalizeStorefrontThemeId,
} from '../../lib/storefrontThemes';

interface StorefrontThemeGridProps {
  activeThemeId?: string | null;
  onSelectTheme: (id: StorefrontThemeId) => void;
  onPreviewTheme: (id: StorefrontThemeId) => void;
  audience?: 'artisan' | 'supplier';
}

/**
 * شبكة اختيار السمات العالمية الـ 6 مع معاينة معمارية مصغّرة لكل سمة
 * وزر "معاينة على متجري" لرؤية المتجر الحقيقي قبل الاعتماد.
 */
export const StorefrontThemeGrid: React.FC<StorefrontThemeGridProps> = ({
  activeThemeId,
  onSelectTheme,
  onPreviewTheme,
  audience = 'artisan',
}) => {
  const currentId = normalizeStorefrontThemeId(activeThemeId);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#EA580C]" />
          <h5 className="font-black text-xs sm:text-sm text-[#0C1427] dark:text-[#F7F3EA]">
            سمات المتجر العالمية (6 تصميمات احترافية بدون أي تغيير في بياناتك)
          </h5>
        </div>
        <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
          اضغط «معاينة» لتجربة السمة على {audience === 'supplier' ? 'متجر التوريد' : 'متجرك'} الحقيقي قبل الاعتماد
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {WORLD_STOREFRONT_THEME_LIST.map((theme) => {
          const isActive = theme.id === currentId;
          return (
            <ThemePreviewCard
              key={theme.id}
              theme={theme}
              isActive={isActive}
              onSelect={() => onSelectTheme(theme.id)}
              onPreview={() => onPreviewTheme(theme.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

const ThemePreviewCard: React.FC<{
  theme: StorefrontThemeSpec;
  isActive: boolean;
  onSelect: () => void;
  onPreview: () => void;
}> = ({ theme, isActive, onSelect, onPreview }) => {
  const isCentered =
    theme.heroLayout === 'centered_maison' ||
    theme.heroLayout === 'noir_spotlight' ||
    theme.heroLayout === 'swiss_minimal';

  return (
    <div
      className={`rounded-2xl border-2 transition-all overflow-hidden flex flex-col justify-between bg-white dark:bg-[#0D162E] ${
        isActive
          ? 'border-[#EA580C] ring-2 ring-[#EA580C]/25 shadow-md'
          : 'border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60'
      }`}
    >
      {/* Miniature Architectural Store Wireframe */}
      <button
        type="button"
        onClick={onPreview}
        className="w-full text-right p-3 transition-transform cursor-pointer group"
        style={{ backgroundColor: theme.pageBg, color: theme.inkColor }}
        title={`معاينة سمة ${theme.nameAr} على متجرك الحقيقي`}
      >
        {/* Mini Header Bar */}
        <div
          className="px-2.5 py-1.5 mb-2 flex items-center justify-between border"
          style={{
            backgroundColor: theme.surfaceBg,
            borderColor: theme.borderColor,
            borderRadius: theme.cardRadiusClass === 'rounded-md' ? '2px' : '8px',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ backgroundColor: theme.accentBg }}
            />
            <span className="text-[9px] font-black opacity-90">{theme.nameAr}</span>
          </div>
          <span
            className="px-1.5 py-0.5 text-[8px] font-black"
            style={{
              backgroundColor: theme.accentBg,
              color: theme.accentInk,
              borderRadius: theme.buttonRadiusClass === 'rounded-none' ? '0px' : '4px',
            }}
          >
            السلة
          </span>
        </div>

        {/* Mini Hero Section */}
        <div
          className={`px-2.5 py-2 mb-2 border flex flex-col gap-1 ${
            isCentered ? 'items-center text-center' : 'items-start text-right'
          }`}
          style={{
            backgroundColor: theme.heroBg,
            borderColor: theme.heroBorder,
            borderRadius: theme.cardRadiusClass === 'rounded-md' ? '2px' : '10px',
          }}
        >
          <span
            className="text-[8px] font-bold tracking-wider"
            style={{ color: theme.accentText }}
          >
            {theme.englishSignature}
          </span>
          <div
            className="h-1.5 w-24 rounded-full"
            style={{ backgroundColor: theme.inkColor, opacity: 0.85 }}
          />
          <div
            className="h-1 w-16 rounded-full"
            style={{ backgroundColor: theme.mutedColor, opacity: 0.55 }}
          />
        </div>

        {/* Mini 2-Card Grid Preview */}
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="overflow-hidden border"
              style={{
                backgroundColor: theme.surfaceBg,
                borderColor: theme.borderColor,
                borderRadius:
                  theme.cardRadiusClass === 'rounded-md'
                    ? '2px'
                    : theme.cardRadiusClass === 'rounded-3xl'
                      ? '12px'
                      : '8px',
              }}
            >
              <div
                className="h-7 w-full"
                style={{
                  backgroundColor: theme.softBg,
                  borderBottom: `1px solid ${theme.borderColor}`,
                }}
              />
              <div className="p-1.5 space-y-1">
                <div
                  className="h-1.5 w-12 rounded-full"
                  style={{ backgroundColor: theme.inkColor, opacity: 0.75 }}
                />
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-[8px] font-mono font-black"
                    style={{ color: theme.priceColor }}
                  >
                    450
                  </span>
                  <span
                    className="h-2.5 w-7 inline-block"
                    style={{
                      backgroundColor: theme.accentBg,
                      borderRadius: theme.buttonRadiusClass === 'rounded-none' ? '0px' : '3px',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </button>

      {/* Theme Metadata & Actions */}
      <div className="p-3 space-y-2.5 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1.5">
            <h6 className="font-black text-xs text-[#0C1427] dark:text-[#F7F3EA] truncate">
              {theme.nameAr}
            </h6>
            {isActive && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400 shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>مفعّلة</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-snug line-clamp-2">
            {theme.taglineAr}
          </p>
          <p className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
            مناسبة لـ: {theme.bestForAr}
          </p>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={onPreview}
            className="flex-1 py-2 px-2.5 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#1C2A4A] dark:hover:bg-[#24365E] text-[#FBBF24] text-[11px] font-black inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>معاينة على متجري</span>
          </button>

          {!isActive && (
            <button
              type="button"
              onClick={onSelect}
              className="py-2 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] hover:bg-[#EA580C] hover:text-white text-[#0C1427] dark:text-[#F7F3EA] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black transition-colors cursor-pointer whitespace-nowrap"
            >
              تحديد
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ThemePreviewDecisionBarProps {
  previewThemeId: StorefrontThemeId;
  savedThemeId: StorefrontThemeId;
  saving?: boolean;
  onChangePreviewTheme: (id: StorefrontThemeId) => void;
  onConfirmApply: (id: StorefrontThemeId) => void;
  onCancel: () => void;
}

/**
 * شريط اتخاذ القرار العلوي أثناء المعاينة الحية للمتجر الحقيقي:
 * يسمح بالتبديل الفوري بين الـ 6 سمات العالمية ثم الضغط على "موافق — اعتمد السمة".
 */
export const ThemePreviewDecisionBar: React.FC<ThemePreviewDecisionBarProps> = ({
  previewThemeId,
  savedThemeId,
  saving = false,
  onChangePreviewTheme,
  onConfirmApply,
  onCancel,
}) => {
  const currentTheme = WORLD_STOREFRONT_THEME_LIST.find((t) => t.id === previewThemeId);

  return (
    <div
      className="sticky top-0 z-[70] bg-[#0C1427] text-[#F7F3EA] border-b border-[#22355E] shadow-xl px-3 sm:px-5 py-2.5"
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EA580C]/20 text-[#FBBF24] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black truncate">
              معاينة حية: <span className="text-[#FBBF24]">{currentTheme?.nameAr}</span>
            </p>
            <p className="text-[10px] text-[#94A3B8] truncate">
              جرّب أي سمة تحت على متجرك الحقيقي، ولما يعجبك الشكل اضغط «موافق»
            </p>
          </div>
        </div>

        {/* Instant 6-Theme Switcher Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
          {WORLD_STOREFRONT_THEME_LIST.map((t) => {
            const active = t.id === previewThemeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangePreviewTheme(t.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                  active
                    ? 'bg-[#FBBF24] text-[#0C1427] border-[#FBBF24]'
                    : 'bg-[#132040] text-[#E2E8F0] border-[#22355E] hover:border-[#FBBF24]/60'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm border border-white/30 shrink-0"
                  style={{ backgroundColor: t.pageBg }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.accentBg }}
                />
                <span>{t.nameAr}</span>
              </button>
            );
          })}
        </div>

        {/* Confirm / Cancel */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={() => onConfirmApply(previewThemeId)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>
              {saving
                ? 'جاري الاعتماد...'
                : previewThemeId === savedThemeId
                  ? 'السمة معتمدة حالياً ✓'
                  : 'موافق — اعتمد السمة دي لمتجري'}
            </span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-xl bg-[#132040] hover:bg-[#1E2F57] text-[#E2E8F0] border border-[#22355E] text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>إلغاء</span>
          </button>
        </div>
      </div>
    </div>
  );
};
