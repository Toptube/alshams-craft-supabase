-- ============================================================================
-- استكمال الأعمدة الموسعة لجدول فواتير المبيعات (invoices) في Supabase
-- آمن لإعادة التشغيل (100% Idempotent)
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_percent NUMERIC(5,2) DEFAULT 14,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returns_total NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_currency_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS returns JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by TEXT;

NOTIFY pgrst, 'reload schema';
