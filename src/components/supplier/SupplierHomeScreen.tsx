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
  getUiColorPreset,
  getUiIcon,
  UiHomeCardConfig,
  useUiLayoutConfig,
} from '../../types/uiLayoutConfig';
import {
  useUserSubscription,
  isActionUnlockedBySubscription,
} from '../../types/subscriptions';
import { useExperienceMode } from '../../types/experienceMode';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Copy,
  ExternalLink,
  QrCode,
  Rocket,
  ShoppingBag,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { SupplierGrowthToolsPanel } from '../growth/SupplierGrowthToolsPanel';
import { GrowthHubConfig, getStoredGrowthHubConfig } from '../../types/artisanGrowth';
import { syncGrowthHubConfigFromCloud } from '../../db/memberProfileService';

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
  onNavigateToExecutiveBrief?: () => void;
  onNavigateToFamily?: () => void;
  onNavigateToPersonalProfile?: () => void;
  onNavigateToSuppliersMarket?: () => void;
  onNavigateToUnifiedMaterials?: () => void;
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
  onNavigateToExecutiveBrief,
  onNavigateToFamily,
  onNavigateToPersonalProfile,
  onNavigateToSuppliersMarket,
  onNavigateToUnifiedMaterials,
  onPreviewPublicStore,
}) => {
  const flags = useFeatureFlags();
  const uiLayout = useUiLayoutConfig();
  const userSub = useUserSubscription(profile);
  const isAdminUser = isUserAdmin(profile);
  const homeCfg = uiLayout.supplier.home;
  const {
    isCraft,
    setMode: setExpMode,
    allowSwitch: allowExpSwitch,
    getLabel: getModeLabel,
    isVisible: isModeVisible,
  } = useExperienceMode('supplier', profile);
  const showErpModules = isUserAdmin(profile) || flags.supplierErpEnabled !== false;
  const [catalog, setCatalog] = useState<SupplierCatalogItem[]>([]);
  const [orders, setOrders] = useState<B2BSupplyOrder[]>([]);
  const [customers, setCustomers] = useState<SupplierCustomer[]>([]);
  const [treasuries, setTreasuries] = useState<SupplierTreasury[]>([]);
  const [erpOverview, setErpOverview] = useState<SupplierErpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeSubCard, setActiveSubCard] = useState<UiHomeCardConfig | null>(null);
  const [supplierGrowthOpen, setSupplierGrowthOpen] = useState(false);
  const [growthConfig, setGrowthConfig] = useState<GrowthHubConfig>(() => getStoredGrowthHubConfig());

  useEffect(() => {
    syncGrowthHubConfigFromCloud()
      .then((cfg) => setGrowthConfig(cfg))
      .catch(() => {});
  }, []);

  const hasAnySupplierGrowthTool =
    growthConfig.supplierCreditLimitEnabled ||
    growthConfig.supplierMobileStocktakeEnabled ||
    growthConfig.supplierFlashBundlesEnabled ||
    growthConfig.supplierSmartRestockEnabled;

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

  const executeSupplierAction = (actionKey?: string) => {
    switch (actionKey) {
      case 'sup_executive_brief':
        onNavigateToExecutiveBrief?.();
        break;
      case 'sup_guide_start':
        window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'guide_start' } }));
        break;
      case 'sup_guide_daily':
        window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'guide_daily' } }));
        break;
      case 'sup_erp_hub':
        onNavigateToErpHub?.();
        break;
      case 'sup_pos':
        onNavigateToPos?.();
        break;
      case 'sup_warehouse_erp':
        onNavigateToWarehouseErp?.();
        break;
      case 'sup_hr_terminal':
        onNavigateToHrTerminal?.();
        break;
      case 'sup_catalog':
        onNavigateToCatalog();
        break;
      case 'sup_orders':
        onNavigateToOrders();
        break;
      case 'sup_storefront':
        onOpenStorefrontModal();
        break;
      case 'sup_customers':
        onNavigateToCustomers();
        break;
      case 'sup_finance':
        onNavigateToFinance();
        break;
      case 'sup_personal_profile':
        onNavigateToPersonalProfile?.();
        break;
      case 'sup_family':
        onNavigateToFamily?.();
        break;
      case 'sup_market':
        onNavigateToSuppliersMarket?.();
        break;
      case 'sup_unified_materials':
        if (onNavigateToUnifiedMaterials) {
          onNavigateToUnifiedMaterials();
        } else {
          window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'unified_materials' } }));
        }
        break;
      default:
        break;
    }
  };

  const getDynamicStat = (card: UiHomeCardConfig): string => {
    const key = card.directActionKey || card.id;
    switch (key) {
      case 'sup_executive_brief':
      case 'supplier_executive_brief':
        return erpOverview
          ? `${Number(erpOverview.kpis.totalCashOnHand).toLocaleString()} ${currencySymbol}`
          : 'ملخص فوري';
      case 'sup_guide_start':
      case 'supplier_start_guide':
        return '4 خطوات سهلة';
      case 'sup_guide_daily':
      case 'supplier_daily_guide':
        return 'روتين اليوم';
      case 'sup_erp_hub':
      case 'erp_hub':
        return `${erpOverview?.branches?.length || 1} فرع نشط`;
      case 'sup_pos':
      case 'pos_cashier':
        return erpOverview ? `اليوم: ${erpOverview.kpis.todayPosOrdersCount} فاتورة` : 'فتح الكاشير';
      case 'sup_warehouse_erp':
      case 'warehouse_erp':
        return erpOverview
          ? `${Number(erpOverview.kpis.totalStockValuation).toLocaleString()} ${currencySymbol}`
          : 'جرد المخازن';
      case 'sup_hr_terminal':
      case 'hr_terminal':
        return 'Kiosk & HR';
      case 'sup_catalog':
      case 'catalog':
        return `${catalog.length} خامة`;
      case 'sup_orders':
      case 'orders':
        return `${orders.length} طلب`;
      case 'sup_storefront':
      case 'storefront':
        return 'متجرك الإلكتروني';
      case 'sup_customers':
      case 'customers':
        return `${customers.length} عميل`;
      case 'sup_finance':
      case 'finance':
        return `${totalTreasuryBalance.toLocaleString()} ${currencySymbol}`;
      case 'sup_personal_profile':
      case 'personal_profile':
        return '٦ منشورات وقصتي';
      case 'sup_family':
      case 'family':
        return 'فنانين وموردين';
      case 'sup_unified_materials':
      case 'supplier_unified_materials':
        return 'أكواد وأسماء موحدة';
      default:
        return card.items.length > 0 ? `${card.items.filter((i) => i.visible).length} أدوات` : 'قسم مخصص';
    }
  };

  const CARD_MODE_KEY_MAP: Record<string, string> = {
    erp_hub: 'sup_erp_hub_card',
    sup_erp_hub: 'sup_erp_hub_card',
    warehouse_erp: 'sup_warehouse_erp_card',
    sup_warehouse_erp: 'sup_warehouse_erp_card',
    hr_terminal: 'sup_hr_terminal_card',
    sup_hr_terminal: 'sup_hr_terminal_card',
    executive_brief: 'sup_executive_brief_card',
    sup_executive_brief: 'sup_executive_brief_card',
    finance: 'sup_finance_title',
    sup_finance: 'sup_finance_title',
  };

  const canAccessSupplierStoreTools =
    isAdminUser || isActionUnlockedBySubscription('top_nav_store', userSub, 'supplier', isAdminUser);
  const showSupplierSummaryWidgets =
    isAdminUser || isActionUnlockedBySubscription('widget_home_summary', userSub, 'supplier', isAdminUser);

  const visibleCards = useMemo(() => {
    return homeCfg.cards.filter((card) => {
      if (!card.visible) return false;
      if (!isAdminUser) {
        const hasItems = Array.isArray(card.items) && card.items.length > 0;
        if (hasItems) {
          const unlocked = card.items.filter(
            (b) => b.visible !== false && isActionUnlockedBySubscription(b.actionKey, userSub, 'supplier', isAdminUser)
          );
          if (unlocked.length === 0) return false;
        } else if (card.directActionKey) {
          if (!isActionUnlockedBySubscription(card.directActionKey, userSub, 'supplier', isAdminUser)) {
            return false;
          }
        }
      }
      if (!showErpModules && ['erp_hub', 'pos_cashier', 'warehouse_erp', 'hr_terminal'].includes(card.id)) {
        return false;
      }
      const modeKey =
        CARD_MODE_KEY_MAP[card.id] ||
        (card.directActionKey ? CARD_MODE_KEY_MAP[card.directActionKey] : undefined);
      if (modeKey && !isModeVisible(modeKey)) {
        return false;
      }
      if (card.directActionKey === 'sup_personal_profile' && !onNavigateToPersonalProfile) return false;
      if (card.directActionKey === 'sup_family' && !onNavigateToFamily) return false;
      if (card.directActionKey === 'sup_executive_brief' && !onNavigateToExecutiveBrief) return false;
      return true;
    });
  }, [
    homeCfg.cards,
    showErpModules,
    isAdminUser,
    userSub,
    isModeVisible,
    onNavigateToPersonalProfile,
    onNavigateToFamily,
    onNavigateToExecutiveBrief,
  ]);

  const resolveCardLabel = (card: UiHomeCardConfig) => {
    const modeKey =
      CARD_MODE_KEY_MAP[card.id] ||
      (card.directActionKey ? CARD_MODE_KEY_MAP[card.directActionKey] : undefined);
    return modeKey ? getModeLabel(modeKey, card.label) : card.label;
  };

  const gridColsClass = useMemo(() => {
    const mob = homeCfg.columnsMobile === 3 ? 'grid-cols-3' : 'grid-cols-2';
    const dsk =
      homeCfg.columnsDesktop === 5
        ? 'lg:grid-cols-5'
        : homeCfg.columnsDesktop === 4
        ? 'lg:grid-cols-4'
        : 'lg:grid-cols-3';
    return `grid ${mob} md:grid-cols-3 ${dsk} gap-3`;
  }, [homeCfg.columnsDesktop, homeCfg.columnsMobile]);

  const iconShapeClass = homeCfg.iconShape === 'circle' ? 'rounded-full' : 'rounded-2xl';

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

        {canAccessSupplierStoreTools && (
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
        )}
      </section>

      {/* Sub-Card View (when a supplier card contains moved/custom internal buttons) */}
      {activeSubCard ? (
        <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 ${iconShapeClass} bg-[#EFE9DC] dark:bg-[#132040] text-[#EA580C] flex items-center justify-center border border-[#D4CCBC]`}>
                {React.createElement(getUiIcon(activeSubCard.iconKey), { className: 'w-5 h-5' })}
              </div>
              <div>
                <h2 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  {activeSubCard.label}
                </h2>
                {activeSubCard.subtitle && (
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8]">{activeSubCard.subtitle}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubCard(null)}
              className="px-3.5 py-2 rounded-xl bg-[#FFEAD5] text-[#9A3412] text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع للبطاقات</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {activeSubCard.items
              .filter(
                (b) =>
                  b.visible &&
                  isActionUnlockedBySubscription(b.actionKey, userSub, 'supplier', isAdminUser)
              )
              .map((btn) => {
                const BtnIcon = getUiIcon(btn.iconKey);
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => executeSupplierAction(btn.actionKey)}
                    className="p-4 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] flex flex-col items-center justify-center gap-2 text-center cursor-pointer"
                  >
                    <div className={`w-9 h-9 ${iconShapeClass} bg-[#F7F3EA] dark:bg-[#0D162E] text-[#EA580C] flex items-center justify-center border border-[#D4CCBC]`}>
                      <BtnIcon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">{btn.label}</span>
                  </button>
                );
              })}
          </div>
        </section>
      ) : (
        /* Main Action Hub Grid — Driven Dynamically by UI Layout Studio */
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              {isCraft ? 'أدوات إدارة متجرك (الوضع الحرفي البسيط)' : 'أدوات إدارة متجر المورد (الوضع المحاسبي المتقدم)'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {allowExpSwitch && (
                <div className="inline-flex items-center p-0.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                  <button
                    type="button"
                    onClick={() => setExpMode('craft')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                      isCraft ? 'bg-emerald-600 text-white' : 'text-[#475569] dark:text-[#CBD5E1]'
                    }`}
                  >
                    الوضع الحرفي
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpMode('accounting')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                      !isCraft ? 'bg-indigo-600 text-white' : 'text-[#475569] dark:text-[#CBD5E1]'
                    }`}
                  >
                    الوضع المحاسبي
                  </button>
                </div>
              )}
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
          </div>

          <div className={gridColsClass}>
            {visibleCards.map((card) => {
              const Icon = getUiIcon(card.iconKey);
              const preset = getUiColorPreset(card.colorPreset);
              const hasSubButtons = card.items.some((i) => i.visible);
              const statLabel = getDynamicStat(card);

              const handleCardClick = () => {
                if (hasSubButtons) {
                  setActiveSubCard(card);
                } else {
                  executeSupplierAction(card.directActionKey);
                }
              };

              if (homeCfg.cardShape === 'compact' || homeCfg.cardShape === 'classic') {
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={handleCardClick}
                    className={`group rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition flex flex-col items-center justify-center text-center cursor-pointer ${
                      homeCfg.cardShape === 'compact' ? 'p-3 gap-1.5 min-h-[90px]' : 'p-4 gap-2 min-h-[112px]'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 ${iconShapeClass} ${preset.bgColor} ${preset.color} border ${preset.borderColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] group-hover:text-[#C2410C] dark:group-hover:text-amber-300 leading-tight">
                      {resolveCardLabel(card)}
                    </h3>
                    <span className="text-[11px] font-black text-[#C2410C] dark:text-amber-300 font-mono tabular-nums">
                      {statLabel}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={handleCardClick}
                  className="group text-right rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] p-5 transition flex flex-col justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-11 h-11 ${iconShapeClass} ${preset.bgColor} ${preset.color} border ${preset.borderColor} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-[#0C1427] dark:text-amber-300 font-mono tabular-nums">
                      {statLabel}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] group-hover:text-[#C2410C] dark:group-hover:text-amber-300 transition">
                      {resolveCardLabel(card)}
                    </h3>
                    {card.subtitle && (
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                        {card.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end text-[11px] font-black text-[#C2410C] dark:text-amber-300 gap-1 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]/70">
                    <span>{hasSubButtons ? 'عرض الأدوات' : 'فتح القسم'}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Financial & Operational Summaries BELOW Cards (No charts on Home) */}
      {showSupplierSummaryWidgets && showErpModules && erpOverview && (
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

      {/* أدوات نمو الموردين الذكية (متحكم فيها من السوبر أدمن) */}
      {hasAnySupplierGrowthTool && (
        <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C]/35 dark:border-[#FBBF24]/30 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Rocket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                أدوات نمو وتوسّع الموردين (B2B Growth Suite)
              </h3>
              <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                سقف الائتمان للورش · جرد الباركود بالموبايل · تصفية البواقي السريعة · رادار الطلب الذكي
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSupplierGrowthOpen(true)}
            className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition shadow-sm"
          >
            <Rocket className="w-4 h-4" />
            <span>فتح أدوات نمو الموردين</span>
          </button>
        </section>
      )}

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

      {/* نافذة أدوات نمو الموردين */}
      <SupplierGrowthToolsPanel
        isOpen={supplierGrowthOpen}
        onClose={() => setSupplierGrowthOpen(false)}
        profile={profile}
        catalog={catalog}
        customers={customers}
        orders={orders}
      />
    </div>
  );
};
