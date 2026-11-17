-- ============================================================================
-- Migration: Supplier Multi-Branch ERP, Zero-Image Warehouses, POS Cashier,
-- Branch Treasuries, Factory Vendors, HR & Terminal Kiosk Device Lock
-- Date: 2026-11-16
-- Idempotent & RLS-Hardened
-- ============================================================================

-- 1. Extend platform_suppliers with Tree, Branch Expansion Approval & Owner PIN
ALTER TABLE IF EXISTS public.platform_suppliers
  ADD COLUMN IF NOT EXISTS has_central_warehouse BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_branches_approved INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS branch_expansion_requested INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_expansion_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS branch_expansion_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS owner_unlock_pin TEXT DEFAULT '1234';

-- 2. Supplier Branches (Central Warehouse + Shops / Branches)
CREATE TABLE IF NOT EXISTS public.supplier_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  branch_type TEXT NOT NULL DEFAULT 'shop', -- 'central_warehouse' | 'shop'
  governorate TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  pos_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active', -- 'active' | 'pending_approval'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_branches_supplier ON public.supplier_branches(supplier_id);

-- 3. Supplier Categories & Sub-Categories (Main & Sub)
CREATE TABLE IF NOT EXISTS public.supplier_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES public.supplier_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_cats_supplier ON public.supplier_categories(supplier_id);

