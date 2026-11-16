import React, { useState, useEffect, useRef } from 'react';
import {
  AlShamsFalconEmblem,
  AlShamsBrandLogo,
  FalconMascotFull,
  ShamousaMascotFull,
} from '../brand/BrandAssets';
import {
  LandingCmsConfig,
  getStoredLandingCmsConfig,
} from '../../types/landingCms';
import { useFeatureFlags } from '../../types/featureFlags';
import { syncPlatformSettingsFromCloud } from '../../services/marketplaceCartService';
import { AlShamsWelcomeGate } from './AlShamsWelcomeGate';
import { AlShamsAudioPlayer, AlShamsAudioPlayerHandle } from './AlShamsAudioPlayer';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
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
  onOpenRegisterSupplier?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLogin,
  onOpenRegister,
  onOpenRegisterSupplier,
  isDarkMode = false,
  onToggleTheme,
}) => {
  // مشغل الصوت الترويجي وبوابة الاستقبال التفاعلية وإعدادات الهبوط الحية
  const audioPlayerRef = useRef<AlShamsAudioPlayerHandle | null>(null);
  const [isWelcomeGateOpen, setIsWelcomeGateOpen] = useState(false);
  const [cms, setCms] = useState<LandingCmsConfig>(() => getStoredLandingCmsConfig());
  const flags = useFeatureFlags();

  useEffect(() => {
    const syncCms = () => setCms(getStoredLandingCmsConfig());
    syncPlatformSettingsFromCloud()
      .then(() => setCms(getStoredLandingCmsConfig()))
      .catch(() => {});
    window.addEventListener('alshams_landing_cms_updated', syncCms);
    return () => window.removeEventListener('alshams_landing_cms_updated', syncCms);
  }, []);

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
    <div className="min-h-screen bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] font-sans selection:bg-[#EA580C] selection:text-white transition-colors duration-300" dir="rtl">
      
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
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#F7F3EA]/95 dark:bg-[#0D162E]/95 border-b border-[#D4CCBC] dark:border-[#22355E] transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3 sm:gap-4">
          
          {/* الشعار المعتمد للمنظومة بعرض لا يتجاوز 180px وبخلفية شفافة تماماً كأنه مدمج في نسيج الصفحة */}
          <div className="flex items-center gap-2 select-none shrink-0">
            <AlShamsFalconEmblem size="sm" className="hover:scale-105 transition-transform" />
            <AlShamsBrandLogo maxWidth={155} maxHeight={52} />
          </div>

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-6 text-sm font-bold text-[#334155] dark:text-[#CBD5E1]">
            {cms.header.navLinks.map((lnk) => (
              <a key={lnk.id} href={lnk.href} className="hover:text-[#EA580C] dark:hover:text-amber-300 transition-colors whitespace-nowrap">
                {lnk.label}
              </a>
            ))}
          </nav>

          {/* Actions: Audio Player + Welcome Gate + Theme Toggle + [ سجل الآن ] */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <AlShamsAudioPlayer ref={audioPlayerRef} />
            <PWAInstallButton variant="landing" />

            <button
              type="button"
              onClick={() => setIsWelcomeGateOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black bg-[#E9E2D4] dark:bg-[#132040] text-[#9A3412] dark:text-amber-200 border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] transition cursor-pointer shrink-0 whitespace-nowrap"
              title="فتح بوابة الترحيب التفاعلية"
            >
              <span>{cms.header.welcomeGateButtonText}</span>
            </button>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="تبديل مظهر الواجهة"
                title={isDarkMode ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] transition-colors cursor-pointer flex items-center justify-center shrink-0"
              >
                {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#C2410C]" />}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white shadow-md shadow-orange-600/25 transition-all cursor-pointer flex items-center gap-2 border border-[#FDBA74]/50 whitespace-nowrap shrink-0"
            >
              <span>{cms.header.ctaButtonText}</span>
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. Hero Section & Safe Zone (Strict Branding Placement)       */}
      {/* ------------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24 border-b border-[#D4CCBC] dark:border-[#22355E] bg-gradient-to-b from-[#F2ECE1] via-[#EBE4D6] to-[#F7F3EA] dark:from-[#060B18] dark:via-[#091226] dark:to-[#0D162E]">
        
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
              
              {/* Full-Body Falcon Artisan Character (Frameless & Seamless - Light/Dark Dynamic) */}
              <div className="relative w-52 sm:w-64 md:w-72 shrink-0 flex flex-col items-center justify-center select-none">
                <FalconMascotFull height={320} className="w-full max-h-[320px] sm:max-h-[360px]" />
                <div className="mt-2 px-4 py-1.5 rounded-2xl bg-[#0C1427] text-amber-300 text-xs font-black border border-[#EA580C]/45 whitespace-nowrap shadow-lg flex items-center gap-1.5 select-none">
                  <span>{cms.hero.falconBadgeText}</span>
                </div>
              </div>

              {/* Main Headline & Storytelling */}
              <div className="flex-1 text-center md:text-right space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-tight">
                  {cms.hero.headlineLine1} <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] dark:from-[#FDBA74] dark:via-amber-300 dark:to-[#FB923C]">
                    {cms.hero.headlineHighlight}
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                  {cms.hero.description}
                </p>

                {/* Main CTAs */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="px-6 py-3.5 rounded-2xl font-black text-base bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white shadow-xl shadow-orange-600/25 transition-all cursor-pointer flex items-center gap-2 border border-[#FDBA74]/50"
                  >
                    <Sparkles className="w-5 h-5 text-amber-100" />
                    <span>{cms.hero.primaryCtaText}</span>
                  </button>

                  <a
                    href="#safe-accounts"
                    className="px-6 py-3.5 rounded-2xl font-bold text-base bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[#0C1427] dark:text-[#F7F3EA] transition-all flex items-center gap-2"
                  >
                    <span>{cms.hero.secondaryCtaText}</span>
                    <ChevronDown className="w-4 h-4 text-[#EA580C]" />
                  </a>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-stone-200 dark:border-stone-800/80 text-xs font-bold text-stone-600 dark:text-stone-400">
                  <div className="flex items-center gap-1.5 justify-center md:justify-start">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{cms.hero.trustBadge1}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center md:justify-start">
                    <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{cms.hero.trustBadge2}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center md:justify-start">
                    <Zap className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span>{cms.hero.trustBadge3}</span>
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
      {cms.sections.safeAccounts.visible && (
      <section id="safe-accounts" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{cms.sections.safeAccounts.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              {cms.sections.safeAccounts.title}
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              {cms.sections.safeAccounts.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cms.sections.safeAccounts.cards.map((card, idx) => {
              const cardStyles = [
                { box: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Icon: Calculator },
                { box: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', Icon: Layers },
                { box: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', Icon: TrendingUp },
                { box: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', Icon: ShieldCheck },
              ];
              const style = cardStyles[idx % cardStyles.length];
              const CardIcon = style.Icon;
              return (
                <div key={card.id || idx} className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 transition-all hover:-translate-y-1 shadow-sm">
                  <div className={`w-12 h-12 rounded-2xl ${style.box} flex items-center justify-center mb-4`}>
                    <CardIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Section CTA */}
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={onOpenRegister}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <span>{cms.sections.safeAccounts.ctaText}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. Section 2: "شموسة وصقر معاك على الخط" (AI Craft Partners)  */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.aiPartners.visible && (
      <section id="ai-partners" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/60 dark:bg-stone-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              <Bot className="w-3.5 h-3.5" />
              <span>{cms.sections.aiPartners.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              {cms.sections.aiPartners.title}
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              {cms.sections.aiPartners.subtitle}
            </p>
          </div>

          {/* AI Duo Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            
            {/* Saqr The Engineer */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg flex flex-col sm:flex-row items-center gap-6">
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center select-none">
                <FalconMascotFull
                  isDark={isDarkMode}
                  height={120}
                  alt={cms.sections.aiPartners.falconName}
                  className="w-full h-full object-contain filter drop-shadow-md select-none"
                />
              </div>
              <div className="space-y-2 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-stone-900 dark:text-amber-300">{cms.sections.aiPartners.falconName}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-bold">{cms.sections.aiPartners.falconRoleBadge}</span>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  {cms.sections.aiPartners.falconDescription}
                </p>
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 pt-1">
                  {cms.sections.aiPartners.falconFootnote}
                </div>
              </div>
            </div>

            {/* Shamousa The Operations Buddy */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg flex flex-col sm:flex-row items-center gap-6">
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center select-none">
                <ShamousaMascotFull
                  isDark={isDarkMode}
                  height={120}
                  alt={cms.sections.aiPartners.shamousaName}
                  className="w-full h-full object-contain filter drop-shadow-md select-none"
                />
              </div>
              <div className="space-y-2 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-stone-900 dark:text-amber-300">{cms.sections.aiPartners.shamousaName}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold">{cms.sections.aiPartners.shamousaRoleBadge}</span>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                  {cms.sections.aiPartners.shamousaDescription}
                </p>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                  {cms.sections.aiPartners.shamousaFootnote}
                </div>
              </div>
            </div>

          </div>

          {/* Interactive AI Preview Simulator Box */}
          <div className="max-w-3xl mx-auto rounded-3xl bg-stone-900 text-stone-100 p-6 sm:p-8 border border-amber-500/30 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm text-amber-300">{cms.sections.aiPartners.simulatorTitle}</span>
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
                    <FalconMascotFull isDark={true} height={22} alt="صقر" className="w-5 h-5 rounded-full object-contain border border-amber-400" />
                    <span>رد {cms.sections.aiPartners.falconName}:</span>
                  </div>
                  <p>
                    "يا أستاذنا.. رانر بطول 200 سم وعرض 40 سم بغرزة مربعة ومزدوجة، محتاج حوالي <strong>280 متر خيط قطن محلول سمك 4 مم</strong> (وزن تقريبي 1.15 كجم). هدر الشراشيب محسوب 15%، وصافي وقت العقد اليدوي حوالي <strong>6.5 ساعات عمل</strong>."
                  </p>
                </div>
              )}
              {simQuestion === 'shamousa_cash' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-2">
                    <ShamousaMascotFull isDark={true} height={22} alt="شموسة" className="w-5 h-5 rounded-full object-contain border border-amber-400" />
                    <span>رد {cms.sections.aiPartners.shamousaName}:</span>
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
                {cms.sections.aiPartners.simulatorCtaText}
              </button>
            </div>
          </div>

        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. Section 3: "من أول فتلة خيط لحد المتجر والزبون"             */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.craftLifecycle.visible && (
      <section id="craft-lifecycle" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
              <Layers className="w-3.5 h-3.5" />
              <span>{cms.sections.craftLifecycle.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              {cms.sections.craftLifecycle.title}
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              {cms.sections.craftLifecycle.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {cms.sections.craftLifecycle.steps.map((step, idx) => (
              <div key={step.id || idx} className="relative p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-lg">
                  {step.stepNumber || idx + 1}
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={onOpenRegister}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <span>{cms.sections.craftLifecycle.ctaText}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5.1 CRM: إدارة وعلاقات العملاء ومستحقاتهم                       */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.crmClients.visible && (
      <section id="crm-clients" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            <div className="flex-1 space-y-4 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                <Users className="w-3.5 h-3.5" />
                <span>{cms.sections.crmClients.badge}</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white leading-tight">
                {cms.sections.crmClients.titleLine1} <br />
                <span className="text-emerald-600 dark:text-emerald-400">{cms.sections.crmClients.titleHighlight}</span>
              </h2>

              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
                {cms.sections.crmClients.description}
              </p>

              <div className="space-y-2.5 pt-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
                {cms.sections.crmClients.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-2 justify-center lg:justify-start">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {cms.sections.crmClients.ctaText}
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5.2 Smart Catalog: الكتالوج وعروض الأسعار بضغطة زر              */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.smartCatalog.visible && (
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
                <span>{cms.sections.smartCatalog.badge}</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white leading-tight">
                {cms.sections.smartCatalog.titleLine1} <br />
                <span className="text-amber-600 dark:text-amber-400">{cms.sections.smartCatalog.titleHighlight}</span>
              </h2>

              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
                {cms.sections.smartCatalog.description}
              </p>

              <div className="space-y-2.5 pt-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
                {cms.sections.smartCatalog.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-2 justify-center lg:justify-start">
                    <Check className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {cms.sections.smartCatalog.ctaText}
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5.3 Marketplace & Store: متجرك المستقل وسوق الشمساوية التكاملي  */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.craftStore.visible && (
      <section id="craft-store" className="py-16 md:py-24 border-b border-[#D4CCBC] dark:border-[#22355E] bg-gradient-to-b from-[#F2ECE1] via-[#EBE4D6] to-[#F2ECE1] dark:from-[#060B18] dark:via-[#0D162E] dark:to-[#060B18]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            <div className="flex-1 space-y-5 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-500/30">
                <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{cms.sections.craftStore.badge}</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-tight">
                {cms.sections.craftStore.titleLine1} <br />
                <span className="text-[#C2410C] dark:text-amber-400">{cms.sections.craftStore.titleHighlight}</span>
              </h2>

              <p className="text-base sm:text-lg text-[#334155] dark:text-[#CBD5E1] leading-relaxed font-medium">
                {cms.sections.craftStore.description}
              </p>

              <div className="space-y-3 pt-2 text-sm font-bold text-stone-800 dark:text-stone-200">
                {cms.sections.craftStore.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 justify-center lg:justify-start">
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-7 py-3.5 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-xl shadow-amber-900/30 active:scale-95 transition-all cursor-pointer border border-amber-400/40"
                >
                  {cms.sections.craftStore.ctaText}
                </button>
              </div>
            </div>

            {/* Interactive Preview Card for Store & Multi-Vendor Marketplace */}
            <div className="w-full max-w-md p-6 rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#D4CCBC] dark:border-[#22355E] shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-[#C2410C] dark:text-amber-400 flex items-center justify-center font-bold">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA] block">سوق الشمساوية التكاملي</span>
                    <span className="text-[10px] text-[#475569] dark:text-amber-200/80">منصة الحرف اليدوية المعتمدة</span>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  متعدد التجار • Multi-Vendor 🌐
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-3 shadow-xs hover:border-[#EA580C] transition-all">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-black text-xs text-[#0C1427] dark:text-[#F7F3EA] truncate">مرآة مكرمية بوهيمية قطر 60 سم</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">مكرمية</span>
                    </div>
                    <p className="text-[10px] text-[#334155] dark:text-[#CBD5E1] font-medium">ورشة شمس الأصيل • 3 قطع جاهزة للتسليم</p>
                  </div>
                  <span className="font-black font-mono text-xs text-[#C2410C] dark:text-amber-300">1,450 ج.م</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center gap-3 shadow-xs hover:border-[#EA580C] transition-all">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-black text-xs text-[#0C1427] dark:text-[#F7F3EA] truncate">حقيبة جلد طبيعي مدبوغ نباتياً</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">جلود طبيعية</span>
                    </div>
                    <p className="text-[10px] text-[#334155] dark:text-[#CBD5E1] font-medium">ورشة الباشا كرافت • تفصيل حسب الطلب</p>
                  </div>
                  <span className="font-black font-mono text-xs text-blue-700 dark:text-blue-300">2,800 ج.م</span>
                </div>
              </div>

              {/* مزامنة المخزون التلقائية */}
              <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-400/40 text-center space-y-1">
                <span className="text-xs font-black text-amber-900 dark:text-amber-300 block">
                  ⚡ مزامنة ذكية فورية مع الورشة
                </span>
                <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] leading-tight">
                  أي طلب يتم اعتماده في السوق يخصم خاماته من مخزنك ويضيف عائداته لخزينتك مباشرة
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. Section 4: "صيانة عِددك وخطوط إنتاجك" (Equipment Health)      */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.toolMaintenance.visible && (
      <section id="tool-maintenance" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/60 dark:bg-stone-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            <div className="flex-1 space-y-4 text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
                <Wrench className="w-3.5 h-3.5" />
                <span>{cms.sections.toolMaintenance.badge}</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white leading-tight">
                {cms.sections.toolMaintenance.titleLine1} <br />
                <span className="text-amber-600 dark:text-amber-400">{cms.sections.toolMaintenance.titleHighlight}</span>
              </h2>

              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
                {cms.sections.toolMaintenance.description}
              </p>

              <div className="space-y-2 pt-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
                {cms.sections.toolMaintenance.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-2 justify-center lg:justify-start">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="px-6 py-3 rounded-2xl font-bold text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {cms.sections.toolMaintenance.ctaText}
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6B. Section: "بوابة موردي وتجار ومصانع الخامات" (Suppliers B2B) */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.suppliersPromo?.visible && flags.supplierLandingPromoEnabled && flags.supplierRegistrationEnabled && (
      <section id="suppliers-promo" className="py-16 md:py-24 border-b border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#091226]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1 space-y-4 text-center lg:text-right">
              <p className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24]">
                {cms.sections.suppliersPromo.badge}
              </p>

              <h2 className="text-3xl sm:text-4xl font-black text-[#0C1427] dark:text-[#F7F3EA] leading-tight">
                {cms.sections.suppliersPromo.titleLine1} <br />
                <span className="text-[#EA580C] dark:text-amber-300">
                  {cms.sections.suppliersPromo.titleHighlight}
                </span>
              </h2>

              <p className="text-base sm:text-lg text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                {cms.sections.suppliersPromo.description}
              </p>

              <div className="space-y-2.5 pt-2 text-sm font-semibold text-[#0C1427] dark:text-[#E5E0D5]">
                {cms.sections.suppliersPromo.bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-center gap-2 justify-center lg:justify-start">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => (onOpenRegisterSupplier ? onOpenRegisterSupplier() : onOpenRegister())}
                  className="px-6 py-3.5 rounded-2xl font-black text-sm sm:text-base bg-[#0C1427] hover:bg-[#1A2B54] dark:bg-[#EA580C] dark:hover:bg-[#C2410C] text-[#FBBF24] dark:text-white border border-[#22355E] dark:border-[#FDBA74]/40 shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  <span>{cms.sections.suppliersPromo.ctaText}</span>
                </button>
              </div>
            </div>

            <div className="w-full max-w-md p-6 rounded-3xl bg-[#EFE9DC] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
                <div>
                  <span className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA] block">
                    بوابة موردي الخامات المستقلة
                  </span>
                  <span className="text-xs text-[#475569] dark:text-[#94A3B8]">
                    أقسام الحرف الأربعة · جملة وقطاعي
                  </span>
                </div>
                <Store className="w-5 h-5 text-[#EA580C] dark:text-[#FBBF24]" />
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                  <div>
                    <p className="font-black text-[#0C1427] dark:text-[#F7F3EA]">الحبال والنسيج</p>
                    <p className="text-[#475569] dark:text-[#94A3B8]">مكرمية، قطن محلول، خيوط كليم وتافتنج</p>
                  </div>
                  <span className="font-mono tabular-nums font-black text-[#C2410C] dark:text-[#FBBF24]">B2B</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                  <div>
                    <p className="font-black text-[#0C1427] dark:text-[#F7F3EA]">الخرز والتطريز والريزن</p>
                    <p className="text-[#475569] dark:text-[#94A3B8]">كريستال، إيبوكسي، سيليكون وألوان مايكا</p>
                  </div>
                  <span className="font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-300">جملة وقطاعي</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
                  <div>
                    <p className="font-black text-[#0C1427] dark:text-[#F7F3EA]">الأخشاب والخوص</p>
                    <p className="text-[#475569] dark:text-[#94A3B8]">قواعد خشبية، دوائر أركت، حلقات بامبو</p>
                  </div>
                  <span className="font-mono tabular-nums font-black text-[#0C1427] dark:text-[#F7F3EA]">متجر QR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. Section 5: "حكايات نجاح من قلب ورش الشمساوية ⭐"             */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.reviews.visible && (
      <section id="reviews" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              <Award className="w-3.5 h-3.5" />
              <span>{cms.sections.reviews.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              {cms.sections.reviews.title}
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              {cms.sections.reviews.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {cms.sections.reviews.items.map((rev, idx) => (
              <div key={rev.id || idx} className="p-6 rounded-3xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(Math.max(1, Math.min(5, rev.rating || 5)))].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                    "{rev.quote}"
                  </p>
                </div>
                <div className="pt-3 border-t border-stone-200 dark:border-stone-800">
                  <p className="font-bold text-sm text-stone-900 dark:text-white">{rev.author}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{rev.workshop}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Review / Suggestion Button */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-stone-100 dark:bg-stone-900 border border-amber-500/40 text-stone-800 dark:text-stone-200 hover:bg-amber-500/10 hover:border-amber-500 active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <span>{cms.sections.reviews.feedbackCtaText}</span>
            </button>
          </div>

        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. Section 6: "جديد عيلة الشمساوية.. إيه اللي طورناه لورشتك؟"   */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.whatsNew.visible && (
      <section id="whats-new" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-stone-100/60 dark:bg-stone-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-xs font-bold border border-cyan-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span>{cms.sections.whatsNew.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              {cms.sections.whatsNew.title}
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              {cms.sections.whatsNew.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cms.sections.whatsNew.items.map((item, idx) => {
              const badgePalette = [
                'bg-amber-500/20 text-amber-800 dark:text-amber-300',
                'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300',
                'bg-purple-500/20 text-purple-800 dark:text-purple-300',
              ];
              return (
                <div key={item.id || idx} className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${badgePalette[idx % badgePalette.length]}`}>{item.tag}</span>
                    <span className="text-xs text-stone-400 font-mono">{item.version}</span>
                  </div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8.5 FAQ Accordion: الأسئلة الشائعة من صناع الهاند ميد         */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.faq.visible && (
      <section id="faq-section" className="py-16 md:py-24 border-b border-stone-200 dark:border-stone-800/80 bg-white dark:bg-stone-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{cms.sections.faq.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white">
              {cms.sections.faq.title}
            </h2>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
              {cms.sections.faq.subtitle}
            </p>
          </div>

          <div className="space-y-3.5">
            {cms.sections.faq.items.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={faq.id || idx}
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. Final High-Impact Call To Action Banner                     */}
      {/* ------------------------------------------------------------- */}
      {cms.sections.finalCta.visible && (
      <section className="py-16 md:py-20 relative overflow-hidden bg-gradient-to-br from-amber-600 via-amber-700 to-stone-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <AlShamsFalconEmblem size="lg" isDark={true} className="mx-auto drop-shadow-xl animate-bounce-subtle" />
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            {cms.sections.finalCta.title}
          </h2>

          <p className="text-base sm:text-lg text-amber-100 max-w-2xl mx-auto font-medium">
            {cms.sections.finalCta.subtitle}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenRegister}
              className="px-8 py-4 rounded-2xl font-black text-lg bg-stone-950 hover:bg-stone-900 text-amber-300 shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-400/40"
            >
              {cms.sections.finalCta.ctaText}
            </button>
          </div>
        </div>
      </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 10. Footer                                                    */}
      {/* ------------------------------------------------------------- */}
      <footer className="py-12 bg-stone-900 text-stone-400 border-t border-stone-800 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-stone-800">
            
            <div className="flex items-center gap-3">
              <AlShamsFalconEmblem size="sm" isDark={true} />
              <div>
                <p className="font-bold text-white text-base">{cms.sections.footer.brandTitle}</p>
                <p className="text-xs text-stone-500">{cms.sections.footer.brandSubtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
              {cms.header.navLinks.map((link) => (
                <a key={link.id} href={link.href} className="hover:text-amber-400 transition-colors">
                  {link.label}
                </a>
              ))}
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
            <p>{cms.sections.footer.copyrightText}</p>
            <p>{cms.sections.footer.subTagline}</p>
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
