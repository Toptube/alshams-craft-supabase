import { authedFetch } from '../lib/apiClient';
import {
  AudienceRole,
  MAX_SHOWCASE_POSTS,
  MemberPersonalProfile,
  ProfileVisibilityMatrix,
  ShowcasePostItem,
  normalizeVisibilityMatrix,
} from '../types/memberProfile';
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
  phone?: string;
  governorate?: string;
  visibility?: ProfileVisibilityMatrix;
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
