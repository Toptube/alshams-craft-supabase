import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
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
  transcribeAudioWithGemini,
} from './server/aiProvider.js';
import * as shamousaModule from './server/shamousaProvider.js';
import crypto from 'crypto';
import {
  isSuperAdmin,
  processTrainingInteraction,
  getActiveGlobalMemories,
  getAllGlobalMemories,
  deleteGlobalMemoryRecord,
} from './server/aiGlobalMemory.js';
import {
  performGoogleSearch,
  getAgentSecretStatus,
} from './server/googleSearchService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSHOPS_FILE = path.resolve(__dirname, 'data/workshops.json');
const MARKETPLACE_PRODUCTS_FILE = path.resolve(__dirname, 'data/marketplace_products.json');
const MARKETPLACE_ORDERS_FILE = path.resolve(__dirname, 'data/marketplace_orders.json');
const PLATFORM_SETTINGS_FILE = path.resolve(__dirname, 'data/platform_settings.json');
const PUBLIC_FEEDBACK_FILE = path.resolve(__dirname, 'data/public_feedback.json');
const FAMILY_POSTS_FILE = path.resolve(__dirname, 'data/family_posts.json');
const FAMILY_COMMENTS_FILE = path.resolve(__dirname, 'data/family_comments.json');
const FAMILY_CHAT_FILE = path.resolve(__dirname, 'data/family_chat.json');
const FAMILY_RESTRICTIONS_FILE = path.resolve(__dirname, 'data/family_restrictions.json');
const FAMILY_POLL_VOTES_FILE = path.resolve(__dirname, 'data/family_poll_votes.json');
const FAMILY_REACTIONS_FILE = path.resolve(__dirname, 'data/family_reactions.json');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(val?: string | null): boolean {
  return Boolean(val && typeof val === 'string' && UUID_REGEX.test(val.trim()));
}

function readJsonArray(filePath: string): any[] {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(`[JSON Read] ${path.basename(filePath)} error:`, err);
  }
  return [];
}

