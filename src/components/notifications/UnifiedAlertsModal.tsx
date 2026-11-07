import React, { useState, useEffect, useMemo } from 'react';
import { NotificationItem, UserProfile } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  playNotificationChimeSound,
  playUrgentNotificationSound,
  playButtonClickSound,
  playSuccessSound,
  playErrorSound,
} from '../../lib/sounds';
import {
  Bell,
  Mail,
  X,
  CheckCheck,
  AlertTriangle,
  Clock,
  DollarSign,
  Trophy,
  Calendar,
  Send,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

export interface UnifiedAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'notifications' | 'messages';
  notifications: NotificationItem[];
  profile: UserProfile;
  unreadMessagesCount?: number;
  onRefreshNotifications: () => void;
  onNavigateToOrder?: (orderId: string) => void;
  onNavigateToInventory?: () => void;
  onReceiptUpdate?: () => Promise<void> | void;
}

export const UnifiedAlertsModal: React.FC<UnifiedAlertsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'notifications',
  notifications,
  profile,
  unreadMessagesCount = 0,
  onRefreshNotifications,
  onNavigateToOrder,
  onNavigateToInventory,
  onReceiptUpdate,
}) => {
  const { t: tr } = useTranslation();
  const [activeMainTab, setActiveMainTab] = useState<'notifications' | 'messages'>(initialTab);
  const [notifSubTab, setNotifSubTab] = useState<'all' | 'urgent' | 'daily'>('all');

  // Messages State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const effectiveWorkshopId = profile?.tenantId || profile?.workshopId || profile?.id || '';
  const effectiveEmail = profile?.email || '';

  useEffect(() => {
    if (isOpen) {
      setActiveMainTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const fetchAnnouncements = async () => {
    if (!effectiveWorkshopId) return;
    setLoadingMessages(true);
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
      console.warn('[UnifiedAlerts] Announcements fetch notice:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnnouncements();
      const hasUrgent = notifications.some((n) => !n.isRead && (n.type === 'stock_depletion' || n.title.includes('عاجل')));
      if (hasUrgent) {
        playUrgentNotificationSound();
      } else {
        playNotificationChimeSound();
      }
    }
  }, [isOpen, effectiveWorkshopId]);

  // Urgent vs Daily notifications
  const isUrgent = (item: NotificationItem): boolean => {
    return (
      item.type === 'stock_depletion' ||
      item.type === 'overdue_deposit' ||
      item.type === 'payment_reminder' ||
      item.title.includes('عاجل') ||
      item.title.includes('تنبيه نفاد') ||
      item.title.includes('تأخر') ||
      item.title.includes('استحقاق') ||
      item.message.includes('أوشكت على النفاد')
    );
  };

  const urgentNotifications = useMemo(() => notifications.filter(isUrgent), [notifications]);
  const dailyNotifications = useMemo(() => notifications.filter((n) => !isUrgent(n)), [notifications]);

  const filteredNotifications = useMemo(() => {
    if (notifSubTab === 'urgent') return urgentNotifications;
    if (notifSubTab === 'daily') return dailyNotifications;
    return notifications;
  }, [notifSubTab, notifications, urgentNotifications, dailyNotifications]);

  const unreadNotifTotal = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  if (!isOpen) return null;

  const handleClose = () => {
    playButtonClickSound();
    onClose();
  };

  const handleMarkAsRead = async (id: string) => {
    playButtonClickSound();
    await tenantStorage.markNotificationAsRead(id);
    onRefreshNotifications();
  };

  const handleMarkAllRead = async () => {
    playButtonClickSound();
    await tenantStorage.markAllNotificationsAsRead(effectiveWorkshopId);
    playSuccessSound();
    onRefreshNotifications();
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
        setActionNotice('تم تأكيد القراءة بنجاح.');
        setTimeout(() => setActionNotice(''), 3000);
        fetchAnnouncements();
        if (onReceiptUpdate) onReceiptUpdate();
      }
    } catch (err: any) {
      playErrorSound();
      setActionNotice('تعذر تأكيد القراءة.');
      setTimeout(() => setActionNotice(''), 3000);
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
        setActionNotice('تم إرسال ردك بنجاح.');
        setReplyingToId(null);
        setReplyText('');
        setTimeout(() => setActionNotice(''), 3000);
        fetchAnnouncements();
        if (onReceiptUpdate) onReceiptUpdate();
      }
    } catch (err: any) {
      playErrorSound();
      setActionNotice('تعذر إرسال الرد.');
      setTimeout(() => setActionNotice(''), 3000);
    } finally {
      setSubmittingReply(false);
    }
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'stock_depletion':
        return <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />;
      case 'upcoming_delivery':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'upcoming_deposit':
      case 'overdue_deposit':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'milestone_sales':
      case 'milestone_usage':
        return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'daily_sales_reminder':
        return <Calendar className="w-4 h-4 text-sky-500" />;
      default:
        return <Bell className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden text-right font-sans"
        dir="rtl"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white flex items-center justify-between shrink-0 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-md">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-amber-300">
                مركز التنبيهات والمراسلات
              </h2>
              <p className="text-xs text-stone-300 mt-0.5">
                إشعارات ورشة الشمساوية التشغيلية ورسائل العملاء
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified 2 Main Tabs */}
        <div className="p-2.5 bg-stone-100 dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveMainTab('notifications');
            }}
            className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activeMainTab === 'notifications'
                ? 'bg-white dark:bg-stone-850 text-amber-700 dark:text-amber-300 shadow-sm border border-stone-200 dark:border-stone-700'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>الإشعارات التشغيلية</span>
            {unreadNotifTotal > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                {unreadNotifTotal}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setActiveMainTab('messages');
            }}
            className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activeMainTab === 'messages'
                ? 'bg-white dark:bg-stone-850 text-emerald-700 dark:text-emerald-300 shadow-sm border border-stone-200 dark:border-stone-700'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>رسائل المتجر والعملاء</span>
            {unreadMessagesCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                {unreadMessagesCount}
              </span>
            )}
          </button>
        </div>

        {actionNotice && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab 1 Content: Operational Notifications */}
        {activeMainTab === 'notifications' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Sub-tabs & Mark all as read */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNotifSubTab('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    notifSubTab === 'all'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  الكل ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifSubTab('urgent')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    notifSubTab === 'urgent'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                >
                  <span>عاجل</span>
                  {urgentNotifications.length > 0 && <span>({urgentNotifications.length})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setNotifSubTab('daily')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    notifSubTab === 'daily'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  اليومية ({dailyNotifications.length})
                </button>
              </div>

              {unreadNotifTotal > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تحديد الكل كمقروء</span>
                </button>
              )}
            </div>

            {/* Notifications List */}
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-600" />
                <p>لا توجد إشعارات تشغيلية في هذا القسم حالياً.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all text-right flex items-start justify-between gap-3 ${
                      !item.isRead
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                        : 'bg-stone-50/50 dark:bg-stone-850 border-stone-200 dark:border-stone-800'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shrink-0">
                        {getNotificationIcon(item.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-stone-900 dark:text-stone-100">
                            {item.title}
                          </h4>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                          {item.message}
                        </p>
                        <span className="text-[10px] text-stone-400 block mt-1 font-mono">
                          {new Date(item.createdAt || Date.now()).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(item.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                          title="تحديد كمقروء"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Store & Customer Messages */}
        {activeMainTab === 'messages' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {loadingMessages ? (
              <div className="text-center py-12 text-stone-400 text-xs">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p>جارٍ تحميل الرسائل والمراسلات...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs">
                <Mail className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-600" />
                <p>صندوق الرسائل فارغ تماماً حالياً.</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  تظهر هنا رسائل واستفسارات العملاء وطلبات المتجر المباشرة.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3 text-right"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                          ✉️
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-stone-900 dark:text-stone-100">
                            {msg.title || 'رسالة جديدة'}
                          </h4>
                          <span className="text-[10px] text-stone-400 block font-mono">
                            {msg.sender_name || 'عميل / زائر المتجر'} •{' '}
                            {msg.created_at ? new Date(msg.created_at).toLocaleDateString('ar-EG') : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 dark:text-stone-200 leading-relaxed whitespace-pre-wrap">
                      {msg.content || msg.message}
                    </p>

                    {/* Quick Reply Form */}
                    {replyingToId === msg.id ? (
                      <div className="pt-2 border-t border-stone-200 dark:border-stone-700 space-y-2">
                        <textarea
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="اكتب ردك هنا..."
                          className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyingToId(null)}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-stone-500 hover:bg-stone-100 cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={submittingReply}
                            onClick={() => handleSendReply(msg.id)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            <span>إرسال الرد</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToId(msg.id);
                            setReplyText('');
                          }}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>الرد على الرسالة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(msg.id)}
                          className="text-xs font-bold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تأكيد الاطلاع</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
