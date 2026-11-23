import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../../types';
import {
  SupplierCatalogItem,
  SupplierStoreConfig,
  SupplierStoreCoupon,
} from '../../types/supplier';
import {
  ArtisanStorePromoBanner,
  DEFAULT_ARTISAN_STORE_CONFIG,
} from '../../types/artisanStoreBuilder';
import { MarketCouponConfig, MarketCouponType } from '../../types/marketplaceBuilder';
import { fetchSupplierCatalog, updateSupplierStoreConfig } from '../../db/supplierService';
import { fetchMemberPersonalProfile } from '../../db/memberProfileService';
import { QRCodeCanvas } from 'qrcode.react';
import {
  X,
  ArrowRight,
  Store,
  Palette,
  TicketPercent,
  QrCode,
  Copy,
  Check,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  User,
  Eye,
  EyeOff,
  Megaphone,
  Clock,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pause,
  Play,
  Package,
  Globe,
} from 'lucide-react';

import { StorefrontThemeGrid, ThemePreviewDecisionBar } from '../store/StorefrontThemeStudio';
import { StorePromoBannerDisplay } from '../store/StorePromoBannerDisplay';
import { SupplierPublicStoreView } from './SupplierPublicStoreView';
import {
  StorefrontThemeId,
  WORLD_STOREFRONT_THEMES_LIST,
  normalizeStorefrontThemeId,
} from '../../lib/storefrontThemes';
import { MultilingualContentStudio } from '../common/MultilingualContentStudio';
import { PublicLocaleCode } from '../../lib/publicLocale';

interface SupplierStorefrontModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onOpenPersonalProfile?: () => void;
  onPreviewPublicStore?: (slug: string) => void;
}

const DEFAULT_SUPPLIER_BANNER: ArtisanStorePromoBanner = {
  ...DEFAULT_ARTISAN_STORE_CONFIG.promoBanner,
  text: 'عروض توريد خامات مميزة للورش — أسعار جملة وقطاعي مع شحن سريع لجميع المحافظات',
  subText: 'تشكيلة كاملة من الخامات المعتمدة',
  discountLabel: 'عرض المورد',
  motionMode: 'marquee',
  orientation: 'horizontal',
  direction: 'rtl',
  speed: 'normal',
  extraMessages: [],
  showActiveCouponsInBanner: true,
};

function mergeSupplierCoupons(cfg: SupplierStoreConfig): MarketCouponConfig[] {
  if (Array.isArray(cfg.richCoupons) && cfg.richCoupons.length > 0) {
    return cfg.richCoupons;
  }
  return (cfg.coupons || []).map((c, idx) => ({
    id: `scpn_${idx}_${c.code}`,
    code: c.code,
    type: c.type || 'percent',
    value: c.value ?? c.discountPercent ?? 10,
    minOrder: c.minOrder || 0,
    buyQty: c.buyQty,
    freeQty: c.freeQty,
    description: c.description,
    endsAt: c.endsAt,
    showInBanner: c.showInBanner !== false,
    active: c.active,
    visible: true,
    createdAt: new Date().toISOString(),
  }));
}

