import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building2,
  Phone,
  Sparkles,
  AlertCircle,
  Truck,
  MapPin,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Gender } from '../../types';
import { MainSectionId } from '../../registry/craftsRegistry';
import {
  SUPPLIER_SUPPLY_SECTIONS,
  SupplierBusinessType,
  SupplierPricingMode,
} from '../../types/supplier';
import { useFeatureFlags } from '../../types/featureFlags';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { TermsModal } from './TermsModal';

interface RegisterProps {
  accountRole: 'artisan' | 'supplier';
  setAccountRole: (role: 'artisan' | 'supplier') => void;
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
  governorate: string;
  setGovernorate: (gov: string) => void;
  businessTypes: SupplierBusinessType[];
  setBusinessTypes: React.Dispatch<React.SetStateAction<SupplierBusinessType[]>>;
  pricingModes: SupplierPricingMode[];
  setPricingModes: React.Dispatch<React.SetStateAction<SupplierPricingMode[]>>;
  supplySections: MainSectionId[];
  setSupplySections: React.Dispatch<React.SetStateAction<MainSectionId[]>>;
  suppliedMaterials: string[];
  setSuppliedMaterials: React.Dispatch<React.SetStateAction<string[]>>;
  loading: boolean;
  errorMsg: string;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleLogin?: () => void;
  googleLoading?: boolean;
}

const BUSINESS_TYPE_OPTIONS: { id: SupplierBusinessType; label: string }[] = [
  { id: 'online', label: 'متجر أونلاين' },
  { id: 'shop', label: 'محل / معرض' },
  { id: 'factory', label: 'مصنع / مستورد' },
];

const PRICING_MODE_OPTIONS: { id: SupplierPricingMode; label: string }[] = [
  { id: 'retail', label: 'قطاعي' },
  { id: 'wholesale', label: 'جملة' },
  { id: 'both', label: 'جملة وقطاعي' },
];

