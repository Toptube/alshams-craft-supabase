import React, { useMemo, useState } from 'react';
import {
  Store,
  Boxes,
  ArrowRight,
  Search,
  X,
  ExternalLink,
  Copy,
  Play,
  Snowflake,
  CheckCircle2,
  Package,
  Wallet,
  ShoppingCart,
  Users,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import {
  EnrichedWorkshopProfile,
  getWorkshopStatusKey,
  getWorkshopStatusLabel,
} from './adminTypes';
import { getWorkshopCleanSlug } from '../../utils/slugify';
import { CloudMarketplaceProduct } from '../../db/marketplaceCloud';

/* ============================================================
   Card 3: إدارة المتاجر (Storefronts Management Page)
============================================================ */
interface AdminStoresPageProps {
  workshops: EnrichedWorkshopProfile[];
  cloudProducts: CloudMarketplaceProduct[];
  onBack: () => void;
  onActivateWorkshopContext?: (ws: EnrichedWorkshopProfile) => void;
  onSuspendWorkshop: (ws: EnrichedWorkshopProfile) => void;
  onReactivateWorkshop: (ws: EnrichedWorkshopProfile) => void;
  onCopySuccess: (msg: string) => void;
}

export const AdminStoresPage: React.FC<AdminStoresPageProps> = ({
  workshops,
  cloudProducts,
  onBack,
  onActivateWorkshopContext,
  onSuspendWorkshop,
  onReactivateWorkshop,
  onCopySuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'frozen'>('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const countries = useMemo(() => {
    const set = new Set<string>();
    workshops.forEach((w) => {
      if (w.country) set.add(w.country);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [workshops]);

  const approvedCountByWs = useMemo(() => {
    const map = new Map<string, number>();
    cloudProducts.forEach((p) => {
      if (p.status === 'approved' && p.workshop_id) {
        map.set(p.workshop_id, (map.get(p.workshop_id) || 0) + 1);
      }
    });
    return map;
  }, [cloudProducts]);

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workshops.filter((w) => {
      const k = getWorkshopStatusKey(w);
      if (statusFilter === 'active' && k !== 'active') return false;
      if (statusFilter === 'frozen' && k === 'active') return false;
      if (countryFilter !== 'all' && (w.country || 'مصر') !== countryFilter) return false;
      if (!q) return true;
      const slug = getWorkshopCleanSlug(w).toLowerCase();
      return (
        (w.brandName || '').toLowerCase().includes(q) ||
        (w.artistName || '').toLowerCase().includes(q) ||
        slug.includes(q) ||
        (w.phoneNumber || '').toLowerCase().includes(q)
      );
    });
  }, [workshops, searchQuery, statusFilter, countryFilter]);

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
            <Store className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>إدارة المتاجر ({filteredStores.length})</span>
          </h1>
        </div>
      </div>

      {/* Advanced Search & Filters */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المتجر، الرابط (Slug)، الفنان، أو الهاتف..."
            className="w-full h-10 pr-10 pl-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل المتاجر ({workshops.length})</option>
            <option value="active">متاجر مفتوحة ونشطة</option>
            <option value="frozen">متاجر متوقفة / محظورة</option>
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

      {filteredStores.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
          لا توجد متاجر مطابقة لخيارات البحث.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map((ws) => {
            const slug = getWorkshopCleanSlug(ws);
            const storeUrl =
              typeof window !== 'undefined' ? `${window.location.origin}/#/store/${encodeURIComponent(slug)}` : `/#/store/${slug}`;
            const statusMeta = getWorkshopStatusLabel(ws);
            const statusKey = getWorkshopStatusKey(ws);
            const showcaseCount = approvedCountByWs.get(ws.id) ?? ws.marketplaceProductsCount ?? 0;

            return (
              <div
                key={ws.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">{ws.brandName}</h3>
                      <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] truncate">
                        {ws.artistName} · {ws.country || 'مصر'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black shrink-0 ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="truncate text-[#C2410C] dark:text-[#FBBF24]" dir="ltr">
                      /#/store/{slug}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(storeUrl);
                        onCopySuccess(`تم نسخ رابط متجر "${ws.brandName}"`);
                      }}
                      className="p-1 rounded-lg hover:bg-[#F7F3EA] dark:hover:bg-[#0D162E] cursor-pointer shrink-0"
                      title="نسخ الرابط"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono tabular-nums pt-1">
                    <span className="text-[#475569] dark:text-[#94A3B8]">
                      معروضات معتمدة: <strong className="text-[#0C1427] dark:text-[#F7F3EA]">{showcaseCount}</strong>
                    </span>
                    <span className="text-[#475569] dark:text-[#94A3B8]">
                      الكتالوج: <strong className="text-[#0C1427] dark:text-[#F7F3EA]">{ws.productsCount ?? 0}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                    <span>معاينة المتجر</span>
                  </a>

                  {onActivateWorkshopContext && (
                    <button
                      type="button"
                      onClick={() => onActivateWorkshopContext(ws)}
                      className="py-2 px-3 rounded-xl bg-[#EA580C] text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>إدارة</span>
                    </button>
                  )}

                  {statusKey === 'active' ? (
                    <button
                      type="button"
                      onClick={() => onSuspendWorkshop(ws)}
                      className="p-2 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 text-amber-800 dark:text-amber-300 cursor-pointer"
                      title="تجميد المتجر مؤقتاً"
                    >
                      <Snowflake className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReactivateWorkshop(ws)}
                      className="p-2 rounded-xl bg-emerald-600 text-white cursor-pointer"
                      title="إعادة فتح المتجر"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
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

/* ============================================================
   Card 4: الكتالوجات والمعارض (Catalogs, Materials & Deep ERP)
============================================================ */
interface AdminCatalogsPageProps {
  workshops: EnrichedWorkshopProfile[];
  selectedWorkshopId: string;
  onSelectWorkshopId: (id: string) => void;
  deepData: {
    materials: any[];
    products: any[];
    treasuries: any[];
    orders: any[];
    customers: any[];
    suppliers?: any[];
    employees?: any[];
  } | null;
  deepDataLoading: boolean;
  initialSubTab?: 'materials' | 'products' | 'treasuries' | 'orders' | 'contacts';
  onReloadDeepData: (workshopId: string) => void;
  onEditMaterialPrice: (mat: any) => void;
  onBack: () => void;
}

export const AdminCatalogsPage: React.FC<AdminCatalogsPageProps> = ({
  workshops,
  selectedWorkshopId,
  onSelectWorkshopId,
  deepData,
  deepDataLoading,
  initialSubTab = 'products',
  onReloadDeepData,
  onEditMaterialPrice,
  onBack,
}) => {
  const [subTab, setSubTab] = useState<'products' | 'materials' | 'orders' | 'treasuries' | 'contacts'>(initialSubTab);
  const [wsSearch, setWsSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low'>('all');

  const filteredWorkshops = useMemo(() => {
    const q = wsSearch.trim().toLowerCase();
    if (!q) return workshops;
    return workshops.filter(
      (w) =>
        (w.brandName || '').toLowerCase().includes(q) ||
        (w.artistName || '').toLowerCase().includes(q) ||
        (w.phoneNumber || '').toLowerCase().includes(q)
    );
  }, [workshops, wsSearch]);

  const filteredProducts = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return (deepData?.products || []).filter((p) => {
      const qty = Number(p.current_stock ?? p.currentStock ?? 0);
      if (stockFilter === 'in_stock' && qty <= 0) return false;
      if (stockFilter === 'low' && qty > 2) return false;
      if (!q) return true;
      return (
        String(p.product_name || p.productName || p.name || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q)
      );
    });
  }, [deepData, itemSearch, stockFilter]);

  const filteredMaterials = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return (deepData?.materials || []).filter((m) => {
      const qty = Number(m.stock_quantity ?? m.currentStock ?? m.quantity ?? 0);
      if (stockFilter === 'in_stock' && qty <= 0) return false;
      if (stockFilter === 'low' && qty > Number(m.minStockAlert ?? 2)) return false;
      if (!q) return true;
      return String(m.name || m.materialName || '').toLowerCase().includes(q);
    });
  }, [deepData, itemSearch, stockFilter]);

  const filteredOrders = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return (deepData?.orders || []).filter((o) => {
      if (!q) return true;
      return (
        String(o.customer_name || o.customerName || '').toLowerCase().includes(q) ||
        String(o.order_number || o.invoiceNumber || o.id || '').toLowerCase().includes(q)
      );
    });
  }, [deepData, itemSearch]);

  const filteredContacts = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const list = deepData?.customers || [];
    if (!q) return list;
    return list.filter(
      (c) =>
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.phone || c.phoneNumber || '').toLowerCase().includes(q)
    );
  }, [deepData, itemSearch]);

  const tabItems: { id: 'products' | 'materials' | 'orders' | 'treasuries' | 'contacts'; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'products', label: 'الكتالوج والمعروضات', icon: <Package className="w-3.5 h-3.5" />, count: deepData?.products?.length || 0 },
    { id: 'materials', label: 'المخزون والخامات', icon: <Boxes className="w-3.5 h-3.5" />, count: deepData?.materials?.length || 0 },
    { id: 'orders', label: 'الفواتير والطلبيات', icon: <ShoppingCart className="w-3.5 h-3.5" />, count: deepData?.orders?.length || 0 },
    { id: 'treasuries', label: 'الخزائن والسيولة', icon: <Wallet className="w-3.5 h-3.5" />, count: deepData?.treasuries?.length || 0 },
    { id: 'contacts', label: 'العملاء والموردون', icon: <Users className="w-3.5 h-3.5" />, count: deepData?.customers?.length || 0 },
  ];

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
            <Boxes className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>الكتالوجات والمعارض</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => onReloadDeepData(selectedWorkshopId)}
          disabled={deepDataLoading}
          className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${deepDataLoading ? 'animate-spin text-[#EA580C]' : ''}`} />
          <span>تحديث بيانات الورشة</span>
        </button>
      </div>

      {/* Workshop Switcher + Item Search */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={wsSearch}
            onChange={(e) => setWsSearch(e.target.value)}
            placeholder="تصفية الورش..."
            className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
        </div>

        <div className="md:col-span-4">
          <select
            value={selectedWorkshopId}
            onChange={(e) => onSelectWorkshopId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black cursor-pointer"
          >
            {filteredWorkshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.brandName} — {w.artistName}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            placeholder="بحث في المنتجات أو الخامات..."
            className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
        </div>

        <div className="md:col-span-2">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل الكميات</option>
            <option value="in_stock">متوفر بالمخزن</option>
            <option value="low">رصيد منخفض</option>
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabItems.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap border flex items-center gap-1.5 transition cursor-pointer shrink-0 font-mono tabular-nums ${
              subTab === t.id
                ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C]'
                : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E]'
            }`}
          >
            {t.icon}
            <span className="font-sans">{t.label}</span>
            <span className="opacity-80">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Subtab Contents */}
      {deepDataLoading ? (
        <div className="p-12 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          جاري تحميل بيانات الورشة المحددة...
        </div>
      ) : (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          {subTab === 'products' && (
            filteredProducts.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#475569] dark:text-[#94A3B8]">لا توجد منتجات في كتالوج هذه الورشة.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProducts.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex gap-3 items-center">
                    <img
                      src={p.image_url || p.imageUrl || '/alshams_falcon_emblem.png'}
                      alt={p.product_name || p.productName || p.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#D4CCBC] dark:border-[#22355E]"
                    />
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-xs font-black truncate">{p.product_name || p.productName || p.name}</h4>
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">{p.category || 'مشغولة يدوية'}</p>
                      <p className="text-xs font-mono tabular-nums font-black text-[#C2410C] dark:text-[#FBBF24]">
                        {Number(p.retail_price ?? p.retailPrice ?? p.store_price ?? 0).toLocaleString('ar-EG')} ج.م · رصيد: {p.current_stock ?? p.currentStock ?? 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {subTab === 'materials' && (
            filteredMaterials.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#475569] dark:text-[#94A3B8]">لا توجد خامات مسجلة لهذه الورشة.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMaterials.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-xs font-black truncate">{m.name || m.materialName}</h4>
                      <p className="text-[11px] font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]">
                        السعر: <strong className="text-[#0C1427] dark:text-[#F7F3EA]">{Number(m.unit_cost ?? m.price ?? m.cost ?? 0).toLocaleString('ar-EG')}</strong> ج.م · الرصيد: {m.stock_quantity ?? m.currentStock ?? m.quantity ?? 0}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditMaterialPrice(m)}
                      className="p-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] cursor-pointer"
                      title="تعديل سعر الخامة"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {subTab === 'orders' && (
            filteredOrders.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#475569] dark:text-[#94A3B8]">لا توجد طلبيات مسجلة لهذه الورشة.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredOrders.map((o) => (
                  <div key={o.id} className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black">#{o.order_number || o.invoiceNumber || o.id}</span> — {o.customer_name || o.customerName || 'عميل'}
                    </div>
                    <span className="font-mono tabular-nums font-black text-[#C2410C] dark:text-[#FBBF24]">
                      {Number(o.total_amount ?? o.finalTotal ?? 0).toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

          {subTab === 'treasuries' && (
            (deepData?.treasuries || []).length === 0 ? (
              <p className="text-center py-8 text-xs text-[#475569] dark:text-[#94A3B8]">لا توجد خزائن مالية مسجلة لهذه الورشة.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {deepData!.treasuries.map((t: any) => (
                  <div key={t.id} className="p-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-1">
                    <h4 className="text-xs font-black">{t.name}</h4>
                    <p className="text-base font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-300">
                      {Number(t.balance ?? t.current_balance ?? 0).toLocaleString('ar-EG')} ج.م
                    </p>
                  </div>
                ))}
              </div>
            )
          )}

          {subTab === 'contacts' && (
            filteredContacts.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#475569] dark:text-[#94A3B8]">لا توجد جهات اتصال مطابقة.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredContacts.map((c: any) => (
                  <div key={c.id} className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs space-y-0.5">
                    <div className="font-black">{c.name}</div>
                    <div className="font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]">{c.phone || c.phoneNumber || '—'}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
