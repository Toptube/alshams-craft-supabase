import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { UserProfile, ThemeMode, isUserAdmin } from '../../types';
import { useFeatureFlags } from '../../types/featureFlags';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';
import { tenantStorage } from '../../db/dexieDB';
import { getWorkOrdersFromSupabase } from '../../db/workshopInvoicesCloud';
import { playTaskDoneSound, playButtonClickSound } from '../../lib/sounds';
import { useTranslation } from '../../lib/i18n';
import { FalconMascotAvatar, ShamousaMascotAvatar } from '../brand/BrandAssets';
import {
  getUiColorPreset,
  getUiIcon,
  UiHomeCardConfig,
  useUiLayoutConfig,
} from '../../types/uiLayoutConfig';
import { useExperienceMode } from '../../types/experienceMode';
import {
  deduplicateMaterialsByName,
  readLocalMaterialStockMap,
  resolveMaterialStockValues,
} from '../../lib/materialStockUtils';
import {
  Layers,
  ShoppingBag,
  Truck,
  Users,
  ShoppingCart,
  Boxes,
  Wallet,
  DollarSign,
  Users2,
  Hammer,
  BarChart3,
  PlusCircle,
  PackagePlus,
  UserPlus,
  Receipt,
  RotateCcw,
  Sparkles,
  FolderArchive,
  BookOpen,
  Calculator,
  ChevronLeft,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Edit3,
  Lock,
  ArrowLeftRight,
  History,
  Tag,
  Warehouse,
  CheckCircle,
  CheckCircle2,
  Check,
  HelpCircle,
  Coins,
  Building,
  PieChart as PieChartIcon,
  Info,
  X,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  Search,
  Sun,
  Moon,
  Store,
  Palette,
  Award,
  Globe,
  PackageCheck,
  BellRing,
  User,
  Rocket,
  Calendar,
  Gift,
  QrCode,
} from 'lucide-react';
import { checkUpcomingRecurringExpenses } from '../../services/recurringExpensesService';
import { WorkshopGrowthToolsModal } from '../growth/WorkshopGrowthToolsModal';
import { GrowthHubConfig, getStoredGrowthHubConfig } from '../../types/artisanGrowth';
import { syncGrowthHubConfigFromCloud } from '../../db/memberProfileService';

const WorkshopDarkAnalyticsChart = lazy(() =>
  import('./WorkshopChartsPanel').then((m) => ({ default: m.WorkshopDarkAnalyticsChart }))
);
const WorkshopComparativeCharts = lazy(() =>
  import('./WorkshopChartsPanel').then((m) => ({ default: m.WorkshopComparativeCharts }))
);

export type HomeCardSection =
  | 'executive_brief'
  | 'materials'
  | 'products'
  | 'purchases'
  | 'suppliers'
  | 'inventory'
  | 'work_orders'
  | 'sales'
  | 'customers'
  | 'workforce'
  | 'artisans'
  | 'employees'
  | 'expenses'
  | 'treasuries'
  | 'accounts'
  | 'reports'
  | 'my_platform'
  | 'ai_helpers';

export interface WorkshopHomeScreenProps {
  profile: UserProfile;
  // Navigation to full screens
  onNavigateToCalculator: () => void;
  onNavigateToArchive: () => void;
  onNavigateToCatalog: (tab?: 'catalog' | 'store') => void;
  onOpenArtisanStore?: (tab?: 'products' | 'appearance' | 'promotions' | 'orders' | 'qr') => void;
  onOpenPersonalProfile?: () => void;
  onNavigateToAIAgent: () => void;
  onNavigateToMaterials: (openAdd?: boolean) => void;
  onNavigateToUnifiedMaterials?: () => void;
  onNavigateToSuppliers: () => void;
  onNavigateToSuppliersMarket?: () => void;
  onNavigateToSales: (mode?: string) => void;
  onNavigateToCustomers?: () => void;
  onNavigateToInvoices: (filter?: string) => void;
  onNavigateToWorkOrders: (mode?: string) => void;
  onNavigateToTreasuries: () => void;
  onNavigateToPurchases?: () => void;
  onNavigateToAccounts?: () => void;
  onNavigateToHR: () => void;
  onNavigateToReports: () => void;
  onNavigateToExecutiveBrief?: () => void;
  onNavigateToFixedAssets?: () => void;
  onOpenExchangeRatesModal?: () => void;
  // Modals
  onOpenInventoryModal: (tab?: string) => void;
  onOpenAdminCostsModal: () => void;
  onOpenNewMaterialModal: () => void;
  onOpenNewClientModal: () => void;
  onOpenNewSupplierModal: () => void;
  onOpenCreateSupplier: () => void;
  onOpenSupplierInvoice: () => void;
  onOpenNewEmployeeModal: () => void;
  isAnyModalOpen?: boolean;
  themeMode?: ThemeMode;
  onSelectThemeMode?: (mode: ThemeMode) => void;
}

