import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  GraduationCap,
  Home,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  Phone,
  Plus,
  Save,
  Share2,
  Sparkles,
  Store,
  Trash2,
  Upload,
  User,
  Video,
  X,
  Globe,
} from 'lucide-react';
import { isUserAdmin, UserProfile } from '../../types';
import { useUserSubscription, hasFeature } from '../../types/subscriptions';
import { auditPersonalProfileOffline } from '../../services/shamousaProfileAdvisor';
import { dispatchShamousaIntent } from '../../services/shamousaMarketingAndDecision';
import {
  AudienceRole,
  AudienceRule,
  MAX_SHOWCASE_POSTS,
  MemberPersonalProfile,
  ProfileVisibilityMatrix,
  ShowcasePostItem,
  VisibilityFieldKey,
  applyVisibilityForAudience,
  normalizeVisibilityMatrix,
} from '../../types/memberProfile';
import {
  addMemberShowcasePost,
  addTrainerEmbeddedPost,
  deleteMemberShowcasePost,
  deleteTrainerEmbeddedPost,
  fetchMemberPersonalProfile,
  getCachedMemberPersonalProfile,
  resolveAudienceRoleFromUser,
  saveMemberPersonalProfile,
  syncGrowthHubConfigFromCloud,
  updateMemberShowcasePost,
} from '../../db/memberProfileService';
import {
  ArtisanSkillLevel,
  SOCIAL_PLATFORM_META,
  SocialEmbedPlatform,
  VideoOrientation,
  canLevelPublishLessons,
  detectSocialPlatform,
  getSkillLevelMeta,
} from '../../types/artisanGrowth';
import { compressImageFile } from '../../utils/imageCompressor';
import { playButtonClickSound, playErrorSound, playSuccessSound } from '../../lib/sounds';
import { ArtisanAvatar } from '../brand/BrandAssets';
import { archiveReplacedImage } from '../../services/imageRollbackService';
import { ImageRollbackBar } from '../common/ImageRollbackBar';
import { ArtisanSkillAssessment } from '../auth/ArtisanSkillAssessment';
import { EmbeddedSocialMediaCard } from '../common/EmbeddedSocialMediaCard';
import {
  usePublicLocale,
  pickLocalizedText,
  resolveBilingualLogo,
  PublicLocaleCode,
  PUBLIC_LANGUAGES,
  translateFieldsWithAI,
} from '../../lib/publicLocale';
import { PublicLocaleCurrencyBar } from '../common/PublicLocaleCurrencyBar';
import { MemberProfileTranslationFields } from '../../types/memberProfile';

interface MemberPersonalProfileViewProps {
  targetMemberId: string;
  currentUserProfile?: UserProfile | null;
  mode?: 'page' | 'modal';
  onClose?: () => void;
  onGoBack?: () => void;
  onGoHome?: () => void;
  onOpenStore?: (slug: string, role: 'artisan' | 'supplier' | 'superadmin') => void;
}

const AUDIENCE_LABELS: { key: AudienceRole; label: string }[] = [
  { key: 'artisans', label: 'فنانين' },
  { key: 'suppliers', label: 'موردين' },
  { key: 'customers', label: 'عملاء' },
];

const VISIBILITY_ROWS: { key: VisibilityFieldKey; label: string }[] = [
  { key: 'personalAvatar', label: 'الصورة الشخصية' },
  { key: 'story', label: 'القصة والنبذة' },
  { key: 'showcase', label: 'معرض الأعمال (٦ منشورات)' },
  { key: 'contact', label: 'رقم الهاتف والتواصل' },
  { key: 'storeLink', label: 'رابط المتجر العام' },
  { key: 'location', label: 'الدولة والمحافظة' },
];

