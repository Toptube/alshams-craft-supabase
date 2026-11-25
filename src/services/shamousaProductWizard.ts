import { hasFeature, type AccountPackageQueryOptions } from '../types/subscriptions';
import {
  buildLibraryMarketingCopy,
  sanitizeForbiddenMarketingClaims,
  understandProductSentence,
} from './shamousaProductUnderstanding';

export type ProductWizardStepKey =
  | 'productType'
  | 'material'
  | 'sizeDetails'
  | 'audienceOccasion'
  | 'features'
  | 'price'
  | 'media';

export interface ProductWizardData {
  productType?: string;
  material?: string;
  sizeDetails?: string;
  audienceOccasion?: string;
  features: string[];
  price?: string;
  numericPrice?: number;
  mediaNote?: string;
  videoUrl?: string;
}

export interface ProductWizardState {
  active: boolean;
  currentStep: ProductWizardStepKey | null;
  awaitingCustomInput: boolean;
  data: ProductWizardData;
  completed?: boolean;
}

export interface ProductWizardChoice {
  id: string;
  label: string;
  value: string;
  isCustom?: boolean;
  isDoneMulti?: boolean;
}

export interface ShamousaCopyBlock {
  id: string;
  title: string;
  content: string;
  templateId?: string;
  tone?: 'formal' | 'friendly' | 'light';
  productName?: string;
}

export interface ProductWizardPrefillDraft {
  productName: string;
  storePrice: string;
  storeDescription: string;
  personalNotes: string;
  videoUrl?: string;
  sizeLabel?: string;
  categoryHint?: string;
  materialHint?: string;
  createdAt: number;
}

export interface ProductWizardTurnResult {
  nextState: ProductWizardState;
  reply: string;
  choices?: ProductWizardChoice[];
  isMultiSelect?: boolean;
  selectedMultiValues?: string[];
  copyBlocks?: ShamousaCopyBlock[];
  prefillDraft?: ProductWizardPrefillDraft;
  actionLink?: { label: string; view: string };
}

export interface ProductWizardContext {
  accountId: string;
  firstName: string;
  brandName?: string;
  currencySymbol?: string;
  packageOptions?: AccountPackageQueryOptions;
  /** Real stock materials passed ONLY when inventory package is active */
  stockMaterialNames?: string[];
}

export const SHAMOUSA_PRODUCT_PREFILL_STORAGE_KEY = 'alshams_shamousa_product_prefill_v1';

export function saveProductWizardPrefillDraft(draft: ProductWizardPrefillDraft): void {
  try {
    sessionStorage.setItem(SHAMOUSA_PRODUCT_PREFILL_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage errors
  }
}

export function consumeProductWizardPrefillDraft(): ProductWizardPrefillDraft | null {
  try {
    const raw = sessionStorage.getItem(SHAMOUSA_PRODUCT_PREFILL_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SHAMOUSA_PRODUCT_PREFILL_STORAGE_KEY);
    const parsed = JSON.parse(raw) as ProductWizardPrefillDraft;
    if (!parsed || !parsed.productName) return null;
    // Ignore stale drafts older than 30 minutes
    if (parsed.createdAt && Date.now() - parsed.createdAt > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

const FEATURE_OPTIONS = [
  'شغل يدوي 100%',
  'إمكانية التخصيص (اسم / لون)',
  'وقت تنفيذ سريع ومضبوط',
  'ثبات لون وجودة عالية',
  'تغليف هدايا جاهز',
];

function normalizeAr(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .trim();
}

export function isNewProductWizardTrigger(text: string): boolean {
  const norm = normalizeAr(text);
  if (!norm) return false;
  if (/(منتج جديد|معالج منتج|تجهيز منتج|جهزيلي منتج|اعمل منتج جديد|اضيف منتج جديد)/.test(norm)) {
    return true;
  }
  // Natural craft creation phrases like "عايز أعمل ميدالية مكرمية للأطفال"
  const intentVerb = /(عايز اعمل|عايزه اعمل|هعمل|هنزل|عايز انزل|عايزه انزل|فكره منتج|بشتغل علي|بعمل)/.test(norm);
  if (!intentVerb) return false;
  const hasProductHint =
    PRODUCT_SYNONYMS.some((entry) => entry.patterns.some((p) => p.test(norm))) ||
    MATERIAL_SYNONYMS.some((entry) => entry.patterns.some((p) => p.test(norm)));
  if (hasProductHint) return true;
  // دعم تلقائي لكل تخصصات المكتبة التسويقية الحالية والدفعات المستقبلية + الأخطاء الإملائية
  try {
    const understood = understandProductSentence(text);
    return Boolean(understood.specialty || understood.productType);
  } catch {
    return false;
  }
}

const PRODUCT_SYNONYMS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'ميدالية', patterns: [/ميدالي/, /تعليقه مفاتيح/, /سلسله مفاتيح/] },
  { canonical: 'شنطة', patterns: [/شنط/, /حقيب/, /بوك/, /كروس/, /توت باج/] },
  { canonical: 'جدارية ديكور', patterns: [/جداري/, /معلق/, /تابلو/, /ديكور حائط/] },
  { canonical: 'شمعة معطرة', patterns: [/شمع/, /فواح/] },
  { canonical: 'صينية ديكور', patterns: [/صيني/, /كوستر/, /كوسترات/, /طقم ضياف/] },
  { canonical: 'مفرش', patterns: [/مفرش/, /رانر/, /سجاده/] },
  { canonical: 'إكسسوار / حلي', patterns: [/سلسل/, /انسيال/, /حلق/, /خاتم/, /بروش/, /اسور/, /توكه/, /اكسسوار/] },
  { canonical: 'محفظة', patterns: [/محفظ/, /حافظه/] },
  { canonical: 'ملابس / تريكو', patterns: [/بلوفر/, /كوفيه/, /شال/, /ايس كاب/, /بطانيه/, /فستان/] },
  { canonical: 'بوكس هدية', patterns: [/بوكس هدي/, /صندوق هدي/, /توزيعات/, /سبون/] },
  { canonical: 'مج / خزف', patterns: [/مج/, /فنجان/, /فازه/, /مبخرة/, /مبخره/, /اصيص/] },
];

const MATERIAL_SYNONYMS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'خيط مكرمية قطن', patterns: [/مكرمي/, /حبل قطن/] },
  { canonical: 'خيط كروشيه / قطن', patterns: [/كروشي/, /خيط قطن/, /تريكو/, /صوف/, /كليم/] },
  { canonical: 'ريزن إيبوكسي', patterns: [/ريزن/, /ايبوكسي/] },
  { canonical: 'شمع صويا طبيعي', patterns: [/شمع صويا/, /شمع نحل/, /شمع برافين/, /شمع/] },
  { canonical: 'جلد طبيعي', patterns: [/جلد طبيعي/, /جلد/] },
  { canonical: 'كونكريت / جبس فني', patterns: [/كونكريت/, /جسمونيت/, /جبس/, /اسمنت/] },
  { canonical: 'خشب طبيعي', patterns: [/خشب/, /زان/, /اركيت/] },
  { canonical: 'خرز وأحجار طبيعية', patterns: [/خرز/, /لولي/, /كريستال/, /احجار/, /عقيق/, /نحاس/] },
  { canonical: 'صلصال حراري / خزف', patterns: [/صلصال/, /فخار/, /خزف/, /سيراميك/] },
  { canonical: 'قماش وتطريز يدوي', patterns: [/تطريز/, /كتان/, /ايتامين/, /قماش/, /ستان/] },
];

