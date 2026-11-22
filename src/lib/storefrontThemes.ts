import { MarketThemePresetId } from '../types/marketplaceBuilder';

export type StorefrontThemeId = MarketThemePresetId;

export type StorefrontHeroLayout =
  | 'editorial_split'
  | 'centered_maison'
  | 'botanical_airy'
  | 'gallery_magazine'
  | 'noir_spotlight'
  | 'swiss_minimal'
  | 'arch_crest'
  | 'bento_mosaic'
  | 'cinema_carousel'
  | 'pop_kinetic';

export type StorefrontCardLayout =
  | 'classic'
  | 'arch_dome'
  | 'bento_featured'
  | 'horizontal_split'
  | 'polaroid_pop'
  | 'editorial_tall';

export type StorefrontCategoryLayout =
  | 'buttons'
  | 'circular_medallions'
  | 'floating_glass'
  | 'brutalist_tabs';

export interface StorefrontThemeSpec {
  id: StorefrontThemeId;
  nameAr: string;
  englishSignature: string;
  architectureTagAr: string;
  taglineAr: string;
  bestForAr: string;
  isDarkTheme: boolean;
  heroLayout: StorefrontHeroLayout;
  cardLayout: StorefrontCardLayout;
  categoryLayout: StorefrontCategoryLayout;
  showKineticTicker?: boolean;
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
  // === 4 NEW FLAGSHIP ARCHITECTURAL LAYOUT ENGINES (FIRST FOR MAXIMUM VISIBILITY) ===
  arch_boutique: {
    id: 'arch_boutique',
    nameAr: 'أقواس البوتيك الملكي',
    englishSignature: 'Arch & Medallion Boutique',
    architectureTagAr: 'إطارات مقوّسة + أيقونات دائرية',
    taglineAr: 'صور منتجات داخل أقواس معمارية أنيقة وتصنيفات دائرية بروح البوتيكات الباريسية والعربية الفاخرة',
    bestForAr: 'الديكور اليدوي، الخزف، العطور، الهدايا، والمكرمية الراقية',
    isDarkTheme: false,
    heroLayout: 'arch_crest',
    cardLayout: 'arch_dome',
    categoryLayout: 'circular_medallions',
    pageBg: '#FAF6F0',
    surfaceBg: '#FFFFFF',
    softBg: '#F1E9DD',
    borderColor: '#DFD2C0',
    inkColor: '#2A2118',
    mutedColor: '#6F5E4C',
    accentBg: '#8B5E34',
    accentHover: '#6E4826',
    accentInk: '#FFFFFF',
    accentText: '#8B5E34',
    heroBg: '#F5EDE2',
    heroBorder: '#D5C3AA',
    heroSubtleTint: 'rgba(139, 94, 52, 0.08)',
    priceColor: '#6E4826',
    badgeBg: '#2A2118',
    badgeInk: '#F5E6D3',
    cardRadiusClass: 'rounded-t-[110px] rounded-b-3xl',
    buttonRadiusClass: 'rounded-full',
    inputRadiusClass: 'rounded-full',
    cardShadowClass: 'shadow-sm hover:shadow-xl',
    heroAlignClass: 'text-center items-center',
    titleWeightClass: 'font-black tracking-tight',
    imageFrameClass: 'aspect-[4/5]',
  } as StorefrontThemeSpec,

