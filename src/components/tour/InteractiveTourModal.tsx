import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';
import {
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  Calculator,
  Layers,
  ShoppingBag,
  Bell,
  Coins,
  CheckCircle2,
  Share2,
  Compass,
  PlayCircle,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface InteractiveTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToCalculator: () => void;
  profile: UserProfile;
}

export const InteractiveTourModal: React.FC<InteractiveTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateToCalculator,
  profile,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'مرحباً بك في منظومة الشمساوية! 🌞✨',
      subtitle: 'جولة تعريفية سريعة لاكتشاف أدوات ورشتك وإدارة مشغولاتك',
      badge: 'الخطوة الأولى • الترحيب بالمنظومة',
      icon: (
        <div className="w-14 h-14 flex items-center justify-center">
          <img
            src="/alshams_falcon_emblem.png"
            alt="شعار الشمس كرافت"
            className="w-full h-full object-contain filter drop-shadow-md select-none"
          />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            أهلاً بك يا فنان في <strong className="text-amber-700 dark:text-amber-300">منظومة الشمساوية ERP</strong>، المنصة المصممة خصيصاً لورش المكرمية والحِرف اليدوية والفنون لحساب التكاليف بدقة علمية، وإدارة المبيعات والخامات، وتحقيق أرباح عادلة ومحمية.
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 font-bold">
            <p>💡 ما الذي ستقدمه لك هذه الجولة؟</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-600 dark:text-stone-400 font-medium">
              <li>التعرف على شريط العمليات والرجوع للشاشة الرئيسية بضغطة واحدة.</li>
              <li>فهم شبكة البطاقات التشغيلية الـ 11 والملخص المالي والمخزني.</li>
              <li>خطوات بدء تسعير أول قطعة في حاسبة تكاليف المشغولات.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'أيقونة الشاشة الرئيسية وشريط العمليات (Navbar)',
      subtitle: 'تحكم فوري من أعلى الشاشة في أي وقت',
      badge: 'الخطوة الثانية • شريط التنقل',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
          <Compass className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            في أعلى الشاشة، ستجد دائماً شريط العمليات الذكي المصمم لراحتك:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
              <img
                src="/alshams_falcon_emblem.png"
                alt="أيقونة الشاشة الرئيسية"
                className="w-6 h-6 object-contain shrink-0 mt-0.5"
              />
              <div>
                <strong className="text-stone-900 dark:text-stone-100 block">أيقونة منظومة الشمساوية:</strong>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  عند الضغط عليها في أي وقت، تعيدك فوراً للشاشة الرئيسية للمنظومة دون فقدان أي عمل مفتوح.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
              <div className="w-6 h-6 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-stone-900 dark:text-stone-100 block">مركز التنبيهات مع الأصوات التفاعلية:</strong>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  ينبهك بنغمات صوتية واضحة ومميزة بمواعيد تسليم الطلبيات، الخامات التي أوشكت على النفاد، وتذكيرات مبيعات اليوم.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
              <div className="w-6 h-6 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-stone-900 dark:text-stone-100 block">مركز الإنشاء السريع والبحث الموحد:</strong>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  لإضافة خامة، أمر بيع، فاتورة مورد، أو تسجيل عميل فوراً من أي مكان في النظام.
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'بطاقات إدارة الورشة الـ 11 الأساسية',
      subtitle: 'هيكلة عمليات الورشة بلمسة زر واحدة',
      badge: 'الخطوة الثالثة • الشاشة الرئيسية',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
          <Layers className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            تتكون الشاشة الرئيسية من 11 بطاقة واضحة تغطي كافة دورة العمل الحرفي:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { name: 'الخامات', desc: 'إضافة الخامات وحساب الهالك' },
              { name: 'المنتجات', desc: 'الحاسبة والأرشيف والكتالوج' },
              { name: 'الموردين', desc: 'فواتير الشراء وكشف الحساب' },
              { name: 'العملاء', desc: 'سجل العملاء وحساباتهم' },
              { name: 'المبيعات', desc: 'أوامر البيع وفواتير العملاء' },
              { name: 'المخازن', desc: 'كارت الصنف والجرد الدوري' },
              { name: 'الخزن', desc: 'السيولة وتحويل النقدية' },
              { name: 'المصروفات', desc: 'التكاليف الإدارية والتشغيل' },
              { name: 'الموظفين', desc: 'سجلات العمال والرواتب' },
              { name: 'أوامر التشغيل', desc: 'متابعة مراحل الإنتاج' },
              { name: 'التقارير', desc: 'الأرباح وقفل الحسابات' },
            ].map((card, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-right"
              >
                <span className="font-black text-stone-900 dark:text-stone-100 block text-xs">
                  {card.name}
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-0.5">
                  {card.desc}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
            💡 الضغط على أي بطاقة يفتح خيارات سريعة تتيح لك الوصول للعملية المطلوبة بضغطة واحدة.
          </p>
        </div>
      ),
    },
    {
      title: 'ملخص الورشة المالي والمخزني المباشر',
      subtitle: 'أرقامك الحية أمام عينيك في كل لحظة',
      badge: 'الخطوة الرابعة • المؤشرات اللحظية',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
          <Coins className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            أسفل بطاقات الورشة في الشاشة الرئيسية، تجد ويدجت الملخص المالي والمخزني المحدث لحظياً:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-3 rounded-2xl bg-lime-50 dark:bg-stone-800 border border-lime-200 dark:border-stone-700">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">رصيد الخزن</span>
              <strong className="text-lime-700 dark:text-lime-400 text-sm block mt-1">السيولة النقدية الكلية</strong>
              <span className="text-[10px] text-stone-500">إجمالي النقدية المتاحة في الخزن والمحافظ</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-stone-800 border border-amber-200 dark:border-stone-700">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">مبيعات الشهر</span>
              <strong className="text-amber-700 dark:text-amber-400 text-sm block mt-1">إجمالي فواتير البيع</strong>
              <span className="text-[10px] text-stone-500">مجموع المبيعات المسجلة خلال الشهر الحالي</span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-stone-800 border border-rose-200 dark:border-stone-700">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block">تنبيهات المخزون</span>
              <strong className="text-rose-700 dark:text-rose-400 text-sm block mt-1">خامات أوشكت على النفاد</strong>
              <span className="text-[10px] text-stone-500">حماية من توقف العمل بإشعارك عند نقص الخامات</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'كيف تبدأ باستخدام حاسبة تكاليف المنتج؟',
      subtitle: 'سر التسعير العلمي وحماية هامش الربح الحرفي',
      badge: 'الخطوة الخامسة • حاسبة المشغولات',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
          <Calculator className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            حاسبة منظومة الشمساوية تضمن لك عدم إهدار أي سنتيمتر خيط أو دقيقة عمل:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-stone-900 dark:text-stone-100">حدد المقاسات والخيوط:</strong>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  أدخل أطوال وعدد الخيوط المستخدمة ونوع الخامة ليتم حساب الوزن الكلي وتكلفة الهالك المعياري تلقائياً.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-stone-900 dark:text-stone-100">أضف الخامات التكميلية وأجر اليد:</strong>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  أضف الحلقات، الخشب، الكلف، وحدد ساعات العمل لحساب أجر يدك العادل بشكل منفصل ومحمي عن سعر التكلفة.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-mono font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-stone-900 dark:text-stone-100">احصل على سعر القطاعي والجملة فوراً:</strong>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  يحسب لك النظام سعر بيع القطاعي، وسعر الجملة بخصم آمن، ويمكنك إرسال عرض سعر أنيق للعميل عبر واتساب مباشرة بضغطة واحدة!
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'أنت الآن جاهز لبدء رحلة النجاح! 🚀',
      subtitle: 'ورشتك مكتملة ومنظمتك الذكية تحت إمرتك',
      badge: 'الخطوة الأخيرة • الانطلاق',
      icon: (
        <div className="w-14 h-14 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-8 h-8" />
        </div>
      ),
      content: (
        <div className="space-y-4 text-center">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium max-w-sm mx-auto">
            مبارك يا فنان! لقد أصبحت جاهزاً تماماً لإدارة براندك <strong className="text-amber-600 dark:text-amber-400">{profile.brandName || 'ورشة الفنون'}</strong> بأعلى درجات الاحترافية والتنظيم.
          </p>
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 space-y-1">
            <span className="font-black text-amber-700 dark:text-amber-400 block">
              💡 تذكير: يمكنك إعادة تشغيل هذه الجولة في أي وقت
            </span>
            <span className="text-[11px] text-stone-500 block">
              من خلال القائمة الجانبية أو دليل الاستخدام السريع في شريط البحث.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    playButtonClickSound();
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    playButtonClickSound();
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    playSuccessSound();
    try {
      localStorage.setItem('alshams_tour_completed', 'true');
    } catch {}
    onClose();
  };

  const handleGoToCalculator = () => {
    playSuccessSound();
    try {
      localStorage.setItem('alshams_tour_completed', 'true');
    } catch {}
    onClose();
    onNavigateToCalculator();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border-2 border-amber-300/80 dark:border-amber-700/80 text-stone-900 dark:text-stone-100 flex flex-col overflow-hidden text-right relative animate-in zoom-in-95 duration-200">
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header & Progress */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              handleComplete();
            }}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
            title="تخطي الجولة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black border border-amber-300/60 dark:border-amber-800">
              {currentStepData.badge}
            </span>
            <span className="text-[11px] font-mono text-stone-400 font-bold">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="w-full bg-stone-100 dark:bg-stone-800 h-1">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-600 h-1 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="flex items-center gap-3">
            {currentStepData.icon}
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">
                {currentStepData.title}
              </h3>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                {currentStepData.subtitle}
              </p>
            </div>
          </div>

          <div className="pt-1">
            {currentStepData.content}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/70 flex items-center justify-between gap-2">
          {/* Skip / Prev */}
          <div className="flex items-center gap-2">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition flex items-center gap-1 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  handleComplete();
                }}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xs font-bold transition px-2 cursor-pointer"
              >
                تخطي الجولة
              </button>
            )}
          </div>

          {/* Next / Start */}
          <div className="flex items-center gap-2">
            {currentStep === steps.length - 1 ? (
              <>
                <button
                  type="button"
                  onClick={handleComplete}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                >
                  استكشاف الرئيسية
                </button>
                <button
                  type="button"
                  onClick={handleGoToCalculator}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-amber-600/30 cursor-pointer"
                >
                  <Calculator className="w-4 h-4" />
                  <span>بدء استخدام الحاسبة</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
              >
                <span>التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
