import React, { useState, useEffect, useMemo } from 'react';
import { InventoryStockItem, InventoryTransaction, UserProfile } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { NumberInput } from '../ui/NumberInput';
import { useExperienceMode } from '../../types/experienceMode';
import {
  deduplicateMaterialsByName,
  readLocalMaterialStockMap,
  resolveMaterialStockValues,
} from '../../lib/materialStockUtils';
import {
  getMaterialsFromSupabase,
  createMaterialInSupabase,
  ensureDefaultUnitsInSupabase,
  generateUuid,
} from '../../db/supabaseService';
import {
  X,
  Boxes,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  History,
  CheckCircle,
  Bell,
  Edit2,
  SlidersHorizontal,
  ShoppingCart,
  Search,
} from 'lucide-react';

interface InventoryLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onOpenMaterialsView?: () => void;
  asPage?: boolean;
}

export const InventoryLedgerModal: React.FC<InventoryLedgerModalProps> = ({
  isOpen,
  onClose,
  profile,
  onOpenMaterialsView,
  asPage = false,
}) => {
  const { isCraft } = useExperienceMode('artisan', profile);
  const [items, setItems] = useState<InventoryStockItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'purchase' | 'adjustment' | 'history'>('stock');
  const [stockFilter, setStockFilter] = useState<'stocked' | 'low' | 'all'>('stocked');
  const [stockSearch, setStockSearch] = useState('');
  const [alertBannerDismissed, setAlertBannerDismissed] = useState(false);

  // Purchase form state — always starts cleanly at 0
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(0);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState<number>(0);
  const [supplierName, setSupplierName] = useState<string>('');
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');

  // Adjustment / Consumption form state — starts cleanly at 0
  const [adjustItemId, setAdjustItemId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'consume' | 'audit'>('consume');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  // Quick edit reorder threshold modal state
  const [editingThresholdItem, setEditingThresholdItem] = useState<InventoryStockItem | null>(null);
  const [tempThresholdValue, setTempThresholdValue] = useState<number>(0);

  // New item modal form state — ALWAYS 0 (never fake 10 / 180 / 5)
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<any>('خيوط');
  const [newItemUnit, setNewItemUnit] = useState<any>('كيلو');
  const [newItemInitialStock, setNewItemInitialStock] = useState(0);
  const [newItemCost, setNewItemCost] = useState(0);
  const [newItemMinThreshold, setNewItemMinThreshold] = useState(0);
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('المخزن الرئيسي');

  const [actionNotice, setActionNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

  const loadData = async () => {
    if (!tenantId) return;
    try {
      // Purge any legacy auto-seeded fake 15kg balances on real workshops with zero real purchases/movements
      await tenantStorage.purgeAutoSeededFakeMaterialStock(tenantId);

      const [sbMats, unts, dexieStock, txs] = await Promise.all([
        getMaterialsFromSupabase(tenantId).catch(() => ({ data: [], error: null })),
        ensureDefaultUnitsInSupabase(tenantId).catch(() => []),
        tenantStorage.getInventory(tenantId),
        tenantStorage.getInventoryTransactions(tenantId),
      ]);

      const localMap = readLocalMaterialStockMap(tenantId);
      const dexieLookup = new Map<string, any>();
      dexieStock.forEach((m) => {
        if (m.id) dexieLookup.set(m.id, m);
        if (m.materialName) dexieLookup.set(m.materialName.trim().toLowerCase(), m);
      });

      const combined: any[] = [];
      (sbMats?.data || []).forEach((sm: any) => {
        const safeName = String(sm.name || '').trim();
        if (!safeName) return;
        const local = dexieLookup.get(sm.id) || dexieLookup.get(safeName.toLowerCase());
        const unitObj = unts.find((u: any) => u.id === sm.unit_id);
        const unitName = unitObj?.name || local?.unit || 'كيلو';
        const resolved = resolveMaterialStockValues(
          {
            id: sm.id,
            currentStock: local?.currentStock ?? sm.current_stock ?? 0,
            minAlertThreshold: local?.minAlertThreshold ?? sm.min_limit ?? 0,
            warehouseTracked: local?.warehouseTracked,
          },
          localMap
        );
        combined.push({
          id: sm.id,
          tenantId,
          materialName: safeName,
          category: local?.category || sm.market_name || (sm.kind === 'extra' ? 'إكسسوارات ومعادن' : 'خيوط'),
          unit: unitName,
          currentStock: resolved.currentStock,
          costPerUnit: Number(sm.purchase_price || local?.costPerUnit || 0),
          costPerGram:
            unitName === 'كيلو'
              ? Number(sm.purchase_price || local?.costPerUnit || 0) / 1000
              : Number(sm.purchase_price || local?.costPerUnit || 0),
          supplierName: local?.supplierName || 'مورد عام',
          warehouseLocation: local?.warehouseLocation || 'المخزن الرئيسي',
          lastPurchaseDate: local?.lastPurchaseDate || '',
          minAlertThreshold: resolved.minThreshold,
          reorderLevel: resolved.minThreshold,
          warehouseTracked: resolved.isTracked,
          isActive: true,
        });
      });

      dexieStock.forEach((it) => {
        const resolved = resolveMaterialStockValues(it, localMap);
        combined.push({
          ...it,
          currentStock: resolved.currentStock,
          minAlertThreshold: resolved.minThreshold,
          reorderLevel: resolved.minThreshold,
          warehouseTracked: resolved.isTracked,
        });
      });

      const uniqueStock = deduplicateMaterialsByName(combined, localMap) as (InventoryStockItem & {
        warehouseTracked?: boolean;
      })[];
      setItems(uniqueStock);
      setTransactions(txs);
      const hasAnyStocked = uniqueStock.some((i: any) => i.currentStock > 0 || i.warehouseTracked);
      if (!hasAnyStocked) {
        setStockFilter('all');
      }
      if (uniqueStock.length > 0 && !selectedItemId) {
        setSelectedItemId(uniqueStock[0].id);
      }
      if (uniqueStock.length > 0 && !adjustItemId) {
        setAdjustItemId(uniqueStock[0].id);
      }
    } catch (err: any) {
      console.error('Error loading inventory:', err);
    }
  };

  useEffect(() => {
    if (isOpen || asPage) {
      loadData();
    }
  }, [tenantId, isOpen, asPage]);

  // Handle Recording New Purchase (Adds Stock)
  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;

    try {
      await tenantStorage.recordMaterialPurchase(
        tenantId,
        selectedItemId,
        purchaseQuantity,
        purchaseUnitCost,
        supplierName,
        purchaseNotes
      );
      setActionNotice({
        text: `تم تقييد شراء الخامات كأصل مخزني مالي بقيمة ${Math.round(purchaseQuantity * purchaseUnitCost)} ${profile.currencySymbol} وتحديث الرصيد فورياً!`,
      });
      await loadData();
      setActiveTab('stock');
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'فشل تسجيل الشراء', isError: true });
    }
  };

  // Handle Stock Consumption or Audit Adjustment
  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItemId) return;

    try {
      if (adjustType === 'consume') {
        await tenantStorage.recordMaterialConsumption(
          tenantId,
          adjustItemId,
          adjustQuantity,
          adjustNotes
        );
        setActionNotice({
          text: `تم صرف ${adjustQuantity} من الخامة وتحديث رصيد المخزن فورياً!`,
        });
      } else {
        await tenantStorage.adjustMaterialStock(
          tenantId,
          adjustItemId,
          adjustQuantity,
          adjustNotes || 'تسوية جردية فعلية'
        );
        setActionNotice({
          text: `تم ضبط الرصيد الفعلي للخامة إلى ${adjustQuantity} وتحديث سجلات الجرد والتنبيهات!`,
        });
      }

      await loadData();
      setActiveTab('stock');
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'فشل تسجيل الحركة', isError: true });
    }
  };

  // Handle Updating Reorder Alert Threshold
  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThresholdItem) return;

    try {
      await tenantStorage.updateMaterialReorderThreshold(
        tenantId,
        editingThresholdItem.id,
        tempThresholdValue
      );
      setActionNotice({
        text: `تم تحديث حد الطلب الأدنى للخامة "${editingThresholdItem.materialName}" إلى ${tempThresholdValue} ${editingThresholdItem.unit} بنجاح!`,
      });
      setEditingThresholdItem(null);
      await loadData();
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'فشل تحديث حد الطلب', isError: true });
    }
  };

  // Quick Reorder Trigger from Table
  const handleQuickReorder = (item: InventoryStockItem) => {
    setSelectedItemId(item.id);
    setPurchaseUnitCost(item.costPerUnit);
    setSupplierName(item.supplierName || 'مورد عام');
    setPurchaseQuantity(Math.max(5, (item.minAlertThreshold || 5) * 2));
    setActiveTab('purchase');
  };

  // Quick Consume Trigger from Table
  const handleQuickConsume = (item: InventoryStockItem) => {
    setAdjustItemId(item.id);
    setAdjustType('consume');
    setAdjustQuantity(1);
    setActiveTab('adjustment');
  };

  // Handle Defining Brand-New Item (unified across Supabase + Dexie, zero fake defaults)
  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newItemName.trim();
    if (!trimmedName) return;

    try {
      const initialStockVal = Math.max(0, Number(newItemInitialStock) || 0);
      const costVal = Math.max(0, Number(newItemCost) || 0);
      const thresholdVal = Math.max(0, Number(newItemMinThreshold) || 0);
      const newId = generateUuid();

      // 1. Sync to Supabase so خاماتي + جرد الأرصدة + حركة المخزن share one source of truth
      let savedId = newId;
      let resolvedUnitId: string | undefined;
      try {
        const unts = await ensureDefaultUnitsInSupabase(tenantId);
        const unitObj = unts.find((u) => u.name === newItemUnit) || unts[0];
        resolvedUnitId = unitObj?.id;
        if (resolvedUnitId) {
          const sbRes = await createMaterialInSupabase(tenantId, {
            id: newId,
            name: trimmedName,
            kind: newItemCategory === 'خيوط' ? 'primary' : 'extra',
            purchase_price: costVal,
            market_name: newItemCategory,
            unit_id: resolvedUnitId,
          });
          if (sbRes?.data?.id) savedId = sbRes.data.id;
        }
      } catch (sbErr) {
        console.warn('[InventoryLedger] Cloud create deferred:', sbErr);
      }

      // 2. Save in local Dexie
      const newItem: InventoryStockItem & { warehouseTracked?: boolean; workshopId?: string; unitId?: string } = {
        id: savedId,
        tenantId,
        workshopId: tenantId,
        materialName: trimmedName,
        category: newItemCategory,
        unit: newItemUnit,
        unitId: resolvedUnitId,
        currentStock: initialStockVal,
        costPerUnit: costVal,
        costPerGram: newItemUnit === 'كيلو' ? costVal / 1000 : costVal,
        supplierName: newItemSupplier.trim() || 'مورد عام',
        warehouseLocation: newItemLocation.trim() || 'المخزن الرئيسي',
        lastPurchaseDate: initialStockVal > 0 ? new Date().toISOString().split('T')[0] : '',
        minAlertThreshold: thresholdVal,
        reorderLevel: thresholdVal,
        warehouseTracked: initialStockVal > 0 || thresholdVal > 0,
        isActive: true,
      };

      await tenantStorage.saveRawMaterial(newItem as any, { skipCloudQueue: true });
      setIsAddingNewItem(false);
      setNewItemName('');
      setNewItemInitialStock(0);
      setNewItemCost(0);
      setNewItemMinThreshold(0);
      window.dispatchEvent(new CustomEvent('alshams_materials_changed'));
      await loadData();
      setActionNotice({
        text: `تم إضافة الخامة "${trimmedName}" بنجاح ومزامنتها مع قائمة خاماتك ومخزنك.`,
      });
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'فشل إضافة الصنف', isError: true });
    }
  };

  // Calculate total inventory value, stocked items & ONLY genuinely tracked low-stock items
  const totalInventoryValue = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.currentStock) || 0) * (Number(i.costPerUnit) || 0), 0),
    [items]
  );

  const stockedItems = useMemo(
    () => items.filter((i: any) => Number(i.currentStock) > 0 || i.warehouseTracked === true),
    [items]
  );

  const lowStockItems = useMemo(
    () =>
      items.filter((i: any) => {
        const isTracked = Number(i.currentStock) > 0 || i.warehouseTracked === true;
        const threshold = Number(i.minAlertThreshold ?? i.reorderLevel ?? 0);
        return isTracked && threshold > 0 && Number(i.currentStock) <= threshold;
      }),
    [items]
  );

  const filteredStockItems = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    return items.filter((i: any) => {
      const isTracked = Number(i.currentStock) > 0 || i.warehouseTracked === true;
      const threshold = Number(i.minAlertThreshold ?? i.reorderLevel ?? 0);
      const isLow = isTracked && threshold > 0 && Number(i.currentStock) <= threshold;

      if (stockFilter === 'stocked' && !isTracked) return false;
      if (stockFilter === 'low' && !isLow) return false;
      if (q) {
        const nameMatch = String(i.materialName || '').toLowerCase().includes(q);
        const catMatch = String(i.category || '').toLowerCase().includes(q);
        if (!nameMatch && !catMatch) return false;
      }
      return true;
    });
  }, [items, stockFilter, stockSearch]);

  if (!isOpen && !asPage) return null;

  const outerClass = asPage
    ? 'max-w-6xl mx-auto px-3 sm:px-6 py-5'
    : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200';

  const cardClass = asPage
    ? 'bg-white dark:bg-[#132040] w-full rounded-3xl shadow-sm border border-[#D4CCBC] dark:border-[#22355E] text-stone-900 dark:text-stone-100 p-4 sm:p-6 relative text-right'
    : 'bg-white dark:bg-stone-900 w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-amber-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 p-5 sm:p-7 relative text-right';

  return (
    <div className={outerClass} dir="rtl">
      <div className={cardClass}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-[#22355E]">
          <div>
            <h2 className="text-lg font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-600" />
              <span>{isCraft ? 'حركة المخزن والجرد' : 'دفتر حركة المخزن والتسويات والأرصدة'}</span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {isCraft
                ? 'تابع الكميات الفعلية اللي في مخزنك، وسجّل أي توريد أو صرف أو جرد بسهولة'
                : 'تسجيل أصول الخامات وتتبع مستويات إعادة الطلب وحركات التوريد والصرف والتسوية الجردية'}
            </p>
          </div>
          {!asPage && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div
            className={`mt-4 p-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 ${
              actionNotice.isError
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionNotice.isError ? (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{actionNotice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
              aria-label="إغلاق الرسالة"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compact, Dismissible Low-Stock Summary Bar (ONLY genuinely tracked items — never a wall of 130 catalog items!) */}
        {lowStockItems.length > 0 && !alertBannerDismissed && (
          <div className="mt-4 px-3.5 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Bell className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                يوجد <strong className="font-mono tabular-nums">{lowStockItems.length}</strong> خامة بالمخزن قربت تخلص (أقل من حد الأمان).
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('stock');
                  setStockFilter('low');
                }}
                className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer transition"
              >
                عرض النواقص
              </button>
              <button
                type="button"
                onClick={() => setAlertBannerDismissed(true)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer transition"
                title="إخفاء التنبيه"
                aria-label="إخفاء التنبيه"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Clean Summary Bar */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 text-white flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="text-right">
            <span className="text-[11px] text-amber-100 block font-bold">
              {isCraft ? 'قيمة الخامات اللي في مخزنك دلوقتي' : 'إجمالي القيمة المالية لأصول الخامات بالمخزن'}
            </span>
            <span className="text-2xl font-black font-mono tabular-nums">
              {Math.round(totalInventoryValue).toLocaleString('ar-EG')} {profile.currencySymbol}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-amber-100">
            <div>
              <span className="block text-[10px] opacity-80">خامات لها رصيد بالمخزن</span>
              <strong className="font-mono tabular-nums text-base text-white">{stockedItems.length}</strong>
            </div>
            <div className="h-7 w-px bg-white/25" />
            <div>
              <span className="block text-[10px] opacity-80">نواقص فعلية</span>
              <strong className="font-mono tabular-nums text-base text-white">{lowStockItems.length}</strong>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <span>{isCraft ? `أرصدة المخزن (${stockedItems.length})` : `الأرصدة ومستويات الطلب (${stockedItems.length})`}</span>
            {lowStockItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono tabular-nums">
                {lowStockItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('purchase')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'purchase'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isCraft ? 'إضافة كمية مشتراة' : 'تسجيل شراء وتوريد خامات'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adjustment')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'adjustment'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isCraft ? 'صرف أو تعديل رصيد' : 'صرف تشغيل / تسوية جردية'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{isCraft ? `سجل الحركة (${transactions.length})` : `سجل حركات المخزن (${transactions.length})`}</span>
          </button>

          <div className="mr-auto flex items-center gap-2">
            {onOpenMaterialsView && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMaterialsView();
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer whitespace-nowrap"
              >
                فتح خاماتي
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAddingNewItem(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-900 dark:text-amber-200 transition cursor-pointer whitespace-nowrap"
            >
              + خامة جديدة
            </button>
          </div>
        </div>

        {/* TAB 1: Stock List with Smart Filters & Zero False Alarms */}
        {activeTab === 'stock' && (
          <div className="mt-4 space-y-3">
            {/* Search & Segmented Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
                <button
                  type="button"
                  onClick={() => setStockFilter('stocked')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    stockFilter === 'stocked'
                      ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  المتوفر بالمخزن ({stockedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter('low')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    stockFilter === 'low'
                      ? 'bg-white dark:bg-stone-900 text-rose-700 dark:text-rose-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  النواقص ({lowStockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    stockFilter === 'all'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  كل الخامات ({items.length})
                </button>
              </div>

              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="ابحث باسم الخامة..."
                  className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none"
                />
              </div>
            </div>

            {filteredStockItems.length === 0 ? (
              <div className="text-center py-10 text-stone-500 dark:text-stone-400 text-xs space-y-2 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
                <p>
                  {stockFilter === 'low'
                    ? 'مفيش نواقص حالياً — أرصدة المخزن في الأمان.'
                    : stockFilter === 'stocked'
                    ? 'لسه مفيش خامات مسجّل لها رصيد فعلي في المخزن. اعرض "كل الخامات" وسجّل رصيد أي خامة بتشتغل بيها.'
                    : 'لا توجد خامات مطابقة للبحث.'}
                </p>
                {stockFilter === 'stocked' && items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStockFilter('all')}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                  >
                    عرض كل خاماتي ({items.length}) لتسجيل رصيدها
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 font-bold">
                    <tr className="border-b border-stone-200 dark:border-stone-800">
                      <th className="py-2.5 px-3">اسم الخامة</th>
                      <th className="py-2.5 px-3">الرصيد الفعلي</th>
                      <th className="py-2.5 px-3">{isCraft ? 'حد التنبيه' : 'حد الطلب الأدنى'}</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3">سعر الوحدة</th>
                      {!isCraft && <th className="py-2.5 px-3">قيمة الأصل</th>}
                      <th className="py-2.5 px-3 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {filteredStockItems.map((item: any) => {
                      const isTracked = Number(item.currentStock) > 0 || item.warehouseTracked === true;
                      const threshold = isTracked ? Number(item.minAlertThreshold ?? item.reorderLevel ?? 0) : 0;
                      const isLowStock = isTracked && threshold > 0 && Number(item.currentStock) <= threshold;

                      return (
                        <tr
                          key={item.id}
                          className={`transition ${
                            isLowStock
                              ? 'bg-rose-50/40 dark:bg-rose-950/15 hover:bg-rose-100/30 dark:hover:bg-rose-950/30'
                              : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-stone-100">
                            {item.materialName}
                            <span className="text-[10px] text-stone-400 block font-normal">
                              {item.category}
                            </span>
                          </td>

                          {/* Current Stock */}
                          <td className="py-2.5 px-3 font-mono tabular-nums font-bold">
                            <span
                              className={`text-sm ${
                                isLowStock
                                  ? 'text-rose-600 font-black'
                                  : isTracked
                                  ? 'text-stone-900 dark:text-stone-100'
                                  : 'text-stone-400'
                              }`}
                            >
                              {item.currentStock}
                            </span>{' '}
                            <span className="text-[10px] text-stone-500">{item.unit}</span>
                          </td>

                          {/* Reorder Threshold with Quick Edit */}
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            <div className="flex items-center gap-1">
                              <span className={threshold > 0 ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-stone-400'}>
                                {threshold > 0 ? `${threshold} ${item.unit}` : 'غير محدد'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingThresholdItem(item);
                                  setTempThresholdValue(threshold);
                                }}
                                title="تعديل حد التنبيه"
                                className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-amber-600 transition cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Honest Status Text (no false red alarms on unstocked catalog items!) */}
                          <td className="py-2.5 px-3">
                            {!isTracked ? (
                              <span className="text-[11px] font-medium text-stone-400">
                                لم يبدأ جردها بعد
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-3 h-3" />
                                <span>قربت تخلص</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle className="w-3 h-3" />
                                <span>رصيد متوفر</span>
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            {Number(item.costPerUnit || 0).toLocaleString('ar-EG')} {profile.currencySymbol}
                          </td>

                          {!isCraft && (
                            <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-amber-700 dark:text-amber-400">
                              {Math.round(item.currentStock * item.costPerUnit).toLocaleString('ar-EG')} {profile.currencySymbol}
                            </td>
                          )}

                          {/* Quick Actions */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickReorder(item)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                                title="تسجيل شراء / إضافة رصيد"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                <span>{isTracked ? 'شراء' : 'إضافة رصيد'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickConsume(item)}
                                className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-[10px] cursor-pointer transition whitespace-nowrap"
                                title="صرف أو جرد"
                              >
                                صرف / جرد
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Record Purchase (Add Stock) */}
        {activeTab === 'purchase' && (
          <form onSubmit={handleRecordPurchase} className="mt-4 space-y-4 max-w-xl mx-auto">
            {!isCraft && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>تسجيل شراء خامات كأصل مالي:</strong> يضيف الكمية المشتراة فوراً لرصيد المخزن ويحدّث متوسط التكلفة.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                اختيار الخامة *
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.materialName} (الرصيد الحالي: {i.currentStock} {i.unit} - حد الطلب: {i.minAlertThreshold} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  الكمية المشتراة *
                </label>
                <NumberInput
                  required
                  value={purchaseQuantity}
                  onChange={setPurchaseQuantity}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-sm font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  سعر شراء الوحدة ({profile.currencySymbol}) *
                </label>
                <NumberInput
                  required
                  value={purchaseUnitCost}
                  onChange={setPurchaseUnitCost}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-sm font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                اسم المورد / المحل *
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="مثال: مغزل المحلة، تاجر خان الخليلي"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                ملاحظات الفاتورة أو رقم إذن التوريد
              </label>
              <input
                type="text"
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>إثبات شراء أصول الخامات وتحديث الرصيد المخزني</span>
            </button>
          </form>
        )}

        {/* TAB 3: Stock Consumption & Audit Adjustment */}
        {activeTab === 'adjustment' && (
          <form onSubmit={handleRecordAdjustment} className="mt-4 space-y-4 max-w-xl mx-auto">
            {!isCraft && (
              <div className="p-3.5 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 leading-relaxed">
                <strong>صرف تشغيل أو تسوية جردية:</strong> يمكنك صرف خامات مستهلكة في الإنتاج أو ضبط الرصيد الفعلي بعد الجرد.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                نوع العملية *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('consume')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    adjustType === 'consume'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                  }`}
                >
                  صرف خامات للتشغيل (خصم كمية)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('audit')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    adjustType === 'audit'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                  }`}
                >
                  تسوية جردية (تحديد الرصيد الفعلي)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                اختيار الخامة *
              </label>
              <select
                value={adjustItemId}
                onChange={(e) => setAdjustItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.materialName} (الرصيد الحالي: {i.currentStock} {i.unit} - حد الأمان: {i.minAlertThreshold} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                {adjustType === 'consume' ? 'الكمية المراد صرفها للإنتاج *' : 'الرصيد الفعلي الجديد بعد الجرد *'}
              </label>
              <NumberInput
                required
                value={adjustQuantity}
                onChange={setAdjustQuantity}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-sm font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                سبب الصرف أو التسوية الجردية
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="مثال: تصنيع طلبية كوشن، مطابقة الجرد الدوري"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>تأكيد الحركة وتحديث الرصيد والتنبيهات التلقائية</span>
            </button>
          </form>
        )}

        {/* TAB 4: History */}
        {activeTab === 'history' && (
          <div className="mt-4 space-y-2">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs">
                لا توجد حركات مخزن مسجلة بعد.
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          tx.type === 'purchase_in'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {tx.type === 'purchase_in' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 dark:text-stone-100">
                          {tx.materialName} ({tx.type === 'purchase_in' ? 'توريد شراء' : tx.type === 'production_out' ? 'صرف تشغيل' : 'تسوية جردية'})
                        </p>
                        <p className="text-[10px] text-stone-500">{tx.notes}</p>
                      </div>
                    </div>

                    <div className="text-left font-mono">
                      <span className="font-bold text-stone-800 dark:text-stone-200 block">
                        {tx.type === 'purchase_in' ? '+' : '-'}
                        {tx.quantity}
                      </span>
                      <span className="text-[10px] text-stone-400">{tx.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Modal to Edit Reorder Level (حد الطلب الأدنى) */}
        {editingThresholdItem && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <form
              onSubmit={handleSaveThreshold}
              className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-sm space-y-4 text-right shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                <button
                  type="button"
                  onClick={() => setEditingThresholdItem(null)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="font-extrabold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span>تعديل حد الطلب الأدنى</span>
                </h3>
              </div>

              <div>
                <p className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  الخامة: <span className="text-amber-700 dark:text-amber-400">{editingThresholdItem.materialName}</span>
                </p>
                <p className="text-[11px] text-stone-500 mb-3">
                  الرصيد الفعلي الحالي: {editingThresholdItem.currentStock} {editingThresholdItem.unit}
                </p>

                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  مستوى حد الطلب الأدنى الجديد ({editingThresholdItem.unit}) *
                </label>
                <NumberInput
                  required
                  value={tempThresholdValue}
                  onChange={setTempThresholdValue}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 font-mono text-sm font-bold outline-none"
                />
                <span className="text-[10px] text-stone-400 block mt-1">
                  * سيصدر إشعار فوري في الجرس بمجرد وصول رصيد الخامة إلى هذا الرقم أو أقل.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingThresholdItem(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-xs transition"
                >
                  حفظ وتطبيق التنبيه
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal to add brand-new stock item */}
        {isAddingNewItem && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <form
              onSubmit={handleCreateNewItem}
              className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-md space-y-3 text-right shadow-2xl"
            >
              <div className="flex items-center justify-between border-b pb-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNewItem(false)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="font-bold text-sm text-amber-900 dark:text-amber-300">
                  تعريف خامة جديدة في منظومة المخازن
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">اسم الخامة *</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="مثال: خيط قطن هندي 5 مم"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">التصنيف</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full px-2 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs cursor-pointer"
                  >
                    <option value="خيوط">خيوط</option>
                    <option value="أخشاب وشاسيهات">أخشاب وشاسيهات</option>
                    <option value="إكسسوارات ومعادن">إكسسوارات ومعادن</option>
                    <option value="تغليف وأقمشة">تغليف وأقمشة</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">وحدة القياس</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value as any)}
                    className="w-full px-2 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs cursor-pointer"
                  >
                    <option value="كيلو">كيلو</option>
                    <option value="جرام">جرام</option>
                    <option value="متر">متر</option>
                    <option value="قطعة">قطعة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">الرصيد الافتتاحي</label>
                  <NumberInput
                    value={newItemInitialStock}
                    onChange={setNewItemInitialStock}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">تكلفة الوحدة ({profile.currencySymbol})</label>
                  <NumberInput
                    value={newItemCost}
                    onChange={setNewItemCost}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-amber-900 dark:text-amber-300">
                  حد الطلب الأدنى (مستوى الأمان للتنبيه التلقائي في الجرس) *
                </label>
                <div className="relative">
                  <NumberInput
                    required
                    value={newItemMinThreshold}
                    onChange={setNewItemMinThreshold}
                    placeholder="5"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-mono font-bold outline-none"
                  />
                  <span className="absolute left-3 top-2 text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                    {newItemUnit}
                  </span>
                </div>
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  * سيظهر تنبيه فوري في جرس الإشعارات عند وصول كمية الخامة إلى هذا المستوى أو أقل.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">اسم المورد</label>
                <input
                  type="text"
                  value={newItemSupplier}
                  onChange={(e) => setNewItemSupplier(e.target.value)}
                  placeholder="مورد عام"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddingNewItem(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs transition"
                >
                  إضافة الخامة
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
