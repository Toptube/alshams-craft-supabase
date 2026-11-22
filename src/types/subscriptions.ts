import { useEffect, useState } from 'react';
import { WORLD_STOREFRONT_THEMES_LIST } from '../lib/storefrontThemes';
import { UserProfile, isUserAdmin } from './index';

export type SubscriptionPackageId =
  | 'core_free'
  | 'storefront_catalog'
  | 'production_pricing'
  | 'inventory_purchases'
  | 'finance_crm'
  | 'hr_pos_branches'
  | 'ai_assistants';

export interface SubscriptionPackageDefinition {
  id: SubscriptionPackageId;
  order: number;
  audience: 'both' | 'artisan' | 'supplier';
  titleAr: string;
  supplierTitleAr?: string;
  taglineAr: string;
  supplierTaglineAr?: string;
  isAlwaysFree?: boolean;
  monthlyPriceEgp: number;
  promoFreeLimitedTime: boolean;
  accentClass: string;
  badgeText?: string;
  includedModulesArtisan: string[];
  includedModulesSupplier: string[];
  highlightsArtisan: string[];
  highlightsSupplier: string[];
}

export interface UserSubscriptionState {
  activePackageIds: SubscriptionPackageId[];
  hasSelectedPackages: boolean;
  selectedAt?: string;
  promoClaimed?: boolean;
  updatedAt?: string;
}

export const ALL_PACKAGE_IDS: SubscriptionPackageId[] = [
  'core_free',
  'storefront_catalog',
  'production_pricing',
  'inventory_purchases',
  'finance_crm',
  'hr_pos_branches',
  'ai_assistants',
];

