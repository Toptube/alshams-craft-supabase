import { MarketThemePresetId } from '../types/marketplaceBuilder';

export type StorefrontThemeId = MarketThemePresetId;

export type StorefrontHeroLayout =
  | 'editorial_split'
  | 'centered_maison'
  | 'botanical_airy'
  | 'gallery_magazine'
  | 'noir_spotlight'
  | 'swiss_minimal';

export interface StorefrontThemeSpec {
  id: StorefrontThemeId;
  nameAr: string;
  englishSignature: string;
  taglineAr: string;
  bestForAr: string;
  isDarkTheme: boolean;
  heroLayout: StorefrontHeroLayout;
  // Core 60-30-10 Palette (WCAG AA Verified)
  pageBg: string;
  surfaceBg: string;
  softBg: string;
  borderColor: string;
  inkColor: string;
  mutedColor: string;
  // Primary Action
  accentBg: string;
  accentHover: string;
  accentInk: string;
  accentText: string;
  // Hero Surface
  heroBg: string;
  heroBorder: string;
  heroSubtleTint: string;
  // Price & Highlight
  priceColor: string;
  badgeBg: string;
  badgeInk: string;
  // Structural Geometry Classes (distinct visual architecture per theme)
  cardRadiusClass: string;
  buttonRadiusClass: string;
  inputRadiusClass: string;
  cardShadowClass: string;
  heroAlignClass: string;
  titleWeightClass: string;
  imageFrameClass: string;
}

