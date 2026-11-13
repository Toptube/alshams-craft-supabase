// Authentic Mascot Characters (100% Transparent Full-Body Characters)
export const falconAvatarImg = '/falcon_mascot_transparent.png';
export const shamousaAvatarImg = '/shamousa_mascot_transparent.png';
export const alshamsFalconArtisanImg = '/falcon_mascot_transparent.png';

// Brand & App Icons (The SH Monogram Falcon Icon)
export const brandIconLight = '/brand_icon_light.png';
export const brandIconDark = '/brand_icon_dark.png';
export const alshamsFalconEmblemImg = brandIconLight;

// Platform Calligraphy Logos (100% Transparent Light & Dark)
export const brandLogoLight = '/assets/aistudio/platform_logo_light_2f80dd76.png';
export const brandLogoDark = '/assets/aistudio/platform_logo_dark_26194bd4.png';
export const alshamsOfficialBannerLogo = brandLogoLight;

// Search / Thinking Toggle Icons (100% Transparent PNGs)
export const falconSearchIconImg = '/assets/aistudio/falcon_search.png_8ffa01ac.jpg';
export const shamousaSearchIconImg = '/assets/aistudio/shamosa_search.png_9e3b8129.jpg';

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
}> = ({ className = '', size = 'md', isDark, alt = 'أيقونة صقر الشمساوية' }) => {
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

export const AlShamsBrandLogo: React.FC<{
  className?: string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  size?: string;
  showSubtitle?: boolean;
  isDark?: boolean;
  alt?: string;
}> = ({ className = '', maxWidth = 180, maxHeight, size, isDark, alt = 'منظومة الشمساوية' }) => {
  let effectiveMaxWidth = maxWidth;
  if (size === 'sm') effectiveMaxWidth = 135;
  else if (size === 'md') effectiveMaxWidth = 175;
  else if (size === 'lg') effectiveMaxWidth = 240;

  const maxWStyle = typeof effectiveMaxWidth === 'number' ? `${effectiveMaxWidth}px` : effectiveMaxWidth;
  const maxHStyle = maxHeight !== undefined ? (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight) : undefined;
  const sizeClasses = maxHStyle ? 'w-auto h-auto max-w-full' : 'w-full max-w-full h-auto';

  if (isDark === true) {
    return (
      <img
        src={brandLogoDark}
        alt={alt}
        style={{ maxWidth: maxWStyle, ...(maxHStyle ? { maxHeight: maxHStyle } : {}) }}
        className={`${sizeClasses} bg-transparent object-contain select-none shrink-0 ${className}`}
      />
    );
  }

  if (isDark === false) {
    return (
      <img
        src={brandLogoLight}
        alt={alt}
        style={{ maxWidth: maxWStyle, ...(maxHStyle ? { maxHeight: maxHStyle } : {}) }}
        className={`${sizeClasses} bg-transparent object-contain select-none shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ maxWidth: maxWStyle }}
      className={`relative ${maxHStyle ? 'w-auto' : 'w-full'} bg-transparent inline-flex items-center justify-center select-none shrink-0 ${className}`}
    >
      <img
        src={brandLogoLight}
        alt={alt}
        style={maxHStyle ? { maxHeight: maxHStyle } : undefined}
        className={`${sizeClasses} bg-transparent object-contain dark:hidden select-none`}
      />
      <img
        src={brandLogoDark}
        alt={alt}
        style={maxHStyle ? { maxHeight: maxHStyle } : undefined}
        className={`${sizeClasses} bg-transparent object-contain hidden dark:block select-none`}
      />
    </div>
  );
};

// Aliases for platform logo
export const AlShamsPlatformLogo = AlShamsBrandLogo;
export const PlatformLogo = AlShamsBrandLogo;

// EXCLUSIVE FALCON MASCOT FOR "صقر الشمساوية AI" (Seamless Transparent PNG)
export const FalconMascotAvatar: React.FC<{
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  statusDot?: boolean;
  fit?: 'contain' | 'cover' | 'top';
}> = ({ className = '', size = 'md', statusDot = true }) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
  };

  return (
    <div className={`relative ${sizeMap[size]} flex-shrink-0 inline-flex items-center justify-center ${className}`}>
      <img
        src="/falcon_mascot_transparent.png"
        alt="صقر الشمساوية AI"
        className="w-full h-full object-contain select-none filter drop-shadow-md"
      />
      {statusDot && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-stone-900"></span>
        </span>
      )}
    </div>
  );
};

// EXCLUSIVE SHAMOUSA MASCOT FOR "شموسة — مديرة أعمال الورشة" (Seamless Transparent PNG)
export const ShamousaMascotAvatar: React.FC<{
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  statusDot?: boolean;
  fit?: 'contain' | 'cover' | 'top';
}> = ({ className = '', size = 'md', statusDot = true }) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
  };

  return (
    <div className={`relative ${sizeMap[size]} flex-shrink-0 inline-flex items-center justify-center ${className}`}>
      <img
        src="/shamousa_mascot_transparent.png"
        alt="شموسة مديرة أعمال الورشة"
        className="w-full h-full object-contain select-none filter drop-shadow-md"
      />
      {statusDot && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-stone-900"></span>
        </span>
      )}
    </div>
  );
};

// Full-length seamless character components
export const FalconMascotFull: React.FC<{ className?: string; height?: number | string; alt?: string }> = ({
  className = '',
  height = 180,
  alt = 'صقر الشمساوية',
}) => (
  <img
    src="/falcon_mascot_transparent.png"
    alt={alt}
    style={{ height }}
    className={`object-contain select-none filter drop-shadow-xl inline-block ${className}`}
  />
);

export const ShamousaMascotFull: React.FC<{ className?: string; height?: number | string; alt?: string }> = ({
  className = '',
  height = 180,
  alt = 'شَمّوسة',
}) => (
  <img
    src="/shamousa_mascot_transparent.png"
    alt={alt}
    style={{ height }}
    className={`object-contain select-none filter drop-shadow-xl inline-block ${className}`}
  />
);

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
