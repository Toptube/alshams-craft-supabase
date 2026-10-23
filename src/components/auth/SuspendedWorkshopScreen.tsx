import React from 'react';
import { AlShamsBrandLogo } from '../brand/BrandAssets';
import { ShieldAlert, MessageCircle, LogOut } from 'lucide-react';

interface SuspendedWorkshopScreenProps {
  onLogout: () => void;
  brandName?: string;
  artistName?: string;
}

export const SuspendedWorkshopScreen: React.FC<SuspendedWorkshopScreenProps> = ({
  onLogout,
  brandName,
  artistName,
}) => {
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900/60 p-6 sm:p-8 space-y-6 text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center justify-center space-y-2">
          <AlShamsBrandLogo size="md" />
        </div>

        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-md">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-rose-700 dark:text-rose-400">
            حسابك موقوف مؤقتاً، تواصل مع الدعم
          </h2>
          {brandName && (
            <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
              {brandName} {artistName ? `• ${artistName}` : ''}
            </p>
          )}
          <p className="text-xs font-medium text-stone-600 dark:text-stone-400 leading-relaxed max-w-sm mx-auto">
            تم إيقاف حساب الورشة مؤقتاً بواسطة إدارة النظام. يرجى التواصل مع فريق الدعم الفني لحل المشكلة وإعادة تفعيل الحساب فوراً.
          </p>
        </div>

        {/* WhatsApp Contact Button */}
        <div className="space-y-3 pt-2">
          <a
            href="https://wa.me/201000996059"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white/20" />
            <span>التواصل عبر واتساب (201000996059+)</span>
          </a>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 rounded-2xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};
