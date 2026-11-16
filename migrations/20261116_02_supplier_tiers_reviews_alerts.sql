-- =====================================================================
-- AlShams Handmade Ecosystem Migration (2026-11-16-02)
-- Supplier Tiered Pricing + Workshop Reviews + Offer & New Arrival Alerts
-- Safe & Idempotent for Supabase PostgreSQL
-- =====================================================================

-- 1) Add tiered quantity pricing JSONB array on supplier_catalog_items
ALTER TABLE IF EXISTS public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS tier_pricing JSONB DEFAULT '[]'::jsonb;

-- 2) Add reviews_count column on platform_suppliers (optional summary cache)
ALTER TABLE IF EXISTS public.platform_suppliers
  ADD COLUMN IF NOT EXISTS reviews_count INT DEFAULT 0;

-- 3) Workshop Reviews & Ratings for Suppliers
CREATE TABLE IF NOT EXISTS public.supplier_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL,
  workshop_id TEXT DEFAULT '',
  reviewer_name TEXT NOT NULL,
  reviewer_brand TEXT DEFAULT '',
  reviewer_role TEXT DEFAULT 'artisan',
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_reviews_supplier
  ON public.supplier_reviews (supplier_id, created_at DESC);

ALTER TABLE public.supplier_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_reviews' AND policyname = 'supplier_reviews_select_all'
  ) THEN
    CREATE POLICY supplier_reviews_select_all ON public.supplier_reviews FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_reviews' AND policyname = 'supplier_reviews_insert_auth'
  ) THEN
    CREATE POLICY supplier_reviews_insert_auth ON public.supplier_reviews FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 4) Supplier Offer & New Stock Alerts for Workshops
CREATE TABLE IF NOT EXISTS public.supplier_offer_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL,
  supplier_brand TEXT NOT NULL,
  supplier_slug TEXT DEFAULT '',
  alert_type TEXT NOT NULL DEFAULT 'offer',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  section_id TEXT DEFAULT 'all',
  discount_badge TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_offer_alerts_created
  ON public.supplier_offer_alerts (created_at DESC);

ALTER TABLE public.supplier_offer_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_offer_alerts' AND policyname = 'supplier_offer_alerts_select_all'
  ) THEN
    CREATE POLICY supplier_offer_alerts_select_all ON public.supplier_offer_alerts FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_offer_alerts' AND policyname = 'supplier_offer_alerts_insert_auth'
  ) THEN
    CREATE POLICY supplier_offer_alerts_insert_auth ON public.supplier_offer_alerts FOR INSERT WITH CHECK (true);
  END IF;
END $$;
