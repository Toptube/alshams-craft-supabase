import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  Calculator,
  CheckCircle2,
  Cloud,
  CloudOff,
  Coins,
  Cpu,
  Layers,
  Palette,
  RefreshCw,
  ScanBarcode,
  ShoppingBag,
  Sparkles,
  Store,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { WorldLandingThemeSpec } from '../../lib/landingThemes';
import { WORLD_STOREFRONT_THEMES_LIST } from '../../lib/storefrontThemes';

export type LandingAudience = 'artisan' | 'supplier';

export interface SystemModuleDef {
  id: string;
  code: string;
  title: string;
  shortDesc: string;
  fullDesc: string;
  highlights: string[];
  icon: React.FC<{ className?: string }>;
  simType: 'sync' | 'erp_prod' | 'fca_treasury' | 'crm_store' | 'hr_team' | 'pos_cashier' | 'ai_advisor';
}

export function getLandingSystemsCatalog(isEn = false): Record<LandingAudience, SystemModuleDef[]> {
  const themesCount = WORLD_STOREFRONT_THEMES_LIST.length;

  if (isEn) {
    return {
      artisan: [
        {
          id: 'art_erp',
          code: 'ERP',
          title: 'Manufacturing, Stock & Smart Costing',
          shortDesc: 'Precision cost calculator + work orders + auto material deduction',
          fullDesc:
            'From raw material stock to finished handmade goods: automatically calculate waste percentages, labor hours, and deduct stock per work order so you know your exact cost and net profit down to the penny.',
          highlights: [
            'Cost calculator covering raw materials, waste %, labor & target profit margin',
            'Automatic raw-material stock deduction the moment a work order runs',
            'Finished goods warehouse with proactive low-stock reorder alerts',
          ],
          icon: Calculator,
          simType: 'erp_prod',
        },
        {
          id: 'art_store',
          code: 'CRM & Store',
          title: `Global Storefront (${themesCount} Themes) & Customers`,
          shortDesc: 'Independent link + animated banners + coupons + CRM ledger',
          fullDesc:
            `Launch a world-class online store under your brand with ${themesCount} switchable architectural themes (growing automatically), drag-and-drop product sorting, animated banners, discount codes, and before/after offers.`,
          highlights: [
            `Instant switching across ${themesCount} global themes (auto-updated with every new release)`,
            'Animated & static promo banners + multi-type coupons (% / flat / free shipping / BOGO)',
            'Customer order hub + your forever-free Personal Profile & portfolio showcase',
          ],
          icon: Store,
          simType: 'crm_store',
        },
        {
          id: 'art_fca',
          code: 'FCA',
          title: 'Finance, Treasuries & Net Profits',
          shortDesc: 'Multi-channel treasuries (Cash / InstaPay / Wallet) + assets & expenses',
          fullDesc:
            'Separate workshop finances from personal spending: monitor Cash, InstaPay, and Wallet balances in real time, log purchases, sales, and overhead, and view true net profit daily.',
          highlights: [
            'Multi-channel treasuries (Cash / InstaPay / Mobile Wallet / Bank)',
            'Direct ledger sync between purchases, sales invoices & account statements',
            'Multi-currency support, exchange rate updates & monthly profit reports',
          ],
          icon: Wallet,
          simType: 'fca_treasury',
        },
        {
          id: 'art_hr',
          code: 'HR',
          title: 'Workshop Team, Artisans & Payroll',
          shortDesc: 'Daily wages + salaries + advances + piece-rate commissions',
          fullDesc:
            'Working with assistants or piece-rate artisans? Track daily wages, advances, and commissions in one click and settle payouts directly from your workshop treasury with zero confusion.',
          highlights: [
            'Complete workshop team roster with daily wages & monthly salaries',
            'Log advances, deductions & piece commissions linked directly to treasury',
            'Labor cost breakdown reports for every production cycle',
          ],
          icon: Users,
          simType: 'hr_team',
        },
        {
          id: 'art_cloud',
          code: 'Cloud + Offline',
          title: 'Instant Cloud Sync + Full Offline Mode',
          shortDesc: 'Internet dropped? Keep working — auto-syncs the second you reconnect',
          fullDesc:
            'Engineered for real workshops and pop-up fairs: even with zero internet, your invoices and stock save locally with full reliability and sync seamlessly to the cloud once back online.',
          highlights: [
            'Instant local saving on your device with zero loading lag',
            'Encrypted automatic cloud synchronization when connectivity returns',
            'Access your workshop seamlessly from mobile or laptop anytime',
          ],
          icon: Cloud,
          simType: 'sync',
        },
        {
          id: 'art_ai',
          code: 'AI',
          title: 'AI Business Partners (Saqr & Shamousa)',
          shortDesc: 'Pricing & profit audits + daily guidance & smart search',
          fullDesc:
            'Your dedicated AI duo inside the workshop: Saqr audits product pricing to maximize profit and trim waste, while Shamousa answers questions instantly and locates any data or material in seconds.',
          highlights: [
            'Smart audit of production costs and recommended retail margins',
            'One-click professional product descriptions & multilingual translations',
            'Proactive alerts for low stock and pending customer orders',
          ],
          icon: Cpu,
          simType: 'ai_advisor',
        },
      ],
      supplier: [
        {
          id: 'sup_pos',
          code: 'POS',
          title: 'High-Speed Branch Barcode POS',
          shortDesc: 'Lightning barcode checkout + auto wholesale & retail pricing tiers',
          fullDesc:
            'Built for raw-material wholesalers and factories: scan a barcode or type an item, automatically apply wholesale quantity tiers, print receipts, and deduct branch stock in under a second.',
          highlights: [
            'Automatic wholesale & bulk tier pricing based on cart quantity',
            'Ultra-fast image-free POS mode with branch & cashier device locking',
            'Split checkout (Cash / InstaPay / Workshop Credit) on a single invoice',
          ],
          icon: ScanBarcode,
          simType: 'pos_cashier',
        },
        {
          id: 'sup_erp',
          code: 'ERP',
          title: 'Central Warehouse, Branches & Factories',
          shortDesc: 'Branch hierarchy + stock transfers + bulk-to-unit conversion',
          fullDesc:
            'Command your central warehouse and every retail branch from one hub: receive factory shipments, issue official branch transfers, and break bulk cartons into kilos or meters automatically.',
          highlights: [
            'Multi-branch central warehouse with instant transfer & receipt vouchers',
            'Bulk-to-retail unit conversion with automatic weighted-average costing',
            'Unified raw-material SKU coding linked to factories & inbound stock',
          ],
          icon: Building2,
          simType: 'erp_prod',
        },
        {
          id: 'sup_store',
          code: 'B2B Store',
          title: `Global Supplier Store (${themesCount} Themes) & B2B Market`,
          shortDesc: 'Wholesale & retail catalog + animated banners + coupons',
          fullDesc:
            `Receive workshop and artisan orders 24/7 through your independent store powered by ${themesCount} global themes, drag-and-drop sorting, bulk pricing tiers, discount coupons, and B2B directory visibility.`,
          highlights: [
            `Full online storefront with ${themesCount} architectural themes (auto-growing)`,
            'Clear wholesale & retail quantity pricing tiers for every material',
            'Forever-free Supplier Personal Profile showcasing your story & branches',
          ],
          icon: ShoppingBag,
          simType: 'crm_store',
        },
        {
          id: 'sup_fca',
          code: 'FCA & CRM',
          title: 'Treasuries, Workshop Accounts & Credit',
          shortDesc: 'Workshop statements + credit collections + daily branch profits',
          fullDesc:
            'Know exactly what every workshop owes and paid: manage credit installments, monitor every branch treasury (Cash / Bank / InstaPay), and track live sales and net profits.',
          highlights: [
            'Wholesale & workshop CRM directory with detailed client account statements',
            'Track receivables and record credit collections in a single click',
            'Profit analytics comparing branch and treasury performance',
          ],
          icon: Coins,
          simType: 'fca_treasury',
        },
        {
          id: 'sup_hr',
          code: 'HR',
          title: 'Sales Team, Staff & Device Security',
          shortDesc: 'Branch cashiers + sales commissions + terminal access control',
          fullDesc:
            'Stay in full control of your sales and warehouse staff: assign each cashier to a branch and authorized device, and manage salaries, commissions, and advances from one dashboard.',
          highlights: [
            'Assign each seller and cashier to their exact branch & permissions',
            'Automated salary, sales commission & advance calculations',
            'Hardware terminal locking to prevent unauthorized POS logins',
          ],
          icon: UserCheck,
          simType: 'hr_team',
        },
        {
          id: 'sup_cloud',
          code: 'Cloud + Offline',
          title: 'Real-Time Multi-Branch Cloud Sync',
          shortDesc: 'Never stop selling offline + instant HQ synchronization',
          fullDesc:
            'Your checkout lines never freeze: keep issuing POS invoices even during internet outages, and every receipt and stock update automatically syncs with HQ the instant connectivity returns.',
          highlights: [
            'Uninterrupted offline POS billing with zero queue delays',
            'Instant sales & inventory sync across all branches and HQ cloud',
            'Continuous encrypted cloud backups for total peace of mind',
          ],
          icon: Cloud,
          simType: 'sync',
        },
      ],
    };
  }

  return {
    artisan: [
      {
        id: 'art_erp',
        code: 'ERP',
        title: 'التصنيع والمخازن والتسعير الذكي',
        shortDesc: 'حاسبة تكلفة دقيقة + أوامر تشغيل + خصم خامات تلقائي',
        fullDesc:
          'من أول ما تحط خاماتك في المخزن لحد ما تصنع القطعة وتنقلها لمخزن المنتجات الجاهزة: النظام بيحسب الهدر وساعات الشغل ويخصم الخامة أوتوماتيك عشان تعرف تكلفتك الحقيقية وربحك الصافي بالملّي.',
        highlights: [
          'حاسبة تكاليف تحسب الخامات + الهدر + المصنعية + هامش الربح',
          'خصم تلقائي من جرد الخامات بمجرد تشغيل أمر الإنتاج',
          'مخزن منتجات جاهزة وتنبيهات ذكية قبل ما الخامة تخلص',
        ],
        icon: Calculator,
        simType: 'erp_prod',
      },
      {
        id: 'art_store',
        code: 'CRM & Store',
        title: `المتجر العالمي (${themesCount} سمة) والعملاء`,
        shortDesc: 'رابط مستقل + بانرات متحركة + أكواد خصم + سجل عملاء',
        fullDesc:
          `متجر إلكتروني عالمي باسم ورشتك مع ${themesCount} سمة معمارية قابلة للتبديل بضغطة زر (وبتزيد تلقائياً)، ترتيب منتجات بالسحب والإفلات، بانرات متحركة، أكواد خصم متعددة، وعروض قبل وبعد + «الأكثر طلباً».`,
        highlights: [
          `تبديل فوري بين ${themesCount} سمة عالمية (تتحدث تلقائياً مع كل سمة جديدة)`,
          'بانرات متحركة وثابتة + أكواد خصم (% / مبلغ / شحن مجاني / اشتري وخذ)',
          'إدارة أوردرات العملاء + صفحتك الشخصية المجانية لمعرض أعمالك وتدريباتك',
        ],
        icon: Store,
        simType: 'crm_store',
      },
      {
        id: 'art_fca',
        code: 'FCA',
        title: 'المالية والخزائن والأرباح الصافية',
        shortDesc: 'خزائن متعددة (كاش / إنستاباي / محفظة) + أصول ومصروفات',
        fullDesc:
          'افصل فلوس الورشة عن مصروفك الشخصي: تابع رصيد الكاش، إنستاباي، والمحفظة الإلكترونية لحظياً، وسجل فواتير الشراء والبيع والمصروفات الإدارية وشوف صافي ربحك الحقيقي كل يوم.',
        highlights: [
          'خزائن متعددة الأوعية (كاش / إنستاباي / محفظة / بنك)',
          'ربط مباشر بين المشتريات والمبيعات وكشف الحساب العام',
          'دعم العملات المتعددة وتحديث أسعار الصرف والتقارير الشهرية',
        ],
        icon: Wallet,
        simType: 'fca_treasury',
      },
      {
        id: 'art_hr',
        code: 'HR',
        title: 'فريق الورشة والصنايعية والأجور',
        shortDesc: 'يوميات + رواتب + سلف + عمولات بالقطعة',
        fullDesc:
          'لو معاك صنايعية أو مساعدين أو شغال بالقطعة، سجل يومياتهم وسلفهم وعمولاتهم بضغطة واحدة واصرفها من الخزينة مباشرة بدون أي لخبطة آخر الأسبوع.',
        highlights: [
          'سجل كامل لفريق العمل واليوميات والرواتب الشهرية',
          'إثبات السلف والخصومات والعمولات وربطها مباشرة بالخزينة',
          'تقارير تكلفة العمالة لكل فترة تشغيل',
        ],
        icon: Users,
        simType: 'hr_team',
      },
      {
        id: 'art_cloud',
        code: 'Cloud + Offline',
        title: 'سحابة فورية + عمل كامل بدون إنترنت',
        shortDesc: 'النت قطع؟ كمّل شغلك وأول ما يرجع بيتزامن لوحده',
        fullDesc:
          'مصممة خصيصاً لواقع الورش والمعارض: حتى لو مفيش إنترنت في الورشة أو المعرض، بياناتك بتتحفظ محلياً بأمان وتعمل مزامنة سحابية تلقائية لحظة رجوع الاتصال.',
        highlights: [
          'حفظ فوري محلي على جهازك بدون انتظار تحميل',
          'مزامنة سحابية تلقائية مشفرة فور عودة الإنترنت',
          'افتح حسابك من الموبايل أو اللاب توب في أي وقت',
        ],
        icon: Cloud,
        simType: 'sync',
      },
      {
        id: 'art_ai',
        code: 'AI',
        title: 'المساعد الذكي (صقر & شموسة)',
        shortDesc: 'تحليل تسعير وأرباح + إرشاد يومي وبحث ذكي',
        fullDesc:
          'شريكك الذكي جوه الورشة: «صقر» بيراجع تسعير منتجاتك ويقترح عليك إزاي تزود ربحك وتقلل الهدر، و«شموسة» بتجاوبك فوراً وتساعدك تدور على أي معلومة أو خامة في ثانية.',
        highlights: [
          'مراجعة ذكية لتكاليف الإنتاج وهامش الربح المقترح',
          'توليد أوصاف احترافية لمنتجات متجرك بضغطة زر',
          'تنبيهات استباقية للنواقص والطلبات المعلقة',
        ],
        icon: Cpu,
        simType: 'ai_advisor',
      },
    ],
    supplier: [
      {
        id: 'sup_pos',
        code: 'POS',
        title: 'كاشير نقاط البيع السريع للفروع',
        shortDesc: 'بيع بالباركود بدون صور + جملة وقطاعي أوتوماتيك',
        fullDesc:
          'شاشة كاشير سريعة البرق مصممة لتجار ومصانع الخامات: امسح الباركود أو اكتب الصنف، الكاشير يطبق شريحة سعر الجملة تلقائياً حسب الكمية ويطبع الإيصال ويخصم من الفرع في ثانية.',
        highlights: [
          'تطبيق تلقائي لأسعار الجملة والشرائح حسب الكمية المباعة',
          'عمل فائق السرعة بدون صور مع تثبيت أجهزة الكاشير والفروع',
          'تحصيل متعدد (كاش / إنستاباي / آجل لعميل ورشة) في فاتورة واحدة',
        ],
        icon: ScanBarcode,
        simType: 'pos_cashier',
      },
      {
        id: 'sup_erp',
        code: 'ERP',
        title: 'المخزن المركزي والفروع والمصانع',
        shortDesc: 'شجرة فروع + تحويلات بضاعة + تحويل وحدة كبرى لصغرى',
        fullDesc:
          'أدِر مخزنك المركزي وكل فروعك من شاشة واحدة: استلم من المصانع، حوّل بضاعة بين الفروع بإذن رسمي، وحوّل الشكارة أو الكرتونة لكيلوهات ومتر أوتوماتيك بدقة 100%.',
        highlights: [
          'مخزن مركزي متعدد الفروع مع أذون تحويل واستلام لحظية',
          'معادلة فك العبوة الكبرى للصغرى وحساب متوسط التكلفة تلقائياً',
          'تكويد موحد للخامات وربط مباشر بالمصانع والواردات',
        ],
        icon: Building2,
        simType: 'erp_prod',
      },
      {
        id: 'sup_store',
        code: 'B2B Store',
        title: `متجر المورد العالمي (${themesCount} سمة) وسوق B2B`,
        shortDesc: 'كتالوج جملة وقطاعي + بانرات متحركة + أكواد خصم',
        fullDesc:
          `استقبل طلبات الورش والفنانين أونلاين 24 ساعة عبر متجرك الخاص بـ ${themesCount} سمة عالمية، رتب خاماتك بالسحب والإفلات، فعّل عروض قبل وبعد وأكواد الخصم واظهر في سوق موردين الشمساوية.`,
        highlights: [
          `متجر إلكتروني كامل بـ ${themesCount} سمة معمارية (تزيد تلقائياً)`,
          'شرائح أسعار جملة وقطاعي واضحة لكل خامة',
          'صفحة مورد شخصية مجانية لعرض نبذتك وتوريداتك للمجتمع',
        ],
        icon: ShoppingBag,
        simType: 'crm_store',
      },
      {
        id: 'sup_fca',
        code: 'FCA & CRM',
        title: 'الخزائن وحسابات عملاء الورش والآجل',
        shortDesc: 'كشوف حساب الورش + التحصيلات + الأرباح اليومية',
        fullDesc:
          'اعرف كل ورشة وتاجر عليه كام ودفع كام: سجل الدفعات الآجلة، راقب خزائن كل فرع (كاش / تحويل بنكي / إنستاباي)، واطلع على صافي مبيعاتك وأرباحك لحظة بلحظة.',
        highlights: [
          'سجل CRM لعملاء الجملة والورش وكشف حساب تفصيلي لكل عميل',
          'متابعة المديونيات وتحصيل الدفعات بضغطة زر',
          'تقارير أرباح ومقارنة أداء الفروع والخزائن',
        ],
        icon: Coins,
        simType: 'fca_treasury',
      },
      {
        id: 'sup_hr',
        code: 'HR',
        title: 'شؤون العاملين والبائعين وتثبيت الأجهزة',
        shortDesc: 'بائعي الفروع + عمولات المبيعات + صلاحيات الأجهزة',
        fullDesc:
          'تحكم في فريق مبيعاتك ومخازنك: اربط كل كاشير بفرعه وجهازه، تابع عمولات البائعين ورواتبهم وسلفهم من نفس لوحة التحكم.',
        highlights: [
          'ربط كل موظف وبائع بفرعه وصلاحياته المحددة',
          'حساب الرواتب والعمولات والسلف تلقائياً',
          'أمان تثبيت الأجهزة ومنع الدخول غير المصرح به للكاشير',
        ],
        icon: UserCheck,
        simType: 'hr_team',
      },
      {
        id: 'sup_cloud',
        code: 'Cloud + Offline',
        title: 'مزامنة سحابية لحظية بين الفروع',
        shortDesc: 'البيع مستمر حتى لو النت فصل + تزامن فوري للفرع الرئيسي',
        fullDesc:
          'الكاشير والفروع لا تتوقف أبداً عن البيع: استمر في إصدار الفواتير حتى بدون إنترنت، وبمجرد عودة الشبكة تتزامن كل الفواتير والمخزون مع الإدارة العليا أوتوماتيكياً.',
        highlights: [
          'استمرارية البيع أوفلاين بدون توقف لطابور العملاء',
          'تزامن فوري للمبيعات والمخزون بين الفروع والسحابة',
          'نسخ احتياطي سحابي آمن ومستمر',
        ],
        icon: Cloud,
        simType: 'sync',
      },
    ],
  };
}

