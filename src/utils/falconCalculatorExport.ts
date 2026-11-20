import { AIVisionAnalysis, ChatMessage, CraftCategory, UserProfile } from '../types';
import {
  SUB_CRAFTS_REGISTRY,
  SubCraftDefinition,
  getMainSectionForCraft,
} from '../registry/craftsRegistry';
import type { StructuredCalculatorExport } from '../components/ai/FalconAIAgent';

const ARABIC_TO_LATIN_DIGITS: Record<string, string> = {
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
};

function normalizeNums(text: string): string {
  return String(text || '').replace(/[٠-٩٫]/g, (ch) => ARABIC_TO_LATIN_DIGITS[ch] || ch);
}

const CRAFT_KEYWORD_RULES: Array<{ craftId: string; patterns: RegExp[] }> = [
  { craftId: 'tufting_gun', patterns: [/تافتن[جغ]|مسدس التافت|tufting/i] },
  { craftId: 'punch_needle', patterns: [/بانش نيدل|إبرة النقاش|ابرة النقاش|punch\s*needle/i] },
  { craftId: 'zigzag', patterns: [/زجزاج|زيجزاج|حلزوني|حبل زجزاج|zigzag|rope\s*basket/i] },
  { craftId: 'kelim', patterns: [/كليم|نول يدوي|سداء|لحمة|kelim|kilim/i] },
  { craftId: 'crochet', patterns: [/كروشيه|كروشية|أميجورومي|اميجورومي|تريكو كروشيه|crochet|amigurumi/i] },
  { craftId: 'knitting', patterns: [/تريكو|نول دائري|knitting/i] },
  { craftId: 'felting', patterns: [/لباد|تلبيد|felting/i] },
  { craftId: 'dyeing', patterns: [/صباغة|شيبوري|dyeing|shibori/i] },
  { craftId: 'aqqada', patterns: [/عقادة|شرابة|شرابات|حبل مبروم|aqqada/i] },
  { craftId: 'spinning', patterns: [/غزل يدوي|مغزل|spinning/i] },
  { craftId: 'macrame', patterns: [/مكرمية|مكرميه|عقدة مربعة|عقد يدوي|جدارية مكرم|شراشيب|macram/i] },
  { craftId: 'beadwork', patterns: [/خرز|شنطة خرز|شنط خرز|لولي|كريستال خرز|bead/i] },
  { craftId: 'sirma_embroidery', patterns: [/سيرما|قصب|sirma/i] },
  { craftId: 'embroidery', patterns: [/تطريز|طارة تطريز|إيتامين|ايتامين|كانفا تطريز|embroid/i] },
  { craftId: 'wire_wrapping', patterns: [/تشكيل الأسلاك|تشكيل سلك|سلك نحاس|wire\s*wrap/i] },
  { craftId: 'sequins_rhinestones', patterns: [/ترصيع|ترتر|فصوص|rhinestone/i] },
  { craftId: 'jewelry', patterns: [/حلي|إكسسوارات|اكسسوارات|عقد|أسورة|اسورة|خاتم|حلق|jewelry/i] },
  { craftId: 'uv_resin', patterns: [/ريزن\s*uv|يو في ريزن|uv\s*resin/i] },
  { craftId: 'polyester_resin', patterns: [/بوليستر|ألياف زجاجية|polyester/i] },
  { craftId: 'resin', patterns: [/ريزن|إيبوكسي|ايبوكسي|مصلب|resin|epoxy/i] },
  { craftId: 'jesmonite', patterns: [/جيسمونايت|jesmonite/i] },
  { craftId: 'concrete', patterns: [/كونكريت|ترازو|أسمنت ديكوري|اسمنت|concrete|terrazzo/i] },
  { craftId: 'gypsum', patterns: [/جبس|gypsum|plaster/i] },
  { craftId: 'polymer_clay', patterns: [/صلصال حراري|فيمو|polymer\s*clay/i] },
  { craftId: 'pottery', patterns: [/فخار|خزف|عجلة الفخار|pottery/i] },
  { craftId: 'ceramics', patterns: [/سيراميك|بلاط خزف|ceramic/i] },
  { craftId: 'candles', patterns: [/شموع|شمعة|شمع صويا|برافين|فتيل شمع|candle/i] },
  { craftId: 'cold_process_soap', patterns: [/صابون بارد|صودا كاوية|تصبن|cold\s*process/i] },
  { craftId: 'melt_pour_soap', patterns: [/صابون بالصب|صابون جلسرين|صابون|soap/i] },
  { craftId: 'mold_making', patterns: [/قالب سيليكون|قوالب سيليكون|mold/i] },
  { craftId: 'rattan', patterns: [/راتان|rattan/i] },
  { craftId: 'bamboo', patterns: [/بامبو|خيزران|bamboo/i] },
  { craftId: 'wicker', patterns: [/خوص|سعف|جريد|wicker/i] },
  { craftId: 'laser_cnc', patterns: [/ليزر|cnc|راوتر|قص ليزر|mdf/i] },
  { craftId: '3d_printing', patterns: [/طباعة ثلاثية|3d\s*print|فيلمنت|pla/i] },
  { craftId: 'pyrography', patterns: [/حرق على الخشب|pyrography/i] },
  { craftId: 'decoupage', patterns: [/ديكوباج|decoupage/i] },
  { craftId: 'scroll_saw', patterns: [/أركت|اركت|تفريغ خشب/i] },
  { craftId: 'arabesque', patterns: [/أرابيسك|ارابيسك|تصديف/i] },
  { craftId: 'carpentry', patterns: [/نجارة|خشب زان|خشب موسكي|خراطة خشب|wood|carpentry/i] },
  { craftId: 'leathercraft', patterns: [/جلد طبيعي|جلد صناعي|جلود|سادل ستيتش|محفظة جلد|شنطة جلد|leather/i] },
  { craftId: 'copper_silver_shaping', patterns: [/فضة|نحاس|عيار\s*925|silver|copper/i] },
  { craftId: 'metalwork_forging', patterns: [/حدادة|حديد|لحام|ستانلس|ألومنيوم|forging|metalwork/i] },
  { craftId: 'lighting_craft', patterns: [/نجفة|نجف|أباجورة|اباجورة|وحدة إضاءة|وحدة اضاءة|فانوس|lighting|lamp/i] },
  { craftId: 'natural_dried_flowers', patterns: [/زهور مجففة|ورد مجفف|بوكيه طبيعي|dried\s*flower/i] },
  { craftId: 'handmade_flowers', patterns: [/ورد فوم|ورد ساتان|زهور يدوية|handmade\s*flower/i] },
  { craftId: 'acrylic_glass_decor', patterns: [/أكريليك|اكريليك|مرايا ديكور|ديكور زجاج/i] },
  { craftId: 'canvas_painting', patterns: [/كانفاس|لوحة زيت|رسم أكريليك|canvas|painting/i] },
];

