import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  Share2,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Store,
  Table2,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  SUPPLIER_SUPPLY_SECTIONS,
  SupplierCatalogItem,
  SupplierProfile,
} from '../../types/supplier';
import { MemberPersonalProfile } from '../../types/memberProfile';
import {
  fetchPublicSupplierStore,
  placeB2BSupplyOrder,
} from '../../db/supplierService';
import { MemberPersonalProfileView } from '../profile/MemberPersonalProfileView';
import { playButtonClickSound, playErrorSound, playSuccessSound } from '../../lib/sounds';

interface SupplierPublicStoreViewProps {
  slug: string;
  profile?: UserProfile | null;
  onNavigateToSuppliersMarket: () => void;
  onNavigateToCentralMarket: () => void;
  onNavigateToApp?: () => void;
}

interface CartLine {
  item: SupplierCatalogItem;
  quantity: number;
}

function calcPrice(item: SupplierCatalogItem, qty: number) {
  const isWholesale = item.wholesalePrice > 0 && qty >= Math.max(1, item.minWholesaleQty || 1);
  let unitPrice = isWholesale ? item.wholesalePrice : item.retailPrice;
  if (item.discountType === 'percent' && item.discountValue > 0 && item.discountValue <= 100) {
    unitPrice = Math.max(0, Number((unitPrice * (1 - item.discountValue / 100)).toFixed(2)));
  } else if (item.discountType === 'fixed' && item.discountValue > 0) {
    unitPrice = Math.max(0, Number((unitPrice - item.discountValue).toFixed(2)));
  }
  return {
    unitPrice,
    isWholesale,
    lineTotal: Number((unitPrice * qty).toFixed(2)),
  };
}

