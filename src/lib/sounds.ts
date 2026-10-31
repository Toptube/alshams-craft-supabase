/**
 * نظام الصوتيات التفاعلية لمنظومة الشمس كرافت ERP
 * مولد نغمات برمجي متطور بالكامل باستخدام Web Audio API (بدون أي ملفات صوتية خارجية)
 * أصوات عالية ومميزة ومحسنة مع نغمات كليك تكتيكية حية وتنبيهات رنانة وتفاعلية وجذابة.
 */

// Global AudioContext singleton
let audioCtx: AudioContext | null = null;
let hasUserInteracted = false;

// Audio Preference Key in localStorage
const SOUND_ENABLED_KEY = 'alshams_sound_enabled';

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

if (typeof window !== 'undefined') {
  initUserInteractionListener();
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
 * 1. صوت الضغط على الأزرار (Tactile Click Tone):
 * نغمة كليك مميزة، حيوية، نقية وسريعة تُعطي إحساساً فيزيائياً فخماً وملموساً عند الضغط
 */
export function playButtonClickSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // انزلاق ترددي مجهري مع نغمة هارمونية مميزة تعطي صوت "كليك" ميكانيكي راقي
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.035);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  } catch {}
}

/**
 * 2. صوت التنقل بين التابات (Tab Switch / Filter Tone):
 * نقرة أنعم وأعلى نبرة للانتقال بين أقسام الإشعارات
 */
export function playTabSwitchSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.03);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {}
}

/**
 * 3. رنين الإشعارات العالي والمميز (Vibrant Notification Chime):
 * لحن جرس كريستالي عالي ثلاثي النبرات (A5 -> C#6 -> E6) مسموع ومبهج
 */
export function playNotificationChimeSound(): void {
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
 * 10. نغمة إشعار وصول الرسائل والمراسلات (رنة هاتف عتيق كلاسيكية):
 * صوت مميز لرنة جرس هاتف قديم متقن (Dual-Tone Vintage Phone Bell 440Hz + 480Hz)
 * باستخدام Web Audio API بدون أي نطق صوتي وبدون ملفات خارجية، متكاملة مع نظام إشعارات المنظومة.
 */
export function playPostaNotificationSound(): void {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const f1 = 440; // تردد جرس الهاتف الكلاسيكي الأول
    const f2 = 480; // تردد جرس الهاتف الكلاسيكي الثاني
    const pulseDuration = 0.045;
    const pulseGap = 0.025;
    const pulsesPerRing = 12; // نبضات مطرقة الجرس الميكانيكي

    // رنتين متتاليتين تحاكي رنين الهاتف الأرضي الكلاسيكي
    for (let ring = 0; ring < 2; ring++) {
      const ringStart = now + ring * 0.58;
      for (let i = 0; i < pulsesPerRing; i++) {
        const t = ringStart + i * (pulseDuration + pulseGap);
        [f1, f2].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq + (i % 2 === 0 ? 12 : -12), t);

          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.14, t + 0.004);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + pulseDuration);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + pulseDuration);
        });
      }
    }
  } catch (err) {
    console.warn('[Posta Sound] AudioContext error:', err);
  }
}

