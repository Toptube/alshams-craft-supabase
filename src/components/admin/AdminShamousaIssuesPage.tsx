import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Brain,
  CheckCheck,
  CheckCircle2,
  Download,
  GitMerge,
  History,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { authedFetch } from '../../lib/apiClient';
import {
  loadLandingVisitorSuggestions,
  markAllLandingSuggestionsReadLocal,
  type LandingVisitorSuggestionRecord,
} from '../../services/shamousaLandingEngine';
import {
  DEFAULT_SAFETY_WARNING_AR,
  detectSafetySensitiveTopic,
  exportKnowledgeStoreJson,
  getKnowledgeStoreMetrics,
  hydrateKnowledgeStoreFromServer,
  ignoreQueueItem,
  importKnowledgeStoreJson,
  loadKnowledgeStoreState,
  mergeQueueItemIntoExistingEntry,
  rollbackKnowledgeStoreToSnapshot,
  saveDraftOnQueueItem,
  upsertKnowledgeEntryBySuperAdmin,
  type GlobalUnansweredQueueItem,
  type KnowledgeOptionChip,
  type KnowledgeStoreEntry,
  type KnowledgeStoreState,
} from '../../services/shamousaKnowledgeStore';

interface AdminShamousaIssuesPageProps {
  onBack: () => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

const PACKAGE_OPTIONS = [
  { id: 'core_free', label: 'الباقة الأساسية (للكل)' },
  { id: 'storefront_catalog', label: 'المتجر والكتالوج' },
  { id: 'production_pricing', label: 'التكاليف والتصنيع' },
  { id: 'inventory_purchases', label: 'المخزون والمشتريات' },
  { id: 'finance_crm', label: 'المالية والعملاء' },
  { id: 'ai_assistants', label: 'المساعدين الذكيين' },
];

export const AdminShamousaIssuesPage: React.FC<AdminShamousaIssuesPageProps> = ({
  onBack,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [store, setStore] = useState<KnowledgeStoreState>(() => loadKnowledgeStoreState());
  const [activeTab, setActiveTab] = useState<'queue' | 'knowledge' | 'snapshots' | 'landing_suggestions'>('queue');
  const [loading, setLoading] = useState(false);
  const [storageMode, setStorageMode] = useState<'supabase' | 'local'>('local');
  const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null);
  const [landingSuggestions, setLandingSuggestions] = useState<LandingVisitorSuggestionRecord[]>(() =>
    loadLandingVisitorSuggestions()
  );

  // نموذج "اكتب الإجابة" / "إضافة موضوع جديد"
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQueueItem, setEditingQueueItem] = useState<GlobalUnansweredQueueItem | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | undefined>(undefined);
  const [topic, setTopic] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [synonymsText, setSynonymsText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [specialty, setSpecialty] = useState('عام');
  const [relatedPackage, setRelatedPackage] = useState('core_free');
  const [safetyWarning, setSafetyWarning] = useState('');
  const [draftSourceNote, setDraftSourceNote] = useState('');

  // دمج سؤال مع سؤال موجود
  const [mergeTargetQueueId, setMergeTargetQueueId] = useState<string | null>(null);
  const [selectedMergeEntryId, setSelectedMergeEntryId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const syncFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/shamousa/knowledge');
      if (res.ok) {
        const data = await res.json();
        if (data?.store) {
          hydrateKnowledgeStoreFromServer(data.store);
          setStore(loadKnowledgeStoreState());
        }
        if (data?.storage === 'supabase') setStorageMode('supabase');
      }
      const sugRes = await authedFetch('/api/admin/shamousa/landing-suggestions');
      const localSugs = loadLandingVisitorSuggestions();
      if (sugRes.ok) {
        const sugData = await sugRes.json();
        const serverSugs: LandingVisitorSuggestionRecord[] = Array.isArray(sugData?.suggestions)
          ? sugData.suggestions
          : [];
        const byKey = new Map<string, LandingVisitorSuggestionRecord>();
        for (const s of [...serverSugs, ...localSugs]) {
          const dedupKey = `${s.id || ''}|${(s.suggestionText || '').trim()}`;
          if (!byKey.has(dedupKey)) byKey.set(dedupKey, s);
        }
        setLandingSuggestions(
          Array.from(byKey.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      } else {
        setLandingSuggestions(localSugs);
      }
    } catch {
      setLandingSuggestions(loadLandingVisitorSuggestions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncFromServer();
  }, [syncFromServer]);

  const persistToSupabase = useCallback(
    async (nextState: KnowledgeStoreState) => {
      setStore(nextState);
      try {
        const res = await authedFetch('/api/admin/shamousa/knowledge/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store: nextState }),
        });
        if (res.ok) {
          const d = await res.json().catch(() => ({}));
          if (d?.storage === 'supabase') setStorageMode('supabase');
        }
      } catch {
        // محفوظ محلياً وسيتزامن لاحقاً
      }
    },
    []
  );

  const metrics = useMemo(() => getKnowledgeStoreMetrics(store), [store]);

  const pendingQueue = useMemo(
    () =>
      (store.unansweredQueue || [])
        .filter((q) => q.status === 'pending' || q.status === 'draft_ready')
        .sort((a, b) => b.repeatCount - a.repeatCount),
    [store.unansweredQueue]
  );

  const approvedEntries = useMemo(
    () => (store.entries || []).filter((e) => e.status === 'approved'),
    [store.entries]
  );

  const unreadSuggestionsCount = useMemo(
    () => landingSuggestions.filter((s) => !s.readByAdmin).length,
    [landingSuggestions]
  );

  const handleMarkAllSuggestionsRead = async () => {
    markAllLandingSuggestionsReadLocal();
    setLandingSuggestions((prev) => prev.map((s) => ({ ...s, readByAdmin: true })));
    try {
      await authedFetch('/api/admin/shamousa/landing-suggestions/mark-read', {
        method: 'POST',
      });
    } catch {
      // محفوظ محلياً
    }
    onNotifySuccess('✅ تم تحديد كل مقترحات زوار صفحة الهبوط كمقروءة.');
  };

  const openEditorForQueueItem = (item: GlobalUnansweredQueueItem) => {
    setEditingQueueItem(item);
    setEditingEntryId(undefined);
    setTopic(item.sanitizedQuestion);
    const autoKw = item.sanitizedQuestion
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 6)
      .join('، ');
    setKeywordsText(autoKw);
    setSynonymsText('');
    setReplyText(item.draftAnswer || '');
    setOptionsText('');
    setSpecialty('عام');
    setRelatedPackage('core_free');
    setDraftSourceNote(item.draftSource || '');
    const safety = detectSafetySensitiveTopic(`${item.sanitizedQuestion} ${item.draftAnswer || ''}`);
    setSafetyWarning(safety.isSensitive ? DEFAULT_SAFETY_WARNING_AR : '');
    setEditorOpen(true);
  };

  const openEditorForNewEntry = () => {
    setEditingQueueItem(null);
    setEditingEntryId(undefined);
    setTopic('');
    setKeywordsText('');
    setSynonymsText('');
    setReplyText('');
    setOptionsText('');
    setSpecialty('عام');
    setRelatedPackage('core_free');
    setSafetyWarning('');
    setDraftSourceNote('');
    setEditorOpen(true);
  };

  const openEditorForExistingEntry = (entry: KnowledgeStoreEntry) => {
    setEditingQueueItem(null);
    setEditingEntryId(entry.id);
    setTopic(entry.topic);
    setKeywordsText(entry.keywords.join('، '));
    setSynonymsText(entry.synonyms.join('، '));
    setReplyText(entry.reply);
    setOptionsText(entry.options.map((o) => `${o.label} | ${o.queryText}`).join('\n'));
    setSpecialty(entry.specialty || 'عام');
    setRelatedPackage(entry.relatedPackage || 'core_free');
    setSafetyWarning(entry.safetyWarningAr || '');
    setDraftSourceNote(entry.draftSourceNote || '');
    setEditorOpen(true);
  };

  const handleSaveApprovedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !replyText.trim()) {
      onNotifyError('يرجى كتابة الموضوع والرد قبل الحفظ والاعتماد.');
      return;
    }

