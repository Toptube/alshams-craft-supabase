/**
 * محرك فهم المنتج + توليد النصوص من المكتبة التسويقية مع تنويع الصياغة (أوفلاين 100%)
 * - يقرأ التخصصات والكلمات الدالة ديناميكياً من HANDMADE_MARKETING_LIBRARY
 *   بحيث إضافة أي دفعة أو تخصص جديد تعمل تلقائياً بدون تعديل كود.
 * - يمنع تكرار نفس الصياغة ورا بعض لكل حساب (محلياً فقط، بدون مشاركة بين الحسابات).
 * - يلتزم بقاعدة 6: منع الادعاءات الطبية/العلاجية/"طبيعي 100%"/"آمن للأطفال"/"مضمون"/ندرة وهمية/شهادات مخترعة
 *   إلا لو مكتوبة فعلاً في بيانات المنتج.
 */

import {
  type CraftMarketingSpecialty,
  type HandmadeMarketingLibraryData,
  type MarketingObjectionReply,
  type MarketingSeasonEntry,
} from '../data/shamousaMarketingLibrary';
import { getEffectiveMarketingLibrary } from './shamousaCustomLibrariesStore';
import type { ImageQualityReport } from './shamousaImageQuality';
import {
  selectLearnedToneForAccount,
  getAccountLengthPreference,
  type LearnedToneStyle,
} from './shamousaSelfCheckAndLearning';

export interface ProductUnderstandingResult {
  rawText: string;
  normalizedText: string;
  specialty: CraftMarketingSpecialty | null;
  specialtyConfidence: 'high' | 'medium' | 'ambiguous' | 'none';
  candidateSpecialties: CraftMarketingSpecialty[];
  matchedKeywords: string[];
  productType?: string;
  material?: string;
  audience?: string;
  occasion?: string;
  matchedSeason?: MarketingSeasonEntry;
  colorOrStyle?: string;
  sizeDetails?: string;
  numericPrice?: number;
  isAmbiguous: boolean;
  clarifyingQuestion?: string;
  clarifyingOptions?: Array<{ id: string; label: string; value: string }>;
}

const HINDI_DIGITS: Record<string, string> = {
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
};

