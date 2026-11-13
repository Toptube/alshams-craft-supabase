import React, { useState, useMemo } from 'react';
import {
  MarketplaceCartItem,
  CustomerAuthUser,
  InvoiceRecord,
} from '../../types';
import {
  getStoredCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  calculateShippingRate,
  OFFICIAL_PAYMENT_PHONE,
  OFFICIAL_SUPPORT_PHONE,
  ADVANCE_PAYMENT_MIN_RATIO,
  saveCentralMarketplaceOrder,
  getStoredCustomerSession,
  syncPlatformSettingsFromCloud,
  getClientPrivacyActive,
} from '../../services/marketplaceCartService';
import { playSuccessSound, playAlertSound } from '../../lib/sounds';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Tag,
  CreditCard,
  Truck,
  ArrowRight,
  Phone,
  User,
  MapPin,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface MarketplaceCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerUser: CustomerAuthUser | null;
  onOpenCustomerAuth: () => void;
  onOrderSuccess: (order: InvoiceRecord) => void;
}

export const MarketplaceCartModal: React.FC<MarketplaceCartModalProps> = ({
  isOpen,
  onClose,
  customerUser,
  onOpenCustomerAuth,
  onOrderSuccess,
}) => {
  const [cartItems, setCartItems] = useState<MarketplaceCartItem[]>(() => {
    try {
      return (getStoredCart() || []).filter((i: any) => i && typeof i === 'object');
    } catch {
      return [];
    }
  });
  const [governorate, setGovernorate] = useState<string>(customerUser?.governorate || 'القاهرة');
  const [couponCode, setCouponCode] = useState<string>(customerUser ? 'SHAMS5' : '');
  const [isCouponApplied, setIsCouponApplied] = useState<boolean>(!!customerUser);
  const [couponError, setCouponError] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'vodafone_cash' | 'instapay'>('instapay');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);

  // Guest fields (if customer not logged in)
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAltPhone, setGuestAltPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [guestAltAddress, setGuestAltAddress] = useState('');

  // Form error
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<InvoiceRecord | null>(null);
  const [ratesVersion, setRatesVersion] = useState(0);

  // Sync state whenever opened
  React.useEffect(() => {
    if (isOpen) {
      syncPlatformSettingsFromCloud().then(() => setRatesVersion((v) => v + 1)).catch(() => {});
      try {
        const rawItems = getStoredCart() || [];
        const safeItems = Array.isArray(rawItems)
          ? rawItems.filter((i: any) => i && typeof i === 'object')
          : [];
        setCartItems(safeItems);
        const cust = customerUser || getStoredCustomerSession();
        if (cust) {
          setGovernorate(cust.governorate || 'القاهرة');
          setIsCouponApplied(true);
          setCouponCode('SHAMS5');
        }
      } catch (err) {
        console.warn('Error reading cart on open:', err);
        setCartItems([]);
      }
    }
  }, [isOpen, customerUser]);

  if (!isOpen) return null;

  // Subtotal (Safe reduce with fallback checks)
  const subtotal = useMemo(() => {
    if (!Array.isArray(cartItems)) return 0;
    return cartItems.reduce((acc, item: any) => {
      const price = Number(item?.price ?? item?.storePrice ?? item?.store_price ?? item?.retailPrice ?? item?.retail_price ?? 0);
      const qty = Math.max(1, Number(item?.quantity) || 1);
      return acc + (isNaN(price) ? 0 : price * qty);
    }, 0);
  }, [cartItems]);

  // Shipping
  const shippingCost = useMemo(() => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) return 0;
    return calculateShippingRate(governorate || 'القاهرة');
  }, [governorate, cartItems, ratesVersion]);

  // Discount
  const discountAmount = useMemo(() => {
    if (isCouponApplied && subtotal > 0) {
      return Math.round(subtotal * 0.05); // 5%
    }
    return 0;
  }, [isCouponApplied, subtotal]);

  // Final Total
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingCost);

  // 33% Advance Contractual Payment
  const advancePaymentAmount = Math.round(finalTotal * ADVANCE_PAYMENT_MIN_RATIO);
  const remainingAtDelivery = Math.max(0, finalTotal - advancePaymentAmount);

  const handleUpdateQty = (itemId: string, delta: number) => {
    const item = cartItems.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    const updated = updateCartItemQuantity(itemId, newQty);
    setCartItems(updated);
  };

  const handleRemoveItem = (itemId: string) => {
    const updated = removeCartItem(itemId);
    setCartItems(updated);
  };

  const handleClearAll = () => {
    clearCart();
    setCartItems([]);
  };

  const handleApplyCoupon = () => {
    setCouponError('');
    if (couponCode.trim().toUpperCase() === 'SHAMS5') {
      if (!customerUser) {
        setCouponError('كود الخصم مخصص للعملاء المسجلين، سجّل حسابك للاستفادة به!');
        return;
      }
      setIsCouponApplied(true);
      playSuccessSound();
    } else {
      setCouponError('كود الخصم غير صحيح أو منتهي الصلاحية.');
    }
  };

  const handleCopyPaymentPhone = () => {
    navigator.clipboard.writeText(OFFICIAL_PAYMENT_PHONE);
    setCopiedNumber(true);
    playSuccessSound();
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (cartItems.length === 0) {
      setFormError('سلة المشتريات فارغة، يرجى إضافة قطع للسلة أولاً.');
      return;
    }

    const clientName = customerUser?.name || guestName.trim();
    const clientPhone = customerUser?.phone || guestPhone.trim();
    const clientAltPhone = customerUser?.alternatePhone || guestAltPhone.trim();
    const clientAddress = customerUser?.detailedAddress || guestAddress.trim();
    const clientAltAddress = customerUser?.alternateAddress || guestAltAddress.trim();

    if (!clientName) {
      setFormError('يرجى إدخال اسم المستلم بالكامل.');
      return;
    }
    if (!clientPhone || clientPhone.length < 10) {
      setFormError('يرجى إدخال رقم هاتف صحيح لضمان سرعة التواصل والتسليم.');
      return;
    }
    if (!clientAddress) {
      setFormError('يرجى كتابة عنوان التوصيل بالتفصيل (المنطقة، الشارع، رقم العقار).');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderNum = 'SHAMS-' + Math.floor(10000 + Math.random() * 90000);
      const targetDays = 5; // standard handmade lead time
      const targetDate = new Date(Date.now() + targetDays * 864e5).toISOString().split('T')[0];

      const newOrder: InvoiceRecord = {
        id: 'ord_' + Date.now(),
        invoiceNumber: orderNum,
        customerName: clientName,
        customerPhone: clientPhone,
        alternatePhone: clientAltPhone || undefined,
        governorate,
        detailedAddress: clientAddress,
        alternateAddress: clientAltAddress || undefined,
        workshopId: cartItems[0]?.workshopId || 'central',
        tenantId: cartItems[0]?.workshopId || 'central',
        items: cartItems.map((ci) => ({
          id: ci.id,
          productId: ci.productId,
          productName: ci.productName,
          quantity: ci.quantity,
          unitPrice: ci.price,
          totalPrice: ci.price * ci.quantity,
          unit: 'قطعة',
          color: ci.selectedColor,
          size: ci.selectedSize,
          notes: ci.customNotes,
        })),
        subtotal,
        discount: discountAmount,
        couponApplied: isCouponApplied ? 'SHAMS5 (5%)' : undefined,
        shipping: shippingCost,
        shippingCost,
        finalTotal,
        totalAmount: finalTotal,
        advancePaymentAmount,
        remainingAmount: remainingAtDelivery,
        paidAmount: advancePaymentAmount,
        paymentMethod,
        advancePaymentMethod: paymentMethod,
        advancePaymentTransactionId: transactionRef.trim() || undefined,
        advancePaymentConfirmed: !!transactionRef.trim(),
        status: 'pending',
        marketplaceStatus: 'pending_approval',
        targetDeliveryDate: targetDate,
        productionDaysRemaining: targetDays,
        isClientDataHiddenFromArtisan: getClientPrivacyActive(),
        isGuest: !customerUser,
        loyaltyPointsEarned: Math.floor(finalTotal / 10),
        notes: cartItems.map((i) => i.customNotes).filter(Boolean).join(' | ') || undefined,
        date: new Date().toISOString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      saveCentralMarketplaceOrder(newOrder);
      clearCart();
      setCartItems([]);
      setSubmittedOrder(newOrder);
      playSuccessSound();
      onOrderSuccess(newOrder);
    } catch (err) {
      console.error('Order creation error:', err);
      setFormError('حدث خطأ أثناء حفظ الطلبية، يرجى المحاولة ثانية.');
      playAlertSound();
    } finally {
      setIsSubmitting(false);
    }
  };

  const governorates = [
    'القاهرة',
    'الجيزة',
    'الإسكندرية',
    'القليوبية',
    'المنوفية',
    'الغربية',
    'الدقهلية',
    'الشرقية',
    'كفر الشيخ',
    'البحيرة',
    'دمياط',
    'بورسعيد',
    'الإسماعيلية',
    'السويس',
    'الفيوم',
    'بني سويف',
    'المنيا',
    'أسيوط',
    'سوهاج',
    'قنا',
    'الأقصر',
    'أسوان',
    'البحر الأحمر',
    'جنوب سيناء',
    'شمال سيناء',
    'مطروح',
    'الوادي الجديد',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#060B18]/75 backdrop-blur-md animate-in fade-in" dir="rtl">
      <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#D4CCBC] dark:border-[#EA580C]/45 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto text-right shadow-2xl p-5 sm:p-6 space-y-5 text-[#0C1427] dark:text-[#F7F3EA] relative">
        {/* Close Button (✕) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#334155] dark:text-[#CBD5E1] flex items-center justify-center transition cursor-pointer"
          title="إغلاق السلة"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3 pl-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#E9E2D4] to-[#F5DFC6] dark:from-[#EA580C]/25 dark:to-[#F59E0B]/15 border border-[#EA580C]/35 text-[#C2410C] dark:text-amber-300 flex items-center justify-center shadow-md">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-[#0C1427] dark:text-amber-300">
                سلة مشترياتك في سوق الشمساوية
              </h3>
              <p className="text-xs text-[#334155] dark:text-[#CBD5E1]">
                {cartItems.length} قطعة مختارة بعناية ومضمونة من منظومة الشمساوية
              </p>
            </div>
          </div>

          {cartItems.length > 0 && !submittedOrder && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-rose-600 dark:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تفريغ السلة</span>
            </button>
          )}
        </div>

        {/* If Order Submitted Successfully */}
        {submittedOrder ? (
          <div className="p-6 rounded-3xl bg-gradient-to-b from-emerald-50 to-[#F2ECE1] dark:from-emerald-950/40 dark:to-[#060B18] border-2 border-emerald-400 dark:border-emerald-500/50 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto text-2xl shadow-xl">
              ✓
            </div>
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/40 text-xs font-mono font-bold">
                رقم الطلبية: #{submittedOrder.invoiceNumber}
              </span>
              <h4 className="text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] pt-1">
                تم تسجيل طلبيتك بنجاح بضمان منظومة الشمساوية! ✨
              </h4>
              <p className="text-xs text-[#334155] dark:text-[#CBD5E1] max-w-lg mx-auto leading-relaxed">
                شكراً لثقتك في فناني مصر.. فريق الجودة سيبدأ في فحص مواصفات طلبك وإرساله لخط التصنيع فور التحقق من دفعة الجدية.
              </p>
            </div>

            {/* Financial Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-right">
              <div>
                <span className="text-[#334155] dark:text-[#CBD5E1] block text-[11px]">إجمالي الفاتورة:</span>
                <span className="font-mono text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  {submittedOrder.finalTotal} ج.م
                </span>
              </div>
              <div className="sm:border-r sm:border-[#D4CCBC] dark:sm:border-[#22355E] sm:pr-3">
                <span className="text-[#C2410C] dark:text-amber-400 block text-[11px] font-bold">دفعة الجدية (33%):</span>
                <span className="font-mono text-base font-black text-[#EA580C] dark:text-amber-300">
                  {submittedOrder.advancePaymentAmount} ج.م
                </span>
              </div>
              <div className="sm:border-r sm:border-[#D4CCBC] dark:sm:border-[#22355E] sm:pr-3">
                <span className="text-emerald-700 dark:text-emerald-400 block text-[11px] font-bold">المتبقي عند الاستلام:</span>
                <span className="font-mono text-base font-black text-emerald-700 dark:text-emerald-300">
                  {submittedOrder.remainingAmount} ج.م
                </span>
              </div>
            </div>

            {/* Support Contact */}
            <div className="p-3.5 rounded-2xl bg-[#E9E2D4] dark:bg-amber-500/10 border border-[#D4CCBC] dark:border-amber-500/30 text-xs text-[#0C1427] dark:text-[#CBD5E1] space-y-2">
              <div className="flex items-center justify-center gap-2 text-[#C2410C] dark:text-amber-300 font-bold">
                <Phone className="w-4 h-4" />
                <span>واتساب خدمة العملاء والمتابعة: {OFFICIAL_SUPPORT_PHONE}</span>
              </div>
              <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                إذا قمت بالتحويل، يمكنك إرسال صورة الإيصال عبر الواتساب لتأكيد بدء التنفيذ الفوري.
              </p>
              <a
                href={`https://wa.me/20${OFFICIAL_SUPPORT_PHONE}?text=${encodeURIComponent(
                  `السلام عليكم.. قمت بعمل طلبية رقم #${submittedOrder.invoiceNumber} في سوق الشمساوية بقيمة ${submittedOrder.finalTotal} ج.م، وأرغب في تأكيد دفعة الجدية والمتابعة.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition"
              >
                <span>مراسلة خدمة العملاء عبر واتساب 📲</span>
              </a>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-black text-xs"
            >
              متابعة تصفح السوق 🛍️
            </button>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <ShoppingBag className="w-12 h-12 mx-auto text-[#EA580C]/70" />
            <h4 className="text-sm font-black text-[#0C1427] dark:text-amber-200">سلة مشترياتك فارغة حالياً</h4>
            <p className="text-xs text-[#334155] dark:text-[#CBD5E1]">
              تصفح المشغولات اليدوية والديكورية الفاخرة وأضف لمستك الفنية لمنزلك!
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-black text-xs"
            >
              اكتشف المعروضات الآن ✨
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder} className="space-y-5">
            {/* 1. Items List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {cartItems.map((item, idx) => {
                if (!item) return null;
                const itemId = item.id || `cart_item_${idx}`;
                const itemName = item.productName || (item as any).product_name || 'مشغولة يدوية فاخرة';
                const itemPrice = Number(item.price ?? (item as any).store_price ?? (item as any).storePrice ?? (item as any).retail_price ?? (item as any).retailPrice ?? 0);
                const itemQty = Math.max(1, Number(item.quantity) || 1);
                const itemImg = item.imageUrl || (item as any).image_url || null;

                return (
                  <div
                    key={itemId}
                    className="p-3.5 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] shrink-0">
                        {itemImg ? (
                          <img src={itemImg} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#EA580C] dark:text-amber-400">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-black text-[#0C1427] dark:text-[#F7F3EA] truncate text-xs sm:text-sm">
                          {itemName}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                          {item.selectedColor && (
                            <span className="px-2 py-0.5 rounded-md bg-[#E9E2D4] dark:bg-amber-500/10 border border-[#D4CCBC] dark:border-amber-500/20">
                              اللون: {item.selectedColor}
                            </span>
                          )}
                          {item.selectedSize && (
                            <span className="px-2 py-0.5 rounded-md bg-[#E9E2D4] dark:bg-amber-500/10 border border-[#D4CCBC] dark:border-amber-500/20">
                              المقاس: {item.selectedSize}
                            </span>
                          )}
                          <span className="font-mono text-[#C2410C] dark:text-amber-300 font-bold">
                            {itemPrice} ج.م للقطعة
                          </span>
                        </div>
                        {item.customNotes && (
                          <p className="text-[10px] text-[#475569] dark:text-[#94A3B8] truncate">
                            ملاحظات خاصة: {item.customNotes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity & Delete */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(itemId, -1)}
                          className="w-6 h-6 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer"
                          title="تقليل الكمية"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono font-black text-[#C2410C] dark:text-amber-300 text-xs">
                          {itemQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(itemId, 1)}
                          className="w-6 h-6 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer"
                          title="زيادة الكمية"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(itemId)}
                        className="p-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:text-rose-500 transition cursor-pointer"
                        title="حذف القطعة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Customer Auth Banner / Info */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-l from-[#E9E2D4] to-[#F5DFC6]/70 dark:from-[#132040] dark:to-[#1A2B54] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              {customerUser ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA] block">
                      مسجل بحساب: {customerUser.name} ({customerUser.phone})
                    </span>
                    <span className="text-[11px] text-[#C2410C] dark:text-amber-300">
                      رصيد نقاط الولاء: {customerUser.loyaltyPoints} نقطة • كود الخصم 5% مفعل 🎁
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#EA580C] dark:text-amber-400 shrink-0" />
                  <div>
                    <span className="font-black text-[#0C1427] dark:text-amber-300 block">
                      هل تملك حساباً في عائلة الشمساوية؟
                    </span>
                    <span className="text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                      سجّل الآن لتحصل على خصم 5% فوري وتجميع نقاط ولاء مع كل طلبية.
                    </span>
                  </div>
                </div>
              )}

              {!customerUser && (
                <button
                  type="button"
                  onClick={onOpenCustomerAuth}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-black text-xs shrink-0 cursor-pointer shadow-sm"
                >
                  تسجيل الدخول / إنشاء حساب 🏷️
                </button>
              )}
            </div>

            {/* 3. Shipping Details Form */}
            <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-3 text-xs">
              <h4 className="font-black text-[#C2410C] dark:text-amber-300 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>بيانات الشحن والتوصيل المنزلي</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#0C1427] dark:text-[#F7F3EA] font-bold mb-1">
                    اسم المستلم *
                  </label>
                  <input
                    type="text"
                    value={customerUser?.name || guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="الاسم الكريم بالكامل"
                    disabled={!!customerUser}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold outline-none focus:border-[#EA580C] disabled:opacity-75"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[#0C1427] dark:text-[#F7F3EA] font-bold mb-1">
                    رقم الهاتف الأساسي * (إجباري)
                  </label>
                  <input
                    type="tel"
                    value={customerUser?.phone || guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    disabled={!!customerUser}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold font-mono outline-none focus:border-[#EA580C] disabled:opacity-75"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#0C1427] dark:text-[#F7F3EA] font-bold mb-1">
                    المحافظة * (لحساب قيمة الشحن الفعلي)
                  </label>
                  <select
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold outline-none focus:border-[#EA580C]"
                  >
                    {governorates.map((gov) => (
                      <option key={gov} value={gov} className="bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA]">
                        {gov} (شحن: {calculateShippingRate(gov)} ج.م)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#0C1427] dark:text-[#F7F3EA] font-bold mb-1">
                    رقم هاتف بديل (اختياري)
                  </label>
                  <input
                    type="tel"
                    value={customerUser?.alternatePhone || guestAltPhone}
                    onChange={(e) => setGuestAltPhone(e.target.value)}
                    placeholder="رقم آخر لضمان سهولة التواصل"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold font-mono outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#0C1427] dark:text-[#F7F3EA] font-bold mb-1">
                  العنوان التفصيلي للتسليم * (المنطقة، الشارع، رقم العمارة والشقة)
                </label>
                <textarea
                  value={customerUser?.detailedAddress || guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="اكتب العنوان بدقة ليصل مندوب الشحن لمنزلك دون تأخير"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-bold outline-none focus:border-[#EA580C] resize-none"
                  required
                />
              </div>
            </div>

            {/* 4. Payment Method & 33% Advance Rule */}
            <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-3 text-xs">
              <h4 className="font-black text-[#C2410C] dark:text-amber-300 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>طريقة السداد وجدية حجز تصنيع الهاند ميد (33%)</span>
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F5DFC6] dark:bg-amber-500/20 text-[#9A3412] dark:text-amber-300 border border-[#EA580C]/30 font-bold">
                  دفعة تعاقدية: {advancePaymentAmount} ج.م
                </span>
              </h4>

              <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                نظراً لأن مشغولات الهاند ميد تُصنع يدوياً خصيصاً لحضرتك وبألوان ومقاسات منزلك، يُشترط سداد دفعة جدية لا تقل عن 33% لبدء خط الإنتاج بالورشة، ويُسدد المبلغ المتبقي عند الاستلام والفحص.
              </p>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    paymentMethod === 'instapay'
                      ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] border-[#C2410C] text-white font-black'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#CBD5E1]'
                  }`}
                >
                  <span className="text-sm">⚡ إنستاباي InstaPay</span>
                  <span className={`text-[10px] ${paymentMethod === 'instapay' ? 'text-amber-100' : 'text-[#475569] dark:text-[#94A3B8]'}`}>تحويل لحظي مباشر</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('vodafone_cash')}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    paymentMethod === 'vodafone_cash'
                      ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] border-[#C2410C] text-white font-black'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#CBD5E1]'
                  }`}
                >
                  <span className="text-sm">📱 محفظة إلكترونية كاش</span>
                  <span className={`text-[10px] ${paymentMethod === 'vodafone_cash' ? 'text-amber-100' : 'text-[#475569] dark:text-[#94A3B8]'}`}>فودافون كاش / محافظ البنوك</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    paymentMethod === 'cash'
                      ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] border-[#C2410C] text-white font-black'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#CBD5E1]'
                  }`}
                >
                  <span className="text-sm">💵 كاش عند الاستلام</span>
                  <span className={`text-[10px] ${paymentMethod === 'cash' ? 'text-amber-100' : 'text-[#475569] dark:text-[#94A3B8]'}`}>سداد الباقي نقداً مع المندوب</span>
                </button>
              </div>

              {/* Official Transfer Box */}
              <div className="p-3.5 rounded-xl bg-[#E9E2D4] dark:bg-amber-500/10 border border-[#D4CCBC] dark:border-amber-400/40 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#9A3412] dark:text-amber-300">رقم الشركة الرسمي للتحويل:</span>
                    <span className="font-mono text-base font-black text-[#0C1427] dark:text-[#F7F3EA] bg-[#F7F3EA] dark:bg-[#060B18] px-2.5 py-1 rounded-lg border border-[#D4CCBC] dark:border-amber-500/40" dir="ltr">
                      {OFFICIAL_PAYMENT_PHONE}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPaymentPhone}
                    className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedNumber ? 'تم النسخ بنجاح ✓' : 'نسخ الرقم'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                  مستلم التحويل الرسمي: <strong>منظومة الشمساوية للدفع المعتمد</strong> (إنستاباي وفودافون كاش).
                </p>

                <div>
                  <label className="block text-[#0C1427] dark:text-[#CBD5E1] text-[11px] font-bold mb-1">
                    رقم العملية أو اسم المحول (اختياري لتأكيد التحويل فوراً):
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="مثال: تحويل من محفظة 010... أو اسم الحساب"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] text-xs outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>
            </div>

            {/* 5. Cost Summary & Coupon */}
            <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#334155] dark:text-[#CBD5E1]">قيمة المنتجات:</span>
                <span className="font-mono font-bold text-[#0C1427] dark:text-[#F7F3EA]">{subtotal} ج.م</span>
              </div>

              {/* Coupon row */}
              <div className="flex items-center justify-between py-1 border-t border-[#D4CCBC] dark:border-[#22355E]">
                <div className="flex items-center gap-2">
                  <span className="text-[#334155] dark:text-[#CBD5E1]">كود الخصم الترحيبي:</span>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="SHAMS5"
                    className="w-24 px-2 py-0.5 rounded-md bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-mono font-bold uppercase text-center text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-2.5 py-0.5 rounded-md bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-[11px]"
                  >
                    تطبيق
                  </button>
                </div>
                {isCouponApplied && (
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    - {discountAmount} ج.م (5%)
                  </span>
                )}
              </div>
              {couponError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{couponError}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#334155] dark:text-[#CBD5E1]">تكلفة الشحن والتوصيل ({governorate}):</span>
                <span className="font-mono font-bold text-[#0C1427] dark:text-[#F7F3EA]">{shippingCost} ج.م</span>
              </div>

              <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between text-sm sm:text-base font-black">
                <span className="text-[#C2410C] dark:text-amber-300">إجمالي الفاتورة:</span>
                <span className="font-mono text-[#EA580C] dark:text-amber-300 text-lg">{finalTotal} ج.م</span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#E9E2D4] dark:bg-amber-500/10 border border-[#D4CCBC] dark:border-amber-500/30 flex items-center justify-between flex-wrap gap-2 text-xs font-bold">
                <div className="text-[#9A3412] dark:text-amber-300">
                  <span>الدفعة التعاقدية للبدء (33%): </span>
                  <span className="font-mono font-black text-[#0C1427] dark:text-[#F7F3EA]">{advancePaymentAmount} ج.م</span>
                </div>
                <div className="text-emerald-800 dark:text-emerald-300">
                  <span>الباقي عند التسليم: </span>
                  <span className="font-mono font-black text-[#0C1427] dark:text-[#F7F3EA]">{remainingAtDelivery} ج.م</span>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs font-bold text-center">
                {formError}
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-black text-sm shadow-xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {isSubmitting
                    ? 'جاري تأكيد طلبيتك وحفظها...'
                    : `تأكيد الطلبية ودفع الجدية (${advancePaymentAmount} ج.م) ✨`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
