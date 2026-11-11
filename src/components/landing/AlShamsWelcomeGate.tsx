import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, X, Gift, Volume2 } from 'lucide-react';
import {
  alshamsFalconArtisanImg,
  shamousaAvatarImg,
  alshamsOfficialBannerLogo,
  AlShamsFalconEmblem,
  AlShamsBrandLogo,
} from '../brand/BrandAssets';

interface AlShamsWelcomeGateProps {
  isOpen: boolean;
  onClose: () => void;
  onEnter: () => void;
}

export const AlShamsWelcomeGate: React.FC<AlShamsWelcomeGateProps> = ({
  isOpen,
  onClose,
  onEnter,
}) => {
  const [phase, setPhase] = useState<'modal' | 'gifting' | 'hidden'>(isOpen ? 'modal' : 'hidden');
  const [boxOpened, setBoxOpened] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPhase('modal');
      setBoxOpened(false);
    } else {
      setPhase('hidden');
    }
  }, [isOpen]);

  const handleEnterClick = () => {
    // 1. تشغيل الأوديو فوراً عبر الكولباك (تزامن مع ضغطة المستخدم الصريحة)
    onEnter();

    // 2. إخفاء المودال والبدء بأنيميشن علبة الهدايا
    setPhase('gifting');

    // 3. توقيت هبوط العلبة ثم انفجار الهدايا والكونفيتي
    // تسقط العلبة خلال 700ms، وعند استقرارها تنفتح العلبة وتطلق الكونفيتي
    setTimeout(() => {
      setBoxOpened(true);
      launchCelebrationConfetti();
    }, 750);

    // 4. إنهاء الاحتفالية وإغلاق الأوفرلاي بعد 3.8 ثانية
    setTimeout(() => {
      setPhase('hidden');
      onClose();
    }, 3800);
  };

  const launchCelebrationConfetti = () => {
    try {
      // الانفجار المركزي الأساسي الصاعد للأعلى
      confetti({
        particleCount: 90,
        spread: 110,
        startVelocity: 45,
        origin: { y: 0.82, x: 0.5 },
        colors: ['#f59e0b', '#fbbf24', '#0284c7', '#0369a1', '#10b981', '#f43f5e', '#ffffff'],
        scalar: 1.25,
        ticks: 220,
      });

      // مدافع جانبية للزينة والبهجة بعد 300ms
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 60,
          startVelocity: 50,
          origin: { x: 0.15, y: 0.85 },
          colors: ['#f59e0b', '#fbbf24', '#ffffff', '#10b981'],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 60,
          startVelocity: 50,
          origin: { x: 0.85, y: 0.85 },
          colors: ['#f59e0b', '#fbbf24', '#ffffff', '#0284c7'],
        });
      }, 300);

      // دفعة ثالثة ناعمة من النجوم المتناثرة بعد 700ms
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 130,
          startVelocity: 35,
          origin: { y: 0.75, x: 0.5 },
          shapes: ['circle'],
          colors: ['#ffd700', '#ffa500', '#ffffff'],
        });
      }, 700);
    } catch (err) {
      console.warn('Confetti launch notice:', err);
    }
  };

  if (phase === 'hidden') return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center" dir="rtl">
      
      {/* ------------------------------------------------------------- */}
      {/* Phase 1: Welcome Modal (بوابة الاستقبال الحرفية الفاخرة)       */}
      {/* ------------------------------------------------------------- */}
      {phase === 'modal' && (
        <div className="absolute inset-0 bg-[#060b18]/95 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-500 animate-in fade-in">
          
          {/* خلفية الإضاءة العنبرية والكحلية المتوهجة */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-amber-600/20 via-amber-400/10 to-blue-900/20 rounded-full blur-3xl opacity-70" />
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
          </div>

          {/* الحاوية الرئيسية لكارت الترحيب */}
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0e172a] via-[#091024] to-[#050914] rounded-3xl p-6 sm:p-8 md:p-10 border-2 border-amber-500/50 shadow-2xl shadow-amber-500/20 text-center overflow-hidden z-10">
            
            {/* زر إغلاق ناعم في الزاوية لمن يفضل التصفح الفوري */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer z-20"
              title="إغلاق الترحيب"
            >
              <X className="w-5 h-5" />
            </button>

            {/* الشعار المعتمد للمنظومة بدون أي كروت أو إطارات صلبة */}
            <div className="relative mb-4 flex justify-center">
              <AlShamsBrandLogo maxWidth={220} isDark={true} />
            </div>

            {/* ثنائي صقر وشموسة يرحبان بالزائر في الصدارة معاً (Frameless & Seamless) */}
            <div className="relative my-3 flex items-center justify-center gap-6 sm:gap-10 select-none">
              
              {/* صقر الشمساوية */}
              <div className="flex flex-col items-center group">
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                  <img
                    src="/falcon_mascot_transparent.png"
                    alt="صقر الشمساوية"
                    className="w-full h-full object-contain filter drop-shadow-2xl select-none"
                  />
                </div>
                <span className="mt-1 px-3 py-0.5 text-center text-[11px] font-black rounded-full bg-stone-950/90 text-amber-300 border border-amber-400/40 shadow-md">
                  صقر الشمساوية 🦅
                </span>
              </div>

              {/* أيقونة الصقر الذهبي في المنتصف كعنصر رابط بينهما */}
              <div className="relative shrink-0 flex flex-col items-center">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-500/20 border border-amber-400/40 p-1 shadow-lg flex items-center justify-center animate-pulse">
                  <AlShamsFalconEmblem size="sm" />
                </div>
                <span className="text-[10px] font-bold text-amber-300/80 mt-1">يد بيد</span>
              </div>

              {/* شموسة */}
              <div className="flex flex-col items-center group">
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                  <img
                    src="/shamousa_mascot_transparent.png"
                    alt="شموسة"
                    className="w-full h-full object-contain filter drop-shadow-2xl select-none"
                  />
                </div>
                <span className="mt-1 px-3 py-0.5 text-center text-[11px] font-black rounded-full bg-stone-950/90 text-amber-300 border border-amber-400/40 shadow-md">
                  شموسة ☀️
                </span>
              </div>
            </div>

            {/* العبارة الترحيبية الدافئة باللهجة المصرية */}
            <div className="space-y-3 mt-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight">
                يا مرحب بيك في مطرح الفن والجدعنة.. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200">
                  نورت عيلة الشمساوية! 🦅☀️
                </span>
              </h2>

              <p className="text-xs sm:text-sm text-stone-300 max-w-lg mx-auto leading-relaxed">
                المنظومة الأولى التي صنعت بحب على يد حرفيين لأجل صناع وفناني مصر والوطن العربي.. هنا تلاقي حساباتك مضبوطة ومساعدك الذكي دايماً جنبك.
              </p>
            </div>

            {/* زر الدخول التفاعلي الرئيسي (CTA الذهبي المتوهج) */}
            <div className="mt-7 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleEnterClick}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-base sm:text-lg bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-2xl shadow-amber-500/50 hover:shadow-amber-400/70 border-2 border-yellow-200 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer group"
              >
                <Sparkles className="w-5 h-5 text-stone-950 animate-spin-slow group-hover:rotate-45 transition-transform" />
                <span className="tracking-wide">اتفضل نوّرنا في بيت عيلة الشمساوية 🚪✨</span>
              </button>
              <span className="text-[11px] text-amber-400/70 flex items-center gap-1 mt-1">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                <span>يصاحبه نشيد المنظومة الحماسي</span>
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Phase 2: Falling Gift Box & Unboxing Cannon (علبة الهدايا والأنيميشن) */}
      {/* ------------------------------------------------------------- */}
      {phase === 'gifting' && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-end justify-center pb-12 sm:pb-16">
          
          {/* مجسم علبة الهدايا الكرتونية الأنيقة مع حركة الارتداد */}
          <div className="relative flex flex-col items-center animate-gift-drop">
            
            {/* غطاء العلبة المتحرك عند الفتح */}
            <div
              className={`relative z-20 w-28 sm:w-36 h-10 sm:h-12 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-t-xl border-2 border-yellow-200 shadow-xl flex items-center justify-center transition-all duration-500 ${
                boxOpened
                  ? '-translate-y-12 rotate-[-25deg] opacity-75'
                  : 'translate-y-0 rotate-0'
              }`}
            >
              {/* فيونكة العلبة الذهبية */}
              <div className="absolute -top-4 w-9 h-7 bg-amber-300 rounded-t-full border border-yellow-100 shadow-md flex items-center justify-center">
                <div className="w-2 h-full bg-amber-600" />
              </div>
              <div className="w-5 h-full bg-amber-700/40" />
            </div>

            {/* جسم العلبة الحرفية */}
            <div className="relative z-10 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-b from-blue-950 via-[#0a1428] to-[#040814] rounded-b-2xl border-2 border-amber-400 shadow-2xl flex items-center justify-center overflow-hidden">
              {/* شريط الهدية العمودي */}
              <div className="w-5 h-full bg-gradient-to-b from-amber-400 to-yellow-500 shadow-sm" />
              {/* شريط الهدية الأفقي */}
              <div className="absolute inset-x-0 h-5 bg-gradient-to-r from-amber-400 to-yellow-500 shadow-sm" />
              
              {/* أيقونة صقر متوهجة في قلب العلبة */}
              <div className="absolute z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xs flex items-center justify-center border border-amber-300/60 shadow-inner">
                <Gift className="w-6 h-6 text-amber-300 animate-bounce" />
              </div>
            </div>

            {/* وميض أرضي عند الارتطام */}
            <div
              className={`w-40 sm:w-48 h-6 bg-amber-400/30 rounded-full blur-md transition-opacity duration-300 ${
                boxOpened ? 'scale-125 opacity-100' : 'scale-90 opacity-40'
              }`}
            />

            {/* بلالين وزينة صاعدة تطير للسقف */}
            {boxOpened && (
              <div className="absolute -top-16 inset-x-0 pointer-events-none flex justify-center">
                <div className="flex gap-4 animate-balloons-up">
                  <span className="text-3xl animate-pulse">🎈</span>
                  <span className="text-3xl animate-bounce">✨</span>
                  <span className="text-3xl animate-pulse">🎉</span>
                  <span className="text-3xl animate-bounce">🎈</span>
                  <span className="text-3xl animate-pulse">☀️</span>
                </div>
              </div>
            )}

            {/* شارة الترحيب الاحتفالية */}
            {boxOpened && (
              <div className="absolute -bottom-8 px-4 py-1.5 rounded-full bg-stone-900/95 border border-amber-400 text-amber-300 font-black text-xs sm:text-sm whitespace-nowrap shadow-xl animate-fade-in">
                🎉 نورت عيلة الشمساوية.. رحلتنا بدأت!
              </div>
            )}
          </div>
        </div>
      )}

      {/* الستايلات الخاصة بحركات السقوط والارتداد والبلالين */}
      <style>{`
        @keyframes giftDrop {
          0% {
            transform: translateY(-90vh) scale(0.7);
            opacity: 0;
          }
          50% {
            transform: translateY(0) scale(1.15, 0.85);
            opacity: 1;
          }
          65% {
            transform: translateY(-30px) scale(0.95, 1.05);
          }
          80% {
            transform: translateY(0) scale(1.05, 0.95);
          }
          90% {
            transform: translateY(-10px) scale(1, 1);
          }
          100% {
            transform: translateY(0) scale(1, 1);
          }
        }

        .animate-gift-drop {
          animation: giftDrop 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes balloonsUp {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translateY(-80vh) scale(1.3);
            opacity: 0;
          }
        }

        .animate-balloons-up {
          animation: balloonsUp 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
};
