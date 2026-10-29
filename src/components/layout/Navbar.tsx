import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, isUserAdmin } from '../../types';
import {
  Menu,
  Search,
  Bell,
  Mail,
  PlusCircle,
  PackagePlus,
  Calculator,
  Receipt,
  ShoppingCart,
  UserPlus,
  Users2,
  ChevronDown,
} from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from '../../lib/i18n';
import alshamsFalconEmblem from '../../assets/alshams_falcon_emblem.png';

export interface NavbarProps {
  profile: UserProfile;
  hasActiveSession?: boolean;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  onToggleSidebar: () => void;
  onOpenGlobalSearch: () => void;
  onGoHome: () => void;
  onOpenNotifications: () => void;
  onOpenMessagesHub?: () => void;
  // Quick creation actions
  onOpenNewMaterialModal?: () => void;
  onNavigateToCalculator?: () => void;
  onOpenSupplierInvoice?: () => void;
  onNavigateToSales?: () => void;
  onOpenNewClientModal?: () => void;
  onOpenNewEmployeeModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  hasActiveSession,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  onToggleSidebar,
  onOpenGlobalSearch,
  onGoHome,
  onOpenNotifications,
  onOpenMessagesHub,
  onOpenNewMaterialModal,
  onNavigateToCalculator,
  onOpenSupplierInvoice,
  onNavigateToSales,
  onOpenNewClientModal,
  onOpenNewEmployeeModal,
}) => {
  const { t: tr } = useTranslation();
  const [isQuickCreateMenuOpen, setIsQuickCreateMenuOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  // Close quick create dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(event.target as Node)) {
        setIsQuickCreateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const quickActions = [
    {
      label: tr('quick_add_material'),
      icon: PackagePlus,
      color: 'text-amber-600 dark:text-amber-400',
      action: onOpenNewMaterialModal,
    },
    {
      label: tr('quick_calc_product'),
      icon: Calculator,
      color: 'text-orange-600 dark:text-orange-400',
      action: onNavigateToCalculator,
    },
    {
      label: tr('quick_supplier_invoice'),
      icon: Receipt,
      color: 'text-blue-600 dark:text-blue-400',
      action: onOpenSupplierInvoice,
    },
    {
      label: tr('quick_sales_order'),
      icon: ShoppingCart,
      color: 'text-emerald-600 dark:text-emerald-400',
      action: onNavigateToSales,
    },
    {
      label: tr('quick_add_customer'),
      icon: UserPlus,
      color: 'text-teal-600 dark:text-teal-400',
      action: onOpenNewClientModal,
    },
    {
      label: tr('quick_hire_employee'),
      icon: Users2,
      color: 'text-violet-600 dark:text-violet-400',
      action: onOpenNewEmployeeModal,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* القسم الأيمن: زر القائمة + اللوجو الأيقوني + علامة الإشعارات + علامة مركز الإنشاء السريع */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* 1. زر القائمة الجانبية (أيقونة نقية مع تلميح) */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer flex items-center justify-center border border-stone-200 dark:border-stone-700/80 shadow-xs active:scale-95 shrink-0"
            aria-label={tr('main_menu')}
            title={tr('main_menu')}
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
          </button>

          {/* 2. اللوجو ممثلاً لمنظومة الشمساوية بصورة أيقونية نقية بدون كثرة كتابة */}
          <button
            type="button"
            onClick={onGoHome}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white dark:bg-stone-850 hover:bg-amber-500/10 dark:hover:bg-stone-800 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-center active:scale-95 group shrink-0 select-none shadow-xs"
            title={tr('home_screen')}
            aria-label={tr('app_name')}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center group-hover:scale-110 transition-transform">
              <img
                src={alshamsFalconEmblem}
                alt={tr('app_name')}
                className="w-full h-full object-contain filter drop-shadow-2xs select-none"
              />
            </div>
          </button>

          {/* 3. علامة الإشعارات كأيقونة أنيقة ونقية مع مؤشر التنبيه */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition-all duration-150 cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
            title={tr('notifications_alerts')}
            aria-label={tr('notifications')}
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-stone-700 dark:text-stone-300" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 bg-rose-600 text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadNotificationsCount > 99 ? '+99' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* 3.5. علامة الرسائل والمراسلات (Messages Hub) مع مؤشر الرسائل غير المقروءة */}
          <button
            type="button"
            onClick={onOpenMessagesHub}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition-all duration-150 cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
            title="الرسائل والمراسلات (Messages Hub)"
            aria-label="الرسائل"
          >
            <Mail className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-stone-700 dark:text-stone-300" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 bg-amber-600 text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadMessagesCount > 99 ? '+99' : unreadMessagesCount}
              </span>
            )}
          </button>

          {/* 4. علامة مركز الإنشاء السريع (أيقونة فقط مع ظهور التسمية عند المرور) */}
          <div className="relative shrink-0" ref={quickCreateRef}>
            <button
              type="button"
              onClick={() => setIsQuickCreateMenuOpen(!isQuickCreateMenuOpen)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl transition-all duration-150 cursor-pointer flex items-center justify-center border shadow-xs active:scale-95 ${
                isQuickCreateMenuOpen
                  ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/30'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80'
              }`}
              title={tr('quick_create')}
              aria-label={tr('quick_create')}
              aria-expanded={isQuickCreateMenuOpen}
            >
              <PlusCircle
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-200 ${
                  isQuickCreateMenuOpen
                    ? 'rotate-45 text-white'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              />
            </button>

            {/* قائمة الاختصارات السريعة المنبثقة من الزر */}
            {isQuickCreateMenuOpen && (
              <div className="absolute top-full mt-2 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-64 sm:w-72 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                <div className="px-2 py-1.5 border-b border-stone-100 dark:border-stone-800 mb-1 flex items-center justify-between">
                  <span className="text-xs font-black text-stone-800 dark:text-stone-200">
                    {tr('quick_create')}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    {tr('instant_action')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIsQuickCreateMenuOpen(false);
                          if (action.action) action.action();
                        }}
                        className="p-2 sm:p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-850 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-400 border border-stone-200/80 dark:border-stone-700/80 text-right transition flex items-center gap-2 cursor-pointer group active:scale-95"
                      >
                        <div className="w-7 h-7 rounded-xl bg-white dark:bg-stone-750 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                          <Icon className={`w-3.5 h-3.5 ${action.color}`} />
                        </div>
                        <span className="text-xs font-black text-stone-800 dark:text-stone-200 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Golden Royal Badge for Super Admin */}
          {isUserAdmin(profile) && (
            <div className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-600/20 border border-amber-400/60 shadow-xs shadow-amber-500/20 text-amber-950 dark:text-amber-200 text-[11px] font-black select-none animate-in fade-in">
              <span className="text-sm">👑</span>
              <span>كبير عيلة الشمساوية</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-600 text-white font-mono uppercase tracking-wider">
                Super Admin
              </span>
            </div>
          )}
        </div>

        {/* القسم الأيسر: مؤشر حالة الاتصال السحابي + البحث الموحد + محول اللغات (متباعدة تماماً وبدون أي تداخل) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* مكون حالة الاتصال بنبضات بصرية ملونة */}
          <ConnectionStatus hasActiveSession={hasActiveSession} />

          {/* البحث الموحد (أيقونة فقط مع تلميح وراحة بصرية) */}
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 shrink-0"
            title={tr('global_search_tooltip')}
            aria-label={tr('search')}
          >
            <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-600 dark:text-amber-400" />
          </button>

          {/* محول اللغات وتعدد اللغات بجوار البحث الموحد */}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};
