import React, { useState, useEffect } from 'react';
import {
  Mic,
  Bell,
  MapPin,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  X,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  checkBrowserPermissions,
  requestMicrophonePermission,
  requestNotificationPermission,
  requestGeolocationPermission,
  requestPersistentStorage,
  dispatchArtisanNotification,
  BrowserPermissionsState,
} from '../../lib/pushNotifications';
import { playSuccessSound, playNotificationChimeSound } from '../../lib/sounds';

interface PermissionsOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInitialOnboarding?: boolean;
}

export const PermissionsOnboardingModal: React.FC<PermissionsOnboardingModalProps> = ({
  isOpen,
  onClose,
  isInitialOnboarding = false,
}) => {
  const [permissions, setPermissions] = useState<BrowserPermissionsState>({
    notifications: 'unsupported',
    microphone: 'unsupported',
    camera: 'unsupported',
    geolocation: 'unsupported',
    persistentStorage: false,
  });

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string>('');
  const [locationDetails, setLocationDetails] = useState<{ lat: number; lng: number } | null>(null);

  const refreshStatuses = async () => {
    const current = await checkBrowserPermissions();
    setPermissions(current);
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatuses();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGrantMic = async () => {
    setLoadingKey('mic');
    const granted = await requestMicrophonePermission();
    await refreshStatuses();
    setLoadingKey(null);
    if (granted) {
      playSuccessSound();
      setTestNotice('تم تفعيل إذن الميكروفون بنجاح! يمكنك الآن التحدث مع صقر وشموسة صوتياً.');
      setTimeout(() => setTestNotice(''), 4000);
    }
  };

  const handleGrantNotification = async () => {
    setLoadingKey('notifications');
    const granted = await requestNotificationPermission();
    await refreshStatuses();
    setLoadingKey(null);
    if (granted) {
      playSuccessSound();
      setTestNotice('تم تفعيل إشعارات الخلفية بنجاح! ستصلك التنبيهات حتى عند إغلاق التطبيق.');
      setTimeout(() => setTestNotice(''), 4000);
    }
  };

  const handleGrantLocation = async () => {
    setLoadingKey('location');
    const loc = await requestGeolocationPermission();
    await refreshStatuses();
    setLoadingKey(null);
    if (loc) {
      setLocationDetails(loc);
      playSuccessSound();
      setTestNotice('تم تحديد موقع الورشة الجغرافي بنجاح لضبط نطاقات الشحن!');
      setTimeout(() => setTestNotice(''), 4000);
    }
  };

  const handleGrantStorage = async () => {
    setLoadingKey('storage');
    const persisted = await requestPersistentStorage();
    await refreshStatuses();
    setLoadingKey(null);
    if (persisted) {
      playSuccessSound();
      setTestNotice('تم تثبيت التخزين الدائم لحماية مسودات الورشة من الحذف التلقائي!');
      setTimeout(() => setTestNotice(''), 4000);
    }
  };

  const handleGrantAll = async () => {
    setLoadingKey('all');
    await requestNotificationPermission();
    await requestMicrophonePermission();
    await requestPersistentStorage();
    await requestGeolocationPermission();
    await refreshStatuses();
    setLoadingKey(null);
    playSuccessSound();
    setTestNotice('تم معالجة جميع الأذونات بنجاح! ورشتك جاهزة بكامل طاقتها التشغيلية.');
    setTimeout(() => setTestNotice(''), 4500);
  };

  const handleSendTestNotification = async () => {
    playNotificationChimeSound();
    await dispatchArtisanNotification('🦅 صقر المستشار الحرفي يحييك!', {
      body: 'هذا إشعار تجريبي ناجح من منظومة الشمساوية، تواصل الورشة يعمل بكفاءة تامة.',
      url: '/',
    });
    setTestNotice('تم إرسال إشعار تجريبي إلى جهازك الآن!');
    setTimeout(() => setTestNotice(''), 3500);
  };

  const handleClose = () => {
    localStorage.setItem('alshams_permissions_prompted', 'true');
    onClose();
  };

  const isMicGranted = permissions.microphone === 'granted';
  const isNotifGranted = permissions.notifications === 'granted';
  const isGeoGranted = permissions.geolocation === 'granted' || !!locationDetails;
  const isStorageGranted = permissions.persistentStorage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-600 via-amber-700 to-stone-900 text-white relative">
          <button
            type="button"
            onClick={handleClose}
            className="absolute left-4 top-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black px-2 py-0.5 rounded bg-amber-400 text-stone-950">
                  {isInitialOnboarding ? 'ترحيب وتشغيل الورشة' : 'فحص أمان وصلاحيات الورشة'}
                </span>
                <span className="text-xs text-amber-200 font-bold">عيلة الشمساوية</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                ضبط تصاريح وأذونات المنظومة الذكية
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-amber-100/90 mt-2 leading-relaxed">
            لضمان أفضل أداء لورشتك وتلقي إشعارات الطلبيات ومواعيد التسليم حتى أثناء إغلاق المتصفح، يُرجى تفعيل الأذونات التالية.
          </p>
        </div>

        {/* Live Notice Banner */}
        {testNotice && (
          <div className="px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{testNotice}</span>
          </div>
        )}

        {/* Permissions List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3.5 flex-1 divide-y divide-stone-100 dark:divide-stone-800">
          {/* 1. Notifications */}
          <div className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-2xl shrink-0 ${isNotifGranted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    إذن الإشعارات وتشغيل الخلفية
                  </h4>
                  {isNotifGranted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      مُفعل بنجاح
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      يحتاج تفعيل
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  لإرسال تنبيهات الأوردرات الجديدة، ومواعيد التسليم، ونواقص الخامات، وصيانة المعدات حتى أثناء إغلاق المتصفح.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {isNotifGranted ? (
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال تجربة</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loadingKey === 'notifications'}
                  onClick={handleGrantNotification}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingKey === 'notifications' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>تفعيل الإشعارات</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Microphone */}
          <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-2xl shrink-0 ${isMicGranted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    إذن الميكروفون الصوتي
                  </h4>
                  {isMicGranted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      مُفعل بنجاح
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      يحتاج تفعيل
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  للتسجيل الصوتي المباشر والتحدث الحر مع صقر المستشار وشموسة للاستشارات الفورية والتسعير.
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center">
              <button
                type="button"
                disabled={isMicGranted || loadingKey === 'mic'}
                onClick={handleGrantMic}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-75 ${
                  isMicGranted
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {loadingKey === 'mic' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isMicGranted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMicGranted ? 'مُتاح للاستخدام' : 'تفعيل الميكروفون'}</span>
              </button>
            </div>
          </div>

          {/* 3. Location */}
          <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-2xl shrink-0 ${isGeoGranted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    إذن الموقع الجغرافي للورشة
                  </h4>
                  {isGeoGranted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      مُحدد بنجاح
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      يحتاج تحديد
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  لتحديد نطاق ورشتك تلقائياً واحتساب مسافات وتكاليف الشحن بدقة لزبائنك في المتجر وسوق الشمساوية.
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center">
              <button
                type="button"
                disabled={isGeoGranted || loadingKey === 'location'}
                onClick={handleGrantLocation}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-75 ${
                  isGeoGranted
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {loadingKey === 'location' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isGeoGranted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                <span>{isGeoGranted ? 'تم التحديد' : 'تحديد موقع الورشة'}</span>
              </button>
            </div>
          </div>

          {/* 4. Persistent Storage */}
          <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-2xl shrink-0 ${isStorageGranted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    ملفات الجلسة والتخزين الدائم
                  </h4>
                  {isStorageGranted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      محمي ومُثبت
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      يحتاج تثبيت
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  لحماية مسودات الحسابات وحركات المخزن من المسح التلقائي، وضمان بقاء تسجيل الدخول مفتوحاً حتى عند انقطاع الإنترنت.
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center">
              <button
                type="button"
                disabled={isStorageGranted || loadingKey === 'storage'}
                onClick={handleGrantStorage}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-75 ${
                  isStorageGranted
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {loadingKey === 'storage' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isStorageGranted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
                <span>{isStorageGranted ? 'التخزين مؤمّن' : 'تثبيت التخزين'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-stone-50 dark:bg-stone-800/60 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleGrantAll}
            disabled={loadingKey !== null}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>تفعيل جميع الصلاحيات دفعة واحدة ✨</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 font-bold text-xs transition cursor-pointer"
          >
            متابعة إلى الورشة 🚪
          </button>
        </div>
      </div>
    </div>
  );
};