export function getSubscriptionPackages(): SubscriptionPackageDefinition[] {
  const themesCount = WORLD_STOREFRONT_THEMES_LIST.length;

  return [
    {
      id: 'core_free',
      order: 0,
      audience: 'both',
      titleAr: 'الباقة الأساسية التأسيسية + صفحتي الشخصية',
      supplierTitleAr: 'الباقة الأساسية للمورد + صفحتي الشخصية',
      taglineAr:
        'مجانية للأبد — تؤسس وجودك الحقيقي داخل المنصة وتعرض هويتك ومستواك وأعمالك ومشاركاتك التدريبية للتفاعل المباشر مع المجتمع.',
      supplierTaglineAr:
        'مجانية للأبد — صفحتك الشخصية كمورد معتمد لعرض نبذتك وخاماتك ومشاركاتك التعليمية والربط مع الورش.',
      isAlwaysFree: true,
      monthlyPriceEgp: 0,
      promoFreeLimitedTime: false,
      accentClass: 'emerald',
      badgeText: 'مجانية للأبد',
      includedModulesArtisan: [
        'home',
        'personal_profile',
        'family',
        'guide_start',
        'guide_daily',
        'executive_brief',
        'my_subscriptions',
      ],
      includedModulesSupplier: [
        'home',
        'personal_profile',
        'family',
        'guide_start',
        'guide_daily',
        'supplier_executive_brief',
        'my_subscriptions',
      ],
      highlightsArtisan: [
        'صفحتي الشخصية الكاملة: تحديد مستواك، نبذة عنك، معرض أعمالك ومشاركاتك التدريبية والتسويقية',
        'رسالة الترحيب وحالة الحساب وخطوات التأسيس المنظمة',
        'دليل «نبدأ ورشتنا إزاي؟» ودليل «يومك في الورشة» الإرشادي',
        'دخول مجتمع «عيلة الشمساوية» والتفاعل مع الفنانين والخبراء',
      ],
      highlightsSupplier: [
        'صفحتي الشخصية كمورد: نبذتك، فروعك، معرض توريداتك ومشاركاتك للورش',
        'لوحة الترحيب وحالة الحساب وخطوات تأسيس حساب المورد',
        'الدليل الإرشادي اليومي لتشغيل التوريدات والطلبات',
        'التواجد والتفاعل المباشر داخل مجتمع «عيلة الشمساوية»',
      ],
    },
    {
      id: 'storefront_catalog',
      order: 1,
      audience: 'both',
      titleAr: 'باقة المتجر العالمي والكتالوج الذكي',
      supplierTitleAr: 'باقة متجر المورد العالمي وكتالوج الخامات',
      taglineAr: `متجر إلكتروني مستقل برابط خاص و QR مع كل السمات العالمية (${themesCount} سمة حالياً وتتحدث تلقائياً)، بانرات متحركة، أكواد خصم، وترتيب بالسحب والإفلات.`,
      supplierTaglineAr: `متجر موردين إلكتروني مستقل مع كل السمات (${themesCount} سمة تلقائية)، شرائح جملة وقطاعي، بانرات متحركة وأكواد خصم.`,
      monthlyPriceEgp: 149,
      promoFreeLimitedTime: true,
      accentClass: 'orange',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: ['catalog', 'store', 'my_store', 'my_orders', 'marketplace'],
      includedModulesSupplier: ['supplier_catalog', 'supplier_store', 'supplier_orders', 'suppliers_market'],
      highlightsArtisan: [
        `كافة سمات المتجر العالمية (${themesCount} سمة حالياً وتزيد تلقائياً مع كل سمة جديدة)`,
        'الكتالوج الذكي + إضافة منتج مباشر + ترتيب المعروضات بالسحب والإفلات',
        'استوديو البانر المتحرك والثابت + أكواد خصم متعددة (نسبة / مبلغ / شحن مجاني / اشتري وخذ)',
        'عروض السعر قبل وبعد + شارات «العروض الخاصة» و«الأكثر طلباً» + إدارة أوردراتي',
      ],
      highlightsSupplier: [
        `متجر مورد مستقل بكافة السمات العالمية (${themesCount} سمة حالياً وتزيد تلقائياً)`,
        'كتالوج خامات احترافي بشرائح الجملة والقطاعي والترتيب بالسحب والإفلات',
        'بانرات متحركة وأكواد خصم متعددة بعملة متجرك + عروض قبل وبعد',
        'الظهور في سوق الموردين (B2B) واستقبال طلبات الورش مباشرة',
      ],
    },
    {
      id: 'production_pricing',
      order: 2,
      audience: 'both',
      titleAr: 'باقة التصنيع والتسعير الذكي',
      supplierTitleAr: 'باقة التسعير المرن وشرائح الجملة والمصانع',
      taglineAr: 'حاسبة تكاليف دقيقة تحسب الخامات والهدر وساعات العمل وهامش الربح مع أوامر التشغيل والإنتاج.',
      supplierTaglineAr: 'إدارة شرائح أسعار الجملة، تكويد الخامات الموحد، وربط طلبات التوريد والتعبئة بالمصانع.',
      monthlyPriceEgp: 129,
      promoFreeLimitedTime: true,
      accentClass: 'amber',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: ['calculator', 'archive', 'work_orders'],
      includedModulesSupplier: ['unified_materials', 'supplier_catalog'],
      highlightsArtisan: [
        'حاسبة الإنتاج والتسعير الذكية (خامات + هدر + مصنعية + ربح صافي)',
        'أرشيف المنتجات والوصفات (BOM) بالعملات المتعددة',
        'أوامر الشغل والتصنيع وتتبع مراحل التنفيذ حتى التسليم',
      ],
      highlightsSupplier: [
        'دليل الخامات الموحد والتكويد القياسي للأصناف',
        'شرائح أسعار متعددة حسب الكمية والحد الأدنى للجملة',
        'حساب تلقائي لتكلفة الباكدج والوحدة الصغرى وهوامش التوريد',
      ],
    },
    {
      id: 'inventory_purchases',
      order: 3,
      audience: 'both',
      titleAr: 'باقة المخازن والمشتريات والخزينة التأسيسية',
      supplierTitleAr: 'باقة المخزن المركزي والمشتريات والخزينة التأسيسية',
      taglineAr: 'جرد خاماتك وحركة المخزن والمشتريات والموردين — مربوطة بالخزينة التأسيسية عشان كل فاتورة شراء تتسجل بفلوسها صح.',
      supplierTaglineAr: 'جرد المخزن المركزي، فواتير التوريد والشراء، وربطها بالخزينة التأسيسية لتتبع السيولة والأرصدة.',
      monthlyPriceEgp: 169,
      promoFreeLimitedTime: true,
      accentClass: 'sky',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: [
        'materials',
        'unified_materials',
        'inventory_materials',
        'inventory_audit',
        'finished_products',
        'purchases',
        'suppliers',
        'suppliers_market',
        'treasuries',
      ],
      includedModulesSupplier: ['supplier_warehouse_erp', 'supplier_finance'],
      highlightsArtisan: [
        'خاماتي + جرد أرصدة الخامات وحدود إعادة الطلب + حركة المخزن',
        'مخزن المنتجات الجاهزة للبيع والتسليم الفوري',
        'فواتير المشتريات وحسابات الموردين وسوق الموردين',
        'خزينة تأسيسية مدمجة لإثبات الدفع الكاش والآجل والموردين بمنطقية محاسبية',
      ],
      highlightsSupplier: [
        'المخزن المركزي وتحويلات البضاعة بين الفروع والمخازن',
        'جرد دقيق بالكمية والوحدة الكبرى والصغرى',
        'خزينة تأسيسية لإثبات فواتير الشراء والتوريد والمدفوعات',
      ],
    },
    {
      id: 'finance_crm',
      order: 4,
      audience: 'both',
      titleAr: 'باقة الإدارة المالية الشاملة والعملاء (FCA + CRM)',
      supplierTitleAr: 'باقة المالية والمحاسبة وإدارة عملاء الجملة (FCA + CRM)',
      taglineAr: 'إدارة الخزائن المتعددة، المبيعات والفواتير، المصروفات والأصول، التقارير والأرباح الصافية، وسجل العملاء CRM.',
      supplierTaglineAr: 'خزائن متعددة (كاش / إنستاباي / بنك)، كشوف حساب عملاء الورش، الآجل والتحصيلات، وتقارير الربحية.',
      monthlyPriceEgp: 199,
      promoFreeLimitedTime: true,
      accentClass: 'indigo',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: [
        'sales',
        'invoices',
        'customers',
        'treasuries',
        'accounts',
        'expenses',
        'fixed_assets',
        'reports',
        'currency_rates',
      ],
      includedModulesSupplier: ['supplier_finance', 'supplier_customers', 'supplier_orders'],
      highlightsArtisan: [
        'الخزائن المتعددة (كاش / إنستاباي / محفظة / بنك) وكشف الحساب الشامل',
        'المبيعات، الفواتير، المرتجعات، وسجل العملاء CRM',
        'المصروفات الإدارية، الأصول الثابتة، وتقارير صافي الربح وأسعار العملات',
      ],
      highlightsSupplier: [
        'إدارة حسابات العملاء (الورش والتجار) والمديونيات والتحصيلات',
        'خزينة شاملة متعددة الأوعية وكشف حساب تفصيلي',
        'تقارير المبيعات والأرباح وحركة التدفقات النقدية',
      ],
    },
    {
      id: 'hr_pos_branches',
      order: 5,
      audience: 'both',
      titleAr: 'باقة فريق العمل والأجور (HR)',
      supplierTitleAr: 'باقة الفروع وكاشير نقاط البيع والموظفين (ERP + POS + HR)',
      taglineAr: 'إدارة الصنايعية والموظفين، اليوميات، الرواتب، السلف، والعمولات بدقة كاملة.',
      supplierTaglineAr: 'منظومة الفروع المتعددة، كاشير نقاط البيع السريع POS، المصانع، شؤون العاملين، وتثبيت الأجهزة.',
      monthlyPriceEgp: 179,
      promoFreeLimitedTime: true,
      accentClass: 'violet',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: ['hr'],
      includedModulesSupplier: [
        'supplier_erp_hub',
        'supplier_pos',
        'supplier_warehouse_erp',
        'supplier_hr_terminal',
      ],
      highlightsArtisan: [
        'ملفات الصنايعية وفريق الورشة وسجل الحضور واليوميات',
        'الرواتب، السلف، والمكافآت والربط التلقائي بالخزينة',
      ],
      highlightsSupplier: [
        'كاشير نقاط البيع السريع (POS) بالباركود بدون صور لسرعة البيع',
        'إدارة الفروع المتعددة والمخزن المركزي والتحويلات',
        'شؤون العاملين، البائعين، وتثبيت أجهزة الكاشير والفروع',
      ],
    },
    {
      id: 'ai_assistants',
      order: 6,
      audience: 'both',
      titleAr: 'باقة المساعد الذكي (صقر & شموسة AI)',
      supplierTitleAr: 'باقة المساعد الذكي للمورد (صقر & شموسة AI)',
      taglineAr: 'مستشار صقر لتحليل الأرباح والتسعير + شموسة للبحث الذكي والمتابعة اليومية.',
      supplierTaglineAr: 'تحليل مبيعات الخامات والتسعير التنافسي + متابعة ذكية للمخزون والطلبات مع صقر وشموسة.',
      monthlyPriceEgp: 99,
      promoFreeLimitedTime: true,
      accentClass: 'rose',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: ['ai_agent'],
      includedModulesSupplier: ['ai_agent'],
      highlightsArtisan: [
        'مستشار صقر الشمساوية للتسعير وتقليل الهدر وزيادة هامش الربح',
        'شموسة للبحث الذكي السريع والإجابة على استفسارات الورشة',
      ],
      highlightsSupplier: [
        'تحليل حركة الأصناف الأكثر طلباً وتنبيهات النواقص الذكية',
        'استشارات صقر وشموسة لتطوير عروض الجملة والقطاعي',
      ],
    },
  ];
}