export function normalizeArabicMarketingText(raw: string): string {
  return String(raw || '')
    .replace(/[٠-٩]/g, (ch) => HINDI_DIGITS[ch] ?? ch)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // تقليص المدّ العفوي مثل "مكرمييييه" -> "مكرميه"
    .replace(/([\u0621-\u064A])\1{2,}/g, '$1')
    // تصحيح أخطاء إملائية وعامية شائعة
    .replace(/(^|\s)(ماكرميه|مكروميه|ماكراميه|مكرميا|مكارميه)(?=\s|$)/g, '$1مكرميه')
    .replace(/(^|\s)(كروشيا|كروشي|كرشيه|قروشيه|تريكوا|تريكوو)(?=\s|$)/g, '$1كروشيه')
    .replace(/(^|\s)(اميجرومي|اميجورمي|اميجورومى|امجرومي)(?=\s|$)/g, '$1اميجورومي')
    .replace(/(^|\s)(تطريس|تطريذ|مطرزه|مطرذه|كانفاه|كنفاه|كانفا)(?=\s|$)/g, '$1تطريز')
    .replace(/(^|\s)(تافتيج|تافتينج|تافتنج|تفتنج)(?=\s|$)/g, '$1تافتنج')
    .replace(/(^|\s)(بانش نيديل|بنش نيدل|بانش ندل)(?=\s|$)/g, '$1بانش نيدل')
    .replace(/(^|\s)(?:ب|و|ل|ف)?(?:ال)?ابره\s+(?:ال)?(?:مثقبه|النفاش|نفاش)(?=\s|$)/g, '$1بانش نيدل')
    .replace(/(^|\s)(دريم كاتشر|دريم كاتشير)(?=\s|$)/g, '$1ملتقط احلام')
    .replace(/(^|\s)(تعلقه|تعليقه)(?=\s|$)/g, '$1تعليقه')
    .replace(/[^\u0600-\u06FFa-z0-9\s#._+-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripArabicPrefix(token: string): string {
  if (token.length > 5 && /^(بال|وال|كال|فال)/.test(token)) {
    return token.slice(3);
  }
  if (token.length > 4 && /^(ال|لل)/.test(token)) {
    return token.slice(2);
  }
  if (token.length > 4 && /^[وبلفك]/.test(token) && !/^(كروش|كليم|كتان|كاناف|كوستر|كوشن|كاسات|فراش|فخار|فازه|لوح|وساد|بلوفر)/.test(token)) {
    return token.slice(1);
  }
  return token;
}

function tokenize(norm: string): string[] {
  const rawTokens = norm.split(/\s+/).filter((t) => t.length >= 2);
  const expanded: string[] = [];
  for (const t of rawTokens) {
    expanded.push(t);
    const stripped = stripArabicPrefix(t);
    if (stripped !== t && stripped.length >= 2) {
      expanded.push(stripped);
    }
  }
  return expanded;
}

function levenshtein(a: string, b: string): number {
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

function fuzzyMatchScore(token: string, keywordToken: string): number {
  if (!token || !keywordToken) return 0;
  if (token === keywordToken) return 1;
  if (token.length >= 3 && keywordToken.length >= 3) {
    if (token.includes(keywordToken) || keywordToken.includes(token)) return 0.85;
  }
  const maxLen = Math.max(token.length, keywordToken.length);
  if (maxLen < 4) return 0;
  const dist = levenshtein(token, keywordToken);
  if (dist === 1) return 0.82;
  if (dist === 2 && maxLen >= 6) return 0.68;
  return 0;
}

const GENERAL_PRODUCT_SYNONYMS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'تعليقة حائط', patterns: [/تعليقه حائط/, /معلقه/, /جداري/, /تابلو/, /ديكور حائط/, /فوق السرير/] },
  { canonical: 'حامل نباتات', patterns: [/حامل نبات/, /حامل زرع/, /اصيص/, /زرعه/] },
  { canonical: 'ملتقط أحلام', patterns: [/ملتقط احلام/, /دريم كاتشر/] },
  { canonical: 'قاعدة أكواب', patterns: [/قاعده اكواب/, /كوستر/, /كوسترات/, /كاسات/] },
  { canonical: 'ميدالية', patterns: [/ميدالي/, /حامل مفاتيح/, /سلسله مفاتيح/] },
  { canonical: 'شنطة', patterns: [/شنط/, /حقيب/, /بوك/, /كروس/, /توت باج/] },
  { canonical: 'دمية أميجورومي', patterns: [/اميجورومي/, /دمي/, /دميه/, /عروسه لعبه/, /دبدوب/] },
  { canonical: 'شال / إيشارب', patterns: [/شال/, /ايشارب/, /كوفيه/, /سكارف/] },
  { canonical: 'بطانية أطفال', patterns: [/بطاني/, /طقم مولود/, /مواليد/] },
  { canonical: 'بلوفر / ملابس', patterns: [/بلوفر/, /فستان/, /قبعه/, /طاقيه/, /ايس كاب/, /جوارب/, /لكلوك/] },
  { canonical: 'برواز / طارة تطريز', patterns: [/برواز/, /براويز/, /طاره/, /اسم مطرز/, /منديل/] },
  { canonical: 'وسادة / كوشن', patterns: [/وساده/, /وسائد/, /كوشن/, /مخده/] },
  { canonical: 'سجادة / سجاد حائط', patterns: [/سجاد/, /سجاده/, /كليم/, /مفرش/, /رانر/] },
  { canonical: 'ستارة وفواصل', patterns: [/ستار/, /ستاير/, /فواصل/] },
  { canonical: 'سلة تخزين', patterns: [/سله/, /سلال/, /منظم/, /باسكت/] },
  { canonical: 'شمعة معطرة', patterns: [/شمع/, /فواح/] },
  { canonical: 'صينية ديكور', patterns: [/صيني/, /طقم ضياف/] },
  { canonical: 'إكسسوار / حلي', patterns: [/سلسل/, /انسيال/, /حلق/, /خاتم/, /بروش/, /اسور/, /توكه/, /اكسسوار/] },
  { canonical: 'محفظة', patterns: [/محفظ/, /حافظه/] },
  { canonical: 'بوكس هدية', patterns: [/بوكس هدي/, /صندوق هدي/, /توزيعات/] },
];

const GENERAL_MATERIAL_SYNONYMS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'حبل قطن مجدول', patterns: [/حبل قطن/, /حبل مجدول/, /مكرمي/] },
  { canonical: 'خيط قطن', patterns: [/خيط قطن/, /قطن/] },
  { canonical: 'خيط صوف', patterns: [/صوف/, /تريكو/] },
  { canonical: 'خيط أكريليك / كروشيه', patterns: [/اكريليك/, /ميلانج/, /كروشي/] },
  { canonical: 'خيوط تطريز وقماش كانافاه', patterns: [/تطريز/, /كانافاه/, /كتان/, /خيمي/, /نول/] },
  { canonical: 'خيوط صوف وتافتنج', patterns: [/تافتنج/, /بانش نيدل/, /مونك/] },
  { canonical: 'ريزن إيبوكسي', patterns: [/ريزن/, /ايبوكسي/] },
  { canonical: 'شمع صويا', patterns: [/شمع صويا/, /شمع نحل/, /شمع برافين/, /شمع/] },
  { canonical: 'جلد طبيعي', patterns: [/جلد طبيعي/, /جلد/] },
  { canonical: 'كونكريت / جبس', patterns: [/كونكريت/, /جسمونيت/, /جبس/] },
  { canonical: 'خشب', patterns: [/خشب/, /زان/, /اركيت/] },
  { canonical: 'خرز وأحجار', patterns: [/خرز/, /لولي/, /كريستال/, /احجار/, /عقيق/] },
  { canonical: 'صلصال / خزف', patterns: [/صلصال/, /فخار/, /خزف/, /سيراميك/] },
];

