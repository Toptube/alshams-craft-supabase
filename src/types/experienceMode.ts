import { useCallback, useEffect, useState } from 'react';
import {
  getStoredUiLayoutConfig,
  UI_LAYOUT_UPDATED_EVENT,
  useUiLayoutConfig,
} from './uiLayoutConfig';

export type UserExperienceMode = 'craft' | 'accounting';
export type ExperienceAudience = 'artisan' | 'supplier';
export type ModeItemAudience = 'artisan' | 'supplier' | 'both';
export type ModeItemCategory =
  | 'vouchers'
  | 'accounting'
  | 'reports'
  | 'operations'
  | 'navigation';

export interface ModeTermMappingItem {
  id: string;
  audience: ModeItemAudience;
  category: ModeItemCategory;
  craftLabel: string;
  accountingLabel: string;
  visibleInCraft: boolean;
  visibleInAccounting: boolean;
  description: string;
  viewKey?: string;
  isCustom?: boolean;
}

export interface PlatformExperienceModeConfig {
  defaultArtisanMode: UserExperienceMode;
  defaultSupplierMode: UserExperienceMode;
  allowUserModeSwitch: boolean;
  items: Record<string, ModeTermMappingItem>;
  updatedAt?: string;
}

export const EXPERIENCE_MODE_CATEGORY_LABELS: Record<ModeItemCategory, string> = {
  vouchers: 'الأذونات والتصنيع والمخازن',
  accounting: 'الدائن والمدين والخزينة',
  reports: 'التقارير والرسوم البيانية',
  operations: 'العمليات اليومية والفروع',
  navigation: 'البطاقات والقوائم الرئيسية',
};

