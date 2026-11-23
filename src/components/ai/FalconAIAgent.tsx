import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { FalconMascotAvatar, ArtisanAvatar, falconSearchIconImg } from '../brand/BrandAssets';
import { UserProfile, CraftCategory, AIVisionAnalysis, ChatMessage } from '../../types';
import { authedFetch } from '../../lib/apiClient';
import { buildSmartCalculatorExport } from '../../utils/falconCalculatorExport';
import { useUiLayoutConfig, DEFAULT_AI_ASSISTANTS_UI_CONFIG } from '../../types/uiLayoutConfig';
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight';
import { useInstantVoiceDictation } from '../../hooks/useInstantVoiceDictation';
import { usePersonaSpeech } from '../../hooks/usePersonaSpeech';
import { useLiveConnectionStatus } from '../../hooks/useLiveConnectionStatus';
import {
  useUserSubscription,
  buildAiSubscriptionPromptContext,
  detectLockedSubscriptionQuery,
} from '../../types/subscriptions';
import { isUserAdmin } from '../../types';
import {
  Sparkles,
  Camera,
  Send,
  ArrowUp,
  Paperclip,
  Mic,
  MicOff,
  Save,
  Trash2,
  MoreVertical,
  X,
  Plus,
  TrendingUp,
  FileText,
  Grid,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Compass,
  CheckCheck,
  PlusCircle,
  Zap,
  Calculator,
  Globe,
  Aperture,
  Download,
  Store,
  Hammer,
  Home,
  Tag,
  Volume2,
  VolumeX,
} from 'lucide-react';

export interface StructuredCalculatorExport {
  productName?: string;
  category?: CraftCategory | string;
  craftId?: string;
  mainSectionId?: string;
  laborWage?: number;
  hours?: number;
  minMarketPrice?: number;
  recommendedFairPrice?: number;
  maxMarketPrice?: number;
  widthCm?: number;
  heightCm?: number;
  sideHeightCm?: number;
  diameterCm?: number;
  fringeLengthCm?: number;
  weightKg?: number;
  cordTypeId?: string;
  cordThicknessMm?: number;
  pricePerKg?: number;
  notes?: string;
  imageUrl?: string;
  extraMaterials?: Array<{
    id: string;
    name: string;
    unit: string;
    unitPrice: number;
    quantity: number;
    totalCost: number;
  }>;
  costPrice?: number;
  wholesalePrice?: number;
  retailPrice?: number;
  visionAnalysis?: any;
}

interface FalconAIAgentProps {
  profile: UserProfile;
  currentCategory: CraftCategory;
  onApplyCategoryFromAI: (category: CraftCategory) => void;
  onApplyEstimatedLaborWage: (wage: number, hours: number) => void;
  onTransferNotesToCalculator: (notes: string) => void;
  onExportStructuredToCalculator?: (data: StructuredCalculatorExport) => void;
}

export const FALCON_WELCOME_TEXT = `يا صباح الفل يا فنان! 🦅
جاهز ومستعد لمراجعة حساباتك وتكاليف شغلك.. قولي حابب نبدأ بإيه؟`;

export const createInitialFalconMessage = (userName?: string, isSupplier = false): ChatMessage => {
  const cleanName = String(userName || '').trim();
  const greeting = cleanName ? `يا صباح الفل يا ${cleanName}! 🦅` : 'يا صباح الفل يا فنان! 🦅';
  const body = isSupplier
    ? 'منور بوابة الموردين.. جاهز أساعدك في مواصفات الخامات، تسعير الشرائح، ومقارنة السوق.. قولي تحب نبدأ بإيه؟'
    : 'جاهز ومستعد لمراجعة حساباتك وتكاليف شغلك.. قولي حابب نبدأ بإيه؟';
  return {
    id: 'msg_welcome',
    sender: 'falcon',
    text: `${greeting}\n${body}`,
    timestamp: Date.now(),
  };
};

function getArabicAiError(status: number, serverMessage?: string): string {
  if (serverMessage && /[\u0600-\u06FF]/.test(serverMessage)) return serverMessage;
  if (status === 401) return 'معلش الجلسة انتهت، سجّل دخولك تاني وهنكمل معاك فوراً.';
  if (status === 403) return 'الحساب غير مصرح له باستخدام هذه الميزة حالياً.';
  if (status === 429) return 'وصلنا للحد اليومي للاستشارات، وهيتجدد تلقائياً بكرة بإذن الله.';
  if (status === 504 || status === 408) return 'صقر مشغول شوية في مراجعة الحسابات.. جرّب تبعت سؤالك تاني بعد لحظة.';
  if (status >= 500) return 'في ضغط مؤقت على الخط دلوقتي من كتر الشغل.. جرّب تاني بعد ثواني وهنرد عليك فوراً 🦅';
  return 'معلش في حاجة ما مشتش صح المرة دي، جرّب تاني بعد لحظة.';
}

async function falconFetch(url: string, init: RequestInit, timeoutMs = 35000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await authedFetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('صقر مشغول شوية دلوقتي.. جرّب تبعت سؤالك تاني بعد لحظة.');
    }
    throw new Error('في زحمة بسيطة على الاتصال دلوقتي، جرّب تاني بعد ثواني 🦅');
  } finally {
    clearTimeout(timer);
  }
}

