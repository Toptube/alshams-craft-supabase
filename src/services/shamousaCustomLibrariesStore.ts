/**
 * مخزن الإضافات المخصّصة لمكتبات شموسة من السوبر أدمن (أوفلاين + مزامنة اختيارية مع السيرفر)
 * يتيح للسوبر أدمن إضافة تخصصات تسويقية أو قوالب أو رسائل يومية أو أساليب تسويق ومشاكل فنية
 * مباشرة من زر «إضافة للمكتبات» داخل شات شموسة بدون كتابة أي كود!
 */
import {
  HANDMADE_MARKETING_LIBRARY,
  type CraftMarketingSpecialty,
  type HandmadeMarketingLibraryData,
  type MarketingObjectionReply,
  type MarketingPostTemplate,
} from '../data/shamousaMarketingLibrary';

export type AdminLibraryCategoryId =
  | 'marketing_new_specialty'
  | 'marketing_append_specialty'
  | 'marketing_general_templates'
  | 'daily_checkin_messages'
  | 'marketing_methods_and_tech';

export interface AdminLibraryCategoryMeta {
  id: AdminLibraryCategoryId;
  labelAr: string;
  shortLabelAr: string;
  descriptionAr: string;
  placeholderAr: string;
  exampleAr: string;
}

export const ADMIN_LIBRARY_CATEGORIES: AdminLibraryCategoryMeta[] = [
  {
    id: 'marketing_new_specialty',
    labelAr: 'مكتبة التسويق — تخصص جديد',
    shortLabelAr: 'تخصص تسويقي جديد',
    descriptionAr: 'تضيف تخصص كامل (أو أكتر من تخصص مرة واحدة) بنفس صيغة الدفعات أو بكلام بسيط.',
    placeholderAr: 'الصق التخصص هنا (مثال: ■■ جلود طبيعية ■■ ثم كلمات دالة / رائج / نقط بيع / تصوير / وسوم...)',
    exampleAr:
      '■■ جلود طبيعية ■■\n' +
      'كلمات دالة: جلد طبيعي، محفظة جلد، حزام جلد، شنطة جلد\n' +
      'رائج: محافظ رجالي، شنط كروس، ميداليات جلد بالاسم\n' +
      'نقط بيع: جلد حقيقي يعيش سنين، خياطة يدوية متينة، حفر بالاسم\n' +
      'باقات: محفظة + ميدالية • حزام + محفظة في علبة\n' +
      'خامات نموذجية: جلد بقري طبيعي، خيط مشمّع، إكسسوارات معدن\n' +
      'مناسبات: هدايا رجالي، عيد ميلاد، تخرج\n' +
      'تصوير: خلفية خشب أو غامقة، لقطة قريبة للخياطة اليدوية\n' +
      'فيديو: قص الجلد وتخريمه، اللمعة النهائية\n' +
      'وسوم: #جلد_طبيعي #محفظة_جلد #هاندميد',
  },
  {
    id: 'marketing_append_specialty',
    labelAr: 'مكتبة التسويق — إضافة لتخصص موجود',
    shortLabelAr: 'تحديث تخصص موجود',
    descriptionAr: 'تزوّد كلمات دالة أو باقات أو أفكار فيديو أو نصيحة تصوير لتخصص موجود بالفعل.',
    placeholderAr: 'اكتب اسم التخصص في أول سطر وبعده اللي عايز تزوّده (مثال: مكرمية ثم باقات: ... / وسوم: ...)',
    exampleAr:
      'التخصص: مكرمية\n' +
      'كلمات دالة: مراية مكرمية، كرسي أرجوحة\n' +
      'باقات: مراية مكرمية + حامل نباتات\n' +
      'فيديو: تعليق المراية على الحيطة في 15 ثانية',
  },
  {
    id: 'marketing_general_templates',
    labelAr: 'مكتبة التسويق — قوالب عامة (عناوين / بوستات / اعتراضات)',
    shortLabelAr: 'قوالب عامة',
    descriptionAr: 'تضيف صيغة عنوان، بداية بوست، قالب بوست، سؤال تفاعل، أو رد على اعتراض عميل.',
    placeholderAr: 'اكتب النوع والنص (مثال: بداية بوست: ... أو اعتراض: الشحن غالي | الرد: ... أو عنوان: ...)',
    exampleAr:
      'بداية بوست: تفاصيل صغيرة معمولة بالإيد بتفرق في شكل بيتك كله\n' +
      'سؤال تفاعل: تحبوا اللون الهادي ولا الألوان الجريئة في الشغل ده؟\n' +
      'اعتراض: الشحن غالي | الرد: اشرح إن التغليف آمن وممكن العميل يجمع قطعتين في طلب واحد يوفر في الشحن',
  },
  {
    id: 'daily_checkin_messages',
    labelAr: 'مكتبة المتابعة اليومية والترحيب',
    shortLabelAr: 'المتابعة اليومية',
    descriptionAr: 'تضيف نصيحة أو رسالة تشجيعية أو متابعة يومية تستخدمها شموسة مع الأعضاء.',
    placeholderAr: 'اكتب الرسالة أو النصيحة اليومية بكلامك العادي...',
    exampleAr: 'صباح الفل يا فنان ☀️ لو صوّرت النهاردة قطعة واحدة في ضوء الشباك ونزلتها بسؤال خفيف، ده كفاية يحرّك صفحتك!',
  },
  {
    id: 'marketing_methods_and_tech',
    labelAr: 'مكتبة أساليب التسويق والمشاكل الفنية',
    shortLabelAr: 'أساليب تسويق / مشاكل فنية',
    descriptionAr: 'تضيف أسلوب تسويق جديد أو حل لمشكلة فنية متكررة عشان شموسة ترد بيها تلقائياً.',
    placeholderAr: 'اكتب العنوان والكلمات المفتاحية والنصيحة/الحل (مثال: مشكلة: فقاعات في الريزن | الحل: ...)',
    exampleAr:
      'عنوان: فقاعات الهواء في الريزن\n' +
      'كلمات دالة: فقاعات، بابلز، ريزن فقاعات\n' +
      'الحل: قلّب الريزن والمصلّب ببطء لمدة 3 دقايق بدون سرعة، واستخدم لهب خفيف أو هيت جن من مسافة آمنة بعد الصب.',
  },
];

export interface CustomKnowledgeNoteEntry {
  id: string;
  category: 'daily_checkin_messages' | 'marketing_methods_and_tech';
  titleAr: string;
  keywords: string[];
  contentAr: string;
  createdAt: number;
}

export interface PendingAdminReviewItem {
  id: string;
  questionAr: string;
  askedCount: number;
  proposedAnswerAr: string;
  proposedKeywords: string[];
  status: 'pending' | 'approved' | 'dismissed';
  source: 'offline_unanswered' | 'web_search_draft';
  createdAt: number;
  updatedAt: number;
}

