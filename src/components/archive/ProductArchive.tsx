import React, { useState, useEffect, useMemo } from 'react';
import { ProductSyncBadge } from '../common/ProductSyncBadge';
import { PRODUCTS_PULLED_EVENT } from '../../db/productSyncQueue';
import { SavedProductRecord, UserProfile } from '../../types';
import { CRAFT_CATEGORIES } from '../../utils/macrameMath';
import { tenantStorage } from '../../db/dexieDB';
import { SUB_CRAFTS_REGISTRY } from '../../registry/craftsRegistry';
import {
  FolderArchive,
  Search,
  Filter,
  Trash2,
  Share2,
  Layers,
  ArrowRight,
  BookOpen,
  Hammer,
  Check,
  CheckSquare,
  Square,
  Send,
} from 'lucide-react';

interface ProductArchiveProps {
  profile: UserProfile;
  onSelectRecordToLoad: (record: SavedProductRecord) => void;
  onOpenWhatsAppShare: (record: SavedProductRecord) => void;
  onNavigateToCatalog?: () => void;
  onNavigateToWorkOrders?: (rec?: SavedProductRecord) => void;
}

export const ProductArchive: React.FC<ProductArchiveProps> = ({
  profile,
  onSelectRecordToLoad,
  onOpenWhatsAppShare,
  onNavigateToCatalog,
  onNavigateToWorkOrders,
}) => {
  const [records, setRecords] = useState<SavedProductRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedCraftFilter, setSelectedCraftFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3800);
  };

  // Crafts available in archive (Includes all 6 crafts under ropes & textiles)
  const userCrafts = useMemo(() => {
    const textileCrafts = SUB_CRAFTS_REGISTRY.filter((c) => c.mainSectionId === 'ropes_textiles');
    const userSelected = SUB_CRAFTS_REGISTRY.filter((c) => profile.selectedCrafts?.includes(c.id));
    const map = new Map<string, any>();
    [...textileCrafts, ...userSelected].forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [profile.selectedCrafts]);

  const QUICK_TEXTILE_TABS = [
    { id: 'all', nameAr: 'كافة المشغولات (الكل)', icon: '🌟' },
    { id: 'macrame', nameAr: 'المكرمية والعقد', icon: '🪢' },
    { id: 'crochet', nameAr: 'الكروشيه المنزلي', icon: '🧶' },
    { id: 'zigzag', nameAr: 'حبال الزجزاج', icon: '🧵' },
    { id: 'kilim', nameAr: 'الكليم والنسيج', icon: '🪡' },
    { id: 'punch_needle', nameAr: 'البانش نيدل', icon: '🎨' },
    { id: 'tufting_gun', nameAr: 'مسدس التافت', icon: '🔫' },
  ];

  const loadRecords = async () => {
    setLoading(true);
    try {
      const items = await tenantStorage.getProducts(
        tenantId,
        selectedCategoryFilter,
        searchQuery
      );
      setRecords(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error(err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onPulled = (e: Event) => {
      if ((e as CustomEvent).detail?.workshopId === tenantId) loadRecords();
    };
    window.addEventListener(PRODUCTS_PULLED_EVENT, onPulled);
    return () => window.removeEventListener(PRODUCTS_PULLED_EVENT, onPulled);
  }, [tenantId, selectedCategoryFilter, searchQuery]);

  useEffect(() => {
    loadRecords();
  }, [tenantId, selectedCategoryFilter, searchQuery]);

  // Filter by selected craft
  const displayedRecords = useMemo(() => {
    if (selectedCraftFilter === 'all') return records;
    return records.filter((r) => {
      return (
        r.craftId === selectedCraftFilter ||
        r.craftName === selectedCraftFilter ||
        r.category === selectedCraftFilter ||
        r.productType === selectedCraftFilter
      );
    });
  }, [records, selectedCraftFilter]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedRecords.length && displayedRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedRecords.map((r) => r.id)));
    }
  };

  const handleBulkExportToCatalog = async () => {
    const targets = displayedRecords.filter((r) => selectedIds.has(r.id));
    if (targets.length === 0) return;

    for (const rec of targets) {
      const updated: SavedProductRecord = {
        ...rec,
        isCatalogVisible: true,
        updatedAt: Date.now(),
      };
      await tenantStorage.mutateProduct(updated);
    }
    setRecords((prev) =>
      prev.map((r) => (selectedIds.has(r.id) ? { ...r, isCatalogVisible: true } : r))
    );
    window.dispatchEvent(new CustomEvent('alshams_products_changed', { detail: { tenantId } }));
    const count = targets.length;
    setSelectedIds(new Set());
    flashNotice(`تم تصدير (${count}) بطاقة صنف إلى الكتالوج بنجاح — بدون نشر تلقائي للمتجر أو السوق.`);
  };

  const handleSingleExportToCatalog = async (rec: SavedProductRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: SavedProductRecord = {
      ...rec,
      isCatalogVisible: true,
      updatedAt: Date.now(),
    };
    await tenantStorage.mutateProduct(updated);
    setRecords((prev) => prev.map((r) => (r.id === rec.id ? updated : r)));
    window.dispatchEvent(new CustomEvent('alshams_products_changed', { detail: { tenantId } }));
    if (onNavigateToCatalog) {
      onNavigateToCatalog();
    } else {
      flashNotice(`تم نقل "${rec.productName}" إلى الكتالوج المرجعي بنجاح.`);
    }
  };

  const handleDelete = async (id: string) => {
    await tenantStorage.deleteProduct(tenantId, id);
    setConfirmDeleteId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    loadRecords();
    flashNotice('تم حذف بطاقة التصميم من الأرشيف.');
  };

  const getStageSummary = (rec: SavedProductRecord) => {
    if (rec.inMarket && rec.marketStatus === 'approved') return { label: 'في السوق (معتمد)', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' };
    if (rec.inMarket && rec.marketStatus === 'pending_approval') return { label: 'قيد مراجعة السوق', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' };
    if (rec.inStore) return { label: 'في المتجر', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
    if (rec.isCatalogVisible) return { label: 'في الكتالوج', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300' };
    return { label: 'كارت صنف بالأرشيف', cls: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' };
  };

  return (
    <div className="space-y-5 text-right" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-amber-600" />
            <span>أرشيف المنتجات (كارت الصنف)</span>
          </h2>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            هنا تحفظ بطاقات التصاميم والتكاليف من الحاسبة وصقر. حدّد أي كروت وصدّرها للكتالوج وقتما تشاء.
          </p>
        </div>
        <ProductSyncBadge workshopId={tenantId} />
      </div>

      {statusNotice && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400/60 px-4 py-2.5 text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{statusNotice}</span>
          </div>
          {onNavigateToCatalog && (
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-black cursor-pointer"
            >
              فتح الكتالوج الآن
            </button>
          )}
        </div>
      )}

      {/* Quick Craft Filter Tabs (الحبال والنسيج) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {QUICK_TEXTILE_TABS.map((tab) => {
          const isSelected = selectedCraftFilter === tab.id || (tab.id === 'kilim' && selectedCraftFilter === 'kelim');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCraftFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer border ${
                isSelected
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-amber-400/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.nameAr}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Category & Craft Filter Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:w-56 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <select
              value={selectedCraftFilter}
              onChange={(e) => setSelectedCraftFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none"
            >
              <option value="all">كافة الحِرف (الكل)</option>
              {userCrafts.map((craft) => (
                <option key={craft.id} value={craft.id}>
                  {craft.nameAr}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-56 flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none"
            >
              <option value="all">كافة التصنيفات (الكل)</option>
              {CRAFT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الموديل أو القطعة في أرشيف الورشة..."
              className="w-full px-3.5 py-2 pr-9 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Multi-select Bulk Actions Bar */}
        {displayedRecords.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-xs font-black text-stone-700 dark:text-stone-200 cursor-pointer"
            >
              {selectedIds.size === displayedRecords.length && displayedRecords.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-amber-600" />
              ) : (
                <Square className="w-4 h-4 text-stone-400" />
              )}
              <span>
                {selectedIds.size === displayedRecords.length
                  ? 'إلغاء تحديد الكل'
                  : `تحديد الكل (${displayedRecords.length})`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkExportToCatalog}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تصدير المحدد للكتالوج ({selectedIds.size})</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="text-center py-16 text-stone-400 text-xs">
          جاري استرجاع بطاقات التصاميم المحفوظة...
        </div>
      ) : displayedRecords.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-800 space-y-3">
          <FolderArchive className="w-12 h-12 text-amber-500/40 mx-auto" />
          <h3 className="font-bold text-sm text-stone-700 dark:text-stone-300">
            {records.length === 0
              ? 'لا توجد بطاقات إنتاج محفوظة في الأرشيف'
              : 'لا توجد منتجات مطابقة لفلتر الحرفة أو البحث'}
          </h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            احفظ تصميمك الأول من حاسبة الإنتاج وسيتم أرشفته هنا ككارت صنف جاهز للتعديل
            أو التصدير للكتالوج في أي وقت.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedRecords.map((rec) => {
            const safeOut = (rec.output || {}) as any;
            const strandsCount = Number(safeOut.baseStrandsCount ?? 0);
            const strandLen = Number(safeOut.singleStrandLengthCm ?? 0);
            const weightKg = Number(
              safeOut.totalWeightKg !== undefined
                ? safeOut.totalWeightKg
                : safeOut.totalWeightGrams
                ? Number(safeOut.totalWeightGrams) / 1000
                : 0
            );
            const retailPriceVal = Number(rec.retailPrice ?? safeOut.finalSellingPrice ?? 0);
            const isSelected = selectedIds.has(rec.id);
            const stage = getStageSummary(rec);

            return (
              <div
                key={rec.id}
                onClick={() => onSelectRecordToLoad(rec)}
                className={`group cursor-pointer rounded-3xl bg-white dark:bg-stone-900 border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between text-right p-5 relative artisan-card-hover ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-400/50'
                    : 'border-stone-200/90 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-600'
                }`}
              >
                <div>
                  {/* Header tags & checkbox */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => toggleSelect(rec.id, e)}
                        className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        title="تحديد للتصدير للكتالوج"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-600" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-400" />
                        )}
                      </button>
                      {rec.productSerialNumber && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-mono border border-amber-300/50">
                          #{rec.productSerialNumber}
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                        {rec.craftName || rec.category || 'عام'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${stage.cls}`}>
                      {stage.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-black text-base text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition mb-2">
                    {rec.productName || 'بطاقة صنف'}
                  </h4>

                  {/* Key Specs */}
                  <div className="grid grid-cols-3 gap-1.5 py-2.5 border-y border-stone-100 dark:border-stone-800/80 text-center my-2 text-stone-600 dark:text-stone-300">
                    <div className="p-1 rounded-lg bg-stone-50 dark:bg-stone-800/40">
                      <span className="text-[9px] text-stone-400 block">الفتلات / الوحدات</span>
                      <span className="font-mono font-bold text-xs">
                        {strandsCount > 0 ? strandsCount : '—'}
                      </span>
                    </div>
                    <div className="p-1 rounded-lg bg-stone-50 dark:bg-stone-800/40">
                      <span className="text-[9px] text-stone-400 block">طول القص</span>
                      <span className="font-mono font-bold text-xs">
                        {strandLen > 0 ? `${strandLen} سم` : '—'}
                      </span>
                    </div>
                    <div className="p-1 rounded-lg bg-stone-50 dark:bg-stone-800/40">
                      <span className="text-[9px] text-stone-400 block">الوزن</span>
                      <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                        {Number.isFinite(weightKg) ? weightKg.toFixed(2) : '0.00'} كجم
                      </span>
                    </div>
                  </div>

                  {/* Selling Price & Wholesale */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-stone-500 font-medium">سعر القطاعي:</span>
                      <div className="text-left font-mono">
                        <span className="text-lg font-black text-amber-700 dark:text-amber-400">
                          {retailPriceVal}
                        </span>
                        <span className="text-xs text-stone-500 mr-1">{profile.currencySymbol}</span>
                      </div>
                    </div>
                    {rec.wholesalePrice ? (
                      <div className="flex items-baseline justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        <span className="text-[11px] text-stone-400 font-normal">سعر الجملة:</span>
                        <div className="text-left font-mono">
                          <span>{rec.wholesalePrice}</span>
                          <span className="text-[10px] mr-0.5">{profile.currencySymbol}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Inline Delete Confirmation */}
                {confirmDeleteId === rec.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-rose-800 dark:text-rose-200">حذف الكارت؟</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(rec.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black cursor-pointer"
                      >
                        تأكيد
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Footer Actions */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenWhatsAppShare(rec);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                      title="مشاركة عرض السعر"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>واتساب</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleSingleExportToCatalog(rec, e)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        rec.isCatalogVisible
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border-sky-300/50'
                      }`}
                      title="تصدير وعرض في الكتالوج المرجعي"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>{rec.isCatalogVisible ? 'بالكتالوج' : 'نقل للكتالوج'}</span>
                    </button>

                    {onNavigateToWorkOrders && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToWorkOrders(rec);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 text-orange-700 dark:text-orange-300 border border-orange-300/50 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        title="فتح أمر تشغيل للمشغولة"
                      >
                        <Hammer className="w-3 h-3" />
                        <span>أمر تشغيل</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(rec.id);
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                      title="حذف من الأرشيف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                      <span>فتح وتعديل</span>
                      <ArrowRight className="w-3.5 h-3.5 transform rotate-180" />
                    </span>
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
