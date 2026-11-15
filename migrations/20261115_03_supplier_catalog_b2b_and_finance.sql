-- ============================================================================
-- الجزء الثالث (3 من 4): كتالوج خامات المورد + طلبات التوريد B2B + حسابات وخزينة المورد
-- ============================================================================

-- 1. كتالوج ومخزن خامات المورد (جملة + قطاعي + حد أدنى للجملة)
CREATE TABLE IF NOT EXISTS public.supplier_catalog_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  craft_id TEXT DEFAULT '',
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'كيلو',
  description TEXT DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  stock_qty NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  retail_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
  wholesale_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  min_wholesale_qty NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (min_wholesale_qty >= 1),
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percent', 'fixed')),
  discount_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  in_store BOOLEAN NOT NULL DEFAULT true,
  in_market BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  source_currency TEXT DEFAULT 'EGP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_supplier ON public.supplier_catalog_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_section ON public.supplier_catalog_items(section_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_market ON public.supplier_catalog_items(in_market, is_approved);

-- 2. طلبات التوريد المشتركة (تربط الورشة بالمورد مع أقفال منع تكرار الترحيل)
CREATE TABLE IF NOT EXISTS public.b2b_supply_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_number TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  workshop_id TEXT,
  external_buyer JSONB DEFAULT NULL,
  order_source TEXT NOT NULL DEFAULT 'suppliers_market'
    CHECK (order_source IN ('direct_supplier_store', 'suppliers_market', 'external_manual')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  pricing_tier_applied TEXT NOT NULL DEFAULT 'retail' CHECK (pricing_tier_applied IN ('retail', 'wholesale', 'mixed')),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  final_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  workshop_treasury_id TEXT,
  supplier_treasury_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  workshop_approved_at TIMESTAMPTZ,
  inventory_synced_at TIMESTAMPTZ,
  financial_posted_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_supplier ON public.b2b_supply_orders(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_workshop ON public.b2b_supply_orders(workshop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_status ON public.b2b_supply_orders(status);

-- 3. عملاء المورد المعزولين (ورش المنظومة + العملاء من خارج المنظومة)
CREATE TABLE IF NOT EXISTS public.supplier_customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  workshop_id TEXT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  country TEXT DEFAULT 'مصر',
  governorate TEXT DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'external' CHECK (source_type IN ('direct_store', 'suppliers_market', 'external')),
  total_purchases NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_supplier_customer_ws
  ON public.supplier_customers(supplier_id, workshop_id)
  WHERE workshop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_customers_supplier ON public.supplier_customers(supplier_id);

-- 4. خزائن المورد وحركاتها المالية المستقلة
CREATE TABLE IF NOT EXISTS public.supplier_treasuries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'cash' CHECK (channel_type IN ('cash', 'instapay', 'vodafone_cash', 'bank', 'other')),
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EGP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_treasury_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  treasury_id TEXT NOT NULL REFERENCES public.supplier_treasuries(id) ON DELETE CASCADE,
  b2b_order_id TEXT,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('income', 'expense', 'deposit', 'withdrawal', 'adjustment')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_supplier_tx_b2b_order
  ON public.supplier_treasury_transactions(b2b_order_id, tx_type)
  WHERE b2b_order_id IS NOT NULL;

-- 5. مصروفات المورد التشغيلية
CREATE TABLE IF NOT EXISTS public.supplier_expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  treasury_id TEXT,
  category TEXT NOT NULL DEFAULT 'تشغيل',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes TEXT DEFAULT '',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. تقييمات الجودة وبلاغات الغش التجاري والتظلمات
CREATE TABLE IF NOT EXISTS public.supplier_reviews_appeals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  workshop_id TEXT,
  b2b_order_id TEXT,
  record_type TEXT NOT NULL DEFAULT 'review' CHECK (record_type IN ('review', 'quality_complaint', 'appeal')),
  rating INTEGER CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  message TEXT NOT NULL,
  admin_resolution TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
