import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Download,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { EnrichedWorkshopProfile, formatWhatsAppPhone } from './adminTypes';
import { fetchAdminCustomersDirectory } from '../../db/supplierService';
import { AdminCustomerDirectoryRow } from '../../types/supplier';

interface AdminCustomersPageProps {
  userEmail?: string;
  workshops: EnrichedWorkshopProfile[];
  onBack: () => void;
}

export const AdminCustomersPage: React.FC<AdminCustomersPageProps> = ({
  userEmail,
  workshops,
  onBack,
}) => {
  const [customers, setCustomers] = useState<AdminCustomerDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [workshopFilter, setWorkshopFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const list = await fetchAdminCustomersDirectory(userEmail);
      setCustomers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, [userEmail]);

  const countries = useMemo(() => {
    const s = new Set<string>();
    customers.forEach((c) => {
      if (c.country) s.add(c.country);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [customers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (workshopFilter !== 'all' && c.workshopId !== workshopFilter) return false;
      if (countryFilter !== 'all' && (c.country || 'مصر') !== countryFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        c.workshopBrand.toLowerCase().includes(q) ||
        c.artistName.toLowerCase().includes(q)
      );
    });
  }, [customers, searchQuery, workshopFilter, countryFilter]);

  const handleExportCsv = () => {
    const rows = [
      ['اسم العميل', 'الهاتف', 'البريد', 'الدولة', 'الورشة', 'الفنان', 'المصدر', 'عدد الطلبات', 'إجمالي المشتريات'],
      ...filtered.map((c) => [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.country || 'مصر').replace(/"/g, '""')}"`,
        `"${(c.workshopBrand || '').replace(/"/g, '""')}"`,
        `"${(c.artistName || '').replace(/"/g, '""')}"`,
        `"${(c.source || '').replace(/"/g, '""')}"`,
        String(c.ordersCount || 0),
        String(c.totalSpent || 0),
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سجل_عملاء_المنظومة_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>رجوع</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-xl font-black flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>سجل العملاء الشامل على مستوى الورش ({filtered.length})</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>تصدير CSV</span>
          </button>
          <button
            type="button"
            onClick={loadDirectory}
            disabled={loading}
            className="p-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters including Workshop Filter */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العميل، الهاتف، اسم الورشة، أو الفنان..."
            className="w-full h-10 pr-10 pl-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-4">
          <select
            value={workshopFilter}
            onChange={(e) => setWorkshopFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">فلتر الورش: كل الورش ({workshops.length})</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.brandName} — {w.artistName}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل الدول</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs font-bold text-[#475569]">
          جاري تجميع قاعدة بيانات العملاء عبر كافة الورش...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569]">
          لا توجد سجلات عملاء مطابقة للفلتر المحدد.
        </div>
      ) : (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
              <tr>
                <th className="p-3 font-black">العميل</th>
                <th className="p-3 font-black">التواصل والبلد</th>
                <th className="p-3 font-black">الورشة</th>
                <th className="p-3 font-black">الفنان</th>
                <th className="p-3 font-black">المصدر</th>
                <th className="p-3 font-black">الطلبات</th>
                <th className="p-3 font-black">المشتريات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
              {filtered.map((c) => {
                const wa = formatWhatsAppPhone(c.phone);
                return (
                  <tr key={c.id} className="hover:bg-[#EFE9DC]/40 dark:hover:bg-[#132040]/40">
                    <td className="p-3 font-black">{c.name}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 font-mono tabular-nums" dir="ltr">
                        <span>{c.phone || '—'}</span>
                        {wa && (
                          <a
                            href={`https://wa.me/${wa}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-emerald-600/15 text-emerald-700"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] text-[#475569]">{c.country || 'مصر'}</span>
                    </td>
                    <td className="p-3 font-black text-[#C2410C] dark:text-[#FBBF24]">{c.workshopBrand}</td>
                    <td className="p-3 font-bold">{c.artistName}</td>
                    <td className="p-3 text-[11px]">{c.source || 'الورشة'}</td>
                    <td className="p-3 font-mono tabular-nums font-bold">{c.ordersCount}</td>
                    <td className="p-3 font-mono tabular-nums font-black">
                      {c.totalSpent.toLocaleString('ar-EG')} ج.م
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
