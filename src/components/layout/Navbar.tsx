import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, ThemeMode } from '../../types';
import {
  Menu,
  Sun,
  Moon,
  Store,
  Bell,
  Users,
  Mail,
  Building2,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react';
import { AlShamsBrandIcon, AlShamsBrandLogo } from '../brand/BrandAssets';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { useFeatureFlags } from '../../types/featureFlags';

export type AdminBellSectionId = 'notif_messages' | 'notif_workshops' | 'notif_store' | 'notif_system';

export interface NavbarProps {
  profile: UserProfile;
  hasActiveSession?: boolean;
  isSuperAdminMode?: boolean;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  adminBellCounts?: {
    messages: number;
    workshops: number;
    store: number;
    system: number;
  };
  onSelectAdminNotificationSection?: (section: AdminBellSectionId) => void;
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
  isSuperAdminMode = false,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  adminBellCounts,
  onSelectAdminNotificationSection,
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
  const flags = useFeatureFlags();
  const isSupplierAccount = (profile as any)?.accountRole === 'supplier';
  const showStoreButton =
    Boolean(onOpenArtisanStore || onNavigateToCatalog) &&
    (isSuperAdminMode || (isSupplierAccount ? flags.supplierPortalEnabled : flags.artisanStorefrontEnabled));
  const showFamilyButton =
    Boolean(onNavigateToFamily) && (isSuperAdminMode || flags.familyCommunityEnabled);
  const workshopLogo = (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64;
  const hasAnyUnread = unreadNotificationsCount > 0 || unreadMessagesCount > 0;
  const [isAdminBellOpen, setIsAdminBellOpen] = useState(false);
  const bellWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdminBellOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (bellWrapperRef.current && !bellWrapperRef.current.contains(e.target as Node)) {
        setIsAdminBellOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAdminBellOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isAdminBellOpen]);

  const handleBellClick = () => {
    if (isSuperAdminMode && onSelectAdminNotificationSection) {
      setIsAdminBellOpen((prev) => !prev);
      return;
    }
    onOpenNotifications();
  };

  const adminBellItems: {
    id: AdminBellSectionId;
    label: string;
    count: number;
    icon: React.ReactNode;
    iconBg: string;
  }[] = [
    {
      id: 'notif_messages',
      label: 'الرسائل',
      count: adminBellCounts?.messages ?? unreadMessagesCount,
      icon: <Mail className="w-4 h-4 text-[#1E3A8A] dark:text-sky-300" />,
      iconBg: 'bg-sky-100 dark:bg-sky-950/60',
    },
    {
      id: 'notif_workshops',
      label: 'الورش',
      count: adminBellCounts?.workshops ?? 0,
      icon: <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    },
    {
      id: 'notif_store',
      label: 'متجري',
      count: adminBellCounts?.store ?? 0,
      icon: <Store className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />,
      iconBg: 'bg-amber-100 dark:bg-amber-950/60',
    },
    {
      id: 'notif_system',
      label: 'النظام',
      count: adminBellCounts?.system ?? unreadNotificationsCount,
      icon: <ShieldCheck className="w-4 h-4 text-violet-700 dark:text-violet-300" />,
      iconBg: 'bg-violet-100 dark:bg-violet-950/60',
    },
  ];

  const totalAdminUnread = unreadNotificationsCount + unreadMessagesCount;

  return (
    <nav
      className={`sticky top-0 z-40 flex items-center justify-between w-full max-w-full box-border bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] shadow-2xs overflow-x-clip ${
        isSuperAdminMode
          ? 'gap-1 sm:gap-2 px-1.5 sm:px-3.5 md:px-4 py-1.5 sm:py-2'
          : 'gap-1 sm:gap-2 px-2 sm:px-4 md:px-5 py-2 sm:py-2.5'
      }`}
    >
      {/* اليمين: شعار المنظومة/الورشة + وسم SUPER ADMIN عند السوبر أدمن */}
      <div
        className={`flex items-center cursor-pointer min-w-0 shrink-0 ${isSuperAdminMode ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2'}`}
        onClick={onGoHome}
        title={isSuperAdminMode ? 'منظومة الشمساوية — Super Admin' : profile?.brandName || 'منظومة الشمساوية'}
      >
        {isSuperAdminMode ? (
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <AlShamsBrandIcon size="sm" className="lg:hidden scale-90" alt="منظومة الشمساوية" />
            <AlShamsBrandLogo
              maxWidth={96}
              maxHeight={30}
              className="hidden lg:block"
              alt="منظومة الشمساوية"
            />
            <span className="px-1.5 py-0.5 rounded-md bg-[#0C1427] dark:bg-[#132040] text-[#FBBF24] border border-[#EA580C]/65 font-mono text-[8px] sm:text-[9px] font-black tracking-wide uppercase whitespace-nowrap">
              ADMIN
            </span>
          </div>
        ) : workshopLogo ? (
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
      <div className={`flex items-center min-w-0 shrink ${isSuperAdminMode ? 'gap-1 sm:gap-1.5' : 'gap-1 sm:gap-2'}`}>
        {showStoreButton && (
          <button
            type="button"
            onClick={() => {
              if (onOpenArtisanStore) {
                onOpenArtisanStore();
              } else if (onNavigateToCatalog) {
                onNavigateToCatalog('store');
              }
            }}
            title={isSupplierAccount ? 'لوحة تحكم متجر المورد والمعاينة العامة' : 'متجري الخاص وطلبات الزبائن'}
            className={`${
              isSuperAdminMode
                ? 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] gap-1'
                : 'px-2 sm:px-3.5 py-1.5 text-[11px] sm:text-xs gap-1 sm:gap-1.5'
            } rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white border border-[#FDBA74]/50 font-black flex items-center transition cursor-pointer shadow-sm whitespace-nowrap shrink-0`}
          >
            <Store className={`${isSuperAdminMode ? 'w-3 h-3 sm:w-3.5 sm:h-3.5' : 'w-3.5 h-3.5'} text-amber-100 shrink-0`} />
            <span>متجري</span>
          </button>
        )}

        {showFamilyButton && (
          <button
            type="button"
            onClick={onNavigateToFamily}
            title="مجتمع عيلة الشمساويه"
            className={`${
              isSuperAdminMode
                ? 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] gap-1'
                : 'px-2 sm:px-3.5 py-1.5 text-[11px] sm:text-xs gap-1 sm:gap-1.5'
            } rounded-xl border font-black flex items-center transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
              activeView === 'family'
                ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] dark:bg-[#FBBF24] dark:text-[#0C1427] dark:border-[#EA580C]'
                : 'bg-[#E9E2D4] hover:bg-[#DFD7C6] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#132040] dark:hover:bg-[#1A2B54] dark:text-[#F7F3EA] dark:border-[#22355E]'
            }`}
          >
            <Users className={`${isSuperAdminMode ? 'w-3 h-3 sm:w-3.5 sm:h-3.5' : 'w-3.5 h-3.5'} text-[#EA580C] dark:text-[#FBBF24] shrink-0`} />
            <span>العيلة</span>
          </button>
        )}
      </div>

      {/* اليسار: تثبيت التطبيق + جرس الإشعارات (مع القائمة المنسدلة من 4 أقسام للسوبر أدمن) + الثيم + القائمة الجانبية */}
      <div className={`flex items-center shrink-0 ${isSuperAdminMode ? 'gap-1 sm:gap-1.5' : 'gap-1 sm:gap-2'}`}>
        <PWAInstallButton variant="navbar" compact={isSuperAdminMode} />

        <div className="relative" ref={bellWrapperRef}>
          <button
            type="button"
            onClick={handleBellClick}
            aria-label="الإشعارات ورسائل البريد"
            aria-expanded={isSuperAdminMode ? isAdminBellOpen : undefined}
            title="الإشعارات ورسائل البريد"
            className={`${
              isSuperAdminMode
                ? `h-7 sm:h-8 ${hasAnyUnread ? 'px-1.5 sm:px-2' : 'w-7 sm:w-8 justify-center'}`
                : `h-8 sm:h-9 ${hasAnyUnread ? 'px-1.5 sm:px-2.5' : 'w-8 sm:w-9 justify-center'}`
            } rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border ${
              isAdminBellOpen
                ? 'border-[#EA580C] ring-2 ring-[#EA580C]/25'
                : 'border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
            } text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0`}
          >
            <Bell className={`${isSuperAdminMode ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-4 h-4'} text-[#C2410C] dark:text-[#FBBF24] shrink-0`} />
            {isSuperAdminMode ? (
              totalAdminUnread > 0 && (
                <span
                  title={`${unreadNotificationsCount} إشعار · ${unreadMessagesCount} رسالة`}
                  className="min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 rounded-md bg-[#EA580C] text-white border border-[#C2410C] text-[9px] sm:text-[10px] font-mono tabular-nums font-black flex items-center justify-center leading-none shrink-0"
                >
                  {totalAdminUnread}
                </span>
              )
            ) : (
              <>
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
              </>
            )}
          </button>

          {/* Super Admin Only: 4-Section Bell Dropdown Menu */}
          {isSuperAdminMode && isAdminBellOpen && onSelectAdminNotificationSection && (
            <div
              role="menu"
              aria-label="أقسام إشعارات السوبر أدمن"
              className="fixed sm:absolute left-2 sm:left-0 top-14 sm:top-full sm:mt-2 w-64 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl p-2 z-50 space-y-1 text-right animate-in fade-in slide-in-from-top-1 duration-150"
            >
              {adminBellItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAdminBellOpen(false);
                    onSelectAdminNotificationSection(item.id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-[#E9E2D4] dark:hover:bg-[#132040] flex items-center justify-between gap-2.5 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] group-hover:text-[#C2410C] dark:group-hover:text-[#FBBF24] truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.count > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-[#EA580C] text-white font-mono tabular-nums text-[10px] font-black flex items-center justify-center">
                        {item.count}
                      </span>
                    )}
                    <ChevronLeft className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* زر تبديل الثيم المباشر */}
        <button
          onClick={onToggleTheme}
          type="button"
          aria-label="تبديل الثيم"
          className={`${
            isSuperAdminMode ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-8 h-8 sm:w-9 sm:h-9'
          } rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-300 flex items-center justify-center text-base transition cursor-pointer shrink-0`}
        >
          {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C2410C]" />}
        </button>

        {/* زر القائمة الجانبية ☰ المنسدلة */}
        <button
          onClick={onToggleSidebar}
          type="button"
          aria-label="القائمة الجانبية"
          className={`${
            isSuperAdminMode ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-8 h-8 sm:w-9 sm:h-9'
          } rounded-xl bg-gradient-to-b from-[#F7F3EA] to-[#E5DDD0] dark:from-[#1A294B] dark:to-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-400 flex items-center justify-center transition cursor-pointer shrink-0`}
        >
          <Menu className={`${isSuperAdminMode ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
        </button>
      </div>
    </nav>
  );
};

