/**
 * النواة المعرفية والشخصية الموحدة لـ «شموسة» في كل أنحاء منظومة الشمساوية
 * تخدم «شموسة» بشخصية مصرية راقية وواثقة ولارج ودمها خفيف، مع فصل صارم للأسلوب والتخصص حسب السياق:
 * - صفحة الهبوط (landing): مرشدة وموسوعة شاملة لكل كبيرة وصغيرة في المنظومة.
 * - داخل حساب الورشة/الفنان (internal_workspace): مديرة أعمالك اليومية للتكاليف والمخزون والخزائن والتسويق.
 * - داخل حساب المورّد (internal_supplier): مديرة عمليات التوريد والمخازن والفروع وكاشير POS.
 * - سوق الشمساوية (alshams_market) ومتاجر الفنانين (artisan_storefront): مساعدة تسوق شخصية أنيقة للهدايا والفلترة وتوفير الشحن والمقارنة.
 * - سوق الموردين (suppliers_market) ومتاجر الموردين (supplier_storefront): خبيرة خامات وتوريد جملة B2B.
 *
 * تشمل:
 * 1. هوية شموسة ونشأة منظومة الشمساوية: إنتاج «الشمس كرافت» بالتعاون مع «تايجوس Tygos» — تأسيس وتصميم المهندس حسام بسيوني.
 * 2. محرك فهم دلالي بالاقتران المفهومي (Concept-Pair) + تحمّل الأخطاء الإملائية (Levenshtein + ضغط الحروف المكررة).
 * 3. موسوعة شاملة لكل كلمات المجاملة والدعوات والتشجيع المصرية (بما فيها الدعوات لشموسة وأخوها صقر) بردود راقية وواثقة.
 * 4. بحث مباشر في سجل الحِرف الكامل (14 قسماً رئيسياً و 65+ حرفة فعلية من craftsRegistry.ts).
 * 5. بحث مباشر في دليل الاستخدام الرسمي (12 قسماً) وقاموس المصطلحات (13 مصطلحاً) وسجل التحديثات والشاشات الفعلية.
 */

import { normalizeArabicKnowledgeText } from './shamousaKnowledgeStore';
import { GLOSSARY, GUIDE_SECTIONS, GlossaryItem, GuideSection } from '../guide/guide';
import { CHANGELOG_RELEASES } from '../guide/changelog';
import { MAIN_SECTIONS, SUB_CRAFTS_REGISTRY, SubCraftDefinition } from '../registry/craftsRegistry';
import {
  matchEgyptianSocialEncyclopedia,
  normalizeSocialArabicText,
  socialLevenshtein,
} from '../data/shamousaEgyptianSocialEncyclopedia';
import {
  matchGreetingsAndFarewellsEncyclopedia,
  type GreetingFarewellSurfaceInfo,
} from '../data/shamousaGreetingsFarewellsEncyclopedia';

export { normalizeSocialArabicText };

export type ShamousaSurfaceContext =
  | 'landing'
  | 'alshams_market'
  | 'suppliers_market'
  | 'artisan_storefront'
  | 'supplier_storefront'
  | 'internal_workspace'
  | 'internal_supplier';

export interface SharedShamousaMatch {
  kind:
    | 'creator_and_identity'
    | 'blessing_with_saqr'
    | 'blessing_prayer'
    | 'compliment'
    | 'greeting'
    | 'gratitude_farewell'
    | 'apology_polite'
    | 'acknowledgment_agreement'
    | 'playful_banter'
    | 'not_shamsawy_identity'
    | 'capabilities_overview'
    | 'crafts_registry'
    | 'changelog_history'
    | 'system_feature'
    | 'user_guide'
    | 'glossary';
  text: string;
  matchedTitleAr?: string;
  score?: number;
}

function getContextPivotLine(
  ctx: ShamousaSurfaceContext,
  storeName?: string,
  firstName?: string
): string {
  const who = firstName ? `يا **${firstName}**` : 'يا فندم';
  switch (ctx) {
    case 'internal_workspace':
      return `تحت أمرك ${who} — تحب نشتغل دلوقتي على **حاسبة التكاليف، المخزون، أوامر التشغيل، التسويق، ولا نشوف «هلخصهالك 📋»**؟`;
    case 'internal_supplier':
      return `تحت أمرك ${who} — تحب نتابع دلوقتي **المخازن والفروع، شرائح الجملة، كاشير POS، ولا نشوف «هلخصهالك 📋»**؟`;
    case 'alshams_market':
      return `ودلوقتي أنا معاك في **سوق الشمساوية** 🛍️ — قولي بتدوّر على هدية أو قطعة إيه أو بميزانية كام وأصفّيلك السوق قدامك في ثانية!`;
    case 'suppliers_market':
      return `ودلوقتي أنا معاك في **سوق الموردين** 📦 — قولي محتاج خامة إيه (خيوط، ريزن، خشب، خرز، جلود…) وأجيبلك أفضل العروض وشرائح الجملة فوراً!`;
    case 'artisan_storefront':
      return `ودلوقتي أنا معاك جوه متجر **${storeName || 'الورشة'}** ✨ — قولي بتدوّر على قطعة إيه أو ميزانيتك كام وهرتّبلك المعروضات قدامك فوراً!`;
    case 'supplier_storefront':
      return `ودلوقتي أنا معاك جوه متجر **${storeName || 'المورّد'}** 📦 — قولي الخامة أو الكمية اللي محتاجها وهجهّزلك الأنسب على طول!`;
    case 'landing':
    default:
      return `اسألني في أي تفصيلة في المنظومة — من **حاسبة التكاليف والـ 65+ حرفة** و**التسويق** لحد **سوق الشمساوية والموردين والمحاسبة ودليل الاستخدام** — أو **سجّل دلوقتي مجاناً** وجرّبها بنفسك!`;
  }
}