const AUDIENCE_SYNONYMS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'للأطفال والمواليد', patterns: [/اطفال/, /للاطفال/, /طفل/, /بيبي/, /مواليد/, /سبون/, /مدارس/] },
  { canonical: 'للبنات والسيدات', patterns: [/بنات/, /للبنات/, /سيدات/, /حريمي/, /عروسه/, /عرايس/, /ماما/] },
  { canonical: 'لديكور البيت', patterns: [/للبيت/, /ديكور/, /منزل/, /مكتب/, /سفره/, /غرفه/, /حيطه/, /سرير/] },
  { canonical: 'للشباب والرجال', patterns: [/رجالي/, /للرجال/, /شباب/, /عربيه/, /سياره/] },
  { canonical: 'للشركات والمجموعات', patterns: [/شركه/, /شركات/, /شعار/, /لوجو/, /توزيعات/, /مجموعه/] },
];

const COLOR_STYLE_SYNONYMS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'بيج / أوف وايت', patterns: [/بيج/, /اوف وايت/, /كريمي/, /ابيض/] },
  { canonical: 'ألوان باستيل', patterns: [/باستيل/, /بينك/, /وردي/, /لبني/, /منت/] },
  { canonical: 'ستايل بوهو', patterns: [/بوهو/, /بوهيمي/] },
  { canonical: 'ستايل تراثي', patterns: [/تراثي/, /تراث/, /خيمي/, /شرقي/] },
  { canonical: 'ألوان دافئة', patterns: [/بني/, /جملي/, /نبيتي/, /زيتي/, /كموني/, /خردلي/] },
  { canonical: 'أسود / كلاسيك', patterns: [/اسود/, /كلاسيك/, /ساده/] },
];

/**
 * محرك فهم المنتج الرئيسي:
 * يحدد التخصص من "كلمات دالة" كل تخصص موجود حالياً في HANDMADE_MARKETING_LIBRARY
 * (ويدعم تلقائياً أي تخصص يُضاف في الدفعتين 2 و 3 بدون أي تعديل في الكود).
 */
