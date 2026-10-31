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
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';

interface MaterialsInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

export const MaterialsInventoryModal: React.FC<MaterialsInventoryModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  const currencySymbol = profile.currencySymbol || 'ج.م';

  const [materials, setMaterials] = useState<any[]>([]);
  const [units, setUnits] = useState<SupabaseUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('خيوط');
  const [formQuantity, setFormQuantity] = useState(10);
  const [formMinThreshold, setFormMinThreshold] = useState(5);
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

      // Merge Supabase materials with local stock data
      const dexieMap = new Map<string, any>();
      dexieMats.forEach((m) => {
        if (m.id) dexieMap.set(m.id, m);
        if (m.materialName) dexieMap.set(m.materialName.trim(), m);
      });

      const mergedList: any[] = [];
      const seenNames = new Set<string>();

      // 1. From Supabase
      (sbMats.data || []).forEach((sm) => {
        const local = dexieMap.get(sm.id) || dexieMap.get(sm.name.trim());
        const unitObj = unts.find((u) => u.id === sm.unit_id);
        const unitName = unitObj?.name || local?.unit || 'كيلو';

        seenNames.add(sm.name.trim().toLowerCase());
        mergedList.push({
          id: sm.id,
          name: sm.name,
          category: local?.category || sm.market_name || (sm.kind === 'extra' ? 'إكسسوارات' : 'خيوط'),
          quantity: local?.currentStock !== undefined ? local.currentStock : 10,
          minThreshold: local?.minAlertThreshold !== undefined ? local.minAlertThreshold : 5,
          costPrice: sm.purchase_price || local?.costPerUnit || 0,
          unit: unitName,
          unitId: sm.unit_id,
          source: 'supabase',
        });
      });

      // 2. Add remaining local items if not yet synced
      dexieMats.forEach((dm) => {
        const norm = (dm.materialName || '').trim().toLowerCase();
        if (norm && !seenNames.has(norm)) {
          seenNames.add(norm);
          mergedList.push({
            id: dm.id,
            name: dm.materialName,
            category: dm.category || 'خيوط',
            quantity: dm.currentStock || 0,
            minThreshold: dm.minAlertThreshold || 5,
            costPrice: dm.costPerUnit || 0,
            unit: dm.unit || 'كيلو',
            source: 'dexie',
          });
        }
      });

      setMaterials(mergedList);
    } catch (err: any) {
      console.warn('Load materials error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workshopId]);

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
      const unitObj = units.find((u) => u.name === formUnit) || units[0];
      const unitId = unitObj?.id || 'unit_default';

      if (editingItem) {
        // 1. Update in Supabase
        await updateMaterialInSupabase(editingItem.id, workshopId, {
          name: formName.trim(),
          purchase_price: formCostPrice,
          market_name: formCategory,
          unit_id: unitId,
        });

        // 2. Update in Dexie
        await tenantStorage.saveRawMaterial({
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
          isActive: true,
        });

        setNotice({ text: `تم تحديث بيانات الخامة "${formName.trim()}" بنجاح!` });
      } else {
        const newId = 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        // 1. Create in Supabase
        await createMaterialInSupabase(workshopId, {
          id: newId,
          name: formName.trim(),
          kind: formCategory === 'خيوط' ? 'primary' : 'extra',
          purchase_price: formCostPrice,
          market_name: formCategory,
          unit_id: unitId,
        });

        // 2. Create in Dexie
        await tenantStorage.saveRawMaterial({
          id: newId,
          tenantId: workshopId,
          workshopId,
          materialName: formName.trim(),
          category: formCategory as any,
          currentStock: formQuantity,
          minAlertThreshold: formMinThreshold,
          costPerUnit: formCostPrice,
          costPerGram: formUnit === 'كيلو' ? formCostPrice / 1000 : formCostPrice,
          unit: formUnit as any,
          isActive: true,
        });

        setNotice({ text: `تم إضافة الخامة الجديدة "${formName.trim()}" إلى مخزن الخامات!` });
      }

      setIsFormOpen(false);
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

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchCat = selectedCategoryFilter === 'all' || m.category === selectedCategoryFilter;
      const matchSearch =
        !searchQuery.trim() ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (m.category && m.category.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      return matchCat && matchSearch;
    });
  }, [materials, selectedCategoryFilter, searchQuery]);

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
              <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>مخزن الخامات (Materials Inventory)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  {materials.length} خامة مسجلة
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                إدارة كاملة لجدول الخامات: الاسم، التصنيف، الكمية، حد الطلب الأدنى، سعر التكلفة، ووحدة القياس
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة خامة جديدة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center justify-center transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Notice alert */}
        {notice && (
          <div className={`mx-4 mt-3 p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}>
            <CheckCircle size={16} />
            <span>{notice.text}</span>
          </div>
        )}

        {/* Search & Category Filter Toolbar */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في الخامات بالاسم أو التصنيف..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-stone-900 dark:text-stone-100"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-amber-600 text-white shadow-xs'
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-amber-600 text-white shadow-xs'
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
                    const isLow = Number(item.quantity) <= Number(item.minThreshold);
                    return (
                      <tr key={item.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors">
                        <td className="py-3 px-3 font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>{item.name}</span>
                        </td>
                        <td className="py-3 px-3 text-stone-600 dark:text-stone-300">
                          <span className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] font-bold">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-black text-xs ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'}`}>
                              {item.quantity} {item.unit}
                            </span>
                            {isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 px-1.5 py-0.5 rounded-md">
                                <AlertTriangle size={11} />
                                <span>ناقص</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustingItem(item);
                                setAdjustNewStock(item.quantity);
                              }}
                              className="p-1 rounded-md text-stone-400 hover:text-amber-600 transition cursor-pointer"
                              title="تسوية رصيد المخزون"
                            >
                              <SlidersHorizontal size={13} />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-stone-600 dark:text-stone-400 font-mono">
                          {item.minThreshold} {item.unit}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400 font-mono">
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
          <div className="flex items-center gap-4">
            <span>إجمالي الأصناف: <strong>{filteredMaterials.length}</strong></span>
            <span>النواقص: <strong className="text-rose-600">{filteredMaterials.filter((m) => Number(m.quantity) <= Number(m.minThreshold)).length}</strong></span>
            <span>
              إجمالي قيمة المخزون التقديرية: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
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
