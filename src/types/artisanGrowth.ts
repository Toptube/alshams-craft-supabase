import { AudienceRule } from './memberProfile';

export type BuiltinArtisanSkillLevel = 'beginner' | 'intermediate' | 'pro' | 'expert_trainer';
export type ArtisanSkillLevel = BuiltinArtisanSkillLevel | (string & {});

export type VideoOrientation = 'auto' | 'portrait' | 'landscape' | 'square';

export type LessonCardBlockId =
  | 'header_bar'
  | 'media'
  | 'title'
  | 'description'
  | 'footer_actions';

export interface LessonLayoutBlockConfig {
  id: LessonCardBlockId;
  label: string;
  visible: boolean;
}

export const DEFAULT_LESSON_LAYOUT_BLOCKS: LessonLayoutBlockConfig[] = [
  { id: 'header_bar', label: 'شريط الهوية وأزرار ملء الشاشة والمشاركة', visible: true },
  { id: 'media', label: 'الفيديو / المشغل المدمج (أعلى الشرح)', visible: true },
  { id: 'title', label: 'عنوان الشرح أو الدرس', visible: true },
  { id: 'description', label: 'الشرح والملخص المكتوب', visible: true },
  { id: 'footer_actions', label: 'شريط المشاركة في طبلية العيلة', visible: true },
];

export interface SkillLevelPermissions {
  canPublishLessons: boolean;
  canAccessProTools: boolean;
  canJoinGroupBuying: boolean;
  canExportToMarket: boolean;
  showVerifiedBadge: boolean;
}

export type SocialEmbedPlatform =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'vimeo'
  | 'dailymotion'
  | 'pinterest'
  | 'other';

export interface SkillLevelMeta {
  id: ArtisanSkillLevel;
  title: string;
  titleFemale?: string;
  shortLabel: string;
  shortLabelFemale?: string;
  tagline: string;
  perks: string[];
  accentClass: string;
  isSystem?: boolean;
  permissions?: SkillLevelPermissions;
}

