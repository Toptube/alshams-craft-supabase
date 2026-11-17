import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../../types';
import { SupplierCustomer } from '../../types/supplier';
import {
  calculateFractionalLineTotal,
  PosPaymentMethod,
  PosSalesChannel,
  round2,
  round3,
  SupplierBranch,
  SupplierBranchInventoryItem,
  SupplierBranchTreasury,
  SupplierCategoryNode,
  SupplierPosOrder,
  SupplierPosShift,
} from '../../types/supplierErp';
import { fetchSupplierCustomers } from '../../db/supplierService';
import {
  closePosShift,
  createPosOrder,
  fetchBranchInventory,
  fetchBranchShifts,
  fetchErpCategories,
  fetchPosOrders,
  fetchSupplierErpOverview,
  openPosShift,
  submitBranchTreasuryTransfer,
} from '../../db/supplierErpService';
import { playErrorSound, playSuccessSound } from '../../lib/sounds';
import {
  ArrowRight,
  Building2,
  Clock,
  Printer,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';

interface SupplierPosViewProps {
  profile: UserProfile;
  initialBranchId?: string;
  isKioskLocked?: boolean;
  lockedBranchId?: string;
  kioskStaffName?: string;
  onGoBack: () => void;
  onGoHome: () => void;
}

interface CartLine {
  inventoryId: string;
  itemId: string;
  skuCode: string;
  itemName: string;
  saleUnit: string;
  availableQty: number;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export const SupplierPosView: React.FC<SupplierPosViewProps> = ({
  profile,
  initialBranchId,
  isKioskLocked = false,
  lockedBranchId,
  kioskStaffName,
  onGoBack,
  onGoHome,
}) => {
  const currency = profile.currencySymbol || 'ج.م';

  const [branches, setBranches] = useState<SupplierBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(lockedBranchId || initialBranchId || '');
  const [categories, setCategories] = useState<SupplierCategoryNode[]>([]);
  const [inventory, setInventory] = useState<SupplierBranchInventoryItem[]>([]);
  const [shifts, setShifts] = useState<SupplierPosShift[]>([]);
  const [branchTreasury, setBranchTreasury] = useState<SupplierBranchTreasury | null>(null);
  const [recentOrders, setRecentOrders] = useState<SupplierPosOrder[]>([]);
  const [customers, setCustomers] = useState<SupplierCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (Zero-Image Text + Auto SKU + Main/Sub Categories)
  const [searchQuery, setSearchQuery] = useState('');
  const [mainCatFilter, setMainCatFilter] = useState<string>('all');
  const [subCatFilter, setSubCatFilter] = useState<string>('all');

  // Cart & Fractional Qty State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [priceTier, setPriceTier] = useState<'retail' | 'wholesale'>('retail');
  const [discount, setDiscount] = useState(0);

  // Customer & Channel State
  const [salesChannel, setSalesChannel] = useState<PosSalesChannel>('branch_walkin');
  const [customerLookup, setCustomerLookup] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('عميل نقدي');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryGovernorate, setDeliveryGovernorate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [matchedCustomerStats, setMatchedCustomerStats] = useState<SupplierCustomer | null>(null);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isCustomPaid, setIsCustomPaid] = useState(false);

  // Shift & Receipt Modals
  const [openingCashInput, setOpeningCashInput] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [printOrder, setPrintOrder] = useState<SupplierPosOrder | null>(null);

  const loadAll = async (branchOverride?: string) => {
    setLoading(true);
    const [ov, cats, custs] = await Promise.all([
      fetchSupplierErpOverview(),
      fetchErpCategories(),
      fetchSupplierCustomers(),
    ]);
    const shops = (ov?.branches || []).filter((b) => b.branchType === 'shop');
    setBranches(shops);
    setCategories(cats);
    setCustomers(custs);

    const activeB = lockedBranchId || branchOverride || selectedBranchId || shops[0]?.id || '';
    if (activeB && activeB !== selectedBranchId) setSelectedBranchId(activeB);

    if (activeB) {
      const [inv, sh, ords] = await Promise.all([
        fetchBranchInventory(activeB),
        fetchBranchShifts(activeB),
        fetchPosOrders(activeB),
      ]);
      setInventory(inv);
      setShifts(sh);
      setRecentOrders(ords);
      setBranchTreasury(ov?.branchTreasuries.find((bt) => bt.branchId === activeB) || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll(lockedBranchId || initialBranchId);
  }, [lockedBranchId, initialBranchId]);

  const handleBranchSwitch = (bId: string) => {
    if (isKioskLocked && lockedBranchId) return;
    setSelectedBranchId(bId);
    setCart([]);
    loadAll(bId);
  };

  const activeShift = useMemo(
    () => shifts.find((s) => s.branchId === selectedBranchId && s.status === 'open') || null,
    [shifts, selectedBranchId]
  );

  const mainCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const subCategories = useMemo(
    () => categories.filter((c) => c.parentId && (mainCatFilter === 'all' || c.parentId === mainCatFilter)),
    [categories, mainCatFilter]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.filter((it) => {
      if (mainCatFilter !== 'all' && it.categoryId !== mainCatFilter) return false;
      if (subCatFilter !== 'all' && it.subCategoryId !== subCatFilter) return false;
      if (q) {
        const hay = `${it.itemName} ${it.skuCode} ${it.saleUnit}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inventory, mainCatFilter, subCatFilter, searchQuery]);

  // Customer auto-lookup matches by phone or name
  const customerSuggestions = useMemo(() => {
    const q = customerLookup.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [customers, customerLookup]);

  const handlePickCustomer = (c: SupplierCustomer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setDeliveryGovernorate(c.governorate || '');
    setDeliveryAddress(c.lastAddress || '');
    setMatchedCustomerStats(c);
    setCustomerLookup('');
  };

  const handleAddToCart = (item: SupplierBranchInventoryItem) => {
    const unitPrice = priceTier === 'wholesale' && item.wholesalePrice > 0 ? item.wholesalePrice : item.retailPrice;
    setCart((prev) => {
      const existing = prev.find((l) => l.inventoryId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.inventoryId === item.id ? { ...l, quantity: round3(l.quantity + 1) } : l
        );
      }
      return [
        ...prev,
        {
          inventoryId: item.id,
          itemId: item.itemId,
          skuCode: item.skuCode,
          itemName: item.itemName,
          saleUnit: item.saleUnit,
          availableQty: item.quantity,
          quantity: 1,
          unitPrice,
          unitCost: item.avgCost,
        },
      ];
    });
  };

  const subtotal = useMemo(
    () => round2(cart.reduce((sum, l) => sum + calculateFractionalLineTotal(l.quantity, l.unitPrice), 0)),
    [cart]
  );
  const effectiveShipping = salesChannel === 'online' ? round2(shippingFee) : 0;
  const finalTotal = useMemo(
    () => round2(Math.max(0, subtotal - round2(discount) + effectiveShipping)),
    [subtotal, discount, effectiveShipping]
  );

  useEffect(() => {
    if (!isCustomPaid) {
      setPaidAmount(paymentMethod === 'credit' ? 0 : finalTotal);
    }
  }, [finalTotal, paymentMethod, isCustomPaid]);

  const remainingAmount = round2(Math.max(0, finalTotal - (paymentMethod === 'credit' ? 0 : Number(paidAmount || 0))));

  const showMsg = (text: string, isError = false) => {
    setNotice({ text, isError });
    if (isError) playErrorSound();
    else playSuccessSound();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleOpenShift = async () => {
    if (!selectedBranchId) return;
    const res = await openPosShift(selectedBranchId, openingCashInput);
    if (res.success) {
      await loadAll(selectedBranchId);
      showMsg('تم فتح الوردية بنجاح وتسجيل الموظف.');
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    const res = await closePosShift(activeShift.id);
    if (res.success) {
      await loadAll(selectedBranchId);
      showMsg('تم تقفيل الوردية وترحيل مبالغ الكاش وإنستا باي والمحفظة إلى خزينة الفرع.');
    }
  };

  const handleSettleBranchToOwner = async () => {
    if (!selectedBranchId) return;
    const res = await submitBranchTreasuryTransfer({ branchId: selectedBranchId });
    if (res.success) {
      await loadAll(selectedBranchId);
      showMsg('تم إرسال توريد خزينة الفرع بنجاح وبانتظار تأكيد الاستلام من المالك.');
    } else {
      showMsg(res.error || 'لا يوجد رصيد متاح للتوريد', true);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || cart.length === 0) return;
    setSubmitting(true);
    const res = await createPosOrder({
      branchId: selectedBranchId,
      shiftId: activeShift?.id,
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim() || 'عميل نقدي',
      customerPhone: customerPhone.trim(),
      salesChannel,
      deliveryGovernorate: salesChannel === 'online' ? deliveryGovernorate.trim() : '',
      deliveryAddress: salesChannel === 'online' ? deliveryAddress.trim() : '',
      shippingFee: effectiveShipping,
      items: cart.map((l) => ({
        inventoryId: l.inventoryId,
        itemId: l.itemId,
        skuCode: l.skuCode,
        itemName: l.itemName,
        saleUnit: l.saleUnit,
        quantity: round3(l.quantity),
        unitPrice: round2(l.unitPrice),
        unitCost: round2(l.unitCost),
      })),
      discount: round2(discount),
      paidAmount: paymentMethod === 'credit' ? 0 : round2(paidAmount),
      paymentMethod,
    });
    setSubmitting(false);

    if (res.success && res.order) {
      setPrintOrder(res.order);
      setCart([]);
      setDiscount(0);
      setShippingFee(0);
      setIsCustomPaid(false);
      setSelectedCustomerId('');
      setMatchedCustomerStats(null);
      setCustomerName('عميل نقدي');
      setCustomerPhone('');
      await loadAll(selectedBranchId);
      showMsg(`تم إصدار الفاتورة #${res.order.orderNumber} وخصم المخزون بدقة.`);
    } else {
      showMsg(res.error || 'تعذر إتمام الفاتورة', true);
    }
  };

  const btCash = Number(branchTreasury?.cashBalance || 0);
  const btInsta = Number(branchTreasury?.instapayBalance || 0);
  const btWallet = Number(branchTreasury?.walletBalance || 0);
  const btTotal = round2(btCash + btInsta + btWallet);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4 text-right" dir="rtl">
      {/* Top POS Bar */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {!isKioskLocked && (
            <button
              type="button"
              onClick={onGoBack}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-[#EA580C]" />
              <span>رجوع</span>
            </button>
          )}
          <div>
            <h1 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#EA580C]" />
              <span>كاشير نقاط البيع (POS) — بدون صور لسرعة الأداء</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              الموظف المسؤول: <strong>{kioskStaffName || profile.artistName}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#EA580C]" />
            <select
              value={selectedBranchId}
              disabled={isKioskLocked}
              onChange={(e) => handleBranchSwitch(e.target.value)}
              className="h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black disabled:opacity-75"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {!isKioskLocked && (
            <button
              type="button"
              onClick={onGoHome}
              aria-label="إغلاق"
              className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Shift & Branch Treasury Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 flex flex-wrap items-center justify-between gap-3">
          {activeShift ? (
            <>
              <div className="space-y-0.5">
                <div className="text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>وردية مفتوحة — {activeShift.staffName}</span>
                </div>
                <p className="text-[11px] font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]">
                  فواتير: {activeShift.ordersCount} · كاش: {activeShift.cashTotal.toLocaleString('ar-EG')} · إنستا باي:{' '}
                  {activeShift.instapayTotal.toLocaleString('ar-EG')} · محفظة:{' '}
                  {activeShift.walletTotal.toLocaleString('ar-EG')} · آجل:{' '}
                  {activeShift.deferredTotal.toLocaleString('ar-EG')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseShift}
                className="px-3.5 py-2 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] text-white text-xs font-black cursor-pointer"
              >
                تقفيل الوردية وترحيلها لخزينة الفرع
              </button>
            </>
          ) : (
            <>
              <div className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                لا توجد وردية مفتوحة حالياً (سيتم فتح وردية تلقائياً عند أول فاتورة أو افتحها يدوياً بالعهدة الافتتاحية):
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(Number(e.target.value || 0))}
                  placeholder="عهدة افتتاحية"
                  className="w-28 h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleOpenShift}
                  className="px-3.5 h-9 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer"
                >
                  فتح وردية الآن
                </button>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>خزينة الفرع الجاهزة للتوريد:</span>
            </div>
            <p className="text-xs font-black font-mono tabular-nums">
              {btTotal.toLocaleString('ar-EG')} {currency}{' '}
              <span className="text-[10px] font-normal text-[#475569]">
                (كاش {btCash} · إنستا {btInsta} · محفظة {btWallet})
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={btTotal <= 0}
            onClick={handleSettleBranchToOwner}
            className="px-3 py-2 rounded-xl bg-[#EA580C] disabled:opacity-40 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>توريد للمالك</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl p-3 text-xs font-black border ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Main Split Grid: Left = Zero-Image Searchable Items Grid, Right = Active Cart + Customer + Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Catalog Items Lookup (Strictly Zero Images!) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الكود SKU..."
                className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                value={mainCatFilter}
                onChange={(e) => {
                  setMainCatFilter(e.target.value);
                  setSubCatFilter('all');
                }}
                className="w-full h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كل التصنيفات الرئيسية</option>
                {mainCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <select
                value={subCatFilter}
                onChange={(e) => setSubCatFilter(e.target.value)}
                className="w-full h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كل الفرعية</option>
                {subCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#475569] dark:text-[#94A3B8]">
              الأصناف المتاحة بالفرع ({filteredItems.length})
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPriceTier('retail')}
                className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                  priceTier === 'retail' ? 'bg-[#0C1427] text-white' : 'bg-[#EFE9DC] dark:bg-[#132040]'
                }`}
              >
                سعر القطاعي
              </button>
              <button
                type="button"
                onClick={() => setPriceTier('wholesale')}
                className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                  priceTier === 'wholesale' ? 'bg-[#EA580C] text-white' : 'bg-[#EFE9DC] dark:bg-[#132040]'
                }`}
              >
                سعر الجملة
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-[#475569]">جاري تحميل مخزن الفرع...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#475569]">
              لا توجد أصناف في مخزن هذا الفرع حالياً. أضف أصنافاً من شاشة المخازن أو حوّل كمية من المخزن المركزي.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-0.5">
              {filteredItems.map((it) => {
                const displayPrice =
                  priceTier === 'wholesale' && it.wholesalePrice > 0 ? it.wholesalePrice : it.retailPrice;
                const low = it.quantity <= it.minAlert;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleAddToCart(it)}
                    className="text-right rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] p-3 transition flex flex-col justify-between gap-2 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold text-[#C2410C] dark:text-amber-300">
                          {it.skuCode}
                        </span>
                        <h3 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                          {it.itemName}
                        </h3>
                      </div>
                      <span className="font-mono tabular-nums text-xs font-black text-[#0C1427] dark:text-amber-300 shrink-0">
                        {displayPrice.toLocaleString('ar-EG')} {currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className={low ? 'text-rose-600 font-black' : 'text-[#475569] dark:text-[#94A3B8]'}>
                        رصيد: {it.quantity} {it.saleUnit}
                      </span>
                      <span className="text-[10px] font-sans font-black text-[#EA580C]">+ إضافة للفاتورة</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Checkout & Invoice Panel */}
        <form
          onSubmit={handleCheckout}
          className="lg:col-span-5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3.5"
        >
          {/* Customer Lookup & Channel */}
          <div className="space-y-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#EA580C]" />
                <span>بيانات العميل وقناة البيع</span>
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSalesChannel('branch_walkin')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                    salesChannel === 'branch_walkin'
                      ? 'bg-[#0C1427] text-white'
                      : 'bg-[#EFE9DC] dark:bg-[#132040]'
                  }`}
                >
                  عميل فرع
                </button>
                <button
                  type="button"
                  onClick={() => setSalesChannel('online')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer ${
                    salesChannel === 'online'
                      ? 'bg-[#EA580C] text-white'
                      : 'bg-[#EFE9DC] dark:bg-[#132040]'
                  }`}
                >
                  <Truck className="w-3 h-3" />
                  <span>أونلاين</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={customerLookup}
                onChange={(e) => setCustomerLookup(e.target.value)}
                placeholder="ابحث عن عميل مسجل بالاسم أو الهاتف..."
                className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              {customerSuggestions.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#EA580C] shadow-lg divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                  {customerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handlePickCustomer(c)}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-[#EFE9DC] dark:hover:bg-[#132040] flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-black">
                        {c.name} <span className="font-mono text-[10px]">({c.phone})</span>
                      </span>
                      <span className="text-[10px] font-mono text-rose-600">
                        آجل: {Number(c.balanceDue || 0)} {currency}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {matchedCustomerStats && (
              <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] px-3 py-1.5 text-[10px] font-bold flex flex-wrap justify-between gap-2">
                <span>
                  سابقاً: {matchedCustomerStats.walkinOrdersCount || 0} فرع ·{' '}
                  {matchedCustomerStats.onlineOrdersCount || 0} أونلاين
                </span>
                <span className="font-mono text-rose-600">
                  رصيد آجل سابق: {Number(matchedCustomerStats.balanceDue || 0).toLocaleString('ar-EG')} {currency}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسم العميل"
                className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono"
              />
            </div>

            {salesChannel === 'online' && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <input
                  type="text"
                  required
                  value={deliveryGovernorate}
                  onChange={(e) => setDeliveryGovernorate(e.target.value)}
                  placeholder="المحافظة"
                  className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 text-xs font-bold"
                />
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="العنوان بالتفصيل"
                  className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 text-xs font-bold"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(Number(e.target.value || 0))}
                  placeholder="مصاريف الشحن"
                  className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#EA580C]/40 text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Cart Items (Decimal Fractional Quantity Support e.g. 2.4 كجم) */}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-center py-6 text-xs text-[#475569]">اضغط على أي صنف للإضافة للفاتورة (يدعم الكسور مثل 2.4 كجم)</p>
            ) : (
              cart.map((line) => {
                const lineTotal = calculateFractionalLineTotal(line.quantity, line.unitPrice);
                return (
                  <div
                    key={line.inventoryId}
                    className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] p-2.5 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black truncate">{line.itemName}</span>
                      <button
                        type="button"
                        onClick={() => setCart((p) => p.filter((x) => x.inventoryId !== line.inventoryId))}
                        className="text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 items-center font-mono tabular-nums">
                      <div>
                        <span className="block text-[9px] font-sans text-[#475569]">الكمية ({line.saleUnit})</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={line.quantity}
                          onChange={(e) => {
                            const val = Math.max(0.001, Number(e.target.value || 0));
                            setCart((p) =>
                              p.map((x) => (x.inventoryId === line.inventoryId ? { ...x, quantity: val } : x))
                            );
                          }}
                          className="w-full h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] font-sans text-[#475569]">السعر</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value || 0));
                            setCart((p) =>
                              p.map((x) => (x.inventoryId === line.inventoryId ? { ...x, unitPrice: val } : x))
                            );
                          }}
                          className="w-full h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
                        />
                      </div>
                      <div className="text-left">
                        <span className="block text-[9px] font-sans text-[#475569]">الإجمالي</span>
                        <span className="font-black text-[#C2410C] dark:text-amber-300">
                          {lineTotal.toLocaleString('ar-EG')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Totals + Payment Channels */}
          <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-[#475569]">خصم إضافي ({currency})</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value || 0))}
                  className="w-full h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono"
                />
              </div>
              <div className="rounded-xl bg-[#0C1427] text-white p-2 flex flex-col justify-center">
                <span className="text-[10px] text-amber-300 font-bold">الصافي المستحق</span>
                <span className="text-base font-black font-mono tabular-nums">
                  {finalTotal.toLocaleString('ar-EG')} {currency}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'cash', label: 'كاش' },
                  { id: 'instapay', label: 'إنستا باي' },
                  { id: 'wallet', label: 'محفظة' },
                  { id: 'credit', label: 'آجل بالكامل' },
                ] as const
              ).map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(pm.id);
                    if (pm.id === 'credit') {
                      setIsCustomPaid(false);
                      setPaidAmount(0);
                    }
                  }}
                  className={`py-2 rounded-xl text-[11px] font-black border cursor-pointer ${
                    paymentMethod === pm.id
                      ? 'bg-[#EA580C] text-white border-[#EA580C]'
                      : 'bg-[#EFE9DC] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>

            {paymentMethod !== 'credit' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#475569]">المبلغ المدفوع الآن</label>
                  <input
                    type="number"
                    min={0}
                    max={finalTotal}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => {
                      setIsCustomPaid(true);
                      setPaidAmount(Number(e.target.value || 0));
                    }}
                    className="w-full h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black"
                  />
                </div>
                <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] p-2 flex flex-col justify-center font-mono tabular-nums">
                  <span className="text-[10px] font-sans font-bold text-[#475569]">المتبقي آجل على العميل</span>
                  <span className={remainingAmount > 0 ? 'font-black text-rose-600' : 'font-black text-emerald-600'}>
                    {remainingAmount.toLocaleString('ar-EG')} {currency}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="w-full py-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-45 text-white text-xs sm:text-sm font-black cursor-pointer shadow-sm"
            >
              {submitting ? 'جاري إصدار الفاتورة...' : 'اعتماد وطباعة الفاتورة'}
            </button>
          </div>
        </form>
      </div>

      {/* Recent Branch POS Orders */}
      {recentOrders.length > 0 && (
        <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5">
          <h2 className="text-xs sm:text-sm font-black">آخر فواتير الفرع ({recentOrders.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
                <tr>
                  <th className="p-2.5 font-black">رقم الفاتورة</th>
                  <th className="p-2.5 font-black">العميل والقناة</th>
                  <th className="p-2.5 font-black">الكاشير</th>
                  <th className="p-2.5 font-black">الإجمالي</th>
                  <th className="p-2.5 font-black">المدفوع / الآجل</th>
                  <th className="p-2.5 font-black">طباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                {recentOrders.slice(0, 12).map((o) => (
                  <tr key={o.id}>
                    <td className="p-2.5 font-mono font-black">{o.orderNumber}</td>
                    <td className="p-2.5">
                      <span className="font-black">{o.customerName}</span>{' '}
                      <span className="text-[10px] text-[#475569]">
                        ({o.salesChannel === 'online' ? 'أونلاين' : 'فرع'})
                      </span>
                    </td>
                    <td className="p-2.5 text-[11px]">{o.staffName}</td>
                    <td className="p-2.5 font-mono tabular-nums font-black">
                      {o.finalTotal.toLocaleString('ar-EG')} {currency}
                    </td>
                    <td className="p-2.5 font-mono tabular-nums text-[11px]">
                      <span className="text-emerald-700">{o.paidAmount}</span>
                      {o.remainingAmount > 0 && <span className="text-rose-600"> / آجل {o.remainingAmount}</span>}
                    </td>
                    <td className="p-2.5">
                      <button
                        type="button"
                        onClick={() => setPrintOrder(o)}
                        className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#EA580C]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Printable Receipt Modal (80mm Thermal & Standard A4) */}
      {printOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 print:static print:bg-white print:p-0" dir="rtl">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #pos-printable-receipt, #pos-printable-receipt * { visibility: visible !important; }
              #pos-printable-receipt {
                position: fixed !important;
                top: 0 !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                width: 78mm !important;
                max-width: 78mm !important;
                padding: 3mm !important;
                margin: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }
              .no-print { display: none !important; }
            }
          `}</style>
          <div
            id="pos-printable-receipt"
            className="w-full max-w-[320px] rounded-2xl bg-white text-[#0C1427] p-4 space-y-2.5 shadow-2xl border border-dashed border-stone-300"
          >
            <div className="flex items-start justify-between border-b border-dashed border-stone-400 pb-2">
              <div className="text-center flex-1">
                <h3 className="text-sm font-black">{profile.brandName}</h3>
                <p className="text-[10px] font-bold text-stone-600">
                  {branches.find((b) => b.id === printOrder.branchId)?.name || 'الفرع الرئيسي'}
                </p>
                <p className="text-[11px] font-mono tabular-nums font-bold mt-0.5">
                  إيصال #{printOrder.orderNumber}
                </p>
                <p className="text-[10px] font-mono tabular-nums text-stone-500">
                  {printOrder.createdAt ? new Date(printOrder.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG')}
                </p>
              </div>
              <button type="button" onClick={() => setPrintOrder(null)} className="no-print p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] space-y-0.5 border-b border-dashed border-stone-300 pb-2">
              <p>العميل: <strong>{printOrder.customerName}</strong> {printOrder.customerPhone ? `(${printOrder.customerPhone})` : ''}</p>
              <p>القناة: {printOrder.salesChannel === 'online' ? `أونلاين · ${printOrder.deliveryGovernorate} - ${printOrder.deliveryAddress}` : 'بيع مباشر بالفرع'}</p>
              <p>الكاشير: {printOrder.staffName}</p>
            </div>
            <div className="border-b border-dashed border-stone-300 pb-2 space-y-1 text-[11px]">
              <div className="flex justify-between font-black text-[10px] text-stone-600 border-b border-stone-200 pb-1">
                <span>الصنف × الكمية</span>
                <span>الإجمالي</span>
              </div>
              {printOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start gap-2 font-mono tabular-nums">
                  <span className="font-sans leading-snug">
                    {it.itemName}
                    <span className="block text-[10px] font-mono text-stone-600">
                      [{it.skuCode}] {it.quantity} {it.saleUnit} × {it.unitPrice}
                    </span>
                  </span>
                  <span className="font-black shrink-0">{it.lineTotal} {currency}</span>
                </div>
              ))}
            </div>
            <div className="text-xs space-y-1 font-mono tabular-nums">
              {printOrder.shippingFee > 0 && <div className="flex justify-between"><span>الشحن:</span><span>{printOrder.shippingFee} {currency}</span></div>}
              {printOrder.discount > 0 && <div className="flex justify-between"><span>الخصم:</span><span>-{printOrder.discount} {currency}</span></div>}
              <div className="flex justify-between text-sm font-black border-t border-dashed border-stone-400 pt-1">
                <span>الإجمالي:</span>
                <span>{printOrder.finalTotal} {currency}</span>
              </div>
              <div className="flex justify-between"><span>المدفوع:</span><span>{printOrder.paidAmount} {currency}</span></div>
              {printOrder.remainingAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-black">
                  <span>المتبقي آجل:</span>
                  <span>{printOrder.remainingAmount} {currency}</span>
                </div>
              )}
            </div>
            <div className="text-center text-[10px] text-stone-500 pt-1 border-t border-dashed border-stone-300">
              شكراً لتعاملكم مع {profile.brandName} · منظومة الشمساوية
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print w-full py-2.5 rounded-xl bg-[#0C1427] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة إيصال حراري 80mm</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
