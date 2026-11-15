import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, SavedProductRecord, InvoiceRecord } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  playSuccessSound,
  playAlertSound,
  playTapSound,
  playAddToCartSound,
} from '../../lib/sounds';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';
import { supabase } from '../../lib/supabase';
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
  RotateCcw,
  DollarSign,
  X,
  Search,
  Sparkles,
  Eye,
  EyeOff,
  ShoppingBag,
  ShieldCheck,
  Palette,
  Megaphone,
  Edit3,
  PackageCheck,
  Coins,
} from 'lucide-react';
import { addToCart } from '../../services/marketplaceCartService';
import { getWorkshopCleanSlug, getWorkshopStoreUrl } from '../../utils/slugify';
import { AlShamsBrandLogo } from '../brand/BrandAssets';
import {
  ArtisanStoreConfig,
  getStoredArtisanStoreConfig,
  saveStoredArtisanStoreConfig,
  saveArtisanStoreConfigCloud,
  resolveProductOfferPricing,
} from '../../types/artisanStoreBuilder';
import { SUPPORTED_CURRENCIES, getCurrencyInfo, toEgpAmount } from '../../lib/currency';
import {
  publishProductToMarketplace,
  fetchPublicStorefrontBySlug,
} from '../../db/marketplaceCloud';
import { ArtisanProductEditorModal } from './ArtisanProductEditorModal';
import { ArtisanStorefrontBuilderPanel } from './ArtisanStorefrontBuilderPanel';
import { PublicStorefrontView } from './PublicStorefrontView';

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

type BuilderTabId = 'products' | 'appearance' | 'promotions' | 'orders' | 'qr';

