/**
 * نظام قفل واعتماد الشهر المالي (Financial Month Closure & Lock)
 * لمنظومة الشمساوية الحرفية
 *
 * عند اعتماد وقفل الشهر المالي:
 * - يتم تجميد كافة حركات الشهر (الفواتير، المصروفات، المشتريات، وأوامر التشغيل)
 * - تتحول القيود إلى وضع "للقراءة والمراجعة فقط" مع منع الحذف أو التعديل نهائياً لضمان النزاهة المحاسبية
 * - يُتاح فك قفل الشهر حصرياً للإدارة/السوبر أدمن عبر إدخال رمز الأمان المعتمد
 */

export interface MonthClosureRecord {
  month: string; // YYYY-MM
  lockedAt: number;
  lockedBy: string;
  summary: {
    totalSales: number;
    totalCosts: number;
    netProfit: number;
    invoicesCount: number;
    workOrdersCount: number;
  };
  notes?: string;
}

const STORAGE_KEY_PREFIX = 'alshams_locked_months_';

export function getLockedMonths(workshopId: string): MonthClosureRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workshopId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isMonthLocked(monthStr: string, workshopId: string): boolean {
  if (!monthStr || !workshopId) return false;
  const lockedList = getLockedMonths(workshopId);
  const targetMonth = monthStr.slice(0, 7); // YYYY-MM
  return lockedList.some((m) => m.month === targetMonth);
}

export function isMonthClosed(param1: string, param2: string): boolean {
  if (!param1 || !param2) return false;
  if (/^\d{4}-\d{2}/.test(param1)) {
    return isMonthLocked(param1, param2);
  }
  return isMonthLocked(param2, param1);
}

export function isDateInLockedMonth(param1: string | undefined, param2: string): boolean {
  if (!param1 || !param2) return false;
  if (/^\d{4}-\d{2}/.test(param1)) {
    return isMonthLocked(param1.slice(0, 7), param2);
  }
  return isMonthLocked(param2.slice(0, 7), param1);
}

export function lockFinancialMonth(
  workshopId: string,
  monthStr: string,
  lockedBy: string,
  summary: {
    totalSales: number;
    totalCosts: number;
    netProfit: number;
    invoicesCount: number;
    workOrdersCount: number;
  },
  notes?: string
): void {
  const current = getLockedMonths(workshopId);
  const targetMonth = monthStr.slice(0, 7);

  const filtered = current.filter((m) => m.month !== targetMonth);
  const newRecord: MonthClosureRecord = {
    month: targetMonth,
    lockedAt: Date.now(),
    lockedBy: lockedBy || 'الإدارة',
    summary,
    notes,
  };
  filtered.push(newRecord);

  localStorage.setItem(`${STORAGE_KEY_PREFIX}${workshopId}`, JSON.stringify(filtered));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alshams_locked_months_changed', {
        detail: { workshopId, month: targetMonth, isLocked: true },
      })
    );
  }
}

export function unlockFinancialMonth(
  workshopId: string,
  monthStr: string,
  pin: string,
  unlockedBy: string = 'الإدارة'
): { success: boolean; message: string } {
  // الرمز السري للإدارة الافتراضي 1234 أو كود الأمان 2026
  const validPins = ['1234', '2026', 'admin', '0000'];
  const cleanPin = pin.trim();

  if (!validPins.includes(cleanPin)) {
    return {
      success: false,
      message: 'رمز الأمان غير صحيح! فك قفل الشهر مخصص للإدارة العليا فقط.',
    };
  }

  const current = getLockedMonths(workshopId);
  const targetMonth = monthStr.slice(0, 7);
  const updated = current.filter((m) => m.month !== targetMonth);

  localStorage.setItem(`${STORAGE_KEY_PREFIX}${workshopId}`, JSON.stringify(updated));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alshams_locked_months_changed', {
        detail: { workshopId, month: targetMonth, isLocked: false },
      })
    );
  }

  return {
    success: true,
    message: `تم فك قفل الشهر المالي ${targetMonth} بنجاح. أصبحت الحركات قابلة للمراجعة والتعديل.`,
  };
}
