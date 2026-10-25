import React, { useState, useEffect } from 'react';
import { UserProfile, Gender, getDefaultFamilyNickname } from '../../types';
import { COUNTRIES_CONFIG, getGenderArtistTitle } from '../../utils/macrameMath';
import { tenantStorage } from '../../db/dexieDB';
import { updateWorkshopProfileInSupabase } from '../../db/supabaseService';
import { NumberInput } from '../ui/NumberInput';
import {
  SUPPORTED_LANGUAGES,
  LanguageCode,
  getStoredLanguage,
  setStoredLanguage,
  getStoredQuickLanguages,
  setStoredQuickLanguages,
} from '../../lib/i18n';
import {
  X,
  Building2,
  User,
  Upload,
  Globe,
  Share2,
  Check,
  AlertCircle,
  Facebook,
  Instagram,
  Youtube,
  ShoppingBag,
  ExternalLink,
  ShieldAlert,
  KeyRound,
  Trash2,
  AlertTriangle,
  Download,
  Database,
  Heart,
  Sparkles,
  Volume2,
  VolumeX,
  Bell,
  Clock,
  ShieldOff,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { isSoundEnabled, toggleSound, playSuccessSound, playErrorSound, playButtonClickSound } from '../../lib/sounds';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onFactoryResetDone?: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onFactoryResetDone,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'profile' | 'language' | 'reminders' | 'export_data' | 'factory_reset'>('profile');

  // Language settings state
  const [selectedAppLang, setSelectedAppLang] = useState<LanguageCode>(getStoredLanguage());
  const [quickSwitchLangs, setQuickSwitchLangs] = useState<LanguageCode[]>(getStoredQuickLanguages());

  useEffect(() => {
    if (isOpen) {
      setSelectedAppLang(getStoredLanguage());
      setQuickSwitchLangs(getStoredQuickLanguages());
    }
  }, [isOpen]);

  // Profile fields
  const [brandName, setBrandName] = useState(profile.brandName || '');
  const [artistName, setArtistName] = useState(profile.artistName || '');
  const [familyNickname, setFamilyNickname] = useState(
    profile.familyNickname || getDefaultFamilyNickname(profile.artistName, profile.gender)
  );
  const [gender, setGender] = useState<Gender>(profile.gender || 'female');
  const [countryName, setCountryName] = useState(profile.country || 'جمهورية مصر العربية');
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '');
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl || '');
  const [defaultWholesaleDiscountPercent, setDefaultWholesaleDiscountPercent] = useState<number>(
    profile.defaultWholesaleDiscountPercent ?? 25
  );
  const [enableDailySalesReminder, setEnableDailySalesReminder] = useState<boolean>(
    profile.enableDailySalesReminder ?? true
  );
  const [dailySalesReminderMode, setDailySalesReminderMode] = useState<'closing_offset' | 'fixed_time'>(
    profile.dailySalesReminderMode || 'closing_offset'
  );
  const [dailySalesReminderTime, setDailySalesReminderTime] = useState<string>(
    profile.dailySalesReminderTime || '20:00'
  );
  const [workshopClosingHour, setWorkshopClosingHour] = useState<string>(
    profile.workshopClosingHour || '21:00'
  );
  const [testReminderSent, setTestReminderSent] = useState<boolean>(false);

  // Data Export state
  const [exportingTarget, setExportingTarget] = useState<'local' | 'cloud' | null>(null);
  const [exportSuccessTarget, setExportSuccessTarget] = useState<'local' | 'cloud' | null>(null);
  const [exportError, setExportError] = useState('');

  // Socials
  const [activeSocials, setActiveSocials] = useState({
    facebook: Boolean(profile.socials?.facebook),
    instagram: Boolean(profile.socials?.instagram),
    tiktok: Boolean(profile.socials?.tiktok),
    youtube: Boolean(profile.socials?.youtube),
    store: Boolean(profile.socials?.store),
    website: Boolean(profile.socials?.website),
  });

  const [socialUrls, setSocialUrls] = useState({
    facebook: profile.socials?.facebook || '',
    instagram: profile.socials?.instagram || '',
    tiktok: profile.socials?.tiktok || '',
    youtube: profile.socials?.youtube || '',
    store: profile.socials?.store || '',
    website: profile.socials?.website || '',
  });

  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  // Sound preference state
  const [soundActive, setSoundActive] = useState<boolean>(() => isSoundEnabled());

  const handleToggleSound = () => {
    const next = toggleSound();
    setSoundActive(next);
  };

  // Factory reset state
  const [resetPassword, setResetPassword] = useState('');
  const [resetReason, setResetReason] = useState('بدء دورة مالية جديدة وتصفير المخزون');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const currentCountryConfig =
    COUNTRIES_CONFIG.find((c) => c.name === countryName) || COUNTRIES_CONFIG[0];

  const handleCountryChange = (newCountryName: string) => {
    setCountryName(newCountryName);
    const cfg = COUNTRIES_CONFIG.find((c) => c.name === newCountryName);
    if (cfg && (!phoneNumber || phoneNumber.startsWith('+'))) {
      setPhoneNumber(cfg.callingCode);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Enforce max dimension <= 256px
        const maxDim = 256;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Ensure <= 150KB (150 * 1024 = 153,600 bytes)
          let compressed = canvas.toDataURL('image/png');
          if (compressed.length > 150 * 1024 * 1.37) {
            compressed = canvas.toDataURL('image/jpeg', 0.85);
          }
          if (compressed.length > 150 * 1024 * 1.37) {
            compressed = canvas.toDataURL('image/jpeg', 0.65);
          }
          setLogoUrl(compressed);
        } else {
          setLogoUrl(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setValidationError('');
    if (!brandName.trim()) {
      setValidationError('اسم البراند مطلوب');
      return;
    }
    if (!artistName.trim()) {
      setValidationError('اسم الفنان / الفنانة مطلوب');
      return;
    }

    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly.length < currentCountryConfig.phoneLength - 2) {
      setValidationError(
        `يرجى كتابة رقم هاتف صالح لدولة ${currentCountryConfig.name} (${currentCountryConfig.phoneLength} أرقام)`
      );
      return;
    }

    setSaving(true);
    try {
      const workshopId = profile.id || profile.workshopId || profile.tenantId || '';

      const settingsPayload = {
        defaultWholesaleDiscountPercent: Number(defaultWholesaleDiscountPercent) || 25,
        enableDailySalesReminder,
        dailySalesReminderMode,
        dailySalesReminderTime,
        workshopClosingHour,
        socials: {
          facebook: activeSocials.facebook ? socialUrls.facebook.trim() : undefined,
          instagram: activeSocials.instagram ? socialUrls.instagram.trim() : undefined,
          tiktok: activeSocials.tiktok ? socialUrls.tiktok.trim() : undefined,
          youtube: activeSocials.youtube ? socialUrls.youtube.trim() : undefined,
          store: activeSocials.store ? socialUrls.store.trim() : undefined,
          website: activeSocials.website ? socialUrls.website.trim() : undefined,
        },
      };

      // Only update allowed fields: brand_name, artist_name, gender, family_name,
      // country, currency, phone, selected_crafts, settings, logo_data, welcome_shown
      const { updated, error } = await updateWorkshopProfileInSupabase(workshopId, {
        brandName: brandName.trim(),
        artistName: artistName.trim(),
        gender,
        familyName: familyNickname.trim() || getDefaultFamilyNickname(artistName.trim(), gender),
        country: currentCountryConfig.name,
        currency: currentCountryConfig.currency,
        phone: phoneNumber.trim(),
        selectedCrafts: profile.selectedCrafts || ['macrame'],
        settings: settingsPayload,
        logoData: logoUrl || '',
        welcomeShown: profile.welcomeShown,
      });

      if (error) {
        playErrorSound();
        setValidationError(error.arabicMessage);
        return;
      }

      if (updated) {
        updated.enableDailySalesReminder = enableDailySalesReminder;
        updated.dailySalesReminderMode = dailySalesReminderMode;
        updated.dailySalesReminderTime = dailySalesReminderTime;
        updated.workshopClosingHour = workshopClosingHour;
        await tenantStorage.saveProfile(updated);
        await tenantStorage.generateProactiveNotifications(workshopId, updated);
        playSuccessSound();
        onProfileUpdated(updated);
        setSuccessNotice(true);
        setTimeout(() => {
          setSuccessNotice(false);
          onClose();
        }, 900);
      }
    } catch (err: any) {
      playErrorSound();
      setValidationError(err?.message || 'حدث خطأ أثناء حفظ الملف');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestReminder = async () => {
    try {
      const tid = profile.tenantId || profile.workshopId || profile.id || 'default';
      const now = Date.now();
      const tempProfile: UserProfile = {
        ...profile,
        enableDailySalesReminder: true,
        dailySalesReminderMode,
        dailySalesReminderTime,
        workshopClosingHour,
      };
      await tenantStorage.saveProfile(tempProfile);

      const title =
        dailySalesReminderMode === 'closing_offset'
          ? `📊 [تجريبي] تذكير قبل إغلاق الورشة (${workshopClosingHour})`
          : `📊 [تجريبي] تذكير مجدول (${dailySalesReminderTime})`;

      const message =
        dailySalesReminderMode === 'closing_offset'
          ? `إشعار تجريبي: متبقي ساعة على موعد إغلاق الورشة المعتاد (${workshopClosingHour}). راجع مبيعات اليوم ومطابقة حركة الخزينة.`
          : `إشعار تجريبي: حان موعد التذكير اليومي المحدد في ${dailySalesReminderTime} لمراجعة وتدقيق مبيعات الورشة وفواتير العملاء.`;

      await tenantStorage.putNotification({
        id: `notif_daily_sales_test_${now}`,
        tenantId: tid,
        type: 'daily_sales_reminder',
        title,
        message,
        isRead: false,
        createdAt: now,
      });

      setTestReminderSent(true);
      playSuccessSound();
      setTimeout(() => setTestReminderSent(false), 4000);
    } catch (e) {
      console.error('Error sending test reminder:', e);
    }
  };

  const handleExportData = async (storageTarget: 'local' | 'cloud') => {
    playButtonClickSound();
    setExportError('');
    setExportingTarget(storageTarget);
    try {
      const tid = profile.tenantId || profile.workshopId || profile.id;
      const [
        treasuryTransactions,
        customers,
        suppliers,
        supplierInvoices,
        materials,
        inventoryTransactions,
        invoices,
        employees,
        payouts,
        products,
      ] = await Promise.all([
        tenantStorage.getSafeTransactions(tid).catch(() => []),
        tenantStorage.getCustomers(tid).catch(() => []),
        tenantStorage.getSuppliers(tid).catch(() => []),
        tenantStorage.getSupplierInvoices(tid).catch(() => []),
        tenantStorage.getRawMaterials(tid).catch(() => []),
        tenantStorage.getInventoryTransactions(tid).catch(() => []),
        tenantStorage.getOrders(tid).catch(() => []),
        tenantStorage.getEmployees(tid).catch(() => []),
        tenantStorage.getEmployeePayouts(tid).catch(() => []),
        tenantStorage.getProducts(tid).catch(() => []),
      ]);

      const backupData = {
        exportTarget: storageTarget,
        storageType: storageTarget === 'local' ? 'محلياً' : 'سحابياً',
        exportedAt: new Date().toISOString(),
        workshopId: tid,
        brandName: profile.brandName,
        profile,
        treasuryTransactions,
        customers,
        suppliers,
        supplierInvoices,
        rawMaterials: materials,
        inventoryTransactions,
        orders: invoices,
        employees,
        payouts,
        products,
      };

      const dataBlob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/octet-stream',
      });
      const downloadUrl = URL.createObjectURL(dataBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      const targetLabel = storageTarget === 'local' ? 'local' : 'cloud';
      downloadAnchor.download = `alshams_craft_backup_${targetLabel}_${(profile.brandName || 'workshop').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.bak`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(downloadUrl);

      playSuccessSound();
      setExportSuccessTarget(storageTarget);
      setTimeout(() => setExportSuccessTarget(null), 3500);
    } catch (err: any) {
      console.error('Backup export failed:', err);
      playErrorSound();
      setExportError(err.message || 'فشل تصدير البيانات، يرجى إعادة المحاولة.');
    } finally {
      setExportingTarget(null);
    }
  };

  const handleExecuteFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    try {
      if (!resetPassword) {
        throw new Error('يرجى كتابة كلمة مرور حسابك النشط لتأكيد الهوية.');
      }
      if (!resetReason.trim() || resetReason.trim().length < 5) {
        throw new Error('يرجى كتابة سبب معتمد وموثق للتصفير.');
      }

      await tenantStorage.wipeDatabaseWithAuth(
        profile.tenantId || profile.workshopId || profile.id,
        resetPassword,
        resetReason,
        profile.email
      );

      setResetSuccess(true);
      setTimeout(() => {
        if (onFactoryResetDone) onFactoryResetDone();
        onClose();
      }, 1500);
    } catch (err: any) {
      setResetError(err.message || 'فشلت عملية التصفير');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 p-5 sm:p-7 relative text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">
              إعدادات البراند وملف {getGenderArtistTitle(gender)}
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              تخصيص الهوية التجارية واللوجو الخاص، وإدارة أمان المنظومة
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveTab('profile');
            }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            البيانات الأساسية للفنان
          </button>
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveTab('language');
            }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'language'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>اللغة وتعدد اللغات</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveTab('reminders');
            }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'reminders'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>التنبيهات اليومية</span>
            {enableDailySalesReminder && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveTab('export_data');
            }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'export_data'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير البيانات</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveTab('factory_reset');
            }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'factory_reset'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>تصفير قاعدة البيانات</span>
          </button>
        </div>

        {/* Alerts */}
        {validationError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {successNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-bold">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>تم حفظ التعديلات وتحديث هوية البراند بنجاح!</span>
          </div>
        )}

        {/* TAB 1: ARTISAN PROFILE */}
        {activeTab === 'profile' && (
          <div className="mt-4 space-y-5">
            {/* Logo Upload Section - STRICT SYSTEM ASSETS ISOLATION */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="لوجو البراند"
                    className="w-16 h-16 rounded-2xl object-contain bg-stone-100 dark:bg-stone-800 p-1 border-2 border-amber-500 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center border-2 border-dashed border-amber-400 text-amber-600 dark:text-amber-400 font-black text-xl">
                    {artistName.charAt(0) || 'ف'}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    تحميل لوجو البراند الخاص بك
                  </p>
                  <p className="text-[11px] text-stone-500">
                    اختر صورة شعار متجرك الفردي ليظهر في عروض أسعار الواتساب والفواتير
                  </p>
                </div>
              </div>

              <label className="px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-amber-500/50 text-amber-700 dark:text-amber-300 text-xs font-bold shadow-xs hover:bg-amber-50 cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>تحميل لوجو البراند الخاص بك</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  اسم البراند / المشغل *
                </label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="اسم البراند التجاري"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:placeholder-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  اسم الفنان / الفنانة *
                </label>
                <input
                  type="text"
                  required
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="الاسم الكريم"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:placeholder-transparent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>اسمك في العيلة (اختياري)</span>
                </label>
                <input
                  type="text"
                  value={familyNickname}
                  onChange={(e) => setFamilyNickname(e.target.value)}
                  placeholder={getDefaultFamilyNickname(artistName, gender)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  الاسم أو اللقب المحبب لك داخل عيلة الشمساوية (الافتراضي: {gender === 'female' ? 'الاسم الأول + الشمساوية' : 'الاسم الأول + الشمساوي'}).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  الدولة والعملة المعتمدة
                </label>
                <select
                  value={countryName}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                >
                  {COUNTRIES_CONFIG.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.flag} {c.name} ({c.currencySymbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  رقم الهاتف المعتمد
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="رقم الهاتف"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 text-left focus:placeholder-transparent"
                  dir="ltr"
                />
              </div>

              {/* Wholesale margin discount percent */}
              <div className="sm:col-span-2 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60">
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  نسبة الخصم من هامش الربح لحساب سعر الجملة (%) (افتراضي 25%)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1.5">
                  <div className="w-full sm:w-36">
                    <NumberInput
                      value={defaultWholesaleDiscountPercent}
                      onChange={(v) => setDefaultWholesaleDiscountPercent(v)}
                      placeholder="25"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    * تُخصم هذه النسبة من هامش الربح الصافي فقط عند حساب سعر الجملة مع حماية وضمان تغطية كافة تكاليف الخامات وأجور اليد العاملة.
                  </span>
                </div>
              </div>

              {/* Sound preference (Web Audio API) */}
              <div className="sm:col-span-2 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl transition ${
                      soundActive
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {soundActive ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      أصوات الورشة التفاعلية
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      نغمات هادئة فورية (ترحيب، تنبيه، نجاح، خطأ، تقليب صفحات) بدون أي ملفات خارجية
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    soundActive
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/20'
                      : 'bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200'
                  }`}
                >
                  {soundActive ? (
                    <>
                      <Volume2 size={15} />
                      <span>مفعلة</span>
                    </>
                  ) : (
                    <>
                      <VolumeX size={15} />
                      <span>مكتومة</span>
                    </>
                  )}
                </button>
              </div>

              {/* Daily Sales Reminder Preference */}
              <div className="sm:col-span-2 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl transition ${
                      enableDailySalesReminder
                        ? 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-400'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    <Bell size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      تنبيه مراجعة مبيعات اليوم
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      إشعار تذكيري يومي في شريط التنبيهات لتذكيرك بمراجعة مبيعات اليوم وتدقيق الحسابات قبل إغلاق النظام
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableDailySalesReminder((prev) => !prev)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    enableDailySalesReminder
                      ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20'
                      : 'bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200'
                  }`}
                >
                  <Bell size={15} />
                  <span>{enableDailySalesReminder ? 'مفعّل' : 'معطّل'}</span>
                </button>
              </div>
            </div>

            {/* Social channels */}
            <div className="pt-2">
              <span className="block text-xs font-bold mb-2 text-stone-700 dark:text-stone-300">
                منصات التواصل والمتاجر (حدد ليظهر حقل الرابط)
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                {[
                  { key: 'facebook', label: 'فيسبوك' },
                  { key: 'instagram', label: 'إنستجرام' },
                  { key: 'tiktok', label: 'تيك توك' },
                  { key: 'youtube', label: 'يوتيوب' },
                  { key: 'store', label: 'المتجر الإلكتروني' },
                  { key: 'website', label: 'الموقع الرسمي' },
                ].map((s) => (
                  <label
                    key={s.key}
                    className={`px-3 py-1.5 rounded-xl border cursor-pointer select-none transition ${
                      (activeSocials as any)[s.key]
                        ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={(activeSocials as any)[s.key]}
                      onChange={(e) =>
                        setActiveSocials((prev) => ({ ...prev, [s.key]: e.target.checked }))
                      }
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>

              {/* Dynamic URL Inputs */}
              <div className="mt-3 space-y-2">
                {activeSocials.instagram && (
                  <input
                    type="url"
                    value={socialUrls.instagram}
                    onChange={(e) => setSocialUrls((p) => ({ ...p, instagram: e.target.value }))}
                    placeholder="https://instagram.com/your_macrame_art"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 focus:placeholder-transparent"
                    dir="ltr"
                  />
                )}
                {activeSocials.facebook && (
                  <input
                    type="url"
                    value={socialUrls.facebook}
                    onChange={(e) => setSocialUrls((p) => ({ ...p, facebook: e.target.value }))}
                    placeholder="https://facebook.com/your_page"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 focus:placeholder-transparent"
                    dir="ltr"
                  />
                )}
                {activeSocials.store && (
                  <input
                    type="url"
                    value={socialUrls.store}
                    onChange={(e) => setSocialUrls((p) => ({ ...p, store: e.target.value }))}
                    placeholder="https://salla.sa/your_brand أو متجر خاص"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 focus:placeholder-transparent"
                    dir="ltr"
                  />
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-500"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveProfile}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>حفظ بيانات الفنان والبراند</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB: LANGUAGE & MULTI-LINGUAL SETTINGS */}
        {activeTab === 'language' && (
          <div className="mt-4 space-y-5">
            {/* Header Box */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    تعدد اللغات والتبديل السريع
                  </h3>
                  <p className="text-xs text-stone-500">
                    اختر لغة الواجهة الأساسية واللغات المفضلة المعروضة في شريط الأدوات العلوي
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Main Application Language */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-stone-900 dark:text-stone-100">
                  لغة التطبيق النشطة حالياً:
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === selectedAppLang)?.nativeName} ({selectedAppLang.toUpperCase()})
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-black text-stone-400 dark:text-stone-500">
                  اللغات الأساسية المعتمدة:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {SUPPORTED_LANGUAGES.filter((l) => l.isPrimary).map((lang) => {
                    const isSelected = selectedAppLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setSelectedAppLang(lang.code)}
                        className={`p-3 rounded-2xl border text-right transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 font-black shadow-xs'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{lang.flag}</span>
                          <div>
                            <span className="text-xs font-black block">{lang.nativeName}</span>
                            <span className="text-[10px] text-stone-400 block">{lang.name}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-stone-200/60 dark:border-stone-700/60">
                <div className="text-[11px] font-black text-stone-400 dark:text-stone-500">
                  خيارات لغات أخرى:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SUPPORTED_LANGUAGES.filter((l) => !l.isPrimary).map((lang) => {
                    const isSelected = selectedAppLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setSelectedAppLang(lang.code)}
                        className={`p-2.5 rounded-2xl border text-right transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 font-black shadow-xs'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{lang.flag}</span>
                          <div>
                            <span className="text-xs font-bold block">{lang.nativeName}</span>
                            <span className="text-[10px] text-stone-400 block">{lang.name}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 2: Quick Switch Selection */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3">
              <div>
                <span className="text-xs font-black text-stone-900 dark:text-stone-100 block">
                  لغات التبديل السريع في القائمة العلوية (2 أو 3 لغات):
                </span>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  هذه اللغات ستظهر كأزرار تبديل فوري بنقرة واحدة بجوار زر البحث الموحد في أعلى الشاشة.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isChecked = quickSwitchLangs.includes(lang.code);
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          if (quickSwitchLangs.length <= 2) return;
                          setQuickSwitchLangs(quickSwitchLangs.filter((c) => c !== lang.code));
                        } else {
                          if (quickSwitchLangs.length >= 3) {
                            setQuickSwitchLangs([...quickSwitchLangs.slice(1), lang.code]);
                          } else {
                            setQuickSwitchLangs([...quickSwitchLangs, lang.code]);
                          }
                        }
                      }}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{lang.flag}</span>
                        <span>{lang.nativeName}</span>
                      </span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Language Button */}
            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setStoredLanguage(selectedAppLang);
                  setStoredQuickLanguages(quickSwitchLangs);
                  playSuccessSound();
                  setSuccessNotice(true);
                  setTimeout(() => setSuccessNotice(false), 3000);
                }}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>حفظ وتطبيق إعدادات اللغة</span>
              </button>
            </div>
          </div>
        )}
        {activeTab === 'reminders' && (
          <div className="mt-4 space-y-5">
            {/* Main Toggle Banner */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                enableDailySalesReminder
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                  : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                      enableDailySalesReminder
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                        تنبيه مراجعة مبيعات اليوم اليومي
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          enableDailySalesReminder
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                        }`}
                      >
                        {enableDailySalesReminder ? 'مفعّل بالنظام 🟢' : 'معطّل نهائياً 🔴'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      إشعار ذكي يظهر في شريط التنبيهات (NotificationDrawer) لتذكيرك بمراجعة فواتير اليوم ومطابقة الخزينة قبل إغلاق النظام
                    </p>
                  </div>
                </div>

                {/* زر التعطيل أو التفعيل الفوري */}
                {enableDailySalesReminder ? (
                  <button
                    type="button"
                    onClick={() => setEnableDailySalesReminder(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <ShieldOff className="w-4 h-4 text-rose-500" />
                    <span>[زر تعطيل التنبيه نهائياً من النظام]</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEnableDailySalesReminder(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <Check className="w-4 h-4" />
                    <span>[زر إعادة تفعيل التنبيه اليومي]</span>
                  </button>
                )}
              </div>
            </div>

            {/* تفاصيل التردد والتوقيت (تظهر عند التفعيل فقط) */}
            {enableDailySalesReminder ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 space-y-3">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>تحديد تردد وتوقيت إرسال التنبيه اليومي:</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* الخيار الأول: قبل موعد إغلاق الورشة بساعة */}
                    <div
                      onClick={() => setDailySalesReminderMode('closing_offset')}
                      className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-2 ${
                        dailySalesReminderMode === 'closing_offset'
                          ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="reminderMode"
                            checked={dailySalesReminderMode === 'closing_offset'}
                            onChange={() => setDailySalesReminderMode('closing_offset')}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span>قبل إغلاق الورشة بساعة</span>
                        </span>
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
                          موصى به
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                        يتم تنبيهك قبل موعد إغلاق الورشة المعتاد بـ 60 دقيقة لإنهاء تسجيل الفواتير والمقبوضات.
                      </p>

                      {dailySalesReminderMode === 'closing_offset' && (
                        <div className="pt-2 border-t border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                          <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                            موعد إغلاق الورشة:
                          </label>
                          <input
                            type="time"
                            value={workshopClosingHour}
                            onChange={(e) => setWorkshopClosingHour(e.target.value)}
                            className="px-2.5 py-1 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>

                    {/* الخيار الثاني: وقت ثابت ومحدد */}
                    <div
                      onClick={() => setDailySalesReminderMode('fixed_time')}
                      className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-2 ${
                        dailySalesReminderMode === 'fixed_time'
                          ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="reminderMode"
                            checked={dailySalesReminderMode === 'fixed_time'}
                            onChange={() => setDailySalesReminderMode('fixed_time')}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span>وقت ثابت ومحدد يومياً</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                        يتم إرسال التنبيه في موعد ثابت تحدده بدقة كل مساء بغض النظر عن ساعات الدوام.
                      </p>

                      {dailySalesReminderMode === 'fixed_time' && (
                        <div className="pt-2 border-t border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                          <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                            ساعة التنبيه الثابتة:
                          </label>
                          <input
                            type="time"
                            value={dailySalesReminderTime}
                            onChange={(e) => setDailySalesReminderTime(e.target.value)}
                            className="px-2.5 py-1 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* معاينة وتجربة التنبيه فوراً */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      معاينة الإشعار في شريط التنبيهات
                    </p>
                    <p className="text-[11px] text-stone-500">
                      اضغط لاختبار ظهور الإشعار في جرس التنبيهات والتأكد من مطابقة الصيغة
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestReminder}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-600" />
                    <span>إرسال إشعار تجريبي الآن</span>
                  </button>
                </div>

                {testReminderSent && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>تم إرسال إشعار تجريبي بنجاح! تفقّد جرس الإشعارات في شريط الـ Navbar العلوي.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-stone-50 dark:bg-stone-800/30 border border-dashed border-stone-300 dark:border-stone-700 text-center space-y-2">
                <ShieldOff className="w-8 h-8 text-stone-400 mx-auto" />
                <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  تم تعطيل التنبيه اليومي لمراجعة المبيعات
                </h4>
                <p className="text-[11px] text-stone-500 max-w-md mx-auto">
                  لن يظهر أي تنبيه يومي لمراجعة المبيعات في جرس الإشعارات. يمكنك إعادة تفعيله في أي وقت بضغطة واحدة من الزر أعلاه.
                </p>
              </div>
            )}

            {/* Save Button for Reminders Tab */}
            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-500"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveProfile}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>حفظ وتطبيق إعدادات التنبيهات</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: DATA EXPORT (تصدير البيانات) */}
        {activeTab === 'export_data' && (
          <div className="mt-4 space-y-4">
            <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-stone-800 dark:text-stone-200 space-y-3">
              <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
                <Database className="w-5 h-5 flex-shrink-0" />
                <h3 className="font-black text-sm">
                  أداة تصدير البيانات للورشة
                </h3>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                تتيح لصاحب الورشة تحميل وحفظ نسخة آمنة من أرشيف مبيعاته ومنتجاته وسجلاته لضمان الأمان والخصوصية وسهولة حفظ نسخة احتياطية من كافة أنشطة المنظومة.
              </p>
            </div>

            {exportSuccessTarget && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>
                  {exportSuccessTarget === 'local'
                    ? 'تم تصدير وتحميل بيانات الورشة (نوع التخزين: محلياً) بنجاح على جهازك!'
                    : 'تم تصدير وتحميل بيانات الورشة (نوع التخزين: سحابياً) بنجاح على جهازك!'}
                </span>
              </div>
            )}

            {exportError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            {/* Storage Export Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* خيار التخزين المحلي */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 flex flex-col justify-between gap-3 shadow-2xs hover:border-amber-400 transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black text-[10px]">
                      نوع التخزين: محلياً
                    </span>
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h4 className="text-xs font-black text-stone-900 dark:text-stone-100">
                    تصدير بيانات التخزين المحلي
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed font-medium">
                    تحميل وتصدير نسخة آمنة من أرشيف المبيعات والمنتجات والخامات المحفوظة محلياً على هذا الجهاز لضمان الخصوصية والعمل دون انقطاع.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportData('local')}
                  disabled={exportingTarget !== null}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {exportingTarget === 'local' ? (
                    <span>جاري تجهيز التصدير...</span>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل نسخة (نوع التخزين: محلياً)</span>
                    </>
                  )}
                </button>
              </div>

              {/* خيار التخزين السحابي */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 flex flex-col justify-between gap-3 shadow-2xs hover:border-amber-400 transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-black text-[10px]">
                      نوع التخزين: سحابياً
                    </span>
                    <Download className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h4 className="text-xs font-black text-stone-900 dark:text-stone-100">
                    تصدير بيانات التخزين السحابي
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed font-medium">
                    تحميل وتصدير نسخة متزامنة من كافة سجلات الورشة والفواتير وحسابات العملاء والموردين لضمان استمرارية العمل ومشاركة السجلات.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportData('cloud')}
                  disabled={exportingTarget !== null}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {exportingTarget === 'cloud' ? (
                    <span>جاري تجهيز التصدير...</span>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل نسخة (نوع التخزين: سحابياً)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Package Contents Breakdown */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 space-y-2">
              <span className="text-xs font-black text-stone-700 dark:text-stone-300 block">
                محتويات حزمة تصدير البيانات:
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-600 dark:text-stone-400 font-medium list-disc list-inside">
                <li>بيانات البراند وهوية المشغل واللقب العائلي</li>
                <li>سجلات الخزن النقدية وحركاتها المالية</li>
                <li>أرشيف المبيعات والطلبيات وكشوف العملاء</li>
                <li>سجلات الموردين وفواتير الشراء</li>
                <li>أرصدة الخامات وتكاليف الـ WAC</li>
                <li>أوامر التشغيل وتتبع الهالك</li>
                <li>ملفات العمال والسلف وكشوف الرواتب</li>
                <li>أرشيف المنتجات الجاهزة والمسعرة</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: FACTORY RESET (تصفير قاعدة البيانات المحمي بكلمة المرور) */}
        {activeTab === 'factory_reset' && (
          <form onSubmit={handleExecuteFactoryReset} className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-black text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>تنبيه أمني شديد الحساسية: تصفير قاعدة البيانات الشامل</span>
              </div>
              <p className="leading-relaxed">
                هذا الإجراء سيقوم بحذف كافة طلبيات المبيعات، أصول الخامات المخزنية، فواتير التوريد، كشوفات العملاء، مستحقات العمالة، وحركات الخزينة تماماً والعودة لنقطة الصفر المطلق. لا يمكن التراجع عن هذه العملية!
              </p>
            </div>

            {resetError && (
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>تم تصفير كافة الجداول بنجاح والعودة لحالة المصنع النظيفة!</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                سبب التصفير المعتمد *
              </label>
              <input
                type="text"
                required
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="مثال: بدء دورة مالية جديدة للعام أو جرد شامل"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                كلمة مرور حسابك النشط للتأكيد الأمني *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور المسجلة بحسابك"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-stone-800 font-mono text-xs font-bold outline-none text-left"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                تطابق كلمة المرور شرط إلزامي لمنع التصفير العرضي أو غير المصرح به.
              </span>
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-500"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {resetLoading ? (
                  <span>جاري التحقق والتصفير...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد تصفير البيانات والعودة للصفر</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
