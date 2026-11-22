/**
 * 10 سمات معمارية عالمية لصفحة الهبوط الرئيسية (يتحكم بها السوبر أدمن بضغطة زر)
 * كل سمة تغيّر التصميم والهوية البصرية وتخطيط الهيرو والألوان بالكامل —
 * وعدد السمات يُحسب ديناميكياً من LANDING_THEMES_LIST.length.
 */

export type WorldLandingThemeId =
  | 'ivory_editorial'
  | 'obsidian_atelier'
  | 'emerald_maison'
  | 'midnight_saas'
  | 'swiss_architect'
  | 'sand_heritage'
  | 'royal_sapphire'
  | 'rose_terracotta'
  | 'nordic_slate'
  | 'kinetic_bento';

export type LandingHeroVariant =
  | 'editorial_split'
  | 'cinema_dark'
  | 'swiss_grid'
  | 'bento_showcase'
  | 'centered_monument';

export interface WorldLandingThemeSpec {
  id: WorldLandingThemeId;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  isDarkTheme: boolean;
  heroVariant: LandingHeroVariant;
  // Core 60-30-10 color palette
  pageBg: string;
  surfaceBg: string;
  softSurfaceBg: string;
  borderColor: string;
  inkColor: string;
  mutedColor: string;
  accentBg: string;
  accentHoverBg: string;
  accentInk: string;
  accentText: string;
  accentSoftBg: string;
  secondaryAccent: string;
  // Geometry & polish
  cardRadius: string;
  buttonRadius: string;
  cardShadow: string;
  heroGradient: string;
  swatchColors: [string, string, string];
}

