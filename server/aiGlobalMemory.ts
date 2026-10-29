import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../supabase-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const BACKUP_FILE = path.resolve(DATA_DIR, 'ai_global_memory.json');

// Initialize Supabase admin/anon client
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey);

export interface GlobalMemoryRecord {
  id: string;
  agent_type: 'shamousa' | 'falcon' | 'both';
  title: string;
  rules: string;
  metadata?: any;
  is_active: boolean;
  created_at: string;
}

export interface TrainingSession {
  in_training_mode: boolean;
  agent_type: 'shamousa' | 'falcon';
  user_email: string;
  buffer: string[];
  currentDraft: string;
  startedAt: string;
}

// In-memory sessions indexed by normalized email
const trainingSessions = new Map<string, TrainingSession>();

// In-memory memory cache for instant prompt injection
let cachedMemories: GlobalMemoryRecord[] = [];
let lastCacheUpdate = 0;

// Ensure local storage directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(BACKUP_FILE)) {
    const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
    cachedMemories = JSON.parse(raw);
  }
} catch (e) {
  console.warn('[AI Global Memory] Local cache init warning:', e);
}

/**
 * Super Admin check:
 * Approved email: hmb.top.tupe@gmail.com (Eng. Hossam / الباشمهندس حسام)
 * Also handles variations (hmb.top.tube@gmail.com, case insensitive)
 */
export function isSuperAdmin(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === 'hmb.top.tupe@gmail.com' ||
    normalized === 'hmb.top.tube@gmail.com' ||
    normalized.startsWith('hmb.top.tupe') ||
    normalized.startsWith('hmb.top.tube')
  );
}

/**
 * Persist cache to local JSON backup
 */
function saveLocalBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(cachedMemories, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AI Global Memory] Failed saving local backup:', err);
  }
}

/**
 * Fetch active memories from Supabase or fallback cache
 */
export async function getActiveGlobalMemories(agentType?: 'shamousa' | 'falcon'): Promise<GlobalMemoryRecord[]> {
  const now = Date.now();
  // Refresh cache every 15 seconds or use local memory
  if (now - lastCacheUpdate > 15000) {
    try {
      const { data, error } = await supabase
        .from('ai_global_memory')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        cachedMemories = data.map((d: any) => ({
          id: String(d.id),
          agent_type: (d.agent || d.agent_type || 'both') as any,
          title: d.title || d.category || 'توجيه وقاعدة هندسية معتمدة',
          rules: d.content || d.rules || '',
          metadata: d.metadata || {},
          is_active: d.is_active !== false,
          created_at: d.created_at || new Date().toISOString(),
        }));
        lastCacheUpdate = now;
        saveLocalBackup();
      }
    } catch {
      // Supabase table or query error, safely use cachedMemories
    }
  }

  return cachedMemories.filter((m) => {
    if (!m.is_active) return false;
    if (!agentType) return true;
    return m.agent_type === agentType || m.agent_type === 'both' || !m.agent_type;
  });
}

/**
 * Formats active global memories into a clean string to inject directly into agent system prompt
 */
export async function buildGlobalMemoryPrompt(agentType: 'shamousa' | 'falcon'): Promise<string> {
  const memories = await getActiveGlobalMemories(agentType);
  if (memories.length === 0) return '';

  const blocks = memories.map((m, idx) => {
    return `[قاعدة معتمدة #${idx + 1} - ${m.title || 'توجيه هندسي وتطبيقي'}]:\n${m.rules}`;
  });

  return `\n\n## 🧠 الذاكرة المركزية والقواعد البرمجية المكتسبة المباشرة (معتمدة من الباشمهندس حسام):
تعتبر هذه القواعد والتعليمات والمعادلات الحرفية نافذة ومقدمة على أي تعليمات سابقة وملزمة في كافة استجاباتك وتحليلاتك لجميع المستخدمين:
${blocks.join('\n\n---\n\n')}\n`;
}

/**
 * Save new memory record to Supabase and cache
 */
