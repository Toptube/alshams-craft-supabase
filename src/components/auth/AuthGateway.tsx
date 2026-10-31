import React, { useState } from 'react';
import { AlShamsBrandLogo } from '../brand/BrandAssets';
import { WorkshopProfile, UserProfile, Gender, getDefaultFamilyNickname } from '../../types';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { supabase } from '../../lib/supabase';
import {
  getArabicSupabaseError,
  createMyWorkshopRpc,
  getCurrentWorkshopFromSupabase,
} from '../../db/supabaseService';
import { Login } from './Login';
import { Register } from './Register';
import {
  Lock,
  Mail,
  User,
  Building2,
  Phone,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
  ShieldCheck,
  Send,
  X,
  Clock,
} from 'lucide-react';

interface AuthGatewayProps {
  onAuthenticated: (profile: UserProfile) => void;
  onNeedsWorkshopDetails?: (email: string) => void;
  recoveryError?: string | null;
  onClearRecoveryError?: () => void;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({
  onAuthenticated,
  onNeedsWorkshopDetails,
  recoveryError,
  onClearRecoveryError,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [countryCode, setCountryCode] = useState('EG');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [forgotCountdown, setForgotCountdown] = useState<number>(0);

  // Sync recovery error if passed
  React.useEffect(() => {
    if (recoveryError) {
      setErrorMsg(recoveryError);
    }
  }, [recoveryError]);

  // Countdown timer for reset password button
  React.useEffect(() => {
    let timer: any = null;
    if (forgotCountdown > 0) {
      timer = setInterval(() => {
        setForgotCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [forgotCountdown]);

  const selectedCountry =
    COUNTRIES_CONFIG.find((c) => c.code === countryCode) || COUNTRIES_CONFIG[0];

  // 1. Email/Password Authentication (Supabase)
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('يرجى كتابة بريد إلكتروني صالح.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!brandName.trim()) {
          throw new Error('يرجى كتابة اسم البراند أو المشغل الخاص بك.');
        }
        if (!artistName.trim()) {
          throw new Error('يرجى كتابة اسمك (الفنان أو الفنانة).');
        }

        // 1) Supabase sign up
        console.log('[AuthGateway] Step 1: Submitting signUp for email:', cleanEmail);
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signUpError) {
          console.error('[AuthGateway] SignUp error:', signUpError);
          const errRes = getArabicSupabaseError(signUpError);
          setErrorMsg(errRes.arabicMessage);
          return;
        }

        // Retrieve active session from signUp response or via getSession()
        let activeSession: any = signUpData.session;
        if (!activeSession) {
          const { data: currentSessionData } = await supabase.auth.getSession();
          activeSession = currentSessionData?.session || null;
        }

        const hasSession = !!activeSession?.access_token;
        const userId = signUpData.user?.id || activeSession?.user?.id || 'غير متوفر';
        const tokenLength = activeSession?.access_token ? activeSession.access_token.length : 0;

        // Diagnostic log: وجود الجلسة ومعرّف المستخدم وطول access_token
        console.log(
          `[Auth Diagnostic - التسجيل] وجود الجلسة: ${hasSession ? 'نعم' : 'لا'} | معرّف المستخدم: ${userId} | طول access_token: ${tokenLength}`
        );

        // 2) If session is available, invoke create_my_workshop RPC once
        if (activeSession && activeSession.access_token) {
          console.log('[AuthGateway] Step 2: Session established, invoking create_my_workshop RPC once...');
          const { workshop, error: rpcError } = await createMyWorkshopRpc({
            brand: brandName.trim(),
            artist: artistName.trim(),
            gender: gender === 'male' ? 'male' : 'female',
            country: selectedCountry.name,
            currency: selectedCountry.currency,
            phone: phoneNumber.trim(),
          });

          if (rpcError) {
            console.error('[AuthGateway] create_my_workshop RPC failed:', rpcError);
            setErrorMsg(rpcError.arabicMessage + (rpcError.code ? ` [${rpcError.code}]` : ''));
            return;
          }

          console.log('[AuthGateway] Step 3: Workshop created successfully. App will load the workshop.');
          if (workshop) {
            onAuthenticated(workshop);
          }
          return;
        }

        // If no session immediately returned (email confirmation required)
        console.log('[AuthGateway] SignUp succeeded without active session. Confirmation notice shown.');
        setSuccessMsg('تم إنشاء الحساب بنجاح! إذا طُلب تأكيد البريد، يرجى تفعيل حسابك من البريد الإلكتروني ثم تسجيل الدخول.');
      } else {
        // Mode === 'login'
        console.log('[AuthGateway] Step 1: Submitting signInWithPassword for:', cleanEmail);
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          console.error('[AuthGateway] SignIn error:', signInError);
          const errRes = getArabicSupabaseError(signInError);
          setErrorMsg(errRes.arabicMessage);
          return;
        }

        let activeSession: any = signInData.session;
        if (!activeSession) {
          const { data: currentSessionData } = await supabase.auth.getSession();
          activeSession = currentSessionData?.session || null;
        }

        const hasSession = !!activeSession?.access_token;
        const userId = signInData.user?.id || activeSession?.user?.id || 'غير متوفر';
        const tokenLength = activeSession?.access_token ? activeSession.access_token.length : 0;

        console.log('[AuthGateway] Step 2: Login successful. Checking account status and fetching workshop...');

        // فحص حالة الحساب في جدول profiles و workshops للتحقق من التعليق
        try {
          const [profileStatusRes, wsStatusRes] = await Promise.all([
            supabase.from('profiles').select('status').eq('id', signInData.user!.id).maybeSingle(),
            supabase.from('workshops').select('status, is_frozen').eq('id', (signInData.user?.user_metadata as any)?.workshop_id || signInData.user!.id).maybeSingle(),
          ]);

          const profStatus = profileStatusRes.data?.status;
          const wsStatus = wsStatusRes.data?.status;
          const isFrozen = wsStatusRes.data?.is_frozen;

          if (profStatus === 'suspended' || wsStatus === 'suspended' || isFrozen || profStatus === 'banned' || wsStatus === 'banned') {
            await supabase.auth.signOut().catch(() => {});
            localStorage.removeItem('alshams_profile');
            setErrorMsg('تم تعليق حساب الورشة مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
            setLoading(false);
            return;
          }
        } catch (statusErr) {
          console.warn('[AuthGateway] Status verification notice:', statusErr);
        }

        const { workshop, error: wsError } = await getCurrentWorkshopFromSupabase();
        if (workshop) {
          if (workshop.status === 'suspended' || (workshop as any).isFrozen) {
            await supabase.auth.signOut().catch(() => {});
            localStorage.removeItem('alshams_profile');
            setErrorMsg('تم تعليق حساب الورشة مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
            setLoading(false);
            return;
          }
          console.log('[AuthGateway] Step 3: Workshop loaded successfully:', workshop.brandName);
          onAuthenticated(workshop);
          return;
        }

        // If no row exists yet in workshops table, construct profile from metadata
        const userMeta = (signInData.user?.user_metadata || {}) as any;
        const fallbackProfile: UserProfile = {
          id: signInData.user!.id,
          ownerUid: signInData.user!.id,
          tenantId: userMeta.workshop_id || signInData.user!.id,
          workshopId: userMeta.workshop_id || signInData.user!.id,
          email: signInData.user!.email || cleanEmail,
          artistName: userMeta.artist_name || userMeta.artistName || 'فنان الشمساوية',
          brandName: userMeta.brand_name || userMeta.brandName || 'ورشة الشمساوية',
          gender: userMeta.gender || 'female',
          phoneNumber: userMeta.phone_number || userMeta.phone || '',
          country: userMeta.country || 'مصر',
          currency: userMeta.currency || 'EGP',
          currencySymbol: userMeta.currency_symbol || 'ج.م',
          selectedCrafts: userMeta.selected_crafts || ['macrame'],
          defaultVatPercent: 14,
          showTaxInfoOnInvoice: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: cleanEmail,
        };
        onAuthenticated(fallbackProfile);
        return;
      }
    } catch (err: any) {
      console.error('[AuthGateway] Unexpected auth exception:', err);
      const errRes = getArabicSupabaseError(err);
      setErrorMsg(errRes.arabicMessage);
    } finally {
      // Rule 5: زر الدخول/التسجيل يرجع لحالته الطبيعية بعد انتهاء العملية (نجاح أو فشل) داخل finally
      setLoading(false);
    }
  };

  // 2. Send Password Reset Link Modal (Supabase)
  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotNotice(null);

    if (forgotCountdown > 0) {
      return;
    }

    const clean = forgotEmail.trim();
    if (!clean || !clean.includes('@')) {
      setForgotNotice({ text: 'يرجى إدخال بريد إلكتروني صالح.', isError: true });
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: window.location.origin,
      });

      if (error) {
        console.error('[AuthGateway] resetPasswordForEmail error:', error);
        const rawMsg = (error.message || '').toLowerCase();
        const code = String((error as any).code || error.status || '').toLowerCase();

        if (
          code === '429' ||
          code.includes('over_email_send_rate_limit') ||
          rawMsg.includes('over_email_send_rate_limit') ||
          rawMsg.includes('rate limit') ||
          rawMsg.includes('too many requests')
        ) {
          setForgotNotice({ text: 'حاول بعد دقيقة', isError: true });
        } else if (rawMsg.includes('email address not authorized') || code.includes('email_address_not_authorized')) {
          setForgotNotice({
            text: 'خدمة الإيميل غير مفعّلة لهذا العنوان بعد، تواصل مع الدعم',
            isError: true,
          });
        } else {
          const errRes = getArabicSupabaseError(error);
          setForgotNotice({ text: errRes.arabicMessage, isError: true });
        }
      } else {
        // Always show neutral message as requested in Requirement 1
        setForgotNotice({
          text: 'لو الإيميل مسجل عندنا هيوصلك رابط تغيير كلمة المرور، وراجع فولدر الرسائل غير المرغوبة (Spam)',
          isError: false,
        });
      }
    } catch (err: any) {
      console.error('[AuthGateway] resetPasswordForEmail exception:', err);
      const rawMsg = (err?.message || '').toLowerCase();
      if (rawMsg.includes('rate limit') || rawMsg.includes('429')) {
        setForgotNotice({ text: 'حاول بعد دقيقة', isError: true });
      } else {
        const errRes = getArabicSupabaseError(err);
        setForgotNotice({ text: errRes.arabicMessage, isError: true });
      }
    } finally {
      setForgotLoading(false);
      // Disable button for 60 seconds after send with visible countdown
      setForgotCountdown(60);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-amber-200/80 dark:border-stone-800 p-6 sm:p-8 space-y-5 text-right relative overflow-hidden">
        {/* Top Decorative Sun Beam */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Tabs: Login / Signup Switcher */}
        <div className="flex items-center rounded-2xl bg-stone-100 dark:bg-stone-800 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-xs'
                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              mode === 'signup'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-xs'
                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            فتح ورشة جديدة
          </button>
        </div>

        {/* Success Notice if any */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Active Auth Flow */}
        {mode === 'login' ? (
          <Login
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            errorMsg={errorMsg}
            onSubmit={handleEmailAuth}
            onForgotPassword={() => {
              setForgotEmail(email);
              setForgotNotice(null);
              setShowForgotModal(true);
            }}
          />
        ) : (
          <Register
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            brandName={brandName}
            setBrandName={setBrandName}
            artistName={artistName}
            setArtistName={setArtistName}
            gender={gender}
            setGender={setGender}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            countryCode={countryCode}
            setCountryCode={setCountryCode}
            loading={loading}
            errorMsg={errorMsg}
            onSubmit={handleEmailAuth}
          />
        )}

        {/* Footer Guarantee */}
        <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-center gap-1.5 text-[10px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>عزل سحابي كامل ومزامنة مشفرة وآمنة لورشتك الحرفية</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4 text-right relative">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  استعادة كلمة المرور
                </h3>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً مباشراً لتعيين كلمة مرور جديدة.
            </p>

            {forgotNotice && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                  forgotNotice.isError
                    ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                {forgotNotice.isError ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{forgotNotice.text}</span>
              </div>
            )}

            <form onSubmit={handleSendResetLink} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading || forgotCountdown > 0}
                className="w-full py-2.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {forgotLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : forgotCountdown > 0 ? (
                  <>
                    <Clock className="w-4 h-4 text-amber-200 animate-pulse" />
                    <span>حاول مجدداً بعد ({forgotCountdown} ثانية)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>أرسل رابط التغيير</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
