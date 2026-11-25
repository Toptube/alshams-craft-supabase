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

export type AiAssistantChoice = 'shamousa' | 'falcon';

export const ALL_AI_ASSISTANT_CHOICES: AiAssistantChoice[] = ['shamousa', 'falcon'];

export interface UserSubscriptionState {
  activePackageIds: SubscriptionPackageId[];
  /** اختيار مستقل داخل باقة المساعد الذكي الواحدة: شموسة فقط، صقر فقط، أو الاثنين معاً */
  aiAssistantChoices?: AiAssistantChoice[];
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
  { actionKey: 'open_shamousa', label: '«شموسة» مديرة أعمالك ☀️', description: 'تفعيل شموسة مديرة أعمالك داخل هذه الباقة (تعمل بذكاء على قد باقات المشترك فقط — ممنوعة في الباقة الأساسية)' },
  { actionKey: 'nav_ai_agent', label: 'المستشار الهندسي «صقر الشمساوية» AI 🦅', description: 'تفعيل صقر AI بشكل مستقل داخل هذه الباقة (ممنوع في الباقة الأساسية)' },
];

export const ADMIN_SYSTEM_ACTIONS_SUPPLIER: AdminControllableSystemAction[] = [
  { actionKey: 'top_nav_family', label: 'زرار «العيلة» في الشريط العلوي', description: 'إظهار زرار مجتمع العيلة أعلى الشاشة' },
  { actionKey: 'top_nav_store', label: 'زرار «متجري» وأدوات رابط المتجر و QR', description: 'إظهار متجري أعلى الشاشة وأزرار معاينة ورابط المتجر' },
  { actionKey: 'top_nav_quick_add', label: 'زرار الإضافة السريعة (+) أعلى الشاشة', description: 'قائمة (+) المختصرة في الشريط العلوي' },
  { actionKey: 'widget_home_summary', label: 'صناديق ملخص السيولة والمخزون', description: 'مؤشرات الأرصدة والمخزون والمبيعات في الرئيسية' },
  { actionKey: 'open_shamousa', label: '«شموسة» مديرة أعمالك ☀️', description: 'تفعيل شموسة مديرة أعمالك للمورد داخل هذه الباقة (تعمل على قد باقاته فقط — ممنوعة في الباقة الأساسية)' },
  { actionKey: 'nav_ai_agent', label: 'المستشار الهندسي «صقر الشمساوية» AI 🦅', description: 'تفعيل صقر AI للمورد بشكل مستقل داخل هذه الباقة (ممنوع في الباقة الأساسية)' },
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
  open_shamousa: ['shamousa'],
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
  open_shamousa: ['shamousa'],
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

    const rawActionsArtisan = Array.isArray(ov.allowedActionsArtisan)
      ? ov.allowedActionsArtisan
      : def.allowedActionsArtisan;
    const rawActionsSupplier = Array.isArray(ov.allowedActionsSupplier)
      ? ov.allowedActionsSupplier
      : def.allowedActionsSupplier;

    // قاعدة ثابتة: الباقة الأساسية (core_free) لا تشمل أبداً شموسة أو صقر
    const nextActionsArtisan =
      def.id === 'core_free'
        ? rawActionsArtisan.filter((a) => a !== 'open_shamousa' && a !== 'nav_ai_agent')
        : rawActionsArtisan;
    const nextActionsSupplier =
      def.id === 'core_free'
        ? rawActionsSupplier.filter((a) => a !== 'open_shamousa' && a !== 'nav_ai_agent')
        : rawActionsSupplier;

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

export function normalizeAiAssistantChoices(raw?: unknown): AiAssistantChoice[] {
  if (!Array.isArray(raw)) return [];
  const valid: AiAssistantChoice[] = [];
  if (raw.includes('shamousa')) valid.push('shamousa');
  if (raw.includes('falcon')) valid.push('falcon');
  return valid;
}

/**
 * يرجّع المساعدين المفعّلين فعلياً داخل باقة الذكاء الاصطناعي (شموسة / صقر / الاثنين معاً).
 * الحسابات القديمة اللي فعّلت ai_assistants قبل الفصل تحصل تلقائياً على الاثنين معاً بدون فقدان أي صلاحية.
 */
export function getEffectiveAiAssistantChoices(sub: UserSubscriptionState): AiAssistantChoice[] {
  if (!sub.hasSelectedPackages) return [...ALL_AI_ASSISTANT_CHOICES];
  if (!sub.activePackageIds.includes('ai_assistants')) return [];
  if (Array.isArray(sub.aiAssistantChoices)) {
    return normalizeAiAssistantChoices(sub.aiAssistantChoices);
  }
  return [...ALL_AI_ASSISTANT_CHOICES];
}

export function getDefaultSubscriptionState(): UserSubscriptionState {
  return {
    activePackageIds: [...ALL_PACKAGE_IDS],
    aiAssistantChoices: [...ALL_AI_ASSISTANT_CHOICES],
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
    const aiChoices = Array.isArray(parsed.aiAssistantChoices)
      ? normalizeAiAssistantChoices(parsed.aiAssistantChoices)
      : ids.includes('ai_assistants')
      ? [...ALL_AI_ASSISTANT_CHOICES]
      : [];
    return {
      activePackageIds: ids,
      aiAssistantChoices: aiChoices,
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
  let mergedIds = Array.from(
    new Set<SubscriptionPackageId>([
      'core_free',
      ...((next.activePackageIds || prev.activePackageIds).filter((x): x is SubscriptionPackageId =>
        ALL_PACKAGE_IDS.includes(x as SubscriptionPackageId)
      ) as SubscriptionPackageId[]),
    ])
  );

  let resolvedAiChoices: AiAssistantChoice[];
  if (Array.isArray(next.aiAssistantChoices)) {
    resolvedAiChoices = normalizeAiAssistantChoices(next.aiAssistantChoices);
    if (resolvedAiChoices.length > 0 && !mergedIds.includes('ai_assistants')) {
      mergedIds = [...mergedIds, 'ai_assistants'];
    } else if (resolvedAiChoices.length === 0) {
      mergedIds = mergedIds.filter((id) => id !== 'ai_assistants');
    }
  } else if (next.activePackageIds !== undefined) {
    if (!mergedIds.includes('ai_assistants')) {
      resolvedAiChoices = [];
    } else {
      const prevChoices = getEffectiveAiAssistantChoices(prev);
      resolvedAiChoices = prevChoices.length > 0 ? prevChoices : [...ALL_AI_ASSISTANT_CHOICES];
    }
  } else {
    resolvedAiChoices = getEffectiveAiAssistantChoices(prev);
  }

  const finalState: UserSubscriptionState = {
    activePackageIds: mergedIds,
    aiAssistantChoices: resolvedAiChoices,
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
          aiAssistantChoices: Array.isArray(cloudSub.aiAssistantChoices)
            ? normalizeAiAssistantChoices(cloudSub.aiAssistantChoices)
            : undefined,
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

function getScopedActionsForPackage(
  pkg: SubscriptionPackageDefinition,
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier'
): string[] {
  const base = role === 'supplier' ? pkg.allowedActionsSupplier : pkg.allowedActionsArtisan;
  if (pkg.id !== 'ai_assistants') return base;
  const aiChoices = getEffectiveAiAssistantChoices(sub);
  return base.filter((actionKey) => {
    if (actionKey === 'open_shamousa') return aiChoices.includes('shamousa');
    if (actionKey === 'nav_ai_agent') return aiChoices.includes('falcon');
    return true;
  });
}

function getScopedModulesForPackage(
  pkg: SubscriptionPackageDefinition,
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier'
): string[] {
  const base = role === 'supplier' ? pkg.includedModulesSupplier : pkg.includedModulesArtisan;
  if (pkg.id !== 'ai_assistants') return base;
  const aiChoices = getEffectiveAiAssistantChoices(sub);
  return base.filter((mod) => {
    if (mod === 'shamousa') return aiChoices.includes('shamousa');
    if (mod === 'ai_agent') return aiChoices.includes('falcon');
    return true;
  });
}

/**
 * فحص دقيق لكل زر فردي (actionKey) ضد الباقات المفعّلة للعضو + تخصيصات السوبر أدمن + اختيار شموسة/صقر
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
    const list = getScopedActionsForPackage(pkg, sub, role);
    if (list.includes(actionKey)) return true;
  }
  return false;
}

/**
 * فحص دقيق لكل صفحة/قسم في القائمة الجانبية والتوجيه ضد الباقات المفعّلة + تخصيصات السوبر أدمن + اختيار شموسة/صقر
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
    const modList = getScopedModulesForPackage(pkg, sub, role);
    if (modList.includes(moduleId)) return true;

    const actList = getScopedActionsForPackage(pkg, sub, role);
    const derived = deriveModulesFromActions(actList, role);
    if (derived.includes(moduleId)) return true;
  }
  return false;
}

export function isShamousaUnlockedBySubscription(
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): boolean {
  return isActionUnlockedBySubscription('open_shamousa', sub, role, isAdmin);
}

export function isSakrUnlockedBySubscription(
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): boolean {
  return isActionUnlockedBySubscription('nav_ai_agent', sub, role, isAdmin);
}

/**
 * القاعدة الموحدة لظهور الكرة العائمة وكل أزرار وكروت شموسة:
 * تتبع تفعيل شموسة فقط — تظهر في أي خليط باقات طالما شموسة مفعّلة، وتختفي تماماً مع كل أزرارها لو شموسة مطفية.
 */
export function shouldShowShamousaUi(
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false,
  aiAssistantsEnabled = true
): boolean {
  if (isAdmin) return true;
  if (!aiAssistantsEnabled) return false;
  return isShamousaUnlockedBySubscription(sub, role, false);
}

/**
 * القاعدة الموحدة لظهور المستشار الهندسي صقر AI بشكل مستقل تماماً عن شموسة.
 */
export function shouldShowFalconUi(
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false,
  aiAssistantsEnabled = true
): boolean {
  if (isAdmin) return true;
  if (!aiAssistantsEnabled) return false;
  return isSakrUnlockedBySubscription(sub, role, false);
}

export interface UserSubscriptionCapabilities {
  isFullAccess: boolean;
  role: 'artisan' | 'supplier';
  activePackages: SubscriptionPackageDefinition[];
  lockedPackages: SubscriptionPackageDefinition[];
  activePackageTitles: string[];
  allowedActions: Set<string>;
  allowedModules: Set<string>;
  canStorefront: boolean;
  canCatalog: boolean;
  canOrders: boolean;
  canFinance: boolean;
  canInventory: boolean;
  canProduction: boolean;
  canSalesCrm: boolean;
  canHr: boolean;
  canExecutiveBrief: boolean;
  canGuides: boolean;
  canShamousa: boolean;
  canSakr: boolean;
  findUnlockingPackagesForActions: (actionKeys: string[]) => SubscriptionPackageDefinition[];
}

export function buildUserSubscriptionCapabilities(
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): UserSubscriptionCapabilities {
  const allPackages = getSubscriptionPackages();
  const isFullAccess = isAdmin || !sub.hasSelectedPackages;
  const activeIdSet = new Set<SubscriptionPackageId>(
    isFullAccess ? allPackages.map((p) => p.id) : ['core_free', ...sub.activePackageIds]
  );

  const activeAiChoices = isFullAccess ? [...ALL_AI_ASSISTANT_CHOICES] : getEffectiveAiAssistantChoices(sub);
  const activePackages = allPackages.filter((p) => {
    if (!activeIdSet.has(p.id)) return false;
    if (p.id === 'ai_assistants' && !isFullAccess && activeAiChoices.length === 0) return false;
    return true;
  });
  const lockedPackages = allPackages.filter((p) => !activePackages.some((ap) => ap.id === p.id));
  const activePackageTitles = activePackages.map((p) => {
    const baseTitle = role === 'supplier' && p.supplierTitleAr ? p.supplierTitleAr : p.titleAr;
    if (p.id === 'ai_assistants' && !isFullAccess && activeAiChoices.length === 1) {
      return activeAiChoices[0] === 'shamousa'
        ? `${baseTitle} — شموسة فقط`
        : `${baseTitle} — صقر فقط`;
    }
    return baseTitle;
  });

  const allowedActions = new Set<string>(['open_settings', 'nav_my_subscriptions']);
  const allowedModules = new Set<string>(['home', 'my_subscriptions', 'settings']);

  for (const pkg of activePackages) {
    const acts = isFullAccess
      ? role === 'supplier'
        ? pkg.allowedActionsSupplier
        : pkg.allowedActionsArtisan
      : getScopedActionsForPackage(pkg, sub, role);
    const mods = isFullAccess
      ? role === 'supplier'
        ? pkg.includedModulesSupplier
        : pkg.includedModulesArtisan
      : getScopedModulesForPackage(pkg, sub, role);
    acts.forEach((a) => allowedActions.add(a));
    mods.forEach((m) => allowedModules.add(m));
    deriveModulesFromActions(acts, role).forEach((m) => allowedModules.add(m));
  }

  const hasAny = (keys: string[]) => isFullAccess || keys.some((k) => allowedActions.has(k));

  const findUnlockingPackagesForActions = (actionKeys: string[]): SubscriptionPackageDefinition[] => {
    return allPackages.filter((pkg) => {
      if (pkg.id === 'core_free') return false;
      const acts = role === 'supplier' ? pkg.allowedActionsSupplier : pkg.allowedActionsArtisan;
      return actionKeys.some((k) => acts.includes(k));
    });
  };

  return {
    isFullAccess,
    role,
    activePackages,
    lockedPackages,
    activePackageTitles,
    allowedActions,
    allowedModules,
    canStorefront: hasAny([
      'open_artisan_store_products',
      'top_nav_store',
      'sup_storefront',
      'nav_marketplace',
      'sup_market',
    ]),
    canCatalog: hasAny(['nav_catalog', 'quick_direct_product', 'sup_catalog']),
    canOrders: hasAny(['open_artisan_store_orders', 'sup_orders']),
    canFinance: hasAny([
      'nav_treasuries',
      'nav_accounts',
      'modal_admin_costs',
      'nav_fixed_assets',
      'modal_exchange_rates',
      'nav_reports',
      'sup_finance',
      'sup_erp_hub',
    ]),
    canInventory: hasAny([
      'nav_materials',
      'modal_new_material',
      'modal_inv_materials',
      'modal_inv_audit',
      'modal_inv_products',
      'nav_purchases',
      'modal_supplier_invoice',
      'nav_suppliers',
      'modal_create_supplier',
      'nav_suppliers_market',
      'nav_unified_materials',
      'sup_warehouse_erp',
      'sup_unified_materials',
    ]),
    canProduction: hasAny([
      'nav_calculator',
      'nav_archive',
      'nav_work_orders',
      'nav_work_orders_create',
      'nav_work_orders_issue',
      'nav_work_orders_receive',
    ]),
    canSalesCrm: hasAny([
      'nav_sales',
      'nav_sales_new',
      'nav_invoices',
      'nav_invoices_returns',
      'nav_customers',
      'modal_new_client',
      'sup_customers',
      'sup_pos',
    ]),
    canHr: hasAny(['nav_hr', 'modal_new_employee', 'sup_hr_terminal']),
    canExecutiveBrief: hasAny(['open_executive_brief', 'sup_executive_brief']),
    canGuides: hasAny([
      'open_guide_start',
      'open_guide_daily',
      'sup_guide_start',
      'sup_guide_daily',
    ]),
    canShamousa: hasAny(['open_shamousa']),
    canSakr: hasAny(['nav_ai_agent']),
    findUnlockingPackagesForActions,
  };
}

function normalizeArabicForScopeGuard(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .trim();
}

export interface LockedQueryGuardResult {
  blocked: boolean;
  domainLabel: string;
  reply: string;
  suggestedPackages: string[];
  actionLink: { label: string; view: 'my_subscriptions' };
}

export type ShamousaFeatureName =
  | 'core_profile'
  | 'family_table'
  | 'storefront'
  | 'catalog'
  | 'orders'
  | 'costing'
  | 'production'
  | 'inventory'
  | 'purchases'
  | 'finance'
  | 'sales_crm'
  | 'hr'
  | 'executive_brief'
  | 'shamousa'
  | 'sakr'
  | 'marketing_review'
  | 'whatsapp_messages';

export interface AccountPackageQueryOptions {
  role?: 'artisan' | 'supplier';
  isAdmin?: boolean;
  overrideSub?: UserSubscriptionState;
}

/**
 * مصدر الحقيقة الموحد: يرجّع قائمة الباقات المفعّلة للحساب (مع قراءة فورية لتعديلات السوبر أدمن).
 */
export function getActivePackages(
  accountId: string,
  options?: AccountPackageQueryOptions
): SubscriptionPackageDefinition[] {
  const role = options?.role || 'artisan';
  const isAdmin = Boolean(options?.isAdmin);
  const sub = options?.overrideSub || getStoredUserSubscription(accountId || undefined);
  const caps = buildUserSubscriptionCapabilities(sub, role, isAdmin);
  return caps.activePackages;
}

/**
 * مصدر الحقيقة الموحد: يتحقق هل ميزة/قدرة معينة مفتوحة للحساب قبل قراءة بياناتها أو اقتراحها.
 */
export function hasFeature(
  name: ShamousaFeatureName,
  accountId?: string,
  options?: AccountPackageQueryOptions
): boolean {
  const role = options?.role || 'artisan';
  const isAdmin = Boolean(options?.isAdmin);
  const sub = options?.overrideSub || getStoredUserSubscription(accountId || undefined);
  const caps = buildUserSubscriptionCapabilities(sub, role, isAdmin);

  if (caps.isFullAccess) return true;

  switch (name) {
    case 'core_profile':
    case 'family_table':
      return true; // الباقة الأساسية دايماً مفعّلة لكل عضو
    case 'storefront':
      return caps.canStorefront;
    case 'catalog':
      return caps.canCatalog;
    case 'orders':
      return caps.canOrders;
    case 'marketing_review':
      return caps.canStorefront || caps.canCatalog;
    case 'whatsapp_messages':
      return caps.canStorefront || caps.canCatalog || caps.canSalesCrm || caps.canOrders;
    case 'costing':
    case 'production':
      return caps.canProduction;
    case 'inventory':
    case 'purchases':
      return caps.canInventory;
    case 'finance':
      return caps.canFinance;
    case 'sales_crm':
      return caps.canSalesCrm;
    case 'hr':
      return caps.canHr;
    case 'executive_brief':
      return caps.canExecutiveBrief;
    case 'shamousa':
      return caps.canShamousa;
    case 'sakr':
      return caps.canSakr;
    default:
      return false;
  }
}

export function buildActiveCapabilitiesSummaryList(
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): string[] {
  const caps = buildUserSubscriptionCapabilities(sub, role, isAdmin);
  const list: string[] = ['صفحتك الشخصية ومعرض الأعمال وطبلية عيلة الشمساوية', 'تجهيز منتج جديد (عنوان، وصف، قصة، هاشتاجات، وبوستات)'];
  if (caps.canStorefront || caps.canCatalog) {
    list.push('إدارة متجرك والكتالوج ومراجعة منتجاتك ورسائل الواتساب');
  }
  if (caps.canProduction) {
    list.push('حاسبة التكاليف والتسعير وأوامر التشغيل');
  }
  if (caps.canInventory) {
    list.push('المخازن والخامات والجرد والمشتريات');
  }
  if (caps.canFinance || caps.canSalesCrm) {
    list.push('الخزائن والمبيعات والفواتير وكشوف حساب العملاء');
  }
  if (caps.canHr) {
    list.push('فريق العمل والرواتب');
  }
  return list;
}

export function buildFourPartLockedPackageReply(params: {
  firstName?: string;
  sub: UserSubscriptionState;
  role: 'artisan' | 'supplier';
  isAdmin?: boolean;
  lockedFeatureLabel: string;
  unlockingPackages: SubscriptionPackageDefinition[];
  targetAssistant?: 'shamousa' | 'falcon';
}): { reply: string; suggestedPackageName: string | null } {
  const caps = buildUserSubscriptionCapabilities(params.sub, params.role, Boolean(params.isAdmin));
  const currentList = caps.activePackageTitles.map((t) => `«${t}»`).join(' + ');
  const canDoList = buildActiveCapabilitiesSummaryList(params.sub, params.role, Boolean(params.isAdmin));

  // اقتراح باقة واحدة فقط كحد أقصى في الرد الواحد
  const primaryPkg = params.unlockingPackages[0] || null;
  const suggestedTitle = primaryPkg
    ? params.role === 'supplier' && primaryPkg.supplierTitleAr
      ? primaryPkg.supplierTitleAr
      : primaryPkg.titleAr
    : null;

  const line1 = `1) **إنت دلوقتي في الباقات دي:** ${currentList}.`;
  const line2 = `2) **اللي تقدر تعمله:** ${canDoList.join('، ')}.`;
  const line3 = `3) **اللي مش متاح في باقاتك:** ${params.lockedFeatureLabel}.`;

  let line4: string;
  if (params.targetAssistant === 'shamousa') {
    const pkgLabel = suggestedTitle || 'باقة المساعد الذكي';
    line4 = `4) **لو عايز شموسة:** فعّل خيار «شموسة مديرة أعمالك» داخل «${pkgLabel}» من صفحة «اشتراكاتي»، وهي مجانية دلوقتي.`;
  } else if (params.targetAssistant === 'falcon') {
    const pkgLabel = suggestedTitle || 'باقة المساعد الذكي';
    line4 = `4) **لو عايز صقر:** فعّل خيار «صقر المستشار الهندسي AI» داخل «${pkgLabel}» من صفحة «اشتراكاتي»، وهي مجانية دلوقتي.`;
  } else {
    line4 = suggestedTitle
      ? primaryPkg?.promoFreeLimitedTime || primaryPkg?.isAlwaysFree
        ? `4) **لو عايز تضيفه:** اشترك في باقة «${suggestedTitle}»، وهي مجانية دلوقتي.`
        : `4) **لو عايز تضيفه:** اشترك في باقة «${suggestedTitle}» من صفحة «اشتراكاتي».`
      : `4) **لو عايز تضيفه:** راجع الباقة المناسبة من صفحة «اشتراكاتي»، والباقات مجانية دلوقتي.`;
  }

  return {
    suggestedPackageName:
      params.targetAssistant === 'shamousa'
        ? 'شموسة مديرة أعمالك'
        : params.targetAssistant === 'falcon'
        ? 'صقر المستشار الهندسي AI'
        : suggestedTitle,
    reply: `${line1}\n${line2}\n${line3}\n${line4}`,
  };
}

/**
 * حارس ذكي يعمل أوفلاين وأونلاين: يفحص سؤال المستخدم ضد باقاته المفعّلة حالياً
 * (مع قراءة فورية لأي تعديلات قام بها السوبر أدمن في شاشة إدارة الباقات).
 * يلتزم حرفياً بالترتيب الرباعي وبحد أقصى اقتراح باقة واحدة فقط في الرد.
 */
export function detectLockedSubscriptionQuery(
  userText: string,
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false,
  firstName = 'صديقي'
): LockedQueryGuardResult | null {
  const caps = buildUserSubscriptionCapabilities(sub, role, isAdmin);
  if (caps.isFullAccess) return null;

  const norm = normalizeArabicForScopeGuard(userText);
  if (!norm || norm.length < 2) return null;

  // لا نمنع الأسئلة العامة عن الباقات أو الاشتراكات نفسها
  if (/(الباقات|اشتراك|اشتراكاتي|الاسعار الشهريه|ترقيه|باقتي|مشترك في ايه|مفتوحلي ايه)/.test(norm)) {
    return null;
  }

  const rules: Array<{
    unlocked: boolean;
    domainLabel: string;
    actionKeys: string[];
    pattern: RegExp;
    targetAssistant?: 'shamousa' | 'falcon';
  }> = [
    {
      unlocked: caps.canExecutiveBrief,
      domainLabel: 'بطاقة «هلخصهالك» والملخص المالي والمخزني الشامل',
      actionKeys: role === 'supplier' ? ['sup_executive_brief'] : ['open_executive_brief'],
      pattern: /(هلخصهالك|الملخص التنفيذي|ملخص الورشه|ملخص شامل|الموقف المالي كله)/,
    },
    {
      unlocked: caps.canProduction,
      domainLabel: 'حاسبة التكاليف والتسعير وحساب هامش الربح وأوامر التشغيل',
      actionKeys: ['nav_calculator', 'nav_work_orders', 'nav_archive'],
      pattern:
        /(اوامر التشغيل|امر تشغيل|امر شغل|حاسبه التكاليف|حاسبة التكاليف|التكاليف|التكلفه|التكلفة|هامش الربح|نسبه الربح|تسعير قطعه|عايز اسعر|اسعر المنتج|الهالك|المصنعيه|صرف خامات للتصنيع|استلام منتج تام|ارشيف المشغولات)/,
    },
    {
      unlocked: caps.canInventory,
      domainLabel: 'المخازن وجرد الخامات والمشتريات والموردين',
      actionKeys:
        role === 'supplier'
          ? ['sup_warehouse_erp', 'sup_unified_materials']
          : ['nav_materials', 'modal_inv_materials', 'nav_purchases', 'nav_suppliers', 'nav_unified_materials'],
      pattern:
        /(مخزني|المخزن فيه|خاماتي|رصيد الخام|نواقص الخام|خامات ناقصه|جرد المخزن|المخزون|كارت الصنف|المشتريات|فاتوره شراء|الموردين|مورديني|سوق الموردين|الخامات الموحده|المصانع)/,
    },
    {
      unlocked: caps.canFinance,
      domainLabel: 'الخزائن والسيولة والحسابات والمصروفات والتقارير المالية',
      actionKeys:
        role === 'supplier'
          ? ['sup_finance', 'sup_erp_hub']
          : ['nav_treasuries', 'nav_accounts', 'modal_admin_costs', 'nav_reports'],
      pattern:
        /(معايا كام|معانا كام|في الخزن|الخزينه|الخزنه|السيوله|الفلوس اللي مع|رصيد الخز|لينا كام بره|علينا كام|المصروفات|مصاريفي|ميزان المراجعه|الدفتر المالي|ارباحي|التقارير الماليه|الاصول الثابته|اسعار الصرف|عهده|توريدات الفروع)/,
    },
    {
      unlocked: caps.canHr,
      domainLabel: 'شؤون العاملين والحرفيين والرواتب وتثبيت الأجهزة',
      actionKeys: role === 'supplier' ? ['sup_hr_terminal'] : ['nav_hr', 'modal_new_employee'],
      pattern: /(الموظفين|العمال|الحرفيين|الرواتب|المرتبات|السلف|الحضور والانصراف|تثبيت الاجهزه|شؤون العاملين)/,
    },
    {
      unlocked: caps.canSalesCrm,
      domainLabel: role === 'supplier' ? 'كاشير نقاط البيع (POS) والعملاء' : 'المبيعات والفواتير وكشوف حساب العملاء',
      actionKeys:
        role === 'supplier'
          ? ['sup_pos', 'sup_customers']
          : ['nav_sales', 'nav_invoices', 'nav_customers'],
      pattern:
        /(كاشير|نقاط البيع|pos|الورديه|فواتير المبيعات|سجل الفواتير|مرتجعات المبيعات|كشف حساب العميل|كشف حساب العملاء|عملائي الاجل|مديونيه العملاء)/,
    },
    {
      unlocked: caps.canStorefront || caps.canCatalog || caps.canOrders,
      domainLabel: 'المتجر الإلكتروني والكتالوج وأوردرات المتجر',
      actionKeys:
        role === 'supplier'
          ? ['sup_storefront', 'sup_catalog', 'sup_orders']
          : ['open_artisan_store_products', 'nav_catalog', 'open_artisan_store_orders'],
      pattern: /(متجري|الكتالوج|اوردراتي|منتج مباشر|كوبون|اكواد خصم|سوق الشمساويه|راجع منتجاتي|مراجعه منتجاتي|مراجعه المتجر)/,
    },
    {
      unlocked: caps.canShamousa,
      domainLabel: '«شموسة» مديرة أعمالك',
      actionKeys: ['open_shamousa'],
      pattern: /(عايز شموسه|افتحي شموسه|تفعيل شموسه|مديره اعمالي شموسه|شموسه فين)/,
      targetAssistant: 'shamousa',
    },
    {
      unlocked: caps.canSakr,
      domainLabel: 'المستشار الهندسي «صقر الشمساوية» AI',
      actionKeys: ['nav_ai_agent'],
      pattern: /(حوليني لصقر|عايز صقر|افتحي صقر|استشاره صقر|دراسه سوق من صقر|تفعيل صقر|صقر فين|صقر ai)/,
      targetAssistant: 'falcon',
    },
  ];

  for (const rule of rules) {
    if (rule.unlocked) continue;
    if (rule.pattern.test(norm)) {
      const unlockingPkgs = caps.findUnlockingPackagesForActions(rule.actionKeys);
      const fourPart = buildFourPartLockedPackageReply({
        firstName,
        sub,
        role,
        isAdmin,
        lockedFeatureLabel: rule.domainLabel,
        unlockingPackages: unlockingPkgs,
        targetAssistant: rule.targetAssistant,
      });

      return {
        blocked: true,
        domainLabel: rule.domainLabel,
        suggestedPackages: fourPart.suggestedPackageName ? [fourPart.suggestedPackageName] : [],
        reply: fourPart.reply,
        actionLink: { label: 'فتح صفحة اشتراكاتي 👑', view: 'my_subscriptions' },
      };
    }
  }

  return null;
}

/**
 * يبني سياق الاشتراك الحي والملزم لإرساله لـ شموسة وصقر (سحابياً ومحلياً)
 * يتحدّث تلقائياً فور أي تعديل يقوم به السوبر أدمن في شاشة «إدارة الباقات والصلاحيات».
 */
export function buildAiSubscriptionPromptContext(
  sub: UserSubscriptionState,
  role: 'artisan' | 'supplier',
  isAdmin = false
): {
  promptText: string;
  scopeFlags: {
    isFullAccess: boolean;
    canStorefront: boolean;
    canCatalog: boolean;
    canOrders: boolean;
    canFinance: boolean;
    canInventory: boolean;
    canProduction: boolean;
    canSalesCrm: boolean;
    canHr: boolean;
    canExecutiveBrief: boolean;
    canGuides: boolean;
    canShamousa: boolean;
    canSakr: boolean;
    activePackageTitles: string[];
  };
} {
  const caps = buildUserSubscriptionCapabilities(sub, role, isAdmin);
  const allPackages = getSubscriptionPackages();

  const scopeFlags = {
    isFullAccess: caps.isFullAccess,
    canStorefront: caps.canStorefront,
    canCatalog: caps.canCatalog,
    canOrders: caps.canOrders,
    canFinance: caps.canFinance,
    canInventory: caps.canInventory,
    canProduction: caps.canProduction,
    canSalesCrm: caps.canSalesCrm,
    canHr: caps.canHr,
    canExecutiveBrief: caps.canExecutiveBrief,
    canGuides: caps.canGuides,
    canShamousa: caps.canShamousa,
    canSakr: caps.canSakr,
    activePackageTitles: caps.activePackageTitles,
  };

  const packagesDirectory = allPackages
    .map((p) => {
      const title = role === 'supplier' && p.supplierTitleAr ? p.supplierTitleAr : p.titleAr;
      const status = caps.activePackages.some((ap) => ap.id === p.id) ? '✅ مشترك ومفعّلة الآن' : '🔒 غير مشترك فيها';
      const priceNote = p.isAlwaysFree
        ? 'مجانية للأبد'
        : p.promoFreeLimitedTime
        ? `مجانية لفترة محدودة (السعر الأصلي ${p.monthlyPriceEgp} ج.م/شهر)`
        : `${p.monthlyPriceEgp} ج.م/شهر`;
      return `  • ${title} [${status}] (${priceNote})`;
    })
    .join('\n');

  if (caps.isFullAccess) {
    return {
      scopeFlags,
      promptText: [
        '[نطاق اشتراكات الحساب الحي — محدّث من إعدادات السوبر أدمن]',
        '- حالة الاشتراك: كل الباقات مفتوحة لهذا الحساب.',
        '- خريطة باقات المنظومة الحالية:',
        packagesDirectory,
      ].join('\n'),
    };
  }

  const unlockedDomains: string[] = ['الصفحة الشخصية ومعرض الأعمال', 'مجتمع عيلة الشمساوية', 'الإعدادات واشتراكاتي'];
  const lockedDomains: string[] = [];

  if (caps.canStorefront || caps.canCatalog || caps.canOrders) {
    unlockedDomains.push('المتجر الإلكتروني والكتالوج وأوردرات المتجر');
  } else {
    lockedDomains.push('المتجر الإلكتروني والكتالوج وأوردرات المتجر');
  }
  if (caps.canFinance) unlockedDomains.push('الخزائن والسيولة والحسابات والمصروفات والتقارير');
  else lockedDomains.push('الخزائن والسيولة والفلوس والحسابات والمصروفات والتقارير المالية');

  if (caps.canInventory) unlockedDomains.push('المخازن والخامات والجرد والمشتريات والموردين');
  else lockedDomains.push('المخازن والخامات والنواقص والجرد والمشتريات والموردين');

  if (caps.canProduction) unlockedDomains.push('حاسبة التكاليف والتسعير وأوامر التشغيل والأرشيف');
  else lockedDomains.push('حاسبة التكاليف وأوامر التشغيل والتصنيع والأرشيف');

  if (caps.canSalesCrm) unlockedDomains.push(role === 'supplier' ? 'كاشير POS والعملاء' : 'المبيعات والفواتير وكشوف حساب العملاء');
  else lockedDomains.push(role === 'supplier' ? 'كاشير POS والعملاء' : 'المبيعات والفواتير وكشوف حساب العملاء');

  if (caps.canHr) unlockedDomains.push('شؤون العاملين والرواتب وتثبيت الأجهزة');
  else lockedDomains.push('شؤون العاملين والرواتب وتثبيت الأجهزة');

  if (caps.canExecutiveBrief) unlockedDomains.push('بطاقة «هلخصهالك» والملخص الشامل');
  else lockedDomains.push('بطاقة «هلخصهالك» والملخص المالي والمخزني الشامل');

  if (caps.canSakr) unlockedDomains.push('المستشار الهندسي صقر AI');
  else lockedDomains.push('المستشار الهندسي صقر AI (ممنوع اقتراح التحويل لصقر)');

  const promptText = [
    '🚨 [قانون حدود الاشتراك الصارم — خط أحمر لا يُتجاوز أبداً — محدّث تلقائياً من السوبر أدمن]:',
    `- باقات المستخدم المفعّلة الآن فقط: ${caps.activePackageTitles.join(' + ')}.`,
    `- الأقسام المفتوحة له والمسموح لك مساعدته فيها فقط: ${unlockedDomains.join('، ')}.`,
    `- الأقسام المقفولة عليه الآن (ممنوع تماماً عرض أي أرقام أو ملخصات أو تقارير عنها): ${lockedDomains.join('، ')}.`,
    '- تعليمات إلزامية:',
    '  1. جاوبي المستخدم على قد الأقسام المفتوحة في باقاته الحالية وبس، وما تفتحييش سيرة خزينة أو مخزن أو أوامر تشغيل أو ملخص هلخصهالك لو مش مفتوحة له.',
    '  2. لو سأل المستخدم عن أي قسم مقفول (زي: معايا كام في الخزنة؟ مخزني فيه إيه؟ مصاريفي كام؟ أوامر الشغل؟)، اعتذري بلطف باللهجة المصرية وقولي له صراحة: إن القسم ده مش مفتوح في باقاته الحالية، واذكري له اسم الباقة المناسبة من القائمة التالية عشان يفعلها من صفحة «اشتراكاتي».',
    '- خريطة باقات المنظومة الحية (محدثة تلقائياً من لوحة السوبر أدمن):',
    packagesDirectory,
  ].join('\n');

  return { promptText, scopeFlags };
}

export function shouldPromptExistingUserForPackages(
  profile?: UserProfile | null,
  sub?: UserSubscriptionState
): boolean {
  if (!profile || !sub) return false;
  if (isUserAdmin(profile)) return false;
  return !sub.hasSelectedPackages;
}
