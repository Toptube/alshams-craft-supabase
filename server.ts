import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import supabaseConfig from './supabase-config.json';
import {
  aiProvider,
  saveWorkshopSession,
  getWorkshopSession,
  clearWorkshopSession,
} from './server/aiProvider';

// Standalone server Supabase client for JWT verification
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Optional Service Role Client (for atomic RPC bump_ai_usage on server only)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceRoleClient = serviceRoleKey
  ? createClient(supabaseConfig.url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// In-memory daily rate limit fallback: 20 requests per workshop per calendar day
interface WorkshopRateLimitRecord {
  date: string;
  count: number;
}
const workshopDailyAiUsage = new Map<string, WorkshopRateLimitRecord>();

function checkAndIncrementMemoryRateLimit(workshopId: string): { allowed: boolean; remaining: number; count: number } {
  const today = new Date().toISOString().split('T')[0];
  const record = workshopDailyAiUsage.get(workshopId);

  if (!record || record.date !== today) {
    workshopDailyAiUsage.set(workshopId, { date: today, count: 1 });
    return { allowed: true, remaining: 19, count: 1 };
  }

  if (record.count >= 20) {
    return { allowed: false, remaining: 0, count: record.count };
  }

  record.count += 1;
  return { allowed: true, remaining: 20 - record.count, count: record.count };
}

function getMemoryUsageRemaining(workshopId: string): { used: number; remaining: number } {
  const today = new Date().toISOString().split('T')[0];
  const record = workshopDailyAiUsage.get(workshopId);
  const used = !record || record.date !== today ? 0 : record.count;
  return { used, remaining: Math.max(0, 20 - used) };
}

/**
 * 3) الحد اليومي 20 طلباً لكل ورشة:
 * استدعِ rpc('bump_ai_usage', { p_workshop }) بعميل مفتاح الخدمة.
 * إن زاد الناتج عن 20 فارجع 429 برسالة عربية.
 * وإن لم يتوفر المفتاح أو فشل الـ RPC فارجع لعدّاد الذاكرة.
 */
async function recordAndCheckAiUsage(workshopId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (serviceRoleClient) {
    try {
      const { data, error } = await serviceRoleClient.rpc('bump_ai_usage', { p_workshop: workshopId });
      if (!error && typeof data === 'number') {
        const count = data;
        if (count > 20) {
          return { allowed: false, remaining: 0 };
        }
        return { allowed: true, remaining: Math.max(0, 20 - count) };
      }
      if (error) {
        console.warn('RPC bump_ai_usage warning, falling back to memory counter:', error.message);
      }
    } catch (rpcErr: any) {
      console.warn('RPC bump_ai_usage exception, falling back to memory counter:', rpcErr?.message);
    }
  }

  const memResult = checkAndIncrementMemoryRateLimit(workshopId);
  return { allowed: memResult.allowed, remaining: memResult.remaining };
}

// Request size limits for craft image payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health Check Endpoint (Required by AI Studio runtime)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

/**
 * 2) لكل طلب إلى /api/*:
 * - تحقق من رمز المستخدم (Authorization: Bearer <token>)
 * - اقرأ ورشته بعميل مؤقت يحمل رمز المستخدم نفسه (فتطبَّق قواعد الأمان RLS):
 *   id و status والدولة والعملة و selected_crafts و settings.
 * - إن كانت status = 'suspended' فارجع 403 مع رسالة عربية واضحة.
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'سجّل دخولك الأول للوصول إلى استشارات وتحليلات صقر الشمساوية AI.',
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({
      error: 'سجّل دخولك الأول للوصول إلى استشارات وتحليلات صقر الشمساوية AI.',
    });
  }

  try {
    // 1. تحقق من صحة الرمز وجلسة المستخدم
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({
        error: 'سجّل دخولك الأول للوصول إلى استشارات وتحليلات صقر الشمساوية AI.',
        detail: authError?.message,
      });
    }

    const user = authData.user;

    // 2. عميل مؤقت يحمل رمز المستخدم نفسه لتطبيق RLS
    const userClient = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // 3. قراءة الورشة: id و status والدولة والعملة و selected_crafts و settings
    let workshopRow: any = null;
    try {
      const { data: workshop, error: wsError } = await userClient
        .from('workshops')
        .select('id, status, country, currency, selected_crafts, settings')
        .limit(1)
        .maybeSingle();

      if (!wsError && workshop) {
        workshopRow = workshop;
      }
    } catch (fetchErr) {
      console.warn('Could not query workshop via user client:', fetchErr);
    }

    // 4. إن كانت status = 'suspended' فارجع 403
    if (workshopRow?.status === 'suspended') {
      return res.status(403).json({
        error: 'الحساب موقوف، يرجى التواصل مع الإدارة.',
      });
    }

    (req as any).user = { uid: user.id, email: user.email, ...user };
    (req as any).workshop = workshopRow;
    (req as any).workshopId = workshopRow?.id || user.id;
    (req as any).token = token;

    next();
  } catch (err: any) {
    console.error(`[AUTH 401] Verification exception on ${req.method} ${req.path}:`, err?.message);
    return res.status(401).json({
      error: 'سجّل دخولك الأول للوصول إلى استشارات وتحليلات صقر الشمساوية AI.',
      detail: err?.message,
    });
  }
}

// 0. AI Usage Remaining Endpoint
app.get('/api/ai/usage', requireAuth, (req: Request, res: Response) => {
  try {
    const workshopId = (req as any).workshopId;
    const { used, remaining } = getMemoryUsageRemaining(workshopId);
    return res.json({ used, remaining, limit: 20 });
  } catch (err: any) {
    console.error('Error fetching AI usage:', err);
    return res.status(500).json({ error: 'تعذر حساب الاستخدام اليومي', detail: err?.message });
  }
});

// 1. Vision Analysis API - "صقر الشمساوية AI" (تحليل الصور على خطوتين)
const handleVisionAnalysis = async (req: Request, res: Response) => {
  try {
    const workshopId = (req as any).workshopId;
    const workshop = (req as any).workshop;

    // فحص الحد اليومي (20 طلباً لكل ورشة)
    const usageCheck = await recordAndCheckAiUsage(workshopId);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: 'انتهى الحد اليومي (20 استشارة في اليوم) للمساعد الذكي. يتجدد رصيدك تلقائياً غداً.',
      });
    }

    const { imageBase64, mimeType = 'image/jpeg', artistNotes = '', activeCrafts } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 payload' });
    }

    if (!aiProvider.isAvailable()) {
      return res.status(503).json({ error: 'الخدمة غير مفعّلة حالياً على الخادم' });
    }

    // استخراج أجر الساعة من settings.hourlyRate في الورشة (الافتراضي 30)
    const hourlyRate =
      workshop?.settings?.hourlyRate !== undefined && workshop?.settings?.hourlyRate !== null
        ? Number(workshop.settings.hourlyRate)
        : 30;

    const crafts = Array.isArray(activeCrafts)
      ? activeCrafts
      : Array.isArray(workshop?.selected_crafts)
      ? workshop.selected_crafts
      : ['macrame'];

    const parsedData = await aiProvider.analyzeCraftVision({
      imageBase64,
      mimeType,
      artistNotes,
      workshopContext: {
        activeCrafts: crafts,
        country: workshop?.country || 'جمهورية مصر العربية',
        currency: workshop?.currency || 'ج.م',
        hourlyRate,
      },
    });

    return res.json({
      ...parsedData,
      dailyAiRemaining: usageCheck.remaining,
    });
  } catch (error: any) {
    console.error('Vision analysis error:', error);
    return res.status(502).json({
      error: 'تعذر الرد، حاول مرة أخرى.',
      detail: error?.message || String(error),
    });
  }
};

app.post('/api/analyze-vision', requireAuth, handleVisionAnalysis);
app.post('/api/ai/analyze-image', requireAuth, handleVisionAnalysis);

// 2. Chat Agent API - "صقر الشمساوية AI" (دردشة وبحث موثوق)
const handleChatAgent = async (req: Request, res: Response) => {
  try {
    const workshopId = (req as any).workshopId;
    const workshop = (req as any).workshop;

    // فحص الحد اليومي (20 طلباً لكل ورشة)
    const usageCheck = await recordAndCheckAiUsage(workshopId);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: 'انتهى الحد اليومي (20 استشارة في اليوم) للمساعد الذكي. يتجدد رصيدك تلقائياً غداً.',
      });
    }

    const { message, chatHistory = [], actionChip = null, currentContext = {} } = req.body;

    if (!aiProvider.isAvailable()) {
      return res.status(503).json({ error: 'الخدمة غير مفعّلة حالياً على الخادم' });
    }

    // الخصوصية: أرسل للنموذج فقط أسماء الحِرف المفعّلة والدولة والعملة وتصنيف المنتج الحالي
    const safeSelectedCrafts = Array.isArray(workshop?.selected_crafts)
      ? workshop.selected_crafts
      : Array.isArray(currentContext.selectedCrafts)
      ? currentContext.selectedCrafts
      : ['macrame'];

    const safeCountry = workshop?.country || currentContext.country || 'جمهورية مصر العربية';
    const safeCurrency = workshop?.currency || currentContext.currency || 'ج.م';
    const safeCategory = currentContext.category || 'عام';

    const result = await aiProvider.chatWithAgent({
      message,
      actionChip,
      chatHistory,
      workshopContext: {
        selectedCrafts: safeSelectedCrafts,
        country: safeCountry,
        currency: safeCurrency,
        category: safeCategory,
      },
    });

    return res.json({
      reply: result.reply,
      sources: result.sources || [],
      searchUsed: result.searchUsed,
      searchEntryPoint: result.searchEntryPoint,
      dailyAiRemaining: usageCheck.remaining,
    });
  } catch (error: any) {
    console.error('Chat Agent error:', error);
    return res.status(502).json({
      error: 'تعذر الرد، حاول مرة أخرى.',
      detail: error?.message || String(error),
    });
  }
};

app.post('/api/chat-agent', requireAuth, handleChatAgent);
app.post('/api/ai/chat', requireAuth, handleChatAgent);

// 3. Chat Session Persistence Endpoints (حفظ واسترجاع جلسة المحادثة للورشة دون بيانات حساسة)
app.get('/api/ai/session', requireAuth, (req: Request, res: Response) => {
  const workshopId = (req as any).workshopId;
  const session = getWorkshopSession(workshopId);
  return res.json({
    messages: session?.messages || [],
    updatedAt: session?.updatedAt || null,
  });
});

app.post('/api/ai/session', requireAuth, (req: Request, res: Response) => {
  const workshopId = (req as any).workshopId;
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }
  const session = saveWorkshopSession(workshopId, messages);
  return res.json({
    success: true,
    count: session.messages.length,
    updatedAt: session.updatedAt,
  });
});

app.delete('/api/ai/session', requireAuth, (req: Request, res: Response) => {
  const workshopId = (req as any).workshopId;
  clearWorkshopSession(workshopId);
  return res.json({ success: true, message: 'تم إفراغ جلسة المحادثة بنجاح' });
});

// Global Error Handler to guarantee the server never crashes
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER GLOBAL ERROR]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم', detail: err?.message || String(err) });
  }
});

// Start Server Engine
async function startServer() {
  const distIndex = path.join(process.cwd(), 'dist', 'index.html');
  const useBuilt = process.env.NODE_ENV === 'production' || fs.existsSync(distIndex);

  if (useBuilt && fs.existsSync(distIndex)) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(distIndex));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AlSHams Craft ERP running on port ${PORT} with Falcon AI engine`);
  });
}

startServer();
