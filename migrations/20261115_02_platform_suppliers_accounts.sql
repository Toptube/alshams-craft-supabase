-- ============================================================================
-- الجزء الثاني (2 من 4): جدول حسابات ومتاجر موردي الخامات المستقل (platform_suppliers)
-- مستقل تماماً عن جدول دفتر موردي الورشة (suppliers) لمنع أي تضارب في البيانات
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_suppliers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female')),
  phone TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'مصر',
  governorate TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'EGP',
  currency_symbol TEXT NOT NULL DEFAULT 'ج.م',
  store_slug TEXT UNIQUE,
  logo_url TEXT DEFAULT '/alshams_falcon_emblem.png',
  business_types JSONB NOT NULL DEFAULT '["online"]'::jsonb,
  pricing_modes JSONB NOT NULL DEFAULT '["retail"]'::jsonb,
  supply_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  supplied_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  store_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'banned')),
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  suspension_reason TEXT,
  suspension_duration TEXT,
  suspended_until TIMESTAMPTZ,
  appeal_status TEXT DEFAULT 'none' CHECK (appeal_status IN ('none', 'pending', 'under_review', 'accepted', 'rejected')),
  appeal_message TEXT,
  rejection_reason TEXT,
  appeal_submitted_at TIMESTAMPTZ,
  medal TEXT DEFAULT 'trusted',
  rating_stars NUMERIC(2,1) DEFAULT 5.0 CHECK (rating_stars >= 0 AND rating_stars <= 5),
  featured_rank INTEGER DEFAULT 0,
  terms_accepted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_suppliers_owner_uid ON public.platform_suppliers(owner_uid);
CREATE INDEX IF NOT EXISTS idx_platform_suppliers_email ON public.platform_suppliers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_platform_suppliers_status ON public.platform_suppliers(status);
CREATE INDEX IF NOT EXISTS idx_platform_suppliers_slug ON public.platform_suppliers(store_slug);

NOTIFY pgrst, 'reload schema';
