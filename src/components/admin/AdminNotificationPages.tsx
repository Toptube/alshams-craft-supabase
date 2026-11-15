import React, { useMemo, useState } from 'react';
import {
  Mail,
  Building2,
  Store,
  ShieldCheck,
  ArrowRight,
  Search,
  X,
  Send,
  Trash2,
  CheckCheck,
  ExternalLink,
  MessageCircle,
  Download,
} from 'lucide-react';
import { AdminPageId, EnrichedWorkshopProfile, formatWhatsAppPhone } from './adminTypes';
import { CloudMarketplaceProduct } from '../../db/marketplaceCloud';

interface AdminNotificationPagesProps {
  mode: 'notif_messages' | 'notif_workshops' | 'notif_store' | 'notif_system';
  onBack: () => void;
  onNavigatePage: (page: AdminPageId) => void;
  workshops: EnrichedWorkshopProfile[];
  inboxList: any[];
  announcementsList: any[];
  adminAlerts: any[];
  cloudProducts: CloudMarketplaceProduct[];
  ordersList: any[];
  newAnnTitle: string;
  setNewAnnTitle: (v: string) => void;
  newAnnContent: string;
  setNewAnnContent: (v: string) => void;
  newAnnRecipientType: 'all' | 'specific';
  setNewAnnRecipientType: (v: 'all' | 'specific') => void;
  newAnnRecipientWorkshopId: string;
  setNewAnnRecipientWorkshopId: (v: string) => void;
  sendingAnnouncement: boolean;
  onSendAnnouncement: (e: React.FormEvent) => Promise<void>;
  onDeleteAnnouncement: (annId: string) => Promise<void>;
  deletingAnnId: string | null;
  directReplyTarget: any | null;
  setDirectReplyTarget: (msg: any | null) => void;
  directReplyContent: string;
  setDirectReplyContent: (val: string) => void;
  onSendDirectReply: (msg: any) => Promise<void>;
  onMarkAllInboxRead: () => Promise<void>;
  onDismissAlert: (alertId: string) => void;
  onExportCsv: () => Promise<void>;
}

