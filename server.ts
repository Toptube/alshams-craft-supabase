import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import supabaseConfig from './supabase-config.json' with { type: 'json' };
import {
  aiProvider,
  classifyGeminiError,
  falconErrorResponse,
  saveWorkshopSession,
  getWorkshopSession,
  clearWorkshopSession,
} from './server/aiProvider.js';
import * as shamousaModule from './server/shamousaProvider.js';
import {
  isSuperAdmin,
  processTrainingInteraction,
  getActiveGlobalMemories,
} from './server/aiGlobalMemory.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// Body parsers with appropriate limits
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Supabase Master / Service Client (uses service role key if available to bypass RLS, else publishableKey)
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  supabaseConfig.publishableKey;
const supabaseAuthClient = createClient(supabaseConfig.url, supabaseServiceKey);

// Rate Limits
const FALCON_DAILY_LIMIT = Number(process.env.FALCON_DAILY_LIMIT) || 20;
const SHAMOUSA_DAILY_LIMIT = Number(process.env.SHAMOUSA_DAILY_LIMIT) || 50;

const falconUsage = new Map<string, { date: string; count: number }>();
const shamousaUsage = new Map<string, { date: string; count: number }>();

function canUse(
  map: Map<string, { date: string; count: number }>,
  workshopId: string,
  limit: number,
  userEmail?: string
): boolean {
  if (isSuperAdmin(userEmail)) return true;
  const today = new Date().toISOString().split('T')[0];
  const rec = map.get(workshopId);
  if (!rec || rec.date !== today) return true;
  return rec.count < limit;
}

function recordUsage(
  map: Map<string, { date: string; count: number }>,
  workshopId: string,
  limit: number,
  userEmail?: string
): number {
  if (isSuperAdmin(userEmail)) return 9999;
  const today = new Date().toISOString().split('T')[0];
  const rec = map.get(workshopId);
  if (!rec || rec.date !== today) {
    map.set(workshopId, { date: today, count: 1 });
    return Math.max(0, limit - 1);
  }
  rec.count += 1;
  return Math.max(0, limit - rec.count);
}

function getRemainingUsage(
  map: Map<string, { date: string; count: number }>,
  workshopId: string,
  limit: number,
  userEmail?: string
): number {
  if (isSuperAdmin(userEmail)) return 9999;
  const today = new Date().toISOString().split('T')[0];
  const rec = map.get(workshopId);
  if (!rec || rec.date !== today) return limit;
  return Math.max(0, limit - rec.count);
}

// Scoped Request Interface
export interface AuthenticatedRequest extends Request {
  user?: any;
  userEmail?: string;
  isSuperAdmin?: boolean;
  workshopId?: string;
  scopedSupabase?: SupabaseClient;
}

// Authentication Middleware via Supabase JWT
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const devEmail = (req.headers['x-user-email'] as string) || req.body?.userEmail;

  // Support Super Admin direct access for dev/testing/supervisory calls
  if ((!authHeader || !authHeader.startsWith('Bearer ')) && devEmail && isSuperAdmin(devEmail)) {
    req.user = {
      id: 'super_admin_hossam',
      email: devEmail,
      user_metadata: { full_name: 'الباشمهندس حسام', name: 'حسام' },
    };
    req.userEmail = devEmail;
    req.isSuperAdmin = true;
    req.workshopId = (req.headers['x-workshop-id'] as string) || req.body?.workshopId || 'ALL_WORKSHOPS';
    req.scopedSupabase = supabaseAuthClient;
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول للوصول إلى هذه الخدمة' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabaseAuthClient.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'جلسة العمل منتهية أو غير صالحة. يرجى إعادة تسجيل الدخول.' });
      return;
    }

    req.user = user;
    const userEmail = user.email || (user.user_metadata?.email as string) || (req.headers['x-user-email'] as string) || '';
    req.userEmail = userEmail;
    const superAdmin = isSuperAdmin(userEmail);
    req.isSuperAdmin = superAdmin;

    const workshopId = superAdmin
      ? (req.headers['x-workshop-id'] as string) || req.body?.workshopId || 'ALL_WORKSHOPS'
      : (user.user_metadata?.workshop_id ||
         user.user_metadata?.workshopId ||
         user.user_metadata?.tenant_id ||
         user.id);
    req.workshopId = workshopId;

    // Create client scoped to user JWT for Row-Level Security
    req.scopedSupabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    next();
  } catch (err: any) {
    console.error('[Auth Middleware Error]:', err);
    res.status(401).json({ error: 'تعذر التحقق من هوية المستخدم' });
  }
}

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    geminiConfigured: aiProvider.isAvailable(),
    shamousaConfigured: true,
  });
});

