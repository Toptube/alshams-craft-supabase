import React, { useState, useEffect, useCallback } from 'react';
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
import { getCurrentWorkshopFromSupabase } from './db/supabaseService';
import { flushProductSync, startProductSync } from './db/productsCloud';
import { tenantStorage } from './db/dexieDB';
import { playPostaNotificationSound } from './lib/sounds';
import { startQuietBackgroundSync, hydrateWorkshopIntoDexie } from './services/periodicQuietSync';

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
import {
  registerServiceWorker,
  checkAndDispatchEquipmentMaintenanceAlerts,
} from './lib/pushNotifications';
import { PermissionsOnboardingModal } from './components/permissions/PermissionsOnboardingModal';
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
  | 'marketplace';

const VIEW_TITLES: Record<ActiveView, string> = {
  home: 'لوحة تحكم الورشة',
  calculator: 'حاسبة تكاليف الإنتاج والتسعير',
  archive: 'أرشيف المنتجات والمشغولات',
  catalog: 'كتالوج الورشة والمنتجات',
  materials: 'المخزن وإدارة الخامات',
  purchases: 'المشتريات وفواتير الخامات',
  suppliers: 'سجل الموردين',
  customers: 'سجل العملاء',
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

  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [suspensionNotice, setSuspensionNotice] = useState<string | null>(null);
  const [showAuthGateway, setShowAuthGateway] = useState<boolean>(false);
  const [authGatewayMode, setAuthGatewayMode] = useState<'login' | 'signup'>('login');

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

  // Navigation & View state
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [historyStack, setHistoryStack] = useState<ActiveView[]>([]);
  const [adminInitialTab, setAdminInitialTab] = useState<ExecutiveTab>('materials');
  const [catalogInitialTab, setCatalogInitialTab] = useState<'catalog' | 'store'>('catalog');
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

  // Dedicated Artisan Storefront & Central Marketplace state
  const [isArtisanStoreModalOpen, setIsArtisanStoreModalOpen] = useState<boolean>(false);
  const [selectedStoreOrderId, setSelectedStoreOrderId] = useState<string | undefined>(undefined);

  // Calculator interaction state
  const [calculatorInitialRecord, setCalculatorInitialRecord] = useState<SavedProductRecord | null>(null);
  const [calculatorExternalNotes, setCalculatorExternalNotes] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<CraftCategory>('جدارية');

  // WhatsApp Quote Sharing drawer state
  const [quoteRecord, setQuoteRecord] = useState<SavedProductRecord | null>(null);
  const [isQuoteDrawerOpen, setIsQuoteDrawerOpen] = useState<boolean>(false);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Messaging Hub (بوسطة) & Announcements state
  const [isMessagesHubOpen, setIsMessagesHubOpen] = useState<boolean>(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('alshams_permissions_prompted');
  });
  const [announcements, setAnnouncements] = useState<(AdminAnnouncement & { receipt?: WorkshopMessageReceipt })[]>([]);

  // Super Admin Multi-Tenant Workshop Switcher Context
  const [switchedWorkshopContext, setSwitchedWorkshopContext] = useState<any | null>(null);
  const [originalSuperAdminProfile, setOriginalSuperAdminProfile] = useState<UserProfile | null>(null);

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
  }, [themeMode]);

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
    window.addEventListener('alshams_new_order_received', handleNewOrder);
    window.addEventListener('online', handleOnlineReconnect);

    return () => {
      window.removeEventListener('alshams_notifications_updated', handleRefreshNotifications);
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

  // Check Supabase session on boot and keep persistent login
  useEffect(() => {
    let mounted = true;
    let isChecking = false;

    async function checkSession() {
      if (isChecking) return;
      isChecking = true;
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          try {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session) {
              session = refreshed.session;
            }
          } catch {}
        }

        if (session?.user && mounted) {
          // فحص حالة الحساب في profiles و workshops
          try {
            const [pCheck, wCheck] = await Promise.all([
              supabase.from('profiles').select('status').eq('id', session.user.id).maybeSingle(),
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
                setSuspensionNotice('تم تعليق حساب الورشة مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
                setAuthChecking(false);
              }
              return;
            }
          } catch {}

          // Fetch the real workshop profile strictly owned by current user from Supabase
          const { workshop } = await getCurrentWorkshopFromSupabase();
          if (workshop && mounted) {
            if (workshop.status === 'suspended' || (workshop as any).isFrozen) {
              await supabase.auth.signOut().catch(() => {});
              localStorage.removeItem('alshams_profile');
              setProfile(null);
              setSuspensionNotice('تم تعليق حساب الورشة مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
              setAuthChecking(false);
              return;
            }
            setProfile(workshop);
            localStorage.setItem('alshams_profile', JSON.stringify(workshop));
            flushProductSync(workshop.workshopId || workshop.id).catch(() => {});
          }
          // Note: If workshop query fails or is delayed, NEVER overwrite with demo profile!
          // The artist's profile saved in localStorage remains active and safe.
        } else if (!session && mounted) {
          // Only if no profile exists in localStorage do we show AuthGateway
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
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          setProfile(null);
          localStorage.removeItem('alshams_profile');
        }
        return;
      }
      if (session?.user && mounted) {
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
      const res = await fetch(`/api/announcements?workshopId=${encodeURIComponent(wid)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements);
      }
    } catch (err) {
      console.warn('[Announcements] Failed to fetch:', err);
    }
  }, [profile?.workshopId, profile?.id]);

  // Initial and periodic check on profile mount
  useEffect(() => {
    if (profile?.id) {
      checkWorkshopStatus();
      loadAnnouncements();
    }
  }, [profile?.id, profile?.workshopId, checkWorkshopStatus, loadAnnouncements]);

  // Realtime subscription for incoming announcements and status changes
  useEffect(() => {
    if (!profile) return;
    const wid = profile.workshopId || profile.id;
    if (!wid || wid === 'workshop_demo' || wid === '00000000-0000-0000-0000-000000000000') return;

    const announcementsChannel = supabase
      .channel('public:admin_announcements_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_announcements' },
        (payload) => {
          const newAnn = payload.new as any;
          if (newAnn.recipient_type === 'all' || newAnn.recipient_workshop_id === wid) {
            playPostaNotificationSound();
            loadAnnouncements();
          }
        }
      )
      .subscribe();

    const workshopChannel = supabase
      .channel(`public:workshops_live_${wid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workshops', filter: `id=eq.${wid}` },
        () => {
          checkWorkshopStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(announcementsChannel);
      supabase.removeChannel(workshopChannel);
    };
  }, [profile?.workshopId, profile?.id, loadAnnouncements, checkWorkshopStatus]);

  // Calculate unread announcements count
  const unreadMessagesCount = announcements.filter(
    (a) => !a.receipt || !a.receipt.read_at
  ).length;

  // Register Web Push Service Worker for real-time background workshop alerts & offline sync
  useEffect(() => {
    registerServiceWorker().catch(() => {});
    const cleanupSync = initOfflineSyncListeners();
    const tenant = profile?.tenantId || profile?.workshopId || profile?.id;
    if (tenant) {
      checkAndDispatchEquipmentMaintenanceAlerts(tenant).catch(() => {});
    }
    return () => {
      cleanupSync();
    };
  }, [profile?.tenantId, profile?.workshopId, profile?.id]);

  // Listen to open permissions modal event
  useEffect(() => {
    const handleOpenPermissions = () => {
      setIsPermissionsModalOpen(true);
    };
    window.addEventListener('alshams_open_permissions_modal', handleOpenPermissions);
    return () => window.removeEventListener('alshams_open_permissions_modal', handleOpenPermissions);
  }, []);

  // Listen to store opening events (with optional targeted order ID)
  useEffect(() => {
    const handleOpenStore = (e: Event) => {
      const customEvent = e as CustomEvent<{ orderId?: string }>;
      if (customEvent.detail?.orderId) {
        setSelectedStoreOrderId(customEvent.detail.orderId);
      }
      setIsArtisanStoreModalOpen(true);
    };

    window.addEventListener('alshams_open_store', handleOpenStore);
    return () => window.removeEventListener('alshams_open_store', handleOpenStore);
  }, []);

  // Listen to custom navigation events from Shamousa or other components
  useEffect(() => {
    const handleOpenView = (e: Event) => {
      const customEvent = e as CustomEvent<{ view?: string }>;
      const view = customEvent.detail?.view;
      if (view === 'marketplace') {
        navigateTo('marketplace');
        return;
      }
      if (view === 'store') {
        setIsArtisanStoreModalOpen(true);
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
  const navigateTo = useCallback(
    (view: ActiveView) => {
      if (view === activeView) return;
      setHistoryStack((prev) => [...prev, activeView]);
      setActiveView(view);
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
      window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
    } else {
      window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
      if (activeView !== 'home') {
        setActiveView('home');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [historyStack, activeView]);

  const goHome = useCallback(() => {
    window.dispatchEvent(new CustomEvent('alshams_reset_subview'));
    if (activeView === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setHistoryStack((prev) => [...prev, activeView]);
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView]);

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
    await supabase.auth.signOut();
    localStorage.removeItem('alshams_profile');
    setProfile(null);
    setActiveView('home');
    setIsSidebarOpen(false);
  };

  // Comprehensive Hash and Path routing for Public Storefronts and Central Marketplace
  const parseAppRoute = (): { type: 'app' | 'market' | 'store'; slug?: string } => {
    if (typeof window === 'undefined') return { type: 'app' };
    const pathname = window.location.pathname || '';
    const hash = window.location.hash || '';

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

    // 4. Query Params Support (?market=1, ?tab=market, ?store=...)
    const search = window.location.search || '';
    if (search) {
      try {
        const params = new URLSearchParams(search);
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
      setActiveRoute(parseAppRoute());
    };
    window.addEventListener('hashchange', handleRouteNav);
    window.addEventListener('popstate', handleRouteNav);
    return () => {
      window.removeEventListener('hashchange', handleRouteNav);
      window.removeEventListener('popstate', handleRouteNav);
    };
  }, []);

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
          setActiveView('catalog');
          setActiveRoute({ type: 'app' });
        }}
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
      />
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-stone-600 dark:text-stone-400">جاري تشغيل منظومة الشمساوية...</p>
        </div>
      </div>
    );
  }

  // If unauthenticated and no valid profile, show Landing Page by default or Auth Gateway if user requested login/register
  if (!profile) {
    if (showAuthGateway || suspensionNotice) {
      return (
        <AuthGateway
          initialMode={authGatewayMode}
          onBackToLanding={() => setShowAuthGateway(false)}
          recoveryError={suspensionNotice}
          onClearRecoveryError={() => setSuspensionNotice(null)}
          onAuthenticated={(p) => {
            setSuspensionNotice(null);
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
          setAuthGatewayMode('login');
          setShowAuthGateway(true);
        }}
        onOpenRegister={() => {
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
    isArtisanStoreModalOpen
  );

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans transition-colors duration-200" dir="rtl">
      {/* Top Navbar */}
      <Navbar
        profile={profile}
        hasActiveSession={true}
        unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
        unreadMessagesCount={unreadMessagesCount}
        onOpenMessagesHub={() => setIsMessagesHubOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        onOpenGlobalSearch={() => {
          loadSearchCacheAndNotifications();
          setIsSearchOpen(true);
        }}
        onGoHome={goHome}
        onOpenNotifications={() => {
          loadSearchCacheAndNotifications();
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
        onOpenArtisanStore={() => handleNavigateToCatalog('store')}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        themeMode={themeMode}
        onSelectThemeMode={setThemeMode}
      />

      {/* Super Admin Executive Context Mode Banner */}
      {switchedWorkshopContext && (
        <aside aria-label="شريط وضع الإشراف" className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white px-4 py-2 text-xs font-black flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-sm">👑</span>
            <span>
              أنت الآن في وضع الإشراف التنفيذي الشامل على ورشة: <strong className="text-amber-300">"{switchedWorkshopContext.brandName}"</strong> (الفنان: {switchedWorkshopContext.artistName})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer transition shadow-xs"
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
              className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-300 text-[11px] font-bold cursor-pointer transition"
            >
              إنهاء وضع الإشراف
            </button>
          </div>
        </aside>
      )}

      {/* Welcome Banner: يظهر فقط عند الفتح للترحيب بالفنان وورشته */}
      {showWelcomeBanner && profile && (
        <aside aria-label="رسالة الترحيب" className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-600/15 border-b border-amber-300 dark:border-amber-700/60 px-4 py-2.5 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
            <span>
              أهلاً بك يا <strong>{profile.artistName || 'فنان الشمساوية'}</strong> في ورشتك <strong>{profile.brandName || 'الشمساوية هاند ميد'}</strong> ✨ نسعد بوجودك معنا ونتمنى لك يوماً إنتاجياً موفقاً!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowWelcomeBanner(false)}
            className="p-1 rounded-lg hover:bg-amber-500/20 text-stone-500 dark:text-stone-300 transition cursor-pointer"
            title="إغلاق الترحيب"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* Global Sub-Page Bar: زر الرجوع للصفحة السابقة بجوار الخروج للصفحة الرئيسية */}
      {activeView !== 'home' && (
        <aside aria-label="شريط التنقل السريع" className="sticky top-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-amber-200 dark:border-stone-800 px-3 sm:px-6 py-2.5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* زر الرجوع للصفحة السابقة */}
            <button
              type="button"
              onClick={navigateBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              title="الرجوع للصفحة السابقة"
            >
              <ArrowRight className="w-4 h-4 text-amber-700 dark:text-amber-300" />
              <span>رجوع</span>
            </button>

            {/* زر الخروج للصفحة الرئيسية */}
            <button
              type="button"
              onClick={goHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              title="الخروج للصفحة الرئيسية"
            >
              <Home className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>
          </div>

          {/* Current Page Title */}
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold text-stone-800 dark:text-stone-100 truncate max-w-[200px] sm:max-w-none">
              {VIEW_TITLES[activeView]}
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
        </aside>
      )}

      {/* Main Content View Switcher */}
      <main className="flex-1 pb-16 overflow-x-hidden">
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
              onNavigateHome={goHome}
              onOpenMessagesHub={() => setIsMessagesHubOpen(true)}
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
          ) : (
            <WorkshopHomeScreen
              profile={profile}
              onNavigateToCalculator={() => navigateTo('calculator')}
              onNavigateToArchive={() => navigateTo('archive')}
              onNavigateToCatalog={handleNavigateToCatalog}
              onNavigateToAIAgent={() => navigateTo('ai_agent')}
              onNavigateToMaterials={() => navigateTo('materials')}
              onNavigateToSuppliers={() => navigateTo('suppliers')}
              onNavigateToSales={() => navigateTo('sales')}
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
            onNavigateHome={goHome}
            onOpenMessagesHub={() => setIsMessagesHubOpen(true)}
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Shamousa Chat Assistant: Active across workshops, strictly auto-hidden inside Falcon AI chat screen */}
      {profile && activeView !== 'ai_agent' && (
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
          onOpenArtisanStore={() => handleNavigateToCatalog('store')}
          onSelectView={(v) => {
            if (v === 'appeals') {
              setAdminInitialTab('appeals');
              navigateTo('appeals');
            } else if (v === 'messaging') {
              setAdminInitialTab('messaging');
              navigateTo('messaging');
            } else if (v === 'materials' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('materials');
              navigateTo('admin');
            } else if (v === 'catalog' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('products');
              navigateTo('admin');
            } else if (v === 'hr' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('contacts');
              navigateTo('admin');
            } else if (v === 'treasuries' && isUserAdmin(profile) && !switchedWorkshopContext) {
              setAdminInitialTab('treasuries');
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
              handleNavigateToCatalog('store');
            } else if (v === 'catalog') {
              handleNavigateToCatalog('catalog');
            } else {
              navigateTo(v as ActiveView);
            }
            setIsSidebarOpen(false);
          }}
          unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
          unreadMessagesCount={unreadMessagesCount}
          onOpenNotifications={() => {
            loadSearchCacheAndNotifications();
            setIsNotificationsOpen(true);
          }}
          onOpenMessagesHub={() => setIsMessagesHubOpen(true)}
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
          initialTab={isMessagesHubOpen ? 'messages' : 'notifications'}
          notifications={notifications}
          profile={profile}
          unreadMessagesCount={unreadMessagesCount}
          onRefreshNotifications={loadSearchCacheAndNotifications}
          onNavigateToOrder={() => navigateTo('sales')}
          onNavigateToInventory={() => navigateTo('materials')}
          onReceiptUpdate={loadAnnouncements}
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
          onSuccess={() => {}}
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
        onOpenCalculatorForRecord={(rec: any) => {
          setCalculatorInitialRecord(rec);
          navigateTo('calculator');
          setIsArtisanStoreModalOpen(false);
        }}
      />

      {/* Permissions & Background Onboarding Modal */}
      <PermissionsOnboardingModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        isInitialOnboarding={typeof window !== 'undefined' && !localStorage.getItem('alshams_permissions_prompted')}
      />
    </div>
  );
};

export default App;
