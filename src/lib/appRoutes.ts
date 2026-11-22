/**
 * سجل الروابط والصفحات الموحد لمنظومة الشمساوية
 * يربط كل صفحة فعلية في النظام برابط حقيقي مستقل (Clean URL)
 * ويمكّن السوبر أدمن من تخصيص عناوين ووصف وأزرار كل صفحة على حدة،
 * كما يولّد روابط هبوط مستقلة للمنتجات (/product/:id) قابلة للمشاركة على فيسبوك وواتساب.
 */

export interface AppPageRouteDefinition {
  viewId: string;
  path: string;
  aliases?: string[];
  defaultTitle: string;
  defaultSubtitle: string;
  audience: 'artisan' | 'supplier' | 'shared' | 'admin';
  customizable?: boolean;
}

export const APP_PAGE_ROUTES: AppPageRouteDefinition[] = [
  {
    viewId: 'home',
    path: '/',
    defaultTitle: 'الرئيسية',
    defaultSubtitle: 'بطاقات التحكم السريعة للورشة',
    audience: 'shared',
    customizable: false,
  },
  {
    viewId: 'my_subscriptions',
    path: '/subscriptions',
    defaultTitle: 'اشتراكاتي وباقات المنظومة',
    defaultSubtitle: 'اختر وفعّل الباقات التي تناسب ورشتك أو تجارتك',
    audience: 'shared',
    customizable: false,
  },
  {
    viewId: 'executive_brief',
    path: '/brief',
    defaultTitle: 'هلخصهالك',
    defaultSubtitle: 'ملخص سريع لوضع ورشتك اليوم',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'guide_start',
    path: '/start-workshop',
    defaultTitle: 'نبدأ ورشتنا',
    defaultSubtitle: '4 خطوات سهلة عشان تبدأ شغلك صح من أول يوم',
    audience: 'shared',
    customizable: true,
  },
  {
    viewId: 'guide_daily',
    path: '/daily-routine',
    defaultTitle: 'يومك في الورشة',
    defaultSubtitle: 'اعرف تسجل كل حركة يومية فين في ثانية',
    audience: 'shared',
    customizable: true,
  },
  {
    viewId: 'inventory_materials',
    path: '/inventory',
    defaultTitle: 'جرد أرصدة الخامات',
    defaultSubtitle: 'متابعة الكميات المتوفرة وحدود الطلب وتكلفة الخامات',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'inventory_audit',
    path: '/inventory-audit',
    defaultTitle: 'حركة المخزن والجرد',
    defaultSubtitle: 'تسجيل التوريد والصرف والتسويات الجردية وسجل الحركات',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'finished_products',
    path: '/finished-products',
    defaultTitle: 'مخزن المنتجات الجاهزة',
    defaultSubtitle: 'متابعة القطع تامة الصنع والكميات الجاهزة للبيع وأسعارها',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'materials',
    path: '/materials',
    defaultTitle: 'خاماتي',
    defaultSubtitle: 'الخامات اللي بتشتغل بيها في ورشتك وأسعارها',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'calculator',
    path: '/calculator',
    defaultTitle: 'حاسبة الإنتاج والتسعير',
    defaultSubtitle: 'احسب تكلفة المنتج وحدد سعر البيع والربح بدقة',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'archive',
    path: '/archive',
    defaultTitle: 'أرشيف المنتجات',
    defaultSubtitle: 'كل منتجاتك المحفوظة وتكاليفها وتفاصيلها',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'catalog',
    path: '/catalog',
    defaultTitle: 'كتالوج المعرض والمتجر',
    defaultSubtitle: 'عرض منتجاتك ومشاركة روابطها مباشرة للعملاء',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'purchases',
    path: '/purchases',
    defaultTitle: 'المشتريات',
    defaultSubtitle: 'فواتير شراء الخامات وحساب الموردين',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'suppliers',
    path: '/suppliers',
    defaultTitle: 'الموردين',
    defaultSubtitle: 'قائمة موردين الخامات وحساباتهم',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'work_orders',
    path: '/work-orders',
    defaultTitle: 'شغل الورشة والإنتاج',
    defaultSubtitle: 'متابعة القطع اللي بتتصنع وتسليمها للمخزن',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'sales',
    path: '/sales',
    defaultTitle: 'المبيعات',
    defaultSubtitle: 'تسجيل المبيعات وتحصيل دفعات العملاء',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'invoices',
    path: '/invoices',
    defaultTitle: 'الفواتير والمرتجعات',
    defaultSubtitle: 'سجل فواتير البيع والطباعة والمرتجعات',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'customers',
    path: '/customers',
    defaultTitle: 'العملاء',
    defaultSubtitle: 'بيانات عملاء ورشتك وتاريخ طلباتهم',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'hr',
    path: '/team',
    defaultTitle: 'فريق العمل والأجور',
    defaultSubtitle: 'الصنايعية والموظفين والسلف والرواتب',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'treasuries',
    path: '/treasuries',
    defaultTitle: 'درج الورشة والخزائن',
    defaultSubtitle: 'متابعة النقدية والإيداع والصرف والعُهد',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'accounts',
    path: '/accounts',
    defaultTitle: 'الحسابات والدفاتر',
    defaultSubtitle: 'ميزان المراجعة والقيود المحاسبية المتقدمة',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'fixed_assets',
    path: '/fixed-assets',
    defaultTitle: 'الأصول الثابتة والمعدات',
    defaultSubtitle: 'سجل الماكينات والمعدات وجداول الإهلاك والصيانة',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'reports',
    path: '/reports',
    defaultTitle: 'التقارير والأرباح',
    defaultSubtitle: 'خلاصة المبيعات والمصروفات وصافي الربح',
    audience: 'artisan',
    customizable: true,
  },
  {
    viewId: 'personal_profile',
    path: '/profile',
    defaultTitle: 'صفحتي الشخصية',
    defaultSubtitle: 'نبذتك ومعرض أعمالك وشروحاتك المدمجة',
    audience: 'shared',
    customizable: true,
  },
  {
    viewId: 'family',
    path: '/family',
    defaultTitle: 'طبلية عيلة الشمساوية',
    defaultSubtitle: 'مجتمع الفنانين والموردين وتبادل الخبرات',
    audience: 'shared',
    customizable: true,
  },
  {
    viewId: 'ai_agent',
    path: '/falcon',
    defaultTitle: 'صقر المساعد الذكي',
    defaultSubtitle: 'تحليل واستشارات فورية لإدارة ورشتك',
    audience: 'shared',
    customizable: true,
  },
  {
    viewId: 'marketplace',
    path: '/app-market',
    defaultTitle: 'سوق الشمساوية',
    defaultSubtitle: 'تصفح منتجات ورش وفنانين الشمساوية',
    audience: 'shared',
    customizable: true,
  },
  {
    viewId: 'suppliers_market',
    path: '/b2b-suppliers',
    defaultTitle: 'سوق الموردين',
    defaultSubtitle: 'شراء الخامات مباشرة من موردين معتمدين',
    audience: 'shared',
    customizable: true,
  },
  // Supplier Views
  {
    viewId: 'supplier_executive_brief',
    path: '/supplier-brief',
    defaultTitle: 'هلخصهالك للمورد',
    defaultSubtitle: 'ملخص سريع لمبيعات وطلبات التوريد',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_catalog',
    path: '/supplier-catalog',
    defaultTitle: 'خاماتي وكتالوج التوريد',
    defaultSubtitle: 'إدارة أصناف وأسعار الجملة والقطاعي',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_orders',
    path: '/supplier-orders',
    defaultTitle: 'طلبات التوريد',
    defaultSubtitle: 'متابعة طلبيات الورش والعملاء وتجهيزها',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_customers',
    path: '/supplier-customers',
    defaultTitle: 'عملاء المورد والورش',
    defaultSubtitle: 'دليل الورش والعملاء وكشوفات الحساب',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_finance',
    path: '/supplier-finance',
    defaultTitle: 'خزائن وماليات المورد',
    defaultSubtitle: 'متابعة التحصيلات والمصروفات والأرباح',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_erp',
    path: '/supplier-erp',
    defaultTitle: 'إدارة الفروع والمنظومة',
    defaultSubtitle: 'التحكم في الفروع والمخازن ونقاط البيع',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_pos',
    path: '/supplier-pos',
    defaultTitle: 'نقطة البيع والكاشير',
    defaultSubtitle: 'بيع سريع وإصدار فواتير فورية',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_branches',
    path: '/supplier-branches',
    defaultTitle: 'الفروع والمخازن',
    defaultSubtitle: 'متابعة أرصدة الفروع والتحويلات المخزنية',
    audience: 'supplier',
    customizable: true,
  },
  {
    viewId: 'supplier_hr',
    path: '/supplier-hr',
    defaultTitle: 'الموظفين والحضور',
    defaultSubtitle: 'إدارة فريق العمل والرواتب والانضباط',
    audience: 'supplier',
    customizable: true,
  },
  // Super Admin
  {
    viewId: 'admin',
    path: '/admin',
    defaultTitle: 'لوحة السوبر أدمن',
    defaultSubtitle: 'إدارة المنظومة والورش والموردين والإعدادات',
    audience: 'admin',
    customizable: false,
  },
  {
    viewId: 'appeals',
    path: '/admin-appeals',
    defaultTitle: 'التظلمات والرسائل',
    defaultSubtitle: 'مراجعة رسائل وتظلمات الأعضاء',
    audience: 'admin',
    customizable: false,
  },
  {
    viewId: 'messaging',
    path: '/admin-messaging',
    defaultTitle: 'البريد والإعلانات',
    defaultSubtitle: 'إرسال التنبيهات والرسائل للورش والموردين',
    audience: 'admin',
    customizable: false,
  },
];

