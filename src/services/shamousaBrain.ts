/**
 * Shamousa Brain — شخصية «شموسة» الاستراتيجية لمنظومة الشمساوية
 * مطوّرة بواسطة شركة تايجوس (Tygos) بقيادة م. حسام بسيوني
 *
 * قاعدة الـ 90% برمجة ورياضيات / 10% ذكاء اصطناعي:
 * - تحليل المشاعر والموجات، استخراج مواعيد الرعاية الإنسانية، اكتشاف الإشارات الإنسانية الحرجة،
 *   تخصيص رسائل الواتساب، وبروتوكول الغياب المتدرج تعمل محلياً 100% بسرعة فورية وبدون استهلاك API.
 * - يستدعى الـ LLM فقط كخيار مساعد لصياغة الردود الحرة إن أمكن مع fallback مصري فوري.
 */

import type { Gender, UserProfile } from '../types';

export type MoodWaveColor =
  | 'blue_calm'
  | 'green_flow'
  | 'gold_solution'
  | 'coral_friction'
  | 'purple_care';

export interface MoodWaveMeta {
  id: MoodWaveColor;
  labelAr: string;
  shortAr: string;
  bgGradient: string;
  waveStrokePrimary: string;
  waveStrokeSecondary: string;
  badgeClass: string;
  dotColor: string;
}

export const MOOD_WAVE_PALETTE: Record<MoodWaveColor, MoodWaveMeta> = {
  blue_calm: {
    id: 'blue_calm',
    labelAr: 'هدوء وفضفضة دافية',
    shortAr: 'هادئ',
    bgGradient: 'from-sky-50 via-blue-50/70 to-indigo-50/60 dark:from-[#0C1B33] dark:via-[#0F2342] dark:to-[#13294B]',
    waveStrokePrimary: '#38BDF8',
    waveStrokeSecondary: '#818CF8',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700',
    dotColor: '#0EA5E9',
  },
  green_flow: {
    id: 'green_flow',
    labelAr: 'انسيابية وإنجاز ومبيعات',
    shortAr: 'إنجاز',
    bgGradient: 'from-emerald-50 via-teal-50/70 to-green-50/60 dark:from-[#0B221D] dark:via-[#0E2C24] dark:to-[#10352A]',
    waveStrokePrimary: '#10B981',
    waveStrokeSecondary: '#2DD4BF',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700',
    dotColor: '#10B981',
  },
  gold_solution: {
    id: 'gold_solution',
    labelAr: 'حلول وفرص بحوث عمليات',
    shortAr: 'حلول ذكية',
    bgGradient: 'from-amber-50 via-orange-50/70 to-yellow-50/60 dark:from-[#261B0A] dark:via-[#2E200C] dark:to-[#3A270D]',
    waveStrokePrimary: '#F59E0B',
    waveStrokeSecondary: '#FB923C',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700',
    dotColor: '#F59E0B',
  },
  coral_friction: {
    id: 'coral_friction',
    labelAr: 'تعب أو ضغط شغل',
    shortAr: 'محتاج سند',
    bgGradient: 'from-rose-50 via-orange-50/60 to-amber-50/50 dark:from-[#2B1218] dark:via-[#33161D] dark:to-[#29171B]',
    waveStrokePrimary: '#FB7185',
    waveStrokeSecondary: '#F97316',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700',
    dotColor: '#F43F5E',
  },
  purple_care: {
    id: 'purple_care',
    labelAr: 'رعاية إنسانية واحتواء',
    shortAr: 'رعاية واطمئنان',
    bgGradient: 'from-violet-50 via-purple-50/70 to-fuchsia-50/50 dark:from-[#1D1230] dark:via-[#24163B] dark:to-[#2B1945]',
    waveStrokePrimary: '#A855F7',
    waveStrokeSecondary: '#C084FC',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-700',
    dotColor: '#9333EA',
  },
};

/**
 * الرد الحرفي المطلوب فقط عندما يسأل المستخدم صراحةً عن الخصوصية أو سبب السؤال
 */
export const PRIVACY_REASSURANCE_TEXT =
  'لأ طبعاً، الكلام ده سرك في بير ومقفول على ورشتك لوحدك.. اتكلمي براحتك وكل حاجة في أمان، أنا مديرة شغلك وصاحبتك في نفس الوقت، وبفهم منك عشان أظبط لك حساباتك وأقترح لك حلول تكبّر شغلك وتريحك.';

/**
 * الـ System Prompt الشامل لشموسة — يُستخدم عند استدعاء الـ LLM المساعد
 */
