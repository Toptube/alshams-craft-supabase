import React, { useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  Send,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {
  LandingSectionFilter,
  LandingShamousaOption,
  LandingVisitorLevel,
  LandingVisitorRole,
  buildLandingWelcomeReply,
  getLandingTopicById,
  handleLandingLevelSelected,
  handleLandingRoleSelected,
  processLandingShamousaMessage,
  saveLandingVisitorSuggestionLocal,
} from '../../services/shamousaLandingEngine';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface LandingChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  options?: LandingShamousaOption[];
}

interface ShamousaLandingWidgetProps {
  activeFilter: LandingSectionFilter | null;
  onApplyFilter: (filter: LandingSectionFilter | null) => void;
  onNavigateAction: (action: LandingSectionFilter['recommendedCtaAction']) => void;
  isPreview?: boolean;
}

function renderLandingText(text: string) {
  return text.split('\n').map((line, idx) => (
    <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-black text-[#0C1427] dark:text-[#FBBF24]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </p>
  ));
}

export const ShamousaLandingWidget: React.FC<ShamousaLandingWidgetProps> = ({
  activeFilter,
  onApplyFilter,
  onNavigateAction,
  isPreview = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showGreetingBubble, setShowGreetingBubble] = useState(true);
  const [visitorRole, setVisitorRole] = useState<LandingVisitorRole | undefined>(undefined);
  const [awaitingSuggestionFor, setAwaitingSuggestionFor] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [messages, setMessages] = useState<LandingChatMessage[]>(() => {
    const w = buildLandingWelcomeReply();
    return [{ id: 'land_w0', role: 'assistant', text: w.text, options: w.options }];
  });

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [messages, isOpen]);

  if (isPreview) return null;

  const submitVisitorSuggestionToServer = (originalQuestion: string, suggestionText: string) => {
    saveLandingVisitorSuggestionLocal(originalQuestion, suggestionText, visitorRole);
    fetch('/api/public/shamousa/landing-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalQuestion,
        suggestionText,
        visitorRole: visitorRole || 'visitor',
      }),
    }).catch(() => {
      // محفوظ محلياً ويعمل أوفلاين 100%
    });
  };

  const applyFilterAndScroll = (filter: LandingSectionFilter) => {
    onApplyFilter(filter);
    playSuccessSound();
    setTimeout(() => {
      const el = document.getElementById(filter.scrollToSectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const handleOptionClick = (opt: LandingShamousaOption) => {
    playButtonClickSound();

    if (opt.action === 'navigate' && opt.payload) {
      onNavigateAction(opt.payload as LandingSectionFilter['recommendedCtaAction']);
      return;
    }

    if (opt.action === 'clear_filter') {
      onApplyFilter(null);
      setAwaitingSuggestionFor(null);
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: opt.label },
        {
          id: `a_${Date.now() + 1}`,
          role: 'assistant',
          text: 'تمام يا فندم ☀️ رجّعتلك صفحة الهبوط كاملة! تحب تسألني عن أي جزء تاني في المنظومة؟',
          options: buildLandingWelcomeReply().options,
        },
      ]);
      return;
    }

    if (opt.action === 'select_role' && opt.payload) {
      const r = opt.payload as LandingVisitorRole;
      setVisitorRole(r);
      const reply = handleLandingRoleSelected(r);
      if (reply.filterToApply) applyFilterAndScroll(reply.filterToApply);
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: opt.label },
        { id: `a_${Date.now() + 1}`, role: 'assistant', text: reply.text, options: reply.options },
      ]);
      return;
    }

    if (opt.action === 'select_level' && opt.payload) {
      const [r, lvl] = opt.payload.split('|') as [LandingVisitorRole, LandingVisitorLevel];
      setVisitorRole(r);
      const reply = handleLandingLevelSelected(r, lvl);
      if (reply.filterToApply) applyFilterAndScroll(reply.filterToApply);
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: opt.label },
        { id: `a_${Date.now() + 1}`, role: 'assistant', text: reply.text, options: reply.options },
      ]);
      return;
    }

    if (opt.action === 'ask_topic' && opt.payload) {
      const topic = getLandingTopicById(opt.payload);
      if (topic) {
        setAwaitingSuggestionFor(null);
        setMessages((prev) => [
          ...prev,
          { id: `u_${Date.now()}`, role: 'user', text: opt.label },
          {
            id: `a_${Date.now() + 1}`,
            role: 'assistant',
            text: `${topic.answerAr}\n\nتحب أفلترلك الشاشة على القسم ده دلوقتي؟`,
            options: [
              { id: `af_${topic.id}`, label: 'اعرضلي القسم ده على الشاشة 👀', action: 'apply_filter', payload: topic.id },
              { id: `nav_${topic.id}`, label: topic.ctaLabelAr, action: 'navigate', payload: topic.ctaAction },
              { id: `all_${topic.id}`, label: 'عرض الصفحة كاملة ☀️', action: 'clear_filter' },
            ],
          },
        ]);
      }
      return;
    }

    if (opt.action === 'apply_filter' && opt.payload) {
      const topic = getLandingTopicById(opt.payload);
      if (topic) {
        applyFilterAndScroll({
          id: `topic_${topic.id}`,
          role: visitorRole,
          labelAr: `تركيز الصفحة على: ${topic.titleAr}`,
          scrollToSectionId: topic.scrollToSectionId,
          visibleSectionIds: topic.visibleSectionIds,
          recommendedCtaAction: topic.ctaAction,
          recommendedCtaLabelAr: topic.ctaLabelAr,
        });
        setMessages((prev) => [
          ...prev,
          { id: `u_${Date.now()}`, role: 'user', text: opt.label },
          {
            id: `a_${Date.now() + 1}`,
            role: 'assistant',
            text: `تم يا فندم ☀️ فلترتلك الشاشة على **${topic.titleAr}** مباشرة قدامك! وتقدر تلغي الفلتر من الشريط العلوي في أي وقت.`,
            options: [
              { id: `n2_${topic.id}`, label: topic.ctaLabelAr, action: 'navigate', payload: topic.ctaAction },
              { id: `c2_${topic.id}`, label: 'إلغاء الفلتر / عرض الكل', action: 'clear_filter' },
            ],
          },
        ]);
      }
      return;
    }

    if (opt.action === 'not_what_i_meant') {
      const origQ = opt.payload || 'استفسار زائر في صفحة الهبوط';
      setAwaitingSuggestionFor(origQ);
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text: opt.label },
        {
          id: `a_${Date.now() + 1}`,
          role: 'assistant',
          text:
            `حقك عليّا ☀️ اكتبلي بالظبط قصدك إيه أو لو في ميزة جديدة نفسك تكون موجودة في المنظومة — وهجاوبك فوراً أو أبعت مقترحك مباشرة لإدارة الشمساوية (السوبر أدمن)!`,
          options: [{ id: 'cancel_sug', label: 'رجّعني لاختيارات الأدوار ☀️', action: 'clear_filter' }],
        },
      ]);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    setInputVal('');
    playButtonClickSound();

    const reply = processLandingShamousaMessage({
      rawQuery: trimmed,
      awaitingSuggestionFor,
      visitorRole,
    });

    if (reply.capturedSuggestionText && awaitingSuggestionFor) {
      submitVisitorSuggestionToServer(awaitingSuggestionFor, reply.capturedSuggestionText);
      setAwaitingSuggestionFor(null);
      playSuccessSound();
    } else if (reply.awaitingVisitorSuggestionFor) {
      setAwaitingSuggestionFor(reply.awaitingVisitorSuggestionFor);
    } else {
      setAwaitingSuggestionFor(null);
    }

    if (reply.clearFilter) onApplyFilter(null);
    else if (reply.filterToApply) applyFilterAndScroll(reply.filterToApply);

    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', text: trimmed },
      { id: `a_${Date.now() + 1}`, role: 'assistant', text: reply.text, options: reply.options },
    ]);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[95] flex flex-col items-start gap-2" dir="rtl">
      {/* First-Minute Welcome Greeting Bubble (Non-Intrusive & Dismissible) */}
      {!isOpen && showGreetingBubble && (
        <div className="max-w-[270px] rounded-2xl border border-[#EA580C]/35 bg-white dark:bg-[#0D162E] shadow-xl p-3 text-right relative">
          <button
            type="button"
            onClick={() => setShowGreetingBubble(false)}
            className="absolute top-2 left-2 p-1 rounded-md text-[#94A3B8] hover:text-[#0C1427] dark:hover:text-white cursor-pointer"
            aria-label="إخفاء الترحيب"
          >
            <X className="w-3 h-3" />
          </button>
          <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] pl-5">
            أهلاً بيك! أنا <span className="text-[#EA580C] dark:text-[#FBBF24]">شموسة</span> ☀️
          </p>
          <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] mt-1 leading-snug">
            قولي أنت فنان ولا مورّد ولا عميل وأنا أفلترلك الصفحة وأجاوبك على كل تفاصيل المنظومة أوفلاين!
          </p>
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              setShowGreetingBubble(false);
              setIsOpen(true);
            }}
            className="mt-2 w-full px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black cursor-pointer"
          >
            ابدأ الحوار مع شموسة الآن ✨
          </button>
        </div>
      )}

      {/* Floating Shamousa Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            playButtonClickSound();
            setShowGreetingBubble(false);
            setIsOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-l from-[#EA580C] to-[#D97706] hover:from-[#C2410C] hover:to-[#B45309] text-white shadow-[0_10px_28px_rgba(234,88,12,0.42)] border border-white/25 cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]"
          aria-label="تحدث مع شموسة"
        >
          <Sun className="w-5 h-5 text-amber-200 shrink-0" />
          <span className="text-xs font-black whitespace-nowrap">
            {activeFilter ? 'شموسة (مفلتر) ☀️' : 'جرّب شموسة دلوقتي ☀️'}
          </span>
        </button>
      )}

      {/* Interactive Offline Chat Panel */}
      {isOpen && (
        <div className="w-[calc(100vw-2rem)] sm:w-[390px] max-h-[78vh] rounded-3xl border border-[#D4CCBC] dark:border-[#243968] bg-[#FAF7F0] dark:bg-[#0A1124] shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-l from-[#EA580C] to-[#C2410C] text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <Sun className="w-4 h-4 text-amber-200" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black leading-tight">شموسة — مرشدة الشمساوية</h3>
                <p className="text-[10px] text-amber-100 truncate">
                  تفاعلية أوفلاين 100% · فلترة ذكية للصفحة
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeFilter && (
                <button
                  type="button"
                  onClick={() => onApplyFilter(null)}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                  title="إلغاء الفلتر"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>الكل</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col gap-1.5 ${m.role === 'user' ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white rounded-tr-sm'
                      : 'bg-white dark:bg-[#132040] border border-[#E5DEC9] dark:border-[#243968] text-[#0C1427] dark:text-[#F7F3EA] rounded-tl-sm'
                  }`}
                >
                  {renderLandingText(m.text)}
                </div>

                {m.options && m.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[95%]">
                    {m.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleOptionClick(opt)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                          opt.action === 'navigate'
                            ? 'bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-xs'
                            : 'bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#2B4378] text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={handleSendText}
            className="p-2.5 bg-white dark:bg-[#0D162E] border-t border-[#E5DEC9] dark:border-[#1E2E52] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={
                awaitingSuggestionFor
                  ? 'اكتب مقترحك وهبعته مباشرة للسوبر أدمن...'
                  : 'اسألني عن أي حاجة في المنظومة أو مشكلة حرفة...'
              }
              className="flex-1 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#243968] bg-[#FAF7F0] dark:bg-[#0A1124] text-xs text-[#0C1427] dark:text-[#F7F3EA] focus:outline-none focus:border-[#EA580C]"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white cursor-pointer shrink-0"
              aria-label="إرسال"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

// شريط علوي أنيق يظهر أعلى صفحة الهبوط فقط عند تفعيل فلتر شموسة
export const LandingShamousaFilterBanner: React.FC<{
  filter: LandingSectionFilter | null;
  onClear: () => void;
  onCta: (action: LandingSectionFilter['recommendedCtaAction']) => void;
}> = ({ filter, onClear, onCta }) => {
  if (!filter) return null;
  return (
    <div
      className="sticky top-16 z-40 mx-auto max-w-6xl px-3 sm:px-6 pt-2"
      dir="rtl"
    >
      <div className="rounded-2xl border border-[#EA580C]/45 bg-[#FFFDF8]/95 dark:bg-[#0F1B38]/95 backdrop-blur-md px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
          <span className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
            شموسة خصّصتلك الشاشة: <span className="text-[#C2410C] dark:text-[#FBBF24]">{filter.labelAr}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onCta(filter.recommendedCtaAction)}
            className="px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black cursor-pointer whitespace-nowrap"
          >
            {filter.recommendedCtaLabelAr}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 rounded-xl border border-[#D4CCBC] dark:border-[#243968] bg-white dark:bg-[#132040] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>عرض الصفحة كاملة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
