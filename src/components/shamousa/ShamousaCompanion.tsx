import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Sparkles,
  X,
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
  Coffee,
  Bell,
  Sun,
  Award,
  Layers,
  Filter,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  MOOD_WAVE_PALETTE,
  analyzeFadfadaEntry,
  buildGraduatedAbsenceGreeting,
  optionalLightAiPolish,
  type AbsenceWelcomePlan,
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

export interface ShamousaCompanionProps {
  profile: UserProfile;
  onNavigateView?: (view: string) => void;
  isAnyModalOpen?: boolean;
}

type CompanionTab = 'fadfada' | 'weekly' | 'or360';
type ORFilter = 'all' | ORRecommendationType;

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

/**
 * نغمة تذكير ناعمة وهادئة عبر Web Audio API (بدون ملفات صوتية خارجية)
 */
function playGentleTeaChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5 -> E5 -> G5 دافئ وهادئ
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.16);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.16 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.16);
      osc.stop(ctx.currentTime + i * 0.16 + 0.6);
    });
  } catch {
    // تجاهل لو المتصفح منع الصوت قبل التفاعل
  }
}

/**
 * موجات حية ديناميكية تتغير ألوانها حسب الحالة المزاجية الحالية
 */
const DynamicAmbientWaves: React.FC<{ mood: MoodWaveColor; compact?: boolean }> = ({ mood, compact }) => {
  const palette = MOOD_WAVE_PALETTE[mood] || MOOD_WAVE_PALETTE.blue_calm;
  const prefersReduced = useReducedMotion();

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${
        compact ? 'h-16' : 'h-28'
      } opacity-40`}
      aria-hidden="true"
    >
      <motion.svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="w-[200%] h-full"
        animate={prefersReduced ? undefined : { x: ['0%', '-50%'] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        <path
          d="M0,64 C180,112 360,16 600,64 C840,112 1020,16 1200,64 L1200,120 L0,120 Z"
          fill={palette.waveStrokePrimary}
          fillOpacity="0.28"
        />
        <path
          d="M0,78 C200,26 420,118 600,74 C780,30 1000,116 1200,74 L1200,120 L0,120 Z"
          fill={palette.waveStrokeSecondary}
          fillOpacity="0.22"
        />
      </motion.svg>
    </div>
  );
};

export const ShamousaCompanion: React.FC<ShamousaCompanionProps> = ({
  profile,
  onNavigateView,
  isAnyModalOpen = false,
}) => {
  const tenantId = useMemo(() => resolveTenantId(profile), [profile]);
  const prefersReducedMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CompanionTab>('fadfada');
  const [orFilter, setOrFilter] = useState<ORFilter>('all');

  const [prefs, setPrefs] = useState<CompanionUserPrefs>({
    last_active_at: new Date().toISOString(),
    fadfada_time: profile.dailySalesReminderTime || '21:00',
    weekly_review_day: 'friday',
    protection_mode: false,
  });

  const [currentMood, setCurrentMood] = useState<MoodWaveColor>('blue_calm');
  const [journals, setJournals] = useState<DailyJournalRecord[]>([]);
  const [careEvents, setCareEvents] = useState<PersonalCareEventRecord[]>([]);
  const [orReport, setOrReport] = useState<OROverviewReport | null>(null);
  const [loadingOR, setLoadingOR] = useState(false);

  // محادثة الفضفضة اليومية
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<FadfadaChatItem[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // حالة الغياب المتدرج والإشعارات الاستباقية
  const [absencePlan, setAbsencePlan] = useState<AbsenceWelcomePlan | null>(null);
  const [showAbsenceStage, setShowAbsenceStage] = useState(false);
  const [proactiveBanner, setProactiveBanner] = useState<{
    id: string;
    tone: 'tea' | 'care' | 'followup';
    title: string;
    body: string;
    careEventId?: string;
  } | null>(null);
  const [showScheduleConfig, setShowScheduleConfig] = useState(false);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const preTeaNotifiedDateRef = useRef<string>('');
  const startTeaNotifiedDateRef = useRef<string>('');

  const isFemale = profile.gender === 'female';
  const firstName = useMemo(
    () => (profile.artistName || '').trim().split(/\s+/)[0] || (isFemale ? 'فنانة' : 'فنان'),
    [profile.artistName, isFemale]
  );

  // تشغيل قراءة صوتية هادئة بالعربية عند تفعيل TTS
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
      } catch {
        // تجاهل صامت
      }
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

  // التحميل الأولي + حساب الغياب المتدرج + تحديث last_active_at
  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedPrefs, loadedJournals, loadedCare] = await Promise.all([
        loadCompanionPrefs(profile),
        loadDailyJournals(tenantId),
        loadPersonalCareEvents(tenantId),
      ]);
      if (!active) return;

      setPrefs(loadedPrefs);
      setJournals(loadedJournals);
      setCareEvents(loadedCare);

      if (loadedJournals[0]?.mood_color) {
        setCurrentMood(loadedJournals[0].mood_color);
      }

      // حساب ساعات الغياب قبل تحديث last_active_at
      const lastTs = loadedPrefs.last_active_at ? new Date(loadedPrefs.last_active_at).getTime() : Date.now();
      const absenceHours = Math.max(0, (Date.now() - lastTs) / (3600 * 1000));
      const openCareEvent = loadedCare.find((e) => e.status !== 'closed') || null;

      if (absenceHours >= 24) {
        const plan = buildGraduatedAbsenceGreeting({
          absenceHours,
          profile,
          recentCareEvent: openCareEvent,
        });
        if (plan.tier !== 'none') {
          setAbsencePlan(plan);
          setCurrentMood(plan.moodColor);
          setShowAbsenceStage(true);
        }
      }

      // تحديث last_active_at للوقت الحالي
      void saveCompanionPrefs(profile, { last_active_at: new Date().toISOString() });

      // رسالة ترحيبية أولية دافئة في سجل الجلسة (بدون أي رسائل خصوصية روبوتية!)
      const openingMsg: FadfadaChatItem = {
        id: 'welcome_init',
        sender: 'shamousa',
        moodColor: openCareEvent && loadedPrefs.protection_mode ? 'purple_care' : 'blue_calm',
        text:
          openCareEvent && loadedPrefs.protection_mode
            ? `أهلاً بيك يا ${firstName} 💜 وضع الحماية شغال عشان بالك يرتاح. طمّني على ${openCareEvent.person_name}، واحكيلي لو في أي حاجة بسيطة أقدر أشيلها عنك النهاردة.`
            : isFemale
            ? `أهلاً يا ${firstName} ☀️ كوباية الشاي جاهزة؟ احكيلي يومك في الورشة ماشي إزاي.. شغل، عملاء، خامات، أو حتى فضفضة عادية، وأنا معاكي قلباً وقالباً.`
            : `أهلاً يا ${firstName} ☀️ كوباية الشاي جاهزة؟ احكيلي يومك في الورشة ماشي إزاي.. شغل، عملاء، خامات، أو حتى فضفضة عادية، وأنا معاك خطوة بخطوة.`,
        timestamp: new Date().toISOString(),
      };
      setMessages([openingMsg]);

      await refreshOR();
    })();

    return () => {
      active = false;
    };
  }, [profile, tenantId, firstName, isFemale, refreshOR]);

  // مؤقت خلفي ذكي كل 60 ثانية: تذكير الفضفضة قبل 15 دقيقة + تذكيرات الرعاية الشخصية قبل وبعد الموعد
  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);

      // 1. طقس الفضفضة اليومي (قبل 15 دقيقة + عند الموعد)
      if (prefs.fadfada_time && /^\d{2}:\d{2}$/.test(prefs.fadfada_time)) {
        const [hh, mm] = prefs.fadfada_time.split(':').map(Number);
        const targetMins = hh * 60 + mm;
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const diff = targetMins - nowMins;

        if (diff <= 15 && diff >= 12 && preTeaNotifiedDateRef.current !== todayKey) {
          preTeaNotifiedDateRef.current = todayKey;
          playGentleTeaChime();
          setProactiveBanner({
            id: `tea_pre_${todayKey}`,
            tone: 'tea',
            title: 'فاضل ربع ساعة على وقت الفضفضة ☕✨',
            body: 'جهز كوباية الشاي أو الينسون بتاعك.. فاضل ربع ساعة على وقت الفضفضة مع شموسة ☕✨',
          });
        } else if (diff <= 0 && diff >= -2 && startTeaNotifiedDateRef.current !== todayKey) {
          startTeaNotifiedDateRef.current = todayKey;
          playGentleTeaChime();
          setProactiveBanner({
            id: `tea_start_${todayKey}`,
            tone: 'tea',
            title: 'جه وقت الفضفضة الهادية مع شموسة 🌙',
            body: `يلا نلم يوم الورشة في دقيقتين بهدوء يا ${firstName}؟`,
          });
        }
      }

      // 2. المتابعة الاستباقية لأحداث الرعاية الشخصية (قبل بساعة / بعد بساعة ونص لساعتين)
      careEvents.forEach((ev) => {
        if (ev.status === 'closed') return;
        const evTime = new Date(ev.event_time).getTime();
        const diffMins = (evTime - now.getTime()) / (60 * 1000);

        // قبل الموعد بـ 45 إلى 65 دقيقة
        if (!ev.reminder_sent && diffMins <= 65 && diffMins >= 10) {
          playGentleTeaChime();
          setProactiveBanner({
            id: `care_pre_${ev.id}`,
            tone: 'care',
            title: `تذكير لطيف بموعد ${ev.person_name} 💜`,
            body: `يا ${firstName}، فاضل حوالي ساعة على موعد ${ev.person_name}. ربنا يطمن قلبك ويعدّيها على ألف خير 🤍`,
            careEventId: ev.id,
          });
          setCareEvents((prev) =>
            prev.map((x) => (x.id === ev.id ? { ...x, reminder_sent: true, status: 'reminded' } : x))
          );
          void updatePersonalCareEvent(tenantId, ev.id, { reminder_sent: true, status: 'reminded' });
        }

        // بعد الموعد بـ 90 إلى 180 دقيقة
        if (!ev.followup_sent && diffMins <= -90 && diffMins >= -360) {
          playGentleTeaChime();
          setProactiveBanner({
            id: `care_post_${ev.id}`,
            tone: 'followup',
            title: `طمّني على ${ev.person_name} 💜`,
            body: `يا ${firstName}، طمّني ${ev.person_name} عامل إيه دلوقتي بعد الموعد؟ يا رب تكون أخبار تطمّن القلب 🤍`,
            careEventId: ev.id,
          });
          setCareEvents((prev) =>
            prev.map((x) => (x.id === ev.id ? { ...x, followup_sent: true, status: 'followed_up' } : x))
          );
          void updatePersonalCareEvent(tenantId, ev.id, { followup_sent: true, status: 'followed_up' });
        }
      });
    };

    checkSchedules();
    const timer = window.setInterval(checkSchedules, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [prefs.fadfada_time, careEvents, firstName, tenantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, activeTab]);

  // التسجيل الصوتي باللهجة المصرية (Web Speech API)
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

  // إرسال فضفضة يومية -> تحليل حتمي فوري + حفظ + رعاية شخصية + استثناء إنساني صامت
  const handleSendFadfada = async (customText?: string) => {
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

    // 1. تحليل 90% محلي فوري
    const analysis = analyzeFadfadaEntry(text, profile);
    setCurrentMood(analysis.moodColor);

    // 2. تسجيل الحدث الشخصي وتفعيل وضع الحماية تلقائياً لو ظرف صحي
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

    // 3. بروتوكول الاستثناء الإنساني الصامت تماماً (خلف الكواليس فقط — لا يظهر للمستخدم)
    if (analysis.humanitarianSignal) {
      void recordSilentHumanitarianAlert({
        profile,
        summary: analysis.humanitarianSignal.summary,
        severity: analysis.humanitarianSignal.severity,
      });
    }

    // 4. صياغة نهائية (رد مصري محلي غني، مع تحسين اختياري خفيف للرسائل الطويلة غير الحساسة)
    let finalReply = analysis.replyText;
    if (text.length > 45 && !analysis.careEvent && !analysis.humanitarianSignal) {
      finalReply = await optionalLightAiPolish({
        userText: text,
        localReply: analysis.replyText,
        profile,
      });
    }

    // 5. حفظ اليومية في Supabase + المحلي
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

    const botBubble: FadfadaChatItem = {
      id: `s_${Date.now()}`,
      sender: 'shamousa',
      text: finalReply,
      moodColor: analysis.moodColor,
      actionChips: analysis.actionChips,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, botBubble]);
    speakArabic(finalReply);
    setIsSubmitting(false);

    // تحديث بحوث العمليات بالخلفية لربط تحديات اليومية بتشخيص المبيعات
    void refreshOR();
  };

  const handleActionChip = async (chip: FadfadaActionChip) => {
    if (chip.kind === 'open_or') {
      setActiveTab('or360');
      return;
    }
    if (chip.kind === 'enable_protection') {
      const updated = await saveCompanionPrefs(profile, { protection_mode: true });
      setPrefs(updated);
      return;
    }
    if (chip.kind === 'navigate' && chip.targetView && onNavigateView) {
      onNavigateView(chip.targetView);
      setIsOpen(false);
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
      setIsOpen(false);
    }
  };

  const handleToggleProtectionMode = async () => {
    const updated = await saveCompanionPrefs(profile, { protection_mode: !prefs.protection_mode });
    setPrefs(updated);
  };

  const handleUpdateSchedule = async (patch: Partial<CompanionUserPrefs>) => {
    const updated = await saveCompanionPrefs(profile, patch);
    setPrefs(updated);
  };

  // بناء تقويم المزاج لآخر 14 يوماً
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

  // ملخص أسبوعي هادئ من فضفضة آخر 7 أيام لقعدة النتايج
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

  const activePalette = MOOD_WAVE_PALETTE[currentMood] || MOOD_WAVE_PALETTE.blue_calm;
  const openCareEvents = useMemo(() => careEvents.filter((e) => e.status !== 'closed'), [careEvents]);
  const pendingOrCount = useMemo(
    () => (orReport?.recommendations || []).filter((r) => r.status === 'pending').length,
    [orReport]
  );

  // إخفاء الزر العائم فقط عند فتح مودال رئيسي آخر لتجنب الزحام
  const hideFloatingTrigger = isAnyModalOpen && !isOpen;

  return (
    <>
      {/* 1. الإشعار الاستباقي اللطيف (ربع ساعة قبل الفضفضة أو متابعة رعاية شخصية) */}
      <AnimatePresence>
        {proactiveBanner && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="fixed bottom-40 left-4 z-[58] w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-amber-300/80 dark:border-amber-700/70 bg-white/95 dark:bg-[#0F1A33]/95 backdrop-blur-md shadow-2xl p-4"
            dir="rtl"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  proactiveBanner.tone === 'tea'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                }`}
              >
                {proactiveBanner.tone === 'tea' ? <Coffee className="w-5 h-5" /> : <HeartHandshake className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">{proactiveBanner.title}</div>
                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                  {proactiveBanner.body}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProactiveBanner(null);
                      setActiveTab('fadfada');
                      setIsOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black transition cursor-pointer"
                  >
                    افتحي جلسة شموسة
                  </button>
                  <button
                    type="button"
                    onClick={() => setProactiveBanner(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                  >
                    لاحقاً
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. مشهد الترحيب المتدرج عند الغياب (Graduated Absence Animation Stage) */}
      <AnimatePresence>
        {showAbsenceStage && absencePlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[72] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
            dir="rtl"
          >
            <motion.div
              initial={
                prefersReducedMotion
                  ? { opacity: 0, scale: 0.96 }
                  : absencePlan.tier === 'joyful_orbit'
                  ? { opacity: 0, x: -240, y: 180, rotate: -18, scale: 0.6 }
                  : absencePlan.tier === 'gentle_hop'
                  ? { opacity: 0, y: 40, scale: 0.9 }
                  : { opacity: 0, y: 20, scale: 0.96 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1, scale: 1 }
                  : absencePlan.tier === 'joyful_orbit'
                  ? {
                      opacity: 1,
                      x: [null, 60, -16, 0],
                      y: [null, -40, -18, 0, -12, 0],
                      rotate: [null, 8, -4, 0],
                      scale: 1,
                    }
                  : absencePlan.tier === 'gentle_hop'
                  ? { opacity: 1, y: [24, -10, 0, -5, 0], scale: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              transition={{
                duration: absencePlan.tier === 'joyful_orbit' ? 1.15 : 0.7,
                ease: 'easeOut',
              }}
              className={`relative w-full max-w-md rounded-3xl overflow-hidden border shadow-2xl bg-gradient-to-br ${
                MOOD_WAVE_PALETTE[absencePlan.moodColor].bgGradient
              } border-amber-300/80 dark:border-amber-600/50 p-6`}
            >
              <DynamicAmbientWaves mood={absencePlan.moodColor} />
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${
                      MOOD_WAVE_PALETTE[absencePlan.moodColor].badgeClass
                    }`}
                  >
                    {absencePlan.respectsCarePriority ? (
                      <>
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>أولوية الاطمئنان الإنساني</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-3.5 h-3.5" />
                        <span>وحشتي شموسة ({Math.round(absencePlan.absenceHours)} ساعة)</span>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAbsenceStage(false)}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 cursor-pointer"
                    aria-label="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                  {absencePlan.headline}
                </h3>
                <p className="text-sm text-[#334155] dark:text-[#E2E8F0] mt-2.5 leading-relaxed">
                  {absencePlan.message}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAbsenceStage(false);
                      setActiveTab(absencePlan.respectsCarePriority ? 'fadfada' : 'weekly');
                      setIsOpen(true);
                    }}
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-black shadow-md transition cursor-pointer"
                  >
                    {absencePlan.respectsCarePriority ? 'أطمّنك الآن 💜' : 'يلا نبدأ بخلاصة الورشة ✨'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAbsenceStage(false)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-stone-300/70 dark:border-slate-700 text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                  >
                    لاحقاً
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. الزر العائم المنسّق أعلى ShamousaChatWidget (بدون أي تداخل) */}
      {!hideFloatingTrigger && !isOpen && (
        <motion.button
          type="button"
          onClick={() => setIsOpen(true)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="fixed bottom-24 left-4 z-[55] flex items-center gap-2.5 pl-3.5 pr-3 py-2.5 rounded-full bg-gradient-to-l from-[#0C1427] via-[#172544] to-[#1E3158] dark:from-[#132040] dark:to-[#1F3566] text-white border border-amber-400/50 shadow-xl hover:shadow-amber-500/20 cursor-pointer"
          title="يومي والفضفضة + محرك بحوث العمليات 360°"
          dir="rtl"
        >
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative"
            style={{ backgroundColor: `${activePalette.dotColor}26`, border: `1.5px solid ${activePalette.dotColor}` }}
          >
            {prefs.protection_mode ? (
              <Shield className="w-4 h-4 text-purple-300" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span
              className="w-2.5 h-2.5 rounded-full absolute -top-0.5 -right-0.5 ring-2 ring-[#0C1427]"
              style={{ backgroundColor: activePalette.dotColor }}
            />
          </span>
          <div className="text-right leading-tight">
            <div className="text-xs font-black text-[#F7F3EA] flex items-center gap-1.5">
              <span>يومي وبحوث العمليات</span>
              {pendingOrCount > 0 && !prefs.protection_mode && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#EA580C] text-[10px] font-black text-white">
                  {pendingOrCount}
                </span>
              )}
            </div>
            <div className="text-[10px] text-amber-200/90 font-medium">
              {prefs.protection_mode ? 'وضع الحماية مفعّل 💜' : activePalette.shortAr}
            </div>
          </div>
        </motion.button>
      )}

      {/* 4. اللوحة التفاعلية الشاملة لشموسة (يومي والفضفضة + قعدة النتايج + محرك بحوث العمليات 360°) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/45 backdrop-blur-[2px]"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, y: 36, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.24 }}
              className="w-full sm:max-w-3xl h-[92vh] sm:h-[min(760px,90vh)] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden bg-[#FAF7F0] dark:bg-[#0B1222] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl"
            >
              {/* Header مع الموجات الحية المتغيرة حسب الحالة المزاجية */}
              <div
                className={`relative overflow-hidden bg-gradient-to-l ${activePalette.bgGradient} border-b border-[#D4CCBC]/70 dark:border-[#22355E] px-4 sm:px-5 pt-4 pb-3`}
              >
                <DynamicAmbientWaves mood={currentMood} compact />

                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#0C1427] dark:bg-[#162447] text-amber-300 flex items-center justify-center shadow-md shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                          شموسة · مستشارة الورشة وبحوث العمليات
                        </h2>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${activePalette.badgeClass}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: activePalette.dotColor }}
                          />
                          {activePalette.labelAr}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#475569] dark:text-[#CBD5E1] mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>وقت الفضفضة: {prefs.fadfada_time}</span>
                        <span>•</span>
                        <span>
                          قعدة النتايج:{' '}
                          {WEEKDAY_OPTIONS.find((w) => w.value === prefs.weekly_review_day)?.label || 'الجمعة'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleProtectionMode}
                      title="وضع الحماية (تهدئة تنبيهات الشغل وقت الظروف الصحية أو الأسرية)"
                      className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                        prefs.protection_mode
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-white/75 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border-stone-300/70 dark:border-slate-700'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <span className="hidden sm:inline">{prefs.protection_mode ? 'الحماية شغالة' : 'وضع الحماية'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScheduleConfig((v) => !v)}
                      title="ضبط وقت الفضفضة ويوم قعدة النتايج"
                      className="p-2 rounded-xl bg-white/75 dark:bg-slate-900/70 border border-stone-300/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#EA580C] cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-xl bg-white/75 dark:bg-slate-900/70 border border-stone-300/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      aria-label="إغلاق"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* شريط ضبط المواعيد القابل للطي */}
                <AnimatePresence>
                  {showScheduleConfig && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="relative z-10 overflow-hidden"
                    >
                      <div className="mt-3 p-3 rounded-2xl bg-white/85 dark:bg-[#0D172E]/90 border border-[#D4CCBC] dark:border-[#22355E] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <label className="flex flex-col gap-1 font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                          <span className="flex items-center gap-1 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                            <Coffee className="w-3.5 h-3.5 text-[#EA580C]" />
                            وقت الفضفضة اليومي (ينبهك قبلها بـ 15 د)
                          </span>
                          <input
                            type="time"
                            value={prefs.fadfada_time}
                            onChange={(e) => void handleUpdateSchedule({ fadfada_time: e.target.value })}
                            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#0C1427] dark:text-white font-bold"
                          />
                        </label>
                        <label className="flex flex-col gap-1 font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                          <span className="flex items-center gap-1 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                            <Calendar className="w-3.5 h-3.5 text-[#EA580C]" />
                            يوم قعدة النتايج الأسبوعية
                          </span>
                          <select
                            value={prefs.weekly_review_day}
                            onChange={(e) =>
                              void handleUpdateSchedule({
                                weekly_review_day: e.target.value as CompanionUserPrefs['weekly_review_day'],
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#0C1427] dark:text-white font-bold"
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
                              playGentleTeaChime();
                              setAbsencePlan(
                                buildGraduatedAbsenceGreeting({
                                  absenceHours: 54,
                                  profile,
                                  recentCareEvent: openCareEvents[0] || null,
                                })
                              );
                              setIsOpen(false);
                              setShowAbsenceStage(true);
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>تجربة استقبال العودة ونغمة الشاي</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* شريط التبويبات الثلاثة */}
                <div className="relative z-10 mt-3 grid grid-cols-3 gap-1.5 bg-white/65 dark:bg-[#0D172E]/75 p-1 rounded-2xl border border-stone-200/80 dark:border-[#22355E]">
                  {(
                    [
                      { id: 'fadfada', label: 'يومي والفضفضة', icon: Coffee },
                      { id: 'weekly', label: 'قعدة النتايج (3 قرارات)', icon: Award },
                      { id: 'or360', label: 'بحوث العمليات 360°', icon: TrendingUp },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-2 px-2.5 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          active
                            ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white shadow-sm'
                            : 'text-[#475569] dark:text-[#CBD5E1] hover:bg-white/80 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* جسم اللوحة */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
                {/* === التبويب 1: يومي والفضفضة + تقويم المزاج + الرعاية الشخصية === */}
                {activeTab === 'fadfada' && (
                  <div className="flex flex-col h-full gap-3">
                    {/* شريط تقويم المزاج المصغر لآخر 14 يوماً */}
                    <div className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA]">
                          نبض أيامك (آخر 14 يوم)
                        </span>
                        <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                          {journals.length} تدوينة محفوظة لورشتك فقط
                        </span>
                      </div>
                      <div className="grid grid-cols-14 gap-1">
                        {miniMoodCalendar.map((day) => {
                          const meta = day.mood ? MOOD_WAVE_PALETTE[day.mood] : null;
                          return (
                            <div
                              key={day.dateKey}
                              title={`${day.dateKey}${meta ? ` • ${meta.labelAr}` : ' • بدون فضفضة'}`}
                              className="flex flex-col items-center gap-1"
                            >
                              <div
                                className="w-full h-5 rounded-md border transition"
                                style={{
                                  backgroundColor: meta ? `${meta.dotColor}30` : 'transparent',
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

                    {/* شريط مواعيد الرعاية الإنسانية النشطة */}
                    {openCareEvents.length > 0 && (
                      <div className="rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/70 p-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-purple-900 dark:text-purple-200">
                          <HeartHandshake className="w-4 h-4 text-purple-600 dark:text-purple-300 shrink-0" />
                          <span className="font-black">متابعة إنسانية نشطة:</span>
                          <span>
                            {openCareEvents[0].person_name} —{' '}
                            {new Date(openCareEvents[0].event_time).toLocaleString('ar-EG', {
                              weekday: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
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

                    {/* محادثة الفضفضة */}
                    <div className="flex-1 space-y-3 min-h-[220px]">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-sm ${
                              m.sender === 'user'
                                ? 'bg-[#0C1427] text-[#F7F3EA] rounded-tr-sm'
                                : 'bg-white dark:bg-[#13203E] text-[#1E293B] dark:text-[#F1F5F9] border border-[#E5DEC9] dark:border-[#243966] rounded-tl-sm'
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
                                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-300/80 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
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

                    {/* اقتراحات فضفضة سريعة بضغطة زر */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'الحمد لله بعت أوردرات حلوة النهاردة',
                        'البيع هادي شوية ومحتاجة أفكار تنشط السوق',
                        'عندي بواقي خامات كتير ومش عارفة أستغلها',
                        'الشحن اتأخر على عميل النهاردة وقلقانة',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void handleSendFadfada(prompt)}
                          className="px-2.5 py-1 rounded-full bg-white dark:bg-[#13203E] border border-[#D4CCBC] dark:border-[#243966] hover:border-[#EA580C] text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1] cursor-pointer transition"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* === التبويب 2: قعدة النتايج الأسبوعية (3 قرارات جاهزة للتنفيذ) === */}
                {activeTab === 'weekly' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-gradient-to-l from-[#0C1427] to-[#1D315C] text-white p-4 sm:p-5 shadow-md">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-300 mb-1">
                            <Award className="w-4 h-4" />
                            <span>قعدة النتايج وتظبيط الشغل والبيع</span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black">
                            خلاصة أسبوعك في 3 قرارات جاهزة للتنفيذ الفوري
                          </h3>
                          <p className="text-xs text-slate-300 mt-1">
                            دَمجنا فضفضة الأسبوع ({weeklyFadfadaSummary.count} يوميات · مؤشر راحة{' '}
                            {weeklyFadfadaSummary.avgScore}%) مع حسابات بحوث العمليات لورشتك بدون أي زحام أرقام.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void refreshOR()}
                          disabled={loadingOR}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingOR ? 'animate-spin' : ''}`} />
                          <span>تحديث الحسابات</span>
                        </button>
                      </div>

                      {weeklyFadfadaSummary.topTags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {weeklyFadfadaSummary.topTags.map((t) => (
                            <span
                              key={t}
                              className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-amber-200"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* أهم 3 قرارات */}
                    <div className="space-y-3">
                      {(orReport?.weeklyTopThreeDecisions || []).map((rec, index) => (
                        <div
                          key={rec.id}
                          className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#EA580C] text-white font-black text-sm flex items-center justify-center shrink-0">
                                {index + 1}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[10px] font-black">
                                    {rec.categoryBadge}
                                  </span>
                                  {rec.status === 'applied' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      تم التنفيذ
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] mt-1">
                                  {rec.title}
                                </h4>
                                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                                  {rec.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          {rec.suggested_whatsapp_msg && (
                            <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-950 dark:text-emerald-200 leading-relaxed">
                              <span className="font-black block mb-0.5">رسالة الواتساب الجاهزة:</span>
                              {rec.suggested_whatsapp_msg}
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                              {rec.metricsSummary || `تأثير متوقع: ${rec.impact_score}/100`}
                            </span>
                            <div className="flex items-center gap-2">
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
                                  className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <span>{rec.action_payload.buttonLabel}</span>
                                  <ArrowUpLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* === التبويب 3: محرك بحوث العمليات الشامل 360° === */}
                {activeTab === 'or360' && (
                  <div className="space-y-4">
                    {/* بطاقات المؤشرات الرياضية السريعة */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-3">
                        <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                          الربح الأسبوعي الأمثل (LP)
                        </div>
                        <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-1">
                          {(orReport?.projectedWeeklyProfit || 0).toLocaleString('ar-EG')}{' '}
                          <span className="text-xs">{orReport?.currencySymbol || 'ج.م'}</span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-3">
                        <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">خامات قرب النفاد</div>
                        <div className="text-base font-black text-amber-700 dark:text-amber-400 mt-1">
                          {orReport?.stats.lowStockCount || 0} خامات
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-3">
                        <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">عملاء VIP غائبون</div>
                        <div className="text-base font-black text-indigo-700 dark:text-indigo-400 mt-1">
                          {orReport?.stats.dormantVipCount || 0} عملاء
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-3">
                        <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">المنتج البطل</div>
                        <div className="text-xs font-black text-[#EA580C] mt-1.5 truncate">
                          {orReport?.heroProduct?.name || 'أضف منتجاتك'}
                        </div>
                      </div>
                    </div>

                    {/* جدول مزيج الإنتاج الأسبوعي الأمثل */}
                    {orReport && orReport.productMixPlan.length > 0 && (
                      <div className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-3.5">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            <Layers className="w-4 h-4 text-[#EA580C]" />
                            <span>مزيج الإنتاج الأسبوعي الأعلى ربحية ({orReport.weeklyCapacityHours} ساعة)</span>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead>
                              <tr className="border-b border-stone-200 dark:border-slate-700 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
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
                                  className="border-b border-stone-100 dark:border-slate-800/70 last:border-0"
                                >
                                  <td className="py-2 font-black text-[#0C1427] dark:text-[#F7F3EA]">
                                    {row.productName}
                                  </td>
                                  <td className="py-2 font-bold">{row.recommendedQty} قطعة</td>
                                  <td className="py-2">
                                    {row.unitProfit.toLocaleString('ar-EG')} {orReport.currencySymbol}
                                  </td>
                                  <td className="py-2 font-black text-emerald-700 dark:text-emerald-400">
                                    {row.projectedProfit.toLocaleString('ar-EG')} {orReport.currencySymbol}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* فلاتر التوصيات */}
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
                              ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                              : 'bg-white dark:bg-[#101B34] text-[#475569] dark:text-[#CBD5E1] border-[#D4CCBC] dark:border-[#22355E]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* قائمة توصيات بحوث العمليات */}
                    <div className="space-y-3">
                      {filteredOrRecs.map((rec) => (
                        <div
                          key={rec.id}
                          className="rounded-2xl bg-white dark:bg-[#101B34] border border-[#E5DEC9] dark:border-[#22355E] p-3.5 sm:p-4"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md bg-stone-100 dark:bg-slate-800 text-[#0C1427] dark:text-amber-300 text-[10px] font-black">
                              {rec.categoryBadge}
                            </span>
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                              أثر متوقع {rec.impact_score}%
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] mt-1.5">{rec.title}</h4>
                          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                            {rec.description}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                              {rec.metricsSummary}
                            </span>
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
                                className="px-3 py-1.5 rounded-xl bg-[#0C1427] hover:bg-[#EA580C] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
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
                )}
              </div>

              {/* شريط الإدخال الصوتي والنصي السفلي في تبويب الفضفضة */}
              {activeTab === 'fadfada' && (
                <div className="border-t border-[#E5DEC9] dark:border-[#22355E] bg-white dark:bg-[#0D162B] px-3 sm:px-4 py-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendFadfada();
                    }}
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      title="تسجيل صوتي باللهجة المصرية"
                      className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                        isListening
                          ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                          : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 border-stone-200 dark:border-slate-700 hover:border-[#EA580C]'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTtsEnabled((v) => !v)}
                      title={ttsEnabled ? 'إيقاف الرد الصوتي' : 'تفعيل قراءة رد شموسة صوتياً'}
                      className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                        ttsEnabled
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 border-stone-200 dark:border-slate-700'
                      }`}
                    >
                      {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="احكي لشموسة يومك، مبيعاتك، خاماتك، أو أي ظرف يخصك..."
                      className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] dark:bg-[#13203E] border border-[#D4CCBC] dark:border-[#243966] text-xs sm:text-sm text-[#0C1427] dark:text-[#F7F3EA] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#EA580C]"
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting || !inputText.trim()}
                      className="px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">إرسال</span>
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ShamousaCompanion;