function getGreetingFarewellSurfaceInfo(
  ctx: ShamousaSurfaceContext,
  storeName?: string,
  firstName?: string
): GreetingFarewellSurfaceInfo {
  const cleanName = firstName && firstName !== 'صديقي' ? firstName : '';
  switch (ctx) {
    case 'internal_workspace':
      return {
        whoLabel: cleanName ? `يا **${cleanName}**` : 'يا فنان',
        placeLabel: 'ورشتك بمنظومة الشمساوية',
        nextVisitHint: 'وفي انتظارك المرة الجاية نكمّل شغل الورشة والتسعير والتسويق بأعلى مستوى! ☀️',
        isInternal: true,
      };
    case 'internal_supplier':
      return {
        whoLabel: cleanName ? `يا **${cleanName}**` : 'يا أستاذ',
        placeLabel: 'حساب المورّد بمنظومة الشمساوية',
        nextVisitHint: 'وفي انتظارك المرة الجاية نتابع المخازن والفروع وطلبات التوريد بأعلى مستوى! 📦☀️',
        isInternal: true,
      };
    case 'alshams_market':
      return {
        whoLabel: 'يا فندم',
        placeLabel: 'سوق الشمساوية 🛍️',
        nextVisitHint: 'وفي انتظارك المرة الجاية في **سوق الشمساوية** تكتشف أجمل الهدايا والقطع اليدوية الفريدة! ☀️',
        isInternal: false,
      };
    case 'suppliers_market':
      return {
        whoLabel: 'يا فندم',
        placeLabel: 'سوق الموردين 📦',
        nextVisitHint: 'وفي انتظارك المرة الجاية في **سوق الموردين** لأفضل الخامات وعروض الجملة! ☀️',
        isInternal: false,
      };
    case 'artisan_storefront':
      return {
        whoLabel: 'يا فندم',
        placeLabel: storeName ? `متجر ${storeName}` : 'متجر الورشة',
        nextVisitHint: storeName
          ? `وفي انتظارك المرة الجاية في **متجر ${storeName}** بأجمل القطع الجديدة! ☀️`
          : 'وفي انتظارك المرة الجاية بأجمل القطع الجديدة! ☀️',
        isInternal: false,
      };
    case 'supplier_storefront':
      return {
        whoLabel: 'يا فندم',
        placeLabel: storeName ? `متجر ${storeName}` : 'متجر المورّد',
        nextVisitHint: storeName
          ? `وفي انتظارك المرة الجاية في **متجر ${storeName}** بأفضل الخامات والأسعار! ☀️`
          : 'وفي انتظارك المرة الجاية بأفضل الخامات والأسعار! ☀️',
        isInternal: false,
      };
    case 'landing':
    default:
      return {
        whoLabel: 'يا فندم',
        placeLabel: 'منظومة الشمساوية',
        nextVisitHint: 'وفي انتظارك المرة الجاية دايماً، وأول ما تكون جاهز سجّل مجاناً وجرّب المنظومة بنفسك! ☀️✨',
        isInternal: false,
      };
  }
}

// ============================================================================
// 1) طبقة الهوية والمصمم + الربط الكامل بموسوعة المجاملات والدعوات المصرية
// ============================================================================

const DIRECT_IDENTITY_OR_ORIGIN_PATTERNS: RegExp[] = [
  /(انتي\s*مين|انت\s*مين|مين\s*انتي|مين\s*انت|اسمك\s*ايه|عرفيني\s*بنفسك|عرفيني\s*عليكي|مين\s*شموسه|ايه\s*شموسه|انتي\s*روبوت|انتي\s*انسان|انتي\s*ذكاء\s*اصطناعي)/,
  /(انتي\s*منين|انت\s*منين|منين\s*انتي|تبع\s*مين|انتي\s*تبع\s*مين|تبع\s*شركه\s*ايه|شركه\s*ايه\s*دي|انتي\s*شمساويه|اصل\s*الشمساويه)/,
  /(حسام\s*بسيوني|الباشمهندس\s*حسام|مهندس\s*حسام|المهندس\s*حسام|تايجوس|تيجوس|tygos|الشمس\s*كرافت|شمس\s*كرافت)/,
  /(قصه\s*(المنظومه|الشمساويه|البرنامج)|نشاه\s*(المنظومه|الشمساويه|البرنامج)|حكايه\s*(المنظومه|الشمساويه|شموسه)|المنظومه\s*اتعملت\s*ازاي|الشمساويه\s*بدات\s*ازاي)/,
];

function isCreatorOrMakerConceptQuery(norm: string): boolean {
  if (DIRECT_IDENTITY_OR_ORIGIN_PATTERNS.some((re) => re.test(norm))) return true;

  // لا نخلط بين السؤال الودي «عاملة إيه يا شموسة» وبين السؤال عن من صمّم/عمل المنظومة
  if (/(عامله\s*ايه|عامل\s*ايه|عاملين\s*ايه|اخبارك\s*ايه)/.test(norm) && !/(مين|مصمم|صمم|مؤسس|اسس|برمج|مطور)/.test(norm)) {
    return false;
  }

  const hasWhoCue = /(^|\s)(مين|من|انهي|اي|ايه|مصممك|مؤسسك|مطورك|مخترعك|صاحب|مؤسس|مصمم|مطور)(\s|$)/.test(norm);
  if (!hasWhoCue) return false;

  const hasStrongMakerVerb =
    /(صمم|مصمم|برمج|مبرمج|اخترع|مخترع|اسس|مؤسس|بني|باني|انشا|منشئ|صنع|طور|مطور|ورا\s*(الشغل|البرنامج|المنظوم|المنص|الشمساو|الموقع)|وراء\s*(الشغل|البرنامج|المنظوم|المنص|الشمساو|الموقع)|صاحب\s*(الشغل|البرنامج|المنظوم|المنص|الفكر|الشمساو|الموقع))/.test(
      norm
    );
  if (hasStrongMakerVerb) return true;

  const hasGeneralMakerWord = /(^|\s)(عمل|عملك|عامل|المهندس|مهندس|الشركه|شركه|الشخص|الفريق)(\s|$)/.test(norm);
  const hasEntityReference =
    /(شغل|الشغل|منظوم|برنام|منص|موقع|تطبيق|شمساو|شموس|عملك|عامل\s*ده|كل\s*ده|الحاجات\s*دي|الجمال\s*ده|الابداع\s*ده|النظام)/.test(
      norm
    );
  return hasGeneralMakerWord && hasEntityReference;
}

const NOT_SHAMSAWY_PATTERNS: RegExp[] = [
  /(انا\s*مش\s*شمساو|مش\s*شمساو|لست\s*شمساو|مش\s*من\s*الشمساو|مش\s*عضو|مش\s*مشترك\s*معاكم|يعني\s*ايه\s*شمساو|ليه\s*اسمها\s*الشمساو)/,
];

const WHAT_DO_YOU_HAVE_PATTERNS: RegExp[] = [
  /^(عندك\s*ايه|عندكم\s*ايه|ايه\s*عندك|ايه\s*اللي\s*عندك|بتعرفي\s*تعملي\s*ايه|تقدري\s*تعملي\s*ايه|تقدري\s*تساعديني\s*في\s*ايه|بتعملي\s*ايه|ايه\s*خدماتك|ايه\s*خدماتكم|بتقدموا\s*ايه|قوليلي\s*عندكم\s*ايه|وريني\s*عندك\s*ايه)([!؟?.\s]*)$/,
];