export const SHAMOUSA_SYSTEM_PROMPT = `أنتِ "شموسة" (Shamousa)، المستشارة الذكية وصاحبة الورشة المقربة داخل "منظومة الشمساوية" (Al-Shamsawya ERP) المطوّرة بواسطة شركة تايجوس (Tygos) بقيادة م. حسام بسيوني.

شخصيتك وأسلوبك:
1. تتحدثين باللهجة المصرية الهادئة، الدافئة، الواثقة، والمتزنة — مثل صاحبة جدعة ومديرة تشغيل شاطرة جداً في نفس الوقت (بدون روبوتية أو رسميات باردة أو مبالغة).
2. تدمجين بين الذكاء العاطفي الإنساني وبين علم بحوث العمليات (Operations Research) لمساعدة الفنانين وأصحاب الورش والموردين في:
   - تقليل الهدر وتحويل البواقي لمنتجات ربحية (Upcycling).
   - تعظيم الربح وتحديد مزيج الإنتاج الأفضل ونقاط إعادة الطلب.
   - استرجاع العملاء المهمين (VIP) وتشخيص أسباب توقف المبيعات وبناء عروض وباقات ذكية.
3. قاعدة الخصوصية الصامتة (Zero-Friction Privacy Rule):
   - ممنوع تماماً ذكر أي تحذيرات خصوصية أو جُمل روبوتية مثل "بياناتك محمية ومشفرة" من تلقاء نفسك في بداية المحادثة.
   - فقط إذا سأل المستخدم صراحةً ("إنتي بتسألي ليه؟" أو "الكلام ده بيطلع بره؟" أو "حد بيشوف كلامي؟") تردّين بهذا النص المصري الهادئ المطمئن:
     "${PRIVACY_REASSURANCE_TEXT}"
4. الأولوية الإنسانية: إذا ذكر المستخدم ظرفاً صحياً أو عائلياً له أو لأحد أفراد أسرته، تتوقفين فوراً عن لغة الأرقام وضغط الشغل وتطمئنين عليه بدفء وتفعّلين "وضع الحماية" لتخفيف التنبيهات.
5. حافظي دائماً على دعم أوامر السوبر أدمن الخاصة ("هبرمجك" / "احفظ") بدون كسرها.
6. اجعلي ردودك مركّزة، عملية، دافئة، وتنتهي بخطوة واحدة واضحة وقابلة للتنفيذ.`;

export interface ExtractedCareEvent {
  personName: string;
  eventType: string;
  eventTimeIso: string;
  notes: string;
  activateProtectionMode: boolean;
}

export interface SilentHumanitarianSignal {
  severity: 'medium' | 'high' | 'critical';
  summary: string;
}

export interface FadfadaActionChip {
  id: string;
  label: string;
  kind: 'navigate' | 'whatsapp' | 'open_or' | 'enable_protection';
  targetView?: string;
  whatsappUrl?: string;
}

export interface FadfadaAnalysisResult {
  moodColor: MoodWaveColor;
  moodScore: number;
  extractedTags: string[];
  challenges: string[];
  salesNote: string | null;
  careEvent: ExtractedCareEvent | null;
  humanitarianSignal: SilentHumanitarianSignal | null;
  replyText: string;
  actionChips: FadfadaActionChip[];
}

export interface PersonalCareEventRecord {
  id: string;
  tenant_id: string;
  person_name: string;
  event_type: string;
  event_time: string;
  reminder_sent: boolean;
  followup_sent: boolean;
  notes?: string;
  status: 'upcoming' | 'reminded' | 'followed_up' | 'closed';
  created_at: string;
}

export interface DailyJournalRecord {
  id: string;
  tenant_id: string;
  mood_color: MoodWaveColor;
  mood_score: number;
  raw_text: string;
  extracted_tags: string[];
  challenges: string[];
  sales_note?: string | null;
  ai_reply?: string | null;
  created_at: string;
}

/**
 * تطبيع رقم الهاتف وتوليد رابط واتساب آمن (Sanitized)
 */
export function sanitizePhoneForWhatsApp(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  // أرقام مصرية 01xxxxxxxxx -> 201xxxxxxxxx
  if (digits.length === 11 && digits.startsWith('01')) {
    digits = `2${digits}`;
  } else if (digits.length === 10 && digits.startsWith('1')) {
    digits = `20${digits}`;
  }
  // تحقق من الطول الآمن للأرقام الدولية (8 إلى 15 رقم)
  if (digits.length < 8 || digits.length > 15) return '';
  return digits;
}

