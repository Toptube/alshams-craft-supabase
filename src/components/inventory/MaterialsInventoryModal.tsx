import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../../types';
import { supabase } from '../../lib/supabase';
import { tenantStorage } from '../../db/dexieDB';
import {
  getMaterialsFromSupabase,
  createMaterialInSupabase,
  updateMaterialInSupabase,
  deleteMaterialFromSupabase,
  ensureDefaultUnitsInSupabase,
  generateUuid,
  SupabaseMaterial,
  SupabaseUnit,
} from '../../db/supabaseService';
import {
  X,
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  PackageCheck,
  Scale,
  DollarSign,
  Boxes,
  SlidersHorizontal,
  PackagePlus,
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';
import { StockLevelProgressBar } from '../materials/StockLevelProgressBar';
import { useExperienceMode } from '../../types/experienceMode';
import {
  deduplicateMaterialsByName,
  readLocalMaterialStockMap,
  resolveMaterialStockValues,
} from '../../lib/materialStockUtils';

interface MaterialsInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onOpenPurchaseForMaterial?: (item: any) => void;
}

export const MaterialsInventoryModal: React.FC<MaterialsInventoryModalProps> = ({
  isOpen,
  onClose,
  profile,
  onOpenPurchaseForMaterial,
}) => {
  const { isCraft } = useExperienceMode('artisan', profile);
  const workshopId = profile?.tenantId || profile?.workshopId || profile?.id || '';
  const currencySymbol = profile?.currencySymbol || 'ج.م';

  const [materials, setMaterials] = useState<any[]>([]);
  const [units, setUnits] = useState<SupabaseUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [stockViewFilter, setStockViewFilter] = useState<'stocked' | 'low' | 'all'>('stocked');
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('خيوط');
  const [formQuantity, setFormQuantity] = useState(10);
  const [formMinThreshold, setFormMinThreshold] = useState(0);
  const [formCostPrice, setFormCostPrice] = useState(150);
  const [formUnit, setFormUnit] = useState('كيلو');
  const [saving, setSaving] = useState(false);

  // Quick Stock Adjust Modal State
  const [adjustingItem, setAdjustingItem] = useState<any | null>(null);
  const [adjustNewStock, setAdjustNewStock] = useState(0);

  const categories = ['خيوط', 'أخشاب', 'إكسسوارات ومعادن', 'أقمشة وبطانات', 'خرز ومكملات', 'ريزن', 'تغليف', 'أخرى'];

  const loadData = async () => {
    if (!workshopId) return;
    setLoading(true);
    try {
      const [sbMats, unts, dexieMats] = await Promise.all([
        getMaterialsFromSupabase(workshopId),
        ensureDefaultUnitsInSupabase(workshopId),
        tenantStorage.getRawMaterials(workshopId),
      ]);

      setUnits(unts);

      const localStockMap = readLocalMaterialStockMap(workshopId);
      const dexieMap = new Map<string, any>();
      dexieMats.forEach((m) => {
        if (m.id) dexieMap.set(m.id, m);
        if (m.materialName) dexieMap.set(m.materialName.trim().toLowerCase(), m);
      });

      const rawCombined: any[] = [];

      // 1. From Supabase (NEVER fabricate quantity=10 or minThreshold=5!)
      (sbMats.data || []).forEach((sm) => {
        const safeName = (sm.name || '').trim();
        if (!safeName) return;
        const local = dexieMap.get(sm.id) || dexieMap.get(safeName.toLowerCase());
        const unitObj = unts.find((u) => u.id === sm.unit_id);
        const unitName = unitObj?.name || local?.unit || 'كيلو';
        const resolved = resolveMaterialStockValues(
          {
            id: sm.id,
            currentStock: local?.currentStock ?? (sm as any).current_stock ?? 0,
            minAlertThreshold: local?.minAlertThreshold ?? (sm as any).min_limit ?? 0,
            warehouseTracked: local?.warehouseTracked,
          },
          localStockMap
        );

        rawCombined.push({
          id: sm.id,
          name: safeName,
          materialName: safeName,
          category: local?.category || sm.market_name || (sm.kind === 'extra' ? 'إكسسوارات' : 'خيوط'),
          quantity: resolved.currentStock,
          currentStock: resolved.currentStock,
          minThreshold: resolved.minThreshold,
          minAlertThreshold: resolved.minThreshold,
          warehouseTracked: resolved.isTracked,
          isLowStock: resolved.isLowStock,
          costPrice: Number(sm.purchase_price || local?.costPerUnit || 0),
          unit: unitName,
          unitId: sm.unit_id,
          source: 'supabase',
        });
      });

      // 2. Remaining local Dexie items
      dexieMats.forEach((dm) => {
        const safeName = (dm.materialName || '').trim();
        if (!safeName) return;
        const resolved = resolveMaterialStockValues(dm, localStockMap);
        rawCombined.push({
          id: dm.id,
          name: safeName,
          materialName: safeName,
          category: dm.category || 'خيوط',
          quantity: resolved.currentStock,
          currentStock: resolved.currentStock,
          minThreshold: resolved.minThreshold,
          minAlertThreshold: resolved.minThreshold,
          warehouseTracked: resolved.isTracked,
          isLowStock: resolved.isLowStock,
          costPrice: Number(dm.costPerUnit || 0),
          unit: dm.unit || 'كيلو',
          source: 'dexie',
        });
      });

      const mergedList = deduplicateMaterialsByName(rawCombined, localStockMap);
      setMaterials(mergedList);
      const hasStocked = mergedList.some((m) => m.warehouseTracked || Number(m.quantity) > 0);
      if (!hasStocked) {
        setStockViewFilter('all');
      }
    } catch (err: any) {
      console.warn('Load materials error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && workshopId) {
      loadData();
    }
  }, [workshopId, isOpen]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('خيوط');
    setFormQuantity(10);
    setFormMinThreshold(5);
    setFormCostPrice(150);
    setFormUnit(units[0]?.name || 'كيلو');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category || 'خيوط');
    setFormQuantity(item.quantity);
    setFormMinThreshold(item.minThreshold);
    setFormCostPrice(item.costPrice);
    setFormUnit(item.unit || 'كيلو');
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setNotice({ text: 'يرجى كتابة اسم الخامة', isError: true });
      return;
    }

    setSaving(true);
    try {
      const availableUnits = units.length > 0 ? units : await ensureDefaultUnitsInSupabase(workshopId);
      const unitObj = availableUnits.find((u) => u.name === formUnit) || availableUnits[0];
      const unitId = unitObj?.id;
      if (!unitId) {
        setNotice({ text: 'تعذر تحديد وحدة قياس صالحة.', isError: true });
        setSaving(false);
        return;
      }

      if (editingItem) {
        // 1. Update in Supabase
        const res = await updateMaterialInSupabase(editingItem.id, workshopId, {
          name: formName.trim(),
          purchase_price: formCostPrice,
          market_name: formCategory,
          unit_id: unitId,
        });
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
          setSaving(false);
          return;
        }

        // 2. Update in Dexie
        await tenantStorage.saveRawMaterial(
          {
            id: editingItem.id,
            tenantId: workshopId,
            workshopId,
            materialName: formName.trim(),
            category: formCategory as any,
            currentStock: formQuantity,
            minAlertThreshold: formMinThreshold,
            costPerUnit: formCostPrice,
            costPerGram: formUnit === 'كيلو' ? formCostPrice / 1000 : formCostPrice,
            unit: formUnit as any,
            unitId,
            isActive: true,
          } as any,
          { skipCloudQueue: true }
        );

        setNotice({ text: `تم تحديث بيانات الخامة "${formName.trim()}" بنجاح!` });
      } else {
        const newId = generateUuid();

        // 1. Create in Supabase (automatically queues offline if network unavailable)
        const res = await createMaterialInSupabase(workshopId, {
          id: newId,
          name: formName.trim(),
          kind: formCategory === 'خيوط' ? 'primary' : 'extra',
          purchase_price: formCostPrice,
          market_name: formCategory,
          unit_id: unitId,
        });
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
          setSaving(false);
          return;
        }

        const savedId = res.data?.id || newId;

        // 2. Create in Dexie
        await tenantStorage.saveRawMaterial(
          {
            id: savedId,
            tenantId: workshopId,
            workshopId,
            materialName: formName.trim(),
            category: formCategory as any,
            currentStock: formQuantity,
            minAlertThreshold: formMinThreshold,
            costPerUnit: formCostPrice,
            costPerGram: formUnit === 'كيلو' ? formCostPrice / 1000 : formCostPrice,
            unit: formUnit as any,
            unitId,
            isActive: true,
          } as any,
          { skipCloudQueue: true }
        );

        setNotice({ text: `تم إضافة الخامة الجديدة "${formName.trim()}" إلى مخزن الخامات!` });
      }

      setIsFormOpen(false);
      window.dispatchEvent(new CustomEvent('alshams_materials_changed'));
      await loadData();
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setNotice({ text: err.message || 'حدث خطأ أثناء حفظ الخامة', isError: true });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!window.confirm(`هل أنت متأكد من حذف الخامة "${item.name}" من مخزن الخامات؟`)) return;

    try {
      await deleteMaterialFromSupabase(item.id, workshopId);
      await tenantStorage.deactivateRawMaterial(workshopId, item.id, 'حذف من المخزن', profile.email || 'artisan');
      setNotice({ text: `تم حذف الخامة "${item.name}" بنجاح.` });
      await loadData();
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل حذف الخامة', isError: true });
    }
  };

  const handleSaveStockAdjust = async () => {
    if (!adjustingItem) return;
    try {
      await tenantStorage.adjustMaterialStock(workshopId, adjustingItem.id, adjustNewStock, 'تعديل سريع للمخزون');
      setNotice({ text: `تم تحديث رصيد "${adjustingItem.name}" إلى ${adjustNewStock} ${adjustingItem.unit}` });
      setAdjustingItem(null);
      await loadData();
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل تعديل الرصيد', isError: true });
    }
  };

  const stockedCount = useMemo(
    () => materials.filter((m) => m.warehouseTracked || Number(m.quantity) > 0).length,
    [materials]
  );

  const lowStockCount = useMemo(
    () => materials.filter((m) => Boolean(m.isLowStock)).length,
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return materials.filter((m) => {
      const isTracked = m.warehouseTracked || Number(m.quantity) > 0;
      if (stockViewFilter === 'stocked' && !isTracked) return false;
      if (stockViewFilter === 'low' && !m.isLowStock) return false;
      const matchCat = selectedCategoryFilter === 'all' || m.category === selectedCategoryFilter;
      const matName = String(m.name || '').toLowerCase();
      const matCat = String(m.category || '').toLowerCase();
      const matchSearch = !q || matName.includes(q) || matCat.includes(q);
      return matchCat && matchSearch;
    });
  }, [materials, selectedCategoryFilter, searchQuery, stockViewFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-900/50 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">
                {isCraft ? 'جرد أرصدة الخامات' : 'مخزن الخامات وأرصدة الأصول'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                <span className="font-mono tabular-nums font-bold">{stockedCount}</span> خامة لها رصيد بالمخزن
                {' · '}
                <span className="font-mono tabular-nums">{materials.length}</span> إجمالي خاماتك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Plus size={15} />
              <span>خامة جديدة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center justify-center transition cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Notice alert */}
        {notice && (
          <div className={`mx-4 mt-3 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} />
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
              aria-label="إغلاق الرسالة"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Search & Stock View Filter Toolbar */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 space-y-2.5 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-200/70 dark:bg-stone-800">
              <button
                type="button"
                onClick={() => setStockViewFilter('stocked')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  stockViewFilter === 'stocked'
                    ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                المتوفر بالمخزن ({stockedCount})
              </button>
              <button
                type="button"
                onClick={() => setStockViewFilter('low')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  stockViewFilter === 'low'
                    ? 'bg-white dark:bg-stone-900 text-rose-700 dark:text-rose-300 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                النواقص ({lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setStockViewFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  stockViewFilter === 'all'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                كل خاماتي ({materials.length})
              </button>
            </div>

            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو التصنيف..."
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
              }`}
            >
              الكل
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-amber-600 text-white'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Materials Table & List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-16 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>جاري تحميل بيانات مخزن الخامات...</span>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="py-16 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
              <Layers size={36} className="text-stone-300 dark:text-stone-600" />
              <span>لا توجد خامات مطابقة للبحث أو التصنيف.</span>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="mt-2 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer"
              >
                إضافة خامة جديدة الآن
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-bold bg-stone-50 dark:bg-stone-850">
                    <th className="py-2.5 px-3 rounded-r-xl">الخامة</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    <th className="py-2.5 px-3">الكمية الحالية</th>
                    <th className="py-2.5 px-3">حد الطلب الأدنى</th>
                    <th className="py-2.5 px-3">سعر التكلفة</th>
                    <th className="py-2.5 px-3">وحدة القياس</th>
                    <th className="py-2.5 px-3 text-center rounded-l-xl">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredMaterials.map((item) => {
                    const isTracked = item.warehouseTracked || Number(item.quantity) > 0;
                    const isLow = Boolean(item.isLowStock);
                    return (
                      <tr key={item.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors">
                        <td className="py-3 px-3 font-black text-stone-900 dark:text-stone-100">
                          {item.name}
                        </td>
                        <td className="py-3 px-3 text-stone-500 dark:text-stone-400 text-[11px]">
                          {item.category}
                        </td>
                        <td className="py-3 px-3">
                          <div className="min-w-[150px] space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`font-mono tabular-nums font-black text-xs ${
                                  isLow
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : isTracked
                                    ? 'text-stone-900 dark:text-stone-100'
                                    : 'text-stone-400'
                                }`}
                              >
                                {item.quantity} {item.unit}
                              </span>
                              {!isTracked ? (
                                <span className="text-[10px] font-medium text-stone-400">
                                  بدون رصيد بعد
                                </span>
                              ) : isLow ? (
                                <>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                    <AlertTriangle size={11} />
                                    <span>قربت تخلص</span>
                                  </span>
                                  {onOpenPurchaseForMaterial && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenPurchaseForMaterial(item)}
                                      className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1"
                                      title="طلب شراء وتوريد"
                                    >
                                      <PackagePlus size={11} />
                                      <span>شراء</span>
                                    </button>
                                  )}
                                </>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustingItem(item);
                                  setAdjustNewStock(item.quantity);
                                }}
                                className="p-1 rounded-md text-stone-400 hover:text-amber-600 transition cursor-pointer"
                                title={isTracked ? 'تعديل الرصيد' : 'تسجيل رصيد بداية'}
                              >
                                <SlidersHorizontal size={13} />
                              </button>
                            </div>
                            {isTracked && Number(item.minThreshold) > 0 && (
                              <StockLevelProgressBar
                                currentStock={Number(item.quantity) || 0}
                                minThreshold={Number(item.minThreshold) || 1}
                                unitName={item.unit}
                                size="sm"
                                showLabels={false}
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                          {Number(item.minThreshold) > 0 ? `${item.minThreshold} ${item.unit}` : '—'}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                          {Number(item.costPrice).toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="py-3 px-3 text-stone-600 dark:text-stone-300">
                          {item.unit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
                              title="تعديل الخامة"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                              title="حذف الخامة"
                            >
                              <Trash2 size={13} />
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

        {/* Footer Summary */}
        <footer className="p-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 flex flex-wrap items-center justify-between text-xs text-stone-600 dark:text-stone-300 gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span>المعروض: <strong className="font-mono tabular-nums">{filteredMaterials.length}</strong></span>
            <span>النواقص الفعلية: <strong className="font-mono tabular-nums text-rose-600">{lowStockCount}</strong></span>
            <span>
              قيمة المخزون: <strong className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {Math.round(filteredMaterials.reduce((acc, m) => acc + (Number(m.quantity) * Number(m.costPrice)), 0)).toLocaleString('ar-EG')} {currencySymbol}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </footer>
      </div>

      {/* Add / Edit Material Sub-Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-800 rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                {editingItem ? 'تعديل بيانات الخامة' : 'إضافة خامة جديدة لمخزن الخامات'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                  اسم الخامة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: خيط قطن مجدول 4 ملم، شاسيه خشب..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                    التصنيف
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                    وحدة القياس
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-bold"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                    {!units.some((u) => u.name === 'كيلو') && <option value="كيلو">كيلو</option>}
                    {!units.some((u) => u.name === 'متر') && <option value="متر">متر</option>}
                    {!units.some((u) => u.name === 'قطعة') && <option value="قطعة">قطعة</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                    الكمية المتاحة
                  </label>
                  <NumberInput
                    value={formQuantity}
                    onChange={(val) => setFormQuantity(Number(val) || 0)}
                    min={0}
                    step="0.1"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                    حد الطلب الأدنى
                  </label>
                  <NumberInput
                    value={formMinThreshold}
                    onChange={(val) => setFormMinThreshold(Number(val) || 0)}
                    min={0}
                    step="0.1"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                    سعر التكلفة ({currencySymbol})
                  </label>
                  <NumberInput
                    value={formCostPrice}
                    onChange={(val) => setFormCostPrice(Number(val) || 0)}
                    min={0}
                    step="1"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-md"
                >
                  {saving ? 'جاري الحفظ...' : editingItem ? 'تحديث الخامة' : 'حفظ الخامة بالمخزن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Adjust Stock Sub-Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-3.5 text-xs">
            <h4 className="font-black text-sm text-stone-900 dark:text-stone-100">
              تسوية جردية لخامة: {adjustingItem.name}
            </h4>
            <p className="text-stone-500">
              أدخل الرصيد الفعلي المتواجد حالياً في مخزن الورشة ({adjustingItem.unit}):
            </p>
            <NumberInput
              value={adjustNewStock}
              onChange={(v) => setAdjustNewStock(Number(v) || 0)}
              min={0}
              step="0.1"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono font-bold text-sm"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveStockAdjust}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer"
              >
                تأكيد الرصيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
