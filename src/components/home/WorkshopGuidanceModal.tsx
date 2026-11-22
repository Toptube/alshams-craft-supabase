import React, { useState, useEffect } from 'react';
import {
  X,
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
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export type GuidanceMode = 'start' | 'daily';

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

interface WorkshopGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  audience: 'artisan' | 'supplier';
  initialMode: GuidanceMode;
  onExecuteAction: (actionKey: string) => void;
}

export const WorkshopGuidanceModal: React.FC<WorkshopGuidanceModalProps> = ({
  isOpen,
  onClose,
  audience,
  initialMode,
  onExecuteAction,
}) => {
  const [mode, setMode] = useState<GuidanceMode>(initialMode);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setActiveStepIdx(0);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const isSupplier = audience === 'supplier';
  const startLabel = isSupplier ? 'نبدأ متجرنا' : 'نبدأ ورشتنا';
  const dailyLabel = isSupplier ? 'يومك في التوريد' : 'يومك في الورشة';

  const steps =
    mode === 'start'
      ? isSupplier
        ? SUPPLIER_START_STEPS
        : ARTISAN_START_STEPS
      : isSupplier
        ? SUPPLIER_DAILY_STEPS
        : ARTISAN_DAILY_STEPS;

  const trigger = (actionKey: string) => {
    onClose();
    setTimeout(() => onExecuteAction(actionKey), 40);
  };

  const activeStartStep = steps[Math.min(activeStepIdx, steps.length - 1)] || steps[0];

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[#060B18]/75 backdrop-blur-sm p-3 sm:p-5"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#D4CCBC]/80 dark:border-[#22355E] flex items-center justify-between gap-3 bg-[#EFE9DC]/60 dark:bg-[#132040]/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#EA580C]/15 text-[#EA580C] dark:text-[#FBBF24] flex items-center justify-center shrink-0">
              {mode === 'start' ? <Rocket className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                {mode === 'start' ? startLabel : dailyLabel}
              </h2>
              <p className="text-xs font-bold text-[#475569] dark:text-[#94A3B8] truncate">
                {mode === 'start'
                  ? '4 خطوات سهلة عشان تبدأ شغلك من غير لخبطة'
                  : 'اعرف تسجل كل حركة يومية فين في ثانية'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-white/80 dark:bg-[#1C2A4A] text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#EA580C] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('start');
              setActiveStepIdx(0);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              mode === 'start'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-sm'
                : 'bg-white/70 dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/50'
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span>{startLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('daily');
              setActiveStepIdx(0);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              mode === 'daily'
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-sm'
                : 'bg-white/70 dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/50'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>{dailyLabel}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {mode === 'start' ? (
            <>
              {/* Stepped Tabs */}
              <div className="grid grid-cols-4 gap-2">
                {steps.map((step, idx) => {
                  const isActive = idx === activeStepIdx;
                  const StepIcon = step.Icon;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveStepIdx(idx)}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        isActive
                          ? 'bg-white dark:bg-[#162447] border-[#EA580C] shadow-sm ring-1 ring-[#EA580C]/40'
                          : 'bg-white/50 dark:bg-[#101B36] border-[#D4CCBC]/80 dark:border-[#22355E] hover:border-[#EA580C]/40'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
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
                      <span className="text-[11px] font-extrabold text-[#0C1427] dark:text-[#F7F3EA] line-clamp-1">
                        {step.title.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Step Card */}
              <div className="rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${activeStartStep.accent}`}
                  >
                    <activeStartStep.Icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#EA580C] dark:text-[#FBBF24]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{activeStartStep.badge} من ٤</span>
                    </div>
                    <h3 className="text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {activeStartStep.title}
                    </h3>
                    <p className="text-sm font-semibold text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                      {activeStartStep.line}
                    </p>
                    {activeStartStep.example && (
                      <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] bg-[#F7F3EA] dark:bg-[#0D162E] px-3 py-2 rounded-xl border border-[#D4CCBC]/70 dark:border-[#22355E]">
                        {activeStartStep.example}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E]">
                  <button
                    type="button"
                    onClick={() => trigger(activeStartStep.actionKey)}
                    className="flex-1 min-w-[160px] py-3 px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <span>{activeStartStep.actionLabel}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {activeStartStep.secondaryLabel && activeStartStep.secondaryActionKey && (
                    <button
                      type="button"
                      onClick={() => trigger(activeStartStep.secondaryActionKey!)}
                      className="py-3 px-4 rounded-xl bg-[#EFE9DC] dark:bg-[#1C2A4A] hover:bg-[#E5DEC9] dark:hover:bg-[#24365E] text-[#0C1427] dark:text-[#F7F3EA] font-black text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      {activeStartStep.secondaryLabel}
                    </button>
                  )}
                </div>
              </div>

              {/* Next / Prev Step */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={activeStepIdx === 0}
                  onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
                  className="px-3.5 py-2 rounded-xl text-xs font-black border border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] disabled:opacity-40 cursor-pointer"
                >
                  الخطوة السابقة
                </button>
                <div className="flex items-center gap-1.5">
                  {steps.map((s, i) => (
                    <span
                      key={s.id}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeStepIdx ? 'w-6 bg-[#EA580C]' : 'w-2 bg-[#D4CCBC] dark:bg-[#22355E]'
                      }`}
                    />
                  ))}
                </div>
                {activeStepIdx < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStepIdx((i) => Math.min(steps.length - 1, i + 1))}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-[#0C1427] dark:bg-[#F7F3EA] text-white dark:text-[#0C1427] cursor-pointer"
                  >
                    الخطوة الجاية
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode('daily')}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>شوف {dailyLabel}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {steps.map((item) => {
                const RowIcon = item.Icon;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${item.accent}`}
                      >
                        <RowIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            {item.title}
                          </h3>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#EFE9DC] dark:bg-[#1C2A4A] text-[#475569] dark:text-[#CBD5E1]">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                          {item.line}
                        </p>
                        {item.example && (
                          <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                            {item.example}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-stretch gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => trigger(item.actionKey)}
                        className="px-3.5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      {item.secondaryLabel && item.secondaryActionKey && (
                        <button
                          type="button"
                          onClick={() => trigger(item.secondaryActionKey!)}
                          className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#1C2A4A] hover:bg-[#E5DEC9] dark:hover:bg-[#24365E] text-[#0C1427] dark:text-[#F7F3EA] font-extrabold text-[11px] whitespace-nowrap cursor-pointer transition-colors"
                        >
                          {item.secondaryLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
