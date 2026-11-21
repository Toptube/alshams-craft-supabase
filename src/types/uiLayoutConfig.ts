import { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Boxes,
  Building,
  Calculator,
  ClipboardCheck,
  Coins,
  DollarSign,
  FileText,
  FolderArchive,
  GitBranch,
  Globe,
  Hammer,
  History,
  Layers,
  Lock,
  MonitorSmartphone,
  Package,
  PackageCheck,
  PackagePlus,
  PlusCircle,
  Receipt,
  RotateCcw,
  Scale,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Truck,
  User,
  UserPlus,
  Users,
  Users2,
  Wallet,
  Warehouse,
  ArrowLeftRight,
  AlertTriangle,
  Bell,
  Sun,
  Download,
  Compass,
  Briefcase,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlatformExperienceModeConfig } from './experienceMode';

export type UiLayoutAudience = 'artisan' | 'supplier';
export type UiCardShape = 'classic' | 'wide' | 'compact';
export type UiIconShape = 'rounded' | 'circle';

export interface UiIconOption {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export const UI_ICON_OPTIONS: UiIconOption[] = [
  { key: 'FileText', label: 'ملخص / مستند', Icon: FileText },
  { key: 'Layers', label: 'خامات / طبقات', Icon: Layers },
  { key: 'ShoppingBag', label: 'حقيبة / سوق', Icon: ShoppingBag },
  { key: 'Store', label: 'متجر / منصة', Icon: Store },
  { key: 'PackagePlus', label: 'مشتريات', Icon: PackagePlus },
  { key: 'Truck', label: 'موردين / شحن', Icon: Truck },
  { key: 'Boxes', label: 'مخازن / صناديق', Icon: Boxes },
  { key: 'Hammer', label: 'تصنيع / تشغيل', Icon: Hammer },
  { key: 'ShoppingCart', label: 'مبيعات / كاشير', Icon: ShoppingCart },
  { key: 'Users', label: 'عملاء / عيلة', Icon: Users },
  { key: 'Users2', label: 'فريق العمل', Icon: Users2 },
  { key: 'DollarSign', label: 'مصروفات / مال', Icon: DollarSign },
  { key: 'Wallet', label: 'خزائن وعُهد', Icon: Wallet },
  { key: 'Scale', label: 'حسابات / ميزان', Icon: Scale },
  { key: 'BarChart3', label: 'تقارير / إحصاء', Icon: BarChart3 },
  { key: 'Sparkles', label: 'ذكي / مميز', Icon: Sparkles },
  { key: 'GitBranch', label: 'شجرة الفروع', Icon: GitBranch },
  { key: 'Warehouse', label: 'مستودع / مخزن', Icon: Warehouse },
  { key: 'MonitorSmartphone', label: 'شاشات / تثبيت', Icon: MonitorSmartphone },
  { key: 'Package', label: 'طلبات / طرود', Icon: Package },
  { key: 'User', label: 'ملف شخصي', Icon: User },
  { key: 'Calculator', label: 'حاسبة', Icon: Calculator },
  { key: 'PlusCircle', label: 'إضافة', Icon: PlusCircle },
  { key: 'Tag', label: 'تسعير', Icon: Tag },
  { key: 'AlertTriangle', label: 'تنبيهات', Icon: AlertTriangle },
  { key: 'FolderArchive', label: 'أرشيف', Icon: FolderArchive },
  { key: 'Receipt', label: 'فواتير', Icon: Receipt },
  { key: 'ClipboardCheck', label: 'مراجعة / فحص', Icon: ClipboardCheck },
  { key: 'UserPlus', label: 'عميل/موظف جديد', Icon: UserPlus },
  { key: 'ArrowLeftRight', label: 'تحويلات', Icon: ArrowLeftRight },
  { key: 'History', label: 'سجل / كارت صنف', Icon: History },
  { key: 'PackageCheck', label: 'استلام جاهز', Icon: PackageCheck },
  { key: 'RotateCcw', label: 'مرتجع', Icon: RotateCcw },
  { key: 'Award', label: 'تميز / أجر', Icon: Award },
  { key: 'Coins', label: 'عملات / صرافة', Icon: Coins },
  { key: 'Building', label: 'أصول ثابتة', Icon: Building },
  { key: 'Lock', label: 'عهد مغلقة / إقفال', Icon: Lock },
  { key: 'TrendingUp', label: 'نمو / أرباح', Icon: TrendingUp },
  { key: 'BookOpen', label: 'كتالوج / دليل', Icon: BookOpen },
  { key: 'Globe', label: 'رابط / ويب', Icon: Globe },
  { key: 'Bell', label: 'إشعارات', Icon: Bell },
  { key: 'Sun', label: 'ثيم / إضاءة', Icon: Sun },
  { key: 'Download', label: 'تثبيت', Icon: Download },
  { key: 'Compass', label: 'استكشاف', Icon: Compass },
  { key: 'Briefcase', label: 'إدارة', Icon: Briefcase },
  { key: 'ShieldCheck', label: 'اعتماد', Icon: ShieldCheck },
  { key: 'HeartHandshake', label: 'شراكة', Icon: HeartHandshake },
];

export const UI_ICON_MAP: Record<string, LucideIcon> = UI_ICON_OPTIONS.reduce(
  (acc, cur) => {
    acc[cur.key] = cur.Icon;
    return acc;
  },
  {} as Record<string, LucideIcon>
);

export function getUiIcon(iconKey?: string): LucideIcon {
  return (iconKey && UI_ICON_MAP[iconKey]) || Sparkles;
}

export interface UiColorPreset {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  swatchHex: string;
}

export const UI_COLOR_PRESETS: UiColorPreset[] = [
  {
    key: 'orange_strong',
    label: 'برتقالي الشمساوية (بارز)',
    color: 'text-[#EA580C] dark:text-[#FBBF24]',
    bgColor: 'bg-orange-100 dark:bg-amber-950/50',
    borderColor: 'border-orange-300 dark:border-amber-700',
    swatchHex: '#EA580C',
  },
  {
    key: 'amber',
    label: 'كهرماني دافئ',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200/80 dark:border-amber-900/40',
    swatchHex: '#D97706',
  },
  {
    key: 'orange',
    label: 'برتقالي هادئ',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-200/80 dark:border-orange-900/40',
    swatchHex: '#F97316',
  },
  {
    key: 'emerald',
    label: 'أخضر زمردي',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200/80 dark:border-emerald-900/40',
    swatchHex: '#059669',
  },
  {
    key: 'blue',
    label: 'أزرق سماوي',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200/80 dark:border-blue-900/40',
    swatchHex: '#2563EB',
  },
  {
    key: 'indigo',
    label: 'نيلي عميق',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderColor: 'border-indigo-200/80 dark:border-indigo-900/40',
    swatchHex: '#4F46E5',
  },
  {
    key: 'cyan',
    label: 'فيروزي',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderColor: 'border-cyan-200/80 dark:border-cyan-900/40',
    swatchHex: '#0891B2',
  },
  {
    key: 'teal',
    label: 'أزرق مخضر',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    borderColor: 'border-teal-200/80 dark:border-teal-900/40',
    swatchHex: '#0D9488',
  },
  {
    key: 'violet',
    label: 'بنفسجي',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    borderColor: 'border-violet-200/80 dark:border-violet-900/40',
    swatchHex: '#7C3AED',
  },
  {
    key: 'purple',
    label: 'أرجواني',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40',
    borderColor: 'border-purple-200/80 dark:border-purple-900/40',
    swatchHex: '#9333EA',
  },
  {
    key: 'rose',
    label: 'وردي دافئ',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200/80 dark:border-rose-900/40',
    swatchHex: '#E11D48',
  },
  {
    key: 'red',
    label: 'أحمر تنبيهي',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-red-200/80 dark:border-red-900/40',
    swatchHex: '#DC2626',
  },
  {
    key: 'lime',
    label: 'أخضر ليموني',
    color: 'text-lime-600 dark:text-lime-400',
    bgColor: 'bg-lime-50 dark:bg-lime-950/40',
    borderColor: 'border-lime-200/80 dark:border-lime-900/40',
    swatchHex: '#65A30D',
  },
  {
    key: 'sky',
    label: 'سماوي فاتح',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/40',
    borderColor: 'border-sky-200/80 dark:border-sky-900/40',
    swatchHex: '#0284C7',
  },
];

export function getUiColorPreset(colorKey?: string): UiColorPreset {
  return UI_COLOR_PRESETS.find((c) => c.key === colorKey) || UI_COLOR_PRESETS[0];
}

export interface UiActionCatalogEntry {
  actionKey: string;
  defaultLabel: string;
  defaultIcon: string;
  audience: UiLayoutAudience;
  description: string;
}

export const ARTISAN_ACTION_CATALOG: UiActionCatalogEntry[] = [
  { actionKey: 'open_executive_brief', defaultLabel: 'هلخصهالك 📋', defaultIcon: 'FileText', audience: 'artisan', description: 'شاشة هلخصهالك (المدير المالي والمخزني)' },
  { actionKey: 'nav_unified_materials', defaultLabel: 'منظومة الخامات الموحدة (الذكية)', defaultIcon: 'Sparkles', audience: 'artisan', description: 'دليل الأكواد الموحدة والبحث والاستيراد وإضافة الأصناف الجديدة' },
  { actionKey: 'modal_new_material', defaultLabel: 'إضافة خامة جديدة', defaultIcon: 'PlusCircle', audience: 'artisan', description: 'نافذة إضافة خامة جديدة' },
  { actionKey: 'nav_materials', defaultLabel: 'أرصدة وبطاقات الخامات', defaultIcon: 'Layers', audience: 'artisan', description: 'صفحة الخامات والمخزون' },
  { actionKey: 'nav_calculator', defaultLabel: 'حاسبة تكاليف المنتج الشاملة', defaultIcon: 'Calculator', audience: 'artisan', description: 'حاسبة التكاليف والتسعير' },
  { actionKey: 'modal_inv_products', defaultLabel: 'المنتجات الجاهزة بالمخزن', defaultIcon: 'PackagePlus', audience: 'artisan', description: 'مخزن المنتج النهائي' },
  { actionKey: 'nav_archive', defaultLabel: 'أرشيف المشغولات والتصاميم', defaultIcon: 'FolderArchive', audience: 'artisan', description: 'أرشيف المنتجات' },
  { actionKey: 'nav_catalog', defaultLabel: 'الكتالوج', defaultIcon: 'BookOpen', audience: 'artisan', description: 'كتالوج الورشة وعروض الأسعار' },
  { actionKey: 'open_artisan_store_products', defaultLabel: 'لوحة التحكم بالمتجر', defaultIcon: 'Store', audience: 'artisan', description: 'إدارة المتجر الخاص' },
  { actionKey: 'open_artisan_store_orders', defaultLabel: 'أوردراتي', defaultIcon: 'ShoppingBag', audience: 'artisan', description: 'أوردرات المتجر والسوق' },
  { actionKey: 'nav_marketplace', defaultLabel: 'سوق الشمساوية', defaultIcon: 'ShoppingBag', audience: 'artisan', description: 'سوق الشمساوية المركزي' },
  { actionKey: 'nav_personal_profile', defaultLabel: 'صفحتي الشخصية ومعرضي', defaultIcon: 'User', audience: 'artisan', description: 'الملف الشخصي ومعرض الـ 6 أعمال' },
  { actionKey: 'modal_supplier_invoice', defaultLabel: 'تسجيل فاتورة شراء خامات', defaultIcon: 'PlusCircle', audience: 'artisan', description: 'فاتورة توريد خامات من مورد' },
  { actionKey: 'nav_purchases', defaultLabel: 'سجل المشتريات وتوريد الخامات', defaultIcon: 'Truck', audience: 'artisan', description: 'سجل المشتريات' },
  { actionKey: 'modal_inv_audit', defaultLabel: 'إذن الفحص والجرد والتحويل', defaultIcon: 'ClipboardCheck', audience: 'artisan', description: 'حركة المخزن والتسويات' },
  { actionKey: 'nav_suppliers_market', defaultLabel: 'سوق موردين الشمساوية (شراء الخامات)', defaultIcon: 'ShoppingBag', audience: 'artisan', description: 'سوق الموردين للورش' },
  { actionKey: 'modal_create_supplier', defaultLabel: 'إضافة مورد جديد', defaultIcon: 'UserPlus', audience: 'artisan', description: 'تسجيل مورد جديد' },
  { actionKey: 'nav_suppliers', defaultLabel: 'دليل وكشف حساب الموردين', defaultIcon: 'Truck', audience: 'artisan', description: 'صفحة مورديني' },
  { actionKey: 'modal_inv_materials', defaultLabel: 'أرصدة خامات الورشة', defaultIcon: 'Layers', audience: 'artisan', description: 'مخزن الخامات' },
  { actionKey: 'nav_work_orders_create', defaultLabel: 'أمر تشغيل وتصنيع جديد', defaultIcon: 'PlusCircle', audience: 'artisan', description: 'إنشاء أمر تشغيل' },
  { actionKey: 'nav_work_orders_issue', defaultLabel: 'إذن صرف خامات للتصنيع', defaultIcon: 'Boxes', audience: 'artisan', description: 'صرف خامات لأمر تشغيل' },
  { actionKey: 'nav_work_orders_receive', defaultLabel: 'إذن استلام وتوريد منتج تام', defaultIcon: 'PackageCheck', audience: 'artisan', description: 'استلام منتج تام' },
  { actionKey: 'nav_work_orders', defaultLabel: 'سجل ومتابعة أوامر التشغيل', defaultIcon: 'Hammer', audience: 'artisan', description: 'جميع أوامر التشغيل' },
  { actionKey: 'nav_sales_new', defaultLabel: 'تسجيل بيع / فاتورة جديدة', defaultIcon: 'PlusCircle', audience: 'artisan', description: 'بيع جديد' },
  { actionKey: 'nav_invoices', defaultLabel: 'سجل فواتير المبيعات', defaultIcon: 'Receipt', audience: 'artisan', description: 'الفواتير' },
  { actionKey: 'nav_sales', defaultLabel: 'المدفوعات والمبيعات', defaultIcon: 'Wallet', audience: 'artisan', description: 'شاشة المبيعات' },
  { actionKey: 'nav_invoices_returns', defaultLabel: 'مرتجعات المبيعات', defaultIcon: 'RotateCcw', audience: 'artisan', description: 'مرتجعات الفواتير' },
  { actionKey: 'nav_customers', defaultLabel: 'عملائي وكشف الحساب', defaultIcon: 'Users', audience: 'artisan', description: 'دليل العملاء' },
  { actionKey: 'modal_new_client', defaultLabel: 'إضافة عميل جديد', defaultIcon: 'UserPlus', audience: 'artisan', description: 'تسجيل عميل جديد' },
  { actionKey: 'nav_hr', defaultLabel: 'شؤون العاملين والحرفيين والرواتب', defaultIcon: 'Users2', audience: 'artisan', description: 'الموارد البشرية والأجور' },
  { actionKey: 'modal_new_employee', defaultLabel: 'إضافة موظف / صانع جديد', defaultIcon: 'UserPlus', audience: 'artisan', description: 'تسجيل موظف أو صانع' },
  { actionKey: 'modal_admin_costs', defaultLabel: 'تسجيل وإدارة المصروفات الإدارية', defaultIcon: 'DollarSign', audience: 'artisan', description: 'المصروفات الإدارية والتشغيلية' },
  { actionKey: 'modal_exchange_rates', defaultLabel: 'أسعار الصرف اليومية للعملات', defaultIcon: 'Coins', audience: 'artisan', description: 'أسعار الصرف' },
  { actionKey: 'nav_fixed_assets', defaultLabel: 'الأصول الثابتة وإهلاك المعدات', defaultIcon: 'Building', audience: 'artisan', description: 'الأصول الثابتة والصيانة' },
  { actionKey: 'nav_treasuries', defaultLabel: 'إدارة الخزائن والعُهد والتحويلات', defaultIcon: 'Wallet', audience: 'artisan', description: 'الخزائن والعهد' },
  { actionKey: 'nav_accounts', defaultLabel: 'الدفتر المالي والحسابات والأرباح', defaultIcon: 'Scale', audience: 'artisan', description: 'الحسابات واليوميات' },
  { actionKey: 'nav_reports', defaultLabel: 'التقارير والتحليلات المالية', defaultIcon: 'BarChart3', audience: 'artisan', description: 'التقارير المالية' },
  { actionKey: 'nav_ai_agent', defaultLabel: 'استشارة صقر الشمساوية AI', defaultIcon: 'Sparkles', audience: 'artisan', description: 'المستشار الذكي صقر' },
  { actionKey: 'open_shamousa', defaultLabel: 'محادثة شموسة مديرة الأعمال', defaultIcon: 'Sparkles', audience: 'artisan', description: 'فتح نافذة شموسة العائمة' },
  { actionKey: 'nav_family', defaultLabel: 'مجتمع عيلة الشمساوية', defaultIcon: 'Users', audience: 'artisan', description: 'منتدى وشات العيلة' },
];

export const SUPPLIER_ACTION_CATALOG: UiActionCatalogEntry[] = [
  { actionKey: 'sup_executive_brief', defaultLabel: 'هلخصهالك للموردين 📋', defaultIcon: 'FileText', audience: 'supplier', description: 'ملخص السيولة والفروع والمديونيات والمخزون' },
  { actionKey: 'sup_erp_hub', defaultLabel: 'مركز قيادة الفروع والخزينة (ERP)', defaultIcon: 'GitBranch', audience: 'supplier', description: 'شجرة الفروع والمخزن المركزي والتوريدات' },
  { actionKey: 'sup_pos', defaultLabel: 'كاشير نقاط البيع (POS)', defaultIcon: 'ShoppingCart', audience: 'supplier', description: 'شاشة البيع والكاشير بالكسور' },
  { actionKey: 'sup_warehouse_erp', defaultLabel: 'المخازن وكارت الصنف والمصانع', defaultIcon: 'Warehouse', audience: 'supplier', description: 'جرد بدون صور والتحويلات والمصانع' },
  { actionKey: 'sup_hr_terminal', defaultLabel: 'شؤون العاملين وتثبيت الأجهزة (HR)', defaultIcon: 'MonitorSmartphone', audience: 'supplier', description: 'الموظفين والحضور وتثبيت الشاشات' },
  { actionKey: 'sup_catalog', defaultLabel: 'كتالوج الخامات والمخزون', defaultIcon: 'Boxes', audience: 'supplier', description: 'الكتالوج وشرائح الكميات' },
  { actionKey: 'sup_unified_materials', defaultLabel: 'منظومة الخامات الموحدة', defaultIcon: 'Layers', audience: 'supplier', description: 'دليل الأكواد الموحدة وربط خامات الكتالوج' },
  { actionKey: 'sup_orders', defaultLabel: 'أوردراتي وطلبات التوريد', defaultIcon: 'Package', audience: 'supplier', description: 'طلبات الورش والأونلاين' },
  { actionKey: 'sup_storefront', defaultLabel: 'لوحة تحكم متجر المورد', defaultIcon: 'Store', audience: 'supplier', description: 'إعدادات المتجر والكوبونات وQR' },
  { actionKey: 'sup_customers', defaultLabel: 'عملائي (الورش والأفراد)', defaultIcon: 'Users', audience: 'supplier', description: 'دليل العملاء والمديونيات' },
  { actionKey: 'sup_finance', defaultLabel: 'الخزائن والمصروفات والتدفقات', defaultIcon: 'Wallet', audience: 'supplier', description: 'الخزائن والمصروفات' },
  { actionKey: 'sup_personal_profile', defaultLabel: 'صفحتي الشخصية ومعرض أعمالي', defaultIcon: 'User', audience: 'supplier', description: 'نبذة المورد ومعرض الـ 6 أعمال' },
  { actionKey: 'sup_family', defaultLabel: 'مجتمع عيلة الشمساوية', defaultIcon: 'Users', audience: 'supplier', description: 'منتدى وشات العيلة' },
  { actionKey: 'sup_market', defaultLabel: 'سوق موردين الشمساوية (العام)', defaultIcon: 'ShoppingBag', audience: 'supplier', description: 'تصفح سوق الموردين العام' },
];

export interface UiActionButtonConfig {
  id: string;
  actionKey: string;
  label: string;
  iconKey: string;
  visible: boolean;
  /** optional grouping/filter tag for workforce tabs */
  subGroup?: 'artisans' | 'employees';
}

export interface UiHomeCardConfig {
  id: string;
  label: string;
  subtitle?: string;
  iconKey: string;
  colorPreset: string;
  visible: boolean;
  isCustom?: boolean;
  /** Optional direct action key when card has 0 internal buttons (like executive_brief) or single-click mode */
  directActionKey?: string;
  items: UiActionButtonConfig[];
}

export interface UiNavbarItemConfig {
  id: 'store' | 'family' | 'executive_brief' | 'personal_profile' | 'pwa' | 'notifications' | 'theme';
  label: string;
  visible: boolean;
}

export interface UiSidebarItemConfig {
  id: string;
  label: string;
  iconKey: string;
  visible: boolean;
}

export interface UiSidebarGroupConfig {
  id: string;
  code: string;
  titleAr: string;
  visible: boolean;
  items: UiSidebarItemConfig[];
}

export interface RoleUiLayoutConfig {
  maxProductImages?: number;
  home: {
    columnsDesktop: 3 | 4 | 5;
    columnsMobile: 2 | 3;
    cardShape: UiCardShape;
    iconShape: UiIconShape;
    cards: UiHomeCardConfig[];
  };
  navbar: {
    density: 'comfortable' | 'compact';
    items: UiNavbarItemConfig[];
  };
  sidebar: {
    groups: UiSidebarGroupConfig[];
  };
}

export interface UiGlobalElementOverride {
  key: string;
  elementType: 'button' | 'card';
  originalText: string;
  customLabel?: string;
  hidden?: boolean;
  pageHint?: string;
  updatedAt: string;
}

export function normalizeOverrideText(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildGlobalOverrideKey(elementType: 'button' | 'card', originalText: string): string {
  return `${elementType}::${normalizeOverrideText(originalText)}`;
}

export interface AiAssistantsUiConfig {
  shamousaLauncherName: string;
  shamousaTabChat: string;
  shamousaTabDaily: string;
  shamousaBtnTasks: string;
  shamousaBtnResults: string;
  shamousaBtnOR: string;
  shamousaChatPlaceholder: string;
  shamousaDailyPlaceholder: string;
  shamousaDailyDefaultTime: string;
  shamousaSnoozeFollowupText: string;
  falconTitle: string;
  falconPlaceholder: string;
  falconHandoffBtnLabel: string;
}

export const DEFAULT_AI_ASSISTANTS_UI_CONFIG: AiAssistantsUiConfig = {
  shamousaLauncherName: 'شموسة',
  shamousaTabChat: 'المحادثة الذكية',
  shamousaTabDaily: 'يومي كان ماشي إزاي',
  shamousaBtnTasks: 'مهام',
  shamousaBtnResults: 'نتائج',
  shamousaBtnOR: 'بحوث',
  shamousaChatPlaceholder: 'اكتب لشموسة أي حاجة في شغلك...',
  shamousaDailyPlaceholder: 'احكي لشموسة يومك أو فضفض براحتك...',
  shamousaDailyDefaultTime: '20:00',
  shamousaSnoozeFollowupText: 'عدّى الوقت اللي قولت عليه يا {name} 🌙✨ كنت مستنياك.. ها إيه الأخبار دلوقتي؟ يومك كان ماشي إزاي؟',
  falconTitle: 'صقر الشمساوية',
  falconPlaceholder: 'اكتب استفسارك لصقر... (Enter لسطر جديد)',
  falconHandoffBtnLabel: 'استشر صقر الشمساوية 🦅',
};

export function normalizeAiAssistantsUiConfig(
  raw?: Partial<AiAssistantsUiConfig> | null
): AiAssistantsUiConfig {
  const src = raw || {};
  const str = (val: unknown, fallback: string) =>
    typeof val === 'string' && val.trim() ? val.trim() : fallback;
  const rawTime = typeof src.shamousaDailyDefaultTime === 'string' ? src.shamousaDailyDefaultTime.trim() : '';
  return {
    shamousaLauncherName: str(src.shamousaLauncherName, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaLauncherName),
    shamousaTabChat: str(src.shamousaTabChat, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaTabChat),
    shamousaTabDaily: str(src.shamousaTabDaily, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaTabDaily),
    shamousaBtnTasks: str(src.shamousaBtnTasks, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaBtnTasks),
    shamousaBtnResults: str(src.shamousaBtnResults, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaBtnResults),
    shamousaBtnOR: str(src.shamousaBtnOR, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaBtnOR),
    shamousaChatPlaceholder: str(src.shamousaChatPlaceholder, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaChatPlaceholder),
    shamousaDailyPlaceholder: str(src.shamousaDailyPlaceholder, DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaDailyPlaceholder),
    shamousaDailyDefaultTime: /^\d{2}:\d{2}$/.test(rawTime)
      ? rawTime
      : DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaDailyDefaultTime,
    shamousaSnoozeFollowupText: str(
      src.shamousaSnoozeFollowupText,
      DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaSnoozeFollowupText
    ),
    falconTitle: str(src.falconTitle, DEFAULT_AI_ASSISTANTS_UI_CONFIG.falconTitle),
    falconPlaceholder: str(src.falconPlaceholder, DEFAULT_AI_ASSISTANTS_UI_CONFIG.falconPlaceholder),
    falconHandoffBtnLabel: str(src.falconHandoffBtnLabel, DEFAULT_AI_ASSISTANTS_UI_CONFIG.falconHandoffBtnLabel),
  };
}

export interface PlatformUiLayoutConfig {
  artisan: RoleUiLayoutConfig;
  supplier: RoleUiLayoutConfig;
  globalElementOverrides?: Record<string, UiGlobalElementOverride>;
  experienceModeConfig?: PlatformExperienceModeConfig;
  aiAssistantsConfig?: AiAssistantsUiConfig;
  updatedAt?: string;
}

export const DEFAULT_ARTISAN_UI_LAYOUT: RoleUiLayoutConfig = {
  maxProductImages: 3,
  home: {
    columnsDesktop: 5,
    columnsMobile: 3,
    cardShape: 'classic',
    iconShape: 'rounded',
    cards: [
      {
        id: 'executive_brief',
        label: 'هلخصهالك 📋',
        subtitle: 'خلاصة الفلوس والمخازن بلغة بسيطة',
        iconKey: 'FileText',
        colorPreset: 'orange_strong',
        visible: true,
        directActionKey: 'open_executive_brief',
        items: [],
      },
      {
        id: 'materials',
        label: 'خاماتي',
        subtitle: 'كل خاماتك بتقسيمتها ومنظومة الخامات',
        iconKey: 'Layers',
        colorPreset: 'amber',
        visible: true,
        items: [
          { id: 'mat_list', actionKey: 'nav_materials', label: 'خاماتي (كل الخامات + إضافة جديد)', iconKey: 'Layers', visible: true },
          { id: 'mat_unified', actionKey: 'nav_unified_materials', label: 'منظومة الخامات الموحدة (الذكية)', iconKey: 'Sparkles', visible: true },
          { id: 'mat_prices', actionKey: 'nav_materials', label: 'أسعار الشراء ووحدات القياس', iconKey: 'Tag', visible: true },
          { id: 'mat_alerts', actionKey: 'nav_materials', label: 'المخزن والجرد والتنبيهات', iconKey: 'AlertTriangle', visible: true },
        ],
      },
      {
        id: 'products',
        label: 'المنتجات',
        subtitle: 'الحاسبة والمخزن والأرشيف',
        iconKey: 'ShoppingBag',
        colorPreset: 'orange',
        visible: true,
        items: [
          { id: 'prod_calc', actionKey: 'nav_calculator', label: 'حاسبة تكاليف المنتج الشاملة', iconKey: 'Calculator', visible: true },
          { id: 'prod_inv', actionKey: 'modal_inv_products', label: 'المنتجات الجاهزة بالمخزن', iconKey: 'PackagePlus', visible: true },
          { id: 'prod_arch', actionKey: 'nav_archive', label: 'أرشيف المشغولات والتصاميم', iconKey: 'FolderArchive', visible: true },
        ],
      },
      {
        id: 'my_platform',
        label: 'منصتي 🌐',
        subtitle: 'الكتالوج والمتجر والأوردرات',
        iconKey: 'Store',
        colorPreset: 'amber',
        visible: true,
        items: [
          { id: 'plat_cat', actionKey: 'nav_catalog', label: 'الكتالوج', iconKey: 'BookOpen', visible: true },
          { id: 'plat_store', actionKey: 'open_artisan_store_products', label: 'لوحة التحكم بالمتجر', iconKey: 'Store', visible: true },
          { id: 'plat_orders', actionKey: 'open_artisan_store_orders', label: 'أوردراتي', iconKey: 'ShoppingBag', visible: true },
          { id: 'plat_profile', actionKey: 'nav_personal_profile', label: 'صفحتي الشخصية ومعرضي', iconKey: 'User', visible: true },
        ],
      },
      {
        id: 'purchases',
        label: 'المشتريات',
        subtitle: 'فواتير وتوريد الخامات',
        iconKey: 'PackagePlus',
        colorPreset: 'rose',
        visible: true,
        items: [
          { id: 'pur_new', actionKey: 'modal_supplier_invoice', label: 'تسجيل فاتورة شراء خامات', iconKey: 'PlusCircle', visible: true },
          { id: 'pur_list', actionKey: 'nav_purchases', label: 'سجل المشتريات وتوريد الخامات', iconKey: 'Truck', visible: true },
          { id: 'pur_order', actionKey: 'modal_supplier_invoice', label: 'أمر شراء جديد للمورد', iconKey: 'Receipt', visible: true },
          { id: 'pur_audit', actionKey: 'modal_inv_audit', label: 'إذن استلام وفحص الخامات', iconKey: 'ClipboardCheck', visible: true },
        ],
      },
      {
        id: 'suppliers',
        label: 'الموردين',
        subtitle: 'مورديني وسوق الخامات',
        iconKey: 'Truck',
        colorPreset: 'blue',
        visible: true,
        items: [
          { id: 'sup_mkt', actionKey: 'nav_suppliers_market', label: 'سوق موردين الشمساوية (شراء الخامات)', iconKey: 'ShoppingBag', visible: true },
          { id: 'sup_add', actionKey: 'modal_create_supplier', label: 'إضافة مورد جديد', iconKey: 'UserPlus', visible: true },
          { id: 'sup_dir', actionKey: 'nav_suppliers', label: 'دليل وبيانات الموردين', iconKey: 'Truck', visible: true },
          { id: 'sup_stmt', actionKey: 'nav_suppliers', label: 'كشف حساب ومدفوعات الموردين', iconKey: 'FileText', visible: true },
        ],
      },
      {
        id: 'inventory',
        label: 'المخازن',
        subtitle: 'أرصدة وحركات وجرد',
        iconKey: 'Boxes',
        colorPreset: 'indigo',
        visible: true,
        items: [
          { id: 'inv_mat', actionKey: 'modal_inv_materials', label: 'أرصدة خامات الورشة', iconKey: 'Layers', visible: true },
          { id: 'inv_prod', actionKey: 'modal_inv_products', label: 'مخزن المنتج التام', iconKey: 'ShoppingBag', visible: true },
          { id: 'inv_tr', actionKey: 'modal_inv_audit', label: 'إذن الصرف والاستلام والتحويل', iconKey: 'ArrowLeftRight', visible: true },
          { id: 'inv_log', actionKey: 'modal_inv_audit', label: 'دفتر حركة المخزن والتسويات', iconKey: 'History', visible: true },
        ],
      },
      {
        id: 'work_orders',
        label: 'أوامر التشغيل',
        subtitle: 'بوابة الإنتاج والهالك',
        iconKey: 'Hammer',
        colorPreset: 'cyan',
        visible: true,
        items: [
          { id: 'wo_new', actionKey: 'nav_work_orders_create', label: 'أمر تشغيل وتصنيع جديد', iconKey: 'PlusCircle', visible: true },
          { id: 'wo_issue', actionKey: 'nav_work_orders_issue', label: 'إذن صرف خامات للتصنيع', iconKey: 'Boxes', visible: true },
          { id: 'wo_rec', actionKey: 'nav_work_orders_receive', label: 'إذن استلام وتوريد منتج تام', iconKey: 'PackageCheck', visible: true },
          { id: 'wo_list', actionKey: 'nav_work_orders', label: 'سجل ومتابعة أوامر التشغيل', iconKey: 'Hammer', visible: true },
        ],
      },
      {
        id: 'sales',
        label: 'المبيعات',
        subtitle: 'الفواتير والتحصيل والمرتجع',
        iconKey: 'ShoppingCart',
        colorPreset: 'teal',
        visible: true,
        items: [
          { id: 'sal_new', actionKey: 'nav_sales_new', label: 'تسجيل بيع / فاتورة جديدة', iconKey: 'PlusCircle', visible: true },
          { id: 'sal_inv', actionKey: 'nav_invoices', label: 'سجل فواتير المبيعات', iconKey: 'Receipt', visible: true },
          { id: 'sal_pay', actionKey: 'nav_sales', label: 'المدفوعات (كاش / إنستاباي / آجل)', iconKey: 'Wallet', visible: true },
          { id: 'sal_ret', actionKey: 'nav_invoices_returns', label: 'مرتجعات المبيعات', iconKey: 'RotateCcw', visible: true },
        ],
      },
      {
        id: 'customers',
        label: 'العملاء',
        subtitle: 'دليل العملاء والمستحقات',
        iconKey: 'Users',
        colorPreset: 'emerald',
        visible: true,
        items: [
          { id: 'cus_list', actionKey: 'nav_customers', label: 'عملائي', iconKey: 'Users', visible: true },
          { id: 'cus_add', actionKey: 'modal_new_client', label: 'إضافة عميل جديد', iconKey: 'UserPlus', visible: true },
          { id: 'cus_stmt', actionKey: 'nav_sales', label: 'كشف حساب العملاء والمستحقات', iconKey: 'FileText', visible: true },
        ],
      },
      {
        id: 'workforce',
        label: 'فريق العمل والحرفيين',
        subtitle: 'الصناع بالقطعة والموظفون',
        iconKey: 'Users2',
        colorPreset: 'violet',
        visible: true,
        items: [
          { id: 'wf_art_list', actionKey: 'nav_hr', label: 'سجل صناع الورشة وتخصصاتهم', iconKey: 'Users', visible: true, subGroup: 'artisans' },
          { id: 'wf_art_piece', actionKey: 'nav_hr', label: 'حساب أجر القطعة ومستحقات الإنتاج', iconKey: 'Award', visible: true, subGroup: 'artisans' },
          { id: 'wf_art_pay', actionKey: 'nav_hr', label: 'تسوية وصرف مستحقات حرفي', iconKey: 'Wallet', visible: true, subGroup: 'artisans' },
          { id: 'wf_art_wo', actionKey: 'nav_work_orders', label: 'تكليف ومتابعة إنجاز المشغولات', iconKey: 'Hammer', visible: true, subGroup: 'artisans' },
          { id: 'wf_emp_add', actionKey: 'modal_new_employee', label: 'إضافة موظف / صانع جديد', iconKey: 'UserPlus', visible: true, subGroup: 'employees' },
          { id: 'wf_emp_sal', actionKey: 'nav_hr', label: 'مسير الرواتب والأجور الشهرية', iconKey: 'Wallet', visible: true, subGroup: 'employees' },
          { id: 'wf_emp_adv', actionKey: 'nav_hr', label: 'السلف والدفعات النقدية المقدمة', iconKey: 'DollarSign', visible: true, subGroup: 'employees' },
          { id: 'wf_emp_att', actionKey: 'nav_hr', label: 'سجل الحضور والانضباط', iconKey: 'ClipboardCheck', visible: true, subGroup: 'employees' },
        ],
      },
      {
        id: 'expenses',
        label: 'المصروفات',
        subtitle: 'الإيجار والكهرباء والأصول',
        iconKey: 'DollarSign',
        colorPreset: 'red',
        visible: true,
        items: [
          { id: 'exp_add', actionKey: 'modal_admin_costs', label: 'تسجيل مصروف مع تحديد مصدر الصرف', iconKey: 'PlusCircle', visible: true },
          { id: 'exp_rent', actionKey: 'modal_admin_costs', label: 'بنود المصروفات والإيجار والفواتير', iconKey: 'DollarSign', visible: true },
          { id: 'exp_fx', actionKey: 'modal_exchange_rates', label: 'أسعار الصرف اليومية للعملات', iconKey: 'Coins', visible: true },
          { id: 'exp_ast', actionKey: 'nav_fixed_assets', label: 'الأصول الثابتة وإهلاك المعدات', iconKey: 'Building', visible: true },
          { id: 'exp_rep', actionKey: 'nav_reports', label: 'تحليل وتوزيع المصروفات', iconKey: 'BarChart3', visible: true },
        ],
      },
      {
        id: 'treasuries',
        label: 'الخزائن والعهد',
        subtitle: 'كاش وإنستاباي ومحافظ',
        iconKey: 'Wallet',
        colorPreset: 'lime',
        visible: true,
        items: [
          { id: 'tr_cash', actionKey: 'nav_treasuries', label: 'الخزينة النقدية الرئيسية (الكاش)', iconKey: 'Wallet', visible: true },
          { id: 'tr_bank', actionKey: 'nav_treasuries', label: 'إنستاباي والبنك والمحافظ الإلكترونية', iconKey: 'Coins', visible: true },
          { id: 'tr_custody', actionKey: 'nav_treasuries', label: 'إدارة العهد المالية المغلقة ومتابعة تسويتها', iconKey: 'Lock', visible: true },
          { id: 'tr_move', actionKey: 'nav_treasuries', label: 'تحويل نقدي بين الخزائن والعهد', iconKey: 'ArrowLeftRight', visible: true },
        ],
      },
      {
        id: 'accounts',
        label: 'الحسابات',
        subtitle: 'اليومية والأرباح والالتزامات',
        iconKey: 'Scale',
        colorPreset: 'sky',
        visible: true,
        items: [
          { id: 'acc_jrn', actionKey: 'nav_accounts', label: 'دفتر اليومية وسجل الحركات الحية', iconKey: 'Receipt', visible: true },
          { id: 'acc_pnl', actionKey: 'nav_accounts', label: 'صافي الأرباح والخسائر للورشة', iconKey: 'TrendingUp', visible: true },
          { id: 'acc_due', actionKey: 'nav_accounts', label: 'كشف مستحقات الورشة والالتزامات', iconKey: 'Scale', visible: true },
        ],
      },
      {
        id: 'reports',
        label: 'التقارير',
        subtitle: 'تحليلات المبيعات والسيولة',
        iconKey: 'BarChart3',
        colorPreset: 'purple',
        visible: true,
        items: [
          { id: 'rep_sal', actionKey: 'nav_reports', label: 'تقارير المبيعات والأرباح', iconKey: 'BarChart3', visible: true },
          { id: 'rep_inv', actionKey: 'nav_reports', label: 'تقرير المخزون وحركة الخامات', iconKey: 'TrendingUp', visible: true },
          { id: 'rep_liq', actionKey: 'nav_reports', label: 'تقرير السيولة الحية والتدفقات النقدية', iconKey: 'Lock', visible: true },
        ],
      },
      {
        id: 'ai_helpers',
        label: 'مساعدو الشمساوية',
        subtitle: 'صقر وشموسة AI',
        iconKey: 'Sparkles',
        colorPreset: 'amber',
        visible: true,
        items: [
          { id: 'ai_falcon', actionKey: 'nav_ai_agent', label: 'استشارة صقر الشمساوية AI', iconKey: 'Sparkles', visible: true },
          { id: 'ai_shamousa', actionKey: 'open_shamousa', label: 'محادثة شموسة مديرة الأعمال', iconKey: 'Sparkles', visible: true },
        ],
      },
    ],
  },
  navbar: {
    density: 'comfortable',
    items: [
      { id: 'store', label: 'متجري', visible: true },
      { id: 'family', label: 'العيلة', visible: true },
      { id: 'executive_brief', label: 'هلخصهالك', visible: false },
      { id: 'personal_profile', label: 'صفحتي', visible: false },
      { id: 'pwa', label: 'تثبيت التطبيق', visible: true },
      { id: 'notifications', label: 'الإشعارات', visible: true },
      { id: 'theme', label: 'تبديل الثيم', visible: true },
    ],
  },
  sidebar: {
    groups: [
      {
        id: 'erp',
        code: 'ERP',
        titleAr: 'الإنتاج والمخازن',
        visible: true,
        items: [
          { id: 'calculator', label: 'حاسبة التكاليف والتسعير', iconKey: 'Calculator', visible: true },
          { id: 'work_orders', label: 'أوامر الشغل والتصنيع', iconKey: 'Hammer', visible: true },
          { id: 'materials', label: 'الخامات والمخزون', iconKey: 'Boxes', visible: true },
          { id: 'unified_materials', label: 'منظومة الخامات الموحدة', iconKey: 'Layers', visible: true },
          { id: 'purchases', label: 'فواتير المشتريات', iconKey: 'Receipt', visible: true },
          { id: 'suppliers', label: 'مورديني', iconKey: 'Truck', visible: true },
          { id: 'suppliers_market', label: 'سوق موردين الشمساوية', iconKey: 'ShoppingBag', visible: true },
          { id: 'archive', label: 'أرشيف المنتجات', iconKey: 'FolderArchive', visible: true },
        ],
      },
      {
        id: 'crm',
        code: 'CRM',
        titleAr: 'العملاء والمتجر والسوق',
        visible: true,
        items: [
          { id: 'catalog', label: 'منصتي والكتالوج', iconKey: 'Globe', visible: true },
          { id: 'store', label: 'لوحة التحكم بالمتجر', iconKey: 'Store', visible: true },
          { id: 'my_orders', label: 'أوردراتي', iconKey: 'Package', visible: true },
          { id: 'marketplace', label: 'سوق الشمساوية', iconKey: 'ShoppingBag', visible: true },
          { id: 'sales', label: 'تسجيل مبيعات الورشة', iconKey: 'ShoppingCart', visible: true },
          { id: 'invoices', label: 'الفواتير وعروض الأسعار', iconKey: 'FileText', visible: true },
          { id: 'customers', label: 'عملائي', iconKey: 'Users', visible: true },
        ],
      },
      {
        id: 'fca',
        code: 'FCA',
        titleAr: 'المالية والحسابات',
        visible: true,
        items: [
          { id: 'executive_brief', label: 'هلخصهالك (الملخص البسيط)', iconKey: 'FileText', visible: true },
          { id: 'treasuries', label: 'الخزينة والأرصدة', iconKey: 'Wallet', visible: true },
          { id: 'accounts', label: 'الدفتر المالي والحسابات', iconKey: 'Scale', visible: true },
          { id: 'expenses', label: 'المصروفات الإدارية', iconKey: 'Coins', visible: true },
          { id: 'fixed_assets', label: 'الأصول الثابتة', iconKey: 'Building', visible: true },
          { id: 'reports', label: 'التقارير المالية', iconKey: 'BarChart3', visible: true },
          { id: 'currency_rates', label: 'أسعار الصرف', iconKey: 'ArrowLeftRight', visible: true },
        ],
      },
      {
        id: 'hr',
        code: 'HR',
        titleAr: 'العاملون والحرفيون',
        visible: true,
        items: [{ id: 'hr', label: 'شؤون العاملين والأجور', iconKey: 'Users2', visible: true }],
      },
    ],
  },
};

export const DEFAULT_SUPPLIER_UI_LAYOUT: RoleUiLayoutConfig = {
  maxProductImages: 3,
  home: {
    columnsDesktop: 3,
    columnsMobile: 2,
    cardShape: 'wide',
    iconShape: 'rounded',
    cards: [
      {
        id: 'supplier_executive_brief',
        label: 'هلخصهالك للموردين 📋',
        subtitle: 'خلاصة خزينتك والفروع والمديونيات والمخزون بلغة واضحة بدون تعقيدات',
        iconKey: 'FileText',
        colorPreset: 'orange_strong',
        visible: true,
        directActionKey: 'sup_executive_brief',
        items: [],
      },
      {
        id: 'erp_hub',
        label: 'مركز قيادة الفروع والخزينة (ERP)',
        subtitle: 'شجرة الفروع والمخزن المركزي، الموافقات المالية، واستلام توريدات الفروع',
        iconKey: 'GitBranch',
        colorPreset: 'orange_strong',
        visible: true,
        directActionKey: 'sup_erp_hub',
        items: [],
      },
      {
        id: 'pos_cashier',
        label: 'كاشير نقاط البيع (POS)',
        subtitle: 'بيع بالوزن أو الوحدة بالكسور، عميل فرع أو أونلاين، وكاش أو إنستاباي أو آجل',
        iconKey: 'ShoppingCart',
        colorPreset: 'emerald',
        visible: true,
        directActionKey: 'sup_pos',
        items: [],
      },
      {
        id: 'warehouse_erp',
        label: 'المخازن وكارت الصنف والمصانع',
        subtitle: 'جرد بدون صور، تحويل وحدة (طرد ← كيلو)، كارت الصنف، ومستحقات المصانع',
        iconKey: 'Warehouse',
        colorPreset: 'sky',
        visible: true,
        directActionKey: 'sup_warehouse_erp',
        items: [],
      },
      {
        id: 'hr_terminal',
        label: 'شؤون العاملين وتثبيت الأجهزة (HR)',
        subtitle: 'حسابات الموظفين، الحضور والجزاءات والسلف، وتثبيت الشاشات على أجهزة الفروع',
        iconKey: 'MonitorSmartphone',
        colorPreset: 'amber',
        visible: true,
        directActionKey: 'sup_hr_terminal',
        items: [],
      },
      {
        id: 'catalog',
        label: 'كتالوج الخامات والمخزون',
        subtitle: 'إضافة الخامات، أسعار الجملة والقطاعي، الألوان والسمك، والمخزون',
        iconKey: 'Boxes',
        colorPreset: 'amber',
        visible: true,
        directActionKey: 'sup_catalog',
        items: [],
      },
      {
        id: 'supplier_unified_materials',
        label: 'منظومة الخامات الموحدة',
        subtitle: 'استعراض الأكواد الرباعية، استيراد وربط الخامات، وإضافة أصناف جديدة',
        iconKey: 'Layers',
        colorPreset: 'orange_strong',
        visible: true,
        directActionKey: 'sup_unified_materials',
        items: [],
      },
      {
        id: 'orders',
        label: 'أوردراتي وطلبات التوريد',
        subtitle: 'فلترة متجري / موردين الشمساوية / خارج المنظومة + تسجيل أوردر يدوي',
        iconKey: 'Package',
        colorPreset: 'sky',
        visible: true,
        directActionKey: 'sup_orders',
        items: [],
      },
      {
        id: 'storefront',
        label: 'لوحة تحكم متجر المورد',
        subtitle: 'المظهر، رابط المتجر، رمز QR، كوبونات الخصم، وإعدادات الواتساب',
        iconKey: 'Store',
        colorPreset: 'emerald',
        visible: true,
        directActionKey: 'sup_storefront',
        items: [],
      },
      {
        id: 'customers',
        label: 'عملائي (الورش والأفراد)',
        subtitle: 'دليل العملاء الكامل مع الفلتر والبحث بالاسم أو الهاتف أو المحافظة',
        iconKey: 'Users',
        colorPreset: 'indigo',
        visible: true,
        directActionKey: 'sup_customers',
        items: [],
      },
      {
        id: 'finance',
        label: 'الخزائن والمصروفات والتدفقات',
        subtitle: 'متابعة أرصدة الخزائن، الإيداعات، والمصروفات التشغيلية للمخزن',
        iconKey: 'Wallet',
        colorPreset: 'amber',
        visible: true,
        directActionKey: 'sup_finance',
        items: [],
      },
      {
        id: 'personal_profile',
        label: 'صفحتي الشخصية ومعرض أعمالي',
        subtitle: 'صورتك الشخصية، قصتك، أذونات الظهور، و٦ منشورات لأعمالك المميزة',
        iconKey: 'User',
        colorPreset: 'orange',
        visible: true,
        directActionKey: 'sup_personal_profile',
        items: [],
      },
      {
        id: 'family',
        label: 'مجتمع عيلة الشمساوية',
        subtitle: 'شارك في طبلية العيلة مع الفنانين، انشر عروضك، واستقبل رسائل الورش',
        iconKey: 'Users',
        colorPreset: 'rose',
        visible: true,
        directActionKey: 'sup_family',
        items: [],
      },
    ],
  },
  navbar: {
    density: 'comfortable',
    items: [
      { id: 'store', label: 'متجري', visible: true },
      { id: 'family', label: 'العيلة', visible: true },
      { id: 'executive_brief', label: 'هلخصهالك', visible: false },
      { id: 'personal_profile', label: 'صفحتي', visible: false },
      { id: 'pwa', label: 'تثبيت التطبيق', visible: true },
      { id: 'notifications', label: 'الإشعارات', visible: true },
      { id: 'theme', label: 'تبديل الثيم', visible: true },
    ],
  },
  sidebar: {
    groups: [
      {
        id: 'hr',
        code: 'POS',
        titleAr: 'الفروع والكاشير والمخازن (ERP)',
        visible: true,
        items: [
          { id: 'supplier_executive_brief', label: 'هلخصهالك للموردين', iconKey: 'FileText', visible: true },
          { id: 'supplier_erp_hub', label: 'مركز قيادة الفروع والخزينة', iconKey: 'GitBranch', visible: true },
          { id: 'supplier_pos', label: 'كاشير نقاط البيع (POS)', iconKey: 'ShoppingCart', visible: true },
          { id: 'supplier_warehouse_erp', label: 'المخازن وكارت الصنف والمصانع', iconKey: 'Warehouse', visible: true },
          { id: 'supplier_hr_terminal', label: 'شؤون العاملين وتثبيت الأجهزة', iconKey: 'MonitorSmartphone', visible: true },
        ],
      },
      {
        id: 'erp',
        code: 'B2B',
        titleAr: 'كتالوج الخامات والمخزون',
        visible: true,
        items: [
          { id: 'supplier_catalog', label: 'كتالوج الخامات والأسعار', iconKey: 'Boxes', visible: true },
          { id: 'unified_materials', label: 'منظومة الخامات الموحدة', iconKey: 'Layers', visible: true },
          { id: 'supplier_orders', label: 'أوردراتي وطلبات التوريد', iconKey: 'Package', visible: true },
        ],
      },
      {
        id: 'crm',
        code: 'CRM',
        titleAr: 'المتجر والعملاء والسوق',
        visible: true,
        items: [
          { id: 'supplier_store', label: 'لوحة تحكم متجر المورد', iconKey: 'Store', visible: true },
          { id: 'suppliers_market', label: 'موردين الشمساوية (السوق العام)', iconKey: 'ShoppingBag', visible: true },
          { id: 'supplier_customers', label: 'عملائي (الورش والأفراد)', iconKey: 'Users', visible: true },
        ],
      },
      {
        id: 'fca',
        code: 'FCA',
        titleAr: 'الخزينة والمصروفات',
        visible: true,
        items: [
          { id: 'supplier_finance', label: 'الخزائن والمصروفات والتدفقات', iconKey: 'Wallet', visible: true },
        ],
      },
    ],
  },
};

export const DEFAULT_PLATFORM_UI_LAYOUT: PlatformUiLayoutConfig = {
  artisan: DEFAULT_ARTISAN_UI_LAYOUT,
  supplier: DEFAULT_SUPPLIER_UI_LAYOUT,
};

function mergeRoleLayout(raw: Partial<RoleUiLayoutConfig> | undefined, fallback: RoleUiLayoutConfig): RoleUiLayoutConfig {
  const safeCards: UiHomeCardConfig[] =
    Array.isArray(raw?.home?.cards) && raw!.home!.cards.length > 0
      ? raw!.home!.cards.map((c) => ({
          id: String(c.id || `card_${Date.now()}`),
          label: String(c.label || 'بطاقة'),
          subtitle: c.subtitle ? String(c.subtitle) : undefined,
          iconKey: String(c.iconKey || 'Sparkles'),
          colorPreset: String(c.colorPreset || 'amber'),
          visible: typeof c.visible === 'boolean' ? c.visible : true,
          isCustom: Boolean(c.isCustom),
          directActionKey: c.directActionKey ? String(c.directActionKey) : undefined,
          items: Array.isArray(c.items)
            ? c.items.map((it) => ({
                id: String(it.id || `btn_${Date.now()}`),
                actionKey: String(it.actionKey || ''),
                label: String(it.label || 'زر'),
                iconKey: String(it.iconKey || 'Sparkles'),
                visible: typeof it.visible === 'boolean' ? it.visible : true,
                subGroup: it.subGroup,
              }))
            : [],
        }))
      : fallback.home.cards.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i })) }));

  // Forward-compat: inject brand-new default cards AND brand-new default items inside existing cards
  const existingCardIds = new Set(safeCards.map((c) => c.id));
  for (const defCard of fallback.home.cards) {
    if (!existingCardIds.has(defCard.id)) {
      safeCards.unshift({ ...defCard, items: defCard.items.map((i) => ({ ...i })) });
    } else if (Array.isArray(defCard.items) && defCard.items.length > 0) {
      const targetCard = safeCards.find((c) => c.id === defCard.id);
      if (targetCard) {
        const existingItemIds = new Set(targetCard.items.map((it) => it.id));
        const missingItems = defCard.items
          .filter((it) => !existingItemIds.has(it.id))
          .map((it) => ({ ...it }));
        if (missingItems.length > 0) {
          targetCard.items = [...missingItems, ...targetCard.items];
        }
      }
    }
  }

  const rawNavItems = Array.isArray(raw?.navbar?.items) && raw!.navbar!.items.length > 0 ? raw!.navbar!.items : fallback.navbar.items;
  const navMap = new Set(rawNavItems.map((n) => n.id));
  const safeNavItems: UiNavbarItemConfig[] = [
    ...rawNavItems.map((n) => ({
      id: n.id,
      label: String(n.label || n.id),
      visible: typeof n.visible === 'boolean' ? n.visible : true,
    })),
    ...fallback.navbar.items.filter((d) => !navMap.has(d.id)),
  ];

  const safeGroups: UiSidebarGroupConfig[] =
    Array.isArray(raw?.sidebar?.groups) && raw!.sidebar!.groups.length > 0
      ? raw!.sidebar!.groups.map((g) => ({
          id: String(g.id),
          code: String(g.code || 'SEC'),
          titleAr: String(g.titleAr || 'قسم'),
          visible: typeof g.visible === 'boolean' ? g.visible : true,
          items: Array.isArray(g.items)
            ? g.items.map((it) => ({
                id: String(it.id),
                label: String(it.label),
                iconKey: String(it.iconKey || 'Sparkles'),
                visible: typeof it.visible === 'boolean' ? it.visible : true,
              }))
            : [],
        }))
      : fallback.sidebar.groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) }));

  // Ensure any brand-new default sidebar items appear if missing across ALL groups
  const allPresentSidebarIds = new Set(safeGroups.flatMap((g) => g.items.map((i) => i.id)));
  for (const defGrp of fallback.sidebar.groups) {
    const targetGroup = safeGroups.find((g) => g.id === defGrp.id) || safeGroups[0];
    if (!targetGroup) continue;
    for (const defItem of defGrp.items) {
      if (!allPresentSidebarIds.has(defItem.id)) {
        targetGroup.items.unshift({ ...defItem });
        allPresentSidebarIds.add(defItem.id);
      }
    }
  }

  const colsD = raw?.home?.columnsDesktop;
  const colsM = raw?.home?.columnsMobile;

  const rawMaxImg = Number(raw?.maxProductImages);
  const maxProductImages =
    Number.isFinite(rawMaxImg) && rawMaxImg >= 1 && rawMaxImg <= 8
      ? Math.round(rawMaxImg)
      : fallback.maxProductImages || 3;

  return {
    maxProductImages,
    home: {
      columnsDesktop: colsD === 3 || colsD === 4 || colsD === 5 ? colsD : fallback.home.columnsDesktop,
      columnsMobile: colsM === 2 || colsM === 3 ? colsM : fallback.home.columnsMobile,
      cardShape:
        raw?.home?.cardShape === 'classic' || raw?.home?.cardShape === 'wide' || raw?.home?.cardShape === 'compact'
          ? raw.home.cardShape
          : fallback.home.cardShape,
      iconShape:
        raw?.home?.iconShape === 'rounded' || raw?.home?.iconShape === 'circle'
          ? raw.home.iconShape
          : fallback.home.iconShape,
      cards: safeCards,
    },
    navbar: {
      density: raw?.navbar?.density === 'compact' ? 'compact' : 'comfortable',
      items: safeNavItems,
    },
    sidebar: {
      groups: safeGroups,
    },
  };
}