/**
 * محاكاة تفاعلية حية مصغرة لكل نظام داخل صفحة الهبوط (أيقونات متحركة وأزرار حقيقية)
 */
const LiveSystemMiniSimulation: React.FC<{
  module: SystemModuleDef;
  audience: LandingAudience;
  theme: WorldLandingThemeSpec;
  onStartFree: () => void;
  isEn?: boolean;
}> = ({ module, audience, theme, onStartFree, isEn = false }) => {
  // Interactive states for each simulation
  const [isOnlineSync, setIsOnlineSync] = useState(true);
  const [offlineQueued, setOfflineQueued] = useState(0);

  const [rawStock, setRawStock] = useState(48);
  const [finishedStock, setFinishedStock] = useState(14);
  const [isProducing, setIsProducing] = useState(false);

  const [posQty, setPosQty] = useState(1);
  const [treasuryBalance, setTreasuryBalance] = useState(18450);
  const [treasuryChannel, setTreasuryChannel] = useState<'cash' | 'instapay' | 'wallet'>('instapay');

  const [previewThemeIdx, setPreviewThemeIdx] = useState(0);
  const [teamBonus, setTeamBonus] = useState(450);
  const [aiTipIdx, setAiTipIdx] = useState(0);

  const activePreviewTheme = WORLD_STOREFRONT_THEMES_LIST[previewThemeIdx % WORLD_STOREFRONT_THEMES_LIST.length];
  const DirArrow = isEn ? ArrowRight : ArrowLeft;
  const numLocale = isEn ? 'en-US' : 'ar-EG';
  const egpUnit = isEn ? 'EGP' : 'ج.م';

  const handleToggleSync = () => {
    if (isOnlineSync) {
      setIsOnlineSync(false);
      setOfflineQueued(3);
    } else {
      setIsOnlineSync(true);
      setTimeout(() => setOfflineQueued(0), 700);
    }
  };

  const handleRunProduction = () => {
    if (isProducing || rawStock < 3) return;
    setIsProducing(true);
    setTimeout(() => {
      setRawStock((s) => Math.max(0, s - 3));
      setFinishedStock((f) => f + 1);
      setIsProducing(false);
    }, 350);
  };

  const unitPosPrice = posQty >= 10 ? 115 : 145;
  const posLineTotal = unitPosPrice * posQty;

  const aiTips = isEn
    ? audience === 'supplier'
      ? [
          'Saqr AI: "4mm Macrame Cord" is in high demand — add a bulk tier (×20) at 8% off to boost average order value.',
          'Shamousa: 3 raw materials are approaching reorder thresholds in your central warehouse — ready to draft the PO.',
          'Saqr AI: Activating an animated promo banner with coupon "WORKSHOP10" lifts B2B store conversions by 26%.',
        ]
      : [
          'Saqr AI: Including 7% waste and 3 labor hours, the fair retail price is 680 EGP for a healthy 34% net margin.',
          'Shamousa: Added the "Best Seller" badge to 3 pieces in your store to increase first-visit conversions.',
          'Saqr AI: Cotton cord inventory covers only 4 more work orders — consider restocking before the weekend.',
        ]
    : audience === 'supplier'
      ? [
          'صقر AI: خامة «خيط مكرمية 4مم» عليها طلب مرتفع — اقترح شريحة جملة (×20) بخصم 8% لزيادة متوسط الفاتورة.',
          'شموسة: لديك 3 أصناف قربت من حد إعادة الطلب في المخزن المركزي — جاهز أجهزلك أمر التوريد.',
          'صقر AI: تفعيل بانر متحرك بكود خصم «WORKSHOP10» يرفع تحويل زوار متجر المورد بنسبة 26%.',
        ]
      : [
          'صقر AI: بعد احتساب 7% هدر و3 ساعات عمل، السعر العادل لقطعتك هو 680 ج.م بصافي ربح 34%.',
          'شموسة: أضفتلك وسم «الأكثر طلباً» على 3 قطع في متجرك لرفع المبيعات المباشرة من أول زيارة.',
          'صقر AI: رصيد «خيط القطن» يكفي 4 أوامر شغل فقط — أنصح بتسجيل فاتورة مشتريات قبل نهاية الأسبوع.',
        ];

  return (
    <div
      style={{
        backgroundColor: theme.softSurfaceBg,
        borderColor: theme.borderColor,
        color: theme.inkColor,
      }}
      className={`${theme.cardRadius} border p-4 sm:p-5 space-y-4`}
    >
      {/* Top interactive simulation header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: theme.borderColor }}>
        <div className="flex items-center gap-2 text-xs font-black">
          <span
            style={{ backgroundColor: theme.accentSoftBg, color: theme.accentText }}
            className="px-2 py-0.5 rounded-md font-mono"
          >
            {module.code}
          </span>
          <span>{isEn ? 'Live Interactive Preview' : 'تجربة تفاعلية حية'}</span>
        </div>
        <span className="text-[11px] font-bold" style={{ color: theme.mutedColor }}>
          {isEn ? 'Try the controls below' : 'جرّب الأزرار بالأسفل'}
        </span>
      </div>

      {/* Simulation body per module */}
      {module.simType === 'sync' && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border" style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}>
            <div className="flex items-center gap-3">
              <motion.div
                animate={
                  isOnlineSync
                    ? { scale: [1, 1.08, 1], rotate: [0, 6, 0] }
                    : { scale: [1, 0.96, 1] }
                }
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  isOnlineSync ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isOnlineSync ? <Cloud className="w-6 h-6" /> : <CloudOff className="w-6 h-6" />}
              </motion.div>
              <div>
                <p className="text-xs sm:text-sm font-black">
                  {isEn
                    ? isOnlineSync
                      ? 'Fully Synced with Cloud'
                      : 'Working Offline (Zero Interruptions)'
                    : isOnlineSync
                    ? 'متزامن سحابياً بالكامل الآن'
                    : 'وضع العمل بدون إنترنت (أوفلاين)'}
                </p>
                <p className="text-[11px]" style={{ color: theme.mutedColor }}>
                  {isEn
                    ? isOnlineSync
                      ? 'All invoices and stock are backed up and live on the cloud'
                      : `${offlineQueued} records saved locally and queued for instant auto-sync`
                    : isOnlineSync
                    ? 'كل الفواتير والمخازن محمية ومحدثة على السحابة'
                    : `${offlineQueued} عمليات محفوظة محلياً وجاهزة للرفع فور عودة الشبكة`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSync}
              style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
              className={`px-3.5 py-2 ${theme.buttonRadius} text-xs font-black flex items-center gap-1.5 cursor-pointer hover:opacity-90`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${!isOnlineSync ? '' : 'animate-spin'}`} style={{ animationDuration: '4s' }} />
              <span>
                {isEn
                  ? isOnlineSync
                    ? 'Simulate Offline'
                    : 'Reconnect & Sync'
                  : isOnlineSync
                  ? 'جرّب فصل النت'
                  : 'أعد الاتصال وزامن'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
            {(isEn
              ? [
                  { label: 'Cloud Status', val: isOnlineSync ? 'Synced' : 'Queued' },
                  { label: 'Pending Sync', val: `${offlineQueued}` },
                  { label: 'Data Safety', val: '100% Safe' },
                ]
              : [
                  { label: 'حالة السحابة', val: isOnlineSync ? 'متزامن' : 'معلّق مؤقتاً' },
                  { label: 'عمليات بالانتظار', val: `${offlineQueued}` },
                  { label: 'أمان البيانات', val: '100% محفظ' },
                ]
            ).map((stat, i) => (
              <div
                key={i}
                style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                className="p-2.5 rounded-xl border"
              >
                <p className="text-[10px] font-sans" style={{ color: theme.mutedColor }}>{stat.label}</p>
                <p className="text-xs font-black mt-0.5">{stat.val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {module.simType === 'erp_prod' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 font-mono tabular-nums">
            <motion.div
              key={`raw-${rawStock}`}
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
              className="p-3 rounded-xl border"
            >
              <p className="text-[11px] font-sans" style={{ color: theme.mutedColor }}>
                {isEn
                  ? audience === 'supplier'
                    ? 'Central Warehouse Stock'
                    : 'Workshop Raw Materials'
                  : audience === 'supplier'
                  ? 'رصيد المخزن المركزي'
                  : 'رصيد خامات الورشة'}
              </p>
              <p className="text-xl font-black mt-1" style={{ color: theme.accentText }}>
                {rawStock} <span className="text-xs font-sans">{isEn ? 'kg' : 'كجم'}</span>
              </p>
            </motion.div>
            <motion.div
              key={`fin-${finishedStock}`}
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
              className="p-3 rounded-xl border"
            >
              <p className="text-[11px] font-sans" style={{ color: theme.mutedColor }}>
                {isEn
                  ? audience === 'supplier'
                    ? 'Transferred to Retail Branch'
                    : 'Finished Goods Inventory'
                  : audience === 'supplier'
                  ? 'محوّل للفرع الجاهز للبيع'
                  : 'مخزن المنتجات الجاهزة'}
              </p>
              <p className="text-xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {finishedStock} <span className="text-xs font-sans">{isEn ? 'units' : 'وحدة'}</span>
              </p>
            </motion.div>
          </div>
          <button
            type="button"
            onClick={handleRunProduction}
            style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
            className={`w-full py-2.5 px-4 ${theme.buttonRadius} text-xs font-black flex items-center justify-center gap-2 cursor-pointer hover:opacity-90`}
          >
            <Boxes className="w-4 h-4" />
            <span>
              {isEn
                ? isProducing
                  ? 'Deducting & converting...'
                  : audience === 'supplier'
                  ? 'Try Branch Transfer (-3 kg → +1 pack)'
                  : 'Run Work Order (-3 kg material → +1 finished piece)'
                : isProducing
                ? 'جاري الخصم والتحويل...'
                : audience === 'supplier'
                ? 'جرّب تحويل شحنة للفرع (-3 كجم ⟵ +1 باكدج)'
                : 'جرّب تشغيل أمر تصنيع (-3 كجم خامة ⟵ +1 منتج جاهز)'}
            </span>
          </button>
        </div>
      )}

      {module.simType === 'pos_cashier' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl border space-y-2.5" style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black">
                  {isEn ? '4mm Twisted Cotton Cord · SKU #CT-402' : 'خيط قطن مجدول 4مم · كود #CT-402'}
                </p>
                <p className="text-[11px]" style={{ color: theme.mutedColor }}>
                  {isEn ? 'Active Price: ' : 'السعر الحالي: '}
                  <strong className="font-mono">{unitPosPrice} {egpUnit}</strong>{' '}
                  ({isEn
                    ? posQty >= 10
                      ? 'Wholesale tier auto-applied!'
                      : 'Retail price'
                    : posQty >= 10
                    ? 'شريحة جملة مطبقة تلقائياً!'
                    : 'سعر قطاعي'})
                </p>
              </div>
              <span className="text-base font-black font-mono tabular-nums" style={{ color: theme.accentText }}>
                {posLineTotal.toLocaleString(numLocale)} {egpUnit}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 5, 10, 25].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setPosQty(q)}
                  style={
                    posQty === q
                      ? { backgroundColor: theme.accentBg, color: theme.accentInk }
                      : { backgroundColor: theme.softSurfaceBg, color: theme.inkColor, borderColor: theme.borderColor }
                  }
                  className={`px-3 py-1.5 ${theme.buttonRadius} border text-xs font-black cursor-pointer`}
                >
                  {q} {isEn ? (q >= 10 ? 'kg (Wholesale)' : 'kg') : q >= 10 ? 'كجم (جملة)' : 'كجم'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {module.simType === 'fca_treasury' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}>
            <div>
              <p className="text-[11px]" style={{ color: theme.mutedColor }}>
                {isEn ? 'Total Available Treasury Liquidity' : 'إجمالي السيولة المتاحة بالخزائن'}
              </p>
              <motion.p
                key={treasuryBalance}
                initial={{ y: -4, opacity: 0.7 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400"
              >
                {treasuryBalance.toLocaleString(numLocale)} {egpUnit}
              </motion.p>
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'cash' as const, label: isEn ? 'Cash' : 'كاش' },
                { id: 'instapay' as const, label: isEn ? 'InstaPay' : 'إنستاباي' },
                { id: 'wallet' as const, label: isEn ? 'Wallet' : 'محفظة' },
              ].map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setTreasuryChannel(ch.id)}
                  style={
                    treasuryChannel === ch.id
                      ? { backgroundColor: theme.accentBg, color: theme.accentInk }
                      : { backgroundColor: theme.softSurfaceBg, color: theme.inkColor, borderColor: theme.borderColor }
                  }
                  className={`px-2.5 py-1.5 ${theme.buttonRadius} border text-[11px] font-black cursor-pointer`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTreasuryBalance((b) => b + 1250)}
            style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
            className={`w-full py-2.5 px-4 ${theme.buttonRadius} text-xs font-black flex items-center justify-center gap-2 cursor-pointer hover:opacity-90`}
          >
            <Wallet className="w-4 h-4" />
            <span>
              {isEn
                ? `Collect Invoice (+1,250 EGP to ${
                    treasuryChannel === 'cash' ? 'Cash' : treasuryChannel === 'instapay' ? 'InstaPay' : 'Wallet'
                  })`
                : `جرّب تحصيل فاتورة (+1,250 ج.م على وعاء ${
                    treasuryChannel === 'cash' ? 'الكاش' : treasuryChannel === 'instapay' ? 'إنستاباي' : 'المحفظة'
                  })`}
            </span>
          </button>
        </div>
      )}

      {module.simType === 'crm_store' && (
        <div className="space-y-3">
          <div
            style={{
              backgroundColor: activePreviewTheme.pageBg,
              borderColor: activePreviewTheme.borderColor,
              color: activePreviewTheme.inkColor,
            }}
            className="p-3.5 rounded-xl border-2 transition-colors duration-300 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black">
                  {isEn ? activePreviewTheme.englishSignature || activePreviewTheme.nameAr : activePreviewTheme.nameAr}
                </p>
                <p className="text-[10px]" style={{ color: activePreviewTheme.mutedColor }}>
                  {isEn
                    ? `Theme ${previewThemeIdx + 1} of ${WORLD_STOREFRONT_THEMES_LIST.length} ready global themes`
                    : `سمة ${previewThemeIdx + 1} من ${WORLD_STOREFRONT_THEMES_LIST.length} سمة عالمية جاهزة`}
                </p>
              </div>
              <span
                style={{ backgroundColor: activePreviewTheme.accentBg, color: activePreviewTheme.accentInk }}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black"
              >
                {isEn ? 'Live Store Theme' : 'معاينة سمة المتجر'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div
                style={{ backgroundColor: activePreviewTheme.surfaceBg, borderColor: activePreviewTheme.borderColor }}
                className="p-2.5 rounded-lg border text-[11px]"
              >
                <p className="font-black truncate">
                  {isEn ? 'Luxury Macrame Wall Art' : 'معلقة مكرمية فاخرة'}
                </p>
                <p className="font-mono font-black mt-0.5" style={{ color: activePreviewTheme.priceColor }}>
                  650 {egpUnit} <span className="line-through opacity-55 text-[10px]">800</span>
                </p>
              </div>
              <div
                style={{ backgroundColor: activePreviewTheme.surfaceBg, borderColor: activePreviewTheme.borderColor }}
                className="p-2.5 rounded-lg border text-[11px]"
              >
                <p className="font-black truncate">
                  {isEn ? 'Handmade Ceramic Vase' : 'فازة خزف يدوية'}
                </p>
                <p className="font-mono font-black mt-0.5" style={{ color: activePreviewTheme.priceColor }}>
                  490 {egpUnit}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPreviewThemeIdx((i) => (i + 1) % WORLD_STOREFRONT_THEMES_LIST.length)}
            style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
            className={`w-full py-2.5 px-4 ${theme.buttonRadius} text-xs font-black flex items-center justify-center gap-2 cursor-pointer hover:opacity-90`}
          >
            <Palette className="w-4 h-4" />
            <span>
              {isEn
                ? `Switch Store Theme Live (${previewThemeIdx + 1}/${WORLD_STOREFRONT_THEMES_LIST.length})`
                : `بدّل سمة المتجر أمام عينك (${previewThemeIdx + 1}/${WORLD_STOREFRONT_THEMES_LIST.length})`}
            </span>
          </button>
        </div>
      )}

      {module.simType === 'hr_team' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl border flex items-center justify-between gap-2" style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}>
            <div>
              <p className="text-xs font-black">
                {isEn
                  ? audience === 'supplier'
                    ? 'Downtown Branch Seller · Cashier #02'
                    : 'Lead Artisan · Leather & Macrame Unit'
                  : audience === 'supplier'
                  ? 'بائع فرع وسط البلد · كاشير #02'
                  : 'صنايعي رئيسي · قسم الجلود والمكرمية'}
              </p>
              <p className="text-[11px]" style={{ color: theme.mutedColor }}>
                {isEn ? 'Current Period Wages & Commissions' : 'مستحقات وعمولات الفترة الحالية'}
              </p>
            </div>
            <span className="text-lg font-black font-mono tabular-nums" style={{ color: theme.accentText }}>
              {(2800 + teamBonus).toLocaleString(numLocale)} {egpUnit}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTeamBonus((b) => b + 150)}
            style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
            className={`w-full py-2.5 px-4 ${theme.buttonRadius} text-xs font-black flex items-center justify-center gap-2 cursor-pointer hover:opacity-90`}
          >
            <Users className="w-4 h-4" />
            <span>
              {isEn ? 'Add Daily Wage / Commission (+150 EGP)' : 'جرّب إضافة يومية / عمولة (+150 ج.م)'}
            </span>
          </button>
        </div>
      )}

      {module.simType === 'ai_advisor' && (
        <div className="space-y-3">
          <motion.div
            key={aiTipIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
            className="p-3.5 rounded-xl border text-xs leading-relaxed font-bold"
          >
            {aiTips[aiTipIdx % aiTips.length]}
          </motion.div>
          <button
            type="button"
            onClick={() => setAiTipIdx((i) => (i + 1) % aiTips.length)}
            style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
            className={`w-full py-2.5 px-4 ${theme.buttonRadius} text-xs font-black flex items-center justify-center gap-2 cursor-pointer hover:opacity-90`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isEn ? 'Next Insight from Saqr & Shamousa' : 'استشارة جديدة من صقر & شموسة'}</span>
          </button>
        </div>
      )}

      {/* Action CTA */}
      <div className="pt-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold" style={{ color: theme.mutedColor }}>
          {isEn ? 'Included in our Free Launch Offer' : 'متاح الآن ضمن عرض الإطلاق المجاني'}
        </span>
        <button
          type="button"
          onClick={onStartFree}
          className="text-xs font-black inline-flex items-center gap-1 hover:underline cursor-pointer"
          style={{ color: theme.accentText }}
        >
          <span>{isEn ? 'Try it free in your account' : 'جرّبها في حسابك مجاناً'}</span>
          <DirArrow className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface LandingSystemsExplorerProps {
  theme: WorldLandingThemeSpec;
  onStartArtisan: () => void;
  onStartSupplier: () => void;
  initialAudience?: LandingAudience;
  isEn?: boolean;
}

export const LandingSystemsExplorerSection: React.FC<LandingSystemsExplorerProps> = ({
  theme,
  onStartArtisan,
  onStartSupplier,
  initialAudience = 'artisan',
  isEn = false,
}) => {
  const catalog = getLandingSystemsCatalog(isEn);
  const [audience, setAudience] = useState<LandingAudience>(initialAudience);
  const [selectedId, setSelectedId] = useState<string>(catalog[initialAudience][0].id);

  const modules = catalog[audience];
  const activeModule = modules.find((m) => m.id === selectedId) || modules[0];

  const switchAudience = (next: LandingAudience) => {
    setAudience(next);
    setSelectedId(catalog[next][0].id);
  };

  return (
    <section
      id="systems-explorer"
      className="py-12 sm:py-16 px-4 sm:px-6 border-y w-full max-w-full overflow-x-clip"
      style={{ borderColor: theme.borderColor }}
    >
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-black" style={{ color: theme.accentText }}>
              {isEn ? '01 · Interactive Al-Shamsawiya Systems Explorer' : '01 · مستكشف منظومة الشمساوية التفاعلي'}
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight" style={{ color: theme.inkColor }}>
              {isEn
                ? 'Every Operations, Finance & Sales Tool — Try It Live Before Starting'
                : 'كل أدوات التشغيل والإدارة والبيع — جرّبها لايف قبل ما تبدأ'}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: theme.mutedColor }}>
              {isEn
                ? 'Pick your track (Artisans & Workshops or Raw Material Suppliers) and tap any module to test how it works in real life.'
                : 'اختر مسارك (فنانين وورش أو موردين وتجار خامات) واضغط على أي نظام لتشوف كيف يعمل على أرض الواقع.'}
            </p>
          </div>

          {/* Audience Switcher */}
          <div
            style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor }}
            className={`flex sm:inline-flex w-full sm:w-auto max-w-full p-1 ${theme.buttonRadius} border self-start md:self-auto`}
          >
            <button
              type="button"
              onClick={() => switchAudience('artisan')}
              style={
                audience === 'artisan'
                  ? { backgroundColor: theme.accentBg, color: theme.accentInk }
                  : { color: theme.inkColor }
              }
              className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-2 ${theme.buttonRadius} text-[11px] sm:text-sm font-black transition cursor-pointer text-center`}
            >
              {isEn ? 'Artisans & Workshops' : 'الفنانين والورش'}
            </button>
            <button
              type="button"
              onClick={() => switchAudience('supplier')}
              style={
                audience === 'supplier'
                  ? { backgroundColor: theme.accentBg, color: theme.accentInk }
                  : { color: theme.inkColor }
              }
              className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-2 ${theme.buttonRadius} text-[11px] sm:text-sm font-black transition cursor-pointer text-center`}
            >
              {isEn ? 'Raw Material Suppliers' : 'الموردين وتجار الخامات'}
            </button>
          </div>
        </div>

        {/* Interactive Split: Side Navigation Menu + Live Showcase Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Side Systems Menu */}
          <div className="lg:col-span-5 space-y-2">
            {modules.map((mod) => {
              const Icon = mod.icon;
              const isSelected = activeModule.id === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setSelectedId(mod.id)}
                  style={{
                    backgroundColor: isSelected ? theme.surfaceBg : 'transparent',
                    borderColor: isSelected ? theme.accentBg : theme.borderColor,
                    color: theme.inkColor,
                  }}
                  className={`w-full ${isEn ? 'text-left' : 'text-right'} p-3.5 ${theme.cardRadius} border flex items-start gap-3 transition-all cursor-pointer ${
                    isSelected ? theme.cardShadow : 'hover:opacity-95'
                  }`}
                >
                  <div
                    style={{
                      backgroundColor: isSelected ? theme.accentBg : theme.softSurfaceBg,
                      color: isSelected ? theme.accentInk : theme.accentText,
                    }}
                    className={`w-10 h-10 ${theme.buttonRadius} flex items-center justify-center shrink-0 transition-colors`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-black truncate">{mod.title}</span>
                      <span
                        className="text-[10px] font-mono font-bold shrink-0"
                        style={{ color: isSelected ? theme.accentText : theme.mutedColor }}
                      >
                        {mod.code}
                      </span>
                    </div>
                    <p className="text-[11px] line-clamp-1" style={{ color: theme.mutedColor }}>
                      {mod.shortDesc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active System Detail + Live Interactive Simulation */}
          <div className="lg:col-span-7 flex">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${audience}-${activeModule.id}-${isEn ? 'en' : 'ar'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                style={{
                  backgroundColor: theme.surfaceBg,
                  borderColor: theme.borderColor,
                  color: theme.inkColor,
                }}
                className={`w-full ${theme.cardRadius} border ${theme.cardShadow} p-5 sm:p-7 flex flex-col justify-between gap-5`}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: theme.accentSoftBg, color: theme.accentText }}
                      className={`w-12 h-12 ${theme.buttonRadius} flex items-center justify-center shrink-0`}
                    >
                      <activeModule.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-bold" style={{ color: theme.accentText }}>
                        {isEn
                          ? audience === 'supplier'
                            ? 'Suppliers Suite'
                            : 'Workshops Suite'
                          : audience === 'supplier'
                          ? 'منظومة الموردين'
                          : 'منظومة الورش'}{' '}
                        · {activeModule.code}
                      </p>
                      <h3 className="text-lg sm:text-2xl font-black leading-snug">
                        {activeModule.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed" style={{ color: theme.mutedColor }}>
                    {activeModule.fullDesc}
                  </p>

                  <ul className="space-y-2">
                    {activeModule.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm font-bold">
                        <CheckCircle2
                          className="w-4 h-4 shrink-0 mt-0.5"
                          style={{ color: theme.accentText }}
                        />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <LiveSystemMiniSimulation
                  module={activeModule}
                  audience={audience}
                  theme={theme}
                  isEn={isEn}
                  onStartFree={audience === 'supplier' ? onStartSupplier : onStartArtisan}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

interface LandingSystemsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: WorldLandingThemeSpec;
  onStartArtisan: () => void;
  onStartSupplier: () => void;
  onOpenLogin: () => void;
  onOpenMarketplace?: () => void;
  onOpenSuppliersMarket?: () => void;
  isEn?: boolean;
}

/**
 * القائمة الجانبية التفاعلية لصفحة الهبوط (مقسومة: فنانين وورش | موردين وتجار خامات)
 */
export const LandingSystemsDrawer: React.FC<LandingSystemsDrawerProps> = ({
  isOpen,
  onClose,
  theme,
  onStartArtisan,
  onStartSupplier,
  onOpenLogin,
  onOpenMarketplace,
  onOpenSuppliersMarket,
  isEn = false,
}) => {
  const catalog = getLandingSystemsCatalog(isEn);
  const [audience, setAudience] = useState<LandingAudience>('artisan');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  if (!isOpen) return null;

  const modules = catalog[audience];
  const selectedModule = modules.find((m) => m.id === selectedModuleId) || null;
  const DirArrow = isEn ? ArrowRight : ArrowLeft;

  return (
    <div
      className={`fixed inset-0 z-[110] bg-black/70 backdrop-blur-xs flex ${isEn ? 'justify-start' : 'justify-end'}`}
      dir={isEn ? 'ltr' : 'rtl'}
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.pageBg,
          borderColor: theme.borderColor,
          color: theme.inkColor,
        }}
        className={`w-full max-w-md h-full ${isEn ? 'border-r' : 'border-r'} flex flex-col shadow-2xl overflow-hidden`}
      >
        {/* Drawer Header */}
        <div
          style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
          className="p-4 border-b flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5" style={{ color: theme.accentText }} />
            <h2 className="text-sm font-black">
              {isEn ? 'Al-Shamsawiya Systems & Modules' : 'أنظمة ومنصات الشمساوية'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor }}
            className="p-2 rounded-xl border cursor-pointer"
            aria-label={isEn ? 'Close menu' : 'إغلاق القائمة'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two Main Tracks: Artisans vs Suppliers */}
        <div className="p-3 border-b shrink-0" style={{ borderColor: theme.borderColor }}>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAudience('artisan');
                setSelectedModuleId(null);
              }}
              style={
                audience === 'artisan'
                  ? { backgroundColor: theme.accentBg, color: theme.accentInk, borderColor: theme.accentBg }
                  : { backgroundColor: theme.surfaceBg, color: theme.inkColor, borderColor: theme.borderColor }
              }
              className={`py-2.5 px-3 ${theme.buttonRadius} border text-xs font-black cursor-pointer transition`}
            >
              {isEn ? 'Artisans & Workshops' : 'الفنانين والورش'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAudience('supplier');
                setSelectedModuleId(null);
              }}
              style={
                audience === 'supplier'
                  ? { backgroundColor: theme.accentBg, color: theme.accentInk, borderColor: theme.accentBg }
                  : { backgroundColor: theme.surfaceBg, color: theme.inkColor, borderColor: theme.borderColor }
              }
              className={`py-2.5 px-3 ${theme.buttonRadius} border text-xs font-black cursor-pointer transition`}
            >
              {isEn ? 'Suppliers & Materials' : 'الموردين والخامات'}
            </button>
          </div>
        </div>

        {/* Drawer Content: List OR Selected System Live Preview */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {selectedModule ? (
            <div className="space-y-3.5">
              <button
                type="button"
                onClick={() => setSelectedModuleId(null)}
                className="text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                style={{ color: theme.accentText }}
              >
                <span>
                  {isEn
                    ? `← Back to ${audience === 'supplier' ? 'Supplier' : 'Workshop'} Systems`
                    : `→ الرجوع لقائمة أنظمة ${audience === 'supplier' ? 'الموردين' : 'الفنانين والورش'}`}
                </span>
              </button>

              <div className="space-y-2">
                <span className="text-[11px] font-mono font-bold" style={{ color: theme.accentText }}>
                  {selectedModule.code}
                </span>
                <h3 className="text-base font-black">{selectedModule.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: theme.mutedColor }}>
                  {selectedModule.fullDesc}
                </p>
              </div>

              <LiveSystemMiniSimulation
                module={selectedModule}
                audience={audience}
                theme={theme}
                isEn={isEn}
                onStartFree={() => {
                  onClose();
                  if (audience === 'supplier') onStartSupplier();
                  else onStartArtisan();
                }}
              />
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold px-1" style={{ color: theme.mutedColor }}>
                {isEn
                  ? 'Tap any system below to explore its live interactive preview:'
                  : 'اضغط على أي نظام لمشاهدة شرحه التفاعلي الحي:'}
              </p>
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setSelectedModuleId(mod.id)}
                    style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
                    className={`w-full ${isEn ? 'text-left' : 'text-right'} p-3.5 ${theme.cardRadius} border flex items-center gap-3 hover:opacity-95 cursor-pointer transition`}
                  >
                    <div
                      style={{ backgroundColor: theme.accentSoftBg, color: theme.accentText }}
                      className={`w-10 h-10 ${theme.buttonRadius} flex items-center justify-center shrink-0`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black truncate">{mod.title}</span>
                        <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: theme.accentText }}>
                          {mod.code}
                        </span>
                      </div>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: theme.mutedColor }}>
                        {mod.shortDesc}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Quick Market Links */}
              <div className="pt-3 border-t space-y-2" style={{ borderColor: theme.borderColor }}>
                {onOpenMarketplace && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMarketplace();
                    }}
                    style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor }}
                    className={`w-full py-2.5 px-3.5 ${theme.buttonRadius} border text-xs font-black flex items-center justify-between cursor-pointer`}
                  >
                    <span>{isEn ? 'Browse Handmade Marketplace' : 'تصفح سوق الشمساوية للمشغولات'}</span>
                    <DirArrow className="w-4 h-4" />
                  </button>
                )}
                {onOpenSuppliersMarket && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSuppliersMarket();
                    }}
                    style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor }}
                    className={`w-full py-2.5 px-3.5 ${theme.buttonRadius} border text-xs font-black flex items-center justify-between cursor-pointer`}
                  >
                    <span>{isEn ? 'Browse B2B Suppliers Market' : 'تصفح سوق موردين الخامات (B2B)'}</span>
                    <DirArrow className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Auth CTAs */}
        <div
          style={{ backgroundColor: theme.surfaceBg, borderColor: theme.borderColor }}
          className="p-3.5 border-t grid grid-cols-2 gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLogin();
            }}
            style={{ backgroundColor: theme.softSurfaceBg, borderColor: theme.borderColor, color: theme.inkColor }}
            className={`py-2.5 ${theme.buttonRadius} border text-xs font-black cursor-pointer`}
          >
            {isEn ? 'Sign In' : 'تسجيل الدخول'}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (audience === 'supplier') onStartSupplier();
              else onStartArtisan();
            }}
            style={{ backgroundColor: theme.accentBg, color: theme.accentInk }}
            className={`py-2.5 ${theme.buttonRadius} text-xs font-black cursor-pointer`}
          >
            {isEn ? 'Start Free Now' : 'ابدأ مجاناً الآن'}
          </button>
        </div>
      </aside>
    </div>
  );
};
