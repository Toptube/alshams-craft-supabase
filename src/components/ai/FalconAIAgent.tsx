import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { FalconMascotAvatar, ArtisanAvatar } from '../brand/BrandAssets';
import { UserProfile, CraftCategory, AIVisionAnalysis, ChatMessage } from '../../types';
import { authedFetch } from '../../lib/apiClient';
import {
  Sparkles,
  Camera,
  Send,
  ArrowRight,
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

/**
 * رسالة الترحيب المعتمدة لصقر الشمساوية AI
 */
export const FALCON_WELCOME_TEXT = `أهلاً بك يا فنان في الجناح الذكي لمنظومة الشمساوية! 🦅✨
أنا "صقر الشمساوية"، مستشارك الهندسي والحسابي الأول المتخصص في كافة الحرف اليدوية والمشغولات الفنية ,, كل ماعليك هو رفع صورة المنتج لنقوم بتحليلها واجابتك علي كل إستفساراتك بإذن الله وعونه 🎨🧶💎🌟🚀`;

export const createInitialFalconMessage = (): ChatMessage => ({
  id: 'msg_welcome',
  sender: 'falcon',
  text: FALCON_WELCOME_TEXT,
  timestamp: Date.now(),
});

/**
 * 15) خريطة الأخطاء بالعربية الواضحة حسب رمز الحالة:
 * 401 (سجّل دخولك)، 403 (الحساب موقوف)، 429 (انتهى الحد اليومي)، 503 (الخدمة غير مفعّلة حالياً)، 502 (تعذر الرد، حاول مرة أخرى)
 */
function getArabicAiError(status: number, serverMessage?: string): string {
  // رسالة السيرفر (عربية وواضحة) لها الأولوية دائماً
  if (serverMessage && /[\u0600-\u06FF]/.test(serverMessage)) return serverMessage;
  if (status === 401) {
    return 'سجّل دخولك الأول للوصول إلى استشارات وتحليلات صقر الشمساوية AI.';
  }
  if (status === 403) {
    return 'الحساب موقوف، يرجى التواصل مع الإدارة.';
  }
  if (status === 429) {
    return 'انتهى الحد اليومي (20 استشارة في اليوم) للمساعد الذكي. يتجدد رصيدك تلقائياً غداً.';
  }
  if (status === 504) {
    return 'صقر اتأخر في الرد بسبب ضغط على الخدمة. جرّب تاني بعد دقيقة.';
  }
  if (status === 503) {
    return 'خدمة الذكاء الاصطناعي مضغوطة أو غير مفعّلة حالياً. جرّب بعد دقيقة.';
  }
  if (status === 502) {
    return 'تعذر الرد، حاول مرة أخرى.';
  }
  return 'تعذر معالجة الطلب، حاول مرة أخرى.';
}

/** طلب للسيرفر بمهلة قصوى عشان "صقر يكتب..." ما تفضلش للأبد */
async function falconFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await authedFetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('صقر اتأخر أكتر من اللازم. اتأكد من الإنترنت وجرّب تاني بعد دقيقة.');
    }
    if (err instanceof TypeError) {
      throw new Error('تعذر الاتصال بالخادم، اتأكد من الإنترنت وجرّب تاني.');
    }
    throw err;
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

  // حالة سجل المحادثة الكامل والترطيب الأولي من التخزين المؤقت
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
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // دالة تمرير تلقائي فائقة الدقة لأسفل المحادثة تماماً كما في واتساب
  const scrollToBottom = useCallback((smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  // مراقبة موضع التمرير لإظهار زر العودة لأسفل إذا صعد المستخدم للأعلى
  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottomBtn(distanceFromBottom > 150);
  }, []);

  // التمرير التلقائي لأسفل عند تغير الرسائل أو حالات الانتظار
  useLayoutEffect(() => {
    scrollToBottom(true);
    const timer1 = setTimeout(() => scrollToBottom(true), 80);
    const timer2 = setTimeout(() => scrollToBottom(true), 250);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [messages, isSending, isAnalyzingImage, scrollToBottom]);

  // 1. استرجاع سجل المحادثة من التخزين المحلي فوراً أو من السيرفر حتى لا يفقد المستخدم سياق النقاش عند التحديث
  useEffect(() => {
    let loadedFromLocal = false;
    try {
      const stored = localStorage.getItem(sessionKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          loadedFromLocal = true;
          setIsHydrated(true);
        }
      }
    } catch (e) {
      console.warn('Could not read cached session from localStorage:', e);
    }

    if (!loadedFromLocal) {
      async function restoreFromServer() {
        try {
          const res = await authedFetch('/api/ai/session');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(data.messages);
              try {
                localStorage.setItem(sessionKey, JSON.stringify(data.messages));
              } catch {}
            }
          }
        } catch (err) {
          console.warn('Could not restore session from server:', err);
        } finally {
          setIsHydrated(true);
        }
      }
      restoreFromServer();
    }
  }, [sessionKey]);

  // 2. حفظ سجل المحادثة محلياً وفي السيرفر مع استبعاد أي بيانات حساسة
  useEffect(() => {
    if (!isHydrated) return;

    // تنقية البيانات من أي حقول حساسة قبل التخزين
    const sanitizedToStore = messages.map((m) => {
      let cleanMeta: any = undefined;
      if (m.metadata && typeof m.metadata === 'object') {
        cleanMeta = { ...m.metadata };
        delete cleanMeta.token;
        delete cleanMeta.password;
        delete cleanMeta.secretKey;
        delete cleanMeta.treasuries;
        delete cleanMeta.safeBalances;
        delete cleanMeta.internalHourlyRate;
        delete cleanMeta.actualInternalCost;
        delete cleanMeta.apiKey;
      }
      return {
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
        sources: m.sources,
        searchUsed: m.searchUsed,
        searchEntryPoint: m.searchEntryPoint,
        metadata: cleanMeta,
      };
    });

    try {
      localStorage.setItem(sessionKey, JSON.stringify(sanitizedToStore));
    } catch (err) {
      console.warn('Could not save session to localStorage:', err);
    }

    const timer = setTimeout(() => {
      // نسخة السيرفر من غير الصور (base64) عشان الطلب يبقى خفيف
      const serverCopy = sanitizedToStore.slice(-40).map((m) => {
        if (!m.metadata) return m;
        const { previewImage, ...restMeta } = m.metadata as any;
        return { ...m, metadata: restMeta };
      });
      authedFetch('/api/ai/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: serverCopy }),
      }).catch(() => {});
    }, 1200);

    return () => clearTimeout(timer);
  }, [messages, isHydrated, sessionKey]);

  // استعلام رصيد الاستشارات المتبقية اليوم عند الفتح
  const loadDailyUsage = useCallback(async () => {
    try {
      const res = await authedFetch('/api/ai/usage');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.remaining === 'number') {
          setDailyRemaining(data.remaining);
        }
      }
    } catch (err) {
      // مستخدم غير مسجل بعد أو غير متاح
    }
  }, []);

  useEffect(() => {
    loadDailyUsage();
  }, [loadDailyUsage]);

  // بدء محادثة جديدة لمنتج أو استفسارات جديدة
  const handleNewChat = async () => {
    const welcome = createInitialFalconMessage();
    setMessages([welcome]);
    setInputPrompt('');
    setImagePreview(null);
    setIsAnalyzingImage(false);
    setExpandedSources({});

    try {
      localStorage.removeItem(sessionKey);
    } catch {}

    try {
      await authedFetch('/api/ai/session', { method: 'DELETE' });
    } catch {}

    setNewChatFeedback(true);
    setTimeout(() => setNewChatFeedback(false), 2500);
  };

  // 16) الأزرار الأربعة الثابتة لأوامر الصقر
  const actionChips = [
    'التسعير العادل جملة وقطاعي',
    'مقارنة المنتج بالأسواق',
    'توليد باترون مفصل وطريقة العمل',
    'توقع الأبعاد والتكلفة والمصنعية',
  ];

  // 14) ضغط الصورة في الواجهة قبل الإرسال (أقصى بُعد 1280px، JPEG جودة 0.8)
  const compressImageForAI = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawResult = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
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
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ base64: compressed, mimeType: 'image/jpeg' });
        };
        img.onerror = () => {
          resolve({ base64: rawResult, mimeType: 'image/jpeg' });
        };
        img.src = rawResult;
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });
  };

  // معالجة رفع وتحليل الصورة (الخطوة 1 + الخطوة 2 في السيرفر)
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzingImage(true);
      const { base64, mimeType } = await compressImageForAI(file);
      if (!base64) throw new Error('فشل قراءة ملف الصورة');

      setImagePreview(base64);

      // إضافة رسالة المستخدم في ترتيبها الزمني
      setMessages((prev) => [
        ...prev,
        {
          id: 'user_img_' + Date.now(),
          sender: 'user',
          text: '📸 قمت برفع صورة قطعة مشغولات يدوية لتحليلها هندسياً واستخراج مواصفاتها ودراسة سوقها.',
          timestamp: Date.now(),
          metadata: { previewImage: base64 },
        },
      ]);

      const res = await falconFetch('/api/analyze-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: mimeType || 'image/jpeg',
          artistNotes: inputPrompt || '',
          activeCrafts: Array.isArray(profile.selectedCrafts) ? profile.selectedCrafts : [],
        }),
      }, 100_000);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = getArabicAiError(res.status, errData.error);
        throw new Error(errMsg);
      }

      const data: AIVisionAnalysis = await res.json();

      if (typeof (data as any).dailyAiRemaining === 'number') {
        setDailyRemaining((data as any).dailyAiRemaining);
      }

      // تحويل التصنيف فورياً في الحاسبة
      if (data.detectedCategory) {
        onApplyCategoryFromAI(data.detectedCategory);
      }

      // تطبيق إجمالي أجر المصنعية المحسوب بالسيرفر
      if (data.estimatedLaborWage) {
        onApplyEstimatedLaborWage(data.estimatedLaborWage, data.estimatedHours);
      }

      const pricingIsEstimated = Boolean(data.competitionPricing?.estimated);
      const pricingSuffix = pricingIsEstimated ? ' (تقدير تقريبي)' : ' (بحث سوق مؤكد)';

      // رسالة صقر التفاعلية المضمنة مباشرة داخل تيار المحادثة كواتساب تماماً
      const newMsgId = 'falcon_res_' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId,
          sender: 'falcon',
          text: `🎯 تم استيعاب الصورة وتحليلها بدقة هندسية عالية عبر صقر الشمساوية!
• التصنيف المعتمد: **${data.detectedCategory}** (تم تحويل الحاسبة إليه فوراً).
• ساعات العمل المقدرة: **${data.estimatedHours} ساعة**.
• إجمالي المصنعية المقترحة للورشة: **${data.estimatedLaborWage} ${profile.currencySymbol}**.
• دراسة السوق${pricingSuffix}: من ${data.competitionPricing?.minMarketPrice || 0} إلى ${data.competitionPricing?.maxMarketPrice || 0} ${profile.currencySymbol}.

تفقد أدناه الباترون التخطيطي التفاعلي ومصفوفة السوق، ويمكنك نقلهما للحاسبة بضغطة زر واحدة:`,
          timestamp: Date.now(),
          metadata: { visionAnalysis: data },
          sources: (data as any).sources || [],
          searchEntryPoint: (data as any).searchEntryPoint,
          searchUsed: !pricingIsEstimated,
        },
      ]);

      if (data.sources && data.sources.length > 0) {
        setExpandedSources((prev) => ({ ...prev, [newMsgId]: true }));
      }
    } catch (err: any) {
      console.error('AI Vision error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'falcon',
          text: `⚠️ ${err.message || 'تعذر التحليل، حاول مرة أخرى.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsAnalyzingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // 7) إرسال رسالة الشات مع احترام الخصوصية الصارمة والترتيب الطبيعي كالواتساب
  const handleSendMessage = async (customText?: string, chip?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if (!textToSend && !chip) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: textToSend || (chip ? `استفسار حول: ${chip}` : ''),
      actionChip: chip,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsSending(true);

    try {
      // 7) الخصوصية: أرسل للنموذج فقط: الحِرف المفعّلة، الدولة، العملة، وتصنيف المنتج الحالي
      const safeContext = {
        selectedCrafts: Array.isArray(profile.selectedCrafts) ? profile.selectedCrafts : ['macrame'],
        country: profile.country || 'جمهورية مصر العربية',
        currency: profile.currencySymbol || profile.currency || 'ج.م',
        category: currentCategory,
      };

      const res = await falconFetch('/api/chat-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          actionChip: chip || null,
          // نبعت النص فقط (من غير الصور والـ SVG) عشان الطلب يبقى خفيف وسريع
          chatHistory: messages.slice(-12).map((m) => ({ sender: m.sender, text: m.text })),
          currentContext: safeContext,
        }),
      }, 75_000);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = getArabicAiError(res.status, errData.error);
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (typeof data.dailyAiRemaining === 'number') {
        setDailyRemaining(data.dailyAiRemaining);
      }

      const newMsgId = 'falcon_' + Date.now();
      const sourcesList = data.sources || [];

      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId,
          sender: 'falcon',
          text: data.reply || 'عذراً يا فنان، تعذر استخراج رد واضح على سؤالك حالياً، يرجى المحاولة مرة أخرى.',
          timestamp: Date.now(),
          sources: sourcesList,
          searchEntryPoint: data.searchEntryPoint,
          searchUsed: data.searchUsed,
        },
      ]);

      if (sourcesList.length > 0) {
        setExpandedSources((prev) => ({ ...prev, [newMsgId]: true }));
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'falcon',
          text: `⚠️ ${err.message || 'تعذر الرد، حاول مرة أخرى.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // زر "تصدير إلى حاسبة تكاليف المنتج" ونقل الأرقام والملاحظات بدقة
  const handleExportStructuredToCalculator = (vData: AIVisionAnalysis) => {
    if (!vData) return;
    const minP = vData.competitionPricing?.minMarketPrice || 0;
    const avgP =
      vData.competitionPricing?.avgMarketPrice ||
      vData.competitionPricing?.recommendedFairPrice ||
      0;
    const maxP = vData.competitionPricing?.maxMarketPrice || 0;
    const isEst = vData.competitionPricing?.estimated ? ' (تقدير تقريبي)' : ' (بحث سوق)';

    const combinedNotes = `• التصنيف المعتمد: ${vData.detectedCategory || ''}
• الساعات المقدرة: ${vData.estimatedHours || 0} ساعة
• دراسة السوق${isEst}: (أدنى: ${minP} | متوسط: ${avgP} | أعلى: ${maxP} ${profile.currencySymbol})
• التوجيه الهندسي: ${vData.notesForCalculator || ''}
• خطوات التنفيذ المختارة:
${(vData.productionGuide || []).join('\n')}
• الغرز والتقنيات: ${(vData.stitchPatterns || []).join('، ')}`;

    const wage = vData.estimatedLaborWage || (vData.estimatedHours ? vData.estimatedHours * 30 : 90);
    const hours = vData.estimatedHours || 3;

    if (onExportStructuredToCalculator) {
      onExportStructuredToCalculator({
        category: (vData.detectedCategory as CraftCategory) || currentCategory,
        laborWage: wage,
        hours: hours,
        minMarketPrice: minP,
        recommendedFairPrice: avgP,
        maxMarketPrice: maxP,
        notes: combinedNotes,
      });
    } else {
      onApplyCategoryFromAI((vData.detectedCategory as CraftCategory) || currentCategory);
      onApplyEstimatedLaborWage(wage, hours);
      onTransferNotesToCalculator(combinedNotes);
    }

    setTransferredNotice(true);
    setTimeout(() => setTransferredNotice(false), 3500);
  };

  const handleExportChatMessageToCalculator = (chatText: string) => {
    if (!chatText) return;
    const hoursMatch = chatText.match(/(\d+(?:\.\d+)?)\s*(?:ساعات|ساعة|hours?)/i);
    const wageMatch = chatText.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|ج\.م|ريال|درهم|دولار|مصنعية|أجر)/i);
    const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 3;
    const laborWage = wageMatch ? parseFloat(wageMatch[1]) : hours * 30;

    const notes = `[توجيهات صقر الشمساوية AI]:\n${chatText}`;

    if (onExportStructuredToCalculator) {
      onExportStructuredToCalculator({
        category: currentCategory,
        laborWage,
        hours,
        notes,
      });
    } else {
      onApplyEstimatedLaborWage(laborWage, hours);
      onTransferNotesToCalculator(notes);
    }

    setTransferredNotice(true);
    setTimeout(() => setTransferredNotice(false), 3500);
  };

  const toggleSourceExpansion = (msgId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden flex flex-col h-[780px] relative transition-colors duration-200">
      {/* Header with Official Falcon Mascot Identity (يدعم الوضع الليلي والنهاري) */}
      <div className="p-4 bg-gradient-to-r from-stone-950 via-amber-950 to-stone-900 text-white flex items-center justify-between border-b border-amber-500/30 shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* تميمة صقر الشمساوية AI بأبعاد متناسقة ومضيئة */}
          <FalconMascotAvatar size="lg" fit="top" statusDot={true} />
          <div className="text-right">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-amber-300 flex items-center gap-1.5">
                <span>صقر الشمساوية AI</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30 font-bold">
                خبير كافة الحِرف اليدوية
              </span>
            </div>
            <p className="text-[11px] text-stone-300">
              استشارات مكرمية، كروشيه، ريزن، خزف، خشب، جلود، شموع وإكسسوارات • تدقيق التسعير
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* زر محادثة جديدة لمنتج أو استفسارات جديدة مع الإبقاء على باقي الأزرار */}
          <button
            type="button"
            onClick={handleNewChat}
            className="px-3 py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            title="بدء محادثة جديدة لمنتج أو استفسارات جديدة"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>دردشة جديدة</span>
          </button>

          {/* زر رفع صورة موديل */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition cursor-pointer active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">تحليل صورة موديل</span>
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageSelected}
          className="hidden"
        />
      </div>

      {/* لوحة بيانات صغيرة تعرض عدد الاستشارات المتبقية لليوم في شكل شريط تقدم مرئي لإدارة الاستهلاك */}
      <div className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-stone-900/50 dark:to-transparent border-b border-amber-200/60 dark:border-amber-900/40 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 dark:bg-amber-400/15 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0 shadow-2xs">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-stone-800 dark:text-stone-200">
                  الاستهلاك اليومي للاستشارات:
                </span>
                <span
                  className={`text-[11px] font-black font-mono px-2.5 py-0.5 rounded-full shadow-2xs ${
                    (dailyRemaining ?? 20) > 8
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : (dailyRemaining ?? 20) > 3
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  }`}
                >
                  {dailyRemaining ?? 20} من 20 استشارة متبقية
                </span>
                {newChatFeedback && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                    ✓ تم بدء محادثة جديدة بنجاح
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                استهلكت {Math.max(0, 20 - (dailyRemaining ?? 20))} من أصل 20 استشارة اليوم • يتجدد الرصيد تلقائياً كل 24 ساعة
              </p>
            </div>
          </div>

          {/* شريط التقدم المرئي التفاعلي */}
          <div className="flex items-center gap-2.5 sm:w-56 pt-0.5 sm:pt-0">
            <div className="flex-1 h-2.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden p-0.5 border border-stone-300/50 dark:border-stone-700/60 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  ((dailyRemaining ?? 20) / 20) * 100 > 50
                    ? 'bg-gradient-to-l from-emerald-500 to-amber-500'
                    : ((dailyRemaining ?? 20) / 20) * 100 > 20
                    ? 'bg-gradient-to-l from-amber-500 to-amber-600'
                    : 'bg-gradient-to-l from-rose-500 to-orange-500'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, ((dailyRemaining ?? 20) / 20) * 100))}%` }}
              />
            </div>
            <span className="text-xs font-mono font-black text-stone-700 dark:text-stone-300 min-w-[32px] text-left">
              {Math.round(((dailyRemaining ?? 20) / 20) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area - تجربة تشبه واتساب بتدفق تصاعدي طبيعي من القديم للحديث نحو الأسفل مع Flexbox */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3.5 bg-[#efeae2]/80 dark:bg-[#0b141a] scroll-smooth relative"
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
                  logoUrl={(profile as any).brandLogo || (profile as any).avatarUrl || (profile as any).logoUrl}
                  artistName={profile.brandName || profile.artistName || 'فنان'}
                  size="sm"
                  className="mt-1 flex-shrink-0 shadow-xs ring-1 ring-emerald-500/30"
                />
              ) : (
                <FalconMascotAvatar size="sm" fit="top" statusDot={false} className="mt-1 flex-shrink-0 shadow-xs" />
              )}

              <div
                className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-xs transition-all duration-150 ${
                  isUser
                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-stone-900 dark:text-stone-100 rounded-tr-none border border-emerald-200/70 dark:border-emerald-700/60 font-medium'
                    : 'bg-white dark:bg-[#202c33] text-stone-900 dark:text-stone-100 border border-stone-200/90 dark:border-stone-700/80 rounded-tl-none'
                }`}
              >
                {/* معاينة الصورة إذا كانت رسالة صورة مرفوعة من المستخدم */}
                {msg.metadata?.previewImage && (
                  <div className="mb-2 max-w-[240px] rounded-xl overflow-hidden border border-white/20 shadow-inner">
                    <img
                      src={msg.metadata.previewImage}
                      alt="صورة الموديل المرفوعة"
                      className="w-full h-auto object-cover max-h-48"
                    />
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                {isUser && (
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-emerald-800 dark:text-emerald-300 font-mono">
                    <span>{new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 inline" />
                  </div>
                )}

                {/* كارت نتائج الرؤية الحاسوبية المضمن مباشرة داخل رد صقر الزمني (كالواتساب تماماً) */}
                {vData && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-amber-500/20 text-stone-900 dark:text-stone-100">
                    {/* Header مع زر التصدير لحاسبة التكاليف */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                      <div className="flex items-center gap-1.5 font-extrabold text-xs text-amber-900 dark:text-amber-200">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>تحليل صقر الشمساوية لـ ({vData.detectedCategory})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExportStructuredToCalculator(vData)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                      >
                        <Calculator className="w-3.5 h-3.5 text-white" />
                        <span>تصدير إلى حاسبة تكاليف المنتج</span>
                      </button>
                    </div>

                    {transferredNotice && (
                      <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>تم تصدير الأرقام والملاحظات إلى حاسبة تكاليف المنتج بنجاح!</span>
                      </div>
                    )}

                    {/* مصفوفة دراسة السوق */}
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700/70 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-800 dark:text-stone-200">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span>أسعار السوق المشابهة:</span>
                        </span>
                        {vData.competitionPricing?.estimated ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            تقدير تقريبي
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            بحث سوق مؤكد
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700">
                          <span className="text-[9px] text-stone-500 block">أقل سعر</span>
                          <span className="font-mono font-bold text-xs text-stone-700 dark:text-stone-300">
                            {vData.competitionPricing?.minMarketPrice || 0} {profile.currencySymbol}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300/50">
                          <span className="text-[9px] text-amber-700 dark:text-amber-400 block font-bold">
                            السعر المتوسط
                          </span>
                          <span className="font-mono font-black text-xs text-amber-800 dark:text-amber-200">
                            {vData.competitionPricing?.avgMarketPrice ||
                              vData.competitionPricing?.recommendedFairPrice ||
                              0}{' '}
                            {profile.currencySymbol}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700">
                          <span className="text-[9px] text-stone-500 block">أعلى سعر</span>
                          <span className="font-mono font-bold text-xs text-stone-700 dark:text-stone-300">
                            {vData.competitionPricing?.maxMarketPrice || 0} {profile.currencySymbol}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* الغرز وخطوات العمل */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {vData.stitchPatterns && vData.stitchPatterns.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700/70 space-y-1">
                          <span className="font-bold flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                            <Grid className="w-3 h-3" />
                            <span>التقنيات والغرز:</span>
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-stone-600 dark:text-stone-300">
                            {vData.stitchPatterns.slice(0, 4).map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {vData.productionGuide && vData.productionGuide.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700/70 space-y-1">
                          <span className="font-bold flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                            <FileText className="w-3 h-3" />
                            <span>خطوات التنفيذ:</span>
                          </span>
                          <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-stone-600 dark:text-stone-300">
                            {vData.productionGuide.slice(0, 3).map((st, i) => (
                              <li key={i}>{st}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>

                    {/* رسم الباترون التخطيطي SVG إن وجد */}
                    {vData.svgSchematic && (
                      <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center">
                        <span className="text-[10px] font-bold text-stone-500 block mb-1">
                          رسم بياني تخطيطي للباترون:
                        </span>
                        <div
                          className="w-full flex items-center justify-center overflow-x-auto max-h-36"
                          dangerouslySetInnerHTML={{ __html: vData.svgSchematic }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 10) قسم قابل للطي "المصادر" تحت رد صقر */}
                {((msg.sources && msg.sources.length > 0) || msg.searchEntryPoint) && (
                  <div className="mt-2.5 pt-2 border-t border-stone-200/80 dark:border-stone-700/80 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSourceExpansion(msg.id)}
                      className="flex items-center justify-between w-full text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 py-0.5 cursor-pointer transition"
                    >
                      <span className="flex items-center gap-1">
                        <Search className="w-3 h-3 text-amber-500" />
                        <span>المصادر المعتمدة لبحث السوق ({msg.sources?.length || 0})</span>
                      </span>
                      {expandedSources[msg.id] ? (
                        <ChevronUp className="w-3 h-3 text-stone-400" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-stone-400" />
                      )}
                    </button>

                    {expandedSources[msg.id] && (
                      <div className="mt-1.5 space-y-1.5 pt-1 border-t border-dashed border-stone-200 dark:border-stone-700/60 animate-fadeIn">
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((src, idx) => (
                              <a
                                key={idx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-900/90 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 border border-stone-200 dark:border-stone-700 transition flex items-center gap-1 group"
                              >
                                <ExternalLink className="w-2.5 h-2.5 text-stone-400 group-hover:text-amber-500" />
                                <span className="truncate max-w-[200px]">{src.title || src.url}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        {/* 10) عرض searchEntryPoint صغيراً داخل نفس القسم دون تعديله إن وُجد */}
                        {msg.searchEntryPoint && (
                          <div
                            className="p-1.5 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-[9px] overflow-hidden leading-tight"
                            dangerouslySetInnerHTML={{ __html: msg.searchEntryPoint }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* زر التصدير لحاسبة التكاليف للرسائل العادية */}
                {!isUser && msg.id !== 'msg_welcome' && !vData && (
                  <div className="mt-2.5 pt-2 border-t border-stone-200/60 dark:border-stone-700/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleExportChatMessageToCalculator(msg.text)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-black text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>تصدير إلى حاسبة تكاليف المنتج</span>
                    </button>
                    <span className="text-[10px] text-stone-400 font-mono">صقر AI</span>
                  </div>
                )}

                {/* شريط توقيت الرسالة وتأكيد التسليم كالواتساب */}
                <div
                  className={`flex items-center justify-end gap-1 text-[9px] mt-1 font-mono ${
                    isUser ? 'text-amber-100' : 'text-stone-400'
                  }`}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isUser && <CheckCheck className="w-3 h-3 text-amber-200 inline-block" />}
                </div>
              </div>
            </div>
          );
        })}

        {/* 15) مؤشر "صقر بيكتب..." أثناء الانتظار في نهاية المحادثة تماماً */}
        {isSending && (
          <div className="flex items-start gap-2.5 text-right">
            <FalconMascotAvatar size="sm" fit="top" statusDot={false} className="mt-1" />
            <div className="p-3 rounded-2xl bg-white dark:bg-stone-800 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 shadow-sm rounded-tr-none">
              <span className="font-extrabold text-amber-800 dark:text-amber-300">صقر بيكتب...</span>
              <span className="inline-flex gap-1 mr-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        {isAnalyzingImage && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3 animate-pulse">
            <FalconMascotAvatar size="sm" fit="top" />
            <div className="text-right">
              <p className="font-bold">صقر الشمساوية AI يحلل كثافة الخامات والأبعاد والأسعار...</p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                مطابقة التصنيف، استنتاج ساعات التصنيع، وحساب المصنعية ودراسة السوق
              </p>
            </div>
          </div>
        )}

        {/* مرساة التمرير الدائمة في قاع الشاشة كالواتساب */}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* 16) أوامر الصقر الأربعة (Action Instruction Chips) */}
      <div className="px-3 sm:px-4 py-2 bg-stone-100/90 dark:bg-stone-950/80 border-t border-stone-200 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto text-xs flex-shrink-0">
        <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap ml-1 flex items-center gap-1">
          <Compass className="w-3 h-3 text-amber-600" />
          <span>أوامر الصقر:</span>
        </span>
        {actionChips.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage('', chip)}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-stone-300/70 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-[11px] font-bold whitespace-nowrap transition cursor-pointer shadow-2xs"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* حقل إدخال الرسائل (Chat Prompt Input) */}
      <div className="p-2.5 sm:p-3 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="رفع صورة موديل لتحليلها"
          className="p-2 rounded-xl text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
        >
          <Camera className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="اسأل صقر الشمساوية AI عن أي حرفة يدوية ..."
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />

        <button
          type="button"
          disabled={isSending || (!inputPrompt.trim() && !imagePreview)}
          onClick={() => handleSendMessage()}
          className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <Send className="w-4 h-4 transform rotate-180" />
        </button>
      </div>
    </div>
  );
};
