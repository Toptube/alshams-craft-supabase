import React from 'react';
import { UserProfile, ThemeMode } from '../../types';
import {
  Menu,
  Sun,
  Moon,
  Store,
  Bell,
  Users,
} from 'lucide-react';
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
  onNavigateToFamily?: () => void;
  activeView?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  onToggleSidebar,
  onGoHome,
  onOpenNotifications,
  isDarkMode = false,
  onToggleTheme,
  onNavigateToCatalog,
  onOpenArtisanStore,
  onNavigateToFamily,
  activeView,
}) => {
  const workshopLogo = (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64;
  const hasAnyUnread = unreadNotificationsCount > 0 || unreadMessagesCount > 0;

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full box-border px-2 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] shadow-2xs overflow-x-clip">
      {/* اليمين: شعار الورشة الديناميكي أو شعار المنظومة الرسمي */}
      <div
        className="flex items-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 shrink-0"
        onClick={onGoHome}
        title={profile?.brandName || 'منظومة الشمساوية'}
      >
        {workshopLogo ? (
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={workshopLogo}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-contain border border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC] dark:bg-[#132040] p-0.5 shadow-xs shrink-0"
              alt={profile?.brandName || 'شعار الورشة'}
            />
            {profile?.brandName && (
              <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] hidden md:inline-block max-w-[140px] truncate">
                {profile.brandName}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center shrink-0">
            <AlShamsBrandIcon size="sm" className="sm:hidden" alt="منظومة الشمساوية" />
            <AlShamsBrandLogo
              maxWidth={120}
              maxHeight={40}
              className="hidden sm:block"
              alt="منظومة الشمساوية"
            />
          </div>
        )}
      </div>

      {/* الوسط: زر الوصول المباشر للمتجر وزر العيلة */}
      <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink">
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
            className="px-2 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white border border-[#FDBA74]/50 font-black text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shadow-sm whitespace-nowrap shrink-0"
          >
            <Store className="w-3.5 h-3.5 text-amber-100 shrink-0" />
            <span>متجري</span>
          </button>
        )}

        {onNavigateToFamily && (
          <button
            type="button"
            onClick={onNavigateToFamily}
            title="مجتمع عيلة الشمساويه"
            className={`px-2 sm:px-3.5 py-1.5 rounded-xl border font-black text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
              activeView === 'family'
                ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] dark:bg-[#FBBF24] dark:text-[#0C1427] dark:border-[#EA580C]'
                : 'bg-[#E9E2D4] hover:bg-[#DFD7C6] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#132040] dark:hover:bg-[#1A2B54] dark:text-[#F7F3EA] dark:border-[#22355E]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
            <span>العيلة</span>
          </button>
        )}
      </div>

      {/* اليسار: أيقونة جرس الإشعارات الموحدة (تضم عداد الإشعارات بالبرتقالي وعداد البريد بالأزرق/البيج) + تبديل الثيم + القائمة الجانبية */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label="الإشعارات ورسائل البريد"
          title="الإشعارات ورسائل البريد"
          className={`h-8 sm:h-9 ${
            hasAnyUnread ? 'px-1.5 sm:px-2.5' : 'w-8 sm:w-9 justify-center'
          } rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0`}
        >
          <Bell className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24] shrink-0" />
          {unreadNotificationsCount > 0 && (
            <span
              title={`${unreadNotificationsCount} إشعار غير مقروء`}
              className="min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-5 px-1 rounded-md bg-[#EA580C] text-white border border-[#C2410C] text-[10px] sm:text-[11px] font-mono tabular-nums font-black flex items-center justify-center leading-none shrink-0"
            >
              {unreadNotificationsCount}
            </span>
          )}
          {unreadMessagesCount > 0 && (
            <span
              title={`${unreadMessagesCount} رسالة بريد غير مقروءة`}
              className="min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-5 px-1 rounded-md bg-[#1E3A8A] text-white border border-[#172554] dark:bg-[#EDE3CF] dark:text-[#0C1427] dark:border-[#D4CCBC] text-[10px] sm:text-[11px] font-mono tabular-nums font-black flex items-center justify-center leading-none shrink-0"
            >
              {unreadMessagesCount}
            </span>
          )}
        </button>

        {/* زر تبديل الثيم المباشر */}
        <button
          onClick={onToggleTheme}
          type="button"
          aria-label="تبديل الثيم"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-300 flex items-center justify-center text-base transition cursor-pointer shrink-0"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#C2410C]" />}
        </button>

        {/* زر القائمة الجانبية ☰ المنسدلة */}
        <button
          onClick={onToggleSidebar}
          type="button"
          aria-label="القائمة الجانبية"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-b from-[#F7F3EA] to-[#E5DDD0] dark:from-[#1A294B] dark:to-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-400 flex items-center justify-center transition cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </nav>
  );
};
