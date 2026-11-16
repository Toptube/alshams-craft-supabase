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
} from 'lucide-react';
import { MemberPersonalProfileView } from '../profile/MemberPersonalProfileView';
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
import { MARKET_THEME_PRESETS } from '../../types/marketplaceBuilder';
import {
  ArtisanStoreConfig,
  normalizeArtisanStoreConfig,
  getStoredArtisanStoreConfig,
  resolveProductOfferPricing,
  seedArtisanSocialDefaults,
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
  const [promoRemainingMs, setPromoRemainingMs] = useState<number>(0);
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
                const { data: marketData } = await supabase
                  .from('marketplace_products')
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

  const categories = useMemo(() => {
    if (!storeData?.products || storeData.products.length === 0) {
      return [{ id: 'all', name: 'كافة المعروضات' }];
    }
    const cats = new Set<string>();
    storeData.products.forEach((p) => {
      if (p.craft_name) cats.add(p.craft_name);
      else if (p.category) cats.add(p.category);
    });
    return [{ id: 'all', name: 'كافة المعروضات' }, ...Array.from(cats).map((c) => ({ id: c, name: c }))];
  }, [storeData]);

  const filteredProducts = useMemo(() => {
    if (!storeData?.products) return [];
    const list = storeData.products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.product_name || '').toLowerCase().includes(q) ||
        (p.store_description || '').toLowerCase().includes(q) ||
        (p.craft_name || '').toLowerCase().includes(q);

      const matchCat =
        selectedCategory === 'all' ||
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
  }, [storeData, searchQuery, selectedCategory, sortBy, productOrder]);

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

  useEffect(() => {
    const pb = artisanConfig.promoBanner;
    if (!pb?.enabled || pb.triggerType !== 'limited_time' || !pb.endsAt) {
      setPromoRemainingMs(0);
      return;
    }
    const targetMs = new Date(pb.endsAt).getTime();
    if (!Number.isFinite(targetMs)) {
      setPromoRemainingMs(0);
      return;
    }
    const tick = () => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setPromoRemainingMs(0);
        return false;
      }
      setPromoRemainingMs(diff);
      return true;
    };
    if (!tick()) return;
    const id = window.setInterval(() => {
      if (!tick()) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [artisanConfig.promoBanner]);

  const themeMeta = useMemo(
    () => MARKET_THEME_PRESETS[artisanConfig.themePreset || 'shams_sand'] || MARKET_THEME_PRESETS.shams_sand,
    [artisanConfig.themePreset]
  );
  const isCustomTheme = (artisanConfig.themePreset || 'shams_sand') !== 'shams_sand';

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
  const resolvedArtistStory = (artisanConfig.artistStory || '').trim() || memberProfile?.storyText || '';
  const profileShowcasePosts: any[] = Array.isArray(memberProfile?.showcasePosts)
    ? memberProfile.showcasePosts
    : [];
  const brandName = workshop?.brandName || 'ورشة الشمساوية';
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

  const pageStyle: React.CSSProperties | undefined = isCustomTheme
    ? {
        backgroundColor: isDarkTheme ? themeMeta.pageBgDark : themeMeta.pageBgLight,
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
      style={pageStyle}
      className="min-h-screen w-full max-w-full overflow-x-clip bg-[#F2ECE1] text-[#0C1427] dark:bg-[#060B18] dark:text-[#F7F3EA] font-sans selection:bg-[#EA580C] selection:text-white transition-colors duration-200"
      dir="rtl"
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
        className="sticky top-0 z-30 bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E]"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-8">
          {/* Zone 1: Workshop Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center overflow-hidden p-0.5 shrink-0">
              <img
                src={(workshop as any)?.logo_url || workshop?.logoUrl || '/default-store-icon.png'}
                alt={brandName}
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/default-store-icon.png';
                }}
              />
            </div>
            <h1 className="font-black text-base sm:text-lg text-[#0C1427] dark:text-[#F7F3EA] truncate">
              {brandName}
            </h1>
          </div>

          {/* Zone 2: Clean Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
            <a
              href="/#/market"
              onClick={(e) => {
                if (onNavigateToMarket) {
                  e.preventDefault();
                  onNavigateToMarket();
                }
              }}
              className="hover:text-[#C2410C] dark:hover:text-[#FBBF24] transition-colors whitespace-nowrap shrink-0"
            >
              سوق الشمساوية
            </a>
            {onNavigateToApp && Boolean(typeof window !== 'undefined' && localStorage.getItem('alshams_profile')) && (
              <button
                type="button"
                onClick={onNavigateToApp}
                className="hover:text-[#C2410C] dark:hover:text-[#FBBF24] transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
              >
                <span>لوحة ورشتي</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </nav>

          {/* Zone 3: Share & Cart Actions (plus Owner Preview Close or Home/Market button) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isOwnerPreview && onClosePreview ? (
              <button
                type="button"
                onClick={onClosePreview}
                className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-[#0C1427] hover:bg-[#132040] text-[#F7F3EA] dark:bg-[#F7F3EA] dark:hover:bg-[#E9E2D4] dark:text-[#0C1427] text-[11px] sm:text-xs font-black transition flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs active:scale-95"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>عودة لمتجري</span>
              </button>
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
                    className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-black transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title={hasLoggedSession ? 'الرجوع للرئيسية' : 'العودة لسوق الشمساوية'}
                  >
                    <Home className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                    <span className="hidden sm:inline">
                      {hasLoggedSession ? 'الرئيسية' : 'سوق الشمساوية'}
                    </span>
                  </button>
                );
              })()
            )}

            <button
              type="button"
              onClick={handleShareStore}
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="مشاركة رابط المتجر"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Share2 className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />}
              <span className="hidden sm:inline">{copiedLink ? 'تم النسخ' : 'مشاركة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="relative px-2.5 sm:px-3 py-2 rounded-xl bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="قائمة المفضلة"
            >
              <Heart className={`w-4 h-4 ${wishlistItems.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-[#C2410C] dark:text-[#FBBF24]'}`} />
              <span className="hidden md:inline">المفضلة</span>
              {wishlistItems.length > 0 && (
                <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-rose-600 text-white font-mono tabular-nums text-[10px] font-black flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              style={
                isCustomTheme
                  ? { background: `linear-gradient(to right, ${themeMeta.accentBg}, ${themeMeta.accentHover})` }
                  : undefined
              }
              className="relative px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-xs transition flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
              title="سلة المشتريات"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">السلة</span>
              {cartItemsCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#0C1427] text-[#FBBF24] font-mono tabular-nums text-[11px] font-black flex items-center justify-center">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Artisan Store Promotional Banner (Optional Limited-Time Countdown or Min-Order Trigger) */}
      {artisanConfig.promoBanner?.enabled && artisanConfig.promoBanner.text?.trim() && (
        <div
          style={{
            backgroundColor: artisanConfig.promoBanner.bgColor || '#C2410C',
          }}
          className="text-white border-b border-black/15 px-4 py-2.5"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {artisanConfig.promoBanner.showDiscountLabel && artisanConfig.promoBanner.discountLabel && (
                <span className="px-2 py-0.5 rounded-md bg-black/25 font-black text-[11px] shrink-0">
                  {artisanConfig.promoBanner.discountLabel}
                </span>
              )}
              <span className="font-black">{artisanConfig.promoBanner.text}</span>
              {artisanConfig.promoBanner.showSubText && artisanConfig.promoBanner.subText && (
                <span className="opacity-90 text-[11px]">· {artisanConfig.promoBanner.subText}</span>
              )}
            </div>

            {artisanConfig.promoBanner.triggerType === 'limited_time' && promoRemainingMs > 0 && (
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-[11px] font-black bg-black/25 px-2.5 py-1 rounded-lg shrink-0" dir="ltr">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {String(Math.floor(promoRemainingMs / 86400000)).padStart(2, '0')}d :{' '}
                  {String(Math.floor((promoRemainingMs % 86400000) / 3600000)).padStart(2, '0')}h :{' '}
                  {String(Math.floor((promoRemainingMs % 3600000) / 60000)).padStart(2, '0')}m :{' '}
                  {String(Math.floor((promoRemainingMs % 60000) / 1000)).padStart(2, '0')}s
                </span>
              </div>
            )}

            {artisanConfig.promoBanner.triggerType === 'min_order' &&
              Number(artisanConfig.promoBanner.minOrderAmount) > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-black/25 text-[11px] font-black shrink-0 tabular-nums">
                  متاح للطلبات فوق {Number(artisanConfig.promoBanner.minOrderAmount).toLocaleString('ar-EG')} ج.م
                </span>
              )}
          </div>
        </div>
      )}

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

      {/* 2. Clean Store Identity Banner (Controllable per field by Artisan Storefront Builder) */}
      <section
        style={
          isCustomTheme
            ? {
                backgroundColor: isDarkTheme ? themeMeta.surfaceDark : themeMeta.surfaceLight,
                borderColor: isDarkTheme ? themeMeta.borderDark : themeMeta.borderLight,
              }
            : undefined
        }
        className="bg-[#F7F3EA] dark:bg-[#0D162E] border-b border-[#D4CCBC] dark:border-[#22355E] py-6 sm:py-8 px-4 sm:px-6"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2.5 text-right max-w-2xl">
            {artisanConfig.showArtistSubtitle && (
              <p className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                بأنامل الفنان: {artistName} · {workshop?.country || 'مصر'}
                {artisanConfig.showCraftBadge && artisanConfig.craftBadge ? ` · ${artisanConfig.craftBadge}` : ''}
              </p>
            )}

            {artisanConfig.showBrandTitle && (
              <h2 className="text-2xl sm:text-3xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-tight text-balance">
                {brandName}
              </h2>
            )}

            {artisanConfig.showWelcomeMessage && artisanConfig.welcomeMessage && (
              <p className="text-xs sm:text-sm font-bold text-[#0C1427]/85 dark:text-[#F7F3EA]/90 leading-relaxed">
                {artisanConfig.welcomeMessage}
              </p>
            )}

            {artisanConfig.showArtistStory && resolvedArtistStory && (
              <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                {resolvedArtistStory}
              </p>
            )}

            {(artisanConfig.showWorkingHours ||
              artisanConfig.showProductionTurnaround ||
              artisanConfig.showCustomOrderBadge) && (
              <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1]">
                {artisanConfig.showWorkingHours && artisanConfig.workingHours && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                    <span>{artisanConfig.workingHours}</span>
                  </span>
                )}
                {artisanConfig.showProductionTurnaround && artisanConfig.productionTurnaround && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24]" />
                    <span>{artisanConfig.productionTurnaround}</span>
                  </span>
                )}
                {artisanConfig.showCustomOrderBadge && artisanConfig.customOrderBadgeText && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{artisanConfig.customOrderBadgeText}</span>
                  </span>
                )}
              </div>
            )}

            {/* Direct Contact with the Artisan */}
            {(artisanConfig.showPhoneButtons || artisanConfig.showDeliveryBadge) && (
              <div className="pt-1 flex flex-wrap items-center gap-3 text-xs">
                {artisanConfig.showPhoneButtons && (
                  <>
                    <a
                      href={`tel:${phone}`}
                      style={
                        isCustomTheme
                          ? { background: `linear-gradient(to right, ${themeMeta.accentBg}, ${themeMeta.accentHover})` }
                          : undefined
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold transition cursor-pointer whitespace-nowrap"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span dir="ltr">{phone}</span>
                    </a>

                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>واتساب الفنان</span>
                    </a>
                  </>
                )}

                {artisanConfig.showDeliveryBadge && (
                  <span className="inline-flex items-center gap-1.5 text-[#334155] dark:text-[#CBD5E1] font-medium">
                    <Truck className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />
                    <span>توصيل لجميع المحافظات</span>
                  </span>
                )}
              </div>
            )}

            {workshop?.id && (
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-black transition cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>الصفحة الشخصية ومعرض الأعمال</span>
                </button>
              </div>
            )}
          </div>

          {/* Clean Rating & Catalog Summary */}
          <div className="flex items-center gap-6 px-5 py-3.5 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] shrink-0">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[#F59E0B] mb-0.5">
                {Array.from({ length: Math.min(5, Math.max(1, Number(workshop?.ratingStars) || 5)) }).map(
                  (_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                  )
                )}
              </div>
              <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">تقييم المتجر</p>
            </div>
            <div className="w-px h-8 bg-[#D4CCBC] dark:bg-[#22355E]" />
            <div className="text-center">
              <p className="text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] tabular-nums">
                {storeData?.products?.length || 0}
              </p>
              <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">منتج متاح</p>
            </div>
          </div>
        </div>
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
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#475569] dark:text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث داخل المتجر..."
                className="w-full h-10 pr-10 pl-4 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] placeholder-[#475569] dark:placeholder-[#94A3B8] text-xs sm:text-sm font-medium outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border shrink-0 ${
                    selectedCategory === c.id
                      ? 'bg-[#0C1427] text-[#F7F3EA] border-[#0C1427] dark:bg-[#EA580C] dark:text-white dark:border-[#EA580C]'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto flex-wrap">
            {/* Customer Display Currency Switcher */}
            <div className="relative flex items-center">
              <Coins className="w-3.5 h-3.5 text-[#C2410C] dark:text-[#FBBF24] absolute right-2.5 pointer-events-none" />
              <select
                value={customerCurrency}
                onChange={(e) => setCustomerCurrency(saveStoredCustomerDisplayCurrency(e.target.value))}
                aria-label="العملة المعروضة للعميل"
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

        {/* Clean Products Grid (1, 2, or 3 Columns Selected by Artist) */}
        {!loading && filteredProducts.length > 0 && (
          <div
            className={`grid ${
              layoutCols === 1
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
              const isCompact3Col = layoutCols === 3;

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
                  className={`group rounded-xl sm:rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer ${
                    isDragOver
                      ? 'border-[#EA580C] ring-2 ring-[#EA580C] scale-[1.02] shadow-lg'
                      : isDragging
                      ? 'opacity-50 border-dashed border-[#EA580C]'
                      : 'border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60 dark:hover:border-[#FBBF24]/50 hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                >
                  <div>
                    {/* Owner Drag & Reorder Control Strip */}
                    {isOwnerPreview && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="px-1.5 sm:px-3 py-1 bg-[#E9E2D4] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-1 text-[10px] font-black text-[#0C1427] dark:text-[#F7F3EA] cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <GripVertical className="w-3 h-3 text-[#C2410C] dark:text-[#FBBF24] shrink-0" />
                          <span className="truncate">#{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStepMoveProduct(p.id, -1)}
                            disabled={idx === 0}
                            title="تقديم للأول"
                            className="p-0.5 rounded hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepMoveProduct(p.id, 1)}
                            disabled={idx === filteredProducts.length - 1}
                            title="تأخير"
                            className="p-0.5 rounded hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Clean Photography with single optional limited-time/discount badge */}
                    <div
                      className={`relative w-full ${
                        isCompact3Col ? 'aspect-square sm:aspect-[4/3]' : 'aspect-[4/3]'
                      } bg-[#E9E2D4] dark:bg-[#132040] overflow-hidden border-b border-[#D4CCBC]/70 dark:border-[#22355E]`}
                    >
                      {pricing.badgeText && (
                        <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md bg-[#0C1427]/90 text-[#FBBF24] text-[10px] font-black shadow-xs pointer-events-none">
                          {pricing.badgeText}
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
                        className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-[#F7F3EA]/90 dark:bg-[#0C1427]/85 border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 transition ${
                            wishlistIds.has(p.id)
                              ? 'fill-rose-500 text-rose-500'
                              : 'text-[#334155] dark:text-[#CBD5E1]'
                          }`}
                        />
                      </button>
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

                    <div className={`${isCompact3Col ? 'p-1.5 sm:p-3.5 space-y-1 sm:space-y-1.5' : layoutCols === 2 ? 'p-2.5 sm:p-4 space-y-1.5 sm:space-y-2' : 'p-4 space-y-2'}`}>
                      <p
                        className={`${
                          isCompact3Col ? 'text-[9px] sm:text-xs' : 'text-[10px] sm:text-xs'
                        } font-medium text-[#475569] dark:text-[#94A3B8] truncate`}
                      >
                        {p.craft_name || p.category} · {p.current_stock > 0 ? 'متوفر' : 'تنفيذ بالطلب'}
                      </p>

                      <h3
                        className={`font-bold ${
                          isCompact3Col
                            ? 'text-[11px] sm:text-sm md:text-base'
                            : layoutCols === 2
                            ? 'text-xs sm:text-base'
                            : 'text-base sm:text-lg'
                        } text-[#0C1427] dark:text-[#F7F3EA] line-clamp-2 leading-snug group-hover:text-[#C2410C] dark:group-hover:text-[#FBBF24] transition-colors`}
                      >
                        {p.product_name}
                      </h3>

                      {p.store_description && (
                        <p
                          className={`${
                            isCompact3Col ? 'hidden sm:block text-xs' : 'text-[11px] sm:text-xs'
                          } text-[#334155] dark:text-[#CBD5E1] line-clamp-1`}
                        >
                          {p.store_description}
                        </p>
                      )}

                      {hasColors && (
                        <p
                          className={`${
                            isCompact3Col ? 'hidden sm:block text-[11px]' : 'text-[10px] sm:text-[11px]'
                          } text-[#475569] dark:text-[#94A3B8] truncate`}
                        >
                          الألوان: {p.available_colors!.slice(0, 3).join('، ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & CTA Baseline */}
                  <div
                    className={`${
                      isCompact3Col
                        ? 'px-1.5 pb-2 pt-0.5 space-y-1.5 sm:px-3.5 sm:pb-3.5 sm:space-y-2.5'
                        : layoutCols === 2
                        ? 'px-2.5 pb-2.5 pt-1 space-y-2 sm:px-4 sm:pb-4 sm:space-y-3'
                        : 'px-4 pb-4 pt-1 space-y-3'
                    }`}
                  >
                    <div className="flex items-baseline gap-1.5 font-mono tabular-nums flex-wrap">
                      <span
                        className={`${
                          isCompact3Col ? 'text-xs sm:text-lg' : layoutCols === 2 ? 'text-sm sm:text-lg' : 'text-lg sm:text-xl'
                        } font-black text-[#0C1427] dark:text-[#F7F3EA]`}
                      >
                        {pricing.finalPrice.toLocaleString('ar-EG')}
                      </span>
                      <span
                        className={`${
                          isCompact3Col ? 'text-[9px] sm:text-xs' : 'text-[10px] sm:text-xs'
                        } font-bold text-[#475569] dark:text-[#94A3B8]`}
                      >
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
                      className={`w-full ${
                        isCompact3Col
                          ? 'py-1.5 px-1.5 text-[10px] sm:py-2 sm:px-3 sm:text-xs'
                          : 'py-2 px-3 text-[11px] sm:py-2.5 sm:px-4 sm:text-xs'
                      } rounded-lg sm:rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold flex items-center justify-center gap-1 sm:gap-2 transition active:scale-95 cursor-pointer`}
                    >
                      <ShoppingBag className={`${isCompact3Col ? 'w-3 h-3 sm:w-4 sm:h-4' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'} shrink-0`} />
                      <span className="truncate">أضف للسلة</span>
                    </button>
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
                {artisanConfig.portfolioTitle || 'معرض أعمالنا السابقة ولمسات التنفيذ'}
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
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl relative text-right text-[#0C1427] dark:text-[#F7F3EA]">
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] flex items-center justify-center transition cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start pt-1">
              <div className="space-y-2.5">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                  {selectedModalPricing.badgeText && (
                    <span className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-md bg-[#0C1427]/90 text-[#FBBF24] text-[11px] font-black shadow-xs">
                      {selectedModalPricing.badgeText}
                    </span>
                  )}
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
                    className="absolute top-2.5 left-2.5 z-10 w-9 h-9 rounded-full bg-[#F7F3EA]/90 dark:bg-[#0C1427]/85 border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        wishlistIds.has(selectedProduct.id)
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-[#334155] dark:text-[#CBD5E1]'
                      }`}
                    />
                  </button>
                  <img
                    src={modalActiveImage || selectedProduct.image_url || '/alshams_falcon_emblem.png'}
                    alt={selectedProduct.product_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                {selectedModalGallery.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {selectedModalGallery.map((imgUrl, gi) => (
                      <button
                        key={gi}
                        type="button"
                        onClick={() => setModalActiveImage(imgUrl)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition ${
                          (modalActiveImage || selectedProduct.image_url) === imgUrl
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

              <div className="space-y-3 pl-8 sm:pl-0">
                <p className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                  {selectedProduct.craft_name || selectedProduct.category} ·{' '}
                  {selectedProduct.current_stock > 0 ? 'متوفر' : 'تنفيذ بالطلب'}
                </p>

                <h3 className="text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                  {selectedProduct.product_name}
                </h3>

                <div className="flex items-baseline gap-2 font-mono tabular-nums flex-wrap">
                  <span className="text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    {selectedModalPricing.finalPrice.toLocaleString('ar-EG')}
                  </span>
                  <span className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                    {selectedModalPricing.displaySymbol}
                  </span>
                  {selectedModalPricing.hasDiscount && (
                    <span className="text-sm line-through text-[#64748B] dark:text-[#94A3B8]">
                      {selectedModalPricing.originalPrice.toLocaleString('ar-EG')} {selectedModalPricing.displaySymbol}
                    </span>
                  )}
                </div>

                {selectedModalPricing.isFreeShipping && (
                  <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    <span>شحن مجاني على هذا المنتج</span>
                  </p>
                )}

                {selectedProduct.is_custom_order_available && (
                  <p className="text-[11px] font-bold text-[#C2410C] dark:text-[#FBBF24] bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>متاح للتنفيذ الخاص بألوان ومقاسات مخصصة</span>
                  </p>
                )}

                <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                  {selectedProduct.store_description || 'مشغولة يدوية متقنة الصنع.'}
                </p>
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
                style={
                  isCustomTheme
                    ? { background: `linear-gradient(to right, ${themeMeta.accentBg}, ${themeMeta.accentHover})` }
                    : undefined
                }
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
      {(artisanConfig.socialLinks?.displayMode || 'both') !== 'footer' && (
        <ContactBubbleDock
          social={artisanConfig.socialLinks}
          fallbackPhone={phone}
          accentHex={isCustomTheme ? themeMeta.accentBg : '#EA580C'}
        />
      )}

      {/* Minimal Unified Footer */}
      <footer className="mt-16 bg-[#F7F3EA] dark:bg-[#0D162E] border-t border-[#D4CCBC] dark:border-[#22355E] py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* اليمين: سوق الشمساوية بالبرتقالي */}
          <a
            href="/#/market"
            onClick={(e) => {
              if (onNavigateToMarket) {
                e.preventDefault();
                onNavigateToMarket();
              }
            }}
            className="inline-flex items-center gap-2 text-sm sm:text-base font-black text-[#EA580C] hover:text-[#C2410C] dark:text-[#FB923C] dark:hover:text-[#FDBA74] transition-colors"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>سوق الشمساوية</span>
          </a>

          {/* الوسط: قنوات التواصل وروابط السوشيال المفعلة من لوحة الفنان */}
          {(artisanConfig.socialLinks?.displayMode || 'both') !== 'floating_bubble' && (
            <ArtisanFooterContacts social={artisanConfig.socialLinks} fallbackPhone={phone} />
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
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0C1427] hover:bg-[#EA580C] dark:bg-[#132040] dark:hover:bg-[#EA580C] text-[#F7F3EA] border border-[#22355E] font-bold text-xs transition cursor-pointer active:scale-95 shrink-0 shadow-xs"
            >
              <Mail className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>الدعم الفني</span>
            </button>
            <span className="text-[10px] font-bold text-[#475569] dark:text-[#CBD5E1]">
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
