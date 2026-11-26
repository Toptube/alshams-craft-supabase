/**
 * محرك «شموسة صفحة الهبوط» التفاعلي الأوفلاين 100% — الموسوعة الذكية الكاملة لمنظومة الشمساوية
 *
 * المبادئ الحاكمة:
 * 1. شاملة لكل كبيرة وصغيرة في منظومة الشمساوية (18 محوراً معرفياً + 35 تخصص حرفة + 14 أسلوب تسويق + 22 مشكلة فنية).
 * 2. فهم دلالي عميق للغة العربية والعامية المصرية + جذور الكلمات (Stemmer) + تحمّل الأخطاء الإملائية (Levenshtein + Trigram) + ربط أكثر من موضوع في نفس السؤال!
 * 3. صدق تام 100% (صفر اختراع أو هلوسة): لو السؤال فعلاً خارج المنظومة (مثلاً: جبنة/طيران/فنادق) بتعترف بأسلوبها المصري اللطيف، وتقترح إرسال مقترح تطوير للسوبر أدمن.
 * 4. فلترة حقيقية لأقسام صفحة الهبوط + زر «إلغاء الفلتر / عرض الصفحة كاملة» + دعوة «سجّل دلوقتي مجاناً» سياقية.
 * 5. أوفلاين 100% (صفر استهلاك كوتا AI من الزوار).
 */

import { normalizeArabicKnowledgeText, trigramSimilarity } from './shamousaKnowledgeStore';
import { checkTechnicalProblemLeadMagnetOffline } from './shamousaMarketEngine';
import { loadLoyaltyConfig } from './loyaltyWalletsService';
import { HANDMADE_MARKETING_LIBRARY } from '../data/shamousaMarketingLibrary';
import { SHAMOUSA_MARKETING_METHODS_LIBRARY } from '../data/shamousaMarketingMethodsLibrary';
import {
  searchAllCraftsRegistryOffline,
  searchChangelogAndSystemFeaturesOffline,
  searchUserGuideAndGlossaryOffline,
  tryHandleShamousaPersonality,
} from './shamousaSharedCore';

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
  /** كلمات دلالية أساسية وعبارات عامية ومرادفات */
  keywords: string[];
  /** جذور أو مقاطع عالية الدقة (تُطابق بعد التجذير العربي) */
  stems: string[];
  answerAr: string;
  scrollToSectionId: string;
  visibleSectionIds: string[];
  ctaAction: LandingSectionFilter['recommendedCtaAction'];
  ctaLabelAr: string;
}

const LANDING_SUGGESTIONS_KEY = 'alshams_landing_visitor_suggestions_v1';

// ============================================================================
// أدوات الفهم اللغوي العربي (تجذير + مسافة ليفنشتاين + إزالة كلمات التوقف)
// ============================================================================

const ARABIC_STOP_WORDS = new Set([
  'هل', 'في', 'فى', 'من', 'على', 'عن', 'الى', 'إلى', 'ان', 'أن', 'انت', 'انتي', 'انتم', 'انتو',
  'عندكم', 'عندك', 'عندكو', 'موجود', 'فيه', 'فيها', 'هو', 'هي', 'هم', 'احنا', 'نحن', 'انا',
  'عايز', 'عاوزه', 'عاوز', 'ممكن', 'لو', 'سمحت', 'طب', 'طيب', 'يعني', 'ازاي', 'إزاي', 'ايه', 'إيه',
  'تقدر', 'تقدري', 'تقدروا', 'اعمل', 'اعرف', 'سمعت', 'قولي', 'قوليلي', 'اشرح', 'اشرحيلي', 'ساعدني',
  'ساعديني', 'تساعدني', 'تساعديني', 'تساعد', 'بالنسبه', 'جدا', 'جداً', 'قوي', 'اوي', 'بس', 'كده',
  'ده', 'دي', 'دول', 'مع', 'بعد', 'قبل', 'كل', 'اي', 'أي', 'حاجة', 'حاجه', 'شيء', 'شئ', 'عشان', 'علشان',
]);

export function stemArabicToken(rawToken: string): string {
  let w = normalizeArabicKnowledgeText(rawToken).replace(/[^ء-ي0-9a-z]/g, '');
  if (w.length <= 3) return w;

  // إزالة السوابق الشائعة (وال، بال، كال، فال، لل، ال)
  const prefixes = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
  for (const p of prefixes) {
    if (w.startsWith(p) && w.length - p.length >= 3) {
      w = w.slice(p.length);
      break;
    }
  }
  // إزالة واو/باء/فاء/لام العطف والجر لو الكلمة طويلة
  if (w.length >= 5 && /^[وبفل]/.test(w)) {
    const candidate = w.slice(1);
    if (candidate.length >= 4) w = candidate;
  }

  // إزالة اللواحق (ات، ون، ين، كم، هم، ها، نا، ني، يه، ية، ه، ي، ك)
  const suffixes = ['ات', 'ون', 'ين', 'كم', 'هم', 'ها', 'نا', 'ني', 'يه', 'ية'];
  for (const s of suffixes) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  if (w.length >= 5 && /[هيك]$/.test(w)) {
    w = w.slice(0, -1);
  }
  return w;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 4;

  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[b.length];
}

function isFuzzyTokenMatch(queryTok: string, targetTok: string): number {
  if (!queryTok || !targetTok) return 0;
  if (queryTok === targetTok) return 10;

  const qStem = stemArabicToken(queryTok);
  const tStem = stemArabicToken(targetTok);
  if (qStem.length >= 3 && tStem.length >= 3) {
    if (qStem === tStem) return 9;
    if (qStem.length >= 4 && tStem.length >= 4 && (qStem.includes(tStem) || tStem.includes(qStem))) {
      return 7.5;
    }
  }

  // مطابقة الأخطاء الإملائية بـ Levenshtein
  const minLen = Math.min(qStem.length, tStem.length);
  if (minLen >= 4) {
    const dist = levenshteinDistance(qStem, tStem);
    if (dist === 1) return 6.5;
    if (dist === 2 && minLen >= 6) return 5;
  }

  // مطابقة Trigram للكلمات الأطول
  if (minLen >= 4) {
    const tri = trigramSimilarity(qStem, tStem);
    if (tri >= 0.58) return 5.5;
  }

  return 0;
}

// ============================================================================
// الموسوعة الكاملة لمنظومة الشمساوية (18 محوراً يغطي كل كبيرة وصغيرة في المنصة)
// ============================================================================

