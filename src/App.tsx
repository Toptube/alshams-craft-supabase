import React, { useState, useEffect, useCallback } from 'react';
import {
  UserProfile,
  SavedProductRecord,
  CraftCategory,
  NotificationItem,
  isUserAdmin,
  AdminAnnouncement,
  WorkshopMessageReceipt,
} from './types';
import { supabase } from './lib/supabase';
import { getCurrentWorkshopFromSupabase } from './db/supabaseService';
import { flushProductSync } from './db/productsCloud';
import { tenantStorage } from './db/dexieDB';
import { playPostaNotificationSound } from './lib/sounds';

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
import { AuthGateway } from './components/auth/AuthGateway';

// Modals & Drawers
import { GlobalSearchModal, GlobalSearchDataCache } from './components/search/GlobalSearchModal';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { ProfileSettingsModal } from './components/profile/ProfileSettingsModal';
import { CraftsSelectorModal } from './components/onboarding/CraftsSelectorModal';
import { UserGuideModal } from './components/guide/UserGuideModal';
import { CloudMigrationModal } from './components/migration/CloudMigrationModal';
import { SupportModal } from './components/support/SupportModal';
import { InteractiveTourModal } from './components/tour/InteractiveTourModal';
import { ExchangeRatesModal } from './components/currency/ExchangeRatesModal';
import { InventoryLedgerModal } from './components/inventory/InventoryLedgerModal';
import { AdminExpensesModal } from './components/adminCosts/AdminExpensesModal';
import { WhatsAppQuoteDrawer } from './components/sharing/WhatsAppQuoteDrawer';

// Creation Modals
import {
  NewMaterialModal,
  NewClientModal,
  NewSupplierModal,
  NewEmployeeModal,
} from './components/modals/CreationModals';

// Shamousa Chat Widget
import { ShamousaChatWidget } from './components/ai/ShamousaChatWidget';

// Icons for the sub-page navigation bar
import { ArrowRight, Home, Sparkles, X } from 'lucide-react';

export type ActiveView =
  | 'home'
  | 'calculator'
  | 'archive'
  | 'catalog'
  | 'materials'
  | 'suppliers'
  | 'customers'
  | 'sales'
  | 'invoices'
  | 'work_orders'
  | 'treasuries'
  | 'fixed_assets'
  | 'hr'
  | 'reports'
  | 'ai_agent'
  | 'admin';

