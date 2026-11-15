-- ============================================================================
-- الجزء الرابع (4 من 4): سياسات الأمان والعزل (RLS) + دالة التسميع الآلي الذرية + Realtime
-- ============================================================================

-- 1. دوال مساعدة للتحقق من ملكية المورد وصلاحية السوبر أدمن
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $fn_sa$
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'hmb.top.tube@gmail.com';
$fn_sa$;

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

CREATE OR REPLACE FUNCTION public.is_supplier_owner(target_supplier_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $fn_so$
  SELECT (target_supplier_id IS NOT NULL) AND EXISTS (
    SELECT 1 FROM public.platform_suppliers ps
    WHERE ps.id::text = target_supplier_id::text
      AND (
        ps.owner_uid::text = COALESCE(auth.uid()::text, '__none__')
        OR (COALESCE(auth.jwt() ->> 'email', '') <> '' AND LOWER(ps.email) = LOWER(auth.jwt() ->> 'email'))
      )
  );
$fn_so$;

-- 2. تفعيل Row-Level Security على جميع الجداول الجديدة
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_treasuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_reviews_appeals ENABLE ROW LEVEL SECURITY;

-- سياسات platform_settings (القراءة متاحة لصفحة الهبوط والسوق، التعديل للسوبر أدمن فقط)
DROP POLICY IF EXISTS "platform_settings_public_read" ON public.platform_settings;
CREATE POLICY "platform_settings_public_read" ON public.platform_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "platform_settings_admin_write" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- سياسات platform_suppliers
DROP POLICY IF EXISTS "platform_suppliers_public_read" ON public.platform_suppliers;
CREATE POLICY "platform_suppliers_public_read" ON public.platform_suppliers
  FOR SELECT USING (status <> 'banned' OR public.is_super_admin() OR public.is_supplier_owner(id));

DROP POLICY IF EXISTS "platform_suppliers_owner_write" ON public.platform_suppliers;
CREATE POLICY "platform_suppliers_owner_write" ON public.platform_suppliers
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR owner_uid::text = COALESCE(auth.uid()::text, '__none__'))
  WITH CHECK (public.is_super_admin() OR owner_uid::text = COALESCE(auth.uid()::text, '__none__'));

-- سياسات supplier_catalog_items
DROP POLICY IF EXISTS "supplier_catalog_read" ON public.supplier_catalog_items;
CREATE POLICY "supplier_catalog_read" ON public.supplier_catalog_items
  FOR SELECT USING ((is_approved = true AND (in_store = true OR in_market = true)) OR public.is_super_admin() OR public.is_supplier_owner(supplier_id));

DROP POLICY IF EXISTS "supplier_catalog_write" ON public.supplier_catalog_items;
CREATE POLICY "supplier_catalog_write" ON public.supplier_catalog_items
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_supplier_owner(supplier_id))
  WITH CHECK (public.is_super_admin() OR public.is_supplier_owner(supplier_id));

-- سياسات b2b_supply_orders (يرى الطلب المورد البائع، الورشة المشترية، أو السوبر أدمن فقط)
DROP POLICY IF EXISTS "b2b_orders_party_access" ON public.b2b_supply_orders;
CREATE POLICY "b2b_orders_party_access" ON public.b2b_supply_orders
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_supplier_owner(supplier_id)
    OR (workshop_id IS NOT NULL AND public.is_workshop_owner(workshop_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_supplier_owner(supplier_id)
    OR (workshop_id IS NOT NULL AND public.is_workshop_owner(workshop_id))
  );

-- سياسات عزل جداول المورد الداخلية (عملاء / خزائن / حركات / مصروفات المورد)
DROP POLICY IF EXISTS "supplier_customers_isolated" ON public.supplier_customers;
CREATE POLICY "supplier_customers_isolated" ON public.supplier_customers
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_supplier_owner(supplier_id))
  WITH CHECK (public.is_super_admin() OR public.is_supplier_owner(supplier_id));

DROP POLICY IF EXISTS "supplier_treasuries_isolated" ON public.supplier_treasuries;
CREATE POLICY "supplier_treasuries_isolated" ON public.supplier_treasuries
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_supplier_owner(supplier_id))
  WITH CHECK (public.is_super_admin() OR public.is_supplier_owner(supplier_id));

DROP POLICY IF EXISTS "supplier_tx_isolated" ON public.supplier_treasury_transactions;
CREATE POLICY "supplier_tx_isolated" ON public.supplier_treasury_transactions
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_supplier_owner(supplier_id))
  WITH CHECK (public.is_super_admin() OR public.is_supplier_owner(supplier_id));

