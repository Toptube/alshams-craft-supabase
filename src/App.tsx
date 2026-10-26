import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, SavedProductRecord, CraftCategory, NotificationItem } from './types';
import { AuthGateway } from './components/auth/AuthGateway';
import { Navbar } from './components/layout/Navbar';
import { SidebarDrawer } from './components/layout/SidebarDrawer';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { CreateCenterDashboard } from './components/createCenter/CreateCenterDashboard';
import { ProductionCalculator } from './components/calculator/ProductionCalculator';
import { FalconAIAgent } from './components/ai/FalconAIAgent';
import { CraftsSelectorModal } from './components/onboarding/CraftsSelectorModal';
import { GlobalSearchModal, GlobalSearchDataCache } from './components/search/GlobalSearchModal';
import { UserGuideModal } from './components/guide/UserGuideModal';
import { CloudMigrationModal } from './components/migration/CloudMigrationModal';
import { ProfileSettingsModal } from './components/profile/ProfileSettingsModal';
import { FamilyWelcomeModal } from './components/welcome/FamilyWelcomeModal';
import { WhatsAppQuoteDrawer } from './components/sharing/WhatsAppQuoteDrawer';
import { WorkshopHomeScreen } from './components/home/WorkshopHomeScreen';
import { SupportModal } from './components/support/SupportModal';
import { InteractiveTourModal } from './components/tour/InteractiveTourModal';
import { checkAndTriggerProactiveBrowserNotifications } from './lib/browserNotifications';
import { tenantStorage } from './db/dexieDB';
import { useAuthSession } from './lib/useAuthSession';
import { supabase } from './lib/supabase';
import {
  getCurrentWorkshopFromSupabase,
  updateWorkshopProfileInSupabase,
  mapWorkshopRowToUserProfile,
  getArabicSupabaseError,
} from './db/supabaseService';
import { CompleteWorkshopScreen } from './components/auth/CompleteWorkshopScreen';
import { SuspendedWorkshopScreen } from './components/auth/SuspendedWorkshopScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { UnderMigrationNotice } from './components/common/UnderMigrationNotice';
import { MaterialsView } from './components/materials/MaterialsView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { CustomersView } from './components/customers/CustomersView';
import { TreasuriesView } from './components/treasuries/TreasuriesView';
import { InvoicesView } from './components/invoices/InvoicesView';
import { FixedAssetsView } from './components/assets/FixedAssetsView';
import { ExchangeRatesModal } from './components/currency/ExchangeRatesModal';
import { SaaSReportsAnalyticsView } from './components/reports/SaaSReportsAnalyticsView';
import { NewClientModal, NewSupplierModal } from './components/modals/CreationModals';
import { playPageFlipSound } from './lib/sounds';
import { useTranslation, getStoredLanguage, SUPPORTED_LANGUAGES } from './lib/i18n';
import {
  PlusCircle,
  Calculator,
  ShoppingCart,
  Users2,
  Sparkles,
  FolderArchive,
  BarChart3,
  Boxes,
  Building,
  Wallet,
  Hammer,
  Truck,
  FileText,
  BookOpen,
  ArrowRight,
  Home,
  ShieldCheck,
  Snowflake,
  RotateCcw,
  LogOut,
  AlertCircle,
  Coins,
} from 'lucide-react';

// In-memory cache for session (built once per session, max 500 items per collection to protect Firestore free tier)
let sessionSearchCache: GlobalSearchDataCache | null = null;
let sessionSearchCacheTenantId = '';

export type AppActiveView =
  | 'home'
  | 'create_center'
  | 'calculator'
  | 'sales'
  | 'invoices'
  | 'work_orders'
  | 'suppliers'
  | 'customers'
  | 'materials'
  | 'treasuries'
  | 'fixed_assets'
  | 'hr'
  | 'ai_agent'
  | 'archive'
  | 'catalog'
  | 'reports'
  | 'admin';