function findSubCraft(id: string): SubCraftDefinition | undefined {
  const norm = id === 'kilim' ? 'kelim' : id === 'tufting' ? 'tufting_gun' : id;
  return SUB_CRAFTS_REGISTRY.find((c) => c.id === norm);
}

function detectCraftId(
  combinedText: string,
  vData?: AIVisionAnalysis | null,
  selectedCrafts?: string[]
): string {
  // 1. Direct match from visionAnalysis.craftType if valid in registry
  const vCraft = String((vData as any)?.craftType || '').trim().toLowerCase();
  if (vCraft && findSubCraft(vCraft)) {
    return findSubCraft(vCraft)!.id;
  }

  // 2. Keyword match prioritizing visionAnalysis fields first, then full chat text
  const priorityText = [
    (vData as any)?.craftType || '',
    vData?.detectedCategory || '',
    vData?.modelDetectedName || '',
    combinedText,
  ].join('\n');

  for (const rule of CRAFT_KEYWORD_RULES) {
    if (rule.patterns.some((rx) => rx.test(priorityText))) {
      const def = findSubCraft(rule.craftId);
      if (def) return def.id;
    }
  }

  // 3. Registry nameAr / sampleCategories scan
  const lower = priorityText.toLowerCase();
  for (const craft of SUB_CRAFTS_REGISTRY) {
    if (craft.nameAr && lower.includes(craft.nameAr.replace(/★|\(.*?\)/g, '').trim().toLowerCase())) {
      return craft.id;
    }
  }

  // 4. Fallback to artist's first selected craft or macrame
  if (selectedCrafts && selectedCrafts.length > 0 && findSubCraft(selectedCrafts[0])) {
    return findSubCraft(selectedCrafts[0])!.id;
  }
  return 'macrame';
}

