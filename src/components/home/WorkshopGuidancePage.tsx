import React, { useState } from 'react';
import {
  Rocket,
  Sun,
  Layers,
  ShoppingBag,
  Users,
  Wallet,
  PackagePlus,
  DollarSign,
  Hammer,
  ShoppingCart,
  Store,
  Boxes,
  Truck,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface GuideStep {
  id: string;
  badge: string;
  title: string;
  line: string;
  example?: string;
  actionLabel: string;
  actionKey: string;
  secondaryLabel?: string;
  secondaryActionKey?: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const ARTISAN_START_STEPS: GuideStep[] = [
  {
    id: 'step_materials',
    badge: 'خطوة ١',
    title: 'اختار خامات شغلك',
    line: 'نزّل أسماء الخامات اللي بتشتغل بيها بس من الدليل، ومحدش هيطالبك برصيد طول ما لسه ما اشتريتش.',
    example: 'مثال: خيط مكرمية، جلد طبيعي، قماش قطن، إكسسوار نحاس.',
    actionLabel: 'افتح خاماتي',
    actionKey: 'nav_materials',
    secondaryLabel: 'دليل الخامات الموحد',
    secondaryActionKey: 'nav_unified_materials',
    Icon: Layers,
    accent: 'text-[#EA580C] bg-[#EA580C]/10 border-[#EA580C]/25',
  },
  {
    id: 'step_products',
    badge: 'خطوة ٢',
    title: 'سعّر منتجك واحفظه في أرشيفك',
    line: 'احسب تكلفة القطعة صح عشان ما تخسرش في التسعير، وسجل منتجاتك الجاهزة عشان تظهر في كتالوجك ومتجرك.',
    example: 'مثال: شنطة يد، طقم مكرمية، محفظة جلد، مفرش تطريز.',
    actionLabel: 'احسب تكلفة منتج',
    actionKey: 'nav_calculator',
    secondaryLabel: 'أرشيف منتجاتي',
    secondaryActionKey: 'nav_archive',
    Icon: ShoppingBag,
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  {
    id: 'step_people',
    badge: 'خطوة ٣',
    title: 'سجل موردينك وعملائك',
    line: 'خلي أرقام الناس اللي بتشتري منهم والناس اللي بتشتري منك متسجلة في مكان واحد عشان تعرف ليك إيه وعليك إيه.',
    example: 'مثال: تاجر الخيوط في الموسكي، عملاء الأونلاين والمعارض.',
    actionLabel: 'افتح مورديني',
    actionKey: 'nav_suppliers',
    secondaryLabel: 'افتح عملائي',
    secondaryActionKey: 'nav_customers',
    Icon: Users,
    accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25',
  },
  {
    id: 'step_store_cash',
    badge: 'خطوة ٤',
    title: 'ظبط خزينتك وافتح متجرك',
    line: 'حط رصيد البداية في درج الورشة أو محفظتك، وشغّل متجرك عشان تاخد رابط مباشر تبعته لعملائك على فيسبوك وواتساب.',
    example: 'مثال: درج الكاش، فودافون كاش، إنستاباي، ورابط متجرك.',
    actionLabel: 'افتح الخزائن والفلوس',
    actionKey: 'nav_treasuries',
    secondaryLabel: 'افتح متجري',
    secondaryActionKey: 'open_artisan_store_products',
    Icon: Store,
    accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
];

const ARTISAN_DAILY_STEPS: GuideStep[] = [
  {
    id: 'daily_buy',
    badge: 'شراء خامات',
    title: 'اشتريت خامات النهاردة؟',
    line: 'سجل الفاتورة هنا عشان الكمية تنزل في مخزنك والفلوس تتخصم من الخزينة أوتوماتيك.',
    example: 'زي: خيط، قماش، خشب، خرز، علب تغليف، شنط شحن.',
    actionLabel: 'سجل فاتورة شراء',
    actionKey: 'modal_supplier_invoice',
    secondaryLabel: 'سجل المشتريات',
    secondaryActionKey: 'nav_purchases',
    Icon: PackagePlus,
    accent: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25',
  },
  {
    id: 'daily_expense',
    badge: 'مصاريف الورشة',
    title: 'صرفت مصاريف تشغيل النهاردة؟',
    line: 'أي فلوس خرجت غير شراء الخامات سجلها في المصاريف عشان صافي ربحك يطلع مظبوط بالمليم.',
    example: 'زي: إيجار، كهرباء، نت، شحن، إعلانات ممولة، مواصلات.',
    actionLabel: 'سجل مصروف',
    actionKey: 'modal_admin_costs',
    Icon: DollarSign,
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  {
    id: 'daily_production',
    badge: 'شغل وتصنيع',
    title: 'طلّعت شغل أو منتجات جديدة؟',
    line: 'سجل الشغل اللي شغال عليه أو استلم القطع الجاهزة عشان تدخل مخزن البيع وتخصم خاماتها.',
    example: 'زي: تفصيل 5 شنط، شغل أوردر عميل، استلام قطع جاهزة.',
    actionLabel: 'افتح شغل الورشة',
    actionKey: 'nav_work_orders',
    secondaryLabel: 'المنتجات الجاهزة',
    secondaryActionKey: 'modal_inv_products',
    Icon: Hammer,
    accent: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
  },
  {
    id: 'daily_sales',
    badge: 'مبيعات وتحصيل',
    title: 'بعت قطعة أو قبضت فلوس؟',
    line: 'سجل البيعة أو راجع أوردرات المتجر، وتابع في "هلخصهالك" كسبت كام والفلوس في إيدك كام.',
    example: 'زي: بيعة كاش، تحويل إنستاباي، تحصيل باقي حساب عميل.',
    actionLabel: 'سجل بيعة جديدة',
    actionKey: 'nav_sales',
    secondaryLabel: 'أوردرات المتجر',
    secondaryActionKey: 'open_artisan_store_orders',
    Icon: ShoppingCart,
    accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
];

const SUPPLIER_START_STEPS: GuideStep[] = [
  {
    id: 'sup_start_catalog',
    badge: 'خطوة ١',
    title: 'نزّل أصناف خاماتك وأسعارها',
    line: 'ضيف خاماتك في الكتالوج بأسعار القطاعي والجملة عشان الورش تشوفها وتطلب منك على طول.',
    example: 'مثال: شرائح أسعار للكيلو والشكارة والطرد.',
    actionLabel: 'افتح كتالوج الخامات',
    actionKey: 'sup_catalog',
    secondaryLabel: 'دليل الخامات الموحد',
    secondaryActionKey: 'sup_unified_materials',
    Icon: Boxes,
    accent: 'text-[#EA580C] bg-[#EA580C]/10 border-[#EA580C]/25',
  },
  {
    id: 'sup_start_store',
    badge: 'خطوة ٢',
    title: 'جهّز متجرك ورابط الواتساب',
    line: 'ظبط اسم محلك ورقم الواتساب ورابط المتجر عشان تبعته لكل الورش وتاخد أوردرات منظمة.',
    example: 'مثال: رابط المتجر المباشر، رمز QR للمحل، كوبون خصم.',
    actionLabel: 'إعدادات المتجر',
    actionKey: 'sup_storefront',
    Icon: Store,
    accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
  {
    id: 'sup_start_customers',
    badge: 'خطوة ٣',
    title: 'سجل عملاءك والمصانع',
    line: 'اجمع أرقام الورش والتجار اللي بيتعاملوا معاك عشان تتابع الآجل والتحصيل أول بأول.',
    example: 'مثال: عملاء الورش، تجار الجملة، حسابات المصانع.',
    actionLabel: 'افتح عملائي',
    actionKey: 'sup_customers',
    secondaryLabel: 'المخازن والمصانع',
    secondaryActionKey: 'sup_warehouse_erp',
    Icon: Users,
    accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25',
  },
  {
    id: 'sup_start_cash',
    badge: 'خطوة ٤',
    title: 'ظبط الخزينة والفروع',
    line: 'راجع رصيد البداية في الخزينة والفروع عشان كل بيعة من الكاشير تسمّع في الخزنة لحظياً.',
    example: 'مثال: خزنة المحل، المحفظة، البنك، فروع التوزيع.',
    actionLabel: 'الخزائن والتدفقات',
    actionKey: 'sup_finance',
    secondaryLabel: 'الفروع والـ ERP',
    secondaryActionKey: 'sup_erp_hub',
    Icon: Wallet,
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
];

const SUPPLIER_DAILY_STEPS: GuideStep[] = [
  {
    id: 'sup_daily_pos',
    badge: 'البيع اليومي',
    title: 'جالك عميل في المحل أو تليفون؟',
    line: 'افتح الكاشير وبيع بالوزن أو الكسور أو الطرد، واطبع أو ابعت الفاتورة في ثانية.',
    example: 'زي: كاش، إنستاباي، فودافون كاش، أو آجل على الحساب.',
    actionLabel: 'افتح الكاشير (POS)',
    actionKey: 'sup_pos',
    Icon: ShoppingCart,
    accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
  {
    id: 'sup_daily_orders',
    badge: 'طلبات الورش',
    title: 'تابع أوردرات الورش والأونلاين',
    line: 'أكد الطلبات الجديدة وجهّز الشحن وتابع اللي اتسلم واللي لسه بيتجهز.',
    example: 'زي: طلبات من متجرك أو من سوق موردين الشمساوية.',
    actionLabel: 'افتح أوردراتي',
    actionKey: 'sup_orders',
    Icon: Truck,
    accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25',
  },
  {
    id: 'sup_daily_stock',
    badge: 'المخزن والتوريد',
    title: 'استلمت بضاعة أو فكّيت طرود؟',
    line: 'زوّد رصيد المخزن أو حوّل الطرد لكيلو وتابع كارت الصنف والنواقص.',
    example: 'زي: استلام توريد مصنع، تحويل طرد لـ 25 كيلو.',
    actionLabel: 'افتح المخازن',
    actionKey: 'sup_warehouse_erp',
    secondaryLabel: 'تحديث الكتالوج',
    secondaryActionKey: 'sup_catalog',
    Icon: Boxes,
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  {
    id: 'sup_daily_close',
    badge: 'تقفيل اليوم',
    title: 'قفل يومك وشوف خلاصة الخزينة',
    line: 'سجل مصروفات المحل اليومية وافتح "هلخصهالك" عشان تطمن على الكاش والآجل في نظرة واحدة.',
    example: 'زي: مصاريف شحن، يوميات، كهرباء، وملخص السيولة.',
    actionLabel: 'الخزينة والمصروفات',
    actionKey: 'sup_finance',
    secondaryLabel: 'افتح هلخصهالك',
    secondaryActionKey: 'sup_executive_brief',
    Icon: Wallet,
    accent: 'text-[#EA580C] bg-[#EA580C]/10 border-[#EA580C]/25',
  },
];

interface GuidePageProps {
  audience: 'artisan' | 'supplier';
  onExecuteAction: (actionKey: string) => void;
}

/**
 * صفحة مستقلة بالكامل: «نبدأ ورشتنا» (أو «نبدأ متجرنا» للمورد)
 * بدون نافذة منبثقة وبدون أي ربط داخلي مع صفحة يومك.
 */
export const StartWorkshopGuidePage: React.FC<GuidePageProps> = ({
  audience,
  onExecuteAction,
}) => {
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const isSupplier = audience === 'supplier';
  const title = isSupplier ? 'نبدأ متجرنا' : 'نبدأ ورشتنا';
  const subtitle = isSupplier
    ? '4 خطوات عملية لتجهيز متجر التوريد والكتالوج والخزينة من أول يوم'
    : '4 خطوات سهلة عشان تجهّز ورشتك وتبدأ شغلك صح من غير لخبطة';

  const steps = isSupplier ? SUPPLIER_START_STEPS : ARTISAN_START_STEPS;
  const activeStep = steps[Math.min(activeStepIdx, steps.length - 1)] || steps[0];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5" dir="rtl">
      {/* Page Hero Header */}
      <section className="rounded-3xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#EA580C]/15 text-[#EA580C] dark:text-[#FBBF24] flex items-center justify-center shrink-0">
            <Rocket className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
              {title}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#475569] dark:text-[#94A3B8] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* Step Selector Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {steps.map((step, idx) => {
          const isActive = idx === activeStepIdx;
          const StepIcon = step.Icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStepIdx(idx)}
              className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col gap-2 ${
                isActive
                  ? 'bg-white dark:bg-[#162447] border-[#EA580C] shadow-md ring-1 ring-[#EA580C]/40'
                  : 'bg-white/75 dark:bg-[#101B36] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg ${
                    isActive
                      ? 'bg-[#EA580C] text-white'
                      : 'bg-[#EFE9DC] dark:bg-[#1C2A4A] text-[#475569] dark:text-[#94A3B8]'
                  }`}
                >
                  {step.badge}
                </span>
                <StepIcon
                  className={`w-4 h-4 ${
                    isActive ? 'text-[#EA580C] dark:text-[#FBBF24]' : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                />
              </div>
              <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                {step.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Focused Step Card */}
      <section className="rounded-3xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${activeStep.accent}`}
          >
            <activeStep.Icon className="w-7 h-7" />
          </div>
          <div className="space-y-2 min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#EA580C] dark:text-[#FBBF24]">
              <CheckCircle2 className="w-4 h-4" />
              <span>{activeStep.badge} من ٤</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
              {activeStep.title}
            </h2>
            <p className="text-sm sm:text-base font-semibold text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
              {activeStep.line}
            </p>
            {activeStep.example && (
              <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-[#94A3B8] bg-[#F7F3EA] dark:bg-[#0D162E] px-4 py-3 rounded-2xl border border-[#D4CCBC]/80 dark:border-[#22355E]">
                {activeStep.example}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
          <button
            type="button"
            onClick={() => onExecuteAction(activeStep.actionKey)}
            className="flex-1 min-w-[180px] py-3 px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <span>{activeStep.actionLabel}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>

          {activeStep.secondaryLabel && activeStep.secondaryActionKey && (
            <button
              type="button"
              onClick={() => onExecuteAction(activeStep.secondaryActionKey!)}
              className="py-3 px-5 rounded-xl bg-[#EFE9DC] dark:bg-[#1C2A4A] hover:bg-[#E5DEC9] dark:hover:bg-[#24365E] text-[#0C1427] dark:text-[#F7F3EA] font-black text-sm transition-colors cursor-pointer"
            >
              {activeStep.secondaryLabel}
            </button>
          )}
        </div>

        {/* Step Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={activeStepIdx === 0}
            onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
            className="px-4 py-2 rounded-xl text-xs font-black border border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] disabled:opacity-40 cursor-pointer"
          >
            الخطوة السابقة
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.badge}
                onClick={() => setActiveStepIdx(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === activeStepIdx ? 'w-7 bg-[#EA580C]' : 'w-2 bg-[#D4CCBC] dark:bg-[#22355E]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={activeStepIdx >= steps.length - 1}
            onClick={() => setActiveStepIdx((i) => Math.min(steps.length - 1, i + 1))}
            className="px-4 py-2 rounded-xl text-xs font-black bg-[#0C1427] dark:bg-[#F7F3EA] text-white dark:text-[#0C1427] disabled:opacity-40 cursor-pointer"
          >
            الخطوة الجاية
          </button>
        </div>
      </section>
    </div>
  );
};

/**
 * صفحة مستقلة بالكامل: «يومك في الورشة» (أو «يومك في التوريد» للمورد)
 * بدون نافذة منبثقة وبدون أي ربط داخلي مع صفحة نبدأ ورشتنا.
 */
export const DailyRoutineGuidePage: React.FC<GuidePageProps> = ({
  audience,
  onExecuteAction,
}) => {
  const isSupplier = audience === 'supplier';
  const title = isSupplier ? 'يومك في التوريد' : 'يومك في الورشة';
  const subtitle = isSupplier
    ? 'دليلك اليومي السريع للكاشير وطلبات الورش والمخازن وتقفيل الخزينة'
    : 'اعرف تسجل كل حركة بتحصل معاك في يومك فين بضغطة واحدة';

  const items = isSupplier ? SUPPLIER_DAILY_STEPS : ARTISAN_DAILY_STEPS;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5" dir="rtl">
      {/* Page Hero Header */}
      <section className="rounded-3xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-[#FBBF24] flex items-center justify-center shrink-0">
            <Sun className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA]">
              {title}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#475569] dark:text-[#94A3B8] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* Independent Daily Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const RowIcon = item.Icon;
          return (
            <article
              key={item.id}
              className="rounded-3xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-5 shadow-sm flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${item.accent}`}
                >
                  <RowIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <span className="inline-block text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-[#EFE9DC] dark:bg-[#1C2A4A] text-[#475569] dark:text-[#CBD5E1]">
                    {item.badge}
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    {item.title}
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                    {item.line}
                  </p>
                  {item.example && (
                    <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] bg-[#F7F3EA] dark:bg-[#0D162E] px-3 py-2 rounded-xl border border-[#D4CCBC]/70 dark:border-[#22355E]">
                      {item.example}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                <button
                  type="button"
                  onClick={() => onExecuteAction(item.actionKey)}
                  className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                {item.secondaryLabel && item.secondaryActionKey && (
                  <button
                    type="button"
                    onClick={() => onExecuteAction(item.secondaryActionKey!)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#1C2A4A] hover:bg-[#E5DEC9] dark:hover:bg-[#24365E] text-[#0C1427] dark:text-[#F7F3EA] font-extrabold text-xs whitespace-nowrap cursor-pointer transition-colors"
                  >
                    {item.secondaryLabel}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
