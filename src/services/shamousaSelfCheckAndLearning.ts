/**
 * محرك التحقق الذاتي والتعلّم المحلي لكل حساب — شموسة (الجزء D — الرسالة 7 من 7)
 *
 * القواعد الصارمة:
 * 1) محلي 100% لكل حساب (`accountId`) — ممنوع تماماً مشاركة أي تعلّم أو سجل بين حسابين.
 * 2) التعلّم يغيّر الأسلوب (النبرة، الطول، ترتيب القوالب والاقتراحات) فقط، بحصة استكشاف 20%.
 * 3) التعلّم لا يلمس أبداً: معادلات التكاليف، الحدود الدنيا للربح، الخصوصية، أو قفل الباقات.
 * 4) فحص ذاتي (Validator) قبل كل رد: الباقة، الخصوصية، الأرقام، الادعاءات الممنوعة، التكرار، الاختصار + 3-4 اختيارات.
 * 5) تتبع أثر 7 أيام للنشرات/المشاركات بناءً على الطلبات الفعلية بصدق تام ("ارتبط بزيادة / ما ظهرش تغيير" بدون ادعاء سببية مؤكدة).
 * 6) جميع الدوال داخل try/catch عشان لو أي جزء تعثّر باقي شموسة تفضل شغالة.
 */

import { hasFeature, type AccountPackageQueryOptions } from '../types/subscriptions';
import type { InvoiceRecord } from '../types';

export type LearnedToneStyle = 'formal' | 'friendly' | 'light';
export type CopyFeedbackRating = 'used' | 'edited' | 'not_suitable';
export type CopyFeedbackReason = 'too_long' | 'too_formal' | 'too_expensive' | 'not_my_style';
export type BrainFeedbackCategory = 'strategic' | 'technical' | 'marketing';
export type BrainFeedbackDecision = 'will_do' | 'snoozed' | 'not_suitable';

export interface CopyFeedbackEvent {
  id: string;
  blockId: string;
  templateId: string;
  tone: LearnedToneStyle;
  productName?: string;
  rating: CopyFeedbackRating;
  reason?: CopyFeedbackReason;
  createdAt: string;
}

export interface PublishedImpactTrackItem {
  id: string;
  productName: string;
  templateId: string;
  tone: LearnedToneStyle;
  channel: 'published' | 'shared';
  publishedAtMs: number;
  baselineOrders7dBefore: number;
  evaluatedAtMs?: number;
  orders7dAfter?: number;
  outcome?: 'associated_increase' | 'no_clear_change';
  summaryAr?: string;
}

export interface SelfCheckLogEntry {
  id: string;
  timestamp: string;
  failedChecks: string[];
  actionTaken: 'auto_corrected' | 'safe_fallback';
  reasonAr: string;
}

export interface AccountLearningProfile {
  accountId: string;
  updatedAt: string;
  toneWeights: Record<LearnedToneStyle, number>;
  templateWeights: Record<string, number>;
  brainWeights: Record<BrainFeedbackCategory, number>;
  preferShortScore: number; // > 0 يميل للردود الأقصر
  priceSensitivityCount: number; // مجرد إشارة للتأكيد على الحد الأدنى (لا يخفض الربح)
  copyFeedbackHistory: CopyFeedbackEvent[];
  publishedItems: PublishedImpactTrackItem[];
  recentReplyFingerprints: string[];
  selfCheckLog: SelfCheckLogEntry[];
  selectionCounter: number; // يضمن حصة استكشاف 20% بشكل متوازن ومستقر
}

const LEARNING_MEM = new Map<string, AccountLearningProfile>();

function storageKeyForAccount(accountId?: string | null): string {
  const safeId = String(accountId || 'guest').trim() || 'guest';
  return `alshams_shamousa_learning_v1_${safeId}`;
}

function createFreshLearningProfile(accountId?: string | null): AccountLearningProfile {
  return {
    accountId: String(accountId || 'guest').trim() || 'guest',
    updatedAt: new Date().toISOString(),
    toneWeights: {
      formal: 1.0,
      friendly: 1.0,
      light: 1.0,
    },
    templateWeights: {},
    brainWeights: {
      strategic: 1.0,
      technical: 1.0,
      marketing: 1.0,
    },
    preferShortScore: 0,
    priceSensitivityCount: 0,
    copyFeedbackHistory: [],
    publishedItems: [],
    recentReplyFingerprints: [],
    selfCheckLog: [],
    selectionCounter: 0,
  };
}

