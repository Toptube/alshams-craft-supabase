import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { FalconMascotAvatar, ArtisanAvatar } from '../brand/BrandAssets';
import { UserProfile, CraftCategory, AIVisionAnalysis, ChatMessage } from '../../types';
import { authedFetch } from '../../lib/apiClient';
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
} from 'lucide-react';

export interface StructuredCalculatorExport {
  category?: CraftCategory | string;
  laborWage?: number;
  hours?: number;
  minMarketPrice?: number;
  recommendedFairPrice?: number;
  maxMarketPrice?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
  notes?: string;
}

interface FalconAIAgentProps {
  profile: UserProfile;
  currentCategory: CraftCategory;
  onApplyCategoryFromAI: (category: CraftCategory) => void;
  onApplyEstimatedLaborWage: (wage: number, hours: number) => void;
  onTransferNotesToCalculator: (notes: string) => void;
  onExportStructuredToCalculator?: (data: StructuredCalculatorExport) => void;
}

export const FALCON_WELCOME_TEXT = `أهلاً بك في الجناح الذكي لمنظومة الشمساوية! 🦅
أنا "صقر الشمساوية"، مستشارك لدراسة الأسواق وحساب التكاليف وتحليل المشغولات. ارفع صورة القطعة أو اكتب استفسارك وسأجيبك فوراً.`;

export const createInitialFalconMessage = (userName?: string): ChatMessage => ({
  id: 'msg_welcome',
  sender: 'falcon',
  text: userName
    ? `أهلاً بك يا ${userName} في الجناح الذكي لمنظومة الشمساوية! 🦅\nأنا "صقر الشمساوية"، مستشارك لدراسة الأسواق وحساب التكاليف وتحليل المشغولات. ارفع صورة القطعة أو اكتب استفسارك وسأجيبك فوراً.`
    : FALCON_WELCOME_TEXT,
  timestamp: Date.now(),
});

function getArabicAiError(status: number, serverMessage?: string): string {
  if (serverMessage && /[\u0600-\u06FF]/.test(serverMessage)) return serverMessage;
  if (status === 401) return 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً.';
  if (status === 403) return 'الحساب غير مصرح له باستخدام هذه الميزة.';
  if (status === 429) return 'انتهى الرصيد اليومي للاستشارات، يتجدد تلقائياً غداً.';
  if (status === 504 || status === 408) return 'استغرق صقر وقتاً أطول من المعتاد. أعد المحاولة فوراً.';
  if (status >= 500) return 'الخدمة تواجه ضغطاً مؤقتاً، أعد المحاولة بعد ثوانٍ.';
  return 'تعذر إتمام الطلب، حاول مرة أخرى.';
}

