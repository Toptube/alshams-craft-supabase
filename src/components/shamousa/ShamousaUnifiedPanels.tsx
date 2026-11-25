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
  CheckCheck,
  HelpCircle,
  X,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { isUserAdmin, type UserProfile } from '../../types';
import { useUserSubscription, hasFeature } from '../../types/subscriptions';
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
import {
  useUiLayoutConfig,
  DEFAULT_AI_ASSISTANTS_UI_CONFIG,
} from '../../types/uiLayoutConfig';
import {
  loadShamousaOrMemory,
  toggleItemReadInMemory,
  markManyReadInMemory,
  dismissItemInMemory,
  dismissManyInMemory,
  restoreDismissedInMemory,
  type ShamousaExplainPayload,
} from '../../services/shamousaOrMemory';
import { useInstantVoiceDictation } from '../../hooks/useInstantVoiceDictation';
import { usePersonaSpeech } from '../../hooks/usePersonaSpeech';
import { db } from '../../db/dexieDB';
import {
  runAllThreeAnalyticBrainsOffline,
  setAccountBrainDecision,
  type AnalyticBrainRecommendation,
  type AnalyticBrainType,
  type RecommendationUserDecision,
} from '../../services/shamousaAnalyticBrains';
import {
  recordBrainRecommendationFeedback,
  buildWeeklyLearningSummary,
  resetAccountLearning,
  type WeeklyLearningSummaryResult,
} from '../../services/shamousaSelfCheckAndLearning';

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
  onAskShamousaAboutItem?: (payload: ShamousaExplainPayload) => void;
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
  onAskShamousaAboutItem,
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
  const [memoryState, setMemoryState] = useState(() => loadShamousaOrMemory(tenantId));
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [brainTop3, setBrainTop3] = useState<AnalyticBrainRecommendation[]>([]);
  const [weeklyLearning, setWeeklyLearning] = useState<WeeklyLearningSummaryResult | null>(null);
  const [brainDecisionVersion, setBrainDecisionVersion] = useState(0);
  const userSub = useUserSubscription(profile);
  const isSuperAdmin = isUserAdmin(profile);

  useEffect(() => {
    setMemoryState(loadShamousaOrMemory(tenantId));
  }, [tenantId]);

  useEffect(() => {
    if (mode !== 'results' || !tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const pkgOpts = {
          role: (isSupplier ? 'supplier' : 'artisan') as 'artisan' | 'supplier',
          overrideSub: userSub,
          isAdmin: isSuperAdmin,
        };
        const canInv = hasFeature('inventory', profile.id, pkgOpts);
        const [prods, mats, ords, wOrders] = await Promise.all([
          db.products.where('tenantId').equals(tenantId).toArray().catch(() => []),
          canInv ? db.rawMaterials.where('tenantId').equals(tenantId).toArray().catch(() => []) : Promise.resolve([]),
          db.orders.where('tenantId').equals(tenantId).toArray().catch(() => []),
          db.workOrders.where('tenantId').equals(tenantId).toArray().catch(() => []),
        ]);
        if (cancelled) return;
        const report = runAllThreeAnalyticBrainsOffline({
          accountId: profile.id,
          packageOptions: pkgOpts,
          isSupplier,
          firstName,
          brandName: profile.brandName,
          products: prods,
          rawMaterials: mats,
          orders: ords,
          workOrders: wOrders,
          currency: profile.currencySymbol || 'ج.م',
        });
        setBrainTop3(report.topThreeRecommendations.slice(0, 3));
        setWeeklyLearning(
          buildWeeklyLearningSummary({
            accountId: profile.id,
            packageOptions: pkgOpts,
            orders: ords,
            firstName,
          })
        );
      } catch {
        if (!cancelled) setBrainTop3([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mode,
    tenantId,
    profile.id,
    profile.brandName,
    profile.currencySymbol,
    firstName,
    isSupplier,
    userSub,
    isSuperAdmin,
    brainDecisionVersion,
  ]);

  const handleBrainDecision = (
    recId: string,
    brain: AnalyticBrainType,
    decision: RecommendationUserDecision
  ) => {
    setAccountBrainDecision(profile.id, recId, decision);
    recordBrainRecommendationFeedback(profile.id, { recId, brain, decision });
    setBrainDecisionVersion((v) => v + 1);
  };

  const handleResetMyLearning = () => {
    resetAccountLearning(profile.id);
    setBrainDecisionVersion((v) => v + 1);
  };

  const toggleExpandCard = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMarkRead = (id: string) => {
    setMemoryState(toggleItemReadInMemory(tenantId, id));
  };

  const handleDismissRec = (id: string) => {
    setMemoryState(dismissItemInMemory(tenantId, id));
    void updateRecommendationStatus(tenantId, id, 'dismissed');
  };

  const handleMarkAllRead = (ids: string[]) => {
    if (ids.length === 0) return;
    setMemoryState(markManyReadInMemory(tenantId, ids));
  };

  const handleClearAll = (ids: string[]) => {
    if (ids.length === 0) return;
    setMemoryState(dismissManyInMemory(tenantId, ids));
    ids.forEach((id) => void updateRecommendationStatus(tenantId, id, 'dismissed'));
  };

  const handleRestoreDismissed = (ids: string[]) => {
    setMemoryState(restoreDismissedInMemory(tenantId, ids));
    ids.forEach((id) => void updateRecommendationStatus(tenantId, id, 'pending'));
  };

  const askAboutRecommendation = (rec: ORRecommendation, source: 'result' | 'or360') => {
    onAskShamousaAboutItem?.({
      id: rec.id,
      source,
      category: rec.recommendation_type || rec.categoryBadge,
      title: rec.title,
      detail: rec.description,
      metricsSummary: rec.metricsSummary || `تأثير متوقع: ${rec.impact_score}%`,
      targetView: rec.action_payload?.targetView,
      actionLabel: rec.action_payload?.buttonLabel,
    });
  };

  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<FadfadaChatItem[]>([]);

  const inputTextLatestRef = useRef(inputText);
  inputTextLatestRef.current = inputText;
  const dailyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastInjectedIdRef = useRef<string>('');

  const {
    isListening,
    toggleListening: toggleVoiceInput,
    stopListening: stopVoiceInput,
  } = useInstantVoiceDictation({
    getCurrentValue: () => inputTextLatestRef.current,
    onTextChange: (nextVal) => {
      setInputText(nextVal);
      if (dailyTextareaRef.current) {
        dailyTextareaRef.current.style.height = 'auto';
        dailyTextareaRef.current.style.height =
          Math.min(Math.max(dailyTextareaRef.current.scrollHeight, 52), 124) + 'px';
      }
    },
    lang: 'ar-EG',
  });

  const dailySpeech = usePersonaSpeech('shamousa');
  const ttsEnabled = dailySpeech.isEnabled;

  const speakArabic = useCallback(
    (text: string) => {
      if (dailySpeech.isEnabled) {
        dailySpeech.speak(text);
      }
    },
    [dailySpeech]
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

    dailySpeech.unlock();
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

        {/* شريط الإدخال السفلي — مساحة كتابة واضحة من سطرين فوق شريط الأدوات */}
        <div className="border-t border-[#D8CBB4] dark:border-[#243E7D] bg-[#EFE6D5] dark:bg-[#0B1838] px-3 sm:px-4 py-2 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              stopVoiceInput();
              void handleSendDaily();
            }}
            className="rounded-2xl bg-[#FBF7F0] dark:bg-[#112454] border border-[#D4C6AD] dark:border-[#2D4C96] focus-within:ring-2 focus-within:ring-[#3B5CA8] transition overflow-hidden"
          >
            <textarea
              ref={dailyTextareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(Math.max(e.target.scrollHeight, 52), 124) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  stopVoiceInput();
                  void handleSendDaily();
                }
              }}
              placeholder={aiCfg.shamousaDailyPlaceholder}
              className="w-full min-h-[52px] max-h-32 resize-none overflow-y-auto px-3.5 pt-2.5 pb-1 bg-transparent text-[13px] sm:text-sm text-[#12244D] dark:text-[#F8FAFC] placeholder:text-[#64748B] dark:placeholder:text-[#94A3B8] leading-relaxed focus:outline-none block"
            />

            <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-pressed={isListening}
                  title={isListening ? 'إيقاف الميكروفون' : 'تحدث بصوتك ليتحول لكتابة فوراً'}
                  className={`relative w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                    isListening
                      ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_12px_rgba(225,29,72,0.55)] ring-2 ring-rose-400/40'
                      : 'bg-[#EFE6D5] dark:bg-[#13285C] text-[#1E2F57] dark:text-[#CBD5E1] border-[#D4C6AD] dark:border-[#2B488D]'
                  }`}
                >
                  {isListening && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-300 animate-ping pointer-events-none" />
                  )}
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {dailySpeech.isSupported && (
                  <button
                    type="button"
                    onClick={dailySpeech.toggleEnabled}
                    aria-pressed={ttsEnabled}
                    title={ttsEnabled ? 'إيقاف الرد الصوتي' : 'قراءة رد شموسة صوتياً'}
                    className={`w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                      ttsEnabled
                        ? 'bg-[#162E66] text-white dark:bg-[#DCE4F0] dark:text-[#0B1838] border-transparent'
                        : 'bg-[#EFE6D5] dark:bg-[#13285C] text-[#1E2F57] dark:text-[#CBD5E1] border-[#D4C6AD] dark:border-[#2B488D]'
                    }`}
                  >
                    {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !inputText.trim()}
                className="h-8 px-3.5 rounded-xl bg-[#142A5C] hover:bg-[#1E3B7D] dark:bg-gradient-to-b dark:from-[#E2E8F0] dark:to-[#CBD5E1] dark:text-[#0B1838] disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =================== PANEL 2: نتائج (قعدة النتائج الأسبوعية) ===================
  if (mode === 'results') {
    const allWeeklyRecs = orReport?.weeklyTopThreeDecisions || [];
    const visibleWeeklyRecs = allWeeklyRecs.filter(
      (r) => !memoryState.dismissedIds.includes(r.id) && r.status !== 'dismissed'
    );
    const dismissedWeeklyIds = allWeeklyRecs
      .filter((r) => memoryState.dismissedIds.includes(r.id) || r.status === 'dismissed')
      .map((r) => r.id);
    const visibleWeeklyIds = visibleWeeklyRecs.map((r) => r.id);

    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-5 py-4 space-y-3.5">
        <div className="max-w-3xl mx-auto space-y-3.5">
          <div className="rounded-2xl bg-[#142A5C] dark:bg-[#12275A] border border-[#2C4B94] text-white p-4 sm:p-5 shadow-md">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#CBD5E1] mb-1">
                  <Award className="w-4 h-4 text-[#F8FAFC]" />
                  <span>قعدة النتائج وتظبيط الشغل والبيع</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  خلاصة أسبوعك في قرارات جاهزة للتنفيذ الفوري
                </h3>
                <p className="text-xs text-[#CBD5E1] mt-1">
                  دمجنا يوميات الأسبوع ({weeklyFadfadaSummary.count} تدوينات · مؤشر راحة{' '}
                  {weeklyFadfadaSummary.avgScore}%) مع حسابات بحوث العمليات وذاكرة شموسة.
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

          {/* العقول التحليلية الثلاثة (الاستراتيجي + الفني + التسويقي) — حد أقصى 3 توصيات بصيغة موحدة من 5 عناصر */}
          {brainTop3.length > 0 && (
            <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3.5 sm:p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h4 className="text-xs sm:text-sm font-black text-[#12244D] dark:text-[#F8FAFC]">
                    أهم {brainTop3.length} توصيات من العقول التحليلية الثلاثة
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                  أوفلاين • حسب باقات حسابك
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {brainTop3.slice(0, 3).map((rec, idx) => (
                  <div
                    key={rec.id}
                    className="rounded-xl bg-white/85 dark:bg-[#142A5C]/85 border border-[#E5DAC6] dark:border-[#2A4588] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="w-5 h-5 rounded-md bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100/80 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200">
                          {rec.brainLabelAr}
                        </span>
                        <span className="text-xs font-black text-[#12244D] dark:text-[#F8FAFC]">
                          {rec.titleAr}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onAskShamousaAboutItem?.({
                            id: rec.id,
                            source: 'result',
                            category: rec.brainLabelAr,
                            title: rec.titleAr,
                            detail: `${rec.problemAr}\n${rec.solutionAr}`,
                            metricsSummary: rec.evidenceAr,
                          })
                        }
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#091533] text-[10px] font-black transition cursor-pointer"
                      >
                        اسأل شموسة
                      </button>
                    </div>
                    <div className="text-[11px] text-[#334155] dark:text-[#CBD5E1] space-y-0.5 leading-relaxed">
                      <p>
                        <strong className="text-[#12244D] dark:text-white">المشكلة:</strong> {rec.problemAr}
                      </p>
                      <p>
                        <strong className="text-[#12244D] dark:text-white">الدليل من أرقام حسابك:</strong> {rec.evidenceAr}
                      </p>
                      <p>
                        <strong className="text-[#12244D] dark:text-white">الحل:</strong> {rec.solutionAr}
                      </p>
                      <p>
                        <strong className="text-[#12244D] dark:text-white">الخطوة الجاية:</strong> {rec.nextStepAr}
                      </p>
                      <p>
                        <strong className="text-[#12244D] dark:text-white">الأثر المتوقع:</strong> {rec.expectedImpactAr}
                      </p>
                      {rec.safetyWarningAr && (
                        <p className="text-amber-800 dark:text-amber-300 font-bold">⚠️ {rec.safetyWarningAr}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleBrainDecision(rec.id, rec.brain, 'will_do')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer transition"
                      >
                        هنفّذ ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBrainDecision(rec.id, rec.brain, 'snoozed')}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-black cursor-pointer transition"
                      >
                        أجّل ⏳
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBrainDecision(rec.id, rec.brain, 'not_suitable')}
                        className="px-2.5 py-1 rounded-lg bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black cursor-pointer transition"
                      >
                        مش مناسب ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ملخص أسبوعي قصير: اللي اتعلمته منك + زرار صفّر تعلّمي (محلي للحساب فقط) */}
          {weeklyLearning && (
            <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3.5 sm:p-4 space-y-2 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-[#12244D] dark:text-[#F8FAFC]">
                  🧠 اللي اتعلمته منك (خاص بحسابك فقط)
                </h4>
                <button
                  type="button"
                  onClick={handleResetMyLearning}
                  className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>صفّر تعلّمي</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[#334155] dark:text-[#CBD5E1]">
                <div className="rounded-xl bg-white/80 dark:bg-[#142A5C]/80 border border-[#E5DAC6] dark:border-[#2A4588] p-2">
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">النبرة المفضلة</div>
                  <div className="font-black text-[#12244D] dark:text-white">{weeklyLearning.preferredToneLabelAr}</div>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-[#142A5C]/80 border border-[#E5DAC6] dark:border-[#2A4588] p-2">
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">طول الردود والنصوص</div>
                  <div className="font-black text-[#12244D] dark:text-white">{weeklyLearning.lengthLabelAr}</div>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-[#142A5C]/80 border border-[#E5DAC6] dark:border-[#2A4588] p-2">
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">تفاعلاتك المسجّلة</div>
                  <div className="font-black text-[#12244D] dark:text-white">
                    {weeklyLearning.feedbackCount} تقييم • {weeklyLearning.topBrainLabelAr}
                  </div>
                </div>
              </div>
              {weeklyLearning.evaluatedImpacts.length > 0 && (
                <p className="text-[11px] text-[#142A5C] dark:text-[#E2E8F0] bg-white/70 dark:bg-[#142A5C]/60 rounded-xl px-2.5 py-1.5 border border-[#E5DAC6] dark:border-[#2A4588]">
                  📈 {weeklyLearning.evaluatedImpacts[0].summaryAr}
                </p>
              )}
            </div>
          )}

          {/* شريط الإجراءات الجماعية السريعة: تعليم الكل كمقروء / مسح الكل / استعادة */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
              {visibleWeeklyRecs.length} قرارات ظاهرة
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {visibleWeeklyRecs.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleMarkAllRead(visibleWeeklyIds)}
                    className="px-2.5 py-1 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] border border-[#D5C7B0] dark:border-[#2C4A91] text-[#142A5C] dark:text-[#E2E8F0] hover:border-emerald-500 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>الكل مقروء</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearAll(visibleWeeklyIds)}
                    className="px-2.5 py-1 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] border border-[#D5C7B0] dark:border-[#2C4A91] text-rose-700 dark:text-rose-300 hover:border-rose-400 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>مسح الكل</span>
                  </button>
                </>
              )}
              {dismissedWeeklyIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleRestoreDismissed(dismissedWeeklyIds)}
                  className="px-2.5 py-1 rounded-xl bg-[#EAE0CE] dark:bg-[#19326E] text-[#142A5C] dark:text-[#CBD5E1] text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة ({dismissedWeeklyIds.length})</span>
                </button>
              )}
            </div>
          </div>

          {visibleWeeklyRecs.length === 0 ? (
            <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-6 text-center space-y-2">
              <p className="text-sm font-black text-[#12244D] dark:text-[#F8FAFC]">
                تمت مراجعة وتفريغ كل نتائج الأسبوع بنجاح ✨
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                اضغط "تحديث" لتوليد قراءة جديدة أو "استعادة" لإظهار البطاقات السابقة.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleWeeklyRecs.map((rec, index) => {
                const isRead = memoryState.readIds.includes(rec.id) || rec.status === 'applied';
                const isExpanded = Boolean(expandedCardIds[rec.id]);
                return (
                  <div
                    key={rec.id}
                    className={`rounded-2xl border p-4 shadow-xs transition-all ${
                      isRead
                        ? 'bg-[#EFE6D7]/70 dark:bg-[#0D1C42]/75 border-emerald-500/40 opacity-80'
                        : 'bg-[#FBF7F0] dark:bg-[#10224E] border-[#D8CBB4] dark:border-[#284486]'
                    }`}
                  >
                    {/* شريط التحكم العلوي للبطاقة: الفئة + أزرار (؟) و (✓✓) و (✕) */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-[#142A5C] dark:bg-[#DCE4F0] text-white dark:text-[#0B1838] font-black text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#EAE0CE] dark:bg-[#1C3573] text-[#142A5C] dark:text-[#E2E8F0] text-[10px] font-black">
                          {rec.categoryBadge}
                        </span>
                        {isRead && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>مقروء</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            askAboutRecommendation(rec, 'result');
                          }}
                          title="اسأل شموسة تشرحهالي وتفهمهالي"
                          aria-label="اسأل شموسة تشرحهالي"
                          className="w-7 h-7 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#091533] flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(rec.id);
                          }}
                          title={isRead ? 'تمت القراءة' : 'تحديد كمقروء'}
                          aria-label="تحديد كمقروء"
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition active:scale-90 cursor-pointer ${
                            isRead
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-[#F4ECE0] dark:bg-[#152B5E] border-[#CDBEA3] dark:border-[#2E4C94] text-[#475569] dark:text-[#CBD5E1] hover:text-emerald-600'
                          }`}
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissRec(rec.id);
                          }}
                          title="عرفت خلاص — إزالة من القائمة"
                          aria-label="إزالة البطاقة"
                          className="w-7 h-7 rounded-lg bg-[#F4ECE0] dark:bg-[#152B5E] border border-[#CDBEA3] dark:border-[#2E4C94] text-[#64748B] hover:text-rose-600 hover:border-rose-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* جسم البطاقة القابل للضغط: يفتح تفاصيل أكثر أو يودّي للمكان المختص */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpandCard(rec.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpandCard(rec.id);
                        }
                      }}
                      className="cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-black text-[#12244D] dark:text-[#F8FAFC] group-hover:underline">
                          {rec.title}
                        </h4>
                        <ChevronDown
                          className={`w-4 h-4 text-[#64748B] shrink-0 mt-0.5 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                        {rec.description}
                      </p>
                    </div>

                    {isExpanded && (
                      <div className="mt-2.5 p-3 rounded-xl bg-[#EFE6D7] dark:bg-[#0C1D47] border border-[#D5C7B0] dark:border-[#243C78] space-y-2 text-xs">
                        <div className="font-bold text-[#142A5C] dark:text-[#CBD5E1]">
                          📊 تفاصيل الأثر: {rec.metricsSummary || `تأثير متوقع ${rec.impact_score}/100`}
                        </div>
                        {rec.target_customer_name && (
                          <div className="text-[#475569] dark:text-[#94A3B8]">
                            👤 العميل المعني: <strong className="text-[#12244D] dark:text-white">{rec.target_customer_name}</strong>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => askAboutRecommendation(rec, 'result')}
                            className="px-3 py-1.5 rounded-xl bg-[#142A5C] hover:bg-[#1E3F8A] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>اشرحيهالي يا شموسة في الشات</span>
                          </button>
                        </div>
                      </div>
                    )}

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
                          onClick={() => {
                            handleMarkRead(rec.id);
                            void updateRecommendationStatus(tenantId, rec.id, 'applied');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{rec.action_payload.buttonLabel}</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            handleMarkRead(rec.id);
                            void handleExecuteRecommendation(rec);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#142A5C] hover:bg-[#1E3B7D] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#0B1838] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <span>{rec.action_payload.buttonLabel}</span>
                          <ArrowUpLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =================== PANEL 3: بحوث (بحوث العمليات 360°) ===================
  const accountSub = useUserSubscription(profile);
  const pkgRole = profile?.accountRole === 'supplier' ? 'supplier' : 'artisan';
  const pkgAdmin = isUserAdmin(profile);
  const pkgOpts = { role: pkgRole as 'artisan' | 'supplier', isAdmin: pkgAdmin, overrideSub: accountSub };
  const canCostingPkg = hasFeature('costing', profile?.id || tenantId, pkgOpts);
  const canInventoryPkg = hasFeature('inventory', profile?.id || tenantId, pkgOpts);
  const canCrmPkg = hasFeature('sales_crm', profile?.id || tenantId, pkgOpts) || hasFeature('finance', profile?.id || tenantId, pkgOpts);
  const canStorePkg = hasFeature('storefront', profile?.id || tenantId, pkgOpts) || hasFeature('catalog', profile?.id || tenantId, pkgOpts);

  const visibleOrRecs = filteredOrRecs.filter(
    (r) => !memoryState.dismissedIds.includes(r.id) && r.status !== 'dismissed'
  );
  const dismissedOrIds = filteredOrRecs
    .filter((r) => memoryState.dismissedIds.includes(r.id) || r.status === 'dismissed')
    .map((r) => r.id);
  const visibleOrIds = visibleOrRecs.map((r) => r.id);

  const availableOrFilters = (
    [
      { id: 'all' as const, label: 'الكل', icon: Sparkles, show: true },
      { id: 'operational' as const, label: 'تشغيلي', icon: Package, show: canCostingPkg || canInventoryPkg },
      { id: 'crm_retarget' as const, label: 'عملاء VIP', icon: Users, show: canCrmPkg },
      { id: 'churn_diagnosis' as const, label: 'تشخيص العرض والمبيعات', icon: TrendingUp, show: canStorePkg || canCrmPkg },
      { id: 'marketing' as const, label: 'تسويق وعرض', icon: Award, show: true },
    ]
  ).filter((f) => f.show);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-5 py-4 space-y-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {canCostingPkg && (
            <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3 relative">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">الربح الأسبوعي الأمثل</span>
                <button
                  type="button"
                  onClick={() =>
                    onAskShamousaAboutItem?.({
                      id: 'or_kpi_weekly_profit',
                      source: 'or360',
                      category: 'operational',
                      title: 'الربح الأسبوعي الأمثل من بحوث العمليات',
                      detail: `محرك بحوث العمليات حسب إن الربح الأسبوعي الأمثل لورشتك هو ${(orReport?.projectedWeeklyProfit || 0).toLocaleString('ar-EG')} ${orReport?.currencySymbol || 'ج.م'} بناءً على ساعات التشغيل المتاحة (${orReport?.weeklyCapacityHours || 40} ساعة).`,
                      metricsSummary: `${(orReport?.projectedWeeklyProfit || 0).toLocaleString('ar-EG')} ${orReport?.currencySymbol || 'ج.م'}`,
                    })
                  }
                  title="اسأل شموسة عن الرقم ده"
                  className="w-5 h-5 rounded-md bg-[#EAE0CE] dark:bg-[#19326E] text-[#142A5C] dark:text-[#E2E8F0] flex items-center justify-center cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-base font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                {(orReport?.projectedWeeklyProfit || 0).toLocaleString('ar-EG')}{' '}
                <span className="text-xs">{orReport?.currencySymbol || 'ج.م'}</span>
              </div>
            </div>
          )}
          {canInventoryPkg && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onNavigateView?.(isSupplier ? 'supplier_warehouse_erp' : 'materials')}
              onKeyDown={(e) => e.key === 'Enter' && onNavigateView?.(isSupplier ? 'supplier_warehouse_erp' : 'materials')}
              className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] hover:border-[#142A5C] p-3 cursor-pointer transition"
            >
              <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">خامات قرب النفاد</div>
              <div className="text-base font-black font-mono tabular-nums text-[#142A5C] dark:text-[#E2E8F0] mt-1">
                {orReport?.stats.lowStockCount || 0} خامات
              </div>
            </div>
          )}
          {canCrmPkg && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onNavigateView?.(isSupplier ? 'supplier_customers' : 'customers')}
              onKeyDown={(e) => e.key === 'Enter' && onNavigateView?.(isSupplier ? 'supplier_customers' : 'customers')}
              className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] hover:border-[#142A5C] p-3 cursor-pointer transition"
            >
              <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">عملاء VIP غائبون</div>
              <div className="text-base font-black font-mono tabular-nums text-indigo-700 dark:text-sky-300 mt-1">
                {orReport?.stats.dormantVipCount || 0} عملاء
              </div>
            </div>
          )}
          {canStorePkg && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onNavigateView?.('catalog')}
              onKeyDown={(e) => e.key === 'Enter' && onNavigateView?.('catalog')}
              className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] hover:border-[#142A5C] p-3 cursor-pointer transition"
            >
              <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">المنتج البطل</div>
              <div className="text-xs font-black text-[#142A5C] dark:text-[#F8FAFC] mt-1.5 truncate">
                {orReport?.heroProduct?.name || 'أضف منتجاتك'}
              </div>
            </div>
          )}
        </div>

        {canCostingPkg && orReport && orReport.productMixPlan.length > 0 && (
          <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#12244D] dark:text-[#F8FAFC]">
                <Layers className="w-4 h-4 text-[#1E3A8A] dark:text-[#CBD5E1]" />
                <span>مزيج الإنتاج الأسبوعي الأعلى ربحية ({orReport.weeklyCapacityHours} ساعة)</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onAskShamousaAboutItem?.({
                    id: 'or_product_mix_lp',
                    source: 'or360',
                    category: 'operational',
                    title: 'مزيج الإنتاج الأسبوعي الأعلى ربحية',
                    detail: `بحوث العمليات تقترح إنتاج: ${orReport.productMixPlan
                      .map((r) => `${r.productName} (${r.recommendedQty} قطعة بربح ${r.projectedProfit} ${orReport.currencySymbol})`)
                      .join(' + ')} خلال ${orReport.weeklyCapacityHours} ساعة عمل أسبوعياً.`,
                    metricsSummary: `إجمالي الربح المتوقع: ${orReport.projectedWeeklyProfit} ${orReport.currencySymbol}`,
                    targetView: 'work_orders',
                  })
                }
                title="اسأل شموسة تشرح جدول المزيج ده"
                className="px-2 py-1 rounded-lg bg-[#142A5C] dark:bg-[#DCE4F0] text-white dark:text-[#091533] text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>اشرحيهولي</span>
              </button>
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

        {/* فلاتر بحوث العمليات + الإجراءات الجماعية (تحديد الكل كمقروء / مسح الكل / تحديث) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            {availableOrFilters.map((f) => (
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

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => void refreshOR()}
              disabled={loadingOR}
              className="px-2.5 py-1 rounded-xl bg-[#EAE0CE] dark:bg-[#19326E] text-[#142A5C] dark:text-[#E2E8F0] text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingOR ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
            {visibleOrRecs.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleMarkAllRead(visibleOrIds)}
                  className="px-2.5 py-1 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] border border-[#D5C7B0] dark:border-[#2C4A91] text-[#142A5C] dark:text-[#E2E8F0] text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>الكل مقروء</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleClearAll(visibleOrIds)}
                  className="px-2.5 py-1 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] border border-[#D5C7B0] dark:border-[#2C4A91] text-rose-700 dark:text-rose-300 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>مسح الكل</span>
                </button>
              </>
            )}
            {dismissedOrIds.length > 0 && (
              <button
                type="button"
                onClick={() => handleRestoreDismissed(dismissedOrIds)}
                className="px-2.5 py-1 rounded-xl bg-[#EAE0CE] dark:bg-[#19326E] text-[#142A5C] dark:text-[#CBD5E1] text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>استعادة ({dismissedOrIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {visibleOrRecs.length === 0 ? (
          <div className="rounded-2xl bg-[#FBF7F0] dark:bg-[#10224E] border border-[#D8CBB4] dark:border-[#284486] p-6 text-center space-y-2">
            <p className="text-sm font-black text-[#12244D] dark:text-[#F8FAFC]">
              القائمة نظيفة تماماً ومفيش توصيات متراكمة ✨
            </p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              كل ما تضيف شغل جديد أو تسأل شموسة، بحوث العمليات هتطلعلك توصيات أحدث وأعلى ذكاءً.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleOrRecs.map((rec) => {
              const isRead = memoryState.readIds.includes(rec.id) || rec.status === 'applied';
              const isExpanded = Boolean(expandedCardIds[rec.id]);
              return (
                <div
                  key={rec.id}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${
                    isRead
                      ? 'bg-[#EFE6D7]/70 dark:bg-[#0D1C42]/75 border-emerald-500/40 opacity-80'
                      : 'bg-[#FBF7F0] dark:bg-[#10224E] border-[#D8CBB4] dark:border-[#284486]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#EAE0CE] dark:bg-[#1B3573] text-[#142A5C] dark:text-[#E2E8F0] text-[10px] font-black">
                        {rec.categoryBadge}
                      </span>
                      <span className="text-[10px] font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        أثر {rec.impact_score}%
                      </span>
                      {isRead && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>مقروء</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          askAboutRecommendation(rec, 'or360');
                        }}
                        title="اسأل شموسة تشرحهالي وتفهمهالي"
                        aria-label="اسأل شموسة تشرحهالي"
                        className="w-7 h-7 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#091533] flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(rec.id);
                        }}
                        title={isRead ? 'تمت القراءة' : 'تحديد كمقروء'}
                        aria-label="تحديد كمقروء"
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition active:scale-90 cursor-pointer ${
                          isRead
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-[#F4ECE0] dark:bg-[#152B5E] border-[#CDBEA3] dark:border-[#2E4C94] text-[#475569] dark:text-[#CBD5E1] hover:text-emerald-600'
                        }`}
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissRec(rec.id);
                        }}
                        title="عرفت خلاص — إزالة من القائمة"
                        aria-label="إزالة التوصية"
                        className="w-7 h-7 rounded-lg bg-[#F4ECE0] dark:bg-[#152B5E] border border-[#CDBEA3] dark:border-[#2E4C94] text-[#64748B] hover:text-rose-600 hover:border-rose-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* الضغط على البطاقة نفسها: يفتح تفاصيل أعمق أو يأخذك للشاشة المختصة */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpandCard(rec.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpandCard(rec.id);
                      }
                    }}
                    className="cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-black text-[#12244D] dark:text-[#F8FAFC] group-hover:underline">
                        {rec.title}
                      </h4>
                      <ChevronDown
                        className={`w-4 h-4 text-[#64748B] shrink-0 mt-0.5 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                      {rec.description}
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#EFE6D7] dark:bg-[#0C1D47] border border-[#D5C7B0] dark:border-[#243C78] space-y-2 text-xs">
                      <div className="font-bold text-[#142A5C] dark:text-[#CBD5E1]">
                        🧠 كل ما تضغط «اشرحيهالي» شموسة بتتعلم اهتماماتك وبتحدث توصيات بحوث العمليات الجاية بدقة أعلى!
                      </div>
                      <button
                        type="button"
                        onClick={() => askAboutRecommendation(rec, 'or360')}
                        className="px-3 py-1.5 rounded-xl bg-[#142A5C] hover:bg-[#1E3F8A] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>بعتها لشموسة تشرحهالي بالتفصيل</span>
                      </button>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                      {rec.metricsSummary}
                    </span>
                    {rec.whatsapp_url ? (
                      <a
                        href={rec.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          handleMarkRead(rec.id);
                          void updateRecommendationStatus(tenantId, rec.id, 'applied');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{rec.action_payload.buttonLabel}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleMarkRead(rec.id);
                          void handleExecuteRecommendation(rec);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#142A5C] hover:bg-[#1E3B7D] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#0B1838] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>{rec.action_payload.buttonLabel}</span>
                        <ArrowUpLeft className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShamousaUnifiedPanels;