// -------------------------------------------------------------
// AI Usage Endpoint
// -------------------------------------------------------------
app.get('/api/ai/usage', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const email = req.userEmail || req.user?.email || '';
  const superAdmin = isSuperAdmin(email);
  res.json({
    isSuperAdmin: superAdmin,
    falconRemaining: getRemainingUsage(falconUsage, wid, FALCON_DAILY_LIMIT, email),
    falconLimit: superAdmin ? 9999 : FALCON_DAILY_LIMIT,
    shamousaRemaining: getRemainingUsage(shamousaUsage, wid, SHAMOUSA_DAILY_LIMIT, email),
    shamousaLimit: superAdmin ? 9999 : SHAMOUSA_DAILY_LIMIT,
  });
});

// -------------------------------------------------------------
// Active Global Memory Listing (Super Admin & Audit)
// -------------------------------------------------------------
app.get('/api/ai/global-memory', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agent = (req.query.agent as 'shamousa' | 'falcon') || undefined;
    const memories = await getActiveGlobalMemories(agent);
    res.json({ memories, count: memories.length });
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر قراءة الذاكرة المركزية' });
  }
});

// -------------------------------------------------------------
// Super Admin Multi-Tenant ERP Endpoints (Workshops & Deep Data)
// -------------------------------------------------------------
app.get('/api/admin/workshops', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية: هذا الإجراء مخصص حصرياً للمالك والسوبر أدمن' });
  }

  try {
    const client = req.scopedSupabase || supabaseAuthClient;
    const { data, error } = await client
      .from('workshops')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return res.json({ workshops: data, count: data.length });
    }

    // Fallback: try querying profiles table if workshops returned empty or error
    try {
      const profRes = await client.from('profiles').select('*');
      if (!profRes.error && Array.isArray(profRes.data) && profRes.data.length > 0) {
        return res.json({ workshops: profRes.data, count: profRes.data.length });
      }
    } catch {
      // ignore
    }

    res.json({ workshops: Array.isArray(data) ? data : [], count: (data || []).length, warning: error?.message });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر جلب قائمة الورش' });
  }
});

