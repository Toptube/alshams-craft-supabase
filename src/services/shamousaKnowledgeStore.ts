/**
 * المخزن المعرفي لشموسة + محرك المطابقة المحلي (BM25/TF-IDF + Levenshtein + Trigrams)
 * + طابور الأسئلة غير المفهومة المنقّى من البيانات الشخصية + النسخ السابقة + التصدير والاستيراد + المقاييس
 * (الرسالة رقم 6 من 7 — الجزء E)
 *
 * القواعد الصارمة:
 * 1) طبقتان:
 *    - عام (Global): يعتمده السوبر أدمن فقط، يُحفظ في قاعدة البيانات الدائمة (Supabase عبر السيرفر)
 *      مع كاش محلي للعمل أوفلاين 100% + نسخ سابقة (snapshots) + تصدير/استيراد JSON.
 *    - خاص بالحساب (Private per accountId): تفضيلات الحساب وطابور أسئلته الخاصة لصاحبه فقط ولا ينتقل لحساب آخر.
 * 2) تنقية تامة للبيانات الشخصية (PII Stripping) قبل حفظ أي سؤال في الطابور العام:
 *    تُزال أرقام التليفون والإيميلات والروابط والأرقام الطويلة، وممنوع تماماً تخزين رقم الحساب أو اسم صاحبه.
 * 3) مواضيع السلامة (كيماويات، صودا كاوية، ريزن، حرارة، كهرباء، شموع، أطفال): مراجعة إلزامية + تحذير سلامة.
 * 4) المسودات لا تُعرض لأي مستخدم أبداً قبل اعتماد السوبر أدمن وتحويل حالتها إلى 'approved'.
 */

export type KnowledgeSourceType = 'library' | 'super_admin' | 'approved_draft';
export type KnowledgeStatusType = 'approved' | 'draft' | 'rejected';

export interface KnowledgeOptionChip {
  id: string;
  label: string;
  queryText: string;
}

