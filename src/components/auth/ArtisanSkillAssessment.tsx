import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import {
  ARTISAN_ASSESSMENT_QUESTIONS,
  ArtisanSkillLevel,
  SkillLevelMeta,
  computeRecommendedSkillLevel,
  getEffectiveSkillLevels,
  getSkillLevelMeta,
} from '../../types/artisanGrowth';

interface ArtisanSkillAssessmentProps {
  value: ArtisanSkillLevel;
  onChange: (level: ArtisanSkillLevel, assessmentScore?: number) => void;
  compact?: boolean;
  defaultOpenQuiz?: boolean;
  gender?: 'male' | 'female';
}

export const ArtisanSkillAssessment: React.FC<ArtisanSkillAssessmentProps> = ({
  value,
  onChange,
  compact = false,
  defaultOpenQuiz = false,
  gender,
}) => {
  const [quizOpen, setQuizOpen] = useState(defaultOpenQuiz);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [levels, setLevels] = useState<SkillLevelMeta[]>(() => getEffectiveSkillLevels());

  useEffect(() => {
    const sync = () => setLevels(getEffectiveSkillLevels());
    window.addEventListener('alshams_growth_config_updated', sync);
    return () => window.removeEventListener('alshams_growth_config_updated', sync);
  }, []);

  const selectedMeta = getSkillLevelMeta(value, gender);
  const isFemale = gender === 'female';

  const handleAnswer = (qId: string, score: number) => {
    const next = { ...answers, [qId]: score };
    setAnswers(next);
    if (Object.keys(next).length === ARTISAN_ASSESSMENT_QUESTIONS.length) {
      const calc = computeRecommendedSkillLevel(next);
      const recMeta = getSkillLevelMeta(calc.level, gender);
      onChange(calc.level, calc.score);
      setResultNote(
        `نتيجة الاختبار (${calc.score}/${calc.maxScore}): مستواك المقترح هو «${recMeta.displayTitle}» — يمكنك تأكيده أو تغييره أدناه.`
      );
    }
  };

  return (
    <div
      dir="rtl"
      className={`rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/75 dark:bg-[#132040]/75 ${
        compact ? 'p-3.5 space-y-3' : 'p-4 sm:p-5 space-y-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
            <span>تحديد مستوى الفنان الحرفي</span>
          </h4>
          <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
            اختر مستواك مباشرة أو أجرِ الاختبار السريع (3 أسئلة) لفتح الصلاحيات المناسبة لك.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setQuizOpen((p) => !p)}
          className="px-3 py-1.5 rounded-xl bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white text-[11px] font-black inline-flex items-center gap-1.5 cursor-pointer transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#FBBF24] dark:text-white" />
          <span>{quizOpen ? 'إخفاء الاختبار السريع' : 'ابدأ اختبار المستوى (30 ثانية)'}</span>
          {quizOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* الاختبار السريع من 3 أسئلة */}
      {quizOpen && (
        <div className="space-y-3 pt-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
          {ARTISAN_ASSESSMENT_QUESTIONS.map((q, idx) => (
            <div key={q.id} className="space-y-1.5">
              <p className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                {idx + 1}. {q.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {q.options.map((opt) => {
                  const chosen = answers[q.id] === opt.score;
                  return (
                    <button
                      key={opt.score}
                      type="button"
                      onClick={() => handleAnswer(q.id, opt.score)}
                      className={`px-3 py-2 rounded-xl border text-right text-[11px] font-bold transition cursor-pointer ${
                        chosen
                          ? 'bg-[#EA580C] text-white border-[#EA580C]'
                          : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {resultNote && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-400/60 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resultNote}</span>
            </div>
          )}
        </div>
      )}

      {/* بطاقات المستويات (الافتراضية + أي مستويات مضافة من السوبر أدمن) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {levels.map((meta) => {
          const isSelected = value === meta.id;
          const shortLbl = isFemale && meta.shortLabelFemale ? meta.shortLabelFemale : meta.shortLabel;
          const canTeach = Boolean(meta.permissions?.canPublishLessons || meta.id === 'expert_trainer');
          return (
            <button
              key={meta.id}
              type="button"
              onClick={() => onChange(meta.id)}
              className={`p-2.5 rounded-xl border text-right transition cursor-pointer space-y-1 ${
                isSelected
                  ? 'bg-[#EA580C]/12 dark:bg-[#FBBF24]/15 border-[#EA580C] dark:border-[#FBBF24] shadow-xs'
                  : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] sm:text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] leading-tight">
                  {shortLbl}
                </span>
                {canTeach && (
                  <GraduationCap className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FBBF24] shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-[#475569] dark:text-[#94A3B8] line-clamp-2 leading-snug">
                {meta.tagline}
              </p>
            </button>
          );
        })}
      </div>

      {/* إبراز مزايا المستوى المختار */}
      <div
        className={`rounded-xl border p-3 space-y-1.5 text-xs ${
          selectedMeta.permissions?.canPublishLessons || value === 'expert_trainer'
            ? 'bg-[#EA580C]/10 dark:bg-[#EA580C]/15 border-[#EA580C]/40'
            : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
        }`}
      >
        <div className="font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
          {(selectedMeta.permissions?.canPublishLessons || value === 'expert_trainer') && (
            <GraduationCap className="w-4 h-4 text-[#EA580C] dark:text-[#FBBF24]" />
          )}
          <span>المستوى المختار: {selectedMeta.displayTitle}</span>
        </div>
        <ul className="space-y-1 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
          {selectedMeta.perks.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
