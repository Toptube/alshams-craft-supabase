import React, { useState, useRef, useEffect } from 'react';
import { Globe, Coins, Check } from 'lucide-react';
import {
  PUBLIC_LANGUAGES,
  PublicLocaleCode,
  getPublicLanguageMeta,
} from '../../lib/publicLocale';
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '../../lib/currency';

export interface PublicLocaleCurrencyBarProps {
  locale: PublicLocaleCode;
  onChangeLocale: (next: PublicLocaleCode) => void;
  enabledLanguages?: PublicLocaleCode[];
  currency?: string;
  onChangeCurrency?: (nextCode: string) => void;
  enabledCurrencies?: string[];
  compact?: boolean;
  darkSurface?: boolean;
  className?: string;
}

export const PublicLocaleCurrencyBar: React.FC<PublicLocaleCurrencyBarProps> = ({
  locale,
  onChangeLocale,
  enabledLanguages,
  currency,
  onChangeCurrency,
  enabledCurrencies,
  compact = true,
  darkSurface = false,
  className = '',
}) => {
  const [openMenu, setOpenMenu] = useState<'lang' | 'curr' | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);

  const langOptions =
    enabledLanguages && enabledLanguages.length > 0
      ? PUBLIC_LANGUAGES.filter((l) => enabledLanguages.includes(l.code))
      : PUBLIC_LANGUAGES;

  const currOptions =
    enabledCurrencies && enabledCurrencies.length > 0
      ? SUPPORTED_CURRENCIES.filter((c) => enabledCurrencies.includes(c.code))
      : SUPPORTED_CURRENCIES;

  const activeLang = getPublicLanguageMeta(locale);
  const activeCurr = currency ? getCurrencyInfo(currency) : null;
  const isRtl = activeLang.dir === 'rtl';

  const btnBase = darkSurface
    ? 'bg-white/10 hover:bg-white/20 text-white border-white/25'
    : 'bg-[#FFFDF8]/90 hover:bg-[#EFE9DC] dark:bg-[#132040] dark:hover:bg-[#1B2F5E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]';

  const iconBtnSize = compact ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-9 h-9';

  return (
    <div ref={wrapperRef} className={`inline-flex items-center gap-1 relative shrink-0 ${className}`}>
      {/* Minimal Language Icon Button */}
      {langOptions.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'lang' ? null : 'lang'))}
            title={`${isRtl ? 'تغيير اللغة' : 'Language'} (${activeLang.nativeName})`}
            aria-label={isRtl ? 'تغيير اللغة' : 'Change language'}
            className={`${iconBtnSize} relative rounded-xl border inline-flex items-center justify-center transition cursor-pointer shrink-0 ${btnBase}`}
          >
            <Globe className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span className="absolute -bottom-1 -right-1 px-1 py-px rounded bg-[#0C1427] dark:bg-[#F7F3EA] text-[#F7F3EA] dark:text-[#0C1427] text-[8px] font-mono font-black leading-none shadow-xs">
              {activeLang.shortCode}
            </span>
          </button>

          {openMenu === 'lang' && (
            <div
              role="menu"
              className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} min-w-[165px] max-w-[calc(100vw-24px)] rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl p-1.5 z-[90] space-y-0.5 ${isRtl ? 'text-right' : 'text-left'}`}
            >
              {langOptions.map((item) => {
                const selected = item.code === locale;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      onChangeLocale(item.code);
                      setOpenMenu(null);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-black flex items-center justify-between gap-2 transition cursor-pointer ${
                      selected
                        ? 'bg-[#EA580C] text-white'
                        : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#EFE9DC] dark:hover:bg-[#132040]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.flag}</span>
                      <span>{item.nativeName}</span>
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Minimal Currency Icon Button */}
      {activeCurr && onChangeCurrency && currOptions.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'curr' ? null : 'curr'))}
            title={`${isRtl ? 'تغيير العملة' : 'Currency'} (${isRtl ? activeCurr.nameAr : activeCurr.nameEn})`}
            aria-label={isRtl ? 'تغيير العملة' : 'Change currency'}
            className={`${iconBtnSize} relative rounded-xl border inline-flex items-center justify-center transition cursor-pointer shrink-0 ${btnBase}`}
          >
            <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="absolute -bottom-1 -right-1 px-1 py-px rounded bg-emerald-700 text-white text-[8px] font-mono font-black leading-none shadow-xs">
              {activeCurr.code}
            </span>
          </button>

          {openMenu === 'curr' && (
            <div
              role="menu"
              className={`absolute top-full mt-2 ${isRtl ? 'left-0' : 'right-0'} min-w-[185px] max-w-[calc(100vw-24px)] max-h-72 overflow-y-auto rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl p-1.5 z-[90] space-y-0.5 ${isRtl ? 'text-right' : 'text-left'}`}
            >
              {currOptions.map((c) => {
                const selected = c.code === activeCurr.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onChangeCurrency(c.code);
                      setOpenMenu(null);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-black flex items-center justify-between gap-2 transition cursor-pointer ${
                      selected
                        ? 'bg-emerald-600 text-white'
                        : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#EFE9DC] dark:hover:bg-[#132040]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span>{c.flag}</span>
                      <span className="truncate">{locale === 'ar' ? c.nameAr : c.nameEn}</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-85 shrink-0">
                      {c.symbol} · {c.code}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