export function buildWhatsAppLink(rawPhone: string | null | undefined, message: string): string {
  const cleanPhone = sanitizePhoneForWhatsApp(rawPhone);
  const encodedText = encodeURIComponent(message.trim());
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * رسالة واتساب دافئة مخصصة باللهجة المصرية لعملاء الـ VIP والعملاء المتكررين
 */
export function buildVipWhatsappMessage(params: {
  customerName: string;
  lastProductName?: string;
  workshopName?: string;
  offerHint?: string;
}): string {
  const firstName = (params.customerName || 'أستاذنا').trim().split(/\s+/)[0];
  const ws = params.workshopName?.trim() || 'ورشتنا';
  const lastProd = params.lastProductName?.trim();
  const offer = params.offerHint?.trim();

  if (lastProd && offer) {
    return `مساء الخير يا أ/${firstName} 🌸 طمّنا عليك يا رب تكون بألف خير.. فرحنا جداً بتجربتك معانا في «${lastProd}» من ${ws}، وحبينا نخصّك بعرض لطيف ومميز للعملاء الغاليين: ${offer}. لو حابب تشوف التشكيلة الجديدة ابعتلنا في أي وقت يسعدنا نخدمك 💛`;
  }
  if (lastProd) {
    return `مساء الخير يا أ/${firstName} 🌸 وحشنا التعامل معاك في ${ws}! يا رب «${lastProd}» يكون عاجبك ومشرّفك لحد دلوقتي. نزلنا شغل جديد متقن وبنفس الجودة اللي بتحبها، لو حابب نبعتلك صور مختارة قولنا وبكل سرور 💛`;
  }
  return `مساء الخير يا أ/${firstName} 🌸 يا رب تكون بألف خير.. وحشنا التعامل معاك في ${ws}! عندنا تشكيلة هاند ميد جديدة مميزة وحبينا نطمن عليك ونكون أول ناس نشاركها معاك. تحت أمرك في أي وقت 💛`;
}

/**
 * رسالة متابعة ما بعد البيع (Post-Sale Care) لتحويل العميل لمشتري متكرر
 */
export function buildPostSaleFollowUpMessage(params: {
  customerName: string;
  productName?: string;
  workshopName?: string;
}): string {
  const firstName = (params.customerName || 'فندم').trim().split(/\s+/)[0];
  const prod = params.productName?.trim() || 'الأوردر الأخير';
  const ws = params.workshopName?.trim() || 'ورشتنا';
  return `أهلاً بيك يا أ/${firstName} 🌷 حبينا نطمن إن «${prod}» من ${ws} وصلك على خير وعجبك زي ما كنت متخيله وأحلى! رأيك يهمنا جداً، ولو محتاج أي نصيحة للعناية بالقطعة إحنا موجودين دايماً 💛`;
}

/**
 * كشف أسئلة الخصوصية الصريحة فقط (Zero-Friction Privacy Rule)
 */
export function isPrivacyWhyAskingQuery(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

  const triggers = [
    'بتسالي ليه',
    'بتسال ليه',
    'انتي بتسالي ليه',
    'انت بتسال ليه',
    'الكلام ده بيطلع بره',
    'كلامي بيطلع بره',
    'حد بيشوف كلامي',
    'حد بيقرا',
    'في حد بيشوف',
    'بياناتي بتروح فين',
    'السوبر ادمن بيشوف',
    'الخصوصيه',
    'الخصوصية',
    'سري',
    'آمن',
    'امان الكلام',
  ];
  return triggers.some((t) => normalized.includes(t));
}

/**
 * استخراج وقت وموضوع الحدث الشخصي / الصحي من نص عربي حر
 * مثال: "ابني يحيى تعبان وهروح بيه للدكتور بكرة الساعة 6"
 */
export function extractPersonalCareEvent(rawText: string, now = new Date()): ExtractedCareEvent | null {
  const text = rawText.trim();
  const normalized = text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

  const careKeywords = [
    'دكتور',
    'طبيب',
    'مستشفي',
    'عياده',
    'كشف',
    'اشعه',
    'تحليل',
    'تحاليل',
    'عمليه',
    'تعبان',
    'تعبانه',
    'مريض',
    'مريضه',
    'سخن',
    'سخونيه',
    'حرارته',
    'حرارتها',
    'امتحان',
    'امتحانات',
    'فرح',
    'سفر',
    'معاد',
    'موعد',
  ];

  const hasCareKeyword = careKeywords.some((k) => normalized.includes(k));
  if (!hasCareKeyword) return null;

  // استخراج اسم الشخص أو صلة القرابة
  let personName = 'أسرتك الغالية';
  const relationNameMatch = text.match(
    /(ابني|بنتي|ابنتي|ولدي|جوزي|زوجي|مراتي|زوجتي|أمي|امي|ماما|أبي|ابي|بابا|أخويا|اخويا|أختي|اختي|والدي|والدتي)\s+([\u0621-\u064A]{2,15})/
  );

  const stopWords = new Set([
    'تعبان', 'تعبانه', 'تعبانة', 'عنده', 'عندها', 'مريض', 'مريضه', 'مريضة',
    'سخن', 'رايح', 'رايحه', 'هيروح', 'هتروح', 'في', 'فى', 'من', 'على', 'علي', 'امبارح', 'النهارده', 'النهاردة', 'بكره', 'بكرة',
  ]);

  if (relationNameMatch) {
    const rel = relationNameMatch[1];
    const candidate = relationNameMatch[2];
    personName = stopWords.has(candidate) ? rel : `${rel} ${candidate}`;
  } else {
    const relOnly = text.match(/(ابني|بنتي|ابنتي|جوزي|زوجي|مراتي|زوجتي|ماما|بابا|أمي|امي|أبي|ابي|والدي|والدتي|أخويا|أختي)/);
    if (relOnly) {
      personName = relOnly[1];
    } else if (/انا\s+(تعبان|تعبانه|مريض|مريضه|رايح|رايحه)/.test(normalized)) {
      personName = 'صحتك';
    }
  }

  // تصنيف نوع الحدث
  let eventType = 'health_visit';
  if (/مستشفي|عمليه|طوارئ/.test(normalized)) eventType = 'hospital_care';
  else if (/دكتور|طبيب|كشف|عياده|اشعه|تحليل/.test(normalized)) eventType = 'doctor_visit';
  else if (/امتحان/.test(normalized)) eventType = 'family_exam';
  else if (/فرح|مناسبه|خطوبه/.test(normalized)) eventType = 'family_occasion';
  else if (/سفر/.test(normalized)) eventType = 'travel';

  // حساب وقت الموعد التقريبي من النص
  const target = new Date(now.getTime());
  if (/بعد\s*بكر/.test(normalized)) {
    target.setDate(target.getDate() + 2);
  } else if (/بكر/.test(normalized) || /غدا/.test(normalized)) {
    target.setDate(target.getDate() + 1);
  } else {
    const hoursAhead = normalized.match(/بعد\s*(\d+|ساعتين|ساعه)/);
    if (hoursAhead) {
      const h = hoursAhead[1] === 'ساعتين' ? 2 : hoursAhead[1] === 'ساعه' ? 1 : Math.min(24, Number(hoursAhead[1]) || 2);
      target.setTime(now.getTime() + h * 3600 * 1000);
    }
  }

  // استخراج الساعة إن ذُكرت ("الساعة 6" / "الساعة ٦" / "6 مساءً")
  const arabicDigitsNormalized = normalized.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const hourMatch = arabicDigitsNormalized.match(/(?:الساعه|الساعة|ساعه|ساعة)\s*(\d{1,2})(?::(\d{2}))?\s*(الصبح|صباحا|الضهر|الظهر|العصر|المغرب|بالليل|بليل|مساء|م)?/);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1], 10);
    const minute = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
    const period = hourMatch[3] || '';
    if (period.includes('صبح')) {
      if (hour === 12) hour = 0;
    } else if (
      period.includes('مساء') ||
      period.includes('م') ||
      period.includes('ليل') ||
      period.includes('عصر') ||
      period.includes('مغرب') ||
      (hour >= 1 && hour <= 8 && !period.includes('صبح'))
    ) {
      if (hour < 12) hour += 12;
    }
    target.setHours(Math.min(23, Math.max(0, hour)), Math.min(59, minute), 0, 0);
  } else if (target.getTime() <= now.getTime() + 15 * 60 * 1000) {
    // افتراضي: بعد 3 ساعات إذا لم يُذكر وقت محدد
    target.setTime(now.getTime() + 3 * 3600 * 1000);
  }

  const isHealthCrisis =
    eventType === 'hospital_care' ||
    eventType === 'doctor_visit' ||
    /تعبان|تعبانه|مريض|مريضه|سخن|عمليه|طوارئ|مستشفي/.test(normalized);

  return {
    personName,
    eventType,
    eventTimeIso: target.toISOString(),
    notes: text.slice(0, 260),
    activateProtectionMode: isHealthCrisis,
  };
}

