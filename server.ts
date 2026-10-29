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

// Supabase Master / Anon Client for Auth verification
const supabaseAuthClient = createClient(supabaseConfig.url, supabaseConfig.publishableKey);

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
    const trainingResult = await processTrainingInteraction('shamousa', message.trim(), email);
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
    const trainingResult = await processTrainingInteraction('falcon', String(message).trim(), email);
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
      workshopContext: {
        ...(workshopContext || {}),
        artistName: (workshopContext?.artistName || artistName),
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