app.get('/api/admin/workshops/:id/deep-data', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const targetWid = req.params.id;
  const client = req.scopedSupabase || supabaseAuthClient;

  try {
    const [matsRes, prodsRes, treasRes, ordersRes, custsRes] = await Promise.all([
      client.from('materials').select('*').eq('workshop_id', targetWid),
      client.from('products').select('*').eq('workshop_id', targetWid),
      client.from('treasuries').select('*').eq('workshop_id', targetWid),
      client.from('orders').select('*').eq('workshop_id', targetWid),
      client.from('customers').select('*').eq('workshop_id', targetWid),
    ]);

    res.json({
      materials: matsRes.data || [],
      products: prodsRes.data || [],
      treasuries: treasRes.data || [],
      orders: ordersRes.data || [],
      customers: custsRes.data || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر جلب تفاصيل بيانات الورشة' });
  }
});

app.post('/api/admin/workshops/:id/selective-delete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const targetWid = req.params.id;
  const { mode } = req.body || {};
  const client = req.scopedSupabase || supabaseAuthClient;

  try {
    if (mode === 'catalog_inventory') {
      await Promise.all([
        client.from('materials').delete().eq('workshop_id', targetWid),
        client.from('products').delete().eq('workshop_id', targetWid),
      ]);
      return res.json({ success: true, message: 'تم تفريغ الخامات والمنتجات مع الإبقاء على ملف الورشة' });
    }

    if (mode === 'finance_orders') {
      await Promise.all([
        client.from('orders').delete().eq('workshop_id', targetWid),
        client.from('treasuries').delete().eq('workshop_id', targetWid),
        client.from('safe_transactions').delete().eq('workshop_id', targetWid),
      ]);
      return res.json({ success: true, message: 'تم تصفير المعاملات المالية والفواتير والأوردرات' });
    }

    if (mode === 'cascade') {
      await Promise.all([
        client.from('materials').delete().eq('workshop_id', targetWid),
        client.from('products').delete().eq('workshop_id', targetWid),
        client.from('treasuries').delete().eq('workshop_id', targetWid),
        client.from('orders').delete().eq('workshop_id', targetWid),
        client.from('customers').delete().eq('workshop_id', targetWid),
        client.from('suppliers').delete().eq('workshop_id', targetWid),
        client.from('employees').delete().eq('workshop_id', targetWid),
        client.from('workshops').delete().eq('id', targetWid),
      ]);
      return res.json({ success: true, message: 'تم حذف الورشة بالكامل وكافة بياناتها' });
    }

    res.status(400).json({ error: 'وضع الحذف غير محدد' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر حذف بيانات الورشة' });
  }
});

// -------------------------------------------------------------
// Workshop Suspension, Ban, Auto-Unfreeze & Appeals Endpoints
// -------------------------------------------------------------
interface WorkshopStatusRecord {
  status: 'active' | 'suspended' | 'banned';
  suspension_reason?: string;
  suspension_duration?: string;
  suspended_until?: string | null;
  appeal_status?: 'none' | 'pending' | 'under_review' | 'rejected' | 'accepted';
  appeal_message?: string;
  rejection_reason?: string;
  appeal_submitted_at?: string | null;
}

const localWorkshopStatusMap = new Map<string, WorkshopStatusRecord>();
const localAnnouncements: any[] = [];
const localReceipts: any[] = [];

async function checkWorkshopStatusAndAutoUnfreeze(
  client: any,
  workshopId: string
): Promise<WorkshopStatusRecord> {
  const local = localWorkshopStatusMap.get(workshopId);

  try {
    const { data, error } = await client
      .from('workshops')
      .select('id, status, is_frozen, suspension_reason, suspension_duration, suspended_until, appeal_status, appeal_message, rejection_reason, appeal_submitted_at')
      .eq('id', workshopId)
      .maybeSingle();

    if (!error && data) {
      let curStatus: 'active' | 'suspended' | 'banned' =
        (data.status as any) || (data.is_frozen ? 'suspended' : 'active');

      // Auto-Unfreeze Check
      if (curStatus === 'suspended' && data.suspended_until) {
        const untilTime = new Date(data.suspended_until).getTime();
        if (!isNaN(untilTime) && Date.now() > untilTime) {
          curStatus = 'active';
          await client
            .from('workshops')
            .update({
              status: 'active',
              is_frozen: false,
              suspension_reason: null,
              suspension_duration: null,
              suspended_until: null,
            })
            .eq('id', workshopId)
            .catch(() => {});
        }
      }

      const rec: WorkshopStatusRecord = {
        status: curStatus,
        suspension_reason: data.suspension_reason,
        suspension_duration: data.suspension_duration,
        suspended_until: data.suspended_until,
        appeal_status: (data.appeal_status as any) || 'none',
        appeal_message: data.appeal_message,
        rejection_reason: data.rejection_reason,
        appeal_submitted_at: data.appeal_submitted_at,
      };
      localWorkshopStatusMap.set(workshopId, rec);
      return rec;
    }
  } catch {
    // fallback
  }

  if (local) {
    if (local.status === 'suspended' && local.suspended_until) {
      const untilTime = new Date(local.suspended_until).getTime();
      if (!isNaN(untilTime) && Date.now() > untilTime) {
        local.status = 'active';
        local.suspension_reason = undefined;
        local.suspension_duration = undefined;
        local.suspended_until = null;
      }
    }
    return local;
  }

  return { status: 'active', appeal_status: 'none' };
}

// 1. Get current workshop status (with auto-unfreeze verification)
const handleMyStatus = async (req: Request, res: Response) => {
  const wid = (req.body?.workshopId || req.query?.workshopId || req.headers['x-workshop-id'] || '') as string;
  if (!wid || wid === 'ALL_WORKSHOPS') {
    return res.json({ success: true, status: 'active', appeal_status: 'none', workshop: { status: 'active', appeal_status: 'none' } });
  }

  const client = supabaseAuthClient;
  const statusRec = await checkWorkshopStatusAndAutoUnfreeze(client, wid);
  res.json({
    success: true,
    workshop: statusRec,
    ...statusRec,
  });
};

app.get('/api/workshop/my-status', handleMyStatus);
app.post('/api/workshop/my-status', handleMyStatus);

// 2. Submit Appeal for suspended/banned workshop
app.post('/api/workshop/appeal', async (req: Request, res: Response) => {
  const wid = (req.body?.workshopId || req.query?.workshopId || req.headers['x-workshop-id'] || '') as string;
  const { appeal_message } = req.body || {};

  if (!wid) {
    return res.status(400).json({ error: 'معرف الورشة مطلوب' });
  }

  if (!appeal_message || typeof appeal_message !== 'string' || !appeal_message.trim()) {
    return res.status(400).json({ error: 'نص الطعن مطلوب' });
  }

  const nowIso = new Date().toISOString();
  const client = supabaseAuthClient;

  try {
    await client
      .from('workshops')
      .update({
        appeal_status: 'pending',
        appeal_message: appeal_message.trim(),
        appeal_submitted_at: nowIso,
        rejection_reason: null,
      })
      .eq('id', wid);
  } catch {
    // ignore
  }

  const existing = localWorkshopStatusMap.get(wid) || { status: 'suspended' };
  localWorkshopStatusMap.set(wid, {
    ...existing,
    appeal_status: 'pending',
    appeal_message: appeal_message.trim(),
    appeal_submitted_at: nowIso,
    rejection_reason: undefined,
  });

  res.json({
    success: true,
    message: 'تم استلام طعنكم بنجاح وهو قيد المراجعة حالياً من قِبل كبير عيلة الشمساوية.',
  });
});

// 3. Super Admin Update Workshop Status (Active / Suspended / Banned)
app.post('/api/admin/workshops/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const targetWid = req.params.id;
  const { status, suspension_reason, suspension_duration, suspended_until } = req.body || {};

  if (!['active', 'suspended', 'banned'].includes(status)) {
    return res.status(400).json({ error: 'حالة الورشة غير صالحة' });
  }

  const isFrozen = status !== 'active';
  const client = req.scopedSupabase || supabaseAuthClient;

  const updateData: any = {
    status,
    is_frozen: isFrozen,
    suspension_reason: isFrozen ? suspension_reason || 'إجراء إداري' : null,
    suspension_duration: isFrozen ? suspension_duration || null : null,
    suspended_until: status === 'suspended' ? suspended_until || null : null,
    frozen_reason: isFrozen ? suspension_reason || 'إجراء إداري' : null,
    updated_at: new Date().toISOString(),
  };

  try {
    await client.from('workshops').update(updateData).eq('id', targetWid);
  } catch {
    // ignore
  }

  const existing = localWorkshopStatusMap.get(targetWid) || { status: 'active' };
  localWorkshopStatusMap.set(targetWid, {
    ...existing,
    status,
    suspension_reason: updateData.suspension_reason,
    suspension_duration: updateData.suspension_duration,
    suspended_until: updateData.suspended_until,
  });

  res.json({ success: true, workshopId: targetWid, status, updateData });
});

// 4. Super Admin Review Appeal (Accept / Reject)
app.post('/api/admin/workshops/:id/appeal', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const targetWid = req.params.id;
  const { appeal_status, rejection_reason } = req.body || {};

  if (!['accepted', 'rejected'].includes(appeal_status)) {
    return res.status(400).json({ error: 'حالة الطعن غير صالحة' });
  }

  const client = req.scopedSupabase || supabaseAuthClient;
  const isAccepted = appeal_status === 'accepted';

  const updateData: any = isAccepted
    ? {
        status: 'active',
        is_frozen: false,
        appeal_status: 'accepted',
        suspension_reason: null,
        suspension_duration: null,
        suspended_until: null,
        frozen_reason: null,
      }
    : {
        appeal_status: 'rejected',
        rejection_reason: rejection_reason || 'تم رفض الطعن بعد دراسة سجلات الورشة.',
      };

  try {
    await client.from('workshops').update(updateData).eq('id', targetWid);
  } catch {
    // ignore
  }

  const existing = localWorkshopStatusMap.get(targetWid) || { status: 'suspended' };
  localWorkshopStatusMap.set(targetWid, {
    ...existing,
    ...updateData,
  });

  res.json({ success: true, appeal_status, updateData });
});