export const DEFAULT_EXPERIENCE_MODE_ITEMS: ModeTermMappingItem[] = [
  // ==================== 1. أذونات التصنيع والتشغيل (للفنانين) ====================
  {
    id: 'wo_page_title',
    audience: 'artisan',
    category: 'vouchers',
    craftLabel: 'شغل الورشة والإنتاج',
    accountingLabel: 'أوامر التشغيل والأذونات (WIP)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'العنوان الرئيسي لشاشة تصنيع القطع وأوامر التشغيل',
    viewKey: 'work_orders',
  },
  {
    id: 'wo_create_btn',
    audience: 'artisan',
    category: 'vouchers',
    craftLabel: 'طلب شغل جديد',
    accountingLabel: 'إنشاء أمر تشغيل جديد',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'زر فتح طلب تصنيع جديد للورشة',
    viewKey: 'work_orders',
  },
  {
    id: 'wo_issue_voucher',
    audience: 'artisan',
    category: 'vouchers',
    craftLabel: 'سحبت الخامات وبدأت شغل',
    accountingLabel: 'إذن صرف خامات للتصنيع (WIP)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'خصم الخامات من المخزن عند بدء الشغل في القطع',
    viewKey: 'work_orders',
  },
  {
    id: 'wo_receive_voucher',
    audience: 'artisan',
    category: 'vouchers',
    craftLabel: 'القطع خلصت — رجّع الباقي وقفّل الشغل',
    accountingLabel: 'إذن استلام وتوريد منتج تام',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'تقفيل الشغل، إرجاع بواقي الخامات للمخزن، وإضافة القطع الجاهزة للبيع',
    viewKey: 'work_orders',
  },
  {
    id: 'wo_return_leftover',
    audience: 'artisan',
    category: 'vouchers',
    craftLabel: 'بواقي خامات سليمة هترجع المخزن',
    accountingLabel: 'مرتجعات خامات سليمة للمخزن (إذن ارتجاع)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'إرجاع الكمية المتبقية من الخامة لمخزن الخامات وحساب التكلفة على المستهلك الفعلي فقط',
    viewKey: 'work_orders',
  },
  {
    id: 'wo_scrap_analysis',
    audience: 'artisan',
    category: 'vouchers',
    craftLabel: 'حساب الهالك والقصاقيص',
    accountingLabel: 'تحليل الهالك المحسوب وتكلفة الوحدة القياسية',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'عرض تفاصيل نسب الهالك المحاسبية وتكلفة التشغيل القياسية',
    viewKey: 'work_orders',
  },
  {
    id: 'inv_audit_voucher',
    audience: 'artisan',
    category: 'vouchers',
    craftLabel: 'جرد وتعديل رصيد المخزن',
    accountingLabel: 'إذن الفحص والجرد والتحويل المخزني',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'مراجعة أرصدة الخامات وتعديل العجز أو الزيادة',
    viewKey: 'inventory',
  },

  // ==================== 2. الدائن والمدين والخزينة (للفنانين) ====================
  {
    id: 'fin_treasury_title',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'درج الورشة والفلوس',
    accountingLabel: 'إدارة الخزائن والعُهد النقدية',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'العنوان الرئيسي لشاشة الخزنة والسيولة النقدية',
    viewKey: 'treasuries',
  },
  {
    id: 'fin_debit',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'فلوس داخلة (+)',
    accountingLabel: 'إجمالي الوارد (مدين +)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'المبالغ الواردة للخزنة أو المبيعات المحصّلة',
    viewKey: 'treasuries',
  },
  {
    id: 'fin_credit',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'فلوس خارجة (-)',
    accountingLabel: 'إجمالي الصادر (دائن -)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'المبالغ المنصرفة للمشتريات والمصاريف والأجور',
    viewKey: 'treasuries',
  },
  {
    id: 'fin_receivables',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'فلوس ليك بره (عند العملاء)',
    accountingLabel: 'أرصدة العملاء المدينة (ذمم مدينة)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'المبالغ الآجلة المستحقة للورشة عند العملاء',
    viewKey: 'reports',
  },
  {
    id: 'fin_payables',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'فلوس عليك بره (للموردين)',
    accountingLabel: 'أرصدة الموردين الدائنة (ذمم دائنة)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'المبالغ المتبقية لموردي الخامات',
    viewKey: 'reports',
  },
  {
    id: 'fin_cash_balance',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'اللي في درجك ومحفظتك دلوقتي',
    accountingLabel: 'الرصيد الدفتري الإجمالي للخزائن',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'إجمالي السيولة النقدية المتاحة حالياً',
    viewKey: 'treasuries',
  },
  {
    id: 'fin_custody',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'فلوس مع الصنايعية (عُهد)',
    accountingLabel: 'العُهد النقدية المفتوحة وتسويتها',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'إصدار وتسوية العهد النقدية الفرعية للصنايعية والمشترين',
    viewKey: 'treasuries',
  },
  {
    id: 'fin_sub_treasuries',
    audience: 'artisan',
    category: 'accounting',
    craftLabel: 'شجرة الخزن الفرعية',
    accountingLabel: 'هيكل الخزائن الرئيسية والفرعية الشجري',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'إنشاء وإدارة خزائن فرعية متعددة تحت الخزينة الرئيسية',
    viewKey: 'treasuries',
  },

  // ==================== 3. التقارير والرسوم البيانية (للفنانين) ====================
  {
    id: 'rep_page_title',
    audience: 'artisan',
    category: 'reports',
    craftLabel: 'خلاصة شغلك ومكسبك',
    accountingLabel: 'التقارير المالية وميزان المراجعة المحاسبي',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'العنوان الرئيسي لصفحة التقارير والتحليلات',
    viewKey: 'reports',
  },
  {
    id: 'rep_craft_summary',
    audience: 'artisan',
    category: 'reports',
    craftLabel: 'خلاصة شغلك (بالبلدي + 3 رسوم)',
    accountingLabel: 'الملخص التنفيذي السريع',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'جملة خلاصة واضحة قبل كل رسم بياني مع أهم 3 مؤشرات للورشة',
    viewKey: 'reports',
  },
  {
    id: 'rep_trial_balance',
    audience: 'artisan',
    category: 'reports',
    craftLabel: 'ميزان الحسابات',
    accountingLabel: 'ميزان المراجعة المحاسبي (مدين / دائن)',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'جدول ميزان المراجعة الكامل بالأرصدة المدينة والدائنة',
    viewKey: 'reports',
  },
  {
    id: 'rep_financial_statements',
    audience: 'artisan',
    category: 'reports',
    craftLabel: 'مكسبك ومصاريفك',
    accountingLabel: 'قائمة الدخل والمركز المالي',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'تفاصيل الإيرادات والمصروفات وصافي الربح',
    viewKey: 'reports',
  },
  {
    id: 'rep_sales_audit',
    audience: 'artisan',
    category: 'reports',
    craftLabel: 'مراجعة فواتير البيع',
    accountingLabel: 'تدقيق المبيعات والفواتير والمرتجعات',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'جدول تدقيق تفصيلي لكل فواتير البيع والتحصيل',
    viewKey: 'reports',
  },
  {
    id: 'rep_audit_logs',
    audience: 'artisan',
    category: 'reports',
    craftLabel: 'سجل الحركات',
    accountingLabel: 'سجل الرقابة والتدقيق المحاسبي (Audit Logs)',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'سجل تاريخي كامل لكل حركة وتعديل داخل النظام',
    viewKey: 'reports',
  },
  {
    id: 'rep_advanced_charts',
    audience: 'artisan',
    category: 'reports',
    craftLabel: 'الرسوم التحليلية المتقدمة',
    accountingLabel: 'الرسوم البيانية والإنفوجرافيك المحاسبي الكامل',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'فتح كافة الرسوم البيانية المركّبة والمقارنات الفصلية والسنوية',
    viewKey: 'reports',
  },

  // ==================== 4. الموردين (الوضع الحرفي/التجاري البسيط vs الوضع المحاسبي) ====================
  {
    id: 'sup_finance_title',
    audience: 'supplier',
    category: 'accounting',
    craftLabel: 'خزنة المحل ومصاريفك',
    accountingLabel: 'الإدارة المالية والخزائن ودفتر الأستاذ للمورد',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'العنوان الرئيسي لشاشة الحسابات والخزينة عند المورد',
    viewKey: 'supplier_finance',
  },
  {
    id: 'sup_debit',
    audience: 'supplier',
    category: 'accounting',
    craftLabel: 'فلوس داخلة للمحل (+)',
    accountingLabel: 'إيداع / وارد (مدين +)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'التحصيلات والمبيعات الداخلة لخزنة المورد',
    viewKey: 'supplier_finance',
  },
  {
    id: 'sup_credit',
    audience: 'supplier',
    category: 'accounting',
    craftLabel: 'فلوس خارجة من المحل (-)',
    accountingLabel: 'سحب / صادر (دائن -)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'المصاريف والمدفوعات الخارجة من خزنة المورد',
    viewKey: 'supplier_finance',
  },
  {
    id: 'sup_ledger_tab',
    audience: 'supplier',
    category: 'accounting',
    craftLabel: 'دفتر حركة الفلوس',
    accountingLabel: 'دفتر الأستاذ وحركات القيود التفصيلية',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'عرض سجل القيود وحركات المدين والدائن التفصيلية في مالية المورد',
    viewKey: 'supplier_finance',
  },
  {
    id: 'sup_erp_hub_card',
    audience: 'supplier',
    category: 'operations',
    craftLabel: 'متابعة الفروع والخزنة',
    accountingLabel: 'مركز قيادة الفروع والتوريدات (ERP Hub)',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'بطاقة شجرة الفروع وتوريدات الخزائن المركزية في شاشة المورد',
    viewKey: 'supplier_erp_hub',
  },
  {
    id: 'sup_warehouse_erp_card',
    audience: 'supplier',
    category: 'vouchers',
    craftLabel: 'حركة البضاعة والمخزن',
    accountingLabel: 'كارت الصنف وأذونات التحويل والمصانع',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'إدارة أرصدة البضاعة وأذونات التحويل بين المخازن والفروع',
    viewKey: 'supplier_warehouse_erp',
  },
  {
    id: 'sup_hr_terminal_card',
    audience: 'supplier',
    category: 'operations',
    craftLabel: 'فريق المحل والورديات',
    accountingLabel: 'شؤون العاملين وتثبيت أجهزة الكاشير (HR & Kiosk)',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'بطاقة إدارة شؤون العاملين وأجهزة الكاشير الثابتة للمورد',
    viewKey: 'supplier_hr_terminal',
  },
  {
    id: 'sup_executive_brief_card',
    audience: 'supplier',
    category: 'reports',
    craftLabel: 'هلخصهالك — خلاصة المحل',
    accountingLabel: 'الملخص التنفيذي ومؤشرات الأداء (KPIs)',
    visibleInCraft: true,
    visibleInAccounting: true,
    description: 'شاشة الملخص السريع لأرقام المورد ومبيعاته وسيولته',
    viewKey: 'supplier_executive_brief',
  },
  {
    id: 'sup_reports_full_charts',
    audience: 'supplier',
    category: 'reports',
    craftLabel: 'ملخص رسوم المبيعات',
    accountingLabel: 'الرسوم البيانية التحليلية الكاملة والتقارير المالية للمورد',
    visibleInCraft: false,
    visibleInAccounting: true,
    description: 'فتح الرسوم البيانية التحليلية المفصلة لحركة المورد ومصاريفه',
    viewKey: 'supplier_finance',
  },
];

