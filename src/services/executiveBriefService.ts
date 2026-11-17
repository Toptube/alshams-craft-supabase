import { tenantStorage } from '../db/dexieDB';
import {
  getTreasuryBalancesFromSupabase,
  getTreasuryChannelBalancesFromSupabase,
} from '../db/supabaseService';
import {
  fetchSupplierErpOverview,
  fetchBranchInventory,
  fetchErpVendors,
} from '../db/supplierErpService';
import {
  fetchSupplierCustomers,
  fetchSupplierFinance,
} from '../db/supplierService';

export interface TreasuryChannelSummary {
  cashTotal: number;
  instapayBankTotal: number;
  walletsCustodyTotal: number;
  totalLiquidity: number;
  treasuries: Array<{
    id: string;
    name: string;
    kindLabel: string;
    balance: number;
  }>;
}

export interface DebtorSummaryItem {
  key: string;
  name: string;
  phone?: string;
  totalOwed: number;
  invoicesCount: number;
  daysOverdue: number;
  oldestDateLabel?: string;
  isOverdue: boolean;
  shouldWarnNoMoreCredit: boolean;
  warningText?: string;
}

export interface CreditorSummaryItem {
  key: string;
  name: string;
  phone?: string;
  totalOwed: number;
  invoicesCount: number;
  oldestDateLabel?: string;
  isOverdue?: boolean;
}

export interface MaterialVelocityItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  stockValue: number;
  consumedQty: number;
}

export interface ProductVelocityItem {
  id: string;
  name: string;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  soldQty: number;
  soldRevenue: number;
}

export interface ArtisanExecutiveBrief {
  generatedAt: number;
  currencySymbol: string;
  financial: {
    liquidity: TreasuryChannelSummary;
    receivablesTotal: number;
    debtors: DebtorSummaryItem[];
    overdueDebtorsCount: number;
    payablesTotal: number;
    creditors: CreditorSummaryItem[];
    netWorkingPosition: number; // معانا + لينا - علينا
  };
  warehouse: {
    materialsCount: number;
    materialsTotalValue: number;
    lowStockMaterials: MaterialVelocityItem[];
    fastMovingMaterials: MaterialVelocityItem[];
    slowMovingMaterials: MaterialVelocityItem[];
    productsCount: number;
    productsCostValue: number;
    productsRetailValue: number;
    bestSellingProducts: ProductVelocityItem[];
    slowestProducts: ProductVelocityItem[];
  };
}

function normalizeText(v?: string): string {
  return String(v || '').trim().toLowerCase();
}

function classifyChannel(channelName?: string): 'cash' | 'instapay_bank' | 'wallet_custody' {
  const c = normalizeText(channelName);
  if (
    c.includes('instapay') ||
    c.includes('إنستاباي') ||
    c.includes('انستاباي') ||
    c.includes('bank') ||
    c.includes('بنك') ||
    c.includes('تحويل')
  ) {
    return 'instapay_bank';
  }
  if (
    c.includes('wallet') ||
    c.includes('محفظ') ||
    c.includes('فودافون') ||
    c.includes('اورنج') ||
    c.includes('اتصالات') ||
    c.includes('عهد') ||
    c.includes('custody')
  ) {
    return 'wallet_custody';
  }
  return 'cash';
}

