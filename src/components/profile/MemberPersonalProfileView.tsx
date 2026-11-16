import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Edit3,
  Eye,
  EyeOff,
  Home,
  Image as ImageIcon,
  Lock,
  Phone,
  Plus,
  Save,
  Sparkles,
  Store,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  AudienceRole,
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
  deleteMemberShowcasePost,
  fetchMemberPersonalProfile,
  resolveAudienceRoleFromUser,
  saveMemberPersonalProfile,
  updateMemberShowcasePost,
} from '../../db/memberProfileService';
import { compressImageFile } from '../../utils/imageCompressor';
import { playButtonClickSound, playErrorSound, playSuccessSound } from '../../lib/sounds';
import { ArtisanAvatar } from '../brand/BrandAssets';

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
  const [bioHeadlineDraft, setBioHeadlineDraft] = useState('');
  const [storyDraft, setStoryDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [govDraft, setGovDraft] = useState('');
  const [visibilityDraft, setVisibilityDraft] = useState<ProfileVisibilityMatrix>(() =>
    normalizeVisibilityMatrix(null)
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Showcase Post Composer & Editor
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPostImg, setNewPostImg] = useState('');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [editingPost, setEditingPost] = useState<ShowcasePostItem | null>(null);
  const [editPostImg, setEditPostImg] = useState('');
  const [editPostCaption, setEditPostCaption] = useState('');

  // Lightbox Modal
  const [lightboxPost, setLightboxPost] = useState<ShowcasePostItem | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    fetchMemberPersonalProfile(targetMemberId, 'owner').then((res) => {
      if (!active) return;
      if (!res.success || !res.profile) {
        setErrorMsg(res.error || 'تعذر تحميل الصفحة الشخصية');
        setRawProfile(null);
        setIsOwner(false);
      } else {
        const p = res.profile;
        setRawProfile(p);
        setIsOwner(Boolean(res.isOwner));
        setPreviewAs(res.isOwner ? 'owner' : callerAudience);
        setPersonalAvatarDraft(p.personalAvatar ?? null);
        setBioHeadlineDraft(p.bioHeadline || '');
        setStoryDraft(p.storyText || '');
        setPhoneDraft(p.phone || '');
        setGovDraft(p.governorate || '');
        setVisibilityDraft(normalizeVisibilityMatrix(p.visibility));
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
    if (isOwner && previewAs === 'owner') return rawProfile;
    const targetAudience: AudienceRole = isOwner ? (previewAs as AudienceRole) : callerAudience;
    return applyVisibilityForAudience(
      {
        ...rawProfile,
        visibility: isOwner ? visibilityDraft : rawProfile.visibility,
        personalAvatar: isOwner ? personalAvatarDraft : rawProfile.personalAvatar,
        bioHeadline: isOwner ? bioHeadlineDraft : rawProfile.bioHeadline,
        storyText: isOwner ? storyDraft : rawProfile.storyText,
        phone: isOwner ? phoneDraft : rawProfile.phone,
        governorate: isOwner ? govDraft : rawProfile.governorate,
      },
      targetAudience
    );
  }, [
    rawProfile,
    isOwner,
    previewAs,
    callerAudience,
    visibilityDraft,
    personalAvatarDraft,
    bioHeadlineDraft,
    storyDraft,
    phoneDraft,
    govDraft,
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
      personalAvatar: personalAvatarDraft,
      bioHeadline: bioHeadlineDraft.trim(),
      storyText: storyDraft.trim(),
      phone: phoneDraft.trim(),
      governorate: govDraft.trim(),
      visibility: visibilityDraft,
    });
    setSavingProfile(false);
    if (res.success && res.profile) {
      playSuccessSound();
      setRawProfile(res.profile);
      setSaveFeedback({
        text: 'تم حفظ بياناتك وأذونات الظهور بنجاح (ومتزامنة تلقائياً مع متجرك)!',
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
    });
    setPostBusy(false);
    if (res.success && res.showcasePosts) {
      playSuccessSound();
      setRawProfile((prev) => (prev ? { ...prev, showcasePosts: res.showcasePosts! } : prev));
      setNewPostImg('');
      setNewPostCaption('');
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
    const res = await updateMemberShowcasePost(editingPost.id, {
      imageUrl: editPostImg || editingPost.imageUrl,
      caption: editPostCaption.trim(),
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

  const isEditMode = isOwner && previewAs === 'owner';
  const postsCount = rawProfile?.showcasePosts?.length || 0;
  const atLimit = postsCount >= MAX_SHOWCASE_POSTS;

  const contentNode = (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 text-right" dir="rtl">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              <ArrowRight className="w-4 h-4 text-[#EA580C]" />
              <span>رجوع</span>
            </button>
          )}
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              <Home className="w-4 h-4 text-[#EA580C]" />
              <span>الرئيسية</span>
            </button>
          )}
          <h1 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
            {isOwner ? 'صفحتي الشخصية ومعرض الأعمال' : 'الملف الشخصي في مجتمع الشمساوية'}
          </h1>
        </div>

        {mode === 'modal' && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer hover:border-[#EA580C]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
            جاري تحميل الصفحة الشخصية...
          </p>
        </div>
      ) : errorMsg || !effectiveProfile || !rawProfile ? (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 p-6 text-center text-xs font-bold text-rose-700 dark:text-rose-300">
          {errorMsg || 'تعذر العثور على هذا الملف الشخصي.'}
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
                  { id: 'artisans' as const, label: 'كـ فنان ورشة' },
                  { id: 'suppliers' as const, label: 'كـ مورد خامات' },
                  { id: 'customers' as const, label: 'كـ عميل وزائر' },
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
                      alt={effectiveProfile.displayName}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[#EA580C]/70 bg-[#EFE9DC] dark:bg-[#132040]"
                    />
                  ) : effectiveProfile.brandLogo ? (
                    <img
                      src={effectiveProfile.brandLogo}
                      alt={effectiveProfile.brandName}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain p-1.5 border border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC] dark:bg-[#132040]"
                    />
                  ) : (
                    <ArtisanAvatar artistName={effectiveProfile.displayName} size="lg" />
                  )}

                  {effectiveProfile.brandLogo && effectiveProfile.personalAvatar && (
                    <img
                      src={effectiveProfile.brandLogo}
                      alt={effectiveProfile.brandName}
                      title={`شعار: ${effectiveProfile.brandName}`}
                      className="w-9 h-9 rounded-xl object-contain bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] p-0.5 absolute -bottom-2 -left-2 shadow-sm"
                    />
                  )}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                    {effectiveProfile.accountRole === 'superadmin'
                      ? 'إدارة المنظومة · كبير العيلة'
                      : effectiveProfile.accountRole === 'supplier'
                      ? 'مورد خامات معتمد'
                      : 'فنان ومبدع يدوي'}
                    {effectiveProfile.governorate || effectiveProfile.country
                      ? ` · ${[effectiveProfile.governorate, effectiveProfile.country].filter(Boolean).join('، ')}`
                      : ''}
                    {` · ★ ${effectiveProfile.ratingStars || 5}`}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-tight">
                    {effectiveProfile.displayName}
                  </h2>

                  {effectiveProfile.brandName && (
                    <p className="text-xs sm:text-sm font-bold text-[#475569] dark:text-[#CBD5E1]">
                      {effectiveProfile.brandName}
                      {effectiveProfile.bioHeadline ? ` — ${effectiveProfile.bioHeadline}` : ''}
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
                      {effectiveProfile.accountRole === 'supplier'
                        ? 'زيارة متجر المورد وكتالوج الخامات'
                        : 'زيارة المتجر الإلكتروني'}
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
                      onClick={() => setPersonalAvatarDraft(null)}
                      className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      حذف الصورة الشخصية
                    </button>
                  )}

                  <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    ملاحظة: شعار البراند يُدار من إعدادات الحساب بينما هذه صورتك الشخصية المستقلة وتُحذف نسختها القديمة فوراً عند التعديل.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">الوصف المهني المختصر</label>
                    <input
                      type="text"
                      value={bioHeadlineDraft}
                      onChange={(e) => setBioHeadlineDraft(e.target.value)}
                      placeholder="مثال: متخصص مكرمية جدارية وخيوط قطن طبيعي"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    />
                  </div>
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
                    <label className="block text-xs font-bold mb-1">المحافظة / المدينة</label>
                    <input
                      type="text"
                      value={govDraft}
                      onChange={(e) => setGovDraft(e.target.value)}
                      placeholder="القاهرة / الإسكندرية..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    قصتي وبدايتي في الشغل (تتزامن تلقائياً مع واجهة متجرك العام)
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
          {!isEditMode && effectiveProfile.storyText && (
            <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-2">
              <h3 className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>
                  {effectiveProfile.accountRole === 'supplier'
                    ? 'نبذة عن المورد وخبرته في الخامات'
                    : 'قصة الفنان ورحلة الإبداع'}
                </span>
              </h3>
              <p className="text-sm leading-relaxed text-[#0C1427] dark:text-[#F7F3EA] whitespace-pre-wrap">
                {effectiveProfile.storyText}
              </p>
            </section>
          )}

          {/* Showcase Gallery Section (Max 6 Mini-Posts) */}
          <section className="rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#EA580C]" />
                  <span>معرض الأعمال والمنشورات المميزة</span>
                </h3>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-0.5">
                  صور وقصص أعمال مميزة مضغوطة تلقائياً ومتزامنة مع واجهة المتجر العام
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="font-mono tabular-nums text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                  {isEditMode ? postsCount : effectiveProfile.showcasePosts.length} /{' '}
                  {MAX_SHOWCASE_POSTS} منشورات
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

                <textarea
                  rows={2}
                  maxLength={600}
                  value={newPostCaption}
                  onChange={(e) => setNewPostCaption(e.target.value)}
                  placeholder="اكتب قصة هذا العمل أو تفاصيل الخامة المستخدمة (سيظهر كمنشور على صفحتك ومتجرك)..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs"
                />

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

                <textarea
                  rows={2}
                  maxLength={600}
                  value={editPostCaption}
                  onChange={(e) => setEditPostCaption(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs"
                />

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
                    : 'لا توجد منشورات أعمال ظاهرة في هذا العرض.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {effectiveProfile.showcasePosts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-2xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex flex-col justify-between group"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxPost(post)}
                      className="relative w-full aspect-[4/3] overflow-hidden bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer text-right block"
                    >
                      <img
                        src={post.imageUrl}
                        alt={post.caption || 'عمل مميز'}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </button>

                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                      <p className="text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] leading-relaxed whitespace-pre-wrap">
                        {post.caption || 'عمل فني مميز'}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#D4CCBC]/60 dark:border-[#22355E]/70">
                        <span className="text-[10px] font-mono tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          {new Date(post.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>

                        {isEditMode && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPost(post);
                                setEditPostImg(post.imageUrl);
                                setEditPostCaption(post.caption || '');
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
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Fullscreen Lightbox */}
      {lightboxPost && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxPost(null);
          }}
        >
          <div className="max-w-3xl w-full rounded-3xl bg-[#0D162E] border border-[#22355E] overflow-hidden shadow-2xl">
            <div className="p-3 flex items-center justify-between border-b border-[#22355E]">
              <span className="text-xs font-black text-[#F7F3EA]">
                {effectiveProfile?.displayName} · {effectiveProfile?.brandName}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPost(null)}
                aria-label="إغلاق المعاينة"
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-[#EA580C] text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[65vh]">
              <img
                src={lightboxPost.imageUrl}
                alt={lightboxPost.caption || ''}
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>
            {lightboxPost.caption && (
              <div className="p-4 text-sm text-[#F7F3EA] leading-relaxed whitespace-pre-wrap">
                {lightboxPost.caption}
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