export interface CustomLibrariesStoreState {
  version: number;
  updatedAt: number;
  customSpecialties: CraftMarketingSpecialty[];
  specialtyPatches: Array<{
    id: string;
    targetSpecialtyId: string;
    targetSpecialtyNameAr: string;
    keywords?: string[];
    popularItems?: string[];
    sellingPoints?: string[];
    bundles?: string[];
    typicalMaterials?: string[];
    occasions?: string[];
    photoTips?: string;
    videoIdeas?: string[];
    hashtags?: string[];
    createdAt: number;
  }>;
  generalAdditions: {
    titleTemplates: string[];
    hooks: string[];
    ctas: string[];
    engagementQuestions: string[];
    postTemplates: MarketingPostTemplate[];
    objectionReplies: MarketingObjectionReply[];
  };
  knowledgeNotes: CustomKnowledgeNoteEntry[];
  pendingReviewQuestions?: PendingAdminReviewItem[];
}

export const SHAMOUSA_CUSTOM_LIBRARIES_STORAGE_KEY = 'alshams_shamousa_custom_libraries_v1';

function createEmptyStore(): CustomLibrariesStoreState {
  return {
    version: 1,
    updatedAt: Date.now(),
    customSpecialties: [],
    specialtyPatches: [],
    generalAdditions: {
      titleTemplates: [],
      hooks: [],
      ctas: [],
      engagementQuestions: [],
      postTemplates: [],
      objectionReplies: [],
    },
    knowledgeNotes: [],
    pendingReviewQuestions: [],
  };
}

let inMemoryStore: CustomLibrariesStoreState | null = null;

export function loadCustomLibrariesStore(): CustomLibrariesStoreState {
  if (inMemoryStore) return inMemoryStore;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SHAMOUSA_CUSTOM_LIBRARIES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CustomLibrariesStoreState>;
        inMemoryStore = {
          ...createEmptyStore(),
          ...parsed,
          generalAdditions: {
            ...createEmptyStore().generalAdditions,
            ...(parsed.generalAdditions || {}),
          },
          customSpecialties: Array.isArray(parsed.customSpecialties) ? parsed.customSpecialties : [],
          specialtyPatches: Array.isArray(parsed.specialtyPatches) ? parsed.specialtyPatches : [],
          knowledgeNotes: Array.isArray(parsed.knowledgeNotes) ? parsed.knowledgeNotes : [],
          pendingReviewQuestions: Array.isArray(parsed.pendingReviewQuestions)
            ? parsed.pendingReviewQuestions
            : [],
        };
        return inMemoryStore;
      }
    } catch {
      // ignore localStorage read errors
    }
  }
  inMemoryStore = createEmptyStore();
  return inMemoryStore;
}

export function saveCustomLibrariesStore(state: CustomLibrariesStoreState): void {
  const next: CustomLibrariesStoreState = {
    ...state,
    updatedAt: Date.now(),
  };
  inMemoryStore = next;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SHAMOUSA_CUSTOM_LIBRARIES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
}