function detectProductCategory(
  craftDef: SubCraftDefinition | undefined,
  combinedText: string,
  vData?: AIVisionAnalysis | null,
  fallbackCategory?: CraftCategory | string
): string {
  const samples = craftDef?.sampleCategories || [];
  const searchPool = [
    vData?.detectedCategory || '',
    vData?.modelDetectedName || '',
    combinedText,
  ].join(' ');

  // Direct match against craft's sampleCategories
  for (const cat of samples) {
    if (cat && searchPool.includes(cat)) {
      return cat;
    }
  }

  // Smart synonyms mapping for common items
  const synonymChecks: Array<{ rx: RegExp; matchInSamples: RegExp }> = [
    { rx: /شنط[ةه]|حقيب[ةه]|كلاتش|توت باج|bag|tote/i, matchInSamples: /شنط|حقيب|كلاتش/i },
    { rx: /باسكت|سل[ةه]|منظم|basket/i, matchInSamples: /باسكت|سلال|سلة|منظم/i },
    { rx: /جداري[ةه]|معلق[ةه]|تابلوه|wall\s*hang/i, matchInSamples: /جداري|تابلوه|معلق/i },
    { rx: /ستار[ةه]|ستائر|curtain/i, matchInSamples: /ستائر|ستار/i },
    { rx: /سجاد[ةه]?|مشاي[ةه]|rug|carpet/i, matchInSamples: /سجاد|كليم/i },
    { rx: /رانر|مفرش\s*سفر|runner/i, matchInSamples: /رانر|مفرش/i },
    { rx: /كوشن|مخد[ةه]|وساد[ةه]|cushion|pillow/i, matchInSamples: /كوشن|مخد/i },
    { rx: /بوف|pouf/i, matchInSamples: /بوف/i },
    { rx: /أرجوح[ةه]|ارجوح[ةه]|مرجيح[ةه]|swing/i, matchInSamples: /أرجوح|كرسي/i },
    { rx: /نجف|إضاء[ةه]|اضاء[ةه]|أباجور|اباجور|lamp/i, matchInSamples: /نجف|إضاء|أباجور/i },
    { rx: /كوستر|قاعد[ةه]\s*كوب|coaster/i, matchInSamples: /كوستر/i },
    { rx: /صيني[ةه]|صواني|tray/i, matchInSamples: /صيني|صواني/i },
    { rx: /مرآ[ةه]|مراي[ةه]|mirror/i, matchInSamples: /مرآ|مراي/i },
    { rx: /شال|سكارف|كوفي[ةه]|shawl/i, matchInSamples: /شال|كوفي/i },
    { rx: /بطاني[ةه]|blanket/i, matchInSamples: /بطاني/i },
    { rx: /أميجورومي|اميجورومي|عروس[ةه]|دمي[ةه]/i, matchInSamples: /أميجورومي|مجسم/i },
  ];

  for (const syn of synonymChecks) {
    if (syn.rx.test(searchPool)) {
      const hit = samples.find((s) => syn.matchInSamples.test(s));
      if (hit) return hit;
    }
  }

  if (vData?.detectedCategory && samples.includes(vData.detectedCategory)) {
    return vData.detectedCategory;
  }
  if (samples.length > 0) return samples[0];
  return String(fallbackCategory || 'جدارية');
}

function extractNumber(text: string, regexes: RegExp[]): number | undefined {
  for (const rx of regexes) {
    const m = text.match(rx);
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (Number.isFinite(val) && val > 0) return val;
    }
  }
  return undefined;
}