function clampWeight(val: number): number {
  return Math.max(0.15, Math.min(3.0, Number(val.toFixed(3))));
}

function normalizeTextSimple(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loadAccountLearningProfile(accountId?: string | null): AccountLearningProfile {
  const key = storageKeyForAccount(accountId);
  const mem = LEARNING_MEM.get(key);
  if (mem) return mem;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const merged: AccountLearningProfile = {
            ...createFreshLearningProfile(accountId),
            ...parsed,
            toneWeights: {
              ...createFreshLearningProfile(accountId).toneWeights,
              ...(parsed.toneWeights || {}),
            },
            brainWeights: {
              ...createFreshLearningProfile(accountId).brainWeights,
              ...(parsed.brainWeights || {}),
            },
          };
          LEARNING_MEM.set(key, merged);
          return merged;
        }
      }
    }
  } catch {
    // fallback to fresh profile
  }
  const fresh = createFreshLearningProfile(accountId);
  LEARNING_MEM.set(key, fresh);
  return fresh;
}

function saveAccountLearningProfile(profile: AccountLearningProfile): AccountLearningProfile {
  const key = storageKeyForAccount(profile.accountId);
  const next: AccountLearningProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
    copyFeedbackHistory: (profile.copyFeedbackHistory || []).slice(0, 120),
    publishedItems: (profile.publishedItems || []).slice(0, 80),
    recentReplyFingerprints: (profile.recentReplyFingerprints || []).slice(-6),
    selfCheckLog: (profile.selfCheckLog || []).slice(0, 80),
  };
  LEARNING_MEM.set(key, next);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(next));
    }
  } catch {
    // ignore storage quota errors
  }
  return next;
}

/**
 * تصفير تعلّم هذا الحساب فقط — لا يمس أي حساب آخر ولا يمس المخزن المعرفي العام
 */
export function resetAccountLearning(accountId?: string | null): AccountLearningProfile {
  const key = storageKeyForAccount(accountId);
  const fresh = createFreshLearningProfile(accountId);
  LEARNING_MEM.set(key, fresh);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  return fresh;
}

// ============================================================================
// 1) الفحص الذاتي قبل أي رد (Self-Check Validator)
// ============================================================================

export interface ShamousaReplyOptionLike {
  id: string;
  label: string;
  queryText?: string;
  view?: string;
  triggerAI?: boolean;
  triggerFalcon?: boolean;
}

export interface SelfCheckValidationInput {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  replyText: string;
  options?: ShamousaReplyOptionLike[];
  realProductFactsText?: string;
  allowedFactNumbers?: number[];
  firstName?: string;
  isPackageGateNotice?: boolean;
  maxLengthChars?: number;
}

export interface SelfCheckValidationResult {
  passed: boolean;
  sanitizedReply: string;
  options: ShamousaReplyOptionLike[];
  failedChecks: string[];
  actionTaken: 'passed' | 'auto_corrected' | 'safe_fallback';
}

const FORBIDDEN_CLAIMS_VALIDATOR_RULES: Array<{
  id: string;
  labelAr: string;
  pattern: RegExp;
  allowIfInFacts: RegExp;
  replacement: string;
}> = [
  {
    id: 'claim_medical',
    labelAr: 'ادعاء علاجي/طبي غير مثبت',
    pattern: /(علاجي|يعالج|يشفي|طبي\s*معتمد|وصفة\s*طبية)/gi,
    allowIfInFacts: /(علاجي|طبي)/i,
    replacement: 'عملي ومريح',
  },
  {
    id: 'claim_natural_100',
    labelAr: 'ادعاء طبيعي 100% غير مكتوب في بيانات المنتج',
    pattern: /(طبيعي\s*100%|طبيعي\s*١٠٠%|100%\s*طبيعي)/gi,
    allowIfInFacts: /(طبيعي\s*100%|طبيعي\s*١٠٠%|100%\s*طبيعي)/i,
    replacement: 'بخامات مختارة بعناية',
  },
  {
    id: 'claim_safe_kids',
    labelAr: 'ادعاء آمن للأطفال غير مكتوب في بيانات المنتج',
    pattern: /(آمن\s*للأطفال|امن\s*للاطفال|مناسب\s*للرضع)/gi,
    allowIfInFacts: /(آمن\s*للأطفال|امن\s*للاطفال|مناسب\s*للرضع)/i,
    replacement: 'بتشطيب ناعم ومرتب',
  },
  {
    id: 'claim_guaranteed',
    labelAr: 'ادعاء ضمان مطلق غير مثبت',
    pattern: /(مضمون\s*100%|مضمون\s*١٠٠%|نتيجة\s*مضمونة|ربح\s*مضمون|مبيعات\s*مضمونة)/gi,
    allowIfInFacts: /(مضمون\s*100%|ضمان)/i,
    replacement: 'تقدير عملي بدون وعد',
  },
  {
    id: 'claim_fake_scarcity',
    labelAr: 'ندرة وهمية غير حقيقية',
    pattern: /(آخر\s*(?:قطعة|قطعتين|\d+\s*قطع)\s*(?:فقط|في\s*المخزن|قبل\s*النفاد)|الكمية\s*توشك\s*على\s*النفاد|الحق\s*قبل\s*ما\s*تخلص)/gi,
    allowIfInFacts: /(متبقي\s*فعلي|كمية\s*محدودة\s*مسجلة)/i,
    replacement: 'متاح الحجز والتنفيذ بالطلب',
  },
  {
    id: 'claim_fake_testimonial',
    labelAr: 'شهادة عملاء مخترعة',
    pattern: /(أكتر\s*من\s*\d+\s*عميل\s*(?:اشتروا|جربوا|شكروا)|تقييم\s*5\s*نجوم\s*من\s*مئات\s*العملاء|كل\s*اللي\s*جربه\s*شهد)/gi,
    allowIfInFacts: /(تقييم\s*فعلي|مراجعة\s*عميل\s*حقيقية)/i,
    replacement: 'قطعة مصنوعة بإيد فنان وباهتمام بالتفاصيل',
  },
];

