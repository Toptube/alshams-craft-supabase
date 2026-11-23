import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
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
import {
  getCurrentWorkshopFromSupabase,
  getArabicSupabaseError,
  updateWorkshopProfileInSupabase,
} from './db/supabaseService';
import { flushProductSync, startProductSync } from './db/productsCloud';
import { tenantStorage } from './db/dexieDB';
import { playPostaNotificationSound } from './lib/sounds';
import { startQuietBackgroundSync, hydrateWorkshopIntoDexie } from './services/periodicQuietSync';
import { syncPlatformSettingsFromCloud } from './services/marketplaceCartService';
import { getStoredLandingCmsConfig, syncBrandFaviconFromCms } from './types/landingCms';
import { useFeatureFlags } from './types/featureFlags';
import { useUiLayoutConfig } from './types/uiLayoutConfig';
import { getPathForView, resolveViewFromPath } from './lib/appRoutes';
import { getCurrentSupplierFromSupabase } from './db/supplierService';
import { getMainSectionForCraft } from './registry/craftsRegistry';
import type { StructuredCalculatorExport } from './components/ai/FalconAIAgent';
import type { ExecutiveTab } from './components/admin/AdminDashboard';
import type { GlobalSearchDataCache } from './components/search/GlobalSearchModal';
import { purgeExpiredImageArchives } from './services/imageRollbackService';
import {
  getLockedTerminalConfig,
  KIOSK_LOCK_CHANGED_EVENT,
} from './db/supplierErpService';
import { LockedTerminalConfig } from './types/supplierErp';
import {
  registerServiceWorker,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  checkAndDispatchEquipmentMaintenanceAlerts,
} from './lib/pushNotifications';
import { initOfflineSyncListeners, flushOfflineMutations } from './db/offlineMutationQueue';

// Core Shell Components (eager)
import { Navbar } from './components/layout/Navbar';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';