export const ArtisanStorefrontModal: React.FC<ArtisanStorefrontModalProps> = ({
  isOpen,
  onClose,
  profile,
  initialOrderId,
  onOpenCalculatorForRecord,
}) => {
  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const artisanSlug = getWorkshopCleanSlug(profile);
  const storeUrl = getWorkshopStoreUrl(profile);

  const [activeTab, setActiveTab] = useState<BuilderTabId>('products');
  const [products, setProducts] = useState<SavedProductRecord[]>([]);
  const [orders, setOrders] = useState<InvoiceRecord[]>([]);
  const [treasuries, setTreasuries] = useState<TreasuryAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  // Storefront Builder Config (Themes, Currency, Identity, Promo Banner, Coupons, Portfolio)
  const [storeConfig, setStoreConfig] = useState<ArtisanStoreConfig>(() =>
    getStoredArtisanStoreConfig(tenantId)
  );
  const [savingConfig, setSavingConfig] = useState(false);
  const [isOwnerPreviewOpen, setIsOwnerPreviewOpen] = useState(false);

  // Products filtering & editing
  const [prodSearch, setProdSearch] = useState('');
  const [prodVisibilityFilter, setProdVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [editingProduct, setEditingProduct] = useState<SavedProductRecord | null>(null);

  // Orders filtering & modals
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [collectingOrder, setCollectingOrder] = useState<InvoiceRecord | null>(null);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [collectionMethod, setCollectionMethod] = useState<'cash' | 'instapay' | 'vodafone_cash' | 'bank'>('instapay');

  const [returningOrder, setReturningOrder] = useState<InvoiceRecord | null>(null);
  const [returnType, setReturnType] = useState<'full' | 'partial'>('full');
  const [returnAmount, setReturnAmount] = useState<number>(0);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnRestock, setReturnRestock] = useState<boolean>(true);

  const [schedulingOrder, setSchedulingOrder] = useState<InvoiceRecord | null>(null);
  const [scheduledDeliveryDate, setScheduledDeliveryDate] = useState<string>('');

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3800);
  };

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

        // Hydrate store config from server if available, else local cache
        const localCfg = getStoredArtisanStoreConfig(tenantId);
        if (isMounted) setStoreConfig(localCfg);
        try {
          const remoteStore = await fetchPublicStorefrontBySlug(artisanSlug || tenantId);
          if (isMounted && remoteStore?.workshop?.storeConfig) {
            const merged = saveStoredArtisanStoreConfig(tenantId, remoteStore.workshop.storeConfig);
            setStoreConfig(merged);
          }
        } catch {}

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
          setProducts(prods || []);
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
    const handleRefresh = () => loadData();
    window.addEventListener('alshams:products-pulled', handleRefresh);
    window.addEventListener('alshams_products_changed', handleRefresh);
    return () => {
      isMounted = false;
      window.removeEventListener('alshams:products-pulled', handleRefresh);
      window.removeEventListener('alshams_products_changed', handleRefresh);
    };
  }, [isOpen, tenantId, initialOrderId, artisanSlug]);

  const handleSaveStoreConfigCloud = async (nextCfg: ArtisanStoreConfig) => {
    setSavingConfig(true);
    try {
      const res = await saveArtisanStoreConfigCloud(tenantId, nextCfg, profile.email);
      setStoreConfig(res.config);
      playSuccessSound();
      showNotice(
        res.cloudSynced
          ? '✓ تم حفظ إعدادات متجرك وتحديثها مباشرة للعملاء!'
          : '✓ تم حفظ إعدادات متجرك محلياً بنجاح'
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCurrencyChange = async (newCode: string) => {
    const nextCfg: ArtisanStoreConfig = {
      ...storeConfig,
      storeCurrency: getCurrencyInfo(newCode).code,
    };
    setStoreConfig(nextCfg);
    saveStoredArtisanStoreConfig(tenantId, nextCfg);
    await handleSaveStoreConfigCloud(nextCfg);
  };

  const handleSaveEditedProduct = async (updated: SavedProductRecord) => {
    await tenantStorage.mutateProduct(updated);
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    window.dispatchEvent(new CustomEvent('alshams_products_changed', { detail: { tenantId } }));

    // Sync to central marketplace with EGP auto-conversion + variants + discount + visibility
    await publishProductToMarketplace(updated, profile).catch(() => {});
    playSuccessSound();
    showNotice(`✓ تم تحديث "${updated.productName}" ومزامنته مع متجرك وسوق الشمساوية`);
  };

  const handleToggleProductVisibility = async (p: SavedProductRecord) => {
    playTapSound();
    const currentlyVisible = p.inStore !== false && p.isPublishedInStore !== false;
    const nextVisible = !currentlyVisible;
    const updated: SavedProductRecord = {
      ...p,
      inStore: nextVisible,
      isPublishedInStore: nextVisible,
      updatedAt: Date.now(),
    };
    await tenantStorage.mutateProduct(updated);
    setProducts((prev) => prev.map((item) => (item.id === p.id ? updated : item)));
    await publishProductToMarketplace(updated, profile).catch(() => {});
    playSuccessSound();
    showNotice(
      nextVisible
        ? `✓ تم إظهار "${p.productName}" في المتجر`
        : `✓ تم إخفاء "${p.productName}" مؤقتاً من واجهة المتجر`
    );
  };

  // Helper to sync order lifecycle updates to server when online
  const syncWorkshopOrderStatus = async (orderId: string, status: string, deliveryDate?: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (profile.email) headers['x-user-email'] = profile.email;
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
      } catch {}
      await fetch(`/api/workshop/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, deliveryDate }),
      });
    } catch {}
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
    const text = `أهلاً بحضرتك في متجر "${profile.brandName || profile.artistName}" على منظومة الشمساوية ☀️\nاستعرض كافة منتجاتنا ومشغولاتنا اليدوية المصنوعة بحب وعناية، واطلب قطعتك المخصصة بضمان الجودة الحرفية من هنا:\n${storeUrl}`;
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

      ctx.fillStyle = '#060B18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 16;
      ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.strokeRect(54, 54, canvas.width - 108, canvas.height - 108);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 36px Cairo, sans-serif';
      ctx.fillText('☀️ عائلة الشمساوية للفنون اليدوية', 600, 160);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 64px Cairo, sans-serif';
      ctx.fillText(profile.brandName || profile.artistName || 'ورشة فنية', 600, 270);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '500 32px Cairo, sans-serif';
      ctx.fillText('أرقى المشغولات اليدوية والديكورات الحرفية الفاخرة', 600, 340);

      ctx.fillStyle = '#FFFFFF';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(260, 430, 680, 720, 32);
        ctx.fill();
      } else {
        ctx.fillRect(260, 430, 680, 720);
      }

      ctx.drawImage(qrCanvas, 320, 480, 560, 560);

      ctx.fillStyle = '#0C1427';
      ctx.font = 'bold 28px Cairo, sans-serif';
      ctx.fillText('امسح الكود بكاميرا الموبايل لزيارة المتجر والطلب', 600, 1090);

      ctx.fillStyle = '#D97706';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(storeUrl, 600, 1130);

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
      showNotice('✓ تم تنزيل بوستر الورشة عالي الدقة للطباعة بنجاح!');
    } catch {
      showNotice('تعذر توليد البوستر.');
    }
  };

  // Quick Add To Cart (always converts to EGP for unified cart accounting)
  const handleQuickAddToCart = (p: SavedProductRecord) => {
    playAddToCartSound();
    const resolved = resolveProductOfferPricing(p, p.sizeVariants?.[0]?.label, 'EGP', false);
    addToCart({
      id: `cart_${p.id}_${Date.now()}`,
      productId: p.id,
      productName: p.productName,
      imageUrl: p.imageUrl || '',
      workshopId: tenantId,
      artistName: profile.brandName || profile.artistName || 'ورشة الشمساوية',
      quantity: 1,
      price: resolved.egpFinalPrice || toEgpAmount(p.storePrice || p.retailPrice || 0, storeConfig.storeCurrency),
      craftName: p.category || 'مشغولة يدوية',
      selectedSize: p.sizeVariants?.[0]?.label,
      isFreeShipping: resolved.isFreeShipping,
    });
    showNotice(`✓ تمت إضافة "${p.productName}" إلى سلة المتجر بنجاح`);
  };

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
      await syncWorkshopOrderStatus(updated.id, 'in_progress', scheduledDeliveryDate);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSchedulingOrder(null);
      playSuccessSound();
      showNotice(`✓ تم بدء تجهيز الأوردر #${updated.invoiceNumber} وموعد التسليم: ${scheduledDeliveryDate}`);
    } catch (err: any) {
      showNotice('تعذر تحديث الأوردر: ' + err.message);
    }
  };

  // Order Lifecycle 2: Mark Packed ("تم التجهيز والتغليف")
  const handleMarkPacked = async (order: InvoiceRecord) => {
    try {
      const updated: InvoiceRecord = {
        ...order,
        status: 'packed',
        updatedAt: Date.now(),
      };
      await tenantStorage.recordSalesOrder(updated);
      await syncWorkshopOrderStatus(updated.id, 'packed');
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      playSuccessSound();
      showNotice(`✓ الأوردر #${updated.invoiceNumber} جاهز ومغلف للشحن!`);
    } catch (err: any) {
      showNotice('تعذر تحديث الأوردر: ' + err.message);
    }
  };

  // Order Lifecycle 3: Shipping -> Update Status + WhatsApp if client data is NOT hidden
  const handleStartShipping = async (order: InvoiceRecord) => {
    const remaining = Math.max(0, (order.finalTotal || 0) - (order.paidAmount || 0));
    const itemNames = order.items?.map((i) => i.productName).join(' + ') || 'مشغولات هاند ميد';
    const waText =
      `أهلاً بحضرتك يا فندم! 🌸\n` +
      `بنفرحك إن أوردرك رقم #${order.invoiceNumber} (${itemNames}) من ورشة "${profile.brandName || profile.artistName}" تم تجهيزه بحب وعناية وهو الآن في طريقه إليك مع مندوب الشحن! 🚚✨\n\n` +
      `💰 تفاصيل الفاتورة:\n` +
      `- إجمالي الحساب: ${order.finalTotal} ${profile.currencySymbol || 'ج.م'}\n` +
      `- المدفوع مقدماً (العربون): ${order.paidAmount || 0} ${profile.currencySymbol || 'ج.م'}\n` +
      `- المتبقي عند الاستلام: ${remaining} ${profile.currencySymbol || 'ج.م'}\n\n` +
      `شرفتنا ونورت عيلة الشمساوية، ونتمنى تعجبك المشغولة! ☀️`;

    try {
      const updated: InvoiceRecord = {
        ...order,
        status: 'shipped',
        updatedAt: Date.now(),
      };
      await tenantStorage.recordSalesOrder(updated);
      await syncWorkshopOrderStatus(updated.id, 'shipped');
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      playSuccessSound();
      showNotice(
        order.isClientDataHiddenFromArtisan
          ? '✓ تم تحويل الأوردر إلى [جاري الشحن] — سيتم الإشعار عبر فريق الشحن المركزي'
          : '✓ تم تحديث حالة الأوردر إلى [جاري الشحن] وفتح رسالة الواتساب للعميل'
      );
    } catch {}

    if (!order.isClientDataHiddenFromArtisan) {
      const clientPhone = (order.customerPhone || '').replace(/\D/g, '');
      const waUrl = clientPhone
        ? `https://wa.me/${clientPhone}?text=${encodeURIComponent(waText)}`
        : `https://wa.me/?text=${encodeURIComponent(waText)}`;
      window.open(waUrl, '_blank');
    }
  };

  // Order Lifecycle 4: Collect Remaining -> Deposit into Treasury
  const handleConfirmCollection = async () => {
    if (!collectingOrder) return;
    const remaining = Math.max(0, (collectingOrder.finalTotal || 0) - (collectingOrder.paidAmount || 0));

    try {
      const updated: InvoiceRecord = {
        ...collectingOrder,
        status: 'delivered',
        paidAmount: collectingOrder.finalTotal,
        paymentStatus: 'paid',
        updatedAt: Date.now(),
      };
      await tenantStorage.recordSalesOrder(updated);
      await syncWorkshopOrderStatus(updated.id, 'delivered');
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

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
          notes: `تحصيل باقي فاتورة أوردر متجر #${collectingOrder.invoiceNumber} via ${collectionMethod}`,
          createdAt: Date.now(),
          createdBy: profile.artistName || 'artisan',
          referenceId: collectingOrder.id,
        });
        window.dispatchEvent(new CustomEvent('alshams_treasury_updated', { detail: { tenantId } }));
      }

      playSuccessSound();
      showNotice(`✓ تم تأكيد تسليم الأوردر وتحصيل ${remaining} ${profile.currencySymbol || 'ج.م'} وإيداعها بالخزينة!`);
      setCollectingOrder(null);
    } catch (err: any) {
      showNotice('تعذر إتمام التحصيل: ' + err.message);
    }
  };

  // Order Lifecycle 5: Returns Management
  const handleConfirmReturn = async () => {
    if (!returningOrder) return;
    const isFull = returnType === 'full';
    const amountToDeduct = isFull ? (returningOrder.paidAmount || returningOrder.finalTotal || 0) : (Number(returnAmount) || 0);

    try {
      const updated: InvoiceRecord = {
        ...returningOrder,
        status: isFull ? 'cancelled' : 'delivered',
        notes: `${returningOrder.notes || ''}\n[مرتجع بتاريخ ${new Date().toLocaleDateString('ar-EG')} بمبلغ ${amountToDeduct} - السبب: ${returnReason || 'غير محدد'}]`,
        updatedAt: Date.now(),
      };
      await tenantStorage.recordSalesOrder(updated);
      await syncWorkshopOrderStatus(updated.id, updated.status || 'cancelled');
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

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
          notes: `رد قيمة مرتجع أوردر #${returningOrder.invoiceNumber}`,
          createdAt: Date.now(),
          createdBy: profile.artistName || 'artisan',
          referenceId: returningOrder.id,
        });
        window.dispatchEvent(new CustomEvent('alshams_treasury_updated', { detail: { tenantId } }));
      }

      playAlertSound();
      showNotice(`✓ تم تسجيل المرتجع بقيمة ${amountToDeduct} ${profile.currencySymbol || 'ج.م'} وتعديل رصيد الخزينة`);
      setReturningOrder(null);
    } catch (err: any) {
      showNotice('تعذر معالجة المرتجع: ' + err.message);
    }
  };

  // Filtered products & orders
  const filteredProducts = useMemo(() => {
    const q = prodSearch.toLowerCase().trim();
    return products.filter((p) => {
      const visible = p.inStore !== false && p.isPublishedInStore !== false;
      if (prodVisibilityFilter === 'visible' && !visible) return false;
      if (prodVisibilityFilter === 'hidden' && visible) return false;
      if (!q) return true;
      return (
        p.productName.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.storeDescription || '').toLowerCase().includes(q)
      );
    });
  }, [products, prodSearch, prodVisibilityFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    return orders.filter((o) => {
      if (orderStatusFilter !== 'all') {
        const st = o.status || 'pending';
        if (orderStatusFilter === 'shipped') {
          if (st !== 'shipped' && st !== 'shipping') return false;
        } else if (orderStatusFilter === 'completed') {
          if (st !== 'delivered' && st !== 'completed') return false;
        } else if (st !== orderStatusFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        String(o.invoiceNumber || '').toLowerCase().includes(q) ||
        (!o.isClientDataHiddenFromArtisan &&
          ((o.customerName || '').toLowerCase().includes(q) ||
            (o.customerPhone || '').toLowerCase().includes(q)))
      );
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const storeStats = useMemo(() => {
    const visibleProductsCount = products.filter(
      (p) => p.inStore !== false && p.isPublishedInStore !== false
    ).length;
    const activeOrdersCount = orders.filter((o) =>
      ['pending', 'in_progress', 'packed', 'shipped', 'shipping'].includes(o.status || 'pending')
    ).length;
    const totalSales = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((acc, o) => acc + (Number(o.finalTotal) || 0), 0);
    return { visibleProductsCount, activeOrdersCount, totalSales };
  }, [products, orders]);

  if (!isOpen) return null;

  if (isOwnerPreviewOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F2ECE1] dark:bg-[#060B18] overflow-y-auto">
        <PublicStorefrontView
          slug={artisanSlug || tenantId}
          isOwnerPreview={true}
          onClosePreview={() => setIsOwnerPreviewOpen(false)}
          localFallbackProducts={products}
          ownerProfile={profile}
        />
      </div>
    );
  }

  const activeCurrencyMeta = getCurrencyInfo(storeConfig.storeCurrency);
  const pendingOrdersCount = orders.filter((o) =>
    ['pending', 'in_progress', 'packed'].includes(o.status || '')
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#060B18]/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#F2ECE1] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] w-full max-w-6xl max-h-[94vh] rounded-3xl border-2 border-[#D4CCBC] dark:border-[#EA580C]/45 shadow-2xl flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#F7F3EA] dark:bg-[#0D162E] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E9E2D4] to-[#F5DFC6] dark:from-[#EA580C]/20 dark:to-[#F59E0B]/10 border border-[#EA580C]/35 text-[#C2410C] dark:text-amber-300 flex items-center justify-center shadow-md shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-amber-300 truncate">
                  لوحة متجر ورشة {profile.brandName || profile.artistName}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/30 text-[10px] font-black shrink-0">
                  متصل ومفعل
                </span>
              </div>
              <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] font-medium truncate">
                تحكم في منتجاتك، مقاساتها وأسعارها، الثيمات، البانر، أكواد الخصم ودورة الطلبات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsOwnerPreviewOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#0C1427] dark:bg-[#132040] hover:bg-[#EA580C] text-[#FBBF24] hover:text-white border border-[#22355E] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">معاينة المتجر العام</span>
            </button>
            <div className="hidden md:block dark:hidden">
              <AlShamsBrandLogo maxWidth={110} maxHeight={40} isDark={false} />
            </div>
            <div className="hidden dark:md:block">
              <AlShamsBrandLogo maxWidth={110} maxHeight={40} isDark={true} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] border border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-4 py-2 bg-[#F5DFC6]/80 dark:bg-amber-500/20 border-b border-[#EA580C]/30 text-[#9A3412] dark:text-amber-200 text-xs font-bold text-center">
            {feedback}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-3 sm:px-5 pt-2.5 bg-[#E9E2D4] dark:bg-[#060B18] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            {
              id: 'products' as BuilderTabId,
              label: `المنتجات والأسعار (${products.length})`,
              icon: ShoppingBag,
            },
            {
              id: 'appearance' as BuilderTabId,
              label: 'المظهر والهوية والمعرض',
              icon: Palette,
            },
            {
              id: 'promotions' as BuilderTabId,
              label: `البانر وأكواد الخصم (${storeConfig.coupons.length})`,
              icon: Megaphone,
            },
            {
              id: 'orders' as BuilderTabId,
              label: `الطلبات والتجهيز (${orders.length})`,
              icon: Package,
              badge: pendingOrdersCount,
            },
            {
              id: 'qr' as BuilderTabId,
              label: 'رابط المتجر و QR',
              icon: QrCode,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  playTapSound();
                  setActiveTab(tab.id);
                }}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-2xl font-black text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#F2ECE1] dark:bg-[#0D162E] text-[#C2410C] dark:text-amber-300 border-t-2 border-x-2 border-[#EA580C]/60 dark:border-amber-500/50 shadow-sm'
                    : 'text-[#334155] dark:text-[#CBD5E1] hover:text-[#0C1427] dark:hover:text-[#F7F3EA]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#EA580C] dark:text-amber-400 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black">
                    {tab.badge}
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </div>

        {/* TAB 1: Products Studio, Currency, Sizes & Discounts */}
        {activeTab === 'products' && (
          <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-4">
            {/* Compact Store Performance Strip */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block">المعروض للعملاء</span>
                  <span className="text-base sm:text-lg font-black font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA]">
                    {storeStats.visibleProductsCount} منتج
                  </span>
                </div>
                <ShoppingBag className="w-5 h-5 text-[#EA580C] opacity-75 shrink-0 hidden sm:block" />
              </div>

              <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block">طلبات جارية</span>
                  <span className="text-base sm:text-lg font-black font-mono tabular-nums text-amber-700 dark:text-amber-300">
                    {storeStats.activeOrdersCount} طلب
                  </span>
                </div>
                <Package className="w-5 h-5 text-amber-600 opacity-75 shrink-0 hidden sm:block" />
              </div>

              <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block">إجمالي مبيعات المتجر</span>
                  <span className="text-base sm:text-lg font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {storeStats.totalSales.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
                <DollarSign className="w-5 h-5 text-emerald-600 opacity-75 shrink-0 hidden sm:block" />
              </div>
            </div>

            {/* Currency Switcher & Search Toolbar */}
            <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#475569]" />
                  <input
                    type="text"
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    placeholder="ابحث في منتجات متجرك..."
                    className="w-full h-9 pr-9 pl-3 rounded-xl bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#E9E2D4] dark:bg-[#060B18] p-1 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black">
                  {[
                    { id: 'all' as const, label: 'الكل' },
                    { id: 'visible' as const, label: 'الظاهرة' },
                    { id: 'hidden' as const, label: 'المخفية' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setProdVisibilityFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                        prodVisibilityFilter === f.id
                          ? 'bg-[#EA580C] text-white'
                          : 'text-[#334155] dark:text-[#CBD5E1]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-black text-[#C2410C] dark:text-amber-300 flex items-center gap-1 shrink-0">
                  <Coins className="w-4 h-4" />
                  <span>عملة تسعير الورشة:</span>
                </span>
                <select
                  value={storeConfig.storeCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black cursor-pointer outline-none focus:border-[#EA580C]"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.nameAr} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeCurrencyMeta.code !== 'EGP' && (
              <div className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-500/40 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                💡 عملة ورشتك الحالية ({activeCurrencyMeta.nameAr}) — يتم تحويل أسعارك تلقائياً إلى الجنيه المصري (ج.م) عند العرض في سوق الشمساوية المركزي.
              </div>
            )}

            {/* Products Grid */}
            {loading ? (
              <div className="p-10 text-center text-xs font-bold text-[#475569]">جاري تحميل منتجات الورشة...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-10 text-center rounded-3xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
                <Store className="w-12 h-12 mx-auto text-[#EA580C]/70" />
                <h4 className="text-sm font-black text-[#0C1427] dark:text-amber-200">
                  لا توجد منتجات مطابقة في قائمة متجرك
                </h4>
                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] max-w-md mx-auto">
                  احفظ أي مشغولة من حاسبة التكاليف وستظهر هنا مع كامل صلاحيات تعديل السعر والمقاسات والعروض.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredProducts.map((p) => {
                  const isVisible = p.inStore !== false && p.isPublishedInStore !== false;
                  const pricing = resolveProductOfferPricing(
                    p,
                    p.sizeVariants?.[0]?.label,
                    activeCurrencyMeta.code,
                    false
                  );
                  const sizesCount = p.sizeVariants?.length || p.availableSizes?.length || 0;

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border p-3 flex flex-col justify-between transition shadow-sm ${
                        isVisible
                          ? 'border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                          : 'border-dashed border-rose-400/60 opacity-80'
                      }`}
                    >
                      <div>
                        <div className="relative w-full h-36 rounded-xl overflow-hidden bg-[#E9E2D4] dark:bg-[#132040] mb-2.5 border border-[#D4CCBC] dark:border-[#22355E]">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.productName} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#EA580C]/60">
                              <ShoppingBag className="w-8 h-8" />
                            </div>
                          )}

                          {/* Single clean status tag */}
                          {pricing.badgeText ? (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-[#0C1427]/90 text-[#FBBF24] text-[10px] font-black shadow-xs">
                              {pricing.badgeText}
                            </span>
                          ) : !isVisible ? (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black shadow-xs">
                              مخفي عن العملاء
                            </span>
                          ) : null}

                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-[#0C1427]/85 text-amber-300 font-mono text-xs font-black tabular-nums">
                            {pricing.hasDiscount && (
                              <span className="line-through opacity-60 text-[10px] ml-1.5">
                                {pricing.originalPrice}
                              </span>
                            )}
                            <span>
                              {pricing.finalPrice} {activeCurrencyMeta.symbol}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 mb-2.5">
                          <h4 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA] truncate">
                            {p.productName}
                          </h4>
                          <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] truncate">
                            {p.craftName || p.category} ·{' '}
                            {sizesCount > 0 ? `${sizesCount} مقاسات` : 'مقاس موحد'} ·{' '}
                            {(p.currentStock || 0) > 0 ? `مخزون: ${p.currentStock}` : 'بالطلب'}
                          </p>
                          {p.storeDescription && (
                            <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] line-clamp-1">
                              {p.storeDescription}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-1.5 text-xs">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="py-1.5 px-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل ومقاسات</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleProductVisibility(p)}
                            className={`py-1.5 px-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 border cursor-pointer transition ${
                              isVisible
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                                : 'bg-[#E9E2D4] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                            }`}
                          >
                            {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span>{isVisible ? 'ظاهر' : 'إظهار'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickAddToCart(p)}
                            className="flex-1 py-1 rounded-lg bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] text-[#0C1427] dark:text-[#F7F3EA] text-[10px] font-bold cursor-pointer"
                          >
                            تجربة السلة
                          </button>
                          {onOpenCalculatorForRecord && (
                            <button
                              type="button"
                              onClick={() => {
                                playTapSound();
                                onOpenCalculatorForRecord(p);
                              }}
                              className="flex-1 py-1 rounded-lg bg-[#E9E2D4] hover:bg-[#DFD7C6] dark:bg-[#132040] dark:hover:bg-[#1A2B54] text-[#C2410C] dark:text-amber-300 text-[10px] font-bold cursor-pointer"
                            >
                              الحاسبة
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Appearance, Themes, Story & Before/After Gallery */}
        {activeTab === 'appearance' && (
          <ArtisanStorefrontBuilderPanel
            mode="appearance"
            config={storeConfig}
            saving={savingConfig}
            onChange={(next) => {
              setStoreConfig(next);
              saveStoredArtisanStoreConfig(tenantId, next);
            }}
            onSaveCloud={handleSaveStoreConfigCloud}
            onOpenPreview={() => setIsOwnerPreviewOpen(true)}
          />
        )}

        {/* TAB 3: Promo Banner & Store Coupons */}
        {activeTab === 'promotions' && (
          <ArtisanStorefrontBuilderPanel
            mode="promotions"
            config={storeConfig}
            saving={savingConfig}
            onChange={(next) => {
              setStoreConfig(next);
              saveStoredArtisanStoreConfig(tenantId, next);
            }}
            onSaveCloud={handleSaveStoreConfigCloud}
          />
        )}

        {/* TAB 4: Orders & 5-Stage Fulfillment Lifecycle (Client Privacy Protected) */}
        {activeTab === 'orders' && (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[#475569]" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="ابحث برقم الطلب..."
                    className="w-full h-9 pr-9 pl-3 rounded-xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                  />
                </div>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                >
                  <option value="all">جميع الحالات ({orders.length})</option>
                  <option value="pending">تم الاستلام / جديد</option>
                  <option value="in_progress">جاري التجهيز</option>
                  <option value="packed">تم التغليف</option>
                  <option value="shipped">جاري الشحن</option>
                  <option value="completed">مكتمل</option>
                </select>
              </div>
              <span className="text-xs text-[#475569] dark:text-[#94A3B8] font-mono tabular-nums">
                عرض {filteredOrders.length} من {orders.length}
              </span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
                <Package className="w-12 h-12 mx-auto text-[#EA580C]/70" />
                <h4 className="text-sm font-black text-[#0C1427] dark:text-amber-200">لا توجد طلبيات مطابقة حالياً</h4>
                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] max-w-md mx-auto">
                  عند قيام العملاء بالطلب عبر رابط متجرك أو سوق الشمساوية، ستظهر الطلبات هنا بالترتيب.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const remaining = Math.max(0, (order.finalTotal || 0) - (order.paidAmount || 0));
                  const clientHidden = Boolean(order.isClientDataHiddenFromArtisan);
                  const displayName = clientHidden
                    ? 'عميل سوق الشمساوية (الشحن المركزي)'
                    : order.customerName || 'عميل المتجر';
                  const displayPhone = clientHidden ? 'محمي لإدارة الشحن المركزي' : order.customerPhone || 'بدون هاتف';
                  const displayAddress = clientHidden
                    ? `محافظة ${order.governorate || 'مصر'} — الشحن عبر منظومة الشمساوية`
                    : order.detailedAddress || (order as any).shippingAddress || (order as any).address || 'تسليم بالورشة';

                  const targetDelivery = order.targetDeliveryDate || (order as any).dueDate || order.deliveryDate;
                  const daysRemaining = targetDelivery
                    ? Math.ceil((new Date(targetDelivery).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  const st = order.status || 'pending';

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 h-8 rounded-xl bg-[#E9E2D4] dark:bg-amber-500/20 text-[#C2410C] dark:text-amber-300 flex items-center justify-center font-mono font-bold text-xs">
                            #{order.invoiceNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA]">{displayName}</h5>
                              {clientHidden && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>وضع الخصوصية</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#334155] dark:text-[#CBD5E1] font-mono" dir={clientHidden ? 'rtl' : 'ltr'}>
                              {displayPhone}
                            </span>
                            <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] block mt-0.5">
                              {displayAddress}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {daysRemaining !== null && st !== 'completed' && st !== 'delivered' && st !== 'cancelled' && (
                            <span
                              className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 font-mono ${
                                daysRemaining > 2
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300'
                                  : daysRemaining > 0
                                  ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-900 dark:text-orange-300 border-orange-300'
                                  : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                {daysRemaining > 0
                                  ? `باقي ${daysRemaining} يوم`
                                  : daysRemaining === 0
                                  ? 'التسليم اليوم'
                                  : `متأخر ${Math.abs(daysRemaining)} يوم`}
                              </span>
                            </span>
                          )}

                          {st === 'pending' && (
                            <span className="px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 text-xs font-black">
                              تم الاستلام 🆕
                            </span>
                          )}
                          {st === 'in_progress' && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-black">
                              جاري التجهيز 🔨
                            </span>
                          )}
                          {st === 'packed' && (
                            <span className="px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-xs font-black">
                              تم التجهيز والتغليف 📦
                            </span>
                          )}
                          {(st === 'shipped' || st === 'shipping') && (
                            <span className="px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 text-xs font-black">
                              جاري الشحن 🚚
                            </span>
                          )}
                          {(st === 'completed' || st === 'delivered') && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-black">
                              تم التسليم والتحصيل ✓
                            </span>
                          )}
                          {st === 'cancelled' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 text-xs font-black">
                              مرتجع / ملغي ✕
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items & Financials */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                          <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] block mb-0.5">الأصناف المطلوبة</span>
                          <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA] line-clamp-1">
                            {order.items?.map((i) => `${i.productName} (${i.quantity})`).join('، ') || 'مشغولة يدوية'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                          <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] block mb-0.5">الحساب المالي</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                            إجمالي: {order.finalTotal} | مسدد: {order.paidAmount || 0} {profile.currencySymbol || 'ج.م'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                          <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] block mb-0.5">المتبقي للتحصيل</span>
                          <span className="font-black text-[#C2410C] dark:text-amber-300 font-mono tabular-nums text-sm">
                            {remaining} {profile.currencySymbol || 'ج.م'}
                          </span>
                        </div>
                      </div>

                      {/* 5-Step Lifecycle Action Controls */}
                      <div className="pt-2 flex flex-wrap items-center justify-end gap-2 text-xs">
                        {st === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSchedulingOrder(order);
                              const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
                              setScheduledDeliveryDate(inThreeDays);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Clock className="w-4 h-4" />
                            <span>بدء التجهيز وتحديد موعد التسليم</span>
                          </button>
                        )}

                        {st === 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => handleMarkPacked(order)}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>تم التجهيز والتغليف 📦</span>
                          </button>
                        )}

                        {(st === 'packed' || st === 'in_progress' || st === 'pending') && (
                          <button
                            type="button"
                            onClick={() => handleStartShipping(order)}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Truck className="w-4 h-4" />
                            <span>
                              {clientHidden ? 'تحويل للشحن المركزي 🚚' : 'جاري الشحن (إرسال واتساب) 🚚'}
                            </span>
                          </button>
                        )}

                        {st !== 'completed' && st !== 'delivered' && st !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setCollectingOrder(order)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تم التسليم والتحصيل ({remaining} {profile.currencySymbol || 'ج.م'})</span>
                          </button>
                        )}

                        {st !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturningOrder(order);
                              setReturnAmount(order.paidAmount || order.finalTotal || 0);
                            }}
                            className="px-2.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>مرتجع</span>
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

        {/* TAB 5: Store URL, QR Code & Marketing Poster */}
        {activeTab === 'qr' && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center space-y-5">
            <div className="p-3 rounded-2xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-center gap-2 max-w-xl w-full text-xs">
              <span className="font-black text-[#C2410C] dark:text-amber-300">رابط متجرك المباشر:</span>
              <span className="font-mono text-emerald-800 dark:text-emerald-300 text-[11px] bg-[#E9E2D4] dark:bg-[#060B18] px-2.5 py-1 rounded-lg truncate max-w-xs" dir="ltr">
                {storeUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyStoreLink}
                className="px-3 py-1.5 rounded-xl bg-[#EA580C] text-white font-black flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ</span>
              </button>
            </div>

            <div className="p-5 sm:p-6 rounded-3xl bg-[#F7F3EA] text-[#0C1427] border-4 border-[#EA580C] shadow-2xl max-w-sm w-full space-y-4">
              <div className="space-y-2">
                <div className="flex justify-center">
                  <AlShamsBrandLogo maxWidth={155} maxHeight={64} isDark={false} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#C2410C] block">
                  منظومة الشمساوية • هاند ميد مصر ☀️
                </span>
                <h3 className="text-lg sm:text-xl font-black text-[#0C1427]">
                  {profile.brandName || profile.artistName}
                </h3>
                <p className="text-xs text-[#334155] font-bold">
                  امسح الكود بكاميرا الموبايل لزيارة متجرنا وطلب القطع المصنوعة بحب وعناية
                </p>
              </div>

              <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden border-2 border-[#0C1427] p-2 bg-[#FFFFFF] shadow-inner flex items-center justify-center">
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

              <div className="space-y-1 border-t border-[#D4CCBC] pt-2">
                <span className="text-[10px] font-bold text-emerald-700 block">
                  🛡️ مشغولات يدوية أصلية 100% بضمان الجودة العالية
                </span>
                <div className="text-[10px] sm:text-[11px] font-mono text-[#334155] truncate" dir="ltr">
                  {storeUrl}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-lg">
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleDownloadHighResPoster}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <span>تحميل بوستر الورشة عالي الدقة للطباعة</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleDownloadQR}
                className="px-3.5 py-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#C2410C] dark:text-amber-300 font-black text-xs flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تحميل كود QR</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handlePrintPoster}
                className="px-3.5 py-2.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] font-black text-xs flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleShareStoreWhatsApp}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة المتجر واتساب</span>
              </motion.button>
            </div>
          </div>
        )}

        {/* Product Editor Studio Modal */}
        {editingProduct && (
          <ArtisanProductEditorModal
            product={editingProduct}
            storeCurrency={storeConfig.storeCurrency}
            onClose={() => setEditingProduct(null)}
            onSave={handleSaveEditedProduct}
          />
        )}

        {/* Modal: Schedule Order Delivery */}
        {schedulingOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-xs">
            <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C] rounded-3xl p-5 max-w-md w-full space-y-4 text-right text-[#0C1427] dark:text-[#F7F3EA] shadow-2xl">
              <h4 className="font-black text-sm text-[#C2410C] dark:text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>تحديد موعد تسليم الأوردر #{schedulingOrder.invoiceNumber}</span>
              </h4>
              <p className="text-xs text-[#334155] dark:text-[#CBD5E1]">
                حدد تاريخ انتهاء تنفيذ القطعة وجاهزيتها للتسليم للعميل:
              </p>
              <input
                type="date"
                value={scheduledDeliveryDate}
                onChange={(e) => setScheduledDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSchedulingOrder(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#475569] dark:text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSchedule}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-bold text-xs cursor-pointer"
                >
                  تأكيد وبدء التجهيز
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Collect Payment and Handover */}
        {collectingOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-xs">
            <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-emerald-500 rounded-3xl p-5 max-w-md w-full space-y-4 text-right text-[#0C1427] dark:text-[#F7F3EA] shadow-2xl">
              <h4 className="font-black text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>تحصيل باقي فاتورة أوردر #{collectingOrder.invoiceNumber}</span>
              </h4>
              <div className="p-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#475569] dark:text-[#94A3B8]">اسم العميل:</span>
                  <span className="font-bold">
                    {collectingOrder.isClientDataHiddenFromArtisan
                      ? 'عميل سوق الشمساوية (محمي)'
                      : collectingOrder.customerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569] dark:text-[#94A3B8]">إجمالي الفاتورة:</span>
                  <span className="font-mono">{collectingOrder.finalTotal} {profile.currencySymbol || 'ج.م'}</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold border-t border-[#D4CCBC] dark:border-[#22355E] pt-1">
                  <span>المبلغ المطلوب تحصيله الآن:</span>
                  <span className="font-mono text-sm">
                    {Math.max(0, (collectingOrder.finalTotal || 0) - (collectingOrder.paidAmount || 0))}{' '}
                    {profile.currencySymbol || 'ج.م'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#C2410C] dark:text-amber-300 block">إيداع المبلغ في خزينة:</label>
                <select
                  value={selectedTreasuryId}
                  onChange={(e) => setSelectedTreasuryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                >
                  {treasuries.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.balance || 0} {profile.currencySymbol || 'ج.م'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#C2410C] dark:text-amber-300 block">طريقة الاستلام:</label>
                <div className="grid grid-cols-4 gap-1.5 text-xs text-center font-bold">
                  {(['cash', 'instapay', 'vodafone_cash', 'bank'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCollectionMethod(m)}
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        collectionMethod === m
                          ? 'bg-emerald-600 text-white border-emerald-400 font-black'
                          : 'bg-[#E9E2D4] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      {m === 'cash' ? 'كاش' : m === 'instapay' ? 'إنستاباي' : m === 'vodafone_cash' ? 'محفظة' : 'بنك'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectingOrder(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#475569] dark:text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCollection}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  تأكيد التسليم والإيداع بالخزينة ✓
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Process Returns */}
        {returningOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-xs">
            <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-rose-500 rounded-3xl p-5 max-w-md w-full space-y-4 text-right text-[#0C1427] dark:text-[#F7F3EA] shadow-2xl">
              <h4 className="font-black text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
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
                  className={`p-2 rounded-xl border text-center font-bold cursor-pointer ${
                    returnType === 'full' ? 'bg-rose-600 text-white border-rose-400' : 'bg-[#E9E2D4] dark:bg-[#132040]'
                  }`}
                >
                  مرتجع كلي (إلغاء الأوردر)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnType('partial')}
                  className={`p-2 rounded-xl border text-center font-bold cursor-pointer ${
                    returnType === 'partial' ? 'bg-rose-600 text-white border-rose-400' : 'bg-[#E9E2D4] dark:bg-[#132040]'
                  }`}
                >
                  مرتجع جزئي
                </button>
              </div>

              {returnType === 'partial' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#C2410C] dark:text-amber-300 block">
                    المبلغ المردود للعميل ({profile.currencySymbol || 'ج.م'}):
                  </label>
                  <input
                    type="number"
                    value={returnAmount}
                    onChange={(e) => setReturnAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#C2410C] dark:text-amber-300 block">سبب الإرجاع:</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: تغيير اللون / مقاس مختلف"
                  className="w-full px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id="restock_check"
                  checked={returnRestock}
                  onChange={(e) => setReturnRestock(e.target.checked)}
                  className="rounded accent-[#EA580C] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="restock_check" className="cursor-pointer font-bold">
                  إعادة القطع المسترجعة إلى رصيد مخزون الورشة تلقائياً
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturningOrder(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#475569] dark:text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                >
                  تأكيد تسجيل المرتجع
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
