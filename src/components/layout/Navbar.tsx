import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../../types';
import {
  Menu,
  Search,
  Bell,
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
import alshamsFalconEmblem from '../../assets/alshams_falcon_emblem.png';

export interface NavbarProps {
  profile: UserProfile;
  hasActiveSession?: boolean;
  unreadNotificationsCount?: number;
  onToggleSidebar: () => void;
  onOpenGlobalSearch: () => void;
  onGoHome: () => void;
  onOpenNotifications: () => void;
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
  onToggleSidebar,
  onOpenGlobalSearch,
  onGoHome,
  onOpenNotifications,
  onOpenNewMaterialModal,
  onNavigateToCalculator,
  onOpenSupplierInvoice,
  onNavigateToSales,
  onOpenNewClientModal,
  onOpenNewEmployeeModal,
}) => {
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
      label: 'إضافة خامة',
      icon: PackagePlus,
      color: 'text-amber-600 dark:text-amber-400',
      action: onOpenNewMaterialModal,
    },
    {
      label: 'حاسبة منتج',
      icon: Calculator,
      color: 'text-orange-600 dark:text-orange-400',
      action: onNavigateToCalculator,
    },
    {
      label: 'فاتورة مورد',
      icon: Receipt,
      color: 'text-blue-600 dark:text-blue-400',
      action: onOpenSupplierInvoice,
    },
    {
      label: 'أمر بيع',
      icon: ShoppingCart,
      color: 'text-emerald-600 dark:text-emerald-400',
      action: onNavigateToSales,
    },
    {
      label: 'تسجيل عميل',
      icon: UserPlus,
      color: 'text-teal-600 dark:text-teal-400',
      action: onOpenNewClientModal,
    },
    {
      label: 'تعيين موظف',
      icon: Users2,
      color: 'text-violet-600 dark:text-violet-400',
      action: onOpenNewEmployeeModal,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-1 sm:gap-2">
        {/* القسم الأيمن: زر القائمة + اللوجو المرفق وعنوان "المنظومة الشمساويه" + علامة الإشعارات + علامة مركز الإنشاء السريع */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {/* 1. زر القائمة الجانبية */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer flex items-center gap-1.5 border border-stone-200 dark:border-stone-700/80 shadow-xs active:scale-95 shrink-0"
            aria-label="القائمة الجانبية"
            title="فتح القائمة الرئيسية"
          >
            <Menu className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline text-xs font-black text-stone-800 dark:text-stone-200">
              القائمة
            </span>
          </button>

          {/* 2. زر "منظومة الشمساوية" مع أيقونة الصقر الشفافة الرسمية للشاشة الرئيسية */}
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-2.5 px-2 sm:px-2.5 py-1.5 rounded-2xl hover:bg-amber-50/80 dark:hover:bg-stone-800/80 transition cursor-pointer border border-transparent hover:border-amber-200/80 dark:hover:border-stone-700 active:scale-95 group shrink-0"
            title="الانتقال إلى الشاشة الرئيسية - منظومة الشمساوية"
            aria-label="الانتقال إلى الشاشة الرئيسية - منظومة الشمساوية"
          >
            {/* أيقونة الشاشة الرئيسية الرسمية المعتمدة (كاملة بدون قص بخلفية شفافة) */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-visible">
              <img
                src={alshamsFalconEmblem}
                alt="أيقونة الشاشة الرئيسية - منظومة الشمساوية"
                className="w-full h-full object-contain filter drop-shadow-2xs select-none"
              />
            </div>
            <div className="text-right">
              <span className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 block leading-tight">
                منظومة الشمساوية
              </span>
              <span className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-bold block leading-none truncate max-w-[120px] sm:max-w-[160px]">
                {profile.brandName || 'ورشة الفنون والإنتاج'}
              </span>
            </div>
          </button>

          {/* 3. علامة الإشعارات (توضع مباشرة بعد المنظومة الشمساويه) */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2 sm:px-2.5 sm:py-2 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0"
            title="الإشعارات والتنبيهات"
            aria-label="الإشعارات"
          >
            <Bell className="w-4 h-4 text-stone-700 dark:text-stone-300" />
            <span className="hidden lg:inline text-xs font-black">
              الإشعارات
            </span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadNotificationsCount > 99 ? '+99' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* 4. علامة مركز الإنشاء السريع (توضع مباشرة بعد علامة الإشعارات) */}
          <div className="relative shrink-0" ref={quickCreateRef}>
            <button
              type="button"
              onClick={() => setIsQuickCreateMenuOpen(!isQuickCreateMenuOpen)}
              className={`p-2 sm:px-3 sm:py-2 rounded-2xl transition cursor-pointer flex items-center gap-1.5 border shadow-xs active:scale-95 ${
                isQuickCreateMenuOpen
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80'
              }`}
              title="مركز الإنشاء السريع"
              aria-label="مركز الإنشاء السريع"
              aria-expanded={isQuickCreateMenuOpen}
            >
              <PlusCircle
                className={`w-4 h-4 transition-transform duration-200 ${
                  isQuickCreateMenuOpen
                    ? 'rotate-45 text-white'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              />
              <span className="hidden sm:inline text-xs font-black">
                مركز الإنشاء السريع
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 hidden sm:inline ${
                  isQuickCreateMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* قائمة الاختصارات السريعة المنبثقة من الزر */}
            {isQuickCreateMenuOpen && (
              <div className="absolute top-full mt-2 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-64 sm:w-72 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-3 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                <div className="px-2 py-1.5 border-b border-stone-100 dark:border-stone-800 mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-black text-stone-800 dark:text-stone-200">
                    مركز الإنشاء السريع
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    إجراء فوري
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
                        className="p-2 sm:p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-400 border border-stone-200/80 dark:border-stone-700/80 text-right transition flex items-center gap-2 cursor-pointer group active:scale-95"
                      >
                        <div className="w-7 h-7 rounded-xl bg-white dark:bg-stone-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
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
        </div>

        {/* القسم الأيسر: مؤشر حالة الاتصال السحابي والبحث الموحد */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* مكون حالة الاتصال بنبضات بصرية ملونة */}
          <ConnectionStatus hasActiveSession={hasActiveSession} />

          {/* البحث الموحد (ظاهر دائماً) */}
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700/80 transition cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
            title="البحث الموحد في كل سجلات الورشة"
            aria-label="البحث الموحد"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline text-xs font-black">
              بحث موحد
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
