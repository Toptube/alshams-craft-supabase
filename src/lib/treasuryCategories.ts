import {
  getTreasuryCategoriesFromSupabase,
  createTreasuryCategoryInSupabase,
  deleteTreasuryCategoryInSupabase,
  updateTreasuryMinBalanceInSupabase,
} from '../db/supabaseService';

export interface TreasuryCategory {
  id: string;
  name: string;
  category_name?: string;
  type: 'in' | 'out' | 'both';
  isDefault?: boolean;
  color?: string;
  icon?: string;
  notes?: string;
}

export const DEFAULT_INFLOW_CATEGORIES: TreasuryCategory[] = [
  { id: 'in_initial', name: 'رصيد افتتاحي', category_name: 'رصيد افتتاحي', type: 'in', isDefault: true, color: 'emerald' },
  { id: 'in_sales', name: 'إيراد مبيعات نقدية', category_name: 'إيراد مبيعات نقدية', type: 'in', isDefault: true, color: 'emerald' },
  { id: 'in_capital', name: 'رأس مال إضافي', category_name: 'رأس مال إضافي', type: 'in', isDefault: true, color: 'emerald' },
  { id: 'in_customer_collection', name: 'تحصيل ديون عملاء', category_name: 'تحصيل ديون عملاء', type: 'in', isDefault: true, color: 'emerald' },
  { id: 'in_refund', name: 'استرداد وتأمينات', category_name: 'استرداد وتأمينات', type: 'in', isDefault: true, color: 'emerald' },
  { id: 'in_other', name: 'إيرادات أخرى متنوعة', category_name: 'إيرادات أخرى متنوعة', type: 'in', isDefault: true, color: 'emerald' },
];

export const DEFAULT_OUTFLOW_CATEGORIES: TreasuryCategory[] = [
  { id: 'out_materials', name: 'مشتريات خامات ومستلزمات', category_name: 'مشتريات خامات ومستلزمات', type: 'out', isDefault: true, color: 'amber' },
  { id: 'out_maintenance', name: 'صيانة آلات ومعدات', category_name: 'صيانة آلات ومعدات', type: 'out', isDefault: true, color: 'rose' },
  { id: 'out_rent', name: 'إيجار مقرات وورشة', category_name: 'إيجار مقرات وورشة', type: 'out', isDefault: true, color: 'rose' },
  { id: 'out_utilities', name: 'كهرباء ومرافق وطاقة', category_name: 'كهرباء ومرافق وطاقة', type: 'out', isDefault: true, color: 'rose' },
  { id: 'out_transport', name: 'انتقالات وشحن وتوصيل', category_name: 'انتقالات وشحن وتوصيل', type: 'out', isDefault: true, color: 'blue' },
  { id: 'out_hospitality', name: 'ضيافة ونظافة ومطبخ', category_name: 'ضيافة ونظافة ومطبخ', type: 'out', isDefault: true, color: 'amber' },
  { id: 'out_partners', name: 'سحب شركاء وأرباح', category_name: 'سحب شركاء وأرباح', type: 'out', isDefault: true, color: 'purple' },
  { id: 'out_tools', name: 'أدوات عمل ومستهلكات', category_name: 'أدوات عمل ومستهلكات', type: 'out', isDefault: true, color: 'amber' },
  { id: 'out_marketing', name: 'تسويق وإعلانات', category_name: 'تسويق وإعلانات', type: 'out', isDefault: true, color: 'blue' },
  { id: 'out_misc', name: 'مصروفات نثرية متنوعة', category_name: 'مصروفات نثرية متنوعة', type: 'out', isDefault: true, color: 'stone' },
];

const CATEGORIES_STORAGE_PREFIX = 'alshams_treasury_categories_';
const ALERTS_STORAGE_PREFIX = 'alshams_treasury_alerts_';

export function getTreasuryCategories(workshopId: string): TreasuryCategory[] {
  try {
    const raw = localStorage.getItem(`${CATEGORIES_STORAGE_PREFIX}${workshopId}`);
    if (raw) {
      const custom: TreasuryCategory[] = JSON.parse(raw);
      if (Array.isArray(custom)) {
        return [...DEFAULT_INFLOW_CATEGORIES, ...DEFAULT_OUTFLOW_CATEGORIES, ...custom];
      }
    }
  } catch (e) {}
  return [...DEFAULT_INFLOW_CATEGORIES, ...DEFAULT_OUTFLOW_CATEGORIES];
}