const NON_REPETITION_PREFIXES = [
  '☀️ ',
  'يا هلا — ',
  'بكل بساطة: ',
  'خلينا نظبّطها سوا: ',
];

const DEFAULT_SAFE_OPTIONS: ShamousaReplyOptionLike[] = [
  { id: 'sc_opt_1', label: 'التحليل الشامل لحسابي 🧠', queryText: 'العقول التحليلية لحسابي' },
  { id: 'sc_opt_2', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
  { id: 'sc_opt_3', label: 'تقويم المواسم المصري 🗓️', queryText: 'إيه المواسم الجاية؟' },
];

export function validateShamousaReplyBeforeSend(
  input: SelfCheckValidationInput
): SelfCheckValidationResult {
  try {
    const failedChecks: string[] = [];
    let text = String(input.replyText || '').trim();
    const accId = input.accountId || undefined;
    const pkgOpts = input.packageOptions;
    const facts = String(input.realProductFactsText || '');
    const firstName = input.firstName || 'فنان';

    if (!text) {
      return {
        passed: false,
        sanitizedReply: `أهلاً يا ${firstName} ☀️ قولي تحب نبدأ بإيه النهاردة؟`,
        options: input.options && input.options.length >= 3 ? input.options.slice(0, 4) : DEFAULT_SAFE_OPTIONS,
        failedChecks: ['empty_reply'],
        actionTaken: 'safe_fallback',
      };
    }

    // 1) فحص الباقة (لا نذكر تكلفة/هامش ربح أو أرقام مخزون خامات لو باقتها مقفولة — إلا في رسالة شرح الباقة نفسها)
    if (pkgOpts && !input.isPackageGateNotice) {
      const canCosting = hasFeature('costing', accId, pkgOpts);
      const canInventory = hasFeature('inventory', accId, pkgOpts);
      const norm = normalizeTextSimple(text);

      const leaksCostingData =
        !canCosting &&
        /(تكلفه\s*(?:القطعه|الانتاج|الخامات)|هامش\s*(?:ربح|صافي)|صافي\s*الربح\s*للقطعه|نسبه\s*الهالك)\s*[:：]?\s*\d/.test(
          norm
        );
      if (leaksCostingData) {
        failedChecks.push('package_costing_locked');
        text =
          `يا ${firstName} ☀️ تحليل التكلفة التفصيلية وهامش الربح متاح في باقة «الإنتاج والتسعير» — ` +
          `لكن دلوقتي نقدر نشتغل على التسويق والعرض، أو قولي «أقل سعر تقبل تبيع بيه كام؟» وهظبّطلك عليه العرض فوراً.`;
      }

      const leaksInventoryData =
        !canInventory &&
        /(رصيد\s*الخامه|مخزون\s*الخامات\s*الحالي|نقص\s*خامات\s*قبل\s*امر\s*الشغل|المخزون\s*يكفي\s*\d+)/.test(norm);
      if (leaksInventoryData) {
        failedChecks.push('package_inventory_locked');
        text =
          `يا ${firstName} ☀️ متابعة رصيد الخامات والمخزون متاحة في باقة «المخازن والمشتريات» — ` +
          `ولو تحب دلوقتي أقدر أساعدك في خامات التخصص الموحدة (المفتوحة للكل) أو أفكار تسويق لمنتجاتك.`;
      }
    }

    // 2) فحص الخصوصية (حذف أي تسريب لبريد إلكتروني أو رقم هاتف شخصي لحساب آخر)
    const leaksPii =
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text) ||
      /(?:^|\s)(?:\+?20)?01[0125]\d{8}(?:\s|$)/.test(text);
    if (leaksPii && !facts.includes('@') && !/(?:01[0125]\d{8})/.test(facts)) {
      failedChecks.push('privacy_pii_redacted');
      text = text
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[بيان خاص محذوف]')
        .replace(/(?:\+?20)?01[0125]\d{8}/g, '[رقم محذوف]');
    }

    // 3) فحص الادعاءات الممنوعة والندرة الوهمية والشهادات المخترعة (القاعدة 6)
    for (const rule of FORBIDDEN_CLAIMS_VALIDATOR_RULES) {
      if (rule.pattern.test(text) && !rule.allowIfInFacts.test(facts)) {
        failedChecks.push(rule.id);
        text = text.replace(rule.pattern, rule.replacement);
      }
      rule.pattern.lastIndex = 0;
    }

    // 4) فحص الأرقام غير الموجودة في بيانات الحساب (لو تم تمرير allowedFactNumbers)
    if (Array.isArray(input.allowedFactNumbers) && input.allowedFactNumbers.length > 0) {
      const allowedSet = new Set(input.allowedFactNumbers.map((n) => Math.round(Math.abs(n))));
      // نتأكد إن أي رقم مالي صريح (متبوع بـ ج.م / جنيه) موجود في الأرقام المسموحة للحساب
      const currencyMatches = Array.from(text.matchAll(/(\d{2,6})\s*(?:ج\.م|جنيه)/g));
      for (const m of currencyMatches) {
        const num = Math.round(Number(m[1]));
        if (Number.isFinite(num) && !allowedSet.has(num)) {
          failedChecks.push(`unverified_number_${num}`);
          text = text.replace(m[0], 'حسب السعر المسجّل في حسابك');
        }
      }
    }

    // 5) فحص التكرار لنفس الصيغة المتتالية لهذا الحساب
    const profile = loadAccountLearningProfile(accId);
    const fingerprint = normalizeTextSimple(text).slice(0, 140);
    if (fingerprint.length >= 16 && profile.recentReplyFingerprints.includes(fingerprint)) {
      failedChecks.push('consecutive_repetition');
      const altPrefix = NON_REPETITION_PREFIXES[profile.selectionCounter % NON_REPETITION_PREFIXES.length];
      text = `${altPrefix}${text}`;
    }

    // 6) فحص الاختصار (حسب تفضيل الطول للحساب + حد عام معقول)
    const maxLen = input.maxLengthChars || (profile.preferShortScore >= 1 ? 680 : 1200);
    if (text.length > maxLen) {
      failedChecks.push('reply_trimmed_for_conciseness');
      const cut = text.slice(0, maxLen);
      const lastBreak = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('،'), cut.lastIndexOf('.'));
      text = `${(lastBreak > maxLen * 0.6 ? cut.slice(0, lastBreak) : cut).trim()}…`;
    }

    // 7) فحص وجود 3 إلى 4 اختيارات تالية
    let nextOptions = Array.isArray(input.options) ? [...input.options] : [];
    if (nextOptions.length === 0) {
      failedChecks.push('missing_options_filled');
      nextOptions = [...DEFAULT_SAFE_OPTIONS];
    } else if (nextOptions.length > 4) {
      nextOptions = nextOptions.slice(0, 4);
    }

    // تسجيل البصمة + سجل الفحص الذاتي المحلي لهذا الحساب فقط
    const actionTaken: SelfCheckValidationResult['actionTaken'] =
      failedChecks.length === 0
        ? 'passed'
        : failedChecks.some((c) => c.startsWith('package_'))
          ? 'safe_fallback'
          : 'auto_corrected';

    const nextLog = [...profile.selfCheckLog];
    if (failedChecks.length > 0) {
      nextLog.unshift({
        id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        failedChecks,
        actionTaken: actionTaken === 'safe_fallback' ? 'safe_fallback' : 'auto_corrected',
        reasonAr: `تم تصحيح (${failedChecks.join('، ')}) تلقائياً قبل العرض.`,
      });
    }

    saveAccountLearningProfile({
      ...profile,
      recentReplyFingerprints: [...profile.recentReplyFingerprints, normalizeTextSimple(text).slice(0, 140)].slice(-6),
      selfCheckLog: nextLog,
    });

    return {
      passed: failedChecks.length === 0,
      sanitizedReply: text,
      options: nextOptions,
      failedChecks,
      actionTaken,
    };
  } catch {
    return {
      passed: true,
      sanitizedReply: String(input.replyText || ''),
      options: (input.options || DEFAULT_SAFE_OPTIONS).slice(0, 4),
      failedChecks: [],
      actionTaken: 'passed',
    };
  }
}

