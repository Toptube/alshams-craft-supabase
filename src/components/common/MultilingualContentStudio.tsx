import React, { useState } from 'react';
import {
  Globe,
  Coins,
  Sparkles,
  Upload,
  Check,
  Loader2,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import {
  PUBLIC_LANGUAGES,
  PublicLocaleCode,
  translateFieldsWithAI,
} from '../../lib/publicLocale';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';
import { compressImageFile } from '../../utils/imageCompressor';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

export interface MultilingualFieldSpec {
  key: string;
  labelAr: string;
  sourceArabicValue: string;
  multiline?: boolean;
  placeholderEn?: string;
}

export interface MultilingualContentStudioProps {
  title?: string;
  subtitle?: string;
  enabledLanguages: PublicLocaleCode[];
  onChangeEnabledLanguages: (langs: PublicLocaleCode[]) => void;
  defaultLanguage?: PublicLocaleCode;
  onChangeDefaultLanguage?: (lang: PublicLocaleCode) => void;
  // Optional Currencies section (for Storefronts)
  showCurrencies?: boolean;
  enabledCurrencies?: string[];
  onChangeEnabledCurrencies?: (currencies: string[]) => void;
  // Optional Bilingual Logo section (Arabic + English logos)
  showBilingualLogos?: boolean;
  defaultLogoUrl?: string;
  logoArUrl?: string;
  logoEnUrl?: string;
  onChangeLogoAr?: (url: string) => void;
  onChangeLogoEn?: (url: string) => void;
  // Translatable fields
  fields: MultilingualFieldSpec[];
  translations: Partial<Record<PublicLocaleCode, Record<string, string | undefined>>>;
  onChangeTranslations: (
    next: Partial<Record<PublicLocaleCode, Record<string, string | undefined>>>
  ) => void;
}

export const MultilingualContentStudio: React.FC<MultilingualContentStudioProps> = ({
  title = 'اللغات والترجمة والشعار ثنائي اللغة',
  subtitle = 'فعّل اللغات والعملات التي تريد ظهورها لعملائك وترجم نصوصك بضغطة واحدة',
  enabledLanguages,
  onChangeEnabledLanguages,
  defaultLanguage = 'ar',
  onChangeDefaultLanguage,
  showCurrencies = false,
  enabledCurrencies = ['EGP', 'USD', 'EUR', 'SAR', 'AED'],
  onChangeEnabledCurrencies,
  showBilingualLogos = true,
  defaultLogoUrl = '/alshams_falcon_emblem.png',
  logoArUrl = '',
  logoEnUrl = '',
  onChangeLogoAr,
  onChangeLogoEn,
  fields,
  translations,
  onChangeTranslations,
}) => {
  const nonArabicEnabled = enabledLanguages.filter((l) => l !== 'ar');
  const [activeEditLang, setActiveEditLang] = useState<PublicLocaleCode>(
    nonArabicEnabled[0] || 'en'
  );
  const [translating, setTranslating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<'ar' | 'en' | null>(null);

  const toggleLanguage = (code: PublicLocaleCode) => {
    playButtonClickSound();
    if (code === 'ar') {
      // Keep at least one language active
      if (enabledLanguages.length === 1 && enabledLanguages[0] === 'ar') return;
    }
    const exists = enabledLanguages.includes(code);
    let next: PublicLocaleCode[];
    if (exists) {
      next = enabledLanguages.filter((l) => l !== code);
      if (next.length === 0) next = ['ar'];
    } else {
      next = [...enabledLanguages, code];
      if (code !== 'ar') setActiveEditLang(code);
    }
    onChangeEnabledLanguages(next);
  };

  const toggleCurrency = (code: string) => {
    if (!onChangeEnabledCurrencies) return;
    playButtonClickSound();
    const exists = enabledCurrencies.includes(code);
    let next = exists
      ? enabledCurrencies.filter((c) => c !== code)
      : [...enabledCurrencies, code];
    if (next.length === 0) next = ['EGP'];
    onChangeEnabledCurrencies(next);
  };

  const handleUploadLogo = async (which: 'ar' | 'en', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(which);
    try {
      const compressed = await compressImageFile(file);
      if (compressed) {
        if (which === 'ar') onChangeLogoAr?.(compressed);
        else onChangeLogoEn?.(compressed);
        playSuccessSound();
      }
    } finally {
      setUploadingLogo(null);
    }
  };

  const handleFieldChange = (lang: PublicLocaleCode, key: string, value: string) => {
    const prevLangObj = translations?.[lang] || {};
    onChangeTranslations({
      ...translations,
      [lang]: {
        ...prevLangObj,
        [key]: value,
      },
    });
  };

  const handleAutoTranslate = async () => {
    const targetLang = activeEditLang === 'ar' ? 'en' : activeEditLang;
    const payload: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.sourceArabicValue && f.sourceArabicValue.trim()) {
        payload[f.key] = f.sourceArabicValue.trim();
      }
    });
    if (Object.keys(payload).length === 0) {
      setStatusMsg('اكتب النصوص العربية أولاً ثم اضغط على الترجمة التلقائية.');
      return;
    }
    setTranslating(true);
    setStatusMsg(null);
    try {
      const res = await translateFieldsWithAI(payload, targetLang, 'ar');
      if (res.success && res.translations) {
        const prevLangObj = translations?.[targetLang] || {};
        onChangeTranslations({
          ...translations,
          [targetLang]: {
            ...prevLangObj,
            ...res.translations,
          },
        });
        playSuccessSound();
        const langMeta = PUBLIC_LANGUAGES.find((l) => l.code === targetLang);
        setStatusMsg(`تمت الترجمة تلقائياً إلى ${langMeta?.nameAr || targetLang} بنجاح ✨ — يمكنك مراجعتها وتعديلها`);
      } else {
        setStatusMsg(res.error || 'تعذرت الترجمة التلقائية حالياً — يمكنك الكتابة يدوياً.');
      }
    } finally {
      setTranslating(false);
    }
  };

  const currentLangMeta = PUBLIC_LANGUAGES.find((l) => l.code === activeEditLang) || PUBLIC_LANGUAGES[1];

  return (
    <div
      dir="rtl"
      className="rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-5 space-y-5 shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#D4CCBC]/70 dark:border-[#22355E] pb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EA580C] to-[#D97706] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              {title}
            </h3>
            <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Enabled Languages */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
            1) اللغات المفعّلة للزوار والعملاء:
          </span>
          {onChangeDefaultLanguage && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-[#64748B] dark:text-[#94A3B8]">اللغة الافتراضية:</span>
              <select
                value={defaultLanguage}
                onChange={(e) => onChangeDefaultLanguage(e.target.value as PublicLocaleCode)}
                className="px-2 py-1 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
              >
                {enabledLanguages.map((code) => {
                  const meta = PUBLIC_LANGUAGES.find((l) => l.code === code);
                  return (
                    <option key={code} value={code}>
                      {meta?.flag} {meta?.nameAr}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PUBLIC_LANGUAGES.map((lang) => {
            const active = enabledLanguages.includes(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] dark:bg-[#EA580C] dark:text-white'
                    : 'bg-[#F7F3EA] dark:bg-[#132040] text-[#475569] dark:text-[#94A3B8] border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.nameAr}</span>
                {active && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Enabled Currencies (Storefronts) */}
      {showCurrencies && onChangeEnabledCurrencies && (
        <div className="space-y-2.5 pt-1 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
          <div className="flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
            <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>2) العملات المتاحة للعملاء (تحويل تلقائي لحظي للأسعار):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_CURRENCIES.map((curr) => {
              const active = enabledCurrencies.includes(curr.code);
              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => toggleCurrency(curr.code)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-[#F7F3EA] dark:bg-[#132040] text-[#475569] dark:text-[#94A3B8] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  <span>{curr.flag}</span>
                  <span>{curr.nameAr}</span>
                  <span className="font-mono text-[10px] opacity-85">({curr.code})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Bilingual Logo Switcher (Arabic Logo + English/International Logo) */}
      {showBilingualLogos && onChangeLogoEn && (
        <div className="space-y-2.5 pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
          <div className="flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
            <ImageIcon className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>الشعار ثنائي اللغة (يتبدل تلقائياً حسب لغة الزائر):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Arabic Logo */}
            <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-3">
              <img
                src={logoArUrl || defaultLogoUrl}
                alt="الشعار بالعربية"
                className="w-14 h-14 rounded-xl object-contain bg-white p-1 border border-[#D4CCBC] shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-black">🇪🇬 الشعار العربي (الافتراضي)</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {onChangeLogoAr && (
                    <label className="px-2.5 py-1 rounded-lg bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black inline-flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3 text-[#EA580C]" />
                      <span>{uploadingLogo === 'ar' ? 'جاري الرفع...' : 'تغيير'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadLogo('ar', e)}
                        className="hidden"
                      />
                    </label>
                  )}
                  {logoArUrl && onChangeLogoAr && (
                    <button
                      type="button"
                      onClick={() => onChangeLogoAr('')}
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="العودة للشعار الأساسي"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* English / International Logo */}
            <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-3">
              <img
                src={logoEnUrl || logoArUrl || defaultLogoUrl}
                alt="English / International Logo"
                className="w-14 h-14 rounded-xl object-contain bg-white p-1 border border-[#D4CCBC] shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-black">🇬🇧 الشعار الإنجليزي / العالمي</p>
                <p className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                  يظهر تلقائياً للزوار باللغات الأجنبية
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="px-2.5 py-1 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>{uploadingLogo === 'en' ? 'جاري الرفع...' : logoEnUrl ? 'تغيير الشعار' : 'رفع شعار إنجليزي'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadLogo('en', e)}
                      className="hidden"
                    />
                  </label>
                  {logoEnUrl && (
                    <button
                      type="button"
                      onClick={() => onChangeLogoEn('')}
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="حذف الشعار الإنجليزي"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Translations Content Editor + 1-Click AI Translate */}
      {fields.length > 0 && nonArabicEnabled.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black">ترجمة النصوص للغة:</span>
              {nonArabicEnabled.map((code) => {
                const m = PUBLIC_LANGUAGES.find((l) => l.code === code)!;
                const active = activeEditLang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      playButtonClickSound();
                      setActiveEditLang(code);
                      setStatusMsg(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 transition cursor-pointer ${
                      active
                        ? 'bg-[#EA580C] text-white'
                        : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    <span>{m.flag}</span>
                    <span>{m.nativeName}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={translating}
              onClick={handleAutoTranslate}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0C1427] via-[#1E3A8A] to-[#EA580C] hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-60"
            >
              {translating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
              )}
              <span>
                {translating
                  ? 'جاري الترجمة...'
                  : `ترجمة تلقائية إلى ${currentLangMeta.nameAr}`}
              </span>
            </button>
          </div>

          {statusMsg && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200">
              {statusMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => {
              const translatedVal = translations?.[activeEditLang]?.[f.key] || '';
              return (
                <div key={f.key} className={f.multiline ? 'sm:col-span-2' : ''}>
                  <label className="flex items-center justify-between gap-2 text-[11px] font-black mb-1">
                    <span>
                      {f.labelAr} ({currentLangMeta.flag} {currentLangMeta.nativeName})
                    </span>
                    {f.sourceArabicValue && (
                      <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] truncate max-w-[160px]">
                        الأصل: {f.sourceArabicValue}
                      </span>
                    )}
                  </label>
                  {f.multiline ? (
                    <textarea
                      dir={currentLangMeta.dir}
                      rows={3}
                      value={translatedVal}
                      onChange={(e) => handleFieldChange(activeEditLang, f.key, e.target.value)}
                      placeholder={f.placeholderEn || `Enter ${currentLangMeta.nativeName} translation...`}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] focus:outline-none text-xs font-bold"
                    />
                  ) : (
                    <input
                      type="text"
                      dir={currentLangMeta.dir}
                      value={translatedVal}
                      onChange={(e) => handleFieldChange(activeEditLang, f.key, e.target.value)}
                      placeholder={f.placeholderEn || `Enter ${currentLangMeta.nativeName} translation...`}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] focus:outline-none text-xs font-bold"
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