export interface KnowledgeStoreEntry {
  id: string;
  topic: string;
  keywords: string[];
  synonyms: string[];
  questionVariants: string[];
  reply: string;
  options: KnowledgeOptionChip[];
  specialty: string;
  relatedPackage: string;
  source: KnowledgeSourceType;
  status: KnowledgeStatusType;
  version: number;
  safetyWarningAr?: string;
  requiresSafetyReview?: boolean;
  draftSourceNote?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * عنصر في الطابور العام للأسئلة غير المفهومة:
 * ممنوع تماماً احتواء أي accountId أو workshopId أو email أو اسم مستخدم!
 */
export interface GlobalUnansweredQueueItem {
  id: string;
  sanitizedQuestion: string;
  normKey: string;
  repeatCount: number;
  status: 'pending' | 'draft_ready' | 'approved' | 'ignored' | 'merged';
  draftAnswer?: string;
  draftSource?: string;
  requiresSafetyReview: boolean;
  safetyTopicsMatched?: string[];
  mergedIntoEntryId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AccountPrivateQueueItem {
  id: string;
  questionAr: string;
  askedAt: string;
  status: 'recorded' | 'answered_later';
}

export interface KnowledgeStoreSnapshot {
  snapshotId: string;
  version: number;
  labelAr: string;
  createdAt: string;
  entries: KnowledgeStoreEntry[];
}

export interface KnowledgeStoreMetrics {
  localAnsweredCount: number;
  aiAssistantUsedCount: number;
  localAnswerRatePercent: number;
  pendingQueueCount: number;
  approvedEntriesCount: number;
  draftEntriesCount: number;
  addedThisWeekCount: number;
  topRepeatedQuestions: Array<{ id: string; sanitizedQuestion: string; repeatCount: number }>;
}

export interface KnowledgeStoreState {
  schemaVersion: number;
  storeVersion: number;
  updatedAt: string;
  entries: KnowledgeStoreEntry[];
  unansweredQueue: GlobalUnansweredQueueItem[];
  snapshots: KnowledgeStoreSnapshot[];
  counters: {
    localAnsweredCount: number;
    aiAssistantUsedCount: number;
  };
}

export const SHAMOUSA_KB_STORAGE_KEY = 'alshams_shamousa_knowledge_store_v2';

// ============================================================================
// 1. تنظيف النص العربي + إزالة البيانات الشخصية (PII Stripping) + كشف السلامة
// ============================================================================

export function normalizeArabicKnowledgeText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * تنقية السؤال قبل حفظه في الطابور العام:
 * تزيل الإيميلات، الروابط، أرقام التليفون، وأي أرقام متسلسلة/معرّفات شخصية.
 */
export function sanitizeQuestionRemovePII(rawQuestion: string): string {
  let text = String(rawQuestion || '').trim();
  // تحويل الأرقام العربية-الهندية إلى لاتينية أولاً لضمان كشف كل أرقام التليفون
  text = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  // إزالة الإيميلات
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '');
  // إزالة الروابط
  text = text.replace(/(?:https?:\/\/|www\.)\S+/gi, '');
  text = text.replace(/\b[a-z0-9-]+\.(?:com|net|org|eg|io|me|app|site|shop|store)\S*/gi, '');
  // إزالة أرقام التليفونات المصرية والدولية (حتى لو فيها مسافات أو شرط)
  text = text.replace(/(?:\+|00)?\d[\d\s\-().]{6,}\d/g, '');
  // إزالة أي أرقام متبقية (أرقام حسابات/فواتير/كميات خاصة)
  text = text.replace(/\b\d+\b/g, '');
  // تنظيف المسافات الزائدة وعلامات الترقيم المكررة
  text = text.replace(/\s{2,}/g, ' ').replace(/^[\s،,.\-:;]+|[\s،,.\-:;]+$/g, '').trim();
  return text.slice(0, 320);
}

const SAFETY_KEYWORD_GROUPS: Array<{ labelAr: string; pattern: RegExp }> = [
  { labelAr: 'كيماويات ومواد كاوية', pattern: /(كيماويات|كيميائي|صودا\s*(?:ال)?كاوي[ةه]|بطاس|هيدروكسيد|حمض|احماض|أحماض|كلور|مذيب|تينر)/i },
  { labelAr: 'ريزن وإيبوكسي', pattern: /(ريزن|ايبوكسي|إيبوكسي|راتنج|مصلب|مصلّب|هاردنر)/i },
  { labelAr: 'حرارة ولهب', pattern: /(حراره|حرارة|نار|لهب|تورش|هيت جن|غليان|فرن|حرق)/i },
  { labelAr: 'كهرباء ومعدات قطع', pattern: /(كهرباء|كهربا|سلك|ليزر|cnc|منشار|لحام)/i },
  { labelAr: 'شموع وفتائل', pattern: /(شموع|شمع|فتيل|شمع ساخن|بارافين|صويا)/i },
  { labelAr: 'أطفال ومنتجات بشرة/طعام', pattern: /(اطفال|أطفال|رضيع|بيبي|اكل|طعام|بشره حساسه|بشرة حساسة)/i },
];

export const DEFAULT_SAFETY_WARNING_AR =
  '⚠️ تنبيه سلامة مهم: هذا الموضوع يتعامل مع خامات أو ظروف تحتاج احتياطات أمان (تهوية جيدة، قفازات، كمامة مناسبة، وإبعادها عن الأطفال ومصادر اللهب)، ويجب دائماً اتباع نشرة السلامة الخاصة بالشركة المصنّعة.';

export function detectSafetySensitiveTopic(rawText: string): {
  isSensitive: boolean;
  matchedTopics: string[];
  recommendedWarningAr?: string;
} {
  const norm = normalizeArabicKnowledgeText(rawText);
  const matched: string[] = [];
  for (const grp of SAFETY_KEYWORD_GROUPS) {
    if (grp.pattern.test(rawText) || grp.pattern.test(norm)) {
      matched.push(grp.labelAr);
    }
  }
  return {
    isSensitive: matched.length > 0,
    matchedTopics: matched,
    recommendedWarningAr: matched.length > 0 ? DEFAULT_SAFETY_WARNING_AR : undefined,
  };
}

// ============================================================================
// 2. حالة المخزن المحلي (العام + الخاص بالحساب) مع نسخ سابقة وتصدير/استيراد
// ============================================================================

function createInitialStoreState(): KnowledgeStoreState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    storeVersion: 1,
    updatedAt: now,
    entries: [
      {
        id: 'kb_seed_resin_bubbles',
        topic: 'فقاعات الهواء في الريزن',
        keywords: ['فقاعات', 'ريزن', 'بابلز', 'هوا في الريزن'],
        synonyms: ['فقاقيع ريزن', 'هواء ايبوكسي', 'ريزن فيه فقاعات'],
        questionVariants: [
          'ليه الريزن بيطلع فقاعات هوا؟',
          'إزاي أشيل فقاعات الهواء من الريزن؟',
          'عندي فقاعات في قطعة الريزن أعمل إيه؟',
        ],
        reply:
          'فقاعات الهوا في الريزن سببها غالباً تقليب سريع أو برودة الخامة/الغرفة أو صب طبقة سميكة جداً.\n' +
          '• **الحل:** دفّي الراتنج المقفول في حمام مياه دافئة (مش مغلي) قبل الخلط، قلّب ببطء وبقاع الكوب، اصب طبقات رفيعة، وأي استخدام لمصدر حرارة على السطح يكون حسب تعليمات الشركة المصنّعة.\n' +
          '• **الوقاية:** غرفة بحرارة ثابتة.\n' +
          '• **السلامة:** تهوية، قفازات، كمامة مناسبة، واتبع نشرة الخامة.',
        options: [
          { id: 'kb_opt_r1', label: 'أفكار تصوير وفيديو للريزن 🎬', queryText: 'أفكار فيديو وتصوير ريزن' },
          { id: 'kb_opt_r2', label: 'خامات الريزن الموحدة 🧶', queryText: 'خامات نموذجية للريزن' },
          { id: 'kb_opt_r3', label: 'باقات هدايا ريزن 🎁', queryText: 'باقات ريزن' },
        ],
        specialty: 'ريزن',
        relatedPackage: 'core_free',
        source: 'library',
        status: 'approved',
        version: 1,
        safetyWarningAr: 'تهوية، قفازات، كمامة مناسبة، واتبع نشرة الخامة.',
        requiresSafetyReview: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'kb_seed_macrame_fraying',
        topic: 'تفتيل حبل المكرمية وظهور شعيرات',
        keywords: ['حبل بيفتل', 'شعيرات', 'مكرمية', 'خيط مكرمية'],
        synonyms: ['تفتيل الحبل', 'الحبل بينسل', 'شراشيب بتفتل'],
        questionVariants: [
          'الحبل بيفتل ويطلع شعيرات أعمل إيه؟',
          'ليه خيط المكرمية بينسل معايا؟',
          'إزاي أظبط أطراف حبل المكرمية من غير ما تفتل؟',
        ],
        reply:
          'تفتيل الحبل وظهور الشعيرات في المكرمية سببه غالباً حبل جودته ضعيفة أو شد زايد أو قص بدون تشطيب.\n' +
          '• **الحل:** حبل مجدول جودة أفضل، شد متوازن، تسريح الأطراف وقصها بالتساوي وتشطيبها.\n' +
          '• **الوقاية:** اختيار الحبل المناسب للقطعة.',
        options: [
          { id: 'kb_opt_m1', label: 'خامة قطن مجدول في المنظومة 🧶', queryText: 'خامة قطن مجدول' },
          { id: 'kb_opt_m2', label: 'أفكار باقات مكرمية 🎁', queryText: 'باقات مكرمية' },
          { id: 'kb_opt_m3', label: 'التحليل الفني لورشتي 🔧', queryText: 'اعمليلي تحليل فني لورشتي' },
        ],
        specialty: 'مكرمية',
        relatedPackage: 'core_free',
        source: 'library',
        status: 'approved',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    unansweredQueue: [],
    snapshots: [],
    counters: {
      localAnsweredCount: 0,
      aiAssistantUsedCount: 0,
    },
  };
}

let inMemoryKB: KnowledgeStoreState | null = null;

export function loadKnowledgeStoreState(): KnowledgeStoreState {
  if (inMemoryKB) return inMemoryKB;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SHAMOUSA_KB_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<KnowledgeStoreState>;
        const base = createInitialStoreState();
        inMemoryKB = {
          schemaVersion: Number(parsed.schemaVersion || 1),
          storeVersion: Number(parsed.storeVersion || 1),
          updatedAt: parsed.updatedAt || base.updatedAt,
          entries: Array.isArray(parsed.entries) && parsed.entries.length > 0 ? parsed.entries : base.entries,
          unansweredQueue: Array.isArray(parsed.unansweredQueue) ? parsed.unansweredQueue : [],
          snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
          counters: {
            localAnsweredCount: Number(parsed.counters?.localAnsweredCount || 0),
            aiAssistantUsedCount: Number(parsed.counters?.aiAssistantUsedCount || 0),
          },
        };
        return inMemoryKB;
      }
    } catch {
      // ignore storage read error
    }
  }
  inMemoryKB = createInitialStoreState();
  return inMemoryKB;
}