export async function fetchAndSyncSupabaseCategories(workshopId: string): Promise<TreasuryCategory[]> {
  if (!workshopId) return getTreasuryCategories(workshopId);

  try {
    const { data, error } = await getTreasuryCategoriesFromSupabase(workshopId);
    if (!error && data && data.length > 0) {
      const converted: TreasuryCategory[] = data.map((item) => ({
        id: item.id,
        name: item.category_name,
        category_name: item.category_name,
        type: item.type,
        isDefault: false,
        color: item.type === 'in' ? 'emerald' : 'rose',
        notes: item.notes || '',
      }));

      // Cache locally
      localStorage.setItem(`${CATEGORIES_STORAGE_PREFIX}${workshopId}`, JSON.stringify(converted));
      window.dispatchEvent(new CustomEvent('alshams_treasury_categories_updated'));
      return [...DEFAULT_INFLOW_CATEGORIES, ...DEFAULT_OUTFLOW_CATEGORIES, ...converted];
    }
  } catch (e) {}

  return getTreasuryCategories(workshopId);
}

export async function saveCustomCategoryWithSupabase(
  workshopId: string,
  category: { name: string; type: 'in' | 'out'; notes?: string }
): Promise<TreasuryCategory> {
  const cleanName = category.name.trim();

  // 1. Try persisting to Supabase treasury_categories table
  let supabaseId: string | null = null;
  try {
    const { data } = await createTreasuryCategoryInSupabase(workshopId, cleanName, category.type, category.notes);
    if (data && data.id) {
      supabaseId = data.id;
    }
  } catch (e) {}

  const newCat: TreasuryCategory = {
    id: supabaseId || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: cleanName,
    category_name: cleanName,
    type: category.type,
    isDefault: false,
    color: category.type === 'in' ? 'emerald' : 'rose',
    notes: category.notes?.trim() || '',
  };

  try {
    const raw = localStorage.getItem(`${CATEGORIES_STORAGE_PREFIX}${workshopId}`);
    const existing: TreasuryCategory[] = raw ? JSON.parse(raw) : [];
    const updated = [...existing, newCat];
    localStorage.setItem(`${CATEGORIES_STORAGE_PREFIX}${workshopId}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('alshams_treasury_categories_updated'));
  } catch (e) {}

  return newCat;
}

export function saveCustomCategory(
  workshopId: string,
  category: { name: string; type: 'in' | 'out'; notes?: string }
): TreasuryCategory {
  saveCustomCategoryWithSupabase(workshopId, category);
  return {
    id: `custom_${Date.now()}`,
    name: category.name.trim(),
    category_name: category.name.trim(),
    type: category.type,
    isDefault: false,
    color: category.type === 'in' ? 'emerald' : 'rose',
  };
}

export async function deleteCustomCategoryWithSupabase(workshopId: string, categoryId: string): Promise<void> {
  // Try delete in Supabase
  try {
    await deleteTreasuryCategoryInSupabase(workshopId, categoryId);
  } catch (e) {}

  try {
    const raw = localStorage.getItem(`${CATEGORIES_STORAGE_PREFIX}${workshopId}`);
    if (raw) {
      const existing: TreasuryCategory[] = JSON.parse(raw);
      const filtered = existing.filter((c) => c.id !== categoryId);
      localStorage.setItem(`${CATEGORIES_STORAGE_PREFIX}${workshopId}`, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('alshams_treasury_categories_updated'));
    }
  } catch (e) {}
}

export function deleteCustomCategory(workshopId: string, categoryId: string): void {
  deleteCustomCategoryWithSupabase(workshopId, categoryId);
}

// -------------------------------------------------------------
// Minimum Balance Alert Thresholds (حد الأمان / الرصيد الأدنى)
// -------------------------------------------------------------

export function getAllMinBalanceAlerts(workshopId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${ALERTS_STORAGE_PREFIX}${workshopId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

export function getMinBalanceAlert(workshopId: string, treasuryId: string): number {
  const alerts = getAllMinBalanceAlerts(workshopId);
  return alerts[treasuryId] || 0;
}

export function setMinBalanceAlert(workshopId: string, treasuryId: string, threshold: number): void {
  try {
    const alerts = getAllMinBalanceAlerts(workshopId);
    if (threshold <= 0) {
      delete alerts[treasuryId];
    } else {
      alerts[treasuryId] = threshold;
    }
    localStorage.setItem(`${ALERTS_STORAGE_PREFIX}${workshopId}`, JSON.stringify(alerts));
    window.dispatchEvent(new CustomEvent('alshams_treasury_alerts_updated'));
  } catch (e) {}

  // Sync to Supabase treasuries table in background
  if (workshopId && treasuryId) {
    updateTreasuryMinBalanceInSupabase(workshopId, treasuryId, threshold).catch((err) => {
      console.warn('Failed to update min_balance in Supabase treasuries:', err);
    });
  }
}