export const SupplierStorefrontModal: React.FC<SupplierStorefrontModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onOpenPersonalProfile,
  onPreviewPublicStore,
}) => {
  const initialCfg: SupplierStoreConfig = profile.storeConfig || {};
  const currencySymbol = profile.currencySymbol || 'ج.م';
  const currencyCode = profile.currency || 'EGP';

  const [tab, setTab] = useState<'appearance' | 'promotions' | 'languages' | 'order' | 'qr'>('appearance');
  const [brandName, setBrandName] = useState(profile.brandName || '');
  const [storeSlug, setStoreSlug] = useState(profile.storeSlug || profile.store_slug || '');
  const [phone, setPhone] = useState(profile.phoneNumber || '');
  const [governorate, setGovernorate] = useState(profile.governorate || '');

  const [tagline, setTagline] = useState(initialCfg.tagline || '');
  const [description, setDescription] = useState(initialCfg.description || '');
  const [themePreset, setThemePreset] = useState<StorefrontThemeId>(
    normalizeStorefrontThemeId(initialCfg.themePreset)
  );
  const [previewThemeId, setPreviewThemeId] = useState<StorefrontThemeId | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState(
    initialCfg.whatsappNumber || profile.phoneNumber || ''
  );
  const [instagramUrl, setInstagramUrl] = useState(initialCfg.instagramUrl || '');
  const [facebookUrl, setFacebookUrl] = useState(initialCfg.facebookUrl || '');
  const [shippingNote, setShippingNote] = useState(initialCfg.shippingNote || '');
  const [freeShippingAbove, setFreeShippingAbove] = useState<number>(
    Number(initialCfg.freeShippingAbove || 0)
  );
  const [showWholesalePricesPublicly, setShowWholesalePricesPublicly] = useState(
    initialCfg.showWholesalePricesPublicly !== false
  );
  const [enabledLanguages, setEnabledLanguages] = useState<PublicLocaleCode[]>(
    (initialCfg.enabledLanguages as PublicLocaleCode[]) || ['ar', 'en']
  );
  const [defaultLanguage, setDefaultLanguage] = useState<PublicLocaleCode>(
    (initialCfg.defaultLanguage as PublicLocaleCode) || 'ar'
  );
  const [logoArUrl, setLogoArUrl] = useState<string>(initialCfg.logoArUrl || '');
  const [logoEnUrl, setLogoEnUrl] = useState<string>(initialCfg.logoEnUrl || '');
  const [translations, setTranslations] = useState<
    Partial<Record<PublicLocaleCode, Record<string, string | undefined>>>
  >((initialCfg.translations as any) || {});

  // Animated Banner State
  const [promoBanner, setPromoBanner] = useState<ArtisanStorePromoBanner>({
    ...DEFAULT_SUPPLIER_BANNER,
    ...(initialCfg.promoBanner || {}),
  });
  const [newExtraMsg, setNewExtraMsg] = useState('');

  // Multi-Coupon State
  const [richCoupons, setRichCoupons] = useState<MarketCouponConfig[]>(() =>
    mergeSupplierCoupons(initialCfg)
  );
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<MarketCouponType>('percent');
  const [newCouponVal, setNewCouponVal] = useState('10');
  const [newCouponMin, setNewCouponMin] = useState('0');
  const [newCouponBuyQty, setNewCouponBuyQty] = useState('2');
  const [newCouponFreeQty, setNewCouponFreeQty] = useState('1');
  const [newCouponDesc, setNewCouponDesc] = useState('');
  const [newCouponEndsAt, setNewCouponEndsAt] = useState('');
  const [newCouponShowInBanner, setNewCouponShowInBanner] = useState(true);

  // Drag & Drop Product Reordering State
  const [catalogItems, setCatalogItems] = useState<SupplierCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [productOrderIds, setProductOrderIds] = useState<string[]>(initialCfg.productOrderIds || []);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const cfg: SupplierStoreConfig = profile.storeConfig || {};
    setBrandName(profile.brandName || '');
    setStoreSlug(profile.storeSlug || profile.store_slug || '');
    setPhone(profile.phoneNumber || '');
    setGovernorate(profile.governorate || '');
    setTagline(cfg.tagline || '');
    setDescription(cfg.description || '');
    setThemePreset(normalizeStorefrontThemeId(cfg.themePreset));
    setWhatsappNumber(cfg.whatsappNumber || profile.phoneNumber || '');
    setInstagramUrl(cfg.instagramUrl || '');
    setFacebookUrl(cfg.facebookUrl || '');
    setShippingNote(cfg.shippingNote || '');
    setFreeShippingAbove(Number(cfg.freeShippingAbove || 0));
    setShowWholesalePricesPublicly(cfg.showWholesalePricesPublicly !== false);
    setPromoBanner({ ...DEFAULT_SUPPLIER_BANNER, ...(cfg.promoBanner || {}) });
    setRichCoupons(mergeSupplierCoupons(cfg));
    setProductOrderIds(Array.isArray(cfg.productOrderIds) ? cfg.productOrderIds : []);
    setFeedback(null);

    let active = true;
    setLoadingCatalog(true);
    fetchSupplierCatalog()
      .then((list) => {
        if (!active) return;
        const inStoreList = list.filter((x) => x.inStore !== false);
        const savedIds = Array.isArray(cfg.productOrderIds) ? cfg.productOrderIds : [];
        const rank = new Map(savedIds.map((id, i) => [id, i]));
        const sorted = [...inStoreList].sort(
          (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)
        );
        setCatalogItems(sorted);
        setProductOrderIds(sorted.map((x) => x.id));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });

    const targetId = profile.supplierId || profile.id || '';
    if (targetId) {
      fetchMemberPersonalProfile(targetId, 'owner')
        .then((res) => {
          if (!active || !res.success || !res.profile) return;
          if (res.profile.storyText && res.profile.storyText.trim()) {
            setDescription(res.profile.storyText.trim());
          }
          if (res.profile.bioHeadline && res.profile.bioHeadline.trim() && !cfg.tagline) {
            setTagline(res.profile.bioHeadline.trim());
          }
          if (res.profile.phone && !profile.phoneNumber) {
            setPhone(res.profile.phone);
          }
          if (res.profile.governorate && !profile.governorate) {
            setGovernorate(res.profile.governorate);
          }
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const effectiveSlug = (storeSlug || profile.id || '').trim();
  const storeUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/#/supplier/${encodeURIComponent(effectiveSlug)}`
      : `/#/supplier/${encodeURIComponent(effectiveSlug)}`;

  const toLegacyCoupons = (list: MarketCouponConfig[]): SupplierStoreCoupon[] =>
    list.map((c) => ({
      code: c.code,
      discountPercent: c.type === 'percent' ? c.value : 0,
      active: c.active,
      type: c.type,
      value: c.value,
      minOrder: c.minOrder,
      buyQty: c.buyQty,
      freeQty: c.freeQty,
      description: c.description,
      endsAt: c.endsAt,
      showInBanner: c.showInBanner,
    }));

  const buildCurrentConfig = (themeOverride?: StorefrontThemeId): SupplierStoreConfig => ({
    ...initialCfg,
    tagline: tagline.trim(),
    description: description.trim(),
    themePreset: themeOverride || themePreset,
    whatsappNumber: whatsappNumber.trim(),
    instagramUrl: instagramUrl.trim(),
    facebookUrl: facebookUrl.trim(),
    shippingNote: shippingNote.trim(),
    freeShippingAbove: Number(freeShippingAbove || 0),
    showWholesalePricesPublicly,
    coupons: toLegacyCoupons(richCoupons),
    richCoupons,
    promoBanner,
    productOrderIds,
    enabledLanguages,
    defaultLanguage,
    logoArUrl,
    logoEnUrl,
    translations: translations as any,
  });

  const handleSave = async (themeOverride?: StorefrontThemeId): Promise<boolean> => {
    setSaving(true);
    setFeedback(null);
    const nextConfig = buildCurrentConfig(themeOverride);

    const res = await updateSupplierStoreConfig(nextConfig, {
      brandName: brandName.trim(),
      storeSlug: storeSlug.trim(),
      phone: phone.trim(),
      governorate: governorate.trim(),
    });
    setSaving(false);

    if (!res.success || !res.supplier) {
      setFeedback({ text: res.error || 'تعذر حفظ إعدادات المتجر', isError: true });
      return false;
    }

    if (themeOverride) {
      setThemePreset(themeOverride);
    }

    const updatedProfile: UserProfile = {
      ...profile,
      brandName: res.supplier.brandName,
      storeSlug: res.supplier.storeSlug,
      store_slug: res.supplier.storeSlug,
      phoneNumber: res.supplier.phone,
      governorate: res.supplier.governorate,
      storeConfig: res.supplier.storeConfig,
    };
    onProfileUpdated(updatedProfile);
    window.dispatchEvent(
      new CustomEvent('alshams_profile_synced', {
        detail: {
          brandName: res.supplier.brandName,
          phoneNumber: res.supplier.phone,
          governorate: res.supplier.governorate,
          storyText: nextConfig.description,
          bioHeadline: nextConfig.tagline,
        },
      })
    );
    setFeedback({ text: 'تم حفظ إعدادات متجر المورد وترتيب المنتجات والبانر بنجاح!' });
    return true;
  };

  const handleAddCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCouponCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) return;
    const val =
      newCouponType === 'free_shipping' || newCouponType === 'bogo'
        ? 0
        : Math.max(1, Number(newCouponVal) || 10);
    const created: MarketCouponConfig = {
      id: `scpn_${Date.now()}`,
      code,
      type: newCouponType,
      value: val,
      minOrder: Math.max(0, Number(newCouponMin) || 0),
      buyQty: newCouponType === 'bogo' ? Math.max(1, parseInt(newCouponBuyQty, 10) || 2) : undefined,
      freeQty: newCouponType === 'bogo' ? Math.max(1, parseInt(newCouponFreeQty, 10) || 1) : undefined,
      currencyCode,
      endsAt: newCouponEndsAt ? new Date(newCouponEndsAt).toISOString() : undefined,
      showInBanner: newCouponShowInBanner,
      description: newCouponDesc.trim() || undefined,
      active: true,
      visible: true,
      createdAt: new Date().toISOString(),
    };
    setRichCoupons((prev) => [created, ...prev.filter((c) => c.code !== code)]);
    setNewCouponCode('');
    setNewCouponDesc('');
    setNewCouponEndsAt('');
  };

  const reorderItemsList = (nextList: SupplierCatalogItem[]) => {
    setCatalogItems(nextList);
    setProductOrderIds(nextList.map((x) => x.id));
  };

  const handleReorderDrop = (srcId: string, targetId: string) => {
    if (!srcId || !targetId || srcId === targetId) return;
    const list = [...catalogItems];
    const from = list.findIndex((i) => i.id === srcId);
    const to = list.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    reorderItemsList(list);
  };

  const handleMoveItemStep = (id: string, delta: -1 | 1) => {
    const list = [...catalogItems];
    const idx = list.findIndex((i) => i.id === id);
    const nextIdx = idx + delta;
    if (idx === -1 || nextIdx < 0 || nextIdx >= list.length) return;
    const [moved] = list.splice(idx, 1);
    list.splice(nextIdx, 0, moved);
    reorderItemsList(list);
  };

  const handleDownloadQr = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-qr-${effectiveSlug}.png`;
    a.click();
  };

  if (previewThemeId) {
    return (
      <div className="fixed inset-0 z-50 bg-[#060B18] overflow-y-auto flex flex-col">
        <ThemePreviewDecisionBar
          previewThemeId={previewThemeId}
          savedThemeId={themePreset}
          saving={saving}
          onChangePreviewTheme={(id) => setPreviewThemeId(id)}
          onConfirmApply={async (chosenId) => {
            const ok = await handleSave(chosenId);
            if (ok) {
              setPreviewThemeId(null);
            }
          }}
          onCancel={() => setPreviewThemeId(null)}
        />
        <div className="flex-1">
          <SupplierPublicStoreView
            slug={effectiveSlug}
            profile={profile}
            isOwnerPreview={true}
            previewThemeOverride={previewThemeId}
            onClosePreview={() => setPreviewThemeId(null)}
            onNavigateToSuppliersMarket={() => setPreviewThemeId(null)}
            onNavigateToCentralMarket={() => setPreviewThemeId(null)}
            onNavigateToApp={() => setPreviewThemeId(null)}
            localSupplierOverride={{
              brandName: brandName.trim() || profile.brandName || 'متجر المورد',
              storeSlug: effectiveSlug,
              phone: phone.trim(),
              governorate: governorate.trim(),
              storeConfig: buildCurrentConfig(previewThemeId),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5" dir="rtl">
      <div className="w-full max-w-5xl bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl max-h-[94vh] flex flex-col overflow-hidden text-right">
        {/* Ultra-Slim Compact Header: Store Name + Sleek Inline "معاينة" Button */}
        <div className="px-4 py-2.5 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black cursor-pointer shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>رجوع</span>
            </button>
            <Store className="w-4 h-4 text-[#EA580C] shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
              متجر {brandName || profile.brandName}
            </h2>
            <button
              type="button"
              onClick={() => {
                if (onPreviewPublicStore) {
                  setPreviewThemeId(themePreset);
                } else {
                  setPreviewThemeId(themePreset);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0C1427] dark:bg-[#132040] hover:bg-[#EA580C] text-[#FBBF24] hover:text-white border border-[#22355E] text-[11px] font-black cursor-pointer shrink-0 transition"
              title="معاينة المتجر العام"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>معاينة</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visible Settings Control Grid */}
        <div className="p-3 bg-[#E9E2D4]/70 dark:bg-[#060B18] border-b border-[#D4CCBC] dark:border-[#22355E]">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'appearance' as const, label: `السمات (${WORLD_STOREFRONT_THEMES_LIST.length})`, icon: Palette },
              { id: 'promotions' as const, label: 'البانر والأكواد', icon: Megaphone },
              { id: 'languages' as const, label: 'اللغات والشعار', icon: Globe },
              { id: 'order' as const, label: `ترتيب الخامات (${catalogItems.length})`, icon: GripVertical },
              { id: 'qr' as const, label: 'الرابط و QR', icon: QrCode },
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`p-2.5 rounded-2xl border-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    active
                      ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-sm'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {feedback && (
            <div
              className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
                feedback.isError
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
              }`}
            >
              {feedback.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">اسم المتجر</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">رابط المتجر المختصر (Slug)</label>
                  <input
                    type="text"
                    value={storeSlug}
                    onChange={(e) => setStoreSlug(e.target.value)}
                    placeholder="shorouk-yarns"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">هاتف المتجر</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المحافظة</label>
                  <input
                    type="text"
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">العبارة التعريفية المختصرة</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="مثال: أجود خيوط المكرمية والكروشيه بالجملة والقطاعي"
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="font-bold">نبذة المتجر وقصة المورد</label>
                  {onOpenPersonalProfile && (
                    <button
                      type="button"
                      onClick={onOpenPersonalProfile}
                      className="px-2.5 py-1 rounded-lg bg-[#0C1427] dark:bg-[#132040] text-[#FBBF24] border border-[#22355E] text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                    >
                      <User className="w-3 h-3" />
                      <span>فتح صفحتي الشخصية ومعرض الأعمال</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب نبذة عن متجرك، خبرتك في الخامات، ومواعيد التجهيز والشحن..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#EFE9DC]/60 dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E]">
                <StorefrontThemeGrid
                  activeThemeId={themePreset}
                  audience="supplier"
                  onSelectTheme={(id) => setThemePreset(id)}
                  onPreviewTheme={(id) => setPreviewThemeId(id)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">رقم الواتساب للطلبات</label>
                  <input
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">رابط Instagram</label>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">رابط Facebook</label>
                  <input
                    type="url"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-left"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWholesalePricesPublicly}
                  onChange={(e) => setShowWholesalePricesPublicly(e.target.checked)}
                  className="accent-[#EA580C] w-4 h-4"
                />
                <span>إظهار أسعار الجملة علناً لزوار المتجر</span>
              </label>
            </div>
          )}

          {tab === 'languages' && (
            <MultilingualContentStudio
              title="اللغات والشعار ثنائي اللغة لمتجرك"
              subtitle="أسعارك تُعرض تلقائياً بعملة بلدك وتتحول لعملة الزائر الدولي أوتوماتيكياً — تحكّم هنا في اللغات والشعار العربي/الإنجليزي"
              enabledLanguages={enabledLanguages}
              onChangeEnabledLanguages={setEnabledLanguages}
              defaultLanguage={defaultLanguage}
              onChangeDefaultLanguage={setDefaultLanguage}
              showCurrencies={false}
              showBilingualLogos={true}
              defaultLogoUrl={
                (profile as any)?.logo_url || profile.logoUrl || profile.logoBase64 || '/alshams_falcon_emblem.png'
              }
              logoArUrl={logoArUrl}
              logoEnUrl={logoEnUrl}
              onChangeLogoAr={setLogoArUrl}
              onChangeLogoEn={setLogoEnUrl}
              fields={[
                { key: 'brandName', labelAr: 'اسم متجر المورد', sourceArabicValue: brandName },
                { key: 'tagline', labelAr: 'جملة الترحيب', sourceArabicValue: tagline },
                {
                  key: 'description',
                  labelAr: 'وصف المتجر والتوريد',
                  sourceArabicValue: description,
                  multiline: true,
                },
                {
                  key: 'promoBannerText',
                  labelAr: 'نص الشريط الترويجي',
                  sourceArabicValue: promoBanner?.text || '',
                },
              ]}
              translations={translations}
              onChangeTranslations={setTranslations}
            />
          )}

          {tab === 'promotions' && (
            <div className="space-y-4">
              {/* 1. Animated Banner Studio for Supplier */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black flex items-center gap-1.5 text-[#C2410C] dark:text-amber-300">
                    <Megaphone className="w-4 h-4" />
                    <span>استوديو البانر الإعلاني المتحرك والثابت لمتجر المورد</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPromoBanner((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer border ${
                      promoBanner.enabled
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#475569] border-[#D4CCBC] dark:border-[#22355E]'
                    }`}
                  >
                    {promoBanner.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{promoBanner.enabled ? 'البانر ظاهر' : 'البانر مخفي'}</span>
                  </button>
                </div>

                {promoBanner.text?.trim() && (
                  <StorePromoBannerDisplay
                    banner={{ ...promoBanner, enabled: true }}
                    currencySymbol={currencySymbol}
                    coupons={richCoupons}
                    compactPreview={true}
                  />
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block font-bold mb-1">حركة البانر</label>
                    <select
                      value={promoBanner.motionMode || 'marquee'}
                      onChange={(e) => setPromoBanner((p) => ({ ...p, motionMode: e.target.value as any }))}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="marquee">شريط متحرك مستمر</option>
                      <option value="slide">شرائح منزلقة</option>
                      <option value="vertical_ticker">طولي متتابع</option>
                      <option value="static">ثابت</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">الشكل</label>
                    <select
                      value={promoBanner.orientation || 'horizontal'}
                      onChange={(e) =>
                        setPromoBanner((p) => ({
                          ...p,
                          orientation: e.target.value as any,
                          direction: e.target.value === 'vertical' ? 'up' : 'rtl',
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="horizontal">عرضي أفقي</option>
                      <option value="vertical">طولي رأسي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">الاتجاه</label>
                    <select
                      value={promoBanner.direction || 'rtl'}
                      onChange={(e) => setPromoBanner((p) => ({ ...p, direction: e.target.value as any }))}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="rtl">من اليمين لليسار</option>
                      <option value="ltr">من الشمال لليمين</option>
                      <option value="up">من أسفل لأعلى</option>
                      <option value="down">من أعلى لأسفل</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">السرعة</label>
                    <select
                      value={promoBanner.speed || 'normal'}
                      onChange={(e) => setPromoBanner((p) => ({ ...p, speed: e.target.value as any }))}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="slow">بطيئة</option>
                      <option value="normal">متوسطة</option>
                      <option value="fast">سريعة</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block font-bold mb-1">النص الرئيسي للبانر</label>
                    <input
                      type="text"
                      value={promoBanner.text}
                      onChange={(e) => setPromoBanner((p) => ({ ...p, text: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">لون البانر</label>
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      {['#C2410C', '#0C1427', '#065F46', '#1E3A8A', '#BE123C'].map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setPromoBanner((p) => ({ ...p, bgColor: hex }))}
                          className={`w-6 h-6 rounded-lg border-2 cursor-pointer ${
                            promoBanner.bgColor === hex ? 'border-amber-400 scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newExtraMsg}
                    onChange={(e) => setNewExtraMsg(e.target.value)}
                    placeholder="أضف رسالة عرض إضافية للبانر..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newExtraMsg.trim();
                      if (!clean) return;
                      setPromoBanner((p) => ({
                        ...p,
                        extraMessages: [...(p.extraMessages || []), clean],
                      }));
                      setNewExtraMsg('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer shrink-0"
                  >
                    + سطر إضافي
                  </button>
                </div>

                {(promoBanner.extraMessages || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(promoBanner.extraMessages || []).map((m, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] text-[11px] font-bold"
                      >
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPromoBanner((p) => ({
                              ...p,
                              extraMessages: (p.extraMessages || []).filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-rose-600 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold mb-1">شرط البانر</label>
                    <select
                      value={promoBanner.triggerType}
                      onChange={(e) => setPromoBanner((p) => ({ ...p, triggerType: e.target.value as any }))}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="always">مستمر دائماً</option>
                      <option value="limited_time">لفترة محدودة ⏳</option>
                      <option value="min_order">لحد شراء معين</option>
                    </select>
                  </div>
                  {promoBanner.triggerType === 'limited_time' && (
                    <div>
                      <label className="block font-bold mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#EA580C]" />
                        <span>ينتهي في:</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={promoBanner.endsAt ? promoBanner.endsAt.slice(0, 16) : ''}
                        onChange={(e) =>
                          setPromoBanner((p) => ({
                            ...p,
                            endsAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                          }))
                        }
                        className="w-full px-2.5 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-[11px]"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-1.5 font-black cursor-pointer self-end py-2">
                    <input
                      type="checkbox"
                      checked={promoBanner.showActiveCouponsInBanner !== false}
                      onChange={(e) =>
                        setPromoBanner((p) => ({ ...p, showActiveCouponsInBanner: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#EA580C]"
                    />
                    <span>إظهار الأكواد داخل البانر</span>
                  </label>
                </div>
              </div>

              {/* 2. Shipping Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">ملاحظات الشحن والتسليم</label>
                  <input
                    type="text"
                    value={shippingNote}
                    onChange={(e) => setShippingNote(e.target.value)}
                    placeholder="مثال: الشحن خلال ٢٤ ساعة لجميع المحافظات"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    شحن مجاني للطلبات فوق ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={freeShippingAbove}
                    onChange={(e) => setFreeShippingAbove(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                  />
                </div>
              </div>

              {/* 3. Rich Multi-Coupon Studio */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
                <div className="font-black flex items-center gap-1.5 text-[#C2410C] dark:text-amber-300">
                  <TicketPercent className="w-4 h-4" />
                  <span>أكواد وعروض متجر المورد المتعددة ({richCoupons.length} كود · بعملة {currencySymbol})</span>
                </div>

                <form onSubmit={handleAddCoupon} className="space-y-2 p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={newCouponCode}
                      onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                      placeholder="كود الخصم (مثال: SUP15)"
                      className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-mono font-black uppercase"
                    />
                    <select
                      value={newCouponType}
                      onChange={(e) => setNewCouponType(e.target.value as MarketCouponType)}
                      className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-bold"
                    >
                      <option value="percent">خصم نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت ({currencySymbol})</option>
                      <option value="free_shipping">شحن مجاني 🚚</option>
                      <option value="bogo">اشتري X + Y مجاناً 🎁</option>
                    </select>

                    {newCouponType === 'bogo' ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="number"
                          min={1}
                          value={newCouponBuyQty}
                          onChange={(e) => setNewCouponBuyQty(e.target.value)}
                          placeholder="اشتري"
                          className="px-2.5 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-mono font-black"
                        />
                        <input
                          type="number"
                          min={1}
                          value={newCouponFreeQty}
                          onChange={(e) => setNewCouponFreeQty(e.target.value)}
                          placeholder="مجاناً"
                          className="px-2.5 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-mono font-black"
                        />
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        disabled={newCouponType === 'free_shipping'}
                        value={newCouponType === 'free_shipping' ? '0' : newCouponVal}
                        onChange={(e) => setNewCouponVal(e.target.value)}
                        placeholder={newCouponType === 'percent' ? 'النسبة %' : `المبلغ (${currencySymbol})`}
                        className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-mono font-black disabled:opacity-50"
                      />
                    )}

                    <input
                      type="number"
                      min={0}
                      value={newCouponMin}
                      onChange={(e) => setNewCouponMin(e.target.value)}
                      placeholder={`حد أدنى (${currencySymbol})`}
                      className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <input
                      type="text"
                      value={newCouponDesc}
                      onChange={(e) => setNewCouponDesc(e.target.value)}
                      placeholder="وظيفة الكود (مثال: لطلبات الجملة)"
                      className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-bold"
                    />
                    <input
                      type="datetime-local"
                      value={newCouponEndsAt}
                      onChange={(e) => setNewCouponEndsAt(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] font-mono text-[11px]"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-black cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCouponShowInBanner}
                          onChange={(e) => setNewCouponShowInBanner(e.target.checked)}
                          className="accent-[#EA580C]"
                        />
                        <span>بالبانر</span>
                      </label>
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-[#EA580C] text-white font-black inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة كود</span>
                      </button>
                    </div>
                  </div>
                </form>

                {richCoupons.length > 0 && (
                  <div className="space-y-2">
                    {richCoupons.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-[#0C1427] text-[#FBBF24] font-mono font-black">
                            {c.code}
                          </span>
                          <span className="font-black text-[#C2410C] dark:text-amber-300">
                            {c.type === 'free_shipping'
                              ? 'شحن مجاني 🚚'
                              : c.type === 'bogo'
                              ? `اشتري ${c.buyQty || 2} + ${c.freeQty || 1} مجاناً 🎁`
                              : c.type === 'fixed'
                              ? `خصم ${c.value} ${currencySymbol}`
                              : `خصم ${c.value}%`}
                          </span>
                          {c.minOrder && c.minOrder > 0 ? (
                            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                              (حد أدنى {c.minOrder} {currencySymbol})
                            </span>
                          ) : null}
                          {c.description && (
                            <span className="text-[11px] font-bold">· {c.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setRichCoupons((prev) =>
                                prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x))
                              )
                            }
                            className={`px-2 py-1 rounded-lg font-black text-[11px] inline-flex items-center gap-1 cursor-pointer ${
                              c.active ? 'bg-amber-100 text-amber-900' : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {c.active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            <span>{c.active ? 'إيقاف' : 'تفعيل'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRichCoupons((prev) => prev.filter((x) => x.id !== c.id))}
                            className="p-1.5 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'order' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-2 font-bold text-[#475569] dark:text-[#CBD5E1]">
                <GripVertical className="w-4 h-4 text-[#EA580C] shrink-0" />
                <span>اسحب أي خامة وأفلتها لترتيب ظهورها في متجر المورد العام (أو استخدم الأسهم على الموبايل)، ثم اضغط «حفظ التغييرات».</span>
              </div>

              {loadingCatalog ? (
                <div className="py-10 text-center font-bold text-[#475569]">جاري تحميل خامات متجرك...</div>
              ) : catalogItems.length === 0 ? (
                <div className="py-10 text-center space-y-2 rounded-2xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E]">
                  <Package className="w-8 h-8 mx-auto text-[#EA580C]/70" />
                  <p className="font-black">لا توجد خامات معروضة بمتجرك حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {catalogItems.map((it, idx) => {
                    const isDragging = draggedItemId === it.id;
                    const isOver = dragOverItemId === it.id && draggedItemId !== it.id;
                    return (
                      <div
                        key={it.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedItemId(it.id);
                          e.dataTransfer.effectAllowed = 'move';
                          try {
                            e.dataTransfer.setData('text/plain', it.id);
                          } catch {}
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverItemId !== it.id) setDragOverItemId(it.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverItemId === it.id) setDragOverItemId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const srcId = draggedItemId || e.dataTransfer.getData('text/plain');
                          setDraggedItemId(null);
                          setDragOverItemId(null);
                          if (srcId && srcId !== it.id) handleReorderDrop(srcId, it.id);
                        }}
                        onDragEnd={() => {
                          setDraggedItemId(null);
                          setDragOverItemId(null);
                        }}
                        className={`p-3 rounded-2xl bg-white dark:bg-[#060B18] border flex items-center justify-between gap-2.5 cursor-grab active:cursor-grabbing transition ${
                          isDragging
                            ? 'opacity-60 border-[#EA580C] ring-2 ring-[#EA580C]'
                            : isOver
                            ? 'border-[#EA580C] ring-2 ring-[#EA580C]/50 bg-[#F5DFC6]/40 dark:bg-[#132040]'
                            : 'border-[#D4CCBC] dark:border-[#22355E]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <GripVertical className="w-4 h-4 text-[#EA580C] shrink-0" />
                          <span className="w-6 h-6 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          {it.images?.[0] ? (
                            <img
                              src={it.images[0]}
                              alt={it.name}
                              className="w-10 h-10 rounded-xl object-cover border border-[#D4CCBC] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-[#EA580C]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-black truncate">{it.name}</p>
                            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] font-mono">
                              {it.retailPrice} {currencySymbol} / {it.unit}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveItemStep(it.id, -1)}
                            className="w-7 h-7 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                            title="تقديم للأمام"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === catalogItems.length - 1}
                            onClick={() => handleMoveItemStep(it.id, 1)}
                            className="w-7 h-7 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                            title="تأخير للخلف"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4 py-3">
              <div
                ref={qrWrapRef}
                className="p-4 rounded-2xl bg-white border border-[#D4CCBC] shadow-sm inline-block"
              >
                <QRCodeCanvas value={storeUrl} size={180} includeMargin />
              </div>

              <div className="w-full max-w-md space-y-2">
                <p className="font-bold text-[#475569] dark:text-[#94A3B8]">رابط متجرك المباشر:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={storeUrl}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-[11px] text-left"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(storeUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      } catch {}
                    }}
                    className="px-3 py-2 rounded-xl bg-[#0C1427] text-white font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تحميل صورة QR للطباعة</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </div>
  );
};
