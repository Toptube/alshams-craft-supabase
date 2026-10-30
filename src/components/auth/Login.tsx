import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

interface LoginProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  loading: boolean;
  errorMsg: string;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
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
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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
          <img
            src="/alshams_falcon_emblem.png"
            alt="شعار منظومة الشمساوية"
            className="w-full h-full object-contain filter drop-shadow-md select-none"
          />
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

      {/* Login Form */}
      <form onSubmit={handleFormSubmit} className="space-y-3.5">
        {/* Email */}
        <div>
          <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
            البريد الإلكتروني <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 font-mono text-right"
            />
            <Mail className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Password with Eye/EyeOff toggle */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
              كلمة المرور <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
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
              className="w-full px-3.5 py-2.5 pr-9 pl-10 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 font-mono text-right"
            />
            <Lock className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute left-3 top-2.5 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer p-0.5"
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
            className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
          />
          <label htmlFor="rememberMe" className="text-xs font-bold text-stone-600 dark:text-stone-400 cursor-pointer select-none">
            تذكر تسجيل دخولي على هذا الجهاز
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition disabled:opacity-50 cursor-pointer"
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
    </div>
  );
};
