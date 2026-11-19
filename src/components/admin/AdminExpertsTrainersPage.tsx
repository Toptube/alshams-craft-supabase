import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bell,
  CheckCircle2,
  GraduationCap,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { authedFetch } from '../../lib/apiClient';
import {
  ARTISAN_SKILL_LEVELS,
  ArtisanSkillLevel,
  GrowthHubConfig,
  TrainerEmbeddedPost,
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
  post: TrainerEmbeddedPost;
}

const LEVELS: ArtisanSkillLevel[] = ['beginner', 'intermediate', 'pro', 'expert_trainer'];

export const AdminExpertsTrainersPage: React.FC<AdminExpertsTrainersPageProps> = ({
  onBack,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'artisans' | 'posts'>('artisans');
  const [artisans, setArtisans] = useState<AdminArtisanRow[]>([]);
  const [allPosts, setAllPosts] = useState<AdminPostItem[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | ArtisanSkillLevel>('all');
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const [growthConfig, setGrowthConfig] = useState<GrowthHubConfig>(() => getStoredGrowthHubConfig());
  const [savingGlobal, setSavingGlobal] = useState(false);

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
            authorName: p.authorName || 'خبير ومدرب',
            brandName: p.brandName || '',
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
        onNotifyError?.('تعذر تحميل قائمة الخبراء والمدربين من السيرفر.');
      }
    } catch {
      onNotifyError?.('حدث خطأ في الاتصال أثناء جلب بيانات المدربين.');
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
    const trainersCount = artisans.filter(
      (a) => a.skillLevel === 'expert_trainer' || a.trainerVerified
    ).length;
    const verifiedCount = artisans.filter((a) => a.trainerVerified).length;
    return {
      totalArtisans: artisans.length,
      trainersCount,
      verifiedCount,
      totalPosts: allPosts.length,
    };
  }, [artisans, allPosts]);

  const handleSaveGlobalSettings = async () => {
    setSavingGlobal(true);
    const res = await saveGrowthHubConfigToCloud(growthConfig);
    setSavingGlobal(false);
    if (res.success) {
      playSuccessSound();
      onNotifySuccess?.('تم حفظ سياسات أكاديمية الخبراء والمدربين بنجاح.');
    } else {
      playErrorSound();
      onNotifyError?.(res.error || 'تعذر حفظ الإعدادات.');
    }
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
              <span>أكاديمية الخبراء والمدربين والشروحات المدمجة</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              إدارة مستويات الفنانين، اعتماد الخبراء والمدربين، التحكم في عدد منشورات الشرح المدمجة وإشعارات طبلية العيلة.
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
          { label: 'خبراء ومدربين', value: stats.trainersCount, icon: GraduationCap },
          { label: 'مدربين معتمدين', value: stats.verifiedCount, icon: ShieldCheck },
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
            <span>السياسات العامة للنشر والإشعارات التلقائية للمدربين</span>
          </h2>
          <button
            type="button"
            disabled={savingGlobal}
            onClick={handleSaveGlobalSettings}
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
              الحد الافتراضي لمنشورات المدرب:
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
      <div className="flex items-center gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('artisans')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'artisans'
              ? 'bg-[#EA580C] text-white'
              : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1]'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>إدارة مستويات الفنانين والمدربين ({artisans.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'posts'
              ? 'bg-[#EA580C] text-white'
              : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#334155] dark:text-[#CBD5E1]'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>مكتبة الشروحات المدمجة المنشورة ({allPosts.length})</span>
        </button>
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
              {(['all', ...LEVELS] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black border cursor-pointer transition ${
                    levelFilter === lvl
                      ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                      : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  {lvl === 'all' ? 'الكل' : ARTISAN_SKILL_LEVELS[lvl].shortLabel}
                </button>
              ))}
            </div>
          </div>

          {filteredArtisans.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
              لا يوجد فنانون مطابقون لهذا التصفية حالياً.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredArtisans.map((row) => {
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
                        <span className="text-xs font-bold text-[#C2410C] dark:text-[#FBBF24]">
                          ({row.brandName})
                        </span>
                        {d.trainerVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>مدرب معتمد</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                        <span className="font-mono">{row.email}</span>
                        <span>الدولة: {row.country || 'مصر'}</span>
                        <span>شروحات منشورة: {row.trainerPostsCount}</span>
                        {typeof row.assessmentScore === 'number' && (
                          <span>درجة الاختبار: {row.assessmentScore}/9</span>
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
                        {LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {ARTISAN_SKILL_LEVELS[lvl].title}
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
                        <span>اعتماد مدرب</span>
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
      ) : (
        <section className="space-y-4">
          {allPosts.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-10 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
              لا توجد شروحات مدمجة منشورة من الخبراء والمدربين حتى الآن.
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
                    authorName={item.authorName}
                    brandName={item.brandName}
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
                      <span>إزالة الشرح نهائياً من صفحة المدرب</span>
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
