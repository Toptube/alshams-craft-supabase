import React from 'react';
import falconAvatarImg from '../../assets/falcon_mascot_ai.png';
import shamousaAvatarImg from '../../assets/shamousa_mascot.png';
import brandIconLight from '../../assets/brand_icon_light.png';
import brandIconDark from '../../assets/brand_icon_dark.png';
import brandLogoLight from '../../assets/brand_logo_light.png';
import brandLogoDark from '../../assets/brand_logo_dark.png';

export {
  falconAvatarImg,
  shamousaAvatarImg,
  brandIconLight,
  brandIconDark,
  brandLogoLight,
  brandLogoDark,
};

// Aliases for backward compatibility
export const alshamsFalconEmblemImg = brandIconLight;
export const alshamsOfficialBannerLogo = brandLogoLight;
export const alshamsFalconArtisanImg = brandIconLight;

export const AlShamsSunIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 20 }) => (
  <span className={`inline-flex items-center justify-center select-none ${className}`} style={{ width: size, height: size, fontSize: size * 0.8 }}>
    ☀️
  </span>
);

/**
 * 1. الأيقونة المربعة الرسمية (Al-Shams Falcon Icon)
 * تبديل تلقائي فوري وسلس بين الوضع الفاتح والوضع الليلي:
 * - Light Mode: الأيقونة الكلاسيكية بالأزرق الداكن ومونوغرام SH الذهبي (أعلى وضوح وتباين على الأبيض).
 * - Dark Mode: الأيقونة المتوهجة بالنيون الأزرق والمونوغرام الذهبي المشع (فخامة فائقة على الخلفيات الداكنة).
 */
export const AlShamsBrandIcon: React.FC<{
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  isDark?: boolean;
  alt?: string;
}> = ({ className = '', size = 'md', isDark, alt = 'أيقونة صقر الشمس كرافت' }) => {
  const sizeMap: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const isNumeric = typeof size === 'number';
  const dim = isNumeric ? '' : (sizeMap[size] || sizeMap.md);
  const inlineStyle = isNumeric ? { width: `${size}px`, height: `${size}px` } : undefined;

  if (isDark === true) {
    return (
      <img
        src={brandIconDark}
        alt={alt}
        style={inlineStyle}
        className={`${dim} object-contain select-none shrink-0 drop-shadow-[0_0_12px_rgba(56,189,248,0.4)] ${className}`}
      />
    );
  }

  if (isDark === false) {
    return (
      <img
        src={brandIconLight}
        alt={alt}
        style={inlineStyle}
        className={`${dim} object-contain select-none shrink-0 drop-shadow-xs ${className}`}
      />
    );
  }

  // Automatic CSS-based responsive theme switching (zero JS lag & zero flash)
  return (
    <div
      style={inlineStyle}
      className={`relative ${dim} select-none shrink-0 inline-flex items-center justify-center ${className}`}
    >
      {/* Light Mode Icon */}
      <img
        src={brandIconLight}
        alt={alt}
        className="w-full h-full object-contain dark:hidden select-none drop-shadow-xs"
      />
      {/* Dark / Night Mode Icon with Neon Glow */}
      <img
        src={brandIconDark}
        alt={alt}
        className="w-full h-full object-contain hidden dark:block select-none drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]"
      />
    </div>
  );
};

// Backward-compatible alias for AlShamsFalconEmblem
export const AlShamsFalconEmblem = AlShamsBrandIcon;

/**
 * 2. اللوجو النصي الكامل لمنظومة الشمس كرافت (Al-Shams Craft Brand Logo)
 * - حجم متناسق ومحدد بدقة لا يتجاوز 180px عرضاً للحفاظ على فخامة المظهر بدون أي تشويه.
 * - تبديل تلقائي وسلس حسب السمة:
 *   * في الوضع الفاتح: خط عربي ديواني كحلي غني مع شمس ذهبية (أعلى تباين وأناقة).
 *   * في الوضع الداكن: خط متوهج بالسيان والأزرق الملكي مع تفاصيل مضيئة وخلفية متناسقة.
 */
export const AlShamsBrandLogo: React.FC<{
  className?: string;
  maxWidth?: number | string;
  size?: string;
  showSubtitle?: boolean;
  isDark?: boolean;
  alt?: string;
}> = ({ className = '', maxWidth = 180, size, showSubtitle: _showSubtitle, isDark, alt = 'لوجو الشمس كرافت الرسمي' }) => {
  let effectiveMaxWidth = maxWidth;
  if (size === 'sm') effectiveMaxWidth = 120;
  else if (size === 'md') effectiveMaxWidth = 150;
  else if (size === 'lg') effectiveMaxWidth = 180;
  const maxWStyle = typeof effectiveMaxWidth === 'number' ? `${effectiveMaxWidth}px` : effectiveMaxWidth;

  if (isDark === true) {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        style={{ maxWidth: maxWStyle }}
      >
        <img
          src={brandLogoDark}
          alt={alt}
          className="w-full h-auto max-h-12 object-contain select-none filter drop-shadow-[0_0_14px_rgba(14,165,233,0.35)]"
        />
      </div>
    );
  }

  if (isDark === false) {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        style={{ maxWidth: maxWStyle }}
      >
        <img
          src={brandLogoLight}
          alt={alt}
          className="w-full h-auto max-h-12 object-contain select-none filter drop-shadow-2xs"
        />
      </div>
    );
  }

  // Automatic CSS-based responsive theme switching (max width 180px strictly enforced)
  return (
    <div
      className={`inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ maxWidth: maxWStyle }}
    >
      {/* Light Mode Logo */}
      <img
        src={brandLogoLight}
        alt={alt}
        className="w-full h-auto max-h-12 object-contain dark:hidden select-none filter drop-shadow-2xs"
      />
      {/* Dark / Night Mode Logo */}
      <img
        src={brandLogoDark}
        alt={alt}
        className="w-full h-auto max-h-12 object-contain hidden dark:block select-none filter drop-shadow-[0_0_14px_rgba(14,165,233,0.35)]"
      />
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

// EXCLUSIVE SHAMOUSA MASCOT AVATAR FOR "شموسة — مديرة أعمال الورشة"
export const ShamousaMascotAvatar: React.FC<{
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
      <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 p-0.5 shadow-md border border-amber-300/80 dark:border-amber-400/80 overflow-hidden flex items-center justify-center transition-all duration-200">
        <img
          src={shamousaAvatarImg}
          alt="شموسة مديرة أعمال الورشة"
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