// ============================================================================
// 2) تقييم المستخدم + تعلّم الأسلوب بحصة استكشاف 20% (محلي للحساب فقط)
// ============================================================================

export function recordCopyTextFeedback(
  accountId: string | null | undefined,
  params: {
    blockId: string;
    templateId?: string;
    tone?: LearnedToneStyle;
    productName?: string;
    rating: CopyFeedbackRating;
    reason?: CopyFeedbackReason;
  }
): AccountLearningProfile {
  try {
    const profile = loadAccountLearningProfile(accountId);
    const tone: LearnedToneStyle = params.tone || 'friendly';
    const tplId = params.templateId || params.blockId || 'generic_copy';

    const toneWeights = { ...profile.toneWeights };
    const templateWeights = { ...profile.templateWeights };
    let preferShortScore = profile.preferShortScore;
    let priceSensitivityCount = profile.priceSensitivityCount;

    const currentTplW = templateWeights[tplId] ?? 1.0;

    if (params.rating === 'used') {
      toneWeights[tone] = clampWeight(toneWeights[tone] + 0.35);
      templateWeights[tplId] = clampWeight(currentTplW + 0.35);
    } else if (params.rating === 'edited') {
      toneWeights[tone] = clampWeight(toneWeights[tone] + 0.1);
      templateWeights[tplId] = clampWeight(currentTplW + 0.1);
    } else if (params.rating === 'not_suitable') {
      toneWeights[tone] = clampWeight(toneWeights[tone] - 0.45);
      templateWeights[tplId] = clampWeight(currentTplW - 0.45);
    }

    // أسباب سريعة توجّه النبرة والطول بدقة بدون لمس المعادلات أو الحدود الدنيا
    if (params.reason === 'too_formal') {
      toneWeights.formal = clampWeight(toneWeights.formal - 0.55);
      toneWeights.friendly = clampWeight(toneWeights.friendly + 0.25);
      toneWeights.light = clampWeight(toneWeights.light + 0.25);
    } else if (params.reason === 'too_long') {
      preferShortScore = Math.min(5, preferShortScore + 0.6);
    } else if (params.reason === 'too_expensive') {
      // يرفع الانتباه لتأكيد أقل سعر يقبله الفنان (لا يغيّر معادلة التكلفة ولا الحد الأدنى للربح!)
      priceSensitivityCount += 1;
    } else if (params.reason === 'not_my_style') {
      toneWeights[tone] = clampWeight(toneWeights[tone] - 0.35);
      templateWeights[tplId] = clampWeight((templateWeights[tplId] ?? 1.0) - 0.35);
    }

    const event: CopyFeedbackEvent = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      blockId: params.blockId,
      templateId: tplId,
      tone,
      productName: params.productName,
      rating: params.rating,
      reason: params.reason,
      createdAt: new Date().toISOString(),
    };

    return saveAccountLearningProfile({
      ...profile,
      toneWeights,
      templateWeights,
      preferShortScore,
      priceSensitivityCount,
      copyFeedbackHistory: [event, ...profile.copyFeedbackHistory],
    });
  } catch {
    return loadAccountLearningProfile(accountId);
  }
}

