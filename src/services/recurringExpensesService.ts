import { RecurringExpenseItem, AdminCostRecord } from '../types';
import { tenantStorage } from '../db/dexieDB';
import { recordDisbursementExitTransaction } from '../components/treasuries/DisbursementSourceSelector';

const STORAGE_PREFIX = 'alshams_recurring_expenses_';

export interface DueRecurringExpenseStatus extends RecurringExpenseItem {
  daysRemaining: number;
  isOverdue: boolean;
  isDueToday: boolean;
  isPaidThisMonth: boolean;
  urgentNoticeText: string;
}

export const DEFAULT_RECURRING_EXPENSES: Omit<RecurringExpenseItem, 'id' | 'workshopId' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'إيجار مقر الورشة والمشغل',
    category: 'rent',
    categoryLabelAr: 'إيجار المقر',
    amount: 2500,
    frequency: 'monthly',
    dueDayOfMonth: 1,
    preferredPaymentChannel: 'cash',
    notes: 'استحقاق شهري ثابت لإيجار مقر المشغل اليدوي',
    isActive: true,
  },
  {
    title: 'فاتورة الكهرباء والإنارة الحرفية',
    category: 'electricity',
    categoryLabelAr: 'كهرباء ومرافق',
    amount: 450,
    frequency: 'monthly',
    dueDayOfMonth: 10,
    preferredPaymentChannel: 'instapay',
    notes: 'استهلاك عداد المشغل والماكينات الكهربائية',
    isActive: true,
  },
  {
    title: 'اشتراك باقة الإنترنت وهاتف خدمة العملاء',
    category: 'internet_office',
    categoryLabelAr: 'إنترنت واتصالات',
    amount: 350,
    frequency: 'monthly',
    dueDayOfMonth: 15,
    preferredPaymentChannel: 'wallet',
    notes: 'باقة الراوتر والتواصل المباشر مع العملاء وسوق الشمساوية',
    isActive: true,
  },
  {
    title: 'الصيانة الدورية للماكينات وشاسيهات الشغل',
    category: 'maintenance',
    categoryLabelAr: 'صيانة دورية',
    amount: 500,
    frequency: 'monthly',
    dueDayOfMonth: 20,
    preferredPaymentChannel: 'cash',
    notes: 'تشحيم وتغيير إبر ومقصات وسن الأسلحة الحرفية',
    isActive: true,
  },
];