const AUDIENCE_SYNONYMS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'للأطفال (هدايا / غرف أطفال / مدارس)', patterns: [/اطفال/, /للاطفال/, /طفل/, /بيبي/, /مواليد/, /سبون/, /مدارس/] },
  { canonical: 'للبنات والسيدات (إطلالة يومية وهدايا)', patterns: [/بنات/, /للبنات/, /سيدات/, /حريمي/, /عروسه/, /عرايس/, /خطوب/] },
  { canonical: 'هدايا للمناسبات (عيد ميلاد / تخرج / عيد أم)', patterns: [/هدايا/, /هديه/, /مناسب/, /تخرج/, /عيد ام/, /رمضان/, /عيد/, /فرح/, /زواج/] },
  { canonical: 'لديكور البيت والمكتب', patterns: [/للبيت/, /ديكور/, /منزل/, /مكتب/, /سفره/, /صالون/] },
  { canonical: 'للشباب والرجال', patterns: [/رجالي/, /للرجال/, /شباب/, /عربيه/, /سياره/] },
];

export function extractFieldsFromInitialSentence(text: string): Partial<ProductWizardData> {
  const norm = normalizeAr(text);
  const extracted: Partial<ProductWizardData> = {};

  for (const item of PRODUCT_SYNONYMS) {
    if (item.patterns.some((p) => p.test(norm))) {
      extracted.productType = item.canonical;
      break;
    }
  }

  for (const item of MATERIAL_SYNONYMS) {
    if (item.patterns.some((p) => p.test(norm))) {
      extracted.material = item.canonical;
      break;
    }
  }

  for (const item of AUDIENCE_SYNONYMS) {
    if (item.patterns.some((p) => p.test(norm))) {
      extracted.audienceOccasion = item.canonical;
      break;
    }
  }

  // Extract size if explicitly written like "30 سم" or "مقاس 20×30"
  const sizeMatch = text.match(/(\d+\s*[×xX*]\s*\d+\s*(?:سم|cm)?|\d+\s*(?:سم|ملي|متر|cm))/i);
  if (sizeMatch) {
    extracted.sizeDetails = sizeMatch[1].trim();
  }

  // Extract price if explicitly written like "بـ 150 جنيه" or "سعر 200"
  const priceMatch = text.match(/(?:بسعر|سعره?|بـ|ب)\s*(\d+(?:\.\d+)?)\s*(?:جنيه|ج\.م|ج|ريال|درهم)?/i);
  if (priceMatch) {
    const num = Number(priceMatch[1]);
    if (Number.isFinite(num) && num > 0) {
      extracted.price = priceMatch[1];
      extracted.numericPrice = num;
    }
  }

  // Extract URL if provided
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    extracted.videoUrl = urlMatch[0];
    extracted.mediaNote = urlMatch[0];
  }

  // دعم تلقائي لتخصصات المكتبة التسويقية والأخطاء الإملائية والعامية (بدون كسر التطابقات الأساسية)
  try {
    const understood = understandProductSentence(text);
    if (!extracted.productType && understood.productType) {
      extracted.productType = understood.productType;
    }
    if (!extracted.material && understood.material) {
      extracted.material = understood.material;
    }
    if (!extracted.audienceOccasion && (understood.audience || understood.occasion)) {
      extracted.audienceOccasion = [understood.audience, understood.occasion].filter(Boolean).join(' — ');
    }
    if (!extracted.sizeDetails && understood.sizeDetails) {
      extracted.sizeDetails = understood.sizeDetails;
    }
    if (!extracted.numericPrice && understood.numericPrice && understood.numericPrice > 0) {
      extracted.price = String(understood.numericPrice);
      extracted.numericPrice = understood.numericPrice;
    }
  } catch {
    // الحفاظ على النتيجة المستخرجة في حال أي خطأ غير متوقع
  }

  return extracted;
}