export function normalizeUiLayoutConfig(raw?: Partial<PlatformUiLayoutConfig> | null): PlatformUiLayoutConfig {
  const safeOverrides: Record<string, UiGlobalElementOverride> = {};
  if (raw?.globalElementOverrides && typeof raw.globalElementOverrides === 'object') {
    for (const [k, v] of Object.entries(raw.globalElementOverrides)) {
      if (!v || typeof v !== 'object') continue;
      const elementType: 'button' | 'card' = v.elementType === 'card' ? 'card' : 'button';
      const originalText = normalizeOverrideText(v.originalText || '');
      if (!originalText) continue;
      const key = buildGlobalOverrideKey(elementType, originalText);
      const customLabel = typeof v.customLabel === 'string' ? v.customLabel.trim() : undefined;
      const hidden = Boolean(v.hidden);
      if (!customLabel && !hidden) continue;
      safeOverrides[key || k] = {
        key: key || k,
        elementType,
        originalText,
        ...(customLabel ? { customLabel } : {}),
        ...(hidden ? { hidden: true } : {}),
        ...(v.pageHint ? { pageHint: String(v.pageHint).slice(0, 80) } : {}),
        updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : new Date().toISOString(),
      };
    }
  }

  return {
    artisan: mergeRoleLayout(raw?.artisan, DEFAULT_ARTISAN_UI_LAYOUT),
    supplier: mergeRoleLayout(raw?.supplier, DEFAULT_SUPPLIER_UI_LAYOUT),
    globalElementOverrides: safeOverrides,
    ...(raw?.experienceModeConfig ? { experienceModeConfig: raw.experienceModeConfig } : {}),
    aiAssistantsConfig: normalizeAiAssistantsUiConfig(raw?.aiAssistantsConfig),
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

const UI_LAYOUT_STORAGE_KEY = 'alshams_ui_layout_config';
export const UI_LAYOUT_UPDATED_EVENT = 'alshams_ui_layout_updated';

let inMemoryUiLayout: PlatformUiLayoutConfig | null = null;

export function getStoredUiLayoutConfig(): PlatformUiLayoutConfig {
  if (typeof window === 'undefined') {
    return inMemoryUiLayout || DEFAULT_PLATFORM_UI_LAYOUT;
  }
  try {
    const raw = localStorage.getItem(UI_LAYOUT_STORAGE_KEY);
    if (raw) {
      const normalized = normalizeUiLayoutConfig(JSON.parse(raw));
      if (
        inMemoryUiLayout?.updatedAt &&
        normalized.updatedAt &&
        new Date(inMemoryUiLayout.updatedAt).getTime() > new Date(normalized.updatedAt).getTime()
      ) {
        return inMemoryUiLayout;
      }
      inMemoryUiLayout = normalized;
      return normalized;
    }
  } catch {}
  return inMemoryUiLayout || DEFAULT_PLATFORM_UI_LAYOUT;
}

export function saveStoredUiLayoutConfig(cfg: Partial<PlatformUiLayoutConfig>): PlatformUiLayoutConfig {
  const normalized = normalizeUiLayoutConfig({
    ...cfg,
    updatedAt: cfg.updatedAt || new Date().toISOString(),
  });
  inMemoryUiLayout = normalized;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(UI_LAYOUT_UPDATED_EVENT, { detail: normalized }));
    } catch {}
  }
  return normalized;
}

export function useUiLayoutConfig(): PlatformUiLayoutConfig {
  const [layout, setLayout] = useState<PlatformUiLayoutConfig>(() => getStoredUiLayoutConfig());

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const custom = e as CustomEvent<PlatformUiLayoutConfig>;
      if (custom?.detail) {
        setLayout(normalizeUiLayoutConfig(custom.detail));
      } else {
        setLayout(getStoredUiLayoutConfig());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === UI_LAYOUT_STORAGE_KEY) {
        setLayout(getStoredUiLayoutConfig());
      }
    };
    window.addEventListener(UI_LAYOUT_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(UI_LAYOUT_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return layout;
}
