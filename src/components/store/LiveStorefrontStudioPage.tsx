import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Pencil,
  Rocket,
  Settings,
  Link2,
  Check,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Plus,
  LayoutList,
  Columns2,
  Grid3x3,
  Palette,
  Sparkles,
  Store,
  Package,
  Save,
  X,
  Upload,
  Megaphone,
  Image as ImageIcon,
  Phone,
  Loader2,
  Globe,
} from 'lucide-react';
import { SavedProductRecord, UserProfile } from '../../types';
import {
  ArtisanStoreConfig,
  DEFAULT_STOREFRONT_SECTION_ORDER,
  StorefrontSectionId,
  getStoredArtisanStoreConfig,
  normalizeArtisanStoreConfig,
  resolveProductOfferPricing,
  saveArtisanStoreConfigCloud,
  saveStoredArtisanStoreConfig,
} from '../../types/artisanStoreBuilder';
import {
  SupplierCatalogItem,
  SupplierProfile,
  SupplierStoreConfig,
} from '../../types/supplier';
import {
  WORLD_STOREFRONT_THEME_LIST,
  StorefrontThemeId,
  normalizeStorefrontThemeId,
  resolveStorefrontTheme,
} from '../../lib/storefrontThemes';
import { tenantStorage } from '../../db/dexieDB';
import {
  getLocalWorkshopStoreLayout,
  publishProductToMarketplace,
  saveWorkshopStoreLayout,
} from '../../db/marketplaceCloud';
import {
  fetchSupplierCatalog,
  getCurrentSupplierFromSupabase,
  updateSupplierStoreConfig,
  upsertSupplierCatalogItem,
} from '../../db/supplierService';
import { getWorkshopCleanSlug } from '../../utils/slugify';
import { compressImageFile } from '../../utils/imageCompressor';
import { playButtonClickSound, playSuccessSound, triggerHaptic } from '../../lib/sounds';
import { StorePromoBannerDisplay } from './StorePromoBannerDisplay';
import { ArtisanProductEditorModal } from './ArtisanProductEditorModal';
import { PublicStorefrontView } from './PublicStorefrontView';
import { SupplierPublicStoreView } from '../supplier/SupplierPublicStoreView';
import { MultilingualContentStudio } from '../common/MultilingualContentStudio';
import {
  PUBLIC_LANGUAGES,
  PublicLocaleCode,
  translateFieldsWithAI,
} from '../../lib/publicLocale';

export interface LiveStorefrontStudioPageProps {
  profile: UserProfile;
  onClose: () => void;
  onOpenStoreSettings: () => void;
  onOpenAddProduct: () => void;
  onNavigateToMarket?: () => void;
  onNavigateToSuppliersMarket?: () => void;
}

const SECTION_META: Record<
  StorefrontSectionId,
  { title: string; subtitle: string; icon: React.ReactNode }
> = {
  promo_banner: {
    title: 'الشريط الترويجي والعروض',
    subtitle: 'شريط متحرك أو ثابت لأهم عروضك وكوبوناتك أعلى المتجر',
    icon: <Megaphone className="w-4 h-4" />,
  },
  hero_header: {
    title: 'غلاف المتجر والترحيب',
    subtitle: 'اسم المتجر والشعار والغلاف ورسالة الترحيب بالعملاء',
    icon: <Store className="w-4 h-4" />,
  },
  products_grid: {
    title: 'معرض المنتجات والقطع',
    subtitle: 'اسحب لترتيب العرض، فعّل أو أخفِ أي منتج، أو عدّل بياناته فوراً',
    icon: <Package className="w-4 h-4" />,
  },
  portfolio_gallery: {
    title: 'معرض الأعمال السابقة',
    subtitle: 'صور التنفيذ الحقيقي وتفاصيل شغلك لإقناع العملاء',
    icon: <ImageIcon className="w-4 h-4" />,
  },
  contact_footer: {
    title: 'تذييل التواصل والفقاعة العائمة',
    subtitle: 'أزرار واتساب والمكالمات وحسابات السوشيال ميديا',
    icon: <Phone className="w-4 h-4" />,
  },
};

