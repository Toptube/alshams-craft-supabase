import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '../lib/apiClient';

interface UseInstantVoiceDictationOptions {
  /** Current text inside the input box (used as base prefix when starting) */
  getCurrentValue: () => string;
  /** Called live on every recognized word/chunk so text appears immediately in the input */
  onTextChange: (nextValue: string) => void;
  /** Optional language tag — defaults to Egyptian Arabic */
  lang?: string;
}

interface UseInstantVoiceDictationResult {
  isListening: boolean;
  isFallbackProcessing: boolean;
  toggleListening: () => void;
  stopListening: () => void;
}

/**
 * Instant, zero-cost, keyboard-speed voice dictation hook.
 *
 * Uses the native OS/Browser SpeechRecognition API (ar-EG) with:
 * - Live word-by-word streaming straight into the input box (no loading delay, no scary banners).
 * - Auto-keep-alive: if mobile Chrome/Android pauses SpeechRecognition during brief silence
 *   while the user hasn't tapped Stop, it silently restarts and appends seamlessly.
 * - Clean toggle: tap once -> mic lights red and writes live; tap again -> light turns off,
 *   full text remains ready in the input box to edit or send.
 * - Automatic quiet fallback to MediaRecorder ONLY on rare browsers lacking SpeechRecognition.
 */
export function useInstantVoiceDictation({
  getCurrentValue,
  onTextChange,
  lang = 'ar-EG',
}: UseInstantVoiceDictationOptions): UseInstantVoiceDictationResult {
  const [isListening, setIsListening] = useState(false);
  const [isFallbackProcessing, setIsFallbackProcessing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const wantListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const committedTextRef = useRef('');
  const latestInterimRef = useRef('');

  // Fallback MediaRecorder refs (only used if SpeechRecognition is unavailable)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Keep latest callbacks fresh without re-binding handlers
  const getCurrentValueRef = useRef(getCurrentValue);
  const onTextChangeRef = useRef(onTextChange);
  getCurrentValueRef.current = getCurrentValue;
  onTextChangeRef.current = onTextChange;

  const getSpeechRecognitionCtor = (): any => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  };

  const clearRestartTimer = () => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const joinCleanly = (a: string, b: string): string => {
    const left = a.trim();
    const right = b.trim();
    if (!left) return right;
    if (!right) return left;
    return `${left} ${right}`;
  };

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    clearRestartTimer();

    // Commit any trailing interim text so nothing is lost on Stop
    if (latestInterimRef.current.trim()) {
      const merged = joinCleanly(committedTextRef.current, latestInterimRef.current);
      committedTextRef.current = merged;
      latestInterimRef.current = '';
      onTextChangeRef.current(merged);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore already-stopped recognition
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }

    setIsListening(false);
  }, []);

  const startRecognitionSession = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor || !wantListeningRef.current) return;

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Track finalized text produced during THIS recognition session only
      let sessionFinal = '';

      recognition.onresult = (event: any) => {
        if (!wantListeningRef.current) return;

        let newFinalSegment = '';
        let interimSegment = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript || '';
          if (result.isFinal) {
            newFinalSegment += transcript + ' ';
          } else {
            interimSegment += transcript;
          }
        }

        if (newFinalSegment.trim()) {
          sessionFinal = joinCleanly(sessionFinal, newFinalSegment);
          committedTextRef.current = joinCleanly(committedTextRef.current, newFinalSegment);
          latestInterimRef.current = '';
        }

        latestInterimRef.current = interimSegment.trim();
        const combined = joinCleanly(committedTextRef.current, latestInterimRef.current);
        onTextChangeRef.current(combined);
      };

      recognition.onerror = (event: any) => {
        const err = event?.error;
        // Fatal permission/hardware errors -> stop cleanly
        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
          wantListeningRef.current = false;
          setIsListening(false);
          recognitionRef.current = null;
          return;
        }
        // 'no-speech' / 'network' / 'aborted' -> let onend silently restart while user keeps mic ON
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        // Commit any lingering interim fragment before restarting
        if (latestInterimRef.current.trim()) {
          committedTextRef.current = joinCleanly(committedTextRef.current, latestInterimRef.current);
          latestInterimRef.current = '';
          onTextChangeRef.current(committedTextRef.current);
        }

        if (wantListeningRef.current) {
          clearRestartTimer();
          restartTimerRef.current = window.setTimeout(() => {
            if (wantListeningRef.current) {
              startRecognitionSession();
            }
          }, 120);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      wantListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [lang]);

  // Quiet fallback ONLY for rare browsers without native SpeechRecognition
  const startFallbackRecorder = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setIsListening(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsListening(false);
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        setIsFallbackProcessing(true);

        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const rawBase64 = ev.target?.result as string;
            const res = await authedFetch('/api/ai/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: rawBase64, mimeType }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text && String(data.text).trim()) {
                const merged = joinCleanly(getCurrentValueRef.current(), String(data.text));
                onTextChangeRef.current(merged);
              }
            }
          } catch {
            // Silent fail without scary banners
          } finally {
            setIsFallbackProcessing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening || wantListeningRef.current) {
      stopListening();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (SpeechRecognitionCtor) {
      committedTextRef.current = getCurrentValueRef.current().trim();
      latestInterimRef.current = '';
      wantListeningRef.current = true;
      startRecognitionSession();
    } else {
      void startFallbackRecorder();
    }
  }, [isListening, startFallbackRecorder, startRecognitionSession, stopListening]);

  // Clean up automatically on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      clearRestartTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
  }, []);

  return {
    isListening,
    isFallbackProcessing,
    toggleListening,
    stopListening,
  };
}
