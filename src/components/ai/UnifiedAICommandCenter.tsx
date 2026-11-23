import React, { useState, useEffect } from 'react';
import { UserProfile, CraftCategory } from '../../types';
import { FalconAIAgent, StructuredCalculatorExport } from './FalconAIAgent';
import {
  shamousaSearchIconImg,
  FalconMascotAvatar,
  ShamousaMascotAvatar,
} from '../brand/BrandAssets';
import {
  Sparkles,
  Cpu,
  Brain,
  ShieldCheck,
  Send,
  Database,
  RefreshCw,
  Flame,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lock,
  Globe,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { playSuccessSound, playAlertSound, playErrorSound } from '../../lib/sounds';
import { authedFetch } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';
import {
  resolveShamousaLocalChatbot,
  saveLocalShamousaRule,
  setServerShamousaRules,
  ShamousaChatbotOption,
  ShamousaConversationState,
} from '../../services/shamousaLocalChatbot';

interface UnifiedAICommandCenterProps {
  profile: UserProfile;
  currentCategory?: CraftCategory;
  onApplyCategoryFromAI?: (category: CraftCategory) => void;
  onApplyEstimatedLaborWage?: (wage: number, hours: number) => void;
  onTransferNotesToCalculator?: (notes: string) => void;
  onExportStructuredToCalculator?: (data: StructuredCalculatorExport) => void;
  onNavigateHome?: () => void;
}

export const UnifiedAICommandCenter: React.FC<UnifiedAICommandCenterProps> = ({
  profile,
  currentCategory = 'جدارية',
  onApplyCategoryFromAI,
  onApplyEstimatedLaborWage,
  onTransferNotesToCalculator,
  onExportStructuredToCalculator,
  onNavigateHome,
}) => {
  const [activeAIAgent, setActiveAIAgent] = useState<'falcon' | 'shamousa'>('falcon');
  const [falconFullscreen, setFalconFullscreen] = useState<boolean>(true);

  // Shamousa Independent Console State
  const [shamousaMessages, setShamousaMessages] = useState<
    Array<{
      role: 'user' | 'model';
      text: string;
      time: string;
      sources?: Array<{ title: string; url: string }>;
      searchUsed?: boolean;
      chatbotOptions?: ShamousaChatbotOption[];
    }>
  >([
    {
      role: 'model',
      text: 'أهلاً يا حسام 🌞، أنا شموسة مديرة أعمالك الذكية (متحدّثة بدليل التغذية الإصدار 1 وكل معادلات الورش والخامات الموحدة). تقدر تبدأ برمجة ("هبرمجك")، أو تختبر أسئلة القبول الـ 12، أو تراجع الأسئلة اللي ما عرفتش أجاوب عليها من اللوحة الجانبية:',
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      chatbotOptions: [
        { id: 'cmd_price', label: '🧮 عايز أسعّر قطعة مكرمية', queryText: 'عايز اسعر قطعة مكرمية' },
        { id: 'cmd_mat', label: '🏷️ الخامات الموحدة', queryText: 'منظومة الخامات الموحدة' },
        { id: 'cmd_waste', label: '📏 الهالك والمصنعية', queryText: 'هو الهالك بيتحسب ازاي' },
      ],
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const [inTrainingMode, setInTrainingMode] = useState(false);
  const [pendingTrainingBuffer, setPendingTrainingBuffer] = useState<string[]>([]);
  const [activeMemories, setActiveMemories] = useState<any[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'memories' | 'unanswered'>('unanswered');
  const [unansweredQuestions, setUnansweredQuestions] = useState<any[]>([]);
  const [loadingUnanswered, setLoadingUnanswered] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveDrafts, setResolveDrafts] = useState<Record<string, { keywords: string; answer: string }>>({});
  const shamousaStateRef = React.useRef<ShamousaConversationState>({});

  const getAdminAuthHeaders = async () => {
    const headers: Record<string, string> = {
      'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
    };
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
    } catch {}
    return headers;
  };

  // Load Active Global Memories
  const loadMemories = async () => {
    setLoadingMemories(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/memories', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.memories)) {
          setActiveMemories(data.memories);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingMemories(false);
    }
  };

  // Load Unanswered Shamousa Questions (Super Admin dictionary feeder)
  const loadUnansweredQuestions = async () => {
    setLoadingUnanswered(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/shamousa/unanswered', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions)) {
          setUnansweredQuestions(data.questions);
        }
        if (Array.isArray(data.rules)) {
          setServerShamousaRules(data.rules);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingUnanswered(false);
    }
  };

  const handleResolveUnanswered = async (item: any) => {
    const draft = resolveDrafts[item.id] || { keywords: item.question, answer: '' };
    if (!draft.answer.trim()) return;
    setResolvingId(item.id);
    try {
      const headers = {
        ...(await getAdminAuthHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`/api/admin/shamousa/unanswered/${encodeURIComponent(item.id)}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: item.question.slice(0, 60),
          keywords: draft.keywords || item.question,
          answer: draft.answer.trim(),
        }),
      });
      if (res.ok) {
        playSuccessSound();
        await Promise.all([loadUnansweredQuestions(), loadMemories()]);
      } else {
        playErrorSound();
      }
    } catch {
      playErrorSound();
    } finally {
      setResolvingId(null);
    }
  };

  const handleDeleteUnanswered = async (id: string) => {
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/shamousa/unanswered/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setUnansweredQuestions((prev) => prev.filter((q) => q.id !== id));
        playAlertSound();
      }
    } catch {}
  };

  const handleDeleteMemory = async (memId: string) => {
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/memories/${encodeURIComponent(memId)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setActiveMemories((prev) => prev.filter((m) => m.id !== memId));
        playAlertSound();
      }
    } catch {}
  };

  useEffect(() => {
    if (activeAIAgent === 'shamousa') {
      loadMemories();
      loadUnansweredQuestions();
    }
  }, [activeAIAgent]);

  const handleSendShamousa = async (textToSend?: string, opts?: { forceAI?: boolean }) => {
    const msg = (textToSend || inputMessage).trim();
    if (!msg || sending) return;

    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user' as const, text: msg, time };
    setShamousaMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setSending(true);

    const isTrainingCommand = ['هبرمجك', 'فهمت؟!', 'احفظ', 'هنكمل', 'كده تمام'].includes(msg);

    // Quick local tracking of Super Admin training protocol
    if (msg === 'هبرمجك') {
      setInTrainingMode(true);
      setPendingTrainingBuffer([]);
      playAlertSound();
    } else if (msg === 'فهمت؟!') {
      playSuccessSound();
    } else if (msg === 'احفظ') {
      if (pendingTrainingBuffer.length > 0) {
        const joinedRule = pendingTrainingBuffer.join('\n').trim();
        const keywords = Array.from(
          new Set(
            joinedRule
              .split(/\s+/)
              .map((w) => w.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, ''))
              .filter((w) => w.length >= 3)
              .slice(0, 6)
          )
        );
        saveLocalShamousaRule({
          title: 'قاعدة السوبر أدمن',
          keywords,
          answer: `📌 **قاعدة السوبر أدمن المحفوظة:**\n${joinedRule}`,
        });
        setPendingTrainingBuffer([]);
      }
      playSuccessSound();
    } else if (msg === 'كده تمام') {
      setInTrainingMode(false);
      setPendingTrainingBuffer([]);
      playSuccessSound();
    } else if (inTrainingMode && msg !== 'هنكمل') {
      setPendingTrainingBuffer((prev) => [...prev, msg]);
    }

    // 1. In normal consultation mode (not training mode, not live web search, not forceAI), use local smart engine first!
    if (!inTrainingMode && !isTrainingCommand && !useGoogleSearch && !opts?.forceAI) {
      const localRes = resolveShamousaLocalChatbot(msg, {
        firstName: (profile.artistName || 'حسام').split(/\s+/)[0],
        isSupplier: false,
        state: shamousaStateRef.current,
      });
      if (localRes.nextState) {
        shamousaStateRef.current = localRes.nextState;
      }
      if (localRes.isUnanswered && msg.length >= 2) {
        authedFetch('/api/shamousa/unanswered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: msg, accountRole: 'artisan' }),
        })
          .then(() => loadUnansweredQuestions())
          .catch(() => {});
      }
      if (localRes.handled && localRes.reply) {
        setShamousaMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: localRes.reply,
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            chatbotOptions: localRes.options,
          },
        ]);
        playSuccessSound();
        setSending(false);
        return;
      }
    }

    try {
      const res = await authedFetch('/api/ai/shamousa/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tube@gmail.com',
        },
        body: JSON.stringify({
          message: msg,
          useSearch: useGoogleSearch,
          userEmail: profile.email || 'hmb.top.tube@gmail.com',
          workshopId: profile.workshopId || profile.id,
          brandName: profile.brandName,
          artistName: profile.artistName,
          history: shamousaMessages.slice(-8).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'فشل الاتصال مع محرك الذكاء الاصطناعي');
      }

      const json = await res.json();
      const reply = json.reply || 'تم استلام التوجيه وحفظه بالمنظومة.';
      setShamousaMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: reply,
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          sources: Array.isArray(json.sources) ? json.sources : undefined,
          searchUsed: Boolean(json.searchUsed),
        },
      ]);
      playSuccessSound();

      if (msg === 'احفظ') {
        loadMemories();
      }
    } catch (err: any) {
      // Fallback safely to local smart engine if live providers fail during consultation or offline training
      if (inTrainingMode && msg === 'احفظ') {
        setShamousaMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: '💾 تم حفظ القاعدة في ذاكرة شموسة وتعمل الآن فوراً في المنظومة.',
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        playSuccessSound();
      } else if (inTrainingMode) {
        setShamousaMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text:
              msg === 'هبرمجك'
                ? '🔴 وضع البرمجة نشط الآن يا هندسة! ابعتلي القواعد اللي عاوز تضيفها ولما تخلص قول "احفظ" ثم "كده تمام".'
                : msg === 'فهمت؟!'
                ? '✅ أيوه تمام، استلمت القاعدة وجاهزة للحفظ بمجرد ما تقول "احفظ".'
                : msg === 'كده تمام'
                ? '🟢 تم الخروج من وضع التدريب وتفعيل وضع الاستشارة الذكي.'
                : '📥 استلمت التوجيه في مسودة التدريب. تقدر تضيف توجيهات تانية أو تقول "احفظ".',
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        playSuccessSound();
      } else {
        const localFallback = resolveShamousaLocalChatbot(msg, {
          firstName: (profile.artistName || 'حسام').split(/\s+/)[0],
          isSupplier: false,
          state: shamousaStateRef.current,
        });
        playAlertSound();
        setShamousaMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text:
              `${localFallback.reply}\n\n_(ملاحظة تقنية للسوبر أدمن: تعذر اتصال البحث الحي حالياً — ${err.message || 'بدون شبكة'})_`,
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            chatbotOptions: localFallback.options,
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 font-sans text-right" dir="rtl">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-amber-500/30">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/40 font-mono font-bold">
                Unified AI Command Center
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                👑 رصيد لا نهائي (Super Admin)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-amber-300">
              مركز المساعد الذكي المستقل (صقر الشمساوية & شموسة)
            </h1>
            <p className="text-xs text-stone-300 max-w-3xl leading-relaxed">
              منصة الذكاء الاصطناعي المركزية لإدارة وتدريب المنظومة، التحليل البصري والحرفي، التوجيهات الهندسية، وحقن القواعد البرمجية اللحظية.
            </p>
          </div>

          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-4 py-2 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <ArrowRight size={15} />
              <span>العودة للوحة التحكم</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Dual Command Cards Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Falcon AI */}
        <button
          type="button"
          onClick={() => {
            setActiveAIAgent('falcon');
            setFalconFullscreen(true);
          }}
          className={`p-5 rounded-3xl border-2 transition-all text-right cursor-pointer shadow-sm relative overflow-hidden group ${
            activeAIAgent === 'falcon'
              ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-white border-amber-400 ring-4 ring-amber-500/20 scale-[1.01]'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-amber-400 text-stone-800 dark:text-stone-200'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 dark:bg-amber-950/40 flex items-center justify-center p-1 shadow-xs">
              <FalconMascotAvatar size="md" statusDot={false} />
            </div>
            <span
              className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                activeAIAgent === 'falcon'
                  ? 'bg-white text-amber-900 font-bold'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
              }`}
            >
              المساعد الفني والهندسي
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black mb-1">
            صقر الشمساوية (Falcon AI)
          </h2>
          <p
            className={`text-xs leading-relaxed ${
              activeAIAgent === 'falcon' ? 'text-amber-100' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            التحليل البصري الذكي للصور، تفكيك الغرز، حساب الهوالك والأمتار، واستخراج جداول التكاليف التلقائية للحاسبة.
          </p>
        </button>

        {/* Card 2: Shamousa */}
        <button
          type="button"
          onClick={() => setActiveAIAgent('shamousa')}
          className={`p-5 rounded-3xl border-2 transition-all text-right cursor-pointer shadow-sm relative overflow-hidden group ${
            activeAIAgent === 'shamousa'
              ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-white border-amber-400 ring-4 ring-amber-500/20 scale-[1.01]'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-amber-400 text-stone-800 dark:text-stone-200'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-amber-300/80 bg-white/20 dark:bg-amber-950/40 flex items-center justify-center p-1 shadow-xs">
              <ShamousaMascotAvatar size="md" statusDot={false} />
            </div>
            <span
              className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                activeAIAgent === 'shamousa'
                  ? 'bg-white text-amber-900 font-bold'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
              }`}
            >
              مديرة الأعمال وتدريب المنظومة
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black mb-1">
            شموسة (Shamousa Ingestion)
          </h2>
          <p
            className={`text-xs leading-relaxed ${
              activeAIAgent === 'shamousa' ? 'text-amber-100' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            التدريب البرمجي المباشر ("هبرمجك")، إدارة الذاكرة الدائمة للمنظومة، واستعلامات الإشراف على كافة الورش.
          </p>
        </button>
      </div>

      {/* 3. Main Agent View Content */}
      {activeAIAgent === 'falcon' ? (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 shadow-sm space-y-3">
          {!falconFullscreen && (
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
              <span className="text-xs font-black text-stone-700 dark:text-stone-300">
                مستشار صقر الشمساوية AI 🦅
              </span>
              <button
                type="button"
                onClick={() => setFalconFullscreen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition cursor-pointer shadow-xs"
              >
                فتح صقر ملء الشاشة 🦅
              </button>
            </div>
          )}
          <FalconAIAgent
            profile={profile}
            currentCategory={currentCategory as CraftCategory}
            onApplyCategoryFromAI={onApplyCategoryFromAI || (() => {})}
            onApplyEstimatedLaborWage={onApplyEstimatedLaborWage || (() => {})}
            onTransferNotesToCalculator={onTransferNotesToCalculator || (() => {})}
            onExportStructuredToCalculator={onExportStructuredToCalculator}
            isFullscreen={falconFullscreen}
            onClose={() => setFalconFullscreen(false)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Shamousa Chat & Interaction Console */}
          <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 shadow-sm flex flex-col h-[650px]">
            {/* Top Bar */}
            <div className="pb-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌞</span>
                <div>
                  <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    محادثة وتوجيه "شموسة" — مديرة الأعمال الذكية
                  </h3>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    {inTrainingMode ? '🔴 وضع التدريب البرمجي المباشر نشط الآن' : '🟢 وضع الاستشارة والإشراف العام'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-stone-400 font-bold">
                  حساب السوبر أدمن المعتمد
                </span>
              </div>
            </div>

            {/* Quick Training Protocol Action Chips */}
            <div className="py-2.5 px-3 my-2 rounded-2xl bg-amber-50/70 dark:bg-stone-850 border border-amber-200/80 dark:border-stone-750 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 shrink-0">
                مفاتيح التدريب:
              </span>
              <button
                type="button"
                onClick={() => handleSendShamousa('هبرمجك')}
                className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] transition cursor-pointer shrink-0 shadow-2xs"
              >
                هبرمجك
              </button>
              <button
                type="button"
                onClick={() => handleSendShamousa('فهمت؟!')}
                className="px-2.5 py-1 rounded-xl bg-stone-200 dark:bg-stone-750 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-bold text-[11px] transition cursor-pointer shrink-0"
              >
                فهمت؟!
              </button>
              <button
                type="button"
                onClick={() => handleSendShamousa('احفظ')}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] transition cursor-pointer shrink-0 shadow-2xs"
              >
                احفظ
              </button>
              <button
                type="button"
                onClick={() => handleSendShamousa('هنكمل')}
                className="px-2.5 py-1 rounded-xl bg-stone-200 dark:bg-stone-750 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-bold text-[11px] transition cursor-pointer shrink-0"
              >
                هنكمل
              </button>
              <button
                type="button"
                onClick={() => handleSendShamousa('كده تمام')}
                className="px-2.5 py-1 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-[11px] transition cursor-pointer shrink-0"
              >
                كده تمام
              </button>
            </div>

            {/* Chat Messages Scroll */}
            <div className="flex-1 overflow-y-auto space-y-3 p-2 text-xs">
              {shamousaMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                      m.role === 'user' ? 'bg-amber-600 text-white text-sm' : 'bg-amber-100 dark:bg-amber-950 border border-amber-400/80 p-0.5'
                    }`}
                  >
                    {m.role === 'user' ? (
                      '👑'
                    ) : (
                      <ShamousaMascotAvatar size="xs" statusDot={false} />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-amber-600 text-white rounded-br-none shadow-xs font-bold'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-bl-none border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    {(m.searchUsed || (m.sources && m.sources.length > 0)) && (
                      <div className="mt-2 pt-2 border-t border-stone-200 dark:border-stone-700 space-y-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          <Globe className="w-3 h-3" />
                          <span>بحث جوجل الحي</span>
                        </span>
                        {m.sources && m.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {m.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
                              >
                                <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                                <span className="truncate max-w-[150px]">{src.title || src.url}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {m.chatbotOptions && m.chatbotOptions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.chatbotOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (opt.triggerFalcon) {
                                setActiveAIAgent('falcon');
                              } else if (opt.triggerAI) {
                                const lastU = [...shamousaMessages.slice(0, idx)].reverse().find((x) => x.role === 'user');
                                handleSendShamousa(lastU?.text || 'لخصيلي وضع المنظومة الآن', { forceAI: true });
                              } else if (opt.queryText) {
                                handleSendShamousa(opt.queryText);
                              }
                            }}
                            className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-600 hover:text-white text-amber-900 dark:text-amber-300 border border-amber-400/50 text-[11px] font-bold transition cursor-pointer"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <span className="text-[9px] opacity-70 block mt-1 text-left font-mono" dir="ltr">
                      {m.time}
                    </span>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-amber-600 text-xs font-bold p-2">
                  <Sparkles size={16} className="animate-spin" />
                  <span>شموسة تكتب وتفكر الآن...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendShamousa();
              }}
              className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setUseGoogleSearch((v) => !v)}
                aria-pressed={useGoogleSearch}
                title={useGoogleSearch ? 'بحث جوجل الحي مُفعّل لشموسة' : 'تفعيل بحث جوجل الحي'}
                className={`p-1.5 rounded-2xl transition-all flex items-center justify-center cursor-pointer shrink-0 ${
                  useGoogleSearch
                    ? 'bg-emerald-500 text-white shadow-[0_0_14px_rgba(16,185,129,0.7)] ring-2 ring-emerald-400/70'
                    : 'bg-transparent hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <img
                  src={shamousaSearchIconImg}
                  alt="بحث شموسة"
                  draggable={false}
                  className="w-7 h-7 object-contain select-none pointer-events-none"
                />
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="اكتب لشموسة أو ابدأ بروتوكول التدريب 'هبرمجك'..."
                className="flex-1 px-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 text-right"
              />
              <button
                type="submit"
                disabled={sending || !inputMessage.trim()}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Send size={14} />
                <span>إرسال</span>
              </button>
            </form>
          </div>

          {/* Right Panel: Unanswered Shamousa Questions + AI Global Memory */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 shadow-sm space-y-3 flex flex-col h-[650px]">
            {/* Sub-tabs switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-850 border border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setRightPanelTab('unanswered')}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === 'unanswered'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <BookOpen size={13} />
                <span>أسئلة لم تُجب</span>
                {unansweredQuestions.filter((q) => q.status !== 'resolved').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono">
                    {unansweredQuestions.filter((q) => q.status !== 'resolved').length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('memories')}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === 'memories'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Database size={13} />
                <span>الذاكرة الدائمة</span>
              </button>
            </div>

            {rightPanelTab === 'unanswered' ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                  <div>
                    <h3 className="text-xs font-black text-stone-900 dark:text-stone-100">
                      أسئلة لم تجب عليها شموسة
                    </h3>
                    <p className="text-[10px] text-stone-500">
                      أضف إجابة وكلمات مفتاحية لتُضاف فوراً لقاموس شموسة للجميع
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadUnansweredQuestions}
                    disabled={loadingUnanswered}
                    className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
                    title="تحديث الأسئلة"
                  >
                    <RefreshCw size={13} className={loadingUnanswered ? 'animate-spin text-amber-500' : ''} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 text-xs">
                  {unansweredQuestions.length === 0 ? (
                    <div className="p-6 text-center text-stone-400 space-y-2">
                      <CheckCircle2 size={32} className="mx-auto text-emerald-500/70" />
                      <p className="text-[11px] font-bold">مفيش أسئلة معلّقة حالياً — شموسة مجاوبة على كل حاجة!</p>
                    </div>
                  ) : (
                    unansweredQuestions.map((item) => {
                      const isResolved = item.status === 'resolved';
                      const draft = resolveDrafts[item.id] || {
                        keywords: item.question,
                        answer: item.resolvedAnswer || '',
                      };
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl border space-y-2 ${
                            isResolved
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40'
                              : 'bg-stone-50 dark:bg-stone-850 border-amber-300/70 dark:border-amber-800/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-black text-stone-900 dark:text-stone-100 text-[11px] leading-relaxed">
                                «{item.question}»
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-stone-500">
                                <span>{item.accountRole === 'supplier' ? 'مورد' : 'فنان/ورشة'}</span>
                                <span>•</span>
                                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                                  تكرر {item.count || 1}×
                                </span>
                                {isResolved && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                    • تمت الإضافة للقاموس ✅
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteUnanswered(item.id)}
                              title="حذف السؤال"
                              className="p-1 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {!isResolved ? (
                            <div className="space-y-1.5 pt-1">
                              <input
                                type="text"
                                value={draft.keywords}
                                onChange={(e) =>
                                  setResolveDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: { ...draft, keywords: e.target.value },
                                  }))
                                }
                                placeholder="كلمات مفتاحية (افصل بفاصلة ،)"
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[11px] outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              <textarea
                                rows={2}
                                value={draft.answer}
                                onChange={(e) =>
                                  setResolveDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: { ...draft, answer: e.target.value },
                                  }))
                                }
                                placeholder="اكتب إجابة شموسة المعتمدة..."
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[11px] outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                              />
                              <button
                                type="button"
                                disabled={!draft.answer.trim() || resolvingId === item.id}
                                onClick={() => handleResolveUnanswered(item)}
                                className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-black transition cursor-pointer"
                              >
                                {resolvingId === item.id ? 'جاري الحفظ...' : 'إضافة للقاموس وحل السؤال ✅'}
                              </button>
                            </div>
                          ) : (
                            item.resolvedAnswer && (
                              <p className="text-[10px] text-emerald-800 dark:text-emerald-300 bg-white/70 dark:bg-stone-900/50 p-2 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 whitespace-pre-wrap">
                                {item.resolvedAnswer}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-black text-stone-900 dark:text-stone-100">
                      قواعد الذاكرة الدائمة (ai_global_memory)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={loadMemories}
                    disabled={loadingMemories}
                    className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
                    title="تحديث الذاكرة"
                  >
                    <RefreshCw size={13} className={loadingMemories ? 'animate-spin text-amber-500' : ''} />
                  </button>
                </div>

                <p className="text-[11px] text-stone-500 leading-relaxed">
                  القواعد البرمجية والتعليمات الدائمة المحفوظة في قاعدة بيانات المنظومة، والتي يتم حقنها تلقائياً مع كل استدعاء لشموسة وصقر.
                </p>

                <div className="flex-1 overflow-y-auto space-y-2.5 text-xs">
                  {activeMemories.length === 0 ? (
                    <div className="p-6 text-center text-stone-400 space-y-2">
                      <Brain size={32} className="mx-auto text-stone-300 dark:text-stone-700" />
                      <p className="text-[11px]">الذاكرة جاهزة. استخدم كلمة السر "هبرمجك" ثم "احفظ" لحقن قواعد جديدة.</p>
                    </div>
                  ) : (
                    activeMemories.map((mem) => (
                      <div
                        key={mem.id}
                        className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-amber-600 font-bold uppercase">
                            {mem.category || 'rule'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-stone-400 font-mono">
                              {mem.created_at ? new Date(mem.created_at).toLocaleDateString('ar-EG') : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMemory(mem.id)}
                              title="حذف القاعدة من الذاكرة"
                              className="p-1 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <p className="font-bold text-stone-800 dark:text-stone-200 text-[11px] leading-relaxed whitespace-pre-wrap">
                          {mem.instruction || mem.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-700/80 text-[10px] text-amber-950 dark:text-amber-200 space-y-1">
                  <div className="font-black flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-amber-600" />
                    <span>بروتوكول السوبر أدمن التفاعلي:</span>
                  </div>
                  <p className="leading-relaxed">
                    1. أرسل "هبرمجك" ⬅️ 2. اشرح القاعدة ⬅️ 3. قل "فهمت؟!" ⬅️ 4. قل "احفظ" ⬅️ 5. قل "كده تمام".
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
