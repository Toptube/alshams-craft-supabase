import { useEffect, useState } from 'react';

export interface PlatformFeatureFlags {
  // 1. منظومة الموردين والمخازن المركزية
  supplierRegistrationEnabled: boolean;
  supplierPortalEnabled: boolean;
  supplierLandingPromoEnabled: boolean;
  suppliersMarketplaceEnabled: boolean;
  supplierErpEnabled: boolean;

  // 2. أقسام ومزايا الورش والمنصة الرئيسية
  artisanMarketplaceEnabled: boolean;
  artisanStorefrontEnabled: boolean;
  familyCommunityEnabled: boolean;
  aiAssistantsEnabled: boolean;
  craftCalculatorEnabled: boolean;
  erpModulesEnabled: boolean;

  updatedAt?: string;
}

export const DEFAULT_PLATFORM_FEATURE_FLAGS: PlatformFeatureFlags = {
  supplierRegistrationEnabled: true,
  supplierPortalEnabled: true,
  supplierLandingPromoEnabled: true,
  suppliersMarketplaceEnabled: false,
  supplierErpEnabled: true,

  artisanMarketplaceEnabled: true,
  artisanStorefrontEnabled: true,
  familyCommunityEnabled: true,
  aiAssistantsEnabled: true,
  craftCalculatorEnabled: true,
  erpModulesEnabled: true,
};

export interface FeatureFlagMetaItem {
  key: keyof Omit<PlatformFeatureFlags, 'updatedAt'>;
  group: 'suppliers' | 'workshop_core';
  title: string;
  description: string;
  isBeta?: boolean;
}

export const FEATURE_FLAG_ITEMS: FeatureFlagMetaItem[] = [
  {
    key: 'supplierRegistrationEnabled',
    group: 'suppliers',
    title: 'تسجيل وإنشاء حسابات الموردين الجدد',
    description:
      'عند الإخفاء، يظهر نموذج التسجيل ودخول جوجل للفنانين والورش فقط وكأن منظومة الموردين لم تبدأ بعد.',
  },
  {
    key: 'supplierPortalEnabled',
    group: 'suppliers',
    title: 'لوحة تحكم وبوابة الموردين المستقلة',
    description:
      'يتحكم في دخول حسابات الموردين إلى لوحة التحكم والكتالوج والأوردرات والعملاء والخزينة الخاصة بهم.',
  },
  {
    key: 'supplierLandingPromoEnabled',
    group: 'suppliers',
    title: 'قسم الموردين في صفحة الهبوط الرئيسية',
    description:
      'إظهار أو إخفاء البلوك التعريفي الخاص بموردي وتجار ومصانع الخامات في الصفحة العامة للزوار.',
  },
  {
    key: 'suppliersMarketplaceEnabled',
    group: 'suppliers',
    title: 'سوق موردين الشمساوية (B2B للورش)',
    description:
      'تصفح وشراء الخامات بالجملة والقطاعي من الموردين مباشرة داخل حسابات الورش (مرحلة الربط التالية).',
    isBeta: true,
  },
  {
    key: 'supplierErpEnabled',
    group: 'suppliers',
    title: 'منظومة الفروع المتعددة وكاشير نقاط البيع للموردين (ERP & POS)',
    description:
      'تفعيل شجرة الفروع والمخزن المركزي وكاشير المبيعات (بدون صور) والتحويلات والمصانع وشؤون العاملين وتثبيت الأجهزة.',
  },
  {
    key: 'artisanMarketplaceEnabled',
    group: 'workshop_core',
    title: 'سوق الشمساوية المركزي للمشغولات',
    description: 'إظهار أو إخفاء زر وبوابة سوق الشمساوية المركزي للمنتجات المعتمدة.',
  },
  {
    key: 'artisanStorefrontEnabled',
    group: 'workshop_core',
    title: 'متجري الخاص والرابط المستقل للورش',
    description: 'إظهار أو إخفاء زر المتجر الخاص ولوحة التحكم بالمتجر في الشريط العلوي والقائمة الجانبية.',
  },
  {
    key: 'familyCommunityEnabled',
    group: 'workshop_core',
    title: 'مجتمع عيلة الشمساوية والدردشة',
    description: 'إظهار أو إخفاء مجتمع العيلة والمنشورات وغرف الحوار من الشريط العلوي والرئيسية.',
  },
  {
    key: 'aiAssistantsEnabled',
    group: 'workshop_core',
    title: 'المساعدات الذكية (شموسة وصقر AI)',
    description: 'إظهار أو إخفاء أيقونة شموسة العائمة ومستشار صقر الشمساوية داخل الحسابات.',
  },
  {
    key: 'craftCalculatorEnabled',
    group: 'workshop_core',
    title: 'حاسبة التكاليف والتسعير الذكية',
    description: 'إظهار أو إخفاء حاسبة التكاليف وحساب الهدر وساعات العمل من لوحة الورشة.',
  },
  {
    key: 'erpModulesEnabled',
    group: 'workshop_core',
    title: 'وحدات الإدارة المتقدمة (المصنعيات والمالية والعملاء)',
    description: 'إظهار أو إخفاء أقسام الخزائن والمصروفات والأصول والعملاء والمشتريات داخل الورش.',
  },
];

