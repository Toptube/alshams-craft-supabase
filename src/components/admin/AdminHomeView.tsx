import React, { useMemo, useState } from 'react';
import {
  Building2,
  ShoppingBag,
  Store,
  Boxes,
  UserCheck,
  Sparkles,
  Scale,
  PlusCircle,
  BarChart2,
  Search,
  X,
  Play,
  ShieldAlert,
  Snowflake,
  Ban,
  Edit3,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  Activity,
  Eye,
  EyeOff,
  Users,
  Truck,
} from 'lucide-react';
import {
  AdminPageId,
  EnrichedWorkshopProfile,
  getWorkshopStatusKey,
  getWorkshopStatusLabel,
  formatWhatsAppPhone,
} from './adminTypes';
import { playSuccessSound } from '../../lib/sounds';

interface AdminHomeViewProps {
  workshops: EnrichedWorkshopProfile[];
  selectedWorkshopId: string;
  onSelectWorkshopId: (id: string) => void;
  onNavigatePage: (page: AdminPageId) => void;
  onOpenNewWorkshop: () => void;
  pendingApplicationsCount: number;
  pendingProductsCount: number;
  pendingAppealsCount: number;
  onActivateWorkshopContext?: (workshop: EnrichedWorkshopProfile) => void;
  onEditWorkshop: (workshop: EnrichedWorkshopProfile) => void;
  onSuspendWorkshop: (workshop: EnrichedWorkshopProfile) => void;
  onBanWorkshop: (workshop: EnrichedWorkshopProfile) => void;
  onReactivateWorkshop: (workshop: EnrichedWorkshopProfile) => void;
  onOpenAudit: (workshop: EnrichedWorkshopProfile) => void;
  onToggleWorkshopVisibility?: (
    workshop: EnrichedWorkshopProfile,
    field: 'hideStorefront' | 'hideFromMarket'
  ) => void;
}

