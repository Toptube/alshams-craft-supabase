// 4. "شموسة" — مساعدة البيانات (تبحث في خامات ومنتجات ورشة المستخدم فقط)
// قاعدة البيانات الوحيدة في المشروع هي Supabase، وبناءً عليه تُستخدم بيانات ورشة المستخدم فقط.
// ترتيب المزودات الرسمي: Groq أولاً، ثم Gemini كاحتياطي، ثم handoff إلى صقر عند انتهاء الحد أو الحاجة إلى استشارات خارج بيانات الورشة.
// لا يسمح بإدخال مزود قاعدة بيانات بديل أو ربط متوازي مع أي نظام آخر.
const SHAMOUSA_DAILY_LIMIT = Number(process.env.SHAMOUSA_DAILY_LIMIT) || 50;
const shamousaUsage = new Map<string, { date: string; count: number }>();
function bumpShamousaUsage(workshopId: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().split('T')[0];
  const rec = shamousaUsage.get(workshopId);
  if (!rec || rec.date !== today) {
    shamousaUsage.set(workshopId, { date: today, count: 1 });
    return { allowed: true, remaining: SHAMOUSA_DAILY_LIMIT - 1 };
  }
  if (rec.count >= SHAMOUSA_DAILY_LIMIT) return { allowed: false, remaining: 0 };
  rec.count += 1;
  return { allowed: true, remaining: SHAMOUSA_DAILY_LIMIT - rec.count };
}