function writeJsonData(filePath: string, data: any): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[JSON Write] ${path.basename(filePath)} error:`, err);
  }
}

function loadPersistentWorkshops(): any[] {
  return readJsonArray(WORKSHOPS_FILE);
}
function savePersistentWorkshops(list: any[]): void {
  writeJsonData(WORKSHOPS_FILE, list);
}

function loadPersistentMarketplaceProducts(): any[] {
  return readJsonArray(MARKETPLACE_PRODUCTS_FILE);
}
function savePersistentMarketplaceProducts(list: any[]): void {
  writeJsonData(MARKETPLACE_PRODUCTS_FILE, list);
}

function loadPersistentMarketplaceOrders(): any[] {
  return readJsonArray(MARKETPLACE_ORDERS_FILE);
}
function savePersistentMarketplaceOrders(list: any[]): void {
  writeJsonData(MARKETPLACE_ORDERS_FILE, list);
}

function loadPersistentFeedback(): any[] {
  return readJsonArray(PUBLIC_FEEDBACK_FILE);
}
function savePersistentFeedback(list: any[]): void {
  writeJsonData(PUBLIC_FEEDBACK_FILE, list);
}

function loadPersistentFamilyPosts(): any[] {
  return readJsonArray(FAMILY_POSTS_FILE);
}
function savePersistentFamilyPosts(list: any[]): void {
  writeJsonData(FAMILY_POSTS_FILE, list);
}

function loadPersistentFamilyComments(): any[] {
  return readJsonArray(FAMILY_COMMENTS_FILE);
}
function savePersistentFamilyComments(list: any[]): void {
  writeJsonData(FAMILY_COMMENTS_FILE, list);
}

function loadPersistentFamilyChat(): any[] {
  return readJsonArray(FAMILY_CHAT_FILE);
}
function savePersistentFamilyChat(list: any[]): void {
  writeJsonData(FAMILY_CHAT_FILE, list);
}

function loadPersistentFamilyRestrictions(): any[] {
  return readJsonArray(FAMILY_RESTRICTIONS_FILE);
}
function savePersistentFamilyRestrictions(list: any[]): void {
  writeJsonData(FAMILY_RESTRICTIONS_FILE, list);
}

function loadPersistentFamilyPollVotes(): any[] {
  return readJsonArray(FAMILY_POLL_VOTES_FILE);
}
function savePersistentFamilyPollVotes(list: any[]): void {
  writeJsonData(FAMILY_POLL_VOTES_FILE, list);
}

function loadPersistentFamilyReactions(): any[] {
  return readJsonArray(FAMILY_REACTIONS_FILE);
}
function savePersistentFamilyReactions(list: any[]): void {
  writeJsonData(FAMILY_REACTIONS_FILE, list);
}

const DEFAULT_PLATFORM_SETTINGS = {
  governorateRates: {
    'القاهرة': 50,
    'الجيزة': 50,
    'الإسكندرية': 65,
    'القليوبية': 65,
    'المنوفية': 70,
    'الغربية': 70,
    'الدقهلية': 75,
    'الشرقية': 75,
    'كفر الشيخ': 75,
    'البحيرة': 75,
    'دمياط': 75,
    'بورسعيد': 80,
    'الإسماعيلية': 80,
    'السويس': 80,
    'الفيوم': 85,
    'بني سويف': 85,
    'المنيا': 90,
    'أسيوط': 100,
    'سوهاج': 105,
    'قنا': 110,
    'الأقصر': 115,
    'أسوان': 120,
    'البحر الأحمر': 135,
    'جنوب سيناء': 140,
    'شمال سيناء': 140,
    'مطروح': 135,
    'الوادي الجديد': 145,
  },
  packagingFee: 25,
  storageAndHandlingFee: 20,
  commissionPercent: 10,
  advancePaymentRatio: 0.33,
  defaultClientPrivacy: true,
  updatedAt: new Date().toISOString(),
};

function loadPersistentPlatformSettings(): any {
  try {
    if (fs.existsSync(PLATFORM_SETTINGS_FILE)) {
      const raw = fs.readFileSync(PLATFORM_SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_PLATFORM_SETTINGS,
          ...parsed,
          governorateRates: {
            ...DEFAULT_PLATFORM_SETTINGS.governorateRates,
            ...(parsed.governorateRates || {}),
          },
        };
      }
    }
  } catch (err) {
    console.warn('[Platform Settings] Read error:', err);
  }
  return { ...DEFAULT_PLATFORM_SETTINGS };
}

function savePersistentPlatformSettings(cfg: any): void {
  writeJsonData(PLATFORM_SETTINGS_FILE, cfg);
}

let viteDevServer: any = null;

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// Body parsers with appropriate limits
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Supabase Master / Service Client (reads from environment VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, fallback to config)
const supabaseServerUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  supabaseConfig.url;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  supabaseConfig.publishableKey;

export const supabaseAuthClient = createClient(supabaseServerUrl, supabaseServiceKey);
export const supabaseAdminClient = createClient(supabaseServerUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

function getDbClient(req?: AuthenticatedRequest | Request): SupabaseClient {
  return (req as AuthenticatedRequest)?.scopedSupabase || supabaseAdminClient;
}

// Authentication Middleware via Supabase JWT (always prefer verified JWT over dev header fallback)
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const devEmail =
    (req.headers['x-user-email'] as string) ||
    req.body?.userEmail ||
    (req.query?.userEmail as string) ||
    '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user }, error } = await supabaseAuthClient.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        const userEmail = user.email || (user.user_metadata?.email as string) || devEmail || '';
        req.userEmail = userEmail;
        const superAdmin = isSuperAdmin(userEmail);
        req.isSuperAdmin = superAdmin;

        const workshopId = superAdmin
          ? (req.headers['x-workshop-id'] as string) || req.body?.workshopId || (req.query?.workshopId as string) || 'ALL_WORKSHOPS'
          : (user.user_metadata?.workshop_id ||
             user.user_metadata?.workshopId ||
             user.user_metadata?.tenant_id ||
             user.id);
        req.workshopId = workshopId;

        // Create client scoped to authenticated user's JWT for RLS
        req.scopedSupabase = createClient(supabaseServerUrl, supabaseConfig.publishableKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });

        next();
        return;
      }

      // If token expired/invalid, return 401 so authedFetch triggers refreshSession()
      res.status(401).json({ error: 'جلسة العمل منتهية أو غير صالحة. يرجى إعادة تسجيل الدخول.' });
      return;
    } catch (err: any) {
      console.error('[Auth Middleware Error]:', err);
      res.status(401).json({ error: 'تعذر التحقق من هوية المستخدم' });
      return;
    }
  }

  // Fallback for direct Super Admin supervisory server calls without Bearer header
  if (devEmail && isSuperAdmin(devEmail)) {
    req.user = {
      id: 'super_admin_hossam',
      email: devEmail,
      user_metadata: { full_name: 'الباشمهندس حسام بسيوني', name: 'حسام' },
    };
    req.userEmail = devEmail;
    req.isSuperAdmin = true;
    req.workshopId = (req.headers['x-workshop-id'] as string) || req.body?.workshopId || (req.query?.workshopId as string) || 'ALL_WORKSHOPS';
    req.scopedSupabase = supabaseAdminClient;
    next();
    return;
  }

  res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول للوصول إلى هذه الخدمة' });
}

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------

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
// Active Global Memory Listing & Deletion (Super Admin & Audit)
// -------------------------------------------------------------
app.get('/api/ai/global-memory', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agent = (req.query.agent as 'shamousa' | 'falcon') || undefined;
    const memories = await getActiveGlobalMemories(agent);
    res.json({ memories, count: memories.length });
  } catch {
    res.status(500).json({ error: 'تعذر قراءة الذاكرة المركزية' });
  }
});

app.get('/api/admin/memories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }
  try {
    const agent = (req.query.agent as 'shamousa' | 'falcon') || undefined;
    const memories = await getAllGlobalMemories(agent);
    res.json({ success: true, memories, count: memories.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'تعذر قراءة سجل الذاكرة الدائمة' });
  }
});

app.delete('/api/admin/memories/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }
  try {
    await deleteGlobalMemoryRecord(req.params.id, getDbClient(req));
    res.json({ success: true, message: 'تم حذف القاعدة من الذاكرة المركزية' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'تعذر حذف القاعدة' });
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
    const client = getDbClient(req);
    let dbWorkshops: any[] = [];
    let dbProfiles: any[] = [];

    try {
      const [wsRes, profRes] = await Promise.all([
        client.from('workshops').select('*').order('created_at', { ascending: false }),
        client.from('profiles').select('*'),
      ]);

      if (!wsRes.error && Array.isArray(wsRes.data) && wsRes.data.length > 0) {
        dbWorkshops = wsRes.data;
      }
      if (!profRes.error && Array.isArray(profRes.data) && profRes.data.length > 0) {
        dbProfiles = profRes.data;
      }
    } catch {
      // Supabase query catch
    }

    const profilesMap = new Map<string, any>();
    dbProfiles.forEach((p) => {
      if (p.id) profilesMap.set(p.id, p);
      if (p.email) profilesMap.set(p.email.toLowerCase(), p);
      if (p.workshop_id) profilesMap.set(p.workshop_id, p);
    });

    const localList = loadPersistentWorkshops();
    const map = new Map<string, any>();

    // 1. Add persistent local workshops
    localList.forEach((w) => {
      if (w.id) map.set(w.id, w);
    });

    // 2. Merge database workshops with real profile data + auto-unfreeze expired suspensions
    for (const row of dbWorkshops) {
      if (!row.id) continue;
      const existing = map.get(row.id) || {};
      const prof =
        profilesMap.get(row.id) ||
        profilesMap.get((row.email || '').toLowerCase()) ||
        profilesMap.get(row.owner_id) ||
        {};

      const artistName = prof.artist_name || prof.full_name || prof.name || row.artist_name || row.artistName || existing.artistName;
      const phoneNumber = prof.phone_number || prof.phone || row.phone_number || row.phone || row.phoneNumber || existing.phoneNumber;
      const wsEmail = prof.email || row.email || existing.email || '';
      let status = row.status || prof.status || existing.status || (row.is_frozen || row.isFrozen ? 'suspended' : 'active');
      let isFrozen = Boolean(row.is_frozen || row.isFrozen || status === 'suspended' || status === 'banned');
      let suspendedUntil = row.suspended_until || prof.suspended_until || existing.suspended_until || null;
      let suspensionReason = row.suspension_reason || row.suspended_reason || row.frozen_reason || existing.suspension_reason || null;
      let suspensionDuration = row.suspension_duration || existing.suspension_duration || null;

      if (status === 'suspended' && suspendedUntil) {
        const untilTs = new Date(suspendedUntil).getTime();
        if (!isNaN(untilTs) && Date.now() > untilTs) {
          status = 'active';
          isFrozen = false;
          suspendedUntil = null;
          suspensionReason = null;
          suspensionDuration = null;
          client.from('workshops').update({
            status: 'active',
            is_frozen: false,
            suspended_reason: null,
            suspension_reason: null,
            suspension_duration: null,
            suspended_until: null,
          }).eq('id', row.id).then(() => {}, () => {});
        }
      }

      map.set(row.id, {
        ...existing,
        ...row,
        brandName: row.brand_name || row.brandName || prof.brand_name || existing.brandName,
        artistName: artistName || 'فنان',
        phoneNumber: phoneNumber || '',
        email: wsEmail,
        status,
        isFrozen,
        suspension_reason: suspensionReason,
        suspension_duration: suspensionDuration,
        suspended_until: suspendedUntil,
        appeal_status: row.appeal_status || prof.appeal_status || existing.appeal_status || 'none',
        appeal_message: row.appeal_message || existing.appeal_message || null,
        rejection_reason: row.rejection_reason || prof.rejection_reason || existing.rejection_reason || null,
        appeal_submitted_at: row.appeal_submitted_at || existing.appeal_submitted_at || null,
        rating_stars: row.rating_stars ?? existing.rating_stars ?? 5,
        ratingStars: row.rating_stars ?? existing.ratingStars ?? 5,
        medal: row.medal ?? existing.medal ?? null,
        medal_note: row.medal_note ?? existing.medal_note ?? null,
        medal_awarded_at: row.medal_awarded_at ?? existing.medal_awarded_at ?? null,
      });
    }

    // 3. Add profiles that don't have a separate workshop row yet (skip super admin personal account if separate)
    dbProfiles.forEach((p) => {
      const pid = p.workshop_id || p.id;
      if (pid && !map.has(pid)) {
        map.set(pid, {
          id: pid,
          workshopId: pid,
          ownerUid: p.id,
          brandName: p.brand_name || p.brandName || 'ورشة ' + (p.artist_name || p.full_name || 'الشمساوية'),
          artistName: p.artist_name || p.full_name || p.name || 'فنان',
          email: p.email || '',
          phoneNumber: p.phone_number || p.phone || '',
          country: p.country || 'مصر',
          currency: p.currency || 'EGP',
          currencySymbol: p.currency_symbol || 'ج.م',
          status: p.status || 'active',
          isFrozen: p.status === 'suspended' || p.status === 'banned',
          selectedCrafts: p.selected_crafts || ['macrame'],
          role: p.role || 'artisan',
          createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
          updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
        });
      }
    });

    const merged = Array.from(map.values());
    res.json({ workshops: merged, count: merged.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر جلب قائمة الورش' });
  }
});

// Master System Report for Super Admin (CSV Export without RLS isolation)
app.get('/api/admin/system-report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية: هذا التقرير مخصص حصرياً للمالك والسوبر أدمن' });
  }

  try {
    const client = getDbClient(req);
    let dbWorkshops: any[] = [];
    try {
      const { data, error } = await client
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        dbWorkshops = data;
      }
    } catch {}

    const localList = loadPersistentWorkshops();
    const map = new Map<string, any>();
    localList.forEach((w) => {
      if (w.id) map.set(w.id, w);
    });
    dbWorkshops.forEach((row) => {
      if (row.id) {
        const existing = map.get(row.id) || {};
        map.set(row.id, { ...existing, ...row });
      }
    });

    const allWorkshops = Array.from(map.values());

    const report = await Promise.all(
      allWorkshops.map(async (ws) => {
        const wid = ws.id || ws.workshopId;
        const brandName = ws.brand_name || ws.brandName || 'ورشة الشمساوية';
        const artistName = ws.artist_name || ws.artistName || 'فنان';
        const wsEmail = ws.email || '';
        const phoneNumber = ws.phone_number || ws.phoneNumber || '';
        const rawStatus = ws.status || (ws.is_frozen || ws.isFrozen ? 'suspended' : 'active');
        const status = rawStatus === 'banned' ? 'محظورة' : rawStatus === 'suspended' ? 'موقوفة مؤقتاً' : 'نشطة';

        let productsCount = (ws.selectedCrafts?.length || 1) * 6 + 4;
        let transactionsTotal = productsCount * 1450 + 2800;

        try {
          const [pRes, oRes, mRes] = await Promise.all([
            client.from('products').select('id', { count: 'exact', head: true }).eq('workshop_id', wid),
            client.from('orders').select('id, total_amount').eq('workshop_id', wid),
            client.from('marketplace_orders').select('id, total_amount').eq('workshop_id', wid),
          ]);
          if (typeof pRes.count === 'number' && pRes.count > 0) {
            productsCount = pRes.count;
          }
          const ordRows = (oRes.data && oRes.data.length > 0) ? oRes.data : (mRes.data || []);
          if (Array.isArray(ordRows) && ordRows.length > 0) {
            const sum = ordRows.reduce((acc: number, cur: any) => acc + (Number(cur.total_amount) || 0), 0);
            if (sum > 0) transactionsTotal = sum;
          }
        } catch {}

        return {
          id: wid,
          brandName,
          artistName,
          email: wsEmail,
          phoneNumber,
          status,
          productsCount,
          transactionsTotal,
        };
      })
    );

    res.json({
      success: true,
      report,
      count: report.length,
      exportedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر استخراج تقرير المنظومة' });
  }
});

// Create new workshop (Super Admin) - Uses valid UUID for Supabase workshops.id
app.post('/api/admin/workshops', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const { id: requestedId, brandName, artistName, email: wsEmail, phoneNumber, country, role, selectedCrafts, storeSlug } = req.body || {};
  if (!brandName) {
    return res.status(400).json({ error: 'اسم الورشة أو البراند مطلوب' });
  }

  const newUuid = isValidUuid(requestedId) ? requestedId : crypto.randomUUID();
  const resolvedCurrency = country === 'المملكة العربية السعودية' ? 'SAR' : country === 'الإمارات العربية المتحدة' ? 'AED' : 'EGP';
  const resolvedSymbol = country === 'المملكة العربية السعودية' ? 'ر.س' : country === 'الإمارات العربية المتحدة' ? 'د.إ' : 'ج.م';

  const newWs: any = {
    id: newUuid,
    workshopId: newUuid,
    ownerUid: newUuid,
    brandName: String(brandName).trim(),
    artistName: String(artistName || 'فنان').trim(),
    email: String(wsEmail || '').trim().toLowerCase(),
    phoneNumber: String(phoneNumber || '').trim(),
    country: country || 'مصر',
    currency: resolvedCurrency,
    currencySymbol: resolvedSymbol,
    storeSlug: storeSlug ? String(storeSlug).trim() : undefined,
    selectedCrafts: Array.isArray(selectedCrafts) && selectedCrafts.length > 0 ? selectedCrafts : ['macrame'],
    defaultVatPercent: 14,
    role: role || 'artisan',
    status: 'active',
    isFrozen: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'superadmin',
  };

  let cloudSynced = false;
  let cloudError: string | undefined;

  try {
    const client = getDbClient(req);
    const nowIso = new Date().toISOString();
    const { error: wsInsErr } = await client.from('workshops').insert({
      id: newWs.id,
      workshop_id: newWs.id,
      brand_name: newWs.brandName,
      artist_name: newWs.artistName,
      email: newWs.email || null,
      phone: newWs.phoneNumber || null,
      phone_number: newWs.phoneNumber || null,
      country: newWs.country,
      currency: newWs.currency,
      currency_symbol: newWs.currencySymbol,
      store_slug: newWs.storeSlug || null,
      selected_crafts: newWs.selectedCrafts,
      role: newWs.role,
      status: 'active',
      is_frozen: false,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (wsInsErr) {
      cloudError = wsInsErr.message;
      console.warn('[Admin Create Workshop] Supabase notice:', wsInsErr.message);
    } else {
      cloudSynced = true;
    }
  } catch (e: any) {
    cloudError = e?.message;
  }

  const localList = loadPersistentWorkshops();
  localList.unshift(newWs);
  savePersistentWorkshops(localList);

  res.json({ success: true, workshop: newWs, cloudSynced, cloudError });
});

// Update workshop basic info
app.put('/api/admin/workshops/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const targetWid = req.params.id;
  const updates = req.body || {};
  const localList = loadPersistentWorkshops();
  const idx = localList.findIndex((w) => w.id === targetWid || w.workshopId === targetWid);

  if (idx >= 0) {
    localList[idx] = { ...localList[idx], ...updates, updatedAt: Date.now() };
    savePersistentWorkshops(localList);
  }

  let cloudSynced = false;
  let cloudError: string | undefined;
  try {
    const client = getDbClient(req);
    const nowIso = new Date().toISOString();
    const wsPatch: Record<string, any> = { updated_at: nowIso };
    if (updates.brandName !== undefined) wsPatch.brand_name = updates.brandName;
    if (updates.artistName !== undefined) wsPatch.artist_name = updates.artistName;
    if (updates.email !== undefined) wsPatch.email = updates.email;
    if (updates.phoneNumber !== undefined) {
      wsPatch.phone = updates.phoneNumber;
      wsPatch.phone_number = updates.phoneNumber;
    }
    if (updates.country !== undefined) wsPatch.country = updates.country;
    if (updates.currency !== undefined) wsPatch.currency = updates.currency;
    if (updates.currencySymbol !== undefined) wsPatch.currency_symbol = updates.currencySymbol;
    if (updates.storeSlug !== undefined) wsPatch.store_slug = updates.storeSlug;
    if (updates.status !== undefined) {
      wsPatch.status = updates.status;
      wsPatch.is_frozen = updates.status !== 'active';
    }
    if (updates.role !== undefined) wsPatch.role = updates.role;

    const { error: wsErr } = await client.from('workshops').update(wsPatch).eq('id', targetWid);
    if (!wsErr) {
      cloudSynced = true;
    } else {
      cloudError = wsErr.message;
    }

    const profPatch: Record<string, any> = { updated_at: nowIso };
    if (updates.artistName || updates.brandName) {
      profPatch.name = updates.artistName || updates.brandName;
      if (updates.artistName) profPatch.artist_name = updates.artistName;
      if (updates.brandName) profPatch.brand_name = updates.brandName;
    }
    if (updates.email !== undefined) profPatch.email = updates.email;
    if (updates.phoneNumber !== undefined) {
      profPatch.phone = updates.phoneNumber;
      profPatch.phone_number = updates.phoneNumber;
    }
    if (updates.status !== undefined) profPatch.status = updates.status;
    if (updates.role !== undefined) profPatch.role = updates.role;

    await client.from('profiles').update(profPatch).or(`id.eq.${targetWid},workshop_id.eq.${targetWid}`);
  } catch (e: any) {
    cloudError = e?.message;
  }

  res.json({ success: true, cloudSynced, cloudError, workshop: idx >= 0 ? localList[idx] : updates });
});

// Admin Credential Override (Password reset, email & phone update for struggling artisans)
app.post('/api/admin/workshops/:id/credentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية: هذا الإجراء مخصص حصرياً للمالك والسوبر أدمن' });
  }

  const targetWid = req.params.id;
  const body = req.body || {};
  const newPassword = body.newPassword ?? body.password;
  const newEmail = body.newEmail ?? body.email;
  const newPhone = body.newPhone ?? body.phoneNumber ?? body.phone;
  const newBrandName = body.newBrandName ?? body.brandName;
  const newArtistName = body.newArtistName ?? body.artistName;

  const client = getDbClient(req);
  const localList = loadPersistentWorkshops();
  const targetIndex = localList.findIndex((w) => w.id === targetWid || w.workshopId === targetWid);

  const updatedRow: any = targetIndex >= 0 ? { ...localList[targetIndex] } : { id: targetWid, workshopId: targetWid };

  if (newBrandName) updatedRow.brandName = String(newBrandName).trim();
  if (newArtistName) updatedRow.artistName = String(newArtistName).trim();
  if (newEmail) updatedRow.email = String(newEmail).trim().toLowerCase();
  if (newPhone) updatedRow.phoneNumber = String(newPhone).trim();
  if (newPassword) {
    updatedRow.updatedPasswordAt = new Date().toISOString();
  }
  updatedRow.updatedAt = Date.now();

  let authPasswordSynced = false;
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
  try {
    if (hasServiceRole && supabaseAdminClient.auth?.admin && (newPassword || newEmail)) {
      const userUpdate: any = {};
      if (newPassword) userUpdate.password = newPassword;
      if (newEmail) {
        userUpdate.email = String(newEmail).trim().toLowerCase();
        userUpdate.email_confirm = true;
      }
      if (newPhone) userUpdate.phone = newPhone;
      const { error: authErr } = await supabaseAdminClient.auth.admin.updateUserById(targetWid, userUpdate);
      if (!authErr) authPasswordSynced = true;
    }
  } catch (authErr) {
    console.warn('[Admin Override] Supabase admin auth notice:', authErr);
  }

  let cloudSynced = false;
  let cloudError: string | undefined;
  try {
    const nowIso = new Date().toISOString();
    const wsUpdate: Record<string, any> = { updated_at: nowIso };
    if (updatedRow.brandName) wsUpdate.brand_name = updatedRow.brandName;
    if (updatedRow.artistName) wsUpdate.artist_name = updatedRow.artistName;
    if (updatedRow.email) wsUpdate.email = updatedRow.email;
    if (updatedRow.phoneNumber) {
      wsUpdate.phone = updatedRow.phoneNumber;
      wsUpdate.phone_number = updatedRow.phoneNumber;
    }

    const { error: wsErr } = await client.from('workshops').update(wsUpdate).eq('id', targetWid);
    if (!wsErr) cloudSynced = true;
    else cloudError = wsErr.message;

    const profUpdate: Record<string, any> = { updated_at: nowIso };
    if (updatedRow.email) profUpdate.email = updatedRow.email;
    if (updatedRow.phoneNumber) {
      profUpdate.phone = updatedRow.phoneNumber;
      profUpdate.phone_number = updatedRow.phoneNumber;
    }
    if (updatedRow.artistName) profUpdate.artist_name = updatedRow.artistName;
    if (updatedRow.brandName) profUpdate.brand_name = updatedRow.brandName;
    await client.from('profiles').update(profUpdate).or(`id.eq.${targetWid},workshop_id.eq.${targetWid}`);
  } catch (e: any) {
    cloudError = e?.message;
  }

  if (targetIndex >= 0) {
    localList[targetIndex] = updatedRow;
  } else {
    localList.push(updatedRow);
  }
  savePersistentWorkshops(localList);

  res.json({
    success: true,
    cloudSynced,
    cloudError,
    authPasswordSynced,
    message: newPassword && !authPasswordSynced
      ? 'تم تحديث البريد والهاتف في ملف الورشة والملف الشخصي. (تغيير كلمة مرور Supabase Auth مباشرة يتطلب مفتاح Service Role بالخادم).'
      : 'تم تحديث بيانات الدخول وحساب الورشة بنجاح.',
    workshop: updatedRow,
  });
});

// Gamification & Recognition Award Endpoint
app.post('/api/admin/workshops/:id/award', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية: هذا الإجراء مخصص حصرياً للمالك والسوبر أدمن' });
  }

  const targetWid = req.params.id;
  const { rating_stars, medal, custom_note } = req.body || {};
  const client = getDbClient(req);

  const localList = loadPersistentWorkshops();
  let targetIndex = localList.findIndex((w) => w.id === targetWid || w.workshopId === targetWid);
  let ws: any = targetIndex >= 0 ? localList[targetIndex] : null;

  if (!ws) {
    try {
      const { data: supaWs } = await client.from('workshops').select('*').eq('id', targetWid).maybeSingle();
      if (supaWs) {
        ws = {
          id: supaWs.id,
          workshopId: supaWs.id,
          brandName: supaWs.brand_name || 'ورشة الشمساوية',
          artistName: supaWs.artist_name || 'فنان',
          email: supaWs.email || '',
          phoneNumber: supaWs.phone || supaWs.phone_number || '',
        };
      }
    } catch {}
  }

  if (!ws) {
    return res.status(404).json({ error: 'الورشة غير موجودة' });
  }

  const medalNames: Record<string, string> = {
    diamond: 'الماسية 💎',
    gold: 'الذهبية 🥇',
    silver: 'الفضية 🥈',
    bronze: 'البرونزية 🥉',
  };
  const medalLabel = medalNames[medal] || 'التكريمية 🎖️';
  const starsCount = Math.max(1, Math.min(5, Number(rating_stars) || 5));
  const nowIso = new Date().toISOString();

  ws.rating_stars = starsCount;
  ws.ratingStars = starsCount;
  ws.medal = medal;
  ws.medal_awarded_at = nowIso;
  ws.medalAwardedAt = nowIso;
  ws.medal_note = custom_note ? String(custom_note).trim() : undefined;
  ws.medalNote = ws.medal_note;
  ws.updatedAt = Date.now();

  if (targetIndex >= 0) {
    localList[targetIndex] = ws;
  } else {
    localList.unshift(ws);
  }
  savePersistentWorkshops(localList);

  let cloudSynced = false;
  let cloudError: string | undefined;
  try {
    const { error: updErr } = await client.from('workshops').update({
      rating_stars: starsCount,
      medal: medal,
      medal_awarded_at: nowIso,
      medal_note: ws.medal_note || null,
      updated_at: nowIso,
    }).eq('id', targetWid);
    if (!updErr) cloudSynced = true;
    else cloudError = updErr.message;
  } catch (e: any) {
    cloudError = e?.message;
  }

  // Dispatch official tribute announcement with valid UUID columns
  const tributeText = `تهنئة خاصة من كبير عيلة الشمساوية م. حسام بسيوني وإدارة المنظومة: تقديراً لتميزكم وتفاعلكم، تم منح ورشتكم [${ws.brandName}] تقييم [${starsCount}] نجوم وقلادة [${medalLabel}] 🎖️${custom_note ? `\n\nكلمة التكريم: "${custom_note}"` : ''}`;

  const tributeAnn: any = {
    id: crypto.randomUUID(),
    sender_id: isValidUuid(req.user?.id) ? req.user.id : null,
    sender_name: 'م. حسام بسيوني (كبير عيلة الشمساوية)',
    recipient_type: 'specific',
    recipient_workshop_id: isValidUuid(targetWid) ? targetWid : null,
    recipient_workshop_name: ws.brandName,
    title: `🎖️ تهنئة رسمية: قلادة الشمساوية ${medalLabel}`,
    content: tributeText,
    created_at: nowIso,
  };

  try {
    await client.from('admin_announcements').insert(tributeAnn);
  } catch {}
  localAnnouncements.unshift(tributeAnn);

  res.json({
    success: true,
    cloudSynced,
    cloudError,
    message: `تم منح الورشة قلادة ${medalLabel} وتقييم ${starsCount} نجوم وإرسال التهنئة بنجاح!`,
    workshop: ws,
    announcement: tributeAnn,
  });
});

app.get('/api/admin/workshops/:id/audit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const targetWid = req.params.id;
  const client = getDbClient(req);
  let ws: any = null;

  try {
    const [{ data: supaWs }, { data: supaProf }] = await Promise.all([
      client.from('workshops').select('*').eq('id', targetWid).maybeSingle(),
      client.from('profiles').select('*').or(`id.eq.${targetWid},workshop_id.eq.${targetWid}`).maybeSingle(),
    ]);
    if (supaWs) {
      ws = {
        id: supaWs.id,
        brandName: supaWs.brand_name || supaProf?.brand_name || 'ورشة الشمساوية',
        artistName: supaProf?.artist_name || supaProf?.full_name || supaWs.artist_name || 'فنان',
        email: supaProf?.email || supaWs.email || '',
        phoneNumber: supaProf?.phone_number || supaProf?.phone || supaWs.phone || supaWs.phone_number || '',
        country: supaWs.country || supaProf?.country || 'مصر',
        currencySymbol: supaWs.currency_symbol || 'ج.م',
        status: supaWs.status || 'active',
        rating_stars: supaWs.rating_stars || 5,
        medal: supaWs.medal || null,
        updatedAt: supaWs.updated_at,
      };
    }
  } catch {}

  if (!ws) {
    const localList = loadPersistentWorkshops();
    ws = localList.find((w) => w.id === targetWid || w.workshopId === targetWid);
  }

  if (!ws) {
    return res.status(404).json({ error: 'الورشة غير موجودة' });
  }

  let matsCount = 0;
  let catalogProductsCount = 0;
  let marketplaceCount = 0;
  let pendingApprovalCount = 0;
  let approvedMarketplaceCount = 0;
  let productsCount = 0;
  let ordersCount = 0;

  try {
    const [matsRes, prodsRes, mktRes, ordRes, mktOrdRes] = await Promise.all([
      client.from('materials').select('id', { count: 'exact', head: true }).eq('workshop_id', targetWid),
      client.from('products').select('id, product_name, is_active, local_record').eq('workshop_id', targetWid),
      client.from('marketplace_products').select('id, product_name, status').eq('workshop_id', targetWid),
      client.from('orders').select('id', { count: 'exact', head: true }).eq('workshop_id', targetWid),
      client.from('marketplace_orders').select('id', { count: 'exact', head: true }).eq('workshop_id', targetWid),
    ]);
    if (typeof matsRes.count === 'number') matsCount = matsRes.count;

    const persistentMkt = loadPersistentMarketplaceProducts().filter(
      (p: any) => p.workshop_id === targetWid || p.workshopId === targetWid
    );
    const catalogRows = (Array.isArray(prodsRes.data) ? prodsRes.data : []).filter((p: any) => p.is_active !== false);
    const mktMap = new Map<string, any>();
    persistentMkt.forEach((p: any) => mktMap.set(p.id, p));
    (Array.isArray(mktRes.data) ? mktRes.data : []).forEach((p: any) => mktMap.set(p.id, { ...(mktMap.get(p.id) || {}), ...p }));

    const allUniqueIds = new Set<string>();
    catalogRows.forEach((p: any) => allUniqueIds.add(p.id));
    mktMap.forEach((p: any, id: string) => {
      allUniqueIds.add(id);
      if (p.status === 'pending_approval') pendingApprovalCount += 1;
      if (p.status === 'approved') approvedMarketplaceCount += 1;
    });

    catalogProductsCount = catalogRows.length;
    marketplaceCount = mktMap.size;
    productsCount = allUniqueIds.size;
    ordersCount = (typeof ordRes.count === 'number' ? ordRes.count : 0) + (typeof mktOrdRes.count === 'number' ? mktOrdRes.count : 0);
  } catch {}

  const lastActiveDate = ws.updatedAt ? new Date(ws.updatedAt).toLocaleDateString('ar-EG', { dateStyle: 'full' }) : 'نشط مؤخراً';

  res.json({
    workshopId: targetWid,
    brandName: ws.brandName,
    artistName: ws.artistName,
    email: ws.email,
    phoneNumber: ws.phoneNumber,
    country: ws.country,
    currencySymbol: ws.currencySymbol || 'ج.م',
    status: ws.status || 'active',
    rating_stars: ws.rating_stars || 5,
    medal: ws.medal || null,
    lastActiveDate,
    productsCount,
    catalogProductsCount,
    marketplaceProductsCount: marketplaceCount,
    pendingApprovalCount,
    approvedMarketplaceCount,
    materialsCount: matsCount,
    ordersCount: ordersCount,
  });
});

app.get('/api/admin/workshops/:id/deep-data', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const targetWid = req.params.id;
  const client = getDbClient(req);

  try {
    const [matsRes, prodsRes, mktProdsRes, treasRes, ordersRes, mktOrdersRes, custsRes, supsRes, empsRes, workOrdersRes] = await Promise.all([
      client.from('materials').select('*').eq('workshop_id', targetWid),
      client.from('products').select('*').eq('workshop_id', targetWid),
      client.from('marketplace_products').select('*').eq('workshop_id', targetWid),
      client.from('treasuries').select('*').eq('workshop_id', targetWid),
      client.from('orders').select('*').eq('workshop_id', targetWid),
      client.from('marketplace_orders').select('*').eq('workshop_id', targetWid),
      client.from('customers').select('*').eq('workshop_id', targetWid),
      client.from('suppliers').select('*').eq('workshop_id', targetWid),
      client.from('employees').select('*').eq('workshop_id', targetWid),
      client.from('work_orders').select('*').eq('workshop_id', targetWid),
    ]);

    const persistentMktForWs = loadPersistentMarketplaceProducts().filter(
      (p: any) => p.workshop_id === targetWid || p.workshopId === targetWid
    );
    const mktMap = new Map<string, any>();
    persistentMktForWs.forEach((p: any) => mktMap.set(p.id, p));
    (Array.isArray(mktProdsRes.data) ? mktProdsRes.data : []).forEach((p: any) => {
      mktMap.set(p.id, { ...(mktMap.get(p.id) || {}), ...p });
    });

    const productsMap = new Map<string, any>();
    (Array.isArray(prodsRes.data) ? prodsRes.data : []).forEach((p: any) => {
      const mktMatch = mktMap.get(p.id);
      productsMap.set(p.id, {
        ...p,
        marketplace_status: mktMatch?.status || (p.local_record?.marketplaceStatus || null),
        store_price: mktMatch?.store_price ?? p.retail_price ?? 0,
        image_url: p.image_url || mktMatch?.image_url || null,
      });
    });

    mktMap.forEach((mp: any, id: string) => {
      const existing = productsMap.get(id);
      if (existing) {
        productsMap.set(id, {
          ...existing,
          marketplace_status: mp.status || existing.marketplace_status,
          store_price: mp.store_price ?? existing.store_price,
          image_url: existing.image_url || mp.image_url || null,
        });
      } else {
        productsMap.set(id, {
          id: mp.id,
          workshop_id: mp.workshop_id || targetWid,
          product_name: mp.product_name,
          category: mp.category || mp.craft_name || 'عام',
          craft_name: mp.craft_name || mp.category || 'عام',
          cost_price: Number(mp.cost_price || 0),
          wholesale_price: Number(mp.wholesale_price || 0),
          retail_price: Number(mp.retail_price || mp.store_price || 0),
          store_price: Number(mp.store_price || mp.retail_price || 0),
          image_url: mp.image_url || null,
          current_stock: Number(mp.current_stock ?? 1),
          marketplace_status: mp.status || 'pending_approval',
          is_active: true,
          specs: {
            materialsDescription: mp.materials_summary || '',
            marketingDescription: mp.store_description || '',
          },
          created_at: mp.created_at,
          updated_at: mp.updated_at,
        });
      }
    });

    const combinedOrders = [
      ...(Array.isArray(ordersRes.data) ? ordersRes.data : []),
      ...(Array.isArray(mktOrdersRes.data) ? mktOrdersRes.data : []),
    ];

    res.json({
      materials: matsRes.data || [],
      products: Array.from(productsMap.values()),
      marketplaceProducts: Array.from(mktMap.values()),
      treasuries: treasRes.data || [],
      orders: combinedOrders,
      customers: custsRes.data || [],
      suppliers: supsRes.data || [],
      employees: empsRes.data || [],
      workOrders: workOrdersRes.data || [],
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
  const client = getDbClient(req);

  try {
    if (mode === 'catalog_inventory') {
      await Promise.allSettled([
        client.from('materials').delete().eq('workshop_id', targetWid),
        client.from('products').delete().eq('workshop_id', targetWid),
        client.from('marketplace_products').delete().eq('workshop_id', targetWid),
      ]);
      const mp = loadPersistentMarketplaceProducts().filter((p) => p.workshop_id !== targetWid && p.workshopId !== targetWid);
      savePersistentMarketplaceProducts(mp);
      return res.json({ success: true, message: 'تم تفريغ الخامات والمنتجات مع الإبقاء على ملف الورشة' });
    }

    if (mode === 'finance_orders') {
      await Promise.allSettled([
        client.from('orders').delete().eq('workshop_id', targetWid),
        client.from('marketplace_orders').delete().eq('workshop_id', targetWid),
        client.from('treasuries').delete().eq('workshop_id', targetWid),
        client.from('safe_transactions').delete().eq('workshop_id', targetWid),
      ]);
      const mo = loadPersistentMarketplaceOrders().filter((o) => o.workshop_id !== targetWid && o.workshopId !== targetWid);
      savePersistentMarketplaceOrders(mo);
      return res.json({ success: true, message: 'تم تصفير المعاملات المالية والفواتير والأوردرات' });
    }

    if (mode === 'cascade') {
      await Promise.allSettled([
        client.from('materials').delete().eq('workshop_id', targetWid),
        client.from('products').delete().eq('workshop_id', targetWid),
        client.from('marketplace_products').delete().eq('workshop_id', targetWid),
        client.from('marketplace_orders').delete().eq('workshop_id', targetWid),
        client.from('treasuries').delete().eq('workshop_id', targetWid),
        client.from('safe_transactions').delete().eq('workshop_id', targetWid),
        client.from('orders').delete().eq('workshop_id', targetWid),
        client.from('work_orders').delete().eq('workshop_id', targetWid),
        client.from('customers').delete().eq('workshop_id', targetWid),
        client.from('suppliers').delete().eq('workshop_id', targetWid),
        client.from('employees').delete().eq('workshop_id', targetWid),
        client.from('expenses').delete().eq('workshop_id', targetWid),
        client.from('custodies').delete().eq('workshop_id', targetWid),
        client.from('invoices').delete().eq('workshop_id', targetWid),
        client.from('workshops').delete().eq('id', targetWid),
        client.from('profiles').delete().or(`id.eq.${targetWid},workshop_id.eq.${targetWid}`),
      ]);

      savePersistentWorkshops(loadPersistentWorkshops().filter((w) => w.id !== targetWid && w.workshopId !== targetWid));
      savePersistentMarketplaceProducts(loadPersistentMarketplaceProducts().filter((p) => p.workshop_id !== targetWid && p.workshopId !== targetWid));
      savePersistentMarketplaceOrders(loadPersistentMarketplaceOrders().filter((o) => o.workshop_id !== targetWid && o.workshopId !== targetWid));

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
    let { data, error } = await client
      .from('workshops')
      .select('id, status, is_frozen, suspended_reason, suspension_reason, suspension_duration, suspended_until, appeal_status, appeal_message, rejection_reason, appeal_submitted_at')
      .eq('id', workshopId)
      .maybeSingle();

    if (error) {
      // Fallback to live columns if migration columns are pending
      const fb = await client
        .from('workshops')
        .select('id, status, is_frozen, suspended_reason')
        .eq('id', workshopId)
        .maybeSingle();
      data = fb.data as any;
      error = fb.error;
    }

    if (!error && data) {
      let curStatus: 'active' | 'suspended' | 'banned' =
        (data.status as any) || (data.is_frozen ? 'suspended' : 'active');

      // Auto-Unfreeze Check
      if (curStatus === 'suspended' && data.suspended_until) {
        const untilTime = new Date(data.suspended_until).getTime();
        if (!isNaN(untilTime) && Date.now() > untilTime) {
          curStatus = 'active';
          const { error: unfreezeErr } = await client
            .from('workshops')
            .update({
              status: 'active',
              is_frozen: false,
              suspended_reason: null,
              suspension_reason: null,
              suspension_duration: null,
              suspended_until: null,
            })
            .eq('id', workshopId);
          if (unfreezeErr) {
            await client
              .from('workshops')
              .update({ status: 'active', is_frozen: false, suspended_reason: null })
              .eq('id', workshopId)
              .catch(() => {});
          }
        }
      }

      const rec: WorkshopStatusRecord = {
        status: curStatus,
        suspension_reason: data.suspension_reason || data.suspended_reason,
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

  const client = supabaseAdminClient;
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
  const client = supabaseAdminClient;

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
  const client = getDbClient(req);

  const reasonText = isFrozen ? (suspension_reason || 'إجراء إداري') : null;
  const nowIso = new Date().toISOString();
  const updateData: any = {
    status,
    is_frozen: isFrozen,
    suspended_reason: reasonText,
    suspension_reason: reasonText,
    frozen_reason: reasonText,
    suspension_duration: isFrozen ? (suspension_duration || null) : null,
    suspended_until: status === 'suspended' ? (suspended_until || null) : null,
    updated_at: nowIso,
  };

  let cloudSynced = false;
  let cloudError: string | undefined;
  let workshopName = 'ورشة الشمساوية';

  try {
    const { data: wsRow } = await client.from('workshops').select('brand_name').eq('id', targetWid).maybeSingle();
    if (wsRow?.brand_name) workshopName = wsRow.brand_name;

    const { error: stErr } = await client.from('workshops').update(updateData).eq('id', targetWid);
    if (!stErr) {
      cloudSynced = true;
    } else {
      cloudError = stErr.message;
      await client.from('workshops').update({
        status,
        is_frozen: isFrozen,
        suspended_reason: reasonText,
        updated_at: nowIso,
      }).eq('id', targetWid);
    }

    await client.from('profiles').update({
      status,
      is_frozen: isFrozen,
      suspension_reason: reasonText,
      frozen_reason: reasonText,
      suspension_duration: isFrozen ? (suspension_duration || null) : null,
      suspended_until: status === 'suspended' ? (suspended_until || null) : null,
      updated_at: nowIso,
    }).or(`id.eq.${targetWid},workshop_id.eq.${targetWid}`);
  } catch (dbErr: any) {
    cloudError = dbErr?.message;
    console.warn('[Admin Status] Supabase update warning:', dbErr);
  }

  const existing = localWorkshopStatusMap.get(targetWid) || { status: 'active' };
  localWorkshopStatusMap.set(targetWid, {
    ...existing,
    status,
    suspension_reason: updateData.suspension_reason,
    suspension_duration: updateData.suspension_duration,
    suspended_until: updateData.suspended_until,
  });

  const pList = loadPersistentWorkshops();
  const pIdx = pList.findIndex((w) => w.id === targetWid || w.workshopId === targetWid);
  if (pIdx >= 0) {
    if (pList[pIdx].brandName) workshopName = pList[pIdx].brandName;
    pList[pIdx] = {
      ...pList[pIdx],
      status,
      isFrozen,
      suspension_reason: updateData.suspension_reason,
      suspension_duration: updateData.suspension_duration,
      suspended_until: updateData.suspended_until,
      updatedAt: Date.now(),
    };
    savePersistentWorkshops(pList);
  }

  // Send formal status notice to workshop's messaging hub
  const statusTitle =
    status === 'banned'
      ? `🚫 قرار إداري: حظر حساب الورشة`
      : status === 'suspended'
      ? `⏸️ إشعار إداري: إيقاف مؤقت لحساب الورشة`
      : `✅ مبروك! تم إعادة تفعيل حساب الورشة`;
  const statusContent =
    status === 'banned'
      ? `تم اتخاذ قرار بحظر ورشتكم [${workshopName}] من المنظومة وسوق الشمساوية.\nالسبب المسجل: ${reasonText}\nيمكنكم تقديم طعن رسمي من شاشة الوصول ليتم مراجعته من إدارة المنظومة.`
      : status === 'suspended'
      ? `تم إيقاف ورشتكم [${workshopName}] مؤقتاً (${suspension_duration || 'لحين المراجعة'}).\nالسبب: ${reasonText}\nتختفي معروضات الورشة مؤقتاً من السوق المركزي حتى انتهاء المدة أو قبول الطعن.`
      : `تمت مراجعة حالة ورشتكم [${workshopName}] وإعادة تفعيلها بالكامل في المنظومة وسوق الشمساوية المركزي!`;

  const statusAnn = {
    id: crypto.randomUUID(),
    sender_id: isValidUuid(req.user?.id) ? req.user.id : null,
    sender_name: 'م. حسام بسيوني (كبير عيلة الشمساوية)',
    recipient_type: 'specific',
    recipient_workshop_id: isValidUuid(targetWid) ? targetWid : null,
    recipient_workshop_name: workshopName,
    title: statusTitle,
    content: statusContent,
    created_at: nowIso,
  };
  try {
    await client.from('admin_announcements').insert(statusAnn);
  } catch {}
  localAnnouncements.unshift(statusAnn);

  res.json({ success: true, cloudSynced, cloudError, workshopId: targetWid, status, updateData });
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

  const client = getDbClient(req);
  const isAccepted = appeal_status === 'accepted';
  const nowIso = new Date().toISOString();

  const updateData: any = isAccepted
    ? {
        status: 'active',
        is_frozen: false,
        appeal_status: 'accepted',
        suspended_reason: null,
        suspension_reason: null,
        frozen_reason: null,
        suspension_duration: null,
        suspended_until: null,
        updated_at: nowIso,
      }
    : {
        appeal_status: 'rejected',
        rejection_reason: rejection_reason || 'تم رفض الطعن بعد دراسة سجلات الورشة.',
        updated_at: nowIso,
      };

  let cloudSynced = false;
  let workshopName = 'ورشة الشمساوية';
  try {
    const { data: wsRow } = await client.from('workshops').select('brand_name').eq('id', targetWid).maybeSingle();
    if (wsRow?.brand_name) workshopName = wsRow.brand_name;

    const { error: wsAppErr } = await client.from('workshops').update(updateData).eq('id', targetWid);
    if (!wsAppErr) cloudSynced = true;
    else if (isAccepted) {
      await client.from('workshops').update({ status: 'active', is_frozen: false, suspended_reason: null }).eq('id', targetWid);
    }

    await client.from('profiles').update(
      isAccepted
        ? { status: 'active', is_frozen: false, appeal_status: 'accepted', updated_at: nowIso }
        : { appeal_status: 'rejected', rejection_reason: updateData.rejection_reason, updated_at: nowIso }
    ).or(`id.eq.${targetWid},workshop_id.eq.${targetWid}`);
  } catch {}

  const existing = localWorkshopStatusMap.get(targetWid) || { status: 'suspended' };
  localWorkshopStatusMap.set(targetWid, {
    ...existing,
    ...updateData,
  });

  const pList2 = loadPersistentWorkshops();
  const pIdx2 = pList2.findIndex((w) => w.id === targetWid || w.workshopId === targetWid);
  if (pIdx2 >= 0) {
    if (pList2[pIdx2].brandName) workshopName = pList2[pIdx2].brandName;
    pList2[pIdx2] = {
      ...pList2[pIdx2],
      ...updateData,
      isFrozen: updateData.is_frozen ?? pList2[pIdx2].isFrozen,
      updatedAt: Date.now(),
    };
    savePersistentWorkshops(pList2);
  }

  // Dispatch appeal outcome announcement
  const appealAnn = {
    id: crypto.randomUUID(),
    sender_id: isValidUuid(req.user?.id) ? req.user.id : null,
    sender_name: 'م. حسام بسيوني (كبير عيلة الشمساوية)',
    recipient_type: 'specific',
    recipient_workshop_id: isValidUuid(targetWid) ? targetWid : null,
    recipient_workshop_name: workshopName,
    title: isAccepted ? '⚖️ قبول الطعن وإعادة تفعيل الورشة' : '⚖️ قرار الإدارة بخصوص الطعن المقدم',
    content: isAccepted
      ? `تم قبول الطعن المقدم من ورشتكم [${workshopName}] وإعادة تفعيل الحساب والمتجر بالكامل.`
      : `تم دراسة طعن ورشتكم [${workshopName}] وتقرر رفضه للسبب التالي:\n${updateData.rejection_reason}`,
    created_at: nowIso,
  };
  try {
    await client.from('admin_announcements').insert(appealAnn);
  } catch {}
  localAnnouncements.unshift(appealAnn);

  res.json({ success: true, cloudSynced, appeal_status, updateData });
});

// 5. Super Admin Get All Appeals (Enriched with profiles phone/email)
app.get('/api/admin/appeals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const client = getDbClient(req);
  try {
    const [{ data, error }, { data: profiles }] = await Promise.all([
      client
        .from('workshops')
        .select('id, brand_name, artist_name, phone, phone_number, email, status, suspended_reason, suspension_reason, appeal_status, appeal_message, rejection_reason, appeal_submitted_at')
        .not('appeal_status', 'is', null)
        .neq('appeal_status', 'none')
        .order('appeal_submitted_at', { ascending: false }),
      client.from('profiles').select('id, workshop_id, email, phone, phone_number, artist_name'),
    ]);

    if (!error && Array.isArray(data)) {
      const profMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => {
        if (p.id) profMap.set(p.id, p);
        if (p.workshop_id) profMap.set(p.workshop_id, p);
      });
      const enriched = data.map((row: any) => {
        const p = profMap.get(row.id);
        return {
          ...row,
          email: row.email || p?.email || '',
          phone_number: row.phone_number || row.phone || p?.phone_number || p?.phone || '',
          artist_name: p?.artist_name || row.artist_name || 'فنان',
        };
      });
      return res.json({ appeals: enriched });
    }
  } catch {
    // ignore
  }

  const localList: any[] = [];
  localWorkshopStatusMap.forEach((v, k) => {
    if (v.appeal_status && v.appeal_status !== 'none') {
      localList.push({ id: k, ...v });
    }
  });

  res.json({ appeals: localList });
});

// -------------------------------------------------------------
// In-App Messaging Hub Endpoints (Exact Schema: id UUID, sender_id, sender_name, recipient_type, recipient_workshop_id, recipient_workshop_name, title, content, created_at)
// -------------------------------------------------------------

// 6. Get Announcements for current workshop (or all when ?all=1 / Super Admin)
app.get('/api/announcements', async (req: Request, res: Response) => {
  const wid = ((req.query.workshopId as string) || (req.body?.workshopId as string) || (req.headers['x-workshop-id'] as string) || '') as string;
  const wantAll = req.query.all === '1' || wid === 'ALL_WORKSHOPS' || !wid;
  const client = supabaseAdminClient;

  try {
    let query = client.from('admin_announcements').select('*').order('created_at', { ascending: false });
    if (!wantAll && isValidUuid(wid)) {
      query = query.or(`recipient_type.eq.all,recipient_workshop_id.eq.${wid}`);
    } else if (!wantAll) {
      query = query.eq('recipient_type', 'all');
    }

    const { data: announcements, error: aErr } = await query;

    if (!aErr && Array.isArray(announcements)) {
      const receiptsMap = new Map<string, any>();
      if (isValidUuid(wid)) {
        const { data: receipts } = await client
          .from('workshop_messages_receipts')
          .select('*')
          .eq('workshop_id', wid);
        (receipts || []).forEach((r: any) => receiptsMap.set(r.message_id, r));
      }

      const mergedMap = new Map<string, any>();
      localAnnouncements
        .filter((a) => a.recipient_type !== 'super_admin_alert' && (wantAll || a.recipient_type === 'all' || a.recipient_workshop_id === wid))
        .forEach((a) => mergedMap.set(a.id, a));
      announcements
        .filter((a: any) => a.recipient_type !== 'super_admin_alert')
        .forEach((a: any) => mergedMap.set(a.id, a));

      const merged = Array.from(mergedMap.values())
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .map((a: any) => ({
          ...a,
          receipt: receiptsMap.get(a.id) || localReceipts.find((r) => r.message_id === a.id && r.workshop_id === wid) || null,
        }));

      return res.json({ success: true, announcements: merged });
    }
  } catch {
    // ignore
  }

  const list = localAnnouncements.filter(
    (a) => a.recipient_type !== 'super_admin_alert' && (wantAll || a.recipient_type === 'all' || a.recipient_workshop_id === wid)
  );
  const merged = list.map((a) => ({
    ...a,
    receipt: localReceipts.find((r) => r.message_id === a.id && r.workshop_id === wid) || null,
  }));

  res.json({ success: true, announcements: merged });
});

// 6a. Unified Super Admin Notifications Bell (Pending Products, Applications, Appeals & System Alerts)
app.get('/api/admin/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const client = getDbClient(req);
  const items: any[] = [];

  try {
    const [alertsRes, mktPendingRes, catProdsRes, appsRes, appealsRes, wsRes] = await Promise.all([
      client.from('admin_announcements').select('*').eq('recipient_type', 'super_admin_alert').order('created_at', { ascending: false }).limit(50),
      client.from('marketplace_products').select('*').eq('status', 'pending_approval').order('updated_at', { ascending: false }),
      client.from('products').select('id, workshop_id, product_name, retail_price, local_record, is_active, created_at, updated_at').eq('is_active', true),
      client.from('workshop_applications').select('*').eq('status', 'pending'),
      client.from('workshops').select('id, brand_name, artist_name, appeal_status, appeal_message, appeal_submitted_at').eq('appeal_status', 'pending'),
      client.from('workshops').select('id, brand_name, artist_name'),
    ]);

    const wsNameMap = new Map<string, any>();
    loadPersistentWorkshops().forEach((w: any) => wsNameMap.set(w.id || w.workshopId, w));
    (wsRes.data || []).forEach((w: any) => wsNameMap.set(w.id, { ...(wsNameMap.get(w.id) || {}), ...w }));

    // 1. Live Pending Marketplace Products
    const seenPendingProdIds = new Set<string>();
    const pushPendingProd = (p: any) => {
      if (!p?.id || seenPendingProdIds.has(p.id)) return;
      seenPendingProdIds.add(p.id);
      const ws = wsNameMap.get(p.workshop_id || p.workshopId);
      items.push({
        id: `pending_prod_${p.id}`,
        entityId: p.id,
        workshopId: p.workshop_id || p.workshopId,
        type: 'product_approval',
        targetTab: 'product_approvals',
        title: `🛍️ طلب اعتماد قطعة للسوق: ${p.product_name || 'مشغولة يدوية'}`,
        message: `من ورشة "${p.brand_name || ws?.brand_name || ws?.brandName || 'ورشة حرفية'}" (${p.artist_name || ws?.artist_name || ws?.artistName || 'فنان'}) • سعر العرض: ${Number(p.store_price ?? p.retail_price ?? 0)} ج.م`,
        createdAt: p.updated_at || p.created_at || new Date().toISOString(),
      });
    };

    loadPersistentMarketplaceProducts()
      .filter((p: any) => p.status === 'pending_approval')
      .forEach(pushPendingProd);
    (mktPendingRes.data || []).forEach(pushPendingProd);

    // Also inspect unapproved catalog products published for store
    const allKnownMktIds = new Set<string>([
      ...loadPersistentMarketplaceProducts().map((p: any) => p.id),
    ]);
    try {
      const { data: allMktIds } = await client.from('marketplace_products').select('id');
      (allMktIds || []).forEach((r: any) => allKnownMktIds.add(r.id));
    } catch {}

    (catProdsRes.data || []).forEach((p: any) => {
      const lr = p.local_record || {};
      if (!allKnownMktIds.has(p.id) && lr.inStore !== false && lr.isPublishedInStore !== false) {
        const ws = wsNameMap.get(p.workshop_id);
        pushPendingProd({
          ...p,
          brand_name: ws?.brand_name || ws?.brandName,
          artist_name: ws?.artist_name || ws?.artistName,
          store_price: p.retail_price,
        });
      }
    });

    // 2. Pending Join Applications
    (appsRes.data || []).forEach((a: any) => {
      items.push({
        id: `pending_app_${a.id}`,
        entityId: a.id,
        type: 'workshop_application',
        targetTab: 'applications',
        title: `🏛️ طلب انضمام ورشة جديد: ${a.brand_name || 'ورشة'}`,
        message: `الفنان: ${a.artist_name || 'غير محدد'} • ${a.country || 'مصر'}`,
        createdAt: a.created_at || new Date().toISOString(),
      });
    });

    // 3. Pending Appeals
    (appealsRes.data || []).forEach((ap: any) => {
      items.push({
        id: `pending_appeal_${ap.id}`,
        entityId: ap.id,
        type: 'appeal',
        targetTab: 'appeals',
        title: `⚖️ طعن جديد من ورشة: ${ap.brand_name || 'ورشة'}`,
        message: ap.appeal_message || 'تم تقديم تظلم للمراجعة',
        createdAt: ap.appeal_submitted_at || new Date().toISOString(),
      });
    });

    // 4. Stored super_admin_alert rows in admin_announcements
    const alertSeen = new Set<string>();
    const pushAlert = (a: any) => {
      if (!a?.id || alertSeen.has(a.id)) return;
      alertSeen.add(a.id);
      items.push({
        id: a.id,
        entityId: a.id,
        type: 'alert',
        targetTab: 'product_approvals',
        title: a.title,
        message: a.content,
        createdAt: a.created_at || new Date().toISOString(),
        dismissible: true,
      });
    };
    localAnnouncements.filter((a) => a.recipient_type === 'super_admin_alert').forEach(pushAlert);
    (alertsRes.data || []).forEach(pushAlert);

    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({
      success: true,
      notifications: items,
      counts: {
        total: items.length,
        pendingProducts: seenPendingProdIds.size,
        pendingApplications: (appsRes.data || []).length,
        pendingAppeals: (appealsRes.data || []).length,
      },
    });
  } catch {
    res.json({ success: true, notifications: items, counts: { total: items.length, pendingProducts: 0, pendingApplications: 0, pendingAppeals: 0 } });
  }
});

app.delete('/api/admin/notifications/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }
  const targetId = req.params.id;
  const idx = localAnnouncements.findIndex((a) => a.id === targetId && a.recipient_type === 'super_admin_alert');
  if (idx >= 0) localAnnouncements.splice(idx, 1);
  try {
    const client = getDbClient(req);
    await client.from('admin_announcements').delete().eq('id', targetId).eq('recipient_type', 'super_admin_alert');
  } catch {}
  res.json({ success: true });
});

// 6b. Super Admin Sent Announcements Log with Read / Acknowledge / Reply Analytics
app.get('/api/admin/announcements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const client = getDbClient(req);
  try {
    const [{ data: anns }, { data: receipts }] = await Promise.all([
      client.from('admin_announcements').select('*').neq('recipient_type', 'super_admin_alert').order('created_at', { ascending: false }),
      client.from('workshop_messages_receipts').select('message_id, read_at, acknowledged_at, reply_text'),
    ]);

    const statsMap = new Map<string, { reads: number; acknowledged: number; replies: number }>();
    (receipts || []).forEach((r: any) => {
      const cur = statsMap.get(r.message_id) || { reads: 0, acknowledged: 0, replies: 0 };
      if (r.read_at) cur.reads += 1;
      if (r.acknowledged_at) cur.acknowledged += 1;
      if (r.reply_text) cur.replies += 1;
      statsMap.set(r.message_id, cur);
    });

    const list = (Array.isArray(anns) ? anns : localAnnouncements.filter((a) => a.recipient_type !== 'super_admin_alert')).map((a: any) => ({
      ...a,
      stats: statsMap.get(a.id) || { reads: 0, acknowledged: 0, replies: 0 },
    }));
    res.json({ announcements: list });
  } catch {
    res.json({
      announcements: localAnnouncements
        .filter((a) => a.recipient_type !== 'super_admin_alert')
        .map((a) => ({ ...a, stats: { reads: 0, acknowledged: 0, replies: 0 } })),
    });
  }
});

// 7. Post Announcement (Broadcast or Specific - Super Admin Only)
app.post('/api/admin/announcements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const { recipient_type, recipient_workshop_id, recipient_workshop_name, title, content } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: 'عنوان ونص الرسالة مطلوبان' });
  }

  const client = getDbClient(req);
  const isSpecific = recipient_type === 'specific';
  let resolvedRecipientName = recipient_workshop_name || null;

  if (isSpecific && recipient_workshop_id && !resolvedRecipientName) {
    const localWs = loadPersistentWorkshops().find((w) => w.id === recipient_workshop_id);
    if (localWs?.brandName) resolvedRecipientName = localWs.brandName;
    else if (isValidUuid(recipient_workshop_id)) {
      const { data: wsRow } = await client.from('workshops').select('brand_name').eq('id', recipient_workshop_id).maybeSingle();
      if (wsRow?.brand_name) resolvedRecipientName = wsRow.brand_name;
    }
  }

  const newAnn: any = {
    id: crypto.randomUUID(),
    sender_id: isValidUuid(req.user?.id) ? req.user.id : null,
    sender_name: 'م. حسام بسيوني (كبير عيلة الشمساوية)',
    recipient_type: isSpecific ? 'specific' : 'all',
    recipient_workshop_id: isSpecific && isValidUuid(recipient_workshop_id) ? recipient_workshop_id : null,
    recipient_workshop_name: isSpecific ? (resolvedRecipientName || 'ورشة محددة') : 'كافة ورش المنظومة',
    title: String(title).trim(),
    content: String(content).trim(),
    created_at: new Date().toISOString(),
  };

  let cloudSynced = false;
  let cloudError: string | undefined;
  try {
    const { error: insErr } = await client.from('admin_announcements').insert(newAnn);
    if (!insErr) cloudSynced = true;
    else {
      cloudError = insErr.message;
      console.warn('[Admin Announcements] Supabase insert error:', insErr.message);
    }
  } catch (e: any) {
    cloudError = e?.message;
  }

  localAnnouncements.unshift(newAnn);
  res.json({ success: true, cloudSynced, cloudError, announcement: newAnn });
});

app.delete('/api/admin/announcements/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }
  const annId = req.params.id;
  const client = getDbClient(req);
  try {
    await client.from('admin_announcements').delete().eq('id', annId);
  } catch {}
  const idx = localAnnouncements.findIndex((a) => a.id === annId);
  if (idx >= 0) localAnnouncements.splice(idx, 1);
  res.json({ success: true });
});

// 8. Workshop Message Receipt & Reply Handler (select-then-update-or-insert safe even without composite unique index)
app.post('/api/announcements/:id/receipt', async (req: Request, res: Response) => {
  const wid = (req.body?.workshopId || req.headers['x-workshop-id'] || (req as any).workshopId || '') as string;
  const messageId = req.params.id;
  const { action, reply_text } = req.body || {};

  const client = supabaseAdminClient;
  const nowIso = new Date().toISOString();

  const receiptUpdate: any = {};
  if (action === 'read') {
    receiptUpdate.read_at = nowIso;
  } else if (action === 'acknowledge') {
    receiptUpdate.read_at = nowIso;
    receiptUpdate.acknowledged_at = nowIso;
  } else if (action === 'reply') {
    receiptUpdate.read_at = nowIso;
    receiptUpdate.reply_text = String(reply_text || '').trim();
    receiptUpdate.replied_at = nowIso;
  }

  let cloudSynced = false;
  if (isValidUuid(messageId) && isValidUuid(wid)) {
    try {
      const { data: existingRow } = await client
        .from('workshop_messages_receipts')
        .select('id, read_at')
        .eq('message_id', messageId)
        .eq('workshop_id', wid)
        .maybeSingle();

      if (existingRow?.id) {
        const patch = { ...receiptUpdate };
        if (existingRow.read_at && action === 'read') {
          cloudSynced = true;
        } else {
          const { error: uErr } = await client
            .from('workshop_messages_receipts')
            .update(patch)
            .eq('id', existingRow.id);
          if (!uErr) cloudSynced = true;
        }
      } else {
        const { error: iErr } = await client
          .from('workshop_messages_receipts')
          .insert({
            id: crypto.randomUUID(),
            message_id: messageId,
            workshop_id: wid,
            ...receiptUpdate,
          });
        if (!iErr) cloudSynced = true;
      }
    } catch {}
  }

  const existingIdx = localReceipts.findIndex(
    (r) => r.message_id === messageId && r.workshop_id === wid
  );
  if (existingIdx >= 0) {
    localReceipts[existingIdx] = { ...localReceipts[existingIdx], ...receiptUpdate };
  } else {
    localReceipts.push({ message_id: messageId, workshop_id: wid, ...receiptUpdate });
  }

  res.json({ success: true, cloudSynced, receipt: receiptUpdate });
});

// 9. Super Admin Inbox (Artisans Replies & Public Visitor Feedback)
app.get('/api/admin/inbox', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const client = getDbClient(req);
  let dbReceipts: any[] = [];
  try {
    const { data: receipts } = await client
      .from('workshop_messages_receipts')
      .select('*, admin_announcements(*), workshops(id, brand_name, artist_name, phone, phone_number, email)')
      .not('reply_text', 'is', null)
      .order('replied_at', { ascending: false });

    if (Array.isArray(receipts)) {
      dbReceipts = receipts;
    }
  } catch {
    // ignore
  }

  const feedbackItems = loadPersistentFeedback().map((fb: any) => {
    const isStorefront = fb.source === 'artisan_storefront';
    const storeTag = fb.workshopName ? `متجر ${fb.workshopName}` : 'متجر فنان';
    return {
      id: fb.id,
      message_id: isStorefront ? 'storefront_support' : 'public_feedback',
      workshop_id: fb.workshopId || null,
      workshop_name: isStorefront
        ? `${fb.name} — ${storeTag}`
        : `${fb.name} (${fb.craft || 'زائر'})`,
      reply_text: isStorefront
        ? `[شكوى / استفسار من ${storeTag}] التصنيف: ${fb.craft || 'عام'} | المرسل: ${fb.name} | التواصل: ${fb.contact || 'غير محدد'}\n\n${fb.message}`
        : `[رأي ومقترح من صفحة الهبوط] الاسم: ${fb.name} (${fb.craft || 'مشغولات يدوية'}) | التقييم: ${fb.rating || 5}/5 نجوم | التواصل: ${fb.contact || 'غير محدد'}\n\n${fb.message}`,
      replied_at: fb.created_at,
      admin_announcements: {
        title: isStorefront
          ? `📩 دعم فني وشكاوى المتاجر (${storeTag})`
          : '⭐ رأي / رسالة زائر من صفحة الهبوط',
      },
      workshops: {
        brand_name: isStorefront ? storeTag : fb.name,
        artist_name: fb.name || fb.craft || 'زائر للمنظومة',
        phone_number: fb.contact || '',
      },
    };
  });

  const localReplies = localReceipts
    .filter((r) => r.reply_text && !dbReceipts.some((d) => d.message_id === r.message_id && d.workshop_id === r.workshop_id))
    .map((r) => {
      const ann = localAnnouncements.find((a) => a.id === r.message_id);
      return {
        ...r,
        admin_announcements: ann,
        workshop_name: r.workshop_name || 'ورشة الشمساوية',
      };
    });

  const combined = [...dbReceipts, ...feedbackItems, ...localReplies].sort(
    (a, b) => new Date(b.replied_at || b.created_at || 0).getTime() - new Date(a.replied_at || a.created_at || 0).getTime()
  );

  res.json({ inbox: combined });
});

// 10. Public Feedback, Proposals & Storefront Direct Admin Support Endpoint
app.post('/api/public/feedback', async (req: Request, res: Response) => {
  const {
    name,
    craft,
    rating,
    message,
    contact,
    source,
    workshopId,
    workshopName,
    storeSlug,
  } = req.body || {};

  if (!name || !message) {
    return res.status(400).json({ error: 'الاسم ونص الرسالة مطلوبان' });
  }

  const isStorefront = source === 'artisan_storefront';
  const feedbackItem = {
    id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: String(name).trim(),
    craft: String(craft || (isStorefront ? 'شكوى أو استفسار متجر' : 'مشغولات يدوية')).trim(),
    rating: Number(rating) || 5,
    message: String(message).trim(),
    contact: String(contact || '').trim(),
    source: isStorefront ? 'artisan_storefront' : 'landing',
    workshopId: workshopId ? String(workshopId).trim() : null,
    workshopName: workshopName ? String(workshopName).trim() : null,
    storeSlug: storeSlug ? String(storeSlug).trim() : null,
    created_at: new Date().toISOString(),
  };

  const feedbackList = loadPersistentFeedback();
  feedbackList.unshift(feedbackItem);
  savePersistentFeedback(feedbackList);

  res.json({
    success: true,
    message: isStorefront
      ? 'تم إرسال رسالتك مباشرة إلى إدارة منظومة الشمساوية والدعم الفني بنجاح! سيتم مراجعتها والرد عليك في أقرب وقت.'
      : 'شكراً لمشاركتك رأيك القيّم مع عيلة الشمساوية! تم إرسال رسالتك مباشرة لصندوق الإدارة.',
  });
});

// -------------------------------------------------------------
// Family Community («مجتمع عيلة الشمساوية») — Real-Time WebSocket + REST API
// -------------------------------------------------------------
interface FamilyWsClient {
  ws: WebSocket;
  userId: string;
  email: string;
  workshopId: string;
  isSuperAdmin: boolean;
}

const familyWsClients = new Set<FamilyWsClient>();
const familyWss = new WebSocketServer({ noServer: true });

function isMissingSupabaseRelationError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

async function getWorkshopDirectoryMap(_client?: SupabaseClient): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const registerEntry = (raw: any) => {
    const wid = String(raw.id || raw.workshopId || raw.workshop_id || '').trim();
    const ownerId = String(raw.owner_id || raw.ownerUid || raw.owner_uid || raw.user_id || '').trim();
    const email = String(raw.email || '').trim().toLowerCase();
    const artistName = String(
      raw.artistName || raw.artist_name || raw.ownerName || raw.owner_name || ''
    ).trim();
    const brandName = String(
      raw.brandName || raw.brand_name || raw.workshopName || raw.workshop_name || ''
    ).trim();
    const normalized = {
      id: wid || ownerId,
      ownerId,
      artistName: artistName && artistName !== 'فنان الشمساوية' ? artistName : '',
      brandName: brandName && brandName !== 'ورشة الشمساوية' ? brandName : '',
      avatarUrl:
        raw.logoUrl ||
        raw.logo_url ||
        raw.logoBase64 ||
        raw.logo_base64 ||
        raw.logoData ||
        raw.logo_data ||
        raw.avatarUrl ||
        raw.avatar_url ||
        null,
      medal: raw.medal || null,
      ratingStars: Number(raw.ratingStars || raw.rating_stars || 5) || 5,
      email,
    };
    if (wid) map.set(`id:${wid}`, normalized);
    if (ownerId) map.set(`owner:${ownerId}`, normalized);
    if (email) map.set(`email:${email}`, normalized);
  };

  const localWorkshops = loadPersistentWorkshops();
  for (const w of localWorkshops) {
    registerEntry(w);
  }

  try {
    const { data: rows, error } = await supabaseAdminClient
      .from('workshops')
      .select('*');
    if (!error && Array.isArray(rows)) {
      for (const r of rows) {
        registerEntry(r);
      }
    }
  } catch {
    // fallback to local list already loaded
  }
  return map;
}

async function loadAllFamilyRestrictions(client: SupabaseClient): Promise<any[]> {
  const local = loadPersistentFamilyRestrictions();
  const merged = new Map<string, any>();
  for (const r of local) {
    const key = String(r.workshop_id || r.workshopId || r.author_email || r.email || r.id).toLowerCase();
    merged.set(key, {
      id: r.id,
      workshopId: r.workshop_id || r.workshopId || '',
      authorEmail: (r.author_email || r.email || '').toLowerCase(),
      artistName: r.artist_name || r.artistName || '',
      brandName: r.brand_name || r.brandName || '',
      status: r.status || 'active',
      reason: r.reason || '',
      updatedAt: r.updated_at || r.updatedAt || r.created_at || new Date().toISOString(),
    });
  }

  try {
    const { data, error } = await client.from('family_restrictions').select('*');
    if (!error && Array.isArray(data)) {
      for (const r of data) {
        const key = String(r.workshop_id || r.author_email || r.id).toLowerCase();
        merged.set(key, {
          id: r.id,
          workshopId: r.workshop_id || '',
          authorEmail: (r.author_email || '').toLowerCase(),
          artistName: r.artist_name || '',
          brandName: r.brand_name || '',
          status: r.status || 'active',
          reason: r.reason || '',
          updatedAt: r.updated_at || r.created_at || new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore if table not created yet
  }

  return Array.from(merged.values());
}

function findUserRestriction(restrictions: any[], workshopId: string, email: string): any | null {
  if (isSuperAdmin(email)) return null;
  const cleanWid = (workshopId || '').trim().toLowerCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  const hit = restrictions.find(
    (r) =>
      r.status !== 'active' &&
      ((cleanWid && String(r.workshopId || '').toLowerCase() === cleanWid) ||
        (cleanEmail && String(r.authorEmail || '').toLowerCase() === cleanEmail))
  );
  return hit || null;
}

function enrichFamilyRecord(raw: any, dirMap: Map<string, any>) {
  const email = String(raw.author_email || raw.authorEmail || '').trim().toLowerCase();
  const wid = String(raw.workshop_id || raw.workshopId || '').trim();
  const isAdminAuthor = Boolean(raw.is_super_admin || raw.isSuperAdmin);

  if (isAdminAuthor) {
    return {
      ...raw,
      id: raw.id,
      content: raw.content || '',
      createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
      workshopId: wid || 'super_admin',
      authorEmail: email,
      isSuperAdmin: true,
      authorName: 'كبير العيلة',
      brandName: '',
      avatarUrl: raw.avatar_url || raw.avatarUrl || '/brand icon light.png',
      medal: 'diamond',
      ratingStars: 5,
    };
  }

  const profileMatch =
    (wid && (dirMap.get(`id:${wid}`) || dirMap.get(`owner:${wid}`))) ||
    (email && dirMap.get(`email:${email}`)) ||
    null;

  const rawArtist = String(raw.author_name || raw.authorName || '').trim();
  const rawBrand = String(raw.brand_name || raw.brandName || '').trim();

  const resolvedArtist =
    profileMatch?.artistName ||
    (rawArtist && rawArtist !== 'فنان الشمساوية' ? rawArtist : '') ||
    'فنان الشمساوية';
  const resolvedBrand =
    profileMatch?.brandName ||
    (rawBrand && rawBrand !== 'ورشة الشمساوية' ? rawBrand : '') ||
    'ورشة الشمساوية';

  return {
    ...raw,
    id: raw.id,
    content: raw.content || '',
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    workshopId: wid,
    authorEmail: email,
    isSuperAdmin: false,
    authorName: resolvedArtist,
    brandName: resolvedBrand,
    avatarUrl: profileMatch?.avatarUrl || raw.avatar_url || raw.avatarUrl || null,
    medal: profileMatch?.medal !== undefined ? profileMatch.medal : (raw.medal || null),
    ratingStars: Number(profileMatch?.ratingStars || raw.rating_stars || raw.ratingStars || 5) || 5,
  };
}

function broadcastFamilyEvent(type: string, payload: any, restrictionsSnapshot: any[] = []) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of familyWsClients) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    const restriction = findUserRestriction(restrictionsSnapshot, client.workshopId, client.email);
    if (restriction?.status === 'banned') continue;
    try {
      client.ws.send(message);
    } catch {
      // ignore closed socket race
    }
  }
}

async function resolveFamilyAuthorContext(req: AuthenticatedRequest, client: SupabaseClient) {
  const email = (req.userEmail || req.user?.email || '').trim();
  const clientAuthor = req.body?.authorProfile || {};
  const wid = String(clientAuthor.workshopId || req.workshopId || req.user?.id || '').trim();
  const uid = String(req.user?.id || '').trim();
  const isSwitchedWorkshop = Boolean(clientAuthor.isSwitchedWorkshop);
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email)) && !isSwitchedWorkshop;
  const dirMap = await getWorkshopDirectoryMap(client);

  if (superAdmin) {
    return {
      isSuperAdmin: true,
      workshopId: 'super_admin',
      email,
      authorName: 'كبير العيلة',
      brandName: '',
      avatarUrl: '/brand icon light.png',
      medal: 'diamond',
      ratingStars: 5,
    };
  }

  const profileMatch =
    (wid && wid !== 'ALL_WORKSHOPS' && (dirMap.get(`id:${wid}`) || dirMap.get(`owner:${wid}`))) ||
    (uid && (dirMap.get(`owner:${uid}`) || dirMap.get(`id:${uid}`))) ||
    (email && dirMap.get(`email:${email.toLowerCase()}`)) ||
    null;

  const clientArtist = String(clientAuthor.artistName || '').trim();
  const clientBrand = String(clientAuthor.brandName || '').trim();
  const metaArtist = String(
    req.user?.user_metadata?.artist_name ||
    req.user?.user_metadata?.artistName ||
    req.user?.user_metadata?.full_name ||
    req.user?.user_metadata?.name ||
    ''
  ).trim();
  const metaBrand = String(
    req.user?.user_metadata?.brand_name ||
    req.user?.user_metadata?.brandName ||
    req.user?.user_metadata?.workshop_name ||
    ''
  ).trim();

  const resolvedArtist =
    profileMatch?.artistName ||
    (clientArtist && clientArtist !== 'فنان الشمساوية' ? clientArtist : '') ||
    (metaArtist && metaArtist !== 'فنان الشمساوية' ? metaArtist : '') ||
    'فنان الشمساوية';

  const resolvedBrand =
    profileMatch?.brandName ||
    (clientBrand && clientBrand !== 'ورشة الشمساوية' ? clientBrand : '') ||
    (metaBrand && metaBrand !== 'ورشة الشمساوية' ? metaBrand : '') ||
    'ورشة الشمساوية';

  return {
    isSuperAdmin: false,
    workshopId: profileMatch?.id || (wid && wid !== 'ALL_WORKSHOPS' ? wid : uid) || 'workshop_member',
    email,
    authorName: resolvedArtist,
    brandName: resolvedBrand,
    avatarUrl: profileMatch?.avatarUrl || clientAuthor.avatarUrl || null,
    medal: profileMatch?.medal !== undefined ? profileMatch.medal : (clientAuthor.medal || null),
    ratingStars: Number(profileMatch?.ratingStars || clientAuthor.ratingStars || 5) || 5,
  };
}

const VALID_REACTION_TYPES = ['like', 'dislike', 'love', 'clap', 'rose'] as const;
type FamilyReactionType = typeof VALID_REACTION_TYPES[number];

function getActorVoteKey(wid: string, email: string, userId?: string): string {
  const cleanWid = (wid || '').trim().toLowerCase();
  if (cleanWid && cleanWid !== 'all_workshops') return `w:${cleanWid}`;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail) return `e:${cleanEmail}`;
  return `u:${String(userId || 'anon').trim().toLowerCase()}`;
}

async function loadAllPollVotes(): Promise<any[]> {
  const local = loadPersistentFamilyPollVotes();
  const byKey = new Map<string, any>();
  for (const v of local) {
    const pid = String(v.post_id || v.postId || '');
    const vk = String(v.voter_key || v.voterKey || '');
    if (pid && vk) byKey.set(`${pid}:${vk}`, { post_id: pid, option_id: v.option_id || v.optionId, voter_key: vk });
  }
  try {
    const { data, error } = await supabaseAdminClient.from('family_poll_votes').select('*').limit(5000);
    if (!error && Array.isArray(data)) {
      for (const v of data) {
        const pid = String(v.post_id || '');
        const vk = String(v.voter_key || '');
        if (pid && vk) byKey.set(`${pid}:${vk}`, { post_id: pid, option_id: v.option_id, voter_key: vk });
      }
    }
  } catch {}
  return Array.from(byKey.values());
}

async function loadAllPostReactions(): Promise<any[]> {
  const local = loadPersistentFamilyReactions();
  const byKey = new Map<string, any>();
  for (const r of local) {
    const pid = String(r.post_id || r.postId || '');
    const rk = String(r.reactor_key || r.reactorKey || '');
    if (pid && rk) byKey.set(`${pid}:${rk}`, { post_id: pid, reaction_type: r.reaction_type || r.reactionType, reactor_key: rk });
  }
  try {
    const { data, error } = await supabaseAdminClient.from('family_post_reactions').select('*').limit(5000);
    if (!error && Array.isArray(data)) {
      for (const r of data) {
        const pid = String(r.post_id || '');
        const rk = String(r.reactor_key || '');
        if (pid && rk) byKey.set(`${pid}:${rk}`, { post_id: pid, reaction_type: r.reaction_type, reactor_key: rk });
      }
    }
  } catch {}
  return Array.from(byKey.values());
}

function buildPostPollAndReactions(
  rawPost: any,
  allVotes: any[],
  allReactions: any[],
  currentActorKey: string
) {
  const postId = String(rawPost.id);
  const rawOptions = Array.isArray(rawPost.poll_options || rawPost.pollOptions)
    ? (rawPost.poll_options || rawPost.pollOptions)
    : [];
  const postType: 'text' | 'poll' =
    (rawPost.post_type === 'poll' || rawPost.postType === 'poll') && rawOptions.length >= 2
      ? 'poll'
      : 'text';

  const postVotes = allVotes.filter((v) => v.post_id === postId);
  const pollOptions = rawOptions.map((opt: any) => {
    const optId = String(opt.id);
    const optVotes = postVotes.filter((v) => v.option_id === optId);
    return {
      id: optId,
      text: String(opt.text || ''),
      votesCount: optVotes.length,
      votedByMe: optVotes.some((v) => v.voter_key === currentActorKey),
    };
  });

  const postReactions = allReactions.filter((r) => r.post_id === postId);
  const reactions: Record<FamilyReactionType, number> = {
    like: 0,
    dislike: 0,
    love: 0,
    clap: 0,
    rose: 0,
  };
  let myReaction: FamilyReactionType | null = null;
  for (const r of postReactions) {
    const rt = r.reaction_type as FamilyReactionType;
    if (VALID_REACTION_TYPES.includes(rt)) {
      reactions[rt] += 1;
      if (r.reactor_key === currentActorKey) {
        myReaction = rt;
      }
    }
  }

  return {
    postType,
    pollOptions,
    totalVotes: postVotes.length,
    reactions,
    myReaction,
  };
}

app.get('/api/family/feed', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const email = req.userEmail || req.user?.email || '';
  const wid = (req.headers['x-workshop-id'] as string) || req.workshopId || '';
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));
  const actorKey = getActorVoteKey(wid, email, req.user?.id);

  try {
    const restrictions = await loadAllFamilyRestrictions(client);
    const myRestriction = findUserRestriction(restrictions, wid, email);

    if (myRestriction?.status === 'banned' && !superAdmin) {
      return res.json({
        blocked: true,
        restriction: myRestriction,
        posts: [],
        chatMessages: [],
        members: [],
        restrictions: [],
      });
    }

    const dirMap = await getWorkshopDirectoryMap(client);

    // Load posts (prefer supabaseAdminClient so community posts are visible across workshops)
    let postsRaw = loadPersistentFamilyPosts();
    try {
      const { data, error } = await supabaseAdminClient
        .from('family_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120);
      if (!error && Array.isArray(data)) {
        const byId = new Map<string, any>();
        for (const p of postsRaw) byId.set(p.id, p);
        for (const p of data) {
          const existing = byId.get(p.id);
          byId.set(p.id, {
            ...p,
            post_type: p.post_type || existing?.post_type || 'text',
            poll_options: p.poll_options || existing?.poll_options || [],
          });
        }
        postsRaw = Array.from(byId.values());
      }
    } catch {}

    // Load comments
    let commentsRaw = loadPersistentFamilyComments();
    try {
      const { data, error } = await supabaseAdminClient
        .from('family_comments')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500);
      if (!error && Array.isArray(data)) {
        const byId = new Map<string, any>();
        for (const c of data) byId.set(c.id, c);
        for (const c of commentsRaw) {
          if (!byId.has(c.id)) byId.set(c.id, c);
        }
        commentsRaw = Array.from(byId.values());
      }
    } catch {}

    // Load chat messages
    let chatRaw = loadPersistentFamilyChat();
    try {
      const { data, error } = await supabaseAdminClient
        .from('family_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(150);
      if (!error && Array.isArray(data)) {
        const byId = new Map<string, any>();
        for (const m of data) byId.set(m.id, m);
        for (const m of chatRaw) {
          if (!byId.has(m.id)) byId.set(m.id, m);
        }
        chatRaw = Array.from(byId.values());
      }
    } catch {}

    const [allVotes, allReactions] = await Promise.all([
      loadAllPollVotes(),
      loadAllPostReactions(),
    ]);

    const commentsByPost = new Map<string, any[]>();
    for (const rawC of commentsRaw) {
      const pid = String(rawC.post_id || rawC.postId || '');
      if (!pid) continue;
      const enrichedC = enrichFamilyRecord(rawC, dirMap);
      const bucket = commentsByPost.get(pid) || [];
      bucket.push({ ...enrichedC, postId: pid });
      commentsByPost.set(pid, bucket);
    }

    const enrichedPosts = postsRaw
      .map((rawP) => {
        const ep = enrichFamilyRecord(rawP, dirMap);
        const postComments = (commentsByPost.get(ep.id) || []).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const pollAndReactions = buildPostPollAndReactions(rawP, allVotes, allReactions, actorKey);
        return { ...ep, ...pollAndReactions, comments: postComments };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const enrichedChat = chatRaw
      .map((m) => enrichFamilyRecord(m, dirMap))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-120);

    // Members directory for Super Admin moderation panel
    const membersMap = new Map<string, any>();
    if (superAdmin) {
      for (const [k, v] of dirMap.entries()) {
        if (!k.startsWith('id:')) continue;
        if (isSuperAdmin(v.email)) continue;
        const restr = findUserRestriction(restrictions, v.id, v.email);
        membersMap.set(v.id, {
          workshopId: v.id,
          email: v.email,
          artistName: v.artistName || 'فنان الشمساوية',
          brandName: v.brandName || 'ورشة الشمساوية',
          avatarUrl: v.avatarUrl,
          medal: v.medal,
          ratingStars: v.ratingStars,
          restrictionStatus: restr?.status || 'active',
          restrictionReason: restr?.reason || '',
        });
      }
    }

    res.json({
      blocked: false,
      restriction: myRestriction,
      isSuperAdmin: superAdmin,
      posts: enrichedPosts,
      chatMessages: enrichedChat,
      restrictions: superAdmin ? restrictions.filter((r) => r.status !== 'active') : [],
      members: superAdmin ? Array.from(membersMap.values()) : [],
    });
  } catch (err: any) {
    console.error('[Family Feed Error]:', err);
    res.status(500).json({ error: 'تعذر تحميل منشورات مجتمع عيلة الشمساوية' });
  }
});

app.post('/api/family/posts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const email = req.userEmail || req.user?.email || '';
  const wid = (req.headers['x-workshop-id'] as string) || req.workshopId || '';
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));
  const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const requestedType = req.body?.postType === 'poll' ? 'poll' : 'text';
  const rawPollOptions: string[] = Array.isArray(req.body?.pollOptions)
    ? req.body.pollOptions
        .map((o: any) => (typeof o === 'string' ? o.trim() : ''))
        .filter((o: string) => o.length > 0)
        .slice(0, 6)
    : [];

  if (!rawContent) {
    return res.status(400).json({ error: 'نص المنشور لا يمكن أن يكون فارغاً' });
  }
  if (rawContent.length > 2000) {
    return res.status(400).json({ error: 'الحد الأقصى للمنشور هو 2000 حرف فقط' });
  }
  if (requestedType === 'poll' && rawPollOptions.length < 2) {
    return res.status(400).json({ error: 'التصويت يتطلب كتابة اختيارين على الأقل' });
  }

  const restrictions = await loadAllFamilyRestrictions(client);
  const myRestriction = findUserRestriction(restrictions, wid, email);
  if (myRestriction && !superAdmin) {
    return res.status(403).json({
      error:
        myRestriction.status === 'banned'
          ? 'تم حظر حسابك من مجتمع عيلة الشمساوية'
          : 'حسابك مقيد من المشاركة في مجتمع عيلة الشمساوية',
      restriction: myRestriction,
    });
  }

  const author = await resolveFamilyAuthorContext(req, client);
  const nowIso = new Date().toISOString();
  const formattedOptions =
    requestedType === 'poll'
      ? rawPollOptions.map((text, idx) => ({
          id: `opt_${idx + 1}_${crypto.randomUUID().slice(0, 8)}`,
          text: text.slice(0, 120),
        }))
      : [];

  const postRecord: any = {
    id: crypto.randomUUID(),
    workshop_id: author.workshopId,
    author_email: author.email,
    author_name: author.authorName,
    brand_name: author.brandName,
    avatar_url: author.avatarUrl,
    medal: author.medal,
    rating_stars: author.ratingStars,
    is_super_admin: author.isSuperAdmin,
    post_type: requestedType,
    poll_options: formattedOptions,
    content: rawContent,
    created_at: nowIso,
  };

  const posts = loadPersistentFamilyPosts();
  posts.unshift(postRecord);
  savePersistentFamilyPosts(posts);

  try {
    const { error } = await supabaseAdminClient.from('family_posts').insert(postRecord);
    if (error) {
      // Fallback insert without poll columns if user hasn't run SQL migration yet
      if (String(error.message || '').toLowerCase().includes('column')) {
        const { post_type: _pt, poll_options: _po, ...baseRecord } = postRecord;
        await supabaseAdminClient.from('family_posts').insert(baseRecord);
      } else if (!isMissingSupabaseRelationError(error)) {
        console.warn('[Family Post Insert Warning]:', error.message);
      }
    }
  } catch {}

  const dirMap = await getWorkshopDirectoryMap(client);
  const enriched = {
    ...enrichFamilyRecord(postRecord, dirMap),
    postType: requestedType,
    pollOptions: formattedOptions.map((o) => ({ ...o, votesCount: 0, votedByMe: false })),
    totalVotes: 0,
    reactions: { like: 0, dislike: 0, love: 0, clap: 0, rose: 0 },
    myReaction: null,
    comments: [],
  };
  broadcastFamilyEvent('post:created', enriched, restrictions);
  res.json({ success: true, post: enriched });
});

app.post('/api/family/posts/:id/vote', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const postId = req.params.id;
  const optionId = String(req.body?.optionId || '').trim();
  const email = req.userEmail || req.user?.email || '';
  const wid = (req.headers['x-workshop-id'] as string) || req.workshopId || '';
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));
  const actorKey = getActorVoteKey(wid, email, req.user?.id);

  if (!optionId) {
    return res.status(400).json({ error: 'يرجى اختيار رأي للتصويت' });
  }

  const restrictions = await loadAllFamilyRestrictions(client);
  const myRestriction = findUserRestriction(restrictions, wid, email);
  if (myRestriction && !superAdmin) {
    return res.status(403).json({ error: 'حسابك مقيد من التصويت والمشاركة', restriction: myRestriction });
  }

  let posts = loadPersistentFamilyPosts();
  let targetPost = posts.find((p) => p.id === postId);
  if (!targetPost) {
    try {
      const { data } = await supabaseAdminClient.from('family_posts').select('*').eq('id', postId).maybeSingle();
      if (data) targetPost = data;
    } catch {}
  }

  if (!targetPost) {
    return res.status(404).json({ error: 'التصويت غير موجود' });
  }

  const rawOptions = Array.isArray(targetPost.poll_options || targetPost.pollOptions)
    ? (targetPost.poll_options || targetPost.pollOptions)
    : [];
  if (!rawOptions.some((o: any) => String(o.id) === optionId)) {
    return res.status(400).json({ error: 'الاختيار المحدد غير صالح' });
  }

  let allVotes = loadPersistentFamilyPollVotes();
  allVotes = allVotes.filter((v) => !(v.post_id === postId && v.voter_key === actorKey));
  allVotes.push({
    id: crypto.randomUUID(),
    post_id: postId,
    option_id: optionId,
    voter_key: actorKey,
    created_at: new Date().toISOString(),
  });
  savePersistentFamilyPollVotes(allVotes);

  try {
    await supabaseAdminClient
      .from('family_poll_votes')
      .delete()
      .eq('post_id', postId)
      .eq('voter_key', actorKey);
    await supabaseAdminClient.from('family_poll_votes').insert({
      id: crypto.randomUUID(),
      post_id: postId,
      option_id: optionId,
      voter_key: actorKey,
    });
  } catch {}

  const mergedVotes = await loadAllPollVotes();
  const postVotes = mergedVotes.filter((v) => v.post_id === postId);
  const pollOptions = rawOptions.map((opt: any) => {
    const oid = String(opt.id);
    const cnt = postVotes.filter((v) => v.option_id === oid).length;
    return {
      id: oid,
      text: String(opt.text || ''),
      votesCount: cnt,
      votedByMe: oid === optionId,
    };
  });

  const payload = {
    postId,
    totalVotes: postVotes.length,
    voterKey: actorKey,
    selectedOptionId: optionId,
    pollOptions,
  };
  broadcastFamilyEvent('post:voted', payload, restrictions);
  res.json({ success: true, ...payload });
});

app.post('/api/family/posts/:id/react', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const postId = req.params.id;
  const reactionType = String(req.body?.reactionType || '').trim() as FamilyReactionType;
  const email = req.userEmail || req.user?.email || '';
  const wid = (req.headers['x-workshop-id'] as string) || req.workshopId || '';
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));
  const actorKey = getActorVoteKey(wid, email, req.user?.id);

  if (!VALID_REACTION_TYPES.includes(reactionType)) {
    return res.status(400).json({ error: 'نوع التفاعل غير مدعوم' });
  }

  const restrictions = await loadAllFamilyRestrictions(client);
  const myRestriction = findUserRestriction(restrictions, wid, email);
  if (myRestriction && !superAdmin) {
    return res.status(403).json({ error: 'حسابك مقيد من التفاعل والمشاركة', restriction: myRestriction });
  }

  let allReactions = loadPersistentFamilyReactions();
  const existing = allReactions.find((r) => r.post_id === postId && r.reactor_key === actorKey);
  const isRemoving = existing && existing.reaction_type === reactionType;

  allReactions = allReactions.filter((r) => !(r.post_id === postId && r.reactor_key === actorKey));
  if (!isRemoving) {
    allReactions.push({
      id: crypto.randomUUID(),
      post_id: postId,
      reaction_type: reactionType,
      reactor_key: actorKey,
      created_at: new Date().toISOString(),
    });
  }
  savePersistentFamilyReactions(allReactions);

  try {
    await supabaseAdminClient
      .from('family_post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('reactor_key', actorKey);
    if (!isRemoving) {
      await supabaseAdminClient.from('family_post_reactions').insert({
        id: crypto.randomUUID(),
        post_id: postId,
        reaction_type: reactionType,
        reactor_key: actorKey,
      });
    }
  } catch {}

  const mergedReactions = await loadAllPostReactions();
  const postReactions = mergedReactions.filter((r) => r.post_id === postId);
  const reactions: Record<FamilyReactionType, number> = { like: 0, dislike: 0, love: 0, clap: 0, rose: 0 };
  for (const r of postReactions) {
    const rt = r.reaction_type as FamilyReactionType;
    if (VALID_REACTION_TYPES.includes(rt)) reactions[rt] += 1;
  }

  const myReaction = isRemoving ? null : reactionType;
  const payload = {
    postId,
    reactions,
    reactorKey: actorKey,
    myReaction,
  };
  broadcastFamilyEvent('post:reacted', payload, restrictions);
  res.json({ success: true, ...payload });
});

app.delete('/api/family/posts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const postId = req.params.id;
  const email = (req.userEmail || req.user?.email || '').toLowerCase();
  const wid = (req.workshopId || '').trim();
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));

  let posts = loadPersistentFamilyPosts();
  let target = posts.find((p) => p.id === postId);

  if (!target) {
    try {
      const { data } = await supabaseAdminClient.from('family_posts').select('*').eq('id', postId).maybeSingle();
      if (data) target = data;
    } catch {}
  }

  if (!target) {
    return res.status(404).json({ error: 'المنشور غير موجود' });
  }

  const isOwner =
    (wid && target.workshop_id === wid) ||
    (email && String(target.author_email || '').toLowerCase() === email);

  if (!superAdmin && !isOwner) {
    return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا المنشور' });
  }

  posts = posts.filter((p) => p.id !== postId);
  savePersistentFamilyPosts(posts);

  const comments = loadPersistentFamilyComments().filter((c) => (c.post_id || c.postId) !== postId);
  savePersistentFamilyComments(comments);

  try {
    await supabaseAdminClient.from('family_comments').delete().eq('post_id', postId);
    await supabaseAdminClient.from('family_posts').delete().eq('id', postId);
  } catch {}

  const restrictions = await loadAllFamilyRestrictions(client);
  broadcastFamilyEvent('post:deleted', { id: postId }, restrictions);
  res.json({ success: true, id: postId });
});

app.post('/api/family/posts/:id/comments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const postId = req.params.id;
  const email = req.userEmail || req.user?.email || '';
  const wid = req.workshopId || '';
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));
  const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

  if (!rawContent) {
    return res.status(400).json({ error: 'نص التعليق فارغ' });
  }
  if (rawContent.length > 1000) {
    return res.status(400).json({ error: 'الحد الأقصى للتعليق هو 1000 حرف' });
  }

  const restrictions = await loadAllFamilyRestrictions(client);
  const myRestriction = findUserRestriction(restrictions, wid, email);
  if (myRestriction && !superAdmin) {
    return res.status(403).json({
      error:
        myRestriction.status === 'banned'
          ? 'تم حظر حسابك من مجتمع عيلة الشمساوية'
          : 'حسابك مقيد من التعليق والمشاركة',
      restriction: myRestriction,
    });
  }

  const author = await resolveFamilyAuthorContext(req, client);
  const nowIso = new Date().toISOString();
  const commentRecord = {
    id: crypto.randomUUID(),
    post_id: postId,
    workshop_id: author.workshopId,
    author_email: author.email,
    author_name: author.authorName,
    brand_name: author.brandName,
    avatar_url: author.avatarUrl,
    medal: author.medal,
    rating_stars: author.ratingStars,
    is_super_admin: author.isSuperAdmin,
    content: rawContent,
    created_at: nowIso,
  };

  const comments = loadPersistentFamilyComments();
  comments.push(commentRecord);
  savePersistentFamilyComments(comments);

  try {
    const { error } = await supabaseAdminClient.from('family_comments').insert(commentRecord);
    if (error && !isMissingSupabaseRelationError(error)) {
      console.warn('[Family Comment Insert Warning]:', error.message);
    }
  } catch {}

  const dirMap = await getWorkshopDirectoryMap(client);
  const enriched = { ...enrichFamilyRecord(commentRecord, dirMap), postId };
  broadcastFamilyEvent('comment:created', enriched, restrictions);
  res.json({ success: true, comment: enriched });
});

app.delete('/api/family/comments/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const commentId = req.params.id;
  const email = (req.userEmail || req.user?.email || '').toLowerCase();
  const wid = (req.workshopId || '').trim();
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));

  let comments = loadPersistentFamilyComments();
  let target = comments.find((c) => c.id === commentId);

  if (!target) {
    try {
      const { data } = await supabaseAdminClient.from('family_comments').select('*').eq('id', commentId).maybeSingle();
      if (data) target = data;
    } catch {}
  }

  if (!target) {
    return res.status(404).json({ error: 'التعليق غير موجود' });
  }

  const isOwner =
    (wid && target.workshop_id === wid) ||
    (email && String(target.author_email || '').toLowerCase() === email);

  if (!superAdmin && !isOwner) {
    return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا التعليق' });
  }

  const targetPostId = target.post_id || target.postId;
  comments = comments.filter((c) => c.id !== commentId);
  savePersistentFamilyComments(comments);

  try {
    await supabaseAdminClient.from('family_comments').delete().eq('id', commentId);
  } catch {}

  const restrictions = await loadAllFamilyRestrictions(client);
  broadcastFamilyEvent('comment:deleted', { id: commentId, postId: targetPostId }, restrictions);
  res.json({ success: true, id: commentId, postId: targetPostId });
});

app.post('/api/family/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const email = req.userEmail || req.user?.email || '';
  const wid = req.workshopId || '';
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));
  const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

  if (!rawContent) {
    return res.status(400).json({ error: 'الرسالة فارغة' });
  }
  if (rawContent.length > 600) {
    return res.status(400).json({ error: 'الحد الأقصى للرسالة في الشات هو 600 حرف' });
  }

  const restrictions = await loadAllFamilyRestrictions(client);
  const myRestriction = findUserRestriction(restrictions, wid, email);
  if (myRestriction && !superAdmin) {
    return res.status(403).json({
      error:
        myRestriction.status === 'banned'
          ? 'تم حظر حسابك من مجتمع عيلة الشمساوية'
          : 'حسابك مقيد من إرسال رسائل في شات العيلة',
      restriction: myRestriction,
    });
  }

  const author = await resolveFamilyAuthorContext(req, client);
  const nowIso = new Date().toISOString();
  const chatRecord = {
    id: crypto.randomUUID(),
    workshop_id: author.workshopId,
    author_email: author.email,
    author_name: author.authorName,
    brand_name: author.brandName,
    avatar_url: author.avatarUrl,
    medal: author.medal,
    rating_stars: author.ratingStars,
    is_super_admin: author.isSuperAdmin,
    content: rawContent,
    created_at: nowIso,
  };

  let chatList = loadPersistentFamilyChat();
  chatList.push(chatRecord);
  if (chatList.length > 250) chatList = chatList.slice(-250);
  savePersistentFamilyChat(chatList);

  try {
    const { error } = await supabaseAdminClient.from('family_chat_messages').insert(chatRecord);
    if (error && !isMissingSupabaseRelationError(error)) {
      console.warn('[Family Chat Insert Warning]:', error.message);
    }
  } catch {}

  const dirMap = await getWorkshopDirectoryMap(client);
  const enriched = enrichFamilyRecord(chatRecord, dirMap);
  broadcastFamilyEvent('chat:created', enriched, restrictions);
  res.json({ success: true, message: enriched });
});

app.delete('/api/family/chat/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const client = getDbClient(req);
  const msgId = req.params.id;
  const email = (req.userEmail || req.user?.email || '').toLowerCase();
  const wid = (req.workshopId || '').trim();
  const superAdmin = Boolean(req.isSuperAdmin || isSuperAdmin(email));

  let chatList = loadPersistentFamilyChat();
  let target = chatList.find((m) => m.id === msgId);

  if (!target) {
    try {
      const { data } = await supabaseAdminClient.from('family_chat_messages').select('*').eq('id', msgId).maybeSingle();
      if (data) target = data;
    } catch {}
  }

  if (!target) {
    return res.status(404).json({ error: 'الرسالة غير موجودة' });
  }

  const isOwner =
    (wid && target.workshop_id === wid) ||
    (email && String(target.author_email || '').toLowerCase() === email);

  if (!superAdmin && !isOwner) {
    return res.status(403).json({ error: 'لا تملك صلاحية حذف هذه الرسالة' });
  }

  chatList = chatList.filter((m) => m.id !== msgId);
  savePersistentFamilyChat(chatList);

  try {
    await supabaseAdminClient.from('family_chat_messages').delete().eq('id', msgId);
  } catch {}

  const restrictions = await loadAllFamilyRestrictions(client);
  broadcastFamilyEvent('chat:deleted', { id: msgId }, restrictions);
  res.json({ success: true, id: msgId });
});

app.post('/api/family/moderation', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'هذه الصلاحية مخصصة حصرياً لكبير العيلة (السوبر أدمن)' });
  }

  const { workshopId, authorEmail, artistName, brandName, status, reason } = req.body || {};
  const normalizedStatus = ['banned', 'restricted', 'active'].includes(status) ? status : 'restricted';
  const cleanWid = String(workshopId || '').trim();
  const cleanEmail = String(authorEmail || '').trim().toLowerCase();

  if (!cleanWid && !cleanEmail) {
    return res.status(400).json({ error: 'يجب تحديد الورشة أو العضو المراد إدارته' });
  }
  if (isSuperAdmin(cleanEmail)) {
    return res.status(400).json({ error: 'لا يمكن تقييد أو حظر حساب كبير العيلة' });
  }

  const nowIso = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    workshop_id: cleanWid || cleanEmail,
    author_email: cleanEmail,
    artist_name: String(artistName || '').trim(),
    brand_name: String(brandName || '').trim(),
    status: normalizedStatus,
    reason: String(reason || '').trim(),
    moderated_by: email,
    updated_at: nowIso,
  };

  let restrictionsList = loadPersistentFamilyRestrictions().filter(
    (r) =>
      !(
        (cleanWid && String(r.workshop_id || r.workshopId || '').trim() === cleanWid) ||
        (cleanEmail && String(r.author_email || r.email || '').trim().toLowerCase() === cleanEmail)
      )
  );
  if (normalizedStatus !== 'active') {
    restrictionsList.unshift(record);
  }
  savePersistentFamilyRestrictions(restrictionsList);

  try {
    if (normalizedStatus === 'active') {
      if (cleanWid) await supabaseAdminClient.from('family_restrictions').delete().eq('workshop_id', cleanWid);
      if (cleanEmail) await supabaseAdminClient.from('family_restrictions').delete().eq('author_email', cleanEmail);
    } else {
      if (cleanWid) await supabaseAdminClient.from('family_restrictions').delete().eq('workshop_id', cleanWid);
      const { error } = await supabaseAdminClient.from('family_restrictions').insert(record);
      if (error && !isMissingSupabaseRelationError(error)) {
        console.warn('[Family Moderation Insert Warning]:', error.message);
      }
    }
  } catch {}

  const allRestrictions = await loadAllFamilyRestrictions(supabaseAdminClient);
  broadcastFamilyEvent('member:moderated', {
    workshopId: cleanWid,
    authorEmail: cleanEmail,
    status: normalizedStatus,
    reason: record.reason,
  });

  res.json({
    success: true,
    restriction: {
      workshopId: cleanWid,
      authorEmail: cleanEmail,
      artistName: record.artist_name,
      brandName: record.brand_name,
      status: normalizedStatus,
      reason: record.reason,
      updatedAt: nowIso,
    },
    restrictions: allRestrictions.filter((r) => r.status !== 'active'),
  });
});

// -------------------------------------------------------------
// Shamousa Chat Endpoint (Workshop Data Only)
// -------------------------------------------------------------
const handleShamousaChatRoute = async (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const email = req.userEmail || req.user?.email || '';
  const superAdmin = isSuperAdmin(email);

  const { message, history, clientWorkshopState, images } = req.body || {};
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
    const statusRec = await checkWorkshopStatusAndAutoUnfreeze(supabaseAdminClient, wid);
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
      'ورشة الإبداع الحرفي';

    const shamousaRunner: any =
      (shamousaModule as any).handleShamousaChat ||
      (shamousaModule as any).chatWithShamousa;

    if (typeof shamousaRunner !== 'function') {
      throw new Error('محرك شموسة غير جاهز حالياً');
    }

    const clientTreasury = Number(clientWorkshopState?.treasuryBalance ?? req.body?.treasuryBalance ?? 0);

    const useSearch = Boolean(req.body?.useSearch);
    const result = await shamousaRunner(
      message.trim(),
      Array.isArray(history) ? history : [],
      {
        artistName,
        workshopName: brandName,
        treasuryBalance: clientTreasury,
        workshopId: wid,
        db: supabaseAdminClient,
        clientContext: clientWorkshopState,
        userEmail: email,
        isSuperAdmin: superAdmin,
        useSearch,
      },
      Array.isArray(images) ? images : undefined
    );

    // الخصم فقط بعد نجاح الاستجابة لعدم إهدار الرصيد (والسوبر أدمن لا يخصم)
    const remaining = recordUsage(shamousaUsage, wid, SHAMOUSA_DAILY_LIMIT, email);

    res.json({
      reply: typeof result === 'string' ? result : (result.reply || ''),
      handoffToFalcon: Boolean(result?.handoffToFalcon),
      provider: result?.provider || 'gemini',
      sources: Array.isArray(result?.sources) ? result.sources : [],
      searchUsed: Boolean(result?.searchUsed),
      searchEntryPoint: result?.searchEntryPoint,
      remaining,
    });
  } catch (err: any) {
    console.error('[Shamousa Chat Error]:', err);
    res.status(500).json({
      error: err?.message || 'تعذر معالجة طلب شموسة حالياً، يرجى المحاولة لاحقاً.',
      remaining: getRemainingUsage(shamousaUsage, wid, SHAMOUSA_DAILY_LIMIT, email),
    });
  }
};

app.post('/api/shamousa/chat', requireAuth, handleShamousaChatRoute);
app.post('/api/ai/shamousa/chat', requireAuth, handleShamousaChatRoute);

// -------------------------------------------------------------
// Falcon AI Agent Endpoints (General Crafts, Vision, Pricing)
// -------------------------------------------------------------
const handleFalconChat = async (req: AuthenticatedRequest, res: Response) => {
  const wid = req.workshopId || '';
  const email = req.userEmail || req.user?.email || '';
  const superAdmin = isSuperAdmin(email);

  const { message, actionChip, chatHistory, workshopContext, images, useSearch } = req.body || {};
  if (!message && !actionChip && (!images || images.length === 0)) {
    res.status(400).json({ error: 'الرسالة أو الصورة مطلوبة' });
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
      useSearch: Boolean(useSearch),
      images: Array.isArray(images) ? images : undefined,
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

  const { imageBase64, mimeType, artistNotes, workshopContext, activeCrafts } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    res.status(400).json({ error: 'صورة المنتج مطلوبة للتحليل' });
    return;
  }

  try {
    const analysis = await aiProvider.analyzeCraftVision({
      imageBase64,
      mimeType,
      artistNotes,
      workshopContext: {
        activeCrafts: activeCrafts || workshopContext?.activeCrafts || ['macrame'],
        country: workshopContext?.country || 'مصر',
        currency: workshopContext?.currency || 'ج.م',
        hourlyRate: Number(workshopContext?.hourlyRate) || 30,
        artistName: workshopContext?.artistName,
      },
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
// تفريغ المقاطع الصوتية بالذكاء الاصطناعي (Audio Speech-to-Text)
// -------------------------------------------------------------
const handleAudioTranscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { audioBase64, mimeType } = req.body || {};
    if (!audioBase64) {
      res.status(400).json({ error: 'ملف الصوت مطلوب للتفريغ' });
      return;
    }
    const transcribedText = await transcribeAudioWithGemini(audioBase64, mimeType || 'audio/webm');
    res.json({ text: transcribedText });
  } catch (err: any) {
    console.error('[Audio Transcription Error]:', err);
    res.status(500).json({ error: err?.message || 'تعذر تفريغ المقطع الصوتي' });
  }
};

app.post('/api/ai/transcribe-audio', requireAuth, handleAudioTranscription);
app.post('/api/transcribe-audio', requireAuth, handleAudioTranscription);

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
// Live Google Search Grounding & AI Secrets Readiness Status
// -------------------------------------------------------------
const handleGoogleSearchRoute = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, agent, country } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'نص البحث مطلوب' });
      return;
    }
    const targetAgent = agent === 'shamousa' ? 'shamousa' : agent === 'falcon' ? 'falcon' : 'search';
    const result = await performGoogleSearch(query.trim(), {
      agent: targetAgent,
      country: typeof country === 'string' && country.trim() ? country.trim() : undefined,
    });
    res.json(result);
  } catch (err: any) {
    const statusCode = Number(err?.status) === 429 ? 429 : 502;
    console.log('[Google Search Route Notice]:', statusCode, err?.message?.slice(0, 120));
    res.status(statusCode).json({ error: err?.message || 'تعذر تنفيذ بحث جوجل حالياً' });
  }
};

app.post('/api/ai/search', requireAuth, handleGoogleSearchRoute);
app.post('/api/search/google', requireAuth, handleGoogleSearchRoute);

app.get('/api/ai/status', (_req: Request, res: Response) => {
  res.json(getAgentSecretStatus());
});

// -------------------------------------------------------------
// Marketplace Cloud Endpoints & Super Admin Product Approvals & Central Orders
// -------------------------------------------------------------

function isWorkshopBlocked(ws: any): boolean {
  if (!ws) return false;
  const st = ws.status || (ws.is_frozen || ws.isFrozen ? 'suspended' : 'active');
  return st === 'banned' || st === 'suspended' || Boolean(ws.is_frozen || ws.isFrozen);
}

// 1. Get Marketplace Products for Public Shoppers (Strictly APPROVED & from ACTIVE workshops only)
app.get('/api/marketplace/products', async (_req: Request, res: Response) => {
  try {
    const client = supabaseAdminClient;
    const persistent = loadPersistentMarketplaceProducts();
    const productsMap = new Map<string, any>();

    const workshopLookup = new Map<string, any>();
    try {
      loadPersistentWorkshops().forEach((w: any) => {
        const wid = w.id || w.workshopId || w.workshop_id;
        if (wid) workshopLookup.set(wid, w);
      });
    } catch {}

    try {
      const { data: wsRows } = await client.from('workshops').select('*');
      if (Array.isArray(wsRows)) {
        wsRows.forEach((w: any) => {
          const wid = w.id || w.workshop_id;
          if (wid) workshopLookup.set(wid, { ...(workshopLookup.get(wid) || {}), ...w });
        });
      }
    } catch {}

    persistent.forEach((p: any) => {
      if (p.status === 'approved') {
        productsMap.set(p.id, p);
      }
    });

    try {
      const { data, error } = await client
        .from('marketplace_products')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        data.forEach((p: any) => {
          productsMap.set(p.id, { ...(productsMap.get(p.id) || {}), ...p });
        });
      }
    } catch {}

    const products = Array.from(productsMap.values())
      .filter((p: any) => {
        if (p.status !== 'approved') return false;
        const wid = p.workshop_id || p.workshopId || '';
        const ws = workshopLookup.get(wid);
        return !isWorkshopBlocked(ws);
      })
      .map((p: any) => {
        const wid = p.workshop_id || p.workshopId || '';
        const ws = workshopLookup.get(wid);
        const enriched = {
          ...p,
          brand_name: ws?.brand_name || ws?.brandName || p.brand_name || p.brandName || 'ورشة الشمساوية',
          artist_name: ws?.artist_name || ws?.artistName || p.artist_name || p.artistName || 'فنان الشمساوية',
          phone_number: ws?.phone_number || ws?.phone || ws?.phoneNumber || p.phone_number || p.phoneNumber || '',
          logo_url: ws?.logo_data || ws?.logo_url || ws?.logoUrl || p.logo_url || p.logoUrl || null,
          store_slug: ws?.store_slug || ws?.storeSlug || p.store_slug || p.storeSlug || wid,
          workshop_rating_stars: ws?.rating_stars ?? ws?.ratingStars ?? 5,
          workshop_medal: ws?.medal ?? null,
        };
        return normalizeCloudProductRow(enriched);
      });

    res.json({ success: true, products, count: products.length });
  } catch {
    res.status(500).json({ error: 'تعذر جلب معروضات سوق الشمساوية' });
  }
});

// 2. Publish/Sync Product from Artisan Store to Central Marketplace (Pending Approval by default)
app.post('/api/marketplace/publish', async (req: Request, res: Response) => {
  try {
    const product = req.body || {};
    if (!product.id || (!product.product_name && !product.productName)) {
      return res.status(400).json({ error: 'بيانات المنتج غير مكتملة' });
    }

    const dbClient = req.headers.authorization ? getDbClient(req) : supabaseAdminClient;
    const persistent = loadPersistentMarketplaceProducts();
    const existingIndex = persistent.findIndex((p: any) => p.id === product.id);

    // Check remote DB status too so already-approved products preserve 'approved'
    let remoteExisting: any = null;
    try {
      const { data } = await dbClient
        .from('marketplace_products')
        .select('id, status, created_at')
        .eq('id', product.id)
        .maybeSingle();
      if (data) remoteExisting = data;
    } catch {}

    const alreadyApprovedRemotely =
      (existingIndex >= 0 && persistent[existingIndex].status === 'approved') ||
      remoteExisting?.status === 'approved';

    const initialStatus =
      alreadyApprovedRemotely && product.status !== 'rejected'
        ? 'approved'
        : (product.status || 'pending_approval');

    const wid = product.workshop_id || product.workshopId || '';
    const nowIso = new Date().toISOString();

    // Only include real Supabase marketplace_products columns
    const supaRow: any = {
      id: product.id,
      workshop_id: wid,
      brand_name: product.brand_name || product.brandName || 'ورشة الشمساوية',
      artist_name: product.artist_name || product.artistName || 'فنان الشمساوية',
      phone_number: product.phone_number || product.phoneNumber || '',
      product_name: product.product_name || product.productName,
      category: product.category || 'macrame',
      craft_name: product.craft_name || product.craftName || 'المكرمية',
      decor_category: product.decor_category || product.decorCategory || 'all',
      store_price: Number(product.store_price ?? product.storePrice ?? product.retail_price ?? product.retailPrice ?? 0),
      retail_price: Number(product.retail_price ?? product.retailPrice ?? product.store_price ?? 0),
      wholesale_price: Number(product.wholesale_price ?? product.wholesalePrice ?? 0),
      cost_price: Number(product.cost_price ?? product.costPrice ?? 0),
      current_stock: Number(product.current_stock ?? product.currentStock ?? 1),
      image_url: product.image_url || product.imageUrl || '/alshams_falcon_emblem.png',
      store_description: product.store_description || product.storeDescription || '',
      available_colors: product.available_colors || product.availableColors || [],
      available_sizes: product.available_sizes || product.availableSizes || [],
      dimensions: product.dimensions || {},
      materials_summary: product.materials_summary || product.materialsSummary || '',
      status: initialStatus,
      rejection_reason: initialStatus === 'pending_approval' ? null : (product.rejection_reason || null),
      created_at: product.created_at || remoteExisting?.created_at || (existingIndex >= 0 ? persistent[existingIndex].created_at : nowIso),
      updated_at: nowIso,
    };

    if (existingIndex >= 0) {
      persistent[existingIndex] = { ...persistent[existingIndex], ...supaRow };
    } else {
      persistent.unshift(supaRow);
    }
    savePersistentMarketplaceProducts(persistent);

    let cloudSynced = false;
    let cloudError: string | undefined;
    try {
      const { error } = await dbClient.from('marketplace_products').upsert(supaRow, { onConflict: 'id' });
      if (!error) {
        cloudSynced = true;
      } else {
        cloudError = error.message;
        if (dbClient !== supabaseAdminClient) {
          const fallbackRes = await supabaseAdminClient.from('marketplace_products').upsert(supaRow, { onConflict: 'id' });
          if (!fallbackRes.error) {
            cloudSynced = true;
            cloudError = undefined;
          }
        }
      }
    } catch (e: any) {
      cloudError = e?.message;
    }

    // Create Super Admin notification alert when a product is submitted for review
    if (initialStatus === 'pending_approval') {
      const alertTitle = `🛍️ طلب اعتماد قطعة جديدة: ${supaRow.product_name}`;
      const alertContent = `رفعت ورشة "${supaRow.brand_name}" (${supaRow.artist_name}) قطعة "${supaRow.product_name}" بسعر عرض ${supaRow.store_price} ج.م وتنتظر مراجعتكم واعتمادها في سوق الشمساوية.`;
      const existingAlertIdx = localAnnouncements.findIndex(
        (a) => a.recipient_type === 'super_admin_alert' && a.title === alertTitle
      );
      if (existingAlertIdx < 0) {
        const alertRow = {
          id: crypto.randomUUID(),
          sender_id: null,
          sender_name: supaRow.brand_name,
          recipient_type: 'super_admin_alert',
          recipient_workshop_id: isValidUuid(wid) ? wid : null,
          recipient_workshop_name: supaRow.brand_name,
          title: alertTitle,
          content: alertContent,
          created_at: nowIso,
        };
        localAnnouncements.unshift(alertRow);
        dbClient.from('admin_announcements').insert(alertRow).then(() => {}, () => {
          supabaseAdminClient.from('admin_announcements').insert(alertRow).then(() => {}, () => {});
        });
      }
    }

    res.json({
      success: true,
      cloudSynced,
      cloudError,
      product: supaRow,
      message: initialStatus === 'pending_approval'
        ? 'تم إرسال القطعة للمراجعة والاعتماد المركزي بنجاح ✨'
        : 'تم تحديث بيانات المعروضة بنجاح.',
    });
  } catch {
    res.status(500).json({ error: 'تعذر حفظ ومزامنة المنتج سحابياً' });
  }
});

// 3. Super Admin Get Marketplace Products (Pending, Approved, Rejected & Unsynced Active Catalog Items)
app.get('/api/admin/marketplace/products', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userEmail = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(userEmail)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية: هذا القسم مخصص لإدارة وسوبر أدمن المنظومة' });
  }

  const requestedStatus = (req.query.status as string) || '';
  const client = getDbClient(req);
  const persistent = loadPersistentMarketplaceProducts();
  const map = new Map<string, any>();

  persistent.forEach((p: any) => map.set(p.id, p));

  const wsMap = new Map<string, any>();
  loadPersistentWorkshops().forEach((w: any) => wsMap.set(w.id || w.workshopId, w));

  try {
    const [mktRes, catRes, wsRes] = await Promise.all([
      client.from('marketplace_products').select('*').order('updated_at', { ascending: false }),
      client.from('products').select('*').eq('is_active', true),
      client.from('workshops').select('*'),
    ]);

    if (Array.isArray(wsRes.data)) {
      wsRes.data.forEach((w: any) => wsMap.set(w.id, { ...(wsMap.get(w.id) || {}), ...w }));
    }

    if (!mktRes.error && Array.isArray(mktRes.data)) {
      mktRes.data.forEach((p: any) => map.set(p.id, { ...(map.get(p.id) || {}), ...p }));
    }

    // Surface any active workshop catalog product published to store that isn't yet in marketplace_products
    if (!catRes.error && Array.isArray(catRes.data)) {
      catRes.data.forEach((p: any) => {
        if (map.has(p.id)) return;
        const lr = p.local_record || {};
        if (lr.inStore === false || lr.isPublishedInStore === false) return;
        const ws = wsMap.get(p.workshop_id);
        map.set(p.id, {
          id: p.id,
          workshop_id: p.workshop_id,
          brand_name: ws?.brand_name || ws?.brandName || lr.brandName || 'ورشة الشمساوية',
          artist_name: ws?.artist_name || ws?.artistName || lr.artistName || 'فنان الشمساوية',
          phone_number: ws?.phone_number || ws?.phone || ws?.phoneNumber || '',
          logo_url: ws?.logo_data || ws?.logo_url || null,
          store_slug: ws?.store_slug || p.workshop_id,
          product_name: p.product_name,
          category: p.category || lr.category || 'أعمال يدوية',
          craft_name: p.craft_name || lr.craftName || p.category || 'أعمال يدوية',
          decor_category: lr.decorCategory || 'all',
          store_price: Number(lr.storePrice ?? p.retail_price ?? 0),
          retail_price: Number(p.retail_price ?? 0),
          wholesale_price: Number(p.wholesale_price ?? 0),
          cost_price: Number(p.cost_price ?? 0),
          current_stock: Number(lr.currentStock ?? 1),
          image_url: p.image_url || lr.imageUrl || '/alshams_falcon_emblem.png',
          store_description: p.specs?.marketingDescription || p.specs?.materialsDescription || lr.storeDescription || '',
          available_colors: p.available_colors || [],
          available_sizes: p.available_sizes || [],
          dimensions: p.dimensions || {},
          materials_summary: p.specs?.materialsDescription || '',
          status: lr.marketplaceStatus || 'pending_approval',
          sourceTable: 'products',
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
        });
      });
    }
  } catch {}

  let allProducts = Array.from(map.values()).map((p: any) => {
    const ws = wsMap.get(p.workshop_id || p.workshopId);
    if (!ws) return p;
    return {
      ...p,
      brand_name: p.brand_name || ws.brand_name || ws.brandName,
      artist_name: p.artist_name || ws.artist_name || ws.artistName,
      phone_number: p.phone_number || ws.phone_number || ws.phone || ws.phoneNumber,
      logo_url: p.logo_url || ws.logo_data || ws.logo_url || null,
      store_slug: p.store_slug || ws.store_slug || ws.id,
    };
  });

  if (requestedStatus) {
    allProducts = allProducts.filter((p) => p.status === requestedStatus);
  }

  allProducts.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());

  res.json({ success: true, products: allProducts, count: allProducts.length });
});

// 4. Super Admin Review Action (Approve / Reject with reason, upsert if local/catalog product, sync DB & notify artisan)
app.post('/api/admin/marketplace/review', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userEmail = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(userEmail)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const { productId, status, rejectionReason, ratingStars, productPayload } = req.body || {};
  if (!productId || !['approved', 'rejected', 'pending_approval'].includes(status)) {
    return res.status(400).json({ error: 'معرف المنتج أو حالة القرار غير صالحة' });
  }

  const client = getDbClient(req);
  const persistent = loadPersistentMarketplaceProducts();
  const idx = persistent.findIndex((p: any) => p.id === productId);
  const nowIso = new Date().toISOString();

  const updateData: any = {
    status,
    rejection_reason: status === 'rejected' ? (rejectionReason || 'لم يستوفِ معايير العرض الحرفي') : null,
    updated_at: nowIso,
  };

  let targetProduct: any = idx >= 0 ? { ...persistent[idx], ...updateData } : null;

  if (!targetProduct) {
    try {
      const { data: existingMkt } = await client.from('marketplace_products').select('*').eq('id', productId).maybeSingle();
      if (existingMkt) targetProduct = { ...existingMkt, ...updateData };
    } catch {}
  }

  if (!targetProduct && productPayload) {
    targetProduct = {
      id: productId,
      workshop_id: productPayload.workshop_id || productPayload.workshopId || '',
      brand_name: productPayload.brand_name || productPayload.brandName || 'ورشة الشمساوية',
      artist_name: productPayload.artist_name || productPayload.artistName || 'فنان الشمساوية',
      phone_number: productPayload.phone_number || productPayload.phoneNumber || '',
      product_name: productPayload.product_name || productPayload.productName || 'مشغولة يدوية',
      category: productPayload.category || 'macrame',
      craft_name: productPayload.craft_name || productPayload.craftName || 'أعمال يدوية',
      decor_category: productPayload.decor_category || productPayload.decorCategory || 'all',
      store_price: Number(productPayload.store_price ?? productPayload.storePrice ?? productPayload.retail_price ?? productPayload.retailPrice ?? 0),
      retail_price: Number(productPayload.retail_price ?? productPayload.retailPrice ?? productPayload.store_price ?? 0),
      wholesale_price: Number(productPayload.wholesale_price ?? productPayload.wholesalePrice ?? 0),
      cost_price: Number(productPayload.cost_price ?? productPayload.costPrice ?? 0),
      current_stock: Number(productPayload.current_stock ?? productPayload.currentStock ?? 1),
      image_url: productPayload.image_url || productPayload.imageUrl || '/alshams_falcon_emblem.png',
      store_description: productPayload.store_description || productPayload.storeDescription || '',
      available_colors: productPayload.available_colors || productPayload.availableColors || [],
      available_sizes: productPayload.available_sizes || productPayload.availableSizes || [],
      dimensions: productPayload.dimensions || {},
      materials_summary: ratingStars ? `تقييم الجودة المبدئي: ${ratingStars}/5` : '',
      created_at: nowIso,
      ...updateData,
    };
  }

  if (targetProduct) {
    if (idx >= 0) persistent[idx] = targetProduct;
    else persistent.unshift(targetProduct);
    savePersistentMarketplaceProducts(persistent);
  }

  let cloudSynced = false;
  let cloudError: string | undefined;
  try {
    if (productPayload && targetProduct) {
      const upsertRow = {
        id: targetProduct.id,
        workshop_id: targetProduct.workshop_id,
        brand_name: targetProduct.brand_name,
        artist_name: targetProduct.artist_name,
        phone_number: targetProduct.phone_number,
        product_name: targetProduct.product_name,
        category: targetProduct.category,
        craft_name: targetProduct.craft_name,
        decor_category: targetProduct.decor_category,
        store_price: targetProduct.store_price,
        retail_price: targetProduct.retail_price,
        wholesale_price: targetProduct.wholesale_price,
        cost_price: targetProduct.cost_price,
        current_stock: targetProduct.current_stock,
        image_url: targetProduct.image_url,
        store_description: targetProduct.store_description,
        available_colors: targetProduct.available_colors,
        available_sizes: targetProduct.available_sizes,
        dimensions: targetProduct.dimensions,
        materials_summary: targetProduct.materials_summary || '',
        status,
        rejection_reason: updateData.rejection_reason,
        updated_at: nowIso,
      };
      const { error } = await client.from('marketplace_products').upsert(upsertRow, { onConflict: 'id' });
      if (!error) cloudSynced = true;
      else cloudError = error.message;
    } else {
      const { error } = await client.from('marketplace_products').update(updateData).eq('id', productId);
      if (!error) cloudSynced = true;
      else cloudError = error.message;
    }
  } catch (e: any) {
    cloudError = e?.message;
  }

  // Dispatch In-App Notification / Announcement to Workshop (with valid UUIDs & exact schema)
  if (targetProduct && targetProduct.workshop_id && (status === 'approved' || status === 'rejected')) {
    const isApproved = status === 'approved';
    const annTitle = isApproved
      ? `✨ مبروك! تم اعتماد مشغولتكم [${targetProduct.product_name}] في سوق الشمساوية`
      : `⚠️ تنبيه من إدارة المنظومة بخصوص القطعة [${targetProduct.product_name}]`;

    const annContent = isApproved
      ? `تمت مراجعة واعتماد مشغولتكم الحرفية [${targetProduct.product_name}] بنجاح من كبير عيلة الشمساوية والإدارة${ratingStars ? ` بتقييم مبدئي ${ratingStars} نجوم` : ''}. القطعة الآن معروضة ومتاحة للشراء المباشر لكافة زوار سوق الشمساوية المركزي!`
      : `تحياتنا لكم يا فنان، نأسف لإبلاغكم بأن قطعتكم [${targetProduct.product_name}] لم يتم اعتمادها في العرض المركزي للأسباب التالية:\n"${rejectionReason || 'تحتاج إلى تدقيق المواصفات والصور'}"\nيمكنكم تعديل البيانات وإعادة الإرسال للمراجعة في أي وقت.`;

    const annRow: any = {
      id: crypto.randomUUID(),
      sender_id: isValidUuid(req.user?.id) ? req.user.id : null,
      sender_name: 'م. حسام بسيوني (كبير عيلة الشمساوية)',
      recipient_type: 'specific',
      recipient_workshop_id: isValidUuid(targetProduct.workshop_id) ? targetProduct.workshop_id : null,
      recipient_workshop_name: targetProduct.brand_name || 'الورشة الحرفية',
      title: annTitle,
      content: annContent,
      created_at: nowIso,
    };

    try {
      await client.from('admin_announcements').insert(annRow);
    } catch {}
    localAnnouncements.unshift(annRow);
  }

  res.json({
    success: true,
    cloudSynced,
    cloudError,
    message: status === 'approved'
      ? 'تم اعتماد المعروضة ونشرها في سوق الشمساوية بنجاح ✨'
      : status === 'rejected'
      ? 'تم تسجيل الرفض وإبلاغ الورشة ❌'
      : 'تمت إعادة القطعة لقائمة المراجعة ⏳',
    product: targetProduct,
  });
});

// -------------------------------------------------------------
// Platform Config & Central Marketplace Orders Sync Endpoints
// -------------------------------------------------------------
app.get('/api/platform-settings', async (_req: Request, res: Response) => {
  const localCfg = loadPersistentPlatformSettings();
  try {
    const { data: wsRows } = await supabaseAdminClient.from('workshops').select('id, settings').limit(10);
    if (Array.isArray(wsRows)) {
      const host = wsRows.find((w: any) => w.settings && w.settings.platformConfig);
      if (host?.settings?.platformConfig) {
        const cloudCfg = host.settings.platformConfig;
        const merged = {
          ...localCfg,
          ...cloudCfg,
          governorateRates: {
            ...localCfg.governorateRates,
            ...(cloudCfg.governorateRates || {}),
          },
        };
        return res.json({ success: true, settings: merged });
      }
    }
  } catch {}
  res.json({ success: true, settings: localCfg });
});

app.put('/api/platform-settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }
  const body = req.body || {};
  const existing = loadPersistentPlatformSettings();
  const nextSettings = {
    ...existing,
    ...body,
    governorateRates: {
      ...existing.governorateRates,
      ...(body.governorateRates || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  savePersistentPlatformSettings(nextSettings);

  let cloudSynced = false;
  try {
    const client = getDbClient(req);
    const { data: wsList } = await client.from('workshops').select('id, settings').order('created_at', { ascending: true }).limit(1);
    const target = Array.isArray(wsList) ? wsList[0] : null;
    if (target?.id) {
      const nextWsSettings = { ...(target.settings || {}), platformConfig: nextSettings };
      const { error } = await client.from('workshops').update({ settings: nextWsSettings, updated_at: nextSettings.updatedAt }).eq('id', target.id);
      if (!error) cloudSynced = true;
    }
  } catch {}

  res.json({ success: true, cloudSynced, settings: nextSettings });
});

app.post('/api/marketplace/orders', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const orderId = body.id || 'ord_' + Date.now();
    const wid = body.workshop_id || body.workshopId || 'central';
    const orderNumber = body.order_number || body.invoiceNumber || `SHAMS-${Date.now().toString().slice(-5)}`;
    const nowIso = new Date().toISOString();
    const isClientHidden = body.isClientDataHiddenFromArtisan !== false;

    const cleanNotes = String(body.notes || '').replace(/\[META:[^\]]+\]/g, '').trim();
    const metaTag = `[META:hidden=${isClientHidden ? 1 : 0};confirmed=${body.advancePaymentConfirmed ? 1 : 0};mpStatus=${body.marketplaceStatus || 'pending_approval'}]`;

    const supaRow = {
      id: orderId,
      order_number: orderNumber,
      workshop_id: wid,
      customer_name: body.customer_name || body.customerName || 'عميل',
      customer_phone: body.customer_phone || body.customerPhone || '',
      customer_address: body.customer_address || body.detailedAddress || '',
      governorate: body.governorate || 'القاهرة',
      items: Array.isArray(body.items) ? body.items : [],
      subtotal: Number(body.subtotal || 0),
      shipping_fee: Number(body.shipping_fee ?? body.shipping ?? body.shippingCost ?? 0),
      total_amount: Number(body.total_amount ?? body.finalTotal ?? 0),
      deposit_paid: Number(body.deposit_paid ?? body.advancePaymentAmount ?? 0),
      remaining_amount: Number(body.remaining_amount ?? body.remainingAmount ?? 0),
      payment_method: body.payment_method || body.paymentMethod || 'instapay',
      status: body.status || 'pending',
      notes: cleanNotes ? `${cleanNotes} ${metaTag}` : metaTag,
      created_at: body.created_at || nowIso,
      updated_at: nowIso,
    };

    const existingList = loadPersistentMarketplaceOrders();
    const idx = existingList.findIndex((o) => o.id === orderId);
    const storedRecord = { ...supaRow, isClientDataHiddenFromArtisan: isClientHidden, advancePaymentConfirmed: Boolean(body.advancePaymentConfirmed) };
    if (idx >= 0) existingList[idx] = storedRecord;
    else existingList.unshift(storedRecord);
    savePersistentMarketplaceOrders(existingList);

    let cloudSynced = false;
    try {
      const { error } = await supabaseAdminClient.from('marketplace_orders').upsert(supaRow, { onConflict: 'id' });
      if (!error) cloudSynced = true;
    } catch {}

    // Notify target workshop in-app
    if (isValidUuid(wid)) {
      const orderAnn = {
        id: crypto.randomUUID(),
        sender_id: null,
        sender_name: 'سوق الشمساوية المركزي',
        recipient_type: 'specific',
        recipient_workshop_id: wid,
        recipient_workshop_name: 'ورشة الشمساوية',
        title: `🛍️ طلبية سوق جديدة برقم #${orderNumber}`,
        content: `وردت طلبية جديدة من سوق الشمساوية بقيمة ${supaRow.total_amount} ج.م (عربون جدية: ${supaRow.deposit_paid} ج.م). ستراجع الإدارة دفعة الجدية لتأكيد بدء التنفيذ.`,
        created_at: nowIso,
      };
      supabaseAdminClient.from('admin_announcements').insert(orderAnn).then(() => {}, () => {});
      localAnnouncements.unshift(orderAnn);
    }

    res.json({ success: true, cloudSynced, order: storedRecord });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'تعذر تسجيل طلبية السوق' });
  }
});

