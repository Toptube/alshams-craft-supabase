import React, { useMemo, useState } from 'react';
import {
  Maximize2,
  X,
  Share2,
  Check,
  Play,
  GraduationCap,
  Trash2,
  Users,
  MessageSquare,
} from 'lucide-react';
import {
  SOCIAL_PLATFORM_META,
  SocialEmbedPlatform,
  parseSocialEmbedUrl,
} from '../../types/artisanGrowth';
import { AudienceRule } from '../../types/memberProfile';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface EmbeddedSocialMediaCardProps {
  title?: string;
  description?: string;
  url: string;
  platform?: SocialEmbedPlatform;
  authorName?: string;
  brandName?: string;
  isTrainerBadge?: boolean;
  audience?: AudienceRule;
  shareUrl?: string;
  onShareToFamily?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export const EmbeddedSocialMediaCard: React.FC<EmbeddedSocialMediaCardProps> = ({
  title,
  description,
  url,
  platform,
  authorName,
  brandName,
  isTrainerBadge = true,
  audience,
  shareUrl,
  onShareToFamily,
  onDelete,
  compact = false,
}) => {
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const parsed = useMemo(() => parseSocialEmbedUrl(url, platform), [url, platform]);
  const meta = SOCIAL_PLATFORM_META[parsed.platform] || SOCIAL_PLATFORM_META.other;

  const handleDirectShare = async () => {
    playButtonClickSound();
    const targetUrl =
      shareUrl ||
      `${window.location.origin}/?lesson=${encodeURIComponent(title || 'alshams-lesson')}`;
    const shareText = [
      title ? `🎓 ${title}` : '🎓 شرح مميز على منظومة الشمساوية',
      authorName ? `بواسطة الخبير/المدرب: ${authorName}${brandName ? ` (${brandName})` : ''}` : '',
      description ? description.slice(0, 140) : '',
      `شاهد الشرح مباشرة داخل منظومة الشمساوية: ${targetUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: title || 'درس من عيلة الشمساوية',
          text: shareText,
          url: targetUrl,
        });
        playSuccessSound();
        setShareFeedback('تمت المشاركة بنجاح');
        setTimeout(() => setShareFeedback(null), 2200);
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(shareText);
      playSuccessSound();
      setShareFeedback('تم نسخ رابط ومعلومات المنشور');
      setTimeout(() => setShareFeedback(null), 2200);
    } catch {
      setShareFeedback('جاهز للمشاركة');
      setTimeout(() => setShareFeedback(null), 1800);
    }
  };

  const audienceLabels = useMemo(() => {
    if (!audience) return null;
    const list: string[] = [];
    if (audience.artisans) list.push('فنانون');
    if (audience.suppliers) list.push('موردون');
    if (audience.customers) list.push('عملاء');
    if (list.length === 3) return 'ظاهر للجميع';
    if (list.length === 0) return 'خاص بك فقط';
    return `يظهر لـ: ${list.join(' · ')}`;
  }, [audience]);

  const frameBoxClass = parsed.isVertical
    ? 'mx-auto w-full max-w-[360px] aspect-[9/14] sm:aspect-[9/15]'
    : parsed.platform === 'facebook' || parsed.platform === 'instagram'
      ? 'w-full min-h-[380px] sm:min-h-[440px]'
      : 'w-full aspect-video';

  return (
    <>
      <div
        dir="rtl"
        className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden shadow-xs"
      >
        {/* شريط الهوية العلوي للمنشور المدمج — بدون عرض الرابط الخام */}
        <div className="px-4 py-3 border-b border-[#D4CCBC]/70 dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2 bg-[#EFE9DC]/60 dark:bg-[#132040]/70">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.color }}
              aria-hidden="true"
            />
            <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
              {meta.label}
            </span>
            {isTrainerBadge && (
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24]">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                <span>شرح خبير ومدرب</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {audienceLabels && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] ml-1">
                <Users className="w-3 h-3" />
                <span>{audienceLabels}</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setCinemaOpen(true);
              }}
              title="عرض ملء الشاشة داخل المنظومة"
              className="px-2.5 py-1.5 rounded-lg bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#1A2B54] dark:hover:bg-[#22355E] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
            >
              <Maximize2 className="w-3 h-3 text-[#FBBF24]" />
              <span>ملء الشاشة</span>
            </button>

            <button
              type="button"
              onClick={handleDirectShare}
              title="مشاركة المنشور مباشرة"
              className="px-2.5 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
            >
              {shareFeedback ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              <span>{shareFeedback || 'مشاركة'}</span>
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="حذف المنشور"
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* العنوان والشرح المكتوب */}
        {(title || description) && (
          <div className={`px-4 ${compact ? 'py-2.5' : 'py-3.5'} space-y-1`}>
            {title && (
              <h4 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
                {title}
              </h4>
            )}
            {description && (
              <p className="text-xs sm:text-[13px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            )}
          </div>
        )}

        {/* المشغل الداخلي الحقيقي (بدون أي خروج للمتصفح الخارجي) */}
        <div className="bg-[#060B18] relative w-full overflow-hidden">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#CBD5E1] pointer-events-none z-10">
              <div className="w-11 h-11 rounded-full bg-[#EA580C]/20 border border-[#EA580C]/50 flex items-center justify-center">
                <Play className="w-5 h-5 text-[#FBBF24] fill-current" />
              </div>
              <span className="text-xs font-bold">جاري استدعاء المشغل داخل المنظومة...</span>
            </div>
          )}

          <div className={frameBoxClass}>
            <iframe
              src={parsed.embedUrl}
              title={title || meta.label}
              onLoad={() => setIframeLoaded(true)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0 bg-[#060B18]"
            />
          </div>
        </div>

        {/* شريط سفلي هادئ للمشاركة في طبلية العيلة إن أتيح */}
        {onShareToFamily && (
          <div className="px-4 py-2.5 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex items-center justify-between gap-2 bg-[#EFE9DC]/40 dark:bg-[#132040]/40">
            <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
              يعمل بالكامل داخل شاشات منظومة الشمساوية بتحكم كامل وملء شاشة
            </span>
            <button
              type="button"
              onClick={onShareToFamily}
              className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>مشاركة في طبلية العيلة</span>
            </button>
          </div>
        )}
      </div>

      {/* شاشة السينما الكاملة داخل المنظومة (In-App Fullscreen Theater) */}
      {cinemaOpen && (
        <div
          className="fixed inset-0 z-[90] bg-[#040712]/95 backdrop-blur-md flex flex-col p-3 sm:p-6"
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                {title || meta.label}
              </h3>
              {authorName && (
                <p className="text-xs text-[#FBBF24] font-bold">
                  الخبير/المدرب: {authorName} {brandName ? `· ${brandName}` : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCinemaOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
              <span>إغلاق ملء الشاشة</span>
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center py-4 overflow-hidden">
            <div
              className={
                parsed.isVertical
                  ? 'h-full max-h-[82vh] aspect-[9/16] max-w-full rounded-2xl overflow-hidden border border-white/15 bg-black'
                  : 'w-full max-w-6xl aspect-video max-h-[82vh] rounded-2xl overflow-hidden border border-white/15 bg-black'
              }
            >
              <iframe
                src={parsed.embedUrl}
                title={title || meta.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