export function tryHandleShamousaPersonality(
  rawQuery: string,
  ctx: ShamousaSurfaceContext,
  storeName?: string,
  firstName?: string
): SharedShamousaMatch | null {
  const norm = normalizeSocialArabicText(rawQuery);
  if (!norm) return null;

  const who = firstName ? `يا **${firstName}**` : 'يا فندم';
  const pivot = getContextPivotLine(ctx, storeName, firstName);
  const isMarketSurface = ctx === 'alshams_market' || ctx === 'artisan_storefront';
  const isSupplierSurface = ctx === 'suppliers_market' || ctx === 'supplier_storefront';
  const isInternalSurface = ctx === 'internal_workspace' || ctx === 'internal_supplier';

  // 1) سؤال عن المصمم / المهندس / الأصل / الشركة / الهوية (مفرد أو مدمج مع مجاملة أو دعوة)
  if (isCreatorOrMakerConceptQuery(norm)) {
    const hasWarmIntro = /(هايل|تحفه|جميل|ممتاز|روعه|شاطر|برافو|ربنا|تسلم|بشكر|اشكر|عظم|شيك|فخم|ذوق)/.test(norm);
    const warmPrefix = hasWarmIntro
      ? `كلك ذوق والله ${who}، شهادة أعتز بيها بجد! ☀️✨ ده من ذوق حضرتك الراقي.\n\n`
      : `أهلاً بحضرتك ${who}! ☀️\n`;

    if (isMarketSurface) {
      return {
        kind: 'creator_and_identity',
        matchedTitleAr: 'مين شموسة ومين صمم منظومة الشمساوية',
        text:
          warmPrefix +
          `أنا **شموسة** — مساعدتك الذكية في **منظومة الشمساوية**، وهي من إنتاج **الشمس كرافت** بالتعاون مع **تايجوس (Tygos)**، وتأسيس وتصميم **المهندس حسام بسيوني**.\n` +
          `دوري هنا في **${storeName || 'سوق الشمساوية'}** إني أساعدك تلاقي أحلى الهدايا والقطع اليدوية الأصلية مباشرة من أصحاب الورش، بفلترة فورية على قد ميزانيتك ومقارنة ذكية وتوفير شحن! 🛍️\n\n` +
          pivot,
      };
    }

    if (isSupplierSurface) {
      return {
        kind: 'creator_and_identity',
        matchedTitleAr: 'مين شموسة ومين صمم منظومة الشمساوية',
        text:
          warmPrefix +
          `أنا **شموسة** — المساعدة الذكية في **منظومة الشمساوية**، من إنتاج **الشمس كرافت** بالتعاون مع **تايجوس (Tygos)**، وتأسيس وتصميم **المهندس حسام بسيوني**.\n` +
          `دوري هنا في **${storeName || 'سوق الموردين'}** إني أساعدك تلاقي خاماتك بشرائح الجملة، تقارن أسعار الموردين، وتبعت طلب عرض سعر (RFQ) في ثانية! 📦\n\n` +
          pivot,
      };
    }

    if (isInternalSurface) {
      return {
        kind: 'creator_and_identity',
        matchedTitleAr: 'مين شموسة ومين صمم منظومة الشمساوية',
        text:
          warmPrefix +
          `أنا **شموسة** — مديرة أعمالك اليومية في **منظومة الشمساوية** (من إنتاج **الشمس كرافت** بالتعاون مع **تايجوس Tygos**، وتأسيس وتصميم **المهندس حسام بسيوني**).\n` +
          `• شغالة معاك هنا **أونلاين وأوفلاين بسلاسة وبحماية وفصل تام بين بيانات كل فنان والتاني وكل مورّد والتاني** — يعني أرقامك وأسرار ورشتك خاصة بيك وحدك 100%.\n` +
          `• ومعايا كمان أخويا **صقر الشمساوية AI** 🦅 والعقول التحليلية الثلاثة لو احتجت تحليل أعمق!\n\n` +
          pivot,
      };
    }

    return {
      kind: 'creator_and_identity',
      matchedTitleAr: 'مين شموسة ومين صمم منظومة الشمساوية',
      text:
        warmPrefix +
        `أنا **شموسة** — مديرة الأعمال والعمليات الذكية في **منظومة الشمساوية**، وهي من إنتاج **الشمس كرافت** بالتعاون مع **تايجوس (Tygos)**، ومن تأسيس وتصميم **المهندس حسام بسيوني**.\n` +
        `• المنظومة اتبنت بالكامل من الصفر مخصوص لـ **الفنانين وأصحاب الورش اليدوية (أكتر من 65 حرفة في 14 قسماً)، ومورّدي الخامات، والمدربين، وعملاء سوق الشمساوية**.\n` +
        `• شغالة معاك **أونلاين وأوفلاين بسلاسة وبسرعة فورية** — بتحمي بياناتك بالكامل مع **فصل تام ومستقل بين كل فنان والتاني وبين كل مورّد والتاني**، وجوه حسابك بيبقى معايا كمان **صقر الشمساوية AI** والعقول التحليلية الثلاثة!\n\n` +
        pivot,
    };
  }

  // 1.5) "أنا مش شمساوية" / "يعني إيه شمساوية؟"
  if (NOT_SHAMSAWY_PATTERNS.some((re) => re.test(norm))) {
    return {
      kind: 'not_shamsawy_identity',
      matchedTitleAr: 'عيلة الشمساوية ولقب الشمساوي/الشمساوية',
      text:
        `ولا يهمك خالص ${who}، البيت بيتك وتشرفنا في أي وقت! ☀️✨\n` +
        `«الشمساوي» و«الشمساوية» ده اللقب العائلي اللطيف اللي بنرحّب بيه بكل فنان ومورّد وعميل بينوّرنا في **منظومة الشمساوية** (من إنتاج **الشمس كرافت** بالتعاون مع **تايجوس Tygos**، تصميم **المهندس حسام بسيوني**).\n` +
        `ومش شرط خالص تكون مشترك عشان أخدمك — ` +
        pivot,
    };
  }

  // 2) "عندك إيه؟" / "بتعرفي تعملي إيه؟" (خارج الحساب المفتوح)
  if (!isInternalSurface && WHAT_DO_YOU_HAVE_PATTERNS.some((re) => re.test(norm))) {
    if (isMarketSurface) {
      return {
        kind: 'capabilities_overview',
        matchedTitleAr: 'إيه اللي عند شموسة في السوق',
        text:
          `تحت أمرك يا فندم في **${storeName || 'سوق الشمساوية'}** ☀️🛍️:\n` +
          `• **فلترة فورية ذكية:** قولي عايز إيه وميزانيتك كام (مثلاً: *«هدية مكرمية تحت 500 جنيه»*) وهصفّيلك الشاشة قدامك.\n` +
          `• **معالج «هدية سريعة 🎁»** في خطوتين (المناسبة + الميزانية).\n` +
          `• **توفير شحن ذكي** (بجمّعلك القطع من نفس الورشة) + **مقارنة ⚖️** + **مفضلة ❤️** + **نقاط وعروض مموّلة من المنصة**!`,
      };
    }
    if (isSupplierSurface) {
      return {
        kind: 'capabilities_overview',
        matchedTitleAr: 'إيه اللي عند شموسة في سوق الموردين',
        text:
          `تحت أمرك يا فندم في **${storeName || 'سوق الموردين'}** ☀️📦:\n` +
          `• **فلترة فورية للخامات** (خيوط، ريزن، أخشاب، خرز، جلود، شمع، إكسسوارات…) بأسعار القطاعي وشرائح الجملة.\n` +
          `• **مقارنة أسعار الموردين ⚖️** و**طلب عرض سعر مجمّع (RFQ)** بالواتساب في ثانية.\n` +
          `• وكمان أقدر أجاوبك على أي سؤال في **دليل الاستخدام** أو **حسابات وتكاليف الورشة**!`,
      };
    }
    return {
      kind: 'capabilities_overview',
      matchedTitleAr: 'كل قدرات شموسة ومنظومة الشمساوية',
      text:
        `عندي كل اللي ورشتك أو متجرك محتاجه من الألف للياء يا فندم ☀️🚀:\n` +
        `1. **حاسبة التكاليف والتسعير (65+ حرفة في 14 قسماً)** + ورشة دمج الحِرف + عزل الربح والهالك.\n` +
        `2. **التسويق الذكي (35 تخصص حرفة + 14 أسلوب تسويق + 22 مشكلة فنية)** — سريع وفوري أونلاين وأوفلاين بخصوصية وفصل تام لبياناتك.\n` +
        `3. **سوق الشمساوية + سوق الموردين + متجر خاص مجاني (+10 سمات) + رابط مستقل لكل منتج**.\n` +
        `4. **إدارة ERP + HR كاملة:** مخازن وخامات موحدة، أوامر تشغيل، خزائن وفواتير A4/PDF، أصول ثابتة وإهلاك وصيانة، «هلخصهالك 📋»، الوضع البسيط vs المحاسبي وميزان المراجعة وقفل الشهر، رواتب وسلف، كاشير POS 80مم وفروع، ونسخ احتياطي JSON.\n` +
        `5. **محافظ النقاط المنفصلة + نظام الدعوات الثلاثي + صفحتي الشخصية + طبلية عيلة الشمساوية + دليل الاستخدام والقاموس**.\n\n` +
        `اختار أي تفصيلة من دول واسألني فيها، أو **سجّل دلوقتي مجاناً**!`,
    };
  }

  // 3) موسوعة السلام والترحيب والمقابلة والوداع الشاملة (+380 عبارة في 11 باباً لكل الأماكن داخل وخارج المنظومة)
  const greetingSurfaceInfo = getGreetingFarewellSurfaceInfo(ctx, storeName, firstName);
  const greetingFarewellHit = matchGreetingsAndFarewellsEncyclopedia(rawQuery, greetingSurfaceInfo);
  if (greetingFarewellHit) {
    if (greetingFarewellHit.group === 'farewell') {
      return {
        kind: 'gratitude_farewell',
        matchedTitleAr: greetingFarewellHit.titleAr,
        text: greetingFarewellHit.reply,
        score: greetingFarewellHit.score,
      };
    }
    return {
      kind: 'greeting',
      matchedTitleAr: greetingFarewellHit.titleAr,
      text: `${greetingFarewellHit.reply}\n${pivot}`,
      score: greetingFarewellHit.score,
    };
  }

  // 4) موسوعة اللباقة والمجاملات والدعوات والشكر المصرية الشاملة (+400 عبارة وجذر بتحمّل الأخطاء الإملائية)
  const socialHit = matchEgyptianSocialEncyclopedia(rawQuery, who, {
    allowGreetings: !isInternalSurface,
    allowPlayful: !isInternalSurface,
    allowShortAck: !isInternalSurface,
  });

  if (socialHit) {
    if (socialHit.category === 'playful_banter') {
      const marketTwist = isMarketSurface
        ? `أفلترلك **${storeName || 'سوق الشمساوية'}** في ثانية، أختارلك هدية شيك على قد ميزانيتك، وأوفرلك في الشحن كمان!`
        : isSupplierSurface
        ? `أجيبلك أفضل خامات في **${storeName || 'سوق الموردين'}** بشرائح الجملة وأقارنلك أسعار الموردين في ثانية!`
        : `أحسبلك التكاليف بالملّي لأكتر من **65 حرفة**، أجهّزلك خطط تسويق احترافية، أرتّبلك مخزنك وخزنتك، أو أفلترلك **سوق الشمساوية**!`;

      return {
        kind: 'playful_banter',
        matchedTitleAr: socialHit.titleAr,
        text: `${socialHit.baseReply}\n${marketTwist}\n\n${pivot}`,
      };
    }

    const kindMap: Record<typeof socialHit.category, SharedShamousaMatch['kind']> = {
      blessing_with_saqr: 'blessing_with_saqr',
      blessing_prayer: 'blessing_prayer',
      gratitude: 'gratitude_farewell',
      farewell_polite: 'gratitude_farewell',
      admiration_work_quality: 'compliment',
      personal_compliment_shamousa: 'compliment',
      greetings_warm: 'greeting',
      apology_polite: 'apology_polite',
      acknowledgment_agreement: 'acknowledgment_agreement',
    };

    const tailLine =
      socialHit.category === 'farewell_polite' ? '' : `\n${pivot}`;

    return {
      kind: kindMap[socialHit.category],
      matchedTitleAr: socialHit.titleAr,
      text: `${socialHit.baseReply}${tailLine}`,
    };
  }

  return null;
}

