import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Volume2, Play, Pause } from 'lucide-react';

export interface AlShamsAudioPlayerHandle {
  playTrack: () => Promise<void>;
  pauseTrack: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  isPlaying: boolean;
}

interface AlShamsAudioPlayerProps {
  className?: string;
  autoPlayOnMount?: boolean;
}

export const AlShamsAudioPlayer = forwardRef<AlShamsAudioPlayerHandle, AlShamsAudioPlayerProps>(
  ({ className = '' }, ref) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const anthemUrl = '/alshams_anthem.mp3';

    // التدرج الناعم للصوت (Ramp up volume)
    const rampVolume = (targetVolume = 0.85, durationMs = 1000) => {
      if (!audioRef.current) return;
      const audio = audioRef.current;
      audio.volume = 0.15;
      const stepTime = 60;
      const steps = durationMs / stepTime;
      const volumeStep = (targetVolume - 0.15) / steps;

      const interval = setInterval(() => {
        if (!audio || audio.paused) {
          clearInterval(interval);
          return;
        }
        if (audio.volume + volumeStep >= targetVolume) {
          audio.volume = targetVolume;
          clearInterval(interval);
        } else {
          audio.volume += volumeStep;
        }
      }, stepTime);
    };

    const playTrack = async () => {
      if (!audioRef.current) return;
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        rampVolume(0.85, 1000);
      } catch (err) {
        console.warn('[Audio Player] Autoplay prevented:', err);
      }
    };

    const pauseTrack = () => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      setIsPlaying(false);
    };

    const togglePlay = () => {
      if (isPlaying) {
        pauseTrack();
      } else {
        playTrack();
      }
    };

    const toggleMute = () => {
      if (!audioRef.current) return;
      audioRef.current.muted = !audioRef.current.muted;
    };

    useImperativeHandle(ref, () => ({
      playTrack,
      pauseTrack,
      togglePlay,
      toggleMute,
      isPlaying,
    }));

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const handleEnded = () => {
        setIsPlaying(false);
      };

      audio.addEventListener('ended', handleEnded);
      return () => {
        audio.removeEventListener('ended', handleEnded);
      };
    }, []);

    return (
      <div className={`relative inline-flex items-center ${className}`} dir="rtl">
        <audio ref={audioRef} src={anthemUrl} preload="auto" />

        {/* زر دائري خفيف ومدمج يجمع التحكم بالسماعة والتشغيل بدون حشو شريط التنقل */}
        <button
          type="button"
          onClick={togglePlay}
          className={`h-9 sm:h-10 px-2.5 sm:px-3 rounded-2xl flex items-center gap-1.5 transition-all duration-200 cursor-pointer border shadow-xs select-none active:scale-95 ${
            isPlaying
              ? 'bg-amber-500 text-stone-950 border-amber-400 ring-2 ring-amber-400/30'
              : 'bg-stone-100 hover:bg-amber-50 dark:bg-stone-850 dark:hover:bg-amber-950/30 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400'
          }`}
          title={isPlaying ? 'إيقاف نشيد الشمساوية' : 'تشغيل نشيد الشمساوية 🎵'}
          aria-label={isPlaying ? 'إيقاف النشيد' : 'تشغيل النشيد'}
        >
          <Volume2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isPlaying ? 'text-stone-950 animate-pulse' : 'text-amber-600 dark:text-amber-400'}`} />
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-stone-950" />
          ) : (
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-stone-700 dark:text-stone-300 ml-0.5" />
          )}
          <span className="hidden xl:inline text-[11px] font-black">
            {isPlaying ? 'النشيد' : 'النشيد'}
          </span>
        </button>
      </div>
    );
  }
);