// 5. Super Admin Get All Appeals
app.get('/api/admin/appeals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const client = req.scopedSupabase || supabaseAuthClient;
  try {
    const { data, error } = await client
      .from('workshops')
      .select('id, brand_name, artist_name, phone_number, email, status, suspension_reason, appeal_status, appeal_message, rejection_reason, appeal_submitted_at')
      .not('appeal_status', 'is', null)
      .neq('appeal_status', 'none')
      .order('appeal_submitted_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return res.json({ appeals: data });
    }
  } catch {
    // ignore
  }

  // Fallback to local map
  const localList: any[] = [];
  localWorkshopStatusMap.forEach((v, k) => {
    if (v.appeal_status && v.appeal_status !== 'none') {
      localList.push({ id: k, ...v });
    }
  });

  res.json({ appeals: localList });
});

// -------------------------------------------------------------
// In-App Messaging Hub Endpoints (Announcements & Receipts)
// -------------------------------------------------------------

// 6. Get Announcements for current workshop
app.get('/api/announcements', async (req: Request, res: Response) => {
  const wid = ((req.query.workshopId as string) || (req.body?.workshopId as string) || (req.headers['x-workshop-id'] as string) || '') as string;
  const client = supabaseAuthClient;

  try {
    const { data: announcements, error: aErr } = await client
      .from('admin_announcements')
      .select('*')
      .or(`recipient_type.eq.all,recipient_workshop_id.eq.${wid}`)
      .order('created_at', { ascending: false });

    if (!aErr && Array.isArray(announcements)) {
      // Fetch receipts for this workshop
      const { data: receipts } = await client
        .from('workshop_messages_receipts')
        .select('*')
        .eq('workshop_id', wid);

      const receiptsMap = new Map<string, any>();
      (receipts || []).forEach((r: any) => receiptsMap.set(r.message_id, r));

      const merged = announcements.map((a: any) => ({
        ...a,
        receipt: receiptsMap.get(a.id) || null,
      }));

      return res.json({ announcements: merged });
    }
  } catch {
    // ignore
  }

  // Fallback to local announcements
  const list = localAnnouncements.filter(
    (a) => a.recipient_type === 'all' || a.recipient_workshop_id === wid
  );
  const merged = list.map((a) => ({
    ...a,
    receipt: localReceipts.find((r) => r.message_id === a.id && r.workshop_id === wid) || null,
  }));

  res.json({ announcements: merged });
});

