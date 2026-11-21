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
  FileText,
  User,
  Plus,
  ShoppingCart,
  Layers,
  Calculator,
  Sparkles,
  X,
} from 'lucide-react';
import { AlShamsBrandIcon, AlShamsBrandLogo } from '../brand/BrandAssets';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { useFeatureFlags } from '../../types/featureFlags';
import { useUiLayoutConfig } from '../../types/uiLayoutConfig';

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
  onNavigateToExecutiveBrief?: () => void;
  onOpenPersonalProfile?: () => void;
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
  onOpenNewMaterialModal,
  onNavigateToCalculator,
  onNavigateToSales,
  onOpenNewClientModal,
  onNavigateToCatalog,
  onOpenArtisanStore,
  onNavigateToFamily,
  onNavigateToExecutiveBrief,
  onOpenPersonalProfile,
  activeView,
}) => {
  const flags = useFeatureFlags();
  const uiLayout = useUiLayoutConfig();
  const isSupplierAccount = (profile as any)?.accountRole === 'supplier';
  const navLayout = isSupplierAccount ? uiLayout.supplier.navbar : uiLayout.artisan.navbar;
  const isCompactNav = isSuperAdminMode || navLayout.density === 'compact';

  const [isAdminBellOpen, setIsAdminBellOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const bellWrapperRef = useRef<HTMLDivElement>(null);
  const quickAddWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdminBellOpen && !isQuickAddOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bellWrapperRef.current && !bellWrapperRef.current.contains(e.target as Node)) {
        setIsAdminBellOpen(false);
      }
      if (quickAddWrapperRef.current && !quickAddWrapperRef.current.contains(e.target as Node)) {
        setIsQuickAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAdminBellOpen, isQuickAddOpen]);

  const showQuickAddButton =
    !isSuperAdminMode &&
    Boolean(onNavigateToSales || onOpenNewMaterialModal || onNavigateToCalculator || onOpenNewClientModal);

  const workshopLogo = (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64 || '';

  const totalAdminUnread =
    (adminBellCounts?.messages || 0) +
    (adminBellCounts?.workshops || 0) +
    (adminBellCounts?.store || 0) +
    (adminBellCounts?.system || 0) ||
    unreadNotificationsCount + unreadMessagesCount;

  const hasAnyUnread = isSuperAdminMode
    ? totalAdminUnread > 0
    : unreadNotificationsCount > 0 || unreadMessagesCount > 0;

  const handleBellClick = () => {
    if (isSuperAdminMode && onSelectAdminNotificationSection) {
      setIsAdminBellOpen((v) => !v);
      return;
    }
    onOpenNotifications();
  };

  const adminBellItems: Array<{
    id: AdminBellSectionId;
    label: string;
    count: number;
    icon: React.ReactNode;
    iconBg: string;
  }> = [
    {
      id: 'notif_messages',
      label: 'رسائل البريد (البوسطة)',
      count: adminBellCounts?.messages || unreadMessagesCount || 0,
      icon: <Mail className="w-4 h-4 text-sky-600 dark:text-sky-300" />,
      iconBg: 'bg-sky-100 dark:bg-sky-950/60',
    },
    {
      id: 'notif_workshops',
      label: 'طلبات الورش والتراخيص',
      count: adminBellCounts?.workshops || 0,
      icon: <Building2 className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />,
      iconBg: 'bg-orange-100 dark:bg-orange-950/60',
    },
    {
      id: 'notif_store',
      label: 'طلبات المتاجر والأسواق',
      count: adminBellCounts?.store || 0,
      icon: <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    },
    {
      id: 'notif_system',
      label: 'تنبيهات المنظومة والأمان',
      count: adminBellCounts?.system || 0,
      icon: <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-300" />,
      iconBg: 'bg-violet-100 dark:bg-violet-950/60',
    },
  ];

  const storeNavCfg = navLayout.items.find((i) => i.id === 'store');
  const familyNavCfg = navLayout.items.find((i) => i.id === 'family');
  const briefNavCfg = navLayout.items.find((i) => i.id === 'executive_brief');
  const profileNavCfg = navLayout.items.find((i) => i.id === 'personal_profile');

  const showStoreButton =
    (isSuperAdminMode || storeNavCfg?.visible !== false) &&
    Boolean(onOpenArtisanStore || onNavigateToCatalog) &&
    (isSuperAdminMode || (isSupplierAccount ? flags.supplierPortalEnabled : flags.artisanStorefrontEnabled));
  const showFamilyButton =
    (isSuperAdminMode || familyNavCfg?.visible !== false) &&
    Boolean(onNavigateToFamily) &&
    (isSuperAdminMode || flags.familyCommunityEnabled);
  const showBriefButton = !isSuperAdminMode && briefNavCfg?.visible === true && Boolean(onNavigateToExecutiveBrief);
  const showProfileButton = !isSuperAdminMode && profileNavCfg?.visible === true && Boolean(onOpenPersonalProfile);

  const middleItemsOrdered = navLayout.items.filter((i) =>
    ['store', 'family', 'executive_brief', 'personal_profile'].includes(i.id)
  );
  const rightUtilityOrdered = navLayout.items.filter((i) =>
    ['pwa', 'notifications', 'theme'].includes(i.id)
  );

  const renderMiddleItem = (id: string, label: string) => {
    if (id === 'store' && showStoreButton) {
      return (
        <button
          key={id}
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
            isCompactNav
              ? 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] gap-1'
              : 'h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs gap-1'
          } rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white border border-[#FDBA74]/50 font-black flex items-center transition cursor-pointer shadow-sm whitespace-nowrap shrink-0`}
        >
          <Store className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-100 shrink-0" />
          <span>{label || 'متجري'}</span>
        </button>
      );
    }
    if (id === 'family' && showFamilyButton && onNavigateToFamily) {
      return (
        <button
          key={id}
          type="button"
          onClick={onNavigateToFamily}
          title="مجتمع عيلة الشمساويه"
          className={`${
            isCompactNav
              ? 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] gap-1'
              : 'h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs gap-1'
          } rounded-xl border font-black flex items-center transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
            activeView === 'family'
              ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] dark:bg-[#FBBF24] dark:text-[#0C1427] dark:border-[#EA580C]'
              : 'bg-[#E9E2D4] hover:bg-[#DFD7C6] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#132040] dark:hover:bg-[#1A2B54] dark:text-[#F7F3EA] dark:border-[#22355E]'
          }`}
        >
          <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
          <span>{label || 'العيلة'}</span>
        </button>
      );
    }
    if (id === 'executive_brief' && showBriefButton && onNavigateToExecutiveBrief) {
      return (
        <button
          key={id}
          type="button"
          onClick={onNavigateToExecutiveBrief}
          title="هلخصهالك — الملخص البسيط"
          className={`${
            isCompactNav
              ? 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] gap-1'
              : 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-xs gap-1'
          } rounded-xl border font-black flex items-center transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
            activeView === 'executive_brief' || activeView === 'supplier_executive_brief'
              ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C]'
              : 'bg-[#E9E2D4] hover:bg-[#DFD7C6] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#132040] dark:text-[#F7F3EA] dark:border-[#22355E]'
          }`}
        >
          <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
          <span>{label || 'هلخصهالك'}</span>
        </button>
      );
    }
    if (id === 'personal_profile' && showProfileButton && onOpenPersonalProfile) {
      return (
        <button
          key={id}
          type="button"
          onClick={onOpenPersonalProfile}
          title="صفحتي الشخصية ومعرض الأعمال"
          className={`${
            isCompactNav
              ? 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-[11px] gap-1'
              : 'h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-xs gap-1'
          } rounded-xl border font-black flex items-center transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
            activeView === 'personal_profile'
              ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C]'
              : 'bg-[#E9E2D4] hover:bg-[#DFD7C6] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#132040] dark:text-[#F7F3EA] dark:border-[#22355E]'
          }`}
        >
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
          <span>{label || 'صفحتي'}</span>
        </button>
      );
    }
    return null;
  };

  return (
    <nav
      className={`sticky top-0 z-40 flex items-center justify-between w-full max-w-full box-border bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] shadow-2xs overflow-x-clip ${
        isCompactNav
          ? 'gap-1 sm:gap-2 px-1.5 sm:px-3.5 md:px-4 py-1.5 sm:py-2'
          : 'gap-1 sm:gap-2 px-1.5 sm:px-3.5 md:px-5 py-1.5 sm:py-2'
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

      {/* الوسط: الأزرار الديناميكية المرتبة من هندسة الواجهات */}
      <div className="flex items-center min-w-0 shrink gap-1 sm:gap-1.5">
        {middleItemsOrdered.map((mi) => renderMiddleItem(mi.id, mi.label))}
      </div>

      {/* اليسار: زر الإجراءات السريعة (+) بين العيلة والإشعارات + تثبيت التطبيق + جرس الإشعارات + الثيم + القائمة الجانبية */}
      <div className="flex items-center shrink-0 gap-1 sm:gap-1.5">
        {showQuickAddButton && (
          <div className="relative" ref={quickAddWrapperRef}>
            <button
              type="button"
              onClick={() => setIsQuickAddOpen((v) => !v)}
              aria-label="إجراءات سريعة"
              aria-expanded={isQuickAddOpen}
              title="إجراءات سريعة (+)"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                isQuickAddOpen
                  ? 'bg-[#0C1427] text-white border-[#3B82F6] dark:bg-[#F7F3EA] dark:text-[#0C1427]'
                  : 'bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] border-[#D4CCBC] dark:border-[#2B468B] text-[#0C1427] dark:text-[#F7F3EA]'
              }`}
            >
              <Plus className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isQuickAddOpen ? 'rotate-45' : ''}`} />
            </button>

            {isQuickAddOpen && (
              <div
                role="menu"
                aria-label="إجراءات الوصول السريع"
                dir="rtl"
                className="fixed sm:absolute left-2 sm:left-0 top-12 sm:top-full sm:mt-2 w-64 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#2B468B] shadow-2xl p-2 z-50 space-y-1.5 text-right animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="px-2 py-1 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                  <span className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-sky-300" />
                    <span>{isSupplierAccount ? 'إجراءات المتجر السريعة' : 'إجراءات الورشة السريعة'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddOpen(false)}
                    className="p-0.5 rounded-md text-[#64748B] hover:text-[#0C1427] dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {onNavigateToSales && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddOpen(false);
                      onNavigateToSales();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-right bg-[#EFE8DA] hover:bg-[#E5DCCB] dark:bg-[#132040] dark:hover:bg-[#1B2F5E] border border-[#D4CCBC] dark:border-[#22355E] transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black block text-[#0C1427] dark:text-[#F7F3EA]">تسجيل بيع جديد</span>
                      <span className="text-[10px] text-[#475569] dark:text-[#CBD5E1] block">فاتورة نقدية أو آجل</span>
                    </div>
                  </button>
                )}

                {onOpenNewMaterialModal && !isSupplierAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddOpen(false);
                      onOpenNewMaterialModal();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-right bg-[#EFE8DA] hover:bg-[#E5DCCB] dark:bg-[#132040] dark:hover:bg-[#1B2F5E] border border-[#D4CCBC] dark:border-[#22355E] transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shrink-0">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black block text-[#0C1427] dark:text-[#F7F3EA]">إضافة خامة جديدة</span>
                      <span className="text-[10px] text-[#475569] dark:text-[#CBD5E1] block">إدخال صنف خام للمخزن</span>
                    </div>
                  </button>
                )}

                {onNavigateToCalculator && !isSupplierAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddOpen(false);
                      onNavigateToCalculator();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-right bg-[#EFE8DA] hover:bg-[#E5DCCB] dark:bg-[#132040] dark:hover:bg-[#1B2F5E] border border-[#D4CCBC] dark:border-[#22355E] transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                      <Calculator className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black block text-[#0C1427] dark:text-[#F7F3EA]">حاسبة التكاليف والتسعير</span>
                      <span className="text-[10px] text-[#475569] dark:text-[#CBD5E1] block">حساب تكلفة ومصنعية القطعة</span>
                    </div>
                  </button>
                )}

                {onOpenNewClientModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddOpen(false);
                      onOpenNewClientModal();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-right bg-[#EFE8DA] hover:bg-[#E5DCCB] dark:bg-[#132040] dark:hover:bg-[#1B2F5E] border border-[#D4CCBC] dark:border-[#22355E] transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black block text-[#0C1427] dark:text-[#F7F3EA]">تسجيل عميل جديد</span>
                      <span className="text-[10px] text-[#475569] dark:text-[#CBD5E1] block">إضافة لملف العملاء والحساب</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {rightUtilityOrdered.map((utilItem) => {
          if (utilItem.id === 'pwa' && (isSuperAdminMode || utilItem.visible !== false)) {
            return <PWAInstallButton key="pwa" variant="navbar" compact={true} />;
          }
          if (utilItem.id === 'notifications' && (isSuperAdminMode || utilItem.visible !== false)) {
            return (
              <div key="notifications" className="relative" ref={bellWrapperRef}>
                <button
                  type="button"
                  onClick={handleBellClick}
                  aria-label="الإشعارات ورسائل البريد"
                  aria-expanded={isSuperAdminMode ? isAdminBellOpen : undefined}
                  title="الإشعارات ورسائل البريد"
                  className={`h-7 sm:h-8 ${hasAnyUnread ? 'px-1.5 sm:px-2' : 'w-7 sm:w-8 justify-center'} rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border ${
                    isAdminBellOpen
                      ? 'border-[#EA580C] ring-2 ring-[#EA580C]/25'
                      : 'border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                  } text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0`}
                >
                  <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C2410C] dark:text-[#FBBF24] shrink-0" />
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
            );
          }
          if (utilItem.id === 'theme' && (isSuperAdminMode || utilItem.visible !== false)) {
            return (
              <button
                key="theme"
                onClick={onToggleTheme}
                type="button"
                aria-label="تبديل الثيم"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-300 flex items-center justify-center text-base transition cursor-pointer shrink-0"
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C2410C]" />}
              </button>
            );
          }
          return null;
        })}

        {/* زر القائمة الجانبية ☰ المنسدلة */}
        <button
          onClick={onToggleSidebar}
          type="button"
          aria-label="القائمة الجانبية"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-b from-[#F7F3EA] to-[#E5DDD0] dark:from-[#1A294B] dark:to-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-amber-400 flex items-center justify-center transition cursor-pointer shrink-0"
        >
          <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </nav>
  );
};