export function recordBrainRecommendationFeedback(
  accountId: string | null | undefined,
  params: {
    recId: string;
    brain: BrainFeedbackCategory;
    decision: BrainFeedbackDecision;
  }
): AccountLearningProfile {
  try {
    const profile = loadAccountLearningProfile(accountId);
    const brainWeights = { ...profile.brainWeights };
    const delta =
      params.decision === 'will_do' ? 0.3 : params.decision === 'snoozed' ? -0.05 : -0.3;
    brainWeights[params.brain] = clampWeight((brainWeights[params.brain] ?? 1.0) + delta);
    return saveAccountLearningProfile({
      ...profile,
      brainWeights,
    });
  } catch {
    return loadAccountLearningProfile(accountId);
  }
}

/**
 * اختيار النبرة المناسبة للحساب مع حصة استكشاف 20% (كل خامس اختيار أو عبر rng < 0.20)
 * عشان شموسة تميل للمقبول وتقلّل المرفوض، لكن ما تعلقش على نمط واحد.
 */
export function selectLearnedToneForAccount(
  accountId?: string | null,
  options?: { rng?: () => number; advanceCounter?: boolean }
): {
  tone: LearnedToneStyle;
  isExploration: boolean;
  weights: Record<LearnedToneStyle, number>;
} {
  try {
    const profile = loadAccountLearningProfile(accountId);
    const tones: LearnedToneStyle[] = ['friendly', 'light', 'formal'];
    const sorted = [...tones].sort((a, b) => profile.toneWeights[b] - profile.toneWeights[a]);
    const topTone = sorted[0];

    const nextCount = profile.selectionCounter + 1;
    const isExploration = options?.rng
      ? options.rng() < 0.2
      : nextCount % 5 === 0; // 1 من كل 5 = 20% بالظبط

    let chosenTone = topTone;
    if (isExploration) {
      const others = sorted.slice(1);
      // نختار من النبرات غير السائدة بترجيح أعلى للأقرب
      const idx = Math.floor((options?.rng ? options.rng() : (nextCount / 5) % 1) * others.length) % others.length;
      chosenTone = others[idx] || sorted[1];
    }

    if (options?.advanceCounter !== false) {
      saveAccountLearningProfile({
        ...profile,
        selectionCounter: nextCount,
      });
    }

    return {
      tone: chosenTone,
      isExploration,
      weights: { ...profile.toneWeights },
    };
  } catch {
    return {
      tone: 'friendly',
      isExploration: false,
      weights: { formal: 1, friendly: 1, light: 1 },
    };
  }
}

