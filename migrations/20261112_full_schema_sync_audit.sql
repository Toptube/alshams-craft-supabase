-- ============================================================================
-- منظومة الشمساوية الحرفية | سكريبت المواءمة الشاملة وإصلاح قاعدة البيانات (Supabase)
-- Migration: 20261112_full_schema_sync_audit.sql
-- آمن لإعادة التشغيل المتكرر (100% Idempotent) - ينفذ بالكامل داخل Supabase SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- القسم الأول: استكمال الأعمدة الناقصة في الجداول الموجودة فعلياً (ALTER TABLE)
-- ----------------------------------------------------------------------------

-- 1.1 جدول الورش (workshops)
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS workshop_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_uid TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'ج.م',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'artisan',
  ADD COLUMN IF NOT EXISTS default_vat_percent NUMERIC(5,2) DEFAULT 14,
  ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspension_duration TEXT,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appeal_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS appeal_message TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS appeal_submitted_at TIMESTAMPTZ;

-- مزامنة الحقول المزدوجة في workshops عند التشغيل (مع تحويل الأنواع الصريح لتجنب تعارض uuid/text)
UPDATE public.workshops
SET
  phone_number = COALESCE(NULLIF(phone_number::text, ''), NULLIF(phone::text, '')),
  currency_symbol = COALESCE(NULLIF(currency_symbol::text, ''), CASE WHEN currency::text = 'SAR' THEN 'ر.س' WHEN currency::text = 'AED' THEN 'د.إ' ELSE 'ج.م' END),
  workshop_id = COALESCE(NULLIF(workshop_id::text, ''), id::text),
  suspension_reason = COALESCE(NULLIF(suspension_reason::text, ''), NULLIF(suspended_reason::text, ''))
WHERE phone_number IS NULL
   OR currency_symbol IS NULL
   OR workshop_id IS NULL
   OR suspension_reason IS NULL;

CREATE INDEX IF NOT EXISTS idx_workshops_status ON public.workshops(status);
CREATE INDEX IF NOT EXISTS idx_workshops_appeal ON public.workshops(appeal_status);

-- 1.2 جدول الملفات الشخصية (profiles)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS artist_name TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS workshop_id TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'مصر',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'ج.م',
  ADD COLUMN IF NOT EXISTS calling_code TEXT DEFAULT '+20',
  ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspension_duration TEXT,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appeal_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1.3 جدول المنتجات (products) — حرج لنجاح المزامنة ثنائية الاتجاه والذكاء الاصطناعي
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_code TEXT,
  ADD COLUMN IF NOT EXISTS serial_number INTEGER,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'عام',
  ADD COLUMN IF NOT EXISTS craft_name TEXT,
  ADD COLUMN IF NOT EXISTS materials_used JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS local_record JSONB,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.products
SET product_name = COALESCE(NULLIF(product_name::text, ''), NULLIF(name::text, ''), 'منتج حرفي')
WHERE product_name IS NULL OR product_name::text = '';

