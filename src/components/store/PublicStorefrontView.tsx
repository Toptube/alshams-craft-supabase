import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingBag,
  Phone,
  Search,
  Star,
  ShieldCheck,
  Truck,
  ArrowRight,
  Home,
  ExternalLink,
  Share2,
  X,
  Plus,
  Minus,
  MessageCircle,
  Mail,
  Send,
  Check,
  ArrowUpDown,
  LayoutList,
  Columns2,
  Grid3x3,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Eye,
  Clock,
  Sparkles,
  Coins,
  Heart,
  Gift,
  Trash2,
  User,
  Flame,
  Tag,
} from 'lucide-react';
import { MemberPersonalProfileView } from '../profile/MemberPersonalProfileView';
import { ProductVideoThumbnail } from '../common/ProductVideoThumbnail';
import { ProductMediaCarousel } from '../common/ProductMediaCarousel';
import { buildProductLandingUrl } from '../../lib/appRoutes';
import {
  fetchPublicStorefrontBySlug,
  normalizeCloudProduct,
  CloudMarketplaceProduct,
  PublicWorkshopStoreData,
  getLocalWorkshopStoreLayout,
  saveWorkshopStoreLayout,
} from '../../db/marketplaceCloud';
import { supabase } from '../../lib/supabase';
import {
  addToCart,
  getStoredCart,
  getStoredCustomerSession,
  OFFICIAL_SUPPORT_PHONE,
  syncPlatformSettingsFromCloud,
} from '../../services/marketplaceCartService';
import {
  WishlistItem,
  getWishlistItems,
  toggleWishlistItem,
  removeWishlistItem,
} from '../../services/wishlistService';
import { MarketplaceCartModal } from '../marketplace/MarketplaceCartModal';
import { CustomerAuthModal } from '../marketplace/CustomerAuthModal';
import { CustomerAuthUser, SavedProductRecord, UserProfile } from '../../types';
import { playSuccessSound, playAddToCartSound, playTapSound, triggerHaptic } from '../../lib/sounds';
import { tenantStorage } from '../../db/dexieDB';
import { matchesWorkshopSlug } from '../../utils/slugify';
import { resolveStorefrontTheme, StorefrontThemeId } from '../../lib/storefrontThemes';
import {
  ArtisanStoreConfig,
  normalizeArtisanStoreConfig,
  getStoredArtisanStoreConfig,
  resolveProductOfferPricing,
  seedArtisanSocialDefaults,
  DEFAULT_ARTISAN_STORY,
} from '../../types/artisanStoreBuilder';
import {
  SUPPORTED_CURRENCIES,
  convertBetweenCurrencies,
  getCurrencyInfo,
  getStoredCustomerDisplayCurrency,
  saveStoredCustomerDisplayCurrency,
  toEgpAmount,
} from '../../lib/currency';
import { ContactBubbleDock, ArtisanFooterContacts } from './ContactBubbleDock';
import { StorePromoBannerDisplay } from './StorePromoBannerDisplay';
import {
  usePublicLocale,
  pickLocalizedText,
  resolveBilingualLogo,
  PublicLocaleCode,
} from '../../lib/publicLocale';
import { PublicLocaleCurrencyBar } from '../common/PublicLocaleCurrencyBar';

interface PublicStorefrontViewProps {
  slug: string;
  onNavigateToApp?: () => void;
  onNavigateToMarket?: () => void;
  isOwnerPreview?: boolean;
  onClosePreview?: () => void;
  localFallbackProducts?: SavedProductRecord[];
  ownerProfile?: UserProfile;
  initialLayoutCols?: 1 | 2 | 3;
  initialProductOrder?: string[];
  onLayoutChanged?: (cols: 1 | 2 | 3, order: string[]) => void;
  previewThemeOverride?: StorefrontThemeId | null;
  localConfigOverride?: ArtisanStoreConfig | null;
}

