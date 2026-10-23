import { supabase } from '../lib/supabase';
import { UserProfile, Gender, getDefaultFamilyNickname } from '../types';

export interface SupabaseErrorResult {
  code: string;
  message: string;
  arabicMessage: string;
  details?: any;
}

/**
 * Converts a string from camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Converts a string from snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * Converts object keys from camelCase to snake_case
 */
export function keysToSnake<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => keysToSnake(item)) as any;
  }
  if (typeof obj === 'object' && obj.constructor === Object) {
    const newObj: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      newObj[camelToSnake(key)] = keysToSnake(obj[key]);
    }
    return newObj as T;
  }
  return obj;
}

/**
 * Converts object keys from snake_case to camelCase
 */
export function keysToCamel<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => keysToCamel(item)) as any;
  }
  if (typeof obj === 'object' && obj.constructor === Object) {
    const newObj: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      newObj[snakeToCamel(key)] = keysToCamel(obj[key]);
    }
    return newObj as T;
  }
  return obj;
}

/**
 * Translates Supabase / Postgres errors into accurate, clear Arabic messages with error code
 */
export function getArabicSupabaseError(error: any): SupabaseErrorResult {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      arabicMessage: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    };
  }

  const rawMessage: string = error.message || error.error_description || String(error);
  const code: string = String(error.code || error.status || 'ERROR');
  const lowerMsg = rawMessage.toLowerCase();

  let arabicMessage = '';

  // Auth / JWT / 401 / 42501 (Permission denied / RLS failure due to expired or missing token)
  if (
    code === '401' ||
    code === '42501' ||
    code === 'PGRST301' ||
    code === 'NO_SESSION' ||
    lowerMsg.includes('jwt') ||
    lowerMsg.includes('token') ||
    lowerMsg.includes('expired') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('permission denied')
  ) {
    arabicMessage = 'انتهت جلسة الدخول، سجّل الدخول من جديد';
  } else if (
    lowerMsg.includes('already registered') ||
    lowerMsg.includes('user_already_exists') ||
    code === '23505'
  ) {
    arabicMessage = 'هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول بدلاً من فتح ورشة جديدة.';
  } else if (
    lowerMsg.includes('invalid login credentials') ||
    lowerMsg.includes('invalid_credentials') ||
    lowerMsg.includes('invalid email or password')
  ) {
    arabicMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات والمحاولة مجدداً.';
  } else if (
    lowerMsg.includes('password should be at least') ||
    lowerMsg.includes('weak_password') ||
    lowerMsg.includes('password is too short')
  ) {
    arabicMessage = 'كلمة المرور قصيرة جداً؛ يجب ألا تقل عن 6 أحرف أو أرقام.';
  } else if (
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('over_request_rate_limit') ||
    lowerMsg.includes('over_email_send_rate_limit') ||
    lowerMsg.includes('too many requests') ||
    code === '429'
  ) {
    arabicMessage = 'تم تجاوز عدد المحاولات المسموح بها مؤقتاً، يرجى الانتظار دقيقة ثم المحاولة مجدداً.';
  } else if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('connection refused')
  ) {
    arabicMessage = 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.';
  } else if (lowerMsg.includes('user not found') || lowerMsg.includes('email not found')) {
    arabicMessage = 'لم يتم العثور على حساب بهذا البريد الإلكتروني. يرجى التحقق من البريد أو فتح ورشة جديدة.';
  } else if (lowerMsg.includes('suspended') || lowerMsg.includes('inactive')) {
    arabicMessage = 'حسابك موقوف مؤقتاً، تواصل مع الدعم.';
  } else {
    arabicMessage = `خطأ (${code}): ${rawMessage}`;
  }

  // Append error code if helpful and not already present
  if (code && code !== 'ERROR' && code !== 'UNKNOWN_ERROR' && !arabicMessage.includes(code)) {
    arabicMessage = `${arabicMessage} (كود: ${code})`;
  }

  return {
    code,
    message: rawMessage,
    arabicMessage,
    details: error,
  };
}

// -------------------------------------------------------------
// Generic CRUD operations: direct queries without getActiveSession() overhead
// -------------------------------------------------------------

export interface QueryOptions {
  columns?: string;
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
}

/**
 * Generic SELECT executed directly via Supabase client
 */
