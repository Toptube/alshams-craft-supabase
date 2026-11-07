import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  WorkshopProfile,
  SupplierPurchaseInvoice,
  SupplierProfile,
  RawMaterialItem,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { supabase } from '../../lib/supabase';
import {
  DisbursementSourceSelector,
  SelectedDisbursementSource,
  recordDisbursementExitTransaction,
} from '../treasuries/DisbursementSourceSelector';
import { isDateInLockedMonth } from '../../lib/monthClosure';
import {
  PackagePlus,
  Plus,
  Search,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wallet,
  Receipt,
  Layers,
  HelpCircle,
  X,
  Trash2,
  FileText,
  DollarSign,
  TrendingDown,
  Building,
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';

export interface InitialPurchaseMaterial {
  materialId: string;
  materialName?: string;
  supplierId?: string;
  unitCost?: number;
  unitName?: string;
  quantity?: number;
}

interface PurchasesViewProps {
  workshop: WorkshopProfile | UserProfile;
  initialMaterial?: InitialPurchaseMaterial | null;
  onClearInitialMaterial?: () => void;
  onOpenHelp?: (sectionId: string) => void;
  onOpenNewMaterial?: () => void;
  onOpenCreateSupplier?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  workshop,
  initialMaterial,
  onClearInitialMaterial,
  onOpenHelp,
  onOpenNewMaterial,
  onOpenCreateSupplier,
}) => {
  const workshopId = (workshop as any).tenantId || (workshop as any).workshopId || workshop.id || '';
  const currencySymbol = (workshop as any).currencySymbol || 'ج.م';

  const [invoices, setInvoices] = useState<SupplierPurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [materials, setMaterials] = useState<RawMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  // Modal: New Purchase Invoice
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchasedItems, setPurchasedItems] = useState<
    Array<{ materialId: string; materialName: string; quantity: number; unitCost: number; unit: string }>
  >([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [selectedSource, setSelectedSource] = useState<SelectedDisbursementSource>({
    id: 'main',
    name: 'الخزينة الرئيسية (النقدية)',
    kind: 'main',
    availableCash: 0,
    availableWallet: 0,
    availableInstapay: 0,
    totalBalance: 0,
  });
  const [paymentChannel, setPaymentChannel] = useState<'cash' | 'instapay' | 'wallet'>('cash');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick Pay Modal for Outstanding Invoices
  const [payingInvoice, setPayingInvoice] = useState<SupplierPurchaseInvoice | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState<number>(0);
  const [payingSelectedSource, setPayingSelectedSource] = useState<SelectedDisbursementSource>({
    id: 'main',
    name: 'الخزينة الرئيسية (النقدية)',
    kind: 'main',
    availableCash: 0,
    availableWallet: 0,
    availableInstapay: 0,
    totalBalance: 0,
  });
  const [payingChannel, setPayingChannel] = useState<'cash' | 'instapay' | 'wallet'>('cash');
  const [quickPaySubmitting, setQuickPaySubmitting] = useState(false);

  // Notice Toast
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invList, supList, matList] = await Promise.all([
        tenantStorage.getSupplierInvoices(workshopId).catch(() => []),
        tenantStorage.getSuppliers(workshopId).catch(() => []),
        tenantStorage.getRawMaterials(workshopId).catch(() => []),
      ]);

      setInvoices(invList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setSuppliers(supList);
      setMaterials(matList);

      if (supList.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(supList[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ text: err.message || 'فشل تحميل فواتير المشتريات', isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workshopId]);

  useEffect(() => {
    const handleRemoteUpdate = () => loadData();
    window.addEventListener('alshams_materials_updated', handleRemoteUpdate);
    window.addEventListener('alshams_treasury_updated', handleRemoteUpdate);
    window.addEventListener('alshams_financials_updated', handleRemoteUpdate);
    return () => {
      window.removeEventListener('alshams_materials_updated', handleRemoteUpdate);
      window.removeEventListener('alshams_treasury_updated', handleRemoteUpdate);
      window.removeEventListener('alshams_financials_updated', handleRemoteUpdate);
    };
  }, []);

  // عند طلب شراء خامة معينة من جدول الخامات أو المخزن
  useEffect(() => {
    if (initialMaterial && initialMaterial.materialId) {
      setIsInvoiceModalOpen(true);
      setInvoiceNumber(`SUP-${Date.now().toString().slice(-4)}`);
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      if (initialMaterial.supplierId) {
        setSelectedSupplierId(initialMaterial.supplierId);
      }
      const recQty = Number(initialMaterial.quantity) > 0 ? Number(initialMaterial.quantity) : 10;
      setPurchasedItems([
        {
          materialId: initialMaterial.materialId,
          materialName: initialMaterial.materialName || 'خامة مطلوبة',
          quantity: recQty,
          unitCost: Number(initialMaterial.unitCost) || 50,
          unit: initialMaterial.unitName || 'وحدة',
        },
      ]);
      setNotice({
        text: `تم تجهيز فاتورة شراء جديدة للخامة: "${initialMaterial.materialName || ''}" بالكمية الموصى بها (${recQty} ${initialMaterial.unitName || ''}) لسد احتياج أوامر الشغل وتأمين المخزون.`,
      });
      onClearInitialMaterial?.();
    }
  }, [initialMaterial]);

  // Compute Total Metrics
  const totalPurchasesSum = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  }, [invoices]);

  const totalPaidSum = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  }, [invoices]);

  const totalRemainingSum = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.remainingAmount) || 0), 0);
  }, [invoices]);

  // Handle Opening Create Invoice Modal
  const handleOpenCreateInvoice = () => {
    setInvoiceNumber(`PUR-${Date.now().toString().slice(-4)}`);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    if (suppliers.length > 0) setSelectedSupplierId(suppliers[0].id);
    setInvoiceNotes('');

    const defaultMat = materials[0];
    if (defaultMat) {
      const initCost = defaultMat.costPerUnit || 100;
      setPurchasedItems([
        {
          materialId: defaultMat.id,
          materialName: defaultMat.materialName,
          quantity: 10,
          unitCost: initCost,
          unit: defaultMat.unit || 'كيلو',
        },
      ]);
      setPaidAmount(10 * initCost);
    } else {
      setPurchasedItems([]);
      setPaidAmount(0);
    }
    setIsInvoiceModalOpen(true);
  };

  const handleAddMaterialRow = () => {
    const defaultMat = materials[0];
    setPurchasedItems([
      ...purchasedItems,
      {
        materialId: defaultMat?.id || '',
        materialName: defaultMat?.materialName || 'خامة جديدة',
        quantity: 1,
        unitCost: defaultMat?.costPerUnit || 100,
        unit: defaultMat?.unit || 'وحدة',
      },
    ]);
  };

  // Calculate current modal total
  const modalInvoiceTotal = useMemo(() => {
    return purchasedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
  }, [purchasedItems]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDateInLockedMonth(workshopId, invoiceDate)) {
      setNotice({
        text: '⚠️ لا يمكن تسجيل فاتورة شراء في شهر مالي معتمد ومقفل رقابياً - السجلات للقراءة فقط.',
        isError: true,
      });
      return;
    }
    if (!selectedSupplierId) {
      setNotice({ text: 'يرجى اختيار المورد أولاً', isError: true });
      return;
    }
    if (purchasedItems.length === 0) {
      setNotice({ text: 'يرجى إضافة خامة واحدة على الأقل في الفاتورة', isError: true });
      return;
    }

    setSubmitting(true);
    try {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      const total = modalInvoiceTotal;
      const paid = Math.min(total, Math.max(0, Number(paidAmount) || 0));
      const remaining = Math.max(0, total - paid);

      const newInvoiceId = 'pur_' + Date.now();
      const invoiceData: SupplierPurchaseInvoice = {
        id: newInvoiceId,
        tenantId: workshopId,
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'مورد خامات',
        invoiceNumber: invoiceNumber.trim() || `PUR-${Date.now().toString().slice(-4)}`,
        date: invoiceDate,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: remaining,
        status: remaining <= 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid',
        paymentMethod: paymentChannel,
        items: purchasedItems.map((item) => ({
          materialId: item.materialId,
          materialName: item.materialName,
          quantity: Number(item.quantity) || 0,
          unitCost: Number(item.unitCost) || 0,
          totalCost: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
          unit: item.unit,
        })),
        notes: invoiceNotes.trim(),
        createdAt: Date.now(),
      };

      // 1. خصم المبلغ المدفوع من الخزينة المحددة وتسجيل قيد الصرف
      if (paid > 0) {
        await recordDisbursementExitTransaction({
          tenantId: workshopId,
          sourceId: selectedSource.id,
          sourceName: selectedSource.name,
          sourceKind: selectedSource.kind,
          holderName: selectedSource.holderName,
          channel: paymentChannel,
          amount: paid,
          recipientName: `فاتورة مشتريات خامات #${invoiceData.invoiceNumber} - مورد: ${invoiceData.supplierName}`,
          category: 'مشتريات خامات',
          title: `فاتورة مشتريات خامات #${invoiceData.invoiceNumber}`,
          notes: `سداد قيمة شراء خامات: ${invoiceData.items.map((i) => i.materialName).join('، ')}`,
          referenceType: 'supplier_invoice',
          referenceId: invoiceData.id,
        });
      }

      // 2. زيادة رصيد الخامات في مخزن الورشة وتحديث سعر الشراء
      for (const item of purchasedItems) {
        try {
          const raw = materials.find((m) => m.id === item.materialId);
          if (raw) {
            raw.currentStock = Math.round(((raw.currentStock || 0) + item.quantity) * 1000) / 1000;
            raw.costPerUnit = item.unitCost;
            raw.lastPurchaseDate = invoiceDate;
            await tenantStorage.saveRawMaterial(raw);
          }
        } catch (matErr) {
          console.warn('Material replenishment notice:', matErr);
        }
      }

      // 3. تحديث رصيد المورد إذا كان هناك متبقي آجل
      if (supplier && remaining > 0) {
        try {
          supplier.outstandingBalance = (supplier.outstandingBalance || 0) + remaining;
          await tenantStorage.saveSupplier(supplier);
        } catch (supErr) {
          console.warn('Supplier balance update notice:', supErr);
        }
      }

      // 4. حفظ الفاتورة في Dexie
      await tenantStorage.recordSupplierPurchaseInvoice(invoiceData);

      // 5. مزامنة سحابية هادئة في Supabase
      try {
        await supabase.from('supplier_invoices').upsert({
          id: invoiceData.id,
          workshop_id: workshopId,
          invoice_number: invoiceData.invoiceNumber,
          supplier_id: invoiceData.supplierId,
          supplier_name: invoiceData.supplierName,
          total_amount: invoiceData.totalAmount,
          paid_amount: invoiceData.paidAmount,
          remaining_amount: invoiceData.remainingAmount,
          status: invoiceData.status,
          date: invoiceData.date,
          created_at: new Date(invoiceData.createdAt || Date.now()).toISOString(),
        });
      } catch (cloudErr) {
        console.warn('Cloud sync error for purchase invoice:', cloudErr);
      }

      window.dispatchEvent(new CustomEvent('alshams_materials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_treasury_updated'));
      window.dispatchEvent(new CustomEvent('alshams_financials_updated'));

      setNotice({
        text: `تم تسجيل فاتورة الشراء #${invoiceData.invoiceNumber} بنجاح! تم خصم المسدد (${paid.toLocaleString()} ${currencySymbol}) من الخزينة وتزويد مخزن الخامات.`,
      });
      setIsInvoiceModalOpen(false);
      await loadData();
      setTimeout(() => setNotice(null), 4500);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل تسجيل فاتورة الشراء', isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Pay Remaining Balance on an Invoice
  const handleOpenQuickPay = (inv: SupplierPurchaseInvoice) => {
    setPayingInvoice(inv);
    setQuickPayAmount(inv.remainingAmount || 0);
  };

  const handleExecuteQuickPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice || quickPayAmount <= 0) return;
    if (isDateInLockedMonth(workshopId, payingInvoice.date || '')) {
      setNotice({
        text: '⚠️ لا يمكن سداد دفعة لفاتورة تتبع شهراً مالياً معتمداً ومقفلاً رقابياً - السجلات للقراءة والمراجعة فقط.',
        isError: true,
      });
      return;
    }

    setQuickPaySubmitting(true);
    try {
      const payVal = Math.min(quickPayAmount, payingInvoice.remainingAmount || 0);

      // 1. صرف من الخزينة
      await recordDisbursementExitTransaction({
        tenantId: workshopId,
        sourceId: payingSelectedSource.id,
        sourceName: payingSelectedSource.name,
        sourceKind: payingSelectedSource.kind,
        holderName: payingSelectedSource.holderName,
        channel: payingChannel,
        amount: payVal,
        recipientName: `سداد دفعة آجلة للمورد ${payingInvoice.supplierName} - فاتورة #${payingInvoice.invoiceNumber}`,
        category: 'مشتريات خامات',
        title: `سداد من الرصيد الآجل لفاتورة المشتريات #${payingInvoice.invoiceNumber}`,
        notes: `سداد من الرصيد الآجل لفاتورة المشتريات`,
        referenceType: 'supplier_invoice',
        referenceId: payingInvoice.id,
      });

      // 2. تحديث الفاتورة
      const newPaid = (payingInvoice.paidAmount || 0) + payVal;
      const newRem = Math.max(0, (payingInvoice.totalAmount || 0) - newPaid);
      const updatedInvoice: SupplierPurchaseInvoice = {
        ...payingInvoice,
        paidAmount: newPaid,
        remainingAmount: newRem,
        status: newRem <= 0 ? 'paid' : 'partially_paid',
      };
      await tenantStorage.recordSupplierPurchaseInvoice(updatedInvoice);

      // 3. تخفيض مديونية المورد
      try {
        const sup = suppliers.find((s) => s.id === payingInvoice.supplierId);
        if (sup) {
          sup.outstandingBalance = Math.max(0, (sup.outstandingBalance || 0) - payVal);
          await tenantStorage.saveSupplier(sup);
        }
      } catch (supErr) {
        console.warn('Supplier debt deduction notice:', supErr);
      }

      window.dispatchEvent(new CustomEvent('alshams_treasury_updated'));
      window.dispatchEvent(new CustomEvent('alshams_financials_updated'));

      setNotice({
        text: `تم سداد ${payVal.toLocaleString()} ${currencySymbol} من مديونية الفاتورة بنجاح وتحديث كشف حساب المورد.`,
      });
      setPayingInvoice(null);
      await loadData();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل سداد الدفعة', isError: true });
    } finally {
      setQuickPaySubmitting(false);
    }
  };

  // Filtered Invoices
  const filteredInvoices = invoices
    .filter((inv) => {
      if (activeFilter === 'unpaid') return (inv.remainingAmount || 0) > 0;
      if (activeFilter === 'paid') return (inv.remainingAmount || 0) <= 0;
      return true;
    })
    .filter((inv) => {
      const q = searchQuery.trim().toLowerCase();
      return (
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6 text-right">
      {/* 1. Header & Summary Cards */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400">
              <PackagePlus className="w-4 h-4 text-rose-600" />
              <span>إدارة مشتريات خامات الورشة وفواتير الموردين</span>
              {onOpenHelp && (
                <button
                  type="button"
                  onClick={() => onOpenHelp('purchases')}
                  className="text-stone-400 hover:text-rose-600 cursor-pointer"
                  title="ما معنى هذا؟"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
              سجل المشتريات وتوريد الخامات
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              تسجيل فواتير شراء مستلزمات الإنتاج مع خصم المدفوع فورياً من الخزينة وتغذية رصيد المخزن ومتابعة الآجل.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateInvoice}
            className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-2 shadow-md cursor-pointer transition active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل فاتورة شراء خامات جديدة</span>
          </button>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50">
            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block">
              إجمالي المشتريات
            </span>
            <span className="text-lg font-black font-mono text-stone-900 dark:text-stone-100 mt-1 block">
              {totalPurchasesSum.toLocaleString()} {currencySymbol}
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              {invoices.length} فواتير توريد
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
              المسدد من الخزائن
            </span>
            <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">
              {totalPaidSum.toLocaleString()} {currencySymbol}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold">
              نقداً وإلكترونياً
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
              المتبقي الآجل للموردين
            </span>
            <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-400 mt-1 block">
              {totalRemainingSum.toLocaleString()} {currencySymbol}
            </span>
            <span className="text-[10px] text-amber-600 font-bold">
              مستحقات واجبة السداد
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block">
              شبكة الموردين
            </span>
            <span className="text-lg font-black font-mono text-blue-700 dark:text-blue-400 mt-1 block">
              {suppliers.length} موردين
            </span>
            <span className="text-[10px] text-blue-600 font-bold">
              جهات توريد معتمدة
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

      {/* 2. Invoices List & Filters */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              الكل ({invoices.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unpaid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'unpaid'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>فواتير عليها آجل ({invoices.filter((i) => (i.remainingAmount || 0) > 0).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('paid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'paid'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>فواتير مسددة بالكامل ({invoices.filter((i) => (i.remainingAmount || 0) <= 0).length})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-64 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الفاتورة أو المورد..."
              className="w-full px-3.5 py-1.5 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
            />
            <Search className="w-4 h-4 text-stone-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>
        </div>

        {/* Invoices List Display */}
        {loading ? (
          <div className="py-12 text-center text-stone-400 text-xs">جاري فحص وتحديث فواتير المشتريات...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-xs font-bold space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-stone-300" />
            <p>لا توجد فواتير مشتريات مطابقة في هذا التصنيف.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((inv) => {
              const isFullyPaid = (inv.remainingAmount || 0) <= 0;

              return (
                <div
                  key={inv.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 ${
                    isFullyPaid
                      ? 'bg-stone-50/60 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800'
                      : 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="font-mono font-black text-sm text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900">
                        #{inv.invoiceNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-stone-400" />
                        <h3 className="font-black text-sm sm:text-base text-stone-900 dark:text-stone-100">
                          {inv.supplierName}
                        </h3>
                      </div>
                      <span className="text-[11px] text-stone-400 font-mono">
                        {inv.date}
                      </span>

                      {/* Status */}
                      {isFullyPaid ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>خالصة مسددة</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>متبقي آجل ({inv.remainingAmount?.toLocaleString()} {currencySymbol})</span>
                        </span>
                      )}
                      {isDateInLockedMonth(workshopId, inv.date || '') && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-300">
                          مقفل رقابياً (للمراجعة فقط)
                        </span>
                      )}
                    </div>

                    {/* Financial Amounts & Action */}
                    <div className="flex items-center gap-3">
                      <div className="text-left font-mono">
                        <span className="text-[10px] text-stone-400 block">إجمالي الفاتورة:</span>
                        <span className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100">
                          {inv.totalAmount.toLocaleString()} {currencySymbol}
                        </span>
                      </div>

                      {!isFullyPaid && !isDateInLockedMonth(workshopId, inv.date || '') && (
                        <button
                          type="button"
                          onClick={() => handleOpenQuickPay(inv)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>سداد دفعة من الآجل</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Purchased Materials Items */}
                  <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-stone-400 font-bold">الخامات المشتراة:</span>
                    {inv.items?.map((item, idx) => (
                      <span
                        key={idx}
                        className="bg-white dark:bg-stone-900 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 font-mono text-[11px] text-stone-800 dark:text-stone-200"
                      >
                        {item.materialName}: {item.quantity} {item.unit} × {item.unitCost} {currencySymbol} ={' '}
                        <strong>{item.totalCost} {currencySymbol}</strong>
                      </span>
                    ))}
                    {inv.notes && (
                      <span className="text-stone-500 mr-2 text-[11px]">
                        • ملاحظة: {inv.notes}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: New Purchase Invoice */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleCreateInvoice}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-rose-300 dark:border-stone-700 w-full max-w-2xl max-h-[92vh] overflow-y-auto space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4 text-rose-600" />
                <span>تسجيل فاتورة شراء خامات جديدة وتوريد للمخزن</span>
              </h3>
            </div>

            {/* Supplier & Invoice metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    المورد *
                  </label>
                  {onOpenCreateSupplier && (
                    <button
                      type="button"
                      onClick={() => onOpenCreateSupplier()}
                      className="text-[10px] font-bold text-rose-600 hover:underline"
                    >
                      + مورد جديد
                    </button>
                  )}
                </div>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                >
                  <option value="">-- اختر جهة التوريد --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone || 'بدون هاتف'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  رقم الفاتورة / إذن التوريد *
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  تاريخ الفاتورة
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold outline-none"
                />
              </div>
            </div>

            {/* Purchased Raw Materials Rows */}
            <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  أصناف الخامات المشتراة (تُضاف فورياً لأرصدة المخزن):
                </span>
                <button
                  type="button"
                  onClick={handleAddMaterialRow}
                  className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة صنف</span>
                </button>
              </div>

              {purchasedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 grid grid-cols-12 gap-2 items-center text-xs"
                >
                  <div className="col-span-5">
                    <select
                      value={item.materialId}
                      onChange={(e) => {
                        const m = materials.find((mat) => mat.id === e.target.value);
                        if (m) {
                          const updated = [...purchasedItems];
                          updated[idx] = {
                            materialId: m.id,
                            materialName: m.materialName,
                            quantity: updated[idx].quantity,
                            unitCost: m.costPerUnit || 100,
                            unit: m.unit || 'وحدة',
                          };
                          setPurchasedItems(updated);
                        }
                      }}
                      className="w-full px-2 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.materialName} ({m.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <NumberInput
                      min={0.1}
                      step={0.1}
                      required
                      value={item.quantity}
                      onChange={(val) => {
                        const updated = [...purchasedItems];
                        updated[idx].quantity = val;
                        setPurchasedItems(updated);
                      }}
                      placeholder="الكمية"
                      className="w-full px-2 py-1.5 text-center rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-3">
                    <NumberInput
                      min={0.1}
                      step={0.1}
                      required
                      value={item.unitCost}
                      onChange={(val) => {
                        const updated = [...purchasedItems];
                        updated[idx].unitCost = val;
                        setPurchasedItems(updated);
                      }}
                      placeholder="سعر الوحدة"
                      className="w-full px-2 py-1.5 text-center rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => setPurchasedItems(purchasedItems.filter((_, i) => i !== idx))}
                      disabled={purchasedItems.length === 1}
                      className="p-1 text-rose-500 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total and Payment Allocation */}
            <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  إجمالي قيمة الفاتورة:
                </span>
                <span className="text-base font-black font-mono text-rose-700 dark:text-rose-400">
                  {modalInvoiceTotal.toLocaleString()} {currencySymbol}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    المبلغ المسدد نقداً/إلكترونياً الآن ({currencySymbol}):
                  </label>
                  <NumberInput
                    min={0}
                    value={paidAmount}
                    onChange={(val) => setPaidAmount(Number(val) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-stone-900 font-mono font-bold text-xs text-center"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-[11px] font-bold text-stone-500">
                    المتبقي الآجل على الورشة للمورد:
                  </span>
                  <span className="text-sm font-black font-mono text-amber-700 dark:text-amber-400">
                    {Math.max(0, modalInvoiceTotal - paidAmount).toLocaleString()} {currencySymbol}
                  </span>
                </div>
              </div>

              {/* Disbursement Source Selector (if paid > 0) */}
              {paidAmount > 0 && (
                <div className="pt-2 border-t border-rose-200/80 dark:border-rose-900/50">
                  <DisbursementSourceSelector
                    workshopId={workshopId}
                    currencySymbol={currencySymbol}
                    selectedSourceId={selectedSource.id}
                    onSourceChange={setSelectedSource}
                    selectedChannel={paymentChannel}
                    onChannelChange={setPaymentChannel}
                    disbursedAmount={paidAmount}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                ملاحظات الفاتورة والتوريد
              </label>
              <input
                type="text"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="مثال: خيوط قطن غزل المحلة كود 24، تم الفحص والاستلام بالمخزن"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || modalInvoiceTotal <= 0}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'جاري التسجيل...' : 'اعتماد فاتورة الشراء وتغذية المخزن'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK PAY MODAL */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteQuickPay}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-lg space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-amber-600" />
                <span>سداد دفعة آجلة للمورد: {payingInvoice.supplierName}</span>
              </h3>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1 text-xs">
              <p className="text-stone-700 dark:text-stone-300">
                فاتورة توريد رقم: <strong className="font-mono">#{payingInvoice.invoiceNumber}</strong>
              </p>
              <p className="text-stone-700 dark:text-stone-300">
                إجمالي الفاتورة: <strong className="font-mono">{payingInvoice.totalAmount.toLocaleString()} {currencySymbol}</strong> • المسدد سابقاً: <strong className="font-mono text-emerald-600">{payingInvoice.paidAmount.toLocaleString()} {currencySymbol}</strong>
              </p>
              <p className="text-amber-800 dark:text-amber-300 font-bold">
                المتبقي الآجل حالياً: <strong className="font-mono text-sm">{payingInvoice.remainingAmount?.toLocaleString()} {currencySymbol}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                المبلغ المراد سداده الآن ({currencySymbol}) *
              </label>
              <NumberInput
                min={1}
                max={payingInvoice.remainingAmount || 1}
                required
                value={quickPayAmount}
                onChange={(val) => setQuickPayAmount(Number(val) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 font-mono font-bold text-xs text-center"
              />
            </div>

            <DisbursementSourceSelector
              workshopId={workshopId}
              currencySymbol={currencySymbol}
              selectedSourceId={payingSelectedSource.id}
              onSourceChange={setPayingSelectedSource}
              selectedChannel={payingChannel}
              onChannelChange={setPayingChannel}
              disbursedAmount={quickPayAmount}
            />

            <div className="pt-3 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={quickPaySubmitting || quickPayAmount <= 0}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {quickPaySubmitting ? 'جاري السداد والخصم...' : 'تأكيد السداد والخصم من الخزينة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
