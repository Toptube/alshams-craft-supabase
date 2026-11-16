-- ============================================================================
-- الجزء السادس (6): الملف الشخصي الموحد للفنان والمورد + معرض 6 منشورات + أذونات الظهور
-- + دعم دور المورد في مجتمع عيلة الشمساوية + توسيع حالات طلب التوريد
-- آمن 100% للتشغيل المتكرر (Idempotent) بدون مساس بأي بيانات حالية
-- ============================================================================

-- 1. جدول الملف الشخصي الموحد للأعضاء (فنان ورشة أو مورد خامات)
CREATE TABLE IF NOT EXISTS public.member_profiles (
  member_id TEXT PRIMARY KEY,
  owner_uid TEXT,
  email TEXT,
  account_role TEXT NOT NULL DEFAULT 'artisan'
    CHECK (account_role IN ('artisan', 'supplier', 'superadmin')),
  display_name TEXT NOT NULL DEFAULT '',
  brand_name TEXT NOT NULL DEFAULT '',
  family_nickname TEXT DEFAULT '',
  personal_avatar TEXT,
  brand_logo TEXT,
  bio_headline TEXT DEFAULT '',
  story_text TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  country TEXT DEFAULT 'مصر',
  governorate TEXT DEFAULT '',
  store_slug TEXT DEFAULT '',
  crafts_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  showcase_posts JSONB NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT chk_member_profiles_max_6_showcase
    CHECK (jsonb_typeof(showcase_posts) = 'array' AND jsonb_array_length(showcase_posts) <= 6),
  profile_visibility JSONB NOT NULL DEFAULT '{
    "personalAvatar": {"artisans": true, "suppliers": true, "customers": true},
    "story": {"artisans": true, "suppliers": true, "customers": true},
    "contact": {"artisans": true, "suppliers": true, "customers": true},
    "showcase": {"artisans": true, "suppliers": true, "customers": true},
    "storeLink": {"artisans": true, "suppliers": true, "customers": true},
    "location": {"artisans": true, "suppliers": true, "customers": true}
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_profiles_owner_uid ON public.member_profiles(owner_uid);
CREATE INDEX IF NOT EXISTS idx_member_profiles_email ON public.member_profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_member_profiles_role ON public.member_profiles(account_role);

-- 2. توسيع جداول مجتمع عيلة الشمساوية لحفظ صفة المشارك (فنان / مورد / سوبر أدمن)
ALTER TABLE IF EXISTS public.family_posts
  ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT 'artisan';

ALTER TABLE IF EXISTS public.family_comments
  ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT 'artisan';

ALTER TABLE IF EXISTS public.family_chat_messages
  ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT 'artisan';

-- 3. توسيع قيد حالات طلبات التوريد (b2b_supply_orders) لدعم (preparing / received) بشكل كامل
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'b2b_supply_orders'
  ) THEN
    ALTER TABLE public.b2b_supply_orders DROP CONSTRAINT IF EXISTS b2b_supply_orders_status_check;
    ALTER TABLE public.b2b_supply_orders
      ADD CONSTRAINT b2b_supply_orders_status_check
      CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'received', 'cancelled'));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. تفعيل RLS وسياسات الأمان لجدول member_profiles
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_profiles_public_read" ON public.member_profiles;
CREATE POLICY "member_profiles_public_read" ON public.member_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "member_profiles_owner_write" ON public.member_profiles;
CREATE POLICY "member_profiles_owner_write" ON public.member_profiles
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR COALESCE(owner_uid::text, '') = COALESCE(auth.uid()::text, '__none__')
    OR (COALESCE(auth.jwt() ->> 'email', '') <> '' AND LOWER(COALESCE(email::text, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  )
  WITH CHECK (
    public.is_super_admin()
    OR COALESCE(owner_uid::text, '') = COALESCE(auth.uid()::text, '__none__')
    OR (COALESCE(auth.jwt() ->> 'email', '') <> '' AND LOWER(COALESCE(email::text, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  );

GRANT ALL ON public.member_profiles TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
