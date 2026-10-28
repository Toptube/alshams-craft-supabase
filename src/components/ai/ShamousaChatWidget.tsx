import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Database, Trash2, ArrowLeftRight, Sparkles } from 'lucide-react';
import { AlShamsSunIcon } from '../brand/BrandAssets';
import { authedFetch } from '../../lib/apiClient';
import type { UserProfile } from '../../types';
import { DraggableShamosa } from './DraggableShamosa';

export interface ShamousaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  handoffToFalcon?: boolean;
}

export interface ShamousaChatWidgetProps {
  profile: UserProfile;
  onOpenFalcon: () => void;
  liftUp?: boolean;
}

const WELCOME =
  'أهلاً يا فنان، أنا شموسة 🌞\nأبحث داخل بيانات ورشتك فقط: الخامات، المنتجات، العملاء، الموردين، المبيعات، الخزن، الموظفين، والتقارير.\nلو احتجت استشارة فنية أو تحليل صور أو دراسة أسواق، هحوّلك فوراً لـ "صقر الشمساوية" 🦅';

const QUICK_ACTIONS = [
  { label: 'المخزن والخامات', view: 'materials' },
  { label: 'الخزائن والأرصدة', view: 'treasuries' },
  { label: 'المبيعات والطلبات', view: 'sales' },
  { label: 'سجل العملاء', view: 'customers' },
  { label: 'قائمة الموردين', view: 'suppliers' },
  { label: 'التقارير المالية', view: 'reports' },
  { label: 'شؤون العاملين', view: 'hr' },
];

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
      const res = await authedFetch('/api/shamousa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'حصل خطأ، حاول تاني.');
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          handoffToFalcon: Boolean(data.handoffToFalcon),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err?.message || 'حصل خطأ، حاول تاني.'}`,
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
            aria-label="افتح شموسة — مساعدة بيانات الورشة"
            title="شموسة — مساعدة بيانات الورشة"
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
          aria-label="شموسة"
          className="fixed bottom-4 left-4 z-[60] w-[min(410px,calc(100vw-2rem))] h-[min(600px,calc(100vh-5rem))] flex flex-col rounded-3xl overflow-hidden bg-white dark:bg-stone-900 border border-amber-300 dark:border-stone-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
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
                    بيانات الورشة
                  </span>
                </div>
                <p className="text-[11px] text-amber-50/90 flex items-center gap-1 truncate">
                  <Database className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">ورشة {profile.brandName || 'الفنان'}</span>
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

          {/* Messages List */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3 bg-stone-50 dark:bg-stone-950"
          >
            <Bubble role="assistant">{renderText(WELCOME)}</Bubble>

            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>انتقال سريع لقوائم الورشة:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => openScreen(action.view)}
                      className="text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 bg-white dark:bg-stone-900 hover:bg-amber-50 dark:hover:bg-stone-800 transition shadow-2xs cursor-pointer"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className="space-y-1.5">
                <Bubble role={m.role}>{renderText(m.content)}</Bubble>
                {m.handoffToFalcon && (
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenFalcon();
                      }}
                      className="inline-flex items-center gap-2 text-xs font-extrabold px-3.5 py-2 rounded-xl bg-stone-900 text-amber-300 border border-amber-500/50 hover:bg-stone-800 transition shadow-md cursor-pointer animate-pulse"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                      <span>افتح صقر الشمساوية للاستشارة الفنية والتحليل 🦅</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <Bubble role="assistant">
                <span className="inline-flex gap-1.5 items-center py-1" aria-label="شموسة تبحث">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:300ms]" />
                  <span className="text-xs text-stone-500 mr-2">جاري البحث في بيانات الورشة...</span>
                </span>
              </Bubble>
            )}
          </div>

          {/* Input Area */}
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
                placeholder="اسأل عن خامة، منتج، مورد، عميل، رصيد..."
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
