import React, { useEffect, useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { MainSectionId } from '../../registry/craftsRegistry';
import { ProductDiscountConfig } from '../../types/artisanStoreBuilder';
import {
  DEFAULT_PRODUCT_OFFER,
  ProductOfferEditorSection,
} from '../store/ProductOfferEditorSection';
import {
  SupplierCatalogItem,
  SupplierCatalogVariant,
  SupplierPriceTier,
  SUPPLIER_SUPPLY_SECTIONS,
  SUPPLIER_DEFAULT_UNITS,
} from '../../types/supplier';
import {
  fetchSupplierCatalog,
  upsertSupplierCatalogItem,
  deleteSupplierCatalogItem,
  publishSupplierOfferAlert,
} from '../../db/supplierService';
import {
  ArrowRight,
  X,
  Plus,
  Search,
  Edit3,
  Trash2,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  Boxes,
  Megaphone,
  Layers,
  Send,
  Radio,
  CheckSquare,
  Square,
  Video,
} from 'lucide-react';
import { ProductVideoThumbnail } from '../common/ProductVideoThumbnail';
import { isValidHttpVideoUrl } from '../../lib/catalogStatus';

import { compressImageFile, MAX_ITEM_IMAGES } from '../../utils/imageCompressor';
import { useUiLayoutConfig } from '../../types/uiLayoutConfig';
import {
  UnifiedMaterialPickerModal,
  UnifiedPickerSelectionItem,
} from '../materials/UnifiedMaterialPickerModal';
import {
  updateOrProposeUnifiedMasterApi,
  contributeUnifiedMasterApi,
} from '../../db/unifiedMaterialsService';
import {
  getDefaultMarketBasePrice,
  resolveEffectiveBrandPrice,
} from '../../utils/unifiedMarketPricing';

interface SupplierCatalogViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
  initialOpenUnifiedPicker?: boolean;
  onResetOpenUnifiedPicker?: () => void;
}