export function understandProductSentence(
  rawText: string,
  library: HandmadeMarketingLibraryData = getEffectiveMarketingLibrary()
): ProductUnderstandingResult {
  const normalizedText = normalizeArabicMarketingText(rawText);
  const tokens = tokenize(normalizedText);

  const scoredSpecialties = library.specialties
    .map((spec) => {
      let score = 0;
      const matched: string[] = [];

      // فحص الكلمات الدالة (الوزن الأعلى)
      for (const kw of spec.keywords) {
        const nkw = normalizeArabicMarketingText(kw);
        if (!nkw) continue;
        if (normalizedText === nkw) {
          score += 14;
          matched.push(kw);
        } else if (nkw.includes(' ')) {
          if (normalizedText.includes(nkw)) {
            score += 11;
            matched.push(kw);
          } else {
            const kwToks = tokenize(nkw);
            const allHit = kwToks.length > 0 && kwToks.every((kt) => tokens.some((t) => fuzzyMatchScore(t, kt) >= 0.8));
            if (allHit) {
              score += 8.5;
              matched.push(kw);
            }
          }
        } else {
          if (tokens.includes(nkw) || (nkw.length >= 4 && normalizedText.includes(nkw))) {
            score += nkw.length >= 4 ? 9 : 6;
            matched.push(kw);
          } else {
            let bestTok = 0;
            for (const t of tokens) {
              bestTok = Math.max(bestTok, fuzzyMatchScore(t, nkw));
            }
            if (bestTok >= 0.78) {
              score += bestTok * 7;
              matched.push(kw);
            }
          }
        }
      }

      // فحص المنتجات الرائجة الخاصة بالتخصص (وزن مساعد)
      for (const pop of spec.popularItems) {
        const npop = normalizeArabicMarketingText(pop);
        if (npop.length >= 4 && normalizedText.includes(npop)) {
          score += 4.5;
          if (!matched.includes(pop)) matched.push(pop);
        }
      }

      // فحص الخامات النموذجية للتخصص (وزن مساعد)
      for (const mat of spec.typicalMaterials) {
        const nmat = normalizeArabicMarketingText(mat.split('(')[0]);
        if (nmat.length >= 4 && normalizedText.includes(nmat)) {
          score += 3;
        }
      }

      return { spec, score, matched };
    })
    .sort((a, b) => b.score - a.score);

  const top = scoredSpecialties[0];
  const second = scoredSpecialties[1];

  let specialty: CraftMarketingSpecialty | null = null;
  let specialtyConfidence: ProductUnderstandingResult['specialtyConfidence'] = 'none';
  let candidateSpecialties: CraftMarketingSpecialty[] = [];

  if (top && top.score >= 6) {
    if (second && second.score >= 5 && top.score - second.score <= 2.5) {
      specialty = top.spec;
      specialtyConfidence = 'ambiguous';
      candidateSpecialties = scoredSpecialties
        .filter((s) => s.score >= 4)
        .slice(0, 4)
        .map((s) => s.spec);
    } else {
      specialty = top.spec;
      specialtyConfidence = top.score >= 9 ? 'high' : 'medium';
      candidateSpecialties = [top.spec];
    }
  } else if (top && top.score >= 3) {
    specialty = null;
    specialtyConfidence = 'ambiguous';
    candidateSpecialties = scoredSpecialties
      .filter((s) => s.score >= 2.5)
      .slice(0, 4)
      .map((s) => s.spec);
  } else {
    candidateSpecialties = library.specialties.slice(0, 4);
  }

  // استخراج نوع المنتج (الأولوية لمنتجات التخصص المتطابقة ثم المرادفات العامة)
  let productType: string | undefined;
  if (specialty) {
    for (const pop of specialty.popularItems) {
      const cleanPop = pop.split('(')[0].trim();
      const npop = normalizeArabicMarketingText(cleanPop);
      if (npop && normalizedText.includes(npop)) {
        productType = cleanPop;
        break;
      }
    }
  }
  if (!productType) {
    for (const entry of GENERAL_PRODUCT_SYNONYMS) {
      if (entry.patterns.some((p) => p.test(normalizedText))) {
        productType = entry.canonical;
        break;
      }
    }
  }

  // استخراج الخامة
  let material: string | undefined;
  for (const entry of GENERAL_MATERIAL_SYNONYMS) {
    if (entry.patterns.some((p) => p.test(normalizedText))) {
      material = entry.canonical;
      break;
    }
  }
  if (!material && specialty && specialty.typicalMaterials.length > 0 && specialtyConfidence === 'high') {
    // لا نخترع خامة محددة إلا لو المستخدم لمّح للتخصص بوضوح، نتركها كخامة التخصص الأساسية إن كانت الكلمة الدالة هي الخامة نفسها
    const matKwHit = specialty.typicalMaterials.find((tm) => {
      const firstWord = normalizeArabicMarketingText(tm.split('(')[0]).split(' ').slice(0, 2).join(' ');
      return firstWord.length >= 3 && normalizedText.includes(firstWord);
    });
    if (matKwHit) {
      material = matKwHit.split('(')[0].trim();
    }
  }

  // استخراج الجمهور
  let audience: string | undefined;
  for (const entry of AUDIENCE_SYNONYMS) {
    if (entry.patterns.some((p) => p.test(normalizedText))) {
      audience = entry.canonical;
      break;
    }
  }

  // استخراج الموسم / المناسبة من المكتبة العامة
  let matchedSeason: MarketingSeasonEntry | undefined;
  let occasion: string | undefined;
  for (const s of library.general.seasonsAndOccasions) {
    const hit = s.keywords.some((kw) => normalizedText.includes(normalizeArabicMarketingText(kw)));
    if (hit) {
      matchedSeason = s;
      occasion = s.seasonAr;
      break;
    }
  }
  if (!occasion && /(هدي|هدايا|تخرج|عيد ميلاد|بيت جديد)/.test(normalizedText)) {
    if (/تخرج/.test(normalizedText)) occasion = 'التخرج';
    else if (/عيد ميلاد/.test(normalizedText)) occasion = 'عيد الميلاد';
    else if (/بيت جديد/.test(normalizedText)) occasion = 'تجهيز بيت جديد';
    else occasion = 'هدايا ومناسبات';
  }

  // استخراج اللون / الستايل
  let colorOrStyle: string | undefined;
  for (const entry of COLOR_STYLE_SYNONYMS) {
    if (entry.patterns.some((p) => p.test(normalizedText))) {
      colorOrStyle = entry.canonical;
      break;
    }
  }

  // استخراج المقاس
  const sizeMatch = rawText.match(
    /(\d+\s*[×xX*]\s*\d+\s*(?:سم|متر|م|cm)?|\d+\s*(?:سم|متر|مم|مللي|جرام|جم|cm)|صغير(?:ة)?|وسط|متوسط(?:ة)?|كبير(?:ة)?)/i
  );
  const sizeDetails = sizeMatch ? sizeMatch[0].trim() : undefined;

  // استخراج السعر
  const priceMatch = rawText.match(/(?:بسعر|سعرها?|بـ|ب)\s*(\d+(?:\.\d+)?)\s*(?:ج\.?م|جنيه|ريال|دولار)?/i);
  const numericPrice = priceMatch ? Number(priceMatch[1]) : undefined;

  // تحديد الغموض وبناء 3–4 اختيارات توضيحية
  const isAmbiguous = specialtyConfidence === 'ambiguous' || (specialtyConfidence === 'none' && !productType);
  let clarifyingQuestion: string | undefined;
  let clarifyingOptions: Array<{ id: string; label: string; value: string }> | undefined;

  if (specialtyConfidence === 'ambiguous' && candidateSpecialties.length >= 2) {
    clarifyingQuestion = `عشان أطلّعلك أنسب كلام وهاشتاجات بدقة: شغلك أقرب لأنهي تخصص من دول؟`;
    clarifyingOptions = [
      ...candidateSpecialties.slice(0, 3).map((s, idx) => ({
        id: `amb_spec_${idx}`,
        label: s.nameAr,
        value: `${rawText} (${s.nameAr})`,
      })),
      { id: 'amb_spec_other', label: 'تخصص تاني (هوضّحه)', value: 'منتج جديد' },
    ];
  } else if (specialtyConfidence === 'none' && !productType) {
    clarifyingQuestion = `قولّي بس القطعة دي تبع أنهي شغل عشان أجهّزلك كلام مظبوط على مقاسها:`;
    clarifyingOptions = [
      ...library.specialties.slice(0, 3).map((s, idx) => ({
        id: `none_spec_${idx}`,
        label: s.nameAr,
        value: `عايز أسوّق منتج ${s.nameAr}`,
      })),
      { id: 'none_spec_wizard', label: 'معالج منتج جديد خطوة بخطوة ✨', value: 'منتج جديد' },
    ];
  } else if (specialty && !productType && tokens.length <= 2) {
    // كلمة واحدة واضحة التخصص مثل "مكرمية" أو "تافتنج" -> نعرض 3-4 اختيارات عملية فورية
    clarifyingQuestion = `جميل، شغل **${specialty.nameAr}** ☀️ تحب نعمل إيه دلوقتي؟`;
    clarifyingOptions = [
      { id: 'sp_opt_1', label: `جهّز منتج ${specialty.nameAr} جديد ✨`, value: `عايز أعمل منتج ${specialty.nameAr}` },
      { id: 'sp_opt_2', label: `أفكار بوستات وفيديو لـ ${specialty.nameAr} 🎬`, value: `أفكار فيديو وتصوير ${specialty.nameAr}` },
      { id: 'sp_opt_3', label: `باقات وهدايا رائجة في ${specialty.nameAr} 🎁`, value: `باقات ${specialty.nameAr}` },
      { id: 'sp_opt_4', label: `وسوم وهاشتاجات ${specialty.nameAr} #️⃣`, value: `هاشتاجات ${specialty.nameAr}` },
    ];
  }

  return {
    rawText,
    normalizedText,
    specialty,
    specialtyConfidence,
    candidateSpecialties,
    matchedKeywords: top ? top.matched : [],
    productType,
    material,
    audience,
    occasion,
    matchedSeason,
    colorOrStyle,
    sizeDetails,
    numericPrice,
    isAmbiguous,
    clarifyingQuestion,
    clarifyingOptions,
  };
}