const VIEW_TITLES: Record<ActiveView, string> = {
  home: 'لوحة تحكم الورشة',
  calculator: 'حاسبة تكاليف الإنتاج والتسعير',
  archive: 'أرشيف المنتجات والمشغولات',
  catalog: 'كتالوج الورشة والمنتجات',
  materials: 'المخزن وإدارة الخامات',
  suppliers: 'سجل الموردين',
  customers: 'سجل العملاء',
  sales: 'طلبيات ومبيعات الورشة',
  invoices: 'الفواتير وعروض الأسعار',
  work_orders: 'أوامر الشغل والتصنيع',
  treasuries: 'الخزينة والأرصدة والعهد',
  fixed_assets: 'إدارة الأصول الثابتة',
  hr: 'شؤون العاملين والحرفيين',
  reports: 'التقارير المالية والتحليلية',
  ai_agent: 'صقر الشمساوية AI — خبير الحرف اليدوية',
  admin: 'لوحة الإدارة العامة',
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
  const [isAdminExpensesOpen, setIsAdminExpensesOpen] = useState<boolean>(false);

  // Quick creation modals
  const [isNewMaterialOpen, setIsNewMaterialOpen] = useState<boolean>(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState<boolean>(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState<boolean>(false);
  const [isNewEmployeeOpen, setIsNewEmployeeOpen] = useState<boolean>(false);

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

  // Dark Mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('alshams_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('alshams_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('alshams_theme', 'light');
    }
  }, [isDarkMode]);

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

  // Check Supabase session on boot and keep persistent login
  useEffect(() => {
    let mounted = true;
    let isChecking = false;

    async function checkSession() {
      if (isChecking) return;
      isChecking = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          // Fetch the real workshop profile from Supabase
          const { workshop } = await getCurrentWorkshopFromSupabase();
          if (workshop && mounted) {
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

  // Listen to custom navigation events from Shamousa or other components
  useEffect(() => {
    const handleOpenView = (e: Event) => {
      const customEvent = e as CustomEvent<{ view?: string }>;
      const view = customEvent.detail?.view as ActiveView | undefined;
      if (view && VIEW_TITLES[view]) {
        navigateTo(view);
      }
    };

    window.addEventListener('alshams_open_view', handleOpenView);
    return () => window.removeEventListener('alshams_open_view', handleOpenView);
  }, [activeView]);

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

  const navigateBack = useCallback(() => {
    if (historyStack.length > 0) {
      const previous = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, -1));
      setActiveView(previous);
    } else {
      setActiveView('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [historyStack]);

  const goHome = useCallback(() => {
    if (activeView === 'home') return;
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
    navigateTo('calculator');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('alshams_profile');
    setProfile(null);
    setActiveView('home');
    setIsSidebarOpen(false);
  };

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

  // If unauthenticated and no valid profile, show Auth Gateway
  if (!profile) {
    return (
      <AuthGateway
        onAuthenticated={(p) => {
          setProfile(p);
          localStorage.setItem('alshams_profile', JSON.stringify(p));
        }}
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
      <main className="flex-1 pb-16">
        {activeView === 'home' && (
          <WorkshopHomeScreen
            profile={profile}
            onNavigateToCalculator={() => navigateTo('calculator')}
            onNavigateToArchive={() => navigateTo('archive')}
            onNavigateToCatalog={() => navigateTo('catalog')}
            onNavigateToAIAgent={() => navigateTo('ai_agent')}
            onNavigateToMaterials={() => navigateTo('materials')}
            onNavigateToSuppliers={() => navigateTo('suppliers')}
            onNavigateToSales={() => navigateTo('sales')}
            onNavigateToInvoices={() => navigateTo('invoices')}
            onNavigateToWorkOrders={() => navigateTo('work_orders')}
            onNavigateToTreasuries={() => navigateTo('treasuries')}
            onNavigateToHR={() => navigateTo('hr')}
            onNavigateToReports={() => navigateTo('reports')}
            onNavigateToFixedAssets={() => navigateTo('fixed_assets')}
            onOpenExchangeRatesModal={() => setIsExchangeRatesOpen(true)}
            onOpenInventoryModal={() => setIsInventoryLedgerOpen(true)}
            onOpenAdminCostsModal={() => setIsAdminExpensesOpen(true)}
            onOpenNewMaterialModal={() => setIsNewMaterialOpen(true)}
            onOpenNewClientModal={() => setIsNewClientOpen(true)}
            onOpenNewSupplierModal={() => setIsNewSupplierOpen(true)}
            onOpenCreateSupplier={() => setIsNewSupplierOpen(true)}
            onOpenSupplierInvoice={() => setIsNewSupplierOpen(true)}
            onOpenNewEmployeeModal={() => setIsNewEmployeeOpen(true)}
          />
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
          />
        )}

        {activeView === 'catalog' && (
          <WorkshopCatalog
            profile={profile}
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

        {activeView === 'work_orders' && (
          <WorkOrdersView
            workshop={profile}
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
          <FalconAIAgent
            profile={profile}
            currentCategory={currentCategory}
            onApplyCategoryFromAI={handleApplyCategoryFromAI}
            onApplyEstimatedLaborWage={handleApplyEstimatedLaborWage}
            onTransferNotesToCalculator={handleTransferNotesToCalculator}
            onExportStructuredToCalculator={handleExportStructuredToCalculator}
          />
        )}

        {activeView === 'admin' && (
          <AdminDashboard
            profile={profile}
            onNavigateHome={goHome}
            onProfileUpdated={(updated) => {
              setProfile(updated);
              localStorage.setItem('alshams_profile', JSON.stringify(updated));
            }}
            onSelectActiveWorkshop={(workshop) => {
              if (!originalSuperAdminProfile && profile) {
                setOriginalSuperAdminProfile(profile);
              }
              setSwitchedWorkshopContext(workshop);
              const merged: UserProfile = {
                ...workshop,
                role: 'superadmin',
                email: profile?.email || workshop.email,
              };
              setProfile(merged);
              localStorage.setItem('alshams_profile', JSON.stringify(merged));
              setActiveView('home');
            }}
          />
        )}
      </main>

      {/* Floating Shamousa Chat Assistant (Workshop Data Only) with Falcon Handoff */}
      <ShamousaChatWidget
        profile={profile}
        onOpenFalcon={() => navigateTo('ai_agent')}
      />

      {/* Sidebar Drawer Navigation */}
      {isSidebarOpen && (
        <SidebarDrawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          profile={profile}
          activeView={activeView}
          onSelectView={(v) => {
            navigateTo(v as ActiveView);
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
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
          isDarkMode={isDarkMode}
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

      {/* Notifications Drawer */}
      {isNotificationsOpen && (
        <NotificationDrawer
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          profile={profile}
          onRefreshNotifications={loadSearchCacheAndNotifications}
          onNavigateToOrder={() => navigateTo('sales')}
          onNavigateToInventory={() => navigateTo('materials')}
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

      {/* Messages Hub Modal (مركز المراسلات - بوسطة) */}
      {isMessagesHubOpen && profile && (
        <MessagesHubModal
          isOpen={isMessagesHubOpen}
          onClose={() => setIsMessagesHubOpen(false)}
          workshopId={profile.workshopId || profile.id}
          workshopName={profile.brandName || profile.artistName || 'ورشة الشمساوية'}
          onReceiptUpdate={loadAnnouncements}
        />
      )}
    </div>
  );
};

export default App;