export function getAccountLengthPreference(accountId?: string | null): 'short' | 'balanced' {
  try {
    const profile = loadAccountLearningProfile(accountId);
    return profile.preferShortScore >= 0.6 ? 'short' : 'balanced';
  } catch {
    return 'balanced';
  }
}

/**
 * تعديل خفيف لترتيب توصيات العقول التحليلية حسب تفاعل الحساب فقط (لا يؤثر على قفل الباقات أو الصلاحيات)
 */
export function getAccountBrainOrderBoost(
  accountId: string | null | undefined,
  brain: BrainFeedbackCategory
): number {
  try {
    const profile = loadAccountLearningProfile(accountId);
    const w = profile.brainWeights[brain] ?? 1.0;
    return Math.round((w - 1.0) * 12); // نطاق محدود [-10 .. +24] للترتيب فقط
  } catch {
    return 0;
  }
}

export function rankTemplatesWithLearning<T extends { id: string }>(
  accountId: string | null | undefined,
  templates: T[],
  rng?: () => number
): { ordered: T[]; usedExploration: boolean } {
  try {
    if (templates.length <= 1) return { ordered: [...templates], usedExploration: false };
    const profile = loadAccountLearningProfile(accountId);
    const sorted = [...templates].sort(
      (a, b) => (profile.templateWeights[b.id] ?? 1.0) - (profile.templateWeights[a.id] ?? 1.0)
    );
    const explore = rng ? rng() < 0.2 : (profile.selectionCounter + 1) % 5 === 0;
    if (explore && sorted.length > 1) {
      const [first, second, ...rest] = sorted;
      return { ordered: [second, first, ...rest], usedExploration: true };
    }
    return { ordered: sorted, usedExploration: false };
  } catch {
    return { ordered: [...templates], usedExploration: false };
  }
}

// ============================================================================
// 3) تتبع الأثر بعد 7 أيام (لو متجر وطلبات) — صدق تام بدون ادعاء سببية مؤكدة
// ============================================================================

function countProductOrdersInWindow(
  orders: InvoiceRecord[],
  productName: string,
  fromMs: number,
  toMs: number
): number {
  const target = normalizeTextSimple(productName);
  if (!target) return 0;
  let total = 0;
  for (const ord of orders) {
    if (ord.status === 'cancelled') continue;
    const ts = Number(ord.createdAt || 0);
    if (ts < fromMs || ts >= toMs) continue;
    const items = Array.isArray(ord.items) ? ord.items : [];
    for (const item of items) {
      const nameNorm = normalizeTextSimple((item as any).productName || (item as any).name || '');
      if (nameNorm && (nameNorm.includes(target) || target.includes(nameNorm))) {
        total += Math.max(1, Number((item as any).quantity || 1));
      }
    }
  }
  return total;
}