function buildDefaultItemsMap(): Record<string, ModeTermMappingItem> {
  const map: Record<string, ModeTermMappingItem> = {};
  for (const item of DEFAULT_EXPERIENCE_MODE_ITEMS) {
    map[item.id] = { ...item };
  }
  return map;
}

export const DEFAULT_EXPERIENCE_MODE_CONFIG: PlatformExperienceModeConfig = {
  defaultArtisanMode: 'craft',
  defaultSupplierMode: 'craft',
  allowUserModeSwitch: true,
  items: buildDefaultItemsMap(),
};

export function normalizeExperienceModeConfig(
  raw?: Partial<PlatformExperienceModeConfig> | null
): PlatformExperienceModeConfig {
  const baseMap = buildDefaultItemsMap();

  if (raw?.items && typeof raw.items === 'object') {
    for (const [id, entry] of Object.entries(raw.items)) {
      if (!entry || typeof entry !== 'object') continue;
      const existing = baseMap[id];
      if (existing) {
        baseMap[id] = {
          ...existing,
          craftLabel:
            typeof entry.craftLabel === 'string' && entry.craftLabel.trim()
              ? entry.craftLabel.trim()
              : existing.craftLabel,
          accountingLabel:
            typeof entry.accountingLabel === 'string' && entry.accountingLabel.trim()
              ? entry.accountingLabel.trim()
              : existing.accountingLabel,
          visibleInCraft:
            typeof entry.visibleInCraft === 'boolean'
              ? entry.visibleInCraft
              : existing.visibleInCraft,
          visibleInAccounting:
            typeof entry.visibleInAccounting === 'boolean'
              ? entry.visibleInAccounting
              : existing.visibleInAccounting,
          description:
            typeof entry.description === 'string' && entry.description.trim()
              ? entry.description.trim()
              : existing.description,
        };
      } else if (
        typeof entry.craftLabel === 'string' &&
        entry.craftLabel.trim() &&
        typeof entry.accountingLabel === 'string' &&
        entry.accountingLabel.trim()
      ) {
        // Custom Super Admin comparison row
        const audience: ModeItemAudience =
          entry.audience === 'artisan' || entry.audience === 'supplier' ? entry.audience : 'both';
        const category: ModeItemCategory =
          entry.category === 'vouchers' ||
          entry.category === 'accounting' ||
          entry.category === 'reports' ||
          entry.category === 'operations' ||
          entry.category === 'navigation'
            ? entry.category
            : 'navigation';
        baseMap[id] = {
          id,
          audience,
          category,
          craftLabel: entry.craftLabel.trim(),
          accountingLabel: entry.accountingLabel.trim(),
          visibleInCraft: entry.visibleInCraft !== false,
          visibleInAccounting: entry.visibleInAccounting !== false,
          description: typeof entry.description === 'string' ? entry.description.trim() : '',
          viewKey: typeof entry.viewKey === 'string' ? entry.viewKey : undefined,
          isCustom: true,
        };
      }
    }
  }

  return {
    defaultArtisanMode: raw?.defaultArtisanMode === 'accounting' ? 'accounting' : 'craft',
    defaultSupplierMode: raw?.defaultSupplierMode === 'accounting' ? 'accounting' : 'craft',
    allowUserModeSwitch: raw?.allowUserModeSwitch !== false,
    items: baseMap,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

const EXPERIENCE_MODE_STORAGE_PREFIX = 'alshams_experience_mode';
export const EXPERIENCE_MODE_CHANGED_EVENT = 'alshams_experience_mode_changed';

function getModeStorageKey(userId?: string): string {
  const clean = String(userId || '').trim();
  return clean ? `${EXPERIENCE_MODE_STORAGE_PREFIX}_${clean}` : EXPERIENCE_MODE_STORAGE_PREFIX;
}

export function getPlatformExperienceModeConfig(): PlatformExperienceModeConfig {
  const layout = getStoredUiLayoutConfig();
  return normalizeExperienceModeConfig(layout.experienceModeConfig);
}

export function getStoredExperienceMode(
  audience: ExperienceAudience = 'artisan',
  userId?: string,
  profileSettingsMode?: string | null
): UserExperienceMode {
  const platformCfg = getPlatformExperienceModeConfig();
  const platformDefault =
    audience === 'supplier' ? platformCfg.defaultSupplierMode : platformCfg.defaultArtisanMode;

  if (!platformCfg.allowUserModeSwitch) {
    return platformDefault;
  }

  if (typeof window !== 'undefined') {
    try {
      const perUser = userId ? localStorage.getItem(getModeStorageKey(userId)) : null;
      if (perUser === 'craft' || perUser === 'accounting') return perUser;
      const globalStored = localStorage.getItem(EXPERIENCE_MODE_STORAGE_PREFIX);
      if (globalStored === 'craft' || globalStored === 'accounting') return globalStored;
    } catch {}
  }

  if (profileSettingsMode === 'craft' || profileSettingsMode === 'accounting') {
    return profileSettingsMode;
  }

  return platformDefault;
}

export function setStoredExperienceMode(mode: UserExperienceMode, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EXPERIENCE_MODE_STORAGE_PREFIX, mode);
    if (userId) {
      localStorage.setItem(getModeStorageKey(userId), mode);
    }
  } catch {}
  try {
    window.dispatchEvent(
      new CustomEvent(EXPERIENCE_MODE_CHANGED_EVENT, {
        detail: { mode, userId: userId || '' },
      })
    );
  } catch {}
}