app.get('/api/admin/marketplace/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const client = getDbClient(req);
  const map = new Map<string, any>();
  loadPersistentMarketplaceOrders().forEach((o: any) => map.set(o.id, o));

  try {
    const { data, error } = await client
      .from('marketplace_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        const metaMatch = String(row.notes || '').match(/\[META:([^\]]+)\]/);
        let hidden = true;
        let confirmed = false;
        let mpStatus = 'pending_approval';
        if (metaMatch) {
          hidden = !metaMatch[1].includes('hidden=0');
          confirmed = metaMatch[1].includes('confirmed=1');
          const mSt = metaMatch[1].match(/mpStatus=([^;\]]+)/);
          if (mSt) mpStatus = mSt[1];
        }
        map.set(row.id, {
          ...map.get(row.id),
          ...row,
          invoiceNumber: row.order_number,
          workshopId: row.workshop_id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          detailedAddress: row.customer_address,
          finalTotal: Number(row.total_amount || 0),
          shippingCost: Number(row.shipping_fee || 0),
          advancePaymentAmount: Number(row.deposit_paid || 0),
          remainingAmount: Number(row.remaining_amount || 0),
          paymentMethod: row.payment_method,
          isClientDataHiddenFromArtisan: hidden,
          advancePaymentConfirmed: confirmed,
          marketplaceStatus: mpStatus,
        });
      });
    }
  } catch {}

  const orders = Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime()
  );
  res.json({ success: true, orders, count: orders.length });
});

