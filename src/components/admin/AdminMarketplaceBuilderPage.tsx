import React, { useMemo, useState, useEffect } from 'react';
import {
  ShoppingBag,
  ArrowRight,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Upload,
  RotateCcw,
  Save,
  Search,
  X,
  Plus,
  Trash2,
  QrCode,
  Copy,
  Share2,
  Printer,
  Truck,
  ShieldCheck,
  ExternalLink,
  Layers,
  LayoutGrid,
  Check,
  Edit3,
  Image as ImageIcon,
  Palette,
  Tag,
  Coins,
  Megaphone,
  Archive,
  MessageCircle,
  Sparkles,
  Clock,
  Calendar,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  MarketplaceBuilderConfig,
  DEFAULT_MARKET_BUILDER_CONFIG,
  MARKET_THEME_PRESETS,
  PRODUCT_BADGE_PRESETS,
  MarketThemePresetId,
  MarketCouponConfig,
  MarketCouponType,
  MarketDecorCategoryConfig,
  MarketProductMatrixConfig,
  ClientVisibilityMode,
  getStoredMarketBuilderConfig,
  saveStoredMarketBuilderConfig,
  compressImageFileToDataUrl,
} from '../../types/marketplaceBuilder';
import { GovernoratesShippingConfig } from '../../services/marketplaceCartService';
import { CloudMarketplaceProduct } from '../../db/marketplaceCloud';
import { SUB_CRAFTS_REGISTRY } from '../../registry/craftsRegistry';

interface WorkshopVisibilityEntry {
  id: string;
  brandName?: string;
  artistName?: string;
  phoneNumber?: string;
  status?: string;
}

