import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import supabaseConfig from './supabase-config.json';
import { aiProvider } from './server/aiProvider';

// Standalone server Supabase client for JWT verification (no browser session persistence)
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// In-memory daily rate limit tracker: 20 requests per UID per calendar day
interface UserRateLimitRecord {
  date: string;
  count: number;
}
const userDailyAiUsage = new Map<string, UserRateLimitRecord>();

function checkAndIncrementAiRateLimit(uid: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().split('T')[0];
  const record = userDailyAiUsage.get(uid);

  if (!record || record.date !== today) {
    userDailyAiUsage.set(uid, { date: today, count: 1 });
    return { allowed: true, remaining: 19 };
  }

  if (record.count >= 20) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: 20 - record.count };
}

// Request size limits for craft image payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health Check Endpoint (Required by AI Studio runtime)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Authenticate /api/* requests with Supabase access token (Authorization: Bearer <token>)
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error(`[AUTH 401] Missing or invalid Authorization header on ${req.method} ${req.path}`);
    return res.status(401).json({
      error: 'غير مصرح بالدخول (401)، يرجى تسجيل الدخول إلى ورشتك أولاً.',
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    console.error(`[AUTH 401] Empty Bearer token provided on ${req.method} ${req.path}`);
    return res.status(401).json({
      error: 'غير مصرح بالدخول (401)، رمز المصادقة فارغ.',
    });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.error(`[AUTH 401] Supabase token verification failed on ${req.method} ${req.path}:`, error?.message || 'User not found');
      return res.status(401).json({
        error: 'انتهت صلاحية جلسة الدخول أو الرمز غير صالح، يرجى إعادة تسجيل الدخول.',
        detail: error?.message,
      });
    }

    (req as any).user = { uid: data.user.id, email: data.user.email, ...data.user };
    next();
  } catch (err: any) {
    console.error(`[AUTH 401] Verification exception on ${req.method} ${req.path}:`, err?.message);
    return res.status(401).json({
      error: 'تعذر التحقق من الهوية، يرجى المحاولة لاحقاً.',
      detail: err?.message,
    });
  }
}

// 0. AI Usage Remaining Endpoint
app.get('/api/ai/usage', requireAuth, (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid;
    const today = new Date().toISOString().split('T')[0];
    const record = userDailyAiUsage.get(uid);
    const used = (!record || record.date !== today) ? 0 : record.count;
    const remaining = Math.max(0, 20 - used);
    return res.json({ used, remaining, limit: 20 });
  } catch (err: any) {
    console.error('Error fetching AI usage:', err);
    return res.status(500).json({ error: 'تعذر حساب الاستخدام اليومي', detail: err?.message });
  }
});

// 1. Vision Analysis API - "صقر الشمساوية AI"
const handleVisionAnalysis = async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid;
    const rateCheck = checkAndIncrementAiRateLimit(uid);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'تجاوزت الحد اليومي الأقصى (20 استشارة في اليوم) للمساعد الذكي. يتجدد رصيدك تلقائياً غداً.',
      });
    }

    const { imageBase64, mimeType = 'image/jpeg', artistNotes = '', activeCrafts = [] } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 payload' });
    }

    if (!aiProvider.isAvailable()) {
      return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير مفعّلة حالياً أو مفتاح API غير متوفر على السيرفر' });
    }

    const parsedData = await aiProvider.analyzeCraftVision({
      imageBase64,
      mimeType,
      artistNotes,
      activeCrafts: Array.isArray(activeCrafts) ? activeCrafts : [],
    });

    return res.json({
      ...parsedData,
      dailyAiRemaining: rateCheck.remaining,
    });
  } catch (error: any) {
    console.error('Vision analysis error:', error);
    return res.status(502).json({
      error: 'تعذر التحليل، يرجى المحاولة مرة أخرى.',
      detail: error?.message || String(error),
    });
  }
};

app.post('/api/analyze-vision', requireAuth, handleVisionAnalysis);
app.post('/api/ai/analyze-image', requireAuth, handleVisionAnalysis);

// 2. Chat Agent API - "صقر الشمساوية AI"
const handleChatAgent = async (req: Request, res: Response) => {
  try {
    const uid = (req as any).user?.uid;
    const rateCheck = checkAndIncrementAiRateLimit(uid);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'تجاوزت الحد اليومي الأقصى (20 استشارة في اليوم) للمساعد الذكي. يتجدد رصيدك تلقائياً غداً.',
      });
    }

    const { message, chatHistory = [], actionChip = null, currentContext = {} } = req.body;

    if (!aiProvider.isAvailable()) {
      return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير مفعّلة حالياً أو مفتاح API غير متوفر على السيرفر' });
    }

    const result = await aiProvider.chatWithAgent({
      message,
      actionChip,
      chatHistory,
      currentContext,
    });

    const reply = typeof result === 'string' ? result : result.reply;
    const sources = typeof result === 'object' && result.sources ? result.sources : [];

    return res.json({
      reply,
      sources,
      dailyAiRemaining: rateCheck.remaining,
    });
  } catch (error: any) {
    console.error('Chat Agent error:', error);
    return res.status(502).json({
      error: 'تعذر الاتصال بمساعد الذكاء الاصطناعي، يرجى المحاولة مرة أخرى.',
      detail: error?.message || String(error),
    });
  }
};

app.post('/api/chat-agent', requireAuth, handleChatAgent);
app.post('/api/ai/chat', requireAuth, handleChatAgent);

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
    console.log(`AlSHams Craft ERP running on port ${PORT} without Firebase`);
  });
}

startServer();
