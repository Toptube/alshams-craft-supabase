import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import {
  SupabaseCustomer,
  getCustomersFromSupabase,
  createCustomerInSupabase,
  updateCustomerInSupabase,
  deleteCustomerInSupabase,
} from '../../db/supabaseService';
import {
  Users,
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
  UserCheck,
  AlertCircle,
} from 'lucide-react';

interface CustomersViewProps {
  workshop: UserProfile;
  initialOpenAddModal?: boolean;
  onResetOpenAddModal?: () => void;
  onOpenHelp?: (sectionId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  workshop,
  initialOpenAddModal = false,
  onResetOpenAddModal,
  onOpenHelp,
}) => {
  const workshopId = workshop.tenantId || workshop.workshopId || workshop.id || '';
  const [customers, setCustomers] = useState<SupabaseCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialOpenAddModal);
  const [editingCustomer, setEditingCustomer] = useState<SupabaseCustomer | null>(null);

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

  const loadCustomers = async () => {
    if (!workshopId) return;
    setLoading(true);
    try {
      const res = await getCustomersFromSupabase(workshopId);
      if (res.error) {
        setNotice({ text: res.error.arabicMessage, isError: true });
      } else {
        setCustomers(res.data);
      }
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل تحميل بيانات العملاء', isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [workshopId]);

  useEffect(() => {
    if (initialOpenAddModal) {
      setIsAddModalOpen(true);
      if (onResetOpenAddModal) onResetOpenAddModal();
    }
  }, [initialOpenAddModal]);

  const handleOpenAddModal = () => {
    setFormData({ name: '', phone: '', address: '', notes: '' });
    setEditingCustomer(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (c: SupabaseCustomer) => {
    setFormData({
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
      notes: c.notes || '',
    });
    setEditingCustomer(c);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNotice({ text: 'يرجى إدخال اسم العميل', isError: true });
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        const res = await updateCustomerInSupabase(editingCustomer.id, workshopId, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          notes: formData.notes.trim(),
        });
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
        } else {
          setNotice({ text: `تم تحديث بيانات العميل "${formData.name.trim()}" بنجاح!` });
          handleCloseModal();
          loadCustomers();
        }
      } else {
        const res = await createCustomerInSupabase(workshopId, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          notes: formData.notes.trim(),
        });
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
        } else {
          setNotice({ text: `تم تسجيل العميل "${formData.name.trim()}" بنجاح في قاعدة البيانات!` });
          handleCloseModal();
          loadCustomers();
        }
      }
    } catch (err: any) {
      setNotice({ text: err.message || 'حدث خطأ أثناء حفظ العميل', isError: true });
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleDelete = async (customer: SupabaseCustomer) => {
    const confirmed = window.confirm(`هل أنت متأكد من رغبتك في حذف العميل "${customer.name}"؟`);
    if (!confirmed) return;

    setDeletingId(customer.id);
    try {
      const res = await deleteCustomerInSupabase(customer.id, workshopId);
      if (res.error) {
        // If 23503, res.error.arabicMessage is "لا يمكن حذفه لأنه مرتبط ببيانات أخرى"
        setNotice({ text: res.error.arabicMessage, isError: true });
      } else {
        setNotice({ text: `تم حذف العميل "${customer.name}" بنجاح!` });
        loadCustomers();
      }
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل حذف العميل', isError: true });
    } finally {
      setDeletingId(null);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-300/40 dark:border-emerald-800/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <Users className="w-4 h-4" />
            <span>إدارة العملاء ودليل المبيعات</span>
            {onOpenHelp && (
              <button
                type="button"
                onClick={() => onOpenHelp('customers')}
                className="text-stone-400 hover:text-emerald-600 cursor-pointer"
                title="ما معنى هذا؟"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            دليل عملاء الورشة
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            تسجيل بيانات المشترين، أرقام التواصل، والعناوين للربط مع طلبيات وفواتير المشغولات اليدوية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setMigrationNoticeText(
                'عمليات فواتير المبيعات وكشوف حسابات العملاء قيد النقل للنظام الجديد بانتظار الجداول السحابية المخصصة.'
              )
            }
            className="px-3.5 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition border border-stone-200 dark:border-stone-700"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>كشوف الحسابات (قيد النقل)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل عميل جديد</span>
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200'
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
            placeholder="بحث بالاسم أو رقم الهاتف أو العنوان..."
            className="w-full pr-9 pl-4 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold text-stone-900 dark:text-stone-100 outline-none focus:border-emerald-500"
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
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>إجمالي العملاء:</span>
          <span className="font-mono text-stone-900 dark:text-stone-100 font-extrabold">
            {customers.length}
          </span>
          {searchQuery && (
            <span className="text-[11px] text-stone-400">
              (مطابق للبحث: {filteredCustomers.length})
            </span>
          )}
        </div>
      </div>

      {/* Customers Cards Grid (Cards on mobile and responsive on tablet/desktop) */}
      {loading ? (
        <div className="py-16 text-center text-xs text-stone-400 font-bold">
          جاري تحميل بيانات العملاء من قاعدة البيانات...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-stone-800 dark:text-stone-200">
            {searchQuery ? 'لا يوجد عملاء يطابقون عبارة البحث' : 'لا يوجد عملاء مسجلين حالياً'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchQuery
              ? 'جرّب البحث باسم آخر أو تأكد من رقم الهاتف المسجل.'
              : 'ابدأ بتسجيل أول عميل لتوثيق طلبيات الورشة وأرقام التواصل.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل أول عميل الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => (
            <div
              key={c.id}
              className="p-4 sm:p-5 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-3 shadow-xs hover:border-emerald-300/80 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 shrink-0">
                      <Users className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 leading-tight">
                        {c.name}
                      </h3>
                      {c.address && (
                        <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Phone contact */}
                {c.phone ? (
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800/80">
                    <span className="text-[11px] text-stone-400 font-bold">الهاتف:</span>
                    <a
                      href={`tel:${c.phone}`}
                      dir="ltr"
                      className="font-mono text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{c.phone}</span>
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800/80 text-[11px] text-stone-400">
                    <span>الهاتف:</span>
                    <span className="italic">غير مسجل</span>
                  </div>
                )}

                {/* Notes */}
                {c.notes && (
                  <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 text-[11px] text-stone-600 dark:text-stone-300 border border-stone-100 dark:border-stone-800/50">
                    <span className="font-bold text-stone-500 block mb-0.5">ملاحظات:</span>
                    <p className="line-clamp-2 leading-relaxed">{c.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-1 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setMigrationNoticeText(
                      `كشف حساب العميل "${c.name}" وعمليات الأرصدة والفواتير قيد النقل للنظام الجديد.`
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer flex items-center gap-1"
                  title="عرض كشف الحساب"
                >
                  <FileText className="w-3 h-3 text-stone-400" />
                  <span>كشف حساب</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(c)}
                    className="px-2.5 py-1 text-stone-600 dark:text-stone-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl border border-stone-200 dark:border-stone-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="تعديل بيانات العميل"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تعديل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c.id}
                    className="px-2.5 py-1 text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-stone-200 dark:border-stone-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 text-[11px] font-bold"
                    title="حذف العميل"
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

      {/* Add / Edit Customer Modal */}
      {(isAddModalOpen || editingCustomer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-emerald-300 dark:border-stone-700 w-full max-w-md space-y-3.5 text-right shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>{editingCustomer ? 'تعديل بيانات العميل' : 'تسجيل عميل جديد بالورشة'}</span>
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                اسم العميل أو المعرض *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: مدام ريهام، معرض لمسات بوهيمية"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:border-emerald-500"
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
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono text-left outline-none focus:border-emerald-500"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                العنوان / المحافظة
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="مثال: القاهرة - التجمع الخامس، الإسكندرية..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                ملاحظات العميل
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ألوان مفضلة، متطلبات تغليف خاصة، تفاصيل شحن..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none focus:border-emerald-500 resize-none"
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
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 transition active:scale-95 shadow-sm"
              >
                {saving ? 'جاري الحفظ...' : editingCustomer ? 'حفظ التعديلات' : 'تسجيل العميل'}
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
