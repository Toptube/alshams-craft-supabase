import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserProfile,
  SavedProductRecord,
  CraftCategory,
  NotificationItem,
  isUserAdmin,
  AdminAnnouncement,
  WorkshopMessageReceipt,
  ThemeMode,
} from './types';
import { supabase } from './lib/supabase';
import { getCurrentWorkshopFromSupabase, getArabicSupabaseError } from './db/supabaseService';
import { flushProductSync, startProductSync } from './db/productsCloud';
import { tenantStorage } from './db/dexieDB';
import { playPostaNotificationSound } from './lib/sounds';
import { startQuietBackgroundSync, hydrateWorkshopIntoDexie } from './services/periodicQuietSync';
import { syncPlatformSettingsFromCloud } from './services/marketplaceCartService';
import { getStoredLandingCmsConfig, syncBrandFaviconFromCms } from './types/landingCms';
import { useFeatureFlags } from './types/featureFlags';
import { getCurrentSupplierFromSupabase } from './db/supplierService';

// Access Control & Messaging
import { AccessGate } from './components/gate/AccessGate';
import { MessagesHubModal } from './components/messages/MessagesHubModal';

// Layout Components
import { Navbar } from './components/layout/Navbar';
import { SidebarDrawer } from './components/layout/SidebarDrawer';

// Main Views
import { WorkshopHomeScreen } from './components/home/WorkshopHomeScreen';
import { ProductionCalculator } from './components/calculator/ProductionCalculator';
import { ProductArchive } from './components/archive/ProductArchive';
import { WorkshopCatalog } from './components/catalog/WorkshopCatalog';
import { MaterialsView } from './components/materials/MaterialsView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { CustomersView } from './components/customers/CustomersView';
import { SalesOrdersView } from './components/sales/SalesOrdersView';
import { InvoicesView } from './components/invoices/InvoicesView';
import { WorkOrdersView } from './components/workOrders/WorkOrdersView';
import { TreasuriesView } from './components/treasuries/TreasuriesView';
import { FixedAssetsView } from './components/assets/FixedAssetsView';
import { HRWorkforceModule } from './components/hr/HRWorkforceModule';
import { SaaSReportsAnalyticsView } from './components/reports/SaaSReportsAnalyticsView';
import { FalconAIAgent, StructuredCalculatorExport } from './components/ai/FalconAIAgent';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PurchasesView } from './components/purchases/PurchasesView';
import { AccountsView } from './components/accounting/AccountsView';
import { AuthGateway } from './components/auth/AuthGateway';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { CompleteWorkshopScreen } from './components/auth/CompleteWorkshopScreen';
import { LandingPage } from './components/landing/LandingPage';

// Modals & Drawers
import { GlobalSearchModal, GlobalSearchDataCache } from './components/search/GlobalSearchModal';
import { UnifiedAlertsModal } from './components/notifications/UnifiedAlertsModal';
import { ProfileSettingsModal } from './components/profile/ProfileSettingsModal';
import { CraftsSelectorModal } from './components/onboarding/CraftsSelectorModal';
import { UserGuideModal } from './components/guide/UserGuideModal';
import { CloudMigrationModal } from './components/migration/CloudMigrationModal';
import { SupportModal } from './components/support/SupportModal';
import { InteractiveTourModal } from './components/tour/InteractiveTourModal';
import { ExchangeRatesModal } from './components/currency/ExchangeRatesModal';
import { InventoryLedgerModal } from './components/inventory/InventoryLedgerModal';
import { MaterialsInventoryModal } from './components/inventory/MaterialsInventoryModal';
import { ProductsInventoryModal } from './components/inventory/ProductsInventoryModal';
import { AdminExpensesModal } from './components/adminCosts/AdminExpensesModal';
import { WhatsAppQuoteDrawer } from './components/sharing/WhatsAppQuoteDrawer';

// Creation Modals
import {
  NewMaterialModal,
  NewClientModal,
  NewSupplierModal,
  NewEmployeeModal,
} from './components/modals/CreationModals';

// Shamousa Chat Widget & Unified AI
import { ShamousaChatWidget } from './components/ai/ShamousaChatWidget';
import { UnifiedAICommandCenter } from './components/ai/UnifiedAICommandCenter';
import { ExecutiveTab } from './components/admin/AdminDashboard';
import { MarketplaceView } from './components/marketplace/MarketplaceView';
import { ArtisanStorefrontModal } from './components/store/ArtisanStorefrontModal';
import { PublicStorefrontView } from './components/store/PublicStorefrontView';
import { FamilyCommunityView } from './components/family/FamilyCommunityView';
import { SupplierHomeScreen } from './components/supplier/SupplierHomeScreen';
import { SupplierCatalogView } from './components/supplier/SupplierCatalogView';
import { SupplierOrdersView } from './components/supplier/SupplierOrdersView';
import { SupplierCustomersView } from './components/supplier/SupplierCustomersView';
import { SupplierFinanceView } from './components/supplier/SupplierFinanceView';
import { SupplierStorefrontModal } from './components/supplier/SupplierStorefrontModal';
import { SuppliersMarketView } from './components/supplier/SuppliersMarketView';
import { SupplierPublicStoreView } from './components/supplier/SupplierPublicStoreView';
import { SupplierErpHubView } from './components/supplier/SupplierErpHubView';
import { SupplierPosView } from './components/supplier/SupplierPosView';
import { SupplierBranchesWarehouseView } from './components/supplier/SupplierBranchesWarehouseView';
import { SupplierHrTerminalView } from './components/supplier/SupplierHrTerminalView';
import { LockedTerminalShell } from './components/supplier/LockedTerminalShell';
import {
  getLockedTerminalConfig,
  KIOSK_LOCK_CHANGED_EVENT,
} from './db/supplierErpService';
import { LockedTerminalConfig } from './types/supplierErp';
import { MemberPersonalProfileView } from './components/profile/MemberPersonalProfileView';
import {
  registerServiceWorker,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  checkAndDispatchEquipmentMaintenanceAlerts,
} from './lib/pushNotifications';
import { PermissionsOnboardingModal } from './components/permissions/PermissionsOnboardingModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { initOfflineSyncListeners, flushOfflineMutations } from './db/offlineMutationQueue';

// Icons for the sub-page navigation bar
import { ArrowRight, Home, Sparkles, X } from 'lucide-react';

export type ActiveView =
  | 'home'
  | 'calculator'
  | 'archive'
  | 'catalog'
  | 'materials'
  | 'purchases'
  | 'suppliers'
  | 'suppliers_market'
  | 'customers'
  | 'sales'
  | 'invoices'
  | 'work_orders'
  | 'treasuries'
  | 'accounts'
  | 'fixed_assets'
  | 'hr'
  | 'reports'
  | 'ai_agent'
  | 'admin'
  | 'appeals'
  | 'messaging'
  | 'marketplace'
  | 'family'
  | 'supplier_catalog'
  | 'supplier_orders'
  | 'supplier_customers'
  | 'supplier_finance'
  | 'supplier_store'
  | 'supplier_erp_hub'
  | 'supplier_pos'
  | 'supplier_warehouse_erp'
  | 'supplier_hr_terminal'
  | 'personal_profile';

const processedRecoveryTokens = new Set<string>();

function isJwtRecoverySession(session: any): boolean {
  try {
    const token = session?.access_token;
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const payload = JSON.parse(atob(b64 + pad));
    if (Array.isArray(payload?.amr)) {
      return payload.amr.some(
        (item: any) => String(item?.method || '').toLowerCase() === 'recovery'
      );
    }
  } catch {}
  return false;
}

const VIEW_TITLES: Record<ActiveView, string> = {
  home: 'لوحة تحكم الورشة',
  calculator: 'حاسبة تكاليف الإنتاج والتسعير',
  archive: 'أرشيف المنتجات والمشغولات',
  catalog: 'كتالوج الورشة والمنتجات',
  materials: 'المخزن وإدارة الخامات',
  purchases: 'المشتريات وفواتير الخامات',
  suppliers: 'مورديني',
  suppliers_market: 'سوق موردين الشمساوية للخامات',
  customers: 'عملائي',
  sales: 'طلبيات ومبيعات الورشة',
  invoices: 'الفواتير وعروض الأسعار',
  work_orders: 'أوامر الشغل والتصنيع',
  treasuries: 'الخزينة والأرصدة والعهد',
  accounts: 'دفتر حركة الورشة المالي والحسابات',
  fixed_assets: 'إدارة الأصول الثابتة',
  hr: 'شؤون العاملين والحرفيين',
  reports: 'التقارير المالية والتحليلية',
  ai_agent: 'المساعد الذكي (صقر & شموسة)',
  admin: 'لوحة الإدارة والتحكم الشاملة',
  appeals: 'مركز الطعون والشكاوى الرقابي',
  messaging: 'مركز المراسلات الحية (بوسطة)',
  marketplace: 'سوق الشمساوية المركزي (متعدد التجار)',
  family: 'مجتمع عيلة الشمساويه',
  supplier_catalog: 'كتالوج الخامات والمخزون',
  supplier_orders: 'أوردراتي وطلبات التوريد',
  supplier_customers: 'عملائي (الورش والأفراد)',
  supplier_finance: 'خزائن المورد والمصروفات',
  supplier_store: 'لوحة تحكم متجر المورد',
  supplier_erp_hub: 'مركز قيادة الفروع والخزينة (ERP)',
  supplier_pos: 'كاشير نقاط البيع (POS)',
  supplier_warehouse_erp: 'المخازن وكارت الصنف والمصانع',
  supplier_hr_terminal: 'شؤون العاملين وتثبيت الشاشات',
  personal_profile: 'صفحتي الشخصية ومعرض الأعمال',
};

const DEFAULT_PROFILE: UserProfile = {
  id: '00000000-0000-0000-0000-000000000000',
  tenantId: '00000000-0000-0000-0000-000000000000',
  workshopId: '00000000-0000-0000-0000-000000000000',
  ownerUid: '00000000-0000-0000-0000-000000000000',
  email: 'artist@alshams.craft',
  artistName: 'فنان الشمساوية',
  brandName: 'الشمساوية هاند ميد',
  gender: 'male',
  phoneNumber: '01000000000',
  country: 'مصر',
  currency: 'EGP',
  currencySymbol: 'ج.م',
  selectedCrafts: ['macrame'],
  defaultVatPercent: 14,
  showTaxInfoOnInvoice: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'system',
};