export const getRecurringExpenses = async (workshopId: string): Promise<RecurringExpenseItem[]> => {
  const key = `${STORAGE_PREFIX}${workshopId || 'default'}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Seed initial defaults if empty
      const initial: RecurringExpenseItem[] = DEFAULT_RECURRING_EXPENSES.map((d, index) => ({
        ...d,
        id: `rec_exp_${Date.now()}_${index}`,
        workshopId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to get recurring expenses:', err);
    return [];
  }
};

export const saveRecurringExpense = async (
  workshopId: string,
  data: Partial<RecurringExpenseItem>
): Promise<RecurringExpenseItem> => {
  const current = await getRecurringExpenses(workshopId);
  const now = Date.now();
  let updatedItem: RecurringExpenseItem;

  if (data.id && current.some((item) => item.id === data.id)) {
    current.forEach((item, index) => {
      if (item.id === data.id) {
        current[index] = {
          ...item,
          ...data,
          updatedAt: now,
        } as RecurringExpenseItem;
        updatedItem = current[index];
      }
    });
  } else {
    updatedItem = {
      id: `rec_exp_${now}_${Math.random().toString(36).substring(2, 6)}`,
      workshopId,
      title: data.title || 'مصروف دوري جديد',
      category: data.category || 'other',
      categoryLabelAr: data.categoryLabelAr || 'مصروف عام',
      amount: Number(data.amount) || 0,
      frequency: data.frequency || 'monthly',
      dueDayOfMonth: Math.max(1, Math.min(31, Number(data.dueDayOfMonth) || 1)),
      preferredPaymentChannel: data.preferredPaymentChannel || 'cash',
      notes: data.notes || '',
      isActive: data.isActive !== undefined ? data.isActive : true,
      lastPaidDate: data.lastPaidDate,
      lastPaidMonth: data.lastPaidMonth,
      createdAt: now,
      updatedAt: now,
    };
    current.push(updatedItem);
  }

  const key = `${STORAGE_PREFIX}${workshopId || 'default'}`;
  localStorage.setItem(key, JSON.stringify(current));
  return updatedItem!;
};

export const deleteRecurringExpense = async (workshopId: string, id: string): Promise<void> => {
  const current = await getRecurringExpenses(workshopId);
  const filtered = current.filter((item) => item.id !== id);
  const key = `${STORAGE_PREFIX}${workshopId || 'default'}`;
  localStorage.setItem(key, JSON.stringify(filtered));
};

export const toggleRecurringExpenseActive = async (workshopId: string, id: string): Promise<boolean> => {
  const current = await getRecurringExpenses(workshopId);
  let newStatus = true;
  const updated = current.map((item) => {
    if (item.id === id) {
      newStatus = !item.isActive;
      return { ...item, isActive: newStatus, updatedAt: Date.now() };
    }
    return item;
  });
  const key = `${STORAGE_PREFIX}${workshopId || 'default'}`;
  localStorage.setItem(key, JSON.stringify(updated));
  return newStatus;
};

export const payRecurringExpense = async (
  workshopId: string,
  id: string,
  safeInfo?: {
    sourceId: string;
    sourceName: string;
    sourceKind: 'custody' | 'main' | 'sub' | string;
    holderName?: string;
    channel: 'cash' | 'instapay' | 'wallet' | string;
    userEmail: string;
  }
): Promise<{ success: boolean; costId: string; title: string; amount: number }> => {
  const current = await getRecurringExpenses(workshopId);
  const itemIndex = current.findIndex((it) => it.id === id);
  if (itemIndex === -1) {
    throw new Error('لم يتم العثور على بند المصروف الدوري');
  }

  const item = current[itemIndex];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const curMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Record treasury exit if source is provided
  let serial = 'TX-' + Date.now().toString().slice(-6);
  if (safeInfo) {
    try {
      serial = await recordDisbursementExitTransaction({
        tenantId: workshopId,
        sourceId: safeInfo.sourceId,
        sourceName: safeInfo.sourceName,
        sourceKind: (safeInfo.sourceKind as 'custody' | 'main' | 'sub') || 'main',
        holderName: safeInfo.holderName,
        channel: (safeInfo.channel as 'cash' | 'instapay' | 'wallet') || 'cash',
        amount: item.amount,
        recipientName: item.title,
        category: item.category,
        title: `سداد مصروف دوري: ${item.title}`,
        notes: `سداد دوري لشهر ${curMonthStr} [سيريال: ${serial}]`,
        userEmail: safeInfo.userEmail || 'system',
      });
    } catch (err) {
      console.warn('Treasury exit registration warning:', err);
    }
  }

  // Record admin expense record in Dexie DB
  const costId = `adm_rec_${Date.now()}`;
  const adminCostRecord: AdminCostRecord = {
    id: costId,
    tenantId: workshopId,
    workshopId,
    title: `[دوري] ${item.title}`,
    category: item.category === 'rent' || item.category === 'electricity' || item.category === 'water' ? 'admin_costs' : item.category,
    amount: item.amount,
    currency: 'EGP',
    exchangeRate: 1.0,
    baseCurrencyAmount: item.amount,
    safeType: safeInfo?.sourceKind === 'main' ? 'main' : 'sub',
    month: curMonthStr,
    paymentDate: todayStr,
    notes: `سداد آلي لمصروف دوري ثابت [${item.frequency === 'monthly' ? 'شهري' : item.frequency === 'quarterly' ? 'ربع سنوي' : 'سنوي'}] - كود المعاملة: ${serial}`,
  };

  await tenantStorage.addAdminCost(adminCostRecord);

  // Update item last paid month and date
  current[itemIndex] = {
    ...item,
    lastPaidDate: todayStr,
    lastPaidMonth: curMonthStr,
    updatedAt: Date.now(),
  };

  const key = `${STORAGE_PREFIX}${workshopId || 'default'}`;
  localStorage.setItem(key, JSON.stringify(current));

  return {
    success: true,
    costId,
    title: item.title,
    amount: item.amount,
  };
};

export const checkUpcomingRecurringExpenses = async (
  workshopId: string
): Promise<{
  dueItems: DueRecurringExpenseStatus[];
  urgentCount: number;
  totalUrgentAmount: number;
}> => {
  const items = await getRecurringExpenses(workshopId);
  const today = new Date();
  const curDay = today.getDate();
  const curMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const dueItems: DueRecurringExpenseStatus[] = [];
  let urgentCount = 0;
  let totalUrgentAmount = 0;

  for (const item of items) {
    if (!item.isActive) continue;

    const isPaidThisMonth =
      item.lastPaidMonth === curMonthStr ||
      (Boolean(item.lastPaidDate) && item.lastPaidDate!.startsWith(curMonthStr));

    const dueDay = item.dueDayOfMonth;
    const daysRemaining = dueDay - curDay;
    const isOverdue = !isPaidThisMonth && daysRemaining < 0;
    const isDueToday = !isPaidThisMonth && daysRemaining === 0;

    let urgentNoticeText = '';
    if (isPaidThisMonth) {
      urgentNoticeText = `مسدد بالكامل لشهر ${curMonthStr} ✅`;
    } else if (isDueToday) {
      urgentNoticeText = '⚠️ مستحق السداد اليوم فوراً!';
    } else if (isOverdue) {
      urgentNoticeText = `🔴 متأخر عن موعد الاستحقاق بـ ${Math.abs(daysRemaining)} يوم!`;
    } else if (daysRemaining <= 3) {
      urgentNoticeText = `🔔 مستحق السداد بعد ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'}`;
    } else {
      urgentNoticeText = `متبقي ${daysRemaining} يوم على الاستحقاق`;
    }

    const isUrgent = !isPaidThisMonth && (daysRemaining <= 3 || isOverdue);

    if (isUrgent) {
      urgentCount++;
      totalUrgentAmount += item.amount;
    }

    dueItems.push({
      ...item,
      daysRemaining,
      isOverdue,
      isDueToday,
      isPaidThisMonth,
      urgentNoticeText,
    });
  }

  // Sort by urgency: overdue first, then due today, then closest days remaining
  dueItems.sort((a, b) => {
    if (a.isPaidThisMonth && !b.isPaidThisMonth) return 1;
    if (!a.isPaidThisMonth && b.isPaidThisMonth) return -1;
    return a.daysRemaining - b.daysRemaining;
  });

  return {
    dueItems,
    urgentCount,
    totalUrgentAmount,
  };
};
