import React, { useEffect, useRef, useState } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Database, 
  Trash2, 
  ArrowLeftRight, 
  PhoneCall, 
  ExternalLink,
} from 'lucide-react';
import { AlShamsSunIcon } from '../brand/BrandAssets';
import { authedFetch } from '../../lib/apiClient';
import type { UserProfile } from '../../types';
import { DraggableShamosa } from './DraggableShamosa';
import { tenantStorage } from '../../db/dexieDB';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';

export interface ShamousaActionLink {
  label: string;
  view: string;
}

export interface ShamousaContactAction {
  name: string;
  phone: string;
  type: 'customer' | 'supplier';
}

export interface ShamousaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  handoffToFalcon?: boolean;
  actionLink?: ShamousaActionLink;
  contactAction?: ShamousaContactAction;
}

export interface ShamousaChatWidgetProps {
  profile: UserProfile;
  onOpenFalcon: () => void;
  liftUp?: boolean;
}

// استخراج الاسم الأول المباشر دون ألقاب رسمية أو "صاحب الورشة" أو "يا فنان"
export function extractUserFirstName(rawName?: string): string {
  if (!rawName) return '';
  const cleaned = String(rawName)
    .trim()
    .replace(/^(المهندس|المهندسة|الفنان|الفنانة|الأستاذ|الأستاذة|المعلم|المدير|كابتن|دكتور|دكتورة|أ|م)\s+/gi, '');
  const first = cleaned.split(/\s+/)[0];
  return first || cleaned;
}

// الكشف الذكي عن روابط التنقل السريع عند طلب المستخدم صراحة
function detectNavigationIntent(text: string): ShamousaActionLink | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('فتح الخزن') || lower.includes('شاشة الخزينة') || lower.includes('صفحة الخزائن')) {
    return { label: 'فتح الخزائن والأرصدة', view: 'treasuries' };
  }
  if (lower.includes('فتح المخزن') || lower.includes('شاشة الخامات')) {
    return { label: 'فتح سجل الخامات والمخزون', view: 'materials' };
  }
  if (lower.includes('فتح المنتجات') || lower.includes('كتالوج المنتجات')) {
    return { label: 'فتح كتالوج المنتجات', view: 'products' };
  }
  if (lower.includes('فتح المبيعات') || lower.includes('شاشة الطلبات')) {
    return { label: 'فتح سجل المبيعات والطلبات', view: 'sales' };
  }
  if (lower.includes('سجل العملاء') || lower.includes('شاشة العملاء')) {
    return { label: 'فتح قائمة العملاء', view: 'customers' };
  }
  if (lower.includes('سجل الموردين') || lower.includes('شاشة الموردين')) {
    return { label: 'فتح قائمة الموردين', view: 'suppliers' };
  }
  if (lower.includes('التقارير المالية') || lower.includes('شاشة التقارير')) {
    return { label: 'فتح التقارير المالية', view: 'reports' };
  }
  return undefined;
}