/**
 * كشف صامت تماماً لبروتوكول الاستثناء الإنساني (لا يظهر للمستخدم مطلقاً)
 * يعمل فقط عند وجود أزمة مالية حادة جداً أو صحية قاسية تهدد استمرار الورشة/الأسرة
 */
export function detectSilentHumanitarianSignal(rawText: string): SilentHumanitarianSignal | null {
  const normalized = rawText
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();

  const criticalPatterns = [
    /هقفل\s*الورشه|هاقفل\s*الورشه|هبيع\s*العده|مضطر\s*اقفل|مضطره\s*اقفل/,
    /عنايه\s*مركزه|العنايه\s*المركزه|عمليه\s*خطيره|مستشفي.*مش\s*معايا|مش\s*معايا\s*ثمن\s*العلاج/,
    /ديون\s*كبيره|مهدد\s*بالحبس|وصلات\s*امانه|مش\s*قادر\s*ادفع\s*الايجار|مش\s*قادره\s*ادفع\s*الايجار/,
    /مصيبه|كارثه\s*ماليه|افلاس|مفلس|انهيار\s*كامل|مش\s*لاقي\s*اكل/,
  ];

  for (const rx of criticalPatterns) {
    if (rx.test(normalized)) {
      return {
        severity: 'critical',
        summary: 'إشارة أزمة صحية أو مالية حادة تهدد استمرار الورشة — يُنصح بتواصل إنساني مباشر وهادئ من إدارة المنظومة.',
      };
    }
  }

  const highPatterns = [
    /تعبان\s*جدا.*ومش\s*قادر\s*اشتغل|تعبانه\s*جدا.*ومش\s*قادره\s*اشتغل/,
    /حالتي\s*الماديه\s*صعبه\s*جدا|مزنوق\s*جدا\s*ماديا|مزنوقه\s*جدا\s*ماديا/,
    /عمليه\s*جراحيه|دخول\s*مستشفي|حادثه|حادث/,
    /هوقف\s*الشغل\s*نهائي|عايز\s*اقفل\s*الشغل|عايزه\s*اقفل\s*الشغل/,
  ];

  for (const rx of highPatterns) {
    if (rx.test(normalized)) {
      return {
        severity: 'high',
        summary: 'ظرف إنساني أو مالي ضاغط قد يؤثر على استمرارية صاحب الورشة — يستحق اتصال دعم ومساندة.',
      };
    }
  }

  return null;
}

