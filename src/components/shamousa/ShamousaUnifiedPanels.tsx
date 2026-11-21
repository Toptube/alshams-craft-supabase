import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Calendar,
  Clock,
  Shield,
  HeartHandshake,
  TrendingUp,
  Package,
  Users,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
  ArrowUpLeft,
  Award,
  Layers,
  Filter,
  Bell,
  Timer,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  MOOD_WAVE_PALETTE,
  analyzeFadfadaEntry,
  optionalLightAiPolish,
  type DailyJournalRecord,
  type FadfadaActionChip,
  type MoodWaveColor,
  type PersonalCareEventRecord,
} from '../../services/shamousaBrain';
import {
  loadCompanionPrefs,
  loadDailyJournals,
  loadPersonalCareEvents,
  recordSilentHumanitarianAlert,
  resolveTenantId,
  runFullOperationsResearch,
  saveCompanionPrefs,
  saveDailyJournal,
  savePersonalCareEvent,
  updatePersonalCareEvent,
  updateRecommendationStatus,
  type CompanionUserPrefs,
  type OROverviewReport,
  type ORRecommendation,
  type ORRecommendationType,
} from '../../services/orEngine';
import { useUiLayoutConfig, DEFAULT_AI_ASSISTANTS_UI_CONFIG } from '../../types/uiLayoutConfig';

export type ShamousaUnifiedPanelMode = 'daily' | 'results' | 'or360';
type ORFilter = 'all' | ORRecommendationType;

export interface ParsedSnoozeRequest {
  wakeAtMs: number;
  labelAr: string;
  durationSummary: string;
}

/**
 * نغمة إشعار شموسة المميزة (جرس دافئ بلوري عبر Web Audio API)
 */
export function playShamousaReminderChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5 -> F#5 -> A5 -> D6 نغمة مميزة مبهجة
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
      const startAt = ctx.currentTime + i * 0.13;
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.11, startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.7);
    });
  } catch {
    // تجاهل صامت لو المتصفح يمنع الصوت قبل التفاعل
  }
}

/**
 * كشف طلبات التأجيل أو تحديد موعد التحدث باللهجة المصرية
 * أمثلة: "استني ساعة"، "استنى نص ساعة"، "بعد ساعتين"، "كلميني الساعة 10"، "فاضي الساعة 9 ونص"
 */
export function parseArabicSnoozeRequest(rawText: string): ParsedSnoozeRequest | null {
  const clean = rawText
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();

  if (!clean) return null;

  const isSnoozeCue =
    /(استن|اجل|كلميني|فكريني|ارجعيلي|تعاليلي|بعد|الساعه|ساعه|دقيقه|دقايق|فاضي|مشغول)/.test(clean);
  if (!isSnoozeCue) return null;

  const now = Date.now();

  // 1) "نص ساعه" / "نصف ساعه"
  if (/(نص|نصف)\s*ساع/.test(clean)) {
    return {
      wakeAtMs: now + 30 * 60 * 1000,
      labelAr: 'بعد نص ساعة',
      durationSummary: 'النص ساعة اللي قولت عليها',
    };
  }
  // 2) "ربع ساعه"
  if (/ربع\s*ساع/.test(clean)) {
    return {
      wakeAtMs: now + 15 * 60 * 1000,
      labelAr: 'بعد ربع ساعة',
      durationSummary: 'الربع ساعة اللي قولت عليها',
    };
  }
  // 3) "ساعتين"
  if (/ساعتين/.test(clean)) {
    return {
      wakeAtMs: now + 120 * 60 * 1000,
      labelAr: 'بعد ساعتين',
      durationSummary: 'الساعتين اللي قولت عليهم',
    };
  }
  // 4) "ساعه" / "بعد 1 ساعه" / "استني ساعه"
  const hoursMatch = clean.match(/(?:بعد|استن[ي]?|اجل[يها]*)\s*(\d+)\s*ساع/);
  if (hoursMatch) {
    const hrs = Math.max(1, Math.min(12, Number(hoursMatch[1])));
    return {
      wakeAtMs: now + hrs * 60 * 60 * 1000,
      labelAr: `بعد ${hrs} ساعة`,
      durationSummary: `الـ ${hrs} ساعات اللي قولت عليهم`,
    };
  }
  if (/(?:استن[ي]?|اجل[يها]*|بعد|ارجعيلي|كلميني|فكريني).*ساع/.test(clean) && !/الساعه\s*\d/.test(clean)) {
    return {
      wakeAtMs: now + 60 * 60 * 1000,
      labelAr: 'بعد ساعة',
      durationSummary: 'الساعة اللي قولت عليها',
    };
  }
  // 5) دقائق محددة: "بعد 10 دقايق" / "استني 20 دقيقة"
  const minsMatch = clean.match(/(?:بعد|استن[ي]?|اجل[يها]*)\s*(\d+)\s*(?:دقيق|دقايق)/);
  if (minsMatch) {
    const mins = Math.max(1, Math.min(240, Number(minsMatch[1])));
    return {
      wakeAtMs: now + mins * 60 * 1000,
      labelAr: `بعد ${mins} دقيقة`,
      durationSummary: `الـ ${mins} دقيقة اللي قولت عليهم`,
    };
  }
  // 6) ساعة محددة: "الساعة 10" أو "الساعة 9:30" أو "الساعة 9 ونص"
  const clockMatch = clean.match(/الساع[هه]?\s*(\d{1,2})(?::(\d{2}))?/);
  if (clockMatch) {
    let hh = Number(clockMatch[1]);
    let mm = clockMatch[2] ? Number(clockMatch[2]) : /ونص|ونصف/.test(clean) ? 30 : /وربع/.test(clean) ? 15 : 0;
    const isMorning = /صباح|الصبح|فجر/.test(clean);
    const isEvening = /مساء|بليل|بالليل|العصر|المغرب|العشاء/.test(clean);
    if (hh >= 1 && hh <= 11 && !isMorning && (isEvening || new Date().getHours() >= 12)) {
      hh += 12;
    }
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      const target = new Date();
      target.setHours(hh, mm, 0, 0);
      if (target.getTime() <= now + 30 * 1000) {
        target.setDate(target.getDate() + 1);
      }
      const formatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      return {
        wakeAtMs: target.getTime(),
        labelAr: `الساعة ${formatted}`,
        durationSummary: `الميعاد اللي حددته (${formatted})`,
      };
    }
  }

  return null;
}

