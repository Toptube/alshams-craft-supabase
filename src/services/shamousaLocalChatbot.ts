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
import {
  type UserExperienceMode,
  getPlatformExperienceModeConfig,
  getExperienceLabelFromConfig,
  isExperienceItemVisibleFromConfig,
} from '../types/experienceMode';
import { hasFeature, type AccountPackageQueryOptions } from '../types/subscriptions';

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

export type ShamousaFlowId =
  | 'flow_a_pricing'
  | 'flow_b_new_artist'
  | 'flow_c_why_losing'
  | 'flow_d_grow_sales'
  | 'flow_e_new_supplier'
  | 'flow_f_late_customer';

export interface ShamousaConversationState {
  activeFlow?: {
    flowId: ShamousaFlowId;
    step: number;
    data: Record<string, string>;
  };
  lastTopicId?: string;
  lastOptions?: ShamousaChatbotOption[];
  turnCount?: number;
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
  nextState?: ShamousaConversationState;
  isUnanswered?: boolean;
}

export interface ShamousaLocalRuleRecord {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  createdAt: number;
}

const LOCAL_RULES_STORAGE_KEY = 'alshams_shamousa_local_rules';
let serverSyncedRules: ShamousaLocalRuleRecord[] = [];

export function setServerShamousaRules(rules: ShamousaLocalRuleRecord[]): void {
  if (Array.isArray(rules)) {
    serverSyncedRules = rules.filter((r) => r && r.answer && Array.isArray(r.keywords));
  }
}

