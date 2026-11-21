import React from 'react';
import { RotateCcw, Sparkles, Clock, MessageSquare } from 'lucide-react';
import {
  AiAssistantsUiConfig,
  DEFAULT_AI_ASSISTANTS_UI_CONFIG,
  normalizeAiAssistantsUiConfig,
} from '../../types/uiLayoutConfig';

interface AdminAiAssistantsPanelProps {
  value?: AiAssistantsUiConfig;
  onChange: (next: AiAssistantsUiConfig) => void;
}

export const AdminAiAssistantsPanel: React.FC<AdminAiAssistantsPanelProps> = ({
  value,
  onChange,
}) => {
  const cfg = normalizeAiAssistantsUiConfig(value);

  const patch = (key: keyof AiAssistantsUiConfig, val: string) => {
    onChange({ ...cfg, [key]: val });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1E3F8A] dark:text-[#93C5FD]" />
            <span>إعدادات مسميات ونصوص شموسة وصقر</span>
          </h2>
          <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
            تحكم كامل في أسماء الأزرار العلوية الثلاثة، أسماء التبويبين، نصوص الإدخال، ميعاد الطمأنة اليومي (الافتراضي 8 مساءً)، ورسالة العودة بعد التأجيل — ثم اضغط "نشر التعديلات للسحابة" أعلى الصفحة.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_AI_ASSISTANTS_UI_CONFIG })}
          className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black flex items-center gap-1.5 cursor-pointer hover:border-[#1E3F8A]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>استعادة افتراضي شموسة وصقر</span>
        </button>
      </div>

      {/* قسم 1: شموسة — المسميات والأزرار والتبويبات */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2.5">
          <MessageSquare className="w-4 h-4 text-[#1E3F8A] dark:text-[#93C5FD]" />
          <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            1) واجهة شموسة الموحدة (ملء الشاشة)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              الاسم أسفل الأيقونة العائمة
            </span>
            <input
              type="text"
              value={cfg.shamousaLauncherName}
              onChange={(e) => patch('shamousaLauncherName', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              الزر الفضي العلوي (1) — المهام
            </span>
            <input
              type="text"
              value={cfg.shamousaBtnTasks}
              onChange={(e) => patch('shamousaBtnTasks', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              الزر الفضي العلوي (2) — النتائج
            </span>
            <input
              type="text"
              value={cfg.shamousaBtnResults}
              onChange={(e) => patch('shamousaBtnResults', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              الزر الفضي العلوي (3) — بحوث العمليات
            </span>
            <input
              type="text"
              value={cfg.shamousaBtnOR}
              onChange={(e) => patch('shamousaBtnOR', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              التبويب الأيمن (المحادثة الرئيسية)
            </span>
            <input
              type="text"
              value={cfg.shamousaTabChat}
              onChange={(e) => patch('shamousaTabChat', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              التبويب الأيسر (الطمأنة اليومية)
            </span>
            <input
              type="text"
              value={cfg.shamousaTabDaily}
              onChange={(e) => patch('shamousaTabDaily', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              نص التلميح داخل خانة كتابة «المحادثة الذكية»
            </span>
            <input
              type="text"
              value={cfg.shamousaChatPlaceholder}
              onChange={(e) => patch('shamousaChatPlaceholder', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              نص التلميح داخل خانة كتابة «يومي كان ماشي إزاي»
            </span>
            <input
              type="text"
              value={cfg.shamousaDailyPlaceholder}
              onChange={(e) => patch('shamousaDailyPlaceholder', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>
        </div>
      </div>

      {/* قسم 2: التذكير التلقائي الساعة 8 مساءً والتأجيل */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2.5">
          <Clock className="w-4 h-4 text-[#1E3F8A] dark:text-[#93C5FD]" />
          <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            2) التذكير اليومي التلقائي ورسالة العودة بعد التأجيل
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              الميعاد الافتراضي اليومي (20:00 = 8 مساءً)
            </span>
            <input
              type="time"
              value={cfg.shamousaDailyDefaultTime}
              onChange={(e) => patch('shamousaDailyDefaultTime', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-mono font-black"
            />
          </label>

          <label className="space-y-1 block sm:col-span-2">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              رسالة شموسة لما ترجع بعد التأجيل (استخدم {'{name}'} لاسم الفنان)
            </span>
            <input
              type="text"
              value={cfg.shamousaSnoozeFollowupText}
              onChange={(e) => patch('shamousaSnoozeFollowupText', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>
        </div>
      </div>

      {/* قسم 3: مسميات صقر الشمساوية */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#D4CCBC] dark:border-[#22355E] pb-2.5">
          <Sparkles className="w-4 h-4 text-[#1E3F8A] dark:text-[#93C5FD]" />
          <h3 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
            3) مسميات صقر الشمساوية (Falcon AI)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              اسم وعنوان صقر
            </span>
            <input
              type="text"
              value={cfg.falconTitle}
              onChange={(e) => patch('falconTitle', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              نص التلميح داخل خانة الكتابة لصقر
            </span>
            <input
              type="text"
              value={cfg.falconPlaceholder}
              onChange={(e) => patch('falconPlaceholder', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>

          <label className="space-y-1 block">
            <span className="text-[11px] font-black text-[#334155] dark:text-[#CBD5E1]">
              زر التحويل من شموسة إلى صقر
            </span>
            <input
              type="text"
              value={cfg.falconHandoffBtnLabel}
              onChange={(e) => patch('falconHandoffBtnLabel', e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#091533] border border-[#D4CCBC] dark:border-[#243C78] text-xs font-bold"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