interface FadfadaChatItem {
  id: string;
  sender: 'user' | 'shamousa';
  text: string;
  moodColor?: MoodWaveColor;
  actionChips?: FadfadaActionChip[];
  timestamp: string;
}

const WEEKDAY_OPTIONS: Array<{ value: CompanionUserPrefs['weekly_review_day']; label: string }> = [
  { value: 'friday', label: 'الجمعة' },
  { value: 'saturday', label: 'السبت' },
  { value: 'sunday', label: 'الأحد' },
  { value: 'monday', label: 'الإثنين' },
  { value: 'tuesday', label: 'الثلاثاء' },
  { value: 'wednesday', label: 'الأربعاء' },
  { value: 'thursday', label: 'الخميس' },
];

export interface ShamousaUnifiedPanelsProps {
  profile: UserProfile;
  mode: ShamousaUnifiedPanelMode;
  onSwitchToOR?: () => void;
  onNavigateView?: (view: string) => void;
  onCloseShamousa?: () => void;
  onScheduleSnooze?: (wakeAtMs: number, labelAr: string, durationSummary: string) => void;
  onDailyTimeChanged?: (timeHHmm: string) => void;
  onTestOrbitDemo?: () => void;
  injectedFollowupMessage?: { id: string; text: string } | null;
}