export const AdminNotificationPages: React.FC<AdminNotificationPagesProps> = ({
  mode,
  onBack,
  onNavigatePage,
  workshops,
  inboxList,
  announcementsList,
  adminAlerts,
  cloudProducts,
  ordersList,
  newAnnTitle,
  setNewAnnTitle,
  newAnnContent,
  setNewAnnContent,
  newAnnRecipientType,
  setNewAnnRecipientType,
  newAnnRecipientWorkshopId,
  setNewAnnRecipientWorkshopId,
  sendingAnnouncement,
  onSendAnnouncement,
  onDeleteAnnouncement,
  deletingAnnId,
  directReplyTarget,
  setDirectReplyTarget,
  directReplyContent,
  setDirectReplyContent,
  onSendDirectReply,
  onMarkAllInboxRead,
  onDismissAlert,
  onExportCsv,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>('all');
  const [alertCategoryFilter, setAlertCategoryFilter] = useState<string>('all');
  const [msgTab, setMsgTab] = useState<'inbox' | 'compose' | 'sent'>('inbox');

  // 1. الرسائل (notif_messages)
  const filteredInbox = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inboxList.filter((m) => {
      const isRead = Boolean(m.admin_read_at);
      if (filterType === 'unread' && isRead) return false;
      if (filterType === 'read' && !isRead) return false;
      if (!q) return true;
      const brand = m.workshops?.brand_name || m.brand_name || '';
      const artist = m.workshops?.artist_name || m.artist_name || '';
      const body = m.reply_text || '';
      return (
        brand.toLowerCase().includes(q) ||
        artist.toLowerCase().includes(q) ||
        body.toLowerCase().includes(q)
      );
    });
  }, [inboxList, searchQuery, filterType]);

  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return announcementsList;
    return announcementsList.filter(
      (a) =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.content || '').toLowerCase().includes(q)
    );
  }, [announcementsList, searchQuery]);

  // 2. الورش (notif_workshops)
  const workshopAlerts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return adminAlerts.filter((a) => {
      const kind = String(a.type || a.category || '').toLowerCase();
      const isWsKind =
        kind.includes('workshop') ||
        kind.includes('application') ||
        kind.includes('appeal') ||
        !kind.includes('product');
      if (!isWsKind && alertCategoryFilter === 'all') return true;
      if (alertCategoryFilter !== 'all' && !kind.includes(alertCategoryFilter)) return false;
      if (!q) return true;
      return (
        String(a.title || '').toLowerCase().includes(q) ||
        String(a.message || a.content || '').toLowerCase().includes(q)
      );
    });
  }, [adminAlerts, searchQuery, alertCategoryFilter]);

  // 3. متجري (notif_store)
  const storeNotificationItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pendingProds = cloudProducts
      .filter((p) => p.status === 'pending_approval')
      .map((p) => ({
        id: `prod_${p.id}`,
        kind: 'product',
        title: `منتج معلق: ${p.product_name}`,
        subtitle: `${p.brand_name} · ${(p.store_price || p.retail_price || 0).toLocaleString('ar-EG')} ج.م`,
        date: p.created_at,
        targetPage: 'product_approvals' as AdminPageId,
      }));
    const pendingOrders = ordersList
      .filter((o) => !o.advancePaymentConfirmed || o.marketplaceStatus === 'pending_approval')
      .map((o) => ({
        id: `ord_${o.id}`,
        kind: 'order',
        title: `طلب جديد #${o.invoiceNumber || o.id} — ${o.customerName}`,
        subtitle: `${o.governorate || ''} · ${Number(o.finalTotal || 0).toLocaleString('ar-EG')} ج.م`,
        date: o.createdAt,
        targetPage: 'marketplace' as AdminPageId,
      }));
    const all = [...pendingOrders, ...pendingProds];
    return all.filter((item) => {
      if (alertCategoryFilter !== 'all' && item.kind !== alertCategoryFilter) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
    });
  }, [cloudProducts, ordersList, searchQuery, alertCategoryFilter]);

  // 4. النظام (notif_system)
  const systemAlerts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return adminAlerts.filter((a) => {
      const kind = String(a.type || 'system').toLowerCase();
      if (alertCategoryFilter !== 'all' && kind !== alertCategoryFilter) return false;
      if (!q) return true;
      return (
        String(a.title || '').toLowerCase().includes(q) ||
        String(a.message || a.content || '').toLowerCase().includes(q)
      );
    });
  }, [adminAlerts, searchQuery, alertCategoryFilter]);

  const headerMeta = {
    notif_messages: { title: 'مركز الرسائل والوارد', icon: <Mail className="w-5 h-5 text-sky-600 dark:text-sky-300" /> },
    notif_workshops: { title: 'إشعارات وتنبيهات الورش', icon: <Building2 className="w-5 h-5 text-emerald-600" /> },
    notif_store: { title: 'إشعارات متجري وسوق الشمساوية', icon: <Store className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" /> },
    notif_system: { title: 'تنبيهات وسجلات النظام', icon: <ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-300" /> },
  }[mode];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5 pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>الرئيسية</span>
          </button>
          <h1 className="text-base sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            {headerMeta.icon}
            <span>{headerMeta.title}</span>
          </h1>
        </div>

        {mode === 'notif_messages' && (
          <button
            type="button"
            onClick={onMarkAllInboxRead}
            className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>تحديد الكل كمقروء</span>
          </button>
        )}

        {mode === 'notif_system' && (
          <button
            type="button"
            onClick={onExportCsv}
            className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>استخراج CSV</span>
          </button>
        )}
      </div>

      {/* Search + Advanced Filter Strip */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="md:col-span-7 relative">
          <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث فوري في محتوى الإشعارات والرسائل..."
            className="w-full h-10 pr-9 pl-7 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-5">
          {mode === 'notif_messages' ? (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            >
              <option value="all">كل الرسائل ({inboxList.length})</option>
              <option value="unread">غير مقروءة</option>
              <option value="read">مقروءة</option>
            </select>
          ) : mode === 'notif_store' ? (
            <select
              value={alertCategoryFilter}
              onChange={(e) => setAlertCategoryFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            >
              <option value="all">الكل (الطلبات + المنتجات المعلقة)</option>
              <option value="order">طلبات متجر قيد التأكيد</option>
              <option value="product">منتجات بانتظار الاعتماد</option>
            </select>
          ) : (
            <select
              value={alertCategoryFilter}
              onChange={(e) => setAlertCategoryFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            >
              <option value="all">كل التصنيفات ({adminAlerts.length})</option>
              <option value="application">طلبات الانضمام</option>
              <option value="appeal">الطعون والتظلمات</option>
              <option value="product">المنتجات</option>
              <option value="system">أحداث النظام</option>
            </select>
          )}
        </div>
      </div>

      {/* MODE 1: الرسائل (Inbox, Broadcast Composer, Sent Announcements) */}
      {mode === 'notif_messages' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'inbox', label: `صندوق الوارد (${filteredInbox.length})` },
              { id: 'compose', label: 'إرسال توجيه / رسالة جماعية' },
              { id: 'sent', label: `سجل المراسلات الصادرة (${filteredAnnouncements.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMsgTab(t.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border cursor-pointer ${
                  msgTab === t.id
                    ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427] dark:bg-[#EA580C] dark:text-white'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {msgTab === 'inbox' && (
            filteredInbox.length === 0 ? (
              <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
                لا توجد رسائل مطابقة حالياً.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInbox.map((m) => {
                  const brand = m.workshops?.brand_name || m.brand_name || 'فنان الشمساوية';
                  const artist = m.workshops?.artist_name || m.artist_name || '';
                  const phone = formatWhatsAppPhone(m.workshops?.phone_number || m.phone_number);
                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black">{brand} {artist ? `— ${artist}` : ''}</h3>
                          <span className="text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
                            {m.replied_at ? new Date(m.replied_at).toLocaleString('ar-EG') : ''}
                          </span>
                        </div>
                        {!m.admin_read_at && (
                          <span className="px-2 py-0.5 rounded bg-[#EA580C] text-white text-[10px] font-black">جديد</span>
                        )}
                      </div>
                      <p className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-bold leading-relaxed">
                        {m.reply_text}
                      </p>

                      {directReplyTarget?.id === m.id ? (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            type="text"
                            value={directReplyContent}
                            onChange={(e) => setDirectReplyContent(e.target.value)}
                            placeholder="اكتب ردك المباشر هنا..."
                            className="flex-1 h-9 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => onSendDirectReply(m)}
                            disabled={sendingAnnouncement}
                            className="px-4 h-9 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                          >
                            إرسال الرد
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectReplyTarget(null)}
                            className="px-3 h-9 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDirectReplyTarget(m);
                              setDirectReplyContent('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#0C1427] text-[#FBBF24] text-xs font-black flex items-center gap-1 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>رد مباشر داخل المنظومة</span>
                          </button>
                          {phone && (
                            <a
                              href={`https://wa.me/${phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold"
                            >
                              تواصل واتساب
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {msgTab === 'compose' && (
            <form
              onSubmit={onSendAnnouncement}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={newAnnRecipientType}
                  onChange={(e) => setNewAnnRecipientType(e.target.value as any)}
                  className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                >
                  <option value="all">توجيه عام لكل الورش المسجلة</option>
                  <option value="specific">رسالة مخصصة لورشة محددة</option>
                </select>
                {newAnnRecipientType === 'specific' && (
                  <select
                    value={newAnnRecipientWorkshopId}
                    onChange={(e) => setNewAnnRecipientWorkshopId(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  >
                    <option value="">اختر الورشة...</option>
                    {workshops.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.brandName} — {w.artistName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                value={newAnnTitle}
                onChange={(e) => setNewAnnTitle(e.target.value)}
                placeholder="عنوان الرسالة أو التوجيه..."
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
              />
              <textarea
                rows={4}
                value={newAnnContent}
                onChange={(e) => setNewAnnContent(e.target.value)}
                placeholder="نص الرسالة الموجهة للورش..."
                className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
              <button
                type="submit"
                disabled={sendingAnnouncement}
                className="px-5 py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{sendingAnnouncement ? 'جاري الإرسال...' : 'إرسال عبر البوسطة فوراً'}</span>
              </button>
            </form>
          )}

          {msgTab === 'sent' && (
            <div className="space-y-2.5">
              {filteredAnnouncements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-black">{a.title}</h4>
                    <p className="text-xs text-[#334155] dark:text-[#CBD5E1]">{a.content}</p>
                  </div>
                  <button
                    type="button"
                    disabled={deletingAnnId === a.id}
                    onClick={() => onDeleteAnnouncement(a.id)}
                    className="p-2 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 cursor-pointer shrink-0"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: الورش */}
      {mode === 'notif_workshops' && (
        <div className="space-y-3">
          {workshopAlerts.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
              لا توجد إشعارات ورش مطابقة حالياً.
            </div>
          ) : (
            workshopAlerts.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-black">{a.title}</h3>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8]">{a.message || a.content}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigatePage(
                        String(a.type || '').includes('appeal')
                          ? 'appeals'
                          : String(a.type || '').includes('application')
                          ? 'applications'
                          : 'workshops'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissAlert(a.id)}
                    className="p-1.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODE 3: متجري */}
      {mode === 'notif_store' && (
        <div className="space-y-3">
          {storeNotificationItems.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
              لا توجد تنبيهات معلقة في متجري أو سوق الشمساوية حالياً.
            </div>
          ) : (
            storeNotificationItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-black">{item.title}</h3>
                  <p className="text-xs font-mono tabular-nums text-[#C2410C] dark:text-[#FBBF24]">{item.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigatePage(item.targetPage)}
                  className="px-3.5 py-2 rounded-xl bg-[#0C1427] text-[#FBBF24] text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح للتعامل الفوري</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODE 4: النظام */}
      {mode === 'notif_system' && (
        <div className="space-y-3">
          {systemAlerts.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs text-[#475569] dark:text-[#94A3B8]">
              لا توجد تنبيهات نظامية مسجلة حالياً.
            </div>
          ) : (
            systemAlerts.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black">{a.title}</h3>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8]">{a.message || a.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismissAlert(a.id)}
                  className="p-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] cursor-pointer"
                  title="إخفاء"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
