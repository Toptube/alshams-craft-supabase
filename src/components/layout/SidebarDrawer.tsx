import React, { useState, useMemo, useEffect } from 'react';
import { ArtisanAvatar } from '../brand/BrandAssets';
import { UserProfile, isUserAdmin, ThemeMode } from '../../types';
import {
  X,
  LogOut,
  ChevronDown,
  ChevronLeft,
  BookOpen,
  CloudUpload,
  Settings,
  Eye,
  MessageSquare,
  Home,
  Users,
  Sparkles,
  RefreshCw,
  User,
  Crown,
} from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { useFeatureFlags } from '../../types/featureFlags';
import { getUiIcon, useUiLayoutConfig } from '../../types/uiLayoutConfig';
import {
  useUserSubscription,
  isModuleUnlockedBySubscription,
  isSakrUnlockedBySubscription,
} from '../../types/subscriptions';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  activeView: string;
  onSelectView: (view: string) => void;
  onNavigateToCatalog?: (tab?: 'catalog' | 'store') => void;
  onOpenArtisanStore?: (tab?: 'products' | 'appearance' | 'promotions' | 'orders' | 'qr') => void;
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

type SectionKey = 'erp' | 'crm' | 'fca' | 'hr';

interface NavSubItem {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  action?: () => void;
}