export function resetCustomLibrariesStoreForTest(): void {
  inMemoryStore = createEmptyStore();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(SHAMOUSA_CUSTOM_LIBRARIES_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function hydrateCustomLibrariesFromServer(serverState: Partial<CustomLibrariesStoreState> | null | undefined): void {
  if (!serverState || typeof serverState !== 'object') return;
  const local = loadCustomLibrariesStore();
  const serverUpdated = Number(serverState.updatedAt || 0);
  if (serverUpdated >= local.updatedAt || countCustomLibraryItems(local) === 0) {
    saveCustomLibrariesStore({
      ...createEmptyStore(),
      ...serverState,
      generalAdditions: {
        ...createEmptyStore().generalAdditions,
        ...(serverState.generalAdditions || {}),
      },
      customSpecialties: Array.isArray(serverState.customSpecialties) ? serverState.customSpecialties : [],
      specialtyPatches: Array.isArray(serverState.specialtyPatches) ? serverState.specialtyPatches : [],
      knowledgeNotes: Array.isArray(serverState.knowledgeNotes) ? serverState.knowledgeNotes : [],
      pendingReviewQuestions: Array.isArray(serverState.pendingReviewQuestions)
        ? serverState.pendingReviewQuestions
        : local.pendingReviewQuestions || [],
    });
  }
}

export function countCustomLibraryItems(state = loadCustomLibrariesStore()): number {
  return (
    state.customSpecialties.length +
    state.specialtyPatches.length +
    state.generalAdditions.titleTemplates.length +
    state.generalAdditions.hooks.length +
    state.generalAdditions.ctas.length +
    state.generalAdditions.engagementQuestions.length +
    state.generalAdditions.postTemplates.length +
    state.generalAdditions.objectionReplies.length +
    state.knowledgeNotes.length
  );
}

/**
 * يعيد المكتبة التسويقية الكاملة المدموجة حياً:
 * (المكتبة الأساسية HANDMADE_MARKETING_LIBRARY + كل إضافات السوبر أدمن المحفوظة)
 */
export function getEffectiveMarketingLibrary(): HandmadeMarketingLibraryData {
  const store = loadCustomLibrariesStore();
  const base = HANDMADE_MARKETING_LIBRARY;

  const mergedSpecialties: CraftMarketingSpecialty[] = base.specialties.map((s) => ({
    ...s,
    keywords: [...s.keywords],
    popularItems: [...s.popularItems],
    sellingPoints: [...s.sellingPoints],
    bundles: [...s.bundles],
    typicalMaterials: [...s.typicalMaterials],
    occasions: [...s.occasions],
    customerFaqs: [...s.customerFaqs],
    videoIdeas: [...s.videoIdeas],
    hashtags: [...s.hashtags],
  }));

  for (const cs of store.customSpecialties) {
    const existingIdx = mergedSpecialties.findIndex((s) => s.id === cs.id || s.nameAr === cs.nameAr);
    if (existingIdx >= 0) {
      const ex = mergedSpecialties[existingIdx];
      mergedSpecialties[existingIdx] = {
        ...ex,
        keywords: Array.from(new Set([...ex.keywords, ...cs.keywords])),
        popularItems: Array.from(new Set([...ex.popularItems, ...cs.popularItems])),
        sellingPoints: Array.from(new Set([...ex.sellingPoints, ...cs.sellingPoints])),
        bundles: Array.from(new Set([...ex.bundles, ...cs.bundles])),
        typicalMaterials: Array.from(new Set([...ex.typicalMaterials, ...cs.typicalMaterials])),
        occasions: Array.from(new Set([...ex.occasions, ...cs.occasions])),
        videoIdeas: Array.from(new Set([...ex.videoIdeas, ...cs.videoIdeas])),
        hashtags: Array.from(new Set([...ex.hashtags, ...cs.hashtags])),
        photoTips: cs.photoTips || ex.photoTips,
        forbiddenClaimsAr: cs.forbiddenClaimsAr || ex.forbiddenClaimsAr,
        customerFaqs: [...ex.customerFaqs, ...cs.customerFaqs],
      };
    } else {
      mergedSpecialties.push(cs);
    }
  }

  for (const patch of store.specialtyPatches) {
    const target = mergedSpecialties.find(
      (s) => s.id === patch.targetSpecialtyId || s.nameAr === patch.targetSpecialtyNameAr
    );
    if (!target) continue;
    if (patch.keywords?.length) target.keywords = Array.from(new Set([...target.keywords, ...patch.keywords]));
    if (patch.popularItems?.length) target.popularItems = Array.from(new Set([...target.popularItems, ...patch.popularItems]));
    if (patch.sellingPoints?.length) target.sellingPoints = Array.from(new Set([...target.sellingPoints, ...patch.sellingPoints]));
    if (patch.bundles?.length) target.bundles = Array.from(new Set([...target.bundles, ...patch.bundles]));
    if (patch.typicalMaterials?.length) target.typicalMaterials = Array.from(new Set([...target.typicalMaterials, ...patch.typicalMaterials]));
    if (patch.occasions?.length) target.occasions = Array.from(new Set([...target.occasions, ...patch.occasions]));
    if (patch.videoIdeas?.length) target.videoIdeas = Array.from(new Set([...target.videoIdeas, ...patch.videoIdeas]));
    if (patch.hashtags?.length) target.hashtags = Array.from(new Set([...target.hashtags, ...patch.hashtags]));
    if (patch.photoTips) target.photoTips = `${target.photoTips} • ${patch.photoTips}`;
  }

  return {
    ...base,
    general: {
      ...base.general,
      titleTemplates: [...base.general.titleTemplates, ...store.generalAdditions.titleTemplates],
      hooks: [...base.general.hooks, ...store.generalAdditions.hooks],
      ctas: [...base.general.ctas, ...store.generalAdditions.ctas],
      engagementQuestions: [...base.general.engagementQuestions, ...store.generalAdditions.engagementQuestions],
      postTemplates: [...base.general.postTemplates, ...store.generalAdditions.postTemplates],
      objectionReplies: [...base.general.objectionReplies, ...store.generalAdditions.objectionReplies],
    },
    specialties: mergedSpecialties,
  };
}

function splitList(raw: string): string[] {
  return raw
    .split(/[،,•\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitHashtags(raw: string): string[] {
  const tokens = raw
    .split(/[\s،,•]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return Array.from(
    new Set(tokens.map((t) => (t.startsWith('#') ? t : `#${t.replace(/\s+/g, '_')}`)))
  );
}

function normalizeSimple(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .trim();
}

function slugifySpecialtyId(nameAr: string): string {
  const clean = nameAr.trim().replace(/\s+/g, '_').replace(/[^\u0600-\u06FFa-zA-Z0-9_]/g, '');
  return `custom_${clean.slice(0, 28) || 'spec'}_${Date.now().toString(36)}`;
}

function parseSingleSpecialtyBlock(blockText: string): CraftMarketingSpecialty | null {
  const lines = blockText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  let nameAr = '';
  const keywords: string[] = [];
  const popularItems: string[] = [];
  const sellingPoints: string[] = [];
  const bundles: string[] = [];
  const typicalMaterials: string[] = [];
  const occasions: string[] = [];
  let photoTips = '';
  let forbiddenClaimsAr = '';
  const customerFaqs: Array<{ questionAr: string; answerGuidanceAr: string }> = [];
  const videoIdeas: string[] = [];
  const hashtags: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^■+\s*(.+?)\s*■+$/);
    if (headerMatch) {
      nameAr = headerMatch[1].trim();
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 28) {
      const key = normalizeSimple(line.slice(0, colonIdx));
      const val = line.slice(colonIdx + 1).trim();
      if (!val) continue;

      if (/^(التخصص|تخصص|اسم التخصص|تخصص جديد|اسم)$/.test(key)) {
        nameAr = val;
      } else if (/^(كلمات داله|كلمات مفتاحيه|كلمات)$/.test(key)) {
        keywords.push(...splitList(val));
      } else if (/^(رائج|منتجات رائجه|منتجات)$/.test(key)) {
        popularItems.push(...splitList(val));
      } else if (/^(نقط بيع|نقاط بيع|مميزات)$/.test(key)) {
        sellingPoints.push(...splitList(val));
      } else if (/^(باقات|عروض|تجميعات)$/.test(key)) {
        bundles.push(...splitList(val));
      } else if (/^(خامات نموذجيه|خامات)$/.test(key)) {
        typicalMaterials.push(...splitList(val));
      } else if (/^(مناسبات|مواسم)$/.test(key)) {
        occasions.push(...splitList(val));
      } else if (/^(تصوير|نصايح تصوير|نصائح تصوير)$/.test(key)) {
        photoTips = photoTips ? `${photoTips} • ${val}` : val;
      } else if (/^(ممنوع|ممنوعات|تحذير)$/.test(key)) {
        forbiddenClaimsAr = forbiddenClaimsAr ? `${forbiddenClaimsAr} • ${val}` : val;
      } else if (/^(اسئله|اسئله العملاء|سؤال)$/.test(key)) {
        val.split('•').forEach((part) => {
          const trimmed = part.trim();
          if (!trimmed) return;
          const m = trimmed.match(/["«]?([^"»(]+)["»]?\s*(?:\(([^)]+)\))?/);
          if (m) {
            customerFaqs.push({
              questionAr: m[1].trim(),
              answerGuidanceAr: (m[2] || 'رد بوضوح من بيانات المنتج الحقيقية').trim(),
            });
          }
        });
      } else if (/^(فيديو|افكار فيديو)$/.test(key)) {
        videoIdeas.push(...splitList(val));
      } else if (/^(وسوم|هاشتاجات|هاشتاج)$/.test(key)) {
        hashtags.push(...splitHashtags(val));
      }
      continue;
    }

    // لو أول سطر بدون نقطتين ولسه مفيش اسم تخصص -> اعتبره اسم التخصص
    if (!nameAr && lines.length >= 2 && line.length <= 60) {
      nameAr = line.replace(/^[■•\-*#\s]+|[■•\-*#\s]+$/g, '').trim();
    }
  }

  if (!nameAr) return null;
  const finalKeywords = Array.from(new Set([nameAr, ...keywords].filter(Boolean)));

  return {
    id: slugifySpecialtyId(nameAr),
    nameAr,
    batch: 99,
    keywords: finalKeywords,
    popularItems: popularItems.length > 0 ? popularItems : [`منتجات ${nameAr} يدوية`],
    sellingPoints: sellingPoints.length > 0 ? sellingPoints : ['شغل يدوي متقن بتفاصيل خاصة'],
    bundles,
    typicalMaterials,
    occasions: occasions.length > 0 ? occasions : ['هدايا ومناسبات'],
    photoTips: photoTips || 'صوّر في ضوء شباك طبيعي وخلفية هادية مع لقطة قريبة للتفاصيل.',
    ...(forbiddenClaimsAr ? { forbiddenClaimsAr } : {}),
    customerFaqs,
    videoIdeas: videoIdeas.length > 0 ? videoIdeas : ['لقطة سريعة أثناء الشغل + الشكل النهائي'],
    hashtags:
      hashtags.length > 0
        ? hashtags
        : [`#${nameAr.replace(/\s+/g, '_')}`, '#هاندميد', '#صنع_يدوي'],
  };
}

export interface AdminLibraryParseSaveResult {
  ok: boolean;
  summaryAr: string;
  addedCount: number;
  storeSnapshot: CustomLibrariesStoreState;
}

/**
 * يقرأ إدخال السوبر أدمن (بصيغة منظمة زي الدفعات أو بكلام عربي بسيط)،
 * ويحفظه محلياً فوراً ويعيد رداً واضحاً باللي اتفهم واتحفظ.
 */
export function parseAndSaveAdminLibraryEntry(
  category: AdminLibraryCategoryId,
  rawText: string
): AdminLibraryParseSaveResult {
  const text = String(rawText || '').trim();
  const store = loadCustomLibrariesStore();

  if (!text) {
    return {
      ok: false,
      addedCount: 0,
      summaryAr: 'ما وصلنيش نص للحفظ يا هندسة — اكتب أو الصق اللي عايز تضيفه وهحفظهولك فوراً.',
      storeSnapshot: store,
    };
  }

  if (category === 'marketing_new_specialty') {
    // يدعم لصق تخصص واحد أو دفعة كاملة فيها أكتر من ■■ تخصص ■■
    const blocks = text.includes('■■')
      ? text
          .split(/(?=■■\s*[^■]+\s*■■)/)
          .map((b) => b.trim())
          .filter((b) => b.startsWith('■■'))
      : [text];

    const parsedSpecs: CraftMarketingSpecialty[] = [];
    for (const blk of blocks) {
      const spec = parseSingleSpecialtyBlock(blk);
      if (spec) parsedSpecs.push(spec);
    }

    if (parsedSpecs.length === 0) {
      return {
        ok: false,
        addedCount: 0,
        summaryAr:
          'ما قدرتش أحدد اسم التخصص من النص ده. اكتب اسم التخصص في أول سطر (مثلاً: **التخصص: جلود طبيعية** أو **■■ جلود طبيعية ■■**) وتحته الكلمات الدالة والباقات والوسوم.',
        storeSnapshot: store,
      };
    }

    const nextStore: CustomLibrariesStoreState = {
      ...store,
      customSpecialties: [...store.customSpecialties, ...parsedSpecs],
    };
    saveCustomLibrariesStore(nextStore);

    const names = parsedSpecs.map((s) => `«${s.nameAr}» (${s.keywords.length} كلمات دالة)`).join('، ');
    return {
      ok: true,
      addedCount: parsedSpecs.length,
      summaryAr:
        `✅ **تم الحفظ في مكتبة التسويق بنجاح!**\n` +
        `فهمت وأضفت **${parsedSpecs.length}** تخصص جديد: ${names}.\n` +
        `تقدر تجرّبني فيه دلوقتي حالاً — اكتب أي كلمة من كلماته الدالة وهرد عليك منه أوفلاين 100%!`,
      storeSnapshot: nextStore,
    };
  }

  if (category === 'marketing_append_specialty') {
    const parsed = parseSingleSpecialtyBlock(text);
    const effective = getEffectiveMarketingLibrary();
    const firstLine = text.split(/\r?\n/)[0] || '';
    const normSearch = normalizeSimple(parsed?.nameAr || firstLine);
    const target = effective.specialties.find(
      (s) =>
        normalizeSimple(s.nameAr) === normSearch ||
        normSearch.includes(normalizeSimple(s.nameAr)) ||
        s.keywords.some((k) => normSearch.includes(normalizeSimple(k)))
    );

    if (!target || !parsed) {
      const available = effective.specialties.map((s) => s.nameAr).join('، ');
      return {
        ok: false,
        addedCount: 0,
        summaryAr:
          `ما لقيتش تخصص مطابق في المكتبة عشان أزوّد عليه. اكتب في أول سطر **التخصص: [الاسم]** من التخصصات الموجودة:\n${available}`,
        storeSnapshot: store,
      };
    }

    const patchEntry = {
      id: `patch_${Date.now().toString(36)}`,
      targetSpecialtyId: target.id,
      targetSpecialtyNameAr: target.nameAr,
      keywords: parsed.keywords.filter((k) => k !== parsed.nameAr),
      popularItems: parsed.popularItems.filter((p) => !p.startsWith('منتجات ')),
      sellingPoints: parsed.sellingPoints.filter((s) => s !== 'شغل يدوي متقن بتفاصيل خاصة'),
      bundles: parsed.bundles,
      typicalMaterials: parsed.typicalMaterials,
      occasions: parsed.occasions.filter((o) => o !== 'هدايا ومناسبات'),
      photoTips: text.includes('تصوير:') ? parsed.photoTips : undefined,
      videoIdeas: parsed.videoIdeas.filter((v) => v !== 'لقطة سريعة أثناء الشغل + الشكل النهائي'),
      hashtags: text.includes('وسوم:') || text.includes('#') ? parsed.hashtags : [],
      createdAt: Date.now(),
    };

    const nextStore: CustomLibrariesStoreState = {
      ...store,
      specialtyPatches: [...store.specialtyPatches, patchEntry],
    };
    saveCustomLibrariesStore(nextStore);

    return {
      ok: true,
      addedCount: 1,
      summaryAr:
        `✅ **تم التحديث في تخصص «${target.nameAr}»!**\n` +
        `دمجت إضافاتك جوه التخصص فوراً وشغّالة من دلوقتي في الردود أوفلاين.`,
      storeSnapshot: nextStore,
    };
  }

  if (category === 'marketing_general_templates') {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const nextGeneral = {
      titleTemplates: [...store.generalAdditions.titleTemplates],
      hooks: [...store.generalAdditions.hooks],
      ctas: [...store.generalAdditions.ctas],
      engagementQuestions: [...store.generalAdditions.engagementQuestions],
      postTemplates: [...store.generalAdditions.postTemplates],
      objectionReplies: [...store.generalAdditions.objectionReplies],
    };
    let added = 0;

    for (const line of lines) {
      const norm = normalizeSimple(line);
      if (/^(عنوان|صيغه عنوان)\s*:/.test(norm)) {
        const v = line.slice(line.indexOf(':') + 1).trim();
        if (v) { nextGeneral.titleTemplates.push(v); added++; }
      } else if (/^(بدايه|بدايه بوست|هوك)\s*:/.test(norm)) {
        const v = line.slice(line.indexOf(':') + 1).trim();
        if (v) { nextGeneral.hooks.push(v); added++; }
      } else if (/^(دعوه|دعوه فعل|cta)\s*:/.test(norm)) {
        const v = line.slice(line.indexOf(':') + 1).trim();
        if (v) { nextGeneral.ctas.push(v); added++; }
      } else if (/^(سؤال|سؤال تفاعل)\s*:/.test(norm)) {
        const v = line.slice(line.indexOf(':') + 1).trim();
        if (v) { nextGeneral.engagementQuestions.push(v); added++; }
      } else if (/^(اعتراض)\s*:/.test(norm)) {
        const body = line.slice(line.indexOf(':') + 1).trim();
        const [objPart, replyPart] = body.split('|').map((p) => p.trim());
        const cleanReply = (replyPart || '').replace(/^الرد\s*:\s*/i, '').trim();
        if (objPart && cleanReply) {
          nextGeneral.objectionReplies.push({
            id: `custom_obj_${Date.now().toString(36)}_${added}`,
            objectionAr: objPart,
            triggers: [objPart, ...objPart.split(/\s+/).filter((w) => w.length >= 3)],
            guidanceAr: cleanReply,
          });
          added++;
        }
      } else if (/^(بوست|قالب بوست)\s*:/.test(norm)) {
        const v = line.slice(line.indexOf(':') + 1).trim();
        if (v) {
          nextGeneral.postTemplates.push({
            id: `custom_post_${Date.now().toString(36)}_${added}`,
            typeAr: 'قالب مضاف من الإدارة',
            template: v,
          });
          added++;
        }
      } else {
        // نص حر مباشر -> نحفظه كبداية بوست/فكرة عامة بدون تعقيد
        nextGeneral.hooks.push(line);
        added++;
      }
    }

    const nextStore: CustomLibrariesStoreState = {
      ...store,
      generalAdditions: nextGeneral,
    };
    saveCustomLibrariesStore(nextStore);

    return {
      ok: true,
      addedCount: added,
      summaryAr: `✅ **تم حفظ ${added} بند جديد في القوالب العامة لمكتبة التسويق!** شموسة هتستخدمها تلقائياً في تنويع الردود والبوستات.`,
      storeSnapshot: nextStore,
    };
  }

  // daily_checkin_messages OR marketing_methods_and_tech
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let titleAr = category === 'daily_checkin_messages' ? 'رسالة متابعة يومية' : 'معلومة / حل فني';
  const keywords: string[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 24) {
      const k = normalizeSimple(line.slice(0, colonIdx));
      const v = line.slice(colonIdx + 1).trim();
      if (/^(عنوان|مشكله|اسلوب|الموضوع)$/.test(k) && v) {
        titleAr = v;
        continue;
      }
      if (/^(كلمات داله|كلمات مفتاحيه|كلمات)$/.test(k) && v) {
        keywords.push(...splitList(v));
        continue;
      }
      if (/^(الحل|الرد|النصيحه|المحتوي|الرساله)$/.test(k) && v) {
        bodyLines.push(v);
        continue;
      }
    }
    bodyLines.push(line);
  }

  const contentAr = bodyLines.join('\n').trim() || text;
  const derivedKeywords = Array.from(
    new Set([
      ...keywords,
      ...titleAr.split(/\s+/).filter((w) => w.length >= 3),
    ])
  );

  const noteEntry: CustomKnowledgeNoteEntry = {
    id: `note_${Date.now().toString(36)}`,
    category,
    titleAr,
    keywords: derivedKeywords,
    contentAr,
    createdAt: Date.now(),
  };

  const nextStore: CustomLibrariesStoreState = {
    ...store,
    knowledgeNotes: [...store.knowledgeNotes, noteEntry],
  };
  saveCustomLibrariesStore(nextStore);

  const catName =
    category === 'daily_checkin_messages'
      ? 'مكتبة المتابعة اليومية والترحيب'
      : 'مكتبة أساليب التسويق والمشاكل الفنية';

  return {
    ok: true,
    addedCount: 1,
    summaryAr:
      `✅ **تم الحفظ في «${catName}»!**\n` +
      `• العنوان: **${titleAr}**\n` +
      `• جاهز للرد على الأعضاء تلقائياً أوفلاين من دلوقتي ☀️`,
    storeSnapshot: nextStore,
  };
}

/**
 * يبحث في مكتبة أساليب التسويق والمشاكل الفنية المضافة من السوبر أدمن
 */
export function matchCustomKnowledgeNote(rawText: string): CustomKnowledgeNoteEntry | null {
  const norm = normalizeSimple(rawText);
  if (!norm) return null;
  const store = loadCustomLibrariesStore();
  let best: { note: CustomKnowledgeNoteEntry; score: number } | null = null;

  for (const note of store.knowledgeNotes) {
    if (note.category !== 'marketing_methods_and_tech') continue;
    let score = 0;
    for (const kw of note.keywords) {
      const nkw = normalizeSimple(kw);
      if (nkw.length >= 3 && norm.includes(nkw)) {
        score += nkw.includes(' ') ? 6 : 3;
      }
    }
    if (score >= 3 && (!best || score > best.score)) {
      best = { note, score };
    }
  }
  return best ? best.note : null;
}

export function deleteCustomLibraryItemById(id: string): CustomLibrariesStoreState {
  const store = loadCustomLibrariesStore();
  const next: CustomLibrariesStoreState = {
    ...store,
    customSpecialties: store.customSpecialties.filter((s) => s.id !== id),
    specialtyPatches: store.specialtyPatches.filter((p) => p.id !== id),
    knowledgeNotes: store.knowledgeNotes.filter((n) => n.id !== id),
    generalAdditions: {
      ...store.generalAdditions,
      postTemplates: store.generalAdditions.postTemplates.filter((p) => p.id !== id),
      objectionReplies: store.generalAdditions.objectionReplies.filter((o) => o.id !== id),
    },
  };
  saveCustomLibrariesStore(next);
  return next;
}

/**
 * يكتشف أسئلة السوبر أدمن الشخصية لشموسة لما ينسى إزاي يبرمجها أو يحفظ جواها أو يضيف في المكتبات
 */
export function isSuperAdminGuideQuery(rawText: string): boolean {
  const norm = normalizeSimple(rawText);
  if (!norm) return false;
  return /(هبرمجك ازاي|ابرمجك ازاي|ازاي ابرمجك|ازاي اغذيك|اغذيك ازاي|اعلمك ازاي|ازاي اعلمك|احفظ جواكي|ازاي احفظ فيكي|اضيف في المكتبات ازاي|ازاي اضيف في المكتبات|مش فاكر اضيف في المكتبات|مش فاكر ابرمج|ازاي اعدل المكتبه|ازاي اضيف تخصص|خطوات الاضافه للمكتبه|دليل السوبر ادمن|ساعديني كسوبر ادمن|افتح اضافه للمكتبات)/.test(
    norm
  );
}

/**
 * دليل السوبر أدمن السهل والعملي داخل شات شموسة (يعمل أوفلاين 100% للسوبر أدمن فقط)
 * يشرح الخطوات ببساطة ويقدّم أزرار فورية تفتح وضع الإضافة بضغطة واحدة بدون ما يدور على أي زر!
 */
export function buildSuperAdminLibraryGuide(firstName: string): {
  reply: string;
  options: Array<{ id: string; label: string; queryText: string }>;
} {
  const savedCount = countCustomLibraryItems();
  const effectiveSpecCount = getEffectiveMarketingLibrary().specialties.length;

  const reply =
    `على عيني يا **${firstName}** ☀️ متقلقش لو نسيت أي خطوة، أنا هنا عشان أسهّلهالك على الآخر!\n\n` +
    `**إزاي تغذّيني أو تحفظ جوايا أي حاجة في 3 خطوات بسيطة (أوفلاين من غير نت ولا برمجة):**\n` +
    `1️⃣ اضغط على زر **«إضافة للمكتبات ▾»** اللي موجود تحت مربع الكتابة (جنب زر الميكروفون)، **أو اضغط على أي زر من الأزرار الجاهزة تحت دلوقتي على طول 👇**\n` +
    `2️⃣ اختار القسم اللي عايز تضيف فيه من القائمة:\n` +
    `• **تخصص تسويقي جديد** (تقدر تلصق تخصص واحد أو دفعة كاملة زي ما بتبعتها بالظبط)\n` +
    `• **إضافة لتخصص موجود** (تزوّد كلمات دالة أو باقات أو أفكار فيديو لتخصص موجود)\n` +
    `• **قوالب عامة** (عنوان، بداية بوست، سؤال تفاعل، أو رد على اعتراض عميل)\n` +
    `• **المتابعة اليومية والترحيب** (نصيحة أو رسالة تشجيعية بكلامك العادي)\n` +
    `• **أساليب التسويق والمشاكل الفنية** (تكتب المشكلة وكلماتها والحل، وأنا أرد بيها على الأعضاء تلقائياً)\n` +
    `3️⃣ لو نسيت الصيغة، هتلاقي فوق مربع الكتابة زر **«حطلي مثال جاهز ✨»** — اضغط عليه هيطلعلك مثال جاهز تعدّل فيه بس وتضغط إرسال، وأنا هحفظه فوراً محلياً وأزامنه على السيرفر لكل الورش!\n\n` +
    `📊 *الرصيد الحالي جوه مكتبتي:* **${effectiveSpecCount}** تخصص تسويقي جاهز + **${savedCount}** إضافة يدوية محفوظة منك` +
    (listPendingAdminReviewQuestions().length > 0
      ? ` + **${listPendingAdminReviewQuestions().length}** سؤال معلّق مستني مراجعتك (اكتب «راجع الأسئلة المعلقة»).`
      : `.`) +
    `\nتحب أفتحلك أنهي قسم دلوقتي بضغطة واحدة؟`;

  return {
    reply,
    options: [
      {
        id: 'admin_guide_new_spec',
        label: '📣 افتح إضافة تخصص جديد',
        queryText: '__OPEN_ADMIN_LIB__:marketing_new_specialty',
      },
      {
        id: 'admin_guide_append',
        label: '✍️ افتح تحديث تخصص موجود',
        queryText: '__OPEN_ADMIN_LIB__:marketing_append_specialty',
      },
      {
        id: 'admin_guide_templates',
        label: '💬 افتح قوالب واعتراضات',
        queryText: '__OPEN_ADMIN_LIB__:marketing_general_templates',
      },
      {
        id: 'admin_guide_saved',
        label: `📋 اعرض المحفوظات (${savedCount})`,
        queryText: '__OPEN_ADMIN_SAVED__',
      },
    ],
  };
}

// ============================================================================
// التغذية الذاتية المحلية لكل حساب (Rule 5: معزولة تماماً حسب accountId)
// تسجّل الملاحظات التسويقية من الشات ليتم عرضها تلقائياً داخل تبويب «النتائج»
// ============================================================================

export interface AccountMarketingInsight {
  id: string;
  kind: 'specialty_focus' | 'product_interest' | 'stagnant_note' | 'season_interest' | 'material_query';
  titleAr: string;
  detailAr: string;
  queryText: string;
  updatedAt: number;
}

const ACCOUNT_INSIGHTS_MEM = new Map<string, AccountMarketingInsight[]>();

function accountInsightsKey(accountId?: string | null): string {
  return `alshams_shamousa_account_insights_${accountId || 'guest'}`;
}

export function loadAccountMarketingInsights(accountId?: string | null): AccountMarketingInsight[] {
  const key = accountId || 'guest';
  if (ACCOUNT_INSIGHTS_MEM.has(key)) {
    return [...(ACCOUNT_INSIGHTS_MEM.get(key) || [])];
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(accountInsightsKey(key));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          ACCOUNT_INSIGHTS_MEM.set(key, parsed);
          return [...parsed];
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export function recordAccountMarketingInsight(
  accountId: string | null | undefined,
  insight: Omit<AccountMarketingInsight, 'id' | 'updatedAt'>
): AccountMarketingInsight[] {
  try {
    const key = accountId || 'guest';
    const current = loadAccountMarketingInsights(key);
    const normTitle = normalizeSimple(insight.titleAr);
    const filtered = current.filter(
      (i) => !(i.kind === insight.kind && normalizeSimple(i.titleAr) === normTitle)
    );
    const nextItem: AccountMarketingInsight = {
      ...insight,
      id: `ins_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      updatedAt: Date.now(),
    };
    const next = [nextItem, ...filtered].slice(0, 25);
    ACCOUNT_INSIGHTS_MEM.set(key, next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(accountInsightsKey(key), JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    return next;
  } catch {
    return [];
  }
}

export function clearAccountMarketingInsightsForTest(accountId: string): void {
  const key = accountId || 'guest';
  ACCOUNT_INSIGHTS_MEM.delete(key);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(accountInsightsKey(key));
    } catch {
      // ignore
    }
  }
}

// ============================================================================
// دائرة مراجعة الأسئلة المعلقة والغريبة للسوبر أدمن (حوار تفاعلي داخل الشات)
// لا تُجيب شموسة من خيالها أبداً — تحفظ السؤال وتقترح إجابة وتنتظر موافقة/تعديل السوبر أدمن
// ============================================================================

export function queueUnansweredQuestionForAdmin(
  questionAr: string,
  proposedAnswerAr = '',
  proposedKeywords?: string[],
  source: PendingAdminReviewItem['source'] = 'offline_unanswered'
): PendingAdminReviewItem {
  const cleanQ = String(questionAr || '').trim();
  const store = loadCustomLibrariesStore();
  const list = [...(store.pendingReviewQuestions || [])];
  const normQ = normalizeSimple(cleanQ);

  const existingIdx = list.findIndex(
    (item) => item.status === 'pending' && normalizeSimple(item.questionAr) === normQ
  );
  if (existingIdx >= 0) {
    const updated: PendingAdminReviewItem = {
      ...list[existingIdx],
      askedCount: list[existingIdx].askedCount + 1,
      proposedAnswerAr: proposedAnswerAr.trim() || list[existingIdx].proposedAnswerAr,
      updatedAt: Date.now(),
    };
    list[existingIdx] = updated;
    saveCustomLibrariesStore({ ...store, pendingReviewQuestions: list });
    return updated;
  }

  const derivedKeywords =
    proposedKeywords && proposedKeywords.length > 0
      ? proposedKeywords
      : Array.from(
          new Set(
            cleanQ
              .split(/[\s،,؟?]+/)
              .map((w) => w.trim())
              .filter((w) => w.length >= 3)
          )
        ).slice(0, 8);

  const created: PendingAdminReviewItem = {
    id: `pq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    questionAr: cleanQ,
    askedCount: 1,
    proposedAnswerAr: proposedAnswerAr.trim(),
    proposedKeywords: derivedKeywords,
    status: 'pending',
    source,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveCustomLibrariesStore({
    ...store,
    pendingReviewQuestions: [created, ...list].slice(0, 80),
  });
  return created;
}

export function listPendingAdminReviewQuestions(): PendingAdminReviewItem[] {
  const store = loadCustomLibrariesStore();
  return (store.pendingReviewQuestions || [])
    .filter((q) => q.status === 'pending')
    .sort((a, b) => b.askedCount - a.askedCount || b.updatedAt - a.updatedAt);
}

export interface SuperAdminReviewSessionState {
  active: boolean;
  currentItemId?: string;
  draftQuestionAr?: string;
  draftAnswerAr?: string;
  draftKeywords?: string[];
}

export const INITIAL_ADMIN_REVIEW_SESSION: SuperAdminReviewSessionState = {
  active: false,
};

export function isSuperAdminReviewPendingQuery(rawText: string): boolean {
  const norm = normalizeSimple(rawText);
  if (!norm) return false;
  return /(راجع الاسئله المعلقه|الاسئله المعلقه|الاسئله الغريبه|اسئله غريبه جاتلك|اسئله معرفتيش تجاوبيها|مراجعه الاسئله|الاسئله اللي محتاجاني ارد عليها|فيه اسئله جديده)/.test(
    norm
  );
}

function presentPendingQuestionCard(
  item: PendingAdminReviewItem,
  totalPending: number,
  firstName: string,
  overrideDraftAnswer?: string
): {
  nextSession: SuperAdminReviewSessionState;
  reply: string;
  options: Array<{ id: string; label: string; queryText: string }>;
} {
  const draftAnswer = overrideDraftAnswer !== undefined ? overrideDraftAnswer : item.proposedAnswerAr;
  const answerPreview = draftAnswer
    ? `💡 **الإجابة المقترحة حالياً:**\n${draftAnswer}\n\n**هل الإجابة دي صح ولا تحب تعدلها؟**`
    : `⚠️ **لسه مفيش إجابة محفوظة للسؤال ده.** اكتبلي «عدل: ...» بالإجابة الصح وهورّيهالك تراجعها قبل الحفظ!`;

  return {
    nextSession: {
      active: true,
      currentItemId: item.id,
      draftQuestionAr: item.questionAr,
      draftAnswerAr: draftAnswer,
      draftKeywords: item.proposedKeywords,
    },
    reply:
      `📋 **مراجعة الأسئلة المعلقة يا ${firstName} (المتبقي: ${totalPending})**\n\n` +
      `❓ **السؤال:** «${item.questionAr}» *(اتسأل ${item.askedCount} مرة)*\n\n` +
      `${answerPreview}\n\n` +
      `*(اكتب «احفظ» للاعتماد فوراً، أو اكتب «عدل: الإجابة الجديدة» عشان أعدلها وأعرضهالك تاني)*`,
    options: [
      ...(draftAnswer ? [{ id: 'adm_rev_save', label: '✅ صح — احفظ الإجابة', queryText: 'احفظ' }] : []),
      { id: 'adm_rev_next', label: '⏭️ السؤال اللي بعده', queryText: 'اللي بعده' },
      { id: 'adm_rev_dismiss', label: '🗑️ استبعد السؤال', queryText: 'استبعد' },
      { id: 'adm_rev_exit', label: '✖️ إنهاء المراجعة', queryText: 'إنهاء المراجعة' },
    ],
  };
}

export function advanceSuperAdminReviewDialogue(
  session: SuperAdminReviewSessionState,
  userMessage: string,
  firstName: string
): {
  nextSession: SuperAdminReviewSessionState;
  reply: string;
  options?: Array<{ id: string; label: string; queryText: string }>;
  savedToStore?: boolean;
  storeSnapshot?: CustomLibrariesStoreState;
} {
  const pending = listPendingAdminReviewQuestions();
  const norm = normalizeSimple(userMessage);

  // بدء جلسة المراجعة
  if (!session.active) {
    if (pending.length === 0) {
      return {
        nextSession: { active: false },
        reply: `🎉 مفيش أي أسئلة معلقة دلوقتي يا **${firstName}**! كل الأسئلة اللي وصلتني اتجاوب عليها أو اتراجعت بالفعل.`,
      };
    }
    return presentPendingQuestionCard(pending[0], pending.length, firstName);
  }

  // إنهاء المراجعة
  if (/^(انهاء|انهاء المراجعه|الغاء|اقفل المراجعه|كفايه|خلاص)$/.test(norm)) {
    return {
      nextSession: { active: false },
      reply: `تمام يا ${firstName} ☀️ قفلت وضع مراجعة الأسئلة المعلقة ورجعنا للشات العادي.`,
    };
  }

  const currentItem = pending.find((p) => p.id === session.currentItemId) || pending[0];
  if (!currentItem) {
    return {
      nextSession: { active: false },
      reply: `🎉 خلّصنا مراجعة كل الأسئلة المعلقة يا ${firstName}!`,
    };
  }

  // تخطي للسؤال التالي
  if (/^(اللي بعده|التالي|تخطي|سكيب)$/.test(norm)) {
    const idx = pending.findIndex((p) => p.id === currentItem.id);
    const nextItem = pending[(idx + 1) % pending.length];
    if (pending.length <= 1 || nextItem.id === currentItem.id) {
      return {
        nextSession: session,
        reply: `ده السؤال المعلّق الوحيد حالياً يا ${firstName}. اكتب «احفظ» أو «عدل: ...» أو «استبعد».`,
        options: [
          { id: 'adm_rev_save2', label: '✅ احفظ', queryText: 'احفظ' },
          { id: 'adm_rev_exit2', label: '✖️ إنهاء المراجعة', queryText: 'إنهاء المراجعة' },
        ],
      };
    }
    return presentPendingQuestionCard(nextItem, pending.length, firstName);
  }

  // استبعاد السؤال
  if (/^(استبعد|احذف|امسح|ارفض)$/.test(norm)) {
    const store = loadCustomLibrariesStore();
    const updatedList = (store.pendingReviewQuestions || []).map((q) =>
      q.id === currentItem.id ? { ...q, status: 'dismissed' as const, updatedAt: Date.now() } : q
    );
    const nextStore = { ...store, pendingReviewQuestions: updatedList };
    saveCustomLibrariesStore(nextStore);
    const remaining = listPendingAdminReviewQuestions();
    if (remaining.length === 0) {
      return {
        nextSession: { active: false },
        reply: `🗑️ تم استبعاد السؤال يا ${firstName}، ومفيش أسئلة معلقة تانية حالياً.`,
        savedToStore: true,
        storeSnapshot: nextStore,
      };
    }
    const nextCard = presentPendingQuestionCard(remaining[0], remaining.length, firstName);
    return {
      ...nextCard,
      reply: `🗑️ تم استبعاد السؤال السابق.\n\n${nextCard.reply}`,
      savedToStore: true,
      storeSnapshot: nextStore,
    };
  }

  // حفظ واعتماد الإجابة داخل مكتبة شموسة المعرفية فوراً
  if (/^(احفظ|حفظ|تمام احفظ|صح احفظ|موافق|اعتمد|صح|ايوه صح|ايوة صح|احفظها)$/.test(norm)) {
    const finalAnswer = (session.draftAnswerAr || currentItem.proposedAnswerAr || '').trim();
    if (!finalAnswer) {
      return {
        nextSession: session,
        reply: `مفيش نص إجابة لسه عشان أحفظه يا ${firstName} — اكتبلي «عدل: الإجابة الصح» الأول وبعدين احفظها فوراً.`,
      };
    }

    const store = loadCustomLibrariesStore();
    const keywords = Array.from(
      new Set([
        ...(session.draftKeywords || currentItem.proposedKeywords || []),
        ...currentItem.questionAr.split(/[\s،,؟?]+/).filter((w) => w.length >= 3),
      ])
    ).slice(0, 12);

    const newNote: CustomKnowledgeNoteEntry = {
      id: `note_rev_${Date.now().toString(36)}`,
      category: 'marketing_methods_and_tech',
      titleAr: currentItem.questionAr,
      keywords,
      contentAr: finalAnswer,
      createdAt: Date.now(),
    };

    const updatedPending = (store.pendingReviewQuestions || []).map((q) =>
      q.id === currentItem.id
        ? { ...q, status: 'approved' as const, proposedAnswerAr: finalAnswer, updatedAt: Date.now() }
        : q
    );

    const nextStore: CustomLibrariesStoreState = {
      ...store,
      knowledgeNotes: [...store.knowledgeNotes, newNote],
      pendingReviewQuestions: updatedPending,
    };
    saveCustomLibrariesStore(nextStore);

    const remaining = listPendingAdminReviewQuestions();
    if (remaining.length === 0) {
      return {
        nextSession: { active: false },
        reply:
          `✅ **تم الاعتماد والحفظ في مكتبتي بنجاح يا ${firstName}!**\n` +
          `• **السؤال:** ${currentItem.questionAr}\n` +
          `• **الإجابة المعتمدة:** ${finalAnswer}\n\n` +
          `من اللحظة دي أي عضو يسألني السؤال ده هرد عليه فوراً أوفلاين 100% ☀️ (ومفيش أسئلة معلقة تانية).`,
        savedToStore: true,
        storeSnapshot: nextStore,
      };
    }

    const nextCard = presentPendingQuestionCard(remaining[0], remaining.length, firstName);
    return {
      ...nextCard,
      reply: `✅ **تم حفظ إجابة «${currentItem.questionAr}» في مكتبتي فوراً!**\n\n${nextCard.reply}`,
      savedToStore: true,
      storeSnapshot: nextStore,
    };
  }

  // تعديل تفاعلي للإجابة المقترحة ("عدل ..." / "خليها ..." / أو نص الإجابة المعدلة مباشرة)
  const editedText = userMessage
    .replace(/^(عدل|عدّل|تعديل|خليها|خلّيها|غيّرها|غيرها|الإجابة الصح|الاجابه الصح|اكتب)\s*[:\-–]?\s*/i, '')
    .trim();

  const finalDraft = editedText || userMessage.trim();
  return {
    nextSession: {
      active: true,
      currentItemId: currentItem.id,
      draftQuestionAr: currentItem.questionAr,
      draftAnswerAr: finalDraft,
      draftKeywords: session.draftKeywords || currentItem.proposedKeywords,
    },
    reply:
      `✏️ **عدّلت الإجابة زي ما قلتلي يا ${firstName} — راجع الصياغة الجديدة كده:**\n\n` +
      `❓ **السؤال:** «${currentItem.questionAr}»\n` +
      `💬 **الإجابة بعد التعديل:**\n${finalDraft}\n\n` +
      `**كده تمام؟ اضغط «احفظ» أو قولي لو تحب تعدّل حاجة تانية.**`,
    options: [
      { id: 'adm_rev_confirm_save', label: '✅ تمام — احفظ الإجابة', queryText: 'احفظ' },
      { id: 'adm_rev_skip_after_edit', label: '⏭️ السؤال اللي بعده', queryText: 'اللي بعده' },
      { id: 'adm_rev_exit_after_edit', label: '✖️ إنهاء المراجعة', queryText: 'إنهاء المراجعة' },
    ],
  };
}