// ============================================================================
// 2) البحث المباشر في سجل الـ 65+ حرفة والـ 14 قسماً رئيسياً من craftsRegistry.ts
// ============================================================================

const REGISTRY_CRAFT_ALIASES: Record<string, string[]> = {
  punch_needle: ['ابره النقاش', 'ابرة النقاش', 'بانش نيدل', 'punch needle'],
  tufting: ['تافتنج', 'تافت', 'مسدس التافت', 'tufting', 'سجاد تافت'],
  felting: ['لباد', 'اللباد', 'تلبيد', 'felting'],
  dyeing: ['صباغه', 'صباغة', 'تاي داي', 'tie dye', 'شيبوري'],
  sirma: ['سيرما', 'قصب', 'تطريز قصب', 'التلي'],
  wire_wrapping: ['تشكيل الاسلاك', 'سلك نحاس', 'واير رابنج', 'wire wrapping'],
  uv_resin: ['ريزن uv', 'يو في ريزن', 'ريزن اشعه'],
  polyester: ['بوليستر', 'صب بوليستر'],
  concrete: ['كونكريت', 'ترازو', 'تيرازو', 'اسمنت ابيض', 'اسمنت فني', 'concrete', 'terrazzo'],
  gypsum: ['جبس', 'جبس فني', 'كونكريت جبس'],
  jesmonite: ['جيسمونايت', 'جسمونايت', 'jesmonite'],
  silicone_molds: ['قوالب سيليكون', 'صناعه القوالب', 'قالب سيليكون'],
  perfumes: ['عطور', 'برفان', 'بخور', 'معطر', 'بلسم', 'وصفات نسبيه', 'مخمرية', 'مخمريه'],
  bamboo: ['بامبو', 'خوص', 'راتان', 'قش', 'سعف'],
  laser_cnc: ['ليزر', 'تقطيع ليزر', 'cnc', 'سي ان سي', 'راوتر خشب'],
  '3d_printing': ['طباعه ثلاثيه الابعاد', 'طباعة ثلاثية الأبعاد', '3d', 'ثري دي', 'فيلمنت', 'طباعة 3d'],
  blacksmith: ['حداده', 'حدادة', 'لحام', 'قطاعات حديد', 'فيرفورجيه'],
  silver: ['فضه', 'فضة', 'تشكيل فضة', 'عيار الفضة', 'نحاس'],
  lighting: ['نجف', 'اباجوره', 'اباجورة', 'وحدات اضاءة', 'اضاءه ديكور', 'إضاءة'],
  flowers: ['زهور مجففه', 'زهور طبيعيه', 'بوكيه ورد', 'تنسيق زهور'],
  screen_print: ['شبلونه', 'شبلونة', 'سلك سكرين', 'طباعه سلك سكرين'],
  htv: ['فينيل حراري', 'htv', 'طباعه فينيل'],
  sublimation: ['سبلميشن', 'تسامي', 'طباعه مجات', 'طباعة تيشيرتات', 'sublimation'],
  calligraphy: ['خط عربي', 'تذهيب', 'لوحات خط'],
  paper_origami: ['اوريجامي', 'أوريجامي', 'ورق فني', 'تجليد دفاتر', 'تجليد فني', 'عجينه الورق', 'كروت'],
  packaging: ['صناعه العلب', 'علب كرتون', 'اكياس ورقيه', 'استيكرات', 'تغليف هدايا'],
  sewing: ['خياطه', 'خياطة', 'تفصيل', 'باترون ملابس', 'تنجيد', 'كوشن', 'اسفنج وفايبر'],
  glass_mosaic: ['زجاج معشق', 'تيفاني', 'موزاييك', 'فسيفساء', 'معجون سقيه'],
  kilns: ['افران خزف', 'فرن حرق', 'تشغيل بالدفعات', 'حساب الكهرباء', 'اهلاك القوالب'],
  fusion: ['دمج المشغولات', 'دمج الحرف', 'حرقتين مع بعض', 'حرفتين مع بعض', 'منتج مركب'],
};

