-- ============================================================================
-- منظومة الشمساوية الحرفية - سكريبت البنية السحابية الشاملة لـ Supabase SQL Editor
-- شغّل هذا السكريبت كاملاً بنقرة واحدة داخل Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. جدول المعروضات المركزية ومتاجر الحرفيين (marketplace_products)
create table if not exists public.marketplace_products (
  id                  text primary key,
  workshop_id         text not null,
  brand_name          text not null,
  artist_name         text not null,
  phone_number        text default '',
  product_name        text not null,
  category            text default 'macrame',
  craft_name          text default 'المكرمية والنسيج',
  decor_category      text default 'all',
  store_price         numeric(12,2) not null default 0,
  retail_price        numeric(12,2) default 0,
  wholesale_price     numeric(12,2) default 0,
  cost_price          numeric(12,2) default 0,
  current_stock       integer default 1,
  image_url           text default '/alshams_falcon_emblem.png',
  store_description   text default '',
  available_colors    jsonb default '[]'::jsonb,
  available_sizes     jsonb default '[]'::jsonb,
  dimensions          jsonb default '{}'::jsonb,
  materials_summary   text default '',
  status              text default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected')),
  rejection_reason    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_marketplace_products_workshop on public.marketplace_products (workshop_id);
create index if not exists idx_marketplace_products_status on public.marketplace_products (status);

-- 2. جدول طلبات الشراء والمبيعات المركزية (marketplace_orders)
create table if not exists public.marketplace_orders (
  id                  text primary key,
  order_number        text not null,
  workshop_id         text not null,
  customer_name       text not null,
  customer_phone      text not null,
  customer_address    text not null,
  governorate         text default 'القاهرة',
  items               jsonb not null default '[]'::jsonb,
  subtotal            numeric(12,2) not null default 0,
  shipping_fee        numeric(12,2) not null default 0,
  total_amount        numeric(12,2) not null default 0,
  deposit_paid        numeric(12,2) not null default 0,
  remaining_amount    numeric(12,2) not null default 0,
  payment_method      text default 'cash_on_delivery',
  status              text default 'pending' check (status in ('pending', 'confirmed', 'in_progress', 'ready_for_shipping', 'shipped', 'delivered', 'cancelled')),
  notes               text default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_marketplace_orders_workshop on public.marketplace_orders (workshop_id);
create index if not exists idx_marketplace_orders_status on public.marketplace_orders (status);

-- 3. جدول طلبات الانضمام واعتماد الورش الجديدة (workshop_applications)
create table if not exists public.workshop_applications (
  id                  text primary key,
  brand_name          text not null,
  artist_name         text not null,
  phone_number        text not null,
  email               text not null,
  craft_type          text not null,
  city                text default 'القاهرة',
  portfolio_links     text default '',
  sample_photos       jsonb default '[]'::jsonb,
  status              text default 'pending' check (status in ('pending', 'under_review', 'approved', 'rejected')),
  review_notes        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_workshop_applications_status on public.workshop_applications (status);

-- 4. التأكد من هيكل جدول الورش الحرفية (workshops)
create table if not exists public.workshops (
  id                  text primary key,
  workshop_id         text,
  owner_uid           text,
  brand_name          text not null,
  artist_name         text not null,
  email               text,
  phone_number        text,
  country             text default 'مصر',
  currency            text default 'EGP',
  currency_symbol     text default 'ج.م',
  selected_crafts     jsonb default '["macrame"]'::jsonb,
  default_vat_percent numeric(5,2) default 14,
  role                text default 'artisan',
  status              text default 'active' check (status in ('active', 'suspended', 'banned')),
  is_frozen           boolean default false,
  suspension_reason   text,
  suspension_duration text,
  suspended_until     timestamptz,
  appeal_status       text default 'none' check (appeal_status in ('none', 'pending', 'under_review', 'accepted', 'rejected')),
  appeal_message      text,
  rejection_reason    text,
  appeal_submitted_at timestamptz,
  rating_stars        integer default 5,
  medal               text default 'gold',
  medal_awarded_at    timestamptz,
  medal_note          text,
  logo_url            text default '/alshams_falcon_emblem.png',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- 5. جدول الحسابات العامة (profiles)
create table if not exists public.profiles (
  id                  text primary key,
  email               text,
  brand_name          text,
  artist_name         text,
  full_name           text,
  phone_number        text,
  role                text default 'artisan',
  workshop_id         text,
  country             text default 'مصر',
  currency            text default 'EGP',
  currency_symbol     text default 'ج.م',
  status              text default 'active',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================================================
-- 6. منح الصلاحيات وتفعيل أمان Row-Level Security (RLS) وسياسات القراءة العامة
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- تفعيل RLS مع سياسات وصول متوازنة للمتجر العام
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.workshop_applications enable row level security;
alter table public.workshops enable row level security;
alter table public.profiles enable row level security;

-- سياسات marketplace_products
drop policy if exists "Public marketplace products read" on public.marketplace_products;
create policy "Public marketplace products read" on public.marketplace_products
  for select using (true);

drop policy if exists "Artisans & Admins manage products" on public.marketplace_products;
create policy "Artisans & Admins manage products" on public.marketplace_products
  for all using (true) with check (true);

-- سياسات marketplace_orders
drop policy if exists "Public can insert orders" on public.marketplace_orders;
create policy "Public can insert orders" on public.marketplace_orders
  for insert with check (true);

drop policy if exists "Admins and workshops can read orders" on public.marketplace_orders;
create policy "Admins and workshops can read orders" on public.marketplace_orders
  for select using (true);

drop policy if exists "Admins can update orders" on public.marketplace_orders;
create policy "Admins can update orders" on public.marketplace_orders
  for update using (true) with check (true);

-- سياسات workshop_applications
drop policy if exists "Public can apply" on public.workshop_applications;
create policy "Public can apply" on public.workshop_applications
  for insert with check (true);

drop policy if exists "Admins can manage applications" on public.workshop_applications;
create policy "Admins can manage applications" on public.workshop_applications
  for all using (true) with check (true);

-- سياسات workshops
drop policy if exists "Public can read workshops" on public.workshops;
create policy "Public can read workshops" on public.workshops
  for select using (true);

drop policy if exists "Manage workshops" on public.workshops;
create policy "Manage workshops" on public.workshops
  for all using (true) with check (true);

-- سياسات profiles
drop policy if exists "Profiles read" on public.profiles;
create policy "Profiles read" on public.profiles
  for select using (true);

drop policy if exists "Profiles manage" on public.profiles;
create policy "Profiles manage" on public.profiles
  for all using (true) with check (true);