export const SupplierCatalogView: React.FC<SupplierCatalogViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
  initialOpenUnifiedPicker = false,
  onResetOpenUnifiedPicker,
}) => {
  const uiLayout = useUiLayoutConfig();
  const maxAllowedImages = Math.min(8, Math.max(1, Number(uiLayout.supplier?.maxProductImages || MAX_ITEM_IMAGES)));
  const currencySymbol = profile.currencySymbol || 'ج.م';
  const [items, setItems] = useState<SupplierCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState<'all' | MainSectionId>('all');
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<string>>(new Set());
  const [exportingMarket, setExportingMarket] = useState(false);
  const [pendingAdminBanner, setPendingAdminBanner] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Draft item state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [sectionId, setSectionId] = useState<MainSectionId>('ropes_textiles');
  const [unit, setUnit] = useState('بكرة');
  const [description, setDescription] = useState('');
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number>(0);
  const [minWholesaleQty, setMinWholesaleQty] = useState<number>(5);
  const [stockQty, setStockQty] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [productDiscount, setProductDiscount] = useState<ProductDiscountConfig>({
    ...DEFAULT_PRODUCT_OFFER,
  });
  const supplierCouponCodes = useMemo(() => {
    const rich = ((profile.storeConfig?.richCoupons || []) as any[])
      .filter((c: any) => c?.active && c?.code)
      .map((c: any) => String(c.code));
    const legacy = ((profile.storeConfig?.coupons || []) as any[])
      .filter((c: any) => c?.active && c?.code)
      .map((c: any) => String(c.code));
    return Array.from(new Set([...rich, ...legacy]));
  }, [profile.storeConfig]);
  const [inStore, setInStore] = useState(true);
  const [inMarket, setInMarket] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [variants, setVariants] = useState<SupplierCatalogVariant[]>([]);
  const [tierPricing, setTierPricing] = useState<SupplierPriceTier[]>([]);
  const [unifiedCode, setUnifiedCode] = useState('');
  const [specCode, setSpecCode] = useState('');
  const [brandCode, setBrandCode] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [unitChain, setUnitChain] = useState('');
  const [isUnifiedPickerOpen, setIsUnifiedPickerOpen] = useState(initialOpenUnifiedPicker);

  // Offer & New Stock Alert Modal
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertType, setAlertType] = useState<'offer' | 'new_stock' | 'price_drop'>('offer');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertBadge, setAlertBadge] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSending, setAlertSending] = useState(false);
  const [alertToast, setAlertToast] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    const data = await fetchSupplierCatalog();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (initialOpenUnifiedPicker) {
      setIsUnifiedPickerOpen(true);
      onResetOpenUnifiedPicker?.();
    }
  }, [initialOpenUnifiedPicker]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (sectionFilter !== 'all' && item.sectionId !== sectionFilter) return false;
      if (onlyLowStock && Number(item.stockQty) > 5) return false;
      if (q) {
        const hay = `${item.name} ${item.description || ''} ${item.unit} ${item.skuCode || ''} ${item.unifiedCode || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, sectionFilter, onlyLowStock, search]);

  const openNewModal = () => {
    setEditingId(undefined);
    setName('');
    setSectionId((profile.supplySections?.[0] as MainSectionId) || 'ropes_textiles');
    setUnit('بكرة');
    setDescription('');
    setRetailPrice(0);
    setWholesalePrice(0);
    setMinWholesaleQty(5);
    setStockQty(10);
    setDiscountType('none');
    setDiscountValue(0);
    setProductDiscount({ ...DEFAULT_PRODUCT_OFFER });
    setInStore(true);
    setInMarket(false);
    setImages([]);
    setVideoUrl('');
    setVariants([]);
    setTierPricing([]);
    setUnifiedCode('');
    setSpecCode('');
    setBrandCode('');
    setSkuCode('');
    setUnitChain('');
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: SupplierCatalogItem) => {
    setEditingId(item.id);
    setName(item.name);
    setSectionId(item.sectionId);
    setUnit(item.unit || 'بكرة');
    setDescription(item.description || '');
    setRetailPrice(Number(item.retailPrice || 0));
    setWholesalePrice(Number(item.wholesalePrice || 0));
    setMinWholesaleQty(Number(item.minWholesaleQty || 1));
    setStockQty(Number(item.stockQty || 0));
    setDiscountType(item.discountType || 'none');
    setDiscountValue(Number(item.discountValue || 0));
    setProductDiscount(
      item.productDiscount
        ? { ...DEFAULT_PRODUCT_OFFER, ...item.productDiscount }
        : {
            ...DEFAULT_PRODUCT_OFFER,
            enabled: item.discountType !== 'none' && Number(item.discountValue || 0) > 0,
            type: item.discountType === 'fixed' ? 'fixed' : 'percent',
            value: Number(item.discountValue || 0),
          }
    );
    setInStore(item.inStore);
    setInMarket(Boolean(item.inMarket));
    setImages(Array.isArray(item.images) ? item.images.slice(0, maxAllowedImages) : []);
    setVideoUrl(item.videoUrl || '');
    setVariants(Array.isArray(item.variants) ? item.variants : []);
    setTierPricing(Array.isArray(item.tierPricing) ? item.tierPricing : []);
    setUnifiedCode(item.unifiedCode || '');
    setSpecCode(item.specCode || '');
    setBrandCode(item.brandCode || '');
    setSkuCode(item.skuCode || '');
    setUnitChain(item.unitChain || '');
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const remaining = Math.max(0, maxAllowedImages - images.length);
    const files = Array.from(e.target.files || []).slice(0, remaining);
    if (files.length === 0) return;
    try {
      const encoded = await Promise.all(
        files.map((file) =>
          compressImageFile(file, {
            maxWidth: 800,
            maxHeight: 800,
            targetMaxKb: 95,
            initialQuality: 0.78,
          })
        )
      );
      setImages((prev) => [...prev, ...encoded].slice(0, maxAllowedImages));
    } catch {}
    e.target.value = '';
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        colorOrSize: '',
        thicknessOrSpec: '',
        sku: '',
        stockQty: 0,
      },
    ]);
  };

  const triggerPendingAdminBanner = () => {
    setPendingAdminBanner('هذا المنتج في انتظار مراجعة الأدمن');
    setTimeout(() => setPendingAdminBanner(null), 3000);
  };

  const saveItemWithMode = async (mode: 'store_only' | 'market_submit') => {
    if (!name.trim()) {
      setFeedback({ text: 'يرجى كتابة اسم الخامة.', isError: true });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const targetInMarket = mode === 'market_submit' ? true : Boolean(inMarket);
    const prevEditing = editingId ? items.find((it) => it.id === editingId) : undefined;
    const shouldReSubmit =
      mode === 'market_submit' || Boolean(prevEditing?.inMarket);

    const res = await upsertSupplierCatalogItem({
      id: editingId,
      name: name.trim(),
      sectionId,
      unit: unit.trim() || 'قطعة',
      description: description.trim(),
      retailPrice: Number(retailPrice),
      wholesalePrice: Number(wholesalePrice || retailPrice),
      minWholesaleQty: Math.max(1, Number(minWholesaleQty || 1)),
      stockQty: Math.max(0, Number(stockQty || 0)),
      discountType:
        productDiscount.enabled && productDiscount.type === 'percent' && productDiscount.applyMode !== 'coupon'
          ? 'percent'
          : productDiscount.enabled && productDiscount.type === 'fixed' && productDiscount.applyMode !== 'coupon'
          ? 'fixed'
          : discountType,
      discountValue:
        productDiscount.enabled &&
        (productDiscount.type === 'percent' || productDiscount.type === 'fixed') &&
        productDiscount.applyMode !== 'coupon'
          ? Number(productDiscount.value || 0)
          : Number(discountValue || 0),
      productDiscount:
        productDiscount.enabled || productDiscount.isBestSeller ? productDiscount : undefined,
      inStore,
      inMarket: targetInMarket,
      reSubmitForApproval: targetInMarket && shouldReSubmit,
      images: images.slice(0, maxAllowedImages),
      videoUrl: videoUrl.trim(),
      variants: variants.filter((v) => v.colorOrSize.trim()),
      tierPricing: tierPricing
        .filter((t) => Number(t.minQty) > 0 && Number(t.unitPrice) > 0)
        .sort((a, b) => Number(a.minQty) - Number(b.minQty)),
      unifiedCode: unifiedCode.trim() || undefined,
      specCode: specCode.trim() || undefined,
      brandCode: brandCode.trim() || undefined,
      skuCode: skuCode.trim() || undefined,
      unitChain: unitChain.trim() || undefined,
      sourceCurrency: profile.currency || 'EGP',
    });
    setSaving(false);

    if (!res.success) {
      setFeedback({ text: res.error || 'تعذر حفظ الخامة', isError: true });
      return;
    }

    if (prevEditing && unifiedCode.trim() && prevEditing.name.trim() !== name.trim()) {
      updateOrProposeUnifiedMasterApi(unifiedCode.trim(), {
        action: 'update',
        canonicalName: name.trim(),
        actorRole: 'supplier',
        actorId: profile.id,
        actorName: profile.brandName || profile.artistName || 'مورد',
        reason: `تعديل مسمى الصنف لدى المورد من "${prevEditing.name}" إلى "${name.trim()}"`,
      }).catch(() => {});
    }

    // Record supplier's selling price as an isolated price observation (feeds Super Admin review & periodic market average, NEVER overwrites global price directly)
    const savedRetail = Number(retailPrice || 0);
    if (
      unifiedCode.trim() &&
      savedRetail > 0 &&
      (!prevEditing || Number(prevEditing.retailPrice || 0) !== savedRetail)
    ) {
      contributeUnifiedMasterApi(unifiedCode.trim(), {
        personalBasePrice: savedRetail,
        actorRole: 'supplier',
        actorId: profile.id,
        actorName: profile.brandName || profile.artistName || 'مورد',
      }).catch(() => {});
    }

    await loadItems();
    setIsModalOpen(false);
    setAlertToast(
      targetInMarket
        ? `تم حفظ "${name.trim()}" وإرسالها لمراجعة الأدمن قبل الظهور في سوق الموردين`
        : `تم حفظ "${name.trim()}" في الكتالوج والمتجر الخاص بنجاح`
    );
    setTimeout(() => setAlertToast(null), 4000);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveItemWithMode(inMarket ? 'market_submit' : 'store_only');
  };

  const handleBulkExportToSupplierMarket = async (targets: SupplierCatalogItem[]) => {
    if (targets.length === 0) return;
    setExportingMarket(true);
    try {
      for (const item of targets) {
        await upsertSupplierCatalogItem({
          ...item,
          inMarket: true,
          reSubmitForApproval: true,
        });
      }
      await loadItems();
      setSelectedMarketIds(new Set());
      setAlertToast(`تم إرسال (${targets.length}) خامة لمراجعة الأدمن تمهيداً للعرض في سوق الموردين`);
      setTimeout(() => setAlertToast(null), 4500);
    } finally {
      setExportingMarket(false);
    }
  };

  const handleSendOfferAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim()) return;
    setAlertSending(true);
    const res = await publishSupplierOfferAlert({
      alertType,
      title: alertTitle.trim(),
      message: alertMessage.trim(),
      discountBadge: alertBadge.trim(),
      sectionId: sectionFilter !== 'all' ? sectionFilter : profile.supplySections?.[0] || 'all',
    });
    setAlertSending(false);
    if (res.success) {
      setIsAlertModalOpen(false);
      setAlertTitle('');
      setAlertBadge('');
      setAlertMessage('');
      setAlertToast('تم إرسال تنبيه العرض / التوريد الجديد إلى كافة الورش وسوق الموردين بنجاح!');
      setTimeout(() => setAlertToast(null), 4500);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteSupplierCatalogItem(id);
    if (ok) {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }
  };

  const handleUnifiedLinkForSupplier = (selected: UnifiedPickerSelectionItem[]) => {
    const pick = selected[0];
    if (!pick) return;
    const prefixToSupplySection: Record<string, MainSectionId> = {
      TH: 'ropes_textiles',
      BD: 'beads_embroidery',
      WD: 'woods',
      LT: 'beads_embroidery',
      MT: 'beads_embroidery',
      CL: 'clays_composites',
      AR: 'beads_embroidery',
      DC: 'woods',
      PK: 'ropes_textiles',
      PP: 'clays_composites',
      GL: 'clays_composites',
      AX: 'ropes_textiles',
    };
    const composedName = pick.spec
      ? `${pick.master.canonicalName} — ${pick.spec.label}${pick.brandName && pick.brandCode !== 'B000' ? ` (${pick.brandName})` : ''}`
      : `${pick.master.canonicalName}${pick.brandName && pick.brandCode !== 'B000' ? ` (${pick.brandName})` : ''}`;

    setUnifiedCode(pick.master.code);
    setSpecCode(pick.specCode || '');
    setBrandCode(pick.brandCode || '');
    setSkuCode(pick.skuCode || pick.specCode || pick.master.code);
    setUnitChain(pick.master.unitChain);
    if (!name.trim()) setName(composedName);
    if (prefixToSupplySection[pick.master.prefix]) {
      setSectionId(prefixToSupplySection[pick.master.prefix]);
    }
    if (SUPPLIER_DEFAULT_UNITS.includes(pick.recommendedUnitName)) {
      setUnit(pick.recommendedUnitName);
    }
    const effectiveStartPrice =
      Number(pick.personalBasePrice) > 0
        ? Number(pick.personalBasePrice)
        : pick.brandName && pick.brandCode !== 'B000'
        ? resolveEffectiveBrandPrice(
            pick.master,
            pick.brandName,
            pick.personalBrandPrices,
            pick.personalBasePrice
          ).price
        : pick.selectedBrands && pick.selectedBrands.length > 0
        ? resolveEffectiveBrandPrice(
            pick.master,
            pick.selectedBrands[0],
            pick.personalBrandPrices,
            pick.personalBasePrice
          ).price
        : Number(pick.master.marketBasePrice) > 0
        ? Number(pick.master.marketBasePrice)
        : getDefaultMarketBasePrice(pick.master);

    if (effectiveStartPrice > 0 && retailPrice <= 0) {
      setRetailPrice(effectiveStartPrice);
    }
    if (!isModalOpen) {
      setEditingId(undefined);
      setName(composedName);
      if (effectiveStartPrice > 0) setRetailPrice(effectiveStartPrice);
      setIsModalOpen(true);
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
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#EA580C]" />
              <span>كتالوج الخامات والمخزون</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              أضف خاماتك بأسعار الجملة والقطاعي والكميات المتاحة وتوزيعها
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAlertModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#132040] text-[#FBBF24] border border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Megaphone className="w-4 h-4" />
            <span>تنبيه عروض / وصول جديد للورش</span>
          </button>
          <button
            type="button"
            onClick={() => setIsUnifiedPickerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#0C1427] hover:bg-[#1A2B54] text-[#FBBF24] border border-amber-400/40 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Layers className="w-4 h-4" />
            <span>استيراد من منظومة الخامات الموحدة</span>
          </button>
          <button
            type="button"
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة خامة جديدة</span>
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

      {alertToast && (
        <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400/50 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{alertToast}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSectionFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer transition ${
              sectionFilter === 'all'
                ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
            }`}
          >
            الكل ({items.length})
          </button>
          {SUPPLIER_SUPPLY_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSectionFilter(s.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition ${
                sectionFilter === s.id
                  ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                  : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
              }`}
            >
              {s.titleAr}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#334155] dark:text-[#CBD5E1] cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(e) => setOnlyLowStock(e.target.checked)}
              className="accent-[#EA580C]"
            />
            <span>مخزون منخفض فقط</span>
          </label>
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الخامة..."
              className="w-full px-3 py-2 pr-8 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] text-xs font-bold outline-none"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* 3-Second Pending Admin Review Banner */}
      {pendingAdminBanner && (
        <div className="rounded-2xl px-4 py-3 bg-rose-600 text-white text-xs sm:text-sm font-black flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 animate-pulse shrink-0" />
            <span>{pendingAdminBanner}</span>
          </div>
          <span className="text-[10px] opacity-85">بانتظار مراجعة واعتماد السوبر أدمن</span>
        </div>
      )}

      {/* Multi-select & Bulk Export to Suppliers Market Bar */}
      {filtered.length > 0 && (
        <div className="p-3 rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040]/80 border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedMarketIds.size === filtered.length) {
                setSelectedMarketIds(new Set());
              } else {
                setSelectedMarketIds(new Set(filtered.map((x) => x.id)));
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black cursor-pointer"
          >
            {selectedMarketIds.size === filtered.length && filtered.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-[#EA580C]" />
            ) : (
              <Square className="w-4 h-4 text-[#475569]" />
            )}
            <span>
              {selectedMarketIds.size === filtered.length
                ? 'إلغاء تحديد الكل'
                : `تحديد الكل للتصدير لسوق الموردين (${filtered.length})`}
            </span>
          </button>

          {selectedMarketIds.size > 0 && (
            <button
              type="button"
              disabled={exportingMarket}
              onClick={() =>
                handleBulkExportToSupplierMarket(filtered.filter((x) => selectedMarketIds.has(x.id)))
              }
              className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-55"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {exportingMarket
                  ? 'جاري التصدير...'
                  : `تصدير المحدد لسوق الموردين (${selectedMarketIds.size})`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Catalog Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          جاري تحميل كتالوج الخامات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center space-y-3">
          <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            لا توجد خامات مطابقة في الكتالوج حالياً
          </p>
          <button
            type="button"
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>أضف أول خامة الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const secTitle =
              SUPPLIER_SUPPLY_SECTIONS.find((s) => s.id === item.sectionId)?.titleAr ||
              item.sectionId;
            const isChecked = selectedMarketIds.has(item.id);
            const isApprovedInMarket = Boolean(item.inMarket && item.isApproved);
            const isPendingInMarket = Boolean(item.inMarket && !item.isApproved);

            return (
              <div
                key={item.id}
                className={`rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border overflow-hidden flex flex-col justify-between transition ${
                  isChecked
                    ? 'border-[#EA580C] ring-2 ring-[#EA580C]/40'
                    : 'border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                <div>
                  <div className="relative">
                    {item.images[0] ? (
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="w-full h-40 object-cover border-b border-[#D4CCBC] dark:border-[#22355E]"
                      />
                    ) : (
                      <div className="w-full h-28 bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                        {secTitle}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMarketIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })
                      }
                      className="absolute top-2.5 left-2.5 w-7 h-7 rounded-lg bg-white/95 dark:bg-[#0C1427]/90 border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shadow-xs cursor-pointer"
                      title="تحديد للتصدير لسوق الموردين"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#EA580C]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#475569]" />
                      )}
                    </button>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold text-[#C2410C] dark:text-amber-300">
                          {secTitle}
                        </div>
                        {(item.skuCode || item.specCode || item.unifiedCode) && (
                          <span className="px-2 py-0.5 rounded-md bg-[#0C1427] text-[#FBBF24] font-mono tabular-nums text-[10px] font-black">
                            {item.skuCode || item.specCode || item.unifiedCode}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        {item.name}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                      <div>
                        <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">قطاعي / {item.unit}</div>
                        <div className="font-black font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]">
                          {Number(item.retailPrice).toLocaleString()} {currencySymbol}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                          جملة (من {item.minWholesaleQty} {item.unit})
                        </div>
                        <div className="font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                          {Number(item.wholesalePrice).toLocaleString()} {currencySymbol}
                        </div>
                      </div>
                    </div>

                    {item.tierPricing && item.tierPricing.length > 0 && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[10px] space-y-1">
                        <div className="font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>شرائح الكميات المتدرجة:</span>
                        </div>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono tabular-nums font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                          {item.tierPricing.map((t, i) => (
                            <span key={i}>
                              ≥{t.minQty} {item.unit}: {t.unitPrice} {currencySymbol}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span
                        className={`font-bold font-mono tabular-nums ${
                          item.stockQty <= 5
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-[#334155] dark:text-[#CBD5E1]'
                        }`}
                      >
                        المتوفر: {item.stockQty} {item.unit}
                      </span>
                      <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                        {item.inStore ? 'متجر المورد' : ''}
                      </span>
                    </div>

                    {/* Market Status Lamp */}
                    <div className="pt-1">
                      {isApprovedInMarket ? (
                        <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400/60 flex items-center justify-between text-[11px] font-black text-emerald-800 dark:text-emerald-200">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
                            <span>معروض بسوق الموردين</span>
                          </span>
                          <span className="text-[10px]">معتمد ✓</span>
                        </div>
                      ) : isPendingInMarket ? (
                        <button
                          type="button"
                          onClick={triggerPendingAdminBanner}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500 text-rose-700 dark:text-rose-300 flex items-center justify-between text-[11px] font-black cursor-pointer animate-pulse"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.95)]" />
                            <span>قيد مراجعة الأدمن</span>
                          </span>
                          <span className="text-[10px] underline">اضغط للتفاصيل</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBulkExportToSupplierMarket([item])}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] hover:border-[#EA580C] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center gap-1.5 text-[11px] font-black cursor-pointer transition"
                        >
                          <Send className="w-3 h-3 text-[#EA580C]" />
                          <span>تصدير لسوق الموردين</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-[#EFE9DC]/60 dark:bg-[#132040]/60 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Catalog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>رجوع</span>
              </button>
              <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                {editingId ? 'تعديل بيانات الخامة' : 'إضافة خامة جديدة للكتالوج'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {feedback && (
                <div
                  className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
                    feedback.isError
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                  }`}
                >
                  {feedback.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{feedback.text}</span>
                </div>
              )}

              {/* Unified Material SKU Link Banner inside Modal */}
              <div className="p-3 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-black text-[#0C1427] dark:text-[#F7F3EA] block">
                    الربط مع منظومة الخامات الموحدة (SKU + الماركة)
                  </span>
                  {skuCode || unifiedCode ? (
                    <span className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] inline-flex items-center gap-2">
                      <span>الكود التجاري المعتمد:</span>
                      <span className="px-2 py-0.5 rounded bg-[#0C1427] text-[#FBBF24] font-mono tabular-nums font-black">
                        {skuCode || specCode || unifiedCode}
                      </span>
                      {unitChain && <span className="font-mono">({unitChain})</span>}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                      اختياري: اربط الصنف بكود المنظومة الموحد + الماركة (#B003) لتوحيد البحث مع جميع الورش
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsUnifiedPickerOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#0C1427] text-[#FBBF24] font-black cursor-pointer inline-flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{unifiedCode ? 'تغيير الكود الموحد' : 'اختيار / ربط كود موحد'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">اسم الخامة *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: خيط مكرمية قطن مجدول 4مم"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">قسم التوريد</label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value as MainSectionId)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                  >
                    {SUPPLIER_SUPPLY_SECTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titleAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold mb-1">وحدة البيع</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                  >
                    {SUPPLIER_DEFAULT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">سعر القطاعي ({currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">سعر الجملة ({currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">الحد الأدنى للجملة</label>
                  <input
                    type="number"
                    min={1}
                    value={minWholesaleQty}
                    onChange={(e) => setMinWholesaleQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block font-bold mb-1">الرصيد المتاح بالمخزن</label>
                  <input
                    type="number"
                    min={0}
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                  />
                </div>
                <ProductOfferEditorSection
                  value={productDiscount}
                  onChange={(next) => {
                    setProductDiscount(next);
                    if (next.enabled && (next.type === 'percent' || next.type === 'fixed') && next.applyMode !== 'coupon') {
                      setDiscountType(next.type);
                      setDiscountValue(Number(next.value || 0));
                    } else {
                      setDiscountType('none');
                      setDiscountValue(0);
                    }
                  }}
                  basePrice={Number(retailPrice || 0)}
                  currencySymbol={currencySymbol}
                  availableCouponCodes={supplierCouponCodes}
                  sectionTitle="عروض وخصومات الخامة في متجر المورد (قبل/بعد · اشتري X+Y · لفترة محدودة)"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">مواصفات الخامة (الوزن / الطول / الجودة)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مثال: قطن مصري 100% وزن البكرة 500 جرام..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                />
              </div>

              {/* Variants */}
              <div className="space-y-2 p-3 rounded-2xl bg-[#EFE9DC]/60 dark:bg-[#132040]/50 border border-[#D4CCBC] dark:border-[#22355E]">
                <div className="flex items-center justify-between">
                  <span className="font-black">درجات الألوان / المقاسات المتوفرة</span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="text-[11px] font-black text-[#C2410C] dark:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة درجة/لون</span>
                  </button>
                </div>
                {variants.map((v, idx) => (
                  <div key={v.id} className="grid grid-cols-4 gap-2 items-center">
                    <input
                      type="text"
                      value={v.colorOrSize}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariants((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, colorOrSize: val } : row))
                        );
                      }}
                      placeholder="اللون / المقاس"
                      className="px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-bold"
                    />
                    <input
                      type="text"
                      value={v.thicknessOrSpec || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, thicknessOrSpec: val } : row
                          )
                        );
                      }}
                      placeholder="السمك / الوزن"
                      className="px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-bold"
                    />
                    <input
                      type="number"
                      min={0}
                      value={v.stockQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVariants((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, stockQty: val } : row))
                        );
                      }}
                      placeholder="الكمية"
                      className="px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-600 font-bold text-center cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>

              {/* Tiered Volume Pricing */}
              <div className="space-y-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      شرائح أسعار الكميات المتدرجة (خصم تلقائي للكميات الكبيرة)
                    </span>
                    <p className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                      مثال: من 10 بكرات بـ 90 ج.م · من 25 بكرة بـ 82 ج.م · من 50 بكرة بـ 75 ج.م
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setTierPricing((prev) => [
                        ...prev,
                        { minQty: prev.length === 0 ? 10 : (prev[prev.length - 1]?.minQty || 10) + 15, unitPrice: wholesalePrice || retailPrice || 0 },
                      ])
                    }
                    className="text-[11px] font-black text-[#C2410C] dark:text-amber-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة شريحة كمية</span>
                  </button>
                </div>

                {tierPricing.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold shrink-0">من كمية ≥</span>
                      <input
                        type="number"
                        min={1}
                        value={tier.minQty}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value || 1));
                          setTierPricing((prev) => prev.map((r, i) => (i === idx ? { ...r, minQty: val } : r)));
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold shrink-0">سعر الوحدة</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.unitPrice}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value || 0));
                          setTierPricing((prev) => prev.map((r, i) => (i === idx ? { ...r, unitPrice: val } : r)));
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono font-bold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTierPricing((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-600 font-bold text-center cursor-pointer"
                    >
                      حذف الشريحة
                    </button>
                  </div>
                ))}
              </div>

              {/* Images Upload (Dynamic max images per Super Admin Studio) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-black">صور الخامة ({images.length} / {maxAllowedImages} صور بحد أقصى)</span>
                    <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      ضغط تلقائي ذكي لتقليل حجم الصور في قاعدة البيانات
                    </p>
                  </div>
                  {images.length < maxAllowedImages ? (
                    <label className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-black cursor-pointer inline-flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5 text-[#EA580C]" />
                      <span>رفع صورة ({maxAllowedImages - images.length} متاح)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                      اكتمل الحد الأقصى ({maxAllowedImages} صور)
                    </span>
                  )}
                </div>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {images.map((src, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#D4CCBC]">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lightweight Video Link */}
              <div className="space-y-2 p-3 rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#132040]/60 border border-[#D4CCBC] dark:border-[#22355E]">
                <div className="flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-[#EA580C]" />
                  <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    رابط فيديو للخامة (اختياري — خفيف على قاعدة البيانات)
                  </span>
                </div>
                <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  يوتيوب، تيك توك، إنستجرام ريلز أو فيسبوك — يظهر كصورة مصغرة خفيفة ويفتح المشغل عند الضغط فقط.
                </p>
                <input
                  type="url"
                  dir="ltr"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... أو رابط ريلز / تيك توك"
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] text-xs font-mono text-right"
                />
                {isValidHttpVideoUrl(videoUrl) && (
                  <ProductVideoThumbnail
                    videoUrl={videoUrl}
                    fallbackImage={images[0]}
                    title={name || 'فيديو الخامة'}
                  />
                )}
              </div>

              {/* Store visibility toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStore}
                    onChange={(e) => setInStore(e.target.checked)}
                    className="accent-[#EA580C] w-4 h-4"
                  />
                  <span>عرض في متجري المباشر</span>
                </label>
                <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  يظهر في سوق الموردين فقط عند التصدير ومراجعة الأدمن
                </span>
              </div>

              <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveItemWithMode('store_only')}
                    className="px-4 py-2 rounded-xl bg-[#0C1427] hover:bg-[#1A2B54] text-amber-300 border border-[#22355E] font-black cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'جاري الحفظ...' : 'حفظ في الكتالوج والمتجر فقط'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveItemWithMode('market_submit')}
                    className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {saving
                        ? 'جاري الإرسال...'
                        : inMarket
                        ? 'حفظ وإعادة الإرسال لسوق الموردين'
                        : 'حفظ وتصدير لسوق الموردين'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offer & New Stock Alert Broadcaster Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <h2 className="text-sm font-black flex items-center gap-2 text-[#0C1427] dark:text-[#F7F3EA]">
                <Megaphone className="w-4 h-4 text-[#EA580C]" />
                <span>إرسال تنبيه عروض أو وصول خامات جديدة للورش</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAlertModalOpen(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendOfferAlert} className="p-4 sm:p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">نوع التنبيه</label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                >
                  <option value="offer">عرض وتخفيض خاص للورش</option>
                  <option value="new_stock">وصول خامات وألوان جديدة</option>
                  <option value="price_drop">تحديث وتخفيض أسعار الجملة</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">عنوان الإعلان *</label>
                  <input
                    type="text"
                    required
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    placeholder="مثال: وصول شحنة قطن مكرمية ألوان البوهو الجديدة"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">شارة العرض</label>
                  <input
                    type="text"
                    value={alertBadge}
                    onChange={(e) => setAlertBadge(e.target.value)}
                    placeholder="خصم 15%"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">تفاصيل العرض للورش *</label>
                <textarea
                  rows={3}
                  required
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  placeholder="اكتب التفاصيل والكميات وشرائح الأسعار الخاصة بالورش..."
                  className="w-full p-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAlertModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={alertSending}
                  className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black cursor-pointer disabled:opacity-50"
                >
                  {alertSending ? 'جاري النشر...' : 'نشر التنبيه للورش'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Materials System Smart Picker Modal (Supplier SKU + Brand) */}
      <UnifiedMaterialPickerModal
        isOpen={isUnifiedPickerOpen}
        onClose={() => setIsUnifiedPickerOpen(false)}
        mode="supplier"
        actorId={profile.id}
        actorName={profile.brandName || profile.artistName || 'مورد'}
        onConfirmSelection={handleUnifiedLinkForSupplier}
      />
    </div>
  );
};