function reorderArray<T>(list: T[], fromIdx: number, toIdx: number): T[] {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export const LiveStorefrontStudioPage: React.FC<LiveStorefrontStudioPageProps> = ({
  profile,
  onClose,
  onOpenStoreSettings,
  onOpenAddProduct,
  onNavigateToMarket,
  onNavigateToSuppliersMarket,
}) => {
  const isSupplier = (profile as any)?.accountRole === 'supplier';
  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const storeSlug = useMemo(() => {
    return getWorkshopCleanSlug(profile as any);
  }, [profile]);

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [itemFilter, setItemFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [editingHeroInline, setEditingHeroInline] = useState(false);
  const [showLangStudio, setShowLangStudio] = useState(false);

  // Artisan state
  const [artisanConfig, setArtisanConfig] = useState<ArtisanStoreConfig>(() =>
    getStoredArtisanStoreConfig(tenantId)
  );
  const [artisanProducts, setArtisanProducts] = useState<SavedProductRecord[]>([]);
  const [layoutCols, setLayoutCols] = useState<1 | 2 | 3>(() =>
    getLocalWorkshopStoreLayout(tenantId).layoutCols
  );
  const [productOrder, setProductOrder] = useState<string[]>(() =>
    getLocalWorkshopStoreLayout(tenantId).productOrder
  );
  const [editingArtisanProduct, setEditingArtisanProduct] = useState<SavedProductRecord | null>(null);

  // Supplier state
  const [supplierProfile, setSupplierProfile] = useState<SupplierProfile | null>(null);
  const [supplierConfig, setSupplierConfig] = useState<SupplierStoreConfig>({});
  const [supplierItems, setSupplierItems] = useState<SupplierCatalogItem[]>([]);
  const [editingSupplierItem, setEditingSupplierItem] = useState<SupplierCatalogItem | null>(null);
  const [savingSupplierItem, setSavingSupplierItem] = useState(false);

  // Drag state
  const [draggedSectionId, setDraggedSectionId] = useState<StorefrontSectionId | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<StorefrontSectionId | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupplier) {
        const [freshProf, catalog] = await Promise.all([
          getCurrentSupplierFromSupabase().catch(() => null),
          fetchSupplierCatalog().catch(() => []),
        ]);
        const cachedRaw = localStorage.getItem('alshams_supplier_profile');
        let supObj: SupplierProfile | null = null;
        try {
          if (cachedRaw) supObj = JSON.parse(cachedRaw) as SupplierProfile;
        } catch {}
        const mergedCfg: SupplierStoreConfig = {
          ...(supObj?.storeConfig || {}),
          ...(((freshProf as any)?.storeConfig as SupplierStoreConfig) || {}),
        };
        setSupplierProfile(supObj);
        setSupplierConfig(mergedCfg);
        setSupplierItems(catalog);
        if (mergedCfg.layoutCols === 1 || mergedCfg.layoutCols === 2 || mergedCfg.layoutCols === 3) {
          setLayoutCols(mergedCfg.layoutCols);
        }
        if (Array.isArray(mergedCfg.productOrderIds) && mergedCfg.productOrderIds.length > 0) {
          setProductOrder(mergedCfg.productOrderIds);
        } else {
          setProductOrder(catalog.map((i) => i.id));
        }
      } else {
        const cfg = getStoredArtisanStoreConfig(tenantId);
        const layout = getLocalWorkshopStoreLayout(tenantId);
        const products = await tenantStorage.getProducts(tenantId);
        setArtisanConfig(cfg);
        setLayoutCols(layout.layoutCols);
        setArtisanProducts(products);
        const existingOrder = layout.productOrder.filter((id) =>
          products.some((p) => p.id === id)
        );
        const remaining = products
          .filter((p) => !existingOrder.includes(p.id))
          .map((p) => p.id);
        setProductOrder([...existingOrder, ...remaining]);
      }
    } finally {
      setLoading(false);
    }
  }, [isSupplier, tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unified derived theme, sections, and hiddenSections
  const activeThemeId: StorefrontThemeId = useMemo(() => {
    return normalizeStorefrontThemeId(
      isSupplier ? supplierConfig.themePreset : artisanConfig.themePreset
    );
  }, [isSupplier, supplierConfig.themePreset, artisanConfig.themePreset]);

  const theme = useMemo(() => resolveStorefrontTheme(activeThemeId), [activeThemeId]);

  const availableSectionIds: StorefrontSectionId[] = useMemo(() => {
    const base: StorefrontSectionId[] = isSupplier
      ? ['promo_banner', 'hero_header', 'products_grid', 'contact_footer']
      : DEFAULT_STOREFRONT_SECTION_ORDER;
    const saved = isSupplier ? supplierConfig.sectionOrder : artisanConfig.sectionOrder;
    if (!Array.isArray(saved) || saved.length === 0) return base;
    const valid = saved.filter((s) => base.includes(s));
    return [...Array.from(new Set(valid)), ...base.filter((s) => !valid.includes(s))];
  }, [isSupplier, supplierConfig.sectionOrder, artisanConfig.sectionOrder]);

  const hiddenSections: StorefrontSectionId[] = useMemo(() => {
    const raw = isSupplier ? supplierConfig.hiddenSections : artisanConfig.hiddenSections;
    return Array.isArray(raw) ? raw : [];
  }, [isSupplier, supplierConfig.hiddenSections, artisanConfig.hiddenSections]);

  const setThemePreset = (nextTheme: StorefrontThemeId) => {
    playButtonClickSound();
    if (isSupplier) {
      setSupplierConfig((prev) => ({ ...prev, themePreset: nextTheme }));
    } else {
      setArtisanConfig((prev) => ({ ...prev, themePreset: nextTheme }));
    }
    setHasUnsavedChanges(true);
  };

  const updateSectionOrder = (nextOrder: StorefrontSectionId[]) => {
    if (isSupplier) {
      setSupplierConfig((prev) => ({ ...prev, sectionOrder: nextOrder }));
    } else {
      setArtisanConfig((prev) => ({ ...prev, sectionOrder: nextOrder }));
    }
    setHasUnsavedChanges(true);
  };

  const toggleSectionVisibility = (sectionId: StorefrontSectionId) => {
    playButtonClickSound();
    const isHidden = hiddenSections.includes(sectionId);
    const nextHidden = isHidden
      ? hiddenSections.filter((s) => s !== sectionId)
      : [...hiddenSections, sectionId];

    if (isSupplier) {
      setSupplierConfig((prev) => ({
        ...prev,
        hiddenSections: nextHidden,
        ...(sectionId === 'promo_banner' && prev.promoBanner
          ? { promoBanner: { ...prev.promoBanner, enabled: isHidden } }
          : {}),
      }));
    } else {
      setArtisanConfig((prev) => ({
        ...prev,
        hiddenSections: nextHidden,
        ...(sectionId === 'promo_banner'
          ? { promoBanner: { ...prev.promoBanner, enabled: isHidden } }
          : {}),
        ...(sectionId === 'portfolio_gallery' ? { showPortfolioGallery: isHidden } : {}),
        ...(sectionId === 'hero_header' ? { showCover: isHidden } : {}),
      }));
    }
    setHasUnsavedChanges(true);
  };

  const moveSection = (sectionId: StorefrontSectionId, delta: -1 | 1) => {
    const idx = availableSectionIds.indexOf(sectionId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= availableSectionIds.length) return;
    playButtonClickSound();
    updateSectionOrder(reorderArray(availableSectionIds, idx, target));
  };

  // Ordered Artisan Products
  const orderedArtisanProducts = useMemo(() => {
    const orderMap = new Map<string, number>();
    productOrder.forEach((id, i) => orderMap.set(id, i));
    return [...artisanProducts].sort((a, b) => {
      const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return ia - ib;
    });
  }, [artisanProducts, productOrder]);

  // Ordered Supplier Items
  const orderedSupplierItems = useMemo(() => {
    const orderMap = new Map<string, number>();
    productOrder.forEach((id, i) => orderMap.set(id, i));
    return [...supplierItems].sort((a, b) => {
      const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return ia - ib;
    });
  }, [supplierItems, productOrder]);

  const filteredArtisanProducts = useMemo(() => {
    return orderedArtisanProducts.filter((p) => {
      const active = p.inStore !== false && p.isPublishedInStore !== false;
      if (itemFilter === 'active') return active;
      if (itemFilter === 'hidden') return !active;
      return true;
    });
  }, [orderedArtisanProducts, itemFilter]);

  const filteredSupplierItems = useMemo(() => {
    return orderedSupplierItems.filter((item) => {
      const active = item.inStore !== false;
      if (itemFilter === 'active') return active;
      if (itemFilter === 'hidden') return !active;
      return true;
    });
  }, [orderedSupplierItems, itemFilter]);

  const activeCount = useMemo(() => {
    if (isSupplier) return supplierItems.filter((i) => i.inStore !== false).length;
    return artisanProducts.filter((p) => p.inStore !== false && p.isPublishedInStore !== false).length;
  }, [isSupplier, supplierItems, artisanProducts]);

  const totalCount = isSupplier ? supplierItems.length : artisanProducts.length;

  // Move product in order
  const moveItemOrder = (itemId: string, delta: -1 | 1) => {
    const allIds = isSupplier
      ? orderedSupplierItems.map((i) => i.id)
      : orderedArtisanProducts.map((p) => p.id);
    const idx = allIds.indexOf(itemId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= allIds.length) return;
    playButtonClickSound();
    const next = reorderArray(allIds, idx, target);
    setProductOrder(next);
    if (isSupplier) {
      setSupplierConfig((prev) => ({ ...prev, productOrderIds: next }));
    }
    setHasUnsavedChanges(true);
  };

  const dropItemOnTarget = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const allIds = isSupplier
      ? orderedSupplierItems.map((i) => i.id)
      : orderedArtisanProducts.map((p) => p.id);
    const fromIdx = allIds.indexOf(sourceId);
    const toIdx = allIds.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    playButtonClickSound();
    const next = reorderArray(allIds, fromIdx, toIdx);
    setProductOrder(next);
    if (isSupplier) {
      setSupplierConfig((prev) => ({ ...prev, productOrderIds: next }));
    }
    setHasUnsavedChanges(true);
  };

  // Toggle Artisan Product active/hidden immediately
  const handleToggleArtisanProductActive = async (product: SavedProductRecord) => {
    const currentlyActive = product.inStore !== false && product.isPublishedInStore !== false;
    const nextActive = !currentlyActive;
    const updated: SavedProductRecord = {
      ...product,
      inStore: nextActive,
      isPublishedInStore: nextActive,
      updatedAt: Date.now(),
    };
    setArtisanProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await tenantStorage.mutateProduct(updated);
    playSuccessSound();
    triggerHaptic(15);
    showToast(nextActive ? `تم تفعيل «${product.productName}» في المتجر` : `تم إخفاء «${product.productName}» مؤقتاً`);
  };

  // Save Artisan Product from Editor Modal
  const handleSaveArtisanProduct = async (
    updated: SavedProductRecord,
    options?: { publishToMarket?: boolean; reSubmitForApproval?: boolean }
  ) => {
    const stamped: SavedProductRecord = {
      ...updated,
      updatedAt: Date.now(),
    };
    await tenantStorage.mutateProduct(stamped);
    setArtisanProducts((prev) => prev.map((p) => (p.id === stamped.id ? stamped : p)));
    if (options?.publishToMarket || stamped.inMarket) {
      await publishProductToMarketplace(stamped, profile, {
        reSubmitForApproval: options?.reSubmitForApproval,
      }).catch(() => {});
    }
    setEditingArtisanProduct(null);
    playSuccessSound();
    triggerHaptic(25);
    showToast(`تم حفظ تعديلات «${stamped.productName}» بنجاح`);
  };

  // Toggle Supplier Item active/hidden immediately
  const handleToggleSupplierItemActive = async (item: SupplierCatalogItem) => {
    const nextActive = item.inStore === false;
    const optimistic: SupplierCatalogItem = { ...item, inStore: nextActive };
    setSupplierItems((prev) => prev.map((i) => (i.id === item.id ? optimistic : i)));
    const res = await upsertSupplierCatalogItem(optimistic);
    if (res.success && res.item) {
      setSupplierItems((prev) => prev.map((i) => (i.id === item.id ? res.item! : i)));
      playSuccessSound();
      triggerHaptic(15);
      showToast(nextActive ? `تم تفعيل «${item.name}» في متجرك` : `تم إخفاء «${item.name}» مؤقتاً`);
    } else {
      setSupplierItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      showToast(res.error || 'تعذر تحديث حالة الصنف');
    }
  };

  // Save Supplier Item from quick editor
  const handleSaveSupplierItem = async (updatedItem: SupplierCatalogItem) => {
    setSavingSupplierItem(true);
    try {
      const res = await upsertSupplierCatalogItem(updatedItem);
      if (res.success && res.item) {
        setSupplierItems((prev) => prev.map((i) => (i.id === res.item!.id ? res.item! : i)));
        setEditingSupplierItem(null);
        playSuccessSound();
        triggerHaptic(25);
        showToast(`تم حفظ تعديلات «${res.item.name}» بنجاح`);
      } else {
        showToast(res.error || 'تعذر حفظ تعديلات الصنف');
      }
    } finally {
      setSavingSupplierItem(false);
    }
  };

  // Publish entire store layout, theme, section order, and product order
  const handlePublishStore = async () => {
    setPublishing(true);
    try {
      if (isSupplier) {
        const nextCfg: SupplierStoreConfig = {
          ...supplierConfig,
          themePreset: activeThemeId,
          sectionOrder: availableSectionIds,
          hiddenSections,
          layoutCols,
          productOrderIds: productOrder,
        };
        const res = await updateSupplierStoreConfig(nextCfg);
        if (res.success && res.supplier) {
          setSupplierProfile(res.supplier);
          setSupplierConfig(res.supplier.storeConfig || nextCfg);
          setHasUnsavedChanges(false);
          playSuccessSound();
          triggerHaptic(30);
          showToast('تم نشر تحديثات متجرك للعملاء بنجاح 🚀');
        } else {
          showToast(res.error || 'تم الحفظ محلياً — تعذرت المزامنة مع السحابة');
        }
      } else {
        const nextCfg = normalizeArtisanStoreConfig({
          ...artisanConfig,
          themePreset: activeThemeId,
          sectionOrder: availableSectionIds,
          hiddenSections,
        });
        saveStoredArtisanStoreConfig(tenantId, nextCfg);
        await Promise.all([
          saveArtisanStoreConfigCloud(tenantId, nextCfg, profile.email),
          saveWorkshopStoreLayout(tenantId, layoutCols, productOrder, profile.email),
        ]);
        setArtisanConfig(nextCfg);
        setHasUnsavedChanges(false);
        playSuccessSound();
        triggerHaptic(30);
        showToast('تم نشر متجرك بكل التعديلات والترتيب الجديد بنجاح 🚀');
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyStoreLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = isSupplier
      ? `${origin}/#/supplier/${encodeURIComponent(storeSlug)}`
      : `${origin}/#/store/${encodeURIComponent(storeSlug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      playSuccessSound();
      showToast('تم نسخ رابط متجرك المباشر');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast(url);
    }
  };

  const currencySymbol = profile.currencySymbol || 'ج.م';
  const storeLogo =
    (profile as any)?.logo_url || profile.logoUrl || profile.logoBase64 || '/alshams_falcon_emblem.png';
  const storeName = profile.brandName || profile.artistName || 'متجري';

  const localSupplierOverride: Partial<SupplierProfile> | null = useMemo(() => {
    if (!isSupplier) return null;
    return {
      ...(supplierProfile || {}),
      brandName: storeName,
      logoUrl: storeLogo,
      storeSlug,
      storeConfig: {
        ...supplierConfig,
        themePreset: activeThemeId,
        sectionOrder: availableSectionIds,
        hiddenSections,
        layoutCols,
        productOrderIds: productOrder,
      },
    };
  }, [
    isSupplier,
    supplierProfile,
    storeName,
    storeLogo,
    storeSlug,
    supplierConfig,
    activeThemeId,
    availableSectionIds,
    hiddenSections,
    layoutCols,
    productOrder,
  ]);

  const gridColsClass =
    layoutCols === 1
      ? 'grid-cols-1 max-w-xl mx-auto'
      : layoutCols === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div
      dir="rtl"
      className="min-h-[calc(100dvh-56px)] w-full max-w-full bg-[#F7F3EA] dark:bg-[#070E1E] text-[#0C1427] dark:text-[#F7F3EA] pb-20"
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-2xl bg-[#0C1427] dark:bg-[#F7F3EA] text-[#F7F3EA] dark:text-[#0C1427] text-xs sm:text-sm font-black shadow-2xl border border-[#EA580C]/50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-[92vw]">
          <Sparkles className="w-4 h-4 text-[#FBBF24] dark:text-[#EA580C] shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* === CHIC STICKY TOP STUDIO STRIP RIGHT BESIDE STORE NAME === */}
      <header className="sticky top-0 z-30 w-full bg-[#FFFDF8]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] shadow-sm">
        <div className="max-w-6xl mx-auto px-2.5 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Right cluster: Back + Store Identity + Mode Switcher right beside Store Name */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              title="الرجوع للرئيسية"
              className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] flex items-center justify-center text-[#0C1427] dark:text-[#F7F3EA] transition cursor-pointer shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <img
                src={storeLogo}
                alt={storeName}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] p-0.5 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate max-w-[130px] sm:max-w-[200px]">
                    {storeName}
                  </h1>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      hasUnsavedChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                    title={hasUnsavedChanges ? 'توجد تعديلات غير منشورة' : 'المتجر منشور ومحدّث'}
                  />
                </div>
                <p className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] truncate">
                  {hasUnsavedChanges ? 'تعديلات جاهزة للنشر' : `${activeCount} معروض من ${totalCount}`}
                </p>
              </div>
            </div>

            {/* Segmented Mode Switcher: Edit vs Customer Preview */}
            <div
              role="tablist"
              aria-label="وضع استوديو المتجر"
              className="inline-flex items-center p-1 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'edit'}
                onClick={() => {
                  playButtonClickSound();
                  setMode('edit');
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  mode === 'edit'
                    ? 'bg-[#0C1427] text-[#FBBF24] dark:bg-[#EA580C] dark:text-white shadow-xs'
                    : 'text-[#334155] dark:text-[#CBD5E1] hover:text-[#0C1427] dark:hover:text-white'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>تعديل مباشر</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'preview'}
                onClick={() => {
                  playButtonClickSound();
                  setMode('preview');
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  mode === 'preview'
                    ? 'bg-[#0C1427] text-[#FBBF24] dark:bg-[#EA580C] dark:text-white shadow-xs'
                    : 'text-[#334155] dark:text-[#CBD5E1] hover:text-[#0C1427] dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>معاينة للعملاء</span>
              </button>
            </div>
          </div>

          {/* Left cluster: Copy Link + Advanced Settings + Publish */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyStoreLink}
              title="نسخ رابط المتجر"
              className="h-8 sm:h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Link2 className="w-3.5 h-3.5 text-[#EA580C] dark:text-amber-400" />
              )}
              <span className="hidden md:inline">{copiedLink ? 'تم النسخ' : 'الرابط'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenStoreSettings}
              title="إعدادات المتجر الكاملة والبنرات والكوبونات"
              className="h-8 sm:h-9 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#C2410C] dark:text-amber-300" />
              <span className="hidden sm:inline">إعدادات</span>
            </button>

            <button
              type="button"
              onClick={handlePublishStore}
              disabled={publishing}
              className={`h-8 sm:h-9 px-3 sm:px-4 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white ring-2 ring-[#EA580C]/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {publishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              <span>{publishing ? 'جاري النشر...' : 'نشر'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* === MODE 1: LIVE CUSTOMER PREVIEW === */}
      {mode === 'preview' ? (
        <div className="w-full">
          {isSupplier ? (
            <SupplierPublicStoreView
              slug={storeSlug}
              profile={profile}
              onNavigateToSuppliersMarket={onNavigateToSuppliersMarket || onClose}
              onNavigateToCentralMarket={onNavigateToMarket || onClose}
              onNavigateToApp={onClose}
              previewThemeOverride={activeThemeId}
              isOwnerPreview={false}
              localSupplierOverride={localSupplierOverride}
            />
          ) : (
            <PublicStorefrontView
              slug={storeSlug}
              onNavigateToApp={onClose}
              onNavigateToMarket={onNavigateToMarket}
              isOwnerPreview={false}
              localFallbackProducts={orderedArtisanProducts.filter(
                (p) => p.inStore !== false && p.isPublishedInStore !== false
              )}
              ownerProfile={profile}
              initialLayoutCols={layoutCols}
              initialProductOrder={productOrder}
              previewThemeOverride={activeThemeId}
              localConfigOverride={artisanConfig}
            />
          )}
        </div>
      ) : (
        /* === MODE 2: LIVE INTERACTIVE VISUAL STUDIO (DRAG & DROP + INLINE EDIT) === */
        <div className="max-w-5xl mx-auto px-3 sm:px-5 pt-4 space-y-4">
          {/* Quick Design & Layout Strip */}
          <section className="rounded-2xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3 sm:p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                <span className="text-xs sm:text-sm font-black">
                  شكل المتجر والألوان ({theme.nameAr})
                </span>
              </div>

              {/* Columns switcher + Multilingual Studio toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setShowLangStudio((v) => !v);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                    showLangStudio
                      ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C] dark:bg-[#EA580C] dark:text-white'
                      : 'bg-[#FFEDD5] dark:bg-[#132040] text-[#9A3412] dark:text-[#FBBF24] border-[#EA580C]/45 hover:border-[#EA580C]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>اللغات والشعار</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                    أعمدة العرض:
                  </span>
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                    {([1, 2, 3] as const).map((cols) => (
                      <button
                        key={cols}
                        type="button"
                        onClick={() => {
                          playButtonClickSound();
                          setLayoutCols(cols);
                          if (isSupplier) {
                            setSupplierConfig((prev) => ({ ...prev, layoutCols: cols }));
                          }
                          setHasUnsavedChanges(true);
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition cursor-pointer ${
                          layoutCols === cols
                            ? 'bg-[#EA580C] text-white'
                            : 'text-[#334155] dark:text-[#CBD5E1]'
                        }`}
                      >
                        {cols === 1 ? (
                          <LayoutList className="w-3 h-3" />
                        ) : cols === 2 ? (
                          <Columns2 className="w-3 h-3" />
                        ) : (
                          <Grid3x3 className="w-3 h-3" />
                        )}
                        <span>×{cols}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 10 World Storefront Theme Swatches */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {WORLD_STOREFRONT_THEME_LIST.map((t) => {
                const selected = t.id === activeThemeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemePreset(t.id)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-2 transition cursor-pointer ${
                      selected
                        ? 'border-[#EA580C] bg-[#FFEDD5] dark:bg-[#1E293B] text-[#9A3412] dark:text-[#FBBF24] ring-2 ring-[#EA580C]/25'
                        : 'border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-black/15 shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: t.accentBg }}
                    >
                      {selected && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="whitespace-nowrap">{t.nameAr}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Multilingual & Bilingual Logo Studio Panel */}
          {showLangStudio && (
            <MultilingualContentStudio
              title="إعدادات اللغات والشعار ثنائي اللغة لمتجرك"
              subtitle="أسعارك تُعرض تلقائياً بعملة بلدك وتتحول لعملة الزائر الدولي أوتوماتيكياً — تحكّم هنا في اللغات والشعار العربي/الإنجليزي"
              enabledLanguages={
                (isSupplier ? supplierConfig.enabledLanguages : artisanConfig.enabledLanguages) || ['ar', 'en']
              }
              onChangeEnabledLanguages={(langs) => {
                if (isSupplier) {
                  setSupplierConfig((prev) => ({ ...prev, enabledLanguages: langs }));
                } else {
                  setArtisanConfig((prev) => ({ ...prev, enabledLanguages: langs }));
                }
                setHasUnsavedChanges(true);
              }}
              defaultLanguage={
                (isSupplier ? supplierConfig.defaultLanguage : artisanConfig.defaultLanguage) || 'ar'
              }
              onChangeDefaultLanguage={(lang) => {
                if (isSupplier) {
                  setSupplierConfig((prev) => ({ ...prev, defaultLanguage: lang }));
                } else {
                  setArtisanConfig((prev) => ({ ...prev, defaultLanguage: lang }));
                }
                setHasUnsavedChanges(true);
              }}
              showCurrencies={false}
              showBilingualLogos={true}
              defaultLogoUrl={storeLogo}
              logoArUrl={isSupplier ? supplierConfig.logoArUrl || '' : artisanConfig.logoArUrl || ''}
              logoEnUrl={isSupplier ? supplierConfig.logoEnUrl || '' : artisanConfig.logoEnUrl || ''}
              onChangeLogoAr={(url) => {
                if (isSupplier) {
                  setSupplierConfig((prev) => ({ ...prev, logoArUrl: url }));
                } else {
                  setArtisanConfig((prev) => ({ ...prev, logoArUrl: url }));
                }
                setHasUnsavedChanges(true);
              }}
              onChangeLogoEn={(url) => {
                if (isSupplier) {
                  setSupplierConfig((prev) => ({ ...prev, logoEnUrl: url }));
                } else {
                  setArtisanConfig((prev) => ({ ...prev, logoEnUrl: url }));
                }
                setHasUnsavedChanges(true);
              }}
              fields={
                isSupplier
                  ? [
                      { key: 'brandName', labelAr: 'اسم متجر المورد', sourceArabicValue: storeName },
                      {
                        key: 'tagline',
                        labelAr: 'جملة الترحيب',
                        sourceArabicValue: supplierConfig.tagline || '',
                      },
                      {
                        key: 'description',
                        labelAr: 'وصف المتجر والتوريد',
                        sourceArabicValue: supplierConfig.description || '',
                        multiline: true,
                      },
                      {
                        key: 'promoBannerText',
                        labelAr: 'نص الشريط الترويجي',
                        sourceArabicValue: supplierConfig.promoBanner?.text || '',
                      },
                    ]
                  : [
                      { key: 'brandName', labelAr: 'اسم المتجر / العلامة', sourceArabicValue: storeName },
                      {
                        key: 'welcomeMessage',
                        labelAr: 'رسالة الترحيب بالعملاء',
                        sourceArabicValue: artisanConfig.welcomeMessage || '',
                      },
                      {
                        key: 'artistStory',
                        labelAr: 'قصة الورشة والحرفة',
                        sourceArabicValue: artisanConfig.artistStory || '',
                        multiline: true,
                      },
                      {
                        key: 'craftBadge',
                        labelAr: 'شارة الحرفة الأصيلة',
                        sourceArabicValue: artisanConfig.craftBadge || '',
                      },
                      {
                        key: 'promoBannerText',
                        labelAr: 'نص الشريط الترويجي',
                        sourceArabicValue: artisanConfig.promoBanner?.text || '',
                      },
                    ]
              }
              translations={((isSupplier ? supplierConfig.translations : artisanConfig.translations) || {}) as any}
              onChangeTranslations={(nextTrans) => {
                if (isSupplier) {
                  setSupplierConfig((prev) => ({ ...prev, translations: nextTrans as any }));
                } else {
                  setArtisanConfig((prev) => ({ ...prev, translations: nextTrans as any }));
                }
                setHasUnsavedChanges(true);
              }}
            />
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#64748B] dark:text-[#94A3B8]">
              <Loader2 className="w-7 h-7 animate-spin text-[#EA580C]" />
              <p className="text-sm font-bold">جاري تجهيز استوديو متجرك المباشر...</p>
            </div>
          ) : (
            /* === DRAGGABLE STOREFRONT SECTIONS STACK === */
            <div className="space-y-4">
              {availableSectionIds.map((sectionId, sIdx) => {
                const meta = SECTION_META[sectionId];
                const isHidden = hiddenSections.includes(sectionId);
                const isDragOver = dragOverSectionId === sectionId && draggedSectionId !== sectionId;

                return (
                  <section
                    key={sectionId}
                    draggable
                    onDragStart={(e) => {
                      // Prevent product card drags from bubbling as section drags
                      if (draggedItemId) return;
                      setDraggedSectionId(sectionId);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', `section:${sectionId}`);
                    }}
                    onDragOver={(e) => {
                      if (!draggedSectionId || draggedItemId) return;
                      e.preventDefault();
                      setDragOverSectionId(sectionId);
                    }}
                    onDragLeave={() => {
                      if (dragOverSectionId === sectionId) setDragOverSectionId(null);
                    }}
                    onDrop={(e) => {
                      if (!draggedSectionId || draggedItemId) return;
                      e.preventDefault();
                      const fromIdx = availableSectionIds.indexOf(draggedSectionId);
                      const toIdx = availableSectionIds.indexOf(sectionId);
                      if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
                        playButtonClickSound();
                        updateSectionOrder(reorderArray(availableSectionIds, fromIdx, toIdx));
                      }
                      setDraggedSectionId(null);
                      setDragOverSectionId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedSectionId(null);
                      setDragOverSectionId(null);
                    }}
                    className={`rounded-2xl border transition-all ${
                      isDragOver
                        ? 'border-[#EA580C] ring-2 ring-[#EA580C]/35 scale-[1.005]'
                        : 'border-[#D4CCBC] dark:border-[#22355E]'
                    } ${
                      isHidden
                        ? 'bg-[#EFE9DC]/60 dark:bg-[#0B1224]/60 opacity-70'
                        : 'bg-[#FFFDF8] dark:bg-[#0D162E]'
                    } overflow-hidden shadow-xs`}
                  >
                    {/* Section Drag & Visibility Header */}
                    <div className="px-3 sm:px-4 py-2.5 bg-[#EFE9DC]/80 dark:bg-[#132040]/90 border-b border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          title="اسحب لإعادة ترتيب أقسام المتجر"
                          className="p-1 rounded-lg bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#64748B] cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <span className="text-[#EA580C] dark:text-[#FBBF24] shrink-0">{meta.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-xs sm:text-sm font-black truncate">{meta.title}</h2>
                            {isHidden && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                مخفي
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] hidden sm:block">
                            {meta.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveSection(sectionId, -1)}
                          disabled={sIdx === 0}
                          title="تحريك لأعلى"
                          className="w-7 h-7 rounded-lg bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-35 flex items-center justify-center hover:border-[#EA580C] cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(sectionId, 1)}
                          disabled={sIdx === availableSectionIds.length - 1}
                          title="تحريك لأسفل"
                          className="w-7 h-7 rounded-lg bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-35 flex items-center justify-center hover:border-[#EA580C] cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSectionVisibility(sectionId)}
                          className={`h-7 px-2.5 rounded-lg border text-[11px] font-black flex items-center gap-1 transition cursor-pointer ${
                            isHidden
                              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{isHidden ? 'إظهار' : 'ظاهر'}</span>
                        </button>
                      </div>
                    </div>

                    {/* === SECTION BODY === */}
                    {!isHidden && (
                      <div className="p-3 sm:p-4">
                        {/* 1. PROMO BANNER */}
                        {sectionId === 'promo_banner' && (
                          <div className="space-y-3">
                            {(isSupplier ? supplierConfig.promoBanner?.enabled : artisanConfig.promoBanner?.enabled) ? (
                              <div className="rounded-xl overflow-hidden border border-[#D4CCBC] dark:border-[#22355E]">
                                <StorePromoBannerDisplay
                                  banner={isSupplier ? supplierConfig.promoBanner : artisanConfig.promoBanner}
                                  currencySymbol={currencySymbol}
                                  coupons={isSupplier ? supplierConfig.richCoupons : artisanConfig.coupons}
                                  compactPreview={true}
                                />
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-[#D4CCBC] dark:border-[#22355E] p-3 text-center text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                                الشريط الترويجي غير مفعّل حالياً — يمكنك تفعيله وتعديل نصه مباشرة بالأسفل.
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="text"
                                value={
                                  isSupplier
                                    ? supplierConfig.promoBanner?.text || ''
                                    : artisanConfig.promoBanner?.text || ''
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (isSupplier) {
                                    setSupplierConfig((prev) => ({
                                      ...prev,
                                      promoBanner: {
                                        enabled: true,
                                        text: val,
                                        subText: prev.promoBanner?.subText || '',
                                        showSubText: prev.promoBanner?.showSubText ?? false,
                                        triggerType: prev.promoBanner?.triggerType || 'always',
                                        discountLabel: prev.promoBanner?.discountLabel || 'عرض خاص',
                                        showDiscountLabel: prev.promoBanner?.showDiscountLabel ?? true,
                                        bgColor: prev.promoBanner?.bgColor || '#C2410C',
                                        motionMode: prev.promoBanner?.motionMode || 'marquee',
                                        orientation: prev.promoBanner?.orientation || 'horizontal',
                                        direction: prev.promoBanner?.direction || 'rtl',
                                        speed: prev.promoBanner?.speed || 'normal',
                                        ...prev.promoBanner,
                                      },
                                    }));
                                  } else {
                                    setArtisanConfig((prev) => ({
                                      ...prev,
                                      promoBanner: { ...prev.promoBanner, enabled: true, text: val },
                                    }));
                                  }
                                  setHasUnsavedChanges(true);
                                }}
                                placeholder="اكتب نص العرض الترويجي الذي يتحرك أعلى متجرك..."
                                className="flex-1 px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold focus:outline-none focus:border-[#EA580C]"
                              />
                              <button
                                type="button"
                                onClick={onOpenStoreSettings}
                                className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black whitespace-nowrap cursor-pointer"
                              >
                                حركة البنر والكوبونات ↗
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 2. HERO HEADER (LIVE THEMED PREVIEW + INLINE QUICK EDIT) */}
                        {sectionId === 'hero_header' && (
                          <div
                            className="rounded-2xl p-4 sm:p-5 border transition-colors"
                            style={{
                              backgroundColor: theme.heroBg,
                              borderColor: theme.heroBorder,
                              color: theme.inkColor,
                            }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={storeLogo}
                                  alt={storeName}
                                  className="w-14 h-14 rounded-2xl object-contain bg-white/90 p-1 border shadow-xs shrink-0"
                                  style={{ borderColor: theme.borderColor }}
                                />
                                <div className="min-w-0 space-y-1">
                                  <h3 className="text-base sm:text-lg font-black truncate">{storeName}</h3>
                                  <p
                                    className="text-xs sm:text-sm font-bold leading-relaxed"
                                    style={{ color: theme.mutedColor }}
                                  >
                                    {isSupplier
                                      ? supplierConfig.tagline || 'مورد معتمد لخامات ومستلزمات الحرفيين بأعلى جودة'
                                      : artisanConfig.welcomeMessage}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setEditingHeroInline((v) => !v)}
                                className="self-start sm:self-center px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                                style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>{editingHeroInline ? 'إغلاق التعديل' : 'تعديل الترحيب والنبذة'}</span>
                              </button>
                            </div>

                            {editingHeroInline && (
                              <div className="mt-4 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderColor: theme.borderColor }}>
                                <div>
                                  <label className="block text-[11px] font-black mb-1">
                                    {isSupplier ? 'شعار / جملة الترحيب' : 'رسالة الترحيب بالعملاء'}
                                  </label>
                                  <input
                                    type="text"
                                    value={isSupplier ? supplierConfig.tagline || '' : artisanConfig.welcomeMessage}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (isSupplier) {
                                        setSupplierConfig((prev) => ({ ...prev, tagline: val }));
                                      } else {
                                        setArtisanConfig((prev) => ({ ...prev, welcomeMessage: val }));
                                      }
                                      setHasUnsavedChanges(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-black mb-1">
                                    {isSupplier ? 'وصف المتجر والتوريد' : 'نبذة عن ورشتك وحرفتك'}
                                  </label>
                                  <input
                                    type="text"
                                    value={isSupplier ? supplierConfig.description || '' : artisanConfig.artistStory}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (isSupplier) {
                                        setSupplierConfig((prev) => ({ ...prev, description: val }));
                                      } else {
                                        setArtisanConfig((prev) => ({ ...prev, artistStory: val }));
                                      }
                                      setHasUnsavedChanges(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. PRODUCTS GRID (DRAG & DROP + ACTIVATE/HIDE + DIRECT EDIT) */}
                        {sectionId === 'products_grid' && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="inline-flex items-center p-0.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                                {(
                                  [
                                    { id: 'all', label: `الكل (${totalCount})` },
                                    { id: 'active', label: `المفعّل (${activeCount})` },
                                    { id: 'hidden', label: `المخفي (${Math.max(0, totalCount - activeCount)})` },
                                  ] as const
                                ).map((tab) => (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setItemFilter(tab.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                                      itemFilter === tab.id
                                        ? 'bg-[#0C1427] text-[#FBBF24] dark:bg-[#EA580C] dark:text-white'
                                        : 'text-[#334155] dark:text-[#CBD5E1]'
                                    }`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={onOpenAddProduct}
                                className="px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isSupplier ? 'إضافة خامة جديدة' : 'إضافة منتج جديد'}</span>
                              </button>
                            </div>

                            {/* Empty State */}
                            {(isSupplier ? filteredSupplierItems.length === 0 : filteredArtisanProducts.length === 0) ? (
                              <div className="rounded-2xl border border-dashed border-[#D4CCBC] dark:border-[#22355E] py-10 px-4 text-center space-y-3">
                                <Package className="w-9 h-9 mx-auto text-[#EA580C]/70" />
                                <p className="text-sm font-black">
                                  {totalCount === 0
                                    ? 'لا توجد منتجات في متجرك حتى الآن'
                                    : 'لا توجد منتجات في هذا التصنيف'}
                                </p>
                                {totalCount === 0 && (
                                  <button
                                    type="button"
                                    onClick={onOpenAddProduct}
                                    className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                                  >
                                    + أضف أول منتج لمتجرك الآن
                                  </button>
                                )}
                              </div>
                            ) : isSupplier ? (
                              /* SUPPLIER DRAGGABLE PRODUCT CARDS */
                              <div className={`grid gap-3 ${gridColsClass}`}>
                                {filteredSupplierItems.map((item, idx) => {
                                  const isActive = item.inStore !== false;
                                  const thumb = item.images?.[0] || '/alshams_falcon_emblem.png';
                                  const isTarget = dragOverItemId === item.id && draggedItemId !== item.id;
                                  return (
                                    <div
                                      key={item.id}
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        setDraggedItemId(item.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', `item:${item.id}`);
                                      }}
                                      onDragOver={(e) => {
                                        if (!draggedItemId) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverItemId(item.id);
                                      }}
                                      onDrop={(e) => {
                                        if (!draggedItemId) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        dropItemOnTarget(draggedItemId, item.id);
                                        setDraggedItemId(null);
                                        setDragOverItemId(null);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedItemId(null);
                                        setDragOverItemId(null);
                                      }}
                                      className={`rounded-2xl border overflow-hidden transition-all flex flex-col ${
                                        isTarget
                                          ? 'border-[#EA580C] ring-2 ring-[#EA580C]/35 scale-[1.01]'
                                          : 'border-[#D4CCBC] dark:border-[#22355E]'
                                      } ${
                                        isActive
                                          ? 'bg-white dark:bg-[#111D38]'
                                          : 'bg-[#F1ECE0]/70 dark:bg-[#0B1224]/70 opacity-75'
                                      }`}
                                    >
                                      {/* Card Top Bar: Drag + Order Arrows + Active Toggle */}
                                      <div className="px-2.5 py-2 bg-[#F7F3EA] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1">
                                          <span className="p-1 text-[#64748B] cursor-grab active:cursor-grabbing" title="اسحب للترتيب">
                                            <GripVertical className="w-3.5 h-3.5" />
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => moveItemOrder(item.id, -1)}
                                            disabled={idx === 0}
                                            title="تقديم"
                                            className="w-6 h-6 rounded-md bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 flex items-center justify-center cursor-pointer"
                                          >
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveItemOrder(item.id, 1)}
                                            disabled={idx === filteredSupplierItems.length - 1}
                                            title="تأخير"
                                            className="w-6 h-6 rounded-md bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 flex items-center justify-center cursor-pointer"
                                          >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleSupplierItemActive(item)}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition cursor-pointer ${
                                            isActive
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                          }`}
                                        >
                                          {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                          <span>{isActive ? 'مفعّل' : 'مخفي'}</span>
                                        </button>
                                      </div>

                                      {/* Clickable Body -> Direct Edit */}
                                      <div
                                        onClick={() => setEditingSupplierItem(item)}
                                        className="p-3 flex-1 flex flex-col gap-2 cursor-pointer group"
                                      >
                                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#EFE9DC] dark:bg-[#0D162E]">
                                          <img
                                            src={thumb}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                          {item.discountValue > 0 && item.discountType !== 'none' && (
                                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black">
                                              {item.discountType === 'percent'
                                                ? `خصم ${item.discountValue}%`
                                                : `وفر ${item.discountValue}`}
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="text-xs sm:text-sm font-black line-clamp-1">{item.name}</h4>
                                        <div className="flex items-center justify-between gap-2 text-xs font-black">
                                          <span style={{ color: theme.priceColor }}>
                                            {Number(item.retailPrice || 0).toLocaleString('ar-EG')} {currencySymbol}
                                            <span className="text-[10px] font-bold text-[#64748B]"> / {item.unit || 'قطعة'}</span>
                                          </span>
                                          <span className="text-[10px] font-bold text-[#64748B]">
                                            مخزون: {item.stockQty}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="px-3 pb-3">
                                        <button
                                          type="button"
                                          onClick={() => setEditingSupplierItem(item)}
                                          className="w-full py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#EA580C] hover:text-white dark:bg-[#132040] dark:hover:bg-[#EA580C] text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          <span>تعديل وحفظ</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              /* ARTISAN DRAGGABLE PRODUCT CARDS */
                              <div className={`grid gap-3 ${gridColsClass}`}>
                                {filteredArtisanProducts.map((product, idx) => {
                                  const isActive =
                                    product.inStore !== false && product.isPublishedInStore !== false;
                                  const pricing = resolveProductOfferPricing(
                                    product,
                                    undefined,
                                    artisanConfig.storeCurrency || profile.currency || 'EGP'
                                  );
                                  const isTarget = dragOverItemId === product.id && draggedItemId !== product.id;

                                  return (
                                    <div
                                      key={product.id}
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        setDraggedItemId(product.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', `item:${product.id}`);
                                      }}
                                      onDragOver={(e) => {
                                        if (!draggedItemId) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverItemId(product.id);
                                      }}
                                      onDrop={(e) => {
                                        if (!draggedItemId) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        dropItemOnTarget(draggedItemId, product.id);
                                        setDraggedItemId(null);
                                        setDragOverItemId(null);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedItemId(null);
                                        setDragOverItemId(null);
                                      }}
                                      className={`rounded-2xl border overflow-hidden transition-all flex flex-col ${
                                        isTarget
                                          ? 'border-[#EA580C] ring-2 ring-[#EA580C]/35 scale-[1.01]'
                                          : 'border-[#D4CCBC] dark:border-[#22355E]'
                                      } ${
                                        isActive
                                          ? 'bg-white dark:bg-[#111D38]'
                                          : 'bg-[#F1ECE0]/70 dark:bg-[#0B1224]/70 opacity-75'
                                      }`}
                                    >
                                      {/* Card Top Bar: Drag + Order Arrows + Active Toggle */}
                                      <div className="px-2.5 py-2 bg-[#F7F3EA] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1">
                                          <span className="p-1 text-[#64748B] cursor-grab active:cursor-grabbing" title="اسحب للترتيب">
                                            <GripVertical className="w-3.5 h-3.5" />
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => moveItemOrder(product.id, -1)}
                                            disabled={idx === 0}
                                            title="تقديم"
                                            className="w-6 h-6 rounded-md bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 flex items-center justify-center cursor-pointer"
                                          >
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveItemOrder(product.id, 1)}
                                            disabled={idx === filteredArtisanProducts.length - 1}
                                            title="تأخير"
                                            className="w-6 h-6 rounded-md bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 flex items-center justify-center cursor-pointer"
                                          >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleArtisanProductActive(product)}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition cursor-pointer ${
                                            isActive
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                          }`}
                                        >
                                          {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                          <span>{isActive ? 'مفعّل' : 'مخفي'}</span>
                                        </button>
                                      </div>

                                      {/* Clickable Body -> Open Direct Editor */}
                                      <div
                                        onClick={() => setEditingArtisanProduct(product)}
                                        className="p-3 flex-1 flex flex-col gap-2 cursor-pointer group"
                                      >
                                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#EFE9DC] dark:bg-[#0D162E]">
                                          <img
                                            src={product.imageUrl || '/alshams_falcon_emblem.png'}
                                            alt={product.productName}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          />
                                          {pricing.badgeText && (
                                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black">
                                              {pricing.badgeText}
                                            </span>
                                          )}
                                        </div>

                                        <h4 className="text-xs sm:text-sm font-black line-clamp-1">
                                          {product.productName}
                                        </h4>

                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-baseline gap-1.5">
                                            <span
                                              className="text-xs sm:text-sm font-black"
                                              style={{ color: theme.priceColor }}
                                            >
                                              {Math.round(pricing.finalPrice).toLocaleString('ar-EG')}{' '}
                                              {pricing.displaySymbol}
                                            </span>
                                            {pricing.hasDiscount && (
                                              <span className="text-[10px] line-through text-[#94A3B8]">
                                                {Math.round(pricing.originalPrice).toLocaleString('ar-EG')}
                                              </span>
                                            )}
                                          </div>
                                          {product.inMarket && (
                                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-300">
                                              في السوق
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="px-3 pb-3">
                                        <button
                                          type="button"
                                          onClick={() => setEditingArtisanProduct(product)}
                                          className="w-full py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#EA580C] hover:text-white dark:bg-[#132040] dark:hover:bg-[#EA580C] text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          <span>تعديل وحفظ</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. PORTFOLIO GALLERY (ARTISAN) */}
                        {sectionId === 'portfolio_gallery' && !isSupplier && (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black">{artisanConfig.portfolioTitle}</p>
                              <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                                {artisanConfig.portfolioItems.length > 0
                                  ? `${artisanConfig.portfolioItems.length} صورة جاهزة للعرض للعملاء`
                                  : 'لم تتم إضافة صور بعد — يمكنك إضافتها من إعدادات المتجر'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={onOpenStoreSettings}
                              className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer"
                            >
                              إدارة صور المعرض ↗
                            </button>
                          </div>
                        )}

                        {/* 5. CONTACT FOOTER */}
                        {sectionId === 'contact_footer' && (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <p className="text-xs font-black">
                                هاتف التواصل:{' '}
                                <span className="font-mono" dir="ltr">
                                  {(isSupplier ? supplierConfig.whatsappNumber : artisanConfig.socialLinks?.whatsapp) ||
                                    profile.phoneNumber ||
                                    'غير محدد'}
                                </span>
                              </p>
                              <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                                يظهر للعملاء أسفل المتجر وعبر زر التواصل العائم
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={onOpenStoreSettings}
                              className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer"
                            >
                              تعديل أرقام وروابط التواصل ↗
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === ARTISAN FULL PRODUCT EDITOR MODAL === */}
      {editingArtisanProduct && (
        <ArtisanProductEditorModal
          product={editingArtisanProduct}
          storeCurrency={artisanConfig.storeCurrency || profile.currency || 'EGP'}
          availableCouponCodes={artisanConfig.coupons.filter((c) => c.active).map((c) => c.code)}
          onClose={() => setEditingArtisanProduct(null)}
          onSave={handleSaveArtisanProduct}
        />
      )}

      {/* === SUPPLIER QUICK ITEM EDITOR MODAL === */}
      {editingSupplierItem && (
        <SupplierQuickItemEditorModal
          item={editingSupplierItem}
          currencySymbol={currencySymbol}
          saving={savingSupplierItem}
          onClose={() => setEditingSupplierItem(null)}
          onSave={handleSaveSupplierItem}
        />
      )}
    </div>
  );
};

/* === BUILT-IN SLEEK SUPPLIER ITEM EDITOR MODAL === */
interface SupplierQuickItemEditorModalProps {
  item: SupplierCatalogItem;
  currencySymbol: string;
  saving: boolean;
  onClose: () => void;
  onSave: (updated: SupplierCatalogItem) => Promise<void>;
}

const SupplierQuickItemEditorModal: React.FC<SupplierQuickItemEditorModalProps> = ({
  item,
  currencySymbol,
  saving,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(item.name || '');
  const [retailPrice, setRetailPrice] = useState(Number(item.retailPrice || 0));
  const [wholesalePrice, setWholesalePrice] = useState(Number(item.wholesalePrice || 0));
  const [stockQty, setStockQty] = useState(Number(item.stockQty || 0));
  const [unit, setUnit] = useState(item.unit || 'قطعة');
  const [description, setDescription] = useState(item.description || '');
  const [inStore, setInStore] = useState(item.inStore !== false);
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>(
    item.discountType || 'none'
  );
  const [discountValue, setDiscountValue] = useState(Number(item.discountValue || 0));
  const [images, setImages] = useState<string[]>(Array.isArray(item.images) ? item.images : []);
  const [uploading, setUploading] = useState(false);
  const [translations, setTranslations] = useState<
    Partial<Record<string, { name?: string; description?: string }>>
  >(item.translations || {});
  const [activeTransLang, setActiveTransLang] = useState<PublicLocaleCode>('en');
  const [translating, setTranslating] = useState(false);

  const handleAiTranslateItem = async () => {
    if (!name.trim() && !description.trim()) return;
    setTranslating(true);
    try {
      const res = await translateFieldsWithAI(
        { name: name.trim(), description: description.trim() },
        activeTransLang,
        'ar'
      );
      if (res.success && res.translations) {
        setTranslations((prev) => ({
          ...prev,
          [activeTransLang]: {
            ...(prev[activeTransLang] || {}),
            name: res.translations?.name || prev[activeTransLang]?.name || '',
            description: res.translations?.description || prev[activeTransLang]?.description || '',
          },
        }));
      }
    } finally {
      setTranslating(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImageFile(file);
      if (compressed) {
        setImages((prev) => [compressed, ...prev.slice(0, 4)]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...item,
      name: name.trim() || item.name,
      retailPrice: Math.max(0, Number(retailPrice) || 0),
      wholesalePrice: Math.max(0, Number(wholesalePrice) || 0),
      stockQty: Math.max(0, Number(stockQty) || 0),
      unit: unit.trim() || 'قطعة',
      description: description.trim(),
      inStore,
      discountType,
      discountValue: discountType === 'none' ? 0 : Math.max(0, Number(discountValue) || 0),
      images,
      translations: Object.keys(translations).length > 0 ? translations : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3" dir="rtl">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#FFFDF8] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl"
      >
        <div className="sticky top-0 z-10 px-4 py-3 bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
          <h3 className="text-sm font-black">تعديل الصنف مباشرة في المتجر</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Visibility switch */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
            <div>
              <p className="text-xs font-black">عرض الصنف للعملاء في المتجر</p>
              <p className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                يمكنك إخفاؤه مؤقتاً دون حذفه من الكتالوج
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInStore((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                inStore ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              {inStore ? 'مفعّل ✓' : 'مخفي'}
            </button>
          </div>

          {/* Image preview + upload */}
          <div className="flex items-center gap-3">
            <img
              src={images[0] || '/alshams_falcon_emblem.png'}
              alt={name}
              className="w-16 h-16 rounded-2xl object-cover border border-[#D4CCBC] dark:border-[#22355E] shrink-0"
            />
            <label className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>{uploading ? 'جاري الرفع...' : 'تغيير الصورة الرئيسية'}</span>
              <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-black mb-1">اسم الصنف / الخامة</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black mb-1">سعر القطاعي ({currencySymbol})</label>
              <input
                type="number"
                min={0}
                step="any"
                value={retailPrice}
                onChange={(e) => setRetailPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">سعر الجملة ({currencySymbol})</label>
              <input
                type="number"
                min={0}
                step="any"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black mb-1">المخزون المتاح</label>
              <input
                type="number"
                min={0}
                step="any"
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">الوحدة</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black mb-1">نوع الخصم</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="none">بدون خصم</option>
                <option value="percent">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت ({currencySymbol})</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black mb-1">قيمة الخصم</label>
              <input
                type="number"
                min={0}
                step="any"
                disabled={discountType === 'none'}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black mb-1">وصف ومواصفات الصنف</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>

          {/* Multilingual item translations */}
          <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-black flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                <Globe className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>ترجمة الصنف للغات العالمية</span>
              </span>
              <button
                type="button"
                disabled={translating || (!name.trim() && !description.trim())}
                onClick={handleAiTranslateItem}
                className="px-2.5 py-1 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
              >
                {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>ترجمة تلقائية</span>
              </button>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {PUBLIC_LANGUAGES.filter((l) => l.code !== 'ar').map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setActiveTransLang(lang.code)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap cursor-pointer border ${
                    activeTransLang === lang.code
                      ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C]'
                      : 'bg-white dark:bg-[#0D162E] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  {lang.flag} {lang.shortCode}
                </button>
              ))}
            </div>
            <input
              type="text"
              dir="ltr"
              value={translations[activeTransLang]?.name || ''}
              onChange={(e) =>
                setTranslations((prev) => ({
                  ...prev,
                  [activeTransLang]: { ...(prev[activeTransLang] || {}), name: e.target.value },
                }))
              }
              placeholder={`Item name (${activeTransLang.toUpperCase()})`}
              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <textarea
              rows={2}
              dir="ltr"
              value={translations[activeTransLang]?.description || ''}
              onChange={(e) =>
                setTranslations((prev) => ({
                  ...prev,
                  [activeTransLang]: { ...(prev[activeTransLang] || {}), description: e.target.value },
                }))
              }
              placeholder={`Item description (${activeTransLang.toUpperCase()})`}
              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>
        </div>

        <div className="sticky bottom-0 px-4 py-3 bg-[#EFE9DC] dark:bg-[#132040] border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>حفظ التعديلات</span>
          </button>
        </div>
      </form>
    </div>
  );
};