export function saveKnowledgeStoreState(next: KnowledgeStoreState): KnowledgeStoreState {
  const stamped: KnowledgeStoreState = {
    ...next,
    updatedAt: new Date().toISOString(),
  };
  inMemoryKB = stamped;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SHAMOUSA_KB_STORAGE_KEY, JSON.stringify(stamped));
    } catch {
      // ignore storage quota errors
    }
  }
  return stamped;
}

export function resetKnowledgeStoreForTest(): void {
  inMemoryKB = createInitialStoreState();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(SHAMOUSA_KB_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function hydrateKnowledgeStoreFromServer(serverPayload: Partial<KnowledgeStoreState> | null | undefined): void {
  if (!serverPayload || typeof serverPayload !== 'object') return;
  try {
    const local = loadKnowledgeStoreState();
    const serverEntries = Array.isArray(serverPayload.entries) ? serverPayload.entries : [];
    const serverQueue = Array.isArray(serverPayload.unansweredQueue) ? serverPayload.unansweredQueue : local.unansweredQueue;
    const serverSnaps = Array.isArray(serverPayload.snapshots) ? serverPayload.snapshots : local.snapshots;

    // دمج ذكي: السيرفر (Supabase) هو المصدر المعتمد للطبقة العامة
    const byId = new Map<string, KnowledgeStoreEntry>();
    for (const e of local.entries) byId.set(e.id, e);
    for (const e of serverEntries) byId.set(e.id, e);

    saveKnowledgeStoreState({
      schemaVersion: Number(serverPayload.schemaVersion || local.schemaVersion || 1),
      storeVersion: Math.max(Number(serverPayload.storeVersion || 1), local.storeVersion),
      updatedAt: serverPayload.updatedAt || new Date().toISOString(),
      entries: Array.from(byId.values()),
      unansweredQueue: serverQueue,
      snapshots: serverSnaps,
      counters: {
        localAnsweredCount: Math.max(
          Number(serverPayload.counters?.localAnsweredCount || 0),
          local.counters.localAnsweredCount
        ),
        aiAssistantUsedCount: Math.max(
          Number(serverPayload.counters?.aiAssistantUsedCount || 0),
          local.counters.aiAssistantUsedCount
        ),
      },
    });
  } catch {
    // keep local safely
  }
}

function pushSnapshotBeforeMutation(state: KnowledgeStoreState, labelAr: string): KnowledgeStoreSnapshot[] {
  const snap: KnowledgeStoreSnapshot = {
    snapshotId: `snap_v${state.storeVersion}_${Date.now().toString(36)}`,
    version: state.storeVersion,
    labelAr,
    createdAt: new Date().toISOString(),
    entries: state.entries.map((e) => ({ ...e })),
  };
  return [snap, ...(state.snapshots || [])].slice(0, 15);
}

// ============================================================================
// 3. الطبقة الخاصة بكل حساب (طابور خاص لصاحب الحساب فقط — معزول 100%)
// ============================================================================

const PRIVATE_QUEUE_MEM = new Map<string, AccountPrivateQueueItem[]>();

function privateQueueStorageKey(accountId?: string | null): string {
  return `alshams_shamousa_private_queue_${accountId || 'guest'}`;
}

export function loadAccountPrivateQueue(accountId?: string | null): AccountPrivateQueueItem[] {
  const key = accountId || 'guest';
  if (PRIVATE_QUEUE_MEM.has(key)) {
    return [...(PRIVATE_QUEUE_MEM.get(key) || [])];
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(privateQueueStorageKey(key));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          PRIVATE_QUEUE_MEM.set(key, parsed);
          return [...parsed];
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export function recordAccountPrivateUnanswered(accountId: string | null | undefined, rawQuestion: string): void {
  try {
    const key = accountId || 'guest';
    const current = loadAccountPrivateQueue(key);
    const nextItem: AccountPrivateQueueItem = {
      id: `pq_priv_${Date.now().toString(36)}`,
      questionAr: String(rawQuestion || '').trim().slice(0, 300),
      askedAt: new Date().toISOString(),
      status: 'recorded',
    };
    const next = [nextItem, ...current].slice(0, 40);
    PRIVATE_QUEUE_MEM.set(key, next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(privateQueueStorageKey(key), JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

export function clearAccountPrivateQueueForTest(accountId: string): void {
  const key = accountId || 'guest';
  PRIVATE_QUEUE_MEM.delete(key);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(privateQueueStorageKey(key));
    } catch {
      // ignore
    }
  }
}

// ============================================================================
// 4. محرك المطابقة المحلي (BM25/TF-IDF + Levenshtein + Trigrams + حد ثقة)
// ============================================================================

const ARABIC_STOPWORDS = new Set([
  'في', 'من', 'علي', 'على', 'الي', 'إلى', 'عن', 'مع', 'او', 'أو', 'و', 'يا', 'هو', 'هي', 'انا', 'انت',
  'ايه', 'ازاي', 'ليه', 'عشان', 'لو', 'هل', 'ما', 'مش', 'ده', 'دي', 'اللي', 'عند', 'عندي', 'عايز', 'عايزه',
  'ممكن', 'لو سمحت', 'اعمل', 'اعمل ايه', 'فيني', 'فيها', 'منه', 'منها',
]);

function tokenizeArabic(text: string): string[] {
  return normalizeArabicKnowledgeText(text)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !ARABIC_STOPWORDS.has(w));
}

/** مسافة ليفنشتاين لتحمل الأخطاء الإملائية */
export function levenshteinDistance(a: string, b: string): number {
  const s = a || '';
  const t = b || '';
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const dp: number[] = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const temp = dp[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[t.length];
}

function normalizedLevenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/** تشابه ثلاثيات الحروف (Trigrams) لمطابقة الأخطاء الإملائية والصيغ المتقاربة */
export function trigramSimilarity(a: string, b: string): number {
  const na = `  ${normalizeArabicKnowledgeText(a)}  `;
  const nb = `  ${normalizeArabicKnowledgeText(b)}  `;
  if (na.trim().length < 2 || nb.trim().length < 2) return 0;

  const setA = new Set<string>();
  const setB = new Set<string>();
  for (let i = 0; i <= na.length - 3; i++) setA.add(na.slice(i, i + 3));
  for (let i = 0; i <= nb.length - 3; i++) setB.add(nb.slice(i, i + 3));

  let intersection = 0;
  setA.forEach((g) => {
    if (setB.has(g)) intersection++;
  });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface KnowledgeMatchCandidate {
  entry: KnowledgeStoreEntry;
  confidence: number; // 0..1
  bm25Score: number;
  fuzzyScore: number;
}

export interface KnowledgeSearchResult {
  tier: 'confident' | 'candidates' | 'unanswered';
  bestMatch?: KnowledgeMatchCandidate;
  topCandidates: KnowledgeMatchCandidate[];
}

export const KB_CONFIDENT_THRESHOLD = 0.52;
export const KB_CANDIDATE_FLOOR = 0.24;

/**
 * يبحث في المدخلات المعتمدة فقط (`status === 'approved'`) باستخدام:
 * BM25 على الكلمات المفتاحية والمرادفات وصيغ السؤال + Levenshtein + Trigram للأخطاء الإملائية.
 */
export function searchKnowledgeStoreLocal(
  rawQuery: string,
  options?: { entriesOverride?: KnowledgeStoreEntry[] }
): KnowledgeSearchResult {
  try {
    const queryNorm = normalizeArabicKnowledgeText(rawQuery);
    const queryTokens = tokenizeArabic(rawQuery);
    if (!queryNorm || queryTokens.length === 0) {
      return { tier: 'unanswered', topCandidates: [] };
    }

    const entries = (options?.entriesOverride || loadKnowledgeStoreState().entries).filter(
      (e) => e.status === 'approved'
    );
    if (entries.length === 0) {
      return { tier: 'unanswered', topCandidates: [] };
    }

    // بناء وثائق BM25 لكل مدخل (الموضوع + الكلمات المفتاحية + المرادفات + صيغ السؤال)
    const docs = entries.map((entry) => {
      const phrases = [
        entry.topic,
        ...entry.keywords,
        ...entry.synonyms,
        ...entry.questionVariants,
      ].filter(Boolean);
      const tokens = phrases.flatMap((p) => tokenizeArabic(p));
      return { entry, phrases, tokens };
    });

    const N = docs.length;
    const avgDocLen = Math.max(1, docs.reduce((s, d) => s + d.tokens.length, 0) / N);
    const k1 = 1.4;
    const b = 0.7;

    // Document Frequency (مع تسامح ليفنشتاين للأخطاء الإملائية البسيطة)
    const tokenMatchesTerm = (qt: string, dt: string): number => {
      if (qt === dt) return 1.0;
      if (qt.length >= 4 && dt.length >= 4 && (dt.includes(qt) || qt.includes(dt))) return 0.82;
      if (qt.length >= 4 && dt.length >= 4) {
        const sim = normalizedLevenshteinSimilarity(qt, dt);
        if (sim >= 0.75) return sim * 0.85;
      }
      return 0;
    };

    const idfMap = new Map<string, number>();
    for (const qt of Array.from(new Set(queryTokens))) {
      let df = 0;
      for (const d of docs) {
        if (d.tokens.some((dt) => tokenMatchesTerm(qt, dt) > 0)) df++;
      }
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      idfMap.set(qt, Math.max(0.25, idf));
    }

    const maxPossibleBm25 = queryTokens.reduce((s, qt) => s + (idfMap.get(qt) || 0.5) * 1.4, 0) || 1;
    const scored: KnowledgeMatchCandidate[] = [];

    for (const doc of docs) {
      let bm25Raw = 0;
      let matchedQueryTokens = 0;

      for (const qt of queryTokens) {
        let tf = 0;
        for (const dt of doc.tokens) {
          tf += tokenMatchesTerm(qt, dt);
        }
        if (tf > 0) {
          matchedQueryTokens++;
          const idf = idfMap.get(qt) || 0.5;
          const denom = tf + k1 * (1 - b + b * (doc.tokens.length / avgDocLen));
          bm25Raw += idf * ((tf * (k1 + 1)) / denom);
        }
      }

      const bm25Norm = Math.min(1, bm25Raw / maxPossibleBm25);
      const coverage = matchedQueryTokens / queryTokens.length;

      // أفضل تشابه تقريبي (Trigram + مطابقة عبارات) عبر الكلمات المفتاحية وصيغ السؤال
      let bestFuzzy = 0;
      let exactPhraseBonus = 0;
      for (const ph of doc.phrases) {
        const nph = normalizeArabicKnowledgeText(ph);
        if (!nph) continue;
        if (queryNorm === nph) {
          exactPhraseBonus = Math.max(exactPhraseBonus, 0.35);
        } else if (nph.length >= 4 && (queryNorm.includes(nph) || nph.includes(queryNorm))) {
          exactPhraseBonus = Math.max(exactPhraseBonus, 0.22);
        }
        const tg = trigramSimilarity(queryNorm, nph);
        if (tg > bestFuzzy) bestFuzzy = tg;
      }

      const confidence = Math.min(
        1,
        bm25Norm * 0.45 + coverage * 0.32 + bestFuzzy * 0.23 + exactPhraseBonus
      );

      if (confidence >= KB_CANDIDATE_FLOOR) {
        scored.push({
          entry: doc.entry,
          confidence: Math.round(confidence * 1000) / 1000,
          bm25Score: Math.round(bm25Norm * 1000) / 1000,
          fuzzyScore: Math.round(bestFuzzy * 1000) / 1000,
        });
      }
    }

    scored.sort((a, b) => b.confidence - a.confidence);
    const top3 = scored.slice(0, 3);

    if (top3.length > 0 && top3[0].confidence >= KB_CONFIDENT_THRESHOLD) {
      return {
        tier: 'confident',
        bestMatch: top3[0],
        topCandidates: top3,
      };
    }

    if (top3.length > 0) {
      return {
        tier: 'candidates',
        topCandidates: top3,
      };
    }

    return { tier: 'unanswered', topCandidates: [] };
  } catch {
    return { tier: 'unanswered', topCandidates: [] };
  }
}

// ============================================================================
// 5. إدارة الطابور العام المنقّى + CRUD للسوبر أدمن + التصدير والاستيراد + المقاييس
// ============================================================================

export function enqueueUnansweredQuestionSanitized(
  rawQuestion: string,
  accountId?: string | null
): {
  globalItem: GlobalUnansweredQueueItem | null;
  sanitizedQuestion: string;
  userReply: string;
  userOptions: KnowledgeOptionChip[];
} {
  // 1) تسجيل نسخة في الطابور الخاص بصاحب الحساب فقط (تظهر له وحده)
  if (accountId) {
    recordAccountPrivateUnanswered(accountId, rawQuestion);
  }

  // 2) تنقية السؤال من كل البيانات الشخصية قبل الطابور العام (ممنوع رقم الحساب أو الاسم!)
  const sanitized = sanitizeQuestionRemovePII(rawQuestion);
  const normKey = normalizeArabicKnowledgeText(sanitized);
  let globalItem: GlobalUnansweredQueueItem | null = null;

  if (sanitized.length >= 3 && normKey.length >= 3) {
    const state = loadKnowledgeStoreState();
    const queue = [...state.unansweredQueue];
    const now = new Date().toISOString();
    const safety = detectSafetySensitiveTopic(sanitized);

    // دمج الأسئلة المتشابهة وعدّ التكرار
    const existingIdx = queue.findIndex(
      (q) =>
        q.status !== 'approved' &&
        q.status !== 'merged' &&
        (q.normKey === normKey || trigramSimilarity(q.normKey, normKey) >= 0.78)
    );

    if (existingIdx >= 0) {
      globalItem = {
        ...queue[existingIdx],
        repeatCount: queue[existingIdx].repeatCount + 1,
        lastSeenAt: now,
        requiresSafetyReview: queue[existingIdx].requiresSafetyReview || safety.isSensitive,
      };
      queue[existingIdx] = globalItem;
    } else {
      globalItem = {
        id: `uq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        sanitizedQuestion: sanitized,
        normKey,
        repeatCount: 1,
        status: 'pending',
        requiresSafetyReview: safety.isSensitive,
        safetyTopicsMatched: safety.matchedTopics,
        firstSeenAt: now,
        lastSeenAt: now,
      };
      queue.unshift(globalItem);
    }

    saveKnowledgeStoreState({
      ...state,
      unansweredQueue: queue.slice(0, 300),
    });
  }

  return {
    globalItem,
    sanitizedQuestion: sanitized,
    userReply:
      'ما لقيتش إجابة مؤكدة. سجّلت سؤالك عشان نضيفه. تحب:\n' +
      '1) أجرّب أقرب موضوع\n' +
      '2) أسأل المساعد الذكي (لو متاح)\n' +
      '3) أحوّلك للدعم',
    userOptions: [
      { id: 'uq_opt_nearest', label: '1) جرّبي أقرب موضوع 🔍', queryText: `أقرب موضوع لـ: ${sanitized || rawQuestion}` },
      { id: 'uq_opt_ai', label: '2) اسأل المساعد الذكي ✨', queryText: `__FORCE_AI__:${rawQuestion}` },
      { id: 'uq_opt_support', label: '3) حوّليني للدعم 💬', queryText: 'عايز أتواصل مع الدعم الفني' },
    ],
  };
}

export function recordShamousaAnswerMetric(channel: 'local' | 'ai'): void {
  try {
    const state = loadKnowledgeStoreState();
    saveKnowledgeStoreState({
      ...state,
      counters: {
        localAnsweredCount: state.counters.localAnsweredCount + (channel === 'local' ? 1 : 0),
        aiAssistantUsedCount: state.counters.aiAssistantUsedCount + (channel === 'ai' ? 1 : 0),
      },
    });
  } catch {
    // ignore
  }
}

export function upsertKnowledgeEntryBySuperAdmin(params: {
  id?: string;
  topic: string;
  keywords: string[];
  synonyms?: string[];
  questionVariants?: string[];
  reply: string;
  options?: KnowledgeOptionChip[];
  specialty?: string;
  relatedPackage?: string;
  source?: KnowledgeSourceType;
  status?: KnowledgeStatusType;
  safetyWarningAr?: string;
  linkedQueueItemId?: string;
}): { entry: KnowledgeStoreEntry; state: KnowledgeStoreState } {
  const state = loadKnowledgeStoreState();
  const now = new Date().toISOString();
  const snapshots = pushSnapshotBeforeMutation(state, `قبل تعديل: ${params.topic.slice(0, 40)}`);

  const safety = detectSafetySensitiveTopic(`${params.topic} ${params.reply} ${params.keywords.join(' ')}`);
  const finalWarning = params.safetyWarningAr?.trim() || (safety.isSensitive ? DEFAULT_SAFETY_WARNING_AR : undefined);

  const existingIdx = params.id ? state.entries.findIndex((e) => e.id === params.id) : -1;
  let entry: KnowledgeStoreEntry;
  const nextEntries = [...state.entries];

  if (existingIdx >= 0) {
    const prev = nextEntries[existingIdx];
    entry = {
      ...prev,
      topic: params.topic.trim(),
      keywords: Array.from(new Set(params.keywords.map((k) => k.trim()).filter(Boolean))),
      synonyms: Array.from(new Set((params.synonyms || prev.synonyms).map((s) => s.trim()).filter(Boolean))),
      questionVariants: Array.from(
        new Set((params.questionVariants || prev.questionVariants).map((q) => q.trim()).filter(Boolean))
      ),
      reply: params.reply.trim(),
      options: params.options || prev.options,
      specialty: params.specialty?.trim() || prev.specialty || 'عام',
      relatedPackage: params.relatedPackage?.trim() || prev.relatedPackage || 'core_free',
      source: params.source || prev.source,
      status: params.status || 'approved',
      version: prev.version + 1,
      safetyWarningAr: finalWarning,
      requiresSafetyReview: safety.isSensitive,
      updatedAt: now,
    };
    nextEntries[existingIdx] = entry;
  } else {
    entry = {
      id: params.id || `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      topic: params.topic.trim(),
      keywords: Array.from(new Set(params.keywords.map((k) => k.trim()).filter(Boolean))),
      synonyms: Array.from(new Set((params.synonyms || []).map((s) => s.trim()).filter(Boolean))),
      questionVariants: Array.from(new Set((params.questionVariants || []).map((q) => q.trim()).filter(Boolean))),
      reply: params.reply.trim(),
      options: params.options || [],
      specialty: params.specialty?.trim() || 'عام',
      relatedPackage: params.relatedPackage?.trim() || 'core_free',
      source: params.source || 'super_admin',
      status: params.status || 'approved',
      version: 1,
      safetyWarningAr: finalWarning,
      requiresSafetyReview: safety.isSensitive,
      createdAt: now,
      updatedAt: now,
    };
    nextEntries.unshift(entry);
  }

  let nextQueue = [...state.unansweredQueue];
  if (params.linkedQueueItemId) {
    nextQueue = nextQueue.map((q) =>
      q.id === params.linkedQueueItemId
        ? {
            ...q,
            status: (params.status || 'approved') === 'approved' ? 'approved' : 'draft_ready',
            draftAnswer: params.reply.trim(),
          }
        : q
    );
  }

  const savedState = saveKnowledgeStoreState({
    ...state,
    storeVersion: state.storeVersion + 1,
    entries: nextEntries,
    unansweredQueue: nextQueue,
    snapshots,
  });
  return { entry, state: savedState };
}

export function saveDraftOnQueueItem(
  queueItemId: string,
  draftAnswer: string,
  draftSource: string
): KnowledgeStoreState {
  const state = loadKnowledgeStoreState();
  const safety = detectSafetySensitiveTopic(draftAnswer);
  const nextQueue = state.unansweredQueue.map((q) =>
    q.id === queueItemId
      ? {
          ...q,
          status: 'draft_ready' as const,
          draftAnswer: draftAnswer.trim(),
          draftSource: draftSource.trim(),
          requiresSafetyReview: q.requiresSafetyReview || safety.isSensitive,
        }
      : q
  );
  return saveKnowledgeStoreState({ ...state, unansweredQueue: nextQueue });
}

export function ignoreQueueItem(queueItemId: string): KnowledgeStoreState {
  const state = loadKnowledgeStoreState();
  const nextQueue = state.unansweredQueue.map((q) =>
    q.id === queueItemId ? { ...q, status: 'ignored' as const } : q
  );
  return saveKnowledgeStoreState({ ...state, unansweredQueue: nextQueue });
}

export function mergeQueueItemIntoExistingEntry(
  queueItemId: string,
  targetEntryId: string
): { ok: boolean; state: KnowledgeStoreState } {
  const state = loadKnowledgeStoreState();
  const qItem = state.unansweredQueue.find((q) => q.id === queueItemId);
  const targetIdx = state.entries.findIndex((e) => e.id === targetEntryId);
  if (!qItem || targetIdx < 0) return { ok: false, state };

  const snapshots = pushSnapshotBeforeMutation(state, `قبل دمج سؤال في: ${state.entries[targetIdx].topic}`);
  const target = state.entries[targetIdx];
  const newTokens = tokenizeArabic(qItem.sanitizedQuestion).slice(0, 6);
  const updatedEntry: KnowledgeStoreEntry = {
    ...target,
    questionVariants: Array.from(new Set([...target.questionVariants, qItem.sanitizedQuestion])),
    synonyms: Array.from(new Set([...target.synonyms, ...newTokens])),
    version: target.version + 1,
    updatedAt: new Date().toISOString(),
  };

  const nextEntries = [...state.entries];
  nextEntries[targetIdx] = updatedEntry;
  const nextQueue = state.unansweredQueue.map((q) =>
    q.id === queueItemId ? { ...q, status: 'merged' as const, mergedIntoEntryId: targetEntryId } : q
  );

  const saved = saveKnowledgeStoreState({
    ...state,
    storeVersion: state.storeVersion + 1,
    entries: nextEntries,
    unansweredQueue: nextQueue,
    snapshots,
  });
  return { ok: true, state: saved };
}

export function exportKnowledgeStoreJson(state = loadKnowledgeStoreState()): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: state.schemaVersion,
      storeVersion: state.storeVersion,
      entries: state.entries,
      unansweredQueue: state.unansweredQueue,
      snapshots: state.snapshots,
      counters: state.counters,
    },
    null,
    2
  );
}

export function importKnowledgeStoreJson(rawJson: string): {
  ok: boolean;
  errorAr?: string;
  importedEntriesCount: number;
  state: KnowledgeStoreState;
} {
  const current = loadKnowledgeStoreState();
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
      return {
        ok: false,
        errorAr: 'ملف JSON غير صالح: يجب أن يحتوي على مصفوفة entries.',
        importedEntriesCount: 0,
        state: current,
      };
    }

    const validEntries: KnowledgeStoreEntry[] = parsed.entries
      .filter((e: any) => e && typeof e.topic === 'string' && typeof e.reply === 'string')
      .map((e: any) => ({
        id: String(e.id || `kb_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`),
        topic: String(e.topic).trim(),
        keywords: Array.isArray(e.keywords) ? e.keywords.map(String) : [],
        synonyms: Array.isArray(e.synonyms) ? e.synonyms.map(String) : [],
        questionVariants: Array.isArray(e.questionVariants) ? e.questionVariants.map(String) : [],
        reply: String(e.reply).trim(),
        options: Array.isArray(e.options) ? e.options : [],
        specialty: String(e.specialty || 'عام'),
        relatedPackage: String(e.relatedPackage || 'core_free'),
        source:
          e.source === 'library' || e.source === 'approved_draft' || e.source === 'super_admin'
            ? e.source
            : 'super_admin',
        status:
          e.status === 'approved' || e.status === 'draft' || e.status === 'rejected'
            ? e.status
            : 'approved',
        version: Number(e.version || 1),
        safetyWarningAr: e.safetyWarningAr ? String(e.safetyWarningAr) : undefined,
        requiresSafetyReview: Boolean(e.requiresSafetyReview),
        createdAt: String(e.createdAt || new Date().toISOString()),
        updatedAt: String(e.updatedAt || new Date().toISOString()),
      }));

    const snapshots = pushSnapshotBeforeMutation(current, 'نسخة احتياطية تلقائية قبل الاستيراد');
    const nextState = saveKnowledgeStoreState({
      schemaVersion: Number(parsed.schemaVersion || 1),
      storeVersion: current.storeVersion + 1,
      updatedAt: new Date().toISOString(),
      entries: validEntries,
      unansweredQueue: Array.isArray(parsed.unansweredQueue)
        ? parsed.unansweredQueue
        : current.unansweredQueue,
      snapshots,
      counters: current.counters,
    });

    return { ok: true, importedEntriesCount: validEntries.length, state: nextState };
  } catch {
    return {
      ok: false,
      errorAr: 'تعذر قراءة ملف JSON — تأكد إن صيغة الملف سليمة.',
      importedEntriesCount: 0,
      state: current,
    };
  }
}

export function rollbackKnowledgeStoreToSnapshot(snapshotId: string): {
  ok: boolean;
  state: KnowledgeStoreState;
} {
  const current = loadKnowledgeStoreState();
  const target = (current.snapshots || []).find((s) => s.snapshotId === snapshotId);
  if (!target) return { ok: false, state: current };

  const snapshots = pushSnapshotBeforeMutation(current, `قبل الاسترجاع للنسخة v${target.version}`);
  const next = saveKnowledgeStoreState({
    ...current,
    storeVersion: current.storeVersion + 1,
    entries: target.entries.map((e) => ({ ...e })),
    snapshots,
  });
  return { ok: true, state: next };
}

export function getKnowledgeStoreMetrics(state = loadKnowledgeStoreState()): KnowledgeStoreMetrics {
  const localCount = Number(state.counters?.localAnsweredCount || 0);
  const aiCount = Number(state.counters?.aiAssistantUsedCount || 0);
  const total = localCount + aiCount;
  const localRate = total > 0 ? Math.round((localCount / total) * 100) : 100;

  const pendingItems = (state.unansweredQueue || [])
    .filter((q) => q.status === 'pending' || q.status === 'draft_ready')
    .sort((a, b) => b.repeatCount - a.repeatCount);

  const weekAgoMs = Date.now() - 7 * 86400000;
  const addedThisWeekCount = (state.entries || []).filter((e) => {
    const t = Date.parse(e.createdAt || '');
    return Number.isFinite(t) && t >= weekAgoMs;
  }).length;

  return {
    localAnsweredCount: localCount,
    aiAssistantUsedCount: aiCount,
    localAnswerRatePercent: localRate,
    pendingQueueCount: pendingItems.length,
    approvedEntriesCount: (state.entries || []).filter((e) => e.status === 'approved').length,
    draftEntriesCount: (state.entries || []).filter((e) => e.status === 'draft').length,
    addedThisWeekCount,
    topRepeatedQuestions: pendingItems.slice(0, 5).map((q) => ({
      id: q.id,
      sanitizedQuestion: q.sanitizedQuestion,
      repeatCount: q.repeatCount,
    })),
  };
}
