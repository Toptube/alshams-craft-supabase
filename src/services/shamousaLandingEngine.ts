/**
 * محرك «شموسة صفحة الهبوط» التفاعلي الأوفلاين 100%
 * - يرحّب بالزائر من أول دقيقة بأسلوب شيك ومحترم وبخفة الدم المصرية المعهودة لشموسة.
 * - يكتشف دور الزائر (فنان/صاحب ورشة | مورد خامات | عميل | مدرب/خبير) + مستواه (لسه بادئ | شغال | ورشة/متجر كبير).
 * - يفلتر ويُبرز الأجزاء المناسبة له فعلياً داخل صفحة الهبوط + زر «إلغاء الفلتر / عرض الصفحة كاملة» + أزرار انتقال مباشرة.
 * - يجيب على أدق تفاصيل المنظومة بالكلمات المفتاحية ومعالجة الأخطاء الإملائية (Levenshtein/Trigram).
 * - لو السؤال غامض: يعرض أقرب المواضيع كأزرار + «لا مش قصدي ده — أقصد حاجة تانية».
 * - لو السؤال خارج المنظومة: يفتح حواراً ودوداً لجمع مقترح الزائر وإرساله لإشعارات السوبر أدمن!
 * - Lead Magnet أوفلاين لمكتبة المشاكل الفنية: أول 3 نقاط مجاناً + دعوة تسجيل مجاني لفتح الباقي.
 */

import { normalizeArabicKnowledgeText, trigramSimilarity } from './shamousaKnowledgeStore';
import { checkTechnicalProblemLeadMagnetOffline } from './shamousaMarketEngine';

export type LandingVisitorRole = 'artisan' | 'supplier' | 'customer' | 'trainer';
export type LandingVisitorLevel = 'beginner' | 'active' | 'scale';

export interface LandingSectionFilter {
  id: string;
  role?: LandingVisitorRole;
  level?: LandingVisitorLevel;
  labelAr: string;
  scrollToSectionId: string;
  /** معرّفات الأقسام المرئية عند تفعيل الفلتر (تخفي ما عداها ليرى الزائر المفيد له مباشرة) */
  visibleSectionIds: string[];
  recommendedCtaAction: 'register_artisan' | 'register_supplier' | 'open_marketplace' | 'open_suppliers_market' | 'open_login';
  recommendedCtaLabelAr: string;
}

export interface LandingShamousaOption {
  id: string;
  label: string;
  action:
    | 'select_role'
    | 'select_level'
    | 'ask_topic'
    | 'apply_filter'
    | 'clear_filter'
    | 'navigate'
    | 'not_what_i_meant'
    | 'submit_suggestion_prompt';
  payload?: string;
}

export interface LandingShamousaReply {
  text: string;
  options: LandingShamousaOption[];
  filterToApply?: LandingSectionFilter | null;
  clearFilter?: boolean;
  navigateAction?: LandingSectionFilter['recommendedCtaAction'];
  awaitingVisitorSuggestionFor?: string;
  capturedSuggestionText?: string;
  isLeadMagnetLocked?: boolean;
}

export interface LandingVisitorSuggestionRecord {
  id: string;
  originalQuestion: string;
  suggestionText: string;
  visitorRole?: string;
  createdAt: string;
  readByAdmin: boolean;
}

interface LandingKnowledgeTopic {
  id: string;
  titleAr: string;
  keywords: string[];
  answerAr: string;
  scrollToSectionId: string;
  visibleSectionIds: string[];
  ctaAction: LandingSectionFilter['recommendedCtaAction'];
  ctaLabelAr: string;
}

const LANDING_SUGGESTIONS_KEY = 'alshams_landing_visitor_suggestions_v1';

