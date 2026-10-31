import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  SupplierProfile,
  SupplierPurchaseInvoice,
  CustomerOrder,
  SafeTransaction,
  SystemActivityLog,
  EmployeeProfile,
  EmployeePayoutRecord,
  AdminCostRecord,
  RawMaterialItem,
  FixedAsset,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { getTreasuryBalancesFromSupabase, SupabaseTreasuryBalance } from '../../db/supabaseService';
import { supabase } from '../../lib/supabase';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  ShieldAlert,
  Wallet,
  TrendingUp,
  TrendingDown,
  Building,
  Users2,
  Lock,
  Calendar,
  AlertTriangle,
  History,
  CheckCircle,
  CheckCircle2,
  Download,
  Filter,
  Scale,
  Layers,
  ArrowUpDown,
  Coins,
  Cpu,
  FileCheck,
  Award,
  PieChart as PieIcon,
  LayoutGrid,
  CalendarRange,
  Clock,
  Sparkles,
  ChevronLeft,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { MonthlyFinancialTrendsChart } from './MonthlyFinancialTrendsChart';

interface SaaSReportsAnalyticsViewProps {
  profile: UserProfile;
}

export const SaaSReportsAnalyticsView: React.FC<SaaSReportsAnalyticsViewProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<
    'trial_balance' | 'financial' | 'safes' | 'sales_audit' | 'suppliers' | 'audit_logs'
  >('trial_balance');

  // Balances & Data
  const [safeBalances, setSafeBalances] = useState<{
    mainSafe: number;
    subSafe: number;
    unsettledCustodies: number;
  }>({
    mainSafe: 0,
    subSafe: 0,
    unsettledCustodies: 0,
  });
  const [openCustodiesList, setOpenCustodiesList] = useState<SupabaseTreasuryBalance[]>([]);
  const [safeTransactions, setSafeTransactions] = useState<SafeTransaction[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierPurchaseInvoice[]>([]);
  const [adminCosts, setAdminCosts] = useState<AdminCostRecord[]>([]);
  const [employeePayouts, setEmployeePayouts] = useState<EmployeePayoutRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<SystemActivityLog[]>([]);
  const [materials, setMaterials] = useState<RawMaterialItem[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [auditFilterStatus, setAuditFilterStatus] = useState<string>('all');

  // Selected supplier statement view
  const [selectedSupplierForStatement, setSelectedSupplierForStatement] = useState<SupplierProfile | null>(null);

  // Security Wipe Modal
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipePassword, setWipePassword] = useState('');
  const [wipeReason, setWipeReason] = useState('');
  const [wipeError, setWipeError] = useState('');
  const [wipeSuccess, setWipeSuccess] = useState(false);
  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

  // Time Period & Date Filters
  const [timePeriod, setTimePeriod] = useState<'all' | 'today' | 'month' | 'quarter' | 'half_year' | 'year'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [selectedHalf, setSelectedHalf] = useState<'H1' | 'H2'>('H1');

  // View Mode: Tables vs Charts vs Infographics
  const [viewMode, setViewMode] = useState<'tables' | 'charts' | 'infographics'>('tables');

  // Financial Closings state
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingType, setClosingType] = useState<'monthly' | 'quarterly' | 'semi_annual' | 'annual'>('monthly');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingSuccessNotice, setClosingSuccessNotice] = useState('');
  const [closingSnapshots, setClosingSnapshots] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem(`alshams_financial_closings_${tenantId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const loadAllFinancials = async () => {
    try {
      const balances = await tenantStorage.getSafeBalances(tenantId);
      const safeTxs = await tenantStorage.getSafeTransactions(tenantId);
      const ords = await tenantStorage.getOrders(tenantId);
      const sups = await tenantStorage.getSuppliers(tenantId);
      const invoices = await tenantStorage.getSupplierInvoices(tenantId);
      const admins = await tenantStorage.getAdminCosts(tenantId);
      const payouts = await tenantStorage.getEmployeePayouts(tenantId);
      const logs = await tenantStorage.getActivityLogs(tenantId);
      const mats = await tenantStorage.getRawMaterials(tenantId);
      const assets = await tenantStorage.getFixedAssets(tenantId);

      let effectiveBalances = {
        mainSafe: balances.mainSafe || 0,
        subSafe: balances.subSafe || 0,
        unsettledCustodies: (balances as any).unsettledCustodies || 0,
      };

      // Live fetch from Supabase treasuries if available
      try {
        const { data: supaTreasuries } = await getTreasuryBalancesFromSupabase(tenantId);
        if (supaTreasuries && supaTreasuries.length > 0) {
          const mainTreasury = supaTreasuries.find(
            (t) => t.is_main || t.kind === 'main' || t.name?.includes('رئيسي') || t.id === 'main'
          );
          const subTreasuryList = supaTreasuries.filter(
            (t) => t.kind === 'sub' || (!t.is_main && t.kind !== 'custody' && t.id !== mainTreasury?.id)
          );
          const openCustodies = supaTreasuries.filter((t) => t.kind === 'custody' && t.status === 'open');

          const subTotalBalance = subTreasuryList.reduce((sum, st) => sum + Number(st.balance || 0), 0);
          const custodyTotalBalance = openCustodies.reduce((sum, c) => sum + Number(c.balance || 0), 0);

          effectiveBalances = {
            mainSafe: mainTreasury ? Number(mainTreasury.balance || 0) : effectiveBalances.mainSafe,
            subSafe: subTreasuryList.length > 0 ? subTotalBalance : effectiveBalances.subSafe,
            unsettledCustodies: custodyTotalBalance,
          };
          setOpenCustodiesList(openCustodies);
        }
      } catch (e) {
        // Local mode fallback
      }

      setSafeBalances(effectiveBalances);
      setSafeTransactions(safeTxs);
      setOrders(ords);
      setSuppliers(sups);
      setSupplierInvoices(invoices);
      setAdminCosts(admins);
      setEmployeePayouts(payouts);
      setActivityLogs(logs);
      setMaterials(mats);
      setFixedAssets(assets);

      if (sups.length > 0 && !selectedSupplierForStatement) {
        setSelectedSupplierForStatement(sups[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAllFinancials();

    const handleDataUpdate = (event?: any) => {
      // If event provides detail balances, update state immediately without waiting
      if (event?.detail?.balances && Array.isArray(event.detail.balances)) {
        const supaTreasuries: SupabaseTreasuryBalance[] = event.detail.balances;
        const mainTreasury = supaTreasuries.find(
          (t) => t.is_main || t.kind === 'main' || t.name?.includes('رئيسي') || t.id === 'main'
        );
        const subTreasuryList = supaTreasuries.filter(
          (t) => t.kind === 'sub' || (!t.is_main && t.kind !== 'custody' && t.id !== mainTreasury?.id)
        );
        const openCustodies = supaTreasuries.filter((t) => t.kind === 'custody' && t.status === 'open');

        const subTotalBalance = subTreasuryList.reduce((sum, st) => sum + Number(st.balance || 0), 0);
        const custodyTotalBalance = openCustodies.reduce((sum, c) => sum + Number(c.balance || 0), 0);

        setSafeBalances((prev) => ({
          mainSafe: mainTreasury ? Number(mainTreasury.balance || 0) : prev.mainSafe,
          subSafe: subTreasuryList.length > 0 ? subTotalBalance : prev.subSafe,
          unsettledCustodies: custodyTotalBalance,
        }));
        setOpenCustodiesList(openCustodies);
      }
      loadAllFinancials();
    };

    window.addEventListener('alshams_financials_updated', handleDataUpdate);
    window.addEventListener('alshams_treasury_updated', handleDataUpdate);
    window.addEventListener('alshams_fixed_assets_changed', handleDataUpdate);
    window.addEventListener('alshams_currency_rates_changed', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    // Attach Supabase real-time listener for instant live updates across tabs & devices
    const realtimeChannel = supabase
      .channel(`reports_realtime_${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasuries', filter: `workshop_id=eq.${tenantId}` },
        () => {
          loadAllFinancials();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safe_transactions', filter: `workshop_id=eq.${tenantId}` },
        () => {
          loadAllFinancials();
        }
      )
      .subscribe();

    // Continuous auto-refresh every 10 seconds for live figures
    const intervalId = setInterval(loadAllFinancials, 10000);

    return () => {
      supabase.removeChannel(realtimeChannel);
      window.removeEventListener('alshams_financials_updated', handleDataUpdate);
      window.removeEventListener('alshams_treasury_updated', handleDataUpdate);
      window.removeEventListener('alshams_fixed_assets_changed', handleDataUpdate);
      window.removeEventListener('alshams_currency_rates_changed', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
      clearInterval(intervalId);
    };
  }, [tenantId]);

  // Fixed Assets Calculations
  const totalFixedAssetsCost = fixedAssets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
  const totalAnnualDepreciation = fixedAssets.reduce((sum, a) => sum + (a.annualDepreciation || 0), 0);
  const totalAccumulatedDepreciation = fixedAssets.reduce((sum, a) => sum + (a.accumulatedDepreciation || 0), 0);
  const totalNetBookValue = fixedAssets.reduce((sum, a) => sum + (a.currentBookValue || 0), 0);

  // Time Period Filtering Function
  const isWithinPeriod = (dateStr?: string | null) => {
    if (timePeriod === 'all' || !dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-12

    if (timePeriod === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return dateStr.startsWith(today);
    }
    if (timePeriod === 'month') {
      return y === selectedYear && m === selectedMonth;
    }
    if (timePeriod === 'quarter') {
      if (y !== selectedYear) return false;
      if (selectedQuarter === 'Q1') return m >= 1 && m <= 3;
      if (selectedQuarter === 'Q2') return m >= 4 && m <= 6;
      if (selectedQuarter === 'Q3') return m >= 7 && m <= 9;
      if (selectedQuarter === 'Q4') return m >= 10 && m <= 12;
    }
    if (timePeriod === 'half_year') {
      if (y !== selectedYear) return false;
      if (selectedHalf === 'H1') return m >= 1 && m <= 6;
      if (selectedHalf === 'H2') return m >= 7 && m <= 12;
    }
    if (timePeriod === 'year') {
      return y === selectedYear;
    }
    return true;
  };

  const filteredOrders = orders.filter((o) => isWithinPeriod(o.date));
  const filteredSupplierInvoices = supplierInvoices.filter((inv) => isWithinPeriod(inv.date));
  const filteredEmployeePayouts = employeePayouts.filter((p) => isWithinPeriod(p.date));
  const filteredAdminCosts = adminCosts.filter((a) => isWithinPeriod(a.date));
  const filteredSafeTransactions = safeTransactions.filter((t) => isWithinPeriod(t.date));

  // Pro-rated period depreciation
  const periodDepreciation =
    timePeriod === 'today'
      ? totalAnnualDepreciation / 365
      : timePeriod === 'month'
      ? totalAnnualDepreciation / 12
      : timePeriod === 'quarter'
      ? totalAnnualDepreciation / 4
      : timePeriod === 'half_year'
      ? totalAnnualDepreciation / 2
      : totalAnnualDepreciation;

  // Aggregate calculations with period filtering
  const totalSalesRevenue = filteredOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
  const totalMaterialPurchasesPaid = filteredSupplierInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalPayrollOperatingExpenses = filteredEmployeePayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalAdminOperatingExpenses = filteredAdminCosts.reduce((sum, a) => sum + (a.baseCurrencyAmount || a.amount || 0), 0);
  const totalOperatingCosts = totalMaterialPurchasesPaid + totalPayrollOperatingExpenses + totalAdminOperatingExpenses + periodDepreciation;
  const netEstimatedProfit = totalSalesRevenue - totalOperatingCosts;

  // Double-Entry Ledger Matrix:
  const currentInventoryStockValue = materials.reduce(
    (sum, m) => sum + (Number(m.currentStock) || 0) * (Number(m.costPerUnit || (m as any).defaultCostPerUnit) || 0),
    0
  );
  const inventoryDebit = totalMaterialPurchasesPaid + currentInventoryStockValue;
  const estimatedConsumedMaterials = Math.round(filteredOrders.reduce((sum, o) => sum + (o.finalTotal || 0) * 0.45, 0));
  const inventoryCredit = estimatedConsumedMaterials;
  const inventoryNetBalance = Math.max(0, inventoryDebit - inventoryCredit);

  // Dynamic Main Safe debit, credit, and balance
  const mainSafeDebit = filteredSafeTransactions
    .filter((t) => t.safeType === 'main' && Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const mainSafeCredit = filteredSafeTransactions
    .filter((t) => t.safeType === 'main' && Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const mainSafeCalculatedNet = mainSafeDebit - mainSafeCredit;
  const mainSafeLiveBalance = timePeriod === 'all' && safeBalances.mainSafe !== 0 ? safeBalances.mainSafe : mainSafeCalculatedNet;

  // Dynamic Sub Safe debit, credit, and balance (includes all sub treasuries)
  const subSafeDebit = filteredSafeTransactions
    .filter((t) => t.safeType === 'sub' && Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const subSafeCredit = filteredSafeTransactions
    .filter((t) => t.safeType === 'sub' && Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const subSafeCalculatedNet = subSafeDebit - subSafeCredit;
  const subSafeLiveBalance = timePeriod === 'all' && safeBalances.subSafe !== 0 ? safeBalances.subSafe : subSafeCalculatedNet;

  // Dynamic Unsettled Custodies (عهد العاملين والتشغيل غير المسواة)
  const custodiesTxDebit = filteredSafeTransactions
    .filter((t) => (t.safeType === 'custody' || (t as any).type === 'custody') && Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const custodiesTxCredit = filteredSafeTransactions
    .filter((t) => (t.safeType === 'custody' || (t as any).type === 'custody') && Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const custodiesCalculatedNet = custodiesTxDebit - custodiesTxCredit;
  const unsettledCustodiesLiveBalance =
    (safeBalances.unsettledCustodies ?? 0) > 0
      ? (safeBalances.unsettledCustodies ?? 0)
      : Math.max(0, custodiesCalculatedNet);

  const trialRows = [
    {
      code: '1101',
      name: 'مخزون خامات الورشة (Inventories Ledger)',
      type: 'أصول متداولة',
      debit: inventoryDebit,
      credit: inventoryCredit,
      balance: inventoryNetBalance,
      balanceType: 'مدين',
      notes: 'رصيد الخيوط والأخشاب والإكسسوارات والمشتريات',
    },
    {
      code: '1102',
      name: 'الخزينة الرئيسية (Main Safe Ledger)',
      type: 'أصول نقدية',
      debit: mainSafeDebit,
      credit: mainSafeCredit,
      balance: Math.abs(mainSafeLiveBalance),
      balanceType: mainSafeLiveBalance >= 0 ? 'مدين' : 'دائن',
      notes: 'مقبوضات المبيعات الكبرى وتسويات التوريد',
    },
    {
      code: '1103',
      name: 'الخزينة الفرعية (Sub-Safe Ledger)',
      type: 'أصول نقدية',
      debit: subSafeDebit,
      credit: subSafeCredit,
      balance: Math.abs(subSafeLiveBalance),
      balanceType: subSafeLiveBalance >= 0 ? 'مدين' : 'دائن',
      notes: 'سلف العمالة والمصروفات اليومية والنثريات للخزن الفرعية',
    },
    {
      code: '1104',
      name: 'العهد التي لم يتم تسويتها (Unsettled Custodies Ledger)',
      type: 'أصول متداولة (عهد مؤقتة)',
      debit: unsettledCustodiesLiveBalance,
      credit: 0,
      balance: Math.abs(unsettledCustodiesLiveBalance),
      balanceType: 'مدين',
      notes: 'العهد النقدية المفتوحة المصروفة للمسؤولين لمشتريات الورشة تحت التسوية',
    },
    {
      code: '4101',
      name: 'إيرادات مبيعات المشغولات (Sales Revenue)',
      type: 'إيرادات تشغيلية',
      debit: 0,
      credit: totalSalesRevenue,
      balance: totalSalesRevenue,
      balanceType: 'دائن',
      notes: 'إجمالي المقبوضات المحصلة من العملاء',
    },
    {
      code: '5101',
      name: 'مصنعيات وأجور التشغيل (Operational Wages)',
      type: 'مصروفات تشغيلية',
      debit: totalPayrollOperatingExpenses,
      credit: 0,
      balance: totalPayrollOperatingExpenses,
      balanceType: 'مدين',
      notes: 'رواتب العمالة الحرفية والمصنعيات وسلف الشغل',
    },
    {
      code: '5201',
      name: 'التكاليف الإدارية الموحدة (Unified Admin Costs)',
      type: 'مصروفات إدارية وعمومية',
      debit: totalAdminOperatingExpenses,
      credit: 0,
      balance: totalAdminOperatingExpenses,
      balanceType: 'مدين',
      notes: 'إيجار الورشة، الكهرباء، الدعاية، والنقل والتغليف',
    },
    {
      code: '1201',
      name: 'الأصول الثابتة للورشة (Fixed Assets - Gross)',
      type: 'أصول غير متداولة',
      debit: totalFixedAssetsCost,
      credit: 0,
      balance: totalFixedAssetsCost,
      balanceType: 'مدين',
      notes: 'الأنوال والمعدات وطاولات القص وأجهزة الورشة',
    },
    {
      code: '1209',
      name: 'مجمع إهلاك الأصول الثابتة (Accumulated Depreciation)',
      type: 'أصول غير متداولة (مُخفّض)',
      debit: 0,
      credit: totalAccumulatedDepreciation,
      balance: totalAccumulatedDepreciation,
      balanceType: 'دائن',
      notes: 'الإهلاك المتراكم المحسوب للأصول حتى اليوم',
    },
    {
      code: '5301',
      name: 'قسط إهلاك الأصول السنوي (Annual Depreciation)',
      type: 'مصروفات تشغيلية',
      debit: totalAnnualDepreciation,
      credit: 0,
      balance: totalAnnualDepreciation,
      balanceType: 'مدين',
      notes: 'قسط الإهلاك السنوي المحمّل على تشغيل الورشة',
    },
  ];

  const grandTotalDebit = trialRows.reduce((sum, r) => sum + r.debit, 0);
  const grandTotalCredit = trialRows.reduce((sum, r) => sum + r.credit, 0);

  // Export functions (CSV Excel Trigger)
  const exportToExcelCSV = (filename: string, rows: string[][]) => {
    const csvContent =
      '\uFEFF' + rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFixedAssets = () => {
    const headers = ['كود الأصل', 'اسم الأصل', 'التصنيف', 'تاريخ الشراء', 'تكلفة الشراء', 'العمر الافتراضي', 'قيمة التخريد', 'الإهلاك السنوي', 'الإهلاك المتراكم', 'صافي القيمة الدفترية'];
    const rows = fixedAssets.map((a) => [
      a.assetCode || a.id,
      a.assetName || a.name || '',
      a.category,
      a.purchaseDate,
      String(a.purchaseCost),
      String(a.usefulLifeYears),
      String(a.scrapValue),
      String(a.annualDepreciation),
      String(a.accumulatedDepreciation),
      String(a.currentBookValue),
    ]);
    exportToExcelCSV('سجل_الأصول_الثابتة_للورشة', [headers, ...rows]);
  };

  const handleExportSuppliers = () => {
    const headers = ['اسم المورد', 'الشركة', 'الهاتف', 'إجمالي المشتريات', 'المسدد', 'المتبقي الآجل'];
    const rows = suppliers.map((s) => [
      s.name || '',
      s.companyName || '',
      s.phoneNumber || s.phone || '',
      String(s.totalPurchases || 0),
      String(s.totalPaid || 0),
      String(s.outstandingBalance || 0),
    ]);
    exportToExcelCSV('كشف_الموردين_الشمس_كرافت', [headers, ...rows]);
  };

  const handleExportOrders = () => {
    const headers = ['رقم الطلبية', 'العميل', 'التاريخ', 'الإجمالي', 'المدفوع', 'المتبقي', 'الخزينة'];
    const rows = orders.map((o) => [
      o.id,
      o.customerName || 'عميل',
      o.date || '',
      String(o.finalTotal || o.totalAmount || 0),
      String(o.amountPaid || o.paidAmount || 0),
      String(o.remainingAmount || 0),
      (o.safeType || 'main') === 'main' ? 'خزينة رئيسية' : 'خزينة فرعية',
    ]);
    exportToExcelCSV('سجل_المبيعات_الشمس_كرافت', [headers, ...rows]);
  };

  const handlePrint = () => {
    window.print();
  };

  // Secure Database Wipe
  const handleWipeDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setWipeError('');

    try {
      await tenantStorage.wipeDatabaseWithAuth(
        profile.tenantId || profile.workshopId || profile.id,
        wipePassword,
        wipeReason,
        profile.email
      );
      setWipeSuccess(true);
      await loadAllFinancials();
      setTimeout(() => {
        setIsWipeModalOpen(false);
        setWipeSuccess(false);
        setWipePassword('');
        setWipeReason('');
      }, 2000);
    } catch (err: any) {
      setWipeError(err.message || 'فشل التصفير، تحقق من كلمة المرور');
    }
  };

  // Financial Closing Action
  const handleExecuteClosing = () => {
    const periodLabel =
      closingType === 'monthly'
        ? `الشهر ${selectedMonth} لسنة ${selectedYear}`
        : closingType === 'quarterly'
        ? `الربع ${selectedQuarter} لسنة ${selectedYear}`
        : closingType === 'semi_annual'
        ? `النصف ${selectedHalf} لسنة ${selectedYear}`
        : `السنة المالية ${selectedYear}`;

    const closingRecord = {
      id: `close_${Date.now()}`,
      type: closingType,
      periodLabel,
      closingDate: new Date().toISOString(),
      totalSalesRevenue,
      totalOperatingCosts,
      netEstimatedProfit,
      totalFixedAssetsCost,
      totalNetBookValue,
      currentInventoryStockValue,
      mainSafeLiveBalance,
      subSafeLiveBalance,
      unsettledCustodiesLiveBalance,
      notes: closingNotes || 'إقفال حسابات رسمي معتمد',
      closedBy: profile.brandName || profile.email,
    };

    const updatedSnapshots = [closingRecord, ...closingSnapshots];
    setClosingSnapshots(updatedSnapshots);
    try {
      localStorage.setItem(`alshams_financial_closings_${tenantId}`, JSON.stringify(updatedSnapshots));
    } catch (e) {
      console.error(e);
    }

    setClosingSuccessNotice(`تم اعتماد وحفظ إقفال (${periodLabel}) بنجاح!`);
    setTimeout(() => {
      setClosingSuccessNotice('');
      setIsClosingModalOpen(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Print-only Official Header */}
      <div className="hidden print:block text-right mb-6 border-b-2 border-stone-800 pb-4">
        <h1 className="text-xl font-black">منظومة الشمساوية • {profile.brandName}</h1>
        <p className="text-xs text-stone-600">التقرير المالي والمحاسبي المعتمد • تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</p>
        <p className="text-xs text-stone-600 font-bold">
          الفترة: {timePeriod === 'all' ? 'كامل السجلات التاريخية' : timePeriod === 'today' ? 'اليوم' : timePeriod === 'month' ? `شهر ${selectedMonth} لسنة ${selectedYear}` : timePeriod === 'quarter' ? `الربع ${selectedQuarter} لسنة ${selectedYear}` : timePeriod === 'half_year' ? `النصف ${selectedHalf} لسنة ${selectedYear}` : `السنة المالية ${selectedYear}`}
        </p>
      </div>

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent border border-blue-300/40 dark:border-blue-800/40 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
            <BarChart3 className="w-4 h-4" />
            <span>التقارير التحليلية والمالية الشاملة (SaaS ERP Analytics)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            مؤشرات الأداء، الأرباح، وحركة الخزائن
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsClosingModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
          >
            <Award className="w-4 h-4" />
            <span>إقفال الفترة والتقفيل المالي</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">طباعة التقرير</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWipeModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-300/50 flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>تصفير قاعدة البيانات (محمي)</span>
          </button>
        </div>
      </div>

      {/* FILTER & VIEW MODE TOOLBAR */}
      <div className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 print:hidden shadow-xs">
        {/* Row 1: Period Selection */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
            <span className="text-stone-400 flex items-center gap-1 ml-2">
              <CalendarRange className="w-4 h-4 text-blue-600" />
              <span>فترة التقرير:</span>
            </span>

            {[
              { id: 'all', label: 'كامل السجلات' },
              { id: 'today', label: 'اليوم' },
              { id: 'month', label: 'شهري' },
              { id: 'quarter', label: 'ربع سنوي' },
              { id: 'half_year', label: 'نصف سنوي' },
              { id: 'year', label: 'العام المالي' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTimePeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  timePeriod === p.id
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sub-selectors */}
          <div className="flex items-center gap-2 text-xs font-bold">
            {timePeriod === 'month' && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  {[
                    'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)',
                    'مايو (5)', 'يونيو (6)', 'يوليو (7)', 'أغسطس (8)',
                    'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
                  ].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-center font-bold"
                />
              </div>
            )}

            {timePeriod === 'quarter' && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="Q1">الربع الأول (يناير - مارس)</option>
                  <option value="Q2">الربع الثاني (أبريل - يونيو)</option>
                  <option value="Q3">الربع الثالث (يوليو - سبتمبر)</option>
                  <option value="Q4">الربع الرابع (أكتوبر - ديسمبر)</option>
                </select>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-center font-bold"
                />
              </div>
            )}

            {timePeriod === 'half_year' && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedHalf}
                  onChange={(e) => setSelectedHalf(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="H1">النصف الأول (يناير - يونيو)</option>
                  <option value="H2">النصف الثاني (يوليو - ديسمبر)</option>
                </select>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-20 px-2 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-center font-bold"
                />
              </div>
            )}

            {timePeriod === 'year' && (
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400">السنة:</span>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-24 px-2 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-center font-bold"
                />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: View Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-bold ml-1">طريقة العرض:</span>
            <div className="inline-flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setViewMode('tables')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'tables'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs font-black'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>جداول تفصيلية</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('charts')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'charts'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs font-black'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>رسومات بيانية تفاعلية</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('infographics')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'infographics'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs font-black'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>إنفوجرافيك ومؤشرات</span>
              </button>
            </div>
          </div>

          <div className="text-xs font-mono font-bold text-stone-500">
            <span>صافي أرباح الفترة: </span>
            <span className={netEstimatedProfit >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
              {netEstimatedProfit.toLocaleString()} {profile.currencySymbol}
            </span>
          </div>
        </div>
      </div>

      {/* Tables View Mode */}
      {viewMode === 'tables' && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('trial_balance')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'trial_balance'
              ? 'bg-amber-600 text-white shadow-md font-black'
              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>ميزان المراجعة المحاسبي (Double-Entry)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sales_audit')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'sales_audit'
              ? 'bg-amber-600 text-white shadow-md font-black'
              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>سجل تدقيق حالات المبيعات (Audit Ledger)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financial')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'financial'
              ? 'bg-blue-600 text-white shadow-md font-black'
              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border'
          }`}
        >
          قائمة الأرباح والخسائر
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('safes')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'safes'
              ? 'bg-blue-600 text-white shadow-md font-black'
              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>حركة الخزينة الرئيسية والفرعية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'suppliers'
              ? 'bg-blue-600 text-white shadow-md font-black'
              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>كشوف حساب الموردين والآجلة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit_logs')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'audit_logs'
              ? 'bg-blue-600 text-white shadow-md font-black'
              : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>تقرير حركة المنظومة والأمان ({activityLogs.length})</span>
        </button>
      </div>

      {/* TAB 0: SAAS ACCOUNTING LEDGER & TRIAL BALANCE SHEET */}
      {activeTab === 'trial_balance' && (
        <div className="space-y-6">
          {/* Printable Double-Entry Accounting Matrix Table */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl space-y-5 print:p-0 print:border-none print:shadow-none">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                    <Scale className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">
                      ميزان المراجعة المحاسبي العام (Double-Entry Trial Balance)
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">
                      جدول القيد المزدوج لمطابقة الأرصدة وحركات الخامات والخزائن والإيرادات والأجور
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة ميزان المراجعة المعتمد</span>
                </button>
              </div>
            </div>

            {/* Trial Balance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 font-bold bg-stone-50/50 dark:bg-stone-800/40">
                    <th className="p-3">كود</th>
                    <th className="p-3">اسم الحساب والبيان</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3 font-mono text-emerald-700 dark:text-emerald-400">مدين (+) Debit</th>
                    <th className="p-3 font-mono text-purple-700 dark:text-purple-400">دائن (-) Credit</th>
                    <th className="p-3 font-mono">الرصيد الصافي</th>
                    <th className="p-3">طبيعة الرصيد</th>
                    <th className="p-3 hidden md:table-cell">الإيضاح المحاسبي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                  {trialRows.map((row) => (
                    <tr key={row.code} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition">
                      <td className="p-3 font-mono text-stone-400">{row.code}</td>
                      <td className="p-3 font-bold text-stone-900 dark:text-stone-100">{row.name}</td>
                      <td className="p-3 text-stone-500 text-[11px]">{row.type}</td>
                      <td className="p-3 font-mono font-bold text-emerald-600">
                        {row.debit > 0 ? `${row.debit} ${profile.currencySymbol}` : '-'}
                      </td>
                      <td className="p-3 font-mono font-bold text-purple-600">
                        {row.credit > 0 ? `${row.credit} ${profile.currencySymbol}` : '-'}
                      </td>
                      <td className="p-3 font-mono font-black text-stone-900 dark:text-stone-100">
                        {row.balance} {profile.currencySymbol}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.balanceType === 'مدين'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                          }`}
                        >
                          {row.balanceType}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-stone-400 hidden md:table-cell">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/20 font-black text-xs">
                    <td className="p-3 font-mono text-stone-500" colSpan={3}>
                      المجموع العام لميزان المراجعة (Grand Totals):
                    </td>
                    <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                      {grandTotalDebit} {profile.currencySymbol}
                    </td>
                    <td className="p-3 font-mono text-purple-700 dark:text-purple-400 text-sm">
                      {grandTotalCredit} {profile.currencySymbol}
                    </td>
                    <td className="p-3 font-mono text-amber-600 text-sm" colSpan={3}>
                      صافي الفارق التشغيلي: {Math.abs(grandTotalDebit - grandTotalCredit)} {profile.currencySymbol}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Accounting Certificate Footer */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                <span>نظام محاسبي معتمد: ميزان المراجعة متوازن ومدقق محاسبياً بنظام القيد المزدوج.</span>
              </div>
              <span className="font-mono text-[10px] text-stone-500">
                تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: SALES STATUS AUDIT LEDGER */}
      {activeTab === 'sales_audit' && (
        <div className="space-y-5">
          <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>سجل تدقيق ومتابعة حالات المبيعات (Sales Status Audit Ledger)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  تتبع حالات تنفيذ الطلبيات المصنفة: (مكتمل، جاري التنفيذ، جاري الشحن، معلق)
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'delivered', label: 'مكتمل' },
                  { key: 'in_progress', label: 'جاري التنفيذ' },
                  { key: 'shipping', label: 'جاري الشحن' },
                  { key: 'pending', label: 'معلق' },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setAuditFilterStatus(st.key)}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                      auditFilterStatus === st.key
                        ? 'bg-amber-600 text-white shadow-xs font-black'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b text-stone-500 font-bold bg-stone-50/50 dark:bg-stone-800/40">
                    <th className="p-3">رقم الطلبية</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">حالة التنفيذ المعتمدة</th>
                    <th className="p-3 font-mono">قيمة الفاتورة</th>
                    <th className="p-3 font-mono">المسدد</th>
                    <th className="p-3 font-mono">المتبقي</th>
                    <th className="p-3">موعد التسليم</th>
                    <th className="p-3">الموظف المسند</th>
                    <th className="p-3">تاريخ الطلب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                  {orders
                    .filter((ord) => {
                      if (auditFilterStatus === 'all') return true;
                      if (auditFilterStatus === 'delivered') return ord.status === 'delivered';
                      if (auditFilterStatus === 'in_progress') return ord.status === 'in_progress';
                      if (auditFilterStatus === 'shipping') return ord.status === 'shipping' || ord.status === 'ready';
                      if (auditFilterStatus === 'pending') return ord.status === 'pending' || ord.status === 'new';
                      return true;
                    })
                    .map((ord) => {
                      // Status Label & Color
                      let statusBadge = { label: 'معلق', bg: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300' };
                      if (ord.status === 'delivered') {
                        statusBadge = { label: 'مكتمل', bg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300' };
                      } else if (ord.status === 'in_progress') {
                        statusBadge = { label: 'جاري التنفيذ', bg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300' };
                      } else if (ord.status === 'shipping' || ord.status === 'ready') {
                        statusBadge = { label: 'جاري الشحن', bg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300' };
                      }

                      return (
                        <tr key={ord.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition">
                          <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                            #{ord.id.slice(-6)}
                          </td>
                          <td className="p-3 font-bold text-stone-900 dark:text-stone-100">
                            {ord.customerName}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${statusBadge.bg}`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-stone-900 dark:text-stone-100">
                            {ord.finalTotal} {profile.currencySymbol}
                          </td>
                          <td className="p-3 font-mono text-emerald-600 font-bold">
                            +{ord.amountPaid} {profile.currencySymbol}
                          </td>
                          <td className="p-3 font-mono text-rose-600 font-bold">
                            {(ord.remainingAmount ?? 0) > 0 ? `${ord.remainingAmount} ${profile.currencySymbol}` : 'مسدد بالكامل'}
                          </td>
                          <td className="p-3 font-mono text-stone-600 dark:text-stone-300">
                            {ord.deliveryDate || 'غير محدد'}
                          </td>
                          <td className="p-3 text-[11px] text-stone-500">
                            {ord.assignedEmployeeName || 'الورشة المركزية'}
                          </td>
                          <td className="p-3 font-mono text-stone-400 text-[11px]">{ord.date}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL OVERVIEW */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-xs text-stone-500 block">إجمالي المقبوضات النقدية (المبيعات)</span>
              <span className="text-2xl font-black font-mono text-emerald-600 block mt-1">
                +{totalSalesRevenue} {profile.currencySymbol}
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-xs text-stone-500 block">تكلفة خامات التوريد المشتراة</span>
              <span className="text-2xl font-black font-mono text-stone-800 dark:text-stone-200 block mt-1">
                -{totalMaterialPurchasesPaid} {profile.currencySymbol}
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
              <span className="text-xs text-stone-500 block">مصروفات تشغيل أجور ومصنعيات العمالة</span>
              <span className="text-2xl font-black font-mono text-purple-600 block mt-1">
                -{totalPayrollOperatingExpenses} {profile.currencySymbol}
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-xl">
              <span className="text-xs text-blue-100 block">صافي الأرباح التشغيلية المقدرة</span>
              <span className="text-2xl font-black font-mono block mt-1">
                {netEstimatedProfit} {profile.currencySymbol}
              </span>
              <p className="text-[10px] text-blue-200 mt-1">
                المبيعات المحصلة - (الخامات + الأجور + الإدارية)
              </p>
            </div>
          </div>

          {/* Monthly Financial Trends Chart (مقارنة الإنفاق على الخامات بالأرباح شهرياً) */}
          <MonthlyFinancialTrendsChart
            supplierInvoices={supplierInvoices}
            orders={orders}
            employeePayouts={employeePayouts}
            adminCosts={adminCosts}
            currencySymbol={profile.currencySymbol}
          />

          {/* Fixed Assets Financial Section */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-100/70 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                    تقرير الأصول الثابتة والإهلاك السنوي (Fixed Assets & Depreciation)
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    متابعة القيمة الدفترية لمعدات وأنوال وأدوات الورشة وتأثير إهلاكها على نتائج الأعمال
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportFixedAssets}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير الأصول (Excel CSV)</span>
              </button>
            </div>

            {/* Fixed Assets 4 KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right">
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700">
                <span className="text-[11px] font-bold text-stone-500 block">إجمالي تكلفة الأصول</span>
                <span className="text-lg font-black font-mono text-stone-900 dark:text-stone-100 block mt-0.5">
                  {totalFixedAssetsCost.toLocaleString()} {profile.currencySymbol}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700">
                <span className="text-[11px] font-bold text-stone-500 block">مجمع الإهلاك المتراكم</span>
                <span className="text-lg font-black font-mono text-rose-600 block mt-0.5">
                  -{totalAccumulatedDepreciation.toLocaleString()} {profile.currencySymbol}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">صافي القيمة الدفترية</span>
                <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-400 block mt-0.5">
                  {totalNetBookValue.toLocaleString()} {profile.currencySymbol}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700">
                <span className="text-[11px] font-bold text-stone-500 block">قسط الإهلاك السنوي</span>
                <span className="text-lg font-black font-mono text-purple-600 block mt-0.5">
                  {totalAnnualDepreciation.toLocaleString()} {profile.currencySymbol}
                </span>
              </div>
            </div>

            {/* Assets Table Preview */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 font-bold bg-stone-50/50 dark:bg-stone-800/30">
                    <th className="p-2.5">الكود</th>
                    <th className="p-2.5">اسم الأصل والمعدة</th>
                    <th className="p-2.5">التصنيف</th>
                    <th className="p-2.5">تاريخ الشراء</th>
                    <th className="p-2.5 font-mono">تكلفة الشراء</th>
                    <th className="p-2.5 font-mono">الإهلاك السنوي</th>
                    <th className="p-2.5 font-mono">الإهلاك المتراكم</th>
                    <th className="p-2.5 font-mono">القيمة الدفترية الحالية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                  {fixedAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-stone-400 font-bold">
                        لم يتم تسجيل أصول ثابتة للورشة بعد. يمكنك إضافتها من قائمة الأصول الثابتة.
                      </td>
                    </tr>
                  ) : (
                    fixedAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition">
                        <td className="p-2.5 font-mono text-stone-400 text-[11px]">{asset.assetCode || asset.id}</td>
                        <td className="p-2.5 font-bold text-stone-900 dark:text-stone-100">{asset.assetName || asset.name}</td>
                        <td className="p-2.5 text-stone-500 text-[11px]">{asset.category}</td>
                        <td className="p-2.5 font-mono text-stone-500">{asset.purchaseDate}</td>
                        <td className="p-2.5 font-mono font-bold text-stone-800 dark:text-stone-200">
                          {asset.purchaseCost.toLocaleString()} {profile.currencySymbol}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-purple-600">
                          {asset.annualDepreciation.toLocaleString()} {profile.currencySymbol}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-rose-600">
                          -{asset.accumulatedDepreciation.toLocaleString()} {profile.currencySymbol}
                        </td>
                        <td className="p-2.5 font-mono font-black text-amber-700 dark:text-amber-400">
                          {asset.currentBookValue.toLocaleString()} {profile.currencySymbol}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleExportOrders}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير سجل المبيعات (Excel CSV)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SAFES LEDGER */}
      {activeTab === 'safes' && (
        <div className="space-y-5">
          {/* 4 KPI Cards for Liquidity & Custodies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Main Safe */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-800 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-100">رصيد الخزينة الرئيسية</span>
                <Wallet className="w-5 h-5 text-emerald-200" />
              </div>
              <span className="text-2xl sm:text-3xl font-black font-mono block mt-2">
                {safeBalances.mainSafe} {profile.currencySymbol}
              </span>
              <span className="text-[11px] text-emerald-200 mt-1 block">
                مخصصة للمبيعات الكبرى وتسويات التوريد
              </span>
            </div>

            {/* Card 2: Sub Safes */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-100">رصيد الخزائن الفرعية</span>
                <Wallet className="w-5 h-5 text-amber-200" />
              </div>
              <span className="text-2xl sm:text-3xl font-black font-mono block mt-2">
                {safeBalances.subSafe} {profile.currencySymbol}
              </span>
              <span className="text-[11px] text-amber-200 mt-1 block">
                مخصصة لسلف العمالة والمصروفات اليومية الصغيرة
              </span>
            </div>

            {/* Card 3: Unsettled Custodies */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-100">العهد التي لم يتم تسويتها</span>
                <Building className="w-5 h-5 text-purple-200" />
              </div>
              <span className="text-2xl sm:text-3xl font-black font-mono block mt-2">
                {safeBalances.unsettledCustodies} {profile.currencySymbol}
              </span>
              <span className="text-[11px] text-purple-200 mt-1 block">
                عهدة تشغيل ومشتريات مفتوحة تحت التسوية
              </span>
            </div>

            {/* Card 4: Total Liquidity */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-stone-800 to-stone-900 text-white shadow-lg border border-stone-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-300">إجمالي السيولة النقدية الشاملة</span>
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400 block mt-2">
                {safeBalances.mainSafe + safeBalances.subSafe + safeBalances.unsettledCustodies} {profile.currencySymbol}
              </span>
              <span className="text-[11px] text-stone-400 mt-1 block">
                مجموع الأرصدة النقدية والفرعية والعهد
              </span>
            </div>
          </div>

          {/* Unsettled Custodies Registry Section */}
          {openCustodiesList.length > 0 && (
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-purple-200 dark:border-purple-900/50 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-950 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                  <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    كشف العهد المفتوحة تحت التسوية (Unsettled Custodies Registry)
                  </h3>
                </div>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  {openCustodiesList.length} عهدة قائمة
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b text-stone-500 font-bold bg-purple-50/40 dark:bg-purple-950/20">
                      <th className="p-2.5">اسم العهدة</th>
                      <th className="p-2.5">المستلم / صاحب العهدة</th>
                      <th className="p-2.5 font-mono text-purple-700 dark:text-purple-400">الرصيد المتبقي</th>
                      <th className="p-2.5 font-mono">الكاش</th>
                      <th className="p-2.5 font-mono">المحفظة</th>
                      <th className="p-2.5 font-mono">إنستاباي</th>
                      <th className="p-2.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                    {openCustodiesList.map((c) => (
                      <tr key={c.id} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10">
                        <td className="p-2.5 font-bold text-stone-900 dark:text-stone-100">{c.name}</td>
                        <td className="p-2.5 text-stone-700 dark:text-stone-300 font-bold">{c.holder_name || '-'}</td>
                        <td className="p-2.5 font-mono font-black text-purple-700 dark:text-purple-300">
                          {c.balance} {profile.currencySymbol}
                        </td>
                        <td className="p-2.5 font-mono text-stone-600 dark:text-stone-400">{c.cash || 0}</td>
                        <td className="p-2.5 font-mono text-stone-600 dark:text-stone-400">{c.wallet || 0}</td>
                        <td className="p-2.5 font-mono text-stone-600 dark:text-stone-400">{c.instapay || 0}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300">
                            مفتوحة تحت التسوية
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
              سجل حركات الخزائن والتدفقات النقدية
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b text-stone-500 font-bold">
                    <th className="p-2.5">الخزينة</th>
                    <th className="p-2.5">البيان</th>
                    <th className="p-2.5">المبلغ</th>
                    <th className="p-2.5">الرصيد بعدها</th>
                    <th className="p-2.5">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
                  {safeTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                      <td className="p-2.5 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.safeType === 'main'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : tx.safeType === 'custody'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {tx.safeType === 'main' ? 'رئيسية' : tx.safeType === 'custody' ? 'عهدة' : 'فرعية'}
                        </span>
                      </td>
                      <td className="p-2.5 font-sans font-bold text-stone-800 dark:text-stone-200">
                        {tx.description}
                      </td>
                      <td
                        className={`p-2.5 font-bold ${
                          tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} {profile.currencySymbol}
                      </td>
                      <td className="p-2.5 font-bold text-stone-700 dark:text-stone-300">
                        {tx.balanceAfter} {profile.currencySymbol}
                      </td>
                      <td className="p-2.5 text-stone-400">{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIER STATEMENTS & TENDERS */}
      {activeTab === 'suppliers' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={handleExportSuppliers}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>تصدير كشف الموردين (Excel CSV)</span>
            </button>
            <span className="text-xs text-stone-500 font-bold">
              كشوف حساب الموردين والآجلة المسددة والمعلقة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Suppliers List */}
            <div className="space-y-2 md:col-span-1">
              <span className="text-xs font-bold text-stone-600 dark:text-stone-400 block mb-1">
                اختيار المورد لعرض كشف الحساب:
              </span>
              {suppliers.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSupplierForStatement(s)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition text-right ${
                    selectedSupplierForStatement?.id === s.id
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm'
                      : 'border-stone-200 dark:border-stone-800 hover:border-blue-300'
                  }`}
                >
                  <h4 className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                    {s.name}
                  </h4>
                  <p className="text-xs text-stone-500">{s.companyName}</p>
                  <div className="mt-2 flex justify-between text-xs font-mono">
                    <span className="text-stone-400">الآجل المعلق:</span>
                    <span className="font-bold text-rose-600">
                      {s.outstandingBalance} {profile.currencySymbol}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Statement Printable Sheet View */}
            <div className="md:col-span-2 p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              {selectedSupplierForStatement ? (
                <>
                  <div className="border-b pb-3 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة كشف الحساب</span>
                    </button>

                    <div className="text-right">
                      <h3 className="font-black text-base text-stone-900 dark:text-stone-100">
                        كشف حساب المورد: {selectedSupplierForStatement.name}
                      </h3>
                      <p className="text-xs text-stone-500">
                        {selectedSupplierForStatement.companyName || ''} • {selectedSupplierForStatement.phoneNumber || selectedSupplierForStatement.phone || ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800 border">
                      <span className="text-stone-400 text-[10px] block">إجمالي المشتريات</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {selectedSupplierForStatement.totalPurchases} {profile.currencySymbol}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300">
                      <span className="text-emerald-700 dark:text-emerald-300 text-[10px] block">
                        الدفعات المسددة
                      </span>
                      <span className="font-bold text-emerald-600">
                        {selectedSupplierForStatement.totalPaid} {profile.currencySymbol}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300">
                      <span className="text-rose-700 dark:text-rose-300 text-[10px] block font-bold">
                        الآجلة المتبقية
                      </span>
                      <span className="font-bold text-rose-600 text-sm">
                        {selectedSupplierForStatement.outstandingBalance} {profile.currencySymbol}
                      </span>
                    </div>
                  </div>

                  {/* Transaction Logs */}
                  <div className="pt-2">
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-2">
                      سجل فواتير التوريد وسندات الصرف المسجلة:
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b text-stone-500 font-bold">
                            <th className="p-2">التاريخ</th>
                            <th className="p-2">رقم الفاتورة</th>
                            <th className="p-2">إجمالي الفاتورة</th>
                            <th className="p-2">المسدد</th>
                            <th className="p-2">المتبقي الآجل</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
                          {supplierInvoices
                            .filter((inv) => inv.supplierId === selectedSupplierForStatement.id)
                            .map((inv) => (
                              <tr key={inv.id}>
                                <td className="p-2 text-stone-400">{inv.date}</td>
                                <td className="p-2 font-bold">#{inv.invoiceNumber || inv.id.slice(-4)}</td>
                                <td className="p-2">{inv.totalAmount} {profile.currencySymbol}</td>
                                <td className="p-2 text-emerald-600 font-bold">+{inv.paidAmount}</td>
                                <td className="p-2 text-rose-600">{inv.remainingAmount}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-stone-400 text-xs">
                  اختر مورداً من القائمة لعرض كشف الحساب التفصيلي
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM ACTIVITY & SECURITY AUDIT REPORT (تقرير حركة المنظومة) */}
      {activeTab === 'audit_logs' && (
        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-xs text-stone-500 font-mono">
              SECURITY AUDIT LOGS (WHO DELETED WHAT, WHEN & WHY)
            </span>
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <History className="w-4 h-4 text-rose-600" />
              <span>تقرير حركة المنظومة وإجراءات الأمان الصارمة</span>
            </h3>
          </div>

          {activityLogs.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              لا توجد عمليات حذف أو تصفير مسجلة في تقرير الحركة حتى الآن. المنظومة آمنة ومستقرة.
            </div>
          ) : (
            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-stone-900 dark:text-stone-100">
                          {log.entityName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 font-bold">
                          {log.actionType}
                        </span>
                      </div>
                      <p className="text-rose-600 dark:text-rose-400 font-bold mt-1">
                        سبب الإجراء الموثق: "{log.reason}"
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        المستخدم المسؤول: {log.userEmail} • تصريح كلمة المرور: مؤكد
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-stone-400 self-end sm:self-center">
                    {new Date(log.timestamp).toLocaleString('ar-EG')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* CHARTS VIEW MODE (RECHARTS INTERACTIVE VISUALIZATIONS) */}
      {viewMode === 'charts' && (
        <div className="space-y-6">
          {/* Primary Trend: Monthly Spending vs Net Profit */}
          <MonthlyFinancialTrendsChart
            supplierInvoices={supplierInvoices}
            orders={orders}
            employeePayouts={employeePayouts}
            adminCosts={adminCosts}
            currencySymbol={profile.currencySymbol}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Profit & Loss Analysis */}
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-stone-900 dark:text-stone-100">
                    مقارنة الإيرادات بالمصروفات وصافي الأرباح
                  </h4>
                  <p className="text-xs text-stone-400">تحليل الأداء المالي للفترة المحددة</p>
                </div>
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                  <BarChart3 className="w-4 h-4" />
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'إيراد المبيعات', value: totalSalesRevenue, fill: '#2563eb' },
                      { name: 'مشتريات خامات', value: totalMaterialPurchasesPaid, fill: '#0284c7' },
                      { name: 'أجور العمالة', value: totalPayrollOperatingExpenses, fill: '#7c3aed' },
                      { name: 'مصاريف إدارية', value: totalAdminOperatingExpenses, fill: '#ea580c' },
                      { name: 'إهلاك الأصول', value: Math.round(periodDepreciation), fill: '#d97706' },
                      { name: 'صافي الربح', value: netEstimatedProfit, fill: netEstimatedProfit >= 0 ? '#10b981' : '#f43f5e' },
                    ]}
                    margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} ${profile.currencySymbol}`, 'القيمة']} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Expenses Breakdown Pie */}
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-stone-900 dark:text-stone-100">
                    توزيع هيكل المصروفات والتشغيل
                  </h4>
                  <p className="text-xs text-stone-400">نسبة كل عنصر من إجمالي تكاليف الفترة</p>
                </div>
                <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                  <PieIcon className="w-4 h-4" />
                </span>
              </div>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'أجور الفنانين', value: totalPayrollOperatingExpenses || 1 },
                        { name: 'مشتريات خامات', value: totalMaterialPurchasesPaid || 1 },
                        { name: 'تكاليف إدارية', value: totalAdminOperatingExpenses || 1 },
                        { name: 'إهلاك أصول', value: Math.round(periodDepreciation) || 1 },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      <Cell fill="#7c3aed" />
                      <Cell fill="#0284c7" />
                      <Cell fill="#ea580c" />
                      <Cell fill="#d97706" />
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} ${profile.currencySymbol}`, 'المبلغ']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Safes Liquidity Balance */}
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-stone-900 dark:text-stone-100">
                    توزيع السيولة النقدية والعهد المفتوحة
                  </h4>
                  <p className="text-xs text-stone-400">الأرصدة اللحظية المسجلة بالورشة</p>
                </div>
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'الخزينة الرئيسية', balance: mainSafeLiveBalance, fill: '#059669' },
                      { name: 'الخزائن الفرعية', balance: subSafeLiveBalance, fill: '#3b82f6' },
                      { name: 'عهد تحت التسوية', balance: unsettledCustodiesLiveBalance, fill: '#d97706' },
                    ]}
                    margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} ${profile.currencySymbol}`, 'الرصيد']} />
                    <Bar dataKey="balance" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Assets Structure */}
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-stone-900 dark:text-stone-100">
                    هيكل الأصول الاستثمارية للورشة
                  </h4>
                  <p className="text-xs text-stone-400">النقدية، تقييم مخزون الخامات، وصافي الأصول الثابتة</p>
                </div>
                <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                  <Building className="w-4 h-4" />
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'سيولة نقدية (خزن)', value: mainSafeLiveBalance + subSafeLiveBalance, fill: '#10b981' },
                      { name: 'مخزون خامات', value: currentInventoryStockValue, fill: '#f59e0b' },
                      { name: 'أصول ثابتة (صافي)', value: totalNetBookValue, fill: '#6366f1' },
                      { name: 'إجمالي أصول الورشة', value: mainSafeLiveBalance + subSafeLiveBalance + currentInventoryStockValue + totalNetBookValue, fill: '#0ea5e9' },
                    ]}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} ${profile.currencySymbol}`, 'القيمة']} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INFOGRAPHICS VIEW MODE */}
      {viewMode === 'infographics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Infographic 1: Operating Margin */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-white to-white dark:from-emerald-950/30 dark:via-stone-900 dark:to-stone-900 border border-emerald-200 dark:border-emerald-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">هامش الربح التشغيلي</span>
                <span className="p-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100">
                {totalSalesRevenue > 0 ? ((netEstimatedProfit / totalSalesRevenue) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-stone-500">
                نسبة صافي الربح من إجمالي المبيعات المحققة خلال الفترة.
              </p>
              <div className="w-full bg-stone-200 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, totalSalesRevenue > 0 ? (netEstimatedProfit / totalSalesRevenue) * 100 : 0))}%` }}
                />
              </div>
            </div>

            {/* Infographic 2: Working Capital */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 via-white to-white dark:from-blue-950/30 dark:via-stone-900 dark:to-stone-900 border border-blue-200 dark:border-blue-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">رأس المال العامل التشغيلي</span>
                <span className="p-2 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600">
                  <Scale className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100">
                {(mainSafeLiveBalance + subSafeLiveBalance + currentInventoryStockValue).toLocaleString()} {profile.currencySymbol}
              </div>
              <p className="text-xs text-stone-500">
                مجموع السيولة النقدية الجاهزة وقيمة مخزون الخامات المتاح بالورشة.
              </p>
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 pt-1 border-t">
                <span>نقدية: {(mainSafeLiveBalance + subSafeLiveBalance).toLocaleString()}</span>
                <span>مخزون: {currentInventoryStockValue.toLocaleString()}</span>
              </div>
            </div>

            {/* Infographic 3: Expense to Revenue Ratio */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-white to-white dark:from-amber-950/30 dark:via-stone-900 dark:to-stone-900 border border-amber-200 dark:border-amber-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">معدل عبء المصروفات</span>
                <span className="p-2 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                  <TrendingDown className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100">
                {totalSalesRevenue > 0 ? ((totalOperatingCosts / totalSalesRevenue) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-stone-500">
                نسبة المصاريف والتشغيل من كل 100 {profile.currencySymbol} مبيعات.
              </p>
              <div className="w-full bg-stone-200 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, totalSalesRevenue > 0 ? (totalOperatingCosts / totalSalesRevenue) * 100 : 0))}%` }}
                />
              </div>
            </div>

            {/* Infographic 4: Labor to Materials */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/10 via-white to-white dark:from-purple-950/30 dark:via-stone-900 dark:to-stone-900 border border-purple-200 dark:border-purple-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400">نسبة العمالة إلى الخامات</span>
                <span className="p-2 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600">
                  <Users2 className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100">
                {totalMaterialPurchasesPaid > 0 ? ((totalPayrollOperatingExpenses / totalMaterialPurchasesPaid) * 100).toFixed(0) : 0}%
              </div>
              <p className="text-xs text-stone-500">
                كفاءة التشغيل اليدوي: أجور الفنانين مقابل مشتريات الخيوط والخامات.
              </p>
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 pt-1 border-t">
                <span>أجور: {totalPayrollOperatingExpenses.toLocaleString()}</span>
                <span>خامات: {totalMaterialPurchasesPaid.toLocaleString()}</span>
              </div>
            </div>

            {/* Infographic 5: Financial Health Status */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-white to-white dark:from-cyan-950/30 dark:via-stone-900 dark:to-stone-900 border border-cyan-200 dark:border-cyan-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400">مؤشر الملاءة المالية</span>
                <span className="p-2 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600">
                  <Award className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-stone-100">
                {netEstimatedProfit > 0 && mainSafeLiveBalance > 0 ? '🟢 ممتازة وقوية' : netEstimatedProfit >= 0 ? '🟡 متوازنة ومستقرة' : '🔴 تتطلب ترشيد تكاليف'}
              </div>
              <p className="text-xs text-stone-500">
                تقييم فوري يعتمد على تغطية السيولة التشغيلية وصافي عوائد المشغولات.
              </p>
              <div className="text-[11px] text-stone-400 font-bold">
                السيولة الحرة: {(mainSafeLiveBalance + subSafeLiveBalance).toLocaleString()} {profile.currencySymbol}
              </div>
            </div>

            {/* Infographic 6: Fixed Assets Health */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-white to-white dark:from-indigo-950/30 dark:via-stone-900 dark:to-stone-900 border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">القيمة الدفترية للأصول</span>
                <span className="p-2 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600">
                  <Building className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100">
                {totalNetBookValue.toLocaleString()} {profile.currencySymbol}
              </div>
              <p className="text-xs text-stone-500">
                صافي قيمة معدات وماكينات الورشة بعد خصم أقساط الإهلاك المحسوبة.
              </p>
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 pt-1 border-t">
                <span>التكلفة: {totalFixedAssetsCost.toLocaleString()}</span>
                <span>الإهلاك: {totalAccumulatedDepreciation.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINANCIAL CLOSING MODAL */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-xl space-y-4 text-right shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black text-sm">
                <Award className="w-5 h-5 text-amber-600" />
                <span>إقفال الفترة المالية واعتماد القوائم الرسمية</span>
              </div>
            </div>

            {closingSuccessNotice && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{closingSuccessNotice}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1.5">نوع الإقفال المالي *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                {[
                  { id: 'monthly', label: 'إغلاق شهري' },
                  { id: 'quarterly', label: 'إغلاق ربع سنوي' },
                  { id: 'semi_annual', label: 'إغلاق نصف سنوي' },
                  { id: 'annual', label: 'إغلاق السنة المالية' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setClosingType(c.id as any)}
                    className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                      closingType === c.id
                        ? 'bg-amber-600 text-white border-amber-600 font-black'
                        : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Closing Verification Matrix */}
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
              <span className="font-extrabold text-amber-900 dark:text-amber-300 block mb-1">
                ملخص أرقام التقفيل المالي المعتمدة:
              </span>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-2 bg-white dark:bg-stone-900 rounded-xl border">
                  <span className="text-[10px] text-stone-400 block">إيرادات المبيعات:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{totalSalesRevenue.toLocaleString()} {profile.currencySymbol}</span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-xl border">
                  <span className="text-[10px] text-stone-400 block">تكاليف التشغيل والمصروفات:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{totalOperatingCosts.toLocaleString()} {profile.currencySymbol}</span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-xl border">
                  <span className="text-[10px] text-stone-400 block">صافي الأرباح المحققة:</span>
                  <span className={`font-black ${netEstimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{netEstimatedProfit.toLocaleString()} {profile.currencySymbol}</span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-xl border">
                  <span className="text-[10px] text-stone-400 block">رصيد السيولة النقدية:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{(mainSafeLiveBalance + subSafeLiveBalance).toLocaleString()} {profile.currencySymbol}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">ملاحظات وقرارات الإقفال المالي</label>
              <textarea
                rows={2}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="اكتب أي ملاحظات إدارية، ترحيل أرباح، أو تسويات مالية..."
                className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
              />
            </div>

            {/* Previous Closings History */}
            {closingSnapshots.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <span className="text-xs font-bold text-stone-500 block">سجل الإقفالات السابقة ({closingSnapshots.length}):</span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {closingSnapshots.slice(0, 5).map((snap: any) => (
                    <div key={snap.id} className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800 border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold">{snap.periodLabel}</span>
                        <span className="text-[10px] text-stone-400 block font-mono">{new Date(snap.closingDate).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <div className="font-mono text-left">
                        <span className="text-[10px] text-stone-400 block">صافي الربح:</span>
                        <span className={`font-black ${snap.netEstimatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {snap.netEstimatedProfit.toLocaleString()} {profile.currencySymbol}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteClosing}
                className="px-5 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-md"
              >
                اعتماد التقفيل وحفظ السجل الرسمي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STRICT PASSWORD-PROTECTED DATABASE RESET MODAL */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleWipeDatabase}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border-2 border-rose-500 w-full max-w-md space-y-4 text-right"
          >
            <div className="border-b pb-3">
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-black text-sm">بروتوكول تصفير قاعدة البيانات الصارم</h3>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                هذا الإجراء يفرغ سجلات المنتجات والمبيعات والتوريد للبدء من جديد. يتطلب كلمة مرور الحساب وسبباً كتابياً إجبارياً للتوثيق.
              </p>
            </div>

            {wipeError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs font-bold">
                {wipeError}
              </div>
            )}

            {wipeSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                تم تصفير قاعدة البيانات وتوثيق الإجراء في تقرير الحركة بنجاح!
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1">كلمة مرور حساب الورشة *</label>
              <input
                type="password"
                required
                value={wipePassword}
                onChange={(e) => setWipePassword(e.target.value)}
                placeholder="اكتب كلمة مرورك للتأكيد"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">اكتب سبب الحذف والتصفير (إجباري) *</label>
              <textarea
                rows={3}
                required
                value={wipeReason}
                onChange={(e) => setWipeReason(e.target.value)}
                placeholder="اكتب هنا سبب تصفير البيانات بالتفصيل لتوثيقه في تقرير حركة المنظومة..."
                className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
              />
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsWipeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500"
              >
                تراجع وإلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                تأكيد التصفير وتوثيق التقرير
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