function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-extrabold text-amber-950 dark:text-amber-200">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export const ShamousaChatWidget: React.FC<ShamousaChatWidgetProps> = ({
  profile,
  onOpenFalcon,
  liftUp = false,
}) => {
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  const storageKey = `shamousa_chat_${workshopId}`;

  // تحديد اسم الفنان الفعلي المباشر بدون ألقاب أو "صاحب الورشة"
  const firstName = extractUserFirstName(profile.fullName || profile.name || (profile as any).artistName || (profile as any).artisanName) || 'صديقي';
  const brandTitle = profile.brandName ? `ورشة ${profile.brandName}` : 'ورشة الشمس كرافت';

  // الترحيب المحدد بدقة في التعليمات:
  const welcomeMessage = `أهلاً يا ${firstName} 🌞، أنا مديرة أعمالك.اخبارك ايه! واخبار شغلنا ايه ! يارب يكون كل حاجه تمام ... تحب نبدأ إزاي النهارده؟!`;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ShamousaMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (isOpen) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, isLoading]);

  const openScreen = (view: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view } }));
    }
    setIsOpen(false);
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || isLoading) return;

    const userMsg: ShamousaMessage = { id: `u_${Date.now()}`, role: 'user', content: message };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // جلب رصيد الخزينة الحالي الفعلي من السجلات المحلية أو Supabase لربط شموسة بحالة الشاشة الرئيسية مباشرة
      let currentTreasury = 0;
      let treasuriesList: any[] = [];
      try {
        const { data: supaTreasuries } = await getTreasuryBalancesFromSupabase(workshopId);
        if (supaTreasuries && supaTreasuries.length > 0) {
          treasuriesList = supaTreasuries;
          currentTreasury = supaTreasuries.reduce((sum, t) => sum + (Number(t.balance) || 0), 0);
        } else {
          const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
          currentTreasury = (safe.mainSafe || 0) + (safe.subSafe || 0);
          treasuriesList = [
            { name: 'الخزينة الرئيسية', balance: safe.mainSafe || 0, kind: 'خزينة' },
            { name: 'الخزينة الفرعية/العهد', balance: safe.subSafe || 0, kind: 'عهدة' },
          ];
        }
      } catch {
        const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
        currentTreasury = (safe.mainSafe || 0) + (safe.subSafe || 0);
      }

      const res = await authedFetch('/api/shamousa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          artistName: firstName,
          brandName: profile.brandName || 'ورشة الشمس كرافت',
          workshopId,
          userEmail: profile.email || '',
          clientWorkshopState: {
            treasuryBalance: currentTreasury,
            treasuriesDetail: treasuriesList,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'حصل خطأ في الاتصال، حاولي تاني.');

      if (typeof data.remaining === 'number') setRemaining(data.remaining);

      // شيل زرار تحويل المستخدم لـ "صقر" من داخل ردود الخزينة والبيانات الداخلية تماماً
      const isInternalData = /خزن|خزينة|خزينه|سيول|سيولة|رصيد|عهدة|عهده|فلوس|خامات|مخزن|أوردر|اوردر|طلب|مبيعات|عميل|عملاء|مورد|موردين|موظف|عمال|دفاتر|حسابات/i.test(message + ' ' + (data.reply || ''));
      const isFalconExplicitlyRequested = /صقر|تحليل صوره|تحليل صورة|حلل الصورة|دراسة سوق|دراسة السوق|المنافسين/i.test(message);
      const shouldHandoff = !isInternalData && (Boolean(data.handoffToFalcon) || isFalconExplicitlyRequested);

      const dynamicLink = data.actionLink || detectNavigationIntent(message) || detectNavigationIntent(data.reply || '');

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          handoffToFalcon: shouldHandoff,
          actionLink: dynamicLink,
          contactAction: data.contactAction,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err?.message || 'حصل خطأ، حاولي تاني.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <DraggableShamosa onClick={() => setIsOpen(true)}>
          <div
            aria-label="افتح شموسة — مديرة أعمال الورشة"
            title="شموسة — مديرة أعمال الورشة"
            className="group relative flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-xl shadow-amber-900/30 hover:scale-105 active:scale-95 transition cursor-pointer w-14 h-14 sm:w-16 sm:h-16 border-2 border-white/60"
          >
            <span className="relative flex items-center justify-center w-7 h-7">
              <MessageCircle className="w-7 h-7 text-white drop-shadow-xs" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white ring-1 ring-emerald-600/30" />
            </span>
            <span className="absolute -bottom-1 text-[10px] font-extrabold bg-stone-900/80 px-1.5 py-0.2 rounded-full border border-amber-400/50 text-amber-200">
              شموسة
            </span>
          </div>
        </DraggableShamosa>
      )}

      {isOpen && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="شموسة مديرة أعمال الورشة"
          className="fixed bottom-4 left-4 z-[60] w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-5rem))] flex flex-col rounded-3xl overflow-hidden bg-white dark:bg-stone-900 border border-amber-300 dark:border-stone-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-l from-amber-500 via-orange-500 to-amber-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/20 p-1.5 flex-shrink-0 flex items-center justify-center">
                <AlShamsSunIcon />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-extrabold text-sm leading-tight">شموسة</p>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-medium">
                    مديرة أعمال الورشة
                  </span>
                </div>
                <p className="text-[11px] text-amber-50/90 flex items-center gap-1 truncate">
                  <Database className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{brandTitle} • {firstName}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  aria-label="مسح المحادثة"
                  title="مسح المحادثة"
                  className="p-1.5 rounded-full hover:bg-white/20 text-white/90 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق"
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3 bg-stone-50 dark:bg-stone-950"
          >
            <Bubble role="assistant">{renderText(welcomeMessage)}</Bubble>

            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                <Bubble role={m.role}>{renderText(m.content)}</Bubble>

                {/* زر التنقل المباشر يظهر فقط عند طلب شاشة بعينها */}
                {m.actionLink && (
                  <div className="flex justify-start pr-2">
                    <button
                      type="button"
                      onClick={() => openScreen(m.actionLink!.view)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700 transition shadow-2xs cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{m.actionLink.label}</span>
                    </button>
                  </div>
                )}

                {/* زر الاتصال السريع بالعميل أو المورد */}
                {m.contactAction && (
                  <div className="flex justify-start pr-2">
                    <a
                      href={`tel:${m.contactAction.phone}`}
                      className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>اتصال بـ {m.contactAction.name} ({m.contactAction.phone})</span>
                    </a>
                  </div>
                )}

                {/* زر الإحالة لـ "صقر" في المهام الخارجية وفحص الصور ودراسة السوق فقط وبشكل ثابت ومختصر */}
                {m.handoffToFalcon && (
                  <div className="flex justify-start pr-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenFalcon();
                      }}
                      className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-900 text-amber-300 border border-amber-500/40 hover:bg-stone-800 transition shadow-sm cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                      <span>استشر صقر الشمساوية 🦅</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <Bubble role="assistant">
                <span className="inline-flex gap-1.5 items-center py-1" aria-label="شموسة تبحث وتراجع">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:300ms]" />
                  <span className="text-xs text-stone-500 mr-2">شموسة تراجع دفاتر وسجلات الورشة...</span>
                </span>
              </Bubble>
            )}
          </div>

          {/* Form Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex-shrink-0"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="اسألي شموسة عن الخزنة، النواقص، تسليمات الأوردرات..."
                className="flex-1 resize-none max-h-28 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 px-3.5 py-2.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="إرسال"
                className="w-11 h-11 flex-shrink-0 rounded-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-md cursor-pointer"
              >
                <Send className="w-5 h-5 -scale-x-100" />
              </button>
            </div>
            {remaining !== null && (
              <p className="text-[10px] text-center text-stone-500 dark:text-stone-400 pt-2">
                باقي {remaining} استفسار اليوم
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
};

const Bubble: React.FC<{ role: 'user' | 'assistant'; children: React.ReactNode }> = ({
  role,
  children,
}) => (
  <div className={`flex ${role === 'user' ? 'justify-start' : 'justify-end'}`}>
    <div
      className={`max-w-[85%] whitespace-pre-wrap break-words text-sm leading-relaxed px-4 py-2.5 rounded-2xl shadow-2xs ${
        role === 'user'
          ? 'bg-amber-600 text-white rounded-br-xs'
          : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 rounded-bl-xs'
      }`}
    >
      {children}
    </div>
  </div>
);

export default ShamousaChatWidget;