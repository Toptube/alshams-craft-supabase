import React, { useState, useEffect, useMemo } from 'react';
import { NotificationItem, UserProfile } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  playNotificationChimeSound,
  playUrgentNotificationSound,
  playButtonClickSound,
  playSuccessSound,
} from '../../lib/sounds';
import {
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  Clock,
  DollarSign,
  Trophy,
  Package,
  Calendar,
  Layers,
  Flame,
  CheckCircle2,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../../lib/browserNotifications';
import { useTranslation } from '../../lib/i18n';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  profile: UserProfile;
  onRefreshNotifications: () => void;
  onNavigateToOrder?: (orderId: string) => void;
  onNavigateToInventory?: () => void;
}

export type NotificationTab = 'all' | 'urgent' | 'daily';

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  profile,
  onRefreshNotifications,
  onNavigateToOrder,
  onNavigateToInventory,
}) => {
  const { t: tr } = useTranslation();
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [selectedOrderIdForStatus, setSelectedOrderIdForStatus] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [browserNotifPermission, setBrowserNotifPermission] = useState(
    getBrowserNotificationPermission()
  );

  // Is a notification considered "urgent"?
  const isUrgentNotification = (item: NotificationItem): boolean => {
    return (
      item.type === 'stock_depletion' ||
      item.type === 'overdue_deposit' ||
      item.title.includes('عاجل') ||
      item.title.includes('تنبيه نفاد') ||
      item.message.includes('أوشكت على النفاد')
    );
  };

  // Play distinctive chimes when opening drawer
  useEffect(() => {
    if (isOpen) {
      const hasUrgentUnread = notifications.some(
        (n) => !n.isRead && isUrgentNotification(n)
      );
      if (hasUrgentUnread) {
        playUrgentNotificationSound();
      } else {
        playNotificationChimeSound();
      }
    }
  }, [isOpen]);

  // Tab filtering
  const urgentNotifications = useMemo(
    () => notifications.filter((n) => isUrgentNotification(n)),
    [notifications]
  );

  const dailyNotifications = useMemo(
    () => notifications.filter((n) => !isUrgentNotification(n)),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'urgent') return urgentNotifications;
    if (activeTab === 'daily') return dailyNotifications;
    return notifications;
  }, [activeTab, notifications, urgentNotifications, dailyNotifications]);

  const unreadCountTotal = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );
  const unreadCountUrgent = useMemo(
    () => urgentNotifications.filter((n) => !n.isRead).length,
    [urgentNotifications]
  );
  const unreadCountDaily = useMemo(
    () => dailyNotifications.filter((n) => !n.isRead).length,
    [dailyNotifications]
  );

  if (!isOpen) return null;

  const handleClose = () => {
    playButtonClickSound();
    onClose();
  };

  const handleTabClick = (tab: NotificationTab) => {
    playButtonClickSound();
    setActiveTab(tab);
  };

  const handleMarkAsRead = async (id: string) => {
    playButtonClickSound();
    await tenantStorage.markNotificationAsRead(id);
    onRefreshNotifications();
  };

  const handleMarkAllRead = async () => {
    playButtonClickSound();
    const targetTenantId = profile.tenantId || profile.workshopId || profile.id;
    await tenantStorage.markAllNotificationsAsRead(targetTenantId);
    playSuccessSound();
    onRefreshNotifications();
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    playButtonClickSound();
    setUpdatingOrderId(orderId);
    try {
      const targetTenantId = profile.tenantId || profile.workshopId || profile.id;
      await tenantStorage.updateOrderStatus(targetTenantId, orderId, newStatus);
      setSelectedOrderIdForStatus(null);
      playSuccessSound();
      onRefreshNotifications();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingOrderId(null);
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
    <div className="fixed inset-0 z-50 flex justify-start bg-black/55 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md h-full shadow-2xl border-l border-stone-200 dark:border-stone-800 flex flex-col text-right animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-2xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer active:scale-95"
            aria-label="إغلاق مركز الإشعارات"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-xs">
                <Bell className="w-5 h-5" />
              </div>
              {unreadCountTotal > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black animate-pulse shadow-xs">
                  {unreadCountTotal}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-black text-sm text-stone-900 dark:text-stone-100">
                {tr('notif_center_title')}
              </h3>
              <span className="text-[10px] text-stone-400 block font-mono">
                {unreadCountTotal > 0 ? `${unreadCountTotal} ${tr('notif_unread_count')}` : tr('notif_all_read')}
              </span>
            </div>
          </div>
        </div>

        {/* TABS FOR FILTERING: الكل | عاجلة | يومية */}
        <div className="p-2.5 bg-stone-50 dark:bg-stone-900/70 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 bg-stone-200/60 dark:bg-stone-800 p-1 rounded-2xl flex-1">
            {/* Tab: الكل */}
            <button
              type="button"
              onClick={() => handleTabClick('all')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <span>{tr('notif_all')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-600 text-stone-700 dark:text-stone-200">
                {notifications.length}
              </span>
            </button>

            {/* Tab: عاجلة */}
            <button
              type="button"
              onClick={() => handleTabClick('urgent')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'urgent'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{tr('notif_urgent')}</span>
              {unreadCountUrgent > 0 ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white text-rose-700 font-black animate-pulse">
                  {unreadCountUrgent}
                </span>
              ) : (
                <span className="text-[10px] font-mono opacity-80">
                  {urgentNotifications.length}
                </span>
              )}
            </button>

            {/* Tab: يومية */}
            <button
              type="button"
              onClick={() => handleTabClick('daily')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'daily'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{tr('notif_daily')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-600 text-stone-700 dark:text-stone-200">
                {dailyNotifications.length}
              </span>
            </button>
          </div>

          {/* زر "الكل مقروء" (Mark all as read) مع صوت كليك مميز */}
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCountTotal === 0}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-black text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-95 shrink-0"
            title={tr('notif_mark_all_read')}
          >
            <CheckCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">{tr('notif_mark_all_read')}</span>
          </button>
        </div>

        {/* Browser Notifications Permission Prompt Banner */}
        {browserNotifPermission !== 'granted' && browserNotifPermission !== 'unsupported' && (
          <div className="mx-3.5 mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/60 dark:from-stone-800 dark:to-stone-800/80 border border-amber-300/80 dark:border-stone-700 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-right">
                <span className="text-[11px] font-black text-stone-900 dark:text-stone-100 block">
                  {tr('notif_enable_browser')}
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 block leading-tight">
                  {tr('notif_enable_browser_sub')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                playButtonClickSound();
                const granted = await requestBrowserNotificationPermission();
                if (granted) {
                  setBrowserNotifPermission('granted');
                  playSuccessSound();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black transition cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              {tr('notif_enable_now')}
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-amber-50 dark:bg-stone-800 border border-amber-200/80 dark:border-stone-700 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
                {activeTab === 'urgent' ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                ) : (
                  <Bell className="w-7 h-7" />
                )}
              </div>
              <div>
                <p className="text-xs font-black text-stone-700 dark:text-stone-300">
                  {activeTab === 'urgent'
                    ? tr('notif_no_urgent')
                    : activeTab === 'daily'
                    ? tr('notif_no_daily')
                    : tr('notif_no_all')}
                </p>
                <span className="text-[11px] text-stone-400 mt-1 block">
                  {tr('notif_all_stable')}
                </span>
              </div>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const isUrgent = isUrgentNotification(item);
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all text-right ${
                    item.isRead
                      ? 'bg-stone-50/70 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                      : isUrgent
                      ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 shadow-sm text-stone-900 dark:text-stone-100 ring-1 ring-rose-400/30'
                      : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm text-stone-900 dark:text-stone-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(item.id)}
                        title={item.isRead ? '✓' : '•'}
                        className={`w-2.5 h-2.5 rounded-full cursor-pointer transition active:scale-75 ${
                          item.isRead
                            ? 'bg-stone-300 dark:bg-stone-600'
                            : isUrgent
                            ? 'bg-rose-600 ring-2 ring-rose-400/50 animate-pulse'
                            : 'bg-amber-500 ring-2 ring-amber-400/40'
                        }`}
                      />
                      <span className="font-extrabold text-xs">{item.title}</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white dark:bg-stone-800 shadow-xs flex-shrink-0 border border-stone-200/60 dark:border-stone-700">
                      {getNotificationIcon(item.type)}
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed font-medium">
                    {item.message}
                  </p>

                  {/* Operational Execution Tracker Dropdown */}
                  {item.relatedOrderId && (
                    <div className="mt-2.5 pt-2 border-t border-stone-200/60 dark:border-stone-700/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>{tr('notif_order_status')}</span>
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          {new Date(item.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          disabled={updatingOrderId === item.relatedOrderId}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleStatusChange(item.relatedOrderId!, e.target.value);
                            }
                          }}
                          defaultValue=""
                          className="flex-1 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-xs"
                        >
                          <option value="" disabled>{tr('notif_select_status')}</option>
                          <option value="in_progress">{tr('notif_in_progress')}</option>
                          <option value="shipping">{tr('notif_shipping')}</option>
                          <option value="ready">{tr('notif_shipped')}</option>
                          <option value="delivered">{tr('notif_delivered')}</option>
                        </select>
                        {updatingOrderId === item.relatedOrderId && (
                          <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* If notification is related to low inventory */}
                  {item.type === 'stock_depletion' && onNavigateToInventory && (
                    <div className="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => {
                          playButtonClickSound();
                          onNavigateToInventory();
                          onClose();
                        }}
                        className="text-[10px] font-black text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Package className="w-3 h-3" />
                        <span>{tr('notif_open_material')}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 text-center bg-stone-50 dark:bg-stone-900 flex items-center justify-between px-4">
          <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{tr('notif_smart_system_footer')}</span>
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="text-[11px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
