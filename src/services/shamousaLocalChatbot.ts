import {
  MAIN_SECTIONS,
  SUB_CRAFTS_REGISTRY,
  MainSectionDefinition,
  SubCraftDefinition,
} from '../registry/craftsRegistry';
import {
  UNIFIED_CATEGORIES,
  UNIT_CHAINS,
  SEEDED_UNIFIED_MASTERS,
  SEEDED_UNIFIED_ALIASES,
  UnifiedCategoryDef,
  UnifiedMaterialMaster,
} from '../registry/unifiedMaterialsRegistry';

export interface ShamousaChatbotOption {
  id: string;
  label: string;
  queryText?: string;
  view?: string;
  intentKey?: string;
  triggerAI?: boolean;
  triggerFalcon?: boolean;
  action?: 'open_agenda' | 'new_appointment';
}

export interface ShamousaLocalChatbotResult {
  handled: boolean;
  reply: string;
  options?: ShamousaChatbotOption[];
  actionLink?: { label: string; view: string };
  matchedTopicId?: string;
  matchedKeyword?: string;
  confidence: 'high' | 'medium' | 'clarification' | 'none';
  handoffToFalcon?: boolean;
}

export interface ShamousaLocalRuleRecord {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  createdAt: number;
}

const LOCAL_RULES_STORAGE_KEY = 'alshams_shamousa_local_rules';

export function loadLocalShamousaRules(): ShamousaLocalRuleRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_RULES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalShamousaRule(rule: Omit<ShamousaLocalRuleRecord, 'id' | 'createdAt'>): ShamousaLocalRuleRecord {
  const existing = loadLocalShamousaRules();
  const next: ShamousaLocalRuleRecord = {
    id: `rule_${Date.now()}`,
    createdAt: Date.now(),
    ...rule,
  };
  try {
    localStorage.setItem(LOCAL_RULES_STORAGE_KEY, JSON.stringify([next, ...existing].slice(0, 60)));
  } catch {}
  return next;
}

export function normalizeArabicChatbotText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s#._+-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeArabic(text: string): string[] {
  const norm = normalizeArabicChatbotText(text);
  return norm
    .split(/\s+/)
    .map((t) => (t.length > 3 && t.startsWith('ال') ? t.slice(2) : t))
    .filter((t) => t.length >= 2);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyTokenMatches(queryToken: string, candidateToken: string): number {
  if (!queryToken || !candidateToken) return 0;
  if (queryToken === candidateToken) return 1.0;
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) {
    return Math.min(queryToken.length, candidateToken.length) >= 3 ? 0.85 : 0.55;
  }
  const maxLen = Math.max(queryToken.length, candidateToken.length);
  if (maxLen < 4) return 0;
  const dist = levenshteinDistance(queryToken, candidateToken);
  if (dist === 1) return 0.8;
  if (dist === 2 && maxLen >= 6) return 0.65;
  return 0;
}

interface KnowledgeTopic {
  id: string;
  title: string;
  keywords: string[];
  buildReply: (firstName: string, isSupplier: boolean) => {
    reply: string;
    options?: ShamousaChatbotOption[];
    actionLink?: { label: string; view: string };
  };
}

