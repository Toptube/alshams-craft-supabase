export interface BrandAssetPair {
  light: string;
  dark: string;
}

export interface LandingNavLink {
  id: string;
  label: string;
  href: string;
}

export interface LandingFeatureCardItem {
  id: string;
  title: string;
  description: string;
}

export interface LandingStepItem {
  id: string;
  stepNumber: string;
  title: string;
  description: string;
}

export interface LandingReviewItem {
  id: string;
  quote: string;
  author: string;
  workshop: string;
  rating: number;
}

export interface LandingUpdateItem {
  id: string;
  tag: string;
  version: string;
  title: string;
  description: string;
}

export interface LandingFaqItem {
  id: string;
  q: string;
  a: string;
}

export interface LandingHeroMetricItem {
  id: string;
  value: string;
  label: string;
  detail: string;
}

export type LandingLayoutPreset =
  | 'editorial_craft'
  | 'executive_obsidian'
  | 'gallery_minimal'
  | 'conversion_split'
  | 'custom_injected';

export type LandingAccentTheme =
  | 'solar_orange'
  | 'emerald_craft'
  | 'royal_indigo'
  | 'crimson_clay';

export interface InjectedLandingTemplateSnapshot {
  id: string;
  name: string;
  html: string;
  css: string;
  savedAt: string;
}

export interface LandingDesignConfig {
  activePreset: LandingLayoutPreset;
  accentTheme: LandingAccentTheme;
  heroImageUrl: string;
  materialsImageUrl: string;
  supplierImageUrl: string;
  injectedTemplate: {
    enabled: boolean;
    name: string;
    html: string;
    css: string;
    autoHydrate: boolean;
    updatedAt?: string;
    history?: InjectedLandingTemplateSnapshot[];
  };
}

export interface LandingCmsConfig {
  cmsRevision?: number;
  designConfig?: LandingDesignConfig;
  brandAssets: {
    platformLogo: BrandAssetPair;
    brandIcon: BrandAssetPair;
    falconMascot: BrandAssetPair;
    shamousaMascot: BrandAssetPair;
  };
  header: {
    ctaButtonText: string;
    welcomeGateButtonText: string;
    navLinks: LandingNavLink[];
  };
  hero: {
    falconBadgeText: string;
    headlineLine1: string;
    headlineHighlight: string;
    description: string;
    primaryCtaText: string;
    secondaryCtaText: string;
    trustBadge1: string;
    trustBadge2: string;
    trustBadge3: string;
    metrics?: LandingHeroMetricItem[];
  };
  sections: {
    unifiedEngine?: {
      visible: boolean;
      badge: string;
      title: string;
      subtitle: string;
      ctaText: string;
      cards: LandingFeatureCardItem[];
      pipelineSteps: string[];
    };
    safeAccounts: {
      visible: boolean;
      badge: string;
      title: string;
      subtitle: string;
      ctaText: string;
      cards: LandingFeatureCardItem[];
    };
    aiPartners: {
      visible: boolean;
      badge: string;
      title: string;
      subtitle: string;
      falconName: string;
      falconRoleBadge: string;
      falconDescription: string;
      falconFootnote: string;
      shamousaName: string;
      shamousaRoleBadge: string;
      shamousaDescription: string;
      shamousaFootnote: string;
      simulatorTitle: string;
      simulatorCtaText: string;
    };
    craftLifecycle: {
      visible: boolean;
      badge: string;
      title: string;
      subtitle: string;
      ctaText: string;
      steps: LandingStepItem[];
    };
    crmClients: {
      visible: boolean;
      badge: string;
      titleLine1: string;
      titleHighlight: string;
      description: string;
      bullets: string[];
      ctaText: string;
    };
    smartCatalog: {
      visible: boolean;
      badge: string;
      titleLine1: string;
      titleHighlight: string;
      description: string;
      bullets: string[];
      ctaText: string;
    };
    craftStore: {
      visible: boolean;
      badge: string;
      titleLine1: string;
      titleHighlight: string;
      description: string;
      bullets: string[];
      ctaText: string;
    };
    toolMaintenance: {
      visible: boolean;
      badge: string;
      titleLine1: string;
      titleHighlight: string;
      description: string;
      bullets: string[];
      ctaText: string;
    };
    suppliersPromo: {
      visible: boolean;
      badge: string;
      titleLine1: string;
      titleHighlight: string;
      description: string;
      bullets: string[];
      ctaText: string;
    };
    familyProfile?: {
      visible: boolean;
      badge: string;
      titleLine1: string;
      titleHighlight: string;
      description: string;
      communityTitle: string;
      communityDesc: string;
      profileTitle: string;
      profileDesc: string;
      ctaText: string;
    };
    reviews: {
      visible: boolean;
      badge: string;
      title: string;
      subtitle: string;
      feedbackCtaText: string;
      items: LandingReviewItem[];
    };
    whatsNew: {
      visible: boolean;
      badge: string;
      title: string;
      subtitle: string;
      items: LandingUpdateItem[];
    };
    faq: {
      visible: boolean;
      badge: string;
      title: string;
      subtitle: string;
      items: LandingFaqItem[];
    };
    finalCta: {
      visible: boolean;
      title: string;
      subtitle: string;
      ctaText: string;
    };
    footer: {
      brandTitle: string;
      brandSubtitle: string;
      copyrightText: string;
      subTagline: string;
    };
  };
  welcomeGate: {
    headlineLine1: string;
    headlineHighlight: string;
    description: string;
    ctaText: string;
    anthemHintText: string;
  };
  updatedAt?: string;
}

export const DEFAULT_LANDING_MEDIA = {
  heroImageUrl: '/assets/images/landing_hero_atelier_1795095267133.jpg',
  materialsImageUrl: '/assets/images/landing_materials_flatlay_1795095266471.jpg',
  supplierImageUrl: '/assets/images/landing_supplier_showroom_1795095266526.jpg',
};