export function getExperienceLabelFromConfig(
  config: PlatformExperienceModeConfig,
  itemId: string,
  mode: UserExperienceMode,
  fallback?: string
): string {
  const item = config.items[itemId];
  if (!item) return fallback || itemId;
  return mode === 'accounting' ? item.accountingLabel : item.craftLabel;
}

export function isExperienceItemVisibleFromConfig(
  config: PlatformExperienceModeConfig,
  itemId: string,
  mode: UserExperienceMode,
  fallback = true
): boolean {
  const item = config.items[itemId];
  if (!item) return fallback;
  return mode === 'accounting' ? item.visibleInAccounting : item.visibleInCraft;
}

export function useExperienceMode(
  audience: ExperienceAudience = 'artisan',
  profile?: { id?: string; tenantId?: string; workshopId?: string; settings?: any } | null
) {
  const uiLayout = useUiLayoutConfig();
  const config = normalizeExperienceModeConfig(uiLayout.experienceModeConfig);
  const userId = profile?.id || profile?.workshopId || profile?.tenantId || '';
  const profileSavedMode = profile?.settings?.experienceMode as string | undefined;

  const [mode, setModeState] = useState<UserExperienceMode>(() =>
    getStoredExperienceMode(audience, userId, profileSavedMode)
  );

  useEffect(() => {
    const sync = () => {
      setModeState(getStoredExperienceMode(audience, userId, profileSavedMode));
    };
    sync();

    window.addEventListener(EXPERIENCE_MODE_CHANGED_EVENT, sync);
    window.addEventListener(UI_LAYOUT_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EXPERIENCE_MODE_CHANGED_EVENT, sync);
      window.removeEventListener(UI_LAYOUT_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [audience, userId, profileSavedMode, config.allowUserModeSwitch, config.defaultArtisanMode, config.defaultSupplierMode]);

  const setMode = useCallback(
    (nextMode: UserExperienceMode) => {
      if (!config.allowUserModeSwitch) return;
      setStoredExperienceMode(nextMode, userId);
      setModeState(nextMode);
    },
    [config.allowUserModeSwitch, userId]
  );

  const getLabel = useCallback(
    (itemId: string, fallback?: string) =>
      getExperienceLabelFromConfig(config, itemId, mode, fallback),
    [config, mode]
  );

  const isVisible = useCallback(
    (itemId: string, fallback = true) =>
      isExperienceItemVisibleFromConfig(config, itemId, mode, fallback),
    [config, mode]
  );

  const getItem = useCallback((itemId: string) => config.items[itemId], [config]);

  return {
    mode,
    setMode,
    isCraft: mode === 'craft',
    isAccounting: mode === 'accounting',
    allowSwitch: config.allowUserModeSwitch,
    config,
    getLabel,
    isVisible,
    getItem,
  };
}