// 7. Post Announcement (Broadcast or Specific - Super Admin Only)
app.post('/api/admin/announcements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const { recipient_type, recipient_workshop_id, title, content } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: 'عنوان ونص الرسالة مطلوبان' });
  }

  const newAnn: any = {
    id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    sender_id: 'super_admin_hossam',
    recipient_type: recipient_type || 'all',
    recipient_workshop_id: recipient_type === 'specific' ? recipient_workshop_id : null,
    title: title.trim(),
    content: content.trim(),
    created_at: new Date().toISOString(),
  };

  const client = req.scopedSupabase || supabaseAuthClient;
  try {
    await client.from('admin_announcements').insert({
      recipient_type: newAnn.recipient_type,
      recipient_workshop_id: newAnn.recipient_workshop_id,
      title: newAnn.title,
      content: newAnn.content,
    });
  } catch {
    // fallback
  }

  localAnnouncements.unshift(newAnn);
  res.json({ success: true, announcement: newAnn });
});

// 8. Workshop Message Receipt & Reply Handler
app.post('/api/announcements/:id/receipt', async (req: Request, res: Response) => {
  const wid = (req.body?.workshopId || req.headers['x-workshop-id'] || (req as any).workshopId || '') as string;
  const messageId = req.params.id;
  const { action, reply_text } = req.body || {};

  const client = supabaseAuthClient;
  const nowIso = new Date().toISOString();

  let receiptUpdate: any = {};
  if (action === 'read') {
    receiptUpdate.read_at = nowIso;
  } else if (action === 'acknowledge') {
    receiptUpdate.read_at = nowIso;
    receiptUpdate.acknowledged_at = nowIso;
  } else if (action === 'reply') {
    receiptUpdate.reply_text = (reply_text || '').trim();
    receiptUpdate.replied_at = nowIso;
  }

  try {
    await client.from('workshop_messages_receipts').upsert(
      {
        message_id: messageId,
        workshop_id: wid,
        ...receiptUpdate,
      },
      { onConflict: 'message_id,workshop_id' }
    );
  } catch {
    // fallback
  }

  // Update local receipts
  const existingIdx = localReceipts.findIndex(
    (r) => r.message_id === messageId && r.workshop_id === wid
  );
  if (existingIdx >= 0) {
    localReceipts[existingIdx] = { ...localReceipts[existingIdx], ...receiptUpdate };
  } else {
    localReceipts.push({ message_id: messageId, workshop_id: wid, ...receiptUpdate });
  }

  res.json({ success: true, receipt: receiptUpdate });
});

