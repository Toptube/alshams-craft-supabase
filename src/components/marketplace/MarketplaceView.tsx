import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserProfile,
  SavedProductRecord,
  CustomerAuthUser,
  MarketplaceCartItem,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  getStoredCart,
  addToCart,
  getStoredCustomerSession,
  canCustomerReviewProduct,
  addProductReview,
  getProductReviews,
} from '../../services/marketplaceCartService';
import { fetchApprovedMarketplaceProducts } from '../../db/marketplaceCloud';
import { supabase } from '../../lib/supabase';
import { MAIN_SECTIONS, SUB_CRAFTS_REGISTRY } from '../../registry/craftsRegistry';
import { CustomerAuthModal } from './CustomerAuthModal';
import { MarketplaceCartModal } from './MarketplaceCartModal';
import { playSuccessSound, playAlertSound } from '../../lib/sounds';
import {
  ShoppingBag,
  Store,
  Star,
  Search,
  Layers,
  Phone,
  ExternalLink,
  ChevronDown,
  ShieldCheck,
  User,
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  RotateCcw,
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
  { id: 'all', nameAr: 'كافة المعروضات', icon: '🌟', keywords: [] as string[] },
  { id: 'wall_hangings', nameAr: 'معلقات جدارية', icon: '🖼️', keywords: ['معلق', 'جدار', 'تابلوه', 'طارة', 'برواز', 'مرآة'] },
  { id: 'cushions', nameAr: 'كوشن وتكايات', icon: '🛋️', keywords: ['كوشن', 'مخد', 'تكا', 'غطاء'] },
  { id: 'bags_clutches', nameAr: 'شنط وكلاتشات', icon: '👜', keywords: ['شنط', 'كلاتش', 'حقيب', 'zara'] },
  { id: 'rugs_runners', nameAr: 'سجاد ورانرات', icon: '🧶', keywords: ['سجاد', 'رانر', 'كليم', 'مفرش'] },
  { id: 'lighting', nameAr: 'إضاءة وأباجورات', icon: '💡', keywords: ['إضاء', 'أباجور', 'نجف', 'فانوس', 'شمع'] },
  { id: 'baskets_trays', nameAr: 'صواني وباسكت ومنظمات', icon: '🧺', keywords: ['صين', 'باسكت', 'سبت', 'منظم', 'بوكس', 'سل'] },
  { id: 'furniture_decor', nameAr: 'قطع أثاث وديكور', icon: '🪑', keywords: ['أثاث', 'كرسي', 'أرجوح', 'طربيز', 'بوف', 'فاز', 'ديكور'] },
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
  const [products, setProducts] = useState<MarketplaceProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Decor Horizontal Category Tabs
  const [selectedDecorCategory, setSelectedDecorCategory] = useState<string>('all');

  // 2. Linked Multi-Select Dropdowns: القسم (Main Sections) -> الورش (Sub-Crafts)
  const [selectedMainSections, setSelectedMainSections] = useState<string[]>([]);
  const [selectedSubCrafts, setSelectedSubCrafts] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'section' | 'craft' | null>(null);
  const filterAreaRef = useRef<HTMLDivElement>(null);

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
  }, [selectedMainSections, availableSubCrafts]);

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

  // Load products across ALL workshops (approved + pending_approval provisionally, excluding rejected)
  useEffect(() => {
    let isMounted = true;
    const fetchMarketplace = async () => {
      setLoading(true);
      try {
        const cloudProducts = await fetchApprovedMarketplaceProducts().catch(() => []);
        const cloudMapped: MarketplaceProductRecord[] = (cloudProducts || [])
          .filter((cp) => cp.status !== 'rejected')
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
            isMarketplaceApproved: cp.status === 'approved',
            marketStatus: cp.status,
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

        // Local workshop fallback when offline or newly exported locally
        let publishedLocal: MarketplaceProductRecord[] = [];
        if (profile) {
          const tenantId = profile.tenantId || profile.workshopId || profile.id;
          if (tenantId) {
            const localProds = await tenantStorage.getProducts(tenantId).catch(() => []);
            publishedLocal = localProds
              .filter((p) => p && p.inStore && p.isPublishedInStore !== false)
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

    const channel = supabase
      .channel('public_marketplace_realtime_sync')
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
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.productName.toLowerCase().includes(q) ||
        (p.storeDescription || '').toLowerCase().includes(q) ||
        (p.craftName || '').toLowerCase().includes(q) ||
        (p.brandName || '').toLowerCase().includes(q) ||
        (p.artistName || '').toLowerCase().includes(q);

      // 2. Decor Category Tabs (المعروضات)
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

      // 3. Linked Section & Sub-Craft Filter (القسم -> الورش)
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
  }, [products, searchQuery, selectedDecorCategory, selectedMainSections, selectedSubCrafts]);

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

  // Add to persistent cart (unchanged cart mechanism)
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
      setReviewGuardError('يرجى كتابة تقييمك للمشغولة.');
      return;
    }

    const check = canCustomerReviewProduct(productId, phone);
    if (!check.allowed) {
      setReviewGuardError(check.reason || 'التقييم متاح بعد استلام المشغولة.');
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
    return `القسم (${selectedMainSections.length})`;
  }, [selectedMainSections]);

  const craftButtonLabel = useMemo(() => {
    if (selectedSubCrafts.length === 0) return 'الورش: الكل';
    if (selectedSubCrafts.length === 1) {
      const c = SUB_CRAFTS_REGISTRY.find((sc) => sc.id === selectedSubCrafts[0]);
      return `الورش: ${c?.nameAr || '1'}`;
    }
    return `الورش (${selectedSubCrafts.length})`;
  }, [selectedSubCrafts]);

  return (
    <div className="min-h-screen bg-[#080F1E] text-white font-sans pb-20 max-w-full overflow-x-hidden" dir="rtl">
      {/* 1. Top Marketplace Header */}
      <header className="sticky top-0 z-40 bg-[#0C1427]/95 backdrop-blur-md border-b border-amber-500/30 px-3 sm:px-6 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetAllFilters}
            className="flex items-center gap-2.5 cursor-pointer text-right group shrink-0"
            title="سوق الشمساوية"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition">
              🛍️
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-amber-300 whitespace-nowrap">
                سوق الشمساوية
              </h1>
              <p className="text-[11px] text-stone-400 font-medium hidden sm:block">
                معروضات جميع ورش وفناني الشمساوية
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {customerUser ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs whitespace-nowrap">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white truncate max-w-[110px]">{customerUser.name}</span>
                <span className="text-[11px] font-mono tabular-nums text-amber-300">
                  {customerUser.loyaltyPoints} نقطة
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCustomerAuthOpen(true)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">حساب العميل</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition cursor-pointer whitespace-nowrap"
              title="فتح سلة المشتريات"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">السلة</span>
              {cartItemsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono tabular-nums text-[10px] font-black">
                  {cartItemsCount}
                </span>
              )}
            </button>

            {onOpenStoreModal && (
              <button
                type="button"
                onClick={onOpenStoreModal}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-amber-500/20 whitespace-nowrap"
                title="متجر ورشتي"
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden md:inline">متجري</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Search + Linked 2-Dropdown Filter Toolbar */}
      <section className="px-4 pt-5 pb-3 max-w-7xl mx-auto space-y-4" ref={filterAreaRef}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Search Input */}
          <div className="lg:col-span-6 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم القطعة، الحرفة، الورشة أو الفنان..."
              className="w-full h-11 px-4 pr-11 rounded-2xl bg-[#0C1427] border border-amber-500/35 text-white placeholder-stone-400 text-xs sm:text-sm font-bold outline-none focus:border-amber-400 shadow-lg"
            />
            <Search className="w-4 h-4 text-amber-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-white font-bold cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>

          {/* Dropdown 1: القسم (Main Sections Multi-Select) */}
          <div className="lg:col-span-3 relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === 'section' ? null : 'section'))}
              className={`w-full h-11 px-3.5 rounded-2xl border text-xs font-black flex items-center justify-between gap-2 transition cursor-pointer ${
                selectedMainSections.length > 0
                  ? 'bg-amber-600/20 border-amber-400 text-amber-200'
                  : 'bg-[#0C1427] border-amber-500/35 text-stone-200 hover:border-amber-400'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{sectionButtonLabel}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform shrink-0 ${openDropdown === 'section' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'section' && (
              <div className="absolute right-0 left-0 mt-2 z-50 rounded-2xl bg-[#0C1427] border border-amber-500/40 shadow-2xl p-2 space-y-1 max-h-72 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => toggleMainSection('all')}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    selectedMainSections.length === 0
                      ? 'bg-amber-500 text-stone-950 font-black'
                      : 'text-stone-200 hover:bg-white/5'
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
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer text-right ${
                        isChecked
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                          : 'text-stone-200 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{sec.nameAr}</span>
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                          isChecked
                            ? 'bg-amber-500 border-amber-400 text-stone-950'
                            : 'border-stone-600'
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

          {/* Dropdown 2: الورش (Dynamic Sub-Crafts Multi-Select) */}
          <div className="lg:col-span-3 relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === 'craft' ? null : 'craft'))}
              className={`w-full h-11 px-3.5 rounded-2xl border text-xs font-black flex items-center justify-between gap-2 transition cursor-pointer ${
                selectedSubCrafts.length > 0
                  ? 'bg-amber-600/20 border-amber-400 text-amber-200'
                  : 'bg-[#0C1427] border-amber-500/35 text-stone-200 hover:border-amber-400'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Store className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{craftButtonLabel}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform shrink-0 ${openDropdown === 'craft' ? 'rotate-180' : ''}`} />
            </button>

            {openDropdown === 'craft' && (
              <div className="absolute right-0 left-0 mt-2 z-50 rounded-2xl bg-[#0C1427] border border-amber-500/40 shadow-2xl p-2 space-y-1 max-h-72 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => toggleSubCraft('all')}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    selectedSubCrafts.length === 0
                      ? 'bg-amber-500 text-stone-950 font-black'
                      : 'text-stone-200 hover:bg-white/5'
                  }`}
                >
                  <span>الكل ({availableSubCrafts.length} ورشة)</span>
                  {selectedSubCrafts.length === 0 && <Check className="w-3.5 h-3.5" />}
                </button>

                {availableSubCrafts.map((craft) => {
                  const isChecked = selectedSubCrafts.includes(craft.id);
                  return (
                    <button
                      key={craft.id}
                      type="button"
                      onClick={() => toggleSubCraft(craft.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer text-right ${
                        isChecked
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                          : 'text-stone-200 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{craft.nameAr}</span>
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                          isChecked
                            ? 'bg-amber-500 border-amber-400 text-stone-950'
                            : 'border-stone-600'
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
        </div>

        {/* 3. المعروضات (Horizontal Decor Category Tabs) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {DECOR_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedDecorCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedDecorCategory === cat.id
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-[#0C1427] text-stone-300 hover:text-white border border-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.nameAr}</span>
            </button>
          ))}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 whitespace-nowrap flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط</span>
            </button>
          )}
        </div>
      </section>

      {/* Feedback Banner */}
      {feedback && (
        <div className="max-w-xl mx-auto px-4 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold text-center">
            {feedback}
          </div>
        </div>
      )}

      {/* 4. Products Grid */}
      <main className="max-w-7xl mx-auto px-4 pt-2">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-amber-200 font-bold">جاري تحميل معروضات سوق الشمساوية...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-14 text-center rounded-3xl bg-[#0C1427] border border-amber-500/20 space-y-3">
            <ShoppingBag className="w-12 h-12 mx-auto text-amber-500/50" />
            <h3 className="text-sm font-black text-amber-200">لا توجد مشغولات مطابقة للتصفية الحالية</h3>
            <p className="text-xs text-stone-400">
              جرّب تغيير القسم أو الورشة أو مسح كلمات البحث.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-black text-xs cursor-pointer"
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
              const avgRating = reviews.length > 0
                ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
                : '5.0';
              const storeHref = `/#/store/${encodeURIComponent(p.storeSlug || p.workshopId || '')}`;

              return (
                <div
                  key={p.id}
                  onClick={() => handleOpenProductDetails(p)}
                  className="rounded-3xl bg-[#0C1427] border border-amber-500/25 overflow-hidden hover:border-amber-400 transition-all duration-200 shadow-lg flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5"
                >
                  <div>
                    {/* Product Image */}
                    <div className="relative w-full aspect-[4/3] bg-[#080F1E] overflow-hidden">
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

                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="px-2.5 py-1 rounded-xl bg-[#080F1E]/90 text-amber-300 font-mono tabular-nums font-black text-sm border border-amber-500/40 shadow-md">
                          {price.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    {/* Card Metadata & Details */}
                    <div className="p-4 space-y-2.5">
                      {/* Clean typographic metadata row */}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-stone-400">
                        <span className="text-amber-400 font-bold truncate">
                          {p.craftName || p.category} · {hasStock ? `متاح (${p.currentStock})` : 'حسب الطلب'}
                        </span>
                        <span className="flex items-center gap-1 text-amber-300 font-mono tabular-nums shrink-0">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{avgRating}</span>
                        </span>
                      </div>

                      <h3 className="font-black text-sm sm:text-base text-white line-clamp-1 group-hover:text-amber-300 transition-colors">
                        {p.productName}
                      </h3>

                      {p.storeDescription && (
                        <p className="text-xs text-[#EADBC8]/90 line-clamp-2 leading-relaxed">
                          {p.storeDescription}
                        </p>
                      )}

                      {/* Workshop & Artisan Identity + Direct Store Link */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.logoUrl ? (
                            <img
                              src={p.logoUrl}
                              alt={p.brandName || 'الورشة'}
                              className="w-7 h-7 rounded-lg object-cover border border-amber-500/30 bg-white shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                              <Store className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="min-w-0 text-right">
                            <p className="text-xs font-black text-white truncate">
                              {p.brandName || 'ورشة الشمساوية'}
                            </p>
                            <p className="text-[11px] text-stone-400 truncate">
                              الفنان: {p.artistName || 'فنان الشمساوية'}
                            </p>
                          </div>
                        </div>

                        {p.workshopId && (
                          <a
                            href={storeHref}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0"
                            title="زيارة متجر الورشة"
                          >
                            <span>المتجر</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {p.phoneNumber && (
                        <div className="text-[11px] text-stone-400 flex items-center gap-1.5 font-mono tabular-nums">
                          <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span dir="ltr">{p.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="px-4 pb-4 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(p, 1);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>أضف للسلة (عربون 33%)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. Product Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md" dir="rtl">
          <div className="bg-[#0C1427] border border-amber-500/40 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto text-right shadow-2xl p-5 sm:p-6 space-y-5 text-white relative">
            <button
              type="button"
              onClick={() => setSelectedProductDetails(null)}
              className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-amber-500/20 pb-3 pl-10 space-y-1">
              <div className="text-xs text-amber-400 font-bold flex flex-wrap items-center gap-2">
                <span>{selectedProductDetails.craftName || selectedProductDetails.category}</span>
                <span>·</span>
                <span>{selectedProductDetails.brandName || 'ورشة الشمساوية'}</span>
                <span>·</span>
                <span>الفنان: {selectedProductDetails.artistName || 'فنان الشمساوية'}</span>
              </div>
              <h3 className="font-black text-base sm:text-lg text-white">
                {selectedProductDetails.productName}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-black/40 border border-amber-500/30">
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

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#080F1E] border border-amber-500/30">
                  <span className="text-stone-300 font-bold">السعر:</span>
                  <span className="font-mono tabular-nums text-xl font-black text-amber-300">
                    {(selectedProductDetails.storePrice || selectedProductDetails.retailPrice || 0).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>

                {/* Artist & Store Contact Card */}
                <div className="p-3 rounded-2xl bg-[#080F1E] border border-amber-500/30 flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-black text-white truncate">
                      {selectedProductDetails.brandName || 'ورشة الشمساوية'}
                    </p>
                    <p className="text-stone-400 truncate">
                      الفنان: {selectedProductDetails.artistName || 'فنان الشمساوية'}
                    </p>
                    {selectedProductDetails.phoneNumber && (
                      <a
                        href={`tel:${selectedProductDetails.phoneNumber}`}
                        className="text-emerald-400 hover:text-emerald-300 font-mono tabular-nums flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span dir="ltr">{selectedProductDetails.phoneNumber}</span>
                      </a>
                    )}
                  </div>
                  {selectedProductDetails.workshopId && (
                    <a
                      href={`/#/store/${encodeURIComponent(selectedProductDetails.storeSlug || selectedProductDetails.workshopId)}`}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold flex items-center gap-1 shrink-0"
                    >
                      <span>زيارة المتجر</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="p-3 rounded-2xl bg-[#080F1E] border border-amber-500/30">
                  <span className="text-amber-400 font-bold block mb-1">الوصف:</span>
                  <p className="text-[#EADBC8] text-xs leading-relaxed">
                    {selectedProductDetails.storeDescription ||
                      selectedProductDetails.input?.personalNotes ||
                      'مشغولة يدوية مصنوعة بإتقان وجودة عالية.'}
                  </p>
                </div>

                {selectedProductDetails.availableColors && selectedProductDetails.availableColors.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-stone-300 font-bold">الألوان المتاحة:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProductDetails.availableColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setModalSelectedColor(color)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            modalSelectedColor === color
                              ? 'bg-amber-600 text-white border border-amber-400 font-black'
                              : 'bg-[#080F1E] text-stone-300 hover:text-white border border-amber-500/20'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProductDetails.availableSizes && selectedProductDetails.availableSizes.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-stone-300 font-bold">المقاسات:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProductDetails.availableSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setModalSelectedSize(size)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            modalSelectedSize === size
                              ? 'bg-amber-600 text-white border border-amber-400 font-black'
                              : 'bg-[#080F1E] text-stone-300 hover:text-white border border-amber-500/20'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-stone-300 font-bold mb-1">ملاحظات خاصة (اختياري):</label>
                  <input
                    type="text"
                    value={modalCustomNotes}
                    onChange={(e) => setModalCustomNotes(e.target.value)}
                    placeholder="تخصيص لون أو مقاس..."
                    className="w-full px-3 py-1.5 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white text-xs outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#080F1E] border border-amber-500/40 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono tabular-nums font-black text-amber-300 text-sm">
                      {modalQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalQuantity(modalQuantity + 1)}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(selectedProductDetails)}
                    className="flex-1 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl transition cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      إضافة للسلة ({((selectedProductDetails.storePrice || selectedProductDetails.retailPrice || 0) * modalQuantity).toLocaleString('ar-EG')} ج.م)
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Verified Reviews */}
            <div className="border-t border-amber-500/20 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-amber-300 flex items-center gap-2">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>التقييمات</span>
                </h4>
                <span className="text-[11px] text-stone-400">متاح بعد استلام الطلب</span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {getProductReviews(selectedProductDetails.id).length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#080F1E] border border-amber-500/20 text-xs text-stone-400 text-center">
                    لا توجد تقييمات حتى الآن.
                  </div>
                ) : (
                  getProductReviews(selectedProductDetails.id).map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-[#080F1E] border border-amber-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{rev.authorName}</span>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[#EADBC8] text-xs">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-[#080F1E] border border-amber-500/30 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={customerUser?.name || newReviewAuthor}
                    onChange={(e) => setNewReviewAuthor(e.target.value)}
                    placeholder="الاسم..."
                    disabled={!!customerUser}
                    className="px-3 py-2 rounded-xl bg-[#0C1427] border border-amber-500/40 text-white outline-none font-bold disabled:opacity-75"
                  />
                  <input
                    type="tel"
                    value={customerUser?.phone || newReviewPhone}
                    onChange={(e) => setNewReviewPhone(e.target.value)}
                    placeholder="رقم الهاتف المستخدم في الطلب..."
                    disabled={!!customerUser}
                    className="px-3 py-2 rounded-xl bg-[#0C1427] border border-amber-500/40 text-white outline-none font-bold font-mono disabled:opacity-75"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-stone-300">التقييم:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewReviewRating(s)}
                        className="cursor-pointer"
                      >
                        <Star className={`w-4 h-4 ${newReviewRating >= s ? 'fill-amber-400 text-amber-400' : 'text-stone-600'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  placeholder="اكتب رأيك في جودة المشغولة..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#0C1427] border border-amber-500/40 text-white outline-none font-medium text-xs resize-none"
                />

                {reviewGuardError && (
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{reviewGuardError}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleAddReview(selectedProductDetails.id)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition"
                  >
                    نشر التقييم
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Cart Modal (Unchanged) */}
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
          setFeedback(`أهلاً بك يا ${user.name}! تم تفعيل خصم 5%`);
          setTimeout(() => setFeedback(''), 3500);
        }}
      />

      {/* Footer */}
      <footer className="mt-16 bg-[#0C1427] border-t border-amber-500/30 py-6 px-4 text-center space-y-2.5">
        <p className="text-sm font-black text-amber-500">
          منظومة الشمساوية للفنون اليدوية
        </p>
        <div className="flex items-center justify-center">
          <a
            href="https://wa.me/201000996059"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>الدعم الفني</span>
          </a>
        </div>
      </footer>
    </div>
  );
};