const FEATURE_FLAGS_STORAGE_KEY = 'alshams_platform_feature_flags';
export const FEATURE_FLAGS_UPDATED_EVENT = 'alshams_feature_flags_updated';

let inMemoryFeatureFlags: PlatformFeatureFlags | null = null;

export function normalizeFeatureFlags(raw?: Partial<PlatformFeatureFlags> | null): PlatformFeatureFlags {
  const r = (raw || {}) as Partial<PlatformFeatureFlags>;
  const pickBool = (val: unknown, fallback: boolean): boolean =>
    typeof val === 'boolean' ? val : fallback;

  return {
    supplierRegistrationEnabled: pickBool(
      r.supplierRegistrationEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.supplierRegistrationEnabled
    ),
    supplierPortalEnabled: pickBool(
      r.supplierPortalEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.supplierPortalEnabled
    ),
    supplierLandingPromoEnabled: pickBool(
      r.supplierLandingPromoEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.supplierLandingPromoEnabled
    ),
    suppliersMarketplaceEnabled: pickBool(
      r.suppliersMarketplaceEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.suppliersMarketplaceEnabled
    ),
    supplierErpEnabled: pickBool(
      r.supplierErpEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.supplierErpEnabled
    ),
    artisanMarketplaceEnabled: pickBool(
      r.artisanMarketplaceEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.artisanMarketplaceEnabled
    ),
    artisanStorefrontEnabled: pickBool(
      r.artisanStorefrontEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.artisanStorefrontEnabled
    ),
    familyCommunityEnabled: pickBool(
      r.familyCommunityEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.familyCommunityEnabled
    ),
    aiAssistantsEnabled: pickBool(
      r.aiAssistantsEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.aiAssistantsEnabled
    ),
    craftCalculatorEnabled: pickBool(
      r.craftCalculatorEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.craftCalculatorEnabled
    ),
    erpModulesEnabled: pickBool(
      r.erpModulesEnabled,
      DEFAULT_PLATFORM_FEATURE_FLAGS.erpModulesEnabled
    ),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
  };
}

export function getStoredFeatureFlags(): PlatformFeatureFlags {
  if (typeof window === 'undefined') {
    return inMemoryFeatureFlags || DEFAULT_PLATFORM_FEATURE_FLAGS;
  }
  try {
    const raw = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    if (raw) {
      const normalized = normalizeFeatureFlags(JSON.parse(raw));
      if (
        inMemoryFeatureFlags?.updatedAt &&
        normalized.updatedAt &&
        new Date(inMemoryFeatureFlags.updatedAt).getTime() >
          new Date(normalized.updatedAt).getTime()
      ) {
        return inMemoryFeatureFlags;
      }
      inMemoryFeatureFlags = normalized;
      return normalized;
    }
  } catch {}
  return inMemoryFeatureFlags || DEFAULT_PLATFORM_FEATURE_FLAGS;
}

export function saveStoredFeatureFlags(flags: Partial<PlatformFeatureFlags>): PlatformFeatureFlags {
  const normalized = normalizeFeatureFlags({
    ...flags,
    updatedAt: flags.updatedAt || new Date().toISOString(),
  });
  inMemoryFeatureFlags = normalized;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(FEATURE_FLAGS_UPDATED_EVENT, { detail: normalized }));
    } catch {}
  }
  return normalized;
}

export function useFeatureFlags(): PlatformFeatureFlags {
  const [flags, setFlags] = useState<PlatformFeatureFlags>(() => getStoredFeatureFlags());

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const custom = e as CustomEvent<PlatformFeatureFlags>;
      if (custom?.detail) {
        setFlags(normalizeFeatureFlags(custom.detail));
      } else {
        setFlags(getStoredFeatureFlags());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === FEATURE_FLAGS_STORAGE_KEY) {
        setFlags(getStoredFeatureFlags());
      }
    };
    window.addEventListener(FEATURE_FLAGS_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(FEATURE_FLAGS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return flags;
}
