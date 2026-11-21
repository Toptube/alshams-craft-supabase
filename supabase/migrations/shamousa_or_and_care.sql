-- ============================================================================
-- منظومة الشمساوية (Al-Shamsawya ERP & Multi-Vendor Craft Platform)
-- الترقية الاستراتيجية الشاملة لشخصية «شموسة» (Shamousa)
-- بحوث العمليات 360° + يومي والفضفضة + الرعاية الإنسانية + رادار السوبر أدمن
-- ============================================================================
-- تعليمات التشغيل:
-- انسخ هذا الملف بالكامل وشغّله مرة واحدة من Supabase Dashboard > SQL Editor.
-- السكريبت مصمم ليكون Idempotent (آمن للتشغيل أكثر من مرة دون كسر أي جدول قائم).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. دالة مساعدة آمنة للتحقق من صلاحية السوبر أدمن
-- ----------------------------------------------------------------------------
create or replace function public.is_shamousa_superadmin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jwt_email text;
  is_admin_profile boolean := false;
begin
  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if jwt_email in ('hmb.top.tube@gmail.com', 'hmb.top.tupe@gmail.com') then
    return true;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    execute 'select exists(select 1 from public.profiles where id = auth.uid() and lower(coalesce(role, '''')) in (''admin'', ''superadmin''))'
      into is_admin_profile;
    if is_admin_profile then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. تحديث جدول profiles (وإنشاؤه بأمان إن لم يكن موجوداً) + مزامنة workshops
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  workshop_name text,
  phone text,
  role text default 'artisan',
  last_active_at timestamptz default now(),
  fadfada_time time default '21:00:00',
  weekly_review_day text default 'friday',
  protection_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='last_active_at') then
    alter table public.profiles add column last_active_at timestamptz default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='fadfada_time') then
    alter table public.profiles add column fadfada_time time default '21:00:00';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='weekly_review_day') then
    alter table public.profiles add column weekly_review_day text default 'friday';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='protection_mode') then
    alter table public.profiles add column protection_mode boolean not null default false;
  end if;

  -- إضافة نفس الأعمدة بأمان لجدول workshops إن كان موجوداً لضمان التوافق الكامل
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='workshops') then
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='workshops' and column_name='last_active_at') then
      alter table public.workshops add column last_active_at timestamptz default now();
    end if;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='workshops' and column_name='fadfada_time') then
      alter table public.workshops add column fadfada_time time default '21:00:00';
    end if;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='workshops' and column_name='weekly_review_day') then
      alter table public.workshops add column weekly_review_day text default 'friday';
    end if;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='workshops' and column_name='protection_mode') then
      alter table public.workshops add column protection_mode boolean not null default false;
    end if;
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select on public.profiles
  for select using (id = auth.uid() or public.is_shamousa_superadmin());

drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles
  for update using (id = auth.uid() or public.is_shamousa_superadmin())
  with check (id = auth.uid() or public.is_shamousa_superadmin());

-- ----------------------------------------------------------------------------
-- دالة التحقق من ملكية tenant_id (يدعم auth.uid أو ملكية workshop)
-- ----------------------------------------------------------------------------
create or replace function public.owns_shamousa_tenant(target_tenant text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid_text text;
  owns_ws boolean := false;
begin
  if auth.uid() is null or target_tenant is null then
    return false;
  end if;
  uid_text := auth.uid()::text;
  if target_tenant = uid_text then
    return true;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workshops'
  ) then
    execute 'select exists(select 1 from public.workshops where id::text = $1 and (owner_uid::text = $2 or id::text = $2))'
      into owns_ws using target_tenant, uid_text;
    if owns_ws then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. جدول اليوميات والفضفضة اليومية (daily_journals) — معزول تماماً لكل مستخدم
-- ----------------------------------------------------------------------------
create table if not exists public.daily_journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  mood_color text not null default 'blue_calm'
    check (mood_color in ('blue_calm', 'green_flow', 'gold_solution', 'coral_friction', 'purple_care')),
  mood_score integer not null default 70 check (mood_score between 1 and 100),
  raw_text text not null,
  extracted_tags text[] not null default '{}',
  challenges text[] not null default '{}',
  sales_note text,
  ai_reply text,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_journals_tenant_date
  on public.daily_journals (tenant_id, created_at desc);

alter table public.daily_journals enable row level security;

-- خصوصية صارمة: لا يمكن حتى للسوبر أدمن قراءة raw_text الخاص بأي مستخدم
drop policy if exists daily_journals_owner_select on public.daily_journals;
create policy daily_journals_owner_select on public.daily_journals
  for select using (public.owns_shamousa_tenant(tenant_id));

drop policy if exists daily_journals_owner_insert on public.daily_journals;
create policy daily_journals_owner_insert on public.daily_journals
  for insert with check (public.owns_shamousa_tenant(tenant_id));

drop policy if exists daily_journals_owner_update on public.daily_journals;
create policy daily_journals_owner_update on public.daily_journals
  for update using (public.owns_shamousa_tenant(tenant_id))
  with check (public.owns_shamousa_tenant(tenant_id));

drop policy if exists daily_journals_owner_delete on public.daily_journals;
create policy daily_journals_owner_delete on public.daily_journals
  for delete using (public.owns_shamousa_tenant(tenant_id));

-- ----------------------------------------------------------------------------
-- 4. جدول أحداث الرعاية الإنسانية والشخصية (personal_care_events)
-- ----------------------------------------------------------------------------
create table if not exists public.personal_care_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  person_name text not null,
  event_type text not null default 'health_visit',
  event_time timestamptz not null,
  reminder_sent boolean not null default false,
  followup_sent boolean not null default false,
  notes text,
  status text not null default 'upcoming' check (status in ('upcoming', 'reminded', 'followed_up', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_personal_care_tenant_time
  on public.personal_care_events (tenant_id, event_time asc);

alter table public.personal_care_events enable row level security;

drop policy if exists personal_care_owner_all on public.personal_care_events;
create policy personal_care_owner_all on public.personal_care_events
  for all using (public.owns_shamousa_tenant(tenant_id))
  with check (public.owns_shamousa_tenant(tenant_id));

-- ----------------------------------------------------------------------------
-- 5. جدول توصيات بحوث العمليات والمبيعات والتسويق (or_recommendations)
-- ----------------------------------------------------------------------------
create table if not exists public.or_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  recommendation_type text not null
    check (recommendation_type in ('operational', 'marketing', 'crm_retarget', 'churn_diagnosis')),
  title text not null,
  description text not null,
  action_payload jsonb not null default '{}'::jsonb,
  target_customer_name text,
  target_customer_phone text,
  suggested_whatsapp_msg text,
  impact_score integer not null default 75 check (impact_score between 1 and 100),
  status text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_or_recommendations_tenant_type
  on public.or_recommendations (tenant_id, recommendation_type, status, created_at desc);

alter table public.or_recommendations enable row level security;

drop policy if exists or_recommendations_owner_all on public.or_recommendations;
create policy or_recommendations_owner_all on public.or_recommendations
  for all using (public.owns_shamousa_tenant(tenant_id))
  with check (public.owns_shamousa_tenant(tenant_id));

-- ----------------------------------------------------------------------------
-- 6. جدول بروتوكول الاستثناء الإنساني (humanitarian_alerts) — للسوبر أدمن فقط
-- ----------------------------------------------------------------------------
create table if not exists public.humanitarian_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  user_name text not null,
  workshop_name text,
  phone text,
  alert_summary text not null,
  severity text not null default 'high' check (severity in ('medium', 'high', 'critical')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_humanitarian_alerts_status_date
  on public.humanitarian_alerts (status, created_at desc);

alter table public.humanitarian_alerts enable row level security;

-- يسمح للنظام بحفظ تنبيه صامت للمستخدم المسجل فقط (بدون أي صلاحية SELECT للمستخدم العادي)
drop policy if exists humanitarian_alerts_silent_insert on public.humanitarian_alerts;
create policy humanitarian_alerts_silent_insert on public.humanitarian_alerts
  for insert with check (public.owns_shamousa_tenant(tenant_id));

-- القراءة والتحديث حصرياً للسوبر أدمن فقط
drop policy if exists humanitarian_alerts_superadmin_select on public.humanitarian_alerts;
create policy humanitarian_alerts_superadmin_select on public.humanitarian_alerts
  for select using (public.is_shamousa_superadmin());

drop policy if exists humanitarian_alerts_superadmin_update on public.humanitarian_alerts;
create policy humanitarian_alerts_superadmin_update on public.humanitarian_alerts
  for update using (public.is_shamousa_superadmin())
  with check (public.is_shamousa_superadmin());

-- ----------------------------------------------------------------------------
-- 7. دوال RPC مجهولة الهوية 100% لرادار السوق والتسويق الشامل (للسوبر أدمن فقط)
-- ----------------------------------------------------------------------------
create or replace function public.get_superadmin_market_radar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mood_distribution jsonb := '[]'::jsonb;
  top_challenges jsonb := '[]'::jsonb;
  churn_causes jsonb := '[]'::jsonb;
  category_pricing jsonb := '[]'::jsonb;
  total_journals integer := 0;
  total_recs integer := 0;
  protection_count integer := 0;
begin
  if not public.is_shamousa_superadmin() then
    raise exception 'Unauthorized: Super Admin access required';
  end if;

  select count(*) into total_journals from public.daily_journals;
  select count(*) into total_recs from public.or_recommendations;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into mood_distribution
  from (
    select mood_color, count(*)::int as total_entries, round(avg(mood_score))::int as avg_score
    from public.daily_journals
    where created_at >= now() - interval '30 days'
    group by mood_color
    order by total_entries desc
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into top_challenges
  from (
    select tag as challenge, count(*)::int as mentions
    from public.daily_journals, unnest(extracted_tags) as tag
    where created_at >= now() - interval '30 days'
    group by tag
    order by mentions desc
    limit 8
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into churn_causes
  from (
    select
      coalesce(action_payload ->> 'axis', recommendation_type) as axis,
      count(*)::int as cases_count,
      round(avg(impact_score))::int as avg_impact
    from public.or_recommendations
    where created_at >= now() - interval '45 days'
    group by coalesce(action_payload ->> 'axis', recommendation_type)
    order by cases_count desc
    limit 6
  ) t;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) then
    execute $q$
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          coalesce(nullif(craft_name, ''), nullif(category, ''), 'أشغال يدوية') as category_name,
          count(*)::int as product_count,
          round(avg(nullif(retail_price, 0)))::int as avg_retail_price,
          round(avg(nullif(cost_price, 0)))::int as avg_cost_price
        from public.products
        where is_active = true
        group by 1
        order by product_count desc
        limit 8
      ) t
    $q$ into category_pricing;
  end if;

  select count(*) into protection_count from public.profiles where protection_mode = true;

  return jsonb_build_object(
    'anonymized', true,
    'generated_at', now(),
    'summary', jsonb_build_object(
      'journals_30d', total_journals,
      'or_recommendations_total', total_recs,
      'active_protection_modes', protection_count
    ),
    'mood_distribution', mood_distribution,
    'top_challenges', top_challenges,
    'churn_causes', churn_causes,
    'category_pricing', category_pricing
  );
end;
$$;

grant execute on function public.get_superadmin_market_radar() to authenticated;