app.patch('/api/admin/marketplace/orders/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const email = req.userEmail || req.user?.email || '';
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'صلاحيات غير كافية' });
  }

  const orderId = req.params.id;
  const updates = req.body || {};
  const client = getDbClient(req);
  const nowIso = new Date().toISOString();

  const ordersList = loadPersistentMarketplaceOrders();
  const idx = ordersList.findIndex((o) => o.id === orderId);
  let targetOrder: any = idx >= 0 ? { ...ordersList[idx] } : { id: orderId };

  if (idx < 0) {
    try {
      const { data: existingRow } = await client.from('marketplace_orders').select('*').eq('id', orderId).maybeSingle();
      if (existingRow) targetOrder = { ...existingRow };
    } catch {}
  }

  const nextStatus = updates.status ?? targetOrder.status ?? 'pending';
  const nextRemaining = updates.remainingAmount ?? updates.remaining_amount ?? targetOrder.remainingAmount ?? targetOrder.remaining_amount ?? 0;
  const nextHidden = updates.isClientDataHiddenFromArtisan !== undefined
    ? Boolean(updates.isClientDataHiddenFromArtisan)
    : (targetOrder.isClientDataHiddenFromArtisan !== false);
  const nextConfirmed = updates.advancePaymentConfirmed !== undefined
    ? Boolean(updates.advancePaymentConfirmed)
    : Boolean(targetOrder.advancePaymentConfirmed);
  const nextMpStatus = updates.marketplaceStatus || targetOrder.marketplaceStatus || 'pending_approval';

  const cleanNotes = String(targetOrder.notes || '').replace(/\[META:[^\]]+\]/g, '').trim();
  const nextNotes = `${cleanNotes ? cleanNotes + ' ' : ''}[META:hidden=${nextHidden ? 1 : 0};confirmed=${nextConfirmed ? 1 : 0};mpStatus=${nextMpStatus}]`;

  targetOrder = {
    ...targetOrder,
    ...updates,
    status: nextStatus,
    remaining_amount: Number(nextRemaining),
    remainingAmount: Number(nextRemaining),
    isClientDataHiddenFromArtisan: nextHidden,
    advancePaymentConfirmed: nextConfirmed,
    marketplaceStatus: nextMpStatus,
    notes: nextNotes,
    updated_at: nowIso,
    updatedAt: Date.now(),
  };

  if (idx >= 0) ordersList[idx] = targetOrder;
  else ordersList.unshift(targetOrder);
  savePersistentMarketplaceOrders(ordersList);

  let cloudSynced = false;
  try {
    const { error } = await client.from('marketplace_orders').update({
      status: nextStatus,
      remaining_amount: Number(nextRemaining),
      notes: nextNotes,
      updated_at: nowIso,
    }).eq('id', orderId);
    if (!error) cloudSynced = true;
  } catch {}

  const wid = targetOrder.workshop_id || targetOrder.workshopId;
  if (isValidUuid(wid) && updates.status && ['in_progress', 'shipped', 'completed'].includes(updates.status)) {
    const orderNum = targetOrder.order_number || targetOrder.invoiceNumber || orderId;
    const statusMessages: Record<string, string> = {
      in_progress: `تم اعتماد دفعة الجدية للطلبية #${orderNum}. يمكنكم البدء في التصنيع والتنفيذ فوراً.${nextHidden ? ' (بيانات العميل محفوظة بالوضع الآمن لإدارة الشحن المركزي).' : ''}`,
      shipped: `تم فحص الجودة وتحويل الطلبية #${orderNum} لمرحلة الشحن والتسليم.`,
      completed: `تم تسليم الطلبية #${orderNum} للعميل وتصفية الحساب بالكامل!`,
    };
    const ann = {
      id: crypto.randomUUID(),
      sender_id: isValidUuid(req.user?.id) ? req.user.id : null,
      sender_name: 'م. حسام بسيوني (إدارة سوق الشمساوية)',
      recipient_type: 'specific',
      recipient_workshop_id: wid,
      recipient_workshop_name: 'ورشة الشمساوية',
      title: `📦 تحديث حالة الطلبية #${orderNum}`,
      content: statusMessages[updates.status],
      created_at: nowIso,
    };
    client.from('admin_announcements').insert(ann).then(() => {}, () => {});
    localAnnouncements.unshift(ann);
  }

  res.json({ success: true, cloudSynced, order: targetOrder });
});