const GUIDE_STOP_WORDS = new Set([
  'في', 'من', 'على', 'الي', 'إلى', 'عن', 'مع', 'او', 'أو', 'و', 'يا', 'انا', 'انت', 'انتي',
  'هو', 'هي', 'ده', 'دي', 'دول', 'ايه', 'ازاي', 'كيف', 'هل', 'ممكن', 'عايز', 'عايزه', 'محتاج',
  'اعرف', 'يعني', 'معنى', 'معني', 'شرح', 'بتعمل', 'اعمل', 'بعمل', 'عندكم', 'عندك', 'فيها',
  'فيه', 'جوه', 'داخل', 'البرنامج', 'المنظومه', 'الشمساويه', 'شغل', 'حرفه', 'ورشه', 'مدعوم',
]);

function extractGuideTokens(norm: string): string[] {
  return norm
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !GUIDE_STOP_WORDS.has(t));
}

function stripAlPrefix(w: string): string {
  return w.length > 4 && w.startsWith('ال') ? w.slice(2) : w;
}

export function searchAllCraftsRegistryOffline(
  rawQuery: string,
  ctx: ShamousaSurfaceContext
): SharedShamousaMatch | null {
  const norm = normalizeSocialArabicText(rawQuery);
  if (!norm || norm.length < 3) return null;

  const tokens = extractGuideTokens(norm);
  if (tokens.length === 0) return null;

  if (/(كل\s*الحرف|قائمه\s*الحرف|الحرف\s*المدعومه|كام\s*حرفه|كام\s*ورشه|كام\s*قسم|ال\s*14\s*قسم|اقسام\s*الحرف)/.test(norm)) {
    const sectionsList = MAIN_SECTIONS.map((s) => `• **${s.nameAr}** — ${s.description}`).join('\n');
    return {
      kind: 'crafts_registry',
      matchedTitleAr: 'سجل الحِرف الكامل (14 قسماً و 65+ حرفة)',
      score: 100,
      text:
        `منظومة الشمساوية بتدعم حالياً **${SUB_CRAFTS_REGISTRY.length} حرفة فعلية متخصصة موزّعة على ${MAIN_SECTIONS.length} قسماً رئيسياً** 🎨🧮:\n` +
        `${sectionsList}\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** واختار أقسام ورشتك وتقدر كمان تدمج أي حرفتين مع بعض في **ورشة دمج المشغولات**!`
          : getContextPivotLine(ctx)),
    };
  }

  const stripAlWords = (s: string) => s.replace(/(^|\s)ال(?=[ء-ي]{3,})/g, '$1').trim();
  const normNoAl = stripAlWords(norm);

  let bestCraft: { craft: SubCraftDefinition; score: number } | null = null;
  for (const craft of SUB_CRAFTS_REGISTRY) {
    const cleanNameAr = craft.nameAr.replace(/[★*]/g, '').trim();
    const nameNorm = normalizeArabicKnowledgeText(cleanNameAr).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    const nameNormNoAl = stripAlWords(nameNorm);
    const descNorm = normalizeArabicKnowledgeText(craft.description);
    const catsNorm = normalizeArabicKnowledgeText((craft.sampleCategories || []).join(' '));
    let score = 0;

    if (nameNorm.length >= 3 && norm.includes(nameNorm)) score += 35;
    else if (nameNormNoAl.length >= 3 && normNoAl.includes(nameNormNoAl)) score += 34;

    for (const [aliasKey, terms] of Object.entries(REGISTRY_CRAFT_ALIASES)) {
      const idOrNameMatches =
        craft.id === aliasKey ||
        craft.id.includes(aliasKey) ||
        aliasKey.includes(craft.id) ||
        terms.some((tm) => nameNorm.includes(normalizeArabicKnowledgeText(tm)) || descNorm.includes(normalizeArabicKnowledgeText(tm)));
      if (idOrNameMatches) {
        for (const tm of terms) {
          const ntm = normalizeArabicKnowledgeText(tm);
          const ntmNoAl = stripAlWords(ntm);
          if (ntm.length >= 2 && (norm.includes(ntm) || (ntmNoAl.length >= 3 && normNoAl.includes(ntmNoAl)))) {
            score += 24;
            break;
          }
        }
      }
    }

    for (const tk of tokens) {
      const stem = stripAlPrefix(tk);
      if (stem.length < 3) continue;
      if (nameNorm.includes(stem)) score += 9;
      else if (catsNorm.includes(stem)) score += 5;
      else if (descNorm.includes(stem)) score += 3;
      else {
        // تحمّل الأخطاء الإملائية في اسم الحرفة نفسها
        const nameWords = nameNormNoAl.split(/\s+/);
        if (nameWords.some((nw) => nw.length >= 4 && socialLevenshtein(stem, nw) <= 1)) {
          score += 7;
        }
      }
    }

    if (!bestCraft || score > bestCraft.score) {
      bestCraft = { craft, score };
    }
  }

  if (bestCraft && bestCraft.score >= 12) {
    const c = bestCraft.craft;
    const section = MAIN_SECTIONS.find((s) => s.id === c.mainSectionId);
    const samples = (c.sampleCategories || []).slice(0, 6).join('، ');
    return {
      kind: 'crafts_registry',
      matchedTitleAr: `حرفة مدعومة: ${c.nameAr}`,
      score: bestCraft.score,
      text:
        `أيوه طبعاً يا فندم! حرفة **«${c.nameAr}»** مدعومة بالكامل جوه منظومة الشمساوية (ضمن **${section?.nameAr || 'سجل الحرف'}**) 🎨🧮:\n` +
        `• **آلية الحساب والتكاليف:** ${c.description}.\n` +
        (samples ? `• **أمثلة منتجات مدعومة:** ${samples}.\n` : '') +
        `• مربوطة تلقائياً بـ **منظومة الخامات الموحدة**، **أوامر التشغيل**، **المتجر الخاص**، و**سوق الشمساوية**!\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** وفعّل قسم «${c.nameAr}» في ورشتك فوراً!`
          : getContextPivotLine(ctx)),
    };
  }

  return null;
}

