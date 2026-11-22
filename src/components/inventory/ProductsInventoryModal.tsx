import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Calculator,
  Hammer,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { db } from '../../db/dexieDB';

interface ProductsInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: any;
  asPage?: boolean;
  onNavigateToCalculator?: () => void;
  onNavigateToWorkOrders?: () => void;
}

interface ProductItem {
  id: string;
  workshop_id?: string;
  product_name: string;
  category: string;
  cost_price: number;
  wholesale_price: number;
  retail_price: number;
  stock_quantity: number;
  is_active?: boolean;
  created_at?: string;
}

export const ProductsInventoryModal: React.FC<ProductsInventoryModalProps> = ({
  isOpen,
  onClose,
  profile,
  asPage = false,
  onNavigateToCalculator,
  onNavigateToWorkOrders,
}) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Edit Existing Product State (New products come through Cost Calculator / Work Orders)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    product_name: '',
    category: 'عام',
    cost_price: 0,
    wholesale_price: 0,
    retail_price: 0,
    stock_quantity: 0,
  });

  // Inline Delete Confirmation (no window.confirm)
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const workshopId = profile?.workshopId || profile?.tenantId || profile?.workshop_id || profile?.id || '';
  const currencySymbol = profile?.currencySymbol || 'ج.م';

  const loadProducts = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      let list: ProductItem[] = [];

      if (workshopId) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('workshop_id', workshopId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          list = data
            .filter((d: any) => d.is_active !== false)
            .map((d: any) => ({
              id: d.id,
              workshop_id: d.workshop_id,
              product_name: d.product_name || d.name || d.local_record?.productName || 'منتج غير مسمى',
              category: d.category || d.specs?.category || d.main_section || 'عام',
              cost_price: Number(d.cost_price ?? d.local_record?.costPrice ?? 0),
              wholesale_price: Number(d.wholesale_price ?? d.local_record?.wholesalePrice ?? 0),
              retail_price: Number(d.retail_price ?? d.local_record?.retailPrice ?? 0),
              stock_quantity: Number(
                d.stock_quantity ?? d.specs?.stockQuantity ?? d.specs?.quantity ?? d.local_record?.currentStock ?? 0
              ),
              is_active: d.is_active ?? true,
              created_at: d.created_at,
            }));
        }
      }

      if (list.length === 0 && workshopId) {
        const local = await db.products.where('tenantId').equals(workshopId).toArray();
        if (local && local.length > 0) {
          list = local
            .filter((d: any) => d.isActive !== false && d.is_active !== false)
            .map((d: any) => ({
              id: d.id,
              workshop_id: d.tenantId || d.workshopId || d.workshop_id || workshopId,
              product_name: d.productName || d.product_name || d.name || 'منتج محلي',
              category: d.category || d.craftType || 'عام',
              cost_price: Number(d.costPrice ?? d.cost_price ?? 0),
              wholesale_price: Number(d.wholesalePrice ?? d.wholesale_price ?? 0),
              retail_price: Number(d.retailPrice ?? d.sellingPrice ?? d.retail_price ?? 0),
              stock_quantity: Number(
                d.currentStock ?? d.stock_quantity ?? d.specs?.stockQuantity ?? d.specs?.quantity ?? 0
              ),
              is_active: d.isActive ?? d.is_active ?? true,
              created_at: d.createdAt ? new Date(d.createdAt).toISOString() : d.created_at,
            }));
        }
      }

      setProducts(list);
    } catch (err: any) {
      console.error('Error loading products:', err);
      setFeedback({ type: 'error', message: 'تعذر تحميل المنتجات: ' + (err.message || 'خطأ غير معروف') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || asPage) {
      loadProducts();
    }
  }, [isOpen, asPage, workshopId]);

  if (!isOpen && !asPage) return null;

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category || 'عام').filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.product_name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleGoToCalculator = () => {
    if (!asPage) onClose();
    if (onNavigateToCalculator) {
      onNavigateToCalculator();
    } else {
      window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'calculator' } }));
    }
  };

  const handleGoToWorkOrders = () => {
    if (!asPage) onClose();
    if (onNavigateToWorkOrders) {
      onNavigateToWorkOrders();
    } else {
      window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'work_orders' } }));
    }
  };

  const handleOpenEdit = (item: ProductItem) => {
    setEditingId(item.id);
    setFormData({
      product_name: item.product_name,
      category: item.category,
      cost_price: item.cost_price,
      wholesale_price: item.wholesale_price,
      retail_price: item.retail_price,
      stock_quantity: item.stock_quantity,
    });
    setIsFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!formData.product_name.trim()) {
      setFeedback({ type: 'error', message: 'يرجى كتابة اسم المنتج' });
      return;
    }

    try {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const stockQty = Math.max(0, Number(formData.stock_quantity) || 0);
      const cleanName = formData.product_name.trim();
      const cleanCategory = formData.category.trim() || 'عام';
      const costVal = Math.max(0, Number(formData.cost_price) || 0);
      const wholesaleVal = Math.max(0, Number(formData.wholesale_price) || 0);
      const retailVal = Math.max(0, Number(formData.retail_price) || 0);

      const existingDexie = await db.products.get(editingId);
      const localRecord: any = {
        ...(existingDexie || {}),
        id: editingId,
        tenantId: workshopId,
        workshopId,
        productName: cleanName,
        category: cleanCategory,
        craftType: cleanCategory,
        costPrice: costVal,
        wholesalePrice: wholesaleVal,
        retailPrice: retailVal,
        sellingPrice: retailVal,
        currentStock: stockQty,
        isActive: true,
        createdAt: existingDexie?.createdAt || now,
        updatedAt: now,
      };

      await db.products.put(localRecord);

      const cloudPayload: any = {
        id: editingId,
        workshop_id: workshopId,
        name: cleanName,
        product_name: cleanName,
        category: cleanCategory,
        cost_price: costVal,
        wholesale_price: wholesaleVal,
        retail_price: retailVal,
        stock_quantity: stockQty,
        specs: { stockQuantity: stockQty, category: cleanCategory },
        is_active: true,
        local_record: localRecord,
        updated_at: nowIso,
      };

      const { error } = await supabase
        .from('products')
        .update(cloudPayload)
        .eq('id', editingId);

      if (error) {
        await supabase
          .from('products')
          .update({
            name: cleanName,
            cost_price: costVal,
            wholesale_price: wholesaleVal,
            retail_price: retailVal,
            updated_at: nowIso,
            data: cloudPayload,
          })
          .eq('id', editingId);
      }

      setFeedback({ type: 'success', message: 'تم تحديث بيانات المنتج والكمية بنجاح' });
      setIsFormOpen(false);
      await loadProducts();
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'فشل في حفظ التعديلات: ' + (err.message || '') });
    }
  };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    const id = deletingProduct.id;
    setDeletingProduct(null);
    try {
      await supabase.from('products').delete().eq('id', id).eq('workshop_id', workshopId);
      await db.products.delete(id).catch(() => {});
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setFeedback({ type: 'success', message: 'تم حذف المنتج من المخزن بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'فشل في حذف المنتج: ' + (err.message || '') });
    }
  };

  const handleQuickStockAdjust = async (id: string, delta: number) => {
    const item = products.find((p) => p.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.stock_quantity + delta);
    const now = Date.now();

    try {
      const existingDexie = await db.products.get(id);
      if (existingDexie) {
        await db.products.update(id, { currentStock: newQty, updatedAt: now });
      }

      const { error } = await supabase
        .from('products')
        .update({
          stock_quantity: newQty,
          specs: { stockQuantity: newQty },
          updated_at: new Date(now).toISOString(),
        })
        .eq('id', id);

      if (error) {
        await supabase
          .from('products')
          .update({ updated_at: new Date(now).toISOString(), data: { stockQuantity: newQty } })
          .eq('id', id);
      }

      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock_quantity: newQty } : p)));
    } catch (err) {
      console.error('Failed stock quick adjust:', err);
    }
  };

  const totalPieces = products.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0), 0);

  const outerClass = asPage
    ? 'max-w-6xl mx-auto px-3 sm:px-6 py-5'
    : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in';

  const containerClass = asPage
    ? 'relative w-full bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] rounded-3xl shadow-sm flex flex-col overflow-hidden text-[#0C1427] dark:text-[#F7F3EA]'
    : 'relative w-full max-w-5xl max-h-[92dvh] bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#0C1427] dark:text-[#F7F3EA]';

  return (
    <div className={outerClass} dir="rtl">
      <div className={containerClass}>
        {/* Header — Clean Light & Dark Mode, zero developer table badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA]/70 dark:bg-[#0D162E]/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-[#EA580C]/15 border border-[#EA580C]/25 text-[#EA580C] dark:text-[#FBBF24] shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                مخزن المنتجات الجاهزة
              </h2>
              <p className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mt-0.5">
                متابعة القطع تامة الصنع، الكميات المتوفرة للبيع، وأسعار التكلفة والجملة والقطاعي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadProducts}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:border-[#EA580C] transition-colors cursor-pointer"
              title="تحديث القائمة"
              aria-label="تحديث القائمة"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
            </button>
            {!asPage && (
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors cursor-pointer"
                title="إغلاق"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-4 sm:mx-6 mt-4 p-3 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action Bar — Routes new products cleanly through Cost Calculator or Work Orders */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#D4CCBC]/80 dark:border-[#22355E] bg-[#EFE9DC]/40 dark:bg-[#0D162E]/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 min-w-[220px]">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم المنتج أو التصنيف..."
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm text-[#0C1427] dark:text-[#F7F3EA] placeholder-[#64748B] focus:outline-none focus:border-[#EA580C] transition-colors"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
            >
              <option value="all">كل التصنيفات ({products.length})</option>
              {categories
                .filter((c) => c !== 'all')
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGoToCalculator}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-xs sm:text-sm shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Calculator className="w-4 h-4" />
              <span>تسعير وإضافة منتج (حاسبة التكاليف)</span>
            </button>

            <button
              type="button"
              onClick={handleGoToWorkOrders}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] font-extrabold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Hammer className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>استلام من أمر تشغيل</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#64748B] dark:text-[#94A3B8]">
              <RefreshCw className="w-8 h-8 animate-spin text-[#EA580C] mb-3" />
              <p className="text-sm font-bold">جاري تحميل مخزون المنتجات الجاهزة...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-[#D4CCBC] dark:border-[#22355E] rounded-3xl bg-[#F7F3EA]/50 dark:bg-[#0D162E]/40">
              <Package className="w-12 h-12 text-[#94A3B8] mb-3" />
              <h3 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                لا توجد منتجات جاهزة في المخزن حالياً
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-[#475569] dark:text-[#94A3B8] max-w-md mt-1.5 mb-5 leading-relaxed">
                لإضافة منتج مضبوط بالتكلفة والسعر، ابدأ بتسعيره في حاسبة التكاليف وحفظه في الأرشيف، أو استلم قطعاً جاهزة من أوامر التشغيل.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleGoToCalculator}
                  className="px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Calculator className="w-4 h-4" />
                  <span>افتح حاسبة التكاليف الآن</span>
                </button>
                <button
                  type="button"
                  onClick={handleGoToWorkOrders}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Hammer className="w-4 h-4 text-[#EA580C]" />
                  <span>أوامر التشغيل</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock_quantity <= 0;
                const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 3;

                return (
                  <div
                    key={product.id}
                    className="group relative rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA]/55 dark:bg-[#0D162E]/70 hover:border-[#EA580C]/60 p-4 transition-all flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-md bg-[#EA580C]/10 text-[#EA580C] dark:text-[#FBBF24] border border-[#EA580C]/20">
                            {product.category || 'عام'}
                          </span>
                          <h4 className="font-black text-[#0C1427] dark:text-[#F7F3EA] text-base mt-1.5 line-clamp-1">
                            {product.product_name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 rounded-lg bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:text-[#EA580C] transition-colors cursor-pointer"
                            title="تعديل الكمية والأسعار"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(product)}
                            className="p-1.5 rounded-lg bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer"
                            title="حذف المنتج"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 my-2 border-y border-[#D4CCBC]/70 dark:border-[#22355E] text-center text-xs">
                        <div className="bg-white dark:bg-[#132040] p-2 rounded-xl border border-[#D4CCBC]/60 dark:border-[#22355E]">
                          <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">التكلفة</div>
                          <div className="font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono tabular-nums">
                            {product.cost_price} {currencySymbol}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-[#132040] p-2 rounded-xl border border-[#D4CCBC]/60 dark:border-[#22355E]">
                          <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">الجملة</div>
                          <div className="font-black text-amber-700 dark:text-amber-300 mt-0.5 font-mono tabular-nums">
                            {product.wholesale_price} {currencySymbol}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-[#132040] p-2 rounded-xl border border-[#D4CCBC]/60 dark:border-[#22355E]">
                          <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">القطاعي</div>
                          <div className="font-black text-emerald-700 dark:text-emerald-400 mt-0.5 font-mono tabular-nums">
                            {product.retail_price} {currencySymbol}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stock Quantity & Quick +/- */}
                    <div className="mt-2 pt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">المتوفر:</span>
                        <span
                          className={`text-sm font-black font-mono tabular-nums px-2.5 py-0.5 rounded-lg border ${
                            isOutOfStock
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                              : isLowStock
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {product.stock_quantity}
                        </span>
                        {isOutOfStock && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">غير متوفر</span>}
                        {isLowStock && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">كمية محدودة</span>}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(product.id, -1)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] font-black flex items-center justify-center transition-colors cursor-pointer"
                          title="إنقاص قطعة (-1)"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(product.id, 1)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] font-black flex items-center justify-center transition-colors cursor-pointer"
                          title="زيادة قطعة (+1)"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA]/70 dark:bg-[#0D162E]/70 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          <div className="flex items-center gap-4">
            <span>
              إجمالي الأصناف:{' '}
              <strong className="font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]">
                {products.length}
              </strong>
            </span>
            <span>
              إجمالي القطع الجاهزة:{' '}
              <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {totalPieces}
              </strong>
            </span>
          </div>
          {!asPage && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white dark:bg-[#1C2A4A] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>

        {/* Edit Existing Product Sub-Modal */}
        {isFormOpen && editingId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] rounded-3xl p-5 sm:p-6 shadow-2xl text-[#0C1427] dark:text-[#F7F3EA]">
              <div className="flex items-center justify-between mb-4 border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
                <h3 className="font-black text-base text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#EA580C]" />
                  <span>تعديل رصيد وأسعار المنتج</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0C1427] dark:hover:text-white cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold focus:outline-none focus:border-[#EA580C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">التصنيف</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold focus:outline-none focus:border-[#EA580C]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">الكمية بالمخزن</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-mono font-bold focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                      سعر التكلفة ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-mono font-bold focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                      سعر الجملة ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.wholesale_price}
                      onChange={(e) => setFormData({ ...formData, wholesale_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-mono font-bold focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                      سعر القطاعي ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.retail_price}
                      onChange={(e) => setFormData({ ...formData, retail_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-mono font-bold focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D4CCBC] dark:border-[#22355E]">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#1C2A4A] text-[#0C1427] dark:text-[#F7F3EA] font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black transition-colors cursor-pointer"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Inline Delete Confirmation Sub-Modal */}
        {deletingProduct && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white dark:bg-[#132040] border border-rose-300 dark:border-rose-800 rounded-3xl p-5 shadow-2xl space-y-3.5 text-xs sm:text-sm">
              <h4 className="font-black text-rose-700 dark:text-rose-300">تأكيد حذف المنتج</h4>
              <p className="text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                هل أنت متأكد من حذف <strong>"{deletingProduct.product_name}"</strong> من مخزن المنتجات الجاهزة؟
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#1C2A4A] text-[#0C1427] dark:text-[#F7F3EA] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black cursor-pointer"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
