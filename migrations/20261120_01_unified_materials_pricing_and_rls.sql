-- ==============================================================================
-- Migration: 20261120_01_unified_materials_pricing_and_rls.sql
-- منظومة الشمساوية (alSHamsawiyah) — تحديث التسعير المرجعي وأسعار الماركات وصلاحيات RLS
-- آمن 100% لإعادة التشغيل (Idempotent — لا يحذف أي بيانات موجودة).
-- ==============================================================================

-- 1. إضافة أعمدة التسعير المرجعي وأسعار الماركات مباشرةً على جدول الخامات الموحدة الرئيسي
ALTER TABLE IF EXISTS public.unified_materials_master
  ADD COLUMN IF NOT EXISTS market_base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT 'seeded_market',
  ADD COLUMN IF NOT EXISTS price_last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_observations_count INT NOT NULL DEFAULT 0;

-- 2. فهرس سريع لحساب متوسطات أسعار السوق الدورية من أرصاد الفنانين والموردين
CREATE INDEX IF NOT EXISTS idx_member_mat_custom_master_spec
  ON public.member_material_customizations(master_code, spec_code);

CREATE INDEX IF NOT EXISTS idx_unified_mat_notifs_created
  ON public.unified_material_notifications(created_at DESC);

-- 3. استكمال سياسات الأمان (RLS) للمستخدمين الموثّقين على جداول الخامات الموحدة السبعة
--    بحيث يتم الحفظ والمزامنة والتعديل والاعتماد تلقائياً بدون أي أخطاء صلاحيات (42501)

DROP POLICY IF EXISTS "unified_categories_write_auth" ON public.unified_material_categories;
CREATE POLICY "unified_categories_write_auth"
  ON public.unified_material_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "unified_brands_write_auth" ON public.unified_material_brands;
CREATE POLICY "unified_brands_write_auth"
  ON public.unified_material_brands FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "unified_master_update_auth" ON public.unified_materials_master;
CREATE POLICY "unified_master_update_auth"
  ON public.unified_materials_master FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "unified_specs_update_auth" ON public.unified_material_specs;
CREATE POLICY "unified_specs_update_auth"
  ON public.unified_material_specs FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "unified_aliases_update_auth" ON public.unified_material_aliases;
CREATE POLICY "unified_aliases_update_auth"
  ON public.unified_material_aliases FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "unified_notifs_read_auth" ON public.unified_material_notifications;
CREATE POLICY "unified_notifs_read_auth"
  ON public.unified_material_notifications FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "unified_notifs_update_auth" ON public.unified_material_notifications;
CREATE POLICY "unified_notifs_update_auth"
  ON public.unified_material_notifications FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "unified_notifs_delete_auth" ON public.unified_material_notifications;
CREATE POLICY "unified_notifs_delete_auth"
  ON public.unified_material_notifications FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "member_custom_all_auth" ON public.member_material_customizations;
CREATE POLICY "member_custom_all_auth"
  ON public.member_material_customizations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4. تحديث كاش PostgREST فوراً للتعرف على الأعمدة والسياسات الجديدة
NOTIFY pgrst, 'reload schema';
