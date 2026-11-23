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
  Globe,
  ChevronDown,
  ChevronUp,
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
import {
  PUBLIC_LANGUAGES,
  PublicLocaleCode,
  translateFieldsWithAI,
  localizeSizeLabel,
  localizeColorLabel,
} from '../../lib/publicLocale';

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

  // Multilingual product state: Arabic + English are paired directly per field;
  // bottom section ONLY renders extra enabled languages (e.g., nl, tr, fr, de, es, it).
  const [extraEnabledLanguages, setExtraEnabledLanguages] = useState<PublicLocaleCode[]>(() => {
    const cfg = getStoredArtisanStoreConfig(tenantId);
    const storeLangs = Array.isArray(cfg.enabledLanguages) ? cfg.enabledLanguages : [];
    const profileLangs = Array.isArray((profile as any)?.enabledLanguages)
      ? ((profile as any).enabledLanguages as PublicLocaleCode[])
      : [];
    const merged = Array.from(new Set([...storeLangs, ...profileLangs]));
    return merged.filter((l) => l !== 'ar' && l !== 'en');
  });

  const [enName, setEnName] = useState('');
  const [enDescription, setEnDescription] = useState('');
  const [colorTranslations, setColorTranslations] = useState<
    Record<string, Partial<Record<PublicLocaleCode, string>>>
  >({});

  // Extra-language translations (ONLY for languages beyond 'ar' and 'en')
  const [extraTranslations, setExtraTranslations] = useState<
    Partial<Record<PublicLocaleCode, { name?: string; description?: string }>>
  >({});
  const [activeExtraLang, setActiveExtraLang] = useState<PublicLocaleCode | null>(null);
  const [showExtraLangsPanel, setShowExtraLangsPanel] = useState(false);

  // Per-field live translation loaders + subtle success feedback
  const [translatingField, setTranslatingField] = useState<
    null | 'name' | 'description' | 'sizes' | 'colors' | 'extra'
  >(null);
  const [translateNotice, setTranslateNotice] = useState<string | null>(null);

  useEffect(() => {
    if (extraEnabledLanguages.length > 0 && (!activeExtraLang || !extraEnabledLanguages.includes(activeExtraLang))) {
      setActiveExtraLang(extraEnabledLanguages[0]);
    }
  }, [extraEnabledLanguages, activeExtraLang]);

  const showTempNotice = (msg: string) => {
    setTranslateNotice(msg);
    setTimeout(() => {
      setTranslateNotice((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  // Sizes linked to Prices (المقاسات المرتبطة بالأسعار)
  const [sizeVariants, setSizeVariants] = useState<ProductSizeVariant[]>([]);
  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizeLabelEn, setNewSizeLabelEn] = useState('');
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
    const autoEn = newSizeLabelEn.trim() || localizeSizeLabel(lbl, 'en');
    const finalEn = autoEn && autoEn !== lbl ? autoEn : newSizeLabelEn.trim();
    setSizeVariants((prev) => [
      ...prev,
      {
        id: `sz_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        label: lbl,
        labelEn: finalEn || undefined,
        translations: finalEn ? { en: finalEn } : undefined,
        price: pr,
        egpPrice: toEgpAmount(pr, currencyCode),
      },
    ]);
    // If base storePrice wasn't entered yet, inherit from first size variant
    if (!Number(storePrice)) {
      setStorePrice(String(pr));
    }
    setNewSizeLabel('');
    setNewSizeLabelEn('');
    setNewSizePrice('');
  };

  // Colors (الألوان المتاحة)
  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');
  const [colorInputEn, setColorInputEn] = useState('');

  const handleAddColor = () => {
    const clean = colorInput.trim();
    if (!clean || colors.includes(clean)) return;
    setColors((prev) => [...prev, clean]);
    const autoEn = colorInputEn.trim() || localizeColorLabel(clean, 'en');
    if (autoEn && autoEn !== clean) {
      setColorTranslations((prev) => ({
        ...prev,
        [clean]: { ...(prev[clean] || {}), en: autoEn },
      }));
    } else if (colorInputEn.trim()) {
      setColorTranslations((prev) => ({
        ...prev,
        [clean]: { ...(prev[clean] || {}), en: colorInputEn.trim() },
      }));
    }
    setColorInput('');
    setColorInputEn('');
  };

  // Translate product name directly into English
  const handleTranslateNameEn = async () => {
    const src = productName.trim();
    if (!src) {
      setErrorMsg('اكتب اسم المنتج بالعربية أولاً ليتم ترجمته للإنجليزية.');
      return;
    }
    setErrorMsg(null);
    setTranslatingField('name');
    try {
      const res = await translateFieldsWithAI({ name: src }, 'en', 'ar');
      if (res.success && res.translations?.name) {
        setEnName(res.translations.name);
        showTempNotice('تمت ترجمة اسم المنتج للإنجليزية ✨');
      } else {
        setErrorMsg(res.error || 'تعذرت الترجمة التلقائية حالياً، يمكنك الكتابة يدوياً.');
      }
    } finally {
      setTranslatingField(null);
    }
  };

  // Translate product description directly into English
  const handleTranslateDescriptionEn = async () => {
    const src = storeDescription.trim();
    if (!src) {
      setErrorMsg('اكتب وصف المنتج بالعربية أولاً ليتم ترجمته للإنجليزية.');
      return;
    }
    setErrorMsg(null);
    setTranslatingField('description');
    try {
      const res = await translateFieldsWithAI({ description: src }, 'en', 'ar');
      if (res.success && res.translations?.description) {
        setEnDescription(res.translations.description);
        showTempNotice('تمت ترجمة وصف المنتج للإنجليزية ✨');
      } else {
        setErrorMsg(res.error || 'تعذرت الترجمة التلقائية حالياً، يمكنك الكتابة يدوياً.');
      }
    } finally {
      setTranslatingField(null);
    }
  };

  // Translate all added size variants + draft size into English
  const handleTranslateSizesEn = async () => {
    const payload: Record<string, string> = {};
    if (newSizeLabel.trim()) payload.__draft = newSizeLabel.trim();
    sizeVariants.forEach((sv) => {
      if (sv.label.trim()) payload[sv.id] = sv.label.trim();
    });
    if (Object.keys(payload).length === 0) return;

    setErrorMsg(null);
    setTranslatingField('sizes');
    try {
      const res = await translateFieldsWithAI(payload, 'en', 'ar');
      if (res.success && res.translations) {
        if (res.translations.__draft) setNewSizeLabelEn(res.translations.__draft);
        setSizeVariants((prev) =>
          prev.map((sv) => {
            const tr = res.translations?.[sv.id];
            if (!tr) return sv;
            return {
              ...sv,
              labelEn: tr,
              translations: { ...(sv.translations || {}), en: tr },
            };
          })
        );
        showTempNotice('تمت ترجمة المقاسات للإنجليزية ✨');
      } else {
        // Smart dictionary fallback for sizes
        if (newSizeLabel.trim()) setNewSizeLabelEn(localizeSizeLabel(newSizeLabel.trim(), 'en'));
        setSizeVariants((prev) =>
          prev.map((sv) => {
            const localTr = localizeSizeLabel(sv.label, 'en');
            return {
              ...sv,
              labelEn: localTr,
              translations: { ...(sv.translations || {}), en: localTr },
            };
          })
        );
      }
    } finally {
      setTranslatingField(null);
    }
  };

  // Translate all added colors + draft color into English
  const handleTranslateColorsEn = async () => {
    const payload: Record<string, string> = {};
    if (colorInput.trim()) payload.__draft = colorInput.trim();
    colors.forEach((c, idx) => {
      payload[`c_${idx}`] = c;
    });
    if (Object.keys(payload).length === 0) return;

    setErrorMsg(null);
    setTranslatingField('colors');
    try {
      const res = await translateFieldsWithAI(payload, 'en', 'ar');
      if (res.success && res.translations) {
        if (res.translations.__draft) setColorInputEn(res.translations.__draft);
        setColorTranslations((prev) => {
          const next = { ...prev };
          colors.forEach((c, idx) => {
            const tr = res.translations?.[`c_${idx}`];
            if (tr) next[c] = { ...(next[c] || {}), en: tr };
          });
          return next;
        });
        showTempNotice('تمت ترجمة الألوان للإنجليزية ✨');
      } else {
        if (colorInput.trim()) setColorInputEn(localizeColorLabel(colorInput.trim(), 'en'));
        setColorTranslations((prev) => {
          const next = { ...prev };
          colors.forEach((c) => {
            next[c] = { ...(next[c] || {}), en: localizeColorLabel(c, 'en') };
          });
          return next;
        });
      }
    } finally {
      setTranslatingField(null);
    }
  };

  // Translate ALL product fields (Name, Description, Sizes, Colors) into an extra enabled language (e.g. nl, tr, fr)
  const handleTranslateExtraLanguage = async (targetLang: PublicLocaleCode) => {
    const payload: Record<string, string> = {};
    if (productName.trim()) payload.name = productName.trim();
    if (storeDescription.trim()) payload.description = storeDescription.trim();
    sizeVariants.forEach((sv) => {
      if (sv.label.trim()) payload[`sz__${sv.id}`] = sv.label.trim();
    });
    colors.forEach((c, idx) => {
      payload[`cl__${idx}`] = c;
    });

    if (Object.keys(payload).length === 0) {
      setErrorMsg('اكتب اسم المنتج أو وصفه بالعربية أولاً قبل الترجمة.');
      return;
    }

    setErrorMsg(null);
    setTranslatingField('extra');
    try {
      const res = await translateFieldsWithAI(payload, targetLang, 'ar');
      if (res.success && res.translations) {
        const tr = res.translations;
        setExtraTranslations((prev) => ({
          ...prev,
          [targetLang]: {
            ...(prev[targetLang] || {}),
            ...(tr.name ? { name: tr.name } : {}),
            ...(tr.description ? { description: tr.description } : {}),
          },
        }));
        if (sizeVariants.length > 0) {
          setSizeVariants((prev) =>
            prev.map((sv) => {
              const sVal = tr[`sz__${sv.id}`];
              if (!sVal) return sv;
              return {
                ...sv,
                translations: { ...(sv.translations || {}), [targetLang]: sVal },
              };
            })
          );
        }
        if (colors.length > 0) {
          setColorTranslations((prev) => {
            const next = { ...prev };
            colors.forEach((c, idx) => {
              const cVal = tr[`cl__${idx}`];
              if (cVal) next[c] = { ...(next[c] || {}), [targetLang]: cVal };
            });
            return next;
          });
        }
        const meta = PUBLIC_LANGUAGES.find((l) => l.code === targetLang);
        showTempNotice(`تمت ترجمة جميع حقول المنتج إلى ${meta?.nameAr || targetLang} بنجاح ✨`);
      } else {
        setErrorMsg(res.error || 'تعذرت الترجمة التلقائية حالياً، يمكنك الكتابة يدوياً.');
      }
    } finally {
      setTranslatingField(null);
    }
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
        translations: (() => {
          const cleaned: Record<
            string,
            {
              name?: string;
              description?: string;
              sizes?: Record<string, string>;
              colors?: Record<string, string>;
            }
          > = {};

          const allTargetLangs: PublicLocaleCode[] = Array.from(
            new Set(['en' as PublicLocaleCode, ...extraEnabledLanguages])
          );

          for (const langCode of allTargetLangs) {
            const n =
              langCode === 'en'
                ? enName.trim()
                : (extraTranslations[langCode]?.name || '').trim();
            const d =
              langCode === 'en'
                ? enDescription.trim()
                : (extraTranslations[langCode]?.description || '').trim();

            const sizesMap: Record<string, string> = {};
            normalizedVariants.forEach((sv) => {
              const sTr =
                langCode === 'en'
                  ? (sv.labelEn || sv.translations?.en || '').trim()
                  : (sv.translations?.[langCode] || '').trim();
              if (sTr) sizesMap[sv.label] = sTr;
            });

            const colorsMap: Record<string, string> = {};
            colors.forEach((c) => {
              const cTr = (colorTranslations[c]?.[langCode] || '').trim();
              if (cTr) colorsMap[c] = cTr;
            });

            if (
              n ||
              d ||
              Object.keys(sizesMap).length > 0 ||
              Object.keys(colorsMap).length > 0
            ) {
              cleaned[langCode] = {
                ...(n ? { name: n } : {}),
                ...(d ? { description: d } : {}),
                ...(Object.keys(sizesMap).length > 0 ? { sizes: sizesMap } : {}),
                ...(Object.keys(colorsMap).length > 0 ? { colors: colorsMap } : {}),
              };
            }
          }

          return Object.keys(cleaned).length > 0 ? cleaned : undefined;
        })(),
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
        {translateNotice && (
          <div className="p-3 rounded-2xl bg-emerald-500/12 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{translateNotice}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                اسم المنتج (بالعربية) *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="مثال: جدارية مكرمية بوهيمية بالخرز الخشبي"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                  <Globe className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>اسم المنتج بالإنجليزية (اختياري)</span>
                </label>
                <button
                  type="button"
                  disabled={translatingField !== null || !productName.trim()}
                  onClick={handleTranslateNameEn}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EA580C]/12 hover:bg-[#EA580C]/20 border border-[#EA580C]/35 text-[10px] font-black text-[#C2410C] dark:text-[#FBBF24] disabled:opacity-45 cursor-pointer transition"
                >
                  {translatingField === 'name' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{translatingField === 'name' ? 'جاري الترجمة...' : 'ترجمة تلقائية EN'}</span>
                </button>
              </div>
              <input
                type="text"
                dir="ltr"
                value={enName}
                onChange={(e) => setEnName(e.target.value)}
                placeholder="e.g., Boho Macrame Wall Hanging with Wooden Beads"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>
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

        {/* STEP 3: Sizes Linked to Prices + Colors (with direct Arabic + English pairing) */}
        <section className="p-4 rounded-2xl bg-white/80 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
              <Ruler className="w-4 h-4" />
              <span>٣. المقاسات المرتبطة بالأسعار والألوان (اختياري)</span>
            </h3>
            <div className="flex items-center gap-2">
              {(sizeVariants.length > 0 || newSizeLabel.trim()) && (
                <button
                  type="button"
                  disabled={translatingField !== null}
                  onClick={handleTranslateSizesEn}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EA580C]/12 hover:bg-[#EA580C]/20 border border-[#EA580C]/35 text-[10px] font-black text-[#C2410C] dark:text-[#FBBF24] disabled:opacity-45 cursor-pointer transition"
                >
                  {translatingField === 'sizes' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{translatingField === 'sizes' ? 'جاري الترجمة...' : 'ترجمة المقاسات EN'}</span>
                </button>
              )}
              <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                كل مقاس بسعره المستقل
              </span>
            </div>
          </div>

          {sizeVariants.length > 0 && (
            <div className="space-y-2">
              {sizeVariants.map((sv) => (
                <div
                  key={sv.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] items-center gap-2 p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]"
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
                    placeholder="المقاس بالعربية"
                    className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={sv.labelEn || sv.translations?.en || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSizeVariants((prev) =>
                        prev.map((row) =>
                          row.id === sv.id
                            ? {
                                ...row,
                                labelEn: val,
                                translations: { ...(row.translations || {}), en: val },
                              }
                            : row
                        )
                      );
                    }}
                    placeholder="Size in English (e.g. Medium 60×90 cm)"
                    className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
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
                      className="w-24 h-9 px-2.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black"
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
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer justify-self-end"
                    title="حذف المقاس"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
            <input
              type="text"
              value={newSizeLabel}
              onChange={(e) => {
                const v = e.target.value;
                setNewSizeLabel(v);
                const auto = localizeSizeLabel(v, 'en');
                if (auto && auto !== v) setNewSizeLabelEn(auto);
              }}
              placeholder="المقاس بالعربية (مثال: وسط 60×90 سم)"
              className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
            />
            <input
              type="text"
              dir="ltr"
              value={newSizeLabelEn}
              onChange={(e) => setNewSizeLabelEn(e.target.value)}
              placeholder="Size in English (e.g. Medium 60×90 cm)"
              className="w-full h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
            />
            <input
              type="number"
              min={0}
              step="any"
              value={newSizePrice}
              onChange={(e) => setNewSizePrice(e.target.value)}
              placeholder={`السعر (${currencySymbol})`}
              className="w-full sm:w-28 h-10 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold outline-none focus:border-[#EA580C]"
            />
            <button
              type="button"
              onClick={handleAddSizeVariant}
              className="h-10 px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center justify-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مقاس</span>
            </button>
          </div>

          {/* Colors row (paired Arabic + English) */}
          <div className="pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                <Palette className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>الألوان المتاحة (اختياري)</span>
              </div>
              {(colors.length > 0 || colorInput.trim()) && (
                <button
                  type="button"
                  disabled={translatingField !== null}
                  onClick={handleTranslateColorsEn}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EA580C]/12 hover:bg-[#EA580C]/20 border border-[#EA580C]/35 text-[10px] font-black text-[#C2410C] dark:text-[#FBBF24] disabled:opacity-45 cursor-pointer transition"
                >
                  {translatingField === 'colors' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{translatingField === 'colors' ? 'جاري الترجمة...' : 'ترجمة الألوان EN'}</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input
                type="text"
                value={colorInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setColorInput(v);
                  const auto = localizeColorLabel(v, 'en');
                  if (auto && auto !== v) setColorInputEn(auto);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddColor();
                  }
                }}
                placeholder="اللون بالعربية (مثال: أوف وايت، جملي، زيتي)"
                className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
              />
              <input
                type="text"
                dir="ltr"
                value={colorInputEn}
                onChange={(e) => setColorInputEn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddColor();
                  }
                }}
                placeholder="Color in English (e.g. Off-White, Camel)"
                className="w-full h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
              />
              <button
                type="button"
                onClick={handleAddColor}
                className="h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer shrink-0"
              >
                + إضافة لون
              </button>
            </div>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => {
                  const cEn = colorTranslations[c]?.en || '';
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    >
                      <span>{c}</span>
                      {cEn && (
                        <span className="text-[10px] font-bold text-[#EA580C] dark:text-[#FBBF24]" dir="ltr">
                          ({cEn})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setColors((prev) => prev.filter((x) => x !== c));
                          setColorTranslations((prev) => {
                            const next = { ...prev };
                            delete next[c];
                            return next;
                          });
                        }}
                        className="text-rose-600 font-black cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
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

        {/* STEP 5: Customer Description (Arabic + English paired) + Internal Workshop Notes + Extra Languages ONLY */}
        <section className="p-4 rounded-2xl bg-white/80 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E] space-y-4">
          <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#EA580C]" />
            <span>٥. الوصف والملاحظات</span>
          </h3>

          {/* Paired Customer Description: Arabic + English directly together */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                وصف المنتج للعملاء (بالعربية)
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
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                  <Globe className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>وصف المنتج بالإنجليزية (اختياري)</span>
                </label>
                <button
                  type="button"
                  disabled={translatingField !== null || !storeDescription.trim()}
                  onClick={handleTranslateDescriptionEn}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EA580C]/12 hover:bg-[#EA580C]/20 border border-[#EA580C]/35 text-[10px] font-black text-[#C2410C] dark:text-[#FBBF24] disabled:opacity-45 cursor-pointer transition"
                >
                  {translatingField === 'description' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{translatingField === 'description' ? 'جاري الترجمة...' : 'ترجمة الوصف EN'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                dir="ltr"
                value={enDescription}
                onChange={(e) => setEnDescription(e.target.value)}
                placeholder="Product features, materials, and care instructions in English..."
                className="w-full p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C] resize-none"
              />
            </div>
          </div>

          {/* Internal Workshop Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-[#475569] dark:text-[#94A3B8]">
              ملاحظات داخلية للورشة (تنتقل مع المنتج لحاسبة التكاليف — لا تظهر للعملاء)
            </label>
            <textarea
              rows={2}
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="مثال: نوع الخيط المستخدم، وقت التنفيذ التقريبي، ملاحظات التشطيب..."
              className="w-full p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C] resize-none"
            />
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

          {/* Bottom Section: Extra Enabled Languages ONLY (Zero Arabic/English duplication!) */}
          <div className="pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E] space-y-2.5">
            {extraEnabledLanguages.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowExtraLangsPanel((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#EFE9DC]/70 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer transition"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Globe className="w-4 h-4 text-[#EA580C] shrink-0" />
                    <span className="truncate">
                      ترجمات إضافية (
                      {extraEnabledLanguages
                        .map((code) => PUBLIC_LANGUAGES.find((l) => l.code === code)?.nameAr || code)
                        .join(' · ')}
                      )
                    </span>
                  </span>
                  {showExtraLangsPanel ? (
                    <ChevronUp className="w-4 h-4 text-[#EA580C] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#64748B] shrink-0" />
                  )}
                </button>

                {showExtraLangsPanel && activeExtraLang && (
                  <div className="p-3.5 rounded-xl bg-[#F7F3EA]/80 dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {extraEnabledLanguages.map((code) => {
                          const meta = PUBLIC_LANGUAGES.find((l) => l.code === code);
                          const isActive = activeExtraLang === code;
                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => setActiveExtraLang(code)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-black inline-flex items-center gap-1 cursor-pointer transition ${
                                isActive
                                  ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] dark:bg-[#EA580C] dark:text-white'
                                  : 'bg-white dark:bg-[#132040] text-[#475569] dark:text-[#94A3B8] border-[#D4CCBC] dark:border-[#22355E]'
                              }`}
                            >
                              <span>{meta?.flag}</span>
                              <span>{meta?.nameAr || code}</span>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={translatingField !== null}
                        onClick={() => handleTranslateExtraLanguage(activeExtraLang)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black disabled:opacity-45 cursor-pointer transition"
                      >
                        {translatingField === 'extra' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {translatingField === 'extra'
                            ? 'جاري الترجمة...'
                            : `ترجمة كل الحقول إلى ${
                                PUBLIC_LANGUAGES.find((l) => l.code === activeExtraLang)?.nameAr ||
                                activeExtraLang
                              }`}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                          اسم المنتج ({PUBLIC_LANGUAGES.find((l) => l.code === activeExtraLang)?.nameAr})
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={extraTranslations[activeExtraLang]?.name || ''}
                          onChange={(e) =>
                            setExtraTranslations((prev) => ({
                              ...prev,
                              [activeExtraLang]: {
                                ...(prev[activeExtraLang] || {}),
                                name: e.target.value,
                              },
                            }))
                          }
                          placeholder="Product name..."
                          className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                          وصف المنتج ({PUBLIC_LANGUAGES.find((l) => l.code === activeExtraLang)?.nameAr})
                        </label>
                        <textarea
                          rows={2}
                          dir="ltr"
                          value={extraTranslations[activeExtraLang]?.description || ''}
                          onChange={(e) =>
                            setExtraTranslations((prev) => ({
                              ...prev,
                              [activeExtraLang]: {
                                ...(prev[activeExtraLang] || {}),
                                description: e.target.value,
                              },
                            }))
                          }
                          placeholder="Product description..."
                          className="w-full p-2.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C] resize-none"
                        />
                      </div>
                    </div>

                    {sizeVariants.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="block text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                          ترجمة المقاسات ({PUBLIC_LANGUAGES.find((l) => l.code === activeExtraLang)?.nameAr}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sizeVariants.map((sv) => (
                            <div key={sv.id} className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-[#64748B] shrink-0 max-w-[90px] truncate">
                                {sv.label}:
                              </span>
                              <input
                                type="text"
                                dir="ltr"
                                value={sv.translations?.[activeExtraLang] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSizeVariants((prev) =>
                                    prev.map((row) =>
                                      row.id === sv.id
                                        ? {
                                            ...row,
                                            translations: {
                                              ...(row.translations || {}),
                                              [activeExtraLang]: val,
                                            },
                                          }
                                        : row
                                    )
                                  );
                                }}
                                className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {colors.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="block text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                          ترجمة الألوان ({PUBLIC_LANGUAGES.find((l) => l.code === activeExtraLang)?.nameAr}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {colors.map((c) => (
                            <div key={c} className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-[#64748B] shrink-0 max-w-[90px] truncate">
                                {c}:
                              </span>
                              <input
                                type="text"
                                dir="ltr"
                                value={colorTranslations[c]?.[activeExtraLang] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setColorTranslations((prev) => ({
                                    ...prev,
                                    [c]: { ...(prev[c] || {}), [activeExtraLang]: val },
                                  }));
                                }}
                                className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#EFE9DC]/55 dark:bg-[#132040]/70 border border-[#D4CCBC]/70 dark:border-[#22355E] text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                  <span>
                    المنتج جاهز بالعربية والإنجليزية بالأعلى — لإضافة لغة إضافية (تركية، هولندية، فرنسية...) فعّلها من إعدادات المتجر.
                  </span>
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const code = e.target.value as PublicLocaleCode;
                    if (!code) return;
                    setExtraEnabledLanguages((prev) =>
                      prev.includes(code) ? prev : [...prev, code]
                    );
                    setActiveExtraLang(code);
                    setShowExtraLangsPanel(true);
                    e.target.value = '';
                  }}
                  className="h-7 px-2 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] outline-none cursor-pointer"
                >
                  <option value="">+ إضافة لغة لهذا المنتج</option>
                  {PUBLIC_LANGUAGES.filter((l) => l.code !== 'ar' && l.code !== 'en').map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
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