async function falconFetch(url: string, init: RequestInit, timeoutMs = 18000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await authedFetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('استغرق صقر وقتاً أطول من المعتاد. أعد المحاولة فوراً.');
    }
    throw new Error('تعذر الاتصال بالخادم، يرجى المحاولة بعد لحظات.');
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
  const sessionKey = `alshams_falcon_chat_${workshopId}`;

  const [messages, setMessages] = useState<ChatMessage[]>([createInitialFalconMessage()]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [newChatFeedback, setNewChatFeedback] = useState(false);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [transferredNotice, setTransferredNotice] = useState(false);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  // Modern Chat UX additions: Auto-expanding, Voice, Attachments, Saved sessions & Menu
  const [pendingAttachment, setPendingAttachment] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<Array<{ id: string; title: string; timestamp: number; messages: ChatMessage[] }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  const savedSessionsKey = `alshams_falcon_saved_sessions_${workshopId}`;

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 44), 140) + 'px';
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
  }, [messages, isSending, isAnalyzingImage, scrollToBottom]);

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

  const firstName = ((profile as any).fullName || (profile as any).name || profile.artistName || '').trim().split(/\s+/)[0] || '';

  const handleNewChat = () => {
    const welcome = createInitialFalconMessage(firstName);
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
    const welcome = createInitialFalconMessage(firstName);
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
    // 1. البحث عن آخر تحليل رؤية للمشغولة
    const lastWithVision = [...messages].reverse().find((m) => m.metadata?.visionAnalysis);
    if (lastWithVision && lastWithVision.metadata?.visionAnalysis) {
      handleExportStructuredToCalculator(lastWithVision.metadata.visionAnalysis);
      showFeedback('✓ تم تصدير بيانات القطعة لحاسبة التكاليف');
      return;
    }

    // 2. أو تصدير سياق المحادثة الأخيرة
    const lastAssistant = [...messages].reverse().find((m) => m.sender === 'falcon' && m.id !== 'msg_welcome');
    if (lastAssistant && onExportStructuredToCalculator) {
      onExportStructuredToCalculator({
        category: currentCategory,
        notes: `توجيهات صقر الشمساوية: ${lastAssistant.text.slice(0, 250)}`,
      });
      showFeedback('✓ تم تصدير بيانات المحادثة لحاسبة التكاليف');
      return;
    }

    showFeedback('لا توجد بيانات تسعير حالية للتصدير.');
  };

  const toggleVoiceRecording = () => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      showFeedback('ميزة التعرف الصوتي المباشر غير مدعومة في متصفحك.');
      return;
    }

    if (isListeningVoice) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'ar-EG';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningVoice(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInputPrompt((prev) => {
            const next = prev ? `${prev} ${transcript.trim()}` : transcript.trim();
            setTimeout(() => adjustTextareaHeight(textareaRef.current), 0);
            return next;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListeningVoice(false);
      showFeedback('تعذر تشغيل الميكروفون. يرجى التأكد من منح الإذن.');
    }
  };

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

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { base64, mimeType } = await compressImageForAI(file);
      if (!base64) throw new Error('فشل معالجة الصورة المرفوعة.');

      setPendingAttachment({ base64, mimeType, name: file.name });
      showFeedback('📸 تم إرفاق الصورة. يمكنك كتابة استفسارك ثم الضغط على إرسال.');
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (err: any) {
      showFeedback('تعذر قراءة الصورة: ' + (err.message || ''));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleSendMessage = async (customText?: string, chip?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if (!textToSend && !chip && !pendingAttachment) return;

    // إذا كان هناك مرفق صورة، يتم فحصها هندسياً مع ملاحظات الحرفي
    if (pendingAttachment) {
      const att = pendingAttachment;
      setPendingAttachment(null);
      setIsAnalyzingImage(true);

      const userMsg: ChatMessage = {
        id: 'user_img_' + Date.now(),
        sender: 'user',
        text: textToSend || '📸 قمت برفع صورة قطعة مشغولات يدوية لفحصها هندسياً واستخراج الخامات ونسب الهالك والأسعار.',
        timestamp: Date.now(),
        metadata: { previewImage: att.base64 },
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputPrompt('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      try {
        const res = await falconFetch(
          '/api/analyze-vision',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: att.base64,
              mimeType: att.mimeType || 'image/jpeg',
              artistNotes: textToSend || '',
              activeCrafts: Array.isArray(profile.selectedCrafts) ? profile.selectedCrafts : [],
            }),
          },
          30000
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(getArabicAiError(res.status, errData.error));
        }

        const data: AIVisionAnalysis = await res.json();
        const visionRem = typeof (data as any).remaining === 'number' ? (data as any).remaining : (data as any).dailyAiRemaining;
        if (typeof visionRem === 'number') {
          setDailyRemaining(visionRem);
        }

        if (data.detectedCategory) onApplyCategoryFromAI(data.detectedCategory);
        if (data.estimatedLaborWage) onApplyEstimatedLaborWage(data.estimatedLaborWage, data.estimatedHours);

        const pricingIsEstimated = Boolean(data.competitionPricing?.estimated);
        const pricingSuffix = pricingIsEstimated ? ' (تقديري)' : ' (بحث سوقي)';
        const newMsgId = 'falcon_res_' + Date.now();

        setMessages((prev) => [
          ...prev,
          {
            id: newMsgId,
            sender: 'falcon',
            text: `🎯 تم فحص القطعة هندسياً واستخراج المواصفات:
- التصنيف المعتمد: **${data.detectedCategory}**
- ساعات العمل المقدرة: **${data.estimatedHours} ساعة**
- المصنعية المقترحة: **${data.estimatedLaborWage} ${profile.currencySymbol || 'ج.م'}**
- أسعار السوق${pricingSuffix}: من ${data.competitionPricing?.minMarketPrice || 0} إلى ${data.competitionPricing?.maxMarketPrice || 0} ${profile.currencySymbol || 'ج.م'}
${data.notesForCalculator ? `\n💡 توجيهات التشغيل: ${data.notesForCalculator}` : ''}`,
            timestamp: Date.now(),
            metadata: { visionAnalysis: data },
            sources: (data as any).sources || [],
            searchEntryPoint: (data as any).searchEntryPoint,
            searchUsed: !pricingIsEstimated,
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'err_' + Date.now(),
            sender: 'falcon',
            text: `⚠️ ${err.message || 'تعذر تحليل الصورة، حاول مرة أخرى.'}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsAnalyzingImage(false);
      }
      return;
    }

    // إرسال استفسار نصي عادي
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: textToSend || `استفسار حول: ${chip}`,
      actionChip: chip,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsSending(true);

    try {
      const formattedHistory = messages
        .filter((m) => m.id !== 'msg_welcome')
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          content: m.text,
        }));

      const res = await falconFetch(
        '/api/chat-agent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            actionChip: chip || null,
            chatHistory: formattedHistory,
            currentContext: {
              selectedCrafts: profile.selectedCrafts || ['macrame'],
              country: profile.country || 'مصر',
              currency: profile.currencySymbol || 'ج.م',
              category: currentCategory,
              artistName: firstName,
              brandName: profile.brandName,
            },
            userEmail: profile.email || '',
          }),
        },
        18000
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

      setMessages((prev) => [
        ...prev,
        {
          id: 'falcon_' + Date.now(),
          sender: 'falcon',
          text: data.reply || 'تمت دراسة طلبك، هل تود معرفة أي تفاصيل إضافية؟',
          timestamp: Date.now(),
          sources: data.sources || [],
          searchEntryPoint: data.searchEntryPoint,
          searchUsed: data.searchUsed,
        },
      ]);
    } catch (err: any) {
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
    }
  };

  const handleExportStructuredToCalculator = (vData: AIVisionAnalysis) => {
    if (!vData) return;
    const minP = vData.competitionPricing?.minMarketPrice || 0;
    const avgP = vData.competitionPricing?.avgMarketPrice || vData.competitionPricing?.recommendedFairPrice || 0;
    const maxP = vData.competitionPricing?.maxMarketPrice || 0;

    const notes = `تحليل صقر (${vData.detectedCategory}): مصنعية ${vData.estimatedLaborWage} | ساعات ${vData.estimatedHours} | سوق [${minP} - ${maxP}]`;
    const wage = vData.estimatedLaborWage || 90;
    const hours = vData.estimatedHours || 3;

    if (onExportStructuredToCalculator) {
      onExportStructuredToCalculator({
        category: (vData.detectedCategory as CraftCategory) || currentCategory,
        laborWage: wage,
        hours,
        minMarketPrice: minP,
        recommendedFairPrice: avgP,
        maxMarketPrice: maxP,
        notes,
      });
    } else {
      onApplyCategoryFromAI((vData.detectedCategory as CraftCategory) || currentCategory);
      onApplyEstimatedLaborWage(wage, hours);
      onTransferNotesToCalculator(notes);
    }

    setTransferredNotice(true);
    setTimeout(() => setTransferredNotice(false), 2500);
  };

  const toggleSourceExpansion = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden flex flex-col h-[780px] relative transition-colors duration-200">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-stone-950 via-amber-950 to-stone-900 text-white flex items-center justify-between border-b border-amber-500/30 shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <FalconMascotAvatar size="lg" fit="top" statusDot={true} />
          <div className="text-right">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-amber-300 flex items-center gap-1.5">
                <span>صقر الشمساوية AI</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30 font-bold">
                خبير الحرف والأسواق
              </span>
            </div>
            <p className="text-[11px] text-stone-300">
              تسعير، مقارنة أسعار، دراسة الخامات، وتحليل الصور هندسياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* دردشة جديدة ➕ */}
          <button
            type="button"
            onClick={handleNewChat}
            title="دردشة جديدة (➕)"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">دردشة جديدة</span>
          </button>

          {/* حفظ المحادثة 💾 */}
          <button
            type="button"
            onClick={handleSaveChat}
            title="حفظ المحادثة في الأرشيف (💾)"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">حفظ</span>
          </button>

          {/* تصدير للحاسبة 🧮 */}
          <button
            type="button"
            onClick={handleExportLatestToCalculator}
            title="تصدير الأرقام والأسعار لحاسبة التكاليف (🧮)"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden md:inline">للحاسبة</span>
          </button>

          {/* حذف الشات 🗑️ */}
          <button
            type="button"
            onClick={handleClearChat}
            title="حذف وتفريغ سجل المحادثة (🗑️)"
            className="p-2 rounded-xl bg-stone-800/90 hover:bg-red-950/80 border border-stone-700 hover:border-red-500/60 text-stone-300 hover:text-red-300 transition active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* قائمة ثلاث نقاط ⋮ */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="خيارات إضافية والمحادثات السابقة"
              className="p-2 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-stone-700 text-stone-300 transition active:scale-95 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4 text-amber-400" />
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
                    <img src={msg.metadata.previewImage} alt="صورة الموديل" className="w-full h-auto object-cover" />
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                {/* كارت نتائج الرؤية */}
                {vData && (
                  <div className="space-y-2.5 mt-3 pt-3 border-t border-amber-500/20">
                    <div className="flex items-center justify-between gap-2 bg-amber-500/10 p-2 rounded-xl">
                      <span className="font-bold text-xs text-amber-900 dark:text-amber-200">
                        مواصفات القطعة ({vData.detectedCategory})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExportStructuredToCalculator(vData)}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Calculator className="w-3 h-3" />
                        <span>نقل للحاسبة</span>
                      </button>
                    </div>

                    {transferredNotice && (
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ تم نقل البيانات لحاسبة التكاليف بنجاح
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1 rounded bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                        <span className="text-[9px] text-stone-500 block">أقل سعر</span>
                        <span className="font-bold text-xs">{vData.competitionPricing?.minMarketPrice || 0}</span>
                      </div>
                      <div className="p-1 rounded bg-amber-100 dark:bg-amber-950/60 border border-amber-300">
                        <span className="text-[9px] text-amber-700 dark:text-amber-400 block font-bold">المتوسط</span>
                        <span className="font-bold text-xs">{vData.competitionPricing?.avgMarketPrice || 0}</span>
                      </div>
                      <div className="p-1 rounded bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                        <span className="text-[9px] text-stone-500 block">أعلى سعر</span>
                        <span className="font-bold text-xs">{vData.competitionPricing?.maxMarketPrice || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* المصادر */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-stone-200 dark:border-stone-700">
                    <button
                      type="button"
                      onClick={() => toggleSourceExpansion(msg.id)}
                      className="flex items-center justify-between w-full text-[10px] font-bold text-amber-700 dark:text-amber-400"
                    >
                      <span>مصادر السوق المعتمدة ({msg.sources.length})</span>
                      {expandedSources[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {expandedSources[msg.id] && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {msg.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center gap-1"
                          >
                            <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                            <span className="truncate max-w-[150px]">{src.title || src.url}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 text-[9px] mt-1 font-mono text-stone-400">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isUser && <CheckCheck className="w-3 h-3 text-emerald-600 inline" />}
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

      {/* شريط حالة التسجيل الصوتي */}
      {isListeningVoice && (
        <div className="px-3.5 py-2 bg-red-500/15 border-t border-red-500/30 flex items-center justify-between text-xs text-red-700 dark:text-red-300 flex-shrink-0 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span className="font-bold">صقر يستمع لصوتك الآن.. تحدث وسيكتب استفسارك فوراً</span>
          </div>
          <button
            type="button"
            onClick={toggleVoiceRecording}
            className="text-[11px] font-black underline cursor-pointer hover:text-red-900 dark:hover:text-red-200"
          >
            إنهاء التسجيل
          </button>
        </div>
      )}

      {/* شريط الإدخال العصري المتمدد تلقائياً */}
      <div className="p-2.5 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-end gap-2 flex-shrink-0">
        {/* زر إرفاق الصور والملفات 📎 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="إرفاق صورة مشغولة لفحصها هندسياً واستخراج الخامات"
          className="p-2.5 rounded-2xl text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* زر التسجيل الصوتي المباشر 🎙️ */}
        <button
          type="button"
          onClick={toggleVoiceRecording}
          title={isListeningVoice ? 'إيقاف التسجيل الصوتي' : 'تسجيل استفسار بصوتك'}
          className={`p-2.5 rounded-2xl transition cursor-pointer shrink-0 ${
            isListeningVoice
              ? 'bg-red-500 text-white shadow-md animate-pulse'
              : 'text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          {isListeningVoice ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* مربع النص المتمدد تلقائياً للأعلى مع دعم Scroll و Enter لسطر جديد */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => {
              setInputPrompt(e.target.value);
              adjustTextareaHeight(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
                // الضغط العادي على Enter ينزل سطراً جديداً لكتابة أفكار جديدة
              }
            }}
            rows={1}
            placeholder="اكتب استفسارك لصقر... (Enter لسطر جديد، واضغط الإرسال للإرسال)"
            className="w-full resize-none max-h-36 overflow-y-auto px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed placeholder:text-stone-400"
          />
        </div>

        {/* زر الإرسال مع سهم متجه للأعلى ⬆️ */}
        <button
          type="button"
          disabled={isSending || (!inputPrompt.trim() && !pendingAttachment)}
          onClick={() => handleSendMessage()}
          title="إرسال الاستفسار (أو اضغط Ctrl+Enter)"
          className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md active:scale-95 cursor-pointer shrink-0"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};