export const AdminHomeView: React.FC<AdminHomeViewProps> = ({
  workshops,
  selectedWorkshopId,
  onSelectWorkshopId,
  onNavigatePage,
  onOpenNewWorkshop,
  pendingApplicationsCount,
  pendingProductsCount,
  pendingAppealsCount,
  onActivateWorkshopContext,
  onEditWorkshop,
  onSuspendWorkshop,
  onBanWorkshop,
  onReactivateWorkshop,
  onOpenAudit,
  onToggleWorkshopVisibility,
}) => {
  const [quickSearch, setQuickSearch] = useState('');
  const [showManageMenu, setShowManageMenu] = useState(false);

  const matchingWorkshops = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return workshops;
    return workshops.filter((w) => {
      const b = (w.brandName || '').toLowerCase();
      const a = (w.artistName || '').toLowerCase();
      const p = (w.phoneNumber || '').toLowerCase();
      const e = (w.email || '').toLowerCase();
      return b.includes(q) || a.includes(q) || p.includes(q) || e.includes(q);
    });
  }, [workshops, quickSearch]);

  const activeWorkshop = useMemo(() => {
    return (
      matchingWorkshops.find((w) => w.id === selectedWorkshopId) ||
      matchingWorkshops[0] ||
      workshops.find((w) => w.id === selectedWorkshopId) ||
      workshops[0] ||
      null
    );
  }, [matchingWorkshops, workshops, selectedWorkshopId]);

  const cards: {
    id: string;
    label: string;
    icon: React.ReactNode;
    circleClass: string;
    badgeCount?: number;
    badgeAccent?: string;
    onClick: () => void;
  }[] = [
    {
      id: 'workshops',
      label: 'الورش',
      icon: <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#0C1427] dark:text-[#FBBF24]" />,
      circleClass: 'bg-[#E9E2D4] dark:bg-[#1A2B54] border-[#D4CCBC] dark:border-[#2D4475]',
      onClick: () => onNavigatePage('workshops'),
    },
    {
      id: 'customers',
      label: 'العملاء',
      icon: <Users className="w-5 h-5 sm:w-6 sm:h-6 text-sky-700 dark:text-sky-300" />,
      circleClass: 'bg-sky-100 dark:bg-sky-950/60 border-sky-300/60 dark:border-sky-700/60',
      onClick: () => onNavigatePage('customers'),
    },
    {
      id: 'suppliers',
      label: 'الموردين',
      icon: <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700 dark:text-emerald-300" />,
      circleClass: 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300/60 dark:border-emerald-700/60',
      onClick: () => onNavigatePage('suppliers'),
    },
    {
      id: 'marketplace',
      label: 'سوق الشمساوية',
      icon: <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-[#C2410C] dark:text-[#FDBA74]" />,
      circleClass: 'bg-orange-100 dark:bg-orange-950/60 border-orange-300/60 dark:border-orange-700/60',
      onClick: () => onNavigatePage('marketplace'),
    },
    {
      id: 'stores',
      label: 'إدارة المتاجر',
      icon: <Store className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-700 dark:text-indigo-300" />,
      circleClass: 'bg-indigo-100 dark:bg-indigo-950/60 border-indigo-300/60 dark:border-indigo-700/60',
      onClick: () => onNavigatePage('stores'),
    },
    {
      id: 'catalogs',
      label: 'الكتالوجات والمعارض',
      icon: <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-teal-700 dark:text-teal-300" />,
      circleClass: 'bg-teal-100 dark:bg-teal-950/60 border-teal-300/60 dark:border-teal-700/60',
      onClick: () => onNavigatePage('catalogs'),
    },
    {
      id: 'applications',
      label: 'طلبات الانضمام',
      icon: <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700 dark:text-emerald-300" />,
      circleClass: 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300/60 dark:border-emerald-700/60',
      badgeCount: pendingApplicationsCount,
      badgeAccent: 'bg-emerald-600 text-white',
      onClick: () => onNavigatePage('applications'),
    },
    {
      id: 'product_approvals',
      label: 'المنتجات المعلقة',
      icon: <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#EA580C] dark:text-[#FBBF24]" />,
      circleClass: 'bg-amber-100 dark:bg-amber-950/60 border-amber-300/60 dark:border-amber-700/60',
      badgeCount: pendingProductsCount,
      badgeAccent: 'bg-[#EA580C] text-white',
      onClick: () => onNavigatePage('product_approvals'),
    },
    {
      id: 'appeals',
      label: 'الطعون والتظلمات',
      icon: <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-rose-700 dark:text-rose-300" />,
      circleClass: 'bg-rose-100 dark:bg-rose-950/60 border-rose-300/60 dark:border-rose-700/60',
      badgeCount: pendingAppealsCount,
      badgeAccent: 'bg-rose-600 text-white',
      onClick: () => onNavigatePage('appeals'),
    },
    {
      id: 'new_workshop',
      label: 'تسجيل ورشة جديدة',
      icon: <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6 text-sky-700 dark:text-sky-300" />,
      circleClass: 'bg-sky-100 dark:bg-sky-950/60 border-sky-300/60 dark:border-sky-700/60',
      onClick: onOpenNewWorkshop,
    },
    {
      id: 'reports',
      label: 'التقارير والرسوم',
      icon: <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6 text-violet-700 dark:text-violet-300" />,
      circleClass: 'bg-violet-100 dark:bg-violet-950/60 border-violet-300/60 dark:border-violet-700/60',
      onClick: () => onNavigatePage('reports'),
    },
    {
      id: 'landing_cms',
      label: 'صفحة الهبوط والشعارات',
      icon: <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-[#C2410C] dark:text-[#FBBF24]" />,
      circleClass: 'bg-amber-100 dark:bg-amber-950/60 border-amber-300/60 dark:border-amber-700/60',
      onClick: () => onNavigatePage('landing_cms'),
    },
    {
      id: 'feature_visibility',
      label: 'ظهور وإخفاء الصفحات',
      icon: <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700 dark:text-emerald-300" />,
      circleClass: 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300/60 dark:border-emerald-700/60',
      onClick: () => onNavigatePage('feature_visibility'),
    },
  ];

  const statusMeta = activeWorkshop ? getWorkshopStatusLabel(activeWorkshop) : null;
  const activeKey = activeWorkshop ? getWorkshopStatusKey(activeWorkshop) : 'active';
  const waPhone = activeWorkshop ? formatWhatsAppPhone(activeWorkshop.phoneNumber) : '';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-6">
      {/* شبكة أزرار التحكم السريع (3 أعمدة × 9 كروت بدون أي تكرار أو ديباجة) */}
      <section aria-label="لوحة التحكم السريع">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              className="relative rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] dark:hover:border-[#FBBF24] p-3 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-3 text-center transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] cursor-pointer min-h-[104px] sm:min-h-[126px] group"
            >
              {typeof card.badgeCount === 'number' && card.badgeCount > 0 && (
                <span
                  className={`absolute top-2 left-2 min-w-[20px] h-5 px-1.5 rounded-full font-mono tabular-nums text-[10px] sm:text-xs font-black flex items-center justify-center shadow-xs ${
                    card.badgeAccent || 'bg-[#EA580C] text-white'
                  }`}
                >
                  {card.badgeCount}
                </span>
              )}

              <div
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full border flex items-center justify-center transition-transform group-hover:scale-105 ${card.circleClass}`}
              >
                {card.icon}
              </div>

              <span className="text-[11px] sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] group-hover:text-[#C2410C] dark:group-hover:text-[#FBBF24] leading-tight">
                {card.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* البحث المتقدم في الورش مع بطاقة التحكم الفوري */}
      <section
        aria-label="البحث المتقدم في الورش"
        className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>البحث المتقدم في الورش</span>
          </h2>
          <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] font-mono tabular-nums">
            إجمالي الورش: {workshops.length}
          </span>
        </div>

        {/* حقل البحث الفوري + قائمة اختيار الورشة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => {
                const val = e.target.value;
                setQuickSearch(val);
                const q = val.trim().toLowerCase();
                if (q) {
                  const firstMatch = workshops.find(
                    (w) =>
                      (w.brandName || '').toLowerCase().includes(q) ||
                      (w.artistName || '').toLowerCase().includes(q) ||
                      (w.phoneNumber || '').toLowerCase().includes(q) ||
                      (w.email || '').toLowerCase().includes(q)
                  );
                  if (firstMatch) {
                    onSelectWorkshopId(firstMatch.id);
                  }
                }
              }}
              placeholder="ابحث باسم البراند، الفنان، الهاتف، أو البريد..."
              className="w-full h-11 pr-10 pl-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] placeholder-[#475569] dark:placeholder-[#94A3B8] outline-none focus:border-[#EA580C]"
            />
            {quickSearch && (
              <button
                type="button"
                onClick={() => setQuickSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0C1427] dark:text-[#94A3B8] dark:hover:text-white cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={activeWorkshop?.id || ''}
            onChange={(e) => {
              onSelectWorkshopId(e.target.value);
              setShowManageMenu(false);
            }}
            aria-label="اختيار الورشة من نتائج البحث"
            className="w-full h-11 px-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C] cursor-pointer"
          >
            {matchingWorkshops.length === 0 ? (
              <option value="">لا توجد ورشة مطابقة للبحث</option>
            ) : (
              matchingWorkshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.brandName} — {w.artistName} ({w.country || 'مصر'})
                </option>
              ))
            )}
          </select>
        </div>

        {/* بطاقة الورشة المحددة وأزرار التحكم الفوري */}
        {activeWorkshop ? (
          <div className="rounded-xl bg-[#EFE9DC]/70 dark:bg-[#132040]/80 border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                    {activeWorkshop.brandName}
                  </h3>
                  {statusMeta && (
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#334155] dark:text-[#CBD5E1] font-medium">
                  <span>الفنان: <strong className="text-[#0C1427] dark:text-[#F7F3EA]">{activeWorkshop.artistName}</strong></span>
                  <span className="inline-flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                    {activeWorkshop.country || 'مصر'}
                  </span>
                  {activeWorkshop.phoneNumber && (
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums" dir="ltr">
                      <Phone className="w-3 h-3 text-[#EA580C] dark:text-[#FBBF24]" />
                      {activeWorkshop.phoneNumber}
                    </span>
                  )}
                  {activeWorkshop.email && (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] truncate max-w-[210px]">
                      <Mail className="w-3 h-3 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
                      {activeWorkshop.email}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                <div className="px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-center">
                  <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">المنتجات</span>
                  <span className="font-black text-[#0C1427] dark:text-[#F7F3EA]">{activeWorkshop.productsCount ?? 0}</span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-center">
                  <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">المعروضات</span>
                  <span className="font-black text-[#C2410C] dark:text-[#FBBF24]">{activeWorkshop.marketplaceProductsCount ?? 0}</span>
                </div>
              </div>
            </div>

            {/* أزرار التحكم الفوري بالورشة */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
              {onActivateWorkshopContext && (
                <button
                  type="button"
                  onClick={() => {
                    playSuccessSound();
                    onActivateWorkshopContext(activeWorkshop);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تفعيل سياق الورشة</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowManageMenu((prev) => !prev)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#1A2B54] dark:hover:bg-[#22355E] text-[#F7F3EA] border border-[#22355E] text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>إدارة وحظر / إيقاف الورشة</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAudit(activeWorkshop)}
                className="px-3 py-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] hover:border-[#EA580C] border border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                <span>فحص النشاط</span>
              </button>

              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-600/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>واتساب</span>
                </a>
              )}
            </div>

            {showManageMenu && (
              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-[#D4CCBC] dark:border-[#22355E] animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => onEditWorkshop(activeWorkshop)}
                  className="px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                  <span>تعديل البيانات وكلمة السر</span>
                </button>

                {activeKey !== 'active' && (
                  <button
                    type="button"
                    onClick={() => onReactivateWorkshop(activeWorkshop)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>إلغاء الإيقاف وتفعيل الورشة</span>
                  </button>
                )}

                {activeKey !== 'suspended' && (
                  <button
                    type="button"
                    onClick={() => onSuspendWorkshop(activeWorkshop)}
                    className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Snowflake className="w-3.5 h-3.5" />
                    <span>إيقاف مؤقت</span>
                  </button>
                )}

                {activeKey !== 'banned' && (
                  <button
                    type="button"
                    onClick={() => onBanWorkshop(activeWorkshop)}
                    className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>حظر نهائي</span>
                  </button>
                )}

                {onToggleWorkshopVisibility && (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggleWorkshopVisibility(activeWorkshop, 'hideStorefront')}
                      className={`px-3 py-2 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer transition ${
                        activeWorkshop.hideStorefront || activeWorkshop.hide_storefront
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-300'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C]'
                      }`}
                    >
                      {activeWorkshop.hideStorefront || activeWorkshop.hide_storefront ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Store className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                      )}
                      <span>
                        {activeWorkshop.hideStorefront || activeWorkshop.hide_storefront
                          ? 'إظهار المتجر الخاص'
                          : 'إخفاء المتجر الخاص'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleWorkshopVisibility(activeWorkshop, 'hideFromMarket')}
                      className={`px-3 py-2 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer transition ${
                        activeWorkshop.hideFromMarket || activeWorkshop.hide_from_market
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-800 dark:text-rose-300'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C]'
                      }`}
                    >
                      {activeWorkshop.hideFromMarket || activeWorkshop.hide_from_market ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <ShoppingBag className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />
                      )}
                      <span>
                        {activeWorkshop.hideFromMarket || activeWorkshop.hide_from_market
                          ? 'إظهار في سوق الشمساوية'
                          : 'إخفاء من سوق الشمساوية'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#475569] dark:text-[#94A3B8] text-center py-4">
            لا توجد ورش مسجلة مطابقة للبحث الحالي.
          </p>
        )}
      </section>
    </div>
  );
};