/**
 * مخزن تنويع الصياغة ومنع تكرار نفس القالب ورا بعض — محلي لكل حساب فقط (القاعدة 5 + بند 4)
 */
const inMemoryLastPicked = new Map<string, number>();

export function pickVariedPhrase<T>(
  accountId: string,
  slotKey: string,
  items: T[],
  seedOffset = 0
): T {
  if (items.length <= 1) return items[0];
  const scopedKey = `shamousa_var_${accountId || 'anon'}_${slotKey}`;

  let lastIdx = inMemoryLastPicked.get(scopedKey);
  if (lastIdx === undefined && typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem(scopedKey);
      if (saved !== null) lastIdx = Number(saved);
    } catch {
      // ignore storage errors
    }
  }

  let nextIdx: number;
  if (typeof lastIdx === 'number' && Number.isFinite(lastIdx) && lastIdx >= 0) {
    nextIdx = (lastIdx + 1 + (Math.abs(seedOffset) % Math.max(1, items.length - 1))) % items.length;
    if (nextIdx === lastIdx) {
      nextIdx = (lastIdx + 1) % items.length;
    }
  } else {
    nextIdx = Math.abs(seedOffset) % items.length;
  }

  inMemoryLastPicked.set(scopedKey, nextIdx);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(scopedKey, String(nextIdx));
    } catch {
      // ignore
    }
  }
  return items[nextIdx];
}

