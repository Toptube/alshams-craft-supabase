import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ExternalLink,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  LessonLayoutBlockConfig,
  SOCIAL_PLATFORM_META,
  SocialEmbedPlatform,
  VideoOrientation,
  getEffectiveLessonLayoutBlocks,
  getSkillLevelMeta,
  parseSocialEmbedUrl,
} from '../../types/artisanGrowth';
import { AudienceRule } from '../../types/memberProfile';
import { playButtonClickSound, playSuccessSound } from '../../lib/sounds';

interface DetectedVideoMeta {
  orientation: 'portrait' | 'landscape' | 'square';
  aspectRatio: number;
  embedUrl?: string;
  streamUrl?: string;
  slideshowImages?: string[];
  mediaType?: 'video' | 'photo_slideshow';
  resolvedUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  fetchedAt?: number;
}

const videoMetaClientCache = new Map<string, DetectedVideoMeta>();
const STREAM_CLIENT_TTL_MS = 25 * 60 * 1000;

interface EmbeddedSocialMediaCardProps {
  title?: string;
  description?: string;
  url: string;
  platform?: SocialEmbedPlatform;
  videoOrientation?: VideoOrientation;
  videoAspectRatio?: number;
  authorName?: string;
  brandName?: string;
  authorGender?: 'male' | 'female';
  isTrainerBadge?: boolean;
  audience?: AudienceRule;
  shareUrl?: string;
  onShareToFamily?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  layoutBlocksOverride?: LessonLayoutBlockConfig[];
}

