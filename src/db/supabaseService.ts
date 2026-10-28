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
    code === '23503' ||
    lowerMsg.includes('foreign key') ||
    lowerMsg.includes('violates foreign key constraint')
  ) {
    arabicMessage = 'لا يمكن حذفه لأنه مرتبط ببيانات أخرى';
  } else if (
    lowerMsg.includes('already registered') ||
    lowerMsg.includes('user_already_exists')
  ) {
    arabicMessage = 'هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول بدلاً من فتح ورشة جديدة.';
  } else if (code === 'P0001') {
    arabicMessage = rawMessage;
  } else if (
    code === '23505' ||
    lowerMsg.includes('unique constraint') ||
    lowerMsg.includes('duplicate key')
  ) {
    arabicMessage = 'هذا الاسم مستخدم بالفعل';
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
 * Quick check if there is an active session
 */
export async function hasActiveSupabaseSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data?.session?.user;
  } catch {
    return false;
  }
}

/**
 * Retrieves valid cached profile from localStorage if present
 */
export function getLocalCachedProfile(): UserProfile | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('alshams_profile');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.id &&
      parsed.id !== 'workshop_demo' &&
      parsed.workshopId !== 'workshop_demo' &&
      parsed.id !== '00000000-0000-0000-0000-000000000000'
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fetches current user's workshop row directly from Supabase (Supabase client automatically attaches user JWT)
 * Resilient against network drops and 42501 race conditions with automatic offline-first fallback.
 */
