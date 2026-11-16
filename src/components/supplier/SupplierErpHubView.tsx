import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { SupplierErpOverview } from '../../types/supplierErp';
import {
  confirmOwnerTreasuryTransfer,
  fetchSupplierErpOverview,
  requestBranchExpansion,
  saveSupplierErpTree,
} from '../../db/supplierErpService';
import { playErrorSound, playSuccessSound } from '../../lib/sounds';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  GitBranch,
  Lock,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  ShoppingCart,
  Users2,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react';

interface SupplierErpHubViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
  onNavigateToPos: (branchId?: string) => void;
  onNavigateToWarehouse: (branchId?: string) => void;
  onNavigateToHrTerminal: (branchId?: string) => void;
}

export const SupplierErpHubView: React.FC<SupplierErpHubViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
  onNavigateToPos,
  onNavigateToWarehouse,
  onNavigateToHrTerminal,
}) => {
  const currency = profile.currencySymbol || 'ج.م';
  const [overview, setOverview] = useState<SupplierErpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Add branch modal
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchGov, setBranchGov] = useState(profile.governorate || 'القاهرة');
  const [branchAddr, setBranchAddr] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [savingTree, setSavingTree] = useState(false);

  // Expansion request modal (>1 branch)
  const [isExpandModalOpen, setIsExpandModalOpen] = useState(false);
  const [reqCount, setReqCount] = useState(2);
  const [reqReason, setReqReason] = useState('');

  // Owner PIN setup
  const [pinInput, setPinInput] = useState('');

  const loadOverview = async () => {
    setLoading(true);
    const data = await fetchSupplierErpOverview();
    setOverview(data);
    setLoading(false);
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const showMsg = (text: string, isError = false) => {
    setNotice({ text, isError });
    if (isError) playErrorSound();
    else playSuccessSound();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleToggleCentralWarehouse = async () => {
    if (!overview) return;
    setSavingTree(true);
    const res = await saveSupplierErpTree({
      hasCentralWarehouse: !overview.hasCentralWarehouse,
    });
    setSavingTree(false);
    if (res.success) {
      await loadOverview();
      showMsg(
        !overview.hasCentralWarehouse
          ? 'تم تفعيل المخزن الرئيسي المركزي لتغذية الفروع.'
          : 'تم تحديث إعداد المخزن المركزي.'
      );
    } else {
      showMsg(res.error || 'تعذر التحديث', true);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    setSavingTree(true);
    const res = await saveSupplierErpTree({
      newBranch: {
        name: branchName.trim(),
        governorate: branchGov.trim(),
        address: branchAddr.trim(),
        phone: branchPhone.trim(),
      },
    });
    setSavingTree(false);
    if (res.success) {
      setBranchName('');
      setBranchAddr('');
      setBranchPhone('');
      setIsAddBranchOpen(false);
      await loadOverview();
      showMsg('تم إنشاء الفرع الجديد بنجاح.');
    } else if (res.requiresAdminApproval) {
      setIsAddBranchOpen(false);
      setIsExpandModalOpen(true);
      showMsg(res.error || 'توسع الفروع يتطلب موافقة الإدارة', true);
    } else {
      showMsg(res.error || 'تعذر إضافة الفرع', true);
    }
  };

  const handleSubmitExpansionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTree(true);
    const res = await requestBranchExpansion(reqCount, reqReason);
    setSavingTree(false);
    if (res?.success) {
      setIsExpandModalOpen(false);
      await loadOverview();
      showMsg('تم إرسال طلب فتح فروع إضافية إلى السوبر أدمن للمراجعة والاعتماد.');
    } else {
      showMsg(res?.error || 'تعذر إرسال الطلب', true);
    }
  };

  const handleUpdateOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().length < 4) {
      showMsg('الرقم السري يجب أن لا يقل عن ٤ أرقام أو حروف', true);
      return;
    }
    const res = await saveSupplierErpTree({ ownerUnlockPin: pinInput.trim() });
    if (res.success) {
      setPinInput('');
      showMsg('تم تحديث الرقم السري لفك تثبيت الأجهزة الطرفية.');
    } else {
      showMsg(res.error || 'تعذر حفظ الرقم السري', true);
    }
  };

  const handleConfirmTransfer = async (transferId: string, approve: boolean) => {
    const res = await confirmOwnerTreasuryTransfer(transferId, approve);
    if (res.success) {
      await loadOverview();
      showMsg(
        approve
          ? 'تم تأكيد الاستلام وإيداع المبلغ في الخزينة الرئيسية بنجاح.'
          : 'تم رفض التوريد وإرجاع الرصيد لخزينة الفرع.'
      );
    } else {
      showMsg(res.error || 'تعذر تنفيذ العملية', true);
    }
  };

  const shopBranches = (overview?.branches || []).filter((b) => b.branchType === 'shop');
  const centralBranches = (overview?.branches || []).filter((b) => b.branchType === 'central_warehouse');

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5 text-right" dir="rtl">
      {/* Header Bar */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#EA580C]" />
              <span>مركز قيادة الفروع والمخازن والخزينة (ERP)</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              شجرة الفروع · كاشير نقاط البيع · أرصدة الخزائن · المديونيات والمستحقات
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onNavigateToPos()}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>فتح الكاشير (POS)</span>
          </button>
          <button
            type="button"
            onClick={onGoHome}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-black border ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Owner Cashflow Truth Strip: معنا كام · لينا بره كام · علينا كام للمصانع · قيمة البضاعة */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
            معانا كام (خزينة رئيسية + الفروع)
          </p>
          <p className="mt-1.5 text-lg sm:text-xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {loading ? '...' : (overview?.kpis.totalCashOnHand || 0).toLocaleString('ar-EG')} {currency}
          </p>
          <p className="mt-1 text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
            رئيسية: {(overview?.kpis.ownerMainTreasuryTotal || 0).toLocaleString('ar-EG')} · فروع:{' '}
            {(overview?.kpis.branchesPendingTreasuryTotal || 0).toLocaleString('ar-EG')}
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
            لينا بره كام (مديونية وآجل العملاء)
          </p>
          <p className="mt-1.5 text-lg sm:text-xl font-black font-mono tabular-nums text-[#C2410C] dark:text-amber-300">
            {loading ? '...' : (overview?.kpis.receivablesFromCustomers || 0).toLocaleString('ar-EG')} {currency}
          </p>
          <p className="mt-1 text-[10px] text-[#475569] dark:text-[#94A3B8]">
            أرصدة مستحقة على العملاء والورش
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
            علينا كام (مستحقات المصانع والموردين)
          </p>
          <p className="mt-1.5 text-lg sm:text-xl font-black font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {loading ? '...' : (overview?.kpis.payablesToVendors || 0).toLocaleString('ar-EG')} {currency}
          </p>
          <p className="mt-1 text-[10px] text-[#475569] dark:text-[#94A3B8]">
            فواتير شراء خامات آجلة للمصانع
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
            التقييم المالي للمخازن (بسعر الشراء)
          </p>
          <p className="mt-1.5 text-lg sm:text-xl font-black font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]">
            {loading ? '...' : (overview?.kpis.totalStockValuation || 0).toLocaleString('ar-EG')} {currency}
          </p>
          <p className="mt-1 text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
            مبيعات اليوم POS: {(overview?.kpis.todayPosSales || 0).toLocaleString('ar-EG')} {currency} (
            {overview?.kpis.todayPosOrdersCount || 0} فاتورة)
          </p>
        </div>
      </section>

      {/* Pending Treasury Confirmations from Branches (تأكيد استلام الفلوس من الفروع) */}
      {(overview?.pendingTransfers?.length || 0) > 0 && (
        <section className="rounded-2xl bg-amber-500/10 dark:bg-amber-950/25 border-2 border-[#EA580C] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-[#C2410C] dark:text-amber-300 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              <span>توريدات خزائن الفروع بانتظار تأكيد الاستلام منك ({overview?.pendingTransfers.length})</span>
            </h2>
            <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
              لا تدخل الأموال لرصيد الخزينة الرئيسية إلا بعد ضغط "تأكيد الاستلام"
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overview!.pendingTransfers.map((tr) => (
              <div
                key={tr.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black">{tr.branchName}</p>
                    <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      المرسِل: {tr.sentByName} · {tr.createdAt ? new Date(tr.createdAt).toLocaleString('ar-EG') : ''}
                    </p>
                  </div>
                  <span className="text-base font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                    {tr.totalAmount.toLocaleString('ar-EG')} {currency}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono tabular-nums">
                  <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] p-2">
                    <span className="block text-[9px] font-sans text-[#475569]">كاش</span>
                    <span className="font-black">{tr.cashAmount.toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] p-2">
                    <span className="block text-[9px] font-sans text-[#475569]">إنستا باي</span>
                    <span className="font-black">{tr.instapayAmount.toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] p-2">
                    <span className="block text-[9px] font-sans text-[#475569]">محفظة</span>
                    <span className="font-black">{tr.walletAmount.toLocaleString('ar-EG')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmTransfer(tr.id, true)}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد استلام الفلوس</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmTransfer(tr.id, false)}
                    className="px-3 py-2 rounded-xl bg-rose-600/15 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>رفض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Organization Tree Setup Strip */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              هيكل وشجرة النشاط ({shopBranches.length} / {overview?.maxBranchesApproved || 1} فرع معتمد)
            </h2>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              يبدأ كل مورد بفرع رئيسي واحد افتراضياً. لإضافة أكثر من فرع، يتم تقديم طلب اعتماد للإدارة العليا.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={savingTree}
              onClick={handleToggleCentralWarehouse}
              className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
                overview?.hasCentralWarehouse
                  ? 'bg-[#0C1427] dark:bg-amber-400 text-white dark:text-[#0C1427] border-[#0C1427]'
                  : 'bg-[#EFE9DC] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
              }`}
            >
              <Warehouse className="w-4 h-4" />
              <span>
                {overview?.hasCentralWarehouse ? 'المخزن المركزي: مُفعّل ✓' : 'تفعيل المخزن المركزي لتغذية الفروع'}
              </span>
            </button>

            {shopBranches.length < (overview?.maxBranchesApproved || 1) ? (
              <button
                type="button"
                onClick={() => setIsAddBranchOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة فرع معتمد</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsExpandModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C] text-[#C2410C] dark:text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {overview?.branchExpansionStatus === 'pending'
                    ? `طلب فتح ${overview.branchExpansionRequested} فروع (قيد مراجعة الإدارة)`
                    : 'طلب فتح فروع إضافية (موافقة السوبر أدمن)'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Central Warehouses Cards */}
        {centralBranches.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {centralBranches.map((cw) => (
              <div
                key={cw.id}
                className="rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0C1427] text-amber-300 flex items-center justify-center shrink-0">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">{cw.name}</h3>
                    <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      {cw.code} · يستقبل توريدات المصانع ويُغذي كافة الفروع بالتحويلات الداخلية
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToWarehouse(cw.id)}
                  className="px-4 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                >
                  إدارة المخزون والتحويلات والمصانع
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Branch-by-Branch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {shopBranches.map((br) => {
            const tr = overview?.branchTreasuries.find((t) => t.branchId === br.id);
            const btTotal =
              Number(tr?.cashBalance || 0) +
              Number(tr?.instapayBalance || 0) +
              Number(tr?.walletBalance || 0);
            const activeShift = overview?.openShifts.find((s) => s.branchId === br.id);

            return (
              <div
                key={br.id}
                className="rounded-2xl bg-[#EFE9DC]/70 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-[#EA580C] shrink-0" />
                      <h3 className="text-sm font-black truncate">{br.name}</h3>
                    </div>
                    <span className="font-mono text-[11px] font-black text-[#C2410C] dark:text-amber-300">
                      {br.code}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    {br.governorate || 'مصر'} {br.address ? `· ${br.address}` : ''}
                  </p>

                  <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[10px]">
                    <div className="rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] p-1.5">
                      <span className="block text-[9px] font-sans text-[#475569]">كاش</span>
                      <span className="font-black">{Number(tr?.cashBalance || 0).toLocaleString('ar-EG')}</span>
                    </div>
                    <div className="rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] p-1.5">
                      <span className="block text-[9px] font-sans text-[#475569]">إنستا باي</span>
                      <span className="font-black">{Number(tr?.instapayBalance || 0).toLocaleString('ar-EG')}</span>
                    </div>
                    <div className="rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] p-1.5">
                      <span className="block text-[9px] font-sans text-[#475569]">محفظة</span>
                      <span className="font-black">{Number(tr?.walletBalance || 0).toLocaleString('ar-EG')}</span>
                    </div>
                  </div>

                  <div className="text-[11px] flex items-center justify-between pt-1 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                    <span className="font-bold text-[#475569] dark:text-[#94A3B8]">
                      خزينة الفرع: <strong className="font-mono text-[#0C1427] dark:text-amber-300">{btTotal.toLocaleString('ar-EG')} {currency}</strong>
                    </span>
                    <span className={activeShift ? 'text-emerald-600 font-black' : 'text-[#475569]'}>
                      {activeShift ? `وردية مفتوحة (${activeShift.staffName})` : 'لا توجد وردية مفتوحة'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigateToPos(br.id)}
                    className="py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black cursor-pointer"
                  >
                    كاشير POS
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToWarehouse(br.id)}
                    className="py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black cursor-pointer"
                  >
                    الجرد وكارت الصنف
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToHrTerminal(br.id)}
                    className="py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black cursor-pointer"
                  >
                    الطاقم والتثبيت
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Modules Strip + Owner PIN Guard */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigateToWarehouse()}
          className="text-right rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] p-4 flex items-center gap-3 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5 text-[#EA580C]" />
          </div>
          <div>
            <h3 className="text-sm font-black">المخازن (بدون صور) · كارت الصنف · المصانع</h3>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              تصنيفات رئيسية وفرعية · تحويل الوحدات (طرد ← كيلو) · جرد مالي · فواتير المصانع
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateToHrTerminal()}
          className="text-right rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] p-4 flex items-center gap-3 cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center shrink-0">
            <Users2 className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-black">شؤون العاملين (HR) وتثبيت شاشات الفروع</h3>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              بطاقات الموظفين · الحضور والجزاءات والسلف · يوزر وباسورد · تثبيت الجهاز بوضع Kiosk
            </p>
          </div>
        </button>

        <form
          onSubmit={handleUpdateOwnerPin}
          className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2"
        >
          <div className="flex items-center gap-2 text-xs font-black">
            <Lock className="w-4 h-4 text-[#EA580C]" />
            <span>الرقم السري لفك تثبيت الأجهزة الطرفية</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="رقم سري جديد (الافتراضي 1234)"
              className="flex-1 h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono"
            />
            <button
              type="submit"
              className="px-3.5 h-9 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white text-xs font-black cursor-pointer"
            >
              حفظ PIN
            </button>
          </div>
        </form>
      </section>

      {/* Add Branch Modal */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3" dir="rtl">
          <form
            onSubmit={handleCreateBranch}
            className="w-full max-w-md rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">إضافة فرع بيع جديد</h3>
              <button type="button" onClick={() => setIsAddBranchOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="اسم الفرع (مثال: فرع المهندسين)"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <input
              type="text"
              value={branchGov}
              onChange={(e) => setBranchGov(e.target.value)}
              placeholder="المحافظة"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <input
              type="text"
              value={branchAddr}
              onChange={(e) => setBranchAddr(e.target.value)}
              placeholder="العنوان بالتفصيل"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <input
              type="text"
              value={branchPhone}
              onChange={(e) => setBranchPhone(e.target.value)}
              placeholder="هاتف الفرع"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono"
            />
            <button
              type="submit"
              disabled={savingTree}
              className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer"
            >
              {savingTree ? 'جاري الإنشاء...' : 'حفظ وإنشاء الفرع'}
            </button>
          </form>
        </div>
      )}

      {/* Super Admin Branch Expansion Request Modal */}
      {isExpandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3" dir="rtl">
          <form
            onSubmit={handleSubmitExpansionRequest}
            className="w-full max-w-md rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-1.5">
                <MonitorSmartphone className="w-4 h-4 text-[#EA580C]" />
                <span>طلب موافقة الإدارة لفتح فروع إضافية</span>
              </h3>
              <button type="button" onClick={() => setIsExpandModalOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              تسمح المنظومة بفرع واحد افتراضياً لضمان جودة الأداء وسرعة المزامنة. أرسل عدد الفروع الإجمالية المطلوبة ليقوم السوبر أدمن باعتمادها فوراً.
            </p>
            <div>
              <label className="block text-[11px] font-bold mb-1">إجمالي الفروع المطلوبة (شاملة الفرع الحالي)</label>
              <input
                type="number"
                min={2}
                max={25}
                value={reqCount}
                onChange={(e) => setReqCount(Number(e.target.value || 2))}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1">تفاصيل الفروع الجديدة ومواقعها</label>
              <textarea
                rows={3}
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="مثال: فرع جديد في الإسكندرية + فرع طنطا + مخزن رئيسي"
                className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={savingTree}
              className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer"
            >
              {savingTree ? 'جاري الإرسال...' : 'إرسال الطلب لاعتماد السوبر أدمن'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