export function recordPublishedProductShare(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  productName: string;
  templateId?: string;
  tone?: LearnedToneStyle;
  channel?: 'published' | 'shared';
  orders: InvoiceRecord[];
  nowMs?: number;
}): { recorded: boolean; item?: PublishedImpactTrackItem; reasonAr?: string } {
  try {
    const canTrackStoreOrders =
      !params.packageOptions ||
      hasFeature('storefront', params.accountId || undefined, params.packageOptions) ||
      hasFeature('sales_crm', params.accountId || undefined, params.packageOptions);

    if (!canTrackStoreOrders) {
      return {
        recorded: false,
        reasonAr: 'تتبع أثر الطلبات خلال 7 أيام يحتاج تفعيل المتجر أو المبيعات.',
      };
    }

    const nowMs = params.nowMs ?? Date.now();
    const sevenDaysMs = 7 * 86400_000;
    const baseline = countProductOrdersInWindow(
      params.orders || [],
      params.productName,
      nowMs - sevenDaysMs,
      nowMs
    );

    const profile = loadAccountLearningProfile(params.accountId);
    const item: PublishedImpactTrackItem = {
      id: `pub_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      productName: params.productName.trim() || 'منتج المتجر',
      templateId: params.templateId || 'store_post',
      tone: params.tone || 'friendly',
      channel: params.channel || 'published',
      publishedAtMs: nowMs,
      baselineOrders7dBefore: baseline,
    };

    saveAccountLearningProfile({
      ...profile,
      publishedItems: [item, ...profile.publishedItems],
    });

    return { recorded: true, item };
  } catch {
    return { recorded: false };
  }
}

export function evaluate7DayPublishedImpacts(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  orders: InvoiceRecord[];
  nowMs?: number;
}): PublishedImpactTrackItem[] {
  try {
    const canTrackStoreOrders =
      !params.packageOptions ||
      hasFeature('storefront', params.accountId || undefined, params.packageOptions) ||
      hasFeature('sales_crm', params.accountId || undefined, params.packageOptions);
    if (!canTrackStoreOrders) return [];

    const nowMs = params.nowMs ?? Date.now();
    const sevenDaysMs = 7 * 86400_000;
    const profile = loadAccountLearningProfile(params.accountId);
    let changed = false;

    const templateWeights = { ...profile.templateWeights };
    const toneWeights = { ...profile.toneWeights };

    const updatedItems = profile.publishedItems.map((item) => {
      if (item.evaluatedAtMs) return item;
      if (nowMs < item.publishedAtMs + sevenDaysMs) return item;

      const afterCount = countProductOrdersInWindow(
        params.orders || [],
        item.productName,
        item.publishedAtMs,
        item.publishedAtMs + sevenDaysMs
      );
      const increased = afterCount > item.baselineOrders7dBefore;
      const outcome: PublishedImpactTrackItem['outcome'] = increased
        ? 'associated_increase'
        : 'no_clear_change';
      const summaryAr = increased
        ? `نشر «${item.productName}» ارتبط بزيادة في الطلبات الفعلية من ${item.baselineOrders7dBefore} إلى ${afterCount} خلال 7 أيام (ملاحظة ارتباط بدون ادعاء سببية مؤكدة).`
        : `نشر «${item.productName}» ما ظهرش معاه تغيير واضح في الطلبات بعد 7 أيام (قبل: ${item.baselineOrders7dBefore}، بعد: ${afterCount}).`;

      // تعديل خفيف في ترتيب القوالب الجاية بناءً على الأثر الفعلي
      const curTplW = templateWeights[item.templateId] ?? 1.0;
      templateWeights[item.templateId] = clampWeight(curTplW + (increased ? 0.3 : -0.15));
      toneWeights[item.tone] = clampWeight(toneWeights[item.tone] + (increased ? 0.15 : -0.05));
      changed = true;

      return {
        ...item,
        evaluatedAtMs: nowMs,
        orders7dAfter: afterCount,
        outcome,
        summaryAr,
      };
    });

    if (changed) {
      saveAccountLearningProfile({
        ...profile,
        templateWeights,
        toneWeights,
        publishedItems: updatedItems,
      });
    }

    return updatedItems.filter((x) => Boolean(x.evaluatedAtMs));
  } catch {
    return [];
  }
}

// ============================================================================
// 4) الملخص الأسبوعي القصير للمستخدم: «اللي اتعلمته منك»
// ============================================================================

const TONE_LABELS_AR: Record<LearnedToneStyle, string> = {
  friendly: 'ودودة وقريبة',
  light: 'خفيفة وسريعة',
  formal: 'رسمية ومرتّبة',
};

const BRAIN_LABELS_AR: Record<BrainFeedbackCategory, string> = {
  strategic: 'التحليل الاستراتيجي',
  technical: 'التحليل الفني والخامات',
  marketing: 'الأفكار التسويقية',
};

export interface WeeklyLearningSummaryResult {
  preferredTone: LearnedToneStyle;
  preferredToneLabelAr: string;
  lengthLabelAr: string;
  topBrainLabelAr: string;
  feedbackCount: number;
  selfChecksCorrectedCount: number;
  evaluatedImpacts: PublishedImpactTrackItem[];
  shortSummaryAr: string;
}

export function buildWeeklyLearningSummary(params: {
  accountId?: string | null;
  packageOptions?: AccountPackageQueryOptions;
  orders?: InvoiceRecord[];
  firstName?: string;
  nowMs?: number;
}): WeeklyLearningSummaryResult {
  try {
    const evaluatedImpacts = evaluate7DayPublishedImpacts({
      accountId: params.accountId,
      packageOptions: params.packageOptions,
      orders: params.orders || [],
      nowMs: params.nowMs,
    });
    const profile = loadAccountLearningProfile(params.accountId);
    const tones: LearnedToneStyle[] = ['friendly', 'light', 'formal'];
    const preferredTone = [...tones].sort((a, b) => profile.toneWeights[b] - profile.toneWeights[a])[0];
    const preferredToneLabelAr = TONE_LABELS_AR[preferredTone];
    const lengthLabelAr = profile.preferShortScore >= 0.6 ? 'ردود قصيرة ومختصرة' : 'طول متوازن';

    const brains: BrainFeedbackCategory[] = ['strategic', 'technical', 'marketing'];
    const topBrain = [...brains].sort((a, b) => profile.brainWeights[b] - profile.brainWeights[a])[0];
    const topBrainLabelAr = BRAIN_LABELS_AR[topBrain];

    const feedbackCount = profile.copyFeedbackHistory.length;
    const selfChecksCorrectedCount = profile.selfCheckLog.length;

    const lines: string[] = [
      `🧠 **اللي اتعلمته منك يا ${params.firstName || 'فنان'} (خاص بحسابك بس):**`,
      `• **النبرة المفضلة:** ${preferredToneLabelAr} (مع 20% تنويع عشان ما تزهقش من نمط واحد).`,
      `• **طول النصوص:** ${lengthLabelAr}.`,
      `• **أكتر نوع توصيات بتتفاعل معاه:** ${topBrainLabelAr}.`,
      `• **إجمالي تقييماتك المسجّلة:** ${feedbackCount} تقييم.`,
    ];

    if (evaluatedImpacts.length > 0) {
      lines.push(`• **متابعة أثر النشر (7 أيام):** ${evaluatedImpacts[0].summaryAr}`);
    }
    if (selfChecksCorrectedCount > 0) {
      lines.push(`• **الفحص الذاتي الوقائي:** صحّحت ${selfChecksCorrectedCount} نقطة تلقائياً قبل العرض.`);
    }

    return {
      preferredTone,
      preferredToneLabelAr,
      lengthLabelAr,
      topBrainLabelAr,
      feedbackCount,
      selfChecksCorrectedCount,
      evaluatedImpacts,
      shortSummaryAr: lines.join('\n'),
    };
  } catch {
    return {
      preferredTone: 'friendly',
      preferredToneLabelAr: 'ودودة وقريبة',
      lengthLabelAr: 'طول متوازن',
      topBrainLabelAr: 'الأفكار التسويقية',
      feedbackCount: 0,
      selfChecksCorrectedCount: 0,
      evaluatedImpacts: [],
      shortSummaryAr: '🧠 لسه بنتعرف على أسلوبك المفضل يا فنان — قيّم أي نص جاهز عشان أظبطلك أسلوبي معاك!',
    };
  }
}

export const COPY_FEEDBACK_REASON_LABELS: Record<CopyFeedbackReason, string> = {
  too_long: 'طويل',
  too_formal: 'رسمي زيادة',
  too_expensive: 'غالي',
  not_my_style: 'مش بأسلوبي',
};
