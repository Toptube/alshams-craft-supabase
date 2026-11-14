/**
 * نظام الصوتيات التفاعلية لمنظومة الشمساوية ERP
 * مولد نغمات برمجي متطور بالكامل باستخدام Web Audio API (بدون أي ملفات صوتية خارجية)
 * أصوات عالية ومميزة ومحسنة مع نغمات كليك تكتيكية حية وتنبيهات رنانة وتفاعلية وجذابة.
 */

// Global AudioContext singleton
let audioCtx: AudioContext | null = null;
let hasUserInteracted = false;
let lastPlayedSoundAt = 0;

// Audio Preference Key in localStorage
const SOUND_ENABLED_KEY = 'alshams_sound_enabled';

function markSoundPlayed() {
  if (typeof performance !== 'undefined') {
    lastPlayedSoundAt = performance.now();
  } else {
    lastPlayedSoundAt = Date.now();
  }
}

function getNowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * فحص هل الصوت مفعل في إعدادات المستخدم
 */
export function isSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(SOUND_ENABLED_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * تفعيل أو كتم الصوت وحفظ الاختيار في localStorage
 */
export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.warn('Could not save sound preference to localStorage:', err);
  }
}

/**
 * تبديل حالة الصوت بين التشغيل والكتم
 */
export function toggleSound(): boolean {
  const current = isSoundEnabled();
  const next = !current;
  setSoundEnabled(next);
  if (next) {
    playSuccessSound();
  }
  return next;
}

/**
 * تسجيل أول تفاعل للمستخدم لفتح سياق الصوت (AudioContext) وفق سياسات الأمان بالمتصفحات
 */
function initUserInteractionListener() {
  if (typeof window === 'undefined') return;

  const handleFirstInteraction = () => {
    hasUserInteracted = true;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', handleFirstInteraction);
    window.removeEventListener('keydown', handleFirstInteraction);
    window.removeEventListener('touchstart', handleFirstInteraction);
  };

  window.addEventListener('pointerdown', handleFirstInteraction, { once: true, passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { once: true, passive: true });
  window.addEventListener('touchstart', handleFirstInteraction, { once: true, passive: true });
}

/**
 * الحصول على سياق الصوت وضمان استئنافه بأمان
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!hasUserInteracted) return null;

  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  } catch (err) {
    console.warn('AudioContext not supported or blocked:', err);
    return null;
  }
}

/**
 * دالة مساعدة لتشغيل نغمة بمغلف صوتي دقيق
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakGain: number = 0.12,
  type: OscillatorType = 'sine'
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain), startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {
    // كتم الأخطاء لضمان استقرار التطبيق
  }
}

/**
 * اهتزاز لمسي خفيف للهواتف الذكية (Tactile Haptic Feedback)
 */
export function triggerHaptic(durationMs: number = 15): void {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(durationMs);
    }
  } catch {}
}

/**
 * صوت نقر خفيف جداً وغير مزعج لجميع الأزرار (Soft UI Tactile Micro-Click):
 * يعطي إحساساً دافئاً باستجابة الزر المجسم بدون أي حدة أو إزعاج للأذن
 */
export function playSoftMicroClickSound(): void {
  if (!isSoundEnabled()) return;
  hasUserInteracted = true;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.024);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.042, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.028);
    markSoundPlayed();
  } catch {}
}

/**
 * محرك التفاعل الحركي والصوتي الموحد لكافة أزرار منظومة الشمساوية:
 * يضيف ومضة لونية برتقالية دافئة (.alshams-btn-pressed) ويُشغل نقرة ناعمة غير مزعجة
 */
let globalFeedbackInitialized = false;
const pressedTimers = new WeakMap<Element, number>();

function findTactileElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(
    'button, [role="button"], input[type="submit"], input[type="button"], a[class*="rounded-"][class*="bg-"], a[class*="rounded-"][class*="border"]'
  );
  if (!(el instanceof HTMLElement)) return null;
  if (
    (el as HTMLButtonElement).disabled ||
    el.getAttribute('aria-disabled') === 'true' ||
    el.dataset.flat === 'true' ||
    el.classList.contains('no-3d')
  ) {
    return null;
  }
  return el;
}

