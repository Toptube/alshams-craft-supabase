import React, { useState, useEffect } from 'react';
import { UserProfile, WorkshopProfile } from '../../types';
import {
  SupabaseSupplier,
  getSuppliersFromSupabase,
  createSupplierInSupabase,
  updateSupplierInSupabase,
  deleteSupplierInSupabase,
} from '../../db/supabaseService';
import {
  Truck,
  Plus,
  Search,
  Phone,
  MapPin,
  FileText,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  HelpCircle,
  Boxes,
  AlertCircle,
  Receipt,
} from 'lucide-react';

interface SuppliersViewProps {
  workshop: WorkshopProfile | UserProfile;
  initialOpenAddModal?: boolean;
  onResetOpenAddModal?: () => void;
  onOpenHelp?: (sectionId: string) => void;
  onOpenDocumentPreview?: (docType: 'statement', data: any) => void;
  onOpenCreateSupplier?: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  workshop,
  initialOpenAddModal = false,
  onResetOpenAddModal,
  onOpenHelp,
  onOpenCreateSupplier,
}) => {
  const workshopId = (workshop as any).tenantId || (workshop as any).workshopId || workshop.id || '';
  const [suppliers, setSuppliers] = useState<SupabaseSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialOpenAddModal);
  const [editingSupplier, setEditingSupplier] = useState<SupabaseSupplier | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Migration notice modal for invoices/balances/statements
  const [migrationNoticeText, setMigrationNoticeText] = useState<string | null>(null);

  // Global notice toast
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadSuppliers = async () => {
    if (!workshopId) return;
    setLoading(true);
    try {
      const res = await getSuppliersFromSupabase(workshopId);
      if (res.error) {
        setNotice({ text: res.error.arabicMessage, isError: true });
      } else {
        setSuppliers(res.data);
      }
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل تحميل بيانات الموردين', isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [workshopId]);

  useEffect(() => {
    if (initialOpenAddModal) {
      setIsAddModalOpen(true);
      if (onResetOpenAddModal) onResetOpenAddModal();
    }
  }, [initialOpenAddModal]);

  const handleOpenAddModal = () => {
    setFormData({ name: '', phone: '', address: '', notes: '' });
    setEditingSupplier(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (s: SupabaseSupplier) => {
    setFormData({
      name: s.name || '',
      phone: s.phone || '',
      address: s.address || '',
      notes: s.notes || '',
    });
    setEditingSupplier(s);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNotice({ text: 'يرجى إدخال اسم المورد أو التاجر', isError: true });
      return;
    }

    setSaving(true);
    try {
      if (editingSupplier) {
        const res = await updateSupplierInSupabase(editingSupplier.id, workshopId, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          notes: formData.notes.trim(),
        });
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
        } else {
          setNotice({ text: `تم تحديث بيانات المورد "${formData.name.trim()}" بنجاح!` });
          handleCloseModal();
          loadSuppliers();
        }
      } else {
        const res = await createSupplierInSupabase(workshopId, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          notes: formData.notes.trim(),
        });
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
        } else {
          setNotice({ text: `تم تسجيل المورد "${formData.name.trim()}" بنجاح في قاعدة البيانات!` });
          handleCloseModal();
          loadSuppliers();
        }
      }
    } catch (err: any) {
      setNotice({ text: err.message || 'حدث خطأ أثناء حفظ المورد', isError: true });
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleDelete = async (supplier: SupabaseSupplier) => {
    const confirmed = window.confirm(`هل أنت متأكد من رغبتك في حذف المورد "${supplier.name}"؟`);
    if (!confirmed) return;

    setDeletingId(supplier.id);
    try {
      const res = await deleteSupplierInSupabase(supplier.id, workshopId);
      if (res.error) {
        // If error 23503, res.error.arabicMessage is "لا يمكن حذفه لأنه مرتبط ببيانات أخرى"
        setNotice({ text: res.error.arabicMessage, isError: true });
      } else {
        setNotice({ text: `تم حذف المورد "${supplier.name}" بنجاح!` });
        loadSuppliers();
      }
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل حذف المورد', isError: true });
    } finally {
      setDeletingId(null);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.notes && s.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent border border-blue-300/40 dark:border-blue-800/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
            <Truck className="w-4 h-4" />
            <span>إدارة الموردين وشراء خامات الورشة</span>
            {onOpenHelp && (
              <button
                type="button"
                onClick={() => onOpenHelp('inventory')}
                className="text-stone-400 hover:text-blue-600 cursor-pointer"
                title="ما معنى هذا؟"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            دليل موردي الخامات ومصادر التوريد
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            تسجيل بيانات التجار، مصانع الغزل، أرقام التواصل، وعناوين التوريد لربطها بالخامات والمخزون.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setMigrationNoticeText(
                'عمليات فواتير المشتريات والأرصدة وتوريد الخامات قيد النقل للنظام الجديد بانتظار الجداول السحابية المخصصة.'
              )
            }
            className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer transition"
          >
            <Boxes className="w-4 h-4" />
            <span>شراء وتوريد خامات (قيد النقل)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>إضافة مورد</span>
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200'
              : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-300 text-blue-800 dark:text-blue-200'
          }`}
        >
          {notice.isError ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Search Bar & Summary Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المورد أو رقم الهاتف أو العنوان..."
            className="w-full pr-9 pl-4 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold text-stone-900 dark:text-stone-100 outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-stone-500 px-2 shrink-0">
          <Truck className="w-4 h-4 text-blue-600" />
          <span>إجمالي الموردين:</span>
          <span className="font-mono text-stone-900 dark:text-stone-100 font-extrabold">
            {suppliers.length}
          </span>
          {searchQuery && (
            <span className="text-[11px] text-stone-400">
              (مطابق للبحث: {filteredSuppliers.length})
            </span>
          )}
        </div>
      </div>

      {/* Suppliers Cards Grid (Cards on mobile and responsive on tablet/desktop) */}
      {loading ? (
        <div className="py-16 text-center text-xs text-stone-400 font-bold">
          جاري تحميل بيانات الموردين من قاعدة البيانات...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 mx-auto flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-stone-800 dark:text-stone-200">
            {searchQuery ? 'لا يوجد موردون يطابقون عبارة البحث' : 'لا يوجد موردون مسجلون حالياً'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchQuery
              ? 'جرّب البحث باسم آخر أو تأكد من رقم الهاتف المسجل.'
              : 'ابدأ بتسجيل أول مورد خامات لحفظ بيانات الشراء وجهات التوريد.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل أول مورد الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => (
            <div
              key={s.id}
              className="p-4 sm:p-5 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-3 shadow-xs hover:border-blue-300/80 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 shrink-0">
                      <Truck className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 leading-tight">
                        {s.name}
                      </h3>
                      {s.address && (
                        <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{s.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Phone contact */}
                {s.phone ? (
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800/80">
                    <span className="text-[11px] text-stone-400 font-bold">الهاتف:</span>
                    <a
                      href={`tel:${s.phone}`}
                      dir="ltr"
                      className="font-mono text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{s.phone}</span>
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800/80 text-[11px] text-stone-400">
                    <span>الهاتف:</span>
                    <span className="italic">غير مسجل</span>
                  </div>
                )}

                {/* Notes / Specialty */}
                {s.notes && (
                  <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 text-[11px] text-stone-600 dark:text-stone-300 border border-stone-100 dark:border-stone-800/50">
                    <span className="font-bold text-stone-500 block mb-0.5">ملاحظات / تخصص:</span>
                    <p className="line-clamp-2 leading-relaxed">{s.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-1 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setMigrationNoticeText(
                      `كشف حساب المورد "${s.name}" وعمليات فواتير التوريد والأرصدة قيد النقل للنظام الجديد بانتظار إنشاء الجداول المخصصة.`
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer flex items-center gap-1"
                  title="عرض كشف الحساب"
                >
                  <FileSpreadsheet className="w-3 h-3 text-stone-400" />
                  <span>كشف حساب</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(s)}
                    className="px-2.5 py-1 text-stone-600 dark:text-stone-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl border border-stone-200 dark:border-stone-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="تعديل بيانات المورد"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>تعديل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    disabled={deletingId === s.id}
                    className="px-2.5 py-1 text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-stone-200 dark:border-stone-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 text-[11px] font-bold"
                    title="حذف المورد"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invoices List / Under Migration Section */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
              سجل فواتير توريد الخامات من الموردين
            </h3>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
            قيد النقل
          </span>
        </div>

        <div className="py-8 text-center rounded-2xl bg-stone-50/60 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-2">
          <FileText className="w-8 h-8 text-stone-400 mx-auto" />
          <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
            عمليات الفواتير والأرصدة وكشوف الحساب قيد النقل للنظام الجديد
          </p>
          <p className="text-[11px] text-stone-400 max-w-md mx-auto">
            يتم حالياً تجهيز الجداول السحابية لحفظ قيود التوريد وإثبات السداد المالي مع الخزن.
          </p>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {(isAddModalOpen || editingSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-blue-300 dark:border-stone-700 w-full max-w-md space-y-3.5 text-right shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>{editingSupplier ? 'تعديل بيانات المورد' : 'تسجيل مورد خامات جديد'}</span>
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                اسم المورد أو الشركة / المغزل *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: غزل المحلة، الحاج فتحي، متجر بوهيميان كرافت"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                رقم الهاتف / واتساب
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono text-left outline-none focus:border-blue-500"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                العنوان / المدينة
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="مثال: القاهرة - العتبة، المحلة الكبرى..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                ملاحظات / تخصص الخامات
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="مثال: مورد خيوط قطن وكردون، أسعار جملة للمشاغل..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 transition active:scale-95 shadow-sm"
              >
                {saving ? 'جاري الحفظ...' : editingSupplier ? 'حفظ التعديلات' : 'تسجيل المورد'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Migration Notice Modal for Statement/Invoices */}
      {migrationNoticeText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-stone-200 dark:border-stone-800 max-w-md w-full space-y-4 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <button
                type="button"
                onClick={() => setMigrationNoticeText(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>إشعار مرحلة الترحيل السحابي</span>
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-medium">
              {migrationNoticeText}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMigrationNoticeText(null)}
                className="px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
