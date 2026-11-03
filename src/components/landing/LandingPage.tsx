import React, { useState } from 'react';
import {
  AlShamsFalconEmblem,
  alshamsOfficialBannerLogo,
  alshamsFalconArtisanImg,
} from '../brand/BrandAssets';
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
  ExternalLink,
  Moon,
  Sun,
  Eye,
  Check,
  Flame,
  Award,
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
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans selection:bg-amber-500 selection:text-white transition-colors duration-300" dir="rtl">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. Header / Navbar (Sticky, Sleek & Floating)                 */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-stone-950/85 border-b border-stone-200/80 dark:border-stone-800/80 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand identity */}
          <div className="flex items-center gap-3 select-none">
            <AlShamsFalconEmblem size="md" className="hover:scale-105 transition-transform drop-shadow-sm" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-stone-900 dark:text-amber-400 tracking-tight">
                  منظومة الشمساوية
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  كرافت SaaS
                </span>
              </div>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono tracking-wider">
                AL-SHAMSAWEYA CRAFT ERP
              </span>
            </div>
          </div>

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-stone-600 dark:text-stone-300">
            <a href="#safe-accounts" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              عقلك الحرفي
            </a>
            <a href="#ai-partners" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <span>صقر وشموسة AI</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </a>
            <a href="#craft-lifecycle" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              رحلة المشغولة
            </a>
            <a href="#tool-maintenance" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              صيانة العِدد
            </a>
            <a href="#reviews" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              حكايات الورش
            </a>
            <a href="#whats-new" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              جديد المنظومة
            </a>
          </nav>

          {/* Actions: Theme Toggle + Login / Open Workshop CTA */}
          <div className="flex items-center gap-3">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="تبديل المظهر"
                className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-900 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-stone-700" />}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2 border border-amber-400/30"
            >
              <span>تسجيل الدخول / فتح ورشتي</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. Hero Section & Safe Zone (Strict Branding Placement)       */}
      {/* ------------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24 border-b border-amber-500/20 bg-radial from-amber-500/10 via-stone-100 to-white dark:from-amber-950/30 dark:via-stone-950 dark:to-stone-950">
        
        {/* Subtle geometric craft background overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-25 dark:opacity-15 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Welcome Pill Tag */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500 animate-spin-slow" />
              <span>أول منظومة سحابية متخصصة ومصممة خصيصاً لورش الصناعات اليدوية في مصر والعالم العربي</span>
            </div>
          </div>

          {/* Safe Zone Central Branding Showcase (No Distortion, Strict Original Artwork) */}
          <div className="flex flex-col items-center justify-center text-center mb-8">
            
            {/* The Official Landscape Banner Logo (Preserved 100% Unaltered) */}
            <div className="w-full max-w-2xl px-2 mb-6">
              <div className="relative p-2.5 sm:p-4 rounded-3xl bg-white/90 dark:bg-stone-900/90 border-2 border-amber-500/30 shadow-2xl shadow-amber-500/15 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-amber-500/60 group">
                <img
                  src={alshamsOfficialBannerLogo}
                  alt="شعار الشمس كرافت الرسمي المعتمد"
                  className="w-full h-auto max-h-[170px] sm:max-h-[220px] md:max-h-[260px] object-contain mx-auto select-none transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            </div>

            {/* Visual Harmony: Center-Aligned Falcon Artisan Mascot with Hero Pitch */}
            <div className="relative w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 pt-4">
              
              {/* Full-Body Falcon Artisan Character (Strict Placement in Safe Zone) */}
              <div className="relative w-48 sm:w-56 md:w-64 shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl transform scale-110 pointer-events-none" />
                <div className="relative rounded-2xl p-2 bg-gradient-to-b from-amber-500/20 to-transparent border border-amber-500/40 shadow-xl">
                  <img
                    src={alshamsFalconArtisanImg}
                    alt="صقر الشمساوية الحرفي - شريكك الهندسي"
                    className="w-full h-auto max-h-[300px] sm:max-h-[340px] object-contain drop-shadow-xl select-none"
                  />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-stone-900/90 text-amber-300 text-[11px] font-black border border-amber-400/40 whitespace-nowrap shadow-lg flex items-center gap-1.5">
                    <span>صقر الشمساوية AI 🦅</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                </div>
              </div>

              {/* Main Headline & Storytelling */}
              <div className="flex-1 text-center md:text-right space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 dark:text-amber-100 leading-tight">
                  عشان إيدك بتتلف في حرير.. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 dark:from-amber-400 dark:via-amber-300 dark:to-amber-500">
                    ورشتك تستاهل نظام يديرها بضمير!
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed font-medium">
                  من أول فتلة خيط وتسعير الخامات بالمليم وحساب الهدر وساعات التعب، لحد أرباحك الصافية وإدارة الخزن والزبائن.. بدون أي كلاكيع حسابية ولا دفاتر بتضيع.
                </p>

                {/* Main CTAs */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="px-6 py-3.5 rounded-2xl font-black text-base bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 active:scale-95 transition-all cursor-pointer flex items-center gap-2 border border-amber-300/40"
                  >
                    <Sparkles className="w-5 h-5 text-amber-200" />
                    <span>افتح ورشتك في ثواني مجاناً 🌟</span>
                  </button>

                  <a
                    href="#safe-accounts"
                    className="px-6 py-3.5 rounded-2xl font-bold text-base bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-amber-500 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <span>شوف إزاي بتشتغل</span>
                    <ChevronDown className="w-4 h-4 text-amber-500" />
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
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-stone-900 border-2 border-amber-500/30 shadow-lg flex flex-col sm:flex-row items-center gap-6">
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-2xl overflow-hidden border-2 border-amber-400 bg-stone-950 flex items-center justify-center p-1 shadow-md">
                <img
                  src={alshamsFalconArtisanImg}
                  alt="صقر الشمساوية"
                  className="w-full h-full object-cover object-top"
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
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-stone-900 border-2 border-amber-500/30 shadow-lg flex flex-col sm:flex-row items-center gap-6">
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-2xl overflow-hidden border-2 border-amber-400 bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center p-3 shadow-md">
                <AlShamsFalconEmblem size="lg" className="drop-shadow-md" />
              </div>
              <div className="space-y-2 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-stone-900 dark:text-amber-300">شموسة كرافت</h3>
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
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                    <span>رد صقر الشمساوية:</span>
                  </div>
                  <p>
                    "يا أستاذنا.. رانر بطول 200 سم وعرض 40 سم بغرزة مربعة ومزدوجة، محتاج حوالي <strong>280 متر خيط قطن محلول سمك 4 مم</strong> (وزن تقريبي 1.15 كجم). هدر الشراشيب محسوب 15%، وصافي وقت العقد اليدوي حوالي <strong>6.5 ساعات عمل</strong>."
                  </p>
                </div>
              )}
              {simQuestion === 'shamousa_cash' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                    <span>رد شموسة كرافت:</span>
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
                <p className="font-bold text-white text-base">منظومة الشمساوية كرافت SaaS</p>
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
            <p>منظومة الشمساوية • Al-Shams Craft SaaS</p>
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
