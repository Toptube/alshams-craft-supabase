import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Check,
  Copy,
  CreditCard,
  Plus,
  Radar,
  Rocket,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { B2BSupplyOrder, SupplierCatalogItem, SupplierCustomer } from '../../types/supplier';
import { GrowthHubConfig, getStoredGrowthHubConfig } from '../../types/artisanGrowth';
import { syncGrowthHubConfigFromCloud } from '../../db/memberProfileService';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface SupplierGrowthToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  catalog: SupplierCatalogItem[];
  customers: SupplierCustomer[];
  orders: B2BSupplyOrder[];
}

interface FlashRemnantBundle {
  id: string;
  title: string;
  qtyText: string;
  originalPrice: number;
  flashPrice: number;
}

export const SupplierGrowthToolsPanel: React.FC<SupplierGrowthToolsPanelProps> = ({
  isOpen,
  onClose,
  profile,
  catalog,
  customers,
  orders,
}) => {
  const [config, setConfig] = useState<GrowthHubConfig>(() => getStoredGrowthHubConfig());
  const [activeTab, setActiveTab] = useState<'credit' | 'stocktake' | 'remnants' | 'radar'>('credit');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currency = profile.currencySymbol || 'ج.م';
  const supKey = profile.id || 'supplier';

  // 1. Workshop Credit Limits
  const [creditLimits, setCreditLimits] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`alshams_sup_credit_${supKey}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // 2. Mobile Barcode Stocktake
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [countedMap, setCountedMap] = useState<Record<string, number>>({});

  // 3. Flash Remnants Bundles
  const [bundles, setBundles] = useState<FlashRemnantBundle[]>(() => {
    try {
      const raw = localStorage.getItem(`alshams_sup_remnants_${supKey}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [bTitle, setBTitle] = useState('');
  const [bQty, setBQty] = useState('5 لفات متفرقة');
  const [bOrig, setBOrig] = useState(450);
  const [bFlash, setBFlash] = useState(290);

  useEffect(() => {
    if (!isOpen) return;
    syncGrowthHubConfigFromCloud().then((c) => setConfig(c));
  }, [isOpen]);

  const availableTabs = useMemo(() => {
    const list: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [];
    if (config.supplierCreditLimitEnabled) {
      list.push({ id: 'credit', label: 'الحد الائتماني للورش', icon: <CreditCard className="w-3.5 h-3.5" /> });
    }
    if (config.supplierMobileStocktakeEnabled) {
      list.push({ id: 'stocktake', label: 'جرد الموبايل بالباركود', icon: <Barcode className="w-3.5 h-3.5" /> });
    }
    if (config.supplierFlashBundlesEnabled) {
      list.push({ id: 'remnants', label: 'تصفية البواقي والكسر', icon: <Tag className="w-3.5 h-3.5" /> });
    }
    if (config.supplierSmartRestockEnabled) {
      list.push({ id: 'radar', label: 'رادار الطلب التنبؤي', icon: <Radar className="w-3.5 h-3.5" /> });
    }
    return list;
  }, [config]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  // Demand radar calculation from catalog & orders
  const radarItems = useMemo(() => {
    const demandCount: Record<string, number> = {};
    for (const ord of orders) {
      for (const it of ord.items || []) {
        const key = (it.name || '').toLowerCase();
        demandCount[key] = (demandCount[key] || 0) + Number(it.quantity || 1);
      }
    }
    return catalog
      .map((item) => {
        const soldQty = demandCount[(item.name || '').toLowerCase()] || 0;
        const stock = Number(item.stockQty || 0);
        const riskScore = stock <= 5 ? 95 : stock <= 12 ? 70 : Math.min(60, soldQty * 8);
        return { item, soldQty, stock, riskScore };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);
  }, [catalog, orders]);

  if (!isOpen) return null;

  const updateCreditLimit = (custId: string, limit: number) => {
    const next = { ...creditLimits, [custId]: Math.max(0, limit) };
    setCreditLimits(next);
    try {
      localStorage.setItem(`alshams_sup_credit_${supKey}`, JSON.stringify(next));
    } catch {}
  };

  const saveBundles = (next: FlashRemnantBundle[]) => {
    setBundles(next);
    try {
      localStorage.setItem(`alshams_sup_remnants_${supKey}`, JSON.stringify(next));
    } catch {}
  };

  const handleAddBundle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bTitle.trim()) return;
    playSuccessSound();
    saveBundles([
      {
        id: `rem_${Date.now()}`,
        title: bTitle.trim(),
        qtyText: bQty.trim(),
        originalPrice: bOrig,
        flashPrice: bFlash,
      },
      ...bundles,
    ]);
    setBTitle('');
  };

  const copyShare = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      playSuccessSound();
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const filteredStocktake = catalog.filter((item) => {
    const q = barcodeQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.skuCode || item.unifiedCode || '').toLowerCase().includes(q)
    );
  });

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
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black">
                جناح أدوات النمو والتطوير الذكية للموردين
              </h2>
              <p className="text-[11px] text-[#CBD5E1]">
                {profile.brandName} · إدارة الآجل والجرد السريع وتصريف البواقي ورادار الطلب
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

        {/* Tabs */}
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
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1]'
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
              أدوات نمو الموردين متوقفة مؤقتاً من لوحة تحكم الإدارة.
            </div>
          ) : activeTab === 'credit' ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                حدد سقف المديونية الآجلة لكل ورشة عميلة لمتابعة التحصيل بأمان ومنع تراكم المتأخرات.
              </p>
              {customers.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] text-center text-xs font-bold text-[#475569]">
                  لا توجد ورش عميلة مسجلة في قائمة عملائك حتى الآن.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {customers.map((c) => {
                    const limit = creditLimits[c.id] ?? 5000;
                    const balance = Math.max(0, Number(c.balanceDue || 0));
                    const pct = limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0;
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                              {c.name} {c.governorate ? `(${c.governorate})` : ''}
                            </div>
                            <div className="text-[11px] font-mono font-bold text-[#475569] dark:text-[#94A3B8]">
                              المستحق الحالي: {balance.toLocaleString()} {currency}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <span>السقف الائتماني:</span>
                            <input
                              type="number"
                              min={0}
                              step={500}
                              value={limit}
                              onChange={(e) => updateCreditLimit(c.id, Number(e.target.value) || 0)}
                              className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black text-center"
                            />
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#D4CCBC] dark:bg-[#1A2B54] overflow-hidden">
                          <div
                            className={`h-full ${pct >= 85 ? 'bg-rose-600' : 'bg-emerald-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {pct >= 85 && (
                          <div className="text-[11px] font-black text-rose-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>اقتربت الورشة من الحد الائتماني ({pct}%) — يُنصح بتحصيل دفعة قبل التوريد الجديد.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'stocktake' ? (
            <div className="space-y-3">
              <input
                type="text"
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                placeholder="امسح الباركود أو ابحث باسم الخامة / كود SKU للجرد الفوري..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {filteredStocktake.slice(0, 20).map((item) => {
                  const bookQty = Number(item.stockQty || 0);
                  const counted = countedMap[item.id];
                  const diff = typeof counted === 'number' ? counted - bookQty : null;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-black truncate">{item.name}</div>
                        <div className="text-[11px] font-mono text-[#64748B]">
                          الرصيد الدفتري: {bookQty} {item.unit}{' '}
                          {item.skuCode || item.unifiedCode
                            ? `· كود: ${item.skuCode || item.unifiedCode}`
                            : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          placeholder="الفعلي"
                          value={counted ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCountedMap((p) => ({
                              ...p,
                              [item.id]: val === '' ? (undefined as any) : Math.max(0, Number(val)),
                            }));
                          }}
                          className="w-20 px-2 py-1.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black text-center"
                        />
                        {diff !== null && (
                          <span
                            className={`px-2 py-1 rounded-lg font-mono text-[11px] font-black ${
                              diff === 0
                                ? 'bg-emerald-600 text-white'
                                : diff < 0
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            {diff === 0 ? 'مطابق ✓' : diff < 0 ? `عجز ${diff}` : `زيادة +${diff}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'remnants' ? (
            <div className="space-y-4">
              <form
                onSubmit={handleAddBundle}
                className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs"
              >
                <input
                  type="text"
                  required
                  value={bTitle}
                  onChange={(e) => setBTitle(e.target.value)}
                  placeholder="وصف باقة البواقي / الكسر..."
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                />
                <input
                  type="text"
                  value={bQty}
                  onChange={(e) => setBQty(e.target.value)}
                  placeholder="الكمية (مثال: 5 لفات)"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                />
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={bOrig}
                    onChange={(e) => setBOrig(Number(e.target.value) || 0)}
                    placeholder="الأصلي"
                    className="w-1/2 px-2 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                  <input
                    type="number"
                    value={bFlash}
                    onChange={(e) => setBFlash(Number(e.target.value) || 0)}
                    placeholder="التصفية"
                    className="w-1/2 px-2 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                </div>
                <div className="sm:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#EA580C] text-white font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة باقة تصفية سريعة</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bundles.map((b) => {
                  const promoMsg = `🔥 عرض تصفية بواقي من ${profile.brandName}!\n📦 ${b.title} (${b.qtyText})\n💰 بدلاً من ${b.originalPrice} ${currency} ← فقط ${b.flashPrice} ${currency} للكمية كاملة!\n⚡ الكمية محدودة — احجز الآن!`;
                  return (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black">{b.title}</div>
                          <div className="text-[11px] text-[#64748B]">{b.qtyText}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => saveBundles(bundles.filter((x) => x.id !== b.id))}
                          className="text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono font-black">
                        <span className="line-through text-[#64748B]">
                          {b.originalPrice} {currency}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {b.flashPrice} {currency}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyShare(b.id, promoMsg)}
                        className="w-full py-1.5 rounded-xl bg-[#0C1427] dark:bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copiedId === b.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === b.id ? 'تم نسخ الإعلان!' : 'نسخ إعلان العرض للورش'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                يرصد الرادار الخامات الأعلى سحباً أو الأقل رصيداً في مخزنك لتجهيز طلبيات إعادة التوريد مبكراً.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {radarItems.map(({ item, soldQty, stock, riskScore }) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">{item.name}</div>
                      <div className="text-[11px] text-[#64748B]">
                        الرصيد الحالي: {stock} {item.unit} · مسحوب بالطلبات: {soldQty}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                        riskScore >= 80
                          ? 'bg-rose-600 text-white'
                          : riskScore >= 60
                          ? 'bg-amber-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {riskScore >= 80 ? 'أولوية عاجلة' : riskScore >= 60 ? 'توريد قريب' : 'مستقر'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
