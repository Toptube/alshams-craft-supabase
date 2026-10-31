import React, { useState, useEffect } from 'react';
import { 
  Package, Plus, Search, Trash2, Edit2, X, RefreshCw, AlertTriangle, 
  ArrowUpDown, CheckCircle, Tag, DollarSign, Layers
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { db } from '../../db/dexieDB';

interface ProductsInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: any;
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
  profile
}) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Add / Edit State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    product_name: '',
    category: 'عام',
    cost_price: 0,
    wholesale_price: 0,
    retail_price: 0,
    stock_quantity: 0
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const workshopId = profile?.workshop_id || profile?.id;

  // Load products
  const loadProducts = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      let list: ProductItem[] = [];

      // 1. Try Supabase
      if (workshopId) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('workshop_id', workshopId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          list = data.map((d: any) => ({
            id: d.id,
            workshop_id: d.workshop_id,
            product_name: d.product_name || d.name || 'منتج غير مسمى',
            category: d.category || 'عام',
            cost_price: Number(d.cost_price || 0),
            wholesale_price: Number(d.wholesale_price || 0),
            retail_price: Number(d.retail_price || 0),
            stock_quantity: Number(d.stock_quantity ?? d.specs?.stockQuantity ?? d.specs?.quantity ?? 0),
            is_active: d.is_active ?? true,
            created_at: d.created_at
          }));
        }
      }

      // 2. Fallback to local Dexie / IndexedDB if offline or empty
      if (list.length === 0) {
        const local = await (db.products as any).toArray();
        if (local && local.length > 0) {
          list = local.map((d: any) => ({
            id: d.id,
            workshop_id: d.workshop_id || workshopId,
            product_name: d.product_name || d.name || 'منتج محلي',
            category: d.category || 'عام',
            cost_price: Number(d.cost_price || 0),
            wholesale_price: Number(d.wholesale_price || 0),
            retail_price: Number(d.retail_price || 0),
            stock_quantity: Number(d.stock_quantity ?? d.specs?.stockQuantity ?? d.specs?.quantity ?? 0),
            is_active: d.is_active ?? true,
            created_at: d.created_at
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
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, workshopId]);

  if (!isOpen) return null;

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'عام').filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      product_name: '',
      category: 'عام',
      cost_price: 0,
      wholesale_price: 0,
      retail_price: 0,
      stock_quantity: 0
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: ProductItem) => {
    setEditingId(item.id);
    setFormData({
      product_name: item.product_name,
      category: item.category,
      cost_price: item.cost_price,
      wholesale_price: item.wholesale_price,
      retail_price: item.retail_price,
      stock_quantity: item.stock_quantity
    });
    setIsFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_name.trim()) {
      setFeedback({ type: 'error', message: 'يرجى كتابة اسم المنتج' });
      return;
    }

    try {
      const payload: any = {
        workshop_id: workshopId,
        product_name: formData.product_name.trim(),
        category: formData.category.trim() || 'عام',
        cost_price: Number(formData.cost_price) || 0,
        wholesale_price: Number(formData.wholesale_price) || 0,
        retail_price: Number(formData.retail_price) || 0,
        specs: { stockQuantity: Number(formData.stock_quantity) || 0 }
      };

      if (editingId) {
        // Update
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingId);

        if (error) {
          // fallback update local
          await (db.products as any).update(editingId, {
            ...payload,
            stock_quantity: Number(formData.stock_quantity) || 0
          });
        }
        setFeedback({ type: 'success', message: 'تم تحديث بيانات المنتج بنجاح' });
      } else {
        // Insert
        const newId = crypto.randomUUID();
        const fullNewItem = {
          id: newId,
          ...payload,
          is_active: true,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('products')
          .insert([fullNewItem]);

        if (error) {
          // fallback insert local
          await (db.products as any).add({
            ...fullNewItem,
            stock_quantity: Number(formData.stock_quantity) || 0
          });
        }
        setFeedback({ type: 'success', message: 'تمت إضافة المنتج الجديد بنجاح إلى المخزن' });
      }

      setIsFormOpen(false);
      await loadProducts();
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'فشل في حفظ المنتج: ' + (err.message || '') });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج نهائياً من المخزن؟')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        await (db.products as any).delete(id);
      }
      setProducts(prev => prev.filter(p => p.id !== id));
      setFeedback({ type: 'success', message: 'تم حذف المنتج بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'فشل في حذف المنتج: ' + (err.message || '') });
    }
  };

  const handleQuickStockAdjust = async (id: string, delta: number) => {
    const item = products.find(p => p.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.stock_quantity + delta);

    try {
      const { error } = await supabase
        .from('products')
        .update({
          specs: { stockQuantity: newQty }
        })
        .eq('id', id);

      if (error) {
        await (db.products as any).update(id, {
          stock_quantity: newQty,
          specs: { stockQuantity: newQty }
        });
      }

      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock_quantity: newQty } : p));
    } catch (err) {
      console.error('Failed stock quick adjust:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-5xl h-[90vh] bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-amber-400">مخزن المنتجات الجاهزة</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  جدول products
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة المنتجات تامة الصنع، كميات المخزون، أسعار الجملة، والقطاعي، والتكلفة
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={loadProducts}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border text-sm flex items-center justify-between ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs opacity-75 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم المنتج أو التصنيف..."
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">كل التصنيفات ({products.length})</option>
              {categories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-102 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
              <p>جاري تحميل مخزون المنتجات من قاعدة البيانات...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
              <Package className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-lg font-bold text-slate-300">لا توجد منتجات مسجلة في هذا المخزن</h3>
              <p className="text-sm text-slate-500 max-w-md mt-1 mb-4">
                ابدأ بإضافة منتجات الورشة تامة الصنع وتحديد أسعار التكلفة والجملة والقطاعي لمتابعة أرباحك وتوفرها.
              </p>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 transition-colors"
              >
                + إضافة أول منتج الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock_quantity <= 0;
                const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 3;
                
                return (
                  <div
                    key={product.id}
                    className="group relative rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 hover:border-amber-500/40 p-4 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar of Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {product.category || 'عام'}
                          </span>
                          <h4 className="font-bold text-slate-100 text-base mt-1 line-clamp-1">
                            {product.product_name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                            title="تعديل المنتج"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="حذف المنتج"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Financial info */}
                      <div className="grid grid-cols-3 gap-2 py-2 my-2 border-y border-slate-800 text-center text-xs">
                        <div className="bg-slate-900/50 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-400">التكلفة</div>
                          <div className="font-bold text-rose-300 mt-0.5">{product.cost_price} ج.م</div>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-400">سعر الجملة</div>
                          <div className="font-bold text-amber-300 mt-0.5">{product.wholesale_price} ج.م</div>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-400">سعر القطاعي</div>
                          <div className="font-bold text-emerald-400 mt-0.5">{product.retail_price} ج.م</div>
                        </div>
                      </div>
                    </div>

                    {/* Stock Status & Quick Adjust */}
                    <div className="mt-2 pt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-400">المتوفر:</div>
                        <div className={`text-base font-black px-2 py-0.5 rounded-lg border ${
                          isOutOfStock 
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                            : isLowStock 
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                          {product.stock_quantity}
                        </div>
                        {isOutOfStock && <span className="text-[10px] text-rose-400 font-bold">نفد المخزون</span>}
                        {isLowStock && <span className="text-[10px] text-amber-400 font-bold">أوشك على النفاد</span>}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleQuickStockAdjust(product.id, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold flex items-center justify-center transition-colors"
                          title="إنقاص قطعة (-1)"
                        >
                          -
                        </button>
                        <button
                          onClick={() => handleQuickStockAdjust(product.id, 1)}
                          className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold flex items-center justify-center transition-colors"
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

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div>إجمالي المنتجات المسجلة: <span className="font-bold text-slate-200">{products.length}</span></div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            إغلاق
          </button>
        </div>

        {/* Add/Edit Sub-Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  <span>{editingId ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للمخزن'}</span>
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="مثال: فازة خزفية مطعمة بالنحاس"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">التصنيف</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="مثال: خزف، أخشاب، جلود، نحاسيات"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">الكمية بالمخزن</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">سعر التكلفة (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">سعر الجملة (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.wholesale_price}
                      onChange={(e) => setFormData({ ...formData, wholesale_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">سعر القطاعي (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.retail_price}
                      onChange={(e) => setFormData({ ...formData, retail_price: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
                  >
                    {editingId ? 'حفظ التعديلات' : 'إضافة المنتج'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