export const FalconAIAgent: React.FC<FalconAIAgentProps> = ({
  profile,
  currentCategory,
  onApplyCategoryFromAI,
  onApplyEstimatedLaborWage,
  onTransferNotesToCalculator,
  onExportStructuredToCalculator,
}) => {
  const workshopId = profile.tenantId || profile.workshopId || profile.id || 'default_workshop';
  const isSupplierAccount = profile?.accountRole === 'supplier';
  const isSuperAdminAccount = /hmb\.top\.tu[bp]e/i.test(String(profile.email || '').trim());
  const initialFirstName =
    ((profile as any).fullName || (profile as any).name || profile.artistName || '')
      .trim()
      .replace(/^(المهندس|المهندسة|الفنان|الفنانة|الأستاذ|الأستاذة|المعلم|المدير|كابتن|دكتور|دكتورة|أ|م)\s+/gi, '')
      .split(/\s+/)[0] || '';
  const sessionKey = `alshams_falcon_chat_${workshopId}`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    createInitialFalconMessage(initialFirstName, isSupplierAccount),
  ]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [newChatFeedback, setNewChatFeedback] = useState(false);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [transferredNotice, setTransferredNotice] = useState(false);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const falconConn = useLiveConnectionStatus(useGoogleSearch, true);
  const userSub = useUserSubscription(profile);
  const isAdminAccount = isUserAdmin(profile);

  // Modern Chat UX additions: Auto-expanding, Instant Voice, Free TTS, Attachments, Saved sessions & Menu
  const [pendingAttachment, setPendingAttachment] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<Array<{ id: string; title: string; timestamp: number; messages: ChatMessage[] }>>([]);

  // Saqr Photo Studio popover & state
  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState(false);
  const [pendingStudioMode, setPendingStudioMode] = useState<'store' | 'workshop' | 'home' | null>(null);
  const [isGeneratingStudio, setIsGeneratingStudio] = useState(false);
  const [studioLoadingLabel, setStudioLoadingLabel] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const studioMenuRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputPromptLatestRef = useRef(inputPrompt);
  inputPromptLatestRef.current = inputPrompt;

  const savedSessionsKey = `alshams_falcon_saved_sessions_${workshopId}`;

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 52), 132) + 'px';
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(savedSessionsKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setSavedSessions(parsed);
      }
    } catch {}
  }, [savedSessionsKey]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom(true);
  }, [messages, isSending, isAnalyzingImage, isGeneratingStudio, scrollToBottom]);

  useEffect(() => {
    if (!isStudioMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (studioMenuRef.current && !studioMenuRef.current.contains(e.target as Node)) {
        setIsStudioMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsStudioMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isStudioMenuOpen]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(sessionKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not read cached session:', e);
    } finally {
      setIsHydrated(true);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      const sanitized = messages.slice(-25).map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
        sources: m.sources,
        searchUsed: m.searchUsed,
        searchEntryPoint: m.searchEntryPoint,
      }));
      localStorage.setItem(sessionKey, JSON.stringify(sanitized));
    } catch (err) {
      console.warn('Could not save session:', err);
    }
  }, [messages, isHydrated, sessionKey]);

  const loadDailyUsage = useCallback(async () => {
    try {
      const res = await authedFetch('/api/ai/usage');
      if (res.ok) {
        const data = await res.json();
        const rem = typeof data.falconRemaining === 'number' ? data.falconRemaining : data.remaining;
        if (typeof rem === 'number') {
          setDailyRemaining(rem);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadDailyUsage();
  }, [loadDailyUsage]);

  const firstName = initialFirstName;

  const handleNewChat = () => {
    const welcome = createInitialFalconMessage(firstName, isSupplierAccount);
    setMessages([welcome]);
    setInputPrompt('');
    setPendingAttachment(null);
    setImagePreview(null);
    setIsAnalyzingImage(false);
    setExpandedSources({});
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      localStorage.removeItem(sessionKey);
    } catch {}
    showFeedback('✓ تم بدء جلسة استشارة جديدة');
  };

  const handleSaveChat = () => {
    if (messages.length <= 1) {
      showFeedback('المحادثة لا تحتوي على رسائل كافية لحفظها.');
      return;
    }
    const firstUserMsg = messages.find((m) => m.sender === 'user');
    const title = firstUserMsg
      ? firstUserMsg.text.slice(0, 36) + (firstUserMsg.text.length > 36 ? '...' : '')
      : 'استشارة هندسية ' + new Date().toLocaleDateString('ar-EG');

    const newSession = {
      id: 'session_' + Date.now(),
      title,
      timestamp: Date.now(),
      messages: [...messages],
    };

    const updated = [newSession, ...savedSessions.filter((s) => s.id !== newSession.id)].slice(0, 20);
    setSavedSessions(updated);
    try {
      localStorage.setItem(savedSessionsKey, JSON.stringify(updated));
    } catch {}
    showFeedback('✓ تم حفظ المحادثة بنجاح في الأرشيف');
  };

  const handleClearChat = () => {
    const welcome = createInitialFalconMessage(firstName, isSupplierAccount);
    setMessages([welcome]);
    setInputPrompt('');
    setPendingAttachment(null);
    setImagePreview(null);
    setIsAnalyzingImage(false);
    setExpandedSources({});
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      localStorage.removeItem(sessionKey);
    } catch {}
    showFeedback('✓ تم تفريغ وحذف سجل المحادثة');
  };

  const handleLoadSession = (session: { id: string; title: string; timestamp: number; messages: ChatMessage[] }) => {
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      setMessages(session.messages);
      setIsMenuOpen(false);
      showFeedback(`✓ تم استرجاع: ${session.title}`);
    }
  };

  const handleDeleteSavedSession = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = savedSessions.filter((s) => s.id !== sessionId);
    setSavedSessions(updated);
    try {
      localStorage.setItem(savedSessionsKey, JSON.stringify(updated));
    } catch {}
    showFeedback('تم حذف الجلسة من الأرشيف.');
  };

  const handleExportLatestToCalculator = () => {
    const payload = buildSmartCalculatorExport({
      messages,
      imagePreview,
      currentCategory,
      profile,
    });

    if (!payload) {
      showFeedback('ابدأ المحادثة مع صقر أو ارفع صورة قطعة أولاً لتصديرها للحاسبة.');
      return;
    }

    if (onExportStructuredToCalculator) {
      onExportStructuredToCalculator(payload);
    } else {
      if (payload.category) onApplyCategoryFromAI(payload.category as CraftCategory);
      if (payload.laborWage && payload.hours) onApplyEstimatedLaborWage(payload.laborWage, payload.hours);
      if (payload.notes) onTransferNotesToCalculator(payload.notes);
    }

    setTransferredNotice(true);
    setTimeout(() => setTransferredNotice(false), 2600);
    showFeedback('✓ تم تصدير كافة بيانات القطعة والصورة والمقاسات وأهم النقاط للحاسبة');
  };

  // Instant zero-cost keyboard-speed voice dictation (streams live directly into textarea)
  const {
    isListening: isRecordingVoice,
    isFallbackProcessing: isTranscribingVoice,
    toggleListening: toggleVoiceRecording,
    stopListening: stopVoiceRecording,
  } = useInstantVoiceDictation({
    getCurrentValue: () => inputPromptLatestRef.current,
    onTextChange: (nextValue) => {
      setInputPrompt(nextValue);
      setTimeout(() => adjustTextareaHeight(textareaRef.current), 15);
    },
    lang: 'ar-EG',
  });

  // Free built-in Egyptian/Arabic masculine voice speaker (ON by default, toggleable from header)
  const falconSpeech = usePersonaSpeech('falcon');
  const lastSpokenFalconIdRef = useRef<string | null>('msg_welcome');

  // Auto-read every new Falcon reply when speaker is ON
  useEffect(() => {
    if (!isHydrated) {
      const latest = messages[messages.length - 1];
      if (latest) lastSpokenFalconIdRef.current = latest.id;
      return;
    }
    const last = messages[messages.length - 1];
    if (!last || last.sender !== 'ai' || last.id === 'msg_welcome') return;
    if (lastSpokenFalconIdRef.current === last.id) return;
    lastSpokenFalconIdRef.current = last.id;
    if (falconSpeech.isEnabled) {
      falconSpeech.speak(last.text);
    }
  }, [messages, isHydrated, falconSpeech.isEnabled]);

  const actionChips = [
    'التسعير العادل جملة وقطاعي',
    'مقارنة المنتج بالأسواق',
    'توليد باترون وطريقة العمل',
    'توقع الأبعاد والتكلفة والمصنعية',
  ];

  const compressImageForAI = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawResult = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1024;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ base64: rawResult, mimeType: 'image/jpeg' });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve({ base64: canvas.toDataURL('image/jpeg', 0.75), mimeType: 'image/jpeg' });
        };
        img.onerror = () => resolve({ base64: rawResult, mimeType: 'image/jpeg' });
        img.src = rawResult;
      };
      reader.onerror = () => resolve({ base64: '', mimeType: 'image/jpeg' });
      reader.readAsDataURL(file);
    });
  };

  const STUDIO_MODE_LABELS: Record<'store' | 'workshop' | 'home', string> = {
    store: 'للمتجر',
    workshop: 'في ورشتي',
    home: 'في منزل',
  };

  const getWorkshopBranding = () => {
    const workshopName = String(
      (profile as any).workshopName || profile.brandName || (isSupplierAccount ? 'متجر المورد' : 'ورشتي')
    ).trim();
    const artistFullName = String(
      (profile as any).fullName || (profile as any).name || profile.artistName || ''
    ).trim();
    const logoUrl = String(
      (profile as any).brandLogo || (profile as any).logoUrl || (profile as any).avatarUrl || ''
    ).trim();
    return { workshopName, artistName: artistFullName, logoUrl, isSupplier: isSupplierAccount };
  };

  const runFalconStudioGeneration = async (
    mode: 'store' | 'workshop' | 'home',
    _overrideAttachment?: { base64: string; mimeType: string; name: string } | null,
    _overrideText?: string
  ) => {
    setIsStudioMenuOpen(false);
    setPendingStudioMode(null);
    const modeTitle = STUDIO_MODE_LABELS[mode];
    showFeedback(`🚧 استوديو صقر (${modeTitle}) — تحت الإنشاء حالياً`);

    setMessages((prev) => [
      ...prev,
      {
        id: 'falcon_studio_wip_' + Date.now(),
        sender: 'falcon',
        text:
          `🚧 **استوديو صقر لتجهيز الصور (${modeTitle}) — تحت الإنشاء حالياً**\n\n` +
          `بنجهّزلك الاستوديو بأعلى جودة عشان تطلع صور منتجاتك جاهزة للعرض بأفضل شكل.\n` +
          `حالياً تقدر تكلم صقر بالكتابة أو بالصوت في التسعير، حساب الخامات والهالك، ودراسة السوق وهيساعدك فوراً 🦅`,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleToggleStudioFooter = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.metadata?.studioRawImage || !m.metadata?.studioBrandedImage) return m;
        const nextEnabled = !m.metadata.studioFooterEnabled;
        return {
          ...m,
          metadata: {
            ...m.metadata,
            studioFooterEnabled: nextEnabled,
            studioImage: nextEnabled ? m.metadata.studioBrandedImage : m.metadata.studioRawImage,
          },
        };
      })
    );
  };

  const handleDownloadStudioImage = (dataUrl: string, mode?: string) => {
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `alshams-studio-${mode || 'product'}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showFeedback('✓ تم تحميل صورة الاستوديو بأعلى دقة');
    } catch {
      showFeedback('تعذر تنزيل الصورة، يمكنك حفظها بالضغط المطول عليها.');
    }
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { base64, mimeType } = await compressImageForAI(file);
      if (!base64) throw new Error('فشل معالجة الصورة المرفوعة.');

      const newAtt = { base64, mimeType, name: file.name };
      if (pendingStudioMode) {
        const queuedMode = pendingStudioMode;
        setPendingStudioMode(null);
        await runFalconStudioGeneration(queuedMode, newAtt);
      } else {
        setPendingAttachment(newAtt);
        showFeedback('📸 تم إرفاق الصورة. يمكنك إرسالها للتحليل أو اختيار الاستوديو لتجهيزها.');
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    } catch (err: any) {
      showFeedback('تعذر قراءة الصورة: ' + (err.message || ''));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleSendMessage = async (customText?: string, chip?: string) => {
    if (isRecordingVoice) {
      stopVoiceRecording();
    }
    const textToSend = (customText || inputPrompt).trim();
    const att = pendingAttachment;

    if (!chip && pendingStudioMode && (textToSend || att)) {
      const queuedMode = pendingStudioMode;
      await runFalconStudioGeneration(queuedMode, att, textToSend);
      return;
    }

    if (!textToSend && !chip && !att) return;

    stopVoiceRecording();
    falconSpeech.unlock();

    // تفريغ الحقول فورا
    setInputPrompt('');
    setPendingAttachment(null);
    setImagePreview(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: textToSend || (att ? '📸 قمت برفع صورة مشغولة يدوية لفحصها هندسياً واستخراج المقاسات والخامات والتكلفة وسعر البيع.' : `استفسار حول: ${chip}`),
      actionChip: chip,
      timestamp: Date.now(),
      metadata: att ? { previewImage: att.base64 } : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);

    // فحص فوري لحدود باقات المشترك قبل الإرسال لصقر (أوفلاين وأونلاين)
    const subRole: 'artisan' | 'supplier' = isSupplierAccount ? 'supplier' : 'artisan';
    if (textToSend && !att) {
      const lockedHit = detectLockedSubscriptionQuery(
        textToSend,
        userSub,
        subRole,
        isAdminAccount,
        firstName
      );
      if (lockedHit) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'falcon_locked_' + Date.now(),
            sender: 'falcon',
            text: lockedHit.reply,
            timestamp: Date.now(),
          },
        ]);
        return;
      }
    }

    setIsSending(true);
    if (att) {
      setIsAnalyzingImage(true);
    }

    try {
      const formattedHistory = messages
        .filter((m) => m.id !== 'msg_welcome')
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          content: m.text,
        }));

      const subPromptInfo = buildAiSubscriptionPromptContext(userSub, subRole, isAdminAccount);

      const payload: any = {
        message: textToSend || (att ? 'يرجى فحص وتحليل صورة المشغولة هندسياً بدقة، وتحديد أبعادها ومستلزمات إنتاجها والتكلفة وسعر البيع العادل جملة وقطاعي في السوق المصري.' : `استفسار حول: ${chip}`),
        actionChip: chip || null,
        useSearch: useGoogleSearch,
        chatHistory: formattedHistory,
        workshopContext: {
          selectedCrafts: profile.selectedCrafts || ['macrame'],
          country: profile.country || 'جمهورية مصر العربية',
          currency: profile.currencySymbol || 'ج.م',
          category: currentCategory,
          artistName: firstName,
          brandName: (profile as any).workshopName || profile.brandName || '',
          accountRole: isSupplierAccount ? 'supplier' : 'artisan',
          hourlyRate: (profile as any).hourlyRate || 35,
          liveLiquidity: 0,
          lowMaterialsCount: 0,
          openWorkOrdersCount: 0,
          pendingOrdersCount: 0,
          subscriptionPromptContext: subPromptInfo.promptText,
          subscriptionScope: subPromptInfo.scopeFlags,
        },
        userEmail: profile.email || '',
      };

      if (att) {
        payload.images = [
          {
            base64: att.base64,
            mimeType: att.mimeType || 'image/jpeg',
            name: att.name || 'craft.jpg',
          },
        ];
      }

      const res = await falconFetch(
        '/api/chat-agent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        35000
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(getArabicAiError(res.status, errData.error));
      }

      const data = await res.json();
      const chatRem = typeof data.remaining === 'number' ? data.remaining : data.dailyAiRemaining;
      if (typeof chatRem === 'number') {
        setDailyRemaining(chatRem);
      }
      if (useGoogleSearch) {
        falconConn.reportSearchOutcome(Boolean(data.searchUsed));
      }

      // إضافة الرد داخل المحادثة مباشرة دون أي تحويل تلقائي للحاسبة
      setMessages((prev) => [
        ...prev,
        {
          id: 'falcon_' + Date.now(),
          sender: 'falcon',
          text: data.reply || 'تمت دراسة طلبك، هل تود معرفة أي تفاصيل إضافية؟',
          timestamp: Date.now(),
          metadata: data.visionAnalysis ? { visionAnalysis: data.visionAnalysis } : undefined,
          sources: data.sources || [],
          searchEntryPoint: data.searchEntryPoint,
          searchUsed: data.searchUsed,
        },
      ]);
    } catch (err: any) {
      if (useGoogleSearch) {
        falconConn.reportSearchOutcome(false, typeof navigator !== 'undefined' && navigator.onLine === false);
        void falconConn.refreshSearchHealth();
      }
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'falcon',
          text: `⚠️ ${err.message || 'تعذر الرد، أعد إرسال استفسارك.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
      setIsAnalyzingImage(false);
    }
  };

  const handleExportStructuredToCalculator = (vData: AIVisionAnalysis, associatedImage?: string) => {
    const payload = buildSmartCalculatorExport({
      messages,
      visionAnalysis: vData,
      associatedImage,
      imagePreview,
      currentCategory,
      profile,
    });
    if (!payload) return;

    if (onExportStructuredToCalculator) {
      onExportStructuredToCalculator(payload);
    } else {
      if (payload.category) onApplyCategoryFromAI(payload.category as CraftCategory);
      if (payload.laborWage && payload.hours) onApplyEstimatedLaborWage(payload.laborWage, payload.hours);
      if (payload.notes) onTransferNotesToCalculator(payload.notes);
    }

    setTransferredNotice(true);
    setTimeout(() => setTransferredNotice(false), 2500);
  };

  const toggleSourceExpansion = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const uiLayout = useUiLayoutConfig();
  const aiCfg = uiLayout.aiAssistantsConfig || DEFAULT_AI_ASSISTANTS_UI_CONFIG;
  const vp = useVisualViewportHeight(true);
  const isMobileKeyboardLocked = vp.isKeyboardOpen && vp.height > 200;

  return (
    <div
      style={
        isMobileKeyboardLocked
          ? {
              position: 'fixed',
              top: `${vp.offsetTop}px`,
              left: 0,
              right: 0,
              height: `${vp.height}px`,
              zIndex: 68,
            }
          : undefined
      }
      className={`bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xl overflow-hidden flex flex-col transition-colors duration-200 ${
        isMobileKeyboardLocked
          ? 'rounded-none'
          : 'rounded-2xl sm:rounded-3xl h-[calc(100dvh-5.5rem)] sm:h-[750px] max-h-[100dvh] relative'
      }`}
    >
      {/* Compact Slim Header for Mobile & Desktop — Always pinned at top */}
      <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-stone-950 via-amber-950 to-stone-900 text-white flex items-center justify-between border-b border-amber-500/30 shadow-md flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <FalconMascotAvatar size="sm" fit="top" statusDot={false} />
            <span
              title={falconConn.isInternetOnline ? 'متصل بالإنترنت' : 'لا يوجد اتصال بالإنترنت'}
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#060B18] shadow-xs transition-colors ${
                falconConn.isInternetOnline ? 'bg-emerald-400' : 'bg-slate-400'
              }`}
            />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-black text-sm sm:text-base text-amber-300 truncate">
              {aiCfg.falconTitle}
            </h3>
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                falconConn.isInternetOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
              }`}
              title={falconConn.isInternetOnline ? 'متصل بالإنترنت' : 'لا يوجد اتصال بالإنترنت'}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* دردشة جديدة ➕ */}
          <button
            type="button"
            onClick={handleNewChat}
            title="دردشة جديدة (➕)"
            className="w-8 h-8 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
          </button>

          {/* تصدير للحاسبة 🧮 */}
          <button
            type="button"
            onClick={handleExportLatestToCalculator}
            title="تصدير للحاسبة (🧮)"
            className="w-8 h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
          </button>

          {/* حفظ المحادثة 💾 */}
          <button
            type="button"
            onClick={handleSaveChat}
            title="حفظ المحادثة (💾)"
            className="w-8 h-8 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4 text-amber-400" />
          </button>

          {/* زر السماعة المجانية (قراءة ردود صقر بصوت رجولي — ظاهرة دائماً ومفعّلة افتراضياً) */}
          <button
            type="button"
            onClick={falconSpeech.toggleEnabled}
            aria-pressed={falconSpeech.isEnabled}
            title={falconSpeech.isEnabled ? 'صوت صقر شغّال — اضغط لكتمه' : 'صوت صقر مكتوم — اضغط لتشغيله'}
            className={`relative w-8 h-8 rounded-full border flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer ${
              falconSpeech.isEnabled
                ? falconSpeech.isSpeaking
                  ? 'bg-amber-500 border-amber-300 text-stone-950 shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-pulse'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/70 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'bg-stone-800/70 hover:bg-stone-700 border-stone-700 text-stone-500'
            }`}
          >
            {falconSpeech.isEnabled ? (
              <>
                <Volume2 className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-stone-900" />
              </>
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* حذف الشات 🗑️ */}
          <button
            type="button"
            onClick={() => {
              falconSpeech.stop();
              handleClearChat();
            }}
            title="مسح المحادثة (🗑️)"
            className="w-8 h-8 rounded-xl bg-stone-800/90 hover:bg-red-950/80 border border-stone-700 hover:border-red-500/60 text-stone-300 hover:text-red-300 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* قائمة ثلاث نقاط ⋮ */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="المحادثات السابقة والأرشيف"
              className="w-8 h-8 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-stone-700 text-amber-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-stone-900 border border-amber-500/40 shadow-2xl p-2.5 z-50 text-right space-y-2 backdrop-blur-md">
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-800 px-1">
                  <span className="text-xs font-black text-amber-300">خيارات مستشار صقر 🦅</span>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 rounded-lg text-stone-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleNewChat();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-stone-800 text-stone-200 text-xs font-bold transition text-right cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="block text-white">بدء دردشة جديدة</span>
                      <span className="text-[10px] text-stone-400 font-normal">تصفير الحوار وبدء استشارة فريش</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSaveChat();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-stone-800 text-stone-200 text-xs font-bold transition text-right cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="block text-white">حفظ المحادثة الحالية</span>
                      <span className="text-[10px] text-stone-400 font-normal">أرشفة الجلسة للرجوع لها في أي وقت</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleExportLatestToCalculator();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-stone-800 text-stone-200 text-xs font-bold transition text-right cursor-pointer"
                  >
                    <Calculator className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="block text-white">تصدير الأرقام للحاسبة</span>
                      <span className="text-[10px] text-stone-400 font-normal">نقل المصنعية وساعات العمل لحاسبة التكاليف</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleClearChat();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-red-950/60 text-red-300 text-xs font-bold transition text-right cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                    <div>
                      <span className="block">حذف وتفريغ الشات</span>
                      <span className="text-[10px] text-stone-400 font-normal">مسح رسائل الحوار الحالية بالكامل</span>
                    </div>
                  </button>
                </div>

                {/* المحادثات المحفوظة */}
                <div className="pt-2 border-t border-stone-800 space-y-1.5">
                  <span className="text-[11px] font-black text-amber-400 block px-1">
                    المحادثات المحفوظة ({savedSessions.length})
                  </span>
                  {savedSessions.length === 0 ? (
                    <p className="text-[10px] text-stone-500 px-1 py-1">لا توجد محادثات مؤرشفة بعد. اضغط (حفظ) لحفظ أي جلسة.</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {savedSessions.map((sess) => (
                        <div
                          key={sess.id}
                          onClick={() => handleLoadSession(sess)}
                          className="p-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 border border-stone-800 flex items-center justify-between text-right cursor-pointer group transition"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-stone-200 block truncate group-hover:text-amber-300">
                              {sess.title}
                            </span>
                            <span className="text-[9px] text-stone-500 block">
                              {new Date(sess.timestamp).toLocaleDateString('ar-EG')} • {sess.messages.length} رسالة
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedSession(sess.id, e)}
                            className="p-1 text-stone-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                            title="حذف هذه الجلسة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageSelected}
          className="hidden"
        />
      </div>

      {/* شريط الإشعارات والإجراءات اللحظية */}
      {actionFeedback && (
        <div className="px-4 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse flex-shrink-0">
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* شريط الرصيد اليومي */}
      <div className="px-4 py-2 bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 flex-shrink-0 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-bold text-stone-800 dark:text-stone-200">الرصيد المتبقي اليوم:</span>
          <span className="font-mono font-black text-amber-800 dark:text-amber-300">
            {dailyRemaining ?? 20} من 20 استشارة
          </span>
        </div>
      </div>

      {/* منطقة الرسائل */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-[#efeae2]/80 dark:bg-[#0b141a] scroll-smooth"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const vData: AIVisionAnalysis | undefined = msg.metadata?.visionAnalysis;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse text-right' : 'text-right'}`}
            >
              {isUser ? (
                <ArtisanAvatar
                  logoUrl={(profile as any).brandLogo || (profile as any).avatarUrl}
                  artistName={profile.brandName || profile.artistName || 'فنان'}
                  size="sm"
                  className="mt-1 flex-shrink-0"
                />
              ) : (
                <FalconMascotAvatar size="sm" fit="top" statusDot={false} className="mt-1 flex-shrink-0" />
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                  isUser
                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-stone-900 dark:text-stone-100 rounded-tr-none'
                    : 'bg-white dark:bg-[#202c33] text-stone-900 dark:text-stone-100 border border-stone-200/90 dark:border-stone-700/80 rounded-tl-none'
                }`}
              >
                {msg.metadata?.previewImage && (
                  <div className="mb-2 max-w-[200px] rounded-xl overflow-hidden border border-white/20">
                    <img src={msg.metadata.previewImage} alt="صورة الموديل" referrerPolicy="no-referrer" className="w-full h-auto object-cover" />
                  </div>
                )}

                {msg.metadata?.studioImage && (
                  <div className="mb-2.5 space-y-2">
                    <div className="rounded-xl overflow-hidden border border-amber-400/40 bg-white shadow-sm max-w-[340px]">
                      <img
                        src={msg.metadata.studioImage}
                        alt="صورة استوديو صقر"
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadStudioImage(msg.metadata.studioImage, msg.metadata.studioMode)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل الصورة</span>
                      </button>
                      {msg.metadata.studioRawImage && msg.metadata.studioBrandedImage && (
                        <button
                          type="button"
                          onClick={() => handleToggleStudioFooter(msg.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-300/80 dark:border-stone-600 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Tag className="w-3 h-3" />
                          <span>{msg.metadata.studioFooterEnabled ? 'إخفاء التذييل' : 'إضافة تذييل الورشة'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                {/* كارت نتائج الرؤية والتسعير */}
                {vData && (
                  <div className="space-y-2.5 mt-3 pt-3 border-t border-amber-500/20">
                    <div className="flex items-center justify-between gap-2 bg-amber-500/10 p-2 rounded-xl">
                      <span className="font-bold text-xs text-amber-900 dark:text-amber-200">
                        مواصفات القطعة والأسعار ({vData.detectedCategory})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExportStructuredToCalculator(vData, msg.metadata?.previewImage || imagePreview || undefined)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition"
                        title="تصدير الأرقام والتفاصيل لحاسبة التكاليف"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>تصدير للحاسبة 🧮</span>
                      </button>
                    </div>

                    {transferredNotice && (
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ تم نقل البيانات لحاسبة التكاليف بنجاح
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1.5 rounded bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                        <span className="text-[9px] text-stone-500 dark:text-stone-400 block font-medium">سعر الجملة</span>
                        <span className="font-bold text-xs text-stone-900 dark:text-stone-100">{vData.competitionPricing?.minMarketPrice || 0} {profile.currencySymbol || 'ج.م'}</span>
                      </div>
                      <div className="p-1.5 rounded bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700">
                        <span className="text-[9px] text-amber-800 dark:text-amber-300 block font-bold">سعر القطاعي</span>
                        <span className="font-bold text-xs text-amber-900 dark:text-amber-200">{vData.competitionPricing?.avgMarketPrice || 0} {profile.currencySymbol || 'ج.م'}</span>
                      </div>
                      <div className="p-1.5 rounded bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                        <span className="text-[9px] text-stone-500 dark:text-stone-400 block font-medium">أعلى سعر سوقي</span>
                        <span className="font-bold text-xs text-stone-900 dark:text-stone-100">{vData.competitionPricing?.maxMarketPrice || 0} {profile.currencySymbol || 'ج.م'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* شارة البحث والمصادر — للسوبر أدمن فقط لا غير */}
                {isSuperAdminAccount && (msg.searchUsed || (msg.sources && msg.sources.length > 0)) && (
                  <div className="mt-2 pt-2 border-t border-stone-200 dark:border-stone-700 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        <Globe className="w-3 h-3" />
                        <span>بحث حي مباشر (عرض السوبر أدمن فقط)</span>
                      </span>
                      {msg.sources && msg.sources.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleSourceExpansion(msg.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 cursor-pointer"
                        >
                          <span>المصادر ({msg.sources.length})</span>
                          {expandedSources[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    {msg.sources && msg.sources.length > 0 && expandedSources[msg.id] !== false && (
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 flex items-center gap-1"
                          >
                            <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                            <span className="truncate max-w-[160px]">{src.title || src.url}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-[9px] mt-1.5 font-mono text-stone-400">
                  {!isUser && falconSpeech.isSupported ? (
                    <button
                      type="button"
                      onClick={() => {
                        falconSpeech.unlock();
                        if (falconSpeech.isSpeaking) {
                          falconSpeech.stop();
                        } else {
                          if (!falconSpeech.isEnabled) falconSpeech.toggleEnabled();
                          falconSpeech.speak(msg.text);
                        }
                      }}
                      title={falconSpeech.isSpeaking ? 'إيقاف القراءة' : 'اسمع الرد بصوت صقر'}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                    >
                      {falconSpeech.isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isUser && <CheckCheck className="w-3 h-3 text-emerald-600 inline" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 bg-white dark:bg-stone-800 p-2.5 rounded-xl border border-amber-400/40 w-fit">
            <span className="font-bold">صقر بيكتب...</span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}

        {isAnalyzingImage && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs animate-pulse">
            صقر يحلل كثافة الخامات والأبعاد والأسعار...
          </div>
        )}

        {isGeneratingStudio && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-bold w-fit">
            <Aperture className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
            <span>{studioLoadingLabel || 'استوديو صقر يجهز صورتك الآن...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* شرائح الأوامر السريعة */}
      <div className="px-3 py-1.5 bg-stone-100 dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto text-xs flex-shrink-0">
        <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap ml-1 flex items-center gap-1">
          <Compass className="w-3 h-3 text-amber-600" />
          <span>أوامر سريعة:</span>
        </span>
        {actionChips.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage('', chip)}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-[11px] font-bold whitespace-nowrap transition cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* معاينة الصورة المرفقة قبل الإرسال */}
      {pendingAttachment && (
        <div className="px-3 py-2 bg-amber-500/10 dark:bg-amber-950/40 border-t border-amber-300/60 dark:border-amber-700/40 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={pendingAttachment.base64}
              alt="معاينة المرفق"
              className="w-10 h-10 rounded-xl object-cover border border-amber-400 shadow-2xs shrink-0"
            />
            <div className="min-w-0 text-right">
              <span className="text-xs font-black text-stone-900 dark:text-stone-100 block truncate max-w-[200px]">
                {pendingAttachment.name || 'صورة المشغولة'}
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">
                جاهزة للفحص الهندسي واستخراج الخامات ونسب الهالك
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingAttachment(null)}
            className="p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-red-500 transition cursor-pointer"
            title="حذف المرفق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* شريط وضع الاستوديو المختار (عند اختيار النمط قبل إرفاق صورة) */}
      {pendingStudioMode && (
        <div className="px-3 py-1.5 bg-amber-500/15 dark:bg-amber-950/50 border-t border-amber-400/50 flex items-center justify-between gap-2 text-xs flex-shrink-0">
          <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
            <Aperture className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>
              وضع الاستوديو: <strong>{STUDIO_MODE_LABELS[pendingStudioMode]}</strong> — أرفق صورة المنتج أو اكتب وصفه واضغط إرسال
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPendingStudioMode(null)}
            className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 cursor-pointer"
            title="إلغاء وضع الاستوديو"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* شريط الإدخال العصري المزدوج — مساحة كتابة واضحة من سطرين فوق شريط الأدوات */}
      <div className="px-2.5 sm:px-3 py-2 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex-shrink-0">
        <div className="rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/90 focus-within:ring-2 focus-within:ring-amber-500 transition shadow-xs">
          {/* الصف العلوي: خانة كتابة واسعة بكامل العرض وواضحة جداً */}
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => {
              setInputPrompt(e.target.value);
              adjustTextareaHeight(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={2}
            placeholder={
              pendingStudioMode
                ? `صف المنتج أو أرفق صورته (${STUDIO_MODE_LABELS[pendingStudioMode]})...`
                : useGoogleSearch
                ? 'اسأل صقر عن أحدث أسعار السوق والموردين...'
                : aiCfg.falconPlaceholder
            }
            className="w-full min-h-[52px] max-h-32 resize-none overflow-y-auto px-3.5 pt-2.5 pb-1 bg-transparent text-stone-900 dark:text-stone-100 text-[13px] sm:text-sm outline-none leading-relaxed placeholder:text-stone-400 block"
          />

          {/* الصف السفلي: أزرار المرفقات + الاستوديو + الميكروفون الفوري + البحث + الإرسال */}
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <div className="flex items-center gap-1">
              {/* زر إرفاق الصور والملفات 📎 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="إرفاق صورة مشغولة لفحصها أو تجهيزها في الاستوديو"
                className="w-8 h-8 rounded-xl text-stone-500 hover:text-amber-600 hover:bg-stone-200/70 dark:hover:bg-stone-700/70 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* أيقونة الاستوديو المدمجة (إنشاء صورة: للمتجر / في ورشتي / في منزل) */}
              <div ref={studioMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  disabled={isGeneratingStudio}
                  onClick={() => setIsStudioMenuOpen((v) => !v)}
                  title="استوديو صقر لإنشاء وتجهيز صور المنتجات"
                  aria-expanded={isStudioMenuOpen}
                  className={`w-8 h-8 rounded-xl transition cursor-pointer flex items-center justify-center ${
                    isStudioMenuOpen || pendingStudioMode
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-400/70'
                      : 'text-stone-500 hover:text-amber-600 hover:bg-stone-200/70 dark:hover:bg-stone-700/70'
                  } disabled:opacity-40`}
                >
                  <Aperture className={`w-4 h-4 ${isGeneratingStudio ? 'animate-spin text-amber-500' : ''}`} />
                </button>

                {isStudioMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-40 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-2xl overflow-hidden z-50 text-right">
                    <div className="px-3 py-2 text-[11px] font-black text-stone-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-950/70 border-b border-stone-200/80 dark:border-stone-800 cursor-default select-none">
                      إنشاء صورة
                    </div>
                    <div className="p-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => runFalconStudioGeneration('store')}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-100 text-xs font-bold transition cursor-pointer"
                      >
                        <Store className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>للمتجر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => runFalconStudioGeneration('workshop')}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-100 text-xs font-bold transition cursor-pointer"
                      >
                        <Hammer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>في ورشتي</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => runFalconStudioGeneration('home')}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-100 text-xs font-bold transition cursor-pointer"
                      >
                        <Home className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>في منزل</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* زر التسجيل الصوتي الفوري — ينوّر أحمر بهدوء أثناء الكلام ويكتب فوراً بدون أي يافطة */}
              <button
                type="button"
                onClick={toggleVoiceRecording}
                aria-pressed={isRecordingVoice}
                title={isRecordingVoice ? 'إيقاف الميكروفون' : 'تحدث بصوتك ليتحول لكتابة فوراً'}
                className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isRecordingVoice
                    ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.55)] ring-2 ring-rose-400/40'
                    : isTranscribingVoice
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'text-stone-500 hover:text-amber-600 hover:bg-stone-200/70 dark:hover:bg-stone-700/70'
                }`}
              >
                {isRecordingVoice && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-300 animate-ping pointer-events-none" />
                )}
                {isRecordingVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* زر البحث الذكي المباشر بأيقونة صقر — 3 حالات حقيقية (مغلق / متصل أخضر / منقطع رصاصي) */}
              <button
                type="button"
                onClick={() => {
                  setUseGoogleSearch((prev) => {
                    const next = !prev;
                    if (next) {
                      void falconConn.refreshSearchHealth();
                      showFeedback(
                        falconConn.isInternetOnline && falconConn.isSearchApiLive
                          ? '🟢 تم تفعيل البحث الذكي المباشر لصقر'
                          : '⚪ البحث المباشر مُفعّل لكن الخدمة غير متصلة حالياً'
                      );
                    } else {
                      showFeedback('تم إيقاف البحث الذكي المباشر');
                    }
                    return next;
                  });
                }}
                title={
                  falconConn.searchButtonState === 'live'
                    ? 'البحث الذكي المباشر مُفعّل ومتصل الآن — اضغط للإيقاف'
                    : falconConn.searchButtonState === 'disconnected'
                    ? 'البحث المباشر مُفعّل لكن الخدمة غير متصلة حالياً — اضغط للإيقاف'
                    : 'تفعيل البحث الذكي المباشر للأسعار والسوق'
                }
                aria-pressed={useGoogleSearch}
                className={`relative w-8 h-8 rounded-xl transition-all duration-200 cursor-pointer shrink-0 flex items-center justify-center ${
                  falconConn.searchButtonState === 'live'
                    ? 'bg-emerald-500/95 ring-2 ring-emerald-300 shadow-[0_0_14px_2px_rgba(16,185,129,0.75)]'
                    : falconConn.searchButtonState === 'disconnected'
                    ? 'bg-slate-500/85 ring-2 ring-slate-300 dark:ring-slate-500 grayscale opacity-90 shadow-none'
                    : 'bg-transparent hover:bg-stone-200/70 dark:hover:bg-stone-700/70 shadow-none ring-0'
                }`}
              >
                <img
                  src={falconSearchIconImg}
                  alt="البحث المباشر بصقر"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className={`relative z-10 w-5 h-5 object-contain select-none pointer-events-none transition-transform duration-200 ${
                    falconConn.searchButtonState === 'live'
                      ? 'scale-105 drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]'
                      : ''
                  }`}
                />
                {falconConn.searchButtonState !== 'off' && (
                  <span
                    aria-hidden="true"
                    className={`absolute -top-0.5 -right-0.5 z-20 w-2 h-2 rounded-full border border-white dark:border-stone-900 shadow-sm pointer-events-none ${
                      falconConn.searchButtonState === 'live' ? 'bg-emerald-300' : 'bg-slate-300'
                    }`}
                  />
                )}
              </button>
            </div>

            {/* زر الإرسال مع سهم متجه للأعلى ⬆️ */}
            <button
              type="button"
              disabled={isSending || isGeneratingStudio || (!inputPrompt.trim() && !pendingAttachment)}
              onClick={() => handleSendMessage()}
              title="إرسال الاستفسار (أو اضغط Ctrl+Enter)"
              className="w-9 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};