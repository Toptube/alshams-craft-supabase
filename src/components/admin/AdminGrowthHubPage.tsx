import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  Barcode,
  Calendar,
  CreditCard,
  Gift,
  GraduationCap,
  Percent,
  QrCode,
  Radar,
  Rocket,
  Save,
  Sparkles,
  Tag,
  Truck,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import {
  GrowthHubConfig,
  getStoredGrowthHubConfig,
} from '../../types/artisanGrowth';
import {
  saveGrowthHubConfigToCloud,
  syncGrowthHubConfigFromCloud,
} from '../../db/memberProfileService';
import { playButtonClickSound, playErrorSound, playSuccessSound } from '../../lib/sounds';

interface AdminGrowthHubPageProps {
  onBack: () => void;
  onOpenExpertsPage?: () => void;
  onNotifySuccess?: (msg: string) => void;
  onNotifyError?: (msg: string) => void;
}

export const AdminGrowthHubPage: React.FC<AdminGrowthHubPageProps> = ({
  onBack,
  onOpenExpertsPage,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [config, setConfig] = useState<GrowthHubConfig>(() => getStoredGrowthHubConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    syncGrowthHubConfigFromCloud()
      .then((c) => setConfig(c))
      .finally(() => setLoading(false));
  }, []);

  const toggleBool = (key: keyof GrowthHubConfig) => {
    playButtonClickSound();
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await saveGrowthHubConfigToCloud(config);
    setSaving(false);
    if (res.success) {
      playSuccessSound();
      onNotifySuccess?.('تم حفظ ونشر إعدادات مركز التطوير والنمو فوراً لجميع الفنانين والموردين!');
    } else {
      playErrorSound();
      onNotifyError?.(res.error || 'تعذر حفظ إعدادات مركز النمو.');
    }
  };

  const artisanSwitches: {
    key: keyof GrowthHubConfig;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'productionCalendarEnabled',
      title: 'تقويم الإنتاج والطاقة الأسبوعية للورش',
      desc: 'جدولة مواعيد التسليم مع تحذير تلقائي عند تجاوز طاقة الورشة الأسبوعية.',
      icon: <Calendar className="w-4 h-4 text-[#EA580C]" />,
    },
    {
      key: 'corporateGiftingEnabled',
      title: 'حاسبة تسعير الجملة وهدايا الشركات (Corporate Gifting)',
      desc: 'حساب فوري لخصومات الكميات (50 / 100 / 250+ قطعة) مع الحفاظ على هامش الربح.',
      icon: <Gift className="w-4 h-4 text-emerald-600" />,
    },
    {
      key: 'productPassportQrEnabled',
      title: 'بطاقة جواز سفر المنتج بالباركود (QR Passport)',
      desc: 'بطاقة أنيقة قابلة للطباعة مع كل قطعة تحمل قصتها وتعليمات العناية وباركود المتجر.',
      icon: <QrCode className="w-4 h-4 text-indigo-600" />,
    },
    {
      key: 'groupBuyingEnabled',
      title: 'مجمع الشراء التعاوني للخامات (Group Buying)',
      desc: 'تجميع طلبات الفنانين لشراء خامات الجملة والمستوردة بأفضل سعر تعاوني.',
      icon: <Users className="w-4 h-4 text-amber-600" />,
    },
    {
      key: 'aiSocialCopyEnabled',
      title: 'مولّد محتوى السوشيال ميديا وسيناريو الريلز (30 ثانية)',
      desc: 'كتابة منشورات بيعية وسكربت ريلز وهاشتاجات لمنتجات الورشة بضغطة زر.',
      icon: <Sparkles className="w-4 h-4 text-violet-600" />,
    },
  ];

  const supplierSwitches: {
    key: keyof GrowthHubConfig;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'supplierCreditLimitEnabled',
      title: 'نظام الحد الائتماني والآجل للورش الموثوقة',
      desc: 'تحديد سقف آجل لكل ورشة ومتابعة الأرصدة المستحقة بأمان.',
      icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
    },
    {
      key: 'supplierMobileStocktakeEnabled',
      title: 'الجرد السريع بالباركود من الموبايل',
      desc: 'مطابقة الرصيد الفعلي مع الدفتري وحساب العجز والزيادة لحظياً.',
      icon: <Barcode className="w-4 h-4 text-[#EA580C]" />,
    },
    {
      key: 'supplierFlashBundlesEnabled',
      title: 'باقات تصفية البواقي والكسر (Flash Remnants)',
      desc: 'تصريف بواقي اللفات والأخشاب بخصومات سريعة تجذب الفنانين.',
      icon: <Tag className="w-4 h-4 text-rose-600" />,
    },
    {
      key: 'supplierSmartRestockEnabled',
      title: 'رادار إعادة الطلب التنبؤي للخامات',
      desc: 'رصد الخامات الأكثر استهلاكاً بالورش واقتراح عروض مسبقة قبل النفاد.',
      icon: <Radar className="w-4 h-4 text-sky-600" />,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C]" />
            <span>العودة للوحة الإدارة</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>مركز التطوير والنمو والابتكار (التحكم الشامل)</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              تفعيل وإيقاف وتخصيص كل أدوات النمو للفنانين والموردين، السفراء، واختبارات صفحة الهبوط والربط المؤسسي.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenExpertsPage && (
            <button
              type="button"
              onClick={onOpenExpertsPage}
              className="px-3.5 py-2.5 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-[#FBBF24]" />
              <span>إدارة الخبراء والمدربين</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري النشر...' : 'حفظ ونشر كل التعديلات'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Artisan Growth Tools */}
      <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3.5">
        <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#EA580C]" />
          <span>أدوات التطوير والنمو للفنانين والورش</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {artisanSwitches.map((item) => {
            const active = Boolean(config[item.key]);
            return (
              <div
                key={String(item.key)}
                className="p-3.5 rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBool(item.key)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 cursor-pointer transition ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#D4CCBC] dark:bg-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  {active ? 'مفعّل ✓' : 'موقوف'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Supplier Growth Tools */}
      <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3.5">
        <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-600" />
          <span>أدوات التطوير والنمو لموردي الخامات</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {supplierSwitches.map((item) => {
            const active = Boolean(config[item.key]);
            return (
              <div
                key={String(item.key)}
                className="p-3.5 rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBool(item.key)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 cursor-pointer transition ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#D4CCBC] dark:bg-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  {active ? 'مفعّل ✓' : 'موقوف'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Acquisition, Quiz, Ambassadors & Infrastructure Readiness */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3.5">
          <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#EA580C]" />
            <span>النمو التسويقي وصفحة الهبوط والسفراء</span>
          </h2>

          <div className="space-y-2.5 text-xs">
            <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer">
              <span className="font-bold">تفعيل اختبار مستوى الفنان التفاعلي في صفحة الهبوط (Lead Magnet)</span>
              <input
                type="checkbox"
                checked={config.landingQuizEnabled}
                onChange={() => toggleBool('landingQuizEnabled')}
                className="w-4 h-4 accent-[#EA580C] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer">
              <span className="font-bold">تفعيل برنامج سفراء الشمساوية وروابط الإحالة بالعمولة</span>
              <input
                type="checkbox"
                checked={config.ambassadorsProgramEnabled}
                onChange={() => toggleBool('ambassadorsProgramEnabled')}
                className="w-4 h-4 accent-[#EA580C] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer">
              <span className="font-bold flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>تفعيل مراجعة وموافقة الإدارة قبل اعتماد المدرب</span>
              </span>
              <input
                type="checkbox"
                checked={config.trainerRequireApproval}
                onChange={() => toggleBool('trainerRequireApproval')}
                className="w-4 h-4 accent-[#EA580C] cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3.5">
          <h2 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#EA580C]" />
            <span>الربط المؤسسي (الدفع الإلكتروني، الشحن الآلي، الفاتورة الإلكترونية)</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-black text-[#334155] dark:text-[#CBD5E1]">
                بوابة الدفع الإلكتروني المعتمدة للمنظومة
              </label>
              <select
                value={config.paymentGatewayProvider}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    paymentGatewayProvider: e.target.value as GrowthHubConfig['paymentGatewayProvider'],
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                <option value="manual">تحويل يدوي / إنستا باي / فودافون كاش (الوضع الحالي)</option>
                <option value="paymob">Paymob (البطاقات والمحافظ الإلكترونية)</option>
                <option value="fawry">Fawry Pay (فوري باي)</option>
                <option value="kashier">Kashier (كاشير)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-black text-[#334155] dark:text-[#CBD5E1]">
                الربط الآلي مع شركات الشحن وإصدار البوالص
              </label>
              <select
                value={config.shippingCarrierProvider}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    shippingCarrierProvider: e.target.value as GrowthHubConfig['shippingCarrierProvider'],
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                <option value="manual">جداول شحن المحافظات اليدوية (الوضع الحالي)</option>
                <option value="bosta">بوسطة (Bosta API) — إصدار بوالص وتتبع لحظي</option>
                <option value="aramex">أرامكس (Aramex API) — شحن محلي ودولي</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-black text-[#334155] dark:text-[#CBD5E1]">
                توافق الفاتورة الإلكترونية (ETA / ZATCA)
              </label>
              <select
                value={config.eInvoiceMode}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    eInvoiceMode: e.target.value as GrowthHubConfig['eInvoiceMode'],
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                <option value="off">فواتير تجارية قياسية بالمنظومة (معطل للربط الضريبي)</option>
                <option value="eta_egypt">مصلحة الضرائب المصرية (ETA QR Format)</option>
                <option value="zatca_ksa">هيئة الزكاة والضريبة السعودية (ZATCA TLV QR)</option>
              </select>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
