-- ============================================================================
-- الجزء الخامس (5): صلاحيات الظهور والإخفاء المستقلة للسوبر أدمن للورش والموردين
-- ============================================================================
-- يضيف هذا الملف عمودين منفصلين لكل ورشة ولكل مورد:
-- 1. hide_storefront : إخفاء/إظهار المتجر الخاص فقط دون إيقاف الحساب الداخلي
-- 2. hide_from_market: إخفاء/إظهار معروضات الورشة أو المورد من السوق العام فقط

ALTER TABLE IF EXISTS public.workshops
  ADD COLUMN IF NOT EXISTS hide_storefront BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.workshops
  ADD COLUMN IF NOT EXISTS hide_from_market BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.platform_suppliers
  ADD COLUMN IF NOT EXISTS hide_storefront BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.platform_suppliers
  ADD COLUMN IF NOT EXISTS hide_from_market BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workshops_visibility
  ON public.workshops (hide_storefront, hide_from_market);

CREATE INDEX IF NOT EXISTS idx_platform_suppliers_visibility
  ON public.platform_suppliers (hide_storefront, hide_from_market);

NOTIFY pgrst, 'reload schema';
