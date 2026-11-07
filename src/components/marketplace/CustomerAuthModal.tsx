import React, { useState } from 'react';
import { CustomerAuthUser } from '../../types';
import { saveStoredCustomerSession } from '../../services/marketplaceCartService';
import { playSuccessSound } from '../../lib/sounds';
import {
  User,
  Phone,
  MapPin,
  Tag,
  Award,
  X,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueAsGuest: () => void;
  onSuccessLogin: (user: CustomerAuthUser) => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onContinueAsGuest,
  onSuccessLogin,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [governorate, setGovernorate] = useState('القاهرة');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [alternateAddress, setAlternateAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('يرجى كتابة اسم حضرتك الكريم.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      setErrorMessage('يرجى إدخال رقم هاتف صحيح للتواصل ومتابعة الشحن.');
      return;
    }
    if (!detailedAddress.trim()) {
      setErrorMessage('يرجى كتابة عنوان التوصيل بالتفصيل (المنطقة، الشارع، رقم العمارة).');
      return;
    }

    const newUser: CustomerAuthUser = {
      id: 'cust_' + Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      alternatePhone: alternatePhone.trim() || undefined,
      governorate,
      detailedAddress: detailedAddress.trim(),
      alternateAddress: alternateAddress.trim() || undefined,
      loyaltyPoints: 50, // 50 Welcome bonus loyalty points
      firstOrderDiscountUsed: false,
    };

    saveStoredCustomerSession(newUser);
    playSuccessSound();
    onSuccessLogin(newUser);
  };

  const governorates = [
    'القاهرة',
    'الجيزة',
    'الإسكندرية',
    'القليوبية',
    'المنوفية',
    'الغربية',
    'الدقهلية',
    'الشرقية',
    'كفر الشيخ',
    'البحيرة',
    'دمياط',
    'بورسعيد',
    'الإسماعيلية',
    'السويس',
    'الفيوم',
    'بني سويف',
    'المنيا',
    'أسيوط',
    'سوهاج',
    'قنا',
    'الأقصر',
    'أسوان',
    'البحر الأحمر',
    'جنوب سيناء',
    'شمال سيناء',
    'مطروح',
    'الوادي الجديد',
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in" dir="rtl">
      <div className="bg-[#0C1427] border-2 border-amber-500/50 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto text-right shadow-2xl p-5 sm:p-6 space-y-4 text-white relative">
        {/* Close Button (✕) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-amber-500/20 pb-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center text-lg font-black shadow-md">
            ✨
          </div>
          <div>
            <h3 className="font-black text-base text-amber-300">
              تسجيل حساب عميل - عائلة الشمساوية
            </h3>
            <p className="text-xs text-[#EADBC8]">
              احصل على كود خصم 5% فوري + 50 نقطة ولاء مجانية في محفظتك 🎁
            </p>
          </div>
        </div>

        {/* Discount & Loyalty Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center gap-3">
          <Tag className="w-6 h-6 text-amber-400 shrink-0" />
          <div className="text-xs leading-relaxed text-stone-200">
            <span className="font-bold text-amber-300 block">كود ترحيبي فوري: [ SHAMS5 ]</span>
            <span>خصم 5% سارٍ على أول طلبية لك، ونقاط مكافآت تُضاف تلقائياً مع كل عملية شراء ناجحة!</span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold">
            {errorMessage}
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleRegister} className="space-y-3 text-xs">
          <div>
            <label className="block text-stone-300 font-bold mb-1">
              الاسم الكريم بالكامل *
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: سارة محمود"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white font-bold outline-none focus:border-amber-400"
                required
              />
              <User className="w-4 h-4 text-amber-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-300 font-bold mb-1">
                رقم الهاتف الأساسي * (إجباري للشحن)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white font-bold font-mono outline-none focus:border-amber-400"
                  required
                />
                <Phone className="w-4 h-4 text-amber-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-stone-300 font-bold mb-1">
                رقم هاتف بديل (اختياري)
              </label>
              <input
                type="tel"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                placeholder="011XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white font-bold font-mono outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-300 font-bold mb-1">
              المحافظة * (لحساب تكلفة الشحن)
            </label>
            <select
              value={governorate}
              onChange={(e) => setGovernorate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white font-bold outline-none focus:border-amber-400"
            >
              {governorates.map((gov) => (
                <option key={gov} value={gov} className="bg-[#0C1427] text-white">
                  {gov}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-300 font-bold mb-1">
              عنوان التوصيل بالتفصيل * (الشارع، العمارة، الشقة)
            </label>
            <textarea
              value={detailedAddress}
              onChange={(e) => setDetailedAddress(e.target.value)}
              placeholder="مثال: المعادي الجديدة، شارع النصر، عمارة 14، الدور الثالث شقة 6"
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white font-bold outline-none focus:border-amber-400 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-stone-300 font-bold mb-1">
              عنوان بديل اختياري (مكتب، منزل العائلة)
            </label>
            <input
              type="text"
              value={alternateAddress}
              onChange={(e) => setAlternateAddress(e.target.value)}
              placeholder="اختياري لتسليم الشحنة في حال عدم تواجدك"
              className="w-full px-3.5 py-2 rounded-xl bg-[#080F1E] border border-amber-500/30 text-white font-bold outline-none focus:border-amber-400"
            />
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs shadow-lg active:scale-98 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تسجيل الحساب وتفعيل الخصم 5% فوراً ✨</span>
            </button>

            <button
              type="button"
              onClick={onContinueAsGuest}
              className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>المتابعة كزائر بدون تسجيل (Guest)</span>
              <span className="text-[10px] text-stone-400">(مع التنازل عن كود الخصم ونقاط الولاء)</span>
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-amber-500/20 text-center">
          <p className="text-[11px] text-[#EADBC8] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>بياناتك محفوظة بأعلى معايير الأمان وتستخدم لغرض شحن طلبيتك فقط.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
