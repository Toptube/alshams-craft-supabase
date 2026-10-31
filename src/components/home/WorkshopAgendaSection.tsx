import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  User,
  Phone,
  FileText,
  X,
  Share2,
  Download,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { playSuccessSound, playButtonClickSound } from '../../lib/sounds';

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

interface WorkshopAgendaSectionProps {
  workshopId: string;
  brandName?: string;
  onOpenModalStateChange?: (isOpen: boolean) => void;
}

export const WorkshopAgendaSection: React.FC<WorkshopAgendaSectionProps> = ({
  workshopId,
  brandName = 'ورشتنا',
  onOpenModalStateChange,
}) => {
  const storageKey = `alshams_agenda_${workshopId || 'default'}`;

  // Initial Seed Appointments if first time
  const [appointments, setAppointments] = useState<WorkshopAppointment[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}

    // Default friendly appointments
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const inThreeDays = new Date(today);
    inThreeDays.setDate(today.getDate() + 3);

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
      {
        id: 'appt_2',
        title: 'جلسة اتفاق وتحديد ألوان مفرش كروشيه كبير',
        type: 'meeting',
        clientName: 'م. ندى إبراهيم',
        clientPhone: '01234567890',
        date: inThreeDays.toISOString().slice(0, 10),
        time: '14:30',
        notes: 'إحضار عينات خيوط الغزل القطني التركي للمعاينة',
        status: 'upcoming',
        createdAt: Date.now() - 43200000,
      },
    ];
  });

  const [filterTab, setFilterTab] = useState<'upcoming' | 'today' | 'all'>('upcoming');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State for new appointment
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'delivery' | 'meeting' | 'supplies'>('delivery');
  const [formClientName, setFormClientName] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState('16:00');
  const [formNotes, setFormNotes] = useState('');

  // Persist appointments to localStorage
  const saveAppointments = (newList: WorkshopAppointment[]) => {
    setAppointments(newList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
    } catch {}
  };

  useEffect(() => {
    onOpenModalStateChange?.(isAddModalOpen);
  }, [isAddModalOpen, onOpenModalStateChange]);

  // Today Date Strings
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((appt) => {
        if (filterTab === 'upcoming') {
          return appt.status === 'upcoming';
        }
        if (filterTab === 'today') {
          return appt.date === todayStr;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by date ascending
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [appointments, filterTab, todayStr]);

  // Urgency indicator calculation
  const getUrgencyBadge = (dateStr: string, status: string) => {
    if (status === 'completed') {
      return {
        label: 'تم التسليم بنجاح ✔️',
        className: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      };
    }

    if (dateStr === todayStr) {
      return {
        label: 'موعد اليوم! ⚠️',
        className: 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse',
      };
    }

    const todayObj = new Date(todayStr);
    const targetObj = new Date(dateStr);
    const diffTime = targetObj.getTime() - todayObj.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return {
        label: 'موعد غداً ⏰',
        className: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      };
    }
    if (diffDays > 1 && diffDays <= 3) {
      return {
        label: `متبقي ${diffDays} أيام`,
        className: 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
      };
    }
    if (diffDays < 0) {
      return {
        label: `فات الموعد (${Math.abs(diffDays)} يوم)`,
        className: 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700',
      };
    }

    return {
      label: `خلال ${diffDays} يوم`,
      className: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700',
    };
  };

  // Toggle Completed
  const handleToggleCompleted = (id: string) => {
    playSuccessSound();
    const updated = appointments.map((a) => {
      if (a.id === id) {
        return {
          ...a,
          status: a.status === 'completed' ? ('upcoming' as const) : ('completed' as const),
        };
      }
      return a;
    });
    saveAppointments(updated);
  };

  // Delete Appointment
  const handleDeleteAppointment = (id: string) => {
    playButtonClickSound();
    const updated = appointments.filter((a) => a.id !== id);
    saveAppointments(updated);
  };

  // Generate Google Calendar Link
  const handleOpenGoogleCalendar = (appt: WorkshopAppointment) => {
    playButtonClickSound();
    const typeLabel =
      appt.type === 'delivery'
        ? 'تسليم مشغولة'
        : appt.type === 'meeting'
        ? 'مقابلة واتفاق'
        : 'استلام خامات';

    const title = encodeURIComponent(`${typeLabel}: ${appt.title} - (${brandName})`);
    const details = encodeURIComponent(
      `الجهة/العميل: ${appt.clientName || 'غير محدد'}\nرقم الهاتف: ${
        appt.clientPhone || 'غير متوفر'
      }\nملاحظات: ${appt.notes || 'تسليم موعد ورشة'}\nالمصدر: منظومة الشمساوية لإدارة الورش`
    );

    let startIso = '';
    let endIso = '';
    if (appt.date) {
      const cleanDate = appt.date.replace(/-/g, '');
      if (appt.time) {
        const [h, m] = appt.time.split(':');
        const startHour = (h || '12').padStart(2, '0');
        const startMin = (m || '00').padStart(2, '0');
        startIso = `${cleanDate}T${startHour}${startMin}00`;
        const endHour = String(Math.min(23, Number(h || '12') + 1)).padStart(2, '0');
        endIso = `${cleanDate}T${endHour}${startMin}00`;
      } else {
        startIso = `${cleanDate}`;
        endIso = `${cleanDate}`;
      }
    }

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startIso}/${endIso}`;
    window.open(gcalUrl, '_blank', 'noopener,noreferrer');
  };

  // Generate .ICS File (Offline Native Calendar sync)
  const handleDownloadIcs = (appt: WorkshopAppointment) => {
    playButtonClickSound();
    const cleanDate = appt.date.replace(/-/g, '');
    let dtStart = cleanDate;
    let dtEnd = cleanDate;
    if (appt.time) {
      const [h, m] = appt.time.split(':');
      const startHour = (h || '12').padStart(2, '0');
      const startMin = (m || '00').padStart(2, '0');
      dtStart = `${cleanDate}T${startHour}${startMin}00`;
      const endHour = String(Math.min(23, Number(h || '12') + 1)).padStart(2, '0');
      dtEnd = `${cleanDate}T${endHour}${startMin}00`;
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AlShams Craft Workshop//Agenda 2026//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `SUMMARY:${appt.title} (${brandName})`,
      `DESCRIPTION:العميل: ${appt.clientName || ''} - هاتف: ${appt.clientPhone || ''} - ${appt.notes || ''}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `موعد_تسليم_${cleanDate}.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 500);
  };

  // Submit New Appointment
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    playSuccessSound();
    const newAppt: WorkshopAppointment = {
      id: `appt_${Date.now()}`,
      title: formTitle.trim(),
      type: formType,
      clientName: formClientName.trim() || undefined,
      clientPhone: formClientPhone.trim() || undefined,
      date: formDate,
      time: formTime || undefined,
      notes: formNotes.trim() || undefined,
      status: 'upcoming',
      createdAt: Date.now(),
    };

    saveAppointments([newAppt, ...appointments]);
    setIsAddModalOpen(false);
    // Reset Form
    setFormTitle('');
    setFormClientName('');
    setFormClientPhone('');
    setFormNotes('');
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold shadow-md shadow-amber-600/20 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span>أجندة مواعيد ورشتنا وتسليم الطلبيات</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 font-bold border border-amber-300/60 dark:border-amber-800">
                مزامنة التقويم الحرفي
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              متابعة مواعيد تسليم المشغولات للعملاء والاتفاقات مع التنبيه المسبق
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* Filter Tabs */}
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterTab('upcoming')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterTab === 'upcoming'
                  ? 'bg-white dark:bg-stone-700 text-amber-700 dark:text-amber-300 shadow-2xs font-black'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              القادمة ({appointments.filter((a) => a.status === 'upcoming').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('today')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterTab === 'today'
                  ? 'bg-white dark:bg-stone-700 text-amber-700 dark:text-amber-300 shadow-2xs font-black'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              اليوم ({appointments.filter((a) => a.date === todayStr).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-white dark:bg-stone-700 text-amber-700 dark:text-amber-300 shadow-2xs font-black'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              الكل ({appointments.length})
            </button>
          </div>

          {/* Add Appointment Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تسجيل موعد</span>
          </button>
        </div>
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-2xl bg-stone-50/60 dark:bg-stone-850/40 border border-dashed border-stone-200 dark:border-stone-800">
          <Calendar className="w-8 h-8 mx-auto text-stone-300 dark:text-stone-600 mb-2" />
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
            لا توجد مواعيد مسجلة في هذا التبويب حالياً
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-3 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>سجل أول موعد تسليم لورشتك الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAppointments.map((appt) => {
            const urgency = getUrgencyBadge(appt.date, appt.status);
            const isCompleted = appt.status === 'completed';

            return (
              <div
                key={appt.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-stone-50/50 dark:bg-stone-900/40 border-stone-200/60 dark:border-stone-800/60 opacity-75'
                    : 'bg-stone-50/80 dark:bg-stone-850/60 border-stone-200/80 dark:border-stone-750 hover:border-amber-400 dark:hover:border-amber-600 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {/* Completion Checkmark */}
                    <button
                      type="button"
                      onClick={() => handleToggleCompleted(appt.id)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer mt-0.5 shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'border-2 border-stone-300 dark:border-stone-600 hover:border-amber-500 text-transparent'
                      }`}
                      title={isCompleted ? 'إعادة الموعد كقادم' : 'تحديد الموعد كمنجز'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-black text-stone-900 dark:text-stone-100 ${
                            isCompleted ? 'line-through text-stone-400 dark:text-stone-500' : ''
                          }`}
                        >
                          {appt.title}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${urgency.className}`}
                        >
                          {urgency.label}
                        </span>
                      </div>

                      {/* Client info & Notes */}
                      {(appt.clientName || appt.clientPhone) && (
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-600 dark:text-stone-300 font-medium">
                          {appt.clientName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-stone-400" />
                              <span>{appt.clientName}</span>
                            </span>
                          )}
                          {appt.clientPhone && (
                            <span className="flex items-center gap-1 font-mono text-[10px]">
                              <Phone className="w-3 h-3 text-stone-400" />
                              <span>{appt.clientPhone}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {appt.notes && (
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">
                          {appt.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteAppointment(appt.id)}
                    className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="حذف الموعد"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Footer with Date, Time, and Google Calendar Action */}
                <div className="mt-3 pt-2.5 border-t border-stone-200/60 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1 font-bold text-stone-700 dark:text-stone-300">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>{appt.date}</span>
                    </span>
                    {appt.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>{appt.time}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Google Calendar Action Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenGoogleCalendar(appt)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      title="إضافة الموعد إلى تقويم جوجل الخاص بك"
                    >
                      <ExternalLink className="w-3 h-3 text-emerald-600" />
                      <span>حفظ الموعد في تقويم جوجل 📅</span>
                    </button>

                    {/* Download .ICS */}
                    <button
                      type="button"
                      onClick={() => handleDownloadIcs(appt)}
                      className="p-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 transition cursor-pointer"
                      title="تحميل ملف التقويم للموبايل (.ics)"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Appointment */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-stone-900 dark:text-stone-100">
                  تسجيل موعد تسليم أو اتفاق جديد
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3 text-right">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  عنوان الموعد أو المشغولة *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: تسليم مفرش سفرة كروشيه ٦ كراسي"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    طبيعة الموعد
                  </label>
                  <select
                    value={formType}
                    onChange={(e: any) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="delivery">تسليم مشغولة</option>
                    <option value="meeting">مقابلة أو اتفاق</option>
                    <option value="supplies">استلام خامات</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    اسم العميل أو الجهة
                  </label>
                  <input
                    type="text"
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder="اسم العميل"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    تاريخ التسليم *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    الوقت المحدد
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  رقم الهاتف للتواصل
                </label>
                <input
                  type="tel"
                  value={formClientPhone}
                  onChange={(e) => setFormClientPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  ملاحظات أو مواصفات إضافية
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="أي تفاصيل تخص الألوان أو التغليف أو مكان التسليم..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  حفظ الموعد بالأجندة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