// Lazy-loaded Views, Gateways & Dashboards
const AccessGate = lazy(() =>
  import('./components/gate/AccessGate').then((m) => ({ default: m.AccessGate }))
);
const MessagesHubModal = lazy(() =>
  import('./components/messages/MessagesHubModal').then((m) => ({ default: m.MessagesHubModal }))
);
const SidebarDrawer = lazy(() =>
  import('./components/layout/SidebarDrawer').then((m) => ({ default: m.SidebarDrawer }))
);
const WorkshopHomeScreen = lazy(() =>
  import('./components/home/WorkshopHomeScreen').then((m) => ({ default: m.WorkshopHomeScreen }))
);
const ArtisanExecutiveBriefView = lazy(() =>
  import('./components/home/ArtisanExecutiveBriefView').then((m) => ({
    default: m.ArtisanExecutiveBriefView,
  }))
);
const ProductionCalculator = lazy(() =>
  import('./components/calculator/ProductionCalculator').then((m) => ({
    default: m.ProductionCalculator,
  }))
);
const ProductArchive = lazy(() =>
  import('./components/archive/ProductArchive').then((m) => ({ default: m.ProductArchive }))
);
const WorkshopCatalog = lazy(() =>
  import('./components/catalog/WorkshopCatalog').then((m) => ({ default: m.WorkshopCatalog }))
);
const MaterialsView = lazy(() =>
  import('./components/materials/MaterialsView').then((m) => ({ default: m.MaterialsView }))
);
const SuppliersView = lazy(() =>
  import('./components/suppliers/SuppliersView').then((m) => ({ default: m.SuppliersView }))
);
const CustomersView = lazy(() =>
  import('./components/customers/CustomersView').then((m) => ({ default: m.CustomersView }))
);
const SalesOrdersView = lazy(() =>
  import('./components/sales/SalesOrdersView').then((m) => ({ default: m.SalesOrdersView }))
);
const InvoicesView = lazy(() =>
  import('./components/invoices/InvoicesView').then((m) => ({ default: m.InvoicesView }))
);
const WorkOrdersView = lazy(() =>
  import('./components/workOrders/WorkOrdersView').then((m) => ({ default: m.WorkOrdersView }))
);
const TreasuriesView = lazy(() =>
  import('./components/treasuries/TreasuriesView').then((m) => ({ default: m.TreasuriesView }))
);
const FixedAssetsView = lazy(() =>
  import('./components/assets/FixedAssetsView').then((m) => ({ default: m.FixedAssetsView }))
);
const HRWorkforceModule = lazy(() =>
  import('./components/hr/HRWorkforceModule').then((m) => ({ default: m.HRWorkforceModule }))
);
const SaaSReportsAnalyticsView = lazy(() =>
  import('./components/reports/SaaSReportsAnalyticsView').then((m) => ({
    default: m.SaaSReportsAnalyticsView,
  }))
);
const FalconAIAgent = lazy(() =>
  import('./components/ai/FalconAIAgent').then((m) => ({ default: m.FalconAIAgent }))
);
const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const PurchasesView = lazy(() =>
  import('./components/purchases/PurchasesView').then((m) => ({ default: m.PurchasesView }))
);
const AccountsView = lazy(() =>
  import('./components/accounting/AccountsView').then((m) => ({ default: m.AccountsView }))
);
const AuthGateway = lazy(() =>
  import('./components/auth/AuthGateway').then((m) => ({ default: m.AuthGateway }))
);
const ResetPasswordScreen = lazy(() =>
  import('./components/auth/ResetPasswordScreen').then((m) => ({
    default: m.ResetPasswordScreen,
  }))
);
const CompleteWorkshopScreen = lazy(() =>
  import('./components/auth/CompleteWorkshopScreen').then((m) => ({
    default: m.CompleteWorkshopScreen,
  }))
);
const LandingPage = lazy(() =>
  import('./components/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);

// Lazy-loaded Modals & Drawers
const GlobalSearchModal = lazy(() =>
  import('./components/search/GlobalSearchModal').then((m) => ({ default: m.GlobalSearchModal }))
);
const UnifiedAlertsModal = lazy(() =>
  import('./components/notifications/UnifiedAlertsModal').then((m) => ({
    default: m.UnifiedAlertsModal,
  }))
);
const ProfileSettingsModal = lazy(() =>
  import('./components/profile/ProfileSettingsModal').then((m) => ({
    default: m.ProfileSettingsModal,
  }))
);
const CraftsSelectorModal = lazy(() =>
  import('./components/onboarding/CraftsSelectorModal').then((m) => ({
    default: m.CraftsSelectorModal,
  }))
);
const UserGuideModal = lazy(() =>
  import('./components/guide/UserGuideModal').then((m) => ({ default: m.UserGuideModal }))
);
const CloudMigrationModal = lazy(() =>
  import('./components/migration/CloudMigrationModal').then((m) => ({
    default: m.CloudMigrationModal,
  }))
);
const SupportModal = lazy(() =>
  import('./components/support/SupportModal').then((m) => ({ default: m.SupportModal }))
);
const InteractiveTourModal = lazy(() =>
  import('./components/tour/InteractiveTourModal').then((m) => ({
    default: m.InteractiveTourModal,
  }))
);
const ExchangeRatesModal = lazy(() =>
  import('./components/currency/ExchangeRatesModal').then((m) => ({
    default: m.ExchangeRatesModal,
  }))
);
const InventoryLedgerModal = lazy(() =>
  import('./components/inventory/InventoryLedgerModal').then((m) => ({
    default: m.InventoryLedgerModal,
  }))
);
const MaterialsInventoryModal = lazy(() =>
  import('./components/inventory/MaterialsInventoryModal').then((m) => ({
    default: m.MaterialsInventoryModal,
  }))
);
const ProductsInventoryModal = lazy(() =>
  import('./components/inventory/ProductsInventoryModal').then((m) => ({
    default: m.ProductsInventoryModal,
  }))
);
const StartWorkshopGuidePage = lazy(() =>
  import('./components/home/WorkshopGuidancePage').then((m) => ({
    default: m.StartWorkshopGuidePage,
  }))
);
const DailyRoutineGuidePage = lazy(() =>
  import('./components/home/WorkshopGuidancePage').then((m) => ({
    default: m.DailyRoutineGuidePage,
  }))
);
const AdminExpensesModal = lazy(() =>
  import('./components/adminCosts/AdminExpensesModal').then((m) => ({
    default: m.AdminExpensesModal,
  }))
);
const WhatsAppQuoteDrawer = lazy(() =>
  import('./components/sharing/WhatsAppQuoteDrawer').then((m) => ({
    default: m.WhatsAppQuoteDrawer,
  }))
);
const UnifiedNewMaterialModal = lazy(() =>
  import('./components/materials/UnifiedNewMaterialModal').then((m) => ({
    default: m.UnifiedNewMaterialModal,
  }))
);
const NewClientModal = lazy(() =>
  import('./components/modals/CreationModals').then((m) => ({ default: m.NewClientModal }))
);
const NewSupplierModal = lazy(() =>
  import('./components/modals/CreationModals').then((m) => ({ default: m.NewSupplierModal }))
);
const NewEmployeeModal = lazy(() =>
  import('./components/modals/CreationModals').then((m) => ({ default: m.NewEmployeeModal }))
);

// Lazy-loaded Assistants, Marketplaces & Supplier Views
const ShamousaChatWidget = lazy(() =>
  import('./components/ai/ShamousaChatWidget').then((m) => ({ default: m.ShamousaChatWidget }))
);
const UnifiedAICommandCenter = lazy(() =>
  import('./components/ai/UnifiedAICommandCenter').then((m) => ({
    default: m.UnifiedAICommandCenter,
  }))
);
const MarketplaceView = lazy(() =>
  import('./components/marketplace/MarketplaceView').then((m) => ({ default: m.MarketplaceView }))
);
const ArtisanStorefrontModal = lazy(() =>
  import('./components/store/ArtisanStorefrontModal').then((m) => ({
    default: m.ArtisanStorefrontModal,
  }))
);
const PublicStorefrontView = lazy(() =>
  import('./components/store/PublicStorefrontView').then((m) => ({
    default: m.PublicStorefrontView,
  }))
);
const PublicProductLandingView = lazy(() =>
  import('./components/store/PublicProductLandingView').then((m) => ({
    default: m.PublicProductLandingView,
  }))
);
const FamilyCommunityView = lazy(() =>
  import('./components/family/FamilyCommunityView').then((m) => ({
    default: m.FamilyCommunityView,
  }))
);
const MySubscriptionsPage = lazy(() =>
  import('./components/subscriptions/MySubscriptionsPage').then((m) => ({
    default: m.MySubscriptionsPage,
  }))
);
import { PackageSelectionOnboardingModal } from './components/subscriptions/MySubscriptionsPage';
import {
  useUserSubscription,
  shouldPromptExistingUserForPackages,
  isShamousaUnlockedBySubscription,
  isSakrUnlockedBySubscription,
} from './types/subscriptions';
const SupplierHomeScreen = lazy(() =>
  import('./components/supplier/SupplierHomeScreen').then((m) => ({
    default: m.SupplierHomeScreen,
  }))
);
const SupplierCatalogView = lazy(() =>
  import('./components/supplier/SupplierCatalogView').then((m) => ({
    default: m.SupplierCatalogView,
  }))
);
const SupplierOrdersView = lazy(() =>
  import('./components/supplier/SupplierOrdersView').then((m) => ({
    default: m.SupplierOrdersView,
  }))
);
const SupplierCustomersView = lazy(() =>
  import('./components/supplier/SupplierCustomersView').then((m) => ({
    default: m.SupplierCustomersView,
  }))
);
const SupplierFinanceView = lazy(() =>
  import('./components/supplier/SupplierFinanceView').then((m) => ({
    default: m.SupplierFinanceView,
  }))
);
const SupplierStorefrontModal = lazy(() =>
  import('./components/supplier/SupplierStorefrontModal').then((m) => ({
    default: m.SupplierStorefrontModal,
  }))
);
const SuppliersMarketView = lazy(() =>
  import('./components/supplier/SuppliersMarketView').then((m) => ({
    default: m.SuppliersMarketView,
  }))
);
const SupplierPublicStoreView = lazy(() =>
  import('./components/supplier/SupplierPublicStoreView').then((m) => ({
    default: m.SupplierPublicStoreView,
  }))
);
const LiveStorefrontStudioPage = lazy(() =>
  import('./components/store/LiveStorefrontStudioPage').then((m) => ({
    default: m.LiveStorefrontStudioPage,
  }))
);
const SupplierErpHubView = lazy(() =>
  import('./components/supplier/SupplierErpHubView').then((m) => ({
    default: m.SupplierErpHubView,
  }))
);
const SupplierPosView = lazy(() =>
  import('./components/supplier/SupplierPosView').then((m) => ({ default: m.SupplierPosView }))
);
const SupplierBranchesWarehouseView = lazy(() =>
  import('./components/supplier/SupplierBranchesWarehouseView').then((m) => ({
    default: m.SupplierBranchesWarehouseView,
  }))
);
const SupplierHrTerminalView = lazy(() =>
  import('./components/supplier/SupplierHrTerminalView').then((m) => ({
    default: m.SupplierHrTerminalView,
  }))
);
const SupplierExecutiveBriefView = lazy(() =>
  import('./components/supplier/SupplierExecutiveBriefView').then((m) => ({
    default: m.SupplierExecutiveBriefView,
  }))
);
const LockedTerminalShell = lazy(() =>
  import('./components/supplier/LockedTerminalShell').then((m) => ({
    default: m.LockedTerminalShell,
  }))
);
const MemberPersonalProfileView = lazy(() =>
  import('./components/profile/MemberPersonalProfileView').then((m) => ({
    default: m.MemberPersonalProfileView,
  }))
);
const PermissionsOnboardingModal = lazy(() =>
  import('./components/permissions/PermissionsOnboardingModal').then((m) => ({
    default: m.PermissionsOnboardingModal,
  }))
);

const AppScreenFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] font-sans" dir="rtl">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-bold text-[#334155] dark:text-[#CBD5E1]">جاري التحميل...</p>
    </div>
  </div>
);