/**
 * فلتر القاعدة 6: يمنع أي ادعاء علاجي/طبي/"طبيعي 100%"/"آمن للأطفال"/"مضمون"
 * إلا لو مكتوب فعلاً في بيانات المنتج اللي أدخلها المستخدم.
 */
export function sanitizeForbiddenMarketingClaims(
  generatedText: string,
  realProductDataText = ''
): string {
  const normReal = normalizeArabicMarketingText(realProductDataText);
  let output = generatedText;

  const forbiddenReplacements: Array<{ check: RegExp; pattern: RegExp; replacement: string }> = [
    { check: /علاجي/, pattern: /علاجي[ةه]?/g, replacement: 'مريح' },
    { check: /طبي(?!عي)/, pattern: /طبي[ةه]?(?!عي)/g, replacement: 'عملي' },
    { check: /طبيعي\s*(?:100|١٠٠)%?/, pattern: /طبيعي\s*(?:100|١٠٠)%/g, replacement: 'خامة مختارة' },
    { check: /امن\s*للاطفال/, pattern: /آمن\s*للأطفال|امن\s*للاطفال/g, replacement: 'مناسب لغرف وهدايا الأطفال' },
    { check: /مضمون/, pattern: /مضمون[ةه]?(?:\s*(?:100|١٠٠)%)?/g, replacement: 'متقن الصنع' },
  ];

  for (const rule of forbiddenReplacements) {
    if (!rule.check.test(normReal)) {
      output = output.replace(rule.pattern, rule.replacement);
    }
  }

  return output.replace(/\s{2,}/g, ' ').trim();
}

export function fillMarketingTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  let out = template;
  Object.entries(vars).forEach(([key, val]) => {
    const cleanVal = (val || '').trim();
    out = out.split(`{${key}}`).join(cleanVal);
  });
  // تنظيف أي أقواس متبقية لم تتوفر بياناتها بدون اختراع
  out = out.replace(/\{[^}]+\}/g, '').replace(/\s+([،.؟!])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return out;
}

export interface LibraryCopyPackage {
  specialtyNameAr: string;
  titles: string[];
  hook: string;
  shortPostSale: string;
  giftOrSeasonPost: string;
  cta: string;
  engagementQuestion: string;
  photoTips: string;
  videoIdeas: string[];
  bundles: string[];
  hashtags: string[];
  whatsappStyles: {
    welcomeFast: string;
    welcomeFriendly: string;
    welcomeFormal: string;
    offerFast: string;
    offerFriendly: string;
    offerFormal: string;
    followUp: string;
    afterDelivery: string;
  };
  selectedTone?: LearnedToneStyle;
  usedExploration?: boolean;
  preferredWhatsappOffer?: string;
}

/**
 * يبني حزمة تسويقية كاملة من بيانات المنتج الحقيقية + HANDMADE_MARKETING_LIBRARY + تنويع الصياغة + فلتر الادعاءات
 */
