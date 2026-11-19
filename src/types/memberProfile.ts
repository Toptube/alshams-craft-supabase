import { ArtisanSkillLevel, TrainerEmbeddedPost } from './artisanGrowth';

export type AudienceRole = 'artisans' | 'suppliers' | 'customers';
export type MemberAccountRole = 'artisan' | 'supplier' | 'superadmin';

export const MAX_SHOWCASE_POSTS = 6;

export interface AudienceRule {
  artisans: boolean;
  suppliers: boolean;
  customers: boolean;
}

export type VisibilityFieldKey =
  | 'personalAvatar'
  | 'story'
  | 'contact'
  | 'showcase'
  | 'storeLink'
  | 'location';

export type ProfileVisibilityMatrix = Record<VisibilityFieldKey, AudienceRule>;

export interface ShowcasePostItem {
  id: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MemberPersonalProfile {
  memberId: string;
  ownerUid?: string;
  email?: string;
  accountRole: MemberAccountRole;
  displayName: string;
  brandName: string;
  familyNickname?: string;
  gender?: 'male' | 'female';
  personalAvatar?: string | null;
  brandLogo?: string | null;
  bioHeadline?: string;
  storyText?: string;
  phone?: string;
  country?: string;
  governorate?: string;
  storeSlug?: string;
  craftsLabels: string[];
  medal?: string | null;
  ratingStars?: number;
  showcasePosts: ShowcasePostItem[];
  visibility: ProfileVisibilityMatrix;
  // نظام مستوى الفنان ومنشورات الخبير والمدرب المدمجة
  skillLevel?: ArtisanSkillLevel;
  assessmentScore?: number;
  trainerVerified?: boolean;
  trainerPostLimit?: number;
  trainerPosts?: TrainerEmbeddedPost[];
  updatedAt?: string;
}

export const DEFAULT_VISIBILITY_MATRIX: ProfileVisibilityMatrix = {
  personalAvatar: { artisans: true, suppliers: true, customers: true },
  story: { artisans: true, suppliers: true, customers: true },
  contact: { artisans: true, suppliers: true, customers: true },
  showcase: { artisans: true, suppliers: true, customers: true },
  storeLink: { artisans: true, suppliers: true, customers: true },
  location: { artisans: true, suppliers: true, customers: true },
};

export function normalizeVisibilityMatrix(raw?: Partial<ProfileVisibilityMatrix> | null): ProfileVisibilityMatrix {
  const keys: VisibilityFieldKey[] = [
    'personalAvatar',
    'story',
    'contact',
    'showcase',
    'storeLink',
    'location',
  ];
  const out: any = {};
  for (const k of keys) {
    const src = (raw && raw[k]) || DEFAULT_VISIBILITY_MATRIX[k];
    out[k] = {
      artisans: src?.artisans !== false,
      suppliers: src?.suppliers !== false,
      customers: src?.customers !== false,
    };
  }
  return out as ProfileVisibilityMatrix;
}

export function isSectionVisibleToAudience(
  visibility: ProfileVisibilityMatrix,
  section: VisibilityFieldKey,
  audience: AudienceRole
): boolean {
  return visibility?.[section]?.[audience] !== false;
}

export function applyVisibilityForAudience(
  profile: MemberPersonalProfile,
  audience: AudienceRole | 'owner'
): MemberPersonalProfile {
  if (audience === 'owner') return profile;
  const v = normalizeVisibilityMatrix(profile.visibility);
  const filteredTrainerPosts = Array.isArray(profile.trainerPosts)
    ? profile.trainerPosts.filter((tp) => !tp.audience || tp.audience[audience] !== false)
    : [];
  return {
    ...profile,
    personalAvatar: v.personalAvatar[audience] ? profile.personalAvatar : null,
    storyText: v.story[audience] ? profile.storyText : '',
    bioHeadline: v.story[audience] ? profile.bioHeadline : '',
    phone: v.contact[audience] ? profile.phone : '',
    email: v.contact[audience] ? profile.email : '',
    showcasePosts: v.showcase[audience] ? profile.showcasePosts : [],
    trainerPosts: filteredTrainerPosts,
    storeSlug: v.storeLink[audience] ? profile.storeSlug : '',
    country: v.location[audience] ? profile.country : '',
    governorate: v.location[audience] ? profile.governorate : '',
  };
}