export default function App() {
  const { t: tr } = useTranslation();
  // Authentication State from unified single-source hook
  const {
    session: authSession,
    userId,
    isAuthChecked: authChecked,
    isRecoveryMode,
    setIsRecoveryMode,
    recoveryError,
    clearRecoveryError,
  } = useAuthSession();
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isWorkshopLoading, setIsWorkshopLoading] = useState(false);
  const [workshopLoadError, setWorkshopLoadError] = useState<{ message: string; code?: string } | null>(null);
  const [needsWorkshopDetailsEmail, setNeedsWorkshopDetailsEmail] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Guards for workshop loading: single-flight lock and loadedForUserId check
  const loadedForUserIdRef = React.useRef<string | null>(null);
  const isFlightInProgressRef = React.useRef<boolean>(false);

  // App Theme State (Dark / Light / System)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('alshams_theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  // Active View State:
  const [activeView, setActiveView] = useState<AppActiveView>('home');

  // Mobile Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Support & Complaints Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // Modals for Crafts, Search, Guide, Cloud Migration
  const [isCraftsSelectorOpen, setIsCraftsSelectorOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [userGuideSection, setUserGuideSection] = useState<string | undefined>(undefined);
  const [isCloudMigrationOpen, setIsCloudMigrationOpen] = useState(false);

  const [searchCache, setSearchCache] = useState<GlobalSearchDataCache>({
    customers: [],
    suppliers: [],
    products: [],
    materials: [],
    invoices: [],
    workOrders: [],
    employees: [],
  });

  // Creation Modals States (from Create Center & shortcuts)
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [supplierModalMode, setSupplierModalMode] = useState<'create_supplier' | 'record_invoice' | 'statement'>('create_supplier');
  const [supplierModalLocked, setSupplierModalLocked] = useState(false);
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState(false);

  // Other Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isAdminCostsModalOpen, setIsAdminCostsModalOpen] = useState(false);
  const [isExchangeRatesModalOpen, setIsExchangeRatesModalOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeType, setWelcomeType] = useState<'first_time' | 'session_return'>('session_return');
  const [isInteractiveTourOpen, setIsInteractiveTourOpen] = useState(false);

  // WhatsApp Quote Drawer State
  const [quoteRecord, setQuoteRecord] = useState<SavedProductRecord | null>(null);
  const [isQuoteDrawerOpen, setIsQuoteDrawerOpen] = useState(false);

  // Notifications State & Interactive Drawer
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // Reloaded Record from Archive into Calculator for Overwrite Mutation
  const [reloadedRecord, setReloadedRecord] = useState<SavedProductRecord | null>(null);

  // Notes transferred from AI to Calculator
  const [notesToTransfer, setNotesToTransfer] = useState<string | null>(null);

  // Open Add Material in MaterialsView
  const [openAddMaterialInView, setOpenAddMaterialInView] = useState(false);

  // Notification loader
  const loadNotifications = useCallback(async () => {
    if (!currentProfile) return;
    try {
      const tid = currentProfile.tenantId || currentProfile.workshopId || currentProfile.id || '';
      await tenantStorage.generateProactiveNotifications(tid, currentProfile);
      const notifs = await tenantStorage.getNotifications(tid);
      setNotifications(notifs);

      // Trigger browser notifications for stock depletion and work orders due
      checkAndTriggerProactiveBrowserNotifications(tid, currentProfile);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [currentProfile]);

  const loadSearchCache = useCallback(
    async (forceRefresh = false) => {
      if (!currentProfile) return;
      const tenantId =
        currentProfile.tenantId || currentProfile.workshopId || currentProfile.id || '';

      // 4) للحفاظ على الاستهلاك المجاني: استخدام الفهرس المحفوظ بالذاكرة مرة واحدة لكل جلسة ما لم يُطلب التحديث
      if (!forceRefresh && sessionSearchCache && sessionSearchCacheTenantId === tenantId) {
        setSearchCache(sessionSearchCache);
        return;
      }

      try {
        const [
          customers,
          suppliers,
          products,
          materials,
          invoices,
          supplierInvoices,
          employees,
          safeTransactions,
          expenses,
        ] = await Promise.all([
          tenantStorage.getCustomers(tenantId).catch(() => []),
          tenantStorage.getSuppliers(tenantId).catch(() => []),
          tenantStorage.getProducts(tenantId).catch(() => []),
          tenantStorage.getRawMaterials(tenantId).catch(() => []),
          tenantStorage.getOrders(tenantId).catch(() => []),
          tenantStorage.getSupplierInvoices(tenantId).catch(() => []),
          tenantStorage.getEmployees(tenantId).catch(() => []),
          tenantStorage.getSafeTransactions(tenantId).catch(() => []),
          tenantStorage.getAdminCosts(tenantId).catch(() => []),
        ]);

        const newCache: GlobalSearchDataCache = {
          customers: customers.slice(0, 500),
          suppliers: suppliers.slice(0, 500),
          products: products.slice(0, 500),
          materials: materials.slice(0, 500),
          invoices: (invoices as any).slice(0, 500),
          supplierInvoices: (supplierInvoices as any).slice(0, 500),
          workOrders: (invoices as any).slice(0, 500),
          employees: employees.slice(0, 500),
          treasuries: (safeTransactions as any).slice(0, 500),
          expenses: expenses.slice(0, 500),
        };

        sessionSearchCache = newCache;
        sessionSearchCacheTenantId = tenantId;
        setSearchCache(newCache);
      } catch (err) {
        console.error('Error loading search cache:', err);
      }
    },
    [currentProfile]
  );

  // تشغيل صوت تقليب الصفحة عند التنقل بين الأقسام (لا يُشغل في التحميل الأولي قبل أي تفاعل)
  const isFirstMountNav = React.useRef(true);
  useEffect(() => {
    if (isFirstMountNav.current) {
      isFirstMountNav.current = false;
      return;
    }
    playPageFlipSound();
  }, [activeView]);

  useEffect(() => {
    if (currentProfile) {
      loadNotifications();
      // بناء فهرس البحث للجلسة في الخلفية
      loadSearchCache();
      const interval = setInterval(loadNotifications, 60000);

      const handleRealtimeNotif = () => {
        loadNotifications();
        loadSearchCache(true);
      };
      window.addEventListener('alshams_notifications_changed', handleRealtimeNotif);

      return () => {
        clearInterval(interval);
        window.removeEventListener('alshams_notifications_changed', handleRealtimeNotif);
      };
    }
  }, [currentProfile, loadNotifications, loadSearchCache]);

  // Apply dark mode class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('alshams_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('alshams_theme', 'light');
    }
  }, [isDarkMode]);

  const { lang: appLang, dir: appDir } = useTranslation();

  // Sync language direction (RTL / LTR) and language tag
  useEffect(() => {
    document.documentElement.dir = appDir;
    document.documentElement.lang = appLang;
  }, [appLang, appDir]);

  const triggerWelcomeFlow = useCallback((profile: UserProfile) => {
    if (profile.welcomeShown !== true) {
      setWelcomeType('first_time');
      setIsWelcomeModalOpen(true);
      try {
        sessionStorage.setItem('alshams_welcome_shown_session', 'true');
      } catch (e) {}
    } else {
      let sessionWelcomed = false;
      try {
        sessionWelcomed = sessionStorage.getItem('alshams_welcome_shown_session') === 'true';
      } catch (e) {}
      if (!sessionWelcomed) {
        setWelcomeType('session_return');
        setIsWelcomeModalOpen(true);
        try {
          sessionStorage.setItem('alshams_welcome_shown_session', 'true');
        } catch (e) {}
      }
    }
  }, []);

  const handleCloseWelcomeModal = async () => {
    setIsWelcomeModalOpen(false);
    const wasFirstTime = welcomeType === 'first_time';
    if (wasFirstTime && currentProfile && currentProfile.welcomeShown !== true) {
      const updated: UserProfile = { ...currentProfile, welcomeShown: true, updatedAt: Date.now() };
      setCurrentProfile(updated);
      try {
        const workshopId = currentProfile.id || currentProfile.workshopId || currentProfile.tenantId || '';
        await updateWorkshopProfileInSupabase(workshopId, { welcomeShown: true });
      } catch (err) {
        console.error('Failed to save welcomeShown flag to Supabase:', err);
      }
    }
    // Launch interactive tour for new users or if not yet completed
    try {
      const tourDone = localStorage.getItem('alshams_tour_completed');
      if (wasFirstTime || tourDone !== 'true') {
        setTimeout(() => {
          setIsInteractiveTourOpen(true);
        }, 350);
      }
    } catch (e) {
      setIsInteractiveTourOpen(true);
    }
  };

  // Single useEffect for workshop loading: strictly depends on userId and user-triggered retryCount
  useEffect(() => {
    // Strict Requirement 3: لا تُحمَّل الورشة ولا تُعرض لوحة التحكم أثناء وضع استعادة كلمة المرور
    if (isRecoveryMode) {
      loadedForUserIdRef.current = null;
      setIsWorkshopLoading(false);
      return;
    }

    if (!userId) {
      loadedForUserIdRef.current = null;
      setCurrentProfile(null);
      setNeedsWorkshopDetailsEmail(null);
      setWorkshopLoadError(null);
      setIsWorkshopLoading(false);
      return;
    }

    // Do not reload if already loaded for this user and not retrying
    if (loadedForUserIdRef.current === userId && retryCount === 0) {
      return;
    }

    // Single-flight guard: prevent concurrent requests
    if (isFlightInProgressRef.current) {
      return;
    }

    let isMounted = true;
    isFlightInProgressRef.current = true;
    setIsWorkshopLoading(true);
    setWorkshopLoadError(null);

    const userEmail = authSession?.user?.email || '';
    console.log('[App] Step 2: Session active for user:', userId, `(${userEmail}). Starting loadWorkshop with 25s timeout... [retry: ${retryCount}]`);

    // 25 second timeout promise (Rule 3)
    let timeoutId: any = null;
    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error('انتهت مهلة التحميل (25 ثانية) أثناء جلب بيانات الورشة من الخادم. يرجى التحقق من اتصال الإنترنت.')
        );
      }, 25000);
    });

    // Directly query Supabase without calling getSession() (Rule 3 & 4)
    const queryPromise = supabase
      .from('workshops')
      .select('*')
      .limit(1)
      .maybeSingle();

    Promise.race([queryPromise, timeoutPromise])
      .then((res: any) => {
        if (!isMounted) return;
        clearTimeout(timeoutId);

        if (res.error) {
          console.error('[App] Step 3 (Result): Error fetching workshop row:', res.error);
          const errRes = getArabicSupabaseError(res.error);
          setWorkshopLoadError({
            message: errRes.arabicMessage,
            code: errRes.code,
          });
          return;
        }

        const data = res.data;
        if (data) {
          console.log('[App] Step 3 (Result): Workshop loaded successfully:', data.brand_name || data.id);
          const profile = mapWorkshopRowToUserProfile(data, userEmail);
          loadedForUserIdRef.current = userId;
          setCurrentProfile(profile);
          setNeedsWorkshopDetailsEmail(null);
          setWorkshopLoadError(null);
          triggerWelcomeFlow(profile);
          if (!localStorage.getItem('alshams_crafts_selected')) {
            setIsCraftsSelectorOpen(true);
          }
        } else {
          console.log('[App] Step 3 (Result): User authenticated but no workshop row found. Prompting details setup.');
          setNeedsWorkshopDetailsEmail(userEmail);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        clearTimeout(timeoutId);
        console.error('[App] Step 3 (Result): Exception or timeout during loadWorkshop:', err);
        setWorkshopLoadError({
          message: err?.message || 'تعذر الاتصال بالخادم لتحميل بيانات الورشة.',
          code: err?.code || 'TIMEOUT_OR_NETWORK',
        });
      })
      .finally(() => {
        if (isMounted) {
          clearTimeout(timeoutId);
          setIsWorkshopLoading(false);
          isFlightInProgressRef.current = false;
          console.log('[App] loadWorkshop finished (loading state cleared).');
        }
      });

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      isFlightInProgressRef.current = false;
    };
  }, [userId, retryCount, isRecoveryMode, triggerWelcomeFlow]);
  const handleAuthenticated = (profile: UserProfile) => {
    console.log('[App] handleAuthenticated called for workshop:', profile.brandName);
    const uid = profile.ownerUid || userId;
    if (uid) loadedForUserIdRef.current = uid;
    setCurrentProfile(profile);
    setNeedsWorkshopDetailsEmail(null);
    setWorkshopLoadError(null);
    setIsWorkshopLoading(false);
    triggerWelcomeFlow(profile);
    if (!localStorage.getItem('alshams_crafts_selected')) {
      setIsCraftsSelectorOpen(true);
    }
  };

  const handleLogout = async () => {
    console.log('[App] handleLogout invoked. Signing out of Supabase...');
    loadedForUserIdRef.current = null;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    localStorage.removeItem('alshams_active_tenant_id');
    try {
      sessionStorage.removeItem('alshams_welcome_shown_session');
    } catch (e) {}
    setCurrentProfile(null);
    setNeedsWorkshopDetailsEmail(null);
    setWorkshopLoadError(null);
    setIsWorkshopLoading(false);
    setIsMobileMenuOpen(false);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Archive reload handler - loads card into calculator to mutate / overwrite
  const handleSelectRecordFromArchive = (record: SavedProductRecord) => {
    setReloadedRecord(record);
    setActiveView('calculator');
  };

  // WhatsApp Quote trigger
  const handleOpenWhatsAppShare = (record: SavedProductRecord) => {
    setQuoteRecord(record);
    setIsQuoteDrawerOpen(true);
  };

  // Falcon AI integration handlers
  const handleApplyCategoryFromAI = (category: CraftCategory) => {
    if (reloadedRecord) {
      setReloadedRecord({
        ...reloadedRecord,
        category,
        input: { ...reloadedRecord.input, category },
      });
    }
  };

  const handleApplyEstimatedLaborWage = (wage: number, hours: number) => {
    if (reloadedRecord) {
      setReloadedRecord({
        ...reloadedRecord,
        input: { ...reloadedRecord.input, laborWage: wage },
      });
    }
  };

  const handleTransferNotesToCalculator = (notes: string) => {
    setNotesToTransfer(notes);
    setActiveView('calculator');
  };

  // 1. Initial auth check screen
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 dark:bg-stone-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-stone-500">{tr('verifying_session') || 'جاري التحقق من جلسة الدخول...'}</p>
        </div>
      </div>
    );
  }

  // 1.5 Recovery Mode: Show ResetPasswordScreen before anything else (Requirement 3)
  if (isRecoveryMode) {
    return (
      <ResetPasswordScreen
        onSuccess={() => {
          setIsRecoveryMode(false);
        }}
      />
    );
  }

  // 2. Not authenticated (no session or access_token): show AuthGateway directly (Rule 4)
  if (!authSession?.access_token || !authSession?.user) {
    return (
      <AuthGateway
        onAuthenticated={handleAuthenticated}
        onNeedsWorkshopDetails={(em) => setNeedsWorkshopDetailsEmail(em)}
        recoveryError={recoveryError}
        onClearRecoveryError={clearRecoveryError}
      />
    );
  }

  // 3. Error Screen with "حاول مرة أخرى" and "تسجيل الخروج" (Rule 3)
  if (workshopLoadError) {
    return (
      <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900/60 p-6 sm:p-8 space-y-5 text-right relative overflow-hidden">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-md">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-rose-700 dark:text-rose-400">
              تعذر تحميل بيانات الورشة
            </h2>
            <p className="text-xs font-bold text-stone-600 dark:text-stone-300 leading-relaxed max-w-sm">
              {workshopLoadError.message}
            </p>
            {workshopLoadError.code && (
              <span className="inline-block px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] font-mono text-stone-500">
                رمز الخطأ: {workshopLoadError.code}
              </span>
            )}
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setWorkshopLoadError(null);
                setRetryCount((prev) => prev + 1);
              }}
              className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>حاول مرة أخرى</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-2xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{tr('mod_logout') || 'تسجيل الخروج'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Loading screen while loading workshop (10s max via Promise.race, never hangs infinitely)
  if (isWorkshopLoading && !currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 dark:bg-stone-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-stone-500">{tr('loading_workshop_data') || 'جاري فتح ورشتك السحابية وتحميل البيانات...'}</p>
        </div>
      </div>
    );
  }

  // 5. Incomplete Workshop details
  if (needsWorkshopDetailsEmail) {
    return (
      <CompleteWorkshopScreen
        userEmail={needsWorkshopDetailsEmail}
        onWorkshopCreated={(ws) => {
          handleAuthenticated(ws);
        }}
        onLogout={handleLogout}
      />
    );
  }

  // 6. Not authenticated or profile missing
  if (!currentProfile) {
    return (
      <AuthGateway
        onAuthenticated={handleAuthenticated}
        onNeedsWorkshopDetails={(em) => setNeedsWorkshopDetailsEmail(em)}
      />
    );
  }

  // 6. Suspended workshop account (Rule 7)
  if (currentProfile.isFrozen || currentProfile.frozenReason || (currentProfile as any).status === 'suspended') {
    return (
      <SuspendedWorkshopScreen
        onLogout={handleLogout}
        brandName={currentProfile.brandName}
        artistName={currentProfile.artistName}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        profile={currentProfile}
        hasActiveSession={Boolean(authSession?.access_token && userId)}
        unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
        onToggleSidebar={() => setIsMobileMenuOpen(true)}
        onOpenGlobalSearch={() => {
          loadSearchCache();
          setIsGlobalSearchOpen(true);
        }}
        onGoHome={() => setActiveView('home')}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenNewMaterialModal={() => {
          setOpenAddMaterialInView(true);
          setActiveView('materials');
        }}
        onNavigateToCalculator={() => setActiveView('calculator')}
        onOpenSupplierInvoice={() => {
          setSupplierModalMode('record_invoice');
          setSupplierModalLocked(true);
          setIsNewSupplierModalOpen(true);
        }}
        onNavigateToSales={() => setActiveView('sales')}
        onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
        onOpenNewEmployeeModal={() => setIsNewEmployeeModalOpen(true)}
      />

      {/* Mobile Lateral Hamburger Drawer */}
      <SidebarDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        profile={currentProfile}
        activeView={activeView}
        onSelectView={(v) => {
          if (v === 'inventory') {
            setIsInventoryModalOpen(true);
          } else if (v === 'expenses') {
            setIsAdminCostsModalOpen(true);
          } else if (v === 'currency_rates') {
            setIsExchangeRatesModalOpen(true);
          } else if (v === 'create_center' || v === 'home') {
            setActiveView('home');
          } else {
            setActiveView(v as AppActiveView);
          }
        }}
        unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenProfileSettings={() => setIsProfileModalOpen(true)}
        onOpenCraftsSelector={() => setIsCraftsSelectorOpen(true)}
        onOpenUserGuide={(sectionId) => {
          setUserGuideSection(sectionId);
          setIsUserGuideOpen(true);
        }}
        onOpenCloudMigration={() => setIsCloudMigrationOpen(true)}
        onOpenSupport={() => setIsSupportModalOpen(true)}
        onStartTour={() => {
          setIsMobileMenuOpen(false);
          setIsInteractiveTourOpen(true);
        }}
        onToggleDarkMode={toggleDarkMode}
        isDarkMode={isDarkMode}
        onLogout={handleLogout}
      />

      {/* Frozen Account Notification Banner */}
      {currentProfile.isFrozen && (
        <div className="bg-cyan-700 text-white px-4 py-2.5 text-xs font-bold shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Snowflake size={16} className="text-cyan-200 animate-pulse flex-shrink-0" />
              <span>
                تنبيه إداري: تم تجميد حساب هذه الورشة ({currentProfile.frozenReason || 'مراجعة المعايير والحساب'}). يرجى التواصل مع إدارة المنظومة.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-cyan-100 text-[11px] underline transition cursor-pointer"
            >
              الدعم الفني والشكاوى
            </button>
          </div>
        </div>
      )}

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Back to Home Bar when on any module screen (No icons row left) */}
        {activeView !== 'home' && activeView !== 'create_center' && (
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-stone-200/80 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setActiveView('home')}
              className="px-3 py-1.5 rounded-2xl border border-amber-300/80 dark:border-amber-700/80 bg-white dark:bg-stone-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-800 dark:text-stone-200 text-xs font-black transition-all flex items-center gap-2 shadow-xs active:scale-95 cursor-pointer group"
              title="العودة للشاشة الرئيسية"
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <img
                  src="/alshams_falcon_emblem.png"
                  alt="أيقونة الشاشة الرئيسية"
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform drop-shadow-2xs select-none"
                />
              </div>
              <span className="text-xs font-black text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                الشاشة الرئيسية
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="text-xs font-bold text-stone-500">
              <span>منظومة الشمساوية • {currentProfile.brandName}</span>
            </div>
          </div>
        )}

        {/* ACTIVE VIEW RENDERING */}
        {(activeView === 'home' || activeView === 'create_center') && (
          <WorkshopHomeScreen
            profile={currentProfile}
            onNavigateToCalculator={() => setActiveView('calculator')}
            onNavigateToArchive={() => setActiveView('archive')}
            onNavigateToCatalog={() => setActiveView('catalog')}
            onNavigateToAIAgent={() => setActiveView('ai_agent')}
            onNavigateToMaterials={(openAdd) => {
              if (openAdd) setOpenAddMaterialInView(true);
              setActiveView('materials');
            }}
            onNavigateToSuppliers={() => setActiveView('suppliers')}
            onNavigateToSales={(mode) => setActiveView('sales')}
            onNavigateToInvoices={(filter) => {
              if (filter === 'customers') {
                setActiveView('customers');
              } else {
                setActiveView('invoices');
              }
            }}
            onNavigateToWorkOrders={(mode) => setActiveView('work_orders')}
            onNavigateToTreasuries={() => setActiveView('treasuries')}
            onNavigateToHR={() => setActiveView('hr')}
            onNavigateToReports={() => setActiveView('reports')}
            onNavigateToFixedAssets={() => setActiveView('fixed_assets')}
            onOpenExchangeRatesModal={() => setIsExchangeRatesModalOpen(true)}
            onOpenInventoryModal={(tab) => setIsInventoryModalOpen(true)}
            onOpenAdminCostsModal={() => setIsAdminCostsModalOpen(true)}
            onOpenNewMaterialModal={() => {
              setOpenAddMaterialInView(true);
              setActiveView('materials');
            }}
            onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
            onOpenNewSupplierModal={() => {
              setSupplierModalMode('create_supplier');
              setSupplierModalLocked(false);
              setIsNewSupplierModalOpen(true);
            }}
            onOpenCreateSupplier={() => {
              setSupplierModalMode('create_supplier');
              setSupplierModalLocked(true);
              setIsNewSupplierModalOpen(true);
            }}
            onOpenSupplierInvoice={() => {
              setSupplierModalMode('record_invoice');
              setSupplierModalLocked(true);
              setIsNewSupplierModalOpen(true);
            }}
            onOpenNewEmployeeModal={() => setIsNewEmployeeModalOpen(true)}
          />
        )}

        {activeView === 'calculator' && (
          <ProductionCalculator
            profile={currentProfile}
            initialRecord={reloadedRecord}
            onOpenWhatsAppShare={handleOpenWhatsAppShare}
            onOpenNewMaterialModal={() => {
              setOpenAddMaterialInView(true);
              setActiveView('materials');
            }}
            onSavedSuccess={() => {
              // Successfully saved to archive
            }}
            externalNotesToTransfer={notesToTransfer}
            onNotesTransferredHandled={() => setNotesToTransfer(null)}
          />
        )}

        {activeView === 'invoices' && (
          <InvoicesView
            workshop={currentProfile}
            onOpenHelp={(s) => {
              setUserGuideSection(s);
              setIsUserGuideOpen(true);
            }}
            onOpenDocumentPreview={(docType, data) => {
              // Document preview hook
            }}
          />
        )}

        {activeView === 'work_orders' && (
          <UnderMigrationNotice
            title="أوامر التشغيل وتتبع الهالك قيد النقل للنظام الجديد"
            onGoBack={() => setActiveView('home')}
          />
        )}

        {activeView === 'suppliers' && (
          <SuppliersView
            workshop={currentProfile}
            onOpenHelp={(s) => {
              setUserGuideSection(s);
              setIsUserGuideOpen(true);
            }}
            onOpenCreateSupplier={() => {
              setSupplierModalMode('create_supplier');
              setSupplierModalLocked(true);
              setIsNewSupplierModalOpen(true);
            }}
          />
        )}

        {activeView === 'customers' && (
          <CustomersView
            workshop={currentProfile}
            onOpenHelp={(s) => {
              setUserGuideSection(s);
              setIsUserGuideOpen(true);
            }}
          />
        )}

        {activeView === 'materials' && (
          <MaterialsView
            workshop={currentProfile}
            initialOpenAddModal={openAddMaterialInView}
            onResetOpenAddModal={() => setOpenAddMaterialInView(false)}
          />
        )}

        {activeView === 'treasuries' && (
          <TreasuriesView
            workshop={currentProfile}
            onOpenHelp={(s) => {
              setUserGuideSection(s);
              setIsUserGuideOpen(true);
            }}
          />
        )}

        {activeView === 'sales' && (
          <UnderMigrationNotice
            title="إدارة المبيعات والطلبيات قيد النقل للنظام الجديد"
            onGoBack={() => setActiveView('home')}
          />
        )}

        {activeView === 'hr' && (
          <UnderMigrationNotice
            title="الموارد البشرية والرواتب قيد النقل للنظام الجديد"
            onGoBack={() => setActiveView('home')}
          />
        )}

        {activeView === 'ai_agent' && (
          <FalconAIAgent
            profile={currentProfile}
            currentCategory={(reloadedRecord?.category as CraftCategory) || 'جدارية'}
            onApplyCategoryFromAI={handleApplyCategoryFromAI}
            onApplyEstimatedLaborWage={handleApplyEstimatedLaborWage}
            onTransferNotesToCalculator={handleTransferNotesToCalculator}
          />
        )}

        {activeView === 'archive' && (
          <UnderMigrationNotice
            title="أرشيف المنتجات المسعرة قيد النقل للنظام الجديد"
            onGoBack={() => setActiveView('home')}
          />
        )}

        {activeView === 'catalog' && (
          <UnderMigrationNotice
            title="كتالوج الورشة قيد النقل للنظام الجديد"
            onGoBack={() => setActiveView('home')}
          />
        )}

        {activeView === 'reports' && (
          <SaaSReportsAnalyticsView profile={currentProfile} />
        )}

        {activeView === 'fixed_assets' && (
          <FixedAssetsView
            workshop={currentProfile}
            profile={currentProfile}
            onGoBack={() => setActiveView('home')}
            onOpenHelp={(s: string) => {
              setUserGuideSection(s);
              setIsUserGuideOpen(true);
            }}
          />
        )}

        {activeView === 'admin' && (
          <UnderMigrationNotice
            title="لوحة التحكم الإدارية قيد النقل للنظام الجديد"
            onGoBack={() => setActiveView('home')}
          />
        )}
      </main>

      {/* REAL CREATION MODALS FOR CLIENT & SUPPLIER (CONNECTED TO SUPABASE) */}
      <NewClientModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        profile={currentProfile}
        onSuccess={() => {}}
      />

      <NewSupplierModal
        isOpen={isNewSupplierModalOpen}
        onClose={() => setIsNewSupplierModalOpen(false)}
        profile={currentProfile}
        initialMode={supplierModalMode}
        lockMode={supplierModalLocked}
        onSuccess={() => {}}
      />

      {isNewEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <UnderMigrationNotice
            title="نماذج إدخال الموظفين قيد النقل للنظام الجديد"
            onGoBack={() => setIsNewEmployeeModalOpen(false)}
          />
        </div>
      )}

      {/* OTHER MODALS */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={currentProfile}
        onProfileUpdated={(updated) => setCurrentProfile(updated)}
      />

      {isInventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <UnderMigrationNotice
            title="المخازن وكارت الصنف قيد النقل للنظام الجديد"
            onGoBack={() => setIsInventoryModalOpen(false)}
          />
        </div>
      )}

      {isAdminCostsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <UnderMigrationNotice
            title="المصروفات والتكاليف الإدارية قيد النقل للنظام الجديد"
            onGoBack={() => setIsAdminCostsModalOpen(false)}
          />
        </div>
      )}

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={notifications}
        profile={currentProfile}
        onRefreshNotifications={loadNotifications}
        onNavigateToOrder={(orderId) => {
          setActiveView('sales');
          setIsNotificationDrawerOpen(false);
        }}
        onNavigateToInventory={() => {
          setIsInventoryModalOpen(true);
          setIsNotificationDrawerOpen(false);
        }}
      />

      <WhatsAppQuoteDrawer
        isOpen={isQuoteDrawerOpen}
        onClose={() => setIsQuoteDrawerOpen(false)}
        record={quoteRecord}
        profile={currentProfile}
      />

      {/* Crafts Selector Modal (اختيار أقسام الورشة) */}
      <CraftsSelectorModal
        isOpen={isCraftsSelectorOpen}
        onClose={() => setIsCraftsSelectorOpen(false)}
        workshop={currentProfile}
        onCraftsUpdated={(crafts) => {
          localStorage.setItem('alshams_crafts_selected', JSON.stringify(crafts));
          setCurrentProfile((prev) => (prev ? { ...prev, selectedCrafts: crafts } : prev));
          setIsCraftsSelectorOpen(false);
        }}
      />

      {/* Global Search Modal (البحث الموحد) */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        cache={searchCache}
        onSelectResult={(categoryKey, rawItem, extraAction) => {
          setIsGlobalSearchOpen(false);
          if (categoryKey === 'screens') {
            if (rawItem?.targetView) {
              setActiveView(rawItem.targetView as AppActiveView);
            } else if (rawItem?.targetModal === 'expenses') {
              setIsAdminCostsModalOpen(true);
            } else if (rawItem?.targetModal === 'guide') {
              setUserGuideSection(undefined);
              setIsUserGuideOpen(true);
            }
          } else if (categoryKey === 'guide') {
            if (extraAction?.type === 'guide_section') {
              setUserGuideSection(extraAction.sectionId);
            } else {
              setUserGuideSection(undefined);
            }
            setIsUserGuideOpen(true);
          } else if (categoryKey === 'customers') {
            setActiveView('sales');
          } else if (categoryKey === 'invoices') {
            setActiveView('invoices');
          } else if (categoryKey === 'suppliers' || categoryKey === 'supplierInvoices') {
            setActiveView('suppliers');
          } else if (categoryKey === 'workOrders') {
            setActiveView('work_orders');
          } else if (categoryKey === 'employees') {
            setActiveView('hr');
          } else if (categoryKey === 'products') {
            setActiveView('archive');
          } else if (categoryKey === 'materials') {
            setIsInventoryModalOpen(true);
          } else if (categoryKey === 'treasuries') {
            setActiveView('treasuries');
          } else if (categoryKey === 'expenses') {
            setIsAdminCostsModalOpen(true);
          }
        }}
      />

      {/* User Guide Modal (دليل الاستخدام الشامل) */}
      <UserGuideModal
        isOpen={isUserGuideOpen}
        onClose={() => setIsUserGuideOpen(false)}
        initialSectionId={userGuideSection}
      />

      {/* Cloud Migration Modal (الترحيل السحابي) */}
      <CloudMigrationModal
        isOpen={isCloudMigrationOpen}
        onClose={() => setIsCloudMigrationOpen(false)}
        workshopId={currentProfile.ownerUid || currentProfile.workshopId || currentProfile.id}
        userEmail={currentProfile.email}
        onMigrationComplete={() => {
          loadNotifications();
        }}
      />

      {/* Family Welcome Modal (رسالة الترحيب الدافئة بعيلة الشمساوية) */}
      <FamilyWelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={handleCloseWelcomeModal}
        profile={currentProfile}
        type={welcomeType}
      />

      {/* Support & Complaints Modal (الدعم الفني والشكاوى) */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        profile={currentProfile}
      />

      {/* Interactive Tour Modal (الجولة التعريفية التفاعلية للمستخدمين الجدد) */}
      <InteractiveTourModal
        isOpen={isInteractiveTourOpen}
        onClose={() => setIsInteractiveTourOpen(false)}
        profile={currentProfile}
        onNavigateToCalculator={() => {
          setActiveView('calculator');
          setIsInteractiveTourOpen(false);
        }}
      />

      {/* Daily Exchange Rates Modal */}
      <ExchangeRatesModal
        isOpen={isExchangeRatesModalOpen}
        onClose={() => setIsExchangeRatesModalOpen(false)}
        profile={currentProfile}
      />

      {/* Footer Attribution Watermark */}
      <footer className="mt-auto py-5 border-t border-stone-200 dark:border-stone-800 text-center text-xs text-stone-500 dark:text-stone-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1 font-medium">
            <span>منظومة الشمساوية الحرفية المتكاملة (SaaS Edition)</span>
            <span className="text-stone-300 dark:text-stone-700">•</span>
            <span>كافة الحقوق محفوظة لبراند {currentProfile.brandName}</span>
          </p>
          <p className="font-mono text-[11px] tracking-wider text-stone-400 dark:text-stone-500 lowercase">
            powered by AL-SHAMS CRAFT
          </p>
        </div>
      </footer>
    </div>
  );
}