export function buildLibraryMarketingCopy(params: {
  accountId: string;
  productName: string;
  material?: string;
  feature?: string;
  priceText?: string;
  occasion?: string;
  colorOrStyle?: string;
  sizeDetails?: string;
  storeLink?: string;
  specialty?: CraftMarketingSpecialty | null;
  realProductFactsText?: string;
  seedOffset?: number;
}): LibraryCopyPackage {
  const lib = getEffectiveMarketingLibrary();
  const spec = params.specialty || understandProductSentence(`${params.productName} ${params.material || ''}`, lib).specialty;
  const factsText =
    params.realProductFactsText ||
    `${params.productName} ${params.material || ''} ${params.feature || ''} ${params.sizeDetails || ''}`;

  const featureText =
    (params.feature || '').trim() ||
    (spec ? pickVariedPhrase(params.accountId, `sp_${spec.id}`, spec.sellingPoints, params.seedOffset || 0) : 'شغل يدوي متقن');

  const occasionText =
    (params.occasion || '').trim() ||
    (spec && spec.occasions.length > 0 ? spec.occasions[0] : 'الهدايا والمناسبات');

  const hookRaw = pickVariedPhrase(
    params.accountId,
    'hook',
    // نستبعد القالب اللي فيه {عدد} ساعة شغل إلا لو متسجّل فعلاً في البيانات
    lib.general.hooks.filter((h) => !h.includes('{عدد}') && !h.includes('{السؤال}')),
    params.seedOffset || 0
  );

  const ctaRaw = pickVariedPhrase(params.accountId, 'cta', lib.general.ctas, params.seedOffset || 0);
  const engQuestion = pickVariedPhrase(
    params.accountId,
    'eng_q',
    lib.general.engagementQuestions,
    params.seedOffset || 0
  );

  const vars: Record<string, string> = {
    المنتج: params.productName,
    الخامة: params.material || 'خامات مختارة',
    ميزة: featureText,
    'ميزة الاستخدام': featureText,
    'اللون/الستايل': params.colorOrStyle || 'بتصميم خاص',
    'اللون/المقاس': params.sizeDetails ? `المقاس (${params.sizeDetails})` : 'اللون والمقاس',
    المناسبة: occasionText,
    السعر: params.priceText || 'اسألنا في الخاص',
    رابط: params.storeLink || '',
  };

  const hook = sanitizeForbiddenMarketingClaims(fillMarketingTemplate(hookRaw, vars), factsText);
  const cta = sanitizeForbiddenMarketingClaims(fillMarketingTemplate(ctaRaw, vars), factsText);

  // اختيار 3 صيغ عناوين متنوعة بدون تكرار متتالي
  const t1Template = pickVariedPhrase(params.accountId, 'title_1', lib.general.titleTemplates, params.seedOffset || 0);
  const remainingTitles = lib.general.titleTemplates.filter((t) => t !== t1Template);
  const t2Template = pickVariedPhrase(params.accountId, 'title_2', remainingTitles, (params.seedOffset || 0) + 1);
  const remainingTitles2 = remainingTitles.filter((t) => t !== t2Template);
  const t3Template = pickVariedPhrase(params.accountId, 'title_3', remainingTitles2, (params.seedOffset || 0) + 2);

  const titles = [t1Template, t2Template, t3Template].map((tpl) =>
    sanitizeForbiddenMarketingClaims(fillMarketingTemplate(tpl, vars), factsText)
  );

  const salePostTpl = lib.general.postTemplates.find((p) => p.id === 'post_sale')?.template || '';
  const giftPostTpl = lib.general.postTemplates.find((p) => p.id === 'post_gift')?.template || '';

  const shortPostSale = sanitizeForbiddenMarketingClaims(
    fillMarketingTemplate(salePostTpl, {
      ...vars,
      'بداية تشدّ': hook,
      دعوة: cta,
    }),
    factsText
  );

  const giftOrSeasonPost = sanitizeForbiddenMarketingClaims(
    fillMarketingTemplate(giftPostTpl, {
      ...vars,
      'اسم/كلمة': 'الاسم أو الكلمة اللي تختارها',
    }),
    factsText
  );

  const wa = lib.general.whatsappTemplates;
  const whatsappStyles = {
    welcomeFast: wa.welcome.fast,
    welcomeFriendly: wa.welcome.friendly,
    welcomeFormal: wa.welcome.formal,
    offerFast: sanitizeForbiddenMarketingClaims(fillMarketingTemplate(wa.productOffer.fast, vars), factsText),
    offerFriendly: sanitizeForbiddenMarketingClaims(fillMarketingTemplate(wa.productOffer.friendly, vars), factsText),
    offerFormal: sanitizeForbiddenMarketingClaims(fillMarketingTemplate(wa.productOffer.formal, vars), factsText),
    followUp: sanitizeForbiddenMarketingClaims(fillMarketingTemplate(wa.followUp, vars), factsText),
    afterDelivery: wa.afterDelivery,
  };

  // تعلّم الأسلوب المحلي للحساب فقط (النبرة + الطول + حصة استكشاف 20%) — لا يمس المعادلات ولا الخصوصية ولا الباقات
  let selectedTone: LearnedToneStyle = 'friendly';
  let usedExploration = false;
  let adaptedShortPost = shortPostSale;
  try {
    const tonePick = selectLearnedToneForAccount(params.accountId);
    selectedTone = tonePick.tone;
    usedExploration = tonePick.isExploration;
    const lenPref = getAccountLengthPreference(params.accountId);

    if (selectedTone === 'formal') {
      adaptedShortPost = `توفّر لدينا «${params.productName}» مصنوعة يدوياً من ${vars['الخامة']} (${vars['ميزة']}).\nالسعر: ${vars['السعر']}. يسعدنا تواصلكم لتأكيد الطلب.`;
    } else if (selectedTone === 'light') {
      adaptedShortPost = `✨ ${params.productName} جاهزة تخطف العين! خامة ${vars['الخامة']} وشغل إيد رايق — السعر ${vars['السعر']}. ابعتلنا رسالة ونظبطلك طلبك فوراً 💬`;
    }

    if (lenPref === 'short' && adaptedShortPost.length > 165) {
      adaptedShortPost = `${adaptedShortPost.slice(0, 160).trim()}…`;
    }
  } catch {
    adaptedShortPost = shortPostSale;
  }

  const preferredWhatsappOffer =
    selectedTone === 'formal'
      ? whatsappStyles.offerFormal
      : selectedTone === 'light'
        ? whatsappStyles.offerFast
        : whatsappStyles.offerFriendly;

  const photoTips = spec
    ? `${spec.photoTips}\n• نصيحة عامة: ${lib.general.generalPhotoTips}`
    : lib.general.generalPhotoTips;

  const videoIdeas = spec
    ? [...spec.videoIdeas, ...lib.general.shortVideoIdeas.slice(0, 3)]
    : lib.general.shortVideoIdeas.slice(0, 5);

  const bundles = spec ? spec.bundles : [];
  const hashtags = spec
    ? Array.from(new Set([...spec.hashtags, '#عيلة_الشمساوية']))
    : ['#هاندميد', '#صنع_يدوي', '#هدايا_يدوية', '#عيلة_الشمساوية'];

  return {
    specialtyNameAr: spec ? spec.nameAr : 'مشغولات يدوية عامة',
    titles,
    hook,
    shortPostSale: adaptedShortPost,
    giftOrSeasonPost,
    cta,
    engagementQuestion: engQuestion,
    photoTips,
    videoIdeas,
    bundles,
    hashtags,
    whatsappStyles,
    selectedTone,
    usedExploration,
    preferredWhatsappOffer,
  };
}