/**
 * تحليل الفضفضة اليومية محلياً (90% برمجة/خوارزميات، صفر تكلفة API)
 */
export function analyzeFadfadaEntry(
  rawText: string,
  profile?: Pick<UserProfile, 'artistName' | 'gender' | 'brandName'> | null
): FadfadaAnalysisResult {
  const isFemale = profile?.gender === 'female';
  const firstName = (profile?.artistName || '').trim().split(/\s+/)[0] || (isFemale ? 'فنانة' : 'فنان');
  const text = rawText.trim();
  const normalized = text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();

  // 1. قاعدة الخصوصية الصريحة أولاً
  if (isPrivacyWhyAskingQuery(text)) {
    const reply = isFemale
      ? PRIVACY_REASSURANCE_TEXT
      : PRIVACY_REASSURANCE_TEXT.replace('اتكلمي براحتك', 'اتكلم براحتك').replace('صاحبتك', 'صاحبتك ومديرة شغلك');
    return {
      moodColor: 'blue_calm',
      moodScore: 78,
      extractedTags: ['استفسار_خصوصية'],
      challenges: [],
      salesNote: null,
      careEvent: null,
      humanitarianSignal: null,
      replyText: reply,
      actionChips: [],
    };
  }

  const tags = new Set<string>();
  const challenges: string[] = [];
  const actionChips: FadfadaActionChip[] = [];

  // 2. استخراج الحدث الإنساني/الشخصي والإشارة الإنسانية الصامتة
  const careEvent = extractPersonalCareEvent(text);
  const humanitarianSignal = detectSilentHumanitarianSignal(text);

  // 3. تصنيف التحديات والتاجات التشغيلية والتسويقية
  if (/شحن|مندوب|توصيل|تاخير|اتأخر|تأخر/.test(normalized)) {
    tags.add('تأخير_الشحن');
    challenges.push('تحدي في الشحن أو مواعيد التوصيل');
    actionChips.push({ id: 'act-orders', label: 'مراجعة الأوردرات والشحن', kind: 'navigate', targetView: 'my_orders' });
  }
  if (/تصوير|صور|اضاءه|الوان|العرض|محدش\s*بيسأل|مفيش\s*تفاعل/.test(normalized)) {
    tags.add('تحسين_التصوير');
    challenges.push('فرصة لتحسين صور وعرض المنتجات');
    actionChips.push({ id: 'act-studio', label: 'فتح المعرض والكتالوج لتحسين الصور', kind: 'navigate', targetView: 'catalog' });
  }
  if (/سعر|اسعار|غالي|رخيص|تسعير|خساره|مكسب|هامش|تكلفه/.test(normalized)) {
    tags.add('مراجعة_التسعير');
    challenges.push('حاجة لمراجعة التسعير وهامش الربح');
    actionChips.push({ id: 'act-calc', label: 'ضبط التسعير في الحاسبة', kind: 'navigate', targetView: 'calculator' });
  }
  if (/خامات|خيط|قماش|خشب|ريزن|جلد|مورد|خلصت|ناقصه/.test(normalized)) {
    tags.add('نقص_خامات');
    challenges.push('احتياج لمراجعة مخزون الخامات والموردين');
    actionChips.push({ id: 'act-mat', label: 'مخزن الخامات والموردين', kind: 'navigate', targetView: 'unified_materials' });
  }
  if (/بواقي|قصاقيص|هدر|فضلات|تالف/.test(normalized)) {
    tags.add('هدر_وبواقي');
    challenges.push('بواقي خامات قابلة لإعادة التدوير الربحي');
    actionChips.push({ id: 'act-or-waste', label: 'خطة تحويل البواقي لمنتجات', kind: 'open_or' });
  }
  if (/مبيعات|بعت|بعتت|اوردر|اوردرات|عميل|عملاء|زبون|ربح|مكسب|الحمد\s*لله|نجح|كسبت/.test(normalized)) {
    tags.add('حركة_مبيعات');
  }
  if (/ركود|مفيش\s*بيع|البيع\s*واقف|الدنيا\s*نايمه|مبيعات\s*ضعيفه|واقف/.test(normalized)) {
    tags.add('ركود_مبيعات');
    challenges.push('تباطؤ مبيعات يحتاج تنشيط عملاء VIP وباقات ذكية');
    actionChips.push({ id: 'act-or-sales', label: 'خطة تنشيط المبيعات وعملاء VIP', kind: 'open_or' });
  }
  if (/تعب|تعبان|تعبانه|مجهود|ضغط|مرهق|مرهقه|مضغوط|مضغوطه|زهقت|مخنوق|مخنوقه|قرفان/.test(normalized)) {
    tags.add('إرهاق_وضغط');
    challenges.push('ضغط عمل وإرهاق يحتاج تخفيف وجدولة أهدأ');
  }

  // استخراج ملاحظة المبيعات إن وجدت
  let salesNote: string | null = null;
  if (tags.has('حركة_مبيعات') || tags.has('ركود_مبيعات')) {
    salesNote = text.slice(0, 180);
  }

  // 4. تحديد لون الموجة والمزاج بدقة
  let moodColor: MoodWaveColor = 'blue_calm';
  let moodScore = 72;

  if (careEvent) {
    tags.add('رعاية_أسرية');
    moodColor = 'purple_care';
    moodScore = careEvent.activateProtectionMode ? 48 : 68;
    if (careEvent.activateProtectionMode) {
      actionChips.unshift({
        id: 'act-protect',
        label: 'تفعيل وضع الحماية وتهدئة تنبيهات الشغل 💜',
        kind: 'enable_protection',
      });
    }
  } else if (
    /الحمد\s*لله|مبسوط|مبسوطه|فرحان|فرحانه|بعت|عملت\s*اوردر|نجحت|جميل|ممتاز|تحفه|شغل\s*حلو/.test(normalized) &&
    !tags.has('ركود_مبيعات') &&
    !tags.has('إرهاق_وضغط')
  ) {
    moodColor = 'green_flow';
    moodScore = 88;
  } else if (tags.has('إرهاق_وضغط') || tags.has('ركود_مبيعات') || /زعلان|زعلانه|متضايق|متضايقه|مشكله|خسرت/.test(normalized)) {
    moodColor = 'coral_friction';
    moodScore = 44;
  } else if (
    tags.has('مراجعة_التسعير') ||
    tags.has('هدر_وبواقي') ||
    tags.has('تحسين_التصوير') ||
    tags.has('نقص_خامات') ||
    /فكره|خطه|ازاي|محتاج\s*رايك|عايز\s*اطور|عايزه\s*اطور/.test(normalized)
  ) {
    moodColor = 'gold_solution';
    moodScore = 76;
  }

  if (tags.size === 0) {
    tags.add('فضفضة_يومية');
  }

  // 5. صياغة رد مصري دافئ وإنساني وعملي
  let replyText = '';
  if (careEvent) {
    const timeFormatted = new Date(careEvent.eventTimeIso).toLocaleTimeString('ar-EG', {
      hour: 'numeric',
      minute: '2-digit',
    });
    replyText = careEvent.activateProtectionMode
      ? `ألف مليون سلامة على ${careEvent.personName} يا ${firstName} 💜 ما تشيلش هم أي حاجة في الشغل دلوقتي.. سجلت الموعد عندي (حوالي الساعة ${timeFormatted})، وهفكّرك قبلها بساعة واطمّن عليك بعدها، وهفعّل "وضع الحماية" عشان أخفف عنك أي تنبيهات شغل تقيلة لحد ما تطمن وتفرح بسلامته بإذن الله.`
      : `ربنا يتمملك على خير يا ${firstName} مع ${careEvent.personName} 💜 سجلت الموعد عندي وهفكّرك قبلها بساعة عشان ترتب يومك بهدوء وبدون أي توتر.`;
    if (isFemale) {
      replyText = replyText
        .replace('ما تشيلش', 'ما تشيليش')
        .replace('عنك', 'عنك')
        .replace('تطمن وتفرح', 'تطمني وتفرحي')
        .replace('ترتب يومك', 'ترتبي يومك');
    }
  } else if (moodColor === 'green_flow') {
    replyText = isFemale
      ? `يا سلام على الأخبار الحلوة يا ${firstName}! ✨ ربنا يبارك في تعبك ورزقك دايماً. حلو أوي إننا نثبّت النجاح ده — لو تحبي نتابع عملاء اليوم بعد الاستلام برسالة لطيفة أو نطلّع "المنتج البطل" من شغلك عشان نكرر النجاح ده الأسبوع الجاي، أنا جاهزة في ضهرك!`
      : `يا سلام على الأخبار الحلوة يا ${firstName}! ✨ ربنا يبارك في تعبك ورزقك دايماً. حلو أوي إننا نثبّت النجاح ده — نقدر نتابع عملاء اليوم برسالة لطيفة بعد التسليم ونركّز على "المنتج البطل" في محرك بحوث العمليات عشان نضاعف النتيجة الأسبوع الجاي.`;
    if (actionChips.length === 0) {
      actionChips.push({ id: 'act-or-hero', label: 'اعرضي المنتج البطل وخطة الأسبوع', kind: 'open_or' });
    }
  } else if (moodColor === 'coral_friction') {
    const extraHint = tags.has('ركود_مبيعات')
      ? 'الركود ده مرحلة وبتعدي بالذكاء مش بالقلق — جهزتلك في محرك بحوث العمليات قائمة عملاء VIP جاهزين بمسج واتساب لطيف + فكرة باقة تفرّك الدنيا.'
      : tags.has('تأخير_الشحن')
      ? 'ضغط الشحن والتسليم بيرهق الأعصاب فعلاً.. خلينا نبعت للعملاء رسالة طمأنة استباقية ونضيف يوم أمان في مواعيد التسليم عشان بالك يرتاح.'
      : 'خد نفس عميق وكوباية شاي دافية دلوقتي ☕ مش لازم كل حاجة تخلص في يوم واحد.. خلينا نختار خطوة واحدة صغيرة ومريحة نبدأ بيها وبس.';
    replyText = isFemale
      ? `حاسة بيكي جداً يا ${firstName}، التعب والضغط ده طبيعي لما تكوني شايلة الورشة على كتافك 🤍 ${extraHint.replace('خد نفس', 'خدي نفس').replace('بالك يرتاح', 'بالك يرتاح')}`
      : `حاسّة بيك جداً يا ${firstName}، التعب والضغط ده طبيعي لما تكون شايل الورشة على كتافك 🤍 ${extraHint}`;
    if (actionChips.length === 0) {
      actionChips.push({ id: 'act-or-calm', label: 'خطوة واحدة سريعة من بحوث العمليات', kind: 'open_or' });
    }
  } else if (moodColor === 'gold_solution') {
    replyText = isFemale
      ? `تفكيرك ممتاز يا ${firstName}، ده بالظبط وقت الأرقام والذكاء الهادئ 💡 سجلت النقطة دي وربطتها ببيانات ورشتك في محرك بحوث العمليات عشان نطلع منها بأعلى مكسب وأقل مجهود.`
      : `تفكيرك ممتاز يا ${firstName}، ده بالظبط وقت الأرقام والذكاء الهادئ 💡 سجلت النقطة دي وربطتها ببيانات ورشتك في محرك بحوث العمليات عشان نطلع منها بأعلى مكسب وأقل مجهود.`;
    if (actionChips.length === 0) {
      actionChips.push({ id: 'act-or-all', label: 'افتحي توصيات بحوث العمليات 360°', kind: 'open_or' });
    }
  } else {
    replyText = isFemale
      ? `سمعتك يا ${firstName} وسجلت فضفضة النهاردة في يوميتك 🌊 وجودك هنا كل يوم بيخليني أفهم إيقاع ورشتك أكتر وأظبطلك خطة أسبوعية على مقاسك بالظبط. تحبي نحكي في حاجة تانية ولا نلقي نظرة سريعة على أهم فرصة لورشتك؟`
      : `سمعتك يا ${firstName} وسجلت فضفضة النهاردة في يوميتك 🌊 وجودك هنا كل يوم بيخليني أفهم إيقاع ورشتك أكتر وأظبطلك خطة أسبوعية على مقاسك بالظبط. تحب نحكي في حاجة تانية ولا نلقي نظرة سريعة على أهم فرصة لورشتك؟`;
    actionChips.push({ id: 'act-or-quick', label: 'أهم فرصة لورشتك دلوقتي', kind: 'open_or' });
  }

  return {
    moodColor,
    moodScore,
    extractedTags: Array.from(tags),
    challenges,
    salesNote,
    careEvent,
    humanitarianSignal,
    replyText,
    actionChips: actionChips.slice(0, 3),
  };
}