    const keywords = keywordsText
      .split(/[،,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const synonyms = synonymsText
      .split(/[،,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedOptions: KnowledgeOptionChip[] = optionsText
      .split(/\r?\n/)
      .map((l, idx) => {
        const [lbl, q] = l.split('|').map((p) => p.trim());
        if (!lbl) return null;
        return { id: `opt_${Date.now()}_${idx}`, label: lbl, queryText: q || lbl };
      })
      .filter(Boolean) as KnowledgeOptionChip[];

    const safetyCheck = detectSafetySensitiveTopic(`${topic} ${replyText}`);
    if (safetyCheck.isSensitive && !safetyWarning.trim()) {
      setSafetyWarning(DEFAULT_SAFETY_WARNING_AR);
      onNotifyError('هذا الموضوع يمس السلامة — تمت إضافة تحذير سلامة، راجعه ثم اضغط حفظ واعتماد.');
      return;
    }

    const finalReply =
      safetyWarning.trim() && !replyText.includes(safetyWarning.trim())
        ? `${replyText.trim()}\n\n${safetyWarning.trim()}`
        : replyText.trim();

    const { state: nextState } = upsertKnowledgeEntryBySuperAdmin({
      id: editingEntryId,
      topic: topic.trim(),
      keywords: keywords.length > 0 ? keywords : [topic.trim()],
      synonyms,
      questionVariants: editingQueueItem ? [editingQueueItem.sanitizedQuestion] : [],
      reply: finalReply,
      options: parsedOptions,
      specialty,
      relatedPackage,
      source: editingQueueItem?.draftAnswer ? 'approved_draft' : 'super_admin',
      status: 'approved',
      safetyWarningAr: safetyWarning.trim() || undefined,
      linkedQueueItemId: editingQueueItem?.id,
    });

    await persistToSupabase(nextState);
    setEditorOpen(false);
    setEditingQueueItem(null);
    setEditingEntryId(undefined);
    onNotifySuccess('✅ تم حفظ الموضوع واعتماده في المخزن المعرفي ويعمل الآن فوراً لكل الحسابات!');
  };

  const handlePrepareOnlineDraft = async (item: GlobalUnansweredQueueItem) => {
    setDraftLoadingId(item.id);
    try {
      const res = await authedFetch('/api/admin/shamousa/knowledge/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sanitizedQuestion: item.sanitizedQuestion }),
      });
      const data = await res.json();
      if (!res.ok || !data?.draftAnswer) {
        onNotifyError(data?.error || 'تعذر تجهيز مسودة حالياً — تأكد من الاتصال بالإنترنت.');
        return;
      }
      const nextState = saveDraftOnQueueItem(
        item.id,
        String(data.draftAnswer),
        String(data.source || 'مسودة بالمساعد الذكي (بانتظار اعتماد السوبر أدمن)')
      );
      await persistToSupabase(nextState);
      onNotifySuccess('✨ تم تجهيز مسودة (بحالة مسودة فقط — لن تظهر للمستخدمين قبل موافقتك واعتمادك).');
    } catch {
      onNotifyError('تعذر الاتصال بالخادم لتجهيز المسودة.');
    } finally {
      setDraftLoadingId(null);
    }
  };

  const handleIgnoreItem = async (id: string) => {
    const nextState = ignoreQueueItem(id);
    await persistToSupabase(nextState);
    onNotifySuccess('تم تجاهل السؤال وإخفاؤه من الطابور.');
  };

  const handleConfirmMerge = async () => {
    if (!mergeTargetQueueId || !selectedMergeEntryId) return;
    const { ok, state: nextState } = mergeQueueItemIntoExistingEntry(
      mergeTargetQueueId,
      selectedMergeEntryId
    );
    if (ok) {
      await persistToSupabase(nextState);
      onNotifySuccess('✅ تم دمج صيغة السؤال وكلماته داخل الموضوع المعتمد بنجاح!');
    }
    setMergeTargetQueueId(null);
    setSelectedMergeEntryId('');
  };

  const handleExportJson = () => {
    const json = exportKnowledgeStoreJson(store);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shamousa-knowledge-v${store.storeVersion}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotifySuccess('📥 تم تصدير المخزن المعرفي بنجاح كملف JSON.');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = importKnowledgeStoreJson(text);
      if (!res.ok) {
        onNotifyError(res.errorAr || 'فشل الاستيراد.');
        return;
      }
      await persistToSupabase(res.state);
      onNotifySuccess(`✅ تم استيراد ${res.importedEntriesCount} موضوع وحفظ نسخة احتياطية قبل الاستيراد!`);
    } catch {
      onNotifyError('تعذر قراءة الملف المختار.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRollback = async (snapshotId: string) => {
    const res = rollbackKnowledgeStoreToSnapshot(snapshotId);
    if (res.ok) {
      await persistToSupabase(res.state);
      onNotifySuccess('⏪ تم استرجاع النسخة السابقة للمخزن المعرفي بنجاح.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-5" dir="rtl">
      {/* الشريط العلوي */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center hover:border-amber-500 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-amber-600" />
              <span>مشاكل شموسة والمخزن المعرفي</span>
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              طابور الأسئلة غير المفهومة (منقّى تماماً من أي بيانات شخصية) • المخزن العام الدائم ({storageMode === 'supabase' ? 'Supabase' : 'نسخة محلية'}) • الإصدار v{store.storeVersion}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openEditorForNewEntry}
            className="px-3 py-2 rounded-xl bg-[#142A5C] hover:bg-[#1E3F8A] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة موضوع معتمد</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير JSON</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>استيراد JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportJsonFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => void syncFromServer()}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* مقاييس السوبر أدمن الأربعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5">
          <div className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">نسبة الإجابة المحلية بدون AI</div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {metrics.localAnswerRatePercent}%
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">
            محلي: {metrics.localAnsweredCount} • AI مساعد: {metrics.aiAssistantUsedCount}
          </div>
        </div>
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5">
          <div className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">حجم طابور الأسئلة المعلقة</div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
            {metrics.pendingQueueCount}
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">مرتبة بالأكثر تكراراً</div>
        </div>
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5">
          <div className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">الأكثر تكراراً الآن</div>
          <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] mt-1 line-clamp-2">
            {metrics.topRepeatedQuestions[0]
              ? `${metrics.topRepeatedQuestions[0].sanitizedQuestion} (${metrics.topRepeatedQuestions[0].repeatCount}×)`
              : 'لا توجد أسئلة متكررة حالياً'}
          </div>
        </div>
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5">
          <div className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">المضاف هذا الأسبوع</div>
          <div className="text-2xl font-black text-[#142A5C] dark:text-sky-300 mt-1">
            {metrics.addedThisWeekCount}
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">
            إجمالي المعتمد: {metrics.approvedEntriesCount} موضوع
          </div>
        </div>
      </div>

      {/* التبويبات الداخلية */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
            activeTab === 'queue'
              ? 'bg-[#142A5C] text-white'
              : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#CBD5E1]'
          }`}
        >
          طابور الأسئلة غير المفهومة ({pendingQueue.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('knowledge')}
          className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
            activeTab === 'knowledge'
              ? 'bg-[#142A5C] text-white'
              : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#CBD5E1]'
          }`}
        >
          المخزن المعرفي المعتمد ({approvedEntries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('snapshots')}
          className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition flex items-center gap-1 ${
            activeTab === 'snapshots'
              ? 'bg-[#142A5C] text-white'
              : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#CBD5E1]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>النسخ السابقة للرجوع ({(store.snapshots || []).length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('landing_suggestions')}
          className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition flex items-center gap-1.5 ${
            activeTab === 'landing_suggestions'
              ? 'bg-[#142A5C] text-white'
              : 'bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#CBD5E1]'
          }`}
        >
          <BellRing className="w-3.5 h-3.5" />
          <span>مقترحات زوار صفحة الهبوط ({landingSuggestions.length})</span>
          {unreadSuggestionsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
              {unreadSuggestionsCount} جديد
            </span>
          )}
        </button>
      </div>

      {/* تبويب 1: طابور الأسئلة مرتب بالتكرار مع الأزرار الأربعة */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          {pendingQueue.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                الطابور نظيف تماماً — لا توجد أسئلة معلقة حالياً!
              </p>
              <p className="text-xs text-[#64748B]">
                أي سؤال لا تجد له شموسة إجابة مؤكدة سيصل هنا تلقائياً بعد إزالة كل البيانات الشخصية.
              </p>
            </div>
          ) : (
            pendingQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px] font-black">
                        تكرر {item.repeatCount} مرة
                      </span>
                      {item.status === 'draft_ready' && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-800 dark:text-sky-300 text-[11px] font-black">
                          مسودة جاهزة للمراجعة (غير منشورة)
                        </span>
                      )}
                      {item.requiresSafetyReview && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[11px] font-black inline-flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          مراجعة سلامة إلزامية
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                      {item.sanitizedQuestion}
                    </h3>
                  </div>
                </div>

                {item.draftAnswer && (
                  <div className="rounded-xl bg-white/80 dark:bg-[#132040] border border-sky-300/60 dark:border-sky-700/60 p-3 space-y-1">
                    <div className="text-[11px] font-black text-sky-800 dark:text-sky-300">
                      مسودة مقترحة ({item.draftSource || 'بحاجة لاعتمادك'}):
                    </div>
                    <p className="text-xs text-[#334155] dark:text-[#E2E8F0] whitespace-pre-wrap">
                      {item.draftAnswer}
                    </p>
                  </div>
                )}

                {/* الأزرار الأربعة المطلوبة بالضبط */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditorForQueueItem(item)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
                  >
                    ✍️ اكتب الإجابة
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePrepareOnlineDraft(item)}
                    disabled={draftLoadingId === item.id}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{draftLoadingId === item.id ? 'جاري تجهيز المسودة...' : 'جهّز مسودة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMergeTargetQueueId(item.id);
                      setSelectedMergeEntryId(approvedEntries[0]?.id || '');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#1A2B54] border border-[#D4CCBC] dark:border-[#2D4475] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>ادمجه مع سؤال موجود</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleIgnoreItem(item.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تجاهل</span>
                  </button>
                </div>

                {mergeTargetQueueId === item.id && (
                  <div className="rounded-xl bg-white dark:bg-[#091533] border border-amber-400 p-3 flex flex-wrap items-center gap-2">
                    <select
                      value={selectedMergeEntryId}
                      onChange={(e) => setSelectedMergeEntryId(e.target.value)}
                      className="flex-1 min-w-[200px] h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
                    >
                      {approvedEntries.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.topic} ({ent.specialty})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleConfirmMerge()}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black cursor-pointer"
                    >
                      تأكيد الدمج
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeTargetQueueId(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* تبويب 2: المخزن المعرفي المعتمد */}
      {activeTab === 'knowledge' && (
        <div className="space-y-3">
          {approvedEntries.map((ent) => (
            <div
              key={ent.id}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Brain className="w-4 h-4 text-[#142A5C] dark:text-amber-400" />
                  <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">{ent.topic}</h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                    معتمد • v{ent.version}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#E9E2D4] dark:bg-[#1A2B54] text-[10px] font-bold">
                    {ent.specialty}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-800 dark:text-sky-300 text-[10px] font-bold">
                    {ent.source === 'library' ? 'مكتبة' : ent.source === 'approved_draft' ? 'مسودة معتمدة' : 'كتبه السوبر أدمن'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openEditorForExistingEntry(ent)}
                  className="px-3 py-1 rounded-lg bg-[#142A5C] text-white text-[11px] font-black cursor-pointer"
                >
                  تعديل
                </button>
              </div>
              <p className="text-xs text-[#334155] dark:text-[#CBD5E1] whitespace-pre-wrap">{ent.reply}</p>
              <div className="text-[11px] text-[#64748B]">
                كلمات مفتاحية: {ent.keywords.join('، ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* تبويب 3: النسخ السابقة للرجوع */}
      {activeTab === 'snapshots' && (
        <div className="space-y-2.5">
          {(store.snapshots || []).length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-6 text-center text-xs text-[#64748B]">
              تُحفظ نسخة تلقائية هنا قبل كل تعديل أو دمج أو استيراد للرجوع إليها بضغطة واحدة.
            </div>
          ) : (
            (store.snapshots || []).map((snap) => (
              <div
                key={snap.snapshotId}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                    الإصدار v{snap.version} — {snap.labelAr}
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    {snap.entries.length} موضوع • {new Date(snap.createdAt).toLocaleString('ar-EG')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRollback(snap.snapshotId)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
                >
                  ⏪ استرجاع هذه النسخة
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* تبويب 4: مقترحات زوار صفحة الهبوط من شموسة */}
      {activeTab === 'landing_suggestions' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5">
            <div>
              <h3 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                مقترحات وأفكار زوار صفحة الهبوط الواردة من شموسة
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                عندما يسأل زائر عن ميزة أو فكرة غير موجودة بعد في المنظومة، تجمع شموسة مقترحه وتُرسله هنا مباشرة.
              </p>
            </div>
            {unreadSuggestionsCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllSuggestionsRead()}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد الكل كمقروء ({unreadSuggestionsCount})</span>
              </button>
            )}
          </div>

          {landingSuggestions.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center space-y-1.5">
              <BellRing className="w-7 h-7 text-amber-600 mx-auto" />
              <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                لا توجد مقترحات جديدة من زوار صفحة الهبوط حتى الآن
              </p>
              <p className="text-xs text-[#64748B]">
                أي فكرة أو ميزة جديدة يقترحها زائر على شموسة صفحة الهبوط ستظهر هنا فوراً بإشعار جديد.
              </p>
            </div>
          ) : (
            landingSuggestions.map((sug) => (
              <div
                key={sug.id}
                className={`rounded-2xl border p-4 space-y-2 ${
                  !sug.readByAdmin
                    ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-400/70 dark:border-amber-600/60'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {!sug.readByAdmin && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black">
                        إشعار جديد
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-[#E9E2D4] dark:bg-[#1A2B54] text-[10px] font-black">
                      دور الزائر: {sug.visitorRole === 'artisan' ? 'فنان / ورشة' : sug.visitorRole === 'supplier' ? 'مورد خامات' : sug.visitorRole === 'customer' ? 'عميل' : sug.visitorRole === 'trainer' ? 'مدرب / خبير' : 'زائر'}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    {new Date(sug.createdAt).toLocaleString('ar-EG')}
                  </span>
                </div>
                {sug.originalQuestion && sug.originalQuestion !== sug.suggestionText && (
                  <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                    السؤال الأصلي: «{sug.originalQuestion}»
                  </p>
                )}
                <p className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] whitespace-pre-wrap">
                  {sug.suggestionText}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* نافذة كتابة الإجابة والاعتماد */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <form
            onSubmit={handleSaveApprovedEntry}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2.5">
              <h2 className="text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                {editingEntryId ? 'تعديل موضوع في المخزن المعرفي' : 'كتابة واعتماد إجابة في المخزن المعرفي'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {draftSourceNote && (
              <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300/60 p-2.5 text-[11px] font-bold text-sky-900 dark:text-sky-200">
                مصدر المسودة: {draftSourceNote} (راجع وعدّل بحريتك — لن تُنشر إلا بضغط «حفظ واعتماد»).
              </div>
            )}

            <label className="block space-y-1">
              <span className="text-xs font-black">الموضوع / السؤال الرئيسي *</span>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-black">الكلمات المفتاحية (افصل بفاصلة)</span>
                <input
                  type="text"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="فقاعات، ريزن، هواء"
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-black">مرادفات وصيغ إضافية</span>
                <input
                  type="text"
                  value={synonymsText}
                  onChange={(e) => setSynonymsText(e.target.value)}
                  placeholder="بابلز، فقاقيع، ايبوكسي"
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-black">التخصص</span>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="عام / مكرمية / ريزن / شموع..."
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-black">الباقة المرتبطة</span>
                <select
                  value={relatedPackage}
                  onChange={(e) => setRelatedPackage(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
                >
                  {PACKAGE_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-black">رد شموسة المعتمد *</span>
              <textarea
                required
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full p-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-black">أزرار اختيارات بعد الرد (اختياري — سطر لكل زر: النص | السؤال)</span>
              <textarea
                rows={2}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={'أفكار تصوير 🎬 | أفكار فيديو وتصوير ريزن'}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                تحذير السلامة (إلزامي في الكيماويات/الريزن/الحرارة/الكهرباء/الشموع/الأطفال)
              </span>
              <textarea
                rows={2}
                value={safetyWarning}
                onChange={(e) => setSafetyWarning(e.target.value)}
                placeholder="اتركه فارغاً لو الموضوع لا يمس السلامة"
                className="w-full p-2.5 rounded-xl bg-white dark:bg-[#091533] border border-rose-300 dark:border-rose-700 text-xs font-bold"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-xs font-black cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
              >
                ✅ حفظ واعتماد فوراً لكل الحسابات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