export const WorkshopHomeScreen: React.FC<WorkshopHomeScreenProps> = ({
  profile,
  // Navigation to full screens
  onNavigateToCalculator,
  onNavigateToArchive,
  onNavigateToCatalog,
  onOpenArtisanStore,
  onOpenPersonalProfile,
  onNavigateToAIAgent,
  onNavigateToMaterials,
  onNavigateToUnifiedMaterials,
  onNavigateToSuppliers,
  onNavigateToSuppliersMarket,
  onNavigateToSales,
  onNavigateToCustomers,
  onNavigateToInvoices,
  onNavigateToWorkOrders,
  onNavigateToTreasuries,
  onNavigateToPurchases,
  onNavigateToAccounts,
  onNavigateToHR,
  onNavigateToReports,
  onNavigateToExecutiveBrief,
  onNavigateToFixedAssets,
  onOpenExchangeRatesModal,
  // Modals
  onOpenInventoryModal,
  onOpenAdminCostsModal,
  onOpenNewMaterialModal,
  onOpenNewClientModal,
  onOpenNewSupplierModal,
  onOpenCreateSupplier,
  onOpenSupplierInvoice,
  onOpenNewEmployeeModal,
  isAnyModalOpen = false,
  themeMode = 'light',
  onSelectThemeMode,
}) => {
  const { t: tr, lang } = useTranslation();
  const flags = useFeatureFlags();
  const uiLayout = useUiLayoutConfig();
  const artisanHomeCfg = uiLayout.artisan.home;
  const {
    isCraft,
    getLabel: getModeLabel,
    isVisible: isModeVisible,
  } = useExperienceMode('artisan', profile);
  const isAdminUser = isUserAdmin(profile);

  const ARTISAN_ACTION_MODE_MAP: Record<string, string> = {
    nav_work_orders_create: 'wo_create_btn',
    nav_work_orders_issue: 'wo_issue_voucher',
    nav_work_orders_receive: 'wo_receive_voucher',
    nav_work_orders: 'wo_page_title',
    modal_inv_audit: 'inv_audit_voucher',
    modal_inv_materials: 'inv_materials_btn',
    nav_treasuries: 'fin_treasury_title',
    nav_reports: 'rep_page_title',
    nav_fixed_assets: 'exp_fixed_assets',
    modal_exchange_rates: 'exp_exchange_rates',
    modal_admin_costs: 'exp_admin_btn',
    nav_purchases: 'pur_list_btn',
    nav_hr: 'wf_hr_btn',
  };

  const getCardDisplayLabel = (card: UiHomeCardConfig): string => {
    if (!isCraft) return card.label;
    switch (card.id) {
      case 'treasuries':
        return 'درج الورشة والفلوس';
      case 'reports':
        return 'خلاصة شغلك ومكسبك';
      case 'work_orders':
        return 'شغل الورشة والإنتاج';
      default:
        return card.label;
    }
  };

  // Active sub-screen card id (null = main operational cards grid)
  const [activeSubSection, setActiveSubSection] = useState<string | null>(null);
  const [workforceTab, setWorkforceTab] = useState<'artisans' | 'employees'>('artisans');

  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';

  // حالة النوافذ المفتوحة لإخفاء الزر العائم تلقائياً
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState<boolean>(false);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState<boolean>(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState<boolean>(false);
  const [growthModalOpen, setGrowthModalOpen] = useState<boolean>(false);
  const [growthInitialTab, setGrowthInitialTab] = useState<
    'calendar' | 'corporate' | 'passport' | 'group_buy' | 'social_ai'
  >('calendar');
  const [growthConfig, setGrowthConfig] = useState<GrowthHubConfig>(() => getStoredGrowthHubConfig());

  useEffect(() => {
    syncGrowthHubConfigFromCloud()
      .then((cfg) => setGrowthConfig(cfg))
      .catch(() => {});
  }, []);

  const hasAnyArtisanGrowthTool =
    growthConfig.productionCalendarEnabled ||
    growthConfig.corporateGiftingEnabled ||
    growthConfig.productPassportQrEnabled ||
    growthConfig.groupBuyingEnabled ||
    growthConfig.aiSocialCopyEnabled;

  const isModalActive = Boolean(
    isAnyModalOpen || isAnalyticsModalOpen || isFavoritesModalOpen || isAgendaModalOpen || growthModalOpen
  );

  useEffect(() => {
    if (isModalActive && isQuickActionsOpen) {
      setIsQuickActionsOpen(false);
    }
  }, [isModalActive, isQuickActionsOpen]);

  useEffect(() => {
    const handleReset = () => setActiveSubSection(null);
    window.addEventListener('alshams_reset_subview', handleReset);
    return () => window.removeEventListener('alshams_reset_subview', handleReset);
  }, []);

  // Summary Metrics State (رصيد الخزن، مبيعات الشهر، المصروفات، قيمة المنتجات والمخزون)
  const [totalTreasuryBalance, setTotalTreasuryBalance] = useState<number>(0);
  const [monthSalesTotal, setMonthSalesTotal] = useState<number>(0);
  const [stockAlertCount, setStockAlertCount] = useState<number>(0);
  const [recurringUrgentCount, setRecurringUrgentCount] = useState<number>(0);
  const [recurringUrgentAmount, setRecurringUrgentAmount] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [expensesBreakdown, setExpensesBreakdown] = useState<{
    wages: number;
    admin: number;
    purchases: number;
  }>({ wages: 0, admin: 0, purchases: 0 });
  const [productsCostValue, setProductsCostValue] = useState<number>(0);
  const [productsRetailValue, setProductsRetailValue] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [inventoryValue, setInventoryValue] = useState<number>(0);
  const [materialsCount, setMaterialsCount] = useState<number>(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [chartViewTab, setChartViewTab] = useState<'financial_overview' | 'sales_growth' | 'cost_distribution'>('financial_overview');

  // Data lists for Smart Daily Tasks and Artisan Favorites
  const [rawMaterialsList, setRawMaterialsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [workOrdersList, setWorkOrdersList] = useState<any[]>([]);

  // Daily Tasks Completion State (persisted per day)
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dailyTasksStorageKey = `alshams_daily_tasks_${workshopId}_${todayDateStr}`;

  const [completedDailyTaskIds, setCompletedDailyTaskIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(dailyTasksStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleToggleDailyTask = (taskId: string) => {
    setCompletedDailyTaskIds((prev) => {
      const isDone = prev.includes(taskId);
      let next: string[];
      if (isDone) {
        next = prev.filter((id) => id !== taskId);
      } else {
        next = [...prev, taskId];
        playTaskDoneSound();
      }
      try {
        localStorage.setItem(dailyTasksStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Artisan Favorites State (starred products and materials)
  const favStorageKey = `alshams_favorites_${workshopId}`;
  const [favorites, setFavorites] = useState<{ products: string[]; materials: string[] }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(favStorageKey);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return { products: [], materials: [] };
  });

  const [favModalTab, setFavModalTab] = useState<'products' | 'materials'>('products');
  const [favModalSearch, setFavModalSearch] = useState('');

  const handleToggleFavorite = (type: 'product' | 'material', id: string) => {
    playButtonClickSound();
    setFavorites((prev) => {
      let next: { products: string[]; materials: string[] };
      if (type === 'product') {
        const exists = prev.products.includes(id);
        next = {
          ...prev,
          products: exists ? prev.products.filter((x) => x !== id) : [...prev.products, id],
        };
      } else {
        const exists = prev.materials.includes(id);
        next = {
          ...prev,
          materials: exists ? prev.materials.filter((x) => x !== id) : [...prev.materials, id],
        };
      }
      try {
        localStorage.setItem(favStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Load summary metrics once on mount
  useEffect(() => {
    let isMounted = true;
    async function loadMetrics() {
      const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
        Promise.race([
          promise.catch(() => fallback),
          new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
        ]);

      try {
        setLoadingSummary(true);

        // 1. Run ALL fast local IndexedDB (Dexie) reads + recurring expense checks concurrently
        await tenantStorage.purgeAutoSeededFakeMaterialStock(workshopId).catch(() => 0);

        const [
          safe,
          ordersData,
          rawData,
          prodsData,
          dexieWo,
          admins,
          payouts,
          supplierInvs,
          recCheck,
        ] = await Promise.all([
          tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 })),
          tenantStorage.getOrders(workshopId).catch(() => []),
          tenantStorage.getRawMaterials(workshopId).catch(() => []),
          tenantStorage.getProducts(workshopId).catch(() => []),
          tenantStorage.getWorkOrders(workshopId).catch(() => []),
          tenantStorage.getAdminCosts(workshopId).catch(() => []),
          tenantStorage.getEmployeePayouts(workshopId).catch(() => []),
          tenantStorage.getSupplierInvoices(workshopId).catch(() => []),
          checkUpcomingRecurringExpenses(workshopId).catch(() => ({ urgentCount: 0, totalUrgentAmount: 0 })),
        ]);

        const localTreasurySum = (safe?.mainSafe || 0) + (safe?.subSafe || 0);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const salesSum = (ordersData || [])
          .filter((ord) => (ord.createdAt || 0) >= startOfMonth && ord.status !== 'cancelled')
          .reduce((sum, ord) => sum + (ord.finalTotal || ord.totalAmount || ord.subtotal || 0), 0);

        const localStockMap = readLocalMaterialStockMap(workshopId);
        const uniqueRawMaterials = deduplicateMaterialsByName(rawData || [], localStockMap);
        const matsCount = uniqueRawMaterials.length;
        const alerts = uniqueRawMaterials.filter((m) => {
          if (m.isActive === false) return false;
          return resolveMaterialStockValues(m, localStockMap).isLowStock;
        }).length;
        const invTotal = uniqueRawMaterials.reduce((sum, m) => {
          const resolved = resolveMaterialStockValues(m, localStockMap);
          return sum + resolved.currentStock * (Number(m.costPerUnit) || 0);
        }, 0);

        const prodsCount = (prodsData || []).length;
        const prodCostSum = (prodsData || []).reduce((sum: number, p: any) => {
          const qty = Number(p.currentStock ?? 1);
          const cost = Number(p.costPrice || p.costPerUnit || 0);
          return sum + cost * qty;
        }, 0);
        const prodRetailSum = (prodsData || []).reduce((sum: number, p: any) => {
          const qty = Number(p.currentStock ?? 1);
          const price = Number(p.sellingPrice || p.retailPrice || 0);
          return sum + price * qty;
        }, 0);

        const adminSum = (admins || []).reduce((sum, a) => sum + (Number(a.baseCurrencyAmount || a.amount) || 0), 0);
        const wagesSum = (payouts || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const purchasesSum = (supplierInvs || []).reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);

        if (isMounted) {
          setRawMaterialsList(uniqueRawMaterials);
          setProductsList(prodsData || []);
          setOrdersList(ordersData || []);
          setWorkOrdersList(dexieWo || []);

          setTotalTreasuryBalance(Math.round(localTreasurySum));
          setMonthSalesTotal(Math.round(salesSum));
          setStockAlertCount(alerts);
          setRecurringUrgentCount(recCheck.urgentCount || 0);
          setRecurringUrgentAmount(Math.round(recCheck.totalUrgentAmount || 0));
          setInventoryValue(Math.round(invTotal));
          setMaterialsCount(matsCount);
          setProductsCostValue(Math.round(prodCostSum));
          setProductsRetailValue(Math.round(prodRetailSum));
          setProductsCount(prodsCount);
          const expTotal = Math.round(adminSum + wagesSum + purchasesSum);
          setTotalExpenses(expTotal);
          setExpensesBreakdown({
            admin: Math.round(adminSum),
            wages: Math.round(wagesSum),
            purchases: Math.round(purchasesSum),
          });
          setLoadingSummary(false);
        }

        // 2. Refresh remote treasury & Supabase work orders in parallel with strict 2s timeout
        const [treasuryRes, fsWo] = await Promise.all([
          withTimeout(getTreasuryBalancesFromSupabase(workshopId), 2000, { data: null as any, error: null }),
          withTimeout(getWorkOrdersFromSupabase(workshopId), 2000, [] as any[]),
        ]);

        if (isMounted) {
          if (treasuryRes?.data && treasuryRes.data.length > 0) {
            const treasuriesSum = treasuryRes.data.reduce((sum: number, t: any) => sum + (Number(t.balance) || 0), 0);
            setTotalTreasuryBalance(Math.round(treasuriesSum));
          }
          if (Array.isArray(fsWo) && fsWo.length > 0) {
            const woMap = new Map<string, any>();
            for (const w of fsWo) woMap.set(w.id, w);
            for (const w of dexieWo || []) woMap.set(w.id, w);
            setWorkOrdersList(Array.from(woMap.values()));
          }
        }
      } catch (err) {
        console.error('Failed to load workshop home metrics:', err);
        if (isMounted) setLoadingSummary(false);
      }
    }

    if (workshopId) {
      loadMetrics();
    }

    const handleDataRefresh = () => {
      if (isMounted && workshopId) {
        loadMetrics();
      }
    };

    window.addEventListener('alshams_treasury_updated', handleDataRefresh);
    window.addEventListener('alshams_financials_updated', handleDataRefresh);
    window.addEventListener('alshams_materials_updated', handleDataRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener('alshams_treasury_updated', handleDataRefresh);
      window.removeEventListener('alshams_financials_updated', handleDataRefresh);
      window.removeEventListener('alshams_materials_updated', handleDataRefresh);
    };
  }, [workshopId]);

  // Calculations for DailyProgressStrip (مبيعات اليوم، الإنتاج المكتمل، نواقص الخامات)
  const todayStartTs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayOrders = useMemo(() => {
    return ordersList.filter((ord) => {
      const ts = ord.createdAt || (ord.date ? new Date(ord.date).getTime() : 0);
      return ts >= todayStartTs && ord.status !== 'cancelled';
    });
  }, [ordersList, todayStartTs]);

  const todaySalesTotal = useMemo(() => {
    return todayOrders.reduce(
      (sum, ord) => sum + (ord.finalTotal || ord.totalAmount || ord.subtotal || 0),
      0
    );
  }, [todayOrders]);

  const todaySalesCount = useMemo(() => todayOrders.length, [todayOrders]);

  const todayCompletedProductionCount = useMemo(() => {
    return workOrdersList.filter((wo) => {
      const isCompleted = wo.status === 'completed' || wo.status === 'delivered';
      const updatedTs = wo.updatedAt || wo.completedAt || wo.createdAt || 0;
      return isCompleted && updatedTs >= todayStartTs;
    }).length;
  }, [workOrdersList, todayStartTs]);

  const lowStockMaterialsCount = useMemo(() => {
    const localStockMap = readLocalMaterialStockMap(workshopId);
    return rawMaterialsList.filter((m) => {
      if (m.isActive === false) return false;
      return resolveMaterialStockValues(m, localStockMap).isLowStock;
    }).length;
  }, [rawMaterialsList, workshopId]);

  // Smart Daily Tasks generated from real workshop data
  const dailyTasks = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'stock' | 'work_order' | 'invoice' | 'routine';
      title: string;
      detail: string;
      urgency: 'high' | 'medium' | 'normal';
      actionLabel: string;
      onAction?: () => void;
    }> = [];

    // 1. تنبيه بنواقص الخامات المجرودة فعلياً والتي وصلت لحد الطلب الأدنى أو تحته
    const localStockMap = readLocalMaterialStockMap(workshopId);
    const depleting = rawMaterialsList
      .map((m) => ({
        material: m,
        stock: resolveMaterialStockValues(m, localStockMap),
      }))
      .filter(({ material, stock }) => material.isActive !== false && stock.isLowStock);
    depleting.slice(0, 3).forEach(({ material: m, stock }) => {
      list.push({
        id: `task_mat_${m.id}`,
        type: 'stock',
        title: `الخامة "${m.materialName}" قربت تخلص.. محتاجين نطلب منها`,
        detail: `الرصيد المتبقي: ${stock.currentStock} ${m.unit || 'وحدة'} (حد الأمان: ${stock.minThreshold})`,
        urgency: 'high',
        actionLabel: 'طلب توريد خامة',
        onAction: () => onOpenSupplierInvoice(),
      });
    });

    // 2. تنبيه بأوامر التشغيل المفتوحة قيد التنفيذ
    const openWo = workOrdersList.filter(
      (wo) => wo.status === 'open' || wo.status === 'in_progress'
    );
    openWo.slice(0, 2).forEach((wo) => {
      list.push({
        id: `task_wo_${wo.id}`,
        type: 'work_order',
        title: `أمر التشغيل لمنتج "${wo.productName}" قيد التنفيذ بالورشة`,
        detail: `الكمية المستهدفة: ${wo.targetQuantity || 1} قطعة · يرجى متابعة نسب الإنجاز والتسليم`,
        urgency: 'medium',
        actionLabel: 'متابعة أمر التشغيل',
        onAction: () => onNavigateToWorkOrders(),
      });
    });

    // 3. تنبيه بالفواتير المستحقة أو الدفعات المتبقية
    const pendingOrders = ordersList.filter(
      (o) => (o.remainingAmount || 0) > 0 && o.status !== 'cancelled'
    );
    pendingOrders.slice(0, 2).forEach((ord) => {
      list.push({
        id: `task_ord_${ord.id}`,
        type: 'invoice',
        title: `تحصيل دفعة متبقية لطلبية "${ord.customerName || 'عميل الورشة'}"`,
        detail: `متبقي تحصيل ${Number(ord.remainingAmount).toLocaleString()} ${profile.currencySymbol} من إجمالي الفاتورة`,
        urgency: 'medium',
        actionLabel: 'متابعة التحصيل',
        onAction: () => onNavigateToSales(),
      });
    });

    // 4. مهام تشغيلية دورية لتأكيد استقرار وانضباط الورشة
    list.push({
      id: 'task_routine_treasury',
      type: 'routine',
      title: 'مطابقة الخزينة وحساب نقدية الورشة اليومية',
      detail: 'تسجيل المقبوضات وتأكيد رصيد الخزينة بنهاية يوم العمل',
      urgency: 'normal',
      actionLabel: 'فحص الخزائن',
      onAction: () => onNavigateToTreasuries(),
    });

    list.push({
      id: 'task_routine_calc',
      type: 'routine',
      title: 'احتساب تكاليف صنف جديد وفحص هوامش الربح',
      detail: 'استخدام حاسبة الإنتاج لحساب استهلاك الخامات وأجر المصنعية',
      urgency: 'normal',
      actionLabel: 'فتح الحاسبة',
      onAction: () => onNavigateToCalculator(),
    });

    return list;
  }, [
    rawMaterialsList,
    workOrdersList,
    ordersList,
    profile.currencySymbol,
    onOpenSupplierInvoice,
    onNavigateToWorkOrders,
    onNavigateToSales,
    onNavigateToTreasuries,
    onNavigateToCalculator,
  ]);

  // Favorite Items Derivation
  const starredProducts = useMemo(() => {
    return productsList.filter((p) => favorites.products.includes(p.id));
  }, [productsList, favorites.products]);

  const starredMaterials = useMemo(() => {
    return rawMaterialsList.filter((m) => favorites.materials.includes(m.id));
  }, [rawMaterialsList, favorites.materials]);

  const hasAnyFavorites = starredProducts.length > 0 || starredMaterials.length > 0;

  // Execute any configured artisan actionKey cleanly
  const executeArtisanAction = (actionKey: string) => {
    switch (actionKey) {
      case 'open_executive_brief':
        if (onNavigateToExecutiveBrief) {
          onNavigateToExecutiveBrief();
        } else {
          window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'executive_brief' } }));
        }
        return;
      case 'open_guide_start':
        window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'guide_start' } }));
        return;
      case 'open_guide_daily':
        window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'guide_daily' } }));
        return;
      case 'modal_new_material':
        onOpenNewMaterialModal();
        return;
      case 'nav_materials':
        onNavigateToMaterials(false);
        return;
      case 'nav_unified_materials':
        if (onNavigateToUnifiedMaterials) {
          onNavigateToUnifiedMaterials();
        } else {
          window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'unified_materials' } }));
        }
        return;
      case 'nav_calculator':
        onNavigateToCalculator();
        return;
      case 'modal_inv_products':
        onOpenInventoryModal('products');
        return;
      case 'nav_archive':
        onNavigateToArchive();
        return;
      case 'nav_catalog':
        onNavigateToCatalog('catalog');
        return;
      case 'open_artisan_store_products':
        if (onOpenArtisanStore) onOpenArtisanStore('products');
        else onNavigateToCatalog('store');
        return;
      case 'open_artisan_store_orders':
        if (onOpenArtisanStore) onOpenArtisanStore('orders');
        else onNavigateToSales();
        return;
      case 'nav_marketplace':
        window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'marketplace' } }));
        return;
      case 'nav_personal_profile':
        if (onOpenPersonalProfile) {
          onOpenPersonalProfile();
        } else {
          window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'personal_profile' } }));
        }
        return;
      case 'modal_supplier_invoice':
        onOpenSupplierInvoice();
        return;
      case 'nav_purchases':
        if (onNavigateToPurchases) onNavigateToPurchases();
        else onNavigateToSuppliers();
        return;
      case 'modal_inv_audit':
        onOpenInventoryModal('audit');
        return;
      case 'nav_suppliers_market':
        if (onNavigateToSuppliersMarket) onNavigateToSuppliersMarket();
        else window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'suppliers_market' } }));
        return;
      case 'modal_create_supplier':
        onOpenCreateSupplier();
        return;
      case 'nav_suppliers':
        onNavigateToSuppliers();
        return;
      case 'modal_inv_materials':
        onOpenInventoryModal('materials');
        return;
      case 'nav_work_orders_create':
        onNavigateToWorkOrders('create');
        return;
      case 'nav_work_orders_issue':
        onNavigateToWorkOrders('issue');
        return;
      case 'nav_work_orders_receive':
        onNavigateToWorkOrders('receive');
        return;
      case 'nav_work_orders':
        onNavigateToWorkOrders();
        return;
      case 'nav_sales_new':
        onNavigateToSales('new');
        return;
      case 'nav_invoices':
        onNavigateToInvoices();
        return;
      case 'nav_sales':
        onNavigateToSales();
        return;
      case 'nav_invoices_returns':
        onNavigateToInvoices('returns');
        return;
      case 'nav_customers':
        if (onNavigateToCustomers) onNavigateToCustomers();
        else onNavigateToSales();
        return;
      case 'modal_new_client':
        onOpenNewClientModal();
        return;
      case 'nav_hr':
        onNavigateToHR();
        return;
      case 'modal_new_employee':
        onOpenNewEmployeeModal();
        return;
      case 'modal_admin_costs':
        onOpenAdminCostsModal();
        return;
      case 'modal_exchange_rates':
        if (onOpenExchangeRatesModal) onOpenExchangeRatesModal();
        return;
      case 'nav_fixed_assets':
        if (onNavigateToFixedAssets) onNavigateToFixedAssets();
        else window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'fixed_assets' } }));
        return;
      case 'nav_treasuries':
        onNavigateToTreasuries();
        return;
      case 'nav_accounts':
        if (onNavigateToAccounts) onNavigateToAccounts();
        else onNavigateToReports();
        return;
      case 'nav_reports':
        onNavigateToReports();
        return;
      case 'nav_ai_agent':
        onNavigateToAIAgent();
        return;
      case 'open_shamousa':
        window.dispatchEvent(new CustomEvent('alshams_open_shamousa'));
        return;
      case 'nav_family':
        window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'family' } }));
        return;
      default:
        window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: actionKey } }));
    }
  };

  const getVisibleItemsForCard = (card: UiHomeCardConfig, applyWorkforceTab = false) => {
    const hasSubGroups =
      card.id === 'workforce' &&
      (card.items || []).some((it) => it.visible !== false && Boolean(it.subGroup));

    return (card.items || []).filter((it) => {
      if (it.visible === false) return false;
      const modeKey = ARTISAN_ACTION_MODE_MAP[it.actionKey];
      if (modeKey && !isModeVisible(modeKey)) return false;

      if (!isAdminUser) {
        if (it.actionKey === 'nav_calculator' && !flags.craftCalculatorEnabled) return false;
        if (it.actionKey === 'nav_suppliers_market' && !flags.suppliersMarketplaceEnabled) return false;
        if (
          (it.actionKey === 'open_artisan_store_products' || it.actionKey === 'open_artisan_store_orders') &&
          !flags.artisanStorefrontEnabled
        ) {
          return false;
        }
      }
      if (applyWorkforceTab && hasSubGroups && it.subGroup) {
        return it.subGroup === workforceTab;
      }
      return true;
    });
  };

  const visibleArtisanCards = useMemo<UiHomeCardConfig[]>(() => {
    return (artisanHomeCfg.cards || []).filter((card) => {
      if (card.visible === false) return false;
      // إخفاء بطاقة الحسابات المحاسبية الثقيلة في الوضع الحرفي (وتبقى متاحة بالكامل في الوضع المحاسبي)
      if (card.id === 'accounts' && !isModeVisible('card_accounts')) return false;
      if (isAdminUser) return true;
      if (card.id === 'ai_helpers' && !flags.aiAssistantsEnabled) return false;
      if (
        card.id === 'my_platform' &&
        !flags.artisanStorefrontEnabled &&
        !flags.artisanMarketplaceEnabled
      ) {
        return false;
      }
      if (
        !flags.erpModulesEnabled &&
        [
          'purchases',
          'suppliers',
          'work_orders',
          'customers',
          'workforce',
          'expenses',
          'treasuries',
          'accounts',
        ].includes(card.id)
      ) {
        return false;
      }
      return true;
    });
  }, [artisanHomeCfg.cards, isAdminUser, flags, isModeVisible]);

  const activeDynamicCard = useMemo(() => {
    if (!activeSubSection) return null;
    return visibleArtisanCards.find((c) => c.id === activeSubSection) || null;
  }, [activeSubSection, visibleArtisanCards]);

  const activeCardHasWorkforceSubGroups = useMemo(() => {
    if (!activeDynamicCard || activeDynamicCard.id !== 'workforce') return false;
    return (activeDynamicCard.items || []).some((it) => it.visible !== false && Boolean(it.subGroup));
  }, [activeDynamicCard]);

  const activeCardVisibleItems = useMemo(() => {
    if (!activeDynamicCard) return [];
    return getVisibleItemsForCard(activeDynamicCard, true);
  }, [activeDynamicCard, isAdminUser, flags, workforceTab, isModeVisible]);

  const gridClassName = useMemo(() => {
    const mob = artisanHomeCfg.columnsMobile === 2 ? 'grid-cols-2' : 'grid-cols-3';
    const desk =
      artisanHomeCfg.columnsDesktop === 3
        ? 'sm:grid-cols-3 md:grid-cols-3'
        : artisanHomeCfg.columnsDesktop === 4
        ? 'sm:grid-cols-4 md:grid-cols-4'
        : 'sm:grid-cols-5 md:grid-cols-5';
    return `grid ${mob} ${desk} gap-2 sm:gap-3`;
  }, [artisanHomeCfg.columnsDesktop, artisanHomeCfg.columnsMobile]);

  const activeCardIconComp = activeDynamicCard ? getUiIcon(activeDynamicCard.iconKey) : Layers;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Honor & Recognition Banner from Super Admin */}
      {Boolean(profile.medal || (profile.rating_stars && profile.rating_stars > 0)) && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-600/20 border-2 border-amber-400 dark:border-amber-500/60 shadow-lg flex flex-wrap items-center justify-between gap-3 text-amber-950 dark:text-amber-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-white flex items-center justify-center text-2xl shadow-md border-2 border-white/60 dark:border-stone-800">
              {profile.medal === 'diamond' ? '💎' : profile.medal === 'gold' ? '🥇' : profile.medal === 'silver' ? '🥈' : '🥉'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-amber-950 dark:text-amber-100">
                  {profile.medal === 'diamond' ? 'قلادة الشمساوية الماسية الفاخرة 💎' :
                   profile.medal === 'gold' ? 'قلادة الشمساوية الذهبية الرفيعة 🥇' :
                   profile.medal === 'silver' ? 'قلادة الشمساوية الفضية الممتازة 🥈' :
                   'قلادة الشمساوية البرونزية المعتمدة 🥉'}
                </span>
                <span className="flex text-amber-500 text-sm tracking-wider">
                  {'⭐'.repeat(profile.rating_stars || 5)}
                </span>
              </div>
              <p className="text-xs text-stone-700 dark:text-stone-300 mt-0.5 font-bold">
                وسام التميز والتكريم الممنوح لورشتكم من كبير عيلة الشمساوية م. حسام بسيوني ✨
                {profile.medal_note && (
                  <span className="mr-2 italic text-amber-900 dark:text-amber-200 font-extrabold">
                    "{profile.medal_note}"
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-stone-600 dark:text-stone-400 font-bold bg-white/50 dark:bg-stone-900/50 px-3 py-1 rounded-xl border border-amber-300/50">
            {profile.medal_awarded_at ? new Date(profile.medal_awarded_at).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : 'معتمد رسمياً'}
          </div>
        </div>
      )}

      {/* Sub-Screen View (Opens when a multi-button card is clicked) */}
      {activeDynamicCard ? (
        <div className="p-4 sm:p-6 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#D4CCBC] dark:border-[#22355E] shadow-md space-y-4 animate-in slide-in-from-right-3 duration-200">
          {/* Sub-Hub Top Bar */}
          <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#E9E2D4] to-[#F5DFC6] dark:from-[#1A2B54] dark:to-[#132040] text-[#C2410C] dark:text-amber-300 border border-[#EA580C]/25 flex items-center justify-center shadow-xs">
                {React.createElement(activeCardIconComp, { className: 'w-4 h-4' })}
              </div>
              <div>
                <span className="text-[10px] text-[#475569] dark:text-[#CBD5E1] font-bold block">{tr('section_management')}</span>
                <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  {getCardDisplayLabel(activeDynamicCard)}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubSection(null)}
              className="px-3.5 py-1.5 rounded-2xl border border-[#EA580C]/45 dark:border-[#22355E] bg-gradient-to-b from-[#FFEDD5] to-[#FED7AA] dark:from-[#1A294B] dark:to-[#0D162E] text-[#9A3412] dark:text-[#FDBA74] text-xs font-black transition flex items-center gap-2 cursor-pointer group"
              title="الرجوع للبطاقات الرئيسية"
            >
              <ArrowRight className={`w-3.5 h-3.5 text-[#EA580C] dark:text-amber-400 ${lang === 'ar' ? '' : 'rotate-180'}`} />
              <span>الرجوع للبطاقات</span>
            </button>
          </div>

          {/* Workforce Tabs Switcher (يظهر فقط لو فيه تبويبات مخصصة) */}
          {activeCardHasWorkforceSubGroups && (
            <div className="flex items-center gap-2 bg-[#E9E2D4] dark:bg-[#132040] p-1.5 rounded-2xl w-full max-w-xl mx-auto border border-[#D4CCBC] dark:border-[#22355E]">
              <button
                type="button"
                onClick={() => setWorkforceTab('artisans')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center ${
                  workforceTab === 'artisans'
                    ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white shadow-sm'
                    : 'text-[#334155] dark:text-[#CBD5E1] bg-[#F7F3EA]/70 dark:bg-[#1A2B54]/60'
                }`}
              >
                صناع وحرفيو الورشة - بالقطعة والإنتاج
              </button>
              <button
                type="button"
                onClick={() => setWorkforceTab('employees')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center ${
                  workforceTab === 'employees'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-[#334155] dark:text-[#CBD5E1] bg-[#F7F3EA]/70 dark:bg-[#1A2B54]/60'
                }`}
              >
                الموظفون والإدارة - رواتب وسلف
              </button>
            </div>
          )}

          {/* Sub-Action Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5 pt-1">
            {activeCardVisibleItems
              .filter((sub) => {
                const mk = ARTISAN_ACTION_MODE_MAP[sub.actionKey];
                return !mk || isModeVisible(mk);
              })
              .map((sub) => {
                const SubIcon = getUiIcon(sub.iconKey);
                const modeKey = ARTISAN_ACTION_MODE_MAP[sub.actionKey];
                const resolvedLabel = modeKey ? getModeLabel(modeKey, sub.label) : sub.label;
                const isFalcon = sub.actionKey === 'nav_ai_agent' || sub.label.includes('صقر');
                const isShamousa = sub.actionKey === 'open_shamousa' || sub.label.includes('شموسة');
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => executeArtisanAction(sub.actionKey)}
                    className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-[#F7F3EA] to-[#E9E2D4] dark:from-[#0D162E] dark:to-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] dark:hover:border-[#EA580C] transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group text-center min-h-[90px]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-transparent text-[#EA580C] dark:text-amber-400 flex items-center justify-center shadow-none group-hover:scale-110 transition-transform overflow-hidden p-0.5">
                      {isFalcon ? (
                        <FalconMascotAvatar size="sm" statusDot={false} />
                      ) : isShamousa ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400 bg-gradient-to-tr from-[#EA580C] to-amber-400 flex items-center justify-center shadow-xs p-0.5">
                          <ShamousaMascotAvatar size="sm" statusDot={false} className="w-full h-full" />
                        </div>
                      ) : (
                        <div
                          className={`w-8 h-8 ${
                            artisanHomeCfg.iconShape === 'circle' ? 'rounded-full' : 'rounded-xl'
                          } bg-[#F7F3EA] dark:bg-[#0D162E] text-[#EA580C] dark:text-amber-400 flex items-center justify-center shadow-2xs p-0.5 border border-[#D4CCBC] dark:border-[#22355E]`}
                        >
                          <SubIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] group-hover:text-[#C2410C] dark:group-hover:text-amber-300 transition-colors">
                      {resolvedLabel}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ) : (
        <>
          {/* 2. شبكة البطاقات التشغيلية الديناميكية (تُضبط من هندسة الواجهات) */}
          <div className={gridClassName}>
            {visibleArtisanCards.map((card) => {
              const Icon = getUiIcon(card.iconKey);
              const preset = getUiColorPreset(card.colorPreset);
              const isWideShape = artisanHomeCfg.cardShape === 'wide';
              const isCompactShape = artisanHomeCfg.cardShape === 'compact';
              const iconRadiusClass = artisanHomeCfg.iconShape === 'circle' ? 'rounded-full' : 'rounded-2xl';
              const visibleItems = getVisibleItemsForCard(card, false);
              const visibleItemsCount = visibleItems.length;

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    if (visibleItemsCount === 0 && card.directActionKey) {
                      executeArtisanAction(card.directActionKey);
                      return;
                    }
                    if (visibleItemsCount === 1) {
                      const onlyItem = visibleItems[0];
                      if (onlyItem) {
                        executeArtisanAction(onlyItem.actionKey);
                        return;
                      }
                    }
                    setActiveSubSection(card.id);
                  }}
                  className={`rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#F7F3EA] to-[#EFE9DC] dark:from-[#0D162E] dark:to-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] dark:hover:border-[#EA580C] hover:shadow-md transition-all duration-200 cursor-pointer group ${
                    isWideShape
                      ? 'p-3 sm:p-4 flex items-center gap-2.5 text-right min-h-[78px] sm:min-h-[88px]'
                      : isCompactShape
                      ? 'p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1 min-h-[70px] sm:min-h-[82px]'
                      : 'p-2.5 sm:p-4 flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 min-h-[82px] sm:min-h-[100px]'
                  }`}
                >
                  <div
                    className={`${
                      isCompactShape ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-9 h-9 sm:w-11 sm:h-11'
                    } ${iconRadiusClass} ${preset.bgColor} ${preset.color} border ${preset.borderColor} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] tracking-tight block leading-tight">
                      {getCardDisplayLabel(card)}
                    </span>
                    {isWideShape && card.subtitle && (
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-bold block mt-0.5 line-clamp-1">
                        {card.subtitle}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* 4. Enhanced Workshop Financial & Inventory Summary Widget with Visual Charts */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#EA580C] dark:text-amber-400" />
            <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
              ملخص الورشة
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAnalyticsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-b from-[#FFEDD5] to-[#FED7AA] dark:from-[#1A294B] dark:to-[#0D162E] text-[#9A3412] dark:text-[#FDBA74] border border-[#EA580C]/45 dark:border-[#22355E] text-xs font-black transition cursor-pointer"
            >
              <PieChartIcon className="w-3.5 h-3.5 text-[#EA580C] dark:text-amber-400" />
              <span>الشاشة التعريفية</span>
            </button>
            <span className="text-[10px] text-[#475569] dark:text-[#CBD5E1] font-bold hidden sm:inline">
              {tr('updated_live')}
            </span>
          </div>
        </div>

        {/* 6 Core Financial & Inventory KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5">
          {/* Card 1: رصيد الخزن والسيولة */}
          <div
            onClick={onNavigateToTreasuries}
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-lime-50 to-emerald-50/40 dark:from-[#0D162E] dark:to-[#132040] border border-lime-200/80 dark:border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-lime-500 dark:hover:border-amber-400 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-700 dark:text-amber-200/90 font-black block mb-0.5">
                {tr('treasury_balance')}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-lime-700 dark:text-lime-300">
                {loadingSummary ? '...' : totalTreasuryBalance.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-black text-stone-800 dark:text-amber-100">
                  {profile.currencySymbol}
                </span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-lime-100 dark:bg-lime-950/60 text-lime-700 dark:text-lime-300 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: مبيعات الشهر */}
          <div
            onClick={() => onNavigateToInvoices()}
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-[#0D162E] dark:to-[#132040] border border-amber-200/80 dark:border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-amber-500 dark:hover:border-amber-400 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-700 dark:text-amber-200/90 font-black block mb-0.5">
                {tr('month_sales')}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-700 dark:text-amber-300">
                {loadingSummary ? '...' : monthSalesTotal.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-black text-stone-800 dark:text-amber-100">
                  {profile.currencySymbol}
                </span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: إجمالي المصروفات */}
          <div
            onClick={onOpenAdminCostsModal}
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50/40 dark:from-[#0D162E] dark:to-[#132040] border border-rose-200/80 dark:border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-rose-500 dark:hover:border-amber-400 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-700 dark:text-amber-200/90 font-black block mb-0.5">
                إجمالي المصروفات
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-rose-700 dark:text-rose-300">
                {loadingSummary ? '...' : totalExpenses.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-black text-stone-800 dark:text-amber-100">
                  {profile.currencySymbol}
                </span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: إجمالي قيمة المنتجات */}
          <div
            onClick={() => onOpenInventoryModal('products')}
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/40 dark:from-[#0D162E] dark:to-[#132040] border border-blue-200/80 dark:border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-blue-500 dark:hover:border-amber-400 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-700 dark:text-amber-200/90 font-black block mb-0.5">
                قيمة المنتجات ({productsCount} منتج)
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-blue-700 dark:text-blue-300">
                {loadingSummary ? '...' : productsCostValue.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-black text-stone-800 dark:text-amber-100">
                  {profile.currencySymbol}
                </span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>

          {/* Card 5: إجمالي قيمة المخزون */}
          <div
            onClick={() => onOpenInventoryModal('materials')}
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-amber-50/40 dark:from-[#0D162E] dark:to-[#132040] border border-purple-200/80 dark:border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-purple-500 dark:hover:border-amber-400 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-700 dark:text-amber-200/90 font-black block mb-0.5">
                قيمة مخزون الخامات ({materialsCount} صنف)
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-purple-700 dark:text-purple-300">
                {loadingSummary ? '...' : inventoryValue.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-black text-stone-800 dark:text-amber-100">
                  {profile.currencySymbol}
                </span>
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Boxes className="w-4 h-4" />
            </div>
          </div>

          {/* Card 6: تنبيهات المخزون */}
          <div
            onClick={() => onOpenInventoryModal('materials')}
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50/30 dark:from-[#0D162E] dark:to-[#132040] border border-rose-200/80 dark:border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-rose-500 dark:hover:border-amber-400 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-700 dark:text-amber-200/90 font-black block mb-0.5">
                {tr('stock_alerts')}
              </span>
              <span
                className={`text-sm sm:text-base font-black ${
                  stockAlertCount > 0
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-stone-900 dark:text-amber-100'
                }`}
              >
                {loadingSummary
                  ? '...'
                  : stockAlertCount > 0
                  ? `${stockAlertCount} ${tr('materials_depleting')}`
                  : tr('stock_healthy')}
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${
                stockAlertCount > 0
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* بطاقة: ملخص حركة الورشة هذا الشهر */}
        {/* بطاقة: ملخص حركة الورشة هذا الشهر (تصميم حرفي فخم عالي التباين خالي من الرمادي) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#D4CCBC] dark:border-[#22355E] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shadow-xs">
                <TrendingUp className="w-5 h-5 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <span>ملخص حركة الورشة هذا الشهر</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-300 font-black border border-amber-300 dark:border-amber-600/50">
                    مقارنة شهرية مباشرة
                  </span>
                </h4>
                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] font-medium">
                  مقارنة فورية بين دخل المبيعات وتكاليف التشغيل لاحتساب صافي حركة الورشة
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-black text-stone-800 dark:text-amber-200">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs"></span>
                <span>إجمالي المبيعات</span>
              </span>
              <span className="text-amber-400 dark:text-amber-600">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs"></span>
                <span>تكاليف الإنتاج والمصروفات</span>
              </span>
            </div>
          </div>

          {/* 3 بطاقات مؤشرات فاخرة: المبيعات، التكاليف والمصروفات، صافي الحركة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. إجمالي المبيعات */}
            <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-[#061A14] border-2 border-emerald-300 dark:border-emerald-500/50 shadow-md hover:shadow-lg transition-all flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 block mb-0.5">
                  إجمالي المبيعات
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300 tracking-tight">
                  {loadingSummary ? '...' : monthSalesTotal.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                  <span className="text-xs font-black font-sans text-emerald-950 dark:text-emerald-100">{profile.currencySymbol}</span>
                </div>
                <span className="text-[11px] text-emerald-800 dark:text-emerald-200/90 font-bold block mt-0.5">
                  عائد مبيعات المنتجات والطلبيات
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-200/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-xs">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            {/* 2. تكاليف الإنتاج والمصروفات */}
            <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-[#1A1206] border-2 border-amber-300 dark:border-amber-500/50 shadow-md hover:shadow-lg transition-all flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-amber-900 dark:text-amber-300 block mb-0.5">
                  تكاليف الإنتاج والمصروفات
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-800 dark:text-amber-300 tracking-tight">
                  {loadingSummary ? '...' : totalExpenses.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                  <span className="text-xs font-black font-sans text-amber-950 dark:text-amber-100">{profile.currencySymbol}</span>
                </div>
                <span className="text-[11px] text-amber-800 dark:text-amber-200/90 font-bold block mt-0.5">
                  أجور، خامات، ومصروفات تشغيل
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-200/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 flex items-center justify-center shadow-xs">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            {/* 3. صافي حركة الورشة */}
            <div className={`p-4 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-between ${
              (monthSalesTotal - totalExpenses) >= 0
                ? 'bg-teal-50/90 dark:bg-[#06161E] border-2 border-teal-300 dark:border-teal-500/50'
                : 'bg-rose-50/90 dark:bg-[#1A0808] border-2 border-rose-300 dark:border-rose-500/50'
            }`}>
              <div>
                <span className={`text-xs font-black block mb-0.5 ${
                  (monthSalesTotal - totalExpenses) >= 0 ? 'text-teal-900 dark:text-teal-300' : 'text-rose-900 dark:text-rose-300'
                }`}>
                  صافي حركة الورشة
                </span>
                <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                  (monthSalesTotal - totalExpenses) >= 0 ? 'text-teal-800 dark:text-teal-300' : 'text-rose-800 dark:text-rose-300'
                }`}>
                  {loadingSummary
                    ? '...'
                    : `${(monthSalesTotal - totalExpenses) >= 0 ? '+' : ''}${(monthSalesTotal - totalExpenses).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}`}{' '}
                  <span className="text-xs font-black font-sans text-stone-900 dark:text-white">{profile.currencySymbol}</span>
                </div>
                <span className={`text-[11px] font-black block mt-0.5 ${
                  (monthSalesTotal - totalExpenses) >= 0 ? 'text-teal-800 dark:text-teal-200' : 'text-rose-800 dark:text-rose-200'
                }`}>
                  {(monthSalesTotal - totalExpenses) >= 0 ? 'فائض تشغيلي مريح لورشتك' : 'التكاليف تفوق المبيعات هذا الشهر'}
                </span>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
                (monthSalesTotal - totalExpenses) >= 0
                  ? 'bg-teal-200/80 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300'
                  : 'bg-rose-200/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
              }`}>
                <Scale className="w-5 h-5" />
              </div>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="p-6 rounded-3xl bg-[#060B18] border-2 border-[#EA580C]/30 h-[280px] flex items-center justify-center text-xs font-bold text-amber-300/80">
                جاري تحميل التحليلات البيانية للورشة...
              </div>
            }
          >
            <WorkshopDarkAnalyticsChart
              chartViewTab={chartViewTab}
              setChartViewTab={setChartViewTab}
              monthSalesTotal={monthSalesTotal}
              expensesBreakdown={expensesBreakdown}
              currencySymbol={profile.currencySymbol}
            />
          </Suspense>
        </div>

        {/* جناح أدوات النمو والتطوير الذكية للورش (متحكم فيه من السوبر أدمن) */}
        {hasAnyArtisanGrowthTool && (
          <section
            dir="rtl"
            className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C]/35 dark:border-[#FBBF24]/30 p-4 sm:p-5 space-y-3.5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    جناح أدوات النمو والتطوير الذكية للورشة
                  </h3>
                  <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                    أدوات تشغيلية وتسويقية مباشرة لمضاعفة مبيعات ورشتك وتنظيم وقت الإنتاج
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  setGrowthInitialTab('calendar');
                  setGrowthModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black transition cursor-pointer"
              >
                فتح الجناح بالكامل
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {growthConfig.productionCalendarEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setGrowthInitialTab('calendar');
                    setGrowthModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-right transition cursor-pointer flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">تقويم الإنتاج</span>
                </button>
              )}
              {growthConfig.corporateGiftingEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setGrowthInitialTab('corporate');
                    setGrowthModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-right transition cursor-pointer flex items-center gap-2"
                >
                  <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">هدايا الشركات</span>
                </button>
              )}
              {growthConfig.productPassportQrEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setGrowthInitialTab('passport');
                    setGrowthModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-right transition cursor-pointer flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">جواز سفر QR</span>
                </button>
              )}
              {growthConfig.groupBuyingEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setGrowthInitialTab('group_buy');
                    setGrowthModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-right transition cursor-pointer flex items-center gap-2"
                >
                  <Users2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">الشراء التعاوني</span>
                </button>
              )}
              {growthConfig.aiSocialCopyEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setGrowthInitialTab('social_ai');
                    setGrowthModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-right transition cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">مولد الريلز</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Inline Comparative Visual Charts */}
        <Suspense fallback={<div className="h-44" />}>
          <WorkshopComparativeCharts
            inventoryValue={inventoryValue}
            productsCostValue={productsCostValue}
            totalTreasuryBalance={totalTreasuryBalance}
            totalExpenses={totalExpenses}
            expensesBreakdown={expensesBreakdown}
            currencySymbol={profile.currencySymbol}
          />
        </Suspense>
      </div>

      {/* ========================================================= */}
      {/* MODAL: شاشة تعريفية وتحليلية موسعة بالمصروفات والمنتجات والمخزون */}
      {/* ========================================================= */}
      {isAnalyticsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsAnalyticsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsAnalyticsModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-amber-600" />
                  <span>الشاشة التعريفية بالمصروفات وقيمة المنتجات والمخزون</span>
                </h3>
                <p className="text-xs text-stone-500">
                  لوحة استعراض متقدمة للأصول التشغيلية، تقييم المنتجات بسعر التكلفة والبيع، وتفصيل المصروفات
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Detailed 3-Way Valuation Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1">
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 block">
                    مخزون الخامات ومستلزمات الإنتاج
                  </span>
                  <div className="text-xl font-black font-mono text-purple-900 dark:text-purple-100">
                    {inventoryValue.toLocaleString()} {profile.currencySymbol}
                  </div>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400">
                    يشمل {materialsCount} صنف مسجل بكروت الصنف بالمخزن
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1">
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block">
                    تقييم المنتجات التامة (التكلفة)
                  </span>
                  <div className="text-xl font-black font-mono text-blue-900 dark:text-blue-100">
                    {productsCostValue.toLocaleString()} {profile.currencySymbol}
                  </div>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    القيمة البيعية المقدرة: {productsRetailValue.toLocaleString()} {profile.currencySymbol}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-1">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">
                    إجمالي المصروفات المنصرفة
                  </span>
                  <div className="text-xl font-black font-mono text-rose-900 dark:text-rose-100">
                    {totalExpenses.toLocaleString()} {profile.currencySymbol}
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    أجور + تكاليف إدارية + مشتريات خامات مسددة
                  </p>
                </div>
              </div>

              {/* Breakdown Table */}
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden text-xs">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                    <tr>
                      <th className="p-3 font-bold">بند التحليل المالي</th>
                      <th className="p-3 font-bold">القيمة المالية</th>
                      <th className="p-3 font-bold">النسبة المئوية</th>
                      <th className="p-3 font-bold">الإجراء المباشر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    <tr>
                      <td className="p-3 font-bold text-stone-800 dark:text-stone-200">
                        قيمة مخزون الخامات (Raw Materials Stock)
                      </td>
                      <td className="p-3 font-mono font-black text-purple-600 dark:text-purple-400">
                        {inventoryValue.toLocaleString()} {profile.currencySymbol}
                      </td>
                      <td className="p-3 font-bold text-stone-500">
                        {inventoryValue + productsCostValue > 0
                          ? Math.round((inventoryValue / (inventoryValue + productsCostValue)) * 100)
                          : 0}% من المخزون
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAnalyticsModalOpen(false);
                            onOpenInventoryModal('materials');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 font-bold cursor-pointer"
                        >
                          كارت الصنف
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-stone-800 dark:text-stone-200">
                        قيمة المنتجات التامة الصنع (Finished Products)
                      </td>
                      <td className="p-3 font-mono font-black text-blue-600 dark:text-blue-400">
                        {productsCostValue.toLocaleString()} {profile.currencySymbol}
                      </td>
                      <td className="p-3 font-bold text-stone-500">
                        {inventoryValue + productsCostValue > 0
                          ? Math.round((productsCostValue / (inventoryValue + productsCostValue)) * 100)
                          : 0}% من المخزون
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAnalyticsModalOpen(false);
                            onNavigateToCatalog();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 font-bold cursor-pointer"
                        >
                          فتح الكتالوج
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-stone-800 dark:text-stone-200">
                        مصروفات أجور ومصنعيات العمالة (Wages)
                      </td>
                      <td className="p-3 font-mono font-black text-amber-600 dark:text-amber-400">
                        {expensesBreakdown.wages.toLocaleString()} {profile.currencySymbol}
                      </td>
                      <td className="p-3 font-bold text-stone-500">
                        {totalExpenses > 0 ? Math.round((expensesBreakdown.wages / totalExpenses) * 100) : 0}% من المصروفات
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAnalyticsModalOpen(false);
                            onNavigateToHR();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 font-bold cursor-pointer"
                        >
                          كشف الأجور
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-stone-800 dark:text-stone-200">
                        التكاليف الإدارية والتشغيلية العامة
                      </td>
                      <td className="p-3 font-mono font-black text-rose-600 dark:text-rose-400">
                        {expensesBreakdown.admin.toLocaleString()} {profile.currencySymbol}
                      </td>
                      <td className="p-3 font-bold text-stone-500">
                        {totalExpenses > 0 ? Math.round((expensesBreakdown.admin / totalExpenses) * 100) : 0}% من المصروفات
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAnalyticsModalOpen(false);
                            onOpenAdminCostsModal();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 font-bold cursor-pointer"
                        >
                          المصاريف الإدارية
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAnalyticsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold cursor-pointer hover:bg-stone-300"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تم نقل زر الإجراءات السريعة (+) إلى الشريط العلوي بين الإشعارات والعيلة لراحة بصرية كاملة أسفل الشاشة */}

      {/* نافذة تخصيص واختيار المفضلة الحرفية */}
      {isFavoritesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200"
          dir="rtl"
          onClick={() => setIsFavoritesModalOpen(false)}
        >
          <div
            className="w-full max-w-xl p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-amber-300/80 dark:border-amber-800/80 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس النافذة */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                    تخصيص المفضلة الحرفية
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    اضغط على النجمة ⭐ بجانب أي صنف أو خامة لتثبيتها في الواجهة الرئيسية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFavoritesModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* أزرار التبديل والبحث */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFavModalTab('products')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    favModalTab === 'products'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>المنتجات الحرفية ({productsList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFavModalTab('materials')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    favModalTab === 'materials'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  <span>الخامات ومستلزمات الإنتاج ({rawMaterialsList.length})</span>
                </button>
              </div>

              {/* حقل البحث السريع */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={favModalSearch}
                  onChange={(e) => setFavModalSearch(e.target.value)}
                  placeholder={favModalTab === 'products' ? 'بحث عن منتج...' : 'بحث عن خامة...'}
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* قائمة العناصر للاختيار */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {favModalTab === 'products' ? (
                productsList
                  .filter((p) => !favModalSearch.trim() || p.productName?.toLowerCase().includes(favModalSearch.toLowerCase().trim()))
                  .map((p) => {
                    const isStarred = favorites.products.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isStarred
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                            : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">
                            {p.category || 'عام'}
                          </span>
                          <span className="text-xs font-black text-stone-900 dark:text-stone-100 block truncate">
                            {p.productName}
                          </span>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold font-mono">
                            {Number(p.sellingPrice || p.retailPrice || 0).toLocaleString()} {profile.currencySymbol}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleFavorite('product', p.id)}
                          className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-black active:scale-95 ${
                            isStarred
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-amber-600'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${isStarred ? 'fill-white text-white' : ''}`} />
                          <span>{isStarred ? 'في المفضلة' : 'تثبيت'}</span>
                        </button>
                      </div>
                    );
                  })
              ) : (
                rawMaterialsList
                  .filter((m) => !favModalSearch.trim() || m.materialName?.toLowerCase().includes(favModalSearch.toLowerCase().trim()))
                  .map((m) => {
                    const isStarred = favorites.materials.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isStarred
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                            : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold block">
                            خامة ({m.unit || 'وحدة'})
                          </span>
                          <span className="text-xs font-black text-stone-900 dark:text-stone-100 block truncate">
                            {m.materialName}
                          </span>
                          <span className="text-[11px] text-stone-500 font-bold">
                            الرصيد: {m.currentStock || 0} {m.unit} · {Number(m.costPerUnit || 0).toLocaleString()} {profile.currencySymbol}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleFavorite('material', m.id)}
                          className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-black active:scale-95 ${
                            isStarred
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-amber-600'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${isStarred ? 'fill-white text-white' : ''}`} />
                          <span>{isStarred ? 'في المفضلة' : 'تثبيت'}</span>
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            {/* ذيل النافذة */}
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFavoritesModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition cursor-pointer shadow-xs active:scale-95"
              >
                تأكيد واعتماد المفضلة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة جناح أدوات النمو الذكية للفنانين */}
      <WorkshopGrowthToolsModal
        isOpen={growthModalOpen}
        onClose={() => setGrowthModalOpen(false)}
        profile={profile}
        productsList={productsList}
        workOrdersList={workOrdersList}
        initialTab={growthInitialTab}
      />
    </div>
  );
};
