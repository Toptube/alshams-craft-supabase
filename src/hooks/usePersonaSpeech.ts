import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechPersona = 'shamousa' | 'falcon';

interface UsePersonaSpeechResult {
  isEnabled: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  toggleEnabled: () => void;
  speak: (rawText: string) => void;
  stop: () => void;
}

const STORAGE_KEY_PREFIX = 'alshams_free_tts_enabled_';

/**
 * Cleans markdown, emojis, URLs, and decorative symbols so Arabic speech reads naturally.
 */
function sanitizeTextForSpeech(raw: string): string {
  return String(raw || '')
    // Strip URLs
    .replace(/https?:\/\/\S+/gi, '')
    // Strip markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip bold/italic/code/headings
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`~#>|]+/g, ' ')
    // Strip emojis & dingbats
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    // Replace bullets/dashes with short pauses
    .replace(/[•▪▸◆►✓✗✕]/g, '، ')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Splits long text into natural ~160-char Arabic chunks so mobile Chrome/Android
 * speechSynthesis never hits its silent 15-second cutoff bug.
 */
function splitIntoSpeechChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!؟\n])\s+|(?<=،)\s+(?=.{40,})/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (s.length > 180) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = s.split(/\s+/);
      let part = '';
      for (const w of words) {
        if ((part + ' ' + w).trim().length > 165) {
          if (part) chunks.push(part.trim());
          part = w;
        } else {
          part = (part + ' ' + w).trim();
        }
      }
      if (part) chunks.push(part.trim());
      continue;
    }

    if ((current + ' ' + s).trim().length <= 170) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Picks the closest free browser/OS Arabic voice for each persona:
 * - Shamousa: prefers ar-EG female (e.g. Microsoft Salma, Google ar-EG/ar female)
 * - Falcon: prefers ar-EG male (e.g. Microsoft Shakir, Hamed, Naayf, Majed, ar male)
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

    // Strongly prefer Egyptian Arabic (ar-EG)
    if (lang.startsWith('ar-eg')) score += 60;
    else if (lang.startsWith('ar-sa') || lang.startsWith('ar-ae')) score += 25;
    else score += 15;

    // Prefer neural/online free OS voices (like Edge Microsoft Salma/Shakir Online Natural)
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
 * 100% Free built-in Web Speech Synthesis hook (zero API cost, ON by default).
 * Tuned distinctly for Shamousa (warm cheerful feminine tone) and Falcon (dignified deep masculine tone).
 */
export function usePersonaSpeech(persona: SpeechPersona): UsePersonaSpeechResult {
  const isSupported =
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  const storageKey = `${STORAGE_KEY_PREFIX}${persona}`;

  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem(storageKey);
      // Default is ON as requested ("في الطبيعي بتاعها او الافتراضي بتاعها ان هي شغالة")
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

  useEffect(() => {
    if (!isSupported) return;
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
  }, [isSupported]);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    if (isSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (rawText: string) => {
      if (!isSupported || !enabledRef.current) return;
      const cleaned = sanitizeTextForSpeech(rawText);
      if (!cleaned) return;

      // Cancel any previous speech cleanly
      runIdRef.current += 1;
      const currentRun = runIdRef.current;
      try {
        window.speechSynthesis.cancel();
      } catch {}

      if (voicesRef.current.length === 0) {
        try {
          voicesRef.current = window.speechSynthesis.getVoices() || [];
        } catch {}
      }

      const chosenVoice = selectBestVoice(voicesRef.current, persona);
      const chunks = splitIntoSpeechChunks(cleaned);
      if (chunks.length === 0) return;

      setIsSpeaking(true);

      const speakNext = (idx: number) => {
        if (runIdRef.current !== currentRun || !enabledRef.current || idx >= chunks.length) {
          if (runIdRef.current === currentRun) setIsSpeaking(false);
          return;
        }
        try {
          const utterance = new SpeechSynthesisUtterance(chunks[idx]);
          utterance.lang = chosenVoice?.lang || 'ar-EG';
          if (chosenVoice) utterance.voice = chosenVoice;

          // Distinct voice tuning per persona
          if (persona === 'shamousa') {
            utterance.rate = 1.03;
            utterance.pitch = 1.14;
          } else {
            utterance.rate = 0.95;
            utterance.pitch = 0.82;
          }
          utterance.volume = 1;

          utterance.onend = () => {
            speakNext(idx + 1);
          };
          utterance.onerror = () => {
            if (runIdRef.current === currentRun) setIsSpeaking(false);
          };

          window.speechSynthesis.speak(utterance);
        } catch {
          if (runIdRef.current === currentRun) setIsSpeaking(false);
        }
      };

      speakNext(0);
    },
    [isSupported, persona]
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
      }
      return next;
    });
  }, [stop, storageKey]);

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      if (isSupported) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, [isSupported]);

  return {
    isEnabled,
    isSpeaking,
    isSupported,
    toggleEnabled,
    speak,
    stop,
  };
}
