import React, { useState, useEffect } from 'react';
import { UserProfile, Gender } from '../../types';
import { MainSectionId } from '../../registry/craftsRegistry';
import { SupplierBusinessType, SupplierPricingMode } from '../../types/supplier';
import { useFeatureFlags } from '../../types/featureFlags';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { supabase, supabaseConfig } from '../../lib/supabase';
import {
  getArabicSupabaseError,
  createMyWorkshopRpc,
  getCurrentWorkshopFromSupabase,
} from '../../db/supabaseService';
import {
  getCurrentSupplierFromSupabase,
  registerSupplierAccount,
} from '../../db/supplierService';
import { Login } from './Login';
import { Register } from './Register';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  KeyRound,
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
  initialMode?: 'login' | 'signup';
  initialRegisterRole?: 'artisan' | 'supplier';
  onBackToLanding?: () => void;
}

const PENDING_SUPPLIER_REG_KEY = 'alshams_pending_supplier_reg';

export const AuthGateway: React.FC<AuthGatewayProps> = ({
  onAuthenticated,
  recoveryError,
  onClearRecoveryError,
  initialMode = 'login',
  initialRegisterRole = 'artisan',
  onBackToLanding,
}) => {
  const flags = useFeatureFlags();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [accountRole, setAccountRole] = useState<'artisan' | 'supplier'>(
    flags.supplierRegistrationEnabled ? initialRegisterRole : 'artisan'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [countryCode, setCountryCode] = useState('EG');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [businessTypes, setBusinessTypes] = useState<SupplierBusinessType[]>(['online']);
  const [pricingModes, setPricingModes] = useState<SupplierPricingMode[]>(['both']);
  const [supplySections, setSupplySections] = useState<MainSectionId[]>(['ropes_textiles']);
  const [suppliedMaterials, setSuppliedMaterials] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [forgotCountdown, setForgotCountdown] = useState<number>(0);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (flags.supplierRegistrationEnabled) {
      setAccountRole(initialRegisterRole);
    } else {
      setAccountRole('artisan');
    }
  }, [initialRegisterRole, flags.supplierRegistrationEnabled]);

  useEffect(() => {
    if (recoveryError) {
      setErrorMsg(recoveryError);
    }
  }, [recoveryError]);

  useEffect(() => {
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

  const effectiveRole: 'artisan' | 'supplier' = flags.supplierRegistrationEnabled
    ? accountRole
    : 'artisan';

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
          throw new Error(
            effectiveRole === 'supplier'
              ? 'يرجى كتابة اسم متجر المورد أو الشركة.'
              : 'يرجى كتابة اسم البراند أو المشغل الخاص بك.'
          );
        }
        if (!artistName.trim()) {
          throw new Error(
            effectiveRole === 'supplier'
              ? 'يرجى كتابة اسم المالك أو المسؤول.'
              : 'يرجى كتابة اسمك (الفنان أو الفنانة).'
          );
        }

        if (effectiveRole === 'supplier' && !governorate.trim()) {
          throw new Error('يرجى كتابة المحافظة أو المدينة.');
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              account_role: effectiveRole,
              brand_name: brandName.trim(),
              artist_name: artistName.trim(),
            },
          },
        });

        if (signUpError) {
          const errRes = getArabicSupabaseError(signUpError);
          setErrorMsg(errRes.arabicMessage);
          return;
        }

        let activeSession: any = signUpData.session;
        if (!activeSession) {
          const { data: currentSessionData } = await supabase.auth.getSession();
          activeSession = currentSessionData?.session || null;
        }

        const supplierPayload = {
          brandName: brandName.trim(),
          ownerName: artistName.trim(),
          gender: (gender === 'male' ? 'male' : 'female') as Gender,
          phone: phoneNumber.trim(),
          email: cleanEmail,
          country: selectedCountry.name,
          governorate: governorate.trim(),
          currency: selectedCountry.currency,
          currencySymbol: selectedCountry.currencySymbol,
          businessTypes,
          pricingModes,
          supplySections,
          suppliedMaterials,
          ownerUid: signUpData.user?.id || activeSession?.user?.id,
        };

        if (activeSession && activeSession.access_token) {
          if (effectiveRole === 'supplier') {
            const regRes = await registerSupplierAccount(supplierPayload);
            if (!regRes.success || !regRes.profile) {
              setErrorMsg(regRes.error || 'تعذر تسجيل حساب المورد.');
              return;
            }
            try {
              localStorage.removeItem(PENDING_SUPPLIER_REG_KEY);
            } catch {}
            onAuthenticated(regRes.profile);
            return;
          }

          const { workshop, error: rpcError } = await createMyWorkshopRpc({
            brand: brandName.trim(),
            artist: artistName.trim(),
            gender: gender === 'male' ? 'male' : 'female',
            country: selectedCountry.name,
            currency: selectedCountry.currency,
            phone: phoneNumber.trim(),
          });

          if (rpcError) {
            setErrorMsg(rpcError.arabicMessage + (rpcError.code ? ` [${rpcError.code}]` : ''));
            return;
          }

          if (workshop) {
            onAuthenticated(workshop);
          }
          return;
        }

        if (effectiveRole === 'supplier') {
          try {
            localStorage.setItem(PENDING_SUPPLIER_REG_KEY, JSON.stringify(supplierPayload));
          } catch {}
        }

        setSuccessMsg(
          'تم إنشاء الحساب بنجاح! إذا طُلب تأكيد البريد، يرجى تفعيل حسابك من البريد الإلكتروني ثم تسجيل الدخول.'
        );
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          const errRes = getArabicSupabaseError(signInError);
          setErrorMsg(errRes.arabicMessage);
          return;
        }

        try {
          const [profileStatusRes, wsStatusRes] = await Promise.all([
            supabase.from('profiles').select('status').eq('id', signInData.user!.id).maybeSingle(),
            supabase
              .from('workshops')
              .select('status, is_frozen')
              .or(`owner_id.eq.${signInData.user!.id},owner_uid.eq.${signInData.user!.id}`)
              .limit(1)
              .maybeSingle(),
          ]);

          const profStatus = profileStatusRes.data?.status;
          const wsStatus = wsStatusRes.data?.status;
          const isFrozen = wsStatusRes.data?.is_frozen;

          if (
            profStatus === 'suspended' ||
            wsStatus === 'suspended' ||
            isFrozen ||
            profStatus === 'banned' ||
            wsStatus === 'banned'
          ) {
            await supabase.auth.signOut().catch(() => {});
            localStorage.removeItem('alshams_profile');
            setErrorMsg('تم تعليق الحساب مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
            setLoading(false);
            return;
          }
        } catch {}

        // Complete pending supplier registration after email confirmation if present
        try {
          const pendingRaw = localStorage.getItem(PENDING_SUPPLIER_REG_KEY);
          if (pendingRaw) {
            const pending = JSON.parse(pendingRaw);
            if (pending?.email?.toLowerCase() === cleanEmail.toLowerCase()) {
              const regRes = await registerSupplierAccount({
                ...pending,
                ownerUid: signInData.user!.id,
              });
              localStorage.removeItem(PENDING_SUPPLIER_REG_KEY);
              if (regRes.success && regRes.profile) {
                onAuthenticated(regRes.profile);
                return;
              }
            }
          }
        } catch {}

        // Check Supplier Profile first if user registered as supplier
        const supplierProfile = await getCurrentSupplierFromSupabase();
        if (supplierProfile) {
          if (
            supplierProfile.status === 'suspended' ||
            supplierProfile.status === 'banned' ||
            supplierProfile.isFrozen
          ) {
            await supabase.auth.signOut().catch(() => {});
            localStorage.removeItem('alshams_profile');
            setErrorMsg('تم تعليق حساب المورد مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
            setLoading(false);
            return;
          }
          onAuthenticated(supplierProfile);
          return;
        }

        const { workshop } = await getCurrentWorkshopFromSupabase();
        if (workshop) {
          if (workshop.status === 'suspended' || (workshop as any).isFrozen) {
            await supabase.auth.signOut().catch(() => {});
            localStorage.removeItem('alshams_profile');
            setErrorMsg('تم تعليق حساب الورشة مؤقتاً، يرجى مراجعة إدارة عيلة الشمساوية');
            setLoading(false);
            return;
          }
          onAuthenticated(workshop);
          return;
        }

        const userMeta = (signInData.user?.user_metadata || {}) as any;
        let profRow: any = null;
        try {
          const { data: pData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', signInData.user!.id)
            .maybeSingle();
          profRow = pData;
        } catch {}

        const emailPrefix = cleanEmail.split('@')[0] || '';
        const fallbackProfile: UserProfile = {
          id: profRow?.workshop_id || userMeta.workshop_id || signInData.user!.id,
          ownerUid: signInData.user!.id,
          tenantId: profRow?.workshop_id || userMeta.workshop_id || signInData.user!.id,
          workshopId: profRow?.workshop_id || userMeta.workshop_id || signInData.user!.id,
          email: signInData.user!.email || cleanEmail,
          artistName:
            profRow?.artist_name ||
            profRow?.full_name ||
            profRow?.name ||
            userMeta.artist_name ||
            userMeta.artistName ||
            userMeta.full_name ||
            emailPrefix ||
            'فنان',
          brandName:
            profRow?.brand_name ||
            userMeta.brand_name ||
            userMeta.brandName ||
            (emailPrefix ? `ورشة ${emailPrefix}` : 'ورشة حرفية'),
          gender: profRow?.gender || userMeta.gender || 'female',
          phoneNumber:
            profRow?.phone || profRow?.phone_number || userMeta.phone_number || userMeta.phone || '',
          country: profRow?.country || userMeta.country || 'جمهورية مصر العربية',
          currency: profRow?.currency || userMeta.currency || 'EGP',
          currencySymbol: userMeta.currency_symbol || 'ج.م',
          selectedCrafts: profRow?.selected_crafts || userMeta.selected_crafts || ['macrame'],
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
      const errRes = getArabicSupabaseError(err);
      setErrorMsg(errRes.arabicMessage);
    } finally {
      setLoading(false);
    }
  };

  // 1.5 Google OAuth Sign-In / Sign-Up (Supabase)
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    onClearRecoveryError?.();
    setGoogleLoading(true);
    try {
      try {
        localStorage.setItem('alshams_oauth_intended_role', effectiveRole);
      } catch {}

      try {
        const settingsRes = await fetch(`${supabaseConfig.url}/auth/v1/settings`, {
          headers: { apikey: supabaseConfig.publishableKey },
          cache: 'no-store',
        });
        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          if (settingsJson?.external && settingsJson.external.google !== true) {
            setErrorMsg(
              'تسجيل الدخول عبر Google غير مفعّل حالياً في إعدادات Supabase (Authentication → Providers → Google).'
            );
            setGoogleLoading(false);
            return;
          }
        }
      } catch {}

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) {
        const errRes = getArabicSupabaseError(error);
        setErrorMsg(
          errRes.arabicMessage ||
            'تعذر الاتصال بتسجيل الدخول عبر Google، تأكد من تفعيل مزود Google في إعدادات المنصة.'
        );
        setGoogleLoading(false);
      }
    } catch (err: any) {
      const errRes = getArabicSupabaseError(err);
      setErrorMsg(errRes.arabicMessage || 'حدث خطأ أثناء الاتصال بحساب Google.');
      setGoogleLoading(false);
    }
  };

  // 2. Send Password Reset Link Modal
  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotNotice(null);
    if (forgotCountdown > 0) return;

    const clean = forgotEmail.trim();
    if (!clean || !clean.includes('@')) {
      setForgotNotice({ text: 'يرجى إدخال بريد إلكتروني صالح.', isError: true });
      return;
    }

    setForgotLoading(true);
    let shouldCooldown = false;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: `${window.location.origin}/?recovery=1`,
      });

      if (error) {
        const rawMsg = (error.message || '').toLowerCase();
        const code = String((error as any).code || error.status || '').toLowerCase();

        if (
          code === '429' ||
          code.includes('over_email_send_rate_limit') ||
          rawMsg.includes('over_email_send_rate_limit') ||
          rawMsg.includes('rate limit') ||
          rawMsg.includes('too many requests')
        ) {
          shouldCooldown = true;
          setForgotNotice({ text: 'حاول بعد دقيقة', isError: true });
        } else if (
          rawMsg.includes('email address not authorized') ||
          code.includes('email_address_not_authorized')
        ) {
          setForgotNotice({
            text: 'خدمة الإيميل غير مفعّلة لهذا العنوان بعد، تواصل مع الدعم',
            isError: true,
          });
        } else if (
          code === '500' ||
          rawMsg.includes('error sending recovery email') ||
          rawMsg.includes('unexpected_failure') ||
          rawMsg.includes('smtp')
        ) {
          setForgotNotice({
            text: 'تعذر إرسال رابط استعادة كلمة المرور (خطأ 500 من خادم البريد في Supabase).',
            isError: true,
          });
        } else {
          const errRes = getArabicSupabaseError(error);
          setForgotNotice({ text: errRes.arabicMessage, isError: true });
        }
      } else {
        shouldCooldown = true;
        try {
          localStorage.setItem('alshams_pending_recovery_ts', String(Date.now()));
        } catch {}
        setForgotNotice({
          text: 'لو الإيميل مسجل عندنا هيوصلك رابط تغيير كلمة المرور، وراجع فولدر الرسائل غير المرغوبة (Spam)',
          isError: false,
        });
      }
    } catch (err: any) {
      const rawMsg = (err?.message || '').toLowerCase();
      if (rawMsg.includes('rate limit') || rawMsg.includes('429')) {
        shouldCooldown = true;
        setForgotNotice({ text: 'حاول بعد دقيقة', isError: true });
      } else {
        const errRes = getArabicSupabaseError(err);
        setForgotNotice({ text: errRes.arabicMessage, isError: true });
      }
    } finally {
      setForgotLoading(false);
      if (shouldCooldown) {
        setForgotCountdown(60);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F2ECE1] via-[#EBE4D6] to-[#F5DFC6]/60 dark:from-[#060B18] dark:via-[#081024] dark:to-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      {onBackToLanding && (
        <div className="w-full max-w-lg mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#C2410C] dark:text-amber-300 bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition-colors px-3 py-2 rounded-xl cursor-pointer"
          >
            <span>← الرجوع لصفحة المنظومة الرئيسية</span>
          </button>
          <button
            type="button"
            onClick={onBackToLanding}
            aria-label="إغلاق"
            title="إغلاق"
            className="w-8 h-8 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className={`w-full ${
          mode === 'signup' && effectiveRole === 'supplier' ? 'max-w-lg' : 'max-w-md'
        } bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl shadow-2xl border border-[#D4CCBC] dark:border-[#22355E] p-6 sm:p-8 space-y-5 text-right relative overflow-hidden`}
      >
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-gradient-to-br from-[#EA580C]/20 to-[#F59E0B]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Tabs: Login / Signup Switcher */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-1.5 text-xs font-black">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
              onClearRecoveryError?.();
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white shadow-sm'
                : 'text-[#334155] dark:text-[#CBD5E1] bg-[#F7F3EA]/70 dark:bg-[#1A2B54]/60'
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
              onClearRecoveryError?.();
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white shadow-sm'
                : 'text-[#334155] dark:text-[#CBD5E1] bg-[#F7F3EA]/70 dark:bg-[#1A2B54]/60'
            }`}
          >
            {flags.supplierRegistrationEnabled ? 'فتح حساب جديد' : 'فتح ورشة جديدة'}
          </button>
        </div>

        {/* Success Notice */}
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
            onGoogleLogin={handleGoogleSignIn}
            googleLoading={googleLoading}
            onForgotPassword={() => {
              setForgotEmail(email);
              setForgotNotice(null);
              setShowForgotModal(true);
            }}
          />
        ) : (
          <Register
            accountRole={accountRole}
            setAccountRole={setAccountRole}
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
            governorate={governorate}
            setGovernorate={setGovernorate}
            businessTypes={businessTypes}
            setBusinessTypes={setBusinessTypes}
            pricingModes={pricingModes}
            setPricingModes={setPricingModes}
            supplySections={supplySections}
            setSupplySections={setSupplySections}
            suppliedMaterials={suppliedMaterials}
            setSuppliedMaterials={setSuppliedMaterials}
            loading={loading}
            errorMsg={errorMsg}
            onSubmit={handleEmailAuth}
            onGoogleLogin={handleGoogleSignIn}
            googleLoading={googleLoading}
          />
        )}

        <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>عزل سحابي كامل ومزامنة مشفرة وآمنة لمنظومتك</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl shadow-2xl border border-[#D4CCBC] dark:border-[#22355E] p-6 space-y-4 text-right relative">
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#EA580C] dark:text-amber-400" />
                <h3 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA]">
                  استعادة كلمة المرور
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
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
                <label className="block text-xs font-bold mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold outline-none focus:ring-2 focus:ring-[#EA580C] font-mono"
                  />
                  <Mail className="w-4 h-4 text-[#EA580C]/80 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading || forgotCountdown > 0}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-black text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