const STEP_ORDER: ProductWizardStepKey[] = [
  'productType',
  'material',
  'sizeDetails',
  'audienceOccasion',
  'features',
  'price',
  'media',
];

function getNextMissingStep(data: ProductWizardData, afterStep?: ProductWizardStepKey | null): ProductWizardStepKey | null {
  const startIdx = afterStep ? STEP_ORDER.indexOf(afterStep) + 1 : 0;
  for (let i = Math.max(0, startIdx); i < STEP_ORDER.length; i++) {
    const step = STEP_ORDER[i];
    if (step === 'productType' && !data.productType) return step;
    if (step === 'material' && !data.material) return step;
    if (step === 'sizeDetails' && data.sizeDetails === undefined) return step;
    if (step === 'audienceOccasion' && !data.audienceOccasion) return step;
    if (step === 'features' && data.features.length === 0) return step;
    if (step === 'price' && !data.price) return step;
    if (step === 'media' && data.mediaNote === undefined) return step;
  }
  return null;
}

function buildQuestionForStep(
  step: ProductWizardStepKey,
  data: ProductWizardData,
  ctx: ProductWizardContext,
  introPrefix?: string
): ProductWizardTurnResult {
  const canInventory = hasFeature('inventory', ctx.accountId, ctx.packageOptions);
  const currency = ctx.currencySymbol || 'ج.م';
  const prefix = introPrefix ? `${introPrefix}\n\n` : '';

  switch (step) {
    case 'productType':
      return {
        nextState: { active: true, currentStep: 'productType', awaitingCustomInput: false, data },
        reply: `${prefix}1️⃣ **إيه المنتج اللي ناوي تعمله يا ${ctx.firstName}؟** اختار من هنا أو اكتب اسمه:`,
        choices: [
          { id: 'pw_pt_1', label: 'ميدالية / تعليقة', value: 'ميدالية' },
          { id: 'pw_pt_2', label: 'شنطة يدوية', value: 'شنطة' },
          { id: 'pw_pt_3', label: 'ديكور / صينية / جدارية', value: 'قطعة ديكور يدوية' },
          { id: 'pw_pt_4', label: 'شمعة / بوكس هدية', value: 'شمعة معطرة' },
          { id: 'pw_pt_other', label: 'حاجة تانية ✍️', value: '__CUSTOM__', isCustom: true },
        ],
      };

    case 'material': {
      const stockNames =
        canInventory && Array.isArray(ctx.stockMaterialNames)
          ? ctx.stockMaterialNames.map((n) => n.trim()).filter(Boolean).slice(0, 4)
          : [];

      const materialChoices: ProductWizardChoice[] =
        stockNames.length > 0
          ? [
              ...stockNames.map((name, idx) => ({
                id: `pw_mat_stk_${idx}`,
                label: `🧶 ${name}`,
                value: name,
              })),
              { id: 'pw_mat_other', label: 'حاجة تانية ✍️', value: '__CUSTOM__', isCustom: true },
            ]
          : [
              { id: 'pw_mat_1', label: 'خيط مكرمية / قطن', value: 'خيط مكرمية قطن' },
              { id: 'pw_mat_2', label: 'خيط كروشيه / صوف', value: 'خيط كروشيه قطن' },
              { id: 'pw_mat_3', label: 'ريزن / كونكريت', value: 'ريزن إيبوكسي' },
              { id: 'pw_mat_4', label: 'جلد طبيعي / خرز', value: 'جلد طبيعي' },
              { id: 'pw_mat_other', label: 'حاجة تانية ✍️', value: '__CUSTOM__', isCustom: true },
            ];

      const stockHint =
        stockNames.length > 0
          ? ' (جبتلك خامات من الموجود عندك بالفعل 👆)'
          : '';

      return {
        nextState: { active: true, currentStep: 'material', awaitingCustomInput: false, data },
        reply: `${prefix}2️⃣ **إيه الخامة الأساسية لـ «${data.productType || 'المنتج'}»؟**${stockHint}`,
        choices: materialChoices,
      };
    }

    case 'sizeDetails':
      return {
        nextState: { active: true, currentStep: 'sizeDetails', awaitingCustomInput: false, data },
        reply: `${prefix}3️⃣ **المقاس أو التفاصيل الإضافية (اختياري):** تحب تضيف مقاس أو لون معيّن؟`,
        choices: [
          { id: 'pw_sz_1', label: 'مقاس صغير / قياسي', value: 'مقاس قياسي عملي' },
          { id: 'pw_sz_2', label: 'مقاس وسط', value: 'مقاس وسط' },
          { id: 'pw_sz_3', label: 'حسب طلب العميل', value: 'مقاس وألوان حسب الطلب' },
          { id: 'pw_sz_skip', label: 'تخطي الخطوة دي', value: '' },
          { id: 'pw_sz_other', label: 'حاجة تانية ✍️', value: '__CUSTOM__', isCustom: true },
        ],
      };

    case 'audienceOccasion':
      return {
        nextState: { active: true, currentStep: 'audienceOccasion', awaitingCustomInput: false, data },
        reply: `${prefix}4️⃣ **المنتج ده لمين ولأنهي مناسبة؟**`,
        choices: [
          { id: 'pw_aud_1', label: 'للأطفال / مواليد', value: 'للأطفال (هدايا وغرف أطفال)' },
          { id: 'pw_aud_2', label: 'للبنات والسيدات', value: 'للبنات والسيدات (إطلالة يومية وهدايا)' },
          { id: 'pw_aud_3', label: 'هدايا مناسبات وتخرج', value: 'هدايا للمناسبات (عيد ميلاد وتخرج)' },
          { id: 'pw_aud_4', label: 'ديكور بيت ومكتب', value: 'لديكور البيت والمكتب' },
          { id: 'pw_aud_other', label: 'حاجة تانية ✍️', value: '__CUSTOM__', isCustom: true },
        ],
      };

    case 'features':
      return {
        nextState: { active: true, currentStep: 'features', awaitingCustomInput: false, data },
        reply: `${prefix}5️⃣ **إيه اللي بيميّز شغلك في القطعة دي؟** (تقدر تختار أكتر من ميزة، وبعدها اضغط «كمّل»):`,
        isMultiSelect: true,
        selectedMultiValues: data.features,
        choices: [
          ...FEATURE_OPTIONS.map((f, i) => ({
            id: `pw_feat_${i}`,
            label: f,
            value: f,
          })),
          { id: 'pw_feat_other', label: 'حاجة تانية ✍️', value: '__CUSTOM__', isCustom: true },
          { id: 'pw_feat_done', label: 'كمّل للسؤال اللي بعده ✅', value: '__DONE_MULTI__', isDoneMulti: true },
        ],
      };

    case 'price':
      return {
        nextState: { active: true, currentStep: 'price', awaitingCustomInput: false, data },
        reply: `${prefix}6️⃣ **السعر اللي إنت عايز تبيع بيه كام (${currency})؟** اكتب الرقم زي ما إنت مقرّر (أو اختار سيب السعر لاحقاً):`,
        choices: [
          { id: 'pw_pr_1', label: `75 ${currency}`, value: '75' },
          { id: 'pw_pr_2', label: `150 ${currency}`, value: '150' },
          { id: 'pw_pr_3', label: `250 ${currency}`, value: '250' },
          { id: 'pw_pr_other', label: 'أكتب السعر بنفسي ✍️', value: '__CUSTOM__', isCustom: true },
        ],
      };

    case 'media':
      return {
        nextState: { active: true, currentStep: 'media', awaitingCustomInput: false, data },
        reply: `${prefix}7️⃣ **آخر خطوة: عندك صور جاهزة أو لينك فيديو للمنتج؟**`,
        choices: [
          { id: 'pw_med_1', label: 'عندي صور جاهزة هرفعها في الكتالوج', value: 'صور جاهزة للرفع' },
          { id: 'pw_med_2', label: 'لسه هصوّره وهحتاج نصيحة للتصوير', value: 'لسه هيتصوّر' },
          { id: 'pw_med_3', label: 'عندي لينك فيديو هكتبه', value: '__CUSTOM__', isCustom: true },
          { id: 'pw_med_skip', label: 'مفيش دلوقتي — جهّزيلي النتيجة فوراً ✨', value: '' },
        ],
      };
  }
}