export async function getCurrentWorkshopFromSupabase(): Promise<{
  workshop: UserProfile | null;
  rawRow: RawSupabaseWorkshop | null;
  error: SupabaseErrorResult | null;
  isOfflineFallback?: boolean;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      const cached = getLocalCachedProfile();
      if (cached) {
        return { workshop: cached, rawRow: null, error: null, isOfflineFallback: true };
      }
      return { workshop: null, rawRow: null, error: null };
    }

    console.log('[SupabaseService] Querying workshops table for user:', user.id);
    let { data, error } = await supabase
      .from('workshops')
      .select('*')
      .limit(1)
      .maybeSingle();

    // If initial query returned 42501 (Permission Denied) due to token settling delay, retry once after 250ms
    if (error && (error.code === '42501' || error.message?.includes('permission denied'))) {
      console.warn('[SupabaseService] 42501 permission notice on first try, retrying after session settling...');
      await new Promise((res) => setTimeout(res, 250));
      const retry = await supabase.from('workshops').select('*').limit(1).maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('[SupabaseService] Error querying workshops:', error);
      const cached = getLocalCachedProfile();
      if (cached) {
        console.log('[SupabaseService] Falling back to offline-first cached profile');
        return { workshop: cached, rawRow: null, error: null, isOfflineFallback: true };
      }
      return { workshop: null, rawRow: null, error: getArabicSupabaseError(error) };
    }

    if (!data) {
      console.log('[SupabaseService] No workshop row found for user');
      const cached = getLocalCachedProfile();
      if (cached) {
        return { workshop: cached, rawRow: null, error: null, isOfflineFallback: true };
      }
      return { workshop: null, rawRow: null, error: null };
    }

    console.log('[SupabaseService] Workshop row fetched successfully:', data.brand_name || data.id);
    const userProfile = mapWorkshopRowToUserProfile(data, data.email || user.email);
    return { workshop: userProfile, rawRow: data, error: null };
  } catch (err: any) {
    console.warn('[SupabaseService] Exception in getCurrentWorkshopFromSupabase:', err);
    const cached = getLocalCachedProfile();
    if (cached) {
      return { workshop: cached, rawRow: null, error: null, isOfflineFallback: true };
    }
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

// -------------------------------------------------------------
// Units (وحدات القياس) Domain Operations
// Table: units(id, workshop_id, name, small_unit, factor>0)
// -------------------------------------------------------------

export interface SupabaseUnit {
  id: string;
  workshop_id: string;
  name: string;
  small_unit: string;
  factor: number;
}

export async function getUnitsFromSupabase(
  workshopId: string
): Promise<{ data: SupabaseUnit[]; error: SupabaseErrorResult | null; isOfflineFallback?: boolean }> {
  try {
    if (!workshopId || workshopId === 'workshop_demo' || workshopId === '00000000-0000-0000-0000-000000000000') {
      return { data: [], error: null, isOfflineFallback: true };
    }
    const hasSession = await hasActiveSupabaseSession();
    if (!hasSession) {
      return { data: [], error: null, isOfflineFallback: true };
    }
    const { data, error } = await supabase
      .from('units')
      .select('id, workshop_id, name, small_unit, factor')
      .eq('workshop_id', workshopId)
      .order('name', { ascending: true });

    if (error) {
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        console.warn('[SupabaseService] units query 42501 notice; offline-first active.');
        return { data: [], error: null, isOfflineFallback: true };
      }
      return { data: [], error: getArabicSupabaseError(error) };
    }

    return { data: (data as SupabaseUnit[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function createUnitInSupabase(
  workshopId: string,
  payload: { name: string; small_unit: string; factor: number; id?: string }
): Promise<{ data: SupabaseUnit | null; error: SupabaseErrorResult | null }> {
  try {
    const row: any = {
      workshop_id: workshopId,
      name: payload.name.trim(),
      small_unit: payload.small_unit.trim(),
      factor: Number(payload.factor) > 0 ? Number(payload.factor) : 1,
    };
    if (payload.id) {
      row.id = payload.id;
    }

    const { data, error } = await supabase
      .from('units')
      .insert(row)
      .select('id, workshop_id, name, small_unit, factor')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseUnit, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function updateUnitInSupabase(
  unitId: string,
  workshopId: string,
  payload: { name?: string; small_unit?: string; factor?: number }
): Promise<{ data: SupabaseUnit | null; error: SupabaseErrorResult | null }> {
  try {
    const updates: any = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.small_unit !== undefined) updates.small_unit = payload.small_unit.trim();
    if (payload.factor !== undefined) updates.factor = Number(payload.factor) > 0 ? Number(payload.factor) : 1;

    const { data, error } = await supabase
      .from('units')
      .update(updates)
      .eq('id', unitId)
      .eq('workshop_id', workshopId)
      .select('id, workshop_id, name, small_unit, factor')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseUnit, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function deleteUnitFromSupabase(
  unitId: string,
  workshopId: string
): Promise<{ success: boolean; error: SupabaseErrorResult | null }> {
  try {
    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', unitId)
      .eq('workshop_id', workshopId);

    if (error) {
      return { success: false, error: getArabicSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: getArabicSupabaseError(err) };
  }
}

/**
 * إنشاء الوحدات الافتراضية للورشة إذا كانت فارغة
 */
export async function ensureDefaultUnitsInSupabase(
  workshopId: string
): Promise<SupabaseUnit[]> {
  try {
    const existing = await getUnitsFromSupabase(workshopId);
    if (!existing.error && existing.data.length > 0) {
      return existing.data;
    }

    const defaultUnits = [
      { workshop_id: workshopId, name: 'كيلو', small_unit: 'جرام', factor: 1000 },
      { workshop_id: workshopId, name: 'متر', small_unit: 'سم', factor: 100 },
      { workshop_id: workshopId, name: 'قطعة', small_unit: 'قطعة', factor: 1 },
      { workshop_id: workshopId, name: 'لفة', small_unit: 'متر', factor: 100 },
      { workshop_id: workshopId, name: 'دستة', small_unit: 'قطعة', factor: 12 },
      { workshop_id: workshopId, name: 'لتر', small_unit: 'مل', factor: 1000 },
    ];

    const { data, error } = await supabase
      .from('units')
      .insert(defaultUnits)
      .select('id, workshop_id, name, small_unit, factor');

    if (!error && data) {
      return data as SupabaseUnit[];
    }
    return existing.data || [];
  } catch (err) {
    console.error('Error ensuring default units:', err);
    return [];
  }
}

// -------------------------------------------------------------
// Suppliers (الموردين) Domain Operations
// Table: suppliers(id, workshop_id, name, phone, address, notes)
// -------------------------------------------------------------

export interface SupabaseSupplier {
  id: string;
  workshop_id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function getSuppliersFromSupabase(
  workshopId: string
): Promise<{ data: SupabaseSupplier[]; error: SupabaseErrorResult | null; isOfflineFallback?: boolean }> {
  try {
    if (!workshopId || workshopId === 'workshop_demo' || workshopId === '00000000-0000-0000-0000-000000000000') {
      return { data: [], error: null, isOfflineFallback: true };
    }
    const hasSession = await hasActiveSupabaseSession();
    if (!hasSession) {
      return { data: [], error: null, isOfflineFallback: true };
    }
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, workshop_id, name, phone, address, notes')
      .eq('workshop_id', workshopId)
      .order('name', { ascending: true });

    if (error) {
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        console.warn('[SupabaseService] suppliers query 42501 notice; offline-first active.');
        return { data: [], error: null, isOfflineFallback: true };
      }
      return { data: [], error: getArabicSupabaseError(error) };
    }

    return { data: (data as SupabaseSupplier[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function createSupplierInSupabase(
  workshopId: string,
  payload: { name: string; phone?: string; address?: string; notes?: string; id?: string }
): Promise<{ data: SupabaseSupplier | null; error: SupabaseErrorResult | null }> {
  try {
    const row: any = {
      workshop_id: workshopId,
      name: payload.name.trim(),
      phone: payload.phone ? payload.phone.trim() : null,
      address: payload.address ? payload.address.trim() : null,
      notes: payload.notes ? payload.notes.trim() : null,
    };
    if (payload.id) {
      row.id = payload.id;
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert(row)
      .select('id, workshop_id, name, phone, address, notes')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseSupplier, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function updateSupplierInSupabase(
  id: string,
  workshopId: string,
  payload: { name?: string; phone?: string; address?: string; notes?: string }
): Promise<{ data: SupabaseSupplier | null; error: SupabaseErrorResult | null }> {
  try {
    const updates: any = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.phone !== undefined) updates.phone = payload.phone.trim() || null;
    if (payload.address !== undefined) updates.address = payload.address.trim() || null;
    if (payload.notes !== undefined) updates.notes = payload.notes.trim() || null;

    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .eq('workshop_id', workshopId)
      .select('id, workshop_id, name, phone, address, notes')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseSupplier, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function deleteSupplierInSupabase(
  id: string,
  workshopId: string
): Promise<{ success: boolean; error: SupabaseErrorResult | null }> {
  try {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('workshop_id', workshopId);

    if (error) {
      return { success: false, error: getArabicSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: getArabicSupabaseError(err) };
  }
}

// -------------------------------------------------------------
// Customers (العملاء) Domain Operations
// Table: customers(id, workshop_id, name, phone, address, notes)
// -------------------------------------------------------------

export interface SupabaseCustomer {
  id: string;
  workshop_id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export async function getCustomersFromSupabase(
  workshopId: string
): Promise<{ data: SupabaseCustomer[]; error: SupabaseErrorResult | null; isOfflineFallback?: boolean }> {
  try {
    if (!workshopId || workshopId === 'workshop_demo' || workshopId === '00000000-0000-0000-0000-000000000000') {
      return { data: [], error: null, isOfflineFallback: true };
    }
    const hasSession = await hasActiveSupabaseSession();
    if (!hasSession) {
      return { data: [], error: null, isOfflineFallback: true };
    }
    const { data, error } = await supabase
      .from('customers')
      .select('id, workshop_id, name, phone, address, notes')
      .eq('workshop_id', workshopId)
      .order('name', { ascending: true });

    if (error) {
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        console.warn('[SupabaseService] customers query 42501 notice; offline-first active.');
        return { data: [], error: null, isOfflineFallback: true };
      }
      return { data: [], error: getArabicSupabaseError(error) };
    }

    return { data: (data as SupabaseCustomer[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function createCustomerInSupabase(
  workshopId: string,
  payload: { name: string; phone?: string; address?: string; notes?: string; id?: string }
): Promise<{ data: SupabaseCustomer | null; error: SupabaseErrorResult | null }> {
  try {
    const row: any = {
      workshop_id: workshopId,
      name: payload.name.trim(),
      phone: payload.phone ? payload.phone.trim() : null,
      address: payload.address ? payload.address.trim() : null,
      notes: payload.notes ? payload.notes.trim() : null,
    };
    if (payload.id) {
      row.id = payload.id;
    }

    const { data, error } = await supabase
      .from('customers')
      .insert(row)
      .select('id, workshop_id, name, phone, address, notes')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseCustomer, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function updateCustomerInSupabase(
  id: string,
  workshopId: string,
  payload: { name?: string; phone?: string; address?: string; notes?: string }
): Promise<{ data: SupabaseCustomer | null; error: SupabaseErrorResult | null }> {
  try {
    const updates: any = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.phone !== undefined) updates.phone = payload.phone.trim() || null;
    if (payload.address !== undefined) updates.address = payload.address.trim() || null;
    if (payload.notes !== undefined) updates.notes = payload.notes.trim() || null;

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('workshop_id', workshopId)
      .select('id, workshop_id, name, phone, address, notes')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseCustomer, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function deleteCustomerInSupabase(
  id: string,
  workshopId: string
): Promise<{ success: boolean; error: SupabaseErrorResult | null }> {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('workshop_id', workshopId);

    if (error) {
      return { success: false, error: getArabicSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: getArabicSupabaseError(err) };
  }
}

// -------------------------------------------------------------
// Materials (الخامات) Domain Operations
// Table: materials(id, workshop_id, name, kind:'primary'|'extra', supplier_id, unit_id, purchase_price>=0, market_name, market_unit_factor>0)
// -------------------------------------------------------------

export interface SupabaseMaterial {
  id: string;
  workshop_id: string;
  name: string;
  kind: 'primary' | 'extra';
  supplier_id: string | null;
  unit_id: string;
  purchase_price: number;
  market_name: string | null;
  market_unit_factor: number;
}

export async function getMaterialsFromSupabase(
  workshopId: string
): Promise<{ data: SupabaseMaterial[]; error: SupabaseErrorResult | null }> {
  try {
    // نلتزم بقراءة الأعمدة المحددة فقط دون أي أعمدة صور Base64
    const { data, error } = await supabase
      .from('materials')
      .select('id, workshop_id, name, kind, supplier_id, unit_id, purchase_price, market_name, market_unit_factor')
      .eq('workshop_id', workshopId)
      .order('name', { ascending: true });

    if (error) {
      return { data: [], error: getArabicSupabaseError(error) };
    }

    return { data: (data as SupabaseMaterial[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function createMaterialInSupabase(
  workshopId: string,
  payload: {
    name: string;
    kind: 'primary' | 'extra';
    supplier_id?: string | null;
    unit_id: string;
    purchase_price: number;
    market_name?: string | null;
    market_unit_factor?: number;
    id?: string;
  }
): Promise<{ data: SupabaseMaterial | null; error: SupabaseErrorResult | null }> {
  try {
    const row: any = {
      workshop_id: workshopId,
      name: payload.name.trim(),
      kind: payload.kind === 'extra' ? 'extra' : 'primary',
      supplier_id: payload.supplier_id || null,
      unit_id: payload.unit_id,
      purchase_price: Number(payload.purchase_price) >= 0 ? Number(payload.purchase_price) : 0,
      market_name: payload.market_name ? payload.market_name.trim() : null,
      market_unit_factor: Number(payload.market_unit_factor) > 0 ? Number(payload.market_unit_factor) : 1,
    };
    if (payload.id) {
      row.id = payload.id;
    }

    const { data, error } = await supabase
      .from('materials')
      .insert(row)
      .select('id, workshop_id, name, kind, supplier_id, unit_id, purchase_price, market_name, market_unit_factor')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseMaterial, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function updateMaterialInSupabase(
  materialId: string,
  workshopId: string,
  payload: {
    name?: string;
    kind?: 'primary' | 'extra';
    supplier_id?: string | null;
    unit_id?: string;
    purchase_price?: number;
    market_name?: string | null;
    market_unit_factor?: number;
  }
): Promise<{ data: SupabaseMaterial | null; error: SupabaseErrorResult | null }> {
  try {
    const updates: any = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.kind !== undefined) updates.kind = payload.kind === 'extra' ? 'extra' : 'primary';
    if (payload.supplier_id !== undefined) updates.supplier_id = payload.supplier_id || null;
    if (payload.unit_id !== undefined) updates.unit_id = payload.unit_id;
    if (payload.purchase_price !== undefined) {
      updates.purchase_price = Number(payload.purchase_price) >= 0 ? Number(payload.purchase_price) : 0;
    }
    if (payload.market_name !== undefined) {
      updates.market_name = payload.market_name ? payload.market_name.trim() : null;
    }
    if (payload.market_unit_factor !== undefined) {
      updates.market_unit_factor = Number(payload.market_unit_factor) > 0 ? Number(payload.market_unit_factor) : 1;
    }

    const { data, error } = await supabase
      .from('materials')
      .update(updates)
      .eq('id', materialId)
      .eq('workshop_id', workshopId)
      .select('id, workshop_id, name, kind, supplier_id, unit_id, purchase_price, market_name, market_unit_factor')
      .single();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }

    return { data: data as SupabaseMaterial, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function deleteMaterialFromSupabase(
  materialId: string,
  workshopId: string
): Promise<{ success: boolean; error: SupabaseErrorResult | null }> {
  try {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId)
      .eq('workshop_id', workshopId);

    if (error) {
      return { success: false, error: getArabicSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: getArabicSupabaseError(err) };
  }
}

export const DEFAULT_WORKSHOP_MATERIALS: Array<{
  name: string;
  kind: 'primary';
  purchase_price: number;
  market_name: string;
  market_unit_factor: number;
}> = [
  { name: 'قطن مجدول', kind: 'primary', purchase_price: 180, market_name: 'شلة', market_unit_factor: 200 },
  { name: 'قطن محلول', kind: 'primary', purchase_price: 160, market_name: 'شلة', market_unit_factor: 200 },
  { name: 'مصري بوليستر', kind: 'primary', purchase_price: 140, market_name: 'بكرة', market_unit_factor: 250 },
  { name: 'خيش', kind: 'primary', purchase_price: 140, market_name: 'شلة', market_unit_factor: 200 },
  { name: 'كردون فاضي', kind: 'primary', purchase_price: 175, market_name: 'لفة', market_unit_factor: 500 },
  { name: 'كردون مبطن', kind: 'primary', purchase_price: 190, market_name: 'لفة', market_unit_factor: 500 },
  { name: 'كردون أمريكي', kind: 'primary', purchase_price: 200, market_name: 'لفة', market_unit_factor: 500 },
  { name: 'كليم', kind: 'primary', purchase_price: 130, market_name: 'بكرة', market_unit_factor: 500 },
];

export async function ensureDefaultMaterialsInSupabase(
  workshopId: string
): Promise<SupabaseMaterial[]> {
  try {
    const [existingRes, units] = await Promise.all([
      getMaterialsFromSupabase(workshopId),
      ensureDefaultUnitsInSupabase(workshopId),
    ]);

    let currentMaterials = existingRes.data || [];
    const kgUnit = units.find((u) => u.name === 'كيلو') || units[0];
    if (!kgUnit) return currentMaterials;

    const existingNames = new Set(
      currentMaterials.map((m) => m.name.trim().toLowerCase().replace(/\s+/g, ''))
    );

    const missing = DEFAULT_WORKSHOP_MATERIALS.filter((def) => {
      const cleanDef = def.name.trim().toLowerCase().replace(/\s+/g, '');
      return !existingNames.has(cleanDef);
    });

    if (missing.length > 0) {
      for (const item of missing) {
        const res = await createMaterialInSupabase(workshopId, {
          name: item.name,
          kind: item.kind,
          unit_id: kgUnit.id,
          purchase_price: item.purchase_price,
          market_name: item.market_name,
          market_unit_factor: item.market_unit_factor,
        });
        if (res.data) {
          currentMaterials.push(res.data);
        }
      }
    }

    return currentMaterials;
  } catch (err) {
    console.warn('ensureDefaultMaterialsInSupabase error:', err);
    const existing = await getMaterialsFromSupabase(workshopId);
    return existing.data || [];
  }
}

// -------------------------------------------------------------
// Treasuries (الخزن والعهد) Domain Operations
// -------------------------------------------------------------

export type TreasuryKind = 'main' | 'sub' | 'custody';
export type TreasuryStatus = 'open' | 'settled';
export type PaymentChannel = 'cash' | 'wallet' | 'instapay';

export interface SupabaseTreasury {
  id: string;
  workshop_id: string;
  name: string;
  kind: TreasuryKind;
  parent_id?: string | null;
  holder_name?: string | null;
  status: TreasuryStatus;
  settled_at?: string | null;
  notes?: string | null;
  min_balance?: number;
}

export interface SupabaseTreasuryBalance {
  id: string;
  workshop_id: string;
  name: string;
  kind: TreasuryKind;
  parent_id?: string | null;
  holder_name?: string | null;
  status: TreasuryStatus;
  is_main: boolean;
  cash: number;
  wallet: number;
  instapay: number;
  bank?: number;
  balance: number;
  min_balance?: number;
}

export interface SupabaseTreasuryChannelBalance {
  workshop_id: string;
  treasury_id: string;
  channel: PaymentChannel | string;
  balance: number;
}

export interface SupabaseTreasuryTransaction {
  id: string;
  treasury_id: string;
  channel: PaymentChannel | string;
  kind: 'in' | 'out' | 'transfer_in' | 'transfer_out';
  amount: number;
  category?: string | null;
  category_name?: string | null;
  ref_type?: string | null;
  ref_id?: string | null;
  note?: string | null;
  occurred_at: string;
}

export interface SupabaseTreasuryCategory {
  id: string;
  workshop_id: string;
  category_name: string;
  type: 'in' | 'out';
  notes?: string | null;
  created_at?: string;
}

export async function getTreasuryBalancesFromSupabase(
  workshopId: string
): Promise<{ data: SupabaseTreasuryBalance[]; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase
      .from('treasury_balances')
      .select('*')
      .eq('workshop_id', workshopId);

    if (error) {
      return { data: [], error: getArabicSupabaseError(error) };
    }

    const balances: SupabaseTreasuryBalance[] = (data as SupabaseTreasuryBalance[]) || [];

    // Attempt to enrich with min_balance from treasuries table if column exists
    try {
      const { data: treasuriesData } = await supabase
        .from('treasuries')
        .select('id, min_balance')
        .eq('workshop_id', workshopId);

      if (treasuriesData && treasuriesData.length > 0) {
        const minMap = new Map<string, number>();
        treasuriesData.forEach((row: any) => {
          if (row.id && row.min_balance !== undefined && row.min_balance !== null) {
            minMap.set(row.id, Number(row.min_balance));
          }
        });

        balances.forEach((b) => {
          if (minMap.has(b.id)) {
            b.min_balance = minMap.get(b.id);
          }
        });
      }
    } catch (e) {
      // Column might not exist yet; gracefully ignore
    }

    return { data: balances, error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function getTreasuryChannelBalancesFromSupabase(
  workshopId: string
): Promise<{ data: SupabaseTreasuryChannelBalance[]; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase
      .from('treasury_channel_balances')
      .select('*')
      .eq('workshop_id', workshopId);

    if (error) {
      return { data: [], error: getArabicSupabaseError(error) };
    }
    return { data: (data as SupabaseTreasuryChannelBalance[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function getTreasuryTransactionsFromSupabase(
  treasuryId?: string,
  limit = 200
): Promise<{ data: SupabaseTreasuryTransaction[]; error: SupabaseErrorResult | null }> {
  try {
    let query = supabase
      .from('treasury_transactions')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (treasuryId) {
      query = query.eq('treasury_id', treasuryId);
    }

    const { data, error } = await query;
    if (error) {
      return { data: [], error: getArabicSupabaseError(error) };
    }
    return { data: (data as SupabaseTreasuryTransaction[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function updateTreasuryDetailsInSupabase(
  id: string,
  workshopId: string,
  updates: { name?: string; holder_name?: string; notes?: string; min_balance?: number }
): Promise<{ error: SupabaseErrorResult | null }> {
  try {
    const { error } = await supabase
      .from('treasuries')
      .update(updates)
      .eq('id', id)
      .eq('workshop_id', workshopId);

    if (error) {
      return { error: getArabicSupabaseError(error) };
    }
    return { error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

export async function updateTreasuryMinBalanceInSupabase(
  workshopId: string,
  treasuryId: string,
  minBalance: number
): Promise<{ error: SupabaseErrorResult | null }> {
  try {
    const { error } = await supabase
      .from('treasuries')
      .update({ min_balance: minBalance })
      .eq('id', treasuryId)
      .eq('workshop_id', workshopId);

    if (error) {
      return { error: getArabicSupabaseError(error) };
    }
    return { error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

export async function getTreasuryCategoriesFromSupabase(
  workshopId: string
): Promise<{ data: SupabaseTreasuryCategory[]; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase
      .from('treasury_categories')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: [], error: getArabicSupabaseError(error) };
    }
    return { data: (data as SupabaseTreasuryCategory[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: getArabicSupabaseError(err) };
  }
}

export async function createTreasuryCategoryInSupabase(
  workshopId: string,
  categoryName: string,
  type: 'in' | 'out',
  notes?: string
): Promise<{ data: SupabaseTreasuryCategory | null; error: SupabaseErrorResult | null }> {
  try {
    const payload = {
      workshop_id: workshopId,
      category_name: categoryName.trim(),
      type,
      notes: notes?.trim() || null,
    };
    const { data, error } = await supabase
      .from('treasury_categories')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      return { data: null, error: getArabicSupabaseError(error) };
    }
    return { data: data as SupabaseTreasuryCategory, error: null };
  } catch (err: any) {
    return { data: null, error: getArabicSupabaseError(err) };
  }
}

export async function deleteTreasuryCategoryInSupabase(
  workshopId: string,
  categoryId: string
): Promise<{ error: SupabaseErrorResult | null }> {
  try {
    const { error } = await supabase
      .from('treasury_categories')
      .delete()
      .eq('id', categoryId)
      .eq('workshop_id', workshopId);

    if (error) {
      return { error: getArabicSupabaseError(error) };
    }
    return { error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

// RPC 1: create_treasury({ p_workshop, p_name, p_parent })
export async function rpcCreateTreasury(
  workshopId: string,
  name: string,
  parentId?: string | null
): Promise<{ data?: any; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase.rpc('create_treasury', {
      p_workshop: workshopId,
      p_name: name.trim(),
      p_parent: parentId || null,
    });
    if (error) return { error: getArabicSupabaseError(error) };
    return { data, error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

// RPC 2: treasury_deposit({ p_workshop, p_treasury, p_channel, p_amount, p_category, p_note })
export async function rpcTreasuryDeposit(
  workshopId: string,
  treasuryId: string,
  channel: PaymentChannel,
  amount: number,
  category: string,
  note?: string
): Promise<{ data?: any; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase.rpc('treasury_deposit', {
      p_workshop: workshopId,
      p_treasury: treasuryId,
      p_channel: channel,
      p_amount: amount,
      p_category: category.trim(),
      p_note: note?.trim() || null,
    });
    if (error) return { error: getArabicSupabaseError(error) };
    return { data, error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

// RPC 3: treasury_transfer({ p_workshop, p_from, p_from_channel, p_to, p_to_channel, p_amount, p_category, p_note })
// where p_category is one of: 'تحويل بين الخزن' | 'عهدة' | 'رد عهدة'
export async function rpcTreasuryTransfer(
  workshopId: string,
  fromId: string,
  fromChannel: PaymentChannel,
  toId: string,
  toChannel: PaymentChannel,
  amount: number,
  category: 'تحويل بين الخزن' | 'عهدة' | 'رد عهدة',
  note?: string
): Promise<{ data?: any; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase.rpc('treasury_transfer', {
      p_workshop: workshopId,
      p_from: fromId,
      p_from_channel: fromChannel,
      p_to: toId,
      p_to_channel: toChannel,
      p_amount: amount,
      p_category: category,
      p_note: note?.trim() || null,
    });
    if (error) return { error: getArabicSupabaseError(error) };
    return { data, error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

// RPC 4: issue_custody({ p_workshop, p_source, p_channel, p_holder, p_name, p_amount, p_note }) -> returns custody ID
export async function rpcIssueCustody(
  workshopId: string,
  sourceId: string,
  channel: PaymentChannel,
  holder: string,
  name: string,
  amount: number,
  note?: string
): Promise<{ data?: string; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase.rpc('issue_custody', {
      p_workshop: workshopId,
      p_source: sourceId,
      p_channel: channel,
      p_holder: holder.trim(),
      p_name: name.trim() || `عهدة ${holder.trim()}`,
      p_amount: amount,
      p_note: note?.trim() || null,
    });
    if (error) return { error: getArabicSupabaseError(error) };
    return { data, error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

// RPC 5: custody_settle({ p_workshop, p_custody, p_return_to, p_note })
export async function rpcCustodySettle(
  workshopId: string,
  custodyId: string,
  returnToId: string,
  note?: string
): Promise<{ data?: any; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase.rpc('custody_settle', {
      p_workshop: workshopId,
      p_custody: custodyId,
      p_return_to: returnToId,
      p_note: note?.trim() || null,
    });
    if (error) return { error: getArabicSupabaseError(error) };
    return { data, error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

// RPC 6: delete_treasury({ p_workshop, p_id })
export async function rpcDeleteTreasury(
  workshopId: string,
  treasuryId: string
): Promise<{ data?: any; error: SupabaseErrorResult | null }> {
  try {
    const { data, error } = await supabase.rpc('delete_treasury', {
      p_workshop: workshopId,
      p_id: treasuryId,
    });
    if (error) return { error: getArabicSupabaseError(error) };
    return { data, error: null };
  } catch (err: any) {
    return { error: getArabicSupabaseError(err) };
  }
}

// -------------------------------------------------------------
// Treasury & Categories SQL Migrations for Supabase PostgreSQL
// Formatted to avoid parser errors (such as: Expected: end of statement, found: EXISTS)
// -------------------------------------------------------------

/**
 * Standard PostgreSQL queries executing ALTER TABLE statements separately
 * (Bypasses web parser bugs with 'ADD COLUMN IF NOT EXISTS')
 */
export const TREASURY_SETUP_SQL_SEPARATE = `-- 1. إضافة عمود الحد الأدنى للرصيد إلى جدول الخزن
ALTER TABLE treasuries ADD COLUMN min_balance NUMERIC(14, 2) DEFAULT 0;

-- 2. إضافة عمود اسم التصنيف إلى جدول حركات الخزينة
ALTER TABLE safe_transactions ADD COLUMN category_name TEXT;

-- 3. إنشاء جدول تصنيفات الخزينة
CREATE TABLE IF NOT EXISTS treasury_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. فهرس لتسريع استعلامات تصنيفات الورشة
CREATE INDEX IF NOT EXISTS idx_treasury_categories_workshop ON treasury_categories(workshop_id);
`;

/**
 * Idempotent PL/pgSQL block using information_schema checks
 * (100% safe to run multiple times without duplicate_column errors or syntax issues)
 */
export const TREASURY_SETUP_SQL_IDEMPOTENT = `DO $$ 
BEGIN 
  -- 1. إضافة عمود min_balance في حال عدم وجوده
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'treasuries' AND column_name = 'min_balance'
  ) THEN
    ALTER TABLE treasuries ADD COLUMN min_balance NUMERIC(14, 2) DEFAULT 0;
  END IF;

  -- 2. إضافة عمود category_name في حال عدم وجوده
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'safe_transactions' AND column_name = 'category_name'
  ) THEN
    ALTER TABLE safe_transactions ADD COLUMN category_name TEXT;
  END IF;
END $$;

-- 3. إنشاء جدول تصنيفات الخزينة
CREATE TABLE IF NOT EXISTS treasury_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. فهرس لتسريع استعلامات تصنيفات الورشة
CREATE INDEX IF NOT EXISTS idx_treasury_categories_workshop ON treasury_categories(workshop_id);
`;


