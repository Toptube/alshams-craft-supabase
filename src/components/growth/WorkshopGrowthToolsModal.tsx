import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  Gift,
  Plus,
  Printer,
  QrCode,
  Rocket,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  GrowthHubConfig,
  getStoredGrowthHubConfig,
} from '../../types/artisanGrowth';
import { syncGrowthHubConfigFromCloud } from '../../db/memberProfileService';
import { authedFetch } from '../../lib/apiClient';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface WorkshopGrowthToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  productsList: any[];
  workOrdersList: any[];
  initialTab?: 'calendar' | 'corporate' | 'passport' | 'group_buy' | 'social_ai';
}

interface ScheduleSlot {
  id: string;
  title: string;
  day: string;
  hours: number;
  clientName?: string;
}

interface GroupBuyCampaign {
  id: string;
  materialCode: string;
  materialName: string;
  governorate: string;
  targetQty: number;
  currentQty: number;
  unit: string;
  retailPrice: number;
  groupPrice: number;
  creatorBrand: string;
  participants: { name: string; qty: number }[];
  createdAt: string;
}

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export const WorkshopGrowthToolsModal: React.FC<WorkshopGrowthToolsModalProps> = ({
  isOpen,
  onClose,
  profile,
  productsList,
  workOrdersList,
  initialTab = 'calendar',
}) => {
  const [config, setConfig] = useState<GrowthHubConfig>(() => getStoredGrowthHubConfig());
  const [activeTab, setActiveTab] = useState<'calendar' | 'corporate' | 'passport' | 'group_buy' | 'social_ai'>(
    initialTab
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const currency = profile.currencySymbol || 'ج.م';
  const workshopKey = profile.workshopId || profile.id || 'default';

  // 1. Weekly Production Calendar state
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`alshams_cap_${workshopKey}`);
      return saved ? Math.max(8, Number(saved) || 40) : 40;
    } catch {
      return 40;
    }
  });
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => {
    try {
      const raw = localStorage.getItem(`alshams_sched_${workshopKey}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [newSlotTitle, setNewSlotTitle] = useState('');
  const [newSlotDay, setNewSlotDay] = useState(WEEK_DAYS[0]);
  const [newSlotHours, setNewSlotHours] = useState(4);
  const [newSlotClient, setNewSlotClient] = useState('');

  // 2. Corporate Gifting Bulk Calculator state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [unitCost, setUnitCost] = useState(120);
  const [unitRetail, setUnitRetail] = useState(280);
  const [bulkQty, setBulkQty] = useState(100);
  const [bulkDiscountPct, setBulkDiscountPct] = useState(18);
  const [packagingPerUnit, setPackagingPerUnit] = useState(15);

  // 3. Product Passport QR state
  const [passportPieceName, setPassportPieceName] = useState('');
  const [passportStory, setPassportStory] = useState(
    'قطعة يدوية أصيلة صُنعت بعناية فائقة داخل ورشتنا باستخدام خامات مختارة، كل تفصيلة فيها تحمل بصمة الصنعة اليدوية الفريدة.'
  );
  const [passportCare, setPassportCare] = useState(
    'يُنظف بفرشاة ناعمة أو قطعة قماش جافة، ويُحفظ بعيداً عن الرطوبة العالية وأشعة الشمس المباشرة.'
  );

  // 4. Collective Group Buying state
  const [campaigns, setCampaigns] = useState<GroupBuyCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [joinQtyMap, setJoinQtyMap] = useState<Record<string, number>>({});
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [gbName, setGbName] = useState('');
  const [gbGov, setGbGov] = useState(profile.governorate || 'القاهرة');
  const [gbTarget, setGbTarget] = useState(50);
  const [gbMyQty, setGbMyQty] = useState(10);
  const [gbUnit, setGbUnit] = useState('بكرة');
  const [gbRetail, setGbRetail] = useState(90);
  const [gbGroupPrice, setGbGroupPrice] = useState(68);
  const [gbBusy, setGbBusy] = useState(false);

  // 5. AI Social Media Copy & Reels Script Generator state
  const [socialProductName, setSocialProductName] = useState('');
  const [socialCraft, setSocialCraft] = useState('حرفة يدوية');
  const [socialMaterials, setSocialMaterials] = useState('خامات طبيعية فاخرة');
  const [socialPrice, setSocialPrice] = useState('');
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialCopy, setSocialCopy] = useState<{
    instagramCaption: string;
    reelsScript: string;
    whatsappPitch: string;
    source?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    syncGrowthHubConfigFromCloud().then((c) => setConfig(c));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'group_buy') return;
    setLoadingCampaigns(true);
    authedFetch('/api/growth/group-buying')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.campaigns)) setCampaigns(d.campaigns);
      })
      .catch(() => {})
      .finally(() => setLoadingCampaigns(false));
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!selectedProductId) return;
    const p = productsList.find((x) => x.id === selectedProductId);
    if (!p) return;
    const cost = Number(p.totalCost || p.unitCost || p.materialCost || 100);
    const retail = Number(p.sellingPrice || p.retailPrice || Math.round(cost * 2));
    setUnitCost(cost);
    setUnitRetail(retail);
    setPassportPieceName(p.productName || '');
    setSocialProductName(p.productName || '');
    setSocialCraft(p.category || 'حرفة يدوية');
    setSocialPrice(`${retail.toLocaleString()} ${currency}`);
  }, [selectedProductId, productsList, currency]);

  const availableTabs = useMemo(() => {
    const list: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [];
    if (config.productionCalendarEnabled) {
      list.push({ id: 'calendar', label: 'تقويم الإنتاج الأسبوعي', icon: <Calendar className="w-3.5 h-3.5" /> });
    }
    if (config.corporateGiftingEnabled) {
      list.push({ id: 'corporate', label: 'حاسبة الجملة والشركات', icon: <Gift className="w-3.5 h-3.5" /> });
    }
    if (config.productPassportQrEnabled) {
      list.push({ id: 'passport', label: 'جواز سفر المنتج QR', icon: <QrCode className="w-3.5 h-3.5" /> });
    }
    if (config.groupBuyingEnabled) {
      list.push({ id: 'group_buy', label: 'الشراء التعاوني للخامات', icon: <Users className="w-3.5 h-3.5" /> });
    }
    if (config.aiSocialCopyEnabled) {
      list.push({ id: 'social_ai', label: 'مولّد الريلز والسوشيال', icon: <Sparkles className="w-3.5 h-3.5" /> });
    }
    return list;
  }, [config]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  if (!isOpen) return null;

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      playSuccessSound();
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  // Calendar helpers
  const saveSlots = (next: ScheduleSlot[]) => {
    setSlots(next);
    try {
      localStorage.setItem(`alshams_sched_${workshopKey}`, JSON.stringify(next));
    } catch {}
  };

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotTitle.trim()) return;
    playButtonClickSound();
    saveSlots([
      ...slots,
      {
        id: `sl_${Date.now()}`,
        title: newSlotTitle.trim(),
        day: newSlotDay,
        hours: Math.max(1, Number(newSlotHours) || 2),
        clientName: newSlotClient.trim() || undefined,
      },
    ]);
    setNewSlotTitle('');
    setNewSlotClient('');
  };

  const openWoHours = workOrdersList
    .filter((wo) => wo.status === 'open' || wo.status === 'in_progress')
    .reduce((sum, wo) => sum + Math.max(2, Number(wo.targetQuantity || 1) * 2), 0);
  const scheduledHours = slots.reduce((s, x) => s + x.hours, 0);
  const totalCommittedHours = scheduledHours + openWoHours;
  const loadPct = Math.round((totalCommittedHours / Math.max(1, weeklyCapacityHours)) * 100);

  // Corporate Gifting Math
  const quotedUnitPrice = Math.max(1, Math.round(unitRetail * (1 - bulkDiscountPct / 100)));
  const effectiveUnitCost = unitCost + packagingPerUnit;
  const unitNetProfit = quotedUnitPrice - effectiveUnitCost;
  const totalDealRevenue = quotedUnitPrice * bulkQty;
  const totalDealCost = effectiveUnitCost * bulkQty;
  const totalDealProfit = unitNetProfit * bulkQty;
  const dealMarginPct = totalDealRevenue > 0 ? Math.round((totalDealProfit / totalDealRevenue) * 100) : 0;

  const corporateQuoteText = [
    `🎁 عرض سعر هدايا مؤسسية / كميات — ${profile.brandName}`,
    `• الكمية: ${bulkQty} قطعة`,
    `• سعر القطعة بعد خصم الجملة (${bulkDiscountPct}%): ${quotedUnitPrice.toLocaleString()} ${currency}`,
    `• شامل التغليف المؤسسي الفاخر`,
    `• إجمالي العرض: ${totalDealRevenue.toLocaleString()} ${currency}`,
    `للتنفيذ وتأكيد موعد التسليم تواصل معنا مباشرة.`,
  ].join('\n');

  // QR Passport URL
  const storeSlug = profile.storeSlug || profile.store_slug || profile.workshopId || profile.id;
  const passportTargetUrl = `${window.location.origin}/#/store/${encodeURIComponent(storeSlug)}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(
    passportTargetUrl
  )}`;

  const handlePrintPassport = () => {
    playButtonClickSound();
    const win = window.open('', '_blank', 'width=680,height=520');
    if (!win) return;
    win.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>بطاقة جواز سفر المنتج</title><style>body{font-family:system-ui,sans-serif;background:#F7F3EA;color:#0C1427;padding:24px;display:flex;justify-content:center}.card{width:460px;border:2px solid #EA580C;border-radius:20px;background:#fff;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,.08)}.row{display:flex;justify-content:space-between;align-items:center;gap:16px}h2{margin:0 0 6px;font-size:20px;color:#0C1427}.brand{color:#C2410C;font-weight:900;font-size:13px}p{font-size:12px;line-height:1.7;color:#334155}img{border-radius:12px;border:1px solid #D4CCBC}</style></head><body><div class="card"><div class="row"><div><div class="brand">${profile.brandName} · ${profile.artistName}</div><h2>${passportPieceName || 'قطعة يدوية أصيلة'}</h2></div><img src="${qrImgUrl}" width="108" height="108"/></div><hr style="border:none;border-top:1px dashed #D4CCBC;margin:14px 0"/><p><strong>قصة القطعة:</strong> ${passportStory}</p><p><strong>تعليمات العناية:</strong> ${passportCare}</p><div style="margin-top:14px;font-size:11px;color:#64748B;text-align:center">امسح الباركود لزيارة متجرنا المعتمد على منظومة الشمساوية</div></div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  // Group Buying handlers
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gbName.trim()) return;
    setGbBusy(true);
    try {
      const res = await authedFetch('/api/growth/group-buying', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialName: gbName.trim(),
          governorate: gbGov.trim(),
          targetQty: gbTarget,
          myQty: gbMyQty,
          unit: gbUnit,
          retailPrice: gbRetail,
          groupPrice: gbGroupPrice,
          creatorBrand: profile.brandName,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.campaigns)) {
        playSuccessSound();
        setCampaigns(data.campaigns);
        setGbName('');
        setShowNewCampaign(false);
      }
    } finally {
      setGbBusy(false);
    }
  };

  const handleJoinCampaign = async (id: string) => {
    const qty = Math.max(1, Number(joinQtyMap[id]) || 5);
    setGbBusy(true);
    try {
      const res = await authedFetch(`/api/growth/group-buying/${encodeURIComponent(id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty, brandName: profile.brandName }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.campaigns)) {
        playSuccessSound();
        setCampaigns(data.campaigns);
      }
    } finally {
      setGbBusy(false);
    }
  };

  // Social AI Generator handler
  const handleGenerateSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialProductName.trim()) return;
    setSocialBusy(true);
    try {
      const res = await authedFetch('/api/growth/ai-social-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: socialProductName.trim(),
          craft: socialCraft.trim(),
          materials: socialMaterials.trim(),
          price: socialPrice.trim(),
          brandName: profile.brandName,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.copy) {
        playSuccessSound();
        setSocialCopy({ ...data.copy, source: data.source });
      }
    } finally {
      setSocialBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex items-start justify-center"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl rounded-3xl bg-[#F2ECE1] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0C1427] text-[#F7F3EA] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#EA580C]/20 border border-[#EA580C]/40 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-[#FBBF24]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black">
                جناح أدوات النمو والتطوير الذكية للورش
              </h2>
              <p className="text-[11px] text-[#CBD5E1]">
                {profile.brandName} · أدوات عملية لزيادة أرباحك وتنظيم وقتك وتوسيع مبيعاتك
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-[#EA580C] text-white flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="px-4 py-3 bg-[#F7F3EA] dark:bg-[#0D162E] border-b border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap gap-1.5">
          {availableTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                playButtonClickSound();
                setActiveTab(t.id);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === t.id
                  ? 'bg-[#EA580C] text-white shadow-xs'
                  : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 text-right">
          {availableTabs.length === 0 ? (
            <div className="py-10 text-center text-xs font-bold text-[#475569]">
              تم إيقاف أدوات النمو مؤقتاً من لوحة تحكم الإدارة.
            </div>
          ) : activeTab === 'calendar' ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    حمل العمل الأسبوعي: {totalCommittedHours} ساعة / {weeklyCapacityHours} ساعة متاحة ({loadPct}%)
                  </div>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    يشمل أوامر التشغيل المفتوحة ({openWoHours} س) + المهام المجدولة ({scheduledHours} س).
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span>طاقة ورشتك الأسبوعية (ساعة):</span>
                  <input
                    type="number"
                    min={8}
                    max={120}
                    value={weeklyCapacityHours}
                    onChange={(e) => {
                      const val = Math.max(8, Number(e.target.value) || 40);
                      setWeeklyCapacityHours(val);
                      try {
                        localStorage.setItem(`alshams_cap_${workshopKey}`, String(val));
                      } catch {}
                    }}
                    className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black text-center"
                  />
                </div>
              </div>

              {loadPct >= 90 && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-400/60 text-rose-700 dark:text-rose-300 text-xs font-black flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    تحذير طاقة إنتاجية: أسبوعك ممتلئ ({loadPct}%) — لا تقبل أوردرات مستعجلة هذا الأسبوع حتى لا تتأخر مواعيد التسليم!
                  </span>
                </div>
              )}

              <form
                onSubmit={handleAddSlot}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3.5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]"
              >
                <input
                  type="text"
                  required
                  value={newSlotTitle}
                  onChange={(e) => setNewSlotTitle(e.target.value)}
                  placeholder="اسم الطلبية أو المهمة..."
                  className="sm:col-span-4 px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
                <input
                  type="text"
                  value={newSlotClient}
                  onChange={(e) => setNewSlotClient(e.target.value)}
                  placeholder="اسم العميل (اختياري)"
                  className="sm:col-span-3 px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                />
                <select
                  value={newSlotDay}
                  onChange={(e) => setNewSlotDay(e.target.value)}
                  className="sm:col-span-2 px-2 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                >
                  {WEEK_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={newSlotHours}
                  onChange={(e) => setNewSlotHours(Number(e.target.value) || 2)}
                  className="sm:col-span-1 px-2 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black text-center"
                  title="عدد الساعات"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>جدولة</span>
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {WEEK_DAYS.map((day) => {
                  const dayItems = slots.filter((s) => s.day === day);
                  const dayHrs = dayItems.reduce((s, x) => s + x.hours, 0);
                  return (
                    <div
                      key={day}
                      className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-black border-b border-[#D4CCBC]/70 dark:border-[#22355E] pb-1.5">
                        <span>{day}</span>
                        <span className="font-mono text-[#C2410C] dark:text-[#FBBF24]">{dayHrs} س</span>
                      </div>
                      {dayItems.length === 0 ? (
                        <p className="text-[11px] text-[#64748B] py-2">متاح لاستقبال طلبات</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dayItems.map((it) => (
                            <div
                              key={it.id}
                              className="p-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC]/70 dark:border-[#22355E] flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-black truncate">{it.title}</div>
                                <div className="text-[10px] text-[#64748B]">
                                  {it.clientName ? `${it.clientName} · ` : ''}
                                  {it.hours} ساعات
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => saveSlots(slots.filter((s) => s.id !== it.id))}
                                className="text-rose-500 hover:text-rose-700 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'corporate' ? (
            <div className="space-y-4">
              {productsList.length > 0 && (
                <div>
                  <label className="block text-xs font-black mb-1">اختر منتجاً من أرشيف ورشتك (اختياري):</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value="">-- إدخال أرقام يدوية --</option>
                    {productsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.productName} — سعر قطاعي {Number(p.sellingPrice || p.retailPrice || 0).toLocaleString()} {currency}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { label: `تكلفة القطعة (${currency})`, val: unitCost, set: setUnitCost },
                  { label: `السعر القطاعي (${currency})`, val: unitRetail, set: setUnitRetail },
                  { label: 'كمية الجملة (قطعة)', val: bulkQty, set: setBulkQty },
                  { label: 'خصم الكمية (%)', val: bulkDiscountPct, set: setBulkDiscountPct },
                  { label: `تغليف مؤسسي (${currency})`, val: packagingPerUnit, set: setPackagingPerUnit },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-2.5"
                  >
                    <label className="block text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                      {f.label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={f.val}
                      onChange={(e) => f.set(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black text-xs"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { qty: 50, disc: 12, label: 'باقة 50 قطعة (-12%)' },
                  { qty: 100, disc: 18, label: 'باقة 100 قطعة (-18%)' },
                  { qty: 250, disc: 25, label: 'باقة 250 قطعة (-25%)' },
                ].map((tier) => (
                  <button
                    key={tier.qty}
                    type="button"
                    onClick={() => {
                      setBulkQty(tier.qty);
                      setBulkDiscountPct(tier.disc);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black cursor-pointer"
                  >
                    {tier.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
                  <div className="text-[10px] font-bold text-[#475569]">سعر القطعة للعرض</div>
                  <div className="text-lg font-mono font-black text-[#EA580C]">
                    {quotedUnitPrice.toLocaleString()} {currency}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
                  <div className="text-[10px] font-bold text-[#475569]">إجمالي الصفقة</div>
                  <div className="text-lg font-mono font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    {totalDealRevenue.toLocaleString()} {currency}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
                  <div className="text-[10px] font-bold text-[#475569]">إجمالي التكلفة</div>
                  <div className="text-lg font-mono font-black text-[#475569] dark:text-[#CBD5E1]">
                    {totalDealCost.toLocaleString()} {currency}
                  </div>
                </div>
                <div
                  className={`p-3.5 rounded-2xl border ${
                    totalDealProfit > 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/60'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-400/60'
                  }`}
                >
                  <div className="text-[10px] font-bold">صافي ربحك ({dealMarginPct}%)</div>
                  <div className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-300">
                    {totalDealProfit.toLocaleString()} {currency}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => copyText('corp', corporateQuoteText)}
                  className="px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'corp' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === 'corp' ? 'تم نسخ عرض السعر!' : 'نسخ عرض السعر لإرساله للشركة'}</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'passport' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black mb-1">اسم القطعة الفنية</label>
                  <input
                    type="text"
                    value={passportPieceName}
                    onChange={(e) => setPassportPieceName(e.target.value)}
                    placeholder="مثال: جدارية مكرمية بوهيمي قطن طبيعي"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">قصة القطعة وتوقيع الفنان</label>
                  <textarea
                    rows={3}
                    value={passportStory}
                    onChange={(e) => setPassportStory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">تعليمات العناية بالقطعة</label>
                  <textarea
                    rows={2}
                    value={passportCare}
                    onChange={(e) => setPassportCare(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs leading-relaxed"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePrintPassport}
                  className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقة جواز سفر المنتج الآن</span>
                </button>
              </div>

              {/* Live Card Preview */}
              <div className="rounded-2xl bg-white dark:bg-[#0D162E] border-2 border-[#EA580C] p-5 space-y-3 shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24]">
                      {profile.brandName} · {profile.artistName}
                    </div>
                    <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {passportPieceName || 'قطعة يدوية أصيلة'}
                    </h3>
                  </div>
                  <img
                    src={qrImgUrl}
                    alt="QR المتجر"
                    className="w-24 h-24 rounded-xl border border-[#D4CCBC] bg-white p-1 shrink-0"
                  />
                </div>
                <div className="border-t border-dashed border-[#D4CCBC] dark:border-[#22355E] pt-3 space-y-2 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                  <p>
                    <strong className="text-[#0C1427] dark:text-[#F7F3EA]">قصة القطعة:</strong> {passportStory}
                  </p>
                  <p>
                    <strong className="text-[#0C1427] dark:text-[#F7F3EA]">تعليمات العناية:</strong> {passportCare}
                  </p>
                </div>
                <div className="text-[10px] font-bold text-[#64748B] text-center pt-1">
                  امسح الباركود لزيارة متجر {profile.brandName} على منظومة الشمساوية
                </div>
              </div>
            </div>
          ) : activeTab === 'group_buy' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                  شارك مع زملائك الفنانين لشراء الخامات بكميات الجملة وتوفير حتى 25% من التكلفة.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewCampaign((p) => !p)}
                  className="px-3.5 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showNewCampaign ? 'إغلاق النموذج' : 'إطلاق حملة شراء تعاوني جديدة'}</span>
                </button>
              </div>

              {showNewCampaign && (
                <form
                  onSubmit={handleCreateCampaign}
                  className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#EA580C] grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs"
                >
                  <input
                    type="text"
                    required
                    value={gbName}
                    onChange={(e) => setGbName(e.target.value)}
                    placeholder="اسم الخامة المطلوبة..."
                    className="sm:col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                  <input
                    type="text"
                    value={gbGov}
                    onChange={(e) => setGbGov(e.target.value)}
                    placeholder="المحافظة / النطاق"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                  <input
                    type="number"
                    min={5}
                    value={gbTarget}
                    onChange={(e) => setGbTarget(Number(e.target.value) || 50)}
                    placeholder="الكمية المستهدفة"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                  <input
                    type="number"
                    min={1}
                    value={gbMyQty}
                    onChange={(e) => setGbMyQty(Number(e.target.value) || 10)}
                    placeholder="حصتك المبدئية"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                  <input
                    type="text"
                    value={gbUnit}
                    onChange={(e) => setGbUnit(e.target.value)}
                    placeholder="الوحدة (بكرة/كجم)"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                  <input
                    type="number"
                    min={1}
                    value={gbRetail}
                    onChange={(e) => setGbRetail(Number(e.target.value) || 90)}
                    placeholder="سعر السوق القطاعي"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                  <input
                    type="number"
                    min={1}
                    value={gbGroupPrice}
                    onChange={(e) => setGbGroupPrice(Number(e.target.value) || 68)}
                    placeholder="سعر الشراء التعاوني"
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                  <button
                    type="submit"
                    disabled={gbBusy}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black cursor-pointer"
                  >
                    {gbBusy ? 'جاري النشر...' : 'نشر الحملة للفنانين'}
                  </button>
                </form>
              )}

              {loadingCampaigns ? (
                <div className="py-8 text-center text-xs font-bold text-[#475569]">جاري تحميل حملات الشراء التعاوني...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {campaigns.map((c) => {
                    const pct = Math.min(100, Math.round((c.currentQty / Math.max(1, c.targetQty)) * 100));
                    const savePct = Math.max(0, Math.round(((c.retailPrice - c.groupPrice) / Math.max(1, c.retailPrice)) * 100));
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                              {c.materialName}
                            </h4>
                            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                              {c.governorate} · بقيادة {c.creatorBrand}
                            </p>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black shrink-0">
                            وفر {savePct}%
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span>
                              تم تجميع {c.currentQty} / {c.targetQty} {c.unit}
                            </span>
                            <span className="font-mono text-[#EA580C]">{pct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#D4CCBC] dark:bg-[#1A2B54] overflow-hidden">
                            <div className="h-full bg-[#EA580C]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs font-mono font-black">
                          <span className="text-[#64748B] line-through">
                            {c.retailPrice} {currency}
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-300">
                            سعر التجمع: {c.groupPrice} {currency} / {c.unit}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="number"
                            min={1}
                            value={joinQtyMap[c.id] ?? 5}
                            onChange={(e) =>
                              setJoinQtyMap((p) => ({ ...p, [c.id]: Math.max(1, Number(e.target.value) || 1) }))
                            }
                            className="w-20 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-black text-center"
                          />
                          <button
                            type="button"
                            disabled={gbBusy}
                            onClick={() => handleJoinCampaign(c.id)}
                            className="flex-1 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] hover:opacity-90 text-white text-xs font-black cursor-pointer"
                          >
                            انضم واحجز حصتك الآن
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <form
                onSubmit={handleGenerateSocial}
                className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
              >
                <div>
                  <label className="block font-black mb-1">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    value={socialProductName}
                    onChange={(e) => setSocialProductName(e.target.value)}
                    placeholder="مثال: شنطة خرز لولي يدوية للسهرة"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black mb-1">الحرفة / القسم</label>
                  <input
                    type="text"
                    value={socialCraft}
                    onChange={(e) => setSocialCraft(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black mb-1">أبرز الخامات والمميزات</label>
                  <input
                    type="text"
                    value={socialMaterials}
                    onChange={(e) => setSocialMaterials(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black mb-1">السعر (اختياري)</label>
                  <input
                    type="text"
                    value={socialPrice}
                    onChange={(e) => setSocialPrice(e.target.value)}
                    placeholder={`مثال: 450 ${currency}`}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={socialBusy}
                    className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{socialBusy ? 'جاري صياغة المحتوى...' : 'توليد بوست إنستجرام + سكريبت ريلز + رسالة واتساب'}</span>
                  </button>
                </div>
              </form>

              {socialCopy && (
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { key: 'ig', title: 'بوست إنستجرام وفيسبوك جاهز للنشر', text: socialCopy.instagramCaption },
                    { key: 'reels', title: 'سيناريو ريلز / تيك توك (30 ثانية)', text: socialCopy.reelsScript },
                    { key: 'wa', title: 'رسالة إغلاق البيع عبر واتساب', text: socialCopy.whatsappPitch },
                  ].map((box) => (
                    <div
                      key={box.key}
                      className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">{box.title}</span>
                        <button
                          type="button"
                          onClick={() => copyText(box.key, box.text)}
                          className="px-2.5 py-1 rounded-lg bg-[#0C1427] dark:bg-[#EA580C] text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === box.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === box.key ? 'تم النسخ' : 'نسخ'}</span>
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-[#0C1427] dark:text-[#F7F3EA]">
                        {box.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
