import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SavedProductRecord, UserProfile } from '../../types';
import {
  MAIN_SECTIONS,
  SUB_CRAFTS_REGISTRY,
} from '../../registry/craftsRegistry';
import { tenantStorage } from '../../db/dexieDB';
import { useTranslation } from '../../lib/i18n';
import { buildProductLandingUrl, buildStoreUrl } from '../../lib/appRoutes';
import {
  BookOpen,
  Search,
  Filter,
  Download,
  Printer,
  Share2,
  Calculator,
  Layers,
  Boxes,
  CheckCircle,
  RefreshCw,
  ArrowUpDown,
  RotateCcw,
  Check,
  AlertCircle,
  X,
  Edit3,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Facebook,
  ExternalLink,
  Tag,
  Ruler,
  FileText,
  Palette,
  Sparkles,
  Store,
  ShoppingBag,
  Lock,
  Globe,
  Eye,
  EyeOff,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Upload,
  Copy,
  Send,
  Archive,
  Plus,
} from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  publishProductToMarketplace,
  fetchWorkshopMarketplaceProducts,
  getLocalWorkshopStoreLayout,
  saveWorkshopStoreLayout,
} from '../../db/marketplaceCloud';
import {
  generateArtisanQuotationPDF,
  extractQuotationDataFromRecord,
} from '../../services/quotationPdfGenerator';
import { flushProductSync, syncAllWorkshopProductsAndStore } from '../../db/productsCloud';
import { flushOfflineMutations, getPendingOfflineMutationsCount } from '../../db/offlineMutationQueue';
import { pendingCount, PRODUCTS_PULLED_EVENT } from '../../db/productSyncQueue';
import { playSuccessSound, playAlertSound } from '../../lib/sounds';
import { PublicStorefrontView } from '../store/PublicStorefrontView';
import { getWorkshopCleanSlug, getWorkshopStoreUrl } from '../../utils/slugify';
import { DirectCatalogProductPage } from './DirectCatalogProductModal';
import { ProductVideoThumbnail } from '../common/ProductVideoThumbnail';
import {
  getProductCatalogStatus,
  getStoreProductStatus,
  CatalogStatusColor,
} from '../../lib/catalogStatus';

interface WorkshopCatalogProps {
  profile: UserProfile;
  initialTab?: 'catalog' | 'store';
  initialOpenDirectAdd?: boolean;
  onConsumeInitialDirectAdd?: () => void;
  onSelectRecordToLoad: (record: SavedProductRecord) => void;
  onOpenWhatsAppShare: (record: SavedProductRecord) => void;
  onOpenMarketplace?: () => void;
  onOpenMyStore?: () => void;
}

