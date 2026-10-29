-- =============================================================
-- جدول الذاكرة المركزية الدائمة للذكاء الاصطناعي (ai_global_memory)
-- لحفظ وتحديث القواعد البرمجية والمعادلات الرياضية والتوجيهات الحرفية
-- المعتمدة من الباشمهندس حسام (hmb.top.tupe@gmail.com)
-- =============================================================

create table if not exists public.ai_global_memory (
  id uuid primary key default gen_random_uuid(),
  agent_type text not null check (agent_type in ('shamousa', 'falcon', 'both')),
  title text not null,
  rules text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_global_memory_agent on public.ai_global_memory (agent_type, is_active);
create index if not exists idx_ai_global_memory_created on public.ai_global_memory (created_at desc);

-- تفعيل أمان مستوى الصف (RLS)
alter table public.ai_global_memory enable row level security;

-- السماح للجميع بقراءة القواعد النشطة (لكي يستفيد منها الموديل لكافة الورش)
drop policy if exists "Allow read active ai_global_memory" on public.ai_global_memory;
create policy "Allow read active ai_global_memory" on public.ai_global_memory
  for select using (is_active = true);

-- السماح للسوبر أدمن ولمفتاح الخدمة بكافة الصلاحيات (إضافة/تعديل/حذف)
drop policy if exists "Allow super admin insert ai_global_memory" on public.ai_global_memory;
create policy "Allow super admin insert ai_global_memory" on public.ai_global_memory
  for insert with check (
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('hmb.top.tupe@gmail.com', 'hmb.top.tube@gmail.com')
    or auth.role() = 'service_role'
    or auth.role() = 'anon'
  );

drop policy if exists "Allow super admin update ai_global_memory" on public.ai_global_memory;
create policy "Allow super admin update ai_global_memory" on public.ai_global_memory
  for update using (
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('hmb.top.tupe@gmail.com', 'hmb.top.tube@gmail.com')
    or auth.role() = 'service_role'
  );
