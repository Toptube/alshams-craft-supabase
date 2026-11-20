import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sliders,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { authedFetch } from '../../lib/apiClient';
import {
  ArtisanSkillLevel,
  DEFAULT_LESSON_LAYOUT_BLOCKS,
  DEFAULT_SKILL_LEVELS_LIST,
  GrowthHubConfig,
  LessonLayoutBlockConfig,
  SkillLevelMeta,
  SkillLevelPermissions,
  TrainerEmbeddedPost,
  canLevelPublishLessons,
  getEffectiveLessonLayoutBlocks,
  getEffectiveSkillLevels,
  getStoredGrowthHubConfig,
} from '../../types/artisanGrowth';
import {
  saveGrowthHubConfigToCloud,
  syncGrowthHubConfigFromCloud,
} from '../../db/memberProfileService';
import { EmbeddedSocialMediaCard } from '../common/EmbeddedSocialMediaCard';
import { playButtonClickSound, playErrorSound, playSuccessSound } from '../../lib/sounds';

interface AdminExpertsTrainersPageProps {
  onBack: () => void;
  onNotifySuccess?: (msg: string) => void;
  onNotifyError?: (msg: string) => void;
}

interface AdminArtisanRow {
  memberId: string;
  displayName: string;
  brandName: string;
  email: string;
  country?: string;
  gender?: 'male' | 'female';
  skillLevel: ArtisanSkillLevel;
  assessmentScore?: number;
  trainerVerified: boolean;
  trainerPostLimit: number;
  trainerPostsCount: number;
}

interface AdminPostItem {
  memberId: string;
  authorName: string;
  brandName: string;
  authorGender?: 'male' | 'female';
  post: TrainerEmbeddedPost;
}

const PERMISSION_LABELS: Array<{ key: keyof SkillLevelPermissions; label: string }> = [
  { key: 'canPublishLessons', label: 'نشر الدروس والشروحات المدمجة' },
  { key: 'canAccessProTools', label: 'أدوات المحترفين والمتجر' },
  { key: 'canExportToMarket', label: 'التصدير لسوق الشمساوية' },
  { key: 'canJoinGroupBuying', label: 'مجمع الشراء التعاوني' },
  { key: 'showVerifiedBadge', label: 'شارة خبير معتمد' },
];

