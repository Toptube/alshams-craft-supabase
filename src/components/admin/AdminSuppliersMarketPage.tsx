import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Boxes,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Megaphone,
  Palette,
  Pin,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  MARKET_THEME_PRESETS,
  MarketThemePresetId,
} from '../../types/marketplaceBuilder';
import {
  DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG,
  SuppliersMarketBuilderConfig,
  getStoredSuppliersMarketBuilderConfig,
  saveStoredSuppliersMarketBuilderConfig,
} from '../../types/suppliersMarketBuilder';
import {
  AdminSuppliersMarketCatalogRow,
  AdminSuppliersMarketOrderRow,
  AdminSuppliersMarketOverview,
  AdminSuppliersMarketReviewRow,
  adminDeleteOfferAlert,
  adminDeleteSupplierReview,
  adminPublishOfferAlert,
  adminUpdateB2BOrderStatus,
  adminUpdateSupplierCatalogItem,
  fetchAdminSuppliersMarketOverview,
  updateSupplierVisibility,
} from '../../db/supplierService';
import { SUPPLIER_SUPPLY_SECTIONS } from '../../types/supplier';

interface AdminSuppliersMarketPageProps {
  userEmail?: string;
  onBack: () => void;
  onSaveSuppliersMarketSettings: (cfg: SuppliersMarketBuilderConfig) => Promise<void>;
  savingMarketSettings: boolean;
  suppliersMarketUrl: string;
  onCopySuppliersMarketUrl: () => void;
  onShareSuppliersMarketWhatsApp: () => void;
  onDownloadSuppliersMarketPoster: () => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

type SuppliersBuilderTabId =
  | 'builder'
  | 'sections_featured'
  | 'catalog_moderation'
  | 'offers_reviews'
  | 'orders_b2b'
  | 'qr_poster';

const B2B_STATUS_LABELS: Record<string, string> = {
  pending: 'معلق بانتظار المورد',
  confirmed: 'مؤكد',
  preparing: 'جاري التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  received: 'مستلم بالمخزن',
  cancelled: 'ملغي',
};

export const AdminSuppliersMarketPage: React.FC<AdminSuppliersMarketPageProps> = ({
  userEmail,
  onBack,
  onSaveSuppliersMarketSettings,
  savingMarketSettings,
  suppliersMarketUrl,
  onCopySuppliersMarketUrl,
  onShareSuppliersMarketWhatsApp,
  onDownloadSuppliersMarketPoster,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [activeTab, setActiveTab] = useState<SuppliersBuilderTabId>('builder');
  const [builder, setBuilder] = useState<SuppliersMarketBuilderConfig>(() =>
    getStoredSuppliersMarketBuilderConfig()
  );
  const [dragBlockIndex, setDragBlockIndex] = useState<number | null>(null);
  const [dragSectionIndex, setDragSectionIndex] = useState<number | null>(null);

  const [overview, setOverview] = useState<AdminSuppliersMarketOverview>({
    suppliers: [],
    catalogItems: [],
    offerAlerts: [],
    reviews: [],
    b2bOrders: [],
  });
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Filters
  const [supplierPinSearch, setSupplierPinSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSectionFilter, setCatalogSectionFilter] = useState('all');
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [reviewSearch, setReviewSearch] = useState('');

  // Official Alert Composer
  const [newAlertTitle, setNewAlertTitle] = useState('');
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [newAlertBadge, setNewAlertBadge] = useState('');
  const [newAlertType, setNewAlertType] = useState<'offer' | 'new_arrival' | 'price_drop'>('offer');
  const [publishingAlert, setPublishingAlert] = useState(false);

  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await fetchAdminSuppliersMarketOverview(userEmail);
      setOverview(res);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [userEmail]);

  useEffect(() => {
    const syncListener = (e: any) => {
      if (e?.detail) setBuilder(e.detail);
    };
    window.addEventListener('alshams_suppliers_market_builder_updated', syncListener);
    return () => window.removeEventListener('alshams_suppliers_market_builder_updated', syncListener);
  }, []);

  const applyAndSaveBuilder = async (cfgToSave: SuppliersMarketBuilderConfig) => {
    const stamped = { ...cfgToSave, updatedAt: new Date().toISOString() };
    setBuilder(stamped);
    saveStoredSuppliersMarketBuilderConfig(stamped);
    await onSaveSuppliersMarketSettings(stamped);
  };

  const reorderArray = <T,>(arr: T[], fromIdx: number, toIdx: number): T[] => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return arr;
    const copy = [...arr];
    const [item] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, item);
    return copy;
  };

  const activeThemeMeta =
    MARKET_THEME_PRESETS[builder.themePreset || 'shams_sand'] || MARKET_THEME_PRESETS.shams_sand;

  const toggleFeaturedSupplier = (supplierId: string) => {
    setBuilder((prev) => {
      const exists = prev.featuredSupplierIds.includes(supplierId);
      const nextIds = exists
        ? prev.featuredSupplierIds.filter((id) => id !== supplierId)
        : [supplierId, ...prev.featuredSupplierIds];
      return { ...prev, featuredSupplierIds: nextIds };
    });
  };

  const handleToggleItemMarketVisibility = async (item: AdminSuppliersMarketCatalogRow) => {
    const nextInMarket = !item.inMarket;
    const res = await adminUpdateSupplierCatalogItem(
      item.id,
      { inMarket: nextInMarket, ...(nextInMarket ? { isApproved: true } : {}) },
      userEmail
    );
    if (res.success) {
      setOverview((prev) => ({
        ...prev,
        catalogItems: prev.catalogItems.map((it) =>
          it.id === item.id
            ? { ...it, inMarket: nextInMarket, ...(nextInMarket ? { isApproved: true } : {}) }
            : it
        ),
      }));
      onNotifySuccess(
        nextInMarket
          ? `تم اعتماد وإظهار خامة "${item.name}" في سوق موردين الشمساوية.`
          : `تم إخفاء خامة "${item.name}" من سوق موردين الشمساوية.`
      );
    } else {
      onNotifyError(res.error || 'تعذر تحديث حالة الخامة');
    }
  };

  const handleApprovePendingItem = async (item: AdminSuppliersMarketCatalogRow) => {
    const res = await adminUpdateSupplierCatalogItem(
      item.id,
      { inMarket: true, isApproved: true },
      userEmail
    );
    if (res.success) {
      setOverview((prev) => ({
        ...prev,
        catalogItems: prev.catalogItems.map((it) =>
          it.id === item.id ? { ...it, inMarket: true, isApproved: true } : it
        ),
      }));
      onNotifySuccess(`✓ تم اعتماد ونشر خامة "${item.name}" في سوق موردين الشمساوية!`);
    } else {
      onNotifyError(res.error || 'تعذر اعتماد الخامة');
    }
  };

  const handleToggleSupplierVisibility = async (
    supplierId: string,
    field: 'hideStorefront' | 'hideFromMarket',
    currentVal: boolean
  ) => {
    const nextVal = !currentVal;
    const payload =
      field === 'hideStorefront' ? { hideStorefront: nextVal } : { hideFromMarket: nextVal };
    const res = await updateSupplierVisibility(supplierId, payload, userEmail);
    if (res.success) {
      setOverview((prev) => ({
        ...prev,
        suppliers: prev.suppliers.map((s) =>
          s.id === supplierId
            ? {
                ...s,
                ...(field === 'hideStorefront'
                  ? { hideStorefront: nextVal }
                  : { hideFromMarket: nextVal }),
              }
            : s
        ),
      }));
      onNotifySuccess(
        field === 'hideFromMarket'
          ? nextVal
            ? 'تم إخفاء المورد وخاماته من سوق موردين الشمساوية.'
            : 'تم إعادة إظهار المورد في سوق موردين الشمساوية.'
          : nextVal
          ? 'تم إخفاء المتجر المستقل للمورد مؤقتاً.'
          : 'تم إعادة فتح المتجر المستقل للمورد.'
      );
    } else {
      onNotifyError(res.error || 'تعذر تحديث ظهور المورد');
    }
  };

  const handlePublishOfficialAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertTitle.trim() || !newAlertMessage.trim()) {
      onNotifyError('يرجى إدخال عنوان ونص الإعلان قبل النشر.');
      return;
    }
    setPublishingAlert(true);
    try {
      const res = await adminPublishOfferAlert(
        {
          supplierId: 'central_admin',
          supplierBrand: 'إدارة سوق موردين الشمساوية',
          alertType: newAlertType,
          title: newAlertTitle.trim(),
          message: newAlertMessage.trim(),
          discountBadge: newAlertBadge.trim(),
          sectionId: 'all',
        },
        userEmail
      );
      if (res.success && res.alert) {
        setOverview((prev) => ({
          ...prev,
          offerAlerts: [res.alert!, ...prev.offerAlerts],
        }));
        setNewAlertTitle('');
        setNewAlertMessage('');
        setNewAlertBadge('');
        onNotifySuccess('تم نشر التنبيه المركزي في شريط عروض سوق الموردين بنجاح.');
      } else {
        onNotifyError(res.error || 'تعذر نشر التنبيه');
      }
    } finally {
      setPublishingAlert(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    const res = await adminDeleteOfferAlert(alertId, userEmail);
    if (res.success) {
      setOverview((prev) => ({
        ...prev,
        offerAlerts: prev.offerAlerts.filter((a) => a.id !== alertId),
      }));
      onNotifySuccess('تم حذف التنبيه من سوق الموردين.');
    } else {
      onNotifyError(res.error || 'تعذر حذف التنبيه');
    }
  };

  const handleDeleteReview = async (rev: AdminSuppliersMarketReviewRow) => {
    const res = await adminDeleteSupplierReview(rev.id, userEmail);
    if (res.success) {
      setOverview((prev) => ({
        ...prev,
        reviews: prev.reviews.filter((r) => r.id !== rev.id),
      }));
      onNotifySuccess('تم حذف التقييم وتحديث متوسط المورد.');
    } else {
      onNotifyError(res.error || 'تعذر حذف التقييم');
    }
  };

  const handleUpdateOrderStatus = async (ord: AdminSuppliersMarketOrderRow, nextStatus: string) => {
    const res = await adminUpdateB2BOrderStatus(ord.id, { status: nextStatus }, userEmail);
    if (res.success) {
      setOverview((prev) => ({
        ...prev,
        b2bOrders: prev.b2bOrders.map((o) =>
          o.id === ord.id ? { ...o, status: nextStatus as any } : o
        ),
      }));
      onNotifySuccess(`تم تحديث حالة طلب التوريد #${ord.orderNumber} بنجاح.`);
    } else {
      onNotifyError(res.error || 'تعذر تحديث حالة الطلب');
    }
  };

  const filteredSuppliers = useMemo(() => {
    const q = supplierPinSearch.trim().toLowerCase();
    if (!q) return overview.suppliers;
    return overview.suppliers.filter(
      (s) =>
        (s.brandName || '').toLowerCase().includes(q) ||
        (s.ownerName || '').toLowerCase().includes(q) ||
        (s.governorate || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q)
    );
  }, [overview.suppliers, supplierPinSearch]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return overview.catalogItems.filter((it) => {
      if (catalogSectionFilter !== 'all' && it.sectionId !== catalogSectionFilter) return false;
      if (catalogStatusFilter === 'visible' && (!it.inMarket || !it.isApproved)) return false;
      if ((catalogStatusFilter as string) === 'pending' && (!it.inMarket || it.isApproved)) return false;
      if (catalogStatusFilter === 'hidden' && it.inMarket) return false;
      if (!q) return true;
      return (
        (it.name || '').toLowerCase().includes(q) ||
        (it.supplierBrandName || '').toLowerCase().includes(q) ||
        (it.description || '').toLowerCase().includes(q)
      );
    });
  }, [overview.catalogItems, catalogSearch, catalogSectionFilter, catalogStatusFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return overview.b2bOrders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.supplierBrandName || '').toLowerCase().includes(q) ||
        (o.externalBuyer?.workshopBrand || '').toLowerCase().includes(q) ||
        (o.externalBuyer?.name || '').toLowerCase().includes(q)
      );
    });
  }, [overview.b2bOrders, orderSearch, orderStatusFilter]);

  const filteredReviews = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    if (!q) return overview.reviews;
    return overview.reviews.filter(
      (r) =>
        (r.supplierBrandName || '').toLowerCase().includes(q) ||
        (r.reviewerBrand || '').toLowerCase().includes(q) ||
        (r.reviewerName || '').toLowerCase().includes(q) ||
        (r.comment || '').toLowerCase().includes(q)
    );
  }, [overview.reviews, reviewSearch]);

  const builderTabs: { id: SuppliersBuilderTabId; label: string }[] = [
    { id: 'builder', label: 'الواجهة والثيمات' },
    {
      id: 'sections_featured',
      label: `الأقسام والمميزون (${builder.featuredSupplierIds.length})`,
    },
    {
      id: 'catalog_moderation',
      label: `الخامات والأسعار (${overview.catalogItems.length})`,
    },
    {
      id: 'offers_reviews',
      label: `العروض والتقييمات (${overview.offerAlerts.length + overview.reviews.length})`,
    },
    {
      id: 'orders_b2b',
      label: `أوردرات التوريد B2B (${overview.b2bOrders.length})`,
    },
    { id: 'qr_poster', label: 'QR وبوستر موردين الشمساوية' },
  ];

  const getTickerBgStyle = (hex?: string) => {
    if (hex === '#EA580C') return { backgroundColor: '#EA580C', color: '#FFFFFF' };
    if (hex === '#065F46') return { backgroundColor: '#065F46', color: '#FFFFFF' };
    if (hex === '#E9E2D4') return { backgroundColor: '#E9E2D4', color: '#0C1427' };
    return { backgroundColor: '#0C1427', color: '#FBBF24' };
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12" dir="rtl">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 cursor-pointer min-h-[40px]"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>رجوع</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            aria-label="إغلاق"
            title="إغلاق"
            className="w-10 h-10 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>لوحة تحكم موردين الشمساوية (B2B Market Builder)</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadOverview}
            className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold flex items-center gap-1.5 cursor-pointer min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin text-[#EA580C]' : ''}`} />
            <span>تحديث البيانات</span>
          </button>

          <a
            href={suppliersMarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 min-h-[40px]"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>معاينة سوق الموردين</span>
          </a>

          <button
            type="button"
            disabled={savingMarketSettings}
            onClick={() => applyAndSaveBuilder(builder)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60 min-h-[40px]"
          >
            <Save className="w-4 h-4" />
            <span>{savingMarketSettings ? 'جاري النشر...' : 'حفظ ونشر على سوق الموردين فوراً'}</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {builderTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap border transition cursor-pointer shrink-0 min-h-[40px] ${
              activeTab === t.id
                ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C]'
                : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Builder Themes, Layout Blocks, Ticker & Hero */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Controls */}
          <div className="lg:col-span-7 space-y-5">
            {/* Theme Swatches */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>ثيمات وهوية سوق موردين الشمساوية</span>
                </h2>
                <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  الثيم الحالي: {activeThemeMeta.nameAr}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(Object.keys(MARKET_THEME_PRESETS) as MarketThemePresetId[]).map((presetId) => {
                  const t = MARKET_THEME_PRESETS[presetId];
                  const isSelected = builder.themePreset === presetId;
                  return (
                    <button
                      key={presetId}
                      type="button"
                      onClick={() => setBuilder((prev) => ({ ...prev, themePreset: presetId }))}
                      className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? 'border-[#EA580C] ring-2 ring-[#EA580C]/25 bg-[#EFE9DC] dark:bg-[#132040]'
                          : 'border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/60 dark:bg-[#132040]/50 hover:border-[#EA580C]/60'
                      }`}
                    >
                      <div
                        className="w-full h-14 rounded-lg border p-1.5 flex flex-col justify-between overflow-hidden"
                        style={{ backgroundColor: t.pageBgLight, borderColor: t.borderLight }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="h-2 w-10 rounded-sm" style={{ backgroundColor: t.inkLight }} />
                          <span className="h-2.5 w-6 rounded-sm" style={{ backgroundColor: t.accentBg }} />
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className="h-6 rounded border" style={{ backgroundColor: t.surfaceLight, borderColor: t.borderLight }} />
                          <div className="h-6 rounded border" style={{ backgroundColor: t.surfaceLight, borderColor: t.borderLight }} />
                          <div className="h-6 rounded border" style={{ backgroundColor: t.pageBgDark, borderColor: t.borderDark }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black truncate">{t.nameAr}</p>
                          <p className="text-[9px] text-[#475569] dark:text-[#94A3B8] truncate">{t.subtitleAr}</p>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drag & Drop Page Blocks */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>ترتيب وظهور عناصر سوق الموردين (اسحب وأفلت)</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setBuilder({ ...DEFAULT_SUPPLIERS_MARKET_BUILDER_CONFIG })}
                  className="text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة الافتراضي</span>
                </button>
              </div>

              <div className="space-y-2">
                {builder.pageBlocksOrder.map((block, idx) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => setDragBlockIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragBlockIndex !== null) {
                        setBuilder((prev) => ({
                          ...prev,
                          pageBlocksOrder: reorderArray(prev.pageBlocksOrder, dragBlockIndex, idx),
                        }));
                        setDragBlockIndex(null);
                      }
                    }}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border ${
                      dragBlockIndex === idx
                        ? 'border-[#EA580C] ring-2 ring-[#EA580C]/25'
                        : 'border-[#D4CCBC] dark:border-[#22355E]'
                    } cursor-grab active:cursor-grabbing`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-4 h-4 text-[#64748B] shrink-0" />
                      <span className="text-xs font-black truncate">{block.labelAr}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setBuilder((prev) => ({
                            ...prev,
                            pageBlocksOrder: reorderArray(prev.pageBlocksOrder, idx, idx - 1),
                          }))
                        }
                        className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === builder.pageBlocksOrder.length - 1}
                        onClick={() =>
                          setBuilder((prev) => ({
                            ...prev,
                            pageBlocksOrder: reorderArray(prev.pageBlocksOrder, idx, idx + 1),
                          }))
                        }
                        className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBuilder((prev) => ({
                            ...prev,
                            pageBlocksOrder: prev.pageBlocksOrder.map((b) =>
                              b.id === block.id ? { ...b, enabled: !b.enabled } : b
                            ),
                            ...(block.id === 'hero' ? { heroEnabled: !block.enabled } : {}),
                            ...(block.id === 'ticker'
                              ? { tickerBanner: { ...prev.tickerBanner, enabled: !block.enabled } }
                              : {}),
                          }))
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer ${
                          block.enabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-stone-300 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {block.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{block.enabled ? 'ظاهر' : 'مخفي'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero, Ticker & Market Mode Controls */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
              <h2 className="text-sm font-black">نصوص الواجهة، الشريط الإخباري، ووضع التشغيل</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold block mb-1">حالة سوق موردين الشمساوية</label>
                  <select
                    value={builder.marketStatus}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        marketStatus: e.target.value as 'open' | 'maintenance',
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value="open">مفتوح ومفعل للورش والتوريد</option>
                    <option value="maintenance">وضع الصيانة والتحديث المؤقت</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold block mb-1">العرض الافتراضي عند الفتح</label>
                  <select
                    value={builder.defaultViewMode}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        defaultViewMode: e.target.value as 'suppliers' | 'materials' | 'compare',
                      }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value="suppliers">دليل الموردين</option>
                    <option value="materials">كافة الخامات المعروضة</option>
                    <option value="compare">مقارنة أسعار الموردين</option>
                  </select>
                </div>
              </div>

              {builder.marketStatus === 'maintenance' && (
                <div>
                  <label className="text-[11px] font-bold block mb-1">رسالة الصيانة للزوار والورش</label>
                  <input
                    type="text"
                    value={builder.maintenanceMessage}
                    onChange={(e) =>
                      setBuilder((prev) => ({ ...prev, maintenanceMessage: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black">الشريط الإعلاني العلوي (Ticker)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        tickerBanner: { ...prev.tickerBanner, enabled: !prev.tickerBanner.enabled },
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                      builder.tickerBanner.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-300 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {builder.tickerBanner.enabled ? 'مفعل' : 'معطل'}
                  </button>
                </div>
                <input
                  type="text"
                  value={builder.tickerBanner.text}
                  onChange={(e) =>
                    setBuilder((prev) => ({
                      ...prev,
                      tickerBanner: { ...prev.tickerBanner, text: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span>لون الشريط:</span>
                  {['#0C1427', '#EA580C', '#065F46', '#E9E2D4'].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        setBuilder((prev) => ({
                          ...prev,
                          tickerBanner: { ...prev.tickerBanner, bgColor: hex },
                        }))
                      }
                      className={`w-6 h-6 rounded-lg border cursor-pointer ${
                        builder.tickerBanner.bgColor === hex ? 'ring-2 ring-[#EA580C]' : 'border-[#D4CCBC]'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
                <div>
                  <label className="text-[11px] font-bold block mb-1">العنوان التعريفي الصغير (Eyebrow)</label>
                  <input
                    type="text"
                    value={builder.heroEyebrow}
                    onChange={(e) => setBuilder((prev) => ({ ...prev, heroEyebrow: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold block mb-1">العنوان الرئيسي للسوق (Hero Title)</label>
                  <input
                    type="text"
                    value={builder.heroTitle}
                    onChange={(e) => setBuilder((prev) => ({ ...prev, heroTitle: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold block mb-1">الوصف المختصر أسفل العنوان</label>
                  <textarea
                    rows={2}
                    value={builder.heroSubtitle}
                    onChange={(e) => setBuilder((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-4">
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#EA580C]" />
                  <span>معاينة حية لواجهة سوق الموردين</span>
                </span>
                <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  {builder.marketStatus === 'maintenance' ? 'وضع الصيانة' : 'يعمل الآن'}
                </span>
              </div>

              <div
                className="rounded-xl border overflow-hidden space-y-3 p-3"
                style={{
                  backgroundColor: activeThemeMeta.pageBgLight,
                  borderColor: activeThemeMeta.borderLight,
                  color: activeThemeMeta.inkLight,
                }}
              >
                {builder.tickerBanner.enabled && (
                  <div
                    className="rounded-lg px-3 py-1.5 text-[10px] font-black truncate text-center"
                    style={getTickerBgStyle(builder.tickerBanner.bgColor)}
                  >
                    {builder.tickerBanner.text}
                  </div>
                )}

                {builder.heroEnabled && (
                  <div
                    className="rounded-xl p-3 border space-y-1"
                    style={{
                      backgroundColor: activeThemeMeta.surfaceLight,
                      borderColor: activeThemeMeta.borderLight,
                    }}
                  >
                    <p
                      className="text-[10px] font-black"
                      style={{ color: activeThemeMeta.accentTextLight }}
                    >
                      {builder.heroEyebrow}
                    </p>
                    <p className="text-sm font-black">{builder.heroTitle}</p>
                    <p className="text-[10px] opacity-80 line-clamp-2">{builder.heroSubtitle}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-black text-center">
                  <div
                    className="p-2 rounded-lg border"
                    style={{
                      backgroundColor:
                        builder.defaultViewMode === 'suppliers'
                          ? activeThemeMeta.accentBg
                          : activeThemeMeta.surfaceLight,
                      color:
                        builder.defaultViewMode === 'suppliers'
                          ? '#FFFFFF'
                          : activeThemeMeta.inkLight,
                      borderColor: activeThemeMeta.borderLight,
                    }}
                  >
                    دليل الموردين ({overview.suppliers.length})
                  </div>
                  <div
                    className="p-2 rounded-lg border"
                    style={{
                      backgroundColor:
                        builder.defaultViewMode === 'materials'
                          ? activeThemeMeta.accentBg
                          : activeThemeMeta.surfaceLight,
                      color:
                        builder.defaultViewMode === 'materials'
                          ? '#FFFFFF'
                          : activeThemeMeta.inkLight,
                      borderColor: activeThemeMeta.borderLight,
                    }}
                  >
                    الخامات ({overview.catalogItems.length})
                  </div>
                  <div
                    className="p-2 rounded-lg border"
                    style={{
                      backgroundColor:
                        builder.defaultViewMode === 'compare'
                          ? activeThemeMeta.accentBg
                          : activeThemeMeta.surfaceLight,
                      color:
                        builder.defaultViewMode === 'compare'
                          ? '#FFFFFF'
                          : activeThemeMeta.inkLight,
                      borderColor: activeThemeMeta.borderLight,
                    }}
                  >
                    مقارنة الأسعار
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold pt-1">
                  <div className="p-2 rounded-lg bg-white/80 border border-black/10">
                    <span className="block opacity-65">الأقسام المفعلة</span>
                    <span className="font-mono tabular-nums font-black">
                      {builder.sectionsOrder.filter((s) => s.enabled).length} / {builder.sectionsOrder.length}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 border border-black/10">
                    <span className="block opacity-65">الموردون المميزون</span>
                    <span className="font-mono tabular-nums font-black">
                      {builder.featuredSupplierIds.length} مورد
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Feature Toggles */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5">
              <h3 className="text-xs font-black flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#EA580C]" />
                <span>مفاتيح مميزات سوق الموردين</span>
              </h3>
              {(
                [
                  ['showOfferAlertsStrip', 'إظهار شريط تنبيهات العروض والوصول الجديد'],
                  ['showComparisonTab', 'إتاحة تبويب مقارنة أسعار الموردين'],
                  ['showWorkshopReviews', 'إظهار تقييمات ونجوم الورش للموردين'],
                  ['showTierPricingBadges', 'إبراز شرائح تسعير الكميات في القوائم'],
                  ['allowGuestBrowsing', 'السماح بتصفح الأسعار للزوار قبل تسجيل الدخول'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer text-xs font-bold"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={builder.featureToggles[key]}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        featureToggles: { ...prev.featureToggles, [key]: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-[#EA580C]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Sections Order & Featured Suppliers */}
      {activeTab === 'sections_featured' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Supply Sections Reorder & Rename */}
          <div className="lg:col-span-6 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#EA580C]" />
              <span>أقسام الخامات (تعديل الأسماء، الترتيب، والظهور)</span>
            </h2>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              اسحب وأفلت أو استخدم الأسهم لترتيب أقسام الخامات كما تظهر للورش في سوق موردين الشمساوية.
            </p>

            <div className="space-y-2.5">
              {builder.sectionsOrder.map((sec, idx) => (
                <div
                  key={sec.id}
                  draggable
                  onDragStart={() => setDragSectionIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragSectionIndex !== null) {
                      setBuilder((prev) => ({
                        ...prev,
                        sectionsOrder: reorderArray(prev.sectionsOrder, dragSectionIndex, idx),
                      }));
                      setDragSectionIndex(null);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-2 cursor-grab"
                >
                  <GripVertical className="w-4 h-4 text-[#64748B] shrink-0" />
                  <input
                    type="text"
                    value={sec.titleAr}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        sectionsOrder: prev.sectionsOrder.map((s) =>
                          s.id === sec.id ? { ...s, titleAr: e.target.value } : s
                        ),
                      }))
                    }
                    className="flex-1 h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        sectionsOrder: reorderArray(prev.sectionsOrder, idx, idx - 1),
                      }))
                    }
                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === builder.sectionsOrder.length - 1}
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        sectionsOrder: reorderArray(prev.sectionsOrder, idx, idx + 1),
                      }))
                    }
                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        sectionsOrder: prev.sectionsOrder.map((s) =>
                          s.id === sec.id ? { ...s, enabled: !s.enabled } : s
                        ),
                      }))
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${
                      sec.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-300 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {sec.enabled ? 'ظاهر' : 'مخفي'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pin / Feature Suppliers */}
          <div className="lg:col-span-6 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Pin className="w-4 h-4 text-[#EA580C]" />
              <span>تثبيت الموردين المميزين في صدارة السوق ({builder.featuredSupplierIds.length})</span>
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={supplierPinSearch}
                onChange={(e) => setSupplierPinSearch(e.target.value)}
                placeholder="ابحث باسم المورد أو المحافظة أو الهاتف..."
                className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>

            {filteredSuppliers.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-[#475569]">
                لا يوجد موردون مسجلون حالياً.
              </p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredSuppliers.map((sup) => {
                  const isFeatured = builder.featuredSupplierIds.includes(sup.id);
                  return (
                    <div
                      key={sup.id}
                      className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black truncate">{sup.brandName}</p>
                        <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] truncate">
                          {sup.ownerName} · {sup.governorate || sup.country} ·{' '}
                          <span className="font-mono tabular-nums">{(sup.ratingStars || 5).toFixed(1)}★</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleFeaturedSupplier(sup.id)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer flex items-center gap-1 ${
                            isFeatured
                              ? 'bg-[#EA580C] text-white'
                              : 'bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]'
                          }`}
                        >
                          <Pin className="w-3 h-3" />
                          <span>{isFeatured ? 'مثبت في الصدارة' : 'تثبيت كمميز'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Raw Materials Catalog & Supplier Visibility Moderation */}
      {activeTab === 'catalog_moderation' && (
        <div className="space-y-4">
          {/* Quick Supplier Visibility Bar */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Store className="w-4 h-4 text-[#EA580C]" />
              <span>التحكم السريع في ظهور الموردين بالسوق العام والمتاجر الخاصة</span>
            </h2>
            {overview.suppliers.length === 0 ? (
              <p className="text-xs text-[#475569] py-3">لا يوجد موردون حالياً.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {overview.suppliers.map((sup) => (
                  <div
                    key={sup.id}
                    className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black truncate">{sup.brandName}</p>
                        <p className="text-[10px] text-[#475569] dark:text-[#94A3B8] truncate">
                          {sup.governorate || sup.country} · {sup.status === 'active' ? 'نشط' : sup.status}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSupplierVisibility(
                            sup.id,
                            'hideFromMarket',
                            Boolean(sup.hideFromMarket)
                          )
                        }
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black cursor-pointer flex items-center justify-center gap-1 ${
                          sup.hideFromMarket
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {sup.hideFromMarket ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{sup.hideFromMarket ? 'مخفي من السوق' : 'ظاهر بالسوق'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSupplierVisibility(
                            sup.id,
                            'hideStorefront',
                            Boolean(sup.hideStorefront)
                          )
                        }
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black cursor-pointer flex items-center justify-center gap-1 ${
                          sup.hideStorefront
                            ? 'bg-amber-600 text-white'
                            : 'bg-[#0C1427] text-white dark:bg-[#1A2B54]'
                        }`}
                      >
                        {sup.hideStorefront ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{sup.hideStorefront ? 'متجره مخفي' : 'متجره ظاهر'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Catalog Items Table */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="بحث باسم الخامة، المورد، أو الوصف..."
                  className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <select
                value={catalogSectionFilter}
                onChange={(e) => setCatalogSectionFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كل أقسام الخامات</option>
                {SUPPLIER_SUPPLY_SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titleAr}
                  </option>
                ))}
              </select>
              <select
                value={catalogStatusFilter}
                onChange={(e) => setCatalogStatusFilter(e.target.value as any)}
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">
                  بانتظار الاعتماد ({overview.catalogItems.filter((x) => x.inMarket && !x.isApproved).length})
                </option>
                <option value="visible">معروضة في سوق الموردين</option>
                <option value="hidden">مخفية عن السوق</option>
              </select>
            </div>

            {filteredCatalog.length === 0 ? (
              <p className="py-10 text-center text-xs font-bold text-[#475569]">
                لا توجد خامات مطابقة لخيارات البحث الحالية.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D4CCBC] dark:border-[#22355E]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
                    <tr>
                      <th className="p-3 font-black">الخامة</th>
                      <th className="p-3 font-black">المورد</th>
                      <th className="p-3 font-black">القطاعي</th>
                      <th className="p-3 font-black">الجملة / شرائح</th>
                      <th className="p-3 font-black">المخزون</th>
                      <th className="p-3 font-black">الحالة والاعتماد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                    {filteredCatalog.map((it) => {
                      const isPending = it.inMarket && !it.isApproved;
                      const isLive = it.inMarket && it.isApproved;
                      return (
                        <tr key={it.id} className="hover:bg-[#EFE9DC]/40 dark:hover:bg-[#132040]/40">
                          <td className="p-3">
                            <div className="font-black">{it.name}</div>
                            <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">/{it.unit}</div>
                          </td>
                          <td className="p-3 font-bold">
                            {it.supplierBrandName}
                            {it.supplierGovernorate ? ` · ${it.supplierGovernorate}` : ''}
                          </td>
                          <td className="p-3 font-mono tabular-nums font-bold">
                            {it.retailPrice.toLocaleString('ar-EG')} {it.supplierCurrencySymbol}
                          </td>
                          <td className="p-3 font-mono tabular-nums text-[11px]">
                            <span className="font-black text-emerald-700 dark:text-emerald-400">
                              {it.wholesalePrice > 0
                                ? `${it.wholesalePrice.toLocaleString('ar-EG')} (≥${it.minWholesaleQty})`
                                : '—'}
                            </span>
                            {it.tierPricing && it.tierPricing.length > 0 && (
                              <span className="block text-[10px] text-[#475569]">
                                +{it.tierPricing.length} شرائح كمية
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono tabular-nums">{it.stockQty}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleApprovePendingItem(it)}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer bg-rose-600 hover:bg-emerald-600 text-white animate-pulse flex items-center gap-1"
                                >
                                  <span>اعتماد ونشر بالسوق ✓</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleToggleItemMarketVisibility(it)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer flex items-center gap-1 ${
                                  isLive
                                    ? 'bg-emerald-600 text-white'
                                    : isPending
                                    ? 'bg-stone-700 text-white'
                                    : 'bg-stone-500 text-white'
                                }`}
                              >
                                {it.inMarket ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                <span>{isLive ? 'معتمد بالسوق' : it.inMarket ? 'إلغاء من السوق' : 'نشر واعتماد بالسوق'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Offer Alerts & Workshop Reviews Moderation */}
      {activeTab === 'offers_reviews' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Official Alert Composer + Offer Alerts List */}
          <div className="lg:col-span-6 space-y-4">
            <form
              onSubmit={handlePublishOfficialAlert}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
            >
              <h2 className="text-sm font-black flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#EA580C]" />
                <span>نشر تنبيه أو عرض مركزي في شريط عروض الموردين</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={newAlertType}
                  onChange={(e) => setNewAlertType(e.target.value as any)}
                  className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                >
                  <option value="offer">عرض موسمي / خصم</option>
                  <option value="new_arrival">وصول دفعة خامات جديدة</option>
                  <option value="price_drop">تحديث وتخفيض أسعار</option>
                </select>
                <input
                  type="text"
                  value={newAlertBadge}
                  onChange={(e) => setNewAlertBadge(e.target.value)}
                  placeholder="نسبة/تمييز اختياري (مثل: خصم 15%)"
                  className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <input
                type="text"
                value={newAlertTitle}
                onChange={(e) => setNewAlertTitle(e.target.value)}
                placeholder="عنوان العرض أو التنبيه للورش..."
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <textarea
                rows={2}
                value={newAlertMessage}
                onChange={(e) => setNewAlertMessage(e.target.value)}
                placeholder="تفاصيل العرض أو الأصناف المتوفرة..."
                className="w-full p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <button
                type="submit"
                disabled={publishingAlert}
                className="w-full h-10 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer disabled:opacity-60"
              >
                {publishingAlert ? 'جاري النشر...' : 'نشر التنبيه في سوق موردين الشمساوية'}
              </button>
            </form>

            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5">
              <h3 className="text-xs font-black">التنبيهات المنشورة حالياً ({overview.offerAlerts.length})</h3>
              {overview.offerAlerts.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#475569]">لا توجد تنبيهات عروض حالياً.</p>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {overview.offerAlerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5 text-xs min-w-0">
                        <div className="font-black text-[#C2410C] dark:text-[#FBBF24]">
                          {al.supplierBrand} {al.discountBadge ? `· ${al.discountBadge}` : ''}
                        </div>
                        <div className="font-black">{al.title}</div>
                        <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">{al.message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAlert(al.id)}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-500/15 cursor-pointer shrink-0"
                        title="حذف التنبيه"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reviews Moderation */}
          <div className="lg:col-span-6 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>مراجعة وتقييمات الورش للموردين ({overview.reviews.length})</span>
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder="بحث في التقييمات (اسم المورد، الورشة، التعليق)..."
                className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>

            {filteredReviews.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#475569]">لا توجد تقييمات ورش مسجلة بعد.</p>
            ) : (
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {filteredReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start justify-between gap-2"
                  >
                    <div className="space-y-1 text-xs min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-black">
                        <span>{rev.supplierBrandName}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                          {'★'.repeat(rev.rating)} ({rev.rating}/5)
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                        من: {rev.reviewerBrand || rev.reviewerName}
                      </div>
                      <p className="text-xs leading-relaxed">{rev.comment}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteReview(rev)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-500/15 cursor-pointer shrink-0"
                      title="حذف التقييم المخالف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: B2B Supply Orders & Governance Policy */}
      {activeTab === 'orders_b2b' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#EA580C]" />
              <span>سياسة طلبات التوريد (B2B) والدعم الرسمي</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold block mb-1">الحد الأدنى لطلب التوريد (ج.م)</label>
                <input
                  type="number"
                  min={0}
                  value={builder.b2bPolicy.minOrderAmountEgp}
                  onChange={(e) =>
                    setBuilder((prev) => ({
                      ...prev,
                      b2bPolicy: {
                        ...prev.b2bPolicy,
                        minOrderAmountEgp: Math.max(0, Number(e.target.value) || 0),
                      },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono tabular-nums font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">رقم واتساب دعم التوريد B2B</label>
                <input
                  type="text"
                  value={builder.b2bPolicy.whatsappSupportPhone}
                  onChange={(e) =>
                    setBuilder((prev) => ({
                      ...prev,
                      b2bPolicy: { ...prev.b2bPolicy, whatsappSupportPhone: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold"
                />
              </div>
              <div className="flex items-end">
                <label className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between text-xs font-bold cursor-pointer">
                  <span>تفعيل زر واتساب دعم التوريد</span>
                  <input
                    type="checkbox"
                    checked={builder.b2bPolicy.whatsappSupportEnabled}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        b2bPolicy: {
                          ...prev.b2bPolicy,
                          whatsappSupportEnabled: e.target.checked,
                        },
                      }))
                    }
                    className="w-4 h-4 accent-[#EA580C]"
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold block mb-1">تنويه الشحن والضمان داخل سلة التوريد</label>
              <input
                type="text"
                value={builder.b2bPolicy.defaultPlatformShippingNotice}
                onChange={(e) =>
                  setBuilder((prev) => ({
                    ...prev,
                    b2bPolicy: { ...prev.b2bPolicy, defaultPlatformShippingNotice: e.target.value },
                  }))
                }
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="بحث برقم أمر التوريد، اسم المورد، أو الورشة الطالبة..."
                  className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كل حالات التوريد</option>
                {Object.entries(B2B_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {filteredOrders.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#475569]">لا توجد طلبات توريد B2B مطابقة حالياً.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="space-y-0.5 text-xs">
                      <div className="font-black">
                        #{ord.orderNumber} — المورد: {ord.supplierBrandName} ← الورشة:{' '}
                        {ord.externalBuyer?.workshopBrand || ord.externalBuyer?.name || 'ورشة بالمنظومة'}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]">
                        الأصناف: {ord.items.length} · الإجمالي: {ord.finalTotal.toLocaleString('ar-EG')}{' '}
                        {ord.currencySymbol} · المدفوع: {ord.paidAmount.toLocaleString('ar-EG')}{' '}
                        {ord.currencySymbol}
                      </div>
                    </div>

                    <select
                      value={ord.status}
                      onChange={(e) => handleUpdateOrderStatus(ord, e.target.value)}
                      className="h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black"
                    >
                      {Object.entries(B2B_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: QR & Poster */}
      {activeTab === 'qr_poster' && (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="p-4 rounded-2xl bg-white border border-[#D4CCBC] shrink-0">
            <QRCodeCanvas
              id="suppliers-market-qr-canvas"
              value={suppliersMarketUrl}
              size={180}
              level="H"
              includeMargin
            />
          </div>

          <div className="space-y-3 flex-1 text-center md:text-right">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <QrCode className="w-5 h-5 text-[#EA580C]" />
              <h2 className="text-base font-black">بوابة التسويق وبوستر سوق موردين الشمساوية</h2>
            </div>
            <p className="text-xs font-mono text-[#C2410C] dark:text-[#FBBF24] break-all">
              {suppliersMarketUrl}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={onCopySuppliersMarketUrl}
                className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الرابط</span>
              </button>
              <button
                type="button"
                onClick={onShareSuppliersMarketWhatsApp}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة واتساب</span>
              </button>
              <button
                type="button"
                onClick={onDownloadSuppliersMarketPoster}
                className="px-3.5 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>تحميل البوستر (1200×1600)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
