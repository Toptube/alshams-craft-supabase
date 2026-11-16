import React, { useEffect, useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { MainSectionId } from '../../registry/craftsRegistry';
import {
  SupplierCatalogItem,
  SupplierCatalogVariant,
  SUPPLIER_SUPPLY_SECTIONS,
  SUPPLIER_DEFAULT_UNITS,
} from '../../types/supplier';
import {
  fetchSupplierCatalog,
  upsertSupplierCatalogItem,
  deleteSupplierCatalogItem,
} from '../../db/supplierService';
import {
  ArrowRight,
  X,
  Plus,
  Search,
  Edit3,
  Trash2,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  Boxes,
} from 'lucide-react';

import { compressImageFile, MAX_ITEM_IMAGES } from '../../utils/imageCompressor';

interface SupplierCatalogViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
}

export const SupplierCatalogView: React.FC<SupplierCatalogViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
}) => {
  const currencySymbol = profile.currencySymbol || 'ج.م';
  const [items, setItems] = useState<SupplierCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState<'all' | MainSectionId>('all');
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Draft item state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [sectionId, setSectionId] = useState<MainSectionId>('ropes_textiles');
  const [unit, setUnit] = useState('بكرة');
  const [description, setDescription] = useState('');
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [minWholesaleQty, setMinWholesaleQty] = useState<number>(5);
  const [stockQty, setStockQty] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [inStore, setInStore] = useState(true);
  const [inMarket, setInMarket] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<SupplierCatalogVariant[]>([]);

  const loadItems = async () => {
    setLoading(true);
    const data = await fetchSupplierCatalog();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (sectionFilter !== 'all' && item.sectionId !== sectionFilter) return false;
      if (onlyLowStock && Number(item.stockQty) > 5) return false;
      if (q) {
        const hay = `${item.name} ${item.description || ''} ${item.unit}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, sectionFilter, onlyLowStock, search]);

  const openNewModal = () => {
    setEditingId(undefined);
    setName('');
    setSectionId((profile.supplySections?.[0] as MainSectionId) || 'ropes_textiles');
    setUnit('بكرة');
    setDescription('');
    setRetailPrice(0);
    setWholesalePrice(0);
    setMinWholesaleQty(5);
    setStockQty(10);
    setDiscountType('none');
    setDiscountValue(0);
    setInStore(true);
    setInMarket(true);
    setImages([]);
    setVariants([]);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: SupplierCatalogItem) => {
    setEditingId(item.id);
    setName(item.name);
    setSectionId(item.sectionId);
    setUnit(item.unit || 'بكرة');
    setDescription(item.description || '');
    setRetailPrice(Number(item.retailPrice || 0));
    setWholesalePrice(Number(item.wholesalePrice || 0));
    setMinWholesaleQty(Number(item.minWholesaleQty || 1));
    setStockQty(Number(item.stockQty || 0));
    setDiscountType(item.discountType || 'none');
    setDiscountValue(Number(item.discountValue || 0));
    setInStore(item.inStore);
    setInMarket(item.inMarket);
    setImages(Array.isArray(item.images) ? item.images.slice(0, MAX_ITEM_IMAGES) : []);
    setVariants(Array.isArray(item.variants) ? item.variants : []);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const remaining = Math.max(0, MAX_ITEM_IMAGES - images.length);
    const files = Array.from(e.target.files || []).slice(0, remaining);
    if (files.length === 0) return;
    try {
      const encoded = await Promise.all(
        files.map((file) =>
          compressImageFile(file, {
            maxWidth: 800,
            maxHeight: 800,
            targetMaxKb: 95,
            initialQuality: 0.78,
          })
        )
      );
      setImages((prev) => [...prev, ...encoded].slice(0, MAX_ITEM_IMAGES));
    } catch {}
    e.target.value = '';
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        colorOrSize: '',
        thicknessOrSpec: '',
        sku: '',
        stockQty: 0,
      },
    ]);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ text: 'يرجى كتابة اسم الخامة.', isError: true });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const res = await upsertSupplierCatalogItem({
      id: editingId,
      name: name.trim(),
      sectionId,
      unit: unit.trim() || 'قطعة',
      description: description.trim(),
      retailPrice: Number(retailPrice),
      wholesalePrice: Number(wholesalePrice || retailPrice),
      minWholesaleQty: Math.max(1, Number(minWholesaleQty || 1)),
      stockQty: Math.max(0, Number(stockQty || 0)),
      discountType,
      discountValue: Number(discountValue || 0),
      inStore,
      inMarket,
      images,
      variants: variants.filter((v) => v.colorOrSize.trim()),
      sourceCurrency: profile.currency || 'EGP',
    });
    setSaving(false);

    if (!res.success) {
      setFeedback({ text: res.error || 'تعذر حفظ الخامة', isError: true });
      return;
    }

    await loadItems();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteSupplierCatalogItem(id);
    if (ok) {
      setItems((prev) => prev.filter((x) => x.id !== id));
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#EA580C]" />
              <span>كتالوج الخامات والمخزون</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              أضف خاماتك بأسعار الجملة والقطاعي والكميات المتاحة وتوزيعها
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة خامة جديدة</span>
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

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSectionFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition ${
              sectionFilter === 'all'
                ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
            }`}
          >
            الكل ({items.length})
          </button>
          {SUPPLIER_SUPPLY_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSectionFilter(s.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition ${
                sectionFilter === s.id
                  ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                  : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
              }`}
            >
              {s.titleAr}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#334155] dark:text-[#CBD5E1] cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(e) => setOnlyLowStock(e.target.checked)}
              className="accent-[#EA580C]"
            />
            <span>مخزون منخفض فقط</span>
          </label>
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الخامة..."
              className="w-full px-3 py-2 pr-8 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] text-xs font-bold outline-none"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          جاري تحميل كتالوج الخامات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center space-y-3">
          <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            لا توجد خامات مطابقة في الكتالوج حالياً
          </p>
          <button
            type="button"
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>أضف أول خامة الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const secTitle =
              SUPPLIER_SUPPLY_SECTIONS.find((s) => s.id === item.sectionId)?.titleAr ||
              item.sectionId;
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {item.images[0] ? (
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      className="w-full h-40 object-cover border-b border-[#D4CCBC] dark:border-[#22355E]"
                    />
                  ) : (
                    <div className="w-full h-28 bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                      {secTitle}
                    </div>
                  )}

                  <div className="p-4 space-y-2.5">
                    <div>
                      <div className="text-[10px] font-bold text-[#C2410C] dark:text-amber-300">
                        {secTitle}
                      </div>
                      <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        {item.name}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                      <div>
                        <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">قطاعي / {item.unit}</div>
                        <div className="font-black font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]">
                          {Number(item.retailPrice).toLocaleString()} {currencySymbol}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                          جملة (من {item.minWholesaleQty} {item.unit})
                        </div>
                        <div className="font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                          {Number(item.wholesalePrice).toLocaleString()} {currencySymbol}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span
                        className={`font-bold font-mono tabular-nums ${
                          item.stockQty <= 5
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-[#334155] dark:text-[#CBD5E1]'
                        }`}
                      >
                        المتوفر: {item.stockQty} {item.unit}
                      </span>
                      <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                        {item.inStore ? 'متجري' : ''}
                        {item.inStore && item.inMarket ? ' • ' : ''}
                        {item.inMarket ? 'سوق الموردين' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-[#EFE9DC]/60 dark:bg-[#132040]/60 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Catalog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>رجوع</span>
              </button>
              <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                {editingId ? 'تعديل بيانات الخامة' : 'إضافة خامة جديدة للكتالوج'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {feedback && (
                <div
                  className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
                    feedback.isError
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                  }`}
                >
                  {feedback.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">اسم الخامة *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: خيط مكرمية قطن مجدول 4مم"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">قسم التوريد</label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value as MainSectionId)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                  >
                    {SUPPLIER_SUPPLY_SECTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titleAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold mb-1">وحدة البيع</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                  >
                    {SUPPLIER_DEFAULT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">سعر القطاعي ({currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">سعر الجملة ({currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">الحد الأدنى للجملة</label>
                  <input
                    type="number"
                    min={1}
                    value={minWholesaleQty}
                    onChange={(e) => setMinWholesaleQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">الرصيد المتاح بالمخزن</label>
                  <input
                    type="number"
                    min={0}
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">نوع الخصم</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                  >
                    <option value="none">بدون خصم</option>
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت ({currencySymbol})</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">قيمة الخصم</label>
                  <input
                    type="number"
                    min={0}
                    disabled={discountType === 'none'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">مواصفات الخامة (الوزن / الطول / الجودة)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مثال: قطن مصري 100% وزن البكرة 500 جرام..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                />
              </div>

              {/* Variants */}
              <div className="space-y-2 p-3 rounded-2xl bg-[#EFE9DC]/60 dark:bg-[#132040]/50 border border-[#D4CCBC] dark:border-[#22355E]">
                <div className="flex items-center justify-between">
                  <span className="font-black">درجات الألوان / المقاسات المتوفرة</span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="text-[11px] font-black text-[#C2410C] dark:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة درجة/لون</span>
                  </button>
                </div>
                {variants.map((v, idx) => (
                  <div key={v.id} className="grid grid-cols-4 gap-2 items-center">
                    <input
                      type="text"
                      value={v.colorOrSize}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariants((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, colorOrSize: val } : row))
                        );
                      }}
                      placeholder="اللون / المقاس"
                      className="px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-bold"
                    />
                    <input
                      type="text"
                      value={v.thicknessOrSpec || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, thicknessOrSpec: val } : row
                          )
                        );
                      }}
                      placeholder="السمك / الوزن"
                      className="px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-bold"
                    />
                    <input
                      type="number"
                      min={0}
                      value={v.stockQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVariants((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, stockQty: val } : row))
                        );
                      }}
                      placeholder="الكمية"
                      className="px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-600 font-bold text-center cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>

              {/* Images Upload (Max 3 compressed images) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-black">صور الخامة ({images.length} / {MAX_ITEM_IMAGES} صور بحد أقصى)</span>
                    <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      ضغط تلقائي ذكي لتقليل حجم الصور في قاعدة البيانات
                    </p>
                  </div>
                  {images.length < MAX_ITEM_IMAGES ? (
                    <label className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-black cursor-pointer inline-flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5 text-[#EA580C]" />
                      <span>رفع صورة ({MAX_ITEM_IMAGES - images.length} متاح)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                      اكتمل الحد الأقصى (٣ صور)
                    </span>
                  )}
                </div>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {images.map((src, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#D4CCBC]">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Visibility Toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStore}
                    onChange={(e) => setInStore(e.target.checked)}
                    className="accent-[#EA580C] w-4 h-4"
                  />
                  <span>عرض في متجري المباشر</span>
                </label>
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inMarket}
                    onChange={(e) => setInMarket(e.target.checked)}
                    className="accent-[#EA580C] w-4 h-4"
                  />
                  <span>عرض في سوق موردين الشمساوية</span>
                </label>
              </div>

              <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ الخامة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
