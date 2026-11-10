import React, { useState, useEffect, useMemo } from 'react';
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
  saveStoredCustomerSession,
  OFFICIAL_SUPPORT_PHONE,
  canCustomerReviewProduct,
  addProductReview,
  getProductReviews,
  ProductReviewItem,
} from '../../services/marketplaceCartService';
import { fetchApprovedMarketplaceProducts } from '../../db/marketplaceCloud';
import { supabase } from '../../lib/supabase';
import { CustomerAuthModal } from './CustomerAuthModal';
import { MarketplaceCartModal } from './MarketplaceCartModal';
import { playSuccessSound, playAlertSound } from '../../lib/sounds';
import {
  ShoppingBag,
  Store,
  Star,
  Search,
  Filter,
  Layers,
  Sparkles,
  Phone,
  ExternalLink,
  ChevronDown,
  Tag,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Truck,
  Heart,
  Share2,
  X,
  Plus,
  Minus,
  User,
  Clock,
  Check,
  AlertCircle,
} from 'lucide-react';

interface MarketplaceViewProps {
  profile?: UserProfile | null;
  onNavigateHome: () => void;
  onOpenStoreModal?: () => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  profile,
  onNavigateHome,
  onOpenStoreModal,
}) => {
  const [products, setProducts] = useState<SavedProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Decor Horizontal Category Filter (Primary)
  const [selectedDecorCategory, setSelectedDecorCategory] = useState<string>('all');

  // 2. Craft Multi-Filter (Secondary)
  const [selectedCrafts, setSelectedCrafts] = useState<string[]>(['all']);

  // Selected Product Details Modal
  const [selectedProductDetails, setSelectedProductDetails] = useState<SavedProductRecord | null>(null);

  // Selected options inside product modal
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

  // Listen to cart changes
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

  // Sync customer phone for review if logged in
  useEffect(() => {
    if (customerUser) {
      setNewReviewAuthor(customerUser.name);
      setNewReviewPhone(customerUser.phone);
    }
  }, [customerUser]);

  // Decor Categories (Horizontal Tabs)
  const decorCategories = [
    { id: 'all', nameAr: 'كافة المعروضات (الكل)', icon: '🌟' },
    { id: 'wall_hangings', nameAr: 'معلقات جدارية', icon: '🖼️' },
    { id: 'cushions', nameAr: 'كوشن وتكايات', icon: '🛋️' },
    { id: 'bags_clutches', nameAr: 'شنط وكلاتشات', icon: '👜' },
    { id: 'rugs_runners', nameAr: 'سجاد ورانرات', icon: '🧶' },
    { id: 'lighting', nameAr: 'إضاءة وأباجورات', icon: '💡' },
    { id: 'baskets_trays', nameAr: 'صواني وباسكت ومنظمات', icon: '🧺' },
    { id: 'furniture_decor', nameAr: 'قطع أثاث وديكور', icon: '🪑' },
  ];

  // Craft Multi-Filter List (المكرمية، التافت، السجاد، الديكور الخشبي، الكروشيه، الزجزاج، الكليم)
  const craftFiltersList = [
    { id: 'all', nameAr: 'الكل' },
    { id: 'macrame', nameAr: 'المكرمية' },
    { id: 'crochet', nameAr: 'كروشيه' },
    { id: 'zigzag', nameAr: 'حبال الزجزاج' },
    { id: 'tufting', nameAr: 'مسدس التافت' },
    { id: 'kilim', nameAr: 'الكليم والنسيج' },
    { id: 'wood', nameAr: 'الديكور الخشبي' },
    { id: 'resin', nameAr: 'الريزن وفنون الديكور' },
    { id: 'punch_needle', nameAr: 'البانش نيدل' },
  ];

  // Dynamic Live Load & Realtime Sync for Approved Products
  useEffect(() => {
    let isMounted = true;
    const fetchMarketplace = async () => {
      setLoading(true);
      try {
        const tenantId = profile?.tenantId || profile?.workshopId || profile?.id || 'public';
        const localProds = await tenantStorage.getProducts(tenantId).catch(() => []);

        // 1. Fetch approved products from live Supabase cloud marketplace directly
        let cloudApproved: any[] = [];
        try {
          const { data, error } = await supabase
            .from('marketplace_products')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) {
            cloudApproved = data;
          } else {
            cloudApproved = await fetchApprovedMarketplaceProducts().catch(() => []);
          }
        } catch {
          cloudApproved = await fetchApprovedMarketplaceProducts().catch(() => []);
        }

        const cloudMapped: SavedProductRecord[] = (cloudApproved || []).map((cp: any) => ({
          id: cp.id,
          workshopId: cp.workshop_id || cp.workshopId,
          productName: cp.product_name || cp.productName || 'مشغولة يدوية فاخرة',
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

        // 2. Combine approved cloud products with locally approved workshop products (Zero Mock Data)
        const publishedLocal = localProds.filter((p: SavedProductRecord) => p && p.inStore && p.isMarketplaceApproved !== false);
        const combined = [...cloudMapped, ...publishedLocal];
        const unique = Array.from(new Map(combined.map((p) => [p.id, p])).values());

        if (isMounted) {
          setProducts(unique);
        }
      } catch (err) {
        console.warn('Error fetching marketplace products:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMarketplace();

    // 3. Supabase Realtime Sync: Listen to live INSERT, UPDATE, DELETE on marketplace_products
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

  // Craft Multi-Filter Toggle Logic
  const handleToggleCraftFilter = (craftId: string) => {
    if (craftId === 'all') {
      setSelectedCrafts(['all']);
      return;
    }

    let updated = selectedCrafts.filter((c) => c !== 'all');
    if (updated.includes(craftId)) {
      updated = updated.filter((c) => c !== craftId);
      if (updated.length === 0) updated = ['all'];
    } else {
      updated.push(craftId);
    }
    setSelectedCrafts(updated);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.productName.toLowerCase().includes(q) ||
        (p.storeDescription || '').toLowerCase().includes(q) ||
        (p.craftName || '').toLowerCase().includes(q);

      // 2. Decor Category (Primary horizontal tabs)
      const matchDecor =
        selectedDecorCategory === 'all' ||
        p.decorCategory === selectedDecorCategory;

      // 3. Craft Multi-Filter (Secondary)
      const matchCraft =
        selectedCrafts.includes('all') ||
        selectedCrafts.includes(p.category) ||
        (p.craftName && selectedCrafts.some((sc) => p.craftName?.includes(sc)));

      return matchSearch && matchDecor && matchCraft;
    });
  }, [products, searchQuery, selectedDecorCategory, selectedCrafts]);

  // Open Product Modal
  const handleOpenProductDetails = (product: SavedProductRecord) => {
    setSelectedProductDetails(product);
    setModalQuantity(1);
    setModalSelectedColor(product.availableColors?.[0] || 'اللون الأصلي المعروض');
    setModalSelectedSize(product.availableSizes?.[0] || 'المقاس القياسي');
    setModalCustomNotes('');
    setReviewGuardError('');
  };

  // Add to persistent cart (supports direct click from card or modal)
  const handleAddToCart = (
    product: SavedProductRecord,
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
      artistName: (product as any).artistName || 'فنان الشمساوية',
      selectedColor: color || modalSelectedColor || product.availableColors?.[0] || 'اللون الأصلي',
      selectedSize: size || modalSelectedSize || product.availableSizes?.[0] || 'المقاس القياسي',
      customNotes: modalCustomNotes.trim() || undefined,
    };

    addToCart(item);
    playSuccessSound();
    setFeedback(`✓ تمت إضافة "${product.productName}" إلى سلة مشترياتك بنجاح!`);
    setTimeout(() => setFeedback(''), 3500);
    setSelectedProductDetails(null);
    setIsCartOpen(true);
  };

  // Add Review with Strict Verification
  const handleAddReview = (productId: string) => {
    setReviewGuardError('');

    const phone = customerUser?.phone || newReviewPhone.trim();
    const author = customerUser?.name || newReviewAuthor.trim();

    if (!author) {
      setReviewGuardError('يرجى كتابة اسم حضرتك الكريم.');
      return;
    }
    if (!phone || phone.length < 10) {
      setReviewGuardError('يرجى إدخال رقم هاتفك للتحقق من سجل استلام المشغولة.');
      return;
    }
    if (!newReviewComment.trim()) {
      setReviewGuardError('يرجى كتابة رأيك وملاحظاتك عن جودة الخامات والتفنيش.');
      return;
    }

    // Strict Buyer Verification Rule
    const check = canCustomerReviewProduct(productId, phone);
    if (!check.allowed) {
      setReviewGuardError(check.reason || 'التقييم متاح فقط للمشترين الذين استلموا هذه المشغولة بالفعل.');
      playAlertSound();
      return;
    }

    // Allowed: save review
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
    setFeedback('✓ شكراً لتقييمك الموثق! تم نشر رأيك لدعم فناني الورشة.');
    setTimeout(() => setFeedback(''), 4000);
  };

  return (
    <div className="min-h-screen bg-[#080F1E] text-white font-sans pb-20 max-w-full overflow-x-hidden" dir="rtl">
      {/* 1. Top Marketplace Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0C1427]/95 backdrop-blur-md border-b border-amber-500/30 px-3 sm:px-6 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Direct Home/Market link */}
          <button
            type="button"
            onClick={() => {
              if (window.location.hash) window.location.hash = '#/market';
              setSearchQuery('');
              setSelectedDecorCategory('all');
            }}
            className="flex items-center gap-2.5 cursor-pointer text-right group"
            title="سوق الشمساوية المركزي"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition">
              🛍️
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2">
                <span>سوق الشمساوية 🛍️</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 hidden sm:inline-block font-bold">
                  ضمان الجودة 🛡️
                </span>
              </h1>
            </div>
          </button>

          {/* Actions: Cart, Customer Profile, Artisan Store */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Customer Session Button */}
            {customerUser ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white truncate max-w-[100px]">{customerUser.name}</span>
                <span className="text-[10px] font-mono text-amber-300">({customerUser.loyaltyPoints} نقطة)</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCustomerAuthOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">حساب العميل (خصم 5%)</span>
              </button>
            )}

            {/* Persistent Cart Button with Badge */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition cursor-pointer"
              title="فتح سلة المشتريات"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">السلة</span>
              {cartItemsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black animate-pulse">
                  {cartItemsCount}
                </span>
              )}
            </button>

            {/* Workshop Storefront (if artisan) */}
            {onOpenStoreModal && (
              <button
                type="button"
                onClick={onOpenStoreModal}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-amber-500/20"
                title="لوحة متجر ورشتي"
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden md:inline">متجري 🏪</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Streamlined Search and Category Hub (No Lengthy Clutter) */}
      <div className="px-4 pt-6 pb-2 max-w-7xl mx-auto space-y-4">

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن معلقة جدارية، باسكت زجزاج، كوشن، سجادة تافتنج، كليم، أو كلاتش..."
              className="w-full px-4 py-3 pr-11 rounded-2xl bg-[#0C1427] border-2 border-amber-500/40 text-white placeholder-stone-400 text-xs sm:text-sm font-bold outline-none focus:border-amber-400 shadow-xl"
            />
            <Search className="w-5 h-5 text-amber-400 absolute right-3.5 top-3.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-3 text-xs text-stone-400 hover:text-white font-bold cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Primary Decor Horizontal Categories Bar */}
      <div className="max-w-7xl mx-auto px-4 mb-3">
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-amber-400/90 block">
            تقسيم المعروضات حسب الاستخدام والديكور المنزلي:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {decorCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedDecorCategory(cat.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition flex items-center gap-2 cursor-pointer shadow-md shrink-0 ${
                  selectedDecorCategory === cat.id
                    ? 'bg-amber-600 text-white border-2 border-amber-400'
                    : 'bg-[#0C1427] text-stone-300 hover:text-white border border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.nameAr}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Secondary Craft Multi-Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <div className="p-3 rounded-2xl bg-[#0C1427] border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-300 font-bold flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>تصفية متعددة حسب نوع الحرفة (يمكنك اختيار أكثر من حرفة):</span>
            </span>
            <span className="text-[10px] text-[#EADBC8]">
              {selectedCrafts.includes('all') ? 'كافة الحرف' : `${selectedCrafts.length} حرف مختارة`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {craftFiltersList.map((craft) => {
              const isSelected = selectedCrafts.includes(craft.id);
              return (
                <button
                  key={craft.id}
                  type="button"
                  onClick={() => handleToggleCraftFilter(craft.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-stone-950 font-black shadow-md'
                      : 'bg-[#080F1E] text-stone-300 hover:text-white border border-amber-500/20'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{craft.nameAr}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feedback Alert Banner */}
      {feedback && (
        <div className="max-w-xl mx-auto px-4 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold text-center animate-in fade-in">
            {feedback}
          </div>
        </div>
      )}

      {/* 5. Products Grid (Mobile Responsive, zero overflow) */}
      <main className="max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-amber-200 font-bold">جاري تحميل مشغولات سوق الشمساوية...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center rounded-3xl bg-[#0C1427] border border-amber-500/20 space-y-3">
            <ShoppingBag className="w-12 h-12 mx-auto text-amber-500/50" />
            <h3 className="text-sm font-black text-amber-200">لم نجد مشغولات مطابقة للبحث أو التصفية الحالية</h3>
            <p className="text-xs text-[#EADBC8]">
              جرب تغيير كلمات البحث أو اختيار تبويب ديكور مختلف.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredProducts.map((p) => {
              const hasStock = (p.currentStock || 0) > 0;
              const price = p.storePrice || p.retailPrice || 0;
              const reviews = getProductReviews(p.id);
              const avgRating = reviews.length > 0
                ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
                : '5.0';

              return (
                <div
                  key={p.id}
                  onClick={() => handleOpenProductDetails(p)}
                  className="rounded-3xl bg-[#0C1427] border border-amber-500/30 overflow-hidden hover:border-amber-400 transition-all duration-300 shadow-xl flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
                >
                  <div>
                    {/* Image Container */}
                    <div className="relative w-full h-52 bg-[#080F1E] overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.productName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-amber-500/40">
                          <ShoppingBag className="w-12 h-12 mb-1" />
                          <span className="text-xs">مشغولة يدوية</span>
                        </div>
                      )}

                      {/* Stock Badge */}
                      <div className="absolute top-2.5 right-2.5">
                        {hasStock ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-600/95 text-white font-black text-[10px] shadow-lg border border-emerald-300 flex items-center gap-1">
                            <span>متاح فوري ({p.currentStock} قطعة)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-amber-600/95 text-white font-black text-[10px] shadow-lg border border-amber-300 flex items-center gap-1">
                            <span>يُصنع عند الطلب ⏳</span>
                          </span>
                        )}
                      </div>

                      {/* Price Badge */}
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="px-3 py-1 rounded-xl bg-[#080F1E]/90 text-amber-300 font-mono font-black text-sm border border-amber-500/40 shadow-md">
                          {price} ج.م
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                        <span>{p.craftName || p.category}</span>
                        <div className="flex items-center gap-1 text-amber-300 text-xs font-mono">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{avgRating} ({reviews.length})</span>
                        </div>
                      </div>

                      <h3 className="font-black text-sm text-white line-clamp-1 group-hover:text-amber-300 transition-colors">
                        {p.productName}
                      </h3>

                      <p className="text-xs text-[#EADBC8] line-clamp-2 leading-relaxed">
                        {p.storeDescription || p.input?.personalNotes || 'مشغولة يدوية فاخرة مصنوعة بدقة وعناية على أيدي فناني الشمساوية.'}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer with Direct Controls */}
                  <div className="p-3 sm:p-4 pt-2 border-t border-amber-500/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>عربون 33% واستلام آمن 🛡️</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProductDetails(p);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                      >
                        <span>تفاصيل ومقاسات</span>
                        <ArrowRight className="w-3 h-3 rotate-180" />
                      </button>
                    </div>

                    {/* Direct Add to Cart Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(p, 1);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer border border-amber-400/30"
                    >
                      <ShoppingBag className="w-4 h-4 text-amber-200" />
                      <span>أضف للسلة (عربون 33%) 🛒</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 6. Product Details, Customization & Ordering Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="bg-[#0C1427] border-2 border-amber-500/50 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto text-right shadow-2xl p-5 sm:p-6 space-y-5 text-white relative">
            {/* Explicit Close Button (✕) */}
            <button
              type="button"
              onClick={() => setSelectedProductDetails(null)}
              className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="إغلاق والرجوع للتصفح"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title Bar */}
            <div className="border-b border-amber-500/20 pb-3 pl-10">
              <span className="text-xs font-bold text-amber-400 block mb-0.5">
                {selectedProductDetails.craftName || selectedProductDetails.category} • ضمان شركة الشمس كرافت
              </span>
              <h3 className="font-black text-base sm:text-lg text-white">
                {selectedProductDetails.productName}
              </h3>
            </div>

            {/* Product Body: Image & Specs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Product Image */}
              <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-black/40 border border-amber-500/30">
                {selectedProductDetails.imageUrl ? (
                  <img
                    src={selectedProductDetails.imageUrl}
                    alt={selectedProductDetails.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-400/50">
                    <ShoppingBag className="w-12 h-12" />
                  </div>
                )}
              </div>

              {/* Specs & Customization Options */}
              <div className="space-y-3 text-xs leading-relaxed">
                {/* Price Box */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#080F1E] border border-amber-500/30">
                  <span className="text-stone-300 font-bold">سعر القطعة المعتمد:</span>
                  <span className="font-mono text-xl font-black text-amber-300">
                    {selectedProductDetails.storePrice || selectedProductDetails.retailPrice || 0} ج.م
                  </span>
                </div>

                {/* Description */}
                <div className="p-3 rounded-2xl bg-[#080F1E] border border-amber-500/30 space-y-1">
                  <span className="text-amber-400 font-bold block mb-1">المواصفات وخامات الفنش:</span>
                  <p className="text-[#EADBC8] text-[11px] leading-relaxed">
                    {selectedProductDetails.storeDescription || selectedProductDetails.input?.personalNotes || 'مشغولة يدوية فاخرة مصنوعة بخامات أصلية وبأيدي فنانين مصريين محترفين، وتخضع للفحص اليدوي المزدوج قبل الشحن.'}
                  </p>
                </div>

                {/* Available Colors Selector */}
                {selectedProductDetails.availableColors && selectedProductDetails.availableColors.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-stone-300 font-bold">
                      اختر اللون المتاح:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProductDetails.availableColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setModalSelectedColor(color)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            modalSelectedColor === color
                              ? 'bg-amber-600 text-white border-2 border-amber-400 font-black'
                              : 'bg-[#080F1E] text-stone-300 hover:text-white border border-amber-500/20'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Sizes Selector */}
                {selectedProductDetails.availableSizes && selectedProductDetails.availableSizes.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-stone-300 font-bold">
                      اختر المقاس والأبعاد:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProductDetails.availableSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setModalSelectedSize(size)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            modalSelectedSize === size
                              ? 'bg-amber-600 text-white border-2 border-amber-400 font-black'
                              : 'bg-[#080F1E] text-stone-300 hover:text-white border border-amber-500/20'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Notes */}
                <div>
                  <label className="block text-stone-300 font-bold mb-1">
                    ملاحظات أو أبعاد خاصة لتصنيع قطعتك (اختياري):
                  </label>
                  <input
                    type="text"
                    value={modalCustomNotes}
                    onChange={(e) => setModalCustomNotes(e.target.value)}
                    placeholder="مثال: يرجى جعل يد السلة بطول 35 سم أو تطريز حرف معين"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white text-xs outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                {/* Quantity & Add to Cart Button */}
                <div className="pt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#080F1E] border border-amber-500/40 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono font-black text-amber-300 text-sm">
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
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl active:scale-98 transition cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>إضافة إلى سلة المشتريات ({(selectedProductDetails.storePrice || selectedProductDetails.retailPrice || 0) * modalQuantity} ج.م)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 7. Verified Reviews & Rating Guard Section */}
            <div className="border-t border-amber-500/20 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-amber-300 flex items-center gap-2">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>تقييمات المشترين الموثقة في هذه المشغولة</span>
                </h4>
                <span className="text-[11px] text-stone-400">
                  فقط للمشترين الذين استلموا طلبيتهم بنجاح
                </span>
              </div>

              {/* Reviews List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {getProductReviews(selectedProductDetails.id).length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#080F1E] border border-amber-500/20 text-xs text-stone-400 text-center">
                    لا توجد تقييمات منشورة حتى الآن. التقييم متاح تلقائياً لكل مشتري بعد تسليم قطعتة وفحصها بنجاح.
                  </div>
                ) : (
                  getProductReviews(selectedProductDetails.id).map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-[#080F1E] border border-amber-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{rev.authorName}</span>
                          {rev.verifiedBuyer && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-bold">
                              مشتري موثق ✓
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-amber-400">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[#EADBC8] text-[11px]">{rev.comment}</p>
                      <span className="text-[9px] text-stone-500 block font-mono">{rev.date}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Review Submission with Guard */}
              <div className="p-3.5 rounded-2xl bg-[#080F1E] border border-amber-500/30 space-y-2.5">
                <span className="font-bold text-xs text-amber-300 block">
                  أضف تقييمك للمشغولة (خاص بالعملاء الذين استلموا طلبيتهم):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={customerUser?.name || newReviewAuthor}
                    onChange={(e) => setNewReviewAuthor(e.target.value)}
                    placeholder="اسمك الكريم..."
                    disabled={!!customerUser}
                    className="px-3 py-2 rounded-xl bg-[#0C1427] border border-amber-500/40 text-white outline-none font-bold disabled:opacity-75"
                  />
                  <input
                    type="tel"
                    value={customerUser?.phone || newReviewPhone}
                    onChange={(e) => setNewReviewPhone(e.target.value)}
                    placeholder="رقم الهاتف المستخدم في الطلب للتأكد..."
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
                  placeholder="رأيك الصادق في جودة الخامات والتفنيش والتغليف..."
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
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-md transition"
                  >
                    نشر التقييم الموثق ✨
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Persistent Cart Modal */}
      <MarketplaceCartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        customerUser={customerUser}
        onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
        onOrderSuccess={(order) => {
          setFeedback(`✓ تم تسجيل طلبيتك بنجاح برقم #${order.invoiceNumber}! سيتواصل معك فريق الشمس كرافت لتأكيد الشحن.`);
        }}
      />

      {/* 9. Customer Auth Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        onContinueAsGuest={() => setIsCustomerAuthOpen(false)}
        onSuccessLogin={(user) => {
          setCustomerUser(user);
          setIsCustomerAuthOpen(false);
          setFeedback(`✓ مرحباً بك يا ${user.name}! تم تفعيل كود الخصم 5% وإضافة 50 نقطة ولاء لمحفظتك 🎁`);
          setTimeout(() => setFeedback(''), 4000);
        }}
      />
      {/* Unified 2-Line Footer */}
      <footer className="mt-16 bg-[#0C1427] border-t border-amber-500/30 py-8 px-4 sm:px-6 text-center space-y-3">
        <p className="text-sm sm:text-base font-black text-amber-500">
          منظومة الشمساوية للفنون والأعمال اليدوية
        </p>
        <div className="flex items-center justify-center pt-1">
          <a
            href="https://wa.me/201000996059"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition cursor-pointer active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>الدعم الفني 🟢</span>
          </a>
        </div>
      </footer>
    </div>
  );
};
