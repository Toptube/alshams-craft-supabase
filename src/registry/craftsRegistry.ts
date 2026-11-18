import { CalculationInput, CalculationOutput } from '../types';
import { calculateTextileCraft } from '../utils/textileCraftsMath';
import {
  buildUnifiedFinancialOutput,
  executeWorkshopSpec,
  normalizeWorkshopId,
  sumDynamicExtraMaterials,
} from '../utils/craftEquationsEngine';

export type MainSectionId =
  | 'ropes_textiles'
  | 'beads_embroidery'
  | 'clays_composites'
  | 'woods'
  | 'leather'
  | 'metals'
  | 'decor_lighting_flowers'
  | 'arts_printing_calligraphy'
  | 'paper_binding'
  | 'packaging_crafts'
  | 'sewing_upholstery'
  | 'finishing_aux'
  | 'glass_mosaic'
  | 'energy_time_ops';

export interface MainSectionDefinition {
  id: MainSectionId;
  nameAr: string;
  iconName: string;
  description: string;
  isNewStar?: boolean;
}

export interface SubCraftDefinition {
  id: string;
  nameAr: string;
  mainSectionId: MainSectionId;
  calcEngine: 'macrame' | 'textile' | 'specialized' | 'generic' | 'fusion';
  status: 'active' | 'coming_soon';
  isNewStar?: boolean;
  badge?: string;
  description: string;
  sampleCategories: string[];
}

export const MAIN_SECTIONS: MainSectionDefinition[] = [
  {
    id: 'ropes_textiles',
    nameAr: '1. الحبال والنسيج والخيوط',
    iconName: 'Scroll',
    description: 'المكرمية، الكروشيه، الزجزاج، التافتنج، الكليم، العقادة، الغزل، التريكو، اللباد★ والصباغة★',
  },
  {
    id: 'beads_embroidery',
    nameAr: '2. الخرز والتطريز والإكسسوارات',
    iconName: 'Sparkles',
    description: 'شنط الخرز، التطريز اليدوي، السيرما★، الحلي، تشكيل الأسلاك، والترصيع',
  },
  {
    id: 'clays_composites',
    nameAr: '3. الريزن والطين والشموع والصابون',
    iconName: 'Boxes',
    description: 'الإيبوكسي، UV، البوليستر، الكونكريت، الجبس، الجيسمونايت، الصلصال، الخزف، الشموع، الصابون البارد، المصبوب★، القوالب★ والوصفات★',
  },
  {
    id: 'woods',
    nameAr: '4. الأخشاب والليزر والـ CNC',
    iconName: 'Trees',
    description: 'البامبو، الخوص، الراتان★، الأركت، الأرابيسك، النجارة، الحرق، الديكوباج، التطعيم، الليزر والـ CNC★، والطباعة 3D★',
  },
  {
    id: 'leather',
    nameAr: '5. صناعة الجلود',
    iconName: 'Briefcase',
    description: 'باترون الجلود، كفاءة التعشيق، التحويل بالقدم المربع، وخياطة السادل ستيتش',
  },
  {
    id: 'metals',
    nameAr: '6. المعادن والحدادة وتشكيل الفضة',
    iconName: 'Hammer',
    description: 'أوزان قطاعات الحديد والألومنيوم والستانلس واللحام، وتشكيل النحاس والفضة بالعيار اليومي',
  },
  {
    id: 'decor_lighting_flowers',
    nameAr: '7. الديكور والإضاءة والزهور والزجاج',
    iconName: 'Lamp',
    description: 'وحدات الإضاءة والنجف، الزهور الطبيعية واليدوية، وديكورات الأكريليك والزجاج',
  },
  {
    id: 'arts_printing_calligraphy',
    nameAr: '8. الفنون والطباعة والخط العربي',
    iconName: 'Palette',
    description: 'الكانفاس، الزيت، المائية، الرسم على الأسطح، الشبلونة، الفينيل، اللينوليوم، التذهيب، والتسامي★',
  },
  {
    id: 'paper_binding',
    nameAr: '9. الورق والتجليد وعجينة الورق ★',
    iconName: 'BookOpen',
    isNewStar: true,
    description: 'الورق والكروت بالتعشيق، الأوريجامي، التجليد الفني للدفاتر، وعجينة الورق',
  },
  {
    id: 'packaging_crafts',
    nameAr: '10. صناعة العلب والتغليف',
    iconName: 'Package',
    description: 'فرد علب الكرتون والأكياس، الشرائط والاستيكرات بالتعشيق الفعلي',
  },
  {
    id: 'sewing_upholstery',
    nameAr: '11. الخياطة والتفصيل والتنجيد',
    iconName: 'Scissors',
    description: 'تعشيق الباترون والقماش، خياطة الملابس والشنط، والكوشن والتنجيد بالإسفنج والفايبر',
  },
  {
    id: 'finishing_aux',
    nameAr: '12. التشطيب والخامات المساعدة',
    iconName: 'Paintbrush',
    description: 'الغراء بالمساحة/النقطة/الخط، أعواد السيليكون، الصنفرة، الدهانات والمخففات',
  },
  {
    id: 'glass_mosaic',
    nameAr: '13. الزجاج المعشق والموزاييك ★',
    iconName: 'Grid',
    isNewStar: true,
    description: 'حساب قطع الموزاييك ومعجون السقية، وتشكيل الزجاج المعشق بالتيفاني والرصاص',
  },
  {
    id: 'energy_time_ops',
    nameAr: '14. الأفران والطاقة والتشغيل بالدفعات',
    iconName: 'Zap',
    description: 'حساب الكهرباء متعدد الأجهزة، الوقود، إهلاك القوالب، وتوزيع الدفعة على القطع السليمة',
  },
];

