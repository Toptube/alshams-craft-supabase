import React, { useEffect, useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { SupplierCustomer } from '../../types/supplier';
import {
  fetchSupplierCustomers,
  upsertSupplierCustomer,
  deleteSupplierCustomer,
} from '../../db/supplierService';
import {
  ArrowRight,
  X,
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Phone,
  MapPin,
} from 'lucide-react';

interface SupplierCustomersViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
}

type SourceFilter = 'all' | 'direct_store' | 'suppliers_market' | 'external';

const SOURCE_LABELS: Record<SupplierCustomer['sourceType'], string> = {
  direct_store: 'متجري',
  suppliers_market: 'موردين الشمساوية',
  external: 'خارج المنظومة',
};

export const SupplierCustomersView: React.FC<SupplierCustomersViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
}) => {
  const currencySymbol = profile.currencySymbol || 'ج.م';
  const [customers, setCustomers] = useState<SupplierCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(profile.country || 'مصر');
  const [governorate, setGovernorate] = useState('');
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [balanceDue, setBalanceDue] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const list = await fetchSupplierCustomers();
    setCustomers(list);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (sourceFilter !== 'all' && c.sourceType !== sourceFilter) return false;
      if (q) {
        const hay = `${c.name} ${c.phone} ${c.country} ${c.governorate || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customers, sourceFilter, search]);

  const openNew = () => {
    setEditingId(undefined);
    setName('');
    setPhone('');
    setCountry(profile.country || 'مصر');
    setGovernorate('');
    setTotalPurchases(0);
    setBalanceDue(0);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (c: SupplierCustomer) => {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setCountry(c.country || 'مصر');
    setGovernorate(c.governorate || '');
    setTotalPurchases(Number(c.totalPurchases || 0));
    setBalanceDue(Number(c.balanceDue || 0));
    setNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await upsertSupplierCustomer({
      id: editingId,
      name: name.trim(),
      phone: phone.trim(),
      country: country.trim() || 'مصر',
      governorate: governorate.trim(),
      sourceType: 'external',
      totalPurchases: Number(totalPurchases || 0),
      balanceDue: Number(balanceDue || 0),
      notes: notes.trim(),
    });
    setSaving(false);
    if (res.success) {
      await loadData();
      setIsModalOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteSupplierCustomer(id);
    if (ok) {
      setCustomers((prev) => prev.filter((x) => x.id !== id));
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#EA580C]" />
              <span>عملائي (الورش والأفراد)</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              تصفية حسب المصدر والبحث بالاسم أو رقم التليفون أو الدولة أو المحافظة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عميل خارجي</span>
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

      {/* 4-Way Filter + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all' as const, label: `الكل (${customers.length})` },
            { id: 'direct_store' as const, label: 'متجري' },
            { id: 'suppliers_market' as const, label: 'موردين الشمساوية' },
            { id: 'external' as const, label: 'خارج المنظومة' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition ${
                sourceFilter === tab.id
                  ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                  : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative md:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو التليفون أو الدولة أو المحافظة..."
            className="w-full px-3 py-2 pr-8 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] text-xs font-bold outline-none"
          />
          <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
        </div>
      </div>

      {/* Directory List */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          جاري تحميل قائمة العملاء...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center space-y-2">
          <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">لا يوجد عملاء مطابقون</p>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
            يتم تسجيل العملاء تلقائياً مع الطلبات أو يمكنك إضافة عميل خارجي يدوياً.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] font-black text-[#0C1427] dark:text-[#F7F3EA]">
              <tr>
                <th className="p-3">العميل / الورشة</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">الدولة والمحافظة</th>
                <th className="p-3">المصدر</th>
                <th className="p-3">إجمالي المشتريات</th>
                <th className="p-3">الرصيد المتبقي</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#EFE9DC]/40 dark:hover:bg-[#132040]/40">
                  <td className="p-3 font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    <div>{c.name}</div>
                    {c.notes && (
                      <div className="text-[10px] font-medium text-[#475569] dark:text-[#94A3B8]">
                        {c.notes}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono font-bold">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#EA580C]" />
                      {c.phone || '—'}
                    </span>
                  </td>
                  <td className="p-3 font-bold">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#EA580C]" />
                      {c.country}
                      {c.governorate ? ` / ${c.governorate}` : ''}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-[#C2410C] dark:text-amber-300">
                    {SOURCE_LABELS[c.sourceType] || c.sourceType}
                  </td>
                  <td className="p-3 font-mono tabular-nums font-black">
                    {Number(c.totalPurchases).toLocaleString()} {currencySymbol}
                  </td>
                  <td className="p-3 font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                    {Number(c.balanceDue).toLocaleString()} {currencySymbol}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] cursor-pointer"
                        title="تعديل"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-rose-600 hover:text-rose-700 cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>رجوع</span>
              </button>
              <h3 className="text-sm font-black">
                {editingId ? 'تعديل بيانات العميل' : 'إضافة عميل خارجي'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="إغلاق"
                className="w-7 h-7 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">اسم العميل / الورشة *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-left"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">الدولة</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المحافظة</label>
                  <input
                    type="text"
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">إجمالي المشتريات</label>
                  <input
                    type="number"
                    min={0}
                    value={totalPurchases}
                    onChange={(e) => setTotalPurchases(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المتبقي (آجل)</label>
                  <input
                    type="number"
                    min={0}
                    value={balanceDue}
                    onChange={(e) => setBalanceDue(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D4CCBC] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
