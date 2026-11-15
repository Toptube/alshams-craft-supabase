import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  BellRing,
  CheckCircle2,
  X,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'card' | 'landing';
  showWhenInstalled?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'card',
  showWhenInstalled = false,
  className = '',
}) => {
  const {
    isInstalled,
    isIOS,
    isInIframe,
    isSetupRedirect,
    canNativeInstall,
    installing,
    install,
  } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const standaloneInstallUrl = (() => {
    if (typeof window === 'undefined') return '/?pwa-setup=1';
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('pwa-setup', '1');
      return url.toString();
    } catch {
      return '/?pwa-setup=1';
    }
  })();

  // If opened in a dedicated tab via ?pwa-setup=1, clean URL param and surface setup dialog once prompt or readiness arrives
  useEffect(() => {
    if (!isSetupRedirect || isInstalled || isInIframe) return;
    if (variant === 'card') {
      setShowGuideModal(true);
    }
  }, [isSetupRedirect, isInstalled, isInIframe, variant]);

  if (isInstalled && !showWhenInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstalled) return;
    if (canNativeInstall) {
      const outcome = await install();
      if (outcome === 'unavailable') {
        setShowGuideModal(true);
      } else if (outcome === 'accepted') {
        setShowGuideModal(false);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(standaloneInstallUrl.replace(/[?&]pwa-setup=1/, ''));
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setCopiedUrl(false);
    }
  };

  const renderGuideModal = () => {
    if (!showGuideModal) return null;
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm"
        dir="rtl"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowGuideModal(false);
        }}
      >
        <div className="w-full max-w-md rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden text-right">
          <div className="p-4 sm:p-5 bg-[#0C1427] dark:bg-[#132040] text-[#F7F3EA] flex items-center justify-between gap-3 border-b border-[#EA580C]/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  إعداد وتثبيت أيقونة تطبيق الشمساوية (Setup)
                </h3>
                <p className="text-[11px] text-[#FDBA74] font-bold">
                  {canNativeInstall
                    ? 'التثبيت التلقائي الفوري جاهز على جهازك'
                    : isInIframe
                    ? 'افتح الرابط في المتصفح لتفعيل نافذة التثبيت التلقائي'
                    : isIOS
                    ? 'دليل أجهزة آيفون وآيباد (Safari)'
                    : 'دليل التثبيت المباشر (أندرويد وكمبيوتر)'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              aria-label="إغلاق الدليل"
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-[#0C1427] dark:text-[#F7F3EA]">
            {canNativeInstall ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35 flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-bold text-emerald-900 dark:text-emerald-200">
                    متصفحك جاهز الآن لإنشاء أيقونة تطبيق الشمساوية المستقل (PWA) على سطح المكتب أو الشاشة الرئيسية بضغطة واحدة!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={installing}
                  className="w-full py-3 px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{installing ? 'جاري تشغيل نافذة التثبيت...' : 'تثبيت الأيقونة الآن (Setup)'}</span>
                </button>
              </div>
            ) : isInIframe ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[#FFEDD5] dark:bg-[#1E130A] border border-[#EA580C]/40 space-y-2">
                  <p className="text-xs leading-relaxed font-bold text-[#9A3412] dark:text-[#FDBA74]">
                    أنت تتصفح المنظومة الآن من داخل إطار المعاينة؛ يمنع المتصفح إظهار نافذة التثبيت التلقائي داخل الإطارات المدمجة. افتح التطبيق في نافذة متصفح مستقلة لعمل <span className="underline">Setup مباشر</span> وتثبيت الأيقونة على جهازك:
                  </p>
                </div>

                <a
                  href={standaloneInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح المنظومة في نافذة مستقلة للتثبيت (Setup)</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full py-2 px-4 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#EA580C]" />}
                  <span>{copiedUrl ? 'تم نسخ رابط المنظومة بنجاح' : 'نسخ رابط التطبيق لفتحه في Chrome أو Safari'}</span>
                </button>
              </div>
            ) : isIOS ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EA580C] text-white flex items-center justify-center shrink-0 font-black text-xs">
                    1
                  </div>
                  <p className="leading-relaxed font-bold">
                    افتح الموقع في متصفح <span className="text-[#C2410C] dark:text-[#FBBF24]">Safari</span> ثم اضغط على زر المشاركة <Share className="w-4 h-4 inline mx-0.5 text-[#EA580C]" /> في أسفل أو أعلى الشاشة.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EA580C] text-white flex items-center justify-center shrink-0 font-black text-xs">
                    2
                  </div>
                  <p className="leading-relaxed font-bold">
                    مرر للأسفل واختر <PlusSquare className="w-4 h-4 inline mx-0.5 text-[#EA580C]" />{' '}
                    <span className="text-[#C2410C] dark:text-[#FBBF24]">«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</span> ثم اضغط إضافة.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#FFEDD5] dark:bg-[#1E130A] border border-[#EA580C]/40 flex items-start gap-2.5">
                  <BellRing className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-bold text-[#9A3412] dark:text-[#FDBA74]">
                    مهم جداً للآيفون: بعد التثبيت، افتح التطبيق من أيقونته على الشاشة الرئيسية وفعّل «الإشعارات» ليصلك صوت التنبيهات والأوردرات في الخلفية!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EA580C] text-white flex items-center justify-center shrink-0 font-black text-xs">
                    1
                  </div>
                  <p className="leading-relaxed font-bold">
                    اضغط على أيقونة التثبيت في شريط العنوان أو قائمة المتصفح <span className="font-mono font-black px-1.5 py-0.5 rounded bg-[#0C1427] text-white mx-1">⋮</span> في Chrome أو Edge.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EA580C] text-white flex items-center justify-center shrink-0 font-black text-xs">
                    2
                  </div>
                  <p className="leading-relaxed font-bold">
                    اختر <span className="text-[#C2410C] dark:text-[#FBBF24]">«تثبيت التطبيق» (Install App)</span> ليتم إنشاء أيقونة تطبيق الشمساوية المستقلة على جهازك.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#FFEDD5] dark:bg-[#1E130A] border border-[#EA580C]/40 flex items-start gap-2.5">
                  <RefreshCw className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-bold text-[#9A3412] dark:text-[#FDBA74]">
                    يعمل التطبيق في نافذة مستقلة وخلفية متكاملة مع صوت تنبيه النظام عند وصول أي أوردر أو رسالة، ويتحدث تلقائياً مع كل نشر جديد.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 bg-[#E9E2D4] dark:bg-[#132040] border-t border-[#D4CCBC] dark:border-[#22355E] flex justify-end">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="px-5 py-2 rounded-xl bg-[#0C1427] hover:bg-[#EA580C] text-white font-black text-xs transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (variant === 'navbar') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={installing}
          title={canNativeInstall ? 'تثبيت تطبيق الشمساوية كأيقونة مباشرة الآن' : 'إعداد وتثبيت تطبيق الشمساوية على الجهاز'}
          className={`${
            canNativeInstall ? 'inline-flex' : 'hidden sm:inline-flex'
          } items-center gap-1.5 h-8 sm:h-9 px-2.5 rounded-xl ${
            canNativeInstall
              ? 'bg-[#EA580C] hover:bg-[#C2410C] text-white border border-[#FDBA74]/60 shadow-sm'
              : 'bg-[#E9E2D4] dark:bg-[#132040] border border-[#EA580C]/60 hover:bg-[#EA580C] text-[#9A3412] hover:text-white dark:text-[#FBBF24] dark:hover:text-white'
          } text-[11px] font-black transition cursor-pointer whitespace-nowrap shrink-0 ${className}`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className={canNativeInstall ? 'inline' : 'hidden sm:inline'}>
            {installing
              ? 'جاري...'
              : canNativeInstall
              ? 'تثبيت الآن'
              : isIOS
              ? 'تثبيت على الآيفون'
              : 'تثبيت التطبيق'}
          </span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  if (variant === 'landing') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={installing}
          title="تثبيت تطبيق الشمساوية على الموبايل أو الكمبيوتر"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl ${
            canNativeInstall
              ? 'bg-[#EA580C] hover:bg-[#C2410C] text-white border border-[#FDBA74]/50 shadow-sm'
              : 'bg-[#E9E2D4] dark:bg-[#132040] border border-[#EA580C]/50 hover:border-[#EA580C] text-[#9A3412] dark:text-[#FBBF24]'
          } text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 ${className}`}
        >
          <Smartphone className={`w-4 h-4 shrink-0 ${canNativeInstall ? 'text-white' : 'text-[#EA580C]'}`} />
          <span className="hidden sm:inline">
            {canNativeInstall ? 'تثبيت التطبيق الآن (Setup)' : isIOS ? 'تثبيت على آيفون' : 'تثبيت التطبيق'}
          </span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // Default: 'card' variant for SidebarDrawer & PermissionsOnboardingModal
  if (isInstalled && showWhenInstalled) {
    return (
      <div
        className={`w-full p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 text-right ${className}`}
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black">تطبيق الشمساوية مُثبّت على جهازك</p>
          <p className="text-[11px] opacity-90 leading-snug">
            يعمل في وضع التطبيق المستقل مع تحديثات تلقائية فورية.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`w-full p-3 rounded-2xl border border-[#EA580C]/45 bg-gradient-to-l from-[#FFEDD5] via-[#F7F3EA] to-[#E9E2D4] dark:from-[#1A2B54] dark:via-[#132040] dark:to-[#0D162E] text-right shadow-2xs ${className}`}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                {canNativeInstall
                  ? 'تثبيت أيقونة التطبيق (Setup)'
                  : isIOS
                  ? 'تثبيت التطبيق على الآيفون'
                  : 'تطبيق الشمساوية على جهازك'}
              </h4>
              <p className="text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1] truncate">
                {canNativeInstall
                  ? 'ضغطة واحدة للتثبيت المباشر على جهازك'
                  : 'تثبيت مستقل وإشعارات الأوردرات بالخلفية'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClick}
            disabled={installing}
            className="px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black transition cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{installing ? 'جاري...' : canNativeInstall ? 'Setup الآن' : 'تثبيت'}</span>
          </button>
        </div>
      </div>
      {renderGuideModal()}
    </>
  );
};