export const WORLD_LANDING_THEMES: Record<WorldLandingThemeId, WorldLandingThemeSpec> = {
  ivory_editorial: {
    id: 'ivory_editorial',
    nameAr: 'المجلة العاجية العالمية',
    nameEn: 'Ivory Editorial',
    taglineAr: 'ورق عاجي راقٍ مع تباين كحلي وبرتقالي شمسي — أسلوب استوديوهات التصميم العالمية.',
    isDarkTheme: false,
    heroVariant: 'editorial_split',
    pageBg: '#FAF8F3',
    surfaceBg: '#FFFFFF',
    softSurfaceBg: '#F3EFE6',
    borderColor: '#E5DEC9',
    inkColor: '#0F172A',
    mutedColor: '#475569',
    accentBg: '#EA580C',
    accentHoverBg: '#C2410C',
    accentInk: '#FFFFFF',
    accentText: '#C2410C',
    accentSoftBg: 'rgba(234, 88, 12, 0.10)',
    secondaryAccent: '#0F172A',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-xs',
    heroGradient: 'radial-gradient(circle at 18% 20%, rgba(234, 88, 12, 0.08), transparent 48%)',
    swatchColors: ['#FAF8F3', '#0F172A', '#EA580C'],
  },
  obsidian_atelier: {
    id: 'obsidian_atelier',
    nameAr: 'الأوبسيديان التنفيذي الذهبي',
    nameEn: 'Obsidian Atelier',
    taglineAr: 'فخامة ليلية عميقة باللون الفحمي ولمسات ذهبية نحاسية تبرز المنتجات والأرقام.',
    isDarkTheme: true,
    heroVariant: 'cinema_dark',
    pageBg: '#070B14',
    surfaceBg: '#0E1526',
    softSurfaceBg: '#152038',
    borderColor: '#233252',
    inkColor: '#F8FAFC',
    mutedColor: '#94A3B8',
    accentBg: '#F59E0B',
    accentHoverBg: '#D97706',
    accentInk: '#070B14',
    accentText: '#FBBF24',
    accentSoftBg: 'rgba(245, 158, 11, 0.14)',
    secondaryAccent: '#38BDF8',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-lg shadow-black/30',
    heroGradient: 'radial-gradient(circle at 75% 15%, rgba(245, 158, 11, 0.16), transparent 45%)',
    swatchColors: ['#070B14', '#152038', '#F59E0B'],
  },
  emerald_maison: {
    id: 'emerald_maison',
    nameAr: 'دار الزمرد الحرفية',
    nameEn: 'Emerald Maison',
    taglineAr: 'أخضر زمردي ملكي مع عاجي وذهبي هادئ — طابع دور الحرف والأزياء الراقية.',
    isDarkTheme: false,
    heroVariant: 'centered_monument',
    pageBg: '#F4F7F5',
    surfaceBg: '#FFFFFF',
    softSurfaceBg: '#E7EFEA',
    borderColor: '#CBE0D3',
    inkColor: '#062B22',
    mutedColor: '#3B6257',
    accentBg: '#047857',
    accentHoverBg: '#065F46',
    accentInk: '#FFFFFF',
    accentText: '#047857',
    accentSoftBg: 'rgba(4, 120, 87, 0.10)',
    secondaryAccent: '#B45309',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-xs',
    heroGradient: 'radial-gradient(circle at 50% 0%, rgba(4, 120, 87, 0.10), transparent 55%)',
    swatchColors: ['#F4F7F5', '#062B22', '#047857'],
  },
  midnight_saas: {
    id: 'midnight_saas',
    nameAr: 'السحابة التقنية الليلية',
    nameEn: 'Linear Midnight',
    taglineAr: 'تصميم SaaS عالمي داكن مع لمسات سماوية كهربائية وشبكة هندسية دقيقة.',
    isDarkTheme: true,
    heroVariant: 'bento_showcase',
    pageBg: '#090D16',
    surfaceBg: '#111827',
    softSurfaceBg: '#192234',
    borderColor: '#25324B',
    inkColor: '#F1F5F9',
    mutedColor: '#94A3B8',
    accentBg: '#0EA5E9',
    accentHoverBg: '#0284C7',
    accentInk: '#06121E',
    accentText: '#38BDF8',
    accentSoftBg: 'rgba(14, 165, 233, 0.14)',
    secondaryAccent: '#818CF8',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-lg shadow-black/25',
    heroGradient: 'radial-gradient(circle at 25% 10%, rgba(56, 189, 248, 0.16), transparent 50%)',
    swatchColors: ['#090D16', '#192234', '#0EA5E9'],
  },
  swiss_architect: {
    id: 'swiss_architect',
    nameAr: 'المدرسة السويسرية المعمارية',
    nameEn: 'Swiss Grid',
    taglineAr: 'أبيض نقي وأسود حاد وأحمر سويسري مع خطوط هندسية نظيفة بدون أي زوائد.',
    isDarkTheme: false,
    heroVariant: 'swiss_grid',
    pageBg: '#FFFFFF',
    surfaceBg: '#FAFAFA',
    softSurfaceBg: '#F4F4F5',
    borderColor: '#E4E4E7',
    inkColor: '#09090B',
    mutedColor: '#52525B',
    accentBg: '#DC2626',
    accentHoverBg: '#B91C1C',
    accentInk: '#FFFFFF',
    accentText: '#DC2626',
    accentSoftBg: 'rgba(220, 38, 38, 0.08)',
    secondaryAccent: '#09090B',
    cardRadius: 'rounded-none',
    buttonRadius: 'rounded-none',
    cardShadow: 'shadow-none',
    heroGradient: 'linear-gradient(180deg, rgba(9,9,11,0.02) 0%, transparent 60%)',
    swatchColors: ['#FFFFFF', '#09090B', '#DC2626'],
  },
  sand_heritage: {
    id: 'sand_heritage',
    nameAr: 'تراث الرمال والنحاس المصري',
    nameEn: 'Shams Heritage',
    taglineAr: 'هوية الشمساوية الأصيلة: رملي دافئ، نحاس معتّق، وكحلي فرعوني متوازن.',
    isDarkTheme: false,
    heroVariant: 'editorial_split',
    pageBg: '#F4EFE6',
    surfaceBg: '#FCF9F2',
    softSurfaceBg: '#EAE1D2',
    borderColor: '#D6C8B0',
    inkColor: '#132040',
    mutedColor: '#5C5243',
    accentBg: '#B45309',
    accentHoverBg: '#92400E',
    accentInk: '#FFFFFF',
    accentText: '#B45309',
    accentSoftBg: 'rgba(180, 83, 9, 0.11)',
    secondaryAccent: '#132040',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-xs',
    heroGradient: 'radial-gradient(circle at 80% 18%, rgba(180, 83, 9, 0.12), transparent 52%)',
    swatchColors: ['#F4EFE6', '#132040', '#B45309'],
  },
  royal_sapphire: {
    id: 'royal_sapphire',
    nameAr: 'الياقوت الملكي والذهب',
    nameEn: 'Royal Sapphire',
    taglineAr: 'كحلي ياقوتي ملكي مع ذهبي ساطع وتباين فائق الوضوح للمؤسسات والورش الكبرى.',
    isDarkTheme: true,
    heroVariant: 'centered_monument',
    pageBg: '#0A132C',
    surfaceBg: '#111F42',
    softSurfaceBg: '#192B59',
    borderColor: '#2A4078',
    inkColor: '#F8FAFC',
    mutedColor: '#B3C2E0',
    accentBg: '#FBBF24',
    accentHoverBg: '#F59E0B',
    accentInk: '#0A132C',
    accentText: '#FBBF24',
    accentSoftBg: 'rgba(251, 191, 36, 0.14)',
    secondaryAccent: '#60A5FA',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-lg shadow-black/30',
    heroGradient: 'radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.14), transparent 55%)',
    swatchColors: ['#0A132C', '#192B59', '#FBBF24'],
  },
  rose_terracotta: {
    id: 'rose_terracotta',
    nameAr: 'أتيليه الصلصال والورد',
    nameEn: 'Terracotta Atelier',
    taglineAr: 'طابع فني دافئ بلون الصلصال القرمزي وأبيض وردي ناعم مثالي للحرف اليدوية.',
    isDarkTheme: false,
    heroVariant: 'editorial_split',
    pageBg: '#FDF8F6',
    surfaceBg: '#FFFFFF',
    softSurfaceBg: '#F7EBE6',
    borderColor: '#EBD3CA',
    inkColor: '#2A1215',
    mutedColor: '#754D52',
    accentBg: '#9F1239',
    accentHoverBg: '#881337',
    accentInk: '#FFFFFF',
    accentText: '#9F1239',
    accentSoftBg: 'rgba(159, 18, 57, 0.10)',
    secondaryAccent: '#B45309',
    cardRadius: 'rounded-3xl',
    buttonRadius: 'rounded-2xl',
    cardShadow: 'shadow-xs',
    heroGradient: 'radial-gradient(circle at 20% 25%, rgba(159, 18, 57, 0.09), transparent 50%)',
    swatchColors: ['#FDF8F6', '#2A1215', '#9F1239'],
  },
  nordic_slate: {
    id: 'nordic_slate',
    nameAr: 'الأردواز الاسكندنافي الهادئ',
    nameEn: 'Nordic Slate',
    taglineAr: 'صفاء بصري فائق على رمادي بارد ناعم وأردواز داكن مع أخضر ثقة.',
    isDarkTheme: false,
    heroVariant: 'bento_showcase',
    pageBg: '#F8FAFC',
    surfaceBg: '#FFFFFF',
    softSurfaceBg: '#F1F5F9',
    borderColor: '#E2E8F0',
    inkColor: '#0F172A',
    mutedColor: '#475569',
    accentBg: '#059669',
    accentHoverBg: '#047857',
    accentInk: '#FFFFFF',
    accentText: '#047857',
    accentSoftBg: 'rgba(5, 150, 105, 0.10)',
    secondaryAccent: '#0284C7',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-xs',
    heroGradient: 'radial-gradient(circle at 80% 15%, rgba(5, 150, 105, 0.08), transparent 45%)',
    swatchColors: ['#F8FAFC', '#0F172A', '#059669'],
  },
  kinetic_bento: {
    id: 'kinetic_bento',
    nameAr: 'بينتو الحداثة الجريئة',
    nameEn: 'Modern Bento',
    taglineAr: 'تصميم بينتو عصري جريء بحدود معمارية واضحة ولون شمسي نابض بالطاقة.',
    isDarkTheme: false,
    heroVariant: 'bento_showcase',
    pageBg: '#FFFDF7',
    surfaceBg: '#FFFFFF',
    softSurfaceBg: '#FEF7E0',
    borderColor: '#18181B',
    inkColor: '#18181B',
    mutedColor: '#52525B',
    accentBg: '#18181B',
    accentHoverBg: '#27272A',
    accentInk: '#FACC15',
    accentText: '#B45309',
    accentSoftBg: 'rgba(250, 204, 21, 0.25)',
    secondaryAccent: '#EA580C',
    cardRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardShadow: 'shadow-[4px_4px_0px_#18181B]',
    heroGradient: 'radial-gradient(circle at 20% 10%, rgba(250, 204, 21, 0.22), transparent 48%)',
    swatchColors: ['#FFFDF7', '#18181B', '#FACC15'],
  },
};

