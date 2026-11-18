-- ==============================================================================
-- Migration: Sequential Product Lifecycle & Market Trigger Fix
-- 1) Ensure Postgres trigger ONLY pushes to marketplace_products when BOTH
--    inStore = 'true' AND inMarket = 'true' (explicit export from Store to Market).
-- 2) Add market_status to supplier_catalog_items for supplier approval workflow.
-- 100% Idempotent — Safe to run multiple times in Supabase SQL Editor.
-- ==============================================================================

ALTER TABLE IF EXISTS public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS market_status TEXT DEFAULT 'none';

-- Backfill existing visible supplier items so existing approved market items stay approved
UPDATE public.supplier_catalog_items
SET market_status = CASE
  WHEN COALESCE(in_market, false) = false THEN 'none'
  WHEN COALESCE(is_approved, false) = true THEN 'approved'
  ELSE 'pending_approval'
END
WHERE market_status IS NULL OR market_status = 'none';

CREATE OR REPLACE FUNCTION public.sync_catalog_product_to_marketplace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $f_sy$
DECLARE
  lr JSONB; sp JSONB; ws_brand TEXT; ws_artist TEXT; ws_phone TEXT; ws_logo TEXT; ws_slug TEXT;
  existing_status TEXT; target_status TEXT; calc_store_price NUMERIC(14,2); calc_stock NUMERIC(14,2);
  wants_store BOOLEAN; wants_market BOOLEAN; re_submit BOOLEAN;
BEGIN
  lr := public.safe_jsonb(NEW.local_record::text, '{}'::jsonb);
  sp := public.safe_jsonb(NEW.specs::text, '{}'::jsonb);

  wants_store := LOWER(COALESCE(lr ->> 'inStore', 'false')) IN ('true', '1', 'yes')
    AND LOWER(COALESCE(lr ->> 'isPublishedInStore', 'true')) NOT IN ('false', '0', 'no');
  wants_market := LOWER(COALESCE(lr ->> 'inMarket', 'false')) IN ('true', '1', 'yes');
  re_submit := LOWER(COALESCE(lr ->> 'marketStatus', '')) = 'pending_approval';

  IF COALESCE(NEW.is_active, true) = true AND wants_store AND wants_market THEN
    BEGIN
      SELECT
        COALESCE(NULLIF(w.brand_name::text, ''), lr ->> 'brandName', 'ورشة الشمساوية'),
        COALESCE(NULLIF(w.artist_name::text, ''), lr ->> 'artistName', 'فنان الشمساوية'),
        COALESCE(NULLIF(w.phone_number::text, ''), NULLIF(w.phone::text, ''), ''),
        COALESCE(NULLIF(w.logo_data::text, ''), NULLIF(w.logo_url::text, ''), NULL),
        COALESCE(NULLIF(w.store_slug::text, ''), w.id::text)
      INTO ws_brand, ws_artist, ws_phone, ws_logo, ws_slug
      FROM public.workshops w
      WHERE w.id::text = NEW.workshop_id::text OR COALESCE(w.workshop_id::text, '') = NEW.workshop_id::text
      LIMIT 1;

      SELECT mp.status::text INTO existing_status FROM public.marketplace_products mp WHERE mp.id::text = NEW.id::text LIMIT 1;
      IF re_submit THEN
        target_status := 'pending_approval';
      ELSIF existing_status = 'approved' THEN
        target_status := 'approved';
      ELSIF COALESCE(lr ->> 'marketStatus', '') IN ('pending_approval', 'approved', 'rejected') THEN
        target_status := lr ->> 'marketStatus';
      ELSIF COALESCE(lr ->> 'marketplaceStatus', '') IN ('pending_approval', 'approved', 'rejected') THEN
        target_status := lr ->> 'marketplaceStatus';
      ELSIF existing_status IS NOT NULL THEN
        target_status := existing_status;
      ELSE
        target_status := 'pending_approval';
      END IF;

      calc_store_price := CASE WHEN COALESCE(lr ->> 'storePrice', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (lr ->> 'storePrice')::numeric ELSE COALESCE(NEW.retail_price, 0) END;
      calc_stock := CASE WHEN COALESCE(lr ->> 'currentStock', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (lr ->> 'currentStock')::numeric ELSE 1 END;

      INSERT INTO public.marketplace_products (
        id, workshop_id, brand_name, artist_name, phone_number, logo_url, store_slug,
        product_name, category, craft_name, decor_category,
        store_price, retail_price, wholesale_price, cost_price, current_stock,
        image_url, store_description, available_colors, available_sizes, dimensions,
        materials_summary, status, created_at, updated_at
      ) VALUES (
        NEW.id::text, NEW.workshop_id::text, COALESCE(ws_brand, 'ورشة الشمساوية'), COALESCE(ws_artist, 'فنان الشمساوية'),
        COALESCE(ws_phone, ''), ws_logo, COALESCE(ws_slug, NEW.workshop_id::text),
        COALESCE(NULLIF(NEW.product_name::text, ''), 'مشغولة يدوية'), COALESCE(NULLIF(NEW.category::text, ''), 'macrame'),
        COALESCE(NULLIF(NEW.craft_name::text, ''), NULLIF(NEW.category::text, ''), 'المكرمية'), COALESCE(lr ->> 'decorCategory', 'all'),
        calc_store_price, COALESCE(NEW.retail_price, calc_store_price, 0), COALESCE(NEW.wholesale_price, 0), COALESCE(NEW.cost_price, 0), calc_stock,
        COALESCE(NULLIF(NEW.image_url::text, ''), lr ->> 'imageUrl', '/alshams_falcon_emblem.png'),
        COALESCE(sp ->> 'marketingDescription', sp ->> 'materialsDescription', lr ->> 'storeDescription', ''),
        public.safe_jsonb(NEW.available_colors::text, '[]'::jsonb),
        public.safe_jsonb(NEW.available_sizes::text, '[]'::jsonb),
        public.safe_jsonb(NEW.dimensions::text, '{}'::jsonb),
        COALESCE(sp ->> 'materialsDescription', ''), target_status, COALESCE(NEW.created_at, now()), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        category = EXCLUDED.category,
        craft_name = EXCLUDED.craft_name,
        store_price = EXCLUDED.store_price,
        retail_price = EXCLUDED.retail_price,
        wholesale_price = EXCLUDED.wholesale_price,
        cost_price = EXCLUDED.cost_price,
        current_stock = EXCLUDED.current_stock,
        image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), public.marketplace_products.image_url),
        store_description = COALESCE(NULLIF(EXCLUDED.store_description, ''), public.marketplace_products.store_description),
        status = CASE
          WHEN EXCLUDED.status = 'pending_approval' THEN 'pending_approval'
          WHEN public.marketplace_products.status::text = 'approved' THEN 'approved'
          ELSE EXCLUDED.status
        END,
        updated_at = now();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$f_sy$;

DROP TRIGGER IF EXISTS trg_sync_catalog_product_to_marketplace ON public.products;
CREATE TRIGGER trg_sync_catalog_product_to_marketplace
AFTER INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_catalog_product_to_marketplace();

NOTIFY pgrst, 'reload schema';