export const ARTISAN_SKILL_LEVELS: Record<string, SkillLevelMeta> = {
  beginner: {
    id: 'beginner',
    title: 'مبتدئ / هاوي حرفة',
    titleFemale: 'مبتدئة / هاوية حرفة',
    shortLabel: 'مبتدئ',
    shortLabelFemale: 'مبتدئة',
    tagline: 'في بداية المشوار — تتعلم الخامات الموحدة والتسعير العادل بدون خسارة.',
    perks: [
      'وصول مجاني لدروس وشروحات الخبراء داخل المنظومة',
      'حاسبة الـ 14 قسماً لمنع التسعير العشوائي منذ أول قطعة',
      'معرض شخصي من 6 أعمال لعرض تطور شغلك',
    ],
    accentClass: 'text-sky-700 dark:text-sky-300 border-sky-400/50 bg-sky-500/10',
    isSystem: true,
    permissions: {
      canPublishLessons: false,
      canAccessProTools: false,
      canJoinGroupBuying: true,
      canExportToMarket: false,
      showVerifiedBadge: false,
    },
  },
  intermediate: {
    id: 'intermediate',
    title: 'متوسط / صانع مستقل',
    titleFemale: 'متوسطة / صانعة مستقلة',
    shortLabel: 'صانع مستقل',
    shortLabelFemale: 'صانعة مستقلة',
    tagline: 'تنفذ طلبيات فعلية ولديك عملاء وتحتاج تنظيم المخزون والكتالوج والأرباح.',
    perks: [
      'الأرشيف (كارت الصنف) + الكتالوج وعروض الأسعار الموثقة',
      'بطاقة «هلخصهالك» ومتابعة مستحقات العملاء بتذكير واتساب',
      'معرض 6 أعمال مع زر مشاركة مباشر ومتجر مستقل',
    ],
    accentClass: 'text-emerald-700 dark:text-emerald-300 border-emerald-400/50 bg-emerald-500/10',
    isSystem: true,
    permissions: {
      canPublishLessons: false,
      canAccessProTools: true,
      canJoinGroupBuying: true,
      canExportToMarket: true,
      showVerifiedBadge: false,
    },
  },
  pro: {
    id: 'pro',
    title: 'محترف / صاحب ورشة ومشروع',
    titleFemale: 'محترفة / صاحبة ورشة ومشروع',
    shortLabel: 'محترف',
    shortLabelFemale: 'محترفة',
    tagline: 'إنتاج منتظم ومتجر وكتالوج وتستهدف التوسع وسوق الشمساوية والهدايا المؤسسية.',
    perks: [
      'متجر مستقل + تصدير منتجاتك لسوق الشمساوية بشارة الاعتماد الخضراء',
      'خطة الشغل الأسبوعية + حاسبة الجملة والهدايا المؤسسية + جواز سفر المنتج QR',
      'مجمع الشراء التعاوني للخامات بسعر الجملة القصوى',
    ],
    accentClass: 'text-amber-800 dark:text-[#FBBF24] border-amber-500/50 bg-amber-500/10',
    isSystem: true,
    permissions: {
      canPublishLessons: false,
      canAccessProTools: true,
      canJoinGroupBuying: true,
      canExportToMarket: true,
      showVerifiedBadge: false,
    },
  },
  expert_trainer: {
    id: 'expert_trainer',
    title: 'خبير',
    titleFemale: 'خبيرة',
    shortLabel: 'خبير',
    shortLabelFemale: 'خبيرة',
    tagline: 'تنقل خبرتك وتقدم شروحات وفيديوهات تعليمية وترشد جيل الحرفيين الجديد.',
    perks: [
      'فتح منشورات الدروس والشروحات المدمجة (يوتيوب/فيسبوك/إنستجرام/تيك توك) داخل صفحتك',
      'عرض الفيديو والمنشور بأبعاده الطبيعية داخل المنظومة بملء الشاشة بدون الخروج لمتصفح خارجي',
      'نشر تلقائي باسمك في طبلية عيلة الشمساوية + إرسال إشعار فوري لجميع الفنانين',
      'تحكم كامل في جمهور كل منشور (الكل / الفنانون / الموردون / العملاء)',
    ],
    accentClass: 'text-[#C2410C] dark:text-[#FDBA74] border-[#EA580C]/50 bg-[#EA580C]/12',
    isSystem: true,
    permissions: {
      canPublishLessons: true,
      canAccessProTools: true,
      canJoinGroupBuying: true,
      canExportToMarket: true,
      showVerifiedBadge: true,
    },
  },
};

export const DEFAULT_SKILL_LEVELS_LIST: SkillLevelMeta[] = [
  ARTISAN_SKILL_LEVELS.beginner,
  ARTISAN_SKILL_LEVELS.intermediate,
  ARTISAN_SKILL_LEVELS.pro,
  ARTISAN_SKILL_LEVELS.expert_trainer,
];

export interface AssessmentQuestion {
  id: string;
  question: string;
  options: { label: string; score: number; hint?: string }[];
}

