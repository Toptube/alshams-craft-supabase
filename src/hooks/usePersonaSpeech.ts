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

// Shared session-wide AudioContext so unlocking ONCE on any mobile tap stays unlocked permanently!
let sharedAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    try {
      sharedAudioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

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
 * Splits long replies into natural Egyptian Arabic chunks so sentence #1 plays quickly
 * while sentence #2 pre-fetches in parallel.
 */
function splitIntoNaturalChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!؟\n])\s+|(?<=،)\s+(?=.{65,})/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (s.length > 300) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = s.split(/\s+/);
      let part = '';
      for (const w of words) {
        if ((part + ' ' + w).trim().length > 260) {
          if (part) chunks.push(part.trim());
          part = w;
        } else {
          part = (part + ' ' + w).trim();
        }
      }
      if (part) chunks.push(part.trim());
      continue;
    }

    const maxLen = chunks.length === 0 ? 220 : 300;
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 8);
}

/**
 * Pure Studio-Grade Human Egyptian Voice Hook (ZERO Robotic Browser Speech!):
 * - Uses `/api/tts/free` (Gemini 3.8 Expressive Egyptian Human Voice + Native Egyptian Salma/Shakir Neural).
 * - Uses Web Audio API (`AudioContext.decodeAudioData`) so unlocking ONCE on any mobile tap
 *   guarantees automatic playback on Android Chrome, iOS Safari, Mi Browser, and Samsung Internet
 *   even after async network fetches!
 * - NEVER falls back to the robotic `window.speechSynthesis`.
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

  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fallbackAudioElRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);

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
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {}
      activeSourceRef.current = null;
    }
    if (fallbackAudioElRef.current) {
      try {
        fallbackAudioElRef.current.pause();
        fallbackAudioElRef.current.onended = null;
        fallbackAudioElRef.current.onerror = null;
        fallbackAudioElRef.current.removeAttribute('src');
      } catch {}
    }
    revokeBlobUrl();
    setIsSpeaking(false);
  }, []);

  /**
   * Unlocks the shared Web Audio Context inside any user tap (Send / Chip / Speaker button).
   * Once resumed in a user gesture, mobile browsers allow all future audio buffers to play freely!
   */
  const unlock = useCallback(() => {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }
        // Play a 1-sample silent buffer inside the gesture to permanently unlock iOS/Android WebAudio
        const silent = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(ctx.destination);
        src.start(0);
      } catch {}
    }
  }, []);

  // Automatically unlock Web Audio on the very first tap/click/key anywhere on mobile or desktop
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFirstGesture = () => {
      unlock();
      if (sharedAudioCtx && sharedAudioCtx.state === 'running') {
        window.removeEventListener('pointerdown', handleFirstGesture);
        window.removeEventListener('touchstart', handleFirstGesture);
        window.removeEventListener('keydown', handleFirstGesture);
      }
    };
    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [unlock]);

  const fetchNeuralChunkBuffer = useCallback(
    async (chunkText: string, signal: AbortSignal): Promise<{ arrayBuffer: ArrayBuffer; contentType: string } | null> => {
      try {
        const res = await authedFetch('/api/tts/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunkText, persona }),
          signal,
        });
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || 'audio/wav';
        const arrayBuffer = await res.arrayBuffer();
        return arrayBuffer && arrayBuffer.byteLength > 200
          ? { arrayBuffer, contentType }
          : null;
      } catch {
        return null;
      }
    },
    [persona]
  );

  const playAudioPayload = useCallback(
    async (
      payload: { arrayBuffer: ArrayBuffer; contentType: string },
      currentRun: number
    ): Promise<void> => {
      if (runIdRef.current !== currentRun || !enabledRef.current) return;

      // Method A (Best on Mobile & Desktop): Web Audio API (stays unlocked across async fetches!)
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        try {
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          // Clone ArrayBuffer because decodeAudioData detaches it
          const copy = payload.arrayBuffer.slice(0);
          const audioBuffer = await ctx.decodeAudioData(copy);
          if (runIdRef.current !== currentRun || !enabledRef.current) return;

          await new Promise<void>((resolve) => {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            activeSourceRef.current = source;
            source.onended = () => {
              if (activeSourceRef.current === source) {
                activeSourceRef.current = null;
              }
              resolve();
            };
            source.start(0);
          });
          return;
        } catch {
          // Fall through cleanly to HTMLAudioElement if decodeAudioData rejects
        }
      }

      // Method B: HTMLAudioElement backup
      if (runIdRef.current !== currentRun || !enabledRef.current) return;
      if (!fallbackAudioElRef.current) {
        fallbackAudioElRef.current = new Audio();
      }
      const el = fallbackAudioElRef.current;
      revokeBlobUrl();
      const blob = new Blob([payload.arrayBuffer], { type: payload.contentType });
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
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => resolve());
        }
      });
    },
    []
  );

  const speak = useCallback(
    (rawText: string) => {
      if (!enabledRef.current) return;
      const cleaned = sanitizeTextForSpeech(rawText);
      if (!cleaned) return;

      // Stop any previous speech cleanly
      runIdRef.current += 1;
      const currentRun = runIdRef.current;

      if (activeAbortRef.current) {
        try {
          activeAbortRef.current.abort();
        } catch {}
      }
      const abortController = new AbortController();
      activeAbortRef.current = abortController;

      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.onended = null;
          activeSourceRef.current.stop();
          activeSourceRef.current.disconnect();
        } catch {}
        activeSourceRef.current = null;
      }
      if (fallbackAudioElRef.current) {
        try {
          fallbackAudioElRef.current.pause();
        } catch {}
      }
      revokeBlobUrl();

      const chunks = splitIntoNaturalChunks(cleaned);
      if (chunks.length === 0) return;

      setIsSpeaking(true);

      void (async () => {
        let nextPromise: Promise<{ arrayBuffer: ArrayBuffer; contentType: string } | null> | null =
          fetchNeuralChunkBuffer(chunks[0], abortController.signal);

        for (let i = 0; i < chunks.length; i++) {
          if (runIdRef.current !== currentRun || !enabledRef.current) break;

          const payload = await nextPromise;
          if (runIdRef.current !== currentRun || !enabledRef.current) break;

          // Pre-fetch next chunk in parallel while current chunk plays
          nextPromise =
            i + 1 < chunks.length
              ? fetchNeuralChunkBuffer(chunks[i + 1], abortController.signal)
              : null;

          if (!payload) continue;
          await playAudioPayload(payload, currentRun);
        }

        revokeBlobUrl();
        if (runIdRef.current === currentRun) {
          setIsSpeaking(false);
        }
      })();
    },
    [fetchNeuralChunkBuffer, playAudioPayload]
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
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {}
      }
      if (fallbackAudioElRef.current) {
        try {
          fallbackAudioElRef.current.pause();
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
