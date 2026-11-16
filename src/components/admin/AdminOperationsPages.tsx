import React, { useMemo, useState } from 'react';
import {
  UserCheck,
  Sparkles,
  Scale,
  ArrowRight,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Phone,
  Copy,
  Printer,
  Star,
} from 'lucide-react';
import { CloudMarketplaceProduct } from '../../db/marketplaceCloud';
import { EnrichedWorkshopProfile, formatWhatsAppPhone } from './adminTypes';
import { SUB_CRAFTS_REGISTRY } from '../../registry/craftsRegistry';

function matchesDateFilter(dateStr: string | number | undefined, range: 'all' | 'today' | '7d' | '30d'): boolean {
  if (range === 'all' || !dateStr) return true;
  const ts = typeof dateStr === 'number' ? dateStr : new Date(dateStr).getTime();
  if (isNaN(ts)) return true;
  const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (range === 'today') return diffDays <= 1;
  if (range === '7d') return diffDays <= 7;
  if (range === '30d') return diffDays <= 30;
  return true;
}

/* ============================================================
   Card 5: طلبات الانضمام (Join Applications Page)
============================================================ */
interface AdminApplicationsPageProps {
  applications: any[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onApprove: (app: any, notes?: string) => Promise<void>;
  onReject: (app: any, reason: string) => Promise<void>;
  onCopyInviteSuccess: (msg: string) => void;
}

export const AdminApplicationsPage: React.FC<AdminApplicationsPageProps> = ({
  applications,
  loading,
  onBack,
  onRefresh,
  onApprove,
  onReject,
  onCopyInviteSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [craftFilter, setCraftFilter] = useState<string>('all');
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((app) => {
      const curStatus = app.status || 'pending';
      if (statusFilter !== 'all' && curStatus !== statusFilter) return false;
      if (!matchesDateFilter(app.created_at, dateFilter)) return false;

      if (craftFilter !== 'all') {
        const rawCrafts = Array.isArray(app.crafts)
          ? app.crafts.join(' ')
          : String(app.crafts || app.specialty || '');
        if (!rawCrafts.toLowerCase().includes(craftFilter.toLowerCase())) return false;
      }

      if (!q) return true;
      return (
        String(app.brand_name || app.brandName || '').toLowerCase().includes(q) ||
        String(app.artist_name || app.artistName || '').toLowerCase().includes(q) ||
        String(app.email || '').toLowerCase().includes(q) ||
        String(app.phone_number || app.phoneNumber || '').toLowerCase().includes(q)
      );
    });
  }, [applications, searchQuery, statusFilter, dateFilter, craftFilter]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12">
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
            title="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <span>طلبات الانضمام ({filteredApps.length})</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const link = typeof window !== 'undefined' ? `${window.location.origin}/?join=1` : '';
              navigator.clipboard.writeText(link);
              onCopyInviteSuccess('تم نسخ رابط تسجيل الورش الجديدة!');
            }}
            className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>نسخ رابط الانضمام</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters: Search + Date + Status + Specialty Craft */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالورشة، الفنان، الهاتف، أو البريد..."
            className="w-full h-10 pr-9 pl-7 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="فلترة حسب الحالة"
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="pending">بانتظار المراجعة</option>
            <option value="approved">تم الاعتماد</option>
            <option value="rejected">مرفوضة</option>
            <option value="all">الكل ({applications.length})</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            aria-label="فلترة حسب التاريخ"
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل التواريخ</option>
            <option value="today">اليوم</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={craftFilter}
            onChange={(e) => setCraftFilter(e.target.value)}
            aria-label="فلترة حسب التخصص"
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل التخصصات الحرفية</option>
            {SUB_CRAFTS_REGISTRY.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredApps.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
          لا توجد طلبات انضمام مطابقة لخيارات البحث.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map((app) => {
            const st = app.status || 'pending';
            const waPhone = formatWhatsAppPhone(app.phone_number || app.phoneNumber);
            return (
              <div
                key={app.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {app.brand_name || app.brandName || 'ورشة جديدة'}
                    </h3>
                    <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                      {app.artist_name || app.artistName} · {app.country || 'مصر'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      st === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : st === 'rejected'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {st === 'approved' ? 'معتمد' : st === 'rejected' ? 'مرفوض' : 'بانتظار الاعتماد'}
                  </span>
                </div>

                <div className="text-xs text-[#334155] dark:text-[#CBD5E1] space-y-1">
                  {app.email && <div className="font-mono text-[11px]">{app.email}</div>}
                  {(app.phone_number || app.phoneNumber) && (
                    <div className="font-mono tabular-nums">{app.phone_number || app.phoneNumber}</div>
                  )}
                  {app.notes && <p className="p-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] text-[11px]">{app.notes}</p>}
                </div>

                {st === 'pending' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={notesById[app.id] || ''}
                      onChange={(e) => setNotesById((prev) => ({ ...prev, [app.id]: e.target.value }))}
                      placeholder="ملاحظات الاعتماد أو سبب الرفض (اختياري)..."
                      className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(app, notesById[app.id])}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>اعتماد وتفعيل الورشة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(app, notesById[app.id] || 'لم يستوفِ المعايير الحالية')}
                        className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض</span>
                      </button>
                      {waPhone && (
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   Card 6: المنتجات المعلقة (Pending Marketplace Products Page)
============================================================ */
interface AdminProductApprovalsPageProps {
  products: CloudMarketplaceProduct[];
  workshops: EnrichedWorkshopProfile[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onApproveProduct: (prod: CloudMarketplaceProduct, stars: number) => Promise<void>;
  onRejectProductModal: (prod: CloudMarketplaceProduct) => void;
  onDownloadMarketPoster: () => void;
}

export const AdminProductApprovalsPage: React.FC<AdminProductApprovalsPageProps> = ({
  products,
  workshops,
  loading,
  onBack,
  onRefresh,
  onApproveProduct,
  onRejectProductModal,
  onDownloadMarketPoster,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending_approval' | 'approved' | 'rejected' | 'all'>('pending_approval');
  const [workshopFilter, setWorkshopFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [starsById, setStarsById] = useState<Record<string, number>>({});

  const categoriesList = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => {
      if (p.craft_name || p.category) s.add(p.craft_name || p.category);
    });
    return Array.from(s);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (workshopFilter !== 'all' && p.workshop_id !== workshopFilter) return false;
      if (categoryFilter !== 'all' && (p.craft_name || p.category) !== categoryFilter) return false;
      if (!matchesDateFilter(p.created_at, dateFilter)) return false;
      if (!q) return true;
      return (
        (p.product_name || '').toLowerCase().includes(q) ||
        (p.brand_name || '').toLowerCase().includes(q) ||
        (p.artist_name || '').toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, statusFilter, workshopFilter, categoryFilter, dateFilter]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12">
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
            title="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>مراجعة واعتماد المعروضات ({filteredProducts.length})</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownloadMarketPoster}
            className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#EA580C]" />
            <span className="hidden sm:inline">بوستر السوق</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters: Search + Status + Workshop + Category + Upload Date */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-4 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالمنتج أو الورشة..."
            className="w-full h-10 pr-9 pl-7 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="lg:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="pending_approval">بانتظار الاعتماد</option>
            <option value="approved">معتمدة ومنشورة</option>
            <option value="rejected">مرفوضة</option>
            <option value="all">الكل</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            value={workshopFilter}
            onChange={(e) => setWorkshopFilter(e.target.value)}
            className="w-full h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل الورش</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.brandName}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل التصنيفات</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="w-full h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل التواريخ</option>
            <option value="today">مرفوع اليوم</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
          </select>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
          لا توجد منتجات مطابقة في قائمة المراجعة الحالية.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const curStars = starsById[p.id] ?? 5;
            return (
              <div
                key={p.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <img
                    src={p.image_url || '/alshams_falcon_emblem.png'}
                    alt={p.product_name}
                    className="w-full aspect-[4/3] object-cover border-b border-[#D4CCBC] dark:border-[#22355E]"
                  />
                  <div className="p-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black line-clamp-2">{p.product_name}</h3>
                      <span className="font-mono tabular-nums text-xs font-black text-[#C2410C] dark:text-[#FBBF24] shrink-0">
                        {(p.store_price || p.retail_price || 0).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                      {p.brand_name} · {p.artist_name} · {p.craft_name || p.category}
                    </p>
                    {p.store_description && (
                      <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] line-clamp-2">{p.store_description}</p>
                    )}
                    {p.rejection_reason && (
                      <p className="text-[11px] text-rose-600 font-bold">ملاحظة: {p.rejection_reason}</p>
                    )}
                  </div>
                </div>

                <div className="px-3.5 pb-3.5 space-y-2 pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#475569] dark:text-[#94A3B8]">تقييم الجودة المبدئي:</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStarsById((prev) => ({ ...prev, [p.id]: st }))}
                          className="p-0.5 cursor-pointer"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              st <= curStars ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-stone-400'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => onApproveProduct(p, curStars)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>اعتماد للسوق</span>
                      </button>
                    )}
                    {p.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => onRejectProductModal(p)}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض بملاحظة</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   Card 7: الطعون والتظلمات (Appeals Management Page)
============================================================ */
interface AdminAppealsPageProps {
  appeals: any[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onAcceptAppeal: (item: any) => Promise<void>;
  onOpenRejectAppeal: (item: any) => void;
}

export const AdminAppealsPage: React.FC<AdminAppealsPageProps> = ({
  appeals,
  loading,
  onBack,
  onRefresh,
  onAcceptAppeal,
  onOpenRejectAppeal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [workshopFilter, setWorkshopFilter] = useState('all');

  const uniqueWorkshops = useMemo(() => {
    const map = new Map<string, string>();
    appeals.forEach((a) => {
      if (a.id && (a.brand_name || a.brandName)) {
        map.set(a.id, a.brand_name || a.brandName);
      }
    });
    return Array.from(map.entries());
  }, [appeals]);

  const filteredAppeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appeals.filter((a) => {
      const st = a.appeal_status || 'pending';
      if (statusFilter === 'pending' && st !== 'pending' && st !== 'under_review') return false;
      if (statusFilter === 'accepted' && st !== 'accepted') return false;
      if (statusFilter === 'rejected' && st !== 'rejected') return false;
      if (workshopFilter !== 'all' && a.id !== workshopFilter) return false;
      if (!q) return true;
      return (
        String(a.brand_name || a.brandName || '').toLowerCase().includes(q) ||
        String(a.artist_name || a.artistName || '').toLowerCase().includes(q) ||
        String(a.appeal_message || '').toLowerCase().includes(q)
      );
    });
  }, [appeals, searchQuery, statusFilter, workshopFilter]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12">
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
            title="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Scale className="w-5 h-5 text-rose-600" />
            <span>الطعون والتظلمات ({filteredAppeals.length})</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في نص التظلم أو اسم الورشة..."
            className="w-full h-10 pr-9 pl-7 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="pending">طعون معلقة بانتظار القرار</option>
            <option value="accepted">طعون مقبولة</option>
            <option value="rejected">طعون مرفوضة</option>
            <option value="all">كل الطعون ({appeals.length})</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={workshopFilter}
            onChange={(e) => setWorkshopFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل الورش المتظلمة</option>
            {uniqueWorkshops.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredAppeals.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
          لا توجد طعون أو تظلمات مطابقة حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppeals.map((a) => {
            const waPhone = formatWhatsAppPhone(a.phone_number || a.phoneNumber);
            const st = a.appeal_status || 'pending';
            return (
              <div
                key={a.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black">{a.brand_name || a.brandName || 'ورشة'}</h3>
                    <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                      {a.artist_name || a.artistName}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      st === 'accepted'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : st === 'rejected'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {st === 'accepted' ? 'مقبول' : st === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                  </span>
                </div>

                {a.suspension_reason && (
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    سبب الإيقاف السابق: {a.suspension_reason}
                  </p>
                )}

                <p className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-bold leading-relaxed">
                  {a.appeal_message || 'لا يوجد نص مرفق.'}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {st !== 'accepted' && (
                    <button
                      type="button"
                      onClick={() => onAcceptAppeal(a)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>قبول وفك التجميد فوراً</span>
                    </button>
                  )}
                  {st !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => onOpenRejectAppeal(a)}
                      className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رفض الطعن</span>
                    </button>
                  )}
                  {waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
