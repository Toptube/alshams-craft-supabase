import React, { useState, useMemo } from 'react';
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
  ShoppingBag,
  Globe,
  Home,
  Calculator,
  Hammer,
  Boxes,
  Receipt,
  Truck,
  FolderArchive,
  Store,
  ShoppingCart,
  FileText,
  Users,
  Wallet,
  Scale,
  Coins,
  Building,
  BarChart3,
  ArrowLeftRight,
  Users2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

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
  onOpenProfileSettings,
  onOpenUserGuide,
  onOpenCloudMigration,
  onOpenSupport,
  onStartTour,
  onLogout,
}) => {
  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        key: 'erp',
        code: 'ERP',
        titleAr: 'الإنتاج والمخازن',
        items: [
          { id: 'calculator', label: 'حاسبة التكاليف والتسعير', icon: Calculator },
          { id: 'work_orders', label: 'أوامر الشغل والتصنيع', icon: Hammer },
          { id: 'materials', label: 'الخامات والمخزون', icon: Boxes },
          { id: 'purchases', label: 'فواتير المشتريات', icon: Receipt },
          { id: 'suppliers', label: 'سجل الموردين', icon: Truck },
          { id: 'archive', label: 'أرشيف المنتجات', icon: FolderArchive },
        ],
      },
      {
        key: 'crm',
        code: 'CRM',
        titleAr: 'العملاء والمتجر والسوق',
        items: [
          {
            id: 'catalog',
            label: 'منصتي والكتالوج',
            icon: Globe,
            action: () => {
              if (onNavigateToCatalog) {
                onNavigateToCatalog('catalog');
              } else {
                onSelectView('catalog');
              }
            },
          },
          {
            id: 'store',
            label: 'متجري الإلكتروني',
            icon: Store,
            action: () => {
              if (onNavigateToCatalog) {
                onNavigateToCatalog('store');
              } else {
                onSelectView('store');
              }
            },
          },
          { id: 'marketplace', label: 'سوق الشمساوية', icon: ShoppingBag },
          { id: 'sales', label: 'طلبات ومبيعات الورشة', icon: ShoppingCart },
          { id: 'invoices', label: 'الفواتير وعروض الأسعار', icon: FileText },
          { id: 'customers', label: 'سجل العملاء', icon: Users },
        ],
      },
      {
        key: 'fca',
        code: 'FCA',
        titleAr: 'المالية والحسابات',
        items: [
          { id: 'treasuries', label: 'الخزينة والأرصدة', icon: Wallet },
          { id: 'accounts', label: 'الدفتر المالي والحسابات', icon: Scale },
          { id: 'expenses', label: 'المصروفات الإدارية', icon: Coins },
          { id: 'fixed_assets', label: 'الأصول الثابتة', icon: Building },
          { id: 'reports', label: 'التقارير المالية', icon: BarChart3 },
          { id: 'currency_rates', label: 'أسعار الصرف', icon: ArrowLeftRight },
        ],
      },
      {
        key: 'hr',
        code: 'HR',
        titleAr: 'العاملون والحرفيون',
        items: [{ id: 'hr', label: 'شؤون العاملين والأجور', icon: Users2 }],
      },
    ],
    [onNavigateToCatalog, onSelectView]
  );

  // Determine initial open group from activeView (default: ERP open if home)
  const initialOpenKey = useMemo<SectionKey>(() => {
    const matched = navGroups.find((g) => g.items.some((item) => item.id === activeView));
    return matched ? matched.key : 'erp';
  }, [activeView, navGroups]);

  const [openGroups, setOpenGroups] = useState<Record<SectionKey, boolean>>({
    erp: initialOpenKey === 'erp',
    crm: initialOpenKey === 'crm',
    fca: initialOpenKey === 'fca',
    hr: initialOpenKey === 'hr',
  });

  if (!isOpen) return null;

  const workshopLogo = (profile as any)?.logo_url || profile?.logoUrl || profile?.logoBase64;
  const isAdmin = isUserAdmin(profile);

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
      className="fixed inset-0 z-50 flex justify-start bg-[#060B18]/75 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        aria-label="القائمة الجانبية للورشة"
        className="w-full max-w-xs sm:max-w-sm h-full flex flex-col text-right shadow-2xl border-l bg-[#F2ECE1] text-[#0C1427] border-[#D4CCBC] dark:bg-[#060B18] dark:text-[#F7F3EA] dark:border-[#22355E] animate-in slide-in-from-right duration-200 relative"
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
          {/* زر الرئيسية ومجتمع عيلة الشمساويه السريع */}
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectView('home');
                onClose();
              }}
              className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
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
                onSelectView('family');
                onClose();
              }}
              className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] ${
                activeView === 'family'
                  ? 'bg-[#EA580C] text-white border-[#FBBF24]'
                  : 'bg-[#F7F3EA] text-[#0C1427] border-[#D4CCBC] hover:border-[#EA580C] dark:bg-[#0D162E] dark:text-[#F7F3EA] dark:border-[#22355E] dark:hover:border-[#FBBF24]'
              }`}
            >
              <Users className={`w-4 h-4 shrink-0 ${activeView === 'family' ? 'text-white' : 'text-[#C2410C] dark:text-[#FBBF24]'}`} />
              <span className="truncate">مجتمع عيلة الشمساويه</span>
            </button>
          </div>

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

          {/* المساعد الذكي */}
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
              <span className="text-xs font-black truncate">المستشار الذكي (صقر & شموسة)</span>
            </div>
            <ChevronLeft className="w-4 h-4 shrink-0 opacity-75" />
          </button>

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
        </nav>

        {/* شريط الأدوات السفلي المدمج: 5 أيقونات فقط لعدم ازدحام القائمة */}
        <div className="p-3 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#0D162E]">
          <div className="flex items-center justify-between gap-1.5">
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
