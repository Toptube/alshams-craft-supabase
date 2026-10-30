import React, { useState } from 'react';
import { UserProfile, AdminAnnouncement } from '../../types';
import {
  X,
  Mail,
  Check,
  Send,
  MessageCircle,
  Volume2,
  Clock,
  Sparkles,
  Lock,
  Globe,
  Bell,
} from 'lucide-react';
import { playPostaNotificationSound, playSuccessSound, playAlertSound } from '../../lib/sounds';

interface MessagesHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile | null;
  workshopId?: string;
  workshopName?: string;
  announcements?: any[];
  onRefreshAnnouncements?: () => Promise<void> | void;
  onReceiptUpdate?: () => Promise<void> | void;
}

export const MessagesHubModal: React.FC<MessagesHubModalProps> = ({
  isOpen,
  onClose,
  profile,
  workshopId,
  workshopName,
  announcements: initialAnnouncements,
  onRefreshAnnouncements,
  onReceiptUpdate,
}) => {
  const [announcements, setAnnouncements] = useState<any[]>(() => initialAnnouncements || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const effectiveWorkshopId = profile?.workshopId || profile?.id || workshopId || '';
  const effectiveEmail = profile?.email || '';

  const fetchAnnouncements = async () => {
    if (!effectiveWorkshopId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/announcements?workshopId=${encodeURIComponent(effectiveWorkshopId)}`, {
        headers: {
          'x-workshop-id': effectiveWorkshopId,
          ...(effectiveEmail ? { 'x-user-email': effectiveEmail } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      }
    } catch (err) {
      console.warn('[MessagesHub] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (initialAnnouncements && Array.isArray(initialAnnouncements)) {
      setAnnouncements(initialAnnouncements);
    } else if (isOpen) {
      fetchAnnouncements();
    }
  }, [initialAnnouncements, isOpen, effectiveWorkshopId]);

  if (!isOpen) return null;

  const refreshAll = async () => {
    await fetchAnnouncements();
    if (onRefreshAnnouncements) {
      try { await onRefreshAnnouncements(); } catch (_) {}
    }
    if (onReceiptUpdate) {
      try { await onReceiptUpdate(); } catch (_) {}
    }
  };

  const handleAcknowledge = async (messageId: string) => {
    try {
      const res = await fetch(`/api/announcements/${messageId}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workshop-id': effectiveWorkshopId,
          'x-user-email': effectiveEmail,
        },
        body: JSON.stringify({ action: 'acknowledge', workshopId: effectiveWorkshopId }),
      });
      if (res.ok) {
        playSuccessSound();
        setActionNotice('تم تأكيد القراءة والموافقة بنجاح.');
        setTimeout(() => setActionNotice(''), 3000);
        await refreshAll();
      }
    } catch (err: any) {
      alert('تعذر تأكيد القراءة: ' + err.message);
    }
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/announcements/${messageId}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workshop-id': effectiveWorkshopId,
          'x-user-email': effectiveEmail,
        },
        body: JSON.stringify({
          action: 'reply',
          reply_text: replyText.trim(),
          workshopId: effectiveWorkshopId,
        }),
      });
      if (res.ok) {
        playSuccessSound();
        setActionNotice('تم إرسال ردك إلى كبير عيلة الشمساوية بنجاح.');
        setReplyingToId(null);
        setReplyText('');
        setTimeout(() => setActionNotice(''), 3500);
        await refreshAll();
      }
    } catch (err: any) {
      alert('تعذر إرسال الرد: ' + err.message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const safeAnnouncements = Array.isArray(announcements) ? announcements : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden text-right font-sans" dir="rtl">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white flex items-center justify-between shrink-0 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md">
              <Mail size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-amber-300">
                  مركز المراسلات والرسائل الحية (Messages Hub)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 font-mono font-bold">
                  {safeAnnouncements.length} رسالة
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                توجيهات وإعلانات كبير عيلة الشمساوية الموجهة لورشتك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-4 py-2.5 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check size={16} className="text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Body List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {safeAnnouncements.length === 0 ? (
            <div className="p-12 text-center text-stone-400 space-y-3">
              <Mail className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-700" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300">
                صندوق الرسائل فارغ
              </h3>
              <p className="text-xs text-stone-500">
                لا توجد رسائل أو توجيهات جديدة موجهة لورشتك حالياً.
              </p>
            </div>
          ) : (
            safeAnnouncements.map((item) => {
              const receipt = item.receipt;
              const isAcknowledged = Boolean(receipt?.acknowledged_at);
              const hasReplied = Boolean(receipt?.reply_text);
              const isSpecific = item.recipient_type === 'specific';

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition shadow-xs space-y-3 ${
                    isSpecific
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                      : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {/* Top Message Meta */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isSpecific ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-black border border-amber-300 dark:border-amber-700">
                          <Lock size={10} />
                          <span>رسالة خاصة لورشتك</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-black border border-blue-200 dark:border-blue-800">
                          <Globe size={10} />
                          <span>إعلان عام لكافة الورش</span>
                        </span>
                      )}

                      <span className="text-[11px] font-mono text-stone-400">
                        {item.created_at ? new Date(item.created_at).toLocaleString('ar-EG') : ''}
                      </span>
                    </div>

                    {isAcknowledged && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        <Check size={11} />
                        <span>تمت القراءة والموافقة</span>
                      </span>
                    )}
                  </div>

                  {/* Message Title & Content */}
                  <div>
                    <h3 className="font-black text-sm text-stone-900 dark:text-stone-100">
                      {item.title}
                    </h3>
                    <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-medium mt-1.5 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>

                  {/* Previous Reply if exists */}
                  {hasReplied && (
                    <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-1">
                      <span className="text-[10px] font-black text-amber-600 block">
                        رد ورشتكم السابق:
                      </span>
                      <p className="text-xs text-stone-800 dark:text-stone-200 font-medium">
                        "{receipt.reply_text}"
                      </p>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    {!isAcknowledged && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Check size={13} />
                        <span>تمت القراءة والموافقة</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setReplyingToId(replyingToId === item.id ? null : item.id);
                        setReplyText('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <MessageCircle size={13} />
                      <span>{hasReplied ? 'إرسال رد إضافي' : 'إرسال رد / استفسار'}</span>
                    </button>
                  </div>

                  {/* Reply Input Form */}
                  {replyingToId === item.id && (
                    <div className="pt-2 space-y-2 animate-in fade-in">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="اكتب ردك أو استفسارك الموجه لكبير عيلة الشمساوية..."
                        className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50 dark:bg-stone-800"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingToId(null)}
                          className="px-3 py-1 rounded-lg border text-xs font-bold text-stone-600"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          disabled={submittingReply || !replyText.trim()}
                          onClick={() => handleSendReply(item.id)}
                          className="px-4 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 flex items-center gap-1 disabled:opacity-50"
                        >
                          <Send size={12} />
                          <span>إرسال الرد</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
