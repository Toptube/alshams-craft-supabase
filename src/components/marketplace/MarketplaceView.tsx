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
import { buildProductLandingUrl } from '../../lib/appRoutes';
import { AlShamsBrandIcon } from '../brand/BrandAssets';
import { playSuccessSound, playAlertSound } from '../../lib/sounds';
import {
  MarketplaceBuilderConfig,
  MARKET_THEME_PRESETS,
  getStoredMarketBuilderConfig,
} from '../../types/marketplaceBuilder';
import { resolveProductOfferPricing } from '../../types/artisanStoreBuilder';
import {
  SUPPORTED_CURRENCIES,
  convertBetweenCurrencies,
  getCurrencyInfo,
  getStoredCustomerDisplayCurrency,
  saveStoredCustomerDisplayCurrency,
  toEgpAmount,
} from '../../lib/currency';
import {
  WishlistItem,
  getWishlistItems,
  toggleWishlistItem,
  removeWishlistItem,
} from '../../services/wishlistService';
import {
  usePublicLocale,
  pickLocalizedText,
  PublicLocaleCode,
  localizeCraftTerm,
  localizeSizeLabel,
  localizeColorLabel,
} from '../../lib/publicLocale';
import { PublicLocaleCurrencyBar } from '../common/PublicLocaleCurrencyBar';
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
  ArrowRight,
  Home,
  ArrowUpDown,
  Tag,
  Copy,
  Coins,
  Truck,
  MessageCircle,
  Clock,
  Sparkles,
  Heart,
  Scale,
  Trash2,
} from 'lucide-react';
import {
  PublicCompareItem,
  clearCompareScope,
  getCompareItemsByScope,
  removeCompareItem,
  toggleCompareItem,
} from '../../services/marketCompareService';
import {
  MarketShamousaActiveFilter,
  sanitizePublicMarketItem,
} from '../../services/shamousaMarketEngine';
import {
  PublicCompareModal,
  PublicFavoritesDrawer,
} from './PublicFavoritesCompareModals';
import {
  ShamousaActiveFilterBar,
  ShamousaMarketAssistantWidget,
} from './ShamousaMarketAssistantWidget';
import {
  PlatformPromotionalOffer,
  getActivePublicOffers,
  loadLoyaltyConfig,
  syncPublicLoyaltyFromServer,
} from '../../services/loyaltyWalletsService';

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
  onNavigateToSuppliersMarket?: () => void;
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
  onNavigateHome,
  onOpenStoreModal,
  onNavigateToSuppliersMarket,
}) => {
  const isSuperAdmin = useMemo(() => isUserAdmin(profile), [profile]);
  const { locale, setLocale, dir, isRtl, t } = usePublicLocale();
  const pickMarketProductField = (
    p: MarketplaceProductRecord,
    field: 'name' | 'description'
  ): string => {
    const base = field === 'name' ? p.productName : p.storeDescription;
    if (!p.translations) return (base || '').trim();
    const map: Partial<Record<PublicLocaleCode, string | undefined>> = {};
    (Object.keys(p.translations) as PublicLocaleCode[]).forEach((k) => {
      map[k] = p.translations?.[k]?.[field];
    });
    return pickLocalizedText(base, map, locale);
  };

  const [builderConfig, setBuilderConfig] = useState<MarketplaceBuilderConfig>(() => getStoredMarketBuilderConfig());
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncDark = () => setIsDarkTheme(document.documentElement.classList.contains('dark'));
    syncDark();
    const obs = new MutationObserver(syncDark);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const themeMeta = useMemo(
    () => MARKET_THEME_PRESETS[builderConfig.themePreset || 'shams_sand'] || MARKET_THEME_PRESETS.shams_sand,
    [builderConfig.themePreset]
  );

  const isCustomTheme = (builderConfig.themePreset || 'shams_sand') !== 'shams_sand';

  const activeDecorCategories = useMemo(() => {
    const configured = (builderConfig.decorCategoriesOrder || []).filter((c) => c.visible !== false);
    return configured.length > 0 ? configured : DECOR_CATEGORIES;
  }, [builderConfig.decorCategoriesOrder]);

  useEffect(() => {
    const onBuilderUpdated = (e: any) => {
      if (e?.detail) {
        setBuilderConfig(e.detail);
      } else {
        setBuilderConfig(getStoredMarketBuilderConfig());
      }
    };
    window.addEventListener('alshams_market_builder_updated', onBuilderUpdated);
    return () => window.removeEventListener('alshams_market_builder_updated', onBuilderUpdated);
  }, []);

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
  const [modalActiveImage, setModalActiveImage] = useState<string>('');
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalSelectedColor, setModalSelectedColor] = useState<string>('');
  const [modalSelectedSize, setModalSelectedSize] = useState<string>('');
  const [modalCustomNotes, setModalCustomNotes] = useState<string>('');

  // Customer Display Currency & Wishlist & FX Live Refresh
  const [customerCurrency, setCustomerCurrency] = useState<string>(() =>
    getStoredCustomerDisplayCurrency()
  );
  const [fxVersion, setFxVersion] = useState<number>(0);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(() => getWishlistItems());
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [compareItems, setCompareItems] = useState<PublicCompareItem[]>(() =>
    getCompareItemsByScope('artisan')
  );
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [shamousaFilter, setShamousaFilter] = useState<MarketShamousaActiveFilter | null>(null);
  const [shamousaShippingHint, setShamousaShippingHint] = useState<string | null>(null);
  const [shamousaOpenSignal, setShamousaOpenSignal] = useState<number>(0);
  const [, setLoyaltyVersion] = useState<number>(0);

  const wishlistIds = useMemo(() => new Set(wishlistItems.map((i) => i.id)), [wishlistItems]);
  const compareIds = useMemo(() => new Set(compareItems.map((i) => i.id)), [compareItems]);

  useEffect(() => {
    syncPublicLoyaltyFromServer().then(() => setLoyaltyVersion((v) => v + 1)).catch(() => {});
    const onLoyaltyUpdate = () => setLoyaltyVersion((v) => v + 1);
    window.addEventListener('alshams_loyalty_config_updated', onLoyaltyUpdate);
    window.addEventListener('alshams_loyalty_offers_updated', onLoyaltyUpdate);
    return () => {
      window.removeEventListener('alshams_loyalty_config_updated', onLoyaltyUpdate);
      window.removeEventListener('alshams_loyalty_offers_updated', onLoyaltyUpdate);
    };
  }, []);

  useEffect(() => {
    const onCurrUpdate = (e: any) => {
      if (e?.detail) setCustomerCurrency(String(e.detail));
      else setCustomerCurrency(getStoredCustomerDisplayCurrency());
    };
    const onWishlistUpdate = (e: any) => {
      if (Array.isArray(e?.detail)) setWishlistItems(e.detail);
      else setWishlistItems(getWishlistItems());
    };
    const onCompareUpdate = () => setCompareItems(getCompareItemsByScope('artisan'));
    const onFxBuilderUpdate = () => setFxVersion((v) => v + 1);
    window.addEventListener('alshams_customer_currency_updated', onCurrUpdate);
    window.addEventListener('alshams_wishlist_updated', onWishlistUpdate);
    window.addEventListener('alshams_compare_updated', onCompareUpdate);
    window.addEventListener('alshams_market_builder_updated', onFxBuilderUpdate);
    return () => {
      window.removeEventListener('alshams_customer_currency_updated', onCurrUpdate);
      window.removeEventListener('alshams_wishlist_updated', onWishlistUpdate);
      window.removeEventListener('alshams_compare_updated', onCompareUpdate);
      window.removeEventListener('alshams_market_builder_updated', onFxBuilderUpdate);
    };
  }, []);

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
  const [flashRemainingMs, setFlashRemainingMs] = useState<number>(0);

  // Flash Offer 1-second Countdown Timer
  useEffect(() => {
    const fo = builderConfig.flashOffer;
    if (!fo?.enabled || !fo.endsAt) {
      setFlashRemainingMs(0);
      return;
    }
    const targetMs = new Date(fo.endsAt).getTime();
    if (!Number.isFinite(targetMs)) {
      setFlashRemainingMs(0);
      return;
    }
    const tick = () => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setFlashRemainingMs(0);
        return false;
      }
      setFlashRemainingMs(diff);
      return true;
    };
    if (!tick()) return;
    const id = window.setInterval(() => {
      if (!tick()) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [builderConfig.flashOffer]);

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
          .filter((cp) => cp.status === 'approved' && !(cp as any).dimensions?.__artisanExt?.hiddenInStore)
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
            translations: cp.translations,
            imageUrl: cp.image_url || cp.imageUrl || '/alshams_falcon_emblem.png',
            galleryUrls: Array.isArray(cp.galleryUrls) ? cp.galleryUrls : Array.isArray(cp.gallery_urls) ? cp.gallery_urls : [],
            sizeVariants: Array.isArray(cp.sizeVariants) ? cp.sizeVariants : Array.isArray(cp.size_variants) ? cp.size_variants : [],
            sourceCurrency: cp.sourceCurrency || cp.source_currency || 'EGP',
            productDiscount: cp.productDiscount || cp.product_discount,
            isCustomOrderAvailable: Boolean(cp.isCustomOrderAvailable ?? cp.is_custom_order_available),
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
        // Ensures workshop currency is converted into unified EGP for سوق الشمساوية
        let publishedLocal: MarketplaceProductRecord[] = [];
        const isCurrentProfileBlocked = Boolean(
          profile && ((profile as any).isFrozen || profile.status === 'banned' || profile.status === 'suspended')
        );
        if (profile && !isCurrentProfileBlocked) {
          const tenantId = profile.tenantId || profile.workshopId || profile.id;
          if (tenantId) {
            const localProds = await tenantStorage.getProducts(tenantId).catch(() => []);
            publishedLocal = localProds
              .filter(
                (p) =>
                  p &&
                  p.inStore &&
                  p.isPublishedInStore !== false &&
                  p.isMarketplaceApproved === true &&
                  p.inMarket !== false &&
                  p.marketStatus !== 'none' &&
                  p.marketStatus !== 'pending_approval' &&
                  p.marketStatus !== 'rejected'
              )
              .map((p) => {
                const srcCurr = p.sourceCurrency || 'EGP';
                const rawStore = Number(p.storePrice || p.retailPrice || 0);
                const rawRetail = Number(p.retailPrice || p.storePrice || 0);
                const variants = Array.isArray(p.sizeVariants)
                  ? p.sizeVariants.map((v) => ({
                      ...v,
                      egpPrice: v.egpPrice || toEgpAmount(v.price, srcCurr),
                    }))
                  : [];
                return {
                  ...p,
                  marketStatus: 'approved' as const,
                  storePrice: toEgpAmount(rawStore, srcCurr),
                  retailPrice: toEgpAmount(rawRetail, srcCurr),
                  sizeVariants: variants,
                  availableSizes:
                    variants.length > 0 ? variants.map((v) => v.label) : p.availableSizes || [],
                  workshopId: tenantId,
                  brandName: profile.brandName || 'ورشة الشمساوية',
                  artistName: profile.artistName || 'فنان الشمساوية',
                  phoneNumber: profile.phoneNumber || '',
                  logoUrl: (profile as any).logo_url || profile.logoUrl || profile.logoBase64 || null,
                  storeSlug: profile.storeSlug || tenantId,
                };
              });
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

  const sanitizedShamousaCatalog = useMemo(
    () =>
      products.map((p) => {
        const pr = resolveProductOfferPricing(p, p.sizeVariants?.[0]?.label, 'EGP', true);
        return sanitizePublicMarketItem({
          id: p.id,
          name: p.productName,
          description: p.storeDescription,
          craftOrCategory: p.craftName || p.category || p.decorCategory,
          priceEgp: pr.egpFinalPrice,
          inStock: (p.currentStock || 0) > 0,
          colors: p.availableColors,
          sizes: p.sizeVariants?.map((s) => s.label) || p.availableSizes,
          storeName: p.brandName || p.artistName || 'الشمساوية',
          storeSlug: p.storeSlug,
          storeId: p.workshopId,
          imageUrl: p.imageUrl || undefined,
          isFreeShipping: pr.isFreeShipping,
          hasDiscount: pr.hasDiscount,
        });
      }),
    [products]
  );

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const shamousaIdSet = shamousaFilter ? new Set(shamousaFilter.matchedIds) : null;
    const filtered = products.filter((p) => {
      if (shamousaIdSet && !shamousaIdSet.has(p.id)) return false;

      // 1. Search Query (Super Admin can also search by brand/artist; shoppers search products & crafts)
      const q = searchQuery.toLowerCase().trim();
      const transText = (p as any).translations
        ? Object.values((p as any).translations)
            .map((tr: any) => `${tr?.name || ''} ${tr?.description || ''}`)
            .join(' ')
            .toLowerCase()
        : '';
      const matchSearch =
        !q ||
        p.productName.toLowerCase().includes(q) ||
        (p.storeDescription || '').toLowerCase().includes(q) ||
        (p.craftName || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        transText.includes(q) ||
        (isSuperAdmin &&
          ((p.brandName || '').toLowerCase().includes(q) ||
            (p.artistName || '').toLowerCase().includes(q)));

      // 2. Decor Category Tabs
      let matchDecor = true;
      if (selectedDecorCategory !== 'all') {
        if (p.decorCategory && p.decorCategory !== 'all') {
          matchDecor = p.decorCategory === selectedDecorCategory;
        } else {
          const decorDef = activeDecorCategories.find((d) => d.id === selectedDecorCategory) || DECOR_CATEGORIES.find((d) => d.id === selectedDecorCategory);
          const text = `${p.productName || ''} ${p.category || ''} ${p.craftName || ''} ${p.storeDescription || ''}`.toLowerCase();
          matchDecor = decorDef && decorDef.keywords.length > 0 ? decorDef.keywords.some((kw) => text.includes(kw)) : true;
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

    const activeSort = shamousaFilter?.sortBy || sortBy;
    if (activeSort === 'price_asc') {
      return [...filtered].sort(
        (a, b) => (a.storePrice || a.retailPrice || 0) - (b.storePrice || b.retailPrice || 0)
      );
    }
    if (activeSort === 'price_desc') {
      return [...filtered].sort(
        (a, b) => (b.storePrice || b.retailPrice || 0) - (a.storePrice || a.retailPrice || 0)
      );
    }
    return filtered;
  }, [products, searchQuery, selectedDecorCategory, selectedMainSections, selectedSubCrafts, sortBy, isSuperAdmin, shamousaFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedDecorCategory !== 'all' ||
    selectedMainSections.length > 0 ||
    selectedSubCrafts.length > 0 ||
    shamousaFilter !== null;

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedDecorCategory('all');
    setSelectedMainSections([]);
    setSelectedSubCrafts([]);
    setSortBy('featured');
    setShamousaFilter(null);
    setShamousaShippingHint(null);
    setOpenDropdown(null);
  };

  const handleToggleCompareMarket = (
    p: MarketplaceProductRecord,
    egpPrice: number,
    isFreeShipping?: boolean
  ) => {
    const res = toggleCompareItem({
      id: p.id,
      scope: 'artisan',
      name: p.productName,
      imageUrl: p.imageUrl || '/alshams_falcon_emblem.png',
      priceEgp: egpPrice,
      craftOrCategory: p.craftName || p.category,
      sizeLabel: p.sizeVariants?.[0]?.label || p.availableSizes?.[0],
      inStock: (p.currentStock || 0) > 0,
      storeName: p.brandName || p.artistName || 'الشمساوية',
      storeSlug: p.storeSlug,
      storeId: p.workshopId,
      isFreeShipping,
    });
    setCompareItems(res.scopeItems);
    if (res.limitReached) {
      playAlertSound();
      setFeedback('وصلت للحد الأقصى للمقارنة (12 منتج) — افتح المقارنة ⚖️ لتصفيتها.');
    } else {
      playSuccessSound();
      setFeedback(res.added ? `تمت إضافة "${p.productName}" إلى المقارنة ⚖️` : `تمت إزالة "${p.productName}" من المقارنة`);
    }
    setTimeout(() => setFeedback(''), 2600);
  };

  // Open Product Modal
  const handleOpenProductDetails = (product: MarketplaceProductRecord) => {
    setSelectedProductDetails(product);
    setModalActiveImage(product.imageUrl || '/alshams_falcon_emblem.png');
    setModalQuantity(1);
    setModalSelectedColor(product.availableColors?.[0] || 'اللون الأصلي');
    setModalSelectedSize(
      product.sizeVariants?.[0]?.label || product.availableSizes?.[0] || 'المقاس القياسي'
    );
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
    const chosenSize =
      size ||
      (selectedProductDetails?.id === product.id ? modalSelectedSize : undefined) ||
      product.sizeVariants?.[0]?.label ||
      product.availableSizes?.[0] ||
      'المقاس القياسي';

    const pricing = resolveProductOfferPricing(product, chosenSize, customerCurrency, true);

    const item: MarketplaceCartItem = {
      id: 'cart_' + Date.now(),
      productId: product.id,
      productName: product.productName,
      price: pricing.egpFinalPrice,
      quantity: chosenQty,
      imageUrl: product.imageUrl,
      craftName: product.craftName,
      workshopId: product.workshopId || product.tenantId || 'central',
      artistName: product.artistName || 'فنان الشمساوية',
      selectedColor: color || modalSelectedColor || product.availableColors?.[0] || 'اللون الأصلي',
      selectedSize: chosenSize,
      customNotes: modalCustomNotes.trim() || undefined,
      isFreeShipping: pricing.isFreeShipping || undefined,
    };

    addToCart(item);
    playSuccessSound();
    setFeedback(`تمت إضافة "${product.productName}" إلى السلة`);
    setTimeout(() => setFeedback(''), 3000);
    setSelectedProductDetails(null);
    setIsCartOpen(true);
  };

  const handleToggleWishlistMarket = (p: MarketplaceProductRecord, egpPrice: number, isFreeShip?: boolean) => {
    const res = toggleWishlistItem({
      id: p.id,
      productName: p.productName,
      imageUrl: p.imageUrl,
      egpPrice,
      craftName: p.craftName || p.category,
      workshopId: p.workshopId || p.tenantId || 'central',
      brandName: p.brandName,
      artistName: p.artistName,
      storeSlug: p.storeSlug,
      isFreeShipping: isFreeShip,
    });
    setWishlistItems(res.items);
    setFeedback(res.added ? `♥ تمت إضافة "${p.productName}" إلى قائمة المفضلة` : `تمت إزالة "${p.productName}" من المفضلة`);
    setTimeout(() => setFeedback(''), 2600);
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
    if (selectedMainSections.length === 0) return isRtl ? 'القسم: الكل' : 'Section: All';
    if (selectedMainSections.length === 1) {
      const sec = MAIN_SECTIONS.find((s) => s.id === selectedMainSections[0]);
      const label = sec ? localizeCraftTerm(sec.id, locale) || localizeCraftTerm(sec.nameAr, locale) : '1';
      return isRtl ? `القسم: ${sec?.nameAr || '1'}` : `Section: ${label}`;
    }
    return isRtl ? `الأقسام (${selectedMainSections.length})` : `Sections (${selectedMainSections.length})`;
  }, [selectedMainSections, isRtl, locale]);

  const craftButtonLabel = useMemo(() => {
    if (selectedSubCrafts.length === 0) return isRtl ? 'التخصص: الكل' : 'Craft: All';
    if (selectedSubCrafts.length === 1) {
      const c = SUB_CRAFTS_REGISTRY.find((sc) => sc.id === selectedSubCrafts[0]);
      const label = c ? localizeCraftTerm(c.id, locale) || localizeCraftTerm(c.nameAr, locale) : '1';
      return isRtl ? `التخصص: ${c?.nameAr || '1'}` : `Craft: ${label}`;
    }
    return isRtl ? `التخصصات (${selectedSubCrafts.length})` : `Crafts (${selectedSubCrafts.length})`;
  }, [selectedSubCrafts, isRtl, locale]);

  const scrollToCatalog = () => {
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getGridColsClass = (desktopCols: 2 | 3 | 4 = 4, mobileCols: 1 | 2 = 2) => {
    const mob = mobileCols === 1 ? 'grid-cols-1' : 'grid-cols-2';
    const desk =
      desktopCols === 2
        ? 'lg:grid-cols-2 xl:grid-cols-2'
        : desktopCols === 3
        ? 'lg:grid-cols-3 xl:grid-cols-3'
        : 'lg:grid-cols-3 xl:grid-cols-4';
    return `grid ${mob} ${desk} gap-2.5 sm:gap-5`;
  };

  const getPromoColorClasses = (bgHex?: string) => {
    if (bgHex === '#EA580C' || bgHex === '#C2410C') return 'bg-[#C2410C] text-white border-[#9A3412]';
    if (bgHex === '#065F46' || bgHex === '#047857') return 'bg-[#065F46] text-white border-[#064E3B]';
    if (bgHex === '#F7F3EA' || bgHex === '#E9E2D4') return 'bg-[#E9E2D4] text-[#0C1427] border-[#D4CCBC]';
    return 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C]/40';
  };

  const renderProductCard = (p: MarketplaceProductRecord) => {
    const hasStock = (p.currentStock || 0) > 0;
    const pricing = resolveProductOfferPricing(
      p,
      p.sizeVariants?.[0]?.label,
      customerCurrency,
      true
    );
    const reviews = getProductReviews(p.id);
    const avgRating =
      reviews.length > 0
        ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
        : '5.0';

    const adminBadge =
      builderConfig.productBadgesEnabled !== false ? builderConfig.productBadges?.[p.id] : undefined;
    // Strict max 1 badge per card image corner (prioritize artisan's active limited-time/discount badge)
    const displayBadge = pricing.badgeText || adminBadge;

    return (
      <article
        key={p.id}
        onClick={() => handleOpenProductDetails(p)}
        className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden hover:border-[#EA580C]/60 dark:hover:border-[#FBBF24]/50 transition-all duration-200 flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg min-w-0"
      >
        <div className="min-w-0">
          <div className="relative w-full aspect-[4/3] bg-[#E9E2D4] dark:bg-[#132040] overflow-hidden border-b border-[#D4CCBC]/70 dark:border-[#22355E]">
            {displayBadge && (
              <span
                className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-black shadow-xs pointer-events-none ${
                  pricing.badgeText
                    ? 'bg-[#C2410C] text-white'
                    : 'bg-[#0C1427]/90 text-[#FBBF24]'
                }`}
              >
                {displayBadge}
              </span>
            )}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleWishlistMarket(p, pricing.egpFinalPrice, pricing.isFreeShipping);
                }}
                aria-label={wishlistIds.has(p.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                title={wishlistIds.has(p.id) ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
                className="w-8 h-8 rounded-full bg-[#F7F3EA]/92 dark:bg-[#0C1427]/88 border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition cursor-pointer"
              >
                <Heart
                  className={`w-4 h-4 transition ${
                    wishlistIds.has(p.id) ? 'fill-rose-500 text-rose-500' : 'text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCompareMarket(p, pricing.egpFinalPrice, pricing.isFreeShipping);
                }}
                aria-label={compareIds.has(p.id) ? 'إزالة من المقارنة' : 'أضف للمقارنة'}
                title={compareIds.has(p.id) ? 'في قائمة المقارنة (اضغط للإزالة)' : 'أضف للمقارنة ⚖️'}
                className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                  compareIds.has(p.id)
                    ? 'bg-[#EA580C] border-[#EA580C] text-white'
                    : 'bg-[#F7F3EA]/92 dark:bg-[#0C1427]/88 border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
              </button>
            </div>
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

          <div className="p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between gap-1.5 text-[10px] sm:text-xs text-[#475569] dark:text-[#94A3B8]">
              <span className="truncate font-medium">
                {localizeCraftTerm(p.craftName || String(p.category || ''), locale)} ·{' '}
                {hasStock ? t('in_stock') : isRtl ? 'بالطلب' : 'Made to order'}
              </span>
              <span className="flex items-center gap-0.5 sm:gap-1 font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA] font-bold shrink-0">
                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                <span>{avgRating}</span>
              </span>
            </div>

            <h3 className="font-bold text-xs sm:text-base text-[#0C1427] dark:text-[#F7F3EA] line-clamp-2 leading-snug group-hover:text-[#C2410C] dark:group-hover:text-[#FBBF24] transition-colors">
              {pickMarketProductField(p, 'name')}
            </h3>

            {p.storeDescription && (
              <p className="text-[11px] sm:text-xs text-[#334155] dark:text-[#CBD5E1] line-clamp-1">
                {pickMarketProductField(p, 'description')}
              </p>
            )}

            {(isSuperAdmin || builderConfig.showWorkshopOnCards) && (
              <p className="text-[10px] sm:text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24] truncate pt-0.5">
                الورشة: {p.brandName || 'الشمساوية'}
                {isSuperAdmin && p.artistName ? ` · ${p.artistName}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="px-2.5 pb-2.5 sm:px-4 sm:pb-4 pt-1 space-y-2 sm:space-y-3">
          <div className="flex items-baseline gap-1.5 font-mono tabular-nums flex-wrap">
            <span className="text-sm sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
              {pricing.finalPrice.toLocaleString('ar-EG')}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
              {pricing.displaySymbol}
            </span>
            {pricing.hasDiscount && (
              <span className="text-[10px] sm:text-xs line-through text-[#64748B] dark:text-[#94A3B8]">
                {pricing.originalPrice.toLocaleString('ar-EG')}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAddToCart(p, 1);
            }}
            style={
              isCustomTheme
                ? { background: `linear-gradient(to right, ${themeMeta.accentBg}, ${themeMeta.accentHover})` }
                : undefined
            }
            className="w-full py-2 px-2.5 sm:py-2.5 sm:px-4 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{t('add_to_cart')}</span>
          </button>
        </div>
      </article>
    );
  };

  const handleCopyCouponCode = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    navigator.clipboard?.writeText(clean).catch(() => {});
    playSuccessSound();
    setFeedback(`تم نسخ كود الخصم (${clean}) — الصقه داخل السلة للاستفادة بالعرض!`);
    setTimeout(() => setFeedback(''), 3500);
  };

  const renderRunningTicker = () => {
    const tk = builderConfig.tickerBanner;
    if (!tk?.enabled || !tk.text?.trim()) return null;
    const durationSec = tk.speed === 'fast' ? '14s' : tk.speed === 'slow' ? '34s' : '22s';
    const bgCls =
      tk.bgColor === '#0C1427'
        ? 'bg-[#0C1427] text-[#FBBF24] border-[#EA580C]/40'
        : tk.bgColor === '#065F46'
        ? 'bg-[#065F46] text-white border-[#064E3B]'
        : tk.bgColor === '#E9E2D4'
        ? 'bg-[#E9E2D4] text-[#0C1427] border-[#D4CCBC]'
        : 'bg-[#C2410C] text-white border-[#9A3412]';

    const linkedCode = tk.showLinkedCoupon ? tk.linkedCouponCode?.trim() : '';

    return (
      <div className={`border-b py-1.5 px-3 text-xs font-black ${bgCls}`}>
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <div className="alshams-marquee-viewport flex-1" style={{ ['--marquee-duration' as any]: durationSec }}>
            <div className="alshams-marquee-track">
              <span>{tk.text}</span>
              <span aria-hidden="true">·</span>
              <span>{tk.text}</span>
            </div>
          </div>
          {linkedCode && (
            <button
              type="button"
              onClick={() => handleCopyCouponCode(linkedCode)}
              className="px-2.5 py-0.5 rounded-md bg-black/25 hover:bg-black/40 text-white font-mono text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer border border-white/25"
              title="اضغط لنسخ كود الخصم"
            >
              <Tag className="w-3 h-3" />
              <span>{linkedCode}</span>
              <Copy className="w-2.5 h-2.5 opacity-80" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderFlashOfferBar = () => {
    const fo = builderConfig.flashOffer;
    if (!fo?.enabled || flashRemainingMs <= 0) return null;
    const totalSec = Math.floor(flashRemainingMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const flashCode = fo.couponCode?.trim().toUpperCase();

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
        <div className="rounded-xl bg-[#0C1427] text-[#F7F3EA] border border-[#EA580C]/45 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black text-[#FBBF24]">
            <Clock className="w-4 h-4 shrink-0 text-[#EA580C]" />
            <span>{fo.title}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-1 font-mono tabular-nums text-xs font-black text-white"
              dir="ltr"
            >
              {days > 0 && (
                <>
                  <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15">{days}d</span>
                  <span>:</span>
                </>
              )}
              <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15">{pad(hours)}h</span>
              <span>:</span>
              <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15">{pad(mins)}m</span>
              <span>:</span>
              <span className="px-2 py-0.5 rounded bg-[#EA580C] text-white">{pad(secs)}s</span>
            </div>

            {flashCode && (
              <button
                type="button"
                onClick={() => handleCopyCouponCode(flashCode)}
                className="px-2.5 py-1 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-mono text-[11px] font-black flex items-center gap-1 cursor-pointer"
                title="اضغط لنسخ كود العرض"
              >
                <Tag className="w-3 h-3" />
                <span>{flashCode}</span>
                <Copy className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const containerStyle: React.CSSProperties | undefined = isCustomTheme || builderConfig.marketBgColor
    ? {
        backgroundColor:
          builderConfig.marketBgColor ||
          (isDarkTheme ? themeMeta.pageBgDark : themeMeta.pageBgLight),
        color: isDarkTheme ? themeMeta.inkDark : themeMeta.inkLight,
      }
    : undefined;

  const headerStyle: React.CSSProperties | undefined = isCustomTheme
    ? {
        backgroundColor: isDarkTheme ? themeMeta.surfaceDark : themeMeta.surfaceLight,
        borderColor: isDarkTheme ? themeMeta.borderDark : themeMeta.borderLight,
      }
    : undefined;

  return (
    <div
      style={containerStyle}
      className="min-h-screen bg-[#F2ECE1] text-[#0C1427] dark:bg-[#060B18] dark:text-[#F7F3EA] font-sans pb-16 w-full max-w-full overflow-x-clip transition-colors duration-200"
      dir={dir}
    >
      {/* Floating feedback toast for coupon copies & cart actions */}
      {feedback && (
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:max-w-sm z-50 p-3 rounded-xl bg-emerald-700 text-white text-xs font-black shadow-xl border border-emerald-400/50 flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="p-0.5 hover:opacity-80 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Unified Clean Top Navigation Header */}
      <header
        style={headerStyle}
        className="sticky top-0 z-40 bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] px-3 sm:px-6 py-2.5 sm:py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-8">
          {/* Zone 1: Brand Wordmark (single line, zero descriptor clutter) */}
          <button
            type="button"
            onClick={resetAllFilters}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer text-right min-w-0 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] rounded-xl"
            title={t('central_market_title')}
          >
            <AlShamsBrandIcon size="sm" />
            <span className="text-sm sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] whitespace-nowrap">
              {locale === 'ar' ? 'سوق الشمساوية' : t('central_market_title')}
            </span>
          </button>

          {/* Zone 2: Integrated Amazon/Noon Desktop Search Bar */}
          <div className="hidden md:block flex-1 max-w-xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_products')}
              className="w-full h-10 pr-10 pl-14 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] placeholder-[#475569] dark:placeholder-[#94A3B8] text-sm font-medium outline-none focus:border-[#EA580C] dark:focus:border-[#FBBF24] transition-colors"
            />
            <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#C2410C] dark:text-[#FBBF24] font-bold cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Zone 3: Concise Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PublicLocaleCurrencyBar
              locale={locale}
              onChangeLocale={setLocale}
              currency={customerCurrency}
              onChangeCurrency={(c) => setCustomerCurrency(saveStoredCustomerDisplayCurrency(c))}
              compact
            />
            <button
              type="button"
              onClick={() => {
                if (profile && profile.id) {
                  onNavigateHome();
                } else {
                  resetAllFilters();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-black text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              title={profile && profile.id ? t('back_to_app') : t('central_market_title')}
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
              <Home className="w-3.5 h-3.5 hidden sm:inline text-[#C2410C] dark:text-[#FBBF24]" />
              <span className="hidden sm:inline">{locale === 'ar' ? 'الرئيسية' : t('back_to_app')}</span>
            </button>
            {onNavigateToSuppliersMarket && (
              <button
                type="button"
                onClick={onNavigateToSuppliersMarket}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-600/35 text-emerald-800 dark:text-emerald-300 font-black text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                title={t('suppliers_market_title')}
              >
                <span>{locale === 'ar' ? 'سوق الموردين' : t('suppliers_market_title')}</span>
              </button>
            )}
            {customerUser ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs whitespace-nowrap">
                <User className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                <span className="font-bold truncate max-w-[110px]">{customerUser.name}</span>
                <span className="text-[#475569] dark:text-[#94A3B8]" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#C2410C] dark:text-[#FBBF24] font-bold">
                  {customerUser.loyaltyPoints}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCustomerAuthOpen(true)}
                className="px-2.5 sm:px-3 py-2 rounded-xl text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <User className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />
                <span className="hidden sm:inline">{locale === 'ar' ? 'حسابي' : 'Account'}</span>
              </button>
            )}

            {onOpenStoreModal && profile && (
              <button
                type="button"
                onClick={onOpenStoreModal}
                className="px-2.5 sm:px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                title="إدارة الكتالوج والمتجر"
              >
                <Store className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                <span className="hidden lg:inline">{locale === 'ar' ? 'متجري' : 'My Store'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="relative px-2.5 sm:px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              title={t('wishlist')}
            >
              <Heart className={`w-4 h-4 ${wishlistItems.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-[#C2410C] dark:text-[#FBBF24]'}`} />
              <span className="hidden md:inline">{t('wishlist')}</span>
              {wishlistItems.length > 0 && (
                <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-rose-600 text-white font-mono tabular-nums text-[10px] font-black flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              className="relative px-2.5 sm:px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              title="المقارنة المنفصلة عن السلة"
            >
              <Scale className={`w-4 h-4 ${compareItems.length > 0 ? 'text-[#EA580C] dark:text-[#FBBF24]' : 'text-[#C2410C] dark:text-[#FBBF24]'}`} />
              <span className="hidden lg:inline">{locale === 'ar' ? 'المقارنة' : 'Compare'}</span>
              {compareItems.length > 0 && (
                <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-[#EA580C] text-white font-mono tabular-nums text-[10px] font-black flex items-center justify-center">
                  {compareItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              title={t('cart')}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t('cart')}</span>
              {cartItemsCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#0C1427] text-[#FBBF24] font-mono tabular-nums text-[11px] font-black flex items-center justify-center">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Page Blocks Ordered by Super Admin No-Code Visual Builder */}
      {builderConfig.pageBlocksOrder.map((block) => {
        if (!block.enabled) return null;

        if (block.id === 'promo' && builderConfig.promoBanner.enabled && builderConfig.promoBanner.text.trim()) {
          const promoCode =
            builderConfig.promoBanner.showLinkedCoupon && builderConfig.promoBanner.linkedCouponCode?.trim()
              ? builderConfig.promoBanner.linkedCouponCode.trim().toUpperCase()
              : '';
          return (
            <div
              key="promo"
              className={`border-b px-4 py-2 text-center text-xs font-black tracking-wide ${getPromoColorClasses(builderConfig.promoBanner.bgColor)}`}
            >
              <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
                <span>{builderConfig.promoBanner.text}</span>
                {promoCode && (
                  <button
                    type="button"
                    onClick={() => handleCopyCouponCode(promoCode)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/15 hover:bg-white/25 border border-current/25 font-mono text-[11px] font-black cursor-pointer"
                    title="اضغط لنسخ كود الخصم"
                  >
                    <Tag className="w-3 h-3" />
                    <span>كود الخصم: {promoCode}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        }

        if (block.id === 'hero' && !hasActiveFilters && builderConfig.heroEnabled) {
          const heroOpacityClass =
            builderConfig.heroImageOpacity >= 0.45
              ? 'opacity-45 dark:opacity-35'
              : builderConfig.heroImageOpacity >= 0.3
              ? 'opacity-30 dark:opacity-25'
              : 'opacity-[0.18] dark:opacity-[0.17]';

          return (
            <React.Fragment key="hero">
              {builderConfig.tickerBanner?.position === 'above_hero' && renderRunningTicker()}
              <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2">
                <div
                  style={
                    isCustomTheme
                      ? {
                          backgroundColor: isDarkTheme ? themeMeta.surfaceDark : themeMeta.surfaceLight,
                          borderColor: isDarkTheme ? themeMeta.borderDark : themeMeta.borderLight,
                        }
                      : undefined
                  }
                  className="relative rounded-2xl overflow-hidden bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] min-h-[340px] sm:min-h-[270px] lg:min-h-[340px] flex items-center"
                >
                  <picture className="contents pointer-events-none select-none">
                    <source
                      media="(min-width: 640px), (orientation: landscape)"
                      srcSet={builderConfig.heroDesktopBg || '/assets/aistudio/1794679364029_8e8e9eb9.jpg'}
                    />
                    <img
                      src={builderConfig.heroMobileBg || '/assets/aistudio/1794679233184_3747c8da.jpg'}
                      alt=""
                      aria-hidden="true"
                      className={`absolute inset-0 w-full h-full object-cover object-[50%_45%] sm:object-center ${heroOpacityClass} pointer-events-none select-none`}
                    />
                  </picture>
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-l from-[#F7F3EA]/80 via-[#F7F3EA]/45 to-transparent dark:from-[#0D162E]/85 dark:via-[#0D162E]/55 dark:to-transparent pointer-events-none"
                  />

                  <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col justify-center gap-3.5 sm:gap-4 text-right max-w-2xl">
                    {builderConfig.heroEyebrow && (
                      <p
                        style={isCustomTheme ? { color: isDarkTheme ? themeMeta.accentTextDark : themeMeta.accentTextLight } : undefined}
                        className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]"
                      >
                        {builderConfig.heroEyebrow}
                      </p>
                    )}
                    <h1 className="text-2xl sm:text-3xl font-black leading-tight text-[#0C1427] dark:text-[#F7F3EA] text-balance">
                      {builderConfig.heroTitle}
                    </h1>
                    {builderConfig.heroSubtitle && (
                      <p className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed max-w-md font-medium">
                        {builderConfig.heroSubtitle}
                      </p>
                    )}
                    <div className="pt-1 flex items-center">
                      <button
                        type="button"
                        onClick={scrollToCatalog}
                        style={
                          isCustomTheme
                            ? { background: `linear-gradient(to right, ${themeMeta.accentBg}, ${themeMeta.accentHover})` }
                            : undefined
                        }
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-sm inline-flex items-center gap-2 transition cursor-pointer active:scale-95 whitespace-nowrap shadow-sm"
                      >
                        <span>{builderConfig.heroCtaText || 'تصفح المعروضات'}</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              {builderConfig.tickerBanner?.position === 'below_hero' && renderRunningTicker()}
              {renderFlashOfferBar()}
            </React.Fragment>
          );
        }

        if (block.id === 'featured_matrices' && !hasActiveFilters && !loading) {
          const activeMatrices = (builderConfig.productMatrices || []).filter((m) => m.enabled);
          if (activeMatrices.length === 0) return null;
          return (
            <section key="featured_matrices" className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-6">
              {activeMatrices.map((mat) => {
                let matItems = products;
                if (mat.filterType === 'category' && mat.filterValue) {
                  const catObj = activeDecorCategories.find((c) => c.id === mat.filterValue);
                  matItems = products.filter(
                    (p) =>
                      p.decorCategory === mat.filterValue ||
                      (catObj && catObj.keywords.some((kw) => `${p.productName} ${p.category} ${p.craftName}`.toLowerCase().includes(kw)))
                  );
                } else if (mat.filterType === 'craft' && mat.filterValue) {
                  matItems = products.filter((p) => matchesSubCraft(p, mat.filterValue!));
                }
                const sliced = matItems.slice(0, mat.limit || 4);
                if (sliced.length === 0) return null;
                return (
                  <div key={mat.id} className="space-y-3">
                    <div className="flex items-end justify-between px-1">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          {mat.title}
                        </h2>
                        {mat.subtitle && (
                          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">{mat.subtitle}</p>
                        )}
                      </div>
                    </div>
                    <div className={getGridColsClass(mat.desktopCols, mat.mobileCols)}>
                      {sliced.map((p) => renderProductCard(p))}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        }

        if (block.id === 'categories') {
          return (
            <React.Fragment key="categories">
              {/* Loyalty & Free Shipping Slim Incentive Strip */}
              {(builderConfig.loyalty?.enabled || builderConfig.freeShippingThresholdEnabled) && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
                  <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs font-bold">
                    {builderConfig.loyalty?.enabled && (
                      <span className="flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                        <Coins className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
                        <span>{builderConfig.loyalty.bannerText}</span>
                      </span>
                    )}
                    {builderConfig.freeShippingThresholdEnabled && (
                      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-black">
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          شحن مجاني للطلبات فوق {builderConfig.freeShippingThresholdAmount.toLocaleString('ar-EG')} ج.م
                        </span>
                      </span>
                    )}
                  </div>
                </div>
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

                {/* Horizontal Category Tabs (Driven by Builder Order & Visibility) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {activeDecorCategories.map((cat) => {
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
                        {cat.id === 'all' ? t('all_categories') : localizeCraftTerm(cat.nameAr, locale)}
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
                    <span>{isRtl ? 'الكل (كافة الأقسام)' : 'All Sections'}</span>
                    {selectedMainSections.length === 0 && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {MAIN_SECTIONS.map((sec) => {
                    const isChecked = selectedMainSections.includes(sec.id);
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => toggleMainSection(sec.id)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                          isChecked
                            ? 'bg-[#EA580C]/10 text-[#C2410C] dark:text-[#FBBF24]'
                            : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54]'
                        }`}
                      >
                        <span className="truncate">
                          {isRtl ? sec.nameAr : localizeCraftTerm(sec.id, locale)}
                        </span>
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
                    <span>
                      {isRtl
                        ? `الكل (${availableSubCrafts.length} تخصص)`
                        : `All (${availableSubCrafts.length} crafts)`}
                    </span>
                    {selectedSubCrafts.length === 0 && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {availableSubCrafts.map((craft) => {
                    const isChecked = selectedSubCrafts.includes(craft.id);
                    return (
                      <button
                        key={craft.id}
                        type="button"
                        onClick={() => toggleSubCraft(craft.id)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                          isChecked
                            ? 'bg-[#EA580C]/10 text-[#C2410C] dark:text-[#FBBF24]'
                            : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54]'
                        }`}
                      >
                        <span className="truncate">
                          {isRtl ? craft.nameAr : localizeCraftTerm(craft.id, locale)}
                        </span>
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

          {/* Currency Display Switcher & Sort Selector */}
          <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap">
            <div className="relative flex items-center">
              <Coins className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24] absolute right-2.5 pointer-events-none" />
              <select
                value={customerCurrency}
                onChange={(e) => setCustomerCurrency(saveStoredCustomerDisplayCurrency(e.target.value))}
                aria-label="اختيار العملة"
                className="h-10 pr-8 pl-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C] cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.symbol} ({c.code})
                  </option>
                ))}
              </select>
            </div>

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
            </React.Fragment>
          );
        }

        if (block.id === 'catalog_grid') {
          return (
            <React.Fragment key="catalog_grid">
              {/* Feedback Banner */}
              {feedback && (
                <div className="max-w-xl mx-auto px-4 mb-4">
                  <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center shadow-md">
                    {feedback}
                  </div>
                </div>
              )}

              {/* 4. Global E-Commerce Product Grid */}
              <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-2 space-y-3">
                {/* Compact Active Platform Motivational Offers & Points Strip */}
                {(() => {
                  const cfg = loadLoyaltyConfig();
                  const activePlatformOffers: PlatformPromotionalOffer[] = getActivePublicOffers().filter(
                    (o) => o.scope === 'platform'
                  );
                  if (!cfg.enabled || activePlatformOffers.length === 0) return null;
                  const topOffer = activePlatformOffers[0];
                  return (
                    <div
                      className="rounded-2xl border border-amber-500/30 bg-gradient-to-l from-[#FFF8EB] to-[#FAF3E3] dark:from-[#0F1B38] dark:to-[#132040] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                      dir="rtl"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-[#EA580C] text-white text-[10px] font-black shrink-0">
                          {topOffer.badgeAr}
                        </span>
                        <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                          {topOffer.titleAr}
                          <span className="font-bold text-[#475569] dark:text-[#CBD5E1] hidden md:inline">
                            {' '}— 1 نقطة = {cfg.pointValueEgp} ج.م (خصم مموّل من المنصة حتى {cfg.customerMaxDiscountPercent}% دون المساس بربح الفنان)
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShamousaOpenSignal((n) => n + 1)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#0A1124] border border-[#D4CCBC] dark:border-[#243968] text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24] hover:border-[#EA580C] cursor-pointer whitespace-nowrap"
                        >
                          اسأل شموسة عن العروض ☀️
                        </button>
                        {!(profile || customerUser) && (
                          <button
                            type="button"
                            onClick={() => setIsCustomerAuthOpen(true)}
                            className="px-2.5 py-1 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black cursor-pointer whitespace-nowrap"
                          >
                            سجّل واكسب +{cfg.earningRules.welcomeCustomerPts} نقطة
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <ShamousaActiveFilterBar
                  activeFilter={shamousaFilter}
                  totalCatalogCount={products.length}
                  shippingSaveHintAr={shamousaShippingHint}
                  onClearFilter={() => {
                    setShamousaFilter(null);
                    setShamousaShippingHint(null);
                  }}
                  onSortCheapest={() => setSortBy('price_asc')}
                  onOpenShamousa={() => setShamousaOpenSignal((n) => n + 1)}
                />
                {loading ? (
                  <div className={getGridColsClass(builderConfig.defaultDesktopCols, builderConfig.defaultMobileCols)}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden animate-pulse"
                      >
                        <div className="w-full aspect-[4/3] bg-[#E9E2D4] dark:bg-[#132040]" />
                        <div className="p-2.5 sm:p-4 space-y-2.5 sm:space-y-3">
                          <div className="h-3 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-1/2" />
                          <div className="h-4 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-4/5" />
                          <div className="h-5 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-1/3" />
                          <div className="h-8 sm:h-9 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded-xl w-full" />
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
                  <div className={getGridColsClass(builderConfig.defaultDesktopCols, builderConfig.defaultMobileCols)}>
                    {filteredProducts.map((p) => renderProductCard(p))}
                  </div>
                )}
              </main>
            </React.Fragment>
          );
        }

        return null;
      })}

      {/* 5. Product Details Modal (Gallery + Dynamic Size Pricing + Discounts + Custom Order) */}
      {selectedProductDetails && (() => {
        const modalPricing = resolveProductOfferPricing(
          selectedProductDetails,
          modalSelectedSize,
          customerCurrency,
          true
        );
        const galleryList = Array.from(
          new Set(
            [selectedProductDetails.imageUrl, ...(selectedProductDetails.galleryUrls || [])].filter(
              (u): u is string => Boolean(u && u.trim())
            )
          )
        );
        const hasSizesList =
          (selectedProductDetails.sizeVariants && selectedProductDetails.sizeVariants.length > 0) ||
          (selectedProductDetails.availableSizes && selectedProductDetails.availableSizes.length > 0);
        const sizeLabels =
          selectedProductDetails.sizeVariants && selectedProductDetails.sizeVariants.length > 0
            ? selectedProductDetails.sizeVariants.map((v) => v.label)
            : selectedProductDetails.availableSizes || [];

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#060B18]/75 backdrop-blur-sm"
            dir={dir}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedProductDetails(null);
            }}
          >
            <div className={`bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto ${isRtl ? 'text-right' : 'text-left'} shadow-2xl p-5 sm:p-6 space-y-6 text-[#0C1427] dark:text-[#F7F3EA] relative`}>
              <button
                type="button"
                onClick={() => setSelectedProductDetails(null)}
                className={`w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center transition cursor-pointer absolute top-4 ${isRtl ? 'left-4' : 'right-4'} z-10`}
                title={isRtl ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                {/* Product Media + Multi-Image Thumbnails */}
                <div className="space-y-2.5">
                  <div className="relative w-full aspect-[4/3] md:aspect-square rounded-2xl overflow-hidden bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                    {modalPricing.badgeText && (
                      <span className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-md bg-[#C2410C] text-white text-[11px] font-black shadow-xs">
                        {modalPricing.badgeText}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleWishlistMarket(
                          selectedProductDetails,
                          modalPricing.egpFinalPrice,
                          modalPricing.isFreeShipping
                        )
                      }
                      aria-label={wishlistIds.has(selectedProductDetails.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                      className="absolute top-2.5 left-2.5 z-10 w-9 h-9 rounded-full bg-[#F7F3EA]/90 dark:bg-[#0C1427]/85 border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          wishlistIds.has(selectedProductDetails.id)
                            ? 'fill-rose-500 text-rose-500'
                            : 'text-[#334155] dark:text-[#CBD5E1]'
                        }`}
                      />
                    </button>
                    <img
                      src={modalActiveImage || selectedProductDetails.imageUrl || '/alshams_falcon_emblem.png'}
                      alt={pickMarketProductField(selectedProductDetails, 'name')}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/alshams_falcon_emblem.png';
                      }}
                    />
                  </div>
                  {galleryList.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {galleryList.map((imgUrl, gi) => (
                        <button
                          key={gi}
                          type="button"
                          onClick={() => setModalActiveImage(imgUrl)}
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition ${
                            (modalActiveImage || selectedProductDetails.imageUrl) === imgUrl
                              ? 'border-[#EA580C]'
                              : 'border-[#D4CCBC] dark:border-[#22355E] opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Contiguous Purchase Module */}
                <div className="space-y-4 text-xs leading-relaxed flex flex-col justify-between">
                  <div className={`space-y-3 ${isRtl ? 'pl-8 md:pl-0' : 'pr-8 md:pr-0'}`}>
                    <p className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                      {localizeCraftTerm(
                        selectedProductDetails.craftName || String(selectedProductDetails.category || ''),
                        locale
                      )}{' '}
                      ·{' '}
                      {(selectedProductDetails.currentStock || 0) > 0
                        ? t('in_stock')
                        : isRtl
                        ? 'تنفيذ بالطلب'
                        : 'Made to order'}
                    </p>

                    <h3 className="font-black text-xl text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                      {pickMarketProductField(selectedProductDetails, 'name')}
                    </h3>

                    <div className="flex items-baseline gap-2 font-mono tabular-nums pt-1 flex-wrap">
                      <span className="text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        {modalPricing.finalPrice.toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                      </span>
                      <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                        {modalPricing.displaySymbol}
                      </span>
                      {modalPricing.hasDiscount && (
                        <span className="text-sm line-through text-[#64748B] dark:text-[#94A3B8]">
                          {modalPricing.originalPrice.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {modalPricing.displaySymbol}
                        </span>
                      )}
                    </div>

                    {modalPricing.isFreeShipping && (
                      <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span>{t('free_shipping')}</span>
                      </p>
                    )}

                    {selectedProductDetails.isCustomOrderAvailable && (
                      <div className="py-1.5 px-2.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] inline-flex items-center gap-1.5 font-bold text-[#C2410C] dark:text-[#FBBF24]">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('custom_orders_available')}</span>
                      </div>
                    )}

                    {/* Workshop & Artist attribution: Super Admin ALWAYS sees full info; shoppers see workshop & artist when toggled ON (never phone number) */}
                    {(isSuperAdmin || builderConfig.showWorkshopAndArtistInDetails) && (
                      <div className="py-2 px-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-1">
                        <p className="font-bold text-[#C2410C] dark:text-[#FBBF24]">
                          {isRtl ? 'الورشة:' : 'Workshop:'} {selectedProductDetails.brandName || 'الشمساوية'} · {isRtl ? 'الفنان:' : 'Artisan:'}{' '}
                          {selectedProductDetails.artistName || 'فنان الشمساوية'}
                        </p>
                        {isSuperAdmin && selectedProductDetails.phoneNumber && (
                          <p className="font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]" dir="ltr">
                            {selectedProductDetails.phoneNumber}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                      {pickMarketProductField(selectedProductDetails, 'description') ||
                        selectedProductDetails.input?.personalNotes ||
                        (isRtl ? 'مشغولة يدوية مصنوعة بإتقان وجودة عالية.' : 'Authentic handmade piece crafted with high quality.')}
                    </p>

                    {/* Direct Shareable Product Landing Link (/product/:id) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(buildProductLandingUrl(selectedProductDetails.id));
                          } catch {}
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#EA580C]" />
                        <span>{isRtl ? 'نسخ رابط المنتج المباشر' : 'Copy Product Link'}</span>
                      </button>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildProductLandingUrl(selectedProductDetails.id))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] dark:text-sky-300 border border-[#1877F2]/30 text-[11px] font-black inline-flex items-center gap-1"
                      >
                        <span>{isRtl ? 'فيسبوك' : 'Facebook'}</span>
                      </a>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `${pickMarketProductField(selectedProductDetails, 'name')} — ${modalPricing.finalPrice.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} ${modalPricing.displaySymbol}\n${buildProductLandingUrl(selectedProductDetails.id)}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30 text-[11px] font-black inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>{isRtl ? 'واتساب' : 'WhatsApp'}</span>
                      </a>
                    </div>

                    {selectedProductDetails.availableColors &&
                      selectedProductDetails.availableColors.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <label className="block font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                            {isRtl ? 'الألوان المتاحة' : 'Available Colors'}
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
                                {localizeColorLabel(color, locale, {
                                  [locale]: selectedProductDetails.translations?.[locale]?.colors?.[color],
                                  en: selectedProductDetails.translations?.en?.colors?.[color],
                                })}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {hasSizesList && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                          {isRtl ? 'اختر مقاسك المفضل' : 'Select Size'}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {sizeLabels.map((size) => {
                            const matchedVar = selectedProductDetails.sizeVariants?.find((v) => v.label === size);
                            const displaySize = localizeSizeLabel(
                              size,
                              locale,
                              {
                                ...(matchedVar?.translations || {}),
                                ...(selectedProductDetails.translations?.[locale]?.sizes?.[size]
                                  ? { [locale]: selectedProductDetails.translations?.[locale]?.sizes?.[size] }
                                  : {}),
                                ...(selectedProductDetails.translations?.en?.sizes?.[size]
                                  ? { en: selectedProductDetails.translations?.en?.sizes?.[size] }
                                  : {}),
                              },
                              matchedVar?.labelEn
                            );
                            const varPricing = resolveProductOfferPricing(
                              selectedProductDetails,
                              size,
                              customerCurrency,
                              true
                            );
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setModalSelectedSize(size)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                                  modalSelectedSize === size
                                    ? 'bg-[#EA580C] text-white border-[#EA580C]'
                                    : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                                }`}
                              >
                                <span>{displaySize}</span>
                                {selectedProductDetails.sizeVariants &&
                                  selectedProductDetails.sizeVariants.length > 0 && (
                                    <span className="font-mono tabular-nums opacity-90 text-[11px]">
                                      ({varPricing.finalPrice.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {varPricing.displaySymbol})
                                    </span>
                                  )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-1">
                      <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                        {isRtl ? 'ملاحظات على الطلب (اختياري)' : 'Order Notes (optional)'}
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
                      style={
                        isCustomTheme
                          ? { background: `linear-gradient(to right, ${themeMeta.accentBg}, ${themeMeta.accentHover})` }
                          : undefined
                      }
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        أضف للسلة ·{' '}
                        {(modalPricing.finalPrice * modalQuantity).toLocaleString('ar-EG')}{' '}
                        {modalPricing.displaySymbol}
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
        );
      })()}

      {/* Persistent Cart Modal (Deposit details appear cleanly inside checkout) */}
      <MarketplaceCartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        customerUser={customerUser}
        onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
        checkoutSource="marketplace"
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
            href={`https://wa.me/${(builderConfig.whatsappSupport?.phone || '201000996059').replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>الدعم الفني</span>
          </a>
        </div>
      </footer>

      {/* درج المفضلة ❤️ (مع مشاركة واتساب وفيسبوك + نقل للمقارنة + وفّر شحن) */}
      <PublicFavoritesDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        items={wishlistItems}
        onRemove={(id) => setWishlistItems(removeWishlistItem(id))}
        onSelectProduct={(id) => {
          const found = products.find((x) => x.id === id);
          if (found) {
            setIsWishlistOpen(false);
            handleOpenProductDetails(found);
          }
        }}
        onMoveToCompare={(wi) => {
          const found = products.find((x) => x.id === wi.id);
          if (found) {
            handleToggleCompareMarket(found, wi.egpPrice, wi.isFreeShipping);
          } else {
            const res = toggleCompareItem({
              id: wi.id,
              scope: 'artisan',
              name: wi.productName,
              imageUrl: wi.imageUrl,
              priceEgp: wi.egpPrice,
              craftOrCategory: wi.craftName,
              inStock: true,
              storeName: wi.artistName || 'الشمساوية',
              storeId: wi.workshopId,
              isFreeShipping: wi.isFreeShipping,
            });
            setCompareItems(res.scopeItems);
          }
        }}
        compareIds={compareIds}
        formatPrice={(egp) => {
          const v = convertBetweenCurrencies(egp, 'EGP', customerCurrency);
          const c = getCurrencyInfo(customerCurrency);
          return `${Math.round(v).toLocaleString('ar-EG')} ${c.symbol}`;
        }}
        isGuest={!profile && !customerUser}
        onOpenRegister={() => {
          setIsWishlistOpen(false);
          setIsCustomerAuthOpen(true);
        }}
      />

      {/* شاشة المقارنة المنفصلة ⚖️ عن السلة */}
      <PublicCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        scope="artisan"
        items={compareItems}
        onRemove={(id) => setCompareItems(removeCompareItem(id, 'artisan'))}
        onClearAll={() => {
          clearCompareScope('artisan');
          setCompareItems([]);
        }}
        onSelectProduct={(id) => {
          const found = products.find((x) => x.id === id);
          if (found) {
            setIsCompareOpen(false);
            handleOpenProductDetails(found);
          }
        }}
        onAddToCart={(ci) => {
          const found = products.find((x) => x.id === ci.id);
          if (found) {
            handleAddToCart(found, 1);
          } else {
            addToCart({
              id: 'cart_' + Date.now(),
              productId: ci.id,
              productName: ci.name,
              price: ci.priceEgp,
              quantity: 1,
              imageUrl: ci.imageUrl || '',
              craftName: ci.craftOrCategory,
              workshopId: ci.storeId || 'central',
              artistName: ci.storeName || 'فنان الشمساوية',
              isFreeShipping: ci.isFreeShipping,
            });
            playSuccessSound();
            setFeedback(`تمت إضافة "${ci.name}" إلى السلة`);
            setTimeout(() => setFeedback(''), 2600);
          }
        }}
        formatPrice={(egp) => {
          const v = convertBetweenCurrencies(egp, 'EGP', customerCurrency);
          const c = getCurrencyInfo(customerCurrency);
          return `${Math.round(v).toLocaleString('ar-EG')} ${c.symbol}`;
        }}
      />

      {/* ويدجت شموسة الأوفلاين 100% لسوق الشمسية (تفلتر الشبكة + هدية سريعة + Lead Magnet) */}
      <ShamousaMarketAssistantWidget
        mode="alshams_market"
        catalog={sanitizedShamousaCatalog}
        isAuthenticated={Boolean(profile || customerUser)}
        compareCount={compareItems.length}
        favoritesCount={wishlistItems.length}
        activeFilter={shamousaFilter}
        onApplyFilter={(f, hint) => {
          setShamousaFilter(f);
          setShamousaShippingHint(hint || null);
          if (f) scrollToCatalog();
        }}
        onOpenCompare={() => setIsCompareOpen(true)}
        onOpenFavorites={() => setIsWishlistOpen(true)}
        onOpenRegister={() => setIsCustomerAuthOpen(true)}
        externalOpenSignal={shamousaOpenSignal}
      />

      {/* Optional Floating WhatsApp Support Button (positioned above Shamousa button to avoid overlap) */}
      {builderConfig.whatsappSupport?.enabled && (
        <a
          href={`https://wa.me/${(builderConfig.whatsappSupport.phone || '201000996059').replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          title="تواصل معنا عبر واتساب"
          className="fixed bottom-16 left-4 z-30 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg border border-emerald-400/40 transition cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{builderConfig.whatsappSupport.label || 'تواصل معنا'}</span>
        </a>
      )}
    </div>
  );
};
