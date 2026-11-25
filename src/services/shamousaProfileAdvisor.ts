import {
  MAX_SHOWCASE_POSTS,
  normalizeVisibilityMatrix,
  type AudienceRole,
  type MemberPersonalProfile,
  type ProfileVisibilityMatrix,
  type ShowcasePostItem,
} from '../types/memberProfile';
import type { SavedProductRecord } from '../types';
import { hasFeature, type AccountPackageQueryOptions } from '../types/subscriptions';

export interface ProfileTechnicalIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  actionHint: string;
}

export interface ProfileProactiveSuggestion {
  id: string;
  title: string;
  detail: string;
  intentPrompt: string;
  buttonLabel: string;
}

export interface ProfileContentIdeas {
  introPost: string;
  newProductPosts: Array<{ productName: string; postText: string }>;
  weeklyFamilyTablePost: string;
}

export interface PersonalProfileAuditResult {
  score: number;
  maxScore: number;
  showcaseCount: number;
  maxShowcase: number;
  issues: ProfileTechnicalIssue[];
  /** Strictly top 2 daily actions (and overall list capped at max 3) */
  topTwoToday: ProfileProactiveSuggestion[];
  contentIdeas: ProfileContentIdeas;
  respectedHiddenSections: string[];
  summaryMarkdown: string;
}

const ALL_AUDIENCES: AudienceRole[] = ['artisans', 'suppliers', 'customers'];

function getVisibleAudiencesForField(
  matrix: ProfileVisibilityMatrix,
  field: keyof ProfileVisibilityMatrix
): AudienceRole[] {
  const rule = matrix[field];
  if (!rule) return [];
  return ALL_AUDIENCES.filter((aud) => Boolean(rule[aud]));
}

function audienceLabelAr(aud: AudienceRole): string {
  if (aud === 'artisans') return 'الفنانين';
  if (aud === 'suppliers') return 'الموردين';
  return 'العملاء';
}

function isFieldVisibleToAny(
  matrix: ProfileVisibilityMatrix,
  field: keyof ProfileVisibilityMatrix
): boolean {
  return getVisibleAudiencesForField(matrix, field).length > 0;
}

/**
 * فحص فني محلي خالص (بدون AI) لجودة ووزن صور المعرض والشعار.
 */
function inspectImageLocally(url: string | null | undefined, label: string): ProfileTechnicalIssue | null {
  const clean = String(url || '').trim();
  if (!clean) return null;

  if (clean.startsWith('data:image/')) {
    const base64Part = clean.split(',')[1] || '';
    const approxBytes = Math.round((base64Part.length * 3) / 4);
    if (approxBytes > 0 && approxBytes < 9000) {
      return {
        id: `img_tiny_${label}`,
        severity: 'medium',
        title: `صورة ${label} حجمها صغير جداً (${Math.max(1, Math.round(approxBytes / 1024))} ك.ب)`,
        detail: 'الصور الصغيرة أوي ممكن تطلع مبكسلة على الموبايل أو الشاشة الكبيرة.',
        actionHint: 'ارفع صورة أوضح بإضاءة طبيعية وجودة متوسطة.',
      };
    }
    return null;
  }

  if (!/^https?:\/\//i.test(clean)) {
    return {
      id: `img_bad_url_${label}`,
      severity: 'high',
      title: `رابط صورة ${label} غير مكتمل`,
      detail: 'الرابط ده مش بيبدأ بـ https:// فالصورة ممكن ما تظهرش للزوار.',
      actionHint: 'ارفع الصورة من جهازك أو تأكد من الرابط المباشر.',
    };
  }

  return null;
}