function buildFinalWizardOutput(data: ProductWizardData, ctx: ProductWizardContext): ProductWizardTurnResult {
  const canStorefront =
    hasFeature('storefront', ctx.accountId, ctx.packageOptions) ||
    hasFeature('catalog', ctx.accountId, ctx.packageOptions);
  const canCore = hasFeature('core_profile', ctx.accountId, ctx.packageOptions);

  const product = data.productType || 'منتج يدوي';
  const material = data.material || 'خامات يدوية مختارة';
  const audience = data.audienceOccasion || 'محبي المشغولات اليدوية';
  const size = (data.sizeDetails || '').trim();
  const feats = data.features.length > 0 ? data.features : ['شغل يدوي 100%'];
  const currency = ctx.currencySymbol || 'ج.م';
  const brand = (ctx.brandName || '').trim() || `ورشة ${ctx.firstName}`;
  const priceNum = data.numericPrice || Number(String(data.price || '').replace(/[^\d.]/g, '')) || 0;
  const priceDisplay = priceNum > 0 ? `${priceNum.toLocaleString('ar-EG')} ${currency}` : (data.price || 'حسب الطلب');

  // دمج المكتبة التسويقية مع بيانات المنتج الحقيقية + تنويع الصياغة لكل حساب + فلتر القاعدة 6
  const realFactsText = `${product} ${material} ${audience} ${size} ${feats.join(' ')}`;
  let libPack: ReturnType<typeof buildLibraryMarketingCopy> | null = null;
  try {
    libPack = buildLibraryMarketingCopy({
      accountId: ctx.accountId,
      productName: product,
      material,
      feature: feats[0],
      priceText: priceDisplay,
      occasion: audience.split('(')[0].trim(),
      sizeDetails: size || undefined,
      realProductFactsText: realFactsText,
    });
  } catch {
    libPack = null;
  }

  // 1) 3 Varied Titles (من المكتبة مع تنويع لكل حساب + بيانات المنتج الحقيقية)
  const title1 = sanitizeForbiddenMarketingClaims(
    libPack?.titles[0] || `${product} ${material} يدوية — ${audience.split('(')[0].trim()}`,
    realFactsText
  );
  const title2 = sanitizeForbiddenMarketingClaims(
    libPack?.titles[1] || `${product} هاند ميد من ${material}${size ? ` (${size})` : ''}`,
    realFactsText
  );
  const title3 = sanitizeForbiddenMarketingClaims(
    libPack?.titles[2] || `${product} مميزة ${feats[0] ? `— ${feats[0]}` : 'بتفاصيل متقنة'} | ${brand}`,
    realFactsText
  );

  // 2) Short + Medium Description
  const featsBullet = feats.map((f) => `• ${f}`).join('\n');
  const shortDesc = sanitizeForbiddenMarketingClaims(
    `${product} مصنوعة يدوياً من ${material}، مناسبة ${audience.split('(')[0].trim()}${size ? `، ${size}` : ''}. السعر: ${priceDisplay}.`,
    realFactsText
  );
  const mediumDesc = sanitizeForbiddenMarketingClaims(
    `${product} معمولة بإيدينا في ${brand} من ${material} بعناية في كل تفصيلة.\n` +
      `مناسبة جداً ${audience}.\n` +
      (size ? `المقاس / التفاصيل: ${size}.\n` : '') +
      `إيه اللي بيميّزها:\n${featsBullet}\n` +
      `السعر: ${priceDisplay}.`,
    realFactsText
  );

  // 3) Product Story (strictly from user's real answers, zero invented claims)
  const productStory = sanitizeForbiddenMarketingClaims(
    `فكرة الـ ${product} دي بدأت لما حبّينا نعمل قطعة عملية ومبهجة ${audience.split('(')[0].trim()} باستخدام ${material}.\n` +
      `اشتغلنا عليها خطوة بخطوة عشان تطلع بمواصفات حقيقية ترضي صاحبها: ${feats.join('، ')}` +
      (size ? `، وبـ ${size}` : '') +
      `.\nكل قطعة بتخرج من ${brand} بتتراجع بإيدينا قبل التسليم عشان توصل بأحسن شكل.`,
    realFactsText
  );

  // 4) Keywords & Hashtags (دمج وسوم التخصص من المكتبة + وسوم المنتج)
  const rawTokens = [
    product,
    material,
    audience.split('(')[0].trim(),
    'هاند_ميد',
    'شغل_يدوي',
    'الشمساوية',
    'هدايا_يدوية',
  ];
  const keywords = Array.from(new Set(rawTokens.map((t) => t.replace(/_/g, ' ').trim()).filter(Boolean)));
  const productHashtags = rawTokens
    .map((t) => '#' + t.trim().replace(/\s+/g, '_').replace(/[^\u0600-\u06FF\w_]/g, ''))
    .filter((h) => h.length > 2);
  const hashtags = Array.from(new Set([...(libPack?.hashtags || []), ...productHashtags])).slice(0, 10);

  // 5) "حط إيه فين" exact map matching DirectCatalogProductModal.tsx
  const whereToPutMap =
    `🗺️ **خريطة «حط إيه فين» في صفحة إضافة منتج مباشر:**\n` +
    `• في خانة **«اسم المنتج (بالعربية) *»**: حط واحد من العناوين التلاتة (مثلاً: ${title1}).\n` +
    `• في خانة **«السعر القطاعي / بالمتجر (${currency}) *»**: اكتب **${priceNum > 0 ? priceNum : priceDisplay}**.\n` +
    `• في قسم **«المقاسات المتاحة وأسعارها»** (الخطوة 3): أضف ${size || 'المقاسات والألوان المتاحة عندك'}.\n` +
    `• في قسم **«رفع صور»** (الخطوة 4): ارفع أول صورة «أساسية» تكون واضحة وإضاءتها حلوة، وبعدها صور تفاصيل وزوايا، ثم صورة والمنتج بيتستخدم.\n` +
    `• في خانة **«رابط فيديو للمنتج (اختياري)»**: ${data.videoUrl ? `حط اللينك بتاعك: ${data.videoUrl}` : 'حط رابط ريلز أو شورتس 15–30 ثانية لو صورته'}.\n` +
    `• في خانة **«وصف المنتج للعملاء (بالعربية)»** (الخطوة 5): ابدأ بالقصة في سطرين، وتحتها الوصف المتوسط، وفي آخر سطر حط الكلمات الدلالية والهاشتاجات (وممكن كمان تنشر القصة كبوست مستقل في صفحتك الشخصية).\n` +
    `• في خانة **«ملاحظات داخلية للورشة»**: اكتب لنفسك الخامة (${material}) وأي ملاحظات تنفيذ داخلية (مش بتظهر للعميل).`;

  // 6) Personal Profile Post + Family Table Post (if core_free active)
  const openingHook = libPack?.hook || `✨ قطعة جديدة طلعت من إيدينا النهاردة: ${title1}`;
  const closingQuestion =
    libPack?.engagementQuestion || 'قولولي رأيكم في الفكرة واللون اللي تحبوا تشوفوها بيه المرة الجاية؟ 👇';
  const personalProfilePost = sanitizeForbiddenMarketingClaims(
    `${openingHook}\n` +
      `**${title1}**\n\n` +
      `${productStory}\n\n` +
      `• الخامة: ${material}\n` +
      (size ? `• المقاس: ${size}\n` : '') +
      `• المميزات: ${feats.join(' • ')}\n` +
      `• السعر: ${priceDisplay}\n\n` +
      `${closingQuestion}\n` +
      hashtags.join(' '),
    realFactsText
  );

  const familyTablePost = sanitizeForbiddenMarketingClaims(
    `مساء الفل يا عيلة الشمساوية ☀️\n` +
      `حبيت أشارككم أحدث قطعة شغال عليها دلوقتي: **${product}** من **${material}** (${audience.split('(')[0].trim()}).\n` +
      `أكتر حاجة ركّزت فيها: ${feats.slice(0, 2).join(' و')}.\n` +
      `بخبرتكم يا فنانين، تحبوا أضيف معاها لون إيه تاني أو فكرة تغليف تبرزها أكتر؟ مستني رأيكم!`,
    realFactsText
  );

  // 7) WhatsApp message ONLY if storefront/catalog active (من المكتبة التسويقية بـ 3 أساليب)
  const whatsappMessage = canStorefront
    ? sanitizeForbiddenMarketingClaims(
        libPack
          ? `— أسلوب ودود:\n${libPack.whatsappStyles.offerFriendly}\n\n` +
              `— أسلوب سريع:\n${libPack.whatsappStyles.offerFast}\n\n` +
              `— أسلوب رسمي:\n${libPack.whatsappStyles.offerFormal}`
          : `أهلاً بيك من ${brand} ☀️\n` +
              `جهّزنا قطعة جديدة ليك: *${title1}*\n` +
              `• الخامة: ${material}\n` +
              (size ? `• المقاس: ${size}\n` : '') +
              `• المميزات: ${feats.slice(0, 3).join('، ')}\n` +
              `• السعر: *${priceDisplay}*\n` +
              `لو حابب تشوف صور أكتر أو تحجزها باللون اللي تحبه، ابعتلي رسالة وهرد عليك فوراً 🤍`,
        realFactsText
      )
    : null;

  // 8) Honest Organic Reach Tips + Specialty Photo/Video/Bundle Tips from Library
  const videoIdea =
    libPack && libPack.videoIdeas.length > 0
      ? libPack.videoIdeas.slice(0, 2).join(' — أو: ')
      : `فيديو قصير 15–30 ثانية: أول 3 ثواني لقطة قريبة لـ «${product}» وهي جاهزة في إيدك أو في مكان استخدامها، وبعدين 10 ثواني من لحظة الشغل بـ «${material}»، وفي الآخر لقطة للتغليف وسؤال للجمهور عن اللون المفضل.`;
  const specialtyPhotoLine = libPack?.photoTips
    ? libPack.photoTips
    : `صوّر في ضوء شباك طبيعي وخلفية هادية عشان تفاصيل «${material}» تبان.`;
  const bundlesLine =
    libPack && libPack.bundles.length > 0
      ? `\n7. **أفكار باقات جاهزة ترفع قيمة الطلب:** ${libPack.bundles.slice(0, 2).join(' | ')}.`
      : '';
  const organicTips =
    `💡 **نصايح بسيطة تساعد منشورك يوصل لناس أكتر (من غير وعود وهمية):**\n` +
    `1. **أول سطر يجذب العين:** ابدأ بمشكلة أو مناسبة تهم العميل بدل ما تبدأ بـ «للبيع».\n` +
    `2. **نصيحة تصوير لتخصصك (${libPack?.specialtyNameAr || 'شغل يدوي'}):** ${specialtyPhotoLine}\n` +
    `3. **فكرة فيديو قصير (15–30 ثانية):** ${videoIdea}\n` +
    `4. **اختم البوست بسؤال:** ${closingQuestion}\n` +
    `5. **رد على كل تعليق بسرعة وبود:** التفاعل الحقيقي مع الناس بيخليهم يفتكروا صفحتك.\n` +
    `6. **أعد النشر قبل المواسم المناسبة:** لو القطعة تنفع هدية، نزّلها قبل الموسم بأسبوعين بفيديو أو زاوية تصوير جديدة.` +
    bundlesLine;

  const copyBlocks: ShamousaCopyBlock[] = [
    {
      id: 'cb_titles',
      title: '🏷️ 3 عناوين جاهزة للمنتج',
      content: `1) ${title1}\n2) ${title2}\n3) ${title3}`,
    },
    {
      id: 'cb_desc',
      title: '📝 الوصف (قصير + متوسط)',
      content: `— وصف قصير:\n${shortDesc}\n\n— وصف متوسط:\n${mediumDesc}`,
    },
    {
      id: 'cb_story',
      title: '📖 قصة المنتج (وراء الكواليس)',
      content: productStory,
    },
    {
      id: 'cb_tags',
      title: '🔖 الكلمات الدلالية والهاشتاجات',
      content: `كلمات دلالية: ${keywords.join('، ')}\nهاشتاجات: ${hashtags.join(' ')}`,
    },
    {
      id: 'cb_map',
      title: '🗺️ خريطة «حط إيه فين» في إضافة المنتج',
      content: whereToPutMap,
    },
  ];

  if (canCore) {
    copyBlocks.push(
      {
        id: 'cb_profile_post',
        title: '👤 بوست صفحتك الشخصية',
        content: personalProfilePost,
      },
      {
        id: 'cb_family_post',
        title: '👨‍👩‍👧‍👦 بوست طبلية عيلة الشمساوية',
        content: familyTablePost,
      }
    );
  }

  if (whatsappMessage) {
    copyBlocks.push({
      id: 'cb_whatsapp',
      title: '💬 رسالة واتساب جاهزة للعملاء',
      content: whatsappMessage,
    });
  }

  copyBlocks.push({
    id: 'cb_organic',
    title: '🌱 نصايح وصول طبيعي وفكرة الفيديو القصير',
    content: organicTips,
  });

  const combinedStoreDescription = `${productStory}\n\n${mediumDesc}\n\n${hashtags.join(' ')}`;

  const prefillDraft: ProductWizardPrefillDraft = {
    productName: title1,
    storePrice: priceNum > 0 ? String(priceNum) : '',
    storeDescription: combinedStoreDescription,
    personalNotes: `الخامة: ${material}${size ? ` | المقاس: ${size}` : ''} | المميزات: ${feats.join('، ')}`,
    videoUrl: data.videoUrl,
    sizeLabel: size || undefined,
    categoryHint: product,
    materialHint: material,
    createdAt: Date.now(),
  };

  const summaryReply =
    `🎉 **ملف منتجك «${product}» جاهز بالكامل يا ${ctx.firstName}!**\n` +
    `جهّزتلك العناوين، الوصف، القصة، الهاشتاجات، خريطة «حط إيه فين»${canCore ? '، بوست صفحتك وبوست طبلية العيلة' : ''}${whatsappMessage ? '، ورسالة واتساب جاهزة' : ''} — كلها تحت بعض تقدر تنسخ أي جزء بضغطة زر.` +
    (canStorefront
      ? `\n\nولو عايز تدخلها الكتالوج على طول وتراجعها قبل الحفظ، اضغط على زر **«ضيف المنتج بالبيانات دي»** تحت 👇`
      : `\n\nتقدر تنسخ البوست وتنشره على صفحتك الشخصية أو طبلية عيلة الشمساوية دلوقتي فوراً!`);

  return {
    nextState: {
      active: false,
      currentStep: null,
      awaitingCustomInput: false,
      data,
      completed: true,
    },
    reply: summaryReply,
    copyBlocks,
    prefillDraft: canStorefront ? prefillDraft : undefined,
    actionLink: canStorefront ? undefined : { label: 'فتح صفحتي الشخصية 👤', view: 'personal_profile' },
  };
}