  bento_studio: {
    id: 'bento_studio',
    nameAr: 'بنتو التفاعلي الحديث',
    englishSignature: 'Interactive Bento Studio',
    architectureTagAr: 'شبكة بنتو + بطاقة رئيسية عريضة',
    taglineAr: 'تخطيط بنتو عالمي يقسم الواجهة لبطاقات ذكية تفاعلية مع إبراز أول منتج في عرض بانورامي واسع',
    bestForAr: 'البراندات العصرية، الموردين، الإلكترونيات الحرفية، والورش الحديثة',
    isDarkTheme: false,
    heroLayout: 'bento_mosaic',
    cardLayout: 'bento_featured',
    categoryLayout: 'floating_glass',
    pageBg: '#F1F5F9',
    surfaceBg: '#FFFFFF',
    softBg: '#E6EEF8',
    borderColor: '#CBD5E1',
    inkColor: '#0F172A',
    mutedColor: '#475569',
    accentBg: '#2563EB',
    accentHover: '#1D4ED8',
    accentInk: '#FFFFFF',
    accentText: '#1D4ED8',
    heroBg: '#F1F5F9',
    heroBorder: '#CBD5E1',
    heroSubtleTint: 'rgba(37, 99, 235, 0.07)',
    priceColor: '#0F172A',
    badgeBg: '#0F172A',
    badgeInk: '#FFFFFF',
    cardRadiusClass: 'rounded-3xl',
    buttonRadiusClass: 'rounded-2xl',
    inputRadiusClass: 'rounded-2xl',
    cardShadowClass: 'shadow-sm hover:shadow-xl',
    heroAlignClass: 'text-right items-start',
    titleWeightClass: 'font-black tracking-tight',
    imageFrameClass: 'aspect-[4/3]',
  },

  cinema_lookbook: {
    id: 'cinema_lookbook',
    nameAr: 'لوك بوك العرض الجانبي',
    englishSignature: 'Cinematic Side-Lookbook',
    architectureTagAr: 'شريط عرض أفقي + بطاقات جانبية',
    taglineAr: 'معرض سينمائي داكن يبدأ بشريط تقليب أفقي لأبرز القطع، وتحته بطاقات جانبية (صورة على اليمين والتفاصيل على اليسار)',
    bestForAr: 'الجلود، المجوهرات، الريزن، التحف الفاخرة، والأزياء اليدوية',
    isDarkTheme: true,
    heroLayout: 'cinema_carousel',
    cardLayout: 'horizontal_split',
    categoryLayout: 'floating_glass',
    pageBg: '#14100D',
    surfaceBg: '#1F1814',
    softBg: '#2B211B',
    borderColor: '#433329',
    inkColor: '#FAF3EB',
    mutedColor: '#C6B3A4',
    accentBg: '#E09F3E',
    accentHover: '#C8892B',
    accentInk: '#14100D',
    accentText: '#F0B85A',
    heroBg: '#191310',
    heroBorder: '#433329',
    heroSubtleTint: 'rgba(224, 159, 62, 0.1)',
    priceColor: '#F4C46D',
    badgeBg: '#E09F3E',
    badgeInk: '#14100D',
    cardRadiusClass: 'rounded-2xl',
    buttonRadiusClass: 'rounded-xl',
    inputRadiusClass: 'rounded-xl',
    cardShadowClass: 'shadow-lg hover:shadow-2xl',
    heroAlignClass: 'text-right items-start',
    titleWeightClass: 'font-black tracking-wide',
    imageFrameClass: 'aspect-square',
  },

  pop_atelier: {
    id: 'pop_atelier',
    nameAr: 'ستوديو البولارويد الحر',
    englishSignature: 'Polaroid Kinetic Studio',
    architectureTagAr: 'إطارات بولارويد + شريط متحرك + ظلال هندسية',
    taglineAr: 'تصميم تفاعلي مبهج بظلال هندسية جريئة، إطارات بولارويد فنية للصور، وشريط إعلاني متحرك يخطف العين',
    bestForAr: 'الهدايا المبتكرة، الإكسسوارات، الكروشيه، الألعاب اليدوية، والملابس',
    isDarkTheme: false,
    heroLayout: 'pop_kinetic',
    cardLayout: 'polaroid_pop',
    categoryLayout: 'brutalist_tabs',
    showKineticTicker: true,
    pageBg: '#FFF8EB',
    surfaceBg: '#FFFFFF',
    softBg: '#FEEFD2',
    borderColor: '#18181B',
    inkColor: '#18181B',
    mutedColor: '#52525B',
    accentBg: '#E11D48',
    accentHover: '#BE123C',
    accentInk: '#FFFFFF',
    accentText: '#E11D48',
    heroBg: '#FFF0D4',
    heroBorder: '#18181B',
    heroSubtleTint: 'rgba(225, 29, 72, 0.08)',
    priceColor: '#18181B',
    badgeBg: '#FACC15',
    badgeInk: '#18181B',
    cardRadiusClass: 'rounded-2xl',
    buttonRadiusClass: 'rounded-full',
    inputRadiusClass: 'rounded-2xl',
    cardShadowClass: 'shadow-[4px_4px_0px_#18181B] hover:shadow-[2px_2px_0px_#18181B]',
    heroAlignClass: 'text-right items-start',
    titleWeightClass: 'font-black tracking-tight',
    imageFrameClass: 'aspect-[4/3]',
  },