// ============================================================================
// 3) البحث في سجل التحديثات ونشأة المنظومة + المزايا الفعلية
// ============================================================================

export function searchChangelogAndSystemFeaturesOffline(
  rawQuery: string,
  ctx: ShamousaSurfaceContext
): SharedShamousaMatch | null {
  const norm = normalizeSocialArabicText(rawQuery);
  if (!norm || norm.length < 3) return null;

  if (/(سجل\s*التحديث|اخر\s*التحديث|تحديثات\s*(المنظومه|البرنامج|المنصه)|اصدارات|تطور\s*(المنظومه|الشمساويه)|الجديد\s*في\s*المنظومه|الاصدار\s*الحالي)/.test(norm)) {
    const latestThree = CHANGELOG_RELEASES.slice(0, 4)
      .map((r) => `• **الإصدار ${r.version} (${r.date}):** ${r.title}`)
      .join('\n');
    return {
      kind: 'changelog_history',
      matchedTitleAr: 'سجل التحديثات وتطور منظومة الشمساوية',
      text:
        `منظومة **الشمساوية** (إنتاج **الشمس كرافت** بالتعاون مع **تايجوس Tygos** — تأسيس **المهندس حسام بسيوني**) اتطورت خطوة بخطوة من حاسبة تكاليف هندسية إلى منظومة ERP + أسواق شاملة 🚀☀️:\n` +
        `${latestThree}\n` +
        `• **أحدث المراحل المكتملة:** إطلاق **سوق الشمساوية** و**سوق الموردين** بـ **شموسة الذكية** + **المقارنة ⚖️** + **محافظ النقاط المنفصلة (باقات / تسوق)** + **نظام الدعوات الثلاثي**!\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** واستمتع بكل الإصدارات والتحديثات المستمرة جوه حسابك!`
          : getContextPivotLine(ctx)),
    };
  }

  if (/(اصول\s*ثابت|الاصول\s*الثابت|اهلاك\s*(المعدات|الماكينات|الاجهزه|الاصول)|صيانه\s*(المعدات|الماكينات|الاجهزه)|جدول\s*الصيانه|ماكينات\s*الورشه|معدات\s*الورشه)/.test(norm)) {
    return {
      kind: 'system_feature',
      matchedTitleAr: 'إدارة الأصول الثابتة والمعدات والإهلاك والصيانة',
      text:
        `أيوه طبعاً! عندنا شاشة متخصصة لـ **الأصول الثابتة والمعدات (Fixed Assets)** جوه منظومة الشمساوية 🛠️☀️:\n` +
        `• بتسجّل فيها **ماكينات وأجهزة ومعدات الورشة أو المورّد** وتاريخ الشراء والقيمة.\n` +
        `• بتحسب **الإهلاك الدوري** تلقائياً وتتابع **مواعيد وجداول الصيانة** عشان ما تتفاجئش بعطل يوقف شغلك.\n` +
        `• وبتسمّع بدقة في حساباتك المالية وتكاليف التشغيل الحقيقية!\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** ونظّم معداتك وأصول ورشتك بكل احترافية!`
          : getContextPivotLine(ctx)),
    };
  }

  if (/(نسخ\s*احتياط|نسخه\s*احتياط|باك\s*اب|backup|json|تصدير\s*بيانات|حفظ\s*نسخه\s*من\s*البيانات)/.test(norm)) {
    return {
      kind: 'system_feature',
      matchedTitleAr: 'النسخ الاحتياطي اليدوي الشامل (JSON Export)',
      text:
        `أكيد! أمان بياناتك أولوية عندنا 🛡️☀️:\n` +
        `• بجانب **المزامنة السحابية التلقائية** والعمل **أونلاين وأوفلاين** مع فصل تام لبيانات كل حساب، عندك خيار **النسخ الاحتياطي اليدوي الشامل (JSON Export)** جوه إعدادات الورشة.\n` +
        `• بضغطة زر بتنزل نسخة كاملة ومنظمة من كل بيانات حسابك (خامات، منتجات، فواتير، عملاء، خزائن) على جهازك متوافقة 100% مع الهيكلة السحابية!\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** وبياناتك دايماً في أمان وتحت إيدك 100%!`
          : getContextPivotLine(ctx)),
    };
  }

  if (/(طباعه\s*a4|طباعه\s*فواتير|تصدير\s*pdf|pdf|ملف\s*pdf|طباعه\s*حراريه|ريسيت\s*80|فواتير\s*واتساب|مشاركه\s*الفاتوره)/.test(norm)) {
    return {
      kind: 'system_feature',
      matchedTitleAr: 'طباعة مستندات A4 وتصدير PDF وريسيت 80 مم ومشاركة واتساب',
      text:
        `موجودة بالكامل وبأعلى احترافية يا فندم 🖨️☀️:\n` +
        `• **مستندات A4 نظيفة ومستقلة** للطباعة المباشرة وتصدير **PDF وصور عالية الجودة** للفواتير وكشوف الحساب وأوامر التشغيل والرواتب.\n` +
        `• **ريسيت كاشير حراري 80 مم** مخصص للموردين ونقاط البيع (POS).\n` +
        `• **مشاركة الفاتورة كاملة نصاً بضغطة زر عبر واتساب** لعميلك بتفاصيل العربون والمتبقي!\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** واطبع فواتيرك باسم ورشتك ولوجو براندك!`
          : getContextPivotLine(ctx)),
    };
  }

  if (/(ميزان\s*المراجعه|القيود\s*المحاسبيه|قيد\s*محاسبي|سجل\s*التدقيق|audit|الوضع\s*البسيط|الوضع\s*المحاسبي|شجره\s*الحسابات)/.test(norm)) {
    return {
      kind: 'system_feature',
      matchedTitleAr: 'الوضع البسيط vs الوضع المحاسبي المتقدم وميزان المراجعة',
      text:
        `منظومة الشمساوية بتشتغل معاك بمرونة كاملة على قد حجم شغلك 📊☀️:\n` +
        `• **الوضع البسيط (وشاشة «هلخصهالك 📋»):** للورش والموردين اللي عايزين يشوفوا الفلوس والخزائن والمديونيات والمكسب بلغة مصرية سهلة بدون مصطلحات محاسبية معقدة.\n` +
        `• **الوضع المحاسبي المتقدم:** بيديك **القيود المحاسبية، ميزان المراجعة، تقارير الأرباح والخسائر، قفل الشهر، وسجل التدقيق (Audit Log)** لمتابعة كل حركة بالتفصيل!\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** واختار الوضع اللي يريّحك وتقدر تبدّل بينهم في أي وقت!`
          : getContextPivotLine(ctx)),
    };
  }

  if (/(رابط\s*منتج|صفحه\s*هبوط\s*للمنتج|استوديو\s*البانرات|بانرات|ارشيف\s*المنتجات|نبدا\s*ورشتنا|يومك\s*في\s*الورشه)/.test(norm)) {
    return {
      kind: 'system_feature',
      matchedTitleAr: 'أدوات العرض والنمو اليومي للورشة',
      text:
        `عندنا أدوات عملية مصممة تخلي شغلك اليومي منظم واحترافي من أول دقيقة ✨☀️:\n` +
        `• **«نبدأ ورشتنا» و«يومك في الورشة»:** شاشات إرشادية ذكية بتاخدك خطوة بخطوة في أول يوم وفي روتينك اليومي.\n` +
        `• **رابط هبوط مستقل لكل منتج (/product/:id):** تشاركه مباشرة في إعلاناتك أو واتساب مع **ضغط صور تلقائي** (حتى 3 صور للمنتج و6 لمعرض أعمالك).\n` +
        `• **أرشيف المنتجات واستوديو البانرات:** تحفظ فيه كل تسعيراتك ومنتجاتك وتجهّز بانرات متجرك بسهولة!\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** وجرّب كل الأدوات دي بنفسك فوراً!`
          : getContextPivotLine(ctx)),
    };
  }

  return null;
}

