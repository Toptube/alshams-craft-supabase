/**
 * مكتبة المشاكل الفنية لكل حرفة — ملف بيانات مستقل وقابل للتوسيع بدون تعديل كود
 * أي مشكلة فنية جديدة تتضاف هنا في المصفوفة هتشتغل تلقائياً في العقل الفني وشات شموسة.
 *
 * الهيكل الثابت:
 * العَرَض ← الأسباب المحتملة ← أسئلة تشخيص باختيارات ← الحل ← الوقاية ← تحذير السلامة (إن وُجد)
 */

export interface TechnicalDiagnosticChoice {
  id: string;
  labelAr: string;
  likelyCauseAr: string;
  focusedTipAr: string;
}

export interface TechnicalDiagnosticQuestion {
  questionAr: string;
  choices: TechnicalDiagnosticChoice[];
}

export interface TechnicalProblemEntry {
  id: string;
  craftId: string;
  craftNameAr: string;
  symptomAr: string;
  keywords: string[];
  possibleCausesAr: string[];
  diagnosticQuestions: TechnicalDiagnosticQuestion[];
  solutionStepsAr: string[];
  preventionAr: string[];
  safetyWarningAr?: string;
  requiresSafetyReview?: boolean;
}

export const SHAMOUSA_TECHNICAL_PROBLEMS_LIBRARY: TechnicalProblemEntry[] = [
  {
    id: 'tech_resin_air_bubbles',
    craftId: 'resin_epoxy',
    craftNameAr: 'ريزن',
    symptomAr: 'فقاعات هوا في القطعة',
    keywords: [
      'فقاعات',
      'فقاقيع',
      'بابلز',
      'هوا في الريزن',
      'هواء في الريزن',
      'ريزن فيه فقاعات',
      'ريزن بيطلع فقاعات',
      'bubbles',
    ],
    possibleCausesAr: [
      'تقليب سريع',
      'برودة الخامة أو الغرفة',
      'صب طبقة سميكة جداً',
    ],
    diagnosticQuestions: [
      {
        questionAr: 'الفقاعات ظهرت إمتى بالظبط عشان أحددلك أقرب سبب؟',
        choices: [
          {
            id: 'resin_q_fast_mix',
            labelAr: 'كثيرة من أول التقليب جوه الكوباية',
            likelyCauseAr: 'تقليب سريع أو إدخال هوا أثناء الخلط',
            focusedTipAr: 'قلّب ببطء شديد وبملعقة مسطحة ملاصقة لقاع وجدران الكوب لمدة 3 دقايق من غير خفق.',
          },
          {
            id: 'resin_q_cold',
            labelAr: 'الخامة تقيلة والجو بارد',
            likelyCauseAr: 'برودة الخامة أو الغرفة',
            focusedTipAr: 'دفّي عبوة الراتنج المقفولة في حمام مياه دافئة (مش مغلي) 10 دقايق قبل الخلط ونشّف العبوة كويس.',
          },
          {
            id: 'resin_q_thick',
            labelAr: 'الفقاعات زادت بعد الصب والقطعة سخنت',
            likelyCauseAr: 'صب طبقة سميكة جداً',
            focusedTipAr: 'اصب على طبقات رفيعة حسب سُمك الصب المسموح في نشرة خامة الريزن عندك.',
          },
        ],
      },
    ],
    solutionStepsAr: [
      'دفّي الراتنج المقفول في حمام مياه دافئة (مش مغلي) قبل الخلط',
      'قلّب ببطء وبقاع الكوب',
      'اصب طبقات رفيعة',
      'وأي استخدام لمصدر حرارة على السطح يكون حسب تعليمات الشركة المصنّعة',
    ],
    preventionAr: ['غرفة بحرارة ثابتة'],
    safetyWarningAr: 'تهوية، قفازات، كمامة مناسبة، واتبع نشرة الخامة.',
    requiresSafetyReview: true,
  },
  {
    id: 'tech_macrame_cord_fraying',
    craftId: 'macrame',
    craftNameAr: 'مكرمية',
    symptomAr: 'الحبل بيفتل ويطلع شعيرات',
    keywords: [
      'الحبل بيفتل',
      'بيفتل',
      'شعيرات',
      'خيط مكرميه بيفتل',
      'حبل مكرميه بينسل',
      'شراشيب بتفتل',
      'تفتيل الحبل',
      'خيط بيتقطع',
    ],
    possibleCausesAr: [
      'حبل جودته ضعيفة',
      'شد زايد',
      'قص بدون تشطيب',
    ],
    diagnosticQuestions: [
      {
        questionAr: 'التفتيل والشعيرات بيظهروا فين بالظبط في القطعة؟',
        choices: [
          {
            id: 'mac_q_all_cord',
            labelAr: 'بطول الحبل كله وأنا شغّال',
            likelyCauseAr: 'حبل جودته ضعيفة أو شد زايد',
            focusedTipAr: 'جرّب حبل قطن مجدول جودة أفضل وخفّف الشد أثناء العقد عشان الألياف ما تتفكش.',
          },
          {
            id: 'mac_q_ends',
            labelAr: 'في الأطراف والشراشيب بعد القص',
            likelyCauseAr: 'قص بدون تشطيب',
            focusedTipAr: 'سرّح الأطراف بمشط مناسب، قصّها بمقص حاد بالتساوي، وشطّبها بعقدة تثبيت أو مثبت مناسب.',
          },
        ],
      },
    ],
    solutionStepsAr: [
      'حبل مجدول جودة أفضل',
      'شد متوازن',
      'تسريح الأطراف وقصها بالتساوي وتشطيبها',
    ],
    preventionAr: ['اختيار الحبل المناسب للقطعة'],
  },
];
