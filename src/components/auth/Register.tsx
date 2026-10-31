import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User, Building2, Phone, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';
import { Gender } from '../../types';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { TermsModal } from './TermsModal';

interface RegisterProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  brandName: string;
  setBrandName: (brandName: string) => void;
  artistName: string;
  setArtistName: (artistName: string) => void;
  gender: Gender;
  setGender: (gender: Gender) => void;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  countryCode: string;
  setCountryCode: (code: string) => void;
  loading: boolean;
  errorMsg: string;
  onSubmit: (e: React.FormEvent) => void;
}

export const Register: React.FC<RegisterProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  brandName,
  setBrandName,
  artistName,
  setArtistName,
  gender,
  setGender,
  phoneNumber,
  setPhoneNumber,
  countryCode,
  setCountryCode,
  loading,
  errorMsg,
  onSubmit,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsError, setTermsError] = useState('');

  const selectedCountry =
    COUNTRIES_CONFIG.find((c) => c.code === countryCode) || COUNTRIES_CONFIG[0];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setTermsError('يجب الموافقة على سياسات وشروط وأحكام منظومة الشمساوية أولاً للمتابعة.');
      return;
    }
    setTermsError('');
    onSubmit(e);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center space-y-1">
        <h2 className="text-lg font-[800] text-stone-900 dark:text-amber-300">
          فتح ورشة حرفية جديدة
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 font-medium max-w-xs">
          انضم لعيلة الشمساوية واستمتع بنظام إدارة وحسابات وتسعير ذكي فوري
        </p>
      </div>

      {/* Error alert */}
      {(errorMsg || termsError) && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{termsError || errorMsg}</span>
        </div>
      )}

      {/* Register Form */}
      <form onSubmit={handleFormSubmit} className="space-y-3">
        {/* Brand Name & Artist Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
              اسم البراند أو الورشة <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="مثال: شمس كرافت"
                className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/70 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Building2 className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
              اسم الفنان أو الصانع <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="مثال: ياسمين أحمد"
                className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/70 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
              <User className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Gender & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
              صفة المخاطبة
            </label>
            <div className="flex gap-2">
              <label
                className={`flex-1 py-1.5 text-center text-xs font-bold rounded-xl border cursor-pointer transition ${
                  gender === 'female'
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-300 shadow-xs'
                    : 'border-stone-300 dark:border-stone-700 text-stone-500 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  className="hidden"
                  checked={gender === 'female'}
                  onChange={() => setGender('female')}
                />
                فنانة (مبدعة)
              </label>
              <label
                className={`flex-1 py-1.5 text-center text-xs font-bold rounded-xl border cursor-pointer transition ${
                  gender === 'male'
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-300 shadow-xs'
                    : 'border-stone-300 dark:border-stone-700 text-stone-500 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  className="hidden"
                  checked={gender === 'male'}
                  onChange={() => setGender('male')}
                />
                فنان (مبدع)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
              رقم الهاتف / واتساب
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="010XXXXXXXX"
                className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/70 text-xs font-bold outline-none font-mono text-left"
              />
              <Phone className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Country & Default Currency */}
        <div>
          <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
            الدولة والعملة الافتراضية
          </label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/70 text-xs font-bold outline-none cursor-pointer"
          >
            {COUNTRIES_CONFIG.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.currencySymbol} - {c.currency})
              </option>
            ))}
          </select>
        </div>

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

        {/* Password */}
        <div>
          <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
            كلمة المرور (٦ خانات على الأقل) <span className="text-rose-500">*</span>
          </label>
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

        {/* Mandatory Terms & AI Policy Checkbox */}
        <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="agreeTermsCheckbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600 shrink-0"
            />
            <label htmlFor="agreeTermsCheckbox" className="text-xs font-bold text-stone-700 dark:text-stone-300 leading-normal select-none">
              أوافق على سياسات وشروط وأحكام منظومة الشمساوية{' '}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-amber-700 dark:text-amber-400 font-extrabold underline hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer inline-block"
              >
                [اضغط للاطلاع على الشروط والأحكام]
              </button>
            </label>
          </div>
        </div>

        {/* Submit Button (Disabled visually and programmatically until agreeTerms is true) */}
        <button
          type="submit"
          disabled={!agreeTerms || loading}
          className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md ${
            agreeTerms && !loading
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-600/20 cursor-pointer'
              : 'bg-stone-300 dark:bg-stone-800 text-stone-500 dark:text-stone-500 cursor-not-allowed opacity-60'
          }`}
          title={!agreeTerms ? 'يجب الموافقة على الشروط والأحكام أولاً' : 'إنشاء الورشة'}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles size={15} />
              <span>إنشاء الورشة والانضمام للمنظومة</span>
            </>
          )}
        </button>
      </form>

      {/* Terms and AI Policy Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAgreeTerms(true)}
      />
    </div>
  );
};
