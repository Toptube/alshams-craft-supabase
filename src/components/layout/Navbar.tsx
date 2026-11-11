import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, isUserAdmin, ThemeMode } from '../../types';
import {
  Menu,
  Search,
  Bell,
  Mail,
  PlusCircle,
  PackagePlus,
  Calculator,
  Receipt,
  ShoppingCart,
  UserPlus,
  Users2,
  Sparkles,
  Wallet,
  Sun,
  Moon,
} from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import { useTranslation } from '../../lib/i18n';
import { tenantStorage } from '../../db/dexieDB';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';
import { AlShamsBrandIcon, AlShamsBrandLogo } from '../brand/BrandAssets';

export interface NavbarProps {
  profile: UserProfile;
  hasActiveSession?: boolean;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  onToggleSidebar: () => void;
  onOpenGlobalSearch: () => void;
  onGoHome: () => void;
  onOpenNotifications: () => void;
  onOpenMessagesHub?: () => void;
  // Quick creation actions
  onOpenNewMaterialModal?: () => void;
  onNavigateToCalculator?: () => void;
  onOpenSupplierInvoice?: () => void;
  onNavigateToSales?: () => void;
  onOpenNewClientModal?: () => void;
  onOpenNewEmployeeModal?: () => void;
  // Theme mode
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  themeMode?: ThemeMode;
  onSelectThemeMode?: (mode: ThemeMode) => void;
  onNavigateToMarketplace?: () => void;
  onOpenArtisanStore?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  hasActiveSession,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  onToggleSidebar,
  onOpenGlobalSearch,
  onGoHome,
  onOpenNotifications,
  onOpenMessagesHub,
  onOpenNewMaterialModal,
  onNavigateToCalculator,
  onOpenSupplierInvoice,
  onNavigateToSales,
  onOpenNewClientModal,
  onOpenNewEmployeeModal,
  isDarkMode = false,
  onToggleTheme,
  themeMode = 'light',
  onSelectThemeMode,
  onNavigateToMarketplace,
  onOpenArtisanStore,
}) => {
  const { t: tr } = useTranslation();
  const [isQuickCreateMenuOpen, setIsQuickCreateMenuOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(event.target as Node)) {
        setIsQuickCreateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live available liquidity balance (تحديث لحظي بدون إعادة تحميل الصفحة)
  const [liveTreasuryBalance, setLiveTreasuryBalance] = useState<number>(0);
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';

  useEffect(() => {
    let isMounted = true;
    const fetchLiveBalance = async () => {
      if (!workshopId) return;
      try {
        const { data: supaTreasuries } = await getTreasuryBalancesFromSupabase(workshopId).catch(() => ({ data: null }));
        if (supaTreasuries && supaTreasuries.length > 0) {
          const sum = supaTreasuries.reduce((acc, t) => acc + (Number(t.balance) || 0), 0);
          if (isMounted) setLiveTreasuryBalance(Math.round(sum));
        } else {
          const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
          if (isMounted) setLiveTreasuryBalance(Math.round((safe.mainSafe || 0) + (safe.subSafe || 0)));
        }
      } catch {
        const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
        if (isMounted) setLiveTreasuryBalance(Math.round((safe.mainSafe || 0) + (safe.subSafe || 0)));
      }
    };

    fetchLiveBalance();

    window.addEventListener('alshams_treasury_updated', fetchLiveBalance);
    window.addEventListener('alshams_financials_updated', fetchLiveBalance);
    return () => {
      isMounted = false;
      window.removeEventListener('alshams_treasury_updated', fetchLiveBalance);
      window.removeEventListener('alshams_financials_updated', fetchLiveBalance);
    };
  }, [workshopId]);

  const quickActions = [
    {
      label: tr('quick_add_material'),
      icon: PackagePlus,
      color: 'text-amber-600 dark:text-amber-400',
      action: onOpenNewMaterialModal,
    },
    {
      label: tr('quick_calc_product'),
      icon: Calculator,
      color: 'text-orange-600 dark:text-orange-400',
      action: onNavigateToCalculator,
    },
    {
      label: tr('quick_supplier_invoice'),
      icon: Receipt,
      color: 'text-blue-600 dark:text-blue-400',
      action: onOpenSupplierInvoice,
    },
    {
      label: tr('quick_sales_order'),
      icon: ShoppingCart,
      color: 'text-emerald-600 dark:text-emerald-400',
      action: onNavigateToSales,
    },
    {
      label: tr('quick_add_customer'),
      icon: UserPlus,
      color: 'text-teal-600 dark:text-teal-400',
      action: onOpenNewClientModal,
    },
    {
      label: tr('quick_hire_employee'),
      icon: Users2,
      color: 'text-violet-600 dark:text-violet-400',
      action: onOpenNewEmployeeModal,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* القسم الأيمن: زر القائمة + اللوجو الأيقوني + علامة الإشعارات + علامة مركز الإنشاء السريع */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* 1. زر القائمة الجانبية (أيقونة نقية مع تلميح) */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer flex items-center justify-center border border-stone-200 dark:border-stone-700/80 shadow-xs active:scale-95 shrink-0"
            aria-label={tr('main_menu')}
            title={tr('main_menu')}
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
          </button>

          {/* 2. اللوجو المربع المتجاوب مع السمة (صقر الشمس كرافت) */}
          <button
            type="button"
            onClick={onGoHome}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white dark:bg-stone-850 hover:bg-amber-500/10 dark:hover:bg-stone-800 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-center active:scale-95 group shrink-0 select-none shadow-xs overflow-hidden"
            title={tr('home_screen')}
            aria-label={tr('app_name')}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlShamsBrandIcon size="sm" />
            </div>
          </button>

          {/* اللوجو النصي الكامل المتجاوب حسب السمة (لا يتجاوز 150px) */}
          <button
            type="button"
            onClick={onGoHome}
            className="hidden md:inline-flex items-center cursor-pointer transition hover:opacity-90 active:scale-98 select-none"
            title={tr('home_screen')}
          >
            <AlShamsBrandLogo maxWidth={145} />
          </button>

          {/* 3. مركز التنبيهات الموحد (Unified Bell with Dual Badges for Operational & Store Messages) */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition-all duration-150 cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
            title="مركز التنبيهات والمراسلات الموحد (إشعارات تشغيلية ورسائل العملاء)"
            aria-label="مركز التنبيهات"
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-stone-700 dark:text-stone-300" />

            {/* Badges: Orange for Operational Notifications, Emerald for Customer/Store Messages */}
            {unreadNotificationsCount > 0 && unreadMessagesCount === 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 bg-amber-600 text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadNotificationsCount > 99 ? '+99' : unreadNotificationsCount}
              </span>
            )}

            {unreadMessagesCount > 0 && unreadNotificationsCount === 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 bg-emerald-600 text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadMessagesCount > 99 ? '+99' : unreadMessagesCount}
              </span>
            )}

            {unreadNotificationsCount > 0 && unreadMessagesCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5">
                <span
                  className="min-w-[14px] h-[14px] px-0.5 bg-amber-600 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-xs"
                  title="إشعارات تشغيلية"
                >
                  {unreadNotificationsCount}
                </span>
                <span
                  className="min-w-[14px] h-[14px] px-0.5 bg-emerald-600 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-xs"
                  title="رسائل العملاء"
                >
                  {unreadMessagesCount}
                </span>
              </div>
            )}
          </button>

          {/* 4. علامة مركز الإنشاء السريع (أيقونة فقط مع ظهور التسمية عند المرور) */}
          <div className="relative shrink-0" ref={quickCreateRef}>
            <button
              type="button"
              onClick={() => setIsQuickCreateMenuOpen(!isQuickCreateMenuOpen)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl transition-all duration-150 cursor-pointer flex items-center justify-center border shadow-xs active:scale-95 ${
                isQuickCreateMenuOpen
                  ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/30'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80'
              }`}
              title={tr('quick_create')}
              aria-label={tr('quick_create')}
              aria-expanded={isQuickCreateMenuOpen}
            >
              <PlusCircle
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-200 ${
                  isQuickCreateMenuOpen
                    ? 'rotate-45 text-white'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              />
            </button>

            {/* قائمة الاختصارات السريعة المنبثقة من الزر */}
            {isQuickCreateMenuOpen && (
              <div className="absolute top-full mt-2.5 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-72 sm:w-80 bg-[#fffdf5] dark:bg-[#070e1e] border-2 border-amber-500/50 dark:border-amber-500/60 rounded-3xl p-3.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2">
                <div className="px-2 py-1.5 border-b border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between">
                  <span className="text-xs font-black text-[#0c1427] dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{tr('quick_create')}</span>
                  </span>
                  <span className="text-[10px] text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 font-extrabold">
                    {tr('instant_action')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIsQuickCreateMenuOpen(false);
                          if (action.action) action.action();
                        }}
                        className="p-2.5 rounded-2xl bg-[#fdf6e7] hover:bg-[#f7ebd0] dark:bg-[#0c1427] dark:hover:bg-[#121d3a] border border-amber-300/80 dark:border-amber-500/30 hover:border-amber-500 text-right transition flex items-center gap-2.5 cursor-pointer group active:scale-95 shadow-2xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-400/40 dark:border-amber-500/40 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                          <Icon className={`w-4 h-4 ${action.color}`} />
                        </div>
                        <span className="text-xs font-black text-[#0c1427] dark:text-white group-hover:text-amber-800 dark:group-hover:text-amber-300 leading-snug">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Golden Royal Badge for Super Admin */}
          {isUserAdmin(profile) && (
            <div className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-600/20 border border-amber-400/60 shadow-xs shadow-amber-500/20 text-amber-950 dark:text-amber-200 text-[11px] font-black select-none animate-in fade-in">
              <span className="text-sm">👑</span>
              <span>كبير عيلة الشمساوية</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-600 text-white font-mono uppercase tracking-wider">
                Super Admin
              </span>
            </div>
          )}

          {/* مؤشر صافي السيولة الحية لورشتنا (تحديث فوري بدون إعادة تحميل) */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold shadow-2xs select-none"
            title="صافي السيولة النقدية الحية المتاحة بالخزائن والمحافظ الآن"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[10px] text-stone-500 dark:text-stone-400">السيولة الحية:</span>
            <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
              {liveTreasuryBalance.toLocaleString()} {profile.currencySymbol || 'ج.م'}
            </span>
          </div>
        </div>

        {/* القسم الأيسر: مؤشر حالة الاتصال السحابي + البحث الموحد + محول اللغات (متباعدة تماماً وبدون أي تداخل) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* زر سوق الشمساوية المركزي (مخصص حصرياً للسوبر أدمن فقط) */}
          {isUserAdmin(profile) && onNavigateToMarketplace && (
            <button
              type="button"
              onClick={onNavigateToMarketplace}
              className="px-2 sm:px-3 py-1.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 font-black text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition active:scale-95 cursor-pointer shadow-xs shrink-0"
              title="تصفح سوق الشمساوية المركزي (/#/market)"
              aria-label="سوق الشمساوية"
            >
              <span className="text-sm">🛍️</span>
              <span className="font-black">سوق الشمساوية</span>
            </button>
          )}

          {/* زر متجر الورشة */}
          {onOpenArtisanStore && (
            <button
              type="button"
              onClick={onOpenArtisanStore}
              className="px-2 sm:px-3 py-1.5 rounded-2xl bg-[#0c1427] hover:bg-[#131e38] text-amber-300 border border-amber-500/40 font-black text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition active:scale-95 cursor-pointer shadow-xs shrink-0"
              title="فتح متجر الورشة النظيف والطلبيات (/#/store/:cleanSlug)"
              aria-label="متجري"
            >
              <span className="text-sm">🏪</span>
              <span className="font-black">متجري</span>
            </button>
          )}

          {/* مكون حالة الاتصال بنبضات بصرية ملونة */}
          <ConnectionStatus hasActiveSession={hasActiveSession} />

          {/* البحث الموحد الخفيف */}
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
            title={tr('global_search_tooltip')}
            aria-label={tr('search')}
          >
            <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-600 dark:text-amber-400" />
          </button>

          {/* زر التبديل المباشر بين الوضع النهاري والليلي */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
              title={isDarkMode ? 'التبديل إلى الوضع النهاري ☀️' : 'التبديل إلى الوضع الليلي 🌙'}
              aria-label="تبديل مظهر الواجهة"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-900" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