-- 4. Zero-Image Branch Inventory & Multi-Unit Conversion (NUMERIC(14,3) for grams/fractions)
CREATE TABLE IF NOT EXISTS public.supplier_branch_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.supplier_branches(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  sku_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category_id TEXT DEFAULT '',
  sub_category_id TEXT DEFAULT '',
  purchase_unit TEXT NOT NULL DEFAULT 'طرد',
  sale_unit TEXT NOT NULL DEFAULT 'كيلو',
  conversion_factor NUMERIC(14,3) NOT NULL DEFAULT 1.000,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0.000,
  min_alert NUMERIC(14,3) NOT NULL DEFAULT 5.000,
  avg_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  retail_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  wholesale_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_inv_sup_branch ON public.supplier_branch_inventory(supplier_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sup_inv_sku ON public.supplier_branch_inventory(supplier_id, sku_code);

-- 5. Item History Card / Stock Movements Ledger (كارت الصنف - قصة حياة الصنف)
CREATE TABLE IF NOT EXISTS public.supplier_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  to_branch_id UUID NULL,
  item_id TEXT NOT NULL,
  sku_code TEXT DEFAULT '',
  item_name TEXT NOT NULL,
  movement_type TEXT NOT NULL, -- 'purchase_in' | 'transfer_out' | 'transfer_in' | 'pos_sale' | 'b2b_sale' | 'adjustment'
  qty_delta NUMERIC(14,3) NOT NULL,
  balance_after NUMERIC(14,3) DEFAULT 0.000,
  unit_label TEXT DEFAULT 'كيلو',
  unit_cost NUMERIC(14,2) DEFAULT 0.00,
  reference_no TEXT DEFAULT '',
  actor_staff_id TEXT DEFAULT '',
  actor_name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_mov_item ON public.supplier_stock_movements(supplier_id, item_id, created_at DESC);

-- 6. Supplier Staff Credentials & Terminal Device Lock Binding
CREATE TABLE IF NOT EXISTS public.supplier_staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NULL,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier', -- 'cashier' | 'warehouse' | 'accountant' | 'hr_manager' | 'branch_manager'
  job_title TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  base_salary NUMERIC(14,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  device_lock_token TEXT DEFAULT '',
  device_ip TEXT DEFAULT '',
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_staff_supplier ON public.supplier_staff_users(supplier_id);

-- 7. Supplier HR Logs (Attendance, Penalties, Bonuses, Advances, Salary Payouts)
CREATE TABLE IF NOT EXISTS public.supplier_hr_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.supplier_staff_users(id) ON DELETE CASCADE,
  branch_id UUID NULL,
  log_type TEXT NOT NULL, -- 'attendance_in' | 'attendance_out' | 'penalty' | 'bonus' | 'advance' | 'salary_paid'
  amount NUMERIC(14,2) DEFAULT 0.00,
  notes TEXT DEFAULT '',
  actor_name TEXT DEFAULT '',
  event_time TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_hr_staff ON public.supplier_hr_logs(supplier_id, staff_id, event_time DESC);

-- 8. POS Cashier Shifts (ورديات الكاشير)
CREATE TABLE IF NOT EXISTS public.supplier_pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  staff_id TEXT DEFAULT '',
  staff_name TEXT NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  closed_by_name TEXT DEFAULT '',
  opening_cash NUMERIC(14,2) DEFAULT 0.00,
  cash_total NUMERIC(14,2) DEFAULT 0.00,
  instapay_total NUMERIC(14,2) DEFAULT 0.00,
  wallet_total NUMERIC(14,2) DEFAULT 0.00,
  deferred_total NUMERIC(14,2) DEFAULT 0.00,
  orders_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  settled_to_branch_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_sup_shifts_branch ON public.supplier_pos_shifts(supplier_id, branch_id, status);

-- 9. Branch Treasuries & Pending Transfers to Owner Main Treasury
CREATE TABLE IF NOT EXISTS public.supplier_branch_treasuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  cash_balance NUMERIC(14,2) DEFAULT 0.00,
  instapay_balance NUMERIC(14,2) DEFAULT 0.00,
  wallet_balance NUMERIC(14,2) DEFAULT 0.00,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supplier_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.supplier_treasury_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  branch_name TEXT DEFAULT '',
  shift_id UUID NULL,
  sent_by_name TEXT NOT NULL,
  cash_amount NUMERIC(14,2) DEFAULT 0.00,
  instapay_amount NUMERIC(14,2) DEFAULT 0.00,
  wallet_amount NUMERIC(14,2) DEFAULT 0.00,
  total_amount NUMERIC(14,2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending_owner_confirmation', -- 'pending_owner_confirmation' | 'confirmed' | 'rejected'
  confirmed_by TEXT DEFAULT '',
  confirmed_at TIMESTAMPTZ NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_transfers_supplier ON public.supplier_treasury_transfers(supplier_id, status);

-- 10. POS Cashier Orders (In-Store Walk-in & Online Delivery Orders)
CREATE TABLE IF NOT EXISTS public.supplier_pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  shift_id UUID NULL,
  staff_id TEXT DEFAULT '',
  staff_name TEXT NOT NULL,
  customer_id TEXT DEFAULT '',
  customer_name TEXT DEFAULT 'عميل نقدي',
  customer_phone TEXT DEFAULT '',
  sales_channel TEXT NOT NULL DEFAULT 'branch_walkin', -- 'branch_walkin' | 'online'
  delivery_governorate TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  shipping_fee NUMERIC(14,2) DEFAULT 0.00,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) DEFAULT 0.00,
  discount NUMERIC(14,2) DEFAULT 0.00,
  final_total NUMERIC(14,2) DEFAULT 0.00,
  paid_amount NUMERIC(14,2) DEFAULT 0.00,
  remaining_amount NUMERIC(14,2) DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash' | 'instapay' | 'wallet' | 'credit'
  payment_status TEXT NOT NULL DEFAULT 'paid', -- 'paid' | 'partial' | 'credit'
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_pos_orders_sup ON public.supplier_pos_orders(supplier_id, branch_id, created_at DESC);

-- 11. External Vendors/Factories & Procurement Invoices (علينا كام للموردين)
CREATE TABLE IF NOT EXISTS public.supplier_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  vendor_type TEXT DEFAULT 'مصنع خامات',
  address TEXT DEFAULT '',
  balance_owed NUMERIC(14,2) DEFAULT 0.00,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  vendor_id UUID NULL,
  vendor_name TEXT DEFAULT '',
  invoice_no TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(14,2) DEFAULT 0.00,
  paid_amount NUMERIC(14,2) DEFAULT 0.00,
  remaining_amount NUMERIC(14,2) DEFAULT 0.00,
  treasury_channel TEXT DEFAULT 'cash',
  actor_name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sup_purchases_sup ON public.supplier_purchases(supplier_id, created_at DESC);

-- Extend supplier_customers with channel & credit tracking if not present
ALTER TABLE IF EXISTS public.supplier_customers
  ADD COLUMN IF NOT EXISTS walkin_orders_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_orders_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_address TEXT DEFAULT '';

-- ============================================================================
-- Enable Row Level Security & Scoped Policies
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'supplier_branches',
    'supplier_categories',
    'supplier_branch_inventory',
    'supplier_stock_movements',
    'supplier_staff_users',
    'supplier_hr_logs',
    'supplier_pos_shifts',
    'supplier_branch_treasuries',
    'supplier_treasury_transfers',
    'supplier_pos_orders',
    'supplier_vendors',
    'supplier_purchases'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Owner or admin full access on %I" ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Owner or admin full access on %I" ON public.%I FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.platform_suppliers ps
          WHERE ps.id::text = %I.supplier_id::text
          AND (ps.owner_uid::text = auth.uid()::text OR lower(ps.email) = lower(auth.jwt() ->> ''email''))
        )
        OR lower(auth.jwt() ->> ''email'') IN (''hmb.top.tube@gmail.com'', ''hmb.top.tupe@gmail.com'')
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.platform_suppliers ps
          WHERE ps.id::text = %I.supplier_id::text
          AND (ps.owner_uid::text = auth.uid()::text OR lower(ps.email) = lower(auth.jwt() ->> ''email''))
        )
        OR lower(auth.jwt() ->> ''email'') IN (''hmb.top.tube@gmail.com'', ''hmb.top.tupe@gmail.com'')
      );',
      tbl, tbl, tbl, tbl
    );
    EXECUTE format('GRANT ALL ON public.%I TO authenticated, service_role;', tbl);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
