import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Coins,
  Gift,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Users,
  Award,
} from 'lucide-react';
import {
  AdminReferralsOverview,
  buildLocalAdminReferralsOverview,
  fetchAdminReferralsOverviewServer,
  getReferralTrackLabelAr,
} from '../../services/referralSystemService';
import {
  AccountLoyaltyWallets,
  LoyaltyEconomyConfig,
  PlatformPromotionalOffer,
  PromotionalOfferType,
  WalletType,
  adminGrantWalletPointsToServer,
  evaluateStoreOfferMarginSafety,
  listAllLocalWallets,
  loadLoyaltyConfig,
  loadPlatformOffers,
  pointsToEgp,
  saveAdminLoyaltyConfigToServer,
  syncPublicLoyaltyFromServer,
} from '../../services/loyaltyWalletsService';
import { supabase } from '../../lib/supabase';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface AdminLoyaltyOffersPanelProps {
  onBack: () => void;
  onNotifySuccess?: (msg: string) => void;
  onNotifyError?: (msg: string) => void;
}

export const AdminLoyaltyOffersPanel: React.FC<AdminLoyaltyOffersPanelProps> = ({
  onBack,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'offers' | 'wallets' | 'referrals'>('settings');
  const [config, setConfig] = useState<LoyaltyEconomyConfig>(() => loadLoyaltyConfig());
  const [offers, setOffers] = useState<PlatformPromotionalOffer[]>(() => loadPlatformOffers());
  const [wallets, setWallets] = useState<AccountLoyaltyWallets[]>(() => listAllLocalWallets());
  const [referralsOverview, setReferralsOverview] = useState<AdminReferralsOverview>(() =>
    buildLocalAdminReferralsOverview()
  );
  const [saving, setSaving] = useState(false);

  // New Platform Offer Form
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newBadge, setNewBadge] = useState('+15 نقطة');
  const [newType, setNewType] = useState<PromotionalOfferType>('bonus_points');
  const [newValue, setNewValue] = useState<number>(15);
  const [newMinOrder, setNewMinOrder] = useState<number>(0);

  // Grant Points Form
  const [grantAccount, setGrantAccount] = useState('');
  const [grantWallet, setGrantWallet] = useState<WalletType>('packages_wallet');
  const [grantAction, setGrantAction] = useState<'credit' | 'debit'>('credit');
  const [grantPoints, setGrantPoints] = useState<number>(20);
  const [grantReason, setGrantReason] = useState('مكافأة تحفيزية من إدارة الشمساوية');

  // Margin Guard Quick Simulator (for Super Admin testing / demo)
  const [simPrice, setSimPrice] = useState<number>(500);
  const [simCost, setSimCost] = useState<number>(360);
  const [simDiscount, setSimDiscount] = useState<number>(15);

  const marginCheck = evaluateStoreOfferMarginSafety({
    regularPriceEgp: simPrice,
    unitCostEgp: simCost,
    discountPercent: simDiscount,
    minMarginGuardPercent: config.workshopMinMarginGuardPercent,
  });

  useEffect(() => {
    syncPublicLoyaltyFromServer().then(({ config: c, offers: o }) => {
      setConfig(c);
      setOffers(o);
    });
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token;
      if (!token) return;
      fetch('/api/admin/loyalty/wallets', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json?.ok) {
            if (json.config) setConfig(json.config);
            if (Array.isArray(json.offers) && json.offers.length > 0) setOffers(json.offers);
            if (Array.isArray(json.wallets) && json.wallets.length > 0) setWallets(json.wallets);
          }
        })
        .catch(() => {});
      fetchAdminReferralsOverviewServer(token).then((ov) => setReferralsOverview(ov));
    });
  }, []);

  const persistAll = async (nextCfg: LoyaltyEconomyConfig, nextOffers: PlatformPromotionalOffer[], successMsg: string) => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await saveAdminLoyaltyConfigToServer(token, nextCfg, nextOffers);
      if (!res.ok) {
        onNotifyError?.(res.error || 'تعذر حفظ التعديلات');
      } else {
        playSuccessSound();
        onNotifySuccess?.(successMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = () => {
    persistAll(config, offers, `تم حفظ تسعيرة النقطة (${config.pointValueEgp} ج.م) وقواعد حماية الهوامش بنجاح ✓`);
  };

  const handleAddOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      onNotifyError?.('يرجى كتابة عنوان العرض التحفيزي.');
      return;
    }
    const created: PlatformPromotionalOffer = {
      id: `offer_${Date.now()}`,
      scope: 'platform',
      titleAr: newTitle.trim(),
      subtitleAr: newSubtitle.trim() || 'عرض تحفيزي مفعّل من إدارة منظومة الشمساوية — محمي الهوامش بالكامل.',
      badgeAr: newBadge.trim() || 'عرض المنصة',
      offerType: newType,
      value: Math.max(0, Number(newValue) || 0),
      minOrderEgp: newMinOrder > 0 ? newMinOrder : undefined,
      active: true,
      marginSafeVerified: true,
      createdAt: new Date().toISOString(),
    };
    const nextOffers = [created, ...offers];
    setOffers(nextOffers);
    setNewTitle('');
    setNewSubtitle('');
    persistAll(config, nextOffers, 'تمت إضافة عرض المنصة التحفيزي وتفعيله في السوق وشموسة ✓');
  };

  const handleToggleOffer = (id: string) => {
    playButtonClickSound();
    const nextOffers = offers.map((o) => (o.id === id ? { ...o, active: !o.active } : o));
    setOffers(nextOffers);
    persistAll(config, nextOffers, 'تم تحديث حالة العرض ✓');
  };

  const handleDeleteOffer = (id: string) => {
    playButtonClickSound();
    const nextOffers = offers.filter((o) => o.id !== id);
    setOffers(nextOffers);
    persistAll(config, nextOffers, 'تم حذف العرض من القائمة');
  };

  const handleGrantPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantAccount.trim() || grantPoints <= 0) {
      onNotifyError?.('يرجى إدخال معرّف/إيميل الحساب وعدد نقاط صحيح.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await adminGrantWalletPointsToServer(token, {
        accountId: grantAccount.trim(),
        walletType: grantWallet,
        type: grantAction,
        points: Math.floor(grantPoints),
        reasonAr: grantReason.trim() || 'تعديل رصيد من السوبر أدمن',
      });
      if (!res.ok) {
        onNotifyError?.(res.error || 'تعذر تنفيذ عملية النقاط');
      } else {
        playSuccessSound();
        setWallets((prev) => {
          const rest = prev.filter((w) => w.accountId !== res.wallet.accountId);
          return [res.wallet, ...rest];
        });
        setGrantAccount('');
        onNotifySuccess?.(
          `تم ${grantAction === 'credit' ? 'إضافة' : 'خصم'} ${grantPoints} نقطة (${pointsToEgp(grantPoints, config)} ج.م) في ${
            grantWallet === 'packages_wallet' ? 'محفظة الباقات' : 'محفظة التسوق'
          } ✓`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C] cursor-pointer"
            aria-label="رجوع"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>النقاط والمحافظ المنفصلة والعروض التحفيزية</span>
            </h1>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              تسعيرة النقطة مرنة (الافتراضي 0.50 ج.م) · فصل تام بين محفظة الباقات ومحفظة التسوق · حماية هوامش الورش
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-[#9A3412] dark:text-[#FBBF24] font-black">
            1 نقطة = {config.pointValueEgp} ج.م
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 font-black">
            سقف خصم السلة: {config.customerMaxDiscountPercent}%
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(
          [
            { id: 'settings', label: 'تسعير النقطة وحماية الهامش', icon: <ShieldCheck className="w-4 h-4" /> },
            { id: 'offers', label: `عروض المنصة (${offers.filter((o) => o.active).length})`, icon: <Gift className="w-4 h-4" /> },
            { id: 'wallets', label: `المحافظ ومنح النقاط (${wallets.length})`, icon: <Wallet className="w-4 h-4" /> },
            { id: 'referrals', label: `نظام الدعوات الثلاثي (${referralsOverview.totalActivations})`, icon: <Users className="w-4 h-4" /> },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveTab(tab.id);
            }}
            className={`px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
              activeTab === tab.id
                ? 'bg-[#EA580C] border-[#C2410C] text-white shadow-sm'
                : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#E2E8F0] hover:border-[#EA580C]'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: SETTINGS & MARGIN PROTECTION */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  الإعدادات المالية للنقاط والمحافظ
                </h2>
                <label className="inline-flex items-center gap-2 text-xs font-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#EA580C]"
                  />
                  <span>{config.enabled ? 'مفعّلة' : 'متوقفة'}</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-black text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                    قيمة النقطة الواحدة بالجنيه المصري (ج.م)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      max="50"
                      value={config.pointValueEgp}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, pointValueEgp: Math.max(0.05, Number(e.target.value) || 0.5) }))
                      }
                      className="w-32 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black text-[#0C1427] dark:text-[#F7F3EA]"
                    />
                    <span className="text-[#475569] dark:text-[#94A3B8]">
                      الافتراضي: 0.50 ج.م (مثلاً 20 نقطة = {pointsToEgp(20, config)} ج.م)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-black text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                    سقف خصم «محفظة التسوق» للعملاء في السلة (%) — الموصى به 10% إلى 15%
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="25"
                    value={config.customerMaxDiscountPercent}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        customerMaxDiscountPercent: Math.min(25, Math.max(5, Number(e.target.value) || 15)),
                      }))
                    }
                    className="w-32 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black text-[#0C1427] dark:text-[#F7F3EA]"
                  />
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
                    الخصم مموّل بالكامل من المنصة ولا يُخصم جنيه واحد من صافي ربح الفنان.
                  </p>
                </div>

                <div>
                  <label className="block font-black text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                    حارس حماية هامش الورشة في عروض المتاجر (%)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={config.workshopMinMarginGuardPercent}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        workshopMinMarginGuardPercent: Math.min(50, Math.max(5, Number(e.target.value) || 15)),
                      }))
                    }
                    className="w-32 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black text-[#0C1427] dark:text-[#F7F3EA]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-4 sm:p-5 space-y-3">
              <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                قواعد كسب النقاط التلقائية
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                    نقاط/100 ج.م طلب موثّق
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={config.earningRules.verifiedOrderPer100Egp}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        earningRules: { ...c.earningRules, verifiedOrderPer100Egp: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                    تقييم حقيقي بعد الاستلام
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.earningRules.verifiedReviewPts}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        earningRules: { ...c.earningRules, verifiedReviewPts: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                    نقاط ترحيبية (محفظة تسوق)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={config.earningRules.welcomeCustomerPts}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        earningRules: { ...c.earningRules, welcomeCustomerPts: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#334155] dark:text-[#CBD5E1] mb-1">
                    تجهيز ورشة (محفظة باقات)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={config.earningRules.firstWorkshopSetupPts}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        earningRules: { ...c.earningRules, firstWorkshopSetupPts: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveConfig}
                className="w-full mt-2 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'جاري الحفظ...' : 'حفظ تسعيرة النقاط وقواعد الحماية'}</span>
              </button>
            </div>
          </div>

          {/* Live Margin Protection Simulator */}
          <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-4 sm:p-5 space-y-3 text-xs">
            <h3 className="font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>محاكي حارس حماية هوامش الورش (Store Offer Margin Guard)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold mb-1">سعر البيع العادي (ج.م)</label>
                <input
                  type="number"
                  value={simPrice}
                  onChange={(e) => setSimPrice(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">تكلفة القطعة (ج.م)</label>
                <input
                  type="number"
                  value={simCost}
                  onChange={(e) => setSimCost(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">نسبة خصم المتجر المقترحة (%)</label>
                <input
                  type="number"
                  value={simDiscount}
                  onChange={(e) => setSimDiscount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                />
              </div>
            </div>
            <div
              className={`p-3 rounded-xl border font-bold flex items-center gap-2 ${
                marginCheck.isSafe
                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/35 text-rose-800 dark:text-rose-300'
              }`}
            >
              {marginCheck.isSafe ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{marginCheck.warningAr}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORM OFFERS */}
      {activeTab === 'offers' && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddOffer}
            className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-4 sm:p-5 space-y-3 text-xs"
          >
            <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#EA580C]" />
              <span>إضافة عرض تحفيزي جديد على مستوى المنصة (يظهر تلقائياً في السوق وشموسة)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="عنوان العرض (مثلاً: عرض نهاية الأسبوع +15 نقطة تسوق)"
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              />
              <input
                type="text"
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                placeholder="شارة قصيرة (مثلاً: +15 نقطة)"
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              />
            </div>
            <input
              type="text"
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              placeholder="وصف مختصر يظهر للمتسوقين وفي ردود شموسة الأوفلاين..."
              className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040]"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as PromotionalOfferType)}
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              >
                <option value="bonus_points">نقاط إضافية هدية (Bonus Points)</option>
                <option value="double_points">مضاعفة النقاط (×2)</option>
                <option value="free_shipping_threshold">شحن مجاني فوق حد معين</option>
                <option value="bundle_save">توفير عند تجميع قطع</option>
              </select>
              <input
                type="number"
                min="0"
                value={newValue}
                onChange={(e) => setNewValue(Number(e.target.value) || 0)}
                placeholder="القيمة (نقاط أو نسبة)"
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
              />
              <input
                type="number"
                min="0"
                value={newMinOrder}
                onChange={(e) => setNewMinOrder(Number(e.target.value) || 0)}
                placeholder="الحد الأدنى للطلب ج.م (اختياري)"
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة وتفعيل العرض الآن</span>
            </button>
          </form>

          <div className="space-y-2.5">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  offer.active
                    ? 'bg-white dark:bg-[#0D162E] border-[#EA580C]/40'
                    : 'bg-[#F2ECE1]/70 dark:bg-[#0A1124] border-[#D4CCBC] dark:border-[#1E2E52] opacity-70'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#EA580C]/15 text-[#C2410C] dark:text-[#FBBF24] text-[11px] font-black">
                      {offer.badgeAr}
                    </span>
                    <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">{offer.titleAr}</h3>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8]">{offer.subtitleAr}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleOffer(offer.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                      offer.active
                        ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35'
                        : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#475569] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {offer.active ? 'مفعّل ✓' : 'متوقف'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOffer(offer.id)}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                    aria-label="حذف العرض"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: WALLETS & GRANT POINTS */}
      {activeTab === 'wallets' && (
        <div className="space-y-4">
          <form
            onSubmit={handleGrantPoints}
            className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-4 sm:p-5 space-y-3 text-xs"
          >
            <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
              منح أو تعديل نقاط لحساب (فصل كامل بين محفظة الباقات ومحفظة التسوق)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                value={grantAccount}
                onChange={(e) => setGrantAccount(e.target.value)}
                placeholder="إيميل الحساب أو معرّف الورشة/العميل"
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              />
              <select
                value={grantWallet}
                onChange={(e) => setGrantWallet(e.target.value as WalletType)}
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              >
                <option value="packages_wallet">👑 محفظة الباقات (ورش/موردين/مدربين)</option>
                <option value="shopping_wallet">🛍️ محفظة التسوق (عملاء السوق)</option>
              </select>
              <select
                value={grantAction}
                onChange={(e) => setGrantAction(e.target.value as 'credit' | 'debit')}
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              >
                <option value="credit">+ إضافة نقاط</option>
                <option value="debit">- خصم / تسوية نقاط</option>
              </select>
              <input
                type="number"
                min="1"
                max="100000"
                value={grantPoints}
                onChange={(e) => setGrantPoints(Number(e.target.value) || 0)}
                placeholder="عدد النقاط"
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-black"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="سبب الحركة (يظهر في سجل محفظة العضو)"
                className="flex-1 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040]"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black cursor-pointer whitespace-nowrap"
              >
                تنفيذ ({pointsToEgp(grantPoints, config)} ج.م)
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] p-4 space-y-3">
            <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
              سجل المحافظ النشطة ({wallets.length})
            </h3>
            {wallets.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-4 text-center">
                لم يتم تسجيل حركات نقاط بعد — استخدم النموذج أعلاه لمنح أول رصيد تجريبي لأي حساب أو ورشة.
              </p>
            ) : (
              <div className="space-y-2">
                {wallets.map((w) => (
                  <div
                    key={w.accountId}
                    className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#E5DEC9] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">{w.accountId}</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        عدد الحركات: {w.ledger?.length || 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-[#9A3412] dark:text-[#FBBF24] font-black">
                        👑 باقات: {w.packagesWalletPoints} ن ({pointsToEgp(w.packagesWalletPoints, config)} ج.م)
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-black">
                        🛍️ تسوق: {w.shoppingWalletPoints} ن ({pointsToEgp(w.shoppingWalletPoints, config)} ج.م)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TRI-TRACK REFERRAL SYSTEM OVERVIEW */}
      {activeTab === 'referrals' && (
        <div className="space-y-4">
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono tabular-nums">
            <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-3.5">
              <span className="block text-[11px] font-sans font-bold text-[#475569] dark:text-[#94A3B8]">
                مسار الفنانين (ART-)
              </span>
              <span className="text-xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
                {referralsOverview.byTrack.artisan.activations} تفعيل
              </span>
              <span className="block text-[10px] font-sans text-[#64748B]">
                من {referralsOverview.byTrack.artisan.profiles} كود نشط (15 نقطة ترحيب)
              </span>
            </div>

            <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-3.5">
              <span className="block text-[11px] font-sans font-bold text-[#475569] dark:text-[#94A3B8]">
                مسار الموردين (SUP-)
              </span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                {referralsOverview.byTrack.supplier.activations} تفعيل
              </span>
              <span className="block text-[10px] font-sans text-[#64748B]">
                ربط تلقائي في «مورديني المفضلين»
              </span>
            </div>

            <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] p-3.5">
              <span className="block text-[11px] font-sans font-bold text-[#475569] dark:text-[#94A3B8]">
                مسار المدربين (TRN-)
              </span>
              <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                {referralsOverview.byTrack.trainer.activations} تفعيل
              </span>
              <span className="block text-[10px] font-sans text-[#64748B]">
                25 نقطة + شارة «تحت إشراف مدرب معتمد 🎓»
              </span>
            </div>

            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15 p-3.5">
              <span className="block text-[11px] font-sans font-bold text-[#9A3412] dark:text-[#FBBF24]">
                مكافآت الـ 50 نقطة المصروفة
              </span>
              <span className="text-xl font-black text-[#C2410C] dark:text-[#FBBF24]">
                +{referralsOverview.totalMilestoneBonusPoints} نقطة
              </span>
              <span className="block text-[10px] font-sans text-[#78350F] dark:text-amber-200">
                ({referralsOverview.totalMilestoneBonusesPaidCount} مكافآت × 50 ن في محفظة الباقات)
              </span>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] p-4 space-y-3">
            <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#EA580C]" />
              <span>أكثر الداعين نشاطاً عبر المسارات الثلاثة ({referralsOverview.topReferrers.length})</span>
            </h3>
            {referralsOverview.topReferrers.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-4 text-center">
                لم يتم تسجيل أكواد دعوة نشطة بعد — ستظهر هنا إحصائيات الفنانين والموردين والمدربين تلقائياً.
              </p>
            ) : (
              <div className="space-y-2">
                {referralsOverview.topReferrers.map((p) => (
                  <div
                    key={p.accountId}
                    className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#E5DEC9] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">{p.displayName}</span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#0A1124] border border-[#D4CCBC] dark:border-[#2B4378]">
                          {p.code}
                        </span>
                        <span className="text-[10px] font-bold text-[#C2410C] dark:text-[#FBBF24]">
                          {getReferralTrackLabelAr(p.track)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-black">
                        {p.verifiedActivationsCount} تفعيلات
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-[#9A3412] dark:text-[#FBBF24] font-black">
                        +{p.totalBonusPointsEarned} ن مكافآت
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activations Log */}
          <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] p-4 space-y-3">
            <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
              آخر التفعيلات الحقيقية ({referralsOverview.recentActivations.length})
            </h3>
            {referralsOverview.recentActivations.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-3 text-center">
                لا توجد تفعيلات دعوات مسجلة بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {referralsOverview.recentActivations.slice(0, 15).map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl bg-[#FAF7F0] dark:bg-[#132040]/70 border border-[#E5DEC9] dark:border-[#1E2E52] flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  >
                    <div>
                      <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">{act.inviteeName}</span>{' '}
                      <span className="text-[#475569] dark:text-[#94A3B8]">
                        انضم بدعوة <strong>{act.referrerName}</strong> ({act.referrerCode})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black">
                        +{act.welcomePointsGranted} ن ترحيب
                      </span>
                      {act.trainerBadgeGranted && (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-sans font-black">
                          شارة مدرب 🎓
                        </span>
                      )}
                      {act.supplierAutoLinked && (
                        <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 font-sans font-black">
                          ربط مورد 📦
                        </span>
                      )}
                      {act.milestoneBonusTriggeredPoints > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[#9A3412] dark:text-[#FBBF24] font-black">
                          مكافأة +{act.milestoneBonusTriggeredPoints} ن!
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