export const SUB_CRAFTS_REGISTRY: SubCraftDefinition[] = [
  // القسم 1: الحبال والنسيج
  {
    id: 'macrame',
    nameAr: 'مكرمية',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'macrame',
    status: 'active',
    badge: 'المحرك الهندسي مفعّل',
    description: 'حساب هندسي للفتلات ومعامل العقدة والوزن بالمتر وهالك 5% على الصافي',
    sampleCategories: ['رانر', 'ستائر', 'سجاد', 'كوشن', 'جدارية', 'بوف', 'كرسي', 'أرجوحة', 'نجف وإضاءة', 'شنطة أو كلاتش'],
  },
  {
    id: 'crochet',
    nameAr: 'كروشيه',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'textile',
    status: 'active',
    badge: 'المحرك المتخصص مفعّل',
    description: 'كثافة الغرز والسطور وطريقة العينة والقواعد والبطانات وهالك 5%',
    sampleCategories: ['باسكت كروشيه', 'شال', 'مفرش', 'بطانية أطفال', 'شنطة كروشيه', 'أميجورومي'],
  },
  {
    id: 'zigzag',
    nameAr: 'زجزاج الحبال',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'textile',
    status: 'active',
    badge: 'المحرك المتخصص مفعّل',
    description: 'معادلة رامانوجان للبيضاوي، المساحة الفيزيائية، وخيط المكوك وهالك 7%',
    sampleCategories: ['سلال ومنظمات 3D', 'صواني حبال', 'كوسترات', 'سجاد حبال زجزاج', 'شنط حبال'],
  },
  {
    id: 'punch_needle',
    nameAr: 'إبرة النقاش (Punch Needle)',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'textile',
    status: 'active',
    badge: 'المحرك المتخصص مفعّل',
    description: 'قماش الكانفاه بهوامش الشد واستهلاك الخيط λ واللاتكس وهالك 5%',
    sampleCategories: ['تابلوه حائطي', 'كوشن بارز', 'كوستر صوف', 'مرآة مؤطرة'],
  },
  {
    id: 'tufting_gun',
    nameAr: 'مسدس التافت (Tufting)',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'textile',
    status: 'active',
    badge: 'المحرك المتخصص مفعّل',
    description: 'قماش التافت، مسار الوبرة والفتلات، اللاتكس والظهر المانع للانزلاق وهالك 10%',
    sampleCategories: ['سجادة فنية أرضية', 'لوحة جدارية تافتنج', 'مخدة بارزة'],
  },
  {
    id: 'kelim',
    nameAr: 'الكليم والنول اليدوي',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'textile',
    status: 'active',
    badge: 'المحرك المتخصص مفعّل',
    description: 'خيوط السداء واللحمة وأطراف التثبيت وفاقد النول وهالك 15%',
    sampleCategories: ['كليم نول أرضي', 'رانر صوف', 'معلقة نسيج'],
  },
  {
    id: 'aqqada',
    nameAr: 'العقادة والشرابات',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 1.7',
    description: 'الحبال المبرومة بمعامل البرم والشرابات والربط وهالك 5%',
    sampleCategories: ['شرابة ستارة', 'حبل مبروم', 'عقدة زخرفية'],
  },
  {
    id: 'spinning',
    nameAr: 'الغزل اليدوي',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 1.8',
    description: 'الألياف الخام بتحويل الفقد 12% إلى هالك مكافئ وحساب الطول بـ Tex',
    sampleCategories: ['شلة صوف مغزول', 'خيط كتان يدوي'],
  },
  {
    id: 'knitting',
    nameAr: 'التريكو اليدوي والنول الدائري',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 1.9',
    description: 'كثافة الغرز والسطور ووزن الخيط من عينة 10×10 سم وهالك 5%',
    sampleCategories: ['بلوفر تريكو', 'كوفية نول', 'بطانية صوف'],
  },
  {
    id: 'felting',
    nameAr: 'اللباد (Felting) ★',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'أبعاد الفرش قبل الانكماش ووزن الصوف بالكثافة السطحية والطبقات',
    sampleCategories: ['حقيبة لباد', 'مفرش صوف مضغوط', 'مجسم لباد'],
  },
  {
    id: 'dyeing',
    nameAr: 'الصباغة اليدوية ★',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'نسبة الصبغة من وزن الخامة %OWF وحجم حمام الصباغة LR والمثبت والتسخين',
    sampleCategories: ['شلات مصبوغة نباتياً', 'أقمشة شيبوري', 'حبال مصبوغة'],
  },
  {
    id: 'craft_fusion',
    nameAr: 'دمج المشغولات (Universal Fusion)',
    mainSectionId: 'ropes_textiles',
    calcEngine: 'fusion',
    status: 'active',
    badge: 'دمج أي حرفتين معاً',
    description: 'دمج أي ورشتين من الـ 14 قسماً بحساب مستقل لكل جزء دون تكرار الخامة أو الزمن',
    sampleCategories: ['مكرمية وخشب أركت', 'صينية ريزن وحبال', 'جلد مع خرز أو تطريز'],
  },

  // القسم 2: الخرز والتطريز والإكسسوارات
  {
    id: 'beadwork',
    nameAr: 'الخرز وشنط الخرز',
    mainSectionId: 'beads_embroidery',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 2.1',
    description: 'عدد الخرز ÷ خرز/جم وخيط الربط بهالكين مستقلين (3% خرز، 10% خيط)',
    sampleCategories: ['شنطة لولي', 'صينية خرز', 'ميدالية كريستال'],
  },
  {
    id: 'embroidery',
    nameAr: 'التطريز اليدوي',
    mainSectionId: 'beads_embroidery',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 2.2',
    description: 'طارة + هوامش شد، مسار الغرز × معامل الغرزة، وتقريب عدد الشلل لأعلى',
    sampleCategories: ['طارة تطريز', 'منديل كتب كتاب', 'تابلوه كتان'],
  },
  {
    id: 'sirma_embroidery',
    nameAr: 'تطريز السيرما والقصب ★',
    mainSectionId: 'beads_embroidery',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'تطريز الخيوط المعدنية والذهب والقصب بهالك 10%',
    sampleCategories: ['تطريز قفطان سيرما', 'لوحة قصب تراثية'],
  },
  {
    id: 'jewelry',
    nameAr: 'الحلي والإكسسوارات',
    mainSectionId: 'beads_embroidery',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 2.4',
    description: 'طول السلسلة + التطويل، وزن السلك، الأقفال والزردات بالعدد الفعلي',
    sampleCategories: ['عقد أحجار كريمة', 'سوار سلسلة', 'حلق مطلي'],
  },
  {
    id: 'wire_wrapping',
    nameAr: 'تشكيل الأسلاك (Wire Wrapping)',
    mainSectionId: 'beads_embroidery',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 2.5',
    description: 'أطوال اللفات والتثبيت × وزن المتر لكل قطر ومعدن مع الكابوشون',
    sampleCategories: ['تعليقة سلك نحاس وحجر', 'تاج أسلاك'],
  },
  {
    id: 'sequins_rhinestones',
    nameAr: 'الترصيع والترتر والفصوص',
    mainSectionId: 'beads_embroidery',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 2.6',
    description: 'استهلاك الترتر لكل غرزة والفصوص وخامات التثبيت',
    sampleCategories: ['فستان مرصع', 'طرحة ترتر وفصوص'],
  },

  // القسم 3: الريزن والمواد الطينية والمركبة والشموع والصابون
  {
    id: 'resin',
    nameAr: 'الريزن الإيبوكسي (Epoxy)',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.1',
    description: 'حجم القالب × الكثافة المعايرة، تقسيم أ:ب بالوزن، الألوان، وإهلاك القالب',
    sampleCategories: ['صينية ريزن', 'كوسترات جيود', 'شيالة كحك'],
  },
  {
    id: 'uv_resin',
    nameAr: 'ريزن UV',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.2',
    description: 'المساحة × السمك × الطبقات مع حساب كهرباء مصباح UV',
    sampleCategories: ['حلي ريزن UV', 'تغليف ميداليات'],
  },
  {
    id: 'polyester_resin',
    nameAr: 'ريزن البوليستر والألياف الزجاجية',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.3',
    description: 'الألياف الزجاجية بالـ GSM والراتنج بنسبة الألياف والمصلب بالوزن',
    sampleCategories: ['أحواض فايبرجلاس', 'تماثيل ومجسمات صب'],
  },
  {
    id: 'concrete',
    nameAr: 'الكونكريت الديكوري والترازو',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.4',
    description: 'وصفة الأسمنت والركام والماء المرنة + حساب السيلر بالتغطية',
    sampleCategories: ['صينية كونكريت', 'أصيص ترازو', 'كوب شمع إسمنتي'],
  },
  {
    id: 'gypsum',
    nameAr: 'الجبس الديكوري',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.5',
    description: 'معامل الجبس المقاس ونسبة الماء المحددة للمنتج',
    sampleCategories: ['فازة جبس مضلع', 'لوحة جبسية بارزة'],
  },
  {
    id: 'jesmonite',
    nameAr: 'الجيسمونايت (Jesmonite AC100)',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.6',
    description: 'تقسيم البودرة والسائل (2.5:1 وزنية أو حسب النشرة) والسيلر',
    sampleCategories: ['طقم صواني جيسمونايت', 'حامل شموع'],
  },
  {
    id: 'polymer_clay',
    nameAr: 'الصلصال الحراري',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.7',
    description: 'الوزن من الحجم × الكثافة، الورنيش، وكهرباء الخبز مقسومة على الدفعة',
    sampleCategories: ['مج مزخرف بالصلصال', 'حلق صلصال حراري'],
  },
  {
    id: 'pottery',
    nameAr: 'الخزف والفخار',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.8',
    description: 'الانكماش الخطي وعائد الوزن والجليز وحرقتا البسكويت والزجاج بالفرن',
    sampleCategories: ['مج خزف', 'فازة فخار', 'طاجن فخاري'],
  },
  {
    id: 'ceramics',
    nameAr: 'السيراميك وبلاطات الخزف',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.8',
    description: 'انكماش الطينة، الجليز السطحي، وحرق الفرن للبلاطات',
    sampleCategories: ['لوحة بلاط سيراميك', 'كوسترات خزفية'],
  },
  {
    id: 'candles',
    nameAr: 'صناعة الشموع',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.9',
    description: 'وزن الشمع من سعة الوعاء × كثافة الشمع، والعطر على الشمع أو من الإجمالي',
    sampleCategories: ['شمعة صويا معطرة', 'شمعة قوالب'],
  },
  {
    id: 'cold_process_soap',
    nameAr: 'الصابون بالطريقة الباردة',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 3.10 + تحذير',
    description: 'أرقام تصبن الزيوت NaOH، السوبرفات، تصحيح النقاء، والماء بتركيز المحلول',
    sampleCategories: ['صابون زيت زيتون وغار', 'صابون فحم وشوفان'],
  },
  {
    id: 'melt_pour_soap',
    nameAr: 'الصابون بالصب ★',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'قاعدة الجليسرين بالحجم × الكثافة ونسبة العطر الآمنة',
    sampleCategories: ['صابون هدايا جليسرين', 'توزيعات صابون'],
  },
  {
    id: 'mold_making',
    nameAr: 'صناعة قوالب السيليكون ★',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'حجم الصندوق − النموذج وتقسيم السيليكون والمصلب وتوزيع الإهلاك على الاستخدامات',
    sampleCategories: ['قالب سيليكون صينية', 'قالب شمعة مجسمة'],
  },
  {
    id: 'relative_recipes',
    nameAr: 'الوصفات النسبية (بلسم، عطور، بخور) ★',
    mainSectionId: 'clays_composites',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'تركيب الدفعة بالنسب المئوية (100%) مع هالك الأواني والتعبئة',
    sampleCategories: ['مخمرية وبادي باتر', 'بخور وعطور منزلية'],
  },

  // القسم 4: الأخشاب
  {
    id: 'bamboo',
    nameAr: 'البامبو والخيزران',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.1',
    description: 'أطوال البامبو (+8%)، الوزن، خامات ربط الوصلات، والورنيش بالمساحة',
    sampleCategories: ['مرآة بامبو', 'أباجورة خيزران', 'ستاند نباتات'],
  },
  {
    id: 'wicker',
    nameAr: 'الخوص وسعف النخيل',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.2',
    description: 'عائد الفرز Y بدون ازدواج الهالك وعدد شرائح النسج',
    sampleCategories: ['سبت غسيل خوص', 'شنطة خوص', 'مقعد سعف'],
  },
  {
    id: 'rattan',
    nameAr: 'الراتان (Rattan) ★',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'مسارات الراتان والهيكل (+12%) ووزن المتر والوصلات',
    sampleCategories: ['أثاث راتان', 'صينية وهيدبورد راتان'],
  },
  {
    id: 'scroll_saw',
    nameAr: 'الأركت والتفريغ',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.4',
    description: 'تقريب الألواح بكفاءة التعشيق (بدون هالك مكرر) وعمر سنون الأركت',
    sampleCategories: ['فانوس أركت', 'لوحة حروف مفرغة'],
  },
  {
    id: 'arabesque',
    nameAr: 'الأرابيسك والتصديف',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.5',
    description: 'حجم ووزن البرامق المخروطة والصدف (+20%) والفرنش بوليش',
    sampleCategories: ['صندوق صدف', 'مشربية أرابيسك'],
  },
  {
    id: 'carpentry',
    nameAr: 'النجارة والخراطة',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.6',
    description: 'الخشب الطبيعي بالحجم م³ (+15%) أو الألواح بالتعشيق، والقشرة والدهان متعدد الأوجه',
    sampleCategories: ['بلانشة زان', 'طربيزة يدوية', 'عصا مكرمية'],
  },
  {
    id: 'pyrography',
    nameAr: 'الحرق على الخشب (Pyrography)',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.7',
    description: 'القطعة الخشبية (+5%) + كهرباء جهاز الحرق والصنفرة والورنيش',
    sampleCategories: ['لوحة حرق خشب', 'كوسترات محروقة'],
  },
  {
    id: 'decoupage',
    nameAr: 'الديكوباج',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.8',
    description: 'مساحة الورق × الطبقات (+10%) والمودبودج والورنيش بالتغطية',
    sampleCategories: ['صينية ديكوباج', 'علبة مناديل فنتج'],
  },
  {
    id: 'wood_inlay',
    nameAr: 'تطعيم الخشب (Inlay)',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 4.9',
    description: 'حجم مادة التطعيم × الكثافة والغراء والقاعدة الخشبية',
    sampleCategories: ['لوحة تطعيم قشرة خشب', 'علبة مطعمة'],
  },
  {
    id: 'laser_cnc',
    nameAr: 'القص بالليزر والـ CNC ★',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'زمن القص + النقش وأجر الدقيقة والكهرباء والألواح بكفاءة التعشيق',
    sampleCategories: ['تابلوه ليزر متعدد الطبقات', 'ديكور CNC'],
  },
  {
    id: '3d_printing',
    nameAr: 'الطباعة ثلاثية الأبعاد ★',
    mainSectionId: 'woods',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'وزن السلايسر (+هالك الدعامات) والكهرباء وإهلاك الطابعة بالساعة',
    sampleCategories: ['فازات مطبوعة 3D', 'قوالب وماستر سيليكون'],
  },

  // القسم 5: الجلود
  {
    id: 'leathercraft',
    nameAr: 'صناعة الجلود (طبيعي وصناعي)',
    mainSectionId: 'leather',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 5',
    description: 'تعشيق الباترون ÷ ص_ك بالقدم المربع (929.03 سم²)، خيط سادل ستيتش، دهان حواف وإكسسوارات',
    sampleCategories: ['حقيبة جلد طبيعي', 'محفظة يدوية', 'حزام وكفر'],
  },

  // القسم 6: المعادن والحدادة
  {
    id: 'metalwork_forging',
    nameAr: 'الحدادة وتشكيل الحديد والألومنيوم والستانلس',
    mainSectionId: 'metals',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 6.1',
    description: 'أوزان القطاعات بالكثافة الصحيحة لكل معدن، اللحام بالمتر، والدهان والإلكتروستاتيك',
    sampleCategories: ['شاسيه معدن للطاولات', 'ستاند إضاءة حديد', 'مشغولات فيرفورجيه'],
  },
  {
    id: 'copper_silver_shaping',
    nameAr: 'تشكيل الفضة والنحاس والألومنيوم',
    mainSectionId: 'metals',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 6.2',
    description: 'تحويل فقد الصياغة إلى هالك صافي، عيار الفضة (925 = 0.925)، والسعر اليومي',
    sampleCategories: ['خاتم فضة 925', 'أسورة نحاس مطروق', 'صينية نحاس'],
  },

  // القسم 7: الديكور والإضاءة والزهور
  {
    id: 'lighting_craft',
    nameAr: 'وحدات الإضاءة والنجف',
    mainSectionId: 'decor_lighting_flowers',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 7.1 + سلامة',
    description: 'الأسلاك (+5%) والدوايات واللمبات والمحول وكهرباء اختبار العزل',
    sampleCategories: ['أباجورة هاند ميد', 'نجفة بوهو مضيئة'],
  },
  {
    id: 'natural_dried_flowers',
    nameAr: 'تنسيق الزهور الطبيعية والمجففة',
    mainSectionId: 'decor_lighting_flowers',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 7.2',
    description: 'عدد الفروع (+7%) والإسفنج الزهري والفلورال تيب',
    sampleCategories: ['بوكيه زهور مجففة', 'سنتربيس طبيعي'],
  },
  {
    id: 'handmade_flowers',
    nameAr: 'صناعة الزهور اليدوية',
    mainSectionId: 'decor_lighting_flowers',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 7.3',
    description: 'حساب البتلات ومساحة القماش/الفوم وأسلاك السيقان ونقاط الغراء',
    sampleCategories: ['زهور ستان', 'ورود فوم عملاقة', 'زهور ورقية'],
  },
  {
    id: 'acrylic_glass_decor',
    nameAr: 'ديكورات الزجاج والأكريليك',
    mainSectionId: 'decor_lighting_flowers',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 7.4',
    description: 'كفاءة اللوح والوزن = م × سمك × الكثافة بدون تكرار مساحة المتراكب',
    sampleCategories: ['لوحة أكريليك مرايا', 'صينية زجاج وأكريليك'],
  },

  // القسم 8: الفنون والطباعة والخط
  {
    id: 'canvas_painting',
    nameAr: 'لوحات الكانفاس والأكريليك',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.1',
    description: 'الجيسو والورنيش بالتغطية والأوجه، الشاسيه والألوان الفعلية (+5%)',
    sampleCategories: ['لوحة تجريدية بارزة', 'بورتريه أكريليك'],
  },
  {
    id: 'oil_painting',
    nameAr: 'الرسم بالألوان الزيتية',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.2',
    description: 'وزن الألوان المستهلكة فعلياً مع فصل وقت الجفاف عن الأجر',
    sampleCategories: ['لوحة زيتية كلاسيكية', 'منظر طبيعي زيت'],
  },
  {
    id: 'watercolor_gouache',
    nameAr: 'الألوان المائية والجواش',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.3',
    description: 'أفرخ الورق القطني × معامل المحاولات مع استبعاد تكلفة الماء',
    sampleCategories: ['لوحة ألوان مائية', 'إلستريشن جواش'],
  },
  {
    id: 'surface_painting',
    nameAr: 'الرسم على الأسطح (زجاج/خزف/خشب)',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.4',
    description: 'البرايمر واللون والمثبت بالتغطية + التثبيت الحراري عند اللزوم',
    sampleCategories: ['مج مرسوم يدوياً', 'مرآة مرسومة'],
  },
  {
    id: 'screen_printing',
    nameAr: 'طباعة القماش والشبلونة',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.5',
    description: 'الحبر بالمساحة × السحبات + توزيع تكلفة تجهيز الشبلونة على القطع',
    sampleCategories: ['توت باج مطبوع شبلونة', 'تيشيرت مطبوع'],
  },
  {
    id: 'heat_vinyl',
    nameAr: 'الطباعة الحرارية والفينيل (HTV)',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.6',
    description: 'مساحة الفينيل + هوامش التفريغ (+10%) وكهرباء المكبس الحراري',
    sampleCategories: ['ملابس فينيل حراري', 'كوشن مطبوع'],
  },
  {
    id: 'linocut',
    nameAr: 'الحفر والطباعة باللينوليوم',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.7',
    description: 'توزيع قالب اللينوليوم على عدد الطبعات + الحبر والورق',
    sampleCategories: ['مطبوعات لينوكات فنية', 'بطاقات محفورة'],
  },
  {
    id: 'calligraphy_gilding',
    nameAr: 'الخط العربي والتذهيب',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 8.8',
    description: 'الورق المعالج وأوراق الذهب (+5%) مع اعتبار الأقلام أدوات لا خامات',
    sampleCategories: ['لوحة خط ثلث مذهبة', 'مصحف مزخرف'],
  },
  {
    id: 'sublimation',
    nameAr: 'الطباعة بالتسامي (Sublimation) ★',
    mainSectionId: 'arts_printing_calligraphy',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'ورشة جديدة ★',
    description: 'حبر التسامي بالمتر² + ورق السبلميشن + كهرباء المكبس الحراري',
    sampleCategories: ['مج سبلميشن', 'تيشيرت ووسادة تسامي'],
  },

  // القسم 9 ★: الورق والتجليد
  {
    id: 'paper_cards',
    nameAr: 'الورق والكروت والأوريجامي ★',
    mainSectionId: 'paper_binding',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'قسم جديد ★',
    description: 'تعشيق الأجزاء في الفرخ الكبير، وزن الورق بـ GSM، والكويلينج والدعوات',
    sampleCategories: ['دعوات فرح', 'بطاقات منتجات وكروت', 'مجسمات أوريجامي'],
  },
  {
    id: 'bookbinding',
    nameAr: 'التجليد الفني والدفاتر ★',
    mainSectionId: 'paper_binding',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'قسم جديد ★',
    description: 'أوراق الصفحات ÷ 2، كرتون وقماش الغلاف والكعب، وخيط حياكة الكراريس',
    sampleCategories: ['أجندة تجليد يدوي', 'سكتش بوك فني', 'ألبوم صور'],
  },
  {
    id: 'papier_mache',
    nameAr: 'عجينة الورق (Papier-Mâché) ★',
    mainSectionId: 'paper_binding',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'قسم جديد ★',
    description: 'حساب الورق الخام من الوزن الجاف ÷ العائد مع الغراء الأبيض',
    sampleCategories: ['فازات وأطباق عجينة ورق', 'أقنعة ومجسمات'],
  },

  // القسم 10: التغليف
  {
    id: 'packaging_boxes_bags',
    nameAr: 'صناعة العلب والأكياس والتغليف',
    mainSectionId: 'packaging_crafts',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 10',
    description: 'مساحة الفرد للعلبة والأكياس × العدد في ألواح الكرتون بكفاءة التعشيق',
    sampleCategories: ['علب هدايا مخصصة', 'أكياس ورقية بيد حبل'],
  },

  // القسم 11: الخياطة والتنجيد
  {
    id: 'sewing_garments',
    nameAr: 'الخياطة وتفصيل الملابس والشنط',
    mainSectionId: 'sewing_upholstery',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 11.1',
    description: 'مساحة الباترون ÷ التعشيق ÷ عرض القماش (+التطابق) وخيط الخياطة',
    sampleCategories: ['كيمونو وملابس يدوية', 'شنط توت باج قماش'],
  },
  {
    id: 'cushions_upholstery',
    nameAr: 'الكوشن والتنجيد',
    mainSectionId: 'sewing_upholstery',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 11.2',
    description: 'الفايبر بالحجم × الكثافة المقاسة عند الامتلاء + قماش التنجيد بهوامش الشد 12%',
    sampleCategories: ['كوشن ديكوري', 'تنجيد كرسي وبوف'],
  },

  // القسم 12: التشطيب والمواد المساعدة
  {
    id: 'finishing_adhesives_coatings',
    nameAr: 'التشطيب واللصق والدهان والعزل',
    mainSectionId: 'finishing_aux',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 12',
    description: 'الدهان والعزل بالتغطية مع فصل تكلفة المخفف والغراء والصنفرة',
    sampleCategories: ['حزمة تشطيب وعزل لمشروع', 'صنفرة وتلميع أخشاب'],
  },

  // القسم 13 ★: الزجاج والموزاييك
  {
    id: 'mosaic_art',
    nameAr: 'فن الموزاييك ★',
    mainSectionId: 'glass_mosaic',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'قسم جديد ★',
    description: 'عدد القطع مع نسبة الفواصل (+12% هالك) وحساب وزن معجون السقية من عمق الفاصل',
    sampleCategories: ['طاولة موزاييك', 'لوحة فسيفساء', 'مرايا موزاييك'],
  },
  {
    id: 'stained_glass',
    nameAr: 'الزجاج المعشق (تيفاني ورصاص) ★',
    mainSectionId: 'glass_mosaic',
    calcEngine: 'specialized',
    status: 'active',
    isNewStar: true,
    badge: 'قسم جديد ★',
    description: 'مساحة الزجاج الخام بالتعشيق + شريط النحاس/الرصاص + القصدير واللحام',
    sampleCategories: ['لوحة زجاج معشق تيفاني', 'أباجورة زجاج ملون'],
  },

  // القسم 14: التشغيل والطاقة والوقت
  {
    id: 'kiln_machine_ops',
    nameAr: 'الأفران والماكينات والطاقة بالدفعات',
    mainSectionId: 'energy_time_ops',
    calcEngine: 'specialized',
    status: 'active',
    badge: 'معادلات القسم 14',
    description: 'تجميع كهرباء عدة أجهزة + الغاز + توزيع زمن الدفعة وتكلفتها على القطع السليمة',
    sampleCategories: ['تشغيل فرن خزف كامل', 'دفعة صهر أو خبز متعددة القطع'],
  },
];