export const WORLD_STOREFRONT_THEMES: Record<StorefrontThemeId, StorefrontThemeSpec> = {
  shams_sand: {
    id: 'shams_sand',
    nameAr: 'الأتيليه الدافئ',
    englishSignature: 'Atelier Editorial',
    taglineAr: 'رملي دافئ ونحاسي فني مستوحى من الأتيليهات الحرفية العالمية',
    bestForAr: 'المكرمية، الخزف، السجاد اليدوي، والديكور التراثي',
    isDarkTheme: false,
    heroLayout: 'editorial_split',
    pageBg: '#F4EFE6',
    surfaceBg: '#FBF8F2',
    softBg: '#ECE5D8',
    borderColor: '#D8CEBC',
    inkColor: '#161310',
    mutedColor: '#5B5349',
    accentBg: '#C2410C',
    accentHover: '#9A3412',
    accentInk: '#FFFFFF',
    accentText: '#B43E0C',
    heroBg: '#FBF8F2',
    heroBorder: '#D8CEBC',
    heroSubtleTint: 'rgba(194, 65, 12, 0.06)',
    priceColor: '#161310',
    badgeBg: '#161310',
    badgeInk: '#FBBF24',
    cardRadiusClass: 'rounded-2xl',
    buttonRadiusClass: 'rounded-xl',
    inputRadiusClass: 'rounded-xl',
    cardShadowClass: 'shadow-xs hover:shadow-md',
    heroAlignClass: 'text-right items-start',
    titleWeightClass: 'font-black tracking-tight',
    imageFrameClass: 'aspect-[4/3]',
  },

  royal_navy: {
    id: 'royal_navy',
    nameAr: 'القصر الكحلي والذهب',
    englishSignature: 'Maison Royale',
    taglineAr: 'فخامة كلاسيكية بعمق كحلي ملكي ولمسات ذهب عتيق راقية',
    bestForAr: 'المجوهرات، الهدايا الفاخرة، النحاسيات، والموردين الكبار',
    isDarkTheme: true,
    heroLayout: 'centered_maison',
    pageBg: '#080E1E',
    surfaceBg: '#101A33',
    softBg: '#172547',
    borderColor: '#293D6B',
    inkColor: '#F8F4EC',
    mutedColor: '#B5C2DC',
    accentBg: '#D4AF37',
    accentHover: '#E5C158',
    accentInk: '#0A1124',
    accentText: '#E8C967',
    heroBg: '#0E1730',
    heroBorder: '#C9A227',
    heroSubtleTint: 'rgba(212, 175, 55, 0.09)',
    priceColor: '#F3D77A',
    badgeBg: '#D4AF37',
    badgeInk: '#080E1E',
    cardRadiusClass: 'rounded-xl',
    buttonRadiusClass: 'rounded-lg',
    inputRadiusClass: 'rounded-lg',
    cardShadowClass: 'shadow-md hover:shadow-xl',
    heroAlignClass: 'text-center items-center',
    titleWeightClass: 'font-black tracking-wide',
    imageFrameClass: 'aspect-[4/3]',
  },

  emerald_linen: {
    id: 'emerald_linen',
    nameAr: 'الحديقة النباتية',
    englishSignature: 'Botanical Craft',
    taglineAr: 'كتان طبيعي مريح مع أخضر زمردي نقي بروح المتاجر الإسكندنافية',
    bestForAr: 'الأخشاب، الشموع، الصابون الطبيعي، والمنسوجات العضوية',
    isDarkTheme: false,
    heroLayout: 'botanical_airy',
    pageBg: '#EEF4F0',
    surfaceBg: '#FFFFFF',
    softBg: '#E1ECE5',
    borderColor: '#C5DACD',
    inkColor: '#0C2119',
    mutedColor: '#426154',
    accentBg: '#065F46',
    accentHover: '#047857',
    accentInk: '#FFFFFF',
    accentText: '#065F46',
    heroBg: '#F7FBF8',
    heroBorder: '#B9D3C4',
    heroSubtleTint: 'rgba(6, 95, 70, 0.06)',
    priceColor: '#065F46',
    badgeBg: '#065F46',
    badgeInk: '#ECFDF5',
    cardRadiusClass: 'rounded-3xl',
    buttonRadiusClass: 'rounded-2xl',
    inputRadiusClass: 'rounded-2xl',
    cardShadowClass: 'shadow-xs hover:shadow-lg',
    heroAlignClass: 'text-right items-start',
    titleWeightClass: 'font-extrabold',
    imageFrameClass: 'aspect-[4/3]',
  },

  rose_clay: {
    id: 'rose_clay',
    nameAr: 'الجاليري الأندلسي',
    englishSignature: 'Terracotta Gallery',
    taglineAr: 'أسلوب مجلات التصميم العالمية بحواف معمارية حادة وألوان طينية دافئة',
    bestForAr: 'الأزياء، الجلود الطبيعية، الحقائب، وديكور المنزل العصري',
    isDarkTheme: false,
    heroLayout: 'gallery_magazine',
    pageBg: '#F6ECE6',
    surfaceBg: '#FCF8F5',
    softBg: '#ECDDD5',
    borderColor: '#DBC4B8',
    inkColor: '#26140F',
    mutedColor: '#6D4C42',
    accentBg: '#9A3412',
    accentHover: '#7C2D12',
    accentInk: '#FFFFFF',
    accentText: '#9A3412',
    heroBg: '#FCF8F5',
    heroBorder: '#C9A798',
    heroSubtleTint: 'rgba(154, 52, 18, 0.06)',
    priceColor: '#26140F',
    badgeBg: '#26140F',
    badgeInk: '#FDE6D8',
    cardRadiusClass: 'rounded-md',
    buttonRadiusClass: 'rounded-none',
    inputRadiusClass: 'rounded-none',
    cardShadowClass: 'shadow-none hover:shadow-md',
    heroAlignClass: 'text-right items-start',
    titleWeightClass: 'font-black tracking-tight',
    imageFrameClass: 'aspect-[4/5]',
  },

  midnight_gallery: {
    id: 'midnight_gallery',
    nameAr: 'الجاليري الأسود الفاخر',
    englishSignature: 'Noir Studio',
    taglineAr: 'خلفية سوداء متحفية تسلط الضوء بالكامل على تفاصيل وألوان منتجاتك',
    bestForAr: 'الريزن، اللوحات الفنية، التحف، الإضاءة، والمنتجات عالية القيمة',
    isDarkTheme: true,
    heroLayout: 'noir_spotlight',
    pageBg: '#09090B',
    surfaceBg: '#131317',
    softBg: '#1C1C22',
    borderColor: '#2B2B33',
    inkColor: '#FAFAFA',
    mutedColor: '#A1A1AA',
    accentBg: '#F59E0B',
    accentHover: '#D97706',
    accentInk: '#09090B',
    accentText: '#FBBF24',
    heroBg: '#111115',
    heroBorder: '#32323C',
    heroSubtleTint: 'rgba(245, 158, 11, 0.08)',
    priceColor: '#FAFAFA',
    badgeBg: '#F59E0B',
    badgeInk: '#09090B',
    cardRadiusClass: 'rounded-lg',
    buttonRadiusClass: 'rounded-lg',
    inputRadiusClass: 'rounded-lg',
    cardShadowClass: 'shadow-md hover:shadow-2xl',
    heroAlignClass: 'text-center items-center',
    titleWeightClass: 'font-black tracking-wide',
    imageFrameClass: 'aspect-[4/3]',
  },

  clean_alabaster: {
    id: 'clean_alabaster',
    nameAr: 'المينيمال السويسري',
    englishSignature: 'Swiss Minimal',
    taglineAr: 'بياض معماري ناصع وتباين أسود حاد بأسلوب المتاجر العالمية الحديثة',
    bestForAr: 'كل الحرف العصرية، الكتالوجات الكثيفة، وموردي الخامات',
    isDarkTheme: false,
    heroLayout: 'swiss_minimal',
    pageBg: '#FFFFFF',
    surfaceBg: '#F8F8FA',
    softBg: '#EFEFF2',
    borderColor: '#E2E2E7',
    inkColor: '#09090B',
    mutedColor: '#52525B',
    accentBg: '#09090B',
    accentHover: '#27272A',
    accentInk: '#FFFFFF',
    accentText: '#09090B',
    heroBg: '#FFFFFF',
    heroBorder: '#E2E2E7',
    heroSubtleTint: 'rgba(9, 9, 11, 0.03)',
    priceColor: '#09090B',
    badgeBg: '#09090B',
    badgeInk: '#FFFFFF',
    cardRadiusClass: 'rounded-2xl',
    buttonRadiusClass: 'rounded-xl',
    inputRadiusClass: 'rounded-xl',
    cardShadowClass: 'shadow-none hover:shadow-md',
    heroAlignClass: 'text-center items-center',
    titleWeightClass: 'font-black tracking-tight',
    imageFrameClass: 'aspect-[4/3]',
  },
};

export const WORLD_STOREFRONT_THEME_LIST: StorefrontThemeSpec[] = [
  WORLD_STOREFRONT_THEMES.shams_sand,
  WORLD_STOREFRONT_THEMES.royal_navy,
  WORLD_STOREFRONT_THEMES.emerald_linen,
  WORLD_STOREFRONT_THEMES.rose_clay,
  WORLD_STOREFRONT_THEMES.midnight_gallery,
  WORLD_STOREFRONT_THEMES.clean_alabaster,
];

const LEGACY_THEME_MAP: Record<string, StorefrontThemeId> = {
  warm_atelier: 'shams_sand',
  deep_navy: 'royal_navy',
  emerald_craft: 'emerald_linen',
  minimal_stone: 'clean_alabaster',
};

export function normalizeStorefrontThemeId(rawId?: string | null): StorefrontThemeId {
  if (!rawId) return 'shams_sand';
  if (rawId in WORLD_STOREFRONT_THEMES) return rawId as StorefrontThemeId;
  if (rawId in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[rawId];
  return 'shams_sand';
}

export function resolveStorefrontTheme(rawId?: string | null): StorefrontThemeSpec {
  return WORLD_STOREFRONT_THEMES[normalizeStorefrontThemeId(rawId)];
}
