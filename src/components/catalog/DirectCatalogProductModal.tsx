import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Plus,
  ImagePlus,
  Link as LinkIcon,
  Video,
  Store,
  BookOpen,
  Sparkles,
  Trash2,
  Loader2,
  AlertCircle,
  Ruler,
  Palette,
  FileText,
  Layers,
  FolderPlus,
  Check,
} from 'lucide-react';
import type { SavedProductRecord, UserProfile, CraftCategory } from '../../types';
import {
  MAIN_SECTIONS,
  SUB_CRAFTS_REGISTRY,
  MainSectionId,
} from '../../registry/craftsRegistry';
import { tenantStorage } from '../../db/dexieDB';
import { markProductDirty } from '../../db/productSyncQueue';
import { flushProductSync } from '../../db/productsCloud';
import { publishProductToMarketplace } from '../../db/marketplaceCloud';
import { compressImageFile } from '../../utils/imageCompressor';
import { ProductMediaCarousel } from '../common/ProductMediaCarousel';
import { isValidHttpVideoUrl } from '../../lib/catalogStatus';
import { toEgpAmount } from '../../lib/currency';
import type { ProductDiscountConfig, ProductSizeVariant } from '../../types/artisanStoreBuilder';
import { getStoredArtisanStoreConfig } from '../../types/artisanStoreBuilder';
import {
  DEFAULT_PRODUCT_OFFER,
  ProductOfferEditorSection,
} from '../store/ProductOfferEditorSection';

interface DirectCatalogProductPageProps {
  isOpen?: boolean;
  onClose: () => void;
  profile: UserProfile;
  /** Default context: when opened from Storefront, highlight publish-to-store */
  defaultPublishToStore?: boolean;
  onSaved: (record: SavedProductRecord) => void;
  /** Optional callback to open global crafts/workshops selector */
  onOpenManageCrafts?: () => void;
}

const CUSTOM_CATS_KEY_PREFIX = 'alshams_custom_prod_categories_';