export const ARTISAN_ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'q_exp',
    question: 'ما مدى خبرتك العملية في ممارسة حرفتك اليدوية؟',
    options: [
      { label: 'أقل من سنة — لسه ببدأ وأتعلم الأساسيات', score: 1 },
      { label: 'من 1 إلى 3 سنوات — بنفذ طلبيات بانتظام', score: 2 },
      { label: 'أكثر من 3 سنوات — عندي ورشة أو براند مستقر', score: 3 },
      { label: 'خبير محترف أقدم كورسات أو شروحات تدريبية للآخرين', score: 4 },
    ],
  },
  {
    id: 'q_pricing',
    question: 'كيف تسعّر مشغولاتك وتدير خامات ورشتك حالياً؟',
    options: [
      { label: 'بالتقدير التقريبي أو حسب أسعار السوق', score: 1 },
      { label: 'أحسب الخامات فقط وأضيف مبلغاً للربح', score: 2 },
      { label: 'أحسب الخامات والهالك وساعات اليد والتغليف بدقة', score: 3 },
      { label: 'أدرّب غيري على أسس الحرفة والتسعير وإدارة الورش', score: 4 },
    ],
  },
  {
    id: 'q_teaching',
    question: 'هل لديك شروحات أو فيديوهات تعليمية (يوتيوب/فيسبوك/إنستجرام) تشاركها مع الحرفيين؟',
    options: [
      { label: 'لا — أبحث عن شروحات أتعلم منها', score: 1 },
      { label: 'أشارك صور أعمالي فقط لعرض شغلي', score: 2 },
      { label: 'أحياناً أجاوب على استفسارات زملائي الحرفيين', score: 3 },
      { label: 'نعم — أنشر دروساً وشروحات منتظمة بصفتي مدرباً ومعلماً', score: 4 },
    ],
  },
];

export function computeRecommendedSkillLevel(answers: Record<string, number>): {
  level: ArtisanSkillLevel;
  score: number;
  maxScore: number;
} {
  const vals = Object.values(answers);
  const score = vals.reduce((s, v) => s + (Number(v) || 0), 0);
  const maxScore = ARTISAN_ASSESSMENT_QUESTIONS.length * 4;
  // إذا اختار المستخدم خيار المدرب (4) في سؤال التدريب أو مجموع >= 10 يُرشح كخبير ومدرب
  if (answers.q_teaching === 4 || score >= 10) {
    return { level: 'expert_trainer', score, maxScore };
  }
  if (score >= 7) {
    return { level: 'pro', score, maxScore };
  }
  if (score >= 5) {
    return { level: 'intermediate', score, maxScore };
  }
  return { level: 'beginner', score, maxScore };
}

export interface TrainerEmbeddedPost {
  id: string;
  memberId: string;
  authorName: string;
  brandName: string;
  authorAvatar?: string | null;
  authorGender?: 'male' | 'female';
  title: string;
  description: string;
  url: string;
  platform: SocialEmbedPlatform;
  videoOrientation?: VideoOrientation;
  videoAspectRatio?: number;
  audience: AudienceRule;
  familyPostId?: string | null;
  notifyArtisans?: boolean;
  createdAt: string;
}

export interface TrainerLessonAlert {
  id: string;
  postId: string;
  familyPostId: string;
  trainerMemberId: string;
  trainerName: string;
  brandName: string;
  trainerAvatar?: string | null;
  title: string;
  platform: SocialEmbedPlatform;
  createdAt: string;
}

export interface GrowthHubConfig {
  // نظام الخبراء والمدربين
  trainerAssessmentEnabled: boolean;
  trainerDefaultPostLimit: number; // 0 = غير محدود
  trainerAutoNotifyArtisans: boolean;
  trainerRequireApproval: boolean;
  // أدوات تطوير الفنانين
  productionCalendarEnabled: boolean;
  corporateGiftingEnabled: boolean;
  productPassportQrEnabled: boolean;
  groupBuyingEnabled: boolean;
  aiSocialCopyEnabled: boolean;
  // أدوات تطوير الموردين
  supplierCreditLimitEnabled: boolean;
  supplierSmartRestockEnabled: boolean;
  supplierMobileStocktakeEnabled: boolean;
  supplierFlashBundlesEnabled: boolean;
  // التسويق والتكاملات
  landingQuizEnabled: boolean;
  ambassadorsProgramEnabled: boolean;
  paymentGatewayProvider: 'manual' | 'paymob' | 'fawry' | 'kashier';
  shippingCarrierProvider: 'manual' | 'bosta' | 'aramex';
  eInvoiceMode: 'off' | 'eta_egypt' | 'zatca_ksa';
  // تحكم السوبر أدمن في مستويات الفنانين وصلاحياتها + ترتيب عرض بطاقة الدروس
  customSkillLevels?: SkillLevelMeta[];
  lessonLayoutBlocks?: LessonLayoutBlockConfig[];
  updatedAt?: string;
}