export const LANDING_THEMES_LIST: WorldLandingThemeSpec[] = [
  WORLD_LANDING_THEMES.ivory_editorial,
  WORLD_LANDING_THEMES.obsidian_atelier,
  WORLD_LANDING_THEMES.emerald_maison,
  WORLD_LANDING_THEMES.midnight_saas,
  WORLD_LANDING_THEMES.swiss_architect,
  WORLD_LANDING_THEMES.sand_heritage,
  WORLD_LANDING_THEMES.royal_sapphire,
  WORLD_LANDING_THEMES.rose_terracotta,
  WORLD_LANDING_THEMES.nordic_slate,
  WORLD_LANDING_THEMES.kinetic_bento,
];

const LEGACY_PRESET_MAP: Record<string, WorldLandingThemeId> = {
  editorial_craft: 'ivory_editorial',
  executive_obsidian: 'obsidian_atelier',
  gallery_minimal: 'swiss_architect',
  conversion_split: 'sand_heritage',
};

export function resolveWorldLandingTheme(
  rawPreset?: string | null,
  forceDarkMode?: boolean
): WorldLandingThemeSpec {
  const key = (rawPreset || '').trim();
  const mappedId: WorldLandingThemeId =
    (key in WORLD_LANDING_THEMES ? (key as WorldLandingThemeId) : LEGACY_PRESET_MAP[key]) ||
    'ivory_editorial';

  const base = WORLD_LANDING_THEMES[mappedId];
  // لو السمة نهارية والزائر فعّل الوضع الليلي يدوياً، نمنحه نسخة ليلية متناسقة عالية التباين
  if (forceDarkMode && !base.isDarkTheme) {
    return {
      ...base,
      isDarkTheme: true,
      pageBg: '#070B14',
      surfaceBg: '#0E1628',
      softSurfaceBg: '#16223C',
      borderColor: '#24355B',
      inkColor: '#F8FAFC',
      mutedColor: '#A3B3CE',
      accentText: '#FBBF24',
      cardShadow: 'shadow-lg shadow-black/25',
    };
  }
  return base;
}
