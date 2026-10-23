import React, { useState } from 'react';
import { AlShamsBrandLogo } from '../brand/BrandAssets';
import { Gender, UserProfile } from '../../types';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { createMyWorkshopRpc } from '../../db/supabaseService';
import {
  Sparkles,
  Building2,
  User,
  Phone,
  AlertCircle,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

interface CompleteWorkshopScreenProps {
  userEmail: string;
  onWorkshopCreated: (profile: UserProfile) => void;
  onLogout: () => void;
}

export const CompleteWorkshopScreen: React.FC<CompleteWorkshopScreenProps> = ({
  userEmail,
  onWorkshopCreated,
  onLogout,
}) => {
  const [brandName, setBrandName] = useState('');
  const [artistName, setArtistName] = useState(userEmail.split('@')[0] || '');
  const [gender, setGender] = useState<Gender>('female');
  const [countryCode, setCountryCode] = useState('EG');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedCountry =
    COUNTRIES_CONFIG.find((c) => c.code === countryCode) || COUNTRIES_CONFIG[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!brandName.trim()) {
      setErrorMsg('يرجى كتابة اسم البراند أو الورشة.');
      return;
    }
    if (!artistName.trim()) {
      setErrorMsg('يرجى كتابة اسم الفنان أو الفنانة.');
      return;
    }

    setLoading(true);

    try {
      const { workshop, error } = await createMyWorkshopRpc({
        brand: brandName.trim(),
        artist: artistName.trim(),
        gender,
        country: selectedCountry.name,
        currency: selectedCountry.currency,
        phone: phoneNumber.trim(),
      });

      if (error) {
        setErrorMsg(error.arabicMessage);
        return;
      }

      if (workshop) {
        onWorkshopCreated(workshop);
      } else {
        setErrorMsg('تم إنشاء الورشة بنجاح، جاري إعادة تحميل البيانات...');
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ بيانات الورشة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-amber-200/80 dark:border-stone-800 p-6 sm:p-8 space-y-5 text-right relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <AlShamsBrandLogo size="md" />
          <h2 className="text-base font-black text-amber-950 dark:text-amber-300">
            إكمال بيانات الورشة
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            مرحباً بك! يرجى إدخال تفاصيل ورشتك للبدء في حساب التكاليف والإدارة السحابية.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
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
                placeholder="مثال: شمس مكرامي"
                className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
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
                className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
              <User className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                صفة المخاطبة
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-xl border cursor-pointer ${
                    gender === 'female'
                      ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-300'
                      : 'border-stone-300 dark:border-stone-700 text-stone-500'
                  }`}
                >
                  فنانة (مبدعة)
                </button>
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-xl border cursor-pointer ${
                    gender === 'male'
                      ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-300'
                      : 'border-stone-300 dark:border-stone-700 text-stone-500'
                  }`}
                >
                  فنان (مبدع)
                </button>
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
                  className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none font-mono text-left"
                />
                <Phone className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
              الدولة والعملة الافتراضية
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
            >
              {COUNTRIES_CONFIG.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.currencySymbol} - {c.currency})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>حفظ وتفعيل الورشة</span>
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="text-xs font-bold text-stone-500 hover:text-rose-600 transition inline-flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج والدخول بحساب آخر</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
