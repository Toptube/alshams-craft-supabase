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

export interface LandingCmsConfig {
  cmsRevision?: number;
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
  };
  sections: {
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

export const DEFAULT_LANDING_CMS_CONFIG: LandingCmsConfig = {
  cmsRevision: 4,
  brandAssets: {
    platformLogo: { ...DEFAULT_BRAND_ASSETS.platformLogo },
    brandIcon: { ...DEFAULT_BRAND_ASSETS.brandIcon },
    falconMascot: { ...DEFAULT_BRAND_ASSETS.falconMascot },
    shamousaMascot: { ...DEFAULT_BRAND_ASSETS.shamousaMascot },
  },
  header: {
    ctaButtonText: 'سجل الآن',
    welcomeGateButtonText: 'بوابة الترحيب ✨',
    navLinks: [
      { id: 'safe-accounts', label: 'عقلك الحرفي', href: '#safe-accounts' },
      { id: 'ai-partners', label: 'صقر وشموسة AI', href: '#ai-partners' },
      { id: 'craft-lifecycle', label: 'رحلة المشغولة', href: '#craft-lifecycle' },
      { id: 'suppliers-promo', label: 'سوق الموردين B2B', href: '#suppliers-promo' },
      { id: 'family-profile', label: 'العيلة والصفحة الشخصية', href: '#family-profile' },
      { id: 'reviews', label: 'حكايات الورش', href: '#reviews' },
    ],
  },
  hero: {
    falconBadgeText: 'صقر الشمساوية AI 🦅',
    headlineLine1: 'عشان إيدك بتتلف في حرير..',
    headlineHighlight: 'ورشتك تستاهل مدير شاطر يحسبها بالضمير!',
    description:
      'من أول فتلة خيط وتسعير الخامات بالمليم وحساب الهالك وساعات التعب، لحد أرباحك الصافية، متجرك الخاص، سوق الشمساوية، سوق الموردين بشرائح الكميات، طبلية العيلة، وصفحتك الشخصية ومعرض أعمالك.. كل ده في مكان واحد، لا دفاتر مبلولة شاي ولا حسابات تاهت في الدرج.',
    primaryCtaText: 'سجل الآن وافتح حسابك مجاناً 🌟',
    secondaryCtaText: 'شوف المنظومة بتشتغل إزاي',
    trustBadge1: 'بدون تعقيد محاسبي أو فذلكة',
    trustBadge2: 'حماية وأمان كامل لأسرار ورشتك',
    trustBadge3: 'شغال معاك على الموبايل والكمبيوتر',
  },
  sections: {
    safeAccounts: {
      visible: true,
      badge: 'المالية والسيولة الحرفية المنضبطة',
      title: 'عقلك الحرفي مش دفتر ضايع ولا ورقة مبلولة',
      subtitle:
        'كام مرة فاتورة خيط ضاعت؟ ولا فلوس كاش الورشة دخلت في مصاريف البيت؟ ولا صانع أخد عهدة ونسيتوا اتصرف منها إيه؟ الشمساوية بتنظم كل مليم بلغة الورشة البسيطة بدون وجع دماغ.',
      ctaText: 'ابدأ تسعير شغلك واضبط حساباتك صح 💰',
      cards: [
        {
          id: 'sc1',
          title: 'شجرة حسابات مبسطة',
          description:
            'مش مصطلحات بنكية معقدة.. دي خزن، عهد، مشتريات خامات، وأجور صناع، كل قرش بيسمع في خانته المظبوطة فورياً.',
        },
        {
          id: 'sc2',
          title: 'سجل العهد وإغلاق المتبقي',
          description:
            'اصرف عهدة للمساعد أو الصانع عشان يشتري خامات، وسجل فواتيره واسترد المتبقي بلمسة زرار مع مطابقة الخزينة.',
        },
        {
          id: 'sc3',
          title: 'ميزان السيولة الحية الفوري',
          description:
            'شاشة واحدة توضح لك سيولتك الفعلية متوزعة إزاي: كاش في درج الورشة، إنستاباي، ولا محافظ فودافون كاش.',
        },
        {
          id: 'sc4',
          title: 'إنذار حد أمان السيولة',
          description:
            'لو السيولة قربت تخلص قبل تجديد الخامات، المنظومة بتديك تنبيه مبكر عشان تلحق تحصّل فواتير العملاء الآجلة.',
        },
      ],
    },
    aiPartners: {
      visible: true,
      badge: 'الذكاء الاصطناعي الحرفي الميداني',
      title: 'شموسة وصقر معاك على الخط.. مش شات بوت، دول شركاء ورشة!',
      subtitle:
        'فاهمين في بكر الخيط، والمكرميات، وساعات الشغل اليدوي، وأسعار السوق. بيقرأوا أرقام ورشتك الحية عشان مفيش حساب يفلت.',
      falconName: 'صقر الشمساوية',
      falconRoleBadge: 'المستشار الهندسي',
      falconDescription:
        'خبير هندسة الورشة.. تبعت له صورة المشغولة يحلل أبعادها، يحسب أطوال الخيوط وسمك الحبال، ويطلع كود الرسم التخطيطي الهندسي ونسب الهدر بالجرام!',
      falconFootnote: '⚡️ مبني على نماذج رؤية هندسية وحسابات يدوية واقعية',
      shamousaName: 'شموسة',
      shamousaRoleBadge: 'مديرة العمليات والمهام',
      shamousaDescription:
        'رفيقة الورشة الشاطرة.. تفكرك بأوردرات الزباين المستعجلة، تعرفك الخامات اللي قربت تخلص عشان تطلبها من الموردين، وتطابق لك فلوس الخزائن والعهد أولاً بأول.',
      shamousaFootnote: '⚡️ متصلة مباشرة بأرصدة خاماتك وأوامر تشغيل ورشتك',
      simulatorTitle: 'جرّب محاكي ذكاء الورشة الآن',
      simulatorCtaText: 'جرب ذكاء صقر وشموسة في ورشتك 🦅',
    },
    craftLifecycle: {
      visible: true,
      badge: 'دورة حياة المشغولة الكاملة',
      title: 'من أول فتلة خيط لحد المتجر وعين الزبون',
      subtitle: 'مسار صناعي احترافي ينقلك من هاوٍ لعلامة تجارية مستقرة ومربحة خطوة بخطوة.',
      ctaText: 'انضم لعيلة الشمساوية وشوف الفرق 🌟',
      steps: [
        {
          id: 'st1',
          stepNumber: '1',
          title: 'حاسبة التكاليف الشاملة',
          description:
            'حساب دقيق لأطوال الخيوط، أسعار الخامات، ساعات التعب، ونسب الهدر، عشان تعرف تسعر بالعدل وتضمن مكسبك.',
        },
        {
          id: 'st2',
          stepNumber: '2',
          title: 'أرشيف المواصفات والغرز',
          description:
            'احفظ كل قطعة نفذتها بمقاساتها وخاماتها وصورها، عشان تعيد تصنيعها لأي عميل بنفس الدقة في ثواني.',
        },
        {
          id: 'st3',
          stepNumber: '3',
          title: 'أمر التشغيل والصرف',
          description:
            'إذن صرف خامات من المخزن، تكليف الصانع، وتوريد المنتج التام لمخزن الجاهز فور الانتهاء مع إثبات مصنعيات العمال.',
        },
        {
          id: 'st4',
          stepNumber: '4',
          title: 'الكتالوج وعروض الواتساب',
          description:
            'شارك عروض أسعار أنيقة وفواتير رسمية مع عملائك على واتساب بلمسة واحدة، أو افتح متجرك على منصتي.',
        },
      ],
    },
    crmClients: {
      visible: true,
      badge: 'إدارة وعلاقات العملاء (CRM الحرفي)',
      titleLine1: 'عميلك مش رقم عابر..',
      titleHighlight: 'ده شريك نجاحك وسمعة ورشتك!',
      description:
        'لكل عميل ملف متكامل يحفظ تفضيلاته، مقاسات بيته، ألوانه المفضلة، وسجل كل قطعة اشتراها منك. كشف حساب فوري يوضح المستحق والمتبقي بدون إحراج، وتواصل مباشر على واتساب بلمسة زر لتأكيد الطلب وتحديث مراحل التنفيذ.',
      bullets: [
        'دليل عملاء ذكي بأرقامهم وعناوينهم وتاريخ تعاملاتهم (متجري · سوق الشمساوية · خارج المنظومة)',
        'كشف حساب مديونيات ودفعات مقدمة بضغطة زر وبدون إحراج',
        'مشاركة تحديثات التصنيع ومواعيد التسليم مباشرة عبر واتساب',
      ],
      ctaText: 'نظّم حسابات زباينك وافتح ورشتك الآن 👥',
    },
    smartCatalog: {
      visible: true,
      badge: 'الكتالوج المرجعي وعروض الأسعار',
      titleLine1: 'كتالوج يشرفك قدام زباينك..',
      titleHighlight: 'وعروض أسعار موثقة بضغطة زر!',
      description:
        'ودّع التسعير المرتجل وعروض الأسعار المكتوبة على ورق ضايع! أنشئ عرض سعر احترافي بلمسة واحدة يوضح اسم المشغولة، الخامات، المقاسات، مدة التنفيذ، وشروط الدفعة المقدمة. شارك رابط الكتالوج مع زبائنك ليتصفحوا إبداعاتك بكل فخر.',
      bullets: [
        'عروض أسعار رسمية برقم مسلسل وشروط واضحة تحفظ حقوقك',
        'معرض مرجعي لمشغولات ورشتك يظهر تفاصيل كل قطعة بدقة وتعدد المقاسات',
        'تصدير سريع لفواتير وعروض الأسعار لمشاركتها على شبكات التواصل',
      ],
      ctaText: 'صمّم كتالوج ورشتك الآن مجاناً 📖',
    },
    craftStore: {
      visible: true,
      badge: 'أول وأكبر سوق للحرف اليدوية (Multi-Vendor Marketplace)',
      titleLine1: 'سوق الشمساوية..',
      titleHighlight:
        'أول منصة متعددة التجار متخصصة لفناني وصنّاع الحرف اليدوية في مصر والعالم العربي!',
      description:
        'بمجرد فتح ورشتك، ووضع منتجاتك.. هتسمّع معاك في الأرشيف والكتالوج، ومنه بضغطة زر واحدة هتقدر تصدر منتجاتك لمتجرك الخاص، وهتحصل تلقائياً على واجهة متجر رقمي مستقلة بهويتك وعلامتك، مع إدراج مشغولاتك المعتمدة فوراً داخل سوق الشمساوية العام للوصول لآلاف العملاء وتجار الجملة.',
      bullets: [
        'متجر رقمي مستقل: رابط خاص باسم ورشتك وشعارك وتخصيص كامل للمقاسات والألوان والعملة.',
        'تصنيف ذكي حسب نوع الحرفة مع تقييمات العملاء ونقاط الولاء وأكواد الخصم.',
        'فتح أبواب جديدة لتوريدات الجملة والتصدير بالعملة المحلية أو العالمية لحظياً.',
        'ربط فوري بمخزن المنتجات والخزينة بدون أي تكرار مع إدارة موحدة لكل أوردراتك.',
      ],
      ctaText: 'افتح متجرك واعرض شغلك في سوق الشمساوية 🛍️',
    },
    toolMaintenance: {
      visible: true,
      badge: 'حماية خطوط الإنتاج والعدد',
      titleLine1: 'صيانة عِددك وخطوط إنتاجك..',
      titleHighlight: 'شغلك ميعطلش في عز الموسم!',
      description:
        'مقص اتكسر، ماكينة خياطة وقفت وقت تسليم أوردر مستعجل، أو شنيور محتاج تزييت؟ المنظومة بتديك تنبيه وقائي دوري لكل ماكينة وأداة في ورشتك، وبتحسب نسبة إهلاكها تلقائياً ضمن تكلفة المنتج عشان رأس مالك يفضل شغال ومحمي.',
      bullets: [
        'تتبع مواعيد الصيانة الدورية وتغيير السيور والزيوت',
        'حساب إهلاك العدد والمعدات بالمليم في تكلفة كل قطعة',
        'تاريخ وسجل إصلاحات الأصول لمنع المفاجآت المكلفة',
      ],
      ctaText: 'احمي خط إنتاجك وافتح ورشتك الآن 🛠️',
    },
    suppliersPromo: {
      visible: true,
      badge: 'بوابة موردي وتجار ومصانع الخامات (B2B & B2C)',
      titleLine1: 'بتبيع خامات الهاند ميد بالجملة أو القطاعي؟',
      titleHighlight: 'الورش والفنانين مستنيينك على الباب.. بس بتسعير يشرّف!',
      description:
        'سواء بتلف بكر مكرمية، بتورد خرز وكريستال، بتستورد ريزن، أو بتفصّل قواعد خشب.. افتح حسابك المستقل كمورد في دقايق! حط شرائح أسعار الكميات (كل ما الورشة تطلب أكتر السعر ينزل أوتوماتيك)، ابعت تنبيهات العروض والبضاعة الجديدة للورش، وخليهم يقارنوا أسعارك ويقيّموا شغلك على نضافة.',
      bullets: [
        'كتالوج خامات بضغط تلقائي حتى 3 صور لكل صنف + محرر شرائح الكميات المتدرجة (تلقائي في الفواتير والسوق).',
        'جدول مقارنة أسعار الموردين + تنبيهات فورية بالعروض والوصول الجديد + تقييمات حقيقية من الورش بالنجوم.',
        'متجر مستقل برابط وQR + مشاركة كاملة في طبلية عيلة الشمساوية وصفحة شخصية احترافية بأبرز 6 أعمال.',
      ],
      ctaText: 'سجل كمورد خامات الآن',
    },
    reviews: {
      visible: true,
      badge: 'شهادات حقيقية من صناع الهاند ميد',
      title: 'حكايات نجاح من قلب ورش الشمساوية ⭐',
      subtitle: 'فنانين وحرفيين قدروا ينقلوا ورشهم لمستوى تاني من الاستقرار والمكسب.',
      feedbackCtaText: 'شاركنا رأيك أو اقتراحك لورشتك القادمة 💡',
      items: [
        {
          id: 'rev1',
          quote:
            'قبل الشمساوية كنت ببيع الجدارية بسعر الخامة ومبحسبش تعب إيدي! المنظومة فهمتني إزاي أسعر ساعة شغلي وأكسب صح.',
          author: 'مريم فهمي',
          workshop: 'ورشة نغم المكرمية (القاهرة)',
          rating: 5,
        },
        {
          id: 'rev2',
          quote:
            'حاسبة الخامات أسطورية! بطلت اشتري بكر زيادة يركن في الدولاب.. الهدر قل بنسبة 80% وكل مليم في مكانه.',
          author: 'منى عادل',
          workshop: 'ورشة غرزة وسنارة (الإسكندرية)',
          rating: 5,
        },
        {
          id: 'rev3',
          quote:
            'نظام العهد والخزن حللي مشكلة الفلوس اللي كانت بتضيع مع العمال.. بدوسة زرار بعرف متبقي إيه عند مين بالقرش.',
          author: 'عم إبراهيم النوبي',
          workshop: 'ورشة أصيل للخوص والجريد (أسوان)',
          rating: 5,
        },
        {
          id: 'rev4',
          quote:
            'التنبيه الوقائي لأفران الحرق وصيانة المعدات وفر عليا آلاف الجنيهات في تصليحات فجائية وقت ضغط الشغل.',
          author: 'كريم ناصر',
          workshop: 'ورشة صلصال الفن (قنا)',
          rating: 5,
        },
      ],
    },
    whatsNew: {
      visible: true,
      badge: 'تطويرات عيلة الشمساوية • V 4.0',
      title: 'إيه اللي جد في الورشة؟ دلوقتي بقى بيت كبير بجد!',
      subtitle:
        'جمعنا الحرفي والمورد والعميل في دايرة واحدة نضيفة ومظبوطة على الشعرة.. ولسه اللي جاي أحلى.',
      items: [
        {
          id: 'wn1',
          tag: 'سوق الموردين B2B',
          version: 'V 4.0 Live',
          title: 'شرائح كميات متدرجة، مقارنة أسعار، تقييمات، وتنبيهات عروض',
          description:
            'الورشة دلوقتي تقدر تقارن أسعار الخامات بين كل الموردين في جدول واحد، تاخد خصم الكمية أوتوماتيك، تشوف تنبيهات العروض والوصول الجديد، وتقيّم المورد بعد التجربة.',
        },
        {
          id: 'wn2',
          tag: 'العيلة والصفحة الشخصية',
          version: 'V 4.0 Live',
          title: 'طبلية عيلة الشمساوية + صفحتك الشخصية (6 أعمال مميزة)',
          description:
            'فنان ومورد قاعدين على طبلية واحدة في المنتدى والشات! ودوسة على صورة أي عضو تفتح لك صفحته الشخصية بكامل أعماله المميزة (لحد 6 صور) مع تحكم كامل في الخصوصية ومعاينة كل فئة.',
        },
        {
          id: 'wn3',
          tag: 'صقر وشموسة AI',
          version: 'AI 4.0',
          title: 'شموسة وصقر هضموا المنظومة الجديدة كلها أول بأول',
          description:
            'اسأل شموسة عن أي شاشة أو زر من الحاسبة لحد شرائح الموردين وصفحتك الشخصية، وصقر يحلل صور المشغولات ويحوّلها لحسبة خامات وتكلفة في غمضة عين.',
        },
      ],
    },
    faq: {
      visible: true,
      badge: 'إجابات صافية ومن الآخر',
      title: 'الأسئلة الشائعة من صناع وموردي الهاند ميد',
      subtitle: 'كل اللي يدور في بالك عن المنظومة، الموردين، الصفحة الشخصية، وأمان أسرار شغلك.',
      items: [
        {
          id: 'fq1',
          q: 'هل المنظومة صعبة أو محتاجة خبرة في الكمبيوتر والمحاسبة؟',
          a: 'خالص والله! المنظومة بتتكلم مصري بسيط على أصوله، لا فذلكة ولا مصطلحات تكشّش. لو بتعرف تبعت رسالة على واتساب هتدير ورشتك أو متجر خاماتك في 5 دقايق.',
        },
        {
          id: 'fq2',
          q: 'إزاي المنظومة بتحسب تكلفة الهدر وساعات التعب بدقة؟',
          a: 'حاسبة التكاليف بتاخد أطوال الخيوط أو وزن الخامة وساعات الشغل، وتحسب تلقائياً الهدر الطبيعي واستهلاك العدد، وتفصل أجر إيدك الصافي عن هامش الربح عشان تعبك ما يروحش هدر.',
        },
        {
          id: 'fq3',
          q: 'هل تفاصيل خاماتي وأسعار مشغولاتي وتصاميمي في أمان وخصوصية؟',
          a: 'طبعاً 100%! كل ورشة وكل مورد بياناته محبوسة في أوضة متقفلة لوحده في قاعدة البيانات، وصفحتك الشخصية كمان بتحدد فيها بنفسك إيه اللي يظهر للفنانين، إيه للموردين، وإيه للعملاء.',
        },
        {
          id: 'fq4',
          q: 'إيه الفرق بين دور صقر الشمساوية ودور شموسة؟',
          a: 'صقر 🦅 هو الأسْطى والمهندس: يحلل صور المشغولات، يحسب الأطوال والغرز والهالك ويصدرها للحاسبة. أما شموسة ☀️ فهي مديرة الأعمال الشاطرة: تراجع معاك الخزينة والنواقص والأوردرات وتدلك على كل زر وشاشة في المنظومة.',
        },
        {
          id: 'fq5',
          q: 'إزاي الموردين بيشتغلوا جوه المنظومة ويفيدوا الورش؟',
          a: 'المورد بيدخل ببوابة مستقلة يضيف فيها خاماته (مع ضغط ذكي لـ 3 صور)، ويحدد شرائح خصم للكميات وينشر تنبيهات عروض، والورشة تقارن الأسعار وتطلب أونلاين فتسمّع الفاتورة في مخزنها وخزنتها فوراً وكمان تقيّم التوريد.',
        },
        {
          id: 'fq6',
          q: 'يعني إيه "صفحتي الشخصية" ومين يقدر يشوفها؟',
          a: 'دي واجهتك الاحترافية جوه المنظومة: فيها نبذتك وقصتك، أبرز 6 أعمال ليك، وبيانات تواصلك. أي حد في طبلية العيلة أو الشات يدوس على صورتك يشوفها حسب مصفوفة الظهور اللي إنت مختارها، وكمان تقدر تعاينها من تحت كفنان أو مورد أو عميل!',
        },
      ],
    },
    finalCta: {
      visible: true,
      title: 'مستني إيه؟ لمّ العدة وتعالى ورشتك أو متجرك مستنيك في عيلة الشمساوية!',
      subtitle:
        'انضم لمئات الحرفيين والصناع والموردين في مصر والوطن العربي.. نظم حساباتك، احسب أرباحك، وسيب صقر وشموسة يشيلوا عنك عبء الإدارة.',
      ctaText: 'سجل الآن وابدأ في ثواني مجاناً 🌟',
    },
    footer: {
      brandTitle: 'منظومة الشمساوية',
      brandSubtitle: 'نظام إدارة الإنتاج والتسعير والمالية لورش الهاند ميد والموردين',
      copyrightText: 'صُنع بكل فخر وإتقان بأيادٍ مصرية لدعم الحرفيين وصناع الإبداع © 2026',
      subTagline: 'منظومة الشمساوية • رحلة كفاح تتحول لنجاح',
    },
  },
  welcomeGate: {
    headlineLine1: 'يا مرحب بيك في مطرح الفن والجدعنة..',
    headlineHighlight: 'نورت عيلة الشمساوية! 🦅☀️',
    description:
      'المنظومة الأولى التي صنعت بحب على يد حرفيين لأجل صناع وفناني مصر والوطن العربي.. هنا تلاقي حساباتك مضبوطة ومساعدك الذكي دايماً جنبك.',
    ctaText: 'اتفضل نوّرنا في بيت عيلة الشمساوية 🚪✨',
    anthemHintText: 'يصاحبه نشيد المنظومة الحماسي',
  },
};

const LANDING_CMS_STORAGE_KEY = 'alshams_landing_cms_config';

export function normalizeLandingCmsConfig(raw?: Partial<LandingCmsConfig> | null): LandingCmsConfig {
  const r = (raw || {}) as Partial<LandingCmsConfig>;
  const isLegacyRevision = !r.cmsRevision || r.cmsRevision < 4;
  return {
    cmsRevision: 4,
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
    header: {
      ...DEFAULT_LANDING_CMS_CONFIG.header,
      ...(r.header || {}),
      navLinks:
        Array.isArray(r.header?.navLinks) && r.header!.navLinks.length > 0 && !isLegacyRevision
          ? r.header!.navLinks
          : DEFAULT_LANDING_CMS_CONFIG.header.navLinks,
    },
    hero: {
      ...DEFAULT_LANDING_CMS_CONFIG.hero,
      ...(r.hero || {}),
    },
    sections: {
      safeAccounts: {
        ...DEFAULT_LANDING_CMS_CONFIG.sections.safeAccounts,
        ...(r.sections?.safeAccounts || {}),
        cards:
          Array.isArray(r.sections?.safeAccounts?.cards) && r.sections!.safeAccounts!.cards.length > 0
            ? r.sections!.safeAccounts!.cards
            : DEFAULT_LANDING_CMS_CONFIG.sections.safeAccounts.cards,
      },
      aiPartners: {
        ...DEFAULT_LANDING_CMS_CONFIG.sections.aiPartners,
        ...(r.sections?.aiPartners || {}),
      },
      craftLifecycle: {
        ...DEFAULT_LANDING_CMS_CONFIG.sections.craftLifecycle,
        ...(r.sections?.craftLifecycle || {}),
        steps:
          Array.isArray(r.sections?.craftLifecycle?.steps) && r.sections!.craftLifecycle!.steps.length > 0
            ? r.sections!.craftLifecycle!.steps
            : DEFAULT_LANDING_CMS_CONFIG.sections.craftLifecycle.steps,
      },
      crmClients: {
        ...DEFAULT_LANDING_CMS_CONFIG.sections.crmClients,
        ...(r.sections?.crmClients || {}),
        bullets:
          Array.isArray(r.sections?.crmClients?.bullets) && r.sections!.crmClients!.bullets.length > 0
            ? r.sections!.crmClients!.bullets
            : DEFAULT_LANDING_CMS_CONFIG.sections.crmClients.bullets,
      },
      smartCatalog: {
        ...DEFAULT_LANDING_CMS_CONFIG.sections.smartCatalog,
        ...(r.sections?.smartCatalog || {}),
        bullets:
          Array.isArray(r.sections?.smartCatalog?.bullets) && r.sections!.smartCatalog!.bullets.length > 0
            ? r.sections!.smartCatalog!.bullets
            : DEFAULT_LANDING_CMS_CONFIG.sections.smartCatalog.bullets,
      },
      craftStore: {
        ...DEFAULT_LANDING_CMS_CONFIG.sections.craftStore,
        ...(r.sections?.craftStore || {}),
        bullets:
          Array.isArray(r.sections?.craftStore?.bullets) && r.sections!.craftStore!.bullets.length > 0
            ? r.sections!.craftStore!.bullets
            : DEFAULT_LANDING_CMS_CONFIG.sections.craftStore.bullets,
      },
      toolMaintenance: {
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
      reviews: {
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
      finalCta: {
        ...DEFAULT_LANDING_CMS_CONFIG.sections.finalCta,
        ...(r.sections?.finalCta || {}),
      },
      footer: {
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
