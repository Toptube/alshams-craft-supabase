import { supabase } from './supabase';

/**
 * دالة استدعاء مشتركة للمسارات الخلفية /api/*
 * تُضيف ترويسة Authorization: Bearer <session.access_token> تلقائياً
 * عند الرد 401، تجدد الجلسة بـ supabase.auth.refreshSession() وتعيد المحاولة لمرة واحدة فقط
 * إذا لم يكن هناك مستخدم مسجل ترفض الطلب برسالة "سجّل دخولك الأول"
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('سجّل دخولك الأول');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(input, {
    ...init,
    headers,
  });

  // إذا كانت الاستجابة 401، نجدد الجلسة ونعيد المحاولة لمرة واحدة فقط
  if (response.status === 401) {
    try {
      console.log('[authedFetch] Received 401. Refreshing Supabase session...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData?.session?.access_token) {
        token = refreshData.session.access_token;
        const retryHeaders = new Headers(init.headers || {});
        retryHeaders.set('Authorization', `Bearer ${token}`);
        response = await fetch(input, {
          ...init,
          headers: retryHeaders,
        });
      } else {
        console.warn('[authedFetch] Session refresh failed on 401:', refreshError?.message);
      }
    } catch (refreshErr) {
      console.error('[authedFetch] Error attempting session refresh on 401:', refreshErr);
    }
  }

  return response;
}
