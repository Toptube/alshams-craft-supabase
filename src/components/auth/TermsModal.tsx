import React from 'react';
import { ShieldCheck, Lock, Sparkles, Scale, Handshake, CheckCircle2, X } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-amber-300 dark:border-amber-900/60 overflow-hidden flex flex-col max-h-[90vh] text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                سياسات وشروط الاستخدام وحوكمة الذكاء الاصطناعي
              </h2>
              <p className="text-xs text-amber-100/90 font-medium">
                منظومة الشمساوية SaaS • ميثاق الشراكة الحرفية الآمنة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Clauses Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs font-medium text-stone-700 dark:text-stone-300 leading-relaxed">
          {/* Clause 1 */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-black text-sm">
              <span className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                <Lock size={14} />
              </span>
              <h3>١. أمان وسرية البيانات (Data Privacy & Tenant Isolation)</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 pr-9">
              تلتزم منظومة الشمساوية بحماية تامة ومطلقة لكافة سجلات خاماتك، أسرار خلطاتك وإنتاجك اليدوي، معادلات تسعيرك الخاصة، وقوائم عملائك ومبيعاتك. كل ورشة تعمل داخل بيئة معزولة برمجياً (Multi-Tenant Isolation) ولا يمكن لأي ورشة أخرى أو طرف ثالث الاطلاع على سجلاتك المالية أو التجارية تحت أي ظرف.
            </p>
          </div>

          {/* Clause 2 */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-black text-sm">
              <span className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                <Handshake size={14} />
              </span>
              <h3>٢. الشراكة والتطوير المستمر (Craft SaaS Partnership)</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 pr-9">
              المنظومة ليست مجرد برنامج حسابات، بل هي شريك نجاح تقني واستشاري ينمو ويتطور مع ورشتك. نلتزم بتوفير أحدث أدوات إدارة المخزون، هندسة وحساب الهوالك، تتبع دورات التصنيع، وتحليلات الربحية المعمقة بما يدعم استدامة وتوسع نشاطك الحرفي محلياً وإقليمياً.
            </p>
          </div>

          {/* Clause 3 */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-black text-sm">
              <span className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                <Sparkles size={14} />
              </span>
              <h3>٣. التدريب الآمن والمتبادل للذكاء الاصطناعي (AI Co-Evolution)</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 pr-9">
              يعمل داخل المنظومة مساعدان رقميان ذكيان متخصصان: <strong className="text-amber-800 dark:text-amber-300">«صقر الشمساوية»</strong> (خبير استشارات الحِرف، الرؤية البصرية، وهندسة التسعير) و<strong className="text-amber-800 dark:text-amber-300">«شموسة»</strong> (مديرة الأعمال وتشغيل ورشتك).
            </p>
            <p className="text-stone-600 dark:text-stone-400 pr-9">
              تفاعلك المستمر يسهم في تدريب مغلق ومتبادل للنماذج الإشرافية بهدف تحسين دقة التسعير، عدالة حساب التكاليف والمخزون، وتوليد حلول هندسية وفنية مخصصة لكل حرفة يدوية. كافة عمليات التعلم تجري في بيئة سيادية مشفرة ومحمية لا تشارك بياناتك الحساسة مع شركات الإعلانات أو جهات خارجية.
            </p>
          </div>

          {/* Clause 4 */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-black text-sm">
              <span className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0">
                <Scale size={14} />
              </span>
              <h3>٤. الإشراف الإداري وحماية البيئة الحرفية (Governance & Appeals)</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 pr-9">
              تحتفظ إدارة المنظومة (كبير عيلة الشمساوية) بالحق الرقابي والإشرافي لضمان جودة ونزاهة استخدام الموارد المشتركة، وحق اتخاذ إجراءات إدارية تشمل التنبيه أو التجميد أو الإيقاف المؤقت أو الحظر عند ارتكاب مخالفات جوهرية أو انتهاك الآداب العامة. وفي المقابل، تضمن المنظومة حق كل ورشة في تقديم طعن إداري رسمي ومباشر عبر مركز الطعون ليتم فحصه والبت فيه بنزاهة وشفافية تامة.
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 sm:p-5 bg-stone-50 dark:bg-stone-850 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 font-bold text-xs transition cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => {
              onAccept();
              onClose();
            }}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20 transition cursor-pointer"
          >
            <CheckCircle2 size={16} />
            <span>فهمت وموافق على الشروط</span>
          </button>
        </div>
      </div>
    </div>
  );
};
