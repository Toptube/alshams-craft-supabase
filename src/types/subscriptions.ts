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
  enabled?: boolean;
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
  /** الصفحات والأقسام المفتوحة في القائمة الجانبية والتوجيه */
  includedModulesArtisan: string[];
  includedModulesSupplier: string[];
  /** الأزرار والبطاقات الدقيقة المفتوحة في الشاشة الرئيسية والشريط العلوي (يتحكم بها السوبر أدمن زراً بزراً) */
  allowedActionsArtisan: string[];
  allowedActionsSupplier: string[];
  highlightsArtisan: string[];
  highlightsSupplier: string[];
}

export interface SubscriptionPackageOverride {
  id: SubscriptionPackageId;
  order?: number;
  enabled?: boolean;
  titleAr?: string;
  supplierTitleAr?: string;
  taglineAr?: string;
  supplierTaglineAr?: string;
  monthlyPriceEgp?: number;
  promoFreeLimitedTime?: boolean;
  allowedActionsArtisan?: string[];
  allowedActionsSupplier?: string[];
  includedModulesArtisan?: string[];
  includedModulesSupplier?: string[];
}

export interface PlatformPackagesAdminConfig {
  packages: Record<string, SubscriptionPackageOverride>;
  updatedAt?: string;
}

export interface UserSubscriptionState {
  activePackageIds: SubscriptionPackageId[];
  hasSelectedPackages: boolean;
  selectedAt?: string;
  promoClaimed?: boolean;
  updatedAt?: string;
  syncedToCloudAt?: string;
  syncStatus?: 'synced' | 'syncing' | 'pending_offline';
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

/** عناصر تحكم إضافية للشريط العلوي وملخص الشاشة والإضافة السريعة (يتحكم بها السوبر أدمن داخل كل باقة) */
export interface AdminControllableSystemAction {
  actionKey: string;
  label: string;
  description: string;
}

export const ADMIN_SYSTEM_ACTIONS_ARTISAN: AdminControllableSystemAction[] = [
  { actionKey: 'top_nav_family', label: 'زرار «العيلة» في الشريط العلوي', description: 'إظهار زرار مجتمع العيلة أعلى الشاشة' },
  { actionKey: 'top_nav_store', label: 'زرار «متجري» في الشريط العلوي', description: 'إظهار زرار متجري البرتقالي أعلى الشاشة' },
  { actionKey: 'top_nav_quick_add', label: 'زرار الإضافة السريعة (+) أعلى الشاشة', description: 'قائمة (+) المختصرة لبيع/خامة/حاسبة/عميل' },
  { actionKey: 'quick_direct_product', label: 'زرار «إضافة منتج مباشر سريع»', description: 'إضافة منتج مباشر بالصور والألوان للكتالوج والمتجر' },
  { actionKey: 'widget_home_summary', label: 'صندوق «ملخص الورشة» المالي والمخزني', description: 'أرصدة الخزائن والخامات والرسوم البيانية أسفل الشاشة الرئيسية' },
];

export const ADMIN_SYSTEM_ACTIONS_SUPPLIER: AdminControllableSystemAction[] = [
  { actionKey: 'top_nav_family', label: 'زرار «العيلة» في الشريط العلوي', description: 'إظهار زرار مجتمع العيلة أعلى الشاشة' },
  { actionKey: 'top_nav_store', label: 'زرار «متجري» وأدوات رابط المتجر و QR', description: 'إظهار متجري أعلى الشاشة وأزرار معاينة ورابط المتجر' },
  { actionKey: 'top_nav_quick_add', label: 'زرار الإضافة السريعة (+) أعلى الشاشة', description: 'قائمة (+) المختصرة في الشريط العلوي' },
  { actionKey: 'widget_home_summary', label: 'صناديق ملخص السيولة والمخزون', description: 'مؤشرات الأرصدة والمخزون والمبيعات في الرئيسية' },
];

/**
 * خريطة ربط دقيقة بين كل زر (actionKey) والصفحة/الموديول المقابل له في القائمة الجانبية والتوجيه
 * عشان أول ما السوبر أدمن يعلّم على زر واحد داخل أي باقة، تتفتح صفحته تلقائياً في القائمة والروابط أيضاً.
 */
export const ACTION_KEY_TO_MODULES_ARTISAN: Record<string, string[]> = {
  nav_personal_profile: ['personal_profile'],
  nav_family: ['family'],
  top_nav_family: ['family'],
  open_executive_brief: ['executive_brief'],
  open_guide_start: ['guide_start'],
  open_guide_daily: ['guide_daily'],
  nav_catalog: ['catalog'],
  quick_direct_product: ['catalog'],
  open_artisan_store_products: ['store', 'my_store'],
  open_artisan_store_orders: ['my_orders'],
  nav_marketplace: ['marketplace'],
  top_nav_store: ['store', 'my_store'],
  nav_calculator: ['calculator'],
  nav_archive: ['archive'],
  modal_inv_products: ['finished_products', 'inventory_materials'],
  nav_materials: ['materials'],
  modal_new_material: ['materials'],
  nav_unified_materials: ['unified_materials'],
  modal_inv_materials: ['inventory_materials', 'materials'],
  modal_inv_audit: ['inventory_audit', 'inventory_materials'],
  modal_supplier_invoice: ['purchases'],
  nav_purchases: ['purchases'],
  nav_suppliers: ['suppliers'],
  modal_create_supplier: ['suppliers'],
  nav_suppliers_market: ['suppliers_market'],
  nav_work_orders: ['work_orders'],
  nav_work_orders_create: ['work_orders'],
  nav_work_orders_issue: ['work_orders'],
  nav_work_orders_receive: ['work_orders'],
  nav_sales: ['sales'],
  nav_sales_new: ['sales'],
  nav_invoices: ['invoices'],
  nav_invoices_returns: ['invoices'],
  nav_customers: ['customers'],
  modal_new_client: ['customers'],
  nav_hr: ['hr'],
  modal_new_employee: ['hr'],
  modal_admin_costs: ['expenses'],
  nav_fixed_assets: ['fixed_assets'],
  modal_exchange_rates: ['currency_rates'],
  nav_treasuries: ['treasuries'],
  nav_accounts: ['accounts'],
  nav_reports: ['reports'],
  nav_ai_agent: ['ai_agent'],
  open_shamousa: ['ai_agent'],
};

export const ACTION_KEY_TO_MODULES_SUPPLIER: Record<string, string[]> = {
  sup_personal_profile: ['personal_profile'],
  sup_family: ['family'],
  top_nav_family: ['family'],
  sup_executive_brief: ['supplier_executive_brief'],
  sup_guide_start: ['guide_start'],
  sup_guide_daily: ['guide_daily'],
  sup_catalog: ['supplier_catalog'],
  sup_unified_materials: ['unified_materials'],
  sup_orders: ['supplier_orders'],
  sup_storefront: ['supplier_store'],
  top_nav_store: ['supplier_store'],
  sup_market: ['suppliers_market'],
  sup_customers: ['supplier_customers'],
  sup_finance: ['supplier_finance'],
  sup_erp_hub: ['supplier_erp_hub'],
  sup_pos: ['supplier_pos'],
  sup_warehouse_erp: ['supplier_warehouse_erp'],
  sup_hr_terminal: ['supplier_hr_terminal'],
  nav_ai_agent: ['ai_agent'],
  open_shamousa: ['ai_agent'],
};

export function getDefaultSubscriptionPackages(): SubscriptionPackageDefinition[] {
  const themesCount = WORLD_STOREFRONT_THEMES_LIST.length;

  return [
    {
      id: 'core_free',
      order: 0,
      enabled: true,
      audience: 'both',
      titleAr: 'الباقة الأساسية التأسيسية + صفحتي الشخصية',
      supplierTitleAr: 'الباقة الأساسية للمورد + صفحتي الشخصية',
      taglineAr:
        'مجانية للأبد — تفتح لك «صفحتي الشخصية» بالكامل (مستواك، نبذتك، معرض أعمالك ومشاركاتك التدريبية) + مجتمع عيلة الشمساوية والإعدادات فقط بدون زحمة.',
      supplierTaglineAr:
        'مجانية للأبد — صفحتك الشخصية كمورد معتمد لعرض نبذتك ومعرض أعمالك ومشاركاتك + مجتمع عيلة الشمساوية والإعدادات.',
      isAlwaysFree: true,
      monthlyPriceEgp: 0,
      promoFreeLimitedTime: false,
      accentClass: 'emerald',
      badgeText: 'مجانية للأبد',
      includedModulesArtisan: ['home', 'personal_profile', 'family', 'my_subscriptions'],
      includedModulesSupplier: ['home', 'personal_profile', 'family', 'my_subscriptions'],
      allowedActionsArtisan: ['nav_personal_profile', 'nav_family', 'top_nav_family'],
      allowedActionsSupplier: ['sup_personal_profile', 'sup_family', 'top_nav_family'],
      highlightsArtisan: [
        'صفحتي الشخصية الكاملة: تحديد مستواك، نبذة عنك، معرض أعمالك ومشاركاتك التدريبية والتسويقية',
        'دخول مجتمع «عيلة الشمساوية» والتفاعل مع الفنانين والخبراء',
        'إعدادات الحساب والورشة + إدارة اشتراكاتك وترقية باقاتك في أي وقت',
      ],
      highlightsSupplier: [
        'صفحتي الشخصية كمورد: نبذتك، فروعك، معرض توريداتك ومشاركاتك للورش',
        'التواجد والتفاعل المباشر داخل مجتمع «عيلة الشمساوية»',
        'إعدادات الحساب + إدارة اشتراكاتك وترقية باقاتك في أي وقت',
      ],
    },
    {
      id: 'storefront_catalog',
      order: 1,
      enabled: true,
      audience: 'both',
      titleAr: 'باقة المتجر العالمي والكتالوج الذكي',
      supplierTitleAr: 'باقة متجر المورد العالمي وكتالوج الخامات',
      taglineAr: `تفتح لك الكتالوج + إضافة منتج مباشر + متجرك الخاص بـ ${themesCount} سمة عالمية (تزيد تلقائياً) + أوردراتي + سوق الشمساوية.`,
      supplierTaglineAr: `متجر موردين إلكتروني مستقل مع كل السمات (${themesCount} سمة تلقائية)، كتالوج الخامات، أوردراتي وسوق الموردين.`,
      monthlyPriceEgp: 149,
      promoFreeLimitedTime: true,
      accentClass: 'orange',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: ['catalog', 'store', 'my_store', 'my_orders', 'marketplace'],
      includedModulesSupplier: ['supplier_catalog', 'supplier_store', 'supplier_orders', 'suppliers_market'],
      allowedActionsArtisan: [
        'nav_catalog',
        'quick_direct_product',
        'open_artisan_store_products',
        'open_artisan_store_orders',
        'nav_marketplace',
        'top_nav_store',
      ],
      allowedActionsSupplier: [
        'sup_catalog',
        'sup_storefront',
        'sup_orders',
        'sup_market',
        'top_nav_store',
      ],
      highlightsArtisan: [
        `كافة سمات المتجر العالمية (${themesCount} سمة حالياً وتزيد تلقائياً مع كل سمة جديدة)`,
        'الكتالوج الذكي + إضافة منتج مباشر بالألوان والأقسام + ترتيب بالسحب والإفلات',
        'استوديو البانر المتحرك والثابت + أكواد خصم متعددة + عروض قبل وبعد + أوردراتي',
      ],
      highlightsSupplier: [
        `متجر مورد مستقل بكافة السمات العالمية (${themesCount} سمة حالياً وتزيد تلقائياً)`,
        'كتالوج خامات احترافي بشرائح الجملة والقطاعي والترتيب بالسحب والإفلات',
        'بانرات متحركة وأكواد خصم متعددة + الظهور في سوق الموردين (B2B) وإدارة أوردراتي',
      ],
    },
    {
      id: 'production_pricing',
      order: 2,
      enabled: true,
      audience: 'both',
      titleAr: 'باقة التصنيع والتسعير الذكي',
      supplierTitleAr: 'باقة التسعير المرن والدليل الموحد للخامات',
      taglineAr: 'حاسبة تكاليف دقيقة (خامات + هدر + مصنعية + ربح)، أرشيف الوصفات، أوامر الشغل، وأدلة تشغيل الورشة.',
      supplierTaglineAr: 'إدارة دليل الخامات الموحد، التكويد القياسي، وأدلة تشغيل وتوريد المتجر اليومية.',
      monthlyPriceEgp: 129,
      promoFreeLimitedTime: true,
      accentClass: 'amber',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: ['calculator', 'archive', 'work_orders', 'guide_start', 'guide_daily'],
      includedModulesSupplier: ['unified_materials', 'supplier_catalog', 'guide_start', 'guide_daily'],
      allowedActionsArtisan: [
        'nav_calculator',
        'nav_archive',
        'nav_work_orders_create',
        'nav_work_orders_issue',
        'nav_work_orders_receive',
        'nav_work_orders',
        'open_guide_start',
        'open_guide_daily',
      ],
      allowedActionsSupplier: [
        'sup_unified_materials',
        'sup_catalog',
        'sup_guide_start',
        'sup_guide_daily',
      ],
      highlightsArtisan: [
        'حاسبة الإنتاج والتسعير الذكية (خامات + هدر + مصنعية + ربح صافي)',
        'أرشيف المنتجات والوصفات (BOM) + أوامر الشغل والتصنيع',
        'أدلة تشغيل الورشة التفاعلية («نبدأ ورشتنا» و«يومك في الورشة»)',
      ],
      highlightsSupplier: [
        'دليل الخامات الموحد والتكويد القياسي للأصناف',
        'شرائح أسعار متعددة حسب الكمية والحد الأدنى للجملة',
        'أدلة تشغيل وتوريد المتجر التفاعلية',
      ],
    },
    {
      id: 'inventory_purchases',
      order: 3,
      enabled: true,
      audience: 'both',
      titleAr: 'باقة المخازن والمشتريات والخزينة التأسيسية',
      supplierTitleAr: 'باقة المخزن المركزي والمشتريات والخزينة التأسيسية',
      taglineAr: 'خاماتي، جرد المخازن، مخزن المنتجات الجاهزة، المشتريات والموردين — مربوطة بالخزينة التأسيسية.',
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
      includedModulesSupplier: ['supplier_warehouse_erp', 'supplier_finance', 'unified_materials'],
      allowedActionsArtisan: [
        'nav_materials',
        'nav_unified_materials',
        'modal_new_material',
        'modal_inv_materials',
        'modal_inv_audit',
        'modal_inv_products',
        'modal_supplier_invoice',
        'nav_purchases',
        'nav_suppliers',
        'nav_suppliers_market',
        'modal_create_supplier',
        'nav_treasuries',
        'top_nav_quick_add',
        'widget_home_summary',
      ],
      allowedActionsSupplier: [
        'sup_warehouse_erp',
        'sup_finance',
        'sup_unified_materials',
        'top_nav_quick_add',
        'widget_home_summary',
      ],
      highlightsArtisan: [
        'خاماتي + جرد أرصدة الخامات وحدود إعادة الطلب + حركة المخزن',
        'مخزن المنتجات الجاهزة للبيع والتسليم الفوري',
        'فواتير المشتريات وحسابات الموردين + خزينة تأسيسية مدمجة لإثبات الدفع الكاش والآجل',
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
      enabled: true,
      audience: 'both',
      titleAr: 'باقة الإدارة المالية الشاملة والعملاء (FCA + CRM)',
      supplierTitleAr: 'باقة المالية والمحاسبة وإدارة عملاء الجملة (FCA + CRM)',
      taglineAr: 'هلخصهالك، الخزائن المتعددة، المبيعات والفواتير، المصروفات والأصول، التقارير والأرباح الصافية، وسجل العملاء CRM.',
      supplierTaglineAr: 'هلخصهالك للموردين، خزائن متعددة (كاش / إنستاباي / بنك)، كشوف حساب عملاء الورش، الآجل وتقارير الربحية.',
      monthlyPriceEgp: 199,
      promoFreeLimitedTime: true,
      accentClass: 'indigo',
      badgeText: 'مجاناً لفترة محدودة',
      includedModulesArtisan: [
        'executive_brief',
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
      includedModulesSupplier: [
        'supplier_executive_brief',
        'supplier_finance',
        'supplier_customers',
        'supplier_orders',
      ],
      allowedActionsArtisan: [
        'open_executive_brief',
        'nav_sales',
        'nav_sales_new',
        'nav_invoices',
        'nav_invoices_returns',
        'nav_customers',
        'modal_new_client',
        'nav_treasuries',
        'nav_accounts',
        'modal_admin_costs',
        'nav_fixed_assets',
        'modal_exchange_rates',
        'nav_reports',
        'top_nav_quick_add',
        'widget_home_summary',
      ],
      allowedActionsSupplier: [
        'sup_executive_brief',
        'sup_finance',
        'sup_customers',
        'sup_orders',
        'top_nav_quick_add',
        'widget_home_summary',
      ],
      highlightsArtisan: [
        'هلخصهالك + الخزائن المتعددة (كاش / إنستاباي / محفظة / بنك) وكشف الحساب الشامل',
        'المبيعات، الفواتير، المرتجعات، وسجل العملاء CRM',
        'المصروفات الإدارية، الأصول الثابتة، وتقارير صافي الربح وأسعار العملات',
      ],
      highlightsSupplier: [
        'هلخصهالك للموردين + إدارة حسابات العملاء (الورش والتجار) والمديونيات',
        'خزينة شاملة متعددة الأوعية وكشف حساب تفصيلي',
        'تقارير المبيعات والأرباح وحركة التدفقات النقدية',
      ],
    },
    {
      id: 'hr_pos_branches',
      order: 5,
      enabled: true,
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
      allowedActionsArtisan: ['nav_hr', 'modal_new_employee'],
      allowedActionsSupplier: [
        'sup_erp_hub',
        'sup_pos',
        'sup_warehouse_erp',
        'sup_hr_terminal',
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
      enabled: true,
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
      allowedActionsArtisan: ['nav_ai_agent', 'open_shamousa'],
      allowedActionsSupplier: ['nav_ai_agent', 'open_shamousa'],
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

// ── Super Admin Global Packages Config (Synced across Platform Settings) ──
const ADMIN_PACKAGES_CONFIG_KEY = 'alshams_admin_packages_config_v1';
export const PACKAGES_ADMIN_CONFIG_UPDATED_EVENT = 'alshams_admin_packages_config_updated';

export function getStoredSubscriptionPackagesConfig(): PlatformPackagesAdminConfig {
  if (typeof window === 'undefined') return { packages: {} };
  try {
    const raw = localStorage.getItem(ADMIN_PACKAGES_CONFIG_KEY);
    if (!raw) return { packages: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.packages && typeof parsed.packages === 'object') {
      return parsed as PlatformPackagesAdminConfig;
    }
  } catch {}
  return { packages: {} };
}

export function saveStoredSubscriptionPackagesConfig(
  cfg: PlatformPackagesAdminConfig
): PlatformPackagesAdminConfig {
  const finalCfg: PlatformPackagesAdminConfig = {
    packages: cfg?.packages || {},
    updatedAt: cfg?.updatedAt || new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ADMIN_PACKAGES_CONFIG_KEY, JSON.stringify(finalCfg));
      window.dispatchEvent(
        new CustomEvent(PACKAGES_ADMIN_CONFIG_UPDATED_EVENT, { detail: finalCfg })
      );
    } catch {}
  }
  return finalCfg;
}

export function resetSubscriptionPackagesConfig(): PlatformPackagesAdminConfig {
  return saveStoredSubscriptionPackagesConfig({ packages: {}, updatedAt: new Date().toISOString() });
}

function deriveModulesFromActions(actions: string[], role: 'artisan' | 'supplier'): string[] {
  const map = role === 'supplier' ? ACTION_KEY_TO_MODULES_SUPPLIER : ACTION_KEY_TO_MODULES_ARTISAN;
  const set = new Set<string>();
  for (const act of actions) {
    const mods = map[act];
    if (mods) mods.forEach((m) => set.add(m));
  }
  return Array.from(set);
}

/**
 * تُرجع الباقات النهائية بعد تطبيق أي تعديلات أو تخصيصات أجراها السوبر أدمن
 */
export function getSubscriptionPackages(includeDisabled = false): SubscriptionPackageDefinition[] {
  const defaults = getDefaultSubscriptionPackages();
  const adminCfg = getStoredSubscriptionPackagesConfig();

  const merged = defaults.map((def) => {
    const ov = adminCfg.packages?.[def.id];
    if (!ov) return def;

    const nextActionsArtisan = Array.isArray(ov.allowedActionsArtisan)
      ? ov.allowedActionsArtisan
      : def.allowedActionsArtisan;
    const nextActionsSupplier = Array.isArray(ov.allowedActionsSupplier)
      ? ov.allowedActionsSupplier
      : def.allowedActionsSupplier;

    const derivedArtisanMods = Array.isArray(ov.allowedActionsArtisan)
      ? Array.from(
          new Set([
            ...(def.id === 'core_free' ? ['home', 'my_subscriptions'] : []),
            ...deriveModulesFromActions(nextActionsArtisan, 'artisan'),
            ...(Array.isArray(ov.includedModulesArtisan) ? ov.includedModulesArtisan : []),
          ])
        )
      : Array.isArray(ov.includedModulesArtisan)
      ? ov.includedModulesArtisan
      : def.includedModulesArtisan;

    const derivedSupplierMods = Array.isArray(ov.allowedActionsSupplier)
      ? Array.from(
          new Set([
            ...(def.id === 'core_free' ? ['home', 'my_subscriptions'] : []),
            ...deriveModulesFromActions(nextActionsSupplier, 'supplier'),
            ...(Array.isArray(ov.includedModulesSupplier) ? ov.includedModulesSupplier : []),
          ])
        )
      : Array.isArray(ov.includedModulesSupplier)
      ? ov.includedModulesSupplier
      : def.includedModulesSupplier;

    return {
      ...def,
      order: typeof ov.order === 'number' ? ov.order : def.order,
      enabled: def.isAlwaysFree ? true : ov.enabled !== false,
      titleAr: ov.titleAr?.trim() || def.titleAr,
      supplierTitleAr: ov.supplierTitleAr?.trim() || def.supplierTitleAr,
      taglineAr: ov.taglineAr?.trim() || def.taglineAr,
      supplierTaglineAr: ov.supplierTaglineAr?.trim() || def.supplierTaglineAr,
      monthlyPriceEgp:
        def.isAlwaysFree
          ? 0
          : typeof ov.monthlyPriceEgp === 'number'
          ? ov.monthlyPriceEgp
          : def.monthlyPriceEgp,
      promoFreeLimitedTime:
        def.isAlwaysFree
          ? false
          : typeof ov.promoFreeLimitedTime === 'boolean'
          ? ov.promoFreeLimitedTime
          : def.promoFreeLimitedTime,
      allowedActionsArtisan: nextActionsArtisan,
      allowedActionsSupplier: nextActionsSupplier,
      includedModulesArtisan: derivedArtisanMods,
      includedModulesSupplier: derivedSupplierMods,
    };
  });

  return merged
    .filter((p) => includeDisabled || p.enabled !== false)
    .sort((a, b) => a.order - b.order);
}

export function useSubscriptionPackagesConfig(): SubscriptionPackageDefinition[] {
  const [packages, setPackages] = useState<SubscriptionPackageDefinition[]>(() =>
    getSubscriptionPackages()
  );

  useEffect(() => {
    const refresh = () => setPackages(getSubscriptionPackages());
    window.addEventListener(PACKAGES_ADMIN_CONFIG_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PACKAGES_ADMIN_CONFIG_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return packages;
}

// ── Per-User Subscription State & Automatic Non-Destructive Sync ──
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
      syncedToCloudAt: parsed.syncedToCloudAt,
      syncStatus: parsed.syncStatus,
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
    updatedAt: next.updatedAt || new Date().toISOString(),
    syncedToCloudAt: next.syncedToCloudAt !== undefined ? next.syncedToCloudAt : prev.syncedToCloudAt,
    syncStatus: next.syncStatus !== undefined ? next.syncStatus : prev.syncStatus,
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

export interface PackageSyncResult {
  cloudSaved: boolean;
  dataSynced: boolean;
  offline: boolean;
  syncedAt?: string;
}

export async function syncUserSubscriptionAndData(
  profile: UserProfile,
  nextState: UserSubscriptionState,
  options?: { forcePull?: boolean }
): Promise<PackageSyncResult> {
  const userId = profile.workshopId || profile.id || profile.email || '';
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    saveUserSubscription(userId, { ...nextState, syncStatus: 'pending_offline' });
    return { cloudSaved: false, dataSynced: false, offline: true };
  }

  saveUserSubscription(userId, { ...nextState, syncStatus: 'syncing' });

  let cloudSaved = false;
  let dataSynced = false;

  try {
    const rawSettings = (profile as any)?.settings;
    const existingSettings =
      rawSettings && typeof rawSettings === 'object' ? { ...rawSettings } : {};
    const cloudSubPayload: UserSubscriptionState = {
      ...nextState,
      syncedToCloudAt: new Date().toISOString(),
      syncStatus: 'synced',
    };
    const mergedSettings = {
      ...existingSettings,
      subscription: cloudSubPayload,
    };

    if (workshopId && workshopId !== 'workshop_demo') {
      const { updateWorkshopProfileInSupabase } = await import('../db/supabaseService');
      const { error } = await updateWorkshopProfileInSupabase(workshopId, {
        settings: mergedSettings,
      });
      cloudSaved = !error;
    } else {
      cloudSaved = true;
    }

    if (typeof window !== 'undefined') {
      try {
        const rawProf = localStorage.getItem('alshams_profile');
        if (rawProf) {
          const parsedProf = JSON.parse(rawProf);
          parsedProf.settings = mergedSettings;
          localStorage.setItem('alshams_profile', JSON.stringify(parsedProf));
        }
      } catch {}
    }

    if (workshopId && workshopId !== 'workshop_demo') {
      const { performQuietSync, hydrateWorkshopIntoDexie } = await import(
        '../services/periodicQuietSync'
      );
      await performQuietSync(profile).catch(() => {});
      await hydrateWorkshopIntoDexie(workshopId, {
        force: options?.forcePull !== false,
      }).catch(() => {});
      dataSynced = true;
    } else {
      dataSynced = true;
    }

    const syncedAt = new Date().toISOString();
    saveUserSubscription(userId, {
      ...nextState,
      syncedToCloudAt: syncedAt,
      syncStatus: cloudSaved ? 'synced' : 'pending_offline',
    });

    if (typeof window !== 'undefined' && workshopId) {
      window.dispatchEvent(
        new CustomEvent('alshams_subscription_synced', {
          detail: { userId, workshopId, syncedAt, activePackageIds: nextState.activePackageIds },
        })
      );
    }

    return { cloudSaved, dataSynced, offline: false, syncedAt };
  } catch {
    saveUserSubscription(userId, { ...nextState, syncStatus: 'pending_offline' });
    return { cloudSaved, dataSynced, offline: false };
  }
}

export function useUserSubscription(profile?: UserProfile | null): UserSubscriptionState {
  const userId = profile?.workshopId || profile?.id || profile?.email || '';
  const [state, setState] = useState<UserSubscriptionState>(() => getStoredUserSubscription(userId));
  const [, setAdminCfgTick] = useState(0);

  const profileSettings = (profile as any)?.settings;

  useEffect(() => {
    if (!userId) return;
    const local = getStoredUserSubscription(userId);
    const cloudSub = profileSettings?.subscription as Partial<UserSubscriptionState> | undefined;

    if (cloudSub && Array.isArray(cloudSub.activePackageIds)) {
      const cloudTs = Date.parse(cloudSub.updatedAt || cloudSub.syncedToCloudAt || '') || 0;
      const localTs = Date.parse(local.updatedAt || '') || 0;
      if (!local.hasSelectedPackages || cloudTs > localTs) {
        const hydrated = saveUserSubscription(userId, {
          activePackageIds: cloudSub.activePackageIds as SubscriptionPackageId[],
          hasSelectedPackages: Boolean(cloudSub.hasSelectedPackages),
          selectedAt: cloudSub.selectedAt,
          promoClaimed: cloudSub.promoClaimed !== false,
          updatedAt: cloudSub.updatedAt || new Date().toISOString(),
          syncedToCloudAt: cloudSub.syncedToCloudAt || cloudSub.updatedAt,
          syncStatus: 'synced',
        });
        setState(hydrated);
        return;
      }
    }
    setState(local);
  }, [userId, profileSettings]);

  useEffect(() => {
    if (!userId || !profile) return;
    const handleOnline = () => {
      const latest = getStoredUserSubscription(userId);
      if (latest.syncStatus === 'pending_offline' && latest.hasSelectedPackages) {
        syncUserSubscriptionAndData(profile, latest, { forcePull: true }).catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId, profile]);

  useEffect(() => {
    if (!userId) return;
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ userId?: string; state?: UserSubscriptionState }>)?.detail;
      if (!detail || !detail.userId || detail.userId === userId) {
        setState(detail?.state || getStoredUserSubscription(userId));
      }
    };
    const onAdminCfg = () => setAdminCfgTick((t) => t + 1);
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, onUpdated);
    window.addEventListener(PACKAGES_ADMIN_CONFIG_UPDATED_EVENT, onAdminCfg);
    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, onUpdated);
      window.removeEventListener(PACKAGES_ADMIN_CONFIG_UPDATED_EVENT, onAdminCfg);
    };
  }, [userId]);

  return state;
}

/**
 * فحص دقيق لكل زر فردي (actionKey) ضد الباقات المفعّلة للعضو + تخصيصات السوبر أدمن
 */
export function isActionUnlockedBySubscription(
  actionKey: string,
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  if (!sub.hasSelectedPackages) return true;

  // الإعدادات واشتراكاتي مفتوحة دائماً مع الكل
  if (actionKey === 'open_settings' || actionKey === 'nav_my_subscriptions') return true;

  const packages = getSubscriptionPackages();
  const activeSet = new Set<SubscriptionPackageId>(['core_free', ...sub.activePackageIds]);
  for (const pkg of packages) {
    if (!activeSet.has(pkg.id)) continue;
    const list = role === 'supplier' ? pkg.allowedActionsSupplier : pkg.allowedActionsArtisan;
    if (list.includes(actionKey)) return true;
  }
  return false;
}

/**
 * فحص دقيق لكل صفحة/قسم في القائمة الجانبية والتوجيه ضد الباقات المفعّلة + تخصيصات السوبر أدمن
 */
export function isModuleUnlockedBySubscription(
  moduleId: string,
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  if (!sub.hasSelectedPackages) return true;

  // الرئيسية + اشتراكاتي + الإعدادات متاحة دائماً للجميع
  if (moduleId === 'home' || moduleId === 'my_subscriptions' || moduleId === 'settings') {
    return true;
  }

  const packages = getSubscriptionPackages();
  const activeSet = new Set<SubscriptionPackageId>(['core_free', ...sub.activePackageIds]);
  for (const pkg of packages) {
    if (!activeSet.has(pkg.id)) continue;
    const modList = role === 'supplier' ? pkg.includedModulesSupplier : pkg.includedModulesArtisan;
    if (modList.includes(moduleId)) return true;

    const actList = role === 'supplier' ? pkg.allowedActionsSupplier : pkg.allowedActionsArtisan;
    const derived = deriveModulesFromActions(actList, role);
    if (derived.includes(moduleId)) return true;
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
