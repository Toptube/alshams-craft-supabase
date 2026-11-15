import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, InvoiceRecord, CustomerRecord } from '../../types';
import {
  SupabaseCustomer,
  getCustomersFromSupabase,
  createCustomerInSupabase,
  updateCustomerInSupabase,
  deleteCustomerInSupabase,
} from '../../db/supabaseService';
import { tenantStorage } from '../../db/dexieDB';
import { supabase } from '../../lib/supabase';
import {
  getCentralMarketplaceOrders,
  resolveOrderSource,
} from '../../services/marketplaceCartService';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  HelpCircle,
  MessageCircle,
  Globe,
  ShieldCheck,
  BookmarkPlus,
} from 'lucide-react';

export type CustomerSourceFilter = 'all' | 'direct_store' | 'marketplace' | 'external';
type ClientOriginTag = 'direct_store' | 'marketplace' | 'external';

interface UnifiedCustomerItem {
  key: string;
  dbId?: string;
  name: string;
  phone: string;
  country: string;
  governorate: string;
  address: string;
  notes?: string;
  sources: ClientOriginTag[];
  ordersCount: number;
  totalPurchases: number;
  lastActivityAt: number;
  isPrivacyHidden: boolean;
  editableRecord?: SupabaseCustomer;
}

interface CustomersViewProps {
  workshop: UserProfile;
  initialOpenAddModal?: boolean;
  onResetOpenAddModal?: () => void;
  onOpenHelp?: (sectionId: string) => void;
}

const KNOWN_COUNTRIES = [
  'مصر',
  'جمهورية مصر العربية',
  'السعودية',
  'المملكة العربية السعودية',
  'الإمارات',
  'الكويت',
  'قطر',
  'البحرين',
  'عمان',
  'الأردن',
  'لبنان',
  'فلسطين',
  'العراق',
  'المغرب',
  'تونس',
  'الجزائر',
  'ليبيا',
  'السودان',
  'أمريكا',
  'ألمانيا',
  'فرنسا',
  'إيطاليا',
  'بريطانيا',
];

const EGYPT_GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'القليوبية',
  'المنوفية',
  'الغربية',
  'الدقهلية',
  'الشرقية',
  'كفر الشيخ',
  'البحيرة',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
  'جنوب سيناء',
  'شمال سيناء',
  'مطروح',
  'الوادي الجديد',
];

function normalizeCountryLabel(raw?: string): string {
  const s = (raw || '').trim();
  if (!s) return 'مصر';
  if (s === 'جمهورية مصر العربية' || s.toLowerCase() === 'egypt' || s.toLowerCase() === 'eg') return 'مصر';
  if (s === 'المملكة العربية السعودية') return 'السعودية';
  return s;
}

