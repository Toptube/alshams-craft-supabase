-- =============================================================
-- جدول المنتجات السحابي لمساعدة البيانات "شموسة"
-- الهدف: نقل أرشيف المنتجات من IndexedDB (متصفح المستخدم فقط)
-- إلى Supabase، بحيث يقدر الشات بوت يبحث فيه من السيرفر.
-- شغّله مرة واحدة من Supabase Dashboard > SQL Editor
-- =============================================================

-- ملاحظة: لو workshops.id نوعه text بدل uuid غيّر workshop_id لـ text
create table if not exists public.products (
  id               text primary key,                 -- نفس id المستخدم في Dexie
  workshop_id      uuid not null references public.workshops(id) on delete cascade,
  product_name     text not null,
  product_code     text,
  serial_number    integer,
  category         text,
  product_type     text,
  craft_name       text,
  main_section     text,
  cost_price       numeric(12,2) default 0,
  retail_price     numeric(12,2) default 0,
  wholesale_price  numeric(12,2) default 0,
  -- الخامات المستخدمة في المنتج: [{name, unit, quantity, unitPrice, totalCost}]
  materials_used   jsonb not null default '[]'::jsonb,
  -- الأبعاد والوزن والملاحظات (من CalculationInput / Output)
  specs            jsonb not null default '{}'::jsonb,
  image_url        text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists products_workshop_idx on public.products (workshop_id, is_active);

alter table public.products enable row level security;

-- الصلاحية مرتبطة بصلاحية قراءة الورشة نفسها:
-- المستخدم يشوف/يعدّل منتجات الورش اللي سياسة RLS على workshops بتسمحله يشوفها بس.
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (workshop_id in (select id from public.workshops));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert with check (workshop_id in (select id from public.workshops));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update using (workshop_id in (select id from public.workshops))
  with check (workshop_id in (select id from public.workshops));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete using (workshop_id in (select id from public.workshops));

-- =============================================================
-- (اختياري) حفظ محادثات شموسة في القاعدة بدل ذاكرة السيرفر
-- =============================================================
create table if not exists public.ai_chat_messages (
  id           bigserial primary key,
  workshop_id  uuid not null references public.workshops(id) on delete cascade,
  sender       text not null check (sender in ('user','falcon')),
  text         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists ai_chat_ws_idx on public.ai_chat_messages (workshop_id, created_at desc);
alter table public.ai_chat_messages enable row level security;
drop policy if exists ai_chat_rw on public.ai_chat_messages;
create policy ai_chat_rw on public.ai_chat_messages
  for all using (workshop_id in (select id from public.workshops))
  with check (workshop_id in (select id from public.workshops));
