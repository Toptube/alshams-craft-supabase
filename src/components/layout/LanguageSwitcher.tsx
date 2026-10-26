import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Check,
  ChevronDown,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  LanguageCode,
  LanguageInfo,
  getStoredLanguage,
  setStoredLanguage,
  getStoredQuickLanguages,
  setStoredQuickLanguages,
  t,
} from '../../lib/i18n';

interface LanguageSwitcherProps {
  onOpenSettingsModal?: () => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ onOpenSettingsModal }) => {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getStoredLanguage());
  const [quickLangs, setQuickLangs] = useState<LanguageCode[]>(getStoredQuickLanguages());
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [tempQuickLangs, setTempQuickLangs] = useState<LanguageCode[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state on events
  useEffect(() => {
    const handleLangChange = (e: any) => {
      if (e.detail?.lang) {
        setCurrentLang(e.detail.lang);
      }
    };
    const handleQuickChange = (e: any) => {
      if (e.detail?.langs) {
        setQuickLangs(e.detail.langs);
      }
    };

    window.addEventListener('alshams_language_changed', handleLangChange);
    window.addEventListener('alshams_quick_languages_changed', handleQuickChange);

    return () => {
      window.removeEventListener('alshams_language_changed', handleLangChange);
      window.removeEventListener('alshams_quick_languages_changed', handleQuickChange);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = (code: LanguageCode) => {
    setStoredLanguage(code);
    setCurrentLang(code);
    setIsOpen(false);
  };

  const handleOpenCustomize = () => {
    setTempQuickLangs([...quickLangs]);
    setIsOpen(false);
    setIsCustomizeModalOpen(true);
  };

  const handleToggleTempQuick = (code: LanguageCode) => {
    if (tempQuickLangs.includes(code)) {
      if (tempQuickLangs.length <= 2) {
        // Minimum 2
        return;
      }
      setTempQuickLangs(tempQuickLangs.filter((c) => c !== code));
    } else {
      if (tempQuickLangs.length >= 3) {
        // Replace oldest or limit to 3
        const updated = [...tempQuickLangs.slice(1), code];
        setTempQuickLangs(updated);
      } else {
        setTempQuickLangs([...tempQuickLangs, code]);
      }
    }
  };

  const handleSaveCustomize = () => {
    if (tempQuickLangs.length >= 2) {
      setStoredQuickLanguages(tempQuickLangs);
      setQuickLangs(tempQuickLangs);
    }
    setIsCustomizeModalOpen(false);
  };

  const primaryLanguages = SUPPORTED_LANGUAGES.filter((l) => l.isPrimary);
  const otherLanguages = SUPPORTED_LANGUAGES.filter((l) => !l.isPrimary);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Single Iconic Language Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-center shadow-xs active:scale-95 ${
          isOpen
            ? 'bg-amber-600 text-white border-amber-600'
            : 'border-stone-200 dark:border-stone-700/80 bg-white/90 dark:bg-stone-850 hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-amber-400'
        }`}
        title={t('select_language', currentLang)}
        aria-label={t('language', currentLang)}
        aria-expanded={isOpen}
      >
        <Globe className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors ${isOpen ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
      </button>

      {/* Language Selection Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 sm:left-0 sm:right-auto w-72 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-right space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="text-xs font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-amber-600" />
              <span>{t('select_language', currentLang)}</span>
            </span>
            <button
              type="button"
              onClick={handleOpenCustomize}
              className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              title={t('customize_languages', currentLang)}
            >
              <Settings2 className="w-3 h-3" />
              <span>{t('quick_switch', currentLang)}</span>
            </button>
          </div>

          {/* Primary Languages Section */}
          <div className="space-y-1">
            <div className="text-[10px] font-black text-stone-400 dark:text-stone-500 px-1">
              {t('primary_languages', currentLang)}
            </div>
            <div className="space-y-0.5">
              {primaryLanguages.map((lang) => {
                const isSelected = currentLang === lang.code;
                const isQuick = quickLangs.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white font-black shadow-xs'
                        : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{lang.flag}</span>
                      <div className="text-right">
                        <span>{lang.nativeName}</span>
                        <span
                          className={`text-[10px] ml-1.5 ${
                            isSelected ? 'text-amber-100' : 'text-stone-400'
                          }`}
                        >
                          ({lang.name})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isQuick && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
                            isSelected
                              ? 'bg-amber-700/60 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                          }`}
                        >
                          {t('quick_badge', currentLang)}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Other Languages Section */}
          <div className="space-y-1 pt-1 border-t border-stone-100 dark:border-stone-800">
            <div className="text-[10px] font-black text-stone-400 dark:text-stone-500 px-1">
              {t('other_languages', currentLang)}
            </div>
            <div className="space-y-0.5">
              {otherLanguages.map((lang) => {
                const isSelected = currentLang === lang.code;
                const isQuick = quickLangs.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white font-black shadow-xs'
                        : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{lang.flag}</span>
                      <div className="text-right">
                        <span>{lang.nativeName}</span>
                        <span
                          className={`text-[10px] ml-1.5 ${
                            isSelected ? 'text-amber-100' : 'text-stone-400'
                          }`}
                        >
                          ({lang.name})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isQuick && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
                            isSelected
                              ? 'bg-amber-700/60 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                          }`}
                        >
                          {t('quick_badge', currentLang)}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Customize Quick-Switch Languages */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                  {t('customize_languages', currentLang)}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {t('quick_switch_desc', currentLang)} (2 إلى 3 لغات)
                </p>
              </div>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isChecked = tempQuickLangs.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleToggleTempQuick(lang.code)}
                    className={`w-full p-2.5 rounded-2xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      isChecked
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        : 'border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{lang.flag}</span>
                      <div className="text-right">
                        <span className="block font-black">{lang.nativeName}</span>
                        <span className="text-[10px] text-stone-400 block">{lang.name}</span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-stone-100 dark:border-stone-800">
              <span>{t('selected_languages_count', currentLang)} {tempQuickLangs.length} {t('of', currentLang)} 3</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustomize}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs cursor-pointer"
                >
                  {t('save', currentLang)}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomizeModalOpen(false)}
                  className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 cursor-pointer"
                >
                  {t('cancel', currentLang)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
