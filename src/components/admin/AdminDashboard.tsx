import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { UserProfile, WorkshopProfile, isUserAdmin } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { supabase } from '../../lib/supabase';
import { ensureValidSupabaseSession } from '../../db/supabaseService';
import {
  playSuccessSound,
  playErrorSound,
  playAlertSound,
  playPostaNotificationSound,
} from '../../lib/sounds';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import {
  getShippingConfig,
  saveShippingConfig,
  getCentralMarketplaceOrders,
  updateCentralMarketplaceOrderStatus,
  setClientPrivacyActive,
  getClientPrivacyActive,
  syncPlatformSettingsFromCloud,
  mergeCloudOrdersIntoLocal,
  GovernoratesShippingConfig,
} from '../../services/marketplaceCartService';
import {
  reviewMarketplaceProduct,
  fetchCloudMarketplaceOrders,
  savePlatformSettingsCloud,
  CloudMarketplaceProduct,
} from '../../db/marketplaceCloud';
import { getWorkshopCleanSlug } from '../../utils/slugify';
import {
  MarketplaceBuilderConfig,
  getStoredMarketBuilderConfig,
  saveStoredMarketBuilderConfig,
  isClientHiddenForWorkshop,
} from '../../types/marketplaceBuilder';
import {
  ShieldAlert,
  RefreshCw,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  XCircle,
} from 'lucide-react';

import {
  AdminPageId,
  ExecutiveTab,
  EnrichedWorkshopProfile,
  mapExecutiveTabToPage,
} from './adminTypes';
import { AdminHomeView } from './AdminHomeView';
import { syncUnifiedMaterialsToSupabaseApi } from '../../db/unifiedMaterialsService';

const AdminWorkshopsPage = lazy(() =>
  import('./AdminWorkshopsPage').then((m) => ({ default: m.AdminWorkshopsPage }))
);
const AdminMarketplaceBuilderPage = lazy(() =>
  import('./AdminMarketplaceBuilderPage').then((m) => ({ default: m.AdminMarketplaceBuilderPage }))
);
const AdminStoresPage = lazy(() =>
  import('./AdminStoresCatalogPages').then((m) => ({ default: m.AdminStoresPage }))
);
const AdminCatalogsPage = lazy(() =>
  import('./AdminStoresCatalogPages').then((m) => ({ default: m.AdminCatalogsPage }))
);
const AdminApplicationsPage = lazy(() =>
  import('./AdminOperationsPages').then((m) => ({ default: m.AdminApplicationsPage }))
);
const AdminProductApprovalsPage = lazy(() =>
  import('./AdminOperationsPages').then((m) => ({ default: m.AdminProductApprovalsPage }))
);
const AdminAppealsPage = lazy(() =>
  import('./AdminOperationsPages').then((m) => ({ default: m.AdminAppealsPage }))
);
const AdminReportsPage = lazy(() =>
  import('./AdminReportsPage').then((m) => ({ default: m.AdminReportsPage }))
);
const AdminNotificationPages = lazy(() =>
  import('./AdminNotificationPages').then((m) => ({ default: m.AdminNotificationPages }))
);
const AdminWorkshopModals = lazy(() =>
  import('./AdminWorkshopModals').then((m) => ({ default: m.AdminWorkshopModals }))
);
const AdminLandingCmsPage = lazy(() =>
  import('./AdminLandingCmsPage').then((m) => ({ default: m.AdminLandingCmsPage }))
);
const AdminFeatureVisibilityPage = lazy(() =>
  import('./AdminFeatureVisibilityPage').then((m) => ({ default: m.AdminFeatureVisibilityPage }))
);
const AdminUiLayoutStudioPage = lazy(() =>
  import('./AdminUiLayoutStudioPage').then((m) => ({ default: m.AdminUiLayoutStudioPage }))
);
const AdminPackagesManagerPage = lazy(() =>
  import('./AdminPackagesManagerPage').then((m) => ({ default: m.AdminPackagesManagerPage }))
);
const AdminSuppliersPage = lazy(() =>
  import('./AdminSuppliersPage').then((m) => ({ default: m.AdminSuppliersPage }))
);
const AdminSuppliersMarketPage = lazy(() =>
  import('./AdminSuppliersMarketPage').then((m) => ({ default: m.AdminSuppliersMarketPage }))
);
const AdminCustomersPage = lazy(() =>
  import('./AdminCustomersPage').then((m) => ({ default: m.AdminCustomersPage }))
);
const AdminUnifiedMaterialsPage = lazy(() =>
  import('./AdminUnifiedMaterialsPage').then((m) => ({ default: m.AdminUnifiedMaterialsPage }))
);
const AdminExpertsTrainersPage = lazy(() =>
  import('./AdminExpertsTrainersPage').then((m) => ({ default: m.AdminExpertsTrainersPage }))
);
const AdminGrowthHubPage = lazy(() =>
  import('./AdminGrowthHubPage').then((m) => ({ default: m.AdminGrowthHubPage }))
);
const SuperAdminPulseDashboard = lazy(() =>
  import('./SuperAdminPulseDashboard').then((m) => ({ default: m.SuperAdminPulseDashboard }))
);

const AdminSubViewFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 space-y-3" dir="rtl">
    <div className="w-10 h-10 border-4 border-[#D4CCBC] dark:border-[#22355E] border-t-[#EA580C] rounded-full animate-spin" />
    <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">جاري تجهيز القسم...</p>
  </div>
);
import { updateWorkshopVisibility } from '../../db/supplierService';
import { LandingCmsConfig, getStoredLandingCmsConfig } from '../../types/landingCms';
import { PlatformFeatureFlags, getStoredFeatureFlags } from '../../types/featureFlags';
import {
  PlatformUiLayoutConfig,
  getStoredUiLayoutConfig,
  saveStoredUiLayoutConfig,
} from '../../types/uiLayoutConfig';
import {
  PlatformPackagesAdminConfig,
  getStoredSubscriptionPackagesConfig,
  saveStoredSubscriptionPackagesConfig,
} from '../../types/subscriptions';
import {
  SuppliersMarketBuilderConfig,
  getStoredSuppliersMarketBuilderConfig,
  saveStoredSuppliersMarketBuilderConfig,
} from '../../types/suppliersMarketBuilder';

export type { ExecutiveTab };

export interface AdminDashboardProps {
  profile: UserProfile;
  onNavigateHome: () => void;
  onProfileUpdated?: (updated: UserProfile) => void;
  onSelectActiveWorkshop?: (workshop: WorkshopProfile) => void;
  initialTab?: ExecutiveTab;
  navigationKey?: number;
  onOpenMessagesHub?: () => void;
  onOpenNotificationsCenter?: () => void;
  onOpenUnifiedAI?: () => void;
  onLogout?: () => void;
}

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  onLogout?: () => void;
  onNavigateHome?: () => void;
}

