import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';
import { AlShamsBrandIcon, FalconMascotFull } from '../brand/BrandAssets';
import {
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  Calculator,
  Layers,
  Bell,
  Coins,
  CheckCircle2,
  Compass,
  Store,
  Users,
  UserCheck,
  Scale,
  Megaphone,
  Star,
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

  const isSupplier = profile?.accountRole === 'supplier';

  const artisanSteps = [
    {
      title: 'أهلاً بيك في منظومة الشمساوية! 🌞✨',
      subtitle: 'جولة سريعة تلمّ لك كل أدوات ورشتك من الخيط لحد الزبون',
      badge: 'الخطوة 1 • الترحيب بالمنظومة',
      icon: (
        <div className="w-14 h-14 flex items-center justify-center select-none">
          <FalconMascotFull
            height={56}
            alt="صقر الشمساوية"
            className="w-full h-full object-contain filter drop-shadow-md select-none"
          />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            أهلاً بك يا فنان في <strong className="text-amber-700 dark:text-amber-300">منظومة الشمساوية ERP</strong>؛ المنظومة المصممة لورش الهاند ميد لحساب التكاليف بالمليم، إدارة الخامات والخزن، متجرك وسوق الشمساوية، سوق الموردين، وصفحتك الشخصية ومجتمع العيلة.
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 font-bold">
            <p>💡 إيه اللي هنعدّي عليه في دقيقة؟</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-600 dark:text-stone-400 font-medium">
              <li>أعلى القائمة الجانبية (صفحتي الشخصية + الرئيسية) وشريط العمليات العلوي.</li>
              <li>بطاقات الورشة الـ 11، الحاسبة الذكية، ومتجرك وسوق الشمساوية.</li>
              <li>سوق الموردين (شرائح الكميات، مقارنة الأسعار، التقييمات، وتنبيهات العروض).</li>
              <li>طبلية عيلة الشمساوية ومعرض أعمالك بـ 6 صور ومصفوفة الظهور.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'أعلى القائمة الجانبية وشريط التنقل والرجوع',
      subtitle: 'كل زرار قدامك عشان تتنقل بلمسة بدون ما تتوه',
      badge: 'الخطوة 2 • التنقل وصفحتك الشخصية',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
          <Compass className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
            <AlShamsBrandIcon size="xs" alt="الرئيسية" className="shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900 dark:text-stone-100 block">أيقونة المنظومة وأزرار الرجوع:</strong>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                في كل شاشة يوجد شريط للرجوع والتراجع والعودة لـ «الرئيسية» فوراً دون فقدان بياناتك.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-stone-100 block">زر «صفحتي الشخصية» أعلى القائمة الجانبية:</strong>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                موجود فوق خالص بجانب «الرئيسية»؛ تدخل منه لكتابة قصتك ورفع أبرز 6 أعمال وضبط مصفوفة الظهور ومعاينة صفحتك.
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-stone-900 dark:text-stone-100 block">مركز الإشعارات والبريد:</strong>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                ينبهك بنواقص الخامات، مواعيد التسليم، رسائل الإدارة، وأحدث تنبيهات وعروض الموردين!
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'بطاقات الورشة الـ 11 والملخص المالي والمخزني',
      subtitle: 'إدارة كاملة للخامات والمصنعية والخزن والتقارير',
      badge: 'الخطوة 3 • لوحة التحكم',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
          <Layers className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { name: 'الخامات', desc: 'أرصدة بمتوسط التكلفة WAC' },
              { name: 'المنتجات', desc: 'الحاسبة والأرشيف والكتالوج' },
              { name: 'الموردين', desc: 'مورديني وسوق الموردين' },
              { name: 'العملاء', desc: 'كشف حساب وواتساب' },
              { name: 'المبيعات', desc: 'فواتير ودفعات ومرتجعات' },
              { name: 'المخازن', desc: 'كارت الصنف والجرد' },
              { name: 'الخزن', desc: 'كاش وإنستاباي ومحافظ' },
              { name: 'المصروفات', desc: 'إدارية وتشغيلية' },
              { name: 'الموظفين', desc: 'الرواتب والسلف' },
              { name: 'أوامر التشغيل', desc: 'التصنيع وحساب الهالك' },
              { name: 'التقارير', desc: 'صافي الربح وقفل الشهر' },
            ].map((card, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700"
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
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            <Coins className="w-4 h-4 shrink-0" />
            <span>أسفل البطاقات يظهر الملخص المالي والمخزني الحي محدثاً لحظياً.</span>
          </div>
        </div>
      ),
    },
    {
      title: 'حاسبة التكاليف + متجرك المستقل + سوق الشمساوية',
      subtitle: 'من التسعير العادل للعرض أمام آلاف العملاء',
      badge: 'الخطوة 4 • التسعير والبيع',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
          <Calculator className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">1. حاسبة التكاليف الذكية:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              تحسب أطوال الخيوط والوزن والهدر وتعزل أجر يدك الصافي عن هامش الربح، مع حفظ المنتج في الأرشيف والكتالوج.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">2. متجرك الخاص + سوق الشمساوية:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              صدّر منتجاتك بضغطة زر (بحد أقصى 3 صور مضغوطة تلقائياً) مع تعدد المقاسات والعملات وأكواد الخصم ورمز QR ومزامنة المخزون عند قبول الطلبات.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'سوق موردين الشمساوية الذكي (B2B للورش)',
      subtitle: 'شرائح الكميات + مقارنة الأسعار + تنبيهات العروض + التقييمات',
      badge: 'الخطوة 5 • توريد الخامات الذكي',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-amber-400 flex items-center justify-center">
          <Scale className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-2.5">
            <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900 dark:text-stone-100 block">شريط تنبيهات العروض والشرائح المتدرجة:</strong>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                شوف عروض الموردين الجديدة، وكل ما تزود كمية طلبك يتخصم السعر تلقائياً حسب شريحة الكمية!
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-start gap-2.5">
            <Scale className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900 dark:text-stone-100 block">تبويب «مقارنة أسعار الموردين» + تقييمات الورش:</strong>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                قارن أسعار نفس الخامة بين كل الموردين في جدول واحد، واقرأ وأضف تقييمك بالنجوم لكل مورد.
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'طبلية عيلة الشمساوية + صفحتي الشخصية (6 أعمال)',
      subtitle: 'تواصل إنساني وتجاري بين الفنانين والموردين',
      badge: 'الخطوة 6 • العيلة والمعرض الشخصي',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">1. منتدى وشات عيلة الشمساوية:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              تجمع الفنانين والموردين؛ وأي منشور أو تعليق أو رسالة شات — بمجرد الضغط على صورة صاحبها تفتح صفحته الشخصية فوراً!
            </p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">2. صفحتي الشخصية (معاينة كاملة من الأسفل):</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              ارفع أحلى 6 أعمال ليك، حدد ما يظهر للفنانين/الموردين/العملاء، ومن شريط المعاينة في أسفل وأعلى الصفحة شاهدها بعين كل فئة.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'صقر وشموسة معاك.. وجاهز للانطلاق! 🚀',
      subtitle: 'أهلاً بيك في عيلة الشمساوية',
      badge: 'الخطوة الأخيرة • الانطلاق',
      icon: (
        <div className="w-14 h-14 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-8 h-8" />
        </div>
      ),
      content: (
        <div className="space-y-3 text-center">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium max-w-sm mx-auto">
            مبارك يا فنان! ورشتك <strong className="text-amber-600 dark:text-amber-400">{profile.brandName || 'ورشة الفنون'}</strong> جاهزة، وشموسة وصقر حافظين كل شاشاتها لمساعدتك في أي ثانية.
          </p>
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 space-y-1">
            <span className="font-black text-amber-700 dark:text-amber-400 block">
              💡 الدليل التفاعلي والجولة متاحان دائماً
            </span>
            <span className="text-[11px] text-stone-500 block">
              تقدر تفتح الدليل أو تعيد الجولة من القائمة الجانبية أو تسأل شموسة العائمة في أي وقت.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const supplierSteps = [
    {
      title: 'أهلاً بك شريكاً في بوابة موردي الشمساوية! 🚚✨',
      subtitle: 'منصتك المستقلة لتوريد خامات الهاند ميد للورش والعملاء باحترافية',
      badge: 'الخطوة 1 • الترحيب بالمورد',
      icon: (
        <div className="w-14 h-14 flex items-center justify-center select-none">
          <FalconMascotFull
            height={56}
            alt="صقر الشمساوية"
            className="w-full h-full object-contain filter drop-shadow-md select-none"
          />
        </div>
      ),
      content: (
        <div className="space-y-3 text-right">
          <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            مرحباً بك في بوابة الموردين لبنك خامات <strong className="text-amber-700 dark:text-amber-300">منظومة الشمساوية</strong>! تقدر تدير كتالوجك بشرائح الكميات، تستقبل طلبات الورش والأونلاين، تتابع خزينتك، وتشارك في طبلية العيلة وصفحتك الشخصية.
          </p>
        </div>
      ),
    },
    {
      title: 'أعلى القائمة الجانبية: الرئيسية + صفحتي الشخصية',
      subtitle: 'واجهة واضحة تضع أهم اختصارين أمامك دائماً',
      badge: 'الخطوة 2 • التنقل السريع',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
          <UserCheck className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">1. زر «صفحتي الشخصية» بأعلى القائمة:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              اعرض نبذة مصنعك أو متجرك، ارفع حتى 6 صور لأبرز خاماتك/توريداتك المميزة، وحدد مصفوفة الظهور (للفنانين · للموردين · للعملاء) مع معاينة أسفل وأعلى الصفحة.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">2. أزرار الرجوع والتراجع في كل شاشة:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              تضمن لك سهولة التنقل والعودة للوحة تحكم المورد الرئيسية بلمسة.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'كتالوج الخامات + شرائح الكميات + تنبيهات العروض',
      subtitle: 'سعّر بذكاء وخلي الورش تشتري بالكمية',
      badge: 'الخطوة 3 • الكتالوج والشرائح',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
          <Megaphone className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">1. ضغط تلقائي لحتى 3 صور + شرائح الكميات المتدرجة:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              أضف كل خامة بـ 3 صور مضغوطة تلقائياً، وأنشئ شرائح خصم للكميات (مثلاً: من 10 وحدات سعر خاص، ومن 25 سعر أكبر) وتسمّع تلقائياً في السلة والفاتورة!
            </p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">2. بث «تنبيه عروض / وصول جديد للورش»:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              أرسل إشعاراً فورياً يظهر في شريط سوق الموردين وفي جرس إشعارات كل الورش بمجرد وصول دفعة خامات جديدة أو خصم.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'سوق موردين الشمساوية، جدول المقارنة، والتقييمات',
      subtitle: 'شفافية تبرز جودة خاماتك وتنافسية أسعارك',
      badge: 'الخطوة 4 • الظهور في السوق العام',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-amber-400 flex items-center justify-center">
          <Star className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">1. مقارنة الأسعار وتقييمات الورش:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              تظهر أصنافك للورش داخل سوق الموردين وجدول مقارنة الأسعار مع متوسط نجوم تقييمات الورش لتعزيز الثقة بعلامتك التجارية.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">2. متجرك العام المستقل ورمز QR:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              رابط مباشر باسم متجرك وباركود QR لمشاركته مع عملائك على فيسبوك وواتساب.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'الأوردرات والعملاء والخزينة + طبلية العيلة',
      subtitle: 'إدارة مالية كاملة وشراكة حقيقية مع الفنانين',
      badge: 'الخطوة 5 • العمليات والعيلة',
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
          <Store className="w-6 h-6" />
        </div>
      ),
      content: (
        <div className="space-y-2.5 text-right text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">1. توحيد الأوردرات والخزينة:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              أوردرات الورش B2B وطلبات متجرك والطلبات الخارجية تسجل تلقائياً في شاشة «أوردراتي»، «عملائي»، و«خزائن المورد والمصروفات».
            </p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
            <strong className="text-stone-900 dark:text-stone-100 block">2. المشاركة في عيلة الشمساوية + شموسة AI:</strong>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              انشر في المنتدى وشارك في الشات العائلي لتتواصل مباشرة مع الورش، واستشر شموسة العائمة في أي لحظة!
            </p>
          </div>
        </div>
      ),
    },
  ];

  const steps = isSupplier ? supplierSteps : artisanSteps;
  const safeIndex = Math.min(currentStep, steps.length - 1);
  const currentStepData = steps[safeIndex];

  const handleNext = () => {
    playButtonClickSound();
    if (safeIndex < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    playButtonClickSound();
    if (safeIndex > 0) {
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

  const handleGoToPrimaryAction = () => {
    playSuccessSound();
    try {
      localStorage.setItem('alshams_tour_completed', 'true');
    } catch {}
    onClose();
    if (isSupplier) {
      window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view: 'supplier_catalog' } }));
    } else {
      onNavigateToCalculator();
    }
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
            <span className="text-[11px] font-mono tabular-nums text-stone-400 font-bold">
              {safeIndex + 1} / {steps.length}
            </span>
          </div>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="w-full bg-stone-100 dark:bg-stone-800 h-1">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-600 h-1 transition-all duration-300"
            style={{ width: `${((safeIndex + 1) / steps.length) * 100}%` }}
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
            {safeIndex > 0 ? (
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
            {safeIndex === steps.length - 1 ? (
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
                  onClick={handleGoToPrimaryAction}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-amber-600/30 cursor-pointer"
                >
                  {isSupplier ? <Store className="w-4 h-4" /> : <Calculator className="w-4 h-4" />}
                  <span>{isSupplier ? 'فتح كتالوج الخامات' : 'بدء استخدام الحاسبة'}</span>
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