function flashButtonPressed(el: HTMLElement) {
  const prevTimer = pressedTimers.get(el);
  if (prevTimer) {
    window.clearTimeout(prevTimer);
  }
  el.classList.add('alshams-btn-pressed');
  const timer = window.setTimeout(() => {
    el.classList.remove('alshams-btn-pressed');
    pressedTimers.delete(el);
  }, 240);
  pressedTimers.set(el, timer);
}

export function initGlobalButtonFeedback(): void {
  if (typeof window === 'undefined' || globalFeedbackInitialized) return;
  globalFeedbackInitialized = true;

  window.addEventListener(
    'pointerdown',
    (e) => {
      hasUserInteracted = true;
      const el = findTactileElement(e.target);
      if (el) {
        flashButtonPressed(el);
      }
    },
    { passive: true, capture: true }
  );

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      hasUserInteracted = true;
      const el = findTactileElement(e.target);
      if (el) {
        flashButtonPressed(el);
      }
    },
    { passive: true, capture: true }
  );

  window.addEventListener(
    'click',
    (e) => {
      const el = findTactileElement(e.target);
      if (!el || el.dataset.silent === 'true') return;
      const clickAt = getNowMs();
      flashButtonPressed(el);
      triggerHaptic(6);
      queueMicrotask(() => {
        if (lastPlayedSoundAt < clickAt - 10 && getNowMs() - lastPlayedSoundAt > 90) {
          playSoftMicroClickSound();
        }
      });
    },
    { passive: true }
  );
}

if (typeof window !== 'undefined') {
  initUserInteractionListener();
  initGlobalButtonFeedback();
}

/**
 * صوت نقر ميكانيكي ناعم (Soft Mechanical Click / Tap):
 * نقرة فيزيائية مريحة وممتعة عند لمس الأزرار والتفاعل مع الواجهة
 */
export function playTapSound(): void {
  markSoundPlayed();
  triggerHaptic(12);
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.025);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  } catch {}
}

/**
 * نغمة لطيفة لإضافة المنتج للسلة (Add To Cart Chime):
 * نغمة إنجاز خفيفة ثنائية النبرة مع كليك لمسي
 */
export function playAddToCartSound(): void {
  markSoundPlayed();
  triggerHaptic(20);
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    playTone(ctx, 880.0, now, 0.12, 0.12, 'sine');
    playTone(ctx, 1318.5, now + 0.07, 0.22, 0.14, 'triangle');
  } catch {}
}

/**
 * 1. صوت الضغط على الأزرار (Tactile Click Tone):
 * نغمة كليك حيوية، نقية وسريعة تُعطي إحساساً فيزيائياً فخماً وملموساً عند الضغط
 */
export function playButtonClickSound(): void {
  markSoundPlayed();
  triggerHaptic(15);
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.032);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch {}
}

/**
 * 2. صوت التنقل بين التابات (Tab Switch / Filter Tone):
 * نقرة أنعم وأعلى نبرة للانتقال بين أقسام الإشعارات
 */
export function playTabSwitchSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.03);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  } catch {}
}

/**
 * 3. رنين الإشعارات العالي والمميز (Vibrant Notification Chime):
 * لحن جرس كريستالي عالي ثلاثي النبرات (A5 -> C#6 -> E6) مسموع ومبهج
 */
export function playNotificationChimeSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1567.98Hz)
  playTone(ctx, 1046.5, now + 0.00, 0.22, 0.16, 'triangle');
  playTone(ctx, 1318.5, now + 0.10, 0.26, 0.18, 'sine');
  playTone(ctx, 1567.98, now + 0.20, 0.40, 0.20, 'sine');
}

/**
 * 4. رنين الإشعارات العاجلة (Urgent Alert Chime):
 * تنبيه مزدوج عاجل ونشط يوقظ الانتباه لمواعيد التسليم ونفاد الخامات
 */
export function playUrgentNotificationSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 987.77, now + 0.00, 0.12, 0.20, 'triangle');
  playTone(ctx, 1318.51, now + 0.08, 0.14, 0.22, 'sine');
  playTone(ctx, 1567.98, now + 0.16, 0.35, 0.24, 'sine');
}

/**
 * 5. صوت التنبيه العام (Alert Sound):
 * رنين مزدوج قوي ومميز
 */