/**
 * يبدأ معالج منتج جديد ويستخرج أي بيانات قالها المستخدم في جملته تلقائياً فلا يسأل عنها تاني.
 */
export function startNewProductWizard(
  initialText: string,
  ctx: ProductWizardContext
): ProductWizardTurnResult {
  const extracted = extractFieldsFromInitialSentence(initialText);
  const data: ProductWizardData = {
    productType: extracted.productType,
    material: extracted.material,
    sizeDetails: extracted.sizeDetails,
    audienceOccasion: extracted.audienceOccasion,
    features: [],
    price: extracted.price,
    numericPrice: extracted.numericPrice,
    mediaNote: extracted.mediaNote,
    videoUrl: extracted.videoUrl,
  };

  const capturedParts: string[] = [];
  if (data.productType) capturedParts.push(`المنتج: **${data.productType}**`);
  if (data.material) capturedParts.push(`الخامة: **${data.material}**`);
  if (data.sizeDetails) capturedParts.push(`المقاس: **${data.sizeDetails}**`);
  if (data.audienceOccasion) capturedParts.push(`الجمهور: **${data.audienceOccasion}**`);
  if (data.price) capturedParts.push(`السعر: **${data.price}**`);

  const intro =
    capturedParts.length > 0
      ? `حلو قوي يا **${ctx.firstName}** ☀️ لقطت من كلامك: ${capturedParts.join(' • ')}.\nهنكمّل بس اللي ناقص خطوة بخطوة:`
      : `يلا نجهّز منتجك الجديد مع بعض يا **${ctx.firstName}** ☀️ هسألك خطوة بخطوة ونطلعلك كل النصوص والبوستات جاهزة للنسخ:`;

  const nextStep = getNextMissingStep(data, null);
  if (!nextStep) {
    return buildFinalWizardOutput(data, ctx);
  }
  return buildQuestionForStep(nextStep, data, ctx, intro);
}

