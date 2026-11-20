import { authedFetch } from '../lib/apiClient';
import {
  AudienceRole,
  AudienceRule,
  MAX_SHOWCASE_POSTS,
  MemberPersonalProfile,
  ProfileVisibilityMatrix,
  ShowcasePostItem,
  normalizeVisibilityMatrix,
} from '../types/memberProfile';
import {
  ArtisanSkillLevel,
  GrowthHubConfig,
  SocialEmbedPlatform,
  TrainerEmbeddedPost,
  TrainerLessonAlert,
  saveStoredGrowthHubConfig,
} from '../types/artisanGrowth';
import { UserProfile } from '../types';

export function resolveAudienceRoleFromUser(profile?: UserProfile | null): AudienceRole {
  if (!profile) return 'customers';
  if ((profile as any)?.accountRole === 'supplier') return 'suppliers';
  if (profile.id || profile.workshopId) return 'artisans';
  return 'customers';
}

export async function fetchMemberPersonalProfile(
  memberId: string,
  viewerRole: AudienceRole | 'owner' = 'customers'
): Promise<{
  success: boolean;
  profile?: MemberPersonalProfile;
  isOwner?: boolean;
  error?: string;
}> {
  if (!memberId) return { success: false, error: 'معرف العضو غير متوفر' };
  try {
    const res = await authedFetch(
      `/api/member-profile/${encodeURIComponent(memberId)}?viewerRole=${encodeURIComponent(viewerRole)}`
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.profile) {
      return {
        success: true,
        profile: {
          ...json.profile,
          visibility: normalizeVisibilityMatrix(json.profile.visibility),
          showcasePosts: Array.isArray(json.profile.showcasePosts)
            ? json.profile.showcasePosts.slice(0, MAX_SHOWCASE_POSTS)
            : [],
          trainerPosts: Array.isArray(json.profile.trainerPosts) ? json.profile.trainerPosts : [],
          craftsLabels: Array.isArray(json.profile.craftsLabels) ? json.profile.craftsLabels : [],
        },
        isOwner: Boolean(json.isOwner),
      };
    }
    return { success: false, error: json?.error || 'تعذر تحميل الملف الشخصي' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ في الاتصال' };
  }
}

export async function saveMemberPersonalProfile(payload: {
  personalAvatar?: string | null;
  bioHeadline?: string;
  storyText?: string;
  familyNickname?: string;
  gender?: 'male' | 'female';
  phone?: string;
  governorate?: string;
  visibility?: ProfileVisibilityMatrix;
  skillLevel?: ArtisanSkillLevel;
  assessmentScore?: number;
}): Promise<{
  success: boolean;
  profile?: MemberPersonalProfile;
  error?: string;
}> {
  try {
    const res = await authedFetch('/api/member-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.profile) {
      return {
        success: true,
        profile: {
          ...json.profile,
          visibility: normalizeVisibilityMatrix(json.profile.visibility),
          showcasePosts: Array.isArray(json.profile.showcasePosts)
            ? json.profile.showcasePosts
            : [],
          trainerPosts: Array.isArray(json.profile.trainerPosts) ? json.profile.trainerPosts : [],
        },
      };
    }
    return { success: false, error: json?.error || 'تعذر حفظ بيانات الملف الشخصي' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال أثناء الحفظ' };
  }
}

export async function addMemberShowcasePost(payload: {
  imageUrl: string;
  caption: string;
}): Promise<{
  success: boolean;
  post?: ShowcasePostItem;
  showcasePosts?: ShowcasePostItem[];
  error?: string;
}> {
  try {
    const res = await authedFetch('/api/member-profile/showcase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      return {
        success: true,
        post: json.post,
        showcasePosts: Array.isArray(json.showcasePosts) ? json.showcasePosts : [],
      };
    }
    return { success: false, error: json?.error || 'تعذر إضافة المنشور' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال أثناء النشر' };
  }
}

export async function updateMemberShowcasePost(
  postId: string,
  payload: { imageUrl?: string; caption: string }
): Promise<{
  success: boolean;
  showcasePosts?: ShowcasePostItem[];
  error?: string;
}> {
  try {
    const res = await authedFetch(`/api/member-profile/showcase/${encodeURIComponent(postId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      return {
        success: true,
        showcasePosts: Array.isArray(json.showcasePosts) ? json.showcasePosts : [],
      };
    }
    return { success: false, error: json?.error || 'تعذر تحديث المنشور' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال أثناء التحديث' };
  }
}

export async function deleteMemberShowcasePost(postId: string): Promise<{
  success: boolean;
  showcasePosts?: ShowcasePostItem[];
  error?: string;
}> {
  try {
    const res = await authedFetch(`/api/member-profile/showcase/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      return {
        success: true,
        showcasePosts: Array.isArray(json.showcasePosts) ? json.showcasePosts : [],
      };
    }
    return { success: false, error: json?.error || 'تعذر حذف المنشور' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال أثناء الحذف' };
  }
}

export async function addTrainerEmbeddedPost(payload: {
  title: string;
  description: string;
  url: string;
  platform: SocialEmbedPlatform;
  videoOrientation?: 'auto' | 'portrait' | 'landscape' | 'square';
  videoAspectRatio?: number;
  audience: AudienceRule;
  publishToFamily?: boolean;
}): Promise<{
  success: boolean;
  post?: TrainerEmbeddedPost;
  trainerPosts?: TrainerEmbeddedPost[];
  familyPostId?: string | null;
  notifiedCount?: number;
  error?: string;
}> {
  try {
    const res = await authedFetch('/api/member-profile/trainer-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      return {
        success: true,
        post: json.post,
        trainerPosts: Array.isArray(json.trainerPosts) ? json.trainerPosts : [],
        familyPostId: json.familyPostId || null,
        notifiedCount: json.notifiedCount || 0,
      };
    }
    return { success: false, error: json?.error || 'تعذر نشر الدرس المدمج' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال أثناء النشر' };
  }
}

export async function deleteTrainerEmbeddedPost(postId: string): Promise<{
  success: boolean;
  trainerPosts?: TrainerEmbeddedPost[];
  error?: string;
}> {
  try {
    const res = await authedFetch(`/api/member-profile/trainer-posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success) {
      return {
        success: true,
        trainerPosts: Array.isArray(json.trainerPosts) ? json.trainerPosts : [],
      };
    }
    return { success: false, error: json?.error || 'تعذر حذف منشور المدرب' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال أثناء الحذف' };
  }
}

export async function fetchTrainerLessonAlerts(): Promise<TrainerLessonAlert[]> {
  try {
    const res = await authedFetch('/api/trainer-posts/alerts');
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json?.alerts)) {
      return json.alerts;
    }
  } catch {}
  return [];
}

export async function syncGrowthHubConfigFromCloud(): Promise<GrowthHubConfig> {
  try {
    const res = await fetch('/api/growth/config');
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.config) {
      return saveStoredGrowthHubConfig(json.config);
    }
  } catch {}
  return saveStoredGrowthHubConfig({});
}

export async function saveGrowthHubConfigToCloud(config: Partial<GrowthHubConfig>): Promise<{
  success: boolean;
  config?: GrowthHubConfig;
  error?: string;
}> {
  try {
    const res = await authedFetch('/api/admin/growth-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json?.config) {
      const saved = saveStoredGrowthHubConfig(json.config);
      return { success: true, config: saved };
    }
    return { success: false, error: json?.error || 'تعذر حفظ إعدادات مركز النمو' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ اتصال أثناء الحفظ' };
  }
}