export const DEFAULT_GROWTH_HUB_CONFIG: GrowthHubConfig = {
  trainerAssessmentEnabled: true,
  trainerDefaultPostLimit: 15,
  trainerAutoNotifyArtisans: true,
  trainerRequireApproval: false,
  productionCalendarEnabled: true,
  corporateGiftingEnabled: true,
  productPassportQrEnabled: true,
  groupBuyingEnabled: true,
  aiSocialCopyEnabled: true,
  supplierCreditLimitEnabled: true,
  supplierSmartRestockEnabled: true,
  supplierMobileStocktakeEnabled: true,
  supplierFlashBundlesEnabled: true,
  landingQuizEnabled: true,
  ambassadorsProgramEnabled: true,
  paymentGatewayProvider: 'manual',
  shippingCarrierProvider: 'manual',
  eInvoiceMode: 'off',
  customSkillLevels: DEFAULT_SKILL_LEVELS_LIST,
  lessonLayoutBlocks: DEFAULT_LESSON_LAYOUT_BLOCKS,
};

const GROWTH_CONFIG_STORAGE_KEY = 'alshams_growth_hub_config_v1';

export function getStoredGrowthHubConfig(): GrowthHubConfig {
  try {
    const raw = localStorage.getItem(GROWTH_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GROWTH_HUB_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_GROWTH_HUB_CONFIG, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_GROWTH_HUB_CONFIG };
  }
}

export function saveStoredGrowthHubConfig(cfg: Partial<GrowthHubConfig>): GrowthHubConfig {
  const next: GrowthHubConfig = {
    ...getStoredGrowthHubConfig(),
    ...cfg,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(GROWTH_CONFIG_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('alshams_growth_config_updated', { detail: next }));
  } catch {}
  return next;
}

/**
 * قائمة المستويات الفعلية (الافتراضية + تعديلات أو مستويات السوبر أدمن)
 */
export function getEffectiveSkillLevels(cfg?: Partial<GrowthHubConfig>): SkillLevelMeta[] {
  const source = cfg || getStoredGrowthHubConfig();
  if (Array.isArray(source.customSkillLevels) && source.customSkillLevels.length > 0) {
    return source.customSkillLevels.map((lvl) => {
      const base = ARTISAN_SKILL_LEVELS[lvl.id];
      return {
        ...(base || {}),
        ...lvl,
        permissions: {
          canPublishLessons: lvl.permissions?.canPublishLessons ?? base?.permissions?.canPublishLessons ?? (lvl.id === 'expert_trainer'),
          canAccessProTools: lvl.permissions?.canAccessProTools ?? base?.permissions?.canAccessProTools ?? true,
          canJoinGroupBuying: lvl.permissions?.canJoinGroupBuying ?? base?.permissions?.canJoinGroupBuying ?? true,
          canExportToMarket: lvl.permissions?.canExportToMarket ?? base?.permissions?.canExportToMarket ?? true,
          showVerifiedBadge: lvl.permissions?.showVerifiedBadge ?? base?.permissions?.showVerifiedBadge ?? (lvl.id === 'expert_trainer'),
        },
        perks: Array.isArray(lvl.perks) && lvl.perks.length > 0 ? lvl.perks : base?.perks || [],
        accentClass: lvl.accentClass || base?.accentClass || 'text-[#C2410C] dark:text-[#FDBA74] border-[#EA580C]/50 bg-[#EA580C]/12',
      };
    });
  }
  return DEFAULT_SKILL_LEVELS_LIST;
}