export const DEFAULT_BRAND_ASSETS = {
  platformLogo: {
    light: '/assets/aistudio/platform_logo_light_2f80dd76.png',
    dark: '/assets/aistudio/platform_logo_dark_26194bd4.png',
  },
  brandIcon: {
    light: '/brand_icon_light.png',
    dark: '/brand_icon_dark.png',
  },
  falconMascot: {
    light: '/falcon_mascot_transparent.png',
    dark: '/falcon_mascot_transparent.png',
  },
  shamousaMascot: {
    light: '/shamousa_mascot_transparent.png',
    dark: '/shamousa_mascot_transparent.png',
  },
};

export const DEFAULT_DESIGN_CONFIG: LandingDesignConfig = {
  activePreset: 'editorial_craft',
  accentTheme: 'solar_orange',
  heroImageUrl: DEFAULT_LANDING_MEDIA.heroImageUrl,
  materialsImageUrl: DEFAULT_LANDING_MEDIA.materialsImageUrl,
  supplierImageUrl: DEFAULT_LANDING_MEDIA.supplierImageUrl,
  injectedTemplate: {
    enabled: false,
    name: 'تصميم مخصص محقون',
    html: '',
    css: '',
    autoHydrate: true,
    history: [],
  },
};

export const DEFAULT_LANDING_CMS_CONFIG: LandingCmsConfig = {
  cmsRevision: 6,
  designConfig: { ...DEFAULT_DESIGN_CONFIG, injectedTemplate: { ...DEFAULT_DESIGN_CONFIG.injectedTemplate } },
  brandAssets: {
    platformLogo: { ...DEFAULT_BRAND_ASSETS.platformLogo },
    brandIcon: { ...DEFAULT_BRAND_ASSETS.brandIcon },
    falconMascot: { ...DEFAULT_BRAND_ASSETS.falconMascot },
    shamousaMascot: { ...DEFAULT_BRAND_ASSETS.shamousaMascot },
  },
  header: {
    ctaButtonText: 'ابدأ مجاناً',
    welcomeGateButtonText: 'بوابة الترحيب',
    navLinks: [
      { id: 'unified-engine', label: 'الخامات والورش', href: '#unified-engine' },
      { id: 'safe-accounts', label: 'المالية وهلخصهالك', href: '#safe-accounts' },
      { id: 'ai-partners', label: 'صقر وشموسة', href: '#ai-partners' },
      { id: 'craft-lifecycle', label: 'المتجر والسوق', href: '#craft-lifecycle' },
      { id: 'suppliers-promo', label: 'بوابة الموردين', href: '#suppliers-promo' },
    ],
  },
  hero: {
    falconBadgeText: 'صقر وشموسة — شريكا الورشة والمورد',
    headlineLine1: 'عشان إيدك بتتلف في حرير..',
    headlineHighlight: 'ورشتك تستاهل منظومة تحسبها بالضمير',
    description:
      'منظومة التشغيل والمحاسبة الأولى للحرف اليدوية وموردي الخامات في مصر والعالم العربي: 395+ خامة موحدة بكود رباعي، 50+ ورشة في 14 قسماً بمعادلات هندسية مصححة، بطاقة «هلخصهالك» المالية، متجرك المستقل وسوق الشمساوية، وبوابة فروع وكاشير 80 مم للموردين.',
    primaryCtaText: 'افتح ورشتك مجاناً',
    secondaryCtaText: 'سجل كمورد خامات B2B',
    trustBadge1: '395+ خامة موحدة بكود رباعي',
    trustBadge2: '50+ ورشة و14 قسماً بمعادلات مصححة',
    trustBadge3: 'تطبيق PWA يعمل على الموبايل والكمبيوتر',
    metrics: [
      { id: 'm1', value: '+395', label: 'خامة موحدة ومصنّفة', detail: '12 قسماً بكود رباعي TH0001.01#B003 ومسميات سوقية' },
      { id: 'm2', value: '+50', label: 'ورشة في 14 قسماً', detail: 'معادلات هندسية مصححة ث1–ث6 + دمج أي حِرفتين' },
      { id: 'm3', value: '6 مراحل', label: 'مسار إنتاج وتجارة منضبط', detail: 'خامات ← حاسبة ← أرشيف ← كتالوج ← متجر ← سوق' },
      { id: 'm4', value: '80 مم', label: 'بوابة الموردين والكاشير', detail: 'فروع، استلام على مرحلتين، شرائح كميات وريسيت فوري' },
    ],
  },
  sections: {
    unifiedEngine: {
      visible: true,
      badge: '01 · البنية الهندسية المعتمدة — الخامات الموحدة والورش الـ 14',
      title: 'منظومة خامات رباعية الأكواد.. و50+ ورشة بمعادلات مصححة بالمليم',
      subtitle:
        'لا مزيد من التخمين أو خلط مسميات السوق أو تكرار الهالك. كل خامة لها هوية هندسية موحدة، وكل حرفة لها معادلتها الدقيقة القابلة للمعايرة لورشتك.',
      ctaText: 'جرّب حاسبة الـ 14 قسماً الآن',
      cards: [
        {
          id: 'ue1',
          title: 'كود الخامة الرباعي وفك الالتباس الذكي',
          description:
            'بنية دقيقة من 4 مستويات (القسم ← الخامة الرئيسية ← المقاس/المواصفة ← الماركة مثل TH0001.01#B003) مع قاموس مسميات دارجة AL00001+ يفصل تلقائياً بين خيط الخرز وخرز الزينة دون خلط.',
        },
        {
          id: 'ue2',
          title: '6 قواعد محاسبية مصححة (ث1–ث6)',
          description:
            'هالك موحّد على الصافي فقط بدون ازدواجية مع كفاءة القص، أجر عمل للتحضير والتنفيذ والتشطيب بدون أجر وقت التجفيف، طاقة الأفران، إطفاء القوالب، وتوزيع التكلفة على القطع السليمة فقط.',
        },
        {
          id: 'ue3',
          title: 'التمييز الدقيق بين الهامش Margin والزيادة Markup',
          description:
            'احسب سعر البيع العادل مع عمولات المنصات وبوابات الدفع وضريبة القيمة المضافة والخصومات، مع توضيح فوري للفارق الرياضي بين زيادة 50% على التكلفة وهامش 33.3% من سعر البيع.',
        },
        {
          id: 'ue4',
          title: '14 قسماً حرفياً + دمج الحِرف الشامل',
          description:
            'من المكرمية والكروشيه والبانش نيدل والتافتنج، للريزن والصابون البارد (بمعادلة التصبن SAP وتحذيرات NaOH) والشموع، للخشب والليزر CNC والطباعة 3D والجلود والزجاج المعشق ودمج أي حِرفتين معاً.',
        },
      ],
      pipelineSteps: [
        'استيراد الخامات الموحدة',
        'حاسبة التكاليف أو صقر AI',
        'الأرشيف (كارت الصنف)',
        'الكتالوج المرجعي',
        'متجر الفنان المستقل',
        'سوق الشمساوية بموافقة الفنان والإدارة',
      ],
    },
    safeAccounts: {
      visible: true,
      badge: '02 · الإدارة المالية وبطاقة «هلخصهالك»',
      title: 'عقلك المالي بالبلدي الشيك.. بدون دائن ومدين ولا دفتر ضايع',
      subtitle:
        'بطاقة «هلخصهالك» للورش وللموردين تقعد معاك 30 ثانية وتقولك الخلاصة: معانا كام وفين، لينا كام بره عند مين ومتأخر كام يوم، علينا كام للموردين والمصانع، وإيه اللي شغال ونايم في المخزن.',
      ctaText: 'افتح حسابك واضبط خزينتك اليوم',
      cards: [
        {
          id: 'sc1',
          title: 'معانا كام وفين لحظياً',
          description:
            'فصل كامل بين الكاش في درج الورشة أو الفروع، تحويلات إنستاباي والبنك، والمحافظ والعُهد النقدية مع مطابقة يومية فورية.',
        },
        {
          id: 'sc2',
          title: 'لينا كام بره + تذكير لطيف بالواتساب',
          description:
            'كشف فوري بالعملاء المتأخرين وعدد أيام التأخير مع تحذير من البيع الآجل المتكرر وزر يصيغ رسالة تذكير مهذبة على واتساب بضغطة واحدة.',
        },
        {
          id: 'sc3',
          title: 'علينا كام للموردين والمصانع',
          description:
            'متابعة فواتير الشراء الآجلة وتوريدات الخامات ومواعيد الاستحقاق وعُهد الصناع عشان سيولة الورشة أو الفروع ما تنكشفش أبداً.',
        },
        {
          id: 'sc4',
          title: 'رادار حركة المخزون (طاير vs نايم)',
          description:
            'اعرف فوراً أكثر الخامات سحباً لتأمينها قبل النفاد، وأبطأ الأصناف حركة لتصريفها بعروض ذكية وتحرير رأس المال الراكد.',
        },
      ],
    },
    aiPartners: {
      visible: true,
      badge: '03 · صقر الشمساوية وشموسة — شركاء التشغيل والهندسة',
      title: 'شموسة وصقر معاك على الخط.. فاهمين الصنعة وأرقام ورشتك الحية',
      subtitle:
        'مش مجرد دردشة عامة — دول مساعدين مربوطين بأرصدة خزينتك، مخزنك، خاماتك الـ 395، ومعادلات الورش الـ 14، مع بحث سوق حي وتفريغ صوتي عربي.',
      falconName: 'صقر الشمساوية',
      falconRoleBadge: 'المستشار الهندسي والتسعيري',
      falconDescription:
        'يحلل مواصفات وأبعاد المشغولة عبر الـ 50+ ورشة، يحسب الخامات الصافية والهالك وساعات العمل والهامش، ويديك زر «تصدير للحاسبة» بضغطة واحدة.',
      falconFootnote: 'متصل بالمعادلات المصححة ث1–ث6 والبحث السوقي الحي',
      shamousaName: 'شموسة',
      shamousaRoleBadge: 'مديرة العمليات والخزائن',
      shamousaDescription:
        'دليلك الفوري داخل المنظومة: تراجع معاك «هلخصهالك»، تنبهك لنواقص الخامات وأوامر التشغيل المفتوحة، وتدلك على أي شاشة أو معادلة في ثانية.',
      shamousaFootnote: 'متصلة مباشرة بأدوات استعلام الخزائن والمخازن والفروع',
      simulatorTitle: 'جرّب ردود صقر وشموسة الحية',
      simulatorCtaText: 'ابدأ المحادثة مع صقر وشموسة في ورشتك',
    },
    craftLifecycle: {
      visible: true,
      badge: '04 · دورة حياة المشغولة والبيع المنضبط',
      title: 'من استيراد الخامة لحد متجرك المستقل وسوق الشمساوية',
      subtitle:
        'مسار إنتاجي محكم يبدأ من كارت الصنف في الأرشيف، ويحفظ قرار الفنان الكامل في اختيار ما يُنشر لمتجره وما يُرفع لسوق الشمساوية.',
      ctaText: 'ابدأ بناء كتالوجك ومتجرك مجاناً',
      steps: [
        {
          id: 'st1',
          stepNumber: '01',
          title: 'الخامات والحاسبة الدقيقة',
          description:
            'استورد خاماتك من المنظومة الموحدة وسعّر القطعة بمعادلة ورشتك الدقيقة أو عبر التصدير المباشر من صقر.',
        },
        {
          id: 'st2',
          stepNumber: '02',
          title: 'الأرشيف (كارت الصنف)',
          description:
            'احفظ وصفة القطعة الكاملة بمقاساتها وخاماتها وتكلفتها في الأرشيف لتعيد تصنيعها وتشغيلها بنفس الدقة في أي وقت.',
        },
        {
          id: 'st3',
          stepNumber: '03',
          title: 'الكتالوج وعروض الأسعار',
          description:
            'صدّر أصنافك المختارة للكتالوج وأصدر عروض أسعار موثقة للعملاء مع العربون ومدة التنفيذ بضغطة واحدة.',
        },
        {
          id: 'st4',
          stepNumber: '04',
          title: 'متجرك المستقل وسوق الشمساوية',
          description:
            'اختر المنتجات التي ترفعها لمتجرك، وحدد بعلامة اختيار ما ترغب بعرضه في سوق الشمساوية ليُراجع ويُعتمد بشارة خضراء واضحة.',
        },
      ],
    },
    crmClients: {
      visible: true,
      badge: 'إدارة علاقات العملاء (CRM الحرفي)',
      titleLine1: 'عميلك مش رقم عابر..',
      titleHighlight: 'ملف متكامل ومستحقات واضحة بدون إحراج',
      description:
        'احفظ مقاسات وألوان وتفضيلات كل عميل، وتابع طلباته من متجرك أو سوق الشمساوية أو البيع الخارجي مع كشف حساب فوري وتواصل واتساب مباشر.',
      bullets: [
        'دليل عملاء مصنّف حسب مصدر الطلب (متجري · سوق الشمساوية · بيع خارجي)',
        'كشف حساب مديونيات وعربون ومتأخرات مع تذكير واتساب مهذب بلمسة واحدة',
        'توثيق كامل لمراحل التنفيذ وأوامر التشغيل ومواعيد التسليم',
      ],
      ctaText: 'نظّم ملفات عملائك الآن',
    },
    smartCatalog: {
      visible: true,
      badge: 'الكتالوج المرجعي وعروض الأسعار',
      titleLine1: 'كتالوج يشرفك قدام زباينك..',
      titleHighlight: 'وعروض أسعار موثقة برقم مسلسل',
      description:
        'ودّع التسعير العشوائي على الورق. أنشئ عرض سعر احترافي يوضح الخامات والمقاسات ومدة التنفيذ وشروط الدفعة المقدمة، وشاركه برابط مباشر.',
      bullets: [
        'عروض أسعار رسمية برقم مسلسل وشروط عربون وتسليم واضحة',
        'تحويل فوري من عرض السعر إلى طلبية وأمر تشغيل وخصم خامات',
        'تصدير ومشاركة سريعة عبر واتساب وبطاقة QR لمتجرك',
      ],
      ctaText: 'صمّم كتالوج ورشتك مجاناً',
    },
    craftStore: {
      visible: true,
      badge: 'سوق الشمساوية متعدد التجار ومتجرك الخاص',
      titleLine1: 'متجرك المستقل بهويتك..',
      titleHighlight: 'مع بوابة مباشرة لسوق الشمساوية المعتمد',
      description:
        'تتحكم بالكامل في سلسلة النشر: من الأرشيف للكتالوج، ومنه تختار المنتجات التي تنشرها في متجرك الخاص، ثم تحدد يدوياً القطع التي تطلب عرضها في سوق الشمساوية مع تتبع حالة القبول والمراجعة.',
      bullets: [
        'متجر رقمي مستقل برابط خاص وشعارك وتخصيص كامل للمقاسات والألوان والعملة',
        'موافقة صريحة من الفنان قبل التصدير لسوق الشمساوية مع شارة خضراء للمنتجات المعتمدة',
        'إعادة مراجعة تلقائية عند تعديل أي منتج معتمد لضمان جودة السوق',
        'ربط مباشر بمخزن المنتجات الجاهزة والخزينة مع تقارير أرباح حقيقية',
      ],
      ctaText: 'افتح متجرك وشارك في السوق',
    },
    toolMaintenance: {
      visible: true,
      badge: 'إدارة الأصول والعدد والصيانة الوقائية',
      titleLine1: 'احمِ ماكيناتك وعِددك..',
      titleHighlight: 'عشان خط الإنتاج ما يعطلش في عز الموسم',
      description:
        'سجل كل ماكينة، نول، فرن، ليزر، أو أداة في ورشتك مع جدول صيانة وقائية وحساب إطفاء القوالب وإهلاك المعدات تلقائياً داخل تكلفة كل قطعة.',
      bullets: [
        'تنبيهات صيانة دورية وتغيير زيوت وسيور وفحص أمان قبل الأعطال المفاجئة',
        'حساب إهلاك المعدات وإطفاء القوالب السيليكون ضمن تكلفة القطعة الواحدة',
        'سجل تاريخي لتكاليف الإصلاح وقيمة الأصول الثابتة في الميزانية',
      ],
      ctaText: 'سجل أصول ورشتك مجاناً',
    },
    suppliersPromo: {
      visible: true,
      badge: '05 · بوابة موردي وتجار ومصانع الخامات (B2B & B2C)',
      titleLine1: 'بتبيع خامات هاند ميد بالجملة أو القطاعي؟',
      titleHighlight: 'فروعك، مخازنك، وكاشير 80 مم في نظام واحد',
      description:
        'بوابة تجارية وتشغيلية متكاملة لموردي الخيوط، الخرز، الريزن، الأخشاب، والجلود: إدارة شجرة فروع ومخزن مركزي، كاشير POS فائق السرعة بدون صور مع بيع بالوزن والكسور، وتحويل مخزني بين الفروع باستلام فعلي على مرحلتين.',
      bullets: [
        'شجرة فروع ومخزن مركزي مع توريد خزائن الفروع لخزينة المالك بضغطة تأكيد',
        'كاشير POS سريع يبيع بالجرام والكسور العشرية (مثل 2.4 كجم) ويطبع ريسيت حراري 80 مم',
        'تحويل بضاعة بين الفروع على مرحلتين (شحن ← تأكيد استلام أو رفض وإرجاع تلقائي بكارت الصنف)',
        'شرائح أسعار كميات متدرجة تلقائياً + مقارنة أسعار الموردين + تثبيت شاشة الفرع Kiosk Lock وشؤون العاملين HR',
      ],
      ctaText: 'سجل كمورد خامات الآن',
    },
    familyProfile: {
      visible: true,
      badge: '06 · مجتمع عيلة الشمساوية والصفحة الشخصية',
      titleLine1: 'فنان ومورد على طبلية واحدة..',
      titleHighlight: 'ومعرض أعمال شخصي يتحكم في مين يشوف إيه',
      description:
        'منتدى وشات «طبلية عيلة الشمساوية» يجمع الفنانين والموردين لتبادل الخبرات والعروض الحية، مع صفحة شخصية لكل عضو تعرض قصة براندك وأبرز 6 أعمال بمصفوفة خصوصية ذكية.',
      communityTitle: 'طبلية عيلة الشمساوية والمنتدى الحي',
      communityDesc:
        'شارك شغلك، استشر إخواتك الحرفيين في الغرز والخامات، وتابع أحدث عروض الموردين — وبضغطة واحدة على صورة أي عضو تفتح صفحته الشخصية فوراً.',
      profileTitle: 'صفحتي الشخصية ومصفوفة الظهور + أمان الصور 8 ساعات',
      profileDesc:
        'ارفع حتى 6 صور مميزة بضغط ذكي، حدد ما يظهر للفنانين أو الموردين أو العملاء، وعاين صفحتك بعيونهم — مع حماية التراجع عن تغيير الشعارات والصور لمدة 8 ساعات.',
      ctaText: 'أنشئ صفحتك وانضم للعيلة',
    },
    reviews: {
      visible: true,
      badge: '07 · حكايات نجاح من قلب ورش ومخازن الشمساوية',
      title: 'صنّاع وموردون نقلوا شغلهم من العشوائية للاستقرار والربح',
      subtitle: 'تجارب واقعية لورش حرفية وتجار خامات اعتمدوا على الأرقام الدقيقة والنظام اليومي.',
      feedbackCtaText: 'شاركنا رأيك أو اقتراحك لتطوير المنظومة',
      items: [
        {
          id: 'rev1',
          quote:
            'قبل الشمساوية كنت ببيع الجدارية بسعر الخامة وبنسى تعب إيدي! المعادلات المصححة وفرز الهامش من الزيادة خلتني أضبط أسعاري وأكسب صح.',
          author: 'مريم فهمي',
          workshop: 'ورشة نغم المكرمية · القاهرة',
          rating: 5,
        },
        {
          id: 'rev2',
          quote:
            'منظومة الخامات الموحدة والحاسبة وفّروا علينا شراء بكر زيادة بيركن في المخزن.. الهدر قل بنسبة 80% وكل صنف بقى له كارت في الأرشيف.',
          author: 'منى عادل',
          workshop: 'ورشة غرزة وسنارة · الإسكندرية',
          rating: 5,
        },
        {
          id: 'rev3',
          quote:
            'بطاقة «هلخصهالك» بتجيب لي الخلاصة في 10 ثواني من غير دائن ومدين.. أعرف ليا بره عند مين وأبعت تذكير واتساب شيك بضغطة.',
          author: 'إبراهيم النوبي',
          workshop: 'ورشة أصيل للخوص والجريد · أسوان',
          rating: 5,
        },
        {
          id: 'rev4',
          quote:
            'شجرة الفروع وكاشير 80 مم والاستلام على مرحلتين بين المخزن والمحلات خلّوا ولا بكرة ولا جنيه يتوهوا بين الفروع.',
          author: 'كريم ناصر',
          workshop: 'شركة النور لتوريد الخامات · قنا',
          rating: 5,
        },
      ],
    },
    whatsNew: {
      visible: true,
      badge: 'تحديثات المنظومة · الإصدار V 5.0',
      title: 'أحدث ما أضفناه للورش والموردين في التطوير الشامل',
      subtitle: 'تطويرات مبنية بالكامل على احتياجات الصناع والموردين الفعلية داخل السوق المصري والعربي.',
      items: [
        {
          id: 'wn1',
          tag: 'الخامات والورش',
          version: 'V 5.0',
          title: '395+ خامة موحدة بكود رباعي + 50+ ورشة في 14 قسماً',
          description:
            'تصنيف رباعي للأكواد ومسميات السوق الدارجة، معادلات مصححة ث1–ث6 (الهالك الصافي، المصنعية، الأفران، القوالب، الهامش والزيادة) مع دمج أي حِرفتين.',
        },
        {
          id: 'wn2',
          tag: 'المتجر والسوق',
          version: 'V 5.0',
          title: 'مسار نشر محكوم بقرار الفنان + شارة الاعتماد الخضراء',
          description:
            'تحديد متعدد للمنتجات عند التصدير من الكتالوج للمتجر ومن المتجر لسوق الشمساوية، مع إشعارات فورية واعتماد السوبر أدمن وإعادة المراجعة عند التعديل.',
        },
        {
          id: 'wn3',
          tag: 'الموردين وAI',
          version: 'V 5.0',
          title: 'فروع وكاشير 80 مم + استلام على مرحلتين + سرعة AI فائقة',
          description:
            'تشغيل فوري لصقر وشموسة والبحث الحي والتفريغ الصوتي العربي، مع كاشير 80 مم وبطاقة «هلخصهالك للموردين» وتثبيت أجهزة الفروع Kiosk Lock.',
        },
      ],
    },
    faq: {
      visible: true,
      badge: 'أسئلة شائعة وإجابات واضحة',
      title: 'كل ما يدور في بالك قبل فتح ورشتك أو بوابة موردك',
      subtitle: 'إجابات مباشرة عن منظومة الخامات، المعادلات، سوق الشمساوية، بوابة الموردين، وأمان بياناتك.',
      items: [
        {
          id: 'fq1',
          q: 'كيف تعمل منظومة الخامات الموحدة الـ 395؟ وهل أقدر أضيف خامتي الخاصة؟',
          a: 'تبحث بالاسم أو الكود المختصر (مثل TH للخيوط أو WD للأخشاب) وتستورد لورشتك ما تحتاجه فقط. وإذا لم تجد خامة تضيفها فوراً فتأخذ كوداً جديداً وتظهر لورشتك مباشرة وتُرسل للمراجعة، وأي تعديل أو حذف تقوم به يسري على قائمتك الخاصة فقط دون التأثير على بقية المنظومة.',
        },
        {
          id: 'fq2',
          q: 'ما هو مسار المنتج الصحيح من الخامة وحتى سوق الشمساوية؟',
          a: 'المسار منظم بوضوح: (1) إدخال أو استيراد الخامات ← (2) التسعير في حاسبة التكاليف (أو عبر التصدير من صقر) ← (3) الحفظ في الأرشيف ككارت صنف معتمد ← (4) النقل للكتالوج وتحديد المنتجات التي تصدرها لمتجرك ← (5) اختيار المنتجات التي تطلب عرضها في سوق الشمساوية ليراجعها السوبر أدمن وتظهر لك بشارة خضراء معتمدة.',
        },
        {
          id: 'fq3',
          q: 'يعني إيه بطاقة «هلخصهالك» وهل موجودة للورش والموردين؟',
          a: 'نعم، متاحة للورش وللموردين متعددين الفروع. تعطيك خلاصة الخزائن (كاش / إنستاباي / محافظ وعُهد فروع)، المستحقات لدى العملاء مع عدد أيام التأخير وزر «تذكير لطيف بالواتساب»، ما علينا للموردين والمصانع، وحركة المخزون الأسرع والأبطأ بدون أي تعقيد محاسبي.',
        },
        {
          id: 'fq4',
          q: 'ما الفرق بين المعادلات الجديدة ث1–ث6 والتسعير التقليدي؟',
          a: 'المعادلات الجديدة تمنع تماماً خطأ تكرار الهالك فوق كفاءة القص، تستبعد وقت التجفيف الهوائي من أجر اليد العاملة، تحسب طاقة الأفران والماكينات وإطفاء القوالب وتوزع تكلفة الدفعة على القطع السليمة فقط، وتفصل بوضوح بين هامش الربح من سعر البيع (Margin) والزيادة على التكلفة (Markup).',
        },
        {
          id: 'fq5',
          q: 'كيف تضمن بوابة الموردين عدم ضياع البضاعة عند التحويل بين الفروع؟',
          a: 'يعتمد النظام على التحويل بخطوتين: عند شحن خامات من المخزن الرئيسي لفرع، تُخصم من الراسل وتقف في قائمة «قيد الاستلام»، ولا تدخل رصيد الفرع إلا بعد تأكيد أمين الفرع أو المالك (وفي حالة الرفض تعود للراسل تلقائياً مع قيد موثق في كارت الصنف).',
        },
        {
          id: 'fq6',
          q: 'ما الفرق بين صقر الشمساوية وشموسة داخل المنظومة؟',
          a: 'صقر هو المستشار الهندسي والتسعيري: يحسب خامات وتكاليف الـ 50+ ورشة ويصدر التحليل مباشرة لحاسبة التكاليف. أما شموسة فهي مديرة العمليات اليومية: مرتبطة بأرصدة خزينتك ومخزنك وفروعك، تشرح لك «هلخصهالك»، وتدلك على كل شاشة وزرار في المنظومة.',
        },
      ],
    },
    finalCta: {
      visible: true,
      title: 'جاهز تنقل ورشتك أو تجارتك في الخامات لنظام حقيقي يحفظ حقك؟',
      subtitle:
        'افتح حسابك الآن مجاناً — سواء كنت فناناً حرفياً أو مورد خامات متعدد الفروع — وابدأ بحسابات دقيقة ومنظومة عمل تشرّف براندك.',
      ctaText: 'افتح حسابك الآن مجاناً',
    },
    footer: {
      brandTitle: 'منظومة الشمساوية',
      brandSubtitle: 'نظام التشغيل والتسعير والمحاسبة وسوق الحرف اليدوية وموردي الخامات',
      copyrightText: 'صُنع بإتقان بأيادٍ مصرية لدعم الحرفيين وصنّاع الإبداع وموردي الخامات © 2026',
      subTagline: 'منظومة الشمساوية · شركة الشمس كرافت',
    },
  },
  welcomeGate: {
    headlineLine1: 'يا مرحب بيك في مطرح الفن والجدعنة..',
    headlineHighlight: 'نورت عيلة الشمساوية',
    description:
      'المنظومة الأولى المصممة على يد حرفيين لأجل صناع وفناني وموردي مصر والوطن العربي.. هنا حساباتك مضبوطة، خاماتك موحدة، ومساعدك الذكي دايماً جنبك.',
    ctaText: 'ادخل إلى منظومة الشمساوية',
    anthemHintText: 'يصاحبه نشيد المنظومة الترحيبي',
  },
};