  // === EXISTING 6 CLASSIC STOREFRONT THEMES (FULLY PRESERVED) ===
  shams_sand: {
    id: 'shams_sand',
    nameAr: 'الأتيليه الدافئ',
    englishSignature: 'Atelier Editorial',
    architectureTagAr: 'كلاسيكي متوازن',
    taglineAr: 'رملي دافئ ونحاسي فني مستوحى من الأتيليهات الحرفية العالمية',
    bestForAr: 'المكرمية، الخزف، السجاد اليدوي، والديكور التراثي',
    isDarkTheme: false,
    heroLayout: 'editorial_split',
    cardLayout: 'classic',
    categoryLayout: 'buttons',
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
    architectureTagAr: 'إطار ملكي متمركز',
    taglineAr: 'فخامة كلاسيكية بعمق كحلي ملكي ولمسات ذهب عتيق راقية',
    bestForAr: 'المجوهرات، الهدايا الفاخرة، النحاسيات، والموردين الكبار',
    isDarkTheme: true,
    heroLayout: 'centered_maison',
    cardLayout: 'classic',
    categoryLayout: 'buttons',
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
    architectureTagAr: 'انحناءات ناعمة هادئة',
    taglineAr: 'كتان طبيعي مريح مع أخضر زمردي نقي بروح المتاجر الإسكندنافية',
    bestForAr: 'الأخشاب، الشموع، الصابون الطبيعي، والمنسوجات العضوية',
    isDarkTheme: false,
    heroLayout: 'botanical_airy',
    cardLayout: 'classic',
    categoryLayout: 'circular_medallions',
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
    architectureTagAr: 'مجلة فنية بإطارات طويلة',
    taglineAr: 'أسلوب مجلات التصميم العالمية بحواف معمارية حادة وصور طولية فنية',
    bestForAr: 'الأزياء، الجلود الطبيعية، الحقائب، وديكور المنزل العصري',
    isDarkTheme: false,
    heroLayout: 'gallery_magazine',
    cardLayout: 'editorial_tall',
    categoryLayout: 'buttons',
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
    imageFrameClass: 'aspect-[3/4]',
  },

  midnight_gallery: {
    id: 'midnight_gallery',
    nameAr: 'الجاليري الأسود الفاخر',
    englishSignature: 'Noir Studio',
    architectureTagAr: 'إضاءة متحفية داكنة',
    taglineAr: 'خلفية سوداء متحفية تسلط الضوء بالكامل على تفاصيل وألوان منتجاتك',
    bestForAr: 'الريزن، اللوحات الفنية، التحف، الإضاءة، والمنتجات عالية القيمة',
    isDarkTheme: true,
    heroLayout: 'noir_spotlight',
    cardLayout: 'editorial_tall',
    categoryLayout: 'floating_glass',
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
    architectureTagAr: 'شبكة سويسرية نقية',
    taglineAr: 'بياض معماري ناصع وتباين أسود حاد بأسلوب المتاجر العالمية الحديثة',
    bestForAr: 'كل الحرف العصرية، الكتالوجات الكثيفة، وموردي الخامات',
    isDarkTheme: false,
    heroLayout: 'swiss_minimal',
    cardLayout: 'classic',
    categoryLayout: 'buttons',
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
  WORLD_STOREFRONT_THEMES.arch_boutique,
  WORLD_STOREFRONT_THEMES.bento_studio,
  WORLD_STOREFRONT_THEMES.cinema_lookbook,
  WORLD_STOREFRONT_THEMES.pop_atelier,
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