export function getSkillLevelMeta(
  levelId?: string | null,
  gender?: 'male' | 'female' | string | null,
  cfg?: Partial<GrowthHubConfig>
): SkillLevelMeta & { displayTitle: string; displayShortLabel: string } {
  const levels = getEffectiveSkillLevels(cfg);
  const found =
    levels.find((l) => l.id === levelId) ||
    ARTISAN_SKILL_LEVELS[levelId || 'intermediate'] ||
    ARTISAN_SKILL_LEVELS.intermediate;
  const isFemale = gender === 'female';
  return {
    ...found,
    displayTitle: isFemale && found.titleFemale ? found.titleFemale : found.title,
    displayShortLabel: isFemale && found.shortLabelFemale ? found.shortLabelFemale : found.shortLabel,
  };
}

export function canLevelPublishLessons(
  levelId?: string | null,
  trainerVerified?: boolean,
  accountRole?: string | null,
  cfg?: Partial<GrowthHubConfig>
): boolean {
  if (accountRole === 'superadmin' || trainerVerified) return true;
  if (!levelId) return false;
  const meta = getSkillLevelMeta(levelId, undefined, cfg);
  if (meta.permissions) return Boolean(meta.permissions.canPublishLessons);
  return levelId === 'expert_trainer';
}

export function getEffectiveLessonLayoutBlocks(cfg?: Partial<GrowthHubConfig>): LessonLayoutBlockConfig[] {
  const source = cfg || getStoredGrowthHubConfig();
  if (Array.isArray(source.lessonLayoutBlocks) && source.lessonLayoutBlocks.length > 0) {
    const validIds = new Set<LessonCardBlockId>(['header_bar', 'media', 'title', 'description', 'footer_actions']);
    const seen = new Set<LessonCardBlockId>();
    const cleaned: LessonLayoutBlockConfig[] = [];
    for (const blk of source.lessonLayoutBlocks) {
      if (blk && validIds.has(blk.id) && !seen.has(blk.id)) {
        const def = DEFAULT_LESSON_LAYOUT_BLOCKS.find((d) => d.id === blk.id)!;
        cleaned.push({
          id: blk.id,
          label: blk.label || def.label,
          visible: blk.visible !== false,
        });
        seen.add(blk.id);
      }
    }
    for (const def of DEFAULT_LESSON_LAYOUT_BLOCKS) {
      if (!seen.has(def.id)) cleaned.push({ ...def });
    }
    return cleaned;
  }
  return DEFAULT_LESSON_LAYOUT_BLOCKS;
}

export const SOCIAL_PLATFORM_META: Record<
  SocialEmbedPlatform,
  { label: string; color: string; aspect: 'landscape' | 'portrait' | 'square' }
> = {
  youtube: { label: 'يوتيوب (YouTube)', color: '#DC2626', aspect: 'landscape' },
  facebook: { label: 'فيسبوك (Facebook)', color: '#1877F2', aspect: 'landscape' },
  instagram: { label: 'إنستجرام (Instagram)', color: '#E1306C', aspect: 'portrait' },
  tiktok: { label: 'تيك توك (TikTok)', color: '#111827', aspect: 'portrait' },
  vimeo: { label: 'فيميو (Vimeo)', color: '#0EA5E9', aspect: 'landscape' },
  dailymotion: { label: 'ديلي موشن', color: '#2563EB', aspect: 'landscape' },
  pinterest: { label: 'بنترست (Pinterest)', color: '#B91C1C', aspect: 'portrait' },
  other: { label: 'منصة أخرى (عرض مدمج)', color: '#EA580C', aspect: 'landscape' },
};

export function detectSocialPlatform(rawUrl: string): SocialEmbedPlatform {
  const u = (rawUrl || '').trim().toLowerCase();
  if (!u) return 'youtube';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'facebook';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.includes('dailymotion.com') || u.includes('dai.ly')) return 'dailymotion';
  if (u.includes('pinterest.') || u.includes('pin.it')) return 'pinterest';
  return 'other';
}

export interface ParsedSocialEmbed {
  platform: SocialEmbedPlatform;
  originalUrl: string;
  embedUrl: string;
  isVertical: boolean;
  isEmbeddable: boolean;
  needsResolve?: boolean;
}