export const SupplierPublicStoreView: React.FC<SupplierPublicStoreViewProps> = ({
  slug,
  profile,
  onNavigateToSuppliersMarket,
  onNavigateToCentralMarket,
  onNavigateToApp,
}) => {
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberPersonalProfile | null>(null);
  const [items, setItems] = useState<SupplierCatalogItem[]>([]);
  const [suspendedMsg, setSuspendedMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'price_table'>('catalog');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState(profile?.phoneNumber || '');
  const [buyerName, setBuyerName] = useState(profile?.artistName || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const hasAuthSession = Boolean(profile && profile.id);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await fetchPublicSupplierStore(slug);
      if (!mounted) return;
      if (!res || !res.supplier) {
        setSupplier(null);
        setMemberProfile(null);
        setItems([]);
        setSuspendedMsg(null);
      } else if (res.suspended) {
        setSupplier(res.supplier);
        setMemberProfile(null);
        setItems([]);
        setSuspendedMsg(res.suspensionReason || 'متجر المورد غير متاح للعرض حالياً.');
      } else {
        setSupplier(res.supplier);
        setMemberProfile(res.memberProfile || null);
        setItems(res.items);
        setSuspendedMsg(null);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const addToCart = (item: SupplierCatalogItem, qty = 1) => {
    playButtonClickSound();
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { item, quantity: qty }];
    });
    setToast(`تم إضافة "${item.name}" للسلة`);
    setTimeout(() => setToast(null), 2500);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, line) => sum + calcPrice(line.item, line.quantity).lineTotal, 0);
  }, [cart]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || cart.length === 0) return;

    if (!hasAuthSession) {
      const digits = String(supplier.phone || '').replace(/\D/g, '');
      const waPhone = digits.startsWith('0') ? `2${digits}` : digits;
      const lines = cart
        .map((c) => {
          const pr = calcPrice(c.item, c.quantity);
          return `- ${c.item.name} × ${c.quantity} ${c.item.unit} (${pr.lineTotal} ${supplier.currencySymbol})`;
        })
        .join('\n');
      const msg = `مرحباً "${supplier.brandName}"، أرغب في طلب الخامات التالية:\n${lines}\nالإجمالي: ${cartTotal} ${supplier.currencySymbol}\nالاسم: ${buyerName}\nالهاتف: ${buyerPhone}\n${notes}`;
      if (waPhone) {
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      }
      setToast('تم تجهيز تفاصيل الطلب عبر الواتساب!');
      setCart([]);
      setIsCartOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const wid = profile?.workshopId || profile?.tenantId || profile?.id || '';
      const res = await placeB2BSupplyOrder({
        supplierId: supplier.id,
        workshopId: wid,
        orderSource: 'direct_supplier_store',
        items: cart.map((c) => ({
          catalogItemId: c.item.id,
          name: c.item.name,
          unit: c.item.unit,
          quantity: c.quantity,
          retailPrice: c.item.retailPrice,
          wholesalePrice: c.item.wholesalePrice,
          minWholesaleQty: c.item.minWholesaleQty,
          discountType: c.item.discountType,
          discountValue: c.item.discountValue,
        })),
        notes: notes.trim(),
        buyerInfo: {
          workshopBrand: profile?.brandName || 'ورشة بالمنظومة',
          name: buyerName.trim() || profile?.artistName || 'فنان',
          phone: buyerPhone.trim() || profile?.phoneNumber || '',
          country: profile?.country || 'مصر',
        },
      });
      if (res.success) {
        playSuccessSound();
        setCart([]);
        setNotes('');
        setIsCartOpen(false);
        setToast(`تم إرسال طلبك المباشر إلى "${supplier.brandName}" بنجاح!`);
      } else {
        playErrorSound();
        setToast(res.error || 'تعذر إرسال الطلب');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2ECE1] dark:bg-[#060B18]" dir="rtl">
        <div className="w-10 h-10 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!supplier || suspendedMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2ECE1] dark:bg-[#060B18] p-4" dir="rtl">
        <div className="max-w-md w-full rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black">
            {supplier ? supplier.brandName : 'متجر المورد غير متاح'}
          </h2>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
            {suspendedMsg || 'لم يتم العثور على هذا المتجر أو تم نقله.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onNavigateToSuppliersMarket}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
            >
              تصفح سوق الموردين
            </button>
            <button
              type="button"
              onClick={onNavigateToCentralMarket}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black cursor-pointer"
            >
              سوق الشمساوية
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sectionNames = supplier.supplySections
    .map((id) => SUPPLIER_SUPPLY_SECTIONS.find((s) => s.id === id)?.titleAr)
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] pb-20" dir="rtl">
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-black shadow-xl">
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-30 bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 backdrop-blur-md border-b border-[#D4CCBC] dark:border-[#22355E] px-3 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={hasAuthSession && onNavigateToApp ? onNavigateToApp : onNavigateToSuppliersMarket}
              className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>{hasAuthSession ? 'رجوع' : 'سوق الموردين'}</span>
            </button>
            <img
              src={supplier.logoUrl || '/alshams_falcon_emblem.png'}
              alt={supplier.brandName}
              className="w-10 h-10 rounded-xl object-contain bg-[#EFE9DC] dark:bg-[#132040] p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black truncate">{supplier.brandName}</h1>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] truncate">
                {supplier.governorate || supplier.country} · {sectionNames.join('، ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-[#EA580C]" />
              <span className="hidden sm:inline">الصفحة الشخصية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-[#EA580C]" />}
              <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'مشاركة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>السلة</span>
              {cart.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#0C1427] text-[#FBBF24] font-mono text-[10px]">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 space-y-5">
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'catalog'
                  ? 'bg-[#0C1427] text-[#F7F3EA] dark:bg-[#F7F3EA] dark:text-[#0C1427]'
                  : 'bg-[#EFE9DC] dark:bg-[#132040]'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>كتالوج الخامات ({items.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('price_table')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'price_table'
                  ? 'bg-[#0C1427] text-[#F7F3EA] dark:bg-[#F7F3EA] dark:text-[#0C1427]'
                  : 'bg-[#EFE9DC] dark:bg-[#132040]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>جدول الأسعار الكامل (قطاعي / جملة)</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في أصناف المورد..."
              className="w-full h-9 pr-9 pl-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
          </div>
        </div>

        {activeTab === 'price_table' ? (
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E]">
                <tr>
                  <th className="p-3 font-black">الخامة</th>
                  <th className="p-3 font-black">الوحدة</th>
                  <th className="p-3 font-black">سعر القطاعي</th>
                  <th className="p-3 font-black">سعر الجملة</th>
                  <th className="p-3 font-black">حد الجملة</th>
                  <th className="p-3 font-black">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                {filteredItems.map((it) => (
                  <tr key={it.id}>
                    <td className="p-3 font-black">{it.name}</td>
                    <td className="p-3">{it.unit}</td>
                    <td className="p-3 font-mono tabular-nums font-bold">
                      {it.retailPrice.toLocaleString('ar-EG')} {supplier.currencySymbol}
                    </td>
                    <td className="p-3 font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-400">
                      {it.wholesalePrice > 0
                        ? `${it.wholesalePrice.toLocaleString('ar-EG')} ${supplier.currencySymbol}`
                        : '—'}
                    </td>
                    <td className="p-3 font-mono tabular-nums">
                      {it.wholesalePrice > 0 ? `${it.minWholesaleQty} ${it.unit}` : '—'}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => addToCart(it, 1)}
                        className="px-3 py-1 rounded-lg bg-[#EA580C] text-white text-[11px] font-black cursor-pointer"
                      >
                        + للسلة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((it) => (
              <article
                key={it.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <img
                    src={it.images?.[0] || '/alshams_falcon_emblem.png'}
                    alt={it.name}
                    className="w-full aspect-[4/3] object-cover border-b border-[#D4CCBC] dark:border-[#22355E]"
                  />
                  <div className="p-4 space-y-2">
                    <h3 className="text-sm font-black">{it.name}</h3>
                    {it.description && (
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] line-clamp-2">{it.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-xs pt-1">
                      <div className="p-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                        <span className="block text-[10px] font-sans text-[#475569]">القطاعي</span>
                        <span className="font-black">
                          {it.retailPrice.toLocaleString('ar-EG')} {supplier.currencySymbol}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                        <span className="block text-[10px] font-sans text-emerald-700">جملة (×{it.minWholesaleQty})</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-400">
                          {it.wholesalePrice > 0
                            ? `${it.wholesalePrice.toLocaleString('ar-EG')} ${supplier.currencySymbol}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => addToCart(it, 1)}
                    className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة للسلة</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Synced Supplier Story & Showcase Gallery (Max 6) */}
        {(Boolean((memberProfile?.storyText || supplier.storeConfig?.description || '').trim()) ||
          (memberProfile?.showcasePosts && memberProfile.showcasePosts.length > 0)) && (
          <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4CCBC]/70 dark:border-[#22355E] pb-2.5">
              <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                نبذة عن المورد ومعرض التوريدات المميزة
              </h2>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="text-xs font-black text-[#C2410C] dark:text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>عرض الصفحة الشخصية</span>
              </button>
            </div>

            {(memberProfile?.storyText || supplier.storeConfig?.description) && (
              <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                {memberProfile?.storyText || supplier.storeConfig?.description}
              </p>
            )}

            {memberProfile?.showcasePosts && memberProfile.showcasePosts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {memberProfile.showcasePosts.slice(0, 6).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="group text-right rounded-2xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden hover:border-[#EA580C] transition cursor-pointer flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full bg-[#E9E2D4] dark:bg-[#060B18] overflow-hidden">
                      <img
                        src={post.imageUrl}
                        alt={post.caption || 'صورة من معرض المورد'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                    {post.caption && (
                      <p className="p-2.5 text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] line-clamp-2">
                        {post.caption}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex justify-end"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCartOpen(false);
          }}
        >
          <div className="w-full max-w-md h-full bg-[#F7F3EA] dark:bg-[#0D162E] border-r border-[#D4CCBC] dark:border-[#22355E] flex flex-col">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <h2 className="text-sm font-black">سلة المشتريات من {supplier.brandName}</h2>
              <button type="button" onClick={() => setIsCartOpen(false)} className="p-1.5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((line) => {
                const pr = calcPrice(line.item, line.quantity);
                return (
                  <div key={line.item.id} className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{line.item.name}</span>
                      <button
                        type="button"
                        onClick={() => setCart((p) => p.filter((c) => c.item.id !== line.item.id))}
                        className="text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span>
                        {pr.unitPrice} × {line.quantity} ({pr.isWholesale ? 'جملة' : 'قطاعي'})
                      </span>
                      <span className="font-black">
                        {pr.lineTotal.toLocaleString('ar-EG')} {supplier.currencySymbol}
                      </span>
                    </div>
                  </div>
                );
              })}

              {cart.length > 0 && (
                <form id="sup-store-checkout" onSubmit={handleCheckout} className="space-y-2 pt-2">
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="الاسم أو اسم الورشة *"
                    className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <input
                    type="text"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="رقم الهاتف / واتساب *"
                    className="w-full h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات إضافية..."
                    className="w-full p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </form>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-2">
                <div className="flex justify-between text-sm font-black">
                  <span>الإجمالي:</span>
                  <span className="font-mono tabular-nums text-[#EA580C]">
                    {cartTotal.toLocaleString('ar-EG')} {supplier.currencySymbol}
                  </span>
                </div>
                <button
                  type="submit"
                  form="sup-store-checkout"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                >
                  {hasAuthSession ? 'إرسال طلب التوريد للورشة' : 'إرسال الطلب عبر الواتساب'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isProfileModalOpen && supplier?.id && (
        <MemberPersonalProfileView
          mode="modal"
          targetMemberId={supplier.id}
          currentUserProfile={profile || null}
          onClose={() => setIsProfileModalOpen(false)}
          onOpenStore={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
};
