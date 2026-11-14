import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserProfile,
  SavedProductRecord,
  CustomerAuthUser,
  MarketplaceCartItem,
  isUserAdmin,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  getStoredCart,
  addToCart,
  getStoredCustomerSession,
  canCustomerReviewProduct,
  addProductReview,
  getProductReviews,
  syncPlatformSettingsFromCloud,
} from '../../services/marketplaceCartService';
import { fetchApprovedMarketplaceProducts } from '../../db/marketplaceCloud';
import { supabase } from '../../lib/supabase';
import { MAIN_SECTIONS, SUB_CRAFTS_REGISTRY } from '../../registry/craftsRegistry';
import { CustomerAuthModal } from './CustomerAuthModal';
import { MarketplaceCartModal } from './MarketplaceCartModal';
import { AlShamsBrandIcon } from '../brand/BrandAssets';
import { playSuccessSound, playAlertSound } from '../../lib/sounds';
import {
  ShoppingBag,
  Store,
  Star,
  Search,
  Layers,
  Phone,
  ChevronDown,
  User,
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
  ArrowUpDown,
} from 'lucide-react';

interface MarketplaceProductRecord extends SavedProductRecord {
  artistName?: string;
  brandName?: string;
  phoneNumber?: string;
  logoUrl?: string | null;
  storeSlug?: string;
  marketStatus?: 'approved' | 'pending_approval' | 'rejected';
}

interface MarketplaceViewProps {
  profile?: UserProfile | null;
  onNavigateHome: () => void;
  onOpenStoreModal?: () => void;
}

const DECOR_CATEGORIES = [
  { id: 'all', nameAr: 'كافة المعروضات', keywords: [] as string[] },
  { id: 'wall_hangings', nameAr: 'معلقات جدارية', keywords: ['معلق', 'جدار', 'تابلوه', 'طارة', 'برواز', 'مرآة'] },
  { id: 'cushions', nameAr: 'كوشن وتكايات', keywords: ['كوشن', 'مخد', 'تكا', 'غطاء'] },
  { id: 'bags_clutches', nameAr: 'شنط وكلاتشات', keywords: ['شنط', 'كلاتش', 'حقيب', 'zara'] },
  { id: 'rugs_runners', nameAr: 'سجاد ورانرات', keywords: ['سجاد', 'رانر', 'كليم', 'مفرش'] },
  { id: 'lighting', nameAr: 'إضاءة وأباجورات', keywords: ['إضاء', 'أباجور', 'نجف', 'فانوس', 'شمع'] },
  { id: 'baskets_trays', nameAr: 'صواني وباسكت', keywords: ['صين', 'باسكت', 'سبت', 'منظم', 'بوكس', 'سل'] },
  { id: 'furniture_decor', nameAr: 'أثاث وديكور', keywords: ['أثاث', 'كرسي', 'أرجوح', 'طربيز', 'بوف', 'فاز', 'ديكور'] },
];

const CRAFT_ALIASES: Record<string, string[]> = {
  macrame: ['macrame', 'مكرم'],
  crochet: ['crochet', 'كروش', 'سنارة', 'أميجوروم'],
  zigzag: ['zigzag', 'زجزاج'],
  punch_needle: ['punch', 'بانش', 'نقاش'],
  tufting_gun: ['tuft', 'تافت'],
  kelim: ['kelim', 'kilim', 'كليم', 'نول'],
  aqqada: ['aqqada', 'عقاد', 'شرابة'],
  craft_fusion: ['fusion', 'دمج'],
  spinning: ['spinning', 'غزل'],
  beadwork: ['bead', 'خرز', 'لولي'],
  embroidery: ['embroid', 'تطريز', 'طارة'],
  pottery: ['pottery', 'خزف', 'فخار', 'طين'],
  polymer_clay: ['polymer', 'صلصال'],
  ceramics: ['ceramic', 'سيراميك'],
  concrete: ['concrete', 'كونكريت', 'ترازو', 'خرسان'],
  resin: ['resin', 'ريزن', 'إيبوكس'],
  bamboo: ['bamboo', 'بامبو', 'خيزران'],
  wicker: ['wicker', 'خوص', 'سعف'],
  scroll_saw: ['scroll', 'أركت'],
  arabesque: ['arabesque', 'أرابيسك', 'صدف'],
  carpentry: ['carpentry', 'wood', 'نجار', 'خشب', 'خراط'],
};

