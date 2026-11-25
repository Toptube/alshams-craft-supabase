-- ============================================================================
-- المخزن المعرفي الدائم لشموسة + طابور الأسئلة غير المفهومة المنقّى من البيانات الشخصية
-- (الرسالة 6 من 7 — الجزء E)
-- ملاحظة: السيرفر يحفظ أيضاً فوراً في جدول ai_global_memory القائم (agent_type = 'shamousa')
-- كضمان استمرارية فورية بدون انتظار تشغيل هذا الملف، ويمكن تشغيله لاحقاً لجداول منفصلة.
-- ============================================================================

create table if not exists public.shamousa_knowledge_entries (
  id text primary key,
  topic text not null,
  keywords jsonb not null default '[]'::jsonb,
  synonyms jsonb not null default '[]'::jsonb,
  question_variants jsonb not null default '[]'::jsonb,
  reply text not null,
  options jsonb not null default '[]'::jsonb,
  specialty text not null default 'عام',
  related_package text not null default 'core_free',
  source text not null check (source in ('library', 'super_admin', 'approved_draft')),
  status text not null check (status in ('approved', 'draft', 'rejected')),
  version integer not null default 1,
  safety_warning_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shamousa_unanswered_queue (
  id text primary key,
  sanitized_question text not null,
  norm_key text not null,
  repeat_count integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'draft_ready', 'approved', 'ignored', 'merged')),
  draft_answer text,
  draft_source text,
  requires_safety_review boolean not null default false,
  merged_into_entry_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_shamousa_kb_status on public.shamousa_knowledge_entries (status);
create index if not exists idx_shamousa_uq_status_count on public.shamousa_unanswered_queue (status, repeat_count desc);

alter table public.shamousa_knowledge_entries enable row level security;
alter table public.shamousa_unanswered_queue enable row level security;

drop policy if exists "Read approved shamousa knowledge" on public.shamousa_knowledge_entries;
create policy "Read approved shamousa knowledge" on public.shamousa_knowledge_entries
  for select using (status = 'approved');