interface AdminMarketplaceBuilderPageProps {
  onBack: () => void;
  cloudProducts: CloudMarketplaceProduct[];
  ordersList: any[];
  workshops?: WorkshopVisibilityEntry[];
  shippingConfig: GovernoratesShippingConfig;
  setShippingConfig: React.Dispatch<React.SetStateAction<GovernoratesShippingConfig>>;
  centralShippingPrivacy: boolean;
  onToggleCentralPrivacy: (nextVal: boolean) => void;
  onSaveMarketControlSettings: (extraMarketBuilder?: MarketplaceBuilderConfig) => Promise<void>;
  savingMarketSettings: boolean;
  onUpdateMarketOrderStatus: (orderId: string, updates: any) => Promise<void>;
  onApproveCloudProduct: (prod: CloudMarketplaceProduct) => void;
  onRejectCloudProduct: (prod: CloudMarketplaceProduct) => void;
  centralMarketUrl: string;
  onCopyMarketUrl: () => void;
  onShareMarketWhatsApp: () => void;
  onDownloadMarketPoster: () => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

type BuilderTabId =
  | 'builder'
  | 'promotions_loyalty'
  | 'categories_matrices'
  | 'products_search'
  | 'orders_shipping'
  | 'qr_poster';

export const AdminMarketplaceBuilderPage: React.FC<AdminMarketplaceBuilderPageProps> = ({
  onBack,
  cloudProducts,
  ordersList,
  workshops = [],
  shippingConfig,
  setShippingConfig,
  centralShippingPrivacy,
  onToggleCentralPrivacy,
  onSaveMarketControlSettings,
  savingMarketSettings,
  onUpdateMarketOrderStatus,
  onApproveCloudProduct,
  onRejectCloudProduct,
  centralMarketUrl,
  onCopyMarketUrl,
  onShareMarketWhatsApp,
  onDownloadMarketPoster,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [activeTab, setActiveTab] = useState<BuilderTabId>('builder');
  const [builder, setBuilder] = useState<MarketplaceBuilderConfig>(() => getStoredMarketBuilderConfig());
  const [dragBlockIndex, setDragBlockIndex] = useState<number | null>(null);
  const [dragCatIndex, setDragCatIndex] = useState<number | null>(null);
  const [dragMatrixIndex, setDragMatrixIndex] = useState<number | null>(null);
  const [editingGovRates, setEditingGovRates] = useState(false);

  // Category/Matrix Adders
  const [newCatName, setNewCatName] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');

  // New Coupon Adder
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<MarketCouponType>('percent');
  const [newCouponValue, setNewCouponValue] = useState<string>('10');
  const [newCouponMinOrder, setNewCouponMinOrder] = useState<string>('0');
  const [newCouponDesc, setNewCouponDesc] = useState('');

  // Advanced Search in Marketplace Products, Workshops & Orders
  const [workshopSearchQuery, setWorkshopSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'approved' | 'pending_approval' | 'rejected'>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  useEffect(() => {
    const syncListener = (e: any) => {
      if (e?.detail) setBuilder(e.detail);
    };
    window.addEventListener('alshams_market_builder_updated', syncListener);
    return () => window.removeEventListener('alshams_market_builder_updated', syncListener);
  }, []);

  const applyAndSaveBuilder = async (cfgToSave: MarketplaceBuilderConfig) => {
    const stamped = { ...cfgToSave, updatedAt: new Date().toISOString() };
    setBuilder(stamped);
    saveStoredMarketBuilderConfig(stamped);
    await onSaveMarketControlSettings(stamped);
  };

  // Drag & Drop Reorder Helper
  const reorderArray = <T,>(arr: T[], fromIdx: number, toIdx: number): T[] => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return arr;
    const copy = [...arr];
    const [item] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, item);
    return copy;
  };

  const handleUploadHeroImage = async (target: 'desktop' | 'mobile', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const maxDim = target === 'desktop' ? 1440 : 1200;
      const compressed = await compressImageFileToDataUrl(file, maxDim, maxDim, 0.82);
      setBuilder((prev) => ({
        ...prev,
        [target === 'desktop' ? 'heroDesktopBg' : 'heroMobileBg']: compressed,
      }));
      onNotifySuccess(
        target === 'desktop'
          ? 'تم رفع ومعالجة خلفية الديسكتوب (16:9) بنجاح — اضغط "حفظ ونشر على السوق" لتطبيقها.'
          : 'تم رفع ومعالجة خلفية الموبايل (9:16) بنجاح — اضغط "حفظ ونشر على السوق" لتطبيقها.'
      );
    } catch (err: any) {
      onNotifyError(err?.message || 'تعذر معالجة الصورة المرفوعة');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddCustomCategory = () => {
    if (!newCatName.trim()) {
      onNotifyError('أدخل اسم التصنيف أولاً');
      return;
    }
    const id = 'cat_' + Date.now();
    const keywords = newCatKeywords
      .split(/[,،]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const nextCat: MarketDecorCategoryConfig = {
      id,
      nameAr: newCatName.trim(),
      keywords: keywords.length > 0 ? keywords : [newCatName.trim().toLowerCase()],
      visible: true,
    };
    setBuilder((prev) => ({
      ...prev,
      decorCategoriesOrder: [...prev.decorCategoriesOrder, nextCat],
    }));
    setNewCatName('');
    setNewCatKeywords('');
  };

  const handleAddMatrix = () => {
    const nextMatrix: MarketProductMatrixConfig = {
      id: 'matrix_' + Date.now(),
      title: 'مصفوفة منتجات جديدة',
      subtitle: 'تشكيلة مختارة بأحدث المواصفات',
      filterType: 'featured',
      desktopCols: 4,
      mobileCols: 2,
      limit: 4,
      enabled: true,
    };
    setBuilder((prev) => ({
      ...prev,
      productMatrices: [...prev.productMatrices, nextMatrix],
    }));
  };

  const handleAddCoupon = () => {
    const cleanCode = newCouponCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) {
      onNotifyError('أدخل كود الخصم أولاً (مثل SHAMS10)');
      return;
    }
    if (builder.coupons.some((c) => c.code.toUpperCase() === cleanCode)) {
      onNotifyError('هذا الكود موجود بالفعل في قائمة الأكواد');
      return;
    }
    const numericVal = newCouponType === 'free_shipping' ? 0 : Math.max(1, Number(newCouponValue) || 0);
    if (newCouponType === 'percent' && numericVal > 90) {
      onNotifyError('النسبة المئوية يجب أن تكون بين 1% و 90%');
      return;
    }

    const nextCoupon: MarketCouponConfig = {
      id: 'cpn_' + Date.now(),
      code: cleanCode,
      type: newCouponType,
      value: numericVal,
      minOrder: Math.max(0, Number(newCouponMinOrder) || 0),
      active: true,
      visible: true,
      description:
        newCouponDesc.trim() ||
        (newCouponType === 'free_shipping'
          ? 'شحن مجاني لكافة المحافظات'
          : newCouponType === 'percent'
          ? `خصم ${numericVal}% على المنتجات`
          : `خصم فوري ${numericVal} ج.م`),
      createdAt: new Date().toISOString(),
    };

    setBuilder((prev) => ({
      ...prev,
      coupons: [nextCoupon, ...prev.coupons],
    }));
    setNewCouponCode('');
    setNewCouponDesc('');
    onNotifySuccess(`تمت إضافة الكود ${cleanCode} — اضغط حفظ ونشر لتفعيله في السلة.`);
  };

  // Filtered Products for Advanced Search Tab
  const filteredMarketProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    return cloudProducts.filter((p) => {
      if (productStatusFilter !== 'all' && p.status !== productStatusFilter) return false;
      if (productCategoryFilter !== 'all') {
        const catMatch =
          p.decor_category === productCategoryFilter ||
          p.category === productCategoryFilter ||
          (p.craft_name || '').includes(productCategoryFilter);
        if (!catMatch) return false;
      }
      if (!q) return true;
      return (
        (p.product_name || '').toLowerCase().includes(q) ||
        (p.brand_name || '').toLowerCase().includes(q) ||
        (p.artist_name || '').toLowerCase().includes(q) ||
        (p.craft_name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    });
  }, [cloudProducts, productSearchQuery, productStatusFilter, productCategoryFilter]);

  // Combined Searchable Workshops List for Per-Workshop Client Visibility
  const searchableWorkshops = useMemo(() => {
    const map = new Map<string, WorkshopVisibilityEntry>();
    workshops.forEach((ws) => {
      if (ws?.id) {
        map.set(ws.id, {
          id: ws.id,
          brandName: ws.brandName || 'ورشة الشمساوية',
          artistName: ws.artistName || '',
          phoneNumber: ws.phoneNumber || '',
          status: ws.status,
        });
      }
    });
    cloudProducts.forEach((p) => {
      const wid = p.workshop_id || p.workshopId;
      if (wid && !map.has(wid)) {
        map.set(wid, {
          id: wid,
          brandName: p.brand_name || p.brandName || 'ورشة الشمساوية',
          artistName: p.artist_name || p.artistName || '',
          phoneNumber: p.phone_number || p.phoneNumber || '',
        });
      }
    });
    const list = Array.from(map.values());
    const q = workshopSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (ws) =>
        (ws.brandName || '').toLowerCase().includes(q) ||
        (ws.artistName || '').toLowerCase().includes(q) ||
        (ws.phoneNumber || '').toLowerCase().includes(q)
    );
  }, [workshops, cloudProducts, workshopSearchQuery]);

  const handleSetClientVisibilityMode = (mode: ClientVisibilityMode) => {
    const nextBuilder: MarketplaceBuilderConfig = {
      ...builder,
      clientVisibilityMode: mode,
    };
    setBuilder(nextBuilder);
    saveStoredMarketBuilderConfig(nextBuilder);
    if (mode === 'show_all') {
      onToggleCentralPrivacy(false);
    } else if (mode === 'hide_all') {
      onToggleCentralPrivacy(true);
    }
  };

  const handleToggleWorkshopClientVisibility = (workshopId: string) => {
    const currentStatus =
      builder.workshopClientVisibility?.[workshopId] ||
      (builder.clientVisibilityMode === 'hide_all' ? 'hide' : 'show');
    const nextStatus: 'show' | 'hide' = currentStatus === 'hide' ? 'show' : 'hide';
    const nextBuilder: MarketplaceBuilderConfig = {
      ...builder,
      clientVisibilityMode: 'custom_per_workshop',
      workshopClientVisibility: {
        ...(builder.workshopClientVisibility || {}),
        [workshopId]: nextStatus,
      },
    };
    setBuilder(nextBuilder);
    saveStoredMarketBuilderConfig(nextBuilder);
  };

  const applyFlashPresetHours = (hours: number) => {
    const target = new Date(Date.now() + hours * 3600 * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setBuilder((prev) => ({
      ...prev,
      flashOffer: { ...prev.flashOffer, enabled: true, endsAt: localIso },
    }));
  };

  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.trim().toLowerCase();
    return ordersList.filter((o) => {
      if (orderStatusFilter !== 'all' && (o.marketplaceStatus || o.status) !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        String(o.invoiceNumber || o.order_number || o.id || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').toLowerCase().includes(q) ||
        (o.governorate || '').toLowerCase().includes(q)
      );
    });
  }, [ordersList, orderSearchQuery, orderStatusFilter]);

  const activeThemeMeta = MARKET_THEME_PRESETS[builder.themePreset || 'shams_sand'] || MARKET_THEME_PRESETS.shams_sand;
  const activeCoupons = useMemo(() => builder.coupons.filter((c) => c.visible !== false), [builder.coupons]);
  const archivedCoupons = useMemo(() => builder.coupons.filter((c) => c.visible === false), [builder.coupons]);

  const builderTabs: { id: BuilderTabId; label: string }[] = [
    { id: 'builder', label: 'الواجهة والثيمات' },
    { id: 'promotions_loyalty', label: `الكوبونات والولاء (${activeCoupons.filter((c) => c.active).length})` },
    { id: 'categories_matrices', label: 'التصنيفات والمصفوفات' },
    { id: 'products_search', label: `المنتجات والأقسام (${cloudProducts.length})` },
    { id: 'orders_shipping', label: `الطلبات والشحن (${ordersList.length})` },
    { id: 'qr_poster', label: 'QR وبوستر السوق' },
  ];

  const getTickerBgStyle = (hex?: string) => {
    if (hex === '#0C1427') return { backgroundColor: '#0C1427', color: '#FBBF24' };
    if (hex === '#065F46') return { backgroundColor: '#065F46', color: '#FFFFFF' };
    if (hex === '#E9E2D4') return { backgroundColor: '#E9E2D4', color: '#0C1427' };
    return { backgroundColor: '#EA580C', color: '#FFFFFF' };
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>الرئيسية</span>
          </button>
          <div>
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>لوحة تحكم سوق الشمساوية (No-Code Builder)</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={centralMarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>معاينة السوق</span>
          </a>

          <button
            type="button"
            disabled={savingMarketSettings}
            onClick={() => applyAndSaveBuilder(builder)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{savingMarketSettings ? 'جاري النشر...' : 'حفظ ونشر على السوق فوراً'}</span>
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
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap border transition cursor-pointer shrink-0 ${
              activeTab === t.id
                ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C]'
                : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EasyOrders-style No-Code Visual Builder + Themes + Visibility & Shipping Privacy */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Lightweight Themes Selector with Live Miniature Visual Previews */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>ثيمات وهوية سوق الشمساوية (معاينة فورية وخفيفة)</span>
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
                      {/* Miniature Live Swatch Preview */}
                      <div
                        className="w-full h-14 rounded-lg border p-1.5 flex flex-col justify-between overflow-hidden"
                        style={{
                          backgroundColor: t.pageBgLight,
                          borderColor: t.borderLight,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="h-2 w-10 rounded-sm"
                            style={{ backgroundColor: t.inkLight }}
                          />
                          <span
                            className="h-2.5 w-6 rounded-sm"
                            style={{ backgroundColor: t.accentBg }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div
                            className="h-6 rounded border"
                            style={{ backgroundColor: t.surfaceLight, borderColor: t.borderLight }}
                          />
                          <div
                            className="h-6 rounded border"
                            style={{ backgroundColor: t.surfaceLight, borderColor: t.borderLight }}
                          />
                          <div
                            className="h-6 rounded border"
                            style={{ backgroundColor: t.pageBgDark, borderColor: t.borderDark }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                            {t.nameAr}
                          </p>
                          <p className="text-[9px] text-[#475569] dark:text-[#94A3B8] truncate">
                            {t.subtitleAr}
                          </p>
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

            {/* 2. Drag & Drop Page Sections */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>ترتيب أقسام واجهة السوق (اسحب وأفلت أو استخدم الأسهم)</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setBuilder({ ...DEFAULT_MARKET_BUILDER_CONFIG })}
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
                      <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                        {block.labelAr}
                      </span>
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
                        title="تحريك لأعلى"
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
                        title="تحريك لأسفل"
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
                            ...(block.id === 'promo'
                              ? { promoBanner: { ...prev.promoBanner, enabled: !block.enabled } }
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

            {/* 3. Running Marquee Ticker & Promo Banner + Featured Coupon Under Promo Banner */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
              <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>الشريط المتحرك (التيكر) وبانر الإعلان وكود الخصم</span>
              </h2>

              {/* Running Marquee Ticker Banner */}
              <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    الشريط المتحرك لتحفيز العملاء (فوق أو تحت البانر الرئيسي)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        tickerBanner: { ...prev.tickerBanner, enabled: !prev.tickerBanner.enabled },
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer ${
                      builder.tickerBanner.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]'
                    }`}
                  >
                    {builder.tickerBanner.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{builder.tickerBanner.enabled ? 'ظاهر' : 'مخفي'}</span>
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
                  placeholder="نص الشريط المتحرك (عروض، شحن، كود خصم...)"
                  className="w-full h-9 px-3 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <label className="font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">مكان الشريط المتحرك</label>
                    <select
                      value={builder.tickerBanner.position}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          tickerBanner: {
                            ...prev.tickerBanner,
                            position: e.target.value as 'above_hero' | 'below_hero',
                          },
                        }))
                      }
                      className="w-full h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="above_hero">فوق البانر الرئيسي (Hero)</option>
                      <option value="below_hero">تحت البانر الرئيسي (Hero)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">سرعة الحركة</label>
                    <select
                      value={builder.tickerBanner.speed}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          tickerBanner: {
                            ...prev.tickerBanner,
                            speed: e.target.value as 'slow' | 'normal' | 'fast',
                          },
                        }))
                      }
                      className="w-full h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="slow">هادئة ومريحة</option>
                      <option value="normal">متوسطة</option>
                      <option value="fast">سريعة</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">لون خلفية الشريط</label>
                    <select
                      value={builder.tickerBanner.bgColor}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          tickerBanner: { ...prev.tickerBanner, bgColor: e.target.value },
                        }))
                      }
                      className="w-full h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="#EA580C">برتقالي شمساوية</option>
                      <option value="#0C1427">كحلي وذهبي</option>
                      <option value="#065F46">أخضر زمردي</option>
                      <option value="#E9E2D4">رملي دافئ</option>
                    </select>
                  </div>
                </div>

                {/* Coupon attached inside Ticker */}
                <div className="pt-1 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex flex-wrap items-center gap-2">
                  <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                    كود الخصم بالشريط المتحرك:
                  </label>
                  <input
                    type="text"
                    value={builder.tickerBanner.linkedCouponCode || ''}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        tickerBanner: { ...prev.tickerBanner, linkedCouponCode: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="SHAMS5"
                    className="w-28 h-8 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black uppercase text-center"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        tickerBanner: {
                          ...prev.tickerBanner,
                          showLinkedCoupon: !prev.tickerBanner.showLinkedCoupon,
                        },
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                      builder.tickerBanner.showLinkedCoupon ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                    }`}
                  >
                    {builder.tickerBanner.showLinkedCoupon ? 'إظهار الكود بالشريط' : 'إخفاء الكود'}
                  </button>
                </div>
              </div>

              {/* Static Promo Announcement Banner + Coupon Input Right Underneath */}
              <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    بانر الإعلان الثابت العلوي
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        promoBanner: { ...prev.promoBanner, enabled: !prev.promoBanner.enabled },
                        pageBlocksOrder: prev.pageBlocksOrder.map((b) =>
                          b.id === 'promo' ? { ...b, enabled: !prev.promoBanner.enabled } : b
                        ),
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer ${
                      builder.promoBanner.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]'
                    }`}
                  >
                    {builder.promoBanner.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{builder.promoBanner.enabled ? 'مفعّل' : 'معطّل'}</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={builder.promoBanner.text}
                  onChange={(e) =>
                    setBuilder((prev) => ({
                      ...prev,
                      promoBanner: { ...prev.promoBanner, text: e.target.value },
                    }))
                  }
                  placeholder="نص البانر الإعلاني..."
                  className="w-full h-9 px-3 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                />

                {/* Coupon input box directly underneath the Announcement Banner */}
                <div className="p-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Tag className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                    <span className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] whitespace-nowrap">
                      كود الخصم أسفل البانر:
                    </span>
                    <input
                      type="text"
                      value={builder.promoBanner.linkedCouponCode || ''}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          promoBanner: { ...prev.promoBanner, linkedCouponCode: e.target.value.toUpperCase() },
                        }))
                      }
                      placeholder="اكتب الكود هنا (مثل SHAMS5)"
                      className="flex-1 min-w-[100px] h-8 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setBuilder((prev) => ({
                          ...prev,
                          promoBanner: {
                            ...prev.promoBanner,
                            showLinkedCoupon: !prev.promoBanner.showLinkedCoupon,
                          },
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                        builder.promoBanner.showLinkedCoupon ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                      }`}
                    >
                      {builder.promoBanner.showLinkedCoupon ? 'ظاهر بالبانر' : 'مخفي'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('promotions_loyalty')}
                      className="px-2.5 py-1 rounded-lg bg-[#EA580C]/15 text-[#C2410C] dark:text-[#FBBF24] text-[10px] font-black cursor-pointer"
                    >
                      إدارة الأكواد
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="text-[#475569] dark:text-[#94A3B8]">لون البانر:</span>
                  {[
                    { hex: '#0C1427', label: 'كحلي داكن' },
                    { hex: '#EA580C', label: 'برتقالي شمس' },
                    { hex: '#065F46', label: 'زمردي' },
                    { hex: '#E9E2D4', label: 'رملي دافئ' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() =>
                        setBuilder((prev) => ({
                          ...prev,
                          promoBanner: { ...prev.promoBanner, bgColor: c.hex },
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-black cursor-pointer ${
                        builder.promoBanner.bgColor === c.hex
                          ? 'border-[#EA580C] ring-1 ring-[#EA580C]'
                          : 'border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Workshop Attribution Visibility & Client Data Privacy + Shipping Notices */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3.5">
              <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>إظهار الورش والفنانين، خصوصية بيانات العميل، ورسائل الشحن</span>
              </h2>

              {/* Toggle 1: Show Workshop Name Under Product Cards */}
              <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    إظهار أسماء الورش أسفل المنتجات في السوق
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    عند التفعيل يظهر اسم الورشة الصانعة أسفل كل كارت منتج أمام العملاء.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((prev) => ({ ...prev, showWorkshopOnCards: !prev.showWorkshopOnCards }))
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 cursor-pointer ${
                    builder.showWorkshopOnCards ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.showWorkshopOnCards ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{builder.showWorkshopOnCards ? 'ظاهر' : 'مخفي'}</span>
                </button>
              </div>

              {/* Toggle 2: Show Workshop + Artist Name Inside Product Details Modal */}
              <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    إظهار اسم الورشة والفنان داخل تفاصيل المنتج
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    يظهر اسم الورشة واسم الفنان مع الوصف والمواصفات عند فتح العميل للمنتج.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((prev) => ({
                      ...prev,
                      showWorkshopAndArtistInDetails: !prev.showWorkshopAndArtistInDetails,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 cursor-pointer ${
                    builder.showWorkshopAndArtistInDetails ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.showWorkshopAndArtistInDetails ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  <span>{builder.showWorkshopAndArtistInDetails ? 'ظاهر' : 'مخفي'}</span>
                </button>
              </div>

              {/* Toggle 3 (Directly right after): Client Data Visibility (3 Modes + Searchable Per-Workshop Control) */}
              <div className="p-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border-2 border-[#EA580C]/35 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#EA580C]" />
                    <span>إظهار / إخفاء بيانات العميل للورش وآلية الشحن</span>
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    {builder.clientVisibilityMode === 'hide_all'
                      ? 'الوضع الحالي: إخفاء عن جميع الورش (الشحن مركزي عبر المنظومة).'
                      : builder.clientVisibilityMode === 'custom_per_workshop'
                      ? 'الوضع الحالي: تخصيص الإظهار والإخفاء لكل ورشة على حدة.'
                      : 'الوضع الحالي: إظهار للجميع (الورش ترى بيانات العميل المطلوب منها للشحن المباشر).'}
                  </p>
                </div>

                {/* 3 Modes Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetClientVisibilityMode('show_all')}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black border cursor-pointer transition ${
                      builder.clientVisibilityMode === 'show_all'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                    }`}
                  >
                    إظهار للجميع (الافتراضي)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetClientVisibilityMode('hide_all')}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black border cursor-pointer transition ${
                      builder.clientVisibilityMode === 'hide_all'
                        ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C] shadow-sm'
                        : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                    }`}
                  >
                    إخفاء عن الجميع
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetClientVisibilityMode('custom_per_workshop')}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black border cursor-pointer transition ${
                      builder.clientVisibilityMode === 'custom_per_workshop'
                        ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-sm'
                        : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                    }`}
                  >
                    تخصيص حسب كل ورشة
                  </button>
                </div>

                {/* Searchable Per-Workshop Toggle List */}
                <div className="p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={workshopSearchQuery}
                      onChange={(e) => setWorkshopSearchQuery(e.target.value)}
                      placeholder="ابحث باسم الورشة أو الفنان لتخصيص إظهار أو إخفاء بيانات العملاء..."
                      className="w-full h-8 pr-8 pl-7 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold outline-none focus:border-[#EA580C]"
                    />
                    {workshopSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setWorkshopSearchQuery('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#475569] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                    {searchableWorkshops.length === 0 ? (
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] text-center py-3">
                        لا توجد ورش مطابقة لبحثك.
                      </p>
                    ) : (
                      searchableWorkshops.map((ws) => {
                        const explicitVal = builder.workshopClientVisibility?.[ws.id];
                        const isHiddenForWs =
                          builder.clientVisibilityMode === 'hide_all'
                            ? true
                            : builder.clientVisibilityMode === 'show_all'
                            ? false
                            : explicitVal
                            ? explicitVal === 'hide'
                            : centralShippingPrivacy;

                        return (
                          <div
                            key={ws.id}
                            className="px-2.5 py-1.5 rounded-lg bg-[#EFE9DC]/80 dark:bg-[#132040] border border-[#D4CCBC]/70 dark:border-[#22355E] flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0">
                              <p className="font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                                {ws.brandName}
                              </p>
                              {ws.artistName && (
                                <p className="text-[10px] text-[#475569] dark:text-[#94A3B8] truncate">
                                  {ws.artistName}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleWorkshopClientVisibility(ws.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer ${
                                isHiddenForWs
                                  ? 'bg-stone-600 text-white'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {isHiddenForWs ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{isHiddenForWs ? 'مخفي عن الورشة' : 'ظاهر للورشة'}</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Editable Cart Notices for Both Modes */}
                <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 block">
                      رسالة السلة عند الشحن عبر المنظومة (تظهر للعميل قبل تأكيد الطلب):
                    </label>
                    <textarea
                      rows={2}
                      value={builder.shippingModeNotices.platformShippingMessage}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          shippingModeNotices: {
                            ...prev.shippingModeNotices,
                            platformShippingMessage: e.target.value,
                          },
                        }))
                      }
                      className="w-full p-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24] block">
                      رسالة السلة عند الشحن المباشر من الورش (تظهر للعميل قبل تأكيد الطلب):
                    </label>
                    <textarea
                      rows={2}
                      value={builder.shippingModeNotices.workshopShippingMessage}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          shippingModeNotices: {
                            ...prev.shippingModeNotices,
                            workshopShippingMessage: e.target.value,
                          },
                        }))
                      }
                      className="w-full p-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Live Headlines Editor */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
              <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>تحرير نصوص الواجهة والهيدلاين (Hero)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">العنوان الصغير العلوي (Eyebrow)</label>
                  <input
                    type="text"
                    value={builder.heroEyebrow}
                    onChange={(e) => setBuilder((prev) => ({ ...prev, heroEyebrow: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">نص زر الهيرو (CTA)</label>
                  <input
                    type="text"
                    value={builder.heroCtaText}
                    onChange={(e) => setBuilder((prev) => ({ ...prev, heroCtaText: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">العنوان الرئيسي للهيدلاين (Hero Headline)</label>
                <input
                  type="text"
                  value={builder.heroTitle}
                  onChange={(e) => setBuilder((prev) => ({ ...prev, heroTitle: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm font-black outline-none focus:border-[#EA580C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">الوصف الفرعي للهيدلاين</label>
                <textarea
                  rows={2}
                  value={builder.heroSubtitle}
                  onChange={(e) => setBuilder((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                  className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                />
              </div>
            </div>

            {/* 6. Background Images Uploader (Desktop 16:9 & Mobile 9:16) & Grid Matrix Preset */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
              <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>صور الخلفية (ديسكتوب 16:9 وموبايل 9:16) ونظام المصفوفة الرئيسي</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Desktop Image */}
                <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">خلفية الكمبيوتر (16:9)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setBuilder((prev) => ({ ...prev, heroDesktopBg: DEFAULT_MARKET_BUILDER_CONFIG.heroDesktopBg }))
                      }
                      className="text-[10px] font-bold text-[#C2410C] dark:text-[#FBBF24] cursor-pointer"
                    >
                      افتراضي
                    </button>
                  </div>
                  <div className="w-full aspect-video rounded-lg overflow-hidden bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
                    <img
                      src={builder.heroDesktopBg}
                      alt="خلفية الديسكتوب"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <label className="w-full py-2 px-3 rounded-xl bg-[#0C1427] text-[#FBBF24] text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#1E293B]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة ديسكتوب</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadHeroImage('desktop', e)}
                    />
                  </label>
                </div>

                {/* Mobile Image */}
                <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">خلفية الموبايل (9:16)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setBuilder((prev) => ({ ...prev, heroMobileBg: DEFAULT_MARKET_BUILDER_CONFIG.heroMobileBg }))
                      }
                      className="text-[10px] font-bold text-[#C2410C] dark:text-[#FBBF24] cursor-pointer"
                    >
                      افتراضي
                    </button>
                  </div>
                  <div className="w-full aspect-video rounded-lg overflow-hidden bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
                    <img
                      src={builder.heroMobileBg}
                      alt="خلفية الموبايل"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <label className="w-full py-2 px-3 rounded-xl bg-[#0C1427] text-[#FBBF24] text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#1E293B]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة موبايل</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadHeroImage('mobile', e)}
                    />
                  </label>
                </div>
              </div>

              {/* Opacity & Grid Defaults */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">وضوح صورة الخلفية</label>
                  <select
                    value={String(builder.heroImageOpacity)}
                    onChange={(e) => setBuilder((prev) => ({ ...prev, heroImageOpacity: parseFloat(e.target.value) }))}
                    className="w-full h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value="0.18">هادئ (18% - متوازن)</option>
                    <option value="0.3">متوسط (30%)</option>
                    <option value="0.45">واضح (45%)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">مصفوفة الديسكتوب</label>
                  <select
                    value={builder.defaultDesktopCols}
                    onChange={(e) =>
                      setBuilder((prev) => ({ ...prev, defaultDesktopCols: Number(e.target.value) as 2 | 3 | 4 }))
                    }
                    className="w-full h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value={2}>2 منتجات في الصف</option>
                    <option value={3}>3 منتجات في الصف</option>
                    <option value={4}>4 منتجات في الصف</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">مصفوفة الموبايل</label>
                  <select
                    value={builder.defaultMobileCols}
                    onChange={(e) =>
                      setBuilder((prev) => ({ ...prev, defaultMobileCols: Number(e.target.value) as 1 | 2 }))
                    }
                    className="w-full h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value={2}>عمودان (2 كارت)</option>
                    <option value={1}>عمود واحد كبير</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            <div
              className="rounded-2xl border p-4 space-y-3 shadow-sm transition-colors"
              style={{
                backgroundColor: activeThemeMeta.pageBgLight,
                borderColor: activeThemeMeta.borderLight,
                color: activeThemeMeta.inkLight,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">معاينة حية: {activeThemeMeta.nameAr}</span>
                <span className="text-[10px] font-bold" style={{ color: activeThemeMeta.accentBg }}>
                  تحديث فوري
                </span>
              </div>

              {builder.tickerBanner.enabled && builder.tickerBanner.position === 'above_hero' && (
                <div
                  className="rounded-lg px-2.5 py-1.5 text-[10px] font-black overflow-hidden whitespace-nowrap flex items-center justify-between gap-2"
                  style={getTickerBgStyle(builder.tickerBanner.bgColor)}
                >
                  <span className="truncate">{builder.tickerBanner.text}</span>
                  {builder.tickerBanner.showLinkedCoupon && builder.tickerBanner.linkedCouponCode && (
                    <span className="px-1.5 py-0.5 rounded bg-black/25 font-mono shrink-0">
                      كود: {builder.tickerBanner.linkedCouponCode}
                    </span>
                  )}
                </div>
              )}

              {builder.promoBanner.enabled && (
                <div className="rounded-lg bg-[#0C1427] text-[#FBBF24] px-3 py-1.5 text-[10px] font-black text-center space-y-1">
                  <div>{builder.promoBanner.text}</div>
                  {builder.promoBanner.showLinkedCoupon && builder.promoBanner.linkedCouponCode && (
                    <div className="text-[9px] text-white font-mono">
                      كود الخصم: <span className="px-1.5 py-0.5 rounded bg-[#EA580C]">{builder.promoBanner.linkedCouponCode}</span>
                    </div>
                  )}
                </div>
              )}

              {builder.heroEnabled && (
                <div
                  className="relative rounded-xl overflow-hidden border min-h-[180px] flex items-center"
                  style={{ backgroundColor: activeThemeMeta.surfaceLight, borderColor: activeThemeMeta.borderLight }}
                >
                  <img
                    src={builder.heroDesktopBg}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover ${
                      builder.heroImageOpacity >= 0.45
                        ? 'opacity-45'
                        : builder.heroImageOpacity >= 0.3
                        ? 'opacity-30'
                        : 'opacity-20'
                    }`}
                  />
                  <div className="relative z-10 p-4 space-y-2 max-w-sm">
                    <p className="text-[10px] font-black" style={{ color: activeThemeMeta.accentTextLight }}>
                      {builder.heroEyebrow}
                    </p>
                    <h3 className="text-base font-black" style={{ color: activeThemeMeta.inkLight }}>
                      {builder.heroTitle}
                    </h3>
                    <p className="text-[11px] line-clamp-2" style={{ color: activeThemeMeta.mutedLight }}>
                      {builder.heroSubtitle}
                    </p>
                    <span
                      className="inline-block px-3 py-1.5 rounded-lg text-white text-[10px] font-black"
                      style={{ backgroundColor: activeThemeMeta.accentBg }}
                    >
                      {builder.heroCtaText}
                    </span>
                  </div>
                </div>
              )}

              {builder.tickerBanner.enabled && builder.tickerBanner.position === 'below_hero' && (
                <div
                  className="rounded-lg px-2.5 py-1.5 text-[10px] font-black overflow-hidden whitespace-nowrap flex items-center justify-between gap-2"
                  style={getTickerBgStyle(builder.tickerBanner.bgColor)}
                >
                  <span className="truncate">{builder.tickerBanner.text}</span>
                  {builder.tickerBanner.showLinkedCoupon && builder.tickerBanner.linkedCouponCode && (
                    <span className="px-1.5 py-0.5 rounded bg-black/25 font-mono shrink-0">
                      كود: {builder.tickerBanner.linkedCouponCode}
                    </span>
                  )}
                </div>
              )}

              {builder.flashOffer?.enabled && (
                <div className="rounded-lg bg-[#0C1427] text-[#FBBF24] px-2.5 py-1.5 text-[10px] font-black flex items-center justify-between gap-2">
                  <span className="truncate">{builder.flashOffer.title}</span>
                  <span className="font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/10 text-white shrink-0">
                    12:45:30
                  </span>
                </div>
              )}

              {/* Live Category Chips Preview */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {builder.decorCategoriesOrder
                  .filter((c) => c.visible)
                  .map((c, idx) => (
                    <span
                      key={c.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border"
                      style={
                        idx === 0
                          ? { backgroundColor: activeThemeMeta.accentBg, color: '#FFFFFF', borderColor: activeThemeMeta.accentBg }
                          : { backgroundColor: activeThemeMeta.surfaceLight, color: activeThemeMeta.inkLight, borderColor: activeThemeMeta.borderLight }
                      }
                    >
                      {c.nameAr}
                    </span>
                  ))}
              </div>

              {/* Mini Card Preview with Workshop Name Visibility */}
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="rounded-lg border p-2 space-y-1"
                    style={{ backgroundColor: activeThemeMeta.surfaceLight, borderColor: activeThemeMeta.borderLight }}
                  >
                    <div
                      className="h-10 rounded border flex items-center justify-center text-[9px] font-bold"
                      style={{ backgroundColor: activeThemeMeta.softLight, borderColor: activeThemeMeta.borderLight }}
                    >
                      صورة مشغولة #{n}
                    </div>
                    <p className="text-[10px] font-black truncate">معلقة مكرمية يدوية</p>
                    {builder.showWorkshopOnCards && (
                      <p className="text-[9px] font-bold truncate" style={{ color: activeThemeMeta.accentTextLight }}>
                        ورشة: أنامل الشمساوية
                      </p>
                    )}
                    <p className="text-[10px] font-mono font-black">450 ج.م</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={savingMarketSettings}
                onClick={() => applyAndSaveBuilder(builder)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>اعتماد وحفظ التصميم الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Multi-Type Coupons, Loyalty Points & High-Value Storefront Extras */}
      {activeTab === 'promotions_loyalty' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 cols: Full Multi-Coupon Manager */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                    <span>إدارة أكواد الخصم الحقيقية (أونلاين بالسلة)</span>
                  </h2>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    تدعم الخصم بالنسبة المئوية %، المبلغ الثابت بالجنيه ج.م، أو الشحن المجاني الفعلي.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBuilder((prev) => ({ ...prev, couponsEnabled: !prev.couponsEnabled }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer ${
                    builder.couponsEnabled ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.couponsEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{builder.couponsEnabled ? 'خانة الكوبون ظاهرة' : 'خانة الكوبون مخفية'}</span>
                </button>
              </div>

              {/* Add Coupon Form */}
              <div className="p-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                <h3 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">إضافة كود خصم جديد</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                    placeholder="الكود (مثل SHAMS15)"
                    className="h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black uppercase"
                  />
                  <select
                    value={newCouponType}
                    onChange={(e) => setNewCouponType(e.target.value as MarketCouponType)}
                    className="h-9 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                    <option value="free_shipping">شحن مجاني</option>
                  </select>
                  {newCouponType !== 'free_shipping' ? (
                    <input
                      type="number"
                      min={1}
                      value={newCouponValue}
                      onChange={(e) => setNewCouponValue(e.target.value)}
                      placeholder={newCouponType === 'percent' ? 'النسبة %' : 'المبلغ ج.م'}
                      className="h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold"
                    />
                  ) : (
                    <div className="h-9 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-black flex items-center justify-center">
                      تصفير مصاريف الشحن
                    </div>
                  )}
                  <input
                    type="number"
                    min={0}
                    value={newCouponMinOrder}
                    onChange={(e) => setNewCouponMinOrder(e.target.value)}
                    placeholder="حد أدنى للطلب (اختياري)"
                    title="الحد الأدنى لقيمة المنتجات (0 = بدون حد)"
                    className="h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newCouponDesc}
                    onChange={(e) => setNewCouponDesc(e.target.value)}
                    placeholder="وصف مختصر للعرض (اختياري)..."
                    className="flex-1 h-9 px-3 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAddCoupon}
                    className="h-9 px-4 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة الكود</span>
                  </button>
                </div>
              </div>

              {/* Current / Active List */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  الأكواد الحالية ({activeCoupons.length})
                </h3>
                {activeCoupons.length === 0 ? (
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] py-3 text-center">
                    لا توجد أكواد في القائمة الحالية.
                  </p>
                ) : (
                  activeCoupons.map((cpn) => (
                    <div
                      key={cpn.id}
                      className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-[#0C1427] text-[#FBBF24] font-mono text-xs font-black">
                            {cpn.code}
                          </span>
                          <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            {cpn.type === 'free_shipping'
                              ? 'شحن مجاني'
                              : cpn.type === 'percent'
                              ? `خصم ${cpn.value}%`
                              : `خصم ${cpn.value} ج.م`}
                          </span>
                          {Number(cpn.minOrder) > 0 && (
                            <span className="text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
                              (حد أدنى: {cpn.minOrder} ج.م)
                            </span>
                          )}
                        </div>
                        {cpn.description && (
                          <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">{cpn.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setBuilder((prev) => ({
                              ...prev,
                              coupons: prev.coupons.map((c) =>
                                c.id === cpn.id ? { ...c, active: !c.active } : c
                              ),
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                            cpn.active ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                          }`}
                        >
                          {cpn.active ? 'شغّال' : 'متوقف'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBuilder((prev) => ({
                              ...prev,
                              coupons: prev.coupons.map((c) =>
                                c.id === cpn.id ? { ...c, visible: false, active: false } : c
                              ),
                            }))
                          }
                          title="نقل للأكواد القديمة وإخفاء"
                          className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBuilder((prev) => ({
                              ...prev,
                              coupons: prev.coupons.filter((c) => c.id !== cpn.id),
                            }))
                          }
                          title="حذف نهائي"
                          className="p-1.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Old / Archived Coupons */}
              {archivedCoupons.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-[#D4CCBC] dark:border-[#22355E]">
                  <h3 className="text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                    سجل الأكواد القديمة والأرشيف ({archivedCoupons.length})
                  </h3>
                  <div className="space-y-1.5">
                    {archivedCoupons.map((cpn) => (
                      <div
                        key={cpn.id}
                        className="p-2.5 rounded-xl bg-[#EFE9DC]/60 dark:bg-[#132040]/50 border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2 text-xs opacity-85"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-stone-500 text-white font-mono text-[11px] font-black">
                            {cpn.code}
                          </span>
                          <span className="truncate font-bold">
                            {cpn.type === 'free_shipping'
                              ? 'شحن مجاني'
                              : cpn.type === 'percent'
                              ? `${cpn.value}%`
                              : `${cpn.value} ج.م`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setBuilder((prev) => ({
                                ...prev,
                                coupons: prev.coupons.map((c) =>
                                  c.id === cpn.id ? { ...c, visible: true, active: true } : c
                                ),
                              }))
                            }
                            className="px-2 py-1 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black cursor-pointer"
                          >
                            استعادة وتفعيل
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBuilder((prev) => ({
                                ...prev,
                                coupons: prev.coupons.filter((c) => c.id !== cpn.id),
                              }))
                            }
                            className="p-1 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 5 cols: Flash Offer Countdown + Loyalty Points + Free Shipping Threshold + WhatsApp Support */}
          <div className="lg:col-span-5 space-y-4">
            {/* Flash Offer Countdown Timer */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>عدّاد تنازلي للعرض المؤقت (Flash Offer)</span>
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((prev) => ({
                      ...prev,
                      flashOffer: { ...prev.flashOffer, enabled: !prev.flashOffer.enabled },
                    }))
                  }
                  className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                    builder.flashOffer?.enabled ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.flashOffer?.enabled ? 'مفعّل' : 'معطّل'}
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">
                    عنوان شريط العدّاد:
                  </label>
                  <input
                    type="text"
                    value={builder.flashOffer?.title || ''}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        flashOffer: { ...prev.flashOffer, title: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">
                      تاريخ وساعة انتهاء العرض:
                    </label>
                    <input
                      type="datetime-local"
                      value={builder.flashOffer?.endsAt || ''}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          flashOffer: { ...prev.flashOffer, endsAt: e.target.value },
                        }))
                      }
                      className="w-full h-9 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-[11px] font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">
                      كود الخصم المرتبط (اختياري):
                    </label>
                    <input
                      type="text"
                      value={builder.flashOffer?.couponCode || ''}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          flashOffer: { ...prev.flashOffer, couponCode: e.target.value.toUpperCase() },
                        }))
                      }
                      placeholder="SHAMS5"
                      className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black uppercase"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">ضبط سريع:</span>
                  {[
                    { hours: 24, label: '+24 ساعة' },
                    { hours: 48, label: '+48 ساعة' },
                    { hours: 168, label: '+7 أيام' },
                  ].map((p) => (
                    <button
                      key={p.hours}
                      type="button"
                      onClick={() => applyFlashPresetHours(p.hours)}
                      className="px-2 py-1 rounded-md bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[10px] font-black cursor-pointer hover:border-[#EA580C]"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Loyalty Points Config */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>نظام نقاط الولاء الخفيف</span>
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((prev) => ({
                      ...prev,
                      loyalty: { ...prev.loyalty, enabled: !prev.loyalty.enabled },
                    }))
                  }
                  className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                    builder.loyalty.enabled ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.loyalty.enabled ? 'مفعّل' : 'معطّل'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">
                    نقاط لكل 100 ج.م شراء
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={builder.loyalty.pointsPer100Egp}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        loyalty: { ...prev.loyalty, pointsPer100Egp: Math.max(1, Number(e.target.value) || 10) },
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">
                    قيمة كل 100 نقطة (ج.م)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={builder.loyalty.egpPer100Points}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        loyalty: { ...prev.loyalty, egpPer100Points: Math.max(1, Number(e.target.value) || 10) },
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  رسالة تحفيز نقاط الولاء للعملاء:
                </label>
                <input
                  type="text"
                  value={builder.loyalty.bannerText}
                  onChange={(e) =>
                    setBuilder((prev) => ({
                      ...prev,
                      loyalty: { ...prev.loyalty, bannerText: e.target.value },
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
            </div>

            {/* Extra 1: Free Shipping Minimum Order Threshold */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>شحن مجاني للطلبات فوق حد معين</span>
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((prev) => ({
                      ...prev,
                      freeShippingThresholdEnabled: !prev.freeShippingThresholdEnabled,
                    }))
                  }
                  className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                    builder.freeShippingThresholdEnabled ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.freeShippingThresholdEnabled ? 'مفعّل' : 'معطّل'}
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  مبلغ التفعيل التلقائي للشحن المجاني (ج.م):
                </label>
                <input
                  type="number"
                  min={100}
                  value={builder.freeShippingThresholdAmount}
                  onChange={(e) =>
                    setBuilder((prev) => ({
                      ...prev,
                      freeShippingThresholdAmount: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-full h-9 px-3 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Extra 2: Marketplace Floating WhatsApp Support Button */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>زر واتساب الدعم العائم بالسوق</span>
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((prev) => ({
                      ...prev,
                      whatsappSupport: { ...prev.whatsappSupport, enabled: !prev.whatsappSupport.enabled },
                    }))
                  }
                  className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                    builder.whatsappSupport.enabled ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.whatsappSupport.enabled ? 'ظاهر' : 'مخفي'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">رقم الواتساب (دولي)</label>
                  <input
                    type="text"
                    value={builder.whatsappSupport.phone}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        whatsappSupport: { ...prev.whatsappSupport, phone: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">نص الزر</label>
                  <input
                    type="text"
                    value={builder.whatsappSupport.label}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        whatsappSupport: { ...prev.whatsappSupport, label: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Categories & Product Matrices Drag & Drop */}
      {activeTab === 'categories_matrices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Draggable Categories */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3.5">
            <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>ترتيب وتعديل تصنيفات السوق (Drag & Drop)</span>
            </h2>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
              {builder.decorCategoriesOrder.map((cat, idx) => (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={() => setDragCatIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragCatIndex !== null) {
                      setBuilder((prev) => ({
                        ...prev,
                        decorCategoriesOrder: reorderArray(prev.decorCategoriesOrder, dragCatIndex, idx),
                      }));
                      setDragCatIndex(null);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-2 cursor-grab"
                >
                  <GripVertical className="w-4 h-4 text-[#64748B] shrink-0" />
                  <input
                    type="text"
                    value={cat.nameAr}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        decorCategoriesOrder: prev.decorCategoriesOrder.map((item) =>
                          item.id === cat.id ? { ...item, nameAr: e.target.value } : item
                        ),
                      }))
                    }
                    className="flex-1 h-8 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                  />

                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        decorCategoriesOrder: reorderArray(prev.decorCategoriesOrder, idx, idx - 1),
                      }))
                    }
                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === builder.decorCategoriesOrder.length - 1}
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        decorCategoriesOrder: reorderArray(prev.decorCategoriesOrder, idx, idx + 1),
                      }))
                    }
                    className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBuilder((prev) => ({
                        ...prev,
                        decorCategoriesOrder: prev.decorCategoriesOrder.map((item) =>
                          item.id === cat.id ? { ...item, visible: !item.visible } : item
                        ),
                      }))
                    }
                    className={`p-1.5 rounded-lg text-white cursor-pointer ${cat.visible ? 'bg-emerald-600' : 'bg-stone-500'}`}
                    title={cat.visible ? 'ظاهر' : 'مخفي'}
                  >
                    {cat.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Category */}
            <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E] flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="اسم تصنيف جديد (مثلاً: هدايا رمضان)"
                className="flex-1 h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <input
                type="text"
                value={newCatKeywords}
                onChange={(e) => setNewCatKeywords(e.target.value)}
                placeholder="كلمات دلالية (مفصولة بفاصلة)"
                className="flex-1 h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <button
                type="button"
                onClick={handleAddCustomCategory}
                className="h-9 px-3 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Draggable Product Matrices */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>مصفوفات عرض المنتجات المميزة</span>
              </h2>
              <button
                type="button"
                onClick={handleAddMatrix}
                className="px-3 py-1.5 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مصفوفة</span>
              </button>
            </div>

            <div className="space-y-3">
              {builder.productMatrices.map((mat, idx) => (
                <div
                  key={mat.id}
                  draggable
                  onDragStart={() => setDragMatrixIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragMatrixIndex !== null) {
                      setBuilder((prev) => ({
                        ...prev,
                        productMatrices: reorderArray(prev.productMatrices, dragMatrixIndex, idx),
                      }));
                      setDragMatrixIndex(null);
                    }
                  }}
                  className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5 cursor-grab"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <GripVertical className="w-4 h-4 text-[#64748B] shrink-0" />
                      <input
                        type="text"
                        value={mat.title}
                        onChange={(e) =>
                          setBuilder((prev) => ({
                            ...prev,
                            productMatrices: prev.productMatrices.map((m) =>
                              m.id === mat.id ? { ...m, title: e.target.value } : m
                            ),
                          }))
                        }
                        className="flex-1 h-8 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setBuilder((prev) => ({
                            ...prev,
                            productMatrices: prev.productMatrices.map((m) =>
                              m.id === mat.id ? { ...m, enabled: !m.enabled } : m
                            ),
                          }))
                        }
                        className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                          mat.enabled ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                        }`}
                      >
                        {mat.enabled ? 'مفعلة' : 'معطلة'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBuilder((prev) => ({
                            ...prev,
                            productMatrices: prev.productMatrices.filter((m) => m.id !== mat.id),
                          }))
                        }
                        className="p-1.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <select
                      value={mat.filterType}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          productMatrices: prev.productMatrices.map((m) =>
                            m.id === mat.id ? { ...m, filterType: e.target.value as any } : m
                          ),
                        }))
                      }
                      className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="featured">مختارات مميزة</option>
                      <option value="category">حسب التصنيف</option>
                      <option value="craft">حسب الحرفة</option>
                      <option value="all">أحدث الكل</option>
                    </select>

                    {mat.filterType === 'category' ? (
                      <select
                        value={mat.filterValue || 'all'}
                        onChange={(e) =>
                          setBuilder((prev) => ({
                            ...prev,
                            productMatrices: prev.productMatrices.map((m) =>
                              m.id === mat.id ? { ...m, filterValue: e.target.value } : m
                            ),
                          }))
                        }
                        className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                      >
                        {builder.decorCategoriesOrder.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameAr}
                          </option>
                        ))}
                      </select>
                    ) : mat.filterType === 'craft' ? (
                      <select
                        value={mat.filterValue || 'macrame'}
                        onChange={(e) =>
                          setBuilder((prev) => ({
                            ...prev,
                            productMatrices: prev.productMatrices.map((m) =>
                              m.id === mat.id ? { ...m, filterValue: e.target.value } : m
                            ),
                          }))
                        }
                        className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                      >
                        {SUB_CRAFTS_REGISTRY.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameAr}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={2}
                        max={12}
                        value={mat.limit}
                        onChange={(e) =>
                          setBuilder((prev) => ({
                            ...prev,
                            productMatrices: prev.productMatrices.map((m) =>
                              m.id === mat.id ? { ...m, limit: Math.max(2, Number(e.target.value) || 4) } : m
                            ),
                          }))
                        }
                        title="عدد العناصر"
                        className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono tabular-nums font-bold"
                      />
                    )}

                    <select
                      value={mat.desktopCols}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          productMatrices: prev.productMatrices.map((m) =>
                            m.id === mat.id ? { ...m, desktopCols: Number(e.target.value) as 2 | 3 | 4 } : m
                          ),
                        }))
                      }
                      className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value={2}>ديسكتوب: 2</option>
                      <option value={3}>ديسكتوب: 3</option>
                      <option value={4}>ديسكتوب: 4</option>
                    </select>

                    <select
                      value={mat.mobileCols}
                      onChange={(e) =>
                        setBuilder((prev) => ({
                          ...prev,
                          productMatrices: prev.productMatrices.map((m) =>
                            m.id === mat.id ? { ...m, mobileCols: Number(e.target.value) as 1 | 2 } : m
                          ),
                        }))
                      }
                      className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value={2}>موبايل: 2</option>
                      <option value={1}>موبايل: 1</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Advanced Search across Marketplace Sections, Products & Curated Product Badges */}
      {activeTab === 'products_search' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              <div className="md:col-span-6 relative">
                <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="بحث متقدم في السوق: اسم المنتج، الحرفة، الورشة، أو الفنان..."
                  className="w-full h-10 pr-10 pl-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                />
                {productSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setProductSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="md:col-span-3">
                <select
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                >
                  <option value="all">كل الحالات ({cloudProducts.length})</option>
                  <option value="approved">منشور ومعتمد</option>
                  <option value="pending_approval">بانتظار الاعتماد</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                >
                  <option value="all">كل الأقسام والتصنيفات</option>
                  {builder.decorCategoriesOrder.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Master toggle for Product Badges */}
            <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#475569] dark:text-[#94A3B8]">
                وسوم تمييز المنتجات المختارة (مثل الأكثر طلباً أو إصدار محدود — وسم واحد أنيق على الصورة):
              </span>
              <button
                type="button"
                onClick={() =>
                  setBuilder((prev) => ({
                    ...prev,
                    productBadgesEnabled: !prev.productBadgesEnabled,
                  }))
                }
                className={`px-3 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer ${
                  builder.productBadgesEnabled !== false ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                }`}
              >
                {builder.productBadgesEnabled !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{builder.productBadgesEnabled !== false ? 'إظهار الوسوم بالسوق' : 'إخفاء كل الوسوم'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredMarketProducts.map((p) => {
              const currentBadge = builder.productBadges?.[p.id] || '';
              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex gap-3 p-3">
                    <img
                      src={p.image_url || '/alshams_falcon_emblem.png'}
                      alt={p.product_name}
                      className="w-20 h-20 rounded-xl object-cover border border-[#D4CCBC] dark:border-[#22355E] shrink-0"
                    />
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] line-clamp-2">
                          {p.product_name}
                        </h3>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                            p.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : p.status === 'rejected'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {p.status === 'approved' ? 'معتمد' : p.status === 'rejected' ? 'مرفوض' : 'معلق'}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24] truncate">
                        {p.brand_name} · {p.artist_name}
                      </p>
                      <p className="text-xs font-mono tabular-nums font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        {(p.store_price || p.retail_price || 0).toLocaleString('ar-EG')} ج.م
                      </p>
                    </div>
                  </div>

                  {/* Curated Badge Selector */}
                  <div className="px-3 pb-2.5">
                    <select
                      value={currentBadge}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBuilder((prev) => {
                          const nextBadges = { ...(prev.productBadges || {}) };
                          if (val) nextBadges[p.id] = val;
                          else delete nextBadges[p.id];
                          return { ...prev, productBadges: nextBadges };
                        });
                      }}
                      className="w-full h-8 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold"
                    >
                      <option value="">وسم المنتج: بدون وسم</option>
                      {PRODUCT_BADGE_PRESETS.map((b) => (
                        <option key={b} value={b}>
                          وسم: {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="px-3 pb-3 flex items-center gap-2">
                    {p.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => onApproveCloudProduct(p)}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer"
                      >
                        اعتماد ونشر
                      </button>
                    )}
                    {p.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => onRejectCloudProduct(p)}
                        className="flex-1 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 dark:text-rose-300 text-[11px] font-black cursor-pointer"
                      >
                        إيقاف / رفض
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: Orders, Governorate Shipping Rates & Client Privacy */}
      {activeTab === 'orders_shipping' && (
        <div className="space-y-5">
          {/* Privacy, Shipping Fees & Estimated Delivery Calculator */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs sm:text-sm font-black">خصوصية بيانات العميل</h3>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#EFE9DC] dark:bg-[#132040]">
                  {builder.clientVisibilityMode === 'hide_all'
                    ? 'إخفاء عن الجميع'
                    : builder.clientVisibilityMode === 'custom_per_workshop'
                    ? 'مخصص للورش'
                    : 'إظهار للجميع'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleSetClientVisibilityMode('show_all')}
                  className={`py-1.5 rounded-lg font-black cursor-pointer ${
                    builder.clientVisibilityMode === 'show_all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#EFE9DC] dark:bg-[#132040]'
                  }`}
                >
                  للجميع
                </button>
                <button
                  type="button"
                  onClick={() => handleSetClientVisibilityMode('hide_all')}
                  className={`py-1.5 rounded-lg font-black cursor-pointer ${
                    builder.clientVisibilityMode === 'hide_all'
                      ? 'bg-[#0C1427] text-[#FBBF24] dark:bg-[#EA580C] dark:text-white'
                      : 'bg-[#EFE9DC] dark:bg-[#132040]'
                  }`}
                >
                  إخفاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSetClientVisibilityMode('custom_per_workshop');
                    setActiveTab('builder');
                  }}
                  className={`py-1.5 rounded-lg font-black cursor-pointer ${
                    builder.clientVisibilityMode === 'custom_per_workshop'
                      ? 'bg-[#EA580C] text-white'
                      : 'bg-[#EFE9DC] dark:bg-[#132040]'
                  }`}
                >
                  مخصص
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#EA580C]" />
                  <h3 className="text-xs sm:text-sm font-black">رسوم التجهيز والمحافظات</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingGovRates((prev) => !prev)}
                  className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] cursor-pointer"
                >
                  {editingGovRates ? 'إغلاق' : 'تعديل المحافظات'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">التغليف (ج.م)</label>
                  <input
                    type="number"
                    value={shippingConfig.packagingFee}
                    onChange={(e) =>
                      setShippingConfig((prev) => ({ ...prev, packagingFee: Number(e.target.value) || 0 }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">المناولة (ج.م)</label>
                  <input
                    type="number"
                    value={shippingConfig.storageAndHandlingFee}
                    onChange={(e) =>
                      setShippingConfig((prev) => ({ ...prev, storageAndHandlingFee: Number(e.target.value) || 0 }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono tabular-nums font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Estimated Delivery Calculator Settings */}
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#EA580C]" />
                  <h3 className="text-xs sm:text-sm font-black">تقدير تاريخ الاستلام بالسلة</h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBuilder((prev) => ({
                      ...prev,
                      estimatedDelivery: {
                        ...prev.estimatedDelivery,
                        enabled: !prev.estimatedDelivery.enabled,
                      },
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                    builder.estimatedDelivery?.enabled !== false ? 'bg-emerald-600 text-white' : 'bg-stone-500 text-white'
                  }`}
                >
                  {builder.estimatedDelivery?.enabled !== false ? 'ظاهر' : 'مخفي'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">أقل (أيام)</label>
                  <input
                    type="number"
                    min={1}
                    value={builder.estimatedDelivery?.productionDaysMin ?? 3}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        estimatedDelivery: {
                          ...prev.estimatedDelivery,
                          productionDaysMin: Math.max(1, Number(e.target.value) || 3),
                        },
                      }))
                    }
                    className="w-full h-9 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">أقصى (أيام)</label>
                  <input
                    type="number"
                    min={2}
                    value={builder.estimatedDelivery?.productionDaysMax ?? 5}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        estimatedDelivery: {
                          ...prev.estimatedDelivery,
                          productionDaysMax: Math.max(2, Number(e.target.value) || 5),
                        },
                      }))
                    }
                    className="w-full h-9 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-1">+الصعيد</label>
                  <input
                    type="number"
                    min={0}
                    value={builder.estimatedDelivery?.upperEgyptExtraDays ?? 2}
                    onChange={(e) =>
                      setBuilder((prev) => ({
                        ...prev,
                        estimatedDelivery: {
                          ...prev.estimatedDelivery,
                          upperEgyptExtraDays: Math.max(0, Number(e.target.value) || 0),
                        },
                      }))
                    }
                    className="w-full h-9 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono tabular-nums font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {editingGovRates && (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {Object.entries(shippingConfig.governorateRates).map(([gov, price]) => (
                  <div key={gov} className="space-y-1">
                    <label className="text-[11px] font-bold block truncate">{gov}</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) =>
                        setShippingConfig((prev) => ({
                          ...prev,
                          governorateRates: {
                            ...prev.governorateRates,
                            [gov]: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-full h-8 px-2 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono tabular-nums font-bold"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={savingMarketSettings}
                onClick={() => onSaveMarketControlSettings(builder)}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
              >
                حفظ تعريفة الشحن سحابياً
              </button>
            </div>
          )}

          {/* Central Orders Search & Management */}
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="بحث في طلبات السوق (رقم الفاتورة، العميل، الهاتف، المحافظة)..."
                  className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="all">كل حالات الطلبات</option>
                <option value="pending_approval">بانتظار التأكيد</option>
                <option value="processing">قيد التجهيز</option>
                <option value="shipped">تم الشحن</option>
                <option value="delivered">تم التسليم</option>
              </select>
            </div>

            {filteredOrders.length === 0 ? (
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] text-center py-6">لا توجد طلبات مطابقة حالياً.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredOrders.map((ord) => {
                  const isHidden = ord.isClientDataHiddenFromArtisan !== false;
                  return (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-0.5 text-xs">
                        <div className="font-black">
                          #{ord.invoiceNumber} — {ord.customerName} ({ord.governorate})
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]">
                          {ord.customerPhone} · الإجمالي: {(ord.finalTotal || 0).toLocaleString('ar-EG')} ج.م · العربون: {(ord.advancePaymentAmount || 0).toLocaleString('ar-EG')} ج.م
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateMarketOrderStatus(ord.id, {
                              isClientDataHiddenFromArtisan: !isHidden,
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black cursor-pointer ${
                            isHidden
                              ? 'bg-stone-600 text-white'
                              : 'bg-sky-700 text-white'
                          }`}
                          title="التبديل بين إخفاء وإظهار بيانات العميل للورشة لهذا الطلب"
                        >
                          {isHidden ? 'بيانات العميل محجوبة للورشة' : 'بيانات العميل ظاهرة للورشة'}
                        </button>
                        {!ord.advancePaymentConfirmed && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMarketOrderStatus(ord.id, {
                                advancePaymentConfirmed: true,
                                marketplaceStatus: 'processing',
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black cursor-pointer"
                          >
                            تأكيد العربون
                          </button>
                        )}
                        <select
                          value={ord.marketplaceStatus || 'pending_approval'}
                          onChange={(e) => onUpdateMarketOrderStatus(ord.id, { marketplaceStatus: e.target.value })}
                          className="h-8 px-2 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold"
                        >
                          <option value="pending_approval">معلق</option>
                          <option value="processing">جاري التجهيز</option>
                          <option value="shipped">تم الشحن</option>
                          <option value="delivered">تم التسليم</option>
                          <option value="cancelled">ملغي</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: QR & Central Market Poster */}
      {activeTab === 'qr_poster' && (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="p-4 rounded-2xl bg-white border border-[#D4CCBC] shrink-0">
            <QRCodeCanvas
              id="central-market-qr-canvas"
              value={centralMarketUrl}
              size={180}
              level="H"
              includeMargin
            />
          </div>

          <div className="space-y-3 flex-1 text-center md:text-right">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <QrCode className="w-5 h-5 text-[#EA580C]" />
              <h2 className="text-base font-black">بوابة التسويق وبوستر سوق الشمساوية</h2>
            </div>
            <p className="text-xs font-mono text-[#C2410C] dark:text-[#FBBF24] break-all">{centralMarketUrl}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={onCopyMarketUrl}
                className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الرابط</span>
              </button>
              <button
                type="button"
                onClick={onShareMarketWhatsApp}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>مشاركة واتساب</span>
              </button>
              <button
                type="button"
                onClick={onDownloadMarketPoster}
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
