import React from 'react';
import { UserProfile, ThemeMode } from '../../types';
import {
  Menu,
  Sun,
  Moon,
  Package,
  Store,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
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
  onToggleSidebar,
  onGoHome,
  isDarkMode = false,
  onToggleTheme,
  onNavigateToCatalog,
  onOpenArtisanStore,
}) => {
  const workshopLogo = (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64;

  return (
    <nav className="flex items-center justify-between w-full px-3 sm:px-4 py-2 bg-transparent z-50">
      {/* اليمين: شعار الورشة الديناميكي أو شعار المنظومة الرسمي */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={onGoHome} title={profile?.brandName || 'منظومة الشمساوية'}>
        {workshopLogo ? (
          <div className="flex items-center gap-2">
            <img
              src={workshopLogo}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-contain border border-amber-500/30 bg-white dark:bg-stone-900 p-0.5 shadow-xs"
              alt={profile?.brandName || 'شعار الورشة'}
            />
            {profile?.brandName && (
              <span className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 hidden sm:inline-block max-w-[130px] truncate">
                {profile.brandName}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <img src="/platform-logo-light.png" className="h-8 sm:h-9 w-auto dark:hidden" alt="منظومة الشمساوية" />
            <img src="/platform-logo-dark.png" className="h-8 sm:h-9 w-auto hidden dark:block" alt="منظومة الشمساوية" />
          </div>
        )}
      </div>

      {/* الوسط: أزرار الوصول المباشر (الكتالوج ومتجري) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {onNavigateToCatalog && (
          <button
            type="button"
            onClick={() => onNavigateToCatalog('catalog')}
            title="الكتالوج المرجعي وإدارة المشغولات"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-amber-50 dark:bg-stone-850 dark:hover:bg-amber-950/40 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>الكتالوج 📦</span>
          </button>
        )}
        {(onOpenArtisanStore || onNavigateToCatalog) && (
          <button
            type="button"
            onClick={() => {
              if (onOpenArtisanStore) {
                onOpenArtisanStore();
              } else if (onNavigateToCatalog) {
                onNavigateToCatalog('store');
              }
            }}
            title="متجري الخاص وطلبات الزبائن"
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#0c1427] hover:bg-[#131e38] text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <span>متجري 🏪</span>
          </button>
        )}
      </div>

      {/* اليسار: زر تبديل الثيم وزر القائمة الجانبية ☰ */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* زر تبديل الثيم المباشر */}
        <button
          onClick={onToggleTheme}
          type="button"
          aria-label="تبديل الثيم"
          className="p-2 rounded-full hover:bg-white/10 text-amber-500 text-lg transition cursor-pointer"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        {/* زر القائمة الجانبية ☰ المنسدلة */}
        <button
          onClick={onToggleSidebar}
          type="button"
          aria-label="القائمة الجانبية"
          className="p-2 text-2xl text-amber-500 hover:text-amber-600 transition cursor-pointer leading-none active:scale-95"
        >
          ☰
        </button>
      </div>
    </nav>
  );
};
