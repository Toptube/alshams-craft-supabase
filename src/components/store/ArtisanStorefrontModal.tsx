import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, SavedProductRecord, InvoiceRecord } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  playSuccessSound,
  playAlertSound,
  playTapSound,
  playAddToCartSound,
  triggerHaptic,
} from '../../lib/sounds';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';
import { QRCodeCanvas } from 'qrcode.react';
import { motion } from 'motion/react';
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
  Check,
} from 'lucide-react';
import { getClientPrivacyActive, addToCart } from '../../services/marketplaceCartService';
import { getWorkshopCleanSlug, getWorkshopStoreUrl } from '../../utils/slugify';
import { AlShamsBrandLogo, AlShamsBrandIcon } from '../brand/BrandAssets';

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
  const artisanSlug = getWorkshopCleanSlug(profile);
  const storeUrl = getWorkshopStoreUrl(profile);

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
    playTapSound();
    navigator.clipboard.writeText(storeUrl);
    playSuccessSound();
    showNotice('✓ تم نسخ رابط متجرك المباشر للمشاركة مع الزبائن!');
  };

  // WhatsApp Share Store Link
  const handleShareStoreWhatsApp = () => {
    playTapSound();
    const text = `أهلاً بحضرتك في متجر "${profile.brandName || profile.artistName}" على منظومة الشمساوية 🦅☀️\nاستعرض كافة منتجاتنا ومشغولاتنا اليدوية المصنوعة بحب وعناية، واطلب قطعتك المخصصة بضمان الجودة الحرفية من هنا:\n${storeUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Download Pure QR Code Canvas
  const handleDownloadQR = () => {
    playTapSound();
    const qrCanvas = document.getElementById('workshop-qr-canvas') as HTMLCanvasElement;
    if (!qrCanvas) return;
    try {
      const link = document.createElement('a');
      link.download = `QR_Store_${artisanSlug}.png`;
      link.href = qrCanvas.toDataURL('image/png', 1.0);
      link.click();
      playSuccessSound();
      showNotice('✓ تم تنزيل كود QR بدقة فائقة!');
    } catch {
      showNotice('تعذر تنزيل كود QR.');
    }
  };

  // High-Resolution Printable Workshop Poster (1200 x 1600)
  const handleDownloadHighResPoster = () => {
    playTapSound();
    const qrCanvas = document.getElementById('workshop-qr-canvas') as HTMLCanvasElement;
    if (!qrCanvas) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background - Deep Royal Navy
      ctx.fillStyle = '#070E1E';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Outer Golden Border
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 16;
      ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

      // Inner Golden Border
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.strokeRect(54, 54, canvas.width - 108, canvas.height - 108);

      // Header
      ctx.textAlign = 'center';
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 36px Cairo, sans-serif';
      ctx.fillText('☀️ عائلة الشمساوية للفنون اليدوية 🦅', 600, 160);

      // Workshop Brand
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 64px Cairo, sans-serif';
      ctx.fillText(profile.brandName || profile.artistName || 'ورشة فنية', 600, 270);

      // Subtitle
      ctx.fillStyle = '#EADBC8';
      ctx.font = '500 32px Cairo, sans-serif';
      ctx.fillText('أرقى المشغولات اليدوية والديكورات الحرفية الفاخرة', 600, 340);

      // QR Container Card
      ctx.fillStyle = '#FFFFFF';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(260, 430, 680, 720, 32);
        ctx.fill();
      } else {
        ctx.fillRect(260, 430, 680, 720);
      }

      // Draw QR code centered inside white card
      ctx.drawImage(qrCanvas, 320, 480, 560, 560);

      // Text inside card
      ctx.fillStyle = '#070E1E';
      ctx.font = 'bold 28px Cairo, sans-serif';
      ctx.fillText('امسح الكود بكاميرا الموبايل لزيارة المتجر والطلب', 600, 1090);

      // URL
      ctx.fillStyle = '#D97706';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(storeUrl, 600, 1130);

      // Guarantee Seal & Footer
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 34px Cairo, sans-serif';
      ctx.fillText('🛡️ مشغولات يدوية أصلية 100% بضمان الجودة العالية', 600, 1300);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '400 24px Cairo, sans-serif';
      ctx.fillText('شحن وتوصيل آمن لكافة المحافظات • فحص واستلام بأعلى معايير الجودة', 600, 1360);

      const link = document.createElement('a');
      link.download = `بوستر_متجر_${artisanSlug}_عالي_الدقة.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      playSuccessSound();
      showNotice('✓ تم تنزيل بوستر الورشة عالي الدقة (1200x1600) للطباعة بنجاح! 🖼️');
    } catch {
      showNotice('تعذر توليد البوستر.');
    }
  };

  // Quick Add To Cart
  const handleQuickAddToCart = (p: SavedProductRecord) => {
    playAddToCartSound();
    addToCart({
      id: `cart_${p.id}_${Date.now()}`,
      productId: p.id,
      productName: p.productName,
      imageUrl: p.imageUrl || '',
      workshopId: tenantId,
      artistName: profile.brandName || profile.artistName || 'ورشة الشمساوية',
      quantity: 1,
      price: p.storePrice || p.retailPrice || 0,
      craftName: p.category || 'مشغولة يدوية',
    });
    showNotice(`✓ تمت إضافة "${p.productName}" إلى سلة المتجر بنجاح ✨`);
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

          <div className="flex items-center gap-3">
            <AlShamsBrandLogo maxWidth={130} maxHeight={48} isDark={true} />
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/40 text-amber-200 text-xs font-bold text-center animate-pulse">
            {feedback}
          </div>
        )}

        {/* Navigation Tabs (Responsive & Touch-Friendly) */}
        <div className="px-3 sm:px-5 pt-3 bg-[#080F1E] border-b border-amber-900/30 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => {
              playTapSound();
              setActiveTab('storefront');
            }}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-2xl font-black text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'storefront'
                ? 'bg-[#0C1427] text-amber-300 border-t-2 border-x-2 border-amber-500/50 shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span>منتجات المتجر والمخزون ({products.length})</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => {
              playTapSound();
              setActiveTab('orders');
            }}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-2xl font-black text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#0C1427] text-amber-300 border-t-2 border-x-2 border-amber-500/50 shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>طلبيات المتجر والتحصيل ({orders.length})</span>
            {orders.filter((o) => o.status === 'pending' || o.status === 'in_progress').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => {
              playTapSound();
              setActiveTab('qr');
            }}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-2xl font-black text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-[#0C1427] text-amber-300 border-t-2 border-x-2 border-amber-500/50 shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
            <span>كود QR والبوستر 🖼️</span>
          </motion.button>
        </div>

        {/* Tab 1: Products in Storefront */}
        {activeTab === 'storefront' && (
          <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-3 sm:space-y-4">
            {/* Operational Quality Notice */}
            <div className="p-3 sm:p-4 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-2 text-amber-300 font-black">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>سياسة فحص الجودة المعتمدة في منظومة الشمساوية:</span>
              </div>
              <p className="text-[#EADBC8] text-[11px] sm:text-xs font-medium">
                "تخضع كافة المشغولات للفحص الفني اليدوي لضمان معايير الفنش والجودة؛ للحفاظ على ثقة عملاء عائلة الشمساوية وقيمة منتجك الحرفي".
              </p>
            </div>

            {/* Quick Share Bar */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#131E38] border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs w-full sm:w-auto min-w-0">
                <span className="text-amber-300 font-bold shrink-0">رابط متجرك:</span>
                <span className="font-mono text-emerald-300 text-[11px] bg-black/40 px-2 py-1 rounded-lg border border-emerald-500/30 truncate flex-1 sm:max-w-md" dir="ltr">
                  {storeUrl}
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={handleCopyStoreLink}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الرابط</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={handleShareStoreWhatsApp}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>مشاركة واتساب</span>
                </motion.button>
              </div>
            </div>

            {/* Products Grid: 2-Columns on Mobile, 3-Columns on Desktop */}
            {products.length === 0 ? (
              <div className="p-10 text-center rounded-3xl bg-[#080F1E] border border-amber-500/20 space-y-3">
                <Store className="w-12 h-12 mx-auto text-amber-500/60" />
                <h4 className="text-sm font-black text-amber-200">لا توجد منتجات معروضة بمتجرك حالياً</h4>
                <p className="text-xs text-[#EADBC8] max-w-md mx-auto">
                  يمكنك حفظ أي مشغولة من حاسبة التكاليف وسيتم إدراجها هنا فورياً بمعايير الجودة العالية.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                {products.map((p) => {
                  const hasStock = (p.currentStock || 0) > 0;
                  const price = p.storePrice || p.retailPrice || 0;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl bg-[#080F1E] border border-amber-500/30 p-2 sm:p-3.5 flex flex-col justify-between hover:border-amber-400 transition shadow-lg group relative"
                    >
                      <div>
                        {/* Image & Badges */}
                        <div className="relative w-full h-28 sm:h-44 rounded-xl overflow-hidden bg-black/40 mb-2 sm:mb-3 border border-amber-500/20">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.productName}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-amber-400/50">
                              <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 mb-1" />
                              <span className="text-[9px] sm:text-[10px]">مشغولة يدوية</span>
                            </div>
                          )}

                          {/* Guarantee Badge */}
                          <div className="absolute top-1.5 right-1.5">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-stone-900/85 text-amber-300 text-[8px] sm:text-[10px] font-black border border-amber-400/50 shadow-xs flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              <span>جودة يدوية</span>
                            </span>
                          </div>

                          {/* Stock Status */}
                          <div className="absolute top-1.5 left-1.5">
                            {hasStock ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white font-black text-[8px] sm:text-[9px] shadow-xs">
                                فوري ({p.currentStock})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-600/90 text-white font-black text-[8px] sm:text-[9px] shadow-xs">
                                عند الطلب
                              </span>
                            )}
                          </div>

                          {/* Price Tag */}
                          <div className="absolute bottom-1.5 left-1.5">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-black/85 text-amber-300 font-mono text-[10px] sm:text-xs font-bold border border-amber-500/30">
                              {price} {profile.currencySymbol || 'ج.م'}
                            </span>
                          </div>
                        </div>

                        {/* Title & Category */}
                        <div className="mb-1">
                          <h4 className="font-black text-xs sm:text-sm text-white truncate" title={p.productName}>
                            {p.productName}
                          </h4>
                          <span className="text-[9px] sm:text-[10px] text-amber-200/80 line-clamp-1">
                            {p.category || 'مشغولة يدوية'}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions: Quick Add to Cart + Calculator Link */}
                      <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={() => handleQuickAddToCart(p)}
                          className="w-full py-1.5 px-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-[10px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                        >
                          <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-200" />
                          <span>أضف للسلة 🛒</span>
                        </motion.button>

                        {onOpenCalculatorForRecord && (
                          <button
                            type="button"
                            onClick={() => {
                              playTapSound();
                              onOpenCalculatorForRecord(p);
                            }}
                            className="w-full py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[9px] sm:text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>عرض بالحاسبة 🧮</span>
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
                  const displayName = order.customerName || 'عميل المتجر';
                  const displayPhone = order.customerPhone || 'بدون هاتف';
                  const displayAddress = (order as any).shippingAddress || (order as any).address || 'تسليم بالورشة';
                  
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
                              <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                                طلبية متجر 🛍️
                              </span>
                            </div>
                            <span className="text-[11px] text-[#EADBC8] font-mono" dir="ltr">
                              📞 {displayPhone}
                            </span>
                            {displayAddress && (
                              <span className="text-[10px] text-stone-400 block mt-0.5">
                                📍 {displayAddress}
                              </span>
                            )}
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
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center space-y-5">
            {/* Printable Frame */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#FDFBF7] text-[#0A1128] border-4 border-amber-500 shadow-2xl max-w-sm w-full space-y-4">
              <div className="space-y-2">
                <div className="flex justify-center">
                  <AlShamsBrandLogo maxWidth={155} maxHeight={64} isDark={false} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 block">
                  منظومة الشمساوية • هاند ميد مصر ☀️
                </span>
                <h3 className="text-lg sm:text-xl font-black text-[#0A1128]">
                  {profile.brandName || profile.artistName}
                </h3>
                <p className="text-xs text-stone-600 font-bold">
                  امسح الكود بكاميرا الموبايل لزيارة متجرنا وطلب القطع المصنوعة بحب وعناية ✨
                </p>
              </div>

              {/* Native High-Resolution QR Canvas */}
              <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden border-2 border-[#0A1128] p-2 bg-white shadow-inner flex items-center justify-center">
                <QRCodeCanvas
                  id="workshop-qr-canvas"
                  value={storeUrl}
                  size={216}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: '/brand_icon_light.png',
                    x: undefined,
                    y: undefined,
                    height: 44,
                    width: 44,
                    excavate: true,
                  }}
                />
              </div>

              <div className="space-y-1 border-t border-stone-200 pt-2">
                <span className="text-[10px] font-bold text-emerald-700 block">
                  🛡️ مشغولات يدوية أصلية 100% بضمان الجودة العالية
                </span>
                <div className="text-[10px] sm:text-[11px] font-mono text-stone-700 truncate" dir="ltr">
                  {storeUrl}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 max-w-lg">
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleDownloadHighResPoster}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg transition"
              >
                <span>🖼️</span>
                <span>تحميل بوستر الورشة عالي الدقة للطباعة</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleDownloadQR}
                className="px-3.5 py-2.5 rounded-xl bg-[#131E38] hover:bg-[#1D2F57] border border-amber-500/40 text-amber-300 font-black text-xs flex items-center gap-2 cursor-pointer transition shadow-xs"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>تحميل كود QR 💾</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handlePrintPoster}
                className="px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-black text-xs flex items-center gap-2 cursor-pointer transition"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة 🖨️</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleShareStoreWhatsApp}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة كارت المتجر واتساب 📲</span>
              </motion.button>
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
