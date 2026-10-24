import React from 'react';
import falconAvatarImg from '../../assets/falcon_mascot_ai.png';
import alshamsFalconEmblemImg from '../../assets/alshams_falcon_emblem.png';

export { falconAvatarImg, alshamsFalconEmblemImg };

/**
 * الأيقونة الرسمية لمنظومة الشمس كرافت - الصقر ومونوغرام SH المعتمد بخلفية شفافة
 */
export const AlShamsFalconEmblem: React.FC<{
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}> = ({ className = '', size = 'md' }) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  return (
    <img
      src={alshamsFalconEmblemImg}
      alt="شعار الشمس كرافت"
      className={`${sizeMap[size]} object-contain select-none shrink-0 drop-shadow-2xs ${className}`}
    />
  );
};

/**
 * Geometric Sun SVG Icon for AlShams Craft Platform (Preserved for compatibility)
 */
export const AlShamsSunIcon: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => {
  return (
    <img
      src={alshamsFalconEmblemImg}
      alt="أيقونة الشمس كرافت"
      className={`${className} object-contain`}
    />
  );
};

/**
 * OFFICIAL SYSTEM PLATFORM LOGO BANNER (الشمس كرافت / AlShams Craft)
 * Uses the official transparent falcon emblem + Cairo typography.
 */
export const AlShamsBrandLogo: React.FC<{
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}> = ({ className = '', size = 'md', showSubtitle = true }) => {
  const sizeMap = {
    sm: { icon: 'w-8 h-8', title: 'text-sm', sub: 'text-[8px]', gap: 'gap-2' },
    md: { icon: 'w-12 h-12', title: 'text-lg sm:text-xl', sub: 'text-[9px]', gap: 'gap-2.5' },
    lg: { icon: 'w-16 h-16', title: 'text-2xl', sub: 'text-[11px]', gap: 'gap-3' },
    xl: { icon: 'w-24 h-24', title: 'text-3xl sm:text-4xl', sub: 'text-[13px]', gap: 'gap-4' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center ${currentSize.gap} select-none ${className}`}>
      {/* Official Transparent Falcon Emblem */}
      <div className={`relative ${currentSize.icon} flex-shrink-0 flex items-center justify-center`}>
        <img
          src={alshamsFalconEmblemImg}
          alt="شعار الشمس كرافت الرسمي"
          className="w-full h-full object-contain filter drop-shadow-sm select-none"
        />
      </div>

      {/* Brand Name Calligraphy & Typography */}
      <div className="flex flex-col text-right">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-[800] ${currentSize.title} tracking-tight text-stone-900 dark:text-amber-300 font-sans`}>
            الشمس كرافت
          </span>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-mono">
            ERP
          </span>
        </div>
        {showSubtitle && (
          <span className={`${currentSize.sub} font-mono tracking-widest uppercase text-stone-500 dark:text-stone-400 mt-1`}>
            ALSHAMS CRAFT
          </span>
        )}
      </div>
    </div>
  );
};

// EXCLUSIVE FALCON MASCOT AVATAR FOR "صقر الشمساوية AI"
export const FalconMascotAvatar: React.FC<{
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  statusDot?: boolean;
  fit?: 'contain' | 'cover' | 'top';
}> = ({ className = '', size = 'md', statusDot = true, fit = 'top' }) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
  };

  const fitClass =
    fit === 'contain'
      ? 'object-contain scale-95'
      : fit === 'top'
      ? 'object-cover object-top scale-110'
      : 'object-cover';

  return (
    <div className={`relative ${sizeMap[size]} flex-shrink-0 ${className}`}>
      <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-stone-900 via-amber-950/90 to-stone-800 p-0.5 shadow-md border border-amber-500/40 dark:border-amber-400/60 dark:shadow-[0_0_12px_rgba(245,158,11,0.25)] overflow-hidden flex items-center justify-center transition-all duration-200">
        <img
          src={falconAvatarImg}
          alt="صقر الشمساوية AI"
          className={`w-full h-full ${fitClass} rounded-2xl select-none filter drop-shadow-sm`}
        />
      </div>

      {statusDot && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-stone-900"></span>
        </span>
      )}
    </div>
  );
};

// DEDICATED ARTISAN PROFILE PICTURE COMPONENT
export const ArtisanAvatar: React.FC<{
  logoUrl?: string;
  artistName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ logoUrl, artistName, size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`لوجو ${artistName}`}
        className={`${sizeMap[size]} rounded-2xl object-contain bg-stone-100 dark:bg-stone-800 p-0.5 shadow-sm border border-stone-200 dark:border-stone-700 ${className}`}
      />
    );
  }

  // Fallback initial
  const initial = artistName ? artistName.trim().charAt(0) : 'ف';

  return (
    <div
      className={`${sizeMap[size]} rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex items-center justify-center font-black ${className}`}
    >
      <span>{initial}</span>
    </div>
  );
};
