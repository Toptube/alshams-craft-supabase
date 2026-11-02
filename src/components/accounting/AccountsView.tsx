import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  WorkshopProfile,
  CustomerOrder,
  SupplierPurchaseInvoice,
  SafeTransaction,
  AdminCostRecord,
  EmployeePayoutRecord,
  WorkOrderRecord,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  getTreasuryBalancesFromSupabase,
  SupabaseTreasuryBalance,
} from '../../db/supabaseService';
import {
  DisbursementSourceSelector,
  SelectedDisbursementSource,
  recordDisbursementExitTransaction,
} from '../treasuries/DisbursementSourceSelector';
import {
  getLockedMonths,
  isMonthLocked,
  lockFinancialMonth,
  unlockFinancialMonth,
  MonthClosureRecord,
} from '../../lib/monthClosure';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Wallet,
  Receipt,
  FileText,
  DollarSign,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  X,
  Layers,
  Award,
  Users,
  Truck,
  Building,
  ShieldCheck,
  Banknote,
  Smartphone,
  Coins,
  Lock,
  Unlock,
  Calendar,
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';

interface AccountsViewProps {
  workshop: WorkshopProfile | UserProfile;
  onOpenHelp?: (sectionId: string) => void;
  onNavigateToSales?: () => void;
  onNavigateToPurchases?: () => void;
}