export const WorkshopCatalog: React.FC<WorkshopCatalogProps> = ({
  profile,
  initialOpenDirectAdd = false,
  onConsumeInitialDirectAdd,
  onSelectRecordToLoad,
  onOpenWhatsAppShare,
  onOpenMarketplace,
  onOpenMyStore,
}) => {
  const { t: tr } = useTranslation();

  // Dedicated Catalog page (My Store now has its own dedicated full page)
  const [activeTab] = useState<'catalog' | 'store'>('catalog');

  // All loaded products stored in memory
  const [allProducts, setAllProducts] = useState<SavedProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isDirectAddOpen, setIsDirectAddOpen] = useState<boolean>(() => Boolean(initialOpenDirectAdd));
  const [statusColorFilter, setStatusColorFilter] = useState<'all' | CatalogStatusColor>('all');

  useEffect(() => {
    if (initialOpenDirectAdd) {
      setIsDirectAddOpen(true);
      onConsumeInitialDirectAdd?.();
    }
  }, [initialOpenDirectAdd, onConsumeInitialDirectAdd]);

  useEffect(() => {
    const wid = profile.tenantId || profile.workshopId || profile.id || '';
    const updateCount = () => {
      setPendingSyncCount(pendingCount(wid) + getPendingOfflineMutationsCount(wid));
    };
    const handleRemoteRefresh = () => {
      loadCatalogData();
      updateCount();
    };
    const handleOpenQuickDirect = () => {
      setIsDirectAddOpen(true);
    };
    updateCount();
    window.addEventListener('alshams:products-dirty', updateCount);
    window.addEventListener('alshams:products-sync-status', updateCount);
    window.addEventListener('alshams:offline-queue-changed', updateCount);
    window.addEventListener(PRODUCTS_PULLED_EVENT, handleRemoteRefresh);
    window.addEventListener('alshams_products_changed', handleRemoteRefresh);
    window.addEventListener('alshams_open_quick_direct_product', handleOpenQuickDirect);
    return () => {
      window.removeEventListener('alshams:products-dirty', updateCount);
      window.removeEventListener('alshams:products-sync-status', updateCount);
      window.removeEventListener('alshams:offline-queue-changed', updateCount);
      window.removeEventListener(PRODUCTS_PULLED_EVENT, handleRemoteRefresh);
      window.removeEventListener('alshams_products_changed', handleRemoteRefresh);
      window.removeEventListener('alshams_open_quick_direct_product', handleOpenQuickDirect);
    };
  }, [profile.id, profile.workshopId, profile.tenantId]);

  // Store tab state
  const [storeSearchQuery, setStoreSearchQuery] = useState<string>('');
  const [storeStatusFilter, setStoreStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [storePrices, setStorePrices] = useState<Record<string, number>>({});
  const [storeDescriptions, setStoreDescriptions] = useState<Record<string, string>>({});
  const [isCustomerPreviewOpen, setIsCustomerPreviewOpen] = useState<boolean>(false);
  const [storeLayoutCols, setStoreLayoutCols] = useState<1 | 2 | 3>(2);
  const [copiedFooterTarget, setCopiedFooterTarget] = useState<'store' | 'market' | null>(null);
  const [selectedStoreMarketIds, setSelectedStoreMarketIds] = useState<Set<string>>(new Set());
  const [marketStatusMap, setMarketStatusMap] = useState<Record<string, 'pending_approval' | 'approved' | 'rejected'>>({});
  const [pendingBannerMessage, setPendingBannerMessage] = useState<string>('');
  const pendingBannerTimerRef = useRef<number | null>(null);

  // Multi-selection state (Catalog tab)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMainSection, setSelectedMainSection] = useState<string>('all');
  const [selectedCraft, setSelectedCraft] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'serial' | 'name' | 'retailPrice' | 'wholesalePrice' | 'costPrice'>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Custom Drag & Drop Priority State (Products & Categories)
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [productOrder, setProductOrder] = useState<string[]>([]);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // Specs Editing Modal State
  const [editingRecord, setEditingRecord] = useState<SavedProductRecord | null>(null);
  const [editFormData, setEditFormData] = useState<{
    productName: string;
    productCode: string;
    productType: string;
    category: string;
    retailPrice: number;
    wholesalePrice: number;
    costPrice: number;
    imageUrl: string;
    widthCm: number;
    heightCm: number;
    diameterCm: number;
    fringeLengthCm: number;
    materialsDescription: string;
    colorVariants: string;
    marketingDescription: string;
    careInstructions: string;
    tags: string;
  }>({
    productName: '',
    productCode: '',
    productType: '',
    category: '',
    retailPrice: 0,
    wholesalePrice: 0,
    costPrice: 0,
    imageUrl: '',
    widthCm: 0,
    heightCm: 0,
    diameterCm: 0,
    fringeLengthCm: 0,
    materialsDescription: '',
    colorVariants: '',
    marketingDescription: '',
    careInstructions: '',
    tags: '',
  });

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const printTemplateRef = useRef<HTMLDivElement>(null);

  // Load saved Drag & Drop priorities & store grid layout from localStorage
  useEffect(() => {
    try {
      const savedCats = localStorage.getItem(`alshams_catalog_cat_order_${tenantId}`);
      if (savedCats) {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed)) setCategoryOrder(parsed);
      }
      const savedProds = localStorage.getItem(`alshams_catalog_prod_order_${tenantId}`);
      if (savedProds) {
        const parsed = JSON.parse(savedProds);
        if (Array.isArray(parsed)) setProductOrder(parsed);
      }
      const localStoreLayout = getLocalWorkshopStoreLayout(tenantId);
      setStoreLayoutCols(localStoreLayout.layoutCols);
      if (localStoreLayout.productOrder.length > 0 && !savedProds) {
        setProductOrder(localStoreLayout.productOrder);
      }
    } catch {
      // ignore storage errors
    }

    const handleLayoutEvt = (e: any) => {
      if (e?.detail?.workshopId === tenantId) {
        if (e.detail.layoutCols) setStoreLayoutCols(e.detail.layoutCols);
        if (Array.isArray(e.detail.productOrder) && e.detail.productOrder.length > 0) {
          setProductOrder(e.detail.productOrder);
        }
      }
    };
    window.addEventListener('alshams_store_layout_updated', handleLayoutEvt);
    return () => window.removeEventListener('alshams_store_layout_updated', handleLayoutEvt);
  }, [tenantId]);

  // Load all products ONCE from database + live marketplace approval status
  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const items = await tenantStorage.getProducts(tenantId);
      setAllProducts(items);
      if (tenantId) {
        fetchWorkshopMarketplaceProducts(tenantId)
          .then((cloudItems) => {
            const nextMap: Record<string, 'pending_approval' | 'approved' | 'rejected'> = {};
            cloudItems.forEach((cm) => {
              if (cm.id && cm.status) {
                nextMap[cm.id] = cm.status;
              }
            });
            setMarketStatusMap(nextMap);
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load workshop products for catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
    return () => {
      if (pendingBannerTimerRef.current) {
        window.clearTimeout(pendingBannerTimerRef.current);
      }
    };
  }, [tenantId]);

  // Crafts selected by the artisan
  const userCrafts = useMemo(() => {
    const craftIds = profile.selectedCrafts && profile.selectedCrafts.length > 0
      ? profile.selectedCrafts
      : ['macrame'];
    return SUB_CRAFTS_REGISTRY.filter((c) => craftIds.includes(c.id));
  }, [profile.selectedCrafts]);

  // Main sections available from selected crafts
  const availableSections = useMemo(() => {
    const secIds = new Set(userCrafts.map((c) => c.mainSectionId));
    return MAIN_SECTIONS.filter((s) => secIds.has(s.id));
  }, [userCrafts]);

  // Sub-crafts options for dropdown
  const subCraftOptions = useMemo(() => {
    if (selectedMainSection === 'ropes_textiles' || selectedMainSection === 'all') {
      const textile = SUB_CRAFTS_REGISTRY.filter((c) => c.mainSectionId === 'ropes_textiles');
      const map = new Map<string, any>();
      [...textile, ...userCrafts].forEach((c) => map.set(c.id, c));
      return Array.from(map.values());
    }
    return userCrafts.filter((c) => c.mainSectionId === selectedMainSection);
  }, [userCrafts, selectedMainSection]);

  // Reset craft filter if it doesn't belong to newly selected main section
  useEffect(() => {
    if (selectedCraft !== 'all') {
      const exists = subCraftOptions.some((c) => c.id === selectedCraft || c.nameAr === selectedCraft);
      if (!exists) {
        setSelectedCraft('all');
      }
    }
  }, [selectedMainSection, subCraftOptions]);

  // Helper functions to get accurate numbers and labels across legacy and current records
  const getCostPrice = (p: SavedProductRecord): number => {
    if (typeof p.costPrice === 'number' && p.costPrice > 0) return p.costPrice;
    if (p.output) {
      return Math.round(
        (p.output.totalDirectMaterialsCost || 0) +
        (p.output.laborWage || 0) +
        (p.output.packagingCost || 0) +
        (p.output.transitFees || 0) +
        (p.output.adminExpensesShare || 0)
      );
    }
    return 0;
  };

  const getRetailPrice = (p: SavedProductRecord): number => {
    if (typeof p.retailPrice === 'number' && p.retailPrice > 0) return p.retailPrice;
    return p.output?.finalSellingPrice || 0;
  };

  const getWholesalePrice = (p: SavedProductRecord): number => {
    if (typeof p.wholesalePrice === 'number' && p.wholesalePrice > 0) return p.wholesalePrice;
    const cost = getCostPrice(p);
    const retail = getRetailPrice(p);
    const discountPercent = profile.defaultWholesaleDiscountPercent ?? 25;
    const marginAmount = p.output?.insulatedProfitAmount || Math.max(0, retail - cost);
    const discount = Math.round(marginAmount * (discountPercent / 100));
    return Math.max(cost, retail - discount);
  };

  const getProductSerialDisplay = (p: SavedProductRecord, index: number): string => {
    if (p.productCode) return p.productCode;
    if (p.productSerialNumber) return `PRD-${String(p.productSerialNumber).padStart(4, '0')}`;
    return `PRD-${String(index + 1).padStart(4, '0')}`;
  };

  const getMainSectionDisplay = (p: SavedProductRecord): string => {
    if (p.mainSectionName) return p.mainSectionName;
    if (p.mainSectionId) {
      const sec = MAIN_SECTIONS.find((s) => s.id === p.mainSectionId);
      if (sec) return sec.nameAr;
    }
    return p.productType || 'مشغولات يدوية';
  };

  const getCraftDisplay = (p: SavedProductRecord): string => {
    if (p.craftName) return p.craftName;
    if (p.craftId) {
      const c = SUB_CRAFTS_REGISTRY.find((sc) => sc.id === p.craftId);
      if (c) return c.nameAr;
    }
    return (p.category as string) || 'مكرمية';
  };

  // Products visible in Reference Catalog (exported from Archive, or legacy without explicit false)
  const catalogVisibleProducts = useMemo(() => {
    return allProducts.filter((p) => p.isCatalogVisible !== false);
  }, [allProducts]);

  // Ordered unique categories for Category Priority Drag & Drop bar
  const orderedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    catalogVisibleProducts.forEach((p) => {
      const cat = getCraftDisplay(p);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    const uniqueCats = Array.from(counts.keys());
    const rankMap = new Map(categoryOrder.map((c, i) => [c, i]));
    uniqueCats.sort((a, b) => {
      const ra = rankMap.has(a) ? rankMap.get(a)! : Number.MAX_SAFE_INTEGER;
      const rb = rankMap.has(b) ? rankMap.get(b)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, 'ar');
    });
    return uniqueCats.map((name) => ({ name, count: counts.get(name) || 0 }));
  }, [catalogVisibleProducts, categoryOrder]);

  // Master priority index lookup combining localStorage order + sortOrder property + category order
  const productPriorityRankMap = useMemo(() => {
    const orderIdx = new Map(productOrder.map((id, idx) => [id, idx]));
    const catIdx = new Map(orderedCategories.map((c, idx) => [c.name, idx]));
    const sortedMaster = [...allProducts].sort((a, b) => {
      const oa = orderIdx.get(a.id);
      const ob = orderIdx.get(b.id);
      if (oa !== undefined && ob !== undefined) return oa - ob;
      if (oa !== undefined) return -1;
      if (ob !== undefined) return 1;
      const sa = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const sb = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      const ca = catIdx.get(getCraftDisplay(a)) ?? Number.MAX_SAFE_INTEGER;
      const cb = catIdx.get(getCraftDisplay(b)) ?? Number.MAX_SAFE_INTEGER;
      if (ca !== cb) return ca - cb;
      return (a.productSerialNumber || 0) - (b.productSerialNumber || 0);
    });
    return new Map(sortedMaster.map((p, idx) => [p.id, idx]));
  }, [allProducts, productOrder, orderedCategories]);

  // Persist custom product display priority order to localStorage + IndexedDB
  const persistProductPriorityOrder = async (nextOrderedIds: string[], feedbackMsg?: string) => {
    setProductOrder(nextOrderedIds);
    setSortBy('priority');
    setSortOrder('asc');
    try {
      localStorage.setItem(`alshams_catalog_prod_order_${tenantId}`, JSON.stringify(nextOrderedIds));
    } catch {}

    const rankById = new Map(nextOrderedIds.map((id, index) => [id, index + 1]));
    const changedRecords: SavedProductRecord[] = [];
    setAllProducts((prev) =>
      prev.map((item) => {
        const nextRank = rankById.get(item.id);
        if (nextRank !== undefined && item.sortOrder !== nextRank) {
          const updated = { ...item, sortOrder: nextRank, updatedAt: Date.now() };
          changedRecords.push(updated);
          return updated;
        }
        return item;
      })
    );

    if (changedRecords.length > 0) {
      Promise.all(changedRecords.map((rec) => tenantStorage.mutateProduct(rec))).catch(() => {});
      window.dispatchEvent(new CustomEvent('alshams_products_changed'));
    }

    if (tenantId) {
      saveWorkshopStoreLayout(tenantId, storeLayoutCols, nextOrderedIds, profile.email).catch(() => {});
    }

    if (feedbackMsg) {
      playSuccessSound();
      setNotice(feedbackMsg);
      setTimeout(() => setNotice(''), 3000);
    }
  };

  // Reorder individual products (Drag & Drop or Up/Down arrows)
  const handleReorderProducts = async (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const baseOrdered = [...allProducts]
      .sort((a, b) => (productPriorityRankMap.get(a.id) ?? 9999) - (productPriorityRankMap.get(b.id) ?? 9999))
      .map((p) => p.id);

    const fromIdx = baseOrdered.indexOf(sourceId);
    const toIdx = baseOrdered.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = baseOrdered.splice(fromIdx, 1);
    baseOrdered.splice(toIdx, 0, moved);
    const movedProd = allProducts.find((p) => p.id === sourceId);
    await persistProductPriorityOrder(
      baseOrdered,
      `✓ تم تحديث أولوية عرض "${movedProd?.productName || 'المنتج'}" في الكتالوج`
    );
  };

  const handleMoveProductStep = async (prodId: string, direction: -1 | 1) => {
    const visibleIdx = filteredProducts.findIndex((p) => p.id === prodId);
    const targetVisibleIdx = visibleIdx + direction;
    if (visibleIdx === -1 || targetVisibleIdx < 0 || targetVisibleIdx >= filteredProducts.length) return;
    await handleReorderProducts(prodId, filteredProducts[targetVisibleIdx].id);
  };

  // Reorder categories & regroup product priority accordingly
  const persistCategoryPriorityOrder = async (nextCategories: string[], movedCategoryName?: string) => {
    setCategoryOrder(nextCategories);
    try {
      localStorage.setItem(`alshams_catalog_cat_order_${tenantId}`, JSON.stringify(nextCategories));
    } catch {}

    const catRank = new Map(nextCategories.map((c, idx) => [c, idx]));
    const regroupedProductIds = [...allProducts]
      .sort((a, b) => {
        const ca = catRank.get(getCraftDisplay(a)) ?? Number.MAX_SAFE_INTEGER;
        const cb = catRank.get(getCraftDisplay(b)) ?? Number.MAX_SAFE_INTEGER;
        if (ca !== cb) return ca - cb;
        return (productPriorityRankMap.get(a.id) ?? 9999) - (productPriorityRankMap.get(b.id) ?? 9999);
      })
      .map((p) => p.id);

    await persistProductPriorityOrder(
      regroupedProductIds,
      `✓ تم إعادة ترتيب أولوية تصنيف "${movedCategoryName || 'التصنيفات'}" وتحديث ترتيب المنتجات`
    );
  };

  const handleReorderCategories = async (sourceCat: string, targetCat: string) => {
    if (!sourceCat || !targetCat || sourceCat === targetCat) return;
    const list = orderedCategories.map((c) => c.name);
    const fromIdx = list.indexOf(sourceCat);
    const toIdx = list.indexOf(targetCat);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    await persistCategoryPriorityOrder(list, sourceCat);
  };

  const handleMoveCategoryStep = async (catName: string, direction: -1 | 1) => {
    const list = orderedCategories.map((c) => c.name);
    const idx = list.indexOf(catName);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) return;
    await handleReorderCategories(catName, list[targetIdx]);
  };

  // Purely in-memory search and filtering (only items exported from Archive / visible in Catalog)
  const statusColorCounts = useMemo(() => {
    const counts = { red: 0, yellow: 0, green: 0 };
    catalogVisibleProducts.forEach((p) => {
      const st = getProductCatalogStatus(p);
      counts[st.color] += 1;
    });
    return counts;
  }, [catalogVisibleProducts]);

  const filteredProducts = useMemo(() => {
    let result = [...catalogVisibleProducts];

    // 0. Filter by 3-Color Status
    if (statusColorFilter !== 'all') {
      result = result.filter((p) => getProductCatalogStatus(p).color === statusColorFilter);
    }

    // 1. Filter by Main Section
    if (selectedMainSection !== 'all') {
      result = result.filter((p) => {
        const secName = getMainSectionDisplay(p);
        return p.mainSectionId === selectedMainSection || secName === selectedMainSection;
      });
    }

    // 2. Filter by Sub Section / Craft
    if (selectedCraft !== 'all') {
      result = result.filter((p) => {
        const craftName = getCraftDisplay(p);
        return (
          p.craftId === selectedCraft ||
          craftName === selectedCraft ||
          p.category === selectedCraft ||
          p.productType === selectedCraft
        );
      });
    }

    // 3. Search by Name or Number
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p, idx) => {
        const nameMatch = p.productName?.toLowerCase().includes(q);
        const codeMatch = p.productCode?.toLowerCase().includes(q);
        const serialStr = p.productSerialNumber ? String(p.productSerialNumber) : '';
        const serialMatch = serialStr.includes(q);
        const displaySerial = getProductSerialDisplay(p, idx).toLowerCase();
        const displayMatch = displaySerial.includes(q);
        const categoryMatch = typeof p.category === 'string' && p.category.toLowerCase().includes(q);
        const typeMatch = p.productType?.toLowerCase().includes(q);
        return Boolean(nameMatch || codeMatch || serialMatch || displayMatch || categoryMatch || typeMatch);
      });
    }

    // 4. Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'priority') {
        const rankA = productPriorityRankMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const rankB = productPriorityRankMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        comparison = rankA - rankB;
      } else if (sortBy === 'serial') {
        const serialA = a.productSerialNumber || 0;
        const serialB = b.productSerialNumber || 0;
        comparison = serialA - serialB;
      } else if (sortBy === 'name') {
        comparison = (a.productName || '').localeCompare(b.productName || '', 'ar');
      } else if (sortBy === 'costPrice') {
        comparison = getCostPrice(a) - getCostPrice(b);
      } else if (sortBy === 'wholesalePrice') {
        comparison = getWholesalePrice(a) - getWholesalePrice(b);
      } else if (sortBy === 'retailPrice') {
        comparison = getRetailPrice(a) - getRetailPrice(b);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [catalogVisibleProducts, selectedMainSection, selectedCraft, searchQuery, sortBy, sortOrder, productPriorityRankMap]);

  // Target products for exports/shares (selected products if any are selected, else all filtered)
  const targetProductsForExport = useMemo(() => {
    if (selectedIds.size > 0) {
      return filteredProducts.filter((p) => selectedIds.has(p.id));
    }
    return filteredProducts;
  }, [filteredProducts, selectedIds]);

  // Statistics calculation
  const catalogStats = useMemo(() => {
    const list = targetProductsForExport;
    const totalCount = list.length;
    const totalCost = list.reduce((sum, p) => sum + getCostPrice(p), 0);
    const totalWholesale = list.reduce((sum, p) => sum + getWholesalePrice(p), 0);
    const totalRetail = list.reduce((sum, p) => sum + getRetailPrice(p), 0);

    return {
      totalCount,
      totalCost,
      totalWholesale,
      totalRetail,
      avgRetail: totalCount > 0 ? Math.round(totalRetail / totalCount) : 0,
    };
  }, [targetProductsForExport]);

  // Selection toggle handlers
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const isAllSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;

  // Open Specs Modal
  const handleOpenEditSpecs = (record: SavedProductRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setEditFormData({
      productName: record.productName || '',
      productCode: record.productCode || (record.productSerialNumber ? `PRD-${record.productSerialNumber}` : ''),
      productType: record.productType || getMainSectionDisplay(record),
      category: (record.category as string) || getCraftDisplay(record),
      retailPrice: getRetailPrice(record),
      wholesalePrice: getWholesalePrice(record),
      costPrice: getCostPrice(record),
      imageUrl: record.imageUrl || record.input?.productImageUrl || '',
      widthCm: record.input?.widthCm || 0,
      heightCm: record.input?.totalLengthCm || record.input?.sideHeightCm || 0,
      diameterCm: record.input?.diameterCm || 0,
      fringeLengthCm: record.input?.fringeLengthCm || 0,
      materialsDescription: (record as any).materialsDescription || (record.input?.cordTypeId ? `خيط ${record.input.cordTypeId} سمك ${record.input.cordThicknessMm || 4} مم` : ''),
      colorVariants: (record as any).colorVariants || '',
      marketingDescription: (record as any).marketingDescription || record.input?.personalNotes || '',
      careInstructions: (record as any).careInstructions || 'تنظيف جاف أو مسح بقطعة قماش ناعمة وباردة',
      tags: Array.isArray((record as any).tags) ? (record as any).tags.join(', ') : ((record as any).tags || ''),
    });
  };

  // Save Specs Modifications to Dexie
  const handleSaveSpecs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      const updated: SavedProductRecord = {
        ...editingRecord,
        productName: editFormData.productName.trim() || editingRecord.productName,
        productCode: editFormData.productCode.trim() || editingRecord.productCode,
        productType: editFormData.productType.trim() || editingRecord.productType,
        category: editFormData.category.trim() || editingRecord.category,
        retailPrice: Number(editFormData.retailPrice) || editingRecord.retailPrice,
        wholesalePrice: Number(editFormData.wholesalePrice) || editingRecord.wholesalePrice,
        costPrice: Number(editFormData.costPrice) || editingRecord.costPrice,
        imageUrl: editFormData.imageUrl.trim() || editingRecord.imageUrl,
        updatedAt: Date.now(),
        input: {
          ...editingRecord.input,
          productName: editFormData.productName.trim() || editingRecord.input?.productName,
          widthCm: Number(editFormData.widthCm) || editingRecord.input?.widthCm,
          totalLengthCm: Number(editFormData.heightCm) || editingRecord.input?.totalLengthCm,
          diameterCm: Number(editFormData.diameterCm) || editingRecord.input?.diameterCm,
          fringeLengthCm: Number(editFormData.fringeLengthCm) || editingRecord.input?.fringeLengthCm,
          personalNotes: editFormData.marketingDescription.trim() || editingRecord.input?.personalNotes,
          productImageUrl: editFormData.imageUrl.trim() || editingRecord.input?.productImageUrl,
        },
      };

      // Attach custom specs fields
      (updated as any).materialsDescription = editFormData.materialsDescription.trim();
      (updated as any).colorVariants = editFormData.colorVariants.trim();
      (updated as any).marketingDescription = editFormData.marketingDescription.trim();
      (updated as any).careInstructions = editFormData.careInstructions.trim();
      (updated as any).tags = editFormData.tags.split(',').map((t) => t.trim()).filter(Boolean);

      await tenantStorage.mutateProduct(updated);

      // Update in memory state immediately
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

      setNotice(tr('catalog_save_specs') + ' - ' + updated.productName);
      setTimeout(() => setNotice(''), 3500);
      setEditingRecord(null);
    } catch (err: any) {
      console.error('Failed to update product specs:', err);
      setNotice('حدث خطأ أثناء حفظ التعديل: ' + (err.message || 'خطأ غير معروف'));
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // Return product to Archive-only (hide from Catalog without deleting Archive record)
  const handleHideFromCatalog = async (p: SavedProductRecord) => {
    try {
      const updated: SavedProductRecord = {
        ...p,
        isCatalogVisible: false,
        updatedAt: Date.now(),
      };
      await tenantStorage.mutateProduct(updated);
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      setNotice(`تمت إزالة "${p.productName}" من الكتالوج (تظل محفوظة ككارت صنف في الأرشيف).`);
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      console.error('Failed to hide product from catalog:', err);
    }
  };

  // =========================================================================
  // STORE MANAGEMENT LOGIC (قسم متجري ثم التصدير الصريح لسوق الشمساوية)
  // =========================================================================

  // Export product to My Store ONLY (does NOT auto-publish to Central Market, strictly prevents duplicates)
  const handleExportToStore = async (p: SavedProductRecord) => {
    const normName = String(p.productName || '').trim().toLowerCase();
    const alreadyDuplicateInStore = allProducts.some(
      (item) =>
        item.inStore &&
        (item.id === p.id || (normName && String(item.productName || '').trim().toLowerCase() === normName))
    );
    if (p.inStore || alreadyDuplicateInStore) {
      setNotice(`المشغولة "${p.productName}" موجودة بالفعل في متجرك الخاص (تم منع التكرار تلقائياً).`);
      setTimeout(() => setNotice(''), 3500);
      return;
    }

    try {
      const defaultPrice = p.storePrice || getRetailPrice(p);
      const defaultDesc =
        p.storeDescription ||
        (p as any).marketingDescription ||
        p.input?.personalNotes ||
        `مشغولة يدوية أصلية - ${p.productName}`;

      const updated: SavedProductRecord = {
        ...p,
        isCatalogVisible: true,
        inStore: true,
        isPublishedInStore: true,
        storePrice: defaultPrice,
        storeDescription: defaultDesc,
        updatedAt: Date.now(),
      };

      await tenantStorage.mutateProduct(updated);
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      publishProductToMarketplace(updated, profile).catch(() => {});

      const nextStatus = getProductCatalogStatus(updated);
      playSuccessSound();
      setNotice(
        nextStatus.color === 'yellow'
          ? `🟡 تم عرض "${p.productName}" في متجرك فوراً! اضغط على الشارة الصفراء في أي وقت لاستيراده في حاسبة التكاليف وتحويله للأخضر.`
          : `🟢 تم عرض "${p.productName}" في متجرك الخاص بنجاح!`
      );
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      console.error('Failed to export product to store:', err);
      setNotice('تعذر نقل المشغولة إلى متجري: ' + (err.message || 'خطأ غير معروف'));
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // Bulk Export selected products or filtered catalog items to My Store ONLY (skips duplicates)
  const handleBulkExportToStore = async () => {
    const rawTargets = selectedIds.size > 0
      ? catalogVisibleProducts.filter((p) => selectedIds.has(p.id))
      : filteredProducts;

    if (rawTargets.length === 0) return;

    const existingStoreNames = new Set(
      allProducts
        .filter((x) => x.inStore)
        .map((x) => String(x.productName || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const seenBatchNames = new Set<string>();
    const targets = rawTargets.filter((p) => {
      if (p.inStore) return false;
      const n = String(p.productName || '').trim().toLowerCase();
      if (n && (existingStoreNames.has(n) || seenBatchNames.has(n))) return false;
      if (n) seenBatchNames.add(n);
      return true;
    });

    if (targets.length === 0) {
      setNotice('كل المنتجات المختارة معروضة بالفعل في متجرك الخاص (لم يتم إنشاء أي تكرار).');
      setTimeout(() => setNotice(''), 3500);
      setSelectedIds(new Set());
      return;
    }

    try {
      const updatedRecords: SavedProductRecord[] = [];
      for (const p of targets) {
        const defaultPrice = p.storePrice || getRetailPrice(p);
        const defaultDesc =
          p.storeDescription ||
          (p as any).marketingDescription ||
          p.input?.personalNotes ||
          `مشغولة يدوية أصلية - ${p.productName}`;

        const updated: SavedProductRecord = {
          ...p,
          isCatalogVisible: true,
          inStore: true,
          isPublishedInStore: true,
          storePrice: defaultPrice,
          storeDescription: defaultDesc,
          updatedAt: Date.now(),
        };
        await tenantStorage.mutateProduct(updated);
        updatedRecords.push(updated);
      }

      const updatedMap = new Map(updatedRecords.map((t) => [t.id, t]));
      setAllProducts((prev) =>
        prev.map((item) => updatedMap.get(item.id) || item)
      );
      playSuccessSound();
      const skipped = rawTargets.length - targets.length;
      setNotice(
        skipped > 0
          ? `✓ تم نقل (${targets.length}) منتج جديد لمتجرك، وتم تخطي (${skipped}) موجود مسبقاً لمنع التكرار.`
          : `✓ تم نقل (${targets.length}) مشغولة إلى متجرك الخاص 🏪 (جاهزة للتصدير لسوق الشمساوية من تبويب متجري)`
      );
      setTimeout(() => setNotice(''), 4500);
      setSelectedIds(new Set());
    } catch (err: any) {
      setNotice('تعذر النقل الجماعي للمتجر: ' + (err.message || 'خطأ غير معروف'));
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // Toggle publish status in store
  const handleTogglePublishInStore = async (p: SavedProductRecord) => {
    try {
      const current = p.isPublishedInStore !== false;
      const updated: SavedProductRecord = {
        ...p,
        isPublishedInStore: !current,
        updatedAt: Date.now(),
      };
      await tenantStorage.mutateProduct(updated);
      if (updated.inMarket && updated.isPublishedInStore) {
        publishProductToMarketplace(updated, profile).catch(() => {});
      }
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(
        !current
          ? `تم تفعيل نشر "${p.productName}" في المتجر للعملاء`
          : `تم إيقاف نشر "${p.productName}" (محفوظ كمسودة في المتجر)`
      );
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      console.error('Failed to toggle publish status in store:', err);
    }
  };

  // Save Store marketing price and description — resets Market approval to pending_approval if item is already in Market
  const handleSaveStoreProductDetails = async (
    p: SavedProductRecord,
    newPrice: number,
    newDesc: string
  ) => {
    try {
      const wasInMarket = Boolean(p.inMarket || marketStatusMap[p.id]);
      const updated: SavedProductRecord = {
        ...p,
        storePrice: Number(newPrice) > 0 ? Number(newPrice) : getRetailPrice(p),
        storeDescription: newDesc.trim(),
        isMarketplaceApproved: wasInMarket ? false : p.isMarketplaceApproved,
        marketStatus: wasInMarket ? 'pending_approval' : p.marketStatus,
        updatedAt: Date.now(),
      };
      await tenantStorage.mutateProduct(updated);
      if (wasInMarket) {
        setMarketStatusMap((prev) => ({ ...prev, [p.id]: 'pending_approval' }));
        publishProductToMarketplace(updated, profile, { reSubmitForApproval: true }).catch(() => {});
      }
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      playSuccessSound();
      setNotice(
        wasInMarket
          ? `✓ تم حفظ تعديلات "${p.productName}" وإعادة إرسالها لمراجعة الأدمن قبل الظهور في سوق الشمساوية.`
          : `✓ تم حفظ تعديلات العرض في المتجر لمشغولة "${p.productName}" بنجاح!`
      );
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      console.error('Failed to update store details:', err);
      setNotice('حدث خطأ أثناء حفظ بيانات المتجر.');
      setTimeout(() => setNotice(''), 3000);
    }
  };

  // Show 3-second waiting admin approval banner
  const triggerPendingAdminBanner = (productName?: string) => {
    if (pendingBannerTimerRef.current) {
      window.clearTimeout(pendingBannerTimerRef.current);
    }
    setPendingBannerMessage(
      productName
        ? `هذا المنتج في انتظار مراجعة الأدمن (${productName})`
        : 'هذا المنتج في انتظار مراجعة الأدمن'
    );
    pendingBannerTimerRef.current = window.setTimeout(() => {
      setPendingBannerMessage('');
    }, 3000);
  };

  // Resolve market status for a product
  const getProductMarketStatus = (p: SavedProductRecord): 'none' | 'pending_approval' | 'approved' | 'rejected' => {
    const cloudSt = marketStatusMap[p.id];
    if (cloudSt) return cloudSt;
    if (p.marketStatus) return p.marketStatus;
    if (p.inMarket) return p.isMarketplaceApproved ? 'approved' : 'pending_approval';
    return 'none';
  };

  // Explicit single export from My Store -> Central Market (سوق الشمساوية)
  const handleExportProductToMarket = async (p: SavedProductRecord) => {
    try {
      const updated: SavedProductRecord = {
        ...p,
        inStore: true,
        isPublishedInStore: true,
        inMarket: true,
        isMarketplaceApproved: false,
        marketStatus: 'pending_approval',
        storePrice: p.storePrice || getRetailPrice(p),
        updatedAt: Date.now(),
      };
      await tenantStorage.mutateProduct(updated);
      setMarketStatusMap((prev) => ({ ...prev, [p.id]: 'pending_approval' }));
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      publishProductToMarketplace(updated, profile, { reSubmitForApproval: true }).catch(() => {});
      playSuccessSound();
      triggerPendingAdminBanner(p.productName);
    } catch (err: any) {
      setNotice('تعذر إرسال المنتج لسوق الشمساوية: ' + (err.message || 'خطأ غير معروف'));
      setTimeout(() => setNotice(''), 3500);
    }
  };

  // Bulk export selected (or non-approved) products from My Store -> Central Market
  const handleBulkExportStoreToMarket = async () => {
    const targets = selectedStoreMarketIds.size > 0
      ? storeProducts.filter((p) => selectedStoreMarketIds.has(p.id))
      : storeProducts.filter((p) => getProductMarketStatus(p) !== 'approved');

    if (targets.length === 0) return;

    try {
      const nextStatusMap: Record<string, 'pending_approval'> = {};
      const updatedMap = new Map<string, SavedProductRecord>();
      for (const p of targets) {
        const updated: SavedProductRecord = {
          ...p,
          inStore: true,
          isPublishedInStore: true,
          inMarket: true,
          isMarketplaceApproved: false,
          marketStatus: 'pending_approval',
          storePrice: p.storePrice || getRetailPrice(p),
          updatedAt: Date.now(),
        };
        await tenantStorage.mutateProduct(updated);
        updatedMap.set(updated.id, updated);
        nextStatusMap[updated.id] = 'pending_approval';
        publishProductToMarketplace(updated, profile, { reSubmitForApproval: true }).catch(() => {});
      }
      setMarketStatusMap((prev) => ({ ...prev, ...nextStatusMap }));
      setAllProducts((prev) => prev.map((item) => updatedMap.get(item.id) || item));
      setSelectedStoreMarketIds(new Set());
      playSuccessSound();
      setNotice(`✓ تم إرسال (${targets.length}) منتج لسوق الشمساوية العام وبانتظار مراجعة واعتماد الأدمن.`);
      setTimeout(() => setNotice(''), 4500);
    } catch (err: any) {
      setNotice('تعذر التصدير الجماعي لسوق الشمساوية: ' + (err.message || 'خطأ غير معروف'));
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // Remove from store
  const handleRemoveFromStore = async (p: SavedProductRecord) => {
    try {
      const updated: SavedProductRecord = {
        ...p,
        inStore: false,
        isPublishedInStore: false,
        inMarket: false,
        marketStatus: 'none',
        isMarketplaceApproved: false,
        updatedAt: Date.now(),
      };
      await tenantStorage.mutateProduct(updated);
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(`تم إزالة "${p.productName}" من متجرك.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      console.error('Failed to remove from store:', err);
    }
  };

  // Export official PDF quotation for a specific product
  const [exportingQuoteId, setExportingQuoteId] = useState<string | null>(null);
  const handleExportProductQuotation = async (p: SavedProductRecord) => {
    setExportingQuoteId(p.id);
    try {
      const qData = extractQuotationDataFromRecord(p);
      await generateArtisanQuotationPDF(qData, profile);
      setNotice(`تم توليد وتحميل عرض السعر الرسمي لـ "${p.productName}" بنجاح 📄✨`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      console.error('Failed to export product quotation:', err);
    } finally {
      setExportingQuoteId(null);
    }
  };

  // Share store product via WhatsApp
  const handleShareStoreProduct = (p: SavedProductRecord) => {
    const price = p.storePrice || getRetailPrice(p);
    const desc = p.storeDescription || (p as any).marketingDescription || p.productName;
    const craft = getCraftDisplay(p);
    const brand = profile.brandName ? `ورشة ${profile.brandName}` : 'منظومة الشمساوية للفنون والأعمال اليدوية';

    let text = `✨ *معروض في متجر ${brand}* ✨\n\n`;
    text += `🏷️ *اسم المشغولة:* ${p.productName}\n`;
    text += `🧶 *الحرفة والتصنيف:* ${craft}\n`;
    text += `💰 *السعر:* ${price} ${profile.currencySymbol}\n`;
    if (desc) {
      text += `📝 *الوصف والمواصفات:* ${desc}\n`;
    }
    text += `\n📞 للطلب والتواصل مع الورشة يسعدنا خدمتكم دائماً!`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Store products filtered & ordered by artisan priority
  const storeProducts = useMemo(() => {
    return allProducts
      .filter((p) => {
        if (!p.inStore) return false;
        if (storeStatusFilter === 'published' && p.isPublishedInStore === false) return false;
        if (storeStatusFilter === 'draft' && p.isPublishedInStore !== false) return false;
        if (storeSearchQuery.trim()) {
          const q = storeSearchQuery.trim().toLowerCase();
          const name = (p.productName || '').toLowerCase();
          const code = (p.productCode || '').toLowerCase();
          const desc = (p.storeDescription || '').toLowerCase();
          return name.includes(q) || code.includes(q) || desc.includes(q);
        }
        return true;
      })
      .sort((a, b) => (productPriorityRankMap.get(a.id) ?? 9999) - (productPriorityRankMap.get(b.id) ?? 9999));
  }, [allProducts, storeStatusFilter, storeSearchQuery, productPriorityRankMap]);

  // PDF Export Function
  const handleExportPDF = async () => {
    if (!printTemplateRef.current || targetProductsForExport.length === 0) {
      setNotice('لا توجد منتجات معروضة للتصدير.');
      setTimeout(() => setNotice(''), 3000);
      return;
    }

    setIsExportingPdf(true);
    setNotice('جاري إنشاء ملف PDF للكتالوج بدقة عالية...');

    try {
      const templateEl = printTemplateRef.current;
      templateEl.style.display = 'block';

      const canvas = await html2canvas(templateEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      templateEl.style.display = 'none';

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add remaining pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `كتالوج_${profile.brandName || 'الورشة'}_${selectedIds.size > 0 ? `مختار_${selectedIds.size}` : 'كامل'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      setNotice('تم تصدير كتالوج الورشة بصيغة PDF بنجاح!');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setNotice('حدث خطأ أثناء تصدير ملف PDF: ' + (err.message || ''));
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setIsExportingPdf(false);
      if (printTemplateRef.current) {
        printTemplateRef.current.style.display = 'none';
      }
    }
  };

  // WhatsApp Multi-Item Share
  const handleShareWhatsApp = () => {
    const items = targetProductsForExport;
    if (items.length === 0) return;

    let text = `🌟 *كتالوج منتجات ورشة ${profile.brandName || 'الحرفية'}*\n`;
    text += `👤 *الفنان:* ${profile.artistName || ''}\n`;
    text += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    items.forEach((p, idx) => {
      const wholesale = getWholesalePrice(p);
      const retail = getRetailPrice(p);
      const serial = getProductSerialDisplay(p, idx);
      const type = getMainSectionDisplay(p);
      const category = getCraftDisplay(p);

      text += `📦 *[${idx + 1}] ${p.productName}*\n`;
      text += `▫️ كود الصنف: ${serial}\n`;
      text += `▫️ النوع والتصنيف: ${type} - ${category}\n`;
      if (p.input?.widthCm || p.input?.totalLengthCm) {
        text += `▫️ المقاس: ${p.input.widthCm || 0}×${p.input.totalLengthCm || p.input.sideHeightCm || 0} سم\n`;
      }
      text += `💰 سعر القطاعي: *${retail} ${profile.currencySymbol}*\n`;
      text += `🏷️ سعر الجملة: *${wholesale} ${profile.currencySymbol}*\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📞 للتواصل والطلب: ${profile.phoneNumber || ''}\n`;
    text += `✨ صادر عبر منظومة الشمساوية للبرمجيات الحرفية`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Facebook & Social Share (uses dedicated /product/:id landing URL or workshop store URL)
  const handleShareFacebook = async () => {
    const items = targetProductsForExport;
    if (items.length === 0) return;

    const singleProduct = items.length === 1 ? items[0] : null;
    const storeSlug =
      profile.storeSlug ||
      profile.store_slug ||
      profile.brandName?.toLowerCase().replace(/\s+/g, '-') ||
      profile.id;
    const shareUrl = singleProduct
      ? buildProductLandingUrl(singleProduct.id)
      : buildStoreUrl(storeSlug);
    const shareTitle = singleProduct
      ? `${singleProduct.productName} | ${profile.brandName || 'ورشة الشمساوية'}`
      : `كتالوج منتجات ورشة ${profile.brandName || 'الحرفية'}`;
    const shareText = singleProduct
      ? `${singleProduct.productName} — ${getRetailPrice(singleProduct)} ${profile.currencySymbol || 'ج.م'} من ${profile.brandName || 'ورشة الشمساوية'}`
      : `تفضلوا بالاطلاع على تشكيلة المشغولات اليدوية الحصرية من ورشة ${profile.brandName || ''} (${items.length} منتج)`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setNotice('تم نسخ رابط المشاركة المباشر (يظهر بصورة المنتج وسعره عند لصقه في فيسبوك وواتساب).');
    } catch {
      setNotice(`رابط المشاركة: ${shareUrl}`);
    }
    setTimeout(() => setNotice(''), 4500);
  };

  if (isDirectAddOpen) {
    return (
      <DirectCatalogProductPage
        isOpen={true}
        onClose={() => setIsDirectAddOpen(false)}
        profile={profile}
        defaultPublishToStore={activeTab === 'store'}
        onSaved={(newRecord) => {
          setAllProducts((prev) => [newRecord, ...prev.filter((x) => x.id !== newRecord.id)]);
          playSuccessSound();
          setNotice(
            newRecord.inStore
              ? `تم إضافة "${newRecord.productName}" وعرضه بمتجرك فوراً!`
              : `تم حفظ "${newRecord.productName}" في الكتالوج بنجاح!`
          );
          setTimeout(() => setNotice(''), 4500);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Dedicated Catalog Action Bar (No duplicate My Store tab, no giant intro banner) */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDirectAddOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="إضافة منتج مباشر للكتالوج أو المتجر فوراً"
          >
            <Plus className="w-4 h-4" />
            <span>منتج مباشر</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPdf || targetProductsForExport.length === 0}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? 'جاري التجهيز...' : 'PDF'}</span>
          </button>

          {onOpenMyStore && (
            <button
              type="button"
              onClick={onOpenMyStore}
              className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>لوحة متجري</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={async () => {
              setIsSyncing(true);
              try {
                const wid = profile.tenantId || profile.workshopId || profile.id || '';
                await flushProductSync(wid).catch(() => 0);
                await flushOfflineMutations().catch(() => {});
                const summary = await syncAllWorkshopProductsAndStore(profile);
                await loadCatalogData();
                setPendingSyncCount(summary.pendingRemaining);
                playSuccessSound();
                setNotice(
                  summary.pendingRemaining === 0
                    ? `تمت المزامنة بنجاح (${catalogVisibleProducts.length} منتج)`
                    : `تم الحفظ محلياً مع بقاء (${summary.pendingRemaining}) عملية بالانتظار.`
                );
                setTimeout(() => setNotice(''), 4000);
              } catch {
                playAlertSound();
              } finally {
                setIsSyncing(false);
              }
            }}
            disabled={isSyncing}
            className="px-2.5 py-2 rounded-xl border border-amber-400/70 dark:border-amber-700 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-black transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="مزامنة مع السحابة"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>مزامنة</span>
            {pendingSyncCount > 0 && (
              <span className="px-1.5 rounded-full text-[10px] font-mono bg-amber-600 text-white font-black">
                {pendingSyncCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={targetProductsForExport.length === 0}
            className="p-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-45"
            title="مشاركة عبر واتساب"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleShareFacebook}
            disabled={targetProductsForExport.length === 0}
            className="p-2 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition cursor-pointer disabled:opacity-45"
            title="مشاركة على فيسبوك"
          >
            <Facebook className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={loadCatalogData}
            title="تحديث"
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notice Message */}
      {notice && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. REFERENCE CATALOG VIEW (الكتالوج المرجعي للمشغولات) */}
      {/* ================================================================= */}
      {activeTab === 'catalog' && (
        <>
          {/* Selection Control Bar if any items selected */}
      {selectedIds.size > 0 && (
        <div className="p-3.5 px-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-400 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-amber-600 text-white font-black">
              {tr('catalog_selected_badge').replace('{count}', String(selectedIds.size))}
            </span>
            <span className="text-stone-600 dark:text-stone-300 font-bold">
              (من إجمالي {filteredProducts.length} معروض)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>مشاركة واتساب ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير PDF ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold cursor-pointer transition"
            >
              {tr('catalog_deselect_all')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Search & Filters Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="lg:col-span-5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم المنتج، كود الصنف، أو النوع..."
              className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* Filter 1: القسم الأساسي */}
          <div className="lg:col-span-3">
            <div className="relative">
              <select
                value={selectedMainSection}
                onChange={(e) => setSelectedMainSection(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
              >
                <option value="all">كافة الأقسام الأساسية (الكل)</option>
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.nameAr}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: الحرفة الفرعية */}
          <div className="lg:col-span-3">
            <div className="relative">
              <select
                value={selectedCraft}
                onChange={(e) => setSelectedCraft(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
              >
                <option value="all">كافة الحِرف الفرعية (الكل)</option>
                {subCraftOptions.map((craft) => (
                  <option key={craft.id} value={craft.id}>
                    {craft.nameAr}
                  </option>
                ))}
              </select>
              <Layers className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Reset Filters */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedMainSection('all');
                setSelectedCraft('all');
                setSelectedIds(new Set());
              }}
              title="إعادة ضبط الفلاتر"
              className="p-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1 text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Catalog summary indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
          <div className="flex items-center gap-2 text-stone-500">
            <span>النتائج المعروضة:</span>
            <span className="font-mono font-black text-amber-700 dark:text-amber-400">
              {filteredProducts.length}
            </span>
            <span>من إجمالي {catalogVisibleProducts.length} منتج في الكتالوج</span>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400">ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-[11px] font-bold text-stone-700 dark:text-stone-300 outline-none"
            >
              <option value="priority">أولوية العرض (السحب والإفلات)</option>
              <option value="serial">رقم وكود الصنف</option>
              <option value="name">اسم المنتج</option>
              <option value="retailPrice">سعر القطاعي</option>
              <option value="wholesalePrice">سعر الجملة</option>
              <option value="costPrice">التكلفة</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Priority Drag & Drop Strip */}
      {orderedCategories.length > 0 && (
        <div className="p-4 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
              <GripVertical className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>ترتيب أولوية تصنيفات الكتالوج (اسحب وأفلت التصنيف لتعديل أولوية العرض)</span>
            </div>
            <span className="text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1]">
              {orderedCategories.length} تصنيف نشط
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {orderedCategories.map((cat, idx) => {
              const isDraggingCat = draggedCategory === cat.name;
              const isDropTargetCat = dragOverCategory === cat.name && draggedCategory !== cat.name;
              const isActiveFilter = selectedCraft === cat.name;

              return (
                <div
                  key={cat.name}
                  draggable
                  onDragStart={(e) => {
                    setDraggedCategory(cat.name);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', cat.name);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverCategory !== cat.name) setDragOverCategory(cat.name);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const src = draggedCategory || e.dataTransfer.getData('text/plain');
                    setDraggedCategory(null);
                    setDragOverCategory(null);
                    if (src && src !== cat.name) {
                      await handleReorderCategories(src, cat.name);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedCategory(null);
                    setDragOverCategory(null);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl border text-xs font-black transition cursor-grab active:cursor-grabbing select-none ${
                    isDraggingCat
                      ? 'opacity-50 scale-95 border-[#EA580C]'
                      : isDropTargetCat
                      ? 'ring-2 ring-[#EA580C] scale-105 bg-amber-100 dark:bg-amber-950/50 border-[#EA580C]'
                      : isActiveFilter
                      ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                      : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                  }`}
                >
                  <GripVertical className={`w-3.5 h-3.5 shrink-0 ${isActiveFilter ? 'text-white/90' : 'text-[#EA580C] dark:text-[#FBBF24]'}`} />
                  <span className="font-mono text-[10px] opacity-75">#{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCraft(selectedCraft === cat.name ? 'all' : cat.name)}
                    className="cursor-pointer font-black"
                    title="تصفية الكتالوج بهذا التصنيف"
                  >
                    {cat.name}
                  </button>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActiveFilter ? 'bg-white/20 text-white' : 'bg-[#F7F3EA] dark:bg-[#060B18] text-[#C2410C] dark:text-[#FBBF24]'}`}>
                    {cat.count}
                  </span>
                  <div className="flex items-center gap-0.5 mr-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveCategoryStep(cat.name, -1);
                      }}
                      title="تقديم التصنيف للأعلى"
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedCategories.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveCategoryStep(cat.name, 1);
                      }}
                      title="تأخير التصنيف للأسفل"
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Export to Store Action Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-600/15 via-amber-500/10 to-transparent border border-amber-500/30">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
          <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>
            {selectedIds.size > 0
              ? `محدد حالياً (${selectedIds.size}) مشغولة للتصدير المباشر`
              : selectedCraft !== 'all' || selectedMainSection !== 'all'
              ? `المعروض في هذا التصنيف (${filteredProducts.length}) مشغولة جاهزة للتصدير`
              : `تصدير جماعي لمتجر الورشة (${filteredProducts.length} مشغولة)`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-3 py-1.5 rounded-xl border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-bold hover:bg-amber-500/10 transition cursor-pointer"
          >
            {isAllSelected ? 'إلغاء تحديد الكل' : 'تحديد كافة الأصناف المعروضة'}
          </button>

          <button
            type="button"
            onClick={handleBulkExportToStore}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>تصدير إلى متجري 🏪 ({selectedIds.size > 0 ? selectedIds.size : filteredProducts.length})</span>
          </button>
        </div>
      </div>

      {/* 3. Catalog Content: Responsive Table on Desktop, Cards on Mobile */}
      {loading ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-600 mb-2" />
          <p className="text-xs font-bold text-stone-500">جاري تحميل سجلات منتجات الكتالوج...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-black text-stone-800 dark:text-stone-200">
            لم يتم العثور على منتجات مطابقة للبحث أو الفلتر
          </h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            يمكنك إضافة أول منتج مباشر الآن والبدء بالبيع فوراً، أو استيراده لاحقاً في حاسبة التكاليف بضغطة واحدة.
          </p>
          <button
            type="button"
            onClick={() => setIsDirectAddOpen(true)}
            className="mx-auto px-5 py-2.5 rounded-2xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>منتج مباشر</span>
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW - Exact requested column structure */}
          <div className="hidden md:block rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 font-black">
                    {/* Priority Drag Handle Column */}
                    <th className="py-3.5 px-2 text-center w-16">الأولوية</th>
                    {/* Checkbox Select All */}
                    <th className="py-3.5 px-3 text-center w-10">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        title={isAllSelected ? tr('catalog_deselect_all') : tr('catalog_select_all')}
                        className="p-1 text-stone-600 dark:text-stone-300 hover:text-amber-600 transition"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : selectedIds.size > 0 ? (
                          <div className="w-4 h-4 rounded border-2 border-amber-600 bg-amber-600/20 flex items-center justify-center text-[10px] text-amber-700 font-bold">
                            -
                          </div>
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    {/* 1. نوع المنتج */}
                    <th className="py-3.5 px-4">{tr('catalog_table_type')}</th>
                    {/* 2. تصنيف المنتج */}
                    <th className="py-3.5 px-4">{tr('catalog_table_category')}</th>
                    {/* 3. اسم المنتج */}
                    <th className="py-3.5 px-4">{tr('catalog_table_name')}</th>
                    {/* 4. كود الصنف */}
                    <th className="py-3.5 px-4 text-center font-mono">{tr('catalog_table_code')}</th>
                    {/* 5. صورة المنتج */}
                    <th className="py-3.5 px-4 text-center">{tr('catalog_table_image')}</th>
                    {/* 6. تسعيرة جملة */}
                    <th className="py-3.5 px-4 text-center font-mono text-emerald-700 dark:text-emerald-400">
                      {tr('catalog_table_wholesale')}
                    </th>
                    {/* 7. تسعيرة قطاعي */}
                    <th className="py-3.5 px-4 text-center font-mono text-amber-700 dark:text-amber-400">
                      {tr('catalog_table_retail')}
                    </th>
                    {/* 8. الإجراءات */}
                    <th className="py-3.5 px-4 text-center">{tr('catalog_table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredProducts.map((p, idx) => {
                    const wholesale = getWholesalePrice(p);
                    const retail = getRetailPrice(p);
                    const code = getProductSerialDisplay(p, idx);
                    const mainType = getMainSectionDisplay(p);
                    const category = getCraftDisplay(p);
                    const isSelected = selectedIds.has(p.id);
                    const imgUrl = p.imageUrl || p.input?.productImageUrl;
                    const isDraggingRow = draggedProductId === p.id;
                    const isDragOverRow = dragOverProductId === p.id && draggedProductId !== p.id;
                    const statusInfo = getProductCatalogStatus(p);

                    return (
                      <tr
                        key={p.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedProductId(p.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', p.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverProductId !== p.id) setDragOverProductId(p.id);
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const srcId = draggedProductId || e.dataTransfer.getData('text/plain');
                          setDraggedProductId(null);
                          setDragOverProductId(null);
                          if (srcId && srcId !== p.id) {
                            await handleReorderProducts(srcId, p.id);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedProductId(null);
                          setDragOverProductId(null);
                        }}
                        onClick={() => handleOpenEditSpecs(p)}
                        className={`transition cursor-pointer group ${
                          isDraggingRow
                            ? 'opacity-45 bg-amber-500/15'
                            : isDragOverRow
                            ? 'border-t-2 border-[#EA580C] bg-amber-500/15 dark:bg-amber-950/40'
                            : isSelected
                            ? 'bg-amber-500/10 dark:bg-amber-950/30'
                            : 'hover:bg-amber-50/50 dark:hover:bg-stone-800/40'
                        }`}
                      >
                        {/* Drag & Drop Priority Controls */}
                        <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className="p-1 text-[#EA580C] dark:text-[#FBBF24] cursor-grab active:cursor-grabbing"
                              title="اسحب وأفلت لتغيير أولوية المنتج"
                            >
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveProductStep(p.id, -1)}
                                title="رفع للأعلى"
                                className="p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 disabled:opacity-25 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === filteredProducts.length - 1}
                                onClick={() => handleMoveProductStep(p.id, 1)}
                                title="تنزيل للأسفل"
                                className="p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 disabled:opacity-25 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center" onClick={(e) => handleToggleSelect(p.id, e)}>
                          <button
                            type="button"
                            className="p-1 text-stone-400 hover:text-amber-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* 1. نوع المنتج */}
                        <td className="py-3 px-4 font-bold text-stone-700 dark:text-stone-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-stone-400" />
                            <span>{mainType}</span>
                          </span>
                        </td>

                        {/* 2. تصنيف المنتج */}
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 text-[11px] font-bold">
                            {category}
                          </span>
                        </td>

                        {/* 3. اسم المنتج + حالة الـ 3 ألوان */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span className="font-extrabold text-stone-900 dark:text-stone-100 block group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                              {p.productName}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (statusInfo.color === 'red') handleExportToStore(p);
                                  else if (statusInfo.color === 'yellow') onSelectRecordToLoad(p);
                                }}
                                title={statusInfo.actionHint}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-black transition ${
                                  statusInfo.color !== 'green' ? 'cursor-pointer' : 'cursor-default'
                                } ${statusInfo.badgeClass}`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${statusInfo.dotClass}`} />
                                <span>{statusInfo.shortLabel}</span>
                              </button>
                              {p.videoUrl && (
                                <ProductVideoThumbnail
                                  videoUrl={p.videoUrl}
                                  fallbackImage={imgUrl}
                                  title={p.productName}
                                  compact
                                />
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 4. كود الصنف */}
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px]">
                            {code}
                          </span>
                        </td>

                        {/* 5. صورة المنتج */}
                        <td className="py-3 px-4 text-center">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={p.productName}
                              className="w-10 h-10 rounded-xl object-cover border border-stone-200 dark:border-stone-700 mx-auto shadow-xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 mx-auto border border-dashed border-stone-300 dark:border-stone-700">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* 6. تسعيرة جملة */}
                        <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {wholesale} {profile.currencySymbol}
                        </td>

                        {/* 7. تسعيرة قطاعي */}
                        <td className="py-3 px-4 text-center font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                          {retail} {profile.currencySymbol}
                        </td>

                        {/* 8. الإجراءات */}
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleExportToStore(p)}
                              title={p.inStore ? 'المشغولة معروضة في متجري' : 'تصدير إلى متجري'}
                              className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                                p.inStore
                                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950/40'
                              }`}
                            >
                              <Store className="w-3.5 h-3.5" />
                              <span className="text-[10px] hidden xl:inline">
                                {p.inStore ? 'في متجري' : 'تصدير إلى متجري'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSpecs(p)}
                              title={tr('catalog_edit_specs')}
                              className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectRecordToLoad(p)}
                              title="فتح في الحاسبة للتسعير"
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition cursor-pointer"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={exportingQuoteId === p.id}
                              onClick={() => handleExportProductQuotation(p)}
                              title="تصدير عرض سعر رسمي PDF 📄✨"
                              className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
                            >
                              {exportingQuoteId === p.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenWhatsAppShare(p)}
                              title="مشاركة عرض سعر واتساب"
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHideFromCatalog(p)}
                              title="إزالة من الكتالوج فقط (تبقى في الأرشيف)"
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Table Footer Totals */}
            <div className="p-4 bg-stone-50 dark:bg-stone-800/70 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-300">
              <div>
                <span>إجمالي الأصناف المعروضة: </span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-black">
                  {catalogStats.totalCount}
                </span>
                {selectedIds.size > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 font-bold mr-2">
                    (المحدد: {selectedIds.size})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-stone-400 text-[11px]">مجموع التكاليف: </span>
                  <span className="font-mono">{catalogStats.totalCost} {profile.currencySymbol}</span>
                </div>
                <div>
                  <span className="text-emerald-600 text-[11px]">مجموع الجملة: </span>
                  <span className="font-mono text-emerald-600">{catalogStats.totalWholesale} {profile.currencySymbol}</span>
                </div>
                <div>
                  <span className="text-amber-600 text-[11px]">مجموع القطاعي: </span>
                  <span className="font-mono text-amber-600">{catalogStats.totalRetail} {profile.currencySymbol}</span>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE CARDS VIEW */}
          <div className="md:hidden space-y-3">
            {filteredProducts.map((p, idx) => {
              const wholesale = getWholesalePrice(p);
              const retail = getRetailPrice(p);
              const code = getProductSerialDisplay(p, idx);
              const mainType = getMainSectionDisplay(p);
              const category = getCraftDisplay(p);
              const isSelected = selectedIds.has(p.id);
              const imgUrl = p.imageUrl || p.input?.productImageUrl;
              const isDraggingCard = draggedProductId === p.id;
              const isDropTargetCard = dragOverProductId === p.id && draggedProductId !== p.id;
              const statusInfo = getProductCatalogStatus(p);

              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedProductId(p.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', p.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverProductId !== p.id) setDragOverProductId(p.id);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const srcId = draggedProductId || e.dataTransfer.getData('text/plain');
                    setDraggedProductId(null);
                    setDragOverProductId(null);
                    if (srcId && srcId !== p.id) {
                      await handleReorderProducts(srcId, p.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedProductId(null);
                    setDragOverProductId(null);
                  }}
                  onClick={() => handleOpenEditSpecs(p)}
                  className={`p-4 rounded-3xl border shadow-sm space-y-3 transition cursor-pointer ${statusInfo.borderAccentClass} ${
                    isDraggingCard
                      ? 'opacity-50 border-[#EA580C]'
                      : isDropTargetCard
                      ? 'ring-2 ring-[#EA580C] bg-amber-500/10 border-[#EA580C]'
                      : isSelected
                      ? 'bg-amber-500/10 border-amber-400 dark:border-amber-700'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {/* Top Bar: Drag Handle, Reorder Arrows, Checkbox & Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span
                        className="p-1 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] text-[#EA580C] dark:text-[#FBBF24] cursor-grab active:cursor-grabbing"
                        title="اسحب وأفلت لتغيير الأولوية"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveProductStep(p.id, -1)}
                        title="رفع للأعلى"
                        className="p-1 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === filteredProducts.length - 1}
                        onClick={() => handleMoveProductStep(p.id, 1)}
                        title="تنزيل للأسفل"
                        className="p-1 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(p.id, e)}
                        className="flex items-center gap-1.5 p-1 text-xs font-bold text-stone-700 dark:text-stone-300"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-400" />
                        )}
                        <span className="font-mono text-stone-900 dark:text-stone-100">{code}</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        {mainType}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                        {category}
                      </span>
                    </div>
                  </div>

                  {/* Body: Image & Name */}
                  <div className="flex items-start gap-3 pt-1">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.productName}
                        className="w-14 h-14 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 border border-dashed border-stone-300 dark:border-stone-700 flex-shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-sm text-stone-900 dark:text-stone-100 leading-snug">
                        {p.productName}
                      </h4>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        كود: {code} • {mainType}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (statusInfo.color === 'red') handleExportToStore(p);
                            else if (statusInfo.color === 'yellow') onSelectRecordToLoad(p);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-black transition ${
                            statusInfo.color !== 'green' ? 'cursor-pointer' : 'cursor-default'
                          } ${statusInfo.badgeClass}`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${statusInfo.dotClass}`} />
                          <span>
                            {statusInfo.color === 'red'
                              ? 'أحمر · اضغط للعرض بالمتجر'
                              : statusInfo.color === 'yellow'
                              ? 'أصفر · اضغط لحساب التكلفة'
                              : 'أخضر · مسعّر وبالمتجر ✓'}
                          </span>
                        </button>
                        {p.videoUrl && (
                          <ProductVideoThumbnail
                            videoUrl={p.videoUrl}
                            fallbackImage={imgUrl}
                            title={p.productName}
                            compact
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing 2-Box Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 text-center font-mono">
                    <div className="p-1 border-l border-stone-200 dark:border-stone-700">
                      <span className="text-[9px] text-emerald-600 font-sans block mb-0.5">
                        {tr('catalog_table_wholesale')}
                      </span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {wholesale} <span className="text-[9px]">{profile.currencySymbol}</span>
                      </span>
                    </div>
                    <div className="p-1">
                      <span className="text-[9px] text-amber-600 font-sans block mb-0.5">
                        {tr('catalog_table_retail')}
                      </span>
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                        {retail} <span className="text-[9px]">{profile.currencySymbol}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditSpecs(p)}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{tr('catalog_edit_specs')}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExportToStore(p)}
                        className={`px-2 py-1.5 rounded-xl font-bold flex items-center gap-1 text-xs transition cursor-pointer ${
                          p.inStore
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                        }`}
                        title={p.inStore ? 'المشغولة معروضة في متجري' : 'تصدير إلى متجري'}
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>{p.inStore ? 'بمتجري' : 'تصدير'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectRecordToLoad(p)}
                        className="px-2 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold flex items-center gap-1 text-xs cursor-pointer hover:bg-stone-200"
                        title="فتح في الحاسبة للتسعير"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>الحاسبة</span>
                      </button>

                      <button
                        type="button"
                        disabled={exportingQuoteId === p.id}
                        onClick={() => handleExportProductQuotation(p)}
                        className="px-2 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 border border-amber-300/40 text-xs cursor-pointer hover:bg-amber-100 disabled:opacity-50"
                        title="تصدير عرض سعر رسمي PDF 📄✨"
                      >
                        {exportingQuoteId === p.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        <span>عرض سعر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenWhatsAppShare(p)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 border border-emerald-300/40 text-xs cursor-pointer hover:bg-emerald-100"
                        title="مشاركة عرض سعر واتساب"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* تذييل الكتالوج: دليل الألوان الـ 3 والتصفية السريعة */}
      <footer className="mt-4 px-4 py-3 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-stone-500 dark:text-stone-400 font-black">دليل ألوان الكتالوج:</span>
          <button
            type="button"
            onClick={() => setStatusColorFilter('all')}
            className={`px-2.5 py-1 rounded-xl border transition cursor-pointer ${
              statusColorFilter === 'all'
                ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500'
                : 'bg-white dark:bg-stone-950 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
            }`}
          >
            الكل ({allProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusColorFilter(statusColorFilter === 'red' ? 'all' : 'red')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
              statusColorFilter === 'red'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50/80 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>بالكتالوج فقط ({allProducts.filter((p) => getProductCatalogStatus(p).color === 'red').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusColorFilter(statusColorFilter === 'yellow' ? 'all' : 'yellow')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
              statusColorFilter === 'yellow'
                ? 'bg-amber-500 text-stone-950 border-amber-500'
                : 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>بمتجري بدون حاسبة ({allProducts.filter((p) => getProductCatalogStatus(p).color === 'yellow').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusColorFilter(statusColorFilter === 'green' ? 'all' : 'green')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
              statusColorFilter === 'green'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>مسعّر وبمتجري ({allProducts.filter((p) => getProductCatalogStatus(p).color === 'green').length})</span>
          </button>
        </div>
        <span className="text-[10px] text-stone-400 dark:text-stone-500">
          اضغط على أي لون لتصفية القائمة
        </span>
      </footer>
    </>
  )}

      {/* ================================================================= */}
      {/* 2. MY STORE VIEW (متجري الخاص لعرض ونشر المشغولات) */}
      {/* ================================================================= */}
      {activeTab === 'store' && (
        <div className="space-y-5 animate-in fade-in">
          {/* شريط الإحصائيات السريعة لمتجري */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-stone-500 block">إجمالي مشغولات المتجر</span>
                <span className="text-xl font-black text-stone-900 dark:text-stone-100">
                  {allProducts.filter((p) => p.inStore).length}
                </span>
                <span className="text-[10px] text-stone-400 block">مشغولة معتمدة ومصدرة</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-stone-500 block">منشورة ومعروضة للعملاء</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {allProducts.filter((p) => p.inStore && p.isPublishedInStore !== false).length}
                </span>
                <span className="text-[10px] text-emerald-600/70 block">جاهزة للطلب والبيع</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-stone-500 block">مسودات غير منشورة</span>
                <span className="text-xl font-black text-stone-600 dark:text-stone-300">
                  {allProducts.filter((p) => p.inStore && p.isPublishedInStore === false).length}
                </span>
                <span className="text-[10px] text-stone-400 block">قيد التجهيز والمراجعة</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center">
                <EyeOff className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* شريط الإشعار المؤقت عند الضغط على اللمبة الحمراء المضيئة (3 ثواني) */}
          {pendingBannerMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-600 text-white text-xs sm:text-sm font-black flex items-center justify-between gap-3 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                <span>{pendingBannerMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingBannerMessage('')}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* شريط التصدير الجماعي من متجري إلى سوق الشمساوية */}
          {storeProducts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-600/15 via-amber-500/10 to-transparent border border-emerald-500/30">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-100">
                <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {selectedStoreMarketIds.size > 0
                    ? `تم تحديد (${selectedStoreMarketIds.size}) منتج للتصدير إلى سوق الشمساوية`
                    : 'حدد منتجات من متجرك لإرسالها إلى سوق الشمساوية المركزي للمراجعة والبيع'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedStoreMarketIds.size === storeProducts.length) {
                      setSelectedStoreMarketIds(new Set());
                    } else {
                      setSelectedStoreMarketIds(new Set(storeProducts.map((sp) => sp.id)));
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs font-bold hover:bg-emerald-500/10 transition cursor-pointer"
                >
                  {selectedStoreMarketIds.size === storeProducts.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
                <button
                  type="button"
                  onClick={handleBulkExportStoreToMarket}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    تصدير المحدد لسوق الشمساوية ({selectedStoreMarketIds.size > 0 ? selectedStoreMarketIds.size : storeProducts.filter((p) => getProductMarketStatus(p) !== 'approved').length})
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* شريط البحث وتصفية المتجر */}
          <div className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={storeSearchQuery}
                onChange={(e) => setStoreSearchQuery(e.target.value)}
                placeholder="البحث في متجري..."
                className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Search className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
              {storeSearchQuery && (
                <button
                  type="button"
                  onClick={() => setStoreSearchQuery('')}
                  className="absolute left-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 font-bold cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {/* أزرار الفلترة */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStoreStatusFilter('all')}
                className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  storeStatusFilter === 'all'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                }`}
              >
                الكل ({allProducts.filter((p) => p.inStore).length})
              </button>
              <button
                type="button"
                onClick={() => setStoreStatusFilter('published')}
                className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  storeStatusFilter === 'published'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                }`}
              >
                منشور ({allProducts.filter((p) => p.inStore && p.isPublishedInStore !== false).length})
              </button>
              <button
                type="button"
                onClick={() => setStoreStatusFilter('draft')}
                className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  storeStatusFilter === 'draft'
                    ? 'bg-stone-700 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                }`}
              >
                مسودة ({allProducts.filter((p) => p.inStore && p.isPublishedInStore === false).length})
              </button>
            </div>
          </div>

          {/* حالة عدم وجود منتجات في المتجر */}
          {storeProducts.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                <Store className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  {allProducts.filter((p) => p.inStore).length === 0
                    ? 'لم تقم بتصدير أي مشغولات إلى متجرك حتى الآن'
                    : 'لا توجد منتجات مطابقة للبحث في متجرك'}
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                  {allProducts.filter((p) => p.inStore).length === 0
                    ? 'يمكنك الانتقال إلى تبويب "الكتالوج" والضغط على زر "تصدير إلى متجري" لأي مشغولة معتمدة لعرضها وإدارتها هنا.'
                    : 'جرب البحث باسم منتج مختلف أو إلغاء تصفية حالة النشر.'}
                </p>
              </div>
              {allProducts.filter((p) => p.inStore).length === 0 && (
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  الذهاب للكتالوج وتصدير أول مشغولة
                </button>
              )}
            </div>
          ) : (
            /* شبكة بطاقات مشغولات المتجر */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeProducts.map((p, idx) => {
                const cost = getCostPrice(p);
                const retail = getRetailPrice(p);
                const currentPrice =
                  storePrices[p.id] !== undefined
                    ? storePrices[p.id]
                    : p.storePrice || retail;
                const currentDesc =
                  storeDescriptions[p.id] !== undefined
                    ? storeDescriptions[p.id]
                    : p.storeDescription || (p as any).marketingDescription || '';
                const isPublished = p.isPublishedInStore !== false;
                const imgUrl = p.imageUrl || p.input?.productImageUrl;
                const serial = getProductSerialDisplay(p, idx);
                const craft = getCraftDisplay(p);
                const marketSt = getProductMarketStatus(p);
                const isMarketSelected = selectedStoreMarketIds.has(p.id);
                const isDragging = draggedProductId === p.id;
                const isDragOver = dragOverProductId === p.id && draggedProductId !== p.id;
                const storeStatus = getStoreProductStatus(p);

                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedProductId(p.id);
                      e.dataTransfer.effectAllowed = 'move';
                      try {
                        e.dataTransfer.setData('text/plain', p.id);
                      } catch {}
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverProductId !== p.id) setDragOverProductId(p.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverProductId === p.id) setDragOverProductId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const srcId = draggedProductId || e.dataTransfer.getData('text/plain');
                      setDraggedProductId(null);
                      setDragOverProductId(null);
                      if (srcId && srcId !== p.id) {
                        handleReorderProducts(srcId, p.id);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedProductId(null);
                      setDragOverProductId(null);
                    }}
                    className={`bg-white dark:bg-stone-900 rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between transition artisan-card-hover ${storeStatus.borderAccentClass} ${
                      isDragOver
                        ? 'border-amber-500 ring-2 ring-amber-500 scale-[1.01]'
                        : isDragging
                        ? 'opacity-50 border-dashed border-amber-500'
                        : isMarketSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                        : 'border-stone-200 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700'
                    }`}
                  >
                    <div className="p-4 space-y-3">
                      {/* رأس البطاقة: تحديد للتصدير + مقبض الترتيب + لمبة حالة السوق */}
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-stone-100 dark:border-stone-800">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStoreMarketIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 dark:text-stone-300 cursor-pointer"
                        >
                          {isMarketSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-400" />
                          )}
                          <span>تحديد للسوق</span>
                        </button>

                        {storeStatus.color === 'red' ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePublishInStore(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 text-[10px] font-black cursor-pointer"
                            title="الظهور مغلق مؤقتاً — اضغط لإعادة الظهور"
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>مخفي مؤقتاً</span>
                          </button>
                        ) : storeStatus.color === 'green' ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (storeStatus.isPendingInMarket) triggerPendingAdminBanner(p.productName);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-400/60 text-[10px] font-black cursor-pointer"
                            title={storeStatus.actionHint}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{storeStatus.shortLabel}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleExportProductToMarket(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-[10px] font-black transition cursor-pointer"
                            title="معروض في متجري فقط — اضغط للتصدير لسوق الشمساوية"
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>في متجري فقط · تصدير للسوق</span>
                          </button>
                        )}
                      </div>

                      {/* رأس البطاقة: الصورة والبيانات + مقبض السحب والترتيب */}
                      <div className="flex gap-2.5 items-start">
                        <div
                          className="pt-1 text-stone-400 hover:text-amber-600 cursor-grab active:cursor-grabbing shrink-0"
                          title="اسحب لتغيير ترتيب عرض المشغولة في متجرك"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-stone-800 shrink-0 overflow-hidden border border-stone-200 dark:border-stone-700 flex items-center justify-center">
                          {imgUrl ? (
                            <img src={imgUrl} alt={p.productName} className="w-full h-full object-cover" />
                          ) : (
                            <Sparkles className="w-6 h-6 text-amber-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[10px] font-mono text-stone-600 dark:text-stone-300">
                                {serial}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                {craft}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const prev = storeProducts[idx - 1];
                                  if (prev) handleReorderProducts(p.id, prev.id);
                                }}
                                disabled={idx === 0}
                                title="تقديم"
                                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = storeProducts[idx + 1];
                                  if (next) handleReorderProducts(p.id, next.id);
                                }}
                                disabled={idx === storeProducts.length - 1}
                                title="تأخير"
                                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="text-sm font-black text-stone-900 dark:text-stone-100 mt-1 truncate">
                            {p.productName}
                          </h4>
                        </div>
                      </div>

                      {/* مفتاح إظهار / إخفاء بالعين (خضراء = ظاهر / رصاصي = مخفي مؤقتاً) */}
                      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-700 dark:text-stone-200">
                            الظهور بالمتجر:
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
                            }`}
                          >
                            {isPublished ? 'ظاهر للعملاء' : 'مخفي مؤقتاً'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePublishInStore(p)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[11px] font-black transition cursor-pointer ${
                            isPublished
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-stone-200/80 dark:bg-stone-700 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-300'
                          }`}
                          title={isPublished ? 'إخفاء مؤقت عن العملاء' : 'إظهار للعملاء'}
                        >
                          {isPublished ? (
                            <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-stone-400" />
                          )}
                          <span>{isPublished ? 'مفعّل' : 'مغلق'}</span>
                        </button>
                      </div>

                      {/* التكلفة المرجعية الأصلية (محمية ومحفوظة في الأرشيف دون تغيير) */}
                      <div className="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300 font-bold">
                          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>التكلفة المرجعية الأصلية:</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-amber-800 dark:text-amber-300">
                            {cost} {profile.currencySymbol}
                          </span>
                          <span className="text-[10px] text-stone-400 block font-normal">
                            (محمية ومحفوظة في الأرشيف)
                          </span>
                        </div>
                      </div>

                      {/* السعر التسويقي في المتجر */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          السعر التسويقي للعملاء ({profile.currencySymbol}) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={currentPrice}
                          onChange={(e) =>
                            setStorePrices((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                          }
                          className="w-full px-3 py-2 text-xs font-black rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                        />
                      </div>

                      {/* وصف العرض للعملاء */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          وصف المشغولة ومواصفات العرض
                        </label>
                        <textarea
                          rows={2}
                          value={currentDesc}
                          onChange={(e) =>
                            setStoreDescriptions((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="اكتب وصفاً تسويقياً جذاباً للزبائن..."
                          className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* أزرار الإجراءات في أسفل البطاقة */}
                    <div className="p-3 bg-stone-50/70 dark:bg-stone-800/40 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handleSaveStoreProductDetails(p, currentPrice, currentDesc)}
                        className="flex-1 py-2 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ التعديلات</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareStoreProduct(p)}
                        className="py-2 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="مشاركة عبر واتساب"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مشاركة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromStore(p)}
                        className="py-2 px-2 rounded-xl text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title="إلغاء من المتجر"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* تذييل متجري الموحد في سطر واحد: زران + علامتي نسخ الرابط */}
          <footer className="mt-4 p-2.5 sm:p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xs w-full">
            <div className="flex items-center justify-between gap-1.5 sm:gap-3 flex-nowrap w-full">
              {/* الزر الأول + أيقونة نسخ رابط متجري */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsCustomerPreviewOpen(true)}
                  className="flex-1 min-w-0 py-2 sm:py-2.5 px-2 sm:px-3.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap"
                  title="معاينة متجرك كما يراه العميل مع تخصيص الشكل والترتيب"
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">مشاهدة المتجر</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = getWorkshopStoreUrl(profile);
                    if (navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(url).catch(() => {});
                    }
                    setCopiedFooterTarget('store');
                    playSuccessSound();
                    setNotice('تم نسخ رابط متجرك المباشر بنجاح ✨');
                    setTimeout(() => {
                      setCopiedFooterTarget((prev) => (prev === 'store' ? null : prev));
                      setNotice('');
                    }, 2500);
                  }}
                  aria-label="نسخ رابط متجري"
                  title="نسخ رابط المتجر"
                  className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer transition active:scale-95"
                >
                  {copiedFooterTarget === 'store' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                  )}
                </button>
              </div>

              {/* الزر الثاني + أيقونة نسخ رابط سوق الشمساوية */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenMarketplace) onOpenMarketplace();
                    else window.location.hash = '#/market';
                  }}
                  className="flex-1 min-w-0 py-2 sm:py-2.5 px-2 sm:px-3.5 rounded-xl bg-[#0C1427] hover:bg-[#132040] dark:bg-[#1A2B54] dark:hover:bg-[#22355E] text-[#F7F3EA] border border-[#22355E] font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap"
                  title="الانتقال إلى سوق الشمساوية العام كما يراه العملاء"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                  <span className="truncate">سوق الشمساوية</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const mktUrl =
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/#/market`
                        : 'https://alshamsawiyah.ai.studio/#/market';
                    if (navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(mktUrl).catch(() => {});
                    }
                    setCopiedFooterTarget('market');
                    playSuccessSound();
                    setNotice('تم نسخ رابط سوق الشمساوية العام بنجاح ✨');
                    setTimeout(() => {
                      setCopiedFooterTarget((prev) => (prev === 'market' ? null : prev));
                      setNotice('');
                    }, 2500);
                  }}
                  aria-label="نسخ رابط سوق الشمساوية"
                  title="نسخ رابط سوق الشمساوية"
                  className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer transition active:scale-95"
                >
                  {copiedFooterTarget === 'market' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                  )}
                </button>
              </div>
            </div>

            {/* Slim Store 3-Color Guidance Legend in the Footer */}
            <div className="mt-2.5 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-stone-500 dark:text-stone-400">
              <span>دليل ألوان متجري:</span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>أخضر: مصدّر لسوق الشمساوية</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>أصفر: في متجري فقط</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>أحمر: مخفي مؤقتاً (العين رصاصي)</span>
                </span>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Fullscreen Store Customer Preview & Layout Editor Overlay */}
      {isCustomerPreviewOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#F2ECE1] dark:bg-[#060B18]">
          <PublicStorefrontView
            slug={getWorkshopCleanSlug(profile)}
            isOwnerPreview={true}
            ownerProfile={profile}
            localFallbackProducts={allProducts.filter((p) => p.inStore)}
            initialLayoutCols={storeLayoutCols}
            initialProductOrder={productOrder}
            onClosePreview={() => setIsCustomerPreviewOpen(false)}
            onNavigateToApp={() => setIsCustomerPreviewOpen(false)}
            onNavigateToMarket={() => {
              setIsCustomerPreviewOpen(false);
              if (onOpenMarketplace) onOpenMarketplace();
              else window.location.hash = '#/market';
            }}
            onLayoutChanged={(cols, nextOrder) => {
              setStoreLayoutCols(cols);
              if (Array.isArray(nextOrder) && nextOrder.length > 0) {
                setProductOrder(nextOrder);
                setSortBy('priority');
                setSortOrder('asc');
              }
            }}
          />
        </div>
      )}

      {/* 4. MODAL: EDIT MISSING PRODUCT SPECIFICATIONS */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setEditingRecord(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2 bg-stone-50 dark:bg-stone-800/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-200/80 dark:bg-stone-700 text-stone-800 dark:text-stone-100 text-xs font-black cursor-pointer shrink-0"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>رجوع</span>
                </button>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-stone-900 dark:text-stone-100 truncate">
                    {tr('catalog_specs_modal_title')}
                  </h3>
                  <p className="text-xs text-stone-500 truncate">
                    كتابة وإكمال المواصفات الناقصة وحفظ التعديلات في الكتالوج
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                aria-label="إغلاق"
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSpecs} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Product Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.productName}
                    onChange={(e) => setEditFormData({ ...editFormData, productName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_code')} (SKU)
                  </label>
                  <input
                    type="text"
                    value={editFormData.productCode}
                    onChange={(e) => setEditFormData({ ...editFormData, productCode: e.target.value })}
                    placeholder="مثال: PRD-0042 أو MAC-RUN-01"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Type and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_type')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.productType}
                    onChange={(e) => setEditFormData({ ...editFormData, productType: e.target.value })}
                    placeholder="مثال: رانر، مرآة، كوشن، ستائر..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_category')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    placeholder="مثال: مكرمية، كروشيه، تطريز..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Pricing Fields */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-300/40 dark:border-amber-700/40 space-y-3">
                <h4 className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>تعديل التسعير ({profile.currencySymbol})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 font-bold mb-1 text-[11px]">
                      التكلفة المباشرة
                    </label>
                    <input
                      type="number"
                      value={editFormData.costPrice}
                      onChange={(e) => setEditFormData({ ...editFormData, costPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-600 font-bold mb-1 text-[11px]">
                      {tr('catalog_table_wholesale')} *
                    </label>
                    <input
                      type="number"
                      required
                      value={editFormData.wholesalePrice}
                      onChange={(e) => setEditFormData({ ...editFormData, wholesalePrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 font-mono font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-600 font-bold mb-1 text-[11px]">
                      {tr('catalog_table_retail')} *
                    </label>
                    <input
                      type="number"
                      required
                      value={editFormData.retailPrice}
                      onChange={(e) => setEditFormData({ ...editFormData, retailPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 font-mono font-black"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Dimensions */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 space-y-3">
                <h4 className="font-black text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-stone-500" />
                  <span>أبعاد ومقاسات القطعة (بالسنتيمتر)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">العرض (سم)</label>
                    <input
                      type="number"
                      value={editFormData.widthCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, widthCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">الارتفاع / الطول</label>
                    <input
                      type="number"
                      value={editFormData.heightCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, heightCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">القطر (سم)</label>
                    <input
                      type="number"
                      value={editFormData.diameterCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, diameterCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">طول الشراشيب</label>
                    <input
                      type="number"
                      value={editFormData.fringeLengthCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, fringeLengthCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Materials & Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    خامات ومواد التصنيع
                  </label>
                  <input
                    type="text"
                    value={editFormData.materialsDescription}
                    onChange={(e) => setEditFormData({ ...editFormData, materialsDescription: e.target.value })}
                    placeholder="مثال: خيط قطن محلول 4 مم، خشب زان طبيعي، حلقات معدنية"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    الألوان وتدرجات القطعة
                  </label>
                  <input
                    type="text"
                    value={editFormData.colorVariants}
                    onChange={(e) => setEditFormData({ ...editFormData, colorVariants: e.target.value })}
                    placeholder="مثال: أوف وايت، كافيه، مسطردة، أخضر مريمي"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Image URL & Direct Compressed Upload */}
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                  صورة المنتج (رفع مضغوط تلقائياً أو رابط URL)
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="url"
                    value={editFormData.imageUrl}
                    onChange={(e) => setEditFormData({ ...editFormData, imageUrl: e.target.value })}
                    placeholder="https://... أو ارفع صورة من الجهاز"
                    className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <label className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع وضغط صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const compressed = await compressImageFile(file, {
                            maxWidth: 800,
                            maxHeight: 800,
                            targetMaxKb: 95,
                            initialQuality: 0.78,
                          });
                          setEditFormData((prev: any) => ({ ...prev, imageUrl: compressed }));
                        } catch {}
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {editFormData.imageUrl && (
                    <img
                      src={editFormData.imageUrl}
                      alt="معاينة"
                      className="w-10 h-10 rounded-xl object-cover border border-stone-300 dark:border-stone-700 shrink-0"
                    />
                  )}
                </div>
              </div>

              {/* Marketing Description & Care Instructions */}
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                  وصف المنتج الترويجي (Marketing Copy)
                </label>
                <textarea
                  rows={2}
                  value={editFormData.marketingDescription}
                  onChange={(e) => setEditFormData({ ...editFormData, marketingDescription: e.target.value })}
                  placeholder="وصف جذاب للمنتج، مميزاته، وطريقة استخدامه في الديكور..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    تعليمات العناية والغسيل
                  </label>
                  <input
                    type="text"
                    value={editFormData.careInstructions}
                    onChange={(e) => setEditFormData({ ...editFormData, careInstructions: e.target.value })}
                    placeholder="مثال: تنظيف جاف فقط، تجنب الغمر في الماء"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    وسوم البحث والتصنيف (Tags - مفصولة بفواصل)
                  </label>
                  <input
                    type="text"
                    value={editFormData.tags}
                    onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                    placeholder="بوهيمي, ديكور_مودرن, هدايا, مكرمية_حائط"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black shadow-md shadow-amber-600/20 active:scale-[0.98] transition cursor-pointer"
                >
                  {tr('catalog_save_specs')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DEDICATED INDEPENDENT PRINT/PDF TEMPLATE (OFFSCREEN) */}
      <div style={{ display: 'none' }}>
        <div
          ref={printTemplateRef}
          style={{
            width: '800px',
            backgroundColor: '#ffffff',
            color: '#1c1917',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            direction: 'rtl',
            padding: '30px',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #d97706',
              paddingBottom: '16px',
              marginBottom: '20px',
            }}
          >
            <div>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 'bold', color: '#78350f' }}>
                كتالوج منتجات الورشة الرسمي
              </h1>
              <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', color: '#1c1917' }}>
                براند: {profile.brandName} | الفنان: {profile.artistName}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#78716c' }}>
                هاتف الورشة: {profile.phoneNumber} • {profile.country}
              </p>
            </div>
            <div style={{ textAlign: 'left', fontSize: '11px', color: '#78716c' }}>
              <p style={{ margin: '0' }}>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</p>
              <p style={{ margin: '4px 0 0 0' }}>عدد المنتجات: {targetProductsForExport.length}</p>
              <p style={{ margin: '4px 0 0 0', color: '#d97706', fontWeight: 'bold' }}>
                العملة: {profile.currencySymbol} ({profile.currency})
              </p>
            </div>
          </div>

          {/* Table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11px',
              textAlign: 'right',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#fef3c7', borderBottom: '2px solid #b45309' }}>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '30px' }}>#</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '80px' }}>كود الصنف</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', width: '100px' }}>نوع المنتج</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', width: '90px' }}>التصنيف</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb' }}>اسم المنتج / الموديل</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '75px' }}>المقاس</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '80px', color: '#047857' }}>سعر الجملة</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '80px', color: '#b45309' }}>سعر القطاعي</th>
              </tr>
            </thead>
            <tbody>
              {targetProductsForExport.map((p, idx) => {
                const wholesale = getWholesalePrice(p);
                const retail = getRetailPrice(p);
                const code = getProductSerialDisplay(p, idx);
                const mainType = getMainSectionDisplay(p);
                const category = getCraftDisplay(p);
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={p.id}
                    style={{
                      backgroundColor: isEven ? '#ffffff' : '#fafaf9',
                      borderBottom: '1px solid #e7e5e4',
                    }}
                  >
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#78716c' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                      {code}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb' }}>
                      {mainType}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', color: '#78350f', fontWeight: 'bold' }}>
                      {category}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                      {p.productName}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontSize: '10px' }}>
                      {p.input?.widthCm ? `${p.input.widthCm}×${p.input.totalLengthCm || 0} سم` : '-'}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#047857' }}>
                      {wholesale}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#b45309' }}>
                      {retail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#fef3c7', fontWeight: 'bold', borderTop: '2px solid #b45309' }}>
                <td colSpan={6} style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                  الإجمالي العام ({targetProductsForExport.length} منتج)
                </td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#047857' }}>
                  {catalogStats.totalWholesale}
                </td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#b45309' }}>
                  {catalogStats.totalRetail}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer Notes */}
          <div
            style={{
              marginTop: '25px',
              paddingTop: '12px',
              borderTop: '1px solid #e7e5e4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              color: '#78716c',
            }}
          >
            <span>* الأسعار شاملة لكافة نسب الأمان وتكاليف الإنتاج المعتمدة بالورشة.</span>
            <span>صادر من منظومة الشمساوية للبرمجيات الحرفية • AL-SHAMSAWEYA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