// 9. Super Admin Inbox (Artisans Replies & Inquiries)
app.get('/api/admin/inbox', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const client = req.scopedSupabase || supabaseAuthClient;
  try {
    const { data: receipts } = await client
      .from('workshop_messages_receipts')
      .select('*, admin_announcements(*), workshops(id, brand_name, artist_name, phone_number, email)')
      .not('reply_text', 'is', null)
      .order('replied_at', { ascending: false });

    if (Array.isArray(receipts)) {
      return res.json({ inbox: receipts });
    }
  } catch {
    // ignore
  }

  // Fallback to local receipts
  const replies = localReceipts
    .filter((r) => r.reply_text)
    .map((r) => {
      const ann = localAnnouncements.find((a) => a.id === r.message_id);
      return {
        ...r,
        admin_announcements: ann,
        workshop_name: 'ورشة الشمساوية',
      };
    });

  res.json({ inbox: replies });
});

// -------------------------------------------------------------
// Shamousa Chat Endpoint (Workshop Data Only)
// -------------------------------------------------------------
app.post('/api/shamousa/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const email = req.userEmail || req.user?.email || '';
  const superAdmin = isSuperAdmin(email);

  const { message, history, clientWorkshopState } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'الرسالة فارغة' });
    return;
  }

  // 1. فحص وضع التدريب والبرمجة التفاعلي المباشر للسوبر أدمن
  if (superAdmin) {
    const trainingResult = await processTrainingInteraction(
      'shamousa',
      message.trim(),
      email,
      undefined,
      req.scopedSupabase
    );
    if (trainingResult.handled) {
      res.json({
        reply: trainingResult.reply,
        inTrainingMode: trainingResult.inTrainingMode,
        provider: 'superadmin_engine',
        remaining: 9999,
      });
      return;
    }
  }

  // فحص الحظر والإيقاف المؤقت للورشة
  if (!superAdmin && wid && wid !== 'ALL_WORKSHOPS') {
    const statusRec = await checkWorkshopStatusAndAutoUnfreeze(req.scopedSupabase || supabaseAuthClient, wid);
    if (statusRec.status === 'suspended' || statusRec.status === 'banned') {
      res.status(403).json({
        error:
          statusRec.status === 'banned'
            ? 'تم حظر حساب ورشتكم من قِبل إدارة المنظومة.'
            : `تم إيقاف حساب ورشتكم مؤقتاً: ${statusRec.suspension_reason || 'إجراء إداري'}.`,
        status: statusRec.status,
        suspension_reason: statusRec.suspension_reason,
        appeal_status: statusRec.appeal_status,
      });
      return;
    }
  }

  if (!canUse(shamousaUsage, wid, SHAMOUSA_DAILY_LIMIT, email)) {
    res.status(429).json({
      error: `وصلت للحد الأقصى لشموسة اليوم (${SHAMOUSA_DAILY_LIMIT} استفسار). يتجدد الرصيد غداً بإذن الله.`,
      remaining: 0,
      handoffToFalcon: true,
    });
    return;
  }

  try {
    const artistName =
      req.user?.user_metadata?.full_name ||
      req.user?.user_metadata?.name ||
      req.body?.artistName ||
      (superAdmin ? 'الباشمهندس حسام' : '');
    const brandName =
      req.user?.user_metadata?.brand_name ||
      req.user?.user_metadata?.brandName ||
      req.body?.brandName ||
      'ورشة الشمس كرافت';

    const shamousaRunner: any =
      (shamousaModule as any).handleShamousaChat ||
      (shamousaModule as any).chatWithShamousa;

    if (typeof shamousaRunner !== 'function') {
      throw new Error('محرك شموسة غير جاهز حالياً');
    }

    const clientTreasury = Number(clientWorkshopState?.treasuryBalance ?? req.body?.treasuryBalance ?? 0);

    const result = await shamousaRunner(
      message.trim(),
      Array.isArray(history) ? history : [],
      {
        artistName,
        workshopName: brandName,
        treasuryBalance: clientTreasury,
        workshopId: wid,
        db: req.scopedSupabase || supabaseAuthClient,
        clientContext: clientWorkshopState,
        userEmail: email,
        isSuperAdmin: superAdmin,
      }
    );

    // الخصم فقط بعد نجاح الاستجابة لعدم إهدار الرصيد (والسوبر أدمن لا يخصم)
    const remaining = recordUsage(shamousaUsage, wid, SHAMOUSA_DAILY_LIMIT, email);

    res.json({
      reply: typeof result === 'string' ? result : (result.reply || ''),
      handoffToFalcon: Boolean(result?.handoffToFalcon),
      provider: result?.provider || 'groq',
      remaining,
    });
  } catch (err: any) {
    console.error('[Shamousa Chat Error]:', err);
    res.status(500).json({
      error: err?.message || 'تعذر معالجة طلب شموسة حالياً، يرجى المحاولة لاحقاً.',
      remaining: getRemainingUsage(shamousaUsage, wid, SHAMOUSA_DAILY_LIMIT, email),
    });
  }
});