export const Register: React.FC<RegisterProps> = ({
  accountRole,
  setAccountRole,
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
  governorate,
  setGovernorate,
  businessTypes,
  setBusinessTypes,
  pricingModes,
  setPricingModes,
  supplySections,
  setSupplySections,
  suppliedMaterials,
  setSuppliedMaterials,
  loading,
  errorMsg,
  onSubmit,
  onGoogleLogin,
  googleLoading = false,
}) => {
  const flags = useFeatureFlags();
  const effectiveRole: 'artisan' | 'supplier' = flags.supplierRegistrationEnabled
    ? accountRole
    : 'artisan';
  const isSupplier = effectiveRole === 'supplier';

  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [expandedSection, setExpandedSection] = useState<MainSectionId>('ropes_textiles');
  const [customMaterialDrafts, setCustomMaterialDrafts] = useState<Record<string, string>>({});

  const toggleBusinessType = (id: SupplierBusinessType) => {
    setBusinessTypes((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((x) => x !== id)
          : prev
        : [...prev, id]
    );
  };

  const togglePricingMode = (id: SupplierPricingMode) => {
    if (id === 'both') {
      setPricingModes(['both']);
      return;
    }
    setPricingModes((prev) => {
      const cleaned = prev.filter((x) => x !== 'both');
      const next = cleaned.includes(id)
        ? cleaned.length > 1
          ? cleaned.filter((x) => x !== id)
          : cleaned
        : [...cleaned, id];
      return next.length === 2 ? ['both'] : next;
    });
  };

  const toggleSection = (secId: MainSectionId) => {
    setSupplySections((prev) =>
      prev.includes(secId) ? prev.filter((x) => x !== secId) : [...prev, secId]
    );
    setExpandedSection(secId);
  };

  const toggleMaterial = (secId: MainSectionId, mat: string) => {
    if (!supplySections.includes(secId)) {
      setSupplySections((prev) => [...prev, secId]);
    }
    setSuppliedMaterials((prev) =>
      prev.includes(mat) ? prev.filter((m) => m !== mat) : [...prev, mat]
    );
  };

  const selectAllInSection = (secId: MainSectionId, presets: string[]) => {
    if (!supplySections.includes(secId)) {
      setSupplySections((prev) => [...prev, secId]);
    }
    setSuppliedMaterials((prev) => Array.from(new Set([...prev, ...presets])));
  };

  const clearSectionMaterials = (presets: string[]) => {
    setSuppliedMaterials((prev) => prev.filter((m) => !presets.includes(m)));
  };

  const handleAddCustomMaterial = (secId: MainSectionId) => {
    const val = (customMaterialDrafts[secId] || '').trim();
    if (!val) return;
    if (!supplySections.includes(secId)) {
      setSupplySections((prev) => [...prev, secId]);
    }
    setSuppliedMaterials((prev) => (prev.includes(val) ? prev : [...prev, val]));
    setCustomMaterialDrafts((prev) => ({ ...prev, [secId]: '' }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setTermsError('يجب الموافقة على سياسات وشروط وأحكام منظومة الشمساوية أولاً للمتابعة.');
      return;
    }
    if (isSupplier && supplySections.length === 0) {
      setTermsError('يرجى اختيار قسم واحد على الأقل من أقسام الخامات التي توفرها.');
      return;
    }
    setTermsError('');
    onSubmit(e);
  };

  return (
    <div className="space-y-4">
      {/* Role Selector (only when Feature Flag is enabled) */}
      {flags.supplierRegistrationEnabled && (
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
          <button
            type="button"
            onClick={() => {
              setAccountRole('artisan');
              setTermsError('');
            }}
            className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              !isSupplier
                ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white shadow-xs'
                : 'text-[#334155] dark:text-[#CBD5E1] hover:bg-white/50 dark:hover:bg-[#1A2B54]/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>أنا فنان (ورشة)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountRole('supplier');
              setTermsError('');
            }}
            className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isSupplier
                ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white shadow-xs'
                : 'text-[#334155] dark:text-[#CBD5E1] hover:bg-white/50 dark:hover:bg-[#1A2B54]/60'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>أنا مورد خامات</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center space-y-1">
        <h2 className="text-lg font-[800] text-stone-900 dark:text-amber-300">
          {isSupplier ? 'تسجيل حساب مورد خامات جديد' : 'فتح ورشة حرفية جديدة'}
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 font-medium max-w-xs">
          {isSupplier
            ? 'اعرض خاماتك للورش بسعر الجملة والقطاعي، وأدر متجرك وأوردراتك وخزائنك باحترافية'
            : 'انضم لعيلة الشمساوية واستمتع بنظام إدارة وحسابات وتسعير ذكي فوري'}
        </p>
      </div>

      {/* Error alert */}
      {(errorMsg || termsError) && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{termsError || errorMsg}</span>
        </div>
      )}

      {/* Google OAuth Quick Register */}
      {onGoogleLogin && (
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={googleLoading || loading}
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
                <span>التسجيل السريع بحساب Google</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2.5 text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
            <span className="flex-1 h-px bg-[#D4CCBC] dark:bg-[#22355E]" />
            <span>أو التسجيل ببيانات البريد الإلكتروني</span>
            <span className="flex-1 h-px bg-[#D4CCBC] dark:bg-[#22355E]" />
          </div>
        </div>
      )}

      {/* Register Form */}
      <form onSubmit={handleFormSubmit} className="space-y-3">
        {/* Brand Name & Owner/Artist Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
              {isSupplier ? 'اسم متجر المورد / الشركة' : 'اسم البراند أو الورشة'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={isSupplier ? 'مثال: الشروق للخيوط والخامات' : 'مثال: ورشة الإبداع اليدوي'}
                className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/70 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Building2 className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
              {isSupplier ? 'اسم المالك / المسؤول' : 'اسم الفنان أو الصانع'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder={isSupplier ? 'مثال: أحمد محمود' : 'مثال: ياسمين أحمد'}
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
                {isSupplier ? 'موردة / أستاذة' : 'فنانة (مبدعة)'}
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
                {isSupplier ? 'مورد / أستاذ' : 'فنان (مبدع)'}
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

        {/* Country & Default Currency (+ Governorate for Supplier) */}
        <div className={`grid grid-cols-1 ${isSupplier ? 'sm:grid-cols-2' : ''} gap-2.5`}>
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

          {isSupplier && (
            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                المحافظة / المدينة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  placeholder="مثال: القاهرة / الإسكندرية"
                  className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/70 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
                <MapPin className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Supplier-only Classification Fields */}
        {isSupplier && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-[#EFE9DC]/70 dark:bg-[#111C38] border border-[#D4CCBC] dark:border-[#22355E]">
            {/* Business Type */}
            <div>
              <label className="block text-[11px] font-black mb-1.5 text-stone-800 dark:text-stone-200">
                طبيعة النشاط التجاري
              </label>
              <div className="flex flex-wrap gap-1.5">
                {BUSINESS_TYPE_OPTIONS.map((opt) => {
                  const active = businessTypes.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleBusinessType(opt.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                        active
                          ? 'bg-[#EA580C] text-white border-[#EA580C]'
                          : 'bg-white dark:bg-[#0D162E] text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing Mode */}
            <div>
              <label className="block text-[11px] font-black mb-1.5 text-stone-800 dark:text-stone-200">
                آلية التسعير والبيع
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRICING_MODE_OPTIONS.map((opt) => {
                  const active = pricingModes.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => togglePricingMode(opt.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                        active
                          ? 'bg-[#0C1427] dark:bg-amber-600 text-white border-transparent'
                          : 'bg-white dark:bg-[#0D162E] text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4 Supply Sections & Materials */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-stone-800 dark:text-stone-200">
                  أقسام الخامات التي توفرها ({supplySections.length}/4)
                </label>
                <span className="text-[10px] font-bold text-[#C2410C] dark:text-amber-300 font-mono tabular-nums">
                  {suppliedMaterials.length} خامة مختارة
                </span>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                {SUPPLIER_SUPPLY_SECTIONS.map((sec) => {
                  const isSecActive = supplySections.includes(sec.id);
                  const isExpanded = expandedSection === sec.id;
                  const customForSection = suppliedMaterials.filter(
                    (m) =>
                      !SUPPLIER_SUPPLY_SECTIONS.some((s) =>
                        s.presetMaterials.includes(m)
                      )
                  );
                  return (
                    <div
                      key={sec.id}
                      className={`rounded-xl border transition ${
                        isSecActive
                          ? 'border-[#EA580C]/60 bg-white dark:bg-[#0D162E]'
                          : 'border-stone-300/80 dark:border-stone-700 bg-white/60 dark:bg-[#0D162E]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 p-2">
                        <button
                          type="button"
                          onClick={() => toggleSection(sec.id)}
                          className="flex items-center gap-2 text-right flex-1 cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              isSecActive
                                ? 'bg-[#EA580C] border-[#EA580C] text-white'
                                : 'border-stone-400 bg-transparent'
                            }`}
                          >
                            {isSecActive && <Check className="w-3 h-3" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-black text-stone-900 dark:text-stone-100 truncate">
                              {sec.titleAr}
                            </div>
                            <div className="text-[9px] text-stone-500 dark:text-stone-400 truncate">
                              {sec.subtitleAr}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSection(isExpanded ? ('' as any) : sec.id)
                          }
                          className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
                          title="عرض الخامات"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 pt-1 border-t border-stone-200 dark:border-stone-800 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => selectAllInSection(sec.id, sec.presetMaterials)}
                              className="text-[10px] font-black text-[#C2410C] dark:text-amber-300 hover:underline cursor-pointer"
                            >
                              تحديد الكل
                            </button>
                            <button
                              type="button"
                              onClick={() => clearSectionMaterials(sec.presetMaterials)}
                              className="text-[10px] font-bold text-stone-500 hover:text-rose-600 cursor-pointer"
                            >
                              إلغاء التحديد
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-1">
                            {sec.presetMaterials.map((mat) => {
                              const checked = suppliedMaterials.includes(mat);
                              return (
                                <label
                                  key={mat}
                                  className="flex items-center gap-1.5 text-[10px] font-bold text-stone-700 dark:text-stone-300 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleMaterial(sec.id, mat)}
                                    className="w-3.5 h-3.5 accent-[#EA580C] rounded cursor-pointer shrink-0"
                                  />
                                  <span className="truncate">{mat}</span>
                                </label>
                              );
                            })}
                          </div>

                          {/* Custom added material input */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={customMaterialDrafts[sec.id] || ''}
                              onChange={(e) =>
                                setCustomMaterialDrafts((prev) => ({
                                  ...prev,
                                  [sec.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomMaterial(sec.id);
                                }
                              }}
                              placeholder="أضف خامة أخرى غير مذكورة..."
                              className="flex-1 px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-[10px] font-bold outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddCustomMaterial(sec.id)}
                              className="px-2 py-1 rounded-lg bg-[#EA580C] text-white text-[10px] font-black flex items-center gap-0.5 cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة خامة</span>
                            </button>
                          </div>

                          {customForSection.length > 0 && isSecActive && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {customForSection.map((cm) => (
                                <button
                                  key={cm}
                                  type="button"
                                  onClick={() =>
                                    setSuppliedMaterials((prev) =>
                                      prev.filter((x) => x !== cm)
                                    )
                                  }
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/60 cursor-pointer"
                                  title="إزالة"
                                >
                                  {cm} ×
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
        <div className="p-3 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="agreeTermsCheckbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#D4CCBC] text-[#EA580C] focus:ring-[#EA580C] cursor-pointer accent-[#EA580C] shrink-0"
            />
            <label
              htmlFor="agreeTermsCheckbox"
              className="text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] leading-normal select-none"
            >
              {isSupplier
                ? 'أوافق على ميثاق موردي الخامات وحوكمة التجارة بمنظومة الشمساوية '
                : 'أوافق على سياسات وشروط وأحكام منظومة الشمساوية '}
              <button
                type="button"
                data-flat="true"
                onClick={() => setShowTermsModal(true)}
                className="text-[#C2410C] dark:text-amber-400 font-extrabold underline hover:text-[#EA580C] dark:hover:text-amber-300 cursor-pointer inline-block"
              >
                [اضغط للاطلاع على الشروط والأحكام]
              </button>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!agreeTerms || loading}
          className={`w-full py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md ${
            agreeTerms && !loading
              ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white shadow-orange-600/25 cursor-pointer'
              : 'bg-[#DFD7C6] dark:bg-[#132040] text-[#475569] dark:text-[#94A3B8] cursor-not-allowed opacity-75'
          }`}
          title={!agreeTerms ? 'يجب الموافقة على الشروط والأحكام أولاً' : 'إنشاء الحساب'}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {isSupplier ? <Truck size={15} /> : <Sparkles size={15} />}
              <span>
                {isSupplier
                  ? 'إنشاء متجر المورد والانضمام للمنظومة'
                  : 'إنشاء الورشة والانضمام للمنظومة'}
              </span>
            </>
          )}
        </button>
      </form>

      {/* Terms Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAgreeTerms(true)}
        accountRole={effectiveRole}
      />
    </div>
  );
};
