import React, { useState, useEffect } from 'react';
import { UserProfile, CraftCategory } from '../../types';
import { FalconAIAgent, StructuredCalculatorExport } from './FalconAIAgent';
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
} from 'lucide-react';
import { playSuccessSound, playAlertSound, playErrorSound } from '../../lib/sounds';

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

  // Shamousa Independent Console State
  const [shamousaMessages, setShamousaMessages] = useState<Array<{ role: 'user' | 'model'; text: string; time: string }>>([
    {
      role: 'model',
      text: 'أهلاً يا حسام 🌞، أنا مديرة أعمالك. اخبارك ايه! واخبار شغلنا ايه ! يارب يكون كل حاجه تمام ... تحب نبدأ إزاي النهارده؟! جاهزة لاستقبال أي توجيهات برمجية، فحص الورش، أو تحليل بيانات المنظومة.',
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [inTrainingMode, setInTrainingMode] = useState(false);
  const [activeMemories, setActiveMemories] = useState<any[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  // Load Active Global Memories
  const loadMemories = async () => {
    setLoadingMemories(true);
    try {
      const res = await fetch('/api/admin/memories', {
        headers: {
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
      });
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

  useEffect(() => {
    if (activeAIAgent === 'shamousa') {
      loadMemories();
    }
  }, [activeAIAgent]);

  const handleSendShamousa = async (textToSend?: string) => {
    const msg = (textToSend || inputMessage).trim();
    if (!msg || sending) return;

    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user' as const, text: msg, time };
    setShamousaMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setSending(true);

    // Quick local echo if keyword matches Super Admin protocol
    if (msg === 'هبرمجك') {
      setInTrainingMode(true);
      playAlertSound();
    } else if (msg === 'فهمت؟!') {
      playSuccessSound();
    } else if (msg === 'احفظ') {
      playSuccessSound();
    } else if (msg === 'كده تمام') {
      setInTrainingMode(false);
      playSuccessSound();
    }

    try {
      const res = await fetch('/api/ai/shamousa/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': profile.email || 'hmb.top.tupe@gmail.com',
        },
        body: JSON.stringify({
          message: msg,
          userEmail: profile.email || 'hmb.top.tupe@gmail.com',
          workshopId: profile.workshopId || profile.id,
          brandName: profile.brandName,
          artistName: profile.artistName,
          history: shamousaMessages.slice(-8).map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }],
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('فشل اتصال مع محرك الذكاء الاصطناعي');
      }

      const json = await res.json();
      const reply = json.reply || 'تم استلام التوجيه وحفظه بالمنظومة.';
      setShamousaMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: reply,
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      playSuccessSound();

      if (msg === 'احفظ') {
        loadMemories();
      }
    } catch (err: any) {
      playErrorSound();
      setShamousaMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'عذراً يا هندسة، واجهت مشكلة في معالجة الطلب: ' + (err.message || 'خطأ في الشبكة'),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
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
          onClick={() => setActiveAIAgent('falcon')}
          className={`p-5 rounded-3xl border-2 transition-all text-right cursor-pointer shadow-sm relative overflow-hidden group ${
            activeAIAgent === 'falcon'
              ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-white border-amber-400 ring-4 ring-amber-500/20 scale-[1.01]'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-amber-400 text-stone-800 dark:text-stone-200'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 dark:bg-amber-950/40 flex items-center justify-center text-2xl shadow-xs">
              🦅
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
            <div className="w-12 h-12 rounded-2xl bg-white/20 dark:bg-amber-950/40 flex items-center justify-center text-2xl shadow-xs">
              🌞
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
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 shadow-sm">
          <FalconAIAgent
            profile={profile}
            currentCategory={currentCategory as CraftCategory}
            onApplyCategoryFromAI={onApplyCategoryFromAI || (() => {})}
            onApplyEstimatedLaborWage={onApplyEstimatedLaborWage || (() => {})}
            onTransferNotesToCalculator={onTransferNotesToCalculator || (() => {})}
            onExportStructuredToCalculator={onExportStructuredToCalculator}
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
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                      m.role === 'user' ? 'bg-amber-600 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-700'
                    }`}
                  >
                    {m.role === 'user' ? '👑' : '🌞'}
                  </div>
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-amber-600 text-white rounded-br-none shadow-xs font-bold'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-bl-none border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
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

          {/* AI Global Memory & Active Rules Viewer */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 shadow-sm space-y-4 flex flex-col h-[650px]">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
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
              القواعد البرمجية والتعليمات الدائمة المحفوظة في قاعدة بيانات المنظومة، والتي يتم حقنها تلقائياً مع كل استدعاء لمحرّكي شموسة وصقر.
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
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-amber-600 font-bold uppercase">
                        {mem.category || 'rule'}
                      </span>
                      <span className="text-[9px] text-stone-400 font-mono">
                        {mem.created_at ? new Date(mem.created_at).toLocaleDateString('ar-EG') : ''}
                      </span>
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
          </div>
        </div>
      )}
    </div>
  );
};
