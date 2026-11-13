import React, { useState } from 'react';
import { ArtisanAvatar } from '../brand/BrandAssets';
import { UserProfile, isUserAdmin, ThemeMode } from '../../types';
import {
  X,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  BookOpen,
  CloudUpload,
  Layers,
  Settings,
  Eye,
  MessageSquare,
  RefreshCw,
  ShoppingBag,
  Globe,
  Sparkles,
  Zap,
  Bell,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  activeView: string;
  onSelectView: (view: string) => void;
  onNavigateToCatalog?: (tab?: 'catalog' | 'store') => void;
  onOpenArtisanStore?: () => void;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  onOpenNotifications: () => void;
  onOpenMessagesHub?: () => void;
  onOpenProfileSettings: () => void;
  onOpenCraftsSelector: () => void;
  onOpenUserGuide: (sectionId?: string) => void;
  onOpenCloudMigration: () => void;
  onOpenSupport?: () => void;
  onStartTour?: () => void;
  onOpenPermissionsModal?: () => void;
  onToggleDarkMode: () => void;
  isDarkMode: boolean;
  themeMode?: ThemeMode;
  onSelectThemeMode?: (mode: ThemeMode) => void;
  isPerformanceMode?: boolean;
  onTogglePerformanceMode?: (enabled?: boolean) => void;
  onLogout: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  profile,
  activeView,
  onSelectView,
  onNavigateToCatalog,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  onOpenNotifications,
  onOpenProfileSettings,
  onOpenCraftsSelector,
  onOpenUserGuide,
  onOpenCloudMigration,
  onOpenSupport,
  onStartTour,
  onToggleDarkMode,
  isDarkMode,
  themeMode = 'light',
  onSelectThemeMode,
  isPerformanceMode,
  onTogglePerformanceMode,
  onLogout,
}) => {
  const { t: tr } = useTranslation();
  const [isGearModalOpen, setIsGearModalOpen] = useState(false);

  const [localPerfMode, setLocalPerfMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('alshams_performance_mode') === 'true';
    } catch {
      return false;
    }
  });

  const activePerfMode = isPerformanceMode !== undefined ? isPerformanceMode : localPerfMode;

  const handlePerfToggle = () => {
    if (onTogglePerformanceMode) {
      onTogglePerformanceMode();
    } else {
      setLocalPerfMode((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('alshams_performance_mode', String(next));
        } catch {}
        window.dispatchEvent(new CustomEvent('alshams_toggle_performance_mode', { detail: { enabled: next } }));
        return next;
      });
    }
  };

  if (!isOpen) return null;

  const workshopLogo = (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64;
  const isAdmin = isUserAdmin(profile);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-stone-900 w-full max-w-xs sm:max-w-sm h-full shadow-2xl border-l border-stone-200 dark:border-stone-800 flex flex-col text-right animate-in slide-in-from-right duration-300 relative">
        {/* 1. تنظيف الهيدر العلوي للقائمة: [ لوجو الورشة واسم الحرفي + أيقونة الترس ⚙️ للإعدادات + زر الإغلاق ✕ ] */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2 bg-stone-50/80 dark:bg-stone-900">
          <div className="flex items-center gap-2.5 min-w-0">
            {workshopLogo ? (
              <img
                src={workshopLogo}
                alt={profile.brandName || profile.artistName || 'شعار الورشة'}
                className="h-10 w-10 rounded-xl object-contain border border-amber-500/30 bg-white dark:bg-stone-800 p-0.5 shadow-2xs shrink-0"
              />
            ) : (
              <ArtisanAvatar
                logoUrl={profile.logoBase64}
                artistName={profile.artistName}
                size="md"
                className="shrink-0"
              />
            )}
            <div className="min-w-0 text-right">
              <h4 className="font-black text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                {profile.artistName || 'فنان الشمساوية'}
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold truncate">
                {profile.brandName || 'منظومة الشمساوية'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsGearModalOpen(true)}
              aria-label="إعدادات الورشة والمظهر"
              title="الإعدادات وأقسام الورشة والمظهر"
              className="p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-amber-400 text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer shadow-2xs active:scale-95"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق القائمة"
              title="إغلاق"
              className="p-2 rounded-xl hover:bg-stone-200/70 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3. الترتيب الأوسط للقائمة: روابط التنقل الأساسية للورشة فقط بشكل بسيط وسلس */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {/* منصتي (الكتالوج والمتجر) */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateToCatalog) {
                onNavigateToCatalog('catalog');
              } else {
                onSelectView('catalog');
              }
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-right cursor-pointer shadow-2xs group ${
              activeView === 'catalog'
                ? 'bg-gradient-to-l from-amber-500 to-amber-600 text-white border-amber-400 shadow-md'
                : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 hover:border-amber-400 text-stone-900 dark:text-stone-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeView === 'catalog'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                }`}
              >
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-black block">منصتي (الكتالوج والمتجر) 🌐</span>
                <span
                  className={`text-[11px] block ${
                    activeView === 'catalog' ? 'text-amber-100' : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  إدارة الكتالوج المرجعي ومتجر الورشة
                </span>
              </div>
            </div>
            <ChevronLeft
              className={`w-4 h-4 transition-transform group-hover:-translate-x-0.5 ${
                activeView === 'catalog' ? 'text-white' : 'text-stone-400'
              }`}
            />
          </button>

          {/* التبديل بين الورش */}
          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                onSelectView('admin');
              } else {
                onOpenProfileSettings();
              }
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-right cursor-pointer shadow-2xs group ${
              activeView === 'admin'
                ? 'bg-gradient-to-l from-blue-600 to-indigo-700 text-white border-blue-400 shadow-md'
                : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 hover:border-blue-400 text-stone-900 dark:text-stone-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeView === 'admin'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                }`}
              >
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-black block">التبديل بين الورش 🔄</span>
                <span
                  className={`text-[11px] block ${
                    activeView === 'admin' ? 'text-blue-100' : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  {isAdmin ? 'إدارة المنظومة والتبديل بين حسابات الورش' : 'مراجعة حساب الورشة والربط السحابي'}
                </span>
              </div>
            </div>
            <ChevronLeft
              className={`w-4 h-4 transition-transform group-hover:-translate-x-0.5 ${
                activeView === 'admin' ? 'text-white' : 'text-stone-400'
              }`}
            />
          </button>

          {/* سوق الشمساوية المركزي */}
          <button
            type="button"
            onClick={() => {
              onSelectView('marketplace');
              onClose();
            }}
            className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-right cursor-pointer shadow-2xs group ${
              activeView === 'marketplace'
                ? 'bg-gradient-to-l from-emerald-600 to-teal-700 text-white border-emerald-400 shadow-md'
                : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 hover:border-emerald-400 text-stone-900 dark:text-stone-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeView === 'marketplace'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-black block">سوق الشمساوية 🛍️</span>
                <span
                  className={`text-[11px] block ${
                    activeView === 'marketplace' ? 'text-emerald-100' : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  عرض منتجات جميع الورش الحرفية
                </span>
              </div>
            </div>
            <ChevronLeft
              className={`w-4 h-4 transition-transform group-hover:-translate-x-0.5 ${
                activeView === 'marketplace' ? 'text-white' : 'text-stone-400'
              }`}
            />
          </button>

          {/* مركز الإشعارات والرسائل */}
          <button
            type="button"
            onClick={() => {
              onOpenNotifications();
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 bg-white dark:bg-stone-850 text-stone-900 dark:text-stone-100 transition-all flex items-center justify-between text-right cursor-pointer shadow-2xs group"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount + unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">
                    {unreadNotificationsCount + unreadMessagesCount}
                  </span>
                )}
              </div>
              <div>
                <span className="text-sm font-black block">الإشعارات والتنبيهات 🔔</span>
                <span className="text-[11px] block text-stone-500 dark:text-stone-400">
                  تنبيهات الطلبات والمخزون ورسائل الإدارة
                </span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-stone-400 transition-transform group-hover:-translate-x-0.5" />
          </button>
        </nav>

        {/* 4. شريط أدوات سفلي مدمج وأنيق (Bottom Icon Bar): 5 أيقونات فقط */}
        <div className="p-3 border-t border-stone-100 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-900">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => {
                onOpenUserGuide();
                onClose();
              }}
              title="دليل الورشة"
              aria-label="دليل الورشة"
              className="flex-1 py-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-amber-400 text-amber-600 dark:text-amber-400 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onStartTour) onStartTour();
                onClose();
              }}
              title="الجولة التعريفية"
              aria-label="الجولة التعريفية"
              className="flex-1 py-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-amber-400 text-stone-700 dark:text-stone-300 hover:text-amber-600 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenCloudMigration();
                onClose();
              }}
              title="النسخ والرفع للسحاب"
              aria-label="النسخ والرفع للسحاب"
              className="flex-1 py-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-blue-400 text-blue-600 dark:text-blue-400 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
            >
              <CloudUpload className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenSupport) onOpenSupport();
                onClose();
              }}
              title="الدعم الفني والشكاوى"
              aria-label="الدعم الفني والشكاوى"
              className="flex-1 py-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-emerald-400 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              className="flex-1 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. نافذة الإعدادات المنبثقة عند الضغط على أيقونة الترس ⚙️ */}
        {isGearModalOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            dir="rtl"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsGearModalOpen(false);
            }}
          >
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-4 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-850">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    إعدادات الورشة والمظهر
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGearModalOpen(false)}
                  aria-label="إغلاق نافذة الإعدادات"
                  className="p-1.5 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* 1. إعدادات الورشة والبراند */}
                <button
                  type="button"
                  onClick={() => {
                    setIsGearModalOpen(false);
                    onOpenProfileSettings();
                    onClose();
                  }}
                  className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-stone-200 dark:border-stone-700 hover:border-amber-400 flex items-center justify-between text-right transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-stone-900 dark:text-stone-100 block">
                        إعدادات الورشة والبراند
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                        الشعار، البيانات التجارية، والعملة
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-stone-400" />
                </button>

                {/* 2. أقسام الورشة وتخصيصها */}
                <button
                  type="button"
                  onClick={() => {
                    setIsGearModalOpen(false);
                    onOpenCraftsSelector();
                    onClose();
                  }}
                  className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-stone-200 dark:border-stone-700 hover:border-amber-400 flex items-center justify-between text-right transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-stone-900 dark:text-stone-100 block">
                        أقسام الورشة وتخصيصها
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                        {tr('workshop_crafts')} والأنشطة الحرفية
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-stone-400" />
                </button>

                {/* 3. مفتاح تبديل الوضع (نهاري / ليلي) */}
                <div className="p-3 rounded-2xl bg-stone-950 text-white border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>مظهر الورشة والوضع</span>
                    </span>
                    <button
                      type="button"
                      onClick={onToggleDarkMode}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
                    >
                      {isDarkMode ? 'تبديل للنهاري ☀️' : 'تبديل لليلي 🌙'}
                    </button>
                  </div>

                  {onSelectThemeMode && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectThemeMode('light')}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                          themeMode === 'light'
                            ? 'bg-amber-600 text-white border border-amber-400'
                            : 'bg-stone-900 text-amber-200 hover:bg-stone-800 border border-stone-700'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>نهاري</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectThemeMode('night_focus')}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                          themeMode === 'night_focus'
                            ? 'bg-amber-600 text-white border border-amber-400'
                            : 'bg-stone-900 text-amber-200 hover:bg-stone-800 border border-stone-700'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>سهر هادئ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectThemeMode('dark')}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                          themeMode === 'dark'
                            ? 'bg-amber-600 text-white border border-amber-400'
                            : 'bg-stone-900 text-amber-200 hover:bg-stone-800 border border-stone-700'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>داكن</span>
                      </button>
                    </div>
                  )}

                  {/* وضع الأداء السريع */}
                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-stone-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>وضع الأداء السريع</span>
                    </span>
                    <button
                      type="button"
                      onClick={handlePerfToggle}
                      aria-label="تبديل وضع الأداء السريع"
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                        activePerfMode ? 'bg-amber-500' : 'bg-stone-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          activePerfMode ? '-translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* لغة المنظومة */}
                <div className="p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700">
                  <LanguageSwitcher onOpenSettingsModal={() => {
                    setIsGearModalOpen(false);
                    onOpenProfileSettings();
                    onClose();
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