/**
 * محرك التكلفة العام Fallback (يمر عبر buildUnifiedFinancialOutput ليحترم كل القواعد المصححة)
 */
export function calculateGenericCraftCost(input: CalculationInput): CalculationOutput {
  const materialsCost = sumDynamicExtraMaterials(input);
  return buildUnifiedFinancialOutput(input, {
    totalDirectMaterialsCost: materialsCost,
    extraMaterialsTotalCost: materialsCost,
  });
}

/**
 * دمج المشغولات الشامل (Universal Multi-Craft Fusion Engine)
 * يجمع أي ورشتين من الـ 14 قسماً ويحافظ على معادلة كل جزء وهالكه وزمنه بدون تكرار الخامة أو الزمن
 */
export function calculateFusionCraftCost(
  firstCalculation: CalculationOutput,
  secondCalculation: CalculationOutput,
  fusionOverhead: {
    packagingCost: number;
    transitFees: number;
    adminExpensesShare: number;
    pricingMode?: CalculationInput['pricingMode'];
    profitMarginPercent?: number;
    platformCommissionPercent?: number;
    advertisedDiscountPercent?: number;
    vatPercent?: number;
    batchQuantity?: number;
    goodPiecesCount?: number;
    batchSetupCost?: number;
    customDesignFee?: number;
  }
): CalculationOutput {
  const totalDirectMaterialsCost =
    (firstCalculation.totalDirectMaterialsCost || 0) + (secondCalculation.totalDirectMaterialsCost || 0);

  const laborWage = (firstCalculation.laborWage || 0) + (secondCalculation.laborWage || 0);
  const firstEnergy = firstCalculation.unifiedBreakdown?.energyCost || 0;
  const secondEnergy = secondCalculation.unifiedBreakdown?.energyCost || 0;
  const firstMold = firstCalculation.unifiedBreakdown?.moldCostPerPiece || 0;
  const secondMold = secondCalculation.unifiedBreakdown?.moldCostPerPiece || 0;

  const combinedLines = [
    ...(firstCalculation.craftMetrics?.detailedLines || []).map((l) => ({
      ...l,
      label: `[الجزء 1] ${l.label}`,
    })),
    ...(secondCalculation.craftMetrics?.detailedLines || []).map((l) => ({
      ...l,
      label: `[الجزء 2] ${l.label}`,
    })),
  ];

  const safetyWarnings = [
    firstCalculation.craftMetrics?.safetyWarning,
    secondCalculation.craftMetrics?.safetyWarning,
  ].filter(Boolean);

  return buildUnifiedFinancialOutput(
    {
      category: 'أخرى' as any,
      productName: 'دمج حِرف',
      shape3D: 'rectangle',
      widthCm: 0,
      diameterCm: 0,
      baseDiameterCm: 0,
      sideHeightCm: 0,
      totalLengthCm: 0,
      fringeLengthCm: 0,
      cordTypeId: '',
      cordThicknessMm: 0,
      pricePerKg: 0,
      curtainRodCost: 0,
      cushionCoverCost: 0,
      fiberCost: 0,
      bagAccessoriesCost: 0,
      extraMaterials: [],
      laborWage,
      packagingCost: Number(fusionOverhead.packagingCost) || 0,
      transitFees: Number(fusionOverhead.transitFees) || 0,
      adminExpensesShare: Number(fusionOverhead.adminExpensesShare) || 0,
      profitMarginPercent: fusionOverhead.profitMarginPercent ?? 35,
      pricingMode: fusionOverhead.pricingMode || 'margin',
      platformCommissionPercent: fusionOverhead.platformCommissionPercent || 0,
      advertisedDiscountPercent: fusionOverhead.advertisedDiscountPercent || 0,
      vatPercent: fusionOverhead.vatPercent || 0,
      batchQuantity: fusionOverhead.batchQuantity || 1,
      goodPiecesCount: fusionOverhead.goodPiecesCount || fusionOverhead.batchQuantity || 1,
      batchSetupCost: fusionOverhead.batchSetupCost || 0,
      customDesignFee: fusionOverhead.customDesignFee || 0,
      toolDepreciationRatePercent:
        firstCalculation.toolDepreciationRatePercent || secondCalculation.toolDepreciationRatePercent || 0,
      personalNotes: '',
    },
    {
      totalDirectMaterialsCost,
      yarnCost: (firstCalculation.yarnCost || 0) + (secondCalculation.yarnCost || 0),
      extraMaterialsTotalCost:
        (firstCalculation.extraMaterialsTotalCost || 0) + (secondCalculation.extraMaterialsTotalCost || 0),
      totalWeightKg: Number(((firstCalculation.totalWeightKg || 0) + (secondCalculation.totalWeightKg || 0)).toFixed(3)),
      totalWeightGrams: (firstCalculation.totalWeightGrams || 0) + (secondCalculation.totalWeightGrams || 0),
      totalYarnLengthMeters:
        (firstCalculation.totalYarnLengthMeters || 0) + (secondCalculation.totalYarnLengthMeters || 0),
      baseStrandsCount: firstCalculation.baseStrandsCount || secondCalculation.baseStrandsCount || 0,
      workingCordsCount: firstCalculation.workingCordsCount || secondCalculation.workingCordsCount || 0,
      singleStrandLengthCm: firstCalculation.singleStrandLengthCm || secondCalculation.singleStrandLengthCm || 0,
      energyCostExtra: firstEnergy + secondEnergy,
      moldCostExtra: firstMold + secondMold,
      craftMetrics: {
        craftId: 'craft_fusion',
        craftNameAr: `دمج (${firstCalculation.craftMetrics?.craftNameAr || 'الجزء 1'} + ${secondCalculation.craftMetrics?.craftNameAr || 'الجزء 2'})`,
        wasteMode: 'on_net',
        netQtyLabel: [firstCalculation.craftMetrics?.netQtyLabel, secondCalculation.craftMetrics?.netQtyLabel]
          .filter(Boolean)
          .join(' + '),
        grossQtyLabel: [firstCalculation.craftMetrics?.grossQtyLabel, secondCalculation.craftMetrics?.grossQtyLabel]
          .filter(Boolean)
          .join(' + '),
        safetyWarning: safetyWarnings.length > 0 ? safetyWarnings.join(' | ') : undefined,
        equationSummaryAr: 'ت_ك(المدمج) = Σ ت_خ(جزء_i) + Σ ت_ع(جزء_i) + Σ تشغيل وتغليف بدون تكرار',
        detailedLines: combinedLines,
      },
    }
  );
}

/**
 * Dispatcher الشامل: يوجّه أي حرفة من الـ 50+ ورشة إلى محركها الدقيق
 */
export function executeCraftCalculation(craftId: string, input: CalculationInput): CalculationOutput {
  const normId = normalizeWorkshopId(craftId);
  const craft = SUB_CRAFTS_REGISTRY.find((c) => c.id === normId);

  if (craft?.calcEngine === 'textile' || craft?.calcEngine === 'macrame') {
    return calculateTextileCraft(normId, input);
  }

  const specResult = executeWorkshopSpec(normId, input);
  if (specResult) {
    return specResult;
  }

  if (craft?.mainSectionId === 'ropes_textiles') {
    return calculateTextileCraft(normId, input);
  }

  return calculateGenericCraftCost(input);
}

export function getMainSectionForCraft(craftId: string): MainSectionId {
  const norm = normalizeWorkshopId(craftId);
  return SUB_CRAFTS_REGISTRY.find((c) => c.id === norm)?.mainSectionId || 'ropes_textiles';
}
