import React, { useMemo, useState } from 'react';
import {
  Building2,
  Search,
  X,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Download,
  Play,
  Activity,
  Award,
  Edit3,
  Snowflake,
  Ban,
  CheckCircle2,
  Trash2,
  Phone,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import {
  EnrichedWorkshopProfile,
  WorkshopSortMode,
  getWorkshopStatusKey,
  getWorkshopStatusLabel,
  getInactivityDays,
  formatWhatsAppPhone,
  getMedalArabic,
} from './adminTypes';

interface AdminWorkshopsPageProps {
  workshops: EnrichedWorkshopProfile[];
  refreshing: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onOpenNewWorkshop: () => void;
  onExportCsv: () => void;
  onActivateWorkshopContext?: (ws: EnrichedWorkshopProfile) => void;
  onOpenAudit: (ws: EnrichedWorkshopProfile) => void;
  onOpenAward: (ws: EnrichedWorkshopProfile) => void;
  onEditWorkshop: (ws: EnrichedWorkshopProfile) => void;
  onSuspendWorkshop: (ws: EnrichedWorkshopProfile) => void;
  onBanWorkshop: (ws: EnrichedWorkshopProfile) => void;
  onReactivateWorkshop: (ws: EnrichedWorkshopProfile) => void;
  onDeleteWorkshop: (ws: EnrichedWorkshopProfile) => void;
}

export const AdminWorkshopsPage: React.FC<AdminWorkshopsPageProps> = ({
  workshops,
  refreshing,
  onBack,
  onRefresh,
  onOpenNewWorkshop,
  onExportCsv,
  onActivateWorkshopContext,
  onOpenAudit,
  onOpenAward,
  onEditWorkshop,
  onSuspendWorkshop,
  onBanWorkshop,
  onReactivateWorkshop,
  onDeleteWorkshop,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<WorkshopSortMode>('most_active');

  const countries = useMemo(() => {
    const set = new Set<string>();
    workshops.forEach((w) => {
      if (w.country) set.add(w.country);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [workshops]);

  const counts = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let banned = 0;
    workshops.forEach((w) => {
      const k = getWorkshopStatusKey(w);
      if (k === 'banned') banned++;
      else if (k === 'suspended') suspended++;
      else active++;
    });
    return { total: workshops.length, active, suspended, banned };
  }, [workshops]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = workshops.filter((w) => {
      const s = getWorkshopStatusKey(w);
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      if (countryFilter !== 'all' && (w.country || 'مصر') !== countryFilter) return false;
      if (!q) return true;
      return (
        (w.brandName || '').toLowerCase().includes(q) ||
        (w.artistName || '').toLowerCase().includes(q) ||
        (w.email || '').toLowerCase().includes(q) ||
        (w.phoneNumber || '').toLowerCase().includes(q) ||
        (w.country || '').toLowerCase().includes(q)
      );
    });

    const statusWeight = (w: EnrichedWorkshopProfile) => {
      const k = getWorkshopStatusKey(w);
      return k === 'active' ? 0 : k === 'suspended' ? 1 : 2;
    };

    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.brandName || '').localeCompare(b.brandName || '', 'ar');
      }
      if (sortBy === 'status') {
        const diff = statusWeight(a) - statusWeight(b);
        return diff !== 0 ? diff : (a.brandName || '').localeCompare(b.brandName || '', 'ar');
      }
      if (sortBy === 'country') {
        const diff = (a.country || 'مصر').localeCompare(b.country || 'مصر', 'ar');
        return diff !== 0 ? diff : (a.brandName || '').localeCompare(b.brandName || '', 'ar');
      }
      if (sortBy === 'most_active') {
        const scoreA = (a.activityScore || 0) * 100 + (a.totalCatalogAndShowcase || 0) * 10 + (a.rating_stars || 0);
        const scoreB = (b.activityScore || 0) * 100 + (b.totalCatalogAndShowcase || 0) * 10 + (b.rating_stars || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.lastActiveAt || b.updatedAt || 0) - (a.lastActiveAt || a.updatedAt || 0);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [workshops, searchQuery, statusFilter, countryFilter, sortBy]);

  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || countryFilter !== 'all';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5">
      {/* Subpage Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 cursor-pointer transition"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>العودة للرئيسية</span>
          </button>
          <div>
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>دليل وإدارة الورش ({filteredAndSorted.length})</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewWorkshop}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>تسجيل ورشة</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#EA580C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Strip & Advanced Search + 5-Mode Sorting */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: `الكل (${counts.total})` },
            { id: 'active', label: `نشطة (${counts.active})` },
            { id: 'suspended', label: `موقوفة (${counts.suspended})` },
            { id: 'banned', label: `محظورة (${counts.banned})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer font-mono tabular-nums ${
                statusFilter === tab.id
                  ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C]'
                  : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث فوري: اسم البراند، الفنان، الهاتف، أو البريد..."
              className="w-full h-10 pr-10 pl-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0C1427] dark:text-[#94A3B8] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Country Filter */}
          <div className="md:col-span-3">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label="فلترة حسب الدولة"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">كل الدول ({countries.length})</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 5-Mode Sort Dropdown */}
          <div className="md:col-span-4 relative flex items-center gap-2">
            <div className="relative flex-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as WorkshopSortMode)}
                aria-label="ترتيب الورش"
                className="w-full h-10 pr-8 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C] cursor-pointer"
              >
                <option value="most_active">الأكثر نشاطاً وتفاعلاً وعدد المنتجات والمعروضات</option>
                <option value="newest">الأحدث تسجيلاً</option>
                <option value="name">حسب الاسم (أ - ي)</option>
                <option value="status">حسب الحالة</option>
                <option value="country">حسب الدولة</option>
              </select>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCountryFilter('all');
                }}
                className="h-10 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1 cursor-pointer shrink-0"
                title="مسح الفلاتر"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-12 text-center space-y-2">
          <Building2 className="w-10 h-10 mx-auto text-[#EA580C] opacity-70" />
          <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">لا توجد ورش مطابقة للبحث</h3>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">جرّب تغيير شروط الفلترة أو البحث بكلمة أخرى.</p>
        </div>
      ) : (
        <>
          {/* Desktop Structured Table */}
          <div className="hidden lg:block rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-x-auto shadow-xs">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/70 dark:bg-[#132040] text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
                  <th className="py-3 px-4">الورشة والفنان</th>
                  <th className="py-3 px-3">التواصل والدولة</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-center">المنتجات / السوق</th>
                  <th className="py-3 px-3 text-center">الطلبات والتفاعل</th>
                  <th className="py-3 px-3 text-center">التقييم</th>
                  <th className="py-3 px-4 text-left">إجراءات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4CCBC]/70 dark:divide-[#22355E]">
                {filteredAndSorted.map((ws) => {
                  const statusMeta = getWorkshopStatusLabel(ws);
                  const statusKey = getWorkshopStatusKey(ws);
                  const inactivity = getInactivityDays(ws);
                  const waPhone = formatWhatsAppPhone(ws.phoneNumber);

                  return (
                    <tr
                      key={ws.id}
                      className="hover:bg-[#EFE9DC]/50 dark:hover:bg-[#132040]/50 transition-colors"
                    >
                      <td className="py-3 px-4 align-top">
                        <div className="font-black text-xs text-[#0C1427] dark:text-[#F7F3EA]">
                          {ws.brandName}
                        </div>
                        <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] font-bold">
                          {ws.artistName}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-[11px] space-y-0.5">
                        <div className="font-bold text-[#0C1427] dark:text-[#F7F3EA]">{ws.country || 'مصر'}</div>
                        {ws.phoneNumber && (
                          <div className="font-mono tabular-nums text-[#334155] dark:text-[#CBD5E1]" dir="ltr">
                            {ws.phoneNumber}
                          </div>
                        )}
                        {ws.email && (
                          <div className="font-mono text-[10px] text-[#475569] dark:text-[#94A3B8] truncate max-w-[180px]">
                            {ws.email}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 align-top">
                        <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-black ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                        <div className="text-[10px] font-mono tabular-nums text-[#475569] dark:text-[#94A3B8] mt-1">
                          {inactivity === 0 ? 'نشط اليوم' : `منذ ${inactivity} يوم`}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-center font-mono tabular-nums text-xs">
                        <div className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          {ws.productsCount ?? 0} منتج
                        </div>
                        <div className="text-[10px] font-bold text-[#C2410C] dark:text-[#FBBF24]">
                          {ws.marketplaceProductsCount ?? 0} معروضة
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-center font-mono tabular-nums text-xs">
                        <div className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          {ws.ordersCount ?? 0} طلب
                        </div>
                        <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                          نقاط النشاط: {ws.activityScore ?? 0}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-center text-[11px]">
                        <div className="font-bold text-amber-600 dark:text-[#FBBF24]">
                          {getMedalArabic(ws.medal)}
                        </div>
                        <div className="font-mono tabular-nums text-[10px] text-[#475569] dark:text-[#94A3B8]">
                          ★ {ws.rating_stars ?? 5}/5
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {onActivateWorkshopContext && (
                            <button
                              type="button"
                              onClick={() => onActivateWorkshopContext(ws)}
                              title="تفعيل سياق الورشة"
                              className="p-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenAudit(ws)}
                            title="فحص النشاط التفصيلي"
                            className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenAward(ws)}
                            title="منح تكريم ووسام"
                            className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditWorkshop(ws)}
                            title="تعديل البيانات وكلمة السر"
                            className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {statusKey !== 'active' ? (
                            <button
                              type="button"
                              onClick={() => onReactivateWorkshop(ws)}
                              title="إلغاء الإيقاف وتفعيل"
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSuspendWorkshop(ws)}
                              title="إيقاف مؤقت"
                              className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                            >
                              <Snowflake className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {statusKey !== 'banned' && (
                            <button
                              type="button"
                              onClick={() => onBanWorkshop(ws)}
                              title="حظر نهائي"
                              className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteWorkshop(ws)}
                            title="تصفير أو حذف"
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="واتساب"
                              className="p-1.5 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {filteredAndSorted.map((ws) => {
              const statusMeta = getWorkshopStatusLabel(ws);
              const statusKey = getWorkshopStatusKey(ws);
              const waPhone = formatWhatsAppPhone(ws.phoneNumber);
              return (
                <div
                  key={ws.id}
                  className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">{ws.brandName}</h3>
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8] font-bold truncate">
                        {ws.artistName} · {ws.country || 'مصر'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0 ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums text-[11px]">
                    <div className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040]">
                      <span className="block text-[9px] font-sans text-[#475569] dark:text-[#94A3B8]">المنتجات</span>
                      <span className="font-black">{ws.productsCount ?? 0}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040]">
                      <span className="block text-[9px] font-sans text-[#475569] dark:text-[#94A3B8]">المعروضات</span>
                      <span className="font-black text-[#C2410C] dark:text-[#FBBF24]">{ws.marketplaceProductsCount ?? 0}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040]">
                      <span className="block text-[9px] font-sans text-[#475569] dark:text-[#94A3B8]">الطلبات</span>
                      <span className="font-black">{ws.ordersCount ?? 0}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                    {onActivateWorkshopContext && (
                      <button
                        type="button"
                        onClick={() => onActivateWorkshopContext(ws)}
                        className="flex-1 py-2 px-2.5 rounded-xl bg-[#EA580C] text-white text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>دخول</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditWorkshop(ws)}
                      className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAward(ws)}
                      className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#C2410C] dark:text-[#FBBF24] cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5" />
                    </button>
                    {statusKey !== 'active' ? (
                      <button
                        type="button"
                        onClick={() => onReactivateWorkshop(ws)}
                        className="p-2 rounded-xl bg-emerald-600 text-white cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSuspendWorkshop(ws)}
                        className="p-2 rounded-xl bg-amber-600 text-white cursor-pointer"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {statusKey !== 'banned' && (
                      <button
                        type="button"
                        onClick={() => onBanWorkshop(ws)}
                        className="p-2 rounded-xl bg-rose-600 text-white cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {waPhone && (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