DROP POLICY IF EXISTS "supplier_expenses_isolated" ON public.supplier_expenses;
CREATE POLICY "supplier_expenses_isolated" ON public.supplier_expenses
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_supplier_owner(supplier_id))
  WITH CHECK (public.is_super_admin() OR public.is_supplier_owner(supplier_id));

DROP POLICY IF EXISTS "supplier_reviews_appeals_access" ON public.supplier_reviews_appeals;
CREATE POLICY "supplier_reviews_appeals_access" ON public.supplier_reviews_appeals
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_supplier_owner(supplier_id) OR (workshop_id IS NOT NULL AND public.is_workshop_owner(workshop_id)))
  WITH CHECK (public.is_super_admin() OR public.is_supplier_owner(supplier_id) OR (workshop_id IS NOT NULL AND public.is_workshop_owner(workshop_id)));

-- 3. الدالة الذرية للتسميع الآلي المزدوج (اعتماد الاستلام بين الورشة والمورد مرة واحدة فقط)
CREATE OR REPLACE FUNCTION public.receive_b2b_supply_order(
  p_order_id TEXT,
  p_workshop_treasury_id TEXT DEFAULT NULL,
  p_paid_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_recv$
DECLARE
  v_order public.b2b_supply_orders%ROWTYPE;
  v_item JSONB;
  v_qty NUMERIC(14,3);
  v_unit_price NUMERIC(14,2);
  v_mat_id TEXT;
  v_sup_item_id TEXT;
  v_old_stock NUMERIC(14,3);
  v_old_cost NUMERIC(14,2);
  v_new_stock NUMERIC(14,3);
  v_weighted_cost NUMERIC(14,2);
  v_effective_paid NUMERIC(14,2);
  v_ws_name TEXT;
  v_ws_phone TEXT;
  v_ws_country TEXT;
  v_sup_treasury_id TEXT;
BEGIN
  -- قفل الصف منعاً لتكرار التنفيذ عند النقر السريع
  SELECT * INTO v_order
  FROM public.b2b_supply_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'طلب التوريد غير موجود');
  END IF;

  IF NOT (public.is_super_admin() OR public.is_workshop_owner(v_order.workshop_id) OR public.is_supplier_owner(v_order.supplier_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'صلاحيات غير كافية لاعتماد هذا الطلب');
  END IF;

  -- قفل عدم التكرار (Idempotency Check)
  IF v_order.inventory_synced_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_synced', true, 'order_id', v_order.id);
  END IF;

  v_effective_paid := COALESCE(p_paid_amount, v_order.paid_amount, v_order.final_total);

  -- 1) تحديث مخزن الورشة + خصم مخزن المورد لكل بند
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb))
  LOOP
    v_sup_item_id := COALESCE(v_item ->> 'catalogItemId', v_item ->> 'id');
    v_qty := GREATEST(0, COALESCE((v_item ->> 'quantity')::numeric, 0));
    v_unit_price := GREATEST(0, COALESCE((v_item ->> 'unitPrice')::numeric, 0));

    -- خصم من مخزن المورد بأمان
    IF v_sup_item_id IS NOT NULL AND v_qty > 0 THEN
      UPDATE public.supplier_catalog_items
      SET stock_qty = GREATEST(0, stock_qty - v_qty),
          updated_at = now()
      WHERE id = v_sup_item_id AND supplier_id = v_order.supplier_id;
    END IF;

    -- إضافة أو تحديث رصيد الخامة في مخزن الورشة بالمتوسط المرجح
    IF v_order.workshop_id IS NOT NULL AND v_qty > 0 THEN
      SELECT id, COALESCE(current_stock, 0), COALESCE(weighted_avg_cost, purchase_price, 0)
      INTO v_mat_id, v_old_stock, v_old_cost
      FROM public.materials
      WHERE workshop_id = v_order.workshop_id
        AND (catalog_item_id = v_sup_item_id OR LOWER(BTRIM(name)) = LOWER(BTRIM(COALESCE(v_item ->> 'name', ''))))
      LIMIT 1;

      v_new_stock := COALESCE(v_old_stock, 0) + v_qty;
      IF v_new_stock > 0 THEN
        v_weighted_cost := ROUND(((COALESCE(v_old_stock, 0) * COALESCE(v_old_cost, v_unit_price)) + (v_qty * v_unit_price)) / v_new_stock, 2);
      ELSE
        v_weighted_cost := v_unit_price;
      END IF;

      IF v_mat_id IS NOT NULL THEN
        UPDATE public.materials
        SET current_stock = v_new_stock,
            purchase_price = v_weighted_cost,
            weighted_avg_cost = v_weighted_cost,
            last_supplier_id = v_order.supplier_id,
            catalog_item_id = COALESCE(catalog_item_id, v_sup_item_id)
        WHERE id = v_mat_id;
      ELSE
        INSERT INTO public.materials (
          id, workshop_id, name, kind, unit_id, purchase_price, weighted_avg_cost, current_stock,
          last_supplier_id, catalog_item_id
        ) VALUES (
          gen_random_uuid()::text,
          v_order.workshop_id,
          COALESCE(v_item ->> 'name', 'خامة موردة'),
          'primary',
          COALESCE(v_item ->> 'unit', 'unit'),
          v_unit_price,
          v_unit_price,
          v_qty,
          v_order.supplier_id,
          v_sup_item_id
        );
      END IF;
    END IF;
  END LOOP;

  -- 2) تسجيل الورشة في جدول عملاء المورد وتحديث رصيدها
  IF v_order.workshop_id IS NOT NULL THEN
    SELECT brand_name, phone_number, country
    INTO v_ws_name, v_ws_phone, v_ws_country
    FROM public.workshops
    WHERE id::text = v_order.workshop_id::text OR COALESCE(workshop_id::text, '') = v_order.workshop_id::text
    LIMIT 1;

    INSERT INTO public.supplier_customers (
      id, supplier_id, workshop_id, name, phone, country, source_type, total_purchases, balance_due, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text,
      v_order.supplier_id,
      v_order.workshop_id,
      COALESCE(v_ws_name, 'ورشة بالمنظومة'),
      COALESCE(v_ws_phone, ''),
      COALESCE(v_ws_country, 'مصر'),
      CASE WHEN v_order.order_source = 'direct_supplier_store' THEN 'direct_store' ELSE 'suppliers_market' END,
      v_order.final_total,
      GREATEST(0, v_order.final_total - v_effective_paid),
      now(),
      now()
    )
    ON CONFLICT (supplier_id, workshop_id) WHERE workshop_id IS NOT NULL
    DO UPDATE SET
      total_purchases = public.supplier_customers.total_purchases + EXCLUDED.total_purchases,
      balance_due = public.supplier_customers.balance_due + EXCLUDED.balance_due,
      updated_at = now();
  END IF;

  -- 3) قيد الإيراد في خزينة المورد الافتراضية أو المحددة (مرة واحدة فقط)
  SELECT id INTO v_sup_treasury_id
  FROM public.supplier_treasuries
  WHERE supplier_id = v_order.supplier_id
  ORDER BY CASE WHEN id = v_order.supplier_treasury_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  IF v_sup_treasury_id IS NULL THEN
    v_sup_treasury_id := gen_random_uuid()::text;
    INSERT INTO public.supplier_treasuries (id, supplier_id, name, channel_type, balance)
    VALUES (v_sup_treasury_id, v_order.supplier_id, 'الخزينة الرئيسية', 'cash', 0);
  END IF;

  IF v_effective_paid > 0 THEN
    INSERT INTO public.supplier_treasury_transactions (
      id, supplier_id, treasury_id, b2b_order_id, tx_type, amount, description
    ) VALUES (
      gen_random_uuid()::text,
      v_order.supplier_id,
      v_sup_treasury_id,
      v_order.id,
      'income',
      v_effective_paid,
      'تحصيل طلب توريد رقم ' || v_order.order_number
    )
    ON CONFLICT (b2b_order_id, tx_type) WHERE b2b_order_id IS NOT NULL DO NOTHING;

    UPDATE public.supplier_treasuries
    SET balance = balance + v_effective_paid, updated_at = now()
    WHERE id = v_sup_treasury_id;
  END IF;

  -- 4) ختم الطلب كمُرحّل ومكتمل لمنع أي تكرار لاحق
  UPDATE public.b2b_supply_orders
  SET status = 'delivered',
      paid_amount = v_effective_paid,
      remaining_amount = GREATEST(0, final_total - v_effective_paid),
      payment_method = COALESCE(p_payment_method, payment_method),
      workshop_treasury_id = COALESCE(p_workshop_treasury_id, workshop_treasury_id),
      supplier_treasury_id = v_sup_treasury_id,
      workshop_approved_at = now(),
      inventory_synced_at = now(),
      financial_posted_at = now(),
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'already_synced', false,
    'order_id', v_order.id,
    'supplier_treasury_id', v_sup_treasury_id
  );
END;
$fn_recv$;

-- 4. تفعيل المزامنة اللحظية للجداول الجديدة
DO $b_rt2$
DECLARE rtbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH rtbl IN ARRAY ARRAY[
      'platform_settings',
      'platform_suppliers',
      'supplier_catalog_items',
      'b2b_supply_orders'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = rtbl
      ) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', rtbl);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END LOOP;
  END IF;
END $b_rt2$;

NOTIFY pgrst, 'reload schema';
