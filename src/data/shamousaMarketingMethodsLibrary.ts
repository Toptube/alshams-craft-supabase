/**
 * مكتبة أساليب التسويق — ملف بيانات مستقل وقابل للتوسيع بدون تعديل كود
 * جاهز لاستقبال دفعات أساليب التسويق القادمة في الرسائل التالية بدون تغيير أي محرك.
 */

export interface MarketingMethodEntry {
  id: string;
  titleAr: string;
  category: 'offer' | 'content' | 'retention' | 'b2b' | 'seasonal';
  keywords: string[];
  suitableFor: 'artisan' | 'supplier' | 'both';
  whenToUseAr: string;
  howToApplyStepsAr: string[];
  exampleHookAr: string;
  expectedImpactNoteAr: string;
  requiresCosting?: boolean;
}

export const SHAMOUSA_MARKETING_METHODS_LIBRARY: MarketingMethodEntry[] = [
  {
    id: 'method_hero_slow_bundle',
    titleAr: 'تجميع المنتج البطل مع الراكد',
    category: 'offer',
    keywords: ['تجميع', 'باقة', 'راكد', 'تحريك مبيعات', 'عرض باقة'],
    suitableFor: 'artisan',
    whenToUseAr: 'لما يكون عندك منتج عليه طلب مستمر ومنتج تاني مبيعاته هادية.',
    howToApplyStepsAr: [
      'اختار المنتج الأعلى مبيعاً فعلياً في حسابك مع منتج مكمّل له مبيعاته بطيئة.',
      'احسب سعر الباقة بحيث يوفّر للعميل ويحفظ حد الربح الأدنى لورشتك.',
      'اعرض الباقة بصورة واحدة تبيّن القطعتين مع بعض كهدية جاهزة.',
    ],
    exampleHookAr: 'جمعنالك أكتر قطعتين لايقين على بعض في باقة واحدة أوفر من كل قطعة لوحدها.',
    expectedImpactNoteAr: 'تقدير بدون وعد: يرفع متوسط قيمة الطلب ويحرّك الأصناف البطيئة بدون خصم عشوائي.',
  },
  {
    id: 'method_behind_the_scenes_trust',
    titleAr: 'التسويق بقصة التصنيع ورا الكواليس',
    category: 'content',
    keywords: ['كواليس', 'ثقة', 'قصة', 'تصوير شغل', 'فيديو قصير'],
    suitableFor: 'both',
    whenToUseAr: 'لما العملاء يستغلوا السعر أو يسألوا «ليه السعر ده؟».',
    howToApplyStepsAr: [
      'صوّر 15 ثانية من لحظة اختيار الخامة أو مرحلة دقيقة في التشطيب اليدوي.',
      'اكتب سطرين بس عن الوقت والاهتمام بالتفاصيل من غير مبالغة.',
      'اختم بسؤال بسيط عن اللون المفضل عشان ترفع التفاعل الطبيعي.',
    ],
    exampleHookAr: 'الفرق بين القطعة الجاهزة والشغل اليدوي بيبان في التفاصيل اللي بتتعمل خطوة خطوة.',
    expectedImpactNoteAr: 'تقدير بدون وعد: يقوّي ثقة المشتري ويقلّل الجدل حول السعر.',
  },
];