const ViewFallback: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-3" dir="rtl">
    <div className="w-10 h-10 border-4 border-[#D4CCBC] dark:border-[#22355E] border-t-[#EA580C] rounded-full animate-spin" />
    <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">جاري فتح الشاشة...</p>
  </div>
);

import {
  getStoredArtisanStoreConfig,
  saveStoredArtisanStoreConfig,
} from './types/artisanStoreBuilder';

// Icons for the sub-page navigation bar
import { ArrowRight, ExternalLink, Home, ShoppingBag, Sparkles, X } from 'lucide-react';

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
  | 'personal_profile'
  | 'executive_brief'
  | 'supplier_executive_brief'
  | 'guide_start'
  | 'guide_daily'
  | 'inventory_materials'
  | 'inventory_audit'
  | 'finished_products'
  | 'my_store'
  | 'my_store_studio'
  | 'my_orders'
  | 'my_subscriptions';

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
  materials: 'خاماتي والمخزن',
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
  executive_brief: 'هلخصهالك — الملخص البسيط لورشتك',
  supplier_executive_brief: 'هلخصهالك للموردين — الملخص البسيط لمتجرك وفروعك',
  guide_start: 'نبدأ ورشتنا',
  guide_daily: 'يومك في الورشة',
  inventory_materials: 'جرد أرصدة الخامات',
  inventory_audit: 'حركة المخزن والجرد',
  finished_products: 'مخزن المنتجات الجاهزة',
  my_store: 'لوحة تحكم متجري',
  my_store_studio: 'متجري المباشر (استوديو التعديل والمعاينة)',
  my_orders: 'أوردراتي والطلبات',
  my_subscriptions: 'اشتراكاتي وباقات المنظومة',
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
  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const hasUrlAuth =
      /[?&](code=|token_hash=|type=recovery|error=|error_code=)/i.test(search) ||
      /(type=recovery|access_token=|error=)/i.test(hash);
    if (hasUrlAuth) return true;
    if (profile) return false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const val = localStorage.getItem(k);
          if (val && val.includes('access_token')) return true;
        }
      }
    } catch {}
    return false;
  });
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

  const uiLayoutConfig = useUiLayoutConfig();
  const userSubscription = useUserSubscription(profile);
  const [dismissedPackageOnboarding, setDismissedPackageOnboarding] = useState(false);

  // Navigation & View state (clean URL per page: /treasuries, /materials, /purchases, /family, etc.)
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const resolved = resolveViewFromPath(
        window.location.pathname || '/',
        window.location.search || '',
        window.location.hash || ''
      );
      if (resolved && VIEW_TITLES[resolved as ActiveView]) {
        return resolved as ActiveView;
      }
    }
    return 'home';
  });
  const [historyStack, setHistoryStack] = useState<ActiveView[]>([]);
  const [adminInitialTab, setAdminInitialTab] = useState<ExecutiveTab>('home');
  const [adminNavNonce, setAdminNavNonce] = useState<number>(0);
  const [openUnifiedPickerOnEnter, setOpenUnifiedPickerOnEnter] = useState<boolean>(false);
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

  useEffect(() => {
    purgeExpiredImageArchives();
    const timer = window.setInterval(() => {
      purgeExpiredImageArchives();
    }, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
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
    if (tab === 'orders') {
      navigateTo('my_orders');
      return;
    }
    setArtisanStoreInitialTab(tab);
    navigateTo('my_store');
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
  }, [
    profile?.tenantId,
    profile?.workshopId,
    profile?.id,
    userSubscription.activePackageIds.join(','),
    loadSearchCacheAndNotifications,
  ]);

  // آلية المزامنة الدورية الهادئة في الخلفية ومزامنة الكتالوج والمتجر (مؤجلة 1.8 ثانية لتجنب الضغط اللحظي عند الفتح)
  useEffect(() => {
    if (!profile) return;
    const tid = profile.tenantId || profile.workshopId || profile.id;
    let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
    if (
      tid &&
      tid !== 'workshop_demo' &&
      tid !== '00000000-0000-0000-0000-000000000000' &&
      profile.accountRole !== 'supplier'
    ) {
      hydrateTimer = setTimeout(() => {
        hydrateWorkshopIntoDexie(tid, {
          asSuperAdmin: isUserAdmin(profile) && !switchedWorkshopContext,
          userEmail: profile.email,
        }).catch(() => {});
      }, 1800);
    }
    const cleanupQuiet = startQuietBackgroundSync(profile);
    const cleanupProducts = tid ? startProductSync(tid) : () => {};
    return () => {
      if (hydrateTimer) clearTimeout(hydrateTimer);
      cleanupQuiet();
      cleanupProducts();
    };
  }, [profile?.tenantId, profile?.workshopId, profile?.id, profile?.accountRole, switchedWorkshopContext]);

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

        let hasStoredSbSession = false;
        try {
          if (typeof window !== 'undefined') {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i) || '';
              if (k.startsWith('sb-') && k.endsWith('-auth-token') && localStorage.getItem(k)) {
                hasStoredSbSession = true;
                break;
              }
            }
          }
        } catch {}

        let { data: { session } } = await supabase.auth.getSession();
        if (!session && (hadCodeInUrl || hasStoredSbSession) && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
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

  useEffect(() => {
    const handleProfileSynced = (e: Event) => {
      const detail = (e as CustomEvent<{
        logoUrl?: string;
        brandName?: string;
        phoneNumber?: string;
        governorate?: string;
        storyText?: string;
        bioHeadline?: string;
        gender?: 'male' | 'female';
        familyNickname?: string;
        skillLevel?: UserProfile['skillLevel'];
        assessmentScore?: number;
      }>).detail;
      if (!detail) return;

      setProfile((prev) => {
        if (!prev) return prev;
        const nextLogo = detail.logoUrl !== undefined ? detail.logoUrl : prev.logoUrl;
        const nextStoreConfig =
          prev.accountRole === 'supplier'
            ? {
                ...(prev.storeConfig || {}),
                ...(detail.phoneNumber !== undefined ? { phone: detail.phoneNumber } : {}),
                ...(detail.governorate !== undefined ? { governorate: detail.governorate } : {}),
                ...(detail.storyText !== undefined ? { description: detail.storyText } : {}),
                ...(detail.bioHeadline !== undefined ? { tagline: detail.bioHeadline } : {}),
              }
            : prev.storeConfig;

        const next: UserProfile = {
          ...prev,
          ...(detail.logoUrl !== undefined
            ? { logoUrl: nextLogo, logo_url: nextLogo, logoBase64: nextLogo }
            : {}),
          ...(detail.brandName ? { brandName: detail.brandName } : {}),
          ...(detail.phoneNumber !== undefined ? { phoneNumber: detail.phoneNumber } : {}),
          ...(detail.governorate !== undefined ? { governorate: detail.governorate } : {}),
          ...(detail.gender === 'male' || detail.gender === 'female' ? { gender: detail.gender } : {}),
          ...(detail.familyNickname ? { familyNickname: detail.familyNickname } : {}),
          ...(detail.skillLevel ? { skillLevel: detail.skillLevel } : {}),
          ...(typeof detail.assessmentScore === 'number'
            ? { assessmentScore: detail.assessmentScore }
            : {}),
          ...(nextStoreConfig ? { storeConfig: nextStoreConfig } : {}),
        };
        try {
          localStorage.setItem('alshams_profile', JSON.stringify(next));
          tenantStorage.saveProfile(next).catch(() => {});
        } catch {}

        if (prev.accountRole !== 'supplier' && (detail.storyText !== undefined || detail.bioHeadline !== undefined)) {
          const tenantId = prev.workshopId || prev.tenantId || prev.id || '';
          if (tenantId) {
            const existingCfg = getStoredArtisanStoreConfig(tenantId);
            saveStoredArtisanStoreConfig(tenantId, {
              ...existingCfg,
              ...(detail.storyText !== undefined ? { artistStory: detail.storyText } : {}),
              ...(detail.bioHeadline !== undefined ? { workshopTagline: detail.bioHeadline } : {}),
            });
          }
        }
        return next;
      });
    };

    window.addEventListener('alshams_profile_synced', handleProfileSynced);
    return () => window.removeEventListener('alshams_profile_synced', handleProfileSynced);
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

  // Navigation handlers with real clean URL per page + browser history support
  const syncViewUrl = useCallback((targetView: ActiveView, push = true) => {
    if (typeof window === 'undefined') return;
    const nextPath = getPathForView(targetView);
    const currentFull = `${window.location.pathname || '/'}${window.location.hash || ''}`;
    if (currentFull !== nextPath) {
      try {
        if (push) {
          window.history.pushState({ alshamsView: targetView }, '', nextPath);
        } else {
          window.history.replaceState({ alshamsView: targetView }, '', nextPath);
        }
      } catch {}
    }
    const customTitle = uiLayoutConfig.pageOverrides?.[targetView]?.title || VIEW_TITLES[targetView];
    if (customTitle && typeof document !== 'undefined') {
      document.title =
        targetView === 'home'
          ? 'منظومة الشمساوية | منظومة سحابية متكاملة'
          : `${customTitle} | منظومة الشمساوية`;
    }
  }, [uiLayoutConfig.pageOverrides]);

  const navigateTo = useCallback(
    (view: ActiveView) => {
      if (view === activeView) return;
      setHistoryStack((prev) => [...prev, activeView]);
      setActiveView(view);
      syncViewUrl(view, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activeView, syncViewUrl]
  );

  const handleNavigateToCatalog = useCallback(
    (tab?: 'catalog' | 'store') => {
      if (tab === 'store') {
        setArtisanStoreInitialTab('products');
        navigateTo('my_store');
        return;
      }
      setCatalogInitialTab('catalog');
      navigateTo('catalog');
    },
    [navigateTo]
  );

  const handleNavigateToUnifiedMaterials = useCallback(() => {
    if (profile && isUserAdmin(profile) && !switchedWorkshopContext) {
      setAdminInitialTab('unified_materials');
      setAdminNavNonce((n) => n + 1);
      navigateTo('admin');
      return;
    }
    setOpenUnifiedPickerOnEnter(true);
    if (profile?.accountRole === 'supplier') {
      navigateTo('supplier_catalog');
    } else {
      navigateTo('materials');
    }
  }, [profile, switchedWorkshopContext, navigateTo]);

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
        if (profile?.accountRole === 'supplier') {
          setIsSupplierStoreModalOpen(true);
        } else {
          handleOpenArtisanStore('products');
        }
        return;
      }
      if (view === 'my_orders') {
        if (profile?.accountRole === 'supplier') {
          navigateTo('supplier_orders');
        } else {
          handleOpenArtisanStore('orders');
        }
        return;
      }
      if (view === 'unified_materials' || view === 'nav_unified_materials' || view === 'sup_unified_materials') {
        handleNavigateToUnifiedMaterials();
        return;
      }
      if (view && VIEW_TITLES[view as ActiveView]) {
        navigateTo(view as ActiveView);
      }
    };

    window.addEventListener('alshams_open_view', handleOpenView);
    return () => window.removeEventListener('alshams_open_view', handleOpenView);
  }, [activeView, profile?.accountRole, handleNavigateToUnifiedMaterials, navigateTo]);

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

  const navigateBack = useCallback(() => {
    if (historyStack.length > 0) {
      const previous = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, -1));
      setActiveView(previous);
      syncViewUrl(previous, true);
      window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
    } else {
      window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
      if (activeView !== 'home') {
        setActiveView('home');
        syncViewUrl('home', true);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [historyStack, activeView, syncViewUrl]);

  // Listen to store opening events (with optional targeted order ID / tab)
  useEffect(() => {
    const handleOpenStore = (e: Event) => {
      if (profile?.accountRole === 'supplier') {
        setIsSupplierStoreModalOpen(true);
        return;
      }
      const customEvent = e as CustomEvent<{
        orderId?: string;
        tab?: 'products' | 'appearance' | 'promotions' | 'orders' | 'qr';
      }>;
      if (customEvent.detail?.orderId) {
        setSelectedStoreOrderId(customEvent.detail.orderId);
        navigateTo('my_orders');
      } else if (customEvent.detail?.tab === 'orders') {
        setSelectedStoreOrderId(undefined);
        navigateTo('my_orders');
      } else {
        setSelectedStoreOrderId(undefined);
        setArtisanStoreInitialTab(customEvent.detail?.tab || 'products');
        navigateTo('my_store');
      }
    };

    window.addEventListener('alshams_open_store', handleOpenStore);
    return () => window.removeEventListener('alshams_open_store', handleOpenStore);
  }, [profile?.accountRole, navigateTo]);

  const goHome = useCallback(() => {
    window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
    syncViewUrl('home', true);
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
  }, [activeView, isSuperAdminMode, syncViewUrl]);

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
    // Notes are embedded directly inside synthesizedRecord.input.personalNotes (avoid duplicate append)
    setCalculatorExternalNotes(null);
    if (data.category) setCurrentCategory(data.category as CraftCategory);

    const resolvedCraftId = (data as any).craftId || profile?.selectedCrafts?.[0] || 'macrame';
    const resolvedSectionId = (data as any).mainSectionId || getMainSectionForCraft(resolvedCraftId);
    const safeCategory = (data.category as CraftCategory) || currentCategory || 'جدارية';
    const prodName = data.productName || 'مشغولة يدوية بتصميم خاص';
    const hours = Number(data.hours) || 3;
    const wage = Number(data.laborWage) || 120;
    const hourly = hours > 0 ? Math.round(wage / hours) : 45;
    const weight = Number(data.weightKg) || 0.8;
    const priceKg = Number(data.pricePerKg) || 180;
    const cordCost = Math.round(weight * priceKg);

    const extraMats = data.extraMaterials && data.extraMaterials.length > 0
      ? data.extraMaterials
      : [
          {
            id: 'mat_base_' + Date.now(),
            name: 'قاعدة / خامة دعم مساعدة',
            unit: 'قطعة',
            unitPrice: 40,
            quantity: 1,
            totalCost: 40,
          },
          {
            id: 'mat_acc_' + Date.now(),
            name: 'إكسسوارات وتشطيب وتغليف',
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

    const inferredShape =
      Number(data.diameterCm) > 0
        ? 'cylinder'
        : Number(data.sideHeightCm) > 0
          ? 'rectangle'
          : 'flat';

    const synthesizedRecord: SavedProductRecord = {
      id: 'calc_export_' + Date.now(),
      workshopId: (profile as any)?.workshopId || undefined,
      tenantId: (profile as any)?.tenantId || undefined,
      productName: prodName,
      productCode: 'SH-' + Math.floor(1000 + Math.random() * 9000),
      mainSectionId: resolvedSectionId,
      craftId: resolvedCraftId,
      category: safeCategory,
      costPrice,
      retailPrice,
      wholesalePrice,
      imageUrl: data.imageUrl,
      isCatalogVisible: false,
      inStore: false,
      isPublishedInStore: false,
      inMarket: false,
      marketStatus: 'none',
      currentStock: 0,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      input: {
        category: safeCategory,
        productName: prodName,
        craftId: resolvedCraftId,
        mainSectionId: resolvedSectionId,
        pricingMode: 'margin',
        shape3D: inferredShape,
        widthCm: Number(data.widthCm) || 40,
        diameterCm: Number(data.diameterCm) || 0,
        baseDiameterCm: Number(data.diameterCm) || 0,
        sideHeightCm: Number(data.sideHeightCm) || 0,
        totalLengthCm: Number(data.heightCm) || 50,
        fringeLengthCm: Number(data.fringeLengthCm) || 0,
        cordTypeId: data.cordTypeId || 'cotton_braided',
        cordThicknessMm: Number(data.cordThicknessMm) || 4,
        pricePerKg: priceKg,
        curtainRodCost: 0,
        cushionCoverCost: 0,
        fiberCost: 0,
        bagAccessoriesCost: 0,
        extraMaterials: extraMats,
        laborWage: wage,
        productionHours: hours,
        hourlyRateOverride: hourly,
        profitMarginPercent: 35,
        packagingCost: 20,
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
        packagingCost: 20,
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

  // Comprehensive Hash and Path routing for Public Storefronts, Shareable Product Landings, and Central Marketplaces
  const parseAppRoute = (): {
    type: 'app' | 'market' | 'store' | 'product' | 'suppliers_market' | 'supplier_store';
    slug?: string;
    productId?: string;
  } => {
    if (typeof window === 'undefined') return { type: 'app' };
    const pathname = window.location.pathname || '';
    const hash = window.location.hash || '';

    // 0a. Standalone Shareable Product Landing Page (/product/:id, /p/:id, #/product/:id)
    const prodPathMatch = pathname.match(/^\/(?:product|p)\/([^/?#]+)/i);
    if (prodPathMatch) {
      try {
        return { type: 'product', productId: decodeURIComponent(prodPathMatch[1]) };
      } catch {
        return { type: 'product', productId: prodPathMatch[1] };
      }
    }
    const prodHashMatch = hash.match(/^#\/?(?:product|p)\/([^/?#]+)/i);
    if (prodHashMatch) {
      try {
        return { type: 'product', productId: decodeURIComponent(prodHashMatch[1]) };
      } catch {
        return { type: 'product', productId: prodHashMatch[1] };
      }
    }

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

    // 4. Query Params Support (?product=..., ?market=1, ?tab=market, ?store=..., ?supplier=...)
    const search = window.location.search || '';
    if (search) {
      try {
        const params = new URLSearchParams(search);
        const productParam = params.get('product');
        if (productParam) {
          try {
            return { type: 'product', productId: decodeURIComponent(productParam) };
          } catch {
            return { type: 'product', productId: productParam };
          }
        }
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
        const resolved = resolveViewFromPath(
          window.location.pathname || '/',
          window.location.search || '',
          window.location.hash || ''
        );
        if (resolved && VIEW_TITLES[resolved as ActiveView]) {
          setActiveView(resolved as ActiveView);
        } else {
          setActiveView('home');
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

  // Render Standalone Shareable Product Landing Page (/product/:id or /p/:id)
  if (activeRoute.type === 'product' && activeRoute.productId) {
    return (
      <Suspense fallback={<AppScreenFallback />}>
        <PublicProductLandingView
          productId={activeRoute.productId}
          onOpenStore={(slug) => {
            try {
              window.history.pushState({}, '', `/store/${encodeURIComponent(slug)}`);
            } catch {}
            setActiveRoute({ type: 'store', slug });
          }}
          onOpenMarketplace={() => {
            try {
              window.history.pushState({}, '', '/market');
            } catch {}
            setActiveRoute({ type: 'market' });
          }}
          onGoHome={() => {
            try {
              window.history.pushState({}, '', '/');
            } catch {}
            setActiveRoute({ type: 'app' });
            setActiveView('home');
          }}
        />
      </Suspense>
    );
  }

  // Render Suppliers Market if requested via direct link or hash
  if (activeRoute.type === 'suppliers_market') {
    return (
      <Suspense fallback={<AppScreenFallback />}>
        <SuppliersMarketView
          profile={profile}
          onNavigateBack={() => {
            if (window.location.hash) window.location.hash = '';
            if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
            setActiveRoute({ type: 'app' });
          }}
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
      </Suspense>
    );
  }

  // Render Public Supplier Storefront if requested via /supplier/:slug or #/supplier/:slug
  if (activeRoute.type === 'supplier_store' && activeRoute.slug) {
    return (
      <Suspense fallback={<AppScreenFallback />}>
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
      </Suspense>
    );
  }

  // Render Central Marketplace if requested via direct link or hash
  if (activeRoute.type === 'market') {
    return (
      <Suspense fallback={<AppScreenFallback />}>
        <MarketplaceView
          profile={profile}
          onNavigateHome={() => {
            if (window.location.hash) window.location.hash = '';
            if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
            setActiveRoute({ type: 'app' });
          }}
          onOpenStoreModal={() => {
            setArtisanStoreInitialTab('products');
            setActiveView('my_store');
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
      </Suspense>
    );
  }

  // Render Public Artisan Store if requested via direct link or hash
  if (activeRoute.type === 'store' && activeRoute.slug) {
    return (
      <Suspense fallback={<AppScreenFallback />}>
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
      </Suspense>
    );
  }

  // Kiosk Locked Device Mode takes top priority when a branch terminal is pinned to this browser
  if (lockedTerminal) {
    return (
      <Suspense fallback={<AppScreenFallback />}>
        <LockedTerminalShell
          config={lockedTerminal}
          onUnlocked={() => {
            setLockedTerminal(null);
            setActiveView('home');
          }}
        />
      </Suspense>
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
      <Suspense fallback={<AppScreenFallback />}>
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
      </Suspense>
    );
  }

  // First-time Google OAuth user needs to complete their workshop or supplier profile once
  if (!profile && pendingGoogleSessionUser) {
    return (
      <Suspense fallback={<AppScreenFallback />}>
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
      </Suspense>
    );
  }

  // If unauthenticated and no valid profile, show Landing Page by default or Auth Gateway if user requested login/register
  if (!profile) {
    if (showAuthGateway || suspensionNotice) {
      return (
        <Suspense fallback={<AppScreenFallback />}>
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
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<AppScreenFallback />}>
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
          onOpenMarketplace={() => {
            window.location.hash = '#/market';
            setActiveRoute({ type: 'market' });
          }}
          onOpenSuppliersMarket={() => {
            window.location.hash = '#/suppliers-market';
            setActiveRoute({ type: 'suppliers_market' });
          }}
          onOpenStore={(slug) => {
            window.location.hash = `#/store/${encodeURIComponent(slug)}`;
            setActiveRoute({ type: 'store', slug });
          }}
          onOpenSupplierStore={(slug) => {
            window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
            setActiveRoute({ type: 'supplier_store', slug });
          }}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
        />
      </Suspense>
    );
  }

  // Gatekeeper: If workshop is suspended or banned and user is NOT a Super Admin, block access
  const isSuspendedOrBanned =
    profile &&
    !isUserAdmin(profile) &&
    (profile.status === 'suspended' || profile.status === 'banned' || profile.isFrozen);

  if (isSuspendedOrBanned) {
    return (
      <Suspense fallback={<AppScreenFallback />}>
        <AccessGate
          workshop={profile}
          onRefreshStatus={checkWorkshopStatus}
          onLogout={handleLogout}
        />
      </Suspense>
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
        onOpenLiveStoreStudio={() => navigateTo('my_store_studio')}
        onNavigateToFamily={() => {
          if (window.location.hash !== '#/family') {
            window.location.hash = '#/family';
          }
          navigateTo('family');
        }}
        onNavigateToExecutiveBrief={() =>
          navigateTo(profile?.accountRole === 'supplier' ? 'supplier_executive_brief' : 'executive_brief')
        }
        onOpenPersonalProfile={() => navigateTo('personal_profile')}
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
      {activeView !== 'home' && activeView !== 'my_store_studio' && (
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

          {/* Current Page Title (with Super Admin UI Studio per-page override) + Close button */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex flex-col items-end">
              <span className="text-[11px] sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate max-w-[160px] sm:max-w-[340px] md:max-w-none px-2.5 sm:px-3 py-1 rounded-xl bg-[#E9E2D4]/90 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                {uiLayoutConfig.pageOverrides?.[activeView]?.title || VIEW_TITLES[activeView]}
              </span>
              {!uiLayoutConfig.pageOverrides?.[activeView]?.hideSubtitle &&
                uiLayoutConfig.pageOverrides?.[activeView]?.subtitle && (
                  <span className="hidden md:block text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] truncate max-w-[360px] mt-0.5 px-1">
                    {uiLayoutConfig.pageOverrides[activeView].subtitle}
                  </span>
                )}
            </div>
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
            <Suspense fallback={<ViewFallback />}>
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
                onNavigateToExecutiveBrief={() => navigateTo('supplier_executive_brief')}
                onNavigateToFamily={() => navigateTo('family')}
                onNavigateToPersonalProfile={() => navigateTo('personal_profile')}
                onNavigateToSuppliersMarket={() => navigateTo('suppliers_market')}
                onNavigateToUnifiedMaterials={handleNavigateToUnifiedMaterials}
                onPreviewPublicStore={(slug) => {
                  window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
                  setActiveRoute({ type: 'supplier_store', slug });
                }}
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
              onNavigateToUnifiedMaterials={handleNavigateToUnifiedMaterials}
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
              onNavigateToExecutiveBrief={() => navigateTo('executive_brief')}
              onNavigateToFixedAssets={() => navigateTo('fixed_assets')}
              onOpenExchangeRatesModal={() => setIsExchangeRatesOpen(true)}
              onOpenInventoryModal={(tab?: string) => {
                if (tab === 'products') {
                  navigateTo('finished_products');
                } else if (tab === 'audit') {
                  navigateTo('inventory_audit');
                } else {
                  navigateTo('inventory_materials');
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
            key={calculatorInitialRecord?.id ? `calc_${calculatorInitialRecord.id}` : 'calc_fresh'}
            profile={profile}
            initialRecord={calculatorInitialRecord}
            onOpenWhatsAppShare={handleOpenWhatsAppShare}
            onOpenNewMaterialModal={() => setIsNewMaterialOpen(true)}
            onOpenManageCrafts={() => setIsCraftsSelectorOpen(true)}
            onAddCraftToProfile={(craftId: string) => {
              const cur = Array.isArray(profile.selectedCrafts) ? profile.selectedCrafts : ['macrame'];
              if (cur.includes(craftId)) return;
              const nextCrafts = [...cur, craftId];
              const updated = { ...profile, selectedCrafts: nextCrafts };
              setProfile(updated);
              try {
                localStorage.setItem('alshams_profile', JSON.stringify(updated));
              } catch {}
              tenantStorage.saveProfile(updated).catch(() => {});
              const workshopId = profile.id || profile.workshopId || profile.tenantId || '';
              if (workshopId) {
                updateWorkshopProfileInSupabase(workshopId, {
                  selectedCrafts: nextCrafts,
                }).catch(() => {});
              }
            }}
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
            initialTab="catalog"
            onSelectRecordToLoad={handleSelectRecordToLoad}
            onOpenWhatsAppShare={handleOpenWhatsAppShare}
            onOpenMyStore={() => handleOpenArtisanStore('products')}
            onOpenMarketplace={() => {
              window.location.hash = '#/market';
              setActiveRoute({ type: 'market' });
            }}
          />
        )}

        {activeView === 'my_store' && (
          <ArtisanStorefrontModal
            isOpen={true}
            displayMode="page_store"
            onClose={navigateBack}
            profile={profile}
            initialTab={artisanStoreInitialTab === 'orders' ? 'products' : artisanStoreInitialTab}
            onOpenOrdersPage={() => navigateTo('my_orders')}
            onOpenCalculatorForRecord={(rec: any) => {
              setCalculatorInitialRecord(rec);
              navigateTo('calculator');
            }}
            onOpenPersonalProfile={() => navigateTo('personal_profile')}
          />
        )}

        {activeView === 'my_store_studio' && (
          <LiveStorefrontStudioPage
            profile={profile}
            onClose={goHome}
            onOpenStoreSettings={() => handleOpenArtisanStore('products')}
            onOpenAddProduct={() =>
              navigateTo(
                (profile as any)?.accountRole === 'supplier' ? 'supplier_catalog' : 'catalog'
              )
            }
            onNavigateToMarket={() => navigateTo('marketplace')}
            onNavigateToSuppliersMarket={() => navigateTo('suppliers_market')}
          />
        )}

        {activeView === 'my_orders' && (
          <ArtisanStorefrontModal
            isOpen={true}
            displayMode="page_orders"
            onClose={navigateBack}
            profile={profile}
            initialOrderId={selectedStoreOrderId}
            initialTab="orders"
            onOpenCalculatorForRecord={(rec: any) => {
              setCalculatorInitialRecord(rec);
              navigateTo('calculator');
            }}
            onOpenPersonalProfile={() => navigateTo('personal_profile')}
          />
        )}

        {activeView === 'materials' && (
          <MaterialsView
            workshop={profile}
            initialOpenAddModal={false}
            initialOpenUnifiedPicker={openUnifiedPickerOnEnter}
            onResetOpenUnifiedPicker={() => setOpenUnifiedPickerOnEnter(false)}
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
          ) : isSakrUnlockedBySubscription(
              userSubscription,
              (profile as any)?.accountRole === 'supplier' ? 'supplier' : 'artisan',
              false
            ) ? (
            <FalconAIAgent
              profile={profile}
              currentCategory={currentCategory}
              onApplyCategoryFromAI={handleApplyCategoryFromAI}
              onApplyEstimatedLaborWage={handleApplyEstimatedLaborWage}
              onTransferNotesToCalculator={handleTransferNotesToCalculator}
              onExportStructuredToCalculator={handleExportStructuredToCalculator}
              isFullscreen={true}
              onClose={goHome}
            />
          ) : (
            <div className="max-w-xl mx-auto my-8 p-6 rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-center space-y-4" dir="rtl">
              <div className="text-3xl">🦅</div>
              <h2 className="text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                المستشار الهندسي «صقر الشمساوية» غير مفعّل في باقاتك الحالية
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                يمكنك تفعيل باقة المساعدين الذكيين (أو أي باقة تشمل صقر) من صفحة «اشتراكاتي» بضغطة واحدة — مجاناً حالياً لفترة محدودة.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo('my_subscriptions')}
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black cursor-pointer"
                >
                  فتح صفحة اشتراكاتي 👑
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  className="px-4 py-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                >
                  الرئيسية
                </button>
              </div>
            </div>
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
            onOpenStoreModal={() => handleOpenArtisanStore('products')}
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

        {activeView === 'my_subscriptions' && (
          <MySubscriptionsPage
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
            onSaved={() => {
              setDismissedPackageOnboarding(true);
            }}
          />
        )}

        {activeView === 'executive_brief' && (
          <ArtisanExecutiveBriefView
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
            onNavigateToView={(v) => navigateTo(v as ActiveView)}
          />
        )}

        {activeView === 'supplier_executive_brief' && (
          <SupplierExecutiveBriefView
            profile={profile}
            onGoBack={navigateBack}
            onGoHome={goHome}
            onNavigateToView={(v) => navigateTo(v as ActiveView)}
          />
        )}

        {activeView === 'guide_start' && (
          <StartWorkshopGuidePage
            audience={profile.accountRole === 'supplier' ? 'supplier' : 'artisan'}
            onExecuteAction={(actionKey) => {
              switch (actionKey) {
                case 'nav_materials': navigateTo('materials'); break;
                case 'nav_unified_materials': handleNavigateToUnifiedMaterials(); break;
                case 'nav_calculator': navigateTo('calculator'); break;
                case 'nav_archive': navigateTo('archive'); break;
                case 'nav_suppliers': navigateTo('suppliers'); break;
                case 'nav_customers': navigateTo('customers'); break;
                case 'nav_treasuries': navigateTo('treasuries'); break;
                case 'open_artisan_store_products': handleOpenArtisanStore('products'); break;
                case 'sup_catalog': navigateTo('supplier_catalog'); break;
                case 'sup_unified_materials': handleNavigateToUnifiedMaterials(); break;
                case 'sup_storefront': setIsSupplierStoreModalOpen(true); break;
                case 'sup_customers': navigateTo('supplier_customers'); break;
                case 'sup_warehouse_erp': navigateTo('supplier_warehouse_erp'); break;
                case 'sup_finance': navigateTo('supplier_finance'); break;
                case 'sup_erp_hub': navigateTo('supplier_erp_hub'); break;
                default: break;
              }
            }}
          />
        )}

        {activeView === 'guide_daily' && (
          <DailyRoutineGuidePage
            audience={profile.accountRole === 'supplier' ? 'supplier' : 'artisan'}
            onExecuteAction={(actionKey) => {
              switch (actionKey) {
                case 'modal_supplier_invoice': setIsNewSupplierOpen(true); break;
                case 'nav_purchases': navigateTo('purchases'); break;
                case 'modal_admin_costs': setIsAdminExpensesOpen(true); break;
                case 'nav_work_orders': handleNavigateToWorkOrders(); break;
                case 'modal_inv_products': navigateTo('finished_products'); break;
                case 'nav_sales': navigateTo('sales'); break;
                case 'open_artisan_store_orders': handleOpenArtisanStore('orders'); break;
                case 'sup_pos': navigateTo('supplier_pos'); break;
                case 'sup_orders': navigateTo('supplier_orders'); break;
                case 'sup_warehouse_erp': navigateTo('supplier_warehouse_erp'); break;
                case 'sup_catalog': navigateTo('supplier_catalog'); break;
                case 'sup_finance': navigateTo('supplier_finance'); break;
                case 'sup_executive_brief': navigateTo('supplier_executive_brief'); break;
                default: break;
              }
            }}
          />
        )}

        {activeView === 'inventory_materials' && profile && (
          <MaterialsInventoryModal
            isOpen={true}
            asPage={true}
            onClose={goHome}
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

        {activeView === 'inventory_audit' && profile && (
          <InventoryLedgerModal
            isOpen={true}
            asPage={true}
            onClose={goHome}
            profile={profile}
            onOpenMaterialsView={() => navigateTo('materials')}
          />
        )}

        {activeView === 'finished_products' && profile && (
          <ProductsInventoryModal
            isOpen={true}
            asPage={true}
            onClose={goHome}
            profile={profile}
            onNavigateToCalculator={() => navigateTo('calculator')}
            onNavigateToWorkOrders={() => handleNavigateToWorkOrders()}
          />
        )}

        {activeView === 'supplier_catalog' && (
          <SupplierCatalogView
            profile={profile}
            initialOpenUnifiedPicker={openUnifiedPickerOnEnter}
            onResetOpenUnifiedPicker={() => setOpenUnifiedPickerOnEnter(false)}
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
            </Suspense>
          </motion.div>
        </AnimatePresence>

        {/* Persistent Orange Suppliers Market Footer Strip on Supplier Sub-pages */}
        {profile &&
          !isUserAdmin(profile) &&
          profile.accountRole === 'supplier' &&
          !switchedWorkshopContext &&
          activeView !== 'home' &&
          activeView !== 'suppliers_market' && (
            <footer className="max-w-7xl mx-auto mt-8 pt-2">
              <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
                  تنقل سريع لسوق موردين الشمساوية أو معاينة متجرك كما يظهر للجمهور:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const slug =
                        profile.storeSlug ||
                        profile.store_slug ||
                        profile.workshopId ||
                        profile.id ||
                        'supplier';
                      window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
                      setActiveRoute({ type: 'supplier_store', slug });
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <ExternalLink className="w-4 h-4 text-[#EA580C]" />
                    <span>عرض متجري للجمهور</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('suppliers_market')}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition shadow-sm"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>موردين الشمساوية</span>
                  </button>
                </div>
              </div>
            </footer>
          )}
      </main>

      {/* Unified Floating Shamousa Assistant — Strictly gated by Subscription (never appears in core_free) */}
      {profile &&
        activeView !== 'ai_agent' &&
        activeView !== 'family' &&
        activeView !== 'my_store_studio' &&
        (isUserAdmin(profile) ||
          (featureFlags.aiAssistantsEnabled &&
            isShamousaUnlockedBySubscription(
              userSubscription,
              (profile as any)?.accountRole === 'supplier' ? 'supplier' : 'artisan',
              false
            ))) && (
          <Suspense fallback={null}>
            <ShamousaChatWidget
              profile={profile}
              onOpenFalcon={() => navigateTo('ai_agent')}
              isAnyModalOpen={isAnyModalOpen}
              onNavigateView={(target) => {
                if (target === 'catalog') {
                  handleNavigateToCatalog('catalog');
                } else if (target === 'store') {
                  handleOpenArtisanStore('products');
                } else if (target === 'my_orders') {
                  handleOpenArtisanStore('orders');
                } else if (target === 'unified_materials') {
                  handleNavigateToUnifiedMaterials();
                } else if (target === 'marketplace') {
                  navigateTo('marketplace');
                } else if (target === 'suppliers_market') {
                  navigateTo('suppliers_market');
                } else if (target === 'customers') {
                  navigateTo('customers');
                } else if (target === 'calculator') {
                  navigateTo('calculator');
                } else if (target === 'my_subscriptions') {
                  navigateTo('my_subscriptions');
                } else {
                  navigateTo(target as any);
                }
              }}
            />
          </Suspense>
        )}

      <Suspense fallback={null}>
      {/* Sidebar Drawer Navigation */}
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
            } else if (v === 'unified_materials') {
              handleNavigateToUnifiedMaterials();
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

      {/* نافذة اختيار الباقات للأعضاء القدام عند أول دخول (عرض الإطلاق المجاني لفترة محدودة) */}
      {!dismissedPackageOnboarding &&
        shouldPromptExistingUserForPackages(profile, userSubscription) && (
          <PackageSelectionOnboardingModal
            profile={profile}
            isOpen={true}
            onComplete={() => setDismissedPackageOnboarding(true)}
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

      {/* Dedicated Products Inventory Modal */}
      {isProductsModalOpen && profile && (
        <ProductsInventoryModal
          isOpen={isProductsModalOpen}
          onClose={() => setIsProductsModalOpen(false)}
          profile={profile}
          onNavigateToCalculator={() => {
            setIsProductsModalOpen(false);
            navigateTo('calculator');
          }}
          onNavigateToWorkOrders={() => {
            setIsProductsModalOpen(false);
            handleNavigateToWorkOrders();
          }}
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
        <UnifiedNewMaterialModal
          isOpen={isNewMaterialOpen}
          onClose={() => setIsNewMaterialOpen(false)}
          workshopId={profile.workshopId || profile.tenantId || profile.id}
          actorName={profile.brandName || profile.artistName || 'ورشة'}
          currencySymbol={profile.currencySymbol || 'ج.م'}
          onCreated={() => {
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


      {/* Legacy fallback kept inactive: My Store & My Orders now open as full pages via activeView */}
      {isArtisanStoreModalOpen && (
        <ArtisanStorefrontModal
          isOpen={isArtisanStoreModalOpen}
          displayMode="page_store"
          onClose={() => {
            setIsArtisanStoreModalOpen(false);
            setSelectedStoreOrderId(undefined);
          }}
          profile={profile}
          initialOrderId={selectedStoreOrderId}
          initialTab={artisanStoreInitialTab}
          onOpenOrdersPage={() => {
            setIsArtisanStoreModalOpen(false);
            navigateTo('my_orders');
          }}
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
      )}

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
          onPreviewPublicStore={(slug) => {
            setIsSupplierStoreModalOpen(false);
            window.location.hash = `#/supplier/${encodeURIComponent(slug)}`;
            setActiveRoute({ type: 'supplier_store', slug });
          }}
        />
      )}

      {/* Permissions & Background Onboarding Modal */}
      {isPermissionsModalOpen && (
        <PermissionsOnboardingModal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          isInitialOnboarding={typeof window !== 'undefined' && !localStorage.getItem('alshams_permissions_prompted')}
          profile={profile}
        />
      )}
      </Suspense>

      {/* Offline / Online Status Banner */}
      <OfflineIndicator />
    </div>
  );
};

export default App;
