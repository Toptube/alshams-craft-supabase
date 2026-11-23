import React, { useState, useRef, useEffect } from 'react';
import { Globe, Coins, Check, ChevronDown } from 'lucide-react';
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
  compact = false,
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

  const btnBase = darkSurface
    ? 'bg-white/10 hover:bg-white/20 text-white border-white/25'
    : 'bg-[#FFFDF8] hover:bg-[#EFE9DC] dark:bg-[#132040] dark:hover:bg-[#1B2F5E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]';

  return (
    <div ref={wrapperRef} className={`inline-flex items-center gap-1.5 relative ${className}`}>
      {/* Language Selector */}
      {langOptions.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'lang' ? null : 'lang'))}
            title="Switch Language / تغيير اللغة"
            className={`${
              compact ? 'h-8 px-2 text-[11px]' : 'h-9 px-2.5 text-xs'
            } rounded-xl border font-black inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap ${btnBase}`}
          >
            <Globe className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
            <span>{activeLang.flag}</span>
            <span>{compact ? activeLang.shortCode : activeLang.nativeName}</span>
            <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
          </button>

          {openMenu === 'lang' && (
            <div
              role="menu"
              className="absolute top-full mt-1.5 right-0 min-w-[165px] rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl p-1.5 z-[80] space-y-0.5 text-right"
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

      {/* Currency Selector */}
      {activeCurr && onChangeCurrency && currOptions.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'curr' ? null : 'curr'))}
            title="Switch Currency / تغيير العملة"
            className={`${
              compact ? 'h-8 px-2 text-[11px]' : 'h-9 px-2.5 text-xs'
            } rounded-xl border font-black inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap ${btnBase}`}
          >
            <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{activeCurr.flag}</span>
            <span className="font-mono">{activeCurr.code}</span>
            <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
          </button>

          {openMenu === 'curr' && (
            <div
              role="menu"
              className="absolute top-full mt-1.5 right-0 min-w-[185px] max-h-72 overflow-y-auto rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl p-1.5 z-[80] space-y-0.5 text-right"
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