function loadCustomCategories(tenantId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(`${CUSTOM_CATS_KEY_PREFIX}${tenantId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomCategories(tenantId: string, map: Record<string, string[]>) {
  try {
    localStorage.setItem(`${CUSTOM_CATS_KEY_PREFIX}${tenantId}`, JSON.stringify(map));
  } catch {}
}

/**
 * Full-page inline Direct Product Builder (NOT a popup modal!).
 * Follows the exact structured workshop foundation:
 * 1) الورشة / القسم الرئيسي (Main Section)
 * 2) القسم الفرعي / الحرفة (Sub-Craft)
 * 3) التصنيف / نوع المنتج (Category — with ability to add custom categories/sections)
 * + Size-linked Pricing Variants + Colors + Manufacturing Notes + Store Description
 * + Unified Photos & Lightweight Video Link (last slide in carousel)
 * + Slim 3-color guidance legend strictly in the FOOTER.
 */
export const DirectCatalogProductPage: React.FC<DirectCatalogProductPageProps> = ({
  isOpen = true,
  onClose,
  profile,
  defaultPublishToStore = false,
  onSaved,
  onOpenManageCrafts,
}) => {
  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const currencyCode = profile.currency || 'EGP';
  const currencySymbol = profile.currencySymbol || 'ج.م';

  // Build ordered list of artisan's selected crafts first, with option to reveal all sections/crafts
  const [showAllPlatformSections, setShowAllPlatformSections] = useState(false);

  const selectedCraftIds = useMemo(() => {
    const raw = Array.isArray(profile.selectedCrafts) ? profile.selectedCrafts : [];
    return raw.length > 0 ? raw : ['macrame'];
  }, [profile.selectedCrafts]);

  const availableSections = useMemo(() => {
    if (showAllPlatformSections) return MAIN_SECTIONS;
    const sectionIds = new Set(
      SUB_CRAFTS_REGISTRY.filter((c) => selectedCraftIds.includes(c.id)).map(
        (c) => c.mainSectionId
      )
    );
    const matched = MAIN_SECTIONS.filter((s) => sectionIds.has(s.id));
    return matched.length > 0 ? matched : MAIN_SECTIONS;
  }, [selectedCraftIds, showAllPlatformSections]);

  const [selectedSectionId, setSelectedSectionId] = useState<MainSectionId>(
    availableSections[0]?.id || 'ropes_textiles'
  );

  // Crafts under the chosen Main Section
  const availableSubCrafts = useMemo(() => {
    const inSection = SUB_CRAFTS_REGISTRY.filter(
      (c) => c.mainSectionId === selectedSectionId
    );
    if (showAllPlatformSections) return inSection;
    const mine = inSection.filter((c) => selectedCraftIds.includes(c.id));
    return mine.length > 0 ? mine : inSection;
  }, [selectedSectionId, selectedCraftIds, showAllPlatformSections]);

  const [selectedCraftId, setSelectedCraftId] = useState<string>(
    availableSubCrafts[0]?.id || selectedCraftIds[0] || 'macrame'
  );

  // Keep selectedCraftId valid when Main Section changes
  useEffect(() => {
    if (
      availableSubCrafts.length > 0 &&
      !availableSubCrafts.some((c) => c.id === selectedCraftId)
    ) {
      setSelectedCraftId(availableSubCrafts[0].id);
    }
  }, [availableSubCrafts, selectedCraftId]);

  const activeSectionObj = MAIN_SECTIONS.find((s) => s.id === selectedSectionId);
  const activeCraftObj =
    SUB_CRAFTS_REGISTRY.find((c) => c.id === selectedCraftId) ||
    availableSubCrafts[0];

  // Custom categories per craft (allows artisan to add/edit new categories freely)
  const [customCategoriesMap, setCustomCategoriesMap] = useState<Record<string, string[]>>(() =>
    loadCustomCategories(tenantId)
  );
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const availableCategories = useMemo(() => {
    const base = activeCraftObj?.sampleCategories || [];
    const custom = customCategoriesMap[selectedCraftId] || [];
    return Array.from(new Set([...base, ...custom]));
  }, [activeCraftObj, customCategoriesMap, selectedCraftId]);

  const [categoryLabel, setCategoryLabel] = useState<string>(
    availableCategories[0] || 'مشغولة يدوية'
  );

  useEffect(() => {
    if (
      availableCategories.length > 0 &&
      !availableCategories.includes(categoryLabel)
    ) {
      setCategoryLabel(availableCategories[0]);
    }
  }, [selectedCraftId, availableCategories.join('|')]);

  const handleAddCustomCategory = () => {
    const clean = newCategoryInput.trim();
    if (!clean) return;
    const prevList = customCategoriesMap[selectedCraftId] || [];
    const updatedMap = {
      ...customCategoriesMap,
      [selectedCraftId]: Array.from(new Set([...prevList, clean])),
    };
    setCustomCategoriesMap(updatedMap);
    saveCustomCategories(tenantId, updatedMap);
    setCategoryLabel(clean);
    setNewCategoryInput('');
    setIsAddingCategory(false);
  };

  // Core product details
  const [productName, setProductName] = useState('');
  const [storePrice, setStorePrice] = useState<string>('');
  const [wholesalePrice, setWholesalePrice] = useState<string>('');
  const [currentStock, setCurrentStock] = useState<string>('1');
  const [storeDescription, setStoreDescription] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [isCustomOrderAvailable, setIsCustomOrderAvailable] = useState(true);
  const [productDiscount, setProductDiscount] = useState<ProductDiscountConfig>({
    ...DEFAULT_PRODUCT_OFFER,
  });
  const availableStoreCouponCodes = useMemo(() => {
    const cfg = getStoredArtisanStoreConfig(tenantId);
    return (cfg.coupons || []).filter((c) => c.active && c.code).map((c) => c.code);
  }, [tenantId]);

  // Sizes linked to Prices (المقاسات المرتبطة بالأسعار)
  const [sizeVariants, setSizeVariants] = useState<ProductSizeVariant[]>([]);
  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('');

  const handleAddSizeVariant = () => {
    const lbl = newSizeLabel.trim();
    const pr = Number(newSizePrice || storePrice || 0);
    if (!lbl) return;
    if (!Number.isFinite(pr) || pr <= 0) {
      setErrorMsg('أدخل سعراً صحيحاً للمقاس (أو أدخل السعر الأساسي للمنتج أولاً).');
      return;
    }
    setErrorMsg(null);
    setSizeVariants((prev) => [
      ...prev,
      {
        id: `sz_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        label: lbl,
        price: pr,
        egpPrice: toEgpAmount(pr, currencyCode),
      },
    ]);
    // If base storePrice wasn't entered yet, inherit from first size variant
    if (!Number(storePrice)) {
      setStorePrice(String(pr));
    }
    setNewSizeLabel('');
    setNewSizePrice('');
  };

  // Colors (الألوان المتاحة)
  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');

  const handleAddColor = () => {
    const clean = colorInput.trim();
    if (!clean || colors.includes(clean)) return;
    setColors((prev) => [...prev, clean]);
    setColorInput('');
  };

  // Media: Images + Lightweight Video Link (shown as last slide in unified preview)
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, 6 - images.length));
    if (files.length === 0) return;
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const compressed = await Promise.all(
        files.map((f) =>
          compressImageFile(f, {
            maxWidth: 900,
            maxHeight: 900,
            targetMaxKb: 110,
            initialQuality: 0.8,
          })
        )
      );
      setImages((prev) => [...prev, ...compressed].slice(0, 6));
    } catch {
      setErrorMsg('تعذر قراءة الصورة، جرب صورة أخرى أو رابط مباشر.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    const clean = imageUrlInput.trim();
    if (!clean) return;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      setErrorMsg('يرجى إدخال رابط صورة يبدأ بـ https://');
      return;
    }
    setImages((prev) => [...prev, clean].slice(0, 6));
    setImageUrlInput('');
    setErrorMsg(null);
  };

  const handleSave = async (publishToStore: boolean) => {
    const cleanName = productName.trim();
    const numericPrice =
      Number(storePrice || 0) ||
      (sizeVariants.length > 0 ? Number(sizeVariants[0].price || 0) : 0);
    const numericWholesale = Number(wholesalePrice || 0);
    const cleanVideo = videoUrl.trim();

    if (!selectedSectionId || !selectedCraftId) {
      setErrorMsg('يرجى اختيار القسم الرئيسي والقسم الفرعي (الورشة) أولاً.');
      return;
    }
    if (!cleanName) {
      setErrorMsg('يرجى كتابة اسم المنتج أولاً.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setErrorMsg('يرجى إدخال سعر بيع صحيح (أو إضافة مقاس بسعره).');
      return;
    }
    if (cleanVideo && !isValidHttpVideoUrl(cleanVideo)) {
      setErrorMsg('رابط الفيديو غير صالح — تأكد أنه يبدأ بـ https://');
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      const serialNum = await tenantStorage.getNextProductSerialNumber(tenantId);
      const productCode = `PRD-${String(serialNum).padStart(4, '0')}`;
      const recordId = `prod_dir_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const mainImage = images[0] || '';
      const additionalGallery = images.slice(1);
      const safeCategory = (categoryLabel.trim() ||
        activeCraftObj?.sampleCategories?.[0] ||
        'جدارية') as CraftCategory;

      const normalizedVariants: ProductSizeVariant[] = sizeVariants
        .filter((v) => v.label.trim() && Number(v.price) > 0)
        .map((v) => ({
          ...v,
          label: v.label.trim(),
          price: Number(v.price),
          egpPrice: toEgpAmount(Number(v.price), currencyCode),
        }));

      const combinedNotes = personalNotes.trim() || storeDescription.trim();

      const record: SavedProductRecord = {
        id: recordId,
        tenantId,
        workshopId: tenantId,
        productName: cleanName,
        productSerialNumber: serialNum,
        productCode,
        mainSectionId: selectedSectionId,
        mainSectionName: activeSectionObj?.nameAr || selectedSectionId,
        craftId: selectedCraftId,
        craftName: activeCraftObj?.nameAr || selectedCraftId,
        productType: safeCategory,
        category: safeCategory,
        costPrice: 0,
        retailPrice: numericPrice,
        wholesalePrice:
          numericWholesale > 0 ? numericWholesale : Math.round(numericPrice * 0.8),
        wholesaleMarginDiscountPercent: 20,
        input: {
          category: safeCategory,
          productName: cleanName,
          shape3D: 'flat',
          widthCm: 0,
          diameterCm: 0,
          baseDiameterCm: 0,
          sideHeightCm: 0,
          totalLengthCm: 0,
          fringeLengthCm: 0,
          cordTypeId: 'cotton_braided',
          cordThicknessMm: 0,
          pricePerKg: 0,
          curtainRodCost: 0,
          cushionCoverCost: 0,
          fiberCost: 0,
          bagAccessoriesCost: 0,
          extraMaterials: [],
          laborWage: 0,
          packagingCost: 0,
          transitFees: 0,
          adminExpensesShare: 0,
          profitMarginPercent: 0,
          craftId: selectedCraftId,
          mainSectionId: selectedSectionId,
          personalNotes: combinedNotes,
          productImageUrl: mainImage,
        },
        output: {
          baseStrandsCount: 0,
          workingCordsCount: 0,
          singleStrandLengthCm: 0,
          totalYarnLengthMeters: 0,
          totalWeightKg: 0,
          totalWeightGrams: 0,
          yarnCost: 0,
          extraMaterialsTotalCost: 0,
          totalDirectMaterialsCost: 0,
          insulatedProfitAmount: 0,
          laborWage: 0,
          packagingCost: 0,
          transitFees: 0,
          adminExpensesShare: 0,
          finalSellingPrice: numericPrice,
          isOverridden: {
            strands: false,
            strandLength: false,
            weight: false,
          },
        },
        imageUrl: mainImage,
        galleryUrls: additionalGallery,
        videoUrl: cleanVideo || undefined,
        storeDescription: storeDescription.trim(),
        storePrice: numericPrice,
        availableColors: colors,
        sizeVariants: normalizedVariants,
        availableSizes: normalizedVariants.map((v) => v.label),
        isCatalogVisible: true,
        inStore: publishToStore,
        isPublishedInStore: publishToStore,
        inMarket: false,
        marketStatus: 'none',
        directCatalogEntry: true,
        isCosted: false,
        currentStock: Math.max(0, Number(currentStock || 0)),
        isCustomOrderAvailable,
        sourceCurrency: currencyCode,
        productDiscount:
          productDiscount.enabled || productDiscount.isBestSeller ? productDiscount : undefined,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await tenantStorage.mutateProduct(record);
      window.dispatchEvent(new CustomEvent('alshams_products_changed'));

      if (tenantId) {
        markProductDirty(tenantId, record.id);
        flushProductSync(tenantId).catch(() => {});
      }

      if (publishToStore) {
        await publishProductToMarketplace(record, profile).catch(() => {});
      }

      onSaved(record);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ المنتج، حاول مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="w-full rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-sm overflow-hidden text-right"
      dir="rtl"
    >
      {/* Clean Page Top Bar (Full Inline Page — NOT a popup modal) */}
      <div className="px-4 sm:px-6 py-4 border-b border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/75 dark:bg-[#0A1124] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer shrink-0 transition"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2 truncate">
              <Sparkles className="w-4 h-4 text-[#EA580C] shrink-0" />
              <span>إضافة منتج مباشر</span>
            </h2>
            <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] truncate">
              تأسيس كامل للمنتج بالورشة والقسم والتصنيف والمقاسات والصور والفيديو
            </p>
          </div>
        </div>
      </div>

      {/* Main Structured Form Body */}
      <div className="p-4 sm:p-6 space-y-5">
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/12 border border-rose-500/35 text-rose-700 dark:text-rose-300 text-xs font-black flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Structured Workshop / Section / Sub-Craft / Category Foundation */}
        <section className="p-4 rounded-2xl bg-white/80 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>١. أساس المنتج (الورشة ← القسم الرئيسي ← القسم الفرعي ← التصنيف)</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllPlatformSections((v) => !v)}
                className="px-2.5 py-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer transition"
              >
                {showAllPlatformSections ? 'أقسام ورشتي فقط' : '+ عرض كل أقسام المنظومة'}
              </button>
              {onOpenManageCrafts && (
                <button
                  type="button"
                  onClick={onOpenManageCrafts}
                  className="px-2.5 py-1 rounded-xl bg-[#EA580C]/12 border border-[#EA580C]/35 text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24] cursor-pointer"
                >
                  إدارة ورشي
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. القسم الرئيسي */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                القسم الرئيسي (الورشة) *
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value as MainSectionId)}
                className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              >
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. القسم الفرعي / الحرفة */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                القسم الفرعي (الحرفة) *
              </label>
              <select
                value={selectedCraftId}
                onChange={(e) => setSelectedCraftId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              >
                {availableSubCrafts.map((craft) => (
                  <option key={craft.id} value={craft.id}>
                    {craft.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. التصنيف / نوع المنتج مع إمكانية إضافة تصنيف جديد */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  التصنيف (نوع المنتج) *
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory((v) => !v)}
                  className="text-[11px] font-black text-[#EA580C] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{isAddingCategory ? 'إغلاق' : '+ تصنيف جديد'}</span>
                </button>
              </div>
              {isAddingCategory ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCategory();
                      }
                    }}
                    placeholder="اكتب اسم التصنيف الجديد..."
                    className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-[#0D162E] border border-[#EA580C] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="h-10 px-3 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ</span>
                  </button>
                </div>
              ) : (
                <select
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* STEP 2: Name, Pricing & Stock */}
        <section className="p-4 rounded-2xl bg-white/80 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E] space-y-4">
          <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            ٢. اسم المنتج والتسعير الأساسي
          </h3>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
              اسم المنتج *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="مثال: جدارية مكرمية بوهيمية بالخرز الخشبي"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                السعر القطاعي / بالمتجر ({currencySymbol}) *
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={storePrice}
                onChange={(e) => setStorePrice(e.target.value)}
                placeholder="مثال: 450"
                className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-mono font-black text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                سعر الجملة (اختياري)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                placeholder="تلقائي 80%"
                className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-mono font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                الكمية المتاحة (0 = تنفيذ بالطلب)
              </label>
              <input
                type="number"
                min={0}
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-mono font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>
          </div>
        </section>

        {/* STEP 3: Sizes Linked to Prices + Colors */}
        <section className="p-4 rounded-2xl bg-white/80 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
              <Ruler className="w-4 h-4" />
              <span>٣. المقاسات المرتبطة بالأسعار والألوان (اختياري)</span>
            </h3>
            <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
              كل مقاس بسعره المستقل
            </span>
          </div>

          {sizeVariants.length > 0 && (
            <div className="space-y-2">
              {sizeVariants.map((sv) => (
                <div
                  key={sv.id}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]"
                >
                  <input
                    type="text"
                    value={sv.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSizeVariants((prev) =>
                        prev.map((row) => (row.id === sv.id ? { ...row, label: val } : row))
                      );
                    }}
                    className="flex-1 min-w-[140px] h-9 px-2.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={sv.price}
                      onChange={(e) => {
                        const val = Number(e.target.value || 0);
                        setSizeVariants((prev) =>
                          prev.map((row) =>
                            row.id === sv.id
                              ? { ...row, price: val, egpPrice: toEgpAmount(val, currencyCode) }
                              : row
                          )
                        );
                      }}
                      className="w-28 h-9 px-2.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black"
                    />
                    <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      {currencySymbol}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSizeVariants((prev) => prev.filter((row) => row.id !== sv.id))
                    }
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                    title="حذف المقاس"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <input
              type="text"
              value={newSizeLabel}
              onChange={(e) => setNewSizeLabel(e.target.value)}
              placeholder="اسم المقاس (مثال: وسط 60×90 سم)"
              className="flex-1 min-w-[160px] h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
            />
            <input
              type="number"
              min={0}
              step="any"
              value={newSizePrice}
              onChange={(e) => setNewSizePrice(e.target.value)}
              placeholder={`سعر المقاس (${currencySymbol})`}
              className="w-36 h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold outline-none focus:border-[#EA580C]"
            />
            <button
              type="button"
              onClick={handleAddSizeVariant}
              className="h-10 px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مقاس</span>
            </button>
          </div>

          {/* Colors row */}
          <div className="pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E] space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
              <Palette className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>الألوان المتاحة (اختياري)</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddColor();
                  }
                }}
                placeholder="مثال: أوف وايت، جملي، زيتي..."
                className="flex-1 h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none"
              />
              <button
                type="button"
                onClick={handleAddColor}
                className="h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer"
              >
                + إضافة لون
              </button>
            </div>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => setColors((prev) => prev.filter((x) => x !== c))}
                      className="text-rose-600 font-black cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* STEP 3.5: Product Offers, Discounts, Before/After Price, BOGO & Best-Seller Highlights */}
        <ProductOfferEditorSection
          value={productDiscount}
          onChange={setProductDiscount}
          basePrice={Number(storePrice || 0) || Number(sizeVariants[0]?.price || 0)}
          currencySymbol={currencySymbol}
          availableCouponCodes={availableStoreCouponCodes}
          sectionTitle="عروض وخصومات وتمييز المنتج داخل المتجر (قبل/بعد · اشتري X+Y · لفترة محدودة)"
        />

        {/* STEP 4: Media (Photos + Lightweight Video Link in Unified Carousel) */}
        <section className="p-4 rounded-2xl bg-white/80 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E] space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                ٤. صور المنتج ورابط الفيديو ({images.length} / 6 صور)
              </h3>
              <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                عند العميل: تظهر الصور متتالية ثم الفيديو كآخر شريحة في نفس المعرض ويشتغل عند الضغط فقط
              </p>
            </div>
            {images.length < 6 && (
              <label className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition">
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                <span>رفع صور</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-3">
              {images.length < 6 && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="w-3.5 h-3.5 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="أو الصق رابط صورة مباشر (https://...)"
                      className="w-full h-9 pr-8 pl-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="px-3 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              )}

              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#D4CCBC] dark:border-[#22355E]"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[9px] font-black text-center py-0.5">
                          أساسية
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                <label className="flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  <Video className="w-4 h-4 text-[#EA580C]" />
                  <span>رابط فيديو للمنتج (اختياري)</span>
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... أو ريلز / تيك توك"
                  className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono text-right outline-none focus:border-[#EA580C]"
                />
              </div>
            </div>

            {/* Live Unified Customer Preview (Photos + Video as Last Slide) */}
            {(images.length > 0 || isValidHttpVideoUrl(videoUrl)) && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                  معاينة عرض الصور والفيديو كما يراها العميل (قلّب الصور والفيديو في الآخر):
                </span>
                <div className="max-w-xs mx-auto lg:mx-0">
                  <ProductMediaCarousel
                    images={images}
                    videoUrl={videoUrl}
                    title={productName || 'معاينة المنتج'}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* STEP 5: Customer Description + Artisan Manufacturing Notes */}
        <section className="p-4 rounded-2xl bg-white/80 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
          <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#EA580C]" />
            <span>٥. الوصف والملاحظات</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                وصف المنتج للعملاء (يظهر بالمتجر)
              </label>
              <textarea
                rows={3}
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                placeholder="اكتب مميزات القطعة، الخامة، وطريقة العناية..."
                className="w-full p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                ملاحظات داخلية للورشة (تنتقل مع المنتج لحاسبة التكاليف)
              </label>
              <textarea
                rows={3}
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                placeholder="مثال: نوع الخيط المستخدم، وقت التنفيذ التقريبي، ملاحظات التشطيب..."
                className="w-full p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C] resize-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isCustomOrderAvailable}
              onChange={(e) => setIsCustomOrderAvailable(e.target.checked)}
              className="w-4 h-4 accent-[#EA580C]"
            />
            <span>متاح للتنفيذ الخاص بألوان ومقاسات حسب طلب العميل</span>
          </label>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className={`px-5 py-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
              !defaultPublishToStore
                ? 'bg-rose-600/12 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-600/20'
                : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-rose-500/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>حفظ بالكتالوج فقط</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(true)}
            className="px-6 py-3 rounded-2xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Store className="w-4 h-4" />
            )}
            <span>حفظ وعرض بمتجري فوراً</span>
          </button>
        </div>
      </div>

      {/* Slim Guidance Legend strictly in the FOOTER (التذييل) */}
      <footer className="px-4 sm:px-6 py-2.5 border-t border-[#D4CCBC]/80 dark:border-[#22355E] bg-[#EFE9DC]/55 dark:bg-[#0A1124]/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
        <span>دليل ألوان الكتالوج:</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>أحمر: بالكتالوج فقط</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>أصفر: بالمتجر بدون تكلفة (اضغط لحساب التكلفة)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>أخضر: مكتمل (مسعّر وبالمتجر)</span>
          </span>
        </div>
      </footer>
    </div>
  );
};

// Keep named alias for any existing import
export const DirectCatalogProductModal = DirectCatalogProductPage;