// -------------------------------------------------------------
// Falcon AI Agent Endpoints (General Crafts, Vision, Pricing)
// -------------------------------------------------------------
const handleFalconChat = async (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const email = req.userEmail || req.user?.email || '';
  const superAdmin = isSuperAdmin(email);

  const { message, actionChip, chatHistory, workshopContext } = req.body || {};
  if (!message && !actionChip) {
    res.status(400).json({ error: 'الرسالة مطلوبة' });
    return;
  }

  // 1. فحص وضع التدريب والبرمجة التفاعلي المباشر للسوبر أدمن
  if (superAdmin && message) {
    const trainingResult = await processTrainingInteraction(
      'falcon',
      String(message).trim(),
      email,
      undefined,
      req.scopedSupabase
    );
    if (trainingResult.handled) {
      res.json({
        reply: trainingResult.reply,
        inTrainingMode: trainingResult.inTrainingMode,
        sources: [],
        searchUsed: false,
        remaining: 9999,
      });
      return;
    }
  }

  // فحص الحظر والإيقاف المؤقت للورشة
  if (!superAdmin && wid && wid !== 'ALL_WORKSHOPS') {
    const statusRec = await checkWorkshopStatusAndAutoUnfreeze(req.scopedSupabase || supabaseAuthClient, wid);
    if (statusRec.status === 'suspended' || statusRec.status === 'banned') {
      res.status(403).json({
        error:
          statusRec.status === 'banned'
            ? 'تم حظر حساب ورشتكم من قِبل إدارة المنظومة.'
            : `تم إيقاف حساب ورشتكم مؤقتاً: ${statusRec.suspension_reason || 'إجراء إداري'}.`,
        status: statusRec.status,
        suspension_reason: statusRec.suspension_reason,
        appeal_status: statusRec.appeal_status,
      });
      return;
    }
  }

  if (!canUse(falconUsage, wid, FALCON_DAILY_LIMIT, email)) {
    res.status(429).json({
      error: `وصلت للحد اليومي لرسائل صقر الشمساوية (${FALCON_DAILY_LIMIT} رسالة). يتجدد الرصيد غداً بإذن الله.`,
      remaining: 0,
    });
    return;
  }

  try {
    const artistName =
      req.user?.user_metadata?.full_name ||
      req.user?.user_metadata?.name ||
      workshopContext?.artistName ||
      (superAdmin ? 'الباشمهندس حسام' : '');

    const result = await aiProvider.chatWithAgent({
      message: message || '',
      actionChip,
      chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
      userEmail: email,
      isSuperAdmin: superAdmin,
      workshopContext: {
        ...(workshopContext || {}),
        artistName: (workshopContext?.artistName || artistName),
        userEmail: email,
        isSuperAdmin: superAdmin,
      },
    });

    // الخصم فقط بعد تمام الرد (والسوبر أدمن لا يخصم)
    const remaining = recordUsage(falconUsage, wid, FALCON_DAILY_LIMIT, email);

    res.json({
      ...result,
      remaining,
    });
  } catch (err: any) {
    console.error('[Falcon Chat Error]:', err);
    const { status, error } = falconErrorResponse(err);
    res.status(status).json({
      error,
      remaining: getRemainingUsage(falconUsage, wid, FALCON_DAILY_LIMIT, email),
    });
  }
};

