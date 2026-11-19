-- ==============================================================================
-- Migration: 20261119_01_unified_materials_and_growth_academy_supabase.sql
-- منظومة الشمساوية (alSHamsawiyah) — الترحيل الشامل إلى Supabase
-- يشمل:
--   القسم (1): جداول منظومة الخامات الموحدة (الجداول الـ 4 الأساسية + 3 مساندة)
--              + أعمدة الكود الرباعي على جدول الخامات وكتالوج الموردين
--   القسم (2): الجداول الإضافية لتحديث V 5.5 (أكاديمية الخبراء والمدربين + الشراء التعاوني + إعدادات النمو)
-- آمن 100% لإعادة التشغيل (Idempotent — لا يحذف أي بيانات حالية).
-- ==============================================================================

-- ==============================================================================
-- القسم (1): جداول منظومة الخامات الموحدة (Unified Materials System)
-- ==============================================================================

-- 1.1 الأقسام الـ 12 الرئيسية (Categories)
CREATE TABLE IF NOT EXISTS public.unified_material_categories (
  prefix TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  default_unit_chain TEXT NOT NULL DEFAULT 'ل1',
  next_seq INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 جدول الماركات الموحدة (Brands: B000..B053+) [الجدول الأساسي 1 من 4]
CREATE TABLE IF NOT EXISTS public.unified_material_brands (
  brand_code TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  category_hint TEXT DEFAULT '',
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 جدول الخامات الرئيسية (Master: TH0001.. 395+ خامة) [الجدول الأساسي 2 من 4]
CREATE TABLE IF NOT EXISTS public.unified_materials_master (
  code TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  seq_num INT NOT NULL,
  canonical_name TEXT NOT NULL,
  unit_chain TEXT NOT NULL DEFAULT 'ل1',
  unit_note TEXT DEFAULT '',
  bridge_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  spec_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  artist_aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  supplier_aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_brands JSONB NOT NULL DEFAULT '[]'::jsonb,
  workshop_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety_note TEXT DEFAULT '',
  is_asset_only BOOLEAN NOT NULL DEFAULT false,
  is_added_for_equations BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived' | 'reserved_deleted'
  review_status TEXT NOT NULL DEFAULT 'approved', -- 'approved' | 'new' | 'edited'
  created_by_role TEXT NOT NULL DEFAULT 'system', -- 'system' | 'super_admin' | 'artisan' | 'supplier'
  created_by_id TEXT DEFAULT '',
  created_by_name TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_materials_prefix ON public.unified_materials_master(prefix);
CREATE INDEX IF NOT EXISTS idx_unified_materials_status ON public.unified_materials_master(status);
CREATE INDEX IF NOT EXISTS idx_unified_materials_review ON public.unified_materials_master(review_status);

-- 1.4 جدول مواصفات الخامات (Specs: TH0001.01..) [الجدول الأساسي 3 من 4]
CREATE TABLE IF NOT EXISTS public.unified_material_specs (
  spec_code TEXT PRIMARY KEY,
  master_code TEXT NOT NULL REFERENCES public.unified_materials_master(code) ON DELETE CASCADE,
  spec_index INT NOT NULL,
  label TEXT NOT NULL,
  thickness_mm NUMERIC(10,3),
  plies INT,
  size_label TEXT DEFAULT '',
  color TEXT DEFAULT '',
  origin TEXT DEFAULT '',
  bridge_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  review_status TEXT NOT NULL DEFAULT 'approved',
  created_by_role TEXT NOT NULL DEFAULT 'system',
  created_by_id TEXT DEFAULT '',
  created_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_specs_master ON public.unified_material_specs(master_code);

-- 1.5 جدول الأسماء الدارجة وفك الالتباس (Aliases: AL00001+) [الجدول الأساسي 4 من 4]
CREATE TABLE IF NOT EXISTS public.unified_material_aliases (
  alias_code TEXT PRIMARY KEY,
  target_code TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'common', -- 'artisan' | 'supplier' | 'common'
  context_hint TEXT DEFAULT '',
  is_ambiguous BOOLEAN NOT NULL DEFAULT false,
  created_by_role TEXT NOT NULL DEFAULT 'system',
  created_by_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_aliases_target ON public.unified_material_aliases(target_code);

-- 1.6 جدول إشعارات المراجعة والاعتماد للسوبر أدمن
CREATE TABLE IF NOT EXISTS public.unified_material_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'new_master' | 'new_spec' | 'new_alias' | 'member_edit_proposal' | 'member_local_remove'
  target_code TEXT NOT NULL,
  target_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT 'artisan',
  actor_id TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  reason TEXT DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted_global' | 'kept_local' | 'archived' | 'dismissed'
  resolved_by TEXT DEFAULT '',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_mat_notifs_status ON public.unified_material_notifications(status);

-- 1.7 جدول تخصيصات الأعضاء المحلية (تعديل/إخفاء على مستوى العضو فقط بدون المساس بالكتالوج العام)
CREATE TABLE IF NOT EXISTS public.member_material_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_role TEXT NOT NULL, -- 'artisan' | 'supplier'
  member_id TEXT NOT NULL,
  master_code TEXT NOT NULL,
  spec_code TEXT DEFAULT '',
  custom_name TEXT DEFAULT '',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  hide_reason TEXT DEFAULT '',
  bridge_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_role, member_id, master_code, spec_code)
);

CREATE INDEX IF NOT EXISTS idx_member_mat_custom_member ON public.member_material_customizations(member_role, member_id);

-- 1.8 ربط جداول الخامات وكتالوج الموردين بالكود الرباعي الموحد
ALTER TABLE IF EXISTS public.materials
  ADD COLUMN IF NOT EXISTS unified_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS spec_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit_chain TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bridge_values JSONB DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.supplier_catalog_items
  ADD COLUMN IF NOT EXISTS unified_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS spec_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_code TEXT DEFAULT 'B000',
  ADD COLUMN IF NOT EXISTS sku_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit_chain TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bridge_values JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- القسم (2): الجداول الإضافية لتحديث V 5.5 (أكاديمية الخبراء + أدوات النمو)
-- ==============================================================================

-- 2.1 أعمدة مستوى المهارة وتوثيق المدربين على جدول الصفحات الشخصية
ALTER TABLE IF EXISTS public.member_profiles
  ADD COLUMN IF NOT EXISTS skill_level TEXT NOT NULL DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS assessment_score INT,
  ADD COLUMN IF NOT EXISTS trainer_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trainer_post_limit INT NOT NULL DEFAULT 15;

-- 2.2 عمود إعدادات مركز التطوير والنمو على جدول إعدادات المنصة
ALTER TABLE IF EXISTS public.platform_settings
  ADD COLUMN IF NOT EXISTS growth_hub_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2.3 جدول منشورات وشروحات الخبراء والمدربين بالروابط المدمجة
CREATE TABLE IF NOT EXISTS public.trainer_embedded_posts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_role TEXT NOT NULL DEFAULT 'artisan',
  author_name TEXT NOT NULL DEFAULT '',
  author_brand TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'youtube', -- youtube | facebook | instagram | tiktok | vimeo | dailymotion | pinterest | other
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  source_url TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  thumbnail_url TEXT DEFAULT '',
  visibility_audiences JSONB NOT NULL DEFAULT '["artisan","supplier","customer"]'::jsonb,
  family_post_id TEXT DEFAULT '',
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_posts_member ON public.trainer_embedded_posts(member_id);
CREATE INDEX IF NOT EXISTS idx_trainer_posts_created ON public.trainer_embedded_posts(created_at DESC);

-- 2.4 جدول إشعارات الدروس الجديدة الموجهة لجميع الفنانين
CREATE TABLE IF NOT EXISTS public.trainer_lesson_alerts (
  id TEXT PRIMARY KEY,
  trainer_member_id TEXT NOT NULL,
  trainer_name TEXT NOT NULL DEFAULT '',
  trainer_brand TEXT NOT NULL DEFAULT '',
  post_id TEXT NOT NULL,
  family_post_id TEXT DEFAULT '',
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'youtube',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_alerts_created ON public.trainer_lesson_alerts(created_at DESC);

-- 2.5 جدول حملات الشراء التعاوني للخامات بين الورش (Group Buying)
CREATE TABLE IF NOT EXISTS public.group_buying_campaigns (
  id TEXT PRIMARY KEY,
  material_code TEXT NOT NULL DEFAULT 'CUSTOM',
  material_name TEXT NOT NULL,
  governorate TEXT NOT NULL DEFAULT 'القاهرة',
  target_qty NUMERIC(12,2) NOT NULL DEFAULT 50,
  current_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'وحدة',
  retail_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  group_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  creator_brand TEXT NOT NULL DEFAULT '',
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'reached' | 'closed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_buying_status ON public.group_buying_campaigns(status, created_at DESC);

-- ==============================================================================
-- القسم (3): سياسات الأمان Row-Level Security (RLS) وتحديث schema cache
-- ==============================================================================

ALTER TABLE public.unified_material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_materials_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_material_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_embedded_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_lesson_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buying_campaigns ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة والكتابة للخامات الموحدة
DROP POLICY IF EXISTS "unified_categories_read" ON public.unified_material_categories;
CREATE POLICY "unified_categories_read" ON public.unified_material_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "unified_brands_read" ON public.unified_material_brands;
CREATE POLICY "unified_brands_read" ON public.unified_material_brands FOR SELECT USING (true);

DROP POLICY IF EXISTS "unified_master_read" ON public.unified_materials_master;
CREATE POLICY "unified_master_read" ON public.unified_materials_master FOR SELECT USING (true);

DROP POLICY IF EXISTS "unified_master_insert_auth" ON public.unified_materials_master;
CREATE POLICY "unified_master_insert_auth" ON public.unified_materials_master FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "unified_specs_read" ON public.unified_material_specs;
CREATE POLICY "unified_specs_read" ON public.unified_material_specs FOR SELECT USING (true);

DROP POLICY IF EXISTS "unified_specs_insert_auth" ON public.unified_material_specs;
CREATE POLICY "unified_specs_insert_auth" ON public.unified_material_specs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "unified_aliases_read" ON public.unified_material_aliases;
CREATE POLICY "unified_aliases_read" ON public.unified_material_aliases FOR SELECT USING (true);

DROP POLICY IF EXISTS "unified_aliases_insert_auth" ON public.unified_material_aliases;
CREATE POLICY "unified_aliases_insert_auth" ON public.unified_material_aliases FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "unified_notifs_insert_auth" ON public.unified_material_notifications;
CREATE POLICY "unified_notifs_insert_auth" ON public.unified_material_notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "member_custom_all_auth" ON public.member_material_customizations;
CREATE POLICY "member_custom_all_auth" ON public.member_material_customizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- سياسات أكاديمية الخبراء والشراء التعاوني
DROP POLICY IF EXISTS "trainer_posts_read" ON public.trainer_embedded_posts;
CREATE POLICY "trainer_posts_read" ON public.trainer_embedded_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "trainer_posts_write_auth" ON public.trainer_embedded_posts;
CREATE POLICY "trainer_posts_write_auth" ON public.trainer_embedded_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trainer_alerts_read_auth" ON public.trainer_lesson_alerts;
CREATE POLICY "trainer_alerts_read_auth" ON public.trainer_lesson_alerts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "group_buying_read_auth" ON public.group_buying_campaigns;
CREATE POLICY "group_buying_read_auth" ON public.group_buying_campaigns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "group_buying_write_auth" ON public.group_buying_campaigns;
CREATE POLICY "group_buying_write_auth" ON public.group_buying_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- تحديث كاش PostgREST فوراً للتعرف على الجداول الجديدة
NOTIFY pgrst, 'reload schema';