export async function saveGlobalMemoryRecord(record: {
  agent_type: 'shamousa' | 'falcon';
  title: string;
  rules: string;
  metadata?: any;
  scopedClient?: any;
}): Promise<GlobalMemoryRecord> {
  const newEntry: GlobalMemoryRecord = {
    id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    agent_type: record.agent_type,
    title: record.title || `جلسة تدريب برمجية - ${new Date().toLocaleDateString('ar-EG')}`,
    rules: record.rules,
    metadata: {
      author: 'الباشمهندس حسام',
      author_email: 'hmb.top.tupe@gmail.com',
      created_at: new Date().toISOString(),
      ...(record.metadata || {}),
    },
    is_active: true,
    created_at: new Date().toISOString(),
  };

  // 1. Add to cache & local file immediately
  cachedMemories.unshift(newEntry);
  lastCacheUpdate = Date.now();
  saveLocalBackup();

  // 2. Try persisting to Supabase with real table columns (agent, content, category)
  const clientToUse = record.scopedClient || supabase;
  try {
    const { data, error } = await clientToUse
      .from('ai_global_memory')
      .insert([
        {
          agent: newEntry.agent_type,
          content: newEntry.rules,
          category: newEntry.title,
          is_active: true,
        },
      ])
      .select();

    if (!error && data?.[0]) {
      newEntry.id = String(data[0].id || newEntry.id);
    } else if (error) {
      // Try alternate schema with agent_type and rules
      await clientToUse
        .from('ai_global_memory')
        .insert([
          {
            agent_type: newEntry.agent_type,
            title: newEntry.title,
            rules: newEntry.rules,
            metadata: newEntry.metadata,
            is_active: true,
          },
        ])
        .select()
        .catch(() => {});
    }
  } catch (e) {
    console.warn('[AI Global Memory] Supabase insert warning (local cache active):', e);
  }

  return newEntry;
}

/**
 * Retrieve or initialize active training session
 */
export function getTrainingSession(email: string, agentType: 'shamousa' | 'falcon'): TrainingSession {
  const key = `${email.toLowerCase().trim()}_${agentType}`;
  let session = trainingSessions.get(key);
  if (!session) {
    session = {
      in_training_mode: false,
      agent_type: agentType,
      user_email: email,
      buffer: [],
      currentDraft: '',
      startedAt: new Date().toISOString(),
    };
    trainingSessions.set(key, session);
  }
  return session;
}

export function clearTrainingSession(email: string, agentType: 'shamousa' | 'falcon') {
  const key = `${email.toLowerCase().trim()}_${agentType}`;
  trainingSessions.delete(key);
}

/**
 * Normalizes input text for keyword matching
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/[ـ\s]+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي$/g, 'ى');
}

/**
 * AI Summarizer to formulate instructions into solid engineering rules
 */
export async function summarizeTrainingInstructions(rawContent: string): Promise<string> {
  const prompt = `أنت المساعد الذكي والمحلل الهندسي المسؤول عن صياغة وتوثيق القواعد البرمجية لمنظومة الشمساوية تحت إشراف الباشمهندس حسام.
قم بتحليل التعليمات والبيانات والمعادلات الحرفية التالية وإعادة صياغتها كقواعد برمجية وهندسية صلبة ومركزة ومحكمة ومقسمة ببنود واضحة جاهزة للحفظ والاعتماد:

[المحتوى الفني والتعليمات]:
${rawContent}

القواعد المطلوبة:
- صياغة هندسية دقيقة وقاطعة بدون أي مقدمات إنشائية أو رغي.
- تقسيم القواعد إلى بنود مرقمة وواضحة (مثال: [قاعدة 1 - المعادلة الفنية]، [قاعدة 2 - سياسة التسعير]).
- إبراز كافة المعادلات الرياضية بدقة (رموز وأرقام).
- جاهزة للاعتماد في الذاكرة الدائمة للذكاء الاصطناعي لكافة الورش.`;

  // 1. Groq attempt
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (e) {
      console.warn('[AI Global Memory] Groq summarizer warning:', e);
    }
  }

  // 2. Gemini fallback
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const txt = resp?.text?.trim();
      if (txt) return txt;
    } catch (e) {
      console.warn('[AI Global Memory] Gemini summarizer warning:', e);
    }
  }

  // Fallback direct structuring
  const lines = rawContent.split('\n').filter((l) => l.trim().length > 0);
  return lines.map((line, idx) => `[قاعدة معتمدة #${idx + 1}]:\n${line}`).join('\n\n');
}