export const SUBSCRIPTION_UPDATED_EVENT = 'alshams_user_subscription_updated';

function subStorageKey(userId: string): string {
  return `alshams_user_subscription_${userId || 'guest'}`;
}

export function getDefaultSubscriptionState(): UserSubscriptionState {
  return {
    activePackageIds: [...ALL_PACKAGE_IDS],
    hasSelectedPackages: false,
    promoClaimed: true,
  };
}

export function getStoredUserSubscription(userId?: string | null): UserSubscriptionState {
  const fallback = getDefaultSubscriptionState();
  if (typeof window === 'undefined' || !userId) return fallback;
  try {
    const raw = localStorage.getItem(subStorageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UserSubscriptionState>;
    const ids = Array.isArray(parsed.activePackageIds)
      ? Array.from(
          new Set<SubscriptionPackageId>([
            'core_free',
            ...(parsed.activePackageIds.filter((x): x is SubscriptionPackageId =>
              ALL_PACKAGE_IDS.includes(x as SubscriptionPackageId)
            ) as SubscriptionPackageId[]),
          ])
        )
      : [...ALL_PACKAGE_IDS];
    return {
      activePackageIds: ids,
      hasSelectedPackages: Boolean(parsed.hasSelectedPackages),
      selectedAt: parsed.selectedAt,
      promoClaimed: parsed.promoClaimed !== false,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return fallback;
  }
}

export function saveUserSubscription(
  userId: string,
  next: Partial<UserSubscriptionState>
): UserSubscriptionState {
  const prev = getStoredUserSubscription(userId);
  const mergedIds = Array.from(
    new Set<SubscriptionPackageId>([
      'core_free',
      ...((next.activePackageIds || prev.activePackageIds).filter((x): x is SubscriptionPackageId =>
        ALL_PACKAGE_IDS.includes(x as SubscriptionPackageId)
      ) as SubscriptionPackageId[]),
    ])
  );
  const finalState: UserSubscriptionState = {
    activePackageIds: mergedIds,
    hasSelectedPackages:
      typeof next.hasSelectedPackages === 'boolean' ? next.hasSelectedPackages : prev.hasSelectedPackages,
    selectedAt: next.selectedAt || prev.selectedAt || new Date().toISOString(),
    promoClaimed: next.promoClaimed !== undefined ? next.promoClaimed : true,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined' && userId) {
    try {
      localStorage.setItem(subStorageKey(userId), JSON.stringify(finalState));
      window.dispatchEvent(
        new CustomEvent(SUBSCRIPTION_UPDATED_EVENT, { detail: { userId, state: finalState } })
      );
    } catch {}
  }
  return finalState;
}

export function useUserSubscription(profile?: UserProfile | null): UserSubscriptionState {
  const userId = profile?.workshopId || profile?.id || profile?.email || '';
  const [state, setState] = useState<UserSubscriptionState>(() => getStoredUserSubscription(userId));

  useEffect(() => {
    setState(getStoredUserSubscription(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ userId?: string; state?: UserSubscriptionState }>)?.detail;
      if (!detail || !detail.userId || detail.userId === userId) {
        setState(detail?.state || getStoredUserSubscription(userId));
      }
    };
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, onUpdated);
  }, [userId]);

  return state;
}

export function isModuleUnlockedBySubscription(
  moduleId: string,
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  // قبل أن يختار العضو باقاته يظل كل شيء متاحاً حتى لا يتعطل عمله أثناء الاختيار
  if (!sub.hasSelectedPackages) return true;

  const alwaysOpen = new Set([
    'home',
    'personal_profile',
    'family',
    'guide_start',
    'guide_daily',
    'executive_brief',
    'supplier_executive_brief',
    'my_subscriptions',
  ]);
  if (alwaysOpen.has(moduleId)) return true;

  const packages = getSubscriptionPackages();
  const activeSet = new Set(sub.activePackageIds);
  for (const pkg of packages) {
    if (!activeSet.has(pkg.id)) continue;
    const list = role === 'supplier' ? pkg.includedModulesSupplier : pkg.includedModulesArtisan;
    if (list.includes(moduleId)) return true;
  }
  return false;
}

export function shouldPromptExistingUserForPackages(
  profile?: UserProfile | null,
  sub?: UserSubscriptionState
): boolean {
  if (!profile || !sub) return false;
  if (isUserAdmin(profile)) return false;
  return !sub.hasSelectedPackages;
}
