-- ==============================================================================
-- Migration: Unified Materials System (منظومة الخامات الموحدة - alSHamsawiyah)
-- 4-Level Coding Hierarchy:
--   1) Category Prefix (2 letters: TH, BD, CL, WD, LT, MT, DC, AR, PK, PP, GL, AX)
--   2) Master Item (Prefix + 4 digits: TH0001) - non-reusable sequence
--   3) Spec (Master + . + 2 digits: TH0001.01) - Artisan & Recipe level + Bridge fields
--   4) Commercial SKU (Spec + # + BrandCode: TH0008.02#B003) - Supplier & Price level
--   + Aliases (AL00001+), Brands (B000..B053+), Notifications & Member Customizations
-- 100% Idempotent — Safe to run multiple times in Supabase SQL Editor.
-- ==============================================================================

-- 1. Categories (12 Prefixes)
CREATE TABLE IF NOT EXISTS public.unified_material_categories (
  prefix TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  default_unit_chain TEXT NOT NULL DEFAULT 'ل1',
  next_seq INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Brands Registry (B000..B053+)
CREATE TABLE IF NOT EXISTS public.unified_material_brands (
  brand_code TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  category_hint TEXT DEFAULT '',
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Master Materials (TH0001..)
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

-- 4. Material Specs (TH0001.01..)
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

-- 5. Material Aliases (AL00001..)
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

-- 6. Super Admin Change & Review Notifications
CREATE TABLE IF NOT EXISTS public.unified_material_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'new_master' | 'new_spec' | 'new_alias' | 'member_edit_proposal' | 'member_local_remove'
  target_code TEXT NOT NULL,
  target_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT 'artisan', -- 'artisan' | 'supplier' | 'super_admin'
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

-- 7. Per-Member Customizations (Local Edits & Local Removals without affecting global catalog)
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

-- 8. Extend Workshop Materials & Supplier Catalog Items with Unified Coding Links
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

-- 9. Row-Level Security Policies
ALTER TABLE public.unified_material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_materials_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_material_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_material_customizations ENABLE ROW LEVEL SECURITY;

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

NOTIFY pgrst, 'reload schema';
