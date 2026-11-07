import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, SavedProductRecord, InvoiceRecord } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { playSuccessSound, playAlertSound } from '../../lib/sounds';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';
import {
  Store,
  QrCode,
  Share2,
  Copy,
  Printer,
  Download,
  ExternalLink,
  Package,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Wallet,
  X,
  Search,
  Filter,
  Layers,
  Sparkles,
  Phone,
  User,
  MapPin,
  Calendar,
  Eye,
  ShoppingBag,
  ShieldCheck,
} from 'lucide-react';
import { getClientPrivacyActive } from '../../services/marketplaceCartService';

interface TreasuryAccountOption {
  id: string;
  name: string;
  balance: number;
}

interface ArtisanStorefrontModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  initialOrderId?: string;
  onOpenCalculatorForRecord?: (record: SavedProductRecord) => void;
}

export const ArtisanStorefrontModal: React.FC<ArtisanStorefrontModalProps> = ({
  isOpen,
  onClose,
  profile,
  initialOrderId,
  onOpenCalculatorForRecord,
}) => {
  const [activeTab, setActiveTab] = useState<'storefront' | 'orders' | 'qr'>('storefront');
  const [products, setProducts] = useState<SavedProductRecord[]>([]);
  const [orders, setOrders] = useState<InvoiceRecord[]>([]);
  const [treasuries, setTreasuries] = useState<TreasuryAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  // Selected Order for Handover / Collection Modal
  const [collectingOrder, setCollectingOrder] = useState<InvoiceRecord | null>(null);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [collectionMethod, setCollectionMethod] = useState<'cash' | 'instapay' | 'vodafone_cash' | 'bank'>('instapay');

  // Selected Order for Return Modal
  const [returningOrder, setReturningOrder] = useState<InvoiceRecord | null>(null);
  const [returnType, setReturnType] = useState<'full' | 'partial'>('full');
  const [returnAmount, setReturnAmount] = useState<number>(0);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnRestock, setReturnRestock] = useState<boolean>(true);

  // Set Delivery Date Modal
  const [schedulingOrder, setSchedulingOrder] = useState<InvoiceRecord | null>(null);
  const [scheduledDeliveryDate, setScheduledDeliveryDate] = useState<string>('');

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const artisanSlug = (profile.brandName || profile.artistName || 'artisan')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0621-\u064A-]/g, '');

  const storeUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#store-${artisanSlug}`
    : `https://alshams-craft.com/store/${artisanSlug}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
    storeUrl
  )}&color=0a1128&bgcolor=fdfbf7`;

  useEffect(() => {
    if (!isOpen || !tenantId) return;

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [prods, ords] = await Promise.all([
          tenantStorage.getProducts(tenantId),
          tenantStorage.getOrders(tenantId),
        ]);

        let trs: TreasuryAccountOption[] = [];
        try {
          const supaRes = await getTreasuryBalancesFromSupabase(tenantId);
          if (supaRes?.data && supaRes.data.length > 0) {
            trs = supaRes.data.map((t: any) => ({
              id: t.id || t.name,
              name: t.name || 'خزينة',
              balance: Number(t.balance) || 0,
            }));
          } else {
            const safe = await tenantStorage.getSafeBalances(tenantId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
            trs = [
              { id: 'main', name: 'الخزينة الرئيسية (كاش)', balance: safe.mainSafe || 0 },
              { id: 'sub', name: 'الخزينة الفرعية / المحافظ الإلكترونية', balance: safe.subSafe || 0 },
            ];
          }
        } catch {
          const safe = await tenantStorage.getSafeBalances(tenantId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
          trs = [
            { id: 'main', name: 'الخزينة الرئيسية (كاش)', balance: safe.mainSafe || 0 },
            { id: 'sub', name: 'الخزينة الفرعية / المحافظ الإلكترونية', balance: safe.subSafe || 0 },
          ];
        }

        if (isMounted) {
          setProducts(prods.filter((p: SavedProductRecord) => p.inStore !== false));
          setOrders(ords as InvoiceRecord[]);
          setTreasuries(trs);
          if (trs.length > 0) setSelectedTreasuryId(trs[0].id);

          if (initialOrderId) {
            setActiveTab('orders');
          }
        }
      } catch (err) {
        console.warn('Error loading store data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId, initialOrderId]);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  // Copy Store Link
  const handleCopyStoreLink = () => {
    navigator.clipboard.writeText(storeUrl);
    playSuccessSound();
    showNotice('✓ تم نسخ رابط متجرك المباشر للمشاركة مع الزبائن!');
  };

  // WhatsApp Share Store Link
  const handleShareStoreWhatsApp = () => {
    const text = `أهلاً بحضرتك في متجر "${profile.brandName || profile.artistName}" على منظومة الشمساوية 🦅☀️\nاستعرض كافة منتجاتنا ومشغولاتنا اليدوية المصنوعة بحب وعناية، واطلب قطعتك المخصصة من هنا:\n${storeUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Download QR Code
  const handleDownloadQR = async () => {
    try {
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_Store_${artisanSlug}.png`;
      a.click();
      window.URL.revokeObjectURL(url);
      playSuccessSound();
      showNotice('✓ تم تنزيل كود QR الخاص بمتجرك بنجاح!');
    } catch {
      window.open(qrImageUrl, '_blank');
    }
  };

  // Print Store Poster
  const handlePrintPoster = () => {
    window.print();
  };

  // Order Lifecycle 1: Start Execution -> Set Delivery Date
  const handleConfirmSchedule = async () => {
    if (!schedulingOrder || !scheduledDeliveryDate) return;
    try {
      const updated: InvoiceRecord = {
        ...schedulingOrder,
        status: 'in_progress',
        deliveryDate: scheduledDeliveryDate,
        updatedAt: Date.now(),
      };
      (updated as any).dueDate = scheduledDeliveryDate;
      await tenantStorage.recordSalesOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSchedulingOrder(null);
      playSuccessSound();
      showNotice(`✓ تم بدء تنفيذ الأوردر #${updated.invoiceNumber} وموعد التسليم: ${scheduledDeliveryDate}`);
    } catch (err: any) {
      showNotice('تعذر تحديث الأوردر: ' + err.message);
    }
  };

  // Order Lifecycle 2: Shipping -> Generate WhatsApp message
  const handleStartShipping = async (order: InvoiceRecord) => {
    const remaining = (order.finalTotal || 0) - (order.paidAmount || 0);
    const itemNames = order.items?.map((i) => i.productName).join(' + ') || 'مشغولات هاند ميد';
    const waText =
      `أهلاً بحضرتك يا فندم! 🌸\n` +
      `بنفرحك إن أوردرك رقم #${order.invoiceNumber} (${itemNames}) من ورشة "${profile.brandName || profile.artistName}" تم تجهيزه بحب وعناية وهو الآن في طريقه إليك مع مندوب الشحن! 🚚✨\n\n` +
      `💰 تفاصيل الفاتورة:\n` +
      `- إجمالي الحساب: ${order.finalTotal} ${profile.currencySymbol || 'ج.م'}\n` +
      `- المدفوع مقدماً (العربون): ${order.paidAmount || 0} ${profile.currencySymbol || 'ج.م'}\n` +
      `- المتبقي عند الاستلام: ${remaining > 0 ? remaining : 0} ${profile.currencySymbol || 'ج.م'}\n\n` +
      `شرفتنا ونورت عيلة الشمساوية، ونتمنى تعجبك المشغولة! 🦅☀️`;

    try {
      const updated: InvoiceRecord = {
        ...order,
        status: 'shipping',
        updatedAt: Date.now(),
      };
      await tenantStorage.recordSalesOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      playSuccessSound();
      showNotice('✓ تم تحديث حالة الأوردر إلى [جاري الشحن] وفتح رسالة الواتساب للعميل');
    } catch {}

    const clientPhone = (order.customerPhone || '').replace(/\D/g, '');
    const waUrl = clientPhone
      ? `https://wa.me/${clientPhone}?text=${encodeURIComponent(waText)}`
      : `https://wa.me/?text=${encodeURIComponent(waText)}`;
    window.open(waUrl, '_blank');
  };

  // Order Lifecycle 3: Collect Remaining -> Deposit into Treasury & Journal
  const handleConfirmCollection = async () => {
    if (!collectingOrder) return;
    const remaining = Math.max(0, (collectingOrder.finalTotal || 0) - (collectingOrder.paidAmount || 0));

    try {
      // 1. Update order status
      const updated: InvoiceRecord = {
        ...collectingOrder,
        status: 'delivered',
        paidAmount: collectingOrder.finalTotal,
        paymentStatus: 'paid',
        updatedAt: Date.now(),
      };
      await tenantStorage.recordSalesOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

      // 2. Deposit into Treasury if remaining amount > 0
      if (remaining > 0 && selectedTreasuryId) {
        await tenantStorage.recordSafeTransaction({
          id: 'tx_col_' + Date.now(),
          tenantId,
          workshopId: profile.workshopId || profile.id,
          type: 'deposit',
          safeType: selectedTreasuryId === 'sub' ? 'sub' : 'main',
          amount: remaining,
          balanceAfter: 0,
          date: new Date().toISOString(),
          notes: `تحصيل باقي فاتورة أوردر متجر #${collectingOrder.invoiceNumber} (${collectingOrder.customerName || 'عميل'}) عبر ${collectionMethod}`,
          createdAt: Date.now(),
          createdBy: profile.artistName || 'artisan',
          referenceId: collectingOrder.id,
        });
        window.dispatchEvent(new CustomEvent('alshams_treasury_updated', { detail: { tenantId } }));
      }

      playSuccessSound();
      showNotice(`✓ تم تأكيد استلام الأوردر وتحصيل ${remaining} ${profile.currencySymbol || 'ج.م'} وإيداعها بالخزينة بنجاح!`);
      setCollectingOrder(null);
    } catch (err: any) {
      showNotice('تعذر إتمام التحصيل: ' + err.message);
    }
  };

  // Order Lifecycle 4: Returns Management
  const handleConfirmReturn = async () => {
    if (!returningOrder) return;
    const isFull = returnType === 'full';
    const amountToDeduct = isFull ? (returningOrder.paidAmount || returningOrder.finalTotal || 0) : (Number(returnAmount) || 0);

    try {
      const updated: InvoiceRecord = {
        ...returningOrder,
        status: isFull ? 'unpaid' : 'delivered',
        notes: `${returningOrder.notes || ''}\n[مرتجع بتاريخ ${new Date().toLocaleDateString('ar-EG')} بمبلغ ${amountToDeduct} - السبب: ${returnReason || 'غير محدد'}]`,
        updatedAt: Date.now(),
      };
      await tenantStorage.recordSalesOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

      // Restock products if requested
      if (returnRestock && returningOrder.items) {
        for (const item of returningOrder.items) {
          if (item.productId) {
            const p = await tenantStorage.getProductById(tenantId, item.productId);
            if (p) {
              p.currentStock = (p.currentStock || 0) + (item.quantity || 1);
              await tenantStorage.mutateProduct(p);
            }
          }
        }
      }

      // Treasury deduction
      if (amountToDeduct > 0 && selectedTreasuryId) {
        await tenantStorage.recordSafeTransaction({
          id: 'tx_ret_' + Date.now(),
          tenantId,
          workshopId: profile.workshopId || profile.id,
          type: 'withdrawal',
          safeType: selectedTreasuryId === 'sub' ? 'sub' : 'main',
          amount: amountToDeduct,
          balanceAfter: 0,
          date: new Date().toISOString(),
          notes: `رد قيمة مرتجع أوردر #${returningOrder.invoiceNumber} (${returningOrder.customerName || 'عميل'})`,
          createdAt: Date.now(),
          createdBy: profile.artistName || 'artisan',
          referenceId: returningOrder.id,
        });
        window.dispatchEvent(new CustomEvent('alshams_treasury_updated', { detail: { tenantId } }));
      }

      playAlertSound();
      showNotice(`✓ تم تسجيل المرتجع بقيمة ${amountToDeduct} ${profile.currencySymbol || 'ج.م'} وتعديل رصيد الخزينة بنجاح`);
      setReturningOrder(null);
    } catch (err: any) {
      showNotice('تعذر معالجة المرتجع: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0C1427] text-white w-full max-w-5xl max-h-[92vh] rounded-3xl border-2 border-amber-500/40 shadow-2xl flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#080F1E] via-[#0C1427] to-[#142347] border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-lg">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-amber-300">
                  متجر ورشة {profile.brandName || profile.artistName}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black">
                  متصل ومفعل 🟢
                </span>
              </div>
              <p className="text-xs text-[#EADBC8] font-medium">
                واجهة العرض العامة، مولد كود QR، ودورة متابعة طلبيات وتحصيل المتجر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/40 text-amber-200 text-xs font-bold text-center animate-pulse">
            {feedback}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 bg-[#080F1E] border-b border-amber-900/30 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('storefront')}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'storefront'
                ? 'bg-[#0C1427] text-amber-300 border-t-2 border-x-2 border-amber-500/50'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>منتجات المتجر والمخزون ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#0C1427] text-amber-300 border-t-2 border-x-2 border-amber-500/50'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>طلبيات المتجر والتحصيل ({orders.length})</span>
            {orders.filter((o) => o.status === 'pending' || o.status === 'in_progress').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`px-4 py-2.5 rounded-t-2xl font-black text-xs transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-[#0C1427] text-amber-300 border-t-2 border-x-2 border-amber-500/50'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>كود QR وبوستر الورشة</span>
          </button>
        </div>

        {/* Tab 1: Products in Storefront */}
        {activeTab === 'storefront' && (
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* Operational Quality Notice */}
            <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-400/40 text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-2 text-amber-300 font-black">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>تنبيه تشغيلي وسياسة فحص الجودة المعتمدة في شركة الشمس كرافت:</span>
              </div>
              <p className="text-[#EADBC8] font-medium">
                "تنبيه تشغيلي: يلتزم الفنان بتحمل مصاريف الشحن الداخلي إلى مخازن شركة الشمس كرافت وتكاليف الفحص والتغليف. تخضع كافة المشغولات للفحص الفني اليدوي، ويحق للمنظومة رفض أي قطعة غير مطابقة للصور أو معايير الفنش والجودة؛ للحفاظ على ثقة عملاء عائلة الشمساوية وقيمة منتجك".
              </p>
            </div>

            {/* Quick Share Bar */}
            <div className="p-3.5 rounded-2xl bg-[#131E38] border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="text-amber-300 font-bold">رابط متجرك المباشر:</span>
                <span className="font-mono text-emerald-300 text-[11px] bg-black/40 px-2.5 py-1 rounded-lg border border-emerald-500/30 truncate max-w-[260px] sm:max-w-md" dir="ltr">
                  {storeUrl}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyStoreLink}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الرابط</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareStoreWhatsApp}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>مشاركة واتساب</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            {products.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#080F1E] border border-amber-500/20 space-y-3">
                <Store className="w-12 h-12 mx-auto text-amber-500/60" />
                <h4 className="text-sm font-black text-amber-200">لا توجد منتجات معروضة بمتجرك حالياً</h4>
                <p className="text-xs text-[#EADBC8] max-w-md mx-auto">
                  يمكنك حفظ أي مشغولة من حاسبة التكاليف وسيتم إدراجها هنا فورياً، أو التحديد من كتالوج المشغولات والضغط على "تصدير إلى متجري 🏪".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p) => {
                  const hasStock = (p.currentStock || 0) > 0;
                  const price = p.storePrice || p.retailPrice || 0;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl bg-[#080F1E] border border-amber-500/30 p-3.5 flex flex-col justify-between hover:border-amber-400 transition shadow-lg group"
                    >
                      <div>
                        {/* Image & Badges */}
                        <div className="relative w-full h-44 rounded-xl overflow-hidden bg-black/40 mb-3 border border-amber-500/20">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.productName} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-amber-400/50">
                              <ShoppingBag className="w-10 h-10 mb-1" />
                              <span className="text-[10px]">لا توجد صورة</span>
                            </div>
                          )}

                          {/* Stock status badge */}
                          <div className="absolute top-2 right-2">
                            {hasStock ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-600/90 text-white font-black text-[10px] shadow-md flex items-center gap-1 border border-emerald-400">
                                <span>متاح للتسليم الفوري ({p.currentStock} قطعة)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-amber-600/90 text-white font-black text-[10px] shadow-md flex items-center gap-1 border border-amber-400">
                                <span>يُصنع عند الطلب (3-5 أيام) ⏳</span>
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-2 left-2">
                            <span className="px-2 py-0.5 rounded-lg bg-black/80 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                              {price} {profile.currencySymbol || 'ج.م'}
                            </span>
                          </div>
                        </div>

                        {/* Title & Code */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <h4 className="font-black text-sm text-white truncate">{p.productName}</h4>
                          <span className="text-[10px] font-mono text-stone-400 shrink-0">{p.productCode || ''}</span>
                        </div>
                        <p className="text-[11px] text-[#EADBC8] line-clamp-2 mb-2 font-medium">
                          {p.storeDescription || p.input?.personalNotes || `مشغولة يدوية فاخرة مصنوعة بحب في ورشة ${profile.brandName || profile.artistName}`}
                        </p>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-amber-200">
                          {p.category}
                        </span>
                        {onOpenCalculatorForRecord && (
                          <button
                            type="button"
                            onClick={() => onOpenCalculatorForRecord(p)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>فتح بالحاسبة 🧮</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders & Lifecycle */}
        {activeTab === 'orders' && (
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h4 className="font-black text-sm text-amber-300 flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>إدارة ومتابعة أوردرات المتجر والتسليم</span>
              </h4>
              <span className="text-xs text-stone-400 font-mono">
                إجمالي الطلبيات: {orders.length}
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#080F1E] border border-amber-500/20 space-y-3">
                <Package className="w-12 h-12 mx-auto text-amber-500/60" />
                <h4 className="text-sm font-black text-amber-200">لا توجد طلبيات مسجلة في المتجر حتى الآن</h4>
                <p className="text-xs text-[#EADBC8] max-w-md mx-auto">
                  عند قيام الزبائن بالطلب عبر رابط متجرك المباشر أو كود QR، ستظهر الطلبيات هنا مباشرة لبدء الجدولة والتسليم.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const remaining = Math.max(0, (order.finalTotal || 0) - (order.paidAmount || 0));
                  const isPrivacyActive = getClientPrivacyActive() && order.isClientDataHiddenFromArtisan !== false;
                  const displayName = isPrivacyActive ? 'عميل متجر عائلة الشمساوية' : (order.customerName || 'عميل المتجر');
                  const displayPhone = isPrivacyActive ? 'بيانات التواصل والعنوان محجوبة (الشحن عبر شركة الشمس كرافت 🛡️)' : (order.customerPhone || 'بدون هاتف');
                  
                  const targetDelivery = order.targetDeliveryDate || (order as any).dueDate || order.deliveryDate;
                  const daysRemaining = targetDelivery
                    ? Math.ceil((new Date(targetDelivery).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-[#080F1E] border border-amber-500/30 hover:border-amber-400 transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                            #{order.invoiceNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-black text-sm text-white">{displayName}</h5>
                              {isPrivacyActive && (
                                <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                                  خصوصية مفعلة 🛡️
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#EADBC8] font-mono">{displayPhone}</span>
                          </div>
                        </div>

                        {/* Status & Live Countdown Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          {daysRemaining !== null && order.status !== 'completed' && order.status !== 'cancelled' && (
                            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 font-mono ${
                              daysRemaining > 2
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : daysRemaining > 0
                                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}>
                              <Clock className="w-3 h-3" />
                              <span>
                                {daysRemaining > 0
                                  ? `باقي ${daysRemaining} يوم للتسليم`
                                  : daysRemaining === 0
                                  ? 'ميعاد التسليم اليوم!'
                                  : `متأخر ${Math.abs(daysRemaining)} يوم`}
                              </span>
                            </span>
                          )}

                          {order.status === 'pending' && (
                            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 text-xs font-black">
                              أوردر جديد 🆕
                            </span>
                          )}
                          {order.status === 'in_progress' && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black">
                              جاري التصنيع 🔨
                            </span>
                          )}
                          {order.status === 'shipped' && (
                            <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 text-xs font-black">
                              جاري الشحن والتوصيل 🚚
                            </span>
                          )}
                          {order.status === 'completed' && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-black">
                              تم الاستلام والتحصيل ✓
                            </span>
                          )}
                          {order.status === 'cancelled' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40 text-xs font-black">
                              مرتجع / ملغي ❌
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items & Financials */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-[#0C1427] border border-amber-900/40">
                          <span className="text-[10px] text-stone-400 block mb-0.5">الأصناف المطلوبة</span>
                          <span className="font-bold text-white line-clamp-1">
                            {order.items?.map((i) => `${i.productName} (${i.quantity})`).join('، ') || 'مشغولة يدوية'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#0C1427] border border-amber-900/40">
                          <span className="text-[10px] text-stone-400 block mb-0.5">الحساب المالي</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            إجمالي: {order.finalTotal} | مسدد: {order.paidAmount || 0} {profile.currencySymbol || 'ج.م'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#0C1427] border border-amber-900/40">
                          <span className="text-[10px] text-stone-400 block mb-0.5">المتبقي للتحصيل</span>
                          <span className="font-black text-amber-300 font-mono text-sm">
                            {remaining} {profile.currencySymbol || 'ج.م'}
                          </span>
                        </div>
                      </div>

                      {/* Operational Lifecycle Buttons */}
                      <div className="pt-2 flex flex-wrap items-center justify-end gap-2 text-xs">
                        {order.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSchedulingOrder(order);
                              const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
                              setScheduledDeliveryDate(inThreeDays);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
                          >
                            <Clock className="w-4 h-4" />
                            <span>بدء التنفيذ وتحديد ميعاد التسليم 🔨</span>
                          </button>
                        )}

                        {(order.status === 'in_progress' || order.status === 'pending') && (
                          <button
                            type="button"
                            onClick={() => handleStartShipping(order)}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
                          >
                            <Truck className="w-4 h-4" />
                            <span>جاري الشحن (إرسال واتساب للزبون) 🚚</span>
                          </button>
                        )}

                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCollectingOrder(order)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تم الاستلام وتحصيل الباقي ({remaining} {profile.currencySymbol || 'ج.م'}) 💵</span>
                          </button>
                        )}

                        {order.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturningOrder(order);
                              setReturnAmount(order.paidAmount || order.finalTotal || 0);
                            }}
                            className="px-2.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1 cursor-pointer transition"
                            title="تسجيل مرتجع كلي أو جزئي للأوردر"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>مرتجع 🔄</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Workshop QR Code & Marketing Poster */}
        {activeTab === 'qr' && (
          <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center space-y-5">
            {/* Printable Frame */}
            <div className="p-6 rounded-3xl bg-[#FDFBF7] text-[#0A1128] border-4 border-amber-500 shadow-2xl max-w-sm w-full space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  منظومة الشمساوية • هاند ميد مصر
                </span>
                <h3 className="text-xl font-black text-[#0A1128]">
                  {profile.brandName || profile.artistName}
                </h3>
                <p className="text-xs text-stone-600 font-bold">
                  امسح الكود لزيارة متجرنا وطلب القطع المصنوعة بحب وعناية ✨
                </p>
              </div>

              {/* QR Image */}
              <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden border-2 border-[#0A1128] p-2 bg-white shadow-inner flex items-center justify-center">
                <img src={qrImageUrl} alt="QR Code" className="w-full h-full object-contain" />
              </div>

              <div className="text-[11px] font-mono text-stone-700 border-t border-stone-200 pt-2 truncate" dir="ltr">
                {storeUrl}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDownloadQR}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>تحميل صورة كود QR 💾</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPoster}
                className="px-4 py-2.5 rounded-xl bg-[#131E38] hover:bg-[#1D2F57] border border-amber-500/40 text-amber-300 font-black text-xs flex items-center gap-2 cursor-pointer transition"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة بوستر الورشة 🖨️</span>
              </button>

              <button
                type="button"
                onClick={handleShareStoreWhatsApp}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer transition"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة كارت المتجر واتساب 📲</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Schedule Order Delivery */}
        {schedulingOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="bg-[#0C1427] border-2 border-amber-500 rounded-3xl p-5 max-w-md w-full space-y-4 text-right">
              <h4 className="font-black text-sm text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>تحديد موعد تسليم الأوردر #{schedulingOrder.invoiceNumber}</span>
              </h4>
              <p className="text-xs text-[#EADBC8]">
                حدد تاريخ انتهاء تنفيذ القطعة وجاهزيتها للتسليم للعميل:
              </p>
              <input
                type="date"
                value={scheduledDeliveryDate}
                onChange={(e) => setScheduledDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#131E38] border border-amber-500/40 text-white text-xs font-bold outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSchedulingOrder(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-stone-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSchedule}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                >
                  تأكيد وبدء التنفيذ 🔨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Collect Payment and Handover */}
        {collectingOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="bg-[#0C1427] border-2 border-emerald-500 rounded-3xl p-5 max-w-md w-full space-y-4 text-right">
              <h4 className="font-black text-sm text-emerald-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>تحصيل باقي فاتورة أوردر #{collectingOrder.invoiceNumber}</span>
              </h4>
              <div className="p-3 rounded-xl bg-[#131E38] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-400">اسم العميل:</span>
                  <span className="font-bold text-white">{collectingOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">إجمالي الفاتورة:</span>
                  <span className="font-mono text-white">{collectingOrder.finalTotal} {profile.currencySymbol || 'ج.م'}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold border-t border-stone-700 pt-1">
                  <span>المبلغ المطلوب تحصيله الآن:</span>
                  <span className="font-mono text-sm">{Math.max(0, (collectingOrder.finalTotal || 0) - (collectingOrder.paidAmount || 0))} {profile.currencySymbol || 'ج.م'}</span>
                </div>
              </div>

              {/* Disbursement Safe */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-300 block">إيداع المبلغ في خزينة:</label>
                <select
                  value={selectedTreasuryId}
                  onChange={(e) => setSelectedTreasuryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#131E38] border border-amber-500/40 text-white text-xs font-bold outline-none"
                >
                  {treasuries.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.balance || 0} {profile.currencySymbol || 'ج.م'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-300 block">طريقة الاستلام:</label>
                <div className="grid grid-cols-4 gap-1.5 text-xs text-center font-bold">
                  {(['cash', 'instapay', 'vodafone_cash', 'bank'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCollectionMethod(m)}
                      className={`p-2 rounded-xl border transition ${
                        collectionMethod === m
                          ? 'bg-emerald-600 text-white border-emerald-400 font-black'
                          : 'bg-[#131E38] text-stone-300 border-stone-700'
                      }`}
                    >
                      {m === 'cash' ? 'كاش 💵' : m === 'instapay' ? 'إنستاباي ⚡' : m === 'vodafone_cash' ? 'محفظة 📱' : 'بنك 🏦'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectingOrder(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-stone-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCollection}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                >
                  تأكيد الاستلام والإيداع بالخزينة ✓
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Process Returns */}
        {returningOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="bg-[#0C1427] border-2 border-rose-500 rounded-3xl p-5 max-w-md w-full space-y-4 text-right">
              <h4 className="font-black text-sm text-rose-300 flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <span>تسجيل مرتجع للأوردر #{returningOrder.invoiceNumber}</span>
              </h4>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setReturnType('full');
                    setReturnAmount(returningOrder.paidAmount || returningOrder.finalTotal || 0);
                  }}
                  className={`p-2 rounded-xl border text-center font-bold ${
                    returnType === 'full' ? 'bg-rose-600 text-white border-rose-400' : 'bg-[#131E38] text-stone-300 border-stone-700'
                  }`}
                >
                  مرتجع كلي (إلغاء الأوردر)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnType('partial')}
                  className={`p-2 rounded-xl border text-center font-bold ${
                    returnType === 'partial' ? 'bg-rose-600 text-white border-rose-400' : 'bg-[#131E38] text-stone-300 border-stone-700'
                  }`}
                >
                  مرتجع جزئي
                </button>
              </div>

              {returnType === 'partial' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-300 block">المبلغ المردود للعميل ({profile.currencySymbol || 'ج.م'}):</label>
                  <input
                    type="number"
                    value={returnAmount}
                    onChange={(e) => setReturnAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#131E38] border border-amber-500/40 text-white text-xs font-mono font-bold outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-300 block">سبب الإرجاع:</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: تغيير اللون / مقاس مختلف / إلغاء من العميل"
                  className="w-full px-3 py-2 rounded-xl bg-[#131E38] border border-amber-500/40 text-white text-xs font-bold outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-[#EADBC8]">
                <input
                  type="checkbox"
                  id="restock_check"
                  checked={returnRestock}
                  onChange={(e) => setReturnRestock(e.target.checked)}
                  className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="restock_check" className="cursor-pointer font-bold">
                  إعادة القطع المسترجعة إلى رصيد مخزون الورشة تلقائياً
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturningOrder(null)}
                  className="px-3 py-1.5 rounded-xl text-xs text-stone-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  تأكيد تسجيل المرتجع وتعديل الخزينة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