interface NavGroup {
  key: SectionKey;
  code: string;
  titleAr: string;
  items: NavSubItem[];
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  profile,
  activeView,
  onSelectView,
  onNavigateToCatalog,
  onOpenArtisanStore,
  onOpenProfileSettings,
  onOpenUserGuide,
  onOpenCloudMigration,
  onOpenSupport,
  onStartTour,
  onLogout,
}) => {
  const flags = useFeatureFlags();
  const uiLayout = useUiLayoutConfig();
  const userSub = useUserSubscription(profile);
  const isAdmin = isUserAdmin(profile);
  const isSupplier = (profile as any)?.accountRole === 'supplier';
  const sidebarLayout = isSupplier ? uiLayout.supplier.sidebar : uiLayout.artisan.sidebar;

  const navGroups: NavGroup[] = useMemo(() => {
    const resolveAction = (id: string): (() => void) | undefined => {
      if (id === 'supplier_store') {
        return () => {
          if (onOpenArtisanStore) onOpenArtisanStore('products');
          else onSelectView('supplier_store');
        };
      }
      if (id === 'catalog') {
        return () => {
          if (onNavigateToCatalog) onNavigateToCatalog('catalog');
          else onSelectView('catalog');
        };
      }
      if (id === 'store') {
        return () => {
          if (onOpenArtisanStore) onOpenArtisanStore('products');
          else if (onNavigateToCatalog) onNavigateToCatalog('store');
          else onSelectView('store');
        };
      }
      if (id === 'my_orders') {
        return () => {
          if (onOpenArtisanStore) onOpenArtisanStore('orders');
          else onSelectView('my_orders');
        };
      }
      return undefined;
    };

    const dynamicGroups: NavGroup[] = sidebarLayout.groups
      .filter((g) => isAdmin || g.visible !== false)
      .map((g) => ({
        key: (g.id as SectionKey) || 'erp',
        code: g.code,
        titleAr: g.titleAr,
        items: g.items
          .filter((it) => it.visible !== false)
          .filter((item) => {
            if (isAdmin) return true;
            if (!isModuleUnlockedBySubscription(item.id, userSub, isSupplier ? 'supplier' : 'artisan', isAdmin)) {
              return false;
            }
            if (isSupplier) {
              if (
                ['supplier_erp_hub', 'supplier_pos', 'supplier_warehouse_erp', 'supplier_hr_terminal'].includes(
                  item.id
                ) &&
                flags.supplierErpEnabled === false
              ) {
                return false;
              }
              return true;
            }
            if (item.id === 'calculator' && !flags.craftCalculatorEnabled) return false;
            if ((item.id === 'store' || item.id === 'my_orders') && !flags.artisanStorefrontEnabled) return false;
            if (item.id === 'marketplace' && !flags.artisanMarketplaceEnabled) return false;
            if (item.id === 'suppliers_market' && !flags.suppliersMarketplaceEnabled) return false;
            if (
              !flags.erpModulesEnabled &&
              ['work_orders', 'purchases', 'suppliers', 'customers', 'invoices', 'treasuries', 'accounts', 'expenses', 'fixed_assets', 'reports', 'currency_rates', 'hr'].includes(
                item.id
              )
            ) {
              return false;
            }
            return true;
          })
          .map((item) => ({
            id: item.id,
            label: item.label,
            icon: getUiIcon(item.iconKey) as unknown as React.FC<{ className?: string }>,
            action: resolveAction(item.id),
          })),
      }))
      .filter((g) => g.items.length > 0);

    return dynamicGroups;
  }, [isAdmin, isSupplier, flags, userSub, sidebarLayout, onNavigateToCatalog, onOpenArtisanStore, onSelectView]);

  // جميع القوائم المنسدلة تبدأ مغلقة عند فتح القائمة الجانبية ليظهر كل تبويب بوضوح
  const [openGroups, setOpenGroups] = useState<Record<SectionKey, boolean>>({
    erp: false,
    crm: false,
    fca: false,
    hr: false,
  });

  // إبقاء القائمة مركّبة مؤقتاً أثناء حركة الإغلاق السلسة لنفس الجهة التي فُتحت منها
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // إعادة إغلاق كافة القوائم المنسدلة تلقائياً في كل مرة تُفتح فيها القائمة الجانبية
      setOpenGroups({
        erp: false,
        crm: false,
        fca: false,
        hr: false,
      });
      setShouldRender(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 240);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  const isLtr =
    typeof document !== 'undefined' &&
    (document.documentElement.dir === 'ltr' || getComputedStyle(document.body).direction === 'ltr');

  const workshopLogo = (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64;

  const toggleGroup = (key: SectionKey) => {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleItemClick = (item: NavSubItem) => {
    if (item.action) {
      item.action();
    } else {
      onSelectView(item.id);
    }
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
        isVisible ? 'bg-[#060B18]/70 backdrop-blur-xs opacity-100' : 'bg-[#060B18]/0 opacity-0 pointer-events-none'
      }`}
      dir={isLtr ? 'ltr' : 'rtl'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        aria-label="القائمة الجانبية للورشة"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xs sm:max-w-sm h-full flex flex-col text-right shadow-2xl ${
          isLtr ? 'border-l' : 'border-r'
        } bg-[#F2ECE1] text-[#0C1427] border-[#D4CCBC] dark:bg-[#060B18] dark:text-[#F7F3EA] dark:border-[#22355E] relative transform transition-transform duration-200 ease-out ${
          isVisible
            ? 'translate-x-0'
            : isLtr
            ? 'translate-x-full'
            : '-translate-x-full'
        }`}
      >
        {/* الهيدر: لوجو متجر الفنان + الاسم + أيقونة الترس المباشرة للإعدادات + إغلاق */}
        <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#0D162E] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {workshopLogo ? (
              <img
                src={workshopLogo}
                alt={profile.brandName || profile.artistName || 'شعار المتجر'}
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-xl object-contain border border-[#EA580C]/50 bg-[#F7F3EA] dark:bg-[#132040] p-0.5 shadow-2xs shrink-0"
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
              <h4 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA] truncate">
                {profile.artistName || 'فنان الشمساوية'}
              </h4>
              <p className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24] truncate">
                {profile.brandName || 'ورشة الشمساوية'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onOpenProfileSettings();
                onClose();
              }}
              aria-label="إعدادات الورشة والحساب"
              title="إعدادات الورشة والبراند وكلمة المرور"
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#0C1427] text-[#FBBF24] hover:bg-[#EA580C] hover:text-white dark:bg-[#132040] dark:text-[#FBBF24] dark:hover:bg-[#EA580C] dark:hover:text-white border border-[#0C1427] dark:border-[#2D4475] flex items-center justify-center transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق القائمة الجانبية"
              title="إغلاق"
              className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#F7F3EA] text-[#0C1427] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:text-[#F7F3EA] dark:hover:bg-[#1A2B54] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* جسم القائمة: الرئيسية ثم الأقسام الرئيسية القابلة للطي */}
        <nav className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {/* أزرار القمة السريعة: الرئيسية + صفحتي الشخصية */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectView('home');
                onClose();
              }}
              className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                activeView === 'home'
                  ? 'bg-[#0C1427] text-[#F7F3EA] border-[#EA580C] dark:bg-[#EA580C] dark:text-white dark:border-[#FBBF24]'
                  : 'bg-[#F7F3EA] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#0D162E] dark:text-[#F7F3EA] dark:border-[#22355E] dark:hover:border-[#FBBF24]'
              }`}
            >
              <Home className={`w-4 h-4 shrink-0 ${activeView === 'home' ? 'text-[#FBBF24] dark:text-white' : 'text-[#C2410C] dark:text-[#FBBF24]'}`} />
              <span className="truncate">الرئيسية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectView('personal_profile');
                onClose();
              }}
              className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                activeView === 'personal_profile'
                  ? 'bg-[#EA580C] text-white border-[#FBBF24]'
                  : 'bg-[#F7F3EA] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#0D162E] dark:text-[#F7F3EA] dark:border-[#22355E] dark:hover:border-[#FBBF24]'
              }`}
            >
              <User className={`w-4 h-4 shrink-0 ${activeView === 'personal_profile' ? 'text-white' : 'text-[#C2410C] dark:text-[#FBBF24]'}`} />
              <span className="truncate">صفحتي الشخصية</span>
            </button>
          </div>

          {/* زر اشتراكاتي وباقات المنظومة (متاح لكل الأعضاء المسجلين) */}
          <button
            type="button"
            onClick={() => {
              onSelectView('my_subscriptions');
              onClose();
            }}
            className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
              activeView === 'my_subscriptions'
                ? 'bg-[#EA580C] text-white border-[#FBBF24]'
                : 'bg-gradient-to-l from-[#EA580C]/10 via-[#F7F3EA] to-[#F7F3EA] dark:from-[#FBBF24]/15 dark:via-[#0D162E] dark:to-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border-[#EA580C]/45 dark:border-[#FBBF24]/45 hover:border-[#EA580C]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Crown
                className={`w-4 h-4 shrink-0 ${
                  activeView === 'my_subscriptions' ? 'text-white' : 'text-[#EA580C] dark:text-[#FBBF24]'
                }`}
              />
              <div className="min-w-0">
                <span className="text-xs font-black block truncate">اشتراكاتي وباقاتي</span>
                <span
                  className={`text-[10px] font-bold block truncate ${
                    activeView === 'my_subscriptions' ? 'text-white/90' : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {userSub.activePackageIds.length} باقات مفعلة · عرض مجاني
                </span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 shrink-0 opacity-75" />
          </button>

          <div className="h-px bg-[#D4CCBC] dark:bg-[#22355E] my-1" />

          {/* الأقسام الرئيسية (ERP / CRM / FCA / HR) القابلة للفتح والإغلاق بسهم */}
          <div className="space-y-2">
            {navGroups.map((group) => {
              const isExpanded = openGroups[group.key];
              const hasActiveChild = group.items.some((item) => item.id === activeView);

              return (
                <div
                  key={group.key}
                  className={`rounded-2xl border overflow-hidden transition-colors ${
                    hasActiveChild
                      ? 'border-[#EA580C]/70 bg-[#F7F3EA] dark:bg-[#0D162E] dark:border-[#FBBF24]/60'
                      : 'border-[#D4CCBC] bg-[#F7F3EA] dark:bg-[#0D162E] dark:border-[#22355E]'
                  }`}
                >
                  {/* رأس القسم الرئيسي */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isExpanded}
                    className={`w-full min-h-[46px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                      isExpanded
                        ? 'bg-[#0C1427] text-[#F7F3EA] dark:bg-[#132040] dark:text-[#F7F3EA]'
                        : 'text-[#0C1427] hover:bg-[#E9E2D4] dark:text-[#F7F3EA] dark:hover:bg-[#132040]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-black tracking-wide shrink-0 ${
                          isExpanded
                            ? 'bg-[#EA580C] text-white'
                            : 'bg-[#0C1427] text-[#FBBF24] dark:bg-[#1A2B54] dark:text-[#FBBF24]'
                        }`}
                      >
                        {group.code}
                      </span>
                      <span className="text-xs sm:text-sm font-black truncate">
                        {group.titleAr}
                      </span>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                        isExpanded
                          ? 'rotate-180 text-[#FBBF24]'
                          : 'text-[#475569] dark:text-[#CBD5E1]'
                      }`}
                    />
                  </button>

                  {/* العناصر الفرعية تظهر عند الفتح وتختفي عند الإغلاق */}
                  {isExpanded && (
                    <div className="p-2 space-y-1 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/80 dark:bg-[#060B18]">
                      {group.items.map((item) => {
                        const IconComp = item.icon;
                        const isItemActive = activeView === item.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleItemClick(item)}
                            className={`w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                              isItemActive
                                ? 'bg-[#EA580C] text-white font-black'
                                : 'text-[#0C1427] hover:bg-[#E3DBCC] dark:text-[#E5E0D5] dark:hover:bg-[#132040]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <IconComp
                                className={`w-4 h-4 shrink-0 ${
                                  isItemActive
                                    ? 'text-white'
                                    : 'text-[#C2410C] dark:text-[#FBBF24]'
                                }`}
                              />
                              <span className="text-xs font-bold truncate">
                                {item.label}
                              </span>
                            </div>
                            <ChevronLeft
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isItemActive ? 'text-white' : 'text-[#475569] dark:text-[#CBD5E1]'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="h-px bg-[#D4CCBC] dark:bg-[#22355E] my-1" />

          {/* المستشار الذكي (صقر) — مستقل عن شموسة */}
          {(isAdmin ||
            (flags.aiAssistantsEnabled &&
              isSakrUnlockedBySubscription(
                userSub,
                isSupplier ? 'supplier' : 'artisan',
                isAdmin
              ))) && (
            <button
              type="button"
              onClick={() => {
                onSelectView('ai_agent');
                onClose();
              }}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                activeView === 'ai_agent'
                  ? 'bg-[#EA580C] text-white border-[#FBBF24]'
                  : 'bg-[#F7F3EA] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#0D162E] dark:text-[#F7F3EA] dark:border-[#22355E] dark:hover:border-[#FBBF24]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles
                  className={`w-4 h-4 shrink-0 ${
                    activeView === 'ai_agent' ? 'text-white' : 'text-[#C2410C] dark:text-[#FBBF24]'
                  }`}
                />
                <span className="text-xs font-black truncate">المستشار الهندسي صقر AI</span>
              </div>
              <ChevronLeft className="w-4 h-4 shrink-0 opacity-75" />
            </button>
          )}

          {/* لوحة الإدارة والتبديل بين الورش (للإدارة العليا) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onSelectView('admin');
                onClose();
              }}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                activeView === 'admin'
                  ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] dark:bg-[#1A2B54] dark:text-[#FBBF24]'
                  : 'bg-[#0C1427] text-[#F7F3EA] border-[#22355E] hover:border-[#EA580C]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <RefreshCw className="w-4 h-4 shrink-0 text-[#FBBF24]" />
                <span className="text-xs font-black leading-snug">إدارة المنظومة والورش</span>
              </div>
              <ChevronLeft className="w-4 h-4 shrink-0 text-[#FBBF24]" />
            </button>
          )}


          {/* مجتمع عيلة الشمساويه في نهاية القائمة */}
          {(isAdmin ||
            (flags.familyCommunityEnabled &&
              isModuleUnlockedBySubscription(
                'family',
                userSub,
                isSupplier ? 'supplier' : 'artisan',
                isAdmin
              ))) && (
            <button
              type="button"
              onClick={() => {
                onSelectView('family');
                onClose();
              }}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-right transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                activeView === 'family'
                  ? 'bg-[#EA580C] text-white border-[#FBBF24]'
                  : 'bg-[#F7F3EA] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#0D162E] dark:text-[#F7F3EA] dark:border-[#22355E] dark:hover:border-[#FBBF24]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Users
                  className={`w-4 h-4 shrink-0 ${
                    activeView === 'family' ? 'text-white' : 'text-[#C2410C] dark:text-[#FBBF24]'
                  }`}
                />
                <span className="text-xs font-black truncate">مجتمع عيلة الشمساويه</span>
              </div>
              <ChevronLeft className="w-4 h-4 shrink-0 opacity-75" />
            </button>
          )}
        </nav>

        {/* بطاقة تثبيت التطبيق السريع (PWA Setup) */}
        <div className="px-3 pb-2.5 pt-1 bg-[#F2ECE1] dark:bg-[#060B18]">
          <PWAInstallButton variant="card" />
        </div>

        {/* شريط الأدوات السفلي المدمج */}
        <div className="p-3 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#0D162E]">
          <div className="flex items-center justify-between gap-1.5">
            {isModuleUnlockedBySubscription(
              'guide_start',
              userSub,
              isSupplier ? 'supplier' : 'artisan',
              isAdmin
            ) && (
              <button
                type="button"
                onClick={() => {
                  onOpenUserGuide();
                  onClose();
                }}
                title="دليل الورشة"
                aria-label="دليل الورشة"
                className="flex-1 min-h-[40px] py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] dark:hover:text-[#FBBF24] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onStartTour) onStartTour();
                onClose();
              }}
              title="الجولة التعريفية"
              aria-label="الجولة التعريفية"
              className="flex-1 min-h-[40px] py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] dark:hover:text-[#FBBF24] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenCloudMigration();
                onClose();
              }}
              title="النسخ والرفع السحابي"
              aria-label="النسخ والرفع السحابي"
              className="flex-1 min-h-[40px] py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#1D3566] dark:text-[#FBBF24] hover:text-[#EA580C] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
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
              className="flex-1 min-h-[40px] py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] dark:hover:text-[#FBBF24] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
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
              className="flex-1 min-h-[40px] py-2 rounded-xl bg-[#0C1427] dark:bg-[#060B18] border border-[#EA580C]/70 hover:bg-[#EA580C] text-[#FBBF24] hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