const CORE_KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  {
    id: 'greeting',
    title: 'الترحيب والقائمة الرئيسية',
    keywords: ['اهلا', 'سلام', 'السلام عليكم', 'صباح', 'مساء', 'ازيك', 'هاي', 'مرحبا', 'عامله ايه', 'اخبارك', 'ابدأ', 'البدايه', 'مساعده', 'قائمه', 'بتعملي ايه'],
    buildReply: (firstName, isSupplier) => ({
      reply: isSupplier
        ? `أهلاً بيك يا **${firstName}** ☀️ أنا شموسة، مديرة أعمالك وشات بوت المنظومة الفوري (أشتغل معاك مباشرة بدون نت أو انتظار).\nاختار تحب نراجع إيه دلوقتي:`
        : `أهلاً بيك يا **${firstName}** ☀️ أنا شموسة، مديرة أعمال ورشتك (شات بوت فوري عارف كل تفاصيل المنظومة والورش بدون نت).\nاختار أي موضوع من هنا وأنا أجيبهولك فوراً:`,
      options: isSupplier
        ? [
            { id: 'opt_sup_brief', label: 'هلخصهالك للموردين (المالية والفروع) 💰', intentKey: 'sup_full_brief' },
            { id: 'opt_sup_unified', label: 'منظومة الخامات الموحدة (TH / BD) 🏷️', queryText: 'اشرحي منظومة الخامات الموحدة' },
            { id: 'opt_sup_catalog', label: 'إدارة الكتالوج والأسعار والكميات 📦', view: 'supplier_catalog' },
            { id: 'opt_sup_market', label: 'طريقه التصدير لسوق الموردين 🚚', queryText: 'ازاي اصدر لسوق الموردين' },
          ]
        : [
            { id: 'opt_brief', label: 'هلخصهالك (الفلوس والمخزن) 💰', intentKey: 'full_brief' },
            { id: 'opt_unified', label: 'منظومة الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' },
            { id: 'opt_crafts', label: 'الورش ومعادلات التسعير 🧮', queryText: 'معادلات الورش والتسعير' },
            { id: 'opt_flow', label: 'دورة الأرشيف والكتالوج والمتجر 🛍️', queryText: 'ترتيب الأرشيف والكتالوج والمتجر' },
            { id: 'opt_agenda', label: 'مواعيد ومهام اليوم 📅', action: 'open_agenda' },
          ],
    }),
  },
  {
    id: 'identity',
    title: 'التعريف بشموسة ومنظومة الشمساوية',
    keywords: ['انتي مين', 'انت مين', 'مين برمجك', 'اسمك', 'شمس كرافت', 'صاحب البرنامج', 'مين عملك', 'حسام بسيوني'],
    buildReply: (firstName) => ({
      reply:
        `أنا **شموسة** 🌞، مديرة الأعمال والعمليات اليومية في **منظومة الشمساوية** التابعة لشركة **الشمس كرافت**، واللي أسسها وبرمجها **الباشمهندس حسام بسيوني**.\n` +
        `شغلي الأساسي أتابع معاك الخزائن، النواقص، الأوردرات، المواعيد، منظومة الخامات الموحدة، ومعادلات الورش فوراً وبضغطة زر! ولو احتجت تحليل صور أو دراسة سوق خارجية تقدر تستعين بمساعد الذكاء الاصطناعي أو **صقر الشمساوية 🦅**.`,
      options: [
        { id: 'opt_brief_id', label: 'عرض ملخص الورشة الآن 📋', intentKey: 'full_brief' },
        { id: 'opt_unified_id', label: 'شرح منظومة الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' },
      ],
    }),
  },
  {
    id: 'unified_materials_overview',
    title: 'منظومة الخامات الموحدة والأكواد',
    keywords: ['خامه موحده', 'خامات موحده', 'منظومه الخامات', 'سيريال', 'كود موحد', 'اكواد', 'ربط خامه', 'مسميات سوقيه', 'خرز مجدول', 'قطن مجدول', 'اضافه خامه', 'وحدات قياس', 'تغيير اسم خامه'],
    buildReply: (firstName, isSupplier) => ({
      reply:
        `🏷️ **منظومة الخامات الموحدة يا ${firstName}** بتوحّد كل خامات الموردين والورش بكود قياسي موحد من 4 مستويات (مثال: \`TH0001.01#B003\`):\n` +
        `1️⃣ **القسم (Prefix من حرفين):** مثل \`TH\` للحبال والخيوط، \`BD\` للخرز، \`CL\` للريزن والشموع والصب، \`WD\` للأخشاب، \`LT\` للجلود، \`MT\` للمعادن.\n` +
        `2️⃣ **الأساسي والمقاس:** الأساسي برقم 4 خانات (\`TH0001\`) ثم المقاس/السماكة بنقطة (\`TH0001.01\` للقطن 2مم، \`TH0001.02\` لـ 3مم).\n` +
        `3️⃣ **حل لخبطة الأسماء السوقية:** أي مسمى سوقي مختلف (زي كلمة **"خرز"** عند البعض بمعنى خيط مجدول بفتلتين \`AL00001+\`) بيتربط بالكود الموحد بدون ما يتلخبط مع خرز الزينة (\`BD\`).\n` +
        `4️⃣ **الصلاحيات:** تقدر تضيف خامة أو تعدل مسماها في **قائمتك الخاصة** فوراً، وبيتسجل إشعار تلقائي للسوبر أدمن لو حابب يعتمده على المنظومة كلها.\n` +
        `💡 تقدر تكتب لي الآن **اسم أي خامة أو اختصارها** (زي \`TH\` أو \`ريزن\` أو \`خرز\`) وأنا أطلعلك كودها فوراً!`,
      actionLink: {
        label: isSupplier ? 'فتح منظومة الخامات في كتالوجي 🏷️' : 'فتح منظومة الخامات الموحدة 🏷️',
        view: 'unified_materials',
      },
      options: [
        { id: 'um_codes', label: 'عرض قائمة الأكواد الـ 12 (TH, BD, WD...)', queryText: 'رموز اقسام الخامات الموحده' },
        { id: 'um_units', label: 'سلاسل وحدات القياس (ل1..ل8) ⚖️', queryText: 'سلاسل وحدات القياس' },
        { id: 'um_open', label: 'فتح منظومة الخامات الموحدة الآن 🏷️', view: 'unified_materials' },
      ],
    }),
  },
  {
    id: 'unified_prefixes',
    title: 'أكواد ورموز أقسام الخامات الموحدة (12 قسماً)',
    keywords: ['رموز اقسام', 'اقسام الخامات', 'اختصار', 'الاختصارات', 'th', 'bd', 'cl', 'wd', 'lt', 'mt', 'dc', 'ar', 'pk', 'pp', 'gl', 'ax'],
    buildReply: (firstName) => {
      const lines = UNIFIED_CATEGORIES.map(
        (c: UnifiedCategoryDef) => `• **${c.prefix}** — ${c.nameAr} (سلسلة وحدات: ${c.defaultUnitChain})`
      ).join('\n');
      return {
        reply: `📚 **أقسام الخامات الموحدة الـ 12 يا ${firstName}:**\n${lines}\n\nاكتبلي اسم أي خامة محددة أو الكود بتاعها (مثلاً: \`قطن مجدول\` أو \`ريزن\` أو \`TH0001\`) وأجيبلك بياناتها!`,
        options: [
          { id: 'up_open', label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
          { id: 'up_units', label: 'توضيح سلاسل الوحدات (ل1..ل8) ⚖️', queryText: 'سلاسل وحدات القياس' },
        ],
      };
    },
  },
  {
    id: 'unit_chains',
    title: 'سلاسل تحويل وحدات القياس (ل1..ل8)',
    keywords: ['سلاسل وحدات', 'وحدات القياس', 'تحويل الوحده', 'بكره', 'شله', 'جرام', 'لتر', 'كيلو', 'ل1', 'ل2', 'ل3', 'ل4'],
    buildReply: (firstName) => {
      const lines = UNIT_CHAINS.map(
        (u) => `• **${u.code} (${u.titleAr}):** المورد [${u.supplierFlow}] ⬅️ الفنان [${u.defaultPrimaryUnit} = ${u.defaultFactor} ${u.defaultSubUnit}]`
      ).join('\n');
      return {
        reply: `⚖️ **سلاسل تحويل الوحدات في المنظومة يا ${firstName}:**\n${lines}`,
        options: [
          { id: 'uc_um', label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
          { id: 'uc_mats', label: 'فتح مخزن خاماتي 🧶', view: 'materials' },
        ],
      };
    },
  },
  {
    id: 'product_lifecycle',
    title: 'دورة المنتج (الأرشيف -> الكتالوج -> متجري -> سوق الشمساوية)',
    keywords: ['ارشيف', 'الارشيف', 'كتالوج', 'الكتالوج', 'متجري', 'سوق الشمساويه', 'تصدير للمتجر', 'تصدير للسوق', 'ترتيب العمل', 'دوره المنتج', 'كارت الصنف', 'جاري نقل قاعده البيانات'],
    buildReply: (firstName) => ({
      reply:
        `🛍️ **الترتيب المعتمد للمنتجات في الورشة يا ${firstName}:**\n` +
        `1️⃣ **الخامات الموحدة / المخزن:** تسجيل خاماتك وأسعارها.\n` +
        `2️⃣ **حاسبة التكاليف (أو من صقر للحاسبة):** حساب المقاسات والهالك والمصنعية والسعر العادل.\n` +
        `3️⃣ **الأرشيف (كارت الصنف):** يُحفظ المنتج هنا كمرجع تشغيل وتكلفة.\n` +
        `4️⃣ **الكتالوج:** تحدد المنتجات الجاهزة وتضغط **تصدير للمتجر**.\n` +
        `5️⃣ **متجري ⬅️ سوق الشمساوية المركزي:** من داخل شاشة المتجر تختار المنتجات بعلامة الصح وتضغط **إرسال لسوق الشمساوية**، وبيوصل إشعار موافقة للسوبر أدمن لنشرها للجمهور.`,
      options: [
        { id: 'lc_calc', label: 'فتح حاسبة التكاليف 🧮', view: 'calculator' },
        { id: 'lc_arch', label: 'فتح الأرشيف 📋', view: 'archive' },
        { id: 'lc_cat', label: 'فتح الكتالوج ومتجري 🛍️', view: 'catalog' },
        { id: 'lc_mkt', label: 'زيارة سوق الشمساوية 🛍️', view: 'marketplace' },
      ],
    }),
  },
  {
    id: 'formulas_and_workshops',
    title: 'الورش الـ 50+ ومعادلات التسعير والهالك (ث1–ث6)',
    keywords: ['معادله', 'معادلات', 'هالك', 'هامش', 'ربح', 'تسعير', 'مصنعيه', 'ورشه', 'ورش', 'الورش', 'حاسبه', 'ث1', 'ث6', 'margin', 'markup'],
    buildReply: (firstName) => ({
      reply:
        `🧮 **ملخص معادلات الورش المصححة (14 قسماً / 50+ ورشة) يا ${firstName}:**\n` +
        `• **الهالك على الصافي (ث1):** \`الإجمالي = الصافي × (1 + ه)\`، ولو معروف فقد الشراء (ف) نحوله بـ \`هـ = ف / (1 − ف)\` بدون تكرار خصم الكفاءة مرتين.\n` +
        `• **المصنعية العادلة (ث3):** ساعات (التحضير + التنفيذ + التشطيب) × أجر الساعة × معامل الصعوبة + رسم التصميم (مع استبعاد ساعات التجفيف الهوائي من أجر العامل).\n` +
        `• **طاقة الأفران والماكينات والقوالب (ث4/ث5):** إضافة تكلفة الكهرباء/الدقيقة + إطفاء القوالب للقطعة + قسمة التكلفة على القطع السليمة بالدفعة.\n` +
        `• **سعر البيع (ث6):** هامش الربح من السعر (\`Margin: P = TC / (1 − m − c)\`) vs الزيادة على التكلفة (\`Markup: P = TC × (1 + u) / (1 − c)\`).\n\n` +
        `💡 اختار قسماً أو اكتب اسم ورشتك (مثل: **مكرمية، زجزاج، كليم، بانش، ريزن، صابون، شموع، ليزر، 3D، جلود، موزاييك**) وأشرحلك معادلتها فوراً:`,
      actionLink: { label: 'فتح حاسبة التكاليف التفاعلية 🧮', view: 'calculator' },
      options: [
        { id: 'fw_macrame', label: 'معادلة المكرمية والزجزاج والكليم 🧶', queryText: 'معادلة المكرمية' },
        { id: 'fw_resin', label: 'معادلة الريزن والشموع والصابون 🕯️', queryText: 'معادلة الريزن والصابون' },
        { id: 'fw_wood', label: 'الأخشاب والليزر و3D والجلود 🪵', queryText: 'معادلة الليزر والجلود' },
        { id: 'fw_list', label: 'عرض كل الأقسام الـ 14 للورش 📋', queryText: 'كل اقسام الورش' },
      ],
    }),
  },
  {
    id: 'all_14_sections',
    title: 'أقسام الورش الـ 14 في المنظومة',
    keywords: ['كل اقسام', 'اقسام الورش', 'الورش الجديده', 'ورش السوبر ادمن', '50 ورشه', '14 قسم'],
    buildReply: (firstName) => {
      const list = MAIN_SECTIONS.map((s: MainSectionDefinition) => `• ${s.nameAr}: ${s.description}`).join('\n');
      return {
        reply: `🏭 **الأقسام الـ 14 للورش داخل حاسبة الشمساوية يا ${firstName}:**\n${list}`,
        actionLink: { label: 'تجربة الورش في الحاسبة 🧮', view: 'calculator' },
        options: [
          { id: 's14_calc', label: 'فتح حاسبة التكاليف 🧮', view: 'calculator' },
          { id: 's14_um', label: 'منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
        ],
      };
    },
  },
  {
    id: 'invoices_and_payments',
    title: 'الفواتير والمبيعات وطرق السداد',
    keywords: ['فاتوره', 'فواتير', 'سداد', 'دفع', 'تحصيل', 'ضريبه', 'خصم', 'ايصال', 'مبيعات', 'اوردر', 'طلب'],
    buildReply: (firstName, isSupplier) => ({
      reply: isSupplier
        ? `🧾 **إدارة الفواتير والـ POS للموردين يا ${firstName}:**\nتقدر تصدر فواتير فورية من كاشير الفروع (` +
          `POS) مع دعم الكاش وإنستاباي والمحافظ والآجل، ومراجعة التوريدات اليومية من مركز قيادة الفروع.`
        : `🧾 **الفواتير والتحصيل في ورشتك يا ${firstName}:**\nأي طلبية من المبيعات أو المتجر بيتسجل فيها المدفوع والعربون والمتبقي، والعملاء اللي عدّى ميعاد سدادهم يظهروا لك هنا بتحذير وتذكير واتساب واتصال مباشر.`,
      options: [
        { id: 'inv_due', label: 'مين عليه فلوس بره الآن؟ 📥', intentKey: isSupplier ? 'sup_receivables' : 'tr_receivables' },
        { id: 'inv_open', label: isSupplier ? 'فتح الكاشير (POS) 🛒' : 'فتح سجل الفواتير 🧾', view: isSupplier ? 'supplier_pos' : 'invoices' },
      ],
    }),
  },
  {
    id: 'work_orders_guide',
    title: 'أوامر التشغيل والصنايعية',
    keywords: ['امر تشغيل', 'اوامر التشغيل', 'صنايعي', 'حرفيين', 'تصنيع', 'صرف خامات', 'استلام منتج', 'عمال'],
    buildReply: (firstName) => ({
      reply:
        `🔨 **أوامر التشغيل يا ${firstName}** بتربط بين المخزن والحرفيين على 3 خطوات:\n` +
        `1. فتح أمر التشغيل وتحديد المنتج والكمية والحرفي.\n` +
        `2. **صرف الخامات:** بتتخصم أوتوماتيك من رصيد مخزن الخامات.\n` +
        `3. **الاستلام:** إضافة المنتج التام للمخزون وحساب أجور الصنايعية في الخزينة أو حساب العامل.`,
      actionLink: { label: 'فتح أوامر التشغيل 🔨', view: 'work_orders' },
      options: [
        { id: 'wo_mat', label: 'فحص نواقص الخامات قبل الصرف 🧶', intentKey: 'wh_materials' },
        { id: 'wo_hr', label: 'شؤون الحرفيين والعمالة 👥', view: 'hr' },
      ],
    }),
  },
  {
    id: 'appointments_and_tasks',
    title: 'الأجندة والمواعيد والمهام اليومية',
    keywords: ['موعد', 'مواعيد', 'اجنده', 'تقويم', 'تسليم', 'مهام', 'ميعاد', 'تذكير'],
    buildReply: (firstName) => ({
      reply:
        `📅 **مواعيد وأجندة الورشة معاك يا ${firstName}!**\nتقدر تفتح تبويب **"المهام والأجندة"** فوق لمراجعة مهام النواقص والتشغيل ومواعيد تسليم العملاء، وإضافة أي موعد جديد مع زر حفظه في تقويم جوجل أو ملف \`.ics\`.`,
      options: [
        { id: 'ap_open', label: 'فتح تبويب المهام والأجندة 📅', action: 'open_agenda' },
        { id: 'ap_new', label: 'تسجيل موعد تسليم جديد ➕', action: 'new_appointment' },
      ],
    }),
  },
  {
    id: 'safety_hazards',
    title: 'تحذيرات السلامة المهنية في الورش',
    keywords: ['سلامه', 'تهويه', 'كمامه', 'صودا كاويه', 'naoh', 'حروق', 'سميه', 'كهرباء', 'عزل', 'تحذير', 'امان'],
    buildReply: (firstName) => ({
      reply:
        `🦺 **دليل السلامة المهنية المعتمد في المنظومة يا ${firstName}:**\n` +
        `• **الصابون البارد (NaOH):** يجب ارتداء نظارات أمان وقفازات مقاومة للكيماويات وإضافة الصودا للماء البارد تدريجياً (وليس العكس) في مكان جيد التهوية.\n` +
        `• **الريزن والبوليستر والـ UV:** التهوية القوية وكمامة أبخرة عضوية (A1/ABEK1) وقفازات نيتريل ومنع ملامسة الجلد.\n` +
        `• **وحدات الإضاءة والكهرباء:** عزل حراري وكهربائي معتمد وفحص عبر كهربائي مؤهل قبل التغليف.\n` +
        `• **الليزر والخشب والصنفرة:** شفاط أتربة وغبار وكمامة P2/N95 ونظارة حماية.`,
      options: [
        { id: 'sf_calc', label: 'فتح الحاسبة لاختيار الورشة 🧮', view: 'calculator' },
      ],
    }),
  },
];

function matchSpecificWorkshop(normQuery: string, tokens: string[], firstName: string): ShamousaLocalChatbotResult | null {
  let bestCraft: SubCraftDefinition | null = null;
  let bestScore = 0;

  for (const craft of SUB_CRAFTS_REGISTRY) {
    const normName = normalizeArabicChatbotText(craft.nameAr);
    const normDesc = normalizeArabicChatbotText(craft.description);
    const craftIdLower = craft.id.toLowerCase();
    let score = 0;

    if (normQuery.includes(normName) || normQuery.includes(craftIdLower)) {
      score += 10;
    } else {
      const nameTokens = tokenizeArabic(craft.nameAr);
      for (const qt of tokens) {
        for (const nt of nameTokens) {
          const m = fuzzyTokenMatches(qt, nt);
          if (m >= 0.8) score += m * 5;
        }
        if (normDesc.includes(qt) && qt.length >= 3) score += 1.5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCraft = craft;
    }
  }

  if (!bestCraft || bestScore < 4) return null;

  const section = MAIN_SECTIONS.find((s) => s.id === bestCraft!.mainSectionId);
  const relatedCrafts = SUB_CRAFTS_REGISTRY.filter(
    (c) => c.mainSectionId === bestCraft!.mainSectionId && c.id !== bestCraft!.id
  ).slice(0, 3);

  const formulaDetails: Record<string, string> = {
    macrame: '• المعادلة: طول الفتلة = الارتفاع × معامل العقدة (4.5 إلى 5.2) + الشراشيب + 20سم ربط، مع عدد فتلات من مضاعفات 4 + هالك 5% على الصافي.',
    zigzag: '• المعادلة: محيط البيضاوي بتقريب رامانوجان + المساحة الفيزيائية + استهلاك خيط المكوك ≈ 3.6× الطول + هالك 7%.',
    kilim: '• المعادلة: خيوط السداء (كثافة 3.5–4.5 خيط/سم) + طول هدب النول 40سم + نسبة الانكماش.',
    punch_needle: '• المعادلة: قماش كانفاه مخرم / دك قطن / كتان (بهوامش شد 10سم لكل جانب) + معامل استهلاك الخيط λ + غراء لاتكس خلفي + هالك 5%.',
    resin: '• المعادلة: حساب الحجم (سم³) × الكثافة ≈ 1.15 جم/سم³، مقسوم بنسبة الخلط (2:1 أو 3:1 مثلاً) + هالك صب 5% + إطفاء القالب السيليكون + تحذير تهوية وكمامة.',
    polyester_resin: '• تحذير سلامة: البوليستر يتطلب تهوية قوية جداً وكمامة أبخرة، وتُحسب نسبتي المصلب (1–2%) والمعجّل بدقة للوزن.',
    cold_process_soap: '• المعادلة: أرقام التصبن (SAP) لكل زيت لتحديد وزن الصودا الكاوية NaOH + نسبة السوبر فات + الماء + تحذير السلامة الكيميائية الصارم.',
    candles: '• المعادلة: وزن الشمع الصافي / (1 + نسبة العطر)، بحيث يتراوح العطر غالباً 6%–10% + تكلفة الفتيل والبرطمان واللصق.',
    laser_cnc: '• المعادلة: مساحة القطع والتعشيق للوح (توزيع الهالك) + دقائق تشغيل الماكينة × تكلفة الدقيقة (كهرباء + صيانة + استهلاك تيوب).',
    '3d_printing': '• المعادلة: وزن الفيلمنت (جرام) × الكثافة + معامل فشل الطباعة + ساعات الطابعة × (كهرباء + إهلاك).',
    leathercraft: '• المعادلة: مساحة الباترون الصافية مقسومة على عائد القص/التعشيق (ε) بدون تكرار الهالك + السوست والخيط المجدول وتقوية البطانة.',
    lighting_craft: '• تنبيه سلامة: إضافة مكونات الدواية والسلك والمفتاح مع ضرورة اختبار العزل الكهربائي والحراري بواسطة فني مؤهل.',
  };

  return {
    handled: true,
    confidence: bestScore >= 8 ? 'high' : 'medium',
    matchedTopicId: `workshop_${bestCraft.id}`,
    matchedKeyword: bestCraft.nameAr,
    reply:
      `🛠️ **ورشة "${bestCraft.nameAr}" يا ${firstName}**\n` +
      `• **القسم:** ${section?.nameAr || 'ورش المنظومة'}\n` +
      `• **حالة المحرك:** ${bestCraft.badge || 'مفعّل داخل الحاسبة'}\n` +
      `• **تفاصيل الحساب:** ${bestCraft.description}\n` +
      (formulaDetails[bestCraft.id] ? `${formulaDetails[bestCraft.id]}\n` : '') +
      `• **أمثلة منتجات:** ${bestCraft.sampleCategories.join('، ')}`,
    actionLink: { label: `حساب ${bestCraft.nameAr} في الحاسبة 🧮`, view: 'calculator' },
    options: [
      ...relatedCrafts.map((rc) => ({
        id: `rel_${rc.id}`,
        label: `معادلة ${rc.nameAr}`,
        queryText: `معادلة ${rc.nameAr}`,
      })),
      { id: 'w_open_calc', label: 'فتح حاسبة التكاليف الآن 🧮', view: 'calculator' },
    ],
  };
}

function matchUnifiedMaterialLocally(normQuery: string, tokens: string[], firstName: string): ShamousaLocalChatbotResult | null {
  // Check exact category prefix token e.g. TH, BD, WD, TH0001
  const codeMatch = normQuery.match(/\b(th|bd|cl|wd|lt|mt|dc|ar|pk|pp|gl|ax)(\d{0,4})\b/i);
  const hasMarketAlias = SEEDED_UNIFIED_ALIASES.filter((a) =>
    normQuery.includes(normalizeArabicChatbotText(a.aliasName))
  );

  // Explicit prefix only (2 letters like "th" or "كود bd")
  if (codeMatch && !codeMatch[2] && (tokens.length <= 4 || normQuery.includes('كود') || normQuery.includes('اختصار'))) {
    const prefix = codeMatch[1].toUpperCase();
    const cat = UNIFIED_CATEGORIES.find((c) => c.prefix === prefix);
    const itemsInCat = SEEDED_UNIFIED_MASTERS.filter((m) => m.prefix === prefix).slice(0, 6);
    if (cat) {
      const sampleLines = itemsInCat
        .map((m) => `• \`${m.code}\` — **${m.canonicalName}** (${m.unitChain})`)
        .join('\n');
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: `unified_cat_${prefix}`,
        matchedKeyword: prefix,
        reply:
          `🏷️ **قسم \`${cat.prefix}\` — ${cat.nameAr} يا ${firstName}:**\n` +
          `• **الوصف:** ${cat.description}\n` +
          `• **سلسلة الوحدات الافتراضية:** ${cat.defaultUnitChain}\n` +
          (sampleLines ? `\n**أبرز الخامات المسجلة بالقسم:**\n${sampleLines}` : ''),
        actionLink: { label: `تصفح قسم ${cat.prefix} في الخامات الموحدة 🏷️`, view: 'unified_materials' },
        options: [
          { id: 'um_cat_open', label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
          { id: 'um_cat_all', label: 'عرض باقي الأقسام الـ 12', queryText: 'رموز اقسام الخامات الموحده' },
        ],
      };
    }
  }

  // Exact master code e.g. TH0001
  if (codeMatch && codeMatch[2]) {
    const fullCode = `${codeMatch[1].toUpperCase()}${codeMatch[2].padStart(4, '0')}`;
    const exactMaster = SEEDED_UNIFIED_MASTERS.find((m) => m.code.toUpperCase() === fullCode);
    if (exactMaster) {
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: `unified_master_${exactMaster.code}`,
        matchedKeyword: exactMaster.code,
        reply:
          `🏷️ **بيانات الخامة الموحدة \`${exactMaster.code}\` يا ${firstName}:**\n` +
          `• **الاسم القياسي:** ${exactMaster.canonicalName}\n` +
          `• **القسم:** ${exactMaster.prefix} | **الوحدات:** ${exactMaster.unitChain}\n` +
          (exactMaster.artistAliases.length > 0 ? `• **مسميات شائعة عند الفنانين:** ${exactMaster.artistAliases.join('، ')}\n` : '') +
          (exactMaster.supplierAliases.length > 0 ? `• **مسميات شائعة عند الموردين:** ${exactMaster.supplierAliases.join('، ')}\n` : '') +
          (exactMaster.safetyNote ? `• **ملاحظة:** ${exactMaster.safetyNote}` : ''),
        actionLink: { label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
      };
    }
  }

  // Fuzzy search across master canonicalName, aliases, and disambiguation aliases (such as "خرز")
  const scoredMasters: Array<{ master: UnifiedMaterialMaster; score: number }> = [];
  const meaningfulTokens = tokens.filter(
    (t) => !['كود', 'سعر', 'خامه', 'خامات', 'ايه', 'ازاي', 'فين', 'ممكن', 'عشان', 'عاوز', 'عاوزه', 'بكام', 'موحد', 'موحده', 'منظومه'].includes(t)
  );

  if (meaningfulTokens.length === 0 && hasMarketAlias.length === 0) return null;

  for (const m of SEEDED_UNIFIED_MASTERS) {
    const searchPool = [
      m.canonicalName,
      ...m.artistAliases,
      ...m.supplierAliases,
    ]
      .map((s) => normalizeArabicChatbotText(s))
      .join(' ');

    let score = 0;
    for (const qt of meaningfulTokens) {
      if (searchPool.includes(qt)) {
        score += qt.length >= 4 ? 4 : 2.5;
      } else {
        for (const pt of tokenizeArabic(searchPool)) {
          const fm = fuzzyTokenMatches(qt, pt);
          if (fm >= 0.8) score += 2.2;
        }
      }
    }
    if (score >= 4) {
      scoredMasters.push({ master: m, score });
    }
  }

  if (scoredMasters.length === 0 && hasMarketAlias.length === 0) return null;

  scoredMasters.sort((a, b) => b.score - a.score);
  const topMasters = scoredMasters.slice(0, 5);

  const aliasNote =
    hasMarketAlias.length > 0
      ? `\n🔄 **تنبيه توحيد المسميات:** الكلمة السوقية (${hasMarketAlias.map((a) => `"${a.aliasName}" = ${a.aliasCode}`).join(' / ')}) مربوطة في المنظومة لعدم الخلط بين الموردين والفنانين.`
      : '';

  const masterLines = topMasters
    .map(
      ({ master }) =>
        `• \`${master.code}\` — **${master.canonicalName}** (${master.unitChain})` +
        (master.artistAliases[0] ? ` · *معروفة أيضاً بـ: ${master.artistAliases.slice(0, 2).join(' / ')}*` : '')
    )
    .join('\n');

  const firstFound = topMasters[0]?.master;
  return {
    handled: true,
    confidence: topMasters[0]?.score >= 6 ? 'high' : 'medium',
    matchedTopicId: 'unified_materials_search',
    matchedKeyword: meaningfulTokens.join(' '),
    reply:
      `🔍 **أقرب الخامات الموحدة لسؤالك يا ${firstName}:**\n` +
      (masterLines || 'تم رصد اسم سوقي مرتبط بمنظومة الخامات الموحدة:') +
      aliasNote +
      `\n\nتحب تفتح **منظومة الخامات الموحدة** لإضافتها لقائمتك أو تراجع أسعارها؟`,
    actionLink: { label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
    options: [
      ...(firstFound
        ? [{ id: 'um_code_detail', label: `تفاصيل الكود ${firstFound.code}`, queryText: firstFound.code }]
        : []),
      { id: 'um_open_btn', label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
      { id: 'um_ask_ai', label: 'بحث أسعار السوق عبر الذكاء المساعد 🤖', triggerAI: true },
    ],
  };
}

/**
 * Resolve ANY user query locally first (Zero AI / Zero Internet dependency)
 * Using Arabic normalization + nearest keyword matching + interactive Q&A choices.
 */
export function resolveShamousaLocalChatbot(
  rawQuery: string,
  options: {
    firstName: string;
    isSupplier: boolean;
  }
): ShamousaLocalChatbotResult {
  const { firstName, isSupplier } = options;
  const normQuery = normalizeArabicChatbotText(rawQuery);
  const tokens = tokenizeArabic(rawQuery);

  if (!normQuery) {
    return {
      handled: false,
      confidence: 'none',
      reply: '',
    };
  }

  // 1. If user explicitly asks for external AI / live market comparison / vision / Falcon
  const explicitExternalAI = /اسال صقر|حول لصقر|استشر صقر|منافسين|دراسة سوق|تحليل صورة|تحليل صوره|ذكاء اصطناعي/i.test(normQuery);
  if (explicitExternalAI) {
    return {
      handled: true,
      confidence: 'high',
      matchedTopicId: 'falcon_or_ai_handoff',
      reply:
        `🦅 يا **${firstName}**، المهام الخاصة بتحليل الصور أو دراسة السوق والمنافسين بيتخصص فيها **صقر الشمساوية** أو تقدر تستعين بمساعد الذكاء الاصطناعي فوراً من الأزرار دي:`,
      handoffToFalcon: true,
      options: [
        { id: 'opt_go_falcon', label: 'فتح صقر الشمساوية الآن 🦅', triggerFalcon: true },
        { id: 'opt_run_ai', label: 'اسأل الذكاء الاصطناعي المساعد هنا 🤖', triggerAI: true },
      ],
    };
  }

  // 2. Check Super Admin custom trained local rules first (highest priority)
  const localRules = loadLocalShamousaRules();
  for (const rule of localRules) {
    const matched = rule.keywords.some((kw) => {
      const nkw = normalizeArabicChatbotText(kw);
      return nkw && (normQuery.includes(nkw) || tokens.some((t) => fuzzyTokenMatches(t, nkw) >= 0.85));
    });
    if (matched) {
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: `local_rule_${rule.id}`,
        matchedKeyword: rule.title,
        reply: rule.answer,
        options: [
          { id: 'lr_menu', label: 'القائمة الرئيسية 📋', queryText: 'قائمة' },
        ],
      };
    }
  }

  // 3. Score CORE_KNOWLEDGE_TOPICS using exact + fuzzy nearest-keyword scoring
  const scoredTopics = CORE_KNOWLEDGE_TOPICS.map((topic) => {
    let score = 0;
    let matchedKw = '';
    for (const kw of topic.keywords) {
      const nkw = normalizeArabicChatbotText(kw);
      if (!nkw) continue;
      if (normQuery === nkw) {
        score += 12;
        matchedKw = kw;
      } else if (normQuery.includes(nkw)) {
        score += nkw.length >= 6 ? 8 : 5;
        matchedKw = matchedKw || kw;
      } else {
        const kwTokens = tokenizeArabic(nkw);
        for (const qt of tokens) {
          for (const kt of kwTokens) {
            const fm = fuzzyTokenMatches(qt, kt);
            if (fm >= 0.8) {
              score += fm * 3.5;
              matchedKw = matchedKw || kw;
            }
          }
        }
      }
    }
    return { topic, score, matchedKw };
  }).sort((a, b) => b.score - a.score);

  const topTopic = scoredTopics[0];
  const secondTopic = scoredTopics[1];

  // Strong specific workshop match (e.g. "مكرمية", "صابون بارد", "ليزر", "ريزن")
  const workshopMatch = matchSpecificWorkshop(normQuery, tokens, firstName);
  if (workshopMatch && workshopMatch.confidence === 'high') {
    return workshopMatch;
  }

  // Strong unified material lookup (e.g. "TH", "TH0001", "قطن مجدول", "خرز")
  const materialMatch = matchUnifiedMaterialLocally(normQuery, tokens, firstName);
  if (materialMatch && materialMatch.confidence === 'high' && (!topTopic || topTopic.score < 8)) {
    return materialMatch;
  }

  // Clear winner among Core Knowledge Topics
  if (topTopic && topTopic.score >= 5) {
    // If two close topics tie closely, ask clarifying Q&A with options!
    if (secondTopic && secondTopic.score >= 5 && topTopic.score - secondTopic.score <= 1.2 && topTopic.topic.id !== secondTopic.topic.id) {
      return {
        handled: true,
        confidence: 'clarification',
        matchedTopicId: 'clarify_topics',
        reply: `أقرب حاجة لكلامك يا **${firstName}** لقيتها في نقطتين.. تقصد أي واحدة فيهم؟`,
        options: [
          { id: `cl_1_${topTopic.topic.id}`, label: topTopic.topic.title, queryText: topTopic.topic.keywords[0] },
          { id: `cl_2_${secondTopic.topic.id}`, label: secondTopic.topic.title, queryText: secondTopic.topic.keywords[0] },
          { id: 'cl_ai', label: 'اسأل الذكاء الاصطناعي المساعد 🤖', triggerAI: true },
        ],
      };
    }

    const built = topTopic.topic.buildReply(firstName, isSupplier);
    return {
      handled: true,
      confidence: 'high',
      matchedTopicId: topTopic.topic.id,
      matchedKeyword: topTopic.matchedKw,
      reply: built.reply,
      options: built.options,
      actionLink: built.actionLink,
    };
  }

  if (workshopMatch) return workshopMatch;
  if (materialMatch) return materialMatch;

  // Medium nearest-keyword match -> guided clarification with choices!
  if (topTopic && topTopic.score >= 2.2) {
    const topSuggestions = scoredTopics
      .filter((s) => s.score >= 2.0)
      .slice(0, 3)
      .map((s) => ({
        id: `near_${s.topic.id}`,
        label: s.topic.title,
        queryText: s.topic.keywords[0],
      }));

    return {
      handled: true,
      confidence: 'clarification',
      matchedTopicId: 'nearest_keyword_clarify',
      matchedKeyword: topTopic.matchedKw,
      reply:
        `☀️ يا **${firstName}**، أقرب كلمة فهمتها من كلامك لها علاقة بـ **"${topTopic.topic.title}"**.\n` +
        `اختار الأقرب للي تقصده، أو استخدم المساعد الإضافي:`,
      options: [
        ...topSuggestions,
        { id: 'near_brief', label: 'هلخصهالك (الفلوس والمخزن) 📋', intentKey: isSupplier ? 'sup_full_brief' : 'full_brief' },
        { id: 'near_ai', label: 'استشارة الذكاء الاصطناعي المساعد 🤖', triggerAI: true },
      ],
    };
  }

  // Fallback for open-ended / general conversational questions without leaving user stuck:
  // Present guided chatbot menu + explicit optional AI Assistant trigger
  return {
    handled: true,
    confidence: 'none',
    matchedTopicId: 'guided_menu_fallback',
    reply:
      `☀️ يا **${firstName}**، عشان أجيبلك الإجابة الصح فوراً بدون لف ودوران، اختار موضوع سؤالك من القايمة دي (أو استعين بالذكاء الاصطناعي المساعد لسؤال حر):`,
    options: [
      { id: 'fb_brief', label: 'موقف الفلوس والخزائن والعملاء 💰', intentKey: isSupplier ? 'sup_full_brief' : 'full_brief' },
      { id: 'fb_um', label: 'منظومة الخامات الموحدة والأكواد 🏷️', queryText: 'منظومة الخامات الموحدة' },
      { id: 'fb_crafts', label: 'الورش ومعادلات الحاسبة 🧮', queryText: 'معادلات الورش والتسعير' },
      { id: 'fb_flow', label: 'الأرشيف والكتالوج والمتجر 🛍️', queryText: 'دورة المنتج والأرشيف' },
      { id: 'fb_ai', label: 'تحويل السؤال للذكاء الاصطناعي المساعد 🤖', triggerAI: true },
    ],
  };
}