export async function buildArtisanExecutiveBrief(
  workshopId: string,
  currencySymbol = 'ج.م'
): Promise<ArtisanExecutiveBrief> {
  const now = Date.now();
  const dayMs = 86400000;

  const [
    supaTreasuriesRes,
    supaChannelsRes,
    safeBalances,
    orders,
    customers,
    suppliers,
    supplierInvoices,
    reminders,
    rawMaterials,
    inventoryTx,
    products,
  ] = await Promise.all([
    getTreasuryBalancesFromSupabase(workshopId).catch(() => ({ data: [], error: null })),
    getTreasuryChannelBalancesFromSupabase(workshopId).catch(() => ({ data: [], error: null })),
    tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 })),
    tenantStorage.getOrders(workshopId).catch(() => []),
    tenantStorage.getCustomers(workshopId).catch(() => []),
    tenantStorage.getSuppliers(workshopId).catch(() => []),
    tenantStorage.getSupplierInvoices(workshopId).catch(() => []),
    tenantStorage.getPaymentReminders(workshopId).catch(() => []),
    tenantStorage.getRawMaterials(workshopId).catch(() => []),
    tenantStorage.getInventoryTransactions(workshopId).catch(() => []),
    tenantStorage.getProducts(workshopId).catch(() => []),
  ]);

  // 1. السيولة وتفصيلها حسب القناة (كاش / إنستاباي وبنك / محافظ وعهد)
  const supaTreasuries = Array.isArray(supaTreasuriesRes?.data) ? supaTreasuriesRes.data : [];
  const supaChannels = Array.isArray(supaChannelsRes?.data) ? supaChannelsRes.data : [];

  let cashTotal = 0;
  let instapayBankTotal = 0;
  let walletsCustodyTotal = 0;
  const treasuries: TreasuryChannelSummary['treasuries'] = [];

  if (supaTreasuries.length > 0) {
    for (const tr of supaTreasuries as any[]) {
      const bal = Number(tr.balance || 0);
      const trName = String(tr.name || 'خزينة');
      const kind = String(tr.kind || '');
      const kindLabel =
        kind === 'custody'
          ? 'عهدة'
          : tr.holder_name
          ? `عهدة: ${tr.holder_name}`
          : 'خزينة';
      treasuries.push({
        id: String(tr.id || trName),
        name: trName,
        kindLabel,
        balance: Math.round(bal),
      });
    }

    if (supaChannels.length > 0) {
      for (const ch of supaChannels as any[]) {
        const bal = Number(ch.balance || 0);
        const bucket = classifyChannel(ch.channel);
        if (bucket === 'instapay_bank') instapayBankTotal += bal;
        else if (bucket === 'wallet_custody') walletsCustodyTotal += bal;
        else cashTotal += bal;
      }
    } else {
      for (const tr of supaTreasuries as any[]) {
        const bal = Number(tr.balance || 0);
        const combined = `${tr.name || ''} ${tr.kind || ''}`;
        const bucket = classifyChannel(combined);
        if (bucket === 'instapay_bank') instapayBankTotal += bal;
        else if (bucket === 'wallet_custody') walletsCustodyTotal += bal;
        else cashTotal += bal;
      }
    }
  } else {
    const mainSafe = Number(safeBalances?.mainSafe || 0);
    const subSafe = Number(safeBalances?.subSafe || 0);
    cashTotal = mainSafe;
    walletsCustodyTotal = subSafe;
    if (mainSafe !== 0 || subSafe === 0) {
      treasuries.push({
        id: 'main_safe',
        name: 'الخزينة الرئيسية (كاش)',
        kindLabel: 'نقدي',
        balance: Math.round(mainSafe),
      });
    }
    if (subSafe !== 0) {
      treasuries.push({
        id: 'sub_safe',
        name: 'العهد والمحافظ الفرعية',
        kindLabel: 'عهدة / محفظة',
        balance: Math.round(subSafe),
      });
    }
  }

  const totalLiquidity =
    treasuries.length > 0
      ? treasuries.reduce((s, t) => s + t.balance, 0)
      : Math.round(cashTotal + instapayBankTotal + walletsCustodyTotal);

  // تصحيح الفروقات الطفيفة في التقريب بحيث مجموع القنوات = إجمالي السيولة
  const channelSum = Math.round(cashTotal + instapayBankTotal + walletsCustodyTotal);
  if (Math.abs(totalLiquidity - channelSum) > 0 && channelSum === 0) {
    cashTotal = totalLiquidity;
  }

  // 2. لينا كام بره وعند مين (العملاء + التحذير من المتأخرين)
  const customerPhoneLookup = new Map<string, string>();
  const customerNameById = new Map<string, string>();
  for (const c of customers as any[]) {
    const nm = String(c.fullName || c.name || '').trim();
    const ph = String(c.phoneNumber || c.phone || '').trim();
    if (c.id && nm) customerNameById.set(c.id, nm);
    if (nm && ph) customerPhoneLookup.set(normalizeText(nm), ph);
    if (c.id && ph) customerPhoneLookup.set(c.id, ph);
  }

  const debtorMap = new Map<
    string,
    {
      name: string;
      phone?: string;
      totalOwed: number;
      invoicesCount: number;
      maxOverdueDays: number;
      oldestTs: number;
    }
  >();

  for (const ord of orders as any[]) {
    if (ord.status === 'cancelled') continue;
    const total = Number(ord.finalTotal ?? ord.totalAmount ?? ord.subtotal ?? 0);
    const paid = Number(ord.paidAmount ?? ord.amountPaid ?? 0);
    const remaining =
      ord.remainingAmount !== undefined && ord.remainingAmount !== null
        ? Math.max(0, Number(ord.remainingAmount))
        : Math.max(0, total - paid);

    if (remaining <= 0.5) continue;

    const rawName = String(
      ord.customerName || customerNameById.get(ord.customerId) || 'عميل غير مسمى'
    ).trim();
    const key = ord.customerId ? String(ord.customerId) : normalizeText(rawName) || ord.id;
    const phone =
      String(ord.customerPhone || '').trim() ||
      customerPhoneLookup.get(String(ord.customerId || '')) ||
      customerPhoneLookup.get(normalizeText(rawName)) ||
      undefined;

    const createdTs = Number(
      ord.createdAt || (ord.date ? new Date(ord.date).getTime() : 0) || now
    );
    const dueStr = ord.deliveryDate || ord.targetDeliveryDate || '';
    const dueTs = dueStr ? new Date(dueStr).getTime() : 0;

    let overdueDays = 0;
    if (dueTs > 0 && !Number.isNaN(dueTs) && now - dueTs > dayMs) {
      overdueDays = Math.floor((now - dueTs) / dayMs);
    } else if (createdTs > 0 && now - createdTs > 21 * dayMs) {
      overdueDays = Math.floor((now - createdTs) / dayMs) - 21;
    }

    const existing = debtorMap.get(key);
    if (existing) {
      existing.totalOwed += remaining;
      existing.invoicesCount += 1;
      existing.maxOverdueDays = Math.max(existing.maxOverdueDays, overdueDays);
      existing.oldestTs = Math.min(existing.oldestTs, createdTs);
      if (!existing.phone && phone) existing.phone = phone;
    } else {
      debtorMap.set(key, {
        name: rawName,
        phone,
        totalOwed: remaining,
        invoicesCount: 1,
        maxOverdueDays: overdueDays,
        oldestTs: createdTs,
      });
    }
  }

  // إضافة أي أرصدة افتتاحية للعملاء مش ظاهرة في فواتير مفتوحة
  for (const c of customers as any[]) {
    const bal = Number(c.outstandingBalance ?? c.currentBalance ?? 0);
    if (bal <= 0.5) continue;
    const nm = String(c.fullName || c.name || 'عميل').trim();
    const byId = debtorMap.get(String(c.id || ''));
    const byName = debtorMap.get(normalizeText(nm));
    if (!byId && !byName) {
      const updatedTs = Number(c.updatedAt || c.createdAt || now);
      const staleDays = now - updatedTs > 21 * dayMs ? Math.floor((now - updatedTs) / dayMs) - 21 : 0;
      debtorMap.set(String(c.id || normalizeText(nm)), {
        name: nm,
        phone: String(c.phoneNumber || c.phone || '').trim() || undefined,
        totalOwed: bal,
        invoicesCount: 1,
        maxOverdueDays: staleDays,
        oldestTs: updatedTs,
      });
    }
  }

  const debtors: DebtorSummaryItem[] = Array.from(debtorMap.entries())
    .map(([key, d]) => {
      const isOverdue = d.maxOverdueDays >= 1;
      return {
        key,
        name: d.name,
        phone: d.phone,
        totalOwed: Math.round(d.totalOwed),
        invoicesCount: d.invoicesCount,
        daysOverdue: d.maxOverdueDays,
        oldestDateLabel:
          d.oldestTs > 0
            ? new Date(d.oldestTs).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : undefined,
        isOverdue,
        shouldWarnNoMoreCredit: isOverdue,
        warningText: isOverdue
          ? `متأخر بقاله ${d.maxOverdueDays} يوم عن ميعاد السداد — ياريت تطالبه وبلاش تتعامل آجل معاه تاني غير لما يصفّي القديم.`
          : undefined,
      };
    })
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return b.totalOwed - a.totalOwed;
    });

  const receivablesTotal = debtors.reduce((s, d) => s + d.totalOwed, 0);
  const overdueDebtorsCount = debtors.filter((d) => d.isOverdue).length;

  // 3. علينا كام ولمين (الموردين والالتزامات)
  const supplierPhoneLookup = new Map<string, string>();
  const supplierNameById = new Map<string, string>();
  for (const sup of suppliers as any[]) {
    const nm = String(sup.name || sup.companyName || sup.supplierName || '').trim();
    const ph = String(sup.phone || sup.phoneNumber || sup.contactNumber || '').trim();
    if (sup.id && nm) supplierNameById.set(sup.id, nm);
    if (nm && ph) supplierPhoneLookup.set(normalizeText(nm), ph);
    if (sup.id && ph) supplierPhoneLookup.set(sup.id, ph);
  }

  const creditorMap = new Map<
    string,
    { name: string; phone?: string; totalOwed: number; invoicesCount: number; oldestTs: number; isOverdue: boolean }
  >();

  for (const inv of supplierInvoices as any[]) {
    const total = Number(inv.totalAmount ?? 0);
    const paid = Number(inv.paidAmount ?? 0);
    const remaining =
      inv.remainingAmount !== undefined && inv.remainingAmount !== null
        ? Math.max(0, Number(inv.remainingAmount))
        : Math.max(0, total - paid);

    if (remaining <= 0.5) continue;

    const nm = String(
      inv.supplierName || supplierNameById.get(inv.supplierId) || 'مورد'
    ).trim();
    const key = inv.supplierId ? String(inv.supplierId) : normalizeText(nm) || inv.id;
    const phone =
      String(inv.supplierPhone || '').trim() ||
      supplierPhoneLookup.get(String(inv.supplierId || '')) ||
      supplierPhoneLookup.get(normalizeText(nm)) ||
      undefined;
    const ts = Number(inv.createdAt || (inv.date ? new Date(inv.date).getTime() : 0) || now);
    const isOverdue = now - ts > 30 * dayMs;

    const existing = creditorMap.get(key);
    if (existing) {
      existing.totalOwed += remaining;
      existing.invoicesCount += 1;
      existing.oldestTs = Math.min(existing.oldestTs, ts);
      existing.isOverdue = existing.isOverdue || isOverdue;
    } else {
      creditorMap.set(key, {
        name: nm,
        phone,
        totalOwed: remaining,
        invoicesCount: 1,
        oldestTs: ts,
        isOverdue,
      });
    }
  }

  // إضافة التزامات ومستحقات الموردين من جدول التنبيهات إن لم تكن مسجلة في فواتير الموردين
  for (const rem of reminders as any[]) {
    if (rem.status !== 'pending') continue;
    if (rem.targetType !== 'supplier' && rem.targetType !== 'commitment') continue;
    const amt = Number(rem.amount || 0);
    if (amt <= 0.5) continue;
    const nm = String(rem.targetName || rem.title || 'التزام مالي').trim();
    const key = rem.targetId ? String(rem.targetId) : `rem_${normalizeText(nm) || rem.id}`;
    if (!creditorMap.has(key) && !creditorMap.has(normalizeText(nm))) {
      const dueTs = rem.dueDate ? new Date(rem.dueDate).getTime() : now;
      creditorMap.set(key, {
        name: nm,
        totalOwed: amt,
        invoicesCount: 1,
        oldestTs: dueTs,
        isOverdue: dueTs < now,
      });
    }
  }

  // وأرصدة موردين مباشرة لو مسجلة بدون فواتير
  for (const sup of suppliers as any[]) {
    const bal = Number(sup.outstandingBalance ?? sup.currentBalance ?? 0);
    if (bal <= 0.5) continue;
    const nm = String(sup.name || sup.companyName || sup.supplierName || 'مورد').trim();
    if (!creditorMap.has(String(sup.id || '')) && !creditorMap.has(normalizeText(nm))) {
      creditorMap.set(String(sup.id || normalizeText(nm)), {
        name: nm,
        phone: String(sup.phone || sup.phoneNumber || '').trim() || undefined,
        totalOwed: bal,
        invoicesCount: 1,
        oldestTs: Number(sup.updatedAt || sup.createdAt || now),
        isOverdue: false,
      });
    }
  }

  const creditors: CreditorSummaryItem[] = Array.from(creditorMap.entries())
    .map(([key, c]) => ({
      key,
      name: c.name,
      phone: c.phone,
      totalOwed: Math.round(c.totalOwed),
      invoicesCount: c.invoicesCount,
      oldestDateLabel:
        c.oldestTs > 0
          ? new Date(c.oldestTs).toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : undefined,
      isOverdue: c.isOverdue,
    }))
    .sort((a, b) => b.totalOwed - a.totalOwed);

  const payablesTotal = creditors.reduce((s, c) => s + c.totalOwed, 0);

  // 4. تقرير مدير المخزن — الخامات (إجمالي + سحب عالي + سحب قليل + نواقص)
  const activeMaterials = (rawMaterials as any[]).filter((m) => m.isActive !== false);
  const pulledByMaterialKey = new Map<string, number>();

  for (const tx of inventoryTx as any[]) {
    const t = String(tx.type || '').toLowerCase();
    const isOut =
      tx.direction === 'out' ||
      t === 'production_out' ||
      t === 'work_order_pull' ||
      t === 'production' ||
      t === 'waste';
    if (!isOut) continue;
    const qty = Math.abs(Number(tx.quantity || 0));
    if (qty <= 0) continue;
    if (tx.itemId) {
      pulledByMaterialKey.set(String(tx.itemId), (pulledByMaterialKey.get(String(tx.itemId)) || 0) + qty);
    }
    const nm = normalizeText(tx.materialName || tx.itemName);
    if (nm) {
      pulledByMaterialKey.set(nm, (pulledByMaterialKey.get(nm) || 0) + qty);
    }
  }

  const materialVelocities: MaterialVelocityItem[] = activeMaterials.map((m) => {
    const stock = Number(m.currentStock || 0);
    const cost = Number(m.costPerUnit || 0);
    const minT = Number(m.minAlertThreshold ?? m.reorderLevel ?? 5);
    const name = String(m.materialName || 'خامة');
    const consumed =
      pulledByMaterialKey.get(String(m.id || '')) ||
      pulledByMaterialKey.get(normalizeText(name)) ||
      0;

    return {
      id: String(m.id || name),
      name,
      unit: String(m.unit || 'وحدة'),
      currentStock: Number(stock.toFixed(2)),
      minThreshold: minT,
      stockValue: Math.round(stock * cost),
      consumedQty: Number(consumed.toFixed(2)),
    };
  });

  const materialsTotalValue = materialVelocities.reduce((s, m) => s + m.stockValue, 0);
  const lowStockMaterials = materialVelocities
    .filter((m) => m.currentStock <= m.minThreshold)
    .sort((a, b) => a.currentStock - b.currentStock);

  const fastMovingMaterials = [...materialVelocities]
    .filter((m) => m.consumedQty > 0)
    .sort((a, b) => b.consumedQty - a.consumedQty)
    .slice(0, 4);

  const slowMovingMaterials = [...materialVelocities]
    .filter((m) => m.currentStock > 0 && (m.consumedQty === 0 || !fastMovingMaterials.some((f) => f.id === m.id)))
    .sort((a, b) => a.consumedQty - b.consumedQty || b.stockValue - a.stockValue)
    .slice(0, 4);

  // 5. تقرير مدير المخزن — المنتجات النهائية (أكتر منتج ماشي + أقل منتج شغال)
  const productSalesMap = new Map<string, { qty: number; revenue: number; name: string }>();
  for (const ord of orders as any[]) {
    if (ord.status === 'cancelled') continue;
    if (Array.isArray(ord.items) && ord.items.length > 0) {
      for (const it of ord.items) {
        const pName = String(it.productName || it.name || '').trim();
        const key = it.productId ? String(it.productId) : normalizeText(pName);
        if (!key) continue;
        const q = Number(it.quantity || 1);
        const rev = Number(it.totalPrice ?? (Number(it.unitPrice || 0) * q));
        const ex = productSalesMap.get(key);
        if (ex) {
          ex.qty += q;
          ex.revenue += rev;
        } else {
          productSalesMap.set(key, { qty: q, revenue: rev, name: pName || 'منتج' });
        }
      }
    } else if (ord.productName) {
      const pName = String(ord.productName).trim();
      const key = normalizeText(pName);
      const rev = Number(ord.finalTotal ?? ord.totalAmount ?? ord.price ?? 0);
      const ex = productSalesMap.get(key);
      if (ex) {
        ex.qty += 1;
        ex.revenue += rev;
      } else {
        productSalesMap.set(key, { qty: 1, revenue: rev, name: pName });
      }
    }
  }

  const productVelocities: ProductVelocityItem[] = (products as any[]).map((p) => {
    const pName = String(p.productName || p.name || 'منتج');
    const byId = productSalesMap.get(String(p.id || ''));
    const byName = productSalesMap.get(normalizeText(pName));
    const stats = byId || byName;

    return {
      id: String(p.id || pName),
      name: pName,
      currentStock: Number(p.currentStock ?? 1),
      costPrice: Number(p.costPrice || p.costPerUnit || 0),
      sellingPrice: Number(p.sellingPrice || p.retailPrice || 0),
      soldQty: stats?.qty || 0,
      soldRevenue: Math.round(stats?.revenue || 0),
    };
  });

  // لو في مبيعات لمنتجات غير محفوظة في الكتالوج نضيفها للأكثر مبيعاً
  for (const [k, st] of productSalesMap.entries()) {
    const exists = productVelocities.some(
      (p) => p.id === k || normalizeText(p.name) === normalizeText(st.name)
    );
    if (!exists && st.qty > 0) {
      productVelocities.push({
        id: k,
        name: st.name,
        currentStock: 0,
        costPrice: 0,
        sellingPrice: st.qty > 0 ? Math.round(st.revenue / st.qty) : 0,
        soldQty: st.qty,
        soldRevenue: Math.round(st.revenue),
      });
    }
  }

  const productsCostValue = Math.round(
    (products as any[]).reduce(
      (s, p) => s + Number(p.currentStock ?? 1) * Number(p.costPrice || p.costPerUnit || 0),
      0
    )
  );
  const productsRetailValue = Math.round(
    (products as any[]).reduce(
      (s, p) => s + Number(p.currentStock ?? 1) * Number(p.sellingPrice || p.retailPrice || 0),
      0
    )
  );

  const bestSellingProducts = [...productVelocities]
    .filter((p) => p.soldQty > 0)
    .sort((a, b) => b.soldQty - a.soldQty || b.soldRevenue - a.soldRevenue)
    .slice(0, 4);

  const slowestProducts = [...productVelocities]
    .filter((p) => !bestSellingProducts.some((b) => b.id === p.id))
    .sort((a, b) => a.soldQty - b.soldQty || b.currentStock - a.currentStock)
    .slice(0, 4);

  return {
    generatedAt: now,
    currencySymbol,
    financial: {
      liquidity: {
        cashTotal: Math.round(cashTotal),
        instapayBankTotal: Math.round(instapayBankTotal),
        walletsCustodyTotal: Math.round(walletsCustodyTotal),
        totalLiquidity: Math.round(totalLiquidity),
        treasuries,
      },
      receivablesTotal: Math.round(receivablesTotal),
      debtors,
      overdueDebtorsCount,
      payablesTotal: Math.round(payablesTotal),
      creditors,
      netWorkingPosition: Math.round(totalLiquidity + receivablesTotal - payablesTotal),
    },
    warehouse: {
      materialsCount: activeMaterials.length,
      materialsTotalValue: Math.round(materialsTotalValue),
      lowStockMaterials,
      fastMovingMaterials,
      slowMovingMaterials,
      productsCount: (products as any[]).length,
      productsCostValue,
      productsRetailValue,
      bestSellingProducts,
      slowestProducts,
    },
  };
}

