import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Database, Trash2, ArrowLeftRight, Sparkles } from 'lucide-react';
import { AlShamsSunIcon } from '../brand/BrandAssets';
import { authedFetch } from '../../lib/apiClient';
import type { UserProfile } from '../../types';
import { DraggableShamosa } from './DraggableShamosa';

interface ShamousaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  handoffToFalcon?: boolean;
}

interface ShamousaChatWidgetProps {
  profile: UserProfile;
  onOpenFalcon: () => void;
  liftUp?: boolean;
}

const WELCOME =
  'أهلاً يا فنان، أنا شموسة 🌞\nأبحث داخل بيانات ورشتك فقط: الخامات، المنتجات، العملاء، الموردين، المبيعات، الخزن، الموظفين، والتقارير.\nلو احتجت شيئاً من هذه القوائم، أقدر أظهر لك زرًّا مباشرًا للانتقال إلى الصفحة الصحيحة.';

const QUICK_ACTIONS = [
  { label: 'المخزن', view: 'materials' },
  { label: 'الخزن', view: 'treasuries' },
  { label: 'المبيعات', view: 'sales' },
  { label: 'العملاء', view: 'customers' },
  { label: 'الموردين', view: 'suppliers' },
  { label: 'التقارير', view: 'reports' },
  { label: 'الموظفين', view: 'hr' },
];

function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

export const ShamousaChatWidget: React.FC<ShamousaChatWidgetProps> = ({ profile, onOpenFalcon, liftUp = false }) => {
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
        { id: `a_${Date.now()}`, role: 'assistant', content: data.reply, handoffToFalcon: Boolean(data.handoffToFalcon) },
      ]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { id: `e_${Date.now()}`, role: 'assistant', content: `⚠️ ${err?.message || 'حصل خطأ، حاول تاني.'}` }]);
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
            className={`group flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-900/30 hover:scale-105 active:scale-95 transition cursor-pointer ${liftUp ? 'w-16 h-16' : 'w-16 h-16'}`}
            style={{ width: 64, height: 64 }}
          >
            <span className="relative flex items-center justify-center w-7 h-7">
              <MessageCircle className="w-7 h-7" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
            </span>
          </div>
        </DraggableShamosa>
      )}

      {isOpen && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="شموسة"
          className="fixed bottom-4 left-4 z-[60] w-[min(390px,calc(100vw-2rem))] h-[min(580px,calc(100vh-6rem))] flex flex-col rounded-3xl overflow-hidden bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-l from-amber-500 to-orange-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/20 p-1.5 flex-shrink-0">
                <AlShamsSunIcon />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-sm leading-tight">شموسة</p>
                <p className="text-[11px] text-amber-50/90 flex items-center gap-1 truncate">
                  <Database className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">مساعدة بيانات ورشة {profile.brandName}</span>
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
                  className="p-2 rounded-full hover:bg-white/15 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق"
                className="p-2 rounded-full hover:bg-white/15 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-stone-50 dark:bg-stone-950">
            <Bubble role="assistant">{renderText(WELCOME)}</Bubble>

            {messages.length === 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>صفحات سريعة</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => openScreen(action.view)}
                      className="text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-white dark:bg-stone-900 hover:bg-amber-50 dark:hover:bg-stone-800 transition cursor-pointer"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id}>
                <Bubble role={m.role}>{renderText(m.content)}</Bubble>
                {m.handoffToFalcon && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenFalcon();
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-900 text-amber-300 border border-amber-500/40 hover:bg-stone-800 transition cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    افتح صقر الشمساوية
                  </button>
                )}
              </div>
            ))}

            {isLoading && (
              <Bubble role="assistant">
                <span className="inline-flex gap-1 items-center" aria-label="شموسة بتدوّر">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:300ms]" />
                </span>
              </Bubble>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 p-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex-shrink-0"
          >
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
              placeholder="اسأل عن خاماتك أو منتجاتك أو خزنك..."
              className="flex-1 resize-none max-h-28 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="إرسال"
              className="w-11 h-11 flex-shrink-0 rounded-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition cursor-pointer"
            >
              <Send className="w-5 h-5 -scale-x-100" />
            </button>
          </form>
          {remaining !== null && (
            <p className="text-[10px] text-center text-stone-500 dark:text-stone-400 pb-2 bg-white dark:bg-stone-900">
              باقي {remaining} رسالة النهارده
            </p>
          )}
        </div>
      )}
    </>
  );
};

const Bubble: React.FC<{ role: 'user' | 'assistant'; children: React.ReactNode }> = ({ role, children }) => (
  <div className={`flex ${role === 'user' ? 'justify-start' : 'justify-end'}`}>
    <div
      className={`max-w-[85%] whitespace-pre-wrap break-words text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl shadow-xs ${
        role === 'user'
          ? 'bg-amber-600 text-white rounded-br-md'
          : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 rounded-bl-md'
      }`}
    >
      {children}
    </div>
  </div>
);

export default ShamousaChatWidget;

