import React from 'react';
import { UserProfile, ThemeMode } from '../../types';
import {
  Menu,
  Sun,
  Moon,
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
    <nav className="sticky top-0 z-40 flex items-center justify-between w-full px-3 sm:px-5 py-2.5 bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] shadow-2xs">
      {/* اليمين: شعار الورشة الديناميكي أو شعار المنظومة الرسمي */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={onGoHome} title={profile?.brandName || 'منظومة الشمساوية'}>
        {workshopLogo ? (
          <div className="flex items-center gap-2">
            <img
              src={workshopLogo}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-contain border border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC] dark:bg-[#132040] p-0.5 shadow-xs"
              alt={profile?.brandName || 'شعار الورشة'}
            />
            {profile?.brandName && (
              <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] hidden sm:inline-block max-w-[140px] truncate">
                {profile.brandName}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <AlShamsBrandLogo maxWidth={140} maxHeight={44} alt="منظومة الشمساوية" />
          </div>
        )}
      </div>

      {/* الوسط: زر الوصول المباشر للمتجر */}
      <div className="flex items-center gap-1.5 sm:gap-2">
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
            className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white border border-[#FDBA74]/50 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Store className="w-3.5 h-3.5 text-amber-100" />
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
          className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-300 flex items-center justify-center text-base transition cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#C2410C]" />}
        </button>
        {/* زر القائمة الجانبية ☰ المنسدلة */}
        <button
          onClick={onToggleSidebar}
          type="button"
          aria-label="القائمة الجانبية"
          className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#F7F3EA] to-[#E5DDD0] dark:from-[#1A294B] dark:to-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-400 flex items-center justify-center transition cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};
