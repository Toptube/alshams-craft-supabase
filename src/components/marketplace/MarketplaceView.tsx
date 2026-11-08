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

  // Craft Multi-Filter List
  const craftFiltersList = [
    { id: 'all', nameAr: 'الكل' },
    { id: 'macrame', nameAr: 'المكرمية' },
    { id: 'crochet', nameAr: 'كروشيه' },
    { id: 'zigzag', nameAr: 'حبال الزجزاج' },
    { id: 'kilim', nameAr: 'الكليم والنسيج' },
    { id: 'punch_needle', nameAr: 'البانش نيدل' },
    { id: 'tufting', nameAr: 'مسدس التافت' },
  ];

  // Seed Rich Egyptian Artisan Decor Sample Products
  useEffect(() => {
    let isMounted = true;
    const fetchMarketplace = async () => {
      setLoading(true);
      try {
        const tenantId = profile?.tenantId || profile?.workshopId || profile?.id || 'public';
        const localProds = await tenantStorage.getProducts(tenantId).catch(() => []);

        // Authentic Egyptian Handcrafted Decor Samples
        const sampleProducts: SavedProductRecord[] = [
          {
            id: 'mkt_zigzag_basket',
            productName: 'طقم باسكت ومنظمات حبال زجزاج قطنية محشية (3 قطع)',
            category: 'zigzag',
            craftName: 'حبال الزجزاج',
            decorCategory: 'baskets_trays',
            retailPrice: 460,
            storePrice: 460,
            wholesalePrice: 350,
            costPrice: 220,
            currentStock: 6,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'سلال تنظيم ديكورية مصنوعة بماكينة الزجزاج من حبال قطن مصري محشية 8 مم، متينة وقابلة للغسيل مع قاعدة صلبة ومقابض يد جلدية فاخرة.',
            availableColors: ['أوف وايت طبيعي', 'بيج دافئ', 'رمادي ترابي', 'زيتي ملكي'],
            availableSizes: ['طقم 3 مقاسات (20-25-30 سم)', 'قطعة كبيرة 30 سم', 'قطعة وسط 25 سم'],
            isActive: true,
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_macrame_wall',
            productName: 'معلقة مكرمية بوهيمية فاخرة "شمس الأصالة" على خشب زان',
            category: 'macrame',
            craftName: 'المكرمية',
            decorCategory: 'wall_hangings',
            retailPrice: 580,
            storePrice: 580,
            wholesalePrice: 450,
            costPrice: 290,
            currentStock: 4,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'معلقة حائط ديكورية ضخمة (عرض 90 سم × ارتفاع 110 سم) بخيوط قطن محلول 4 مم، معقودة يدوياً بحرفية مع نهايات شراشيب متدرجة وغرز مموجة.',
            availableColors: ['أوف وايت عاجي', 'خردلي بوهيمي', 'كافيه هادئ'],
            availableSizes: ['عرض 90 سم × طول 110 سم', 'عرض 60 سم × طول 85 سم'],
            isActive: true,
            createdAt: Date.now() - 172800000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_crochet_cushion',
            productName: 'غطاء كوشن كروشيه يدوي بغرزة الباف والضفائر العريضة',
            category: 'crochet',
            craftName: 'كروشيه',
            decorCategory: 'cushions',
            retailPrice: 290,
            storePrice: 290,
            wholesalePrice: 220,
            costPrice: 140,
            currentStock: 9,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'تكاية صالون وكنب كروشيه مصنوعة من خيوط قطن كليم ناعمة مع سوستة عظم مخفية وبطانة ستان مقاومة للتمزق، مريحة وأنيقة في غرف المعيشة.',
            availableColors: ['بيج سكري', 'كشمير ناعم', 'أزرق بترولي', 'رمادي فاتح'],
            availableSizes: ['مقاس 45×45 سم', 'مقاس 50×50 سم'],
            isActive: true,
            createdAt: Date.now() - 250000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_tufting_rug',
            productName: 'سجادة تافتنج يدوية كثيفة بنقشة الأشكال الهندسية المعاصرة',
            category: 'tufting',
            craftName: 'مسدس التافت',
            decorCategory: 'rugs_runners',
            retailPrice: 1250,
            storePrice: 1250,
            wholesalePrice: 980,
            costPrice: 620,
            currentStock: 2,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'سجادة أرضية فخمة كثيفة الوبرة (ارتفاع وبرة 18 مم) مصنعة بمسدس التافت الكهربائي مع غراء لاتكس طبيعي مثبت وقماش ظهر مانع للانزلاق.',
            availableColors: ['ألوان ترابية متدرجة', 'أسود وأبيض مونوكروم', 'أخضر غابي وبيج'],
            availableSizes: ['قطر دائري 100 سم', 'مستطيل 80×120 سم', 'مستطيل 100×150 سم'],
            isActive: true,
            createdAt: Date.now() - 340000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_kilim_runner',
            productName: 'رانر كليم صوف يدوي مصري أصيل غزل نقي بنقوش نوبية',
            category: 'kilim',
            craftName: 'الكليم والنسيج',
            decorCategory: 'rugs_runners',
            retailPrice: 680,
            storePrice: 680,
            wholesalePrice: 530,
            costPrice: 340,
            currentStock: 5,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1579656381289-53b92eb5f564?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'رانر طاولات وسفرة أو ممرات نول يدوي مصري 100%، خيوط سداء قطنية مبرومة وصوف بلدي مصبوغ بألوان ثابتة، وجهين استخدام متطابقين.',
            availableColors: ['أحمر نوبي دافئ', 'طوبي وكموني', 'رمادي في أوف وايت'],
            availableSizes: ['طول 150 سم × عرض 40 سم', 'طول 200 سم × عرض 50 سم'],
            isActive: true,
            createdAt: Date.now() - 430000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_zigzag_clutch',
            productName: 'شنطة كلاتش حبال زجزاج يدوي مع سوستة وأيدي جلد طبيعي',
            category: 'zigzag',
            craftName: 'حبال الزجزاج',
            decorCategory: 'bags_clutches',
            retailPrice: 340,
            storePrice: 340,
            wholesalePrice: 260,
            costPrice: 170,
            currentStock: 7,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'كلاتش خروج وسهرة من حبال الزجزاج القطنية المتينة، مبطنة بالكامل بقماش سالسا ناعم مع سوستة عظم وجيب داخلي ويد جلد طبيعي قابلة للفك.',
            availableColors: ['كافيه وجملي', 'أوف وايت مطرز بخيط ذهبي', 'أسود ملكي'],
            availableSizes: ['عرض 28 سم × ارتفاع 18 سم', 'عرض 32 سم × ارتفاع 22 سم'],
            isActive: true,
            createdAt: Date.now() - 520000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_lighting_pendant',
            productName: 'أباجورة سقف بوهيمية من حبال المكرمية المعقودة والمفرغة',
            category: 'macrame',
            craftName: 'المكرمية',
            decorCategory: 'lighting',
            retailPrice: 520,
            storePrice: 520,
            wholesalePrice: 410,
            costPrice: 260,
            currentStock: 3,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'وحدة إضاءة متدلية مفرغة تنشر ظلالاً دافئة ساحرة على الجدران، مثبتة على شاسيه حديد معالج ضد الصدأ مع سلك وقاعدة سقف خشبية.',
            availableColors: ['أوف وايت قطني', 'كتان طبيعي'],
            availableSizes: ['قطر 35 سم × ارتفاع 45 سم', 'قطر 45 سم × ارتفاع 60 سم'],
            isActive: true,
            createdAt: Date.now() - 610000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_crochet_coasters',
            productName: 'طقم كوسترات كروشيه فاخرة (6 قطع) مع باكت حفظ منظم',
            category: 'crochet',
            craftName: 'كروشيه',
            decorCategory: 'baskets_trays',
            retailPrice: 190,
            storePrice: 190,
            wholesalePrice: 140,
            costPrice: 85,
            currentStock: 12,
            inStore: true,
            isPublishedInStore: true,
            isMarketplaceApproved: true,
            imageUrl: 'https://images.unsplash.com/photo-1606821107936-cb44f24ef78b?auto=format&fit=crop&w=800&q=80',
            storeDescription: 'طقم كوسترات أكواب وفناجين سميكة عازلة للحرارة لحماية الأسطح الخشبية والرخامية، مع باكت دائري لحفظ الطقم بأناقة.',
            availableColors: ['مزيج ألوان ترابية (بيج وبني ورصاصي)', 'أوف وايت نقي', 'كافيه لاتيه'],
            availableSizes: ['قطر 12 سم (طقم 6 قطع + باكت)'],
            isActive: true,
            createdAt: Date.now() - 700000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
        ];

        // 1. Fetch approved products from cloud marketplace
        const cloudApproved = await fetchApprovedMarketplaceProducts().catch(() => []);
        const cloudMapped: SavedProductRecord[] = cloudApproved.map((cp) => ({
          id: cp.id,
          productName: cp.product_name,
          category: cp.category as any,
          craftName: cp.craft_name,
          decorCategory: cp.decor_category as any,
          retailPrice: cp.retail_price,
          storePrice: cp.store_price,
          wholesalePrice: cp.wholesale_price,
          costPrice: cp.cost_price,
          currentStock: cp.current_stock,
          inStore: true,
          isPublishedInStore: true,
          isMarketplaceApproved: true,
          imageUrl: cp.image_url,
          storeDescription: cp.store_description,
          availableColors: cp.available_colors,
          availableSizes: cp.available_sizes,
          isActive: true,
          createdAt: typeof cp.created_at === 'number' ? cp.created_at : Date.now(),
          updatedAt: typeof cp.updated_at === 'number' ? cp.updated_at : Date.now(),
          input: {} as any,
          output: {} as any,
        }));

        // 2. Combine approved cloud products, approved local workshop products, and samples
        const publishedLocal = localProds.filter((p: SavedProductRecord) => p.inStore && p.isMarketplaceApproved !== false);
        const combined = [...cloudMapped, ...publishedLocal, ...sampleProducts];
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
    return () => {
      isMounted = false;
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

  // Add to persistent cart
  const handleAddToCart = (product: SavedProductRecord) => {
    const item: MarketplaceCartItem = {
      id: 'cart_' + Date.now(),
      productId: product.id,
      productName: product.productName,
      price: product.storePrice || product.retailPrice || 0,
      quantity: modalQuantity,
      imageUrl: product.imageUrl,
      craftName: product.craftName,
      workshopId: product.workshopId || product.tenantId || 'central',
      artistName: (product as any).artistName || 'فنان الشمساوية',
      selectedColor: modalSelectedColor,
      selectedSize: modalSelectedSize,
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
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
          {/* Back & Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onNavigateHome}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
              title="العودة للورشة"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">العودة للورشة</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black shadow-md shrink-0">
                🛍️
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-1.5 truncate">
                  <span>سوق الشمساوية المركزي</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 hidden md:inline-block">
                    ضمان الشمس كرافت 🛡️
                  </span>
                </h1>
                <p className="text-[10px] text-[#EADBC8] truncate hidden sm:block">
                  ملتقى أروع المشغولات اليدوية والديكور من ورش وفناني مصر
                </p>
              </div>
            </div>
          </div>

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

      {/* 2. Brand Identity & Quality Guarantee Hero Banner */}
      <div className="px-4 pt-6 pb-4 max-w-7xl mx-auto space-y-4">
        {/* Quality Banner Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#0C1427] via-[#142347] to-[#0C1427] border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>فحص يدوي متخصص وضمان جودة الفنش الرفيع</span>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight">
              سوق الشمساوية المركزي للديكور والهاند ميد 🦅✨
            </h2>

            {/* Exact Required Brand Assurance Text */}
            <p className="text-xs sm:text-sm text-[#EADBC8] leading-relaxed font-medium">
              "سوق الشمساوية بيتم فيه انتقاء الفنانين على أعلى مستوى وكفاءة.. وأي قطعة بتقتنيها بيتم فحصها ومراجعتها يدوياً من متخصصين لضمان أعلى جودة وفنش قبل ما تخرج لك، وعلشان كده بتستلم قطعتك بضمان رسمي من شركة الشمس كرافت ✨"
            </p>

            {/* Support and Trust Contact */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-stone-300">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>شحن وتوصيل لجميع محافظات مصر</span>
              </div>
              <span className="text-stone-500">•</span>
              <a
                href={`https://wa.me/20${OFFICIAL_SUPPORT_PHONE}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold underline"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>الدعم الفني وخدمة العملاء: {OFFICIAL_SUPPORT_PHONE}</span>
              </a>
            </div>
          </div>
        </div>

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

                  {/* Card Footer */}
                  <div className="p-4 pt-2 border-t border-amber-500/20 flex items-center justify-between">
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ضمان الفنش 🛡️</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProductDetails(p);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-md transition cursor-pointer"
                    >
                      <span>تحديد وتفاصيل</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
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
    </div>
  );
};
