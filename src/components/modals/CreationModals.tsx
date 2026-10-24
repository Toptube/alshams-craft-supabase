import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  RawMaterialItem,
  CustomerProfile,
  SupplierProfile,
  SupplierPurchaseInvoice,
  EmployeeProfile,
  EmployeeTier,
  EmployeePaymentType,
  SafeType,
  PaymentMethod,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  SupabaseMaterial,
  SupabaseUnit,
  SupabaseSupplier,
  createMaterialInSupabase,
  getUnitsFromSupabase,
  ensureDefaultUnitsInSupabase,
  createUnitInSupabase,
  updateUnitInSupabase,
  deleteUnitFromSupabase,
  getSuppliersFromSupabase,
  createSupplierInSupabase,
} from '../../db/supabaseService';
import { NumberInput } from '../ui/NumberInput';
import {
  X,
  PackagePlus,
  UserPlus,
  Truck,
  Users2,
  CheckCircle,
  Building,
  DollarSign,
  Printer,
  FileText,
  Receipt,
  Plus,
  Scale,
  ChevronDown,
  AlertTriangle,
  Edit2,
  Trash2,
} from 'lucide-react';

// 1. RAW MATERIAL MODAL (SUPABASE CONNECTED)
export const NewMaterialModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSuccess: () => void;
}> = ({ isOpen, onClose, profile, onSuccess }) => {
  if (!isOpen) return null;

  const workshopId = profile.workshopId || profile.tenantId || profile.id;

  const [name, setName] = useState('');
  const [kind, setKind] = useState<'primary' | 'extra'>('primary');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [marketName, setMarketName] = useState('');
  const [marketUnitFactor, setMarketUnitFactor] = useState<number>(1);

  // Suppliers
  const [suppliers, setSuppliers] = useState<SupabaseSupplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

  // Inline Quick Supplier
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierAddress, setQuickSupplierAddress] = useState('');
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);

  // Units
  const [units, setUnits] = useState<SupabaseUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');

  // Inline Quick Unit
  const [isQuickUnitOpen, setIsQuickUnitOpen] = useState(false);
  const [quickUnitName, setQuickUnitName] = useState('');
  const [quickSubUnit, setQuickSubUnit] = useState('');
  const [quickConversionFactor, setQuickConversionFactor] = useState<number>(1000);
  const [savingQuickUnit, setSavingQuickUnit] = useState(false);

  // Unit Manager Modal
  const [isUnitsManagerOpen, setIsUnitsManagerOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<SupabaseUnit | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!workshopId) return;
      try {
        const [unts, supsRes] = await Promise.all([
          ensureDefaultUnitsInSupabase(workshopId),
          getSuppliersFromSupabase(workshopId),
        ]);
        setUnits(unts);
        setSuppliers(supsRes.data || []);
        if (unts.length > 0) {
          setSelectedUnitId(unts[0].id);
        }
      } catch (err) {
        console.error('Error loading in NewMaterialModal:', err);
      }
    }
    loadData();
  }, [workshopId]);

  const selectedUnit = useMemo(() => {
    return units.find((u) => u.id === selectedUnitId) || units[0] || null;
  }, [units, selectedUnitId]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(supplierSearch))
    );
  }, [suppliers, supplierSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('يرجى إدخال اسم الخامة.');
      return;
    }
    if (!selectedUnitId) {
      setErrorMessage('يرجى اختيار وحدة قياس صالحة.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const payload = {
        name: name.trim(),
        kind,
        supplier_id: selectedSupplierId || null,
        unit_id: selectedUnitId,
        purchase_price: Number(purchasePrice) >= 0 ? Number(purchasePrice) : 0,
        market_name: marketName.trim() ? marketName.trim() : null,
        market_unit_factor: marketName.trim()
          ? Number(marketUnitFactor) > 0
            ? Number(marketUnitFactor)
            : 1
          : 1,
      };

      const res = await createMaterialInSupabase(workshopId, payload);
      if (res.error) {
        setErrorMessage(res.error.arabicMessage);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر حفظ الخامة.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) return;
    setSavingQuickSupplier(true);
    try {
      const res = await createSupplierInSupabase(workshopId, {
        name: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim() || undefined,
        address: quickSupplierAddress.trim() || undefined,
      });
      if (res.error) {
        setErrorMessage(res.error.arabicMessage);
        return;
      }
      if (res.data) {
        setSuppliers((prev) => [...prev, res.data!]);
        setSelectedSupplierId(res.data.id);
        setSelectedSupplierName(res.data.name);
        setIsQuickSupplierOpen(false);
        setQuickSupplierName('');
        setQuickSupplierPhone('');
        setQuickSupplierAddress('');
      }
    } finally {
      setSavingQuickSupplier(false);
    }
  };

  const handleCreateQuickUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUnitName.trim() || !quickSubUnit.trim()) return;
    setSavingQuickUnit(true);
    try {
      const res = await createUnitInSupabase(workshopId, {
        name: quickUnitName.trim(),
        small_unit: quickSubUnit.trim(),
        factor: Number(quickConversionFactor) > 0 ? Number(quickConversionFactor) : 1,
      });
      if (res.error) {
        setErrorMessage(res.error.arabicMessage);
        return;
      }
      if (res.data) {
        setUnits((prev) => [...prev, res.data!]);
        setSelectedUnitId(res.data.id);
        setIsQuickUnitOpen(false);
        setQuickUnitName('');
        setQuickSubUnit('');
        setQuickConversionFactor(1000);
      }
    } finally {
      setSavingQuickUnit(false);
    }
  };

  const handleSaveUnitManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUnitName.trim() || !quickSubUnit.trim()) return;
    setSavingQuickUnit(true);
    try {
      if (editingUnit) {
        const res = await updateUnitInSupabase(editingUnit.id, workshopId, {
          name: quickUnitName.trim(),
          small_unit: quickSubUnit.trim(),
          factor: Number(quickConversionFactor) > 0 ? Number(quickConversionFactor) : 1,
        });
        if (res.error) {
          setErrorMessage(res.error.arabicMessage);
          return;
        }
      } else {
        const res = await createUnitInSupabase(workshopId, {
          name: quickUnitName.trim(),
          small_unit: quickSubUnit.trim(),
          factor: Number(quickConversionFactor) > 0 ? Number(quickConversionFactor) : 1,
        });
        if (res.error) {
          setErrorMessage(res.error.arabicMessage);
          return;
        }
      }
      const unts = await getUnitsFromSupabase(workshopId);
      setUnits(unts.data || []);
      setEditingUnit(null);
      setQuickUnitName('');
      setQuickSubUnit('');
      setQuickConversionFactor(1000);
    } finally {
      setSavingQuickUnit(false);
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      const res = await deleteUnitFromSupabase(unitId, workshopId);
      if (res.error) {
        setErrorMessage(res.error.arabicMessage);
      } else {
        setUnits((prev) => prev.filter((u) => u.id !== unitId));
      }
    } catch (err: any) {
      setErrorMessage('تعذر حذف وحدة القياس.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-lg max-h-[92vh] overflow-y-auto space-y-4 text-right shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-5 h-5" />
          </button>
          <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            <PackagePlus className="w-4 h-4 text-amber-600" />
            <span>تعريف خامة جديدة في قاعدة البيانات (materials)</span>
          </h3>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs font-bold border border-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold mb-1">اسم الخامة *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: خيط قطن مجدول 4 مم، حلقة خشبية، ريزن إيبوكسي"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">التصنيف *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('primary')}
                className={`p-2.5 rounded-xl border text-right transition cursor-pointer text-xs font-bold ${
                  kind === 'primary'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600'
                }`}
              >
                خامة أساسية (primary)
              </button>
              <button
                type="button"
                onClick={() => setKind('extra')}
                className={`p-2.5 rounded-xl border text-right transition cursor-pointer text-xs font-bold ${
                  kind === 'extra'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600'
                }`}
              >
                خامة إضافية (extra)
              </button>
            </div>
          </div>

          {/* Supplier dropdown with search and + button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => setIsQuickSupplierOpen(true)}
                className="text-amber-600 dark:text-amber-400 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مورد</span>
              </button>
              <label className="text-xs font-bold">المورد</label>
            </div>

            <div className="relative">
              <div
                onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs flex items-center justify-between cursor-pointer"
              >
                <ChevronDown className="w-4 h-4 text-stone-400" />
                <span className="font-bold">
                  {selectedSupplierName || 'اختر المورد أو ابحث...'}
                </span>
              </div>

              {isSupplierDropdownOpen && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 p-2 space-y-1">
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="ابحث في الموردين..."
                    className="w-full px-2.5 py-1 rounded-xl border text-xs outline-none"
                    autoFocus
                  />
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    <div
                      onClick={() => {
                        setSelectedSupplierId('');
                        setSelectedSupplierName('');
                        setIsSupplierDropdownOpen(false);
                      }}
                      className="p-1.5 text-xs text-stone-400 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg"
                    >
                      بدون مورد محدد
                    </div>
                    {filteredSuppliers.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedSupplierId(s.id);
                          setSelectedSupplierName(s.name);
                          setIsSupplierDropdownOpen(false);
                        }}
                        className={`p-1.5 text-xs cursor-pointer flex justify-between rounded-lg ${
                          selectedSupplierId === s.id ? 'bg-amber-100 dark:bg-amber-950 font-bold' : ''
                        }`}
                      >
                        <span className="text-[10px] text-stone-400 font-mono">{s.phone || ''}</span>
                        <span>{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Units & Purchase Price */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsUnitsManagerOpen(true)}
                    className="text-stone-500 hover:text-stone-700 text-[10px] font-bold"
                    title="إدارة الوحدات (تعديل/حذف)"
                  >
                    إدارة
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQuickUnitOpen(true)}
                    className="text-amber-600 text-xs font-bold inline-flex items-center"
                    title="إضافة وحدة جديدة"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <label className="text-xs font-bold">وحدة القياس *</label>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="flex-1 px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>

                {selectedUnit && selectedUnit.small_unit && (
                  <span className="text-[10px] px-2 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-800 dark:text-amber-300 font-bold whitespace-nowrap">
                    {selectedUnit.small_unit}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">سعر الشراء ({profile.currencySymbol}) *</label>
              <NumberInput
                required
                value={purchasePrice}
                onChange={setPurchasePrice}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold text-center"
              />
            </div>
          </div>

          {/* Market Name & market_unit_factor */}
          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-2">
            <div>
              <label className="block text-xs font-bold mb-1">
                الاسم بالسوق <span className="text-stone-400 font-normal">(اختياري، مثل شلة أو بكرة)</span>
              </label>
              <input
                type="text"
                value={marketName}
                onChange={(e) => setMarketName(e.target.value)}
                placeholder="مثال: شلة، بكرة، كرتونة"
                className="w-full px-3 py-1.5 rounded-xl border text-xs font-bold bg-white dark:bg-stone-900"
              />
            </div>

            {marketName.trim() && (
              <div className="animate-in fade-in space-y-1">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-300">
                  الواحدة منها ({marketName}) تساوي كم من ({selectedUnit?.small_unit || selectedUnit?.name || 'الوحدة الصغرى'})؟ *
                </label>
                <div className="relative">
                  <NumberInput
                    value={marketUnitFactor}
                    onChange={setMarketUnitFactor}
                    placeholder="200"
                    className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white dark:bg-stone-900 text-xs font-mono font-bold"
                  />
                  <span className="absolute left-3 top-1.5 text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                    {selectedUnit?.small_unit || selectedUnit?.name || ''}
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 block mt-0.5">
                  فمثلاً لو كان الاسم بالسوق شلة، والوحدة المختارة كيلو، فاكتب هنا 200 لتسجل 200 {selectedUnit?.small_unit || 'جرام'}.
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-stone-500">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ الخامة'}
            </button>
          </div>
        </form>

        {/* Quick Add Supplier Modal */}
        {isQuickSupplierOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <form
              onSubmit={handleCreateQuickSupplier}
              className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-xs p-4 text-right space-y-3 border"
            >
              <div className="flex justify-between items-center border-b pb-2">
                <button type="button" onClick={() => setIsQuickSupplierOpen(false)}>
                  <X className="w-4 h-4 text-stone-400" />
                </button>
                <span className="text-xs font-bold">إضافة مورد جديد</span>
              </div>
              <input
                type="text"
                required
                value={quickSupplierName}
                onChange={(e) => setQuickSupplierName(e.target.value)}
                placeholder="اسم المورد *"
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                autoFocus
              />
              <input
                type="tel"
                value={quickSupplierPhone}
                onChange={(e) => setQuickSupplierPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono"
              />
              <div className="flex justify-end gap-2 pt-1 border-t">
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierOpen(false)}
                  className="px-3 py-1 text-xs text-stone-400"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingQuickSupplier}
                  className="px-3 py-1 text-xs bg-amber-600 text-white rounded-lg font-bold"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quick Add Unit Modal */}
        {isQuickUnitOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <form
              onSubmit={handleCreateQuickUnit}
              className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-xs p-4 text-right space-y-3 border"
            >
              <div className="flex justify-between items-center border-b pb-2">
                <button type="button" onClick={() => setIsQuickUnitOpen(false)}>
                  <X className="w-4 h-4 text-stone-400" />
                </button>
                <span className="text-xs font-bold">إضافة وحدة قياس</span>
              </div>
              <input
                type="text"
                required
                value={quickUnitName}
                onChange={(e) => setQuickUnitName(e.target.value)}
                placeholder="الوحدة الكبرى (مثل: ياردة) *"
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                autoFocus
              />
              <input
                type="text"
                required
                value={quickSubUnit}
                onChange={(e) => setQuickSubUnit(e.target.value)}
                placeholder="الوحدة الصغرى (مثل: سم) *"
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
              />
              <NumberInput
                required
                value={quickConversionFactor}
                onChange={setQuickConversionFactor}
                placeholder="معامل التحويل (مثلاً 100)"
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono"
              />
              <div className="flex justify-end gap-2 pt-1 border-t">
                <button
                  type="button"
                  onClick={() => setIsQuickUnitOpen(false)}
                  className="px-3 py-1 text-xs text-stone-400"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingQuickUnit}
                  className="px-3 py-1 text-xs bg-amber-600 text-white rounded-lg font-bold"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Units Manager Modal */}
        {isUnitsManagerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-md p-4 text-right space-y-3 border max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnitsManagerOpen(false);
                    setEditingUnit(null);
                  }}
                >
                  <X className="w-4 h-4 text-stone-400" />
                </button>
                <span className="text-xs font-bold">إدارة وحدات القياس (units)</span>
              </div>

              {/* Form add/edit */}
              <form onSubmit={handleSaveUnitManager} className="p-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl space-y-2 border">
                <span className="text-[11px] font-bold block text-amber-700">
                  {editingUnit ? `تعديل: ${editingUnit.name}` : '+ إضافة وحدة قياس'}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="text"
                    required
                    value={quickUnitName}
                    onChange={(e) => setQuickUnitName(e.target.value)}
                    placeholder="الكبرى"
                    className="px-2 py-1 text-xs rounded border bg-white dark:bg-stone-900"
                  />
                  <input
                    type="text"
                    required
                    value={quickSubUnit}
                    onChange={(e) => setQuickSubUnit(e.target.value)}
                    placeholder="الصغرى"
                    className="px-2 py-1 text-xs rounded border bg-white dark:bg-stone-900"
                  />
                  <NumberInput
                    required
                    value={quickConversionFactor}
                    onChange={setQuickConversionFactor}
                    placeholder="المعامل"
                    className="px-2 py-1 text-xs rounded border font-mono bg-white dark:bg-stone-900"
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  {editingUnit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUnit(null);
                        setQuickUnitName('');
                        setQuickSubUnit('');
                        setQuickConversionFactor(1000);
                      }}
                      className="px-2 py-0.5 text-xs text-stone-400"
                    >
                      إلغاء
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingQuickUnit}
                    className="px-3 py-1 text-xs bg-amber-600 text-white rounded font-bold"
                  >
                    {editingUnit ? 'تحديث' : 'حفظ'}
                  </button>
                </div>
              </form>

              {/* List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {units.map((u) => (
                  <div key={u.id} className="p-2 bg-stone-50 dark:bg-stone-800 rounded-xl flex justify-between items-center text-xs border">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUnit(u);
                          setQuickUnitName(u.name);
                          setQuickSubUnit(u.small_unit);
                          setQuickConversionFactor(u.factor);
                        }}
                        className="p-1 text-stone-400 hover:text-amber-600"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(u.id)}
                        className="p-1 text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <span className="font-bold">{u.name}</span>
                      <span className="text-[10px] text-stone-400 font-mono mr-2">
                        (= {u.factor} {u.small_unit})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// 2. CLIENT PROFILE MODAL
export const NewClientModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSuccess: () => void;
}> = ({ isOpen, onClose, profile, onSuccess }) => {
  if (!isOpen) return null;

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('القاهرة');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const newClient: CustomerProfile = {
      id: 'cust_' + Date.now(),
      tenantId: profile.tenantId,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim() || '01000000000',
      city: city.trim(),
      totalPurchases: 0,
      outstandingBalance: 0,
      notes: notes.trim(),
      createdAt: Date.now(),
    };

    await tenantStorage.saveCustomer(newClient);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-emerald-300 dark:border-stone-700 w-full max-w-md space-y-3 text-right"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
          <h3 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>تسجيل عميل جديد بالدفتر [زر عميل]</span>
          </h3>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">اسم العميل بالكامل *</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="الاسم الكريم أو اسم المعرض"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">رقم الهاتف *</label>
          <input
            type="tel"
            required
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="01012345678"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-left"
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">المدينة / المحافظة</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">ملاحظات العميل الخاصة</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: يفضل ألوان بيج وبوهيمي، طلبيات ديكور فنادق"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-stone-500">
            إلغاء
          </button>
          <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer">
            حفظ العميل
          </button>
        </div>
      </form>
    </div>
  );
};

// 3. SUPPLIER PROFILE & PURCHASE INVOICE MODAL
export const NewSupplierModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSuccess: () => void;
  initialMode?: 'create_supplier' | 'record_invoice' | 'statement';
  lockMode?: boolean;
}> = ({ isOpen, onClose, profile, onSuccess, initialMode = 'create_supplier', lockMode = false }) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'create_supplier' | 'record_invoice' | 'statement'>(initialMode);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Supplier profile fields
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Invoice fields
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [suppliersList, setSuppliersList] = useState<SupplierProfile[]>([]);
  const [invoicesList, setInvoicesList] = useState<SupplierPurchaseInvoice[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('INV-' + Math.floor(1000 + Math.random() * 9000));
  const [rawMaterialsList, setRawMaterialsList] = useState<RawMaterialItem[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [unitCost, setUnitCost] = useState(180);
  const [paidAmount, setPaidAmount] = useState(1800);
  const [safeType, setSafeType] = useState<SafeType>('main');
  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

  React.useEffect(() => {
    tenantStorage.getSuppliers(tenantId).then((sups) => {
      setSuppliersList(sups);
      if (sups.length > 0) setSelectedSupplierId(sups[0].id);
    });
    tenantStorage.getRawMaterials(tenantId).then((mats) => {
      setRawMaterialsList(mats);
      if (mats.length > 0) setSelectedMaterialId(mats[0].id);
    });
    tenantStorage.getSupplierInvoices(tenantId).then(setInvoicesList);
  }, [tenantId]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newSup: SupplierProfile = {
      id: 'sup_' + Date.now(),
      tenantId: profile.tenantId,
      name: name.trim(),
      companyName: companyName.trim() || 'مغزل / متجر خامات',
      phoneNumber: phone.trim() || '01000000000',
      address: address.trim(),
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      createdAt: Date.now(),
    };

    await tenantStorage.saveSupplier(newSup);
    onSuccess();
    onClose();
  };

  const handleRecordInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !selectedMaterialId) return;

    const sup = suppliersList.find((s) => s.id === selectedSupplierId);
    const mat = rawMaterialsList.find((m) => m.id === selectedMaterialId);
    if (!sup || !mat) return;

    const total = quantity * unitCost;
    const remaining = Math.max(0, total - paidAmount);

    const invoice: SupplierPurchaseInvoice = {
      id: 'sinv_' + Date.now(),
      tenantId: profile.tenantId || profile.workshopId || profile.id || '',
      supplierId: sup.id,
      supplierName: sup.name || sup.companyName || 'مورد خامات',
      invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      items: [
        {
          materialId: mat.id,
          materialName: mat.materialName,
          quantity,
          unit: mat.unit,
          unitCost,
          totalCost: total,
        },
      ],
      totalAmount: total,
      paidAmount,
      remainingAmount: remaining,
      safeType,
      paymentMethod: 'cash',
      createdAt: Date.now(),
    };

    await tenantStorage.recordSupplierPurchaseInvoice(invoice);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-blue-300 dark:border-stone-700 w-full max-w-lg space-y-4 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
          {lockMode ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-blue-800 dark:text-blue-300">
                {mode === 'create_supplier'
                  ? 'تسجيل مورد جديد'
                  : mode === 'record_invoice'
                  ? 'إنشاء فاتورة مشتريات مورد'
                  : 'كشف حساب مورد'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode('create_supplier')}
                className={`px-3 py-1 rounded-lg transition ${
                  mode === 'create_supplier' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-500'
                }`}
              >
                تعريف مورد جديد
              </button>
              <button
                type="button"
                onClick={() => setMode('record_invoice')}
                className={`px-3 py-1 rounded-lg transition ${
                  mode === 'record_invoice' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-500'
                }`}
              >
                إثبات فاتورة مشتريات
              </button>
              <button
                type="button"
                onClick={() => setMode('statement')}
                className={`px-3 py-1 rounded-lg transition ${
                  mode === 'statement' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-500'
                }`}
              >
                كشف حساب مورد (طباعة)
              </button>
            </div>
          )}
        </div>

        {mode === 'create_supplier' ? (
          <form onSubmit={handleCreateSupplier} className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">اسم المورد / التاجر *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم المسؤول أو المورد"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">اسم الشركة / المغزل</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="مثال: مغزل المحلة الكبرى"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01000000000"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">العنوان / المحافظة</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="المدينة"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-stone-500">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer">
                حفظ المورد
              </button>
            </div>
          </form>
        ) : mode === 'record_invoice' ? (
          <form onSubmit={handleRecordInvoice} className="space-y-3">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[11px] text-blue-900 dark:text-blue-200">
              💡 إثبات فاتورة المشتريات يحدث رصيد المخزن تلقائياً، ويعيد معايرة سعر تكلفة الجرام في حاسبة التكاليف.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1">المورد *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  {suppliersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.companyName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">الخامة المشتراة *</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  {rawMaterialsList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.materialName} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1">الكمية المشتراة *</label>
                <NumberInput
                  required
                  value={quantity}
                  onChange={setQuantity}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">سعر شراء الوحدة الجديد ({profile.currencySymbol}) *</label>
                <NumberInput
                  required
                  value={unitCost}
                  onChange={setUnitCost}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1">المبلغ المسدد الآن</label>
                <NumberInput
                  value={paidAmount}
                  onChange={setPaidAmount}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">الخزينة المسحوب منها السداد</label>
                <select
                  value={safeType}
                  onChange={(e) => setSafeType(e.target.value as SafeType)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="main">الخزينة الرئيسية</option>
                  <option value="sub">الخزينة الفرعية</option>
                </select>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs flex justify-between font-mono font-bold">
              <span>إجمالي الفاتورة: {quantity * unitCost} {profile.currencySymbol}</span>
              <span className="text-rose-600">الآجل المعلق: {Math.max(0, quantity * unitCost - paidAmount)} {profile.currencySymbol}</span>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-stone-500">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer">
                اعتماد وتحديث المخزن والخزينة
              </button>
            </div>
          </form>
        ) : (
          /* SUPPLIER STATEMENT & PRINTABLE SHEET */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold mb-1">اختر المورد لعرض كشف الحساب والآجلة:</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  {suppliersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة كشف الحساب</span>
              </button>
            </div>

            {(() => {
              const currentSupplier = suppliersList.find((s) => s.id === selectedSupplierId);
              const relatedInvoices = invoicesList.filter((inv) => inv.supplierId === selectedSupplierId);

              if (!currentSupplier) {
                return <p className="text-xs text-stone-500 text-center py-4">يرجى اختيار مورد</p>;
              }

              return (
                <div className="space-y-3">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                      <span className="text-[10px] text-blue-700 dark:text-blue-300 block font-bold">إجمالي المشتريات</span>
                      <span className="text-sm font-black font-mono text-blue-900 dark:text-blue-100">
                        {currentSupplier.totalPurchases} {profile.currencySymbol}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-bold">الدفعات المسددة</span>
                      <span className="text-sm font-black font-mono text-emerald-900 dark:text-emerald-100">
                        {currentSupplier.totalPaid} {profile.currencySymbol}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                      <span className="text-[10px] text-rose-700 dark:text-rose-300 block font-bold">الآجلة المستحقة</span>
                      <span className="text-sm font-black font-mono text-rose-900 dark:text-rose-100">
                        {currentSupplier.outstandingBalance} {profile.currencySymbol}
                      </span>
                    </div>
                  </div>

                  {/* Transaction Logs Table */}
                  <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold">
                        <tr>
                          <th className="p-2">التاريخ</th>
                          <th className="p-2">رقم الفاتورة</th>
                          <th className="p-2">الخامات</th>
                          <th className="p-2">القيمة</th>
                          <th className="p-2">المسدد</th>
                          <th className="p-2">المتبقي الآجل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
                        {relatedInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-stone-400 font-sans">
                              لا توجد فواتير توريد مسجلة لهذا المورد حتى الآن
                            </td>
                          </tr>
                        ) : (
                          relatedInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                              <td className="p-2 text-stone-500 font-sans">{inv.date}</td>
                              <td className="p-2 font-bold">{inv.invoiceNumber}</td>
                              <td className="p-2 font-sans">
                                {inv.items.map((it) => `${it.materialName} (${it.quantity} ${it.unit})`).join('، ')}
                              </td>
                              <td className="p-2 font-bold">{inv.totalAmount}</td>
                              <td className="p-2 text-emerald-600 font-bold">{inv.paidAmount}</td>
                              <td className="p-2 text-rose-600 font-bold">{inv.remainingAmount}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 flex justify-end gap-2 border-t">
              <button type="button" onClick={onClose} className="px-5 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded-xl cursor-pointer">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 4. EMPLOYEE / ARTISAN PROFILE MODAL
export const NewEmployeeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSuccess: () => void;
}> = ({ isOpen, onClose, profile, onSuccess }) => {
  if (!isOpen) return null;

  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('حياكة مكرمية وجداريات');
  const [tier, setTier] = useState<EmployeeTier>('خبير');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentType, setPaymentType] = useState<EmployeePaymentType>('piece_rate');
  const [baseSalary, setBaseSalary] = useState(3000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const newEmp: EmployeeProfile = {
      id: 'emp_' + Date.now(),
      tenantId: profile.tenantId,
      fullName: fullName.trim(),
      specialty: specialty.trim(),
      tier,
      phoneNumber: phoneNumber.trim() || '01000000000',
      paymentType,
      pieceRatePercentage: 100,
      baseSalary: paymentType === 'fixed_salary' ? baseSalary : undefined,
      isActive: true,
      totalEarned: 0,
      totalPaid: 0,
      currentBalance: 0,
      createdAt: Date.now(),
    };

    await tenantStorage.saveEmployee(newEmp);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-purple-300 dark:border-stone-700 w-full max-w-md space-y-3 text-right"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
          <h3 className="font-extrabold text-sm text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
            <Users2 className="w-4 h-4 text-purple-600" />
            <span>تعيين فنان / موظف وتحديد الكادر [زر موظف]</span>
          </h3>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">اسم الفنان / الموظف *</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="الاسم الكامل"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">التخصص الحرفي بالورشة</label>
          <input
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="مثال: حياكة عقد مكرمية، قص وتجهيز، تغليف"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold mb-1">الكادر الفني والخبرة *</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as EmployeeTier)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
            >
              <option value="مبتدئ">مبتدئ</option>
              <option value="متوسط">متوسط</option>
              <option value="خبير">خبير</option>
              <option value="مدرب">مدرب ومشرف جودة</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">نظام المحاسبة المالي *</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as EmployeePaymentType)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
            >
              <option value="piece_rate">مصنعية بالقطعة المشغولة</option>
              <option value="fixed_salary">راتب شهري ثابت</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">رقم الهاتف *</label>
          <input
            type="tel"
            required
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="01000000000"
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-left"
            dir="ltr"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-stone-500">
            إلغاء
          </button>
          <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer">
            اعتماد التعيين في الكادر
          </button>
        </div>
      </form>
    </div>
  );
};
