import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, isUserAdmin, ThemeMode } from '../../types';
import {
  Menu,
  Search,
  Bell,
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
  Package,
  Store,
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
  onNavigateToCatalog?: (tab?: 'catalog' | 'store') => void;
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
  onOpenNewMaterialModal,
  onNavigateToCalculator,
  onOpenSupplierInvoice,
  onNavigateToSales,
  onOpenNewClientModal,
  onOpenNewEmployeeModal,
  onNavigateToCatalog,
  isDarkMode = false,
  onToggleTheme,
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

  // Live available liquidity balance
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
      {/* Responsive 3-zone header layout: [اللوجو يميناً] --- [زر متجري / الكتالوج في المنتصف] --- [زر القائمة + الثيم يساراً] */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        
        {/* 1. القسم الأيمن: اللوجو المعتمد للمنظومة بدون أي خلفيات صلبة أو براويز */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
          <button
            type="button"
            onClick={onGoHome}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white dark:bg-stone-850 hover:bg-amber-500/10 dark:hover:bg-stone-800 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-center active:scale-95 group shrink-0 select-none shadow-xs overflow-hidden"
            title="الرئيسية"
            aria-label="الرئيسية"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlShamsBrandIcon size="sm" />
            </div>
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="cursor-pointer transition hover:opacity-90 active:scale-98 select-none flex items-center"
            title="منظومة الشمساوية"
          >
            <AlShamsBrandLogo maxWidth={160} />
          </button>
        </div>

        {/* 2. القسم الأوسط: [الكتالوج 📦] و [متجري 🏪] */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-center">
          {onNavigateToCatalog && (
            <button
              type="button"
              onClick={() => onNavigateToCatalog('catalog')}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-stone-100 hover:bg-amber-50 dark:bg-stone-800 dark:hover:bg-amber-950/40 text-stone-800 dark:text-stone-200 hover:text-amber-700 dark:hover:text-amber-300 border border-stone-200 dark:border-stone-700 hover:border-amber-400 font-black text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="الكتالوج - استعراض وإدارة المشغولات"
              aria-label="الكتالوج"
            >
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
              <span>الكتالوج</span>
            </button>
          )}

          {onOpenArtisanStore && (
            <button
              type="button"
              onClick={onOpenArtisanStore}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-[#0c1427] hover:bg-[#131e38] text-amber-300 border border-amber-500/40 font-black text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="متجري - واجهة المتجر ورابط الزبائن"
              aria-label="متجري"
            >
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span>متجري</span>
            </button>
          )}

          {/* للمشرف العام فقط: زر سوق الشمساوية المركزي */}
          {isUserAdmin(profile) && onNavigateToMarketplace && (
            <button
              type="button"
              onClick={onNavigateToMarketplace}
              className="hidden lg:inline-flex px-2.5 py-1.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 font-black text-xs items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
              title="تصفح سوق الشمساوية المركزي (/#/market)"
              aria-label="سوق الشمساوية"
            >
              <span className="text-sm">🛍️</span>
              <span className="font-black">سوق الشمساوية</span>
            </button>
          )}
        </div>

        {/* 3. القسم الأيسر: الإشعارات + البحث + السمة + القائمة */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* مؤشر السيولة الحية المتاحة (يظهر فقط على الشاشات الكبيرة لمنع الزحام) */}
          <div
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold shadow-2xs select-none"
            title="صافي السيولة النقدية الحية المتاحة بالخزائن والمحافظ الآن"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
              {liveTreasuryBalance.toLocaleString()} {profile.currencySymbol || 'ج.م'}
            </span>
          </div>

          {/* حالة الاتصال السحابي */}
          <ConnectionStatus hasActiveSession={hasActiveSession} />

          {/* البحث الموحد */}
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
            title={tr('global_search_tooltip')}
            aria-label={tr('search')}
          >
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
          </button>

          {/* زر التنبيهات الموحد */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
            title="مركز التنبيهات"
            aria-label="مركز التنبيهات"
          >
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-700 dark:text-stone-300" />
            {(unreadNotificationsCount > 0 || unreadMessagesCount > 0) && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 bg-amber-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {(unreadNotificationsCount + unreadMessagesCount) > 99 ? '+99' : (unreadNotificationsCount + unreadMessagesCount)}
              </span>
            )}
          </button>

          {/* زر الإنشاء السريع */}
          <div className="relative shrink-0" ref={quickCreateRef}>
            <button
              type="button"
              onClick={() => setIsQuickCreateMenuOpen(!isQuickCreateMenuOpen)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-2xl transition cursor-pointer flex items-center justify-center border shadow-xs active:scale-95 ${
                isQuickCreateMenuOpen
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80'
              }`}
              title={tr('quick_create')}
              aria-label={tr('quick_create')}
            >
              <PlusCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isQuickCreateMenuOpen ? 'rotate-45 text-white' : 'text-amber-600 dark:text-amber-400'}`} />
            </button>

            {isQuickCreateMenuOpen && (
              <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-64 sm:w-72 bg-[#fffdf5] dark:bg-[#070e1e] border-2 border-amber-500/50 dark:border-amber-500/60 rounded-3xl p-3 shadow-2xl z-50 animate-in fade-in space-y-2">
                <div className="px-2 py-1 border-b border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between">
                  <span className="text-xs font-black text-[#0c1427] dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{tr('quick_create')}</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
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
                        className="p-2 rounded-xl bg-[#fdf6e7] hover:bg-[#f7ebd0] dark:bg-[#0c1427] dark:hover:bg-[#121d3a] border border-amber-300/80 dark:border-amber-500/30 text-right transition flex items-center gap-2 cursor-pointer group active:scale-95"
                      >
                        <Icon className={`w-3.5 h-3.5 ${action.color} shrink-0`} />
                        <span className="text-[11px] font-black text-[#0c1427] dark:text-white truncate">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* زر تبديل الوضع الليلي / النهاري */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
              title={isDarkMode ? 'التبديل إلى الوضع النهاري ☀️' : 'التبديل إلى الوضع الليلي 🌙'}
              aria-label="تبديل مظهر الواجهة"
            >
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-900" />
              )}
            </button>
          )}

          {/* زر فتح القائمة الجانبية */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer flex items-center justify-center border border-stone-200 dark:border-stone-700/80 shadow-xs active:scale-95 shrink-0"
            aria-label={tr('main_menu')}
            title={tr('main_menu')}
          >
            <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