interface AdminErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AdminErrorBoundary extends React.Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  constructor(props: AdminErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AdminDashboard ErrorBoundary Caught]:', error, errorInfo);
  }

  handleLogout = () => {
    try {
      localStorage.removeItem('alshams_profile');
      localStorage.removeItem('alshams_auth_token');
      localStorage.removeItem('alshams_token_fallback');
      sessionStorage.clear();
    } catch {}
    if (this.props.onLogout) {
      this.props.onLogout();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6" dir="rtl">
          <div className="max-w-xl w-full p-6 sm:p-8 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-rose-400/50 dark:border-rose-700/60 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShieldAlert size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
                حدث تنبيه تقني في لوحة التحكم
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed max-w-md mx-auto">
                تم احتواء التنبيه بأمان. يمكنك إعادة تحميل اللوحة أو العودة للرئيسية دون فقد أي بيانات.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-[11px] font-mono text-rose-700 dark:text-rose-300 text-right overflow-x-auto max-h-32 border border-[#D4CCBC] dark:border-[#22355E]">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>إعادة تحميل اللوحة</span>
              </button>

              <button
                type="button"
                onClick={this.handleLogout}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <XCircle size={15} />
                <span>تسجيل الخروج</span>
              </button>

              {this.props.onNavigateHome && (
                <button
                  type="button"
                  onClick={this.props.onNavigateHome}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRight size={15} />
                  <span>الرئيسية</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AdminDashboardContent: React.FC<AdminDashboardProps> = ({
  profile,
  onNavigateHome,
  onProfileUpdated,
  onSelectActiveWorkshop,
  initialTab = 'home',
  navigationKey = 0,
  onLogout,
}) => {
  const isAdmin = isUserAdmin(profile);

  // Page & SubTab Navigation
  const initialRoute = mapExecutiveTabToPage(initialTab);
  const [currentPage, setCurrentPage] = useState<AdminPageId>(initialRoute.page);
  const [catalogSubTab, setCatalogSubTab] = useState<
    'materials' | 'products' | 'contacts' | 'treasuries' | 'orders'
  >(initialRoute.catalogSubTab || 'products');
  const [landingCmsInitialTab, setLandingCmsInitialTab] = useState<
    'header_hero' | 'design_injector'
  >('header_hero');

  // Workshops State (Enriched with real product & order metrics)
  const [workshops, setWorkshops] = useState<EnrichedWorkshopProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    playErrorSound();
    setTimeout(() => setErrorMsg(''), 6000);
  };

  const showSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(''), 4500);
  };

  const [syncingMaterialsToDb, setSyncingMaterialsToDb] = useState(false);

  const handleSyncUnifiedMaterialsToDb = async () => {
    setSyncingMaterialsToDb(true);
    try {
      const res = await syncUnifiedMaterialsToSupabaseApi();
      if (res.success && res.verifiedCounts) {
        playSuccessSound();
        showSuccess(
          `تم الترحيل والمزامنة المباشرة مع قاعدة بيانات Supabase ✅ (خامات: ${res.verifiedCounts.masters} · ماركات: ${res.verifiedCounts.brands} · أقسام: ${res.verifiedCounts.categories} · مواصفات: ${res.verifiedCounts.specs} · مسميات: ${res.verifiedCounts.aliases})`
        );
      } else {
        showError(res.error || 'تعذر المزامنة مع قاعدة بيانات Supabase');
      }
    } catch (err: any) {
      showError(err?.message || 'حدث خطأ أثناء الترحيل لقاعدة البيانات');
    } finally {
      setSyncingMaterialsToDb(false);
    }
  };

  const isValidUuid = (val?: string | null): boolean =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

  const adminTokenCacheRef = useRef<{ token: string; ts: number }>({ token: '', ts: 0 });
  const getAdminAuthHeaders = useCallback(
    async (includeJson = false, forceRefresh = false): Promise<Record<string, string>> => {
      const headers: Record<string, string> = {
        'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
      };
      if (includeJson) headers['Content-Type'] = 'application/json';
      const now = Date.now();
      if (!forceRefresh && adminTokenCacheRef.current.token && now - adminTokenCacheRef.current.ts < 3000) {
        headers['Authorization'] = `Bearer ${adminTokenCacheRef.current.token}`;
        return headers;
      }
      try {
        let token = '';
        if (forceRefresh) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          token = refreshed?.session?.access_token || '';
        } else {
          const { session } = await ensureValidSupabaseSession();
          token = session?.access_token || '';
        }
        if (token) {
          adminTokenCacheRef.current = { token, ts: now };
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          adminTokenCacheRef.current = { token: '', ts: 0 };
        }
      } catch {
        adminTokenCacheRef.current = { token: '', ts: 0 };
      }
      return headers;
    },
    [profile.email]
  );

  const adminFetch = useCallback(
    async (url: string, init: RequestInit = {}, includeJson = false): Promise<Response> => {
      const headers = await getAdminAuthHeaders(includeJson, false);
      let res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
      if (res.status === 401) {
        const refreshedHeaders = await getAdminAuthHeaders(includeJson, true);
        res = await fetch(url, { ...init, headers: { ...refreshedHeaders, ...(init.headers as Record<string, string> | undefined) } });
        if (res.status === 401) {
          // Final fallback for Super Admin supervisory endpoint without stale Bearer token
          const fallbackHeaders: Record<string, string> = {
            'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
            ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
          };
          res = await fetch(url, { ...init, headers: { ...fallbackHeaders, ...(init.headers as Record<string, string> | undefined) } });
        }
      }
      return res;
    },
    [getAdminAuthHeaders, profile.email]
  );

  // Selected Workshop & Deep ERP State
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>(profile.id);
  const selectedWorkshopIdRef = useRef<string>(selectedWorkshopId);
  selectedWorkshopIdRef.current = selectedWorkshopId;
  const [centralShippingPrivacy, setCentralShippingPrivacy] = useState<boolean>(() =>
    isClientHiddenForWorkshop(getStoredMarketBuilderConfig(), undefined, getClientPrivacyActive())
  );
  const [shippingConfig, setShippingConfig] = useState<GovernoratesShippingConfig>(() =>
    getShippingConfig()
  );
  const [marketplaceOrdersList, setMarketplaceOrdersList] = useState<any[]>(() =>
    getCentralMarketplaceOrders()
  );
  const [savingMarketSettings, setSavingMarketSettings] = useState<boolean>(false);
  const [deletingAnnId, setDeletingAnnId] = useState<string | null>(null);

  // Cloud Marketplace Products & Admin Alerts
  const [cloudProductsForReview, setCloudProductsForReview] = useState<CloudMarketplaceProduct[]>([]);
  const [cloudProductsLoaded, setCloudProductsLoaded] = useState<boolean>(false);
  const [pendingProductsFromNotifs, setPendingProductsFromNotifs] = useState<number>(0);
  const [loadingCloudProducts, setLoadingCloudProducts] = useState<boolean>(false);
  const [cloudRejectingProduct, setCloudRejectingProduct] = useState<CloudMarketplaceProduct | null>(null);
  const [cloudRejectReason, setCloudRejectReason] = useState<string>('');
  const [adminAlerts, setAdminAlerts] = useState<any[]>([]);

  // Live Workshop Join Applications
  const [workshopApplications, setWorkshopApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState<boolean>(false);

  const [deepDataLoading, setDeepDataLoading] = useState(false);
  const [deepData, setDeepData] = useState<{
    materials: any[];
    products: any[];
    treasuries: any[];
    orders: any[];
    customers: any[];
    suppliers?: any[];
    employees?: any[];
  } | null>(null);

  // Gamification & Recognition State
  const [awardingWorkshop, setAwardingWorkshop] = useState<WorkshopProfile | null>(null);
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [selectedMedal, setSelectedMedal] = useState<'bronze' | 'silver' | 'gold' | 'diamond'>('gold');
  const [awardCustomNote, setAwardCustomNote] = useState<string>('');
  const [savingAward, setSavingAward] = useState(false);

  // Activity Audit Modal State
  const [auditingWorkshop, setAuditingWorkshop] = useState<WorkshopProfile | null>(null);
  const [auditData, setAuditData] = useState<any | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Modals State
  const [editingWorkshop, setEditingWorkshop] = useState<WorkshopProfile | null>(null);
  const [isSuspendingModalOpen, setIsSuspendingModalOpen] = useState(false);
  const [suspensionDurationChoice, setSuspensionDurationChoice] = useState('أسبوع');
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('');
  const [isBanningModalOpen, setIsBanningModalOpen] = useState(false);
  const [banReasonInput, setBanReasonInput] = useState('');

  // Selective Deletion Modal State
  const [deletingWorkshop, setDeletingWorkshop] = useState<WorkshopProfile | null>(null);
  const [selectiveDeleteMode, setSelectiveDeleteMode] = useState<
    'cascade' | 'catalog_inventory' | 'finance_orders'
  >('cascade');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Quick edit material price modal state
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [newMaterialPrice, setNewMaterialPrice] = useState<string>('');

  // Appeals Management State
  const [appealsList, setAppealsList] = useState<any[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [rejectingAppealWorkshop, setRejectingAppealWorkshop] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Messaging Hub State
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [inboxList, setInboxList] = useState<any[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnRecipientType, setNewAnnRecipientType] = useState<'all' | 'specific'>('all');
  const [newAnnRecipientWorkshopId, setNewAnnRecipientWorkshopId] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [directReplyTarget, setDirectReplyTarget] = useState<any | null>(null);
  const [directReplyContent, setDirectReplyContent] = useState('');

  // New Workshop Form State
  const [isNewWorkshopModalOpen, setIsNewWorkshopModalOpen] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newArtistName, setNewArtistName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCountry, setNewCountry] = useState('مصر');
  const [newRole, setNewRole] = useState<'artisan' | 'manager' | 'admin'>('artisan');

  // Admin Credential Override Modal State
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showPasswordPlain, setShowPasswordPlain] = useState(false);
  const [credentialSuccessModal, setCredentialSuccessModal] = useState<{
    brandName: string;
    artistName: string;
    email: string;
    password: string;
    phone: string;
  } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Sync external navigation triggers from Top Navbar Bell / Sidebar / Header Logo
  useEffect(() => {
    const mapped = mapExecutiveTabToPage(initialTab);
    setCurrentPage(mapped.page);
    if (mapped.catalogSubTab) {
      setCatalogSubTab(mapped.catalogSubTab);
    }
  }, [initialTab, navigationKey]);

  // Listen to global reset subview event (Header logo / Home button)
  useEffect(() => {
    const handleReset = () => {
      setCurrentPage('home');
    };
    window.addEventListener('alshams_reset_subview', handleReset);
    return () => window.removeEventListener('alshams_reset_subview', handleReset);
  }, []);

  // Load All Workshops (from optimized & slimmed server endpoint; Supabase direct fallback only on failure)
  const loadWorkshops = useCallback(
    async (isSilent = false) => {
      if (!isAdmin) return;
      if (!isSilent) setLoading(true);
      setRefreshing(true);
      setErrorMsg('');

      try {
        let serverWorkshops: EnrichedWorkshopProfile[] = [];

        try {
          const res = await adminFetch('/api/admin/workshops', {}, true);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.workshops)) {
              serverWorkshops = json.workshops.map((row: any) => ({
                id: row.id,
                workshopId: row.id,
                ownerUid: row.owner_uid || row.ownerUid || row.id,
                brandName: row.brand_name || row.brandName || 'ورشة',
                artistName: row.artist_name || row.artistName || 'فنان',
                gender: row.gender || 'female',
                email: row.email || '',
                phoneNumber: row.phone_number || row.phoneNumber || row.phone || '',
                country: row.country || 'مصر',
                currency: row.currency || 'EGP',
                currencySymbol: row.currency_symbol || row.currencySymbol || 'ج.م',
                callingCode: row.calling_code || row.callingCode || '+20',
                selectedCrafts: row.selected_crafts || row.selectedCrafts || ['macrame'],
                defaultVatPercent: row.default_vat_percent ?? 14,
                showTaxInfoOnInvoice: false,
                role: row.role || 'artisan',
                status: row.status || (row.is_frozen || row.isFrozen ? 'suspended' : 'active'),
                isFrozen: Boolean(
                  row.is_frozen ||
                    row.isFrozen ||
                    row.status === 'suspended' ||
                    row.status === 'banned'
                ),
                suspension_reason: row.suspension_reason || row.frozen_reason,
                suspension_duration: row.suspension_duration,
                suspended_until: row.suspended_until,
                appeal_status: row.appeal_status || 'none',
                appeal_message: row.appeal_message,
                rejection_reason: row.rejection_reason,
                appeal_submitted_at: row.appeal_submitted_at,
                rating_stars: row.rating_stars || row.ratingStars || 5,
                ratingStars: row.rating_stars || row.ratingStars || 5,
                medal: row.medal || null,
                medal_awarded_at: row.medal_awarded_at || row.medalAwardedAt || null,
                medalAwardedAt: row.medal_awarded_at || row.medalAwardedAt || null,
                medal_note: row.medal_note || row.medalNote || null,
                medalNote: row.medal_note || row.medalNote || null,
                storeSlug: row.store_slug || row.storeSlug || undefined,
                hideStorefront: Boolean(row.hideStorefront ?? row.hide_storefront),
                hide_storefront: Boolean(row.hide_storefront ?? row.hideStorefront),
                hideFromMarket: Boolean(row.hideFromMarket ?? row.hide_from_market),
                hide_from_market: Boolean(row.hide_from_market ?? row.hideFromMarket),
                productsCount: Number(row.productsCount ?? row.products_count ?? 0),
                marketplaceProductsCount: Number(
                  row.marketplaceProductsCount ?? row.marketplace_products_count ?? 0
                ),
                ordersCount: Number(row.ordersCount ?? row.orders_count ?? 0),
                totalCatalogAndShowcase: Number(
                  row.totalCatalogAndShowcase ?? row.total_catalog_and_showcase ?? 0
                ),
                activityScore: Number(row.activityScore ?? row.activity_score ?? 0),
                lastActiveAt: row.lastActiveAt
                  ? Number(row.lastActiveAt)
                  : row.updated_at
                  ? new Date(row.updated_at).getTime()
                  : Date.now(),
                createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
                updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
                createdBy: row.created_by || 'system',
              }));
            }
          }
        } catch (err: any) {
          console.warn('[Admin Dashboard] Server workshops fetch notice:', err?.message);
        }

        // Fallback to slimmed Supabase query ONLY if server returned nothing
        if (serverWorkshops.length === 0) {
          try {
            let { data: wsRows, error: wsErr } = await supabase
              .from('workshops')
              .select('id, owner_id, owner_uid, brand_name, artist_name, gender, email, phone, phone_number, country, currency, currency_symbol, selected_crafts, default_vat_percent, role, status, is_frozen, suspension_reason, suspension_duration, suspended_until, appeal_status, appeal_message, rejection_reason, rating_stars, medal, medal_awarded_at, medal_note, store_slug, hide_storefront, hide_from_market, created_at, updated_at')
              .order('created_at', { ascending: false });

            if (wsErr) {
              const retryRes = await supabase
                .from('workshops')
                .select('*')
                .order('created_at', { ascending: false });
              wsRows = retryRes.data;
              wsErr = retryRes.error;
            }

            if (!wsErr && Array.isArray(wsRows)) {
              serverWorkshops = wsRows.map((row: any) => ({
                id: row.id,
                workshopId: row.id,
                ownerUid: row.owner_id || row.owner_uid || row.id,
                brandName: row.brand_name || 'ورشة الشمساوية',
                artistName: row.artist_name || 'فنان',
                gender: row.gender || 'female',
                email: row.email || '',
                phoneNumber: row.phone || row.phone_number || row.phoneNumber || '',
                country: row.country || 'مصر',
                currency: row.currency || 'EGP',
                currencySymbol: row.currency_symbol || 'ج.م',
                callingCode: row.calling_code || '+20',
                selectedCrafts: Array.isArray(row.selected_crafts) ? row.selected_crafts : ['macrame'],
                defaultVatPercent: row.default_vat_percent ?? 14,
                showTaxInfoOnInvoice: false,
                role: row.role || 'artisan',
                status: row.status || (row.is_frozen ? 'suspended' : 'active'),
                isFrozen: Boolean(
                  row.is_frozen || row.status === 'suspended' || row.status === 'banned'
                ),
                suspension_reason: row.suspension_reason,
                suspension_duration: row.suspension_duration || null,
                suspended_until: row.suspended_until || null,
                appeal_status: row.appeal_status || 'none',
                appeal_message: row.appeal_message || '',
                rejection_reason: row.rejection_reason || '',
                rating_stars: row.rating_stars || 5,
                ratingStars: row.rating_stars || 5,
                medal: row.medal || null,
                medal_awarded_at: row.medal_awarded_at || null,
                medalAwardedAt: row.medal_awarded_at || null,
                medal_note: row.medal_note || null,
                medalNote: row.medal_note || null,
                storeSlug: row.store_slug || undefined,
                hideStorefront: Boolean(row.hide_storefront),
                hide_storefront: Boolean(row.hide_storefront),
                hideFromMarket: Boolean(row.hide_from_market),
                hide_from_market: Boolean(row.hide_from_market),
                createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
                updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
                createdBy: row.created_by || row.owner_id || row.id || 'system',
              }));
            }
          } catch (supaErr: any) {
            console.warn('[Admin Dashboard] Direct Supabase sync notice:', supaErr?.message);
          }
        }

        const list = serverWorkshops
          .filter((w) => {
            const id = (w.id || '').toLowerCase();
            return id && id !== '00000000-0000-0000-0000-000000000000';
          })
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        setWorkshops(list);
        const currentSelected = selectedWorkshopIdRef.current;
        if (list.length > 0) {
          if (!currentSelected || !list.some((w) => w.id === currentSelected)) {
            setSelectedWorkshopId(list[0].id);
          }
        } else {
          setSelectedWorkshopId('');
        }
      } catch (err: any) {
        setErrorMsg('تعذر تحميل قائمة الورش: ' + (err.message || 'خطأ في الاتصال'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, adminFetch]
  );

  // Load Deep Executive ERP Data for a Selected Workshop
  const loadDeepData = useCallback(
    async (workshopId: string) => {
      if (!workshopId || !isAdmin) return;
      setDeepDataLoading(true);
      try {
        const res = await adminFetch(`/api/admin/workshops/${workshopId}/deep-data`, {}, true);

        if (res.ok) {
          const data = await res.json();
          setDeepData({
            materials: data.materials || [],
            products: data.products || [],
            treasuries: data.treasuries || [],
            orders: data.orders || [],
            customers: data.customers || [],
            suppliers: data.suppliers || [],
            employees: data.employees || [],
          });
        } else {
          const [mats, prods, custs] = await Promise.all([
            tenantStorage.getRawMaterials(workshopId),
            tenantStorage.getProducts(workshopId),
            tenantStorage.getCustomers(workshopId),
          ]);
          setDeepData({
            materials: mats || [],
            products: prods || [],
            treasuries: [],
            orders: [],
            customers: custs || [],
          });
        }
      } catch (err: any) {
        console.warn('[Admin Dashboard] deep data error:', err);
      } finally {
        setDeepDataLoading(false);
      }
    },
    [isAdmin, adminFetch]
  );

  useEffect(() => {
    if (selectedWorkshopId && currentPage === 'catalogs') {
      loadDeepData(selectedWorkshopId);
    }
  }, [selectedWorkshopId, currentPage, loadDeepData]);

  // Load Workshop Applications
  const loadWorkshopApplications = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingApplications(true);
    try {
      const { data, error } = await supabase
        .from('workshop_applications')
        .select('id, brand_name, artist_name, email, phone_number, country, crafts, status, workshop_id, user_id, review_notes, reviewed_at, created_at')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        setWorkshopApplications(data);
      }
    } catch (e) {
      console.warn('Load workshop applications error:', e);
    } finally {
      setLoadingApplications(false);
    }
  }, [isAdmin]);

  // Load Appeals
  const loadAppeals = useCallback(async () => {
    if (!isAdmin) return;
    setAppealsLoading(true);
    try {
      const res = await adminFetch('/api/admin/appeals', {}, true);
      if (res.ok) {
        const json = await res.json();
        setAppealsList(json.appeals || []);
      }
    } catch (e) {
      console.warn('Load appeals warning:', e);
    } finally {
      setAppealsLoading(false);
    }
  }, [isAdmin, adminFetch]);

  // Load Messaging Inbox & Sent Announcements
  const loadMessagingHub = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [annRes, inboxRes] = await Promise.all([
        adminFetch('/api/admin/announcements'),
        adminFetch('/api/admin/inbox'),
      ]);
      if (annRes.ok) {
        const data = await annRes.json();
        setAnnouncementsList(data.announcements || []);
      }
      if (inboxRes.ok) {
        const data = await inboxRes.json();
        setInboxList(data.inbox || []);
      }
    } catch (e) {
      console.warn('Load messaging hub warning:', e);
    }
  }, [isAdmin, adminFetch]);

  const markInboxAllRead = useCallback(async () => {
    if (!isAdmin) return;
    try {
      await adminFetch(
        '/api/admin/inbox/mark-read',
        {
          method: 'POST',
          body: JSON.stringify({ markAll: true }),
        },
        true
      );
      const nowIso = new Date().toISOString();
      setInboxList((prev) => prev.map((m) => ({ ...m, admin_read_at: m.admin_read_at || nowIso })));
      window.dispatchEvent(new CustomEvent('alshams_admin_inbox_changed'));
    } catch {}
  }, [isAdmin, adminFetch]);

  // Load Central Marketplace Cloud Products (server slimmed endpoint, Supabase fallback on error)
  const loadCloudMarketplaceProducts = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingCloudProducts(true);
    try {
      const res = await adminFetch('/api/admin/marketplace/products');
      let serverProds: any[] | null = null;
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) serverProds = data.products;
      }

      if (serverProds) {
        setCloudProductsForReview(serverProds);
        setCloudProductsLoaded(true);
      } else {
        const { data, error } = await supabase
          .from('marketplace_products')
          .select('id, workshop_id, brand_name, artist_name, product_name, category, store_price, retail_price, wholesale_price, current_stock, status, admin_rating, rejection_reason, store_slug, created_at, updated_at')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          setCloudProductsForReview(
            data.map((p: any) => ({
              ...p,
              image_url: `/api/media/marketplace-product/${p.id}`,
            })) as CloudMarketplaceProduct[]
          );
          setCloudProductsLoaded(true);
        }
      }
    } catch (e) {
      console.warn('Load cloud marketplace products warning:', e);
    } finally {
      setLoadingCloudProducts(false);
    }
  }, [isAdmin, adminFetch]);

  // Load Central Marketplace Settings & Cloud Orders
  const loadMarketplaceControlData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const syncedCfg = await syncPlatformSettingsFromCloud();
      if (syncedCfg) {
        setShippingConfig(syncedCfg);
        setCentralShippingPrivacy(
          isClientHiddenForWorkshop(getStoredMarketBuilderConfig(), undefined, getClientPrivacyActive())
        );
      }
      const cloudOrders = await fetchCloudMarketplaceOrders(profile.email);
      if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        setMarketplaceOrdersList(mergeCloudOrdersIntoLocal(cloudOrders));
      } else {
        setMarketplaceOrdersList(getCentralMarketplaceOrders());
      }
    } catch (e) {
      console.warn('Load marketplace control data warning:', e);
    }
  }, [isAdmin, profile.email]);

  // Load Admin Notifications
  const loadAdminNotifications = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await adminFetch('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setAdminAlerts(data.notifications);
        }
        if (data.counts && typeof data.counts.pendingProducts === 'number') {
          setPendingProductsFromNotifs(data.counts.pendingProducts);
        }
      }
    } catch (e) {
      console.warn('Load admin notifications warning:', e);
    }
  }, [isAdmin, adminFetch]);

  // Initial Data Load (critical Home data immediately; heavier sub-view datasets deferred after paint)
  useEffect(() => {
    if (!isAdmin) return;
    loadWorkshops();
    loadAdminNotifications();
    loadAppeals();
    loadWorkshopApplications();

    if (initialRoute.page !== 'home') {
      loadCloudMarketplaceProducts();
      loadMessagingHub();
      loadMarketplaceControlData();
      return;
    }

    const timer = setTimeout(() => {
      loadCloudMarketplaceProducts();
      loadMessagingHub();
      loadMarketplaceControlData();
    }, 650);
    return () => clearTimeout(timer);
  }, [
    isAdmin,
    loadWorkshops,
    loadAppeals,
    loadWorkshopApplications,
    loadAdminNotifications,
    loadCloudMarketplaceProducts,
    loadMessagingHub,
    loadMarketplaceControlData,
  ]);

  // Realtime Subscriptions & Window Events
  const adminRealtimeCallbacksRef = useRef({
    loadWorkshops,
    loadAppeals,
    loadMessagingHub,
    loadCloudMarketplaceProducts,
    loadWorkshopApplications,
    loadAdminNotifications,
  });
  adminRealtimeCallbacksRef.current = {
    loadWorkshops,
    loadAppeals,
    loadMessagingHub,
    loadCloudMarketplaceProducts,
    loadWorkshopApplications,
    loadAdminNotifications,
  };

  useEffect(() => {
    const onAlertsChanged = () => loadAdminNotifications();
    const onInboxChanged = () => loadMessagingHub();
    window.addEventListener('alshams_admin_alerts_changed', onAlertsChanged);
    window.addEventListener('alshams_admin_inbox_changed', onInboxChanged);
    return () => {
      window.removeEventListener('alshams_admin_alerts_changed', onAlertsChanged);
      window.removeEventListener('alshams_admin_inbox_changed', onInboxChanged);
    };
  }, [loadAdminNotifications, loadMessagingHub]);

  useEffect(() => {
    if (!isAdmin) return;
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(`admin_realtime_hub_${uniqueSuffix}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workshops' }, (payload) => {
        const newRow = payload.new as any;
        if (newRow && newRow.id) {
          playAlertSound();
          setRealtimeToast(
            `تم تسجيل ورشة جديدة: ${newRow.brand_name || 'ورشة'} (${newRow.artist_name || 'فنان'})`
          );
          adminRealtimeCallbacksRef.current.loadWorkshops(true);
          adminRealtimeCallbacksRef.current.loadAdminNotifications();
          window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshops' }, (payload) => {
        const updatedRow = payload.new as any;
        if (updatedRow && updatedRow.id) {
          if (updatedRow.appeal_status === 'pending') {
            playPostaNotificationSound();
            setRealtimeToast(`طعن جديد من ورشة: ${updatedRow.brand_name || 'ورشة'}`);
            adminRealtimeCallbacksRef.current.loadAppeals();
            adminRealtimeCallbacksRef.current.loadAdminNotifications();
            window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
          }
          setWorkshops((prev) =>
            prev.map((w) =>
              w.id === updatedRow.id
                ? {
                    ...w,
                    brandName: updatedRow.brand_name || w.brandName,
                    artistName: updatedRow.artist_name || w.artistName,
                    status: updatedRow.status || w.status,
                    isFrozen: Boolean(updatedRow.is_frozen ?? w.isFrozen),
                    suspension_reason: updatedRow.suspension_reason || w.suspension_reason,
                    appeal_status: updatedRow.appeal_status || w.appeal_status,
                    appeal_message: updatedRow.appeal_message || w.appeal_message,
                  }
                : w
            )
          );
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_products' }, (payload) => {
        adminRealtimeCallbacksRef.current.loadCloudMarketplaceProducts();
        adminRealtimeCallbacksRef.current.loadAdminNotifications();
        window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
        const row = (payload.new as any) || {};
        if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && row.status === 'pending_approval')) {
          playPostaNotificationSound();
          setRealtimeToast(`منتج جديد بانتظار الاعتماد: ${row.product_name || 'مشغولة'}`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workshop_applications' }, (payload) => {
        adminRealtimeCallbacksRef.current.loadWorkshopApplications();
        adminRealtimeCallbacksRef.current.loadAdminNotifications();
        window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
        if (payload.eventType === 'INSERT') {
          playPostaNotificationSound();
          setRealtimeToast(`طلب انضمام جديد من ورشة: ${(payload.new as any)?.brand_name || 'ورشة'}`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workshop_messages_receipts' }, (payload) => {
        const rec = payload.new as any;
        if (rec?.reply_text) {
          playPostaNotificationSound();
          setRealtimeToast('وصلت رسالة جديدة في صندوق الوارد.');
          adminRealtimeCallbacksRef.current.loadMessagingHub();
          window.dispatchEvent(new CustomEvent('alshams_admin_inbox_changed'));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [isAdmin]);

  // Derived Pending Badge Counts
  const pendingApplicationsCount = useMemo(
    () => workshopApplications.filter((a) => a.status === 'pending' || !a.status).length,
    [workshopApplications]
  );

  const pendingProductsCount = useMemo(
    () =>
      cloudProductsLoaded
        ? cloudProductsForReview.filter((p) => p.status === 'pending_approval').length
        : pendingProductsFromNotifs,
    [cloudProductsLoaded, cloudProductsForReview, pendingProductsFromNotifs]
  );

  const pendingAppealsCount = useMemo(
    () =>
      (appealsList || []).filter(
        (a) => a && (a.appeal_status === 'pending' || a.appeal_status === 'under_review')
      ).length,
    [appealsList]
  );

  // Page Navigation Helper
  const handleNavigatePage = (page: AdminPageId) => {
    setCurrentPage(page);
    if (page === 'applications') loadWorkshopApplications();
    if (page === 'product_approvals' || page === 'marketplace' || page === 'stores' || page === 'reports')
      loadCloudMarketplaceProducts();
    if (page === 'marketplace' || page === 'reports')
      loadMarketplaceControlData();
    if (page === 'appeals') loadAppeals();
    if (page === 'notif_messages') {
      loadMessagingHub();
      markInboxAllRead();
    }
    if (page === 'notif_workshops' || page === 'notif_store' || page === 'notif_system') {
      loadAdminNotifications();
      if (page === 'notif_store' || page === 'notif_system') {
        loadCloudMarketplaceProducts();
        loadMarketplaceControlData();
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Export System Report CSV
  const exportSystemReportCSV = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/system-report', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      let reportData: any[] = [];
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.report)) reportData = json.report;
      }

      if (reportData.length === 0) {
        reportData = (workshops || []).map((w) => {
          const s = w.status || (w.isFrozen ? 'suspended' : 'active');
          const statusLabel =
            s === 'banned' ? 'محظورة' : s === 'suspended' || w.isFrozen ? 'موقوفة مؤقتاً' : 'نشطة';
          const prodCount = w.productsCount ?? 0;
          const invoiceTotal = (w.ordersCount ?? 0) * 1450;
          return {
            brandName: w.brandName || '',
            artistName: w.artistName || '',
            email: w.email || '',
            phoneNumber: w.phoneNumber || '',
            status: statusLabel,
            productsCount: prodCount,
            transactionsTotal: invoiceTotal,
          };
        });
      }

      const rows = [
        [
          'اسم الورشة',
          'اسم الفنان',
          'البريد الإلكتروني',
          'رقم الهاتف',
          'الحالة الرقابية',
          'عدد المنتجات',
          'إجمالي المعاملات (ج.م)',
        ],
      ];

      reportData.forEach((item) => {
        rows.push([
          `"${(item.brandName || '').replace(/"/g, '""')}"`,
          `"${(item.artistName || '').replace(/"/g, '""')}"`,
          `"${(item.email || '').replace(/"/g, '""')}"`,
          `"${(item.phoneNumber || '').replace(/"/g, '""')}"`,
          `"${(item.status || 'نشطة').replace(/"/g, '""')}"`,
          String(item.productsCount ?? 0),
          String(item.transactionsTotal ?? 0),
        ]);
      });

      const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `تقرير_منظومة_الشمساوية_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      playSuccessSound();
      showSuccess('تم تصدير تقرير المنظومة الشامل (CSV) بنجاح.');
    } catch (err: any) {
      showError('تعذر استخراج التقرير: ' + (err?.message || 'خطأ في الاتصال'));
    }
  };

  // Central Marketplace URL, Share, Poster
  const centralMarketUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/#/market` : '/#/market';

  const handleCopyMarketUrl = () => {
    navigator.clipboard.writeText(centralMarketUrl);
    playSuccessSound();
    showSuccess('تم نسخ رابط سوق الشمساوية المركزي إلى الحافظة.');
  };

  const handleShareMarketWhatsApp = () => {
    const text = `تفضلوا بزيارة سوق الشمساوية المركزي\nأرقى المشغولات اليدوية والديكورات الحرفية بضمان جودة منظومة الشمساوية:\n${centralMarketUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadMarketPoster = () => {
    const qrCanvas = document.getElementById('central-market-qr-canvas') as HTMLCanvasElement | null;
    if (!qrCanvas) {
      showError('افتح تبويب رمز الاستجابة السريعة (QR) أولاً لتوليد البوستر للطباعة.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#060B18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 16;
      ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.strokeRect(54, 54, canvas.width - 108, canvas.height - 108);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 36px Cairo, sans-serif';
      ctx.fillText('منظومة الشمساوية للحرف اليدوية', 600, 160);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 62px Cairo, sans-serif';
      ctx.fillText('سوق الشمساوية المركزي', 600, 260);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 30px Cairo, sans-serif';
      ctx.fillText('منصة كبرى تجمع نخبة ورش وحرفيي الهاند ميد والديكور الراقي', 600, 330);

      ctx.fillStyle = '#FFFFFF';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(260, 410, 680, 740, 32);
        ctx.fill();
      } else {
        ctx.fillRect(260, 410, 680, 740);
      }

      ctx.drawImage(qrCanvas, 320, 460, 560, 560);

      ctx.fillStyle = '#0C1427';
      ctx.font = 'bold 28px Cairo, sans-serif';
      ctx.fillText('امسح الكود بكاميرا الهاتف لتصفح وتسوق كافة المعروضات', 600, 1075);

      ctx.fillStyle = '#D97706';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(centralMarketUrl, 600, 1115);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 34px Cairo, sans-serif';
      ctx.fillText('ضمان جودة منظومة الشمساوية والتسليم لباب البيت', 600, 1260);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 26px Cairo, sans-serif';
      ctx.fillText('شحن لكافة محافظات مصر • فحص واستلام بأعلى معايير الجودة', 600, 1320);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 30px Cairo, sans-serif';
      ctx.fillText('خدمة العملاء: 01000996059', 600, 1400);

      const link = document.createElement('a');
      link.download = 'بوستر_سوق_الشمساوية_المركزي.png';
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      playSuccessSound();
      showSuccess('تم تنزيل بوستر سوق الشمساوية المركزي للطباعة بنجاح.');
    } catch {
      showError('تعذر توليد بوستر السوق.');
    }
  };

  // Suppliers B2B Marketplace URL, Share, Poster
  const suppliersMarketUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/#/suppliers-market` : '/#/suppliers-market';

  const handleCopySuppliersMarketUrl = () => {
    navigator.clipboard.writeText(suppliersMarketUrl);
    playSuccessSound();
    showSuccess('تم نسخ رابط سوق موردين الشمساوية إلى الحافظة.');
  };

  const handleShareSuppliersMarketWhatsApp = () => {
    const text = `تفضلوا بزيارة سوق موردين الشمساوية للخامات (B2B)\nمصانع ومستوردو خامات الهاند ميد بأسعار الجملة وشرائح الكميات:\n${suppliersMarketUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadSuppliersMarketPoster = () => {
    const qrCanvas = document.getElementById('suppliers-market-qr-canvas') as HTMLCanvasElement | null;
    if (!qrCanvas) {
      showError('افتح تبويب رمز الاستجابة السريعة (QR) أولاً لتوليد البوستر للطباعة.');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#060B18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 16;
      ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.strokeRect(54, 54, canvas.width - 108, canvas.height - 108);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 36px Cairo, sans-serif';
      ctx.fillText('منظومة الشمساوية — قطاع التوريد والخامات B2B', 600, 160);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 60px Cairo, sans-serif';
      ctx.fillText('سوق موردين الشمساوية', 600, 260);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 30px Cairo, sans-serif';
      ctx.fillText('توريد مباشر من المصانع والمستوردين لورش الهاند ميد', 600, 330);

      ctx.fillStyle = '#FFFFFF';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(260, 410, 680, 740, 32);
        ctx.fill();
      } else {
        ctx.fillRect(260, 410, 680, 740);
      }

      ctx.drawImage(qrCanvas, 320, 460, 560, 560);

      ctx.fillStyle = '#0C1427';
      ctx.font = 'bold 28px Cairo, sans-serif';
      ctx.fillText('امسح الكود لتصفح قوائم الأسعار وطلب خامات ورشتك', 600, 1075);

      ctx.fillStyle = '#D97706';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(suppliersMarketUrl, 600, 1115);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 34px Cairo, sans-serif';
      ctx.fillText('أسعار الجملة وشرائح الكميات · مقارنة الموردين لحظياً', 600, 1260);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 26px Cairo, sans-serif';
      ctx.fillText('ترحيل آلي لمخزن الورشة والخزينة فور تأكيد الاستلام', 600, 1320);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 30px Cairo, sans-serif';
      ctx.fillText('دعم التوريد بالمنظومة: 01000996059', 600, 1400);

      const link = document.createElement('a');
      link.download = 'بوستر_سوق_موردين_الشمساوية.png';
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      playSuccessSound();
      showSuccess('تم تنزيل بوستر سوق موردين الشمساوية للطباعة بنجاح.');
    } catch {
      showError('تعذر توليد بوستر سوق الموردين.');
    }
  };

  // Save Central Marketplace Control & Visual Builder Settings
  const handleSaveMarketControlSettings = async (extraMarketBuilder?: MarketplaceBuilderConfig) => {
    setSavingMarketSettings(true);
    try {
      const builderToSave = extraMarketBuilder || getStoredMarketBuilderConfig();
      saveShippingConfig(shippingConfig);
      setClientPrivacyActive(centralShippingPrivacy);
      if (extraMarketBuilder) {
        saveStoredMarketBuilderConfig(extraMarketBuilder);
      }

      const payload = {
        ...shippingConfig,
        centralShippingPrivacy,
        marketBuilder: builderToSave,
        suppliersMarketBuilder: getStoredSuppliersMarketBuilderConfig(),
        landingCms: getStoredLandingCmsConfig(),
        featureFlags: getStoredFeatureFlags(),
        uiLayoutConfig: getStoredUiLayoutConfig(),
        subscriptionPackagesConfig: getStoredSubscriptionPackagesConfig(),
      };
      const res = await savePlatformSettingsCloud(payload, profile.email);
      if (!res.success) {
        showError(res.error || 'تعذر مزامنة إعدادات السوق سحابياً');
        return;
      }
      playSuccessSound();
      showSuccess('تم حفظ ونشر إعدادات السوق وتخطيط المتجر سحابياً بنجاح.');
    } catch (err: any) {
      showError('تعذر حفظ الإعدادات: ' + (err?.message || 'خطأ'));
    } finally {
      setSavingMarketSettings(false);
    }
  };

  // Save Suppliers Marketplace (B2B) Builder & Policy Settings
  const handleSaveSuppliersMarketControlSettings = async (cfgToSave: SuppliersMarketBuilderConfig) => {
    setSavingMarketSettings(true);
    try {
      saveStoredSuppliersMarketBuilderConfig(cfgToSave);
      const payload = {
        ...shippingConfig,
        centralShippingPrivacy,
        marketBuilder: getStoredMarketBuilderConfig(),
        suppliersMarketBuilder: cfgToSave,
        landingCms: getStoredLandingCmsConfig(),
        featureFlags: getStoredFeatureFlags(),
        uiLayoutConfig: getStoredUiLayoutConfig(),
        subscriptionPackagesConfig: getStoredSubscriptionPackagesConfig(),
      };
      const res = await savePlatformSettingsCloud(payload, profile.email);
      if (!res.success) {
        showError(res.error || 'تعذر مزامنة إعدادات سوق موردين الشمساوية سحابياً');
        return;
      }
      playSuccessSound();
      showSuccess('تم حفظ ونشر إعدادات وتخصيص سوق موردين الشمساوية سحابياً بنجاح.');
    } catch (err: any) {
      showError('تعذر حفظ إعدادات سوق الموردين: ' + (err?.message || 'خطأ'));
    } finally {
      setSavingMarketSettings(false);
    }
  };

  // Approve / Reject Cloud Marketplace Products
  const handleApproveCloudProduct = async (prod: CloudMarketplaceProduct, stars = 5) => {
    const res = await reviewMarketplaceProduct(prod.id, 'approved', undefined, profile.email, {
      ratingStars: stars,
    });
    if (!res.success) {
      showError(res.error || 'تعذر اعتماد المنتج بالسوق');
      return;
    }
    playSuccessSound();
    showSuccess(`تم اعتماد "${prod.product_name}" ونشره في سوق الشمساوية.`);
    loadCloudMarketplaceProducts();
    loadAdminNotifications();
    window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
  };

  const handleConfirmRejectCloudProduct = async () => {
    if (!cloudRejectingProduct) return;
    const res = await reviewMarketplaceProduct(
      cloudRejectingProduct.id,
      'rejected',
      cloudRejectReason.trim() || 'يرجى مراجعة الصور والمواصفات قبل إعادة الرفع.',
      profile.email
    );
    if (!res.success) {
      showError(res.error || 'تعذر رفض المنتج');
      return;
    }
    playAlertSound();
    showSuccess(`تم إرجاع "${cloudRejectingProduct.product_name}" بملاحظات للورشة.`);
    setCloudRejectingProduct(null);
    setCloudRejectReason('');
    loadCloudMarketplaceProducts();
    loadAdminNotifications();
    window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
  };

  // Approve / Reject Workshop Applications
  const handleApproveApplication = async (app: any, customNotes?: string) => {
    try {
      const brand = app.brand_name || app.brandName || 'ورشة الشمساوية';
      const artist = app.artist_name || app.artistName || 'فنان الشمساوية';
      const phone = app.phone_number || app.phoneNumber || '';
      const email = app.email || '';
      const crafts = Array.isArray(app.crafts)
        ? app.crafts
        : typeof app.crafts === 'string'
        ? app.crafts.split(',').map((s: string) => s.trim())
        : ['macrame'];
      const wsId = isValidUuid(app.user_id)
        ? app.user_id
        : isValidUuid(app.workshop_id)
        ? app.workshop_id
        : crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const { error: appErr } = await supabase
        .from('workshop_applications')
        .update({
          status: 'approved',
          workshop_id: wsId,
          reviewed_at: nowIso,
          reviewer_email: profile.email || 'hmb.top.tube@gmail.com',
          review_notes: customNotes || 'تم الاعتماد الرسمي للورشة في المنظومة',
        })
        .eq('id', app.id);
      if (appErr) throw new Error(appErr.message);

      const { error: wsErr } = await supabase.from('workshops').upsert(
        {
          id: wsId,
          brand_name: brand,
          artist_name: artist,
          email,
          phone,
          country: app.country || 'مصر',
          currency: 'EGP',
          currency_symbol: 'ج.م',
          selected_crafts: crafts,
          status: 'active',
          is_frozen: false,
          store_slug: getWorkshopCleanSlug({ id: wsId, brandName: brand, artistName: artist }),
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );
      if (wsErr) throw new Error(wsErr.message);

      try {
        const headers = await getAdminAuthHeaders(true);
        await fetch('/api/admin/workshops', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: wsId,
            brandName: brand,
            artistName: artist,
            email,
            phoneNumber: phone,
            country: app.country || 'مصر',
            selectedCrafts: crafts,
            role: 'artisan',
          }),
        });
        await fetch('/api/admin/announcements', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            recipient_type: 'specific',
            recipient_workshop_id: wsId,
            title: `تم اعتماد ورشة "${brand}" في منظومة الشمساوية`,
            content: `مرحباً بك يا ${artist}! تم اعتماد طلب انضمام ورشتك رسمياً وتفعيل حسابك ومتجرك داخل منظومة الشمساوية.`,
          }),
        });
      } catch {}

      setWorkshopApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'approved', workshop_id: wsId } : a))
      );
      playSuccessSound();
      showSuccess(`تم اعتماد ورشة "${brand}" وتفعيلها بنجاح.`);
      loadWorkshops(true);
      loadMessagingHub();
    } catch (e: any) {
      showError('تعذر اعتماد الورشة: ' + (e.message || 'خطأ'));
    }
  };

  const handleRejectApplication = async (app: any, reason: string) => {
    try {
      const { error } = await supabase
        .from('workshop_applications')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewer_email: profile.email || 'hmb.top.tube@gmail.com',
          review_notes: reason || 'نعتذر، لم يستوفِ الطلب معايير الانضمام حالياً',
        })
        .eq('id', app.id);
      if (error) throw new Error(error.message);

      setWorkshopApplications((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'rejected', review_notes: reason } : a))
      );
      playAlertSound();
      showSuccess('تم رفض الطلب وتسجيل الملاحظات بنجاح.');
    } catch (e: any) {
      showError('تعذر تحديث حالة الطلب: ' + (e.message || 'خطأ'));
    }
  };

  // Credentials & Editing
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = 'Shams@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pwd += '#26';
    setEditNewPassword(pwd);
  };

  const [overridingCredentials, setOverridingCredentials] = useState(false);

  const handleCredentialOverride = async (ws: WorkshopProfile) => {
    if (!ws) return;
    if (!editNewPassword && !ws.email && !ws.phoneNumber) {
      showError('يرجى إدخال كلمة سر جديدة أو تحديث البريد أو الهاتف');
      return;
    }

    setOverridingCredentials(true);
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/workshops/${ws.id}/credentials`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: ws.email,
          newEmail: ws.email,
          phoneNumber: ws.phoneNumber,
          newPhone: ws.phoneNumber,
          password: editNewPassword || undefined,
          newPassword: editNewPassword || undefined,
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resJson.error || 'فشل تحديث بيانات الدخول');

      playSuccessSound();
      setCredentialSuccessModal({
        brandName: ws.brandName,
        artistName: ws.artistName,
        email: ws.email,
        phone: ws.phoneNumber || '',
        password: editNewPassword || 'تم تثبيت البريد والهاتف بدون تغيير كلمة السر',
      });
      showSuccess(`تم تحديث بيانات الدخول لورشة "${ws.brandName}" بنجاح.`);
      setEditNewPassword('');
    } catch (err: any) {
      showError('تعذر تحديث بيانات الدخول: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setOverridingCredentials(false);
    }
  };

  // Gamification Award
  const handleSaveAward = async () => {
    if (!awardingWorkshop) return;
    setSavingAward(true);
    const awardedAt = new Date().toISOString();
    const medalArabic =
      selectedMedal === 'diamond'
        ? 'الماسية'
        : selectedMedal === 'gold'
        ? 'الذهبية'
        : selectedMedal === 'silver'
        ? 'الفضية'
        : 'البرونزية';

    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/workshops/${awardingWorkshop.id}/award`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rating_stars: selectedStars,
          medal: selectedMedal,
          custom_note: awardCustomNote,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'تعذر حفظ التكريم على الخادم');
      }

      try {
        await supabase
          .from('workshops')
          .update({
            rating_stars: selectedStars,
            medal: selectedMedal,
            medal_awarded_at: awardedAt,
            medal_note: awardCustomNote || null,
            updated_at: awardedAt,
          })
          .eq('id', awardingWorkshop.id);
      } catch {}

      await tenantStorage
        .putNotification({
          id: `notif_${Date.now()}`,
          tenantId: awardingWorkshop.id,
          type: 'system',
          title: `تهنئة رسمية: منح ورشتكم قلادة الشمساوية ${medalArabic}`,
          message: `قررت إدارة منظومة الشمساوية منح ورشتكم [${awardingWorkshop.brandName}] تقييم ${selectedStars} نجوم وقلادة ${medalArabic}.${
            awardCustomNote ? `\n"${awardCustomNote}"` : ''
          }`,
          isRead: false,
          createdAt: Date.now(),
        })
        .catch(() => null);

      playSuccessSound();
      setWorkshops((prev) =>
        prev.map((w) =>
          w.id === awardingWorkshop.id
            ? {
                ...w,
                rating_stars: selectedStars,
                ratingStars: selectedStars,
                medal: selectedMedal,
                medal_awarded_at: awardedAt,
                medalAwardedAt: awardedAt,
                medal_note: awardCustomNote,
                medalNote: awardCustomNote,
              }
            : w
        )
      );
      loadMessagingHub();
      showSuccess(`تم منح ورشة "${awardingWorkshop.brandName}" القلادة ${medalArabic} بنجاح.`);
      setAwardingWorkshop(null);
      setAwardCustomNote('');
    } catch (err: any) {
      showError('تعذر حفظ التكريم: ' + (err.message || 'خطأ'));
    } finally {
      setSavingAward(false);
    }
  };

  // Audit Modal Handler
  const handleOpenAudit = async (ws: WorkshopProfile) => {
    setAuditingWorkshop(ws);
    setLoadingAudit(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/admin/workshops/${ws.id}/audit`, {
        headers: {
          'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setAuditData(await res.json());
      } else {
        setAuditData({
          workshopId: ws.id,
          brandName: ws.brandName,
          artistName: ws.artistName,
          lastActiveDate: ws.updatedAt
            ? new Date(ws.updatedAt).toLocaleDateString('ar-EG', { dateStyle: 'full' })
            : 'نشط مؤخراً',
          productsCount: (ws as EnrichedWorkshopProfile).productsCount ?? 0,
          marketplaceProductsCount: (ws as EnrichedWorkshopProfile).marketplaceProductsCount ?? 0,
          materialsCount: 0,
          ordersCount: (ws as EnrichedWorkshopProfile).ordersCount ?? 0,
          rating_stars: ws.rating_stars || 5,
          medal: ws.medal || null,
        });
      }
    } catch {
      setAuditData({
        workshopId: ws.id,
        brandName: ws.brandName,
        artistName: ws.artistName,
        lastActiveDate: 'نشط مؤخراً',
        productsCount: (ws as EnrichedWorkshopProfile).productsCount ?? 0,
        marketplaceProductsCount: (ws as EnrichedWorkshopProfile).marketplaceProductsCount ?? 0,
        materialsCount: 0,
        ordersCount: (ws as EnrichedWorkshopProfile).ordersCount ?? 0,
      });
    } finally {
      setLoadingAudit(false);
    }
  };

  // Edit Workshop Save
  const handleSaveEditedWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkshop) return;
    setSavingAction(true);
    try {
      const updatedSlug = getWorkshopCleanSlug(editingWorkshop);
      const updated: WorkshopProfile = {
        ...editingWorkshop,
        storeSlug: updatedSlug,
        updatedAt: Date.now(),
      };
      const nowIso = new Date().toISOString();

      const [wsRes] = await Promise.all([
        supabase
          .from('workshops')
          .update({
            brand_name: updated.brandName,
            artist_name: updated.artistName,
            email: updated.email,
            phone: updated.phoneNumber,
            country: updated.country || 'مصر',
            currency: updated.currency || 'EGP',
            currency_symbol: updated.currencySymbol || 'ج.م',
            store_slug: updatedSlug,
            status: updated.status || 'active',
            updated_at: nowIso,
          })
          .eq('id', updated.id),
        supabase
          .from('profiles')
          .update({
            name: updated.artistName || updated.brandName,
            email: updated.email,
            phone: updated.phoneNumber,
            status: updated.status || 'active',
            role: updated.role || 'artisan',
          })
          .eq('id', updated.id),
      ]);

      const headers = await getAdminAuthHeaders(true);
      const apiRes = await fetch(`/api/admin/workshops/${updated.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      if (!apiRes.ok && wsRes.error) {
        const errJson = await apiRes.json().catch(() => ({}));
        throw new Error(errJson.error || wsRes.error.message || 'تعذر حفظ تعديلات الورشة');
      }

      await tenantStorage.saveProfile(updated);
      setWorkshops((prev) => prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
      if (updated.id === profile.id && onProfileUpdated) {
        onProfileUpdated(updated);
      }

      loadWorkshops(true);
      playSuccessSound();
      showSuccess(`تم تحديث بيانات ورشة "${updated.brandName}" بنجاح.`);
      setEditingWorkshop(null);
    } catch (err: any) {
      showError('تعذر تحديث الورشة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSavingAction(false);
    }
  };

  // Suspend / Ban / Reactivate
  const handleExecuteSuspension = async () => {
    if (!editingWorkshop) return;
    if (!suspensionReasonInput.trim()) {
      showError('سبب الإيقاف المؤقت إجباري');
      return;
    }
    setSavingAction(true);
    try {
      let suspendedUntilMs: number | null = null;
      const now = Date.now();
      if (suspensionDurationChoice === '24 ساعة') suspendedUntilMs = now + 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === '3 أيام') suspendedUntilMs = now + 3 * 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === 'أسبوع') suspendedUntilMs = now + 7 * 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === 'أسبوعين') suspendedUntilMs = now + 14 * 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === 'شهر') suspendedUntilMs = now + 30 * 24 * 60 * 60 * 1000;

      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/workshops/${editingWorkshop.id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: 'suspended',
          suspension_reason: suspensionReasonInput.trim(),
          suspension_duration: suspensionDurationChoice,
          suspended_until: suspendedUntilMs ? new Date(suspendedUntilMs).toISOString() : null,
        }),
      });
      const errJson = !res.ok ? await res.json().catch(() => ({})) : {};
      if (!res.ok) throw new Error(errJson.error || 'تعذر إيقاف الورشة');

      setWorkshops((prev) =>
        prev.map((w) =>
          w.id === editingWorkshop.id
            ? {
                ...w,
                status: 'suspended',
                isFrozen: true,
                suspension_reason: suspensionReasonInput.trim(),
                suspension_duration: suspensionDurationChoice,
              }
            : w
        )
      );
      loadWorkshops(true);
      playAlertSound();
      showSuccess(`تم إيقاف ورشة "${editingWorkshop.brandName}" مؤقتاً.`);
      setIsSuspendingModalOpen(false);
      setEditingWorkshop(null);
      setSuspensionReasonInput('');
    } catch (err: any) {
      showError('خطأ أثناء تنفيذ الإيقاف: ' + err.message);
    } finally {
      setSavingAction(false);
    }
  };

  const handleExecuteBan = async () => {
    if (!editingWorkshop) return;
    if (!banReasonInput.trim()) {
      showError('سبب الحظر الكامل إجباري');
      return;
    }
    setSavingAction(true);
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/workshops/${editingWorkshop.id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: 'banned',
          suspension_reason: banReasonInput.trim(),
          suspension_duration: 'حظر دائم',
          suspended_until: null,
        }),
      });
      const errJson = !res.ok ? await res.json().catch(() => ({})) : {};
      if (!res.ok) throw new Error(errJson.error || 'تعذر حظر الورشة');

      setWorkshops((prev) =>
        prev.map((w) =>
          w.id === editingWorkshop.id
            ? {
                ...w,
                status: 'banned',
                isFrozen: true,
                suspension_reason: banReasonInput.trim(),
                suspension_duration: 'حظر دائم',
              }
            : w
        )
      );
      loadWorkshops(true);
      playAlertSound();
      showSuccess(`تم حظر ورشة "${editingWorkshop.brandName}" وإخفاء متجرها.`);
      setIsBanningModalOpen(false);
      setEditingWorkshop(null);
      setBanReasonInput('');
    } catch (err: any) {
      showError('خطأ أثناء تنفيذ الحظر: ' + err.message);
    } finally {
      setSavingAction(false);
    }
  };

  const handleReactivateWorkshop = async (targetWs: WorkshopProfile) => {
    setSavingAction(true);
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/workshops/${targetWs.id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: 'active' }),
      });
      const errJson = !res.ok ? await res.json().catch(() => ({})) : {};
      if (!res.ok) throw new Error(errJson.error || 'تعذر إعادة تفعيل الورشة');

      setWorkshops((prev) =>
        prev.map((w) =>
          w.id === targetWs.id
            ? {
                ...w,
                status: 'active',
                isFrozen: false,
                suspension_reason: undefined,
                suspension_duration: undefined,
                suspended_until: null,
              }
            : w
        )
      );
      loadWorkshops(true);
      playSuccessSound();
      showSuccess(`تم إعادة تفعيل ورشة "${targetWs.brandName}" ومتجرها بنجاح.`);
      setEditingWorkshop(null);
    } catch (err: any) {
      showError('تعذر التفعيل: ' + err.message);
    } finally {
      setSavingAction(false);
    }
  };

  const handleToggleWorkshopVisibility = async (
    targetWs: EnrichedWorkshopProfile,
    field: 'hideStorefront' | 'hideFromMarket'
  ) => {
    const currentVal =
      field === 'hideStorefront'
        ? Boolean(targetWs.hideStorefront || targetWs.hide_storefront)
        : Boolean(targetWs.hideFromMarket || targetWs.hide_from_market);
    const nextVal = !currentVal;

    // Optimistic update
    setWorkshops((prev) =>
      prev.map((w) => {
        if (w.id !== targetWs.id) return w;
        if (field === 'hideStorefront') {
          return { ...w, hideStorefront: nextVal, hide_storefront: nextVal };
        }
        return { ...w, hideFromMarket: nextVal, hide_from_market: nextVal };
      })
    );

    const payload =
      field === 'hideStorefront' ? { hideStorefront: nextVal } : { hideFromMarket: nextVal };
    const res = await updateWorkshopVisibility(targetWs.id, payload, profile.email);
    if (!res.success) {
      // Revert optimistic change on failure
      setWorkshops((prev) =>
        prev.map((w) => {
          if (w.id !== targetWs.id) return w;
          if (field === 'hideStorefront') {
            return { ...w, hideStorefront: currentVal, hide_storefront: currentVal };
          }
          return { ...w, hideFromMarket: currentVal, hide_from_market: currentVal };
        })
      );
      showError(res.error || 'تعذر تحديث إعدادات الظهور للورشة');
      return;
    }

    playSuccessSound();
    if (field === 'hideStorefront') {
      showSuccess(
        nextVal
          ? `تم إخفاء المتجر الخاص لورشة "${targetWs.brandName}" عن الزوار مع بقاء حسابها الداخلي نشطاً.`
          : `تم إعادة إظهار المتجر الخاص لورشة "${targetWs.brandName}" بنجاح.`
      );
    } else {
      showSuccess(
        nextVal
          ? `تم إخفاء معروضات ورشة "${targetWs.brandName}" من سوق الشمساوية المركزي.`
          : `تم إعادة إظهار معروضات ورشة "${targetWs.brandName}" في سوق الشمساوية المركزي.`
      );
    }
  };

  // Appeals
  const handleAcceptAppeal = async (appealItem: any) => {
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/workshops/${appealItem.id}/appeal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ appeal_status: 'accepted' }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'فشل قبول الطعن');
      }
      playSuccessSound();
      showSuccess(`تم قبول طعن ورشة "${appealItem.brand_name || 'الورشة'}" وإعادة تفعيلها.`);
      loadAppeals();
      loadWorkshops(true);
    } catch (err: any) {
      showError('تعذر قبول الطعن: ' + err.message);
    }
  };

  const handleConfirmRejectAppeal = async () => {
    if (!rejectingAppealWorkshop) return;
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/workshops/${rejectingAppealWorkshop.id}/appeal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          appeal_status: 'rejected',
          rejection_reason:
            rejectionReasonInput.trim() || 'تم رفض الطعن بعد مراجعة سجلات الورشة.',
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'فشل رفض الطعن');
      }
      playAlertSound();
      showSuccess(`تم رفض طعن ورشة "${rejectingAppealWorkshop.brand_name || 'الورشة'}".`);
      setRejectingAppealWorkshop(null);
      setRejectionReasonInput('');
      loadAppeals();
      loadWorkshops(true);
    } catch (err: any) {
      showError('تعذر رفض الطعن: ' + err.message);
    }
  };

  // Messaging & Notifications
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) {
      showError('عنوان ونص الرسالة مطلوبان');
      return;
    }
    if (newAnnRecipientType === 'specific' && !newAnnRecipientWorkshopId) {
      showError('يرجى تحديد الورشة المستلمة');
      return;
    }

    setSendingAnnouncement(true);
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipient_type: newAnnRecipientType,
          recipient_workshop_id: newAnnRecipientType === 'specific' ? newAnnRecipientWorkshopId : null,
          title: newAnnTitle.trim(),
          content: newAnnContent.trim(),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'تعذر إرسال التوجيه');
      }
      playSuccessSound();
      showSuccess('تم إرسال الرسالة عبر مركز المراسلات بنجاح.');
      setNewAnnTitle('');
      setNewAnnContent('');
      setNewAnnRecipientWorkshopId('');
      loadMessagingHub();
    } catch (err: any) {
      showError('تعذر إرسال الرسالة: ' + err.message);
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    setDeletingAnnId(annId);
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch(`/api/admin/announcements/${annId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'تعذر حذف الرسالة');
      }
      setAnnouncementsList((prev) => prev.filter((a) => a.id !== annId));
      playAlertSound();
      showSuccess('تم حذف التوجيه من سجل المراسلات.');
    } catch (err: any) {
      showError('تعذر حذف الرسالة: ' + err.message);
    } finally {
      setDeletingAnnId(null);
    }
  };

  const handleSendDirectReply = async (targetMsg: any) => {
    const targetWid = targetMsg?.workshop_id || targetMsg?.workshops?.id || '';
    if (!targetWid || !isValidUuid(targetWid)) {
      showError('لا يوجد معرف ورشة صالح للرد الداخلي — استخدم واتساب للتواصل الخارجي.');
      return;
    }
    if (!directReplyContent.trim()) {
      showError('يرجى كتابة نص الرد');
      return;
    }
    setSendingAnnouncement(true);
    try {
      const headers = await getAdminAuthHeaders(true);
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipient_type: 'specific',
          recipient_workshop_id: targetWid,
          recipient_workshop_name: targetMsg?.workshops?.brand_name || targetMsg?.brand_name || '',
          title: 'رد إداري مباشر على استفساركم',
          content: directReplyContent.trim(),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'تعذر إرسال الرد المباشر');
      }
      playSuccessSound();
      showSuccess(`تم إرسال الرد المباشر إلى "${targetMsg.workshops?.brand_name || 'الفنان'}".`);
      setDirectReplyTarget(null);
      setDirectReplyContent('');
      loadMessagingHub();
    } catch (err: any) {
      showError('تعذر إرسال الرد: ' + err.message);
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    setAdminAlerts((prev) => prev.filter((a) => a.id !== alertId));
    try {
      const headers = await getAdminAuthHeaders();
      await fetch(`/api/admin/notifications/${encodeURIComponent(alertId)}`, {
        method: 'DELETE',
        headers,
      });
      window.dispatchEvent(new CustomEvent('alshams_admin_alerts_changed'));
    } catch {}
  };

  // Selective Deletion
  const handleSelectiveDeleteWorkshop = async () => {
    if (!deletingWorkshop) return;
    if (deletingWorkshop.id === profile.id && selectiveDeleteMode === 'cascade') {
      showError('لا يمكنك حذف ورشتك الحالية كلياً من لوحة التحكم.');
      return;
    }
    if (deleteConfirmText.trim() !== deletingWorkshop.brandName.trim()) {
      showError(`يرجى كتابة اسم الورشة بالكامل للتأكيد: "${deletingWorkshop.brandName}"`);
      return;
    }

    setSavingAction(true);
    try {
      if (selectiveDeleteMode === 'cascade') {
        try {
          await supabase.from('workshops').delete().eq('id', deletingWorkshop.id);
          await supabase.from('profiles').delete().eq('id', deletingWorkshop.id);
          if (deletingWorkshop.ownerUid) {
            await supabase.from('profiles').delete().eq('id', deletingWorkshop.ownerUid);
          }
        } catch {}
      }

      const headers = await getAdminAuthHeaders(true);
      const delRes = await fetch(`/api/admin/workshops/${deletingWorkshop.id}/selective-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: selectiveDeleteMode }),
      });
      if (!delRes.ok) {
        const errJson = await delRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'تعذر تنفيذ عملية التصفير/الحذف على الخادم');
      }

      if (selectiveDeleteMode === 'cascade') {
        await tenantStorage.deleteProfile(deletingWorkshop.id);
        setWorkshops((prev) => prev.filter((w) => w.id !== deletingWorkshop.id));
        loadWorkshops(true);
        showSuccess(`تم حذف ورشة "${deletingWorkshop.brandName}" نهائياً.`);
      } else {
        showSuccess(`تم تنفيذ التصفير الجزئي لورشة "${deletingWorkshop.brandName}" بنجاح.`);
        if (selectedWorkshopId === deletingWorkshop.id) loadDeepData(deletingWorkshop.id);
      }
      playAlertSound();
      setDeletingWorkshop(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      showError('تعذر تنفيذ العملية: ' + (err.message || 'خطأ'));
    } finally {
      setSavingAction(false);
    }
  };

  // Create New Workshop
  const handleCreateNewWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim() || !newArtistName.trim()) {
      showError('اسم البراند واسم الفنان مطلوبان');
      return;
    }
    setSavingAction(true);
    try {
      const generatedId = crypto.randomUUID();
      const countryConfig =
        COUNTRIES_CONFIG.find((c) => c.name === newCountry) || COUNTRIES_CONFIG[0];
      const brandClean = newBrandName.trim();
      const artistClean = newArtistName.trim();
      const storeSlug = getWorkshopCleanSlug({
        id: generatedId,
        brandName: brandClean,
        artistName: artistClean,
      });

      const newWs: EnrichedWorkshopProfile = {
        id: generatedId,
        workshopId: generatedId,
        ownerUid: generatedId,
        email: newEmail.trim() || `ws-${generatedId.slice(0, 8)}@alshams.craft`,
        brandName: brandClean,
        artistName: artistClean,
        gender: 'female',
        phoneNumber: newPhone.trim(),
        country: countryConfig.name,
        currency: countryConfig.currency,
        currencySymbol: countryConfig.currencySymbol,
        callingCode: countryConfig.callingCode,
        storeSlug,
        selectedCrafts: ['macrame'],
        defaultVatPercent: 14,
        showTaxInfoOnInvoice: false,
        role: newRole,
        status: 'active',
        isFrozen: false,
        welcomeShown: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: profile.email || 'admin',
        productsCount: 0,
        marketplaceProductsCount: 0,
        ordersCount: 0,
        totalCatalogAndShowcase: 0,
        activityScore: 0,
      };

      const nowIso = new Date(newWs.createdAt).toISOString();
      const [wsUpsertRes] = await Promise.all([
        supabase.from('workshops').upsert(
          {
            id: newWs.id,
            brand_name: newWs.brandName,
            artist_name: newWs.artistName,
            email: newWs.email,
            phone: newWs.phoneNumber,
            country: newWs.country,
            currency: newWs.currency,
            currency_symbol: newWs.currencySymbol,
            store_slug: storeSlug,
            selected_crafts: newWs.selectedCrafts,
            status: 'active',
            is_frozen: false,
            created_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        ),
        supabase.from('profiles').upsert(
          {
            id: newWs.id,
            name: newWs.artistName || newWs.brandName,
            email: newWs.email,
            phone: newWs.phoneNumber,
            role: newWs.role,
            status: 'active',
            created_at: nowIso,
          },
          { onConflict: 'id' }
        ),
      ]);

      const headers = await getAdminAuthHeaders(true);
      const serverRes = await fetch('/api/admin/workshops', {
        method: 'POST',
        headers,
        body: JSON.stringify(newWs),
      });
      if (!serverRes.ok && wsUpsertRes.error) {
        const errJson = await serverRes.json().catch(() => ({}));
        throw new Error(errJson.error || wsUpsertRes.error.message || 'تعذر حفظ الورشة');
      }

      await tenantStorage.saveProfile(newWs);
      setWorkshops((prev) => [newWs, ...prev]);
      playSuccessSound();
      showSuccess(`تم تسجيل ورشة "${newWs.brandName}" بنجاح.`);
      setNewBrandName('');
      setNewArtistName('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('artisan');
      setIsNewWorkshopModalOpen(false);
    } catch (err: any) {
      showError('تعذر إنشاء الورشة: ' + (err.message || 'خطأ'));
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveMaterialPrice = async () => {
    if (!editingMaterial || !newMaterialPrice) return;
    const priceNum = parseFloat(newMaterialPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      showError('يرجى إدخال سعر صحيح');
      return;
    }
    try {
      if (deepData?.materials) {
        const updatedList = deepData.materials.map((m) =>
          m.id === editingMaterial.id
            ? { ...m, unit_cost: priceNum, price: priceNum, cost: priceNum }
            : m
        );
        setDeepData({ ...deepData, materials: updatedList });
      }
      playSuccessSound();
      setEditingMaterial(null);
      setNewMaterialPrice('');
    } catch (err: any) {
      showError('تعذر تعديل السعر: ' + err.message);
    }
  };

  // Access Denied Screen
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-rose-300 dark:border-rose-900/60 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-xl font-black text-[#0C1427] dark:text-[#F7F3EA]">منطقة المسؤولين فقط</h2>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
            عذراً، هذه الشاشة مخصصة لإدارة المنظومة. الحساب الحالي لا يمتلك صلاحيات الإشراف.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="w-full py-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowRight size={16} />
            <span>العودة للصفحة الرئيسية</span>
          </button>
        </div>
      </div>
    );
  }

  // Initial Loading Screen
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4" dir="rtl">
        <div className="w-12 h-12 border-4 border-[#D4CCBC] dark:border-[#22355E] border-t-[#EA580C] rounded-full animate-spin" />
        <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
          جاري تحميل لوحة التحكم التنفيذية...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] text-[#0C1427] dark:text-[#F7F3EA]">
      {/* Global Compact Feedback Banners (Toast / Success / Error) */}
      {(realtimeToast || successNotice || errorMsg) && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 space-y-2">
          {realtimeToast && (
            <div className="p-3 rounded-2xl bg-[#FFEDD5] dark:bg-[#132040] border border-[#EA580C]/40 text-xs font-black flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
                <span>{realtimeToast}</span>
              </div>
              <button type="button" onClick={() => setRealtimeToast(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
              <button type="button" onClick={() => setSuccessNotice('')} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button type="button" onClick={() => setErrorMsg('')} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Page Router */}
      {currentPage === 'home' && (
        <AdminHomeView
          workshops={workshops}
          selectedWorkshopId={selectedWorkshopId}
          onSelectWorkshopId={setSelectedWorkshopId}
          onNavigatePage={handleNavigatePage}
          onOpenNewWorkshop={() => setIsNewWorkshopModalOpen(true)}
          pendingApplicationsCount={pendingApplicationsCount}
          pendingProductsCount={pendingProductsCount}
          pendingAppealsCount={pendingAppealsCount}
          onActivateWorkshopContext={onSelectActiveWorkshop}
          onEditWorkshop={(ws) => setEditingWorkshop(ws)}
          onSuspendWorkshop={(ws) => {
            setEditingWorkshop(ws);
            setIsSuspendingModalOpen(true);
          }}
          onBanWorkshop={(ws) => {
            setEditingWorkshop(ws);
            setIsBanningModalOpen(true);
          }}
          onReactivateWorkshop={handleReactivateWorkshop}
          onOpenAudit={handleOpenAudit}
          onToggleWorkshopVisibility={handleToggleWorkshopVisibility}
          onOpenLandingDesignInjector={() => {
            setLandingCmsInitialTab('design_injector');
            handleNavigatePage('landing_cms');
          }}
          syncingMaterialsToDb={syncingMaterialsToDb}
          onSyncUnifiedMaterialsToDb={handleSyncUnifiedMaterialsToDb}
        />
      )}

      <Suspense fallback={<AdminSubViewFallback />}>
      {currentPage === 'workshops' && (
        <AdminWorkshopsPage
          workshops={workshops}
          refreshing={refreshing}
          onBack={() => handleNavigatePage('home')}
          onRefresh={() => loadWorkshops(false)}
          onOpenNewWorkshop={() => setIsNewWorkshopModalOpen(true)}
          onExportCsv={exportSystemReportCSV}
          onActivateWorkshopContext={onSelectActiveWorkshop}
          onOpenAudit={handleOpenAudit}
          onOpenAward={(ws) => {
            setAwardingWorkshop(ws);
            setSelectedStars(ws.rating_stars || 5);
            setSelectedMedal((ws.medal as any) || 'gold');
            setAwardCustomNote(ws.medal_note || '');
          }}
          onEditWorkshop={(ws) => setEditingWorkshop(ws)}
          onSuspendWorkshop={(ws) => {
            setEditingWorkshop(ws);
            setIsSuspendingModalOpen(true);
          }}
          onBanWorkshop={(ws) => {
            setEditingWorkshop(ws);
            setIsBanningModalOpen(true);
          }}
          onReactivateWorkshop={handleReactivateWorkshop}
          onDeleteWorkshop={(ws) => {
            setDeletingWorkshop(ws);
            setDeleteConfirmText('');
            setSelectiveDeleteMode('cascade');
          }}
          onToggleWorkshopVisibility={handleToggleWorkshopVisibility}
        />
      )}

      {currentPage === 'customers' && (
        <AdminCustomersPage
          userEmail={profile.email}
          workshops={workshops}
          onBack={() => handleNavigatePage('home')}
        />
      )}

      {currentPage === 'suppliers' && (
        <AdminSuppliersPage
          userEmail={profile.email}
          onBack={() => handleNavigatePage('home')}
          onNotifySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onNotifyError={showError}
        />
      )}

      {currentPage === 'marketplace' && (
        <AdminMarketplaceBuilderPage
          onBack={() => handleNavigatePage('home')}
          cloudProducts={cloudProductsForReview}
          ordersList={marketplaceOrdersList}
          workshops={workshops}
          shippingConfig={shippingConfig}
          setShippingConfig={setShippingConfig}
          centralShippingPrivacy={centralShippingPrivacy}
          onToggleCentralPrivacy={(nextVal) => {
            setCentralShippingPrivacy(nextVal);
            setClientPrivacyActive(nextVal);
            savePlatformSettingsCloud(
              {
                ...shippingConfig,
                centralShippingPrivacy: nextVal,
                marketBuilder: getStoredMarketBuilderConfig(),
                landingCms: getStoredLandingCmsConfig(),
                featureFlags: getStoredFeatureFlags(),
                uiLayoutConfig: getStoredUiLayoutConfig(),
                subscriptionPackagesConfig: getStoredSubscriptionPackagesConfig(),
              },
              profile.email
            ).catch(() => {});
          }}
          onSaveMarketControlSettings={handleSaveMarketControlSettings}
          savingMarketSettings={savingMarketSettings}
          onUpdateMarketOrderStatus={async (orderId, updates) => {
            await updateCentralMarketplaceOrderStatus(orderId, updates, profile.email);
            setMarketplaceOrdersList(getCentralMarketplaceOrders());
            playSuccessSound();
            showSuccess('تم تحديث حالة الطلبية بنجاح.');
          }}
          onApproveCloudProduct={(prod) => handleApproveCloudProduct(prod, 5)}
          onRejectCloudProduct={(prod) => {
            setCloudRejectingProduct(prod);
            setCloudRejectReason('');
          }}
          centralMarketUrl={centralMarketUrl}
          onCopyMarketUrl={handleCopyMarketUrl}
          onShareMarketWhatsApp={handleShareMarketWhatsApp}
          onDownloadMarketPoster={handleDownloadMarketPoster}
          onNotifySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onNotifyError={showError}
        />
      )}

      {currentPage === 'suppliers_market' && (
        <AdminSuppliersMarketPage
          userEmail={profile.email}
          onBack={() => handleNavigatePage('home')}
          onSaveSuppliersMarketSettings={handleSaveSuppliersMarketControlSettings}
          savingMarketSettings={savingMarketSettings}
          suppliersMarketUrl={suppliersMarketUrl}
          onCopySuppliersMarketUrl={handleCopySuppliersMarketUrl}
          onShareSuppliersMarketWhatsApp={handleShareSuppliersMarketWhatsApp}
          onDownloadSuppliersMarketPoster={handleDownloadSuppliersMarketPoster}
          onNotifySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onNotifyError={showError}
        />
      )}

      {currentPage === 'stores' && (
        <AdminStoresPage
          workshops={workshops}
          cloudProducts={cloudProductsForReview}
          onBack={() => handleNavigatePage('home')}
          onActivateWorkshopContext={onSelectActiveWorkshop}
          onSuspendWorkshop={(ws) => {
            setEditingWorkshop(ws);
            setIsSuspendingModalOpen(true);
          }}
          onReactivateWorkshop={handleReactivateWorkshop}
          onCopySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onToggleWorkshopVisibility={handleToggleWorkshopVisibility}
        />
      )}

      {currentPage === 'catalogs' && (
        <AdminCatalogsPage
          workshops={workshops}
          selectedWorkshopId={selectedWorkshopId}
          onSelectWorkshopId={setSelectedWorkshopId}
          deepData={deepData}
          deepDataLoading={deepDataLoading}
          initialSubTab={catalogSubTab}
          onReloadDeepData={loadDeepData}
          onEditMaterialPrice={(mat) => {
            setEditingMaterial(mat);
            setNewMaterialPrice(String(mat.unit_cost ?? mat.price ?? mat.cost ?? ''));
          }}
          onBack={() => handleNavigatePage('home')}
        />
      )}

      {currentPage === 'applications' && (
        <AdminApplicationsPage
          applications={workshopApplications}
          loading={loadingApplications}
          onBack={() => handleNavigatePage('home')}
          onRefresh={loadWorkshopApplications}
          onApprove={handleApproveApplication}
          onReject={handleRejectApplication}
          onCopyInviteSuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
        />
      )}

      {currentPage === 'product_approvals' && (
        <AdminProductApprovalsPage
          products={cloudProductsForReview}
          workshops={workshops}
          loading={loadingCloudProducts}
          onBack={() => handleNavigatePage('home')}
          onRefresh={loadCloudMarketplaceProducts}
          onApproveProduct={handleApproveCloudProduct}
          onRejectProductModal={(prod) => {
            setCloudRejectingProduct(prod);
            setCloudRejectReason('');
          }}
          onDownloadMarketPoster={handleDownloadMarketPoster}
        />
      )}

      {currentPage === 'appeals' && (
        <AdminAppealsPage
          appeals={appealsList}
          loading={appealsLoading}
          onBack={() => handleNavigatePage('home')}
          onRefresh={loadAppeals}
          onAcceptAppeal={handleAcceptAppeal}
          onOpenRejectAppeal={(item) => {
            setRejectingAppealWorkshop(item);
            setRejectionReasonInput('');
          }}
        />
      )}

      {currentPage === 'reports' && (
        <AdminReportsPage
          workshops={workshops}
          cloudProducts={cloudProductsForReview}
          ordersList={marketplaceOrdersList}
          onBack={() => handleNavigatePage('home')}
          onExportCsv={exportSystemReportCSV}
        />
      )}

      {currentPage === 'landing_cms' && (
        <AdminLandingCmsPage
          initialTab={landingCmsInitialTab}
          onBack={() => {
            setLandingCmsInitialTab('header_hero');
            handleNavigatePage('home');
          }}
          saving={savingMarketSettings}
          onSaveToCloud={async (nextCms: LandingCmsConfig) => {
            setSavingMarketSettings(true);
            try {
              const res = await savePlatformSettingsCloud(
                {
                  ...shippingConfig,
                  centralShippingPrivacy: centralShippingPrivacy,
                  marketBuilder: getStoredMarketBuilderConfig(),
                  suppliersMarketBuilder: getStoredSuppliersMarketBuilderConfig(),
                  landingCms: nextCms,
                  featureFlags: getStoredFeatureFlags(),
                  uiLayoutConfig: getStoredUiLayoutConfig(),
                  subscriptionPackagesConfig: getStoredSubscriptionPackagesConfig(),
                },
                profile.email
              );
              if (!res.success) {
                const msg = res.error || 'تعذر حفظ تعديلات صفحة الهبوط والشعارات على السيرفر.';
                showError(msg);
                throw new Error(msg);
              }
              if (res.cloudSynced) {
                showSuccess('تم حفظ ونشر تعديلات صفحة الهبوط والشعارات سحابياً لجميع الحسابات ✅');
              } else {
                showSuccess('تم الحفظ على السيرفر المحلي (تنبيه: تعذر التزامن السحابي الكامل، تأكد من تسجيل الدخول).');
              }
            } catch (err: any) {
              showError(err?.message || 'حدث خطأ أثناء حفظ إعدادات صفحة الهبوط.');
              throw err;
            } finally {
              setSavingMarketSettings(false);
            }
          }}
        />
      )}

      {currentPage === 'feature_visibility' && (
        <AdminFeatureVisibilityPage
          onBack={() => handleNavigatePage('home')}
          saving={savingMarketSettings}
          onSaveToCloud={async (nextFlags: PlatformFeatureFlags, nextCms: LandingCmsConfig) => {
            setSavingMarketSettings(true);
            try {
              const res = await savePlatformSettingsCloud(
                {
                  ...shippingConfig,
                  centralShippingPrivacy: centralShippingPrivacy,
                  marketBuilder: getStoredMarketBuilderConfig(),
                  suppliersMarketBuilder: getStoredSuppliersMarketBuilderConfig(),
                  landingCms: nextCms,
                  featureFlags: nextFlags,
                  uiLayoutConfig: getStoredUiLayoutConfig(),
                  subscriptionPackagesConfig: getStoredSubscriptionPackagesConfig(),
                },
                profile.email
              );
              if (!res.success) {
                const msg = res.error || 'تعذر حفظ إعدادات الظهور والإخفاء على السيرفر.';
                showError(msg);
                throw new Error(msg);
              }
              showSuccess(
                res.cloudSynced
                  ? 'تم حفظ ونشر إعدادات الظهور والإخفاء سحابياً لجميع الحسابات.'
                  : 'تم الحفظ محلياً (يرجى التحقق من الاتصال للمزامنة السحابية).'
              );
            } catch (err: any) {
              showError(err?.message || 'حدث خطأ أثناء حفظ إعدادات الظهور.');
              throw err;
            } finally {
              setSavingMarketSettings(false);
            }
          }}
        />
      )}

      {currentPage === 'ui_layout_studio' && (
        <AdminUiLayoutStudioPage
          onBack={() => handleNavigatePage('home')}
          saving={savingMarketSettings}
          onPublishToCloud={async (nextLayout: PlatformUiLayoutConfig) => {
            setSavingMarketSettings(true);
            try {
              saveStoredUiLayoutConfig(nextLayout);
              const res = await savePlatformSettingsCloud(
                {
                  ...shippingConfig,
                  centralShippingPrivacy,
                  marketBuilder: getStoredMarketBuilderConfig(),
                  suppliersMarketBuilder: getStoredSuppliersMarketBuilderConfig(),
                  landingCms: getStoredLandingCmsConfig(),
                  featureFlags: getStoredFeatureFlags(),
                  uiLayoutConfig: nextLayout,
                  subscriptionPackagesConfig: getStoredSubscriptionPackagesConfig(),
                },
                profile.email
              );
              if (!res.success) {
                const msg = res.error || 'تعذر نشر تخطيط الواجهات على السيرفر.';
                showError(msg);
                throw new Error(msg);
              }
              playSuccessSound();
              showSuccess(
                res.cloudSynced
                  ? 'تم نشر هندسة الواجهات والقوائم فوراً لجميع الفنانين والموردين ✅'
                  : 'تم حفظ ونشر هندسة الواجهات محلياً وعلى السيرفر.'
              );
            } catch (err: any) {
              showError(err?.message || 'حدث خطأ أثناء نشر هندسة الواجهات.');
              throw err;
            } finally {
              setSavingMarketSettings(false);
            }
          }}
        />
      )}

      {currentPage === 'packages_manager' && (
        <AdminPackagesManagerPage
          onBack={() => handleNavigatePage('home')}
          onOpenUiLayoutStudio={() => handleNavigatePage('ui_layout_studio')}
          saving={savingMarketSettings}
          onSaveToCloud={async (nextPkgCfg: PlatformPackagesAdminConfig) => {
            setSavingMarketSettings(true);
            try {
              saveStoredSubscriptionPackagesConfig(nextPkgCfg);
              const res = await savePlatformSettingsCloud(
                {
                  ...shippingConfig,
                  centralShippingPrivacy,
                  marketBuilder: getStoredMarketBuilderConfig(),
                  suppliersMarketBuilder: getStoredSuppliersMarketBuilderConfig(),
                  landingCms: getStoredLandingCmsConfig(),
                  featureFlags: getStoredFeatureFlags(),
                  uiLayoutConfig: getStoredUiLayoutConfig(),
                  subscriptionPackagesConfig: nextPkgCfg,
                },
                profile.email
              );
              if (!res.success) {
                const msg = res.error || 'تعذر نشر إعدادات الباقات والصلاحيات على السيرفر.';
                showError(msg);
                throw new Error(msg);
              }
              playSuccessSound();
              showSuccess(
                res.cloudSynced
                  ? 'تم حفظ ونشر الباقات والصلاحيات فوراً لجميع الفنانين والموردين ✅'
                  : 'تم حفظ الباقات محلياً وعلى السيرفر.'
              );
            } catch (err: any) {
              showError(err?.message || 'حدث خطأ أثناء حفظ الباقات.');
              throw err;
            } finally {
              setSavingMarketSettings(false);
            }
          }}
        />
      )}

      {currentPage === 'unified_materials' && (
        <AdminUnifiedMaterialsPage
          userEmail={profile.email}
          onBack={() => handleNavigatePage('home')}
          onNotifySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onNotifyError={showError}
        />
      )}

      {currentPage === 'experts_trainers' && (
        <AdminExpertsTrainersPage
          onBack={() => handleNavigatePage('home')}
          onNotifySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onNotifyError={showError}
        />
      )}

      {currentPage === 'growth_hub' && (
        <AdminGrowthHubPage
          onBack={() => handleNavigatePage('home')}
          onOpenExpertsPage={() => handleNavigatePage('experts_trainers')}
          onNotifySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onNotifyError={showError}
        />
      )}

      {currentPage === 'pulse_radar' && (
        <SuperAdminPulseDashboard
          profile={profile}
          workshops={workshops}
          cloudProductsCount={cloudProductsForReview.length}
          onBack={() => handleNavigatePage('home')}
          onNotifySuccess={(msg) => {
            playSuccessSound();
            showSuccess(msg);
          }}
          onNotifyError={showError}
        />
      )}

      {(currentPage === 'notif_messages' ||
        currentPage === 'notif_workshops' ||
        currentPage === 'notif_store' ||
        currentPage === 'notif_system') && (
        <AdminNotificationPages
          mode={currentPage}
          onBack={() => handleNavigatePage('home')}
          onNavigatePage={handleNavigatePage}
          workshops={workshops}
          inboxList={inboxList}
          announcementsList={announcementsList}
          adminAlerts={adminAlerts}
          cloudProducts={cloudProductsForReview}
          ordersList={marketplaceOrdersList}
          newAnnTitle={newAnnTitle}
          setNewAnnTitle={setNewAnnTitle}
          newAnnContent={newAnnContent}
          setNewAnnContent={setNewAnnContent}
          newAnnRecipientType={newAnnRecipientType}
          setNewAnnRecipientType={setNewAnnRecipientType}
          newAnnRecipientWorkshopId={newAnnRecipientWorkshopId}
          setNewAnnRecipientWorkshopId={setNewAnnRecipientWorkshopId}
          sendingAnnouncement={sendingAnnouncement}
          onSendAnnouncement={handleSendAnnouncement}
          onDeleteAnnouncement={handleDeleteAnnouncement}
          deletingAnnId={deletingAnnId}
          directReplyTarget={directReplyTarget}
          setDirectReplyTarget={setDirectReplyTarget}
          directReplyContent={directReplyContent}
          setDirectReplyContent={setDirectReplyContent}
          onSendDirectReply={handleSendDirectReply}
          onMarkAllInboxRead={markInboxAllRead}
          onDismissAlert={handleDismissAlert}
          onExportCsv={exportSystemReportCSV}
        />
      )}
      </Suspense>

      {/* All Super Admin Action & Moderation Modals (loaded on demand) */}
      {(editingWorkshop ||
        isSuspendingModalOpen ||
        isBanningModalOpen ||
        deletingWorkshop ||
        editingMaterial ||
        isNewWorkshopModalOpen ||
        awardingWorkshop ||
        auditingWorkshop ||
        rejectingAppealWorkshop ||
        cloudRejectingProduct ||
        credentialSuccessModal) && (
        <Suspense fallback={null}>
          <AdminWorkshopModals
            editingWorkshop={editingWorkshop}
            setEditingWorkshop={setEditingWorkshop}
            isSuspendingModalOpen={isSuspendingModalOpen}
            setIsSuspendingModalOpen={setIsSuspendingModalOpen}
            isBanningModalOpen={isBanningModalOpen}
            setIsBanningModalOpen={setIsBanningModalOpen}
            onSaveEditedWorkshop={handleSaveEditedWorkshop}
            editNewPassword={editNewPassword}
            setEditNewPassword={setEditNewPassword}
            showPasswordPlain={showPasswordPlain}
            setShowPasswordPlain={setShowPasswordPlain}
            onGenerateRandomPassword={generateRandomPassword}
            onCredentialOverride={handleCredentialOverride}
            overridingCredentials={overridingCredentials}
            savingAction={savingAction}
            credentialSuccessModal={credentialSuccessModal}
            setCredentialSuccessModal={setCredentialSuccessModal}
            copiedNotice={copiedNotice}
            setCopiedNotice={setCopiedNotice}
            suspensionDurationChoice={suspensionDurationChoice}
            setSuspensionDurationChoice={setSuspensionDurationChoice}
            suspensionReasonInput={suspensionReasonInput}
            setSuspensionReasonInput={setSuspensionReasonInput}
            onExecuteSuspension={handleExecuteSuspension}
            banReasonInput={banReasonInput}
            setBanReasonInput={setBanReasonInput}
            onExecuteBan={handleExecuteBan}
            rejectingAppealWorkshop={rejectingAppealWorkshop}
            setRejectingAppealWorkshop={setRejectingAppealWorkshop}
            rejectionReasonInput={rejectionReasonInput}
            setRejectionReasonInput={setRejectionReasonInput}
            onConfirmRejectAppeal={handleConfirmRejectAppeal}
            cloudRejectingProduct={cloudRejectingProduct}
            setCloudRejectingProduct={setCloudRejectingProduct}
            cloudRejectReason={cloudRejectReason}
            setCloudRejectReason={setCloudRejectReason}
            onConfirmRejectProduct={handleConfirmRejectCloudProduct}
            deletingWorkshop={deletingWorkshop}
            setDeletingWorkshop={setDeletingWorkshop}
            selectiveDeleteMode={selectiveDeleteMode}
            setSelectiveDeleteMode={setSelectiveDeleteMode}
            deleteConfirmText={deleteConfirmText}
            setDeleteConfirmText={setDeleteConfirmText}
            onConfirmSelectiveDelete={handleSelectiveDeleteWorkshop}
            editingMaterial={editingMaterial}
            setEditingMaterial={setEditingMaterial}
            newMaterialPrice={newMaterialPrice}
            setNewMaterialPrice={setNewMaterialPrice}
            onSaveMaterialPrice={handleSaveMaterialPrice}
            isNewWorkshopModalOpen={isNewWorkshopModalOpen}
            setIsNewWorkshopModalOpen={setIsNewWorkshopModalOpen}
            newBrandName={newBrandName}
            setNewBrandName={setNewBrandName}
            newArtistName={newArtistName}
            setNewArtistName={setNewArtistName}
            newEmail={newEmail}
            setNewEmail={setNewEmail}
            newPhone={newPhone}
            setNewPhone={setNewPhone}
            newCountry={newCountry}
            setNewCountry={setNewCountry}
            newRole={newRole}
            setNewRole={setNewRole}
            onCreateNewWorkshop={handleCreateNewWorkshop}
            awardingWorkshop={awardingWorkshop}
            setAwardingWorkshop={setAwardingWorkshop}
            selectedStars={selectedStars}
            setSelectedStars={setSelectedStars}
            selectedMedal={selectedMedal}
            setSelectedMedal={setSelectedMedal}
            awardCustomNote={awardCustomNote}
            setAwardCustomNote={setAwardCustomNote}
            savingAward={savingAward}
            onSaveAward={handleSaveAward}
            auditingWorkshop={auditingWorkshop}
            setAuditingWorkshop={setAuditingWorkshop}
            auditData={auditData}
            setAuditData={setAuditData}
            loadingAudit={loadingAudit}
          />
        </Suspense>
      )}
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  return (
    <AdminErrorBoundary onLogout={props.onLogout} onNavigateHome={props.onNavigateHome}>
      <AdminDashboardContent {...props} />
    </AdminErrorBoundary>
  );
};