function inspectShowcaseLocally(posts: ShowcasePostItem[]): ProfileTechnicalIssue[] {
  const issues: ProfileTechnicalIssue[] = [];
  const seenUrls = new Set<string>();
  let missingCaptions = 0;

  posts.forEach((post, idx) => {
    const num = idx + 1;
    const imgIssue = inspectImageLocally(post.imageUrl, `العمل رقم ${num}`);
    if (imgIssue) issues.push(imgIssue);

    const key = (post.imageUrl || '').trim();
    if (key) {
      if (seenUrls.has(key)) {
        issues.push({
          id: `dup_showcase_${post.id}`,
          severity: 'low',
          title: `صورة مكررة في معرض الأعمال (رقم ${num})`,
          detail: 'تكرار نفس الصورة بيضيّع خانة من الـ 6 خانات المتاحة لعرض تنوّع شغلك.',
          actionHint: 'بدّلها بصورة زاوية تانية أو قطعة مختلفة.',
        });
      }
      seenUrls.add(key);
    }

    if (!(post.caption || '').trim() && !(post.captionEn || '').trim()) {
      missingCaptions += 1;
    }
  });

  if (missingCaptions > 0) {
    issues.push({
      id: 'showcase_missing_captions',
      severity: 'low',
      title: `${missingCaptions} صور في المعرض بدون شرح مكتوب`,
      detail: 'سطر واحد بسيط تحت كل صورة بيوضح الخامة أو الفكرة وبيخلّي الزائر يثق في شغلك.',
      actionHint: 'اكتب وصف مختصر تحت كل صورة في المعرض.',
    });
  }

  return issues;
}

