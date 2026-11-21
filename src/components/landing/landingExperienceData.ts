export type LandingLocale = 'ar' | 'en';

export type DiscoveryRoleId = 'artisan' | 'supplier' | 'customer' | 'beginner' | 'expert';

export type SupplierBusinessTypeId =
  | 'single_shop'
  | 'branch_chain'
  | 'wholesaler'
  | 'retailer'
  | 'factory_importer';

export type SupplierSuiteTabId = 'branches' | 'pos' | 'finance_hr' | 'customers_store';

export interface DiscoverySubOption {
  id: string;
  label: string;
  shortHint: string;
  recommendedSummary: string;
  highlightedBullets: string[];
}

export interface ProductJourneyStep {
  stepNumber: string;
  shortLabel: string;
  title: string;
  description: string;
  moduleName: string;
  outcome: string;
}

export interface SimulatorScenario {
  id: 'shamousa_or' | 'falcon_macrame' | 'falcon_soap' | 'shamousa_summary' | 'shamousa_stock';
  tabLabel: string;
  userQuery: string;
  speakerKind: 'falcon' | 'shamousa';
  badge?: string;
  replyTitle: string;
  bullets: string[];
  actionNote: string;
}

export interface LandingExperienceCopy {
  nav: { id: string; label: string; href: string }[];
  header: {
    login: string;
    startJourney: string;
    openMenu: string;
    closeMenu: string;
    themeLight: string;
    themeDark: string;
    welcomeGateShort: string;
    marketsQuickTitle: string;
    alshamsMarket: string;
    suppliersMarket: string;
  };
  hero: {
    eyebrow: string;
    headlineLine1: string;
    headlineHighlight: string;
    description: string;
    companionLine: string;
    ctaDiscoverRole: string;
    ctaEnterWorld: string;
    ctaStartJourney: string;
    trustLine: string[];
    welcomeGateLink: string;
    visualCaptionTop: string;
    visualCaptionBottomTitle: string;
    visualCaptionBottomSub: string;
    falconCaption: string;
    shamousaCaption: string;
    pillars: { id: string; badge: string; title: string; detail: string }[];
  };
  discovery: {
    eyebrow: string;
    questionTitle: string;
    questionSubtitle: string;
    step1Label: string;
    step2Label: string;
    changeRoleBtn: string;
    allRolesBtn: string;
    roles: {
      id: DiscoveryRoleId;
      title: string;
      shortDesc: string;
      badge: string;
    }[];
    artisan: {
      headline: string;
      intro: string;
      subQuestion: string;
      cycleStrip: string[];
      subOptions: DiscoverySubOption[];
      allCapabilitiesTitle: string;
      allCapabilities: string[];
      storeNote: string;
      primaryCta: string;
      secondaryCta: string;
    };
    supplier: {
      headline: string;
      intro: string;
      businessTypeQuestion: string;
      businessTypes: {
        id: SupplierBusinessTypeId;
        label: string;
        tailoredNote: string;
      }[];
      suitePrompt: string;
      suites: {
        id: SupplierSuiteTabId;
        label: string;
        title: string;
        summary: string;
        items: string[];
      }[];
      posCustodyTitle: string;
      posCustodySteps: string[];
      customerTypesTitle: string;
      customerTypes: { title: string; desc: string }[];
      storeRelationNote: string;
      primaryCta: string;
      secondaryMarketCta: string;
    };
    customer: {
      headline: string;
      intro: string;
      subQuestion: string;
      subOptions: DiscoverySubOption[];
      highlights: string[];
      primaryMarketCta: string;
      secondarySuppliersCta: string;
      loginCta: string;
      marketDisabledNote: string;
    };
    beginner: {
      headline: string;
      intro: string;
      subQuestion: string;
      subOptions: DiscoverySubOption[];
      highlights: string[];
      primaryCta: string;
      secondaryCta: string;
    };
    expert: {
      headline: string;
      intro: string;
      subQuestion: string;
      subOptions: DiscoverySubOption[];
      highlights: string[];
      primaryCta: string;
      secondaryCta: string;
    };
  };
  marketsSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cycleTitle: string;
    cycleNodes: {
      id: 'supplier' | 'artisan' | 'customer';
      step: string;
      role: string;
      title: string;
      detail: string;
    }[];
    alshamsMarket: {
      badge: string;
      title: string;
      tagline: string;
      bullets: string[];
      cta: string;
      liveBadge: string;
      emptyNote: string;
      disabledNote: string;
    };
    suppliersMarket: {
      badge: string;
      title: string;
      tagline: string;
      bullets: string[];
      cta: string;
      portalCta: string;
      liveBadge: string;
      viewSupplier: string;
      emptyNote: string;
      disabledNote: string;
    };
  };
  familySection: {
    eyebrow: string;
    title: string;
    tagline: string;
    description: string;
    elements: { id: string; title: string; desc: string }[];
    genderPrompt: string;
    genderMale: string;
    genderFemale: string;
    ctaEnterFamily: string;
    ctaNote: string;
  };
  heroesSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    falcon: {
      name: string;
      role: string;
      tagline: string;
      description: string;
      workflowTitle: string;
      workflowSteps: string[];
      footnote: string;
    };
    shamousa: {
      name: string;
      role: string;
      tagline: string;
      description: string;
      orBadge: string;
      orTitle: string;
      orPillars: { title: string; desc: string }[];
      footnote: string;
    };
    materials: {
      name: string;
      role: string;
      tagline: string;
      description: string;
      bullets: string[];
      note: string;
      codeLabel: string;
      codeParts: { code: string; label: string; colorClass: string }[];
    };
    workbench: {
      title: string;
      subtitle: string;
      tabSimulator: string;
      tabSummary: string;
      simulatorCta: string;
      summaryTitle: string;
      summarySubtitle: string;
      summaryWorkshopTab: string;
      summarySupplierTab: string;
      summaryCta: string;
    };
  };
  journeySection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    activeStepLabel: string;
    moduleLabel: string;
    outcomeLabel: string;
    prevStep: string;
    nextStep: string;
    ctaStartFirstProduct: string;
    steps: ProductJourneyStep[];
  };
  whySection: {
    eyebrow: string;
    title: string;
    manifesto: string;
    subtitle: string;
    pillars: { id: string; title: string; desc: string }[];
  };
  reviewsSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    feedbackCta: string;
  };
  faqSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  closing: {
    eyebrow: string;
    headline: string;
    body: string;
    familyStatement: string;
    threadLine: string;
    luxuryLine: string;
    primaryCta: string;
    secondaryCta: string;
  };
  footer: {
    quickLinksTitle: string;
    marketsTitle: string;
    experienceTitle: string;
    welcomeGateBtn: string;
    loginBtn: string;
    registerBtn: string;
    feedbackBtn: string;
  };
  feedbackModal: {
    title: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    craftLabel: string;
    craftPlaceholder: string;
    ratingLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    contactLabel: string;
    contactPlaceholder: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    errorBody: string;
  };
  simulatorScenarios: SimulatorScenario[];
}