function matchesSubCraft(product: MarketplaceProductRecord, subCraftId: string): boolean {
  const craftDef = SUB_CRAFTS_REGISTRY.find((c) => c.id === subCraftId);
  const haystack = [
    product.craftId,
    product.craftName,
    product.category,
    product.productType,
    product.productName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (product.craftId === subCraftId) return true;
  if (craftDef && haystack.includes(craftDef.nameAr.toLowerCase())) return true;
  if (haystack.includes(subCraftId.toLowerCase())) return true;

  const aliases = CRAFT_ALIASES[subCraftId] || [];
  if (aliases.some((kw) => haystack.includes(kw))) return true;

  return false;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  profile,
  onOpenStoreModal,
}) => {
  const isSuperAdmin = useMemo(() => isUserAdmin(profile), [profile]);

  const [products, setProducts] = useState<MarketplaceProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc'>('featured');

  // 1. Decor Horizontal Category Tabs
  const [selectedDecorCategory, setSelectedDecorCategory] = useState<string>('all');

  // 2. Linked Multi-Select Dropdowns: القسم (Main Sections) -> الحرفة (Sub-Crafts)
  const [selectedMainSections, setSelectedMainSections] = useState<string[]>([]);
  const [selectedSubCrafts, setSelectedSubCrafts] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'section' | 'craft' | null>(null);
  const filterAreaRef = useRef<HTMLDivElement>(null);
  const catalogSectionRef = useRef<HTMLElement>(null);

  // Selected Product Details Modal
  const [selectedProductDetails, setSelectedProductDetails] = useState<MarketplaceProductRecord | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalSelectedColor, setModalSelectedColor] = useState<string>('');
  const [modalSelectedSize, setModalSelectedSize] = useState<string>('');
  const [modalCustomNotes, setModalCustomNotes] = useState<string>('');

  // Cart & Customer modals
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState<boolean>(false);
  const [cartItemsCount, setCartItemsCount] = useState<number>(0);
  const [customerUser, setCustomerUser] = useState<CustomerAuthUser | null>(getStoredCustomerSession());

  // Reviews state
  const [newReviewAuthor, setNewReviewAuthor] = useState('');
  const [newReviewPhone, setNewReviewPhone] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [reviewGuardError, setReviewGuardError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Close open dropdown on outside click or Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterAreaRef.current && !filterAreaRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Listen to cart & customer updates
  useEffect(() => {
    const updateCount = () => {
      const items = getStoredCart();
      const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
      setCartItemsCount(totalCount);
    };
    updateCount();

    const handleCartEvent = () => updateCount();
    const handleCustEvent = (e: any) => setCustomerUser(e.detail || null);

    window.addEventListener('alshams_cart_updated', handleCartEvent);
    window.addEventListener('alshams_customer_updated', handleCustEvent);

    return () => {
      window.removeEventListener('alshams_cart_updated', handleCartEvent);
      window.removeEventListener('alshams_customer_updated', handleCustEvent);
    };
  }, []);

  useEffect(() => {
    if (customerUser) {
      setNewReviewAuthor(customerUser.name);
      setNewReviewPhone(customerUser.phone);
    }
  }, [customerUser]);

  // Dynamic Sub-Crafts linked to selected Main Sections
  const availableSubCrafts = useMemo(() => {
    if (selectedMainSections.length === 0) {
      return SUB_CRAFTS_REGISTRY;
    }
    return SUB_CRAFTS_REGISTRY.filter((c) => selectedMainSections.includes(c.mainSectionId));
  }, [selectedMainSections]);

  // Auto-prune sub-crafts when main sections change
  useEffect(() => {
    if (selectedMainSections.length > 0 && selectedSubCrafts.length > 0) {
      const validIds = new Set(availableSubCrafts.map((c) => c.id));
      const pruned = selectedSubCrafts.filter((id) => validIds.has(id));
      if (pruned.length !== selectedSubCrafts.length) {
        setSelectedSubCrafts(pruned);
      }
    }
  }, [selectedMainSections, availableSubCrafts, selectedSubCrafts]);

  const toggleMainSection = (sectionId: string) => {
    if (sectionId === 'all') {
      setSelectedMainSections([]);
      setSelectedSubCrafts([]);
      return;
    }
    setSelectedMainSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  const toggleSubCraft = (craftId: string) => {
    if (craftId === 'all') {
      setSelectedSubCrafts([]);
      return;
    }
    setSelectedSubCrafts((prev) =>
      prev.includes(craftId) ? prev.filter((id) => id !== craftId) : [...prev, craftId]
    );
  };

  // Load approved marketplace products
  useEffect(() => {
    let isMounted = true;
    const fetchMarketplace = async () => {
      setLoading(true);
      try {
        syncPlatformSettingsFromCloud().catch(() => {});
        const cloudProducts = await fetchApprovedMarketplaceProducts().catch(() => []);
        const cloudMapped: MarketplaceProductRecord[] = (cloudProducts || [])
          .filter((cp) => cp.status === 'approved')
          .map((cp) => ({
            id: cp.id,
            workshopId: cp.workshop_id || cp.workshopId,
            tenantId: cp.workshop_id || cp.workshopId,
            brandName: cp.brand_name || cp.brandName || 'ورشة الشمساوية',
            artistName: cp.artist_name || cp.artistName || 'فنان الشمساوية',
            phoneNumber: cp.phone_number || cp.phoneNumber || '',
            logoUrl: cp.logo_url || cp.logoUrl || null,
            storeSlug: cp.store_slug || cp.storeSlug || cp.workshop_id || cp.workshopId,
            productName: cp.product_name || cp.productName || 'مشغولة يدوية',
            category: cp.category as any,
            craftName: cp.craft_name || cp.craftName,
            decorCategory: cp.decor_category as any,
            retailPrice: Number(cp.retail_price ?? cp.retailPrice ?? cp.store_price ?? cp.storePrice ?? 0),
            storePrice: Number(cp.store_price ?? cp.storePrice ?? cp.retail_price ?? cp.retailPrice ?? 0),
            wholesalePrice: Number(cp.wholesale_price ?? cp.wholesalePrice ?? 0),
            costPrice: Number(cp.cost_price ?? cp.costPrice ?? 0),
            currentStock: Number(cp.current_stock ?? cp.currentStock ?? 1),
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            marketStatus: 'approved',
            imageUrl: cp.image_url || cp.imageUrl || '/alshams_falcon_emblem.png',
            storeDescription: cp.store_description || cp.storeDescription || '',
            availableColors: Array.isArray(cp.available_colors) ? cp.available_colors : [],
            availableSizes: Array.isArray(cp.available_sizes) ? cp.available_sizes : [],
            isActive: true,
            createdAt: typeof cp.created_at === 'number' ? cp.created_at : Date.now(),
            updatedAt: typeof cp.updated_at === 'number' ? cp.updated_at : Date.now(),
            input: {} as any,
            output: {} as any,
          }));

        // Local workshop fallback ONLY for offline-approved products (never bypasses moderation)
        let publishedLocal: MarketplaceProductRecord[] = [];
        const isCurrentProfileBlocked = Boolean(
          profile && ((profile as any).isFrozen || profile.status === 'banned' || profile.status === 'suspended')
        );
        if (profile && !isCurrentProfileBlocked) {
          const tenantId = profile.tenantId || profile.workshopId || profile.id;
          if (tenantId) {
            const localProds = await tenantStorage.getProducts(tenantId).catch(() => []);
            publishedLocal = localProds
              .filter((p) => p && p.inStore && p.isPublishedInStore !== false && p.isMarketplaceApproved === true)
              .map((p) => ({
                ...p,
                workshopId: tenantId,
                brandName: profile.brandName || 'ورشة الشمساوية',
                artistName: profile.artistName || 'فنان الشمساوية',
                phoneNumber: profile.phoneNumber || '',
                logoUrl: (profile as any).logo_url || profile.logoUrl || profile.logoBase64 || null,
                storeSlug: profile.storeSlug || tenantId,
              }));
          }
        }

        const combinedMap = new Map<string, MarketplaceProductRecord>();
        publishedLocal.forEach((p) => combinedMap.set(p.id, p));
        cloudMapped.forEach((p) => {
          const prev = combinedMap.get(p.id);
          combinedMap.set(p.id, { ...(prev || {}), ...p });
        });

        if (isMounted) {
          setProducts(Array.from(combinedMap.values()));
        }
      } catch (err) {
        console.warn('Error fetching marketplace products:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMarketplace();

    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(`public_marketplace_realtime_sync_${uniqueSuffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_products',
        },
        () => {
          fetchMarketplace();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [profile]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      // 1. Search Query (Super Admin can also search by brand/artist; shoppers search products & crafts)
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.productName.toLowerCase().includes(q) ||
        (p.storeDescription || '').toLowerCase().includes(q) ||
        (p.craftName || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (isSuperAdmin &&
          ((p.brandName || '').toLowerCase().includes(q) ||
            (p.artistName || '').toLowerCase().includes(q)));

      // 2. Decor Category Tabs
      let matchDecor = true;
      if (selectedDecorCategory !== 'all') {
        if (p.decorCategory && p.decorCategory !== 'all') {
          matchDecor = p.decorCategory === selectedDecorCategory;
        } else {
          const decorDef = DECOR_CATEGORIES.find((d) => d.id === selectedDecorCategory);
          const text = `${p.productName || ''} ${p.category || ''} ${p.craftName || ''} ${p.storeDescription || ''}`.toLowerCase();
          matchDecor = decorDef ? decorDef.keywords.some((kw) => text.includes(kw)) : true;
        }
      }

      // 3. Linked Section & Sub-Craft Filter
      let matchTaxonomy = true;
      if (selectedSubCrafts.length > 0) {
        matchTaxonomy = selectedSubCrafts.some((craftId) => matchesSubCraft(p, craftId));
      } else if (selectedMainSections.length > 0) {
        const sectionCrafts = SUB_CRAFTS_REGISTRY.filter((c) =>
          selectedMainSections.includes(c.mainSectionId)
        );
        const directSectionMatch = selectedMainSections.some((secId) => {
          const secDef = MAIN_SECTIONS.find((s) => s.id === secId);
          return (
            p.mainSectionId === secId ||
            (secDef && (p.mainSectionName === secDef.nameAr || p.productType === secDef.nameAr))
          );
        });
        matchTaxonomy =
          directSectionMatch || sectionCrafts.some((c) => matchesSubCraft(p, c.id));
      }

      return matchSearch && matchDecor && matchTaxonomy;
    });

    if (sortBy === 'price_asc') {
      return [...filtered].sort(
        (a, b) => (a.storePrice || a.retailPrice || 0) - (b.storePrice || b.retailPrice || 0)
      );
    }
    if (sortBy === 'price_desc') {
      return [...filtered].sort(
        (a, b) => (b.storePrice || b.retailPrice || 0) - (a.storePrice || a.retailPrice || 0)
      );
    }
    return filtered;
  }, [products, searchQuery, selectedDecorCategory, selectedMainSections, selectedSubCrafts, sortBy, isSuperAdmin]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedDecorCategory !== 'all' ||
    selectedMainSections.length > 0 ||
    selectedSubCrafts.length > 0;

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedDecorCategory('all');
    setSelectedMainSections([]);
    setSelectedSubCrafts([]);
    setSortBy('featured');
    setOpenDropdown(null);
  };

  // Open Product Modal
  const handleOpenProductDetails = (product: MarketplaceProductRecord) => {
    setSelectedProductDetails(product);
    setModalQuantity(1);
    setModalSelectedColor(product.availableColors?.[0] || 'اللون الأصلي');
    setModalSelectedSize(product.availableSizes?.[0] || 'المقاس القياسي');
    setModalCustomNotes('');
    setReviewGuardError('');
  };

  // Add to persistent cart (preserving silent internal workshop/artist attribution for Super Admin & orders)
  const handleAddToCart = (
    product: MarketplaceProductRecord,
    qty?: number,
    color?: string,
    size?: string
  ) => {
    const chosenQty = qty || modalQuantity || 1;
    const item: MarketplaceCartItem = {
      id: 'cart_' + Date.now(),
      productId: product.id,
      productName: product.productName,
      price: product.storePrice || product.retailPrice || 0,
      quantity: chosenQty,
      imageUrl: product.imageUrl,
      craftName: product.craftName,
      workshopId: product.workshopId || product.tenantId || 'central',
      artistName: product.artistName || 'فنان الشمساوية',
      selectedColor: color || modalSelectedColor || product.availableColors?.[0] || 'اللون الأصلي',
      selectedSize: size || modalSelectedSize || product.availableSizes?.[0] || 'المقاس القياسي',
      customNotes: modalCustomNotes.trim() || undefined,
    };

    addToCart(item);
    playSuccessSound();
    setFeedback(`تمت إضافة "${product.productName}" إلى السلة`);
    setTimeout(() => setFeedback(''), 3000);
    setSelectedProductDetails(null);
    setIsCartOpen(true);
  };

  // Add Verified Review
  const handleAddReview = (productId: string) => {
    setReviewGuardError('');
    const phone = customerUser?.phone || newReviewPhone.trim();
    const author = customerUser?.name || newReviewAuthor.trim();

    if (!author) {
      setReviewGuardError('يرجى كتابة الاسم.');
      return;
    }
    if (!phone || phone.length < 10) {
      setReviewGuardError('يرجى إدخال رقم الهاتف للتحقق من الطلب.');
      return;
    }
    if (!newReviewComment.trim()) {
      setReviewGuardError('يرجى كتابة تقييمك للمنتج.');
      return;
    }

    const check = canCustomerReviewProduct(productId, phone);
    if (!check.allowed) {
      setReviewGuardError(check.reason || 'التقييم متاح بعد استلام الطلب.');
      playAlertSound();
      return;
    }

    addProductReview(productId, {
      productId,
      authorName: author,
      authorPhone: phone,
      rating: newReviewRating,
      comment: newReviewComment.trim(),
      verifiedBuyer: true,
    });

    playSuccessSound();
    setNewReviewComment('');
    setFeedback('تم نشر تقييمك بنجاح');
    setTimeout(() => setFeedback(''), 3500);
  };

  const sectionButtonLabel = useMemo(() => {
    if (selectedMainSections.length === 0) return 'القسم: الكل';
    if (selectedMainSections.length === 1) {
      const sec = MAIN_SECTIONS.find((s) => s.id === selectedMainSections[0]);
      return `القسم: ${sec?.nameAr || '1'}`;
    }
    return `الأقسام (${selectedMainSections.length})`;
  }, [selectedMainSections]);

  const craftButtonLabel = useMemo(() => {
    if (selectedSubCrafts.length === 0) return 'التخصص: الكل';
    if (selectedSubCrafts.length === 1) {
      const c = SUB_CRAFTS_REGISTRY.find((sc) => sc.id === selectedSubCrafts[0]);
      return `التخصص: ${c?.nameAr || '1'}`;
    }
    return `التخصصات (${selectedSubCrafts.length})`;
  }, [selectedSubCrafts]);

  const scrollToCatalog = () => {
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className="min-h-screen bg-[#F2ECE1] text-[#0C1427] dark:bg-[#060B18] dark:text-[#F7F3EA] font-sans pb-16 max-w-full overflow-x-hidden transition-colors duration-200"
      dir="rtl"
    >
      {/* 1. Unified Clean Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark (single line, zero descriptor clutter) */}
          <button
            type="button"
            onClick={resetAllFilters}
            className="flex items-center gap-2.5 cursor-pointer text-right shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] rounded-xl"
            title="سوق الشمساوية"
          >
            <AlShamsBrandIcon size="sm" />
            <span className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] whitespace-nowrap">
              سوق الشمساوية
            </span>
          </button>

          {/* Zone 2: Integrated Amazon/Noon Desktop Search Bar */}
          <div className="hidden md:block flex-1 max-w-xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مشغولة يدوية، ديكور، أو حرفة..."
              className="w-full h-10 pr-10 pl-14 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] placeholder-[#475569] dark:placeholder-[#94A3B8] text-sm font-medium outline-none focus:border-[#EA580C] dark:focus:border-[#FBBF24] transition-colors"
            />
            <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#C2410C] dark:text-[#FBBF24] font-bold cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>

          {/* Zone 3: Concise Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {customerUser ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs whitespace-nowrap">
                <User className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                <span className="font-bold truncate max-w-[110px]">{customerUser.name}</span>
                <span className="text-[#475569] dark:text-[#94A3B8]" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#C2410C] dark:text-[#FBBF24] font-bold">
                  {customerUser.loyaltyPoints} نقطة
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCustomerAuthOpen(true)}
                className="px-3 py-2 rounded-xl text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <User className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />
                <span className="hidden sm:inline">حسابي</span>
              </button>
            )}

            {onOpenStoreModal && profile && (
              <button
                type="button"
                onClick={onOpenStoreModal}
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                title="إدارة الكتالوج والمتجر"
              >
                <Store className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                <span className="hidden lg:inline">متجري</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              title="فتح سلة المشتريات"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>السلة</span>
              {cartItemsCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#0C1427] text-[#FBBF24] font-mono tabular-nums text-[11px] font-black flex items-center justify-center">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Editorial Showcase Hero (Hidden while searching/filtering so results rise straight to top) */}
      {!hasActiveFilters && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch rounded-2xl overflow-hidden bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
            <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-center gap-4 text-right">
              <p className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                مشغولات يدوية · ديكور وأثاث منزلي
              </p>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight text-[#0C1427] dark:text-[#F7F3EA] text-balance">
                اقتنِ قطعاً يدوية أصيلة لمنزلك
              </h1>
              <p className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed max-w-md">
                تشكيلة مختارة من الديكورات والمشغولات الحرفية بتصنيع متقن وتوصيل لكافة المحافظات.
              </p>
              <div className="pt-1 flex items-center gap-4">
                <button
                  type="button"
                  onClick={scrollToCatalog}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-sm inline-flex items-center gap-2 transition cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <span>تصفح المعروضات</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8] tabular-nums">
                  {products.length} قطعة متاحة
                </span>
              </div>
            </div>

            <div className="lg:col-span-7 min-h-[190px] sm:min-h-[250px] bg-gradient-to-br from-[#E9E2D4] to-[#DFD7C6] dark:from-[#0D162E] dark:to-[#132040] relative overflow-hidden">
              <img
                src="/src/assets/images/hero_shamsawiyah_market_1794585781201.jpg"
                alt="تشكيلة مشغولات يدوية وديكور منزلي في سوق الشمساوية"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover lg:absolute lg:inset-0"
              />
            </div>
          </div>
        </section>
      )}

      {/* 3. Categories & Clean Filter Toolbar */}
      <section
        ref={(el) => {
          filterAreaRef.current = el as HTMLDivElement | null;
          catalogSectionRef.current = el;
        }}
        className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-3 space-y-3"
      >
        {/* Mobile Search Bar */}
        <div className="md:hidden relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن مشغولة يدوية أو حرفة..."
            className="w-full h-11 pr-10 pl-14 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] placeholder-[#475569] dark:placeholder-[#94A3B8] text-sm font-medium outline-none focus:border-[#EA580C]"
          />
          <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[#C2410C] dark:text-[#FBBF24] font-bold cursor-pointer"
            >
              مسح
            </button>
          )}
        </div>

        {/* Horizontal Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {DECOR_CATEGORIES.map((cat) => {
            const active = selectedDecorCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedDecorCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                  active
                    ? 'bg-[#0C1427] text-[#F7F3EA] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C]'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60'
                }`}
              >
                {cat.nameAr}
              </button>
            );
          })}
        </div>

        {/* Linked Section + Craft Filters + Sort + Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 flex-1">
            {/* Dropdown 1: القسم */}
            <div className="relative sm:w-52">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'section' ? null : 'section'))}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer whitespace-nowrap ${
                  selectedMainSections.length > 0
                    ? 'bg-[#EA580C]/10 border-[#EA580C] text-[#C2410C] dark:text-[#FBBF24]'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C]/60'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Layers className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24] shrink-0" />
                  <span className="truncate">{sectionButtonLabel}</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${openDropdown === 'section' ? 'rotate-180' : ''}`}
                />
              </button>

              {openDropdown === 'section' && (
                <div className="absolute right-0 left-0 sm:w-64 mt-1.5 z-50 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xl p-1.5 space-y-1 max-h-72 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => toggleMainSection('all')}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      selectedMainSections.length === 0
                        ? 'bg-[#EA580C] text-white'
                        : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54]'
                    }`}
                  >
                    <span>الكل (كافة الأقسام)</span>
                    {selectedMainSections.length === 0 && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {MAIN_SECTIONS.map((sec) => {
                    const isChecked = selectedMainSections.includes(sec.id);
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => toggleMainSection(sec.id)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer text-right ${
                          isChecked
                            ? 'bg-[#EA580C]/10 text-[#C2410C] dark:text-[#FBBF24]'
                            : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54]'
                        }`}
                      >
                        <span className="truncate">{sec.nameAr}</span>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            isChecked
                              ? 'bg-[#EA580C] border-[#EA580C] text-white'
                              : 'border-[#D4CCBC] dark:border-[#2D4475]'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dropdown 2: التخصص / الحرفة */}
            <div className="relative sm:w-52">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'craft' ? null : 'craft'))}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer whitespace-nowrap ${
                  selectedSubCrafts.length > 0
                    ? 'bg-[#EA580C]/10 border-[#EA580C] text-[#C2410C] dark:text-[#FBBF24]'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C]/60'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Store className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24] shrink-0" />
                  <span className="truncate">{craftButtonLabel}</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${openDropdown === 'craft' ? 'rotate-180' : ''}`}
                />
              </button>

              {openDropdown === 'craft' && (
                <div className="absolute right-0 left-0 sm:w-64 mt-1.5 z-50 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xl p-1.5 space-y-1 max-h-72 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => toggleSubCraft('all')}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      selectedSubCrafts.length === 0
                        ? 'bg-[#EA580C] text-white'
                        : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54]'
                    }`}
                  >
                    <span>الكل ({availableSubCrafts.length} تخصص)</span>
                    {selectedSubCrafts.length === 0 && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {availableSubCrafts.map((craft) => {
                    const isChecked = selectedSubCrafts.includes(craft.id);
                    return (
                      <button
                        key={craft.id}
                        type="button"
                        onClick={() => toggleSubCraft(craft.id)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer text-right ${
                          isChecked
                            ? 'bg-[#EA580C]/10 text-[#C2410C] dark:text-[#FBBF24]'
                            : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54]'
                        }`}
                      >
                        <span className="truncate">{craft.nameAr}</span>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            isChecked
                              ? 'bg-[#EA580C] border-[#EA580C] text-white'
                              : 'border-[#D4CCBC] dark:border-[#2D4475]'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="h-10 px-3 rounded-xl text-xs font-bold text-[#C2410C] dark:text-[#FBBF24] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54] flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>

          {/* Sort + Results Summary */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <span className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] tabular-nums">
              {filteredProducts.length} منتج
            </span>

            <div className="relative flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8] absolute right-3 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="ترتيب المنتجات"
                className="h-10 pr-8 pl-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C] cursor-pointer"
              >
                <option value="featured">الأحدث</option>
                <option value="price_asc">السعر: الأقل للأعلى</option>
                <option value="price_desc">السعر: الأعلى للأقل</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Banner */}
      {feedback && (
        <div className="max-w-xl mx-auto px-4 mb-4">
          <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center shadow-md">
            {feedback}
          </div>
        </div>
      )}

      {/* 4. Global E-Commerce Product Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-2">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden animate-pulse"
              >
                <div className="w-full aspect-[4/3] bg-[#E9E2D4] dark:bg-[#132040]" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-1/2" />
                  <div className="h-4 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-4/5" />
                  <div className="h-5 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-1/3" />
                  <div className="h-9 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-14 text-center rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <ShoppingBag className="w-10 h-10 mx-auto text-[#C2410C] dark:text-[#FBBF24] opacity-70" />
            <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              لا توجد منتجات مطابقة لخيارات البحث
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1]">
              جرّب تغيير القسم أو التخصص أو مسح كلمات البحث.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs cursor-pointer transition"
              >
                عرض جميع المنتجات
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((p) => {
              const hasStock = (p.currentStock || 0) > 0;
              const price = p.storePrice || p.retailPrice || 0;
              const reviews = getProductReviews(p.id);
              const avgRating =
                reviews.length > 0
                  ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
                  : '5.0';

              return (
                <article
                  key={p.id}
                  onClick={() => handleOpenProductDetails(p)}
                  className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden hover:border-[#EA580C]/60 dark:hover:border-[#FBBF24]/50 transition-all duration-200 flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div>
                    {/* Product Image (clean photography, no pill overlays) */}
                    <div className="w-full aspect-[4/3] bg-[#E9E2D4] dark:bg-[#132040] overflow-hidden border-b border-[#D4CCBC]/70 dark:border-[#22355E]">
                      <img
                        src={p.imageUrl || '/alshams_falcon_emblem.png'}
                        alt={p.productName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/alshams_falcon_emblem.png';
                        }}
                      />
                    </div>

                    {/* Card Details */}
                    <div className="p-4 space-y-2">
                      {/* Unboxed Metadata + Rating */}
                      <div className="flex items-center justify-between gap-2 text-xs text-[#475569] dark:text-[#94A3B8]">
                        <span className="truncate font-medium">
                          {p.craftName || p.category} · {hasStock ? 'متوفر' : 'تنفيذ بالطلب'}
                        </span>
                        <span className="flex items-center gap-1 font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA] font-bold shrink-0">
                          <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                          <span>{avgRating}</span>
                        </span>
                      </div>

                      <h3 className="font-bold text-sm sm:text-base text-[#0C1427] dark:text-[#F7F3EA] line-clamp-2 leading-snug group-hover:text-[#C2410C] dark:group-hover:text-[#FBBF24] transition-colors">
                        {p.productName}
                      </h3>

                      {p.storeDescription && (
                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] line-clamp-1">
                          {p.storeDescription}
                        </p>
                      )}

                      {/* Super Admin ONLY: Quiet internal ownership line (completely hidden from customers) */}
                      {isSuperAdmin && (
                        <p className="text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24] truncate pt-0.5">
                          الورشة: {p.brandName || 'الشمساوية'} · {p.artistName || 'فنان'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Aligned Price & CTA Footer */}
                  <div className="px-4 pb-4 pt-1 space-y-3">
                    <div className="flex items-baseline gap-1 font-mono tabular-nums">
                      <span className="text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        {price.toLocaleString('ar-EG')}
                      </span>
                      <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">ج.م</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(p, 1);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>أضف للسلة</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. Product Details Modal (Contiguous Purchase Module) */}
      {selectedProductDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#060B18]/75 backdrop-blur-sm"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProductDetails(null);
          }}
        >
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto text-right shadow-2xl p-5 sm:p-6 space-y-6 text-[#0C1427] dark:text-[#F7F3EA] relative">
            <button
              type="button"
              onClick={() => setSelectedProductDetails(null)}
              className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center transition cursor-pointer absolute top-4 left-4"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              {/* Product Media */}
              <div className="w-full aspect-[4/3] md:aspect-square rounded-2xl overflow-hidden bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                <img
                  src={selectedProductDetails.imageUrl || '/alshams_falcon_emblem.png'}
                  alt={selectedProductDetails.productName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/alshams_falcon_emblem.png';
                  }}
                />
              </div>

              {/* Contiguous Purchase Module */}
              <div className="space-y-4 text-xs leading-relaxed flex flex-col justify-between">
                <div className="space-y-3 pl-8 md:pl-0">
                  <p className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                    {selectedProductDetails.craftName || selectedProductDetails.category} ·{' '}
                    {(selectedProductDetails.currentStock || 0) > 0 ? 'متوفر' : 'تنفيذ بالطلب'}
                  </p>

                  <h3 className="font-black text-xl text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                    {selectedProductDetails.productName}
                  </h3>

                  <div className="flex items-baseline gap-1.5 font-mono tabular-nums pt-1">
                    <span className="text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {(
                        selectedProductDetails.storePrice ||
                        selectedProductDetails.retailPrice ||
                        0
                      ).toLocaleString('ar-EG')}
                    </span>
                    <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">ج.م</span>
                  </div>

                  {/* Super Admin ONLY attribution (never visible to customers) */}
                  {isSuperAdmin && (
                    <div className="py-2 px-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-1">
                      <p className="font-bold text-[#C2410C] dark:text-[#FBBF24]">
                        الورشة: {selectedProductDetails.brandName || 'الشمساوية'} · الفنان:{' '}
                        {selectedProductDetails.artistName || 'غير محدد'}
                      </p>
                      {selectedProductDetails.phoneNumber && (
                        <p className="font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]" dir="ltr">
                          {selectedProductDetails.phoneNumber}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                    {selectedProductDetails.storeDescription ||
                      selectedProductDetails.input?.personalNotes ||
                      'مشغولة يدوية مصنوعة بإتقان وجودة عالية.'}
                  </p>

                  {selectedProductDetails.availableColors &&
                    selectedProductDetails.availableColors.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                          الألوان المتاحة
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProductDetails.availableColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setModalSelectedColor(color)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                modalSelectedColor === color
                                  ? 'bg-[#EA580C] text-white border-[#EA580C]'
                                  : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                              }`}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {selectedProductDetails.availableSizes &&
                    selectedProductDetails.availableSizes.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                          المقاسات المتاحة
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProductDetails.availableSizes.map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setModalSelectedSize(size)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                modalSelectedSize === size
                                  ? 'bg-[#EA580C] text-white border-[#EA580C]'
                                  : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="pt-1">
                    <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                      ملاحظات على الطلب (اختياري)
                    </label>
                    <input
                      type="text"
                      value={modalCustomNotes}
                      onChange={(e) => setModalCustomNotes(e.target.value)}
                      placeholder="تخصيص لون أو مقاس..."
                      className="w-full px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] text-xs outline-none focus:border-[#EA580C] font-medium"
                    />
                  </div>
                </div>

                {/* Quantity & Buy CTA */}
                <div className="pt-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                      className="w-7 h-7 rounded-lg bg-[#F7F3EA] dark:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono tabular-nums font-black text-sm">
                      {modalQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalQuantity(modalQuantity + 1)}
                      className="w-7 h-7 rounded-lg bg-[#F7F3EA] dark:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(selectedProductDetails)}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      أضف للسلة ·{' '}
                      {(
                        (selectedProductDetails.storePrice ||
                          selectedProductDetails.retailPrice ||
                          0) * modalQuantity
                      ).toLocaleString('ar-EG')}{' '}
                      ج.م
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Verified Reviews Section */}
            <div className="border-t border-[#D4CCBC] dark:border-[#22355E] pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <Star className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>تقييمات المشترين</span>
                </h4>
                <span className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  متاح بعد استلام الطلب
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {getProductReviews(selectedProductDetails.id).length === 0 ? (
                  <p className="py-3 text-xs text-[#475569] dark:text-[#94A3B8] text-center">
                    لا توجد تقييمات حتى الآن.
                  </p>
                ) : (
                  getProductReviews(selectedProductDetails.id).map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-xl bg-[#E9E2D4]/75 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{rev.authorName}</span>
                        <div className="flex items-center gap-0.5 text-[#F59E0B]">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-[#F59E0B]" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[#334155] dark:text-[#CBD5E1] text-xs">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#E9E2D4]/65 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={customerUser?.name || newReviewAuthor}
                    onChange={(e) => setNewReviewAuthor(e.target.value)}
                    placeholder="الاسم"
                    disabled={!!customerUser}
                    className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] outline-none font-bold disabled:opacity-75"
                  />
                  <input
                    type="tel"
                    value={customerUser?.phone || newReviewPhone}
                    onChange={(e) => setNewReviewPhone(e.target.value)}
                    placeholder="رقم الهاتف المستخدم في الطلب"
                    disabled={!!customerUser}
                    className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] outline-none font-bold font-mono disabled:opacity-75"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#334155] dark:text-[#CBD5E1] font-bold">التقييم:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewReviewRating(s)}
                        className="cursor-pointer"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            newReviewRating >= s
                              ? 'fill-[#F59E0B] text-[#F59E0B]'
                              : 'text-[#D4CCBC] dark:text-[#2D4475]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  placeholder="اكتب رأيك في المنتج..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] outline-none font-medium text-xs resize-none"
                />

                {reviewGuardError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{reviewGuardError}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleAddReview(selectedProductDetails.id)}
                    className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs cursor-pointer transition"
                  >
                    نشر التقييم
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Cart Modal (Deposit details appear cleanly inside checkout) */}
      <MarketplaceCartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        customerUser={customerUser}
        onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
        onOrderSuccess={(order) => {
          setFeedback(`تم تسجيل طلبك بنجاح برقم #${order.invoiceNumber}`);
        }}
      />

      {/* Customer Auth Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        onContinueAsGuest={() => setIsCustomerAuthOpen(false)}
        onSuccessLogin={(user) => {
          setCustomerUser(user);
          setIsCustomerAuthOpen(false);
          setFeedback(`أهلاً بك يا ${user.name}`);
          setTimeout(() => setFeedback(''), 3500);
        }}
      />

      {/* Clean Minimal Footer */}
      <footer className="mt-16 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] py-5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-4">
          <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            سوق الشمساوية للفنون اليدوية
          </span>
          <a
            href="https://wa.me/201000996059"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>الدعم الفني</span>
          </a>
        </div>
      </footer>
    </div>
  );
};
