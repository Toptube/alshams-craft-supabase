import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NotificationItem, UserProfile } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { supabase } from '../../lib/supabase';
import {
  playNotificationChimeSound,
  playUrgentNotificationSound,
  playPostaNotificationSound,
  playButtonClickSound,
  playTabSwitchSound,
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
  CheckCircle2,
  Check,
  Lock,
  Globe,
  Volume2,
  Package,
  ExternalLink,
} from 'lucide-react';

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
  const [activeMainTab, setActiveMainTab] = useState<'notifications' | 'messages'>(initialTab);
  const [notifSubTab, setNotifSubTab] = useState<'all' | 'urgent' | 'daily'>('all');

  // Messages / Mail State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const markedReadIdsRef = useRef<Set<string>>(new Set());

  const effectiveWorkshopId = profile?.tenantId || profile?.workshopId || profile?.id || '';
  const effectiveEmail = profile?.email || '';

  const getHeaders = async (includeJson = false): Promise<Record<string, string>> => {
    const h: Record<string, string> = {};
    if (includeJson) h['Content-Type'] = 'application/json';
    if (effectiveWorkshopId) h['x-workshop-id'] = effectiveWorkshopId;
    if (effectiveEmail) h['x-user-email'] = effectiveEmail;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        h['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    } catch {}
    return h;
  };

  useEffect(() => {
    if (isOpen) {
      setActiveMainTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const fetchAnnouncements = async () => {
    if (!effectiveWorkshopId) return;
    setLoadingMessages(true);
    try {
      const headers = await getHeaders(false);
      const res = await fetch(
        `/api/announcements?workshopId=${encodeURIComponent(effectiveWorkshopId)}`,
        { headers }
      );
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

  // Fetch mail and trigger appropriate sound on open
  useEffect(() => {
    if (!isOpen) return;
    fetchAnnouncements();

    if (initialTab === 'messages') {
      if (unreadMessagesCount > 0) {
        playPostaNotificationSound();
      } else {
        playTabSwitchSound();
      }
      return;
    }

    const hasUrgent = notifications.some(
      (n) => !n.isRead && (n.type === 'stock_depletion' || n.title.includes('عاجل'))
    );
    if (hasUrgent) {
      playUrgentNotificationSound();
    } else if (unreadMessagesCount > 0 && notifications.every((n) => n.isRead)) {
      playPostaNotificationSound();
    } else {
      playNotificationChimeSound();
    }
  }, [isOpen, effectiveWorkshopId]);

  // Mark unread mail messages as read automatically when viewing the Messages (Mail) tab
  useEffect(() => {
    if (!isOpen || activeMainTab !== 'messages' || !effectiveWorkshopId || announcements.length === 0) {
      return;
    }

    const unread = announcements.filter(
      (a) => a?.id && !a?.receipt?.read_at && !markedReadIdsRef.current.has(a.id)
    );
    if (unread.length === 0) return;

    (async () => {
      try {
        const headers = await getHeaders(true);
        await Promise.allSettled(
          unread.map((a) => {
            markedReadIdsRef.current.add(a.id);
            return fetch(`/api/announcements/${encodeURIComponent(a.id)}/receipt`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ action: 'read', workshopId: effectiveWorkshopId }),
            });
          })
        );
        const nowIso = new Date().toISOString();
        setAnnouncements((prev) =>
          prev.map((item) =>
            unread.some((u) => u.id === item.id)
              ? { ...item, receipt: { ...(item.receipt || {}), read_at: nowIso } }
              : item
          )
        );
        if (onReceiptUpdate) {
          try {
            await onReceiptUpdate();
          } catch {}
        }
      } catch {}
    })();
  }, [isOpen, activeMainTab, announcements, effectiveWorkshopId]);

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

  const unreadNotifTotal = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const computedUnreadMailCount = useMemo(() => {
    if (announcements.length > 0) {
      return announcements.filter((a) => !a?.receipt?.read_at).length;
    }
    return unreadMessagesCount;
  }, [announcements, unreadMessagesCount]);

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
      const headers = await getHeaders(true);
      const res = await fetch(`/api/announcements/${encodeURIComponent(messageId)}/receipt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'acknowledge', workshopId: effectiveWorkshopId }),
      });
      if (res.ok) {
        playSuccessSound();
        setActionNotice('تم تأكيد القراءة والموافقة بنجاح.');
        setTimeout(() => setActionNotice(''), 3000);
        await fetchAnnouncements();
        if (onReceiptUpdate) await onReceiptUpdate();
      }
    } catch {
      playErrorSound();
      setActionNotice('تعذر تأكيد القراءة.');
      setTimeout(() => setActionNotice(''), 3000);
    }
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const headers = await getHeaders(true);
      const res = await fetch(`/api/announcements/${encodeURIComponent(messageId)}/receipt`, {
        method: 'POST',
        headers,
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
        await fetchAnnouncements();
        if (onReceiptUpdate) await onReceiptUpdate();
      }
    } catch {
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
        return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'upcoming_delivery':
        return <Clock className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />;
      case 'upcoming_deposit':
      case 'overdue_deposit':
        return <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'milestone_sales':
      case 'milestone_usage':
        return <Trophy className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24]" />;
      case 'daily_sales_reminder':
        return <Calendar className="w-4 h-4 text-[#1E3A8A] dark:text-[#93C5FD]" />;
      default:
        return <Bell className="w-4 h-4 text-[#C2410C] dark:text-[#FBBF24]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#060B18]/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] w-full max-w-2xl rounded-3xl shadow-2xl border border-[#D4CCBC] dark:border-[#22355E] flex flex-col max-h-[90vh] overflow-hidden text-right font-sans"
        dir="rtl"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#060B18] via-[#0D162E] to-[#132040] text-[#F7F3EA] flex items-center justify-between shrink-0 border-b border-[#EA580C]/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#EA580C]/20 border border-[#FDBA74]/40 flex items-center justify-center text-[#FBBF24] shadow-md shrink-0">
              {activeMainTab === 'messages' ? <Mail className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#FBBF24] truncate">
                مركز الإشعارات والبريد
              </h2>
              <p className="text-xs text-[#CBD5E1] mt-0.5 truncate">
                تنبيهات الورشة التشغيلية ورسائل البريد والمراسلات
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-[#132040] text-[#CBD5E1] hover:text-white hover:bg-[#EA580C] border border-[#22355E] transition cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified 2 Main Tabs: الإشعارات | رسائل (البريد) */}
        <div className="p-2.5 bg-[#E9E2D4] dark:bg-[#0D162E] border-b border-[#D4CCBC] dark:border-[#22355E] grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              playTabSwitchSound();
              setActiveMainTab('notifications');
            }}
            className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer border ${
              activeMainTab === 'notifications'
                ? 'bg-[#F7F3EA] dark:bg-[#132040] text-[#C2410C] dark:text-[#FBBF24] border-[#EA580C]/60 shadow-sm'
                : 'bg-transparent border-transparent text-[#334155] dark:text-[#CBD5E1] hover:bg-[#DFD7C6]/60 dark:hover:bg-[#132040]/60'
            }`}
          >
            <Bell className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
            <span className="truncate">الإشعارات</span>
            {unreadNotifTotal > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-[#EA580C] text-white text-[11px] font-mono tabular-nums font-black flex items-center justify-center shrink-0">
                {unreadNotifTotal}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              playTabSwitchSound();
              setActiveMainTab('messages');
            }}
            className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer border ${
              activeMainTab === 'messages'
                ? 'bg-[#F7F3EA] dark:bg-[#132040] text-[#1E3A8A] dark:text-[#EDE3CF] border-[#1E3A8A]/50 dark:border-[#EDE3CF]/50 shadow-sm'
                : 'bg-transparent border-transparent text-[#334155] dark:text-[#CBD5E1] hover:bg-[#DFD7C6]/60 dark:hover:bg-[#132040]/60'
            }`}
          >
            <Mail className="w-4 h-4 text-[#1E3A8A] dark:text-[#EDE3CF] shrink-0" />
            <span className="truncate">رسائل (البريد)</span>
            {computedUnreadMailCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-[#1E3A8A] text-white dark:bg-[#EDE3CF] dark:text-[#0C1427] text-[11px] font-mono tabular-nums font-black flex items-center justify-center shrink-0">
                {computedUnreadMailCount}
              </span>
            )}
          </button>
        </div>

        {actionNotice && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400/60 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab 1 Content: Operational Notifications */}
        {activeMainTab === 'notifications' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Sub-tabs & Mark all as read */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-[#E9E2D4] dark:bg-[#0D162E] p-1 rounded-xl border border-[#D4CCBC] dark:border-[#22355E]">
                <button
                  type="button"
                  onClick={() => {
                    playTabSwitchSound();
                    setNotifSubTab('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    notifSubTab === 'all'
                      ? 'bg-[#F7F3EA] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] shadow-xs'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0C1427] dark:hover:text-white'
                  }`}
                >
                  الكل ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTabSwitchSound();
                    setNotifSubTab('urgent');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                    notifSubTab === 'urgent'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 dark:text-rose-400 hover:bg-rose-100/70 dark:hover:bg-rose-950/40'
                  }`}
                >
                  <span>عاجل</span>
                  {urgentNotifications.length > 0 && <span>({urgentNotifications.length})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTabSwitchSound();
                    setNotifSubTab('daily');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    notifSubTab === 'daily'
                      ? 'bg-[#EA580C] text-white shadow-xs'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0C1427] dark:hover:text-white'
                  }`}
                >
                  اليومية ({dailyNotifications.length})
                </button>
              </div>

              {unreadNotifTotal > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="px-3 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5 cursor-pointer transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تحديد الكل كمقروء</span>
                </button>
              )}
            </div>

            {/* Notifications List */}
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12 text-[#475569] dark:text-[#CBD5E1] space-y-2">
                <Bell className="w-10 h-10 mx-auto opacity-45 text-[#C2410C] dark:text-[#FBBF24]" />
                <p className="text-xs font-bold">لا توجد إشعارات تشغيلية في هذا القسم حالياً.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredNotifications.map((item) => {
                  const urgentItem = isUrgent(item);
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all text-right space-y-2 ${
                        !item.isRead
                          ? urgentItem
                            ? 'bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-700/70'
                            : 'bg-[#FFF7ED] dark:bg-[#132040] border-[#EA580C]/55 dark:border-[#FBBF24]/50'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 p-2 rounded-xl bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] shrink-0">
                            {getNotificationIcon(item.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                                {item.title}
                              </h4>
                              {!item.isRead && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                    urgentItem
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-[#EA580C] text-white'
                                  }`}
                                >
                                  جديد
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] mt-1 leading-relaxed font-medium">
                              {item.message}
                            </p>
                            <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] block mt-1.5 font-mono tabular-nums">
                              {new Date(item.createdAt || Date.now()).toLocaleString('ar-EG')}
                            </span>
                          </div>
                        </div>

                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(item.id)}
                            className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#EA580C] dark:hover:text-[#FBBF24] transition cursor-pointer shrink-0"
                            title="تحديد كمقروء"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {(item.relatedOrderId && onNavigateToOrder) ||
                      (item.type === 'stock_depletion' && onNavigateToInventory) ? (
                        <div className="pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex items-center gap-2">
                          {item.relatedOrderId && onNavigateToOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                playButtonClickSound();
                                onNavigateToOrder(item.relatedOrderId!);
                                onClose();
                              }}
                              className="text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>عرض تفاصيل الطلب</span>
                            </button>
                          )}
                          {item.type === 'stock_depletion' && onNavigateToInventory && (
                            <button
                              type="button"
                              onClick={() => {
                                playButtonClickSound();
                                onNavigateToInventory();
                                onClose();
                              }}
                              className="text-[11px] font-black text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Package className="w-3 h-3" />
                              <span>فتح الخامات والمخزون</span>
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Mail & Messages */}
        {activeMainTab === 'messages' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Mail Toolbar with Tone #7 preview */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-black text-[#1E3A8A] dark:text-[#EDE3CF] flex items-center gap-1.5">
                <Mail className="w-4 h-4 shrink-0" />
                <span>صندوق البريد والمراسلات ({announcements.length})</span>
              </div>
              <button
                type="button"
                onClick={() => playPostaNotificationSound()}
                className="px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#172554] text-white dark:bg-[#EDE3CF] dark:hover:bg-[#E2D5BC] dark:text-[#0C1427] border border-[#172554] dark:border-[#D4CCBC] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                title="سماع نغمة البريد المعتمدة"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>استماع لنغمة البريد</span>
              </button>
            </div>

            {loadingMessages && announcements.length === 0 ? (
              <div className="text-center py-12 text-[#475569] dark:text-[#CBD5E1] text-xs">
                <div className="w-6 h-6 border-2 border-[#1E3A8A] dark:border-[#EDE3CF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p>جارٍ تحميل رسائل البريد والمراسلات...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12 text-[#475569] dark:text-[#CBD5E1] space-y-2">
                <Mail className="w-10 h-10 mx-auto opacity-45 text-[#1E3A8A] dark:text-[#EDE3CF]" />
                <p className="text-xs font-bold">صندوق البريد فارغ حالياً.</p>
                <p className="text-[11px] opacity-80">
                  تظهر هنا رسائل البريد والتوجيهات والردود الخاصة بورشتك.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((msg) => {
                  const receipt = msg.receipt;
                  const isAcknowledged = Boolean(receipt?.acknowledged_at);
                  const hasReplied = Boolean(receipt?.reply_text);
                  const isSpecific = msg.recipient_type === 'specific';

                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-2xl border space-y-3 text-right transition ${
                        isSpecific
                          ? 'bg-[#FFF7ED] dark:bg-[#132040] border-[#EA580C]/55 dark:border-[#FBBF24]/50'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-8 h-8 rounded-xl bg-[#1E3A8A] text-white dark:bg-[#EDE3CF] dark:text-[#0C1427] flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                                {msg.title || 'رسالة بريد جديدة'}
                              </h4>
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-black ${
                                  isSpecific
                                    ? 'bg-[#EA580C] text-white'
                                    : 'bg-[#1E3A8A] text-white dark:bg-[#EDE3CF] dark:text-[#0C1427]'
                                }`}
                              >
                                {isSpecific ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                                <span>{isSpecific ? 'رسالة خاصة لورشتك' : 'رسالة عامة'}</span>
                              </span>
                            </div>
                            <span className="text-[11px] text-[#475569] dark:text-[#CBD5E1] block font-mono tabular-nums mt-0.5">
                              {msg.sender_name || 'إدارة منظومة الشمساوية'} ·{' '}
                              {msg.created_at ? new Date(msg.created_at).toLocaleString('ar-EG') : ''}
                            </span>
                          </div>
                        </div>

                        {isAcknowledged && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black">
                            <Check className="w-3 h-3" />
                            <span>تمت القراءة والموافقة</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#1E293B] dark:text-[#E2E8F0] leading-relaxed whitespace-pre-wrap font-medium">
                        {msg.content || msg.message}
                      </p>

                      {hasReplied && (
                        <div className="p-3 rounded-xl bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-1">
                          <span className="text-[10px] font-black text-[#C2410C] dark:text-[#FBBF24] block">
                            رد ورشتكم السابق:
                          </span>
                          <p className="text-xs text-[#0C1427] dark:text-[#F7F3EA] font-medium">
                            "{receipt.reply_text}"
                          </p>
                        </div>
                      )}

                      {/* Quick Reply Form */}
                      {replyingToId === msg.id ? (
                        <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-2">
                          <textarea
                            rows={2}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="اكتب ردك هنا..."
                            className="w-full p-2.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold outline-none focus:ring-2 focus:ring-[#EA580C]"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setReplyingToId(null)}
                              className="px-3 py-1.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#E9E2D4] dark:bg-[#132040] text-xs font-bold text-[#334155] dark:text-[#CBD5E1] cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              disabled={submittingReply || !replyText.trim()}
                              onClick={() => handleSendReply(msg.id)}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" />
                              <span>إرسال الرد</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex items-center justify-between gap-2 flex-wrap text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              playButtonClickSound();
                              setReplyingToId(msg.id);
                              setReplyText('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#1E3A8A] dark:text-[#EDE3CF] flex items-center gap-1.5 cursor-pointer transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{hasReplied ? 'إرسال رد إضافي' : 'الرد على الرسالة'}</span>
                          </button>

                          {!isAcknowledged && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(msg.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تأكيد الاطلاع والموافقة</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