export function playAlertSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 920, now + 0.00, 0.14, 0.16, 'triangle');
  playTone(ctx, 1240, now + 0.08, 0.28, 0.18, 'sine');
}

/**
 * 6. صوت الترحيب (Welcome Sound):
 * نغمة تصاعدية ثلاثية دافئة ومبهجة
 */
export function playWelcomeSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 523.25, now + 0.00, 0.28, 0.12, 'sine');
  playTone(ctx, 659.25, now + 0.12, 0.32, 0.14, 'sine');
  playTone(ctx, 783.99, now + 0.25, 0.45, 0.16, 'triangle');
}

/**
 * 7. صوت النجاح (Success Sound):
 * نغمة إيجابية واضحة ومريحة تُعزف عند إتمام حفظ المنتج أو الفاتورة أو التصدير
 */
export function playSuccessSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 587.33, now + 0.00, 0.18, 0.14, 'triangle');
  playTone(ctx, 880.00, now + 0.09, 0.35, 0.16, 'sine');
}

/**
 * نغمة إنجاز مهمة هادئة (Peaceful Task Completion Chime):
 * نغمة إنجاز هادئة ومبهجة تشجع الفنان عند إتمام مهمة يومية بتأثير شطب سلس
 */
export function playTaskDoneSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // لحن رقيق مهدئ (F5 -> A5 -> C6)
  playTone(ctx, 698.46, now + 0.00, 0.16, 0.12, 'sine');
  playTone(ctx, 880.00, now + 0.08, 0.20, 0.14, 'sine');
  playTone(ctx, 1046.50, now + 0.16, 0.38, 0.16, 'triangle');
}

/**
 * 8. صوت الخطأ (Error Sound):
 * نغمة مزدوجة منخفضة ولطيفة
 */
export function playErrorSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(ctx, 280, now + 0.00, 0.12, 0.14, 'sine');
  playTone(ctx, 220, now + 0.10, 0.20, 0.13, 'sine');
}

/**
 * 9. صوت تقليب الصفحة / التنقل (Page Flip / Navigation Sound):
 */
export function playPageFlipSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch {}
}

/**
 * 10. نغمة إشعار وصول رسائل البريد والمراسلات (النغمة المخصصة رقم 7):
 * تشغّل ملف النغمة المعتمد (/assets/aistudio/7_e9b28b0b.mp3) مع تهيئة مسبقة
 * وبديل صوتي برمجي آمن في حال تعذر تحميل الملف.
 */
const MAIL_RINGTONE_SRC = '/assets/aistudio/7_e9b28b0b.mp3';
let mailRingtoneAudio: HTMLAudioElement | null = null;

function getMailRingtoneAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!mailRingtoneAudio) {
    try {
      mailRingtoneAudio = new Audio(MAIL_RINGTONE_SRC);
      mailRingtoneAudio.preload = 'auto';
      mailRingtoneAudio.volume = 0.85;
    } catch {
      return null;
    }
  }
  return mailRingtoneAudio;
}

function playSynthesizedPostaFallback(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const f1 = 440;
    const f2 = 480;
    const pulseDuration = 0.038;
    const pulseGap = 0.022;
    const pulsesPerRing = 12;

    for (let ring = 0; ring < 2; ring++) {
      const ringStart = now + ring * 0.65;
      for (let i = 0; i < pulsesPerRing; i++) {
        const t = ringStart + i * (pulseDuration + pulseGap);
        const baseFreq = i % 2 === 0 ? f1 : f2;
        playTone(ctx, baseFreq, t, pulseDuration, 0.16, 'sine');
      }
    }
  } catch {}
}

export function playPostaNotificationSound(): void {
  markSoundPlayed();
  if (!isSoundEnabled()) return;

  const audio = getMailRingtoneAudio();
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.85;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          // Only fall back to Web Audio if the media itself failed to load/decode
          if (err && err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
            playSynthesizedPostaFallback();
          }
        });
      }
      return;
    } catch (err) {
      console.warn('[Mail Ringtone #7] Fallback triggered:', err);
    }
  }

  playSynthesizedPostaFallback();
}

// Aliases for clear semantic usage
export const playClassicPhoneRingSound = playPostaNotificationSound;
export const playMessageNotificationSound = playPostaNotificationSound;