export function parseSocialEmbedUrl(
  rawUrl: string,
  explicitPlatform?: SocialEmbedPlatform
): ParsedSocialEmbed {
  const cleanUrl = (rawUrl || '').trim();
  const normalizedUrl = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`;
  const platform = explicitPlatform && explicitPlatform !== 'other'
    ? explicitPlatform
    : detectSocialPlatform(normalizedUrl);

  // 1. YouTube (watch, youtu.be, shorts, live, embed)
  if (platform === 'youtube') {
    const isShort = /youtube\.com\/shorts\//i.test(normalizedUrl);
    const idMatch =
      normalizedUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/) ||
      normalizedUrl.match(/([A-Za-z0-9_-]{11})/);
    const videoId = idMatch?.[1] || '';
    if (videoId) {
      return {
        platform: 'youtube',
        originalUrl: normalizedUrl,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`,
        isVertical: isShort,
        isEmbeddable: true,
        needsResolve: false,
      };
    }
  }

  // 2. Facebook (videos, reel, watch, share/r, share/v, fb.watch, m.facebook.com, posts)
  if (platform === 'facebook') {
    const cleanFbUrl = normalizedUrl.replace(
      /^https?:\/\/(?:m|mbasic|web)\.facebook\.com/i,
      'https://www.facebook.com'
    );
    const isShortShare = /fb\.watch|facebook\.com\/share\//i.test(cleanFbUrl);
    const isReel = /\/reel\/|\/share\/r\//i.test(cleanFbUrl);
    const isVideo =
      isReel ||
      /\/videos\/|fb\.watch|\/watch\/?\?v=|\/share\/v\/|story_fbid/i.test(cleanFbUrl);
    const encoded = encodeURIComponent(cleanFbUrl);
    const embedUrl = isVideo
      ? `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=false&t=0`
      : `https://www.facebook.com/plugins/post.php?href=${encoded}&show_text=true&width=500`;
    return {
      platform: 'facebook',
      originalUrl: cleanFbUrl,
      embedUrl,
      isVertical: isReel,
      isEmbeddable: true,
      needsResolve: isShortShare,
    };
  }

  // 3. Instagram (p, reel, reels, tv)
  if (platform === 'instagram') {
    const igMatch = normalizedUrl.match(/instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (igMatch) {
      const kind = igMatch[1].toLowerCase() === 'reels' ? 'reel' : igMatch[1].toLowerCase();
      const code = igMatch[2];
      return {
        platform: 'instagram',
        originalUrl: normalizedUrl,
        embedUrl: `https://www.instagram.com/${kind}/${code}/embed/captioned/`,
        isVertical: kind === 'reel' || kind === 'tv',
        isEmbeddable: true,
        needsResolve: false,
      };
    }
  }

  // 4. TikTok (full /video/ID, /photo/ID, and short mobile links vm.tiktok.com / vt.tiktok.com / /t/)
  if (platform === 'tiktok') {
    const ttMatch = normalizedUrl.match(/\/(?:video|photo)\/(\d+)/i);
    if (ttMatch) {
      return {
        platform: 'tiktok',
        originalUrl: normalizedUrl,
        embedUrl: `https://www.tiktok.com/player/v1/${ttMatch[1]}?music_info=1&description=1&rel=0`,
        isVertical: true,
        isEmbeddable: true,
        needsResolve: false,
      };
    }
    // Mobile short link — requires server-side redirect/oEmbed resolution before mounting iframe
    return {
      platform: 'tiktok',
      originalUrl: normalizedUrl,
      embedUrl: '',
      isVertical: true,
      isEmbeddable: false,
      needsResolve: true,
    };
  }

  // 5. Vimeo
  if (platform === 'vimeo') {
    const vmMatch = normalizedUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vmMatch) {
      return {
        platform: 'vimeo',
        originalUrl: normalizedUrl,
        embedUrl: `https://player.vimeo.com/video/${vmMatch[1]}?title=0&byline=0`,
        isVertical: false,
        isEmbeddable: true,
        needsResolve: false,
      };
    }
  }

  // 6. Dailymotion
  if (platform === 'dailymotion') {
    const dmMatch = normalizedUrl.match(/(?:video\/|dai\.ly\/)([A-Za-z0-9]+)/i);
    if (dmMatch) {
      return {
        platform: 'dailymotion',
        originalUrl: normalizedUrl,
        embedUrl: `https://www.dailymotion.com/embed/video/${dmMatch[1]}`,
        isVertical: false,
        isEmbeddable: true,
        needsResolve: false,
      };
    }
  }

  // 7. Pinterest
  if (platform === 'pinterest') {
    const pinMatch = normalizedUrl.match(/\/pin\/(\d+)/i);
    if (pinMatch) {
      return {
        platform: 'pinterest',
        originalUrl: normalizedUrl,
        embedUrl: `https://assets.pinterest.com/ext/embed.html?id=${pinMatch[1]}`,
        isVertical: true,
        isEmbeddable: true,
        needsResolve: false,
      };
    }
  }

  // 8. Generic safe embed attempt
  return {
    platform,
    originalUrl: normalizedUrl,
    embedUrl: normalizedUrl,
    isVertical: false,
    isEmbeddable: /^https:\/\//i.test(normalizedUrl),
    needsResolve: false,
  };
}

