import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';
import {
  HelpCircle,
  X,
  MessageCircle,
  Send,
  Phone,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Tag,
  User,
  Building,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

// الرقم الرسمي المعتمد لمنظومة الشمس كرافت بالكامل
export const ALSHAMS_OFFICIAL_PHONE_RAW = '01000996059';
export const ALSHAMS_OFFICIAL_PHONE_E164 = '201000996059';
export const ALSHAMS_OFFICIAL_PHONE_DISPLAY = '+20 100 099 6059';

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  // توليد رقم تسلسلي فريد للشكوى أو المقترح
  const [ticketSerial] = useState(() => {
    const timestampSuffix = Date.now().toString().slice(-4);
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    return `SH-${timestampSuffix}${randomSuffix}`;
  });

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [senderPhone, setSenderPhone] = useState(profile.phoneNumber || '');
  const [type, setType] = useState<'complaint' | 'suggestion' | 'support'>('complaint');
  const [submitted, setSubmitted] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  const getTypeName = (t: typeof type) => {
    switch (t) {
      case 'complaint':
        return 'شكوى رسمية';
      case 'suggestion':
        return 'مقترح وتطوير';
      case 'support':
        return 'طلب دعم واستفسار';
      default:
        return 'تذكرة تواصل';
    }
  };

  /**
   * صياغة نص رسالة الواتساب المتكاملة والشاملة لكافة بيانات الراسل ورقم التذكرة
   */
  const buildWhatsAppMessage = (customSubject?: string, customMessage?: string) => {
    const activeSubject = (customSubject !== undefined ? customSubject : subject).trim() || 'استفسار ودعم عام';
    const activeDetails = (customMessage !== undefined ? customMessage : message).trim() || 'يرجى التواصل بخصوص منظومة الشمساوية.';
    const formattedDate = new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const lines = [
      `🌟 *منظومة الشمساوية | تذكرة تواصل ودعم رسمية* 🌟`,
      `---------------------------------`,
      `🔖 *رقم التذكرة التسلسلي:* #${ticketSerial}`,
      `🏷️ *نوع الطلب:* ${getTypeName(type)}`,
      ``,
      `👤 *بيانات الراسل:*`,
      `• *اسم الفنان / الفنانة:* ${profile.artistName || 'غير محدد'}`,
      `• *اسم البراند / المشغل:* ${profile.brandName || 'غير محدد'}`,
      `• *رقم هاتف الراسل:* ${senderPhone || profile.phoneNumber || 'غير مسجل'}`,
      `• *الدولة:* ${profile.country || 'مصر'} (${profile.currencySymbol || 'ج.م'})`,
      ``,
      `📝 *موضوع الرسالة:*`,
      `${activeSubject}`,
      ``,
      `💬 *التفاصيل:*`,
      `${activeDetails}`,
      ``,
      `⏰ *تاريخ وتوقيت الإرسال:*`,
      `${formattedDate} - الساعة ${formattedTime}`,
      `---------------------------------`,
      `_مرسل رسمياً من تطبيق منظومة الشمساوية_`,
    ];

    return lines.join('\n');
  };

  /**
   * فتح تطبيق واتساب مباشرة ومخاطبة الرقم الرسمي 201000996059
   */
  const handleOpenWhatsApp = (customSubject?: string, customMessage?: string) => {
    playButtonClickSound();
    const fullText = buildWhatsAppMessage(customSubject, customMessage);
    const encoded = encodeURIComponent(fullText);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${ALSHAMS_OFFICIAL_PHONE_E164}&text=${encoded}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // إرسال عبر واتساب الرقم الرسمي متضمناً كامل البيانات والتفاصيل والرقم التسلسلي
    handleOpenWhatsApp();

    playSuccessSound();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  };

  const handleCopyOfficialPhone = () => {
    playButtonClickSound();
    navigator.clipboard?.writeText(ALSHAMS_OFFICIAL_PHONE_RAW);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border border-amber-300/80 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              playButtonClickSound();
              onClose();
            }}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-300">
                الشكاوى والمقترحات والدعم الفني
              </h2>
              <span className="text-[11px] font-mono text-stone-400 font-bold block">
                رقم التذكرة: #{ticketSerial}
              </span>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[80vh] space-y-4">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-stone-800 dark:text-stone-200">
                تم توجيه تذكرتك بنجاح عبر واتساب!
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                رقم التذكرة التسلسلي <span className="font-mono font-bold text-amber-600">#{ticketSerial}</span> متضمناً كافة بيانات براندك وهاتفك تم إرسالها للرقم الرسمي لمنظومة الشمساوية.
              </p>
            </div>
          ) : (
            <>
              {/* Official Contact Banner with Verified Phone */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-stone-900 border border-emerald-300 dark:border-emerald-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="text-right w-full sm:w-auto">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-black text-[10px]">
                      الرقم الرسمي المعتمد
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold">
                      مصر (+20)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black font-mono text-emerald-800 dark:text-emerald-300 tracking-wider">
                      {ALSHAMS_OFFICIAL_PHONE_DISPLAY}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyOfficialPhone}
                      className="p-1 rounded-lg hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                      title="نسخ الرقم الرسمي"
                    >
                      {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                    الرقم الرسمي الموحد لإدارة ودعم منظومة الشمساوية بالكامل
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenWhatsApp('محادثة دعم فوري', 'مرحباً، أطلب تواصلاً فورياً مع إدارة منظومة الشمساوية.')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل فوري عبر واتساب</span>
                </button>
              </div>

              {/* Sender Details Snapshot */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/70 space-y-2">
                <span className="text-[11px] font-black text-stone-700 dark:text-stone-300 block">
                  بيانات الراسل المرفقة تلقائياً بالتذكرة:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span>الفنان/ة:</span>
                    <strong className="text-stone-900 dark:text-stone-100">{profile.artistName || 'غير مسجل'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                    <Building className="w-3.5 h-3.5 text-amber-600" />
                    <span>البراند:</span>
                    <strong className="text-stone-900 dark:text-stone-100">{profile.brandName || 'غير مسجل'}</strong>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>رقم الهاتف:</span>
                    <input
                      type="tel"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="رقم الهاتف للتواصل"
                      className="px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-xs font-bold outline-none flex-1 max-w-xs text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Ticket Form */}
              <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    نوع الرسالة / التذكرة
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        setType('complaint');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition border cursor-pointer active:scale-95 ${
                        type === 'complaint'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      تسجيل شكوى
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        setType('suggestion');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition border cursor-pointer active:scale-95 ${
                        type === 'suggestion'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      اقتراح وتطوير
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        setType('support');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition border cursor-pointer active:scale-95 ${
                        type === 'support'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      طلب مساعدة
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    موضوع الشكوى أو المقترح *
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: استفسار حول تسعير المنتجات أو اقتراح إضافة تقرير جديد..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    تفاصيل الشكوى أو المقترح بالتفصيل *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اشرح المشكلة أو المقترح بالتفصيل ليتمكن فريق الإدارة من مراجعته بدقة..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500 resize-none leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-2 border-t border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      playButtonClickSound();
                      onClose();
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>إرسال التذكرة عبر واتساب الرسمي</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
