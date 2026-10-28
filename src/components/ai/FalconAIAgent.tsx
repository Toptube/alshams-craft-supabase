import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { FalconMascotAvatar, ArtisanAvatar } from '../brand/BrandAssets';
import { UserProfile, CraftCategory, AIVisionAnalysis, ChatMessage } from '../../types';
import { authedFetch } from '../../lib/apiClient';
import {
  Sparkles,
  Camera,
  Send,
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

export const FALCON_WELCOME_TEXT = `أهلاً بك يا فنان في الجناح الذكي لمنظومة الشمساوية! 🦅
أنا "صقر الشمساوية"، مستشارك لدراسة الأسواق وحساب التكاليف وتحليل المشغولات. ارفع صورة القطعة أو اكتب استفسارك وسأجيبك فوراً.`;

export const createInitialFalconMessage = (): ChatMessage => ({
  id: 'msg_welcome',
  sender: 'falcon',
  text: FALCON_WELCOME_TEXT,
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

async function falconFetch(url: string, init: RequestInit, timeoutMs = 35000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await authedFetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('استغرق الرد وقتاً طويلاً. تأكد من اتصال الإنترنت وحاول مجدداً.');
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        if (typeof data.remaining === 'number') {
          setDailyRemaining(data.remaining);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadDailyUsage();
  }, [loadDailyUsage]);

  const handleNewChat = () => {
    const welcome = createInitialFalconMessage();
    setMessages([welcome]);
    setInputPrompt('');
    setImagePreview(null);
    setIsAnalyzingImage(false);
    setExpandedSources({});
    try {
      localStorage.removeItem(sessionKey);
    } catch {}
    setNewChatFeedback(true);
    setTimeout(() => setNewChatFeedback(false), 2000);
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
      setIsAnalyzingImage(true);
      const { base64, mimeType } = await compressImageForAI(file);
      if (!base64) throw new Error('فشل معالجة الصورة المرفوعة.');

      setImagePreview(base64);

      setMessages((prev) => [
        ...prev,
        {
          id: 'user_img_' + Date.now(),
          sender: 'user',
          text: '📸 قمت برفع صورة قطعة مشغولات يدوية لتحليلها هندسياً ودراسة سوقها.',
          timestamp: Date.now(),
          metadata: { previewImage: base64 },
        },
      ]);

      const res = await falconFetch(
        '/api/analyze-vision',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: mimeType || 'image/jpeg',
            artistNotes: inputPrompt || '',
            activeCrafts: Array.isArray(profile.selectedCrafts) ? profile.selectedCrafts : [],
          }),
        },
        50000
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(getArabicAiError(res.status, errData.error));
      }

      const data: AIVisionAnalysis = await res.json();
      if (typeof (data as any).dailyAiRemaining === 'number') {
        setDailyRemaining((data as any).dailyAiRemaining);
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
          text: `🎯 تم تحليل القطعة بنجاح:
- التصنيف المعتمد: **${data.detectedCategory}**
- ساعات العمل المقدرة: **${data.estimatedHours} ساعة**
- المصنعية المقترحة: **${data.estimatedLaborWage} ${profile.currencySymbol || 'ج.م'}**
- أسعار السوق${pricingSuffix}: من ${data.competitionPricing?.minMarketPrice || 0} إلى ${data.competitionPricing?.maxMarketPrice || 0} ${profile.currencySymbol || 'ج.م'}`,
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
      if (e.target) e.target.value = '';
    }
  };

  const handleSendMessage = async (customText?: string, chip?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if (!textToSend && !chip) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: textToSend || `استفسار حول: ${chip}`,
      actionChip: chip,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsSending(true);

    try {
      // إرسال السجل بالتنسيق المعياري مع تقييد الحجم لمنع انقطاع السياق وتسريع الإجابة
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
            },
          }),
        },
        30000
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(getArabicAiError(res.status, errData.error));
      }

      const data = await res.json();
      if (typeof data.dailyAiRemaining === 'number') {
        setDailyRemaining(data.dailyAiRemaining);
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="px-3 py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>دردشة جديدة</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
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

      {/* شريط الرصيد اليومي */}
      <div className="px-4 py-2 bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 flex-shrink-0 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-bold text-stone-800 dark:text-stone-200">الرصيد المتبقي اليوم:</span>
          <span className="font-mono font-black text-amber-800 dark:text-amber-300">
            {dailyRemaining ?? 20} من 20 استشارة
          </span>
          {newChatFeedback && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mr-2">
              ✓ تم بدء جلسة جديدة
            </span>
          )}
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

      {/* حقل الإدخال */}
      <div className="p-2.5 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="رفع صورة لتحليلها"
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
          placeholder="اسأل صقر عن التكاليف، التسعير، أو المنافسين..."
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />

        <button
          type="button"
          disabled={isSending || !inputPrompt.trim()}
          onClick={() => handleSendMessage()}
          className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-40 cursor-pointer shadow-sm"
        >
          <Send className="w-4 h-4 transform rotate-180" />
        </button>
      </div>
    </div>
  );
};