export const MemberPersonalProfileView: React.FC<MemberPersonalProfileViewProps> = ({
  targetMemberId,
  currentUserProfile,
  mode = 'page',
  onClose,
  onGoBack,
  onGoHome,
  onOpenStore,
}) => {
  const callerAudience = useMemo(
    () => resolveAudienceRoleFromUser(currentUserProfile),
    [currentUserProfile]
  );

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawProfile, setRawProfile] = useState<MemberPersonalProfile | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Live preview mode for Owner ('owner' shows editor + everything, else shows filtered preview)
  const [previewAs, setPreviewAs] = useState<'owner' | AudienceRole>('owner');

  // Editable fields state (Owner only)
  const [personalAvatarDraft, setPersonalAvatarDraft] = useState<string | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [brandNameDraft, setBrandNameDraft] = useState('');
  const [bioHeadlineDraft, setBioHeadlineDraft] = useState('');
  const [storyDraft, setStoryDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [govDraft, setGovDraft] = useState('');
  const [genderDraft, setGenderDraft] = useState<'male' | 'female'>(
    currentUserProfile?.gender === 'male' ? 'male' : 'female'
  );
  const [skillLevelDraft, setSkillLevelDraft] = useState<ArtisanSkillLevel>('intermediate');
  const [assessmentScoreDraft, setAssessmentScoreDraft] = useState<number | undefined>(undefined);
  const [visibilityDraft, setVisibilityDraft] = useState<ProfileVisibilityMatrix>(() =>
    normalizeVisibilityMatrix(null)
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showLangStudio, setShowLangStudio] = useState(false);
  const [brandLogoEnDraft, setBrandLogoEnDraft] = useState<string>('');
  const [defaultLangDraft, setDefaultLangDraft] = useState<PublicLocaleCode>('ar');
  const [enabledLangsDraft, setEnabledLangsDraft] = useState<PublicLocaleCode[]>(['ar', 'en']);
  const [translationsDraft, setTranslationsDraft] = useState<
    Partial<Record<PublicLocaleCode, MemberProfileTranslationFields>>
  >({});
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [translateNotice, setTranslateNotice] = useState<string | null>(null);
  const [activeExtraLang, setActiveExtraLang] = useState<PublicLocaleCode | null>(null);

  // Showcase Post Composer & Editor
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPostImg, setNewPostImg] = useState('');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostCaptionEn, setNewPostCaptionEn] = useState('');
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [sharedShowcaseId, setSharedShowcaseId] = useState<string | null>(null);

  const [editingPost, setEditingPost] = useState<ShowcasePostItem | null>(null);
  const [editPostImg, setEditPostImg] = useState('');
  const [editPostCaption, setEditPostCaption] = useState('');
  const [editPostCaptionEn, setEditPostCaptionEn] = useState('');

  // Expert / Trainer Embedded Social Media Post Composer
  const [trainerComposerOpen, setTrainerComposerOpen] = useState(false);
  const [trainerTitle, setTrainerTitle] = useState('');
  const [trainerTitleEn, setTrainerTitleEn] = useState('');
  const [trainerDesc, setTrainerDesc] = useState('');
  const [trainerDescEn, setTrainerDescEn] = useState('');
  const [trainerUrl, setTrainerUrl] = useState('');
  const [trainerPlatform, setTrainerPlatform] = useState<SocialEmbedPlatform>('youtube');
  const [trainerVideoOrientation, setTrainerVideoOrientation] = useState<VideoOrientation>('auto');
  const [trainerDetectedMeta, setTrainerDetectedMeta] = useState<{
    orientation: 'portrait' | 'landscape' | 'square';
    aspectRatio: number;
  } | null>(null);
  const [trainerAudience, setTrainerAudience] = useState<AudienceRule>({
    artisans: true,
    suppliers: true,
    customers: true,
  });
  const [trainerPublishToFamily, setTrainerPublishToFamily] = useState(true);
  const [trainerBusy, setTrainerBusy] = useState(false);
  const [trainerError, setTrainerError] = useState<string | null>(null);
  const [trainerSuccess, setTrainerSuccess] = useState<string | null>(null);

  useEffect(() => {
    const u = trainerUrl.trim();
    if (!u || !/^https?:\/\//i.test(u)) {
      setTrainerDetectedMeta(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/utils/video-meta?url=${encodeURIComponent(u)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.success && data.orientation) {
            setTrainerDetectedMeta({
              orientation: data.orientation,
              aspectRatio: Number(data.aspectRatio) || (data.orientation === 'portrait' ? 9 / 16 : data.orientation === 'square' ? 1 : 16 / 9),
            });
          }
        })
        .catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [trainerUrl]);

  // Lightbox Modal
  const [lightboxPost, setLightboxPost] = useState<ShowcasePostItem | null>(null);

  useEffect(() => {
    let active = true;
    const applyLoadedProfile = (p: MemberPersonalProfile, ownerFlag: boolean) => {
      setRawProfile(p);
      setIsOwner(ownerFlag);
      setPreviewAs(ownerFlag ? 'owner' : callerAudience);
      setPersonalAvatarDraft(p.personalAvatar ?? null);
      setDisplayNameDraft(p.displayName || '');
      setBrandNameDraft(p.brandName || '');
      setBioHeadlineDraft(p.bioHeadline || '');
      setStoryDraft(p.storyText || '');
      setPhoneDraft(p.phone || '');
      setGovDraft(p.governorate || '');
      setGenderDraft(
        p.gender === 'male' || p.gender === 'female'
          ? p.gender
          : currentUserProfile?.gender === 'male'
          ? 'male'
          : 'female'
      );
      setSkillLevelDraft(p.skillLevel || 'intermediate');
      setAssessmentScoreDraft(p.assessmentScore);
      setVisibilityDraft(normalizeVisibilityMatrix(p.visibility));
      setBrandLogoEnDraft(p.brandLogoEn || '');
      setDefaultLangDraft((p.defaultLanguage as PublicLocaleCode) || 'ar');
      setEnabledLangsDraft(
        Array.isArray(p.enabledLanguages) && p.enabledLanguages.length > 0
          ? (p.enabledLanguages as PublicLocaleCode[])
          : ['ar', 'en']
      );
      setTranslationsDraft(p.translations || {});
    };

    // 1. Instant paint from cache if available (0ms perceived lag)
    const cached = getCachedMemberPersonalProfile(targetMemberId, 'owner');
    if (cached?.profile) {
      applyLoadedProfile(cached.profile, cached.isOwner);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setErrorMsg(null);
    syncGrowthHubConfigFromCloud().catch(() => {});

    // 2. Quiet background refresh
    fetchMemberPersonalProfile(targetMemberId, 'owner').then((res) => {
      if (!active) return;
      if (!res.success || !res.profile) {
        if (!cached?.profile) {
          setErrorMsg(res.error || 'تعذر تحميل الصفحة الشخصية');
          setRawProfile(null);
          setIsOwner(false);
        }
      } else {
        applyLoadedProfile(res.profile, Boolean(res.isOwner));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [targetMemberId, callerAudience]);

  useEffect(() => {
    if (!lightboxPost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPost(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxPost]);

  const effectiveProfile = useMemo(() => {
    if (!rawProfile) return null;
    if (isOwner && previewAs === 'owner') {
      return {
        ...rawProfile,
        displayName: displayNameDraft,
        brandName: brandNameDraft,
        bioHeadline: bioHeadlineDraft,
        storyText: storyDraft,
        phone: phoneDraft,
        governorate: govDraft,
        personalAvatar: personalAvatarDraft,
        translations: translationsDraft,
      };
    }
    const targetAudience: AudienceRole = isOwner ? (previewAs as AudienceRole) : callerAudience;
    return applyVisibilityForAudience(
      {
        ...rawProfile,
        displayName: isOwner ? displayNameDraft : rawProfile.displayName,
        brandName: isOwner ? brandNameDraft : rawProfile.brandName,
        visibility: isOwner ? visibilityDraft : rawProfile.visibility,
        personalAvatar: isOwner ? personalAvatarDraft : rawProfile.personalAvatar,
        bioHeadline: isOwner ? bioHeadlineDraft : rawProfile.bioHeadline,
        storyText: isOwner ? storyDraft : rawProfile.storyText,
        phone: isOwner ? phoneDraft : rawProfile.phone,
        governorate: isOwner ? govDraft : rawProfile.governorate,
        translations: isOwner ? translationsDraft : rawProfile.translations,
      },
      targetAudience
    );
  }, [
    rawProfile,
    isOwner,
    previewAs,
    callerAudience,
    displayNameDraft,
    brandNameDraft,
    visibilityDraft,
    personalAvatarDraft,
    bioHeadlineDraft,
    storyDraft,
    phoneDraft,
    govDraft,
    translationsDraft,
  ]);

  const handleUploadPersonalAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 320,
        maxHeight: 320,
        targetMaxKb: 55,
        initialQuality: 0.82,
      });
      const rollbackSlot = `profile_logo_${currentUserProfile?.workshopId || currentUserProfile?.id || targetMemberId || 'default'}`;
      archiveReplacedImage(
        rollbackSlot,
        'صورتي الشخصية وشعار البراند',
        personalAvatarDraft || rawProfile?.brandLogo || '',
        compressed
      );
      setPersonalAvatarDraft(compressed);
      playButtonClickSound();
    } catch {
      playErrorSound();
      setSaveFeedback({ text: 'تعذر ضغط الصورة الشخصية، يرجى اختيار صورة أخرى', isError: true });
    }
    e.target.value = '';
  };

  const handleSaveProfileDetails = async () => {
    if (!isOwner) return;
    setSavingProfile(true);
    setSaveFeedback(null);
    const res = await saveMemberPersonalProfile({
      displayName: displayNameDraft.trim(),
      brandName: brandNameDraft.trim(),
      personalAvatar: personalAvatarDraft,
      brandLogoEn: brandLogoEnDraft || null,
      bioHeadline: bioHeadlineDraft.trim(),
      storyText: storyDraft.trim(),
      phone: phoneDraft.trim(),
      governorate: govDraft.trim(),
      gender: genderDraft,
      visibility: visibilityDraft,
      skillLevel: rawProfile?.accountRole !== 'supplier' ? skillLevelDraft : undefined,
      assessmentScore: rawProfile?.accountRole !== 'supplier' ? assessmentScoreDraft : undefined,
      defaultLanguage: defaultLangDraft,
      enabledLanguages: enabledLangsDraft,
      translations: translationsDraft,
    });
    setSavingProfile(false);
    if (res.success && res.profile) {
      playSuccessSound();
      setRawProfile(res.profile);
      const syncedPhoto = res.profile.personalAvatar || res.profile.brandLogo || '';
      const resolvedSyncedArtist = res.profile.displayName || translationsDraft.en?.displayName || '';
      try {
        const rawLocal = localStorage.getItem('alshams_profile');
        if (rawLocal) {
          const parsedLocal = JSON.parse(rawLocal);
          localStorage.setItem(
            'alshams_profile',
            JSON.stringify({
              ...parsedLocal,
              ...(resolvedSyncedArtist ? { artistName: resolvedSyncedArtist } : {}),
              logoUrl: syncedPhoto || parsedLocal.logoUrl,
              logo_url: syncedPhoto || parsedLocal.logo_url,
              logoBase64: res.profile.personalAvatar || '',
              phoneNumber: res.profile.phone || parsedLocal.phoneNumber,
              governorate: res.profile.governorate ?? parsedLocal.governorate,
              gender: res.profile.gender || genderDraft,
              ...(res.profile.skillLevel ? { skillLevel: res.profile.skillLevel } : {}),
              ...(typeof res.profile.assessmentScore === 'number'
                ? { assessmentScore: res.profile.assessmentScore }
                : {}),
            })
          );
        }
      } catch {}
      window.dispatchEvent(
        new CustomEvent('alshams_profile_synced', {
          detail: {
            ...(resolvedSyncedArtist ? { artistName: resolvedSyncedArtist } : {}),
            logoUrl: syncedPhoto,
            brandName: res.profile.brandName,
            phoneNumber: res.profile.phone,
            governorate: res.profile.governorate,
            storyText: res.profile.storyText,
            bioHeadline: res.profile.bioHeadline,
            gender: res.profile.gender || genderDraft,
            skillLevel: res.profile.skillLevel,
            assessmentScore: res.profile.assessmentScore,
          },
        })
      );
      setSaveFeedback({
        text: 'تم حفظ بياناتك وصورتك الموحدة وأذونات الظهور بنجاح!',
      });
      setTimeout(() => setSaveFeedback(null), 3500);
    } else {
      playErrorSound();
      setSaveFeedback({ text: res.error || 'تعذر الحفظ', isError: true });
    }
  };

  const handleSelectPostImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'new' | 'edit'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostError(null);
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 960,
        maxHeight: 960,
        targetMaxKb: 90,
        initialQuality: 0.8,
      });
      if (target === 'new') setNewPostImg(compressed);
      else setEditPostImg(compressed);
      playButtonClickSound();
    } catch {
      playErrorSound();
      setPostError('تعذر ضغط الصورة المختارة، تأكد من صلاحية الملف.');
    }
    e.target.value = '';
  };

  const handlePublishShowcasePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawProfile || !newPostImg) return;
    if (rawProfile.showcasePosts.length >= MAX_SHOWCASE_POSTS) {
      setPostError(
        `وصلت للحد الأقصى (${MAX_SHOWCASE_POSTS} منشورات). يمكنك تعديل أو حذف منشور قديم أولاً.`
      );
      return;
    }
    setPostBusy(true);
    setPostError(null);
    const res = await addMemberShowcasePost({
      imageUrl: newPostImg,
      caption: newPostCaption.trim(),
      captionEn: newPostCaptionEn.trim() || undefined,
      ...(newPostCaptionEn.trim() ? { translations: { en: newPostCaptionEn.trim() } } : {}),
    });
    setPostBusy(false);
    if (res.success && res.showcasePosts) {
      playSuccessSound();
      setRawProfile((prev) => (prev ? { ...prev, showcasePosts: res.showcasePosts! } : prev));
      setNewPostImg('');
      setNewPostCaption('');
      setNewPostCaptionEn('');
      setIsAddOpen(false);
    } else {
      playErrorSound();
      setPostError(res.error || 'تعذر إضافة المنشور');
    }
  };

  const handleSaveEditShowcase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    setPostBusy(true);
    setPostError(null);
    const nextEn = editPostCaptionEn.trim();
    const res = await updateMemberShowcasePost(editingPost.id, {
      imageUrl: editPostImg || editingPost.imageUrl,
      caption: editPostCaption.trim(),
      captionEn: nextEn,
      translations: {
        ...(editingPost.translations || {}),
        ...(nextEn ? { en: nextEn } : {}),
      },
    });
    setPostBusy(false);
    if (res.success && res.showcasePosts) {
      playSuccessSound();
      setRawProfile((prev) => (prev ? { ...prev, showcasePosts: res.showcasePosts! } : prev));
      setEditingPost(null);
    } else {
      playErrorSound();
      setPostError(res.error || 'تعذر تحديث المنشور');
    }
  };

  const handleDeleteShowcase = async (postId: string) => {
    setPostBusy(true);
    const res = await deleteMemberShowcasePost(postId);
    setPostBusy(false);
    if (res.success && res.showcasePosts) {
      playButtonClickSound();
      setRawProfile((prev) => (prev ? { ...prev, showcasePosts: res.showcasePosts! } : prev));
      if (editingPost?.id === postId) setEditingPost(null);
      if (lightboxPost?.id === postId) setLightboxPost(null);
    }
  };

  const toggleAudienceRule = (field: VisibilityFieldKey, aud: AudienceRole) => {
    playButtonClickSound();
    setVisibilityDraft((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [aud]: !prev[field][aud],
      },
    }));
  };

  const handleDirectShareShowcasePost = async (post: ShowcasePostItem) => {
    playButtonClickSound();
    const profileUrl = effectiveProfile?.storeSlug
      ? `${window.location.origin}/?store=${encodeURIComponent(effectiveProfile.storeSlug)}`
      : window.location.href;
    const shareText = [
      `✨ منشور مميز من ${effectiveProfile?.displayName || 'مبدع في الشمساوية'}${
        effectiveProfile?.brandName ? ` (${effectiveProfile.brandName})` : ''
      }`,
      post.caption ? post.caption : '',
      `شاهد معرض الأعمال والمتجر على منظومة الشمساوية: ${profileUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: effectiveProfile?.brandName || effectiveProfile?.displayName || 'عمل من منظومة الشمساوية',
          text: shareText,
          url: profileUrl,
        });
        playSuccessSound();
        setSharedShowcaseId(post.id);
        setTimeout(() => setSharedShowcaseId(null), 2200);
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(shareText);
      playSuccessSound();
      setSharedShowcaseId(post.id);
      setTimeout(() => setSharedShowcaseId(null), 2200);
    } catch {
      setSharedShowcaseId(post.id);
      setTimeout(() => setSharedShowcaseId(null), 1800);
    }
  };

  const handlePublishTrainerPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainerTitle.trim() && !trainerTitleEn.trim()) {
      setTrainerError('يرجى كتابة عنوان الشرح بالعربي أو بالإنجليزي.');
      return;
    }
    if (!trainerUrl.trim() || !/^https?:\/\//i.test(trainerUrl.trim())) {
      setTrainerError('يرجى لصق رابط صحيح يبدأ بـ https:// (يوتيوب، فيسبوك، إنستجرام، تيك توك...).');
      return;
    }
    if (!trainerAudience.artisans && !trainerAudience.suppliers && !trainerAudience.customers) {
      setTrainerError('اختر فئة واحدة على الأقل لمشاهدة المنشور.');
      return;
    }

    setTrainerBusy(true);
    setTrainerError(null);
    setTrainerSuccess(null);

    const res = await addTrainerEmbeddedPost({
      title: trainerTitle.trim(),
      titleEn: trainerTitleEn.trim() || undefined,
      description: trainerDesc.trim(),
      descriptionEn: trainerDescEn.trim() || undefined,
      url: trainerUrl.trim(),
      platform: trainerPlatform,
      videoOrientation: trainerVideoOrientation,
      videoAspectRatio:
        trainerVideoOrientation === 'auto'
          ? trainerDetectedMeta?.aspectRatio
          : trainerVideoOrientation === 'portrait'
            ? 9 / 16
            : trainerVideoOrientation === 'square'
              ? 1
              : 16 / 9,
      audience: trainerAudience,
      publishToFamily: trainerPublishToFamily,
    });

    setTrainerBusy(false);
    if (res.success && res.trainerPosts) {
      playSuccessSound();
      setRawProfile((prev) => (prev ? { ...prev, trainerPosts: res.trainerPosts } : prev));
      setTrainerTitle('');
      setTrainerTitleEn('');
      setTrainerDesc('');
      setTrainerDescEn('');
      setTrainerUrl('');
      setTrainerVideoOrientation('auto');
      setTrainerDetectedMeta(null);
      setTrainerComposerOpen(false);
      setTrainerSuccess(
        (res.notifiedCount || 0) > 0
          ? 'تم نشر الشرح المدمج على صفحتك ونشره باسمك في منتدى العيلة (طبلية الشمساوية) مع إرسال إشعار فوري لجميع الفنانين!'
          : 'تم نشر الشرح المدمج بنجاح في صفحتك الشخصية.'
      );
      setTimeout(() => setTrainerSuccess(null), 5000);
    } else {
      playErrorSound();
      setTrainerError(res.error || 'تعذر نشر الشرح المدمج.');
    }
  };

  const handleDeleteTrainerPost = async (postId: string) => {
    setTrainerBusy(true);
    const res = await deleteTrainerEmbeddedPost(postId);
    setTrainerBusy(false);
    if (res.success && res.trainerPosts) {
      playButtonClickSound();
      setRawProfile((prev) => (prev ? { ...prev, trainerPosts: res.trainerPosts } : prev));
    }
  };

  const isEditMode = isOwner && previewAs === 'owner';
  const { locale, setLocale, dir, t } = usePublicLocale(
    effectiveProfile?.enabledLanguages,
    effectiveProfile?.defaultLanguage || 'ar'
  );
  const isEnView = locale !== 'ar';

  const updateTranslationField = (
    targetLang: PublicLocaleCode,
    field: keyof MemberProfileTranslationFields,
    value: string
  ) => {
    setTranslationsDraft((prev) => ({
      ...prev,
      [targetLang]: {
        ...(prev[targetLang] || {}),
        [field]: value,
      },
    }));
  };

  const handleAutoTranslate = async (
    busyKey: string,
    targetLang: PublicLocaleCode,
    fields: Record<string, string>,
    onResult: (translated: Record<string, string>) => void,
    sourceLang: PublicLocaleCode = 'ar'
  ) => {
    const clean: Record<string, string> = {};
    Object.entries(fields).forEach(([k, v]) => {
      if (v && v.trim()) clean[k] = v.trim();
    });
    if (Object.keys(clean).length === 0) {
      setTranslateNotice(
        sourceLang === 'en'
          ? 'اكتب النص بالإنجليزية أولاً لتتم ترجمته إلى العربية.'
          : 'اكتب النص بالعربي أولاً لتتم ترجمته تلقائياً.'
      );
      setTimeout(() => setTranslateNotice(null), 2600);
      return;
    }
    setTranslatingKey(busyKey);
    setTranslateNotice(null);
    try {
      const result = await translateFieldsWithAI(clean, targetLang, sourceLang);
      if (result.success && result.translations && Object.keys(result.translations).length > 0) {
        onResult(result.translations);
        playSuccessSound();
      } else {
        playErrorSound();
        setTranslateNotice(result.error || 'تعذرت الترجمة التلقائية حالياً، جرب مرة أخرى أو اكتبها يدوياً.');
        setTimeout(() => setTranslateNotice(null), 3500);
      }
    } catch {
      playErrorSound();
      setTranslateNotice('تعذرت الترجمة التلقائية حالياً، جرب مرة أخرى.');
      setTimeout(() => setTranslateNotice(null), 3500);
    } finally {
      setTranslatingKey(null);
    }
  };

  const handleUploadBrandLogoEn = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 320,
        maxHeight: 320,
        targetMaxKb: 55,
        initialQuality: 0.85,
      });
      setBrandLogoEnDraft(compressed);
      playSuccessSound();
    } catch {
      playErrorSound();
    }
    e.target.value = '';
  };

  const extraEnabledLanguages = useMemo<PublicLocaleCode[]>(
    () => enabledLangsDraft.filter((l) => l !== 'ar' && l !== 'en'),
    [enabledLangsDraft]
  );

  const availableExtraLanguagesToAdd = useMemo(
    () => PUBLIC_LANGUAGES.filter((l) => l.code !== 'ar' && l.code !== 'en' && !enabledLangsDraft.includes(l.code)),
    [enabledLangsDraft]
  );

  const selectedExtraLang: PublicLocaleCode | null =
    activeExtraLang && extraEnabledLanguages.includes(activeExtraLang)
      ? activeExtraLang
      : extraEnabledLanguages[0] || null;

  const pickProfileField = (
    base: string | undefined | null,
    field: keyof MemberProfileTranslationFields
  ): string => {
    const tr = isEditMode ? translationsDraft : effectiveProfile?.translations;
    const baseClean = (base || '').trim();
    if (!tr) return baseClean;
    const enVal = (tr.en?.[field] || '').trim();
    if (locale === 'ar') {
      return baseClean || enVal;
    }
    const map: Partial<Record<PublicLocaleCode, string | undefined>> = {};
    (Object.keys(tr) as PublicLocaleCode[]).forEach((k) => {
      map[k] = tr[k]?.[field];
    });
    return pickLocalizedText(baseClean || enVal, map, locale);
  };

  const localizeCountryLabel = (country?: string): string => {
    const raw = (country || '').trim();
    if (!raw || !isEnView) return raw;
    const map: Record<string, string> = {
      'مصر': 'Egypt',
      'جمهورية مصر العربية': 'Egypt',
      'السعودية': 'Saudi Arabia',
      'المملكة العربية السعودية': 'Saudi Arabia',
      'الإمارات': 'UAE',
      'الكويت': 'Kuwait',
      'قطر': 'Qatar',
      'البحرين': 'Bahrain',
      'عمان': 'Oman',
      'الأردن': 'Jordan',
      'المغرب': 'Morocco',
      'تونس': 'Tunisia',
      'الجزائر': 'Algeria',
      'لبنان': 'Lebanon',
      'العراق': 'Iraq',
    };
    return map[raw] || raw;
  };

  const pickPostCaption = (post: ShowcasePostItem): string => {
    if (locale === 'ar') return (post.caption || '').trim() || (post.captionEn || '').trim();
    const translated = post.translations?.[locale];
    if (translated && translated.trim()) return translated.trim();
    if (post.captionEn && post.captionEn.trim()) return post.captionEn.trim();
    return (post.caption || '').trim();
  };

  const displayProfileName = pickProfileField(effectiveProfile?.displayName, 'displayName');
  const displayProfileBrand = pickProfileField(effectiveProfile?.brandName, 'brandName');
  const displayProfileHeadline = pickProfileField(effectiveProfile?.bioHeadline, 'bioHeadline');
  const displayProfileGovernorate = pickProfileField(effectiveProfile?.governorate, 'governorate');
  const displayProfileStory = pickProfileField(effectiveProfile?.storyText, 'storyText');
  const displayProfileCountry = localizeCountryLabel(effectiveProfile?.country);
  const resolvedProfileBrandLogo = effectiveProfile
    ? resolveBilingualLogo(
        effectiveProfile.brandLogo,
        effectiveProfile.brandLogo,
        isEditMode ? brandLogoEnDraft || effectiveProfile.brandLogoEn : effectiveProfile.brandLogoEn,
        locale
      )
    : '';
  const postsCount = rawProfile?.showcasePosts?.length || 0;
  const atLimit = postsCount >= MAX_SHOWCASE_POSTS;
  const isExpertTrainer = canLevelPublishLessons(
    rawProfile?.skillLevel,
    rawProfile?.trainerVerified,
    rawProfile?.accountRole
  );
  const trainerPostLimit = rawProfile?.trainerPostLimit || 15;
  const trainerPostsList = effectiveProfile?.trainerPosts || [];
  const rawTrainerCount = rawProfile?.trainerPosts?.length || 0;

  // تقييم شموسة الاستباقي الأوفلاين للصفحة الشخصية (أهم حاجتين للنهاردة بحد أقصى 3 اقتراحات، مع احترام الخصوصية 100%)
  const ownerSub = useUserSubscription(currentUserProfile || undefined);
  const ownerPkgOpts = useMemo(
    () => ({
      role: ((currentUserProfile as any)?.accountRole === 'supplier' ? 'supplier' : 'artisan') as 'artisan' | 'supplier',
      isAdmin: isUserAdmin(currentUserProfile),
      overrideSub: ownerSub,
    }),
    [currentUserProfile, ownerSub]
  );
  const ownerAccountId = currentUserProfile?.id || targetMemberId;
  const canOwnerShamousa = hasFeature('shamousa', ownerAccountId, ownerPkgOpts);
  const canOwnerStorefront = hasFeature('marketing_review', ownerAccountId, ownerPkgOpts);

  const proactiveProfileAudit = useMemo(() => {
    if (!isOwner || !rawProfile || !canOwnerShamousa) return null;
    const liveProfile: MemberPersonalProfile = {
      ...rawProfile,
      displayName: displayNameDraft || rawProfile.displayName,
      brandName: brandNameDraft || rawProfile.brandName,
      bioHeadline: bioHeadlineDraft,
      storyText: storyDraft,
      personalAvatar: personalAvatarDraft,
      visibility: visibilityDraft,
    };
    return auditPersonalProfileOffline({
      profile: liveProfile,
      accountId: ownerAccountId,
      packageOptions: ownerPkgOpts,
    });
  }, [
    isOwner,
    rawProfile,
    displayNameDraft,
    brandNameDraft,
    bioHeadlineDraft,
    storyDraft,
    personalAvatarDraft,
    visibilityDraft,
    ownerAccountId,
    ownerPkgOpts,
    canOwnerShamousa,
  ]);
  const [hideProactiveCard, setHideProactiveCard] = useState(false);

  const contentNode = (
    <div
      className={`max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
      dir={dir}
    >
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              {dir === 'rtl' ? (
                <ArrowRight className="w-4 h-4 text-[#EA580C]" />
              ) : (
                <ArrowLeft className="w-4 h-4 text-[#EA580C]" />
              )}
              <span>{locale === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>
          )}
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              <Home className="w-4 h-4 text-[#EA580C]" />
              <span>{locale === 'ar' ? 'الرئيسية' : 'Home'}</span>
            </button>
          )}
          <h1 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
            {locale === 'ar'
              ? isOwner
                ? 'صفحتي الشخصية ومعرض الأعمال'
                : 'الملف الشخصي في مجتمع الشمساوية'
              : t('personal_profile')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <PublicLocaleCurrencyBar
            locale={locale}
            onChangeLocale={setLocale}
            enabledLanguages={isEditMode ? enabledLangsDraft : effectiveProfile?.enabledLanguages}
            compact
          />
          {mode === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={isEnView ? 'Close' : 'إغلاق'}
              className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer hover:border-[#EA580C]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
            {isEnView ? 'Loading profile...' : 'جاري تحميل الصفحة الشخصية...'}
          </p>
        </div>
      ) : errorMsg || !effectiveProfile || !rawProfile ? (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 p-6 text-center text-xs font-bold text-rose-700 dark:text-rose-300">
          {errorMsg || (isEnView ? 'Could not find this profile.' : 'تعذر العثور على هذا الملف الشخصي.')}
        </div>
      ) : (
        <>
          {/* Owner Audience Preview Switcher Bar */}
          {isOwner && (
            <section className="rounded-2xl bg-[#0C1427] dark:bg-[#132040] text-[#F7F3EA] p-3 sm:p-4 border border-[#22355E] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black text-[#FBBF24]">
                <Eye className="w-4 h-4 shrink-0" />
                <span>معاينة صفحتي كما تظهر للآخرين:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'owner' as const, label: 'وضع التحرير (ملكي)' },
                  { id: 'artisans' as const, label: 'كما تظهر للفنانين' },
                  { id: 'suppliers' as const, label: 'كما تظهر للموردين' },
                  { id: 'customers' as const, label: 'كما تظهر للعملاء' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      playButtonClickSound();
                      setPreviewAs(opt.id);
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer whitespace-nowrap ${
                      previewAs === opt.id
                        ? 'bg-[#EA580C] text-white'
                        : 'bg-white/10 text-[#CBD5E1] hover:bg-white/15'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* بطاقة شموسة الاستباقية للصفحة الشخصية — تظهر فقط لو شموسة مفعّلة في باقات الحساب */}
          {isOwner && previewAs === 'owner' && canOwnerShamousa && proactiveProfileAudit && !hideProactiveCard && (
            <section className="rounded-2xl bg-[#FBF7F0] dark:bg-[#0F1E42] border border-[#D5C7B0] dark:border-[#243C78] p-4 space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#142A5C] text-[#FBBF24] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        شموسة معاك النهاردة — أهم حاجتين لصفحتك ☀️
                      </h2>
                      <span className="px-2 py-0.5 rounded-lg bg-[#EAE0CE] dark:bg-[#19326E] text-[#142A5C] dark:text-[#FBBF24] text-[11px] font-black font-mono">
                        {proactiveProfileAudit.score}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-0.5">
                      فحص محلي سريع مع احترام كامل لإعدادات خصوصيتك — كل الأزرار تفتح شات شموسة الواحد.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHideProactiveCard(true)}
                  aria-label="إخفاء مؤقتاً"
                  className="p-1 rounded-lg text-[#64748B] hover:text-[#0C1427] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {proactiveProfileAudit.topTwoToday.slice(0, 2).map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#EFE6D7]/70 dark:bg-[#142859] border border-[#D5C7B0] dark:border-[#2A4585] p-3 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-black text-[#142A5C] dark:text-[#F8FAFC]">
                        {idx + 1}. {item.title}
                      </div>
                      <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        dispatchShamousaIntent({ prompt: item.intentPrompt, autoSend: true });
                      }}
                      className="self-start px-3 py-1.5 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] text-white text-[11px] font-black cursor-pointer transition"
                    >
                      {item.buttonLabel}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#E3D8C5] dark:border-[#21376E]">
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    dispatchShamousaIntent({ intent: 'decision_report', prompt: 'التحليل والحلول الذكية', autoSend: true });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#EAE0CE] hover:bg-[#142A5C] text-[#142A5C] hover:text-white dark:bg-[#183069] dark:text-[#E2E8F0] text-[11px] font-black cursor-pointer transition"
                >
                  التحليل والحلول الذكية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    dispatchShamousaIntent({ intent: 'write_post', prompt: 'اكتب لي بوست', autoSend: true });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#EAE0CE] hover:bg-[#142A5C] text-[#142A5C] hover:text-white dark:bg-[#183069] dark:text-[#E2E8F0] text-[11px] font-black cursor-pointer transition"
                >
                  اكتب لي بوست
                </button>
                {canOwnerStorefront && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        dispatchShamousaIntent({ intent: 'review_products', prompt: 'راجع منتجاتي', autoSend: true });
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#EAE0CE] hover:bg-[#142A5C] text-[#142A5C] hover:text-white dark:bg-[#183069] dark:text-[#E2E8F0] text-[11px] font-black cursor-pointer transition"
                    >
                      راجع منتجاتي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        dispatchShamousaIntent({ intent: 'whatsapp_message', prompt: 'رسالة واتساب', autoSend: true });
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#EAE0CE] hover:bg-[#142A5C] text-[#142A5C] hover:text-white dark:bg-[#183069] dark:text-[#E2E8F0] text-[11px] font-black cursor-pointer transition"
                    >
                      رسالة واتساب
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Feedback */}
          {saveFeedback && (
            <div
              className={`rounded-xl p-3 text-xs font-bold border ${
                saveFeedback.isError
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {saveFeedback.text}
            </div>
          )}

          {/* Editorial Split Hero Card */}
          <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-7 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              {/* Dual Avatars: Personal Photo + Brand Logo */}
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative shrink-0">
                  {effectiveProfile.personalAvatar ? (
                    <img
                      src={effectiveProfile.personalAvatar}
                      alt={displayProfileName}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[#EA580C]/70 bg-[#EFE9DC] dark:bg-[#132040]"
                    />
                  ) : resolvedProfileBrandLogo ? (
                    <img
                      src={resolvedProfileBrandLogo}
                      alt={displayProfileBrand}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain p-1.5 border border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC] dark:bg-[#132040]"
                    />
                  ) : (
                    <ArtisanAvatar artistName={displayProfileName} size="lg" />
                  )}

                  {resolvedProfileBrandLogo &&
                    effectiveProfile.personalAvatar &&
                    resolvedProfileBrandLogo !== effectiveProfile.personalAvatar && (
                      <img
                        src={resolvedProfileBrandLogo}
                        alt={displayProfileBrand}
                        title={displayProfileBrand}
                        className="w-9 h-9 rounded-xl object-contain bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] p-0.5 absolute -bottom-2 -left-2 shadow-sm"
                      />
                    )}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                    <span>
                      {effectiveProfile.accountRole === 'superadmin'
                        ? isEnView
                          ? 'Platform Admin · Community Lead'
                          : 'إدارة المنظومة · كبير العيلة'
                        : effectiveProfile.accountRole === 'supplier'
                        ? t('verified_supplier')
                        : locale === 'ar'
                        ? getSkillLevelMeta(
                            effectiveProfile.skillLevel || (effectiveProfile.trainerVerified ? 'expert_trainer' : 'intermediate'),
                            (effectiveProfile as any).gender || currentUserProfile?.gender
                          ).displayTitle
                        : t('verified_artisan')}
                    </span>
                    {canLevelPublishLessons(
                      effectiveProfile.skillLevel,
                      effectiveProfile.trainerVerified,
                      effectiveProfile.accountRole
                    ) && effectiveProfile.accountRole !== 'supplier' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#EA580C] text-white text-[10px] font-black">
                        <GraduationCap className="w-3 h-3" />
                        <span>
                          {isEnView
                            ? 'Expert'
                            : (effectiveProfile as any).gender === 'female'
                            ? 'خبيرة'
                            : 'خبير'}
                        </span>
                      </span>
                    )}
                    {displayProfileGovernorate || displayProfileCountry
                      ? ` · ${[displayProfileGovernorate, displayProfileCountry].filter(Boolean).join(isEnView ? ', ' : '، ')}`
                      : ''}
                    {` · ★ ${effectiveProfile.ratingStars || 5}`}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-tight">
                    {displayProfileName}
                  </h2>

                  {displayProfileBrand && (
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-[#CBD5E1]">
                      {displayProfileBrand}
                      {displayProfileHeadline ? ` — ${displayProfileHeadline}` : ''}
                    </p>
                  )}

                  {effectiveProfile.phone && (
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-mono tabular-nums font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                      <a
                        href={`tel:${effectiveProfile.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-[#EA580C]"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#EA580C]" />
                        <span dir="ltr">{effectiveProfile.phone}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons (Open Storefront) */}
              {effectiveProfile.storeSlug && onOpenStore && effectiveProfile.accountRole !== 'superadmin' && (
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenStore(effectiveProfile.storeSlug!, effectiveProfile.accountRole)
                    }
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-2 cursor-pointer transition shadow-sm whitespace-nowrap"
                  >
                    <Store className="w-4 h-4" />
                    <span>
                      {locale === 'ar'
                        ? effectiveProfile.accountRole === 'supplier'
                          ? 'زيارة متجر المورد وكتالوج الخامات'
                          : 'زيارة المتجر الإلكتروني'
                        : t('visit_store')}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Owner Photo Upload & Bio Editor */}
            {isEditMode && (
              <div className="pt-4 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition">
                    <Camera className="w-4 h-4 text-[#EA580C]" />
                    <span>
                      {personalAvatarDraft ? 'تغيير صورتي الشخصية (ضغط تلقائي)' : 'رفع صورتي الشخصية'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadPersonalAvatar}
                      className="hidden"
                    />
                  </label>

                  {personalAvatarDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        const rollbackSlot = `profile_logo_${currentUserProfile?.workshopId || currentUserProfile?.id || targetMemberId || 'default'}`;
                        archiveReplacedImage(
                          rollbackSlot,
                          'صورتي الشخصية وشعار البراند',
                          personalAvatarDraft,
                          ''
                        );
                        setPersonalAvatarDraft(null);
                      }}
                      className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      حذف الصورة الشخصية
                    </button>
                  )}

                  <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    صورتك الشخصية وشعار البراند موحدان في الحساب كله؛ أي تعديل هنا يظهر مباشرة في الإعدادات والمتجر وتُحفظ النسخة السابقة للتراجع خلال 8 ساعات فقط.
                  </span>
                </div>

                <ImageRollbackBar
                  slotKey={`profile_logo_${currentUserProfile?.workshopId || currentUserProfile?.id || targetMemberId || 'default'}`}
                  compact
                  onRestored={(prevUrl) => setPersonalAvatarDraft(prevUrl)}
                />

                {translateNotice && (
                  <div className="rounded-xl px-3 py-2 text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
                    {translateNotice}
                  </div>
                )}

                {/* الاسم والبراند (عربي + إنجليزي معاً — اختياري أيهما أو كلاهما) */}
                <div className="rounded-2xl bg-[#EFE9DC]/60 dark:bg-[#060B18]/60 border border-[#D4CCBC] dark:border-[#22355E] p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        الاسم والبراند (عربي وإنجليزي)
                      </span>
                      <span className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                        اكتب بالعربي فقط، أو بالإنجليزي فقط، أو بالاثنين معاً — والترجمة الفورية شغالة بالاتجاهين.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={translatingKey === 'identity'}
                      onClick={() => {
                        const hasAr = Boolean(displayNameDraft.trim() || brandNameDraft.trim());
                        const hasEn = Boolean(
                          translationsDraft.en?.displayName?.trim() || translationsDraft.en?.brandName?.trim()
                        );
                        if (hasAr) {
                          handleAutoTranslate(
                            'identity',
                            'en',
                            {
                              displayName: displayNameDraft,
                              brandName: brandNameDraft,
                            },
                            (res) => {
                              if (res.displayName) updateTranslationField('en', 'displayName', res.displayName);
                              if (res.brandName) updateTranslationField('en', 'brandName', res.brandName);
                            },
                            'ar'
                          );
                        } else if (hasEn) {
                          handleAutoTranslate(
                            'identity',
                            'ar',
                            {
                              displayName: translationsDraft.en?.displayName || '',
                              brandName: translationsDraft.en?.brandName || '',
                            },
                            (res) => {
                              if (res.displayName) setDisplayNameDraft(res.displayName);
                              if (res.brandName) setBrandNameDraft(res.brandName);
                            },
                            'en'
                          );
                        } else {
                          setTranslateNotice('اكتب الاسم أو البراند بالعربي أو بالإنجليزي أولاً.');
                          setTimeout(() => setTranslateNotice(null), 2600);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                    >
                      {translatingKey === 'identity' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>
                        {!displayNameDraft.trim() &&
                        !brandNameDraft.trim() &&
                        (translationsDraft.en?.displayName?.trim() || translationsDraft.en?.brandName?.trim())
                          ? 'ترجمة للعربي AR'
                          : 'ترجمة الاسم والبراند EN'}
                      </span>
                    </button>
                  </div>

                  {/* الاسم الشخصي (عربي + إنجليزي) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                        الاسم الشخصي (عربي)
                      </label>
                      <input
                        type="text"
                        value={displayNameDraft}
                        onChange={(e) => setDisplayNameDraft(e.target.value)}
                        placeholder="مثال: سارة محمود"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                        الاسم الشخصي (English)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={translationsDraft.en?.displayName || ''}
                        onChange={(e) => updateTranslationField('en', 'displayName', e.target.value)}
                        placeholder="e.g. Sara Mahmoud"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                      />
                    </div>
                  </div>

                  {/* اسم البراند / الورشة (عربي + إنجليزي) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA] mb-1">
                        اسم البراند / الورشة (عربي)
                      </label>
                      <input
                        type="text"
                        value={brandNameDraft}
                        onChange={(e) => setBrandNameDraft(e.target.value)}
                        placeholder="مثال: ورشة الشمس للمكرمية"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                        اسم البراند / الورشة (English)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={translationsDraft.en?.brandName || ''}
                        onChange={(e) => updateTranslationField('en', 'brandName', e.target.value)}
                        placeholder="e.g. Al-Shams Macrame Studio"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                      />
                    </div>
                  </div>
                </div>

                {/* الوصف المهني المختصر (عربي + إنجليزي مقترن مباشرة) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">الوصف المهني المختصر (عربي)</label>
                    <input
                      type="text"
                      value={bioHeadlineDraft}
                      onChange={(e) => setBioHeadlineDraft(e.target.value)}
                      placeholder="مثال: متخصص مكرمية جدارية وخيوط قطن طبيعي"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
                        الوصف المهني بالإنجليزية (EN)
                      </label>
                      <button
                        type="button"
                        disabled={translatingKey === 'bio'}
                        onClick={() => {
                          if (bioHeadlineDraft.trim()) {
                            handleAutoTranslate('bio', 'en', { bioHeadline: bioHeadlineDraft }, (res) => {
                              if (res.bioHeadline) updateTranslationField('en', 'bioHeadline', res.bioHeadline);
                            }, 'ar');
                          } else {
                            handleAutoTranslate(
                              'bio',
                              'ar',
                              { bioHeadline: translationsDraft.en?.bioHeadline || '' },
                              (res) => {
                                if (res.bioHeadline) setBioHeadlineDraft(res.bioHeadline);
                              },
                              'en'
                            );
                          }
                        }}
                        className="px-2 py-0.5 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[10px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                      >
                        {translatingKey === 'bio' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>
                          {!bioHeadlineDraft.trim() && translationsDraft.en?.bioHeadline?.trim()
                            ? 'ترجمة عربي'
                            : 'ترجمة EN'}
                        </span>
                      </button>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={translationsDraft.en?.bioHeadline || ''}
                      onChange={(e) => updateTranslationField('en', 'bioHeadline', e.target.value)}
                      placeholder="e.g. Handmade macrame wall art & natural cotton studio"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                    />
                  </div>
                </div>

                {/* رقم الهاتف + المحافظة (عربي + إنجليزي) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">رقم الهاتف للتواصل</label>
                    <input
                      type="tel"
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">المحافظة / المدينة (عربي)</label>
                    <input
                      type="text"
                      value={govDraft}
                      onChange={(e) => setGovDraft(e.target.value)}
                      placeholder="القاهرة / الإسكندرية..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
                        المدينة بالإنجليزية (EN)
                      </label>
                      <button
                        type="button"
                        disabled={translatingKey === 'gov'}
                        onClick={() => {
                          if (govDraft.trim()) {
                            handleAutoTranslate('gov', 'en', { governorate: govDraft }, (res) => {
                              if (res.governorate) updateTranslationField('en', 'governorate', res.governorate);
                            }, 'ar');
                          } else {
                            handleAutoTranslate(
                              'gov',
                              'ar',
                              { governorate: translationsDraft.en?.governorate || '' },
                              (res) => {
                                if (res.governorate) setGovDraft(res.governorate);
                              },
                              'en'
                            );
                          }
                        }}
                        className="px-2 py-0.5 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[10px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                      >
                        {translatingKey === 'gov' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>
                          {!govDraft.trim() && translationsDraft.en?.governorate?.trim()
                            ? 'ترجمة عربي'
                            : 'ترجمة EN'}
                        </span>
                      </button>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={translationsDraft.en?.governorate || ''}
                      onChange={(e) => updateTranslationField('en', 'governorate', e.target.value)}
                      placeholder="Cairo / Alexandria..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                    />
                  </div>
                </div>

                {/* قصتي وبدايتي (عربي + إنجليزي مقترن مباشرة) */}
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      قصتي وبدايتي في الشغل (النبذة التعريفية بالعربي)
                    </label>
                    <textarea
                      rows={3}
                      maxLength={1800}
                      value={storyDraft}
                      onChange={(e) => setStoryDraft(e.target.value)}
                      placeholder="اكتب حكايتك مع حرفتك أو خبرتك في توفير الخامات، جودتك، وما يميز أعمالك..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm leading-relaxed"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
                        قصتي بالإنجليزية (Story in English)
                      </label>
                      <button
                        type="button"
                        disabled={translatingKey === 'story'}
                        onClick={() => {
                          if (storyDraft.trim()) {
                            handleAutoTranslate('story', 'en', { storyText: storyDraft }, (res) => {
                              if (res.storyText) updateTranslationField('en', 'storyText', res.storyText);
                            }, 'ar');
                          } else {
                            handleAutoTranslate(
                              'story',
                              'ar',
                              { storyText: translationsDraft.en?.storyText || '' },
                              (res) => {
                                if (res.storyText) setStoryDraft(res.storyText);
                              },
                              'en'
                            );
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                      >
                        {translatingKey === 'story' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>
                          {!storyDraft.trim() && translationsDraft.en?.storyText?.trim()
                            ? 'ترجمة القصة عربي'
                            : 'ترجمة القصة EN'}
                        </span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={1800}
                      dir="ltr"
                      value={translationsDraft.en?.storyText || ''}
                      onChange={(e) => updateTranslationField('en', 'storyText', e.target.value)}
                      placeholder="Write your craft story and studio background in English..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs sm:text-sm leading-relaxed text-left"
                    />
                  </div>
                </div>

                {/* النوع / صفة المخاطبة (فنان / فنانة) */}
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    {rawProfile.accountRole === 'supplier'
                      ? 'النوع / صفة المخاطبة (مورد / موردة)'
                      : 'النوع / صفة المخاطبة (فنان / فنانة)'}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setGenderDraft('female')}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        genderDraft === 'female'
                          ? 'bg-[#EA580C]/12 dark:bg-[#FBBF24]/15 border-[#EA580C] dark:border-[#FBBF24] text-[#0C1427] dark:text-[#F7F3EA]'
                          : 'bg-white dark:bg-[#060B18] border-[#D4CCBC] dark:border-[#22355E] text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {genderDraft === 'female' && <CheckCircle2 className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />}
                      <span>{rawProfile.accountRole === 'supplier' ? 'موردة (أستاذة)' : 'فنانة (مبدعة)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenderDraft('male')}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        genderDraft === 'male'
                          ? 'bg-[#EA580C]/12 dark:bg-[#FBBF24]/15 border-[#EA580C] dark:border-[#FBBF24] text-[#0C1427] dark:text-[#F7F3EA]'
                          : 'bg-white dark:bg-[#060B18] border-[#D4CCBC] dark:border-[#22355E] text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {genderDraft === 'male' && <CheckCircle2 className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24]" />}
                      <span>{rawProfile.accountRole === 'supplier' ? 'مورد (أستاذ)' : 'فنان (مبدع)'}</span>
                    </button>
                  </div>
                </div>

                {/* Artisan Skill Level Assessment (Non-suppliers) */}
                {rawProfile.accountRole !== 'supplier' && (
                  <ArtisanSkillAssessment
                    value={skillLevelDraft}
                    gender={genderDraft}
                    onChange={(lvl, score) => {
                      setSkillLevelDraft(lvl);
                      if (typeof score === 'number') setAssessmentScoreDraft(score);
                    }}
                    compact
                  />
                )}

                {/* Granular Visibility Matrix */}
                <div className="rounded-2xl bg-[#EFE9DC]/75 dark:bg-[#060B18]/70 border border-[#D4CCBC] dark:border-[#22355E] p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#EA580C]" />
                      <span>أذونات الظهور لكل فئة (تحكم كامل فيما يراه الآخرون في صفحتك)</span>
                    </h3>
                  </div>

                  <div className="divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
                    {VISIBILITY_ROWS.map((row) => (
                      <div
                        key={row.key}
                        className="py-2 flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                          {row.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {AUDIENCE_LABELS.map((aud) => {
                            const active = visibilityDraft[row.key]?.[aud.key] !== false;
                            return (
                              <button
                                key={aud.key}
                                type="button"
                                onClick={() => toggleAudienceRule(row.key, aud.key)}
                                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-black border flex items-center gap-1 cursor-pointer transition ${
                                  active
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-[#F7F3EA] dark:bg-[#132040] text-[#64748B] dark:text-[#94A3B8] border-[#D4CCBC] dark:border-[#22355E]'
                                }`}
                              >
                                {active ? (
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <EyeOff className="w-3 h-3" />
                                )}
                                <span>{aud.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ترجمات إضافية فقط (بدون تكرار العربي أو الإنجليزي) + الشعار الإنجليزي */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setShowLangStudio((v) => !v)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center justify-between cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2 text-[#0C1427] dark:text-[#F7F3EA]">
                      <Globe className="w-4 h-4 text-[#EA580C]" />
                      <span>
                        ترجمات إضافية والشعار الإنجليزي
                        {extraEnabledLanguages.length > 0 ? ` (${extraEnabledLanguages.length} لغات إضافية)` : ''}
                      </span>
                    </span>
                    <span className="text-[11px] text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1">
                      <span>{showLangStudio ? 'إخفاء' : 'فتح'}</span>
                      {showLangStudio ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showLangStudio && (
                    <div className="rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#060B18]/75 border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
                      {/* الشعار الإنجليزي + اللغة الافتراضية */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[#D4CCBC]/70 dark:border-[#22355E]">
                        <div className="space-y-1.5">
                          <span className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            شعار البراند الإنجليزي (اختياري للزوار الأجانب)
                          </span>
                          <div className="flex items-center gap-2.5">
                            {brandLogoEnDraft && (
                              <img
                                src={brandLogoEnDraft}
                                alt="EN Logo"
                                className="w-11 h-11 rounded-xl object-contain bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-1 shrink-0"
                              />
                            )}
                            <label className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[11px] font-black flex items-center gap-1.5 cursor-pointer">
                              <Upload className="w-3.5 h-3.5 text-[#EA580C]" />
                              <span>{brandLogoEnDraft ? 'تغيير الشعار الإنجليزي' : 'رفع شعار إنجليزي'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleUploadBrandLogoEn}
                                className="hidden"
                              />
                            </label>
                            {brandLogoEnDraft && (
                              <button
                                type="button"
                                onClick={() => setBrandLogoEnDraft('')}
                                className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            اللغة الافتراضية لصفحتك الشخصية
                          </label>
                          <select
                            value={defaultLangDraft}
                            onChange={(e) => setDefaultLangDraft(e.target.value as PublicLocaleCode)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                          >
                            {enabledLangsDraft.map((code) => {
                              const info = PUBLIC_LANGUAGES.find((l) => l.code === code);
                              return (
                                <option key={code} value={code}>
                                  {info ? `${info.flag} ${info.nativeName}` : code.toUpperCase()}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>

                      {/* إضافة وإدارة لغات إضافية فقط (غير العربي والإنجليزي) */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            لغات إضافية بجانب العربي والإنجليزي
                          </span>
                          {availableExtraLanguagesToAdd.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const code = e.target.value as PublicLocaleCode;
                                if (!code) return;
                                setEnabledLangsDraft((prev) => (prev.includes(code) ? prev : [...prev, code]));
                                setActiveExtraLang(code);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black cursor-pointer"
                            >
                              <option value="">+ إضافة لغة إضافية...</option>
                              {availableExtraLanguagesToAdd.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                  {lang.flag} {lang.nativeName}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {extraEnabledLanguages.length === 0 ? (
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            العربية والإنجليزية مفعّلتان ومقترنتان مباشرة بكل حقل بالأعلى. اختر لغة إضافية من القائمة لو حابب تستهدف عملاء في أوروبا أو تركيا (مثل الهولندية، التركية، الفرنسية...).
                          </p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {extraEnabledLanguages.map((code) => {
                                const info = PUBLIC_LANGUAGES.find((l) => l.code === code);
                                const active = selectedExtraLang === code;
                                return (
                                  <div
                                    key={code}
                                    className={`inline-flex items-center gap-1 rounded-xl border text-[11px] font-black overflow-hidden ${
                                      active
                                        ? 'bg-[#EA580C] text-white border-[#EA580C]'
                                        : 'bg-white dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E]'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setActiveExtraLang(code)}
                                      className="px-2.5 py-1.5 cursor-pointer"
                                    >
                                      {info?.flag} {info?.nativeName || code.toUpperCase()}
                                    </button>
                                    <button
                                      type="button"
                                      title="إزالة اللغة"
                                      onClick={() => {
                                        setEnabledLangsDraft((prev) => prev.filter((c) => c !== code));
                                        if (defaultLangDraft === code) setDefaultLangDraft('ar');
                                      }}
                                      className="px-1.5 py-1.5 hover:bg-black/15 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {selectedExtraLang && (() => {
                              const extraInfo = PUBLIC_LANGUAGES.find((l) => l.code === selectedExtraLang);
                              const extraValues = translationsDraft[selectedExtraLang] || {};
                              const busyKey = `extra:${selectedExtraLang}`;
                              return (
                                <div className="rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                                      {extraInfo?.flag} حقول اللغة {extraInfo?.nativeName}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={translatingKey === busyKey}
                                      onClick={() =>
                                        handleAutoTranslate(
                                          busyKey,
                                          selectedExtraLang,
                                          {
                                            displayName: rawProfile.displayName || '',
                                            brandName: rawProfile.brandName || '',
                                            bioHeadline: bioHeadlineDraft || '',
                                            governorate: govDraft || '',
                                            storyText: storyDraft || '',
                                          },
                                          (res) => {
                                            setTranslationsDraft((prev) => ({
                                              ...prev,
                                              [selectedExtraLang]: {
                                                ...(prev[selectedExtraLang] || {}),
                                                ...res,
                                              },
                                            }));
                                          }
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                      {translatingKey === busyKey ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3.5 h-3.5" />
                                      )}
                                      <span>ترجمة كل الحقول إلى {extraInfo?.nativeName}</span>
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    <input
                                      type="text"
                                      dir="ltr"
                                      value={extraValues.displayName || ''}
                                      onChange={(e) => updateTranslationField(selectedExtraLang, 'displayName', e.target.value)}
                                      placeholder="Display Name"
                                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA]/50 dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                                    />
                                    <input
                                      type="text"
                                      dir="ltr"
                                      value={extraValues.brandName || ''}
                                      onChange={(e) => updateTranslationField(selectedExtraLang, 'brandName', e.target.value)}
                                      placeholder="Brand / Studio Name"
                                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA]/50 dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                                    />
                                    <input
                                      type="text"
                                      dir="ltr"
                                      value={extraValues.bioHeadline || ''}
                                      onChange={(e) => updateTranslationField(selectedExtraLang, 'bioHeadline', e.target.value)}
                                      placeholder="Short Bio Headline"
                                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA]/50 dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                                    />
                                    <input
                                      type="text"
                                      dir="ltr"
                                      value={extraValues.governorate || ''}
                                      onChange={(e) => updateTranslationField(selectedExtraLang, 'governorate', e.target.value)}
                                      placeholder="City / Governorate"
                                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA]/50 dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                                    />
                                  </div>
                                  <textarea
                                    rows={3}
                                    dir="ltr"
                                    value={extraValues.storyText || ''}
                                    onChange={(e) => updateTranslationField(selectedExtraLang, 'storyText', e.target.value)}
                                    placeholder="About / Craft Story..."
                                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA]/50 dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs leading-relaxed text-left"
                                  />
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={handleSaveProfileDetails}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingProfile ? 'جاري الحفظ...' : 'حفظ بياناتي وأذونات الظهور'}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Story Section (Visitor / Preview view) */}
          {!isEditMode && displayProfileStory && (
            <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-2">
              <h3 className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>
                  {locale === 'ar'
                    ? effectiveProfile.accountRole === 'supplier'
                      ? 'نبذة عن المورد وخبرته في الخامات'
                      : 'قصة الفنان ورحلة الإبداع'
                    : t('about_story')}
                </span>
              </h3>
              <p className="text-sm leading-relaxed text-[#0C1427] dark:text-[#F7F3EA] whitespace-pre-wrap">
                {displayProfileStory}
              </p>
            </section>
          )}

          {/* Showcase Gallery Section (Max 6 Mini-Posts) */}
          <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#EA580C]" />
                  <span>{locale === 'ar' ? 'معرض الأعمال والمنشورات المميزة' : t('showcase_works')}</span>
                </h3>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-0.5">
                  {isEnView
                    ? 'Curated handmade portfolio highlights synced directly with the public storefront'
                    : 'صور وقصص أعمال مميزة مضغوطة تلقائياً ومتزامنة مع واجهة المتجر العام'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="font-mono tabular-nums text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                  {isEditMode ? postsCount : effectiveProfile.showcasePosts.length} /{' '}
                  {MAX_SHOWCASE_POSTS} {isEnView ? 'Posts' : 'منشورات'}
                </span>

                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      playButtonClickSound();
                      setIsAddOpen((prev) => !prev);
                      setPostError(null);
                    }}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة منشور عمل</span>
                  </button>
                )}
              </div>
            </div>

            {/* Max-6 Limit Notice */}
            {isEditMode && atLimit && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-3 text-xs font-bold text-amber-900 dark:text-amber-200">
                وصلت للحد الأقصى المسموح به ({MAX_SHOWCASE_POSTS} منشورات في المعرض) للحفاظ على خفة وسرعة قاعدة البيانات. يمكنك تعديل أو حذف أي منشور حالي لاستبداله بمنشور جديد.
              </div>
            )}

            {/* New Showcase Post Form */}
            {isEditMode && isAddOpen && !atLimit && (
              <form
                onSubmit={handlePublishShowcasePost}
                className="p-4 rounded-2xl bg-[#EFE9DC]/85 dark:bg-[#060B18] border border-dashed border-[#EA580C] space-y-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <label className="min-h-[40px] px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span>{newPostImg ? 'تغيير صورة العمل ✓' : 'اختيار صورة العمل *'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSelectPostImage(e, 'new')}
                      className="hidden"
                    />
                  </label>
                  {newPostImg && (
                    <img
                      src={newPostImg}
                      alt="معاينة"
                      className="w-16 h-16 rounded-xl object-cover border border-[#D4CCBC]"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                    وصف العمل بالعربي (أو اكتب بالإنجليزي فقط أدناه)
                  </span>
                  <textarea
                    rows={2}
                    maxLength={600}
                    value={newPostCaption}
                    onChange={(e) => setNewPostCaption(e.target.value)}
                    placeholder="اكتب قصة هذا العمل أو تفاصيل الخامة المستخدمة بالعربي..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      وصف العمل بالإنجليزية (EN)
                    </span>
                    <button
                      type="button"
                      disabled={translatingKey === 'newPost'}
                      onClick={() => {
                        if (newPostCaption.trim()) {
                          handleAutoTranslate('newPost', 'en', { caption: newPostCaption }, (res) => {
                            if (res.caption) setNewPostCaptionEn(res.caption);
                          }, 'ar');
                        } else {
                          handleAutoTranslate('newPost', 'ar', { caption: newPostCaptionEn }, (res) => {
                            if (res.caption) setNewPostCaption(res.caption);
                          }, 'en');
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[10px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                    >
                      {translatingKey === 'newPost' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{!newPostCaption.trim() && newPostCaptionEn.trim() ? 'ترجمة عربي' : 'ترجمة EN'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={600}
                    dir="ltr"
                    value={newPostCaptionEn}
                    onChange={(e) => setNewPostCaptionEn(e.target.value)}
                    placeholder="Write English caption for international visitors..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-left"
                  />
                </div>

                {postError && (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{postError}</p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={postBusy || !newPostImg}
                    className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black disabled:opacity-50 cursor-pointer"
                  >
                    {postBusy ? 'جاري النشر...' : 'نشر في معرض أعمالي'}
                  </button>
                </div>
              </form>
            )}

            {/* Edit Showcase Post Modal-inline */}
            {isEditMode && editingPost && (
              <form
                onSubmit={handleSaveEditShowcase}
                className="p-4 rounded-2xl bg-[#EFE9DC] dark:bg-[#060B18] border border-[#EA580C] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                    تعديل المنشور (سيستبدل الصورة والنص القديم مباشرة دون ترك نسخ)
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={editPostImg || editingPost.imageUrl}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover border border-[#D4CCBC]"
                  />
                  <label className="px-3.5 py-2 rounded-xl bg-[#0C1427] text-white text-xs font-black cursor-pointer">
                    <span>استبدال الصورة بأخرى</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSelectPostImage(e, 'edit')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                    وصف العمل بالعربي
                  </span>
                  <textarea
                    rows={2}
                    maxLength={600}
                    value={editPostCaption}
                    onChange={(e) => setEditPostCaption(e.target.value)}
                    placeholder="وصف العمل بالعربي"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                      وصف العمل بالإنجليزية (EN)
                    </span>
                    <button
                      type="button"
                      disabled={translatingKey === 'editPost'}
                      onClick={() => {
                        if (editPostCaption.trim()) {
                          handleAutoTranslate('editPost', 'en', { caption: editPostCaption }, (res) => {
                            if (res.caption) setEditPostCaptionEn(res.caption);
                          }, 'ar');
                        } else {
                          handleAutoTranslate('editPost', 'ar', { caption: editPostCaptionEn }, (res) => {
                            if (res.caption) setEditPostCaption(res.caption);
                          }, 'en');
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[10px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                    >
                      {translatingKey === 'editPost' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{!editPostCaption.trim() && editPostCaptionEn.trim() ? 'ترجمة عربي' : 'ترجمة EN'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={600}
                    dir="ltr"
                    value={editPostCaptionEn}
                    onChange={(e) => setEditPostCaptionEn(e.target.value)}
                    placeholder="English caption..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs text-left"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#D4CCBC] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={postBusy}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer"
                  >
                    {postBusy ? 'جاري التحديث...' : 'حفظ التعديل ✓'}
                  </button>
                </div>
              </form>
            )}

            {/* Posts Bento Grid */}
            {effectiveProfile.showcasePosts.length === 0 ? (
              <div className="py-10 text-center space-y-2 text-xs text-[#475569] dark:text-[#94A3B8]">
                <User className="w-8 h-8 mx-auto opacity-50" />
                <p className="font-bold">
                  {isEditMode
                    ? 'معرضك فارغ الآن — أضف أول صورة وقصة لأفضل أعمالك (بحد أقصى 6 منشورات).'
                    : isEnView
                    ? 'No portfolio highlights are visible in this view yet.'
                    : 'لا توجد منشورات أعمال ظاهرة في هذا العرض.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {effectiveProfile.showcasePosts.map((post) => {
                  const localizedCaption = pickPostCaption(post);
                  return (
                    <article
                      key={post.id}
                      className="rounded-2xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex flex-col justify-between group"
                    >
                      <button
                        type="button"
                        onClick={() => setLightboxPost(post)}
                        className={`relative w-full aspect-[4/3] overflow-hidden bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer block ${
                          dir === 'rtl' ? 'text-right' : 'text-left'
                        }`}
                      >
                        <img
                          src={post.imageUrl}
                          alt={localizedCaption || (isEnView ? 'Featured artwork' : 'عمل مميز')}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      </button>

                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                        <p className="text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] leading-relaxed whitespace-pre-wrap">
                          {localizedCaption || (isEnView ? 'Handcrafted showcase piece' : 'عمل فني مميز')}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E]/70">
                          <span className="text-[10px] font-mono tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                            {new Date(post.createdAt).toLocaleDateString(isEnView ? 'en-US' : 'ar-EG', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDirectShareShowcasePost(post)}
                              title={isEnView ? 'Share post' : 'مشاركة المنشور مباشرة'}
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition ${
                                sharedShowcaseId === post.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] hover:bg-[#EA580C] hover:text-white'
                              }`}
                            >
                              {sharedShowcaseId === post.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>{isEnView ? 'Copied' : 'تم النسخ'}</span>
                                </>
                              ) : (
                                <>
                                  <Share2 className="w-3 h-3" />
                                  <span>{isEnView ? 'Share' : 'مشاركة'}</span>
                                </>
                              )}
                            </button>

                            {isEditMode && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPost(post);
                                    setEditPostImg(post.imageUrl);
                                    setEditPostCaption(post.caption || '');
                                    setEditPostCaptionEn(post.captionEn || post.translations?.en || '');
                                  }}
                                  title="تعديل"
                                  className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] hover:bg-[#EA580C] hover:text-white cursor-pointer transition"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={postBusy}
                                  onClick={() => handleDeleteShowcase(post.id)}
                                  title="حذف نهائي من قاعدة البيانات"
                                  className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white cursor-pointer transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Expert / Trainer Embedded Social Media Lessons Section (Beyond 6 Photos) */}
          {(isExpertTrainer || trainerPostsList.length > 0 || (isEditMode && rawProfile.accountRole !== 'supplier')) && (
            <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C]/35 dark:border-[#FBBF24]/30 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
                    <span>
                      {isEnView
                        ? 'Expert Video Lessons & Tutorials'
                        : `مكتبة شروحات ودروس ${
                            (effectiveProfile as any)?.gender === 'female' ? 'الخبيرة' : 'الخبير'
                          } (عرض داخلي مباشر)`}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                    {isEnView
                      ? 'Embedded educational videos and craft tutorials playable directly inside the platform.'
                      : 'فيديوهات ومنشورات تعليمية مدمجة من يوتيوب وفيسبوك وإنستجرام وتيك توك تُشغّل داخل المنظومة مباشرة دون مغادرتها.'}
                  </p>
                </div>

                {isExpertTrainer && (
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono tabular-nums text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                      {rawTrainerCount} / {trainerPostLimit} {isEnView ? 'Lessons' : 'شرح'}
                    </span>
                    {isEditMode && (
                      <button
                        type="button"
                        disabled={rawTrainerCount >= trainerPostLimit}
                        onClick={() => {
                          playButtonClickSound();
                          setTrainerComposerOpen((p) => !p);
                          setTrainerError(null);
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Video className="w-4 h-4" />
                        <span>{trainerComposerOpen ? 'إغلاق مربع الشرح' : 'إضافة رابط شرح مدمج'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isExpertTrainer && isEditMode && rawProfile.accountRole !== 'supplier' && (
                <div className="rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      هل أنت {genderDraft === 'female' ? 'خبيرة' : 'خبير'} في حرفتك؟ افتح منشورات الشرح المدمجة الآن!
                    </div>
                    <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      اختر مستوى «{genderDraft === 'female' ? 'خبيرة' : 'خبير'}» من بطاقة تحديد المستوى بالأعلى واضغط «حفظ بياناتي» لفتح النشر المباشر للروابط المدمجة مع إرسال إشعارات تلقائية لجميع الفنانين في طبلية العيلة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSkillLevelDraft('expert_trainer');
                      playButtonClickSound();
                      window.scrollTo({ top: 320, behavior: 'smooth' });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                  >
                    اختيار مستوى «{genderDraft === 'female' ? 'خبيرة' : 'خبير'}»
                  </button>
                </div>
              )}

              {trainerSuccess && (
                <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-400/60 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-2">
                  <Bell className="w-4 h-4 shrink-0" />
                  <span>{trainerSuccess}</span>
                </div>
              )}

              {/* Embedded Trainer Post Dialog Composer (Inside Post Box - Link Only, No Photos) */}
              {isEditMode && isExpertTrainer && trainerComposerOpen && (
                <form
                  onSubmit={handlePublishTrainerPost}
                  className="p-4 sm:p-5 rounded-2xl bg-[#EFE9DC]/90 dark:bg-[#060B18] border-2 border-dashed border-[#EA580C] space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-2.5">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#C2410C] dark:text-[#FBBF24]">
                      <Link2 className="w-4 h-4" />
                      <span>مربع إضافة شرح / بوست مدمج (بدون رفع صور — رابط مباشر يُشغّل داخل المنظومة)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTrainerComposerOpen(false)}
                      className="p-1 rounded-lg hover:bg-black/10 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                        رابط الفيديو أو المنشور (يُكتشف تلقائياً) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        required
                        dir="ltr"
                        value={trainerUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTrainerUrl(val);
                          if (val.trim().length > 8) {
                            setTrainerPlatform(detectSocialPlatform(val));
                          }
                        }}
                        placeholder="https://www.youtube.com/watch?v=... أو رابط فيسبوك/إنستجرام/تيك توك"
                        className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono text-left"
                      />
                    </div>

                    {/* عنوان الفيديو / الشرح (عربي + إنجليزي) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                          عنوان الشرح أو الفيديو (عربي)
                        </label>
                        <input
                          type="text"
                          maxLength={140}
                          value={trainerTitle}
                          onChange={(e) => setTrainerTitle(e.target.value)}
                          placeholder="مثال: سر تسعير جدارية المكرمية الكبيرة بدون خسارة"
                          className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="block text-xs font-black text-[#475569] dark:text-[#CBD5E1]">
                            عنوان الفيديو بالإنجليزية (EN)
                          </label>
                          <button
                            type="button"
                            disabled={translatingKey === 'trainerTitle'}
                            onClick={() => {
                              if (trainerTitle.trim()) {
                                handleAutoTranslate('trainerTitle', 'en', { title: trainerTitle }, (res) => {
                                  if (res.title) setTrainerTitleEn(res.title);
                                }, 'ar');
                              } else {
                                handleAutoTranslate('trainerTitle', 'ar', { title: trainerTitleEn }, (res) => {
                                  if (res.title) setTrainerTitle(res.title);
                                }, 'en');
                              }
                            }}
                            className="px-2 py-0.5 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[10px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                          >
                            {translatingKey === 'trainerTitle' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            <span>{!trainerTitle.trim() && trainerTitleEn.trim() ? 'ترجمة عربي' : 'ترجمة EN'}</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={140}
                          dir="ltr"
                          value={trainerTitleEn}
                          onChange={(e) => setTrainerTitleEn(e.target.value)}
                          placeholder="e.g. How to price large macrame wall art profitably"
                          className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-left"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Platform Selector Buttons */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      اختر المنصة التابع لها الرابط:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(SOCIAL_PLATFORM_META) as SocialEmbedPlatform[]).map((plat) => {
                        const meta = SOCIAL_PLATFORM_META[plat];
                        const selected = trainerPlatform === plat;
                        return (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => setTrainerPlatform(plat)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                              selected
                                ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-[#0C1427] dark:border-[#EA580C]'
                                : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Video Natural Aspect Ratio Selector (Auto-detects Portrait/Landscape/Square!) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      اتجاه ومقاس عرض الفيديو:
                      {trainerDetectedMeta && trainerVideoOrientation === 'auto' && (
                        <span className="mr-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          ✓ تم اكتشافه تلقائياً:{' '}
                          {trainerDetectedMeta.orientation === 'portrait'
                            ? 'طولي (9:16)'
                            : trainerDetectedMeta.orientation === 'square'
                              ? 'مربع (1:1)'
                              : 'عرضي (16:9)'}
                        </span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'auto', label: 'تلقائي حسب الفيديو الأصلي' },
                          { id: 'portrait', label: 'طولي (9:16)' },
                          { id: 'landscape', label: 'عرضي (16:9)' },
                          { id: 'square', label: 'مربع (1:1)' },
                        ] as Array<{ id: VideoOrientation; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTrainerVideoOrientation(opt.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                            trainerVideoOrientation === opt.id
                              ? 'bg-[#EA580C] text-white border-[#EA580C]'
                              : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                        ملخص الشرح أو الملاحظات المرفقة (عربي)
                      </label>
                      <textarea
                        rows={2}
                        maxLength={900}
                        value={trainerDesc}
                        onChange={(e) => setTrainerDesc(e.target.value)}
                        placeholder="اكتب أهم النقاط التي سيتعلمها الفنانون من هذا الشرح..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs leading-relaxed"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="block text-xs font-black text-[#475569] dark:text-[#CBD5E1]">
                          ملخص الشرح بالإنجليزية (EN)
                        </label>
                        <button
                          type="button"
                          disabled={translatingKey === 'trainerDesc'}
                          onClick={() => {
                            if (trainerDesc.trim()) {
                              handleAutoTranslate('trainerDesc', 'en', { description: trainerDesc }, (res) => {
                                if (res.description) setTrainerDescEn(res.description);
                              }, 'ar');
                            } else {
                              handleAutoTranslate('trainerDesc', 'ar', { description: trainerDescEn }, (res) => {
                                if (res.description) setTrainerDesc(res.description);
                              }, 'en');
                            }
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#EA580C]/10 hover:bg-[#EA580C] text-[#C2410C] dark:text-[#FBBF24] hover:text-white text-[10px] font-black flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                        >
                          {translatingKey === 'trainerDesc' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>{!trainerDesc.trim() && trainerDescEn.trim() ? 'ترجمة عربي' : 'ترجمة EN'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={900}
                        dir="ltr"
                        value={trainerDescEn}
                        onChange={(e) => setTrainerDescEn(e.target.value)}
                        placeholder="Key takeaways and tutorial notes in English..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs leading-relaxed text-left"
                      />
                    </div>
                  </div>

                  {/* Who Can See This Post? */}
                  <div className="rounded-xl bg-white/80 dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                        هذا المنشور يظهر لمين؟
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTrainerAudience({ artisans: true, suppliers: true, customers: true })
                        }
                        className="text-[11px] font-black text-[#EA580C] hover:underline cursor-pointer"
                      >
                        تحديد الجميع
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {AUDIENCE_LABELS.map((aud) => {
                        const active = trainerAudience[aud.key];
                        return (
                          <button
                            key={aud.key}
                            type="button"
                            onClick={() =>
                              setTrainerAudience((prev) => ({ ...prev, [aud.key]: !prev[aud.key] }))
                            }
                            className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer transition ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#64748B] dark:text-[#94A3B8] border-[#D4CCBC] dark:border-[#22355E]'
                            }`}
                          >
                            {active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span>{aud.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto-Publish to Family Forum + Notify All Artisans */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-400/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trainerPublishToFamily}
                      onChange={(e) => setTrainerPublishToFamily(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#EA580C] cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] leading-relaxed">
                      نشر الشرح تلقائياً باسمي في <strong className="text-[#C2410C] dark:text-[#FBBF24]">منتدى العيلة (طبلية الشمساوية)</strong> مع إرسال إشعار فوري لجميع الفنانين للدخول والمشاهدة والتعليق والتفاعل داخل المنظومة.
                    </span>
                  </label>

                  {/* Live Embedded In-App Preview */}
                  {trainerUrl.trim().startsWith('http') && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                        معاينة فورية للمشغل الداخلي قبل النشر:
                      </span>
                      <EmbeddedSocialMediaCard
                        title={trainerTitle || 'معاينة الشرح'}
                        description={trainerDesc}
                        url={trainerUrl.trim()}
                        platform={trainerPlatform}
                        videoOrientation={trainerVideoOrientation}
                        videoAspectRatio={
                          trainerVideoOrientation === 'auto' ? trainerDetectedMeta?.aspectRatio : undefined
                        }
                        authorName={rawProfile.displayName}
                        brandName={rawProfile.brandName}
                        authorGender={genderDraft}
                        audience={trainerAudience}
                        compact
                      />
                    </div>
                  )}

                  {trainerError && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{trainerError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setTrainerComposerOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={trainerBusy}
                      className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{trainerBusy ? 'جاري النشر وإرسال الإشعارات...' : 'نشر الشرح المدمج الآن'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Embedded Trainer Posts Grid */}
              {trainerPostsList.length === 0 ? (
                isExpertTrainer && (
                  <div className="py-8 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
                    {isEditMode
                      ? 'اضغط على «إضافة رابط شرح مدمج» لنشر أول درس فيديو أو بوست تعليمي يُشغّل داخل المنظومة مباشرة.'
                      : isEnView
                      ? 'No lessons are currently visible for this audience.'
                      : 'لا توجد شروحات مدمجة متاحة لهذه الفئة حالياً.'}
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {trainerPostsList.map((tp) => {
                    const localizedTpTitle = isEnView
                      ? tp.titleEn || tp.title
                      : tp.title || tp.titleEn || '';
                    const localizedTpDesc = isEnView
                      ? tp.descriptionEn || tp.description
                      : tp.description || tp.descriptionEn || '';
                    return (
                      <EmbeddedSocialMediaCard
                        key={tp.id}
                        title={localizedTpTitle}
                        description={localizedTpDesc}
                        url={tp.url}
                        platform={tp.platform}
                        videoOrientation={tp.videoOrientation}
                        videoAspectRatio={tp.videoAspectRatio}
                        authorName={displayProfileName}
                        brandName={displayProfileBrand}
                        authorGender={
                          tp.authorGender ||
                          ((effectiveProfile as any)?.gender === 'male' ? 'male' : 'female')
                        }
                        audience={isEditMode ? tp.audience : undefined}
                        onDelete={isEditMode ? () => handleDeleteTrainerPost(tp.id) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Bottom Owner Audience Preview Switcher Bar */}
          {isOwner && (
            <section className="rounded-2xl bg-[#0C1427] dark:bg-[#132040] text-[#F7F3EA] p-3.5 sm:p-4 border border-[#22355E] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black text-[#FBBF24]">
                <Eye className="w-4 h-4 shrink-0" />
                <span>عرض صفحتك الشخصية كما يراها:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'owner' as const, label: 'وضع التحرير (ملكي)' },
                  { id: 'artisans' as const, label: 'كما تظهر للفنانين' },
                  { id: 'suppliers' as const, label: 'كما تظهر للموردين' },
                  { id: 'customers' as const, label: 'كما تظهر للعملاء' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      playButtonClickSound();
                      setPreviewAs(opt.id);
                    }}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer whitespace-nowrap ${
                      previewAs === opt.id
                        ? 'bg-[#EA580C] text-white shadow-sm'
                        : 'bg-white/10 text-[#CBD5E1] hover:bg-white/15'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Fullscreen Lightbox */}
      {lightboxPost && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          dir={dir}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxPost(null);
          }}
        >
          <div className="max-w-3xl w-full rounded-3xl bg-[#0D162E] border border-[#22355E] overflow-hidden shadow-2xl">
            <div className="p-3 flex items-center justify-between border-b border-[#22355E]">
              <span className="text-xs font-black text-[#F7F3EA]">
                {displayProfileName}
                {displayProfileBrand ? ` · ${displayProfileBrand}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPost(null)}
                aria-label={isEnView ? 'Close preview' : 'إغلاق المعاينة'}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-[#EA580C] text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[65vh]">
              <img
                src={lightboxPost.imageUrl}
                alt={pickPostCaption(lightboxPost) || ''}
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>
            {pickPostCaption(lightboxPost) && (
              <div className="p-4 text-sm text-[#F7F3EA] leading-relaxed whitespace-pre-wrap">
                {pickPostCaption(lightboxPost)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (mode === 'modal') {
    return (
      <div
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs overflow-y-auto py-4 px-2 sm:px-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) onClose();
        }}
      >
        <div className="max-w-5xl mx-auto rounded-3xl bg-[#F2ECE1] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl">
          {contentNode}
        </div>
      </div>
    );
  }

  return contentNode;
};