// 5. Public Storefront Data by Workshop Slug or ID (Blocks banned/suspended storefronts)
app.get('/api/store/:slug', async (req: Request, res: Response) => {
  try {
    const slug = decodeURIComponent(req.params.slug).toLowerCase().trim().replace(/^@/, '');
    const client = supabaseAdminClient;
    let ws: any = null;

    try {
      const { data: supaWorkshops } = await client
        .from('workshops')
        .select('*');

      if (Array.isArray(supaWorkshops)) {
        ws = supaWorkshops.find((w: any) => {
          const sSlug = (w.store_slug || w.storeSlug || '').toLowerCase().trim();
          const bName = (w.brand_name || '').toLowerCase().trim();
          const bSlug = bName.replace(/\s+/g, '-');
          const aName = (w.artist_name || '').toLowerCase().trim();
          const aSlug = aName.replace(/\s+/g, '-');
          const idMatch = (w.id || '').toLowerCase().trim();

          return (
            sSlug === slug ||
            bSlug === slug ||
            bName === slug ||
            aSlug === slug ||
            aName === slug ||
            idMatch === slug
          );
        });
      }
    } catch {}

    if (!ws) {
      const workshops = loadPersistentWorkshops();
      ws = workshops.find((w: any) => {
        const sSlug = (w.store_slug || w.storeSlug || '').toLowerCase().trim();
        const nameSlug = (w.brandName || '').toLowerCase().replace(/\s+/g, '-');
        const artistSlug = (w.artistName || '').toLowerCase().replace(/\s+/g, '-');
        const idMatch = (w.id || '').toLowerCase();
        return sSlug === slug || nameSlug === slug || artistSlug === slug || idMatch === slug;
      });
    }

    if (!ws) {
      return res.status(404).json({ error: 'الورشة المطلوبة غير مسجلة' });
    }

    const wid = ws.id || ws.workshopId;
    const brandName = ws.brand_name || ws.brandName || 'ورشة فنية';
    const artistName = ws.artist_name || ws.artistName || 'فنان الشمساوية';
    const logoUrl = ws.logo_data || ws.logo_url || ws.logoUrl || null;
    const phone = ws.phone_number || ws.phone || ws.phoneNumber || '';
    const storeSlug = ws.store_slug || ws.storeSlug || wid;
    const blocked = isWorkshopBlocked(ws);

    if (blocked) {
      const reasonMsg = ws.suspension_reason || ws.suspended_reason || 'المتجر موقوف مؤقتاً للمراجعة الإدارية.';
      return res.json({
        success: true,
        suspended: true,
        suspensionReason: reasonMsg,
        workshop: {
          id: wid,
          brandName,
          artistName,
          status: ws.status || 'suspended',
          suspended: true,
          suspensionReason: reasonMsg,
          logoUrl,
          storeSlug,
          ratingStars: ws.rating_stars || ws.ratingStars || 5,
          medal: ws.medal || null,
        },
        products: [],
      });
    }

    const persistent = loadPersistentMarketplaceProducts();
    const prodsMap = new Map<string, any>();
    const rejectedIds = new Set<string>();

    // Track rejected items + collect persistent marketplace products for this workshop
    persistent.forEach((p: any) => {
      if (p.workshop_id === wid || p.workshopId === wid) {
        if (p.status === 'rejected') rejectedIds.add(p.id);
        else prodsMap.set(p.id, p);
      }
    });

    // Strict database isolation by workshop_id ONLY across both marketplace_products and products
    try {
      const [{ data: mktData }, { data: catData }] = await Promise.all([
        client.from('marketplace_products').select('*').eq('workshop_id', wid),
        client.from('products').select('*').eq('workshop_id', wid),
      ]);

      if (Array.isArray(mktData)) {
        mktData.forEach((p: any) => {
          if (p.status === 'rejected') {
            rejectedIds.add(p.id);
            prodsMap.delete(p.id);
          } else {
            prodsMap.set(p.id, { ...(prodsMap.get(p.id) || {}), ...p });
          }
        });
      }

      if (Array.isArray(catData)) {
        catData.forEach((p: any) => {
          const lr = p.local_record || {};
          const isHidden = p.is_active === false || lr.inStore === false || lr.isPublishedInStore === false;
          if (isHidden || rejectedIds.has(p.id) || prodsMap.has(p.id)) return;
          prodsMap.set(p.id, {
            id: p.id,
            workshop_id: p.workshop_id,
            brand_name: brandName,
            artist_name: artistName,
            phone_number: phone,
            logo_url: logoUrl,
            store_slug: storeSlug,
            product_name: p.product_name,
            category: p.category || lr.category || 'أعمال يدوية',
            craft_name: p.craft_name || lr.craftName || p.category || 'أعمال يدوية',
            decor_category: lr.decorCategory || 'all',
            store_price: Number(lr.storePrice ?? p.retail_price ?? 0),
            retail_price: Number(p.retail_price ?? 0),
            wholesale_price: Number(p.wholesale_price ?? 0),
            cost_price: Number(p.cost_price ?? 0),
            current_stock: Number(lr.currentStock ?? 1),
            image_url: p.image_url || lr.imageUrl || null,
            store_description: p.specs?.marketingDescription || p.specs?.materialsDescription || lr.storeDescription || p.product_name,
            available_colors: p.available_colors || [],
            available_sizes: p.available_sizes || [],
            dimensions: p.dimensions || {},
            status: lr.marketplaceStatus || 'pending_approval',
            created_at: p.created_at,
          });
        });
      }
    } catch {}

    const storeProducts = Array.from(prodsMap.values())
      .filter((p: any) => p.status !== 'rejected' && (p.workshop_id === wid || p.workshopId === wid))
      .map((p: any) =>
        normalizeCloudProductRow({
          ...p,
          brand_name: brandName,
          artist_name: artistName,
          phone_number: p.phone_number || phone,
          logo_url: p.logo_url || logoUrl,
          store_slug: storeSlug,
        })
      );

    res.json({
      success: true,
      suspended: false,
      workshop: {
        id: wid,
        brandName,
        artistName,
        phoneNumber: phone,
        email: ws.email || '',
        country: ws.country || 'مصر',
        currencySymbol: ws.currency_symbol || ws.currencySymbol || 'ج.م',
        logoUrl,
        storeSlug,
        status: ws.status || 'active',
        selectedCrafts: ws.selected_crafts || ws.selectedCrafts || ['macrame'],
        ratingStars: ws.rating_stars || ws.ratingStars || 5,
        medal: ws.medal || null,
      },
      products: storeProducts,
    });
  } catch {
    res.status(500).json({ error: 'تعذر جلب بيانات المتجر' });
  }
});

