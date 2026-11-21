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

// Tiny silent WAV URI strictly used to unlock mobile HTMLAudio autoplay during a user tap
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * Cleans markdown, emojis, URLs, and decorative symbols so Arabic neural speech reads naturally.
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
 * Splits long replies into natural ~240-char Egyptian Arabic phrases so:
 * 1) First audio sentence starts playing super quickly,
 * 2) While sentence #1 plays, sentence #2 pre-fetches in parallel for seamless human flow.
 */
function splitIntoNaturalChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!؟\n])\s+|(?<=،)\s+(?=.{60,})/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (s.length > 260) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = s.split(/\s+/);
      let part = '';
      for (const w of words) {
        if ((part + ' ' + w).trim().length > 235) {
          if (part) chunks.push(part.trim());
          part = w;
        } else {
          part = (part + ' ' + w).trim();
        }
      }
      if (part) chunks.push(part.trim());
      continue;
    }

    // Keep chunk #1 crisp (~170 chars) for ultra-fast start, subsequent chunks up to ~250 chars
    const maxLen = chunks.length === 0 ? 185 : 255;
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 10);
}

/**
 * Studio-Grade Free Human Egyptian Voice Hook (Zero Robotic Sound!):
 * - Primary: Calls `/api/tts/free` which delivers natural human Egyptian voices
 *   (Gemini 3.8 Neural Kore/Fenrir + Native Egyptian Neural Salma/Shakir).
 * - Parallel Lookahead Pre-fetching: Pre-fetches the next chunk while current chunk plays
 *   so multi-sentence replies flow continuously without awkward pauses.
 * - Offline Fallback Only: Falls back to browser `speechSynthesis` only if completely offline.
 */
export function usePersonaSpeech(persona: SpeechPersona): UsePersonaSpeechResult {
  const isSupported = true;
  const storageKey = `${STORAGE_KEY_PREFIX}${persona}`;

  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const runIdRef = useRef(0);
  const enabledRef = useRef(isEnabled);
  enabledRef.current = isEnabled;

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);

  const ensureAudioEl = useCallback((): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null;
    if (!audioElRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      audioElRef.current = el;
    }
    return audioElRef.current;
  }, []);

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
    if (activeAbortRef.current) {
      try {
        activeAbortRef.current.abort();
      } catch {}
      activeAbortRef.current = null;
    }
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        audioElRef.current.onended = null;
        audioElRef.current.onerror = null;
        audioElRef.current.removeAttribute('src');
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    revokeBlobUrl();
    setIsSpeaking(false);
  }, []);

  /**
   * Unlocks mobile HTMLAudio autoplay inside a user tap (Send / Quick Chip / Toggle)
   * so Shamousa & Falcon speak out loud automatically when replies arrive.
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
  }, [ensureAudioEl]);

  const fetchNeuralChunkBlob = useCallback(
    async (chunkText: string, signal: AbortSignal): Promise<Blob | null> => {
      try {
        const res = await authedFetch('/api/tts/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunkText, persona }),
          signal,
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        return blob && blob.size > 200 ? blob : null;
      } catch {
        return null;
      }
    },
    [persona]
  );

  const speakOfflineBrowserFallback = useCallback(
    (cleaned: string, currentRun: number) => {
      if (
        typeof window === 'undefined' ||
        typeof window.speechSynthesis === 'undefined' ||
        typeof window.SpeechSynthesisUtterance === 'undefined'
      ) {
        if (runIdRef.current === currentRun) setIsSpeaking(false);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(cleaned.slice(0, 450));
        u.lang = 'ar-EG';
        u.rate = persona === 'shamousa' ? 1.02 : 0.94;
        u.pitch = persona === 'shamousa' ? 1.1 : 0.85;
        u.onend = () => {
          if (runIdRef.current === currentRun) setIsSpeaking(false);
        };
        u.onerror = () => {
          if (runIdRef.current === currentRun) setIsSpeaking(false);
        };
        window.speechSynthesis.speak(u);
      } catch {
        if (runIdRef.current === currentRun) setIsSpeaking(false);
      }
    },
    [persona]
  );

  const speak = useCallback(
    (rawText: string) => {
      if (!enabledRef.current) return;
      const cleaned = sanitizeTextForSpeech(rawText);
      if (!cleaned) return;

      // Cancel previous run cleanly
      runIdRef.current += 1;
      const currentRun = runIdRef.current;

      if (activeAbortRef.current) {
        try {
          activeAbortRef.current.abort();
        } catch {}
      }
      const abortController = new AbortController();
      activeAbortRef.current = abortController;

      if (audioElRef.current) {
        try {
          audioElRef.current.pause();
          audioElRef.current.onended = null;
          audioElRef.current.onerror = null;
        } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      revokeBlobUrl();

      const chunks = splitIntoNaturalChunks(cleaned);
      if (chunks.length === 0) return;

      setIsSpeaking(true);

      const el = ensureAudioEl();
      if (!el) {
        speakOfflineBrowserFallback(cleaned, currentRun);
        return;
      }

      void (async () => {
        let playedAnyNeuralChunk = false;
        let nextChunkPromise: Promise<Blob | null> | null = fetchNeuralChunkBlob(
          chunks[0],
          abortController.signal
        );

        for (let i = 0; i < chunks.length; i++) {
          if (runIdRef.current !== currentRun || !enabledRef.current) break;

          const blob = await nextChunkPromise;
          if (runIdRef.current !== currentRun || !enabledRef.current) break;

          // Immediately pre-fetch the NEXT sentence in parallel while current sentence plays!
          nextChunkPromise =
            i + 1 < chunks.length
              ? fetchNeuralChunkBlob(chunks[i + 1], abortController.signal)
              : null;

          if (!blob) {
            if (!playedAnyNeuralChunk) {
              // Offline / server unreachable fallback only
              speakOfflineBrowserFallback(cleaned, currentRun);
              return;
            }
            continue;
          }

          playedAnyNeuralChunk = true;
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
            el.playbackRate = 1.0;
            try {
              (el as any).preservesPitch = true;
              (el as any).webkitPreservesPitch = true;
            } catch {}
            const playPromise = el.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => resolve());
            }
          });
        }

        revokeBlobUrl();
        if (runIdRef.current === currentRun) {
          setIsSpeaking(false);
        }
      })();
    },
    [ensureAudioEl, fetchNeuralChunkBlob, speakOfflineBrowserFallback]
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
      if (activeAbortRef.current) {
        try {
          activeAbortRef.current.abort();
        } catch {}
      }
      if (audioElRef.current) {
        try {
          audioElRef.current.pause();
        } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      revokeBlobUrl();
    };
  }, []);

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
