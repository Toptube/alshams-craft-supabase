import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getArabicSupabaseError } from '../../db/supabaseService';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

interface ResetPasswordScreenProps {
  onSuccess: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('كلمة المرور يجب أن لا تقل عن 8 أحرف أو أرقام.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[ResetPasswordScreen] updateUser error:', error);
        const lowerMsg = (error.message || '').toLowerCase();
        if (lowerMsg.includes('same_password') || lowerMsg.includes('different from the old password')) {
          setErrorMsg('كلمة المرور الجديدة مطابقة لكلمة المرور القديمة، يرجى اختيار كلمة مختلفة.');
        } else if (lowerMsg.includes('weak') || lowerMsg.includes('least 8') || lowerMsg.includes('pwned')) {
          setErrorMsg('كلمة المرور ضعيفة. يرجى اختيار كلمة مرور أقوى تحتوي على حروف وأرقام.');
        } else if (
          lowerMsg.includes('session') ||
          lowerMsg.includes('jwt') ||
          lowerMsg.includes('expired') ||
          error.status === 401 ||
          error.status === 403
        ) {
          setErrorMsg('انتهت صلاحية الجلسة، يرجى طلب رابط جديد لاستعادة كلمة المرور.');
        } else {
          const errRes = getArabicSupabaseError(error);
          setErrorMsg(errRes.arabicMessage);
        }
        return;
      }

      setSuccessMsg('تم تغيير كلمة المرور بنجاح!');
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      console.error('[ResetPasswordScreen] unexpected exception:', err);
      const errRes = getArabicSupabaseError(err);
      setErrorMsg(errRes.arabicMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200" dir="rtl">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-amber-200/80 dark:border-stone-800 p-6 sm:p-8 space-y-5 text-right relative overflow-hidden">
        {/* Sun Glow Decoration */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
            <img
              src="/alshams_falcon_emblem.png"
              alt="منظومة الشمساوية"
              className="w-full h-full object-contain filter drop-shadow-md select-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl sm:text-2xl font-[800] text-stone-900 dark:text-amber-300">
                تعيين كلمة مرور جديدة
              </h1>
            </div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-bold block mt-1">
              أدخل كلمة المرور الجديدة لتأمين حساب ورشتك
            </span>
          </div>
        </div>

        {/* Notices */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-stone-700 dark:text-stone-300">
              كلمة المرور الجديدة <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8 أحرف أو أرقام على الأقل"
                className="w-full px-3.5 py-2.5 pr-9 pl-10 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <Lock className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowNewPassword((p) => !p)}
                className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition cursor-pointer p-0.5"
                title={showNewPassword ? 'إخفاء' : 'إظهار'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-stone-700 dark:text-stone-300">
              تأكيد كلمة المرور الجديدة <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور"
                className="w-full px-3.5 py-2.5 pr-9 pl-10 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <KeyRound className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((p) => !p)}
                className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition cursor-pointer p-0.5"
                title={showConfirmPassword ? 'إخفاء' : 'إظهار'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || Boolean(successMsg)}
              className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>حفظ كلمة المرور الجديدة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