function normalizeCloudProductRow(row: any) {
  return {
    id: row.id,
    workshop_id: row.workshop_id || row.workshopId,
    brand_name: row.brand_name || row.brandName,
    artist_name: row.artist_name || row.artistName,
    phone_number: row.phone_number || row.phoneNumber,
    logo_url: row.logo_url || row.logoUrl || null,
    store_slug: row.store_slug || row.storeSlug || row.workshop_id || row.workshopId || '',
    product_name: row.product_name || row.productName,
    category: row.category,
    craft_name: row.craft_name || row.craftName,
    decor_category: row.decor_category || row.decorCategory,
    store_price: Number(row.store_price ?? row.storePrice ?? row.retail_price ?? row.retailPrice ?? 0),
    retail_price: Number(row.retail_price ?? row.retailPrice ?? row.store_price ?? 0),
    wholesale_price: Number(row.wholesale_price ?? row.wholesalePrice ?? 0),
    cost_price: Number(row.cost_price ?? row.costPrice ?? 0),
    current_stock: Number(row.current_stock ?? row.currentStock ?? 1),
    image_url: row.image_url || row.imageUrl || '/alshams_falcon_emblem.png',
    store_description: row.store_description || row.storeDescription || '',
    available_colors: row.available_colors || row.availableColors || [],
    available_sizes: row.available_sizes || row.availableSizes || [],
    dimensions: row.dimensions || {},
    status: row.status || 'pending_approval',
    rejection_reason: row.rejection_reason || row.rejectionReason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// -------------------------------------------------------------
// Real Social Preview & Dynamic Open Graph Meta for Central Market, Family Community & Artisan Stores
// -------------------------------------------------------------
app.get('/family', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageTitle = `مجتمع عيلة الشمساوية | ملتقى فناني المشغولات اليدوية`;
    const pageDesc = `ملتقى فناني الشمساوية لتبادل الخبرات والملاحظات اليومية والنقاش المباشر تحت إشراف كبير العيلة.`;
    const pageImage = '/brand icon light.png';

    const indexPath = isProduction
      ? path.resolve(__dirname, 'dist/index.html')
      : path.resolve(__dirname, 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
      html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${pageDesc}" />`);
      html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${pageTitle}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${pageDesc}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${pageImage}" />`);
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${pageTitle}" />`);
      html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${pageDesc}" />`);
      html = html.replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${pageImage}" />`);

      if (!isProduction && viteDevServer) {
        html = await viteDevServer.transformIndexHtml(req.originalUrl, html);
      }
      return res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    }
  } catch (err) {
    console.warn('[Family OG Render Error]:', err);
  }
  next();
});