interface JournalEntry {
  id: string;
  date: string;
  timestamp: number;
  type: 'inflow' | 'outflow';
  categoryAr: string;
  description: string;
  amount: number;
  vesselName: string;
  referenceType?: string;
  referenceId?: string;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  workshop,
  onOpenHelp,
  onNavigateToSales,
  onNavigateToPurchases,
}) => {
  const workshopId = (workshop as any).tenantId || (workshop as any).workshopId || workshop.id || '';
  const currencySymbol = (workshop as any).currencySymbol || 'ج.م';

  const [activeTab, setActiveTab] = useState<'journal' | 'profit_loss' | 'receivables_payables'>('journal');
  const [loading, setLoading] = useState(true);

  // Raw data from DB
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierPurchaseInvoice[]>([]);
  const [safeTxs, setSafeTxs] = useState<SafeTransaction[]>([]);
  const [adminCosts, setAdminCosts] = useState<AdminCostRecord[]>([]);
  const [payouts, setPayouts] = useState<EmployeePayoutRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [treasuries, setTreasuries] = useState<SupabaseTreasuryBalance[]>([]);

  // Search & Filters for Journal
  const [journalFilter, setJournalFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Settle Modal for Supplier Payable
  const [settlingInvoice, setSettlingInvoice] = useState<SupplierPurchaseInvoice | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleSource, setSettleSource] = useState<SelectedDisbursementSource>({
    id: 'main',
    name: 'الخزينة الرئيسية (النقدية)',
    kind: 'main',
    availableCash: 0,
    availableWallet: 0,
    availableInstapay: 0,
    totalBalance: 0,
  });
  const [settleChannel, setSettleChannel] = useState<'cash' | 'instapay' | 'wallet'>('cash');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // Quick Collect Modal for Customer Receivable
  const [collectingOrder, setCollectingOrder] = useState<CustomerOrder | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectChannel, setCollectChannel] = useState<'cash' | 'instapay' | 'wallet'>('cash');
  const [collectSubmitting, setCollectSubmitting] = useState(false);

  // Financial Month Closure & Audit Lock State
  const [lockedMonths, setLockedMonths] = useState<MonthClosureRecord[]>([]);
  const [selectedClosureMonth, setSelectedClosureMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [closureNotes, setClosureNotes] = useState('');
  const [closureSubmitting, setClosureSubmitting] = useState(false);

  // Notice Toast
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordList, supInvList, safeList, adminList, payList, woList, trRes] = await Promise.all([
        tenantStorage.getOrders(workshopId).catch(() => []),
        tenantStorage.getSupplierInvoices(workshopId).catch(() => []),
        tenantStorage.getSafeTransactions(workshopId).catch(() => []),
        tenantStorage.getAdminCosts(workshopId).catch(() => []),
        tenantStorage.getEmployeePayouts(workshopId).catch(() => []),
        tenantStorage.getWorkOrders(workshopId).catch(() => []),
        getTreasuryBalancesFromSupabase(workshopId).catch(() => ({ data: [] })),
      ]);

      setOrders(ordList);
      setSupplierInvoices(supInvList);
      setSafeTxs(safeList);
      setAdminCosts(adminList);
      setPayouts(payList);
      setWorkOrders(woList);
      setTreasuries((trRes && (trRes as any).data) || []);
      setLockedMonths(getLockedMonths(workshopId));
    } catch (err: any) {
      console.error(err);
      setNotice({ text: err.message || 'فشل تحميل بيانات الحسابات', isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workshopId]);

  useEffect(() => {
    const handleRemote = () => loadData();
    const handleLockedChange = () => setLockedMonths(getLockedMonths(workshopId));

    window.addEventListener('alshams_financials_updated', handleRemote);
    window.addEventListener('alshams_treasury_updated', handleRemote);
    window.addEventListener('alshams_locked_months_changed', handleLockedChange);
    return () => {
      window.removeEventListener('alshams_financials_updated', handleRemote);
      window.removeEventListener('alshams_treasury_updated', handleRemote);
      window.removeEventListener('alshams_locked_months_changed', handleLockedChange);
    };
  }, [workshopId]);

  // 1. Build Unified Journal Entries
  const journalEntries: JournalEntry[] = useMemo(() => {
    const list: JournalEntry[] = [];

    // Sales Orders (Inflows)
    orders.forEach((ord) => {
      const paid = Number(ord.paidAmount || 0);
      if (paid > 0) {
        list.push({
          id: `ord_${ord.id}`,
          date: ord.date || (ord.createdAt ? new Date(ord.createdAt).toISOString().split('T')[0] : ''),
          timestamp: ord.createdAt || Date.now(),
          type: 'inflow',
          categoryAr: 'مبيعات المشغولات',
          description: `تحصيل من العميل "${ord.customerName || 'عميل الورشة'}" - طلبية #${ord.invoiceNumber || ord.id.slice(-4)}`,
          amount: paid,
          vesselName: ord.paymentMethod ? (ord.paymentMethod === 'instapay' ? 'إنستاباي' : ord.paymentMethod === 'wallet' ? 'محفظة' : 'نقدي') : 'الخزينة النقدية',
          referenceType: 'order',
          referenceId: ord.id,
        });
      }
    });

    // Supplier Purchase Invoices (Outflows)
    supplierInvoices.forEach((inv) => {
      const paid = Number(inv.paidAmount || 0);
      if (paid > 0) {
        list.push({
          id: `sup_${inv.id}`,
          date: inv.date || (inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : ''),
          timestamp: inv.createdAt || Date.now(),
          type: 'outflow',
          categoryAr: 'مشتريات خامات',
          description: `سداد فاتورة توريد خامات #${inv.invoiceNumber} للمورد "${inv.supplierName}"`,
          amount: paid,
          vesselName: inv.paymentMethod ? (inv.paymentMethod === 'instapay' ? 'إنستاباي' : inv.paymentMethod === 'wallet' ? 'محفظة' : 'نقدي') : 'الخزينة النقدية',
          referenceType: 'supplier_invoice',
          referenceId: inv.id,
        });
      }
    });

    // Employee Payouts (Outflows)
    payouts.forEach((p) => {
      const amt = Number(p.amount || p.paidAmount || 0);
      if (amt > 0) {
        list.push({
          id: `pay_${p.id}`,
          date: p.date || (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : ''),
          timestamp: p.createdAt || Date.now(),
          type: 'outflow',
          categoryAr: 'أجور ومصنعيات صناع',
          description: `صرف ${p.type === 'advance' ? 'سلفة' : p.type === 'salary' ? 'راتب' : 'أجر مصنعية'} للصانع: ${p.employeeName}`,
          amount: amt,
          vesselName: p.safeType === 'instapay' ? 'إنستاباي' : p.safeType === 'wallet' ? 'محفظة' : 'الخزينة الرئيسية',
          referenceType: 'payroll',
          referenceId: p.id,
        });
      }
    });

    // General & Admin Expenses (Outflows) - exclude payroll if already logged
    adminCosts.forEach((exp) => {
      if (exp.category === 'أجور ومصنعيات عمالة') return;
      const amt = Number(exp.baseCurrencyAmount || exp.amount || 0);
      if (amt > 0) {
        list.push({
          id: `exp_${exp.id}`,
          date: exp.paymentDate || exp.date || '',
          timestamp: exp.createdAt || Date.now(),
          type: 'outflow',
          categoryAr: exp.categoryNameAr || 'مصروفات تشغيلية',
          description: exp.title || exp.notes || 'مصروف عام بالورشة',
          amount: amt,
          vesselName: exp.treasuryName || 'الخزينة',
          referenceType: 'expense',
          referenceId: exp.id,
        });
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [orders, supplierInvoices, payouts, adminCosts]);

  // 1.1 ميزان المطابقة والسيولة الحرفي (حركة الورشة مقابل رصيد الخزائن)
  const balanceScale = useMemo(() => {
    // إجمالي المقبوضات النقدية (مبيعات وتحصيلات آجلة)
    const totalInflows = journalEntries
      .filter((j) => j.type === 'inflow')
      .reduce((sum, j) => sum + (Number(j.amount) || 0), 0);

    // إجمالي المدفوعات (مشتريات خامات + أجور صناع + مصروفات تشغيلية)
    const totalOutflows = journalEntries
      .filter((j) => j.type === 'outflow')
      .reduce((sum, j) => sum + (Number(j.amount) || 0), 0);

    // صافي حركة الدفتر
    const netBookBalance = totalInflows - totalOutflows;

    // تفنيد السيولة الفعلية في الخزائن والمحافظ
    let actualCash = 0;
    let actualInstapay = 0;
    let actualWallet = 0;
    let actualTotal = 0;

    if (treasuries.length > 0) {
      treasuries.forEach((t) => {
        actualCash += Number(t.cash || 0);
        actualInstapay += Number(t.instapay || 0);
        actualWallet += Number(t.wallet || 0);
        actualTotal += Number(t.balance || ((t.cash || 0) + (t.wallet || 0) + (t.instapay || 0)));
      });
    } else {
      safeTxs.forEach((tx) => {
        const amt = Number(tx.amount || 0);
        if (tx.treasuryId === 'instapay') {
          actualInstapay += amt;
        } else if (tx.treasuryId === 'wallet') {
          actualWallet += amt;
        } else {
          actualCash += amt;
        }
        actualTotal += amt;
      });
    }

    // فارق المطابقة
    const diff = actualTotal - netBookBalance;
    const isMatched = Math.abs(diff) < 1;

    return {
      totalInflows,
      totalOutflows,
      netBookBalance,
      actualCash,
      actualInstapay,
      actualWallet,
      actualTotal,
      diff,
      isMatched,
    };
  }, [journalEntries, treasuries, safeTxs]);

  // 2. Profit & Loss Computation (صافي الأرباح والخسائر)
  const pnlMetrics = useMemo(() => {
    // إجمالي المبيعات المحققة
    const totalSales = orders.reduce((sum, ord) => sum + (Number(ord.totalAmount) || 0), 0);
    const collectedSales = orders.reduce((sum, ord) => sum + (Number(ord.paidAmount) || 0), 0);

    // تكلفة الخامات المستخدمة (من فواتير المشتريات أو أوامر التشغيل المكتملة)
    const rawMaterialsConsumed = workOrders.reduce(
      (sum, wo) => sum + (Number(wo.totalConsumedMaterialsCost) || 0),
      0
    ) || supplierInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);

    // أجور ومصنعيات الصناع وفريق العمل
    const laborCosts = workOrders.reduce(
      (sum, wo) => sum + (Number(wo.totalLaborCost) || 0),
      0
    ) || payouts.reduce((sum, p) => sum + (Number(p.amount || p.paidAmount) || 0), 0);

    // المصروفات العامة والتشغيلية (إيجار، كهرباء، صيانة، شحن...)
    const operatingExpenses = adminCosts
      .filter((exp) => exp.category !== 'أجور ومصنعيات عمالة')
      .reduce((sum, exp) => sum + (Number(exp.baseCurrencyAmount || exp.amount) || 0), 0);

    const totalCosts = rawMaterialsConsumed + laborCosts + operatingExpenses;
    const netProfit = totalSales - totalCosts;
    const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;

    return {
      totalSales,
      collectedSales,
      rawMaterialsConsumed,
      laborCosts,
      operatingExpenses,
      totalCosts,
      netProfit,
      profitMargin,
    };
  }, [orders, workOrders, supplierInvoices, payouts, adminCosts]);

  // 3. Receivables & Payables (العملاء والموردين)
  const customerReceivables = useMemo(() => {
    return orders
      .filter((ord) => (Number(ord.remainingAmount) || 0) > 0 && ord.status !== 'cancelled')
      .sort((a, b) => (b.remainingAmount || 0) - (a.remainingAmount || 0));
  }, [orders]);

  const supplierPayables = useMemo(() => {
    return supplierInvoices
      .filter((inv) => (Number(inv.remainingAmount) || 0) > 0)
      .sort((a, b) => (b.remainingAmount || 0) - (a.remainingAmount || 0));
  }, [supplierInvoices]);

  const totalReceivablesSum = useMemo(() => {
    return customerReceivables.reduce((sum, ord) => sum + (Number(ord.remainingAmount) || 0), 0);
  }, [customerReceivables]);

  const totalPayablesSum = useMemo(() => {
    return supplierPayables.reduce((sum, inv) => sum + (Number(inv.remainingAmount) || 0), 0);
  }, [supplierPayables]);

  // Handle Quick Customer Collection
  const handleExecuteCustomerCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingOrder || collectAmount <= 0) return;

    setCollectSubmitting(true);
    try {
      const collectVal = Math.min(collectAmount, collectingOrder.remainingAmount || 0);

      // Record Safe Transaction
      await tenantStorage.recordSafeTransaction({
        id: 'stx_' + Date.now(),
        workshopId,
        tenantId: workshopId,
        safeType: collectChannel === 'cash' ? 'main' : 'sub',
        treasuryId: collectChannel === 'cash' ? 'main' : collectChannel,
        treasuryName: collectChannel === 'cash' ? 'الخزينة النقدية' : collectChannel === 'instapay' ? 'إنستاباي' : 'المحفظة الإلكترونية',
        type: 'deposit',
        amount: collectVal,
        balanceAfter: 0,
        notes: `تحصيل دفعة من العميل "${collectingOrder.customerName}" - طلبية #${collectingOrder.invoiceNumber || collectingOrder.id.slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        createdBy: 'system',
      });

      // Update Order
      const newPaid = (collectingOrder.paidAmount || 0) + collectVal;
      const newRem = Math.max(0, (collectingOrder.totalAmount || 0) - newPaid);
      const updatedOrder: CustomerOrder = {
        ...collectingOrder,
        paidAmount: newPaid,
        remainingAmount: newRem,
        status: newRem <= 0 ? 'paid' : 'partially_paid',
      };
      await tenantStorage.saveOrder(updatedOrder);

      window.dispatchEvent(new CustomEvent('alshams_financials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_treasury_updated'));

      setNotice({
        text: `تم تحصيل ${collectVal.toLocaleString()} ${currencySymbol} من العميل "${collectingOrder.customerName}" وإيداعها في الخزينة بنجاح.`,
      });
      setCollectingOrder(null);
      await loadData();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل تسجيل التحصيل', isError: true });
    } finally {
      setCollectSubmitting(false);
    }
  };

  // Handle Quick Supplier Settlement
  const handleExecuteSupplierSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingInvoice || settleAmount <= 0) return;

    setSettleSubmitting(true);
    try {
      const payVal = Math.min(settleAmount, settlingInvoice.remainingAmount || 0);

      // Disburse from safe
      await recordDisbursementExitTransaction({
        tenantId: workshopId,
        sourceId: settleSource.id,
        sourceName: settleSource.name,
        sourceKind: settleSource.kind,
        holderName: settleSource.holderName,
        channel: settleChannel,
        amount: payVal,
        recipientName: `سداد للمورد "${settlingInvoice.supplierName}" - فاتورة #${settlingInvoice.invoiceNumber}`,
        category: 'مشتريات خامات',
        title: `سداد من الرصيد الآجل للمورد ${settlingInvoice.supplierName}`,
        notes: `سداد من الرصيد الآجل لفاتورة المشتريات #${settlingInvoice.invoiceNumber}`,
        referenceType: 'supplier_invoice',
        referenceId: settlingInvoice.id,
      });

      // Update invoice
      const newPaid = (settlingInvoice.paidAmount || 0) + payVal;
      const newRem = Math.max(0, (settlingInvoice.totalAmount || 0) - newPaid);
      const updatedInv: SupplierPurchaseInvoice = {
        ...settlingInvoice,
        paidAmount: newPaid,
        remainingAmount: newRem,
        status: newRem <= 0 ? 'paid' : 'partially_paid',
      };
      await tenantStorage.recordSupplierPurchaseInvoice(updatedInv);

      window.dispatchEvent(new CustomEvent('alshams_treasury_updated'));
      window.dispatchEvent(new CustomEvent('alshams_financials_updated'));

      setNotice({
        text: `تم سداد ${payVal.toLocaleString()} ${currencySymbol} للمورد "${settlingInvoice.supplierName}" وخصمها من الخزينة بنجاح.`,
      });
      setSettlingInvoice(null);
      await loadData();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل سداد الدفعة', isError: true });
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Month Closure Calculations & Handlers
  const isSelectedMonthLocked = useMemo(() => {
    return isMonthLocked(selectedClosureMonth, workshopId);
  }, [selectedClosureMonth, lockedMonths, workshopId]);

  const selectedMonthMetrics = useMemo(() => {
    const monthPrefix = selectedClosureMonth;
    const mOrders = orders.filter((o) =>
      (o.date || (o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '')).startsWith(monthPrefix)
    );
    const mSales = mOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const mInvoices = supplierInvoices.filter((i) =>
      (i.date || (i.createdAt ? new Date(i.createdAt).toISOString().split('T')[0] : '')).startsWith(monthPrefix)
    );
    const mPurchases = mInvoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);

    const mAdmin = adminCosts.filter(
      (e) => (e.paymentDate || e.date || '').startsWith(monthPrefix) && e.category !== 'أجور ومصنعيات عمالة'
    );
    const mExpenses = mAdmin.reduce((sum, e) => sum + (Number(e.baseCurrencyAmount || e.amount) || 0), 0);

    const mPayouts = payouts.filter((p) =>
      (p.date || (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '')).startsWith(monthPrefix)
    );
    const mWages = mPayouts.reduce((sum, p) => sum + (Number(p.amount || p.paidAmount) || 0), 0);

    const mWorkOrders = workOrders.filter((w) =>
      (w.startDate || (w.createdAt ? new Date(w.createdAt).toISOString().split('T')[0] : '')).startsWith(monthPrefix)
    );

    const totalCosts = mPurchases + mExpenses + mWages;
    const netProfit = mSales - totalCosts;

    return {
      totalSales: mSales,
      totalPurchases: mPurchases,
      totalExpenses: mExpenses,
      totalWages: mWages,
      totalCosts,
      netProfit,
      invoicesCount: mOrders.length + mInvoices.length,
      workOrdersCount: mWorkOrders.length,
    };
  }, [selectedClosureMonth, orders, supplierInvoices, adminCosts, payouts, workOrders]);

  const handleExecuteLockMonth = () => {
    setClosureSubmitting(true);
    try {
      lockFinancialMonth(
        workshopId,
        selectedClosureMonth,
        (workshop as any).email || 'الإدارة العليا',
        {
          totalSales: selectedMonthMetrics.totalSales,
          totalCosts: selectedMonthMetrics.totalCosts,
          netProfit: selectedMonthMetrics.netProfit,
          invoicesCount: selectedMonthMetrics.invoicesCount,
          workOrdersCount: selectedMonthMetrics.workOrdersCount,
        },
        closureNotes.trim()
      );
      setLockedMonths(getLockedMonths(workshopId));
      setIsLockModalOpen(false);
      setClosureNotes('');
      setNotice({
        text: `🔒 تم قفل واعتماد الشهر المالي (${selectedClosureMonth}) بنجاح! تم تجميد كافة الحركات وأصبحت للقراءة والمراجعة فقط.`,
      });
      setTimeout(() => setNotice(null), 4500);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل قفل الشهر المالي', isError: true });
    } finally {
      setClosureSubmitting(false);
    }
  };

  const handleExecuteUnlockMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPin.trim()) return;

    const res = unlockFinancialMonth(
      workshopId,
      selectedClosureMonth,
      unlockPin,
      (workshop as any).email || 'الإدارة العليا'
    );

    if (res.success) {
      setLockedMonths(getLockedMonths(workshopId));
      setIsUnlockModalOpen(false);
      setUnlockPin('');
      setNotice({ text: `🔓 ${res.message}` });
      setTimeout(() => setNotice(null), 4000);
    } else {
      setNotice({ text: res.message, isError: true });
    }
  };

  // Liquidity Alert Computation
  const minLiquidityAlert = Number((workshop as any).minLiquidityAlert) || 5000;
  const isLiquidityLow = balanceScale.actualTotal < minLiquidityAlert;

  // Filtered Journal
  const filteredJournal = journalEntries
    .filter((j) => {
      if (journalFilter === 'inflow') return j.type === 'inflow';
      if (journalFilter === 'outflow') return j.type === 'outflow';
      return true;
    })
    .filter((j) => {
      const q = searchQuery.trim().toLowerCase();
      return (
        !q ||
        j.description.toLowerCase().includes(q) ||
        j.categoryAr.toLowerCase().includes(q) ||
        j.vesselName.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6 text-right">
      {/* 1. Header Banner & Big Financial KPI Cards */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
              <Scale className="w-4 h-4 text-sky-600" />
              <span>دفتر حركة الورشة المالي والحسابات</span>
              {onOpenHelp && (
                <button
                  type="button"
                  onClick={() => onOpenHelp('accounts')}
                  className="text-stone-400 hover:text-sky-600 cursor-pointer"
                  title="ما معنى هذا؟"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
              دفتر اليومية والأرباح ومستحقات الورشة
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              رؤية مالية واضحة ومبسطة للحرفي: كل قرش دخل أو خرج، صافي أرباح المشغولات، وحصر دقيق للآجل والالتزامات.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-mono font-bold text-stone-600 dark:text-stone-400">
              تحديث حي تلقائي
            </span>
          </div>
        </div>

        {/* شريط الإجراء الرقابي: قفل واعتماد الشهر المالي */}
        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>الشهر المالي للتدقيق والاعتماد:</span>
            </span>
            <input
              type="month"
              value={selectedClosureMonth}
              onChange={(e) => setSelectedClosureMonth(e.target.value)}
              className="px-2.5 py-1 text-xs font-bold font-mono rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none cursor-pointer"
            />
            {isSelectedMonthLocked ? (
              <span className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-black flex items-center gap-1.5 shadow-xs">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>معتمد ومقفل رقابياً - للقراءة والمراجعة فقط</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-black flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>شهر مفتوح لتسجيل الحركات</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isSelectedMonthLocked ? (
              <button
                type="button"
                onClick={() => {
                  setUnlockPin('');
                  setIsUnlockModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-amber-300 text-xs font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs border border-stone-700"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>فك قفل الشهر (للإدارة)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsLockModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>قفل واعتماد الشهر المالي</span>
              </button>
            )}
          </div>
        </div>

        {/* 0. كارت ميزان المطابقة والسيولة الحرفي */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-white border border-stone-800 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-xs">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-1.5">
                  <span>ميزان حركة الورشة والسيولة الحرفية</span>
                </h3>
                <p className="text-[11px] text-stone-400">
                  مطابقة فورية ومباشرة بين حركة الدفتر المحاسبي ورصيد الخزائن والعهد الحقيقي
                </p>
              </div>
            </div>

            {/* Reconciliation Badge */}
            <div className="flex items-center gap-2">
              {balanceScale.isMatched ? (
                <div className="px-3.5 py-1.5 rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>مطابق بالمليم ✔️ (رصيد الدفتر = الخزائن)</span>
                </div>
              ) : (
                <div className="px-3.5 py-1.5 rounded-2xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center gap-1.5 shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>
                    {balanceScale.diff > 0
                      ? `فائض غير مقيد: +${balanceScale.diff.toLocaleString()} ${currencySymbol}`
                      : `عجز مسجل بحاجة لمراجعة: ${Math.abs(balanceScale.diff).toLocaleString()} ${currencySymbol}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* إنذار حد أمان السيولة اليومية */}
          {isLiquidityLow && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-rose-400 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 animate-bounce" />
                <span className="text-xs font-black leading-relaxed">
                  ⚠️ تنبيه: رصيد السيولة الحية أقل من حد أمان التشغيل اليومي للورشة، يُرجى تدبير سيولة أو تحصيل مستحقات
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('receivables_payables')}
                className="px-4 py-2 rounded-xl bg-white text-rose-800 hover:bg-rose-50 text-xs font-black shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-rose-700" />
                <span>مستحقات واجبة التحصيل</span>
              </button>
            </div>
          )}

          {/* 3 Metrics: Inflows, Outflows, Actual Liquidity Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Inflows */}
            <div className="p-3.5 rounded-2xl bg-stone-800/70 border border-stone-700/60 space-y-1">
              <span className="text-[11px] font-bold text-teal-400 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>إجمالي المقبوضات النقدية</span>
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-white block">
                {balanceScale.totalInflows.toLocaleString()} {currencySymbol}
              </span>
              <span className="text-[10px] text-stone-400 block">
                مبيعات المشغولات + تحصيلات الآجل من العملاء
              </span>
            </div>

            {/* Outflows */}
            <div className="p-3.5 rounded-2xl bg-stone-800/70 border border-stone-700/60 space-y-1">
              <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>إجمالي المدفوعات</span>
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-white block">
                {balanceScale.totalOutflows.toLocaleString()} {currencySymbol}
              </span>
              <span className="text-[10px] text-stone-400 block">
                مشتريات خامات + أجور صناع + مصروفات تشغيلية
              </span>
            </div>

            {/* Net Actual Liquidity & Breakdown */}
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>صافي السيولة الفعلية</span>
                </span>
                <span className="text-[10px] text-amber-200/80 font-mono">
                  رصيد الدفتر: {balanceScale.netBookBalance.toLocaleString()} {currencySymbol}
                </span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-amber-300 block">
                {balanceScale.actualTotal.toLocaleString()} {currencySymbol}
              </span>

              {/* Instant Breakdown: Cash, InstaPay, Wallets */}
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-500/20 text-[10px]">
                <div className="bg-stone-900/80 px-2 py-1 rounded-xl text-center">
                  <span className="text-stone-400 block text-[9px]">💵 كاش</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {balanceScale.actualCash.toLocaleString()}
                  </span>
                </div>
                <div className="bg-stone-900/80 px-2 py-1 rounded-xl text-center">
                  <span className="text-stone-400 block text-[9px]">📱 إنستاباي</span>
                  <span className="font-mono font-bold text-purple-400">
                    {balanceScale.actualInstapay.toLocaleString()}
                  </span>
                </div>
                <div className="bg-stone-900/80 px-2 py-1 rounded-xl text-center">
                  <span className="text-stone-400 block text-[9px]">👛 محافظ</span>
                  <span className="font-mono font-bold text-sky-400">
                    {balanceScale.actualWallet.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Core Financial Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Card 1: Sales */}
          <div className="p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50">
            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 block">
              إجمالي المبيعات
            </span>
            <span className="text-lg font-black font-mono text-teal-700 dark:text-teal-400 mt-1 block">
              {pnlMetrics.totalSales.toLocaleString()} {currencySymbol}
            </span>
            <span className="text-[10px] text-teal-600 font-bold">
              المحصل: {pnlMetrics.collectedSales.toLocaleString()} {currencySymbol}
            </span>
          </div>

          {/* Card 2: Costs */}
          <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50">
            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block">
              إجمالي التكاليف
            </span>
            <span className="text-lg font-black font-mono text-rose-700 dark:text-rose-400 mt-1 block">
              {pnlMetrics.totalCosts.toLocaleString()} {currencySymbol}
            </span>
            <span className="text-[10px] text-rose-600 font-bold">
              خامات + أجور + مصروفات
            </span>
          </div>

          {/* Card 3: Net Profit */}
          <div
            className={`p-3.5 rounded-2xl border ${
              pnlMetrics.netProfit >= 0
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/50'
                : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-bold ${
                  pnlMetrics.netProfit >= 0
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-rose-800 dark:text-rose-300'
                }`}
              >
                صافي أرباح الورشة
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                  pnlMetrics.netProfit >= 0
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                }`}
              >
                {pnlMetrics.profitMargin}%
              </span>
            </div>
            <span
              className={`text-lg font-black font-mono mt-1 block ${
                pnlMetrics.netProfit >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {pnlMetrics.netProfit.toLocaleString()} {currencySymbol}
            </span>
            <span className="text-[10px] text-stone-500 font-bold">
              {pnlMetrics.netProfit >= 0 ? 'أرباح تشغيلية محققة' : 'عجز مؤقت في التكاليف'}
            </span>
          </div>

          {/* Card 4: Net Receivables */}
          <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50">
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 block">
              صافي الموقف الآجل
            </span>
            <span className="text-lg font-black font-mono text-sky-700 dark:text-sky-400 mt-1 block">
              {(totalReceivablesSum - totalPayablesSum).toLocaleString()} {currencySymbol}
            </span>
            <span className="text-[10px] text-stone-500 font-bold">
              لنا: {totalReceivablesSum.toLocaleString()} | علينا: {totalPayablesSum.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {notice.isError ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 2. Main Tab Navigator */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'journal'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>(1) دفتر اليومية وسجل الحركات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profit_loss')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'profit_loss'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>(2) صافي الأرباح والخسائر</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receivables_payables')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'receivables_payables'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>(3) كشف مستحقات الورشة والالتزامات</span>
        </button>
      </div>

      {/* TAB 1: JOURNAL (سجل الحركات اليومية) */}
      {activeTab === 'journal' && (
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setJournalFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  journalFilter === 'all'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                }`}
              >
                الكل ({journalEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setJournalFilter('inflow')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  journalFilter === 'inflow'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>الوارد (مبيعات ومقبوضات)</span>
              </button>
              <button
                type="button"
                onClick={() => setJournalFilter('outflow')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  journalFilter === 'outflow'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>المنصرف (خامات وأجور ومصروفات)</span>
              </button>
            </div>

            <div className="w-full sm:w-64 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في البيان أو الخزينة..."
                className="w-full px-3.5 py-1.5 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              />
              <Search className="w-4 h-4 text-stone-400 absolute right-2.5 top-2 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-stone-400 text-xs">جاري تحميل سجل اليومية...</div>
          ) : filteredJournal.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs font-bold">
              لا توجد حركات مسجلة في هذا التصنيف.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJournal.map((item) => {
                const isInflow = item.type === 'inflow';

                return (
                  <div
                    key={item.id}
                    className={`p-3 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isInflow
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200/80 dark:border-emerald-900/50'
                        : 'bg-stone-50/70 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isInflow
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {isInflow ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isInflow
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-300'
                            }`}
                          >
                            {item.categoryAr}
                          </span>
                          <span className="text-[11px] text-stone-400 font-mono">{item.date}</span>
                        </div>
                        <p className="text-xs font-black text-stone-900 dark:text-stone-100 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-200/50">
                      <span
                        className={`text-sm sm:text-base font-black font-mono ${
                          isInflow
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {isInflow ? '+' : '-'}
                        {item.amount.toLocaleString()} {currencySymbol}
                      </span>
                      <span className="text-[10px] text-stone-500 font-bold">
                        وعاء الصرف: {item.vesselName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROFIT & LOSS (صافي الأرباح والخسائر) */}
      {activeTab === 'profit_loss' && (
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-6">
          <div className="border-b border-stone-200 dark:border-stone-800 pb-3">
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
              تشريح أرباح وتكاليف الورشة (المبيعات مقابل التكاليف الفعلية)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              مقارنة واضحة وبسيطة: ما تم تحصيله من المبيعات مقابل ما أُنفق على الخامات، مصنعيات الصناع، والمصروفات.
            </p>
          </div>

          {/* Side-by-side Cards: Revenues (+) vs Costs (-) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenues (+) */}
            <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-200 dark:border-teal-900 pb-2">
                <span className="text-xs font-black text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                  <span>(+) إجمالي الإيرادات والمبيعات:</span>
                </span>
                <span className="text-sm font-black font-mono text-teal-800 dark:text-teal-300">
                  {pnlMetrics.totalSales.toLocaleString()} {currencySymbol}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-700 dark:text-stone-300">
                  <span>مبيعات تم تحصيلها نقداً/إلكترونياً:</span>
                  <strong className="font-mono">{pnlMetrics.collectedSales.toLocaleString()} {currencySymbol}</strong>
                </div>
                <div className="flex justify-between text-stone-700 dark:text-stone-300">
                  <span>مبيعات آجلة بانتظار التحصيل:</span>
                  <strong className="font-mono text-amber-700 dark:text-amber-400">
                    {Math.max(0, pnlMetrics.totalSales - pnlMetrics.collectedSales).toLocaleString()} {currencySymbol}
                  </strong>
                </div>
              </div>
            </div>

            {/* Costs (-) */}
            <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-3">
              <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900 pb-2">
                <span className="text-xs font-black text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                  <span>(-) إجمالي التكاليف والمصروفات:</span>
                </span>
                <span className="text-sm font-black font-mono text-rose-800 dark:text-rose-300">
                  {pnlMetrics.totalCosts.toLocaleString()} {currencySymbol}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-700 dark:text-stone-300">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    <span>تكلفة الخامات المستخدمة في الإنتاج:</span>
                  </span>
                  <strong className="font-mono">{pnlMetrics.rawMaterialsConsumed.toLocaleString()} {currencySymbol}</strong>
                </div>

                <div className="flex justify-between text-stone-700 dark:text-stone-300">
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-purple-600" />
                    <span>أجور ومصنعيات الصناع وفريق العمل:</span>
                  </span>
                  <strong className="font-mono">{pnlMetrics.laborCosts.toLocaleString()} {currencySymbol}</strong>
                </div>

                <div className="flex justify-between text-stone-700 dark:text-stone-300">
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-red-600" />
                    <span>المصروفات الإدارية والتشغيلية:</span>
                  </span>
                  <strong className="font-mono">{pnlMetrics.operatingExpenses.toLocaleString()} {currencySymbol}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Breakdown Bar */}
          {pnlMetrics.totalSales > 0 && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>توزيع كل 100 جنيه مبيعات:</span>
                <span className="font-mono text-emerald-600">
                  هامش الربح الصافي: {pnlMetrics.profitMargin}%
                </span>
              </div>

              <div className="h-4 rounded-full overflow-hidden flex bg-stone-200 dark:bg-stone-700">
                <div
                  style={{ width: `${Math.min(100, Math.round((pnlMetrics.rawMaterialsConsumed / pnlMetrics.totalSales) * 100))}%` }}
                  className="bg-amber-500 h-full"
                  title="الخامات"
                />
                <div
                  style={{ width: `${Math.min(100, Math.round((pnlMetrics.laborCosts / pnlMetrics.totalSales) * 100))}%` }}
                  className="bg-purple-500 h-full"
                  title="أجور ومصنعيات"
                />
                <div
                  style={{ width: `${Math.min(100, Math.round((pnlMetrics.operatingExpenses / pnlMetrics.totalSales) * 100))}%` }}
                  className="bg-red-500 h-full"
                  title="مصروفات عامة"
                />
                <div
                  style={{ width: `${Math.max(0, Math.min(100, pnlMetrics.profitMargin))}%` }}
                  className="bg-emerald-500 h-full"
                  title="صافي الربح"
                />
              </div>

              <div className="flex flex-wrap gap-4 text-[11px] font-bold pt-1">
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>الخامات ({Math.round((pnlMetrics.rawMaterialsConsumed / pnlMetrics.totalSales) * 100)}%)</span>
                </span>
                <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                  <span>الأجور ({Math.round((pnlMetrics.laborCosts / pnlMetrics.totalSales) * 100)}%)</span>
                </span>
                <span className="flex items-center gap-1 text-red-700 dark:text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  <span>المصروفات ({Math.round((pnlMetrics.operatingExpenses / pnlMetrics.totalSales) * 100)}%)</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>صافي الربح ({pnlMetrics.profitMargin}%)</span>
                </span>
              </div>
            </div>
          )}

          {/* Bottom Line Summary Banner */}
          <div
            className={`p-5 rounded-2xl border text-center space-y-1 ${
              pnlMetrics.netProfit >= 0
                ? 'bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 border-emerald-300 dark:border-emerald-800'
                : 'bg-gradient-to-b from-rose-500/15 to-rose-500/5 border-rose-300 dark:border-rose-800'
            }`}
          >
            <span className="text-xs font-bold text-stone-600 dark:text-stone-300 block">
              النتيجة المالية النهائية للورشة:
            </span>
            <span
              className={`text-2xl sm:text-3xl font-black font-mono block ${
                pnlMetrics.netProfit >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {pnlMetrics.netProfit >= 0 ? '+' : ''}
              {pnlMetrics.netProfit.toLocaleString()} {currencySymbol}
            </span>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {pnlMetrics.netProfit >= 0
                ? 'أرباح فعلية حقيقية صافية بعد سداد كافة تكاليف الإنتاج ومصنعيات الفنانين.'
                : 'عجز مؤقت، راجع تكاليف الخامات وأجور المصنعية للتأكد من ربحية كل مشغولة.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: RECEIVABLES & PAYABLES (العملاء والموردين) */}
      {activeTab === 'receivables_payables' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Column A: Customer Receivables */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>مستحقات الورشة طرف العملاء (الآجل)</span>
                </h3>
                <span className="text-[11px] text-stone-400">
                  {customerReceivables.length} طلبيات عليها مبالغ متبقية
                </span>
              </div>

              <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400">
                {totalReceivablesSum.toLocaleString()} {currencySymbol}
              </span>
            </div>

            {customerReceivables.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-xs font-bold">
                لا توجد مستحقات متأخرة على العملاء حالياً (جميع الفواتير مسددة).
              </div>
            ) : (
              <div className="space-y-2">
                {customerReceivables.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-stone-900 dark:text-stone-100 block">
                        {ord.customerName || 'عميل الورشة'}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        طلب #{ord.invoiceNumber || ord.id.slice(-4)} • {ord.customerPhone || ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-left font-mono">
                        <span className="text-[10px] text-stone-400 block">المتبقي:</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          {ord.remainingAmount?.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCollectingOrder(ord);
                          setCollectAmount(ord.remainingAmount || 0);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        تحصيل
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column B: Supplier Payables */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>التزامات ومستحقات الموردين (الآجل)</span>
                </h3>
                <span className="text-[11px] text-stone-400">
                  {supplierPayables.length} فواتير توريد عليها متبقي
                </span>
              </div>

              <span className="text-xs font-black font-mono text-amber-700 dark:text-amber-400">
                {totalPayablesSum.toLocaleString()} {currencySymbol}
              </span>
            </div>

            {supplierPayables.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-xs font-bold">
                لا توجد مديونيات آجلة للموردين حالياً (جميع فواتير الخامات مسددة).
              </div>
            ) : (
              <div className="space-y-2">
                {supplierPayables.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-stone-900 dark:text-stone-100 block">
                        {inv.supplierName}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        فاتورة #{inv.invoiceNumber} • {inv.date}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-left font-mono">
                        <span className="text-[10px] text-stone-400 block">الواجب سداده:</span>
                        <span className="font-black text-amber-700 dark:text-amber-400">
                          {inv.remainingAmount?.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSettlingInvoice(inv);
                          setSettleAmount(inv.remainingAmount || 0);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        سداد
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Customer Collection */}
      {collectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteCustomerCollection}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-emerald-300 dark:border-stone-700 w-full max-w-md space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setCollectingOrder(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>تحصيل دفعة من العميل: {collectingOrder.customerName}</span>
              </h3>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs space-y-1">
              <p>طلب رقم: <strong className="font-mono">#{collectingOrder.invoiceNumber || collectingOrder.id.slice(-4)}</strong></p>
              <p>إجمالي الفاتورة: <strong className="font-mono">{collectingOrder.totalAmount?.toLocaleString()} {currencySymbol}</strong></p>
              <p className="text-emerald-800 dark:text-emerald-300 font-bold">
                المتبقي الآجل: <strong className="font-mono">{collectingOrder.remainingAmount?.toLocaleString()} {currencySymbol}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">المبلغ المحصل الآن ({currencySymbol}) *</label>
              <NumberInput
                min={1}
                max={collectingOrder.remainingAmount || 1}
                required
                value={collectAmount}
                onChange={(v) => setCollectAmount(Number(v) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-stone-50 dark:bg-stone-800 font-mono font-bold text-xs text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">جهة الإيداع (الخزينة / الوعاء) *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: '💵 نقدية (كاش)' },
                  { id: 'instapay', label: '📱 إنستاباي' },
                  { id: 'wallet', label: '👛 محفظة' },
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setCollectChannel(ch.id as any)}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      collectChannel === ch.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-300 dark:border-stone-700'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t">
              <button
                type="button"
                onClick={() => setCollectingOrder(null)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={collectSubmitting || collectAmount <= 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {collectSubmitting ? 'جاري التحصيل...' : 'تأكيد التحصيل وإيداع بالخزينة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Supplier Settlement */}
      {settlingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteSupplierSettlement}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-lg space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setSettlingInvoice(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>سداد دفعة آجلة للمورد: {settlingInvoice.supplierName}</span>
              </h3>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs space-y-1">
              <p>فاتورة توريد: <strong className="font-mono">#{settlingInvoice.invoiceNumber}</strong></p>
              <p>إجمالي الفاتورة: <strong className="font-mono">{settlingInvoice.totalAmount.toLocaleString()} {currencySymbol}</strong></p>
              <p className="text-amber-800 dark:text-amber-300 font-bold">
                المتبقي الآجل: <strong className="font-mono">{settlingInvoice.remainingAmount?.toLocaleString()} {currencySymbol}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">المبلغ المراد سداده الآن ({currencySymbol}) *</label>
              <NumberInput
                min={1}
                max={settlingInvoice.remainingAmount || 1}
                required
                value={settleAmount}
                onChange={(v) => setSettleAmount(Number(v) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-stone-50 dark:bg-stone-800 font-mono font-bold text-xs text-center"
              />
            </div>

            <DisbursementSourceSelector
              workshopId={workshopId}
              currencySymbol={currencySymbol}
              selectedSourceId={settleSource.id}
              onSourceChange={setSettleSource}
              selectedChannel={settleChannel}
              onChannelChange={setSettleChannel}
              disbursedAmount={settleAmount}
            />

            <div className="pt-2 flex justify-end gap-2 border-t">
              <button
                type="button"
                onClick={() => setSettlingInvoice(null)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={settleSubmitting || settleAmount <= 0}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {settleSubmitting ? 'جاري السداد...' : 'تأكيد السداد والخصم من الخزينة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Lock Month (قفل واعتماد الشهر المالي) */}
      {isLockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-lg space-y-4 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsLockModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>قفل واعتماد الشهر المالي ({selectedClosureMonth})</span>
              </h3>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <p className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>إجراء رقابي مالي معتمد:</span>
              </p>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                عند اعتماد هذا الشهر، سيتم تجميد كافة القيود وحركات الفواتير والمصروفات وأوامر التشغيل الخاصة به وتتحول إلى وضع <strong>"للقراءة والمراجعة فقط"</strong> لمنع التعديل أو الحذف وحماية نزاهة الأرباح.
              </p>
            </div>

            {/* Summary metrics of the month */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">إجمالي المبيعات المعتمدة:</span>
                <strong className="font-mono text-emerald-600">{selectedMonthMetrics.totalSales.toLocaleString()} {currencySymbol}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">إجمالي التكاليف والمصروفات:</span>
                <strong className="font-mono text-rose-600">{selectedMonthMetrics.totalCosts.toLocaleString()} {currencySymbol}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200 dark:border-stone-700">
                <span className="font-bold">صافي الأرباح التشغيلية:</span>
                <strong className="font-mono font-black text-amber-600">{selectedMonthMetrics.netProfit.toLocaleString()} {currencySymbol}</strong>
              </div>
              <div className="flex justify-between text-[11px] text-stone-400 pt-1">
                <span>الحركات المرتبطة:</span>
                <span>{selectedMonthMetrics.invoicesCount} فاتورة • {selectedMonthMetrics.workOrdersCount} أمر تشغيل</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                ملاحظات الاعتماد والإقفال (اختياري)
              </label>
              <input
                type="text"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                placeholder="مثال: تم الجرد ومطابقة أرصدة الخزائن مع الدفتر بالكامل"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsLockModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={closureSubmitting}
                onClick={handleExecuteLockMonth}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{closureSubmitting ? 'جاري الاعتماد...' : 'تأكيد قفل واعتماد الشهر'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Unlock Month (فك قفل الشهر المالي) */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteUnlockMonth}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-stone-700 w-full max-w-md space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Unlock className="w-4 h-4 text-amber-600" />
                <span>فك قفل الشهر المالي ({selectedClosureMonth})</span>
              </h3>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              هذا الإجراء مخصص حصرياً للإدارة/السوبر أدمن لإعادة فتح الشهر وإتاحة تصحيح القيود والفواتير. يرجى إدخال رمز الأمان المعتمد:
            </p>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                رمز الأمان للإدارة (PIN) *
              </label>
              <input
                type="password"
                required
                autoFocus
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
                placeholder="أدخل رمز أمان الإدارة..."
                className="w-full px-3 py-2 text-center rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-sm font-bold tracking-widest outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-amber-300 text-xs font-black cursor-pointer transition flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>تأكيد فك القفل</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
