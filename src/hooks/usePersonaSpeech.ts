import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '../lib/apiClient';

export type SpeechPersona = 'shamousa' | 'falcon';

interface UsePersonaSpeechResult {
  isEnabled: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  toggleEnabled: () => void;
  unlock: () => void;
  speak: (rawText: string) => void;
  stop: () => void;
}

const STORAGE_KEY_PREFIX = 'alshams_free_tts_enabled_';

// Tiny silent WAV data URI used strictly to unlock mobile HTMLAudio autoplay inside a user tap gesture
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * Cleans markdown, emojis, URLs, and decorative symbols so Arabic speech reads naturally.
 */
function sanitizeTextForSpeech(raw: string): string {
  return String(raw || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`~#>|]+/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/[•▪▸◆►✓✗✕]/g, '، ')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Splits long replies into natural ~155-char Arabic chunks so neither native speechSynthesis
 * nor the free server audio fallback ever truncates long responses.
 */
function splitIntoSpeechChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!؟\n])\s+|(?<=،)\s+(?=.{35,})/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (s.length > 165) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = s.split(/\s+/);
      let part = '';
      for (const w of words) {
        if ((part + ' ' + w).trim().length > 155) {
          if (part) chunks.push(part.trim());
          part = w;
        } else {
          part = (part + ' ' + w).trim();
        }
      }
      if (part) chunks.push(part.trim());
      continue;
    }

    if ((current + ' ' + s).trim().length <= 160) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 12);
}

/**
 * Picks the closest free browser/OS Arabic voice for each persona:
 * - Shamousa: prefers ar-EG female (Microsoft Salma, Google Arabic female)
 * - Falcon: prefers ar-EG male (Microsoft Shakir, Hamed, Majed, Tarik)
 */
function selectBestVoice(voices: SpeechSynthesisVoice[], persona: SpeechPersona): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const arabicVoices = voices.filter((v) => /^ar\b/i.test(v.lang || ''));
  if (!arabicVoices.length) return null;

  const femaleHints = /(salma|laila|zeina|mariam|hoda|rana|fatima|amira|sara|female|woman|أنثى|سلمى|هدى|ليلى)/i;
  const maleHints = /(shakir|hamed|majed|tarik|naayf|bassel|omar|karim|male|man|ذكر|شاكر|ماجد|طارق|حامد)/i;

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const lang = (v.lang || '').toLowerCase();
    const name = `${v.name || ''} ${v.voiceURI || ''}`;
    let score = 0;

    if (lang.startsWith('ar-eg')) score += 60;
    else if (lang.startsWith('ar-sa') || lang.startsWith('ar-ae')) score += 25;
    else score += 15;

    if (/natural|online|neural|enhanced|premium/i.test(name)) score += 30;

    if (persona === 'shamousa') {
      if (femaleHints.test(name)) score += 50;
      if (maleHints.test(name)) score -= 40;
    } else {
      if (maleHints.test(name)) score += 50;
      if (femaleHints.test(name)) score -= 40;
    }

    return score;
  };

  return [...arabicVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || arabicVoices[0];
}

/**
 * 100% Free Dual-Layer Arabic Voice Engine (ALWAYS available on every phone & desktop):
 * 1. Primary: Native browser/OS SpeechSynthesis (prefers ar-EG female for Shamousa, ar-EG male for Falcon).
 * 2. Automatic Free Fallback: /api/tts/free MP3 stream played on a shared HTMLAudioElement whenever
 *    mobile WebViews/browsers lack SpeechSynthesis or Arabic voices or fail to start speaking.
 */
export function usePersonaSpeech(persona: SpeechPersona): UsePersonaSpeechResult {
  const hasNativeSpeech =
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  // Always true because HTML5 Audio + /api/tts/free works on every mobile & desktop browser
  const isSupported = true;
  const storageKey = `${STORAGE_KEY_PREFIX}${persona}`;

  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem(storageKey);
      // Default is ON as requested
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const runIdRef = useRef(0);
  const enabledRef = useRef(isEnabled);
  enabledRef.current = isEnabled;

  // Persistent HTMLAudioElement unlocked on user gesture so mobile browsers allow auto-playback
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const watchdogRef = useRef<number | null>(null);

  const ensureAudioEl = useCallback((): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null;
    if (!audioElRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      audioElRef.current = el;
    }
    return audioElRef.current;
  }, []);

  useEffect(() => {
    if (!hasNativeSpeech) return;
    const loadVoices = () => {
      try {
        voicesRef.current = window.speechSynthesis.getVoices() || [];
      } catch {
        voicesRef.current = [];
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [hasNativeSpeech]);

  const clearWatchdog = () => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  const revokeBlobUrl = () => {
    if (activeBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      } catch {}
      activeBlobUrlRef.current = null;
    }
  };

  const stop = useCallback(() => {
    runIdRef.current += 1;
    clearWatchdog();
    if (hasNativeSpeech) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        audioElRef.current.onended = null;
        audioElRef.current.onerror = null;
        audioElRef.current.removeAttribute('src');
      } catch {}
    }
    revokeBlobUrl();
    setIsSpeaking(false);
  }, [hasNativeSpeech]);

  /**
   * Call inside any user tap (Send / Chip / Toggle) so iOS/Android browsers permit auto-playback
   * when the AI reply arrives 1–3 seconds later.
   */
  const unlock = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const el = ensureAudioEl();
      if (el && el.paused && !el.src) {
        el.src = SILENT_AUDIO_URI;
        el.volume = 0.001;
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            el.pause();
            el.volume = 1;
            el.removeAttribute('src');
          }).catch(() => {
            el.volume = 1;
            el.removeAttribute('src');
          });
        }
      }
    } catch {}
    if (hasNativeSpeech) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
  }, [ensureAudioEl, hasNativeSpeech]);

  /**
   * 100% Free Audio Fallback: streams Arabic MP3 chunks from /api/tts/free
   */
  const playChunksViaFreeAudio = useCallback(
    async (chunks: string[], startIndex: number, currentRun: number) => {
      const el = ensureAudioEl();
      if (!el) {
        if (runIdRef.current === currentRun) setIsSpeaking(false);
        return;
      }

      for (let i = startIndex; i < chunks.length; i++) {
        if (runIdRef.current !== currentRun || !enabledRef.current) break;
        try {
          const res = await authedFetch('/api/tts/free', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunks[i], persona }),
          });
          if (!res.ok || runIdRef.current !== currentRun || !enabledRef.current) {
            break;
          }
          const blob = await res.blob();
          if (runIdRef.current !== currentRun || !enabledRef.current) break;

          revokeBlobUrl();
          const blobUrl = URL.createObjectURL(blob);
          activeBlobUrlRef.current = blobUrl;

          await new Promise<void>((resolve) => {
            if (runIdRef.current !== currentRun || !enabledRef.current) {
              resolve();
              return;
            }
            el.onended = () => resolve();
            el.onerror = () => resolve();
            el.src = blobUrl;
            el.volume = 1;
            // Distinct acoustic color per persona (Shamousa warm & bright, Falcon deeper & steady)
            try {
              (el as any).preservesPitch = false;
              (el as any).webkitPreservesPitch = false;
              el.playbackRate = persona === 'shamousa' ? 1.05 : 0.91;
            } catch {
              el.playbackRate = persona === 'shamousa' ? 1.04 : 0.95;
            }
            const playPromise = el.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => resolve());
            }
          });
        } catch {
          break;
        }
      }

      revokeBlobUrl();
      if (runIdRef.current === currentRun) {
        setIsSpeaking(false);
      }
    },
    [ensureAudioEl, persona]
  );

  const speak = useCallback(
    (rawText: string) => {
      if (!enabledRef.current) return;
      const cleaned = sanitizeTextForSpeech(rawText);
      if (!cleaned) return;

      // Cancel any previous playback
      runIdRef.current += 1;
      clearWatchdog();
      if (hasNativeSpeech) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (audioElRef.current) {
        try {
          audioElRef.current.pause();
          audioElRef.current.onended = null;
          audioElRef.current.onerror = null;
        } catch {}
      }
      revokeBlobUrl();

      const currentRun = runIdRef.current;
      const chunks = splitIntoSpeechChunks(cleaned);
      if (chunks.length === 0) return;

      setIsSpeaking(true);

      // Refresh voices list if empty
      if (hasNativeSpeech && voicesRef.current.length === 0) {
        try {
          voicesRef.current = window.speechSynthesis.getVoices() || [];
        } catch {}
      }

      const chosenVoice = hasNativeSpeech ? selectBestVoice(voicesRef.current, persona) : null;

      // If browser has NO native SpeechSynthesis OR no Arabic voice installed -> use 100% free audio fallback directly
      if (!hasNativeSpeech || !chosenVoice) {
        void playChunksViaFreeAudio(chunks, 0, currentRun);
        return;
      }

      const speakNativeChunk = (idx: number) => {
        if (runIdRef.current !== currentRun || !enabledRef.current || idx >= chunks.length) {
          clearWatchdog();
          if (runIdRef.current === currentRun) setIsSpeaking(false);
          return;
        }
        try {
          const utterance = new SpeechSynthesisUtterance(chunks[idx]);
          utterance.lang = chosenVoice.lang || 'ar-EG';
          utterance.voice = chosenVoice;

          if (persona === 'shamousa') {
            utterance.rate = 1.03;
            utterance.pitch = 1.14;
          } else {
            utterance.rate = 0.94;
            utterance.pitch = 0.82;
          }
          utterance.volume = 1;

          let started = false;
          utterance.onstart = () => {
            started = true;
            clearWatchdog();
          };
          utterance.onend = () => {
            clearWatchdog();
            speakNativeChunk(idx + 1);
          };
          utterance.onerror = () => {
            clearWatchdog();
            if (runIdRef.current === currentRun && enabledRef.current) {
              void playChunksViaFreeAudio(chunks, idx, currentRun);
            }
          };

          // Watchdog: if mobile browser silently swallows speechSynthesis without starting, auto-fallback to free audio
          clearWatchdog();
          watchdogRef.current = window.setTimeout(() => {
            if (!started && runIdRef.current === currentRun && enabledRef.current) {
              try {
                window.speechSynthesis.cancel();
              } catch {}
              void playChunksViaFreeAudio(chunks, idx, currentRun);
            }
          }, 800);

          window.speechSynthesis.speak(utterance);
        } catch {
          clearWatchdog();
          void playChunksViaFreeAudio(chunks, idx, currentRun);
        }
      };

      speakNativeChunk(0);
    },
    [hasNativeSpeech, persona, playChunksViaFreeAudio]
  );

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {}
      if (!next) {
        stop();
      } else {
        unlock();
      }
      return next;
    });
  }, [stop, storageKey, unlock]);

  useEffect(() => {
    return () => {
      clearWatchdog();
      if (hasNativeSpeech) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (audioElRef.current) {
        try {
          audioElRef.current.pause();
        } catch {}
      }
      revokeBlobUrl();
    };
  }, [hasNativeSpeech]);

  return {
    isEnabled,
    isSpeaking,
    isSupported,
    toggleEnabled,
    unlock,
    speak,
    stop,
  };
}