export function auditPersonalProfileOffline(params: {
  profile: MemberPersonalProfile;
  accountId: string;
  products?: SavedProductRecord[];
  packageOptions?: AccountPackageQueryOptions;
}): PersonalProfileAuditResult {
  const { profile, accountId, packageOptions } = params;
  const products = Array.isArray(params.products) ? params.products : [];
  const canStorefront =
    hasFeature('storefront', accountId, packageOptions) ||
    hasFeature('catalog', accountId, packageOptions);

  const visibility = normalizeVisibilityMatrix(profile.visibility);
  const showcase = Array.isArray(profile.showcasePosts) ? profile.showcasePosts : [];
  const showcaseCount = showcase.length;
  const firstName = (profile.displayName || 'صديقي').trim().split(/\s+/)[0] || 'صديقي';
  const brand = (profile.brandName || '').trim() || `شغل ${firstName}`;

  const issues: ProfileTechnicalIssue[] = [];
  const suggestions: ProfileProactiveSuggestion[] = [];
  const respectedHiddenSections: string[] = [];

  // تتبّع الأقسام اللي المستخدم أخفاها عشان نحترمها 100% ولا نقترح مشاركتها أبداً
  const sectionLabels: Array<{ key: keyof ProfileVisibilityMatrix; label: string }> = [
    { key: 'personalAvatar', label: 'الصورة الشخصية' },
    { key: 'story', label: 'قصة الفنان/الورشة' },
    { key: 'showcase', label: 'معرض الأعمال' },
    { key: 'contact', label: 'بيانات التواصل' },
    { key: 'storeLink', label: 'رابط المتجر' },
    { key: 'location', label: 'الموقع والمحافظة' },
  ];

  sectionLabels.forEach(({ key, label }) => {
    const hiddenFor = ALL_AUDIENCES.filter((aud) => !visibility[key][aud]);
    if (hiddenFor.length === ALL_AUDIENCES.length) {
      respectedHiddenSections.push(`${label} (مخفي عن الجميع)`);
    } else if (hiddenFor.length > 0) {
      respectedHiddenSections.push(`${label} (مخفي عن: ${hiddenFor.map(audienceLabelAr).join('، ')})`);
    }
  });

  // حساب درجة الصفحة الشخصية (0 - 100) بطريقة حتمية محلية
  let score = 15; // قاعدة لوجود الحساب والاسم

  // 1) النبذة التعريفية (15 نقطة)
  const bioLen = (profile.bioHeadline || '').trim().length;
  if (bioLen >= 15) {
    score += 15;
  } else if (bioLen > 0) {
    score += 7;
    issues.push({
      id: 'short_bio',
      severity: 'medium',
      title: 'السطر التعريفي قصير جداً',
      detail: 'النبذة المختصرة بتظهر أول حاجة تحت اسمك وبتعرف الناس بتشتغل في إيه.',
      actionHint: 'اكتب سطر واضح يجمع حرفتك ونوع القطع اللي بتعملها.',
    });
  } else {
    issues.push({
      id: 'missing_bio',
      severity: 'high',
      title: 'مفيش سطر تعريفي (Bio) تحت اسمك',
      detail: 'الزائر لما يدخل صفحتك بيحتاج يعرف في 3 ثواني إنت بتبدع في إيه.',
      actionHint: 'اكتب سطر تعريفي بسيط في أعلى الصفحة.',
    });
  }

  // 2) القصة (25 نقطة) — نفحصها فقط لو القسم مش مخفي عن الجميع!
  const storyVisibleAudiences = getVisibleAudiencesForField(visibility, 'story');
  const storyLen = (profile.storyText || '').trim().length;
  if (storyVisibleAudiences.length > 0) {
    if (storyLen >= 80) {
      score += 25;
    } else if (storyLen >= 30) {
      score += 14;
      issues.push({
        id: 'short_story',
        severity: 'medium',
        title: 'قصتك التعريفية مختصرة شوية',
        detail: `قصتك ظاهرة لـ (${storyVisibleAudiences.map(audienceLabelAr).join('، ')}). لما تكتب سطرين زيادة عن بدايتك وشغفك بتفرق جداً في الثقة.`,
        actionHint: 'أضف سطرين عن بدايتك في الحرفة وإيه أكتر قطعة بتحب تشتغلها.',
      });
      suggestions.push({
        id: 'sug_story',
        title: 'كمّل قصتك التعريفية في سطرين',
        detail: `قصتك ظاهرة لـ ${storyVisibleAudiences.map(audienceLabelAr).join(' و')} — خلّي شموسة تكتبهالك بأسلوب دافي.`,
        intentPrompt: 'اكتب لي بوست تعريفي وقصة قصيرة لصفحتي الشخصية',
        buttonLabel: 'اكتبيلي القصة مع شموسة ✍️',
      });
    } else {
      issues.push({
        id: 'missing_story',
        severity: 'high',
        title: 'لسه ما كتبتش قصتك في الصفحة الشخصية',
        detail: 'قصة الفنان/الورشة من أكتر الحاجات اللي بتقرّب الناس من شغلك اليدوي.',
        actionHint: 'اكتب 3 سطور بسيطة عن بدايتك وإيه اللي بيميز إيدك.',
      });
      suggestions.push({
        id: 'sug_story_new',
        title: 'اكتب قصتك التعريفية النهاردة',
        detail: '3 سطور حقيقية عن شغلك بترفع تقييم صفحتك 25 نقطة مرة واحدة.',
        intentPrompt: 'اكتب لي بوست تعريفي وقصة قصيرة لصفحتي الشخصية',
        buttonLabel: 'جهّزيلي القصة والبوست ✍️',
      });
    }
  } else {
    // احترمنا اختيار المستخدم بإخفاء القصة فما ننقصوش عليها
    score += 20;
  }

  // 3) اللوجو / الصورة الشخصية (15 نقطة) — مع احترام مصفوفة الخصوصية
  const hasBrandLogo = Boolean((profile.brandLogo || '').trim());
  const hasPersonalAvatar = Boolean((profile.personalAvatar || '').trim());
  const avatarAllowed = isFieldVisibleToAny(visibility, 'personalAvatar');

  if (hasBrandLogo || (avatarAllowed && hasPersonalAvatar)) {
    score += 15;
    const logoIssue = inspectImageLocally(profile.brandLogo, 'شعار الورشة');
    if (logoIssue) issues.push(logoIssue);
    if (avatarAllowed) {
      const avIssue = inspectImageLocally(profile.personalAvatar, 'صورتك الشخصية');
      if (avIssue) issues.push(avIssue);
    }
  } else {
    issues.push({
      id: 'missing_logo_avatar',
      severity: 'high',
      title: avatarAllowed ? 'مفيش شعار أو صورة شخصية على صفحتك' : 'مفيش شعار (لوجو) لبراندك على الصفحة',
      detail: avatarAllowed
        ? 'وجود شعار واضح أو صورة شخصية بيخلّي الناس تفتكرك وسط باقي الورش.'
        : 'إنت مختار تخفي صورتك الشخصية (وده اختيارك المحترم)، فإضافة شعار لبراندك هيخلي صفحتك شكلها احترافي.',
      actionHint: avatarAllowed ? 'ارفع شعار ورشتك أو صورتك.' : 'ارفع شعار لبراندك من الإعدادات.',
    });
    suggestions.push({
      id: 'sug_logo',
      title: avatarAllowed ? 'ارفع شعار ورشتك أو صورة واضحة' : 'أضف شعار لبراندك على الصفحة',
      detail: 'هيرفع انطباع الثقة فوراً عند أي زائر يفتح صفحتك.',
      intentPrompt: 'راجع صفحتي الشخصية وقوليلي أبدأ بإيه',
      buttonLabel: 'اسأل شموسة ☀️',
    });
  }

  // 4) معرض الأعمال (30 نقطة — 6 أعمال كحد أقصى) — فقط لو المعرض ظاهر لجمهور واحد على الأقل
  const showcaseVisibleAudiences = getVisibleAudiencesForField(visibility, 'showcase');
  if (showcaseVisibleAudiences.length > 0) {
    const perItemPoints = Math.min(30, Math.round((showcaseCount / MAX_SHOWCASE_POSTS) * 30));
    score += perItemPoints;

    if (showcaseCount < MAX_SHOWCASE_POSTS) {
      const remaining = MAX_SHOWCASE_POSTS - showcaseCount;
      issues.push({
        id: 'showcase_incomplete',
        severity: showcaseCount === 0 ? 'high' : 'medium',
        title: `معرض أعمالك فيه ${showcaseCount} من ${MAX_SHOWCASE_POSTS} أعمال فقط`,
        detail: `فاضل ${remaining} ${remaining === 1 ? 'خانة فاضية' : 'خانات فاضية'} في معرضك الظاهر لـ (${showcaseVisibleAudiences.map(audienceLabelAr).join('، ')}).`,
        actionHint: 'ارفع صور لأفضل شغلك بتفاصيل واضحة وإضاءة طبيعية.',
      });
      suggestions.push({
        id: 'sug_showcase',
        title: showcaseCount === 0 ? 'ارفع أول عملين في معرضك' : `كمّل معرض أعمالك (${showcaseCount}/${MAX_SHOWCASE_POSTS})`,
        detail: 'كل صورة جديدة بوصف واضح بتقوّي صفحتك وتجهّزك للمشاركة على الطبلية.',
        intentPrompt: 'منتج جديد',
        buttonLabel: 'جهّز عمل/منتج جديد ✨',
      });
    }

    const imgIssues = inspectShowcaseLocally(showcase);
    issues.push(...imgIssues);
  } else {
    score += 20;
  }

  score = Math.max(0, Math.min(100, score));

  // اقتراح أسبوعي دائم لطبلية العيلة عشان يكمّل الـ top 2 لو الصفحة كاملة
  suggestions.push({
    id: 'sug_family_table',
    title: 'شارك بوست خفيف على طبلية عيلة الشمساوية',
    detail: 'اسأل زمايلك الفنانين عن لون أو خامة أو شارك لقطة من شغلك الأسبوع ده.',
    intentPrompt: 'فكرة بوست لطبلية عيلة الشمساوية',
    buttonLabel: 'اكتبيلي بوست للطبلية 👨‍👩‍👧‍👦',
  });

  if (canStorefront && products.length > 0) {
    suggestions.push({
      id: 'sug_store_review',
      title: 'راجع منتجاتك في المتجر مع شموسة',
      detail: `عندك ${products.length} منتج — خلّينا نطمن على العناوين والوصف والصور.`,
      intentPrompt: 'راجع منتجاتي',
      buttonLabel: 'راجع منتجاتي 🔍',
    });
  }

  // Hard cap: max 2 actions for today (never more than 3 on screen!)
  const topTwoToday = suggestions.slice(0, 2);

  // أفكار المحتوى الجاهزة للنسخ (مع احترام الخصوصية 100%)
  const canMentionLocation = isFieldVisibleToAny(visibility, 'location') && Boolean(profile.governorate);
  const canMentionStoreLink = canStorefront && isFieldVisibleToAny(visibility, 'storeLink');

  const introPost =
    `أهلاً بيكم في عالم ${brand} ☀️\n` +
    `أنا ${profile.displayName || firstName}${profile.bioHeadline ? ` — ${profile.bioHeadline}` : ''}` +
    `${canMentionLocation ? ` من ${profile.governorate}` : ''}.\n` +
    `${(profile.storyText || '').trim() || 'بعمل مشغولات يدوية بكل حب واهتمام بالتفاصيل الصغيرة عشان كل قطعة تبقى مختلفة وليها روحها.'}\n` +
    `${canMentionStoreLink ? 'تقدروا تشوفوا شغلي وتتابعوا كل جديد من رابط متجري على صفحتي.\n' : ''}` +
    `لو بتحبوا الهاند ميد، قولولي إيه أكتر لون أو قطعة نفسكم تشوفوها قريب؟ 👇`;

  const newProductPosts = canStorefront
    ? products.slice(0, 3).map((p) => ({
        productName: p.productName,
        postText:
          `✨ جديد من ${brand}: **${p.productName}**\n` +
          `${(p.storeDescription || p.input?.personalNotes || 'قطعة يدوية متقنة ومعمولة بعناية خاصة.').slice(0, 180)}\n` +
          `${Number(p.retailPrice || 0) > 0 ? `السعر: ${Number(p.retailPrice).toLocaleString('ar-EG')} ج.م\n` : ''}` +
          `حابين تشوفوا منها ألوان إيه تانية؟ اكتبولي في التعليقات 👇`,
      }))
    : [];

  const weeklyFamilyTablePost =
    `صباح الخير يا عيلة الشمساوية ☀️\n` +
    `الأسبوع ده في ${brand} شغال على تطوير تفاصيل شغلي${showcaseCount > 0 ? ` وضفت ${showcaseCount} أعمال في معرضي` : ''}.\n` +
    `سؤال سريع ليكم يا فنانين: إيه أكتر تفصيلة صغيرة في التغليف أو التصوير فرقت معاكم لما العميل شاف شغلكم؟ خلّونا نستفيد من خبرات بعض 🤍`;

  const issuesMd =
    issues.length > 0
      ? issues.slice(0, 5).map((iss) => `• ${iss.severity === 'high' ? '🔴' : iss.severity === 'medium' ? '🟡' : '⚪'} **${iss.title}:** ${iss.actionHint}`).join('\n')
      : '• ✅ صفحتك الشخصية مظبوطة وواضحة ومفيش ملاحظات فنية ناقصة!';

  const privacyNote =
    respectedHiddenSections.length > 0
      ? `\n\n🔒 **احترمت إعدادات خصوصيتك:** ${respectedHiddenSections.slice(0, 3).join(' • ')}.`
      : '';

  const summaryMarkdown =
    `👤 **تقييم صفحتك الشخصية يا ${firstName}: ${score}/100**\n` +
    `• معرض الأعمال: **${showcaseCount}/${MAX_SHOWCASE_POSTS}** أعمال.\n\n` +
    `**الملاحظات الفنية:**\n${issuesMd}\n\n` +
    `**أهم حاجتين تعملهم النهاردة:**\n` +
    topTwoToday.map((s, idx) => `${idx + 1}. **${s.title}** — ${s.detail}`).join('\n') +
    privacyNote;

  return {
    score,
    maxScore: 100,
    showcaseCount,
    maxShowcase: MAX_SHOWCASE_POSTS,
    issues,
    topTwoToday,
    contentIdeas: {
      introPost,
      newProductPosts,
      weeklyFamilyTablePost,
    },
    respectedHiddenSections,
    summaryMarkdown,
  };
}