function extractSmartProductName(
  messages: ChatMessage[],
  vData: AIVisionAnalysis | null | undefined,
  craftDef: SubCraftDefinition | undefined,
  category: string,
  widthCm?: number,
  heightCm?: number,
  diameterCm?: number
): string {
  if (vData?.modelDetectedName && vData.modelDetectedName.trim().length >= 3) {
    return vData.modelDetectedName.trim().slice(0, 90);
  }

  // Check if artist explicitly specified a product name in chat
  const recentText = messages
    .filter((m) => m.id !== 'msg_welcome')
    .slice(-8)
    .map((m) => m.text)
    .join('\n');

  const explicitNameMatch = recentText.match(
    /(?:اسم\s*(?:المنتج|القطعة|الموديل)|الموديل|المنتج)\s*[:：\-]\s*([^\n،.]{3,65})/
  );
  if (explicitNameMatch?.[1]) {
    return explicitNameMatch[1].replace(/[*#`"]/g, '').trim();
  }

  // Auto-generate a clean, expressive Arabic name by Saqr
  const craftShort = craftDef
    ? craftDef.nameAr.replace(/★|\(.*?\)/g, '').trim()
    : 'هاند ميد';
  const dimSuffix =
    diameterCm && diameterCm > 0
      ? ` (قطر ${diameterCm} سم)`
      : widthCm && heightCm
        ? ` (${widthCm}×${heightCm} سم)`
        : '';

  const baseName = category.includes(craftShort) ? category : `${category} — ${craftShort}`;
  return `${baseName} تصميم يدوي${dimSuffix}`.slice(0, 95);
}

function extractChatHighlights(messages: ChatMessage[]): string[] {
  const relevant = messages.filter(
    (m) => m.id !== 'msg_welcome' && m.text && !m.text.startsWith('⚠️')
  );
  if (relevant.length === 0) return [];

  const points: string[] = [];
  const seen = new Set<string>();

  // Grab artist's key requests (last 3 user messages)
  const userMsgs = relevant.filter((m) => m.sender === 'user').slice(-3);
  for (const um of userMsgs) {
    const clean = um.text.replace(/\s+/g, ' ').trim();
    if (clean.length >= 6 && !clean.startsWith('تحليل هذه الصورة')) {
      const snippet = `طلب الفنان: ${clean.slice(0, 140)}${clean.length > 140 ? '...' : ''}`;
      if (!seen.has(snippet)) {
        seen.add(snippet);
        points.push(snippet);
      }
    }
  }

  // Grab key actionable lines from Falcon's last 3 replies
  const falconMsgs = relevant.filter((m) => m.sender === 'falcon').slice(-3);
  for (const fm of falconMsgs) {
    const lines = fm.text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[•\-*►▪︎\d.)]+\s*/, '').replace(/[*#`]/g, '').trim())
      .filter((l) => l.length >= 14 && l.length <= 220);

    // Prioritize lines with dimensions, materials, costs, stitches, prices, tips
    const scored = lines
      .map((l) => {
        let score = 0;
        if (/\d/.test(l)) score += 3;
        if (/خام|حبل|خيط|سم|متر|كجم|جرام|ساع|مصنعي|تكلف|سعر|ربح|جمل|قطاع|هالك|غرز|قالب|ريزن|شمع|جلد|خشب|تغليف|مقاس|نصيح|توصي/i.test(l)) {
          score += 4;
        }
        return { l, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    for (const item of scored) {
      const cleanLine = item.l.slice(0, 180);
      if (!seen.has(cleanLine)) {
        seen.add(cleanLine);
        points.push(cleanLine);
      }
    }
  }

  return points.slice(0, 10);
}

export function buildSmartCalculatorExport(params: {
  messages: ChatMessage[];
  visionAnalysis?: AIVisionAnalysis | null;
  associatedImage?: string;
  imagePreview?: string | null;
  currentCategory: CraftCategory;
  profile: UserProfile;
}): StructuredCalculatorExport | null {
  const { messages, visionAnalysis, associatedImage, imagePreview, currentCategory, profile } = params;

  const nonWelcomeMessages = messages.filter((m) => m.id !== 'msg_welcome');
  const vData =
    visionAnalysis ||
    [...messages].reverse().find((m) => m.metadata?.visionAnalysis)?.metadata?.visionAnalysis ||
    null;

  if (!vData && nonWelcomeMessages.length === 0) {
    return null;
  }

  // 1. Find the latest image anywhere in the conversation (user message OR assistant message OR preview)
  const latestChatImage =
    associatedImage ||
    vData?.imageUrl ||
    [...messages].reverse().find((m) => m.metadata?.previewImage)?.metadata?.previewImage ||
    imagePreview ||
    undefined;

  // 2. Build normalized conversation text (most recent 10 messages)
  const rawChatText = nonWelcomeMessages
    .slice(-10)
    .map((m) => m.text || '')
    .join('\n');
  const normText = normalizeNums(rawChatText);

  // 3. Detect Craft + Section + Product Category
  const craftId = detectCraftId(normText, vData, profile.selectedCrafts);
  const craftDef = findSubCraft(craftId);
  const mainSectionId = craftDef?.mainSectionId || getMainSectionForCraft(craftId);
  const category = detectProductCategory(craftDef, normText, vData, currentCategory);

  // 4. Extract dimensions (merge Vision Analysis + Chat tweaks!)
  let widthCm =
    extractNumber(normText, [
      /(?:عرض|العرض)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:سم|cm)?/i,
      /(\d+(?:\.\d+)?)\s*[×xX*]\s*\d+(?:\.\d+)?\s*(?:سم|cm)/i,
    ]) ||
    vData?.suggestedDimensions?.width ||
    vData?.widthCm;

  let heightCm =
    extractNumber(normText, [
      /(?:طول|الطول|ارتفاع\s*كلي)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:سم|cm)?/i,
      /\d+(?:\.\d+)?\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:سم|cm)/i,
    ]) ||
    vData?.suggestedDimensions?.totalLength ||
    vData?.heightCm;

  const sideHeightCm =
    extractNumber(normText, [
      /(?:ارتفاع\s*الجانب|العمق|عمق|ارتفاع)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:سم|cm)?/i,
    ]) ||
    vData?.suggestedDimensions?.sideHeight ||
    vData?.sideHeightCm;

  const diameterCm =
    extractNumber(normText, [
      /(?:قطر|القطر)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:سم|cm)?/i,
    ]) ||
    vData?.suggestedDimensions?.diameter ||
    vData?.diameterCm;

  const fringeLengthCm =
    extractNumber(normText, [
      /(?:شراشيب|الهدب|الشراشيب)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:سم|cm)?/i,
    ]) ||
    vData?.suggestedDimensions?.fringeLength;

  const cordThicknessMm =
    extractNumber(normText, [
      /(?:سمك|سماكة|مقاس الحبل|مقاس الخيط)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:مم|ملم|mm)?/i,
      /(\d+(?:\.\d+)?)\s*(?:مم|ملم|mm)/i,
    ]) || 4;

  // Weight in kg (handles both كجم and جرام)
  const weightKgFromKg = extractNumber(normText, [
    /(?:وزن|الوزن|يستهلك|استهلاك)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:كجم|كيلو|kg)/i,
    /(\d+(?:\.\d+)?)\s*(?:كجم|كيلو|kg)/i,
  ]);
  const weightGramsFromChat = extractNumber(normText, [
    /(?:وزن|الوزن|يستهلك|استهلاك)\s*[:：=]?\s*(\d+(?:\.\d+)?)\s*(?:جرام|جم|g\b)/i,
    /(\d{2,5})\s*(?:جرام|جم)/i,
  ]);
  const weightKg =
    weightKgFromKg ||
    (weightGramsFromChat ? Math.round((weightGramsFromChat / 1000) * 100) / 100 : undefined) ||
    (vData?.totalWeightGrams ? Math.round((vData.totalWeightGrams / 1000) * 100) / 100 : 0.8);

  // Sensible defaults if still missing
  if (!widthCm) widthCm = diameterCm || 40;
  if (!heightCm) heightCm = sideHeightCm ? Math.max(sideHeightCm, 35) : 50;

  // 5. Extract hours, labor wage, material price per kg, market prices
  const hours =
    extractNumber(normText, [
      /(\d+(?:\.\d+)?)\s*(?:ساعات|ساعة|ساعه|hours?)/i,
      /(?:وقت|مدة\s*(?:التنفيذ|العمل))\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
    ]) ||
    vData?.estimatedHours ||
    3;

  const hourlyRate = Number((profile as any)?.hourlyRate) || 50;
  const laborWage =
    extractNumber(normText, [
      /(?:مصنعية|أجر اليد|اجر اليد|شغل اليد)\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
    ]) ||
    vData?.estimatedLaborWage ||
    Math.round(hours * hourlyRate);

  const pricePerKg =
    extractNumber(normText, [
      /(?:سعر\s*(?:الكيلو|الحبل|الخيط))\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
    ]) || 180;

  const minMarketPrice =
    extractNumber(normText, [/(?:سعر\s*الجملة|الجملة)\s*[:：=]?\s*(\d+(?:\.\d+)?)/i]) ||
    vData?.competitionPricing?.minMarketPrice ||
    0;

  const recommendedFairPrice =
    extractNumber(normText, [
      /(?:سعر\s*(?:البيع|القطاعي|العادل|المقترح))\s*[:：=]?\s*(\d+(?:\.\d+)?)/i,
    ]) ||
    vData?.competitionPricing?.recommendedFairPrice ||
    vData?.competitionPricing?.avgMarketPrice ||
    0;

  const maxMarketPrice = vData?.competitionPricing?.maxMarketPrice || 0;

  // 6. Smart product name (auto-named by Saqr if artist didn't specify one)
  const productName = extractSmartProductName(
    messages,
    vData,
    craftDef,
    category,
    widthCm,
    heightCm,
    diameterCm
  );

  // 7. Build rich Notes with engineering summary + key chat conversation points
  const curr = profile.currencySymbol || 'ج.م';
  const highlights = extractChatHighlights(messages);

  const summaryLines = [
    `🦅 ملخص تصدير صقر الشمساوية:`,
    `• الورشة: ${craftDef?.nameAr || craftId} | نوع المنتج: ${category}`,
    `• اسم المنتج المقترح: ${productName}`,
    `• الأبعاد: عرض ${widthCm} سم × طول ${heightCm} سم${sideHeightCm ? ` × ارتفاع/عمق ${sideHeightCm} سم` : ''}${diameterCm ? ` | قطر ${diameterCm} سم` : ''}`,
    `• الوزن التقديري: ${weightKg} كجم | سمك الخامة: ${cordThicknessMm} مم`,
    `• ساعات العمل: ${hours} ساعة | مصنعية اليد: ${laborWage} ${curr}`,
    ...(minMarketPrice || recommendedFairPrice
      ? [`• تسعير السوق المقترح: جملة ${minMarketPrice || '—'} ${curr} | قطاعي ${recommendedFairPrice || '—'} ${curr}`]
      : []),
  ];

  if (highlights.length > 0) {
    summaryLines.push('', '📌 أهم نقاط وتوصيات المحادثة مع صقر:');
    highlights.forEach((pt, idx) => {
      summaryLines.push(`${idx + 1}. ${pt}`);
    });
  }

  const estimatedCost = Math.round(weightKg * pricePerKg + 65 + laborWage);

  return {
    productName,
    category,
    craftId,
    mainSectionId,
    laborWage,
    hours,
    minMarketPrice,
    recommendedFairPrice,
    maxMarketPrice,
    widthCm,
    heightCm,
    sideHeightCm: sideHeightCm || 0,
    diameterCm: diameterCm || 0,
    fringeLengthCm: fringeLengthCm || 0,
    weightKg,
    cordThicknessMm,
    pricePerKg,
    imageUrl: latestChatImage,
    notes: summaryLines.join('\n'),
    costPrice: estimatedCost,
    wholesalePrice: minMarketPrice || Math.round(estimatedCost * 1.3),
    retailPrice: recommendedFairPrice || Math.round(estimatedCost * 1.6),
    visionAnalysis: vData || undefined,
  };
}