function parseLocationFields(
  rawAddress?: string,
  explicitGov?: string,
  explicitCountry?: string
): { country: string; governorate: string; addressDetails: string } {
  const addr = (rawAddress || '').trim();
  const parts = addr
    .split(/[·|\-,،\/]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  let country = explicitCountry ? normalizeCountryLabel(explicitCountry) : '';
  let governorate = (explicitGov || '').trim();

  if (!country) {
    for (const part of parts) {
      const matchedCountry = KNOWN_COUNTRIES.find(
        (c) => part.includes(c) || c.includes(part)
      );
      if (matchedCountry) {
        country = normalizeCountryLabel(matchedCountry);
        break;
      }
    }
  }

  if (!governorate) {
    for (const part of parts) {
      const matchedGov = EGYPT_GOVERNORATES.find((g) => part.includes(g));
      if (matchedGov) {
        governorate = matchedGov;
        if (!country) country = 'مصر';
        break;
      }
    }
  }

  if (!governorate && parts.length > 0) {
    const firstNonCountry = parts.find(
      (p) => !KNOWN_COUNTRIES.some((c) => p === c || normalizeCountryLabel(p) === c)
    );
    if (firstNonCountry) governorate = firstNonCountry;
  }

  if (!country) country = 'مصر';
  if (!governorate) governorate = 'غير محدد';

  return {
    country,
    governorate,
    addressDetails: addr,
  };
}

function formatSourceLabel(src: ClientOriginTag): string {
  if (src === 'direct_store') return 'متجري';
  if (src === 'marketplace') return 'سوق الشمساوية';
  return 'خارج المنظومة';
}

function normalizePhoneDigits(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return '';
  return digits.slice(-10);
}

function toWhatsAppUrl(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  const formatted = digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${formatted}${query}`;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  workshop,
  initialOpenAddModal = false,
  onResetOpenAddModal,
  onOpenHelp,
}) => {
  const workshopId = workshop.tenantId || workshop.workshopId || workshop.id || '';

  const [unifiedCustomers, setUnifiedCustomers] = useState<UnifiedCustomerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [sourceFilter, setSourceFilter] = useState<CustomerSourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [governorateFilter, setGovernorateFilter] = useState<string>('all');

  // Add / Edit modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialOpenAddModal);
  const [editingCustomer, setEditingCustomer] = useState<SupabaseCustomer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    country: normalizeCountryLabel(workshop.country || 'مصر'),
    governorate: 'القاهرة',
    addressDetails: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [savingToBookKey, setSavingToBookKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setNotice({ text, isError });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadAllCustomers = useCallback(async () => {
    if (!workshopId) return;
    setLoading(true);
    try {
      const [supaRes, dexieCustomers, dexieOrders] = await Promise.all([
        getCustomersFromSupabase(workshopId),
        tenantStorage.getCustomers(workshopId).catch(() => [] as CustomerRecord[]),
        tenantStorage.getOrders(workshopId).catch(() => [] as InvoiceRecord[]),
      ]);

      let remoteOrders: InvoiceRecord[] = [];
      try {
        if (typeof navigator === 'undefined' || navigator.onLine) {
          const headers: Record<string, string> = {};
          if (workshop.email) headers['x-user-email'] = workshop.email;
          try {
            const { data } = await supabase.auth.getSession();
            if (data?.session?.access_token) {
              headers['Authorization'] = `Bearer ${data.session.access_token}`;
            }
          } catch {}
          const res = await fetch(
            `/api/workshop/orders?workshopId=${encodeURIComponent(workshopId)}`,
            { headers }
          );
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json?.orders)) remoteOrders = json.orders;
          }
        }
      } catch {}

      // 1. Deduplicate saved external/manual book entries (Supabase + Dexie)
      const savedMap = new Map<string, SupabaseCustomer & { country?: string; governorate?: string; createdAt?: number }>();
      (dexieCustomers || []).forEach((dc) => {
        if (!dc?.id) return;
        savedMap.set(dc.id, {
          id: dc.id,
          workshop_id: workshopId,
          name: dc.fullName || dc.name || 'عميل',
          phone: dc.phoneNumber || dc.phone || '',
          address: dc.address || dc.city || '',
          notes: dc.notes || '',
          country: dc.country,
          governorate: dc.governorate || dc.city,
          createdAt: dc.createdAt,
        });
      });
      (supaRes.data || []).forEach((sc) => {
        if (!sc?.id) return;
        const prev = savedMap.get(sc.id);
        savedMap.set(sc.id, {
          ...prev,
          ...sc,
        });
      });

      // 2. Build unified client map keyed by normalized phone (or name/id fallback)
      const clientsMap = new Map<string, UnifiedCustomerItem>();

      const addOrMergeClient = (entry: {
        dedupeKey: string;
        dbId?: string;
        name: string;
        phone: string;
        country: string;
        governorate: string;
        address: string;
        notes?: string;
        source: ClientOriginTag;
        ordersDelta: number;
        amountDelta: number;
        activityAt: number;
        isPrivacyHidden: boolean;
        editableRecord?: SupabaseCustomer;
      }) => {
        const existing = clientsMap.get(entry.dedupeKey);
        if (!existing) {
          clientsMap.set(entry.dedupeKey, {
            key: entry.dedupeKey,
            dbId: entry.dbId,
            name: entry.name,
            phone: entry.phone,
            country: entry.country,
            governorate: entry.governorate,
            address: entry.address,
            notes: entry.notes,
            sources: [entry.source],
            ordersCount: entry.ordersDelta,
            totalPurchases: entry.amountDelta,
            lastActivityAt: entry.activityAt,
            isPrivacyHidden: entry.isPrivacyHidden,
            editableRecord: entry.editableRecord,
          });
          return;
        }
        const mergedSources = existing.sources.includes(entry.source)
          ? existing.sources
          : [...existing.sources, entry.source];

        clientsMap.set(entry.dedupeKey, {
          ...existing,
          dbId: existing.dbId || entry.dbId,
          editableRecord: existing.editableRecord || entry.editableRecord,
          name:
            existing.isPrivacyHidden && !entry.isPrivacyHidden
              ? entry.name
              : existing.name || entry.name,
          phone:
            existing.isPrivacyHidden && !entry.isPrivacyHidden
              ? entry.phone
              : existing.phone || entry.phone,
          country:
            existing.country && existing.country !== 'غير محدد'
              ? existing.country
              : entry.country,
          governorate:
            existing.governorate && existing.governorate !== 'غير محدد'
              ? existing.governorate
              : entry.governorate,
          address: existing.address || entry.address,
          notes: existing.notes || entry.notes,
          sources: mergedSources,
          ordersCount: existing.ordersCount + entry.ordersDelta,
          totalPurchases: existing.totalPurchases + entry.amountDelta,
          lastActivityAt: Math.max(existing.lastActivityAt, entry.activityAt),
          isPrivacyHidden: existing.isPrivacyHidden && entry.isPrivacyHidden,
        });
      };

      // Insert external saved clients
      savedMap.forEach((sc) => {
        const phoneNorm = normalizePhoneDigits(sc.phone);
        const nameNorm = (sc.name || '').trim().toLowerCase();
        const dedupeKey = phoneNorm ? `ph_${phoneNorm}` : `ext_${sc.id}_${nameNorm}`;
        const loc = parseLocationFields(sc.address, sc.governorate, sc.country || workshop.country);
        addOrMergeClient({
          dedupeKey,
          dbId: sc.id,
          name: sc.name || 'عميل',
          phone: sc.phone || '',
          country: loc.country,
          governorate: loc.governorate,
          address: sc.address || `${loc.country} · ${loc.governorate}`,
          notes: sc.notes,
          source: 'external',
          ordersDelta: 0,
          amountDelta: 0,
          activityAt: sc.createdAt || 0,
          isPrivacyHidden: false,
          editableRecord: sc,
        });
      });

      // Deduplicate all orders by ID across Dexie + Central LocalStorage + Server
      const orderMap = new Map<string, InvoiceRecord>();
      const centralLocal = getCentralMarketplaceOrders().filter(
        (o) => o.workshopId === workshopId || o.tenantId === workshopId
      );
      [...centralLocal, ...remoteOrders, ...(dexieOrders || [])].forEach((o) => {
        if (!o || !o.id) return;
        const prev = orderMap.get(o.id);
        orderMap.set(o.id, {
          ...(prev || {}),
          ...o,
          orderSource: resolveOrderSource(
            o.orderSource ? o : prev?.orderSource ? { ...o, orderSource: prev.orderSource } : o
          ),
        });
      });

      // Merge order clients into unified clients map
      orderMap.forEach((order) => {
        const ordSrc = resolveOrderSource(order);
        const mappedSource: ClientOriginTag =
          ordSrc === 'direct_store'
            ? 'direct_store'
            : ordSrc === 'marketplace'
            ? 'marketplace'
            : 'external';

        const isHidden = Boolean(order.isClientDataHiddenFromArtisan);
        const rawPhone = isHidden ? '' : order.customerPhone || '';
        const phoneNorm = normalizePhoneDigits(rawPhone);
        const cleanName = isHidden
          ? `عميل طلب #${order.invoiceNumber || (order as any).orderNumber || order.id.slice(-5)}`
          : (order.customerName || 'عميل').trim();

        const dedupeKey = isHidden
          ? `hidden_${order.id}`
          : phoneNorm
          ? `ph_${phoneNorm}`
          : `ord_${mappedSource}_${cleanName.toLowerCase()}`;

        const rawAddr = isHidden
          ? `محافظة ${order.governorate || 'مصر'} — الشحن عبر منظومة الشمساوية`
          : order.detailedAddress || (order as any).shippingAddress || (order as any).address || '';

        const loc = parseLocationFields(rawAddr, order.governorate, workshop.country);
        const orderAmount = order.status === 'cancelled' ? 0 : Number(order.finalTotal ?? order.totalAmount ?? 0);

        addOrMergeClient({
          dedupeKey,
          name: cleanName,
          phone: isHidden ? 'محمي لإدارة الشحن المركزي' : rawPhone,
          country: loc.country,
          governorate: loc.governorate,
          address: rawAddr || `${loc.country} · ${loc.governorate}`,
          notes: order.notes,
          source: mappedSource,
          ordersDelta: 1,
          amountDelta: isNaN(orderAmount) ? 0 : orderAmount,
          activityAt: order.createdAt || order.updatedAt || Date.now(),
          isPrivacyHidden: isHidden,
        });
      });

      const list = Array.from(clientsMap.values()).sort((a, b) => {
        if (b.lastActivityAt !== a.lastActivityAt) return b.lastActivityAt - a.lastActivityAt;
        return a.name.localeCompare(b.name, 'ar');
      });

      setUnifiedCustomers(list);
    } catch (err: any) {
      showToast(err?.message || 'فشل تحميل بيانات العملاء', true);
    } finally {
      setLoading(false);
    }
  }, [workshopId, workshop.country, workshop.email]);

  useEffect(() => {
    loadAllCustomers();
    const refresh = () => loadAllCustomers();
    window.addEventListener('alshams_new_order_received', refresh);
    window.addEventListener('alshams_customers_changed', refresh);
    return () => {
      window.removeEventListener('alshams_new_order_received', refresh);
      window.removeEventListener('alshams_customers_changed', refresh);
    };
  }, [loadAllCustomers]);

  useEffect(() => {
    if (initialOpenAddModal) {
      setIsAddModalOpen(true);
      if (onResetOpenAddModal) onResetOpenAddModal();
    }
  }, [initialOpenAddModal, onResetOpenAddModal]);

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      phone: '',
      country: normalizeCountryLabel(workshop.country || 'مصر'),
      governorate: 'القاهرة',
      addressDetails: '',
      notes: '',
    });
    setEditingCustomer(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (c: SupabaseCustomer) => {
    const parsed = parseLocationFields(c.address, (c as any).governorate, (c as any).country);
    const cleanedDetails = (c.address || '')
      .replace(parsed.country, '')
      .replace(parsed.governorate, '')
      .replace(/^[·|\-,،\s]+|[·|\-,،\s]+$/g, '')
      .trim();
    setFormData({
      name: c.name || '',
      phone: c.phone || '',
      country: parsed.country,
      governorate: parsed.governorate === 'غير محدد' ? '' : parsed.governorate,
      addressDetails: cleanedDetails,
      notes: c.notes || '',
    });
    setEditingCustomer(c);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('يرجى إدخال اسم العميل', true);
      return;
    }

    const composedAddress = [
      formData.country.trim() || 'مصر',
      formData.governorate.trim(),
      formData.addressDetails.trim(),
    ]
      .filter(Boolean)
      .join(' · ');

    setSaving(true);
    try {
      if (editingCustomer) {
        const res = await updateCustomerInSupabase(editingCustomer.id, workshopId, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: composedAddress,
          notes: formData.notes.trim(),
        });
        if (res.error) {
          showToast(res.error.arabicMessage, true);
        } else {
          try {
            await tenantStorage.saveCustomer({
              id: editingCustomer.id,
              tenantId: workshopId,
              workshopId,
              name: formData.name.trim(),
              fullName: formData.name.trim(),
              phone: formData.phone.trim(),
              phoneNumber: formData.phone.trim(),
              country: formData.country.trim() || 'مصر',
              governorate: formData.governorate.trim() || 'غير محدد',
              city: formData.governorate.trim(),
              address: composedAddress,
              notes: formData.notes.trim(),
              updatedAt: Date.now(),
            });
          } catch {}
          showToast(`تم تحديث بيانات العميل "${formData.name.trim()}" بنجاح!`);
          handleCloseModal();
          loadAllCustomers();
        }
      } else {
        const res = await createCustomerInSupabase(workshopId, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: composedAddress,
          notes: formData.notes.trim(),
        });
        if (res.error) {
          showToast(res.error.arabicMessage, true);
        } else {
          try {
            await tenantStorage.saveCustomer({
              id: res.data?.id || 'cust_' + Date.now(),
              tenantId: workshopId,
              workshopId,
              name: formData.name.trim(),
              fullName: formData.name.trim(),
              phone: formData.phone.trim(),
              phoneNumber: formData.phone.trim(),
              country: formData.country.trim() || 'مصر',
              governorate: formData.governorate.trim() || 'غير محدد',
              city: formData.governorate.trim(),
              address: composedAddress,
              notes: formData.notes.trim(),
              totalPurchases: 0,
              outstandingBalance: 0,
              createdAt: Date.now(),
            });
          } catch {}
          showToast(`تم تسجيل العميل "${formData.name.trim()}" بنجاح في قاعدة البيانات!`);
          handleCloseModal();
          loadAllCustomers();
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء حفظ العميل', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnlineCustomerToBook = async (c: UnifiedCustomerItem) => {
    if (c.isPrivacyHidden || c.editableRecord) return;
    setSavingToBookKey(c.key);
    try {
      const composedAddress = c.address || [c.country, c.governorate].filter(Boolean).join(' · ');
      const res = await createCustomerInSupabase(workshopId, {
        name: c.name,
        phone: c.phone || undefined,
        address: composedAddress || undefined,
        notes: c.notes || undefined,
      });
      if (res.error) {
        showToast(res.error.arabicMessage, true);
      } else {
        try {
          await tenantStorage.saveCustomer({
            id: res.data?.id || 'cust_' + Date.now(),
            tenantId: workshopId,
            workshopId,
            name: c.name,
            fullName: c.name,
            phone: c.phone,
            phoneNumber: c.phone,
            country: c.country,
            governorate: c.governorate,
            city: c.governorate,
            address: composedAddress,
            notes: c.notes,
            totalPurchases: c.totalPurchases,
            outstandingBalance: 0,
            createdAt: Date.now(),
          });
        } catch {}
        showToast(`تم حفظ "${c.name}" في سجل عملاء الورشة بنجاح!`);
        loadAllCustomers();
      }
    } catch (err: any) {
      showToast(err?.message || 'تعذر حفظ العميل', true);
    } finally {
      setSavingToBookKey(null);
    }
  };

  const handleDelete = async (customer: SupabaseCustomer) => {
    const confirmed = window.confirm(`هل أنت متأكد من رغبتك في حذف العميل "${customer.name}"؟`);
    if (!confirmed) return;

    setDeletingId(customer.id);
    try {
      const res = await deleteCustomerInSupabase(customer.id, workshopId);
      if (res.error) {
        showToast(res.error.arabicMessage, true);
      } else {
        showToast(`تم حذف العميل "${customer.name}" بنجاح!`);
        loadAllCustomers();
      }
    } catch (err: any) {
      showToast(err?.message || 'فشل حذف العميل', true);
    } finally {
      setDeletingId(null);
    }
  };

  // Source counts
  const sourceCounts = useMemo(() => {
    const counts = {
      all: unifiedCustomers.length,
      direct_store: 0,
      marketplace: 0,
      external: 0,
    };
    unifiedCustomers.forEach((c) => {
      if (c.sources.includes('direct_store')) counts.direct_store += 1;
      if (c.sources.includes('marketplace')) counts.marketplace += 1;
      if (c.sources.includes('external')) counts.external += 1;
    });
    return counts;
  }, [unifiedCustomers]);

  // Distinct countries & governorates for quick filter dropdowns
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    unifiedCustomers.forEach((c) => {
      if (c.country && c.country !== 'غير محدد') set.add(c.country);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [unifiedCustomers]);

  const availableGovernorates = useMemo(() => {
    const set = new Set<string>();
    unifiedCustomers.forEach((c) => {
      if (countryFilter !== 'all' && c.country !== countryFilter) return;
      if (c.governorate && c.governorate !== 'غير محدد') set.add(c.governorate);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [unifiedCustomers, countryFilter]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return unifiedCustomers.filter((c) => {
      if (sourceFilter !== 'all' && !c.sources.includes(sourceFilter)) return false;
      if (countryFilter !== 'all' && c.country !== countryFilter) return false;
      if (governorateFilter !== 'all' && c.governorate !== governorateFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.governorate.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
      );
    });
  }, [unifiedCustomers, sourceFilter, countryFilter, governorateFilter, searchQuery]);

  const sourceTabs: { id: CustomerSourceFilter; label: string; count: number }[] = [
    { id: 'all', label: 'الكل', count: sourceCounts.all },
    { id: 'direct_store', label: 'متجري', count: sourceCounts.direct_store },
    { id: 'marketplace', label: 'سوق الشمساوية', count: sourceCounts.marketplace },
    { id: 'external', label: 'خارج المنظومة', count: sourceCounts.external },
  ];

  return (
    <div className="space-y-5 text-right max-w-6xl mx-auto px-3 sm:px-5 pt-4 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
            <Users className="w-4 h-4" />
            <span>دليل العملاء الموحد</span>
            {onOpenHelp && (
              <button
                type="button"
                onClick={() => onOpenHelp('customers')}
                className="text-[#475569] hover:text-[#EA580C] cursor-pointer"
                title="ما معنى هذا؟"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA] mt-1">
            عملائي
          </h2>
          <p className="text-xs text-[#334155] dark:text-[#CBD5E1] mt-0.5">
            جميع عملاء متجرك وسوق الشمساوية والعملاء المسجلين من خارج المنظومة ببياناتهم الكاملة في مكان واحد.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer transition active:scale-95 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عميل جديد</span>
        </button>
      </div>

      {/* Toast */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {notice.isError ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Source Filter Tabs + Multi-Field Search & Country/Governorate Filters */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-3 shadow-xs">
        {/* 4 Concise Source Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#E9E2D4] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E]">
          {sourceTabs.map((tab) => {
            const active = sourceFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white shadow-sm'
                    : 'text-[#334155] dark:text-[#CBD5E1] hover:text-[#0C1427] dark:hover:text-white bg-[#F7F3EA]/80 dark:bg-[#132040]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-amber-100' : 'text-[#C2410C] dark:text-[#FBBF24]'
                  }`}
                >
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Country / Governorate Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          <div className="relative md:col-span-6">
            <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو رقم التليفون أو الدولة أو المحافظة..."
              className="w-full h-10 pr-9 pl-8 rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0C1427] dark:hover:text-white p-0.5 cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setGovernorateFilter('all');
              }}
              aria-label="تصفية حسب الدولة"
              className="w-full h-10 px-3 rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
            >
              <option value="all">كل الدول</option>
              {availableCountries.map((cn) => (
                <option key={cn} value={cn}>
                  {cn}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <select
              value={governorateFilter}
              onChange={(e) => setGovernorateFilter(e.target.value)}
              aria-label="تصفية حسب المحافظة"
              className="flex-1 h-10 px-3 rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
            >
              <option value="all">كل المحافظات</option>
              {availableGovernorates.map((gv) => (
                <option key={gv} value={gv}>
                  {gv}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-mono tabular-nums font-bold text-[#475569] dark:text-[#94A3B8] whitespace-nowrap">
              {filteredCustomers.length} / {unifiedCustomers.length}
            </span>
          </div>
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#475569] dark:text-[#94A3B8] font-bold">
          جاري تجميع بيانات عملاء متجرك وسوق الشمساوية والدفتر...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] text-[#C2410C] dark:text-[#FBBF24] mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            {searchQuery || sourceFilter !== 'all' || countryFilter !== 'all' || governorateFilter !== 'all'
              ? 'لا يوجد عملاء يطابقون معايير البحث أو الفلترة الحالية'
              : 'لا يوجد عملاء مسجلين بعد'}
          </h3>
          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] max-w-md mx-auto">
            {searchQuery || sourceFilter !== 'all' || countryFilter !== 'all' || governorateFilter !== 'all'
              ? 'جرّب تغيير الفلتر إلى "الكل" أو مسح البحث للوصول لجميع عملائك.'
              : 'سيظهر هنا تلقائياً كل عميل يشتري من متجرك أو سوق الشمساوية، كما يمكنك إضافة عملاء من خارج المنظومة.'}
          </p>
          {(searchQuery || sourceFilter !== 'all' || countryFilter !== 'all' || governorateFilter !== 'all') ? (
            <button
              type="button"
              onClick={() => {
                setSourceFilter('all');
                setSearchQuery('');
                setCountryFilter('all');
                setGovernorateFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white text-xs font-black cursor-pointer"
            >
              عرض الكل
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة أول عميل</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => {
            const hasCallablePhone =
              !c.isPrivacyHidden && c.phone.replace(/\D/g, '').length >= 8;
            const sourceText = c.sources.map(formatSourceLabel).join(' · ');

            return (
              <div
                key={c.key}
                className="p-4 sm:p-5 rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] space-y-3 shadow-xs hover:border-[#EA580C] transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  {/* Lead with Customer Name + Unboxed Metadata */}
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                        {c.name}
                      </h3>
                      {c.isPrivacyHidden && (
                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>خصوصية</span>
                        </span>
                      )}
                    </div>

                    {/* Clean Unboxed Metadata Line (Source · Country · Governorate) */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1]">
                      <span className="text-[#C2410C] dark:text-[#FBBF24] font-black">
                        {sourceText}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3 h-3 opacity-70" />
                        <span>{c.country}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 opacity-70" />
                        <span>{c.governorate}</span>
                      </span>
                    </div>
                  </div>

                  {/* Phone + Orders Summary */}
                  <div className="pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                        الهاتف:
                      </span>
                      {hasCallablePhone ? (
                        <a
                          href={`tel:${c.phone}`}
                          dir="ltr"
                          className="font-mono tabular-nums text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{c.phone}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                          {c.isPrivacyHidden ? 'محمي للشحن المركزي' : 'غير مسجل'}
                        </span>
                      )}
                    </div>

                    {c.address && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] shrink-0">
                          العنوان:
                        </span>
                        <span className="text-[11px] text-[#0C1427] dark:text-[#F7F3EA] text-left line-clamp-2">
                          {c.address}
                        </span>
                      </div>
                    )}

                    {c.ordersCount > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                          الطلبات والتعاملات:
                        </span>
                        <span className="font-mono tabular-nums text-[11px] font-black text-[#0C1427] dark:text-[#FBBF24]">
                          {c.ordersCount} طلب · {c.totalPurchases.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    )}
                  </div>

                  {c.notes && (
                    <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] pt-1.5 border-t border-[#D4CCBC]/50 dark:border-[#22355E]/70 line-clamp-2 leading-relaxed">
                      ملاحظات: {c.notes}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    {hasCallablePhone && (
                      <a
                        href={toWhatsAppUrl(
                          c.phone,
                          `أهلاً بحضرتك أ/ ${c.name}، معك ورشة ${workshop.brandName || workshop.artistName} ☀️`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black inline-flex items-center gap-1 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </a>
                    )}

                    {!c.editableRecord && !c.isPrivacyHidden && (
                      <button
                        type="button"
                        onClick={() => handleSaveOnlineCustomerToBook(c)}
                        disabled={savingToBookKey === c.key}
                        className="px-2.5 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:border-[#EA580C] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="حفظ بيانات العميل في سجل الورشة"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-[#EA580C]" />
                        <span>{savingToBookKey === c.key ? 'جاري الحفظ...' : 'حفظ بالدفتر'}</span>
                      </button>
                    )}
                  </div>

                  {c.editableRecord && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(c.editableRecord!)}
                        className="px-2.5 py-1.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C] transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      >
                        <Edit2 className="w-3 h-3 text-[#EA580C]" />
                        <span>تعديل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(c.editableRecord!)}
                        disabled={deletingId === c.editableRecord.id}
                        className="px-2.5 py-1.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50 flex items-center gap-1 text-[11px] font-bold"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit External Customer Modal */}
      {(isAddModalOpen || editingCustomer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSubmit}
            className="bg-[#F7F3EA] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] rounded-3xl p-6 border border-[#D4CCBC] dark:border-[#22355E] w-full max-w-md space-y-3.5 text-right shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-[#475569] hover:text-[#0C1427] dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-[#C2410C] dark:text-amber-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#EA580C]" />
                <span>{editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل من خارج المنظومة'}</span>
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">اسم العميل أو المعرض *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: أ/ ريهام محمود، معرض لمسات بوهيمية"
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs font-bold outline-none focus:border-[#EA580C]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">رقم الهاتف / واتساب</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs font-mono text-left outline-none focus:border-[#EA580C]"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold mb-1">الدولة</label>
                <input
                  type="text"
                  list="alshams-countries-list"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="مصر"
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs outline-none focus:border-[#EA580C]"
                />
                <datalist id="alshams-countries-list">
                  <option value="مصر" />
                  <option value="السعودية" />
                  <option value="الإمارات" />
                  <option value="الكويت" />
                  <option value="قطر" />
                  <option value="الأردن" />
                  <option value="عمان" />
                  <option value="البحرين" />
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">المحافظة / المدينة</label>
                <input
                  type="text"
                  list="alshams-govs-list"
                  value={formData.governorate}
                  onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                  placeholder="القاهرة"
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs outline-none focus:border-[#EA580C]"
                />
                <datalist id="alshams-govs-list">
                  {EGYPT_GOVERNORATES.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">تفاصيل العنوان</label>
              <input
                type="text"
                value={formData.addressDetails}
                onChange={(e) => setFormData({ ...formData, addressDetails: e.target.value })}
                placeholder="الحي، الشارع، علامة مميزة..."
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs outline-none focus:border-[#EA580C]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">ملاحظات العميل</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ألوان مفضلة، متطلبات تغليف خاصة، تفاصيل شحن..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#060B18] text-xs outline-none focus:border-[#EA580C] resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-bold text-[#475569] dark:text-[#94A3B8] hover:text-[#0C1427] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white text-xs font-black cursor-pointer disabled:opacity-50 transition active:scale-95 shadow-sm"
              >
                {saving ? 'جاري الحفظ...' : editingCustomer ? 'حفظ التعديلات' : 'حفظ العميل'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