export const EmbeddedSocialMediaCard: React.FC<EmbeddedSocialMediaCardProps> = ({
  title,
  description,
  url,
  platform,
  videoOrientation = 'auto',
  videoAspectRatio,
  authorName,
  brandName,
  authorGender,
  isTrainerBadge = true,
  audience,
  shareUrl,
  onShareToFamily,
  onDelete,
  compact = false,
  layoutBlocksOverride,
}) => {
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [playerActivated, setPlayerActivated] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const [streamRetriedOnce, setStreamRetriedOnce] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [layoutBlocks, setLayoutBlocks] = useState<LessonLayoutBlockConfig[]>(() =>
    layoutBlocksOverride || getEffectiveLessonLayoutBlocks()
  );

  const parsed = useMemo(() => parseSocialEmbedUrl(url, platform), [url, platform]);
  const meta = SOCIAL_PLATFORM_META[parsed.platform] || SOCIAL_PLATFORM_META.other;

  const [detectedMeta, setDetectedMeta] = useState<DetectedVideoMeta | null>(() => {
    const key = (parsed.originalUrl || '').toLowerCase();
    const cached = videoMetaClientCache.get(key);
    if (!cached) return null;
    if (cached.streamUrl && cached.fetchedAt && Date.now() - cached.fetchedAt > STREAM_CLIENT_TTL_MS) {
      videoMetaClientCache.delete(key);
      return null;
    }
    return cached;
  });

  useEffect(() => {
    setIframeLoaded(false);
    setStreamFailed(false);
    setStreamRetriedOnce(false);
    setSlideshowIndex(0);
  }, [url]);

  useEffect(() => {
    if (layoutBlocksOverride) {
      setLayoutBlocks(layoutBlocksOverride);
      return;
    }
    const syncLayout = () => setLayoutBlocks(getEffectiveLessonLayoutBlocks());
    syncLayout();
    window.addEventListener('alshams_growth_config_updated', syncLayout);
    return () => window.removeEventListener('alshams_growth_config_updated', syncLayout);
  }, [layoutBlocksOverride]);

  const fetchVideoMeta = useCallback(
    async (forceRefresh = false): Promise<DetectedVideoMeta | null> => {
      const target = parsed.originalUrl;
      if (!target || !/^https?:\/\//i.test(target)) return null;
      const cacheKey = target.toLowerCase();

      if (!forceRefresh) {
        const cached = videoMetaClientCache.get(cacheKey);
        if (cached) {
          const expired =
            Boolean(cached.streamUrl) &&
            Boolean(cached.fetchedAt) &&
            Date.now() - (cached.fetchedAt || 0) > STREAM_CLIENT_TTL_MS;
          if (!expired) {
            setDetectedMeta(cached);
            return cached;
          }
          videoMetaClientCache.delete(cacheKey);
        }
      } else {
        videoMetaClientCache.delete(cacheKey);
      }

      setResolving(true);
      try {
        const res = await fetch(
          `/api/utils/video-meta?url=${encodeURIComponent(target)}${forceRefresh ? '&refresh=1' : ''}`
        );
        const data = res.ok ? await res.json() : null;
        if (!data?.success) return null;
        const orient =
          data.orientation === 'portrait' || data.orientation === 'square' || data.orientation === 'landscape'
            ? data.orientation
            : parsed.isVertical
              ? 'portrait'
              : 'landscape';
        const ratio =
          typeof data.aspectRatio === 'number' && data.aspectRatio > 0.25 && data.aspectRatio < 4
            ? data.aspectRatio
            : orient === 'portrait'
              ? 9 / 16
              : orient === 'square'
                ? 1
                : 16 / 9;
        const next: DetectedVideoMeta = {
          orientation: orient,
          aspectRatio: ratio,
          embedUrl: typeof data.embedUrl === 'string' && data.embedUrl ? data.embedUrl : undefined,
          streamUrl: typeof data.streamUrl === 'string' && data.streamUrl ? data.streamUrl : undefined,
          slideshowImages: Array.isArray(data.slideshowImages) ? data.slideshowImages : undefined,
          mediaType: data.mediaType === 'photo_slideshow' ? 'photo_slideshow' : 'video',
          resolvedUrl: typeof data.resolvedUrl === 'string' && data.resolvedUrl ? data.resolvedUrl : undefined,
          thumbnailUrl: typeof data.thumbnailUrl === 'string' && data.thumbnailUrl ? data.thumbnailUrl : undefined,
          title: typeof data.title === 'string' && data.title ? data.title : undefined,
          fetchedAt: Date.now(),
        };
        videoMetaClientCache.set(cacheKey, next);
        setDetectedMeta(next);
        setStreamFailed(false);
        return next;
      } catch {
        return null;
      } finally {
        setResolving(false);
      }
    },
    [parsed.originalUrl, parsed.isVertical]
  );

  // Resolve TikTok/Facebook native streams & detect true aspect ratio + thumbnail via /api/utils/video-meta
  useEffect(() => {
    const target = parsed.originalUrl;
    if (!target || !/^https?:\/\//i.test(target)) return;

    const mustResolve =
      Boolean(parsed.needsResolve) ||
      parsed.platform === 'tiktok' ||
      parsed.platform === 'facebook';

    if (!mustResolve && videoOrientation && videoOrientation !== 'auto') {
      return;
    }

    if (!mustResolve && parsed.isVertical) {
      const cacheKey = target.toLowerCase();
      const immediate: DetectedVideoMeta = { orientation: 'portrait', aspectRatio: 9 / 16 };
      videoMetaClientCache.set(cacheKey, immediate);
      setDetectedMeta(immediate);
      return;
    }

    let cancelled = false;
    fetchVideoMeta(false).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [parsed.originalUrl, parsed.isVertical, parsed.needsResolve, parsed.platform, videoOrientation, fetchVideoMeta]);

  const effectiveStreamUrl = !streamFailed ? detectedMeta?.streamUrl || '' : '';
  const slideshowImages = detectedMeta?.slideshowImages || [];
  const hasSlideshow = slideshowImages.length > 0;
  const effectiveEmbedUrl = detectedMeta?.embedUrl || parsed.embedUrl || '';
  const effectiveOpenUrl = detectedMeta?.resolvedUrl || parsed.originalUrl;
  const isNativeStreamPlatform = parsed.platform === 'tiktok' || parsed.platform === 'facebook';
  const hasPlayableTarget = Boolean(effectiveStreamUrl || hasSlideshow || effectiveEmbedUrl);

  const handleReloadPlayer = async () => {
    playButtonClickSound();
    setIframeLoaded(false);
    setStreamFailed(false);
    setStreamRetriedOnce(false);
    if (isNativeStreamPlatform) {
      await fetchVideoMeta(true);
    }
    setIframeKey((k) => k + 1);
  };

  const handleNativeStreamError = async () => {
    if (!streamRetriedOnce && isNativeStreamPlatform) {
      setStreamRetriedOnce(true);
      const refreshed = await fetchVideoMeta(true);
      if (refreshed?.streamUrl) {
        return;
      }
    }
    setStreamFailed(true);
  };

  const effectiveOrientation: 'portrait' | 'landscape' | 'square' = useMemo(() => {
    if (videoOrientation && videoOrientation !== 'auto') return videoOrientation;
    if (detectedMeta?.orientation) return detectedMeta.orientation;
    if (parsed.isVertical) return 'portrait';
    return 'landscape';
  }, [videoOrientation, detectedMeta, parsed.isVertical]);

  const effectiveAspectRatio: number = useMemo(() => {
    if (videoOrientation === 'portrait') return videoAspectRatio && videoAspectRatio < 0.9 ? videoAspectRatio : 9 / 16;
    if (videoOrientation === 'square') return 1;
    if (videoOrientation === 'landscape') return videoAspectRatio && videoAspectRatio > 1.1 ? videoAspectRatio : 16 / 9;
    if (typeof videoAspectRatio === 'number' && videoAspectRatio > 0.25 && videoAspectRatio < 4) {
      return videoAspectRatio;
    }
    if (detectedMeta?.aspectRatio) return detectedMeta.aspectRatio;
    return effectiveOrientation === 'portrait' ? 9 / 16 : effectiveOrientation === 'square' ? 1 : 16 / 9;
  }, [videoOrientation, videoAspectRatio, detectedMeta, effectiveOrientation]);

  const handleDirectShare = async () => {
    playButtonClickSound();
    const targetUrl =
      shareUrl ||
      `${window.location.origin}/?lesson=${encodeURIComponent(title || 'alshams-lesson')}`;
    const shareText = [
      title ? `🎓 ${title}` : '🎓 شرح مميز على منظومة الشمساوية',
      authorName ? `بواسطة الخبير: ${authorName}${brandName ? ` (${brandName})` : ''}` : '',
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

  const isPortrait = effectiveOrientation === 'portrait';
  const isSquare = effectiveOrientation === 'square';

  const frameBoxClass = isPortrait
    ? 'mx-auto w-full max-w-[340px] sm:max-w-[380px]'
    : isSquare
      ? 'mx-auto w-full max-w-[460px]'
      : parsed.platform === 'facebook' || parsed.platform === 'instagram'
        ? 'w-full min-h-[340px] sm:min-h-[420px]'
        : 'w-full';

  const frameInlineStyle: React.CSSProperties | undefined =
    !effectiveStreamUrl &&
    (parsed.platform === 'facebook' || parsed.platform === 'instagram') &&
    !isPortrait &&
    !isSquare
      ? undefined
      : { aspectRatio: String(effectiveAspectRatio) };

  // Lightweight preview thumbnail (YouTube auto-thumb, TikTok cover, or Facebook og:image) so profile scrolls at 60fps
  const previewThumb = useMemo(() => {
    if (detectedMeta?.thumbnailUrl) return detectedMeta.thumbnailUrl;
    if (slideshowImages[0]) return slideshowImages[0];
    if (parsed.platform === 'youtube') {
      const m =
        parsed.originalUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/) ||
        parsed.originalUrl.match(/([A-Za-z0-9_-]{11})/);
      if (m?.[1]) return `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
    }
    return '';
  }, [detectedMeta?.thumbnailUrl, slideshowImages, parsed.platform, parsed.originalUrl]);

  const renderActiveMediaContent = (inCinema = false) => {
    // 1. Wait for TikTok/Facebook resolution BEFORE mounting any iframe so native HTML5 <video> always wins
    if (resolving && isNativeStreamPlatform && !effectiveStreamUrl && !hasSlideshow) {
      return (
        <div
          className={`${inCinema ? 'w-full h-full' : frameBoxClass} flex flex-col items-center justify-center gap-2 text-[#CBD5E1] py-16`}
          style={inCinema ? undefined : frameInlineStyle}
        >
          <Loader2 className="w-7 h-7 text-[#FBBF24] animate-spin" />
          <span className="text-xs font-bold">جاري تجهيز الفيديو من {meta.label}...</span>
        </div>
      );
    }

    // 2. Native HTML5 <video> player (TikTok & Facebook direct stream — ZERO Player error, ZERO < > arrows, ZERO external nag!)
    if (effectiveStreamUrl) {
      return (
        <div
          className={`${inCinema ? 'w-full h-full' : frameBoxClass} relative bg-black flex items-center justify-center`}
          style={inCinema ? undefined : frameInlineStyle}
        >
          <video
            ref={inCinema ? undefined : videoRef}
            key={`${effectiveStreamUrl}_${iframeKey}`}
            src={effectiveStreamUrl}
            poster={previewThumb || undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            controlsList="nodownload"
            onError={handleNativeStreamError}
            className="w-full h-full object-contain bg-black"
          />
        </div>
      );
    }

    // 3. TikTok Photo Slideshow (single-post photos only — zero TikTok error screen or related-video arrows)
    if (hasSlideshow) {
      const safeSlideIdx = Math.min(slideshowIndex, slideshowImages.length - 1);
      return (
        <div
          className={`${inCinema ? 'w-full h-full' : frameBoxClass} relative bg-black flex flex-col items-center justify-center overflow-hidden`}
          style={inCinema ? undefined : frameInlineStyle}
        >
          <img
            src={slideshowImages[safeSlideIdx]}
            alt={title || detectedMeta?.title || meta.label}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain bg-black"
          />
          {slideshowImages.length > 1 && (
            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 z-10 px-3">
              {slideshowImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSlideshowIndex(idx)}
                  aria-label={`صورة ${idx + 1}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === safeSlideIdx ? 'w-6 bg-[#FBBF24]' : 'w-2 bg-white/55 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // 4. Clean single-video fallback iframe (YouTube, Vimeo, Dailymotion, Instagram, or FB/TikTok fallback if stream unavailable)
    if (!effectiveEmbedUrl) {
      return (
        <div
          className={`${inCinema ? 'w-full h-full' : frameBoxClass} flex flex-col items-center justify-center gap-3 text-center p-6 text-[#CBD5E1]`}
          style={{ minHeight: '220px' }}
        >
          <p className="text-xs font-bold leading-relaxed max-w-xs">
            تعذر تحميل المشغل المباشر لهذا الرابط من {meta.label} — يمكنك إعادة المحاولة أو فتحه مباشرة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleReloadPlayer}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة التحميل</span>
            </button>
            <a
              href={effectiveOpenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح الفيديو الآن</span>
            </a>
          </div>
        </div>
      );
    }

    return (
      <>
        {!iframeLoaded && !inCinema && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#CBD5E1] pointer-events-none z-10">
            <Loader2 className="w-6 h-6 text-[#FBBF24] animate-spin" />
            <span className="text-xs font-bold">جاري تشغيل المشغل...</span>
          </div>
        )}

        <div className={inCinema ? 'w-full h-full' : frameBoxClass} style={inCinema ? undefined : frameInlineStyle}>
          <iframe
            key={`${effectiveEmbedUrl}_${iframeKey}`}
            src={effectiveEmbedUrl}
            title={title || detectedMeta?.title || meta.label}
            onLoad={() => setIframeLoaded(true)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0 bg-[#060B18]"
          />
        </div>
      </>
    );
  };

  const renderBlock = (blockId: LessonLayoutBlockConfig['id']) => {
    switch (blockId) {
      case 'header_bar':
        return (
          <div
            key="header_bar"
            className="px-4 py-3 border-b border-[#D4CCBC]/70 dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2 bg-[#EFE9DC]/60 dark:bg-[#132040]/70"
          >
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
                  <span>
                    شرح {getSkillLevelMeta('expert_trainer', authorGender).shortLabel}
                  </span>
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

              {playerActivated && (
                <button
                  type="button"
                  onClick={handleReloadPlayer}
                  title="إعادة تحميل الفيديو داخل المنظومة"
                  className="p-1.5 rounded-lg bg-[#E9E2D4] hover:bg-[#DDD4C2] dark:bg-[#1A2B54] dark:hover:bg-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {hasPlayableTarget && (
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setPlayerActivated(true);
                    setCinemaOpen(true);
                  }}
                  title="عرض ملء الشاشة داخل المنظومة"
                  className="px-2.5 py-1.5 rounded-lg bg-[#0C1427] hover:bg-[#1E293B] dark:bg-[#1A2B54] dark:hover:bg-[#22355E] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <Maximize2 className="w-3 h-3 text-[#FBBF24]" />
                  <span>ملء الشاشة</span>
                </button>
              )}

              <a
                href={effectiveOpenUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="فتح الفيديو على المنصة الأصلية"
                className="px-2.5 py-1.5 rounded-lg bg-[#E9E2D4] hover:bg-[#DDD4C2] dark:bg-[#1A2B54] dark:hover:bg-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] text-[11px] font-black inline-flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="hidden sm:inline">المصدر</span>
              </a>

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
        );

      case 'media':
        return (
          <div key="media" className="bg-[#060B18] relative w-full overflow-hidden flex justify-center">
            {!playerActivated ? (
              <div
                className={`${frameBoxClass} relative flex flex-col items-center justify-center cursor-pointer group overflow-hidden`}
                style={frameInlineStyle || { minHeight: '280px' }}
                onClick={() => {
                  playButtonClickSound();
                  setPlayerActivated(true);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPlayerActivated(true);
                  }
                }}
              >
                {previewThumb ? (
                  <img
                    src={previewThumb}
                    alt={title || meta.label}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0D162E] via-[#132040] to-[#060B18]" />
                )}
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/25 transition-colors" />
                <div className="relative z-10 flex flex-col items-center gap-2.5 text-center px-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl border-2 border-white/80 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: meta.color }}
                  >
                    {resolving ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Play className="w-6 h-6 text-white fill-current mr-[-2px]" />
                    )}
                  </div>
                  <span className="text-xs font-black text-white bg-black/60 px-3 py-1 rounded-full">
                    {resolving ? 'جاري تجهيز رابط الفيديو...' : `اضغط لتشغيل فيديو ${meta.label}`}
                  </span>
                </div>
              </div>
            ) : (
              renderActiveMediaContent(false)
            )}
          </div>
        );

      case 'title':
        if (!title && !detectedMeta?.title) return null;
        return (
          <div key="title" className={`px-4 ${compact ? 'pt-2.5 pb-1' : 'pt-3.5 pb-1'}`}>
            <h4 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] leading-snug">
              {title || detectedMeta?.title}
            </h4>
          </div>
        );

      case 'description':
        if (!description) return null;
        return (
          <div key="description" className={`px-4 ${compact ? 'py-2' : 'py-2.5'}`}>
            <p className="text-xs sm:text-[13px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          </div>
        );

      case 'footer_actions':
        if (!onShareToFamily) return null;
        return (
          <div
            key="footer_actions"
            className="px-4 py-2.5 border-t border-[#D4CCBC]/70 dark:border-[#22355E] flex items-center justify-between gap-2 bg-[#EFE9DC]/40 dark:bg-[#132040]/40"
          >
            <a
              href={effectiveOpenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] hover:text-[#EA580C] inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>لو الفيديو لم يعمل اضغط لفتحه مباشرة</span>
            </a>
            <button
              type="button"
              onClick={onShareToFamily}
              className="text-xs font-black text-[#C2410C] dark:text-[#FBBF24] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>مشاركة في طبلية العيلة</span>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div
        dir="rtl"
        className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden shadow-xs"
      >
        {layoutBlocks
          .filter((blk) => blk.visible !== false)
          .map((blk) => renderBlock(blk.id))}
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
                  الخبير: {authorName} {brandName ? `· ${brandName}` : ''}
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
                isPortrait
                  ? 'h-full max-h-[84vh] max-w-full rounded-2xl overflow-hidden border border-white/15 bg-black'
                  : isSquare
                    ? 'h-full max-h-[82vh] max-w-full aspect-square rounded-2xl overflow-hidden border border-white/15 bg-black'
                    : 'w-full max-w-6xl max-h-[82vh] rounded-2xl overflow-hidden border border-white/15 bg-black'
              }
              style={{ aspectRatio: String(effectiveAspectRatio) }}
            >
              {renderActiveMediaContent(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
