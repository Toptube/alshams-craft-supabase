/**
 * Canonical Material Stock & Deduplication Helpers
 * -----------------------------------------------------------------
 * Enforces a single source of truth across المخازن, خاماتي, الرئيسية,
 * هلخصهالك, and بحوث العمليات:
 *
 * 1) Catalog items selected in "خاماتي" with currentStock === 0 that were
 *    never stocked/tracked in the warehouse MUST NOT trigger low-stock alerts.
 * 2) Low-stock alerts fire ONLY when a material is actively tracked in the
 *    warehouse (currentStock > 0 OR warehouseTracked === true) AND has an
 *    explicit positive threshold (minAlertThreshold > 0) AND
 *    currentStock <= minAlertThreshold.
 * 3) Duplicate rows with the exact same normalized name are merged cleanly,
 *    preferring records with real stock or warehouse tracking.
 */

export interface LocalMaterialStockEntry {
  currentStock?: number;
  minAlertThreshold?: number;
  warehouseTracked?: boolean;
}

export function normalizeMaterialNameKey(name?: string | null): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function readLocalMaterialStockMap(
  tenantId?: string
): Record<string, LocalMaterialStockEntry> {
  if (!tenantId || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('alshams_mat_stock_' + tenantId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveMaterialStockValues(
  item: any,
  localStockMap?: Record<string, LocalMaterialStockEntry>
): {
  currentStock: number;
  minThreshold: number;
  isTracked: boolean;
  isLowStock: boolean;
} {
  const id = String(item?.id || '');
  const entry = id && localStockMap ? localStockMap[id] : undefined;

  const rawStock =
    entry?.currentStock !== undefined
      ? Number(entry.currentStock)
      : Number(item?.currentStock ?? item?.quantity ?? item?.current_stock ?? 0);
  const currentStock = Number.isFinite(rawStock) && rawStock > 0 ? rawStock : 0;

  // Never fabricate a fake default threshold of 5 for unstocked catalog items!
  const rawThreshold =
    entry?.minAlertThreshold !== undefined
      ? Number(entry.minAlertThreshold)
      : Number(item?.minAlertThreshold ?? item?.minThreshold ?? item?.reorderLevel ?? item?.min_limit ?? 0);
  const candidateThreshold = Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 0;

  // A material is actively tracked in warehouse ONLY if:
  // - explicitly marked warehouseTracked === true, OR
  // - currently has positive stock (> 0).
  const isTracked = Boolean(
    entry?.warehouseTracked === true ||
      item?.warehouseTracked === true ||
      currentStock > 0
  );

  const minThreshold = isTracked ? candidateThreshold : 0;
  const isLowStock = isTracked && minThreshold > 0 && currentStock <= minThreshold;

  return {
    currentStock,
    minThreshold,
    isTracked,
    isLowStock,
  };
}

/**
 * Deduplicate raw material records that share the exact same normalized name.
 * Prefers the active record with real stock, warehouse tracking, cost, or latest update.
 */
export function deduplicateMaterialsByName<T extends Record<string, any>>(
  items: T[],
  localStockMap?: Record<string, LocalMaterialStockEntry>
): T[] {
  const byName = new Map<string, T>();

  const scoreItem = (it: T): number => {
    const { currentStock, isTracked } = resolveMaterialStockValues(it, localStockMap);
    const cost = Number(it.costPerUnit ?? it.costPrice ?? it.purchase_price ?? 0);
    const updated = Number(it.updatedAt || 0);
    return (
      (currentStock > 0 ? 10000 : 0) +
      (isTracked ? 1000 : 0) +
      (cost > 0 ? 100 : 0) +
      (updated > 0 ? 10 : 0)
    );
  };

  for (const item of items || []) {
    if (!item || item.isActive === false || item.is_active === false) continue;
    const rawName = item.materialName || item.name || '';
    const key = normalizeMaterialNameKey(rawName);
    if (!key) continue;

    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, item);
      continue;
    }

    if (scoreItem(item) > scoreItem(existing)) {
      byName.set(key, item);
    }
  }

  return Array.from(byName.values());
}
