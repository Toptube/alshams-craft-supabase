import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { AlShamsFalconEmblem } from '../brand/BrandAssets';
import { ArtisanSkillLevel, getSkillLevelMeta } from '../../types/artisanGrowth';
import { ArtisanSkillAssessment } from './ArtisanSkillAssessment';

interface LoginProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  loading: boolean;
  errorMsg: string;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  onGoogleLogin?: () => void;
  googleLoading?: boolean;
  onFacebookLogin?: () => void;
  facebookLoading?: boolean;
  skillLevel?: ArtisanSkillLevel;
  onSkillLevelChange?: (level: ArtisanSkillLevel, score?: number) => void;
}

export const Login: React.FC<LoginProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  errorMsg,
  onSubmit,
  onForgotPassword,
  onGoogleLogin,
  googleLoading = false,
  onFacebookLogin,
  facebookLoading = false,
  skillLevel = 'intermediate',
  onSkillLevelChange,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showLevelQuiz, setShowLevelQuiz] = useState(false);

  // Restore remembered state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alshams_remember_me');
      if (saved !== null) {
        setRememberMe(saved === 'true');
      }
      const savedEmail = localStorage.getItem('alshams_saved_email');
      if (savedEmail && !email) {
        setEmail(savedEmail);
      }
    } catch {
      // ignore
    }
  }, [email, setEmail]);

  const handleFormSubmit = (e: React.FormEvent) => {
    try {
      localStorage.setItem('alshams_remember_me', String(rememberMe));
      if (rememberMe && email) {
        localStorage.setItem('alshams_saved_email', email.trim());
      } else if (!rememberMe) {
        localStorage.removeItem('alshams_saved_email');
      }
    } catch {
      // ignore
    }
    onSubmit(e);
  };

  return (
    <div className="space-y-4">
      {/* Branding Header */}
      <div className="flex flex-col items-center justify-center text-center space-y-2">
        <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
          <AlShamsFalconEmblem size="xl" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-[800] text-stone-900 dark:text-amber-300 inline-flex items-center justify-center gap-2 flex-wrap">
            <span>منظومة الشمساوية</span>
            <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 align-top tracking-wider uppercase">
              SaaS
            </span>
          </h1>
          <span className="text-[10px] font-mono tracking-wider text-amber-700 dark:text-amber-400 block mt-1 font-bold" dir="ltr">
            All-in-One Craft SaaS Platform: ERP • CRM • HR • FCA • AI
          </span>
        </div>
        <p className="text-xs text-stone-600 dark:text-stone-300 font-medium max-w-sm leading-relaxed mt-1">
          منصة الحرفيين السحابية المتكاملة: تخطيط موارد، إدارة عملاء، موارد بشرية، منظومة مالية وحساب تكاليف دقيقة، مع عقل ذكاء اصطناعي إشرافي.
        </p>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Social OAuth Buttons (Google & Facebook) */}
      {(onGoogleLogin || onFacebookLogin) && (
        <div className="space-y-2.5">
          {onGoogleLogin && (
            <button
              type="button"
              disabled={googleLoading || facebookLoading || loading}
              onClick={onGoogleLogin}
              className="w-full py-2.5 px-4 rounded-2xl bg-white dark:bg-[#132040] hover:bg-stone-50 dark:hover:bg-[#1B2D59] border border-[#D4CCBC] dark:border-[#2A4073] text-[#0C1427] dark:text-[#F7F3EA] font-black text-xs flex items-center justify-center gap-2.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {googleLoading ? (
                <div className="w-4 h-4 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                    <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.105-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.225 1.18-3.25 0-6.01-2.19-7-5.14H.98v3.14C3.01 21.2 7.21 24 12 24Z" />
                    <path fill="#FBBC05" d="M5 14.03c-.25-.74-.39-1.54-.39-2.36s.14-1.62.39-2.36V6.17H.98C.35 7.42 0 8.83 0 10.67s.35 3.25.98 4.5L5 14.03Z" />
                    <path fill="#EA4335" d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.075 1.18 15.3 0 12 0 7.21 0 3.01 2.8.98 6.83l4.02 3.14c.99-2.95 3.75-5.22 7-5.22Z" />
                  </svg>
                  <span>المتابعة والدخول بحساب Google</span>
                </>
              )}
            </button>
          )}

          {onFacebookLogin && (
            <button
              type="button"
              disabled={facebookLoading || googleLoading || loading}
              onClick={onFacebookLogin}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#1877F2] hover:bg-[#166FE5] border border-[#1877F2] text-white font-black text-xs flex items-center justify-center gap-2.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {facebookLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
                  </svg>
                  <span>المتابعة والدخول بحساب Facebook</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-2.5 text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
            <span className="flex-1 h-px bg-[#D4CCBC] dark:bg-[#22355E]" />
            <span>أو الدخول بالبريد الإلكتروني</span>
            <span className="flex-1 h-px bg-[#D4CCBC] dark:bg-[#22355E]" />
          </div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleFormSubmit} className="space-y-3.5">
        {/* Email */}
        <div>
          <label className="block text-xs font-bold mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
            البريد الإلكتروني <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold outline-none focus:ring-2 focus:ring-[#EA580C] font-mono text-right"
            />
            <Mail className="w-4 h-4 text-[#EA580C]/80 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Password with Eye/EyeOff toggle */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA]">
              كلمة المرور <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={onForgotPassword}
              data-flat="true"
              className="text-[11px] font-bold text-[#C2410C] dark:text-amber-400 hover:underline cursor-pointer"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 pr-9 pl-10 rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold outline-none focus:ring-2 focus:ring-[#EA580C] font-mono text-right"
            />
            <Lock className="w-4 h-4 text-[#EA580C]/80 absolute right-3 top-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              data-flat="true"
              className="absolute left-3 top-2.5 text-[#334155] dark:text-[#CBD5E1] hover:text-[#EA580C] dark:hover:text-amber-400 transition cursor-pointer p-0.5"
              title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center gap-2 pt-0.5">
          <input
            type="checkbox"
            id="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-[#D4CCBC] text-[#EA580C] focus:ring-[#EA580C] cursor-pointer accent-[#EA580C]"
          />
          <label htmlFor="rememberMe" className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] cursor-pointer select-none">
            تذكر تسجيل دخولي على هذا الجهاز
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 transition disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn size={15} />
              <span>تسجيل الدخول للمنظومة</span>
            </>
          )}
        </button>
      </form>

      {/* Optional Quick Artisan Skill Assessment at Login */}
      {onSkillLevelChange && (
        <div className="pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
          <button
            type="button"
            onClick={() => setShowLevelQuiz((prev) => !prev)}
            className="w-full py-2.5 px-3 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center justify-between gap-2 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>اختبار تحديد مستوى الفنان / الترقية لمستوى خبير</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#C2410C] dark:text-[#FBBF24]">
              <span>{getSkillLevelMeta(skillLevel).displayShortLabel}</span>
              {showLevelQuiz ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {showLevelQuiz && (
            <div className="mt-2.5">
              <ArtisanSkillAssessment
                value={skillLevel}
                onChange={onSkillLevelChange}
                compact
                defaultOpenQuiz
              />
              <p className="mt-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 text-center">
                سيتم حفظ مستواك وتفعيل صلاحياته تلقائياً فور تسجيل الدخول.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