/**
 * يعالج إجابة المستخدم في الخطوة الحالية من معالج منتج جديد.
 */
export function advanceProductWizard(
  state: ProductWizardState,
  userInput: string,
  ctx: ProductWizardContext
): ProductWizardTurnResult {
  const trimmed = String(userInput || '').trim();
  const norm = normalizeAr(trimmed);

  // السماح بإلغاء المعالج في أي لحظة
  if (/^(الغاء|إلغاء|الغي|إلغي|وقف|اقفل المعالج|بلاش)$/.test(norm)) {
    return {
      nextState: { active: false, currentStep: null, awaitingCustomInput: false, data: { features: [] } },
      reply: `تمام يا **${ctx.firstName}**، وقفت معالج المنتج الجديد. وقت ما تحب نرجعله اكتبلي «منتج جديد» ☀️`,
    };
  }

  const step = state.currentStep;
  if (!step) {
    return buildFinalWizardOutput(state.data, ctx);
  }

  // لو المستخدم ضغط «حاجة تانية»
  if (trimmed === '__CUSTOM__' || norm === 'حاجه تانيه' || norm === 'اكتب السعر بنفسي') {
    const customPrompts: Record<ProductWizardStepKey, string> = {
      productType: 'اكتبلي اسم المنتج اللي بتعمله (مثلاً: مفرش سفرة، طقم كوسترات، توكة شعر):',
      material: 'اكتبلي اسم الخامة اللي بتستخدمها:',
      sizeDetails: 'اكتبلي المقاس أو التفاصيل اللي تحب تذكرها (مثلاً: 25×30 سم بألوان باستيل):',
      audienceOccasion: 'اكتبلي المنتج ده لمين ولأنهي مناسبة:',
      features: 'اكتب الميزة الإضافية اللي بتميّز شغلك (وبعدها نقدر نكمّل):',
      price: `اكتب السعر اللي إنت محدّده بالرقم (${ctx.currencySymbol || 'ج.م'}):`,
      media: 'الصق لينك الفيديو (يبدأ بـ https://) أو اكتب ملاحظة عن الصور:',
    };
    return {
      nextState: { ...state, awaitingCustomInput: true },
      reply: `تمام يا **${ctx.firstName}** ✍️ ${customPrompts[step]}`,
    };
  }

  const nextData: ProductWizardData = {
    ...state.data,
    features: [...(state.data.features || [])],
  };

  if (step === 'features') {
    if (trimmed === '__DONE_MULTI__' || /^(كمل|كمّل|التالي|خلاص|تمام)$/.test(norm)) {
      if (nextData.features.length === 0) {
        nextData.features = ['شغل يدوي 100%'];
      }
      const nextStep = getNextMissingStep(nextData, 'features');
      return nextStep
        ? buildQuestionForStep(nextStep, nextData, ctx, `تمام، سجّلت المميزات: **${nextData.features.join(' • ')}**.`)
        : buildFinalWizardOutput(nextData, ctx);
    }

    // Toggle / add feature
    if (state.awaitingCustomInput) {
      if (trimmed && !nextData.features.includes(trimmed)) {
        nextData.features.push(trimmed);
      }
      const nextStep = getNextMissingStep(nextData, 'features');
      return nextStep
        ? buildQuestionForStep(nextStep, nextData, ctx, `ضفت «${trimmed}» لمميزات المنتج 👍`)
        : buildFinalWizardOutput(nextData, ctx);
    }

    const existsIdx = nextData.features.indexOf(trimmed);
    if (existsIdx >= 0) {
      nextData.features.splice(existsIdx, 1);
    } else if (trimmed) {
      nextData.features.push(trimmed);
    }

    // Re-show multi-select question with updated selections
    return buildQuestionForStep(
      'features',
      nextData,
      ctx,
      nextData.features.length > 0
        ? `المميزات المختارة لحد دلوقتي: **${nextData.features.join(' • ')}** — اختار تاني أو اضغط «كمّل».`
        : 'اختار المميزات اللي بتميّز القطعة وبعدين اضغط «كمّل».'
    );
  }

  switch (step) {
    case 'productType':
      nextData.productType = trimmed;
      break;
    case 'material':
      nextData.material = trimmed;
      break;
    case 'sizeDetails':
      nextData.sizeDetails = /^(تخطي|لا|مفيش|بدون)$/.test(norm) ? '' : trimmed;
      break;
    case 'audienceOccasion':
      nextData.audienceOccasion = trimmed;
      break;
    case 'price': {
      const cleanedNum = Number(trimmed.replace(/[^\d.]/g, ''));
      nextData.price = trimmed;
      if (Number.isFinite(cleanedNum) && cleanedNum > 0) {
        nextData.numericPrice = cleanedNum;
      }
      break;
    }
    case 'media': {
      const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        nextData.videoUrl = urlMatch[0];
      }
      nextData.mediaNote = trimmed;
      break;
    }
  }

  const nextStep = getNextMissingStep(nextData, step);
  if (!nextStep) {
    return buildFinalWizardOutput(nextData, ctx);
  }
  return buildQuestionForStep(nextStep, nextData, ctx);
}
