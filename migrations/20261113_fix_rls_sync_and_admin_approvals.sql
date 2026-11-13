CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $f_sa$
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'hmb.top.tube@gmail.com';
$f_sa$;

CREATE OR REPLACE FUNCTION public.safe_jsonb(raw_val TEXT, fallback JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $f_jb$
DECLARE trimmed TEXT;
BEGIN
  IF raw_val IS NULL THEN RETURN fallback; END IF;
  trimmed := BTRIM(raw_val);
  IF trimmed = '' THEN RETURN fallback; END IF;
  BEGIN
    RETURN trimmed::jsonb;
  EXCEPTION WHEN OTHERS THEN
    IF jsonb_typeof(fallback) = 'array' AND LEFT(trimmed, 1) = '{' AND RIGHT(trimmed, 1) = '}' THEN
      BEGIN RETURN COALESCE(to_jsonb(trimmed::text[]), fallback); EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_array(trimmed); END;
    END IF;
    IF jsonb_typeof(fallback) = 'array' THEN RETURN jsonb_build_array(trimmed); END IF;
    RETURN jsonb_build_object('raw', trimmed);
  END;
END;
$f_jb$;

ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS workshop_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_uid TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS store_slug TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_data TEXT,
  ADD COLUMN IF NOT EXISTS rating_stars INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS medal TEXT;

CREATE TABLE IF NOT EXISTS public.marketplace_products (
  id TEXT PRIMARY KEY,
  workshop_id TEXT NOT NULL,
  brand_name TEXT DEFAULT 'ورشة الشمساوية',
  artist_name TEXT DEFAULT 'فنان الشمساوية',
  phone_number TEXT DEFAULT '',
  product_name TEXT NOT NULL,
  category TEXT DEFAULT 'macrame',
  craft_name TEXT DEFAULT 'المكرمية',
  decor_category TEXT DEFAULT 'all',
  store_price NUMERIC(14,2) DEFAULT 0,
  retail_price NUMERIC(14,2) DEFAULT 0,
  wholesale_price NUMERIC(14,2) DEFAULT 0,
  cost_price NUMERIC(14,2) DEFAULT 0,
  current_stock NUMERIC(14,2) DEFAULT 1,
  image_url TEXT,
  store_description TEXT DEFAULT '',
  available_colors JSONB DEFAULT '[]'::jsonb,
  available_sizes JSONB DEFAULT '[]'::jsonb,
  dimensions JSONB DEFAULT '{}'::jsonb,
  materials_summary TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_approval',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS store_slug TEXT,
  ADD COLUMN IF NOT EXISTS craft_name TEXT DEFAULT 'المكرمية',
  ADD COLUMN IF NOT EXISTS decor_category TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS available_colors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS available_sizes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS materials_summary TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_marketplace_products_workshop ON public.marketplace_products(workshop_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_status ON public.marketplace_products(status);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS local_record JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS craft_name TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS available_colors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS available_sizes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE IF EXISTS public.admin_announcements
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_workshop_name TEXT;

CREATE OR REPLACE FUNCTION public.is_workshop_owner(target_ws_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $f_ow$
  SELECT (target_ws_id IS NOT NULL) AND (
    target_ws_id::text = COALESCE(auth.uid()::text, '')
    OR EXISTS (
      SELECT 1 FROM public.workshops w
      WHERE (w.id::text = target_ws_id::text OR COALESCE(w.workshop_id::text, '') = target_ws_id::text)
        AND (
          COALESCE(w.owner_id::text, '') = COALESCE(auth.uid()::text, '__none__')
          OR COALESCE(w.owner_uid::text, '') = COALESCE(auth.uid()::text, '__none__')
          OR (COALESCE(auth.jwt() ->> 'email', '') <> '' AND LOWER(COALESCE(w.email::text, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
        )
    )
  );
$f_ow$;

ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketplace_products_public_read" ON public.marketplace_products;
CREATE POLICY "marketplace_products_public_read" ON public.marketplace_products FOR SELECT
  USING (status::text <> 'rejected' OR public.is_super_admin() OR public.is_workshop_owner(workshop_id::text));
DROP POLICY IF EXISTS "marketplace_products_write_authenticated" ON public.marketplace_products;
CREATE POLICY "marketplace_products_write_authenticated" ON public.marketplace_products FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_workshop_owner(workshop_id::text))
  WITH CHECK (public.is_super_admin() OR public.is_workshop_owner(workshop_id::text));

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_storefront_and_admin_select" ON public.products;
CREATE POLICY "products_storefront_and_admin_select" ON public.products FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_workshop_owner(workshop_id::text)
    OR (
      COALESCE(is_active, true) = true
      AND LOWER(COALESCE(public.safe_jsonb(local_record::text, '{}'::jsonb) ->> 'inStore', 'true')) NOT IN ('false', '0', 'no')
      AND LOWER(COALESCE(public.safe_jsonb(local_record::text, '{}'::jsonb) ->> 'isPublishedInStore', 'true')) NOT IN ('false', '0', 'no')
    )
  );
DROP POLICY IF EXISTS "products_super_admin_all" ON public.products;
CREATE POLICY "products_super_admin_all" ON public.products FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_workshop_owner(workshop_id::text))
  WITH CHECK (public.is_super_admin() OR public.is_workshop_owner(workshop_id::text));

ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workshops_public_store_read" ON public.workshops;
CREATE POLICY "workshops_public_store_read" ON public.workshops FOR SELECT USING (true);
DROP POLICY IF EXISTS "workshops_owner_update" ON public.workshops;
CREATE POLICY "workshops_owner_update" ON public.workshops FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_workshop_owner(id::text))
  WITH CHECK (public.is_super_admin() OR public.is_workshop_owner(id::text));

DO $b_rls$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'workshops','materials','orders','work_orders','customers','suppliers','employees',
    'treasuries','treasury_transactions','treasury_categories','safe_transactions',
    'expenses','custodies','invoices','supplier_invoices','admin_announcements',
    'workshop_messages_receipts','marketplace_orders','workshop_applications'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "super_admin_full_access_%s" ON public.%I', tbl, tbl);
      EXECUTE format('CREATE POLICY "super_admin_full_access_%s" ON public.%I FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())', tbl, tbl);
    END IF;
  END LOOP;
END $b_rls$;

CREATE OR REPLACE FUNCTION public.notify_super_admin_on_pending_product()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $f_nt$
BEGIN
  IF (NEW.status::text = 'pending_approval') AND (TG_OP = 'INSERT' OR COALESCE(OLD.status::text, '') <> 'pending_approval') THEN
    BEGIN
      INSERT INTO public.admin_announcements (sender_name, recipient_type, recipient_workshop_name, title, content, created_at)
      VALUES (
        COALESCE(NEW.brand_name::text, 'ورشة حرفية'),
        'super_admin_alert',
        COALESCE(NEW.brand_name::text, 'ورشة حرفية'),
        '🛍️ طلب اعتماد قطعة جديدة: ' || COALESCE(NEW.product_name::text, 'مشغولة يدوية'),
        'رفعت ورشة "' || COALESCE(NEW.brand_name::text, 'ورشة حرفية') || '" قطعة "' || COALESCE(NEW.product_name::text, 'مشغولة') || '" بسعر ' || COALESCE(NEW.store_price, NEW.retail_price, 0)::text || ' ج.م وتنتظر الاعتماد للعرض في سوق الشمساوية.',
        now()
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$f_nt$;

DROP TRIGGER IF EXISTS trg_notify_super_admin_pending_product ON public.marketplace_products;
CREATE TRIGGER trg_notify_super_admin_pending_product
AFTER INSERT OR UPDATE ON public.marketplace_products
FOR EACH ROW EXECUTE FUNCTION public.notify_super_admin_on_pending_product();

CREATE OR REPLACE FUNCTION public.sync_catalog_product_to_marketplace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $f_sy$
DECLARE
  lr JSONB; sp JSONB; ws_brand TEXT; ws_artist TEXT; ws_phone TEXT; ws_logo TEXT; ws_slug TEXT;
  existing_status TEXT; target_status TEXT; calc_store_price NUMERIC(14,2); calc_stock NUMERIC(14,2);
BEGIN
  lr := public.safe_jsonb(NEW.local_record::text, '{}'::jsonb);
  sp := public.safe_jsonb(NEW.specs::text, '{}'::jsonb);
  IF COALESCE(NEW.is_active, true) = true
     AND LOWER(COALESCE(lr ->> 'inStore', 'true')) NOT IN ('false', '0', 'no')
     AND LOWER(COALESCE(lr ->> 'isPublishedInStore', 'true')) NOT IN ('false', '0', 'no') THEN
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
      IF existing_status = 'approved' THEN target_status := 'approved';
      ELSIF COALESCE(lr ->> 'marketplaceStatus', '') IN ('pending_approval', 'approved', 'rejected') THEN target_status := lr ->> 'marketplaceStatus';
      ELSIF existing_status IS NOT NULL THEN target_status := existing_status;
      ELSE target_status := 'pending_approval';
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
        product_name = EXCLUDED.product_name, category = EXCLUDED.category, craft_name = EXCLUDED.craft_name,
        store_price = EXCLUDED.store_price, retail_price = EXCLUDED.retail_price, wholesale_price = EXCLUDED.wholesale_price,
        cost_price = EXCLUDED.cost_price, current_stock = EXCLUDED.current_stock,
        image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), public.marketplace_products.image_url),
        store_description = COALESCE(NULLIF(EXCLUDED.store_description, ''), public.marketplace_products.store_description),
        status = CASE WHEN public.marketplace_products.status::text = 'approved' THEN 'approved' ELSE EXCLUDED.status END,
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

INSERT INTO public.marketplace_products (
  id, workshop_id, brand_name, artist_name, phone_number, logo_url, store_slug,
  product_name, category, craft_name, decor_category,
  store_price, retail_price, wholesale_price, cost_price, current_stock,
  image_url, store_description, available_colors, available_sizes, dimensions,
  materials_summary, status, created_at, updated_at
)
SELECT
  p.id::text,
  p.workshop_id::text,
  COALESCE(NULLIF(w.brand_name::text, ''), public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'brandName', 'ورشة الشمساوية'),
  COALESCE(NULLIF(w.artist_name::text, ''), public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'artistName', 'فنان الشمساوية'),
  COALESCE(NULLIF(w.phone_number::text, ''), NULLIF(w.phone::text, ''), ''),
  COALESCE(NULLIF(w.logo_data::text, ''), NULLIF(w.logo_url::text, ''), NULL),
  COALESCE(NULLIF(w.store_slug::text, ''), w.id::text, p.workshop_id::text),
  COALESCE(NULLIF(p.product_name::text, ''), 'مشغولة يدوية'),
  COALESCE(NULLIF(p.category::text, ''), 'macrame'),
  COALESCE(NULLIF(p.craft_name::text, ''), NULLIF(p.category::text, ''), 'المكرمية'),
  COALESCE(public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'decorCategory', 'all'),
  CASE WHEN COALESCE(public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'storePrice', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'storePrice')::numeric ELSE COALESCE(p.retail_price, 0) END,
  COALESCE(p.retail_price, 0),
  COALESCE(p.wholesale_price, 0),
  COALESCE(p.cost_price, 0),
  CASE WHEN COALESCE(public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'currentStock', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'currentStock')::numeric ELSE 1 END,
  COALESCE(NULLIF(p.image_url::text, ''), public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'imageUrl', '/alshams_falcon_emblem.png'),
  COALESCE(public.safe_jsonb(p.specs::text, '{}'::jsonb) ->> 'marketingDescription', public.safe_jsonb(p.specs::text, '{}'::jsonb) ->> 'materialsDescription', public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'storeDescription', ''),
  public.safe_jsonb(p.available_colors::text, '[]'::jsonb),
  public.safe_jsonb(p.available_sizes::text, '[]'::jsonb),
  public.safe_jsonb(p.dimensions::text, '{}'::jsonb),
  COALESCE(public.safe_jsonb(p.specs::text, '{}'::jsonb) ->> 'materialsDescription', ''),
  COALESCE(NULLIF(public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'marketplaceStatus', ''), 'pending_approval'),
  COALESCE(p.created_at, now()),
  now()
FROM public.products p
LEFT JOIN public.workshops w
  ON (w.id::text = p.workshop_id::text OR COALESCE(w.workshop_id::text, '') = p.workshop_id::text)
WHERE COALESCE(p.is_active, true) = true
  AND LOWER(COALESCE(public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'inStore', 'true')) NOT IN ('false', '0', 'no')
  AND LOWER(COALESCE(public.safe_jsonb(p.local_record::text, '{}'::jsonb) ->> 'isPublishedInStore', 'true')) NOT IN ('false', '0', 'no')
ON CONFLICT (id) DO NOTHING;

DO $b_rt$
DECLARE rtbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH rtbl IN ARRAY ARRAY['marketplace_products', 'products', 'admin_announcements']
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = rtbl) THEN
        BEGIN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', rtbl); EXCEPTION WHEN OTHERS THEN NULL; END;
      END IF;
    END LOOP;
  END IF;
END $b_rt$;

NOTIFY pgrst, 'reload schema';
