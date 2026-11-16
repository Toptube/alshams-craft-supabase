import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Snowflake,
  Store,
  Table2,
  Truck,
  X,
  GitBranch,
  Building2,
} from 'lucide-react';
import {
  AdminEnrichedSupplier,
  fetchAdminSupplierCatalog,
  fetchAdminSuppliers,
  moderateAdminSupplier,
  updateSupplierVisibility,
} from '../../db/supplierService';
import {
  approveSupplierBranchExpansion,
  fetchAdminSupplierBranches,
} from '../../db/supplierErpService';
import { SupplierBranch, SupplierBranchTreasury } from '../../types/supplierErp';
import { SUPPLIER_SUPPLY_SECTIONS, SupplierCatalogItem } from '../../types/supplier';
import { playSuccessSound, playErrorSound } from '../../lib/sounds';
import { formatWhatsAppPhone } from './adminTypes';

interface AdminSuppliersPageProps {
  userEmail?: string;
  onBack: () => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

export const AdminSuppliersPage: React.FC<AdminSuppliersPageProps> = ({
  userEmail,
  onBack,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [suppliers, setSuppliers] = useState<AdminEnrichedSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'frozen' | 'hidden_store' | 'hidden_market'>('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Price Sheet / Catalog Inspection Modal
  const [inspectingSupplier, setInspectingSupplier] = useState<AdminEnrichedSupplier | null>(null);
  const [inspectItems, setInspectItems] = useState<SupplierCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Branch Inspection Modal
  const [branchInspectSup, setBranchInspectSup] = useState<AdminEnrichedSupplier | null>(null);
  const [inspectBranches, setInspectBranches] = useState<SupplierBranch[]>([]);
  const [inspectTreasuries, setInspectTreasuries] = useState<SupplierBranchTreasury[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const list = await fetchAdminSuppliers(userEmail);
      setSuppliers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [userEmail]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return suppliers.filter((s) => {
      const isFrozenOrBanned = Boolean(s.isFrozen || s.status === 'suspended' || s.status === 'banned');
      if (statusFilter === 'active' && isFrozenOrBanned) return false;
      if (statusFilter === 'frozen' && !isFrozenOrBanned) return false;
      if (statusFilter === 'hidden_store' && !s.hideStorefront) return false;
      if (statusFilter === 'hidden_market' && !s.hideFromMarket) return false;
      if (sectionFilter !== 'all' && !s.supplySections.includes(sectionFilter as any)) return false;

      if (!q) return true;
      return (
        s.brandName.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.governorate || '').toLowerCase().includes(q)
      );
    });
  }, [suppliers, searchQuery, statusFilter, sectionFilter]);

  const handleToggleVisibility = async (
    sup: AdminEnrichedSupplier,
    field: 'hideStorefront' | 'hideFromMarket'
  ) => {
    const nextVal = !sup[field];
    setTogglingId(`${sup.id}_${field}`);
    try {
      const res = await updateSupplierVisibility(sup.id, { [field]: nextVal }, userEmail);
      if (res.success) {
        setSuppliers((prev) => prev.map((x) => (x.id === sup.id ? { ...x, [field]: nextVal } : x)));
        playSuccessSound();
        if (field === 'hideStorefront') {
          onNotifySuccess(
            nextVal
              ? `تم إخفاء المتجر الخاص للمورد "${sup.brandName}" مع استمرار عمل حسابه.`
              : `تم إظهار المتجر الخاص للمورد "${sup.brandName}" بنجاح.`
          );
        } else {
          onNotifySuccess(
            nextVal
              ? `تم إخفاء كافة خامات "${sup.brandName}" من سوق موردين الشمساوية.`
              : `تمت إعادة إظهار خامات "${sup.brandName}" في سوق موردين الشمساوية.`
          );
        }
      } else {
        playErrorSound();
        onNotifyError(res.error || 'تعذر تحديث حالة الظهور');
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleModeration = async (
    sup: AdminEnrichedSupplier,
    action: 'activate' | 'suspend' | 'ban'
  ) => {
    setTogglingId(`${sup.id}_${action}`);
    try {
      const payload =
        action === 'activate'
          ? { status: 'active' as const, isFrozen: false, suspensionReason: '' }
          : action === 'suspend'
          ? { status: 'suspended' as const, isFrozen: true, suspensionReason: 'مراجعة إدارية للأسعار والمنتجات' }
          : { status: 'banned' as const, isFrozen: true, suspensionReason: 'حظر إداري نهائي' };

      const res = await moderateAdminSupplier(sup.id, payload, userEmail);
      if (res.success) {
        setSuppliers((prev) =>
          prev.map((x) => (x.id === sup.id ? { ...x, status: payload.status, isFrozen: payload.isFrozen } : x))
        );
        playSuccessSound();
        onNotifySuccess(`تم تحديث حالة المورد "${sup.brandName}".`);
      } else {
        onNotifyError(res.error || 'تعذر تحديث حالة المورد');
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleInspectCatalog = async (sup: AdminEnrichedSupplier) => {
    setInspectingSupplier(sup);
    setLoadingCatalog(true);
    try {
      const list = await fetchAdminSupplierCatalog(sup.id, userEmail);
      setInspectItems(list);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleInspectBranches = async (sup: AdminEnrichedSupplier) => {
    setBranchInspectSup(sup);
    setLoadingBranches(true);
    try {
      const res = await fetchAdminSupplierBranches(sup.id, userEmail);
      setInspectBranches(res.branches || []);
      setInspectTreasuries(res.branchTreasuries || []);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleBranchDecision = async (sup: AdminEnrichedSupplier, approve: boolean) => {
    const requested = Math.max(2, Number(sup.branchExpansionRequested || 2));
    setTogglingId(`${sup.id}_branch`);
    try {
      const res = await approveSupplierBranchExpansion(sup.id, approve, requested, userEmail);
      if (res?.success) {
        setSuppliers((prev) =>
          prev.map((x) =>
            x.id === sup.id
              ? {
                  ...x,
                  maxBranchesApproved: approve ? requested : x.maxBranchesApproved,
                  branchExpansionStatus: approve ? 'approved' : 'rejected',
                }
              : x
          )
        );
        playSuccessSound();
        onNotifySuccess(
          approve
            ? `تمت الموافقة على توسع فروع "${sup.brandName}" حتى ${requested} فروع.`
            : `تم رفض طلب التوسع للمورد "${sup.brandName}".`
        );
      } else {
        playErrorSound();
        onNotifyError(res?.error || 'تعذر تنفيذ القرار');
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>رجوع</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-xl font-black flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>إدارة الموردين وصلاحيات الظهور ({filteredSuppliers.length})</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={loadSuppliers}
          disabled={loading}
          className="p-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المورد، المحل، الهاتف، أو المحافظة..."
            className="w-full h-10 pr-10 pl-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل الموردين ({suppliers.length})</option>
            <option value="active">نشطين فقط</option>
            <option value="frozen">موقوفين / محظورين</option>
            <option value="hidden_store">مخفي متجرهم الخاص</option>
            <option value="hidden_market">مخفيين من سوق الموردين</option>
          </select>
        </div>

        <div className="md:col-span-4">
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل أقسام التوريد</option>
            {SUPPLIER_SUPPLY_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titleAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs font-bold text-[#475569]">
          جاري تحميل بيانات الموردين...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569]">
          لا يوجد موردون مسجلون مطابقون للبحث الحالي.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map((sup) => {
            const isBlocked = Boolean(sup.isFrozen || sup.status === 'suspended' || sup.status === 'banned');
            const waPhone = formatWhatsAppPhone(sup.phone);
            const slug = sup.storeSlug || sup.id;
            const storeUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/supplier/${encodeURIComponent(slug)}` : `/#/supplier/${slug}`;
            return (
              <div
                key={sup.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={sup.logoUrl || '/alshams_falcon_emblem.png'}
                      alt={sup.brandName}
                      className="w-11 h-11 rounded-xl object-contain bg-[#EFE9DC] dark:bg-[#132040] p-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-black truncate">{sup.brandName}</h3>
                      <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8] truncate">
                        {sup.ownerName} · {sup.governorate || sup.country}
                      </p>
                      <p className="text-[11px] font-mono text-[#475569] dark:text-[#94A3B8] truncate">{sup.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                      sup.status === 'banned'
                        ? 'bg-rose-500/15 text-rose-700'
                        : isBlocked
                        ? 'bg-amber-500/15 text-amber-800'
                        : 'bg-emerald-500/15 text-emerald-700'
                    }`}
                  >
                    {sup.status === 'banned' ? 'محظور' : isBlocked ? 'موقوف' : 'نشط'}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-2 text-center font-mono tabular-nums text-[11px]">
                  <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[9px] font-sans text-[#475569]">الأصناف</span>
                    <span className="font-black">{sup.itemsCount}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[9px] font-sans text-[#475569]">الطلبات</span>
                    <span className="font-black">{sup.ordersCount}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[9px] font-sans text-[#475569]">العملاء</span>
                    <span className="font-black">{sup.customersCount}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[9px] font-sans text-[#475569]">المبيعات</span>
                    <span className="font-black text-[#EA580C]">{sup.totalRevenue.toLocaleString('ar-EG')}</span>
                  </div>
                </div>

                {/* Dual Granular Visibility Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={togglingId === `${sup.id}_hideStorefront`}
                    onClick={() => handleToggleVisibility(sup, 'hideStorefront')}
                    className={`py-2 px-3 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      sup.hideStorefront
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-[#EFE9DC] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                    }`}
                  >
                    {sup.hideStorefront ? <EyeOff className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5 text-emerald-600" />}
                    <span>{sup.hideStorefront ? 'المتجر الخاص: مخفي (اضغط للإظهار)' : 'المتجر الخاص: ظاهر'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={togglingId === `${sup.id}_hideFromMarket`}
                    onClick={() => handleToggleVisibility(sup, 'hideFromMarket')}
                    className={`py-2 px-3 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      sup.hideFromMarket
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-[#EFE9DC] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                    }`}
                  >
                    {sup.hideFromMarket ? <EyeOff className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5 text-[#EA580C]" />}
                    <span>{sup.hideFromMarket ? 'سوق الموردين: مخفي (اضغط للإظهار)' : 'سوق الموردين: ظاهر'}</span>
                  </button>
                </div>

                {/* Branch Expansion Governance Strip */}
                <div className="rounded-xl bg-[#EFE9DC]/80 dark:bg-[#132040]/80 border border-[#D4CCBC] dark:border-[#22355E] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold">
                    <GitBranch className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>
                      الفروع المعتمدة: <strong className="font-mono">{sup.maxBranchesApproved || 1}</strong>
                      {sup.hasCentralWarehouse ? ' · مخزن مركزي مُفعّل' : ''}
                    </span>
                  </div>
                  {sup.branchExpansionStatus === 'pending' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-amber-700 dark:text-amber-300">
                        طلب فتح {sup.branchExpansionRequested} فروع
                      </span>
                      <button
                        type="button"
                        disabled={togglingId === `${sup.id}_branch`}
                        onClick={() => handleBranchDecision(sup, true)}
                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black cursor-pointer"
                      >
                        موافقة
                      </button>
                      <button
                        type="button"
                        disabled={togglingId === `${sup.id}_branch`}
                        onClick={() => handleBranchDecision(sup, false)}
                        className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                      >
                        رفض
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInspectBranches(sup)}
                      className="text-[10px] font-black text-[#C2410C] dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Building2 className="w-3 h-3" />
                      <span>فحص الفروع</span>
                    </button>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                  <button
                    type="button"
                    onClick={() => handleInspectCatalog(sup)}
                    className="px-3 py-1.5 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Table2 className="w-3.5 h-3.5 text-[#FBBF24]" />
                    <span>مراجعة الأسعار والخامات</span>
                  </button>

                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>معاينة</span>
                  </a>

                  {isBlocked ? (
                    <button
                      type="button"
                      onClick={() => handleModeration(sup, 'activate')}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تفعيل</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleModeration(sup, 'suspend')}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-600 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Snowflake className="w-3.5 h-3.5" />
                      <span>إيقاف مؤقت</span>
                    </button>
                  )}

                  {sup.status !== 'banned' && (
                    <button
                      type="button"
                      onClick={() => handleModeration(sup, 'ban')}
                      className="p-1.5 rounded-xl bg-rose-600 text-white cursor-pointer"
                      title="حظر نهائي"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Catalog Modal */}
      {inspectingSupplier && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectingSupplier(null);
          }}
        >
          <div className="w-full max-w-4xl max-h-[85vh] rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-black">
                كتالوج وأسعار: {inspectingSupplier.brandName} ({inspectItems.length})
              </h2>
              <button type="button" onClick={() => setInspectingSupplier(null)} className="p-1.5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingCatalog ? (
                <p className="text-center py-8 text-xs font-bold">جاري تحميل الأصناف...</p>
              ) : inspectItems.length === 0 ? (
                <p className="text-center py-8 text-xs font-bold text-[#475569]">لم يرفع المورد خامات بعد.</p>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
                    <tr>
                      <th className="p-2.5 font-black">الصنف</th>
                      <th className="p-2.5 font-black">الوحدة</th>
                      <th className="p-2.5 font-black">القطاعي</th>
                      <th className="p-2.5 font-black">الجملة</th>
                      <th className="p-2.5 font-black">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                    {inspectItems.map((it) => (
                      <tr key={it.id}>
                        <td className="p-2.5 font-black">{it.name}</td>
                        <td className="p-2.5">{it.unit}</td>
                        <td className="p-2.5 font-mono tabular-nums">{it.retailPrice}</td>
                        <td className="p-2.5 font-mono tabular-nums text-emerald-700">{it.wholesalePrice} (×{it.minWholesaleQty})</td>
                        <td className="p-2.5 font-mono tabular-nums">{it.stockQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inspect Branches Modal */}
      {branchInspectSup && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBranchInspectSup(null);
          }}
        >
          <div className="w-full max-w-3xl max-h-[85vh] rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#EA580C]" />
                <span>فروع وخزائن: {branchInspectSup.brandName}</span>
              </h2>
              <button type="button" onClick={() => setBranchInspectSup(null)} className="p-1.5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingBranches ? (
                <p className="text-center py-8 text-xs font-bold">جاري تحميل بيانات الفروع...</p>
              ) : inspectBranches.length === 0 ? (
                <p className="text-center py-8 text-xs font-bold text-[#475569]">لم يُنشئ المورد شجرة فروع بعد (الحد الافتراضي: فرع واحد).</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inspectBranches.map((br) => {
                    const tr = inspectTreasuries.find((t) => t.branchId === br.id);
                    const total =
                      Number(tr?.cashBalance || 0) +
                      Number(tr?.instapayBalance || 0) +
                      Number(tr?.walletBalance || 0);
                    return (
                      <div
                        key={br.id}
                        className="rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black">{br.name}</span>
                          <span className="font-mono text-[10px] font-bold text-[#C2410C] dark:text-amber-300">
                            {br.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                          {br.branchType === 'central_warehouse' ? 'مخزن رئيسي مركزي' : 'فرع بيع وكاشير'} · {br.governorate || 'غير محدد'}
                        </p>
                        {br.branchType === 'shop' && (
                          <p className="text-[11px] font-mono tabular-nums font-bold">
                            خزينة الفرع: {total.toLocaleString('ar-EG')} ج.م
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