export const LANDING_COPY: Record<LandingLocale, LandingExperienceCopy> = {
  ar: {
    nav: [
      { id: 'guided-discovery', label: 'اعرف مكانك', href: '#guided-discovery' },
      { id: 'markets', label: 'الأسواق', href: '#markets' },
      { id: 'family-table', label: 'طبلية العيلة', href: '#family-table' },
      { id: 'platform-heroes', label: 'أبطال الشمساوية', href: '#platform-heroes' },
      { id: 'product-journey', label: 'رحلة المنتج', href: '#product-journey' },
    ],
    header: {
      login: 'دخول',
      startJourney: 'ابدأ رحلتك',
      openMenu: 'فتح القائمة',
      closeMenu: 'إغلاق القائمة',
      themeLight: 'الوضع النهاري',
      themeDark: 'الوضع الليلي',
      welcomeGateShort: 'بوابة الترحيب والنشيد',
      marketsQuickTitle: 'الأسواق المتاحة الآن',
      alshamsMarket: 'سوق الشمساوية',
      suppliersMarket: 'سوق الموردين',
    },
    hero: {
      eyebrow: 'منظومة الشمساوية · اقتصاد ومجتمع الحرف اليدوية المتكامل',
      headlineLine1: 'مش لازم تكون كبير علشان تبدأ كبير...',
      headlineHighlight: 'المهم تلاقي اللي يقف في ضهرك.',
      description:
        'من أول فكرة صغيرة، لحد ورشة ناجحة، ومتجر، وسوق، ومجتمع كامل... الشمساوية معاك في كل خطوة.',
      companionLine: 'إحنا في ضهرك... وكل واحد ليه مكان في عيلة الشمساوية.',
      ctaDiscoverRole: 'اعرف مكانك في الشمساوية',
      ctaEnterWorld: 'ادخل عالم الشمساوية',
      ctaStartJourney: 'ابدأ رحلتك الآن',
      trustLine: [
        'إدارة كاملة للورش والموردين والفروع',
        'صقر للتكاليف وشموسة ببحوث العمليات (OR)',
        'سوق الشمساوية + طبلية العيلة',
      ],
      welcomeGateLink: 'شغّل بوابة الترحيب ونشيد الشمساوية',
      visualCaptionTop: 'منظومة الشمساوية · حيث تلتقي الحِرفة بالتكنولوجيا',
      visualCaptionBottomTitle: 'الفنان والورشة والمورد والعميل والمبتدئ والخبير... في منظومة واحدة مترابطة',
      visualCaptionBottomSub: 'معاك صقر الشمساوية للتحليل والتسعير، وشموسة للإدارة الذكية وبحوث العمليات',
      falconCaption: 'صقر الشمساوية',
      shamousaCaption: 'شموسة · إدارة و OR',
      pillars: [
        {
          id: 'p1',
          badge: 'للفنانين والورش',
          title: 'مساحة إدارة وإنتاج مستقلة',
          detail: 'من الخامات وحاسبة التكاليف وأوامر التشغيل حتى الخزينة والمتجر الشخصي.',
        },
        {
          id: 'p2',
          badge: 'للموردين والتجار والمصانع',
          title: 'نظام فروع وكاشير POS ومخازن',
          detail: 'إدارة الفروع والورديات والمحاسب والتوريد والاعتماد ومتجر المورد المستقل.',
        },
        {
          id: 'p3',
          badge: 'صقر وشموسة والخامات',
          title: 'ذكاء عملي وبحوث عمليات OR',
          detail: 'تحليل صور المنتجات، تخطيط الإنتاج والمخزون الأمثل، وموسوعة خامات موحدة.',
        },
        {
          id: 'p4',
          badge: 'المجتمع والأسواق',
          title: 'طبلية العيلة والأسواق المترابطة',
          detail: 'تعلّم وتبادل خبرة ودروس خبراء مع وصول حقيقي للجمهور والعملاء.',
        },
      ],
    },
    discovery: {
      eyebrow: '01 · تجربة اكتشاف الزائر — Guided Discovery',
      questionTitle: 'عرفنا بنفسك... إنت جاي الشمساوية بصفتك إيه؟',
      questionSubtitle:
        'اختر دورك الآن، وهنوضحلك خطوة بخطوة إزاي الشمساوية بتساعدك فعلياً، وتقدر ترجع وتغيّر اختيارك في أي وقت.',
      step1Label: 'الخطوة 1: اختر صفتك',
      step2Label: 'الخطوة 2: خصّص رحلتك داخل المنظومة',
      changeRoleBtn: 'تغيير الصفة / الرجوع للاختيارات',
      allRolesBtn: 'تصفح كل الأدوار',
      roles: [
        {
          id: 'artisan',
          badge: 'مساحة عمل وإنتاج كاملة',
          title: 'فنان أو صاحب ورشة',
          shortDesc: 'إدارة الورشة والخامات والتكاليف والإنتاج والمبيعات ومتجرك الخاص.',
        },
        {
          id: 'supplier',
          badge: 'نظام تجاري وفروع و POS',
          title: 'مورد أو تاجر أو صاحب مصنع',
          shortDesc: 'إدارة الفروع والمخازن والكاشير والورديات والحسابات ومتجر الخامات.',
        },
        {
          id: 'customer',
          badge: 'منتجات أصلية ومباشرة',
          title: 'عميل يبحث عن منتجات مميزة',
          shortDesc: 'تصفح سوق الشمساوية ومتاجر الفنانين المستقلة واكتشف شغل يدوي أصيل.',
        },
        {
          id: 'beginner',
          badge: 'تعلّم ونمو خطوة بخطوة',
          title: 'مبتدئ أو صاحب موهبة',
          shortDesc: 'اكتشف الحرف وتعلّم من الخبراء وحوّل موهبتك إلى مهارة وإنتاج.',
        },
        {
          id: 'expert',
          badge: 'مشاركة المعرفة والتوجيه',
          title: 'خبير أو مدرب في الحرف اليدوية',
          shortDesc: 'قدّم دروسك وشروحاتك وشارك خبرتك العملية مع مجتمع الحرفيين.',
        },
      ],
      artisan: {
        headline: 'مساحة مستقلة تدير بيها ورشتك من أول شراء الخامة... لحد البيع والتحصيل',
        intro:
          'في الشمساوية، كل فنان أو صاحب ورشة له مساحة عمل مستقلة ولوحة تحكم خاصة ومتجر شخصي، يقدر من خلالها يدير دورة شغله بالكامل بوضوح وانضباط.',
        subQuestion: 'إيه أكتر جزء حابب تبدأ تظبّطه في ورشتك دلوقتي؟',
        cycleStrip: [
          'شراء الخامات والمخازن',
          'حاسبة التكاليف وصقر',
          'أوامر التشغيل والإنتاج',
          'الكتالوج والمتجر والبيع',
          'الفواتير والتحصيل والخزينة',
        ],
        subOptions: [
          {
            id: 'costing_materials',
            label: 'الخامات وحاسبة التكاليف',
            shortHint: 'تسعير عادل بدون خسارة أو تخمين',
            recommendedSummary:
              'ابني قاعدة خاماتك من موسوعة الخامات الموحدة، وحلل منتجك مع صقر الشمساوية، وراجع التكلفة والهالك والمصنعية في حاسبة التكاليف قبل اعتماد السعر.',
            highlightedBullets: [
              'إدارة الخامات والمخازن بأسعارك ووحداتك الفعلية',
              'حاسبة تكاليف المنتجات مع مراقبة التكاليف (Cost Control)',
              'مساعد صقر الشمساوية لتحليل صور المنتجات وتقدير الاستهلاك',
            ],
          },
          {
            id: 'production_team',
            label: 'التشغيل والإنتاج وفريق العمل',
            shortHint: 'تنظيم أوامر الشغل والعمالة والوقت',
            recommendedSummary:
              'حوّل الطلبات إلى أوامر تشغيل واضحة، وتابع العمالة والحرفيين والموارد البشرية، وخلي شموسة تساعدك بنظام بحوث العمليات (OR) لترتيب أولويات الإنتاج.',
            highlightedBullets: [
              'أوامر التشغيل والإنتاج ومتابعة التنفيذ خطوة بخطوة',
              'إدارة العمالة والحرفيين وفريق العمل والموارد البشرية (HR)',
              'مساعد شموسة الذكي ببيانات الورشة وتخطيط الإنتاج والمخزون',
            ],
          },
          {
            id: 'sales_finance',
            label: 'المبيعات والعملاء والخزينة والحسابات',
            shortHint: 'فواتير وتحصيلات وشجرة حسابات واضحة',
            recommendedSummary:
              'نظّم عملاءك ومبيعاتك وفواتيرك وتحصيلاتك ومصروفاتك وخزائنك وعُهدك في مكان واحد، مع تقارير واضحة وشجرة حسابات منظمة بدون تعقيد.',
            highlightedBullets: [
              'إدارة العملاء والمبيعات و CRM وإدارة علاقات العملاء',
              'الفواتير والتحصيلات والمصروفات والخزائن والعهد',
              'الحسابات والتقارير المالية وشجرة الحسابات المتكاملة',
            ],
          },
          {
            id: 'full_workshop',
            label: 'كل المنظومة المتكاملة + متجري الخاص',
            shortHint: 'دورة عمل كاملة من الخامة للجمهور',
            recommendedSummary:
              'ادير ورشتك كمنظومة احترافية متكاملة: من الموردين والمشتريات للخامات والتسعير والإنتاج، وحتى الكتالوج ومتجرك الشخصي داخل المنظومة.',
            highlightedBullets: [
              'مساحة عمل مستقلة ولوحة تحكم خاصة لكل فنان أو ورشة',
              'إدارة الموردين والمشتريات والمنتجات والكتالوج والأرشيف',
              'إنشاء متجرك الخاص داخل المنظومة والوصول لجمهورك مباشرة',
            ],
          },
        ],
        allCapabilitiesTitle: 'كل الوحدات المتاحة داخل مساحة الفنان وصاحب الورشة:',
        allCapabilities: [
          'مساحة عمل مستقلة ولوحة تحكم خاصة',
          'إدارة الخامات والمخازن',
          'إدارة الموردين والمشتريات',
          'إدارة المنتجات والكتالوج',
          'حاسبة تكاليف المنتجات',
          'أوامر التشغيل والإنتاج',
          'إدارة العمالة والحرفيين',
          'إدارة العملاء والمبيعات',
          'الفواتير والتحصيلات',
          'المصروفات والخزائن والعهد',
          'الحسابات والتقارير وشجرة الحسابات',
          'إدارة فريق العمل والموارد البشرية (HR)',
          'CRM وإدارة علاقات العملاء',
          'Cost Control ومراقبة التكاليف',
          'مساعد صقر الشمساوية',
          'مساعد شموسة (مدعوم ببحوث العمليات OR)',
        ],
        storeNote:
          'لكل فنان أو ورشة مساحة مستقلة بالكامل، مع إمكانية إنشاء متجر شخصي برابط خاص والظهور في سوق الشمساوية وفق اختيارك واعتمادك.',
        primaryCta: 'افتح مساحة ورشتك الآن',
        secondaryCta: 'تسجيل الدخول لورشتك',
      },
      supplier: {
        headline: 'نظام إدارة تجاري وتشغيلي متكامل للمورد والتاجر وصاحب المصنع... وليس مجرد كتالوج',
        intro:
          'سواء كنت بتدير محل واحد أو سلسلة فروع ومخازن أو تجارة جملة أو مصنع خامات، الشمساوية بتديك منظومة ERP و POS ومتجر مستقل مترابطة بالكامل.',
        businessTypeQuestion: 'أولاً: إيه طبيعة نشاطك التجاري؟',
        businessTypes: [
          {
            id: 'single_shop',
            label: 'محل واحد',
            tailoredNote:
              'تنظيم كامل لمخزون المحل، كاشير POS سريع بخصم تلقائي من المخزون، متابعة الورديات والخزينة، ومتجر إلكتروني يعرض خاماتك للورش.',
          },
          {
            id: 'branch_chain',
            label: 'سلسلة فروع ومحلات',
            tailoredNote:
              'لوحة تحكم مركزية لصاحب النشاط + إدارة مستقلة لكل فرع + مخزن رئيسي ومخازن فروع + تحويلات مخزنية موثقة + رقابة كاملة على ورديات وتوريدات كل فرع.',
          },
          {
            id: 'wholesaler',
            label: 'تاجر جملة',
            tailoredNote:
              'إدارة المصانع والتجار والمشتريات، تصنيف العملاء (ورش وتجار جملة وعملاء خارجيين)، متابعة الأرصدة والآجل والتحصيلات، والربط المباشر مع الورش الأعضاء.',
          },
          {
            id: 'retailer',
            label: 'تاجر تجزئة',
            tailoredNote:
              'كاشير POS سريع لتسجيل المبيعات والخصم الفوري من مخزون الفرع، إغلاق الورديات ومراجعة المحاسب، ومراقبة أرباح ومصروفات كل يوم.',
          },
          {
            id: 'factory_importer',
            label: 'مصنع أو مورد خامات',
            tailoredNote:
              'إدارة المخزن الرئيسي والتوزيع للفروع والعملاء، Cost Control وشجرة حسابات، ومتجر مورد مستقل يوصّل خاماتك مباشرة للفنانين والورش داخل المنظومة.',
          },
        ],
        suitePrompt: 'استكشف منظومة إدارة المورد بالتفصيل:',
        suites: [
          {
            id: 'branches',
            label: 'إدارة النشاط والفروع والمخازن',
            title: 'رقابة كاملة على المخزن الرئيسي والفروع والمشتريات',
            summary: 'تابع كل قطعة وجرام وقيمة مخزون في المخزن الرئيسي وجميع الفروع من شاشة واحدة.',
            items: [
              'لوحة تحكم مركزية لصاحب النشاط',
              'إدارة كل فرع بصورة مستقلة',
              'مخزن رئيسي + مخازن الفروع',
              'تحويلات المخزون بين المخازن والفروع',
              'متابعة أرصدة وكميات وقيم المخزون',
              'إدارة المصانع والتجار الذين يشتري منهم المورد',
              'تسجيل المشتريات ودخولها للمخزون مباشرة',
            ],
          },
          {
            id: 'pos',
            label: 'نظام الكاشير POS والورديات',
            title: 'دورة بيع ووردية وتوريد محكمة... بدون جنيه أو صنف يضيع',
            summary: 'من لحظة البيع على الكاشير لحد اعتماد صاحب النشاط إيداع الحصيلة في خزينته.',
            items: [
              'تسجيل المبيعات وخصم الكميات من مخزون الفرع تلقائياً',
              'تسجيل الورديات ومتابعة حركة الكاشير لحظة بلحظة',
              'إغلاق الوردية وتسليم الحصيلة للمحاسب',
              'مراجعة المحاسب وإغلاق الوردية رسمياً',
              'طلب التوريد عند الحاجة للخزينة الرئيسية',
              'اعتماد صاحب النشاط قبل اعتبار الأموال مودعة نهائياً في خزينته',
            ],
          },
          {
            id: 'finance_hr',
            label: 'المالية والـ HR والـ CRM والمحاسبة',
            title: 'إدارة مالية وتجارية وفريق عمل على مستوى الشركات',
            summary: 'كل الأدوات المحاسبية والإدارية اللي بتخلي تجارتك تكبر على أرض ثابتة.',
            items: [
              'حسابات الفروع والخزائن والعهد',
              'المشتريات والمبيعات والمصروفات والأرباح والتقارير',
              'إدارة العملاء وتصنيفهم + متابعة الموردين والمصانع',
              'إدارة فريق العمل والموارد البشرية (HR)',
              'نظام إدارة علاقات العملاء (CRM)',
              'مراقبة التكاليف (Cost Control) وشجرة الحسابات',
            ],
          },
          {
            id: 'customers_store',
            label: 'عملاء المورد ومتجره وسوق الموردين',
            title: 'متجرك المستقل ورابطك الخاص + وصول مباشر للورش والفنانين',
            summary: 'تتعامل بمرونة مع كل شرائح عملائك من نظام واحد منظم.',
            items: [
              'متجر مستقل ورابط خاص لعرض خاماتك ومنتجاتك واستقبال الطلبات',
              'ربط مباشر بين سوق الموردين والفنانين والورش الأعضاء في المنظومة',
              'تسهيل وصول الورش لاحتياجاتها من الخامات والشراء منك بوضوح',
              'توحيد كل المبيعات سواء من المحل أو المتجر أو عملاء المنظومة في حساباتك',
            ],
          },
        ],
        posCustodyTitle: 'سلسلة الأمان المالي للوردية (دورة التسليم والاعتماد):',
        posCustodySteps: [
          'بيع POS وخصم مخزون الفرع تلقائياً',
          'إغلاق الوردية وتسليم الحصيلة للمحاسب',
          'مراجعة المحاسب وإغلاق الوردية',
          'طلب التوريد للخزينة',
          'اعتماد صاحب النشاط للإيداع النهائي',
        ],
        customerTypesTitle: 'يتعامل المورد من نفس النظام مع 3 أنواع من العملاء:',
        customerTypes: [
          { title: 'عملاء خارجيون', desc: 'عملاء المحل والفروع والبيع المباشر اليومي.' },
          { title: 'عملاء متجر الشمساوية', desc: 'عملاء يتصفحون ويطلبون من رابط متجرك المستقل.' },
          { title: 'فنانون وورش المنظومة', desc: 'أعضاء الشمساوية الباحثون عن خامات ومستلزمات لإنتاجهم.' },
        ],
        storeRelationNote:
          'لكل مورد متجر مستقل ورابط خاص يعرض من خلاله الخامات والمنتجات المتاحة ويستقبل الطلبات، بما يربط المورد مباشرة باحتياجات الفنانين والورش داخل المنظومة.',
        primaryCta: 'ابدأ مساحة المورد والتاجر الآن',
        secondaryMarketCta: 'تصفح سوق الموردين',
      },
      customer: {
        headline: 'ادخل عالم المنتجات اليدوية الأصلية... مباشرة من إيد الفنان والورشة',
        intro:
          'في الشمساوية مش بتشتري من متجر تقليدي مجهول؛ هنا بتكتشف قطعاً مصنوعة بشغف من فنانين حقيقيين، وتقدر تتصفح متجر كل ورشة وتعرف تفاصيل المنتج بوضوح.',
        subQuestion: 'بتدور على إيه النهارده في الشمساوية؟',
        subOptions: [
          {
            id: 'handmade_products',
            label: 'منتجات يدوية من سوق الشمساوية',
            shortHint: 'ديكور، إكسسوارات، هدايا، جلود، شموع، مكرمية وغيرها',
            recommendedSummary:
              'تصفح سوق الشمساوية المفتوح مباشرة بدون خطوات معقدة، واكتشف أعمال الفنانين والورش المعتمدة مع تفاصيل كل منتج وطرق الطلب المتاحة.',
            highlightedBullets: [
              'تصفح مباشر لمنتجات الفنانين والورش المصنوعة يدوياً',
              'عرض واضح لتفاصيل المنتج والسعر والورشة الصانعة',
              'وصول مباشر إلى متجر الفنان المستقل لتصفح باقي أعماله',
            ],
          },
          {
            id: 'artisan_stores',
            label: 'استكشاف متاجر الفنانين المستقلة',
            shortHint: 'تابع أسلوب كل فنان وورشة بهويتها الخاصة',
            recommendedSummary:
              'كل فنان في الشمساوية له متجره المستقل بهويته وأعماله؛ ادخل سوق الشمساوية واضغط على أي منتج للانتقال مباشرة لمتجر الورشة.',
            highlightedBullets: [
              'متاجر مستقلة بهوية كل فنان وورشة',
              'منتجات أصلية بتصنيع يدوي حقيقي وجودة واضحة',
              'سهولة التواصل والطلب وفق طرق الشراء المتاحة في المتجر',
            ],
          },
          {
            id: 'raw_materials',
            label: 'خامات ومستلزمات حرفية',
            shortHint: 'خامات وأدوات لمن يبحث عن مستلزمات الشغل اليدوي',
            recommendedSummary:
              'تقدر أيضاً تتعرف على الخامات والمنتجات المتاحة لدى الموردين والتجار داخل المنظومة عند تفعيل سوق الموردين أو عبر متاجرهم.',
            highlightedBullets: [
              'تنظيم واضح للخامات والأدوات والمستلزمات',
              'وصول مباشر لمتاجر الموردين المتاحة حسب محافظتك',
              'تجربة واضحة تجمع بين المنتج النهائي ومصدر خاماته',
            ],
          },
        ],
        highlights: [
          'اكتشاف سوق الشمساوية وتصفح منتجات الفنانين والورش',
          'الوصول إلى متاجر الفنانين المستقلة وتفاصيل المنتجات',
          'الاستفادة من سوق الموردين للخامات والمستلزمات عند الحاجة',
        ],
        primaryMarketCta: 'تصفح سوق الشمساوية الآن',
        secondarySuppliersCta: 'استكشف سوق الموردين',
        loginCta: 'دخول لحسابك',
        marketDisabledNote: 'سوق العرض العام يخضع لإعدادات التفعيل من الإدارة حالياً — يمكنك تسجيل الدخول أو إنشاء حساب لمتابعة التحديثات.',
      },
      beginner: {
        headline: 'الشمساوية مش للبيع والشراء بس... دي مساحتك علشان تتعلم وتكبر خطوة بخطوة',
        intro:
          'لو عندك موهبة أو شغف بالحرف اليدوية ولسه في أول الطريق، هنا هتلاقي اللي يعلمك ويفتحلك الباب لحد ما تنتج وتبدأ نشاطك المستقل بثقة.',
        subQuestion: 'إنت في أي خطوة في رحلتك دلوقتي؟',
        subOptions: [
          {
            id: 'explore_crafts',
            label: 'لسه بتعرف على الحرف والمجالات',
            shortHint: 'اكتشف عالم الحرف اليدوية وتابع أعمال الفنانين',
            recommendedSummary:
              'انضم لطبلية العيلة وتابع أعمال الفنانين وشروحات الخبراء لتكتشف الحرفة الأقرب لموهبتك وتفهم خاماتها وأساسياتها.',
            highlightedBullets: [
              'التعرف على الحرف اليدوية والمجالات المختلفة داخل المنظومة',
              'متابعة أعمال الفنانين والورش الحقيقية في المجتمع',
              'التعرف على الخامات وأسمائها من خلال موسوعة الخامات الموحدة',
            ],
          },
          {
            id: 'learn_from_experts',
            label: 'عندي موهبة وعايز أتعلم من الخبراء',
            shortHint: 'دروس وشروحات وتفاعل داخل طبلية العيلة',
            recommendedSummary:
              'احصل على وصول للدروس والشروحات المنشورة من خبراء ومدربي الشمساوية، وشارك أسئلتك وتجاربك مع العيلة لتطوير مهارتك تدريجياً.',
            highlightedBullets: [
              'الوصول إلى الدروس والشروحات المدمجة داخل المنصة',
              'التعلم المباشر من الخبراء والمدربين وتبادل الخبرة',
              'تحديد مستواك المهني والتدرج في الرتب مع تطور مهاراتك',
            ],
          },
          {
            id: 'start_small_business',
            label: 'جاهز أحوّل موهبتي لإنتاج ونشاط مستقل',
            shortHint: 'من أول قطعة مسعّرة صح لحد ورشتك الخاصة',
            recommendedSummary:
              'ابدأ بتسعير أول منتج ليك بمساعدة صقر وحاسبة التكاليف عشان ما تخسرش، وخطوة بخطوة ابني كتالوجك ومتجرك الشخصي.',
            highlightedBullets: [
              'الانتقال السلس من مرحلة التعلم إلى الإنتاج الفعلي',
              'تسعير عادل لأول قطعة بدون أخطاء البدايات',
              'إنشاء مساحتك ونشاطك المستقل داخل نفس المنظومة',
            ],
          },
        ],
        highlights: [
          'التعرف على الحرف اليدوية والمجالات المختلفة',
          'الوصول إلى الدروس والشروحات والتعلم من الخبراء والمدربين',
          'متابعة أعمال الفنانين والمشاركة في طبلية العيلة',
          'الانتقال التدريجي من التعلم إلى الإنتاج وإنشاء نشاط مستقل',
        ],
        primaryCta: 'ابدأ رحلتك كمبتدئ الآن',
        secondaryCta: 'استكشف طبلية العيلة والرتب',
      },
      expert: {
        headline: 'خبرتك العملية قيمة حقيقية... شاركها مع جيل جديد من الحرفيين والفنانين',
        intro:
          'في الشمساوية، للخبير والمدرب مكانته الواضحة داخل مجتمع طبلية العيلة؛ يشارك دروسه وشروحاته وأعماله ويبني حضوراً مهنياً مؤثراً.',
        subQuestion: 'إزاي حابب تشارك خبرتك داخل مجتمع الشمساوية؟',
        subOptions: [
          {
            id: 'publish_lessons',
            label: 'تقديم الشروحات والدروس',
            shortHint: 'انشر دروسك لتُشاهد داخل المنصة وتصل لأعضاء العيلة',
            recommendedSummary:
              'بعد تحديد رتبتك كخبير/خبيرة، تُفتح لك مساحة نشر الشروحات والدروس المدمجة داخل المنصة لتظهر باسمك في طبلية العيلة.',
            highlightedBullets: [
              'تقديم الشروحات والدروس المرتبطة بملفك الشخصي',
              'عرض الدروس داخل المنصة بأسلوب مريح للمتعلمين',
              'وصول الشروحات لأعضاء طبلية العيلة والمهتمين بالحرف',
            ],
          },
          {
            id: 'share_experience',
            label: 'مشاركة الأعمال والخبرات العملية',
            shortHint: 'معرض أعمالك وتجاربك الواقعية في الصنعة',
            recommendedSummary:
              'اعرض أبرز أعمالك وتجاربك العملية في صفحتك الشخصية ومعرض الأعمال، وشارك نصائحك وتوجيهاتك في منشورات طبلية العيلة.',
            highlightedBullets: [
              'نشر الأعمال والتجارب العملية في ملفك الشخصي',
              'التفاعل المباشر والإجابة على تساؤلات الحرفيين والمبتدئين',
              'مشاركة خبرات الخامات والتشطيب والتسعير السليم',
            ],
          },
          {
            id: 'professional_presence',
            label: 'بناء حضور مهني كخبير / خبيرة',
            shortHint: 'رتبة مهنية واضحة داخل مجتمع الحرفيين',
            recommendedSummary:
              'تُحدد رتبتك المهنية تلقائياً (خبير أو خبيرة) بوضوح في ملفك ومنشوراتك ودروسك، مع كامل أدوات إدارة ورشتك ومتجرك إن كنت تنتج أيضاً.',
            highlightedBullets: [
              'بناء حضور مهني موثق داخل مجتمع الحرفيين والفنانين',
              'التواصل المباشر مع المهتمين بالحرف اليدوية والورش',
              'الجمع بين دورك كخبير وإدارة ورشتك أو متجرك في مكان واحد',
            ],
          },
        ],
        highlights: [
          'تقديم الشروحات والدروس المتاحة داخل المنصة',
          'مشاركة الخبرات العملية ونشر الأعمال والتجارب',
          'بناء حضور مهني واضح داخل طبلية العيلة والتواصل مع المهتمين',
        ],
        primaryCta: 'انضم كخبير / خبيرة في العيلة',
        secondaryCta: 'استعرض نظام الرتب في طبلية العيلة',
      },
    },
    marketsSection: {
      eyebrow: '02 · سوق الشمساوية وسوق الموردين',
      title: 'سوقان مترابطان يصنعان دورة اقتصادية حقيقية للحِرفة',
      subtitle:
        'في الشمساوية، الترابط بين المورد والفنان والعميل ليس مجرد فكرة؛ بل دورة عمل كاملة تخدم كل طرف وتحفظ قيمته.',
      cycleTitle: 'كيف يعمل الترابط بين السوقين؟ (اضغط على أي طرف في الدورة)',
      cycleNodes: [
        {
          id: 'supplier',
          step: '01',
          role: 'المورد والتاجر والمصنع',
          title: 'يوفر الخامات والأدوات والمستلزمات',
          detail:
            'يعرض خاماته ومنتجاته عبر متجره المستقل وسوق الموردين، فتصل الورش والفنانون لما يحتاجونه بوضوح وسرعة.',
        },
        {
          id: 'artisan',
          step: '02',
          role: 'الفنان وصاحب الورشة',
          title: 'يحوّل الخامات إلى منتجات يدوية أصلية',
          detail:
            'يدير ورشته ويسعّر منتجاته بدقة، ثم ينشرها في متجره الشخصي ويظهر في سوق الشمساوية العام.',
        },
        {
          id: 'customer',
          step: '03',
          role: 'العميل ومحبو الحِرفة',
          title: 'يكتشف ويشتري المنتج النهائي الأصيل',
          detail:
            'يتصفح سوق الشمساوية ومتاجر الفنانين المستقلة ليصل لمنتجات حقيقية مصنوعة بإتقان ويطلبها مباشرة.',
        },
      ],
      alshamsMarket: {
        badge: 'السوق الأول · المنتجات اليدوية',
        title: 'سوق الشمساوية',
        tagline: 'سوق لمنتجات الفنانين والحرفيين والورش — مع متجر مستقل لكل فنان',
        bullets: [
          'كل فنان يعرض أعماله من خلال متجره الشخصي المستقل ورابطه الخاص',
          'ظهور المنتجات المعتمدة في السوق العام للوصول لعملاء جدد',
          'تصفح مباشر للمنتجات الحقيقية وتفاصيل كل ورشة',
        ],
        cta: 'استكشف سوق الشمساوية',
        liveBadge: 'معروض الآن من سوق الشمساوية',
        emptyNote: 'اضغط للانتقال مباشرة إلى سوق الشمساوية وتصفح المتاجر والأعمال المتاحة.',
        disabledNote: 'سوق الشمساوية غير مفعّل للعرض العام حالياً من إعدادات الإدارة.',
      },
      suppliersMarket: {
        badge: 'السوق الثاني · الخامات والمستلزمات',
        title: 'سوق الموردين',
        tagline: 'سوق الخامات والأدوات التي يعرضها الموردون والتجار والمصانع للورش والفنانين',
        bullets: [
          'متجر مستقل لكل مورد يعرض خاماته وأدواته بوضوح',
          'يساعد الفنانين والورش على الوصول لاحتياجاتهم وشرائها من داخل المنظومة',
          'يربط الموردين بعملاء جدد من الورش والمهتمين بالحرف اليدوية',
        ],
        cta: 'استكشف سوق الموردين',
        portalCta: 'سجّل نشاطك في بوابة الموردين',
        liveBadge: 'موردون متاحون في سوق الموردين',
        viewSupplier: 'عرض المتجر',
        emptyNote: 'اضغط لاستعراض الموردين وتجار الخامات المسجلين في سوق الموردين.',
        disabledNote:
          'تصفح سوق الموردين العام قيد التفعيل المرحلي من الإدارة حالياً — بينما بوابة إدارة نشاط المورد والفروع والكاشير متاحة للتسجيل والعمل.',
      },
    },
    familySection: {
      eyebrow: '03 · طبلية العيلة — مجتمع الشمساوية',
      title: 'طبلية العيلة... مجتمع مهني وإنساني حي لأصحاب الحرف والفنون',
      tagline: 'هنا مش منتدى تقليدي... هنا عيلة بتتعرّف، تتعلم، تتبادل الخبرة، وتكبر سوا.',
      description:
        'الجانب الإنساني والاجتماعي لمنظومة الشمساوية؛ مساحة تجمع الفنان والمبتدئ والمورد والخبير حول طبلية واحدة للتواصل والتعلم وعرض الأعمال ومتابعة التطور.',
      elements: [
        {
          id: 'profiles',
          title: 'صفحات شخصية للأعضاء',
          desc: 'ملف مهني يعرّف بكل عضو وحرفته ورتبته ومتجره داخل المنظومة.',
        },
        {
          id: 'gallery',
          title: 'عرض الأعمال والخبرات والاهتمامات',
          desc: 'معرض أعمال شخصي يبرز تطور شغلك وذوقك أمام مجتمع الشمساوية.',
        },
        {
          id: 'posts',
          title: 'التفاعل والتواصل وتبادل الخبرة',
          desc: 'منشورات وحوارات وتجارب واقعية بين الحرفيين وأصحاب الورش.',
        },
        {
          id: 'levels',
          title: 'مستويات ورتب مهنية وتعليمية',
          desc: 'رتب واضحة تعكس مرحلتك وتطورك (مبتدئ، صانع مستقل، محترف، خبير / خبيرة).',
        },
        {
          id: 'lessons',
          title: 'الدروس والشروحات المدمجة',
          desc: 'شروحات عملية وتعليمية تُشاهد بسلاسة داخل المنصة دون تشتيت.',
        },
        {
          id: 'experts',
          title: 'الخبراء والمدربون ومتابعة التطور',
          desc: 'حضور فعلي لأصحاب الخبرة لنشر المعرفة ومساندة الأعضاء في رحلتهم.',
        },
      ],
      genderPrompt: 'معاينة مسمى الرتبة:',
      genderMale: 'فنان (خبير)',
      genderFemale: 'فنانة (خبيرة)',
      ctaEnterFamily: 'ادخل طبلية العيلة',
      ctaNote: 'يتم حفظ مستواك المختار والانتقال لصفحة الدخول أو التسجيل لفتح مجتمع طبلية العيلة.',
    },
    heroesSection: {
      eyebrow: '04 · أبطال الشمساوية — الأدوات الذكية وموسوعة الخامات',
      title: 'صقر الشمساوية، شموسة بنظام بحوث العمليات (OR)، وموسوعة الخامات الموحدة',
      subtitle:
        'أدوات مساعدة حقيقية مبنية لخدمة الصنعة والإدارة اليومية، مصممة لتفهم تفاصيل عملك وتدعم قراراتك بوضوح.',
      falcon: {
        name: 'صقر الشمساوية',
        role: 'المستشار الفني والتسعيري',
        tagline: 'يفهم منتجك وحرفتك من الصورة... ويجهّزلك تفاصيله وتكاليفه للحاسبة.',
        description:
          'مساعد متخصص في فهم المنتجات والحرف اليدوية وتحليل صورها، والتعرف على تفاصيل المنتج والخامات والمقاسات والاستهلاك والتكاليف، ثم توجيه النتائج مباشرة إلى حاسبة التكاليف لمراجعتها واعتمادها.',
        workflowTitle: 'رحلة العمل مع صقر الشمساوية:',
        workflowSteps: [
          'صورة المنتج',
          'تحليل صقر',
          'حاسبة التكاليف',
          'مراجعة واعتماد',
          'الأرشيف',
          'الكتالوج',
          'المتجر الخاص',
        ],
        footnote: 'ينقل التفاصيل والخامات والمقاسات والملاحظات تلقائياً لحاسبة التكاليف لتراجعها وتعتمدها.',
      },
      shamousa: {
        name: 'شموسة',
        role: 'مديرة أعمال الورشة · مدعومة ببحوث العمليات (OR)',
        tagline: 'مش مجرد نافذة دردشة — عقل تشغيلي وإداري مرتبط ببيانات ورشتك وصلاحياتك.',
        description:
          'مساعدة ذكية مرتبطة بإدارة الورشة وبياناتها ووظائفها وفق صلاحياتك الفعلية، ويجري تطويرها بنظام بحوث العمليات (Operations Research — OR) لتحويل أرقام ورشتك إلى قرارات تشغيل وإنتاج ومخزون مُثلى بأسلوب عربي بسيط.',
        orBadge: 'تطوير نوعي · نظام بحوث العمليات (Operations Research)',
        orTitle: 'كيف تنقل شموسة ورشتك لمستوى آخر بنظام بحوث العمليات (OR)؟',
        orPillars: [
          {
            title: 'تعظيم الربح والمزيج الإنتاجي الأمثل',
            desc: 'تساعدك تختار أفضل تشكيلة منتجات تشتغل عليها حسب الخامات وساعات العمل المتاحة لتحقيق أعلى عائد.',
          },
          {
            title: 'إدارة المخزون ونقطة إعادة الطلب الذكية',
            desc: 'تحسب إمتى تشتري الخامة وبأي كمية مثالية عشان المخزن ما يقفش ورأس المال ما يتجمدش.',
          },
          {
            title: 'جدولة أوامر التشغيل وتوزيع طاقة الفريق',
            desc: 'ترتّب الطلبيات والمهام حسب مواعيد التسليم والأولوية لتفادي الاختناقات والتأخير.',
          },
          {
            title: 'تحليل التعادل وسيناريوهات «ماذا لو؟»',
            desc: 'تختبر أثر تغيير سعر خامة أو خصم أو طلبية جملة على أرباحك وسيولتك قبل ما تاخد القرار.',
          },
        ],
        footnote: 'تعمل دائماً ضمن بياناتك وصلاحيات حسابك داخل المنظومة مع بطاقة «هلخصهالك» الحية.',
      },
      materials: {
        name: 'موسوعة الخامات الموحدة',
        role: 'قاعدة المعرفة المتخصصة لخامات الحرف اليدوية',
        tagline: 'توحيد لغة الخامات والتسعير... مع حفظ استقلالية أسعار كل فنان ومورد.',
        description:
          'قاعدة معرفة متخصصة بالخامات المستخدمة في الحرف اليدوية والفنون التطبيقية، تزيل اللبس بين مسميات السوق وتسهّل التسعير والتعامل بين الورش والموردين.',
        bullets: [
          'أسماء الخامات المعتمدة إلى جانب الأسماء المتداولة والمرادفات',
          'الماركات والمواصفات والسماكات والمقاسات بوضوح',
          'وحدات القياس والتعبئة والتحويل الدقيق بينها',
          'الأسعار المرجعية وأسعار الماركات مع حفظ التخصيصات والأسعار الشخصية للفنانين والموردين',
        ],
        note: 'كل فنان أو مورد يحتفظ بأسعاره الفعلية وتخصيصاته الخاصة دون التأثير على بقية الأعضاء.',
        codeLabel: 'بنية كود الخامة الموحد',
        codeParts: [
          { code: 'TH', label: 'القسم', colorClass: 'text-[#FBBF24]' },
          { code: '0001', label: 'الخامة', colorClass: 'text-sky-400' },
          { code: '.01', label: 'المقاس/السمك', colorClass: 'text-emerald-400' },
          { code: '#B003', label: 'الماركة', colorClass: 'text-orange-400' },
        ],
      },
      workbench: {
        title: 'جرّب تفاعل صقر وشموسة (وبحوث العمليات OR) وبطاقة «هلخصهالك»',
        subtitle: 'نماذج توضيحية لكيفية مساعدة أدوات المنظومة لورشتك أو نشاطك التجاري عملياً:',
        tabSimulator: 'أمثلة حية لصقر وشموسة و OR',
        tabSummary: 'معاينة بطاقة «هلخصهالك»',
        simulatorCta: 'افتح حسابك وجرّب صقر وشموسة داخل ورشتك',
        summaryTitle: 'خلاصة خزينتك ومستحقاتك ومخزنك في ثوانٍ — بلغة واضحة بدون تعقيد',
        summarySubtitle: 'بدّل بين نموذج الورشة الحرفية ونموذج مورد الخامات:',
        summaryWorkshopTab: 'نموذج الورشة الحرفية',
        summarySupplierTab: 'نموذج المورد والتاجر',
        summaryCta: 'افتح حسابك واضبط خزينتك اليوم',
      },
    },
    journeySection: {
      eyebrow: '05 · رحلة المنتج من الفكرة إلى السوق',
      title: '9 خطوات متصلة... من صورة المنتج على موبايلك لحد وصوله لعملائك',
      subtitle:
        'اضغط على أي خطوة في الرحلة أو تنقّل بينها لتشاهد كيف تتكامل أدوات الشمساوية خطوة بخطوة بدون تكرار إدخال.',
      activeStepLabel: 'الخطوة الحالية في الرحلة',
      moduleLabel: 'الوحدة المسؤولة داخل المنظومة',
      outcomeLabel: 'المخرج الجاهز للخطوة التالية',
      prevStep: 'الخطوة السابقة',
      nextStep: 'الخطوة التالية',
      ctaStartFirstProduct: 'ابدأ رحلة أول منتج لك الآن',
      steps: [
        {
          stepNumber: '01',
          shortLabel: 'تصوير المنتج',
          title: 'الفنان يصور المنتج',
          description:
            'تبدأ الرحلة بكل بساطة بتصوير المنتج أو الفكرة التي تعمل عليها ورفعها مباشرة داخل المنظومة.',
          moduleName: 'واجهة الرفع والتحليل',
          outcome: 'صورة واضحة جاهزة للفحص الفني والتفصيلي',
        },
        {
          stepNumber: '02',
          shortLabel: 'تحليل صقر',
          title: 'صقر يحلل الصورة والتفاصيل',
          description:
            'يتعرف صقر الشمساوية على تفاصيل المنتج والخامات المستخدمة والمقاسات التقريبية والاستهلاك والتكاليف المتوقعة.',
          moduleName: 'مساعد صقر الشمساوية',
          outcome: 'تقدير فني وحسابي مفصل للخامات والمقاسات والوقت',
        },
        {
          stepNumber: '03',
          shortLabel: 'نقل للحاسبة',
          title: 'النتائج تنتقل إلى حاسبة التكاليف',
          description:
            'بضغطة واحدة، تُصدَّر بيانات التحليل والخامات والمقاسات والملاحظات مباشرة إلى شاشة حاسبة التكاليف بدون إعادة كتابة.',
          moduleName: 'التصدير المباشر من صقر للحاسبة',
          outcome: 'خانات حاسبة التكاليف مملوءة وجاهزة للمراجعة',
        },
        {
          stepNumber: '04',
          shortLabel: 'المراجعة والتعديل',
          title: 'الفنان يراجع ويعدل البيانات',
          description:
            'تراجع الأرقام وتعدّل أي خامة أو سعر شراء أو ساعة عمل أو هامش ربح بما يطابق واقع ورشتك الفعلي.',
          moduleName: 'حاسبة التكاليف ومراقبة التكاليف',
          outcome: 'حسبة واقعية تعكس أسعار خاماتك وتعب إيدك بدقة',
        },
        {
          stepNumber: '05',
          shortLabel: 'اعتماد التكلفة',
          title: 'يعتمد التكلفة ويحفظ المنتج',
          description:
            'تعتمد التكلفة النهائية وسعر البيع العادل وتحفظ بيانات المنتج بالكامل داخل حساب ورشتك.',
          moduleName: 'اعتماد التسعير والحفظ',
          outcome: 'سعر بيع عادل يحفظ هامش ربحك ويحمي قيمة عملك اليدوي',
        },
        {
          stepNumber: '06',
          shortLabel: 'الأرشيف',
          title: 'ينتقل المنتج إلى الأرشيف',
          description:
            'يُحفظ المنتج ككارت صنف مرجعي في أرشيف الورشة بكل تفاصيل خاماته وتكلفته لتسترجعه أو تعيد تصنيعه في أي وقت.',
          moduleName: 'أرشيف الورشة (كارت الصنف)',
          outcome: 'مرجع دائم وموثق لكل منتج نفذته الورشة',
        },
        {
          stepNumber: '07',
          shortLabel: 'الكتالوج',
          title: 'يمكن نقله إلى الكتالوج',
          description:
            'تختار المنتجات المعتمدة التي ترغب في نقلها إلى كتالوج ورشتك لعرضها على العملاء وإعداد عروض الأسعار والطلبات.',
          moduleName: 'كتالوج المنتجات وعروض الأسعار',
          outcome: 'كتالوج منظم جاهز للعرض والتسعير السريع للعملاء',
        },
        {
          stepNumber: '08',
          shortLabel: 'المتجر الشخصي',
          title: 'يمكن عرضه في المتجر الشخصي',
          description:
            'بقرارك الكامل، تنشر المنتج في متجرك الشخصي المستقل داخل المنظومة، ويمكنك طلب ظهوره في سوق الشمساوية.',
          moduleName: 'متجر الفنان الشخصي وسوق الشمساوية',
          outcome: 'منتجك معروض بهوية ورشتك وسعرك المعتمد',
        },
        {
          stepNumber: '09',
          shortLabel: 'مشاركة الرابط',
          title: 'يمكن مشاركة رابط المنتج أو المتجر',
          description:
            'تشارك رابط منتجك أو متجرك الشخصي مباشرة مع جمهورك على واتساب ومواقع التواصل ليصل شغلك لمن يقدّر قيمته.',
          moduleName: 'روابط المشاركة العامة للمتجر والمنتجات',
          outcome: 'وصول مباشر للعملاء وتحويل الاهتمام إلى طلبات حقيقية',
        },
      ],
    },
    whySection: {
      eyebrow: '06 · لماذا الشمساوية؟',
      title: 'فلسفة واضحة... تُنصف كل طرف في عالم الحِرفة',
      manifesto: '«إحنا مش بنبني سوق يكبر فيه طرف على حساب طرف... إحنا بنبني مكان يكبر فيه الكل مع بعض».',
      subtitle:
        'الشمساوية وُلدت من فهم حقيقي لتحديات الورش والفنانين والموردين والمبتدئين؛ بعيداً عن الشعارات الفارغة، نبني أدوات عملية تحمي الجهد وتسهّل النمو.',
      pillars: [
        {
          id: 'w1',
          title: 'دعم الفنان والحرفي',
          desc: 'توفير مساحة مستقلة وأدوات تليق بعمله وتبرز هويته ومهارته.',
        },
        {
          id: 'w2',
          title: 'مساعدة الورش على الإدارة والنمو',
          desc: 'تحويل الشغل اليومي من العشوائية إلى نظام تشغيل وإنتاج وحسابات واضح.',
        },
        {
          id: 'w3',
          title: 'تمكين الموردين والتجار من عملاء جدد',
          desc: 'منظومة إدارة فروع ومخازن وكاشير متصلة مباشرة بسوق الورش والفنانين.',
        },
        {
          id: 'w4',
          title: 'تسهيل وصول الفنان إلى الخامات',
          desc: 'ربط مباشر مع الموردين ولغة خامات موحدة توفّر الوقت وتمنع اللبس.',
        },
        {
          id: 'w5',
          title: 'تشجيع التسعير العادل',
          desc: 'حساب دقيق للخامات والهالك والمصنعية ليأخذ كل صانع حقه بدون بخس أو مبالغة.',
        },
        {
          id: 'w6',
          title: 'حماية قيمة العمل اليدوي',
          desc: 'إبراز القصة والجهد خلف كل قطعة يدوية أمام جمهور يقدّر الأصالة.',
        },
        {
          id: 'w7',
          title: 'أدوات إدارية ومحاسبية عملية',
          desc: 'خزائن وعهد وفواتير و CRM و Cost Control وشجرة حسابات تناسب حجم نشاطك.',
        },
        {
          id: 'w8',
          title: 'التعلم والإنتاج والتجارة والمجتمع معاً',
          desc: 'منظومة واحدة تجمع طبلية العيلة والخبراء والورش والأسواق في مكان واحد.',
        },
      ],
    },
    reviewsSection: {
      eyebrow: 'صوت عيلة الشمساوية',
      title: 'تجارب من قلب ورش ومخازن الشمساوية',
      subtitle: 'كلمات حقيقية من فنانين وتجار خامات شاركونا تجربتهم في تنظيم أعمالهم.',
      feedbackCta: 'شاركنا رأيك أو اقتراحك لتطوير المنظومة',
    },
    faqSection: {
      eyebrow: 'أسئلة شائعة وإجابات واضحة',
      title: 'كل ما يدور في بالك قبل البدء',
      subtitle: 'إجابات مباشرة وواضحة حول طريقة العمل داخل منظومة الشمساوية.',
    },
    closing: {
      eyebrow: 'مكانك محفوظ في العيلة',
      headline: 'إحنا في ضهرك... وكل واحد ليه مكان في عيلة الشمساوية',
      body: 'سواء كنت فناناً أو صاحب ورشة، أو مورداً وتاجراً وصاحب مصنع، أو عميلاً يبحث عن الأصالة، أو مبتدئاً يحمل موهبة، أو خبيراً يشارك علمه — رحلتك تبدأ من هنا.',
      familyStatement: 'الشمساوية عيلة... مش مجرد منصة!',
      threadLine: 'من أول فكرة صغيرة... لحد ورشة ناجحة ومتجر وسوق ومجتمع كامل.',
      luxuryLine: 'Where Craft Meets Luxury',
      primaryCta: 'انضم لعيلة الشمساوية الآن',
      secondaryCta: 'ابدأ تجربة اكتشاف دورك',
    },
    footer: {
      quickLinksTitle: 'أقسام الصفحة',
      marketsTitle: 'الأسواق والحسابات',
      experienceTitle: 'تجربة الشمساوية',
      welcomeGateBtn: 'بوابة الترحيب ونشيد الشمساوية',
      loginBtn: 'تسجيل الدخول لحسابك',
      registerBtn: 'إنشاء حساب جديد',
      feedbackBtn: 'أرسل رأيك أو مقترحك للإدارة',
    },
    feedbackModal: {
      title: 'شاركنا رأيك أو اقتراحك',
      subtitle: 'رسالتك تصل مباشرة إلى صندوق إدارة منظومة الشمساوية لمراجعتها بعناية.',
      nameLabel: 'الاسم *',
      namePlaceholder: 'مثال: سلمى محمود / ورشة نسيج',
      craftLabel: 'الحرفة أو النشاط',
      craftPlaceholder: 'مثال: مكرمية · ريزن · مورد خيوط',
      ratingLabel: 'تقييمك للتجربة',
      messageLabel: 'رأيك أو مقترحك *',
      messagePlaceholder: 'اكتب لنا أي فكرة أو ملاحظة تساعدنا نخلي الشمساوية أفضل ليك...',
      contactLabel: 'رقم واتساب أو بريد إلكتروني (اختياري)',
      contactPlaceholder: 'للتواصل معك بخصوص مقترحك',
      submit: 'إرسال إلى إدارة الشمساوية',
      submitting: 'جاري الإرسال...',
      successTitle: 'شكراً لك! وصلت رسالتك بنجاح',
      successBody: 'تم تسجيل رسالتك في صندوق إدارة الشمساوية وسيتم مراجعتها بعناية.',
      errorBody: 'تعذر الإرسال حالياً، يرجى المحاولة مرة أخرى بعد لحظات.',
    },
    simulatorScenarios: [
      {
        id: 'shamousa_or',
        tabLabel: 'شموسة · بحوث العمليات (OR)',
        badge: 'جديد · Operations Research',
        userQuery:
          'يا شموسة عندي الأسبوع ده 30 ساعة شغل وخيط قطن محدود — أركز على أني منتجات في الطلبيات عشان أحقق أعلى ربح بدون ما أتأخر؟',
        speakerKind: 'shamousa',
        replyTitle: 'توصية تشغيل مثلى بنظام بحوث العمليات (OR):',
        bullets: [
          'المزيج الإنتاجي الأمثل (Product Mix): تنفيذ 4 جداريات متوسطة + 6 معلقات صغيرة يحقق أعلى صافي ربح متاح ضمن حدود الخيط وساعات العمل.',
          'جدولة التشغيل (Scheduling): البدء بأمر التشغيل الأقرب تسليماً أولاً لمنع أي تأخير، وتوزيع التشطيب على آخر يومين.',
          'نقطة إعادة الطلب (EOQ): طلب دفعة خيط قطن 3 مم قبل الوصول لحد الأمان بـ 3 أيام لتفادي توقف الورشة أو تجميد سيولة زائدة.',
        ],
        actionNote:
          'شموسة تحوّل نماذج بحوث العمليات المعقدة إلى نصيحة عملية واضحة ومباشرة تناسب يومك في الورشة.',
      },
      {
        id: 'falcon_macrame',
        tabLabel: 'صقر · تحليل وتكلفة مكرمية',
        userQuery: 'حلل لي صورة جدارية مكرمية 70×110 سم بخيط قطن 3 مم وعصا خشب زان وجهّز التكلفة للحاسبة',
        speakerKind: 'falcon',
        replyTitle: 'تحليل فني وحسابي جاهز للنقل لحاسبة التكاليف:',
        bullets: [
          'تقدير الخامات من الموسوعة الموحدة: خيط قطن 3 مم مع حساب الهالك المنضبط + عصا خشب زان + تغليف.',
          'تقدير ساعات التنفيذ والتشطيب الفعلي لحساب أجر اليد العاملة العادل بدون إغفال مجهود الحرفي.',
          'حساب التكلفة الإجمالية واقتراح سعر بيع يحقق هامش ربح عادل جاهز للتعديل والاعتماد في الحاسبة.',
        ],
        actionNote: 'زر «تصدير للحاسبة» ينقل الخامات والمقاسات والملاحظات مباشرة لشاشة حاسبة التكاليف.',
      },
      {
        id: 'falcon_soap',
        tabLabel: 'صقر · تحليل دفعة صابون وريزن',
        userQuery: 'احسب لي دفعة صابون طبيعي بارد مع مراعاة نسبة الأمان وتوزيع تكلفة القالب والتالف المحتمل',
        speakerKind: 'falcon',
        replyTitle: 'تحليل فني للدفعة وتجهيز بنود الحاسبة:',
        bullets: [
          'تفصيل نسب الزيوت والمواد الفعالة وملاحظات السلامة الفنية الخاصة بالحرفة.',
          'احتساب وقت التصنيع الفعلي مع إطفاء استهلاك القالب وتوزيع التكلفة على القطع السليمة فقط.',
          'تصدير كامل البنود للحاسبة لمراجعة أسعار الشراء الفعلية واعتماد كارت الصنف في الأرشيف.',
        ],
        actionNote: 'النتائج قابلة للمراجعة والتعديل الكامل بيد الفنان قبل الحفظ النهائي في الأرشيف.',
      },
      {
        id: 'shamousa_summary',
        tabLabel: 'شموسة · بطاقة «هلخصهالك»',
        userQuery: 'يا شموسة قوليلي موقف الخزينة والعملاء والموردين النهارده باختصار',
        speakerKind: 'shamousa',
        replyTitle: 'ملخص موقفك المالي اليوم (نموذج توضيحي):',
        bullets: [
          'معانا كام وفين: عرض واضح لأرصدة الخزائن (كاش الورشة أو الفروع · التحويلات · المحافظ والعُهد).',
          'لينا كام بره: كشف العملاء ذوي المستحقات وعدد أيام التأخير لمتابعة التحصيل بلباقة.',
          'علينا للموردين: مواعيد استحقاق فواتير الخامات لتأمين السيولة دون مفاجآت.',
        ],
        actionNote: 'تعتمد شموسة على بيانات حسابك الحية وضمن الصلاحيات الممنوحة لك داخل النظام.',
      },
      {
        id: 'shamousa_stock',
        tabLabel: 'شموسة · رادار المخزون والتشغيل',
        userQuery: 'إيه الخامات اللي قربت تخلص وإيه أوامر التشغيل اللي محتاجة متابعة؟',
        speakerKind: 'shamousa',
        replyTitle: 'متابعة المخزن والتشغيل اليومي (نموذج توضيحي):',
        bullets: [
          'تنبيه للخامات القريبة من حد الأمان مع اقتراح التوريد في التوقيت المناسب.',
          'رصد الأصناف بطيئة الحركة للمساعدة في تحرير رأس المال الراكد.',
          'توجيه سريع مباشر للشاشة أو الإجراء المطلوب داخل لوحة تحكمك.',
        ],
        actionNote: 'شموسة ترافقك داخل المنظومة خطوة بخطوة كمساعدة تشغيل وإدارة حقيقية.',
      },
    ],
  },
  en: {
    nav: [
      { id: 'guided-discovery', label: 'Find Your Role', href: '#guided-discovery' },
      { id: 'markets', label: 'Markets', href: '#markets' },
      { id: 'family-table', label: 'Family Table', href: '#family-table' },
      { id: 'platform-heroes', label: 'Platform Heroes', href: '#platform-heroes' },
      { id: 'product-journey', label: 'Product Journey', href: '#product-journey' },
    ],
    header: {
      login: 'Sign In',
      startJourney: 'Start Your Journey',
      openMenu: 'Open Menu',
      closeMenu: 'Close Menu',
      themeLight: 'Light Mode',
      themeDark: 'Dark Mode',
      welcomeGateShort: 'Welcome Gate & Anthem',
      marketsQuickTitle: 'Available Marketplaces',
      alshamsMarket: 'alSHamsawiyah Market',
      suppliersMarket: 'Suppliers Market',
    },
    hero: {
      eyebrow: 'alSHamsawiyah Ecosystem · Craft, Commerce, Management & Community',
      headlineLine1: "You don't have to be big to start big...",
      headlineHighlight: 'What matters is having the right people behind you.',
      description:
        'From a small first idea to a thriving workshop, a personal store, a marketplace, and a full community... alSHamsawiyah stands with you at every step.',
      companionLine: 'We have your back... and everyone has a place in the alSHamsawiyah family.',
      ctaDiscoverRole: 'Discover Your Role',
      ctaEnterWorld: 'Enter alSHamsawiyah',
      ctaStartJourney: 'Start Your Journey',
      trustLine: [
        'Complete Workshop, Supplier & Branch ERP/POS',
        'Saqr Costing + Shamousa Operations Research (OR)',
        'alSHamsawiyah Market + Family Table Community',
      ],
      welcomeGateLink: 'Open Welcome Gate & Platform Anthem',
      visualCaptionTop: 'alSHamsawiyah · Where Craft Meets Modern Technology',
      visualCaptionBottomTitle: 'Artisans, workshops, suppliers, customers, beginners & experts—united in one ecosystem',
      visualCaptionBottomSub: 'Backed by Saqr for technical costing and Shamousa for smart management & Operations Research',
      falconCaption: 'Saqr alSHamsawiyah',
      shamousaCaption: 'Shamousa · Ops & OR',
      pillars: [
        {
          id: 'p1',
          badge: 'Artisans & Workshops',
          title: 'Independent Workshop Space',
          detail: 'Materials, costing, production orders, accounts, HR, CRM & your personal store.',
        },
        {
          id: 'p2',
          badge: 'Suppliers & Factories',
          title: 'Branches, POS & Inventory ERP',
          detail: 'Multi-branch warehouses, shift handover, accountant audit, owner approval & supplier store.',
        },
        {
          id: 'p3',
          badge: 'Saqr, Shamousa & Materials',
          title: 'Practical AI & Operations Research',
          detail: 'Photo product analysis, optimal production & stock planning, and unified materials encyclopedia.',
        },
        {
          id: 'p4',
          badge: 'Community & Markets',
          title: 'Family Table & Connected Markets',
          detail: 'Peer learning, expert lessons, and a direct craft economy connecting suppliers, makers & buyers.',
        },
      ],
    },
    discovery: {
      eyebrow: '01 · Guided Discovery Experience',
      questionTitle: 'Tell us about yourself — who are you joining alSHamsawiyah as?',
      questionSubtitle:
        'Choose your role to explore a tailored journey built around your real needs. You can switch or go back anytime.',
      step1Label: 'Step 1: Choose Your Role',
      step2Label: 'Step 2: Tailor Your Journey',
      changeRoleBtn: 'Change Role / Back to Choices',
      allRolesBtn: 'View All Roles',
      roles: [
        {
          id: 'artisan',
          badge: 'Full Workshop Workspace',
          title: 'Artisan or Workshop Owner',
          shortDesc: 'Manage materials, costing, production, team, accounts, CRM & your own store.',
        },
        {
          id: 'supplier',
          badge: 'Branch, Warehouse & POS ERP',
          title: 'Supplier, Merchant or Factory',
          shortDesc: 'Run branches, warehouses, POS shifts, treasury approvals, HR & your supplier store.',
        },
        {
          id: 'customer',
          badge: 'Authentic Handmade Finds',
          title: 'Customer Seeking Unique Pieces',
          shortDesc: 'Explore alSHamsawiyah Market and independent artisan storefronts directly.',
        },
        {
          id: 'beginner',
          badge: 'Learn & Grow Step-by-Step',
          title: 'Beginner or Aspiring Talent',
          shortDesc: 'Discover crafts, learn from experts, and grow from hobby to real production.',
        },
        {
          id: 'expert',
          badge: 'Teach & Inspire Makers',
          title: 'Craft Expert or Trainer',
          shortDesc: 'Share lessons, real craft experience, and build your professional presence.',
        },
      ],
      artisan: {
        headline: 'An independent workspace to run your workshop—from raw materials to sales & collections',
        intro:
          'Every artisan or workshop gets a dedicated workspace, private dashboard, and optional personal storefront to manage the entire production and business cycle.',
        subQuestion: 'What would you like to organize first in your workshop?',
        cycleStrip: [
          'Materials & Warehouses',
          'Cost Calculator & Saqr',
          'Production Orders',
          'Catalog & Personal Store',
          'Invoices, Cashbox & Reports',
        ],
        subOptions: [
          {
            id: 'costing_materials',
            label: 'Materials & Product Costing',
            shortHint: 'Fair pricing without guesswork',
            recommendedSummary:
              'Organize your materials using the Unified Materials Encyclopedia, analyze pieces with Saqr, and lock in accurate costing before publishing.',
            highlightedBullets: [
              'Raw materials & warehouse stock management with your real units',
              'Smart Product Cost Calculator + Cost Control tracking',
              'Saqr alSHamsawiyah for photo analysis and material/time estimation',
            ],
          },
          {
            id: 'production_team',
            label: 'Production Orders & Craft Team',
            shortHint: 'Clear schedules, labor & smart planning',
            recommendedSummary:
              'Convert orders into tracked production jobs, coordinate artisans & HR, and let Shamousa apply Operations Research (OR) to optimize schedules.',
            highlightedBullets: [
              'Production & work order management from start to finish',
              'Artisan labor management, team coordination & HR',
              'Shamousa smart assistant with live data & Operations Research planning',
            ],
          },
          {
            id: 'sales_finance',
            label: 'Sales, CRM, Treasury & Accounting',
            shortHint: 'Invoices, collections & Chart of Accounts',
            recommendedSummary:
              'Keep clients, invoices, collections, expenses, cashboxes, custodies, and Chart of Accounts organized in one clear dashboard.',
            highlightedBullets: [
              'Clients, Sales & full CRM relationship management',
              'Invoices, collections, expenses, cashboxes & petty-cash custodies',
              'Financial reports, profit visibility & Chart of Accounts',
            ],
          },
          {
            id: 'full_workshop',
            label: 'Full Integrated Suite + Personal Store',
            shortHint: 'Complete cycle from raw material to buyer',
            recommendedSummary:
              'Run your workshop end-to-end: suppliers, purchases, inventory, costing, production, catalog, and your own branded storefront inside the ecosystem.',
            highlightedBullets: [
              'Independent workspace and dedicated workshop dashboard',
              'Suppliers, purchasing, products, archive & smart catalog',
              'Personal storefront with direct link & optional market listing',
            ],
          },
        ],
        allCapabilitiesTitle: 'Everything included inside the Artisan & Workshop Workspace:',
        allCapabilities: [
          'Independent workspace & private dashboard',
          'Materials & warehouse management',
          'Suppliers & purchasing management',
          'Products & catalog management',
          'Product Cost Calculator',
          'Production & work orders',
          'Artisan & labor management',
          'Clients & sales management',
          'Invoices & collections',
          'Expenses, cashboxes & custodies',
          'Accounting, reports & Chart of Accounts',
          'Team & Human Resources (HR)',
          'Customer Relationship Management (CRM)',
          'Cost Control monitoring',
          'Saqr alSHamsawiyah Advisor',
          'Shamousa Assistant (with Operations Research OR)',
        ],
        storeNote:
          'Every artisan or workshop owns an independent space and can launch a branded personal store inside alSHamsawiyah.',
        primaryCta: 'Launch Your Workshop Space',
        secondaryCta: 'Sign In to Your Workshop',
      },
      supplier: {
        headline: 'A full commercial & multi-branch management system for suppliers, merchants & factories',
        intro:
          'Much more than a catalog: manage your main warehouse, branches, POS shifts, accountant audits, treasury approvals, HR, CRM, and independent supplier storefront.',
        businessTypeQuestion: 'First, what best describes your business?',
        businessTypes: [
          {
            id: 'single_shop',
            label: 'Single Shop',
            tailoredNote:
              'Full shop inventory control, fast POS with automatic stock deduction, shift tracking, treasury clarity, and an online storefront for workshops.',
          },
          {
            id: 'branch_chain',
            label: 'Multi-Branch Chain',
            tailoredNote:
              'Central owner dashboard + independent branch operations + main & branch warehouses + verified inter-branch transfers + full shift & remittance oversight.',
          },
          {
            id: 'wholesaler',
            label: 'Wholesaler',
            tailoredNote:
              'Factory & supplier purchasing, tiered customer classification (external, storefront & member workshops), receivables tracking & B2B workshop reach.',
          },
          {
            id: 'retailer',
            label: 'Retailer',
            tailoredNote:
              'High-speed POS cashier that deducts branch stock immediately, structured shift closing with accountant review, and daily profit visibility.',
          },
          {
            id: 'factory_importer',
            label: 'Factory or Raw Material Supplier',
            tailoredNote:
              'Main warehouse distribution to branches and buyers, Cost Control & Chart of Accounts, plus a direct supplier store connecting to makers across the platform.',
          },
        ],
        suitePrompt: 'Explore the complete Supplier Operating System:',
        suites: [
          {
            id: 'branches',
            label: 'Branches, Warehouses & Purchasing',
            title: 'Total visibility across your main warehouse, branches & factories',
            summary: 'Track every unit, balance, valuation, transfer, and incoming purchase order in real time.',
            items: [
              'Central executive dashboard for the business owner',
              'Independent management for every branch',
              'Main warehouse + dedicated branch warehouses',
              'Tracked inventory transfers between warehouses & branches',
              'Live stock balances, quantities & inventory valuation',
              'Manage factories and traders you purchase from',
              'Record purchases directly into warehouse inventory',
            ],
          },
          {
            id: 'pos',
            label: 'POS Cashier & Shift Custody Cycle',
            title: 'Tightly controlled sales, shift handovers & owner treasury approval',
            summary: 'Every pound and unit is tracked from POS checkout to final owner approval.',
            items: [
              'Record POS sales with automatic branch stock deduction',
              'Track cashier shifts and real-time POS activity',
              'Close shifts and hand over proceeds to the accountant',
              'Accountant audit and formal shift closure',
              'Submit treasury supply/remittance requests when needed',
              'Mandatory owner approval before funds are finalized in the owner treasury',
            ],
          },
          {
            id: 'finance_hr',
            label: 'Finance, HR, CRM & Accounting',
            title: 'Enterprise-grade commercial, financial & team tools',
            summary: 'Built to scale your trade cleanly across branches and teams.',
            items: [
              'Branch accounts, cashboxes & petty-cash custodies',
              'Purchases, sales, expenses, profits & management reports',
              'Customer classification + supplier & factory ledgers',
              'Team & Human Resources (HR) management',
              'Customer Relationship Management (CRM)',
              'Cost Control & structured Chart of Accounts',
            ],
          },
          {
            id: 'customers_store',
            label: 'Customers, Supplier Store & Market',
            title: 'Your independent supplier store connected to active workshops',
            summary: 'Serve external buyers, online customers, and platform workshops from one unified backend.',
            items: [
              'Independent supplier storefront with its own shareable link',
              'Showcase raw materials and receive purchase orders cleanly',
              'Direct link between Suppliers Market and member workshops needing materials',
              'Unified ledger combining branch sales, storefront sales & workshop orders',
            ],
          },
        ],
        posCustodyTitle: 'POS Financial Custody & Approval Chain:',
        posCustodySteps: [
          'POS Sale & Auto Stock Deduction',
          'Shift Close & Handover to Accountant',
          'Accountant Review & Closure',
          'Treasury Remittance Request',
          'Owner Final Approval into Treasury',
        ],
        customerTypesTitle: 'Serve 3 distinct customer segments from one system:',
        customerTypes: [
          { title: 'External Walk-In & Trade Clients', desc: 'Daily shop, branch, and direct wholesale clients.' },
          { title: 'Supplier Storefront Buyers', desc: 'Customers ordering through your alSHamsawiyah store link.' },
          { title: 'Member Artisans & Workshops', desc: 'Makers across the platform sourcing materials for production.' },
        ],
        storeRelationNote:
          'Each supplier gets an independent store & private link to showcase materials and accept orders, bridging suppliers directly with workshops.',
        primaryCta: 'Launch Your Supplier System',
        secondaryMarketCta: 'Browse Suppliers Market',
      },
      customer: {
        headline: 'Step into a world of authentic handmade pieces—straight from real workshops',
        intro:
          'Discover original craftwork made by real artisans, visit independent workshop storefronts, and browse materials whenever you need them.',
        subQuestion: 'What are you looking to explore today?',
        subOptions: [
          {
            id: 'handmade_products',
            label: 'Handmade Creations in alSHamsawiyah Market',
            shortHint: 'Home decor, gifts, leather, macramé, candles & more',
            recommendedSummary:
              'Jump straight into alSHamsawiyah Market to browse authentic handmade pieces with full details and transparent ordering options.',
            highlightedBullets: [
              'Browse curated handmade products from verified workshops',
              'See maker details, craft story & clear pricing',
              'Visit each artisan’s independent store in one click',
            ],
          },
          {
            id: 'artisan_stores',
            label: 'Independent Artisan Storefronts',
            shortHint: 'Follow each workshop’s own craft identity',
            recommendedSummary:
              'Every workshop has its own storefront—explore pieces in the market and open any artisan’s dedicated store page.',
            highlightedBullets: [
              'Branded personal storefronts for every workshop',
              'Authentic craftsmanship instead of mass-produced listings',
              'Direct browsing and available purchase channels',
            ],
          },
          {
            id: 'raw_materials',
            label: 'Craft Materials & Supplies',
            shortHint: 'Source raw materials & tools when needed',
            recommendedSummary:
              'Explore raw materials and tools offered by registered suppliers whenever the Suppliers Market is active.',
            highlightedBullets: [
              'Structured craft materials and tools',
              'Direct access to available supplier storefronts',
              'Seamless bridge between finished crafts and their raw materials',
            ],
          },
        ],
        highlights: [
          'Explore alSHamsawiyah Market and handmade workshop pieces',
          'Visit independent artisan storefronts and full product details',
          'Access available raw-material suppliers whenever needed',
        ],
        primaryMarketCta: 'Explore alSHamsawiyah Market',
        secondarySuppliersCta: 'Explore Suppliers Market',
        loginCta: 'Sign In',
        marketDisabledNote: 'Public marketplace browsing is currently paused by platform settings—sign in to stay updated.',
      },
      beginner: {
        headline: 'alSHamsawiyah is not just for selling—it is your home to learn and grow',
        intro:
          'Whether you are just exploring crafts or nurturing a budding talent, learn from real experts and transition step-by-step into confident production.',
        subQuestion: 'Where are you in your craft journey right now?',
        subOptions: [
          {
            id: 'explore_crafts',
            label: 'Exploring crafts & disciplines',
            shortHint: 'See real workshops and discover what inspires you',
            recommendedSummary:
              'Join the Family Table to follow real makers, explore diverse crafts, and understand materials through the Unified Materials Encyclopedia.',
            highlightedBullets: [
              'Discover diverse handmade crafts and applied arts',
              'Follow real artisans and browse authentic portfolios',
              'Learn clear material names & specs without confusion',
            ],
          },
          {
            id: 'learn_from_experts',
            label: 'Ready to learn from experts & trainers',
            shortHint: 'Embedded lessons & warm community guidance',
            recommendedSummary:
              'Access lessons published by alSHamsawiyah experts directly inside the platform and interact with fellow makers.',
            highlightedBullets: [
              'Watch embedded lessons and craft tutorials right inside the app',
              'Learn directly from experienced experts and trainers',
              'Progress naturally through clear skill ranks as you improve',
            ],
          },
          {
            id: 'start_small_business',
            label: 'Turning talent into my first independent business',
            shortHint: 'Price your first piece right & launch safely',
            recommendedSummary:
              'Use Saqr and the Cost Calculator to price your first handmade piece fairly, then build your catalog and store at your own pace.',
            highlightedBullets: [
              'Smooth transition from learning to real production',
              'Fair costing from day one so your effort is valued',
              'Grow into a full independent workshop inside the same account',
            ],
          },
        ],
        highlights: [
          'Discover crafts and follow real artisans in the community',
          'Access lessons and tutorials from verified experts',
          'Develop skills step-by-step and launch an independent craft business',
        ],
        primaryCta: 'Start Your Beginner Journey',
        secondaryCta: 'Preview Family Table & Ranks',
      },
      expert: {
        headline: 'Your real-world craft experience can light the path for hundreds of makers',
        intro:
          'Share lessons, practical know-how, and craft portfolios inside the Family Table while building a respected professional presence.',
        subQuestion: 'How would you like to contribute to the community?',
        subOptions: [
          {
            id: 'publish_lessons',
            label: 'Publish lessons & tutorials',
            shortHint: 'Share embedded tutorials watched inside the platform',
            recommendedSummary:
              'Unlock expert lesson publishing in your profile so your tutorials appear under your name inside the Family Table.',
            highlightedBullets: [
              'Share structured lessons & tutorials under your professional profile',
              'Learners watch seamlessly inside the platform without distractions',
              'Direct visibility across the Family Table community',
            ],
          },
          {
            id: 'share_experience',
            label: 'Share works & practical insights',
            shortHint: 'Portfolio showcase & real workshop guidance',
            recommendedSummary:
              'Publish your standout pieces, material advice, and finishing techniques to inspire and guide growing artisans.',
            highlightedBullets: [
              'Showcase your craft portfolio and real-world experience',
              'Engage directly with curious learners and workshop owners',
              'Promote fair pricing and quality standards across crafts',
            ],
          },
          {
            id: 'professional_presence',
            label: 'Build a respected Expert profile',
            shortHint: 'Clear Expert rank + optional workshop & store tools',
            recommendedSummary:
              'Display your professional Expert rank across posts and lessons while keeping full access to workshop & storefront tools if you also produce.',
            highlightedBullets: [
              'Recognized Expert presence inside the Family Table',
              'Direct connection with makers interested in your specialty',
              'Combine mentoring with running your own workshop in one place',
            ],
          },
        ],
        highlights: [
          'Publish lessons & tutorials inside the existing community system',
          'Share practical craft experience and showcase your portfolio',
          'Build a respected professional presence among craft enthusiasts',
        ],
        primaryCta: 'Join as an Expert / Trainer',
        secondaryCta: 'Explore Family Table Ranks',
      },
    },
    marketsSection: {
      eyebrow: '02 · Two Connected Marketplaces',
      title: 'One living craft economy connecting suppliers, makers, and customers',
      subtitle:
        'Explore how the Suppliers Market and alSHamsawiyah Market work together so every participant thrives.',
      cycleTitle: 'How the two marketplaces connect (click any step):',
      cycleNodes: [
        {
          id: 'supplier',
          step: '01',
          role: 'Supplier, Merchant & Factory',
          title: 'Supplies Raw Materials & Tools',
          detail:
            'Showcases materials through an independent supplier store and the Suppliers Market so workshops source cleanly.',
        },
        {
          id: 'artisan',
          step: '02',
          role: 'Artisan & Workshop',
          title: 'Transforms Materials into Original Pieces',
          detail:
            'Manages production and costing accurately, then publishes to a personal store and alSHamsawiyah Market.',
        },
        {
          id: 'customer',
          step: '03',
          role: 'Customer & Craft Lover',
          title: 'Discovers & Purchases Authentic Work',
          detail:
            'Explores alSHamsawiyah Market and independent artisan storefronts to order genuine handmade products.',
        },
      ],
      alshamsMarket: {
        badge: 'Marketplace 01 · Handmade Creations',
        title: 'alSHamsawiyah Market',
        tagline: 'Handmade works from artisans & workshops—paired with every maker’s own store',
        bullets: [
          'Every artisan showcases pieces in an independent personal store',
          'Approved works also appear in the central alSHamsawiyah Market',
          'Direct browsing of real products and workshop identities',
        ],
        cta: 'Explore alSHamsawiyah Market',
        liveBadge: 'Live from alSHamsawiyah Market',
        emptyNote: 'Click below to browse available artisan stores and handmade products.',
        disabledNote: 'Public marketplace browsing is currently disabled by platform settings.',
      },
      suppliersMarket: {
        badge: 'Marketplace 02 · Materials & Supplies',
        title: 'Suppliers Market',
        tagline: 'Raw materials and tools offered by suppliers, merchants & factories for workshops',
        bullets: [
          'Independent supplier storefronts with clear material listings',
          'Helps workshops and artisans source their production needs directly',
          'Connects suppliers to active craft workshops across the platform',
        ],
        cta: 'Explore Suppliers Market',
        portalCta: 'Register in the Supplier Portal',
        liveBadge: 'Suppliers Available Now',
        viewSupplier: 'View Store',
        emptyNote: 'Click below to browse registered raw-material suppliers.',
        disabledNote:
          'Public Suppliers Market browsing is toggled off in admin settings right now—while the Supplier Management Portal (branches, POS & warehouses) is open for registration.',
      },
    },
    familySection: {
      eyebrow: '03 · The Family Table (Tabliyet El-Eila)',
      title: 'A warm, living community for makers, learners, suppliers & experts',
      tagline: 'Not a traditional forum—a real craft family where people connect, learn, and grow together.',
      description:
        'The human heart of alSHamsawiyah: personal member pages, portfolios, peer conversations, skill ranks, and expert lessons under one roof.',
      elements: [
        {
          id: 'profiles',
          title: 'Personal Member Pages',
          desc: 'Dedicated identity highlighting craft focus, rank, and storefront links.',
        },
        {
          id: 'gallery',
          title: 'Works, Experience & Interests',
          desc: 'Curated portfolio showcasing your craft progress and style.',
        },
        {
          id: 'posts',
          title: 'Peer Interaction & Knowledge Sharing',
          desc: 'Real discussions, tips, and everyday workshop support among members.',
        },
        {
          id: 'levels',
          title: 'Professional & Learning Ranks',
          desc: 'Clear skill levels reflecting your growth from beginner to expert.',
        },
        {
          id: 'lessons',
          title: 'Embedded Lessons & Tutorials',
          desc: 'Practical craft lessons watched smoothly right inside the platform.',
        },
        {
          id: 'experts',
          title: 'Experts, Trainers & Growth Tracking',
          desc: 'Active mentors sharing knowledge and supporting fellow makers.',
        },
      ],
      genderPrompt: 'Preview rank wording:',
      genderMale: 'Artisan (Male)',
      genderFemale: 'Artisan (Female)',
      ctaEnterFamily: 'Enter the Family Table',
      ctaNote: 'Your chosen skill level is saved automatically as you sign in or register to open the Family Table.',
    },
    heroesSection: {
      eyebrow: '04 · alSHamsawiyah Heroes — Smart Tools & Materials Brain',
      title: 'Saqr alSHamsawiyah, Shamousa with Operations Research (OR), and the Unified Materials Encyclopedia',
      subtitle:
        'Purpose-built tools grounded in real craft workflows—designed to clarify costing, optimize daily operations, and speak one clear material language.',
      falcon: {
        name: 'Saqr alSHamsawiyah',
        role: 'Technical & Costing Advisor',
        tagline: 'Understands your handmade piece from a photo and prepares its full costing breakdown.',
        description:
          'Specialized in craft product analysis: inspects product photos, identifies materials, estimates dimensions, consumption, and costs, and routes results straight into the Cost Calculator for your review.',
        workflowTitle: 'Working flow with Saqr:',
        workflowSteps: [
          'Product Photo',
          'Saqr Analysis',
          'Cost Calculator',
          'Review & Approve',
          'Archive',
          'Catalog',
          'Personal Store',
        ],
        footnote: 'Exports materials, measurements & notes directly into the Cost Calculator for your final approval.',
      },
      shamousa: {
        name: 'Shamousa',
        role: 'Smart Workshop Manager · Powered by Operations Research (OR)',
        tagline: 'Far more than a chat window—an operational brain tied to your live workshop data & permissions.',
        description:
          'Connected directly to your workshop modules within your account permissions, and evolving with an Operations Research (OR) engine that turns workshop numbers into optimal production, stock, and cashflow decisions in plain language.',
        orBadge: 'Strategic Upgrade · Operations Research (OR) Engine',
        orTitle: 'How Shamousa elevates your workshop with Operations Research (OR):',
        orPillars: [
          {
            title: 'Optimal Product Mix & Profit Maximization',
            desc: 'Recommends the best mix of items to produce within your available materials and labor hours.',
          },
          {
            title: 'Smart Inventory & Economic Reorder Point (EOQ)',
            desc: 'Calculates when and how much material to reorder so production never stalls and cash stays liquid.',
          },
          {
            title: 'Production Scheduling & Capacity Balancing',
            desc: 'Sequences work orders by due date and workshop capacity to prevent bottlenecks.',
          },
          {
            title: 'Break-Even & What-If Decision Scenarios',
            desc: 'Simulates material price changes, discounts, or wholesale deals before you commit.',
          },
        ],
        footnote: 'Always operates strictly within your account data and permissions alongside the live Quick Summary card.',
      },
      materials: {
        name: 'Unified Materials Encyclopedia',
        role: 'Specialized Knowledge Base for Craft Materials',
        tagline: 'One unified language for materials and pricing—while keeping every maker’s own prices private.',
        description:
          'A dedicated reference covering raw materials used across handmade crafts and applied arts, eliminating naming confusion between workshops and suppliers.',
        bullets: [
          'Standardized material names paired with local market synonyms',
          'Clear brands, specifications, thicknesses, and dimensions',
          'Measurement units, packaging formats, and exact conversions',
          'Reference & brand pricing alongside private custom prices for each artisan and supplier',
        ],
        note: 'Each artisan and supplier preserves their real purchase and selling prices independently.',
        codeLabel: 'Unified Material Code Structure',
        codeParts: [
          { code: 'TH', label: 'Category', colorClass: 'text-[#FBBF24]' },
          { code: '0001', label: 'Material', colorClass: 'text-sky-400' },
          { code: '.01', label: 'Size/Spec', colorClass: 'text-emerald-400' },
          { code: '#B003', label: 'Brand', colorClass: 'text-orange-400' },
        ],
      },
      workbench: {
        title: 'Preview Saqr, Shamousa (with Operations Research) & the Quick Financial Summary',
        subtitle: 'Illustrative examples showing how the platform supports everyday craft and supply decisions:',
        tabSimulator: 'Saqr, Shamousa & OR Demos',
        tabSummary: 'Quick Financial Summary Preview',
        simulatorCta: 'Create your account & use Saqr & Shamousa live',
        summaryTitle: 'Your cash, receivables, payables & stock summarized clearly in seconds',
        summarySubtitle: 'Toggle between Artisan Workshop view and Supplier view:',
        summaryWorkshopTab: 'Workshop View',
        summarySupplierTab: 'Supplier View',
        summaryCta: 'Open your account & organize your treasury',
      },
    },
    journeySection: {
      eyebrow: '05 · Product Journey from Idea to Market',
      title: '9 connected steps—from snapping a photo to sharing your published product',
      subtitle:
        'Click any stage or step through the timeline to see how every tool in alSHamsawiyah flows into the next.',
      activeStepLabel: 'Current Journey Stage',
      moduleLabel: 'Platform Module',
      outcomeLabel: 'Ready Output',
      prevStep: 'Previous Step',
      nextStep: 'Next Step',
      ctaStartFirstProduct: 'Start Your First Product Journey',
      steps: [
        {
          stepNumber: '01',
          shortLabel: 'Photo',
          title: 'The artisan photographs the product',
          description: 'Snap a photo of your handmade piece or concept and upload it right inside your workspace.',
          moduleName: 'Upload & Analysis Input',
          outcome: 'Clear product image ready for technical inspection',
        },
        {
          stepNumber: '02',
          shortLabel: 'Saqr Analysis',
          title: 'Saqr analyzes the photo and details',
          description: 'Saqr identifies craft details, materials, estimated dimensions, consumption, and projected costs.',
          moduleName: 'Saqr alSHamsawiyah Advisor',
          outcome: 'Structured technical & costing breakdown',
        },
        {
          stepNumber: '03',
          shortLabel: 'Export to Calc',
          title: 'Results transfer into the Cost Calculator',
          description: 'With one click, materials, measurements, and key chat notes populate the Cost Calculator automatically.',
          moduleName: 'Direct Saqr → Calculator Export',
          outcome: 'Pre-filled calculator screen ready for review',
        },
        {
          stepNumber: '04',
          shortLabel: 'Review & Edit',
          title: 'The artisan reviews and adjusts data',
          description: 'Fine-tune actual purchase prices, labor time, waste, and profit margin to match your real workshop.',
          moduleName: 'Cost Calculator & Cost Control',
          outcome: 'Verified real-world costing tailored to your workshop',
        },
        {
          stepNumber: '05',
          shortLabel: 'Approve & Save',
          title: 'Approve the cost and save the product',
          description: 'Lock in the fair retail/wholesale price and save the approved product record securely.',
          moduleName: 'Pricing Approval & Save',
          outcome: 'Fair selling price protecting your craft and margin',
        },
        {
          stepNumber: '06',
          shortLabel: 'Archive',
          title: 'The product moves to the Archive',
          description: 'Stored permanently as a reference item card with full material recipe for repeatable production.',
          moduleName: 'Workshop Archive (Item Card)',
          outcome: 'Permanent reusable production blueprint',
        },
        {
          stepNumber: '07',
          shortLabel: 'Catalog',
          title: 'Optionally promote to the Catalog',
          description: 'Move approved archive products into your official workshop catalog for quotes and client orders.',
          moduleName: 'Product Catalog & Quotations',
          outcome: 'Organized client-ready product catalog',
        },
        {
          stepNumber: '08',
          shortLabel: 'Personal Store',
          title: 'Optionally publish in your Personal Store',
          description: 'Publish chosen pieces to your branded storefront and optionally submit them to alSHamsawiyah Market.',
          moduleName: 'Personal Storefront & Market',
          outcome: 'Live product displayed under your workshop identity',
        },
        {
          stepNumber: '09',
          shortLabel: 'Share Link',
          title: 'Share the product or store link',
          description: 'Share your direct link on WhatsApp and social channels so buyers who appreciate handmade work find you.',
          moduleName: 'Public Storefront & Product Links',
          outcome: 'Direct audience reach and genuine client orders',
        },
      ],
    },
    whySection: {
      eyebrow: '06 · Why alSHamsawiyah?',
      title: 'A sincere philosophy built for every member of the craft economy',
      manifesto: '"We are not building a market where one side grows at the expense of another... we are building a place where everyone grows together."',
      subtitle:
        'Honest tools designed around real workshop, supplier, and learner challenges—without empty promises.',
      pillars: [
        { id: 'w1', title: 'Supporting Artisans & Makers', desc: 'An independent workspace and storefront that honor your craft.' },
        { id: 'w2', title: 'Helping Workshops Manage & Grow', desc: 'Structured daily operations, production orders, and clarity.' },
        { id: 'w3', title: 'Empowering Suppliers & Merchants', desc: 'Branch, warehouse & POS management connected to active workshops.' },
        { id: 'w4', title: 'Easier Access to Materials', desc: 'Direct supplier connections paired with a unified materials language.' },
        { id: 'w5', title: 'Encouraging Fair Pricing', desc: 'Accurate costing so makers earn what their skill truly deserves.' },
        { id: 'w6', title: 'Protecting Handmade Value', desc: 'Showcasing real artistry and effort to people who value authenticity.' },
        { id: 'w7', title: 'Practical Admin & Accounting Tools', desc: 'Treasuries, CRM, HR, Cost Control & Chart of Accounts made approachable.' },
        { id: 'w8', title: 'Learning, Production, Trade & Community', desc: 'One unified home where talent evolves into sustainable business.' },
      ],
    },
    reviewsSection: {
      eyebrow: 'Voices from the Family',
      title: 'Stories from alSHamsawiyah workshops and suppliers',
      subtitle: 'Real feedback from makers and merchants organizing their work on the platform.',
      feedbackCta: 'Share Your Feedback or Suggestion',
    },
    faqSection: {
      eyebrow: 'Frequently Asked Questions',
      title: 'Clear answers before you begin',
      subtitle: 'Straightforward information about how alSHamsawiyah works.',
    },
    closing: {
      eyebrow: 'Your Place Is Ready',
      headline: 'We have your back... and everyone has a place in the alSHamsawiyah family',
      body: 'Whether you are an artisan, a workshop owner, a supplier or factory, a customer, a beginner, or an expert trainer—your journey starts here.',
      familyStatement: 'alSHamsawiyah is a family... not just a platform!',
      threadLine: 'From a small first idea... to a thriving workshop, storefront, market, and community.',
      luxuryLine: 'Where Craft Meets Luxury',
      primaryCta: 'Join the alSHamsawiyah Family Now',
      secondaryCta: 'Start Guided Discovery',
    },
    footer: {
      quickLinksTitle: 'Explore Sections',
      marketsTitle: 'Markets & Accounts',
      experienceTitle: 'Experience',
      welcomeGateBtn: 'Welcome Gate & Anthem',
      loginBtn: 'Sign In to Your Account',
      registerBtn: 'Create Free Account',
      feedbackBtn: 'Send Feedback to Admin',
    },
    feedbackModal: {
      title: 'Share Your Feedback or Idea',
      subtitle: 'Your message goes straight to the alSHamsawiyah admin inbox for review.',
      nameLabel: 'Your Name *',
      namePlaceholder: 'e.g. Salma Mahmoud / Naseej Studio',
      craftLabel: 'Craft or Business Type',
      craftPlaceholder: 'e.g. Macramé · Resin · Thread Supplier',
      ratingLabel: 'Rate your experience',
      messageLabel: 'Your Message or Suggestion *',
      messagePlaceholder: 'Share any idea or feedback to help us make alSHamsawiyah better...',
      contactLabel: 'WhatsApp or Email (Optional)',
      contactPlaceholder: 'So we can follow up with you',
      submit: 'Send to alSHamsawiyah Team',
      submitting: 'Sending...',
      successTitle: 'Thank you! Your message has been received',
      successBody: 'Your note is now in the alSHamsawiyah admin inbox for review.',
      errorBody: 'Could not send right now—please try again in a moment.',
    },
    simulatorScenarios: [
      {
        id: 'shamousa_or',
        tabLabel: 'Shamousa · Operations Research (OR)',
        badge: 'New · Operations Research',
        userQuery:
          'Shamousa, I have 30 workshop hours and limited cotton cord this week—which product mix maximizes profit without missing deadlines?',
        speakerKind: 'shamousa',
        replyTitle: 'Optimal Operations Research (OR) Recommendation:',
        bullets: [
          'Optimal Product Mix: Prioritizing 4 medium wall hangings + 6 small hangers yields the highest net margin within cord & labor limits.',
          'Production Scheduling: Sequence earliest-due orders first and batch finishing in the final two days to eliminate bottlenecks.',
          'Smart Reorder Point (EOQ): Trigger your 3mm cotton cord replenishment 3 days before safety stock to prevent idle time without locking cash.',
        ],
        actionNote: 'Shamousa translates Operations Research models into plain, actionable guidance for your daily workshop.',
      },
      {
        id: 'falcon_macrame',
        tabLabel: 'Saqr · Macramé Photo Analysis',
        userQuery: 'Analyze this 70×110 cm macramé wall hanging photo and prepare the Cost Calculator breakdown.',
        speakerKind: 'falcon',
        replyTitle: 'Technical & Costing Breakdown Ready for Calculator:',
        bullets: [
          'Identifies unified materials (3mm cotton cord + beechwood dowel + packaging) with disciplined waste calculation.',
          'Estimates active crafting and finishing hours so labor is priced fairly.',
          'Prepares full cost and margin preview ready for one-click export to your Cost Calculator.',
        ],
        actionNote: 'One click exports materials, dimensions & notes straight into your Cost Calculator.',
      },
      {
        id: 'falcon_soap',
        tabLabel: 'Saqr · Cold-Process Soap Batch',
        userQuery: 'Prepare a cold-process soap batch breakdown accounting for mold wear and safety checks.',
        speakerKind: 'falcon',
        replyTitle: 'Technical Batch Analysis & Calculator Prep:',
        bullets: [
          'Outlines oils, active ingredients, and craft-specific safety notes clearly.',
          'Separates active crafting time from curing time and spreads mold wear across sound bars.',
          'Transfers cleanly into your Cost Calculator for final verification and archiving.',
        ],
        actionNote: 'You always review and adjust every number before saving to your Archive.',
      },
      {
        id: 'shamousa_summary',
        tabLabel: 'Shamousa · Quick Summary',
        userQuery: 'Shamousa, summarize my cashboxes, receivables, and supplier dues today.',
        speakerKind: 'shamousa',
        replyTitle: 'Daily Financial Snapshot (Illustrative):',
        bullets: [
          'Cash on hand: clear split across workshop/branch drawers, bank/InstaPay, and wallets.',
          'Receivables: list of outstanding client balances with overdue days for polite follow-up.',
          'Supplier payables: upcoming material invoices so cashflow stays predictable.',
        ],
        actionNote: 'Powered by your live account data strictly within your assigned permissions.',
      },
      {
        id: 'shamousa_stock',
        tabLabel: 'Shamousa · Stock & Operations Radar',
        userQuery: 'Which materials are getting low and which work orders need attention?',
        speakerKind: 'shamousa',
        replyTitle: 'Inventory & Operations Check (Illustrative):',
        bullets: [
          'Highlights materials approaching safety stock with timely reorder suggestions.',
          'Flags slow-moving items so you can free tied-up capital.',
          'Routes you straight to the exact module or action inside your dashboard.',
        ],
        actionNote: 'Shamousa acts as a genuine operational manager inside your workspace.',
      },
    ],
  },
};