export function loadLocalShamousaRules(): ShamousaLocalRuleRecord[] {
  const local: ShamousaLocalRuleRecord[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_RULES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) local.push(...parsed);
    } catch {}
  }
  const seen = new Set<string>();
  const merged: ShamousaLocalRuleRecord[] = [];
  for (const r of [...serverSyncedRules, ...local]) {
    const key = r.id || `${r.title}_${r.answer.slice(0, 24)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(r);
    }
  }
  return merged;
}

export function saveLocalShamousaRule(
  rule: Omit<ShamousaLocalRuleRecord, 'id' | 'createdAt'>
): ShamousaLocalRuleRecord {
  const existing = loadLocalShamousaRules();
  const next: ShamousaLocalRuleRecord = {
    id: `rule_${Date.now()}`,
    createdAt: Date.now(),
    ...rule,
  };
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_RULES_STORAGE_KEY, JSON.stringify([next, ...existing].slice(0, 80)));
    }
  } catch {}
  return next;
}

const HINDI_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '٫': '.',
  '٬': '.',
};

export function normalizeArabicChatbotText(text: string): string {
  return String(text || '')
    .replace(/[٠-٩٫٬]/g, (ch) => HINDI_DIGITS_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // remove tashkeel & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Collapse Egyptian letter elongation e.g. ازاااي -> ازاي, عاااايز -> عايز
    .replace(/([\u0621-\u064A])\1{2,}/g, '$1')
    // Common dialect/spelling canonicalizations (Part 2 & Part 7 — Arabic-safe word boundaries)
    .replace(/(^|\s)(ريزين|رزن|ريسن)(?=\s|$)/g, '$1ريزن')
    .replace(/(^|\s)(مكروميه|ماكرميه|ماكراميه|مكرميا)(?=\s|$)/g, '$1مكرميه')
    .replace(/(^|\s)(كروشيا|كروشي)(?=\s|$)/g, '$1كروشيه')
    .replace(/(^|\s)(الارشييف|ارشييف)(?=\s|$)/g, '$1ارشيف')
    .replace(/(^|\s)(تساير|تسعيير|اسعرر)(?=\s|$)/g, '$1تسعير')
    .replace(/(^|\s)(هلاك)(?=\s|$)/g, '$1هالك')
    .replace(/(^|\s)(مصناعيه)(?=\s|$)/g, '$1مصنعيه')
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
  if (dist === 1) return 0.82;
  if (dist === 2 && maxLen >= 5) return 0.68;
  return 0;
}

function pickGreeting(firstName: string, isSupplier: boolean, turnCount = 0): string {
  const fallbackTitle = isSupplier ? 'أستاذ' : 'فنان';
  const name = firstName && firstName !== 'صديقي' ? firstName : fallbackTitle;
  const greetings = [
    `أهلاً بيك يا **${name}**، نوّرت الشمساوية ☀️`,
    `يا هلا يا **${name}** ☀️ قولّي أساعدك في إيه النهارده؟`,
    `منوّر يا **${name}** ☀️ تحب نبدأ منين؟`,
  ];
  return greetings[Math.abs(turnCount) % greetings.length];
}

export const SHAMOUSA_PRIVACY_REFUSAL_REPLY =
  'ده من بيانات ناس تانية، وأنا ملتزمة أحافظ على خصوصية الكل زي ما بحافظ على خصوصيتك 💛.\n' +
  'أقدر أساعدك في بياناتك إنت، أو أقولك المعلومة العامة من منظومة الخامات الموحدة.\nتحب نبدأ بأي واحد؟';

const SHAMOUSA_PRIVACY_OPTIONS: ShamousaChatbotOption[] = [
  { id: 'priv_my_data', label: 'بيانات ورشتي (هلخصهالك) 📋', intentKey: 'full_brief' },
  { id: 'priv_unified', label: 'منظومة الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' },
  { id: 'priv_menu', label: 'القائمة الرئيسية ☀️', queryText: 'قائمة' },
];

/**
 * Part 3 — Strict Privacy Guard (NEVER bypassed)
 */
export function isCrossTenantOrSecretPrivacyQuery(rawQuery: string): boolean {
  const norm = normalizeArabicChatbotText(rawQuery);
  if (!norm) return false;

  // Allow meta-policy question "هل ينفع الفنان يشوف اسعار ورشة تانية" to be answered directly by Part 9 Q&A
  if (/^هل\s*(ينفع|ممكن|يحق|اقدر)/.test(norm) && /يشوف|تشوف|يشوفوا/.test(norm)) {
    return false;
  }

  // Asking about another person/workshop/supplier's private prices, sales, profit, clients, stock
  if (/(^|\s)(فلان|فلانه|علانه|زميلي|زميلتي|جارتي|صاحبي|صاحبتي|المنافس)(?=\s|$)/.test(norm) &&
      /(بيشتري|بتشتري|بيبيع|بتبيع|بكام|سعر|شراء|مبيعات|ربح|ارباح|عملاء|عملا|رصيد|خزنه|خزينه|خامات|بيانات|مكسب)/.test(norm)) {
    return true;
  }

  // Asking about "ورشة أ / ب / تانية / غيري / الناس التانية / كل الورش / اكتر ورشة بتبيع"
  if (/(ورشه\s*(تانيه|ثانيه|اخري|غيري|الغير|ا|ب|ج|فلان|احمد|محمد|ساره|مريم|نور)|مورد\s*(تاني|ثاني|غيري)|الورش\s*التانيه|اكتر\s*ورشه\s*(بتبيع|بتكسب|مبيعا)|مين\s*(اكتر|اكبر)\s*ورشه|مبيعات\s*الورش|ارباح\s*الورش|عملاء\s*ورشه|خامات\s*ورشه\s*(تانيه|غيري|ا|ب)|بيانات\s*ورشه\s*(تانيه|غيري|ا|ب|اخري)|اسعار\s*شراء\s*(الورش|الموردين|ورشه\s*تانيه|فلان))/.test(norm)) {
    return true;
  }

  // Asking about system secrets, API keys, source code, passwords
  if (/(مفاتيح\s*(السر|السيرفر|التشغيل|api)|كود\s*المنظومه\s*البرمجي|السورس\s*كود|سورس\s*كود|كلمه\s*سر\s*(الادمن|السوبر|مستخدم|ورشه)|باسورد\s*(الادمن|ورشه|حد)|اسرار\s*السيرفر|api\s*key|secret\s*key|service_role)/.test(norm)) {
    return true;
  }

  return false;
}

/**
 * Part 8 — Off-Topic Redirection (politics, religion, marriage, personal life, sports)
 */
function isOffTopicQuery(normQuery: string): boolean {
  return /(^|\s)(اتجوز|اتزوج|جواز|زواج|عريس|عروسه|خطوبه|حبني|بتحبيني|حبيبي|سياسه|السياسه|انتخابات|رئيس|حكومه|حزب|ماتش|كوره|الاهلي|الزمالك|فتوي|حلال\s*ولا\s*حرام|دين|الطقس|الجو\s*ايه|طبخ|اكله|مكرونه\s*بالبشاميل|نكته|احكيلي\s*نكته)(?=\s|$)/.test(
    normQuery
  );
}

/**
 * Part 1 & Part 8 — Angry or frustrated user empathy
 */
function isFrustratedOrAngryQuery(normQuery: string): boolean {
  return /(^|\s)(متضايق|متضايقه|زهقت|زهقان|زعلان|قرفان|مخنوق|البرنامج\s*وحش|الموقع\s*وحش|زفت|بايظ\s*خالص|مش\s*فاهم\s*حاجه|تعبت\s*من|كارثه|غضبان)(?=\s|$)/.test(
    normQuery
  );
}

/**
 * Part 8 — Single-word ambiguous topic disambiguation (e.g. "ريزن")
 */
const SINGLE_WORD_DISAMBIGUATION: Record<
  string,
  { label: string; craftQuery: string; safetyQuery: string }
> = {
  ريزن: { label: 'الريزن', craftQuery: 'عايز اسعر منتج ريزن', safetyQuery: 'امان الريزن والتهويه' },
  مكرميه: { label: 'المكرمية', craftQuery: 'عايز اسعر قطعة مكرمية', safetyQuery: 'معادلة المكرمية' },
  صابون: { label: 'الصابون البارد', craftQuery: 'عايز اسعر صابون بارد', safetyQuery: 'تحذيرات امان الصابون البارد' },
  شمع: { label: 'الشموع', craftQuery: 'عايز اسعر شموع', safetyQuery: 'معادلة الشموع' },
  شموع: { label: 'الشموع', craftQuery: 'عايز اسعر شموع', safetyQuery: 'معادلة الشموع' },
  خشب: { label: 'الأخشاب والليزر', craftQuery: 'عايز اسعر منتج خشب', safetyQuery: 'امان الليزر والخشب' },
  جلد: { label: 'الجلود الطبيعية', craftQuery: 'عايز اسعر منتج جلد', safetyQuery: 'معادلة الجلود' },
  خيط: { label: 'الخيوط والحبال', craftQuery: 'عايز اسعر قطعة مكرمية', safetyQuery: 'رموز اقسام الخامات الموحده' },
  خرز: { label: 'الخرز والمسميات الدارجة', craftQuery: 'عايز اسعر منتج خرز', safetyQuery: 'المسميات الدارجة للخرز' },
};

/**
 * Part 6 — Guided Multi-Turn Flows (تدفق أ – تدفق و)
 */
function detectCraftInQuery(normQuery: string): string | null {
  if (/مكرميه|كروشيه|تطريز|كليم|تريكو|زجزاج|بانش/.test(normQuery)) return 'مكرمية / كروشيه / تطريز';
  if (/ريزن|شمع|شموع|صابون|جسمونات|كونكريت/.test(normQuery)) return 'ريزن / شموع / صابون';
  if (/خشب|ليزر|3d|طباعه\s*ثلاثيه|cnc|نجاره/.test(normQuery)) return 'خشب / ليزر / 3D';
  if (/جلد|جلود|فخار|خزف|موزاييك|اكسسوار|خرز/.test(normQuery)) return 'جلود / خرز / حرفة يدوية';
  return null;
}

function handleActiveFlowStep(
  rawQuery: string,
  normQuery: string,
  state: ShamousaConversationState,
  firstName: string,
  isSupplier: boolean
): ShamousaLocalChatbotResult | null {
  const flow = state.activeFlow;
  if (!flow) return null;

  // Exit flow if user says cancel/back/menu
  if (/^(رجوع|الغاء|خلاص|قائمه|القائمه|ابدا\s*من\s*جديد)$/.test(normQuery)) {
    return null;
  }

  // Flow A: "عايز أسعّر منتج" (س1: الحرفة -> س2: الخامات مسجلة؟ -> س3: هتبيعه فين؟ -> الخلاصة)
  if (flow.flowId === 'flow_a_pricing') {
    if (flow.step === 1) {
      let chosenCraft = detectCraftInQuery(normQuery);
      if (!chosenCraft) {
        if (/^(1|اول|الاول)$/.test(normQuery)) chosenCraft = 'مكرمية / كروشيه / تطريز';
        else if (/^(2|تاني|الثاني)$/.test(normQuery)) chosenCraft = 'ريزن / شموع / صابون';
        else if (/^(3|تالت|الثالث)$/.test(normQuery)) chosenCraft = 'خشب / ليزر / 3D';
        else if (/^(4|رابع|الرابع|حرفه\s*تانيه|اخري)$/.test(normQuery)) chosenCraft = 'حرفة يدوية خاصة';
      }
      if (!chosenCraft) return null;

      const options: ShamousaChatbotOption[] = [
        { id: 'fa_s2_yes', label: '1) أيوه، مسجلة جاهزة ✅', queryText: 'أيوه مسجلة' },
        { id: 'fa_s2_no', label: '2) لأ، أسجّلها الأول 📦', queryText: 'لأ أسجلها الأول' },
        { id: 'fa_s2_unsure', label: '3) مش متأكد 🔍', queryText: 'مش متأكد' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'flow_a_step2',
        reply:
          `ماشي يا **${firstName}**، نظبّط تسعير **${chosenCraft}** سوا 👏\n` +
          `قولّي: خامات القطعة دي مسجّلة عندك في مخزن الورشة بأسعارها ولا لسه؟`,
        options,
        nextState: {
          activeFlow: { flowId: 'flow_a_pricing', step: 2, data: { ...flow.data, craft: chosenCraft } },
          lastTopicId: 'flow_a_step2',
          lastOptions: options,
          turnCount: (state.turnCount || 0) + 1,
        },
      };
    }

    if (flow.step === 2) {
      let matsStatus = '';
      if (/^(1|ايوه|اه|نعم|مسجله|جاهزه)/.test(normQuery)) matsStatus = 'مسجلة';
      else if (/^(2|لا|لسه|اسجلها|مش\s*مسجله)/.test(normQuery)) matsStatus = 'تحتاج تسجيل';
      else if (/^(3|مش\s*متاكد|معرفش|مش\s*عارف)/.test(normQuery)) matsStatus = 'غير متأكد';
      else return null;

      if (matsStatus === 'تحتاج تسجيل') {
        const options: ShamousaChatbotOption[] = [
          { id: 'fa_open_um', label: '1) افتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
          { id: 'fa_open_mats', label: '2) افتح خاماتي 🧶', view: 'materials' },
          { id: 'fa_cont_s3', label: '3) كمّل معايا خطوة البيع دلوقتي 🛍️', queryText: 'متجري' },
        ];
        return {
          handled: true,
          confidence: 'high',
          matchedTopicId: 'flow_a_step2_add_mats',
          reply:
            `كده إنت ماشي صح يا **${firstName}** 👍\n` +
            `الأفضل تضيف خاماتك الأول من **منظومة الخامات الموحدة** أو **خاماتي** عشان الحاسبة تسحب الأسعار أوتوماتيك.\n` +
            `ولو حابب نكمّل خطوة تسعير **${flow.data.craft || 'القطعة'}** دلوقتي، قولّي ناوي تبيعها فين؟`,
          actionLink: { label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
          options,
          nextState: {
            activeFlow: { flowId: 'flow_a_pricing', step: 3, data: { ...flow.data, matsStatus } },
            lastTopicId: 'flow_a_step2_add_mats',
            lastOptions: options,
            turnCount: (state.turnCount || 0) + 1,
          },
        };
      }

      const options: ShamousaChatbotOption[] = [
        { id: 'fa_s3_store', label: '1) متجري الخاص 🏪', queryText: 'متجري' },
        { id: 'fa_s3_market', label: '2) سوق الشمساوية 🛍️', queryText: 'السوق' },
        { id: 'fa_s3_wh', label: '3) جملة لعميل 📦', queryText: 'جملة لعميل' },
        { id: 'fa_s3_expo', label: '4) معرض / بازار 🎪', queryText: 'معرض' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'flow_a_step3',
        reply:
          (matsStatus === 'غير متأكد'
            ? `ولا يهمك، تقدر تراجع خاماتك في ثانية من شاشة **خاماتي**.\n`
            : `هايل أوي يا **${firstName}**، كده الحساب هيطلع مظبوط بالملي 👌\n`) +
          `آخر سؤال عشان السعر يطلع مضبوط: هتبيع القطعة دي فين؟`,
        options,
        nextState: {
          activeFlow: { flowId: 'flow_a_pricing', step: 3, data: { ...flow.data, matsStatus } },
          lastTopicId: 'flow_a_step3',
          lastOptions: options,
          turnCount: (state.turnCount || 0) + 1,
        },
      };
    }

    if (flow.step === 3) {
      let channel = '';
      if (/^(1|متجري|متجر|ستور)/.test(normQuery)) channel = 'متجرك الخاص';
      else if (/^(2|السوق|سوق)/.test(normQuery)) channel = 'سوق الشمساوية';
      else if (/^(3|جمله|عميل)/.test(normQuery)) channel = 'بيع جملة لعميل';
      else if (/^(4|معرض|بازار)/.test(normQuery)) channel = 'معرض / بازار';
      else return null;

      const options: ShamousaChatbotOption[] = [
        { id: 'fa_done_calc', label: '1) افتح حاسبة التكاليف الآن 🧮', view: 'calculator' },
        { id: 'fa_done_falcon', label: '2) خلّي صقر يحسبها لي 🦅', triggerFalcon: true },
        { id: 'fa_done_waste', label: '3) راجع قاعدة الهالك والمصنعية 📏', queryText: 'الهالك بيتحسب ازاي' },
        { id: 'fa_done_margin', label: '4) الفرق بين الزيادة والهامش 📊', queryText: 'الفرق بين الهامش والزيادة' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'flow_a_complete',
        reply:
          `تمام يا **${firstName}**، جاهزين نسعّر **${flow.data.craft || 'القطعة'}** للبيع في **${channel}** 🧮\n` +
          `افتح **حاسبة التكاليف** وخلّي بالك من 4 قواعد ذهبية:\n` +
          `• **الهالك** يتحسب على الاستهلاك الصافي مرة واحدة بس.\n` +
          `• **المصنعية** على ساعات الشغل الفعلية بس (من غير وقت التجفيف/التصلب).\n` +
          `• ضيف **التغليف والشحن** و**العمولة**${channel === 'سوق الشمساوية' ? ' (عمولة السوق)' : ''} عشان صافي ربحك يطلع حقيقي.`,
        actionLink: { label: 'فتح حاسبة التكاليف الآن 🧮', view: 'calculator' },
        options,
        nextState: {
          activeFlow: undefined,
          lastTopicId: 'flow_a_complete',
          lastOptions: options,
          turnCount: (state.turnCount || 0) + 1,
        },
      };
    }
  }

  // Flow B: "مش عارف أبدأ منين" (فنان جديد)
  if (flow.flowId === 'flow_b_new_artist' && flow.step === 1) {
    if (/^(1|2|3|ايوه|اه|لا|لسه|شويه|عندي)/.test(normQuery)) {
      const hasNone = /^(2|لا|لسه)/.test(normQuery);
      const options: ShamousaChatbotOption[] = [
        { id: 'fb_step_um', label: '1) افتح الخامات الموحدة 🏷️', view: 'unified_materials' },
        { id: 'fb_step_calc', label: '2) احسب أول منتج في الحاسبة 🧮', view: 'calculator' },
        { id: 'fb_step_arch', label: '3) شوف الأرشيف والكتالوج 🛍️', queryText: 'دورة المنتج والأرشيف' },
        { id: 'fb_step_store', label: '4) جهّز متجري الخاص 🏪', view: 'my_store' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'flow_b_plan',
        reply:
          `كده إنت ماشي صح يا **${firstName}** ☀️ دي خريطة البداية في 5 خطوات سهلة:\n` +
          (hasNone
            ? `1️⃣ ابدأ بتصفح **الخامات الموحدة** واختار اللي هتشتغل بيه (بأسعار السوق الاسترشادية).\n`
            : `1️⃣ سجّل خاماتك الحالية وأسعارها في **خاماتي** من المنظومة الموحدة.\n`) +
          `2️⃣ احسب أول منتج في **الحاسبة** ⬅️ 3️⃣ احفظه في **الأرشيف** ⬅️ 4️⃣ انقله لـ **الكتالوج** ثم **متجرك** ⬅️ 5️⃣ جرّب تشوفه بعيون العميل!`,
        actionLink: { label: 'ابدأ بمنظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
        options,
        nextState: {
          activeFlow: undefined,
          lastTopicId: 'flow_b_plan',
          lastOptions: options,
          turnCount: (state.turnCount || 0) + 1,
        },
      };
    }
  }

  // Flow C: "ليه مش بكسب"
  if (flow.flowId === 'flow_c_why_losing') {
    if (flow.step === 1) {
      const options: ShamousaChatbotOption[] = [
        { id: 'fc_s2_yes', label: '1) أيوه بحسبهم ✅', queryText: 'أيوه بحسب الهالك والمصنعية' },
        { id: 'fc_s2_no', label: '2) لأ مش بحسبهم 😅', queryText: 'لأ مش بحسبهم' },
        { id: 'fc_s2_unsure', label: '3) مش فاهم بيتحسبوا إزاي 🤔', queryText: 'مش فاهم الهالك والمصنعية' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'flow_c_step2',
        reply: `تمام يا **${firstName}**، خلّينا نكشف السبب سوا.\nوانت بتسعّر **${rawQuery.trim()}**، هل بتحسب الهالك ومصنعية إيدك ووقت الشغل في التكلفة؟`,
        options,
        nextState: {
          activeFlow: { flowId: 'flow_c_why_losing', step: 2, data: { product: rawQuery.trim() } },
          lastTopicId: 'flow_c_step2',
          lastOptions: options,
          turnCount: (state.turnCount || 0) + 1,
        },
      };
    }
    if (flow.step === 2) {
      const options: ShamousaChatbotOption[] = [
        { id: 'fc_diag_calc', label: '1) راجع حسابات منتج في الحاسبة 🧮', view: 'calculator' },
        { id: 'fc_diag_mats', label: '2) حدّث أسعار خاماتي 🧶', view: 'materials' },
        { id: 'fc_diag_margin', label: '3) الفرق بين الزيادة والهامش 📊', queryText: 'الفرق بين الهامش والزيادة' },
        { id: 'fc_diag_waste', label: '4) افهم الهالك والمصنعية 📏', queryText: 'الهالك بيتحسب ازاي' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 't20_why_losing',
        reply:
          `وصلت للصورة يا **${firstName}** 💡 غالباً الربح بيقل بسبب واحدة من 5 حاجات:\n` +
          `1) الهالك مش محسوب أو محسوب غلط، 2) المصنعية ناقصة، 3) الشحن والتغليف منسيين، 4) عمولة المنصة أو الضريبة مش مضافة، 5) سعر الخامة قديم.\n` +
          `تعالى نراجع منتجك سوا في الحاسبة ونظبّطه فوراً:`,
        actionLink: { label: 'فتح حاسبة التكاليف للمراجعة 🧮', view: 'calculator' },
        options,
        nextState: {
          activeFlow: undefined,
          lastTopicId: 't20_why_losing',
          lastOptions: options,
          turnCount: (state.turnCount || 0) + 1,
        },
      };
    }
  }

  // Flow E: "مورد جديد"
  if (flow.flowId === 'flow_e_new_supplier' && flow.step === 1) {
    if (/^(1|2|3|واحد|اكتر|فروع|مخزن|معارض)/.test(normQuery)) {
      const options: ShamousaChatbotOption[] = [
        { id: 'fe_hub', label: '1) عرّف المخزن والفروع 🌿', view: 'supplier_erp_hub' },
        { id: 'fe_um', label: '2) ضيف الأصناف من الخامات الموحدة 🏷️', view: 'unified_materials' },
        { id: 'fe_cat', label: '3) اضبط شرائح الأسعار 📦', view: 'supplier_catalog' },
        { id: 'fe_pos', label: '4) افتح الكاشير 80 مم 🛒', view: 'supplier_pos' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'flow_e_plan',
        reply:
          `ممتاز يا **${firstName}** ☀️ خطة تشغيل متجرك كمورد في 4 خطوات سريعة:\n` +
          `1️⃣ عرّف المخزن الرئيسي وفروعك ⬅️ 2️⃣ اربط أصنافك بـ **الخامات الموحدة** ⬅️ 3️⃣ اضبط **شرائح الأسعار** (قطاعي/نص جملة/جملة) ⬅️ 4️⃣ افتح **الكاشير 80 مم** وابدأ البيع فوراً!`,
        actionLink: { label: 'فتح مركز قيادة الفروع 🌿', view: 'supplier_erp_hub' },
        options,
        nextState: {
          activeFlow: undefined,
          lastTopicId: 'flow_e_plan',
          lastOptions: options,
          turnCount: (state.turnCount || 0) + 1,
        },
      };
    }
  }

  void isSupplier;
  return null;
}

interface KnowledgeTopic {
  id: string;
  title: string;
  keywords: string[];
  minScore?: number;
  buildReply: (
    firstName: string,
    isSupplier: boolean,
    turnCount: number,
    experienceMode?: UserExperienceMode
  ) => {
    reply: string;
    options?: ShamousaChatbotOption[];
    actionLink?: { label: string; view: string };
    startFlow?: { flowId: ShamousaFlowId; step: number; data: Record<string, string> };
    handoffToFalcon?: boolean;
  };
}

const CORE_KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  // الترحيب والقائمة الرئيسية (متكيّف مع الوضع الحرفي والمحاسبي ومسميات السوبر أدمن الحية)
  {
    id: 'greeting',
    title: 'الترحيب والقائمة الرئيسية',
    keywords: [
      'اهلا',
      'سلام',
      'السلام عليكم',
      'صباح',
      'مساء',
      'ازيك',
      'هاي',
      'مرحبا',
      'عامله ايه',
      'اخبارك',
      'مساعده',
      'قائمه',
      'القائمه',
      'بتعملي ايه',
      'رجوع',
    ],
    buildReply: (firstName, isSupplier, turnCount, experienceMode = 'craft') => {
      const cfg = getPlatformExperienceModeConfig();
      const isCraft = experienceMode === 'craft';
      const modeName = isCraft ? 'الوضع الحرفي البسيط' : 'الوضع المحاسبي المتقدم';

      if (isSupplier) {
        const financeLabel = getExperienceLabelFromConfig(cfg, 'sup_finance_title', experienceMode);
        const briefLabel = getExperienceLabelFromConfig(cfg, 'sup_exec_brief_card', experienceMode);
        const ledgerVisible = isExperienceItemVisibleFromConfig(cfg, 'sup_ledger_tab', experienceMode);
        return {
          reply:
            `${pickGreeting(firstName, isSupplier, turnCount)}\n` +
            `أنتِ شغّالة حالياً على **${modeName}** ☀️ ` +
            (isCraft
              ? `يعني كلامنا كله بلغة المحل السهلة (فلوس داخلة وخارجة ومين عليه ومين ليه من غير أي تعقيد).\n`
              : `يعني جاهزة معاكِ بأدق مسميات الحسابات (دفتر الأستاذ، المدين والدائن، وتقييم المخزون والفروع).\n`) +
            `تحب نبدأ بإيه دلوقتي؟`,
          options: [
            { id: 'opt_sup_brief', label: `${briefLabel} 💰`, intentKey: 'sup_full_brief' },
            { id: 'opt_sup_fin', label: `${financeLabel} 🏦`, view: 'supplier_finance' },
            ledgerVisible
              ? { id: 'opt_sup_mode', label: 'الفرق بين الوضع الحرفي والمحاسبي ⚖️', queryText: 'الوضع الحرفي والوضع المحاسبي' }
              : { id: 'opt_sup_pos', label: 'الكاشير 80 مم والبيع بالوزن 🛒', queryText: 'كاشير 80 مم' },
            { id: 'opt_sup_unified', label: 'منظومة الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' },
          ],
        };
      }

      const woLabel = getExperienceLabelFromConfig(cfg, 'wo_page_title', experienceMode);
      const repLabel = getExperienceLabelFromConfig(cfg, 'rep_page_title', experienceMode);
      const trLabel = getExperienceLabelFromConfig(cfg, 'fin_treasury_title', experienceMode);

      return {
        reply:
          `${pickGreeting(firstName, isSupplier, turnCount)}\n` +
          `شغّالين دلوقتي على **${modeName}** ☀️ ` +
          (isCraft
            ? `هكلمك فيه بلغة الورشة البسيطة بدون «دائن ومدين» وتقاريرك جاهزة بـ «الخلاصة قبل الرسم».\n`
            : `معاكِ كل التفاصيل المحاسبية الرسمية (الأذونات، المدين والدائن، ميزان المراجعة، والرسوم المتقدمة).\n`) +
          `تحب نبدأ بإيه دلوقتي؟`,
        options: [
          { id: 'opt_brief', label: 'هلخصهالك (الفلوس والمخزن) 💰', intentKey: 'full_brief' },
          { id: 'opt_wo', label: `${woLabel} 🔨`, view: 'work_orders' },
          { id: 'opt_rep', label: `${repLabel} 📊`, view: 'reports' },
          { id: 'opt_tr', label: `${trLabel} 🏦`, view: 'treasuries' },
        ],
      };
    },
  },

  // 1) الوضع الحرفي والوضع المحاسبي — التبديل والفرق بينهما للفنان والمورد
  {
    id: 'dual_experience_modes',
    title: 'الوضع الحرفي والوضع المحاسبي',
    keywords: [
      'الوضع الحرفي',
      'الوضع المحاسبي',
      'وضع حرفي',
      'وضع محاسبي',
      'تبديل الوضع',
      'اغير الوضع',
      'تغيير الوضع',
      'الوضعين',
      'الوضع البسيط',
      'الوضع المتقدم',
      'الكلام المجعلص',
      'تبسيط الحسابات',
      'الفرق بين الوضعين',
    ],
    buildReply: (firstName, isSupplier, _turnCount, experienceMode = 'craft') => {
      const cfg = getPlatformExperienceModeConfig();
      const isCraft = experienceMode === 'craft';
      const currentName = isCraft ? 'الوضع الحرفي (البسيط)' : 'الوضع المحاسبي (المتقدم)';

      if (isSupplier) {
        const craftFin = getExperienceLabelFromConfig(cfg, 'sup_finance_title', 'craft');
        const accFin = getExperienceLabelFromConfig(cfg, 'sup_finance_title', 'accounting');
        const craftDeb = getExperienceLabelFromConfig(cfg, 'sup_debit', 'craft');
        const accDeb = getExperienceLabelFromConfig(cfg, 'sup_debit', 'accounting');
        const craftCred = getExperienceLabelFromConfig(cfg, 'sup_credit', 'craft');
        const accCred = getExperienceLabelFromConfig(cfg, 'sup_credit', 'accounting');
        return {
          reply:
            `نظام الوضعين في بوابة الموردين معمول عشان يريحك تماماً يا **${firstName}** ☀️ (أنت حالياً على **${currentName}**):\n` +
            `• **الوضع الحرفي (المبسّط للتاجر):** بيظهرلك الشاشات بلغة المحل السهلة زي **«${craftFin}»**، وبدل دائن ومدين بتشوف **«${craftDeb}»** و **«${craftCred}»**، ويخفي دفاتر الأستاذ المعقدة عشان تركز في البيع والتحصيل.\n` +
            `• **الوضع المحاسبي (المتقدم):** بيفتحلك كل الأدوات المحاسبية الرسمية (**«${accFin}»**، **«${accDeb} / ${accCred}»**، دفتر الأستاذ العام، وتقارير التحليل الكاملة).\n` +
            `🔄 للتبديل في أي وقت: افتح **الإعدادات الأساسية** من أعلى الشاشة، أو اضغط زر التبديل السريع أعلى الرئيسية والخزينة!`,
          actionLink: { label: getExperienceLabelFromConfig(cfg, 'sup_finance_title', experienceMode), view: 'supplier_finance' },
          options: [
            { id: 'dm_s_brief', label: '1) هلخصهالك للموردين 💰', intentKey: 'sup_full_brief' },
            { id: 'dm_s_fin', label: `2) افتح ${getExperienceLabelFromConfig(cfg, 'sup_finance_title', experienceMode)} 🏦`, view: 'supplier_finance' },
            { id: 'dm_s_dc', label: '3) شرح الدائن والمدين بالبلدي 📘', queryText: 'يعني ايه دائن ومدين' },
          ],
        };
      }

      const craftIssue = getExperienceLabelFromConfig(cfg, 'wo_issue_voucher', 'craft');
      const accIssue = getExperienceLabelFromConfig(cfg, 'wo_issue_voucher', 'accounting');
      const craftRec = getExperienceLabelFromConfig(cfg, 'wo_receive_voucher', 'craft');
      const accRec = getExperienceLabelFromConfig(cfg, 'wo_receive_voucher', 'accounting');
      const craftRep = getExperienceLabelFromConfig(cfg, 'rep_page_title', 'craft');
      const accRep = getExperienceLabelFromConfig(cfg, 'rep_page_title', 'accounting');

      return {
        reply:
          `يا **${firstName}**، المنظومة فيها وضعين أساسيين تقدر تقلب بينهم بضغطة واحدة (وضعك دلوقتي: **${currentName}**) ☀️:\n` +
          `1️⃣ **الوضع الحرفي (بسيط وسلس):** كل حاجة بلغة الورشة؛ بدل الأذونات المعقدة بتشوف **«${craftIssue}»** و **«${craftRec}»**، والتقارير بتبدأ بـ **«${craftRep}»** (الخلاصة بالبلدي + أهم رسمين بس) وبدون دائن ومدين.\n` +
          `2️⃣ **الوضع المحاسبي (كامل للمحاسبين):** بيظهر المسميات الرسمية كلها زي **«${accIssue}»**، **«${accRec}»**، **«${accRep}»**، **ميزان المراجعة**، سجل التدقيق، وكل الرسوم البيانية المتقدمة.\n` +
          `🔄 تقدر تبدّل بينهم في أي ثانية من **الإعدادات الأساسية** (أول خانة فوق) أو من زر التبديل السريع أعلى الشاشة!`,
        actionLink: { label: getExperienceLabelFromConfig(cfg, 'rep_page_title', experienceMode), view: 'reports' },
        options: [
          { id: 'dm_a_ret', label: '1) إزاي أرجّع بواقي الخامات للمخزن؟ 🧶', queryText: 'بواقي الخامات بعد أمر التشغيل' },
          { id: 'dm_a_vch', label: '2) وظيفة الأذونات إيه بالظبط؟ 📋', queryText: 'وظيفة الأذونات' },
          { id: 'dm_a_dc', label: '3) يعني إيه دائن ومدين؟ 💰', queryText: 'يعني ايه دائن ومدين' },
        ],
      };
    },
  },

  // 2) بواقي الخامات بعد أمر التشغيل (مثال 5 كجم خيط قطن ← اتفضل 2 كجم)
  {
    id: 'work_order_leftover_return',
    title: 'إرجاع بواقي الخامات من أمر التشغيل',
    keywords: [
      'بواقي',
      'اتفضل',
      'متبقي',
      'رجع الخامات',
      'ارجاع الخامات',
      'مرتجع خامات',
      'سحبت 5',
      'اتفضل 2',
      'خيط اتفضل',
      'الخامة اللي اتبقت',
      'بواقي التشغيل',
      'هيرجعوا المخزن',
      'يرجع المخزن',
    ],
    buildReply: (firstName, _isSupplier, _turnCount, experienceMode = 'craft') => {
      const cfg = getPlatformExperienceModeConfig();
      const receiveLabel = getExperienceLabelFromConfig(cfg, 'wo_receive_voucher', experienceMode);
      const returnLabel = getExperienceLabelFromConfig(cfg, 'wo_return_leftover', experienceMode);
      const woPageLabel = getExperienceLabelFromConfig(cfg, 'wo_page_title', experienceMode);

      return {
        reply:
          `سؤال ممتاز ومهم جداً يا **${firstName}** 🧶✨ لو سحبت مثلاً **5 كجم خيط قطن** عشان تصنّع 10 شنط واتفضّل معاك **2 كجم سليمة**:\n` +
          `1️⃣ أول ما تخلص الشغل وتضغط على زر **«${receiveLabel}»** داخل شاشة **«${woPageLabel}»**.\n` +
          `2️⃣ هتلاقي خانة واضحة اسمها **«${returnLabel}»** بتسألك: *إيه اللي اتفضل سليم وهيرجع المخزن؟* — تكتب **2** (أو تضغط أزرار الاختصار السريعة).\n` +
          `3️⃣ المنظومة أوتوماتيك:\n` +
          `   • بترجّع الـ **2 كجم** فوراً لرصيد مخزن الخامات.\n` +
          `   • وبتحسب تكلفة الـ 10 شنط على **الصافي الفعلي بس (3 كجم)** عشان تسعيرك وربحك يبقوا 100% مظبوطين بدون أي هدر وهمي!`,
        actionLink: { label: `فتح ${woPageLabel} 🔨`, view: 'work_orders' },
        options: [
          { id: 'lo_1', label: `1) افتح ${woPageLabel} 🔨`, view: 'work_orders' },
          { id: 'lo_2', label: '2) شرح باقي الأذونات 📋', queryText: 'وظيفة الأذونات' },
          { id: 'lo_3', label: '3) الفرق بين الوضع الحرفي والمحاسبي ⚖️', queryText: 'الوضع الحرفي والوضع المحاسبي' },
        ],
      };
    },
  },

  // 3) وظيفة الأذونات في المنظومة (متكيّفة مع الوضع الحالي ومسميات السوبر أدمن)
  {
    id: 'vouchers_and_permits_guide',
    title: 'وظيفة الأذونات (صرف / توريد / جرد)',
    keywords: [
      'الاذونات',
      'الأذونات',
      'اذن صرف',
      'إذن صرف',
      'اذن توريد',
      'إذن توريد',
      'اذن استلام',
      'إذن استلام',
      'اذن اضافة',
      'إذن إضافة',
      'وظيفة الأذونات',
      'وظيفة الاذونات',
      'فايدة الاذونات',
    ],
    buildReply: (firstName, isSupplier, _turnCount, experienceMode = 'craft') => {
      const cfg = getPlatformExperienceModeConfig();
      const isCraft = experienceMode === 'craft';

      if (isSupplier) {
        const whLabel = getExperienceLabelFromConfig(cfg, 'sup_warehouse_card', experienceMode);
        return {
          reply:
            `الأذونات في بوابة الموردين هي «عينك اللي بتحفظ بضاعتك» يا **${firstName}** 📦:\n` +
            `• **${isCraft ? 'إضافة بضاعة جديدة للمخزن' : 'إذن إضافة واستلام مشتريات'}:** لما تشتري من المصنع، الكمية بتزيد وتتسجل الفاتورة تلقائياً.\n` +
            `• **${isCraft ? 'تحويل بضاعة بين الفروع' : 'إذن تحويل مخزني بخطوتين (شحن ⇠ استلام)'}:** البضاعة تفضل معلّقة لحد ما الفرع المستلم يأكد استلامها فتسمّع في **كارت الصنف**.\n` +
            `• **${isCraft ? 'توريد الفلوس لخزنتك' : 'إذن توريد خزينة فرع للخزينة الرئيسية'}:** بينقل التحصيل بأمان بعد موافقتك.`,
          actionLink: { label: `فتح ${whLabel} 🏭`, view: 'supplier_warehouse_erp' },
          options: [
            { id: 'vg_s1', label: `1) افتح ${whLabel} 🏭`, view: 'supplier_warehouse_erp' },
            { id: 'vg_s2', label: '2) هلخصهالك للموردين 💰', intentKey: 'sup_full_brief' },
          ],
        };
      }

      const issueLbl = getExperienceLabelFromConfig(cfg, 'wo_issue_voucher', experienceMode);
      const receiveLbl = getExperienceLabelFromConfig(cfg, 'wo_receive_voucher', experienceMode);
      const returnLbl = getExperienceLabelFromConfig(cfg, 'wo_return_leftover', experienceMode);
      const auditLbl = getExperienceLabelFromConfig(cfg, 'inv_audit_btn', experienceMode);
      const woPageLbl = getExperienceLabelFromConfig(cfg, 'wo_page_title', experienceMode);

      return {
        reply:
          `الأذونات هدفها واحد بس يا **${firstName}**: إنك في آخر اليوم تعرف خاماتك راحت فين وقطعتك كلفت كام من غير ورق ولا وجع دماغ ☀️\n` +
          `1️⃣ **«${issueLbl}»:** معناه ببساطة إنك سحبت خامات من المخزن عشان تبدأ تصنّع؛ فالمخزن ينقص تلقائياً.\n` +
          `2️⃣ **«${receiveLbl}»:** أول ما القطع تجهز بتدخل مخزن المنتجات الجاهزة جاهزة للبيع وتكلفتها محسوبة.\n` +
          `3️⃣ **«${returnLbl}»:** لو اتفضّل خامة سليمة (زي 2 كجم خيط من 5 كجم)، بتكتبها فترجع للمخزن وتنخصم من التكلفة.\n` +
          `4️⃣ **«${auditLbl}»:** مراجعة سريعة إن اللي على الرف مطابق للي في البرنامج.`,
        actionLink: { label: `فتح ${woPageLbl} 🔨`, view: 'work_orders' },
        options: [
          { id: 'vg_a1', label: '1) إزاي أرجّع بواقي الخامات (مثال 5 كجم)؟ 🧶', queryText: 'بواقي الخامات بعد أمر التشغيل' },
          { id: 'vg_a2', label: `2) افتح ${woPageLbl} 🔨`, view: 'work_orders' },
          { id: 'vg_a3', label: '3) الفرق بين الوضع الحرفي والمحاسبي ⚖️', queryText: 'الوضع الحرفي والوضع المحاسبي' },
        ],
      };
    },
  },

  // 4) الدائن والمدين والخزينة والتقارير وميزان المراجعة
  {
    id: 'debit_credit_and_reports_guide',
    title: 'الدائن والمدين والخزينة والتقارير',
    keywords: [
      'دائن',
      'مدين',
      'الدائن والمدين',
      'مدين ودائن',
      'ميزان المراجعة',
      'ميزان الحسابات',
      'التقارير والرسوم',
      'الرسوم البيانية',
      'الخلاصة قبل الرسم',
      'مش فاهم الحسابات',
      'الحسابات صعبة',
    ],
    buildReply: (firstName, isSupplier, _turnCount, experienceMode = 'craft') => {
      const cfg = getPlatformExperienceModeConfig();
      const isCraft = experienceMode === 'craft';

      if (isSupplier) {
        const debLbl = getExperienceLabelFromConfig(cfg, 'sup_debit', experienceMode);
        const credLbl = getExperienceLabelFromConfig(cfg, 'sup_credit', experienceMode);
        const finLbl = getExperienceLabelFromConfig(cfg, 'sup_finance_title', experienceMode);
        const ledgerLbl = getExperienceLabelFromConfig(cfg, 'sup_ledger_tab', experienceMode);

        return {
          reply: isCraft
            ? `ولا تشغل بالك بكلام المحاسبين يا **${firstName}** ☀️ في **الوضع الحرفي** لغينا التعقيد خالص:\n` +
              `• بدل «مدين» بتشوف **«${debLbl}»** (يعني فلوس داخلة ليك أو ليك عند الورش).\n` +
              `• بدل «دائن» بتشوف **«${credLbl}»** (يعني فلوس خارجة منك أو علينا للمصانع).\n` +
              `• وبطاقة **هلخصهالك للموردين** بتديك صافي الموقف كله في سطرين بالبلدي!`
            : `في **الوضع المحاسبي المتقدم** يا **${firstName}** 📘 كل الحركات بتتسجل بدقة مزدوجة داخل **«${finLbl}»**:\n` +
              `• **${debLbl}:** كل ما يزيد رصيد الخزينة أو مديونية العملاء.\n` +
              `• **${credLbl}:** كل المنصرفات والمشتريات والتزامات المصانع.\n` +
              `• وتقدر تراجع القيود التفصيلية من تبويب **«${ledgerLbl}»** في أي وقت.`,
          actionLink: { label: `فتح ${finLbl} 🏦`, view: 'supplier_finance' },
          options: [
            { id: 'dc_s1', label: '1) هلخصهالك للموردين 💰', intentKey: 'sup_full_brief' },
            { id: 'dc_s2', label: `2) افتح ${finLbl} 🏦`, view: 'supplier_finance' },
            { id: 'dc_s3', label: '3) إزاي أبدّل بين الوضعين؟ ⚖️', queryText: 'الوضع الحرفي والوضع المحاسبي' },
          ],
        };
      }

      const debLbl = getExperienceLabelFromConfig(cfg, 'fin_debit', experienceMode);
      const credLbl = getExperienceLabelFromConfig(cfg, 'fin_credit', experienceMode);
      const trLbl = getExperienceLabelFromConfig(cfg, 'fin_treasury_title', experienceMode);
      const repLbl = getExperienceLabelFromConfig(cfg, 'rep_page_title', experienceMode);
      const tbLbl = getExperienceLabelFromConfig(cfg, 'rep_trial_balance', experienceMode);

      return {
        reply: isCraft
          ? `ما تتعبش نفسك بـ «دائن ومدين» خالص يا **${firstName}** 💛 إحنا ترجمناهالك بالبلدي في **الوضع الحرفي**:\n` +
            `• **«${debLbl}»** = أي فلوس دخلت الخزنة أو ليك عند عميل.\n` +
            `• **«${credLbl}»** = أي فلوس طلعت مصروف/خامات أو عليك لمورد.\n` +
            `• وفي شاشة **«${repLbl}»** عملنالك **«الخلاصة قبل الرسم»**: بتقولك في 3 سطور إحنا كسبانين كام ومعانا كام وفوقيها رسمين بساط بس! ولو احتجت تفاصيل المحاسبين اقلب لـ **الوضع المحاسبي** من الإعدادات.`
          : `أهلاً بيك في **الوضع المحاسبي المتقدم** يا **${firstName}** 📊:\n` +
            `• في **«${trLbl}»**: كل حركة نقدية بتظهر بتصنيف **«${debLbl}»** (مقبوضات/إيرادات) و **«${credLbl}»** (مدفوعات/مصروفات).\n` +
            `• وفي **«${repLbl}»**: مفتوحلك **«${tbLbl}»**، مراجعة المبيعات، سجل التدقيق الكامل، وجميع الرسوم البيانية التحليلية.`,
        actionLink: { label: `فتح ${repLbl} 📊`, view: 'reports' },
        options: [
          { id: 'dc_a1', label: `1) افتح ${repLbl} 📊`, view: 'reports' },
          { id: 'dc_a2', label: `2) افتح ${trLbl} 🏦`, view: 'treasuries' },
          { id: 'dc_a3', label: '3) هلخصهالك (الموقف المالي كله) 💰', intentKey: 'full_brief' },
        ],
      };
    },
  },

  // التعريف بشموسة بدون أي مصطلح "شات بوت" أو "ذكاء اصطناعي"
  {
    id: 'identity',
    title: 'مين شموسة ومنظومة الشمساوية',
    keywords: [
      'انتي مين',
      'انت مين',
      'مين برمجك',
      'اسمك ايه',
      'مين شموسه',
      'شمس كرافت',
      'صاحب البرنامج',
      'مين عملك',
      'حسام بسيوني',
      'البحث المباشر',
      'تشتغلي ازاي',
    ],
    buildReply: (firstName) => ({
      reply:
        `أنا **شموسة** ☀️، مديرة الأعمال والعمليات اليومية في **منظومة الشمساوية** (شركة الشمس كرافت — تأسيس **الباشمهندس حسام بسيوني**).\n` +
        `شغالة معاك بالنظام الذكي جوه المنظومة عشان أجاوبك فوراً في التسعير، الخامات الموحدة، الخزينة، العملاء، والمخزن.\n` +
        `ولو حابب تفتحلي البحث المباشر على الإنترنت عشان أدوّرلك في السوق أكتر، اضغط بس على **صورتي اللي جنب خانة الكتابة عشان تنوّر أخضر 🟢**!`,
      options: [
        { id: 'id_brief', label: 'موقفي المالي الآن (هلخصهالك) 📋', intentKey: 'full_brief' },
        { id: 'id_price', label: 'عايز أسعّر منتج 🧮', queryText: 'عايز أسعّر منتج' },
        { id: 'id_um', label: 'منظومة الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' },
        { id: 'id_falcon', label: 'استشارة صقر الشمساوية 🦅', triggerFalcon: true },
      ],
    }),
  },

  // تدفق ب — "مش عارف أبدأ منين" (فنان جديد)
  {
    id: 'flow_b_start',
    title: 'مش عارف أبدأ منين (بداية فنان جديد)',
    keywords: [
      'ابدا منين',
      'مش عارف ابدا',
      'فنان جديد',
      'احسن طريقه ابدا بيها',
      'جديد هنا',
      'اول مره',
      'ابدا ازاي',
      'ابدأ ازاي',
    ],
    buildReply: (firstName, isSupplier) => {
      if (isSupplier) {
        return {
          reply:
            `نوّرت الشمساوية يا **${firstName}** ☀️ تعالى نجهّز متجر المورد سوا خطوة بخطوة.\n` +
            `قولّي الأول: عندك فرع واحد ولا أكتر من فرع ومخزن؟`,
          startFlow: { flowId: 'flow_e_new_supplier', step: 1, data: {} },
          options: [
            { id: 'fe_1', label: '1) فرع واحد 🏪', queryText: '1' },
            { id: 'fe_2', label: '2) أكتر من فرع 🌿', queryText: '2' },
            { id: 'fe_3', label: '3) مخزن رئيسي ومعارض 🏭', queryText: '3' },
          ],
        };
      }
      return {
        reply:
          `ولا يهمك يا **${firstName}**، هنمشي سوا خطوة بخطوة ☀️\n` +
          `قولّي الأول: عندك خامات مسجلة أو جاهزة في ورشتك دلوقتي؟`,
        startFlow: { flowId: 'flow_b_new_artist', step: 1, data: {} },
        options: [
          { id: 'fb_1', label: '1) أيوه عندي خامات ✅', queryText: '1' },
          { id: 'fb_2', label: '2) لأ لسه هبدأ 🆕', queryText: '2' },
          { id: 'fb_3', label: '3) عندي شوية خامات 🧶', queryText: '3' },
        ],
      };
    },
  },

  // تدفق هـ — مورد جديد
  {
    id: 'flow_e_supplier_start',
    title: 'بداية مورد جديد',
    keywords: ['مورد جديد', 'ابدا كمورد', 'بدايه المورد', 'تجهيز بوابه المورد'],
    buildReply: (firstName) => ({
      reply:
        `أهلاً بيك في بوابة الموردين يا **${firstName}** ☀️ تعالى نرتّب الشغل صح من أول يوم.\n` +
        `عندك فرع واحد ولا أكتر من فرع ومخزن مركزي؟`,
      startFlow: { flowId: 'flow_e_new_supplier', step: 1, data: {} },
      options: [
        { id: 'fe2_1', label: '1) فرع واحد 🏪', queryText: '1' },
        { id: 'fe2_2', label: '2) أكتر من فرع 🌿', queryText: '2' },
        { id: 'fe2_3', label: '3) مخزن ومعارض 🏭', queryText: '3' },
      ],
    }),
  },

  // تدفق د — عايز أزوّد مبيعاتي
  {
    id: 'flow_d_grow_sales',
    title: 'عايز أزوّد مبيعاتي',
    keywords: ['ازود مبيعاتي', 'زياده المبيعات', 'مفيش مبيعات', 'ابيع اكتر', 'تسويق', 'اجيب عملاء', 'المبيعات واقفه'],
    buildReply: (firstName) => ({
      reply:
        `سؤال حلو أوي يا **${firstName}** 🚀 عشان تزوّد مبيعاتك في المنظومة عندك 4 مسارات فعّالة جداً.\n` +
        `اختار المسار اللي تحب نشتغل عليه دلوقتي:`,
      options: [
        { id: 'fd_1', label: '1) متجري وسوق الشمساوية 🛍️', queryText: 'تصدير لسوق الشمساوية' },
        { id: 'fd_2', label: '2) عروض أسعار لعملاء الجملة 📄', queryText: 'اعمل عرض سعر' },
        { id: 'fd_3', label: '3) تحسين الصور والوصف 📸', triggerFalcon: true },
        { id: 'fd_4', label: '4) تبادل خبرة في الطبلية 👨‍👩‍👧‍👦', view: 'family' },
      ],
    }),
  },

  // ت1 — تسعير منتج / حاسبة التكاليف
  {
    id: 't1_pricing',
    title: 'تسعير منتج وحاسبة التكاليف',
    keywords: [
      'اسعر',
      'تسعير',
      'التسعيره',
      'سعر القطعه',
      'بكام ابيع',
      'ابيعها بكام',
      'تمن',
      'ثمن',
      'تكلفه',
      'كلفه',
      'تكلف كام',
      'احسب لي',
      'حاسبه',
      'حساب منتج',
      'سعر لي',
      'معادلات الورش',
      'معادله',
    ],
    buildReply: (firstName) => ({
      reply:
        `التسعير المظبوط بيتم من **حاسبة التكاليف** يا **${firstName}**: تختار الحرفة، تضيف الخامات والكميات ووقت الشغل، وهي تطلّعلك التكلفة والسعر المقترح وصافي الربح.\n` +
        `وتقدر كمان تخلي **صقر** يحسبها لك ويبعتها للحاسبة بزرار **"تصدير"**.`,
      actionLink: { label: 'افتح حاسبة التكاليف 🧮', view: 'calculator' },
      options: [
        { id: 't1_calc', label: '1) افتح حاسبة التكاليف 🧮', view: 'calculator' },
        { id: 't1_falcon', label: '2) خلّي صقر يحسبها لي 🦅', triggerFalcon: true },
        { id: 't1_waste', label: '3) افهم الهالك والمصنعية 📏', queryText: 'الهالك بيتحسب ازاي' },
        { id: 't1_margin', label: '4) الفرق بين الزيادة والهامش 📊', queryText: 'الفرق بين الهامش والزيادة' },
      ],
    }),
  },

  // ت2 — الخامات الموحدة (البحث)
  {
    id: 't2_unified_materials',
    title: 'منظومة الخامات الموحدة',
    keywords: [
      'خامه موحده',
      'خامات موحده',
      'منظومه الخامات',
      'الموحده',
      'مفتوحه للكل',
      'هل منظومه الخامات مفتوحه',
      'عايز خامه',
      'فين الخامه',
    ],
    buildReply: (firstName, isSupplier) => ({
      reply:
        `منظومة الخامات الموحدة مفتوحة للكل يا **${firstName}** 🏷️ وفيها أكتر من **400 خامة** متقسمة على **12 قسم** بأكواد قياسية موحدة.\n` +
        `اكتبلي اسم أي خامة بالطريقة اللي بتقولها في السوق أو اكتب الكود بتاعها (زي \`TH0001\` أو \`قطن مجدول\`)، وأنا أطلّعهالك فوراً!`,
      actionLink: {
        label: isSupplier ? 'فتح الخامات الموحدة في كتالوجي 🏷️' : 'فتح منظومة الخامات الموحدة 🏷️',
        view: 'unified_materials',
      },
      options: [
        { id: 't2_1', label: '1) اعرض الأقسام الـ 12 📚', queryText: 'رموز اقسام الخامات الموحده' },
        { id: 't2_2', label: '2) فهم نظام الكود (TH0001) 🔎', queryText: 'الكود يعني ايه' },
        { id: 't2_3', label: '3) سلاسل وحدات القياس (ل1..ل8) ⚖️', queryText: 'سلاسل وحدات القياس' },
        { id: 't2_4', label: '4) ضيف خامة مش موجودة ➕', queryText: 'ضيف خامة جديدة' },
      ],
    }),
  },

  // ت3 — فهم الكود (مثال TH0001.01#B003)
  {
    id: 't3_code_anatomy',
    title: 'فهم كود الخامة الموحد (TH0001.01#B003)',
    keywords: ['الكود يعني ايه', 'يعني ايه th', 'فهم الكود', 'نظام الكود', 'اجزاء الكود', 'الرقم اللي علي الخامه', 'سيريال الخامه'],
    buildReply: (firstName) => ({
      reply:
        `الكود الموحد متقسّم 4 أجزاء يا **${firstName}** (مثال: \`TH0001.01#B003\`):\n` +
        `1️⃣ **أول حرفين** هما القسم (\`TH\` خيوط، \`BD\` خرز، \`CL\` ريزن وشموع، \`WD\` أخشاب، \`LT\` جلود، \`MT\` معادن...).\n` +
        `2️⃣ **بعدهم رقم الخامة الأساسي** (4 أرقام)، 3️⃣ **بعد النقطة** المقاس أو السمك، 4️⃣ **بعد #** الماركة أو المنشأ.`,
      actionLink: { label: 'تصفح الأكواد في الخامات الموحدة 🏷️', view: 'unified_materials' },
      options: [
        { id: 't3_1', label: '1) اعرض الأقسام الـ 12 📚', queryText: 'رموز اقسام الخامات الموحده' },
        { id: 't3_2', label: '2) المسميات الدارجة في السوق 🔄', queryText: 'المسميات الدارجة' },
        { id: 't3_3', label: '3) مثال كود TH0001 🔎', queryText: 'TH0001' },
        { id: 't3_4', label: '4) افتح الخامات الموحدة 🏷️', view: 'unified_materials' },
      ],
    }),
  },

  // أقسام الخامات الموحدة الـ 12 (تراث شموسة محفوظ بالكامل)
  {
    id: 'unified_prefixes',
    title: 'أقسام الخامات الموحدة الـ 12',
    keywords: ['رموز اقسام', 'اقسام الخامات', 'اختصار الاقسام', 'الاقسام ال 12', 'اعرض الاقسام'],
    buildReply: (firstName) => {
      const lines = UNIFIED_CATEGORIES.map(
        (c: UnifiedCategoryDef) => `• **${c.prefix}** — ${c.nameAr} (${c.defaultUnitChain})`
      ).join('\n');
      return {
        reply: `📚 **أقسام الخامات الموحدة الـ 12 يا ${firstName}:**\n${lines}\n\nاكتبلي اسم أي خامة أو كودها وأطلّعلك بياناتها فوراً!`,
        actionLink: { label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
        options: [
          { id: 'up_1', label: '1) سلاسل وحدات القياس (ل1..ل8) ⚖️', queryText: 'سلاسل وحدات القياس' },
          { id: 'up_2', label: '2) فهم أجزاء الكود 🔎', queryText: 'الكود يعني ايه' },
          { id: 'up_3', label: '3) افتح الخامات الموحدة 🏷️', view: 'unified_materials' },
        ],
      };
    },
  },

  // سلاسل وحدات القياس (ل1..ل8)
  {
    id: 'unit_chains',
    title: 'سلاسل وحدات القياس (ل1..ل8)',
    keywords: ['سلاسل وحدات', 'وحدات القياس', 'تحويل الوحده', 'بكره', 'شله', 'ل1', 'ل2', 'ل3', 'ل4'],
    buildReply: (firstName) => {
      const lines = UNIT_CHAINS.map(
        (u) => `• **${u.code} (${u.titleAr}):** [${u.supplierFlow}] ⬅️ [${u.defaultPrimaryUnit} = ${u.defaultFactor} ${u.defaultSubUnit}]`
      ).join('\n');
      return {
        reply: `⚖️ **سلاسل تحويل الوحدات في المنظومة يا ${firstName}:**\n${lines}`,
        options: [
          { id: 'uc_1', label: '1) فتح الخامات الموحدة 🏷️', view: 'unified_materials' },
          { id: 'uc_2', label: '2) فتح مخزن خاماتي 🧶', view: 'materials' },
          { id: 'uc_3', label: '3) الأقسام الـ 12 📚', queryText: 'رموز اقسام الخامات الموحده' },
        ],
      };
    },
  },

  // ت4 — المسميات الدارجة / المرادفات في السوق
  {
    id: 't4_market_aliases',
    title: 'المسميات الدارجة والمرادفات في السوق',
    keywords: ['مسميات دارجه', 'الاسم الشعبي', 'مرادف', 'بيسموها', 'مكرميه محلول', 'خرز تفسيره', 'ايبوكسي كاست', 'اسم تاني', 'بتتقال ازاي'],
    buildReply: (firstName) => ({
      reply:
        `في المنظومة قاموس **مسميات دارجة** بيربط اسم السوق بالكود الهندسي يا **${firstName}** 🔄\n` +
        `وكمان بيفرّق بين الأسماء المتشابهة (زي كلمة "خرز" بمعنى خيط مجدول بفتلتين \`AL00001+\` مقابل خرز الزينة \`BD\`).\n` +
        `قولّي الاسم اللي بتسمعه في السوق وأنا أطلّعلك الخامة فوراً!`,
      options: [
        { id: 't4_1', label: '1) افتح الخامات الموحدة للبحث 🏷️', view: 'unified_materials' },
        { id: 't4_2', label: '2) خامة مش لاقيها ➕', queryText: 'ضيف خامة جديدة' },
        { id: 't4_3', label: '3) اعرض الأقسام الـ 12 📚', queryText: 'رموز اقسام الخامات الموحده' },
      ],
    }),
  },

  // ت5 — إضافة خامة جديدة
  {
    id: 't5_add_material',
    title: 'إضافة خامة جديدة',
    keywords: ['ضيف خامه', 'اضافه خامه', 'خامه جديده', 'مش موجوده', 'مش لاقي الخامه', 'اسجل خامه'],
    buildReply: (firstName) => ({
      reply:
        `لو الخامة مش في الموحدة يا **${firstName}**، ضيفها فوراً وهتاخد كود جديد وتنزل في ورشتك في ساعتها ✅\n` +
        `وبتوصل للسوبر أدمن عشان لو حابب يعتمدها للكل، وأي تعديل أو حذف بتعمله من "خاماتي" بيطبق على ورشتك إنت بس وما بيمسحهاش من المنظومة.`,
      actionLink: { label: 'ضيف خامة من الخامات الموحدة ➕', view: 'unified_materials' },
      options: [
        { id: 't5_1', label: '1) افتح الخامات الموحدة 🏷️', view: 'unified_materials' },
        { id: 't5_2', label: '2) افتح مخزن خاماتي 🧶', view: 'materials' },
        { id: 't5_3', label: '3) حد الأمان والنواقص ⚠️', queryText: 'حد الامان والنواقص' },
      ],
    }),
  },

  // ت6 — الهالك (ث1)
  {
    id: 't6_waste',
    title: 'حساب الهالك (ث1)',
    keywords: ['هالك', 'الهالك', 'فاقد', 'كسر', 'بتروح', 'ضايع', 'تالف', 'قص', 'نسبه الهالك', 'ث1'],
    buildReply: (firstName) => ({
      reply:
        `سؤال حلو أوي يا **${firstName}** 📏\n` +
        `**الهالك (ث1)** بيتحسب على **الاستهلاك الصافي مرة واحدة بس**: \`الإجمالي = الصافي × (1 + نسبة الهالك)\`.\n` +
        `ومش بيتكرر تاني فوق كفاءة القص أو التعشيق عشان السعر ما يتضربش مرتين!`,
      actionLink: { label: 'جرّبها في حاسبة التكاليف 🧮', view: 'calculator' },
      options: [
        { id: 't6_1', label: '1) افتح حاسبة التكاليف 🧮', view: 'calculator' },
        { id: 't6_2', label: '2) المصنعية والأجر (ث2) ⏱️', queryText: 'المصنعية بتتحسب ازاي' },
        { id: 't6_3', label: '3) الهالك والتالف في الدفعة (ث4) 📦', queryText: 'تكلفة الدفعة والقوالب' },
        { id: 't6_4', label: '4) رجوع للتسعير 🔙', queryText: 'عايز أسعّر منتج' },
      ],
    }),
  },

  // ت7 — المصنعية / الأجر (ث2)
  {
    id: 't7_labor',
    title: 'حساب المصنعية والأجر (ث2)',
    keywords: ['مصنعيه', 'اجري', 'يوميه', 'ساعه شغل', 'تعبي', 'وقتي', 'عماله', 'الاجر', 'سعر الساعه', 'ث2'],
    buildReply: (firstName) => ({
      reply:
        `**المصنعية (ث2)** يا **${firstName}** بتتحسب على ساعات **التحضير + التنفيذ + التشطيب** بس (مضروبة في أجر الساعة ومعامل الصعوبة).\n` +
        `أما وقت **التجفيف أو التصلب** (زي تجفيف الصابون أسابيع أو تصلب الريزن 24 ساعة) فمش بيتحسب أجر لأنك مش شغال بإيدك فيه.`,
      actionLink: { label: 'احسب مصنعية قطعتك في الحاسبة 🧮', view: 'calculator' },
      options: [
        { id: 't7_1', label: '1) افتح حاسبة التكاليف 🧮', view: 'calculator' },
        { id: 't7_2', label: '2) الطاقة وإهلاك القوالب ⚡', queryText: 'الطاقة وإهلاك القوالب' },
        { id: 't7_3', label: '3) الصابون البارد والأمان 🧼', queryText: 'الصابون البارد' },
        { id: 't7_4', label: '4) الفرق بين الزيادة والهامش 📊', queryText: 'الفرق بين الهامش والزيادة' },
      ],
    }),
  },

  // ت8 — الزيادة والهامش (ث5) + سؤال سريع هامش 40%
  {
    id: 't8_margin_markup',
    title: 'الفرق بين الزيادة والهامش (ث5)',
    keywords: [
      'هامش',
      'ماركت اب',
      'markup',
      'margin',
      'نسبه الربح',
      'زياده علي التكلفه',
      'هامش ولا زياده',
      'الفرق بين الهامش',
      'هامش 40',
      'ث5',
    ],
    buildReply: (firstName) => ({
      reply:
        `فرق مهم جداً يا **${firstName}** 📊:\n` +
        `• **الزيادة (Markup):** على التكلفة = \`(سعر البيع − التكلفة) ÷ التكلفة\`.\n` +
        `• **الهامش (Margin):** من سعر البيع = \`(سعر البيع − التكلفة) ÷ سعر البيع\`. ولو عايز هامش 40% يبقى \`السعر = التكلفة ÷ (1 − 0.40)\`.\n` +
        `• *مثال توضيحي (بيتغير حسب السوق):* تكلفة 100 وبيع 150 = زيادة **50%** وهامش **33%**. وتكلفة 100 بهامش 40% = بيع حوالي **167**.`,
      actionLink: { label: 'احسبها بدقة في الحاسبة 🧮', view: 'calculator' },
      options: [
        { id: 't8_1', label: '1) افتح حاسبة التكاليف 🧮', view: 'calculator' },
        { id: 't8_2', label: '2) التكلفة الكلية (ث6) 🧾', queryText: 'التكلفة الكلية' },
        { id: 't8_3', label: '3) ليه الربح قليل؟ 🔍', queryText: 'ليه بخسر' },
        { id: 't8_4', label: '4) تسعير قطعة خطوة بخطوة 📐', queryText: 'عايز أسعّر منتج' },
      ],
    }),
  },

  // ت9 — التكلفة الكلية (ث6)
  {
    id: 't9_total_cost',
    title: 'التكلفة الكلية للقطعة (ث6)',
    keywords: ['التكلفه الكليه', 'كل التكاليف', 'ايجار', 'مصاريف غير مباشره', 'ث6', 'تغليف وشحن'],
    buildReply: (firstName) => ({
      reply:
        `**التكلفة الكلية (ث6)** لأي قطعة يا **${firstName}** بتجمع 6 بنود عشان ما تخسرش أبداً:\n` +
        `**خامات + هالك صافي + عمالة فعلية + طاقة وإهلاك قوالب + تغليف وشحن + حصة عادلة من إيجار وكهربا الورشة.**`,
      actionLink: { label: 'افتح حاسبة التكاليف 🧮', view: 'calculator' },
      options: [
        { id: 't9_1', label: '1) الطاقة وإهلاك القوالب ⚡', queryText: 'الطاقة وإهلاك القوالب' },
        { id: 't9_2', label: '2) الهالك والمصنعية 📏', queryText: 'الهالك بيتحسب ازاي' },
        { id: 't9_3', label: '3) الفرق بين الزيادة والهامش 📊', queryText: 'الفرق بين الهامش والزيادة' },
        { id: 't9_4', label: '4) افتح الحاسبة 🧮', view: 'calculator' },
      ],
    }),
  },

  // ت10 — الطاقة وإهلاك القوالب (ث3) والدفعات (ث4)
  {
    id: 't10_energy_batch',
    title: 'الطاقة وإهلاك القوالب والدفعات (ث3/ث4)',
    keywords: ['كهربا الفرن', 'الليزر', 'طابعه 3d', 'قالب سيليكون', 'اهلاك', 'صبه', 'دفعه', 'باتش', 'قطع سليمه', 'ث3', 'ث4', 'القوالب'],
    buildReply: (firstName) => ({
      reply:
        `في الحاسبة يا **${firstName}** ⚡:\n` +
        `• **الطاقة والقوالب (ث3):** كهربا الفرن/الليزر/طابعة 3D وإهلاك قوالب السيليكون بيتوزعوا تلقائياً على عدد الصبّات.\n` +
        `• **الدفعة/الباتش (ث4):** بنقسم تكلفة الدفعة كلها على **القطع السليمة اللي تنفع للبيع بس** عشان التالف ما ياكلش مكسبك.`,
      actionLink: { label: 'افتح حاسبة التكاليف 🧮', view: 'calculator' },
      options: [
        { id: 't10_1', label: '1) افتح حاسبة التكاليف 🧮', view: 'calculator' },
        { id: 't10_2', label: '2) الأصول وصيانة الماكينات 🔧', queryText: 'الأصول والصيانة' },
        { id: 't10_3', label: '3) الهالك الصافي 📏', queryText: 'الهالك بيتحسب ازاي' },
      ],
    }),
  },

  // ت11 — صقر
  {
    id: 't11_falcon',
    title: 'صقر الشمساوية (المستشار الهندسي)',
    keywords: ['صقر', 'المستشار', 'اسال صقر', 'حول لصقر', 'احسب بالصوت', 'سجل صوت', 'صوره المنتج', 'منافسين', 'دراسه سوق'],
    buildReply: (firstName) => ({
      reply:
        `**صقر الشمساوية 🦅** هو مستشارك الهندسي والتسعيري يا **${firstName}**.\n` +
        `بتوصفله القطعة بالكتابة أو بالصوت، وهو يحلّل الخامات والأبعاد والسعر العادل ويدّيك زرار **"تصدير لحاسبة التكاليف"** فوراً.\n` +
        `(ولو تحليل الصور واقف مؤقتاً، اوصفله المقاسات والخامة بالكلام وهيدّيك الحساب بالظبط!)`,
      handoffToFalcon: true,
      options: [
        { id: 't11_1', label: '1) افتح صقر الشمساوية الآن 🦅', triggerFalcon: true },
        { id: 't11_2', label: '2) افتح حاسبة التكاليف 🧮', view: 'calculator' },
        { id: 't11_3', label: '3) تسعير منتج خطوة بخطوة 📐', queryText: 'عايز أسعّر منتج' },
      ],
    }),
  },

  // ت12 — الأرشيف / كارت الصنف
  {
    id: 't12_archive',
    title: 'الأرشيف وكارت الصنف (BOM)',
    keywords: ['ارشيف', 'الارشيف', 'كارت الصنف', 'وصفه المنتج', 'حفظ الحساب', 'bom', 'sku', 'حساباتي القديمه', 'دوره المنتج'],
    buildReply: (firstName) => ({
      reply:
        `لما تحفظ أي منتج من الحاسبة يا **${firstName}**، بينزل في **الأرشيف** كـ **كارت صنف رسمي**: فيه الخامات بأكوادها وكمياتها وتكلفة الوحدة والسعر المقترح وصافي الربح.\n` +
        `ده مرجعك لما تعيد تصنيعه، ومنه بتتخصم الخامات تلقائي في أوامر الشغل، وبعدها تنقله للكتالوج ثم متجرك ثم السوق!`,
      actionLink: { label: 'فتح الأرشيف 📋', view: 'archive' },
      options: [
        { id: 't12_1', label: '1) افتح الأرشيف 📋', view: 'archive' },
        { id: 't12_2', label: '2) الكتالوج وعروض الأسعار 📄', queryText: 'الكتالوج وعروض الأسعار' },
        { id: 't12_3', label: '3) متجري الخاص 🏪', queryText: 'متجري الخاص' },
        { id: 't12_4', label: '4) سوق الشمساوية 🛍️', queryText: 'سوق الشمساوية' },
      ],
    }),
  },

  // ت13 — الكتالوج وعروض الأسعار
  {
    id: 't13_catalog',
    title: 'الكتالوج وعروض الأسعار',
    keywords: ['كتالوج', 'الكتالوج', 'عرض سعر', 'عروض اسعار', 'عرض للعميل', 'عربون', 'مده التنفيذ', 'واتساب للعميل'],
    buildReply: (firstName) => ({
      reply:
        `من شاشة **الكتالوج** يا **${firstName}** تقدر تطلّع **عرض سعر برقم مسلسل** فيه المواصفات والعربون ومدة التنفيذ وتبعته للعميل على واتساب فوراً.\n` +
        `وكمان تحدد الأصناف الجاهزة وتضغط **"تصدير للمتجر"** عشان تظهر في متجرك الخاص.`,
      actionLink: { label: 'فتح الكتالوج وعروض الأسعار 📄', view: 'catalog' },
      options: [
        { id: 't13_1', label: '1) افتح الكتالوج الآن 📄', view: 'catalog' },
        { id: 't13_2', label: '2) إدارة متجري الخاص 🏪', view: 'my_store' },
        { id: 't13_3', label: '3) انقل صنف من الأرشيف 📋', view: 'archive' },
      ],
    }),
  },

  // ت14 — المتجر الخاص
  {
    id: 't14_my_store',
    title: 'متجري الخاص والرابط والـ QR',
    keywords: ['متجري', 'المتجر', 'الستور', 'رابط المتجر', 'qr', 'موقعي', 'بيع اونلاين', 'اعمل متجر'],
    buildReply: (firstName) => ({
      reply:
        `كل ورشة في المنظومة ليها **متجر مستقل** بشعارها وألوانها ومقاساتها وعملتها مع **رابط مباشر وكود QR** جاهز للمشاركة على سوشيال ميديا يا **${firstName}**.\n` +
        `ومن شاشة إدارة المتجر بتتحكم في المعروض وتختار المنتجات اللي تتصدّر لـ **سوق الشمساوية**.`,
      actionLink: { label: 'فتح إدارة متجري 🏪', view: 'my_store' },
      options: [
        { id: 't14_1', label: '1) إدارة متجري والرابط 🏪', view: 'my_store' },
        { id: 't14_2', label: '2) صدّر منتجات للسوق 🛍️', queryText: 'سوق الشمساوية' },
        { id: 't14_3', label: '3) الكتالوج وعروض الأسعار 📄', view: 'catalog' },
      ],
    }),
  },

  // ت15 — سوق الشمساوية والموافقة + إعادة المراجعة
  {
    id: 't15_marketplace',
    title: 'سوق الشمساوية والمراجعة والموافقة',
    keywords: [
      'السوق',
      'سوق الشمساويه',
      'تصدير للسوق',
      'موافقه',
      'رفض',
      'بانتظار المراجعه',
      'اعاده المراجعه',
      'معلق',
      'شاره خضراء',
      'المنتج مش ظاهر في السوق',
    ],
    buildReply: (firstName) => ({
      reply:
        `ما فيش منتج بيظهر في **سوق الشمساوية** لوحده يا **${firstName}** 🛍️\n` +
        `إنت بتطلب التصدير، والسوبر أدمن يراجع الصور والوصف والسعر: لو اتقبل ياخد **شارة خضراء**، ولو اترفض يوصلك السبب.\n` +
        `ولو عدّلت منتج معتمد (سعر أو صورة أو وصف) بيرجع تلقائي **"بانتظار إعادة المراجعة"** عشان نحمي مصداقية السوق.`,
      actionLink: { label: 'زيارة سوق الشمساوية 🛍️', view: 'marketplace' },
      options: [
        { id: 't15_1', label: '1) صدّر منتج من متجري 🏪', view: 'my_store' },
        { id: 't15_2', label: '2) افتح سوق الشمساوية 🛍️', view: 'marketplace' },
        { id: 't15_3', label: '3) دورة المنتج كاملة 📋', queryText: 'الأرشيف وكارت الصنف' },
      ],
    }),
  },

  // ت16 — الطلبات وأوامر التشغيل
  {
    id: 't16_orders_workorders',
    title: 'الطلبات وأوامر التشغيل',
    keywords: ['طلب', 'طلبيه', 'اوردر', 'امر شغل', 'اوامر التشغيل', 'امر تشغيل', 'تشغيل', 'تسليم', 'العميل طلب', 'تنفيذ', 'صنايعي', 'صرف خامات'],
    buildReply: (firstName) => ({
      reply:
        `أي طلبية (من متجرك أو السوق أو بيع خارجي) بتتحوّل لـ **أمر تشغيل** بيسحب الخامات أوتوماتيك من مخزنك حسب **كارت الصنف** يا **${firstName}** 🔨\n` +
        `وبتتابع مراحله خطوة بخطوة مع الحرفي لحد التسليم والتحصيل.`,
      actionLink: { label: 'فتح أوامر التشغيل 🔨', view: 'work_orders' },
      options: [
        { id: 't16_1', label: '1) افتح أوامر التشغيل 🔨', view: 'work_orders' },
        { id: 't16_2', label: '2) سجل الطلبات والمبيعات 🧾', view: 'sales' },
        { id: 't16_3', label: '3) فحص نواقص الخامات 🧶', intentKey: 'wh_materials' },
        { id: 't16_4', label: '4) مواعيد التسليم والأجندة 📅', action: 'open_agenda' },
      ],
    }),
  },

  // ت17 + تدفق و — العملاء والمتأخرات وتذكير الواتساب
  {
    id: 't17_customers_overdue',
    title: 'العملاء والمتأخرات وتذكير الواتساب',
    keywords: ['عملاء', 'عميل', 'فلوس بره', 'متاخرات', 'متاخر', 'ليا عند', 'مدين', 'اجل', 'تذكير', 'فكره', 'واتساب تذكير', 'مش دافع'],
    buildReply: (firstName, isSupplier) => ({
      reply:
        `لكل عميل ملف متكامل يا **${firstName}** فيه مصدره (متجري/السوق/خارجي) ومشترياته والمتبقي عليه وعدد أيام التأخير 👥\n` +
        `وفي زرار **"تذكير لطيف بالواتساب"** بيصيغ رسالة مهذبة وجاهزة للإرسال بضغطة واحدة!`,
      actionLink: {
        label: isSupplier ? 'فتح عملائي 👥' : 'فتح ملفات العملاء 👥',
        view: isSupplier ? 'supplier_customers' : 'customers',
      },
      options: [
        { id: 't17_1', label: '1) مين متأخر في السداد؟ 📥', intentKey: isSupplier ? 'sup_receivables' : 'tr_receivables' },
        { id: 't17_2', label: '2) فتح شاشة العملاء والواتساب 👥', view: isSupplier ? 'supplier_customers' : 'customers' },
        { id: 't17_3', label: '3) بطاقة هلخصهالك 📋', intentKey: isSupplier ? 'sup_full_brief' : 'full_brief' },
      ],
    }),
  },

  // ت18 — الخزينة وهلخصهالك ("معايا كام")
  {
    id: 't18_treasury_brief',
    title: 'الخزينة وبطاقة هلخصهالك',
    keywords: ['خزينه', 'خزنه', 'كاش', 'فلوسي', 'معايا كام', 'معانا كام', 'رصيد', 'انستاباي', 'بنك', 'محفظه', 'عهده', 'هلخصهالك', 'ملخص', 'موقفي المالي'],
    buildReply: (firstName, isSupplier) => ({
      reply:
        `بطاقة **"هلخصهالك"** بتجيبلك موقفك المالي كله في 30 ثانية (من بيانات حسابك إنت بس) يا **${firstName}** 💰:\n` +
        `• **معانا كام وفين** (موزّعة على الخزائن والكاش وإنستاباي).\n` +
        `• **لينا كام بره** (المتأخرين وأيام التأخير) و**علينا كام** للموردين، وأنهي أصناف طايرة وأنهي نايمة.`,
      actionLink: {
        label: isSupplier ? 'فتح هلخصهالك للموردين 📋' : 'فتح بطاقة هلخصهالك 📋',
        view: isSupplier ? 'supplier_executive_brief' : 'executive_brief',
      },
      options: [
        { id: 't18_1', label: '1) معايا كام دلوقتي 💵', intentKey: isSupplier ? 'sup_cash' : 'tr_cash' },
        { id: 't18_2', label: '2) لينا كام بره 📥', intentKey: isSupplier ? 'sup_receivables' : 'tr_receivables' },
        { id: 't18_3', label: '3) علينا كام 📤', intentKey: isSupplier ? 'sup_payables' : 'tr_payables' },
        { id: 't18_4', label: '4) الخلاصة كلها 📋', intentKey: isSupplier ? 'sup_full_brief' : 'full_brief' },
      ],
    }),
  },

  // ت19 — صافي الربح وإغلاق الشهر
  {
    id: 't19_net_profit',
    title: 'صافي الربح وإغلاق الشهر',
    keywords: ['كسبت كام', 'صافي الربح', 'اغلاق الشهر', 'تقرير شهري', 'مكسب الشهر', 'التقارير الماليه'],
    buildReply: (firstName) => ({
      reply:
        `**صافي الربح الحقيقي** القابل للتوزيع يا **${firstName}** = **إيرادات المبيعات الفعلية − تكلفة الخامات المستهلكة − المصروفات التشغيلية** (إيجار، كهربا، تسويق، شحن) 📊\n` +
        `وتقدر تراجع تقرير إغلاق الشهر بالتفصيل من شاشة **التقارير المالية**.`,
      actionLink: { label: 'فتح التقارير المالية 📊', view: 'reports' },
      options: [
        { id: 't19_1', label: '1) افتح التقارير وإغلاق الشهر 📊', view: 'reports' },
        { id: 't19_2', label: '2) ليه الربح قليل / بخسر؟ 🔍', queryText: 'ليه بخسر' },
        { id: 't19_3', label: '3) بطاقة هلخصهالك 📋', intentKey: 'full_brief' },
      ],
    }),
  },

  // ت20 + تدفق ج — ليه خسرت أو الربح قليل (تشخيص)
  {
    id: 't20_why_losing',
    title: 'تشخيص ليه بخسر أو الربح قليل',
    keywords: ['بخسر', 'ليه بخسر', 'ليه مش بكسب', 'مكسبش', 'الربح قليل', 'بيع بخساره', 'ليه مفيش مكسب', 'خسران'],
    buildReply: (firstName) => ({
      reply:
        `ولا يهمك يا **${firstName}**، نكتشف السبب سوا ونصلّحه فوراً 💡\n` +
        `غالباً الربح بيقل بسبب واحد من 5 حاجات: **الهالك محسوب غلط، المصنعية ناقصة، الشحن والتغليف مش محسوبين، عمولة المنصة أو الضريبة منسية، أو سعر الخامة قديم**.\n` +
        `تحب نبدأ نراجع إيه أول حاجة؟`,
      actionLink: { label: 'راجع حسابات منتج في الحاسبة 🧮', view: 'calculator' },
      options: [
        { id: 't20_1', label: '1) راجع حسابات منتج 🧮', view: 'calculator' },
        { id: 't20_2', label: '2) حدّث أسعار الخامات 🧶', view: 'materials' },
        { id: 't20_3', label: '3) الفرق بين الزيادة والهامش 📊', queryText: 'الفرق بين الهامش والزيادة' },
        { id: 't20_4', label: '4) افهم الهالك والمصنعية 📏', queryText: 'الهالك بيتحسب ازاي' },
      ],
    }),
  },

  // ت21 — المخزون والنواقص
  {
    id: 't21_inventory',
    title: 'المخزون والنواقص وحد الأمان',
    keywords: ['مخزن', 'مخزون', 'نواقص', 'خلصت', 'رصيد خامه', 'حد الامان', 'جرد', 'راكد', 'طاير', 'نايم'],
    buildReply: (firstName, isSupplier) => ({
      reply:
        `كل خامة عندك ليها **رصيد افتتاحي وحد أمان** يا **${firstName}** 📦 وأول ما تقل عنه بتظهر فوراً في **النواقص**.\n` +
        `والأصناف الراكدة نعملها عروض، والسريعة نأمّن رصيدها قبل ما تخلص!`,
      actionLink: {
        label: isSupplier ? 'فتح مخزون الفروع 🏭' : 'فتح مخزن خاماتي 🧶',
        view: isSupplier ? 'supplier_warehouse_erp' : 'materials',
      },
      options: [
        { id: 't21_1', label: '1) عرض النواقص والسحب 🧶', intentKey: isSupplier ? 'sup_stock' : 'wh_materials' },
        { id: 't21_2', label: '2) الأصناف الراكدة والسريعة 🛍️', intentKey: isSupplier ? 'sup_stock' : 'wh_products' },
        { id: 't21_3', label: '3) افتح المخزن والجرد 📦', view: isSupplier ? 'supplier_warehouse_erp' : 'materials' },
        { id: 't21_4', label: '4) اطلب من مورد 🚚', view: 'suppliers' },
      ],
    }),
  },

  // ت22 — الأصول والعُدد والصيانة
  {
    id: 't22_assets',
    title: 'الأصول والعُدد والصيانة',
    keywords: ['ماكينه', 'فرن', 'نول', 'عده', 'صيانه', 'اصل', 'اصول', 'اهلاك الماكينه', 'عطلانه'],
    buildReply: (firstName) => ({
      reply:
        `من شاشة **الأصول والصيانة** يا **${firstName}** بتسجّل الماكينات والأفران والأنوال والقوالب وتعمل لها جدول **صيانة وقائية** 🔧\n` +
        `وكمان **إهلاك الأصل** بيدخل تلقائياً في حساب تكلفة القطعة عشان تجدّد معداتك من أرباحك.`,
      actionLink: { label: 'فتح الأصول والصيانة 🔧', view: 'assets' },
      options: [
        { id: 't22_1', label: '1) افتح شاشة الأصول والصيانة 🔧', view: 'assets' },
        { id: 't22_2', label: '2) الطاقة وإهلاك القوالب ⚡', queryText: 'الطاقة وإهلاك القوالب' },
        { id: 't22_3', label: '3) التكلفة الكلية 🧾', queryText: 'التكلفة الكلية' },
      ],
    }),
  },

  // ت23 — الصابون البارد والأمان + السلامة المهنية
  {
    id: 't23_soap_safety',
    title: 'الصابون البارد وتحذيرات السلامة المهنية',
    keywords: ['صابون', 'تصبن', 'صودا كاويه', 'naoh', 'لاي', 'sap', 'صابون بارد', 'سلامه', 'تهويه', 'كمامه', 'حروق', 'امان'],
    buildReply: (firstName) => ({
      reply:
        `🦺 **الأمان أولاً يا ${firstName}:**\n` +
        `• **الصابون البارد (NaOH):** معادلة التصبّن (SAP) بتحسب الصودا حسب الزيوت. لازم **نضارة أمان وجوانتي وأكمام طويلة**، وتضيف **الصودا على المية البارد مش العكس** في مكان متهوّي! (ووقت التجفيف أسابيع مش بيتحسب أجر).\n` +
        `• **الريزن/الليزر/الكهربا:** تهوية قوية وكمامة مناسبة (\`A1\` للريزن و\`N95\` للخشب) وعزل كهربائي معتمد.`,
      actionLink: { label: 'افتح حاسبة الصابون والورش 🧮', view: 'calculator' },
      options: [
        { id: 't23_1', label: '1) احسب وصفة صابون في الحاسبة 🧮', view: 'calculator' },
        { id: 't23_2', label: '2) قاعدة المصنعية والتجفيف ⏱️', queryText: 'المصنعية بتتحسب ازاي' },
        { id: 't23_3', label: '3) معادلة الريزن والشموع 🕯️', queryText: 'معادلة الريزن' },
      ],
    }),
  },

  // ت24 — دمج الحِرف
  {
    id: 't24_craft_fusion',
    title: 'ورشة دمج الحِرف (Craft Fusion)',
    keywords: ['دمج', 'حرفتين', 'مكرميه وخشب', 'ريزن وخشب', 'منتج مركب', 'craft fusion'],
    buildReply: (firstName) => ({
      reply:
        `عندنا ورشة مخصصة اسمها **"دمج الحِرف"** يا **${firstName}** ✨ بتجمع فيها أي حرفتين في منتج واحد (زي مكرمية وخشب أو ريزن وخشب) وتحسب تكلفة الاتنين مع بعض في كارت صنف واحد!`,
      actionLink: { label: 'افتح دمج الحِرف في الحاسبة 🧮', view: 'calculator' },
      options: [
        { id: 't24_1', label: '1) افتح الحاسبة الآن 🧮', view: 'calculator' },
        { id: 't24_2', label: '2) استشر صقر في قطعة مركّبة 🦅', triggerFalcon: true },
        { id: 't24_3', label: '3) اعرض كل الـ 14 قسم للورش 📋', queryText: 'كل اقسام الورش' },
      ],
    }),
  },

  // ت25 — الطبلية والصفحة الشخصية (واسترجاع الصورة خلال 8 ساعات)
  {
    id: 't25_family_profile',
    title: 'الطبلية والصفحة الشخصية واسترجاع الصور',
    keywords: ['طبليه', 'عيله الشمساويه', 'منتدي', 'صفحتي', 'بروفايل', 'معرض اعمالي', 'خصوصيه الصفحه', 'معاينه بعيون الزائر', 'رجع صوره', 'استرجاع صوره', '8 ساعات'],
    buildReply: (firstName) => ({
      reply:
        `👨‍👩‍👧‍👦 **"طبلية عيلة الشمساوية"** مكاننا لتبادل الخبرة وعرض الشغل.\n` +
        `و**صفحتك الشخصية** يا **${firstName}** فيها قصة البراند ومعرض لحد **6 أعمال**، وتتحكم مين يشوف إيه مع زرار **"معاينة بعيون الزائر"**.\n` +
        `ولو غيّرت صورة أو شعار بالغلط، تقدر ترجّعه خلال **8 ساعات** بضغطة واحدة!`,
      options: [
        { id: 't25_1', label: '1) افتح طبلية العيلة 👨‍👩‍👧‍👦', view: 'family' },
        { id: 't25_2', label: '2) عدّل صفحتي الشخصية 👤', view: 'personal_profile' },
        { id: 't25_3', label: '3) افتح متجري الخاص 🏪', view: 'my_store' },
      ],
    }),
  },

  // ت26 — المورد: المخزن والفروع
  {
    id: 't26_supplier_branches',
    title: 'المورد: المخزن المركزي والفروع والتوريد اليومي',
    keywords: ['مخزن مركزي', 'فرع', 'فروع', 'شجره الفروع', 'خزينه الفرع', 'توريد يومي'],
    buildReply: (firstName) => ({
      reply:
        `في بوابة المورد يا **${firstName}** 🌿 بتعرّف **مخزن رئيسي وأي عدد فروع**، ولكل فرع مخزنه وخزينته المستقلة.\n` +
        `و**التوريد النقدي اليومي** لخزينة المالك بيتم بضغطة تأكيد موثّقة.`,
      actionLink: { label: 'فتح مركز قيادة الفروع 🌿', view: 'supplier_erp_hub' },
      options: [
        { id: 't26_1', label: '1) افتح مركز قيادة الفروع 🌿', view: 'supplier_erp_hub' },
        { id: 't26_2', label: '2) التحويل بين الفروع 🔄', queryText: 'التحويل بين الفروع' },
        { id: 't26_3', label: '3) رصيد الخزائن الآن 💰', intentKey: 'sup_cash' },
      ],
    }),
  },

  // ت27 — الكاشير 80 مم والبيع بالوزن والكسور (مثل 2.4 كيلو)
  {
    id: 't27_pos_80mm',
    title: 'الكاشير 80 مم والبيع بالوزن والكسور',
    keywords: ['كاشير', 'pos', 'فاتوره كاشير', 'ريسيت', 'باركود', 'طابعه', '80 مم', 'دفع مختلط', 'بيع بالوزن', 'كسور', 'كيلو', '2.4'],
    buildReply: (firstName) => ({
      reply:
        `**الكاشير 80 مم** سريع وخفيف ومن غير صور عشان ما يهنجش في الزحمة يا **${firstName}** 🛒\n` +
        `بيبيع بالقطعة أو **بالوزن وبالكسور** (زي \`2.4 كجم\` أو \`1.75 متر\`)، وبيدعم **الباركود** و**الدفع المختلط** (كاش + إنستاباي + آجل) وطباعة فورية على طابعة **80 مم**.`,
      actionLink: { label: 'افتح الكاشير 80 مم الآن 🛒', view: 'supplier_pos' },
      options: [
        { id: 't27_1', label: '1) افتح الكاشير (POS) 🛒', view: 'supplier_pos' },
        { id: 't27_2', label: '2) شرائح الأسعار (جملة/قطاعي) 🏷️', queryText: 'شرائح الأسعار' },
        { id: 't27_3', label: '3) قفل الكاشير للفرع 🔒', queryText: 'العاملين وقفل الفرع' },
      ],
    }),
  },

  // ت28 — التحويل بين الفروع (مرحلتين)
  {
    id: 't28_branch_transfers',
    title: 'التحويل بين الفروع (مرحلتين)',
    keywords: ['تحويل بين الفروع', 'شحن بضاعه لفرع', 'قيد الاستلام', 'رفض الاستلام', 'نقل مخزن', 'استلام تحويل'],
    buildReply: (firstName) => ({
      reply:
        `التحويل بين الفروع بيتم على **مرحلتين بأمان كامل** يا **${firstName}** 🔄:\n` +
        `لما تشحن بضاعة لفرع بتتخصم من الراسل وتقف **"قيد الاستلام"**، وما بتتضافش لرصيد الفرع إلا لما أمين الفرع أو المالك يوافق؛ ولو رفض بترجع للراسل تلقائياً بقيد موثّق.`,
      actionLink: { label: 'إدارة المخازن والتحويلات 🏭', view: 'supplier_warehouse_erp' },
      options: [
        { id: 't28_1', label: '1) فتح المخازن والتحويلات 🏭', view: 'supplier_warehouse_erp' },
        { id: 't28_2', label: '2) مركز قيادة الفروع 🌿', view: 'supplier_erp_hub' },
        { id: 't28_3', label: '3) الكاشير 80 مم 🛒', view: 'supplier_pos' },
      ],
    }),
  },

  // ت29 — شرائح الأسعار (قطاعي/نص جملة/جملة)
  {
    id: 't29_price_tiers',
    title: 'شرائح الأسعار (قطاعي / نص جملة / جملة)',
    keywords: ['شرائح الاسعار', 'شريحه', 'نص جمله', 'جمله وقطاعي', 'سعر الكميه', 'خصم كميه', 'قارن اسعار'],
    buildReply: (firstName, isSupplier) => ({
      reply:
        `في **شرائح الأسعار** يا **${firstName}** بتحدد سعر **القطاعي، نص الجملة، والجملة** لكل خامة 🏷️\n` +
        `وأول ما العميل يطلب الكمية، السعر بيتغيّر أوتوماتيك في الكاشير والكتالوج بدون أي حساب يدوي!`,
      actionLink: {
        label: isSupplier ? 'اضبط شرائح الأسعار في كتالوجي 📦' : 'قارن عروض الموردين 🚚',
        view: isSupplier ? 'supplier_catalog' : 'suppliers',
      },
      options: [
        { id: 't29_1', label: '1) افتح الكتالوج والشرائح 📦', view: isSupplier ? 'supplier_catalog' : 'suppliers' },
        { id: 't29_2', label: '2) الكاشير 80 مم 🛒', queryText: 'كاشير 80 مم' },
        { id: 't29_3', label: '3) منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
      ],
    }),
  },

  // ت30 — العاملين والحضور وقفل الفرع
  {
    id: 't30_hr_kiosk',
    title: 'العاملين والحضور وقفل الكاشير للفرع',
    keywords: ['موظف', 'عامل', 'حضور', 'راتب', 'عموله', 'مندوب', 'hr', 'قفل الكاشير', 'قفل الفرع', 'kiosk'],
    buildReply: (firstName, isSupplier) => ({
      reply:
        `من شاشة **العاملين والحضور** يا **${firstName}** بتسجّل الموظفين، الحضور، الرواتب، والعمولات 👥\n` +
        (isSupplier
          ? `وكمان في ميزة **"قفل الفرع (Kiosk)"** بتثبّت جهاز الكاشير على شاشة بيع فرعه بس عشان الأمان الكامل.`
          : `وبتربط كل حرفي بأوامر التشغيل وأجوره وحسابه بسهولة.`),
      actionLink: {
        label: isSupplier ? 'شؤون العاملين وقفل الأجهزة 🖥️' : 'شؤون العاملين والحرفيين 👥',
        view: isSupplier ? 'supplier_hr_terminal' : 'hr',
      },
      options: [
        { id: 't30_1', label: '1) افتح شاشة العاملين 👥', view: isSupplier ? 'supplier_hr_terminal' : 'hr' },
        { id: 't30_2', label: '2) الكاشير 80 مم 🛒', view: 'supplier_pos' },
      ],
    }),
  },

  // ت31 — الدخول والحساب والبيانات مش ظاهرة ("ورشتي فاضيه")
  {
    id: 't31_missing_data_login',
    title: 'مشكلة الدخول أو البيانات مش ظاهرة',
    keywords: [
      'مش عارف ادخل',
      'نسيت الباسورد',
      'كلمه السر',
      'البيانات مش ظاهره',
      'اختفت',
      'ورشتي فاضيه',
      'مش لاقي حاجتي',
      'مفيش بيانات',
      'بياناتي ضاعت',
      'ممكن تضيع بياناتها',
    ],
    buildReply: (firstName) => ({
      reply:
        `ولا يهمك يا **${firstName}**، بياناتك محفوظة في حسابك وما ضاعتش 💛 جرّب الـ 3 خطوات دول:\n` +
        `1️⃣ **حدّث الصفحة بقوة:** على الكمبيوتر \`Ctrl+Shift+R\`، وعلى الموبايل امسح بيانات الموقع مرة واحدة.\n` +
        `2️⃣ اتأكد إنك داخل بنفس الإيميل المسجّل بيه.\n` +
        `3️⃣ اخرج وادخل تاني.. ولو لسه ما ظهرتش ابعت للدعم لقطة شاشة وهنحلّها فوراً!`,
      options: [
        { id: 't31_1', label: '1) المشكلة بطء أو نسخة قديمة 🔄', queryText: 'النسخة قديمة وبطيء' },
        { id: 't31_2', label: '2) بطاقة هلخصهالك 📋', intentKey: 'full_brief' },
        { id: 't31_3', label: '3) القائمة الرئيسية ☀️', queryText: 'قائمة' },
      ],
    }),
  },

  // ت32 — ما بتحمّلش / بطيئة / النسخة قديمة
  {
    id: 't32_slow_cache',
    title: 'البطء أو النسخة القديمة',
    keywords: ['بطيء', 'تقيل', 'ما بيفتحش', 'النسخه قديمه', 'التحديث ما ظهرش', 'علقت', 'معلق معاي'],
    buildReply: (firstName) => ({
      reply:
        `في حاجة مش ماشية صح بسبب إن المتصفح غالباً ماسك نسخة قديمة يا **${firstName}** 🔄\n` +
        `جرّب تعمل **تحديث بقوة (\`Ctrl+Shift+R\`)** أو امسح بيانات الموقع مرة واحدة، ولو النت ضعيف استنى ثواني والشغل المحلي هيكمّل معاك عادي. ولو لسه ما اتحلتش قولّي!`,
      options: [
        { id: 't32_1', label: '1) البيانات مش ظاهرة 🔍', queryText: 'ورشتي فاضيه' },
        { id: 't32_2', label: '2) القائمة الرئيسية ☀️', queryText: 'قائمة' },
      ],
    }),
  },

  // ت33 — السوبر أدمن
  {
    id: 't33_super_admin',
    title: 'لوحة قيادة السوبر أدمن',
    keywords: ['سياق الورشه', 'منتجات معلقه', 'خامه مقترحه', 'صفحه الهبوط', 'حقن تصميم', 'اخفاء صفحه', 'السوبر ادمن'],
    buildReply: (firstName) => ({
      reply:
        `من **لوحة قيادة السوبر أدمن** يا **${firstName}** 👑 (16 بطاقة قيادة):\n` +
        `بتختار **سياق الورشة** الأول، تراجع المنتجات المعلقة والخامات المقترحة، تتحكم في إظهار وإخفاء البوابات، وتعدّل صفحة الهبوط بمعاينة قبل النشر.`,
      options: [
        { id: 't33_1', label: '1) منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
        { id: 't33_2', label: '2) سوق الشمساوية 🛍️', view: 'marketplace' },
        { id: 't33_3', label: '3) القائمة الرئيسية ☀️', queryText: 'قائمة' },
      ],
    }),
  },

  // ت34 — الدفع والشحن والفاتورة الإلكترونية
  {
    id: 't34_payment_shipping',
    title: 'الدفع والشحن والفاتورة الإلكترونية',
    keywords: ['بطاقه', 'فيزا', 'فوري', 'بوسطه', 'شحن', 'تتبع', 'فاتوره الكترونيه', 'ضريبه', 'باي موب', 'تعريفه الشحن'],
    buildReply: (firstName) => ({
      reply:
        `حالياً يا **${firstName}** الدفع شغال **عند الاستلام** أو **تحويل يدوي (إنستاباي / فودافون كاش)** بإيصال، والشحن بـ **تعريفة المحافظات اليدوية** 🚚\n` +
        `أما الدفع بالبطاقات والشحن الآلي والفاتورة الإلكترونية فـ **لسه تحت التجهيز** ومش مفعّلين حالياً.`,
      options: [
        { id: 't34_1', label: '1) ضبط متجري وتعريفة الشحن 🏪', view: 'my_store' },
        { id: 't34_2', label: '2) الخزائن والتحويلات 💰', view: 'treasuries' },
        { id: 't34_3', label: '3) القائمة الرئيسية ☀️', queryText: 'قائمة' },
      ],
    }),
  },

  // الأجندة والمواعيد
  {
    id: 'appointments_and_tasks',
    title: 'الأجندة والمواعيد والمهام اليومية',
    keywords: ['موعد', 'مواعيد', 'اجنده', 'تقويم', 'مهام', 'ميعاد'],
    buildReply: (firstName) => ({
      reply:
        `📅 مواعيدك وأجندة الورشة جاهزة معاك يا **${firstName}**!\n` +
        `افتح تبويب **"المهام والأجندة"** فوق لمراجعة مواعيد التسليم والنواقص، وتقدر تسجّل موعد جديد وتضيفه لتقويم جوجل بضغطة واحدة.`,
      options: [
        { id: 'ap_1', label: '1) افتح المهام والأجندة 📅', action: 'open_agenda' },
        { id: 'ap_2', label: '2) سجّل موعد تسليم جديد ➕', action: 'new_appointment' },
        { id: 'ap_3', label: '3) أوامر التشغيل 🔨', view: 'work_orders' },
      ],
    }),
  },

  // الـ 14 قسم للورش
  {
    id: 'all_14_sections',
    title: 'أقسام الورش الـ 14 في المنظومة',
    keywords: ['كل اقسام', 'اقسام الورش', 'الورش الجديده', '50 ورشه', '14 قسم'],
    buildReply: (firstName) => {
      const list = MAIN_SECTIONS.map((s: MainSectionDefinition) => `• **${s.nameAr}:** ${s.description}`).join('\n');
      return {
        reply: `🏭 **الأقسام الـ 14 للورش داخل حاسبة الشمساوية يا ${firstName}:**\n${list}`,
        actionLink: { label: 'تجربة الورش في الحاسبة 🧮', view: 'calculator' },
        options: [
          { id: 's14_1', label: '1) افتح حاسبة التكاليف 🧮', view: 'calculator' },
          { id: 's14_2', label: '2) عايز أسعّر منتج 📐', queryText: 'عايز أسعّر منتج' },
          { id: 's14_3', label: '3) الخامات الموحدة 🏷️', view: 'unified_materials' },
        ],
      };
    },
  },

  // سؤال سريع من الجزء 9 — هل ينفع الفنان يشوف أسعار ورشة تانية؟
  {
    id: 'qa_privacy_policy',
    title: 'سياسة خصوصية الورش والأسعار',
    keywords: ['يشوف اسعار ورشه تانيه', 'ينفع الفنان يشوف', 'خصوصيه الورش', 'حد يشوف بياناتي'],
    buildReply: (firstName) => ({
      reply:
        `لأ يا **${firstName}**، كل ورشة وكل مورد بياناته ليه لوحده 100% 🔒 (خاماته، أسعار شرائه، عملاؤه، خزائنه، وأرباحه).\n` +
        `بس **منظومة الخامات الموحدة** وأسعار المورد اللي نشرها في كتالوجه العام هي اللي مفتوحة للكل.`,
      options: [
        { id: 'qp_1', label: '1) منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
        { id: 'qp_2', label: '2) بيانات ورشتي (هلخصهالك) 📋', intentKey: 'full_brief' },
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

  if (!bestCraft || bestScore < 4.5) return null;

  const section = MAIN_SECTIONS.find((s) => s.id === bestCraft!.mainSectionId);
  const relatedCrafts = SUB_CRAFTS_REGISTRY.filter(
    (c) => c.mainSectionId === bestCraft!.mainSectionId && c.id !== bestCraft!.id
  ).slice(0, 2);

  const formulaDetails: Record<string, string> = {
    macrame: '• المعادلة: طول الفتلة = الارتفاع × معامل العقدة (4.5–5.2) + الشراشيب + 20سم ربط، مع مضاعفات 4 + هالك 5% على الصافي.',
    zigzag: '• المعادلة: محيط البيضاوي بتقريب رامانوجان + المساحة الفيزيائية + استهلاك خيط المكوك ≈ 3.6× الطول + هالك 7%.',
    kilim: '• المعادلة: خيوط السداء (3.5–4.5 خيط/سم) + طول هدب النول 40سم + نسبة الانكماش.',
    punch_needle: '• المعادلة: قماش كانفاه/دك قطن (بهوامش شد 10سم) + معامل استهلاك الخيط λ + غراء لاتكس خلفي + هالك 5%.',
    resin: '• المعادلة: الحجم (سم³) × الكثافة ≈ 1.15 جم/سم³ مقسوم بنسبة الخلط + هالك صب 5% + إطفاء القالب + تهوية وكمامة A1.',
    polyester_resin: '• تحذير سلامة: تهوية قوية جداً وكمامة أبخرة + حساب نسبتي المصلب (1–2%) والمعجّل بدقة للوزن.',
    cold_process_soap: '• المعادلة: أرقام التصبن (SAP) للزيوت لحساب الصودا NaOH + السوبر فات + الماء + أمان كامل (نضارة وجوانتي والصودا على المية).',
    candles: '• المعادلة: وزن الشمع الصافي ÷ (1 + نسبة العطر 6%–10%) + الفتيل والبرطمان واللصق.',
    laser_cnc: '• المعادلة: مساحة القص والتعشيق للوح + دقائق تشغيل الماكينة × تكلفة الدقيقة (كهرباء + صيانة + تيوب).',
    '3d_printing': '• المعادلة: وزن الفيلمنت (جم) × الكثافة + معامل الفشل + ساعات الطابعة × (كهرباء + إهلاك).',
    leathercraft: '• المعادلة: مساحة الباترون الصافية ÷ عائد القص/التعشيق بدون تكرار الهالك + السوست والخيط والبطانة.',
    lighting_craft: '• تنبيه سلامة: إضافة الدواية والسلك والمفتاح مع اختبار العزل الكهربائي والحراري بواسطة فني مؤهل.',
  };

  const options: ShamousaChatbotOption[] = [
    { id: 'w_open_calc', label: `1) احسب ${bestCraft.nameAr} في الحاسبة 🧮`, view: 'calculator' },
    ...relatedCrafts.map((rc, i) => ({
      id: `rel_${rc.id}`,
      label: `${i + 2}) معادلة ${rc.nameAr}`,
      queryText: `معادلة ${rc.nameAr}`,
    })),
    { id: 'w_price_flow', label: 'تسعير قطعة خطوة بخطوة 📐', queryText: `عايز أسعّر ${bestCraft.nameAr}` },
  ];

  return {
    handled: true,
    confidence: bestScore >= 8 ? 'high' : 'medium',
    matchedTopicId: `workshop_${bestCraft.id}`,
    matchedKeyword: bestCraft.nameAr,
    reply:
      `🛠️ **ورشة "${bestCraft.nameAr}" يا ${firstName}** (${section?.nameAr || 'ورش المنظومة'})\n` +
      `• **الحساب:** ${bestCraft.description}\n` +
      (formulaDetails[bestCraft.id] ? `${formulaDetails[bestCraft.id]}\n` : '') +
      `• **أمثلة:** ${bestCraft.sampleCategories.slice(0, 4).join('، ')}`,
    actionLink: { label: `حساب ${bestCraft.nameAr} في الحاسبة 🧮`, view: 'calculator' },
    options,
  };
}

function matchUnifiedMaterialLocally(normQuery: string, tokens: string[], firstName: string): ShamousaLocalChatbotResult | null {
  // Check exact category prefix or master code e.g. TH, BD, TH0001
  const codeMatch = normQuery.match(/\b(th|bd|cl|wd|lt|mt|dc|ar|pk|pp|gl|ax|rs|fb|wx|pn)(\d{0,4})\b/i);
  const hasMarketAlias = SEEDED_UNIFIED_ALIASES.filter((a) =>
    normQuery.includes(normalizeArabicChatbotText(a.aliasName))
  );

  // Explicit 2-letter prefix only
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
          `• **الوصف:** ${cat.description} | **الوحدات:** ${cat.defaultUnitChain}\n` +
          (sampleLines ? `\n**أبرز الخامات بالقسم:**\n${sampleLines}` : ''),
        actionLink: { label: `تصفح قسم ${cat.prefix} في الخامات الموحدة 🏷️`, view: 'unified_materials' },
        options: [
          { id: 'um_cat_open', label: '1) افتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
          { id: 'um_cat_all', label: '2) اعرض باقي الأقسام الـ 12 📚', queryText: 'رموز اقسام الخامات الموحده' },
          { id: 'um_cat_add', label: '3) ضيف خامة جديدة ➕', queryText: 'ضيف خامة جديدة' },
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
          (exactMaster.artistAliases.length > 0 ? `• **مسميات شائعة:** ${exactMaster.artistAliases.join('، ')}\n` : '') +
          (exactMaster.safetyNote ? `• **تنبيه:** ${exactMaster.safetyNote}` : ''),
        actionLink: { label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
        options: [
          { id: 'um_m_open', label: '1) افتح الخامات الموحدة 🏷️', view: 'unified_materials' },
          { id: 'um_m_units', label: '2) سلاسل وحدات القياس ⚖️', queryText: 'سلاسل وحدات القياس' },
          { id: 'um_m_price', label: '3) تسعير قطعة بالخامة دي 🧮', queryText: 'عايز أسعّر منتج' },
        ],
      };
    }
  }

  // Detect explicit thickness e.g. "3 مم" / "3مللي"
  const thicknessMatch = normQuery.match(/(\d+(?:\.\d+)?)\s*(مم|مللي|ملي|mm)/i);
  const thicknessHint = thicknessMatch ? `${thicknessMatch[1]} مم` : '';

  const stopWords = new Set([
    'كود',
    'كوده',
    'كودها',
    'سعر',
    'سعره',
    'خامه',
    'خامات',
    'ايه',
    'ازاي',
    'فين',
    'ممكن',
    'عشان',
    'عايز',
    'عاوز',
    'عايزه',
    'بكام',
    'موحد',
    'موحده',
    'منظومه',
    'مم',
    'مللي',
    'ملي',
    'بيج',
    'ابيض',
    'اسود',
    'احمر',
    'ازرق',
    'اخضر',
    'رمادي',
    'كريمي',
    'اوفي',
    'اوف',
    'وايت',
    'انت',
    'انتي',
    'انتا',
    'شغاله',
    'شغالة',
    'شغال',
    'تشتغل',
    'تشتغلي',
    'ازاي',
    'ازاى',
    'كيف',
    'طريقه',
    'طريقة',
    'بتشتغل',
    'بتشتغلي',
    'بتعملي',
    'بتعمل',
    'ايه',
    'إيه',
    'مين',
    'ليه',
    'امتي',
    'امتى',
    'متي',
    'فين',
    'السلام',
    'سلام',
    'عليكم',
    'ورحمه',
    'الله',
    'وبركاته',
    'اهلا',
    'مرحبا',
    'صباح',
    'مساء',
    'الخير',
    'الفل',
    'النور',
    'ازيك',
    'ازيكم',
    'اخبارك',
    'هاي',
    'الو',
    'hello',
    'hi',
  ]);

  const meaningfulTokens = tokens.filter((t) => !stopWords.has(t) && !/^\d+(\.\d+)?$/.test(t));
  if (meaningfulTokens.length === 0 && hasMarketAlias.length === 0) return null;

  const scoredMasters: Array<{ master: UnifiedMaterialMaster; score: number }> = [];
  for (const m of SEEDED_UNIFIED_MASTERS) {
    const searchPool = [m.canonicalName, ...m.artistAliases, ...m.supplierAliases]
      .map((s) => normalizeArabicChatbotText(s))
      .join(' ');
    const poolTokens = tokenizeArabic(searchPool);

    let score = 0;
    for (const qt of meaningfulTokens) {
      const exactOrPrefix = poolTokens.some(
        (pt) => pt === qt || (qt.length >= 4 && (pt.startsWith(qt) || qt.startsWith(pt)))
      );
      if (exactOrPrefix) {
        score += qt.length >= 4 ? 4.5 : 3.2;
      } else {
        for (const pt of poolTokens) {
          const fm = fuzzyTokenMatches(qt, pt);
          if (fm >= 0.82) {
            score += 2.6;
            break;
          }
        }
      }
    }
    if (score >= 3) {
      scoredMasters.push({ master: m, score });
    }
  }

  if (scoredMasters.length === 0 && hasMarketAlias.length === 0) return null;

  scoredMasters.sort((a, b) => b.score - a.score);
  const topMasters = scoredMasters.slice(0, 5);
  const isCodeLookup = /كود|كوده|رقم|سيريال|مم|مللي|خيط|حبل|خرز|قطن|بوليستر|كردون/.test(normQuery);

  const aliasNote =
    hasMarketAlias.length > 0
      ? `\n🔄 **مسمى سوقي مربوط:** (${hasMarketAlias.map((a) => `"${a.aliasName}" = ${a.aliasCode}`).join(' / ')})`
      : '';

  const masterLines = topMasters
    .map(
      ({ master }) =>
        `• \`${master.code}\` — **${master.canonicalName}** (${master.unitChain})` +
        (thicknessHint && master.prefix === 'TH' ? ` · *السمك المطلوب: ${thicknessHint} متاح ضمن مقاسات الصنف*` : '')
    )
    .join('\n');

  const firstFound = topMasters[0]?.master;
  return {
    handled: true,
    confidence: topMasters[0]?.score >= 4.5 || isCodeLookup ? 'high' : 'medium',
    matchedTopicId: 'unified_materials_search',
    matchedKeyword: meaningfulTokens.join(' '),
    reply:
      `🔍 **أقرب الخامات الموحدة لسؤالك يا ${firstName}:**\n` +
      (masterLines || 'تم رصد مسمى سوقي مربوط بمنظومة الخامات الموحدة:') +
      aliasNote +
      `\n(تذكير: الكود بينزل تلقائي بمقاساته وألوانه أول ما تضيف الخامة لـ **خاماتي**).`,
    actionLink: { label: 'فتح منظومة الخامات الموحدة 🏷️', view: 'unified_materials' },
    options: [
      ...(firstFound
        ? [{ id: 'um_code_detail', label: `1) تفاصيل الكود ${firstFound.code} 🔎`, queryText: firstFound.code }]
        : []),
      { id: 'um_open_btn', label: '2) افتح الخامات الموحدة 🏷️', view: 'unified_materials' },
      { id: 'um_add_new', label: '3) ضيف خامة مش موجودة ➕', queryText: 'ضيف خامة جديدة' },
      { id: 'um_live_search', label: '4) دوّرلي على أسعار السوق أونلاين 🟢', triggerAI: true },
    ],
  };
}

/**
 * Resolve ANY user query locally first using:
 * 1) Strict Privacy Guard (Part 3)
 * 2) Off-Topic & Empathy Guards (Part 8 & Part 1)
 * 3) Stateful Multi-Turn Context & Numeric Option Selection (Part 6)
 * 4) Super Admin Custom Dictionary Rules (server + local)
 * 5) Pricing Flow A trigger ("عايز أسعّر قطعة مكرمية")
 * 6) Single-Word Disambiguation ("ريزن")
 * 7) Material Code Lookup ("خيط 3 مم بيج كوده ايه")
 * 8) All 34 Core Knowledge Topics + 50+ Workshops + Nearest-Keyword Clarification
 */
export function resolveShamousaLocalChatbot(
  rawQuery: string,
  options: {
    firstName: string;
    isSupplier: boolean;
    experienceMode?: UserExperienceMode;
    state?: ShamousaConversationState;
    history?: Array<{ role: string; content: string }>;
    accountId?: string;
    packageOptions?: AccountPackageQueryOptions;
  }
): ShamousaLocalChatbotResult {
  const { firstName, isSupplier, state, accountId, packageOptions } = options;
  const activeExperienceMode: UserExperienceMode = options.experienceMode || 'craft';
  const currentState: ShamousaConversationState = state || {};
  const nextTurnCount = (currentState.turnCount || 0) + 1;
  const normQuery = normalizeArabicChatbotText(rawQuery);
  const tokens = tokenizeArabic(rawQuery);

  const canBrief = accountId ? hasFeature('executive_brief', accountId, packageOptions) : true;
  const canCosting = accountId ? hasFeature('costing', accountId, packageOptions) : true;
  const canInventory = accountId ? hasFeature('inventory', accountId, packageOptions) : true;
  const canStorefront = accountId
    ? hasFeature('storefront', accountId, packageOptions) || hasFeature('catalog', accountId, packageOptions)
    : true;

  if (!normQuery) {
    return {
      handled: false,
      confidence: 'none',
      reply: '',
      nextState: currentState,
    };
  }

  // 1. STRICT PRIVACY GUARD — NEVER BYPASSED (Part 3 + Acceptance Tests #4 & #12)
  if (isCrossTenantOrSecretPrivacyQuery(rawQuery)) {
    const privOpts: ShamousaChatbotOption[] = canBrief
      ? SHAMOUSA_PRIVACY_OPTIONS.map((o) =>
          isSupplier && o.intentKey === 'full_brief'
            ? { ...o, label: 'بيانات متجري (هلخصهالك) 📋', intentKey: 'sup_full_brief' }
            : o
        )
      : [
          { id: 'priv_profile', label: 'راجع صفحتي الشخصية 👤', queryText: 'راجع صفحتي الشخصية' },
          { id: 'priv_new_prod', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
        ];
    return {
      handled: true,
      confidence: 'high',
      matchedTopicId: 'privacy_refusal',
      reply: SHAMOUSA_PRIVACY_REFUSAL_REPLY,
      options: privOpts,
      nextState: { lastTopicId: 'privacy_refusal', lastOptions: privOpts, turnCount: nextTurnCount },
    };
  }

  // 2. OFF-TOPIC REDIRECTION (Part 8 + Acceptance Test #10: "اتجوز")
  if (isOffTopicQuery(normQuery)) {
    const offOpts: ShamousaChatbotOption[] = [];
    offOpts.push({ id: 'off_new', label: '1) جهّز منتج جديد ✨', queryText: 'منتج جديد' });
    if (canStorefront) {
      offOpts.push({ id: 'off_rev', label: '2) راجع منتجاتي 🔍', queryText: 'راجع منتجاتي' });
    } else {
      offOpts.push({ id: 'off_prof', label: '2) راجع صفحتي الشخصية 👤', queryText: 'راجع صفحتي الشخصية' });
    }
    if (canBrief) {
      offOpts.push({
        id: 'off_brief',
        label: '3) هلخصهالك (الفلوس والمخزن) 💰',
        intentKey: isSupplier ? 'sup_full_brief' : 'full_brief',
      });
    } else {
      offOpts.push({ id: 'off_post', label: '3) اكتب لي بوست ✍️', queryText: 'اكتب لي بوست' });
    }
    offOpts.push({ id: 'off_4', label: '4) مواعيد ومهام اليوم 📅', action: 'open_agenda' });

    return {
      handled: true,
      confidence: 'high',
      matchedTopicId: 'off_topic_redirect',
      reply:
        `ده برّه تخصصي يا **${firstName}** 😄 أنا متخصصة في الشغل اليدوي ومنظومة الشمساوية.\n` +
        `تحب نرجع لشغلك ونظبّطه سوا؟`,
      options: offOpts,
      nextState: { lastTopicId: 'off_topic_redirect', lastOptions: offOpts, turnCount: nextTurnCount },
    };
  }

  // 3. CONTINUE ACTIVE MULTI-TURN FLOW (Part 6)
  if (currentState.activeFlow) {
    const flowReply = handleActiveFlowStep(rawQuery, normQuery, currentState, firstName, isSupplier);
    if (flowReply) return flowReply;
  }

  // 4. NUMERIC OPTION FOLLOW-UP FROM PREVIOUS MESSAGE ("1", "2", "3", "4")
  if (/^[1-4]$/.test(normQuery) && currentState.lastOptions && currentState.lastOptions.length > 0) {
    const picked = currentState.lastOptions[Number(normQuery) - 1];
    if (picked?.queryText) {
      return resolveShamousaLocalChatbot(picked.queryText, {
        ...options,
        state: { ...currentState, lastOptions: undefined },
      });
    }
    if (picked?.view) {
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'option_nav_followup',
        reply: `من عيوني يا **${firstName}** ☀️ اضغط هنا عشان أفتحلك **${picked.label}** مباشرة:`,
        actionLink: { label: picked.label, view: picked.view },
        nextState: { lastTopicId: 'option_nav_followup', turnCount: nextTurnCount },
      };
    }
  }

  // 5. ANGRY / FRUSTRATED USER EMPATHY (Part 1 & Part 8)
  if (isFrustratedOrAngryQuery(normQuery)) {
    const empOpts: ShamousaChatbotOption[] = [
      { id: 'emp_1', label: '1) بياناتي مش ظاهرة 🔍', queryText: 'ورشتي فاضيه' },
      { id: 'emp_2', label: '2) الشاشة بطيئة أو معلّقة 🔄', queryText: 'النسخة قديمة وبطيء' },
      {
        id: 'emp_3',
        label: canCosting ? '3) مشكلة في التسعير أو الربح 🧮' : '3) مراجعة صفحتي الشخصية 👤',
        queryText: canCosting ? 'ليه بخسر' : 'راجع صفحتي الشخصية',
      },
      { id: 'emp_4', label: '4) تواصل مع الدعم الفني 💬', queryText: 'ورشتي فاضيه' },
    ];
    return {
      handled: true,
      confidence: 'high',
      matchedTopicId: 'empathy_support',
      reply:
        `معاك حق تتضايق يا **${firstName}** 💛 ولا يهمك، تعالى نحلها واحدة واحدة بهدوء.\n` +
        `قولّي إيه بالظبط اللي مضايقك من دول عشان نعالجه فوراً:`,
      options: empOpts,
      nextState: { lastTopicId: 'empathy_support', lastOptions: empOpts, turnCount: nextTurnCount },
    };
  }

  // 6. SUPER ADMIN CUSTOM DICTIONARY RULES (HIGHEST PRIORITY — SYNCED FROM SERVER + LOCAL)
  const customRules = loadLocalShamousaRules();
  for (const rule of customRules) {
    const matched = rule.keywords.some((kw) => {
      const nkw = normalizeArabicChatbotText(kw);
      return nkw && (normQuery.includes(nkw) || tokens.some((t) => fuzzyTokenMatches(t, nkw) >= 0.85));
    });
    if (matched) {
      const ruleOpts: ShamousaChatbotOption[] = [
        { id: 'lr_menu', label: '1) القائمة الرئيسية ☀️', queryText: 'قائمة' },
        { id: 'lr_brief', label: '2) هلخصهالك 📋', intentKey: isSupplier ? 'sup_full_brief' : 'full_brief' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: `custom_rule_${rule.id}`,
        matchedKeyword: rule.title,
        reply: rule.answer,
        options: ruleOpts,
        nextState: { lastTopicId: `custom_rule_${rule.id}`, lastOptions: ruleOpts, turnCount: nextTurnCount },
      };
    }
  }

  // 7. GUIDED FLOW A TRIGGER — "عايز أسعّر قطعة مكرمية / منتج" (Acceptance Test #1)
  const wantsPricingFlow =
    /(عايز|عاوز|عايزه|نفسي|ممكن|ساعدني|ابدا|احسب).*?(اسعر|تسعير|سعر\s*(قطعه|منتج|شغل|حاج))|^(اسعر|سعر\s*لي|تسعير\s*(قطعه|منتج))/.test(
      normQuery
    );
  if (wantsPricingFlow) {
    const detectedCraft = detectCraftInQuery(normQuery);
    if (detectedCraft) {
      const step2Opts: ShamousaChatbotOption[] = [
        { id: 'fa_s2_yes', label: '1) أيوه، مسجلة جاهزة ✅', queryText: '1' },
        { id: 'fa_s2_no', label: '2) لأ، أسجّلها الأول 📦', queryText: '2' },
        { id: 'fa_s2_unsure', label: '3) مش متأكد 🔍', queryText: '3' },
        { id: 'fa_s2_calc', label: '4) افتح الحاسبة على طول 🧮', view: 'calculator' },
      ];
      return {
        handled: true,
        confidence: 'high',
        matchedTopicId: 'flow_a_pricing_craft_detected',
        reply:
          `سؤال حلو أوي يا **${firstName}** 👏 تعالى نسعّر قطعة **${detectedCraft}** سوا صح!\n` +
          `قولّي الأول: خامات القطعة دي مسجّلة عندك في مخزن الورشة بأسعارها ولا لسه؟`,
        options: step2Opts,
        nextState: {
          activeFlow: { flowId: 'flow_a_pricing', step: 2, data: { craft: detectedCraft } },
          lastTopicId: 'flow_a_pricing_craft_detected',
          lastOptions: step2Opts,
          turnCount: nextTurnCount,
        },
      };
    }

    const step1Opts: ShamousaChatbotOption[] = [
      { id: 'fa_c1', label: '1) مكرمية / كروشيه / تطريز 🧶', queryText: '1' },
      { id: 'fa_c2', label: '2) ريزن / شموع / صابون 🕯️', queryText: '2' },
      { id: 'fa_c3', label: '3) خشب / ليزر / 3D 🪵', queryText: '3' },
      { id: 'fa_c4', label: '4) حرفة تانية 🎨', queryText: '4' },
    ];
    return {
      handled: true,
      confidence: 'high',
      matchedTopicId: 'flow_a_pricing_step1',
      reply:
        `ماشي يا **${firstName}**، نظبّط التسعير سوا خطوة بخطوة 🧮\n` +
        `قولّي الأول: إيه الحرفة بتاعة المنتج؟`,
      options: step1Opts,
      nextState: {
        activeFlow: { flowId: 'flow_a_pricing', step: 1, data: {} },
        lastTopicId: 'flow_a_pricing_step1',
        lastOptions: step1Opts,
        turnCount: nextTurnCount,
      },
    };
  }

  // 8. SINGLE-WORD DISAMBIGUATION (Part 8 + Acceptance Test #5: "ريزن")
  const singleToken = tokens.length === 1 ? tokens[0] : '';
  if (singleToken && SINGLE_WORD_DISAMBIGUATION[singleToken]) {
    const info = SINGLE_WORD_DISAMBIGUATION[singleToken];
    const disOpts: ShamousaChatbotOption[] = [
      { id: 'sw_1', label: `1) الخامة وأكواد ${info.label} 🏷️`, queryText: `كود خامة ${singleToken}` },
      { id: 'sw_2', label: `2) تسعير منتج ${info.label} 🧮`, queryText: info.craftQuery },
      { id: 'sw_3', label: `3) أمان الشغل والنصائح 🦺`, queryText: info.safetyQuery },
      { id: 'sw_4', label: '4) حاجة تانية (هكتبها بأسلوبي) ✍️', queryText: 'قائمة' },
    ];
    return {
      handled: true,
      confidence: 'clarification',
      matchedTopicId: `single_word_${singleToken}`,
      reply: `تقصد إيه بالظبط عن **${info.label}** يا **${firstName}**؟ اختار اللي محتاجه:`,
      options: disOpts,
      nextState: { lastTopicId: `single_word_${singleToken}`, lastOptions: disOpts, turnCount: nextTurnCount },
    };
  }

  // 9. EXPLICIT MATERIAL CODE / ITEM LOOKUP (Acceptance Test #2: "خيط ٣ مم بيج كوده ايه")
  const looksLikeSpecificMaterialLookup =
    /\b(th|bd|cl|wd|lt|mt|dc|ar|pk|pp|gl|ax)\d*\b/i.test(normQuery) ||
    (/(خيط|حبل|كردون|مجدول|بوليستر|خرز|ايبوكسي|شمع|صودا|خشب|جلد|قماش|ورق|كرتون|علبه)/.test(normQuery) &&
      /(كود|كوده|مم|مللي|مقاس|سمك|رقم|لون|بيج|ابيض|اسود|موحده)/.test(normQuery));

  const materialMatch = canInventory ? matchUnifiedMaterialLocally(normQuery, tokens, firstName) : null;
  if (materialMatch && (looksLikeSpecificMaterialLookup || materialMatch.confidence === 'high')) {
    return {
      ...materialMatch,
      nextState: {
        lastTopicId: materialMatch.matchedTopicId,
        lastOptions: materialMatch.options,
        turnCount: nextTurnCount,
      },
    };
  }

  // 10. SCORE ALL 34+ CORE KNOWLEDGE TOPICS (EXACT + FUZZY TYPO-TOLERANT MATCHING)
  // فلتر الباقات المفعّلة: لا نقترح أبداً مواضيع من باقات غير مفعّلة في هذا الحساب
  const isTopicAllowedByPackage = (topicId: string, title: string): boolean => {
    const key = `${topicId} ${title}`;
    if (!canCosting && /(pricing|calc|cost|archive|work_order|تسعير|تكلف|تكاليف|أرشيف|ربح|هامش|مصنعية|هالك)/.test(key)) {
      return false;
    }
    if (!canInventory && /(unified|material|stock|inventory|purchas|خامات|مخزن|مخزون|مشتريات|جرد|كود خامة)/.test(key)) {
      return false;
    }
    if (!canBrief && /(brief|finance|treasury|expense|invoice|sales|customer|crm|مالي|خزينة|خزنة|فاتورة|فواتير|مبيعات|عملاء|مصروف|أصول|هلخصهالك)/.test(key)) {
      return false;
    }
    if (!canStorefront && /(store|catalog|market|متجر|كتالوج|سوق|نشر المنتج)/.test(key)) {
      return false;
    }
    return true;
  };

  const genericTopicStopWords = new Set([
    'ايه', 'ازاي', 'فين', 'كام', 'ليه', 'هو', 'هي', 'عن', 'من', 'في', 'علي', 'مع', 'ده', 'دي',
    'عايز', 'عاوز', 'عايزه', 'هل', 'ممكن', 'لو', 'بس', 'يعني', 'بتاع', 'بتاعه', 'عندي', 'عشان', 'مش', 'كل',
  ]);
  const contentTokens = tokens.filter((t) => !genericTopicStopWords.has(t));

  const scoredTopics = CORE_KNOWLEDGE_TOPICS.filter((topic) =>
    isTopicAllowedByPackage(topic.id, topic.title)
  ).map((topic) => {
    let score = 0;
    let matchedKw = '';
    for (const kw of topic.keywords) {
      const nkw = normalizeArabicChatbotText(kw);
      if (!nkw) continue;
      if (normQuery === nkw) {
        score += 14;
        matchedKw = kw;
      } else if (nkw.length <= 3 ? tokens.includes(nkw) : normQuery.includes(nkw)) {
        score += nkw.length >= 6 ? 9 : 5.5;
        matchedKw = matchedKw || kw;
      } else {
        const kwTokens = tokenizeArabic(nkw).filter((kt) => !genericTopicStopWords.has(kt));
        let kwHitScore = 0;
        for (const qt of contentTokens) {
          for (const kt of kwTokens) {
            const fm = fuzzyTokenMatches(qt, kt);
            if (fm >= 0.72) {
              kwHitScore += fm * 3.8;
              matchedKw = matchedKw || kw;
            }
          }
        }
        score += kwHitScore;
      }
    }
    return { topic, score, matchedKw };
  }).sort((a, b) => b.score - a.score);

  const topTopic = scoredTopics[0];
  const secondTopic = scoredTopics[1];

  // Clear winner among Core Knowledge Topics
  if (topTopic && topTopic.score >= 5) {
    if (
      secondTopic &&
      secondTopic.score >= 5.5 &&
      topTopic.score - secondTopic.score <= 1.0 &&
      topTopic.topic.id !== secondTopic.topic.id &&
      topTopic.score < 12
    ) {
      const clarOpts: ShamousaChatbotOption[] = [
        { id: `cl_1_${topTopic.topic.id}`, label: `1) ${topTopic.topic.title}`, queryText: topTopic.topic.keywords[0] },
        { id: `cl_2_${secondTopic.topic.id}`, label: `2) ${secondTopic.topic.title}`, queryText: secondTopic.topic.keywords[0] },
        { id: 'cl_3_live', label: '3) فعّل البحث المباشر على الإنترنت 🟢', triggerAI: true },
      ];
      return {
        handled: true,
        confidence: 'clarification',
        matchedTopicId: 'clarify_topics',
        reply: `تقصد أنهي واحد فيهم يا **${firstName}**؟ اختار من هنا:`,
        options: clarOpts,
        nextState: { lastTopicId: 'clarify_topics', lastOptions: clarOpts, turnCount: nextTurnCount },
      };
    }

    const built = topTopic.topic.buildReply(firstName, isSupplier, nextTurnCount, activeExperienceMode);
    return {
      handled: true,
      confidence: 'high',
      matchedTopicId: topTopic.topic.id,
      matchedKeyword: topTopic.matchedKw,
      reply: built.reply,
      options: built.options,
      actionLink: built.actionLink,
      handoffToFalcon: built.handoffToFalcon,
      nextState: {
        activeFlow: built.startFlow,
        lastTopicId: topTopic.topic.id,
        lastOptions: built.options,
        turnCount: nextTurnCount,
      },
    };
  }

  // Specific workshop formula match (50+ workshops)
  const workshopMatch = matchSpecificWorkshop(normQuery, tokens, firstName);
  if (workshopMatch) {
    return {
      ...workshopMatch,
      nextState: {
        lastTopicId: workshopMatch.matchedTopicId,
        lastOptions: workshopMatch.options,
        turnCount: nextTurnCount,
      },
    };
  }

  if (materialMatch) {
    return {
      ...materialMatch,
      nextState: {
        lastTopicId: materialMatch.matchedTopicId,
        lastOptions: materialMatch.options,
        turnCount: nextTurnCount,
      },
    };
  }

  // Medium nearest-keyword match -> guided clarification (handles typos nicely!)
  if (topTopic && topTopic.score >= 2.2) {
    const topSuggestions = scoredTopics
      .filter((s) => s.score >= 2.0)
      .slice(0, 3)
      .map((s, idx) => ({
        id: `near_${s.topic.id}`,
        label: `${idx + 1}) ${s.topic.title}`,
        queryText: s.topic.keywords[0],
      }));

    const nearOpts: ShamousaChatbotOption[] = [
      ...topSuggestions,
      { id: 'near_live', label: '4) دوّرلي بالبحث المباشر على النت 🟢', triggerAI: true },
    ];

    return {
      handled: true,
      confidence: 'clarification',
      matchedTopicId: 'nearest_keyword_clarify',
      matchedKeyword: topTopic.matchedKw,
      reply:
        `أقرب حاجة فهمتها من كلامك يا **${firstName}** لها علاقة بـ **"${topTopic.topic.title}"** ☀️\n` +
        `تقصد أنهي واحد من دول؟`,
      options: nearOpts,
      nextState: { lastTopicId: 'nearest_keyword_clarify', lastOptions: nearOpts, turnCount: nextTurnCount },
    };
  }

  // Fallback — اختياراته متكيّفة 100% مع باقات الحساب المفعّلة فقط
  const fallbackOpts: ShamousaChatbotOption[] = [];
  fallbackOpts.push({ id: 'fb_new', label: '1) تجهيز منتج جديد ✨', queryText: 'منتج جديد' });
  if (canStorefront) {
    fallbackOpts.push({ id: 'fb_rev', label: '2) مراجعة منتجاتي والمتجر 🔍', queryText: 'راجع منتجاتي' });
  } else {
    fallbackOpts.push({ id: 'fb_prof', label: '2) مراجعة صفحتي الشخصية 👤', queryText: 'راجع صفحتي الشخصية' });
  }
  if (canBrief) {
    fallbackOpts.push({
      id: 'fb_brief',
      label: '3) موقفي المالي (هلخصهالك) 💰',
      intentKey: isSupplier ? 'sup_full_brief' : 'full_brief',
    });
  } else if (canCosting) {
    fallbackOpts.push({ id: 'fb_price', label: '3) تسعير منتج خطوة بخطوة 🧮', queryText: 'عايز أسعّر منتج' });
  } else if (canInventory) {
    fallbackOpts.push({ id: 'fb_um', label: '3) منظومة الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' });
  } else {
    fallbackOpts.push({ id: 'fb_post', label: '3) اكتب لي بوست ✍️', queryText: 'اكتب لي بوست' });
  }
  fallbackOpts.push({ id: 'fb_dec', label: '4) التحليل والحلول الذكية 📊', queryText: 'التحليل والحلول الذكية' });

  return {
    handled: true,
    confidence: 'none',
    isUnanswered: true,
    matchedTopicId: 'guided_menu_fallback',
    reply:
      `ما فهمتش بالظبط يا **${firstName}**، ولا يهمك بتحصل 😊\n` +
      `اختار الأقرب للي تحب نعمله سوا دلوقتي من هنا:`,
    options: fallbackOpts,
    nextState: { lastTopicId: 'guided_menu_fallback', lastOptions: fallbackOpts, turnCount: nextTurnCount },
  };
}
