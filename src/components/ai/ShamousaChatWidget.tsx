import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  ArrowUp,
  Paperclip,
  Mic,
  MicOff,
  Database, 
  Trash2, 
  ArrowLeftRight, 
  PhoneCall, 
  ExternalLink,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
  Download,
  Plus,
  AlertCircle,
  FileText,
  User,
  Phone,
  Sparkles,
  ChevronLeft,
  ChevronDown,
} from 'lucide-react';
import { AlShamsSunIcon } from '../brand/BrandAssets';
import { authedFetch } from '../../lib/apiClient';
import type { UserProfile } from '../../types';
import { DraggableShamosa } from './DraggableShamosa';
import { tenantStorage } from '../../db/dexieDB';
import { firestoreService } from '../../db/firestoreService';
import { playTaskDoneSound, playButtonClickSound, playSuccessSound } from '../../lib/sounds';
import { dispatchArtisanNotification } from '../../lib/pushNotifications';
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

export interface SmartActionChip {
  id: string;
  label: string;
  view?: string;
  action?: 'open_agenda' | 'new_appointment' | 'open_expenses' | 'open_sales' | 'open_materials' | 'quick_purchase';
  materialPayload?: {
    materialId: string;
    materialName: string;
    unitCost?: number;
    unitName?: string;
  };
}

export interface ShamousaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  handoffToFalcon?: boolean;
  actionLink?: ShamousaActionLink;
  contactAction?: ShamousaContactAction;
  actionChips?: SmartActionChip[];
  attachmentPreview?: string;
}

export interface WorkshopAppointment {
  id: string;
  title: string;
  type: 'delivery' | 'meeting' | 'supplies';
  clientName?: string;
  clientPhone?: string;
  orderNumber?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  notes?: string;
  status: 'upcoming' | 'completed';
  createdAt: number;
}

export interface ShamousaDailyTask {
  id: string;
  title: string;
  detail: string;
  urgency: 'high' | 'normal';
  actionLabel: string;
  view?: string;
}

export interface ShamousaChatWidgetProps {
  profile: UserProfile;
  onOpenFalcon: () => void;
  liftUp?: boolean;
  isAnyModalOpen?: boolean;
}

// استخراج الاسم الأول المباشر دون ألقاب رسمية
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

// الكشف الذكي بالكلمات الدلالية وتوليد أزرار إجراء فورية بدون نصوص مكررة
export function detectKeywordActionChips(text: string): SmartActionChip[] {
  const chips: SmartActionChip[] = [];
  const lower = text.toLowerCase();

  // 1. الخزينة / الفلوس / السيولة / الكاش / المصروف
  if (/خزن|خزنة|خزينة|سيول|سيولة|فلوس|كاش|نقدية|مصروف/i.test(lower)) {
    chips.push({ id: 'chip_treasuries', label: 'فتح الخزائن والأرصدة 💰', view: 'treasuries' });
    chips.push({ id: 'chip_expenses', label: 'تسجيل مصروف وحركة نقدية 💵', action: 'open_expenses', view: 'treasuries' });
  }

  // 2. الخامات / النواقص / المخزن / التوريد
  if (/خام|خامات|نواقص|مخزن|مستلزمات|توريد|شراء/i.test(lower)) {
    chips.push({ id: 'chip_mats', label: 'جرد الخامات والمخزون 📦', view: 'materials' });
    chips.push({ id: 'chip_sups', label: 'سجل الموردين والتوريدات 🚚', view: 'suppliers' });
  }

  // 3. المبيعات / الفواتير / العملاء / الطلبيات
  if (/بيع|مبيعات|فاتورة|فواتير|عميل|عملاء|طلب|طلبية|أوردر/i.test(lower)) {
    chips.push({ id: 'chip_sales', label: 'تسجيل بيع جديد 🧾', view: 'sales' });
    chips.push({ id: 'chip_custs', label: 'سجل العملاء والحسابات 👥', view: 'customers' });
  }

  // 4. المواعيد / الأجندة / التقويم / التسليم
  if (/موعد|مواعيد|أجندة|اجندة|تقويم|تسليم|ميعاد/i.test(lower)) {
    chips.push({ id: 'chip_agenda', label: 'عرض مواعيد وأجندة الورشة 📅', action: 'open_agenda' });
    chips.push({ id: 'chip_new_appt', label: 'تسجيل موعد جديد ➕', action: 'new_appointment' });
  }

  // 5. أوامر التشغيل / التصنيع / الصنايعية
  if (/تشغيل|أمر تشغيل|تصنيع|صنايعي|حرفي|عمال|أجور/i.test(lower)) {
    chips.push({ id: 'chip_wo', label: 'سجل أوامر التشغيل 🔨', view: 'work_orders' });
    chips.push({ id: 'chip_hr', label: 'إدارة الحرفيين والعمالة 👷', view: 'hr' });
  }

  return chips;
}

