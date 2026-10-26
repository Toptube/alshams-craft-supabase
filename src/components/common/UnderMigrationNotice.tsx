import React from 'react';
import { RefreshCw, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

interface UnderMigrationNoticeProps {
  title?: string;
  description?: string;
  onGoBack?: () => void;
}

export const UnderMigrationNotice: React.FC<UnderMigrationNoticeProps> = ({
  title,
  description,
  onGoBack,
}) => {
  const { t: tr } = useTranslation();
  const displayTitle = title || tr('under_migration_title');
  const displayDescription = description || tr('under_migration_desc');

  return (
    <div className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-10 rounded-3xl bg-white dark:bg-stone-900 border border-amber-200/80 dark:border-stone-800 shadow-xl text-center relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
          <RefreshCw className="w-8 h-8 animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{tr('updating_cloud_infrastructure')}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100">
            {displayTitle}
          </h2>

          <p className="text-sm font-medium text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
            {displayDescription}
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 group"
            >
              <img
                src="/alshams_falcon_emblem.png"
                alt="الشاشة الرئيسية"
                className="w-5 h-5 object-contain group-hover:scale-110 transition-transform filter brightness-0 invert"
              />
              <span>{tr('home_screen') || 'الشاشة الرئيسية'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
