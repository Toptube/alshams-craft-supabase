-- =============================================================
-- مزامنة المنتجات في الاتجاهين (جهاز <-> قاعدة البيانات)
-- شغّله بعد ملف 20261028_products_for_shamousa.sql
-- آمن لو اتشغّل أكتر من مرة
-- =============================================================

-- 1) نسخة كاملة من المنتج (عشان يتنزل على جهاز جديد بكل تفاصيل الحاسبة)
alter table public.products add column if not exists local_record jsonb;

-- 2) وقت وصول التعديل للسيرفر (بيتحدد من السيرفر نفسه، مش من ساعة جهاز الفنان)
alter table public.products add column if not exists synced_at timestamptz not null default now();
create index if not exists products_sync_idx on public.products (workshop_id, synced_at);

-- 3) حماية: تعديل قديم (اتعمل أوفلاين) ما يكتبش فوق تعديل أحدث من جهاز تاني
create or replace function public.products_sync_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- النسخة اللي على السيرفر أحدث، تفضل زي ما هي
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists products_sync_guard on public.products;
create trigger products_sync_guard
  before insert or update on public.products
  for each row execute function public.products_sync_guard();

-- 4) تحديث لحظي بين الأجهزة (Realtime). لو فشل السطر ده، المزامنة بتشتغل برضه كل دقيقة
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
     ) then
    alter publication supabase_realtime add table public.products;
  end if;
end;
$$;
