import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NotificationItem, UserProfile, isUserAdmin } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { supabase } from '../../lib/supabase';
import { fetchSupplierOfferAlerts } from '../../db/supplierService';
import { SupplierOfferAlert } from '../../types/supplier';
import { fetchTrainerLessonAlerts } from '../../db/memberProfileService';
import { TrainerLessonAlert, SOCIAL_PLATFORM_META } from '../../types/artisanGrowth';
import {
  playNotificationChimeSound,
  playUrgentNotificationSound,
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
  Package,
  ExternalLink,
  ShieldCheck,
  Store,
  Megaphone,
  GraduationCap,
} from 'lucide-react';

export interface UnifiedAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'admin' | 'notifications' | 'messages';
  notifications: NotificationItem[];
  adminAlerts?: any[];
  onDismissAdminAlert?: (id: string) => void;
  onNavigateToAdminTab?: (tab: string) => void;
  onNavigateToView?: (view: string) => void;
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
  adminAlerts = [],
  onDismissAdminAlert,
  onNavigateToAdminTab,
  onNavigateToView,
  profile,
  unreadMessagesCount = 0,
  onRefreshNotifications,
  onNavigateToOrder,
  onNavigateToInventory,
  onReceiptUpdate,
}) => {
  const isSuperAdmin = isUserAdmin(profile);
  const resolvedInitialTab: 'admin' | 'notifications' | 'messages' =
    initialTab === 'admin' && isSuperAdmin
      ? 'admin'
      : initialTab === 'messages'
      ? 'messages'
      : isSuperAdmin && initialTab === 'notifications' && adminAlerts.length > 0
      ? 'admin'
      : initialTab === 'admin' && !isSuperAdmin
      ? 'notifications'
      : initialTab;

  const [activeMainTab, setActiveMainTab] = useState<'admin' | 'notifications' | 'messages'>(resolvedInitialTab);
  const [notifSubTab, setNotifSubTab] = useState<'all' | 'urgent' | 'daily'>('all');

  // Messages / Mail State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [adminInbox, setAdminInbox] = useState<any[]>([]);
  const [adminWorkshopsList, setAdminWorkshopsList] = useState<any[]>([]);
  const [adminInboxLoaded, setAdminInboxLoaded] = useState<boolean>(false);
  const [showSentBroadcastsForAdmin, setShowSentBroadcastsForAdmin] = useState<boolean>(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [supplierOfferAlerts, setSupplierOfferAlerts] = useState<SupplierOfferAlert[]>([]);
  const [trainerLessonAlerts, setTrainerLessonAlerts] = useState<TrainerLessonAlert[]>([]);
  const markedReadIdsRef = useRef<Set<string>>(new Set());
  const markedAdminInboxReadRef = useRef<boolean>(false);

  const isSupplierAccount = profile?.accountRole === 'supplier';
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
      setActiveMainTab(resolvedInitialTab);
      markedAdminInboxReadRef.current = false;
    }
  }, [isOpen, resolvedInitialTab]);

  const fetchAnnouncements = async () => {
    if (!effectiveWorkshopId && !isSuperAdmin) return;
    setLoadingMessages(true);
    try {
      const headers = await getHeaders(false);
      const query = isSuperAdmin
        ? `/api/announcements?all=1`
        : `/api/announcements?workshopId=${encodeURIComponent(effectiveWorkshopId)}`;
      const res = await fetch(query, { headers });
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

  const fetchAdminInbox = async () => {
    if (!isSuperAdmin) return;
    setLoadingMessages(true);
    try {
      const headers = await getHeaders(false);
      const [inboxRes, wsRes] = await Promise.all([
        fetch('/api/admin/inbox', { headers }),
        fetch('/api/admin/workshops', { headers }),
      ]);
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        if (Array.isArray(wsData.workshops)) {
          setAdminWorkshopsList(wsData.workshops);
        }
      }
      if (inboxRes.ok) {
        const data = await inboxRes.json();
        if (Array.isArray(data.inbox)) {
          setAdminInbox(data.inbox);
        }
      }
    } catch (err) {
      console.warn('[UnifiedAlerts] Admin inbox fetch notice:', err);
    } finally {
      setAdminInboxLoaded(true);
      setLoadingMessages(false);
    }
  };

  // Fetch mail and trigger subtle chime on non-mail notification open
  useEffect(() => {
    if (!isOpen) return;
    if (isSuperAdmin) {
      fetchAdminInbox();
      fetchAnnouncements();
    } else {
      fetchAnnouncements();
    }

    if (!isSupplierAccount) {
      fetchSupplierOfferAlerts()
        .then((list) => setSupplierOfferAlerts((list || []).slice(0, 3)))
        .catch(() => {});
      fetchTrainerLessonAlerts()
        .then((list) => setTrainerLessonAlerts((list || []).slice(0, 5)))
        .catch(() => {});
    }

    if (initialTab === 'messages') {
      playTabSwitchSound();
      return;
    }

    const hasUrgent = notifications.some(
      (n) => !n.isRead && (n.type === 'stock_depletion' || n.title.includes('عاجل'))
    );
    if (hasUrgent) {
      playUrgentNotificationSound();
    } else if (notifications.some((n) => !n.isRead)) {
      playNotificationChimeSound();
    } else {
      playTabSwitchSound();
    }
  }, [isOpen, effectiveWorkshopId, isSuperAdmin]);

  // Mark Super Admin incoming inbox replies as read when viewing the Messages (Mail) tab
  useEffect(() => {
    if (!isOpen || activeMainTab !== 'messages' || !isSuperAdmin || !adminInboxLoaded) {
      return;
    }
    const hasUnread = adminInbox.some((item) => !item.admin_read_at);
    if (!hasUnread || markedAdminInboxReadRef.current) return;
    markedAdminInboxReadRef.current = true;

    (async () => {
      try {
        const headers = await getHeaders(true);
        await fetch('/api/admin/inbox/mark-read', {
          method: 'POST',
          headers,
          body: JSON.stringify({ markAll: true }),
        });
        const nowIso = new Date().toISOString();
        setAdminInbox((prev) => prev.map((m) => ({ ...m, admin_read_at: m.admin_read_at || nowIso })));
        window.dispatchEvent(new CustomEvent('alshams_admin_inbox_changed'));
        if (onReceiptUpdate) {
          try {
            await onReceiptUpdate();
          } catch {}
        }
      } catch {}
    })();
  }, [isOpen, activeMainTab, isSuperAdmin, adminInboxLoaded, adminInbox]);

  // Mark unread mail messages as read automatically for Artists when viewing the Messages (Mail) tab
  useEffect(() => {
    if (isSuperAdmin || !isOpen || activeMainTab !== 'messages' || !effectiveWorkshopId || announcements.length === 0) {
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
              body: JSON.stringify({
                action: 'read',
                workshopId: effectiveWorkshopId,
                brandName: profile?.brandName || '',
                artistName: profile?.artistName || '',
                phoneNumber: profile?.phoneNumber || '',
                email: profile?.email || '',
              }),
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
  }, [isSuperAdmin, isOpen, activeMainTab, announcements, effectiveWorkshopId]);

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
    if (isSuperAdmin) {
      if (adminInboxLoaded) {
        return adminInbox.filter((m) => !m.admin_read_at).length;
      }
      return unreadMessagesCount;
    }
    if (announcements.length > 0) {
      return announcements.filter((a) => !a?.receipt?.read_at).length;
    }
    return unreadMessagesCount;
  }, [isSuperAdmin, adminInboxLoaded, adminInbox, announcements, unreadMessagesCount]);

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

  const handleDismissNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playButtonClickSound();
    await tenantStorage.deleteNotification(id);
    onRefreshNotifications();
  };

  const handleNotificationNavigate = async (item: NotificationItem) => {
    playButtonClickSound();
    if (!item.isRead) {
      await tenantStorage.markNotificationAsRead(item.id);
      onRefreshNotifications();
    }
    if (item.relatedOrderId && onNavigateToOrder) {
      onNavigateToOrder(item.relatedOrderId);
      onClose();
      return;
    }
    if (item.type === 'stock_depletion') {
      if (onNavigateToInventory) {
        onNavigateToInventory();
      } else if (onNavigateToView) {
        onNavigateToView('materials');
      }
      onClose();
      return;
    }
    if (item.type === 'overdue_deposit' || item.type === 'upcoming_deposit') {
      onNavigateToView?.('treasuries');
      onClose();
      return;
    }
    if (item.type === 'daily_sales_reminder' || item.type === 'milestone_sales') {
      onNavigateToView?.('sales');
      onClose();
      return;
    }
    if (item.type === 'upcoming_delivery') {
      onNavigateToView?.('sales');
      onClose();
      return;
    }
    onClose();
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
        body: JSON.stringify({
          action: 'acknowledge',
          workshopId: effectiveWorkshopId,
          brandName: profile?.brandName || '',
          artistName: profile?.artistName || '',
          phoneNumber: profile?.phoneNumber || '',
          email: profile?.email || '',
        }),
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
          brandName: profile?.brandName || '',
          artistName: profile?.artistName || '',
          phoneNumber: profile?.phoneNumber || '',
          email: profile?.email || '',
        }),
      });
      if (res.ok) {
        playSuccessSound();
        setActionNotice('تم إرسال ردك بنجاح إلى كبير عيلة الشمساوية.');
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

  const handleAdminDirectReply = async (inboxItem: any) => {
    const targetWid = inboxItem?.workshop_id || inboxItem?.workshops?.id || '';
    if (!targetWid || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const headers = await getHeaders(true);
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipient_type: 'specific',
          recipient_workshop_id: targetWid,
          recipient_workshop_name: inboxItem?.workshops?.brand_name || inboxItem?.brand_name || '',
          title: '✉️ رد إداري مباشر من كبير عيلة الشمساوية',
          content: replyText.trim(),
        }),
      });
      if (res.ok) {
        playSuccessSound();
        setActionNotice(
          `تم إرسال ردك المباشر إلى ورشة "${inboxItem?.workshops?.brand_name || inboxItem?.brand_name || 'الفنان'}" بنجاح.`
        );
        setReplyingToId(null);
        setReplyText('');
        setTimeout(() => setActionNotice(''), 3500);
        await fetchAnnouncements();
        window.dispatchEvent(new CustomEvent('alshams_admin_inbox_changed'));
      } else {
        playErrorSound();
        setActionNotice('تعذر إرسال الرد المباشر.');
        setTimeout(() => setActionNotice(''), 3000);
      }
    } catch {
      playErrorSound();
      setActionNotice('تعذر إرسال الرد المباشر.');
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

        {/* Tabs Header: 3 tabs for Super Admin, 2 tabs for Workshop */}
        <div
          className={`p-2.5 bg-[#E9E2D4] dark:bg-[#0D162E] border-b border-[#D4CCBC] dark:border-[#22355E] grid ${
            isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'
          } gap-2 shrink-0`}
        >
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                playTabSwitchSound();
                setActiveMainTab('admin');
              }}
              className={`py-2.5 px-2 sm:px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer border ${
                activeMainTab === 'admin'
                  ? 'bg-[#F7F3EA] dark:bg-[#132040] text-[#C2410C] dark:text-[#FBBF24] border-[#EA580C]/60 shadow-sm'
                  : 'bg-transparent border-transparent text-[#334155] dark:text-[#CBD5E1] hover:bg-[#DFD7C6]/60 dark:hover:bg-[#132040]/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
              <span className="truncate">إشعارات إدارية</span>
              {adminAlerts.length > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-[#EA580C] text-white text-[11px] font-mono tabular-nums font-black flex items-center justify-center shrink-0">
                  {adminAlerts.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              playTabSwitchSound();
              setActiveMainTab('notifications');
            }}
            className={`py-2.5 px-2 sm:px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer border ${
              activeMainTab === 'notifications'
                ? 'bg-[#F7F3EA] dark:bg-[#132040] text-[#C2410C] dark:text-[#FBBF24] border-[#EA580C]/60 shadow-sm'
                : 'bg-transparent border-transparent text-[#334155] dark:text-[#CBD5E1] hover:bg-[#DFD7C6]/60 dark:hover:bg-[#132040]/60'
            }`}
          >
            <Bell className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
            <span className="truncate">{isSuperAdmin ? 'إشعارات الورشة' : 'الإشعارات'}</span>
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
            className={`py-2.5 px-2 sm:px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer border ${
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

        {/* Admin Alerts Tab (Super Admin Only) */}
        {isSuperAdmin && activeMainTab === 'admin' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>تنبيهات وطلبات اعتماد المنتجات والورش ({adminAlerts.length})</span>
              </div>
            </div>

            {adminAlerts.length === 0 ? (
              <div className="text-center py-12 text-[#475569] dark:text-[#CBD5E1] space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto opacity-45 text-[#C2410C] dark:text-[#FBBF24]" />
                <p className="text-xs font-bold">لا توجد طلبات اعتماد منتجات أو تنبيهات إدارية معلقة حالياً ✓</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {adminAlerts.map((alertItem: any) => (
                  <div
                    key={alertItem.id}
                    onClick={() => {
                      playButtonClickSound();
                      onNavigateToAdminTab?.(alertItem.targetTab || 'product_approvals');
                      onClose();
                    }}
                    className="p-3.5 rounded-2xl border bg-[#FFF7ED] dark:bg-[#132040] border-[#EA580C]/55 dark:border-[#FBBF24]/50 hover:border-[#EA580C] transition-all text-right space-y-2 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 p-2 rounded-xl bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] shrink-0">
                          <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            {alertItem.title}
                          </h4>
                          <p className="text-xs text-[#334155] dark:text-[#CBD5E1] mt-1 leading-relaxed font-medium">
                            {alertItem.message}
                          </p>
                          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24]">
                            <ExternalLink className="w-3 h-3" />
                            <span>اضغط للانتقال مباشرة للمراجعة والاعتماد</span>
                          </div>
                        </div>
                      </div>

                      {onDismissAdminAlert && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playButtonClickSound();
                            onDismissAdminAlert(alertItem.id);
                          }}
                          className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer shrink-0"
                          title="إخفاء وحذف التنبيه"
                          aria-label="إخفاء وحذف التنبيه"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

            {/* Expert / Trainer New Lesson Broadcast Alerts */}
            {!isSupplierAccount && trainerLessonAlerts.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-l from-[#FFF7ED] via-[#FEF3C7]/60 to-[#FFF7ED] dark:from-[#132040] dark:to-[#172554] border-2 border-[#EA580C]/50 dark:border-[#FBBF24]/45 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span>منشورات وشروحات جديدة من خبراء ومدربي العيلة ({trainerLessonAlerts.length})</span>
                  </div>
                  {onNavigateToView && (
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        onNavigateToView('family');
                        onClose();
                      }}
                      className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] dark:hover:text-[#FBBF24] cursor-pointer"
                    >
                      فتح طبلية العيلة ←
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {trainerLessonAlerts.map((alert) => {
                    const platLabel = SOCIAL_PLATFORM_META[alert.platform]?.label || 'شرح مدمج';
                    return (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          playButtonClickSound();
                          try {
                            if (alert.familyPostId) {
                              sessionStorage.setItem('alshams_focus_family_post', alert.familyPostId);
                            }
                          } catch {}
                          onNavigateToView?.('family');
                          onClose();
                        }}
                        className="w-full text-right p-3 rounded-xl bg-white/90 dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition flex items-start justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                            نشر الخبير/المدرب <span className="text-[#C2410C] dark:text-[#FBBF24]">{alert.trainerName}</span> منشوراً جديداً مهماً: «{alert.title}»
                          </p>
                          <p className="text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1]">
                            اضغط للمشاهدة مباشرة داخل منتدى العيلة والتعليق والتفاعل · {platLabel}
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-[#EA580C] text-white text-[10px] font-black shrink-0">
                          شاهد الآن
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isSupplierAccount && supplierOfferAlerts.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#FFF7ED] dark:bg-[#132040] border border-[#EA580C]/45 dark:border-[#FBBF24]/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span>أحدث تنبيهات وعروض الموردين ({supplierOfferAlerts.length})</span>
                  </div>
                  {onNavigateToView && (
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        onNavigateToView('suppliers_market');
                        onClose();
                      }}
                      className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] hover:text-[#EA580C] dark:hover:text-[#FBBF24] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>فتح سوق الموردين</span>
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {supplierOfferAlerts.map((offer) => (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        onNavigateToView?.('suppliers_market');
                        onClose();
                      }}
                      className="w-full text-right p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition flex items-start justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                          {offer.title}
                        </p>
                        <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] line-clamp-1">
                          {offer.supplierBrand || 'مورد معتمد'}
                          {offer.message ? ` · ${offer.message}` : ''}
                        </p>
                      </div>
                      {offer.discountBadge && (
                        <span className="font-mono tabular-nums text-xs font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                          {offer.discountBadge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                      onClick={() => handleNotificationNavigate(item)}
                      className={`p-3.5 rounded-2xl border transition-all text-right space-y-2 cursor-pointer hover:border-[#EA580C] ${
                        !item.isRead
                          ? urgentItem
                            ? 'bg-rose-50/90 dark:bg-rose-950/35 border-rose-300 dark:border-rose-700/70'
                            : 'bg-[#FFF7ED] dark:bg-[#132040] border-[#EA580C]/55 dark:border-[#FBBF24]/50'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 p-2 rounded-xl bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] shrink-0">
                            {getNotificationIcon(item.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
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

                        <div className="flex items-center gap-1 shrink-0">
                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(item.id);
                              }}
                              className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:text-[#EA580C] dark:hover:text-[#FBBF24] transition cursor-pointer shrink-0"
                              title="تحديد كمقروء"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDismissNotification(item.id, e)}
                            className="p-1.5 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1] hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer shrink-0"
                            title="حذف وإخفاء الإشعار"
                            aria-label="حذف وإخفاء الإشعار"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
            {/* Mail Toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-black text-[#1E3A8A] dark:text-[#EDE3CF] flex items-center gap-1.5">
                <Mail className="w-4 h-4 shrink-0" />
                <span>
                  {isSuperAdmin
                    ? `بريد الوارد — ردود الفنانين والورش (${adminInbox.length})`
                    : `صندوق البريد والمراسلات (${announcements.length})`}
                </span>
              </div>

              {isSuperAdmin && onNavigateToAdminTab && (
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    onNavigateToAdminTab('messaging');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black text-[#1E3A8A] dark:text-[#FBBF24] flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال رسالة جديدة أو فتح البريد الكامل</span>
                </button>
              )}
            </div>

            {isSuperAdmin ? (
              loadingMessages && !adminInboxLoaded ? (
                <div className="text-center py-12 text-[#475569] dark:text-[#CBD5E1] text-xs">
                  <div className="w-6 h-6 border-2 border-[#1E3A8A] dark:border-[#EDE3CF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p>جارٍ تحميل رسائل وردود الفنانين...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adminInbox.length === 0 ? (
                    <div className="text-center py-10 text-[#475569] dark:text-[#CBD5E1] space-y-2 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
                      <Mail className="w-10 h-10 mx-auto opacity-45 text-[#1E3A8A] dark:text-[#EDE3CF]" />
                      <p className="text-xs font-bold">لا توجد ردود أو رسائل واردة من الفنانين حالياً.</p>
                      <p className="text-[11px] opacity-80">
                        تظهر هنا جميع ردود أصحاب الورش على توجيهاتك مع اسم الورشة وصاحبها.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminInbox.map((msg, idx) => {
                        const itemKey = String(msg.id || msg.inbox_key || idx);
                        const msgWid = msg.workshop_id || msg.workshops?.id || '';
                        const msgEmail = String(msg.email || msg.workshops?.email || '').trim().toLowerCase();
                        const matchedWs = adminWorkshopsList.find(
                          (w) =>
                            (msgWid && (w.id === msgWid || w.ownerUid === msgWid)) ||
                            (msgEmail && w.email?.toLowerCase() === msgEmail)
                        );
                        const resolvedWid = matchedWs?.id || msgWid;

                        const placeholderBrands = new Set(['', 'ورشة الشمساوية', 'الشمساوية هاند ميد', 'ورشة حرفية بالشمساوية', 'ورشة بالشمساوية', 'ورشة مسجلة بالشمساوية', 'ورشة الشمس', 'زائر المنظومة']);
                        const placeholderArtists = new Set(['', 'فنان الشمساوية', 'صاحب الورشة', 'فنان', 'زائر خارجي', 'مرسل خارجي']);
                        const pickBrand = (...vals: any[]) => vals.map((v) => String(v || '').trim()).find((s) => s && !placeholderBrands.has(s));
                        const pickArtist = (...vals: any[]) => vals.map((v) => String(v || '').trim()).find((s) => s && !placeholderArtists.has(s));

                        const brandLabel =
                          pickBrand(matchedWs?.brandName, msg.workshops?.brand_name, msg.brand_name, msg.workshop_name) ||
                          (resolvedWid ? 'ورشة حرفية بالشمساوية' : 'زائر المنظومة');
                        const artistLabel =
                          pickArtist(matchedWs?.artistName, msg.workshops?.artist_name, msg.artist_name) ||
                          (msgEmail ? msgEmail.split('@')[0] : resolvedWid ? 'صاحب الورشة' : 'زائر خارجي');
                        const phoneRaw = String(matchedWs?.phoneNumber || msg.workshops?.phone_number || msg.phone_number || '').replace(/\D/g, '');
                        const waPhone = phoneRaw.startsWith('01') ? `2${phoneRaw}` : phoneRaw;
                        const canDirectReply = Boolean(resolvedWid);
                        const isUnread = !msg.admin_read_at;

                        return (
                          <div
                            key={itemKey}
                            className={`p-4 rounded-2xl border space-y-3 text-right transition ${
                              isUnread
                                ? 'bg-[#EFF6FF] dark:bg-[#132040] border-[#1E3A8A]/60 dark:border-[#EDE3CF]/60 shadow-sm'
                                : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] text-white dark:bg-[#EDE3CF] dark:text-[#0C1427] flex items-center justify-center shrink-0">
                                  <Mail className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                                      {brandLabel}
                                    </h4>
                                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md font-black bg-[#E9E2D4] dark:bg-[#1A2B54] text-[#C2410C] dark:text-[#FBBF24]">
                                      صاحب الورشة: {artistLabel}
                                    </span>
                                    {isUnread && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#1E3A8A] text-white dark:bg-[#EDE3CF] dark:text-[#0C1427]">
                                        جديد
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-[#475569] dark:text-[#CBD5E1] block mt-0.5">
                                    بخصوص: {msg.admin_announcements?.title || 'رسالة من الإدارة'} ·{' '}
                                    <span className="font-mono tabular-nums">
                                      {msg.replied_at ? new Date(msg.replied_at).toLocaleString('ar-EG') : ''}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[#E9E2D4]/75 dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-[#0C1427] dark:text-[#F7F3EA] leading-relaxed whitespace-pre-wrap font-bold">
                              {msg.reply_text}
                            </div>

                            {replyingToId === itemKey ? (
                              <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-2">
                                <textarea
                                  rows={2}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder={`اكتب ردك المباشر لورشة ${brandLabel} (${artistLabel})...`}
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
                                    onClick={() => handleAdminDirectReply({ ...msg, workshop_id: resolvedWid, brand_name: brandLabel })}
                                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>إرسال الرد المباشر</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex items-center justify-between gap-2 flex-wrap text-xs">
                                {canDirectReply && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playButtonClickSound();
                                      setReplyingToId(itemKey);
                                      setReplyText('');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black text-[#1E3A8A] dark:text-[#EDE3CF] flex items-center gap-1.5 cursor-pointer transition"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>رد مباشر على الورشة</span>
                                  </button>
                                )}

                                {waPhone && (
                                  <a
                                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`أهلاً يا ${artistLabel} (${brandLabel})، بخصوص ردكم في منظومة الشمساوية`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>تواصل واتساب</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Collapsible Outgoing Broadcasts Archive for Admin */}
                  {announcements.length > 0 && (
                    <div className="pt-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
                      <button
                        type="button"
                        onClick={() => setShowSentBroadcastsForAdmin((v) => !v)}
                        className="w-full py-2 px-3 rounded-xl bg-[#E9E2D4] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black text-[#334155] dark:text-[#CBD5E1] flex items-center justify-between cursor-pointer"
                      >
                        <span>سجل التوجيهات المرسلة للورش ({announcements.length})</span>
                        <span>{showSentBroadcastsForAdmin ? 'إخفاء ▲' : 'عرض ▼'}</span>
                      </button>

                      {showSentBroadcastsForAdmin && (
                        <div className="mt-2.5 space-y-2">
                          {announcements.slice(0, 10).map((ann) => (
                            <div
                              key={ann.id}
                              className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-right space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">
                                  {ann.title}
                                </span>
                                <span className="font-mono text-[#475569] dark:text-[#94A3B8]">
                                  {ann.recipient_type === 'specific'
                                    ? `خاص: ${ann.recipient_workshop_name || 'ورشة'}`
                                    : 'عام'}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] line-clamp-2">
                                {ann.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            ) : loadingMessages && announcements.length === 0 ? (
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

                      {(() => {
                        const txt = String(msg.content || msg.message || '');
                        const match = txt.match(/#\/supplier\/([^\s\n]+)/i);
                        if (!match?.[1]) return null;
                        const slug = match[1];
                        return (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                window.location.hash = `#/supplier/${slug}`;
                                onClose();
                              }}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>فتح متجر وقائمة أسعار المورد مباشرة</span>
                            </button>
                          </div>
                        );
                      })()}

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
