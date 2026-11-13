import React, { useState, useEffect, useRef } from 'react';
import {
  AlShamsFalconEmblem,
  alshamsOfficialBannerLogo,
  alshamsFalconArtisanImg,
  falconAvatarImg,
  shamousaAvatarImg,
  AlShamsBrandLogo,
} from '../brand/BrandAssets';
import { AlShamsWelcomeGate } from './AlShamsWelcomeGate';
import { AlShamsAudioPlayer, AlShamsAudioPlayerHandle } from './AlShamsAudioPlayer';
import {
  Sparkles,
  Calculator,
  Layers,
  ShoppingBag,
  Wrench,
  ShieldCheck,
  Star,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Bot,
  Zap,
  Clock,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Moon,
  Sun,
  Eye,
  Check,
  Flame,
  Award,
  Users,
  BookOpen,
  Store,
  Receipt,
  Share2,
  HelpCircle,
  Phone,
} from 'lucide-react';

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  onOpenRegister,
  isDarkMode = false,
  onToggleTheme,
}) => {
  // مشغل الصوت الترويجي وبوابة الاستقبال التفاعلية
  const audioPlayerRef = useRef<AlShamsAudioPlayerHandle | null>(null);
  const [isWelcomeGateOpen, setIsWelcomeGateOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('alshams_welcome_gate_seen');
      if (!seen) {
        // إظهار بوابة الاستقبال تلقائياً للزائر الجديد لأول مرة
        const timer = setTimeout(() => {
          setIsWelcomeGateOpen(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleGateEnter = () => {
    try {
      localStorage.setItem('alshams_welcome_gate_seen', 'true');
    } catch {}
    // تشغيل الأوديو فوراً بالتزامن مع كليك الزائر على زر الترحيب
    audioPlayerRef.current?.playTrack();
  };

  // Feedback modal state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackCraft, setFeedbackCraft] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Interactive AI Simulator tab
  const [simQuestion, setSimQuestion] = useState<'falcon_runner' | 'shamousa_cash' | 'hourly_rate'>('falcon_runner');

  // Accordion FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Handle feedback submission
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackName.trim() || !feedbackMessage.trim()) return;

    setFeedbackSubmitting(true);
    try {
      const res = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedbackName.trim(),
          craft: feedbackCraft.trim() || 'مشغولات يدوية',
          rating: feedbackRating,
          message: feedbackMessage.trim(),
          contact: feedbackContact.trim(),
        }),
      });

      if (res.ok) {
        setFeedbackSuccess(true);
        setTimeout(() => {
          setFeedbackSuccess(false);
          setIsFeedbackModalOpen(false);
          setFeedbackName('');
          setFeedbackCraft('');
          setFeedbackMessage('');
          setFeedbackContact('');
        }, 2200);
      }
    } catch {
      // fallback success feedback
      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        setIsFeedbackModalOpen(false);
      }, 2000);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5EB] dark:bg-[#060B18] text-[#0C1427] dark:text-[#FAF5EB] font-sans selection:bg-[#EA580C] selection:text-white transition-colors duration-300" dir="rtl">
      
      {/* ------------------------------------------------------------- */}
      {/* بوابة الاستقبال التفاعلية الفاخرة (Hero Gate / Welcome Modal)   */}
      {/* ------------------------------------------------------------- */}
      <AlShamsWelcomeGate
        isOpen={isWelcomeGateOpen}
        onClose={() => setIsWelcomeGateOpen(false)}
        onEnter={handleGateEnter}
      />

      {/* ------------------------------------------------------------- */}
      {/* 1. Header / Navbar (Sticky, Modern Glassmorphism & Audio Widget)*/}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#FFFDF9]/90 dark:bg-[#0B142B]/90 border-b border-[#DEC9A8] dark:border-[#1B2B4B] transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3 sm:gap-4">
          
          {/* الشعار المعتمد للمنظومة بعرض لا يتجاوز 180px وبخلفية شفافة تماماً كأنه مدمج في نسيج الصفحة */}
          <div className="flex items-center gap-2 select-none shrink-0">
            <AlShamsFalconEmblem size="sm" className="hover:scale-105 transition-transform" />
            <AlShamsBrandLogo maxWidth={155} maxHeight={52} />
          </div>

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-6 text-sm font-bold text-[#5C4734] dark:text-[#EADBC3]">
            <a href="#safe-accounts" className="hover:text-[#EA580C] dark:hover:text-amber-300 transition-colors">
              عقلك الحرفي
            </a>
            <a href="#ai-partners" className="hover:text-[#EA580C] dark:hover:text-amber-300 transition-colors flex items-center gap-1.5">
              <span>صقر وشموسة AI</span>
            </a>
            <a href="#craft-lifecycle" className="hover:text-[#EA580C] dark:hover:text-amber-300 transition-colors">
              رحلة المشغولة
            </a>
            <a href="#tool-maintenance" className="hover:text-[#EA580C] dark:hover:text-amber-300 transition-colors">
              صيانة العِدد
            </a>
            <a href="#reviews" className="hover:text-[#EA580C] dark:hover:text-amber-300 transition-colors">
              حكايات الورش
            </a>
          </nav>

          {/* Actions: Audio Player (Compact Circle Button) + Welcome Gate + Theme Toggle + [ فتح الورشة ] */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* مشغل النشيد المدمج بزر واحد خفيف */}
            <AlShamsAudioPlayer ref={audioPlayerRef} />

            {/* زر إعادة فتح بوابة الترحيب التفاعلية */}
            <button
              type="button"
              onClick={() => setIsWelcomeGateOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black bg-[#F3E9D8] dark:bg-[#111E3A] text-[#9A3412] dark:text-amber-200 border border-[#DEC9A8] dark:border-[#1B2B4B] hover:border-[#EA580C] transition cursor-pointer shrink-0"
              title="فتح بوابة الترحيب التفاعلية"
            >
              <span>بوابة الترحيب ✨</span>
            </button>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="تبديل مظهر الواجهة"
                title={isDarkMode ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#F3E9D8] dark:bg-[#111E3A] border border-[#DEC9A8] dark:border-[#1B2B4B] hover:border-[#EA580C] text-[#0C1427] dark:text-[#FAF5EB] transition-colors cursor-pointer flex items-center justify-center shrink-0"
              >
                {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#C2410C]" />}
              </button>
            )}

            {/* زر [ فتح الورشة ]: مساحة طبيعية مريحة، بارز، مقروء بوضوح بدون أي قص أو حشر */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#EA580C] via-[#F59E0B] to-[#C2410C] hover:from-[#C2410C] hover:to-[#EA580C] text-white shadow-md shadow-orange-600/25 transition-all cursor-pointer flex items-center gap-2 border border-[#FDBA74]/50 whitespace-nowrap shrink-0"
            >
              <span>فتح الورشة</span>
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. Hero Section & Safe Zone (Strict Branding Placement)       */}
      {/* ------------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24 border-b border-[#DEC9A8] dark:border-[#1B2B4B] bg-gradient-to-b from-[#FAF5EB] via-[#F5EAD8] to-[#FFFDF9] dark:from-[#060B18] dark:via-[#081024] dark:to-[#0C1427]">
        
        {/* Subtle geometric craft background overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-15 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:24px_24px]" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Safe Zone Central Branding Showcase (Frameless & Seamless) */}
          <div className="flex flex-col items-center justify-center text-center mb-6">
            
            {/* The Official Landscape Banner Logo (Seamless Calligraphy) */}
            <div className="w-full max-w-xl px-2 mb-4 flex items-center justify-center">
              <AlShamsBrandLogo maxWidth={320} />
            </div>

            {/* Visual Harmony: Center-Aligned Falcon Artisan Mascot with Hero Pitch */}
            <div className="relative w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 pt-2">
              
              {/* Full-Body Falcon Artisan Character (Frameless & Seamless - 100% Transparent) */}
              <div className="relative w-52 sm:w-64 md:w-72 shrink-0 flex flex-col items-center justify-center select-none">
                <img
                  src="/falcon_mascot_transparent.png"
                  alt="صقر الشمساوية الحرفي"
                  className="w-full h-auto max-h-[320px] sm:max-h-[360px] object-contain filter drop-shadow-2xl select-none"
                />
                <div className="mt-2 px-4 py-1.5 rounded-2xl bg-[#0C1427] text-amber-300 text-xs font-black border border-[#EA580C]/45 whitespace-nowrap shadow-lg flex items-center gap-1.5 select-none">
                  <span>صقر الشمساوية AI 🦅</span>
                </div>
              </div>

              {/* Main Headline & Storytelling */}
              <div className="flex-1 text-center md:text-right space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0C1427] dark:text-[#FAF5EB] leading-tight">
                  عشان إيدك بتتلف في حرير.. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#F59E0B] dark:from-[#FDBA74] dark:via-amber-300 dark:to-[#FB923C]">
                    ورشتك تستاهل نظام يديرها بضمير!
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-[#5C4734] dark:text-[#EADBC3] leading-relaxed font-medium">
                  من أول فتلة خيط وتسعير الخامات بالمليم وحساب الهدر وساعات التعب، لحد أرباحك الصافية وإدارة الخزن والزبائن.. بدون أي كلاكيع حسابية ولا دفاتر بتضيع.
                </p>

                {/* Main CTAs */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="px-6 py-3.5 rounded-2xl font-black text-base bg-gradient-to-r from-[#EA580C] via-[#F59E0B] to-[#C2410C] hover:from-[#C2410C] hover:to-[#EA580C] text-white shadow-xl shadow-orange-600/25 transition-all cursor-pointer flex items-center gap-2 border border-[#FDBA74]/50"
                  >
                    <Sparkles className="w-5 h-5 text-amber-100" />
                    <span>افتح ورشتك في ثواني مجاناً 🌟</span>
                  </button>

                  <a
                    href="#safe-accounts"
                    className="px-6 py-3.5 rounded-2xl font-bold text-base bg-[#FFFDF9] dark:bg-[#0C1427] border border-[#DEC9A8] dark:border-[#1B2B4B] hover:border-[#EA580C] text-[#0C1427] dark:text-[#FAF5EB] transition-all flex items-center gap-2"
                  >
                    <span>شوف إزاي بتشتغل</span>
                    <ChevronDown className="w-4 h-4 text-[#EA580C]" />
                  </a>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-stone-200 dark:border-stone-800/80 text-xs font-bold text-stone-600 dark:text-stone-400">
                  <div className="flex items-center gap-1.5 justify-center md:justify-start">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>لا يتطلب خبرة محاسبية</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center md:justify-start">
                    <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>حماية وأمان كامل للبيانات</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center md:justify-start">
                    <Zap className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span>شغال على الموبايل والكمبيوتر</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. Section 1: "عقلك الحرفي مش دفتر ضايع ولا ورقة مبلولة"       */}
      {/* ------------------------------------------------------------- */}
      <section id="safe-accounts" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>المالية والسيولة الحرفية المنضبطة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              عقلك الحرفي مش دفتر ضايع ولا ورقة مبلولة
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              كام مرة فاتورة خيط ضاعت؟ ولا فلوس كاش الورشة دخلت في مصاريف البيت؟ ولا صانع أخد عهدة ونسيتوا اتصرف منها إيه؟ 
              الشمساوية بتنظم كل مليم بلغة الورشة البسيطة بدون وجع دماغ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 transition-all hover:-translate-y-1 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                شجرة حسابات مبسطة
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                مش مصطلحات بنكية معقدة.. دي خزن، عهد، مشتريات خامات، وأجور صناع، كل قرش بيسمع في خانته المظبوطة فورياً.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 transition-all hover:-translate-y-1 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                سجل العهد وإغلاق المتبقي
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                اصرف عهدة للمساعد أو الصانع عشان يشتري خامات، وسجل فواتيره واسترد المتبقي بلمسة زرار مع مطابقة الخزينة.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 transition-all hover:-translate-y-1 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                ميزان السيولة الحية الفوري
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                شاشة واحدة توضح لك سيولتك الفعلية متوزعة إزاي: كاش في درج الورشة، إنستاباي، ولا محافظ فودافون كاش.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 transition-all hover:-translate-y-1 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                إنذار حد أمان السيولة
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                لو السيولة قربت تخلص قبل تجديد الخامات، المنظومة بتديك تنبيه مبكر عشان تلحق تحصّل فواتير العملاء الآجلة.
              </p>
            </div>

          </div>

          {/* Section CTA */}
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={onOpenRegister}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <span>ابدأ تسعير شغلك واضبط حساباتك صح 💰</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. Section 2: "شموسة وصقر معاك على الخط" (AI Craft Partners)  */}
      {/* ------------------------------------------------------------- */}
      <section id="ai-partners" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/60 dark:bg-stone-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              <Bot className="w-3.5 h-3.5" />
              <span>الذكاء الاصطناعي الحرفي الميداني</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              شموسة وصقر معاك على الخط.. مش شات بوت، دول شركاء ورشة!
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              فاهمين في بكر الخيط، والمكرميات، وساعات الشغل اليدوي، وأسعار السوق. بيقرأوا أرقام ورشتك الحية عشان مفيش حساب يفلت.
            </p>
          </div>

          {/* AI Duo Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            
            {/* Saqr The Engineer */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg flex flex-col sm:flex-row items-center gap-6">
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center select-none">
                <img
                  src="/falcon_mascot_transparent.png"
                  alt="صقر الشمساوية"
                  className="w-full h-full object-contain filter drop-shadow-md select-none"
                />
              </div>
              <div className="space-y-2 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-stone-900 dark:text-amber-300">صقر الشمساوية</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-bold">المستشار الهندسي</span>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  خبير هندسة الورشة.. تبعت له صورة المشغولة يحلل أبعادها، يحسب أطوال الخيوط وسمك الحبال، ويطلع كود الرسم التخطيطي الهندسي ونسب الهدر بالجرام!
                </p>
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 pt-1">
                  ⚡️ مبني على نماذج رؤية هندسية وحسابات يدوية واقعية
                </div>
              </div>
            </div>

            {/* Shamousa The Operations Buddy */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg flex flex-col sm:flex-row items-center gap-6">
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center select-none">
                <img
                  src="/shamousa_mascot_transparent.png"
                  alt="شموسة مديرة أعمال الورشة"
                  className="w-full h-full object-contain filter drop-shadow-md select-none"
                />
              </div>
              <div className="space-y-2 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-stone-900 dark:text-amber-300">شموسة</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold">مديرة العمليات والمهام</span>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  رفيقة الورشة الشاطرة.. تفكرك بأوردرات الزباين المستعجلة، تعرفك الخامات اللي قربت تخلص عشان تطلبها، وتطابق لك فلوس الخزائن والعهد أولاً بأول.
                </p>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                  ⚡️ متصلة مباشرة بأرصدة خاماتك وأوامر تشغيل ورشتك
                </div>
              </div>
            </div>

          </div>

          {/* Interactive AI Preview Simulator Box */}
          <div className="max-w-3xl mx-auto rounded-3xl bg-stone-900 text-stone-100 p-6 sm:p-8 border border-amber-500/30 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm text-amber-300">جرّب محاكي ذكاء الورشة الآن</span>
              </div>
              <span className="text-xs text-stone-400 font-mono">LIVE PREVIEW</span>
            </div>

            {/* Questions Selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setSimQuestion('falcon_runner')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  simQuestion === 'falcon_runner'
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                رانر مكرمية 2م × 40سم؟
              </button>
              <button
                type="button"
                onClick={() => setSimQuestion('shamousa_cash')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  simQuestion === 'shamousa_cash'
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                السيولة والخزينة دلوقتي؟
              </button>
              <button
                type="button"
                onClick={() => setSimQuestion('hourly_rate')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  simQuestion === 'hourly_rate'
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                إزاي أسعر ساعة إيدي؟
              </button>
            </div>

            {/* Simulation Reply Display */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800/80 min-h-[120px] flex flex-col justify-center text-sm leading-relaxed text-stone-200">
              {simQuestion === 'falcon_runner' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-2">
                    <img
                      src="/falcon_mascot_ai.png"
                      alt="صقر"
                      className="w-5 h-5 rounded-full object-cover object-top border border-amber-400 select-none"
                    />
                    <span>رد صقر الشمساوية:</span>
                  </div>
                  <p>
                    "يا أستاذنا.. رانر بطول 200 سم وعرض 40 سم بغرزة مربعة ومزدوجة، محتاج حوالي <strong>280 متر خيط قطن محلول سمك 4 مم</strong> (وزن تقريبي 1.15 كجم). هدر الشراشيب محسوب 15%، وصافي وقت العقد اليدوي حوالي <strong>6.5 ساعات عمل</strong>."
                  </p>
                </div>
              )}
              {simQuestion === 'shamousa_cash' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-2">
                    <img
                      src="/shamousa_mascot.png"
                      alt="شموسة"
                      className="w-5 h-5 rounded-full object-cover object-top scale-125 border border-amber-400 select-none"
                    />
                    <span>رد شموسة:</span>
                  </div>
                  <p>
                    "صباح الفل يا فنان! درج الخزينة فيه <strong>3,450 ج.م كاش</strong>، والمحفظة فيها <strong>1,800 ج.م</strong>. بس خد بالك خيط المكرمية البيج باقي منه بكرة واحدة بس، وده تحت حد الأمان للورشة.. تطلب طلبية خامات جديدة من المورد؟"
                  </p>
                </div>
              )}
              {simQuestion === 'hourly_rate' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                    <span>رد حاسبة الشمساوية:</span>
                  </div>
                  <p>
                    "التسعير العادل مش تخمين.. بنحسب: <strong>تكلفة الخامات الفعلية + (ساعات الشغل × أجرك العادل للساعة) + نسبة إهلاك العدد والكهرباء 10% + هامش ربح الورشة 25%</strong>. كده بتضمن حق تعبك وورشتك بتكبر بجد!"
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={onOpenRegister}
                className="px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                جرب ذكاء صقر وشموسة في ورشتك 🦅
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. Section 3: "من أول فتلة خيط لحد المتجر والزبون"             */}
      {/* ------------------------------------------------------------- */}
      <section id="craft-lifecycle" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
              <Layers className="w-3.5 h-3.5" />
              <span>دورة حياة المشغولة الكاملة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              من أول فتلة خيط لحد المتجر وعين الزبون
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              مسار صناعي احترافي ينقلك من هاوٍ لعلامة تجارية مستقرة ومربحة خطوة بخطوة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            
            {/* Step 1 */}
            <div className="relative p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-lg">
                1
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                حاسبة التكاليف الشاملة
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                حساب دقيق لأطوال الخيوط، أسعار الخامات، ساعات التعب، ونسب الهدر، عشان تعرف تسعر بالعدل وتضمن مكسبك.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-lg">
                2
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                أرشيف المواصفات والغرز
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                احفظ كل قطعة نفذتها بمقاساتها وخاماتها وصورها، عشان تعيد تصنيعها لأي عميل بنفس الدقة في ثواني.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-lg">
                3
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                أمر التشغيل والصرف
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                إذن صرف خامات من المخزن، تكليف الصانع، وتوريد المنتج التام لمخزن الجاهز فور الانتهاء مع إثبات مصنعيات العمال.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-lg">
                4
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                الكتالوج وعروض الواتساب
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                شارك عروض أسعار أنيقة وفواتير رسمية مع عملائك على واتساب بلمسة واحدة، أو افتح متجرك على منصتي.
              </p>
            </div>

          </div>

          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={onOpenRegister}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <span>انضم لعيلة الشمساوية وشوف الفرق 🌟</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5.1 CRM: إدارة وعلاقات العملاء ومستحقاتهم                       */}
      {/* ------------------------------------------------------------- */}
      <section id="crm-clients" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            <div className="flex-1 space-y-4 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                <Users className="w-3.5 h-3.5" />
                <span>إدارة وعلاقات العملاء (CRM الحرفي)</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white leading-tight">
                عميلك مش رقم عابر.. <br />
                <span className="text-emerald-600 dark:text-emerald-400">ده شريك نجاحك وسمعة ورشتك!</span>
              </h2>

              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
                لكل عميل ملف متكامل يحفظ تفضيلاته، مقاسات بيته، ألوانه المفضلة، وسجل كل قطعة اشتراها منك. كشف حساب فوري يوضح المستحق والمتبقي بدون إحراج، وتواصل مباشر على واتساب بلمسة زر لتأكيد الطلب وتحديث مراحل التنفيذ.
              </p>

              <div className="space-y-2.5 pt-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>دليل عملاء ذكي بأرقامهم وعناوينهم وتاريخ تعاملاتهم</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>كشف حساب مديونيات ودفعات مقدمة بضغطة زر وبدون إحراج</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>مشاركة تحديثات التصنيع ومواعيد التسليم مباشرة عبر واتساب</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  نظّم حسابات زباينك وافتح ورشتك الآن 👥
                </button>
              </div>
            </div>

            {/* Interactive Preview Card for CRM */}
            <div className="w-full max-w-md p-6 rounded-3xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                    س
                  </div>
                  <div>
                    <p className="font-bold text-sm text-stone-900 dark:text-white">أ. سارة عبد الرحمن</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">عميل مميز • القاهرة (المعادي)</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  حساب منتظم
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700">
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-1">إجمالي المشتريات</span>
                  <span className="text-base font-black font-mono text-stone-900 dark:text-white">8,400 ج.م</span>
                </div>
                <div className="p-3 rounded-2xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700">
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold block mb-1">المتبقي للتحصيل</span>
                  <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">1,200 ج.م</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800 dark:text-stone-200">آخر طلبية: طقم معلقات مكرمية بوهيمي</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">قيد التشطيب</span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  تفضيل العميل: خيط قطن طبيعي عاجي بدون صبغات صناعية.
                </p>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>تواصل واتساب مباشر</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5.2 Smart Catalog: الكتالوج وعروض الأسعار بضغطة زر              */}
      {/* ------------------------------------------------------------- */}
      <section id="smart-catalog" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/60 dark:bg-stone-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-12">
            
            {/* Interactive Preview Card for Quotation & Catalog */}
            <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-sm text-stone-900 dark:text-white">عرض سعر رسمي موثق</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  QT-2026-08
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-stone-900 dark:text-stone-100">معلقة شمس الأصيل 120×80 سم</p>
                    <p className="text-stone-500 dark:text-stone-400">خشب زان طبيعي + خيوط مكرمية قطن مصري</p>
                  </div>
                  <span className="font-black font-mono text-stone-900 dark:text-white text-sm">2,650 ج.م</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                    <span className="text-stone-500 dark:text-stone-400 block mb-0.5">مدة التنفيذ المقدرة</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">5 أيام عمل</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                    <span className="text-stone-500 dark:text-stone-400 block mb-0.5">الدفعة المقدمة (عربون)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">50% (1,325 ج.م)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>مشاركة رابط العرض للعميل</span>
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
                <BookOpen className="w-3.5 h-3.5" />
                <span>الكتالوج المرجعي وعروض الأسعار</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white leading-tight">
                كتالوج يشرفك قدام زباينك.. <br />
                <span className="text-amber-600 dark:text-amber-400">وعروض أسعار موثقة بضغطة زر!</span>
              </h2>

              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
                ودّع التسعير المرتجل وعروض الأسعار المكتوبة على ورق ضايع! أنشئ عرض سعر احترافي بلمسة واحدة يوضح اسم المشغولة، الخامات، المقاسات، مدة التنفيذ، وشروط الدفعة المقدمة. شارك رابط الكتالوج مع زبائنك ليتصفحوا إبداعاتك بكل فخر.
              </p>

              <div className="space-y-2.5 pt-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>عروض أسعار رسمية برقم مسلسل وشروط واضحة تحفظ حقوقك</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>معرض مرجعي لمشغولات ورشتك يظهر تفاصيل كل قطعة بدقة</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>تصدير سريع لفواتير وعروض الأسعار لمشاركتها على شبكات التواصل</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  صمّم كتالوج ورشتك الآن مجاناً 📖
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5.3 Marketplace & Store: متجرك المستقل وسوق الشمساوية التكاملي  */}
      {/* ------------------------------------------------------------- */}
      <section id="craft-store" className="py-16 md:py-24 border-b border-stone-200 dark:border-[#1E293B] bg-gradient-to-b from-white via-amber-50/20 to-white dark:from-[#060B18] dark:via-[#0A1128] dark:to-[#060B18]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            <div className="flex-1 space-y-5 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-500/30">
                <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>أول وأكبر سوق للحرف اليدوية (Multi-Vendor Marketplace)</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0A1128] dark:text-white leading-tight">
                سوق الشمساوية.. <br />
                <span className="text-amber-600 dark:text-amber-400">أول منصة متعددة التجار متخصصة لفناني وصنّاع الحرف اليدوية في مصر والعالم العربي!</span>
              </h2>

              <p className="text-base sm:text-lg text-stone-700 dark:text-[#EADBC8] leading-relaxed font-medium">
                بمجرد فتح ورشتك، ووضع منتجاتك.. هتسمّع معاك في الأرشيف والكتالوج، ومنه بضغطة زر واحدة هتقدر تصدر منتجاتك لمتجرك الخاص، وهتحصل تلقائياً على <strong>واجهة متجر رقمي مستقلة</strong> بهويتك وعلامتك، مع إدراج مشغولاتك المعتمدة فوراً داخل <span className="text-amber-600 dark:text-amber-300 font-bold">سوق الشمساوية العام</span> للوصول لآلاف العملاء وتجار الجملة وعشاق الهاند ميد في مصر والخليج دون وسطاء ولا عمولات خفية.
              </p>

              <div className="space-y-3 pt-2 text-sm font-bold text-stone-800 dark:text-stone-200">
                <div className="flex items-start gap-2.5 justify-center lg:justify-start">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span><strong>متجر رقمي مستقل:</strong> رابط خاص باسم ورشتك وشعارك لعرض أعمالك واستقبال طلبات الزبائن مباشرة.</span>
                </div>
                <div className="flex items-start gap-2.5 justify-center lg:justify-start">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span><strong>تصنيف ذكي حسب نوع الحرفة:</strong> تبويب دقيق للمكرمية، الجلود الطبيعية، الفخار والخزف، الكروشيه، والأخشاب مع تقييمات العملاء الموثقة.</span>
                </div>
                <div className="flex items-start gap-2.5 justify-center lg:justify-start">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span><strong>فتح أبواب جديدة لتوريدات الجملة والتصدير:</strong> نافذة لتوريد المعارض الكبرى والفنادق والديكور الداخلي خليجياً ودولياً بربحية عادلة.</span>
                </div>
                <div className="flex items-start gap-2.5 justify-center lg:justify-start">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span><strong>ربط فوري بمخزن المنتجات والخزينة:</strong> كل مبيعة من المتجر تُخصم فوراً من رصيد مخزن المنتجات تامة التصنيع، وتسمّع في خزينتك تلقائياً بدون تكرار، مع تقارير فورية وتنبيهات حصرية.</span>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-7 py-3.5 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-xl shadow-amber-900/30 active:scale-95 transition-all cursor-pointer border border-amber-400/40"
                >
                  افتح متجرك واعرض شغلك في سوق الشمساوية 🛍️
                </button>
              </div>
            </div>

            {/* Interactive Preview Card for Store & Multi-Vendor Marketplace */}
            <div className="w-full max-w-md p-6 rounded-3xl bg-[#FDFBF7] dark:bg-[#0A1128] border-2 border-amber-300/80 dark:border-amber-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-amber-200 dark:border-[#1E293B]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-[#0A1128] dark:text-white block">سوق الشمساوية التكاملي</span>
                    <span className="text-[10px] text-stone-500 dark:text-amber-200/80">منصة الحرف اليدوية المعتمدة</span>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  متعدد التجار • Multi-Vendor 🌐
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#060B18] border border-amber-200/80 dark:border-[#1E293B] flex items-center gap-3 shadow-xs hover:border-amber-400 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-black text-xs text-[#0A1128] dark:text-white truncate">مرآة مكرمية بوهيمية قطر 60 سم</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">مكرمية</span>
                    </div>
                    <p className="text-[10px] text-stone-600 dark:text-stone-300 font-medium">ورشة شمس الأصيل • 3 قطع جاهزة للتسليم</p>
                  </div>
                  <span className="font-black font-mono text-xs text-amber-700 dark:text-amber-300">1,450 ج.م</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#060B18] border border-amber-200/80 dark:border-[#1E293B] flex items-center gap-3 shadow-xs hover:border-amber-400 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-black text-xs text-[#0A1128] dark:text-white truncate">حقيبة جلد طبيعي مدبوغ نباتياً</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">جلود طبيعية</span>
                    </div>
                    <p className="text-[10px] text-stone-600 dark:text-stone-300 font-medium">ورشة الباشا كرافت • تفصيل حسب الطلب</p>
                  </div>
                  <span className="font-black font-mono text-xs text-blue-700 dark:text-blue-300">2,800 ج.م</span>
                </div>
              </div>

              {/* مزامنة المخزون التلقائية */}
              <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-400/40 text-center space-y-1">
                <span className="text-xs font-black text-amber-900 dark:text-amber-300 block">
                  ⚡ مزامنة ذكية فورية مع الورشة
                </span>
                <p className="text-[11px] text-stone-700 dark:text-[#EADBC8] leading-tight">
                  أي طلب يتم اعتماده في السوق يخصم خاماته من مخزنك ويضيف عائداته لخزينتك مباشرة
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. Section 4: "صيانة عِددك وخطوط إنتاجك" (Equipment Health)      */}
      {/* ------------------------------------------------------------- */}
      <section id="tool-maintenance" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/60 dark:bg-stone-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            <div className="flex-1 space-y-4 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
                <Wrench className="w-3.5 h-3.5" />
                <span>حماية خطوط الإنتاج والعدد</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white leading-tight">
                صيانة عِددك وخطوط إنتاجك.. <br />
                <span className="text-amber-600 dark:text-amber-400">شغلك ميعطلش في عز الموسم!</span>
              </h2>

              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
                مقص اتكسر، ماكينة خياطة وقفت وقت تسليم أوردر مستعجل، أو شنيور محتاج تزييت؟ المنظومة بتديك تنبيه وقائي دوري لكل ماكينة وأداة في ورشتك، وبتحسب نسبة إهلاكها تلقائياً ضمن تكلفة المنتج عشان رأس مالك يفضل شغال ومحمي.
              </p>

              <div className="space-y-2 pt-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>تتبع مواعيد الصيانة الدورية وتغيير السيور والزيوت</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>حساب إهلاك العدد والمعدات بالمليم في تكلفة كل قطعة</span>
                </div>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>تاريخ وسجل إصلاحات الأصول لمنع المفاجآت المكلفة</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  احمي خط إنتاجك وافتح ورشتك الآن 🛠️
                </button>
              </div>
            </div>

            <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <span className="font-bold text-sm text-stone-900 dark:text-white">سجل صيانة ماكينات الورشة</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">جاهزة للتشغيل</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-stone-900 dark:text-stone-100">ماكينة خياطة صناعي جاك F4</p>
                    <p className="text-stone-500 dark:text-stone-400">الصيانة الوقائية: متبقي 5 أيام</p>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">تغيير زيت</span>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-stone-900 dark:text-stone-100">طاولة قص وفرز المكرميات</p>
                    <p className="text-stone-500 dark:text-stone-400">فحص المسطرة والمقابض</p>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">سليمة 100%</span>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-stone-900 dark:text-stone-100">مسدس شمع وسليكون حراري</p>
                    <p className="text-stone-500 dark:text-stone-400">فحص الكابل والحرارة</p>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-bold">مجدول</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. Section 5: "حكايات نجاح من قلب ورش الشمساوية ⭐"             */}
      {/* ------------------------------------------------------------- */}
      <section id="reviews" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              <Award className="w-3.5 h-3.5" />
              <span>شهادات حقيقية من صناع الهاند ميد</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              حكايات نجاح من قلب ورش الشمساوية ⭐
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              فنانين وحرفيين قدروا ينقلوا ورشهم لمستوى تاني من الاستقرار والمكسب.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            
            {/* Review 1 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                  "قبل الشمساوية كنت ببيع الجدارية بسعر الخامة ومبحسبش تعب إيدي! المنظومة فهمتني إزاي أسعر ساعة شغلي وأكسب صح."
                </p>
              </div>
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800">
                <p className="font-bold text-sm text-stone-900 dark:text-white">مريم فهمي</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">ورشة نغم المكرمية (القاهرة)</p>
              </div>
            </div>

            {/* Review 2 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                  "حاسبة الخامات أسطورية! بطلت اشتري بكر زيادة يركن في الدولاب.. الهدر قل بنسبة 80% وكل مليم في مكانه."
                </p>
              </div>
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800">
                <p className="font-bold text-sm text-stone-900 dark:text-white">منى عادل</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">ورشة غرزة وسنارة (الإسكندرية)</p>
              </div>
            </div>

            {/* Review 3 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                  "نظام العهد والخزن حللي مشكلة الفلوس اللي كانت بتضيع مع العمال.. بدوسة زرار بعرف متبقي إيه عند مين بالقرش."
                </p>
              </div>
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800">
                <p className="font-bold text-sm text-stone-900 dark:text-white">عم إبراهيم النوبي</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">ورشة أصيل للخوص والجريد (أسوان)</p>
              </div>
            </div>

            {/* Review 4 */}
            <div className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                  "التنبيه الوقائي لأفران الحرق وصيانة المعدات وفر عليا آلاف الجنيهات في تصليحات فجائية وقت ضغط الشغل."
                </p>
              </div>
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800">
                <p className="font-bold text-sm text-stone-900 dark:text-white">كريم ناصر</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">ورشة صلصال الفن (قنا)</p>
              </div>
            </div>

          </div>

          {/* Interactive Review / Suggestion Button */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-stone-100 dark:bg-stone-900 border border-amber-500/40 text-stone-800 dark:text-stone-200 hover:bg-amber-500/10 hover:border-amber-500 active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <span>شاركنا رأيك أو اقتراحك لورشتك القادمة 💡</span>
            </button>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. Section 6: "جديد عيلة الشمساوية.. إيه اللي طورناه لورشتك؟"   */}
      {/* ------------------------------------------------------------- */}
      <section id="whats-new" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/60 dark:bg-stone-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-xs font-bold border border-cyan-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span>تطويرات مستمرة ومباشرة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              جديد عيلة الشمساوية.. إيه اللي طورناه لورشتك؟
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              كل أسبوع بنضيف مزايا عملية تخدم سير شغلك وتريح بالك المالي والإنتاجي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300">ميزة حية</span>
                <span className="text-xs text-stone-400 font-mono">V 2.6</span>
              </div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                ميزان السيولة والمطابقة الفوري
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                كشف حي ومطابقة فورية لما هو متوفر في الخزائن الحقيقية والعهد وإنستاباي مع الدفتر المحاسبي بدون أي فروقات.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">ذكاء اصطناعي</span>
                <span className="text-xs text-stone-400 font-mono">V 2.6</span>
              </div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                دمج صقر وشموسة بأرقام الورشة الحقيقية
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                إجابات الذكاء الاصطناعي أصبحت مبنية على رصيد خزينتك الحالي، ونواقص خاماتك، وأوامر التشغيل المفتوحة فعلياً.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-800 dark:text-purple-300">حماية وإنتاج</span>
                <span className="text-xs text-stone-400 font-mono">V 2.6</span>
              </div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                قفل واعتماد الشهر المالي والمسار السريع
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                إغلاق دفاتر الشهر المالي بلمسة واحدة لحماية الإيرادات من التعديل، مع صرف خامات وتوريد منتج تام سريع.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8.5 FAQ Accordion: الأسئلة الشائعة من صناع الهاند ميد         */}
      {/* ------------------------------------------------------------- */}
      <section id="faq-section" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>إجابات واضحة ومباشرة</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              الأسئلة الشائعة من صناع الهاند ميد
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              كل اللي يدور في بالك عن المنظومة وحسابات الورشة وحماية أسرارك المهنية.
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: 'هل المنظومة صعبة أو محتاجة خبرة في الكمبيوتر والمحاسبة؟',
                a: 'أبداً! المنظومة مصممة بالكامل بلغة عربية مصرية بسيطة وسلسة، وخالية تماماً من المصطلحات المعقدة. لو بتعرف تستخدم واتساب هتتعلم تدير ورشتك وتسجل فواتيرك وتصرف خاماتك في أقل من 5 دقائق.',
              },
              {
                q: 'إزاي المنظومة بتحسب تكلفة الهدر وساعات التعب بدقة؟',
                a: 'حاسبة التكاليف الذكية بتطلب منك أطوال الخامات الأساسية ووقت العمل، وبتحسب تلقائياً نسبة الهدر الطبيعي (شراشيب، قصائص)، ونسبة استهلاك العِدد والكهرباء، وتضيف هامش ربح الورشة المعتمد لتصل لسعر بيع عادل ومربح.',
              },
              {
                q: 'هل تفاصيل خاماتي وأسعار مشغولاتي وتصاميمي في أمان وخصوصية؟',
                a: 'بكل تأكيد! بيانات كل ورشة معزولة ومحمية بالكامل في قاعدة بيانات خاصة مشفرة. لا يمكن لأي ورشة أو صانع آخر الاطلاع على أسرار تركيباتك أو أسعار مورديك أو تصميماتك الخاصة.',
              },
              {
                q: 'إيه الفرق بين دور صقر الشمساوية ودور شموسة؟',
                a: 'صقر 🦅 هو مستشارك التقني والحسابي للأطوال والغرز وحسابات التكلفة والاستشارات الفنية. أما شموسة ☀️ فهي مديرة أعمال ورشتك: تفكرك بمواعيد تسليم الزباين، تنبهك بنواقص الخامات، وتطابق لك السيولة النقدية في الخزائن والعهد أولاً بأول.',
              },
              {
                q: 'هل أقدر أستخدم المنظومة من الموبايل في قلب الورشة؟',
                a: 'نعم 100%! المنظومة متوافقة تماماً وتعمل بسلاسة فائقة على شاشات الموبايل والتابلت والكمبيوتر، تقدر تصرف خامة أو تسلم منتج وأنت واقف مع الصنايعية في قلب الورشة بلمسة زر واحدة.',
              },
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs'
                      : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 hover:border-stone-300 dark:hover:border-stone-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-right flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                      {faq.q}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isOpen
                          ? 'bg-amber-500 text-stone-950 rotate-180 shadow-2xs'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed border-t border-amber-200/40 dark:border-stone-800/80 pt-3 animate-in fade-in duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 9. Final High-Impact Call To Action Banner                     */}
      {/* ------------------------------------------------------------- */}
      <section className="py-16 md:py-20 relative overflow-hidden bg-gradient-to-br from-amber-600 via-amber-700 to-stone-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <AlShamsFalconEmblem size="lg" className="mx-auto drop-shadow-xl animate-bounce-subtle" />
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            مستني إيه؟ افتح ورشتك في عيلة الشمساوية اليوم
          </h2>

          <p className="text-base sm:text-lg text-amber-100 max-w-2xl mx-auto font-medium">
            انضم لمئات الحرفيين والصناع في مصر والوطن العربي.. نظم حساباتك، احسب أرباحك، وسيب صقر وشموسة يشيلوا عنك عبء الإدارة.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenRegister}
              className="px-8 py-4 rounded-2xl font-black text-lg bg-stone-950 hover:bg-stone-900 text-amber-300 shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-400/40"
            >
              افتح ورشتك في ثواني مجاناً 🌟
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 10. Footer                                                    */}
      {/* ------------------------------------------------------------- */}
      <footer className="py-12 bg-stone-900 text-stone-400 border-t border-stone-800 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-stone-800">
            
            <div className="flex items-center gap-3">
              <AlShamsFalconEmblem size="sm" />
              <div>
                <p className="font-bold text-white text-base">منظومة الشمساوية</p>
                <p className="text-xs text-stone-500">نظام إدارة الإنتاج والتسعير والمالية لورش الهاند ميد</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
              <a href="#safe-accounts" className="hover:text-amber-400 transition-colors">عقلك الحرفي</a>
              <a href="#ai-partners" className="hover:text-amber-400 transition-colors">صقر وشموسة AI</a>
              <a href="#craft-lifecycle" className="hover:text-amber-400 transition-colors">رحلة المشغولة</a>
              <a href="#tool-maintenance" className="hover:text-amber-400 transition-colors">صيانة العِدد</a>
              <a href="#reviews" className="hover:text-amber-400 transition-colors">حكايات الورش</a>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
            <p>صُنع بكل فخر وإتقان بأيادٍ مصرية لدعم الحرفيين وصناع الإبداع © 2026</p>
            <p>منظومة الشمساوية • رحلة كفاح تتحول لنجاح</p>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------------------- */}
      {/* 11. Modal: Share Review / Feedback / Suggestion                */}
      {/* ------------------------------------------------------------- */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fadeIn" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 sm:p-8 space-y-5 relative">
            
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(false)}
              className="absolute top-5 left-5 p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 text-right">
              <h3 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                <span>شاركنا رأيك أو اقتراحك لورشتك 💡</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                رأيك بيساعدنا نطور المنظومة لتناسب احتياجات ورشتك اليومية الحقيقية.
              </p>
            </div>

            {feedbackSuccess ? (
              <div className="py-8 text-center space-y-3 animate-fadeIn">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                <h4 className="text-lg font-bold text-stone-900 dark:text-white">شكراً لمشاركتك يا فنان!</h4>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  تم استلام رأيك ومقترحك مباشرة في صندوق إدارة المنظومة وسنأخذه في الاعتبار فوراً.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    اسمك أو اسم الفنان الكريم *
                  </label>
                  <input
                    type="text"
                    required
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="مثال: منى حسام"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      مجال الورشة / الحرفة
                    </label>
                    <input
                      type="text"
                      value={feedbackCraft}
                      onChange={(e) => setFeedbackCraft(e.target.value)}
                      placeholder="مكرمية، كروشيه، خشب، فخار..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:border-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      تقييمك للمنظومة
                    </label>
                    <div className="flex items-center gap-1 py-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className="cursor-pointer focus:outline-hidden"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= feedbackRating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-stone-300 dark:text-stone-700'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    رأيك، تجربتك، أو مقترح تتمنى وجوده *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="اكتب لنا رأيك الصادق أو ميزة تحب نضيفها لورشتك..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:border-amber-500 focus:outline-hidden resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    رقم الهاتف أو البريد (اختياري للتواصل والرد)
                  </label>
                  <input
                    type="text"
                    value={feedbackContact}
                    onChange={(e) => setFeedbackContact(e.target.value)}
                    placeholder="010xxxxxxx أو بريد إلكتروني"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className="px-6 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {feedbackSubmitting ? (
                      <span>جاري الإرسال...</span>
                    ) : (
                      <>
                        <span>إرسال الرأي</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
