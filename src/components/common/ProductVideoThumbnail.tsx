import React, { useState } from 'react';
import { Play, X, Video, ExternalLink } from 'lucide-react';
import { EmbeddedSocialMediaCard } from './EmbeddedSocialMediaCard';
import {
  detectVideoPlatformLabel,
  getVideoThumbnailUrl,
  isValidHttpVideoUrl,
} from '../../lib/catalogStatus';

interface ProductVideoThumbnailProps {
  videoUrl?: string | null;
  fallbackImage?: string | null;
  title?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Lightweight Click-to-Play Product Video Thumbnail.
 * Renders ONLY a tiny static thumbnail image + play overlay in lists/modals.
 * NEVER mounts heavy iframes or video players until the user explicitly clicks it!
 */
export const ProductVideoThumbnail: React.FC<ProductVideoThumbnailProps> = ({
  videoUrl,
  fallbackImage,
  title = 'فيديو المنتج',
  compact = false,
  className = '',
}) => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  if (!videoUrl || !isValidHttpVideoUrl(videoUrl)) return null;

  const cleanUrl = videoUrl.trim();
  const thumbSrc = getVideoThumbnailUrl(cleanUrl, fallbackImage);
  const platformLabel = detectVideoPlatformLabel(cleanUrl);
  const isDirectVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanUrl);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPlayerOpen(true);
          }}
          title={`تشغيل ${platformLabel}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0C1427]/90 hover:bg-[#EA580C] text-white text-[11px] font-black shadow-sm transition cursor-pointer ${className}`}
        >
          <Play className="w-3 h-3 fill-current" />
          <span>فيديو</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPlayerOpen(true);
          }}
          className={`group relative w-full rounded-2xl overflow-hidden border border-[#D4CCBC] dark:border-[#22355E] bg-[#0C1427] text-right cursor-pointer transition hover:border-[#EA580C] ${className}`}
        >
          <div className="relative w-full aspect-video max-h-48 overflow-hidden bg-slate-900">
            <img
              src={thumbSrc}
              alt={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-12 h-12 rounded-full bg-[#EA580C]/95 group-hover:bg-[#EA580C] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                <Play className="w-5 h-5 fill-current mr-0.5" />
              </span>
            </div>
            <div className="absolute bottom-2.5 right-3 left-3 flex items-center justify-between gap-2 text-white">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black bg-black/55 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                <Video className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>شاهد فيديو المنتج ({platformLabel})</span>
              </span>
              <span className="text-[10px] font-bold text-white/85 bg-black/45 px-2 py-0.5 rounded-md">
                تشغيل فوري
              </span>
            </div>
          </div>
        </button>
      )}

      {isPlayerOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          dir="rtl"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) setIsPlayerOpen(false);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
              <div className="flex items-center gap-2 min-w-0">
                <Video className="w-4 h-4 text-[#EA580C] shrink-0" />
                <h4 className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                  {title} · {platformLabel}
                </h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-[11px] font-bold inline-flex items-center gap-1 hover:opacity-90"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>فتح الرابط</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsPlayerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] flex items-center justify-center text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-[#0C1427]">
              {isDirectVideo ? (
                <video
                  src={cleanUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[70vh] rounded-xl bg-black"
                />
              ) : (
                <EmbeddedSocialMediaCard
                  url={cleanUrl}
                  title={title}
                  isTrainerBadge={false}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