// =========================================================================
// Structured marker inside family_posts.content (Zero SQL migration needed)
// =========================================================================
export interface EmbeddedPostMarkerPayload {
  title: string;
  url: string;
  platform: SocialEmbedPlatform;
  videoOrientation?: VideoOrientation;
  videoAspectRatio?: number;
  authorGender?: 'male' | 'female';
  trainerBadge?: boolean;
  postId?: string;
}

const EMBED_START = '[[SHAMS_EMBED:';
const EMBED_END = ']]';

export function encodeEmbeddedMediaContent(
  visibleText: string,
  meta: EmbeddedPostMarkerPayload
): string {
  const safeJson = JSON.stringify({
    title: meta.title.slice(0, 140),
    url: meta.url.slice(0, 600),
    platform: meta.platform,
    videoOrientation: meta.videoOrientation || 'auto',
    videoAspectRatio: meta.videoAspectRatio,
    authorGender: meta.authorGender,
    trainerBadge: meta.trainerBadge !== false,
    postId: meta.postId || '',
  });
  return `${visibleText.trim()}\n${EMBED_START}${safeJson}${EMBED_END}`;
}

export function extractEmbeddedMediaFromContent(rawContent: string): {
  cleanText: string;
  embed: EmbeddedPostMarkerPayload | null;
} {
  const text = String(rawContent || '');
  const startIdx = text.indexOf(EMBED_START);
  if (startIdx === -1) {
    return { cleanText: text, embed: null };
  }
  const endIdx = text.indexOf(EMBED_END, startIdx + EMBED_START.length);
  if (endIdx === -1) {
    return { cleanText: text, embed: null };
  }
  const jsonStr = text.slice(startIdx + EMBED_START.length, endIdx);
  const cleanText = (text.slice(0, startIdx) + text.slice(endIdx + EMBED_END.length)).trim();
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.url === 'string' && parsed.url.trim()) {
      return {
        cleanText,
        embed: {
          title: String(parsed.title || ''),
          url: String(parsed.url || ''),
          platform: (parsed.platform as SocialEmbedPlatform) || detectSocialPlatform(parsed.url),
          videoOrientation: parsed.videoOrientation as VideoOrientation | undefined,
          videoAspectRatio: typeof parsed.videoAspectRatio === 'number' ? parsed.videoAspectRatio : undefined,
          authorGender:
            parsed.authorGender === 'male' || parsed.authorGender === 'female'
              ? parsed.authorGender
              : undefined,
          trainerBadge: parsed.trainerBadge !== false,
          postId: parsed.postId || undefined,
        },
      };
    }
  } catch {}
  return { cleanText, embed: null };
}