export const LANDING_PLATFORM_TOPICS: LandingKnowledgeTopic[] = [
  {
    id: 'packages_pricing',
    titleAr: 'الباقات والأسعار (المجاني الآن)',
    keywords: ['باقات', 'اسعار', 'اشتراك', 'مجانا', 'مجاني', 'فلوس', 'بكام', 'تسعير المنصه', 'تكلفه الاشتراك'],
    answerAr:
      'النظام عندنا مرن على مقاس شغلك 100% ☀️:\n' +
      '• **الباقة الأساسية مجانية للأبد** — فيها صفحتك الشخصية، معرض أعمالك، مجتمع عيلة الشمساوية، ودليل البداية.\n' +
      '• **وكل الباقات الاحترافية التانية مجانية بالكامل دلوقتي لفترة محدودة (0 ج.م)** بمناسبة الإطلاق: المتجر العالمي، حاسبة التكاليف للـ 55+ ورشة، المخزون والخامات الموحدة، الخزائن والمالية، فريق العمل، والمساعدين (شموسة + صقر).\n' +
      '• وتقدر تفعّل اللي محتاجه بس أو الكل، وتغيّر في أي وقت من «اشتراكاتي» بدون ما تفقد أي بيانات!',
    scrollToSectionId: 'landing-packages',
    visibleSectionIds: ['landing-hero', 'landing-packages', 'landing-faq'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'ابدأ مجاناً وفعّل باقاتك الآن ✨',
  },
  {
    id: 'calculator_workshops',
    titleAr: 'حاسبة التكاليف والـ 55+ ورشة',
    keywords: ['حاسبه', 'تكاليف', 'تسعير', 'ورش', 'معادلات', 'ربح', 'مكرميه', 'ريزن', 'شموع', 'كروشيه', 'جلود', 'خياطه', 'نجاره', 'ليزر'],
    answerAr:
      'الحاسبة عندنا مش آلة حاسبة عادية — دي **منظومة تشغيل لـ 14 قسم وأكتر من 55 ورشة حرفة يدوية** 🔧:\n' +
      '• بتحسب الخامات المباشرة بالجرام/المتر/السنتيمتر، الهالك، المصنعية، التغليف، ومصاريف التشغيل، وتطلّعلك سعر البيع العادل وصافي ربحك الحقيقي.\n' +
      '• فيها كمان **ورشة دمج الحِرف** لو شغلك بيجمع حرفتين (زي ريزن مع خشب أو مكرمية مع خرز).\n' +
      '• مرتبطة بمنظومة **الخامات الموحدة** عشان تحفظ خاماتك مرة واحدة وتستخدمها في كل منتج.',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'جرّب حاسبة ورشتك مجاناً 🧮',
  },
  {
    id: 'storefront_themes',
    titleAr: 'المتجر الخاص والسمات العالمية',
    keywords: ['متجر', 'متجري', 'كتالوج', 'سمات', 'ثيم', 'رابط', 'لينك', 'بيع اونلاين', 'تصميم متجر'],
    answerAr:
      'بتاخد **متجر إلكتروني خاص باسم براندك ورابط مباشر** جاهز للمشاركة على واتساب وإنستجرام وفيسبوك 🛍️:\n' +
      '• فيه أكتر من **10 سمات تصميم عالمية** (قابلة للزيادة تلقائياً) تقدر تبدّل بينهم بضغطة واحدة.\n' +
      '• تتحكم كامل في الخصوصية (تظهر الأسعار أو تخفيها، تفتح الطلب المباشر أو الواتساب، تضيف عروض وخصومات).\n' +
      '• ومنتجاتك تقدر تعرضها كمان في **سوق الشمسية** لعملاء جدد من كل المحافظات.',
    scrollToSectionId: 'landing-markets',
    visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'افتح متجرك الخاص مجاناً 🏪',
  },
  {
    id: 'shamousa_and_falcon',
    titleAr: 'الفرق بين شموسة وصقر',
    keywords: ['شموسه', 'صقر', 'مساعد', 'ذكاء اصطناعي', 'شات', 'فرق', 'تعمل ايه', 'بتعملي ايه'],
    answerAr:
      'أنا **شموسة** ☀️ مديرة أعمالك اليومية جوه المنظومة — شغالة **أوفلاين 100%** على بيانات حسابك بس:\n' +
      '• أجهزلك بوستات المتجر ورسائل الواتساب لـ 35 تخصص حرفة، أشخّص معاك 22 مشكلة فنية، أتابع مواسم البيع في مصر، وأحلّلك أرقامك بـ 3 عقول تحليلية (استراتيجي + فني + تسويقي).\n' +
      '• أما أخويا **صقر** 🦅 فهو المستشار الهندسي والفني بالذكاء الاصطناعي (تحليل صور متقدم ودراسات سوق عميقة).\n' +
      '• والجميل؟ تقدر تفعّلني لوحدي، أو صقر لوحده، أو إحنا الاتنين مع بعض من «اشتراكاتي»!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'سجّل وجرّب شموسة جوه ورشتك ☀️',
  },
  {
    id: 'suppliers_portal',
    titleAr: 'بوابة الموردين وسوق الموردين',
    keywords: ['مورد', 'موردين', 'خامات', 'جمله', 'باركود', 'كاشير', 'محل خامات', 'توريد', 'فروع', 'مخازن'],
    answerAr:
      'للموردين ومحال الخامات عندنا **بوابة متكاملة منفصلة** بمقاس تجارتهم 📦:\n' +
      '• **سوق الموردين:** تعرض خاماتك بشرائح الجملة والقطاعي وباقات المبتدئين (Starter Kits) قدام آلاف الورش.\n' +
      '• **كاشير وباركود ومخازن وفروع:** مبيعات سريعة، جرد، خزائن، وأوردرات جملة B2B.\n' +
      '• **متجر خاص للمورد** بجدول أسعار واضح وتقييمات حقيقية من الورش.',
    scrollToSectionId: 'landing-markets',
    visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-packages'],
    ctaAction: 'register_supplier',
    ctaLabelAr: 'سجّل كمورّد خامات مجاناً 📦',
  },
  {
    id: 'alshams_marketplace_customers',
    titleAr: 'سوق الشمسية للعملاء والهدايا',
    keywords: ['سوق', 'شراء', 'عميل', 'هديه', 'هدايا', 'منتجات يدويه', 'هاندميد', 'اتسوق', 'اشتري'],
    answerAr:
      'في **سوق الشمسية** بتلاقي قطع يدوية أصلية مباشرة من أصحاب الورش والفنانين في مصر 🎁:\n' +
      '• تقدر تسألني جوه السوق بميزانيتك ومناسبتك وهفلترلك الصفحة فوراً!\n' +
      '• عندك **المفضلة (❤️)** لمشاركة اختياراتك على واتساب وفيسبوك، و**المقارنة (⚖️)** المنفصلة عن السلة عشان تقارن بين أكتر من قطعة وتختار بهدوء.',
    scrollToSectionId: 'landing-markets',
    visibleSectionIds: ['landing-hero', 'landing-markets'],
    ctaAction: 'open_marketplace',
    ctaLabelAr: 'ادخل سوق الشمسية الآن 🛍️',
  },
  {
    id: 'offline_security_privacy',
    titleAr: 'العمل أوفلاين والأمان والخصوصية',
    keywords: ['اوفلاين', 'بدون نت', 'انترنت', 'امان', 'خصوصيه', 'بياناتي', 'سحابه', 'مزامنه', 'تطبيق', 'موبايل'],
    answerAr:
      'من أقوى مميزات الشمساوية إن **شغلك ما بيقفش لو النت قطع** 🛡️:\n' +
      '• المنظومة بتشتغل أوفلاين محلياً على جهازك، وبمجرد عودة الإنترنت بتتم **المزامنة السحابية التلقائية** بدون فقدان أي فاتورة أو منتج.\n' +
      '• بيانات حسابك (تكاليفك، عملاءك، أرباحك) معزولة وخاصة بيك 100% ومفيش أي حد تاني يشوفها.\n' +
      '• وتقدر تثبّتها كتطبيق (PWA) على موبايلك أو الكمبيوتر في ثانية.',
    scrollToSectionId: 'landing-faq',
    visibleSectionIds: ['landing-hero', 'landing-faq', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'ابدأ حسابك الآمن مجاناً 🛡️',
  },
  {
    id: 'trainers_experts',
    titleAr: 'المدربين والخبراء والصفحة الشخصية',
    keywords: ['مدرب', 'خبير', 'كورسات', 'تدريب', 'ورش عمل', 'شهادات', 'صفحه شخصيه', 'معرض اعمال'],
    answerAr:
      'لو أنت مدرب أو خبير حرفي 🎓:\n' +
      '• بتاخد **صفحة شخصية احترافية مجانية للأبد** تعرض فيها خبراتك، أعمالك، شهاداتك، ومواعيد تدريباتك.\n' +
      '• تقدر تشارك طلابك أدوات التسعير والخامات الموحدة عشان يبدأوا مشروعهم على أسس صح من أول يوم.',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'أنشئ صفحتك كخبير/مدرب 🎓',
  },
];

export function loadLandingVisitorSuggestions(): LandingVisitorSuggestionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LANDING_SUGGESTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLandingVisitorSuggestionLocal(
  originalQuestion: string,
  suggestionText: string,
  visitorRole?: string
): LandingVisitorSuggestionRecord {
  const rec: LandingVisitorSuggestionRecord = {
    id: `lsug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    originalQuestion: originalQuestion.trim().slice(0, 300),
    suggestionText: suggestionText.trim().slice(0, 600),
    visitorRole,
    createdAt: new Date().toISOString(),
    readByAdmin: false,
  };
  if (typeof window !== 'undefined') {
    try {
      const current = loadLandingVisitorSuggestions();
      const next = [rec, ...current].slice(0, 200);
      localStorage.setItem(LANDING_SUGGESTIONS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('alshams_landing_suggestions_updated', { detail: next }));
    } catch {
      // ignore
    }
  }
  return rec;
}

export function markAllLandingSuggestionsReadLocal(): LandingVisitorSuggestionRecord[] {
  const next = loadLandingVisitorSuggestions().map((s) => ({ ...s, readByAdmin: true }));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LANDING_SUGGESTIONS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('alshams_landing_suggestions_updated', { detail: next }));
    } catch {
      // ignore
    }
  }
  return next;
}

export function buildLandingWelcomeReply(): LandingShamousaReply {
  return {
    text:
      `أهلاً وسهلاً بيك يا فندم في **الشمساوية** ☀️\n` +
      `أنا **شموسة** — مديرة الأعمال الذكية جوه المنظومة (بشتغل معاك أوفلاين من أول ثانية!).\n` +
      `جوه المنظومة بساعد الفنانين والموردين في التسعير، المتاجر، المخزون، والتسويق خطوة بخطوة…\n\n` +
      `قولي الأول عشان أظبّطلك الصفحة على مقاسك: **أنت داخل معانا كإيه النهاردة؟** 👇`,
    options: [
      { id: 'role_artisan', label: '🎨 فنان / صاحب ورشة هاندميد', action: 'select_role', payload: 'artisan' },
      { id: 'role_supplier', label: '📦 مورّد خامات / محل مستلزمات', action: 'select_role', payload: 'supplier' },
      { id: 'role_customer', label: '🎁 عميل بدوّر على هدية أو منتج', action: 'select_role', payload: 'customer' },
      { id: 'role_trainer', label: '🎓 مدرب / خبير حرفي', action: 'select_role', payload: 'trainer' },
    ],
  };
}

export function handleLandingRoleSelected(role: LandingVisitorRole): LandingShamousaReply {
  if (role === 'customer') {
    const filter: LandingSectionFilter = {
      id: 'role_customer_filter',
      role: 'customer',
      labelAr: 'العرض المخصص للعملاء والمتسوقين 🎁',
      scrollToSectionId: 'landing-markets',
      visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-faq'],
      recommendedCtaAction: 'open_marketplace',
      recommendedCtaLabelAr: 'ادخل سوق الشمسية فوراً 🛍️',
    };
    return {
      text:
        `منوّر الدنيا يا فندم! 🎁\n` +
        `فلترتلك صفحة الهبوط دلوقتي عشان يبان قدامك **سوق الشمسية والمنتجات اليدوية المباشرة** من غير أي زحمة إدارية.\n` +
        `وجوه السوق هتلاقيني مستنياك أساعدك بمعالج «هدية سريعة» والمقارنة (⚖️) والمفضلة (❤️)!`,
      filterToApply: filter,
      options: [
        { id: 'go_mkt', label: 'ادخل سوق الشمسية دلوقتي 🛍️', action: 'navigate', payload: 'open_marketplace' },
        { id: 'ask_ship', label: 'إزاي بتشتري وتقارن في السوق؟', action: 'ask_topic', payload: 'alshams_marketplace_customers' },
        { id: 'reset_land', label: 'اعرض الصفحة كلها ☀️', action: 'clear_filter' },
      ],
    };
  }

  const roleLabels: Record<Exclude<LandingVisitorRole, 'customer'>, string> = {
    artisan: 'فنان ومبدع هاندميد 🎨',
    supplier: 'مورّد خامات شريك للورش 📦',
    trainer: 'مدرب وخبير حرفي 🎓',
  };

  return {
    text:
      `يا ألف أهلاً بيك كـ **${roleLabels[role]}** ☀️\n` +
      `عشان أفلترلك الشاشة وأعرضلك أنسب بداية ليك بالظبط — قولي **إنت في أنهي مرحلة دلوقتي؟**`,
    options: [
      { id: 'lvl_beg', label: '🌱 لسه بادئ أو بجهّز مشروعي', action: 'select_level', payload: `${role}|beginner` },
      { id: 'lvl_act', label: '🚀 شغّال وعندي عملاء وطلبات', action: 'select_level', payload: `${role}|active` },
      { id: 'lvl_scl', label: '🏢 ورشة/متجر كبير وفريق وفروع', action: 'select_level', payload: `${role}|scale` },
    ],
  };
}

export function handleLandingLevelSelected(
  role: LandingVisitorRole,
  level: LandingVisitorLevel
): LandingShamousaReply {
  const isSupplier = role === 'supplier';
  const isTrainer = role === 'trainer';

  const levelDesc: Record<LandingVisitorLevel, string> = {
    beginner: isSupplier
      ? 'بداية قوية بمتجر خامات منظم وباقات مبتدئين (Starter Kits) تظهر للورش'
      : 'الباقة الأساسية المجانية للأبد + متجرك الخاص + حاسبة التسعير عشان ما تخسرش في أول أوردر',
    active: isSupplier
      ? 'ربط مخازنك بكاشير باركود + شرائح الجملة + الظهور المباشر في سوق الموردين'
      : 'إدارة أوردراتك ومتجرك + حاسبة التكاليف + المخزون + شموسة لمتابعة المبيعات والمواسم',
    scale: isSupplier
      ? 'إدارة الفروع والمخازن والخزائن المتعددة + طلبات الجملة B2B + تحليلات صقر وشموسة'
      : 'تشغيل ورشة كاملة: أوامر تشغيل + مخزون خامات موحدة + خزائن ومالية + فريق عمل + العقول التحليلية الثلاثة',
  };

  const roleTitle = isSupplier ? 'الموردين' : isTrainer ? 'المدربين والخبراء' : 'الفنانين والورش';
  const lvlTitle = level === 'beginner' ? 'مرحلة البداية' : level === 'active' ? 'مرحلة النمو' : 'الورش والمتاجر الكبيرة';

  const filter: LandingSectionFilter = {
    id: `filter_${role}_${level}`,
    role,
    level,
    labelAr: `مخصص لـ ${roleTitle} (${lvlTitle})`,
    scrollToSectionId: level === 'beginner' ? 'landing-packages' : 'landing-systems',
    visibleSectionIds: isSupplier
      ? ['landing-hero', 'landing-markets', 'landing-packages', 'landing-faq']
      : ['landing-hero', 'landing-systems', 'landing-packages', 'landing-faq'],
    recommendedCtaAction: isSupplier ? 'register_supplier' : 'register_artisan',
    recommendedCtaLabelAr: isSupplier ? 'افتح حساب مورّد مجاناً الآن 📦' : 'افتح حساب ورشتك مجاناً الآن ✨',
  };

  return {
    text:
      `ممتاز جداً! فلترتلك صفحة الهبوط دلوقتي على **الجزء الخاص بـ ${roleTitle} (${lvlTitle})** 👇\n\n` +
      `💡 **أنسب مسار ليك:** ${levelDesc[level]}.\n` +
      `تقدر تشوف التفاصيل المعروضة قدامك دلوقتي، أو تضغط الزرار تحت تبدأ فوراً مجاناً!`,
    filterToApply: filter,
    options: [
      { id: 'cta_now', label: filter.recommendedCtaLabelAr, action: 'navigate', payload: filter.recommendedCtaAction },
      { id: 'ask_pkgs', label: 'تفاصيل الباقات المجانية 👑', action: 'ask_topic', payload: 'packages_pricing' },
      { id: 'clear_all', label: 'اعرض الصفحة كلها ☀️', action: 'clear_filter' },
    ],
  };
}

export function processLandingShamousaMessage(input: {
  rawQuery: string;
  awaitingSuggestionFor?: string | null;
  visitorRole?: LandingVisitorRole;
}): LandingShamousaReply {
  const { rawQuery, awaitingSuggestionFor, visitorRole } = input;
  const trimmed = rawQuery.trim();
  const qNorm = normalizeArabicKnowledgeText(trimmed);

  // 0) لو كنا مستنيين الزائر يكتب مقترحه عشان نبعته للسوبر أدمن
  if (awaitingSuggestionFor && trimmed.length >= 4) {
    if (/^(لا|لأ|خلاص|شكرا|شكراً|مش عايز)$/.test(qNorm)) {
      return {
        text: `ولا يهمك يا فندم ☀️ لو حابب تعرف أي حاجة عن المنظومة أو تفلتر الصفحة حسب تخصصك أنا موجودة!`,
        options: [
          { id: 'back_pkgs', label: 'الباقات والأسعار 👑', action: 'ask_topic', payload: 'packages_pricing' },
          { id: 'back_calc', label: 'الحاسبة والورش 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
          { id: 'back_mkt', label: 'سوق الشمسية 🛍️', action: 'navigate', payload: 'open_marketplace' },
        ],
      };
    }

    return {
      text:
        `تسلم إيدك وأفكارك الجميلة دي! 💡☀️\n` +
        `سجّلت مقترحك (**«${trimmed.slice(0, 120)}»**) وبعته فوراً في **إشعارات إدارة الشمساوية (السوبر أدمن)** عشان يراجعوه ويطوروا بيه المنظومة!\n` +
        `تحب دلوقتي تكتشف اللي جاهز فعلاً في المنظومة؟`,
      capturedSuggestionText: trimmed,
      options: [
        { id: 'after_sug_1', label: 'شوف الباقات المجانية الآن 👑', action: 'ask_topic', payload: 'packages_pricing' },
        { id: 'after_sug_2', label: 'سجّل حسابك مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
        { id: 'after_sug_3', label: 'ادخل سوق الشمسية 🛍️', action: 'navigate', payload: 'open_marketplace' },
      ],
    };
  }

  // 1) إلغاء الفلتر
  if (/^(الغاء الفلتر|عرض الكل|اعرض الصفحه كلها|رجع الصفحه)$/.test(qNorm)) {
    return {
      text: `تمام ☀️ رجّعتلك صفحة الهبوط كاملة بكل أقسامها.`,
      clearFilter: true,
      options: [
        { id: 'w_art', label: 'أنا فنان / ورشة 🎨', action: 'select_role', payload: 'artisan' },
        { id: 'w_sup', label: 'أنا مورّد خامات 📦', action: 'select_role', payload: 'supplier' },
        { id: 'w_cst', label: 'أنا عميل 🎁', action: 'select_role', payload: 'customer' },
      ],
    };
  }

  // 2) Lead Magnet أوفلاين لو زائر صفحة الهبوط سأل عن مشكلة فنية في حرفة!
  const leadMagnet = checkTechnicalProblemLeadMagnetOffline(trimmed, false);
  if (leadMagnet) {
    return {
      text: leadMagnet.text,
      isLeadMagnetLocked: true,
      options: [
        {
          id: 'land_lm_reg',
          label: 'اعرض باقي الحلول + السلامة (تسجيل مجاني) ✨',
          action: 'navigate',
          payload: 'register_artisan',
        },
        { id: 'land_lm_calc', label: 'شوف حاسبة الورش 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
      ],
    };
  }

  // 3) مطابقة المواضيع المعرفية للمنظومة (مع تحمّل الأخطاء الإملائية بـ Trigram)
  const scored = LANDING_PLATFORM_TOPICS.map((t) => {
    let score = 0;
    const titleNorm = normalizeArabicKnowledgeText(t.titleAr);
    if (qNorm.includes(titleNorm)) score += 12;

    for (const kw of t.keywords) {
      const nkw = normalizeArabicKnowledgeText(kw);
      if (qNorm.includes(nkw)) {
        score += nkw.includes(' ') ? 8 : 5;
      } else {
        for (const word of qNorm.split(' ')) {
          if (word.length >= 3 && trigramSimilarity(word, nkw) >= 0.45) {
            score += 3.5;
            break;
          }
        }
      }
    }
    const sim = trigramSimilarity(qNorm, `${t.titleAr} ${t.keywords.slice(0, 5).join(' ')}`);
    if (sim >= 0.25) score += sim * 10;
    return { topic: t, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  // تطابق واثق
  if (top && top.score >= 5) {
    const t = top.topic;
    const filter: LandingSectionFilter = {
      id: `topic_${t.id}`,
      role: visitorRole,
      labelAr: `تركيز الصفحة على: ${t.titleAr}`,
      scrollToSectionId: t.scrollToSectionId,
      visibleSectionIds: t.visibleSectionIds,
      recommendedCtaAction: t.ctaAction,
      recommendedCtaLabelAr: t.ctaLabelAr,
    };
    return {
      text: `${t.answerAr}\n\nفلترتلك الشاشة على القسم ده دلوقتي — وتقدر تلغي الفلتر في أي وقت أو تروح مباشرة للتسجيل:`,
      filterToApply: filter,
      options: [
        { id: `cta_${t.id}`, label: t.ctaLabelAr, action: 'navigate', payload: t.ctaAction },
        { id: `clear_${t.id}`, label: 'عرض الصفحة كاملة', action: 'clear_filter' },
        { id: 'not_meant', label: 'لا مش قصدي ده — أقصد حاجة تانية', action: 'not_what_i_meant', payload: trimmed },
      ],
    };
  }

  // تطابق متوسط -> نعرض أقرب 3 اختيارات + "لا مش قصدي ده"
  const closeCandidates = scored.filter((s) => s.score >= 2.2).slice(0, 3);
  if (closeCandidates.length > 0) {
    return {
      text: `فهمتك جزئياً ☀️ تقصد حاجة من الأقسام القريبة دي في المنظومة؟ اختار اللي تقصده أو قولي «أقصد حاجة تانية»:`,
      options: [
        ...closeCandidates.map((c) => ({
          id: `cl_${c.topic.id}`,
          label: c.topic.titleAr,
          action: 'ask_topic' as const,
          payload: c.topic.id,
        })),
        { id: 'cl_other', label: 'لا مش قصدي ده — أقصد حاجة تانية 💡', action: 'not_what_i_meant', payload: trimmed },
      ],
    };
  }

  // خارج المنظومة -> التقاط المقترح التفاعلي وإرساله للسوبر أدمن!
  return {
    text:
      `سؤال حلو ومختلف الصراحة! ☀️\n` +
      `النقطة دي (**«${trimmed.slice(0, 80)}»**) مش موجودة بالشكل ده جوه المنظومة حالياً…\n` +
      `بس قولي رأيك بصراحة: **لو ضفنا ميزة زي كده في الشمساوية، تحب تكون شغالة إزاي وتفيدك في إيه؟**\n` +
      `اكتبلي مقترحك في رسالة واحدة وهبعته فوراً لإدارة الشمساوية (السوبر أدمن)!`,
    awaitingVisitorSuggestionFor: trimmed,
    options: [
      { id: 'oos_no', label: 'لأ تمام، ورّيني إيه الموجود حالياً', action: 'clear_filter' },
      { id: 'oos_pkgs', label: 'شوف الباقات المتاحة 👑', action: 'ask_topic', payload: 'packages_pricing' },
    ],
  };
}

export function getLandingTopicById(topicId: string): LandingKnowledgeTopic | undefined {
  return LANDING_PLATFORM_TOPICS.find((t) => t.id === topicId);
}