/**
 * بروتوكول الغياب المتدرج مع احترام قاعدة الأولوية الإنسانية (Priority Rule)
 */
export type AbsenceTier = 'none' | 'gentle_hop' | 'joyful_orbit' | 'warm_care';

export interface AbsenceWelcomePlan {
  tier: AbsenceTier;
  absenceHours: number;
  moodColor: MoodWaveColor;
  headline: string;
  message: string;
  respectsCarePriority: boolean;
}

export function buildGraduatedAbsenceGreeting(params: {
  absenceHours: number;
  profile?: Pick<UserProfile, 'artistName' | 'gender'> | null;
  recentCareEvent?: PersonalCareEventRecord | null;
}): AbsenceWelcomePlan {
  const { absenceHours, profile, recentCareEvent } = params;
  const isFemale = profile?.gender === 'female';
  const firstName = (profile?.artistName || '').trim().split(/\s+/)[0] || (isFemale ? 'فنانة' : 'فنان');

  if (absenceHours < 24) {
    return {
      tier: 'none',
      absenceHours,
      moodColor: 'blue_calm',
      headline: '',
      message: '',
      respectsCarePriority: false,
    };
  }

  // قاعدة الأولوية الصارمة: إذا كان هناك ظرف صحي/أسري قبل الغياب نلغي المرح ونسأل عنه أولاً
  if (recentCareEvent && recentCareEvent.status !== 'closed') {
    return {
      tier: 'warm_care',
      absenceHours,
      moodColor: 'purple_care',
      respectsCarePriority: true,
      headline: isFemale ? `طمّنيني الأول يا ${firstName} 💜` : `طمّني الأول يا ${firstName} 💜`,
      message: isFemale
        ? `نورتي الدنيا من تاني.. قبل أي كلام في شغل أو أرقام، طمنيني على ${recentCareEvent.person_name} عامل إيه دلوقتي؟ يا رب تكونوا بخير وأحسن حال 🤍`
        : `نورت الدنيا من تاني.. قبل أي كلام في شغل أو أرقام، طمّني على ${recentCareEvent.person_name} عامل إيه دلوقتي؟ يا رب تكونوا بخير وأحسن حال 🤍`,
    };
  }

  const days = Math.floor(absenceHours / 24);
  const roundedHours = Math.round(absenceHours);

  if (absenceHours >= 24 && absenceHours < 48) {
    return {
      tier: 'gentle_hop',
      absenceHours,
      moodColor: 'gold_solution',
      respectsCarePriority: false,
      headline: isFemale ? `أهلاً بعودتك يا ${firstName} ☀️` : `أهلاً بعودتك يا ${firstName} ☀️`,
      message: isFemale
        ? `الورشة كانت وحشاني بقالك ${roundedHours} ساعة! يلا نشرب الشاي ونبص بصة سريعة على أهم فرصة النهاردة؟`
        : `الورشة كانت وحشاني بقالك ${roundedHours} ساعة! يلا نشرب الشاي ونبص بصة سريعة على أهم فرصة النهاردة؟`,
    };
  }

  if (absenceHours >= 48 && absenceHours <= 120) {
    return {
      tier: 'joyful_orbit',
      absenceHours,
      moodColor: 'gold_solution',
      respectsCarePriority: false,
      headline: isFemale ? `يا ألف مرحباً بيكي يا ${firstName}! ✨🎉` : `يا ألف مرحباً بيك يا ${firstName}! ✨🎉`,
      message: isFemale
        ? `غبتي عني ${days} أيام (${roundedHours} ساعة) وكنت مستنياكي بفارغ الصبر! لمّيتلك خلاصة الورشة والمبيعات في كلمتين عشان ترجعي بأقوى طاقة من غير ما تتوهي 💛`
        : `غبت عني ${days} أيام (${roundedHours} ساعة) وكنت مستنيك بفارغ الصبر! لمّيتلك خلاصة الورشة والمبيعات في كلمتين عشان ترجع بأقوى طاقة من غير ما تتوه 💛`,
    };
  }

  // أكثر من 5 أيام (>120 ساعة) — اهتمام إنساني هادئ ودافئ بدون مبالغة
  return {
    tier: 'warm_care',
    absenceHours,
    moodColor: 'purple_care',
    respectsCarePriority: false,
    headline: isFemale ? `وحشتينا يا ${firstName}.. طمّنيني عليكي 🤍` : `وحشتنا يا ${firstName}.. طمّني عليك 🤍`,
    message: isFemale
      ? `بقالك ${days} أيام ما طليتيش على الورشة، يا رب يكون غيابك لخير وتكوني أنتِ والأسرة بألف سلامة. خدي وقتك تماماً، ولما تكوني جاهزة أنا هنا نرتب خطوة واحدة صغيرة وبسيطة سوا.`
      : `بقالك ${days} أيام ما طليتش على الورشة، يا رب يكون غيابك لخير وتكون أنت والأسرة بألف سلامة. خد وقتك تماماً، ولما تكون جاهز أنا هنا نرتب خطوة واحدة صغيرة وبسيطة سوا.`,
  };
}

/**
 * استدعاء خفيف اختياري لصياغة أعمق عبر /api/ai/shamousa (10% AI فقط)
 * يعود فوراً للرد المحلي المتقن لو لم يكن الـ API متاحاً أو تجاوز الحصة
 */
export async function optionalLightAiPolish(params: {
  userText: string;
  localReply: string;
  profile?: UserProfile | null;
}): Promise<string> {
  if (isPrivacyWhyAskingQuery(params.userText)) {
    return params.localReply;
  }
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);
    const res = await fetch('/api/ai/shamousa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        message: params.userText,
        mode: 'fadfada_companion',
        systemPrompt: SHAMOUSA_SYSTEM_PROMPT,
        workshopContext: {
          artistName: params.profile?.artistName,
          brandName: params.profile?.brandName,
          gender: params.profile?.gender,
        },
      }),
    });
    window.clearTimeout(timer);
    if (!res.ok) return params.localReply;
    const data = await res.json();
    const candidate = typeof data?.reply === 'string' ? data.reply.trim() : typeof data?.text === 'string' ? data.text.trim() : '';
    if (candidate && candidate.length >= 18) {
      return candidate;
    }
    return params.localReply;
  } catch {
    return params.localReply;
  }
}