// ============================================================================
// 4) البحث الذكي المباشر في «دليل الاستخدام الرسمي» (12 قسماً) و«قاموس المصطلحات» (13 مصطلحاً)
// ============================================================================

export function searchUserGuideAndGlossaryOffline(
  rawQuery: string,
  ctx: ShamousaSurfaceContext
): SharedShamousaMatch | null {
  const norm = normalizeSocialArabicText(rawQuery);
  if (!norm || norm.length < 3) return null;

  const isAskingDefinition = /(يعني\s*ايه|معنى|معني|الفرق\s*بين|ايه\s*هو|ايه\s*هي|يعني\s*اي|مفهوم|مصطلح|قاموس)/.test(
    norm
  );
  const isAskingHowTo = /(ازاي|كيف|طريقه|خطوات|دليل\s*الاستخدام|اشرحلي|اعمل|اسجل|افتح|اقفل|اطبع|احول|استعيد|نسيت\s*كلمه)/.test(
    norm
  );
  const tokens = extractGuideTokens(norm);
  if (tokens.length === 0) return null;

  let bestGlossary: { item: GlossaryItem; score: number } | null = null;
  for (const item of GLOSSARY) {
    const termNorm = normalizeArabicKnowledgeText(item.term);
    const accNorm = normalizeArabicKnowledgeText(item.accountingTerm);
    const meaningNorm = normalizeArabicKnowledgeText(item.meaning);
    let score = 0;

    const cleanTerm = termNorm.replace(/\bx\b/g, '').trim();
    if (cleanTerm.length >= 3 && norm.includes(cleanTerm)) score += 18;
    if (accNorm.length >= 4 && norm.includes(accNorm)) score += 16;

    if (/(wac|متوسط\s*التكلفه|المرجح)/.test(norm) && termNorm.includes('متوسط')) score += 20;
    if (/(cogs|تكلفه\s*البضاعه\s*المباعه)/.test(norm) && accNorm.includes('cogs')) score += 20;
    if (/(قفل\s*الشهر|قفل\s*الفتره|اغلاق\s*الشهر)/.test(norm) && termNorm.includes('قفل')) score += 20;
    if (/(هامش\s*الربح\s*المعزول|عزل\s*الربح)/.test(norm) && termNorm.includes('المعزول')) score += 20;
    if (/(شرائح\s*الكميات|سعر\s*الشريحه|كميات\s*متدرجه)/.test(norm) && termNorm.includes('شرائح')) score += 20;
    if (/(مصفوفه\s*الظهور|ظهور\s*الملف)/.test(norm) && termNorm.includes('مصفوفه')) score += 20;
    if (/(ضغط\s*الصور)/.test(norm) && termNorm.includes('ضغط')) score += 20;
    if (/(عليه|له)\s*(و|ولا|يعني|للعميل|للمورد)/.test(norm) && (termNorm.includes('عليه') || termNorm.includes('له'))) {
      score += 18;
    }

    for (const tk of tokens) {
      const stem = stripAlPrefix(tk);
      if (stem.length < 3) continue;
      if (cleanTerm.includes(stem)) score += 6;
      else if (accNorm.includes(stem)) score += 5;
      else if (meaningNorm.includes(stem)) score += 2;
    }

    if (isAskingDefinition && score >= 6) score += 5;

    if (!bestGlossary || score > bestGlossary.score) {
      bestGlossary = { item, score };
    }
  }

  if (bestGlossary && bestGlossary.score >= 14) {
    const g = bestGlossary.item;
    return {
      kind: 'glossary',
      matchedTitleAr: `قاموس الشمساوية: ${g.term}`,
      text:
        `من **قاموس المصطلحات الحرفية والمحاسبية في الشمساوية** 📖☀️:\n` +
        `• **${g.term}** (${g.accountingTerm}):\n` +
        `${g.meaning}\n` +
        `• **مثال عملي:** ${g.example}\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** وهتلاقي «دليل الاستخدام والقاموس الكامل» مفتوح قدامك جوه حسابك في أي وقت!`
          : `تحب أساعدك في حاجة تانية أو أفلترلك المعروضات دلوقتي؟`),
    };
  }

  let bestGuide: { section: GuideSection; score: number } | null = null;
  for (const sec of GUIDE_SECTIONS) {
    const titleNorm = normalizeArabicKnowledgeText(sec.title);
    const summaryNorm = normalizeArabicKnowledgeText(sec.summary);
    const stepsBlob = normalizeArabicKnowledgeText(
      sec.steps.map((s) => `${s.title} ${s.description} ${s.tip || ''}`).join(' ')
    );

    let score = 0;

    if (/(نسيت\s*كلمه\s*المرور|استعاده\s*كلمه\s*المرور|تغيير\s*كلمه\s*المرور|كلمه\s*السر)/.test(norm) && sec.id === 'onboarding') score += 24;
    if (/(تحويل\s*بين\s*الخزن|التحويل\s*بين\s*الخزن|خزنه\s*انستاباي|فودافون\s*كاش)/.test(norm) && sec.id === 'treasury') score += 22;
    if (/(جرد\s*المخزن|كارت\s*الصنف|حد\s*الطلب\s*الادنى)/.test(norm) && sec.id === 'inventory') score += 22;
    if (/(مضاعفات\s*4|حساب\s*الفتلات|عزل\s*الربح)/.test(norm) && sec.id === 'calculator') score += 22;
    if (/(مرتجع|مرتجعات\s*الفاتوره|ضريبه\s*القيمه\s*المضافه|عربون\s*الفاتوره|دفعات\s*مقسطه)/.test(norm) && sec.id === 'invoices') score += 22;
    if (/(اغلاق\s*امر\s*التشغيل|معالج\s*اغلاق|استرجاع\s*المتبقي|هالك\s*التشغيل)/.test(norm) && sec.id === 'work_orders') score += 22;
    if (/(سلف|اقساط\s*السلف|كشف\s*الراتب|رواتب\s*الصناع|الموارد\s*البشريه)/.test(norm) && sec.id === 'hr') score += 22;
    if (/(قفل\s*الشهر|الارباح\s*والخسائر|كشوف\s*الحسابات\s*المستحقه)/.test(norm) && sec.id === 'reports') score += 22;
    if (/(صفحتي\s*الشخصيه|معرض\s*الاعمال|6\s*صور|مصفوفه\s*الظهور|معاينه\s*الصفحه)/.test(norm) && sec.id === 'personal_profile') score += 22;
    if (/(طبليه\s*العيله|الطبلية|عيله\s*الشمساويه|الشات\s*العائلي|المنتدى)/.test(norm) && sec.id === 'family_community') score += 22;
    if (/(هلخصهالك|تذكير\s*الواتساب|تذكير\s*لطيف|المتأخرين|المتاخرين)/.test(norm) && sec.id === 'executive_brief_guide') score += 24;
    if (/(ريسيت\s*80|طباعه\s*حراريه|80\s*مم|مرحلتين|تحويلات\s*المخازن|شجره\s*الفروع|امين\s*الفرع)/.test(norm) && sec.id === 'supplier_erp_branches') score += 24;
    if (/(دليل\s*الاستخدام|الشرح|اتعلم\s*البرنامج|اتدرب\s*على\s*البرنامج)/.test(norm) && sec.id === 'onboarding') score += 16;

    for (const tk of tokens) {
      const stem = stripAlPrefix(tk);
      if (stem.length < 3) continue;
      if (titleNorm.includes(stem)) score += 6;
      else if (summaryNorm.includes(stem)) score += 4;
      else if (stepsBlob.includes(stem)) score += 2.5;
    }

    if (isAskingHowTo && score >= 8) score += 5;

    if (!bestGuide || score > bestGuide.score) {
      bestGuide = { section: sec, score };
    }
  }

  if (bestGuide && bestGuide.score >= 18) {
    const s = bestGuide.section;
    const stepsText = s.steps
      .map((st) => `• **${st.title}:** ${st.description}${st.tip ? ` *(نصيحة: ${st.tip})*` : ''}`)
      .join('\n');
    return {
      kind: 'user_guide',
      matchedTitleAr: `دليل الاستخدام: ${s.title}`,
      text:
        `من **دليل الاستخدام الرسمي لمنظومة الشمساوية — ${s.title}** 📘☀️:\n` +
        `${s.summary}\n\n` +
        `${stepsText}\n\n` +
        (ctx === 'landing'
          ? `✨ **سجّل دلوقتي مجاناً** وكل خطوات دليل الاستخدام والقاموس والجولة التفاعلية هتكون قدامك جوه ورشتك!`
          : `تحب تسألني عن أي تفصيلة تانية أو أفلترلك المعروضات؟`),
    };
  }

  return null;
}