export const App: React.FC = () => {
  // Authentication & Profile state
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('alshams_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          parsed.id &&
          parsed.id !== 'workshop_demo' &&
          parsed.workshopId !== 'workshop_demo' &&
          parsed.id !== '00000000-0000-0000-0000-000000000000'
        ) {
          return parsed;
        } else {
          localStorage.removeItem('alshams_profile');
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const featureFlags = useFeatureFlags();
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [suspensionNotice, setSuspensionNotice] = useState<string | null>(null);
  const [showAuthGateway, setShowAuthGateway] = useState<boolean>(false);
  const [authGatewayMode, setAuthGatewayMode] = useState<'login' | 'signup'>('login');
  const [authRegisterRole, setAuthRegisterRole] = useState<'artisan' | 'supplier'>('artisan');
  const [oauthIntendedRole, setOauthIntendedRole] = useState<'artisan' | 'supplier'>('artisan');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    return /[?&](recovery=1|type=recovery)/i.test(search) || /type=recovery/i.test(hash);
  });
  const [pendingGoogleSessionUser, setPendingGoogleSessionUser] = useState<{
    email: string;
    fullName?: string;
  } | null>(null);

  // Welcome message shown only once upon opening the app
  const [showWelcomeBanner, setShowWelcomeBanner] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('alshams_welcome_shown');
    }
    return true;
  });

  useEffect(() => {
    if (profile && showWelcomeBanner) {
      sessionStorage.setItem('alshams_welcome_shown', 'true');
      const timer = setTimeout(() => {
        setShowWelcomeBanner(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [profile, showWelcomeBanner]);

  // Navigation & View state (supports direct deep-link to /family, /#/family, and PWA shortcuts)
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname || '';
      const h = window.location.hash || '';
      const s = window.location.search || '';
      if (
        /^\/family(?:\/|$)/i.test(p) ||
        /^#\/?family(?:\/|$)/i.test(h) ||
        /[?&]view=family(?:&|$)/i.test(s)
      ) {
        return 'family';
      }
      if (/[?&]view=catalog(?:&|$)/i.test(s)) {
        return 'catalog';
      }
    }
    return 'home';
  });
  const [historyStack, setHistoryStack] = useState<ActiveView[]>([]);
  const [adminInitialTab, setAdminInitialTab] = useState<ExecutiveTab>('home');
  const [adminNavNonce, setAdminNavNonce] = useState<number>(0);
  const [catalogInitialTab, setCatalogInitialTab] = useState<'catalog' | 'store'>(() => {
    if (typeof window !== 'undefined' && /[?&]tab=store(?:&|$)/i.test(window.location.search || '')) {
      return 'store';
    }
    return 'catalog';
  });
  const [workOrdersInitialStage, setWorkOrdersInitialStage] = useState<'create' | 'issue' | 'receive' | undefined>(undefined);
  const [purchaseInitialMaterial, setPurchaseInitialMaterial] = useState<{
    materialId: string;
    materialName?: string;
    supplierId?: string;
    unitCost?: number;
    unitName?: string;
    quantity?: number;
  } | null>(null);

  const handleOpenPurchaseForMaterial = useCallback((mat: {
    materialId: string;
    materialName?: string;
    supplierId?: string;
    unitCost?: number;
    unitName?: string;
    quantity?: number;
  }) => {
    setPurchaseInitialMaterial(mat);
    setIsMaterialsModalOpen(false);
    setActiveView('purchases');
  }, []);

  // Modals state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState<boolean>(false);
  const [isCraftsSelectorOpen, setIsCraftsSelectorOpen] = useState<boolean>(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState<boolean>(false);
  const [userGuideSection, setUserGuideSection] = useState<string | undefined>(undefined);
  const [isCloudMigrationOpen, setIsCloudMigrationOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [isExchangeRatesOpen, setIsExchangeRatesOpen] = useState<boolean>(false);
  const [isInventoryLedgerOpen, setIsInventoryLedgerOpen] = useState<boolean>(false);
  const [isMaterialsModalOpen, setIsMaterialsModalOpen] = useState<boolean>(false);
  const [isProductsModalOpen, setIsProductsModalOpen] = useState<boolean>(false);
  const [isAdminExpensesOpen, setIsAdminExpensesOpen] = useState<boolean>(false);

  // Quick creation modals
  const [isNewMaterialOpen, setIsNewMaterialOpen] = useState<boolean>(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState<boolean>(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState<boolean>(false);
  const [isNewEmployeeOpen, setIsNewEmployeeOpen] = useState<boolean>(false);

  // Dedicated Artisan & Supplier Storefront state
  const [isArtisanStoreModalOpen, setIsArtisanStoreModalOpen] = useState<boolean>(false);
  const [isSupplierStoreModalOpen, setIsSupplierStoreModalOpen] = useState<boolean>(false);
  const [selectedStoreOrderId, setSelectedStoreOrderId] = useState<string | undefined>(undefined);
  const [artisanStoreInitialTab, setArtisanStoreInitialTab] = useState<
    'products' | 'appearance' | 'promotions' | 'orders' | 'qr'
  >('products');

  const handleOpenArtisanStore = (
    tab: 'products' | 'appearance' | 'promotions' | 'orders' | 'qr' = 'products'
  ) => {
    if (profile?.accountRole === 'supplier') {
      setIsSupplierStoreModalOpen(true);
      return;
    }
    setSelectedStoreOrderId(undefined);
    setArtisanStoreInitialTab(tab);
    setIsArtisanStoreModalOpen(true);
  };

  // Calculator interaction state
  const [calculatorInitialRecord, setCalculatorInitialRecord] = useState<SavedProductRecord | null>(null);
  const [calculatorExternalNotes, setCalculatorExternalNotes] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<CraftCategory>('جدارية');

  // WhatsApp Quote Sharing drawer state
  const [quoteRecord, setQuoteRecord] = useState<SavedProductRecord | null>(null);
  const [isQuoteDrawerOpen, setIsQuoteDrawerOpen] = useState<boolean>(false);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [adminAlerts, setAdminAlerts] = useState<any[]>([]);
  const [notificationsInitialTab, setNotificationsInitialTab] = useState<'admin' | 'notifications' | 'messages'>('notifications');

  // Messaging Hub (بوسطة) & Announcements state
  const [isMessagesHubOpen, setIsMessagesHubOpen] = useState<boolean>(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('alshams_permissions_prompted');
  });
  const [announcements, setAnnouncements] = useState<(AdminAnnouncement & { receipt?: WorkshopMessageReceipt })[]>([]);
  const [adminInboxUnreadCount, setAdminInboxUnreadCount] = useState<number>(0);

  // Super Admin Multi-Tenant Workshop Switcher Context
  const [switchedWorkshopContext, setSwitchedWorkshopContext] = useState<any | null>(null);
  const [originalSuperAdminProfile, setOriginalSuperAdminProfile] = useState<UserProfile | null>(null);

  const isSuperAdminMode = Boolean(profile && isUserAdmin(profile) && !switchedWorkshopContext);

  const adminBellCounts = useMemo(() => {
    let workshopsCount = 0;
    let storeCount = 0;
    let systemCount = 0;
    adminAlerts.forEach((a) => {
      const cat = String(a?.category || a?.type || '').toLowerCase();
      if (cat.includes('product') || cat.includes('market') || cat.includes('order') || cat.includes('store')) {
        storeCount++;
      } else if (cat.includes('workshop') || cat.includes('app') || cat.includes('appeal')) {
        workshopsCount++;
      } else {
        systemCount++;
      }
    });
    return {
      messages: adminInboxUnreadCount,
      workshops: workshopsCount,
      store: storeCount,
      system: systemCount,
    };
  }, [adminAlerts, adminInboxUnreadCount]);

  // Search cache
  const [searchCache, setSearchCache] = useState<GlobalSearchDataCache>({
    customers: [],
    suppliers: [],
    products: [],
    materials: [],
    invoices: [],
    workOrders: [],
    employees: [],
  });

  // Theme Mode state: 'light' | 'dark' | 'night_focus'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') || localStorage.getItem('alshams_theme');
      if (saved === 'dark' || saved === 'night_focus') return 'dark';
      if (saved === 'light') return 'light';
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  const isDarkMode = themeMode === 'dark' || themeMode === 'night_focus';

  // Root theme toggle handler: directly toggles document.documentElement.classList and saves in localStorage
  const handleToggleTheme = useCallback(() => {
    const root = document.documentElement;
    const isNowDark = !root.classList.contains('dark');
    if (isNowDark) {
      root.classList.add('dark');
      root.classList.remove('night-focus');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('alshams_theme', 'dark');
      setThemeMode('dark');
    } else {
      root.classList.remove('dark', 'night-focus');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('alshams_theme', 'light');
      setThemeMode('light');
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'night_focus') {
      root.classList.add('dark', 'night-focus');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('alshams_theme', 'night_focus');
    } else if (themeMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('night-focus');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('alshams_theme', 'dark');
    } else {
      root.classList.remove('dark', 'night-focus');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('alshams_theme', 'light');
    }
    syncBrandFaviconFromCms(getStoredLandingCmsConfig());
  }, [themeMode]);

  // مزامنة إعدادات المنصة والأيقونات والهوية البصرية من السحابة فور التشغيل وعند التحديث
  useEffect(() => {
    const applyBrandAssets = () => {
      syncBrandFaviconFromCms(getStoredLandingCmsConfig());
    };
    applyBrandAssets();
    syncPlatformSettingsFromCloud()
      .then(() => applyBrandAssets())
      .catch(() => {});
    window.addEventListener('alshams_landing_cms_updated', applyBrandAssets);
    return () => window.removeEventListener('alshams_landing_cms_updated', applyBrandAssets);
  }, []);

  // Performance Mode / Reduced Motion state (سلاسة الأجهزة الضعيفة)
  const [isPerformanceMode, setIsPerformanceMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('alshams_performance_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleTogglePerformanceMode = useCallback((enabled?: boolean) => {
    setIsPerformanceMode((prev) => {
      const next = enabled !== undefined ? enabled : !prev;
      try {
        localStorage.setItem('alshams_performance_mode', String(next));
      } catch {}
      if (next) {
        document.documentElement.classList.add('performance-mode');
      } else {
        document.documentElement.classList.remove('performance-mode');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (isPerformanceMode) {
      document.documentElement.classList.add('performance-mode');
    } else {
      document.documentElement.classList.remove('performance-mode');
    }

    const handleEventToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled?: boolean }>;
      handleTogglePerformanceMode(customEvent.detail?.enabled);
    };

    window.addEventListener('alshams_toggle_performance_mode', handleEventToggle);
    return () => window.removeEventListener('alshams_toggle_performance_mode', handleEventToggle);
  }, [isPerformanceMode, handleTogglePerformanceMode]);

  // Load search cache & notifications from local Dexie storage
  const loadSearchCacheAndNotifications = useCallback(async () => {
    if (!profile) return;
    const tid = profile.tenantId || profile.workshopId || profile.id;
    try {
      const [custs, sups, prods, mats, emps, notifs] = await Promise.all([
        tenantStorage.getCustomers(tid),
        tenantStorage.getSuppliers(tid),
        tenantStorage.getProducts(tid),
        tenantStorage.getRawMaterials(tid),
        tenantStorage.getEmployees(tid),
        tenantStorage.getNotifications(tid),
      ]);
      setSearchCache({
        customers: custs as any[],
        suppliers: sups as any[],
        products: prods,
        materials: mats,
        invoices: [],
        workOrders: [],
        employees: emps,
      });
      setNotifications(notifs);
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    loadSearchCacheAndNotifications();
  }, [loadSearchCacheAndNotifications]);

  // تشغيل الفحص الوقائي للتنبيهات والاستماع للتحديثات الفورية وعودة الإنترنت
  useEffect(() => {
    if (!profile) return;
    const tid = profile.tenantId || profile.workshopId || profile.id;

    tenantStorage
      .generateProactiveNotifications(tid, profile)
      .then(() => loadSearchCacheAndNotifications())
      .catch(() => {});

    const handleRefreshNotifications = () => {
      loadSearchCacheAndNotifications();
    };

    const handleNewOrder = () => {
      tenantStorage
        .generateProactiveNotifications(tid, profile)
        .then(() => loadSearchCacheAndNotifications())
        .catch(() => {});
    };

    const handleOnlineReconnect = () => {
      flushOfflineMutations().catch(() => {});
      loadSearchCacheAndNotifications();
    };

    window.addEventListener('alshams_notifications_updated', handleRefreshNotifications);
    window.addEventListener('alshams_notifications_changed', handleRefreshNotifications);
    window.addEventListener('alshams_new_order_received', handleNewOrder);
    window.addEventListener('online', handleOnlineReconnect);

    return () => {
      window.removeEventListener('alshams_notifications_updated', handleRefreshNotifications);
      window.removeEventListener('alshams_notifications_changed', handleRefreshNotifications);
      window.removeEventListener('alshams_new_order_received', handleNewOrder);
      window.removeEventListener('online', handleOnlineReconnect);
    };
  }, [profile?.tenantId, profile?.workshopId, profile?.id, loadSearchCacheAndNotifications]);

  // آلية المزامنة الدورية الهادئة في الخلفية ومزامنة الكتالوج والمتجر تلقائياً
  useEffect(() => {
    if (!profile) return;
    const tid = profile.tenantId || profile.workshopId || profile.id;
    const cleanupQuiet = startQuietBackgroundSync(profile);
    const cleanupProducts = tid ? startProductSync(tid) : () => {};
    return () => {
      cleanupQuiet();
      cleanupProducts();
    };
  }, [profile?.tenantId, profile?.workshopId, profile?.id]);

  // Check Supabase session on boot, handle password recovery & Google OAuth onboarding
  useEffect(() => {
    let mounted = true;
    let isChecking = false;
    let recoveryActive = false;

    if (typeof window !== 'undefined') {
      const searchStr = window.location.search || '';
      const hashStr = window.location.hash || '';
      if (/[?&](recovery=1|type=recovery)/i.test(searchStr) || /type=recovery/i.test(hashStr)) {
        recoveryActive = true;
      }
    }

    async function handleInitialUrlAuthParams() {
      if (typeof window === 'undefined') return;
      try {
        const searchParams = new URLSearchParams(window.location.search || '');
        const hashRaw = (window.location.hash || '').replace(/^#/, '');
        const hashParams = new URLSearchParams(hashRaw.startsWith('/') ? '' : hashRaw);

        const urlError =
          searchParams.get('error') ||
          hashParams.get('error') ||
          searchParams.get('error_code') ||
          hashParams.get('error_code');
        const urlErrorDesc =
          searchParams.get('error_description') || hashParams.get('error_description');

        if (urlError || urlErrorDesc) {
          const combined = `${urlError || ''} ${urlErrorDesc || ''}`.toLowerCase();
          if (mounted) {
            if (combined.includes('expired') || combined.includes('otp_expired')) {
              setSuspensionNotice(
                'انتهت صلاحية رابط استعادة كلمة المرور أو تم استخدامه مسبقاً، يرجى طلب رابط جديد.'
              );
            } else if (combined.includes('access_denied') || combined.includes('cancel')) {
              setSuspensionNotice('تم إلغاء تسجيل الدخول، يمكنك المحاولة مرة أخرى.');
            } else if (
              combined.includes('provider is not enabled') ||
              combined.includes('unsupported provider')
            ) {
              setSuspensionNotice(
                'تسجيل الدخول عبر Google غير مفعّل حالياً في إعدادات Supabase (Authentication → Providers → Google).'
              );
            } else {
              const translated = getArabicSupabaseError({
                message: urlErrorDesc || urlError || '',
                code: urlError || undefined,
              });
              setSuspensionNotice(
                translated.arabicMessage || 'حدث خطأ في رابط التحقق، يرجى المحاولة مرة أخرى.'
              );
            }
            recoveryActive = false;
            setIsPasswordRecovery(false);
            setShowAuthGateway(true);
            setAuthGatewayMode('login');
          }
          try {
            localStorage.removeItem('alshams_pending_recovery_ts');
          } catch {}
          window.history.replaceState({}, '', '/');
          return;
        }

        const tokenHash = searchParams.get('token_hash');
        const typeParam = searchParams.get('type');
        if (tokenHash && typeParam === 'recovery') {
          recoveryActive = true;
          if (mounted) setIsPasswordRecovery(true);

          if (!processedRecoveryTokens.has(tokenHash)) {
            processedRecoveryTokens.add(tokenHash);
            const { error: otpErr } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery',
            });
            if (otpErr && mounted) {
              recoveryActive = false;
              setIsPasswordRecovery(false);
              setSuspensionNotice(
                'رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية، يرجى طلب رابط جديد.'
              );
              setShowAuthGateway(true);
              setAuthGatewayMode('login');
              window.history.replaceState({}, '', '/');
              return;
            }
          }
          try {
            localStorage.removeItem('alshams_pending_recovery_ts');
          } catch {}
          window.history.replaceState({}, '', '/?recovery=1');
        }
      } catch {}
    }

    async function checkSession() {
      if (isChecking) return;
      isChecking = true;
      try {
        const hadCodeInUrl =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search || '').has('code');

        await handleInitialUrlAuthParams();

        let { data: { session } } = await supabase.auth.getSession();
        if (!session && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          try {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session) {
              session = refreshed.session;
            }
          } catch {}
        }

        if (session && isJwtRecoverySession(session)) {
          recoveryActive = true;
        }

        if (!session && hadCodeInUrl) {
          let pendingRecoveryRecent = false;
          try {
            const ts = Number(localStorage.getItem('alshams_pending_recovery_ts') || '0');
            pendingRecoveryRecent = ts > 0 && Date.now() - ts < 30 * 60 * 1000;
            localStorage.removeItem('alshams_pending_recovery_ts');
          } catch {}

          if (mounted) {
            const wasRecovery = pendingRecoveryRecent || recoveryActive;
            recoveryActive = false;
            setIsPasswordRecovery(false);
            setSuspensionNotice(
              wasRecovery
                ? 'تعذر التحقق من رابط استعادة كلمة المرور (قد يكون الرابط منتهياً أو فُتح من متصفح/رابط مختلف). يرجى طلب رابط جديد من "نسيت كلمة المرور؟".'
                : 'تعذر إكمال التحقق من الرابط، يرجى المحاولة مرة أخرى من شاشة الدخول.'
            );
            setShowAuthGateway(true);
            setAuthGatewayMode('login');
            setAuthChecking(false);
          }
          window.history.replaceState({}, '', '/');
          return;
        }

        if (recoveryActive) {
          try {
            localStorage.removeItem('alshams_pending_recovery_ts');
          } catch {}
          if (mounted) {
            setIsPasswordRecovery(true);
            setShowAuthGateway(false);
            setAuthChecking(false);
          }
          return;
        }

        if (session?.user && mounted) {
          // فحص حالة الحساب في profiles و workshops
          try {
            const [pCheck, wCheck] = await Promise.all([
              supabase.from('profiles').select('status, workshop_id').eq('id', session.user.id).maybeSingle(),
              supabase.from('workshops').select('status, is_frozen').or(`owner_id.eq.${session.user.id},owner_uid.eq.${session.user.id}`).limit(1).maybeSingle(),
            ]);
            const profStatus = pCheck.data?.status;
            const wsStatus = wCheck.data?.status;
            const isFrozen = wCheck.data?.is_frozen;

            if (profStatus === 'suspended' || wsStatus === 'suspended' || isFrozen) {
              await supabase.auth.signOut().catch(() => {});
              localStorage.removeItem('alshams_profile');
              if (mounted) {
                setProfile(null);
                setPendingGoogleSessionUser(null);
                setSuspensionNotice('تم تعليق حساب الورشة مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
                setAuthChecking(false);
              }
              return;
            }
          } catch {}

          // Check Supplier profile first if registered as supplier, then fallback to workshop
          const supplierProfile = await getCurrentSupplierFromSupabase();
          if (supplierProfile && mounted) {
            if (
              supplierProfile.status === 'suspended' ||
              supplierProfile.status === 'banned' ||
              supplierProfile.isFrozen
            ) {
              await supabase.auth.signOut().catch(() => {});
              localStorage.removeItem('alshams_profile');
              localStorage.removeItem('alshams_supplier_profile');
              setProfile(null);
              setPendingGoogleSessionUser(null);
              setSuspensionNotice('تم تعليق حساب المورد مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
              setAuthChecking(false);
              return;
            }
            setPendingGoogleSessionUser(null);
            setShowAuthGateway(false);
            setProfile(supplierProfile);
            localStorage.setItem('alshams_profile', JSON.stringify(supplierProfile));
          } else {
            // Fetch the real workshop profile strictly owned by current user from Supabase
            const { workshop } = await getCurrentWorkshopFromSupabase();
            if (workshop && mounted) {
              if (workshop.status === 'suspended' || (workshop as any).isFrozen) {
                await supabase.auth.signOut().catch(() => {});
                localStorage.removeItem('alshams_profile');
                setProfile(null);
                setPendingGoogleSessionUser(null);
                setSuspensionNotice('تم تعليق حساب الورشة مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
                setAuthChecking(false);
                return;
              }
              setPendingGoogleSessionUser(null);
              setShowAuthGateway(false);
              setProfile(workshop);
              localStorage.setItem('alshams_profile', JSON.stringify(workshop));
              flushProductSync(workshop.workshopId || workshop.id).catch(() => {});
            } else if (mounted) {
              // New OAuth/Google user with a valid Supabase session but no workshop/supplier yet
              const userEmail = session.user.email || '';
              const isAdminEmail = userEmail.trim().toLowerCase() === 'hmb.top.tube@gmail.com';
              if (!isAdminEmail) {
                const savedRaw = localStorage.getItem('alshams_profile');
                let hasMatchingLocal = false;
                if (savedRaw) {
                  try {
                    const p = JSON.parse(savedRaw);
                    if (p?.email?.toLowerCase() === userEmail.toLowerCase() && p?.id && p.id !== 'workshop_demo') {
                      hasMatchingLocal = true;
                    }
                  } catch {}
                }
                if (!hasMatchingLocal) {
                  const meta = (session.user.user_metadata || {}) as any;
                  try {
                    const intended = localStorage.getItem('alshams_oauth_intended_role');
                    if (intended === 'supplier') setOauthIntendedRole('supplier');
                    else setOauthIntendedRole('artisan');
                    localStorage.removeItem('alshams_oauth_intended_role');
                  } catch {}
                  setPendingGoogleSessionUser({
                    email: userEmail,
                    fullName: meta.full_name || meta.name || meta.artist_name,
                  });
                }
              }
            }
          }
        } else if (!session && mounted) {
          setPendingGoogleSessionUser(null);
          const saved = localStorage.getItem('alshams_profile');
          if (!saved) {
            setProfile(null);
          }
        }
      } catch (err) {
        console.warn('[App Auth] Session check notice:', err);
      } finally {
        isChecking = false;
        if (mounted) setAuthChecking(false);
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth State Change]:', event, 'User:', session?.user?.email);
      if (event === 'PASSWORD_RECOVERY' || (session && isJwtRecoverySession(session))) {
        recoveryActive = true;
        try {
          localStorage.removeItem('alshams_pending_recovery_ts');
        } catch {}
        if (mounted) {
          setIsPasswordRecovery(true);
          setShowAuthGateway(false);
          setAuthChecking(false);
        }
        return;
      }
      if (event === 'SIGNED_OUT') {
        recoveryActive = false;
        if (mounted) {
          setIsPasswordRecovery(false);
          setPendingGoogleSessionUser(null);
          setProfile(null);
          localStorage.removeItem('alshams_profile');
          localStorage.removeItem('alshams_supplier_profile');
        }
        return;
      }
      if (session?.user && mounted && !recoveryActive) {
        syncPlatformSettingsFromCloud()
          .then(() => syncBrandFaviconFromCms(getStoredLandingCmsConfig()))
          .catch(() => {});
        checkSession();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check workshop suspension/ban status and auto-unfreeze if time expired
  const checkWorkshopStatus = useCallback(async () => {
    if (!profile) return;
    const wid = profile.workshopId || profile.id;
    if (!wid || wid === 'workshop_demo' || wid === '00000000-0000-0000-0000-000000000000') return;

    try {
      const res = await fetch('/api/workshop/my-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopId: wid }),
      });
      const data = await res.json();
      if (data.success && data.workshop) {
        const sw = data.workshop;
        setProfile((prev) => {
          if (!prev) return null;
          const merged: UserProfile = {
            ...prev,
            status: sw.status || 'active',
            suspension_reason: sw.suspension_reason,
            suspensionReason: sw.suspension_reason,
            suspension_duration: sw.suspension_duration,
            suspensionDuration: sw.suspension_duration,
            suspended_until: sw.suspended_until,
            suspendedUntil: sw.suspended_until,
            appeal_status: sw.appeal_status || 'none',
            appealStatus: sw.appeal_status || 'none',
            appeal_message: sw.appeal_message,
            appealMessage: sw.appeal_message,
            rejection_reason: sw.rejection_reason,
            rejectionReason: sw.rejection_reason,
            appeal_submitted_at: sw.appeal_submitted_at,
            appealSubmittedAt: sw.appeal_submitted_at,
            isFrozen: sw.status === 'suspended' || sw.status === 'banned',
          };
          localStorage.setItem('alshams_profile', JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn('[Status Check] Notice:', err);
    }
  }, [profile?.workshopId, profile?.id]);

  // Load Admin Announcements & Messages
  const loadAnnouncements = useCallback(async () => {
    if (!profile) return;
    const wid = profile.workshopId || profile.id;
    if (!wid || wid === 'workshop_demo' || wid === '00000000-0000-0000-0000-000000000000') return;

    try {
      const res = await fetch(`/api/announcements?workshopId=${encodeURIComponent(wid)}`, {
        headers: {
          'x-workshop-id': wid,
          ...(profile.email ? { 'x-user-email': profile.email } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements);
      }
    } catch (err) {
      console.warn('[Announcements] Failed to fetch:', err);
    }
  }, [profile?.workshopId, profile?.id]);

  // Load Super Admin notifications (product approvals, workshop applications, appeals)
  const loadAdminAlerts = useCallback(async () => {
    if (!profile || !isUserAdmin(profile)) {
      setAdminAlerts([]);
      return;
    }
    try {
      const headers: Record<string, string> = {
        'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
      };
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      } catch {}
      const res = await fetch('/api/admin/notifications', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setAdminAlerts(data.notifications);
        }
      }
    } catch {}
  }, [profile?.email, profile?.role]);

  const handleDismissAdminAlert = useCallback(async (alertId: string) => {
    setAdminAlerts((prev) => prev.filter((a) => a.id !== alertId));
    try {
      const headers: Record<string, string> = {
        'x-user-email': profile?.email || 'hmb.top.tube@gmail.com',
      };
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      } catch {}
      await fetch(`/api/admin/notifications/${encodeURIComponent(alertId)}`, {
        method: 'DELETE',
        headers,
      });
      window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
    } catch {}
  }, [profile?.email]);

  const loadAdminInboxUnreadCount = useCallback(async () => {
    if (!profile || !isUserAdmin(profile) || switchedWorkshopContext) {
      setAdminInboxUnreadCount(0);
      return;
    }
    try {
      const headers: Record<string, string> = {
        'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
      };
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      } catch {}
      const res = await fetch('/api/admin/inbox', { headers });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.unreadCount === 'number') {
          setAdminInboxUnreadCount(data.unreadCount);
        } else if (Array.isArray(data.inbox)) {
          setAdminInboxUnreadCount(data.inbox.filter((m: any) => !m.admin_read_at).length);
        }
      }
    } catch {}
  }, [profile?.email, profile?.role, switchedWorkshopContext]);

  // Initial and periodic check on profile mount
  useEffect(() => {
    if (profile?.id) {
      checkWorkshopStatus();
      loadAnnouncements();
      loadAdminAlerts();
      loadAdminInboxUnreadCount();
    }
    const handleAdminAlertsChanged = () => {
      loadAdminAlerts();
    };
    const handleAdminInboxChanged = () => {
      loadAdminInboxUnreadCount();
    };
    window.addEventListener('alshams_admin_alerts_changed', handleAdminAlertsChanged);
    window.addEventListener('alshams_admin_inbox_changed', handleAdminInboxChanged);
    return () => {
      window.removeEventListener('alshams_admin_alerts_changed', handleAdminAlertsChanged);
      window.removeEventListener('alshams_admin_inbox_changed', handleAdminInboxChanged);
    };
  }, [profile?.id, profile?.workshopId, checkWorkshopStatus, loadAnnouncements, loadAdminAlerts, loadAdminInboxUnreadCount]);

  // Realtime subscription for incoming announcements, artist replies, and status changes
  useEffect(() => {
    if (!profile) return;
    const wid = profile.workshopId || profile.id;
    if (!wid || wid === 'workshop_demo' || wid === '00000000-0000-0000-0000-000000000000') return;

    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const announcementsChannel = supabase
      .channel(`public_admin_announcements_live_${wid}_${uniqueSuffix}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_announcements' },
        (payload) => {
          const newAnn = payload.new as any;
          if (newAnn?.recipient_type !== 'super_admin_alert' && (newAnn.recipient_type === 'all' || newAnn.recipient_workshop_id === wid)) {
            if (!isUserAdmin(profile) || switchedWorkshopContext) {
              playPostaNotificationSound();
            }
            loadAnnouncements();
          }
        }
      )
      .subscribe();

    const workshopChannel = supabase
      .channel(`public_workshops_live_${wid}_${uniqueSuffix}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workshops', filter: `id=eq.${wid}` },
        () => {
          checkWorkshopStatus();
        }
      )
      .subscribe();

    const adminInboxChannel =
      isUserAdmin(profile) && !switchedWorkshopContext
        ? supabase
            .channel(`admin_inbox_live_${wid}_${uniqueSuffix}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'workshop_messages_receipts' },
              (payload) => {
                const row = (payload.new as any) || {};
                if (row.reply_text) {
                  playPostaNotificationSound();
                  loadAdminInboxUnreadCount();
                  window.dispatchEvent(new CustomEvent('alshams_admin_inbox_changed'));
                }
              }
            )
            .subscribe()
        : null;

    return () => {
      supabase.removeChannel(announcementsChannel).catch(() => {});
      supabase.removeChannel(workshopChannel).catch(() => {});
      if (adminInboxChannel) {
        supabase.removeChannel(adminInboxChannel).catch(() => {});
      }
    };
  }, [profile?.workshopId, profile?.id, profile?.role, switchedWorkshopContext, loadAnnouncements, checkWorkshopStatus, loadAdminInboxUnreadCount]);

  // Calculate unread Mail messages count cleanly (Super Admin -> incoming inbox; Artist -> incoming announcements)
  const unreadMessagesCount =
    isUserAdmin(profile) && !switchedWorkshopContext
      ? adminInboxUnreadCount
      : announcements.filter((a) => !a.receipt || !a.receipt.read_at).length;

  // Register Web Push Service Worker for real-time background workshop alerts & offline sync
  useEffect(() => {
    registerServiceWorker().catch(() => {});
    const cleanupSync = initOfflineSyncListeners();
    const tenant = profile?.tenantId || profile?.workshopId || profile?.id;
    if (tenant) {
      checkAndDispatchEquipmentMaintenanceAlerts(tenant).catch(() => {});
    }

    if (
      profile &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      subscribeToWebPush({
        workshopId: profile.workshopId || profile.id,
        email: profile.email,
        isSuperAdmin: isUserAdmin(profile) && !switchedWorkshopContext,
      }).catch(() => {});
    }

    const handleSwMessage = (event: MessageEvent) => {
      const data = event?.data;
      if (!data) return;
      if (data.type === 'PUSH_RECEIVED') {
        playPostaNotificationSound();
        loadAnnouncements();
        loadSearchCacheAndNotifications();
        if (profile && isUserAdmin(profile)) {
          loadAdminAlerts();
          loadAdminInboxUnreadCount();
        }
      } else if (data.type === 'TRIGGER_OFFLINE_SYNC') {
        flushOfflineMutations().catch(() => {});
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      cleanupSync();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [
    profile?.tenantId,
    profile?.workshopId,
    profile?.id,
    profile?.email,
    switchedWorkshopContext,
    loadAnnouncements,
    loadSearchCacheAndNotifications,
    loadAdminAlerts,
    loadAdminInboxUnreadCount,
  ]);

  // Listen to open permissions modal event
  useEffect(() => {
    const handleOpenPermissions = () => {
      setIsPermissionsModalOpen(true);
    };
    window.addEventListener('alshams_open_permissions_modal', handleOpenPermissions);
    return () => window.removeEventListener('alshams_open_permissions_modal', handleOpenPermissions);
  }, []);

  // Listen to store opening events (with optional targeted order ID / tab)
  useEffect(() => {
    const handleOpenStore = (e: Event) => {
      const customEvent = e as CustomEvent<{
        orderId?: string;
        tab?: 'products' | 'appearance' | 'promotions' | 'orders' | 'qr';
      }>;
      if (customEvent.detail?.orderId) {
        setSelectedStoreOrderId(customEvent.detail.orderId);
        setArtisanStoreInitialTab('orders');
      } else {
        setSelectedStoreOrderId(undefined);
        setArtisanStoreInitialTab(customEvent.detail?.tab || 'products');
      }
      setIsArtisanStoreModalOpen(true);
    };

    window.addEventListener('alshams_open_store', handleOpenStore);
    return () => window.removeEventListener('alshams_open_store', handleOpenStore);
  }, []);

  const [erpSelectedBranchId, setErpSelectedBranchId] = useState<string | undefined>(undefined);
  const [lockedTerminal, setLockedTerminal] = useState<LockedTerminalConfig | null>(() =>
    getLockedTerminalConfig()
  );

  useEffect(() => {
    const syncKioskLock = () => setLockedTerminal(getLockedTerminalConfig());
    window.addEventListener(KIOSK_LOCK_CHANGED_EVENT, syncKioskLock);
    window.addEventListener('storage', syncKioskLock);
    return () => {
      window.removeEventListener(KIOSK_LOCK_CHANGED_EVENT, syncKioskLock);
      window.removeEventListener('storage', syncKioskLock);
    };
  }, []);

  // Listen to custom navigation events from Shamousa or other components
  useEffect(() => {
    const handleOpenView = (e: Event) => {
      const customEvent = e as CustomEvent<{ view?: string; branchId?: string }>;
      const view = customEvent.detail?.view;
      if (customEvent.detail?.branchId) {
        setErpSelectedBranchId(customEvent.detail.branchId);
      }
      if (view === 'marketplace') {
        navigateTo('marketplace');
        return;
      }
      if (view === 'store') {
        handleOpenArtisanStore('products');
        return;
      }
      if (view === 'my_orders') {
        handleOpenArtisanStore('orders');
        return;
      }
      if (view && VIEW_TITLES[view as ActiveView]) {
        navigateTo(view as ActiveView);
      }
    };

    window.addEventListener('alshams_open_view', handleOpenView);
    return () => window.removeEventListener('alshams_open_view', handleOpenView);
  }, [activeView]);

  // Listen to quick purchase invoice requests from Shamousa or other widgets
  useEffect(() => {
    const handleQuickPurchase = (e: Event) => {
      const customEvent = e as CustomEvent<{
        materialId: string;
        materialName?: string;
        supplierId?: string;
        unitCost?: number;
        unitName?: string;
        quantity?: number;
      }>;
      if (customEvent.detail) {
        handleOpenPurchaseForMaterial(customEvent.detail);
      }
    };

    window.addEventListener('alshams_quick_purchase', handleQuickPurchase);
    return () => window.removeEventListener('alshams_quick_purchase', handleQuickPurchase);
  }, [handleOpenPurchaseForMaterial]);

  // Navigation handlers with history tracking (يدعم الرجوع للصفحة السابقة)
  const syncFamilyUrl = (targetView: ActiveView) => {
    if (typeof window === 'undefined') return;
    if (targetView === 'family') {
      if (window.location.hash !== '#/family') {
        window.history.replaceState({}, '', '/#/family');
      }
    } else if (
      /^#\/?family/i.test(window.location.hash || '') ||
      /^\/family/i.test(window.location.pathname || '')
    ) {
      window.history.replaceState({}, '', '/');
    }
  };

  const navigateTo = useCallback(
    (view: ActiveView) => {
      if (view === activeView) return;
      setHistoryStack((prev) => [...prev, activeView]);
      setActiveView(view);
      syncFamilyUrl(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activeView]
  );

  const handleNavigateToCatalog = useCallback(
    (tab?: 'catalog' | 'store') => {
      setCatalogInitialTab(tab || 'catalog');
      navigateTo('catalog');
    },
    [navigateTo]
  );

  const handleNavigateToWorkOrders = useCallback(
    (mode?: string) => {
      if (mode === 'create' || mode === 'issue' || mode === 'receive') {
        setWorkOrdersInitialStage(mode);
      } else {
        setWorkOrdersInitialStage(undefined);
      }
      navigateTo('work_orders');
    },
    [navigateTo]
  );

  const navigateBack = useCallback(() => {
    if (historyStack.length > 0) {
      const previous = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, -1));
      setActiveView(previous);
      syncFamilyUrl(previous);
      window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
    } else {
      window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
      if (activeView !== 'home') {
        setActiveView('home');
        syncFamilyUrl('home');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [historyStack, activeView]);

  const goHome = useCallback(() => {
    window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
    syncFamilyUrl('home');
    if (isSuperAdminMode) {
      setAdminInitialTab('home');
      setAdminNavNonce((n) => n + 1);
    }
    if (activeView === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setHistoryStack((prev) => [...prev, activeView]);
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView, isSuperAdminMode]);

  // Handlers for exporting to calculator from Falcon AI or Archive
  const handleSelectRecordToLoad = (record: SavedProductRecord) => {
    setCalculatorInitialRecord(record);
    navigateTo('calculator');
  };

  const handleOpenWhatsAppShare = (record: SavedProductRecord) => {
    setQuoteRecord(record);
    setIsQuoteDrawerOpen(true);
  };

  const handleApplyCategoryFromAI = (category: CraftCategory) => {
    setCurrentCategory(category);
    navigateTo('calculator');
  };

  const handleApplyEstimatedLaborWage = (wage: number, hours: number) => {
    if (profile) {
      const updated: any = { ...profile, hourlyRate: hours > 0 ? Math.round(wage / hours) : 35 };
      setProfile(updated);
      localStorage.setItem('alshams_profile', JSON.stringify(updated));
    }
    navigateTo('calculator');
  };

  const handleTransferNotesToCalculator = (notes: string) => {
    setCalculatorExternalNotes(notes);
    navigateTo('calculator');
  };

  const handleExportStructuredToCalculator = (data: StructuredCalculatorExport) => {
    if (data.notes) setCalculatorExternalNotes(data.notes);
    if (data.category) setCurrentCategory(data.category as CraftCategory);

    const safeCategory = (data.category as CraftCategory) || currentCategory || 'macrame';
    const prodName = data.productName || 'مشغولة يدوية فاخرة';
    const hours = Number(data.hours) || 3;
    const wage = Number(data.laborWage) || 90;
    const hourly = hours > 0 ? Math.round(wage / hours) : 35;
    const weight = Number(data.weightKg) || 0.8;
    const cordCost = Math.round(weight * 180);

    const extraMats = data.extraMaterials && data.extraMaterials.length > 0
      ? data.extraMaterials
      : [
          {
            id: 'mat_base_' + Date.now(),
            name: 'قاعدة خشبية / شاسيه دعم حديد',
            unit: 'قطعة',
            unitPrice: 40,
            quantity: 1,
            totalCost: 40,
          },
          {
            id: 'mat_acc_' + Date.now(),
            name: 'إكسسوارات ومقابض وتغليف',
            unit: 'طقم',
            unitPrice: 25,
            quantity: 1,
            totalCost: 25,
          },
        ];

    const extraMatsCost = extraMats.reduce((acc, m) => acc + (m.totalCost || 0), 0);
    const directMaterials = cordCost + extraMatsCost;
    const costPrice = data.costPrice || (directMaterials + wage + 15 + 10 + 15);
    const wholesalePrice = data.wholesalePrice || data.minMarketPrice || Math.round(costPrice * 1.3);
    const retailPrice = data.retailPrice || data.recommendedFairPrice || Math.round(costPrice * 1.6);

    const synthesizedRecord: SavedProductRecord = {
      id: 'calc_export_' + Date.now(),
      workshopId: (profile as any)?.workshopId || undefined,
      tenantId: (profile as any)?.tenantId || undefined,
      productName: prodName,
      productCode: 'SH-' + Math.floor(1000 + Math.random() * 9000),
      mainSectionId: 'ropes_textiles',
      craftId: (data as any).craftId || 'macrame',
      category: safeCategory,
      costPrice,
      retailPrice,
      wholesalePrice,
      imageUrl: data.imageUrl,
      inStore: true,
      isPublishedInStore: true,
      currentStock: 0,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      input: {
        category: safeCategory,
        productName: prodName,
        shape3D: 'rectangle',
        widthCm: Number(data.widthCm) || 40,
        diameterCm: Number(data.diameterCm) || 0,
        baseDiameterCm: 0,
        sideHeightCm: Number(data.sideHeightCm) || 15,
        totalLengthCm: Number(data.heightCm) || 50,
        fringeLengthCm: Number(data.fringeLengthCm) || 10,
        cordTypeId: data.cordTypeId || 'cotton_twisted_4mm',
        cordThicknessMm: Number(data.cordThicknessMm) || 4,
        pricePerKg: Number(data.pricePerKg) || 180,
        curtainRodCost: 0,
        cushionCoverCost: 0,
        fiberCost: 0,
        bagAccessoriesCost: 0,
        extraMaterials: extraMats,
        laborWage: wage,
        profitMarginPercent: 35,
        packagingCost: 15,
        transitFees: 10,
        adminExpensesShare: 15,
        personalNotes: data.notes || '',
      },
      output: {
        baseStrandsCount: 0,
        workingCordsCount: 0,
        singleStrandLengthCm: 0,
        totalYarnLengthMeters: Math.round(weight * 150),
        totalWeightKg: weight,
        totalWeightGrams: Math.round(weight * 1000),
        yarnCost: cordCost,
        extraMaterialsTotalCost: extraMatsCost,
        totalDirectMaterialsCost: directMaterials,
        laborWage: wage,
        packagingCost: 15,
        transitFees: 10,
        adminExpensesShare: 15,
        finalSellingPrice: retailPrice,
        insulatedProfitAmount: retailPrice - costPrice,
        isOverridden: { strands: false, strandLength: false, weight: false },
      },
    };

    setCalculatorInitialRecord(synthesizedRecord);
    navigateTo('calculator');
  };

  const handleLogout = async () => {
    await unsubscribeFromWebPush().catch(() => {});
    await supabase.auth.signOut();
    localStorage.removeItem('alshams_profile');
    localStorage.removeItem('alshams_supplier_profile');
    setProfile(null);
    setActiveView('home');
    setIsSidebarOpen(false);
  };

  // Comprehensive Hash and Path routing for Public Storefronts and Central Marketplaces
  const parseAppRoute = (): {
    type: 'app' | 'market' | 'store' | 'suppliers_market' | 'supplier_store';
    slug?: string;
  } => {
    if (typeof window === 'undefined') return { type: 'app' };
    const pathname = window.location.pathname || '';
    const hash = window.location.hash || '';

    // 0. Suppliers B2B Marketplace (/suppliers-market, /#/suppliers-market)
    if (
      /^\/suppliers-market(?:\/|$)/i.test(pathname) ||
      /^#\/?suppliers-market(?:\/|$)/i.test(hash)
    ) {
      return { type: 'suppliers_market' };
    }

    // 0b. Direct Supplier Public Storefront (/supplier/:slug or /#/supplier/:slug)
    const supPathMatch = pathname.match(/^\/supplier\/([^/?#]+)/i);
    if (supPathMatch) {
      try {
        return { type: 'supplier_store', slug: decodeURIComponent(supPathMatch[1]) };
      } catch {
        return { type: 'supplier_store', slug: supPathMatch[1] };
      }
    }
    const supHashMatch = hash.match(/^#\/?supplier\/([^/?#]+)/i);
    if (supHashMatch) {
      try {
        return { type: 'supplier_store', slug: decodeURIComponent(supHashMatch[1]) };
      } catch {
        return { type: 'supplier_store', slug: supHashMatch[1] };
      }
    }

    // 1. Central Marketplace (/market, /marketplace, /#/market, #market)
    if (
      /^\/(?:market|marketplace)(?:\/|$)/i.test(pathname) ||
      /^#\/?(?:market|marketplace)(?:\/|$)/i.test(hash)
    ) {
      return { type: 'market' };
    }

    // 2. Individual Artisan Store via Path (/store/:slug or /s/:slug)
    const pathMatch = pathname.match(/^\/(?:store|s)\/([^/?#]+)/i);
    if (pathMatch) {
      try {
        return { type: 'store', slug: decodeURIComponent(pathMatch[1]) };
      } catch {
        return { type: 'store', slug: pathMatch[1] };
      }
    }

    // 3. Individual Artisan Store via Hash (/#/store/:slug or #store/:slug)
    const hashMatch = hash.match(/^#\/?(?:store|s)\/([^/?#]+)/i);
    if (hashMatch) {
      try {
        return { type: 'store', slug: decodeURIComponent(hashMatch[1]) };
      } catch {
        return { type: 'store', slug: hashMatch[1] };
      }
    }

    // 4. Query Params Support (?market=1, ?tab=market, ?store=..., ?supplier=...)
    const search = window.location.search || '';
    if (search) {
      try {
        const params = new URLSearchParams(search);
        if (
          params.get('suppliers_market') === '1' ||
          params.get('view') === 'suppliers-market'
        ) {
          return { type: 'suppliers_market' };
        }
        const supplierParam = params.get('supplier');
        if (supplierParam) {
          try {
            return { type: 'supplier_store', slug: decodeURIComponent(supplierParam) };
          } catch {
            return { type: 'supplier_store', slug: supplierParam };
          }
        }
        if (params.get('market') === '1' || params.get('tab') === 'market' || params.get('view') === 'market') {
          return { type: 'market' };
        }
        const storeParam = params.get('store') || params.get('artisan');
        if (storeParam) {
          try {
            return { type: 'store', slug: decodeURIComponent(storeParam) };
          } catch {
            return { type: 'store', slug: storeParam };
          }
        }
      } catch {}
    }

    return { type: 'app' };
  };

  const [activeRoute, setActiveRoute] = useState(parseAppRoute);

  useEffect(() => {
    const handleRouteNav = () => {
      const parsed = parseAppRoute();
      setActiveRoute(parsed);
      if (parsed.type === 'app' && typeof window !== 'undefined') {
        const p = window.location.pathname || '';
        const h = window.location.hash || '';
        const s = window.location.search || '';
        if (
          /^\/family(?:\/|$)/i.test(p) ||
          /^#\/?family(?:\/|$)/i.test(h) ||
          /[?&]view=family(?:&|$)/i.test(s)
        ) {
          setActiveView('family');
        }
      }
    };
    window.addEventListener('hashchange', handleRouteNav);
    window.addEventListener('popstate', handleRouteNav);
    return () => {
      window.removeEventListener('hashchange', handleRouteNav);
      window.removeEventListener('popstate', handleRouteNav);
    };
  }, []);

  // Render Suppliers Market if requested via direct link or hash
  if (activeRoute.type === 'suppliers_market') {
    return (
      <SuppliersMarketView
        profile={profile}
        onNavigateBack={
          profile
            ? () => {
                if (window.location.hash) window.location.hash = '';
                if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
                setActiveRoute({ type: 'app' });
              }
            : undefined
        }
        onNavigateToMyOrders={() => {
          if (window.location.hash) window.location.hash = '';
          if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
          setActiveRoute({ type: 'app' });
          setActiveView('suppliers');
        }}
        onOpenSupplierStore={(slug) => {
          window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
          setActiveRoute({ type: 'supplier_store', slug });
        }}
        onNavigateToCentralMarket={() => {
          window.location.hash = '#/market';
          setActiveRoute({ type: 'market' });
        }}
      />
    );
  }

  // Render Public Supplier Storefront if requested via /supplier/:slug or #/supplier/:slug
  if (activeRoute.type === 'supplier_store' && activeRoute.slug) {
    return (
      <SupplierPublicStoreView
        slug={activeRoute.slug}
        profile={profile}
        onNavigateToSuppliersMarket={() => {
          window.location.hash = '#/suppliers-market';
          setActiveRoute({ type: 'suppliers_market' });
        }}
        onNavigateToCentralMarket={() => {
          window.location.hash = '#/market';
          setActiveRoute({ type: 'market' });
        }}
        onNavigateToApp={
          profile
            ? () => {
                if (window.location.hash) window.location.hash = '';
                if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
                setActiveRoute({ type: 'app' });
              }
            : undefined
        }
      />
    );
  }

  // Render Central Marketplace if requested via direct link or hash
  if (activeRoute.type === 'market') {
    return (
      <MarketplaceView
        profile={profile}
        onNavigateHome={() => {
          if (window.location.hash) window.location.hash = '';
          if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
          setActiveRoute({ type: 'app' });
        }}
        onOpenStoreModal={() => {
          setCatalogInitialTab('store');
          setActiveView('catalog');
          if (window.location.hash) window.location.hash = '';
          setActiveRoute({ type: 'app' });
        }}
        onNavigateToSuppliersMarket={
          featureFlags.suppliersMarketplaceEnabled
            ? () => {
                window.location.hash = '#/suppliers-market';
                setActiveRoute({ type: 'suppliers_market' });
              }
            : undefined
        }
      />
    );
  }

  // Render Public Artisan Store if requested via direct link or hash
  if (activeRoute.type === 'store' && activeRoute.slug) {
    return (
      <PublicStorefrontView
        slug={activeRoute.slug}
        onNavigateToApp={() => {
          if (window.location.hash) window.location.hash = '';
          if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
          setActiveRoute({ type: 'app' });
        }}
        onNavigateToMarket={() => {
          window.location.hash = '#/market';
          setActiveRoute({ type: 'market' });
        }}
      />
    );
  }

  // Kiosk Locked Device Mode takes top priority when a branch terminal is pinned to this browser
  if (lockedTerminal) {
    return (
      <LockedTerminalShell
        config={lockedTerminal}
        onUnlocked={() => {
          setLockedTerminal(null);
          setActiveView('home');
        }}
      />
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-[#334155] dark:text-[#CBD5E1]">جاري تشغيل منظومة الشمساوية...</p>
        </div>
      </div>
    );
  }

  // Password recovery flow always takes top priority over cached profiles/landing
  if (isPasswordRecovery) {
    return (
      <ResetPasswordScreen
        onSuccess={async () => {
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
          setIsPasswordRecovery(false);
          const supProfile = await getCurrentSupplierFromSupabase();
          if (supProfile) {
            setProfile(supProfile);
            localStorage.setItem('alshams_profile', JSON.stringify(supProfile));
            return;
          }
          const { workshop } = await getCurrentWorkshopFromSupabase();
          if (workshop) {
            setProfile(workshop);
            localStorage.setItem('alshams_profile', JSON.stringify(workshop));
          } else {
            setShowAuthGateway(true);
            setAuthGatewayMode('login');
          }
        }}
        onRequestNewLink={async () => {
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
          await supabase.auth.signOut().catch(() => {});
          setIsPasswordRecovery(false);
          setProfile(null);
          setAuthGatewayMode('login');
          setShowAuthGateway(true);
        }}
      />
    );
  }

  // First-time Google OAuth user needs to complete their workshop or supplier profile once
  if (!profile && pendingGoogleSessionUser) {
    return (
      <CompleteWorkshopScreen
        userEmail={pendingGoogleSessionUser.email}
        initialArtistName={pendingGoogleSessionUser.fullName}
        initialAccountRole={oauthIntendedRole}
        onWorkshopCreated={(newProfile) => {
          setPendingGoogleSessionUser(null);
          setShowAuthGateway(false);
          setProfile(newProfile);
          localStorage.setItem('alshams_profile', JSON.stringify(newProfile));
        }}
        onLogout={async () => {
          await supabase.auth.signOut().catch(() => {});
          localStorage.removeItem('alshams_profile');
          localStorage.removeItem('alshams_supplier_profile');
          setPendingGoogleSessionUser(null);
          setProfile(null);
          setShowAuthGateway(true);
        }}
      />
    );
  }

  // If unauthenticated and no valid profile, show Landing Page by default or Auth Gateway if user requested login/register
  if (!profile) {
    if (showAuthGateway || suspensionNotice) {
      return (
        <AuthGateway
          initialMode={authGatewayMode}
          initialRegisterRole={authRegisterRole}
          onBackToLanding={() => {
            setSuspensionNotice(null);
            setShowAuthGateway(false);
          }}
          recoveryError={suspensionNotice}
          onClearRecoveryError={() => setSuspensionNotice(null)}
          onAuthenticated={(p) => {
            setSuspensionNotice(null);
            setPendingGoogleSessionUser(null);
            setShowAuthGateway(false);
            setProfile(p);
            localStorage.setItem('alshams_profile', JSON.stringify(p));
          }}
        />
      );
    }

    return (
      <LandingPage
        onOpenLogin={() => {
          setAuthRegisterRole('artisan');
          setAuthGatewayMode('login');
          setShowAuthGateway(true);
        }}
        onOpenRegister={() => {
          setAuthRegisterRole('artisan');
          setAuthGatewayMode('signup');
          setShowAuthGateway(true);
        }}
        onOpenRegisterSupplier={() => {
          setAuthRegisterRole('supplier');
          setAuthGatewayMode('signup');
          setShowAuthGateway(true);
        }}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  // Gatekeeper: If workshop is suspended or banned and user is NOT a Super Admin, block access
  const isSuspendedOrBanned =
    profile &&
    !isUserAdmin(profile) &&
    (profile.status === 'suspended' || profile.status === 'banned' || profile.isFrozen);

  if (isSuspendedOrBanned) {
    return (
      <AccessGate
        workshop={profile}
        onRefreshStatus={checkWorkshopStatus}
        onLogout={handleLogout}
      />
    );
  }

  // Track if any modal, drawer, or dialog is currently open across the entire application
  const isAnyModalOpen = Boolean(
    isSidebarOpen ||
    isSearchOpen ||
    isNotificationsOpen ||
    isProfileSettingsOpen ||
    isCraftsSelectorOpen ||
    isUserGuideOpen ||
    isCloudMigrationOpen ||
    isSupportOpen ||
    isTourOpen ||
    isExchangeRatesOpen ||
    isInventoryLedgerOpen ||
    isMaterialsModalOpen ||
    isProductsModalOpen ||
    isAdminExpensesOpen ||
    isNewMaterialOpen ||
    isNewClientOpen ||
    isNewSupplierOpen ||
    isNewEmployeeOpen ||
    isQuoteDrawerOpen ||
    isMessagesHubOpen ||
    isArtisanStoreModalOpen ||
    isSupplierStoreModalOpen
  );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip flex flex-col bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] font-sans transition-colors duration-200" dir="rtl">
      {/* Top Navbar */}
      <Navbar
        profile={profile}
        hasActiveSession={true}
        isSuperAdminMode={isSuperAdminMode}
        adminBellCounts={adminBellCounts}
        onSelectAdminNotificationSection={(sec) => {
          setAdminInitialTab(sec);
          setAdminNavNonce((n) => n + 1);
          navigateTo('home');
        }}
        unreadNotificationsCount={
          notifications.filter((n) => !n.isRead).length + (isUserAdmin(profile) ? adminAlerts.length : 0)
        }
        unreadMessagesCount={unreadMessagesCount}
        onOpenMessagesHub={() => {
          setNotificationsInitialTab('messages');
          setIsMessagesHubOpen(true);
        }}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        onOpenGlobalSearch={() => {
          loadSearchCacheAndNotifications();
          setIsSearchOpen(true);
        }}
        onGoHome={goHome}
        onOpenNotifications={() => {
          loadSearchCacheAndNotifications();
          if (isUserAdmin(profile)) {
            loadAdminAlerts();
            loadAdminInboxUnreadCount();
            const unreadTotalNotif = notifications.filter((n) => !n.isRead).length + adminAlerts.length;
            setNotificationsInitialTab(unreadTotalNotif === 0 && adminInboxUnreadCount > 0 ? 'messages' : 'admin');
          } else {
            setNotificationsInitialTab('notifications');
          }
          setIsNotificationsOpen(true);
        }}
        onOpenNewMaterialModal={() => setIsNewMaterialOpen(true)}
        onNavigateToCalculator={() => navigateTo('calculator')}
        onOpenSupplierInvoice={() => setIsNewSupplierOpen(true)}
        onNavigateToSales={() => navigateTo('sales')}
        onOpenNewClientModal={() => setIsNewClientOpen(true)}
        onOpenNewEmployeeModal={() => setIsNewEmployeeOpen(true)}
        onNavigateToCatalog={handleNavigateToCatalog}
        onNavigateToMarketplace={() => navigateTo('marketplace')}
        onOpenArtisanStore={() => handleOpenArtisanStore('products')}
        onNavigateToFamily={() => {
          if (window.location.hash !== '#/family') {
            window.location.hash = '#/family';
          }
          navigateTo('family');
        }}
        activeView={activeView}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        themeMode={themeMode}
        onSelectThemeMode={setThemeMode}
      />

      {/* Super Admin Executive Context Mode Banner */}
      {switchedWorkshopContext && (
        <aside aria-label="شريط وضع الإشراف" className="bg-gradient-to-r from-[#060B18] via-[#132040] to-[#9A3412] text-[#F7F3EA] px-4 py-2 text-xs font-black flex flex-wrap items-center justify-between gap-2 border-b border-[#EA580C]/45 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-sm">👑</span>
            <span>
              أنت الآن في وضع الإشراف التنفيذي الشامل على ورشة: <strong className="text-[#FDBA74]">"{switchedWorkshopContext.brandName}"</strong> (الفنان: {switchedWorkshopContext.artistName})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-[11px] font-black cursor-pointer transition shadow-xs"
            >
              العودة للوحة الإشراف
            </button>
            <button
              type="button"
              onClick={() => {
                if (originalSuperAdminProfile) {
                  setProfile(originalSuperAdminProfile);
                  localStorage.setItem('alshams_profile', JSON.stringify(originalSuperAdminProfile));
                }
                setSwitchedWorkshopContext(null);
              }}
              className="px-3 py-1 rounded-xl bg-[#0D162E] hover:bg-[#1A2B54] text-[#F7F3EA] border border-[#2D4475] text-[11px] font-bold cursor-pointer transition"
            >
              إنهاء وضع الإشراف
            </button>
          </div>
        </aside>
      )}

      {/* Welcome Banner: يظهر فقط للورش وليس للسوبر أدمن */}
      {showWelcomeBanner && profile && !isSuperAdminMode && (
        <aside aria-label="رسالة الترحيب" className="bg-gradient-to-l from-[#F7F3EA] via-[#EFE9DC] to-[#FFEDD5] dark:from-[#0D162E] dark:via-[#132040] dark:to-[#1E130A] border-b border-[#D4CCBC] dark:border-[#EA580C]/35 px-4 py-2.5 text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#EA580C] dark:text-amber-400 shrink-0" />
            <span>
              أهلاً بك يا <strong className="text-[#C2410C] dark:text-amber-300">{profile.artistName || 'فنان الشمساوية'}</strong> في {profile.accountRole === 'supplier' ? 'متجر المورد' : 'ورشتك'} <strong>{profile.brandName || 'الشمساوية هاند ميد'}</strong> ✨ نسعد بوجودك معنا ونتمنى لك يوماً إنتاجياً موفقاً!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowWelcomeBanner(false)}
            className="p-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition cursor-pointer"
            title="إغلاق الترحيب"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}

      {/* Global Sub-Page Bar: زر الرجوع للصفحة السابقة بجوار الخروج للصفحة الرئيسية */}
      {activeView !== 'home' && (
        <aside aria-label="شريط التنقل السريع" className="sticky top-0 z-30 w-full max-w-full bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] px-2.5 sm:px-6 py-2 sm:py-2.5 shadow-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* زر الرجوع للصفحة السابقة */}
            <button
              type="button"
              onClick={navigateBack}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#FFEDD5] to-[#FED7AA] dark:from-[#1A294B] dark:to-[#0D162E] text-[#9A3412] dark:text-[#FDBA74] border border-[#EA580C]/45 dark:border-[#EA580C]/50 hover:border-[#EA580C] text-[11px] sm:text-xs font-black transition cursor-pointer shrink-0"
              title="الرجوع للصفحة السابقة"
            >
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#EA580C] dark:text-amber-400" />
              <span>رجوع</span>
            </button>

            {/* زر الخروج للصفحة الرئيسية */}
            <button
              type="button"
              onClick={goHome}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold transition cursor-pointer shrink-0"
              title="الخروج للصفحة الرئيسية"
            >
              <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C2410C] dark:text-amber-300" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>
          </div>

          {/* Current Page Title + Close button */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate max-w-[140px] sm:max-w-[320px] md:max-w-none px-2.5 sm:px-3 py-1 rounded-xl bg-[#E9E2D4]/90 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
              {VIEW_TITLES[activeView]}
            </span>
            <button
              type="button"
              onClick={goHome}
              aria-label="إغلاق والعودة للرئيسية"
              title="إغلاق والعودة للرئيسية"
              className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Content View Switcher */}
      <main className="flex-1 pb-16 w-full max-w-full overflow-x-clip">
        <AnimatePresence mode={isPerformanceMode ? undefined : 'wait'}>
          <motion.div
            key={activeView}
            initial={isPerformanceMode ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={isPerformanceMode ? undefined : { opacity: 0, y: -8 }}
            transition={isPerformanceMode ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
          >
            {activeView === 'home' && (
          isUserAdmin(profile) && !switchedWorkshopContext ? (
            <AdminDashboard
              profile={profile}
              initialTab={adminInitialTab}
              navigationKey={adminNavNonce}
              onNavigateHome={goHome}
              onOpenMessagesHub={() => {
                setNotificationsInitialTab('messages');
                setIsMessagesHubOpen(true);
              }}
              onOpenNotificationsCenter={() => {
                loadAdminAlerts();
                loadSearchCacheAndNotifications();
                setNotificationsInitialTab('admin');
                setIsNotificationsOpen(true);
              }}
              onOpenUnifiedAI={() => navigateTo('ai_agent')}
              onLogout={handleLogout}
              onProfileUpdated={(updated) => {
                setProfile(updated);
                localStorage.setItem('alshams_profile', JSON.stringify(updated));
              }}
              onSelectActiveWorkshop={(workshop) => {
                if (!originalSuperAdminProfile && profile) {
                  setOriginalSuperAdminProfile(profile);
                }
                setSwitchedWorkshopContext(workshop);
                const targetWid = workshop.id || workshop.workshopId || (workshop as any).tenantId || '';
                const adminEmail = profile?.email || originalSuperAdminProfile?.email || workshop.email;
                const merged: UserProfile = {
                  ...workshop,
                  id: targetWid,
                  workshopId: targetWid,
                  tenantId: targetWid,
                  role: 'superadmin',
                  email: adminEmail,
                };
                setProfile(merged);
                localStorage.setItem('alshams_profile', JSON.stringify(merged));
                setActiveView('home');
                if (targetWid) {
                  hydrateWorkshopIntoDexie(targetWid, { asSuperAdmin: true, userEmail: adminEmail }).catch(() => {});
                }
              }}
            />
          ) : profile.accountRole === 'supplier' ? (
            !featureFlags.supplierPortalEnabled ? (
              <div className="max-w-lg mx-auto my-12 p-6 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-center space-y-4">
                <h2 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  بوابة موردي الخامات متوقفة مؤقتاً للصيانة والتطوير
                </h2>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                  قامت إدارة المنظومة بإيقاف ظهور بوابة الموردين مؤقتاً أثناء إجراء تحديثات. كافة بياناتك وخاماتك محفوظة بأمان.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                  >
                    تحديث الحالة
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            ) : (
              <SupplierHomeScreen
                profile={profile}
                onNavigateToCatalog={() => navigateTo('supplier_catalog')}
                onOpenStorefrontModal={() => setIsSupplierStoreModalOpen(true)}
                onNavigateToOrders={() => navigateTo('supplier_orders')}
                onNavigateToCustomers={() => navigateTo('supplier_customers')}
                onNavigateToFinance={() => navigateTo('supplier_finance')}
                onNavigateToErpHub={() => navigateTo('supplier_erp_hub')}
                onNavigateToPos={() => navigateTo('supplier_pos')}
                onNavigateToWarehouseErp={() => navigateTo('supplier_warehouse_erp')}
                onNavigateToHrTerminal={() => navigateTo('supplier_hr_terminal')}
                onNavigateToFamily={() => navigateTo('family')}
                onNavigateToPersonalProfile={() => navigateTo('personal_profile')}
              />
            )
          ) : (
            <WorkshopHomeScreen
              profile={profile}
              onNavigateToCalculator={() => navigateTo('calculator')}
              onNavigateToArchive={() => navigateTo('archive')}
              onNavigateToCatalog={handleNavigateToCatalog}
              onOpenArtisanStore={handleOpenArtisanStore}
              onOpenPersonalProfile={() => navigateTo('personal_profile')}
              onNavigateToAIAgent={() => navigateTo('ai_agent')}
              onNavigateToMaterials={() => navigateTo('materials')}
              onNavigateToSuppliers={() => navigateTo('suppliers')}
              onNavigateToSuppliersMarket={() => navigateTo('suppliers_market')}
              onNavigateToSales={() => navigateTo('sales')}
              onNavigateToCustomers={() => navigateTo('customers')}
              onNavigateToInvoices={() => navigateTo('invoices')}
              onNavigateToWorkOrders={handleNavigateToWorkOrders}
              onNavigateToTreasuries={() => navigateTo('treasuries')}
              onNavigateToPurchases={() => navigateTo('purchases')}
              onNavigateToAccounts={() => navigateTo('accounts')}
              onNavigateToHR={() => navigateTo('hr')}
              onNavigateToReports={() => navigateTo('reports')}
              onNavigateToFixedAssets={() => navigateTo('fixed_assets')}
              onOpenExchangeRatesModal={() => setIsExchangeRatesOpen(true)}
              onOpenInventoryModal={(tab?: string) => {
                if (tab === 'products') {
                  setIsProductsModalOpen(true);
                } else if (tab === 'audit') {
                  setIsInventoryLedgerOpen(true);
                } else {
                  setIsMaterialsModalOpen(true);
                }
              }}
              onOpenAdminCostsModal={() => setIsAdminExpensesOpen(true)}
              onOpenNewMaterialModal={() => setIsNewMaterialOpen(true)}
              onOpenNewClientModal={() => setIsNewClientOpen(true)}
              onOpenNewSupplierModal={() => setIsNewSupplierOpen(true)}
              onOpenCreateSupplier={() => setIsNewSupplierOpen(true)}
              onOpenSupplierInvoice={() => setIsNewSupplierOpen(true)}
              onOpenNewEmployeeModal={() => setIsNewEmployeeOpen(true)}
              isAnyModalOpen={isAnyModalOpen}
              themeMode={themeMode}
              onSelectThemeMode={setThemeMode}
            />
          )
        )}

        {activeView === 'calculator' && (
          <ProductionCalculator
            profile={profile}
            initialRecord={calculatorInitialRecord}
            onOpenWhatsAppShare={handleOpenWhatsAppShare}
            onOpenNewMaterialModal={() => setIsNewMaterialOpen(true)}
            onSavedSuccess={() => {
              flushProductSync(profile.workshopId || profile.id).catch(() => {});
            }}
            externalNotesToTransfer={calculatorExternalNotes}
            onNotesTransferredHandled={() => setCalculatorExternalNotes(null)}
          />
        )}

        {activeView === 'archive' && (
          <ProductArchive
            profile={profile}
            onSelectRecordToLoad={handleSelectRecordToLoad}
            onOpenWhatsAppShare={handleOpenWhatsAppShare}
            onNavigateToCatalog={() => navigateTo('catalog')}
            onNavigateToWorkOrders={() => navigateTo('work_orders')}
          />
        )}

        {activeView === 'catalog' && (
          <WorkshopCatalog
            profile={profile}
            initialTab={catalogInitialTab}
            onSelectRecordToLoad={handleSelectRecordToLoad}
            onOpenWhatsAppShare={handleOpenWhatsAppShare}
            onOpenMarketplace={() => {
              window.location.hash = '#/market';
              setActiveRoute({ type: 'market' });
            }}
          />
        )}

        {activeView === 'materials' && (
          <MaterialsView
            workshop={profile}
            initialOpenAddModal={false}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
            onNavigateToPurchases={handleOpenPurchaseForMaterial}
          />
        )}

        {activeView === 'suppliers' && (
          <SuppliersView
            workshop={profile}
            initialOpenAddModal={false}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
            onOpenCreateSupplier={() => setIsNewSupplierOpen(true)}
            onOpenSuppliersMarket={
              isUserAdmin(profile) || featureFlags.suppliersMarketplaceEnabled
                ? () => navigateTo('suppliers_market')
                : undefined
            }
          />
        )}

        {activeView === 'suppliers_market' && (
          <SuppliersMarketView
            profile={profile}
            onNavigateBack={navigateBack}
            onNavigateToMyOrders={() => navigateTo('suppliers')}
            onOpenSupplierStore={(slug) => {
              window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
              setActiveRoute({ type: 'supplier_store', slug });
            }}
            onNavigateToCentralMarket={() => navigateTo('marketplace')}
          />
        )}

        {activeView === 'customers' && (
          <CustomersView
            workshop={profile}
            initialOpenAddModal={false}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
          />
        )}

        {activeView === 'sales' && (
          <SalesOrdersView
            profile={profile}
            onOpenWhatsAppQuote={handleOpenWhatsAppShare}
            onOpenNewClientModal={() => setIsNewClientOpen(true)}
          />
        )}

        {activeView === 'invoices' && (
          <InvoicesView
            workshop={profile}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
            onOpenDocumentPreview={() => {}}
          />
        )}

        {activeView === 'purchases' && (
          <PurchasesView
            workshop={profile}
            initialMaterial={purchaseInitialMaterial}
            onClearInitialMaterial={() => setPurchaseInitialMaterial(null)}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
            onOpenNewMaterial={() => setIsNewMaterialOpen(true)}
            onOpenCreateSupplier={() => setIsNewSupplierOpen(true)}
          />
        )}

        {activeView === 'work_orders' && (
          <WorkOrdersView
            workshop={profile}
            initialStage={workOrdersInitialStage}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
          />
        )}

        {activeView === 'treasuries' && (
          <TreasuriesView
            workshop={profile}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
          />
        )}

        {activeView === 'accounts' && (
          <AccountsView
            workshop={profile}
            onOpenHelp={(sec: string) => {
              setUserGuideSection(sec);
              setIsUserGuideOpen(true);
            }}
            onNavigateToSales={() => navigateTo('sales')}
            onNavigateToPurchases={() => navigateTo('purchases')}
          />
        )}

        {activeView === 'fixed_assets' && (
          <FixedAssetsView
            profile={profile}
            onGoBack={navigateBack}
            onOpenHelp={(sec: any) => {
              setUserGuideSection(String(sec || ''));
              setIsUserGuideOpen(true);
            }}
          />
        )}

        {activeView === 'hr' && (
          <HRWorkforceModule
            profile={profile}
            onOpenNewEmployeeModal={() => setIsNewEmployeeOpen(true)}
          />
        )}

        {activeView === 'reports' && (
          <SaaSReportsAnalyticsView
            profile={profile}
          />
        )}

        {activeView === 'ai_agent' && (
          isUserAdmin(profile) ? (
            <UnifiedAICommandCenter
              profile={profile}
              currentCategory={currentCategory}
              onApplyCategoryFromAI={handleApplyCategoryFromAI}
              onApplyEstimatedLaborWage={handleApplyEstimatedLaborWage}
              onTransferNotesToCalculator={handleTransferNotesToCalculator}
              onExportStructuredToCalculator={handleExportStructuredToCalculator}
              onNavigateHome={goHome}
            />
          ) : (
            <FalconAIAgent
              profile={profile}
              currentCategory={currentCategory}
              onApplyCategoryFromAI={handleApplyCategoryFromAI}
              onApplyEstimatedLaborWage={handleApplyEstimatedLaborWage}
              onTransferNotesToCalculator={handleTransferNotesToCalculator}
              onExportStructuredToCalculator={handleExportStructuredToCalculator}
            />
          )
        )}

        {(activeView === 'admin' || activeView === 'appeals' || activeView === 'messaging') && (
          <AdminDashboard
            profile={profile}
            initialTab={
              activeView === 'appeals'
                ? 'appeals'
                : activeView === 'messaging'
                ? 'messaging'
                : adminInitialTab
            }
            navigationKey={adminNavNonce}
            onNavigateHome={goHome}
            onOpenMessagesHub={() => {
              setNotificationsInitialTab('messages');
              setIsMessagesHubOpen(true);
            }}
            onOpenNotificationsCenter={() => {
              loadAdminAlerts();
              loadSearchCacheAndNotifications();
              setNotificationsInitialTab('admin');
              setIsNotificationsOpen(true);
            }}
            onOpenUnifiedAI={() => navigateTo('ai_agent')}
            onLogout={handleLogout}
            onProfileUpdated={(updated) => {
              setProfile(updated);
              localStorage.setItem('alshams_profile', JSON.stringify(updated));
            }}
            onSelectActiveWorkshop={(workshop) => {
              if (!originalSuperAdminProfile && profile) {
                setOriginalSuperAdminProfile(profile);
              }
              setSwitchedWorkshopContext(workshop);
              const targetWid = workshop.id || workshop.workshopId || (workshop as any).tenantId || '';
              const adminEmail = profile?.email || originalSuperAdminProfile?.email || workshop.email;
              const merged: UserProfile = {
                ...workshop,
                id: targetWid,
                workshopId: targetWid,
                tenantId: targetWid,
                role: 'superadmin',
                email: adminEmail,
              };
              setProfile(merged);
              localStorage.setItem('alshams_profile', JSON.stringify(merged));
              setActiveView('home');
              if (targetWid) {
                hydrateWorkshopIntoDexie(targetWid, { asSuperAdmin: true, userEmail: adminEmail }).catch(() => {});
              }
            }}
          />
        )}

        {activeView === 'marketplace' && (
          <MarketplaceView
            profile={profile}
            onNavigateHome={goHome}
            onOpenStoreModal={() => setIsArtisanStoreModalOpen(true)}
          />
        )}

        {activeView === 'family' && (
          <FamilyCommunityView
            profile={profile}
            isSwitchedWorkshop={Boolean(switchedWorkshopContext)}
            onOpenMemberStore={(slug, role) => {
              if (role === 'supplier') {
                window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
                setActiveRoute({ type: 'supplier_store', slug });
              } else {
                window.location.hash = `#/store/${encodeURIComponent(slug)}`;
                setActiveRoute({ type: 'store', slug });
              }
            }}
          />
        )}

        {activeView === 'personal_profile' && (
          <MemberPersonalProfileView
            mode="page"
            targetMemberId={profile.workshopId || profile.id || profile.email}
            currentUserProfile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
            onOpenStore={(slug, role) => {
              if (role === 'supplier') {
                window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
                setActiveRoute({ type: 'supplier_store', slug });
              } else {
                window.location.hash = `#/store/${encodeURIComponent(slug)}`;
                setActiveRoute({ type: 'store', slug });
              }
            }}
          />
        )}

        {activeView === 'supplier_catalog' && (
          <SupplierCatalogView
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
          />
        )}

        {activeView === 'supplier_orders' && (
          <SupplierOrdersView
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
          />
        )}

        {activeView === 'supplier_customers' && (
          <SupplierCustomersView
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
          />
        )}

        {activeView === 'supplier_finance' && (
          <SupplierFinanceView
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
          />
        )}

        {activeView === 'supplier_erp_hub' && (
          <SupplierErpHubView
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
            onNavigateToPos={(bId) => {
              setErpSelectedBranchId(bId);
              navigateTo('supplier_pos');
            }}
            onNavigateToWarehouse={(bId) => {
              setErpSelectedBranchId(bId);
              navigateTo('supplier_warehouse_erp');
            }}
            onNavigateToHrTerminal={(bId) => {
              setErpSelectedBranchId(bId);
              navigateTo('supplier_hr_terminal');
            }}
          />
        )}

        {activeView === 'supplier_pos' && (
          <SupplierPosView
            profile={profile}
            initialBranchId={erpSelectedBranchId}
            onGoBack={navigateBack}
            onGoHome={goHome}
          />
        )}

        {activeView === 'supplier_warehouse_erp' && (
          <SupplierBranchesWarehouseView
            profile={profile}
            initialBranchId={erpSelectedBranchId}
            onGoBack={navigateBack}
            onGoHome={goHome}
          />
        )}

        {activeView === 'supplier_hr_terminal' && (
          <SupplierHrTerminalView
            profile={profile}
            initialBranchId={erpSelectedBranchId}
            onGoBack={navigateBack}
            onGoHome={goHome}
            onDeviceLocked={() => setLockedTerminal(getLockedTerminalConfig())}
          />
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Shamousa Chat Assistant: Active across workshops & gated by Feature Flag */}
      {profile &&
        activeView !== 'ai_agent' &&
        activeView !== 'family' &&
        (isUserAdmin(profile) || featureFlags.aiAssistantsEnabled) && (
          <ShamousaChatWidget
            profile={profile}
            onOpenFalcon={() => navigateTo('ai_agent')}
            isAnyModalOpen={isAnyModalOpen}
          />
        )}

      {/* Sidebar Drawer Navigation */}
      {isSidebarOpen && (
        <SidebarDrawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          profile={profile}
          activeView={activeView}
          onNavigateToCatalog={handleNavigateToCatalog}
          onOpenArtisanStore={handleOpenArtisanStore}
          onSelectView={(v) => {
            if (v === 'appeals') {
              setAdminInitialTab('appeals');
              setAdminNavNonce((n) => n + 1);
              navigateTo('appeals');
            } else if (v === 'messaging') {
              setAdminInitialTab('messaging');
              setAdminNavNonce((n) => n + 1);
              navigateTo('messaging');
            } else if (v === 'materials' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('materials');
              setAdminNavNonce((n) => n + 1);
              navigateTo('admin');
            } else if (v === 'catalog' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('products');
              setAdminNavNonce((n) => n + 1);
              navigateTo('admin');
            } else if (v === 'hr' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('contacts');
              setAdminNavNonce((n) => n + 1);
              navigateTo('admin');
            } else if (v === 'treasuries' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('treasuries');
              setAdminNavNonce((n) => n + 1);
              navigateTo('admin');
            } else if (v === 'currency_rates') {
              setIsExchangeRatesOpen(true);
            } else if (v === 'expenses') {
              setIsAdminExpensesOpen(true);
            } else if (v === 'inventory') {
              setIsMaterialsModalOpen(true);
            } else if (v === 'marketplace') {
              navigateTo('marketplace');
            } else if (v === 'store') {
              handleOpenArtisanStore('products');
            } else if (v === 'my_orders') {
              handleOpenArtisanStore('orders');
            } else if (v === 'catalog') {
              handleNavigateToCatalog('catalog');
            } else {
              navigateTo(v as ActiveView);
            }
            setIsSidebarOpen(false);
          }}
          unreadNotificationsCount={
            notifications.filter((n) => !n.isRead).length + (isUserAdmin(profile) ? adminAlerts.length : 0)
          }
          unreadMessagesCount={unreadMessagesCount}
          onOpenNotifications={() => {
            loadSearchCacheAndNotifications();
            if (isUserAdmin(profile)) loadAdminAlerts();
            setNotificationsInitialTab(isUserAdmin(profile) ? 'admin' : 'notifications');
            setIsNotificationsOpen(true);
          }}
          onOpenMessagesHub={() => {
            setNotificationsInitialTab('messages');
            setIsMessagesHubOpen(true);
          }}
          onOpenProfileSettings={() => setIsProfileSettingsOpen(true)}
          onOpenCraftsSelector={() => setIsCraftsSelectorOpen(true)}
          onOpenUserGuide={(sec) => {
            setUserGuideSection(sec);
            setIsUserGuideOpen(true);
          }}
          onOpenCloudMigration={() => setIsCloudMigrationOpen(true)}
          onOpenSupport={() => setIsSupportOpen(true)}
          onStartTour={() => setIsTourOpen(true)}
          onOpenPermissionsModal={() => setIsPermissionsModalOpen(true)}
          onToggleDarkMode={handleToggleTheme}
          isDarkMode={isDarkMode}
          themeMode={themeMode}
          onSelectThemeMode={setThemeMode}
          isPerformanceMode={isPerformanceMode}
          onTogglePerformanceMode={handleTogglePerformanceMode}
          onLogout={handleLogout}
        />
      )}

      {/* Global Search Modal */}
      {isSearchOpen && (
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          cache={searchCache}
          onSelectResult={(category: string, item: any, extra?: any) => {
            if (category === 'screens' && item?.targetView) {
              navigateTo(item.targetView as ActiveView);
            } else if (category === 'products' && (item.id || item.productName)) {
              handleSelectRecordToLoad(item);
            } else if (extra?.view) {
              navigateTo(extra.view as ActiveView);
            }
            setIsSearchOpen(false);
          }}
        />
      )}

      {/* Unified Alerts & Messages Modal (مركز التنبيهات الموحد) */}
      {(isNotificationsOpen || isMessagesHubOpen) && (
        <UnifiedAlertsModal
          isOpen={isNotificationsOpen || isMessagesHubOpen}
          onClose={() => {
            setIsNotificationsOpen(false);
            setIsMessagesHubOpen(false);
          }}
          initialTab={isMessagesHubOpen ? 'messages' : notificationsInitialTab}
          notifications={notifications}
          adminAlerts={isUserAdmin(profile) ? adminAlerts : []}
          onDismissAdminAlert={handleDismissAdminAlert}
          onNavigateToAdminTab={(tab) => {
            setAdminInitialTab(tab as any);
            setAdminNavNonce((n) => n + 1);
            navigateTo('admin');
          }}
          onNavigateToView={(v) => navigateTo(v as ActiveView)}
          profile={profile}
          unreadMessagesCount={unreadMessagesCount}
          onRefreshNotifications={loadSearchCacheAndNotifications}
          onNavigateToOrder={() => navigateTo('sales')}
          onNavigateToInventory={() => navigateTo('materials')}
          onReceiptUpdate={() => {
            loadAnnouncements();
            loadAdminInboxUnreadCount();
          }}
        />
      )}

      {/* Profile Settings Modal */}
      {isProfileSettingsOpen && (
        <ProfileSettingsModal
          isOpen={isProfileSettingsOpen}
          onClose={() => setIsProfileSettingsOpen(false)}
          profile={profile}
          onProfileUpdated={(updated: UserProfile) => {
            setProfile(updated);
            localStorage.setItem('alshams_profile', JSON.stringify(updated));
          }}
          isPerformanceMode={isPerformanceMode}
          onTogglePerformanceMode={handleTogglePerformanceMode}
          themeMode={themeMode}
          onSelectThemeMode={setThemeMode}
        />
      )}

      {/* Crafts Selector Modal */}
      {isCraftsSelectorOpen && (
        <CraftsSelectorModal
          isOpen={isCraftsSelectorOpen}
          onClose={() => setIsCraftsSelectorOpen(false)}
          workshop={profile}
          onCraftsUpdated={(selectedCrafts: string[]) => {
            const updated = { ...profile, selectedCrafts };
            setProfile(updated);
            localStorage.setItem('alshams_profile', JSON.stringify(updated));
          }}
        />
      )}

      {/* User Guide Modal */}
      {isUserGuideOpen && (
        <UserGuideModal
          isOpen={isUserGuideOpen}
          onClose={() => {
            setIsUserGuideOpen(false);
            setUserGuideSection(undefined);
          }}
          initialSectionId={userGuideSection}
        />
      )}

      {/* Cloud Migration Modal */}
      {isCloudMigrationOpen && (
        <CloudMigrationModal
          isOpen={isCloudMigrationOpen}
          onClose={() => setIsCloudMigrationOpen(false)}
          workshopId={profile.workshopId || profile.id}
          userEmail={profile.email}
          onMigrationComplete={() => {
            flushProductSync(profile.workshopId || profile.id).catch(() => {});
          }}
        />
      )}

      {/* Support & Community Modal */}
      {isSupportOpen && (
        <SupportModal
          isOpen={isSupportOpen}
          onClose={() => setIsSupportOpen(false)}
          profile={profile}
        />
      )}

      {/* Interactive Tour Modal */}
      {isTourOpen && (
        <InteractiveTourModal
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
          profile={profile}
          onNavigateToCalculator={() => navigateTo('calculator')}
        />
      )}

      {/* Exchange Rates Modal */}
      {isExchangeRatesOpen && (
        <ExchangeRatesModal
          isOpen={isExchangeRatesOpen}
          onClose={() => setIsExchangeRatesOpen(false)}
          profile={profile}
        />
      )}

      {/* Dedicated Materials Inventory Modal (جدول materials) */}
      {isMaterialsModalOpen && profile && (
        <MaterialsInventoryModal
          isOpen={isMaterialsModalOpen}
          onClose={() => setIsMaterialsModalOpen(false)}
          profile={profile}
          onOpenPurchaseForMaterial={(item) =>
            handleOpenPurchaseForMaterial({
              materialId: item.id,
              materialName: item.name,
              supplierId: item.supplier_id,
              unitCost: item.costPrice || item.purchase_price,
              unitName: item.unit,
            })
          }
        />
      )}

      {/* Dedicated Products Inventory Modal (جدول products) */}
      {isProductsModalOpen && profile && (
        <ProductsInventoryModal
          isOpen={isProductsModalOpen}
          onClose={() => setIsProductsModalOpen(false)}
          profile={profile}
        />
      )}

      {/* Inventory Ledger Modal */}
      {isInventoryLedgerOpen && (
        <InventoryLedgerModal
          isOpen={isInventoryLedgerOpen}
          onClose={() => setIsInventoryLedgerOpen(false)}
          profile={profile}
        />
      )}

      {/* Admin Expenses Modal */}
      {isAdminExpensesOpen && (
        <AdminExpensesModal
          isOpen={isAdminExpensesOpen}
          onClose={() => setIsAdminExpensesOpen(false)}
          profile={profile}
        />
      )}

      {/* WhatsApp Quote Drawer */}
      {isQuoteDrawerOpen && (
        <WhatsAppQuoteDrawer
          isOpen={isQuoteDrawerOpen}
          onClose={() => {
            setIsQuoteDrawerOpen(false);
            setQuoteRecord(null);
          }}
          record={quoteRecord}
          profile={profile}
        />
      )}

      {/* Quick Creation Modals */}
      {isNewMaterialOpen && (
        <NewMaterialModal
          isOpen={isNewMaterialOpen}
          onClose={() => setIsNewMaterialOpen(false)}
          profile={profile}
          onSuccess={() => {
            loadSearchCacheAndNotifications();
            window.dispatchEvent(new CustomEvent('alshams_materials_changed'));
          }}
        />
      )}

      {isNewClientOpen && (
        <NewClientModal
          isOpen={isNewClientOpen}
          onClose={() => setIsNewClientOpen(false)}
          profile={profile}
          onSuccess={() => {}}
        />
      )}

      {isNewSupplierOpen && (
        <NewSupplierModal
          isOpen={isNewSupplierOpen}
          onClose={() => setIsNewSupplierOpen(false)}
          profile={profile}
          onSuccess={() => {}}
        />
      )}

      {isNewEmployeeOpen && (
        <NewEmployeeModal
          isOpen={isNewEmployeeOpen}
          onClose={() => setIsNewEmployeeOpen(false)}
          profile={profile}
          onSuccess={() => {}}
        />
      )}


      {/* Artisan Storefront Modal & Order Lifecycle */}
      <ArtisanStorefrontModal
        isOpen={isArtisanStoreModalOpen}
        onClose={() => {
          setIsArtisanStoreModalOpen(false);
          setSelectedStoreOrderId(undefined);
        }}
        profile={profile}
        initialOrderId={selectedStoreOrderId}
        initialTab={artisanStoreInitialTab}
        onOpenCalculatorForRecord={(rec: any) => {
          setCalculatorInitialRecord(rec);
          navigateTo('calculator');
          setIsArtisanStoreModalOpen(false);
        }}
        onOpenPersonalProfile={() => {
          setIsArtisanStoreModalOpen(false);
          navigateTo('personal_profile');
        }}
      />

      {/* Supplier Storefront Config & QR Modal */}
      {isSupplierStoreModalOpen && (
        <SupplierStorefrontModal
          isOpen={isSupplierStoreModalOpen}
          onClose={() => setIsSupplierStoreModalOpen(false)}
          profile={profile}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            localStorage.setItem('alshams_profile', JSON.stringify(updated));
          }}
          onOpenPersonalProfile={() => {
            setIsSupplierStoreModalOpen(false);
            navigateTo('personal_profile');
          }}
        />
      )}

      {/* Permissions & Background Onboarding Modal */}
      <PermissionsOnboardingModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        isInitialOnboarding={typeof window !== 'undefined' && !localStorage.getItem('alshams_permissions_prompted')}
        profile={profile}
      />

      {/* Offline / Online Status Banner */}
      <OfflineIndicator />
    </div>
  );
};

export default App;
