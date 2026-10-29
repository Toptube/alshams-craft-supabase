import React, { useState } from 'react';
import { WorkshopProfile } from '../../types';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  MessageCircle,
  RefreshCw,
  LogOut,
  Calendar,
} from 'lucide-react';
import { playSuccessSound, playAlertSound, playErrorSound } from '../../lib/sounds';

interface AccessGateProps {
  workshop: WorkshopProfile;
  onRefreshStatus: () => Promise<void>;
  onLogout: () => void;
}

export const AccessGate: React.FC<AccessGateProps> = ({
  workshop,
  onRefreshStatus,
  onLogout,
}) => {
  const isBanned = workshop.status === 'banned';
  const isSuspended = workshop.status === 'suspended' || workshop.isFrozen;

  const [appealMessage, setAppealMessage] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localAppealSubmitted, setLocalAppealSubmitted] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');

  // Reason
  const reason =
    workshop.suspension_reason ||
    workshop.suspensionReason ||
    workshop.frozenReason ||
    'مخالفة معايير الاستخدام أو مراجعة إدارية';

  // Duration
  const duration = workshop.suspension_duration || workshop.suspensionDuration || '';
  const until = workshop.suspended_until || workshop.suspendedUntil;

  // Appeal status
  const appealStatus = localAppealSubmitted
    ? 'pending'
    : workshop.appeal_status || workshop.appealStatus || 'none';

  const rejectionReason = workshop.rejection_reason || workshop.rejectionReason;

  const handleSendAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealMessage.trim()) {
      alert('يرجى كتابة تفاصيل الطعن أو الاستفسار');
      return;
    }

    setSubmittingAppeal(true);
    setErrorNotice('');
    try {
      const res = await fetch('/api/workshop/appeal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workshop-id': workshop.id,
          'x-user-email': workshop.email,
        },
        body: JSON.stringify({ appeal_message: appealMessage.trim() }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'تعذر إرسال الطعن');
      }

      playSuccessSound();
      setLocalAppealSubmitted(true);
      setAppealMessage('');
      await onRefreshStatus();
    } catch (err: any) {
      playErrorSound();
      setErrorNotice(err.message || 'حدث خطأ أثناء الإرسال');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshStatus();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 flex flex-col justify-center items-center p-4 sm:p-6 text-right font-sans" dir="rtl">
      <div className="max-w-2xl w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in duration-300">
        {/* Top Header Banner */}
        <div
          className={`p-6 sm:p-8 text-white relative ${
            isBanned
              ? 'bg-gradient-to-r from-rose-900 via-rose-800 to-stone-900'
              : 'bg-gradient-to-r from-amber-900 via-amber-800 to-stone-900'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                isBanned
                  ? 'bg-rose-500/20 border border-rose-400 text-rose-300'
                  : 'bg-amber-500/20 border border-amber-400 text-amber-300'
              }`}
            >
              <ShieldAlert size={36} />
            </div>

            <div>
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/40 text-stone-200 border border-white/10 inline-block mb-1.5">
                {isBanned ? 'حظر إداري كامل' : 'إيقاف حساب مؤقت'}
              </span>
              <h1 className="text-xl sm:text-2xl font-black">
                {isBanned
                  ? `تم حظر حساب ورشة: ${workshop.brandName}`
                  : `تم إيقاف حساب ورشة: ${workshop.brandName} مؤقتاً`}
              </h1>
              <p className="text-xs text-stone-200 mt-1">
                صاحب الورشة: {workshop.artistName} | كود الورشة: {workshop.id.slice(0, 10)}...
              </p>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Reason & Suspension Details Box */}
          <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 space-y-3">
            <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200 font-black text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>أسباب الإجراء الإداري:</span>
            </div>
            <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-bold bg-white dark:bg-stone-850 p-3 rounded-xl border border-stone-200 dark:border-stone-700">
              {reason}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-stone-600 dark:text-stone-400 pt-1">
              {duration && (
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-600" />
                  <span>مدة الإيقاف: <strong>{duration}</strong></span>
                </div>
              )}
              {until && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-amber-600" />
                  <span>ينتهي الإيقاف في: <strong>{new Date(until).toLocaleString('ar-EG')}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Appeals Center Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-black text-stone-900 dark:text-stone-100">
              نافذة الطعون والشكاوى الرسمية
            </h2>

            {/* Appeal Statuses */}
            {appealStatus === 'pending' || appealStatus === 'under_review' ? (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
                  <Clock className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
                  <span>تم استلام طعنكم وهو قيد المراجعة حالياً من قِبل كبير عيلة الشمساوية.</span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  سيتم النظر في طعنكم والرد عليكم مباشرة عبر النظام أو التواصل عبر الواتساب.
                </p>
              </div>
            ) : appealStatus === 'rejected' ? (
              <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 space-y-3">
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm text-rose-700 dark:text-rose-400">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>تم النظر في الطعن المقدم منكم ورُفض للأسباب التالية:</span>
                </div>
                <p className="text-xs bg-white dark:bg-stone-850 p-3 rounded-xl border border-rose-200 dark:border-rose-900 font-bold">
                  {rejectionReason || 'لم يتم استيفاء معايير فك الحظر، يرجى التواصل مع الإدارة.'}
                </p>
                <button
                  type="button"
                  onClick={() => setLocalAppealSubmitted(false)}
                  className="text-xs font-black text-amber-700 dark:text-amber-400 underline cursor-pointer"
                >
                  تقديم طعن إضافي بمعلومات جديدة
                </button>
              </div>
            ) : appealStatus === 'accepted' ? (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-black text-xs sm:text-sm text-emerald-700">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>تم قبول الطعن المقدم منكم بنجاح وإلغاء قيود الإيقاف!</span>
                </div>
                <p className="text-xs">
                  يمكنكم الآن الضغط على زر "تحديث الحالة" بالأسفل لبدء العمل فوراً.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendAppeal} className="space-y-3">
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-bold">
                  إذا كنت تعتقد أن هذا الإجراء تم بالخطأ أو تود الاستفسار، تفضل بتقديم طعن رسمي للإدارة:
                </p>

                <textarea
                  rows={4}
                  required
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  placeholder="اكتب أسباب وتفاصيل الطعن أو التوضيحات التي تود رفعها لكبير عيلة الشمساوية..."
                  className="w-full p-3.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />

                {errorNotice && (
                  <p className="text-xs font-bold text-rose-600">{errorNotice}</p>
                )}

                <button
                  type="submit"
                  disabled={submittingAppeal}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {submittingAppeal ? (
                    <span>جاري الإرسال...</span>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>إرسال طعن رسمي للإدارة</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Direct Support & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin text-amber-600' : ''} />
                <span>تحديث حالة الحساب</span>
              </button>

              <a
                href={`https://wa.me/201000000000?text=${encodeURIComponent(
                  `السلام عليكم يا باشمهندس حسام، بخصوص إيقاف ورشة "${workshop.brandName}" (كود: ${workshop.id.slice(0, 8)}) أود الاستفسار.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition shadow-xs"
              >
                <MessageCircle size={14} />
                <span>محادثة الإدارة واتساب</span>
              </a>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-600 hover:text-rose-600 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut size={14} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