export function buildPoliteCollectionWhatsAppUrl(
  phone: string | undefined,
  clientName: string,
  amount: number,
  currencySymbol: string,
  brandName: string,
  daysOverdue = 0
): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const intlPhone = digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
  const formattedAmt = Math.round(amount || 0).toLocaleString('ar-EG');
  const greeting = daysOverdue > 0
    ? `أهلاً بحضرتك يا أ/ ${clientName}، كل التحية والتقدير من ${brandName || 'منظومة الشمساوية'} 🌿.\nنذكّركم بكل ود بأن هناك رصيد مستحق بقيمة ${formattedAmt} ${currencySymbol} (متأخر منذ ${daysOverdue} يوم) وبنسعد جداً بسداده أو تأكيد ميعاد التحصيل المناسب لحضرتك. شاكرين جداً لتعاونك وذوقك!`
    : `أهلاً بحضرتك يا أ/ ${clientName}، كل التحية والتقدير من ${brandName || 'منظومة الشمساوية'} 🌿.\nحابين نطمئن على شغلكم ونذكّركم بكل ود أن رصيد الحساب المتبقي حالياً هو ${formattedAmt} ${currencySymbol}. لو تحب تحدد ميعاد السداد المناسب لحضرتك بنشرف دايماً بالتعامل معاك!`;
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(greeting)}`;
}

export interface SupplierExecutiveBrief {
  generatedAt: number;
  currencySymbol: string;
  brandName: string;
  financial: {
    ownerMainTreasuryTotal: number;
    branchesPendingTreasuryTotal: number;
    totalCashOnHand: number;
    legacyTreasuryTotal: number;
    cashChannelTotal: number;
    instapayChannelTotal: number;
    walletChannelTotal: number;
    pendingTransfersCount: number;
    receivablesTotal: number;
    debtors: DebtorSummaryItem[];
    payablesTotal: number;
    creditors: CreditorSummaryItem[];
    netWorkingPosition: number;
    todayPosSales: number;
    todayPosOrdersCount: number;
    branchesSummary: Array<{
      branchId: string;
      branchName: string;
      branchType: string;
      cash: number;
      instapay: number;
      wallet: number;
      total: number;
    }>;
  };
  warehouse: {
    branchesCount: number;
    itemsCount: number;
    totalStockValuation: number;
    lowStockItems: Array<{
      id: string;
      skuCode: string;
      name: string;
      branchName: string;
      quantity: number;
      minAlert: number;
      saleUnit: string;
      valuation: number;
    }>;
    highestValueItems: Array<{
      id: string;
      name: string;
      branchName: string;
      quantity: number;
      saleUnit: string;
      valuation: number;
    }>;
  };
}

export async function buildSupplierExecutiveBrief(
  currencySymbol = 'ج.م',
  brandName = 'متجر المورد'
): Promise<SupplierExecutiveBrief> {
  const [overview, customers, finance, inventory, vendors] = await Promise.all([
    fetchSupplierErpOverview().catch(() => null),
    fetchSupplierCustomers().catch(() => []),
    fetchSupplierFinance().catch(() => ({ treasuries: [], transactions: [], expenses: [] })),
    fetchBranchInventory().catch(() => []),
    fetchErpVendors().catch(() => []),
  ]);

  const legacyTreasuryTotal = (finance.treasuries || []).reduce(
    (sum, t) => sum + Number(t.balance || 0),
    0
  );

  const branches = overview?.branches || [];
  const branchTreasuries = overview?.branchTreasuries || [];

  let cashChannelTotal = 0;
  let instapayChannelTotal = 0;
  let walletChannelTotal = 0;

  const branchesSummary = branchTreasuries.map((bt) => {
    const br = branches.find((b) => b.id === bt.branchId);
    const cash = Number(bt.cashBalance || 0);
    const instapay = Number(bt.instapayBalance || 0);
    const wallet = Number(bt.walletBalance || 0);
    cashChannelTotal += cash;
    instapayChannelTotal += instapay;
    walletChannelTotal += wallet;
    return {
      branchId: bt.branchId,
      branchName: br?.name || 'فرع / خزينة',
      branchType: br?.branchType || 'shop',
      cash: Math.round(cash),
      instapay: Math.round(instapay),
      wallet: Math.round(wallet),
      total: Math.round(cash + instapay + wallet),
    };
  });

  // Fallback to legacy treasury channels if no ERP branch treasuries exist yet
  if (branchTreasuries.length === 0 && (finance.treasuries || []).length > 0) {
    for (const tr of finance.treasuries || []) {
      const cls = classifyChannel(tr.name);
      const bal = Number(tr.balance || 0);
      if (cls === 'cash') cashChannelTotal += bal;
      else if (cls === 'instapay_bank') instapayChannelTotal += bal;
      else walletChannelTotal += bal;
    }
  }

  const ownerMainTreasuryTotal = Math.round(
    overview?.kpis?.ownerMainTreasuryTotal ?? legacyTreasuryTotal
  );
  const branchesPendingTreasuryTotal = Math.round(
    overview?.kpis?.branchesPendingTreasuryTotal ?? 0
  );
  const totalCashOnHand = Math.round(
    overview?.kpis?.totalCashOnHand ??
      ownerMainTreasuryTotal + branchesPendingTreasuryTotal
  );

  // Debtors from supplier_customers & overview KPI
  const debtors: DebtorSummaryItem[] = (customers || [])
    .filter((c) => Number(c.balanceDue || 0) > 0.5)
    .map((c) => ({
      key: c.id,
      name: c.name || 'ورشة / عميل',
      phone: c.phone || undefined,
      totalOwed: Math.round(Number(c.balanceDue || 0)),
      invoicesCount: 1,
      daysOverdue: 0,
      isOverdue: Number(c.balanceDue || 0) >= 1000,
      shouldWarnNoMoreCredit: false,
      warningText:
        Number(c.balanceDue || 0) >= 3000
          ? 'مديونية عالية — يفضّل التحصيل أولاً قبل فتح طلبيات آجلة جديدة.'
          : undefined,
    }))
    .sort((a, b) => b.totalOwed - a.totalOwed);

  const receivablesTotal = Math.round(
    Math.max(
      Number(overview?.kpis?.receivablesFromCustomers || 0),
      debtors.reduce((s, d) => s + d.totalOwed, 0)
    )
  );

  // Creditors (vendors / factories)
  const creditors: CreditorSummaryItem[] = (vendors || [])
    .filter((v) => Number(v.balanceOwed || 0) > 0.5)
    .map((v) => ({
      key: v.id,
      name: v.name,
      phone: v.phone || undefined,
      totalOwed: Math.round(Number(v.balanceOwed || 0)),
      invoicesCount: 1,
    }))
    .sort((a, b) => b.totalOwed - a.totalOwed);

  const payablesTotal = Math.round(
    Math.max(
      Number(overview?.kpis?.payablesToVendors || 0),
      creditors.reduce((s, c) => s + c.totalOwed, 0)
    )
  );

  const enrichedItems = (inventory || []).map((it) => {
    const brName = branches.find((b) => b.id === it.branchId)?.name || 'المخزن الرئيسي';
    const val = Math.round(Number(it.quantity || 0) * Number(it.avgCost || 0));
    return {
      id: it.id,
      skuCode: it.skuCode || '',
      name: it.itemName,
      branchName: brName,
      quantity: Number(it.quantity || 0),
      minAlert: Number(it.minAlert || 5),
      saleUnit: it.saleUnit || 'وحدة',
      valuation: val,
    };
  });

  const lowStockItems = enrichedItems
    .filter((i) => i.quantity <= i.minAlert)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 6);

  const highestValueItems = [...enrichedItems]
    .sort((a, b) => b.valuation - a.valuation)
    .slice(0, 6);

  const computedValuation = enrichedItems.reduce((s, i) => s + i.valuation, 0);
  const totalStockValuation = Math.round(
    Number(overview?.kpis?.totalStockValuation || 0) || computedValuation
  );

  return {
    generatedAt: Date.now(),
    currencySymbol,
    brandName: overview?.brandName || brandName,
    financial: {
      ownerMainTreasuryTotal,
      branchesPendingTreasuryTotal,
      totalCashOnHand,
      legacyTreasuryTotal: Math.round(legacyTreasuryTotal),
      cashChannelTotal: Math.round(cashChannelTotal),
      instapayChannelTotal: Math.round(instapayChannelTotal),
      walletChannelTotal: Math.round(walletChannelTotal),
      pendingTransfersCount: overview?.pendingTransfers?.length || 0,
      receivablesTotal,
      debtors,
      payablesTotal,
      creditors,
      netWorkingPosition: Math.round(totalCashOnHand + receivablesTotal - payablesTotal),
      todayPosSales: Math.round(overview?.kpis?.todayPosSales || 0),
      todayPosOrdersCount: Number(overview?.kpis?.todayPosOrdersCount || 0),
      branchesSummary,
    },
    warehouse: {
      branchesCount: branches.length || 1,
      itemsCount: enrichedItems.length,
      totalStockValuation,
      lowStockItems,
      highestValueItems,
    },
  };
}