const LANDING_CMS_STORAGE_KEY = 'alshams_landing_cms_config';

export function normalizeLandingCmsConfig(raw?: Partial<LandingCmsConfig> | null): LandingCmsConfig {
  const r = (raw || {}) as Partial<LandingCmsConfig>;
  const isLegacyRevision = !r.cmsRevision || r.cmsRevision < 6;
  const rawDesign = r.designConfig;

  return {
    cmsRevision: 6,
    designConfig: {
      activePreset: rawDesign?.activePreset || DEFAULT_DESIGN_CONFIG.activePreset,
      accentTheme: rawDesign?.accentTheme || DEFAULT_DESIGN_CONFIG.accentTheme,
      heroImageUrl: rawDesign?.heroImageUrl || DEFAULT_LANDING_MEDIA.heroImageUrl,
      materialsImageUrl: rawDesign?.materialsImageUrl || DEFAULT_LANDING_MEDIA.materialsImageUrl,
      supplierImageUrl: rawDesign?.supplierImageUrl || DEFAULT_LANDING_MEDIA.supplierImageUrl,
      injectedTemplate: {
        enabled: Boolean(rawDesign?.injectedTemplate?.enabled),
        name: rawDesign?.injectedTemplate?.name || DEFAULT_DESIGN_CONFIG.injectedTemplate.name,
        html: typeof rawDesign?.injectedTemplate?.html === 'string' ? rawDesign.injectedTemplate.html : '',
        css: typeof rawDesign?.injectedTemplate?.css === 'string' ? rawDesign.injectedTemplate.css : '',
        autoHydrate: rawDesign?.injectedTemplate?.autoHydrate !== false,
        updatedAt: rawDesign?.injectedTemplate?.updatedAt,
        history: Array.isArray(rawDesign?.injectedTemplate?.history)
          ? rawDesign!.injectedTemplate!.history!.slice(0, 8)
          : [],
      },
    },
    brandAssets: {
      platformLogo: {
        light: r.brandAssets?.platformLogo?.light || DEFAULT_BRAND_ASSETS.platformLogo.light,
        dark: r.brandAssets?.platformLogo?.dark || DEFAULT_BRAND_ASSETS.platformLogo.dark,
      },
      brandIcon: {
        light: r.brandAssets?.brandIcon?.light || DEFAULT_BRAND_ASSETS.brandIcon.light,
        dark: r.brandAssets?.brandIcon?.dark || DEFAULT_BRAND_ASSETS.brandIcon.dark,
      },
      falconMascot: {
        light: r.brandAssets?.falconMascot?.light || DEFAULT_BRAND_ASSETS.falconMascot.light,
        dark: r.brandAssets?.falconMascot?.dark || DEFAULT_BRAND_ASSETS.falconMascot.dark,
      },
      shamousaMascot: {
        light: r.brandAssets?.shamousaMascot?.light || DEFAULT_BRAND_ASSETS.shamousaMascot.light,
        dark: r.brandAssets?.shamousaMascot?.dark || DEFAULT_BRAND_ASSETS.shamousaMascot.dark,
      },
    },
    header: isLegacyRevision
      ? { ...DEFAULT_LANDING_CMS_CONFIG.header }
      : {
          ...DEFAULT_LANDING_CMS_CONFIG.header,
          ...(r.header || {}),
          navLinks:
            Array.isArray(r.header?.navLinks) && r.header!.navLinks.length > 0
              ? r.header!.navLinks
              : DEFAULT_LANDING_CMS_CONFIG.header.navLinks,
        },
    hero: isLegacyRevision
      ? { ...DEFAULT_LANDING_CMS_CONFIG.hero }
      : {
          ...DEFAULT_LANDING_CMS_CONFIG.hero,
          ...(r.hero || {}),
          metrics:
            Array.isArray(r.hero?.metrics) && r.hero!.metrics!.length > 0
              ? r.hero!.metrics
              : DEFAULT_LANDING_CMS_CONFIG.hero.metrics,
        },
    sections: {
      unifiedEngine: isLegacyRevision
        ? { ...DEFAULT_LANDING_CMS_CONFIG.sections.unifiedEngine! }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.unifiedEngine!,
            ...(r.sections?.unifiedEngine || {}),
            cards:
              Array.isArray(r.sections?.unifiedEngine?.cards) && r.sections!.unifiedEngine!.cards.length > 0
                ? r.sections!.unifiedEngine!.cards
                : DEFAULT_LANDING_CMS_CONFIG.sections.unifiedEngine!.cards,
            pipelineSteps:
              Array.isArray(r.sections?.unifiedEngine?.pipelineSteps) &&
              r.sections!.unifiedEngine!.pipelineSteps.length > 0
                ? r.sections!.unifiedEngine!.pipelineSteps
                : DEFAULT_LANDING_CMS_CONFIG.sections.unifiedEngine!.pipelineSteps,
          },
      safeAccounts: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.safeAccounts,
            visible: r.sections?.safeAccounts?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.safeAccounts,
            ...(r.sections?.safeAccounts || {}),
            cards:
              Array.isArray(r.sections?.safeAccounts?.cards) && r.sections!.safeAccounts!.cards.length > 0
                ? r.sections!.safeAccounts!.cards
                : DEFAULT_LANDING_CMS_CONFIG.sections.safeAccounts.cards,
          },
      aiPartners: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.aiPartners,
            visible: r.sections?.aiPartners?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.aiPartners,
            ...(r.sections?.aiPartners || {}),
          },
      craftLifecycle: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.craftLifecycle,
            visible: r.sections?.craftLifecycle?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.craftLifecycle,
            ...(r.sections?.craftLifecycle || {}),
            steps:
              Array.isArray(r.sections?.craftLifecycle?.steps) && r.sections!.craftLifecycle!.steps.length > 0
                ? r.sections!.craftLifecycle!.steps
                : DEFAULT_LANDING_CMS_CONFIG.sections.craftLifecycle.steps,
          },
      crmClients: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.crmClients,
            visible: r.sections?.crmClients?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.crmClients,
            ...(r.sections?.crmClients || {}),
            bullets:
              Array.isArray(r.sections?.crmClients?.bullets) && r.sections!.crmClients!.bullets.length > 0
                ? r.sections!.crmClients!.bullets
                : DEFAULT_LANDING_CMS_CONFIG.sections.crmClients.bullets,
          },
      smartCatalog: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.smartCatalog,
            visible: r.sections?.smartCatalog?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.smartCatalog,
            ...(r.sections?.smartCatalog || {}),
            bullets:
              Array.isArray(r.sections?.smartCatalog?.bullets) && r.sections!.smartCatalog!.bullets.length > 0
                ? r.sections!.smartCatalog!.bullets
                : DEFAULT_LANDING_CMS_CONFIG.sections.smartCatalog.bullets,
          },
      craftStore: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.craftStore,
            visible: r.sections?.craftStore?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.craftStore,
            ...(r.sections?.craftStore || {}),
            bullets:
              Array.isArray(r.sections?.craftStore?.bullets) && r.sections!.craftStore!.bullets.length > 0
                ? r.sections!.craftStore!.bullets
                : DEFAULT_LANDING_CMS_CONFIG.sections.craftStore.bullets,
          },
      toolMaintenance: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.toolMaintenance,
            visible: r.sections?.toolMaintenance?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.toolMaintenance,
            ...(r.sections?.toolMaintenance || {}),
            bullets:
              Array.isArray(r.sections?.toolMaintenance?.bullets) && r.sections!.toolMaintenance!.bullets.length > 0
                ? r.sections!.toolMaintenance!.bullets
                : DEFAULT_LANDING_CMS_CONFIG.sections.toolMaintenance.bullets,
          },
      suppliersPromo: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.suppliersPromo,
            visible: r.sections?.suppliersPromo?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.suppliersPromo,
            ...(r.sections?.suppliersPromo || {}),
            bullets:
              Array.isArray(r.sections?.suppliersPromo?.bullets) && r.sections!.suppliersPromo!.bullets.length > 0
                ? r.sections!.suppliersPromo!.bullets
                : DEFAULT_LANDING_CMS_CONFIG.sections.suppliersPromo.bullets,
          },
      familyProfile: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.familyProfile!,
            visible: r.sections?.familyProfile?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.familyProfile!,
            ...(r.sections?.familyProfile || {}),
          },
      reviews: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.reviews,
            visible: r.sections?.reviews?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.reviews,
            ...(r.sections?.reviews || {}),
            items:
              Array.isArray(r.sections?.reviews?.items) && r.sections!.reviews!.items.length > 0
                ? r.sections!.reviews!.items
                : DEFAULT_LANDING_CMS_CONFIG.sections.reviews.items,
          },
      whatsNew: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.whatsNew,
            visible: r.sections?.whatsNew?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.whatsNew,
            ...(r.sections?.whatsNew || {}),
            items:
              Array.isArray(r.sections?.whatsNew?.items) && r.sections!.whatsNew!.items.length > 0
                ? r.sections!.whatsNew!.items
                : DEFAULT_LANDING_CMS_CONFIG.sections.whatsNew.items,
          },
      faq: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.faq,
            visible: r.sections?.faq?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.faq,
            ...(r.sections?.faq || {}),
            items:
              Array.isArray(r.sections?.faq?.items) && r.sections!.faq!.items.length > 0
                ? r.sections!.faq!.items
                : DEFAULT_LANDING_CMS_CONFIG.sections.faq.items,
          },
      finalCta: isLegacyRevision
        ? {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.finalCta,
            visible: r.sections?.finalCta?.visible ?? true,
          }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.finalCta,
            ...(r.sections?.finalCta || {}),
          },
      footer: isLegacyRevision
        ? { ...DEFAULT_LANDING_CMS_CONFIG.sections.footer }
        : {
            ...DEFAULT_LANDING_CMS_CONFIG.sections.footer,
            ...(r.sections?.footer || {}),
          },
    },
    welcomeGate: {
      ...DEFAULT_LANDING_CMS_CONFIG.welcomeGate,
      ...(r.welcomeGate || {}),
    },
    updatedAt: r.updatedAt,
  };
}