CREATE INDEX IF NOT EXISTS idx_products_workshop ON public.products(workshop_id);
CREATE INDEX IF NOT EXISTS idx_products_sync ON public.products(workshop_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(workshop_id, is_active);

CREATE OR REPLACE FUNCTION public.products_sync_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.updated_at IS NOT NULL AND OLD.updated_at IS NOT NULL AND NEW.updated_at < OLD.updated_at THEN
    RETURN OLD;
  END IF;
  NEW.synced_at := clock_timestamp();
  NEW.product_name := COALESCE(NULLIF(NEW.product_name::text, ''), NULLIF(NEW.name::text, ''), 'منتج حرفي');
  NEW.name := COALESCE(NULLIF(NEW.name::text, ''), NEW.product_name::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_guard ON public.products;
CREATE TRIGGER products_sync_guard
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_sync_guard();

-- 1.4 جدول أوامر التشغيل (work_orders)
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS workshop_id TEXT,
  ADD COLUMN IF NOT EXISTS craft_id TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS target_quantity NUMERIC(12,3) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_employee_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_employee_wage NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pulled_materials JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS returned_materials JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS finished_products_produced NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_consumed_materials_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_labor_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_production_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost_calculated NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_work_orders_workshop ON public.work_orders(workshop_id);

-- 1.5 جدول الخامات (materials)
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS current_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_limit NUMERIC(14,3) DEFAULT 5;

-- 1.6 جدول الموردين (suppliers)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS material_specialty TEXT,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(14,2) DEFAULT 0;

-- 1.7 جدول العملاء (customers)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(14,2) DEFAULT 0;

-- 1.8 جدول الخزائن وحركاتها (treasuries & treasury_transactions)
ALTER TABLE public.treasuries
  ADD COLUMN IF NOT EXISTS min_balance NUMERIC(14,2) DEFAULT 0;

ALTER TABLE public.treasury_transactions
  ADD COLUMN IF NOT EXISTS category_name TEXT;

-- 1.9 جدول طلبات الانضمام (workshop_applications)
ALTER TABLE public.workshop_applications
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS workshop_id TEXT,
  ADD COLUMN IF NOT EXISTS crafts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_email TEXT;

-- 1.10 جدول ذاكرة الذكاء الاصطناعي (ai_global_memory)
ALTER TABLE public.ai_global_memory
  ADD COLUMN IF NOT EXISTS agent_type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS rules TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ----------------------------------------------------------------------------
-- القسم الثاني: إنشاء الجداول المفقودة بالكامل (CREATE TABLE IF NOT EXISTS)
-- ----------------------------------------------------------------------------

-- 2.1 جدول الموظفين والصناع (employees)
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'artisan',
  phone TEXT,
  phone_number TEXT,
  base_wage NUMERIC(12,2) DEFAULT 0,
  wage_type TEXT DEFAULT 'piece_rate',
  current_balance NUMERIC(14,2) DEFAULT 0,
  total_earned NUMERIC(14,2) DEFAULT 0,
  total_paid NUMERIC(14,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_workshop ON public.employees(workshop_id);

-- 2.2 جدول الطلبات والمبيعات (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  order_number TEXT,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  product_name TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  shipping NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  final_total NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  remaining_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  delivery_date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_workshop ON public.orders(workshop_id);

-- 2.3 جدول تصنيفات الخزائن (treasury_categories)
CREATE TABLE IF NOT EXISTS public.treasury_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  notes TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treasury_categories_workshop ON public.treasury_categories(workshop_id);

-- 2.4 جدول الحركات المالية المختصرة (safe_transactions)
CREATE TABLE IF NOT EXISTS public.safe_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  treasury_id TEXT,
  type TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  channel TEXT DEFAULT 'cash',
  category TEXT,
  note TEXT,
  notes TEXT,
  reference_id TEXT,
  reference_type TEXT,
  date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safe_transactions_workshop ON public.safe_transactions(workshop_id);

-- 2.5 جدول المصروفات الإدارية والتشغيلية (expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'تشغيلية',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  treasury_id TEXT,
  payment_method TEXT DEFAULT 'cash',
  date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_workshop ON public.expenses(workshop_id);

-- 2.6 جدول العهد المالية (custodies)
CREATE TABLE IF NOT EXISTS public.custodies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  treasury_id TEXT,
  holder_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  spent_amount NUMERIC(14,2) DEFAULT 0,
  remaining_amount NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  issued_at TIMESTAMPTZ DEFAULT now(),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custodies_workshop ON public.custodies(workshop_id);

-- 2.7 جدول الفواتير الضريبية وفواتير العملاء (invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  invoice_number TEXT,
  customer_id TEXT,
  customer_name TEXT,
  total_amount NUMERIC(14,2) DEFAULT 0,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  remaining_amount NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  items JSONB DEFAULT '[]'::jsonb,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_workshop ON public.invoices(workshop_id);

-- 2.8 جدول فواتير المشتريات والموردين (supplier_invoices)
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workshop_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  supplier_id TEXT,
  supplier_name TEXT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  items JSONB DEFAULT '[]'::jsonb,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_workshop ON public.supplier_invoices(workshop_id);

-- 2.9 جدول مراسلات وتنبيهات الإدارة العليا (admin_announcements)
-- ملاحظة: نعتمد TEXT للمعرفات لتتوافق مع المعرفات النصية وUUID معاً
CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id TEXT,
  sender_name TEXT,
  recipient_type TEXT NOT NULL DEFAULT 'all',
  recipient_workshop_id TEXT NULL,
  recipient_workshop_name TEXT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_announcements_recipient ON public.admin_announcements(recipient_type, recipient_workshop_id);
CREATE INDEX IF NOT EXISTS idx_admin_announcements_created ON public.admin_announcements(created_at DESC);

-- 2.10 جدول إيصالات القراءة والردود والمقترحات (workshop_messages_receipts)
-- ملاحظة: يتضمن قيد UNIQUE(message_id, workshop_id) الضروري لعمليات upsert وبدون FK مقيد لقبول رسائل الزوار
CREATE TABLE IF NOT EXISTS public.workshop_messages_receipts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT NOT NULL,
  workshop_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  reply_text TEXT NULL,
  replied_at TIMESTAMPTZ NULL,
  CONSTRAINT workshop_messages_receipts_unique UNIQUE (message_id, workshop_id)
);
CREATE INDEX IF NOT EXISTS idx_workshop_receipts_workshop ON public.workshop_messages_receipts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_receipts_msg ON public.workshop_messages_receipts(message_id);

-- ----------------------------------------------------------------------------
-- القسم الثالث: الصلاحيات وأمان مستوى الصف (RLS Policies)
-- ----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_messages_receipts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'employees',
    'orders',
    'treasury_categories',
    'safe_transactions',
    'expenses',
    'custodies',
    'invoices',
    'supplier_invoices',
    'admin_announcements',
    'workshop_messages_receipts'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "allow_all_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- تحديث ذاكرة PostgREST فوراً للتعرف على جميع الجداول والأعمدة الجديدة
NOTIFY pgrst, 'reload schema';
