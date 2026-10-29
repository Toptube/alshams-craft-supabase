-- ====================================================================
-- ترقية قاعدة بيانات منظومة الشمساوية
-- 1. إضافة حقول الحظر والإيقاف المؤقت والطعون لجدول workshops
-- 2. إنشاء جداول المراسلات التفاعلية والرسائل الحية (admin_announcements & workshop_messages_receipts)
-- ====================================================================

-- 1. ترقية جدول workshops
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspension_duration VARCHAR(50),
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS appeal_status VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS appeal_message TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS appeal_submitted_at TIMESTAMPTZ NULL;

-- فهارس للبحث السريع بحسب الحالة وحالة الطعون
CREATE INDEX IF NOT EXISTS idx_workshops_status ON public.workshops(status);
CREATE INDEX IF NOT EXISTS idx_workshops_appeal ON public.workshops(appeal_status);

-- 2. جدول الإعلانات والمراسلات الصادرة من السوبر أدمن
CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID,
  recipient_type VARCHAR(20) NOT NULL DEFAULT 'all', -- 'all' أو 'specific'
  recipient_workshop_id UUID NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_announcements_recipient ON public.admin_announcements(recipient_type, recipient_workshop_id);
CREATE INDEX IF NOT EXISTS idx_admin_announcements_created ON public.admin_announcements(created_at DESC);

-- 3. جدول استلام وتأكيد وردود الورش على المراسلات
CREATE TABLE IF NOT EXISTS public.workshop_messages_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.admin_announcements(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL,
  read_at TIMESTAMPTZ NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  reply_text TEXT NULL,
  replied_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workshop_receipts_workshop ON public.workshop_messages_receipts(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_receipts_msg ON public.workshop_messages_receipts(message_id);

-- 4. إعداد أمان مستوى الصف (RLS) وسياسات القراءة والكتابة
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_messages_receipts ENABLE ROW LEVEL SECURITY;

-- سياسات admin_announcements
DROP POLICY IF EXISTS "Allow read announcements" ON public.admin_announcements;
CREATE POLICY "Allow read announcements" ON public.admin_announcements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin manage announcements" ON public.admin_announcements;
CREATE POLICY "Allow admin manage announcements" ON public.admin_announcements
  FOR ALL USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) IN ('hmb.top.tupe@gmail.com', 'hmb.top.tube@gmail.com')
    OR auth.role() = 'service_role'
    OR auth.role() = 'anon'
  );

-- سياسات workshop_messages_receipts
DROP POLICY IF EXISTS "Allow read workshop receipts" ON public.workshop_messages_receipts;
CREATE POLICY "Allow read workshop receipts" ON public.workshop_messages_receipts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert or update receipts" ON public.workshop_messages_receipts;
CREATE POLICY "Allow insert or update receipts" ON public.workshop_messages_receipts
  FOR ALL USING (true) WITH CHECK (true);