export const ShamousaUnifiedPanels: React.FC<ShamousaUnifiedPanelsProps> = ({
  profile,
  mode,
  onSwitchToOR,
  onNavigateView,
  onCloseShamousa,
  onScheduleSnooze,
  onDailyTimeChanged,
  onTestOrbitDemo,
  injectedFollowupMessage,
}) => {
  const tenantId = useMemo(() => resolveTenantId(profile), [profile]);
  const uiLayout = useUiLayoutConfig();
  const aiCfg = uiLayout.aiAssistantsConfig || DEFAULT_AI_ASSISTANTS_UI_CONFIG;
  const isSupplier = profile?.accountRole === 'supplier';
  const isFemale = profile.gender === 'female';
  const firstName = useMemo(
    () => (profile.artistName || '').trim().split(/\s+/)[0] || (isFemale ? 'فنانة' : 'فنان'),
    [profile.artistName, isFemale]
  );

  const [prefs, setPrefs] = useState<CompanionUserPrefs>({
    last_active_at: new Date().toISOString(),
    fadfada_time: aiCfg.shamousaDailyDefaultTime || '20:00',
    weekly_review_day: 'friday',
    protection_mode: false,
  });

  const [journals, setJournals] = useState<DailyJournalRecord[]>([]);
  const [careEvents, setCareEvents] = useState<PersonalCareEventRecord[]>([]);
  const [orReport, setOrReport] = useState<OROverviewReport | null>(null);
  const [loadingOR, setLoadingOR] = useState(false);
  const [orFilter, setOrFilter] = useState<ORFilter>('all');
  const [showScheduleBar, setShowScheduleBar] = useState(false);

  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<FadfadaChatItem[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastInjectedIdRef = useRef<string>('');

  const speakArabic = useCallback(
    (text: string) => {
      if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const cleaned = text.replace(/[\u{1F300}-\u{1FAFF}]/gu, '');
        const utter = new SpeechSynthesisUtterance(cleaned);
        utter.lang = 'ar-EG';
        utter.rate = 0.96;
        utter.pitch = 1.02;
        window.speechSynthesis.speak(utter);
      } catch {}
    },
    [ttsEnabled]
  );

  const refreshOR = useCallback(async () => {
    setLoadingOR(true);
    try {
      const report = await runFullOperationsResearch(profile);
      setOrReport(report);
    } finally {
      setLoadingOR(false);
    }
  }, [profile]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedPrefs, loadedJournals, loadedCare] = await Promise.all([
        loadCompanionPrefs(profile),
        loadDailyJournals(tenantId),
        loadPersonalCareEvents(tenantId),
      ]);
      if (!active) return;

      const resolvedTime = loadedPrefs.fadfada_time || aiCfg.shamousaDailyDefaultTime || '20:00';
      setPrefs({ ...loadedPrefs, fadfada_time: resolvedTime });
      setJournals(loadedJournals);
      setCareEvents(loadedCare);
      onDailyTimeChanged?.(resolvedTime);

      void saveCompanionPrefs(profile, { last_active_at: new Date().toISOString() });

      const openCare = loadedCare.find((e) => e.status !== 'closed') || null;
      const openingMsg: FadfadaChatItem = {
        id: 'daily_welcome_init',
        sender: 'shamousa',
        moodColor: openCare && loadedPrefs.protection_mode ? 'purple_care' : 'blue_calm',
        text:
          openCare && loadedPrefs.protection_mode
            ? `أهلاً بيك يا ${firstName} 💜 وضع الحماية شغال عشان بالك يرتاح. طمّني على ${openCare.person_name}، واحكيلي لو في أي حاجة بسيطة أقدر أشيلها عنك النهاردة.`
            : isSupplier
            ? `أهلاً بيك يا ${firstName} 🌙✨ يومك في المتجر كان ماشي إزاي النهاردة؟ مبيعات، فروع، عملاء، أو حتى فضفضة عادية — ولو مشغول قولي «استني ساعة» وهستناك وأرجعلك.`
            : isFemale
            ? `أهلاً يا ${firstName} 🌙✨ كوباية الشاي جاهزة؟ احكيلي يومك في الورشة كان ماشي إزاي.. شغل، عملاء، خامات، أو فضفضة عادية — ولو مشغولة قوليلي «استني ساعة» وهستناكي وأرجعلك.`
            : `أهلاً يا ${firstName} 🌙✨ كوباية الشاي جاهزة؟ احكيلي يومك في الورشة كان ماشي إزاي.. شغل، عملاء، خامات، أو فضفضة عادية — ولو مشغول قولي «استني ساعة» وهستناك وأرجعلك.`,
        timestamp: new Date().toISOString(),
      };
      setMessages([openingMsg]);
      await refreshOR();
    })();

    return () => {
      active = false;
    };
  }, [profile, tenantId, firstName, isFemale, isSupplier, aiCfg.shamousaDailyDefaultTime, refreshOR]);

  // Inject follow-up message when a snooze/8 PM timer wakes Shamousa up
  useEffect(() => {
    if (!injectedFollowupMessage || injectedFollowupMessage.id === lastInjectedIdRef.current) return;
    lastInjectedIdRef.current = injectedFollowupMessage.id;
    setMessages((prev) => [
      ...prev,
      {
        id: injectedFollowupMessage.id,
        sender: 'shamousa',
        moodColor: 'gold_solution',
        text: injectedFollowupMessage.text,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [injectedFollowupMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mode]);

  const toggleVoiceInput = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'ar-EG';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const triggerQuickSnooze = (mins: number, labelAr: string, durationSummary: string) => {
    const wakeAt = Date.now() + mins * 60 * 1000;
    onScheduleSnooze?.(wakeAt, labelAr, durationSummary);
    setMessages((prev) => [
      ...prev,
      {
        id: `snz_${Date.now()}`,
        sender: 'shamousa',
        moodColor: 'blue_calm',
        text: `من عيوني يا ${firstName} 🌙✨ هستناك (${labelAr}) وهعملك لفة تذكير خفيفة وأفتحلك أطمّن عليك وأشوف أخبار يومك!`,
        timestamp: new Date().toISOString(),
      },
    ]);
    window.setTimeout(() => {
      onCloseShamousa?.();
    }, 1100);
  };

  const handleSendDaily = async (customText?: string) => {
    const text = (customText ?? inputText).trim();
    if (!text || isSubmitting) return;

    setInputText('');
    setIsSubmitting(true);

    const userBubble: FadfadaChatItem = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userBubble]);

    // 1. Check if user asked to snooze / reschedule ("استني ساعة", "كلميني الساعة 10"...)
    const parsedSnooze = parseArabicSnoozeRequest(text);
    if (parsedSnooze) {
      onScheduleSnooze?.(parsedSnooze.wakeAtMs, parsedSnooze.labelAr, parsedSnooze.durationSummary);
      const replyText = `حاضر ومن عيوني يا ${firstName} 🌙✨ ظبّطتلك المنبه على **${parsedSnooze.labelAr}**.. هسيبك تكمّل شغلك بهدوء، وأول ما الوقت ييجي هعملك رنة ولفة تذكير وأفتحلك أطمّن عليك!`;
      setMessages((prev) => [
        ...prev,
        {
          id: `s_${Date.now()}`,
          sender: 'shamousa',
          moodColor: 'blue_calm',
          text: replyText,
          timestamp: new Date().toISOString(),
        },
      ]);
      speakArabic(replyText);
      setIsSubmitting(false);
      window.setTimeout(() => {
        onCloseShamousa?.();
      }, 1300);
      return;
    }

    // 2. Local deterministic analysis
    const analysis = analyzeFadfadaEntry(text, profile);

    if (analysis.careEvent) {
      const savedCare = await savePersonalCareEvent({
        tenant_id: tenantId,
        person_name: analysis.careEvent.personName,
        event_type: analysis.careEvent.eventType,
        event_time: analysis.careEvent.eventTimeIso,
        reminder_sent: false,
        followup_sent: false,
        notes: analysis.careEvent.notes,
        status: 'upcoming',
      });
      setCareEvents((prev) => [savedCare, ...prev]);

      if (analysis.careEvent.activateProtectionMode) {
        const nextPrefs = await saveCompanionPrefs(profile, { protection_mode: true });
        setPrefs(nextPrefs);
      }
    }

    if (analysis.humanitarianSignal) {
      void recordSilentHumanitarianAlert({
        profile,
        summary: analysis.humanitarianSignal.summary,
        severity: analysis.humanitarianSignal.severity,
      });
    }

    let finalReply = analysis.replyText;
    if (text.length > 45 && !analysis.careEvent && !analysis.humanitarianSignal) {
      finalReply = await optionalLightAiPolish({
        userText: text,
        localReply: analysis.replyText,
        profile,
      });
    }

    const savedJournal = await saveDailyJournal({
      tenant_id: tenantId,
      mood_color: analysis.moodColor,
      mood_score: analysis.moodScore,
      raw_text: text,
      extracted_tags: analysis.extractedTags,
      challenges: analysis.challenges,
      sales_note: analysis.salesNote,
      ai_reply: finalReply,
    });
    setJournals((prev) => [savedJournal, ...prev]);

    // Mark today's daily check-in completed so 8 PM reminder won't re-trigger today
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`shamousa_daily_done_${tenantId}`, todayKey);
    } catch {}

    setMessages((prev) => [
      ...prev,
      {
        id: `s_${Date.now()}`,
        sender: 'shamousa',
        text: finalReply,
        moodColor: analysis.moodColor,
        actionChips: analysis.actionChips,
        timestamp: new Date().toISOString(),
      },
    ]);
    speakArabic(finalReply);
    setIsSubmitting(false);
    void refreshOR();
  };

  const handleActionChip = async (chip: FadfadaActionChip) => {
    if (chip.kind === 'open_or') {
      onSwitchToOR?.();
      return;
    }
    if (chip.kind === 'enable_protection') {
      const updated = await saveCompanionPrefs(profile, { protection_mode: true });
      setPrefs(updated);
      return;
    }
    if (chip.kind === 'navigate' && chip.targetView && onNavigateView) {
      onNavigateView(chip.targetView);
      onCloseShamousa?.();
    }
  };

  const handleExecuteRecommendation = async (rec: ORRecommendation) => {
    await updateRecommendationStatus(tenantId, rec.id, 'applied');
    setOrReport((prev) =>
      prev
        ? {
            ...prev,
            recommendations: prev.recommendations.map((r) =>
              r.id === rec.id ? { ...r, status: 'applied' } : r
            ),
            weeklyTopThreeDecisions: prev.weeklyTopThreeDecisions.map((r) =>
              r.id === rec.id ? { ...r, status: 'applied' } : r
            ),
          }
        : prev
    );

    if (rec.action_payload.targetView && onNavigateView) {
      onNavigateView(rec.action_payload.targetView);
      onCloseShamousa?.();
    }
  };

  const handleUpdateSchedule = async (patch: Partial<CompanionUserPrefs>) => {
    const updated = await saveCompanionPrefs(profile, patch);
    setPrefs(updated);
    if (patch.fadfada_time) {
      onDailyTimeChanged?.(patch.fadfada_time);
    }
  };

  const miniMoodCalendar = useMemo(() => {
    const days: Array<{ dateKey: string; dayLabel: string; mood: MoodWaveColor | null }> = [];
    const byDay = new Map<string, MoodWaveColor>();
    journals.forEach((j) => {
      const key = (j.created_at || '').slice(0, 10);
      if (key && !byDay.has(key)) byDay.set(key, j.mood_color);
    });
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        dateKey: key,
        dayLabel: d.toLocaleDateString('ar-EG', { day: 'numeric' }),
        mood: byDay.get(key) || null,
      });
    }
    return days;
  }, [journals]);

  const weeklyFadfadaSummary = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
    const recent = journals.filter((j) => new Date(j.created_at).getTime() >= sevenDaysAgo);
    const avgScore =
      recent.length > 0
        ? Math.round(recent.reduce((s, j) => s + Number(j.mood_score || 70), 0) / recent.length)
        : 75;
    const tagCounts = new Map<string, number>();
    recent.forEach((j) => (j.extracted_tags || []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t.replace(/_/g, ' '));
    return { count: recent.length, avgScore, topTags };
  }, [journals]);

  const filteredOrRecs = useMemo(() => {
    const list = orReport?.recommendations || [];
    if (orFilter === 'all') return list;
    return list.filter((r) => r.recommendation_type === orFilter);
  }, [orReport, orFilter]);

  const openCareEvents = useMemo(() => careEvents.filter((e) => e.status !== 'closed'), [careEvents]);

  // =================== PANEL 1: يومي كان ماشي إزاي ===================
  if (mode === 'daily') {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-5 py-3.5 space-y-3">
          {/* شريط ضبط ميعاد الساعة 8 مساءً + التأجيل السريع + وضع الحماية */}
          <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#12244D] dark:text-[#F1F5F9]">
                <Clock className="w-4 h-4 text-[#1E3A8A] dark:text-[#CBD5E1]" />
                <span>ميعادك اليومي: {prefs.fadfada_time || '20:00'}</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => triggerQuickSnooze(60, 'بعد ساعة', 'الساعة اللي قولت عليها')}
                  className="px-2.5 py-1 rounded-xl bg-[#EAE0CE] hover:bg-[#DFD2BC] dark:bg-[#19326D] dark:hover:bg-[#23428B] text-[#12244D] dark:text-[#E2E8F0] border border-[#CBBBA0] dark:border-[#3657A6] text-[11px] font-black flex items-center gap-1 cursor-pointer transition"
                >
                  <Timer className="w-3 h-3" />
                  <span>استني ساعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerQuickSnooze(30, 'بعد نص ساعة', 'النص ساعة اللي قولت عليها')}
                  className="px-2.5 py-1 rounded-xl bg-[#EAE0CE] hover:bg-[#DFD2BC] dark:bg-[#19326D] dark:hover:bg-[#23428B] text-[#12244D] dark:text-[#E2E8F0] border border-[#CBBBA0] dark:border-[#3657A6] text-[11px] font-bold cursor-pointer transition"
                >
                  نص ساعة
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleBar((v) => !v)}
                  className="px-2.5 py-1 rounded-xl bg-[#142A5C] hover:bg-[#1D3B7D] dark:bg-[#DCE4F0] dark:text-[#0B1838] text-white text-[11px] font-black cursor-pointer transition"
                >
                  تغيير الميعاد
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdateSchedule({ protection_mode: !prefs.protection_mode })}
                  title="وضع الحماية (تهدئة تنبيهات الشغل وقت الظروف الصحية أو الأسرية)"
                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                    prefs.protection_mode
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-[#F4ECE0] dark:bg-[#152B5E] text-[#334155] dark:text-[#CBD5E1] border-[#D5C7B0] dark:border-[#2C4A92]'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {showScheduleBar && (
              <div className="pt-2.5 border-t border-[#DFD3BF] dark:border-[#253F7E] grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <label className="flex flex-col gap-1 font-bold text-[#12244D] dark:text-[#E2E8F0]">
                  <span className="text-[10px] text-[#5B6472] dark:text-[#94A3B8]">
                    وقت التذكير اليومي التلقائي (الافتراضي 8 مساءً)
                  </span>
                  <input
                    type="time"
                    value={prefs.fadfada_time || '20:00'}
                    onChange={(e) => void handleUpdateSchedule({ fadfada_time: e.target.value })}
                    className="px-2.5 py-1.5 rounded-lg border border-[#CBBBA0] dark:border-[#3555A1] bg-white dark:bg-[#0B1838] text-[#12244D] dark:text-white font-mono font-bold"
                  />
                </label>

                <label className="flex flex-col gap-1 font-bold text-[#12244D] dark:text-[#E2E8F0]">
                  <span className="text-[10px] text-[#5B6472] dark:text-[#94A3B8]">يوم مراجعة النتائج الأسبوعية</span>
                  <select
                    value={prefs.weekly_review_day}
                    onChange={(e) =>
                      void handleUpdateSchedule({
                        weekly_review_day: e.target.value as CompanionUserPrefs['weekly_review_day'],
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-[#CBBBA0] dark:border-[#3555A1] bg-white dark:bg-[#0B1838] text-[#12244D] dark:text-white font-bold"
                  >
                    {WEEKDAY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      playShamousaReminderChime();
                      onTestOrbitDemo?.();
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#142A5C] hover:bg-[#1E3B7D] dark:bg-[#1E3A7A] dark:hover:bg-[#294D9E] text-white font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>معاينة رنة ولفة التذكير ✨</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* نبض آخر 14 يوماً */}
          <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-black text-[#12244D] dark:text-[#F1F5F9]">
                نبض أيامك (آخر 14 يوم)
              </span>
              <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                {journals.length} تدوينة خاصة بحسابك
              </span>
            </div>
            <div className="grid grid-cols-14 gap-1">
              {miniMoodCalendar.map((day) => {
                const meta = day.mood ? MOOD_WAVE_PALETTE[day.mood] : null;
                return (
                  <div
                    key={day.dateKey}
                    title={`${day.dateKey}${meta ? ` • ${meta.labelAr}` : ' • بدون تدوينة'}`}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full h-4 rounded-md border transition"
                      style={{
                        backgroundColor: meta ? `${meta.dotColor}38` : 'transparent',
                        borderColor: meta ? meta.dotColor : 'rgba(148,163,184,0.28)',
                      }}
                    />
                    <span className="text-[9px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                      {day.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* متابعة الرعاية الإنسانية إن وجدت */}
          {openCareEvents.length > 0 && (
            <div className="rounded-2xl bg-purple-50 dark:bg-purple-950/35 border border-purple-200 dark:border-purple-700/70 p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-purple-900 dark:text-purple-200">
                <HeartHandshake className="w-4 h-4 text-purple-600 dark:text-purple-300 shrink-0" />
                <span className="font-black">اطمئنان إنساني:</span>
                <span>{openCareEvents[0].person_name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const targetId = openCareEvents[0].id;
                  setCareEvents((prev) =>
                    prev.map((x) => (x.id === targetId ? { ...x, status: 'closed' } : x))
                  );
                  void updatePersonalCareEvent(tenantId, targetId, { status: 'closed' });
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-black cursor-pointer"
              >
                الحمد لله اطمّنا ✓
              </button>
            </div>
          )}

          {/* رسائل اليومية */}
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
                    m.sender === 'user'
                      ? 'bg-[#162E66] text-[#F8FAFC] dark:bg-[#23438E] dark:text-white rounded-tr-xs'
                      : 'bg-[#FBF7F0] dark:bg-[#112454] text-[#142240] dark:text-[#F1F5F9] border border-[#D8CBB4] dark:border-[#2A478E] rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.actionChips && m.actionChips.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.actionChips.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => void handleActionChip(chip)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#EAE0CE] hover:bg-[#DED1BA] dark:bg-[#1B3573] dark:hover:bg-[#254799] border border-[#C8B89C] dark:border-[#3A5FB3] text-[#12244D] dark:text-[#E2E8F0] text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>{chip.label}</span>
                          <ArrowUpLeft className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* اقتراحات سريعة */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              'الحمد لله بعت أوردرات حلوة النهاردة',
              'البيع هادي ومحتاج أفكار تنشط السوق',
              'عندي بواقي خامات عايز أستغلها',
              'استني ساعة وهكلمك تاني',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSendDaily(prompt)}
                className="px-3 py-1.5 rounded-xl bg-[#FBF7F0] dark:bg-[#12275A] border border-[#D4C6AD] dark:border-[#2C4B94] hover:border-[#1E3A8A] dark:hover:border-[#94A3B8] text-[11px] font-bold text-[#253659] dark:text-[#CBD5E1] cursor-pointer transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* شريط الإدخال السفلي */}
        <div className="border-t border-[#D8CBB4] dark:border-[#243E7D] bg-[#EFE6D5] dark:bg-[#0B1838] px-3 sm:px-4 py-2.5 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendDaily();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleVoiceInput}
              title="تسجيل صوتي"
              className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                  : 'bg-[#FBF7F0] dark:bg-[#13285C] text-[#1E2F57] dark:text-[#CBD5E1] border-[#D4C6AD] dark:border-[#2B488D]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setTtsEnabled((v) => !v)}
              title={ttsEnabled ? 'إيقاف الرد الصوتي' : 'قراءة رد شموسة صوتياً'}
              className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                ttsEnabled
                  ? 'bg-[#162E66] text-white dark:bg-[#DCE4F0] dark:text-[#0B1838] border-transparent'
                  : 'bg-[#FBF7F0] dark:bg-[#13285C] text-[#1E2F57] dark:text-[#CBD5E1] border-[#D4C6AD] dark:border-[#2B488D]'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={aiCfg.shamousaDailyPlaceholder}
              className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-[#FBF7F0] dark:bg-[#112454] border border-[#D4C6AD] dark:border-[#2D4C96] text-xs sm:text-sm text-[#12244D] dark:text-[#F8FAFC] placeholder:text-[#64748B] dark:placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B5CA8]"
            />

            <button
              type="submit"
              disabled={isSubmitting || !inputText.trim()}
              className="h-10 px-4 rounded-xl bg-[#142A5C] hover:bg-[#1E3B7D] dark:bg-gradient-to-b dark:from-[#E2E8F0] dark:to-[#CBD5E1] dark:text-[#0B1838] disabled:opacity-40 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =================== PANEL 2: نتائج (قعدة النتائج الأسبوعية) ===================
  if (mode === 'results') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-5 py-4 space-y-4">
        <div className="rounded-2xl bg-[#142A5C] dark:bg-[#12275A] border border-[#2C4B94] text-white p-4 sm:p-5 shadow-md">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#CBD5E1] mb-1">
                <Award className="w-4 h-4 text-[#F8FAFC]" />
                <span>قعدة النتائج وتظبيط الشغل والبيع</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                خلاصة أسبوعك في 3 قرارات جاهزة للتنفيذ الفوري
              </h3>
              <p className="text-xs text-[#CBD5E1] mt-1">
                دمجنا يوميات الأسبوع ({weeklyFadfadaSummary.count} تدوينات · مؤشر راحة{' '}
                {weeklyFadfadaSummary.avgScore}%) مع حسابات بحوث العمليات بدون أي زحام أرقام.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshOR()}
              disabled={loadingOR}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOR ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>

          {weeklyFadfadaSummary.topTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {weeklyFadfadaSummary.topTags.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-0.5 rounded-lg bg-white/10 text-[10px] font-bold text-[#E2E8F0]"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {(orReport?.weeklyTopThreeDecisions || []).map((rec, index) => (
            <div
              key={rec.id}
              className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-4 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#142A5C] dark:bg-[#DCE4F0] text-white dark:text-[#0B1838] font-black text-sm flex items-center justify-center shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-[#EAE0CE] dark:bg-[#1C3573] text-[#142A5C] dark:text-[#E2E8F0] text-[10px] font-black">
                      {rec.categoryBadge}
                    </span>
                    {rec.status === 'applied' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تم التنفيذ
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-[#12244D] dark:text-[#F8FAFC] mt-1">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              </div>

              {rec.suggested_whatsapp_msg && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-950 dark:text-emerald-200 leading-relaxed">
                  <span className="font-black block mb-0.5">رسالة الواتساب الجاهزة:</span>
                  {rec.suggested_whatsapp_msg}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                  {rec.metricsSummary || `تأثير متوقع: ${rec.impact_score}/100`}
                </span>
                {rec.whatsapp_url ? (
                  <a
                    href={rec.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void updateRecommendationStatus(tenantId, rec.id, 'applied')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{rec.action_payload.buttonLabel}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleExecuteRecommendation(rec)}
                    className="px-3.5 py-2 rounded-xl bg-[#142A5C] hover:bg-[#1E3B7D] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#0B1838] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>{rec.action_payload.buttonLabel}</span>
                    <ArrowUpLeft className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =================== PANEL 3: بحوث (بحوث العمليات 360°) ===================
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-5 py-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3">
          <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">الربح الأسبوعي الأمثل</div>
          <div className="text-base font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {(orReport?.projectedWeeklyProfit || 0).toLocaleString('ar-EG')}{' '}
            <span className="text-xs">{orReport?.currencySymbol || 'ج.م'}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3">
          <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">خامات قرب النفاد</div>
          <div className="text-base font-black font-mono tabular-nums text-[#142A5C] dark:text-[#E2E8F0] mt-1">
            {orReport?.stats.lowStockCount || 0} خامات
          </div>
        </div>
        <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3">
          <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">عملاء VIP غائبون</div>
          <div className="text-base font-black font-mono tabular-nums text-indigo-700 dark:text-sky-300 mt-1">
            {orReport?.stats.dormantVipCount || 0} عملاء
          </div>
        </div>
        <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3">
          <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">المنتج البطل</div>
          <div className="text-xs font-black text-[#142A5C] dark:text-[#F8FAFC] mt-1.5 truncate">
            {orReport?.heroProduct?.name || 'أضف منتجاتك'}
          </div>
        </div>
      </div>

      {orReport && orReport.productMixPlan.length > 0 && (
        <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-[#12244D] dark:text-[#F8FAFC] mb-2.5">
            <Layers className="w-4 h-4 text-[#1E3A8A] dark:text-[#CBD5E1]" />
            <span>مزيج الإنتاج الأسبوعي الأعلى ربحية ({orReport.weeklyCapacityHours} ساعة)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#DFD3BF] dark:border-[#253F7E] text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  <th className="py-1.5 font-bold">المنتج</th>
                  <th className="py-1.5 font-bold">الكمية المقترحة</th>
                  <th className="py-1.5 font-bold">ربح القطعة</th>
                  <th className="py-1.5 font-bold">إجمالي الربح</th>
                </tr>
              </thead>
              <tbody>
                {orReport.productMixPlan.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-b border-[#EAE0CE]/70 dark:border-[#1E356B] last:border-0"
                  >
                    <td className="py-2 font-black text-[#12244D] dark:text-[#F8FAFC]">{row.productName}</td>
                    <td className="py-2 font-bold font-mono tabular-nums">{row.recommendedQty} قطعة</td>
                    <td className="py-2 font-mono tabular-nums">
                      {row.unitProfit.toLocaleString('ar-EG')} {orReport.currencySymbol}
                    </td>
                    <td className="py-2 font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {row.projectedProfit.toLocaleString('ar-EG')} {orReport.currencySymbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-[#64748B]" />
        {(
          [
            { id: 'all', label: 'الكل', icon: Sparkles },
            { id: 'operational', label: 'تشغيلي وهدر', icon: Package },
            { id: 'crm_retarget', label: 'عملاء VIP', icon: Users },
            { id: 'churn_diagnosis', label: 'تشخيص المبيعات', icon: TrendingUp },
            { id: 'marketing', label: 'تسويق وباقات', icon: Award },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setOrFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition cursor-pointer ${
              orFilter === f.id
                ? 'bg-[#142A5C] dark:bg-[#DCE4F0] text-white dark:text-[#0B1838] border-transparent'
                : 'bg-[#FBF7F0] dark:bg-[#10224E] text-[#475569] dark:text-[#CBD5E1] border-[#D8CBB4] dark:border-[#284486]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredOrRecs.map((rec) => (
          <div
            key={rec.id}
            className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-[#EAE0CE] dark:bg-[#1B3573] text-[#142A5C] dark:text-[#E2E8F0] text-[10px] font-black">
                {rec.categoryBadge}
              </span>
              <span className="text-[10px] font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                أثر متوقع {rec.impact_score}%
              </span>
            </div>
            <h4 className="text-sm font-black text-[#12244D] dark:text-[#F8FAFC] mt-1.5">{rec.title}</h4>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">{rec.description}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">{rec.metricsSummary}</span>
              {rec.whatsapp_url ? (
                <a
                  href={rec.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void updateRecommendationStatus(tenantId, rec.id, 'applied')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{rec.action_payload.buttonLabel}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleExecuteRecommendation(rec)}
                  className="px-3 py-1.5 rounded-xl bg-[#142A5C] hover:bg-[#1E3B7D] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#0B1838] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>{rec.action_payload.buttonLabel}</span>
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShamousaUnifiedPanels;
