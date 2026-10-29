import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, WorkshopProfile, isUserAdmin } from '../../types';
import { firestoreService } from '../../db/firestoreService';
import { tenantStorage } from '../../db/dexieDB';
import { supabase } from '../../lib/supabase';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { playSuccessSound, playErrorSound, playAlertSound, playPostaNotificationSound } from '../../lib/sounds';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  Snowflake,
  Play,
  PlusCircle,
  X,
  Check,
  AlertTriangle,
  Globe,
  Phone,
  Mail,
  ArrowRight,
  Boxes,
  Package,
  Wallet,
  ShoppingCart,
  Users,
  MessageCircle,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  DollarSign,
  TrendingUp,
  Scale,
  Send,
  Ban,
  Clock,
  CheckCircle2,
  XCircle,
  Volume2,
  Lock,
} from 'lucide-react';

interface AdminDashboardProps {
  profile: UserProfile;
  onNavigateHome: () => void;
  onProfileUpdated?: (updated: UserProfile) => void;
  onSelectActiveWorkshop?: (workshop: WorkshopProfile) => void;
}

export type ExecutiveTab = 'materials' | 'products' | 'treasuries' | 'orders' | 'appeals' | 'messaging';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  profile,
  onNavigateHome,
  onProfileUpdated,
  onSelectActiveWorkshop,
}) => {
  const isAdmin = isUserAdmin(profile);

  // Workshops State (Loaded dynamically, unlimited scale)
  const [workshops, setWorkshops] = useState<WorkshopProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  // Master ERP Workshop Switcher State
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>(profile.id);
  const [activeExecutiveTab, setActiveExecutiveTab] = useState<ExecutiveTab>('materials');
  const [deepDataLoading, setDeepDataLoading] = useState(false);
  const [deepData, setDeepData] = useState<{
    materials: any[];
    products: any[];
    treasuries: any[];
    orders: any[];
    customers: any[];
  } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned'>('all');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');

  // Modals state
  const [editingWorkshop, setEditingWorkshop] = useState<WorkshopProfile | null>(null);
  const [isSuspendingModalOpen, setIsSuspendingModalOpen] = useState(false);
  const [suspensionDurationChoice, setSuspensionDurationChoice] = useState('أسبوع');
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('');
  const [isBanningModalOpen, setIsBanningModalOpen] = useState(false);
  const [banReasonInput, setBanReasonInput] = useState('');

  // Selective Deletion Modal State
  const [deletingWorkshop, setDeletingWorkshop] = useState<WorkshopProfile | null>(null);
  const [selectiveDeleteMode, setSelectiveDeleteMode] = useState<'cascade' | 'catalog_inventory' | 'finance_orders'>('cascade');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Quick edit material price modal state
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const [newMaterialPrice, setNewMaterialPrice] = useState<string>('');

  // Appeals Management State
  const [appealsList, setAppealsList] = useState<any[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [rejectingAppealWorkshop, setRejectingAppealWorkshop] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Messaging Hub State
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [inboxList, setInboxList] = useState<any[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnRecipientType, setNewAnnRecipientType] = useState<'all' | 'specific'>('all');
  const [newAnnRecipientWorkshopId, setNewAnnRecipientWorkshopId] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [directReplyTarget, setDirectReplyTarget] = useState<any | null>(null);
  const [directReplyContent, setDirectReplyContent] = useState('');

  // New Workshop Form State
  const [isNewWorkshopModalOpen, setIsNewWorkshopModalOpen] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newArtistName, setNewArtistName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCountry, setNewCountry] = useState('مصر');
  const [newRole, setNewRole] = useState<'artisan' | 'manager' | 'admin'>('artisan');

  // Currently inspected workshop object
  const currentSelectedWorkshop = useMemo(() => {
    return workshops.find((w) => w.id === selectedWorkshopId) || workshops[0] || profile;
  }, [workshops, selectedWorkshopId, profile]);

  // 1. Dynamic Load All Workshops (Server Super Admin API + Fallback)
  const loadWorkshops = useCallback(async (isSilent = false) => {
    if (!isAdmin) return;
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setErrorMsg('');

    try {
      let serverWorkshops: WorkshopProfile[] = [];
      let remoteWorkshops: WorkshopProfile[] = [];
      let localProfiles: UserProfile[] = [];

      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch('/api/admin/workshops', {
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.workshops)) {
            serverWorkshops = json.workshops.map((row: any) => ({
              id: row.id,
              workshopId: row.id,
              ownerUid: row.owner_uid || row.ownerUid || row.id,
              brandName: row.brand_name || row.brandName || 'ورشة',
              artistName: row.artist_name || row.artistName || 'فنان',
              email: row.email || '',
              phoneNumber: row.phone_number || row.phoneNumber || '',
              country: row.country || 'مصر',
              currency: row.currency || 'EGP',
              currencySymbol: row.currency_symbol || row.currencySymbol || 'ج.م',
              callingCode: row.calling_code || row.callingCode || '+20',
              selectedCrafts: row.selected_crafts || ['macrame'],
              defaultVatPercent: row.default_vat_percent ?? 14,
              showTaxInfoOnInvoice: false,
              role: row.role || 'artisan',
              status: row.status || (row.is_frozen || row.isFrozen ? 'suspended' : 'active'),
              isFrozen: Boolean(row.is_frozen || row.isFrozen || row.status === 'suspended' || row.status === 'banned'),
              suspension_reason: row.suspension_reason || row.frozen_reason,
              suspension_duration: row.suspension_duration,
              suspended_until: row.suspended_until,
              appeal_status: row.appeal_status || 'none',
              appeal_message: row.appeal_message,
              rejection_reason: row.rejection_reason,
              appeal_submitted_at: row.appeal_submitted_at,
              createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
              updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
              createdBy: row.created_by || 'system',
            }));
          }
        }
      } catch (err: any) {
        console.warn('[Admin Dashboard] Server workshops fetch notice:', err?.message);
      }

      try {
        remoteWorkshops = await firestoreService.getAllWorkshops();
      } catch (err: any) {
        console.warn('Firestore getAllWorkshops warning:', err?.message);
      }

      try {
        localProfiles = await tenantStorage.getAllProfiles();
      } catch (err: any) {
        console.warn('Dexie getAllProfiles warning:', err?.message);
      }

      const map = new Map<string, WorkshopProfile>();
      map.set(profile.id, profile);

      localProfiles.forEach((p) => {
        if (p.id) map.set(p.id, p);
      });

      remoteWorkshops.forEach((w) => {
        if (w.id) {
          const existing = map.get(w.id);
          map.set(w.id, { ...existing, ...w });
        }
      });

      serverWorkshops.forEach((w) => {
        if (w.id) {
          const existing = map.get(w.id);
          map.set(w.id, { ...existing, ...w });
        }
      });

      const list = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setWorkshops(list);

      if (!selectedWorkshopId && list.length > 0) {
        setSelectedWorkshopId(list[0].id);
      }
    } catch (err: any) {
      setErrorMsg('تعذر تحميل قائمة الورش: ' + (err.message || 'خطأ في الاتصال'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, profile, selectedWorkshopId]);

  // Load Appeals
  const loadAppeals = useCallback(async () => {
    if (!isAdmin) return;
    setAppealsLoading(true);
    try {
      const res = await fetch('/api/admin/appeals', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
      });
      if (res.ok) {
        const json = await res.json();
        setAppealsList(json.appeals || []);
      }
    } catch (e) {
      console.warn('Load appeals warning:', e);
    } finally {
      setAppealsLoading(false);
    }
  }, [isAdmin, profile.email]);

  // Load Messaging Inbox & Announcements
  const loadMessagingHub = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [annRes, inboxRes] = await Promise.all([
        fetch('/api/announcements', {
          headers: { 'x-user-email': profile.email || 'hmb.top.tupe@gmail.com' },
        }),
        fetch('/api/admin/inbox', {
          headers: { 'x-user-email': profile.email || 'hmb.top.tupe@gmail.com' },
        }),
      ]);

      if (annRes.ok) {
        const data = await annRes.json();
        setAnnouncementsList(data.announcements || []);
      }
      if (inboxRes.ok) {
        const data = await inboxRes.json();
        setInboxList(data.inbox || []);
      }
    } catch (e) {
      console.warn('Load messaging hub warning:', e);
    }
  }, [isAdmin, profile.email]);

  useEffect(() => {
    if (isAdmin) {
      loadWorkshops();
      loadAppeals();
      loadMessagingHub();
    }
  }, [isAdmin, loadWorkshops, loadAppeals, loadMessagingHub]);

  // 2. Realtime Subscriptions (Workshops, Announcements, Replies)
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin:realtime:hub')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workshops' }, (payload) => {
        const newRow = payload.new as any;
        if (newRow && newRow.id) {
          const brand = newRow.brand_name || newRow.brandName || 'ورشة جديدة';
          const artist = newRow.artist_name || newRow.artistName || 'فنان';
          const phone = newRow.phone_number || newRow.phoneNumber || '';

          playAlertSound();
          setRealtimeToast(`🔔 تم تسجيل ورشة جديدة: [${brand}] - صاحبها: [${artist}]${phone ? ` - هاتف: [${phone}]` : ''}`);
          loadWorkshops(true);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshops' }, (payload) => {
        const updatedRow = payload.new as any;
        if (updatedRow && updatedRow.id) {
          // If appeal was submitted, play notification sound
          if (updatedRow.appeal_status === 'pending') {
            playPostaNotificationSound();
            setRealtimeToast(`⚖️ طعن جديد مقدم من ورشة: [${updatedRow.brand_name || 'ورشة'}]`);
            loadAppeals();
          }
          setWorkshops((prev) =>
            prev.map((w) =>
              w.id === updatedRow.id
                ? {
                    ...w,
                    brandName: updatedRow.brand_name || w.brandName,
                    artistName: updatedRow.artist_name || w.artistName,
                    status: updatedRow.status || w.status,
                    isFrozen: Boolean(updatedRow.is_frozen ?? w.isFrozen),
                    suspension_reason: updatedRow.suspension_reason || w.suspension_reason,
                    appeal_status: updatedRow.appeal_status || w.appeal_status,
                    appeal_message: updatedRow.appeal_message || w.appeal_message,
                  }
                : w
            )
          );
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workshop_messages_receipts' }, (payload) => {
        const newReceipt = payload.new as any;
        if (newReceipt?.reply_text) {
          playPostaNotificationSound();
          setRealtimeToast(`✉️ استلمت رداً جديداً من ورشة عبر مركز المراسلات!`);
          loadMessagingHub();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshop_messages_receipts' }, (payload) => {
        const updReceipt = payload.new as any;
        if (updReceipt?.reply_text) {
          playPostaNotificationSound();
          setRealtimeToast(`✉️ استلمت رداً جديداً من ورشة عبر مركز المراسلات!`);
          loadMessagingHub();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadWorkshops, loadAppeals, loadMessagingHub]);

  // 3. Load Deep Executive ERP Data
  const loadDeepData = useCallback(async (workshopId: string) => {
    if (!workshopId || !isAdmin) return;
    setDeepDataLoading(true);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/admin/workshops/${workshopId}/deep-data`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        setDeepData({
          materials: data.materials || [],
          products: data.products || [],
          treasuries: data.treasuries || [],
          orders: data.orders || [],
          customers: data.customers || [],
        });
      } else {
        const [mats, prods, custs] = await Promise.all([
          tenantStorage.getRawMaterials(workshopId),
          tenantStorage.getProducts(workshopId),
          tenantStorage.getCustomers(workshopId),
        ]);
        setDeepData({
          materials: mats || [],
          products: prods || [],
          treasuries: [],
          orders: [],
          customers: custs || [],
        });
      }
    } catch (err: any) {
      console.warn('[Admin Dashboard] deep data error:', err);
    } finally {
      setDeepDataLoading(false);
    }
  }, [isAdmin, profile.email]);

  useEffect(() => {
    if (selectedWorkshopId) {
      loadDeepData(selectedWorkshopId);
    }
  }, [selectedWorkshopId, loadDeepData]);

  // Filtered Workshops
  const filteredWorkshops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workshops.filter((w) => {
      const curStatus = w.status || (w.isFrozen ? 'suspended' : 'active');
      if (statusFilter === 'active' && curStatus !== 'active') return false;
      if (statusFilter === 'suspended' && curStatus !== 'suspended') return false;
      if (statusFilter === 'banned' && curStatus !== 'banned') return false;
      if (selectedCountryFilter !== 'all' && w.country !== selectedCountryFilter) return false;
      if (!q) return true;

      const bName = (w.brandName || '').toLowerCase();
      const aName = (w.artistName || '').toLowerCase();
      const email = (w.email || '').toLowerCase();
      const phone = (w.phoneNumber || '').toLowerCase();
      const country = (w.country || '').toLowerCase();

      return (
        bName.includes(q) ||
        aName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        country.includes(q)
      );
    });
  }, [workshops, searchQuery, statusFilter, selectedCountryFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = workshops.length;
    const banned = workshops.filter((w) => w.status === 'banned').length;
    const suspended = workshops.filter((w) => w.status === 'suspended' || (w.isFrozen && w.status !== 'banned')).length;
    const active = total - suspended - banned;
    const pendingAppeals = appealsList.filter((a) => a.appeal_status === 'pending' || a.appeal_status === 'under_review').length;
    return { total, active, suspended, banned, pendingAppeals };
  }, [workshops, appealsList]);

  // Inactivity calculation (> 7 days)
  const getInactivityDays = (ws: WorkshopProfile): number => {
    const lastActive = ws.updatedAt || ws.createdAt || Date.now();
    const diffMs = Date.now() - lastActive;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Edit Workshop Profile Details
  const handleSaveEditedWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkshop) return;
    setSavingAction(true);
    try {
      const updated: WorkshopProfile = {
        ...editingWorkshop,
        updatedAt: Date.now(),
      };

      await firestoreService.setWorkshop(updated);
      await tenantStorage.saveProfile(updated);

      setWorkshops((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      if (updated.id === profile.id && onProfileUpdated) {
        onProfileUpdated(updated);
      }

      playSuccessSound();
      setSuccessNotice(`تم تحديث بيانات ورشة "${updated.brandName}" بنجاح.`);
      setTimeout(() => setSuccessNotice(''), 4000);
      setEditingWorkshop(null);
    } catch (err: any) {
      playErrorSound();
      alert('تعذر تحديث الورشة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSavingAction(false);
    }
  };

  // 1. Suspend Workshop Handler (with duration and mandatory reason)
  const handleExecuteSuspension = async () => {
    if (!editingWorkshop) return;
    if (!suspensionReasonInput.trim()) {
      alert('سبب الإيقاف المؤقت إجباري لتوضيحه لصاحب الورشة');
      return;
    }

    setSavingAction(true);
    try {
      let suspendedUntilMs: number | null = null;
      const now = Date.now();
      if (suspensionDurationChoice === '24 ساعة') suspendedUntilMs = now + 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === '3 أيام') suspendedUntilMs = now + 3 * 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === 'أسبوع') suspendedUntilMs = now + 7 * 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === 'أسبوعين') suspendedUntilMs = now + 14 * 24 * 60 * 60 * 1000;
      else if (suspensionDurationChoice === 'شهر') suspendedUntilMs = now + 30 * 24 * 60 * 60 * 1000;
      else suspendedUntilMs = null; // إيقاف مؤقت لحين النظر

      const res = await fetch(`/api/admin/workshops/${editingWorkshop.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
        body: JSON.stringify({
          status: 'suspended',
          suspension_reason: suspensionReasonInput.trim(),
          suspension_duration: suspensionDurationChoice,
          suspended_until: suspendedUntilMs ? new Date(suspendedUntilMs).toISOString() : null,
        }),
      });

      if (!res.ok) throw new Error('تعذر إيقاف الورشة على الخادم');

      const updatedWs: WorkshopProfile = {
        ...editingWorkshop,
        status: 'suspended',
        isFrozen: true,
        suspension_reason: suspensionReasonInput.trim(),
        suspension_duration: suspensionDurationChoice,
        suspended_until: suspendedUntilMs ? new Date(suspendedUntilMs).toISOString() : null,
      };

      setWorkshops((prev) => prev.map((w) => (w.id === editingWorkshop.id ? updatedWs : w)));
      playAlertSound();
      setSuccessNotice(`تم إيقاف حساب ورشة "${editingWorkshop.brandName}" مؤقتاً لمدة ${suspensionDurationChoice}.`);
      setIsSuspendingModalOpen(false);
      setEditingWorkshop(null);
      setSuspensionReasonInput('');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      playErrorSound();
      alert('خطأ أثناء تنفيذ الإيقاف: ' + err.message);
    } finally {
      setSavingAction(false);
    }
  };

  // 2. Ban Workshop Handler (Full ban + mandatory reason)
  const handleExecuteBan = async () => {
    if (!editingWorkshop) return;
    if (!banReasonInput.trim()) {
      alert('سبب الحظر الكامل إجباري ومهم للملف القانوني');
      return;
    }

    setSavingAction(true);
    try {
      const res = await fetch(`/api/admin/workshops/${editingWorkshop.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
        body: JSON.stringify({
          status: 'banned',
          suspension_reason: banReasonInput.trim(),
          suspension_duration: 'حظر دائم',
          suspended_until: null,
        }),
      });

      if (!res.ok) throw new Error('تعذر حظر الورشة');

      const updatedWs: WorkshopProfile = {
        ...editingWorkshop,
        status: 'banned',
        isFrozen: true,
        suspension_reason: banReasonInput.trim(),
        suspension_duration: 'حظر دائم',
        suspended_until: null,
      };

      setWorkshops((prev) => prev.map((w) => (w.id === editingWorkshop.id ? updatedWs : w)));
      playAlertSound();
      setSuccessNotice(`تم حظر ورشة "${editingWorkshop.brandName}" بشكل نهائي.`);
      setIsBanningModalOpen(false);
      setEditingWorkshop(null);
      setBanReasonInput('');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      playErrorSound();
      alert('خطأ أثناء تنفيذ الحظر: ' + err.message);
    } finally {
      setSavingAction(false);
    }
  };

  // 3. Unban / Activate Workshop
  const handleReactivateWorkshop = async (targetWs: WorkshopProfile) => {
    setSavingAction(true);
    try {
      const res = await fetch(`/api/admin/workshops/${targetWs.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!res.ok) throw new Error('تعذر إعادة تفعيل الورشة');

      const updatedWs: WorkshopProfile = {
        ...targetWs,
        status: 'active',
        isFrozen: false,
        suspension_reason: undefined,
        suspension_duration: undefined,
        suspended_until: null,
      };

      setWorkshops((prev) => prev.map((w) => (w.id === targetWs.id ? updatedWs : w)));
      playSuccessSound();
      setSuccessNotice(`تم إلغاء الحظر وإعادة تفعيل ورشة "${targetWs.brandName}" بنجاح!`);
      setEditingWorkshop(null);
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      playErrorSound();
      alert('تعذر التفعيل: ' + err.message);
    } finally {
      setSavingAction(false);
    }
  };

  // 4. Accept Appeal
  const handleAcceptAppeal = async (appealItem: any) => {
    try {
      const res = await fetch(`/api/admin/workshops/${appealItem.id}/appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
        body: JSON.stringify({ appeal_status: 'accepted' }),
      });

      if (res.ok) {
        playSuccessSound();
        setSuccessNotice(`تم قبول طعن ورشة "${appealItem.brand_name || 'الورشة'}" وإعادة تفعيلها فوراً.`);
        loadAppeals();
        loadWorkshops(true);
        setTimeout(() => setSuccessNotice(''), 4000);
      }
    } catch (err: any) {
      alert('تعذر قبول الطعن: ' + err.message);
    }
  };

  // 5. Reject Appeal
  const handleConfirmRejectAppeal = async () => {
    if (!rejectingAppealWorkshop) return;
    try {
      const res = await fetch(`/api/admin/workshops/${rejectingAppealWorkshop.id}/appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
        body: JSON.stringify({
          appeal_status: 'rejected',
          rejection_reason: rejectionReasonInput.trim() || 'تم رفض الطعن بعد دراسة تفاصيل وسجلات الورشة.',
        }),
      });

      if (res.ok) {
        playAlertSound();
        setSuccessNotice(`تم رفض طعن ورشة "${rejectingAppealWorkshop.brand_name || 'الورشة'}" وتسجيل السبب.`);
        setRejectingAppealWorkshop(null);
        setRejectionReasonInput('');
        loadAppeals();
        loadWorkshops(true);
        setTimeout(() => setSuccessNotice(''), 4000);
      }
    } catch (err: any) {
      alert('تعذر رفض الطعن: ' + err.message);
    }
  };

  // 6. Post Announcement (Broadcast / Specific)
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) {
      alert('عنوان ونص الرسالة مطلوبان');
      return;
    }
    if (newAnnRecipientType === 'specific' && !newAnnRecipientWorkshopId) {
      alert('يرجى تحديد الورشة المستلمة');
      return;
    }

    setSendingAnnouncement(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
        body: JSON.stringify({
          recipient_type: newAnnRecipientType,
          recipient_workshop_id: newAnnRecipientType === 'specific' ? newAnnRecipientWorkshopId : null,
          title: newAnnTitle.trim(),
          content: newAnnContent.trim(),
        }),
      });

      if (res.ok) {
        playPostaNotificationSound();
        setSuccessNotice('تم إرسال الرسالة بنجاح عبر مركز المراسلات لكافة الورش المحددة!');
        setNewAnnTitle('');
        setNewAnnContent('');
        setNewAnnRecipientWorkshopId('');
        loadMessagingHub();
        setTimeout(() => setSuccessNotice(''), 4000);
      }
    } catch (err: any) {
      alert('تعذر إرسال الرسالة: ' + err.message);
    } finally {
      setSendingAnnouncement(false);
    }
  };

  // 7. Selective Deletion / Reset Handler
  const handleSelectiveDeleteWorkshop = async () => {
    if (!deletingWorkshop) return;
    if (deletingWorkshop.id === profile.id && selectiveDeleteMode === 'cascade') {
      alert('لا يمكنك حذف ورشتك الحالية كلياً من لوحة التحكم!');
      return;
    }
    if (deleteConfirmText.trim() !== deletingWorkshop.brandName.trim()) {
      alert(`يرجى كتابة اسم الورشة بالكامل للتأكيد: "${deletingWorkshop.brandName}"`);
      return;
    }

    setSavingAction(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/admin/workshops/${deletingWorkshop.id}/selective-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode: selectiveDeleteMode }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || 'تعذر استكمال عملية التصفير والحذف');
      }

      if (selectiveDeleteMode === 'cascade') {
        await firestoreService.deleteWorkshop(deletingWorkshop.id);
        await tenantStorage.deleteProfile(deletingWorkshop.id);
        setWorkshops((prev) => prev.filter((w) => w.id !== deletingWorkshop.id));
        setSuccessNotice(`تم حذف ورشة "${deletingWorkshop.brandName}" نهائياً من المنظومة.`);
      } else if (selectiveDeleteMode === 'catalog_inventory') {
        setSuccessNotice(`تم تصفير المخزن والكتالوج لورشة "${deletingWorkshop.brandName}" بنجاح.`);
        if (selectedWorkshopId === deletingWorkshop.id) {
          loadDeepData(deletingWorkshop.id);
        }
      } else {
        setSuccessNotice(`تم تصفير الدورة المالية والطلبيات لورشة "${deletingWorkshop.brandName}" بنجاح.`);
        if (selectedWorkshopId === deletingWorkshop.id) {
          loadDeepData(deletingWorkshop.id);
        }
      }

      playAlertSound();
      setTimeout(() => setSuccessNotice(''), 4000);
      setDeletingWorkshop(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      playErrorSound();
      alert('تعذر تنفيذ العملية: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSavingAction(false);
    }
  };

  // Create New Workshop
  const handleCreateNewWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim() || !newArtistName.trim()) {
      alert('اسم البراند واسم الفنان مطلوبان');
      return;
    }

    setSavingAction(true);
    try {
      const generatedId = 'ws_' + Math.random().toString(36).substring(2, 10);
      const countryConfig =
        COUNTRIES_CONFIG.find((c) => c.name === newCountry) || COUNTRIES_CONFIG[0];

      const newWs: WorkshopProfile = {
        id: generatedId,
        workshopId: generatedId,
        ownerUid: generatedId,
        email: newEmail.trim() || `${generatedId}@alshams.craft`,
        brandName: newBrandName.trim(),
        artistName: newArtistName.trim(),
        gender: 'female',
        phoneNumber: newPhone.trim(),
        country: countryConfig.name,
        currency: countryConfig.currency,
        currencySymbol: countryConfig.currencySymbol,
        callingCode: countryConfig.callingCode,
        selectedCrafts: ['macrame'],
        defaultVatPercent: 14,
        showTaxInfoOnInvoice: false,
        role: newRole,
        status: 'active',
        isFrozen: false,
        welcomeShown: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: profile.email || 'admin',
      };

      await firestoreService.setWorkshop(newWs);
      await tenantStorage.saveProfile(newWs);

      setWorkshops((prev) => [newWs, ...prev]);
      playSuccessSound();
      setSuccessNotice(`تم تسجيل ورشة "${newWs.brandName}" بنجاح.`);
      setTimeout(() => setSuccessNotice(''), 4000);

      setNewBrandName('');
      setNewArtistName('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('artisan');
      setIsNewWorkshopModalOpen(false);
    } catch (err: any) {
      playErrorSound();
      alert('تعذر إنشاء الورشة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSavingAction(false);
    }
  };

  // Inline Price Edit Handler
  const handleSaveMaterialPrice = async () => {
    if (!editingMaterial || !newMaterialPrice) return;
    const priceNum = parseFloat(newMaterialPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('يرجى إدخال سعر صحيح');
      return;
    }

    try {
      if (deepData?.materials) {
        const updatedList = deepData.materials.map((m) =>
          m.id === editingMaterial.id ? { ...m, unit_cost: priceNum, price: priceNum, cost: priceNum } : m
        );
        setDeepData({ ...deepData, materials: updatedList });
      }
      playSuccessSound();
      setEditingMaterial(null);
      setNewMaterialPrice('');
    } catch (err: any) {
      alert('تعذر تعديل السعر: ' + err.message);
    }
  };

  // Access Denied Screen
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-stone-900 border border-rose-300 dark:border-rose-900/60 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-xl font-black text-stone-900 dark:text-stone-100">
            منطقة المسؤولين فقط
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            عذراً، هذه الشاشة مخصصة لإدارة المنظومة. الحساب الحالي لا يمتلك صلاحيات الإشراف.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <ArrowRight size={16} />
            <span>العودة للصفحة الرئيسية</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Top Header with Royal Golden Badge */}
      <div className="relative overflow-hidden bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-amber-500/30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/30 via-yellow-500/40 to-amber-600/30 border border-amber-400/80 text-amber-200 text-xs font-black shadow-lg shadow-amber-500/10">
                <span className="text-sm">👑</span>
                <span>كبير عيلة الشمساوية</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-600 text-white font-mono uppercase">
                  Super Admin
                </span>
              </span>

              <span className="text-xs text-stone-300 font-bold">
                م. حسام بسيوني (
                <span className="font-mono text-amber-300">hmb.top.tupe@gmail.com</span>)
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-amber-300">
              لوحة التحكم الشاملة وإدارة الورش الحازمة (Master Multi-Tenant ERP)
            </h1>
            <p className="text-xs text-stone-300 leading-relaxed max-w-3xl">
              إشراف تنفيذي حازم، نظام الإيقاف المؤقت وفك التجميد التلقائي، حظر المخالفين، معالجة الطعون، ومركز المراسلات التفاعلية المباشرة بنغمة بوسطة! المميزة.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => playPostaNotificationSound()}
              className="px-3.5 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
              title="تجربة صوت إشعار بوسطة!"
            >
              <Volume2 size={15} />
              <span>نغمة بوسطة!</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewWorkshopModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-600/30 transition cursor-pointer"
            >
              <PlusCircle size={16} />
              <span>تسجيل ورشة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                loadWorkshops(false);
                loadAppeals();
                loadMessagingHub();
              }}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition cursor-pointer disabled:opacity-50"
              title="تحديث البيانات فورياً"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin text-amber-400' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Realtime Notification Banner */}
      {realtimeToast && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-2 border-amber-400 text-amber-950 dark:text-amber-100 text-xs font-black flex items-center justify-between shadow-lg shadow-amber-500/15 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <Sparkles size={20} className="text-amber-500 animate-spin shrink-0" />
            <span>{realtimeToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setRealtimeToast(null)}
            className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3. Success Notice */}
      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice('')}
            className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4. Master ERP Workshop Switcher & Executive Section */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black text-stone-900 dark:text-stone-100">
                محدد الورش التنفيذي والمحاور الإدارية (Master Multi-Tenant ERP)
              </h2>
            </div>
            <p className="text-xs text-stone-500">
              استعراض مباشر للخامات، المنتجات، المعاملات، مركز الطعون، ومراسلات المنظومة:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[280px]">
              <select
                value={selectedWorkshopId}
                onChange={(e) => setSelectedWorkshopId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-amber-50/70 dark:bg-stone-800 border-2 border-amber-300 dark:border-amber-700/80 text-xs font-black text-stone-900 dark:text-stone-100 outline-none cursor-pointer focus:ring-2 focus:ring-amber-500 shadow-xs"
              >
                {workshops.map((w) => {
                  const s = w.status || (w.isFrozen ? 'suspended' : 'active');
                  const badgeIcon = s === 'banned' ? '🔴 [محظورة]' : s === 'suspended' ? '🟡 [موقوفة]' : '🟢';
                  return (
                    <option key={w.id} value={w.id}>
                      {badgeIcon} {w.brandName} — {w.artistName} ({w.country || 'مصر'})
                    </option>
                  );
                })}
              </select>
            </div>

            {onSelectActiveWorkshop && (
              <button
                type="button"
                onClick={() => {
                  if (currentSelectedWorkshop) {
                    onSelectActiveWorkshop(currentSelectedWorkshop);
                    playSuccessSound();
                  }
                }}
                className="px-4 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 transition shadow-md cursor-pointer"
                title="تفعيل سياق هذه الورشة في كامل شاشات التطبيق"
              >
                <Play size={14} className="text-amber-400" />
                <span>تفعيل سياق الورشة</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => loadDeepData(selectedWorkshopId)}
              disabled={deepDataLoading}
              className="p-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 transition cursor-pointer"
              title="إعادة تحميل بيانات الورشة المحددة"
            >
              <RefreshCw size={15} className={deepDataLoading ? 'animate-spin text-amber-500' : ''} />
            </button>
          </div>
        </div>

        {/* Selected Workshop Header Info Card */}
        {currentSelectedWorkshop && (
          <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white font-black flex items-center justify-center text-base shadow-md">
                {currentSelectedWorkshop.brandName.charAt(0) || 'و'}
              </div>
              <div>
                <div className="font-black text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{currentSelectedWorkshop.brandName}</span>
                  {currentSelectedWorkshop.status === 'banned' ? (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold border border-rose-300">
                      🔴 محظورة
                    </span>
                  ) : currentSelectedWorkshop.status === 'suspended' || currentSelectedWorkshop.isFrozen ? (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold border border-amber-300">
                      🟡 موقوفة مؤقتاً
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                      🟢 نشطة
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-stone-600 dark:text-stone-400 font-bold mt-0.5">
                  الفنان: {currentSelectedWorkshop.artistName} | الدولة: {currentSelectedWorkshop.country} ({currentSelectedWorkshop.currencySymbol})
                  {currentSelectedWorkshop.suspension_reason && (
                    <span className="mr-2 text-rose-600 font-black">
                      (سبب الإجراء: {currentSelectedWorkshop.suspension_reason})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingWorkshop(currentSelectedWorkshop)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold flex items-center gap-1.5 shadow-xs hover:bg-amber-700 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>إدارة وحظر / إيقاف الورشة</span>
              </button>

              {currentSelectedWorkshop.phoneNumber && (
                <>
                  <a
                    href={`tel:${currentSelectedWorkshop.phoneNumber}`}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-amber-50 text-stone-800 dark:text-stone-200 font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Phone size={13} className="text-amber-600" />
                    <span dir="ltr">{currentSelectedWorkshop.phoneNumber}</span>
                  </a>
                  <a
                    href={`https://wa.me/${currentSelectedWorkshop.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم يا فنان، نتابع معك سير العمل في ورشتك على منظومة الشمساوية')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <MessageCircle size={13} />
                    <span>واتساب</span>
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        {/* 6 Executive Tabs Switcher */}
        <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/80 p-1.5 rounded-2xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveExecutiveTab('materials')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeExecutiveTab === 'materials'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Boxes size={15} />
            <span>الخامات ({deepData?.materials?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExecutiveTab('products')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeExecutiveTab === 'products'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Package size={15} />
            <span>المنتجات ({deepData?.products?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExecutiveTab('treasuries')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeExecutiveTab === 'treasuries'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Wallet size={15} />
            <span>الخزائن</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExecutiveTab('orders')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeExecutiveTab === 'orders'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <ShoppingCart size={15} />
            <span>الطلبات ({deepData?.orders?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExecutiveTab('appeals')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer relative ${
              activeExecutiveTab === 'appeals'
                ? 'bg-white dark:bg-stone-900 text-rose-700 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Scale size={15} />
            <span>مركز الطعون</span>
            {stats.pendingAppeals > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[9px] font-mono font-black animate-pulse">
                {stats.pendingAppeals}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveExecutiveTab('messaging')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeExecutiveTab === 'messaging'
                ? 'bg-white dark:bg-stone-900 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Mail size={15} />
            <span>المراسلات الحية</span>
            {inboxList.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[9px] font-mono font-black">
                {inboxList.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Materials */}
        {activeExecutiveTab === 'materials' && (
          <div className="space-y-3">
            {deepDataLoading ? (
              <div className="p-8 text-center text-stone-500 font-bold text-xs">جاري فحص خامات الورشة...</div>
            ) : !deepData?.materials || deepData.materials.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 dark:bg-stone-850 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 space-y-2">
                <Boxes className="w-8 h-8 mx-auto text-stone-400" />
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400">
                  لا توجد خامات مسجلة في مخزن هذه الورشة حالياً.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-100 dark:bg-stone-800/60 font-bold text-stone-600 dark:text-stone-300">
                    <tr>
                      <th className="py-2.5 px-3">اسم الخامة</th>
                      <th className="py-2.5 px-3">الكود / التصنيف</th>
                      <th className="py-2.5 px-3">الوحدة</th>
                      <th className="py-2.5 px-3">سعر التكلفة</th>
                      <th className="py-2.5 px-3">الرصيد المتاح</th>
                      <th className="py-2.5 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-semibold">
                    {deepData.materials.map((m: any) => (
                      <tr key={m.id || m.material_id} className="hover:bg-amber-50/30 dark:hover:bg-stone-800/30">
                        <td className="py-2.5 px-3 font-black text-stone-900 dark:text-stone-100">
                          {m.name || m.material_name}
                        </td>
                        <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">
                          {m.code || m.category || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 dark:text-stone-300">
                          {m.unit || 'متر'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {m.unit_cost ?? m.price ?? m.cost ?? 0} {currentSelectedWorkshop.currencySymbol}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-800 dark:text-stone-200">
                          {m.current_stock ?? m.stock ?? m.quantity ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMaterial(m);
                              setNewMaterialPrice(String(m.unit_cost ?? m.price ?? m.cost ?? ''));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[11px] hover:bg-amber-200 transition cursor-pointer"
                          >
                            تعديل السعر
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Products */}
        {activeExecutiveTab === 'products' && (
          <div className="space-y-3">
            {deepDataLoading ? (
              <div className="p-8 text-center text-stone-500 font-bold text-xs">جاري فحص كتالوج المنتجات...</div>
            ) : !deepData?.products || deepData.products.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 dark:bg-stone-850 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 space-y-2">
                <Package className="w-8 h-8 mx-auto text-stone-400" />
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400">
                  لا توجد منتجات مسجلة في كتالوج هذه الورشة.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-100 dark:bg-stone-800/60 font-bold text-stone-600 dark:text-stone-300">
                    <tr>
                      <th className="py-2.5 px-3">اسم المنتج</th>
                      <th className="py-2.5 px-3">التصنيف</th>
                      <th className="py-2.5 px-3">تكلفة الإنتاج</th>
                      <th className="py-2.5 px-3">سعر الجملة</th>
                      <th className="py-2.5 px-3">سعر القطاعي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-semibold">
                    {deepData.products.map((p: any) => (
                      <tr key={p.id || p.product_id} className="hover:bg-amber-50/30 dark:hover:bg-stone-800/30">
                        <td className="py-2.5 px-3 font-black text-stone-900 dark:text-stone-100">
                          {p.name || p.product_name || p.title}
                        </td>
                        <td className="py-2.5 px-3 text-stone-500">{p.category || 'عام'}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-600 dark:text-stone-400">
                          {p.cost_price ?? p.production_cost ?? 0} {currentSelectedWorkshop.currencySymbol}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {p.wholesale_price ?? 0} {currentSelectedWorkshop.currencySymbol}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {p.retail_price ?? p.price ?? 0} {currentSelectedWorkshop.currencySymbol}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Treasuries */}
        {activeExecutiveTab === 'treasuries' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">الخزينة الرئيسية (Main Safe)</div>
                <div className="text-lg font-black text-emerald-900 dark:text-emerald-100 font-mono mt-1">
                  {(deepData?.treasuries?.[0]?.balance ?? 0).toLocaleString()} {currentSelectedWorkshop.currencySymbol}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">عهد الحرفيين والورشة</div>
                <div className="text-lg font-black text-amber-900 dark:text-amber-100 font-mono mt-1">
                  {(deepData?.treasuries?.[1]?.balance ?? 0).toLocaleString()} {currentSelectedWorkshop.currencySymbol}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
                <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300">المحافظ والحسابات البنكية</div>
                <div className="text-lg font-black text-blue-900 dark:text-blue-100 font-mono mt-1">
                  {(deepData?.treasuries?.[2]?.balance ?? 0).toLocaleString()} {currentSelectedWorkshop.currencySymbol}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Orders */}
        {activeExecutiveTab === 'orders' && (
          <div className="space-y-3">
            {deepDataLoading ? (
              <div className="p-8 text-center text-stone-500 font-bold text-xs">جاري فحص طلبيات الورشة...</div>
            ) : !deepData?.orders || deepData.orders.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 dark:bg-stone-850 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto text-stone-400" />
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400">لا توجد طلبيات مسجلة.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-100 dark:bg-stone-800/60 font-bold text-stone-600 dark:text-stone-300">
                    <tr>
                      <th className="py-2.5 px-3">رقم الطلب</th>
                      <th className="py-2.5 px-3">العميل</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3">الإجمالي</th>
                      <th className="py-2.5 px-3">المدفوع</th>
                      <th className="py-2.5 px-3">المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-semibold">
                    {deepData.orders.map((o: any) => (
                      <tr key={o.id || o.order_id} className="hover:bg-amber-50/30 dark:hover:bg-stone-800/30">
                        <td className="py-2.5 px-3 font-mono font-black text-stone-900 dark:text-stone-100">
                          #{o.order_number || o.id?.slice(0, 6)}
                        </td>
                        <td className="py-2.5 px-3 text-stone-800 dark:text-stone-200">{o.customer_name || 'عميل نقدي'}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            {o.status || 'قيد التنفيذ'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-900 dark:text-stone-100">
                          {o.total_amount ?? o.total ?? 0} {currentSelectedWorkshop.currencySymbol}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                          {o.paid_amount ?? 0} {currentSelectedWorkshop.currencySymbol}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                          {(o.total_amount ?? o.total ?? 0) - (o.paid_amount ?? 0)} {currentSelectedWorkshop.currencySymbol}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Appeals Center (مركز الطعون والشكاوى) */}
        {activeExecutiveTab === 'appeals' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-black text-sm text-stone-900 dark:text-stone-100">
                  سجل الطعون والشكاوى المرفوعة لكبير عيلة الشمساوية
                </h3>
                <p className="text-xs text-stone-500">
                  مراجعة فورية لطعون أصحاب الورش الموقوفة أو المحظورة مع إمكانية القبول أو الرفض المسبب
                </p>
              </div>
              <button
                type="button"
                onClick={loadAppeals}
                className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold hover:bg-stone-200"
              >
                <RefreshCw size={14} className={appealsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {appealsList.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 dark:bg-stone-850 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 space-y-2">
                <Scale className="w-8 h-8 mx-auto text-stone-400" />
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400">
                  لا توجد أي طعون أو شكاوى معلقة حالياً. جميع الورش في وضع سليم.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {appealsList.map((appItem) => {
                  const isPending = appItem.appeal_status === 'pending' || appItem.appeal_status === 'under_review';
                  return (
                    <div
                      key={appItem.id}
                      className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black flex items-center justify-center">
                            {appItem.brand_name?.charAt(0) || 'و'}
                          </div>
                          <div>
                            <div className="font-black text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                              {appItem.brand_name} (الفنان: {appItem.artist_name || 'غير محدد'})
                            </div>
                            <div className="text-[11px] text-stone-500 font-mono">
                              الهاتف: {appItem.phone_number || '—'} | البريد: {appItem.email || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {appItem.phone_number && (
                            <>
                              <a
                                href={`tel:${appItem.phone_number}`}
                                className="p-1.5 rounded-lg bg-stone-200 dark:bg-stone-750 text-stone-700 dark:text-stone-200"
                                title="اتصال مباشر"
                              >
                                <Phone size={13} />
                              </a>
                              <a
                                href={`https://wa.me/${appItem.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent('بخصوص طعنكم المرفوع على منظومة الشمساوية')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-600 text-white"
                                title="محادثة واتساب"
                              >
                                <MessageCircle size={13} />
                              </a>
                            </>
                          )}

                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                              appItem.appeal_status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : appItem.appeal_status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}
                          >
                            {appItem.appeal_status === 'accepted'
                              ? 'تم قبول الطعن'
                              : appItem.appeal_status === 'rejected'
                              ? 'تم رفض الطعن'
                              : 'طعن قيد المراجعة'}
                          </span>
                        </div>
                      </div>

                      {/* Appeal Message */}
                      <div className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-750 text-xs">
                        <span className="text-[10px] font-black text-amber-600 block mb-1">
                          نص الطعن المرفوع من الفنان:
                        </span>
                        <p className="text-stone-800 dark:text-stone-200 font-bold whitespace-pre-wrap">
                          "{appItem.appeal_message || 'لا يوجد نص مرفق'}"
                        </p>
                      </div>

                      {/* Rejection reason if already rejected */}
                      {appItem.rejection_reason && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 font-bold">
                          سبب الرفض المسجل: {appItem.rejection_reason}
                        </div>
                      )}

                      {/* Action buttons if pending */}
                      {isPending && (
                        <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                          <button
                            type="button"
                            onClick={() => handleAcceptAppeal(appItem)}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 size={14} />
                            <span>قبول الطعن وفك الإيقاف فوراً</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectingAppealWorkshop(appItem);
                              setRejectionReasonInput('');
                            }}
                            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <XCircle size={14} />
                            <span>النظر في الشكوى ورفضها</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: In-App Messaging Hub (المراسلات التفاعلية والرسائل الحية) */}
        {activeExecutiveTab === 'messaging' && (
          <div className="space-y-6 animate-in fade-in">
            {/* 1. Compose Announcement */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-amber-600" />
                  <h3 className="font-black text-sm text-stone-900 dark:text-stone-100">
                    إرسال توجيه أو رسالة جديدة عبر المنظومة
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => playPostaNotificationSound()}
                  className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1"
                >
                  <Volume2 size={13} />
                  <span>نغمة بوسطة!</span>
                </button>
              </div>

              <form onSubmit={handleSendAnnouncement} className="space-y-3 text-xs font-bold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-700 dark:text-stone-300 mb-1">
                      نوع الإرسال:
                    </label>
                    <div className="flex items-center gap-2 bg-white dark:bg-stone-900 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
                      <button
                        type="button"
                        onClick={() => setNewAnnRecipientType('all')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                          newAnnRecipientType === 'all'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        📢 إعلان عام لكافة الورش
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAnnRecipientType('specific')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                          newAnnRecipientType === 'specific'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        🔒 رسالة خاصة لورشة محددة
                      </button>
                    </div>
                  </div>

                  {newAnnRecipientType === 'specific' && (
                    <div>
                      <label className="block text-stone-700 dark:text-stone-300 mb-1">
                        اختر الورشة المستهدفة:
                      </label>
                      <select
                        value={newAnnRecipientWorkshopId}
                        onChange={(e) => setNewAnnRecipientWorkshopId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold"
                      >
                        <option value="">-- اختر الورشة --</option>
                        {workshops.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.brandName} ({w.artistName})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 mb-1">
                    عنوان الرسالة / التوجيه:
                  </label>
                  <input
                    type="text"
                    required
                    value={newAnnTitle}
                    onChange={(e) => setNewAnnTitle(e.target.value)}
                    placeholder="مثال: تعليمات تسعير المعارض الموسمية أو تنبيه هام"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 mb-1">
                    نص التوجيه / الرسالة:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={newAnnContent}
                    onChange={(e) => setNewAnnContent(e.target.value)}
                    placeholder="اكتب التوجيهات أو التعليمات بالتفصيل..."
                    className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingAnnouncement}
                    className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={14} />
                    <span>{sendingAnnouncement ? 'جاري الإرسال...' : 'إرسال وتفعيل صوت بوسطة!'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Admin Inbox (Artisans Replies) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                <h3 className="font-black text-sm text-stone-900 dark:text-stone-100">
                  صندوق الوارد (Admin Inbox) — ردود واستفسارات الفنانين
                </h3>
                <span className="text-xs font-mono font-bold text-stone-500">
                  {inboxList.length} رد وارد
                </span>
              </div>

              {inboxList.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs font-bold">
                  لا توجد ردود أو استفسارات واردة من الفنانين حتى الآن.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {inboxList.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className="p-4 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-black text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                          {msg.workshops?.brand_name || msg.workshop_name || 'ورشة الشمساوية'}
                          <span className="text-xs font-normal text-stone-500 mr-1.5">
                            (الفنان: {msg.workshops?.artist_name || 'غير محدد'})
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {msg.replied_at ? new Date(msg.replied_at).toLocaleString('ar-EG') : ''}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-750 text-xs font-bold text-stone-800 dark:text-stone-200">
                        "{msg.reply_text}"
                      </div>

                      <div className="flex items-center gap-2 pt-1 text-xs">
                        {msg.workshops?.phone_number && (
                          <a
                            href={`https://wa.me/${msg.workshops.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent('بخصوص ردكم الأخير على منظومة الشمساوية')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1"
                          >
                            <MessageCircle size={12} />
                            <span>رد عبر واتساب</span>
                          </a>
                        )}
                        <span className="text-[11px] text-stone-400">
                          بخصوص رسالة: {msg.admin_announcements?.title || 'إعلان إداري'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Overview Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Building2 size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-500">إجمالي الورش</div>
            <div className="text-lg sm:text-xl font-black font-mono text-stone-900 dark:text-stone-100">
              {stats.total}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <Check size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-500">الورش النشطة</div>
            <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-500">موقوفة مؤقتاً</div>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">
              {stats.suspended}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center">
            <Ban size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-stone-500">محظورة كلياً</div>
            <div className="text-lg sm:text-xl font-black font-mono text-rose-600 dark:text-rose-400">
              {stats.banned}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Directory Search & Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في كافة الورش بالاسم، الفنان، الهاتف، أو الدولة..."
            className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 text-right"
          />
          <Search size={16} className="absolute right-3.5 top-3 text-stone-400 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-600"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            الكل ({workshops.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-white dark:bg-stone-900 text-emerald-600 shadow-xs'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            🟢 النشطة ({stats.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'suspended'
                ? 'bg-white dark:bg-stone-900 text-amber-600 shadow-xs'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            🟡 الموقوفة ({stats.suspended})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('banned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'banned'
                ? 'bg-white dark:bg-stone-900 text-rose-600 shadow-xs'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            🔴 المحظورة ({stats.banned})
          </button>
        </div>

        <div className="w-full md:w-44">
          <select
            value={selectedCountryFilter}
            onChange={(e) => setSelectedCountryFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold outline-none cursor-pointer text-stone-700 dark:text-stone-300"
          >
            <option value="all">كل الدول</option>
            {COUNTRIES_CONFIG.map((c) => (
              <option key={c.code} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 7. Workshops Directory Table */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-stone-500">جاري قراءة سجلات الورش المسجلة لحظياً...</p>
        </div>
      ) : filteredWorkshops.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-3">
          <Building2 size={40} className="mx-auto text-stone-300 dark:text-stone-700" />
          <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300">
            لا توجد ورش مطابقة لمعايير البحث
          </h3>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-100/70 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 text-stone-500 font-bold">
                <tr>
                  <th className="py-3.5 px-4">الورشة والبراند</th>
                  <th className="py-3.5 px-4">الفنان / المالك</th>
                  <th className="py-3.5 px-4">الاتصال السريع</th>
                  <th className="py-3.5 px-4">مؤشر النشاط / الخمول</th>
                  <th className="py-3.5 px-4">حالة الورشة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات والتحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                {filteredWorkshops.map((ws) => {
                  const isCurrent = ws.id === profile.id;
                  const inactiveDays = getInactivityDays(ws);
                  const isInactive = inactiveDays >= 7;
                  const currentStatus = ws.status || (ws.isFrozen ? 'suspended' : 'active');

                  return (
                    <tr
                      key={ws.id}
                      className={`hover:bg-amber-50/40 dark:hover:bg-stone-800/40 transition ${
                        currentStatus === 'banned'
                          ? 'bg-rose-50/20 dark:bg-rose-950/10'
                          : currentStatus === 'suspended'
                          ? 'bg-amber-50/20 dark:bg-amber-950/10'
                          : ''
                      }`}
                    >
                      {/* Workshop Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-black flex items-center justify-center shrink-0">
                            {ws.brandName.charAt(0) || 'و'}
                          </div>
                          <div>
                            <div className="font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                              <span>{ws.brandName}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                                  ورشتك
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                              ID: {ws.id.slice(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Artist */}
                      <td className="py-3.5 px-4 font-bold text-stone-800 dark:text-stone-200">
                        {ws.artistName || 'غير محدد'}
                      </td>

                      {/* Quick Contact */}
                      <td className="py-3.5 px-4">
                        {ws.phoneNumber ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${ws.phoneNumber}`}
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 text-stone-700 dark:text-stone-300 hover:text-amber-700 transition"
                              title={`اتصال: ${ws.phoneNumber}`}
                            >
                              <Phone size={13} />
                            </a>
                            <a
                              href={`https://wa.me/${ws.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم يا فنان، نتابع معك سير العمل في ورشتك على منظومة الشمساوية')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-600 transition"
                              title="محادثة واتساب مباشرة"
                            >
                              <MessageCircle size={13} />
                            </a>
                            <span className="font-mono text-[11px] text-stone-600 dark:text-stone-400" dir="ltr">
                              {ws.phoneNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Inactivity Detector */}
                      <td className="py-3.5 px-4">
                        {isInactive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold border border-amber-300 dark:border-amber-800">
                            <AlertTriangle size={11} className="text-amber-600" />
                            <span>⚠️ ورشة خاملة منذ {inactiveDays} يوماً</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                            <Check size={11} />
                            <span>نشاط حديث</span>
                          </span>
                        )}
                      </td>

                      {/* Status Badges */}
                      <td className="py-3.5 px-4">
                        {currentStatus === 'banned' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-300">
                            <Ban size={11} />
                            <span>🔴 محظورة</span>
                          </span>
                        ) : currentStatus === 'suspended' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-300">
                            <Clock size={11} />
                            <span>🟡 موقوفة مؤقتاً</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                            <Check size={11} />
                            <span>🟢 نشطة</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Inspect in Master Switcher */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWorkshopId(ws.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 text-stone-600 hover:text-amber-700 transition cursor-pointer"
                            title="فحص خامات ومنتجات الورشة بالأعلى"
                          >
                            <Layers size={14} />
                          </button>

                          {/* Edit / Manage Workshop (Pencil icon) */}
                          <button
                            type="button"
                            onClick={() => setEditingWorkshop(ws)}
                            className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 text-stone-600 hover:text-amber-700 transition cursor-pointer"
                            title="تعديل بيانات وإجراءات الورشة"
                          >
                            <Edit3 size={14} />
                          </button>

                          {/* Selective Delete Modal Trigger */}
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => {
                              setDeletingWorkshop(ws);
                              setSelectiveDeleteMode('cascade');
                              setDeleteConfirmText('');
                            }}
                            className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-stone-600 hover:text-rose-600 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isCurrent ? 'لا يمكن حذف ورشتك الرئيسية' : 'حذف / تصفير الورشة انتقائياً'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: WORKSHOP MANAGEMENT & SUSPENSION (Pencil Icon) */}
      {/* ============================================================ */}
      {editingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 text-right max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setEditingWorkshop(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  إدارة وتحكم ورشة: {editingWorkshop.brandName}
                </h3>
              </div>
            </div>

            {/* Quick Administrative Action Bar */}
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-stone-850 border border-amber-200/80 dark:border-stone-750 space-y-2">
              <span className="text-[11px] font-black text-stone-700 dark:text-stone-300 block">
                الإجراءات والقرارات الإدارية الحازمة:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Selective Delete */}
                <button
                  type="button"
                  onClick={() => {
                    setDeletingWorkshop(editingWorkshop);
                    setSelectiveDeleteMode('cascade');
                    setDeleteConfirmText('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 text-stone-700 hover:text-rose-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>الحذف والتصفير الانتقائي</span>
                </button>

                {/* 2. Suspend / Freeze */}
                <button
                  type="button"
                  onClick={() => setIsSuspendingModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/70 hover:bg-amber-200 text-amber-900 dark:text-amber-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Clock size={13} />
                  <span>تجميد / إيقاف مؤقت</span>
                </button>

                {/* 3. Ban */}
                <button
                  type="button"
                  onClick={() => setIsBanningModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/70 hover:bg-rose-200 text-rose-900 dark:text-rose-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Ban size={13} />
                  <span>حظر الورشة (Ban)</span>
                </button>

                {/* 4. Reactivate if Suspended/Banned */}
                {(editingWorkshop.status === 'suspended' || editingWorkshop.status === 'banned' || editingWorkshop.isFrozen) && (
                  <button
                    type="button"
                    onClick={() => handleReactivateWorkshop(editingWorkshop)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 size={13} />
                    <span>إلغاء الحظر وإعادة التفعيل</span>
                  </button>
                )}
              </div>
            </div>

            {/* Profile Editing Form */}
            <form onSubmit={handleSaveEditedWorkshop} className="space-y-4 pt-2 text-xs font-bold">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1">
                  اسم البراند / الورشة
                </label>
                <input
                  type="text"
                  required
                  value={editingWorkshop.brandName}
                  onChange={(e) =>
                    setEditingWorkshop({ ...editingWorkshop, brandName: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1">
                  اسم الفنان / الفنانة (صاحب الورشة)
                </label>
                <input
                  type="text"
                  required
                  value={editingWorkshop.artistName}
                  onChange={(e) =>
                    setEditingWorkshop({ ...editingWorkshop, artistName: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={editingWorkshop.email}
                    onChange={(e) =>
                      setEditingWorkshop({ ...editingWorkshop, email: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-left outline-none"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 mb-1">
                    رقم الهاتف المعتمد
                  </label>
                  <input
                    type="tel"
                    value={editingWorkshop.phoneNumber || ''}
                    onChange={(e) =>
                      setEditingWorkshop({ ...editingWorkshop, phoneNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-left outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingWorkshop(null)}
                  className="px-4 py-2.5 rounded-xl border text-stone-700 dark:text-stone-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingAction ? <span>جاري الحفظ...</span> : <span>حفظ التعديلات</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: SUSPENSION / DURATION POPUP */}
      {/* ============================================================ */}
      {isSuspendingModalOpen && editingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-amber-300 dark:border-amber-800 p-6 text-right space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-amber-800 dark:text-amber-200">
                  تجميد / إيقاف مؤقت للورشة
                </h3>
                <p className="text-xs text-stone-500">{editingWorkshop.brandName}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1">
                  مدة الإيقاف المؤقت (فك التجميد التلقائي بعد انقضائها):
                </label>
                <select
                  value={suspensionDurationChoice}
                  onChange={(e) => setSuspensionDurationChoice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                >
                  <option value="24 ساعة">24 ساعة (يوم واحد)</option>
                  <option value="3 أيام">3 أيام</option>
                  <option value="أسبوع">أسبوع (7 أيام)</option>
                  <option value="أسبوعين">أسبوعين (14 يوماً)</option>
                  <option value="شهر">شهر (30 يوماً)</option>
                  <option value="إيقاف مؤقت لحين النظر في أمر الورشة">إيقاف مؤقت لحين النظر في أمر الورشة</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1">
                  سبب الإيقاف المؤقت (إجباري ليظهر للفنان): *
                </label>
                <textarea
                  rows={3}
                  required
                  value={suspensionReasonInput}
                  onChange={(e) => setSuspensionReasonInput(e.target.value)}
                  placeholder="مثال: مراجعة الدورة المالية، عدم سداد المستحقات، أو التحقق من جودة المشغولات"
                  className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsSuspendingModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={savingAction || !suspensionReasonInput.trim()}
                onClick={handleExecuteSuspension}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-40"
              >
                {savingAction ? 'جاري التنفيذ...' : 'تأكيد الإيقاف المؤقت'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: BAN WORKSHOP POPUP */}
      {/* ============================================================ */}
      {isBanningModalOpen && editingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900 p-6 text-right space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Ban size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-rose-600">
                  حظر الورشة حظراً كلياً (Ban)
                </h3>
                <p className="text-xs text-stone-500">{editingWorkshop.brandName}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
              تحذير: سيتم منع الورشة من إجراء أي عمليات أو تعديل بيانات على المنظومة تماماً.
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                سبب الحظر الإجباري (يظهر للفنان): *
              </label>
              <textarea
                rows={3}
                required
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                placeholder="اكتب الأسباب والبنود المخالفة بالتفصيل..."
                className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsBanningModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={savingAction || !banReasonInput.trim()}
                onClick={handleExecuteBan}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
              >
                {savingAction ? 'جاري التنفيذ...' : 'تأكيد الحظر النهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: REJECT APPEAL REASON MODAL */}
      {/* ============================================================ */}
      {rejectingAppealWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900 p-6 text-right space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <XCircle size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-rose-600">
                  رفض الطعن المقدم من الورشة
                </h3>
                <p className="text-xs text-stone-500">{rejectingAppealWorkshop.brand_name}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                سبب رفض الطعن (سيظهر للفنان في شاشة الطعون): *
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="اكتب أسباب رفض الطعن وعدم كفاية الأدلة أو التوضيحات..."
                className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setRejectingAppealWorkshop(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectAppeal}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                تأكيد رفض الطعن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: SELECTIVE DELETION & RESET MODAL */}
      {/* ============================================================ */}
      {deletingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900/60 p-6 text-right space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-rose-600">
                  خيارات الحذف والتصفير الانتقائي للورشة
                </h3>
                <p className="text-xs text-stone-500">{deletingWorkshop.brandName}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold text-stone-800 dark:text-stone-200">
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50/30 cursor-pointer">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={selectiveDeleteMode === 'cascade'}
                  onChange={() => setSelectiveDeleteMode('cascade')}
                  className="mt-1"
                />
                <div>
                  <span className="font-black text-rose-700 block">🔴 حذف شامل لكافة سجلات الورشة (Full Cascade Delete)</span>
                  <span className="text-[11px] text-stone-500 font-normal">
                    مسح ملف الورشة وجميع الخامات، المنتجات، المعاملات المالية، والطلبات نهائياً من الجذور.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 hover:bg-amber-50/30 cursor-pointer">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={selectiveDeleteMode === 'catalog_inventory'}
                  onChange={() => setSelectiveDeleteMode('catalog_inventory')}
                  className="mt-1"
                />
                <div>
                  <span className="font-black text-amber-700 block">🟠 تصفير المخزن والكتالوج فقط</span>
                  <span className="text-[11px] text-stone-500 font-normal">
                    مسح كافة المنتجات والخامات وقوائم التكاليف مع الإبقاء على ملف الورشة وحساباتها.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-2xl border border-blue-200 dark:border-blue-900/40 hover:bg-blue-50/30 cursor-pointer">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={selectiveDeleteMode === 'finance_orders'}
                  onChange={() => setSelectiveDeleteMode('finance_orders')}
                  className="mt-1"
                />
                <div>
                  <span className="font-black text-blue-700 block">🟡 تصفير الدورة المالية والطلبات فقط</span>
                  <span className="text-[11px] text-stone-500 font-normal">
                    مسح حركات الخزينة والطلبيات مع الحفاظ التام على الكتالوج والخامات.
                  </span>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                لتأكيد العملية، اكتب اسم الورشة تماماً: (
                <span className="text-rose-600 select-all font-black">{deletingWorkshop.brandName}</span>)
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="اكتب اسم الورشة هنا..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setDeletingWorkshop(null)}
                className="px-4 py-2 rounded-xl border text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={
                  savingAction || deleteConfirmText.trim() !== deletingWorkshop.brandName.trim()
                }
                onClick={handleSelectiveDeleteWorkshop}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
              >
                {savingAction ? 'جاري التنفيذ...' : 'تأكيد العملية'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 6: EDIT MATERIAL PRICE MODAL */}
      {/* ============================================================ */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 text-right space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
              <h3 className="font-black text-sm text-stone-900 dark:text-stone-100">
                تعديل سعر تكلفة الخامة
              </h3>
              <button
                type="button"
                onClick={() => setEditingMaterial(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
              الخامة: {editingMaterial.name || editingMaterial.material_name}
            </p>
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">
                سعر التكلفة الجديد ({currentSelectedWorkshop.currencySymbol}):
              </label>
              <input
                type="number"
                step="any"
                value={newMaterialPrice}
                onChange={(e) => setNewMaterialPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMaterial(null)}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveMaterialPrice}
                className="px-4 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
              >
                حفظ السعر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 7: NEW WORKSHOP MODAL */}
      {/* ============================================================ */}
      {isNewWorkshopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsNewWorkshopModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  تسجيل ورشة حرفية جديدة
                </h3>
              </div>
            </div>

            <form onSubmit={handleCreateNewWorkshop} className="space-y-4 pt-4 text-xs font-bold">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1">
                  اسم البراند / الورشة *
                </label>
                <input
                  type="text"
                  required
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="مثال: ورشة شمس للمكرميات"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1">
                  اسم الفنان / الفنانة *
                </label>
                <input
                  type="text"
                  required
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  placeholder="مثال: مريم الألفي"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-left outline-none"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-left outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsNewWorkshopModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border text-stone-700 dark:text-stone-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  {savingAction ? 'جاري التسجيل...' : 'إضافة الورشة فوراً'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