// دالة إنشاء رابط تقويم جوجل بنقرة واحدة
export function createGoogleCalendarUrl(appointment: {
  title: string;
  date: string;
  time?: string;
  notes?: string;
  clientName?: string;
  clientPhone?: string;
  brandName?: string;
}): string {
  const [year, month, day] = appointment.date.split('-').map(Number);
  let startHour = 10;
  let startMinute = 0;
  if (appointment.time) {
    const [h, m] = appointment.time.split(':').map(Number);
    if (!isNaN(h)) startHour = h;
    if (!isNaN(m)) startMinute = m;
  }
  const startDate = new Date(year, (month || 1) - 1, day || 1, startHour, startMinute);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatGCalDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const text = encodeURIComponent(appointment.title || 'موعد تسليم ورشة الشمساوية');
  const dates = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;
  const details = encodeURIComponent(
    `موعد في ${appointment.brandName || 'ورشة الشمساوية'}\n` +
    (appointment.clientName ? `العميل: ${appointment.clientName}\n` : '') +
    (appointment.clientPhone ? `الهاتف: ${appointment.clientPhone}\n` : '') +
    (appointment.notes ? `ملاحظات: ${appointment.notes}\n` : '')
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}

// دالة تنزيل ملف التقويم .ics
export function downloadIcsFile(appointment: {
  id: string;
  title: string;
  date: string;
  time?: string;
  notes?: string;
  clientName?: string;
  brandName?: string;
}) {
  const [year, month, day] = appointment.date.split('-').map(Number);
  let startHour = 10;
  let startMinute = 0;
  if (appointment.time) {
    const [h, m] = appointment.time.split(':').map(Number);
    if (!isNaN(h)) startHour = h;
    if (!isNaN(m)) startMinute = m;
  }
  const startDate = new Date(year, (month || 1) - 1, day || 1, startHour, startMinute);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AlShams Handmade Workshop//AR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${appointment.id || Date.now()}@alshams.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${appointment.title}`,
    `DESCRIPTION:${(appointment.notes || '') + (appointment.clientName ? ' - العميل: ' + appointment.clientName : '')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${appointment.title || 'موعد_الشمساوية'}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  isAnyModalOpen = false,
}) => {
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  const storageKey = `shamousa_chat_${workshopId}`;
  const agendaStorageKey = `alshams_agenda_${workshopId || 'default'}`;
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tasksDoneStorageKey = `alshams_shamousa_tasks_done_${workshopId}_${todayDateStr}`;

  const firstName = extractUserFirstName((profile as any).fullName || (profile as any).name || profile.artistName || (profile as any).artisanName) || 'صديقي';
  const brandTitle = profile.brandName ? `ورشة ${profile.brandName}` : 'ورشة الشمس كرافت';

  const welcomeMessage = "أهلاً بيك يا بطل! ☀️ منورة ورشتنا..\nطمني حابب تتابع أوردراتك ولا تراجع الخزينة والمخزن؟";

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks_agenda'>('chat');

  // الاستماع لحدث فتح شموسة من أي مكان في المنظومة
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('alshams_open_shamousa', handleOpen);
    return () => window.removeEventListener('alshams_open_shamousa', handleOpen);
  }, []);
  
  // Chat messages
  const [messages, setMessages] = useState<ShamousaMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Modern Chat UX additions: Auto-expanding, Voice, Attachments
  const [pendingAttachment, setPendingAttachment] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 44), 140) + 'px';
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setVoiceNotice('المتصفح لا يدعم التسجيل الصوتي المباشر.');
        setTimeout(() => setVoiceNotice(null), 3000);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingVoice(false);

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        setIsTranscribingVoice(true);
        setVoiceNotice('⏳ جاري تفريغ الصوت وتحويله لكلام مكتوب...');

        const reader = new FileReader();
        reader.onload = async (event) => {
          const rawBase64 = event.target?.result as string;
          try {
            const res = await authedFetch('/api/ai/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: rawBase64, mimeType }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text && data.text.trim()) {
                setInput((prev) => {
                  const cleanPrev = prev.trim();
                  const newText = data.text.trim();
                  const merged = cleanPrev ? `${cleanPrev} ${newText}` : newText;
                  setTimeout(() => adjustTextareaHeight(inputRef.current), 50);
                  return merged;
                });
                setVoiceNotice('✓ تم تفريغ الصوت بنجاح');
                setTimeout(() => setVoiceNotice(null), 2000);
              } else {
                setVoiceNotice(null);
              }
            } else {
              setVoiceNotice(null);
            }
          } catch (err) {
            console.warn('Transcription error:', err);
            setVoiceNotice(null);
          } finally {
            setIsTranscribingVoice(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecordingVoice(true);
      setVoiceNotice('🔴 جاري التسجيل الصوتي... تحدث بحرية ثم انقر على الميكروفون للإيقاف والتفريغ');
    } catch (err: any) {
      console.warn('Microphone error in Shamousa:', err);
      setIsRecordingVoice(false);
      setVoiceNotice('يرجى السماح بالوصول للميكروفون للتسجيل.');
      setTimeout(() => setVoiceNotice(null), 3000);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecordingVoice(false);
  };

  const toggleVoiceRecording = () => {
    if (isRecordingVoice) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  const handleAttachmentSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPendingAttachment({ base64, mimeType: file.type || 'image/jpeg', name: file.name });
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Daily Tasks state
  const [dailyTasks, setDailyTasks] = useState<ShamousaDailyTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(tasksDoneStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Agenda Appointments state
  const [appointments, setAppointments] = useState<WorkshopAppointment[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(agendaStorageKey);
      if (raw) return JSON.parse(raw);
    } catch {}

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return [
      {
        id: 'appt_1',
        title: 'تسليم طقم معلقات مكرمية بوهيمي',
        type: 'delivery',
        clientName: 'أ. سارة عبد الرحمن',
        clientPhone: '01012345678',
        orderNumber: 'ORD-2026-14',
        date: tomorrow.toISOString().slice(0, 10),
        time: '17:00',
        notes: 'تغليف هدايا فاخر مع كارت إهداء خاص بالورشة',
        status: 'upcoming',
        createdAt: Date.now() - 86400000,
      },
    ];
  });

  // New appointment quick modal form state
  const [isNewApptFormOpen, setIsNewApptFormOpen] = useState(false);
  const [apptFormTitle, setApptFormTitle] = useState('');
  const [apptFormClient, setApptFormClient] = useState('');
  const [apptFormPhone, setApptFormPhone] = useState('');
  const [apptFormDate, setApptFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [apptFormTime, setApptFormTime] = useState('16:00');
  const [apptFormNotes, setApptFormNotes] = useState('');

  // Save appointments to storage
  const saveAppointments = (list: WorkshopAppointment[]) => {
    setAppointments(list);
    try {
      localStorage.setItem(agendaStorageKey, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('alshams_agenda_updated', { detail: list }));
    } catch {}
  };

  // Load real workshop data to generate smart daily tasks
  const loadDailyTasks = async () => {
    if (!workshopId) return;
    try {
      const tasks: ShamousaDailyTask[] = [];

      // 1. Raw materials low stock
      const rawMaterials = await tenantStorage.getRawMaterials(workshopId).catch(() => []);
      const depleting = rawMaterials.filter(
        (m: any) => (m.currentStock || 0) <= (m.minAlertThreshold || 5) && m.isActive !== false
      );
      depleting.slice(0, 2).forEach((mat: any) => {
        tasks.push({
          id: `task_mat_${mat.id}`,
          title: `الخامة "${mat.materialName}" قربت تخلص`,
          detail: `المتبقي في المخزن ${mat.currentStock || 0} ${mat.unit || 'وحدة'} فقط (حد الأمان: ${mat.minAlertThreshold || 5}). محتاجين نطلب منها توريد.`,
          urgency: 'high',
          actionLabel: 'طلب توريد خامات 🚚',
          view: 'suppliers',
        });
      });

      // 2. Open work orders
      const workOrders = await firestoreService.getWorkOrders(workshopId).catch(() => []);
      const openOrders = workOrders.filter(
        (wo: any) => wo.status !== 'completed' && wo.status !== 'delivered' && wo.status !== 'cancelled'
      );
      openOrders.slice(0, 2).forEach((wo: any) => {
        tasks.push({
          id: `task_wo_${wo.id || wo.orderNumber}`,
          title: `أمر تشغيل مفتوح: ${wo.productName || wo.orderNumber || 'مشغولة حرفية'}`,
          detail: `الكمية: ${wo.quantity || 1} · الحرفي المسؤول: ${wo.assignedArtisanName || 'قيد التعيين'} · متابعة الإنجاز والتشطيب.`,
          urgency: 'normal',
          actionLabel: 'سجل أوامر التشغيل 🔨',
          view: 'work_orders',
        });
      });

      // Routine task
      if (tasks.length === 0) {
        tasks.push({
          id: 'task_routine_check',
          title: 'مطابقة حركة الخزائن وجرد اليوم',
          detail: 'تأكد من تسجيل فواتير اليوم ومطابقة رصيد النقدية في الخزينة الرئيسية لضمان دقة الأرباح.',
          urgency: 'normal',
          actionLabel: 'فتح الخزائن 💰',
          view: 'treasuries',
        });
      }

      setDailyTasks(tasks);
    } catch (err) {
      console.warn('Failed to generate Shamousa daily tasks:', err);
    }
  };

  useEffect(() => {
    loadDailyTasks();
    const handleAgendaSync = () => {
      try {
        const raw = localStorage.getItem(agendaStorageKey);
        if (raw) setAppointments(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('alshams_agenda_updated', handleAgendaSync);
    return () => window.removeEventListener('alshams_agenda_updated', handleAgendaSync);
  }, [workshopId, agendaStorageKey]);

  // Count of pending tasks & upcoming appointments
  const pendingTasksCount = useMemo(() => {
    return dailyTasks.filter((t) => !completedTaskIds.includes(t.id)).length;
  }, [dailyTasks, completedTaskIds]);

  const upcomingApptsCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'upcoming').length;
  }, [appointments]);

  const totalPendingBadge = pendingTasksCount + upcomingApptsCount;

  // Toggle task completion
  const handleToggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const isDone = prev.includes(taskId);
      let next: string[];
      if (isDone) {
        next = prev.filter((id) => id !== taskId);
      } else {
        next = [...prev, taskId];
        playTaskDoneSound();
      }
      try {
        localStorage.setItem(tasksDoneStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Toggle appointment status
  const handleToggleAppointment = (id: string) => {
    const updated = appointments.map((a) => {
      if (a.id === id) {
        const nextStatus = a.status === 'upcoming' ? 'completed' : 'upcoming';
        if (nextStatus === 'completed') playSuccessSound();
        return { ...a, status: nextStatus as 'upcoming' | 'completed' };
      }
      return a;
    });
    saveAppointments(updated);
  };

  // Handle new appointment submission
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptFormTitle.trim()) return;

    const newAppt: WorkshopAppointment = {
      id: `appt_${Date.now()}`,
      title: apptFormTitle.trim(),
      type: 'delivery',
      clientName: apptFormClient.trim() || undefined,
      clientPhone: apptFormPhone.trim() || undefined,
      date: apptFormDate || todayDateStr,
      time: apptFormTime || '16:00',
      notes: apptFormNotes.trim() || undefined,
      status: 'upcoming',
      createdAt: Date.now(),
    };

    saveAppointments([newAppt, ...appointments]);
    playSuccessSound();

    // Reset form
    setApptFormTitle('');
    setApptFormClient('');
    setApptFormPhone('');
    setApptFormNotes('');
    setIsNewApptFormOpen(false);
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages, storageKey]);

  // فحص استباقي لمواعيد تسليم أوردرات المتجر (تنبيه قبل التسليم بيوم)
  const orderCheckDoneRef = useRef(false);
  useEffect(() => {
    if (orderCheckDoneRef.current) return;
    orderCheckDoneRef.current = true;

    const checkStoreOrdersDelivery = async () => {
      try {
        const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
        if (!tenantId) return;

        const allOrders = (await tenantStorage.getOrders(tenantId)) as any[];
        const now = Date.now();
        const oneDayMs = 86400000;

        for (const ord of allOrders) {
          if (ord.status === 'in_progress' || ord.status === 'pending') {
            const dueDateTs = (ord.dueDate || ord.deliveryDate) ? new Date(ord.dueDate || ord.deliveryDate).getTime() : 0;
            // إذا كان موعد التسليم خلال 24 ساعة أو اليوم أو متأخراً
            if (dueDateTs > 0 && (dueDateTs - now <= oneDayMs)) {
              const itemSummary = ord.items?.map((i: any) => i.productName || i.name).join(' + ') || 'مشغولات يدوية';
              const alertMsg: ShamousaMessage = {
                id: `alert_delivery_${ord.id}`,
                role: 'assistant',
                content: `🔔 تنبيه تشغيلي: معاد تسليم الأوردر رقم #${ord.orderNumber || ord.invoiceNumber || ''} باسم (${ord.customerName || 'العميل'}) قرب.. مطلوب ${itemSummary}.. جهز حالك للتسليم!`,
                actionLink: {
                  label: 'فتح تفاصيل الأوردر في متجري 🏪',
                  view: 'store',
                },
                actionChips: [
                  { id: 'chip_store', label: 'فتح أوردرات المتجر 🏪', view: 'store' },
                ],
              };

              setMessages((prev) => {
                if (prev.some((m) => m.id === alertMsg.id)) return prev;
                return [alertMsg, ...prev];
              });

              dispatchArtisanNotification(`تنبيه تشغيلي: أوردر #${ord.invoiceNumber}`, {
                body: `معاد تسليم أوردر ${ord.customerName || 'العميل'} قرب، جهز المشغولة للتسليم!`,
                tag: `delivery-${ord.id}`,
              });
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Error checking orders delivery in Shamousa:', err);
      }
    };

    // فحص استباقي لنواقص الخامات في المخزن
    const checkLowMaterialsStock = async () => {
      try {
        const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
        if (!tenantId) return;

        const rawMaterials = (await tenantStorage.getRawMaterials(tenantId).catch(() => [])) as any[];
        const depleting = rawMaterials.filter((m: any) => {
          const stock = Number(m.currentStock ?? m.quantity ?? 0);
          const minThreshold = Number(m.minAlertThreshold ?? m.min_quantity ?? m.minimumStock ?? 2);
          return stock <= minThreshold && m.isActive !== false;
        });

        if (depleting.length > 0) {
          const target = depleting[0];
          const stock = Number(target.currentStock ?? target.quantity ?? 0);
          const matName = target.materialName || target.name || 'خامة أساسية';
          const unit = target.unit || 'وحدة';
          const alertId = `alert_low_stock_${target.id || matName}`;

          const alertMsg: ShamousaMessage = {
            id: alertId,
            role: 'assistant',
            content: `⚠️ يا فنان، رصيد خامة [${matName}] قرب يخلص ومتبقي منه [${stock} ${unit}] بس!`,
            actionChips: [
              {
                id: `chip_buy_${target.id}`,
                label: 'طلب توريد سريع 🛒',
                action: 'quick_purchase',
                materialPayload: {
                  materialId: target.id,
                  materialName: matName,
                  unitCost: Number(target.costPrice || target.unitPrice || 0),
                  unitName: unit,
                },
              },
              { id: 'chip_mats', label: 'المخزن وإدارة الخامات 🧶', view: 'materials' },
            ],
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === alertId)) return prev;
            return [alertMsg, ...prev];
          });
        }
      } catch (err) {
        console.warn('Error checking materials stock in Shamousa:', err);
      }
    };

    checkStoreOrdersDelivery();
    checkLowMaterialsStock();
  }, [profile.tenantId, profile.workshopId, profile.id]);

  useEffect(() => {
    if (isOpen) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, isLoading, activeTab]);

  const openScreen = (view: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view } }));
    }
    setIsOpen(false);
  };

  const handleActionChipClick = (chip: SmartActionChip) => {
    if (chip.action === 'quick_purchase' && chip.materialPayload) {
      window.dispatchEvent(new CustomEvent('alshams_quick_purchase', { detail: chip.materialPayload }));
      setIsOpen(false);
      return;
    }
    if (chip.action === 'open_agenda') {
      setActiveTab('tasks_agenda');
      return;
    }
    if (chip.action === 'new_appointment') {
      setActiveTab('tasks_agenda');
      setIsNewApptFormOpen(true);
      return;
    }
    if (chip.view) {
      openScreen(chip.view);
    }
  };

  const send = async (text: string) => {
    if (isRecordingVoice) {
      stopVoiceRecording();
    }
    let message = text.trim();
    const currentAttachment = pendingAttachment;
    if (pendingAttachment) {
      setPendingAttachment(null);
    }
    if (!message && !currentAttachment) return;
    if (isLoading) return;

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const detectedChips = detectKeywordActionChips(message);
    const userMsg: ShamousaMessage = { 
      id: `u_${Date.now()}`, 
      role: 'user', 
      content: message || (currentAttachment ? `📸 [صورة مرفقة: ${currentAttachment.name}]` : ''),
      actionChips: detectedChips.length > 0 ? detectedChips : undefined,
      attachmentPreview: currentAttachment ? currentAttachment.base64 : undefined,
    };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let currentTreasury = 0;
      let treasuriesList: any[] = [];
      try {
        const { data: supaTreasuries } = await getTreasuryBalancesFromSupabase(workshopId);
        if (supaTreasuries && supaTreasuries.length > 0) {
          treasuriesList = supaTreasuries;
          currentTreasury = supaTreasuries.reduce((sum: number, t: any) => sum + (Number(t.balance) || 0), 0);
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

      // جمع سياق الورشة الفعلي المباشر: الخامات الناقصة، أوامر التشغيل، والطلبيات
      let lowMaterialsList: string[] = [];
      let openWorkOrdersList: string[] = [];
      let pendingOrdersCount = 0;

      try {
        const [mats, wOrders, ords] = await Promise.all([
          tenantStorage.getRawMaterials(workshopId).catch(() => []),
          tenantStorage.getWorkOrders(workshopId).catch(() => []),
          tenantStorage.getOrders(workshopId).catch(() => []),
        ]);

        const lowMats = (mats || []).filter(
          (m) => (Number(m.currentStock) || 0) <= (Number(m.minAlertThreshold) || 5)
        );
        lowMaterialsList = lowMats.map(
          (m) => `${m.materialName} (الرصيد: ${m.currentStock} ${m.unit || 'وحدة'} - حد الأمان: ${m.minAlertThreshold || 5})`
        );

        const openOrders = (wOrders || []).filter(
          (w) => w.status === 'open' || w.status === 'in_progress'
        );
        openWorkOrdersList = openOrders.map(
          (w) => `#${w.orderNumber}: "${w.productName}" (${w.status === 'in_progress' ? 'قيد التصنيع' : 'بانتظار الصرف'} - الصانع: ${w.assignedEmployeeName || 'حرفي'})`
        );

        pendingOrdersCount = (ords || []).filter(
          (o) => o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled'
        ).length;
      } catch (ctxErr) {
        console.warn('Live context fetch warning:', ctxErr);
      }

      const res = await authedFetch('/api/shamousa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || 'يرجى فحص وتحليل الصورة المرفقة واستخراج تفاصيلها',
          images: currentAttachment ? [{
            base64: currentAttachment.base64,
            mimeType: currentAttachment.mimeType,
            name: currentAttachment.name,
          }] : [],
          history,
          artistName: firstName,
          brandName: profile.brandName || 'ورشة الشمس كرافت',
          workshopId,
          userEmail: profile.email || '',
          clientWorkshopState: {
            treasuryBalance: currentTreasury,
            treasuriesDetail: treasuriesList,
            lowMaterialsCount: lowMaterialsList.length,
            lowMaterialsList,
            openWorkOrdersCount: openWorkOrdersList.length,
            openWorkOrdersList,
            pendingOrdersCount,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'حصل خطأ في الاتصال، حاولي تاني.');

      if (typeof data.remaining === 'number') setRemaining(data.remaining);

      const isInternalData = /خزن|خزينة|خزينه|سيول|سيولة|رصيد|عهدة|عهده|فلوس|خامات|مخزن|أوردر|اوردر|طلب|مبيعات|عميل|عملاء|مورد|موردين|موظف|عمال|دفاتر|حسابات/i.test(message + ' ' + (data.reply || ''));
      const isFalconExplicitlyRequested = /صقر|تحليل صوره|تحليل صورة|حلل الصورة|دراسة سوق|دراسة السوق|المنافسين/i.test(message);
      const shouldHandoff = !isInternalData && (Boolean(data.handoffToFalcon) || isFalconExplicitlyRequested);

      const dynamicLink = data.actionLink || detectNavigationIntent(message) || detectNavigationIntent(data.reply || '');
      const replyChips = detectKeywordActionChips(data.reply || message);

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          handoffToFalcon: shouldHandoff,
          actionLink: dynamicLink,
          contactAction: data.contactAction,
          actionChips: replyChips.length > 0 ? replyChips : undefined,
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
      {/* Floating launcher mascot with transparent PNG silhouette */}
      {!isOpen && (
        <DraggableShamosa onClick={() => setIsOpen(true)}>
          <div
            aria-label="افتح شموسة — مديرة أعمال الورشة"
            title="شموسة — مديرة أعمال الورشة (اسحبي في أي مكان على الشاشة)"
            className={`group relative flex flex-col items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 select-none ${
              isAnyModalOpen ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 scale-100'
            }`}
          >
            {/* Mascot Image - Transparent PNG without any background container box */}
            <div className="relative w-16 h-20 sm:w-20 sm:h-24 flex items-center justify-center">
              <img
                src="/shamousa_mascot.png"
                alt="شموسة — مديرة أعمال الورشة"
                draggable={false}
                className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] select-none pointer-events-none group-hover:brightness-105 transition-all"
              />
              {/* نقطة الاتصال والنشاط الأخضر */}
              <span className="absolute top-1 right-2 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#060B18] shadow-md z-10" />

              {/* شارة رقمية (Badge) توضح عدد التوجيهات أو المواعيد المستحقة */}
              {totalPendingBadge > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-600 border-2 border-white text-white font-mono text-[11px] font-black flex items-center justify-center shadow-md animate-pulse z-20">
                  {totalPendingBadge}
                </span>
              )}
            </div>

            {/* الاسم اللطيف أسفل الشخصية مباشرة بدون حجب التفاصيل */}
            <span className="-mt-1 px-2.5 py-0.5 rounded-full bg-[#060B18]/90 text-amber-300 border border-amber-500/40 text-[10px] font-black shadow-lg backdrop-blur-xs select-none">
              شموسة
            </span>
          </div>
        </DraggableShamosa>
      )}

      {/* Main Shamousa Popup Window */}
      {isOpen && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="شموسة مديرة أعمال الورشة"
          className="fixed bottom-4 left-4 z-[60] w-[min(440px,calc(100vw-2rem))] h-[min(650px,calc(100vh-5rem))] flex flex-col rounded-3xl overflow-hidden bg-white dark:bg-stone-900 border border-amber-300 dark:border-stone-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-l from-amber-500 via-orange-500 to-amber-600 text-white flex-shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/80 bg-gradient-to-tr from-amber-400 to-orange-400 flex-shrink-0 flex items-center justify-center shadow-xs">
                <img
                  src="/shamousa_mascot.png"
                  alt="شموسة مديرة أعمال الورشة"
                  className="w-full h-full object-cover object-top scale-125 select-none"
                />
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
              {messages.length > 0 && activeTab === 'chat' && (
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

          {/* Navigation Tabs Header: شات شموسة + المهام والأجندة */}
          <div className="flex items-center border-b border-stone-200 dark:border-stone-800 bg-amber-50/50 dark:bg-stone-850 px-3 py-1.5 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setActiveTab('chat');
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 shadow-2xs border border-amber-300/80 dark:border-amber-800'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>المحادثة الذكية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setActiveTab('tasks_agenda');
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 relative ${
                activeTab === 'tasks_agenda'
                  ? 'bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 shadow-2xs border border-amber-300/80 dark:border-amber-800'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>المهام والأجندة</span>
              {totalPendingBadge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold leading-none">
                  {totalPendingBadge}
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Chat View */}
          {activeTab === 'chat' && (
            <>
              {/* Messages Container */}
              <div
                ref={listRef}
                className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 bg-stone-50 dark:bg-stone-950"
              >
                <Bubble role="assistant">{renderText(welcomeMessage)}</Bubble>

                {messages.map((m) => (
                  <div key={m.id} className="space-y-1.5">
                    <Bubble role={m.role}>
                      {m.attachmentPreview && (
                        <div className="mb-2 overflow-hidden rounded-xl border border-amber-300/60 max-w-[220px] shadow-xs">
                          <img src={m.attachmentPreview} alt="مرفق" className="w-full h-auto max-h-44 object-cover" />
                        </div>
                      )}
                      {renderText(m.content)}
                    </Bubble>

                    {/* أزرار الإجراءات السريعة بالكلمات الدلالية */}
                    {m.actionChips && m.actionChips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                        {m.actionChips.map((chip) => (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => handleActionChipClick(chip)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-100/80 hover:bg-amber-200 text-amber-950 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800 transition shadow-2xs cursor-pointer active:scale-95"
                          >
                            <span>{chip.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* زر التنقل المباشر يظهر فقط عند طلب شاشة بعينها */}
                    {m.actionLink && (
                      <div className="flex justify-start pr-2">
                        <button
                          type="button"
                          onClick={() => openScreen(m.actionLink!.view)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700 transition shadow-2xs cursor-pointer active:scale-95"
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

                    {/* زر الإحالة لـ "صقر" في المهام الخارجية وفحص الصور ودراسة السوق فقط */}
                    {m.handoffToFalcon && (
                      <div className="flex justify-start pr-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onOpenFalcon();
                          }}
                          className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-900 text-amber-300 border border-amber-500/40 hover:bg-stone-800 transition shadow-sm cursor-pointer active:scale-95"
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
                      <span className="text-xs text-stone-500 mr-2 font-bold">شموسة تراجع دفاتر وسجلات الورشة...</span>
                    </span>
                  </Bubble>
                )}
              </div>

              {/* معاينة المرفق قيد الإرسال */}
              {pendingAttachment && (
                <div className="px-3 py-2 bg-amber-500/10 dark:bg-amber-950/40 border-t border-amber-300/60 dark:border-amber-700/40 flex items-center justify-between gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={pendingAttachment.base64}
                      alt="مرفق"
                      className="w-9 h-9 rounded-xl object-cover border border-amber-400 shrink-0"
                    />
                    <div className="min-w-0 text-right">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block truncate max-w-[180px]">
                        {pendingAttachment.name || 'مستند / صورة'}
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold">
                        مرفق لسؤال أو معاملة الخزينة
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

              {/* شريط حالة التسجيل الصوتي والتفريغ في شموسة */}
              {(isRecordingVoice || isTranscribingVoice || voiceNotice) && (
                <div className={`px-3 py-1.5 border-t flex items-center justify-between text-xs flex-shrink-0 transition-all ${
                  isRecordingVoice
                    ? 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300 animate-pulse'
                    : isTranscribingVoice
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {isRecordingVoice && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />}
                    <span className="font-bold">{voiceNotice || (isRecordingVoice ? 'شموسة تسجل صوتك.. تحدثي بحرية ثم انقري الميكروفون للإيقاف' : '')}</span>
                  </div>
                  {isRecordingVoice && (
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="text-[11px] font-black px-2 py-0.5 rounded-md bg-red-600 text-white cursor-pointer hover:bg-red-700 shadow-xs"
                    >
                      إيقاف وتفريغ
                    </button>
                  )}
                </div>
              )}

              {/* Chat Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="p-2.5 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex-shrink-0"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf"
                  onChange={handleAttachmentSelected}
                  className="hidden"
                />

                <div className="flex items-end gap-1.5">
                  {/* زر المرفقات 📎 */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="إرفاق فاتورة، إيصال، أو صورة خامة"
                    className="p-2.5 rounded-2xl text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer shrink-0"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* زر التسجيل الصوتي 🎙️ */}
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    title={isRecordingVoice ? 'إيقاف التسجيل الصوتي وتفريغه' : 'تسجيل سؤال بصوتك'}
                    className={`p-2.5 rounded-2xl transition cursor-pointer shrink-0 ${
                      isRecordingVoice
                        ? 'bg-red-500 text-white shadow-md animate-pulse ring-2 ring-red-300'
                        : isTranscribingVoice
                        ? 'bg-amber-500 text-white animate-spin'
                        : 'text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {isRecordingVoice ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* مربع النص المتمدد تلقائياً للأعلى مع دعم Scroll و Enter لسطر جديد */}
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        adjustTextareaHeight(e.target);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            send(input);
                          }
                          // الضغط العادي على Enter ينزل سطراً جديداً لكتابة أفكار جديدة
                        }
                      }}
                      rows={1}
                      maxLength={1000}
                      placeholder="اسألي شموسة عن الخزنة، النواقص، الأوردرات... (Enter لسطر جديد)"
                      className="w-full resize-none max-h-36 overflow-y-auto px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                    />
                  </div>

                  {/* زر الإرسال مع سهم متجه للأعلى ⬆️ */}
                  <button
                    type="submit"
                    disabled={(!input.trim() && !pendingAttachment) || isLoading}
                    aria-label="إرسال"
                    title="إرسال (Ctrl+Enter)"
                    className="w-10 h-10 flex-shrink-0 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-md active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {remaining !== null && (
                  <p className="text-[10px] text-center text-stone-500 dark:text-stone-400 pt-1.5 font-bold">
                    باقي {remaining} استفسار اليوم
                  </p>
                )}
              </form>
            </>
          )}

          {/* Tab 2: Daily Tasks & Delivery Agenda View */}
          {activeTab === 'tasks_agenda' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50 dark:bg-stone-950">
              {/* قسم 1: توجيهات ومهام اليوم من شموسة 🌞 */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/90 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌞</span>
                    <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100">
                      توجيهات ومهام اليوم من شموسة
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold">
                    {completedTaskIds.filter((id) => dailyTasks.some((t) => t.id === id)).length} / {dailyTasks.length} منجز
                  </span>
                </div>

                <div className="space-y-2">
                  {dailyTasks.map((task) => {
                    const isDone = completedTaskIds.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                          isDone
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40 opacity-70'
                            : task.urgency === 'high'
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                            : 'bg-stone-50/80 dark:bg-stone-850 border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all cursor-pointer mt-0.5 active:scale-90 ${
                              isDone
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                                : 'bg-white dark:bg-stone-800 text-stone-300 hover:text-emerald-600 border-stone-300 dark:border-stone-700 hover:border-emerald-500'
                            }`}
                            title={isDone ? 'إلغاء الإنجاز' : 'تم الإنجاز بنجاح (✔️)'}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-xs font-black transition-all ${
                                  isDone
                                    ? 'line-through text-stone-400 dark:text-stone-500'
                                    : 'text-stone-900 dark:text-stone-100'
                                }`}
                              >
                                {task.title}
                              </span>
                              {task.urgency === 'high' && !isDone && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                                  عاجل
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11px] mt-0.5 transition-all ${
                                isDone
                                  ? 'line-through text-stone-400 dark:text-stone-600'
                                  : 'text-stone-600 dark:text-stone-400'
                              }`}
                            >
                              {task.detail}
                            </p>
                          </div>
                        </div>

                        {task.view && !isDone && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => openScreen(task.view!)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800 text-[11px] font-black transition cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span>{task.actionLabel}</span>
                              <ChevronLeft className="w-3 h-3 text-amber-600" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* قسم 2: مواعيد وأجندة تسليم الطلبيات والربط مع تقويم جوجل 📅 */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100">
                      مواعيد وأجندة الورشة
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playButtonClickSound();
                      setIsNewApptFormOpen(!isNewApptFormOpen);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>موعد جديد</span>
                  </button>
                </div>

                {/* New Appointment inline form */}
                {isNewApptFormOpen && (
                  <form
                    onSubmit={handleCreateAppointment}
                    className="p-3 rounded-xl bg-amber-50/60 dark:bg-stone-850 border border-amber-300/80 dark:border-amber-800/80 space-y-2.5 animate-in fade-in duration-200"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-amber-200/50 dark:border-stone-800">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                        تسجيل موعد أو تسليم جديد 📅
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNewApptFormOpen(false)}
                        className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={apptFormTitle}
                        onChange={(e) => setApptFormTitle(e.target.value)}
                        placeholder="عنوان الموعد أو المشغولة (مثلاً: تسليم طقم صواني رخام)"
                        required
                        className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-bold"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={apptFormClient}
                          onChange={(e) => setApptFormClient(e.target.value)}
                          placeholder="اسم العميل (اختياري)"
                          className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-bold"
                        />
                        <input
                          type="tel"
                          value={apptFormPhone}
                          onChange={(e) => setApptFormPhone(e.target.value)}
                          placeholder="هاتف العميل"
                          className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-bold font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-stone-500 block mb-0.5">التاريخ</label>
                          <input
                            type="date"
                            value={apptFormDate}
                            onChange={(e) => setApptFormDate(e.target.value)}
                            required
                            className="w-full text-xs p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-stone-500 block mb-0.5">الساعة</label>
                          <input
                            type="time"
                            value={apptFormTime}
                            onChange={(e) => setApptFormTime(e.target.value)}
                            className="w-full text-xs p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono"
                          />
                        </div>
                      </div>

                      <input
                        type="text"
                        value={apptFormNotes}
                        onChange={(e) => setApptFormNotes(e.target.value)}
                        placeholder="ملاحظات التسليم (مثال: تغليف هدايا)"
                        className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsNewApptFormOpen(false)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 dark:text-stone-400 text-xs font-bold"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95"
                      >
                        حفظ الموعد
                      </button>
                    </div>
                  </form>
                )}

                {/* Appointments List */}
                <div className="space-y-2.5">
                  {appointments.length === 0 ? (
                    <div className="text-center py-4 text-xs text-stone-500 dark:text-stone-400">
                      لا توجد مواعيد تسليم مسجلة حالياً. اضغط "موعد جديد" لتسجيل موعد تسليم للعميل.
                    </div>
                  ) : (
                    appointments.map((appt) => {
                      const isDone = appt.status === 'completed';
                      const gcalUrl = createGoogleCalendarUrl({
                        title: appt.title,
                        date: appt.date,
                        time: appt.time,
                        notes: appt.notes,
                        clientName: appt.clientName,
                        clientPhone: appt.clientPhone,
                        brandName: profile.brandName,
                      });

                      return (
                        <div
                          key={appt.id}
                          className={`p-3 rounded-2xl border transition-all space-y-2 ${
                            isDone
                              ? 'bg-stone-100/50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 opacity-70'
                              : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4
                                className={`text-xs font-black ${
                                  isDone
                                    ? 'line-through text-stone-400 dark:text-stone-500'
                                    : 'text-stone-900 dark:text-stone-100'
                                }`}
                              >
                                {appt.title}
                              </h4>
                              {appt.clientName && (
                                <p className="text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                                  <User className="w-3 h-3 text-stone-400" />
                                  <span>{appt.clientName}</span>
                                  {appt.clientPhone && (
                                    <span className="font-mono text-stone-500 mr-1">({appt.clientPhone})</span>
                                  )}
                                </p>
                              )}
                            </div>

                            <div className="text-left shrink-0">
                              <span className="text-[11px] font-mono font-black text-amber-700 dark:text-amber-400 block">
                                {appt.date}
                              </span>
                              {appt.time && (
                                <span className="text-[10px] font-mono text-stone-500 block">
                                  {appt.time}
                                </span>
                              )}
                            </div>
                          </div>

                          {appt.notes && (
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-900/60 p-1.5 rounded-lg border border-stone-200/50 dark:border-stone-800">
                              {appt.notes}
                            </p>
                          )}

                          {/* أزرار تقويم جوجل وتنزيل .ics والإنجاز */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-stone-100 dark:border-stone-800">
                            <div className="flex items-center gap-1.5">
                              {/* حفظ في تقويم جوجل 📅 */}
                              <a
                                href={gcalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition cursor-pointer"
                                title="حفظ الموعد في تقويم جوجل"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>تقويم جوجل 📅</span>
                              </a>

                              {/* تحميل ملف التقويم .ics */}
                              <button
                                type="button"
                                onClick={() =>
                                  downloadIcsFile({
                                    id: appt.id,
                                    title: appt.title,
                                    date: appt.date,
                                    time: appt.time,
                                    notes: appt.notes,
                                    clientName: appt.clientName,
                                    brandName: profile.brandName,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 transition cursor-pointer"
                                title="تحميل ملف التقويم للأجهزة والهواتف (.ics)"
                              >
                                <Download className="w-3 h-3 text-stone-500" />
                                <span>ملف .ics</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleAppointment(appt.id)}
                              className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition cursor-pointer active:scale-95 ${
                                isDone
                                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                              }`}
                            >
                              {isDone ? 'تم التسليم ✔️' : 'تأكيد التسليم'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

const Bubble: React.FC<{ role: 'user' | 'assistant'; children: React.ReactNode }> = ({
  role,
  children,
}) => (
  <div className={`flex items-end gap-2 ${role === 'user' ? 'justify-start' : 'justify-end'}`}>
    {role === 'assistant' && (
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-amber-400 bg-amber-500/20 shadow-2xs">
        <img
          src="/shamousa_mascot.png"
          alt="شموسة"
          className="w-full h-full object-cover object-top scale-125 select-none"
        />
      </div>
    )}
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