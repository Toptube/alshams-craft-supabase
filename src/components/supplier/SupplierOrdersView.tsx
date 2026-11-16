import React, { useEffect, useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import {
  B2BSupplyOrder,
  B2BSupplyOrderItem,
  SupplierCatalogItem,
  SupplierOrderSource,
  SupplierTreasury,
} from '../../types/supplier';
import {
  fetchSupplierOrders,
  fetchSupplierCatalog,
  fetchSupplierFinance,
  createSupplierOrder,
  updateSupplierOrderStatus,
} from '../../db/supplierService';
import {
  ArrowRight,
  X,
  Package,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface SupplierOrdersViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
}

const SOURCE_LABELS: Record<SupplierOrderSource, string> = {
  direct_supplier_store: 'متجري',
  suppliers_market: 'موردين الشمساوية',
  external_manual: 'خارج المنظومة',
};

const STATUS_LABELS: Record<B2BSupplyOrder['status'], string> = {
  pending: 'قيد المراجعة',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export const SupplierOrdersView: React.FC<SupplierOrdersViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
}) => {
  const currencySymbol = profile.currencySymbol || 'ج.م';
  const [orders, setOrders] = useState<B2BSupplyOrder[]>([]);
  const [catalog, setCatalog] = useState<SupplierCatalogItem[]>([]);
  const [treasuries, setTreasuries] = useState<SupplierTreasury[]>([]);
  const [loading, setLoading] = useState(true);

  const [sourceFilter, setSourceFilter] = useState<'all' | SupplierOrderSource>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | B2BSupplyOrder['status']>('all');
  const [search, setSearch] = useState('');

  // Manual External Order Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerGov, setBuyerGov] = useState('');
  const [selectedItems, setSelectedItems] = useState<B2BSupplyOrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [supplierTreasuryId, setSupplierTreasuryId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [ords, cat, fin] = await Promise.all([
      fetchSupplierOrders(),
      fetchSupplierCatalog(),
      fetchSupplierFinance(),
    ]);
    setOrders(ords);
    setCatalog(cat);
    setTreasuries(fin.treasuries);
    if (fin.treasuries[0] && !supplierTreasuryId) {
      setSupplierTreasuryId(fin.treasuries[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (sourceFilter !== 'all' && o.orderSource !== sourceFilter) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (q) {
        const hay = `${o.orderNumber} ${o.externalBuyer?.name || ''} ${
          o.externalBuyer?.phone || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, sourceFilter, statusFilter, search]);

  const subtotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + Number(i.lineTotal || 0), 0),
    [selectedItems]
  );
  const finalTotal = Math.max(0, subtotal - Number(discount || 0) + Number(shippingFee || 0));

  const addCatalogItemToDraft = (itemId: string) => {
    const cat = catalog.find((c) => c.id === itemId);
    if (!cat) return;
    setSelectedItems((prev) => {
      const existing = prev.find((p) => p.catalogItemId === itemId);
      if (existing) {
        const nextQty = existing.quantity + 1;
        const tier = nextQty >= cat.minWholesaleQty ? 'wholesale' : 'retail';
        const price = tier === 'wholesale' ? cat.wholesalePrice : cat.retailPrice;
        return prev.map((p) =>
          p.catalogItemId === itemId
            ? { ...p, quantity: nextQty, unitPrice: price, appliedTier: tier, lineTotal: nextQty * price }
            : p
        );
      }
      const tier = 1 >= cat.minWholesaleQty ? 'wholesale' : 'retail';
      const price = tier === 'wholesale' ? cat.wholesalePrice : cat.retailPrice;
      return [
        ...prev,
        {
          catalogItemId: cat.id,
          name: cat.name,
          unit: cat.unit,
          quantity: 1,
          unitPrice: price,
          appliedTier: tier,
          lineTotal: price,
        },
      ];
    });
  };

  const updateDraftQty = (catalogItemId: string, qty: number) => {
    const cat = catalog.find((c) => c.id === catalogItemId);
    const cleanQty = Math.max(1, qty);
    setSelectedItems((prev) =>
      prev.map((row) => {
        if (row.catalogItemId !== catalogItemId) return row;
        const tier = cat && cleanQty >= cat.minWholesaleQty ? 'wholesale' : 'retail';
        const price = cat
          ? tier === 'wholesale'
            ? cat.wholesalePrice
            : cat.retailPrice
          : row.unitPrice;
        return {
          ...row,
          quantity: cleanQty,
          unitPrice: price,
          appliedTier: tier,
          lineTotal: cleanQty * price,
        };
      })
    );
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || selectedItems.length === 0) return;

    const allWholesale = selectedItems.every((i) => i.appliedTier === 'wholesale');
    const allRetail = selectedItems.every((i) => i.appliedTier === 'retail');
    const pricingTierApplied = allWholesale ? 'wholesale' : allRetail ? 'retail' : 'mixed';

    setSaving(true);
    const res = await createSupplierOrder({
      orderSource: 'external_manual',
      externalBuyer: {
        name: buyerName.trim(),
        phone: buyerPhone.trim(),
        country: profile.country || 'مصر',
        governorate: buyerGov.trim(),
      },
      items: selectedItems,
      pricingTierApplied,
      subtotal,
      discount: Number(discount || 0),
      shippingFee: Number(shippingFee || 0),
      finalTotal,
      paidAmount: Number(paidAmount || 0),
      supplierTreasuryId: supplierTreasuryId || treasuries[0]?.id || null,
      status: 'confirmed',
      notes: notes.trim(),
    });
    setSaving(false);

    if (res.success) {
      setIsModalOpen(false);
      setBuyerName('');
      setBuyerPhone('');
      setBuyerGov('');
      setSelectedItems([]);
      setDiscount(0);
      setShippingFee(0);
      setPaidAmount(0);
      setNotes('');
      await loadAll();
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: B2BSupplyOrder['status']) => {
    const res = await updateSupplierOrderStatus(orderId, nextStatus);
    if (res.success && res.order) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order! : o)));
    }
  };

  const handleCollectRemaining = async (ord: B2BSupplyOrder) => {
    const res = await updateSupplierOrderStatus(
      ord.id,
      ord.status,
      ord.finalTotal,
      treasuries[0]?.id
    );
    if (res.success && res.order) {
      await loadAll();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5 text-right" dir="rtl">
      {/* Header with Back & Close */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Package className="w-4 h-4 text-[#EA580C]" />
              <span>أوردراتي وطلبات التوريد</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              إدارة الطلبات من متجرك، سوق الموردين، والطلبات الخارجية المباشرة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل أوردر خارجي</span>
          </button>
          <button
            type="button"
            onClick={onGoHome}
            aria-label="إغلاق"
            title="إغلاق"
            className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4-Way Source Filter & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all' as const, label: `الكل (${orders.length})` },
            { id: 'direct_supplier_store' as const, label: 'متجري' },
            { id: 'suppliers_market' as const, label: 'موردين الشمساوية' },
            { id: 'external_manual' as const, label: 'خارج المنظومة' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition ${
                sourceFilter === tab.id
                  ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                  : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] text-xs font-bold outline-none"
          >
            <option value="all">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الأوردر أو اسم العميل..."
              className="w-full px-3 py-2 pr-8 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] text-xs font-bold outline-none"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          جاري تحميل الأوردرات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center space-y-2">
          <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">لا توجد طلبات حالياً</p>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
            يمكنك تسجيل أوردر خارجي مباشرة وسيتم خصم المخزون وتحصيل القيمة في خزينتك آلياً.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ord) => (
            <div
              key={ord.id}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-black text-[#C2410C] dark:text-amber-300">
                    #{ord.orderNumber}
                  </span>
                  <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    {ord.externalBuyer?.name || 'ورشة / عميل'}
                  </span>
                  {ord.externalBuyer?.phone && (
                    <span className="font-mono text-[#475569] dark:text-[#94A3B8]">
                      ({ord.externalBuyer.phone})
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                    • {SOURCE_LABELS[ord.orderSource]}
                  </span>
                </div>

                <div className="text-xs text-[#334155] dark:text-[#CBD5E1]">
                  {ord.items.map((it) => `${it.name} (${it.quantity} ${it.unit})`).join(' + ')}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="text-left font-mono tabular-nums text-xs">
                  <div className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    الإجمالي: {Number(ord.finalTotal).toLocaleString()} {currencySymbol}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    المدفوع: {Number(ord.paidAmount).toLocaleString()} {currencySymbol}
                    {Number(ord.remainingAmount) > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 mr-2">
                        (متبقي {Number(ord.remainingAmount).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                {Number(ord.remainingAmount) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleCollectRemaining(ord)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تحصيل المتبقي</span>
                  </button>
                )}

                <select
                  value={ord.status}
                  onChange={(e) => handleStatusChange(ord.id, e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] text-xs font-black outline-none"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Manual External Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>رجوع</span>
              </button>
              <h3 className="text-sm font-black">تسجيل أوردر خارجي مباشر</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualOrder} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">اسم العميل / الورشة *</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المحافظة</label>
                  <input
                    type="text"
                    value={buyerGov}
                    onChange={(e) => setBuyerGov(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">إضافة خامة من الكتالوج</label>
                <select
                  value=""
                  onChange={(e) => addCatalogItemToDraft(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                >
                  <option value="">-- اختر خامة لإضافتها للأوردر --</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — قطاعي: {c.retailPrice} / جملة: {c.wholesalePrice} (من {c.minWholesaleQty}{' '}
                      {c.unit})
                    </option>
                  ))}
                </select>
              </div>

              {selectedItems.length > 0 && (
                <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                  {selectedItems.map((it) => (
                    <div key={it.catalogItemId} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-black truncate">{it.name}</div>
                        <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                          سعر {it.appliedTier === 'wholesale' ? 'الجملة' : 'القطاعي'}: {it.unitPrice}{' '}
                          {currencySymbol} / {it.unit}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateDraftQty(it.catalogItemId, Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold text-center"
                      />
                      <div className="font-mono font-black w-24 text-left">
                        {it.lineTotal.toLocaleString()} {currencySymbol}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedItems((prev) =>
                            prev.filter((p) => p.catalogItemId !== it.catalogItemId)
                          )
                        }
                        className="text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">خصم</label>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">مصاريف شحن</label>
                  <input
                    type="number"
                    min={0}
                    value={shippingFee}
                    onChange={(e) => setShippingFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المدفوع الآن</label>
                  <input
                    type="number"
                    min={0}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">الخزينة المستلمة</label>
                  <select
                    value={supplierTreasuryId}
                    onChange={(e) => setSupplierTreasuryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  >
                    {treasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-between font-black">
                <span>الصافي النهائي للأوردر:</span>
                <span className="font-mono text-sm text-[#C2410C] dark:text-amber-300">
                  {finalTotal.toLocaleString()} {currencySymbol}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D4CCBC] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving || selectedItems.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'جاري التسجيل...' : 'تأكيد وحفظ الأوردر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
