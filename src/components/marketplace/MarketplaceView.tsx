import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, SavedProductRecord, CraftCategory } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  ShoppingBag,
  Store,
  Star,
  Search,
  Filter,
  Layers,
  Sparkles,
  Phone,
  MessageCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Truck,
  Heart,
  Share2,
} from 'lucide-react';

interface MarketplaceViewProps {
  profile?: UserProfile | null;
  onNavigateHome: () => void;
  onOpenStoreModal?: () => void;
}

interface ProductReview {
  id: string;
  authorName: string;
  rating: number; // 1 - 5
  comment: string;
  date: string;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  profile,
  onNavigateHome,
  onOpenStoreModal,
}) => {
  const [products, setProducts] = useState<SavedProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCraft, setSelectedCraft] = useState<string>('all');
  const [selectedProductDetails, setSelectedProductDetails] = useState<SavedProductRecord | null>(null);

  // Review submission state
  const [newReviewAuthor, setNewReviewAuthor] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [reviewsMap, setReviewsMap] = useState<Record<string, ProductReview[]>>({});
  const [feedback, setFeedback] = useState('');

  const craftsList = [
    { id: 'all', nameAr: 'كافة الحرف اليدوية (الكل)', icon: '🌟' },
    { id: 'macrame', nameAr: 'المكرمية والعقد اليدوي', icon: '🪢' },
    { id: 'palm_wicker', nameAr: 'الخوص والمشغولات النخيلية', icon: '🧺' },
    { id: 'pottery', nameAr: 'الفخار والخزف والصلصال', icon: '🏺' },
    { id: 'crochet', nameAr: 'الكروشيه والتريكو والنسيج', icon: '🧶' },
    { id: 'leather', nameAr: 'الجلود الطبيعية الحرفية', icon: '👜' },
    { id: 'resin', nameAr: 'الريزن والأشغال الفنية', icon: '✨' },
    { id: 'copper_metal', nameAr: 'النحاس والمعادن والأرابيسك', icon: '🪙' },
  ];

  useEffect(() => {
    let isMounted = true;
    const fetchMarketplace = async () => {
      setLoading(true);
      try {
        const tenantId = profile?.tenantId || profile?.workshopId || profile?.id || 'public';
        const localProds = await tenantStorage.getProducts(tenantId);

        // Seed sample craft products if empty so marketplace is rich and beautiful
        const sampleProducts: SavedProductRecord[] = [
          {
            id: 'mkt_macrame_1',
            productName: 'طقم بوكسات مكرمية كلاسيك (3 قطع) بقاعدة خشب',
            category: 'macrame',
            retailPrice: 420,
            wholesalePrice: 320,
            costPrice: 210,
            currentStock: 4,
            inStore: true,
            isPublishedInStore: true,
            imageUrl: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=600&q=80',
            craftName: 'المكرمية',
            storeDescription: 'طقم أوعية وبوكسات ديكور من حبال القطن المصري المعالج ثلاثية الجدائل، مثبت على قاعدة خشبية طبيعية ليزر.',
            isActive: true,
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_pottery_1',
            productName: 'طقم فازات فخار خزفي مطفي بتصميم نوبي أصيل',
            category: 'pottery',
            retailPrice: 350,
            wholesalePrice: 260,
            costPrice: 160,
            currentStock: 0,
            inStore: true,
            isPublishedInStore: true,
            imageUrl: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=600&q=80',
            craftName: 'الفخار والخزف',
            storeDescription: 'مشغولة من طمي أسواني عالي النقاوة، تم حرقها في أفران حرارية بدرجة 1050 مئوية ومعالجة بمادة مانعة لتسرب المياه.',
            isActive: true,
            createdAt: Date.now() - 172800000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_crochet_1',
            productName: 'كوشن كروشيه بوهيمي غرزة الضفائر المفرغة',
            category: 'crochet',
            retailPrice: 280,
            wholesalePrice: 210,
            costPrice: 130,
            currentStock: 7,
            inStore: true,
            isPublishedInStore: true,
            imageUrl: 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?auto=format&fit=crop&w=600&q=80',
            craftName: 'الكروشيه',
            storeDescription: 'غطاء وسادة كروشيه من خيوط الكليم والقطن الناعم مع سوستة مخفية وبطانة داخلية من القماش المعالج.',
            isActive: true,
            createdAt: Date.now() - 250000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
          {
            id: 'mkt_leather_1',
            productName: 'محفظة يد جلد بقري طبيعي هاند ميد مخيطة يدوي',
            category: 'leather',
            retailPrice: 480,
            wholesalePrice: 380,
            costPrice: 230,
            currentStock: 2,
            inStore: true,
            isPublishedInStore: true,
            imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
            craftName: 'الجلود الطبيعية',
            storeDescription: 'جلد طبيعي مدبوغ نباتياً (فاكيتا)، مخيطة بخيط مشمع ألماني يدوي مع جيوب متعددة للبطاقات والنقود.',
            isActive: true,
            createdAt: Date.now() - 350000000,
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          },
        ];

        // Combine local workshop products with samples
        const combined = [...localProds.filter((p) => p.inStore), ...sampleProducts];
        // Deduplicate
        const unique = Array.from(new Map(combined.map((p) => [p.id, p])).values());

        if (isMounted) {
          setProducts(unique);
          // Initial sample reviews
          setReviewsMap({
            mkt_macrame_1: [
              {
                id: 'rev_1',
                authorName: 'مريم الجندي (القاهرة)',
                rating: 5,
                comment: 'شغل متقن جداً وغرزة مشدودة ونظيفة، والقاعدة الخشب ممتازة وخامة الحبال نظيفة جداً.. تسلم إيدين الفنان!',
                date: 'منذ يومين',
              },
            ],
            mkt_pottery_1: [
              {
                id: 'rev_2',
                authorName: 'د. خالد رضوان (الإسكندرية)',
                rating: 5,
                comment: 'تحفة معمارية وفنية على أرض الواقع، التغليف كان ممتاز ووصلت بدون أي خدش.',
                date: 'منذ 4 أيام',
              },
            ],
          });
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

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.storeDescription || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.craftName || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchCraft =
        selectedCraft === 'all' ||
        p.category === selectedCraft ||
        (p.craftName || '').includes(selectedCraft);

      return matchSearch && matchCraft;
    });
  }, [products, searchQuery, selectedCraft]);

  const handleAddReview = (productId: string) => {
    if (!newReviewAuthor.trim() || !newReviewComment.trim()) return;

    const newRev: ProductReview = {
      id: 'rev_' + Date.now(),
      authorName: newReviewAuthor.trim(),
      rating: newReviewRating,
      comment: newReviewComment.trim(),
      date: 'الآن',
    };

    setReviewsMap((prev) => ({
      ...prev,
      [productId]: [newRev, ...(prev[productId] || [])],
    }));

    setNewReviewAuthor('');
    setNewReviewComment('');
    setFeedback('✓ شكراً لتقييمك الراقي، تم نشر رأيك في المشغولة لدعم الفنان!');
    setTimeout(() => setFeedback(''), 4000);
  };

  return (
    <div className="min-h-screen bg-[#080F1E] text-white font-sans pb-16" dir="rtl">
      {/* Top Marketplace Bar */}
      <header className="sticky top-0 z-40 bg-[#0C1427]/95 backdrop-blur-md border-b border-amber-500/30 px-4 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للورشة</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black shadow-md">
                🛍️
              </div>
              <div>
                <h1 className="text-base font-black text-amber-300 flex items-center gap-2">
                  <span>سوق الشمساوية المركزي</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    متعدد التجار
                  </span>
                </h1>
                <p className="text-[10px] text-[#EADBC8]">
                  ملتقى أروع المشغولات اليدوية والديكور من ورش وفناني مصر
                </p>
              </div>
            </div>
          </div>

          {onOpenStoreModal && (
            <button
              type="button"
              onClick={onOpenStoreModal}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>متجري وإدارته 🏪</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero Banner */}
      <div className="px-4 py-8 max-w-7xl mx-auto text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>كل قطعة تحكي حكاية صبر وأصالة مصرية</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          اكتشف إبداعات حِرفيي الشمساوية بأسعار عادلة ومضمونة 🦅✨
        </h2>
        <p className="text-xs sm:text-sm text-[#EADBC8] max-w-2xl mx-auto">
          تسوق مباشرة من أيدي الصناع دون وسيط، مع إمكانية تصنيع أي قطعة مخصصة بأبعاد وألوان ديكور منزلك.
        </p>

        {/* Search Input */}
        <div className="max-w-xl mx-auto pt-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مشغولة، طقم بوكسات، فازة، كوشن، أو حرفة..."
              className="w-full px-4 py-3 pr-11 rounded-2xl bg-[#0C1427] border-2 border-amber-500/40 text-white placeholder-stone-400 text-xs sm:text-sm font-bold outline-none focus:border-amber-400 shadow-xl"
            />
            <Search className="w-5 h-5 text-amber-400 absolute right-3.5 top-3.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-3 text-xs text-stone-400 hover:text-white font-bold"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Craft Filters Horizontal Bar */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {craftsList.map((craft) => (
            <button
              key={craft.id}
              type="button"
              onClick={() => setSelectedCraft(craft.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition flex items-center gap-2 cursor-pointer shadow-md ${
                selectedCraft === craft.id
                  ? 'bg-amber-600 text-white border-2 border-amber-400'
                  : 'bg-[#0C1427] text-stone-300 hover:text-white border border-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              <span>{craft.icon}</span>
              <span>{craft.nameAr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="max-w-xl mx-auto px-4 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold text-center">
            {feedback}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-amber-200 font-bold">جاري تحميل مشغولات سوق الشمساوية...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center rounded-3xl bg-[#0C1427] border border-amber-500/20 space-y-3">
            <ShoppingBag className="w-12 h-12 mx-auto text-amber-500/50" />
            <h3 className="text-sm font-black text-amber-200">لم نجد مشغولات مطابقة للبحث</h3>
            <p className="text-xs text-[#EADBC8]">
              جرب تغيير كلمات البحث أو اختيار تصنيف حرفة مختلف.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((p) => {
              const hasStock = (p.currentStock || 0) > 0;
              const price = p.storePrice || p.retailPrice || 0;
              const reviews = reviewsMap[p.id] || [];
              const avgRating = reviews.length > 0
                ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
                : '5.0';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProductDetails(p)}
                  className="rounded-3xl bg-[#0C1427] border border-amber-500/30 overflow-hidden hover:border-amber-400 transition-all duration-300 shadow-xl flex flex-col justify-between cursor-pointer group hover:-translate-y-1 artisan-card-hover"
                >
                  <div>
                    {/* Image Area */}
                    <div className="relative w-full h-52 bg-[#080F1E] overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.productName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-amber-500/40">
                          <ShoppingBag className="w-12 h-12 mb-1" />
                          <span className="text-xs">مشغولة يدوية</span>
                        </div>
                      )}

                      {/* Stock badge */}
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

                      {/* Price Tag */}
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="px-3 py-1 rounded-xl bg-[#080F1E]/90 text-amber-300 font-mono font-black text-sm border border-amber-500/40 shadow-md">
                          {price} {profile?.currencySymbol || 'ج.م'}
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
                    <span className="text-[11px] text-stone-400">
                      ضمان جودة الشمساوية 🛡️
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProductDetails(p);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-md transition cursor-pointer"
                    >
                      <span>عرض وتفاصيل</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Product Details & Reviews Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C1427] border-2 border-amber-500/50 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto text-right shadow-2xl p-5 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
              <h3 className="font-black text-base sm:text-lg text-amber-300">
                {selectedProductDetails.productName}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedProductDetails(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 flex items-center justify-center"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Product Body */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Image */}
              <div className="w-full h-64 rounded-2xl overflow-hidden bg-black/40 border border-amber-500/30">
                {selectedProductDetails.imageUrl ? (
                  <img src={selectedProductDetails.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-400/50">
                    <ShoppingBag className="w-12 h-12" />
                  </div>
                )}
              </div>

              {/* Specs & Pricing */}
              <div className="space-y-3 text-xs leading-relaxed">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#080F1E] border border-amber-500/30">
                  <span className="text-stone-300 font-bold">سعر البيع:</span>
                  <span className="font-mono text-lg font-black text-amber-300">
                    {selectedProductDetails.storePrice || selectedProductDetails.retailPrice || 0} {profile?.currencySymbol || 'ج.م'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#080F1E] border border-amber-500/30 space-y-1">
                  <span className="text-amber-400 font-bold block mb-1">وصف ومواصفات المشغولة:</span>
                  <p className="text-[#EADBC8]">
                    {selectedProductDetails.storeDescription || selectedProductDetails.input?.personalNotes || 'قطعة هاند ميد راقية مصنوعة بخامات أصلية وبأيدي فنانين مصريين محترفين.'}
                  </p>
                </div>

                {/* Direct Order Actions */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `أهلاً بحضرتك! أرغب في طلب مشغولة "${selectedProductDetails.productName}" المعروضة بسعر ${selectedProductDetails.storePrice || selectedProductDetails.retailPrice} ج.م عبر سوق الشمساوية 🛍️`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>طلب المشغولة الآن عبر واتساب 📲</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="border-t border-amber-500/30 pt-4 space-y-4">
              <h4 className="font-black text-sm text-amber-300 flex items-center gap-2">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>تقييمات وآراء المشترين في هذه المشغولة</span>
              </h4>

              {/* Reviews List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(reviewsMap[selectedProductDetails.id] || []).length === 0 ? (
                  <p className="text-xs text-stone-400">كن أول من يكتب تقييماً ومراجعة لهذه المشغولة المميزة!</p>
                ) : (
                  (reviewsMap[selectedProductDetails.id] || []).map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-[#080F1E] border border-amber-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{rev.authorName}</span>
                        <div className="flex items-center gap-1 text-amber-400">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[#EADBC8]">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Review Box */}
              <div className="p-3 rounded-2xl bg-[#080F1E] border border-amber-500/30 space-y-2">
                <span className="font-bold text-xs text-amber-300 block">أضف تقييمك للمشغولة:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={newReviewAuthor}
                    onChange={(e) => setNewReviewAuthor(e.target.value)}
                    placeholder="اسمك الكريم والمدينة..."
                    className="px-3 py-2 rounded-xl bg-[#0C1427] border border-amber-500/40 text-white outline-none font-bold"
                  />
                  <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#0C1427] border border-amber-500/40">
                    <span className="text-stone-300 text-xs">التقييم:</span>
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
                  placeholder="رأيك في جودة الخامات والتفنيش والتغليف..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#0C1427] border border-amber-500/40 text-white outline-none font-medium text-xs resize-none"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleAddReview(selectedProductDetails.id)}
                    className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                  >
                    نشر التقييم ✨
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
