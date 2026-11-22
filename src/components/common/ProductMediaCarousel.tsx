import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Video, ExternalLink } from 'lucide-react';
import { EmbeddedSocialMediaCard } from './EmbeddedSocialMediaCard';
import {
  detectVideoPlatformLabel,
  getVideoThumbnailUrl,
  isValidHttpVideoUrl,
} from '../../lib/catalogStatus';

export interface ProductMediaCarouselProps {
  images: string[];
  videoUrl?: string | null;
  title?: string;
  topRightOverlay?: React.ReactNode;
  topLeftOverlay?: React.ReactNode;
  className?: string;
}

type MediaSlide =
  | { type: 'image'; url: string }
  | { type: 'video'; url: string; thumbUrl: string; platformLabel: string };

/**
 * Unified Product Media Carousel:
 * Displays ALL product photos in order, with the product Video ALWAYS as the LAST slide
 * inside the exact same top media viewer (ZERO split screen!).
 * Video player stays completely unmounted (lightweight static thumbnail only) until clicked.
 */
export const ProductMediaCarousel: React.FC<ProductMediaCarouselProps> = ({
  images,
  videoUrl,
  title = 'المنتج',
  topRightOverlay,
  topLeftOverlay,
  className = '',
}) => {
  const slides = useMemo<MediaSlide[]>(() => {
    const cleanImages = Array.from(
      new Set(
        (images || [])
          .filter((u): u is string => typeof u === 'string' && Boolean(u.trim()))
          .map((u) => u.trim())
      )
    );
    const list: MediaSlide[] =
      cleanImages.length > 0
        ? cleanImages.map((url) => ({ type: 'image', url }))
        : [{ type: 'image', url: '/alshams_falcon_emblem.png' }];

    if (videoUrl && isValidHttpVideoUrl(videoUrl)) {
      const cleanVideo = videoUrl.trim();
      list.push({
        type: 'video',
        url: cleanVideo,
        thumbUrl: getVideoThumbnailUrl(cleanVideo, cleanImages[0]),
        platformLabel: detectVideoPlatformLabel(cleanVideo),
      });
    }
    return list;
  }, [images, videoUrl]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // Reset when product/slides change
  useEffect(() => {
    setActiveIndex(0);
    setIsVideoPlaying(false);
  }, [images.join('|'), videoUrl]);

  const safeIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  const currentSlide = slides[safeIndex];
  const hasMultiple = slides.length > 1;

  const goToIndex = (nextIdx: number) => {
    const wrapped = (nextIdx + slides.length) % slides.length;
    setActiveIndex(wrapped);
    setIsVideoPlaying(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || !hasMultiple) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const delta = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(delta) < 35) return;
    // RTL-natural swipe: swipe right -> next slide, swipe left -> previous slide
    if (delta > 0) goToIndex(safeIndex + 1);
    else goToIndex(safeIndex - 1);
  };

  const isDirectVideoFile =
    currentSlide.type === 'video' &&
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(currentSlide.url);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Unified Top Media Frame (Photos + Video as Last Slide) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#0C1427] border border-[#D4CCBC] dark:border-[#22355E] select-none"
      >
        {topRightOverlay && !isVideoPlaying && (
          <div className="absolute top-2.5 right-2.5 z-20">{topRightOverlay}</div>
        )}
        {topLeftOverlay && !isVideoPlaying && (
          <div className="absolute top-2.5 left-2.5 z-20">{topLeftOverlay}</div>
        )}

        {currentSlide.type === 'image' ? (
          <img
            src={currentSlide.url}
            alt={title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover bg-[#E9E2D4] dark:bg-[#132040]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/alshams_falcon_emblem.png';
            }}
          />
        ) : isVideoPlaying ? (
          <div className="w-full h-full bg-black flex flex-col justify-center overflow-y-auto p-1">
            {isDirectVideoFile ? (
              <video
                src={currentSlide.url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain rounded-xl bg-black"
              />
            ) : (
              <EmbeddedSocialMediaCard
                url={currentSlide.url}
                title={title}
                isTrainerBadge={false}
              />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsVideoPlaying(true)}
            className="group relative w-full h-full cursor-pointer block"
          >
            <img
              src={currentSlide.thumbUrl}
              alt={`${title} - فيديو`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/15" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="w-16 h-16 rounded-full bg-[#EA580C]/95 group-hover:bg-[#EA580C] text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition">
                <Play className="w-7 h-7 fill-current mr-0.5" />
              </span>
              <span className="px-3 py-1 rounded-full bg-black/65 text-white text-xs font-black backdrop-blur-xs">
                اضغط لتشغيل الفيديو ({currentSlide.platformLabel})
              </span>
            </div>
            <a
              href={currentSlide.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[10px] font-bold inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>فتح بالمنصة</span>
            </a>
          </button>
        )}

        {/* Navigation Arrows & Slide Counter */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToIndex(safeIndex - 1);
              }}
              aria-label="السابق"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToIndex(safeIndex + 1);
              }}
              aria-label="التالي"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="absolute bottom-2.5 right-2.5 z-20 px-2.5 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-mono font-black backdrop-blur-xs">
              {currentSlide.type === 'video' ? (
                <span className="inline-flex items-center gap-1">
                  <Video className="w-3 h-3 text-[#FBBF24]" />
                  <span>فيديو · {safeIndex + 1}/{slides.length}</span>
                </span>
              ) : (
                <span>
                  {safeIndex + 1} / {slides.length}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Unified Thumbnail Strip (All Photos + Video Tile at the End) */}
      {hasMultiple && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {slides.map((slide, idx) => {
            const isActive = idx === safeIndex;
            if (slide.type === 'video') {
              return (
                <button
                  key={`vid_${idx}`}
                  type="button"
                  onClick={() => goToIndex(idx)}
                  title={`فيديو (${slide.platformLabel})`}
                  className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition bg-[#0C1427] ${
                    isActive
                      ? 'border-[#EA580C] ring-2 ring-[#EA580C]/35'
                      : 'border-[#D4CCBC] dark:border-[#22355E] opacity-80 hover:opacity-100'
                  }`}
                >
                  <img
                    src={slide.thumbUrl}
                    alt="فيديو"
                    className="w-full h-full object-cover opacity-70"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <span className="w-6 h-6 rounded-full bg-[#EA580C] text-white flex items-center justify-center shadow">
                      <Play className="w-3 h-3 fill-current mr-0.5" />
                    </span>
                  </span>
                </button>
              );
            }
            return (
              <button
                key={`img_${idx}`}
                type="button"
                onClick={() => goToIndex(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition ${
                  isActive
                    ? 'border-[#EA580C] ring-2 ring-[#EA580C]/35'
                    : 'border-[#D4CCBC] dark:border-[#22355E] opacity-75 hover:opacity-100'
                }`}
              >
                <img src={slide.url} alt="" className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