const VIEW_TO_PATH = new Map<string, string>();
const PATH_TO_VIEW = new Map<string, string>();

for (const route of APP_PAGE_ROUTES) {
  VIEW_TO_PATH.set(route.viewId, route.path);
  PATH_TO_VIEW.set(route.path.toLowerCase(), route.viewId);
  if (route.aliases) {
    for (const a of route.aliases) {
      PATH_TO_VIEW.set(a.toLowerCase(), route.viewId);
    }
  }
}

export function getPathForView(viewId: string): string {
  return VIEW_TO_PATH.get(viewId) || '/';
}

export function getRouteDefForView(viewId: string): AppPageRouteDefinition | undefined {
  return APP_PAGE_ROUTES.find((r) => r.viewId === viewId);
}

export function resolveViewFromPath(pathname: string, search = '', hash = ''): string | null {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const exact = PATH_TO_VIEW.get(cleanPath.toLowerCase());
  if (exact) return exact;

  // Support legacy hash routes like #/family or #/treasuries
  const cleanHashPath = (hash || '').replace(/^#/, '').replace(/\/+$/, '');
  if (cleanHashPath) {
    const normalizedHash = cleanHashPath.startsWith('/') ? cleanHashPath : `/${cleanHashPath}`;
    const fromHash = PATH_TO_VIEW.get(normalizedHash.toLowerCase());
    if (fromHash) return fromHash;
  }

  // Support query param ?view=...
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const qv = params.get('view');
      if (qv && VIEW_TO_PATH.has(qv)) return qv;
    } catch {}
  }

  return null;
}

export function buildProductLandingUrl(productId: string, origin?: string): string {
  const base =
    origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/product/${encodeURIComponent(productId)}`;
}

export function buildStoreUrl(slug: string, origin?: string): string {
  const base =
    origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/store/${encodeURIComponent(slug)}`;
}

export function buildPageUrl(viewId: string, origin?: string): string {
  const base =
    origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const p = getPathForView(viewId);
  return `${base}${p}`;
}
