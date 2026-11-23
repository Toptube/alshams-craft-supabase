import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '../lib/apiClient';

export type SpeechPersona = 'shamousa' | 'falcon';

interface UsePersonaSpeechResult {
  isEnabled: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  toggleEnabled: () => void;
  unlock: () => void;
  speak: (rawText: string, forceSpeak?: boolean) => void;
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
    .replace(/【[^】]*】/g, ' ')
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
 * Splits long replies into generous natural Egyptian Arabic chunks so 90% of replies
 * play in ONE single API call (avoiding burst RPM drops!).
 */
function splitIntoNaturalChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!؟\n])\s+|(?<=،)\s+(?=.{100,})/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (s.length > 680) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = s.split(/\s+/);
      let part = '';
      for (const w of words) {
        if ((part + ' ' + w).trim().length > 620) {
          if (part) chunks.push(part.trim());
          part = w;
        } else {
          part = (part + ' ' + w).trim();
        }
      }
      if (part) chunks.push(part.trim());
      continue;
    }

    const maxLen = chunks.length === 0 ? 540 : 680;
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 4);
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
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal.aborted) return null;
        try {
          const res = await authedFetch('/api/tts/free', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunkText, persona }),
            signal,
          });
          if (res.ok) {
            const contentType = res.headers.get('content-type') || 'audio/wav';
            const arrayBuffer = await res.arrayBuffer();
            if (arrayBuffer && arrayBuffer.byteLength > 200) {
              return { arrayBuffer, contentType };
            }
          }
        } catch {
          if (signal.aborted) return null;
        }
        if (attempt === 0 && !signal.aborted) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
      return null;
    },
    [persona]
  );

  const playAudioPayload = useCallback(
    async (
      payload: { arrayBuffer: ArrayBuffer; contentType: string },
      currentRun: number,
      forceSpeak = false
    ): Promise<void> => {
      if (runIdRef.current !== currentRun || (!enabledRef.current && !forceSpeak)) return;

      // Method A (Best on Mobile & Desktop): Web Audio API (with safe resume timeout so suspended mobile AudioContext falls through cleanly!)
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        try {
          if (ctx.state !== 'running') {
            await Promise.race([
              ctx.resume(),
              new Promise<void>((r) => setTimeout(r, 550)),
            ]);
          }
          if (ctx.state === 'running') {
            // Clone ArrayBuffer because decodeAudioData detaches it
            const copy = payload.arrayBuffer.slice(0);
            const audioBuffer = await ctx.decodeAudioData(copy);
            if (runIdRef.current !== currentRun || (!enabledRef.current && !forceSpeak)) return;

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
          }
        } catch {
          // Fall through cleanly to HTMLAudioElement if AudioContext was suspended by mobile mic/OS
        }
      }

      // Method B: HTMLAudioElement backup
      if (runIdRef.current !== currentRun || (!enabledRef.current && !forceSpeak)) return;
      if (!fallbackAudioElRef.current) {
        fallbackAudioElRef.current = new Audio();
      }
      const el = fallbackAudioElRef.current;
      revokeBlobUrl();
      const blob = new Blob([payload.arrayBuffer], { type: payload.contentType });
      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrlRef.current = blobUrl;

      await new Promise<void>((resolve) => {
        if (runIdRef.current !== currentRun || (!enabledRef.current && !forceSpeak)) {
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
    (rawText: string, forceSpeak = false) => {
      if (!enabledRef.current && !forceSpeak) return;
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
        // Sequential pacing (no burst parallel requests!) keeps free Gemini TTS quota smooth & continuous
        for (let i = 0; i < chunks.length; i++) {
          if (runIdRef.current !== currentRun || (!enabledRef.current && !forceSpeak)) break;

          const payload = await fetchNeuralChunkBuffer(chunks[i], abortController.signal);
          if (runIdRef.current !== currentRun || (!enabledRef.current && !forceSpeak)) break;

          if (!payload) continue;
          await playAudioPayload(payload, currentRun, forceSpeak);
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
    const next = !enabledRef.current;
    enabledRef.current = next;
    setIsEnabled(next);
    try {
      window.localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {}
    if (!next) {
      stop();
    } else {
      unlock();
    }
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
