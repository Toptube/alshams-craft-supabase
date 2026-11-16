import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../../types';
import {
  COMMON_PURCHASE_UNITS,
  COMMON_SALE_UNITS,
  convertPurchaseToSaleQty,
  generateAutoSku,
  PurchaseLineInput,
  round2,
  SupplierBranch,
  SupplierBranchInventoryItem,
  SupplierCategoryNode,
  SupplierPurchaseInvoice,
  SupplierStockMovement,
  SupplierVendor,
} from '../../types/supplierErp';
import {
  createErpPurchaseInvoice,
  deleteErpCategory,
  fetchBranchInventory,
  fetchErpCategories,
  fetchErpPurchases,
  fetchErpVendors,
  fetchItemHistoryCard,
  fetchSupplierErpOverview,
  saveErpCategory,
  saveErpVendor,
  transferWarehouseStock,
  upsertBranchInventoryItem,
} from '../../db/supplierErpService';
import { playErrorSound, playSuccessSound } from '../../lib/sounds';
import {
  ArrowLeftRight,
  ArrowRight,
  Factory,
  History,
  Layers,
  Plus,
  Search,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';

interface SupplierBranchesWarehouseViewProps {
  profile: UserProfile;
  initialBranchId?: string;
  isKioskLocked?: boolean;
  lockedBranchId?: string;
  onGoBack: () => void;
  onGoHome: () => void;
}

export const SupplierBranchesWarehouseView: React.FC<SupplierBranchesWarehouseViewProps> = ({
  profile,
  initialBranchId,
  isKioskLocked = false,
  lockedBranchId,
  onGoBack,
  onGoHome,
}) => {
  const currency = profile.currencySymbol || 'ج.م';
  const [tab, setTab] = useState<'stock' | 'transfers' | 'categories' | 'vendors'>('stock');

  const [branches, setBranches] = useState<SupplierBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(lockedBranchId || initialBranchId || 'all');
  const [categories, setCategories] = useState<SupplierCategoryNode[]>([]);
  const [inventory, setInventory] = useState<SupplierBranchInventoryItem[]>([]);
  const [vendors, setVendors] = useState<SupplierVendor[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Add/Edit Zero-Image Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemBranchId, setItemBranchId] = useState('');
  const [itemSku, setItemSku] = useState(() => generateAutoSku('MAT'));
  const [itemName, setItemName] = useState('');
  const [itemCatId, setItemCatId] = useState('');
  const [itemSubCatId, setItemSubCatId] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('طرد');
  const [saleUnit, setSaleUnit] = useState('كيلو');
  const [conversionFactor, setConversionFactor] = useState(25);
  const [purchasePackages, setPurchasePackages] = useState(1);
  const [packageCost, setPackageCost] = useState(0);
  const [retailPrice, setRetailPrice] = useState(0);
  const [wholesalePrice, setWholesalePrice] = useState(0);

  // Category Form
  const [catName, setCatName] = useState('');
  const [catParentId, setCatParentId] = useState('');

  // Stock Transfer Form
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [transferItemId, setTransferItemId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferNotes, setTransferNotes] = useState('');

  // Item History Card Modal (كارت الصنف)
  const [cardItem, setCardItem] = useState<SupplierBranchInventoryItem | null>(null);
  const [cardMovements, setCardMovements] = useState<SupplierStockMovement[]>([]);
  const [loadingCard, setLoadingCard] = useState(false);

  // Vendor & Purchase Invoice
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorType, setVendorType] = useState('مصنع خامات');
  const [purBranchId, setPurBranchId] = useState('');
  const [purVendorId, setPurVendorId] = useState('');
  const [purPaid, setPurPaid] = useState(0);
  const [purChannel, setPurChannel] = useState<'cash' | 'instapay' | 'wallet' | 'credit'>('cash');
  const [purLines, setPurLines] = useState<PurchaseLineInput[]>([
    {
      itemName: '',
      purchaseUnit: 'طرد',
      saleUnit: 'كيلو',
      conversionFactor: 25,
      purchaseQty: 1,
      packageCost: 0,
      retailPrice: 0,
      wholesalePrice: 0,
    },
  ]);

  const loadAll = async () => {
    setLoading(true);
    const [ov, cats, inv, vends, purs] = await Promise.all([
      fetchSupplierErpOverview(),
      fetchErpCategories(),
      fetchBranchInventory(lockedBranchId || (selectedBranchId !== 'all' ? selectedBranchId : undefined)),
      fetchErpVendors(),
      fetchErpPurchases(),
    ]);
    const allBr = ov?.branches || [];
    setBranches(allBr);
    setCategories(cats);
    setInventory(inv);
    setVendors(vends);
    setPurchases(purs);

    if (allBr.length > 0) {
      const cw = allBr.find((b) => b.branchType === 'central_warehouse') || allBr[0];
      const shop = allBr.find((b) => b.branchType === 'shop') || allBr[0];
      setItemBranchId((p) => p || cw.id);
      setPurBranchId((p) => p || cw.id);
      setFromBranchId((p) => p || cw.id);
      setToBranchId((p) => p || (shop.id !== cw.id ? shop.id : allBr[1]?.id || ''));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [selectedBranchId, lockedBranchId]);

  const showMsg = (text: string, isError = false) => {
    setNotice({ text, isError });
    if (isError) playErrorSound();
    else playSuccessSound();
    setTimeout(() => setNotice(null), 5000);
  };

  const mainCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const getSubCats = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((it) => {
      if (!q) return true;
      return `${it.itemName} ${it.skuCode} ${it.saleUnit}`.toLowerCase().includes(q);
    });
  }, [inventory, search]);

  const stockValuationTotal = useMemo(
    () => round2(filteredInventory.reduce((sum, it) => sum + it.quantity * it.avgCost, 0)),
    [filteredInventory]
  );

  const handleSaveZeroImageItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemBranchId || !itemName.trim()) return;
    const avgCostPerSaleUnit = conversionFactor > 0 ? round2(packageCost / conversionFactor) : 0;
    const res = await upsertBranchInventoryItem({
      branchId: itemBranchId,
      skuCode: itemSku.trim() || generateAutoSku('MAT'),
      itemName: itemName.trim(),
      categoryId: itemCatId,
      subCategoryId: itemSubCatId,
      purchaseUnit,
      saleUnit,
      conversionFactor,
      purchasePackages,
      avgCost: avgCostPerSaleUnit,
      retailPrice,
      wholesalePrice,
    });
    if (res.success) {
      setIsItemModalOpen(false);
      setItemName('');
      setItemSku(generateAutoSku('MAT'));
      await loadAll();
      showMsg('تم حفظ الصنف (بدون صور) مع تحويل الوحدات تلقائياً وظهوره مباشرة في الكاشير.');
    } else {
      showMsg(res.error || 'تعذر حفظ الصنف', true);
    }
  };

  const handleOpenItemCard = async (it: SupplierBranchInventoryItem) => {
    setCardItem(it);
    setLoadingCard(true);
    const movs = await fetchItemHistoryCard(it.itemId, isKioskLocked ? lockedBranchId : undefined);
    setCardMovements(movs);
    setLoadingCard(false);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await transferWarehouseStock({
      fromBranchId,
      toBranchId,
      itemId: transferItemId,
      quantity: transferQty,
      notes: transferNotes,
    });
    if (res.success) {
      setTransferNotes('');
      await loadAll();
      showMsg(`تم التحويل بنجاح برقم مستند ${res.referenceNo} وتحديث كارت الصنف.`);
    } else {
      showMsg(res.error || 'تعذر التحويل بين المخازن', true);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const res = await saveErpCategory(catName.trim(), catParentId || null);
    if (res.success) {
      setCatName('');
      await loadAll();
      showMsg('تمت إضافة التصنيف بنجاح.');
    }
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;
    const res = await saveErpVendor({ name: vendorName.trim(), phone: vendorPhone, vendorType });
    if (res.success) {
      setVendorName('');
      setVendorPhone('');
      await loadAll();
      showMsg('تم تسجيل المصنع / المورد الخارجي بنجاح.');
    }
  };

  const purTotal = useMemo(
    () => round2(purLines.reduce((s, l) => s + Number(l.purchaseQty || 0) * Number(l.packageCost || 0), 0)),
    [purLines]
  );

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const vObj = vendors.find((v) => v.id === purVendorId);
    const res = await createErpPurchaseInvoice({
      branchId: purBranchId,
      vendorId: purVendorId || undefined,
      vendorName: vObj?.name || 'مصنع خامات',
      items: purLines.filter((l) => l.itemName.trim()),
      paidAmount: purChannel === 'credit' ? 0 : purPaid,
      treasuryChannel: purChannel,
    });
    if (res.success) {
      setPurLines([
        {
          itemName: '',
          purchaseUnit: 'طرد',
          saleUnit: 'كيلو',
          conversionFactor: 25,
          purchaseQty: 1,
          packageCost: 0,
          retailPrice: 0,
          wholesalePrice: 0,
        },
      ]);
      await loadAll();
      showMsg(`تم اعتماد فاتورة التوريد #${res.purchase?.invoiceNo} وتغذية المخزن والخزينة.`);
    } else {
      showMsg(res.error || 'تعذر تسجيل الفاتورة', true);
    }
  };

  const sourceBranchItems = useMemo(
    () => inventory.filter((it) => it.branchId === fromBranchId && it.quantity > 0),
    [inventory, fromBranchId]
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5 text-right" dir="rtl">
      {/* Header */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
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
            <h1 className="text-base sm:text-lg font-black flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-[#EA580C]" />
              <span>المخازن (نصوص وأرقام فقط) · كارت الصنف · المصانع</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              التقييم المالي للمخزون الظاهر: <strong className="font-mono text-[#0C1427] dark:text-amber-300">{stockValuationTotal.toLocaleString('ar-EG')} {currency}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBranchId}
            disabled={isKioskLocked}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
          >
            {!isKioskLocked && <option value="all">كل المخازن والفروع</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setIsItemModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف للمخزن</span>
          </button>

          {!isKioskLocked && (
            <button
              type="button"
              onClick={onGoHome}
              aria-label="إغلاق"
              className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'stock', label: 'الجرد والرصيد وكارت الصنف', icon: Warehouse },
            { id: 'transfers', label: 'التحويل بين المخازن والفروع', icon: ArrowLeftRight },
            { id: 'categories', label: 'التصنيفات الرئيسية والفرعية', icon: Layers },
            ...(isKioskLocked ? [] : [{ id: 'vendors', label: 'المصانع وفواتير الشراء (علينا كام)', icon: Factory }]),
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${
                tab === t.id
                  ? 'bg-[#0C1427] text-white border-[#0C1427]'
                  : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>{t.label}</span>
            </button>
          );
        })}
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

      {/* TAB 1: Zero-Image Stocktaking & Item History Cards */}
      {tab === 'stock' && (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الكود SKU..."
              className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
                <tr>
                  <th className="p-2.5 font-black">الكود SKU</th>
                  <th className="p-2.5 font-black">اسم الصنف</th>
                  <th className="p-2.5 font-black">المخزن/الفرع</th>
                  <th className="p-2.5 font-black">تحويل الوحدات</th>
                  <th className="p-2.5 font-black">الرصيد المتاح</th>
                  <th className="p-2.5 font-black">متوسط التكلفة</th>
                  <th className="p-2.5 font-black">قيمة الرصيد</th>
                  <th className="p-2.5 font-black">قصة حياة الصنف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center font-bold">جاري التحميل...</td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-[#475569]">لا توجد أصناف مسجلة في هذا المخزن بعد.</td>
                  </tr>
                ) : (
                  filteredInventory.map((it) => {
                    const brName = branches.find((b) => b.id === it.branchId)?.name || 'مخزن';
                    const val = round2(it.quantity * it.avgCost);
                    return (
                      <tr key={it.id}>
                        <td className="p-2.5 font-mono font-bold text-[#C2410C] dark:text-amber-300">{it.skuCode}</td>
                        <td className="p-2.5 font-black">{it.itemName}</td>
                        <td className="p-2.5 text-[11px]">{brName}</td>
                        <td className="p-2.5 text-[11px]">
                          1 {it.purchaseUnit} = <span className="font-mono font-bold">{it.conversionFactor}</span> {it.saleUnit}
                        </td>
                        <td className="p-2.5 font-mono tabular-nums font-black">
                          {it.quantity} {it.saleUnit}
                        </td>
                        <td className="p-2.5 font-mono tabular-nums">
                          {it.avgCost} {currency}
                        </td>
                        <td className="p-2.5 font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-300">
                          {val.toLocaleString('ar-EG')} {currency}
                        </td>
                        <td className="p-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenItemCard(it)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0C1427] dark:bg-[#1A2B54] text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-amber-300" />
                            <span>كارت الصنف</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Stock Transfers */}
      {tab === 'transfers' && (
        <form
          onSubmit={handleTransfer}
          className="max-w-2xl rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3"
        >
          <h2 className="text-sm font-black">تحويل بضاعة من المخزن المركزي أو فرع ← إلى فرع آخر</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold mb-1">من مخزن / فرع (المُرسِل)</label>
              <select
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">إلى فرع / مخزن (المُستلِم)</label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                {branches.filter((b) => b.id !== fromBranchId).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">الصنف (بوحدة البيع)</label>
              <select
                required
                value={transferItemId}
                onChange={(e) => setTransferItemId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                <option value="">اختر الصنف...</option>
                {sourceBranchItems.map((it) => (
                  <option key={it.id} value={it.itemId}>
                    {it.itemName} ({it.skuCode}) — متاح {it.quantity} {it.saleUnit}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">الكمية المحولة</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={transferQty}
                onChange={(e) => setTransferQty(Number(e.target.value || 0))}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
              />
            </div>
          </div>

          <input
            type="text"
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
            placeholder="ملاحظات التحويل (اختياري)"
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />

          <button
            type="submit"
            disabled={!transferItemId || !toBranchId}
            className="px-5 py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer disabled:opacity-45"
          >
            اعتماد التحويل وترحيل الأرصدة
          </button>
        </form>
      )}

      {/* TAB 3: Main & Sub Categories */}
      {tab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form
            onSubmit={handleCreateCategory}
            className="lg:col-span-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
          >
            <h2 className="text-sm font-black">إضافة تصنيف رئيسي أو فرعي</h2>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="اسم التصنيف (مثال: حبال مكرمية / قطن 4 مم)"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <select
              value={catParentId}
              onChange={(e) => setCatParentId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            >
              <option value="">تصنيف رئيسي (مستقل)</option>
              {mainCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  فرعي داخل: {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
            >
              حفظ التصنيف
            </button>
          </form>

          <div className="lg:col-span-8 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5">
            <h2 className="text-sm font-black">شجرة التصنيفات ({categories.length})</h2>
            {mainCategories.length === 0 ? (
              <p className="text-xs text-[#475569] py-6 text-center">لم تتم إضافة تصنيفات بعد.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mainCategories.map((mc) => {
                  const subs = getSubCats(mc.id);
                  return (
                    <div
                      key={mc.id}
                      className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">{mc.name}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteErpCategory(mc.id);
                            loadAll();
                          }}
                          className="text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {subs.length > 0 && (
                        <div className="space-y-1 pr-3 border-r-2 border-[#EA580C]">
                          {subs.map((sc) => (
                            <div key={sc.id} className="flex items-center justify-between text-[11px]">
                              <span>{sc.name}</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteErpCategory(sc.id);
                                  loadAll();
                                }}
                                className="text-rose-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: External Vendors & Purchase Invoices */}
      {tab === 'vendors' && !isKioskLocked && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <form
              onSubmit={handleSaveVendor}
              className="lg:col-span-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5"
            >
              <h2 className="text-sm font-black">إضافة مصنع أو مورد خارجي</h2>
              <input
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="اسم المصنع / التاجر"
                className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono"
              />
              <input
                type="text"
                value={vendorType}
                onChange={(e) => setVendorType(e.target.value)}
                placeholder="النشاط (مصنع غزل / مستورد خامات)"
                className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#0C1427] text-white text-xs font-black cursor-pointer"
              >
                حفظ المصنع
              </button>

              <div className="pt-2 space-y-1.5 border-t border-[#D4CCBC]/70">
                <p className="text-[11px] font-black text-[#475569]">أرصدة المصانع (علينا كام):</p>
                {vendors.map((v) => (
                  <div key={v.id} className="flex justify-between text-xs bg-[#EFE9DC] dark:bg-[#132040] p-2 rounded-lg">
                    <span className="font-bold">{v.name}</span>
                    <span className="font-mono font-black text-rose-600">
                      {v.balanceOwed.toLocaleString('ar-EG')} {currency}
                    </span>
                  </div>
                ))}
              </div>
            </form>

            <form
              onSubmit={handleCreatePurchase}
              className="lg:col-span-8 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
            >
              <h2 className="text-sm font-black">تسجيل فاتورة مشتريات خامات (تحويل طرود ← وحدات بيع أوتوماتيك)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <select
                  value={purBranchId}
                  onChange={(e) => setPurBranchId(e.target.value)}
                  className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>توريد إلى: {b.name}</option>
                  ))}
                </select>
                <select
                  value={purVendorId}
                  onChange={(e) => setPurVendorId(e.target.value)}
                  className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                >
                  <option value="">اختر المصنع / المورد...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <select
                  value={purChannel}
                  onChange={(e) => setPurChannel(e.target.value as any)}
                  className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                >
                  <option value="cash">دفع من الخزينة الرئيسية (كاش)</option>
                  <option value="instapay">دفع إنستا باي</option>
                  <option value="wallet">دفع محفظة</option>
                  <option value="credit">آجل بالكامل على المصنع</option>
                </select>
              </div>

              {purLines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px] bg-[#EFE9DC]/80 dark:bg-[#132040] p-2.5 rounded-xl">
                  <input
                    type="text"
                    required
                    value={ln.itemName}
                    onChange={(e) =>
                      setPurLines((p) => p.map((x, i) => (i === idx ? { ...x, itemName: e.target.value } : x)))
                    }
                    placeholder="اسم الصنف"
                    className="sm:col-span-2 h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] font-bold"
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={ln.purchaseQty}
                    onChange={(e) =>
                      setPurLines((p) => p.map((x, i) => (i === idx ? { ...x, purchaseQty: Number(e.target.value || 1) } : x)))
                    }
                    placeholder="عدد الطرود"
                    className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] font-mono"
                  />
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={ln.conversionFactor}
                    onChange={(e) =>
                      setPurLines((p) => p.map((x, i) => (i === idx ? { ...x, conversionFactor: Number(e.target.value || 1) } : x)))
                    }
                    placeholder="كيلو في الطرد"
                    className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] font-mono"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ln.packageCost}
                    onChange={(e) =>
                      setPurLines((p) => p.map((x, i) => (i === idx ? { ...x, packageCost: Number(e.target.value || 0) } : x)))
                    }
                    placeholder="سعر الطرد"
                    className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] font-mono"
                  />
                  <div className="flex items-center justify-between px-1 font-mono font-black">
                    <span>={convertPurchaseToSaleQty(ln.purchaseQty, ln.conversionFactor)} {ln.saleUnit}</span>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="text-xs font-mono font-black">
                  إجمالي الفاتورة: {purTotal.toLocaleString('ar-EG')} {currency}
                </div>
                {purChannel !== 'credit' && (
                  <div className="flex items-center gap-2 text-xs">
                    <span>المدفوع:</span>
                    <input
                      type="number"
                      min={0}
                      max={purTotal}
                      value={purPaid}
                      onChange={(e) => setPurPaid(Number(e.target.value || 0))}
                      className="w-28 h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-black"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                >
                  اعتماد الفاتورة وإدخال المخزن
                </button>
              </div>
            </form>
          </div>

          {purchases.length > 0 && (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
              <h3 className="text-xs font-black mb-2">سجل فواتير المشتريات الأخيرة ({purchases.length})</h3>
              <div className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E] text-xs">
                {purchases.slice(0, 8).map((p) => (
                  <div key={p.id} className="py-2 flex justify-between items-center">
                    <span>
                      <strong className="font-mono">{p.invoiceNo}</strong> · {p.vendorName} (بواسطة {p.actorName})
                    </span>
                    <span className="font-mono tabular-nums font-black">
                      {p.totalAmount.toLocaleString('ar-EG')} {currency}{' '}
                      {p.remainingAmount > 0 && <span className="text-rose-600">(آجل {p.remainingAmount})</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Zero-Image Inventory Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3" dir="rtl">
          <form
            onSubmit={handleSaveZeroImageItem}
            className="w-full max-w-xl rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">إضافة صنف خامة بالمخزن (بدون صور · نصوص وأرقام فقط)</h3>
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block font-bold mb-1">المخزن / الفرع</label>
                <select
                  value={itemBranchId}
                  onChange={(e) => setItemBranchId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">كود الصنف التلقائي (SKU)</label>
                <input
                  type="text"
                  value={itemSku}
                  onChange={(e) => setItemSku(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-bold"
                />
              </div>
            </div>

            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="اسم الصنف بالكامل (مثال: خيط مكرمية قطن محلول ٤ مم أبيض)"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] text-xs font-bold"
            />

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <select
                value={itemCatId}
                onChange={(e) => {
                  setItemCatId(e.target.value);
                  setItemSubCatId('');
                }}
                className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
              >
                <option value="">تصنيف رئيسي (اختياري)</option>
                {mainCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={itemSubCatId}
                onChange={(e) => setItemSubCatId(e.target.value)}
                className="h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
              >
                <option value="">تصنيف فرعي (اختياري)</option>
                {getSubCats(itemCatId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block font-bold mb-1">وحدة الشراء</label>
                <select
                  value={purchaseUnit}
                  onChange={(e) => setPurchaseUnit(e.target.value)}
                  className="w-full h-9 px-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
                >
                  {COMMON_PURCHASE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">وحدة البيع POS</label>
                <select
                  value={saleUnit}
                  onChange={(e) => setSaleUnit(e.target.value)}
                  className="w-full h-9 px-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
                >
                  {COMMON_SALE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">معامل التحويل</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={conversionFactor}
                  onChange={(e) => setConversionFactor(Number(e.target.value || 1))}
                  className="w-full h-9 px-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-black"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">عدد الـ({purchaseUnit})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePackages}
                  onChange={(e) => setPurchasePackages(Number(e.target.value || 0))}
                  className="w-full h-9 px-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-black"
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040] px-3 py-2 text-xs font-black text-[#C2410C] dark:text-amber-300 font-mono">
              الرصيد الناتج بالمخزن: {convertPurchaseToSaleQty(purchasePackages, conversionFactor)} {saleUnit}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block font-bold mb-1">سعر شراء الـ{purchaseUnit}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={packageCost}
                  onChange={(e) => setPackageCost(Number(e.target.value || 0))}
                  className="w-full h-9 px-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">بيع قطاعي / {saleUnit}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(Number(e.target.value || 0))}
                  className="w-full h-9 px-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">بيع جملة / {saleUnit}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(Number(e.target.value || 0))}
                  className="w-full h-9 px-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
            >
              حفظ الصنف بالمخزن
            </button>
          </form>
        </div>
      )}

      {/* Item History Card Modal (كارت الصنف) */}
      {cardItem && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3" dir="rtl">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                  <History className="w-4 h-4 text-[#EA580C]" />
                  <span>كارت الصنف (قصة الحياة الكاملة): {cardItem.itemName}</span>
                </h3>
                <p className="text-[11px] font-mono text-[#475569]">
                  {cardItem.skuCode} · الرصيد الحالي: {cardItem.quantity} {cardItem.saleUnit}
                </p>
              </div>
              <button type="button" onClick={() => setCardItem(null)} className="p-1.5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingCard ? (
                <p className="text-center py-8 text-xs font-bold">جاري تحميل كارت الصنف...</p>
              ) : cardMovements.length === 0 ? (
                <p className="text-center py-8 text-xs text-[#475569]">لا توجد حركات مسجلة لهذا الصنف.</p>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC]">
                    <tr>
                      <th className="p-2 font-black">التاريخ</th>
                      <th className="p-2 font-black">الحركة</th>
                      <th className="p-2 font-black">الكمية</th>
                      <th className="p-2 font-black">الرصيد بعد</th>
                      <th className="p-2 font-black">المسؤول (مين نفّذ)</th>
                      <th className="p-2 font-black">المرجع / البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                    {cardMovements.map((m) => (
                      <tr key={m.id}>
                        <td className="p-2 text-[10px] font-mono">
                          {m.createdAt ? new Date(m.createdAt).toLocaleString('ar-EG') : ''}
                        </td>
                        <td className="p-2 font-bold">
                          {m.movementType === 'purchase_in'
                            ? 'توريد وارد'
                            : m.movementType === 'transfer_in'
                            ? 'تحويل مستلم'
                            : m.movementType === 'transfer_out'
                            ? 'تحويل منصرف'
                            : m.movementType === 'pos_sale'
                            ? 'بيع كاشير'
                            : 'تسوية'}
                        </td>
                        <td
                          className={`p-2 font-mono font-black ${
                            m.qtyDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {m.qtyDelta >= 0 ? `+${m.qtyDelta}` : m.qtyDelta} {m.unitLabel}
                        </td>
                        <td className="p-2 font-mono">{m.balanceAfter}</td>
                        <td className="p-2 font-bold">{m.actorName}</td>
                        <td className="p-2 text-[11px] text-[#475569]">
                          {m.referenceNo} {m.notes ? `· ${m.notes}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