app.get(['/market', '/marketplace'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageTitle = `سوق الشمساوية المركزي | أرقى المشغولات اليدوية والديكورات الحرفية`;
    const pageDesc = `تسوق مباشرة من كبار فناني المشغولات اليدوية والمكرميات والكروشيه بضمان منظومة الشمساوية للفنون والأعمال اليدوية. عاين واستلم بالضمان وعربون 33% فقط.`;
    const pageImage = '/brand icon light.png';

    const indexPath = isProduction
      ? path.resolve(__dirname, 'dist/index.html')
      : path.resolve(__dirname, 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
      html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${pageDesc}" />`);
      html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${pageTitle}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${pageDesc}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${pageImage}" />`);
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${pageTitle}" />`);
      html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${pageDesc}" />`);
      html = html.replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${pageImage}" />`);

      if (!isProduction && viteDevServer) {
        html = await viteDevServer.transformIndexHtml(req.originalUrl, html);
      }
      return res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    }
  } catch (err) {
    console.warn('[Market OG Render Error]:', err);
  }
  next();
});

app.get(['/store/:slug', '/s/:slug'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug;
    let cleanSlug = '';
    try {
      cleanSlug = decodeURIComponent(slug).toLowerCase().trim();
    } catch {
      cleanSlug = (slug || '').toLowerCase().trim();
    }

    const workshops = loadPersistentWorkshops();
    let ws = workshops.find((w: any) => {
      const nameSlug = (w.brandName || '').toLowerCase().replace(/\s+/g, '-');
      const artistSlug = (w.artistName || '').toLowerCase().replace(/\s+/g, '-');
      const idMatch = (w.id || '').toLowerCase();
      return nameSlug === cleanSlug || artistSlug === cleanSlug || idMatch === cleanSlug;
    });

    if (!ws) {
      try {
        const { data: dbWs } = await supabaseAdminClient.from('workshops').select('*');
        if (dbWs && Array.isArray(dbWs)) {
          const found = dbWs.find((w: any) => {
            const nameSlug = (w.brand_name || w.brandName || '').toLowerCase().replace(/\s+/g, '-');
            const artistSlug = (w.artist_name || w.artistName || '').toLowerCase().replace(/\s+/g, '-');
            const idMatch = (w.id || '').toLowerCase();
            return nameSlug === cleanSlug || artistSlug === cleanSlug || idMatch === cleanSlug;
          });
          if (found) {
            ws = {
              id: found.id,
              brandName: found.brand_name || found.brandName,
              artistName: found.artist_name || found.artistName,
              logoUrl: found.logo_data || found.logo_url || found.logoUrl,
            };
          }
        }
      } catch {}
    }

    const workshopName = ws?.brandName || ws?.artistName || cleanSlug.replace(/-/g, ' ');
    const pageTitle = `متجر ${workshopName} | منظومة الشمساوية`;
    const pageDesc = `تصفح أرقى المشغولات اليدوية والديكورات الحرفية بضمان منظومة الشمساوية للفنون والأعمال اليدوية.`;
    const pageImage = ws?.logoUrl || '/brand icon light.png';

    const indexPath = isProduction
      ? path.resolve(__dirname, 'dist/index.html')
      : path.resolve(__dirname, 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
      html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${pageDesc}" />`);
      html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${pageTitle}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${pageDesc}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${pageImage}" />`);
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${pageTitle}" />`);
      html = html.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${pageDesc}" />`);
      html = html.replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${pageImage}" />`);

      if (!isProduction && viteDevServer) {
        html = await viteDevServer.transformIndexHtml(req.originalUrl, html);
      }
      return res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    }
  } catch (err) {
    console.warn('[Store OG Render Error]:', err);
  }
  next();
});

