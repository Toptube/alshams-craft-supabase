export interface ImageRollbackEntry {
  slotKey: string;
  slotLabel: string;
  previousUrl: string;
  replacedAt: number;
  expiresAt: number;
}

const STORAGE_KEY = 'alshams_image_rollback_v1';
export const ROLLBACK_WINDOW_MS = 8 * 60 * 60 * 1000; // 8 ساعات بالتمام

function readArchiveMap(): Record<string, ImageRollbackEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeArchiveMap(map: Record<string, ImageRollbackEntry>): void {
  if (typeof window === 'undefined') return;
  const entries = Object.entries(map);
  try {
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // في حال امتلاء المساحة بسبب صور كبيرة، نحذف الأقدم ونحفظ الأحدث فقط
    try {
      const sorted = entries.sort((a, b) => b[1].replacedAt - a[1].replacedAt).slice(0, 4);
      const compact: Record<string, ImageRollbackEntry> = {};
      for (const [k, v] of sorted) compact[k] = v;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('alshams_image_rollback_updated'));
  } catch {}
}

/**
 * تنظيف تلقائي لأي صورة قديمة مر عليها 8 ساعات أو أكثر
 */
export function purgeExpiredImageArchives(): number {
  const map = readArchiveMap();
  const now = Date.now();
  let purgedCount = 0;
  for (const [key, entry] of Object.entries(map)) {
    if (!entry || !entry.previousUrl || now >= Number(entry.expiresAt || 0)) {
      delete map[key];
      purgedCount++;
    }
  }
  if (purgedCount > 0) {
    writeArchiveMap(map);
  }
  return purgedCount;
}

/**
 * حفظ نسخة مؤقتة من الصورة القديمة لمدة 8 ساعات عند استبدالها بأخرى جديدة
 */
export function archiveReplacedImage(
  slotKey: string,
  slotLabel: string,
  previousUrl?: string | null,
  nextUrl?: string | null
): ImageRollbackEntry | null {
  purgeExpiredImageArchives();
  const prev = (previousUrl || '').trim();
  const next = (nextUrl || '').trim();
  if (!prev || prev === next) return null;

  const now = Date.now();
  const entry: ImageRollbackEntry = {
    slotKey,
    slotLabel,
    previousUrl: prev,
    replacedAt: now,
    expiresAt: now + ROLLBACK_WINDOW_MS,
  };
  const map = readArchiveMap();
  map[slotKey] = entry;
  writeArchiveMap(map);
  return entry;
}

export function getRollbackEntry(slotKey: string): ImageRollbackEntry | null {
  purgeExpiredImageArchives();
  const map = readArchiveMap();
  return map[slotKey] || null;
}

export function getAllActiveRollbacks(): ImageRollbackEntry[] {
  purgeExpiredImageArchives();
  const map = readArchiveMap();
  return Object.values(map).sort((a, b) => b.replacedAt - a.replacedAt);
}

/**
 * التراجع واسترجاع الصورة القديمة وحذف السجل المؤقت
 */
export function restoreRollbackEntry(slotKey: string): string | null {
  purgeExpiredImageArchives();
  const map = readArchiveMap();
  const entry = map[slotKey];
  if (!entry) return null;
  const url = entry.previousUrl;
  delete map[slotKey];
  writeArchiveMap(map);
  return url;
}

/**
 * زر "لن أتراجع" — حذف نهائي وفوري للصورة القديمة لتوفير المساحة
 */
export function confirmPermanentPurge(slotKey: string): boolean {
  const map = readArchiveMap();
  if (!map[slotKey]) return false;
  delete map[slotKey];
  writeArchiveMap(map);
  return true;
}

export function formatRemainingRollbackTime(expiresAt: number): string {
  const diff = Math.max(0, expiresAt - Date.now());
  if (diff <= 0) return 'انتهت مهلة التراجع';
  const totalMinutes = Math.ceil(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `متبقي ${hours} س و ${mins} د`;
  if (hours > 0) return `متبقي ${hours} ساعات`;
  return `متبقي ${mins} دقيقة`;
}