/**
 * اكتشاف اعتراض عميل والرد عليه من المكتبة العامة مع احترام قواعد التكاليف والحد الأدنى
 */
export function matchCustomerObjectionFromLibrary(rawText: string): MarketingObjectionReply | null {
  const norm = normalizeArabicMarketingText(rawText);
  if (!norm) return null;
  const looksLikeObjectionContext =
    /(العميل|عميله|زبون|الناس|بيقول|بتقول|اعترض|اعتراض|ارد ازاي|أرد إزاي|ارد عليه|اقوله ايه)/.test(norm) ||
    /(غالي|هتتاخر|مش متاكد من الجوده|ممكن لون تاني|مقاس تاني)/.test(norm);

  if (!looksLikeObjectionContext) return null;

  const lib = getEffectiveMarketingLibrary();
  let bestMatch: { item: MarketingObjectionReply; score: number } | null = null;
  for (const item of lib.general.objectionReplies) {
    let itemBest = 0;
    for (const t of item.triggers) {
      const nt = normalizeArabicMarketingText(t);
      if (nt && norm.includes(nt)) {
        itemBest = Math.max(itemBest, nt.length);
      }
    }
    if (itemBest > 0 && (!bestMatch || itemBest > bestMatch.score)) {
      bestMatch = { item, score: itemBest };
    }
  }
  return bestMatch ? bestMatch.item : null;
}

/**
 * عند إرسال صورة في شات شموسة أوفلاين (بدون ذكاء اصطناعي):
 * تصارح المستخدم إنها مش بتقرأ محتوى الصورة أوفلاين + تعرض نتيجة فحص الجودة بالـ Canvas + تسأله 2–3 أسئلة سريعة باختيارات.
 */
export function buildOfflineImageUploadResponse(params: {
  firstName: string;
  imageName?: string;
  qualityReport?: ImageQualityReport | null;
}): {
  reply: string;
  options: Array<{ id: string; label: string; queryText?: string; triggerAI?: boolean }>;
} {
  const qualityBlock = params.qualityReport ? `\n\n${params.qualityReport.summaryAr}` : '';
  const reply =
    `استلمت الصورة يا **${params.firstName}** 📸${qualityBlock}\n\n` +
    `💡 **بصراحة:** وأنا شغالة أوفلاين مش بقدر أشوف إيه اللي جوه الصورة، بس أقدر أساعدك فوراً في العنوان والوصف والبوست والتسويق بـ 3 أسئلة سريعة (إيه المنتج؟ الخامة؟ لمين؟)!\n` +
    `اختار نبدأ إزاي:`;

  return {
    reply,
    options: [
      { id: 'img_q_macrame', label: '1) مكرمية 🪢', queryText: 'عايز أعمل منتج مكرمية' },
      { id: 'img_q_crochet', label: '2) كروشيه أو تريكو 🧶', queryText: 'عايز أعمل منتج كروشيه' },
      { id: 'img_q_emb', label: '3) تطريز أو بانش نيدل 🪡', queryText: 'عايز أعمل منتج تطريز' },
      { id: 'img_q_other', label: '4) منتج تاني (خطوة بخطوة) ✨', queryText: 'منتج جديد' },
    ],
  };
}
