-- ============================================================================
-- الجزء الأول (1 من 4): جدول الإعدادات العامة للمنظومة + توسعة آمنة للجداول القائمة
-- آمن ١٠٠٪ للتشغيل أكثر من مرة (Idempotent) ولا يحذف أي بيانات حالية
-- ============================================================================

-- 1. جدول إعدادات المنظومة المركزية (صفحة الهبوط + باني السوق + باني سوق الموردين + الدليل)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. توسعة جدول الحسابات (profiles) لدعم الأدوار الثلاثة (فنان / مورد / سوبر أدمن)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_role TEXT DEFAULT 'artisan',
  ADD COLUMN IF NOT EXISTS supplier_id TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'female';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_account_role'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT chk_profiles_account_role
      CHECK (account_role IN ('artisan', 'supplier', 'superadmin'));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_supplier_id ON public.profiles(supplier_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account_role ON public.profiles(account_role);

-- 3. توسعة جدول دفتر الموردين الخاص بكل ورشة (suppliers) دون تضارب مع الموردين المسجلين بالمنظومة
ALTER TABLE IF EXISTS public.suppliers
  ADD COLUMN IF NOT EXISTS platform_supplier_id TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS governorate TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_suppliers_platform_ref ON public.suppliers(platform_supplier_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_source_type ON public.suppliers(source_type);

-- 4. توسعة جدول العملاء الخاص بالورشة (customers) لضمان تطابق حقول الدولة والمحافظة والمصدر
ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS governorate TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_source TEXT DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_customers_source ON public.customers(customer_source);

-- 5. توسعة جدول الخامات لدى الورشة (materials) للتسعير بالمتوسط المرجح وربط المورد الأخير
ALTER TABLE IF EXISTS public.materials
  ADD COLUMN IF NOT EXISTS current_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_limit NUMERIC(14,3) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_supplier_id TEXT,
  ADD COLUMN IF NOT EXISTS weighted_avg_cost NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS catalog_item_id TEXT;

-- 6. توسعة جدول فواتير المشتريات لدى الورشة (supplier_invoices) لمنع ازدواج ترحيل طلبات التوريد
ALTER TABLE IF EXISTS public.supplier_invoices
  ADD COLUMN IF NOT EXISTS b2b_order_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_supplier_invoices_b2b_order
  ON public.supplier_invoices(b2b_order_id)
  WHERE b2b_order_id IS NOT NULL;

-- 7. توسعة جدول الإعلانات والإشعارات العامة (admin_announcements) لدعم استهداف الموردين والورش
ALTER TABLE IF EXISTS public.admin_announcements
  ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS recipient_supplier_id TEXT;

NOTIFY pgrst, 'reload schema';
