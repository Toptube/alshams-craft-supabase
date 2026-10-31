import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../../types';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';
import { tenantStorage } from '../../db/dexieDB';
import { useTranslation } from '../../lib/i18n';
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
  HelpCircle,
  Coins,
  Building,
  PieChart as PieChartIcon,
  Info,
  X,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

export type HomeCardSection =
  | 'materials'
  | 'products'
  | 'suppliers'
  | 'customers'
  | 'sales'
  | 'inventory'
  | 'treasuries'
  | 'expenses'
  | 'employees'
  | 'work_orders'
  | 'reports';

export interface WorkshopHomeScreenProps {
  profile: UserProfile;
  // Navigation to full screens
  onNavigateToCalculator: () => void;
  onNavigateToArchive: () => void;
  onNavigateToCatalog: () => void;
  onNavigateToAIAgent: () => void;
  onNavigateToMaterials: (openAdd?: boolean) => void;
  onNavigateToSuppliers: () => void;
  onNavigateToSales: (mode?: string) => void;
  onNavigateToInvoices: (filter?: string) => void;
  onNavigateToWorkOrders: (mode?: string) => void;
  onNavigateToTreasuries: () => void;
  onNavigateToHR: () => void;
  onNavigateToReports: () => void;
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
}

export const WorkshopHomeScreen: React.FC<WorkshopHomeScreenProps> = ({
  profile,
  // Navigation to full screens
  onNavigateToCalculator,
  onNavigateToArchive,
  onNavigateToCatalog,
  onNavigateToAIAgent,
  onNavigateToMaterials,
  onNavigateToSuppliers,
  onNavigateToSales,
  onNavigateToInvoices,
  onNavigateToWorkOrders,
  onNavigateToTreasuries,
  onNavigateToHR,
  onNavigateToReports,
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
}) => {
  const { t: tr, lang } = useTranslation();

  // Active sub-screen state (null = main 11-card grid)
  const [activeSubSection, setActiveSubSection] = useState<HomeCardSection | null>(null);

  // Summary Metrics State (رصيد الخزن، مبيعات الشهر، المصروفات، قيمة المنتجات والمخزون)
  const [totalTreasuryBalance, setTotalTreasuryBalance] = useState<number>(0);
  const [monthSalesTotal, setMonthSalesTotal] = useState<number>(0);
  const [stockAlertCount, setStockAlertCount] = useState<number>(0);
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
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';

  // Load summary metrics once on mount
  useEffect(() => {
    let isMounted = true;
    async function loadMetrics() {
      try {
        setLoadingSummary(true);

        // 1. Treasuries Balance (from Supabase treasury_balances view)
        let treasuriesSum = 0;
        try {
          const { data: treasuries } = await getTreasuryBalancesFromSupabase(workshopId);
          if (treasuries && treasuries.length > 0) {
            treasuriesSum = treasuries.reduce((sum, t) => sum + (Number(t.balance) || 0), 0);
          } else {
            const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
            treasuriesSum = (safe.mainSafe || 0) + (safe.subSafe || 0);
          }
        } catch {
          const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
          treasuriesSum = (safe.mainSafe || 0) + (safe.subSafe || 0);
        }

        // 2. Current Month Sales
        let salesSum = 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        try {
          const orders = await tenantStorage.getOrders(workshopId).catch(() => []);
          salesSum = orders
            .filter((ord) => (ord.createdAt || 0) >= startOfMonth && ord.status !== 'cancelled')
            .reduce((sum, ord) => sum + (ord.finalTotal || ord.totalAmount || ord.subtotal || 0), 0);
        } catch {
          salesSum = 0;
        }

        // 3. Stock Alerts & Raw Materials Inventory Valuation
        let alerts = 0;
        let invTotal = 0;
        let matsCount = 0;
        try {
          const raw = await tenantStorage.getRawMaterials(workshopId).catch(() => []);
          matsCount = raw.length;
          alerts = raw.filter(
            (m) => (m.currentStock || 0) <= (m.minAlertThreshold || 5) && m.isActive !== false
          ).length;
          invTotal = raw.reduce((sum, m) => sum + ((Number(m.currentStock) || 0) * (Number(m.costPerUnit) || 0)), 0);
        } catch {
          alerts = 0;
        }

        // 4. Products Valuation (from archive & catalog products)
        let prodCostSum = 0;
        let prodRetailSum = 0;
        let prodsCount = 0;
        try {
          const prods = await tenantStorage.getProducts(workshopId).catch(() => []);
          prodsCount = prods.length;
          prodCostSum = prods.reduce((sum: number, p: any) => {
            const qty = Number(p.currentStock ?? 1);
            const cost = Number(p.costPrice || p.costPerUnit || 0);
            return sum + (cost * qty);
          }, 0);
          prodRetailSum = prods.reduce((sum: number, p: any) => {
            const qty = Number(p.currentStock ?? 1);
            const price = Number(p.sellingPrice || p.retailPrice || 0);
            return sum + (price * qty);
          }, 0);
        } catch {}

        // 5. Expenses Breakdown (Admin Costs, Wages, Supplier Purchases)
        let adminSum = 0;
        let wagesSum = 0;
        let purchasesSum = 0;
        try {
          const [admins, payouts, supplierInvs] = await Promise.all([
            tenantStorage.getAdminCosts(workshopId).catch(() => []),
            tenantStorage.getEmployeePayouts(workshopId).catch(() => []),
            tenantStorage.getSupplierInvoices(workshopId).catch(() => []),
          ]);
          adminSum = admins.reduce((sum, a) => sum + (Number(a.baseCurrencyAmount || a.amount) || 0), 0);
          wagesSum = payouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          purchasesSum = supplierInvs.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
        } catch {}

        if (isMounted) {
          setTotalTreasuryBalance(Math.round(treasuriesSum));
          setMonthSalesTotal(Math.round(salesSum));
          setStockAlertCount(alerts);
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
        }
      } catch (err) {
        console.error('Failed to load workshop home metrics:', err);
      } finally {
        if (isMounted) setLoadingSummary(false);
      }
    }

    if (workshopId) {
      loadMetrics();
    }
    return () => {
      isMounted = false;
    };
  }, [workshopId]);

  // The 11 Core Cards definition with translations
  const coreCards = [
    {
      id: 'materials' as HomeCardSection,
      label: tr('card_materials'),
      icon: Layers,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-200/80 dark:border-amber-900/40',
    },
    {
      id: 'products' as HomeCardSection,
      label: tr('card_products'),
      icon: ShoppingBag,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/40',
      borderColor: 'border-orange-200/80 dark:border-orange-900/40',
    },
    {
      id: 'suppliers' as HomeCardSection,
      label: tr('card_suppliers'),
      icon: Truck,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40',
      borderColor: 'border-blue-200/80 dark:border-blue-900/40',
    },
    {
      id: 'customers' as HomeCardSection,
      label: tr('card_customers'),
      icon: Users,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'border-emerald-200/80 dark:border-emerald-900/40',
    },
    {
      id: 'sales' as HomeCardSection,
      label: tr('card_sales'),
      icon: ShoppingCart,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/40',
      borderColor: 'border-teal-200/80 dark:border-teal-900/40',
    },
    {
      id: 'inventory' as HomeCardSection,
      label: tr('card_inventory'),
      icon: Boxes,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
      borderColor: 'border-indigo-200/80 dark:border-indigo-900/40',
    },
    {
      id: 'treasuries' as HomeCardSection,
      label: tr('card_treasuries'),
      icon: Wallet,
      color: 'text-lime-600 dark:text-lime-400',
      bgColor: 'bg-lime-50 dark:bg-lime-950/40',
      borderColor: 'border-lime-200/80 dark:border-lime-900/40',
    },
    {
      id: 'expenses' as HomeCardSection,
      label: tr('card_expenses'),
      icon: DollarSign,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-200/80 dark:border-rose-900/40',
    },
    {
      id: 'employees' as HomeCardSection,
      label: tr('card_employees'),
      icon: Users2,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-950/40',
      borderColor: 'border-violet-200/80 dark:border-violet-900/40',
    },
    {
      id: 'work_orders' as HomeCardSection,
      label: tr('card_work_orders'),
      icon: Hammer,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
      borderColor: 'border-cyan-200/80 dark:border-cyan-900/40',
    },
    {
      id: 'reports' as HomeCardSection,
      label: tr('card_reports'),
      icon: BarChart3,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/40',
      borderColor: 'border-purple-200/80 dark:border-purple-900/40',
    },
  ];

  // Sub-actions definition with translations
  const getSubActions = (section: HomeCardSection) => {
    switch (section) {
      case 'materials':
        return {
          title: tr('card_materials'),
          icon: Layers,
          items: [
            {
              label: tr('action_add_material'),
              icon: PlusCircle,
              onClick: onOpenNewMaterialModal,
            },
            {
              label: tr('action_edit_materials'),
              icon: Edit3,
              onClick: () => onNavigateToMaterials(false),
            },
            {
              label: tr('action_stock_card'),
              icon: FileSpreadsheet,
              onClick: () => onOpenInventoryModal('materials'),
            },
            {
              label: tr('action_inventory_audit'),
              icon: ClipboardCheck,
              onClick: () => onOpenInventoryModal('audit'),
            },
          ],
        };

      case 'products':
        return {
          title: tr('card_products'),
          icon: ShoppingBag,
          items: [
            {
              label: tr('action_add_product'),
              icon: Calculator,
              onClick: () => onNavigateToCalculator(),
            },
            {
              label: tr('action_archive'),
              icon: FolderArchive,
              onClick: () => onNavigateToArchive(),
            },
            {
              label: tr('action_falcon_ai'),
              icon: Sparkles,
              onClick: () => onNavigateToAIAgent(),
            },
            {
              label: tr('action_catalog'),
              icon: BookOpen,
              onClick: () => onNavigateToCatalog(),
            },
          ],
        };

      case 'suppliers':
        return {
          title: tr('card_suppliers'),
          icon: Truck,
          items: [
            {
              label: tr('action_add_supplier'),
              icon: UserPlus,
              onClick: () => onOpenCreateSupplier(),
            },
            {
              label: tr('action_supplier_invoice'),
              icon: Receipt,
              onClick: () => onOpenSupplierInvoice(),
            },
            {
              label: tr('action_supplier_statement'),
              icon: FileSpreadsheet,
              onClick: () => onNavigateToSuppliers(),
            },
          ],
        };

      case 'customers':
        return {
          title: tr('card_customers'),
          icon: Users,
          items: [
            {
              label: tr('action_add_customer'),
              icon: UserPlus,
              onClick: onOpenNewClientModal,
            },
            {
              label: tr('action_customer_statement'),
              icon: FileSpreadsheet,
              onClick: () => onNavigateToInvoices('customers'),
            },
          ],
        };

      case 'sales':
        return {
          title: tr('card_sales'),
          icon: ShoppingCart,
          items: [
            {
              label: tr('action_sales_order'),
              icon: ShoppingCart,
              onClick: () => onNavigateToSales(),
            },
            {
              label: tr('action_sales_invoices'),
              icon: FileText,
              onClick: () => onNavigateToInvoices(),
            },
            {
              label: tr('action_all_orders'),
              icon: RotateCcw,
              onClick: () => onNavigateToInvoices('returns'),
            },
          ],
        };

      case 'inventory':
        return {
          title: tr('card_inventory'),
          icon: Boxes,
          items: [
            {
              label: tr('action_raw_stock'),
              icon: Layers,
              onClick: () => onOpenInventoryModal('materials'),
            },
            {
              label: tr('action_finished_stock'),
              icon: Boxes,
              onClick: () => onOpenInventoryModal('products'),
            },
            {
              label: tr('action_inventory_audit'),
              icon: ClipboardList,
              onClick: () => onOpenInventoryModal('audit'),
            },
          ],
        };

      case 'treasuries':
        return {
          title: tr('card_treasuries'),
          icon: Wallet,
          items: [
            {
              label: tr('action_all_treasuries'),
              icon: Wallet,
              onClick: () => onNavigateToTreasuries(),
            },
            {
              label: tr('action_transfer'),
              icon: ArrowLeftRight,
              onClick: () => onNavigateToTreasuries(),
            },
            {
              label: tr('statement'),
              icon: History,
              onClick: () => onNavigateToTreasuries(),
            },
          ],
        };

      case 'expenses':
        return {
          title: tr('card_expenses'),
          icon: DollarSign,
          items: [
            {
              label: tr('action_record_expense'),
              icon: PlusCircle,
              onClick: () => onOpenAdminCostsModal(),
            },
            {
              label: tr('action_operating_costs'),
              icon: DollarSign,
              onClick: () => onOpenAdminCostsModal(),
            },
            {
              label: tr('action_currency_rates') || 'أسعار الصرف اليومية للعملات',
              icon: Coins,
              onClick: () => onOpenExchangeRatesModal && onOpenExchangeRatesModal(),
            },
            {
              label: tr('action_fixed_assets') || 'الأصول الثابتة والإهلاك',
              icon: Building,
              onClick: () => onNavigateToFixedAssets && onNavigateToFixedAssets(),
            },
            {
              label: tr('action_expense_analytics'),
              icon: BarChart3,
              onClick: () => onNavigateToReports(),
            },
          ],
        };

      case 'employees':
        return {
          title: tr('card_employees'),
          icon: Users2,
          items: [
            {
              label: tr('action_add_employee'),
              icon: UserPlus,
              onClick: () => onOpenNewEmployeeModal(),
            },
            {
              label: tr('action_payroll'),
              icon: Wallet,
              onClick: () => onNavigateToHR(),
            },
            {
              label: tr('action_attendance'),
              icon: FileText,
              onClick: () => onNavigateToHR(),
            },
          ],
        };

      case 'work_orders':
        return {
          title: tr('card_work_orders'),
          icon: Hammer,
          items: [
            {
              label: tr('action_new_work_order'),
              icon: PlusCircle,
              onClick: () => onNavigateToWorkOrders(),
            },
            {
              label: tr('action_production_lines'),
              icon: Hammer,
              onClick: () => onNavigateToWorkOrders(),
            },
            {
              label: tr('action_scrap_tracking'),
              icon: AlertTriangle,
              onClick: () => onNavigateToWorkOrders(),
            },
          ],
        };

      case 'reports':
        return {
          title: tr('card_reports'),
          icon: BarChart3,
          items: [
            {
              label: tr('action_profit_loss'),
              icon: BarChart3,
              onClick: () => onNavigateToReports(),
            },
            {
              label: tr('action_cash_flow'),
              icon: TrendingUp,
              onClick: () => onNavigateToReports(),
            },
            {
              label: tr('action_tax_reports'),
              icon: Lock,
              onClick: () => onNavigateToReports(),
            },
          ],
        };

      default:
        return {
          title: '',
          icon: Layers,
          items: [],
        };
    }
  };

  const currentSubHub = activeSubSection ? getSubActions(activeSubSection) : null;

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

      {/* Sub-Screen View (Opens when a card is clicked) */}
      {activeSubSection && currentSubHub ? (
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border-2 border-amber-300/60 dark:border-amber-800/60 shadow-md space-y-4 animate-in slide-in-from-right-3 duration-200">
          {/* Sub-Hub Top Bar */}
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <currentSubHub.icon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">{tr('section_management')}</span>
                <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">
                  {currentSubHub.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubSection(null)}
              className="px-3.5 py-1.5 rounded-2xl border border-amber-300/80 dark:border-amber-700/80 bg-white dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-700 dark:text-stone-300 text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 group"
              title={tr('action_back_to_overview')}
            >
              <img
                src="/alshams_falcon_emblem.png"
                alt={tr('home_screen_btn')}
                className="w-4 h-4 object-contain group-hover:scale-110 transition-transform"
              />
              <span>{tr('home_screen_btn')}</span>
              <ArrowRight className={`w-3.5 h-3.5 text-amber-600 ${lang === 'ar' ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {/* Sub-Action Buttons Grid: Same style (Icon + Short Word) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5 pt-1">
            {currentSubHub.items.map((sub, idx) => {
              const SubIcon = sub.icon;
              const isFalcon = sub.label.includes('صقر');
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={sub.onClick}
                  className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200/80 dark:border-stone-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-500/10 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-95 group text-center min-h-[90px]"
                >
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-stone-700 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform overflow-hidden p-0.5 border border-stone-200/60 dark:border-stone-600">
                    {isFalcon ? (
                      <img
                        src="/falcon_mascot_ai.png"
                        alt="صقر AI"
                        className="w-full h-full object-cover object-top select-none rounded-lg"
                      />
                    ) : (
                      <SubIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-xs font-black text-stone-800 dark:text-stone-200 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                    {sub.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* 3. The 11 Core Cards Grid (Requirement 2: 3 in a row on mobile, Icon + One Word Only) */
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
          {coreCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveSubSection(card.id)}
                className="p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs active:scale-95 group min-h-[82px] sm:min-h-[100px]"
              >
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl ${card.bgColor} ${card.color} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-xs sm:text-sm font-black text-stone-800 dark:text-stone-200 tracking-tight block leading-tight">
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Enhanced Workshop Financial & Inventory Summary Widget with Visual Charts */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs sm:text-sm font-black text-stone-800 dark:text-stone-200">
              {tr('workshop_summary_title')} (التحليل المالي والمخزني)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAnalyticsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold hover:bg-amber-100 transition cursor-pointer shadow-2xs"
            >
              <PieChartIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>الشاشة التعريفية والرسوم البيانية</span>
            </button>
            <span className="text-[10px] text-stone-400 font-bold hidden sm:inline">
              {tr('updated_live')}
            </span>
          </div>
        </div>

        {/* 6 Core Financial & Inventory KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5">
          {/* Card 1: رصيد الخزن والسيولة */}
          <div
            onClick={onNavigateToTreasuries}
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-lime-50 to-emerald-50/40 dark:from-stone-800 dark:to-stone-800/80 border border-lime-200/80 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:border-lime-500 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-0.5">
                {tr('treasury_balance')}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-lime-700 dark:text-lime-400">
                {loadingSummary ? '...' : totalTreasuryBalance.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-bold text-stone-600 dark:text-stone-300">
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
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-stone-800 dark:to-stone-800/80 border border-amber-200/80 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:border-amber-500 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-0.5">
                {tr('month_sales')}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-700 dark:text-amber-400">
                {loadingSummary ? '...' : monthSalesTotal.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-bold text-stone-600 dark:text-stone-300">
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
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50/40 dark:from-stone-800 dark:to-stone-800/80 border border-rose-200/80 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:border-rose-500 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-0.5">
                إجمالي المصروفات
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-rose-700 dark:text-rose-400">
                {loadingSummary ? '...' : totalExpenses.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-bold text-stone-600 dark:text-stone-300">
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
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/40 dark:from-stone-800 dark:to-stone-800/80 border border-blue-200/80 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:border-blue-500 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-0.5">
                قيمة المنتجات ({productsCount} منتج)
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-blue-700 dark:text-blue-400">
                {loadingSummary ? '...' : productsCostValue.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-bold text-stone-600 dark:text-stone-300">
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
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-amber-50/40 dark:from-stone-800 dark:to-stone-800/80 border border-purple-200/80 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:border-purple-500 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-0.5">
                قيمة مخزون الخامات ({materialsCount} صنف)
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-purple-700 dark:text-purple-400">
                {loadingSummary ? '...' : inventoryValue.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                <span className="text-[10px] font-sans font-bold text-stone-600 dark:text-stone-300">
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
            className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50/30 dark:from-stone-800 dark:to-stone-800/80 border border-rose-200/80 dark:border-stone-700 flex items-center justify-between cursor-pointer hover:border-rose-500 transition group shadow-2xs"
          >
            <div>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-0.5">
                {tr('stock_alerts')}
              </span>
              <span
                className={`text-sm sm:text-base font-black ${
                  stockAlertCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-stone-700 dark:text-stone-300'
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
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-stone-100 dark:bg-stone-700 text-stone-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* بطاقة: ملخص حركة الورشة هذا الشهر */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-50/70 via-stone-50 to-emerald-50/50 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border border-amber-200/90 dark:border-amber-900/40 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/50 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>ملخص حركة الورشة هذا الشهر</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-bold">
                    مقارنة شهرية مباشرة
                  </span>
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  مقارنة فورية بين دخل المبيعات وتكاليف التشغيل لاحتساب صافي حركة الورشة
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-stone-600 dark:text-stone-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block shadow-2xs"></span>
                <span>إجمالي المبيعات</span>
              </span>
              <span className="text-stone-300 dark:text-stone-700">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block shadow-2xs"></span>
                <span>تكاليف الإنتاج والمصروفات</span>
              </span>
            </div>
          </div>

          {/* 3 بطاقات مؤشرات: المبيعات، التكاليف والمصروفات، صافي الحركة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. إجمالي المبيعات */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                  إجمالي المبيعات
                </span>
                <div className="text-lg sm:text-xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                  {loadingSummary ? '...' : monthSalesTotal.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                  <span className="text-xs font-bold font-sans text-stone-600 dark:text-stone-400">{profile.currencySymbol}</span>
                </div>
                <span className="text-[10px] text-emerald-600/80 font-bold block mt-0.5">
                  عائد مبيعات المنتجات والطلبيات
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            {/* 2. تكاليف الإنتاج والمصروفات */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800/60 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                  تكاليف الإنتاج والمصروفات
                </span>
                <div className="text-lg sm:text-xl font-black font-mono text-amber-700 dark:text-amber-300">
                  {loadingSummary ? '...' : totalExpenses.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}{' '}
                  <span className="text-xs font-bold font-sans text-stone-600 dark:text-stone-400">{profile.currencySymbol}</span>
                </div>
                <span className="text-[10px] text-amber-600/80 font-bold block mt-0.5">
                  أجور، خامات، ومصروفات تشغيل
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            {/* 3. صافي حركة الورشة */}
            <div className={`p-3.5 rounded-2xl bg-white dark:bg-stone-900 border shadow-2xs flex items-center justify-between ${
              (monthSalesTotal - totalExpenses) >= 0
                ? 'border-emerald-300 dark:border-emerald-700'
                : 'border-rose-300 dark:border-rose-700'
            }`}>
              <div>
                <span className={`text-[11px] font-bold block mb-0.5 ${
                  (monthSalesTotal - totalExpenses) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                }`}>
                  صافي حركة الورشة
                </span>
                <div className={`text-lg sm:text-xl font-black font-mono ${
                  (monthSalesTotal - totalExpenses) >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                }`}>
                  {loadingSummary
                    ? '...'
                    : `${(monthSalesTotal - totalExpenses) >= 0 ? '+' : ''}${(monthSalesTotal - totalExpenses).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}`}{' '}
                  <span className="text-xs font-bold font-sans text-stone-600 dark:text-stone-400">{profile.currencySymbol}</span>
                </div>
                <span className={`text-[10px] font-bold block mt-0.5 ${
                  (monthSalesTotal - totalExpenses) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(monthSalesTotal - totalExpenses) >= 0 ? 'فائض تشغيلي مريح لورشتك' : 'التكاليف تفوق المبيعات هذا الشهر'}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                (monthSalesTotal - totalExpenses) >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
              }`}>
                <Scale className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* رسم بياني سلس ومبسط لمقارنة المبيعات والتكاليف */}
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-800 dark:text-stone-200">
                مقارنة بيانية واضحة بين المبيعات وتكاليف الإنتاج
              </span>
              <span className="text-[11px] text-stone-500 font-bold">
                حركة الشهر الحالي ({profile.currencySymbol})
              </span>
            </div>
            <div className="h-44 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'إجمالي المبيعات', value: monthSalesTotal, color: '#10b981' },
                    { name: 'تكاليف الإنتاج والمصروفات', value: totalExpenses, color: '#f59e0b' },
                  ]}
                  margin={{ top: 12, right: 16, left: 16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#888" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#888" tickFormatter={(v) => Number(v).toLocaleString()} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0];
                        return (
                          <div className="p-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-lg text-xs font-bold" dir="rtl">
                            <div className="text-stone-700 dark:text-stone-300">{item.payload.name}</div>
                            <div className="text-sm font-black font-mono mt-0.5" style={{ color: item.payload.color }}>
                              {Number(item.value).toLocaleString()} {profile.currencySymbol}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Inline Comparative Visual Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2">
          {/* Chart 1: Bar Chart of Assets & Outflows */}
          <div className="p-3 sm:p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-800 dark:text-stone-200">
                مقارنة الأصول والسيولة والمصروفات ({profile.currencySymbol})
              </span>
              <span className="text-[10px] text-stone-400">توزيع رأس المال</span>
            </div>
            <div className="h-44 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'مخزون الخامات', value: inventoryValue, color: '#8b5cf6' },
                    { name: 'قيمة المنتجات', value: productsCostValue, color: '#3b82f6' },
                    { name: 'رصيد الخزن', value: totalTreasuryBalance, color: '#10b981' },
                    { name: 'المصروفات', value: totalExpenses, color: '#f43f5e' },
                  ]}
                  margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#888" />
                  <YAxis tick={{ fontSize: 9 }} stroke="#888" tickFormatter={(v) => Number(v).toLocaleString()} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="p-2 bg-white dark:bg-stone-900 border rounded-lg shadow-md text-xs font-bold" dir="rtl">
                            <div>{payload[0].payload.name}</div>
                            <div className="text-amber-600 font-mono">
                              {Number(payload[0].value).toLocaleString()} {profile.currencySymbol}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    <Cell fill="#8b5cf6" />
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                    <Cell fill="#f43f5e" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Donut of Expenses Breakdown */}
          <div className="p-3 sm:p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-800 dark:text-stone-200">
                هيكل المصروفات والتكاليف
              </span>
              <span className="text-[10px] text-stone-400">
                الإجمالي: {totalExpenses.toLocaleString()} {profile.currencySymbol}
              </span>
            </div>
            <div className="h-44 w-full flex items-center justify-center" dir="ltr">
              {totalExpenses === 0 ? (
                <div className="text-center text-xs text-stone-400">لا توجد حركات مصروفات مسجلة بعد</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'أجور وعمالة', value: expensesBreakdown.wages, color: '#f59e0b' },
                        { name: 'تكاليف إدارية', value: expensesBreakdown.admin, color: '#ec4899' },
                        { name: 'مشتريات خامات', value: expensesBreakdown.purchases, color: '#06b6d4' },
                      ].filter((x) => x.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ec4899" />
                      <Cell fill="#06b6d4" />
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0];
                          const pct = totalExpenses > 0 ? Math.round(((item.value as number) / totalExpenses) * 100) : 0;
                          return (
                            <div className="p-2 bg-white dark:bg-stone-900 border rounded-lg shadow-md text-xs font-bold" dir="rtl">
                              <div>{item.name}</div>
                              <div className="text-amber-600 font-mono">
                                {Number(item.value).toLocaleString()} {profile.currencySymbol} ({pct}%)
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px] font-bold text-stone-500 pt-1 border-t border-stone-200/60 dark:border-stone-700/60">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                <span>أجور ({expensesBreakdown.wages.toLocaleString()})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span>
                <span>إدارية ({expensesBreakdown.admin.toLocaleString()})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                <span>مشتريات ({expensesBreakdown.purchases.toLocaleString()})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: شاشة تعريفية وتحليلية موسعة بالمصروفات والمنتجات والمخزون */}
      {/* ========================================================= */}
      {isAnalyticsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
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

      {/* زر إجراءات عائم في الزاوية السفلية (قائمة الوصول السريع) */}
      <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-2.5 select-none" dir="rtl">
        {isQuickActionsOpen && (
          <div className="w-64 p-2.5 rounded-2xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-amber-300/80 dark:border-amber-700/80 shadow-2xl space-y-1.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="px-2 py-1.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>إجراءات سريعة</span>
              </span>
              <button
                type="button"
                onClick={() => setIsQuickActionsOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition cursor-pointer"
                title="إغلاق القائمة"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 1. تسجيل بيع جديد */}
            <button
              type="button"
              onClick={() => {
                setIsQuickActionsOpen(false);
                onNavigateToSales('new');
              }}
              className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-right bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 transition cursor-pointer group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black block">تسجيل بيع جديد</span>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 block">
                  إصدار فاتورة نقدية أو آجل
                </span>
              </div>
            </button>

            {/* 2. إضافة خامة جديدة */}
            <button
              type="button"
              onClick={() => {
                setIsQuickActionsOpen(false);
                onOpenNewMaterialModal();
              }}
              className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-right bg-amber-50/80 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 transition cursor-pointer group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black block">إضافة خامة جديدة</span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 block">
                  إدخال صنف خام للمخزن
                </span>
              </div>
            </button>

            {/* 3. حاسبة التكاليف والتسعير */}
            <button
              type="button"
              onClick={() => {
                setIsQuickActionsOpen(false);
                onNavigateToCalculator();
              }}
              className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-right bg-purple-50/80 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-900 dark:text-purple-200 transition cursor-pointer group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Calculator className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black block">حاسبة التكاليف والتسعير</span>
                <span className="text-[10px] text-purple-700/80 dark:text-purple-300/80 block">
                  حساب تكلفة ومصنعية القطعة
                </span>
              </div>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 cursor-pointer ${
            isQuickActionsOpen
              ? 'bg-stone-800 text-white rotate-45 ring-4 ring-amber-500/30'
              : 'bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-600 text-white hover:shadow-amber-500/40 hover:scale-105 ring-4 ring-amber-400/20'
          }`}
          title="إجراءات سريعة"
          aria-label="قائمة إجراءات الوصول السريع"
        >
          <PlusCircle className={`w-7 h-7 transition-transform duration-300 ${isQuickActionsOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>
    </div>
  );
};
