import React, { useState } from 'react';
import { AlShamsBrandLogo, ArtisanAvatar } from '../brand/BrandAssets';
import { UserProfile, isUserAdmin, ThemeMode } from '../../types';
import { getGenderGreeting } from '../../utils/macrameMath';
import {
  X,
  Calculator,
  Sparkles,
  FolderArchive,
  BarChart3,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Bell,
  Wallet,
  Boxes,
  Truck,
  Users,
  Hammer,
  FileText,
  DollarSign,
  BookOpen,
  CloudUpload,
  Layers,
  Settings,
  HelpCircle,
  Home,
  ShieldCheck,
  Compass,
  LayoutGrid,
  ShoppingCart,
  Users2,
  Briefcase,
  Sliders,
  Database,
  Building,
  Mail,
  Scale,
  Download,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { tenantStorage } from '../../db/dexieDB';
import { playSuccessSound, playErrorSound } from '../../lib/sounds';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  activeView: string;
  onSelectView: (view: string) => void;
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
  onToggleDarkMode: () => void;
  isDarkMode: boolean;
  themeMode?: ThemeMode;
  onSelectThemeMode?: (mode: ThemeMode) => void;
  onLogout: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  profile,
  activeView,
  onSelectView,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  onOpenNotifications,
  onOpenMessagesHub,
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
  onLogout,
}) => {
  const { lang: currentLang, dir, t: tr } = useTranslation();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    erp: false,
    crm: false,
    hr: false,
    system: false,
  });

  const [isSavingBackup, setIsSavingBackup] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState('');
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);

  const handleSaveWorkshopDataToDevice = async () => {
    setIsSavingBackup(true);
    setBackupSuccessMessage('');
    try {
      const tid = profile.tenantId || profile.workshopId || profile.id || 'default';
      const [
        treasuryTransactions,
        customers,
        suppliers,
        supplierInvoices,
        rawMaterials,
        inventoryTransactions,
        orders,
        employees,
        employeePayouts,
        products,
        adminCosts,
        fixedAssets,
      ] = await Promise.all([
        tenantStorage.getSafeTransactions(tid).catch(() => []),
        tenantStorage.getCustomers(tid).catch(() => []),
        tenantStorage.getSuppliers(tid).catch(() => []),
        tenantStorage.getSupplierInvoices(tid).catch(() => []),
        tenantStorage.getRawMaterials(tid).catch(() => []),
        tenantStorage.getInventoryTransactions(tid).catch(() => []),
        tenantStorage.getOrders(tid).catch(() => []),
        tenantStorage.getEmployees(tid).catch(() => []),
        tenantStorage.getEmployeePayouts(tid).catch(() => []),
        tenantStorage.getProducts(tid).catch(() => []),
        tenantStorage.getAdminCosts(tid).catch(() => []),
        tenantStorage.getFixedAssets(tid).catch(() => []),
      ]);

      // Agenda appointments from local store
      let agendaAppointments = [];
      try {
        const rawAgenda = localStorage.getItem(`alshams_agenda_${tid}`);
        if (rawAgenda) agendaAppointments = JSON.parse(rawAgenda);
      } catch {}

      const workshopArchive = {
        منظومة_الشمساوية: 'نسخة_كاملة_2026',
        اسم_الورشة: profile.brandName || 'ورشة الشمساوية',
        اسم_الفنان: profile.artistName || 'فنان الشمساوية',
        تاريخ_الحفظ: new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' }),
        وقت_الحفظ_الدقيق: new Date().toISOString(),
        بيانات_الورشة_والإعدادات: profile,
        الخامات_والمخزون: rawMaterials,
        المنتجات: products,
        المبيعات_والفواتير: orders,
        الخزائن_والمعاملات: treasuryTransactions,
        سجل_العملاء: customers,
        سجل_الموردين: suppliers,
        فواتير_الموردين: supplierInvoices,
        فريق_العمل: employees,
        سجل_المصروفات_والأجور: employeePayouts,
        المصاريف_الإدارية: adminCosts,
        الأصول_الثابتة: fixedAssets,
        أجندة_المواعيد_والتسليم: agendaAppointments,
        حركات_المخزن: inventoryTransactions,
      };

      const dataBlob = new Blob([JSON.stringify(workshopArchive, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const downloadUrl = URL.createObjectURL(dataBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      const todayStr = new Date().toISOString().slice(0, 10);
      const cleanBrand = (profile.brandName || 'ورشتي').replace(/\s+/g, '_');
      downloadAnchor.download = `نسخة_بيانات_${cleanBrand}_${todayStr}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      setTimeout(() => {
        downloadAnchor.remove();
        URL.revokeObjectURL(downloadUrl);
      }, 500);

      playSuccessSound();
      setShowCelebrationModal(true);
      setBackupSuccessMessage('تم حفظ كامل بيانات ورشتك بنجاح في جهازك، بياناتك في أمان تام');
      setTimeout(() => {
        setBackupSuccessMessage('');
      }, 6000);
    } catch (err) {
      console.error('Save copy error:', err);
      playErrorSound();
    } finally {
      setIsSavingBackup(false);
    }
  };

  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sec]: !prev[sec],
    }));
  };

  // Section 2: ERP (Resource Planning)
  const erpModules = [
    {
      id: 'materials',
      label: tr('mod_materials'),
      sublabel: tr('sub_materials'),
      icon: Layers,
      badge: tr('badge_materials'),
    },
    {
      id: 'suppliers',
      label: tr('mod_suppliers'),
      sublabel: tr('sub_suppliers'),
      icon: Truck,
      badge: tr('badge_suppliers'),
    },
    {
      id: 'work_orders',
      label: tr('mod_work_orders'),
      sublabel: tr('sub_work_orders'),
      icon: Hammer,
      badge: tr('badge_work_orders'),
    },
    {
      id: 'calculator',
      label: tr('mod_calculator'),
      sublabel: tr('sub_calculator'),
      icon: Calculator,
      badge: tr('badge_calculator'),
    },
    {
      id: 'inventory',
      label: tr('mod_inventory'),
      sublabel: tr('sub_inventory'),
      icon: Boxes,
      badge: tr('badge_inventory'),
    },
    {
      id: 'catalog',
      label: tr('mod_catalog'),
      sublabel: tr('sub_catalog'),
      icon: BookOpen,
      badge: tr('badge_catalog'),
    },
    {
      id: 'archive',
      label: tr('mod_archive'),
      sublabel: tr('sub_archive'),
      icon: FolderArchive,
      badge: tr('badge_archive'),
    },
    {
      id: 'treasuries',
      label: tr('mod_treasuries'),
      sublabel: tr('sub_treasuries'),
      icon: Wallet,
      badge: tr('badge_treasuries'),
    },
    {
      id: 'fixed_assets',
      label: tr('mod_fixed_assets'),
      sublabel: tr('sub_fixed_assets'),
      icon: Building,
      badge: tr('badge_fixed_assets'),
    },
    {
      id: 'currency_rates',
      label: tr('mod_currency_rates'),
      sublabel: tr('sub_currency_rates'),
      icon: DollarSign,
      badge: tr('badge_currency_rates'),
    },
  ];

  // Section 3: CRM (Sales & Customer Relations)
  const crmModules = [
    {
      id: 'sales',
      label: tr('mod_sales'),
      sublabel: tr('sub_sales'),
      icon: ShoppingCart,
      badge: tr('badge_sales'),
    },
    {
      id: 'invoices',
      label: tr('mod_invoices'),
      sublabel: tr('sub_invoices'),
      icon: FileText,
      badge: tr('badge_invoices'),
    },
    {
      id: 'customers',
      label: tr('mod_customers'),
      sublabel: tr('sub_customers'),
      icon: Users,
      badge: tr('badge_customers'),
    },
  ];

  // Section 4: HR (Human Resources)
  const hrModules = [
    {
      id: 'hr',
      label: tr('mod_hr'),
      sublabel: tr('sub_hr'),
      icon: Users2,
      badge: tr('badge_hr'),
    },
    {
      id: 'expenses',
      label: tr('mod_expenses'),
      sublabel: tr('sub_expenses'),
      icon: DollarSign,
      badge: tr('badge_expenses'),
    },
  ];

  // Section 5: System & Data Management
  const systemModules = [
    {
      id: 'reports',
      label: tr('mod_reports'),
      sublabel: tr('sub_reports'),
      icon: BarChart3,
      badge: tr('badge_reports'),
    },
    {
      id: 'ai_agent',
      label: tr('mod_ai_agent'),
      sublabel: tr('sub_ai_agent'),
      icon: Sparkles,
      badge: tr('badge_ai_agent'),
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-xs sm:max-w-sm h-full shadow-2xl border-l border-stone-200 dark:border-stone-800 flex flex-col text-right animate-in slide-in-from-right duration-300">
        {/* Top Header */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <AlShamsBrandLogo size="sm" showSubtitle={false} />
        </div>

        {/* Artisan / Super Admin Profile Card */}
        {isUserAdmin(profile) ? (
          <div className="p-4 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white border-b border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center text-xl shadow-md">
                👑
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-black text-xs text-amber-200">كبير عيلة الشمساوية</h4>
                  <span className="text-[8px] px-1.5 py-0.2 rounded bg-amber-500 text-stone-950 font-mono font-black">SUPER</span>
                </div>
                <p className="text-[10px] text-stone-300 font-bold font-mono truncate max-w-[170px]" dir="ltr">
                  {profile.email || 'hmb.top.tupe@gmail.com'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpenProfileSettings();
                onClose();
              }}
              title={tr('workshop_profile_settings')}
              className="p-2 rounded-xl text-stone-400 hover:text-amber-300 hover:bg-white/10 transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 bg-stone-50 dark:bg-stone-800/40 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArtisanAvatar
                logoUrl={profile.logoBase64}
                artistName={profile.artistName}
                size="md"
              />
              <div className="text-right">
                <h4 className="font-black text-xs text-stone-900 dark:text-stone-100">
                  {profile.artistName}
                </h4>
                <p className="text-[10px] text-stone-500 font-medium">
                  {profile.brandName || tr('workshop_hub_desc')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpenProfileSettings();
                onClose();
              }}
              title={tr('workshop_profile_settings')}
              className="p-2 rounded-xl text-stone-500 hover:text-amber-600 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Actions Bar (الإشعارات، الدارك مود، حِرف الورشة) */}
        <div className="p-2.5 bg-amber-500/10 dark:bg-amber-950/20 border-b border-amber-200/40 dark:border-amber-900/40 grid grid-cols-3 gap-1.5 text-center text-xs">
          <button
            type="button"
            onClick={() => {
              onOpenNotifications();
              onClose();
            }}
            className="relative py-2 px-1 rounded-xl bg-white dark:bg-stone-800 border border-amber-200/80 dark:border-stone-700 font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-50 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-2xs"
          >
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-[10px]">{tr('notifications')}</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-mono font-black text-white animate-pulse">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenCraftsSelector();
              onClose();
            }}
            className="py-2 px-1 rounded-xl bg-white dark:bg-stone-800 border border-amber-200/80 dark:border-stone-700 font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-50 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-2xs"
          >
            <Layers className="w-4 h-4 text-amber-600" />
            <span className="text-[10px]">{tr('workshop_crafts')}</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="py-2 px-1 rounded-xl bg-white dark:bg-stone-800 border border-amber-200/80 dark:border-stone-700 font-bold text-stone-800 dark:text-stone-200 hover:bg-amber-50 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-2xs"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-[10px]">{tr('light_mode')}</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-stone-600" />
                <span className="text-[10px]">{tr('dark_mode')}</span>
              </>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* RESTRUCTURED ENTERPRISE NAVIGATION (SaaS Hierarchy) */}
        {/* ========================================================= */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-3">
          {isUserAdmin(profile) ? (
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 border border-amber-500/40 text-white space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                    <span>👑</span>
                    <span>منظومة الحوكمة والتحكم المركزي</span>
                  </span>
                  <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 font-black font-mono">
                    MASTER ERP
                  </span>
                </div>
                <p className="text-[10px] text-stone-300 leading-tight">
                  كبير عيلة الشمساوية • إشراف كامل وتجاوز عزل الورش
                </p>
              </div>

              {/* Master Super Admin Navigation Links */}
              {[
                {
                  id: 'admin',
                  label: 'لوحة التحكم وإدارة الورش',
                  sublabel: 'إشراف، إيقاف، حظر، وتكريم الورش',
                  icon: ShieldCheck,
                  color: 'text-amber-500',
                  bg: 'bg-amber-500/10',
                },
                {
                  id: 'ai_agent',
                  label: 'المساعد الذكي (صقر & شموسة)',
                  sublabel: 'الرؤية الهندسية وبروتوكول التدريب المباشر',
                  icon: Sparkles,
                  color: 'text-yellow-500',
                  bg: 'bg-yellow-500/10',
                },
                {
                  id: 'materials',
                  label: 'مستودع الخامات المركزي',
                  sublabel: 'جرد وتحديث أسعار تكلفة خامات المنظومة',
                  icon: Layers,
                  color: 'text-blue-500',
                  bg: 'bg-blue-500/10',
                },
                {
                  id: 'catalog',
                  label: 'كتالوج ومنتجات الورش',
                  sublabel: 'استعراض كافة المنتجات والتسعير الحرفي',
                  icon: BookOpen,
                  color: 'text-emerald-500',
                  bg: 'bg-emerald-500/10',
                },
                {
                  id: 'hr',
                  label: 'جهات الاتصال وفرق العمل',
                  sublabel: 'العملاء، الموردين، والحرفيين والصناع',
                  icon: Users,
                  color: 'text-purple-500',
                  bg: 'bg-purple-500/10',
                },
                {
                  id: 'treasuries',
                  label: 'الخزائن والأرشيف المالي',
                  sublabel: 'أرصدة الخزائن وحركات التحويل والطلبيات',
                  icon: Wallet,
                  color: 'text-teal-500',
                  bg: 'bg-teal-500/10',
                },
                {
                  id: 'appeals',
                  label: 'مركز الطعون والشكاوى',
                  sublabel: 'مراجعة طعون الورش الموقوفة وفك التجميد',
                  icon: Scale,
                  color: 'text-rose-500',
                  bg: 'bg-rose-500/10',
                },
                {
                  id: 'messaging',
                  label: 'مركز المراسلات (بوسطة)',
                  sublabel: 'إرسال التعميمات واستقبال ردود الفنانين',
                  icon: Mail,
                  color: 'text-sky-500',
                  bg: 'bg-sky-500/10',
                },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'messaging' && onOpenMessagesHub) {
                        onOpenMessagesHub();
                      } else {
                        onSelectView(item.id);
                      }
                      onClose();
                    }}
                    className={`w-full p-2.5 rounded-2xl flex items-center justify-between text-right transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-amber-600 text-white font-black shadow-md border-amber-500'
                        : 'bg-stone-50/80 dark:bg-stone-850/60 hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : `${item.bg} ${item.color}`
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black block">{item.label}</span>
                        <span
                          className={`text-[9.5px] block leading-tight ${
                            isActive ? 'text-amber-100' : 'text-stone-400'
                          }`}
                        >
                          {item.sublabel}
                        </span>
                      </div>
                    </div>
                    <ChevronLeft className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-300'}`} />
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* 1. التطبيقات (الرئيسية مع كل أزرار التطبيقات) */}
              <div className="pb-1">
            <button
              type="button"
              onClick={() => {
                onSelectView('home');
                onClose();
              }}
              className={`w-full p-3 rounded-2xl flex items-center justify-between text-right transition-all cursor-pointer border ${
                activeView === 'home' || activeView === 'create_center'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md border-amber-500 font-black'
                  : 'bg-amber-50/70 dark:bg-stone-800/80 hover:bg-amber-100/70 text-stone-900 dark:text-stone-100 border-amber-200 dark:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    activeView === 'home' || activeView === 'create_center'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500 text-white shadow-xs'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black block">{tr('sec_apps')}</span>
                  <span
                    className={`text-[9.5px] block leading-tight ${
                      activeView === 'home' || activeView === 'create_center'
                        ? 'text-amber-100'
                        : 'text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {tr('sec_apps_sub')}
                  </span>
                </div>
              </div>
              <ChevronLeft
                className={`w-4 h-4 ${
                  activeView === 'home' || activeView === 'create_center'
                    ? 'text-white'
                    : 'text-amber-600'
                }`}
              />
            </button>
          </div>

          {/* 2. تخطيط الموارد (ERP) */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/40 p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => toggleSection('erp')}
              className="w-full px-2.5 py-1.5 flex items-center justify-between text-right cursor-pointer group"
            >
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[10px] font-black font-mono">
                  ERP
                </span>
                <span className="text-xs font-black text-stone-900 dark:text-stone-100 group-hover:text-blue-600 transition-colors">
                  {tr('sec_erp')}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                  collapsedSections.erp ? '-rotate-90' : ''
                }`}
              />
            </button>

            {!collapsedSections.erp && (
              <div className="space-y-0.5 pt-0.5">
                {erpModules.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectView(item.id);
                        onClose();
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-black shadow-xs'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold block">{item.label}</span>
                          <span
                            className={`text-[9px] block leading-tight ${
                              isActive ? 'text-blue-100' : 'text-stone-400'
                            }`}
                          >
                            {item.sublabel}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft
                        className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-300'}`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. المبيعات والعلاقات (CRM) */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/40 p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => toggleSection('crm')}
              className="w-full px-2.5 py-1.5 flex items-center justify-between text-right cursor-pointer group"
            >
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-black font-mono">
                  CRM
                </span>
                <span className="text-xs font-black text-stone-900 dark:text-stone-100 group-hover:text-emerald-600 transition-colors">
                  {tr('sec_crm')}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                  collapsedSections.crm ? '-rotate-90' : ''
                }`}
              />
            </button>

            {!collapsedSections.crm && (
              <div className="space-y-0.5 pt-0.5">
                {crmModules.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectView(item.id);
                        onClose();
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white font-black shadow-xs'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold block">{item.label}</span>
                          <span
                            className={`text-[9px] block leading-tight ${
                              isActive ? 'text-emerald-100' : 'text-stone-400'
                            }`}
                          >
                            {item.sublabel}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft
                        className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-300'}`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. الموارد البشرية (HR) */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/40 p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => toggleSection('hr')}
              className="w-full px-2.5 py-1.5 flex items-center justify-between text-right cursor-pointer group"
            >
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 text-[10px] font-black font-mono">
                  HR
                </span>
                <span className="text-xs font-black text-stone-900 dark:text-stone-100 group-hover:text-purple-600 transition-colors">
                  {tr('sec_hr')}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                  collapsedSections.hr ? '-rotate-90' : ''
                }`}
              />
            </button>

            {!collapsedSections.hr && (
              <div className="space-y-0.5 pt-0.5">
                {hrModules.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectView(item.id);
                        onClose();
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-600 text-white font-black shadow-xs'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold block">{item.label}</span>
                          <span
                            className={`text-[9px] block leading-tight ${
                              isActive ? 'text-purple-100' : 'text-stone-400'
                            }`}
                          >
                            {item.sublabel}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft
                        className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-300'}`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. إدارة النظام والبيانات (System & Data Management) */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/40 p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => toggleSection('system')}
              className="w-full px-2.5 py-1.5 flex items-center justify-between text-right cursor-pointer group"
            >
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10px] font-black font-mono">
                  SYSTEM
                </span>
                <span className="text-xs font-black text-stone-900 dark:text-stone-100 group-hover:text-amber-600 transition-colors">
                  {tr('sec_system')}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                  collapsedSections.system ? '-rotate-90' : ''
                }`}
              />
            </button>

            {!collapsedSections.system && (
              <div className="space-y-0.5 pt-0.5">
                {/* Admin Dashboard if authorized */}
                {isUserAdmin(profile) && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView('admin');
                      onClose();
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer ${
                      activeView === 'admin'
                        ? 'bg-purple-700 text-white font-black shadow-xs'
                        : 'text-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-black block">{tr('mod_admin')}</span>
                        <span className="text-[9px] text-stone-400 block">{tr('sub_admin')}</span>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 font-mono">
                      Admin
                    </span>
                  </button>
                )}

                {systemModules.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectView(item.id);
                        onClose();
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-600 text-white font-black shadow-xs'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold block">{item.label}</span>
                          <span
                            className={`text-[9px] block leading-tight ${
                              isActive ? 'text-amber-100' : 'text-stone-400'
                            }`}
                          >
                            {item.sublabel}
                          </span>
                        </div>
                      </div>
                      <ChevronLeft
                        className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-stone-300'}`}
                      />
                    </button>
                  );
                })}

                {/* مركز المراسلات والإعلانات */}
                {onOpenMessagesHub && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMessagesHub();
                      onClose();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer text-stone-700 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold block">مركز المراسلات (بوسطة)</span>
                          {unreadMessagesCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-500 text-stone-900 text-[10px] font-black rounded-full animate-bounce">
                              {unreadMessagesCount}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-stone-400 block">
                          توجيهات وإعلانات إدارة المنظومة
                        </span>
                      </div>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 text-stone-300" />
                  </button>
                )}

                {/* اعدادات الورشة */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenProfileSettings();
                    onClose();
                  }}
                  className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center justify-center">
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold block">{tr('mod_settings')}</span>
                      <span className="text-[9px] text-stone-400 block">
                        {tr('sub_settings')}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-stone-300" />
                </button>

                {/* وضع السهر الحرفي المريح للعين ومظهر الورشة */}
                {onSelectThemeMode && (
                  <div className="p-2.5 rounded-xl bg-stone-100/80 dark:bg-stone-850/60 border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-black text-stone-700 dark:text-stone-300">
                      <span>مظهر الورشة وإضاءة العمل</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                        {themeMode === 'night_focus' ? 'سهر هادئ' : themeMode === 'dark' ? 'داكن' : 'نهاري'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectThemeMode('light')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          themeMode === 'light'
                            ? 'bg-white text-amber-900 shadow-xs font-black border border-amber-300'
                            : 'text-stone-600 dark:text-stone-400 hover:bg-white/50 dark:hover:bg-stone-800'
                        }`}
                        title="الوضع النهاري"
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-600" />
                        <span>نهاري</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectThemeMode('night_focus')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          themeMode === 'night_focus'
                            ? 'bg-amber-900/60 text-amber-200 shadow-xs font-black border border-amber-500/80 ring-1 ring-amber-500/30'
                            : 'text-stone-600 dark:text-stone-400 hover:bg-amber-950/30 hover:text-amber-300'
                        }`}
                        title="وضع السهر الهادئ - درجات الكهرمان المريحة للعين"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>سهر هادئ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectThemeMode('dark')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          themeMode === 'dark'
                            ? 'bg-stone-800 text-stone-100 shadow-xs font-black border border-stone-700'
                            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-800'
                        }`}
                        title="الوضع الليلي"
                      >
                        <Moon className="w-3.5 h-3.5 text-stone-400" />
                        <span>داكن</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* حفظ نسخة من بيانات الورشة في جهازك */}
                <button
                  type="button"
                  onClick={handleSaveWorkshopDataToDevice}
                  disabled={isSavingBackup}
                  className="w-full px-2.5 py-2.5 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      {isSavingBackup ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-black block">
                        {isSavingBackup ? 'جاري تجهيز النسخة...' : 'حفظ نسخة من بيانات الورشة في جهازك'}
                      </span>
                      <span className="text-[9px] text-emerald-700/80 dark:text-emerald-300/80 block">
                        الخامات، المنتجات، المبيعات، والإعدادات
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
                </button>

                {backupSuccessMessage && (
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-xs font-black flex items-center gap-2 animate-in fade-in">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                    <span>{backupSuccessMessage}</span>
                  </div>
                )}
              </div>
            )}
          </div>
            </>
          )}
        </nav>

        {/* Utilities: Guide + Migration + Logout */}
        <div className="p-3 border-t border-stone-100 dark:border-stone-800 space-y-2 bg-stone-50 dark:bg-stone-900/60">
          {/* Interactive Tour Button */}
          {onStartTour && (
            <button
              type="button"
              onClick={() => {
                onStartTour();
                onClose();
              }}
              className="w-full py-2 px-3 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center justify-center gap-2 cursor-pointer shadow-2xs text-xs font-black transition active:scale-95"
            >
              <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{tr('mod_tour')}</span>
            </button>
          )}

          <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                onOpenUserGuide();
                onClose();
              }}
              className="py-2 px-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 flex flex-col items-center justify-center gap-1 cursor-pointer shadow-2xs text-[10px]"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>{tr('mod_guide')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenSupport) onOpenSupport();
                onClose();
              }}
              className="py-2 px-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 flex flex-col items-center justify-center gap-1 cursor-pointer shadow-2xs text-[10px]"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{tr('mod_support')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenCloudMigration();
                onClose();
              }}
              className="py-2 px-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 flex flex-col items-center justify-center gap-1 cursor-pointer shadow-2xs text-[10px]"
            >
              <CloudUpload className="w-3.5 h-3.5 text-blue-600" />
              <span>{tr('mod_cloud')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-bold flex items-center justify-center gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{tr('mod_logout')}</span>
          </button>

          <div className="text-center pt-1 border-t border-stone-200/50 dark:border-stone-800/50">
            <p className="text-[10px] text-stone-400 dark:text-stone-500 font-bold">
              {tr('saas_enterprise_footer')}
            </p>
          </div>
        </div>
      </div>

      {/* نافذة تأكيد نجاح حفظ النسخة مميزة ومبهجة */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-stone-900 border-2 border-emerald-500/80 dark:border-emerald-500 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-black border border-emerald-200 dark:border-emerald-800">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>حفظ آمن ومكتمل</span>
              </span>
              <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 leading-snug">
                تم حفظ كامل بيانات ورشتك بنجاح في جهازك، بياناتك في أمان تام
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
                تم تنزيل ملف النسخة في مجلد التنزيلات على جهازك، ويتضمن كامل أرشيف الخامات، المنتجات، المبيعات، الفواتير، وحركات الخزينة.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 text-right space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-stone-700 dark:text-stone-300">
                <span className="text-stone-500">اسم الورشة:</span>
                <span className="font-black text-amber-800 dark:text-amber-300">{profile.brandName || 'ورشة الشمساوية'}</span>
              </div>
              <div className="flex justify-between items-center text-stone-700 dark:text-stone-300">
                <span className="text-stone-500">حالة النسخة:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">مكتملة ومحفوظة محلياً بالكامل</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCelebrationModal(false)}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95"
            >
              استمرار العمل في الورشة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