export const LANDING_PLATFORM_TOPICS: LandingKnowledgeTopic[] = [
  {
    id: 'calculator_workshops',
    titleAr: 'حاسبة التكاليف والتسعير والـ 55+ ورشة',
    keywords: [
      'تكاليف', 'التكاليف', 'تكلفة', 'حساب التكاليف', 'حاسبة', 'حاسبه', 'تسعير', 'سعر البيع',
      'هامش ربح', 'ربح', 'مكسب', 'هالك', 'مصنعية', 'تغليف', 'ورش', 'حرف', 'معادلات', 'دمج الحرف',
      'احسب', 'بحسب', 'اسعر', 'أسعّر', 'خسارة', 'سعر القطعة',
    ],
    stems: ['تكاليف', 'تكلف', 'حاسب', 'تسعير', 'معادل', 'هامش', 'مصنع', 'تغليف', 'هالك', 'دمج'],
    answerAr:
      'أكيد طبعاً! **حاسبة التكاليف والتسعير** هي قلب منظومة الشمساوية ومصمّمة لأكتر من **55 ورشة حرفة يدوية في 14 قسم** 🧮:\n' +
      '• بتحسب **الخامات المباشرة** بدقة (بالجرام، المتر، السنتيمتر، القطعة) + **نسبة الهالك** + **المصنعية ووقت شغلك** + **التغليف** + **مصاريف التشغيل**.\n' +
      '• بتطلّعلك فوراً **التكلفة الحقيقية، سعر البيع العادل، سعر الجملة، وصافي ربحك الصافي** عشان ما تخسرش في أي أوردر.\n' +
      '• فيها كمان **ورشة دمج الحِرف** لو منتجك بيجمع حرفتين مع بعض (زي ريزن مع خشب أو مكرمية مع خرز)، وكلها مربوطة بـ **منظومة الخامات الموحدة**!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'جرّب حاسبة التكاليف مجاناً 🧮',
  },
  {
    id: 'marketing_content_library',
    titleAr: 'التسويق والمحتوى وخطط البيع والمواسم',
    keywords: [
      'تسويق', 'التسويق', 'اسوق', 'أسوّق', 'مسوق', 'بوست', 'بوستات', 'محتوى', 'إعلان', 'اعلانات',
      'سوشيال', 'فيسبوك', 'انستجرام', 'تيك توك', 'ريلز', 'واتساب', 'مواسم', 'مبيعات', 'ازاي ابيع',
      'إزاي أبيع', 'جذب عملاء', 'عملاء جدد', 'خطة تسويق', 'مكتبة تسويقية', 'كابشن', 'تصوير',
    ],
    stems: ['تسويق', 'مسوق', 'بوست', 'محتو', 'اعلان', 'سوشيال', 'ريلز', 'مواسم', 'مبيع', 'كابشن'],
    answerAr:
      'أكيد يا فندم! **التسويق الذكي وزيادة المبيعات** جزء أساسي جوه الشمساوية وبشتغل فيه معاك أوفلاين 100% 📣:\n' +
      '• عندي **مكتبة تسويقية كاملة لـ 35 تخصص حرفة يدوية** + **14 أسلوب تسويق عملي** (ريلز، قصص عملاء، عروض باقات، تسويق واتساب، تسعير نفسي، وغيرها).\n' +
      '• بكتبلك **بوستات فيسبوك وإنستجرام وتيك توك ورسائل واتساب احترافية** على مقاس منتجاتك الحقيقية وأسعارك.\n' +
      '• بتابع معاك **مواسم البيع في مصر** (رمضان، العيد، عيد الأم، المدارس، الشتاء، الفلانتين، تجهيز العرايس) وبنبهك تجهّز عروضك قبلها بوقت كافي.\n' +
      '• وعندك **العقل التسويقي التحليلي** اللي بيراجع منتجاتك ويقولك أنهي منتج يمشي أسرع وإزاي تعمّل باقات هدايا ترفع متوسط الفاتورة!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'سجّل وابدأ تسويق منتجاتك مع شموسة 📣',
  },
  {
    id: 'markets_ecosystem',
    titleAr: 'الأسواق (سوق الشمساوية + سوق الموردين + المتاجر الخاصة)',
    keywords: [
      'اسواق', 'الاسواق', 'أسواق', 'الأسواق', 'سوق', 'السوق', 'سوق الشمساوية', 'سوق الشمسية',
      'سوق الموردين', 'شراء', 'اتسوق', 'أتسوق', 'اشتري', 'أشتري', 'معروضات', 'منتجات يدوية',
      'هاندميد', 'هدايا', 'هدية', 'مقارنة', 'مفضلة', 'ماركت', 'عميل',
    ],
    stems: ['اسواق', 'سوق', 'تسوق', 'معروض', 'هاندميد', 'هداي', 'مقارن', 'مفضل', 'ماركت'],
    answerAr:
      'أيوه طبعاً! عندنا **منظومة أسواق متكاملة** بتخدم العميل والفنان والمورّد في نفس الوقت 🛍️:\n' +
      '1. **سوق الشمساوية:** سوق إلكتروني عام للعملاء والهدايا اليدوية الأصلية مباشرة من أصحاب الورش في كل مصر — فيه **شموسة أوفلاين** تفلترلك الهدايا بميزانيتك، ومعالج **«هدية سريعة 🎁»**، و**المفضلة (❤️)**، و**المقارنة (⚖️)** المنفصلة عن السلة!\n' +
      '2. **سوق الموردين:** سوق مخصص للخامات والمستلزمات بشرائح الجملة والقطاعي وباقات المبتدئين (Starter Kits) مع مقارنة الخامات وطلب عرض سعر (RFQ) للموردين.\n' +
      '3. **المتاجر الخاصة:** كل ورشة وكل مورّد ليه متجره الخاص المستقل برابط مباشر باسم برانده!',
    scrollToSectionId: 'landing-markets',
    visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-packages'],
    ctaAction: 'open_marketplace',
    ctaLabelAr: 'ادخل سوق الشمساوية دلوقتي 🛍️',
  },
  {
    id: 'storefront_themes',
    titleAr: 'المتجر الخاص والسمات العالمية (10+ سمات)',
    keywords: [
      'متجر', 'متجري', 'المتجر', 'متاجر', 'كتالوج', 'سمات', 'ثيم', 'ثيمات', 'رابط', 'لينك',
      'بيع اونلاين', 'تصميم متجر', 'واجهة متجر', 'براند', 'عرض منتجاتي', 'خصوصية الأسعار',
    ],
    stems: ['متجر', 'متاجر', 'كتالوج', 'سمات', 'ثيم', 'لينك', 'رابط', 'براند'],
    answerAr:
      'بتاخد **متجر إلكتروني خاص باسم براندك ورابط مباشر** تشاركه على واتساب وإنستجرام وفيسبوك وتيك توك 🏪:\n' +
      '• فيه أكتر من **10 سمات تصميم عالمية** (قابلة للزيادة تلقائياً) بتبدّل بينهم بضغطة زر واحدة.\n' +
      '• تحكم كامل في الخصوصية: تظهر الأسعار أو تخفيها، تفتح الطلب المباشر أو الواتساب فقط، تضيف كوبونات وعروض باقات.\n' +
      '• وجوه متجرك الخاص بكون موجودة أنا (**شموسة**) أساعد زوارك يفلتروا منتجاتك ويختاروا هداياهم مع احترام كامل لإعداداتك!',
    scrollToSectionId: 'landing-markets',
    visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'افتح متجرك الخاص مجاناً 🏪',
  },
  {
    id: 'inventory_unified_materials',
    titleAr: 'المخزون ومنظومة الخامات الموحدة',
    keywords: [
      'مخزون', 'المخزون', 'مخازن', 'جرد', 'خامات', 'الخامات', 'خامات موحدة', 'خامه', 'خامة',
      'مستلزمات', 'نواقص', 'نقص الخامات', 'سحب خامات', 'مستودع', 'كميات',
    ],
    stems: ['مخزون', 'مخازن', 'جرد', 'خام', 'مستلزم', 'نواقص', 'مستودع'],
    answerAr:
      'عندنا نظام **مخزون ذكي ومنظومة خامات موحدة** لكل الحِرف 📦:\n' +
      '• بتسجّل خاماتك مرة واحدة بوحداتها وأسعارها، وبتُستخدم تلقائياً في حاسبة التكاليف وأوامر التشغيل.\n' +
      '• **جرد تلقائي وتنبيهات ذكية:** أول ما خامة تقرّب تخلص، المنظومة بتنبهك فوراً قبل ما تتأخر على عميل.\n' +
      '• وكمان تقدر تتابع **موردينك المفضلين** وتطلب منهم خاماتك مباشرة من سوق الموردين!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'نظّم مخزون وخامات ورشتك مجاناً 📦',
  },
  {
    id: 'finance_treasuries_invoices',
    titleAr: 'الخزائن والمالية والفواتير وصافي الربح',
    keywords: [
      'خزينة', 'خزائن', 'الخزائن', 'مالية', 'المالية', 'حسابات', 'محاسبة', 'فواتير', 'فاتورة',
      'مصروفات', 'مصاريف', 'إيرادات', 'ايرادات', 'ارباح', 'أرباح', 'كاش', 'إنستاباي', 'انستاباي',
      'فودافون كاش', 'عربون', 'دفعة', 'تقارير مالية', 'جرد مالي',
    ],
    stems: ['خزين', 'خزائن', 'مال', 'محاسب', 'فاتور', 'فواتير', 'مصروف', 'مصاريف', 'ايراد', 'ارباح', 'عربون'],
    answerAr:
      'عندنا **منظومة مالية وخزائن متكاملة** بمقاس الورش والموردين 💰:\n' +
      '• **خزائن متعددة:** تفصل بين الكاش، فودافون كاش، إنستاباي، والبنك وتتابع رصيد كل خزينة لحظة بلحظة.\n' +
      '• **فواتير احترافية** تلقائية للعملاء (مع قاعدة جدية التصنيع 33% والباقي عند التسليم) وتتبع للمصروفات والإيرادات.\n' +
      '• **تقارير صافي الربح الحقيقي** عشان تعرف في آخر الشهر كسبت كام بالظبط ومين أكتر منتج بيكسبك!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'ابدأ متابعة خزائنك وأرباحك مجاناً 💰',
  },
  {
    id: 'orders_production_workflow',
    titleAr: 'إدارة الطلبات وأوامر التشغيل والإنتاج',
    keywords: [
      'طلبات', 'الطلبات', 'اوردر', 'أوردر', 'اوردرات', 'أوردرات', 'تشغيل', 'أوامر تشغيل',
      'انتاج', 'إنتاج', 'تصنيع', 'مواعيد', 'تسليم', 'أجندة', 'اجنده', 'مهام', 'متابعة',
    ],
    stems: ['طلب', 'اوردر', 'تشغيل', 'انتاج', 'تصنيع', 'مواعيد', 'تسليم', 'اجند', 'مهام'],
    answerAr:
      'إدارة الطلبات وأوامر التشغيل عندنا بتخلّيك تشتغل بهدوء ومن غير نسيان أي تفصيلة 📋:\n' +
      '• كل طلب بيتحول لـ **أمر تشغيل منظم** فيه المقاس واللون والملاحظات وميعاد التسليم وحالة التنفيذ.\n' +
      '• **أجندة ومهام شموسة:** بتفكّرك يومياً بالأوردرات اللي قرب ميعاد تسليمها وتقدر تحمّل مواعيدك على تقويم موبايلك.\n' +
      '• ربط مباشر مع المخزون والفواتير عشان كل أوردر يتخصم من خاماته ويتقفل في خزينتك بضغطة زر!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'نظّم أوردرات ورشتك دلوقتي 📋',
  },
  {
    id: 'suppliers_pos_portal',
    titleAr: 'بوابة الموردين والكاشير والباركود والفروع',
    keywords: [
      'مورد', 'موردين', 'الموردين', 'محل خامات', 'توريد', 'جملة', 'جمله', 'شرائح',
      'باركود', 'كاشير', 'نقطة بيع', 'فروع', 'فرع', 'pos', 'مبيعات محل', 'ستارتر كيت',
    ],
    stems: ['مورد', 'توريد', 'جمل', 'شرائح', 'باركود', 'كاشير', 'فروع', 'فرع'],
    answerAr:
      'للموردين ومحال الخامات عندنا **بوابة متكاملة منفصلة** بمقاس تجارتهم 📦:\n' +
      '• **كاشير وباركود (POS):** بيع سريع داخل المحل، طباعة فواتير، وجرد فوري للمخازن والفروع.\n' +
      '• **سوق الموردين ومتجر خاص:** عرض الخامات بشرائح الجملة والقطاعي وباقات المبتدئين (Starter Kits) قدام آلاف الورش مع استقبال طلبات عروض أسعار (B2B RFQ).\n' +
      '• **ربط تلقائي بالورش:** أي ورشة تسجّل بكود دعوتك كمورّد بتتضاف لكتالوجك تلقائياً في «مورديني المفضلين»!',
    scrollToSectionId: 'landing-markets',
    visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-packages'],
    ctaAction: 'register_supplier',
    ctaLabelAr: 'سجّل كمورّد خامات مجاناً 📦',
  },
  {
    id: 'shamousa_and_falcon',
    titleAr: 'شموسة وصقر والعقول التحليلية الثلاثة',
    keywords: [
      'شموسة', 'شموسه', 'صقر', 'مساعد', 'مساعدين', 'ذكاء اصطناعي', 'شات', 'شات بوت',
      'فرق', 'بتعملي ايه', 'تعملي ايه', 'العقول التحليلية', 'رادار', 'تحليل صور', 'دراسة سوق',
    ],
    stems: ['شموس', 'صقر', 'مساعد', 'ذكاء', 'شات', 'عقول', 'تحليل', 'رادار'],
    answerAr:
      'أنا **شموسة** ☀️ مديرة أعمالك اليومية جوه المنظومة — شغالة **أوفلاين 100%** على بيانات حسابك بس:\n' +
      '• أجهزلك بوستات المتجر ورسائل الواتساب لـ 35 تخصص حرفة، أشخّص معاك 22 مشكلة فنية، أتابع مواسم البيع في مصر، وأحلّلك أرقامك بـ **3 عقول تحليلية** (استراتيجي + فني + تسويقي)!\n' +
      '• أما أخويا **صقر** 🦅 فهو المستشار الهندسي والفني بالذكاء الاصطناعي (تحليل صور متقدم ودراسات سوق عميقة).\n' +
      '• والجميل؟ تقدر تفعّلني لوحدي، أو صقر لوحده، أو إحنا الاتنين مع بعض من «اشتراكاتي»!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'سجّل وجرّب شموسة جوه ورشتك ☀️',
  },
  {
    id: 'technical_problems_safety',
    titleAr: 'مكتبة المشاكل الفنية وحلول العيوب والسلامة',
    keywords: [
      'مشكلة فنية', 'مشاكل فنية', 'عيب', 'عيوب', 'سلامة', 'تحذيرات', 'تشخيص',
      'باظ', 'باظت', 'تشقق', 'فقاعات', 'اصفرار', 'تقطيع', 'خامات بديلة',
    ],
    stems: ['مشكل', 'عيوب', 'سلام', 'تحذير', 'تشخيص', 'تشقق', 'فقاع', 'اصفرار'],
    answerAr:
      'عندي **مكتبة متخصصة فيها 22 مشكلة فنية وحلولها العملية أوفلاين 100%** 🔧:\n' +
      '• بتشخّص عيوب الريزن، الشموع، المكرمية، الصابون، الخزف، الجلود، الليزر، الكونكريت، وغيرها، وتديك **الأسباب + خطوات الحل + البدائل الموحدة + تحذيرات السلامة المهنية**.\n' +
      '• جرّب تكتبلي أي مشكلة فنية بتواجهك في شغلك دلوقتي وهجاوبك بالحل الكامل فوراً هنا!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'سجّل ورشتك واستفد بكل المكتبات 🔧',
  },
  {
    id: 'packages_pricing',
    titleAr: 'الباقات والأسعار (المجاني الآن)',
    keywords: [
      'باقات', 'الباقات', 'باقة', 'اسعار', 'أسعار', 'اشتراك', 'اشتراكات', 'مجانا', 'مجاناً',
      'مجاني', 'فلوس', 'بكام', 'بكم', 'تسعير المنصة', 'تكلفة الاشتراك', 'كام الاشتراك', 'مدفوع',
    ],
    stems: ['باق', 'اسعار', 'اشتراك', 'مجان', 'فلوس', 'مدفوع'],
    answerAr:
      'النظام عندنا مرن على مقاس شغلك 100% 👑:\n' +
      '• **الباقة الأساسية مجانية للأبد** — فيها صفحتك الشخصية، معرض أعمالك، مجتمع عيلة الشمساوية، ودليل البداية.\n' +
      '• **وكل الباقات الاحترافية التانية مجانية بالكامل دلوقتي لفترة محدودة (0 ج.م)** بمناسبة الإطلاق: المتجر العالمي، حاسبة التكاليف للـ 55+ ورشة، المخزون والخامات الموحدة، الخزائن والمالية، فريق العمل، والمساعدين (شموسة + صقر).\n' +
      '• وتقدر تفعّل اللي محتاجه بس أو الكل، وتبدّل في أي وقت من «اشتراكاتي» بدون ما تفقد أي بيانات!',
    scrollToSectionId: 'landing-packages',
    visibleSectionIds: ['landing-hero', 'landing-packages', 'landing-faq'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'ابدأ مجاناً وفعّل باقاتك الآن ✨',
  },
  {
    id: 'loyalty_wallets_offers',
    titleAr: 'النقاط والمحافظ المنفصلة والعروض التحفيزية',
    keywords: [
      'نقاط', 'النقاط', 'نقطة', 'محفظة', 'محفظه', 'محافظ', 'عروض', 'العروض', 'خصم', 'خصومات',
      'ولاء', 'مكافآت', 'مكافات', 'النقطة بكام', 'محفظة الباقات', 'محفظة التسوق', 'كوبون', 'كوبونات',
    ],
    stems: ['نقاط', 'نقط', 'محفظ', 'محافظ', 'عروض', 'خصم', 'ولاء', 'مكاف', 'كوبون'],
    answerAr:
      'منظومة النقاط والعروض في الشمساوية مصمّمة بذكاء وعدالة عشان تحمي كل الأطراف 🎁:\n' +
      '• **محفظة الباقات (للورش والموردين والمدربين):** بتكسب نقاط من تجهيز متجرك ودعواتك، وتغطّي بيها باقات المنصة فقط بدون ما تضر هامش أي ورشة.\n' +
      '• **محفظة التسوق (للعملاء):** بتكسب نقاط على طلباتك وتقييماتك الموثّقة وتخصم بيها في السلة حتى 10–15% — والخصم **مموّل بالكامل من المنصة ولا يُخصم جنيه واحد من صافي ربح الفنان**!\n' +
      '• وعروض المنصة المفعّلة شغالة مباشرة في **سوق الشمساوية** ومتاجر الفنانين.',
    scrollToSectionId: 'landing-packages',
    visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'سجّل دلوقتي واستلم نقاطك الترحيبية 🎁',
  },
  {
    id: 'referrals_tri_track',
    titleAr: 'نظام الدعوات الثلاثي والمكافآت',
    keywords: [
      'دعوة', 'دعوات', 'كود دعوة', 'إحالة', 'احالة', 'كود مدرب', 'كود مورد', 'كود فنان',
      'مورديني المفضلين', 'تحت إشراف مدرب', 'مكافأة 50 نقطة', 'اربح نقاط', 'دعوة أصدقاء',
    ],
    stems: ['دعو', 'احال', 'تفعيل', 'اشراف'],
    answerAr:
      'نظام **الدعوات الثلاثي** عندنا بيكافئ الكل بتمويل كامل من المنصة 🤝:\n' +
      '• **التسجيل المباشر:** 10 نقاط ترحيبية.\n' +
      '• **التسجيل بكود فنان أو مورّد:** 15 نقطة ترحيبية (ولو بكود مورّد، بيتضاف كتالوج المورّد تلقائياً لقائمة «مورديني المفضلين»!).\n' +
      '• **التسجيل بكود مدرب معتمد:** 25 نقطة ترحيبية + شارة دائمة **«تحت إشراف مدرب معتمد 🎓»**.\n' +
      '• **مكافأة الإنجاز للداعي:** كل 5 حسابات حقيقية تتفعّل بكودك، بتاخد **+50 نقطة** في **محفظة الباقات** تلقائياً!',
    scrollToSectionId: 'landing-packages',
    visibleSectionIds: ['landing-hero', 'landing-packages', 'landing-faq'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'سجّل واحصل على كود دعوتك فوراً 🤝',
  },
  {
    id: 'team_permissions_crm',
    titleAr: 'فريق العمل والصلاحيات وقاعدة العملاء CRM',
    keywords: [
      'فريق', 'فريق العمل', 'موظفين', 'عمال', 'صلاحيات', 'ادارة عملاء', 'إدارة عملاء',
      'قاعدة عملاء', 'crm', 'تواصل', 'أرقام العملاء', 'تاريخ الطلبات',
    ],
    stems: ['فريق', 'موظف', 'عمال', 'صلاحي', 'عملاء', 'تواصل'],
    answerAr:
      'لو شغلك كبر وعندك مساعدين أو فريق ورشة 👥:\n' +
      '• تقدر تضيف **فريق العمل بصلاحيات محددة** (مثلاً مسؤول إنتاج، مسؤول مبيعات، محاسب) بدون ما حد يشوف أرقام مش من صلاحيته.\n' +
      '• وعندك **سجل عملاء وموردين (CRM)** متكامل يحفظ تاريخ طلبات كل عميل وتفضيلاته عشان ترجّعه يشتري تاني بسهولة!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'ابدأ إدارة فريقك وعملاءك مجاناً 👥',
  },
  {
    id: 'shipping_delivery_currencies',
    titleAr: 'الشحن والتوصيل والمحافظات وتعدد العملات',
    keywords: [
      'شحن', 'الشحن', 'توصيل', 'التوصيل', 'محافظات', 'شحن مجاني', 'سعر الشحن',
      'تصدير', 'دولار', 'ريال', 'درهم', 'عملات', 'عملة', 'دولي', 'خارج مصر',
    ],
    stems: ['شحن', 'توصيل', 'محافظ', 'عمل', 'دولار', 'ريال', 'درهم', 'تصدير'],
    answerAr:
      'الشحن وتعدد العملات مضبوطين بدقة في سوق الشمساوية والمتاجر الخاصة 🚚:\n' +
      '• **تغطية الـ 27 محافظة** بأسعار شحن واضحة ومحدّثة، مع ميزة **الشحن المجاني** فوق حد معين وتنبيه **«وفّر شحن»** عند تجميع قطع من نفس المتجر.\n' +
      '• **تعدد العملات:** عملاءك بره مصر يقدروا يشوفوا الأسعار بالجنيه أو الدولار أو الريال أو الدرهم أو اليورو تلقائياً!',
    scrollToSectionId: 'landing-markets',
    visibleSectionIds: ['landing-hero', 'landing-markets', 'landing-faq'],
    ctaAction: 'open_marketplace',
    ctaLabelAr: 'تصفح سوق الشمساوية الآن 🚚',
  },
  {
    id: 'offline_security_privacy',
    titleAr: 'العمل أوفلاين والأمان والخصوصية وتطبيق الموبايل',
    keywords: [
      'اوفلاين', 'أوفلاين', 'بدون نت', 'انترنت', 'إنترنت', 'نت', 'امان', 'أمان', 'خصوصية',
      'خصوصيه', 'بياناتي', 'سحابة', 'مزامنة', 'مزامنه', 'تطبيق', 'موبايل', 'اندرويد', 'ايفون', 'pwa',
    ],
    stems: ['اوفلاين', 'انترنت', 'امان', 'خصوص', 'بيان', 'سحاب', 'مزامن', 'تطبيق', 'موبايل'],
    answerAr:
      'من أقوى مميزات الشمساوية إن **شغلك ما بيقفش لو النت قطع** 🛡️:\n' +
      '• المنظومة بتشتغل **أوفلاين محلياً على جهازك**، وبمجرد عودة الإنترنت بتتم **المزامنة السحابية التلقائية** بدون فقدان أي فاتورة أو منتج.\n' +
      '• بيانات حسابك (تكاليفك، عملاءك، أرباحك) **معزولة وخاصة بيك 100%** ومفيش أي حد تاني يشوفها.\n' +
      '• وتقدر تثبّتها كتطبيق (**PWA**) على موبايلك أو الكمبيوتر في ثانية!',
    scrollToSectionId: 'landing-faq',
    visibleSectionIds: ['landing-hero', 'landing-faq', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'ابدأ حسابك الآمن مجاناً 🛡️',
  },
  {
    id: 'trainers_community_profile',
    titleAr: 'المدربين والخبراء والصفحة الشخصية وعيلة الشمساوية',
    keywords: [
      'مدرب', 'مدربين', 'خبير', 'خبراء', 'كورسات', 'كورس', 'تدريب', 'ورش عمل', 'شهادات',
      'صفحة شخصية', 'صفحه شخصيه', 'معرض اعمال', 'معرض أعمال', 'مجتمع', 'عيلة الشمساوية', 'شروحات',
    ],
    stems: ['مدرب', 'خبير', 'خبراء', 'كورس', 'تدريب', 'شهاد', 'معرض', 'مجتمع', 'عيل', 'شروح'],
    answerAr:
      'لو أنت مدرب أو خبير حرفي أو فنان حابب تبني حضورك وسط مجتمع حقيقي 🎓:\n' +
      '• بتاخد **صفحة شخصية ومعرض أعمال احترافي مجاناً للأبد** تعرض فيه خبراتك وشهاداتك ومواعيد تدريباتك.\n' +
      '• تقدر تشارك طلابك كود دعوتك كمدرب عشان ياخدوا **25 نقطة ترحيبية + شارة «تحت إشراف مدرب معتمد»** وتكسب أنت **50 نقطة باقات** كل 5 طلاب!\n' +
      '• ومعاك **مجتمع عيلة الشمساوية** لتبادل الخبرات والأسئلة والشروحات.',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'أنشئ صفحتك كخبير/مدرب مجاناً 🎓',
  },
  {
    id: 'platform_overview_all',
    titleAr: 'كل خدمات ومميزات منظومة الشمساوية',
    keywords: [
      'عندكم ايه', 'عندكم إيه', 'فيها ايه', 'فيها إيه', 'المنصة فيها', 'بتعملوا ايه', 'بتقدموا ايه',
      'مميزات', 'خدمات', 'البرنامج فيه', 'ايه اللي موجود', 'إيه اللي موجود', 'شرح المنصة', 'عن المنصة',
    ],
    stems: ['مميز', 'خدم', 'منص', 'برنام'],
    answerAr:
      'منظومة **الشمساوية** هي نظام تشغيل كامل للحِرف اليدوية والموردين في مصر والعالم العربي ☀️ — فيها 6 أركان رئيسية شغالة مع بعض:\n' +
      '1. **حاسبة التكاليف والتسعير** لـ 55+ ورشة في 14 قسم (مع ورشة دمج الحِرف والهالك والمصنعية).\n' +
      '2. **المتجر الخاص + سوق الشمساوية + سوق الموردين** (10+ سمات، مقارنة ⚖️، مفضلة ❤️، هدية سريعة 🎁).\n' +
      '3. **التسويق الذكي مع شموسة (أوفلاين 100%)** لـ 35 تخصص حرفة + 14 أسلوب تسويق + 22 مشكلة فنية + صقر AI.\n' +
      '4. **المخزون والخامات الموحدة + أوامر التشغيل + الخزائن والمالية + كاشير وباركود للموردين + فريق العمل**.\n' +
      '5. **المحافظ المنفصلة (باقات / تسوق) + العروض + نظام الدعوات الثلاثي**.\n' +
      '6. **عمل أوفلاين + مزامنة سحابية آمنة + تطبيق موبايل PWA** — وكل الباقات مجانية حالياً بمناسبة الإطلاق!',
    scrollToSectionId: 'landing-systems',
    visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-markets', 'landing-packages'],
    ctaAction: 'register_artisan',
    ctaLabelAr: 'سجّل دلوقتي وجرّب المنظومة مجاناً ✨',
  },
];

// ============================================================================
// البحث المباشر في مكتبة الـ 35 تخصص حرفة و 14 أسلوب تسويق (أوفلاين 100%)
// ============================================================================

function findMatchingCraftSpecialtyOffline(qNorm: string, queryTokens: string[]) {
  let best: (typeof HANDMADE_MARKETING_LIBRARY.specialties)[number] | null = null;
  let bestScore = 0;

  for (const spec of HANDMADE_MARKETING_LIBRARY.specialties) {
    let score = 0;
    const specNameNorm = normalizeArabicKnowledgeText(spec.nameAr);
    if (specNameNorm.length >= 3 && qNorm.includes(specNameNorm)) score += 15;

    for (const kw of spec.keywords) {
      const nkw = normalizeArabicKnowledgeText(kw);
      if (nkw.length < 3) continue;
      if (qNorm.includes(nkw)) {
        score += 10;
      } else {
        for (const qt of queryTokens) {
          const f = isFuzzyTokenMatch(qt, nkw);
          if (f >= 7.5) {
            score += f;
            break;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = spec;
    }
  }

  return best && bestScore >= 9 ? { spec: best, score: bestScore } : null;
}

function findMatchingMarketingMethodOffline(qNorm: string, queryTokens: string[]) {
  let best: (typeof SHAMOUSA_MARKETING_METHODS_LIBRARY)[number] | null = null;
  let bestScore = 0;

  for (const m of SHAMOUSA_MARKETING_METHODS_LIBRARY) {
    let score = 0;
    const titleNorm = normalizeArabicKnowledgeText(m.titleAr);
    if (titleNorm.length >= 4 && qNorm.includes(titleNorm)) score += 14;
    for (const kw of m.keywords) {
      const nkw = normalizeArabicKnowledgeText(kw);
      if (nkw.length < 3) continue;
      if (qNorm.includes(nkw)) score += 8;
      else {
        for (const qt of queryTokens) {
          const f = isFuzzyTokenMatch(qt, nkw);
          if (f >= 7.5) {
            score += f * 0.8;
            break;
          }
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return bestScore >= 8 ? best : null;
}

// ============================================================================
// حفظ مقترحات زوار صفحة الهبوط للسوبر أدمن
// ============================================================================

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

// ============================================================================
// الترحيب وفلترة الأدوار والمستويات
// ============================================================================

export function buildLandingWelcomeReply(): LandingShamousaReply {
  return {
    text:
      `أهلاً وسهلاً بيك يا فندم في **الشمساوية** ☀️\n` +
      `أنا **شموسة** — مديرة الأعمال الذكية جوه المنظومة (شغالة معاك أوفلاين 100% وعارفة كل كبيرة وصغيرة في البرنامج!).\n` +
      `اسألني عن أي حاجة: **التكاليف والتسعير، التسويق، سوق الشمساوية، سوق الموردين، المخزون، الخزائن، أو الباقات**…\n\n` +
      `أو قولي الأول عشان أظبّطلك الصفحة على مقاسك: **أنت داخل معانا كإيه النهاردة؟** 👇`,
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
      recommendedCtaLabelAr: 'ادخل سوق الشمساوية فوراً 🛍️',
    };
    return {
      text:
        `منوّر الدنيا يا فندم! 🎁\n` +
        `فلترتلك صفحة الهبوط دلوقتي عشان يبان قدامك **سوق الشمساوية والمنتجات اليدوية المباشرة** من غير أي زحمة إدارية.\n` +
        `وجوه السوق هتلاقيني مستنياك أساعدك بمعالج «هدية سريعة» والمقارنة (⚖️) والمفضلة (❤️) ونقاط محفظة التسوق!`,
      filterToApply: filter,
      options: [
        { id: 'go_mkt', label: 'ادخل سوق الشمساوية دلوقتي 🛍️', action: 'navigate', payload: 'open_marketplace' },
        { id: 'ask_ship', label: 'إزاي بتشتري وتقارن في السوق؟', action: 'ask_topic', payload: 'markets_ecosystem' },
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
      ? 'بداية قوية بمتجر خامات منظم وباقات مبتدئين (Starter Kits) تظهر للورش في سوق الموردين'
      : 'الباقة الأساسية المجانية للأبد + متجرك الخاص + حاسبة التكاليف والتسعير عشان ما تخسرش في أول أوردر',
    active: isSupplier
      ? 'ربط مخازنك بكاشير باركود + شرائح الجملة + الظهور المباشر في سوق الموردين'
      : 'إدارة أوردراتك ومتجرك + حاسبة التكاليف + المخزون + شموسة للتسويق ومتابعة المبيعات والمواسم',
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

// ============================================================================
// المحرك الدلالي الرئيسي لمعالجة أي سؤال على صفحة الهبوط (أوفلاين 100%)
// ============================================================================

export function processLandingShamousaMessage(input: {
  rawQuery: string;
  awaitingSuggestionFor?: string | null;
  visitorRole?: LandingVisitorRole;
}): LandingShamousaReply {
  const { rawQuery, awaitingSuggestionFor, visitorRole } = input;
  const trimmed = rawQuery.trim();
  const qNorm = normalizeArabicKnowledgeText(trimmed);

  // 0.1) طبقة الشخصية والهوية والمصمم والمجاملات والهزار اللطيف (أولوية مطلقة قبل أي وضع مقترحات!)
  const personalityHit = tryHandleShamousaPersonality(trimmed, 'landing');
  if (personalityHit) {
    return {
      text: personalityHit.text,
      options:
        personalityHit.kind === 'capabilities_overview'
          ? [
              { id: 'pers_calc', label: 'حاسبة التكاليف (65+ حرفة) 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
              { id: 'pers_mktg', label: 'التسويق والمحتوى (35 تخصص) 📣', action: 'ask_topic', payload: 'marketing_content_library' },
              { id: 'pers_mkt', label: 'ادخل سوق الشمساوية 🛍️', action: 'navigate', payload: 'open_marketplace' },
              { id: 'pers_reg', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
            ]
          : [
              { id: 'pers_role_art', label: '🎨 أنا فنان / ورشة', action: 'select_role', payload: 'artisan' },
              { id: 'pers_role_sup', label: '📦 أنا مورّد خامات', action: 'select_role', payload: 'supplier' },
              { id: 'pers_role_cst', label: '🛍️ ادخل سوق الشمساوية', action: 'navigate', payload: 'open_marketplace' },
              { id: 'pers_reg_now', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
            ],
    };
  }

  // 0.2) إلغاء صريح لوضع المقترح لو الزائر اختار إلغاءه
  if (awaitingSuggestionFor && /^(لا|لأ|خلاص|مش عايز|الغاء|إلغاء)$/.test(qNorm)) {
    return {
      text: `ولا يهمك خالص يا فندم ☀️ لو حابب تسألني عن أي حاجة في المنظومة (تكاليف، تسويق، سوق الشمساوية، مخزون، باقات) أنا تحت أمرك!`,
      options: [
        { id: 'back_calc', label: 'حاسبة التكاليف والورش 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
        { id: 'back_mktg', label: 'التسويق والمحتوى 📣', action: 'ask_topic', payload: 'marketing_content_library' },
        { id: 'back_mkt', label: 'سوق الشمساوية 🛍️', action: 'navigate', payload: 'open_marketplace' },
      ],
    };
  }

  // 0.3) نية اقتراح صريحة من الزائر (مثلاً: "أقترح إضافة..." / "يا ريت تضيفوا...") -> تُرسل مباشرة للسوبر أدمن بدون خلطها بالأسئلة
  const isExplicitSuggestionIntent =
    /^(اقترح|اقتراح|عندي\s*اقتراح|عندي\s*مقترح|يا\s*ريت\s*تضيفوا|ياريت\s*تضيفوا|نفسي\s*تضيفوا|ممكن\s*تضيفوا|ضيفوا\s*لنا)/.test(
      qNorm
    );
  if (isExplicitSuggestionIntent && trimmed.length >= 6) {
    return {
      text:
        `أفكار راقية ومقدّرة جداً يا فندم! 💡☀️\n` +
        `سجّلت مقترحك (**«${trimmed.slice(0, 120)}»**) وبعته فوراً في **إشعارات إدارة الشمساوية (السوبر أدمن)** للمراجعة والتطوير.\n` +
        `تحب دلوقتي تكتشف اللي جاهز فعلاً في المنظومة؟`,
      capturedSuggestionText: trimmed,
      options: [
        { id: 'after_sug_1', label: 'شوف كل مميزات المنظومة ☀️', action: 'ask_topic', payload: 'platform_overview_all' },
        { id: 'after_sug_2', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
        { id: 'after_sug_3', label: 'ادخل سوق الشمساوية 🛍️', action: 'navigate', payload: 'open_marketplace' },
      ],
    };
  }

  // 1) إلغاء الفلتر
  if (/^(الغاء الفلتر|عرض الكل|اعرض الصفحه كلها|رجع الصفحه)$/.test(qNorm)) {
    return {
      text: `تمام يا فندم ☀️ رجّعتلك صفحة الهبوط كاملة بكل أقسامها.`,
      clearFilter: true,
      options: [
        { id: 'w_art', label: 'أنا فنان / ورشة 🎨', action: 'select_role', payload: 'artisan' },
        { id: 'w_sup', label: 'أنا مورّد خامات 📦', action: 'select_role', payload: 'supplier' },
        { id: 'w_cst', label: 'أنا عميل 🎁', action: 'select_role', payload: 'customer' },
      ],
    };
  }

  // 2) مكتبة المشاكل الفنية مفتوحة بالكامل أوفلاين (الحل الكامل + السلامة بدون قفل 3 سطور!) + دعوة تسجيل سياقية
  const techDiagnosis = checkTechnicalProblemLeadMagnetOffline(trimmed, false);
  if (techDiagnosis) {
    return {
      text: techDiagnosis.text,
      isLeadMagnetLocked: false,
      options: [
        {
          id: 'land_tech_reg',
          label: 'سجّل ورشتك دلوقتي مجاناً ✨',
          action: 'navigate',
          payload: 'register_artisan',
        },
        { id: 'land_tech_calc', label: 'شوف حاسبة الورش 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
      ],
    };
  }

  // 2.2) سجل التحديثات والمزايا الفعلية (الأصول الثابتة، النسخ الاحتياطي JSON، طباعة A4/PDF، ميزان المراجعة، روابط المنتج...)
  const systemFeatureHit = searchChangelogAndSystemFeaturesOffline(trimmed, 'landing');
  if (systemFeatureHit) {
    return {
      text: systemFeatureHit.text,
      options: [
        { id: 'sys_reg', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
        { id: 'sys_all', label: 'كل إمكانيات المنظومة ☀️', action: 'ask_topic', payload: 'platform_overview_all' },
        { id: 'sys_clear', label: 'عرض الصفحة كاملة', action: 'clear_filter' },
      ],
    };
  }

  // 2.5) دليل الاستخدام الرسمي (12 قسم خطوة بخطوة) + قاموس المصطلحات الحرفية والمحاسبية (13 مصطلح)
  const guideHit = searchUserGuideAndGlossaryOffline(trimmed, 'landing');
  if (guideHit) {
    return {
      text: guideHit.text,
      options: [
        { id: 'guide_reg', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
        { id: 'guide_all', label: 'كل إمكانيات المنظومة ☀️', action: 'ask_topic', payload: 'platform_overview_all' },
        { id: 'guide_clear', label: 'عرض الصفحة كاملة', action: 'clear_filter' },
      ],
    };
  }

  // استخراج الكلمات الدلالية الفعالة (بعد إزالة كلمات التوقف)
  const rawTokens = qNorm.split(/\s+/).filter((t) => t.length >= 2);
  const meaningfulTokens = rawTokens.filter((t) => !ARABIC_STOP_WORDS.has(t));
  const searchTokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  // 3) مطابقة دلالية ذكية على الـ 18 محوراً معرفياً (عبارات + كلمات + جذور + أخطاء إملائية)
  const scoredTopics = LANDING_PLATFORM_TOPICS.map((t) => {
    let score = 0;
    const titleNorm = normalizeArabicKnowledgeText(t.titleAr);
    if (titleNorm.length >= 4 && qNorm.includes(titleNorm)) score += 16;

    // 3أ) مطابقة العبارات والكلمات المفتاحية
    let bestKeywordHits = 0;
    for (const kw of t.keywords) {
      const nkw = normalizeArabicKnowledgeText(kw);
      if (!nkw) continue;
      if (nkw.includes(' ')) {
        if (qNorm.includes(nkw)) {
          score += 14;
          bestKeywordHits += 1;
        }
      } else {
        if (rawTokens.includes(nkw)) {
          score += 11;
          bestKeywordHits += 1;
        } else {
          // فحص كل كلمة في جملة الزائر ضد الكلمة المفتاحية بالتجذير والأخطاء الإملائية
          let bestTokenScore = 0;
          for (const qt of searchTokens) {
            const matchVal = isFuzzyTokenMatch(qt, nkw);
            if (matchVal > bestTokenScore) bestTokenScore = matchVal;
          }
          if (bestTokenScore >= 6.5) {
            score += bestTokenScore;
            bestKeywordHits += 1;
          }
        }
      }
    }

    // 3ب) مطابقة الجذور الدقيقة (تضمن التقاط التكاليف/التسويق/الأسواق/الخزائن بأي تصريف!)
    for (const st of t.stems) {
      const nst = normalizeArabicKnowledgeText(st);
      for (const qt of searchTokens) {
        const qStem = stemArabicToken(qt);
        if (qStem === nst || (qStem.length >= 4 && nst.length >= 4 && (qStem.includes(nst) || nst.includes(qStem)))) {
          score += 8.5;
          bestKeywordHits += 1;
          break;
        }
        if (qStem.length >= 4 && nst.length >= 4 && levenshteinDistance(qStem, nst) === 1) {
          score += 6;
          bestKeywordHits += 1;
          break;
        }
      }
    }

    return { topic: t, score, hits: bestKeywordHits };
  }).sort((a, b) => b.score - a.score);

  // 4) فحص مباشر في مكتبة الـ 35 تخصص حرفة + سجل الـ 65+ حرفة + 14 أسلوب تسويق
  const matchedCraftRes = findMatchingCraftSpecialtyOffline(qNorm, searchTokens);
  const matchedCraft = matchedCraftRes?.spec || null;
  const matchedCraftScore = matchedCraftRes?.score || 0;
  const registryCraftHit = searchAllCraftsRegistryOffline(trimmed, 'landing');
  const matchedMethod = findMatchingMarketingMethodOffline(qNorm, searchTokens);

  const top = scoredTopics[0];
  const second = scoredTopics[1];

  // لو سجل الـ 65+ حرفة أدق من التخصص العام (مثلاً: الطباعة ثلاثية الأبعاد، الجيسمونايت، الكونكريت، كل الحرف الـ 14 قسماً)
  if (
    registryCraftHit &&
    (registryCraftHit.matchedTitleAr?.includes('14 قسماً') ||
      ((registryCraftHit.score || 0) > matchedCraftScore + 8 && (!top || top.score < 16)))
  ) {
    return {
      text: registryCraftHit.text,
      filterToApply: {
        id: 'crafts_registry_match',
        role: visitorRole || 'artisan',
        labelAr: registryCraftHit.matchedTitleAr || 'سجل الحِرف والورش المدعومة',
        scrollToSectionId: 'landing-systems',
        visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
        recommendedCtaAction: 'register_artisan',
        recommendedCtaLabelAr: 'ابدأ ورشتك دلوقتي مجاناً ✨',
      },
      options: [
        { id: 'reg_cr_cta', label: 'سجّل وفعّل حرفتك مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
        { id: 'reg_cr_calc', label: 'تفاصيل حاسبة التكاليف 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
        { id: 'reg_cr_clear', label: 'عرض الصفحة كاملة ☀️', action: 'clear_filter' },
      ],
    };
  }

  // لو فيه تطابق مباشر مع تخصص حرفة من الـ 35 تخصص ولم يكن هناك محور أقوى منه بكثير
  if (matchedCraft && (!top || top.score < 16)) {
    const cfg = loadLoyaltyConfig();
    const filter: LandingSectionFilter = {
      id: `craft_${matchedCraft.id}`,
      role: visitorRole || 'artisan',
      labelAr: `منظومة الشمساوية لتخصص: ${matchedCraft.nameAr}`,
      scrollToSectionId: 'landing-systems',
      visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
      recommendedCtaAction: 'register_artisan',
      recommendedCtaLabelAr: `ابدأ ورشة ${matchedCraft.nameAr} مجاناً ✨`,
    };
    const anglesPreview = (matchedCraft.sellingPoints || []).slice(0, 2).map((a) => `• ${a}`).join('\n');
    return {
      text:
        `أيوه طبعاً يا فندم! تخصص **${matchedCraft.nameAr}** مدعوم بالكامل جوه منظومة الشمساوية 🎨☀️:\n` +
        `• **حاسبة تكاليف وتسعير دقيقة** لخامات ${matchedCraft.nameAr} والهالك والمصنعية والتغليف.\n` +
        `• **مكتبة تسويقية جاهزة أوفلاين** بنقط بيع مجرّبة لتخصصك:\n${anglesPreview}\n` +
        `• **متجر خاص + الظهور في سوق الشمساوية** مع نقاط محفظة الباقات (1 نقطة = ${cfg.pointValueEgp} ج.م).\n\n` +
        `✨ **سجّل دلوقتي مجاناً** وابدأ حساب تكاليف وتسويق شغلك في ${matchedCraft.nameAr} فوراً!`,
      filterToApply: filter,
      options: [
        { id: `cta_craft_${matchedCraft.id}`, label: filter.recommendedCtaLabelAr, action: 'navigate', payload: 'register_artisan' },
        { id: 'craft_calc', label: 'تفاصيل حاسبة التكاليف 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
        { id: 'craft_mktg', label: 'إزاي بتساعديني في التسويق؟ 📣', action: 'ask_topic', payload: 'marketing_content_library' },
      ],
    };
  }

  // لو الزائر بيسأل عن أسلوب تسويق محدد من الـ 14 أسلوب
  if (matchedMethod && (!top || top.topic.id === 'marketing_content_library' || top.score < 12)) {
    const filter: LandingSectionFilter = {
      id: `method_${matchedMethod.id}`,
      role: visitorRole || 'artisan',
      labelAr: `أسلوب تسويق: ${matchedMethod.titleAr}`,
      scrollToSectionId: 'landing-systems',
      visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
      recommendedCtaAction: 'register_artisan',
      recommendedCtaLabelAr: 'سجّل وطبّق خطة التسويق مع شموسة 📣',
    };
    return {
      text:
        `أكيد! عندنا في المكتبة التسويقية الأوفلاين أسلوب **«${matchedMethod.titleAr}»** 📣:\n` +
        `• **امتى تستخدمه:** ${matchedMethod.whenToUseAr}\n` +
        `• **تطبيقه العملي:** ${(matchedMethod.howToApplyStepsAr || []).slice(0, 2).join(' ← ')}\n\n` +
        `✨ **سجّل دلوقتي مجاناً** عشان أجهّزلك البوستات ورسائل الواتساب على منتجات ورشتك نفسها!`,
      filterToApply: filter,
      options: [
        { id: 'cta_meth', label: filter.recommendedCtaLabelAr, action: 'navigate', payload: 'register_artisan' },
        { id: 'meth_all', label: 'كل خدمات التسويق 📣', action: 'ask_topic', payload: 'marketing_content_library' },
        { id: 'meth_clear', label: 'عرض الصفحة كاملة ☀️', action: 'clear_filter' },
      ],
    };
  }

  // لو سجل الـ 65+ حرفة طابق حرفة غير موجودة في الـ 35 تخصص تسويق
  if (registryCraftHit && (!top || top.score < 16)) {
    return {
      text: registryCraftHit.text,
      filterToApply: {
        id: 'crafts_registry_match',
        role: visitorRole || 'artisan',
        labelAr: registryCraftHit.matchedTitleAr || 'سجل الحِرف والورش المدعومة',
        scrollToSectionId: 'landing-systems',
        visibleSectionIds: ['landing-hero', 'landing-systems', 'landing-packages'],
        recommendedCtaAction: 'register_artisan',
        recommendedCtaLabelAr: 'ابدأ ورشتك دلوقتي مجاناً ✨',
      },
      options: [
        { id: 'reg_cr_cta', label: 'سجّل وفعّل حرفتك مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
        { id: 'reg_cr_calc', label: 'تفاصيل حاسبة التكاليف 🧮', action: 'ask_topic', payload: 'calculator_workshops' },
        { id: 'reg_cr_clear', label: 'عرض الصفحة كاملة ☀️', action: 'clear_filter' },
      ],
    };
  }

  // 5) تطابق واثق على محور أو محورين معاً (ربط السياق لو الزائر سأل عن حاجتين في نفس الجملة!)
  if (top && top.score >= 6) {
    const t = top.topic;
    const cfg = loadLoyaltyConfig();
    const extraLoyaltyLine =
      t.id === 'loyalty_wallets_offers'
        ? `\n• **سعر النقطة الحالي:** 1 نقطة = **${cfg.pointValueEgp} ج.م** (سقف خصم محفظة التسوق: **${cfg.customerMaxDiscountPercent}%**).`
        : '';

    // لو فيه محور تاني قوي في نفس السؤال (مثلاً "عندكم تكاليف وتسويق؟") ندمج الإجابتين بذكاء!
    const hasStrongSecond =
      second &&
      second.score >= 8 &&
      second.topic.id !== t.id &&
      second.topic.id !== 'platform_overview_all' &&
      t.id !== 'platform_overview_all';

    const combinedText = hasStrongSecond
      ? `${t.answerAr}${extraLoyaltyLine}\n\n---\n\n**وبالنسبة لـ ${second.topic.titleAr}:**\n${second.topic.answerAr}`
      : `${t.answerAr}${extraLoyaltyLine}`;

    const filter: LandingSectionFilter = {
      id: `topic_${t.id}`,
      role: visitorRole,
      labelAr: hasStrongSecond ? `${t.titleAr} + ${second.topic.titleAr}` : `تركيز الصفحة على: ${t.titleAr}`,
      scrollToSectionId: t.scrollToSectionId,
      visibleSectionIds: Array.from(
        new Set([...t.visibleSectionIds, ...(hasStrongSecond ? second.topic.visibleSectionIds : [])])
      ),
      recommendedCtaAction: t.ctaAction,
      recommendedCtaLabelAr: t.ctaLabelAr,
    };

    return {
      text:
        `${combinedText}\n\n` +
        `فلترتلك الشاشة على القسم ده دلوقتي — **سجّل دلوقتي مجاناً** عشان تجرّبه بنفسك فوراً أو اسألني عن أي تفصيلة تانية:`,
      filterToApply: filter,
      options: [
        { id: `cta_${t.id}`, label: t.ctaLabelAr, action: 'navigate', payload: t.ctaAction },
        { id: `clear_${t.id}`, label: 'عرض الصفحة كاملة', action: 'clear_filter' },
        { id: 'not_meant', label: 'لا مش قصدي ده — أقصد حاجة تانية', action: 'not_what_i_meant', payload: trimmed },
      ],
    };
  }

  // 6) تطابق متوسط -> نعرض أقرب 3 أقسام + "لا مش قصدي ده"
  const closeCandidates = scoredTopics.filter((s) => s.score >= 4.5).slice(0, 3);
  if (closeCandidates.length > 0) {
    return {
      text:
        `فهمتك جزئياً ☀️ تقصد حاجة من الأقسام القريبة دي في المنظومة؟ اختار اللي تقصده أو قولي «أقصد حاجة تانية»:\n` +
        `✨ وتقدر **تسجّل دلوقتي مجاناً** وتجرّب كل الأقسام دي جوه حسابك فوراً!`,
      options: [
        ...closeCandidates.map((c) => ({
          id: `cl_${c.topic.id}`,
          label: c.topic.titleAr,
          action: 'ask_topic' as const,
          payload: c.topic.id,
        })),
        { id: 'cl_reg', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: visitorRole === 'supplier' ? 'register_supplier' : 'register_artisan' },
        { id: 'cl_other', label: 'لا مش قصدي ده — أقصد حاجة تانية 💡', action: 'not_what_i_meant', payload: trimmed },
      ],
    };
  }

  // 6.8) لو كان الزائر ضغط على «ابعت مقترح» وكتب مقترحاً حقيقياً (ليس سؤالاً ولم يطابق أي معرفة في المنظومة)
  const looksLikeNewQuestion =
    trimmed.endsWith('؟') ||
    trimmed.endsWith('?') ||
    /^(مين|من\s+|ايه\s+|ازاي\s+|كيف\s+|هل\s+|فين\s+|بكام|كام\s+|ليه\s+|عندكم|عندك|ممكن\s*اعرف)/.test(qNorm);

  if (trimmed.length >= 4 && Boolean(awaitingSuggestionFor) && !looksLikeNewQuestion) {
    return {
      text:
        `أفكار راقية ومقدّرة جداً يا فندم! 💡☀️\n` +
        `سجّلت مقترحك (**«${trimmed.slice(0, 120)}»**) وبعته فوراً في **إشعارات إدارة الشمساوية (السوبر أدمن)** للمراجعة والتطوير.\n` +
        `تحب دلوقتي تكتشف اللي جاهز فعلاً في المنظومة؟`,
      capturedSuggestionText: trimmed,
      options: [
        { id: 'after_sug_1', label: 'شوف كل مميزات المنظومة ☀️', action: 'ask_topic', payload: 'platform_overview_all' },
        { id: 'after_sug_2', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: 'register_artisan' },
        { id: 'after_sug_3', label: 'ادخل سوق الشمساوية 🛍️', action: 'navigate', payload: 'open_marketplace' },
      ],
    };
  }

  // 7) خارج المنظومة فعلاً (صدق تام بدون اختراع أو هلوسة، وبدون تفعيل فخ انتظار مقترح تلقائياً!)
  return {
    text:
      `بصراحة وبكل وضوح يا فندم ☀️: **«${trimmed.slice(0, 80)}»** خارج تخصص منظومة الشمساوية — إحنا متخصصين 100% في **تشغيل وتسعير وتسويق الورش اليدوية (+65 حرفة) وموردي الخامات وسوق الشمساوية**.\n\n` +
      `لو حابب تبعتها كمقترح تطوير لإدارة الشمساوية اضغط على زر المقترح تحت، أو اسألني مباشرة عن أي قسم من أقسام المنظومة:`,
    options: [
      { id: 'oos_send_sug', label: '💡 ابعت مقترح لإدارة الشمساوية', action: 'not_what_i_meant', payload: trimmed },
      { id: 'oos_all', label: 'شوف كل اللي موجود في المنظومة ☀️', action: 'ask_topic', payload: 'platform_overview_all' },
      { id: 'oos_reg', label: 'سجّل دلوقتي مجاناً ✨', action: 'navigate', payload: visitorRole === 'supplier' ? 'register_supplier' : 'register_artisan' },
    ],
  };
}

export function getLandingTopicById(topicId: string): LandingKnowledgeTopic | undefined {
  return LANDING_PLATFORM_TOPICS.find((t) => t.id === topicId);
}