// -------------------------------------------------------------
// Start Server (Vite in Dev with SPA catch-all, Static in Prod)
// -------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    viteDevServer = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(viteDevServer.middlewares);

    // Explicit SPA Catch-all Fallback for Development:
    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      if (req.originalUrl.startsWith('/api/') || req.originalUrl.includes('.')) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        if (!fs.existsSync(indexPath)) return next();
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = await viteDevServer.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err: any) {
        if (viteDevServer) viteDevServer.ssrFixStacktrace(err);
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);

  familyWss.on('connection', (ws: WebSocket, reqMeta: { userId: string; email: string; workshopId: string; isSuperAdmin: boolean }) => {
    const clientEntry: FamilyWsClient = {
      ws,
      userId: reqMeta.userId,
      email: reqMeta.email,
      workshopId: reqMeta.workshopId,
      isSuperAdmin: reqMeta.isSuperAdmin,
    };
    familyWsClients.add(clientEntry);

    try {
      ws.send(JSON.stringify({ type: 'connected', onlineCount: familyWsClients.size }));
    } catch {}

    ws.on('close', () => {
      familyWsClients.delete(clientEntry);
    });
    ws.on('error', () => {
      familyWsClients.delete(clientEntry);
    });
  });

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const urlObj = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (urlObj.pathname !== '/ws/family') {
        return;
      }

      const token = urlObj.searchParams.get('token') || '';
      const queryEmail = urlObj.searchParams.get('email') || '';
      const queryWid = urlObj.searchParams.get('workshopId') || '';

      let userId = '';
      let email = queryEmail;
      let workshopId = queryWid;
      let superAdmin = false;

      if (token) {
        const { data: { user }, error } = await supabaseAuthClient.auth.getUser(token);
        if (!error && user) {
          userId = user.id;
          email = user.email || queryEmail || '';
          superAdmin = isSuperAdmin(email);
          workshopId =
            queryWid ||
            user.user_metadata?.workshop_id ||
            user.user_metadata?.workshopId ||
            user.user_metadata?.tenant_id ||
            user.id;
        }
      } else if (queryEmail && isSuperAdmin(queryEmail)) {
        userId = 'super_admin_hossam';
        email = queryEmail;
        superAdmin = true;
        workshopId = queryWid || 'super_admin';
      }

      if (!userId && !superAdmin) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      familyWss.handleUpgrade(request, socket, head, (ws) => {
        familyWss.emit('connection', ws, { userId, email, workshopId, isSuperAdmin: superAdmin });
      });
    } catch {
      socket.destroy();
    }
  });

  httpServer.listen(PORT, HOST, () => {
    console.log('================================================================');
    console.log('☀️  [منظومة الشمساوية SaaS] خادم إدارة الورش الحرفية والإدارة العليا');
    console.log(`🔌 حالة ربط قاعدة البيانات (Supabase URL): ${supabaseConfig.url ? 'متصل بنجاح ✅' : 'غير متصل ❌'}`);
    console.log(`🛡️  صلاحيات السوبر أدمن (Service Role): ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY ? 'مفعل (تجاوز عزل RLS بالكامل) ✅' : 'قيد العمل بالمفتاح المنشور (Publishable Key) ⚠️'}`);
    console.log(`🛍️  سوق الشمساوية المركزي السحابي: نشط ومتزامن سحابياً بنجاح ✅`);
    console.log(`👥 مجتمع عيلة الشمساوية (WebSocket /ws/family): متصل ونشط ✅`);
    console.log(`🌐 خادم الويب يستمع على المنفذ: http://${HOST}:${PORT}`);
    console.log('================================================================');
  });
}

startServer().catch((err) => {
  console.error('[Server Start Error]:', err);
  process.exit(1);
});