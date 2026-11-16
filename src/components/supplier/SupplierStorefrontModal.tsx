import React, { useState, useRef } from 'react';
import { UserProfile } from '../../types';
import { SupplierStoreConfig, SupplierStoreCoupon } from '../../types/supplier';
import { updateSupplierStoreConfig } from '../../db/supplierService';
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
} from 'lucide-react';

interface SupplierStorefrontModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onOpenPersonalProfile?: () => void;
}

const THEME_PRESETS: { id: NonNullable<SupplierStoreConfig['themePreset']>; label: string }[] = [
  { id: 'warm_atelier', label: 'دافئ حرفي (الرملي والبرتقالي)' },
  { id: 'deep_navy', label: 'كحلي تنفيذي (كحلي وذهبي)' },
  { id: 'emerald_craft', label: 'زمردي (أخضر وعاجي)' },
  { id: 'minimal_stone', label: 'حجري هادئ (أبيض ورمادي)' },
];

export const SupplierStorefrontModal: React.FC<SupplierStorefrontModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onOpenPersonalProfile,
}) => {
  const initialCfg: SupplierStoreConfig = profile.storeConfig || {};
  const [tab, setTab] = useState<'appearance' | 'promotions' | 'qr'>('appearance');
  const [brandName, setBrandName] = useState(profile.brandName || '');
  const [storeSlug, setStoreSlug] = useState(profile.storeSlug || profile.store_slug || '');
  const [phone, setPhone] = useState(profile.phoneNumber || '');
  const [governorate, setGovernorate] = useState(profile.governorate || '');

  const [tagline, setTagline] = useState(initialCfg.tagline || '');
  const [description, setDescription] = useState(initialCfg.description || '');
  const [themePreset, setThemePreset] = useState<NonNullable<SupplierStoreConfig['themePreset']>>(
    initialCfg.themePreset || 'warm_atelier'
  );
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
  const [coupons, setCoupons] = useState<SupplierStoreCoupon[]>(initialCfg.coupons || []);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPct, setNewCouponPct] = useState(10);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const effectiveSlug = (storeSlug || profile.id || '').trim();
  const storeUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?supplier=${encodeURIComponent(effectiveSlug)}`
      : `/?supplier=${encodeURIComponent(effectiveSlug)}`;

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const nextConfig: SupplierStoreConfig = {
      tagline: tagline.trim(),
      description: description.trim(),
      themePreset,
      whatsappNumber: whatsappNumber.trim(),
      instagramUrl: instagramUrl.trim(),
      facebookUrl: facebookUrl.trim(),
      shippingNote: shippingNote.trim(),
      freeShippingAbove: Number(freeShippingAbove || 0),
      showWholesalePricesPublicly,
      coupons,
    };

    const res = await updateSupplierStoreConfig(nextConfig, {
      brandName: brandName.trim(),
      storeSlug: storeSlug.trim(),
      phone: phone.trim(),
      governorate: governorate.trim(),
    });
    setSaving(false);

    if (!res.success || !res.supplier) {
      setFeedback({ text: res.error || 'تعذر حفظ إعدادات المتجر', isError: true });
      return;
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
    setFeedback({ text: 'تم حفظ إعدادات متجر المورد بنجاح!' });
  };

  const handleAddCoupon = () => {
    const code = newCouponCode.trim().toUpperCase();
    if (!code) return;
    setCoupons((prev) => [
      ...prev.filter((c) => c.code !== code),
      { code, discountPercent: Math.min(90, Math.max(1, Number(newCouponPct || 5))), active: true },
    ]);
    setNewCouponCode('');
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="w-full max-w-3xl bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-right">
        {/* Header with Back & Close */}
        <div className="p-4 sm:p-5 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>رجوع</span>
          </button>

          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-[#EA580C]" />
            <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
              لوحة تحكم متجر المورد
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub Tabs */}
        <div className="px-4 sm:px-5 pt-3 flex items-center gap-2 border-b border-[#D4CCBC]/70 dark:border-[#22355E]">
          {[
            { id: 'appearance' as const, label: 'الهوية والمظهر', icon: Palette },
            { id: 'promotions' as const, label: 'الكوبونات والشحن', icon: TicketPercent },
            { id: 'qr' as const, label: 'الرابط و QR', icon: QrCode },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  tab === t.id
                    ? 'border-[#EA580C] text-[#C2410C] dark:text-amber-300'
                    : 'border-transparent text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
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
                  <label className="font-bold">نبذة المتجر (تتزامن تلقائياً مع قصتك بصفحتك الشخصية)</label>
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
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1.5">طابع مظهر المتجر</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setThemePreset(p.id)}
                      className={`p-2.5 rounded-xl border text-right font-bold cursor-pointer ${
                        themePreset === p.id
                          ? 'bg-[#EA580C]/15 border-[#EA580C] text-[#C2410C] dark:text-amber-300'
                          : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
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

          {tab === 'promotions' && (
            <div className="space-y-4">
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
                    شحن مجاني للطلبات فوق ({profile.currencySymbol || 'ج.م'})
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

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
                <div className="font-black">أكواد خصم المتجر (Coupons)</div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value)}
                    placeholder="كود الخصم (مثال: SHAMS10)"
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] font-mono font-bold uppercase"
                  />
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={newCouponPct}
                    onChange={(e) => setNewCouponPct(Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAddCoupon}
                    className="px-3.5 py-2 rounded-xl bg-[#EA580C] text-white font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة كوبون</span>
                  </button>
                </div>

                {coupons.length > 0 && (
                  <div className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                    {coupons.map((c) => (
                      <div key={c.code} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-black">{c.code}</span>
                          <span className="mr-2 text-[#475569] dark:text-[#94A3B8]">
                            خصم {c.discountPercent}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setCoupons((prev) =>
                                prev.map((x) =>
                                  x.code === c.code ? { ...x, active: !x.active } : x
                                )
                              )
                            }
                            className={`font-black cursor-pointer ${
                              c.active ? 'text-emerald-600' : 'text-stone-400'
                            }`}
                          >
                            {c.active ? 'مفعّل' : 'متوقف'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCoupons((prev) => prev.filter((x) => x.code !== c.code))
                            }
                            className="text-rose-600 cursor-pointer"
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
        <div className="p-4 sm:p-5 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-end gap-2">
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
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </div>
  );
};