let inMemoryLandingCmsCache: LandingCmsConfig | null = null;

export function syncBrandFaviconFromCms(cfg: LandingCmsConfig): void {
  if (typeof document === 'undefined') return;
  try {
    const isDark = document.documentElement.classList.contains('dark');
    const iconSrc = isDark
      ? cfg.brandAssets?.brandIcon?.dark || cfg.brandAssets?.brandIcon?.light
      : cfg.brandAssets?.brandIcon?.light || cfg.brandAssets?.brandIcon?.dark;
    if (!iconSrc) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (link.href !== iconSrc) {
      link.href = iconSrc;
    }
  } catch {}
}

export function getStoredLandingCmsConfig(): LandingCmsConfig {
  if (typeof window === 'undefined') return inMemoryLandingCmsCache || DEFAULT_LANDING_CMS_CONFIG;
  try {
    const raw = localStorage.getItem(LANDING_CMS_STORAGE_KEY);
    if (raw) {
      const normalized = normalizeLandingCmsConfig(JSON.parse(raw));
      if (
        inMemoryLandingCmsCache?.updatedAt &&
        normalized.updatedAt &&
        new Date(inMemoryLandingCmsCache.updatedAt).getTime() >
          new Date(normalized.updatedAt).getTime()
      ) {
        return inMemoryLandingCmsCache;
      }
      inMemoryLandingCmsCache = normalized;
      return normalized;
    }
  } catch {}
  return inMemoryLandingCmsCache || DEFAULT_LANDING_CMS_CONFIG;
}

export function saveStoredLandingCmsConfig(cfg: LandingCmsConfig): LandingCmsConfig {
  const normalized = normalizeLandingCmsConfig({
    ...cfg,
    updatedAt: cfg.updatedAt || new Date().toISOString(),
  });
  inMemoryLandingCmsCache = normalized;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LANDING_CMS_STORAGE_KEY, JSON.stringify(normalized));
    } catch (storageErr) {
      console.warn('[LandingCMS] localStorage write warning (using memory cache):', storageErr);
    }
    syncBrandFaviconFromCms(normalized);
    try {
      window.dispatchEvent(new CustomEvent('alshams_landing_cms_updated', { detail: normalized }));
    } catch {}
  }
  return normalized;
}