export async function supabaseSelect<T = any>(
  table: string,
  options: QueryOptions = {}
): Promise<{ data: T[]; error: SupabaseErrorResult | null }> {
  try {
    let query = supabase.from(table).select(options.columns || '*');

    if (options.filters) {
      for (const [key, val] of Object.entries(options.filters)) {
        const snakeKey = camelToSnake(key);
        query = query.eq(snakeKey, val);
      }
    }

    if (options.orderBy) {
      query = query.order(camelToSnake(options.orderBy.column), {
        ascending: options.orderBy.ascending !== false,
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: getArabicSupabaseError(error) };
    }

    const camelData = data ? keysToCamel<T[]>(data) : [];
    return { data: camelData, error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

/**
 * Generic INSERT executed directly via Supabase client
 */
export async function supabaseInsert<T = any>(
  table: string,
  record: any
): Promise<{ data: T | null; error: SupabaseErrorResult | null }> {
  try {
    const snakeRecord = keysToSnake(record);
    const { data, error } = await supabase.from(table).insert(snakeRecord).select().single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: keysToCamel<T>(data), error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

/**
 * Generic UPDATE executed directly via Supabase client
 */
export async function supabaseUpdate<T = any>(
  table: string,
  match: Record<string, any>,
  updates: any
): Promise<{ data: T | null; error: SupabaseErrorResult | null }> {
  try {
    const snakeUpdates = keysToSnake(updates);
    let query = supabase.from(table).update(snakeUpdates);

    for (const [key, val] of Object.entries(match)) {
      query = query.eq(camelToSnake(key), val);
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data ? keysToCamel<T>(data) : null, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

/**
 * Generic REMOVE executed directly via Supabase client
 */
export async function supabaseRemove(
  table: string,
  match: Record<string, any>
): Promise<{ success: boolean; error: SupabaseErrorResult | null }> {
  try {
    let query = supabase.from(table).delete();

    for (const [key, val] of Object.entries(match)) {
      query = query.eq(camelToSnake(key), val);
    }

    const { error } = await query;

    if (error) {
      return { success: false, error: getArabicSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: getArabicSupabaseError(err) };
  }
}

// -------------------------------------------------------------
// Workshops-specific domain operations
// -------------------------------------------------------------

export interface RawSupabaseWorkshop {
  id: string;
  user_id?: string;
  owner_id?: string;
  brand_name: string;
  artist_name: string;
  gender: 'male' | 'female';
  family_name?: string;
  country?: string;
  currency?: string;
  phone?: string;
  selected_crafts?: string[];
  settings?: any;
  logo_data?: string;
  welcome_shown?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
  email?: string;
  role?: string;
}

/**
 * Maps a row from `workshops` table to the app's `UserProfile`
 */
export function mapWorkshopRowToUserProfile(row: any, userEmail?: string): UserProfile {
  const gdr: Gender = row.gender === 'male' ? 'male' : 'female';
  const artist = row.artist_name || 'فنان';
  const family = row.family_name || getDefaultFamilyNickname(artist, gdr);
  const brand = row.brand_name || 'ورشة الشمس';

  return {
    id: row.id,
    workshopId: row.id,
    tenantId: row.id,
    ownerUid: row.user_id || row.owner_id || row.id,
    email: userEmail || row.email || '',
    brandName: brand,
    artistName: artist,
    gender: gdr,
    familyNickname: family,
    country: row.country || 'جمهورية مصر العربية',
    currency: row.currency || 'EGP',
    currencySymbol: row.currency === 'EGP' ? 'ج.م' : row.currency || 'ج.م',
    phoneNumber: row.phone || '',
    selectedCrafts: Array.isArray(row.selected_crafts) && row.selected_crafts.length > 0
      ? row.selected_crafts
      : ['macrame'],
    defaultVatPercent: 14,
    showTaxInfoOnInvoice: false,
    logoBase64: row.logo_data || '',
    logoUrl: row.logo_data || '',
    welcomeShown: Boolean(row.welcome_shown),
    role: row.role || 'artisan',
    isFrozen: row.status === 'suspended',
    frozenReason: row.status === 'suspended' ? 'حسابك موقوف مؤقتاً، تواصل مع الدعم' : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    createdBy: userEmail || row.email || '',
    socials: row.settings?.socials || undefined,
    defaultWholesaleDiscountPercent: row.settings?.defaultWholesaleDiscountPercent ?? 25,
    enableDailySalesReminder: row.settings?.enableDailySalesReminder ?? true,
    dailySalesReminderMode: row.settings?.dailySalesReminderMode ?? 'closing_offset',
    dailySalesReminderTime: row.settings?.dailySalesReminderTime ?? '20:00',
    workshopClosingHour: row.settings?.workshopClosingHour ?? '21:00',
  };
}

/**
 * Fetches current user's workshop row directly from Supabase (Supabase client automatically attaches user JWT)
 */
export async function getCurrentWorkshopFromSupabase(): Promise<{
  workshop: UserProfile | null;
  rawRow: RawSupabaseWorkshop | null;
  error: SupabaseErrorResult | null;
}> {
  try {
    console.log('[SupabaseService] Querying workshops table directly...');
    const { data, error } = await supabase
      .from('workshops')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseService] Error querying workshops:', error);
      return { workshop: null, rawRow: null, error: getArabicSupabaseError(error) };
    }

    if (!data) {
      console.log('[SupabaseService] No workshop row found for user');
      return { workshop: null, rawRow: null, error: null };
    }

    console.log('[SupabaseService] Workshop row fetched successfully:', data.brand_name || data.id);
    const userProfile = mapWorkshopRowToUserProfile(data, data.email);
    return { workshop: userProfile, rawRow: data, error: null };
  } catch (err: any) {
    console.error('[SupabaseService] Exception in getCurrentWorkshopFromSupabase:', err);
    return { workshop: null, rawRow: null, error: getArabicSupabaseError(err) };
  }
}

/**
 * Calls supabase.rpc('create_my_workshop', { p_brand, p_artist, p_gender, p_country, p_currency, p_phone }) directly
 */
export async function createMyWorkshopRpc(params: {
  brand: string;
  artist: string;
  gender: 'male' | 'female';
  country: string;
  currency: string;
  phone: string;
}): Promise<{ workshop: UserProfile | null; error: SupabaseErrorResult | null }> {
  try {
    const rpcParams = {
      p_brand: params.brand.trim(),
      p_artist: params.artist.trim(),
      p_gender: params.gender === 'male' ? 'male' : 'female',
      p_country: params.country.trim(),
      p_currency: params.currency.trim(),
      p_phone: params.phone.trim(),
    };

    console.log('[SupabaseService] Calling create_my_workshop RPC...');
    const { error } = await supabase.rpc('create_my_workshop', rpcParams);

    if (error) {
      console.error('[SupabaseService] create_my_workshop RPC error:', error);
      return { workshop: null, error: getArabicSupabaseError(error) };
    }

    // Now re-fetch current workshop row to get complete data
    const current = await getCurrentWorkshopFromSupabase();
    if (current.error) {
      return { workshop: null, error: current.error };
    }

    return { workshop: current.workshop, error: null };
  } catch (err: any) {
    return { workshop: null, error: getArabicSupabaseError(err) };
  }
}

/**
 * Updates workshop in Supabase table `workshops` directly.
 */
export async function updateWorkshopProfileInSupabase(
  workshopId: string,
  fields: {
    brandName?: string;
    artistName?: string;
    gender?: 'male' | 'female';
    familyName?: string;
    country?: string;
    currency?: string;
    phone?: string;
    selectedCrafts?: string[];
    settings?: any;
    logoData?: string;
    welcomeShown?: boolean;
  }
): Promise<{ updated: UserProfile | null; error: SupabaseErrorResult | null }> {
  try {
    const payload: Record<string, any> = {};

    if (fields.brandName !== undefined) payload.brand_name = fields.brandName.trim();
    if (fields.artistName !== undefined) payload.artist_name = fields.artistName.trim();
    if (fields.gender !== undefined) payload.gender = fields.gender;
    if (fields.familyName !== undefined) payload.family_name = fields.familyName.trim();
    if (fields.country !== undefined) payload.country = fields.country.trim();
    if (fields.currency !== undefined) payload.currency = fields.currency.trim();
    if (fields.phone !== undefined) payload.phone = fields.phone.trim();
    if (fields.selectedCrafts !== undefined) payload.selected_crafts = fields.selectedCrafts;
    if (fields.settings !== undefined) payload.settings = fields.settings;
    if (fields.logoData !== undefined) payload.logo_data = fields.logoData;
    if (fields.welcomeShown !== undefined) payload.welcome_shown = fields.welcomeShown;

    const { data, error } = await supabase
      .from('workshops')
      .update(payload)
      .eq('id', workshopId)
      .select()
      .maybeSingle();

    if (error) {
      return { updated: null, error: getArabicSupabaseError(error) };
    }

    const updatedProfile = mapWorkshopRowToUserProfile(data, data?.email);
    return { updated: updatedProfile, error: null };
  } catch (err: any) {
    return { updated: null, error: getArabicSupabaseError(err) };
  }
}
