import React, { useState } from 'react';
import { AlShamsBrandLogo } from '../brand/BrandAssets';
import { Gender, UserProfile } from '../../types';
import { MainSectionId } from '../../registry/craftsRegistry';
import {
  SUPPLIER_SUPPLY_SECTIONS,
  SupplierBusinessType,
  SupplierPricingMode,
} from '../../types/supplier';
import { useFeatureFlags } from '../../types/featureFlags';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { createMyWorkshopRpc } from '../../db/supabaseService';
import { registerSupplierAccount } from '../../db/supplierService';
import { TermsModal } from './TermsModal';
import {
  Sparkles,
  Building2,
  User,
  Phone,
  AlertCircle,
  LogOut,
  Truck,
  MapPin,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CompleteWorkshopScreenProps {
  userEmail: string;
  initialArtistName?: string;
  initialAccountRole?: 'artisan' | 'supplier';
  onWorkshopCreated: (profile: UserProfile) => void;
  onLogout: () => void;
}

export const CompleteWorkshopScreen: React.FC<CompleteWorkshopScreenProps> = ({
  userEmail,
  initialArtistName,
  initialAccountRole = 'artisan',
  onWorkshopCreated,
  onLogout,
}) => {
  const flags = useFeatureFlags();
  const [accountRole, setAccountRole] = useState<'artisan' | 'supplier'>(
    flags.supplierRegistrationEnabled ? initialAccountRole : 'artisan'
  );
  const effectiveRole: 'artisan' | 'supplier' = flags.supplierRegistrationEnabled
    ? accountRole
    : 'artisan';
  const isSupplier = effectiveRole === 'supplier';

  const [brandName, setBrandName] = useState('');
  const [artistName, setArtistName] = useState(
    initialArtistName?.trim() || userEmail.split('@')[0] || ''
  );
  const [gender, setGender] = useState<Gender>('female');
  const [countryCode, setCountryCode] = useState('EG');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [businessTypes, setBusinessTypes] = useState<SupplierBusinessType[]>(['online']);
  const [pricingModes, setPricingModes] = useState<SupplierPricingMode[]>(['both']);
  const [supplySections, setSupplySections] = useState<MainSectionId[]>(['ropes_textiles']);
  const [suppliedMaterials, setSuppliedMaterials] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<MainSectionId>('ropes_textiles');
  const [customMaterialDraft, setCustomMaterialDraft] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedCountry =
    COUNTRIES_CONFIG.find((c) => c.code === countryCode) || COUNTRIES_CONFIG[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!brandName.trim()) {
      setErrorMsg(isSupplier ? 'يرجى كتابة اسم متجر المورد.' : 'يرجى كتابة اسم البراند أو الورشة.');
      return;
    }
    if (!artistName.trim()) {
      setErrorMsg(isSupplier ? 'يرجى كتابة اسم المالك أو المسؤول.' : 'يرجى كتابة اسم الفنان أو الفنانة.');
      return;
    }

    if (isSupplier) {
      if (!governorate.trim()) {
        setErrorMsg('يرجى كتابة المحافظة أو المدينة.');
        return;
      }
      if (supplySections.length === 0) {
        setErrorMsg('يرجى اختيار قسم واحد على الأقل من أقسام الخامات.');
        return;
      }
      if (!agreeTerms) {
        setErrorMsg('يجب الموافقة على ميثاق موردي الخامات للمتابعة.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSupplier) {
        const res = await registerSupplierAccount({
          brandName: brandName.trim(),
          ownerName: artistName.trim(),
          gender,
          phone: phoneNumber.trim(),
          email: userEmail,
          country: selectedCountry.name,
          governorate: governorate.trim(),
          currency: selectedCountry.currency,
          currencySymbol: selectedCountry.currencySymbol,
          businessTypes,
          pricingModes,
          supplySections,
          suppliedMaterials,
        });
        if (!res.success || !res.profile) {
          setErrorMsg(res.error || 'تعذر إنشاء حساب المورد.');
          return;
        }
        onWorkshopCreated(res.profile);
        return;
      }

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
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ البيانات.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-amber-200/80 dark:border-stone-800 p-6 sm:p-8 space-y-5 text-right relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <AlShamsBrandLogo size="md" />
          <h2 className="text-base font-black text-amber-950 dark:text-amber-300">
            {isSupplier ? 'إكمال بيانات حساب المورد' : 'إكمال بيانات الورشة'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            مرحباً بك ({userEmail})! حدد نوع نشاطك وأكمل البيانات الأساسية للانطلاق.
          </p>
        </div>

        {flags.supplierRegistrationEnabled && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setAccountRole('artisan')}
              className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                !isSupplier
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ورشة فنان</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountRole('supplier')}
              className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isSupplier
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>مورد خامات</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  placeholder={isSupplier ? 'مثال: الشروق للخامات' : 'مثال: شمس مكرامي'}
                  className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
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
                  placeholder="مثال: ياسمين أحمد"
                  className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
                <User className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
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
                  {isSupplier ? 'موردة' : 'فنانة (مبدعة)'}
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
                  {isSupplier ? 'مورد' : 'فنان (مبدع)'}
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

          <div className={`grid grid-cols-1 ${isSupplier ? 'sm:grid-cols-2' : ''} gap-3`}>
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
                    placeholder="مثال: القاهرة"
                    className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <MapPin className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {isSupplier && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black">نوع النشاط:</span>
                <div className="flex gap-1.5">
                  {[
                    { id: 'online' as const, label: 'أونلاين' },
                    { id: 'shop' as const, label: 'محل' },
                    { id: 'factory' as const, label: 'مصنع' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setBusinessTypes((prev) =>
                          prev.includes(b.id)
                            ? prev.length > 1
                              ? prev.filter((x) => x !== b.id)
                              : prev
                            : [...prev, b.id]
                        )
                      }
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                        businessTypes.includes(b.id)
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black">نظام البيع:</span>
                <div className="flex gap-1.5">
                  {[
                    { id: 'retail' as const, label: 'قطاعي' },
                    { id: 'wholesale' as const, label: 'جملة' },
                    { id: 'both' as const, label: 'جملة وقطاعي' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPricingModes([p.id])}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                        pricingModes.includes(p.id)
                          ? 'bg-stone-900 dark:bg-amber-600 text-white border-transparent'
                          : 'bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {SUPPLIER_SUPPLY_SECTIONS.map((sec) => {
                  const active = supplySections.includes(sec.id);
                  const expanded = expandedSection === sec.id;
                  return (
                    <div
                      key={sec.id}
                      className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-2"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setSupplySections((prev) =>
                              prev.includes(sec.id)
                                ? prev.filter((x) => x !== sec.id)
                                : [...prev, sec.id]
                            );
                            setExpandedSection(sec.id);
                          }}
                          className="flex items-center gap-2 text-xs font-black cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              active
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-stone-400'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                          </span>
                          <span>{sec.titleAr}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedSection(expanded ? ('' as any) : sec.id)}
                          className="p-1 text-stone-500 cursor-pointer"
                        >
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {expanded && (
                        <div className="mt-2 pt-2 border-t border-stone-200 dark:border-stone-800 space-y-1.5">
                          {sec.presetMaterials.slice(0, 6).map((m) => (
                            <label key={m} className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={suppliedMaterials.includes(m)}
                                onChange={() => {
                                  if (!supplySections.includes(sec.id)) {
                                    setSupplySections((prev) => [...prev, sec.id]);
                                  }
                                  setSuppliedMaterials((prev) =>
                                    prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                                  );
                                }}
                                className="accent-amber-600"
                              />
                              <span className="truncate">{m}</span>
                            </label>
                          ))}
                          <div className="flex gap-1 pt-1">
                            <input
                              type="text"
                              value={customMaterialDraft}
                              onChange={(e) => setCustomMaterialDraft(e.target.value)}
                              placeholder="إضافة خامة مخصصة..."
                              className="flex-1 px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 text-[10px] font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = customMaterialDraft.trim();
                                if (!val) return;
                                if (!supplySections.includes(sec.id)) {
                                  setSupplySections((prev) => [...prev, sec.id]);
                                }
                                setSuppliedMaterials((prev) =>
                                  prev.includes(val) ? prev : [...prev, val]
                                );
                                setCustomMaterialDraft('');
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="accent-amber-600 w-4 h-4"
                />
                <span>
                  أوافق على{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-amber-700 dark:text-amber-400 underline font-black cursor-pointer"
                  >
                    ميثاق وشروط موردي الخامات
                  </button>
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isSupplier && !agreeTerms)}
            className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isSupplier ? <Truck className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                <span>{isSupplier ? 'حفظ وتفعيل متجر المورد' : 'حفظ وتفعيل الورشة'}</span>
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

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAgreeTerms(true)}
        accountRole={effectiveRole}
      />
    </div>
  );
};
