import React, { useEffect, useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import {
  B2BSupplyOrder,
  SupplierCatalogItem,
  SupplierCustomer,
  SupplierTreasury,
  SUPPLIER_SUPPLY_SECTIONS,
} from '../../types/supplier';
import {
  fetchSupplierCatalog,
  fetchSupplierOrders,
  fetchSupplierCustomers,
  fetchSupplierFinance,
} from '../../db/supplierService';
import { fetchSupplierErpOverview } from '../../db/supplierErpService';
import { SupplierErpOverview } from '../../types/supplierErp';
import { useFeatureFlags } from '../../types/featureFlags';
import { isUserAdmin } from '../../types';
import {
  Boxes,
  Store,
  Package,
  Users,
  Wallet,
  Copy,
  Check,
  QrCode,
  AlertTriangle,
  TrendingUp,
  ArrowLeft,
  Truck,
  User,
  GitBranch,
  ShoppingCart,
  Warehouse,
  MonitorSmartphone,
  Clock,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';

interface SupplierHomeScreenProps {
  profile: UserProfile;
  onNavigateToCatalog: () => void;
  onOpenStorefrontModal: () => void;
  onNavigateToOrders: () => void;
  onNavigateToCustomers: () => void;
  onNavigateToFinance: () => void;
  onNavigateToErpHub?: () => void;
  onNavigateToPos?: () => void;
  onNavigateToWarehouseErp?: () => void;
  onNavigateToHrTerminal?: () => void;
  onNavigateToFamily?: () => void;
  onNavigateToPersonalProfile?: () => void;
  onNavigateToSuppliersMarket?: () => void;
  onPreviewPublicStore?: (slug: string) => void;
}

export const SupplierHomeScreen: React.FC<SupplierHomeScreenProps> = ({
  profile,
  onNavigateToCatalog,
  onOpenStorefrontModal,
  onNavigateToOrders,
  onNavigateToCustomers,
  onNavigateToFinance,
  onNavigateToErpHub,
  onNavigateToPos,
  onNavigateToWarehouseErp,
  onNavigateToHrTerminal,
  onNavigateToFamily,
  onNavigateToPersonalProfile,
  onNavigateToSuppliersMarket,
  onPreviewPublicStore,
}) => {
  const flags = useFeatureFlags();
  const showErpModules = isUserAdmin(profile) || flags.supplierErpEnabled !== false;
  const [catalog, setCatalog] = useState<SupplierCatalogItem[]>([]);
  const [orders, setOrders] = useState<B2BSupplyOrder[]>([]);
  const [customers, setCustomers] = useState<SupplierCustomer[]>([]);
  const [treasuries, setTreasuries] = useState<SupplierTreasury[]>([]);
  const [erpOverview, setErpOverview] = useState<SupplierErpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const currencySymbol = profile.currencySymbol || 'ج.م';
  const slug = profile.storeSlug || profile.store_slug || profile.id;
  const storeUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/#/supplier/${encodeURIComponent(slug)}`
      : `/#/supplier/${encodeURIComponent(slug)}`;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetchSupplierCatalog(),
      fetchSupplierOrders(),
      fetchSupplierCustomers(),
      fetchSupplierFinance(),
      fetchSupplierErpOverview(),
    ])
      .then(([cat, ord, cust, fin, erpOv]) => {
        if (!mounted) return;
        setCatalog(cat);
        setOrders(ord);
        setCustomers(cust);
        setTreasuries(fin.treasuries);
        setErpOverview(erpOv);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [profile.id]);

  const totalTreasuryBalance = useMemo(
    () => treasuries.reduce((sum, t) => sum + Number(t.balance || 0), 0),
    [treasuries]
  );

  const lowStockItems = useMemo(
    () => catalog.filter((item) => Number(item.stockQty) <= 5),
    [catalog]
  );

  const activeOrdersCount = useMemo(
    () => orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
    [orders]
  );

  const handleCopyStoreUrl = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const sectionNames = useMemo(() => {
    const secs = profile.supplySections || [];
    return secs
      .map((id) => SUPPLIER_SUPPLY_SECTIONS.find((s) => s.id === id)?.titleAr)
      .filter(Boolean)
      .join(' • ');
  }, [profile.supplySections]);

  const hubCards = [
    ...(showErpModules && onNavigateToErpHub
      ? [
          {
            id: 'erp_hub',
            title: 'مركز قيادة الفروع والخزينة (ERP)',
            desc: 'شجرة الفروع والمخزن المركزي، الموافقات المالية، واستلام توريدات الفروع',
            stat: `${erpOverview?.branches?.length || 1} فرع نشط`,
            icon: GitBranch,
            accent: 'text-[#EA580C]',
            onClick: onNavigateToErpHub,
          },
        ]
      : []),
    ...(showErpModules && onNavigateToPos
      ? [
          {
            id: 'pos_cashier',
            title: 'كاشير نقاط البيع (POS)',
            desc: 'بيع بالوزن أو الوحدة بالكسور، عميل فرع أو أونلاين، وكاش أو إنستاباي أو آجل',
            stat: erpOverview ? `اليوم: ${erpOverview.kpis.todayPosOrdersCount} فاتورة` : 'فتح الكاشير',
            icon: ShoppingCart,
            accent: 'text-emerald-700 dark:text-emerald-300',
            onClick: onNavigateToPos,
          },
        ]
      : []),
    ...(showErpModules && onNavigateToWarehouseErp
      ? [
          {
            id: 'warehouse_erp',
            title: 'المخازن وكارت الصنف والمصانع',
            desc: 'جرد بدون صور، تحويل وحدة (طرد ← كيلو)، كارت الصنف، ومستحقات المصانع',
            stat: erpOverview ? `${Number(erpOverview.kpis.totalStockValuation).toLocaleString()} ${currencySymbol}` : 'جرد المخازن',
            icon: Warehouse,
            accent: 'text-sky-700 dark:text-sky-300',
            onClick: onNavigateToWarehouseErp,
          },
        ]
      : []),
    ...(showErpModules && onNavigateToHrTerminal
      ? [
          {
            id: 'hr_terminal',
            title: 'شؤون العاملين وتثبيت الأجهزة (HR)',
            desc: 'حسابات الموظفين، الحضور والجزاءات والسلف، وتثبيت الشاشات على أجهزة الفروع',
            stat: 'Kiosk & HR',
            icon: MonitorSmartphone,
            accent: 'text-amber-700 dark:text-amber-300',
            onClick: onNavigateToHrTerminal,
          },
        ]
      : []),
    {
      id: 'catalog',
      title: 'كتالوج الخامات والمخزون',
      desc: 'إضافة الخامات، أسعار الجملة والقطاعي، الألوان والسمك، والمخزون',
      stat: `${catalog.length} خامة`,
      icon: Boxes,
      accent: 'text-[#C2410C] dark:text-amber-300',
      onClick: onNavigateToCatalog,
    },
    {
      id: 'orders',
      title: 'أوردراتي وطلبات التوريد',
      desc: 'فلترة متجري / موردين الشمساوية / خارج المنظومة + تسجيل أوردر يدوي',
      stat: `${orders.length} طلب`,
      icon: Package,
      accent: 'text-sky-700 dark:text-sky-300',
      onClick: onNavigateToOrders,
    },
    {
      id: 'storefront',
      title: 'لوحة تحكم متجر المورد',
      desc: 'المظهر، رابط المتجر، رمز QR، كوبونات الخصم، وإعدادات الواتساب',
      stat: 'متجرك الإلكتروني',
      icon: Store,
      accent: 'text-emerald-700 dark:text-emerald-300',
      onClick: onOpenStorefrontModal,
    },
    {
      id: 'customers',
      title: 'عملائي (الورش والأفراد)',
      desc: 'دليل العملاء الكامل مع الفلتر والبحث بالاسم أو الهاتف أو المحافظة',
      stat: `${customers.length} عميل`,
      icon: Users,
      accent: 'text-indigo-700 dark:text-indigo-300',
      onClick: onNavigateToCustomers,
    },
    {
      id: 'finance',
      title: 'الخزائن والمصروفات والتدفقات',
      desc: 'متابعة أرصدة الخزائن، الإيداعات، والمصروفات التشغيلية للمخزن',
      stat: `${totalTreasuryBalance.toLocaleString()} ${currencySymbol}`,
      icon: Wallet,
      accent: 'text-amber-700 dark:text-amber-300',
      onClick: onNavigateToFinance,
    },
    ...(onNavigateToPersonalProfile
      ? [
          {
            id: 'personal_profile',
            title: 'صفحتي الشخصية ومعرض أعمالي',
            desc: 'صورتك الشخصية، قصتك، أذونات الظهور، و٦ منشورات لأعمالك المميزة',
            stat: '٦ منشورات وقصتي',
            icon: User,
            accent: 'text-[#C2410C] dark:text-amber-300',
            onClick: onNavigateToPersonalProfile,
          },
        ]
      : []),
    ...(onNavigateToFamily
      ? [
          {
            id: 'family',
            title: 'مجتمع عيلة الشمساوية',
            desc: 'شارك في طبلية العيلة مع الفنانين، انشر عروضك، واستقبل رسائل الورش',
            stat: 'فنانين وموردين',
            icon: Users,
            accent: 'text-rose-700 dark:text-rose-300',
            onClick: onNavigateToFamily,
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-6 text-right" dir="rtl">
      {/* Supplier Header Strip */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-xs font-black text-[#C2410C] dark:text-amber-300">
            <Truck className="w-4 h-4 shrink-0" />
            <span>بوابة موردي الخامات المستقلة — منظومة الشمساوية</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
            {profile.brandName || 'متجر المورد'}
          </h1>
          <p className="text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
            المسؤول: <strong className="text-[#0C1427] dark:text-stone-200">{profile.artistName}</strong>
            {profile.governorate ? ` • ${profile.governorate}` : ''}
            {sectionNames ? ` • ${sectionNames}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onPreviewPublicStore && (
            <button
              type="button"
              onClick={() => onPreviewPublicStore(slug)}
              className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>معاينة متجري للجمهور</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyStoreUrl}
            className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 cursor-pointer transition"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#EA580C]" />}
            <span>{copiedLink ? 'تم نسخ رابط المتجر' : 'نسخ رابط متجرك'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenStorefrontModal}
            className="px-3.5 py-2 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] hover:opacity-95 text-white border border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-sm"
          >
            <QrCode className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span>إعدادات المتجر و QR</span>
          </button>
        </div>
      </section>

      {/* Main Action Hub Grid FIRST — matching WorkshopHomeScreen visual hierarchy */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
            أدوات إدارة متجر المورد
          </h2>
          {showErpModules && erpOverview && erpOverview.pendingTransfers.length > 0 && onNavigateToErpHub && (
            <button
              type="button"
              onClick={onNavigateToErpHub}
              className="px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{erpOverview.pendingTransfers.length} توريد بانتظار تأكيد الاستلام</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {hubCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                className="group text-right rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] p-5 transition flex flex-col justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center shrink-0">
                    <Icon className={`w-5 h-5 ${card.accent}`} />
                  </div>
                  <span className="text-xs font-black text-[#0C1427] dark:text-amber-300 font-mono tabular-nums">
                    {card.stat}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] group-hover:text-[#C2410C] dark:group-hover:text-amber-300 transition">
                    {card.title}
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="flex items-center justify-end text-[11px] font-black text-[#C2410C] dark:text-amber-300 gap-1 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]/70">
                  <span>فتح القسم</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Financial & Operational Summaries BELOW Cards (No charts on Home) */}
      {showErpModules && erpOverview && (
        <section className="rounded-2xl bg-[#0C1427] text-[#F7F3EA] border border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 text-xs">
            <div>
              <p className="text-slate-300 font-bold">معانا كام (الخزن الكلية)</p>
              <p className="font-mono tabular-nums font-black text-emerald-400 text-sm mt-0.5">
                {Number(erpOverview.kpis.totalCashOnHand).toLocaleString()} {currencySymbol}
              </p>
            </div>
            <div>
              <p className="text-slate-300 font-bold">لينا بره كام (آجل العملاء)</p>
              <p className="font-mono tabular-nums font-black text-amber-300 text-sm mt-0.5">
                {Number(erpOverview.kpis.receivablesFromCustomers).toLocaleString()} {currencySymbol}
              </p>
            </div>
            <div>
              <p className="text-slate-300 font-bold">علينا كام (للمصانع)</p>
              <p className="font-mono tabular-nums font-black text-rose-400 text-sm mt-0.5">
                {Number(erpOverview.kpis.payablesToVendors).toLocaleString()} {currencySymbol}
              </p>
            </div>
            <div>
              <p className="text-slate-300 font-bold">قيمة المخزون بالفروع</p>
              <p className="font-mono tabular-nums font-black text-sky-300 text-sm mt-0.5">
                {Number(erpOverview.kpis.totalStockValuation).toLocaleString()} {currencySymbol}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Compact KPI Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">إجمالي أرصدة الخزائن</p>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] font-mono tabular-nums">
            {loading ? '...' : totalTreasuryBalance.toLocaleString()}{' '}
            <span className="text-xs font-bold text-[#C2410C] dark:text-amber-300">{currencySymbol}</span>
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">خامات الكتالوج</p>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] font-mono tabular-nums">
            {loading ? '...' : catalog.length}
            {lowStockItems.length > 0 && (
              <span className="mr-2 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                ({lowStockItems.length} منخفض)
              </span>
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">أوردرات قيد التنفيذ</p>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] font-mono tabular-nums">
            {loading ? '...' : activeOrdersCount}
            <span className="mr-2 text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
              من إجمالي {orders.length}
            </span>
          </p>
        </div>

        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4">
          <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">قاعدة العملاء</p>
          <p className="mt-1.5 text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] font-mono tabular-nums">
            {loading ? '...' : customers.length}
          </p>
        </div>
      </section>

      {/* Recent Orders & Low Stock Split */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#EA580C]" />
              <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">أحدث الأوردرات</h3>
            </div>
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="text-xs font-black text-[#C2410C] dark:text-amber-300 hover:underline cursor-pointer"
            >
              عرض الكل
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] py-4 text-center">
              لا توجد أوردرات مسجلة بعد. يمكنك تسجيل أول أوردر خارجي أو استقبال طلبات متجرك.
            </p>
          ) : (
            <div className="divide-y divide-[#D4CCBC]/70 dark:divide-[#22355E]">
              {orders.slice(0, 5).map((ord) => (
                <div key={ord.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                      {ord.externalBuyer?.name || 'ورشة / عميل'}{' '}
                      <span className="font-mono text-[11px] text-[#475569] dark:text-[#94A3B8]">
                        #{ord.orderNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      {ord.orderSource === 'direct_supplier_store'
                        ? 'متجري'
                        : ord.orderSource === 'suppliers_market'
                        ? 'موردين الشمساوية'
                        : 'خارج المنظومة'}
                    </div>
                  </div>
                  <div className="text-left shrink-0 font-mono tabular-nums font-black text-[#0C1427] dark:text-amber-300">
                    {Number(ord.finalTotal).toLocaleString()} {currencySymbol}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                تنبيهات نقص المخزون
              </h3>
            </div>
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="text-xs font-black text-[#C2410C] dark:text-amber-300 hover:underline cursor-pointer"
            >
              إدارة المخزون
            </button>
          </div>

          {lowStockItems.length === 0 ? (
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] py-4 text-center">
              ممتاز! جميع الخامات في الكتالوج متوفرة بكميات آمنة.
            </p>
          ) : (
            <div className="divide-y divide-[#D4CCBC]/70 dark:divide-[#22355E]">
              {lowStockItems.slice(0, 5).map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 font-bold text-[#0C1427] dark:text-[#F7F3EA] truncate">
                    {item.name}
                  </div>
                  <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 shrink-0">
                    {item.stockQty} {item.unit}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom Orange Marketplace Footer for Suppliers */}
      {(onNavigateToSuppliersMarket || onPreviewPublicStore) && (
        <footer className="pt-2">
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
              تصفح عروض السوق ومقارنة أسعار الموردين في المنظومة مباشرة:
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onPreviewPublicStore && (
                <button
                  type="button"
                  onClick={() => onPreviewPublicStore(slug)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5 cursor-pointer transition"
                >
                  <ExternalLink className="w-4 h-4 text-[#EA580C]" />
                  <span>عرض متجري للجمهور</span>
                </button>
              )}
              {onNavigateToSuppliersMarket && (
                <button
                  type="button"
                  onClick={onNavigateToSuppliersMarket}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition shadow-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>موردين الشمساوية</span>
                </button>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