export const PublicStorefrontView: React.FC<PublicStorefrontViewProps> = ({
  slug,
  onNavigateToApp,
  onNavigateToMarket,
  isOwnerPreview = false,
  onClosePreview,
  localFallbackProducts,
  ownerProfile,
  initialLayoutCols,
  initialProductOrder,
  onLayoutChanged,
  previewThemeOverride,
  localConfigOverride,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [storeData, setStoreData] = useState<PublicWorkshopStoreData | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc'>('featured');
  const [cartItemsCount, setCartItemsCount] = useState<number>(0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState<boolean>(false);
  const [customerUser, setCustomerUser] = useState<CustomerAuthUser | null>(getStoredCustomerSession());
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Storefront Display Layout (1, 2, or 3 cols) & Product Ordering
  const [layoutCols, setLayoutCols] = useState<1 | 2 | 3>(initialLayoutCols || 2);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState<boolean>(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const [productOrder, setProductOrder] = useState<string[]>(initialProductOrder || []);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [savingLayout, setSavingLayout] = useState<boolean>(false);

  useEffect(() => {
    if (!isLayoutMenuOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(event.target as Node)) {
        setIsLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isLayoutMenuOpen]);

  // Selected product modal
  const [selectedProduct, setSelectedProduct] = useState<CloudMarketplaceProduct | null>(null);
  const [modalActiveImage, setModalActiveImage] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Customer display currency & Theme & Artisan Store Config & Wishlist & Live FX
  const [customerCurrency, setCustomerCurrency] = useState<string>(() =>
    getStoredCustomerDisplayCurrency()
  );
  const [localArtisanConfigOverride, setLocalArtisanConfigOverride] =
    useState<ArtisanStoreConfig | null>(null);
  // Countdown handled inside StorePromoBannerDisplay
  const [fxTick, setFxTick] = useState<number>(0);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(() => getWishlistItems());
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  const wishlistIds = useMemo(() => new Set(wishlistItems.map((i) => i.id)), [wishlistItems]);

  useEffect(() => {
    const onWishlistUpdate = (e: any) => {
      if (Array.isArray(e?.detail)) setWishlistItems(e.detail);
      else setWishlistItems(getWishlistItems());
    };
    const onFxUpdate = () => setFxTick((t) => t + 1);
    window.addEventListener('alshams_wishlist_updated', onWishlistUpdate);
    window.addEventListener('alshams_market_builder_updated', onFxUpdate);
    return () => {
      window.removeEventListener('alshams_wishlist_updated', onWishlistUpdate);
      window.removeEventListener('alshams_market_builder_updated', onFxUpdate);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncDark = () => setIsDarkTheme(document.documentElement.classList.contains('dark'));
    syncDark();
    const obs = new MutationObserver(syncDark);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onCurrencyChange = (e: any) => {
      if (e?.detail) setCustomerCurrency(String(e.detail));
      else setCustomerCurrency(getStoredCustomerDisplayCurrency());
    };
    window.addEventListener('alshams_customer_currency_updated', onCurrencyChange);
    return () => window.removeEventListener('alshams_customer_currency_updated', onCurrencyChange);
  }, []);

  // Direct Admin Support Modal (Store & Catalog complaints / inquiries)
  const [isAdminSupportModalOpen, setIsAdminSupportModalOpen] = useState<boolean>(false);
  const [supportName, setSupportName] = useState<string>('');
  const [supportContact, setSupportContact] = useState<string>('');
  const [supportCategory, setSupportCategory] = useState<string>('شكوى بخصوص المتجر أو الكتالوج');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [supportSubmitting, setSupportSubmitting] = useState<boolean>(false);
  const [supportFeedbackStatus, setSupportFeedbackStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSendAdminSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim() || !supportMessage.trim()) {
      setSupportFeedbackStatus({ type: 'error', text: 'يرجى كتابة الاسم ونص الرسالة أو الشكوى.' });
      return;
    }
    setSupportSubmitting(true);
    setSupportFeedbackStatus(null);
    try {
      const res = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supportName.trim(),
          contact: supportContact.trim(),
          craft: supportCategory,
          message: supportMessage.trim(),
          source: 'artisan_storefront',
          workshopId: storeData?.workshop?.id || null,
          workshopName: storeData?.workshop?.brandName || slug,
          storeSlug: storeData?.workshop?.storeSlug || slug,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى.');
      }
      playSuccessSound();
      setSupportFeedbackStatus({
        type: 'success',
        text: json?.message || 'تم إرسال رسالتك إلى الإدارة بنجاح.',
      });
      setSupportMessage('');
      setTimeout(() => {
        setIsAdminSupportModalOpen(false);
        setSupportFeedbackStatus(null);
      }, 2200);
    } catch (err: any) {
      setSupportFeedbackStatus({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء الإرسال للإدارة.',
      });
    } finally {
      setSupportSubmitting(false);
    }
  };

  const refreshCartCount = () => {
    try {
      const items = getStoredCart();
      const total = items.reduce((sum, item) => sum + item.quantity, 0);
      setCartItemsCount(total);
    } catch {}
  };

  useEffect(() => {
    refreshCartCount();
    const handleCartUpdate = () => refreshCartCount();
    const handleCustUpdate = (e: any) => setCustomerUser(e.detail || null);
    window.addEventListener('alshams_cart_updated', handleCartUpdate);
    window.addEventListener('alshams_customer_updated', handleCustUpdate);
    return () => {
      window.removeEventListener('alshams_cart_updated', handleCartUpdate);
      window.removeEventListener('alshams_customer_updated', handleCustUpdate);
    };
  }, []);

  // Fetch Store Data
  useEffect(() => {
    let isMounted = true;
    syncPlatformSettingsFromCloud().catch(() => {});
    const load = async () => {
      setLoading(true);
      setErrorNotice(null);
      try {
        let data = await fetchPublicStorefrontBySlug(slug);

        // Fallback to local profile ONLY if offline/unavailable AND slug strictly matches this artist's workshop
        if ((!data || !data.workshop) && typeof window !== 'undefined') {
          try {
            const rawProf = localStorage.getItem('alshams_profile');
            if (rawProf) {
              const localProf = JSON.parse(rawProf);
              if (matchesWorkshopSlug(localProf, slug)) {
                const wid = localProf.workshopId || localProf.tenantId || localProf.id;
                const localSuspended = Boolean(
                  localProf.isFrozen || localProf.status === 'banned' || localProf.status === 'suspended'
                );
                data = {
                  workshop: {
                    id: wid,
                    brandName: localProf.brandName || 'ورشة الشمساوية',
                    artistName: localProf.artistName || 'فنان الشمساوية',
                    phoneNumber: localProf.phoneNumber || OFFICIAL_SUPPORT_PHONE,
                    country: localProf.country || 'مصر',
                    currencySymbol: localProf.currencySymbol || 'ج.م',
                    logoUrl: localProf.logo_url || localProf.logoUrl || localProf.logoBase64,
                    storeSlug: localProf.store_slug || localProf.storeSlug || wid,
                    ratingStars: localProf.ratingStars || localProf.rating_stars || 5,
                    medal: localProf.medal || 'gold',
                    status: localProf.status || 'active',
                    suspended: localSuspended,
                    suspensionReason: localProf.suspension_reason || null,
                  },
                  products: [],
                };
              }
            }
          } catch {}
        }

        if (isMounted) {
          if (data && data.workshop) {
            if (
              data.workshop.suspended ||
              data.workshop.status === 'banned' ||
              data.workshop.status === 'suspended'
            ) {
              setStoreData({
                workshop: { ...data.workshop, suspended: true },
                products: [],
              });
              setLoading(false);
              return;
            }
            const targetWorkshopId = data.workshop.id;
            const mergedMap = new Map<string, any>();
            const rejectedIds = new Set<string>();

            if (Array.isArray(data.products)) {
              data.products.forEach((p: any) => {
                if ((p.workshop_id || p.workshopId) === targetWorkshopId) {
                  if (p.status === 'rejected') rejectedIds.add(p.id);
                  else mergedMap.set(p.id, p);
                }
              });
            }

            if (typeof navigator === 'undefined' || navigator.onLine) {
              try {
                const sourceTable = isOwnerPreview ? 'marketplace_products' : 'public_marketplace_products';
                const { data: marketData } = await supabase
                  .from(sourceTable)
                  .select('*')
                  .eq('workshop_id', targetWorkshopId);
                if (Array.isArray(marketData)) {
                  marketData.forEach((p: any) => {
                    if (p.status === 'rejected') {
                      rejectedIds.add(p.id);
                      mergedMap.delete(p.id);
                    } else {
                      mergedMap.set(p.id, { ...(mergedMap.get(p.id) || {}), ...p });
                    }
                  });
                }
              } catch {}
            }

            if (typeof window !== 'undefined') {
              try {
                const rawProf = localStorage.getItem('alshams_profile');
                const localProf = ownerProfile || (rawProf ? JSON.parse(rawProf) : null);
                const localWid = localProf?.tenantId || localProf?.workshopId || localProf?.id;
                if (isOwnerPreview || (localWid && localWid === targetWorkshopId)) {
                  const localProds =
                    Array.isArray(localFallbackProducts) && localFallbackProducts.length > 0
                      ? localFallbackProducts
                      : await tenantStorage.getProducts(targetWorkshopId);
                  localProds
                    .filter((p) => p.inStore && p.isPublishedInStore !== false && !rejectedIds.has(p.id))
                    .forEach((p) => {
                      if (!mergedMap.has(p.id)) {
                        const srcCurr = p.sourceCurrency || 'EGP';
                        const rawStore = p.storePrice || p.retailPrice || 0;
                        const rawRetail = p.retailPrice || p.storePrice || 0;
                        const variants = Array.isArray(p.sizeVariants)
                          ? p.sizeVariants.map((v) => ({
                              ...v,
                              egpPrice: v.egpPrice || toEgpAmount(v.price, srcCurr),
                            }))
                          : [];
                        mergedMap.set(p.id, {
                          id: p.id,
                          workshop_id: targetWorkshopId,
                          brand_name: data!.workshop.brandName,
                          artist_name: data!.workshop.artistName,
                          phone_number: data!.workshop.phoneNumber,
                          logo_url: data!.workshop.logoUrl,
                          store_slug: data!.workshop.storeSlug,
                          product_name: p.productName,
                          category: p.category || p.craftName || 'أعمال يدوية',
                          craft_name: p.craftName || p.category || 'أعمال يدوية',
                          decor_category: p.decorCategory || 'all',
                          store_price: toEgpAmount(rawStore, srcCurr),
                          retail_price: toEgpAmount(rawRetail, srcCurr),
                          wholesale_price: p.wholesalePrice || 0,
                          cost_price: p.costPrice || 0,
                          current_stock: p.currentStock ?? 1,
                          image_url: p.imageUrl || p.input?.productImageUrl || '/alshams_falcon_emblem.png',
                          gallery_urls: p.galleryUrls || [],
                          video_url: p.videoUrl || '',
                          size_variants: variants,
                          source_currency: srcCurr,
                          product_discount: p.productDiscount,
                          is_custom_order_available: p.isCustomOrderAvailable,
                          store_description: p.storeDescription || (p as any).notes || '',
                          available_colors: p.availableColors || [],
                          available_sizes:
                            variants.length > 0 ? variants.map((v) => v.label) : p.availableSizes || [],
                          status: p.isMarketplaceApproved ? 'approved' : 'pending_approval',
                        });
                      }
                    });
                }
              } catch {}
            }

            const finalProducts = Array.from(mergedMap.values());
            const localLayout = getLocalWorkshopStoreLayout(targetWorkshopId);
            const resolvedCols = (
              initialLayoutCols ||
              data.workshop.storeLayoutCols ||
              localLayout.layoutCols ||
              2
            ) as 1 | 2 | 3;
            const resolvedOrder =
              initialProductOrder && initialProductOrder.length > 0
                ? initialProductOrder
                : data.workshop.storeProductOrder && data.workshop.storeProductOrder.length > 0
                ? data.workshop.storeProductOrder
                : localLayout.productOrder;

            setLayoutCols(resolvedCols === 1 ? 1 : resolvedCols === 3 ? 3 : 2);
            setProductOrder(resolvedOrder || []);

            setStoreData({
              workshop: {
                ...data.workshop,
                storeLayoutCols: resolvedCols,
                storeProductOrder: resolvedOrder,
              },
              products: finalProducts
                .filter(
                  (p: any) =>
                    p.status !== 'rejected' &&
                    !rejectedIds.has(p.id) &&
                    !p.dimensions?.__artisanExt?.hiddenInStore &&
                    (p.workshop_id || p.workshopId) === targetWorkshopId
                )
                .map((p: any) =>
                  normalizeCloudProduct({
                    ...p,
                    brand_name: data!.workshop.brandName,
                    artist_name: data!.workshop.artistName,
                    phone_number: p.phone_number || data!.workshop.phoneNumber,
                    logo_url: p.logo_url || data!.workshop.logoUrl,
                    store_slug: data!.workshop.storeSlug,
                  })
                ),
            });
          } else {
            const fallbackWid = ownerProfile?.tenantId || ownerProfile?.workshopId || ownerProfile?.id || slug;
            const localLayout = getLocalWorkshopStoreLayout(fallbackWid);
            const resolvedCols = (initialLayoutCols || localLayout.layoutCols || 2) as 1 | 2 | 3;
            const resolvedOrder =
              initialProductOrder && initialProductOrder.length > 0 ? initialProductOrder : localLayout.productOrder;
            setLayoutCols(resolvedCols === 1 ? 1 : resolvedCols === 3 ? 3 : 2);
            setProductOrder(resolvedOrder || []);

            const decoded = decodeURIComponent(slug).replace(/-/g, ' ');
            const fallbackMapped = (localFallbackProducts || [])
              .filter((p) => p.inStore && p.isPublishedInStore !== false)
              .map((p) => {
                const srcCurr = p.sourceCurrency || 'EGP';
                const rawStore = p.storePrice || p.retailPrice || 0;
                const rawRetail = p.retailPrice || p.storePrice || 0;
                const variants = Array.isArray(p.sizeVariants)
                  ? p.sizeVariants.map((v) => ({
                      ...v,
                      egpPrice: v.egpPrice || toEgpAmount(v.price, srcCurr),
                    }))
                  : [];
                return normalizeCloudProduct({
                  id: p.id,
                  workshop_id: fallbackWid,
                  brand_name: ownerProfile?.brandName || decoded || 'متجر حرفي',
                  artist_name: ownerProfile?.artistName || 'فنان الشمساوية',
                  phone_number: ownerProfile?.phoneNumber || OFFICIAL_SUPPORT_PHONE,
                  logo_url: ownerProfile?.logoUrl || ownerProfile?.logoBase64,
                  store_slug: slug,
                  product_name: p.productName,
                  category: p.category || p.craftName || 'أعمال يدوية',
                  craft_name: p.craftName || p.category || 'أعمال يدوية',
                  decor_category: p.decorCategory || 'all',
                  store_price: toEgpAmount(rawStore, srcCurr),
                  retail_price: toEgpAmount(rawRetail, srcCurr),
                  wholesale_price: p.wholesalePrice || 0,
                  cost_price: p.costPrice || 0,
                  current_stock: p.currentStock ?? 1,
                  image_url: p.imageUrl || p.input?.productImageUrl || '/alshams_falcon_emblem.png',
                  gallery_urls: p.galleryUrls || [],
                  video_url: p.videoUrl || '',
                  size_variants: variants,
                  source_currency: srcCurr,
                  product_discount: p.productDiscount,
                  is_custom_order_available: p.isCustomOrderAvailable,
                  store_description: p.storeDescription || (p as any).notes || '',
                  available_colors: p.availableColors || [],
                  available_sizes:
                    variants.length > 0 ? variants.map((v) => v.label) : p.availableSizes || [],
                  status: p.isMarketplaceApproved ? 'approved' : 'pending_approval',
                });
              });

            setStoreData({
              workshop: {
                id: fallbackWid,
                brandName: ownerProfile?.brandName || decoded || 'متجر حرفي',
                artistName: ownerProfile?.artistName || 'فنان الشمساوية',
                phoneNumber: ownerProfile?.phoneNumber || OFFICIAL_SUPPORT_PHONE,
                country: ownerProfile?.country || 'مصر',
                currencySymbol: ownerProfile?.currencySymbol || 'ج.م',
                ratingStars: ownerProfile?.ratingStars || 5,
                medal: ownerProfile?.medal || 'gold',
                logoUrl: ownerProfile?.logoUrl || ownerProfile?.logoBase64,
                storeSlug: slug,
                storeLayoutCols: resolvedCols,
                storeProductOrder: resolvedOrder,
              },
              products: fallbackMapped,
            });
          }
        }
      } catch {
        if (isMounted) {
          setErrorNotice('تعذر تحميل معروضات المتجر حالياً.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [slug, isOwnerPreview]);

  const { specialOfferProducts, bestSellerProducts } = useMemo(() => {
    const allProds = storeData?.products || [];
    const offers: CloudMarketplaceProduct[] = [];
    const bests: CloudMarketplaceProduct[] = [];
    allProds.forEach((p) => {
      const pr = resolveProductOfferPricing(p, p.size_variants?.[0]?.label, customerCurrency, true);
      if (pr.isSpecialOffer || pr.hasDiscount || Boolean(pr.bogoLabel)) offers.push(p);
      if (pr.isBestSeller) bests.push(p);
    });
    return { specialOfferProducts: offers, bestSellerProducts: bests };
  }, [storeData?.products, customerCurrency]);

  const categories = useMemo(() => {
    if (!storeData?.products || storeData.products.length === 0) {
      return [{ id: 'all', name: 'كافة المعروضات' }];
    }
    const cats = new Set<string>();
    storeData.products.forEach((p) => {
      if (p.craft_name) cats.add(p.craft_name);
      else if (p.category) cats.add(p.category);
    });
    const base = [{ id: 'all', name: 'كافة المعروضات' }];
    if (specialOfferProducts.length > 0) {
      base.push({ id: '__offers__', name: `🔥 العروض الخاصة (${specialOfferProducts.length})` });
    }
    if (bestSellerProducts.length > 0) {
      base.push({ id: '__bestsellers__', name: `⭐ الأكثر طلباً (${bestSellerProducts.length})` });
    }
    return [...base, ...Array.from(cats).map((c) => ({ id: c, name: c }))];
  }, [storeData, specialOfferProducts.length, bestSellerProducts.length]);

  const filteredProducts = useMemo(() => {
    if (!storeData?.products) return [];
    const offerIds = new Set(specialOfferProducts.map((p) => p.id));
    const bestIds = new Set(bestSellerProducts.map((p) => p.id));

    const list = storeData.products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const transText = (p as any).translations
        ? Object.values((p as any).translations)
            .map((tr: any) => `${tr?.name || ''} ${tr?.description || ''}`)
            .join(' ')
            .toLowerCase()
        : '';
      const matchSearch =
        !q ||
        (p.product_name || '').toLowerCase().includes(q) ||
        (p.store_description || '').toLowerCase().includes(q) ||
        (p.craft_name || '').toLowerCase().includes(q) ||
        transText.includes(q);

      const matchCat =
        selectedCategory === 'all' ||
        (selectedCategory === '__offers__' && offerIds.has(p.id)) ||
        (selectedCategory === '__bestsellers__' && bestIds.has(p.id)) ||
        p.craft_name === selectedCategory ||
        p.category === selectedCategory;

      return matchSearch && matchCat;
    });

    const orderRankMap = new Map(productOrder.map((id, idx) => [id, idx]));

    if (sortBy === 'price_asc') {
      return [...list].sort(
        (a, b) => (a.store_price || a.retail_price || 0) - (b.store_price || b.retail_price || 0)
      );
    }
    if (sortBy === 'price_desc') {
      return [...list].sort(
        (a, b) => (b.store_price || b.retail_price || 0) - (a.store_price || a.retail_price || 0)
      );
    }
    if (orderRankMap.size > 0) {
      return [...list].sort((a, b) => {
        const ra = orderRankMap.has(a.id) ? orderRankMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const rb = orderRankMap.has(b.id) ? orderRankMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return 0;
      });
    }
    return list;
  }, [storeData, searchQuery, selectedCategory, sortBy, productOrder, specialOfferProducts, bestSellerProducts]);

  const activeWorkshopId =
    storeData?.workshop?.id || ownerProfile?.tenantId || ownerProfile?.workshopId || ownerProfile?.id || '';

  useEffect(() => {
    const onArtisanCfgUpdate = (e: any) => {
      if (e?.detail?.config) {
        if (!activeWorkshopId || e.detail.workshopId === activeWorkshopId) {
          setLocalArtisanConfigOverride(e.detail.config);
        }
      } else if (activeWorkshopId) {
        setLocalArtisanConfigOverride(getStoredArtisanStoreConfig(activeWorkshopId));
      }
    };
    window.addEventListener('alshams_artisan_store_config_updated', onArtisanCfgUpdate);
    return () => window.removeEventListener('alshams_artisan_store_config_updated', onArtisanCfgUpdate);
  }, [activeWorkshopId]);

  const artisanConfig = useMemo<ArtisanStoreConfig>(() => {
    const fallbackTel = storeData?.workshop?.phoneNumber || ownerProfile?.phoneNumber;
    if (localArtisanConfigOverride) {
      return seedArtisanSocialDefaults(localArtisanConfigOverride, fallbackTel);
    }
    if (storeData?.workshop?.storeConfig) {
      return seedArtisanSocialDefaults(
        normalizeArtisanStoreConfig(storeData.workshop.storeConfig),
        fallbackTel
      );
    }
    if (activeWorkshopId) {
      return seedArtisanSocialDefaults(getStoredArtisanStoreConfig(activeWorkshopId), fallbackTel);
    }
    return seedArtisanSocialDefaults(normalizeArtisanStoreConfig(null), fallbackTel);
  }, [localArtisanConfigOverride, storeData?.workshop?.storeConfig, storeData?.workshop?.phoneNumber, ownerProfile?.phoneNumber, activeWorkshopId]);

  // Promo banner countdown is self-managed inside <StorePromoBannerDisplay />

  const effectiveConfig = localConfigOverride || artisanConfig;
  const { locale, setLocale, dir, isRtl, t } = usePublicLocale(
    effectiveConfig.enabledLanguages,
    effectiveConfig.defaultLanguage || 'ar'
  );
  const pickConfigField = (
    base: string | undefined | null,
    field: 'brandName' | 'welcomeMessage' | 'artistStory' | 'craftBadge' | 'promoBannerText' | 'portfolioTitle'
  ): string => {
    const tr = effectiveConfig.translations;
    if (!tr) return (base || '').trim();
    const map: Partial<Record<PublicLocaleCode, string | undefined>> = {};
    (Object.keys(tr) as PublicLocaleCode[]).forEach((k) => {
      map[k] = tr[k]?.[field];
    });
    return pickLocalizedText(base, map, locale);
  };
  const pickProductField = (
    p: CloudMarketplaceProduct,
    field: 'name' | 'description'
  ): string => {
    const base = field === 'name' ? p.product_name : p.store_description;
    if (!p.translations) return (base || '').trim();
    const map: Partial<Record<PublicLocaleCode, string | undefined>> = {};
    (Object.keys(p.translations) as PublicLocaleCode[]).forEach((k) => {
      map[k] = p.translations?.[k]?.[field];
    });
    return pickLocalizedText(base, map, locale);
  };
  const themeSpec = useMemo(
    () => resolveStorefrontTheme(previewThemeOverride || effectiveConfig.themePreset),
    [previewThemeOverride, effectiveConfig.themePreset]
  );
  const isCenteredHero =
    themeSpec.heroLayout === 'centered_maison' ||
    themeSpec.heroLayout === 'noir_spotlight' ||
    themeSpec.heroLayout === 'swiss_minimal' ||
    themeSpec.heroLayout === 'arch_crest';

  const persistStorefrontPreferences = async (nextCols: 1 | 2 | 3, nextOrder: string[], toastMsg: string) => {
    setLayoutCols(nextCols);
    setProductOrder(nextOrder);
    onLayoutChanged?.(nextCols, nextOrder);
    setSavingLayout(true);
    try {
      let email = ownerProfile?.email;
      if (!email && typeof window !== 'undefined') {
        try {
          const rawProf = localStorage.getItem('alshams_profile');
          email = rawProf ? JSON.parse(rawProf)?.email : undefined;
        } catch {}
      }
      if (activeWorkshopId) {
        await saveWorkshopStoreLayout(activeWorkshopId, nextCols, nextOrder, email);
        if (nextOrder.length > 0) {
          const rankMap = new Map(nextOrder.map((id, idx) => [id, idx + 1]));
          const existingLocal = await tenantStorage.getProducts(activeWorkshopId).catch(() => []);
          const dirty = existingLocal
            .filter((item) => rankMap.has(item.id) && item.sortOrder !== rankMap.get(item.id))
            .map((item) => ({ ...item, sortOrder: rankMap.get(item.id)!, updatedAt: Date.now() }));
          if (dirty.length > 0) {
            Promise.all(dirty.map((rec) => tenantStorage.mutateProduct(rec))).catch(() => {});
          }
        }
      }
      playSuccessSound();
      setAddedToast(toastMsg);
      setTimeout(() => setAddedToast(null), 2500);
    } finally {
      setSavingLayout(false);
    }
  };

  const handleChangeLayoutCols = (nextCols: 1 | 2 | 3) => {
    const labelMap: Record<1 | 2 | 3, string> = {
      1: 'تم تحويل العرض إلى: منتج تلو الآخر',
      2: 'تم تحويل العرض إلى: مصفوفة ثنائية (×2)',
      3: 'تم تحويل العرض إلى: مصفوفة ثلاثية (×3)',
    };
    const currentOrder =
      productOrder.length > 0 ? productOrder : (storeData?.products || []).map((p) => p.id);
    persistStorefrontPreferences(nextCols, currentOrder, labelMap[nextCols]);
  };

  const handleReorderStoreProducts = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId || !storeData?.products) return;
    const orderRankMap = new Map(productOrder.map((id, idx) => [id, idx]));
    const baseIds = [...storeData.products]
      .sort((a, b) => {
        const ra = orderRankMap.has(a.id) ? orderRankMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const rb = orderRankMap.has(b.id) ? orderRankMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return 0;
      })
      .map((p) => p.id);

    const fromIdx = baseIds.indexOf(sourceId);
    const toIdx = baseIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = baseIds.splice(fromIdx, 1);
    baseIds.splice(toIdx, 0, moved);
    setSortBy('featured');
    persistStorefrontPreferences(layoutCols, baseIds, '✓ تم تحديث ترتيب المنتجات في متجرك للعملاء');
  };

  const handleStepMoveProduct = (prodId: string, direction: -1 | 1) => {
    const idx = filteredProducts.findIndex((p) => p.id === prodId);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= filteredProducts.length) return;
    handleReorderStoreProducts(prodId, filteredProducts[targetIdx].id);
  };

  const workshop = storeData?.workshop;
  const memberProfile = (workshop as any)?.memberProfile || null;
  const rawArtisanStory = (artisanConfig.artistStory || '').trim();
  const resolvedArtistStory = pickConfigField(
    (rawArtisanStory && rawArtisanStory !== DEFAULT_ARTISAN_STORY
      ? rawArtisanStory
      : '') ||
      memberProfile?.storyText ||
      rawArtisanStory ||
      '',
    'artistStory'
  );
  const profileShowcasePosts: any[] = Array.isArray(memberProfile?.showcasePosts)
    ? memberProfile.showcasePosts
    : [];
  const brandName = pickConfigField(workshop?.brandName || 'ورشة الشمساوية', 'brandName');
  const displayWelcomeMessage = pickConfigField(effectiveConfig.welcomeMessage, 'welcomeMessage');
  const displayCraftBadge = pickConfigField(effectiveConfig.craftBadge, 'craftBadge');
  const storeLogoUrl = resolveBilingualLogo(
    (workshop as any)?.logo_url || workshop?.logoUrl || '/default-store-icon.png',
    effectiveConfig.logoArUrl,
    effectiveConfig.logoEnUrl,
    locale
  );
  const localizedPromoBanner = useMemo(() => {
    const pb = artisanConfig.promoBanner;
    if (!pb) return pb;
    const translated = pickConfigField(pb.text, 'promoBannerText');
    return translated && translated !== pb.text ? { ...pb, text: translated } : pb;
  }, [artisanConfig.promoBanner, effectiveConfig.translations, locale]);
  const artistName = workshop?.artistName || 'فنان الشمساوية';
  const phone = workshop?.phoneNumber || OFFICIAL_SUPPORT_PHONE;
  const whatsappNumber = useMemo(() => {
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return '201000996059';
    return digits.startsWith('0') ? '2' + digits : digits;
  }, [phone]);

  const handleShareStore = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      playSuccessSound();
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleOpenProduct = (p: CloudMarketplaceProduct) => {
    setSelectedProduct(p);
    setModalActiveImage(p.image_url || '/alshams_falcon_emblem.png');
    setSelectedQuantity(1);
    setSelectedColor(p.available_colors?.[0] || '');
    const defaultSize = p.size_variants?.[0]?.label || p.available_sizes?.[0] || '';
    setSelectedSize(defaultSize);
    setCustomNotes('');
  };

  const handleAddToCart = (p: CloudMarketplaceProduct, qtyOverride?: number, chosenSizeOverride?: string) => {
    playAddToCartSound();
    triggerHaptic();

    const activeSize = chosenSizeOverride ?? (selectedProduct?.id === p.id ? selectedSize : p.size_variants?.[0]?.label || p.available_sizes?.[0]);
    const pricing = resolveProductOfferPricing(p, activeSize, customerCurrency, true);
    const finalQty = qtyOverride ?? selectedQuantity;

    addToCart({
      id: 'cart_' + Date.now(),
      productId: p.id,
      productName: p.product_name,
      price: pricing.egpFinalPrice,
      quantity: finalQty,
      imageUrl: p.image_url,
      craftName: p.craft_name,
      workshopId: p.workshop_id || workshop?.id,
      artistName: artistName,
      selectedColor: (selectedProduct?.id === p.id ? selectedColor : p.available_colors?.[0]) || undefined,
      selectedSize: activeSize || undefined,
      customNotes: (selectedProduct?.id === p.id ? customNotes : '') || undefined,
      isFreeShipping: pricing.isFreeShipping || undefined,
    });

    setAddedToast(`تم إضافة "${p.product_name}" إلى السلة`);
    setTimeout(() => setAddedToast(null), 3000);
    setSelectedProduct(null);
  };

  const selectedModalPricing = useMemo(() => {
    if (!selectedProduct) return null;
    return resolveProductOfferPricing(selectedProduct, selectedSize, customerCurrency, true);
  }, [selectedProduct, selectedSize, customerCurrency, fxTick]);

  const handleToggleWishlistProduct = (p: CloudMarketplaceProduct, egpPrice: number, isFreeShip?: boolean) => {
    playTapSound();
    const res = toggleWishlistItem({
      id: p.id,
      productName: p.product_name,
      imageUrl: p.image_url,
      egpPrice,
      craftName: p.craft_name || p.category,
      workshopId: p.workshop_id || workshop?.id,
      brandName,
      artistName,
      storeSlug: workshop?.storeSlug || slug,
      isFreeShipping: isFreeShip,
    });
    setWishlistItems(res.items);
    setAddedToast(res.added ? `♥ تمت إضافة "${p.product_name}" إلى المفضلة` : `تمت إزالة "${p.product_name}" من المفضلة`);
    setTimeout(() => setAddedToast(null), 2600);
  };

  const selectedModalGallery = useMemo(() => {
    if (!selectedProduct) return [];
    const list = [selectedProduct.image_url, ...(selectedProduct.gallery_urls || [])].filter(
      (u): u is string => Boolean(u && u.trim())
    );
    return Array.from(new Set(list));
  }, [selectedProduct]);

  const pageStyle: React.CSSProperties = {
    backgroundColor: themeSpec.pageBg,
    color: themeSpec.inkColor,
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: themeSpec.surfaceBg,
    borderColor: themeSpec.borderColor,
    color: themeSpec.inkColor,
  };

  const softBtnStyle: React.CSSProperties = {
    backgroundColor: themeSpec.softBg,
    borderColor: themeSpec.borderColor,
    color: themeSpec.inkColor,
  };

  const accentBtnStyle: React.CSSProperties = {
    backgroundColor: themeSpec.accentBg,
    color: themeSpec.accentInk,
  };

  return (
    <div
      style={pageStyle}
      className="min-h-screen w-full max-w-full overflow-x-clip pb-20 font-sans transition-colors duration-300"
      dir={dir}
    >
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg">
          {addedToast}
        </div>
      )}

      {/* 1. Clean Three-Zone Top Header */}
      <header
        style={headerStyle}
        className="sticky top-0 z-30 backdrop-blur-md border-b transition-colors duration-300"
      >
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Workshop Brand */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 overflow-hidden">
            <div
              style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
              className={`w-9 h-9 sm:w-10 sm:h-10 ${themeSpec.buttonRadiusClass} border flex items-center justify-center overflow-hidden p-0.5 shrink-0`}
            >
              <img
                src={storeLogoUrl}
                alt={brandName}
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/default-store-icon.png';
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1
                style={{ color: themeSpec.inkColor }}
                className={`${themeSpec.titleWeightClass} text-sm sm:text-lg truncate`}
              >
                {brandName}
              </h1>
              <p
                style={{ color: themeSpec.accentText }}
                className="hidden sm:block text-[10px] font-bold tracking-wider truncate"
              >
                {themeSpec.englishSignature}
              </p>
            </div>
          </div>

          {/* Zone 2: Clean Navigation Links */}
          <nav
            style={{ color: themeSpec.mutedColor }}
            className="hidden md:flex items-center gap-6 text-xs font-bold"
          >
            <a
              href="/#/market"
              onClick={(e) => {
                if (onNavigateToMarket) {
                  e.preventDefault();
                  onNavigateToMarket();
                }
              }}
              className="hover:opacity-100 opacity-90 transition-opacity whitespace-nowrap shrink-0"
              style={{ color: themeSpec.inkColor }}
            >
              سوق الشمساوية
            </a>
            {onNavigateToApp && Boolean(typeof window !== 'undefined' && localStorage.getItem('alshams_profile')) && (
              <button
                type="button"
                onClick={onNavigateToApp}
                className="hover:opacity-100 opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                style={{ color: themeSpec.inkColor }}
              >
                <span>لوحة ورشتي</span>
                <ExternalLink className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
              </button>
            )}
          </nav>

          {/* Zone 3: Minimal Language/Currency Icons, Share, Wishlist & Cart */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <PublicLocaleCurrencyBar
              locale={locale}
              onChangeLocale={setLocale}
              enabledLanguages={effectiveConfig.enabledLanguages}
              currency={customerCurrency}
              onChangeCurrency={(c) => setCustomerCurrency(saveStoredCustomerDisplayCurrency(c))}
              compact
            />
            {isOwnerPreview ? (
              onClosePreview ? (
                <button
                  type="button"
                  onClick={onClosePreview}
                  style={softBtnStyle}
                  className={`hidden sm:inline-flex px-3 h-9 ${themeSpec.buttonRadiusClass} border text-xs font-black transition items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs active:scale-95`}
                >
                  <ArrowRight className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                  <span>عودة لمتجري</span>
                </button>
              ) : null
            ) : (
              (() => {
                const hasLoggedSession =
                  typeof window !== 'undefined' && Boolean(localStorage.getItem('alshams_profile'));
                const targetHandler = hasLoggedSession
                  ? onNavigateToApp || onNavigateToMarket
                  : onNavigateToMarket || onNavigateToApp;
                if (!targetHandler) return null;
                return (
                  <button
                    type="button"
                    onClick={targetHandler}
                    style={softBtnStyle}
                    className={`w-8 h-8 sm:w-auto sm:h-9 sm:px-3 ${themeSpec.buttonRadiusClass} border text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0`}
                    title={hasLoggedSession ? t('back_to_app') : t('back_to_market')}
                  >
                    <Home className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                    <span className="hidden sm:inline">
                      {hasLoggedSession ? t('back_to_app') : t('back_to_market')}
                    </span>
                  </button>
                );
              })()
            )}

            <button
              type="button"
              onClick={handleShareStore}
              style={softBtnStyle}
              className={`w-8 h-8 sm:w-auto sm:h-9 sm:px-3 ${themeSpec.buttonRadiusClass} border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0`}
              title={t('share')}
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Share2 className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
              )}
              <span className="hidden sm:inline">{copiedLink ? t('copied') : t('share')}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              style={softBtnStyle}
              className={`relative w-8 h-8 sm:w-auto sm:h-9 sm:px-3 ${themeSpec.buttonRadiusClass} border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0`}
              title={t('wishlist')}
            >
              <Heart
                className={`w-3.5 h-3.5 ${wishlistItems.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`}
                style={wishlistItems.length === 0 ? { color: themeSpec.accentText } : undefined}
              />
              <span className="hidden md:inline">{t('wishlist')}</span>
              {wishlistItems.length > 0 && (
                <span className="absolute -top-1 -right-1 sm:static min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white font-mono tabular-nums text-[9px] sm:text-[10px] font-black flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              style={accentBtnStyle}
              className={`relative w-8 h-8 sm:w-auto sm:h-9 sm:px-3.5 ${themeSpec.buttonRadiusClass} font-black text-xs transition hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap shrink-0`}
              title={t('cart')}
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('cart')}</span>
              {cartItemsCount > 0 && (
                <span
                  style={{ backgroundColor: themeSpec.badgeBg, color: themeSpec.badgeInk }}
                  className="absolute -top-1 -right-1 sm:static min-w-4 h-4 sm:min-w-5 sm:h-5 px-1 rounded-full font-mono tabular-nums text-[9px] sm:text-[11px] font-black flex items-center justify-center"
                >
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Artisan Store Promotional Banner (Static / Animated Marquee / Slide / Vertical + Clickable Coupons) */}
      <StorePromoBannerDisplay
        banner={localizedPromoBanner}
        currencySymbol={getCurrencyInfo(customerCurrency).symbol}
        coupons={artisanConfig.coupons}
        onSelectCouponCode={(code) => {
          navigator.clipboard?.writeText(code).catch(() => {});
          setAddedToast(`تم نسخ كود الخصم "${code}" — ألصقه عند الدفع في السلة`);
          setTimeout(() => setAddedToast(null), 3200);
        }}
      />

      {/* Optional Editable Cover Photo */}
      {artisanConfig.showCover && artisanConfig.coverUrl && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="w-full h-36 sm:h-52 rounded-2xl overflow-hidden border border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#132040] shadow-xs">
            <img
              src={artisanConfig.coverUrl}
              alt={`غلاف ${brandName}`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Kinetic Announcement Ticker (Pop Atelier Kinetic Engine) */}
      {themeSpec.showKineticTicker && (
        <div
          style={{
            backgroundColor: themeSpec.accentBg,
            color: themeSpec.accentInk,
            borderColor: themeSpec.borderColor,
          }}
          className="border-b-2 py-2 px-4 overflow-hidden select-none"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 text-[11px] sm:text-xs font-black whitespace-nowrap overflow-x-auto scrollbar-none">
            <span>★ {brandName}</span>
            <span>·</span>
            <span>{displayCraftBadge || (locale === 'ar' ? 'صناعة يدوية أصلية 100%' : '100% Authentic Handmade')}</span>
            <span>·</span>
            <span>{locale === 'ar' ? 'توصيل لكافة المحافظات' : 'Nationwide & Worldwide Shipping'}</span>
            <span>·</span>
            <span>{storeData?.products?.length || 0} {locale === 'ar' ? 'قطعة فنية متاحة الآن' : 'Pieces Available'} ★</span>
          </div>
        </div>
      )}

      {/* 2. Architectural World-Class Store Identity Hero (Distinct Structural Layout per Theme) */}
      <section
        style={{
          backgroundColor: themeSpec.heroBg,
          borderColor: themeSpec.heroBorder,
          color: themeSpec.inkColor,
        }}
        className={`relative border-b transition-colors duration-300 ${
          themeSpec.heroLayout === 'swiss_minimal'
            ? 'py-10 sm:py-14 px-4 sm:px-6'
            : themeSpec.heroLayout === 'centered_maison' ||
              themeSpec.heroLayout === 'noir_spotlight' ||
              themeSpec.heroLayout === 'arch_crest'
            ? 'py-8 sm:py-12 px-4 sm:px-6'
            : 'py-6 sm:py-9 px-4 sm:px-6'
        }`}
      >
        {themeSpec.heroLayout === 'noir_spotlight' && (
          <div
            className="absolute top-0 inset-x-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent 5%, ${themeSpec.accentBg} 50%, transparent 95%)`,
            }}
          />
        )}

        {/* ENGINE A: BENTO MOSAIC HERO (Asymmetric Interactive 3-Tile Studio Grid) */}
        {themeSpec.heroLayout === 'bento_mosaic' ? (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Tile 1: Main Brand Story & Direct CTAs (7 cols) */}
            <div
              style={{
                backgroundColor: themeSpec.surfaceBg,
                borderColor: themeSpec.borderColor,
              }}
              className="lg:col-span-7 p-6 sm:p-7 rounded-3xl border shadow-sm flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                {effectiveConfig.showArtistSubtitle && (
                  <p style={{ color: themeSpec.accentText }} className="text-xs font-black">
                    {locale === 'ar' ? `بأنامل الفنان: ${artistName}` : artistName} · {workshop?.country || 'مصر'}
                    {effectiveConfig.showCraftBadge && displayCraftBadge ? ` · ${displayCraftBadge}` : ''}
                  </p>
                )}
                {effectiveConfig.showBrandTitle && (
                  <h2 style={{ color: themeSpec.inkColor }} className="text-2xl sm:text-4xl font-black leading-tight text-balance">
                    {brandName}
                  </h2>
                )}
                {effectiveConfig.showWelcomeMessage && displayWelcomeMessage && (
                  <p style={{ color: themeSpec.mutedColor }} className="text-xs sm:text-sm font-bold leading-relaxed">
                    {displayWelcomeMessage}
                  </p>
                )}
                {effectiveConfig.showArtistStory && resolvedArtistStory && (
                  <p style={{ color: themeSpec.mutedColor }} className="text-xs leading-relaxed">
                    {resolvedArtistStory}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {effectiveConfig.showPhoneButtons && (
                  <>
                    <a
                      href={`tel:${phone}`}
                      style={accentBtnStyle}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition hover:opacity-90"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span dir="ltr">{phone}</span>
                    </a>
                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>واتساب</span>
                    </a>
                  </>
                )}
                {workshop?.id && (
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    style={softBtnStyle}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-xs font-black cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                    <span>معرض الأعمال</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tile 2 & 3: Featured Piece Spotlight + Live Stats Bento Stack (5 cols) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              {filteredProducts[0] ? (
                <button
                  type="button"
                  onClick={() => handleOpenProduct(filteredProducts[0])}
                  style={{
                    backgroundColor: themeSpec.surfaceBg,
                    borderColor: themeSpec.borderColor,
                  }}
                  className="col-span-2 group relative rounded-3xl border overflow-hidden shadow-sm text-right cursor-pointer min-h-[175px] flex items-end"
                >
                  <img
                    src={filteredProducts[0].image_url || '/alshams_falcon_emblem.png'}
                    alt={pickProductField(filteredProducts[0], 'name')}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="relative z-10 p-4 w-full flex items-end justify-between gap-2 text-white">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-amber-300 block">
                        {locale === 'ar' ? 'قطعة مختارة من المتجر' : 'Featured Piece'}
                      </span>
                      <span className="text-sm font-black truncate block">{pickProductField(filteredProducts[0], 'name')}</span>
                    </div>
                    <span
                      style={{ backgroundColor: themeSpec.accentBg, color: themeSpec.accentInk }}
                      className="px-3 py-1.5 rounded-xl text-xs font-black shrink-0"
                    >
                      {t('view_details')}
                    </span>
                  </div>
                </button>
              ) : null}

              <div
                style={{ backgroundColor: themeSpec.accentBg, color: themeSpec.accentInk }}
                className="p-4 rounded-3xl flex flex-col justify-between shadow-sm"
              >
                <div className="flex items-center gap-0.5 text-amber-300">
                  {Array.from({ length: Math.min(5, Math.max(1, Number(workshop?.ratingStars) || 5)) }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  ))}
                </div>
                <div className="pt-2">
                  <p className="text-2xl font-black tabular-nums">{workshop?.ratingStars || 5}.0</p>
                  <p className="text-[11px] font-bold opacity-90">تقييم العملاء</p>
                </div>
              </div>

              <div
                style={{ backgroundColor: themeSpec.surfaceBg, borderColor: themeSpec.borderColor }}
                className="p-4 rounded-3xl border flex flex-col justify-between shadow-sm"
              >
                <ShoppingBag className="w-5 h-5" style={{ color: themeSpec.accentText }} />
                <div className="pt-2">
                  <p style={{ color: themeSpec.inkColor }} className="text-2xl font-black tabular-nums">
                    {storeData?.products?.length || 0}
                  </p>
                  <p style={{ color: themeSpec.mutedColor }} className="text-[11px] font-bold">
                    مشغولة متاحة
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : themeSpec.heroLayout === 'cinema_carousel' ? (
          /* ENGINE B: CINEMATIC LOOKBOOK HERO + INTERACTIVE HORIZONTAL SHOWCASE STRIP */
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                {effectiveConfig.showArtistSubtitle && (
                  <p style={{ color: themeSpec.accentText }} className="text-xs font-black tracking-wide">
                    {artistName} · {workshop?.country || 'مصر'}
                    {effectiveConfig.showCraftBadge && displayCraftBadge ? ` · ${displayCraftBadge}` : ''}
                  </p>
                )}
                {effectiveConfig.showBrandTitle && (
                  <h2 style={{ color: themeSpec.inkColor }} className="text-3xl sm:text-4xl font-black leading-tight text-balance">
                    {brandName}
                  </h2>
                )}
                {effectiveConfig.showWelcomeMessage && displayWelcomeMessage && (
                  <p style={{ color: themeSpec.mutedColor }} className="text-xs sm:text-sm leading-relaxed">
                    {displayWelcomeMessage}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {effectiveConfig.showPhoneButtons && (
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    style={accentBtnStyle}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition hover:opacity-90"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>تواصل مباشر</span>
                  </a>
                )}
                {workshop?.id && (
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    style={softBtnStyle}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-black cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                    <span>قصة الفنان</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Horizontal Lookbook Reel */}
            {filteredProducts.length > 0 && (
              <div className="flex items-stretch gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
                {filteredProducts.slice(0, 6).map((item) => {
                  const pr = resolveProductOfferPricing(item, item.size_variants?.[0]?.label, customerCurrency, true);
                  return (
                    <button
                      key={`reel_${item.id}`}
                      type="button"
                      onClick={() => handleOpenProduct(item)}
                      style={{ backgroundColor: themeSpec.surfaceBg, borderColor: themeSpec.borderColor }}
                      className="snap-start shrink-0 w-56 sm:w-64 rounded-2xl border overflow-hidden group text-right cursor-pointer hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="relative h-36 overflow-hidden" style={{ backgroundColor: themeSpec.softBg }}>
                        <img
                          src={item.image_url || '/alshams_falcon_emblem.png'}
                          alt={pickProductField(item, 'name')}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                        <span
                          style={{ backgroundColor: themeSpec.accentBg, color: themeSpec.accentInk }}
                          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-[11px] font-mono font-black tabular-nums"
                        >
                          {pr.finalPrice.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')} {pr.displaySymbol}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p style={{ color: themeSpec.inkColor }} className="text-xs font-black truncate">
                          {pickProductField(item, 'name')}
                        </p>
                        <p style={{ color: themeSpec.mutedColor }} className="text-[10px] truncate">
                          {item.craft_name || item.category}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ENGINE C: ARCH CREST / POP KINETIC / CLASSIC ARCHITECTURAL HEROES */
          <div
            className={`max-w-7xl mx-auto flex flex-col gap-6 ${
              isCenteredHero
                ? 'items-center text-center'
                : 'md:flex-row items-start md:items-center justify-between'
            } ${
              themeSpec.heroLayout === 'centered_maison'
                ? 'p-6 sm:p-8 border rounded-2xl'
                : themeSpec.heroLayout === 'arch_crest'
                ? 'p-6 sm:p-10 border-2 rounded-t-[140px] rounded-b-3xl'
                : themeSpec.heroLayout === 'pop_kinetic'
                ? 'p-6 sm:p-8 border-2 rounded-3xl shadow-[5px_5px_0px_#18181B]'
                : themeSpec.heroLayout === 'gallery_magazine'
                ? 'border-r-4 pr-4 sm:pr-6'
                : ''
            }`}
            style={
              themeSpec.heroLayout === 'centered_maison' ||
              themeSpec.heroLayout === 'arch_crest' ||
              themeSpec.heroLayout === 'pop_kinetic'
                ? { borderColor: themeSpec.heroBorder, backgroundColor: themeSpec.surfaceBg }
                : themeSpec.heroLayout === 'gallery_magazine'
                ? { borderColor: themeSpec.accentBg }
                : undefined
            }
          >
            <div className={`space-y-3 ${isCenteredHero ? 'max-w-3xl flex flex-col items-center' : 'text-right max-w-2xl'}`}>
              {themeSpec.heroLayout === 'arch_crest' && (
                <div
                  style={{ borderColor: themeSpec.accentBg, backgroundColor: themeSpec.softBg }}
                  className="w-16 h-16 rounded-full border-2 p-1 overflow-hidden shadow-sm"
                >
                  <img
                    src={storeLogoUrl}
                    alt={brandName}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-store-icon.png';
                    }}
                  />
                </div>
              )}

              {effectiveConfig.showArtistSubtitle && (
                <p
                  style={{ color: themeSpec.accentText }}
                  className="text-xs font-black tracking-wide"
                >
                  {locale === 'ar' ? `بأنامل الفنان: ${artistName}` : artistName} · {workshop?.country || 'مصر'}
                  {effectiveConfig.showCraftBadge && displayCraftBadge ? ` · ${displayCraftBadge}` : ''}
                </p>
              )}

              {effectiveConfig.showBrandTitle && (
                <h2
                  style={{ color: themeSpec.inkColor }}
                  className={`${
                    themeSpec.heroLayout === 'swiss_minimal' ||
                    themeSpec.heroLayout === 'centered_maison' ||
                    themeSpec.heroLayout === 'arch_crest'
                      ? 'text-3xl sm:text-4xl'
                      : 'text-2xl sm:text-3xl'
                  } ${themeSpec.titleWeightClass} leading-tight text-balance`}
                >
                  {brandName}
                </h2>
              )}

              {(themeSpec.heroLayout === 'centered_maison' || themeSpec.heroLayout === 'arch_crest') && (
                <div className="w-16 h-0.5 rounded-full" style={{ backgroundColor: themeSpec.accentBg }} />
              )}

              {effectiveConfig.showWelcomeMessage && displayWelcomeMessage && (
                <p
                  style={{ color: themeSpec.inkColor }}
                  className="text-xs sm:text-sm font-bold opacity-90 leading-relaxed"
                >
                  {displayWelcomeMessage}
                </p>
              )}

              {effectiveConfig.showArtistStory && resolvedArtistStory && (
                <p
                  style={{ color: themeSpec.mutedColor }}
                  className="text-xs sm:text-sm leading-relaxed"
                >
                  {resolvedArtistStory}
                </p>
              )}

              {(effectiveConfig.showWorkingHours ||
                effectiveConfig.showProductionTurnaround ||
                effectiveConfig.showCustomOrderBadge) && (
                <div
                  style={{ color: themeSpec.mutedColor }}
                  className={`flex flex-wrap items-center gap-3 pt-0.5 text-[11px] font-bold ${
                    isCenteredHero ? 'justify-center' : ''
                  }`}
                >
                  {effectiveConfig.showWorkingHours && effectiveConfig.workingHours && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                      <span>{effectiveConfig.workingHours}</span>
                    </span>
                  )}
                  {effectiveConfig.showProductionTurnaround && effectiveConfig.productionTurnaround && (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                      <span>{effectiveConfig.productionTurnaround}</span>
                    </span>
                  )}
                  {effectiveConfig.showCustomOrderBadge && effectiveConfig.customOrderBadgeText && (
                    <span className="inline-flex items-center gap-1" style={{ color: themeSpec.accentText }}>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{effectiveConfig.customOrderBadgeText}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Direct Contact with the Artisan */}
              {(effectiveConfig.showPhoneButtons || effectiveConfig.showDeliveryBadge) && (
                <div
                  className={`pt-1 flex flex-wrap items-center gap-3 text-xs ${
                    isCenteredHero ? 'justify-center' : ''
                  }`}
                >
                  {effectiveConfig.showPhoneButtons && (
                    <>
                      <a
                        href={`tel:${phone}`}
                        style={accentBtnStyle}
                        className={`inline-flex items-center gap-2 px-4 py-2 ${themeSpec.buttonRadiusClass} font-black transition hover:opacity-90 cursor-pointer whitespace-nowrap`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{phone}</span>
                      </a>

                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-2 px-4 py-2 ${themeSpec.buttonRadiusClass} bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer whitespace-nowrap`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>واتساب الفنان</span>
                      </a>
                    </>
                  )}

                  {effectiveConfig.showDeliveryBadge && (
                    <span
                      style={{ color: themeSpec.mutedColor }}
                      className="inline-flex items-center gap-1.5 font-medium"
                    >
                      <Truck className="w-4 h-4" style={{ color: themeSpec.accentText }} />
                      <span>توصيل لجميع المحافظات</span>
                    </span>
                  )}
                </div>
              )}

              {workshop?.id && (
                <div className={`pt-1 flex flex-wrap items-center gap-2 ${isCenteredHero ? 'justify-center' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    style={softBtnStyle}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 ${themeSpec.buttonRadiusClass} border text-xs font-black transition hover:opacity-90 cursor-pointer`}
                  >
                    <User className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
                    <span>الصفحة الشخصية ومعرض الأعمال</span>
                  </button>
                </div>
              )}
            </div>

            {/* Clean Rating & Catalog Summary */}
            <div
              style={{
                backgroundColor: themeSpec.softBg,
                borderColor: themeSpec.borderColor,
                color: themeSpec.inkColor,
              }}
              className={`flex items-center gap-6 px-5 py-3.5 ${
                themeSpec.heroLayout === 'arch_crest' ? 'rounded-full' : themeSpec.cardRadiusClass
              } border shrink-0`}
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#F59E0B] mb-0.5">
                  {Array.from({ length: Math.min(5, Math.max(1, Number(workshop?.ratingStars) || 5)) }).map(
                    (_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                    )
                  )}
                </div>
                <p style={{ color: themeSpec.mutedColor }} className="text-[11px] font-bold">
                  تقييم المتجر
                </p>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: themeSpec.borderColor }} />
              <div className="text-center">
                <p style={{ color: themeSpec.inkColor }} className="text-lg font-black tabular-nums">
                  {storeData?.products?.length || 0}
                </p>
                <p style={{ color: themeSpec.mutedColor }} className="text-[11px] font-bold">
                  منتج متاح
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Main Storefront Catalog */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-6">
        {workshop?.suspended && (
          <div className="p-8 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#EA580C]/40 text-center space-y-3">
            <ShieldCheck className="w-9 h-9 mx-auto text-[#C2410C] dark:text-[#FBBF24]" />
            <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              هذا المتجر متوقف مؤقتاً للمراجعة
            </h3>
            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] max-w-md mx-auto">
              يمكنك استعراض كافة المنتجات المعتمدة عبر السوق الرئيسي.
            </p>
            <a
              href="/#/market"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs transition"
            >
              <span>تصفح سوق الشمساوية</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Owner Store Layout & Drag-and-Drop Customization Bar */}
        {isOwnerPreview && (
          <div className="p-3 sm:p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C]/50 dark:border-[#F59E0B]/40 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24] shrink-0" />
                  <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    معاينة المتجر كما يراه العميل + تنسيق العرض والترتيب
                  </h3>
                </div>
                <p className="text-[11px] font-medium text-[#475569] dark:text-[#CBD5E1]">
                  اسحب أي منتج وأفلته لتغيير ترتيبه (أو استخدم الأسهم)، واختر شكل عرض المنتجات للزوار:
                </p>
              </div>

              <div className="relative shrink-0" ref={layoutMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsLayoutMenuOpen((prev) => !prev)}
                  disabled={savingLayout}
                  aria-expanded={isLayoutMenuOpen}
                  aria-haspopup="listbox"
                  className="w-full md:w-auto px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center justify-between md:justify-center gap-2 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap"
                >
                  <span className="flex items-center gap-1.5">
                    {layoutCols === 1 ? (
                      <LayoutList className="w-4 h-4 shrink-0" />
                    ) : layoutCols === 2 ? (
                      <Columns2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <Grid3x3 className="w-4 h-4 shrink-0" />
                    )}
                    <span>عرض منتجات متجري</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isLayoutMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isLayoutMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="اختيار نظام عرض منتجات متجري"
                    className="absolute left-0 right-0 md:right-auto md:left-0 md:w-56 mt-1.5 z-50 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xl p-1.5 space-y-1"
                  >
                    {[
                      { cols: 1 as const, label: 'منتج ورا منتج', Icon: LayoutList },
                      { cols: 2 as const, label: 'مصفوفة ثنائية (×2)', Icon: Columns2 },
                      { cols: 3 as const, label: 'مصفوفة ثلاثية (×3)', Icon: Grid3x3 },
                    ].map(({ cols, label, Icon }) => {
                      const active = layoutCols === cols;
                      return (
                        <button
                          key={cols}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setIsLayoutMenuOpen(false);
                            handleChangeLayoutCols(cols);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer ${
                            active
                              ? 'bg-[#EA580C]/15 text-[#C2410C] dark:text-[#FBBF24]'
                              : 'text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#E9E2D4] dark:hover:bg-[#1A2B54]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{label}</span>
                          </span>
                          {active && (
                            <Check className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search, Categories & Sort Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative w-full sm:w-72 shrink-0">
              <Search
                className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2"
                style={{ color: themeSpec.mutedColor }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_products')}
                style={{
                  backgroundColor: themeSpec.surfaceBg,
                  borderColor: themeSpec.borderColor,
                  color: themeSpec.inkColor,
                }}
                className={`w-full h-10 pr-10 pl-4 ${themeSpec.inputRadiusClass} border text-xs sm:text-sm font-medium outline-none`}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((c) => {
                const isSelected = selectedCategory === c.id;
                if (themeSpec.categoryLayout === 'circular_medallions') {
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.id)}
                      className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group px-1"
                    >
                      <span
                        style={
                          isSelected
                            ? { backgroundColor: themeSpec.accentBg, color: themeSpec.accentInk, borderColor: themeSpec.accentBg }
                            : { backgroundColor: themeSpec.surfaceBg, color: themeSpec.inkColor, borderColor: themeSpec.borderColor }
                        }
                        className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-xs group-hover:scale-105 transition"
                      >
                        {c.name.slice(0, 2)}
                      </span>
                      <span
                        style={{ color: isSelected ? themeSpec.accentText : themeSpec.mutedColor }}
                        className="text-[10px] font-black whitespace-nowrap max-w-[74px] truncate"
                      >
                        {c.name}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    style={
                      isSelected
                        ? {
                            backgroundColor: themeSpec.accentBg,
                            color: themeSpec.accentInk,
                            borderColor: themeSpec.categoryLayout === 'brutalist_tabs' ? '#18181B' : themeSpec.accentBg,
                          }
                        : {
                            backgroundColor: themeSpec.surfaceBg,
                            color: themeSpec.inkColor,
                            borderColor: themeSpec.borderColor,
                          }
                    }
                    className={`px-3.5 py-2 ${themeSpec.buttonRadiusClass} text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      themeSpec.categoryLayout === 'brutalist_tabs'
                        ? 'border-2 shadow-[2px_2px_0px_#18181B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none'
                        : 'border hover:opacity-90'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto flex-wrap">
            {/* Customer Display Currency Switcher */}
            <div className="relative flex items-center">
              <Coins
                className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none"
                style={{ color: themeSpec.accentText }}
              />
              <select
                value={customerCurrency}
                onChange={(e) => setCustomerCurrency(saveStoredCustomerDisplayCurrency(e.target.value))}
                aria-label="العملة المعروضة للعميل"
                style={{
                  backgroundColor: themeSpec.surfaceBg,
                  borderColor: themeSpec.borderColor,
                  color: themeSpec.inkColor,
                }}
                className={`h-10 pr-8 pl-2.5 ${themeSpec.inputRadiusClass} border text-xs font-bold outline-none cursor-pointer`}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.symbol} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex items-center">
              <ArrowUpDown
                className="w-3.5 h-3.5 absolute right-3 pointer-events-none"
                style={{ color: themeSpec.mutedColor }}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="ترتيب المنتجات"
                style={{
                  backgroundColor: themeSpec.surfaceBg,
                  borderColor: themeSpec.borderColor,
                  color: themeSpec.inkColor,
                }}
                className={`h-10 pr-8 pl-3 ${themeSpec.inputRadiusClass} border text-xs font-bold outline-none cursor-pointer`}
              >
                <option value="featured">ترتيب الورشة المختار</option>
                <option value="price_asc">السعر: الأقل للأعلى</option>
                <option value="price_desc">السعر: الأعلى للأقل</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div
            className={`grid ${
              layoutCols === 1
                ? 'grid-cols-1 max-w-2xl mx-auto gap-5'
                : layoutCols === 2
                ? 'grid-cols-2 gap-3 sm:gap-5'
                : 'grid-cols-3 gap-2 sm:gap-5'
            }`}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden animate-pulse"
              >
                <div className="w-full aspect-[4/3] bg-[#E9E2D4] dark:bg-[#132040]" />
                <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="h-3 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-1/2" />
                  <div className="h-4 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-4/5" />
                  <div className="h-5 bg-[#E9E2D4] dark:bg-[#1A2B54] rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bundle Deal Incentive Strip */}
        {artisanConfig.bundleDeal?.enabled && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-l from-emerald-600/15 via-[#F7F3EA] to-amber-500/15 dark:from-emerald-950/50 dark:via-[#0D162E] dark:to-amber-950/30 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-black text-emerald-800 dark:text-emerald-300">
              <Gift className="w-4 h-4 shrink-0 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>
                {artisanConfig.bundleDeal.label ||
                  `عرض الباقة: اشترِ ${artisanConfig.bundleDeal.minQuantity} قطع أو أكثر واحصل على خصم ${
                    artisanConfig.bundleDeal.discountType === 'percent'
                      ? `${artisanConfig.bundleDeal.discountValue}%`
                      : `${artisanConfig.bundleDeal.discountValue} ج.م`
                  } تلقائياً بالسلة`}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono text-[11px] font-black shrink-0">
              {artisanConfig.bundleDeal.minQuantity}+ قطع = خصم{' '}
              {artisanConfig.bundleDeal.discountType === 'percent'
                ? `${artisanConfig.bundleDeal.discountValue}%`
                : `${artisanConfig.bundleDeal.discountValue} ج.م`}
            </span>
          </div>
        )}

        {/* Error Notice */}
        {errorNotice && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-bold text-center">
            {errorNotice}
          </div>
        )}

        {/* Storefront Discovery Spotlights: Special Offers & Best Sellers */}
        {!loading && selectedCategory === 'all' && !searchQuery.trim() && (specialOfferProducts.length > 0 || bestSellerProducts.length > 0) && (
          <div className="space-y-4">
            {specialOfferProducts.length > 0 && (
              <section
                style={{ backgroundColor: themeSpec.surfaceBg, borderColor: themeSpec.borderColor }}
                className={`${themeSpec.cardRadiusClass} border p-3.5 sm:p-4 space-y-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5" style={{ color: themeSpec.inkColor }}>
                    <Flame className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>العروض الخاصة والتخفيضات</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-300">
                      {specialOfferProducts.length}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('__offers__')}
                    style={{ color: themeSpec.accentText }}
                    className="text-[11px] font-black hover:underline cursor-pointer"
                  >
                    عرض الكل ←
                  </button>
                </div>
                <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {specialOfferProducts.slice(0, 8).map((p) => {
                    const pr = resolveProductOfferPricing(p, p.size_variants?.[0]?.label, customerCurrency, true);
                    return (
                      <button
                        key={`offer-${p.id}`}
                        type="button"
                        onClick={() => handleOpenProduct(p)}
                        style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                        className="w-36 sm:w-44 shrink-0 rounded-xl border overflow-hidden text-right hover:-translate-y-0.5 transition cursor-pointer flex flex-col"
                      >
                        <div className="relative h-24 sm:h-28 w-full overflow-hidden">
                          {pr.badgeText && (
                            <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black shadow-xs">
                              {pr.badgeText}
                            </span>
                          )}
                          <img
                            src={p.image_url || '/alshams_falcon_emblem.png'}
                            alt={p.product_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2 space-y-1">
                          <p className="text-[11px] font-black truncate" style={{ color: themeSpec.inkColor }}>
                            {p.product_name}
                          </p>
                          <div className="flex items-baseline gap-1 font-mono tabular-nums">
                            <span className="text-xs font-black" style={{ color: themeSpec.priceColor }}>
                              {pr.finalPrice.toLocaleString('ar-EG')} {pr.displaySymbol}
                            </span>
                            {pr.hasDiscount && (
                              <span className="text-[10px] line-through opacity-65" style={{ color: themeSpec.mutedColor }}>
                                {pr.originalPrice.toLocaleString('ar-EG')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {bestSellerProducts.length > 0 && (
              <section
                style={{ backgroundColor: themeSpec.surfaceBg, borderColor: themeSpec.borderColor }}
                className={`${themeSpec.cardRadiusClass} border p-3.5 sm:p-4 space-y-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs sm:text-sm font-black flex items-center gap-1.5" style={{ color: themeSpec.inkColor }}>
                    <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                    <span>الأكثر طلباً ومبيعاً</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      {bestSellerProducts.length}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('__bestsellers__')}
                    style={{ color: themeSpec.accentText }}
                    className="text-[11px] font-black hover:underline cursor-pointer"
                  >
                    عرض الكل ←
                  </button>
                </div>
                <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {bestSellerProducts.slice(0, 8).map((p) => {
                    const pr = resolveProductOfferPricing(p, p.size_variants?.[0]?.label, customerCurrency, true);
                    return (
                      <button
                        key={`best-${p.id}`}
                        type="button"
                        onClick={() => handleOpenProduct(p)}
                        style={{ backgroundColor: themeSpec.softBg, borderColor: themeSpec.borderColor }}
                        className="w-36 sm:w-44 shrink-0 rounded-xl border overflow-hidden text-right hover:-translate-y-0.5 transition cursor-pointer flex flex-col"
                      >
                        <div className="relative h-24 sm:h-28 w-full overflow-hidden">
                          <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[9px] font-black shadow-xs">
                            ⭐ الأكثر طلباً
                          </span>
                          <img
                            src={p.image_url || '/alshams_falcon_emblem.png'}
                            alt={p.product_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2 space-y-1">
                          <p className="text-[11px] font-black truncate" style={{ color: themeSpec.inkColor }}>
                            {p.product_name}
                          </p>
                          <div className="flex items-baseline gap-1 font-mono tabular-nums">
                            <span className="text-xs font-black" style={{ color: themeSpec.priceColor }}>
                              {pr.finalPrice.toLocaleString('ar-EG')} {pr.displaySymbol}
                            </span>
                            {pr.hasDiscount && (
                              <span className="text-[10px] line-through opacity-65" style={{ color: themeSpec.mutedColor }}>
                                {pr.originalPrice.toLocaleString('ar-EG')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Clean Products Grid — Dynamically Adapts Architecture to Selected Theme */}
        {!loading && filteredProducts.length > 0 && (
          <div
            className={`grid ${
              themeSpec.cardLayout === 'horizontal_split'
                ? 'grid-cols-1 md:grid-cols-2 gap-4'
                : layoutCols === 1
                ? 'grid-cols-1 max-w-2xl mx-auto gap-4 sm:gap-5'
                : layoutCols === 2
                ? 'grid-cols-2 gap-2.5 sm:gap-5'
                : 'grid-cols-3 gap-1.5 sm:gap-4 lg:gap-5'
            }`}
          >
            {filteredProducts.map((p, idx) => {
              const pricing = resolveProductOfferPricing(
                p,
                p.size_variants?.[0]?.label,
                customerCurrency,
                true
              );
              const hasColors = p.available_colors && p.available_colors.length > 0;
              const isDragging = draggedProductId === p.id;
              const isDragOver = dragOverProductId === p.id && draggedProductId !== p.id;
              const isCompact3Col = layoutCols === 3 && themeSpec.cardLayout !== 'horizontal_split';
              const isBentoHeroCard = themeSpec.cardLayout === 'bento_featured' && idx === 0 && layoutCols >= 2;
              const isHorizontalCard = themeSpec.cardLayout === 'horizontal_split' || isBentoHeroCard;
              const isArchCard = themeSpec.cardLayout === 'arch_dome';
              const isPolaroidCard = themeSpec.cardLayout === 'polaroid_pop';

              return (
                <article
                  key={p.id}
                  draggable={isOwnerPreview}
                  onDragStart={(e) => {
                    if (!isOwnerPreview) return;
                    setDraggedProductId(p.id);
                    e.dataTransfer.effectAllowed = 'move';
                    try {
                      e.dataTransfer.setData('text/plain', p.id);
                    } catch {}
                  }}
                  onDragOver={(e) => {
                    if (!isOwnerPreview) return;
                    e.preventDefault();
                    if (dragOverProductId !== p.id) setDragOverProductId(p.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverProductId === p.id) setDragOverProductId(null);
                  }}
                  onDrop={(e) => {
                    if (!isOwnerPreview) return;
                    e.preventDefault();
                    const srcId = draggedProductId || e.dataTransfer.getData('text/plain');
                    setDraggedProductId(null);
                    setDragOverProductId(null);
                    if (srcId && srcId !== p.id) {
                      handleReorderStoreProducts(srcId, p.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedProductId(null);
                    setDragOverProductId(null);
                  }}
                  onClick={() => handleOpenProduct(p)}
                  style={{
                    backgroundColor: themeSpec.surfaceBg,
                    borderColor: isDragOver || isDragging ? themeSpec.accentBg : themeSpec.borderColor,
                    color: themeSpec.inkColor,
                  }}
                  className={`group ${themeSpec.cardRadiusClass} ${themeSpec.cardShadowClass} ${
                    isPolaroidCard ? 'border-2 p-2 sm:p-2.5' : 'border'
                  } transition-all duration-200 flex ${
                    isHorizontalCard ? 'flex-row items-stretch' : 'flex-col justify-between'
                  } ${isBentoHeroCard ? 'col-span-2' : ''} overflow-hidden cursor-pointer ${
                    isDragOver
                      ? 'ring-2 scale-[1.02] shadow-lg'
                      : isDragging
                      ? 'opacity-50 border-dashed'
                      : isPolaroidCard
                      ? 'hover:translate-x-[2px] hover:translate-y-[2px]'
                      : 'hover:-translate-y-0.5'
                  }`}
                >
                  {/* Image Container */}
                  <div className={isHorizontalCard ? 'w-32 sm:w-48 shrink-0 flex flex-col' : 'w-full'}>
                    {/* Owner Drag & Reorder Control Strip */}
                    {isOwnerPreview && !isHorizontalCard && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          backgroundColor: themeSpec.softBg,
                          borderColor: themeSpec.borderColor,
                          color: themeSpec.inkColor,
                        }}
                        className="px-1.5 sm:px-3 py-1 border-b flex items-center justify-between gap-1 text-[10px] font-black cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <GripVertical className="w-3 h-3 shrink-0" style={{ color: themeSpec.accentText }} />
                          <span className="truncate">#{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStepMoveProduct(p.id, -1)}
                            disabled={idx === 0}
                            title="تقديم للأول"
                            className="p-0.5 rounded hover:opacity-75 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepMoveProduct(p.id, 1)}
                            disabled={idx === filteredProducts.length - 1}
                            title="تأخير"
                            className="p-0.5 rounded hover:opacity-75 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        backgroundColor: themeSpec.softBg,
                        borderColor: themeSpec.borderColor,
                      }}
                      className={`relative w-full ${
                        isHorizontalCard
                          ? 'h-full min-h-[135px]'
                          : isCompact3Col
                          ? 'aspect-square sm:' + themeSpec.imageFrameClass
                          : themeSpec.imageFrameClass
                      } overflow-hidden ${
                        isArchCard
                          ? 'rounded-t-[999px] rounded-b-xl mx-auto mt-2 w-[calc(100%-16px)] border'
                          : isPolaroidCard
                          ? 'rounded-xl border-2'
                          : isHorizontalCard
                          ? 'border-l'
                          : 'border-b'
                      }`}
                    >
                      {pricing.badgeText && (
                        <span
                          style={{ backgroundColor: themeSpec.badgeBg, color: themeSpec.badgeInk }}
                          className={`absolute top-2 right-2 z-10 px-2 py-0.5 ${
                            isPolaroidCard
                              ? 'rounded-full border border-[#18181B] -rotate-2'
                              : themeSpec.buttonRadiusClass === 'rounded-none'
                              ? 'rounded-none'
                              : 'rounded-md'
                          } text-[10px] font-black shadow-xs pointer-events-none`}
                        >
                          {pricing.badgeText}
                        </span>
                      )}
                      {pricing.isBestSeller && (
                        <span className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-amber-400/95 text-slate-950 text-[9px] font-black shadow-xs pointer-events-none flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-slate-950" />
                          الأكثر طلباً
                        </span>
                      )}
                      {isBentoHeroCard && !pricing.badgeText && (
                        <span
                          style={{ backgroundColor: themeSpec.accentBg, color: themeSpec.accentInk }}
                          className="absolute top-2 right-2 z-10 px-2.5 py-0.5 rounded-full text-[10px] font-black"
                        >
                          الأبرز في المتجر
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleWishlistProduct(p, pricing.egpFinalPrice, pricing.isFreeShipping);
                        }}
                        aria-label={wishlistIds.has(p.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                        title={wishlistIds.has(p.id) ? 'إزالة من المفضلة' : 'أضف للمفضلة'}
                        style={{
                          backgroundColor: themeSpec.surfaceBg,
                          borderColor: themeSpec.borderColor,
                        }}
                        className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full border flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 transition ${
                            wishlistIds.has(p.id) ? 'fill-rose-500 text-rose-500' : ''
                          }`}
                          style={!wishlistIds.has(p.id) ? { color: themeSpec.mutedColor } : undefined}
                        />
                      </button>
                      {(p.video_url || p.videoUrl) && (
                        <div className="absolute bottom-2 right-2 z-10">
                          <ProductVideoThumbnail
                            videoUrl={p.video_url || p.videoUrl}
                            fallbackImage={p.image_url}
                            title={p.product_name}
                            compact
                          />
                        </div>
                      )}
                      <img
                        src={p.image_url || '/alshams_falcon_emblem.png'}
                        alt={p.product_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/alshams_falcon_emblem.png';
                        }}
                      />
                    </div>
                  </div>

                  {/* Body + Price + CTA Container */}
                  <div className={`flex-1 flex flex-col justify-between min-w-0 ${isArchCard ? 'text-center' : ''}`}>
                    <div
                      className={`${
                        isCompact3Col
                          ? 'p-1.5 sm:p-3.5 space-y-1 sm:space-y-1.5'
                          : layoutCols === 2 && !isHorizontalCard
                          ? 'p-2.5 sm:p-4 space-y-1.5 sm:space-y-2'
                          : 'p-3.5 sm:p-4 space-y-1.5'
                      }`}
                    >
                      <p
                        style={{ color: themeSpec.mutedColor }}
                        className={`${
                          isCompact3Col ? 'text-[9px] sm:text-xs' : 'text-[10px] sm:text-xs'
                        } font-medium truncate`}
                      >
                        {p.craft_name || p.category} · {p.current_stock > 0 ? 'متوفر' : 'تنفيذ بالطلب'}
                      </p>

                      <h3
                        style={{ color: themeSpec.inkColor }}
                        className={`${themeSpec.titleWeightClass} ${
                          isCompact3Col
                            ? 'text-[11px] sm:text-sm md:text-base'
                            : layoutCols === 2 && !isHorizontalCard
                            ? 'text-xs sm:text-base'
                            : 'text-sm sm:text-lg'
                        } line-clamp-2 leading-snug transition-colors`}
                      >
                        {pickProductField(p, 'name')}
                      </h3>

                      {p.store_description && (
                        <p
                          style={{ color: themeSpec.mutedColor }}
                          className={`${
                            isCompact3Col ? 'hidden sm:block text-xs' : 'text-[11px] sm:text-xs'
                          } line-clamp-1`}
                        >
                          {pickProductField(p, 'description')}
                        </p>
                      )}

                      {hasColors && (
                        <p
                          style={{ color: themeSpec.mutedColor }}
                          className={`${
                            isCompact3Col ? 'hidden sm:block text-[11px]' : 'text-[10px] sm:text-[11px]'
                          } truncate`}
                        >
                          الألوان: {p.available_colors!.slice(0, 3).join('، ')}
                        </p>
                      )}
                    </div>

                    {/* Price & CTA Baseline */}
                    <div
                      className={`${
                        isCompact3Col
                          ? 'px-1.5 pb-2 pt-0.5 space-y-1.5 sm:px-3.5 sm:pb-3.5 sm:space-y-2.5'
                          : layoutCols === 2 && !isHorizontalCard
                          ? 'px-2.5 pb-2.5 pt-1 space-y-2 sm:px-4 sm:pb-4 sm:space-y-3'
                          : 'px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-1 space-y-2.5'
                      }`}
                    >
                      <div
                        className={`flex items-baseline gap-1.5 font-mono tabular-nums flex-wrap ${
                          isArchCard ? 'justify-center' : ''
                        }`}
                      >
                        <span
                          style={{ color: themeSpec.priceColor }}
                          className={`${
                            isCompact3Col
                              ? 'text-xs sm:text-lg'
                              : layoutCols === 2 && !isHorizontalCard
                              ? 'text-sm sm:text-lg'
                              : 'text-base sm:text-xl'
                          } font-black`}
                        >
                          {pricing.finalPrice.toLocaleString('ar-EG')}
                        </span>
                        <span
                          style={{ color: themeSpec.mutedColor }}
                          className={`${
                            isCompact3Col ? 'text-[9px] sm:text-xs' : 'text-[10px] sm:text-xs'
                          } font-bold`}
                        >
                          {pricing.displaySymbol}
                        </span>
                        {pricing.hasDiscount && (
                          <span
                            style={{ color: themeSpec.mutedColor }}
                            className="text-[10px] sm:text-xs line-through opacity-75"
                          >
                            {pricing.originalPrice.toLocaleString('ar-EG')}
                          </span>
                        )}
                      </div>

                      {(pricing.bogoLabel || pricing.couponRequiredCode) && (
                        <div className={`flex flex-wrap items-center gap-1 ${isArchCard ? 'justify-center' : ''}`}>
                          {pricing.bogoLabel && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black">
                              🎁 {pricing.bogoLabel}
                            </span>
                          )}
                          {pricing.couponRequiredCode && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black font-mono">
                              <Tag className="w-2.5 h-2.5" />
                              بكود: {pricing.couponRequiredCode}
                            </span>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(p, 1);
                        }}
                        style={accentBtnStyle}
                        className={`w-full ${
                          isCompact3Col
                            ? 'py-1.5 px-1.5 text-[10px] sm:py-2 sm:px-3 sm:text-xs'
                            : 'py-2 px-3 text-[11px] sm:py-2.5 sm:px-4 sm:text-xs'
                        } ${themeSpec.buttonRadiusClass} ${
                          isPolaroidCard ? 'border-2 border-[#18181B]' : ''
                        } font-black flex items-center justify-center gap-1 sm:gap-2 transition hover:opacity-90 active:scale-95 cursor-pointer`}
                      >
                        <ShoppingBag className={`${isCompact3Col ? 'w-3 h-3 sm:w-4 sm:h-4' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'} shrink-0`} />
                        <span className="truncate">أضف للسلة</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-14 px-4 bg-[#F7F3EA] dark:bg-[#0D162E] rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <ShoppingBag className="w-10 h-10 mx-auto text-[#C2410C] dark:text-[#FBBF24] opacity-70" />
            <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              لا توجد منتجات مطابقة للبحث
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1]">
              جرّب تغيير كلمات البحث أو استعراض تصنيف آخر.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs transition cursor-pointer"
            >
              عرض كافة المعروضات
            </button>
          </div>
        )}

        {/* Optional Before / After Portfolio Gallery + Synced Member Showcase (Max 6) */}
        {((artisanConfig.showPortfolioGallery && artisanConfig.portfolioItems.length > 0) ||
          profileShowcasePosts.length > 0) && (
          <section className="pt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2.5">
              <h3 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                {pickConfigField(artisanConfig.portfolioTitle || t('portfolio_gallery'), 'portfolioTitle')}
              </h3>
              {workshop?.id && (
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>زيارة الصفحة الشخصية للفنان</span>
                </button>
              )}
            </div>

            {artisanConfig.showPortfolioGallery && artisanConfig.portfolioItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {artisanConfig.portfolioItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden shadow-xs"
                  >
                    <div className={`grid ${item.beforeImageUrl ? 'grid-cols-2' : 'grid-cols-1'} aspect-[16/10] bg-[#E9E2D4] dark:bg-[#132040]`}>
                      {item.beforeImageUrl && (
                        <div className="relative h-full border-l border-[#D4CCBC] dark:border-[#22355E]">
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-bold">
                            قبل
                          </span>
                          <img
                            src={item.beforeImageUrl}
                            alt={`${item.title} قبل`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="relative h-full">
                        {item.beforeImageUrl && (
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[#EA580C] text-white text-[10px] font-bold">
                            بعد
                          </span>
                        )}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <h4 className="font-bold text-xs sm:text-sm text-[#0C1427] dark:text-[#F7F3EA]">
                        {item.title}
                      </h4>
                      {item.caption && (
                        <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] line-clamp-2">
                          {item.caption}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {profileShowcasePosts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {profileShowcasePosts.slice(0, 6).map((post: any) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="group text-right rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden hover:border-[#EA580C] transition cursor-pointer flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full bg-[#E9E2D4] dark:bg-[#132040] overflow-hidden">
                      <img
                        src={post.imageUrl}
                        alt={post.caption || 'من أعمال الورشة'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                    {(post.caption || post.createdAt) && (
                      <div className="p-2.5 sm:p-3 space-y-1">
                        {post.caption && (
                          <p className="text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] line-clamp-2">
                            {post.caption}
                          </p>
                        )}
                        {post.createdAt && (
                          <p className="text-[10px] font-mono tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                            {new Date(post.createdAt).toLocaleDateString('ar-EG')}
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Mobile Floating Cart Action (Zero 33% text) */}
      {cartItemsCount > 0 && (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-4 left-4 z-40 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>عرض السلة ({cartItemsCount})</span>
        </button>
      )}

      {/* Product Details Modal (Gallery + Dynamic Size Pricing + Discount + Custom Order) */}
      {selectedProduct && selectedModalPricing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm"
          dir={dir}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className={`bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl relative ${isRtl ? 'text-right' : 'text-left'} text-[#0C1427] dark:text-[#F7F3EA]`}>
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] flex items-center justify-center transition cursor-pointer z-10`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start pt-1">
              <ProductMediaCarousel
                images={selectedModalGallery}
                videoUrl={selectedProduct.video_url || selectedProduct.videoUrl}
                title={pickProductField(selectedProduct, 'name')}
                topRightOverlay={
                  selectedModalPricing.badgeText ? (
                    <span className="px-2.5 py-1 rounded-md bg-[#0C1427]/90 text-[#FBBF24] text-[11px] font-black shadow-xs">
                      {selectedModalPricing.badgeText}
                    </span>
                  ) : undefined
                }
                topLeftOverlay={
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleWishlistProduct(
                        selectedProduct,
                        selectedModalPricing.egpFinalPrice,
                        selectedModalPricing.isFreeShipping
                      )
                    }
                    aria-label={wishlistIds.has(selectedProduct.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    className="w-9 h-9 rounded-full bg-[#F7F3EA]/90 dark:bg-[#0C1427]/85 border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        wishlistIds.has(selectedProduct.id)
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-[#334155] dark:text-[#CBD5E1]'
                      }`}
                    />
                  </button>
                }
              />

              <div className={`space-y-3 ${isRtl ? 'pl-8 sm:pl-0' : 'pr-8 sm:pr-0'}`}>
                <p className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                  {selectedProduct.craft_name || selectedProduct.category} ·{' '}
                  {selectedProduct.current_stock > 0
                    ? t('in_stock')
                    : isRtl
                    ? 'تنفيذ بالطلب'
                    : 'Made to order'}
                </p>

                <h3 className="text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                  {pickProductField(selectedProduct, 'name')}
                </h3>

                <div className="flex items-baseline gap-2 font-mono tabular-nums flex-wrap">
                  <span className="text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    {selectedModalPricing.finalPrice.toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                  </span>
                  <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                    {selectedModalPricing.displaySymbol}
                  </span>
                  {selectedModalPricing.hasDiscount && (
                    <span className="text-sm line-through text-[#64748B] dark:text-[#94A3B8]">
                      {selectedModalPricing.originalPrice.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {selectedModalPricing.displaySymbol}
                    </span>
                  )}
                </div>

                {selectedModalPricing.isFreeShipping && (
                  <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    <span>{t('free_shipping')}</span>
                  </p>
                )}

                {selectedProduct.is_custom_order_available && (
                  <p className="text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24] bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('custom_orders_available')}</span>
                  </p>
                )}

                <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                  {pickProductField(selectedProduct, 'description') ||
                    (isRtl ? 'مشغولة يدوية متقنة الصنع.' : 'Handcrafted artisan piece.')}
                </p>

                {/* Direct Shareable Product Landing Page (/product/:id) */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const url = buildProductLandingUrl(selectedProduct.id);
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      } catch {}
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-[#EA580C]" />}
                    <span>{copiedLink ? 'تم نسخ رابط المنتج' : 'نسخ رابط المنتج'}</span>
                  </button>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildProductLandingUrl(selectedProduct.id))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] dark:text-sky-300 border border-[#1877F2]/30 text-[11px] font-black inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>فيسبوك</span>
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${selectedProduct.product_name} — ${selectedModalPricing.finalPrice.toLocaleString('ar-EG')} ${selectedModalPricing.displaySymbol}\n${buildProductLandingUrl(selectedProduct.id)}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30 text-[11px] font-black inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>واتساب</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4 pt-4 border-t border-[#D4CCBC] dark:border-[#22355E]">
              {selectedProduct.available_colors && selectedProduct.available_colors.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold block">اللون</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.available_colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          selectedColor === c
                            ? 'bg-[#EA580C] text-white border-[#EA580C]'
                            : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {((selectedProduct.size_variants && selectedProduct.size_variants.length > 0) ||
                (selectedProduct.available_sizes && selectedProduct.available_sizes.length > 0)) && (
                <div className="space-y-2">
                  <label className="text-xs font-bold block">اختر مقاسك المفضل</label>
                  <div className="flex flex-wrap gap-2">
                    {(selectedProduct.size_variants && selectedProduct.size_variants.length > 0
                      ? selectedProduct.size_variants.map((v) => v.label)
                      : selectedProduct.available_sizes || []
                    ).map((s) => {
                      const varPrice = resolveProductOfferPricing(selectedProduct, s, customerCurrency, true);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSize(s)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                            selectedSize === s
                              ? 'bg-[#EA580C] text-white border-[#EA580C]'
                              : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                          }`}
                        >
                          <span>{s}</span>
                          {selectedProduct.size_variants && selectedProduct.size_variants.length > 0 && (
                            <span className="font-mono tabular-nums opacity-90 text-[11px]">
                              ({varPrice.finalPrice.toLocaleString('ar-EG')} {varPrice.displaySymbol})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold">الكمية</span>
                <div className="flex items-center gap-3 bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] px-3 py-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg bg-[#F7F3EA] dark:bg-[#1A2B54] flex items-center justify-center font-bold cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black font-mono tabular-nums w-6 text-center">
                    {selectedQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedQuantity((q) => q + 1)}
                    className="w-7 h-7 rounded-lg bg-[#F7F3EA] dark:bg-[#1A2B54] flex items-center justify-center font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] block">
                  ملاحظات على الطلب (اختياري)
                </label>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="تخصيص لون أو مقاس أو تغليف..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-medium outline-none focus:border-[#EA580C] resize-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
              <button
                type="button"
                onClick={() => handleAddToCart(selectedProduct)}
                style={accentBtnStyle}
                className={`w-full py-3 px-4 ${themeSpec.buttonRadiusClass} font-black text-sm transition hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer active:scale-95`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  أضف إلى السلة ·{' '}
                  {(selectedModalPricing.finalPrice * selectedQuantity).toLocaleString('ar-EG')}{' '}
                  {selectedModalPricing.displaySymbol}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal (Deposit terms appear here during checkout) */}
      {isCartOpen && (
        <MarketplaceCartModal
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          customerUser={customerUser}
          onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
          checkoutSource="direct_store"
          onOrderSuccess={() => {
            setIsCartOpen(false);
            setAddedToast('تم تسجيل طلبك بنجاح! سيتواصل معك فريق العمل لتأكيد الشحن.');
            setTimeout(() => setAddedToast(null), 5000);
          }}
        />
      )}

      {/* Customer Auth Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        onContinueAsGuest={() => setIsCustomerAuthOpen(false)}
        onSuccessLogin={(user) => {
          setCustomerUser(user);
          setIsCustomerAuthOpen(false);
          setAddedToast(`أهلاً بك يا ${user.name}`);
          setTimeout(() => setAddedToast(null), 3500);
        }}
      />

      {/* Direct Message to Admin Modal (Store & Catalog Complaints / Technical Support) */}
      {isAdminSupportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-xs animate-in fade-in duration-150"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdminSupportModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden text-right">
            <div className="px-5 py-4 bg-[#E9E2D4] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                    الدعم الفني — رسالة مباشرة للإدارة
                  </h3>
                  <p className="text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24] truncate">
                    الشكاوى والاستفسارات بخصوص المتجر أو الكتالوج
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminSupportModalOpen(false)}
                aria-label="إغلاق نافذة الدعم الفني"
                className="w-8 h-8 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center hover:border-[#EA580C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendAdminSupport} className="p-5 space-y-3.5">
              <div className="rounded-xl bg-[#EFE9DC] dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] px-3 py-2 text-xs text-[#334155] dark:text-[#CBD5E1]">
                تصل رسالتك مباشرة إلى <strong className="text-[#0C1427] dark:text-[#F7F3EA]">إدارة منظومة الشمساوية</strong> بخصوص متجر <strong className="text-[#C2410C] dark:text-[#FBBF24]">{storeData?.workshop?.brandName || slug}</strong> أو منتجات الكتالوج.
              </div>

              <div>
                <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                  نوع الرسالة *
                </label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
                >
                  <option value="شكوى بخصوص المتجر أو الكتالوج">شكوى بخصوص المتجر أو الكتالوج</option>
                  <option value="استفسار عن منتج في الكتالوج">استفسار عن منتج في الكتالوج</option>
                  <option value="متابعة طلب أو شحن">متابعة طلب أو شحن</option>
                  <option value="ملاحظة فنية أو اقتراح">ملاحظة فنية أو اقتراح</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                    الاسم *
                  </label>
                  <input
                    type="text"
                    required
                    value={supportName}
                    onChange={(e) => setSupportName(e.target.value)}
                    placeholder="اسمك الكريم"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                    رقم الهاتف / التواصل
                  </label>
                  <input
                    type="text"
                    value={supportContact}
                    onChange={(e) => setSupportContact(e.target.value)}
                    placeholder="010xxxxxxxx"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-right text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                  تفاصيل الشكوى أو الاستفسار *
                </label>
                <textarea
                  rows={4}
                  required
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="اكتب رسالتك لإدارة المنظومة بخصوص المتجر أو أي منتج في الكتالوج..."
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C] resize-none"
                />
              </div>

              {supportFeedbackStatus && (
                <div
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${
                    supportFeedbackStatus.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {supportFeedbackStatus.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdminSupportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={supportSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 text-white text-xs font-black cursor-pointer shadow-sm active:scale-95 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{supportSubmitting ? 'جاري الإرسال...' : 'إرسال للإدارة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wishlist Drawer Modal */}
      {isWishlistOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-xs"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWishlistOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden text-right flex flex-col max-h-[84vh]">
            <div className="px-5 py-3.5 bg-[#E9E2D4] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  قائمة المفضلة ({wishlistItems.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWishlistOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {wishlistItems.length === 0 ? (
                <div className="py-10 text-center space-y-2 text-xs text-[#475569] dark:text-[#94A3B8]">
                  <Heart className="w-8 h-8 mx-auto opacity-50 text-rose-500" />
                  <p className="font-bold">لم تقم بحفظ أي مشغولات في المفضلة بعد.</p>
                </div>
              ) : (
                wishlistItems.map((wi) => {
                  const displayPrice = convertBetweenCurrencies(wi.egpPrice, 'EGP', customerCurrency);
                  const displayCurr = getCurrencyInfo(customerCurrency);
                  return (
                    <div
                      key={wi.id}
                      className="p-2.5 rounded-xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={wi.imageUrl || '/alshams_falcon_emblem.png'}
                          alt={wi.productName}
                          className="w-12 h-12 rounded-lg object-cover bg-[#E9E2D4] shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                            {wi.productName}
                          </h4>
                          <p className="font-mono font-bold text-[#C2410C] dark:text-[#FBBF24]">
                            {displayPrice.toLocaleString('ar-EG')} {displayCurr.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            addToCart({
                              id: 'cart_' + Date.now(),
                              productId: wi.id,
                              productName: wi.productName,
                              price: wi.egpPrice,
                              quantity: 1,
                              imageUrl: wi.imageUrl || '',
                              craftName: wi.craftName,
                              workshopId: wi.workshopId || workshop?.id,
                              artistName: wi.artistName || artistName,
                              isFreeShipping: wi.isFreeShipping,
                            });
                            playAddToCartSound();
                            setAddedToast(`تم إضافة "${wi.productName}" إلى السلة`);
                            setTimeout(() => setAddedToast(null), 2600);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-[11px] cursor-pointer"
                        >
                          أضف للسلة
                        </button>
                        <button
                          type="button"
                          onClick={() => setWishlistItems(removeWishlistItem(wi.id))}
                          className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#0D162E] text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="إزالة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Animated Contact Bubble Dock ("تواصل معي") */}
      {(effectiveConfig.socialLinks?.displayMode || 'both') !== 'footer' && (
        <ContactBubbleDock
          social={effectiveConfig.socialLinks}
          fallbackPhone={phone}
          accentHex={themeSpec.accentBg}
        />
      )}

      {/* Minimal Unified Footer */}
      <footer
        style={{
          backgroundColor: themeSpec.surfaceBg,
          borderColor: themeSpec.borderColor,
          color: themeSpec.inkColor,
        }}
        className="mt-16 border-t py-5 px-4 sm:px-6 transition-colors duration-300"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* اليمين: سوق الشمساوية */}
          <a
            href="/#/market"
            onClick={(e) => {
              if (onNavigateToMarket) {
                e.preventDefault();
                onNavigateToMarket();
              }
            }}
            style={{ color: themeSpec.accentText }}
            className="inline-flex items-center gap-2 text-sm sm:text-base font-black hover:opacity-80 transition-opacity"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>سوق الشمساوية</span>
          </a>

          {/* الوسط: قنوات التواصل وروابط السوشيال المفعلة من لوحة الفنان */}
          {(effectiveConfig.socialLinks?.displayMode || 'both') !== 'floating_bubble' && (
            <ArtisanFooterContacts social={effectiveConfig.socialLinks} fallbackPhone={phone} />
          )}

          {/* الشمال من تحت: الدعم الفني بعلامة الرسالة لإرسال رسالة مباشرة للأدمن للشكاوى بخصوص المتجر أو الكتالوج */}
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => {
                setSupportName(customerUser?.name || '');
                setSupportContact(customerUser?.phone || '');
                setSupportFeedbackStatus(null);
                setIsAdminSupportModalOpen(true);
              }}
              title="الشكاوى والاستفسارات بخصوص المتجر أو الكتالوج — تواصل مباشر مع الإدارة"
              style={softBtnStyle}
              className={`inline-flex items-center gap-2 px-3.5 py-2 ${themeSpec.buttonRadiusClass} border font-bold text-xs transition hover:opacity-90 cursor-pointer active:scale-95 shrink-0 shadow-xs`}
            >
              <Mail className="w-3.5 h-3.5" style={{ color: themeSpec.accentText }} />
              <span>الدعم الفني</span>
            </button>
            <span style={{ color: themeSpec.mutedColor }} className="text-[10px] font-bold">
              للشكاوى والاستفسارات بخصوص المتجر أو الكتالوج
            </span>
          </div>
        </div>
      </footer>

      {isProfileModalOpen && workshop?.id && (
        <MemberPersonalProfileView
          mode="modal"
          targetMemberId={workshop.id}
          currentUserProfile={ownerProfile || null}
          onClose={() => setIsProfileModalOpen(false)}
          onOpenStore={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
};