app.post('/api/chat-agent', requireAuth, handleFalconChat);
app.post('/api/ai/chat', requireAuth, handleFalconChat);

const handleFalconVision = async (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const email = req.userEmail || req.user?.email || '';
  const superAdmin = isSuperAdmin(email);

  if (!canUse(falconUsage, wid, FALCON_DAILY_LIMIT, email)) {
    res.status(429).json({
      error: `وصلت للحد اليومي لتحليلات صقر (${FALCON_DAILY_LIMIT}). يتجدد الرصيد غداً بإذن الله.`,
      remaining: 0,
    });
    return;
  }

  const { imageBase64, mimeType, artistNotes, workshopContext } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    res.status(400).json({ error: 'صورة المنتج مطلوبة للتحليل' });
    return;
  }

  try {
    const analysis = await aiProvider.analyzeCraftVision({
      imageBase64,
      mimeType,
      artistNotes,
      workshopContext: workshopContext || {},
    });

    // الخصم فقط بعد تمام التحليل (والسوبر أدمن لا يخصم)
    const remaining = recordUsage(falconUsage, wid, FALCON_DAILY_LIMIT, email);

    res.json({
      ...analysis,
      remaining,
    });
  } catch (err: any) {
    console.error('[Falcon Vision Error]:', err);
    const { status, error } = falconErrorResponse(err);
    res.status(status).json({
      error,
      remaining: getRemainingUsage(falconUsage, wid, FALCON_DAILY_LIMIT, email),
    });
  }
};

app.post('/api/analyze-vision', requireAuth, handleFalconVision);
app.post('/api/ai/analyze-image', requireAuth, handleFalconVision);

// -------------------------------------------------------------
// Chat Session Management
// -------------------------------------------------------------
app.get('/api/ai/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const session = getWorkshopSession(wid);
  res.json({ session: session || null });
});

app.post('/api/ai/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const { messages } = req.body || {};
  const saved = saveWorkshopSession(wid, Array.isArray(messages) ? messages : []);
  res.json({ ok: true, session: saved });
});

app.delete('/api/ai/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  clearWorkshopSession(wid);
  res.json({ ok: true });
});

// -------------------------------------------------------------
// Start Server (Vite in Dev, Static in Prod)
// -------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[AlShams ERP Server] Listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Start Error]:', err);
  process.exit(1);
});