/**
 * Handle Interactive Super Admin Training Flow
 */
export async function processTrainingInteraction(
  agentType: 'shamousa' | 'falcon',
  rawMessage: string,
  userEmail: string,
  aiSummarizer?: (text: string) => Promise<string>,
  scopedClient?: any
): Promise<{ handled: boolean; reply: string; inTrainingMode: boolean }> {
  if (!isSuperAdmin(userEmail)) {
    return { handled: false, reply: '', inTrainingMode: false };
  }

  const effectiveSummarizer = aiSummarizer || summarizeTrainingInstructions;

  const session = getTrainingSession(userEmail, agentType);
  const trimmed = rawMessage.trim();
  const normalized = normalizeText(trimmed);

  // 1. Keyword: "هبرمجك"
  if (normalized === 'هبرمجك' || normalized.includes('هبرمجك')) {
    session.in_training_mode = true;
    session.buffer = [];
    session.currentDraft = '';

    const exactReply =
      agentType === 'shamousa'
        ? 'حبيبي ياهندسه ,, شموسه بين إديك وجاهزه لبرمجتك .. تحب تعمل ايه النهارده!'
        : 'ربنا يخليك لينا يا باشمهندس حسام .. تعيش وتبرمجنا .. انا جاهز وتحت أمرك .. اتفضل إبدأ !!';

    return {
      handled: true,
      reply: exactReply,
      inTrainingMode: true,
    };
  }

  // If not currently in training mode, don't intercept normal conversation
  if (!session.in_training_mode) {
    return { handled: false, reply: '', inTrainingMode: false };
  }

  // 2. Keyword: "كده تمام" (Finish and exit training mode)
  if (
    normalized === 'كده تمام' ||
    normalized === 'كدا تمام' ||
    normalized.startsWith('كده تمام') ||
    normalized.startsWith('كدا تمام') ||
    normalized.includes('كده تمام') ||
    normalized.includes('كدا تمام')
  ) {
    session.in_training_mode = false;
    session.buffer = [];
    session.currentDraft = '';

    const ack =
      agentType === 'shamousa'
        ? 'تمام يا باشمهندس حسام 🌞، خرجنا من وضع البرمجة والتدريب وكل القواعد والمعلومات بقت شغالة ومطبقة فوراً مع كل الناس والشغل زي الألف!'
        : 'تمام التمام يا باشمهندس حسام 🦅، تم الخروج من وضع التدريب وكافة القواعد والمعادلات الهندسية المعتمدة أصبحت نافذة في المنظومة بالكامل!';

    return {
      handled: true,
      reply: ack,
      inTrainingMode: false,
    };
  }

  // 3. Keyword: "احفظ" (Save the current draft/buffer to ai_global_memory)
  if (
    normalized === 'احفظ' ||
    normalized.startsWith('احفظ') ||
    normalized.includes('احفظ') ||
    normalized === 'احفظ يا صقر' ||
    normalized === 'احفظي يا شموسه'
  ) {
    const rulesToSave =
      session.currentDraft ||
      (session.buffer.length > 0
        ? session.buffer.join('\n\n')
        : 'قواعد تدريبية عامة معتمدة من الباشمهندس حسام');

    await saveGlobalMemoryRecord({
      agent_type: agentType,
      title: `قواعد برمجية معتمدة (${agentType === 'shamousa' ? 'شموسة' : 'صقر'})`,
      rules: rulesToSave,
      scopedClient,
    });

    session.buffer = [];
    session.currentDraft = '';

    // Exact response required by prompt:
    const exactReply = 'تم الحفظ بسلام .. في أي حاجه تانيه هنعملها النهارده؟';

    return {
      handled: true,
      reply: exactReply,
      inTrainingMode: true,
    };
  }

  // 4. Keyword: "هنكمل" (Continue receiving new inputs)
  if (
    normalized === 'هنكمل' ||
    normalized.startsWith('هنكمل') ||
    normalized.includes('هنكمل') ||
    normalized === 'يلا نكمل' ||
    normalized === 'نكمل'
  ) {
    return {
      handled: true,
      reply:
        agentType === 'shamousa'
          ? 'معاك يا باشمهندس وسامعاك بكل تركيز.. اتفضل كمل باقي التعليمات أو البيانات!'
          : 'معاك وتحت أمرك يا باشمهندس حسام.. اتفضل اطرح باقي المعادلات والتوجيهات الفنية!',
      inTrainingMode: true,
    };
  }

  // 5. Keyword: "فهمت ؟!" / "فهمت؟!" / "فهمت؟" / "فهمت"
  if (
    normalized.startsWith('فهمت') ||
    normalized.includes('فهمت') ||
    trimmed.includes('فهمت ؟!') ||
    trimmed.includes('فهمت؟!') ||
    trimmed.includes('فهمت؟') ||
    trimmed.includes('فهمت!')
  ) {
    const rawContent = session.buffer.join('\n\n');

    let formattedRules = '';
    if (effectiveSummarizer && rawContent.trim()) {
      try {
        formattedRules = await effectiveSummarizer(rawContent);
      } catch (e) {
        console.warn('[AI Global Memory] Summarizer error, falling back to direct synthesis:', e);
      }
    }

    if (!formattedRules) {
      formattedRules = session.buffer
        .map((b, i) => `• قاعدة برمجية #${i + 1}:\n${b}`)
        .join('\n\n');
    }

    session.currentDraft = formattedRules;

    const reply = `كله تمام وزي الفل 🫡✨

إليك التحليل المنطقي والهندسي وإعادة الصياغة الشاملة لكافة ما تفضلت به ومستعد لحفظه كقواعد برمجية صلبة:

${formattedRules}

---
💡 جاهز للأمر التالي:
- اكتب "احفظ" لاعتماد هذه القواعد فوراً وتعميمها في عقل المنظومة لكافة المستخدمين.
- أو اكتب "عدل كذا وكذا" لإعادة ضبط أي جزئية.
- أو اكتب "هنكمل" لإضافة نقاط جديدة.`;

    return {
      handled: true,
      reply,
      inTrainingMode: true,
    };
  }

  // 6. Keyword: "عدل ..." (Adjust previous draft)
  if (normalized.startsWith('عدل') || normalized.startsWith('تعديل')) {
    const modification = trimmed;
    session.buffer.push(`[تعديل وتصحيح]: ${modification}`);

    const rawContent = session.buffer.join('\n\n');
    let updatedRules = '';
    if (effectiveSummarizer) {
      try {
        updatedRules = await effectiveSummarizer(
          `القواعد السابقة:\n${session.currentDraft}\n\nطلب التعديل الجديد:\n${modification}`
        );
      } catch (e) {
        console.warn('[AI Global Memory] Adjustment summarizer failed:', e);
      }
    }

    if (!updatedRules) {
      updatedRules = `${session.currentDraft}\n\n• تم الأخذ في الاعتبار التعديل التالي:\n${modification}`;
    }

    session.currentDraft = updatedRules;

    const reply = `كله تمام وزي الفل، تم تعديل وضبط القواعد الهندسية والبرمجية وفق توجيهاتك يا باشمهندس:

${updatedRules}

---
جاهز لتنفيذ أمرك: اكتب "احفظ" للحفظ الفوري أو "هنكمل" للاستمرار.`;

    return {
      handled: true,
      reply,
      inTrainingMode: true,
    };
  }

  // 7. General Instruction during Training Session:
  // Accumulate in buffer and confirm receipt politely
  session.buffer.push(trimmed);

  const reply =
    agentType === 'shamousa'
      ? `استوعبت النقطة دي وسجلتها معايا في جلسة التدريب يا باشمهندس حسام 🌞.\nتقدر تكمل شرحك، ولما تخلص اكتب لي: "فهمت ؟!" عشان ألخصها لك في صيغة قواعد برمجية صلبة.`
      : `تمام يا باشمهندس حسام، تم استيعاب هذه الجزئية الفنية وإضافتها لمحور الجلسة 🦅.\nاتفضل كمل باقي الشرح أو المعادلات، ولما تكتفي اكتب: "فهمت ؟!" لعرض الصياغة الهندسية الكاملة الجاهزة للحفظ.`;

  return {
    handled: true,
    reply,
    inTrainingMode: true,
  };
}
