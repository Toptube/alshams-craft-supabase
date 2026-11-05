import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Volume2, VolumeX, Play, Pause, Music } from 'lucide-react';

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
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);

    const anthemUrl = '/alshams_anthem.mp3';

    // التدرج الناعم للصوت (Ramp up volume)
    const rampVolume = (targetVolume = 0.85, durationMs = 1200) => {
      if (!audioRef.current) return;
      const audio = audioRef.current;
      audio.volume = 0.1;
      const stepTime = 60;
      const steps = durationMs / stepTime;
      const volumeStep = (targetVolume - 0.1) / steps;

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
        audioRef.current.muted = isMuted;
        await audioRef.current.play();
        setIsPlaying(true);
        rampVolume(0.85, 1400);
      } catch (err) {
        console.warn('[Audio Player] Autoplay note:', err);
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
      const nextMuted = !isMuted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
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

      const handleTimeUpdate = () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      };
    }, []);

    return (
      <div
        className={`inline-flex items-center gap-2 p-1.5 sm:p-2 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-blue-500/10 border border-amber-400/40 backdrop-blur-md shadow-xs select-none ${className}`}
        dir="rtl"
      >
        <audio ref={audioRef} src={anthemUrl} preload="auto" />

        {/* مؤشر الذبذبات الصوتية التفاعلي (Equalizer Waves) */}
        <div className="flex items-end gap-0.5 h-4 px-1" title="نشيد عيلة الشمساوية">
          <span
            className={`w-1 bg-amber-400 rounded-full transition-all duration-200 ${
              isPlaying && !isMuted ? 'h-3.5 animate-pulse' : 'h-1.5'
            }`}
          />
          <span
            className={`w-1 bg-amber-500 rounded-full transition-all duration-300 ${
              isPlaying && !isMuted ? 'h-4 animate-bounce' : 'h-2'
            }`}
          />
          <span
            className={`w-1 bg-amber-300 rounded-full transition-all duration-200 ${
              isPlaying && !isMuted ? 'h-3 animate-pulse' : 'h-1'
            }`}
          />
        </div>

        {/* تفاصيل التراك المصغرة */}
        <div className="hidden sm:flex flex-col text-right pr-0.5">
          <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 leading-none flex items-center gap-1">
            <Music className="w-3 h-3 text-amber-500 inline" />
            <span>نشيد الشمساوية</span>
          </span>
          <span className="text-[9px] text-stone-500 dark:text-stone-400 font-medium">
            {isPlaying ? 'شغال الآن 🎵' : 'اضغط للتشغيل'}
          </span>
        </div>

        {/* زر التشغيل / الإيقاف المؤقت */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center shadow-xs active:scale-95 transition cursor-pointer"
          title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل النشيد'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
        </button>

        {/* زر كتم / تفعيل الصوت بلمسة واحدة */}
        <button
          type="button"
          onClick={toggleMute}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
            isMuted
              ? 'bg-red-500/20 border-red-400/40 text-red-500'
              : 'bg-stone-200/60 dark:bg-stone-800/80 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700'
          }`}
          title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* شريط تقدم مصغر تحت الويدجت */}
        <div className="absolute -bottom-0.5 inset-x-2 h-0.5 bg-amber-500/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }
);