export const AdminExpertsTrainersPage: React.FC<AdminExpertsTrainersPageProps> = ({
  onBack,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'artisans' | 'levels' | 'layout' | 'posts'>('artisans');
  const [artisans, setArtisans] = useState<AdminArtisanRow[]>([]);
  const [allPosts, setAllPosts] = useState<AdminPostItem[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | ArtisanSkillLevel>('all');
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const [growthConfig, setGrowthConfig] = useState<GrowthHubConfig>(() => getStoredGrowthHubConfig());
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Editable skill levels & lesson layout blocks
  const [levelsDraft, setLevelsDraft] = useState<SkillLevelMeta[]>(() =>
    getEffectiveSkillLevels(getStoredGrowthHubConfig())
  );
  const [blocksDraft, setBlocksDraft] = useState<LessonLayoutBlockConfig[]>(() =>
    getEffectiveLessonLayoutBlocks(getStoredGrowthHubConfig())
  );
  const [newLevelTitle, setNewLevelTitle] = useState('');
  const [newLevelTitleFemale, setNewLevelTitleFemale] = useState('');
  const [newLevelTagline, setNewLevelTagline] = useState('');

  // Local edits map per memberId
  const [drafts, setDrafts] = useState<
    Record<string, { skillLevel: ArtisanSkillLevel; trainerVerified: boolean; trainerPostLimit: number }>
  >({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [res, cfg] = await Promise.all([
        authedFetch('/api/admin/trainers-overview'),
        syncGrowthHubConfigFromCloud(),
      ]);
      setGrowthConfig(cfg);
      setLevelsDraft(getEffectiveSkillLevels(cfg));
      setBlocksDraft(getEffectiveLessonLayoutBlocks(cfg));

      if (res.ok) {
        const data = await res.json();
        const rows: AdminArtisanRow[] = Array.isArray(data.members)
          ? data.members
          : Array.isArray(data.artisans)
          ? data.artisans
          : [];
        setArtisans(rows);
        const rawPosts = Array.isArray(data.allTrainerPosts) ? data.allTrainerPosts : [];
        setAllPosts(
          rawPosts.map((p: any) => ({
            memberId: p.memberId || '',
            authorName: p.authorName || (p.authorGender === 'female' ? 'خبيرة' : 'خبير'),
            brandName: p.brandName || '',
            authorGender: p.authorGender === 'male' ? 'male' : p.authorGender === 'female' ? 'female' : undefined,
            post: p as TrainerEmbeddedPost,
          }))
        );
        const nextDrafts: Record<
          string,
          { skillLevel: ArtisanSkillLevel; trainerVerified: boolean; trainerPostLimit: number }
        > = {};
        for (const r of rows) {
          nextDrafts[r.memberId] = {
            skillLevel: r.skillLevel || 'intermediate',
            trainerVerified: Boolean(r.trainerVerified),
            trainerPostLimit: Number(r.trainerPostLimit || cfg.trainerDefaultPostLimit || 15),
          };
        }
        setDrafts(nextDrafts);
      } else {
        onNotifyError?.('تعذر تحميل قائمة الخبراء من السيرفر.');
      }
    } catch {
      onNotifyError?.('حدث خطأ في الاتصال أثناء جلب بيانات الأكاديمية.');
    } finally {
      setLoading(false);
    }
  }, [onNotifyError]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const filteredArtisans = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return artisans.filter((a) => {
      if (levelFilter !== 'all' && a.skillLevel !== levelFilter) return false;
      if (!q) return true;
      return (
        (a.displayName || '').toLowerCase().includes(q) ||
        (a.brandName || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q)
      );
    });
  }, [artisans, searchQ, levelFilter]);

  const stats = useMemo(() => {
    const trainersCount = artisans.filter((a) =>
      canLevelPublishLessons(a.skillLevel, a.trainerVerified, undefined, { customSkillLevels: levelsDraft })
    ).length;
    const verifiedCount = artisans.filter((a) => a.trainerVerified).length;
    return {
      totalArtisans: artisans.length,
      trainersCount,
      verifiedCount,
      totalPosts: allPosts.length,
    };
  }, [artisans, allPosts, levelsDraft]);

  const handleSaveGlobalSettings = async (override?: Partial<GrowthHubConfig>, successMessage?: string) => {
    setSavingGlobal(true);
    const payload: GrowthHubConfig = {
      ...growthConfig,
      customSkillLevels: levelsDraft,
      lessonLayoutBlocks: blocksDraft,
      ...(override || {}),
    };
    const res = await saveGrowthHubConfigToCloud(payload);
    setSavingGlobal(false);
    if (res.success && res.config) {
      setGrowthConfig(res.config);
      playSuccessSound();
      onNotifySuccess?.(successMessage || 'تم حفظ الإعدادات وتعميمها فوراً على المنظومة بنجاح.');
    } else {
      playErrorSound();
      onNotifyError?.(res.error || 'تعذر حفظ الإعدادات.');
    }
  };

  const handleMoveLevel = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= levelsDraft.length) return;
    playButtonClickSound();
    const copy = [...levelsDraft];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setLevelsDraft(copy);
  };

  const handleUpdateLevelField = (id: string, patch: Partial<SkillLevelMeta>) => {
    setLevelsDraft((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleToggleLevelPermission = (id: string, permKey: keyof SkillLevelPermissions) => {
    setLevelsDraft((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const cur: SkillLevelPermissions = {
          canPublishLessons: l.permissions?.canPublishLessons ?? (l.id === 'expert_trainer'),
          canAccessProTools: l.permissions?.canAccessProTools ?? true,
          canJoinGroupBuying: l.permissions?.canJoinGroupBuying ?? true,
          canExportToMarket: l.permissions?.canExportToMarket ?? true,
          showVerifiedBadge: l.permissions?.showVerifiedBadge ?? (l.id === 'expert_trainer'),
        };
        return { ...l, permissions: { ...cur, [permKey]: !cur[permKey] } };
      })
    );
  };

  const handleAddCustomLevel = () => {
    const title = newLevelTitle.trim();
    if (!title) {
      onNotifyError?.('يرجى كتابة اسم المستوى الجديد أولاً.');
      return;
    }
    const id = `custom_${Date.now().toString(36)}`;
    const newLvl: SkillLevelMeta = {
      id,
      title,
      titleFemale: newLevelTitleFemale.trim() || title,
      shortLabel: title.slice(0, 20),
      shortLabelFemale: (newLevelTitleFemale.trim() || title).slice(0, 20),
      tagline: newLevelTagline.trim() || 'مستوى مخصص تم إنشاؤه من لوحة الإدارة العليا.',
      perks: ['صلاحيات مخصصة حسب إعدادات إدارة منظومة الشمساوية'],
      accentClass: 'text-[#C2410C] dark:text-[#FDBA74] border-[#EA580C]/50 bg-[#EA580C]/12',
      isSystem: false,
      permissions: {
        canPublishLessons: false,
        canAccessProTools: true,
        canJoinGroupBuying: true,
        canExportToMarket: true,
        showVerifiedBadge: false,
      },
    };
    setLevelsDraft((prev) => [...prev, newLvl]);
    setNewLevelTitle('');
    setNewLevelTitleFemale('');
    setNewLevelTagline('');
    playSuccessSound();
  };

  const handleDeleteCustomLevel = (id: string) => {
    setLevelsDraft((prev) => prev.filter((l) => l.id !== id || l.isSystem));
    playButtonClickSound();
  };

  const handleMoveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocksDraft.length) return;
    playButtonClickSound();
    const copy = [...blocksDraft];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setBlocksDraft(copy);
  };

  const handleToggleBlockVisible = (id: LessonLayoutBlockConfig['id']) => {
    if (id === 'media') return; // المشغل دائماً ظاهر
    playButtonClickSound();
    setBlocksDraft((prev) => prev.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)));
  };

  const handleSaveMember = async (memberId: string) => {
    const d = drafts[memberId];
    if (!d) return;
    setSavingMemberId(memberId);
    try {
      const res = await authedFetch(`/api/admin/trainers/${encodeURIComponent(memberId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (res.ok) {
        playSuccessSound();
        setArtisans((prev) =>
          prev.map((row) =>
            row.memberId === memberId
              ? {
                  ...row,
                  skillLevel: d.skillLevel,
                  trainerVerified: d.trainerVerified,
                  trainerPostLimit: d.trainerPostLimit,
                }
              : row
          )
        );
        onNotifySuccess?.('تم تحديث مستوى الفنان وحدود منشورات الشرح بنجاح.');
      } else {
        playErrorSound();
        onNotifyError?.('تعذر حفظ تعديلات الفنان.');
      }
    } catch {
      playErrorSound();
      onNotifyError?.('حدث خطأ أثناء حفظ بيانات الفنان.');
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleDeletePost = async (memberId: string, postId: string) => {
    setDeletingPostId(postId);
    try {
      const res = await authedFetch(
        `/api/admin/trainer-posts/${encodeURIComponent(memberId)}/${encodeURIComponent(postId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        playButtonClickSound();
        setAllPosts((prev) => prev.filter((item) => item.post.id !== postId));
        setArtisans((prev) =>
          prev.map((a) =>
            a.memberId === memberId
              ? { ...a, trainerPostsCount: Math.max(0, a.trainerPostsCount - 1) }
              : a
          )
        );
        onNotifySuccess?.('تم حذف المنشور الشرحي بنجاح.');
      } else {
        playErrorSound();
        onNotifyError?.('تعذر حذف المنشور.');
      }
    } catch {
      playErrorSound();
      onNotifyError?.('خطأ اتصال أثناء الحذف.');
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C]" />
            <span>العودة للوحة الإدارة</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              <span>أكاديمية الخبراء وإدارة المستويات وتنسيق الشروحات</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              تعديل وإضافة مستويات الفنانين وصلاحياتها، ترتيب عرض الفيديو والشرح، واعتماد الخبراء.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الفنانين', value: stats.totalArtisans, icon: Users },
          { label: 'الخبراء المصرح لهم', value: stats.trainersCount, icon: GraduationCap },
          { label: 'خبراء معتمدون', value: stats.verifiedCount, icon: ShieldCheck },
          { label: 'شروحات مدمجة منشورة', value: stats.totalPosts, icon: Video },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 flex items-center justify-between"
            >
              <div>
                <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">{kpi.label}</div>
                <div className="text-xl font-mono font-black text-[#0C1427] dark:text-[#F7F3EA] mt-0.5">
                  {kpi.value}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EA580C]/10 dark:bg-[#FBBF24]/15 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Governance Controls */}
      <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#EA580C]" />
            <span>السياسات العامة للنشر والإشعارات التلقائية للخبراء</span>
          </h2>
          <button
            type="button"
            disabled={savingGlobal}
            onClick={() => handleSaveGlobalSettings()}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingGlobal ? 'جاري الحفظ...' : 'حفظ السياسة العامة'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer">
            <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA]">
              إرسال إشعار فوري لكل الفنانين عند نشر شرح جديد
            </span>
            <input
              type="checkbox"
              checked={growthConfig.trainerAutoNotifyArtisans}
              onChange={(e) =>
                setGrowthConfig((p) => ({ ...p, trainerAutoNotifyArtisans: e.target.checked }))
              }
              className="w-4 h-4 accent-[#EA580C] cursor-pointer shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer">
            <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA]">
              تفعيل اختبار مستوى الفنان في التسجيل والدخول
            </span>
            <input
              type="checkbox"
              checked={growthConfig.trainerAssessmentEnabled}
              onChange={(e) =>
                setGrowthConfig((p) => ({ ...p, trainerAssessmentEnabled: e.target.checked }))
              }
              className="w-4 h-4 accent-[#EA580C] cursor-pointer shrink-0"
            />
          </label>

          <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
            <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA]">
              الحد الافتراضي لمنشورات الخبير:
            </span>
            <input
              type="number"
              min={3}
              max={100}
              value={growthConfig.trainerDefaultPostLimit}
              onChange={(e) =>
                setGrowthConfig((p) => ({
                  ...p,
                  trainerDefaultPostLimit: Math.max(3, Math.min(100, Number(e.target.value) || 15)),
                }))
              }
              className="w-20 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black text-center"
            />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2">
        {[
          { id: 'artisans' as const, label: `إدارة الفنانين والخبراء (${artisans.length})`, icon: Award },
          { id: 'levels' as const, label: `مستويات الفنانين والصلاحيات (${levelsDraft.length})`, icon: Sliders },
          { id: 'layout' as const, label: 'ترتيب عرض الدروس والشروحات', icon: Layers },
          { id: 'posts' as const, label: `مكتبة الشروحات المنشورة (${allPosts.length})`, icon: Video },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === tab.id
                  ? 'bg-[#EA580C] text-white'
                  : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          جاري تحميل بيانات الأكاديمية...
        </div>
      ) : activeTab === 'artisans' ? (
        <section className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#475569] absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="بحث باسم الفنان، البراند، أو البريد الإلكتروني..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLevelFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black border cursor-pointer transition ${
                  levelFilter === 'all'
                    ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                }`}
              >
                الكل
              </button>
              {levelsDraft.map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setLevelFilter(lvl.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black border cursor-pointer transition ${
                    levelFilter === lvl.id
                      ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  {lvl.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {filteredArtisans.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
              لا يوجد فنانون مطابقون لهذه التصفية حالياً.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredArtisans.map((row) => {
                const isFemale = row.gender === 'female';
                const d = drafts[row.memberId] || {
                  skillLevel: row.skillLevel,
                  trainerVerified: row.trainerVerified,
                  trainerPostLimit: row.trainerPostLimit,
                };
                return (
                  <div
                    key={row.memberId}
                    className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          {row.displayName}
                        </span>
                        {row.brandName && (
                          <span className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                            ({row.brandName})
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[10px] font-black text-[#475569] dark:text-[#CBD5E1]">
                          {isFemale ? 'فنانة' : 'فنان'}
                        </span>
                        {d.trainerVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isFemale ? 'خبيرة معتمدة' : 'خبير معتمد'}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                        {row.email && <span className="font-mono">{row.email}</span>}
                        <span>الدولة: {row.country || 'مصر'}</span>
                        <span>شروحات منشورة: {row.trainerPostsCount}</span>
                        {typeof row.assessmentScore === 'number' && (
                          <span>درجة الاختبار: {row.assessmentScore}/12</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        value={d.skillLevel}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.memberId]: {
                              ...d,
                              skillLevel: e.target.value as ArtisanSkillLevel,
                            },
                          }))
                        }
                        className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black"
                      >
                        {levelsDraft.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {isFemale ? lvl.titleFemale || lvl.title : lvl.title}
                          </option>
                        ))}
                      </select>

                      <label className="px-2.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={d.trainerVerified}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.memberId]: {
                                ...d,
                                trainerVerified: e.target.checked,
                                skillLevel: e.target.checked ? 'expert_trainer' : d.skillLevel,
                              },
                            }))
                          }
                          className="accent-[#EA580C] cursor-pointer"
                        />
                        <span>{isFemale ? 'اعتماد خبيرة' : 'اعتماد خبير'}</span>
                      </label>

                      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold">
                        <span>الحد:</span>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={d.trainerPostLimit}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.memberId]: {
                                ...d,
                                trainerPostLimit: Math.max(1, Number(e.target.value) || 15),
                              },
                            }))
                          }
                          className="w-14 px-1.5 py-0.5 rounded bg-white dark:bg-[#0D162E] font-mono font-black text-center"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={savingMemberId === row.memberId}
                        onClick={() => handleSaveMember(row.memberId)}
                        className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingMemberId === row.memberId ? 'حفظ...' : 'حفظ'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : activeTab === 'levels' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3.5">
            <div className="space-y-0.5">
              <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                تحكم كامل في أسماء مستويات الفنانين وصلاحياتها
              </h3>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                المسمى يُطبَّق تلقائياً حسب نوع صاحب أو صاحبة الورشة (فنان ← المذكر مثل «خبير»، فنانة ← المؤنث مثل «خبيرة»)، ويمكنك هنا تعديل الصياغة أو الصلاحيات أو إضافة مستويات جديدة.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLevelsDraft(DEFAULT_SKILL_LEVELS_LIST);
                  playButtonClickSound();
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>
              <button
                type="button"
                disabled={savingGlobal}
                onClick={() =>
                  handleSaveGlobalSettings(
                    { customSkillLevels: levelsDraft },
                    'تم حفظ مستويات الفنانين وصلاحياتها وتعميمها على جميع الشاشات بنجاح!'
                  )
                }
                className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingGlobal ? 'جاري الحفظ...' : 'حفظ تعديلات المستويات'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {levelsDraft.map((lvl, idx) => (
              <div
                key={lvl.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4CCBC]/60 dark:border-[#22355E] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#EA580C]/15 text-[#EA580C] dark:text-[#FBBF24] text-xs font-mono font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {lvl.title} {lvl.titleFemale && lvl.titleFemale !== lvl.title ? ` / ${lvl.titleFemale}` : ''}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#475569] dark:text-[#94A3B8]">
                      {lvl.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveLevel(idx, -1)}
                      title="نقل لأعلى"
                      className="p-1.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === levelsDraft.length - 1}
                      onClick={() => handleMoveLevel(idx, 1)}
                      title="نقل لأسفل"
                      className="p-1.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {!lvl.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomLevel(lvl.id)}
                        title="حذف هذا المستوى المخصص"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                      الاسم (فنان / مذكر)
                    </label>
                    <input
                      type="text"
                      value={lvl.title}
                      onChange={(e) => handleUpdateLevelField(lvl.id, { title: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                      الاسم (فنانة / مؤنث)
                    </label>
                    <input
                      type="text"
                      value={lvl.titleFemale || ''}
                      onChange={(e) => handleUpdateLevelField(lvl.id, { titleFemale: e.target.value })}
                      placeholder={lvl.title}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                      الاسم المختصر (للشارة)
                    </label>
                    <input
                      type="text"
                      value={lvl.shortLabel}
                      onChange={(e) => handleUpdateLevelField(lvl.id, { shortLabel: e.target.value })}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                      الاسم المختصر (مؤنث)
                    </label>
                    <input
                      type="text"
                      value={lvl.shortLabelFemale || ''}
                      onChange={(e) => handleUpdateLevelField(lvl.id, { shortLabelFemale: e.target.value })}
                      placeholder={lvl.shortLabel}
                      className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mb-1">
                    الوصف التعريفي للمستوى
                  </label>
                  <input
                    type="text"
                    value={lvl.tagline}
                    onChange={(e) => handleUpdateLevelField(lvl.id, { tagline: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
                  />
                </div>

                {/* Granular Permissions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {PERMISSION_LABELS.map((perm) => {
                    const checked = Boolean(lvl.permissions?.[perm.key]);
                    return (
                      <label
                        key={perm.key}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition ${
                          checked
                            ? 'bg-emerald-600/15 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                            : 'bg-[#EFE9DC] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#64748B]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleLevelPermission(lvl.id, perm.key)}
                          className="accent-emerald-600 cursor-pointer"
                        />
                        <span>{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Add New Custom Level */}
          <div className="rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040]/80 border-2 border-dashed border-[#EA580C]/50 p-4 space-y-3">
            <h4 className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>إضافة مستوى فنان جديد مخصص</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <input
                type="text"
                value={newLevelTitle}
                onChange={(e) => setNewLevelTitle(e.target.value)}
                placeholder="اسم المستوى (مثال: سفير حرفة)"
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <input
                type="text"
                value={newLevelTitleFemale}
                onChange={(e) => setNewLevelTitleFemale(e.target.value)}
                placeholder="المؤنث (مثال: سفيرة حرفة)"
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <input
                type="text"
                value={newLevelTagline}
                onChange={(e) => setNewLevelTagline(e.target.value)}
                placeholder="وصف مختصر للمستوى..."
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
            </div>
            <button
              type="button"
              onClick={handleAddCustomLevel}
              className="px-4 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة المستوى للقائمة (ثم اضغط حفظ بالأعلى)</span>
            </button>
          </div>
        </section>
      ) : activeTab === 'layout' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-3.5">
            <div className="space-y-0.5">
              <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                ترتيب عناصر عرض الدروس والشروحات المدمجة
              </h3>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                الوضع الافتراضي يضع الفيديو أعلى الشرح؛ ويمكنك تحريك أي عنصر لأعلى أو لأسفل أو إخفاؤه مع معاينة فورية.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBlocksDraft(DEFAULT_LESSON_LAYOUT_BLOCKS);
                  playButtonClickSound();
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>الافتراضي (الفيديو أعلى الشرح)</span>
              </button>
              <button
                type="button"
                disabled={savingGlobal}
                onClick={() =>
                  handleSaveGlobalSettings(
                    { lessonLayoutBlocks: blocksDraft },
                    'تم حفظ ترتيب عرض الدروس والشروحات وتطبيقه فوراً على جميع الصفحات!'
                  )
                }
                className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingGlobal ? 'جاري الحفظ...' : 'حفظ الترتيب الآن'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Blocks Reorder Controls */}
            <div className="space-y-2.5">
              {blocksDraft.map((blk, idx) => (
                <div
                  key={blk.id}
                  className={`rounded-2xl border p-3.5 flex items-center justify-between gap-2 transition ${
                    blk.visible
                      ? 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                      : 'bg-[#EFE9DC]/40 dark:bg-[#060B18]/40 border-dashed border-[#D4CCBC]/60 opacity-65'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#EA580C]/15 text-[#EA580C] dark:text-[#FBBF24] text-xs font-mono font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                        {blk.label}
                      </div>
                      <div className="text-[10px] text-[#475569] dark:text-[#94A3B8]">
                        {blk.id === 'media'
                          ? 'عنصر أساسي (يُعرض بأبعاد الفيديو الطبيعية تلقائياً)'
                          : blk.visible
                            ? 'ظاهر في بطاقة الدرس'
                            : 'مخفي من بطاقة الدرس'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveBlock(idx, -1)}
                      title="تحريك لأعلى"
                      className="p-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === blocksDraft.length - 1}
                      onClick={() => handleMoveBlock(idx, 1)}
                      title="تحريك لأسفل"
                      className="p-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={blk.id === 'media'}
                      onClick={() => handleToggleBlockVisible(blk.id)}
                      title={blk.visible ? 'إخفاء هذا العنصر' : 'إظهار هذا العنصر'}
                      className={`p-2 rounded-xl border cursor-pointer disabled:opacity-35 ${
                        blk.visible
                          ? 'bg-emerald-600/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#64748B]'
                      }`}
                    >
                      {blk.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Visual Preview of Ordered Lesson Card */}
            <div className="space-y-2">
              <div className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                معاينة حية لشكل بطاقة الدرس بعد الترتيب:
              </div>
              <EmbeddedSocialMediaCard
                title="درس تطبيقي: حساب تكلفة الجدارية المكرمية بدقة 100%"
                description="في هذا الشرح العملي نتعرف على اختيار سمك الحبل المناسب، وحساب الهالك 5%، وتحديد مصنعية اليد العادلة قبل التسعير."
                url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                platform="youtube"
                videoOrientation="landscape"
                authorName="حسام بسيوني"
                brandName="منظومة الشمساوية"
                layoutBlocksOverride={blocksDraft}
                onShareToFamily={() => {}}
                compact
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {allPosts.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
              لا توجد شروحات مدمجة منشورة من الخبراء حتى الآن.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {allPosts.map((item) => (
                <div key={item.post.id} className="space-y-1.5">
                  <EmbeddedSocialMediaCard
                    title={item.post.title}
                    description={item.post.description}
                    url={item.post.url}
                    platform={item.post.platform}
                    videoOrientation={item.post.videoOrientation}
                    videoAspectRatio={item.post.videoAspectRatio}
                    authorName={item.authorName}
                    brandName={item.brandName}
                    authorGender={item.authorGender || item.post.authorGender}
                    audience={item.post.audience}
                    onDelete={
                      deletingPostId === item.post.id
                        ? undefined
                        : () => handleDeletePost(item.memberId, item.post.id)
                    }
                  />
                  <div className="flex items-center justify-end px-1">
                    <button
                      type="button"
                      disabled={deletingPostId === item.post.id}
                      onClick={() => handleDeletePost(item.memberId, item.post.id)}
                      className="text-[11px] font-black text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        إزالة الشرح نهائياً من صفحة{' '}
                        {(item.authorGender || item.post.authorGender) === 'female' ? 'الخبيرة' : 'الخبير'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
