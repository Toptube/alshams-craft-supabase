import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FILES = {
  suppliers: path.resolve(ROOT_DIR, 'data/platform_suppliers.json'),
  catalog: path.resolve(ROOT_DIR, 'data/supplier_catalog_items.json'),
  customers: path.resolve(ROOT_DIR, 'data/supplier_customers.json'),
  treasuries: path.resolve(ROOT_DIR, 'data/supplier_treasuries.json'),
  transactions: path.resolve(ROOT_DIR, 'data/supplier_treasury_transactions.json'),
  branches: path.resolve(ROOT_DIR, 'data/supplier_branches.json'),
  categories: path.resolve(ROOT_DIR, 'data/supplier_categories.json'),
  inventory: path.resolve(ROOT_DIR, 'data/supplier_branch_inventory.json'),
  movements: path.resolve(ROOT_DIR, 'data/supplier_stock_movements.json'),
  staff: path.resolve(ROOT_DIR, 'data/supplier_staff_users.json'),
  hrLogs: path.resolve(ROOT_DIR, 'data/supplier_hr_logs.json'),
  shifts: path.resolve(ROOT_DIR, 'data/supplier_pos_shifts.json'),
  branchTreasuries: path.resolve(ROOT_DIR, 'data/supplier_branch_treasuries.json'),
  treasuryTransfers: path.resolve(ROOT_DIR, 'data/supplier_treasury_transfers.json'),
  posOrders: path.resolve(ROOT_DIR, 'data/supplier_pos_orders.json'),
  vendors: path.resolve(ROOT_DIR, 'data/supplier_vendors.json'),
  purchases: path.resolve(ROOT_DIR, 'data/supplier_purchases.json'),
};

function readArr(filePath: string): any[] {
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function writeArr(filePath: string, data: any[]) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[Supplier ERP JSON Write Error] ${path.basename(filePath)}:`, err);
  }
}

const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : String(xff || req.ip || req.socket?.remoteAddress || '');
  return raw.split(',')[0].trim();
}

function hashStaffPassword(raw: string): string {
  const salt = 'alshams_sup_staff_2026';
  return crypto.createHash('sha256').update(`${salt}:${String(raw || '')}`).digest('hex');
}

const STAFF_TOKEN_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'alshams_erp_kiosk_secret_2026';

function signStaffToken(payload: { staffId: string; supplierId: string; branchId: string; role: string; fullName: string }): string {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', STAFF_TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyStaffToken(token?: string | null): { staffId: string; supplierId: string; branchId: string; role: string; fullName: string } | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', STAFF_TOKEN_SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

export interface SupplierErpRouteDeps {
  requireAuth: any;
  getDbClient: (req: any) => any;
  supabaseAdminClient: any;
  resolveActiveSupplierForReq: (req: any) => Promise<any | null>;
  isSuperAdmin: (email?: string) => boolean;
}

export function registerSupplierErpRoutes(app: Express, deps: SupplierErpRouteDeps) {
  const { requireAuth, getDbClient, supabaseAdminClient, resolveActiveSupplierForReq, isSuperAdmin } = deps;

  /**
   * Resolves either an authenticated Supplier Owner OR an authenticated Branch Staff Terminal session
   */
  async function resolveErpActor(
    req: any,
    res: Response
  ): Promise<{ supplier: any; client: any; isOwner: boolean; staff: any | null; actorName: string } | null> {
    const staffToken = (req.headers['x-staff-token'] as string) || '';
    if (staffToken) {
      const claims = verifyStaffToken(staffToken);
      if (claims) {
        const localSups = readArr(FILES.suppliers);
        let supplier = localSups.find((s: any) => s.id === claims.supplierId);
        if (!supplier) {
          try {
            const { data } = await supabaseAdminClient
              .from('platform_suppliers')
              .select('*')
              .eq('id', claims.supplierId)
              .maybeSingle();
            if (data) supplier = data;
          } catch {}
        }
        if (supplier) {
          const staffList = readArr(FILES.staff);
          const staffRow = staffList.find((st: any) => st.id === claims.staffId && st.supplier_id === supplier.id);
          if (!staffRow || staffRow.is_active !== false) {
            return {
              supplier,
              client: supabaseAdminClient,
              isOwner: false,
              staff: staffRow || claims,
              actorName: claims.fullName || staffRow?.full_name || 'موظف الفرع',
            };
          }
        }
      }
    }

    // Fallback to standard Supabase JWT Auth
    let authedOk = false;
    await new Promise<void>((resolve) => {
      requireAuth(req, res, () => {
        authedOk = true;
        resolve();
      });
      // If requireAuth responded with 401/403 directly, wait won't invoke next
      setTimeout(() => resolve(), 50);
    });
    if (!authedOk || res.headersSent) return null;

    const supplier = await resolveActiveSupplierForReq(req);
    if (!supplier) {
      res.status(404).json({ error: 'لم يتم العثور على حساب مورد نشط' });
      return null;
    }

    const client = getDbClient(req);
    const actorName = supplier.owner_name || supplier.ownerName || req.userEmail || 'المالك';
    return { supplier, client, isOwner: true, staff: null, actorName };
  }

  /** Helper to merge Supabase table + JSON array for a given supplier_id */
  async function loadSupplierTable(client: any, table: string, jsonFile: string, supplierId: string): Promise<any[]> {
    const merged = new Map<string, any>();
    readArr(jsonFile)
      .filter((r: any) => r.supplier_id === supplierId)
      .forEach((r: any) => r?.id && merged.set(r.id, r));
    try {
      const { data } = await client.from(table).select('*').eq('supplier_id', supplierId);
      if (Array.isArray(data)) {
        data.forEach((r: any) => r?.id && merged.set(r.id, { ...(merged.get(r.id) || {}), ...r }));
      }
    } catch {}
    return Array.from(merged.values());
  }

  async function upsertRow(client: any, table: string, jsonFile: string, row: any) {
    const list = readArr(jsonFile);
    const idx = list.findIndex((r: any) => r.id === row.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.unshift(row);
    writeArr(jsonFile, list);
    try {
      await client.from(table).upsert(row, { onConflict: 'id' });
    } catch {}
  }

  /** Ensure supplier always has at least 1 default active branch if none created yet */
  async function ensureDefaultBranch(client: any, supplier: any): Promise<any[]> {
    let branches = await loadSupplierTable(client, 'supplier_branches', FILES.branches, supplier.id);
    if (branches.length === 0) {
      const nowIso = new Date().toISOString();
      const firstBranch = {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        name: `${supplier.brand_name || supplier.brandName || 'المقر'} — الفرع الرئيسي`,
        code: 'BR-01',
        branch_type: 'shop',
        governorate: supplier.governorate || 'القاهرة',
        address: '',
        phone: supplier.phone || '',
        pos_enabled: true,
        is_active: true,
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso,
      };
      await upsertRow(client, 'supplier_branches', FILES.branches, firstBranch);
      branches = [firstBranch];
    }
    return branches;
  }

  // =========================================================================
  // 1. OVERVIEW & TREE SETUP
  // =========================================================================
  app.get('/api/supplier/erp/overview', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client } = actor;

    const branches = await ensureDefaultBranch(client, supplier);
    const [
      mainTreasuries,
      branchTreasuries,
      transfers,
      shifts,
      customers,
      vendors,
      inventory,
      posOrders,
    ] = await Promise.all([
      loadSupplierTable(client, 'supplier_treasuries', FILES.treasuries, supplier.id),
      loadSupplierTable(client, 'supplier_branch_treasuries', FILES.branchTreasuries, supplier.id),
      loadSupplierTable(client, 'supplier_treasury_transfers', FILES.treasuryTransfers, supplier.id),
      loadSupplierTable(client, 'supplier_pos_shifts', FILES.shifts, supplier.id),
      loadSupplierTable(client, 'supplier_customers', FILES.customers, supplier.id),
      loadSupplierTable(client, 'supplier_vendors', FILES.vendors, supplier.id),
      loadSupplierTable(client, 'supplier_branch_inventory', FILES.inventory, supplier.id),
      loadSupplierTable(client, 'supplier_pos_orders', FILES.posOrders, supplier.id),
    ]);

    const ownerMainTreasuryTotal = r2(
      mainTreasuries.reduce((sum: number, t: any) => sum + Number(t.balance || 0), 0)
    );
    const branchesPendingTreasuryTotal = r2(
      branchTreasuries.reduce(
        (sum: number, bt: any) =>
          sum + Number(bt.cash_balance || 0) + Number(bt.instapay_balance || 0) + Number(bt.wallet_balance || 0),
        0
      )
    );
    const receivablesFromCustomers = r2(
      customers.reduce((sum: number, c: any) => sum + Number(c.balance_due || c.balanceDue || 0), 0)
    );
    const payablesToVendors = r2(
      vendors.reduce((sum: number, v: any) => sum + Number(v.balance_owed || 0), 0)
    );
    const totalStockValuation = r2(
      inventory.reduce((sum: number, it: any) => sum + Number(it.quantity || 0) * Number(it.avg_cost || 0), 0)
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = posOrders.filter((o: any) => String(o.created_at || '').startsWith(todayStr));
    const todayPosSales = r2(todayOrders.reduce((s: number, o: any) => s + Number(o.final_total || 0), 0));

    return res.json({
      success: true,
      overview: {
        supplierId: supplier.id,
        brandName: supplier.brand_name || supplier.brandName || '',
        currencySymbol: supplier.currency_symbol || supplier.currencySymbol || 'ج.م',
        hasCentralWarehouse: Boolean(supplier.has_central_warehouse),
        maxBranchesApproved: Number(supplier.max_branches_approved || 1),
        branchExpansionRequested: Number(supplier.branch_expansion_requested || 0),
        branchExpansionReason: supplier.branch_expansion_reason || '',
        branchExpansionStatus: supplier.branch_expansion_status || 'none',
        ownerUnlockPinSet: Boolean(supplier.owner_unlock_pin || '1234'),
        branches: branches.map(mapBranch),
        branchTreasuries: branchTreasuries.map(mapBranchTreasury),
        pendingTransfers: transfers
          .filter((t: any) => t.status === 'pending_owner_confirmation')
          .map(mapTreasuryTransfer),
        confirmedTransfersCount: transfers.filter((t: any) => t.status === 'confirmed').length,
        openShifts: shifts.filter((s: any) => s.status === 'open').map(mapShift),
        kpis: {
          ownerMainTreasuryTotal,
          branchesPendingTreasuryTotal,
          totalCashOnHand: r2(ownerMainTreasuryTotal + branchesPendingTreasuryTotal),
          receivablesFromCustomers,
          payablesToVendors,
          totalStockValuation,
          todayPosSales,
          todayPosOrdersCount: todayOrders.length,
        },
      },
    });
  });

  app.post('/api/supplier/erp/tree', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor || !actor.isOwner) {
      if (actor) res.status(403).json({ error: 'إدارة الشجرة متاحة لحساب مالك النشاط فقط' });
      return;
    }
    const { supplier, client } = actor;
    const b = req.body || {};
    const nowIso = new Date().toISOString();

    const updates: Record<string, any> = { updated_at: nowIso };
    if (b.hasCentralWarehouse !== undefined) {
      updates.has_central_warehouse = Boolean(b.hasCentralWarehouse);
    }
    if (b.ownerUnlockPin && String(b.ownerUnlockPin).trim().length >= 4) {
      updates.owner_unlock_pin = String(b.ownerUnlockPin).trim();
    }

    const sups = readArr(FILES.suppliers);
    const sIdx = sups.findIndex((x: any) => x.id === supplier.id);
    if (sIdx >= 0) {
      sups[sIdx] = { ...sups[sIdx], ...updates };
      writeArr(FILES.suppliers, sups);
    }
    try {
      await client.from('platform_suppliers').update(updates).eq('id', supplier.id);
    } catch {}

    // If central warehouse enabled, ensure a central_warehouse branch row exists
    const existingBranches = await ensureDefaultBranch(client, supplier);
    if (updates.has_central_warehouse) {
      const hasCW = existingBranches.some((br: any) => br.branch_type === 'central_warehouse');
      if (!hasCW) {
        await upsertRow(client, 'supplier_branches', FILES.branches, {
          id: crypto.randomUUID(),
          supplier_id: supplier.id,
          name: 'المخزن الرئيسي المركزي',
          code: 'CW-00',
          branch_type: 'central_warehouse',
          governorate: supplier.governorate || 'القاهرة',
          address: '',
          phone: supplier.phone || '',
          pos_enabled: false,
          is_active: true,
          status: 'active',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    // Create a new shop branch if requested and within approved limit
    if (b.newBranch?.name) {
      const activeShops = existingBranches.filter((br: any) => br.branch_type === 'shop');
      const maxAllowed = Number(supplier.max_branches_approved || 1);
      if (activeShops.length >= maxAllowed) {
        return res.status(403).json({
          error: `الحد المعتمد حالياً لعدد الفروع هو (${maxAllowed}). لفتح فرع إضافي يرجى إرسال طلب توسع لموافقة إدارة المنظومة.`,
          requiresAdminApproval: true,
          maxAllowed,
        });
      }
      const nextCode = `BR-0${activeShops.length + 1}`;
      const newBr = {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        name: String(b.newBranch.name).trim(),
        code: nextCode,
        branch_type: 'shop',
        governorate: String(b.newBranch.governorate || supplier.governorate || ''),
        address: String(b.newBranch.address || ''),
        phone: String(b.newBranch.phone || ''),
        pos_enabled: true,
        is_active: true,
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso,
      };
      await upsertRow(client, 'supplier_branches', FILES.branches, newBr);
    }

    if (b.updateBranch?.id) {
      const target = existingBranches.find((br: any) => br.id === b.updateBranch.id);
      if (target) {
        await upsertRow(client, 'supplier_branches', FILES.branches, {
          ...target,
          name: b.updateBranch.name ?? target.name,
          governorate: b.updateBranch.governorate ?? target.governorate,
          address: b.updateBranch.address ?? target.address,
          phone: b.updateBranch.phone ?? target.phone,
          is_active: b.updateBranch.isActive ?? target.is_active,
          updated_at: nowIso,
        });
      }
    }

    const updatedBranches = await loadSupplierTable(client, 'supplier_branches', FILES.branches, supplier.id);
    return res.json({ success: true, branches: updatedBranches.map(mapBranch) });
  });

  app.post('/api/supplier/erp/request-branches', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor || !actor.isOwner) return;
    const { supplier, client } = actor;
    const requestedCount = Math.max(2, Number(req.body?.requestedCount || 2));
    const reason = String(req.body?.reason || '').trim();
    const nowIso = new Date().toISOString();

    const updates = {
      branch_expansion_requested: requestedCount,
      branch_expansion_reason: reason,
      branch_expansion_status: 'pending',
      updated_at: nowIso,
    };

    const sups = readArr(FILES.suppliers);
    const idx = sups.findIndex((x: any) => x.id === supplier.id);
    if (idx >= 0) {
      sups[idx] = { ...sups[idx], ...updates };
      writeArr(FILES.suppliers, sups);
    }
    try {
      await client.from('platform_suppliers').update(updates).eq('id', supplier.id);
    } catch {}

    return res.json({ success: true, ...updates });
  });

  // Super Admin Approval / Inspection of Supplier Branches
  app.patch('/api/admin/suppliers/:id/branch-approval', requireAuth, async (req: any, res: Response) => {
    const email = req.userEmail || req.user?.email || '';
    if (!isSuperAdmin(email)) {
      return res.status(403).json({ error: 'صلاحيات غير كافية' });
    }
    const supId = req.params.id;
    const b = req.body || {};
    const approve = Boolean(b.approve);
    const approvedMaxBranches = Math.max(1, Number(b.approvedMaxBranches || 2));
    const nowIso = new Date().toISOString();

    const updates: Record<string, any> = approve
      ? {
          max_branches_approved: approvedMaxBranches,
          branch_expansion_status: 'approved',
          updated_at: nowIso,
        }
      : {
          branch_expansion_status: 'rejected',
          updated_at: nowIso,
        };

    const sups = readArr(FILES.suppliers);
    const idx = sups.findIndex((x: any) => x.id === supId);
    if (idx >= 0) {
      sups[idx] = { ...sups[idx], ...updates };
      writeArr(FILES.suppliers, sups);
    }
    try {
      const client = getDbClient(req);
      await client.from('platform_suppliers').update(updates).eq('id', supId);
    } catch {}

    return res.json({ success: true, supplierId: supId, ...updates });
  });

  app.get('/api/admin/suppliers/:id/branches', requireAuth, async (req: any, res: Response) => {
    const email = req.userEmail || req.user?.email || '';
    if (!isSuperAdmin(email)) {
      return res.status(403).json({ error: 'صلاحيات غير كافية' });
    }
    const client = getDbClient(req);
    const supId = req.params.id;
    const [branches, branchTreasuries, inventory] = await Promise.all([
      loadSupplierTable(client, 'supplier_branches', FILES.branches, supId),
      loadSupplierTable(client, 'supplier_branch_treasuries', FILES.branchTreasuries, supId),
      loadSupplierTable(client, 'supplier_branch_inventory', FILES.inventory, supId),
    ]);
    return res.json({
      success: true,
      branches: branches.map(mapBranch),
      branchTreasuries: branchTreasuries.map(mapBranchTreasury),
      totalItemsCount: inventory.length,
    });
  });

  // =========================================================================
  // 2. CATEGORIES & SUB-CATEGORIES (MAIN & SUB)
  // =========================================================================
  app.get('/api/supplier/erp/categories', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const list = await loadSupplierTable(actor.client, 'supplier_categories', FILES.categories, actor.supplier.id);
    return res.json({
      success: true,
      categories: list.map((c: any) => ({
        id: c.id,
        supplierId: c.supplier_id,
        parentId: c.parent_id || null,
        name: c.name,
        createdAt: c.created_at,
      })),
    });
  });

  app.post('/api/supplier/erp/categories', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'اسم التصنيف مطلوب' });
    const row = {
      id: req.body?.id || crypto.randomUUID(),
      supplier_id: actor.supplier.id,
      parent_id: req.body?.parentId || null,
      name,
      created_at: new Date().toISOString(),
    };
    await upsertRow(actor.client, 'supplier_categories', FILES.categories, row);
    return res.json({
      success: true,
      category: {
        id: row.id,
        supplierId: row.supplier_id,
        parentId: row.parent_id,
        name: row.name,
        createdAt: row.created_at,
      },
    });
  });

  app.delete('/api/supplier/erp/categories/:id', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const id = req.params.id;
    const list = readArr(FILES.categories).filter(
      (c: any) => !(c.supplier_id === actor.supplier.id && (c.id === id || c.parent_id === id))
    );
    writeArr(FILES.categories, list);
    try {
      await actor.client.from('supplier_categories').delete().eq('supplier_id', actor.supplier.id).eq('id', id);
    } catch {}
    return res.json({ success: true });
  });

  // =========================================================================
  // 3. ZERO-IMAGE WAREHOUSE INVENTORY, MULTI-UNIT CONVERSION & TRANSFERS
  // =========================================================================
  app.get('/api/supplier/erp/inventory', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const branchIdFilter = String(req.query?.branchId || '');
    const all = await loadSupplierTable(actor.client, 'supplier_branch_inventory', FILES.inventory, actor.supplier.id);
    const filtered = branchIdFilter ? all.filter((i: any) => i.branch_id === branchIdFilter) : all;
    return res.json({ success: true, items: filtered.map(mapInventoryItem) });
  });

  app.post('/api/supplier/erp/inventory', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client, actorName, staff } = actor;
    const b = req.body || {};
    const branchId = String(b.branchId || '');
    const itemName = String(b.itemName || '').trim();
    if (!branchId || !itemName) {
      return res.status(400).json({ error: 'الفرع/المخزن واسم الصنف مطلوبان' });
    }

    const nowIso = new Date().toISOString();
    const existingAll = await loadSupplierTable(client, 'supplier_branch_inventory', FILES.inventory, supplier.id);
    const existing = b.id ? existingAll.find((x: any) => x.id === b.id) : null;

    const factor = Math.max(0.001, Number(b.conversionFactor || existing?.conversion_factor || 1));
    const purchasePackages = b.purchasePackages !== undefined ? Number(b.purchasePackages) : null;
    const initialQty =
      purchasePackages !== null
        ? r3(purchasePackages * factor)
        : r3(Number(b.quantity ?? existing?.quantity ?? 0));

    const itemId = String(b.itemId || existing?.item_id || crypto.randomUUID());
    const skuCode =
      String(b.skuCode || existing?.sku_code || '').trim() ||
      `MAT-${Math.floor(100000 + Math.random() * 900000)}`;

    const row = {
      id: existing?.id || crypto.randomUUID(),
      supplier_id: supplier.id,
      branch_id: branchId,
      item_id: itemId,
      sku_code: skuCode,
      item_name: itemName,
      category_id: String(b.categoryId || ''),
      sub_category_id: String(b.subCategoryId || ''),
      purchase_unit: String(b.purchaseUnit || 'طرد'),
      sale_unit: String(b.saleUnit || 'كيلو'),
      conversion_factor: r3(factor),
      quantity: initialQty,
      min_alert: r3(b.minAlert ?? existing?.min_alert ?? 5),
      avg_cost: r2(b.avgCost ?? existing?.avg_cost ?? 0),
      retail_price: r2(b.retailPrice ?? existing?.retail_price ?? 0),
      wholesale_price: r2(b.wholesalePrice ?? existing?.wholesale_price ?? 0),
      updated_at: nowIso,
    };

    await upsertRow(client, 'supplier_branch_inventory', FILES.inventory, row);

    const prevQty = Number(existing?.quantity || 0);
    const delta = r3(row.quantity - prevQty);
    if (!existing || delta !== 0) {
      await upsertRow(client, 'supplier_stock_movements', FILES.movements, {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        branch_id: branchId,
        to_branch_id: null,
        item_id: itemId,
        sku_code: skuCode,
        item_name: itemName,
        movement_type: existing ? 'adjustment' : 'purchase_in',
        qty_delta: delta,
        balance_after: row.quantity,
        unit_label: row.sale_unit,
        unit_cost: row.avg_cost,
        reference_no: b.referenceNo || 'رصيد افتتاحي/تعديل',
        actor_staff_id: staff?.id || '',
        actor_name: actorName,
        notes: b.notes || (purchasePackages ? `إدخال ${purchasePackages} ${row.purchase_unit} (×${factor})` : ''),
        created_at: nowIso,
      });
    }

    return res.json({ success: true, item: mapInventoryItem(row) });
  });

  app.post('/api/supplier/erp/transfer', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client, actorName, staff } = actor;
    const { fromBranchId, toBranchId, itemId, quantity, notes } = req.body || {};
    const qty = r3(Number(quantity || 0));
    if (!fromBranchId || !toBranchId || fromBranchId === toBranchId || !itemId || qty <= 0) {
      return res.status(400).json({ error: 'بيانات التحويل بين المخازن غير مكتملة' });
    }

    const allInv = await loadSupplierTable(client, 'supplier_branch_inventory', FILES.inventory, supplier.id);
    const src = allInv.find((i: any) => i.branch_id === fromBranchId && i.item_id === itemId);
    if (!src) return res.status(404).json({ error: 'الصنف غير موجود في المخزن المُرسِل' });
    if (Number(src.quantity) < qty) {
      return res.status(400).json({ error: `الرصيد المتاح (${src.quantity} ${src.sale_unit}) أقل من الكمية المطلوب تحويلها` });
    }

    const nowIso = new Date().toISOString();
    const refNo = `TR-${Date.now().toString().slice(-6)}`;
    const nextSrcQty = r3(Number(src.quantity) - qty);
    await upsertRow(client, 'supplier_branch_inventory', FILES.inventory, {
      ...src,
      quantity: nextSrcQty,
      updated_at: nowIso,
    });

    const dst = allInv.find((i: any) => i.branch_id === toBranchId && i.item_id === itemId);
    const nextDstQty = r3(Number(dst?.quantity || 0) + qty);
    const dstRow = {
      ...(dst || {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        branch_id: toBranchId,
        item_id: src.item_id,
        sku_code: src.sku_code,
        item_name: src.item_name,
        category_id: src.category_id,
        sub_category_id: src.sub_category_id,
        purchase_unit: src.purchase_unit,
        sale_unit: src.sale_unit,
        conversion_factor: src.conversion_factor,
        min_alert: src.min_alert,
        avg_cost: src.avg_cost,
        retail_price: src.retail_price,
        wholesale_price: src.wholesale_price,
      }),
      quantity: nextDstQty,
      avg_cost: dst?.avg_cost ? r2((Number(dst.quantity) * Number(dst.avg_cost) + qty * Number(src.avg_cost)) / Math.max(0.001, nextDstQty)) : src.avg_cost,
      updated_at: nowIso,
    };
    await upsertRow(client, 'supplier_branch_inventory', FILES.inventory, dstRow);

    await Promise.all([
      upsertRow(client, 'supplier_stock_movements', FILES.movements, {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        branch_id: fromBranchId,
        to_branch_id: toBranchId,
        item_id: src.item_id,
        sku_code: src.sku_code,
        item_name: src.item_name,
        movement_type: 'transfer_out',
        qty_delta: -qty,
        balance_after: nextSrcQty,
        unit_label: src.sale_unit,
        unit_cost: src.avg_cost,
        reference_no: refNo,
        actor_staff_id: staff?.id || '',
        actor_name: actorName,
        notes: notes || 'تحويل منصرف لفرع آخر',
        created_at: nowIso,
      }),
      upsertRow(client, 'supplier_stock_movements', FILES.movements, {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        branch_id: toBranchId,
        to_branch_id: fromBranchId,
        item_id: src.item_id,
        sku_code: src.sku_code,
        item_name: src.item_name,
        movement_type: 'transfer_in',
        qty_delta: qty,
        balance_after: nextDstQty,
        unit_label: src.sale_unit,
        unit_cost: src.avg_cost,
        reference_no: refNo,
        actor_staff_id: staff?.id || '',
        actor_name: actorName,
        notes: notes || 'استلام تحويل وارد من المخزن',
        created_at: nowIso,
      }),
    ]);

    return res.json({ success: true, referenceNo: refNo, fromBalance: nextSrcQty, toBalance: nextDstQty });
  });

  app.get('/api/supplier/erp/item-card/:itemId', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const itemId = req.params.itemId;
    const branchId = String(req.query?.branchId || '');
    const allMovements = await loadSupplierTable(actor.client, 'supplier_stock_movements', FILES.movements, actor.supplier.id);
    const filtered = allMovements
      .filter((m: any) => m.item_id === itemId && (!branchId || m.branch_id === branchId))
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return res.json({ success: true, movements: filtered.map(mapMovement) });
  });

  // =========================================================================
  // 4. EXTERNAL FACTORY VENDORS & PROCUREMENT INVOICES (علينا كام)
  // =========================================================================
  app.get('/api/supplier/erp/vendors', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const list = await loadSupplierTable(actor.client, 'supplier_vendors', FILES.vendors, actor.supplier.id);
    return res.json({ success: true, vendors: list.map(mapVendor) });
  });

  app.post('/api/supplier/erp/vendors', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ error: 'اسم المصنع أو المورد مطلوب' });
    const row = {
      id: b.id || crypto.randomUUID(),
      supplier_id: actor.supplier.id,
      name,
      phone: String(b.phone || ''),
      vendor_type: String(b.vendorType || 'مصنع خامات'),
      address: String(b.address || ''),
      balance_owed: r2(b.balanceOwed || 0),
      notes: String(b.notes || ''),
      created_at: new Date().toISOString(),
    };
    await upsertRow(actor.client, 'supplier_vendors', FILES.vendors, row);
    return res.json({ success: true, vendor: mapVendor(row) });
  });

  app.get('/api/supplier/erp/purchases', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const list = await loadSupplierTable(actor.client, 'supplier_purchases', FILES.purchases, actor.supplier.id);
    list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return res.json({ success: true, purchases: list.map(mapPurchase) });
  });

  app.post('/api/supplier/erp/purchases', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client, actorName, staff } = actor;
    const b = req.body || {};
    const branchId = String(b.branchId || '');
    const items: any[] = Array.isArray(b.items) ? b.items : [];
    if (!branchId || items.length === 0) {
      return res.status(400).json({ error: 'المخزن/الفرع وبنود الفاتورة مطلوبة' });
    }

    const nowIso = new Date().toISOString();
    const invoiceNo = String(b.invoiceNo || `PUR-${Date.now().toString().slice(-6)}`);
    const allInv = await loadSupplierTable(client, 'supplier_branch_inventory', FILES.inventory, supplier.id);

    let totalAmount = 0;
    const processedItems: any[] = [];

    for (const line of items) {
      const pQty = Math.max(0.001, Number(line.purchaseQty || 1));
      const factor = Math.max(0.001, Number(line.conversionFactor || 1));
      const packageCost = Math.max(0, Number(line.packageCost || 0));
      const addedSaleQty = r3(pQty * factor);
      const lineTotal = r2(pQty * packageCost);
      const unitCost = r2(packageCost / factor);
      totalAmount += lineTotal;

      const itemId = String(line.itemId || crypto.randomUUID());
      const existing = allInv.find(
        (i: any) => i.branch_id === branchId && (i.item_id === itemId || (line.skuCode && i.sku_code === line.skuCode))
      );

      const prevQty = Number(existing?.quantity || 0);
      const prevCost = Number(existing?.avg_cost || 0);
      const nextQty = r3(prevQty + addedSaleQty);
      const nextAvgCost = nextQty > 0 ? r2((prevQty * prevCost + lineTotal) / nextQty) : unitCost;

      const skuCode =
        String(line.skuCode || existing?.sku_code || '').trim() ||
        `MAT-${Math.floor(100000 + Math.random() * 900000)}`;

      const invRow = {
        id: existing?.id || crypto.randomUUID(),
        supplier_id: supplier.id,
        branch_id: branchId,
        item_id: existing?.item_id || itemId,
        sku_code: skuCode,
        item_name: String(line.itemName || existing?.item_name || 'خامة جديدة').trim(),
        category_id: String(line.categoryId || existing?.category_id || ''),
        sub_category_id: String(line.subCategoryId || existing?.sub_category_id || ''),
        purchase_unit: String(line.purchaseUnit || existing?.purchase_unit || 'طرد'),
        sale_unit: String(line.saleUnit || existing?.sale_unit || 'كيلو'),
        conversion_factor: r3(factor),
        quantity: nextQty,
        min_alert: Number(existing?.min_alert ?? 5),
        avg_cost: nextAvgCost,
        retail_price: r2(line.retailPrice ?? existing?.retail_price ?? roundUpPrice(unitCost * 1.3)),
        wholesale_price: r2(line.wholesalePrice ?? existing?.wholesale_price ?? roundUpPrice(unitCost * 1.15)),
        updated_at: nowIso,
      };
      await upsertRow(client, 'supplier_branch_inventory', FILES.inventory, invRow);

      await upsertRow(client, 'supplier_stock_movements', FILES.movements, {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        branch_id: branchId,
        to_branch_id: null,
        item_id: invRow.item_id,
        sku_code: skuCode,
        item_name: invRow.item_name,
        movement_type: 'purchase_in',
        qty_delta: addedSaleQty,
        balance_after: nextQty,
        unit_label: invRow.sale_unit,
        unit_cost: unitCost,
        reference_no: invoiceNo,
        actor_staff_id: staff?.id || '',
        actor_name: actorName,
        notes: `فاتورة مشتريات: ${pQty} ${invRow.purchase_unit} = ${addedSaleQty} ${invRow.sale_unit}`,
        created_at: nowIso,
      });

      processedItems.push({ ...line, itemId: invRow.item_id, skuCode, addedSaleQty, unitCost, lineTotal });
    }

    totalAmount = r2(totalAmount);
    const paidAmount = r2(Math.min(totalAmount, Math.max(0, Number(b.paidAmount ?? totalAmount))));
    const remainingAmount = r2(Math.max(0, totalAmount - paidAmount));

    const purchaseRow = {
      id: crypto.randomUUID(),
      supplier_id: supplier.id,
      branch_id: branchId,
      vendor_id: b.vendorId || null,
      vendor_name: String(b.vendorName || 'مورد / مصنع خارجي'),
      invoice_no: invoiceNo,
      items: processedItems,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      treasury_channel: b.treasuryChannel || 'cash',
      actor_name: actorName,
      notes: String(b.notes || ''),
      created_at: nowIso,
    };
    await upsertRow(client, 'supplier_purchases', FILES.purchases, purchaseRow);

    // Update vendor owed balance if partial/credit
    if (b.vendorId && remainingAmount > 0) {
      const vendors = await loadSupplierTable(client, 'supplier_vendors', FILES.vendors, supplier.id);
      const v = vendors.find((x: any) => x.id === b.vendorId);
      if (v) {
        await upsertRow(client, 'supplier_vendors', FILES.vendors, {
          ...v,
          balance_owed: r2(Number(v.balance_owed || 0) + remainingAmount),
        });
      }
    }

    // Deduct paid amount from Owner Main Treasury
    if (paidAmount > 0 && b.treasuryChannel !== 'credit') {
      const treasuries = await loadSupplierTable(client, 'supplier_treasuries', FILES.treasuries, supplier.id);
      const targetTr = treasuries[0];
      if (targetTr) {
        await upsertRow(client, 'supplier_treasuries', FILES.treasuries, {
          ...targetTr,
          balance: r2(Number(targetTr.balance || 0) - paidAmount),
          updated_at: nowIso,
        });
        await upsertRow(client, 'supplier_treasury_transactions', FILES.transactions, {
          id: crypto.randomUUID(),
          supplier_id: supplier.id,
          treasury_id: targetTr.id,
          tx_type: 'withdrawal',
          amount: paidAmount,
          description: `دفع فاتورة مشتريات خامات #${invoiceNo} (${purchaseRow.vendor_name}) — بواسطة ${actorName}`,
          created_at: nowIso,
        });
      }
    }

    return res.json({ success: true, purchase: mapPurchase(purchaseRow) });
  });

  // =========================================================================
  // 5. SHIFTS, POS CASHIER ORDERS, & BRANCH TREASURIES -> OWNER CONFIRMATION
  // =========================================================================
  app.get('/api/supplier/erp/shifts', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const branchId = String(req.query?.branchId || '');
    const list = await loadSupplierTable(actor.client, 'supplier_pos_shifts', FILES.shifts, actor.supplier.id);
    const filtered = branchId ? list.filter((s: any) => s.branch_id === branchId) : list;
    filtered.sort((a: any, b: any) => new Date(b.opened_at || 0).getTime() - new Date(a.opened_at || 0).getTime());
    return res.json({ success: true, shifts: filtered.map(mapShift) });
  });

  app.post('/api/supplier/erp/shifts/open', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client, actorName, staff } = actor;
    const branchId = String(req.body?.branchId || '');
    if (!branchId) return res.status(400).json({ error: 'تحديد الفرع مطلوب لفتح الوردية' });

    const existing = await loadSupplierTable(client, 'supplier_pos_shifts', FILES.shifts, supplier.id);
    const alreadyOpen = existing.find((s: any) => s.branch_id === branchId && s.status === 'open');
    if (alreadyOpen) {
      return res.json({ success: true, shift: mapShift(alreadyOpen), alreadyOpen: true });
    }

    const row = {
      id: crypto.randomUUID(),
      supplier_id: supplier.id,
      branch_id: branchId,
      staff_id: staff?.id || '',
      staff_name: actorName,
      opened_at: new Date().toISOString(),
      closed_at: null,
      closed_by_name: '',
      opening_cash: r2(req.body?.openingCash || 0),
      cash_total: 0,
      instapay_total: 0,
      wallet_total: 0,
      deferred_total: 0,
      orders_count: 0,
      status: 'open',
      settled_to_branch_at: null,
    };
    await upsertRow(client, 'supplier_pos_shifts', FILES.shifts, row);
    return res.json({ success: true, shift: mapShift(row) });
  });

  app.post('/api/supplier/erp/shifts/:id/close', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client, actorName } = actor;
    const shiftId = req.params.id;
    const shifts = await loadSupplierTable(client, 'supplier_pos_shifts', FILES.shifts, supplier.id);
    const target = shifts.find((s: any) => s.id === shiftId);
    if (!target) return res.status(404).json({ error: 'الوردية غير موجودة' });
    if (target.status === 'closed') return res.json({ success: true, shift: mapShift(target) });

    const nowIso = new Date().toISOString();
    const closedShift = {
      ...target,
      status: 'closed',
      closed_at: nowIso,
      closed_by_name: actorName,
      settled_to_branch_at: nowIso,
    };
    await upsertRow(client, 'supplier_pos_shifts', FILES.shifts, closedShift);

    // Move shift cash/instapay/wallet totals into Branch Treasury automatically
    const branchTreasuries = await loadSupplierTable(client, 'supplier_branch_treasuries', FILES.branchTreasuries, supplier.id);
    const existingBt = branchTreasuries.find((bt: any) => bt.branch_id === target.branch_id);
    const nextBt = {
      id: existingBt?.id || crypto.randomUUID(),
      supplier_id: supplier.id,
      branch_id: target.branch_id,
      cash_balance: r2(Number(existingBt?.cash_balance || 0) + Number(target.cash_total || 0)),
      instapay_balance: r2(Number(existingBt?.instapay_balance || 0) + Number(target.instapay_total || 0)),
      wallet_balance: r2(Number(existingBt?.wallet_balance || 0) + Number(target.wallet_total || 0)),
      updated_at: nowIso,
    };
    await upsertRow(client, 'supplier_branch_treasuries', FILES.branchTreasuries, nextBt);

    return res.json({ success: true, shift: mapShift(closedShift), branchTreasury: mapBranchTreasury(nextBt) });
  });

  app.get('/api/supplier/erp/pos-orders', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const branchId = String(req.query?.branchId || '');
    const list = await loadSupplierTable(actor.client, 'supplier_pos_orders', FILES.posOrders, actor.supplier.id);
    const filtered = branchId ? list.filter((o: any) => o.branch_id === branchId) : list;
    filtered.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return res.json({ success: true, orders: filtered.slice(0, 150).map(mapPosOrder) });
  });

  app.post('/api/supplier/erp/pos-orders', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client, actorName, staff } = actor;
    const b = req.body || {};
    const branchId = String(b.branchId || '');
    const items: any[] = Array.isArray(b.items) ? b.items : [];
    if (!branchId || items.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد الفرع وإضافة صنف واحد على الأقل للفاتورة' });
    }

    const nowIso = new Date().toISOString();
    const orderNumber = `POS-${Date.now().toString().slice(-6)}`;
    const allInv = await loadSupplierTable(client, 'supplier_branch_inventory', FILES.inventory, supplier.id);

    let subtotal = 0;
    const processedLines: any[] = [];

    for (const line of items) {
      const qty = r3(Math.max(0.001, Number(line.quantity || 0)));
      const unitPrice = r2(Math.max(0, Number(line.unitPrice || 0)));
      const lineTotal = r2(qty * unitPrice);
      subtotal += lineTotal;

      const inv = allInv.find((i: any) => i.id === line.inventoryId || (i.branch_id === branchId && i.item_id === line.itemId));
      if (inv) {
        const nextQty = r3(Math.max(0, Number(inv.quantity || 0) - qty));
        await upsertRow(client, 'supplier_branch_inventory', FILES.inventory, {
          ...inv,
          quantity: nextQty,
          updated_at: nowIso,
        });
        await upsertRow(client, 'supplier_stock_movements', FILES.movements, {
          id: crypto.randomUUID(),
          supplier_id: supplier.id,
          branch_id: branchId,
          to_branch_id: null,
          item_id: inv.item_id,
          sku_code: inv.sku_code,
          item_name: inv.item_name,
          movement_type: 'pos_sale',
          qty_delta: -qty,
          balance_after: nextQty,
          unit_label: inv.sale_unit,
          unit_cost: inv.avg_cost,
          reference_no: orderNumber,
          actor_staff_id: staff?.id || '',
          actor_name: actorName,
          notes: b.salesChannel === 'online' ? 'بيع أونلاين وتوصيل' : 'بيع كاشير فرع',
          created_at: nowIso,
        });
      }

      processedLines.push({
        inventoryId: inv?.id || line.inventoryId || '',
        itemId: inv?.item_id || line.itemId || '',
        skuCode: inv?.sku_code || line.skuCode || '',
        itemName: inv?.item_name || line.itemName || 'صنف',
        saleUnit: inv?.sale_unit || line.saleUnit || 'كيلو',
        quantity: qty,
        unitPrice,
        unitCost: Number(inv?.avg_cost || line.unitCost || 0),
        lineTotal,
      });
    }

    subtotal = r2(subtotal);
    const discount = r2(Math.max(0, Number(b.discount || 0)));
    const shippingFee = b.salesChannel === 'online' ? r2(Math.max(0, Number(b.shippingFee || 0))) : 0;
    const finalTotal = r2(Math.max(0, subtotal - discount + shippingFee));

    const paymentMethod = (b.paymentMethod || 'cash') as 'cash' | 'instapay' | 'wallet' | 'credit';
    const paidAmount =
      paymentMethod === 'credit'
        ? 0
        : r2(Math.min(finalTotal, Math.max(0, Number(b.paidAmount ?? finalTotal))));
    const remainingAmount = r2(Math.max(0, finalTotal - paidAmount));
    const paymentStatus = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'credit';

    // Customer lookup/upsert + Walkin vs Online channel counter
    let customerId = String(b.customerId || '');
    const customerName = String(b.customerName || 'عميل نقدي').trim();
    const customerPhone = String(b.customerPhone || '').trim();
    if (customerPhone || (customerName && customerName !== 'عميل نقدي')) {
      const custs = await loadSupplierTable(client, 'supplier_customers', FILES.customers, supplier.id);
      const found = custs.find(
        (c: any) =>
          (customerId && c.id === customerId) ||
          (customerPhone && String(c.phone || '').trim() === customerPhone)
      );
      const isOnline = b.salesChannel === 'online';
      if (found) {
        customerId = found.id;
        await upsertRow(client, 'supplier_customers', FILES.customers, {
          ...found,
          name: customerName || found.name,
          phone: customerPhone || found.phone,
          governorate: b.deliveryGovernororate || found.governorate || '',
          last_address: b.deliveryAddress || found.last_address || '',
          total_purchases: r2(Number(found.total_purchases || 0) + finalTotal),
          balance_due: r2(Number(found.balance_due || 0) + remainingAmount),
          walkin_orders_count: Number(found.walkin_orders_count || 0) + (isOnline ? 0 : 1),
          online_orders_count: Number(found.online_orders_count || 0) + (isOnline ? 1 : 0),
          updated_at: nowIso,
        });
      } else {
        customerId = crypto.randomUUID();
        await upsertRow(client, 'supplier_customers', FILES.customers, {
          id: customerId,
          supplier_id: supplier.id,
          name: customerName,
          phone: customerPhone,
          country: supplier.country || 'مصر',
          governorate: b.deliveryGovernororate || '',
          last_address: b.deliveryAddress || '',
          source_type: 'external',
          total_purchases: finalTotal,
          balance_due: remainingAmount,
          walkin_orders_count: isOnline ? 0 : 1,
          online_orders_count: isOnline ? 1 : 0,
          notes: '',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    // Update active shift or create one automatically if needed
    const shifts = await loadSupplierTable(client, 'supplier_pos_shifts', FILES.shifts, supplier.id);
    let activeShift = shifts.find((s: any) => (b.shiftId ? s.id === b.shiftId : s.branch_id === branchId && s.status === 'open'));
    if (!activeShift) {
      activeShift = {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        branch_id: branchId,
        staff_id: staff?.id || '',
        staff_name: actorName,
        opened_at: nowIso,
        closed_at: null,
        closed_by_name: '',
        opening_cash: 0,
        cash_total: 0,
        instapay_total: 0,
        wallet_total: 0,
        deferred_total: 0,
        orders_count: 0,
        status: 'open',
      };
    }

    const updatedShift = {
      ...activeShift,
      cash_total: r2(Number(activeShift.cash_total || 0) + (paymentMethod === 'cash' ? paidAmount : 0)),
      instapay_total: r2(Number(activeShift.instapay_total || 0) + (paymentMethod === 'instapay' ? paidAmount : 0)),
      wallet_total: r2(Number(activeShift.wallet_total || 0) + (paymentMethod === 'wallet' ? paidAmount : 0)),
      deferred_total: r2(Number(activeShift.deferred_total || 0) + remainingAmount),
      orders_count: Number(activeShift.orders_count || 0) + 1,
    };
    await upsertRow(client, 'supplier_pos_shifts', FILES.shifts, updatedShift);

    const orderRow = {
      id: crypto.randomUUID(),
      order_number: orderNumber,
      supplier_id: supplier.id,
      branch_id: branchId,
      shift_id: updatedShift.id,
      staff_id: staff?.id || '',
      staff_name: actorName,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      sales_channel: b.salesChannel === 'online' ? 'online' : 'branch_walkin',
      delivery_governorate: String(b.deliveryGovernororate || ''),
      delivery_address: String(b.deliveryAddress || ''),
      shipping_fee: shippingFee,
      items: processedLines,
      subtotal,
      discount,
      final_total: finalTotal,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      notes: String(b.notes || ''),
      created_at: nowIso,
    };
    await upsertRow(client, 'supplier_pos_orders', FILES.posOrders, orderRow);

    return res.json({ success: true, order: mapPosOrder(orderRow), shift: mapShift(updatedShift) });
  });

  // Transfer Branch Treasury -> Owner Main Treasury (Pending Confirmation)
  app.post('/api/supplier/erp/treasury-transfers', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const { supplier, client, actorName } = actor;
    const branchId = String(req.body?.branchId || '');
    if (!branchId) return res.status(400).json({ error: 'تحديد الفرع مطلوب' });

    const [branches, branchTreasuries] = await Promise.all([
      loadSupplierTable(client, 'supplier_branches', FILES.branches, supplier.id),
      loadSupplierTable(client, 'supplier_branch_treasuries', FILES.branchTreasuries, supplier.id),
    ]);
    const branch = branches.find((br: any) => br.id === branchId);
    const bt = branchTreasuries.find((t: any) => t.branch_id === branchId);

    const cashAmount = r2(Math.min(Number(bt?.cash_balance || 0), Math.max(0, Number(req.body?.cashAmount ?? bt?.cash_balance ?? 0))));
    const instapayAmount = r2(Math.min(Number(bt?.instapay_balance || 0), Math.max(0, Number(req.body?.instapayAmount ?? bt?.instapay_balance ?? 0))));
    const walletAmount = r2(Math.min(Number(bt?.wallet_balance || 0), Math.max(0, Number(req.body?.walletAmount ?? bt?.wallet_balance ?? 0))));
    const totalAmount = r2(cashAmount + instapayAmount + walletAmount);

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'لا يوجد رصيد متاح في خزينة الفرع للتوريد الآن (أغلق الوردية المفتوحة أولاً إن وجدت)' });
    }

    const nowIso = new Date().toISOString();
    const transferRow = {
      id: crypto.randomUUID(),
      supplier_id: supplier.id,
      branch_id: branchId,
      branch_name: branch?.name || 'الفرع',
      shift_id: null,
      sent_by_name: actorName,
      cash_amount: cashAmount,
      instapay_amount: instapayAmount,
      wallet_amount: walletAmount,
      total_amount: totalAmount,
      status: 'pending_owner_confirmation',
      confirmed_by: '',
      confirmed_at: null,
      notes: String(req.body?.notes || 'تقفيل وتوريد نهاية اليوم للخزينة الرئيسية'),
      created_at: nowIso,
    };
    await upsertRow(client, 'supplier_treasury_transfers', FILES.treasuryTransfers, transferRow);

    if (bt) {
      await upsertRow(client, 'supplier_branch_treasuries', FILES.branchTreasuries, {
        ...bt,
        cash_balance: r2(Number(bt.cash_balance) - cashAmount),
        instapay_balance: r2(Number(bt.instapay_balance) - instapayAmount),
        wallet_balance: r2(Number(bt.wallet_balance) - walletAmount),
        updated_at: nowIso,
      });
    }

    return res.json({ success: true, transfer: mapTreasuryTransfer(transferRow) });
  });

  app.patch('/api/supplier/erp/treasury-transfers/:id/confirm', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor || !actor.isOwner) {
      if (actor) res.status(403).json({ error: 'تأكيد استلام الأموال متاح لمالك النشاط فقط' });
      return;
    }
    const { supplier, client, actorName } = actor;
    const id = req.params.id;
    const approve = req.body?.approve !== false;

    const transfers = await loadSupplierTable(client, 'supplier_treasury_transfers', FILES.treasuryTransfers, supplier.id);
    const tr = transfers.find((t: any) => t.id === id);
    if (!tr) return res.status(404).json({ error: 'طلب التوريد غير موجود' });
    if (tr.status !== 'pending_owner_confirmation') {
      return res.json({ success: true, transfer: mapTreasuryTransfer(tr) });
    }

    const nowIso = new Date().toISOString();
    if (!approve) {
      // Return funds back to Branch Treasury if rejected
      const bts = await loadSupplierTable(client, 'supplier_branch_treasuries', FILES.branchTreasuries, supplier.id);
      const bt = bts.find((x: any) => x.branch_id === tr.branch_id);
      if (bt) {
        await upsertRow(client, 'supplier_branch_treasuries', FILES.branchTreasuries, {
          ...bt,
          cash_balance: r2(Number(bt.cash_balance) + Number(tr.cash_amount || 0)),
          instapay_balance: r2(Number(bt.instapay_balance) + Number(tr.instapay_amount || 0)),
          wallet_balance: r2(Number(bt.wallet_balance) + Number(tr.wallet_amount || 0)),
          updated_at: nowIso,
        });
      }
      const rejected = { ...tr, status: 'rejected', confirmed_by: actorName, confirmed_at: nowIso };
      await upsertRow(client, 'supplier_treasury_transfers', FILES.treasuryTransfers, rejected);
      return res.json({ success: true, transfer: mapTreasuryTransfer(rejected) });
    }

    // Confirmed: Credit Owner Main Treasuries per channel or main treasury
    const treasuries = await loadSupplierTable(client, 'supplier_treasuries', FILES.treasuries, supplier.id);
    let mainCash = treasuries.find((x: any) => x.channel_type === 'cash') || treasuries[0];
    if (!mainCash) {
      mainCash = {
        id: crypto.randomUUID(),
        supplier_id: supplier.id,
        name: 'الخزينة الرئيسية للمالك',
        channel_type: 'cash',
        balance: 0,
        currency: supplier.currency || 'EGP',
        created_at: nowIso,
      };
    }

    await upsertRow(client, 'supplier_treasuries', FILES.treasuries, {
      ...mainCash,
      balance: r2(Number(mainCash.balance || 0) + Number(tr.total_amount || 0)),
      updated_at: nowIso,
    });

    await upsertRow(client, 'supplier_treasury_transactions', FILES.transactions, {
      id: crypto.randomUUID(),
      supplier_id: supplier.id,
      treasury_id: mainCash.id,
      tx_type: 'deposit',
      amount: Number(tr.total_amount || 0),
      description: `تأكيد استلام توريد (${tr.branch_name}): كاش ${tr.cash_amount} + إنستا باي ${tr.instapay_amount} + محفظة ${tr.wallet_amount} — المرسِل: ${tr.sent_by_name}`,
      created_at: nowIso,
    });

    const confirmed = { ...tr, status: 'confirmed', confirmed_by: actorName, confirmed_at: nowIso };
    await upsertRow(client, 'supplier_treasury_transfers', FILES.treasuryTransfers, confirmed);
    return res.json({ success: true, transfer: mapTreasuryTransfer(confirmed) });
  });

  // =========================================================================
  // 6. HR, STAFF CREDENTIALS & TERMINAL DEVICE KIOSK LOCK (WITH IP BINDING)
  // =========================================================================
  app.get('/api/supplier/erp/staff', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const [staff, logs] = await Promise.all([
      loadSupplierTable(actor.client, 'supplier_staff_users', FILES.staff, actor.supplier.id),
      loadSupplierTable(actor.client, 'supplier_hr_logs', FILES.hrLogs, actor.supplier.id),
    ]);
    return res.json({
      success: true,
      staff: staff.map(mapStaffUser),
      hrLogs: logs.map(mapHrLog),
    });
  });

  app.post('/api/supplier/erp/staff', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor || !actor.isOwner) {
      if (actor) res.status(403).json({ error: 'إضافة وتعديل الموظفين متاحة لمالك النشاط فقط' });
      return;
    }
    const b = req.body || {};
    const fullName = String(b.fullName || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    if (!fullName || !username) {
      return res.status(400).json({ error: 'الاسم الكامل واسم الدخول مطلوبان' });
    }
    const existingList = await loadSupplierTable(actor.client, 'supplier_staff_users', FILES.staff, actor.supplier.id);
    const existing = b.id ? existingList.find((x: any) => x.id === b.id) : null;
    if (!existing && existingList.some((x: any) => x.username.toLowerCase() === username)) {
      return res.status(409).json({ error: 'اسم المستخدم مسجل لموظف آخر بالفعل' });
    }

    const nowIso = new Date().toISOString();
    const passwordHash =
      b.password && String(b.password).trim()
        ? hashStaffPassword(String(b.password).trim())
        : existing?.password_hash || hashStaffPassword('123456');

    const row = {
      id: existing?.id || crypto.randomUUID(),
      supplier_id: actor.supplier.id,
      branch_id: b.branchId || existing?.branch_id || null,
      full_name: fullName,
      username,
      password_hash: passwordHash,
      role: b.role || existing?.role || 'cashier',
      job_title: String(b.jobTitle || existing?.job_title || ''),
      phone: String(b.phone || existing?.phone || ''),
      base_salary: r2(b.baseSalary ?? existing?.base_salary ?? 0),
      is_active: b.isActive !== undefined ? Boolean(b.isActive) : true,
      device_lock_token: existing?.device_lock_token || '',
      device_ip: existing?.device_ip || '',
      last_login_at: existing?.last_login_at || null,
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso,
    };

    await upsertRow(actor.client, 'supplier_staff_users', FILES.staff, row);
    return res.json({ success: true, staff: mapStaffUser(row) });
  });

  app.post('/api/supplier/erp/hr-logs', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor) return;
    const b = req.body || {};
    if (!b.staffId || !b.logType) {
      return res.status(400).json({ error: 'بيانات سجل الموظف ونوع الحركة مطلوبة' });
    }
    const nowIso = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      supplier_id: actor.supplier.id,
      staff_id: b.staffId,
      branch_id: b.branchId || null,
      log_type: b.logType,
      amount: r2(b.amount || 0),
      notes: String(b.notes || ''),
      actor_name: actor.actorName,
      event_time: b.eventTime || nowIso,
      created_at: nowIso,
    };
    await upsertRow(actor.client, 'supplier_hr_logs', FILES.hrLogs, row);
    return res.json({ success: true, hrLog: mapHrLog(row) });
  });

  // Public / Kiosk Staff Login (works inside Locked Branch Terminal without Owner Gmail!)
  app.post('/api/supplier/erp/staff-login', async (req: Request, res: Response) => {
    const { supplierId, branchId, username, password, deviceToken } = req.body || {};
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    if (!supplierId || !cleanUser || !cleanPass) {
      return res.status(400).json({ error: 'بيانات الدخول غير مكتملة' });
    }

    const staffList = readArr(FILES.staff).filter((s: any) => s.supplier_id === supplierId);
    let target = staffList.find((s: any) => String(s.username || '').toLowerCase() === cleanUser);
    if (!target) {
      try {
        const { data } = await supabaseAdminClient
          .from('supplier_staff_users')
          .select('*')
          .eq('supplier_id', supplierId)
          .ilike('username', cleanUser)
          .maybeSingle();
        if (data) target = data;
      } catch {}
    }

    if (!target || target.is_active === false) {
      return res.status(401).json({ error: 'اسم المستخدم غير صحيح أو الحساب معطل' });
    }
    if (target.password_hash !== hashStaffPassword(cleanPass)) {
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }
    if (branchId && target.branch_id && target.branch_id !== branchId && target.role !== 'branch_manager') {
      return res.status(403).json({ error: 'هذا الموظف غير مصرح له بالدخول على شاشة هذا الفرع' });
    }

    const nowIso = new Date().toISOString();
    const clientIp = extractClientIp(req);
    const token = signStaffToken({
      staffId: target.id,
      supplierId,
      branchId: branchId || target.branch_id || '',
      role: target.role,
      fullName: target.full_name,
    });

    await upsertRow(supabaseAdminClient, 'supplier_staff_users', FILES.staff, {
      ...target,
      last_login_at: nowIso,
      device_ip: clientIp || target.device_ip,
      device_lock_token: deviceToken || target.device_lock_token,
      updated_at: nowIso,
    });

    // Automatically log attendance check-in
    await upsertRow(supabaseAdminClient, 'supplier_hr_logs', FILES.hrLogs, {
      id: crypto.randomUUID(),
      supplier_id: supplierId,
      staff_id: target.id,
      branch_id: branchId || target.branch_id || null,
      log_type: 'attendance_in',
      amount: 0,
      notes: `دخول تلقائي عبر جهاز الفرع (${clientIp || 'local'})`,
      actor_name: target.full_name,
      event_time: nowIso,
      created_at: nowIso,
    });

    return res.json({
      success: true,
      staffToken: token,
      staff: mapStaffUser(target),
      clientIp,
    });
  });

  app.post('/api/supplier/erp/device-bind', async (req: Request, res: Response) => {
    const actor = await resolveErpActor(req, res);
    if (!actor || !actor.isOwner) {
      if (actor) res.status(403).json({ error: 'تثبيت الأجهزة متاح لمالك النشاط فقط' });
      return;
    }
    const clientIp = extractClientIp(req);
    const deviceToken = `DEV-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    return res.json({
      success: true,
      deviceToken,
      boundIp: clientIp,
      lockedAt: new Date().toISOString(),
    });
  });

  app.post('/api/supplier/erp/device-unlock', async (req: Request, res: Response) => {
    const { supplierId, ownerPin } = req.body || {};
    if (!supplierId || !ownerPin) {
      return res.status(400).json({ error: 'الرقم السري للمالك مطلوب لفك تثبيت الجهاز' });
    }
    const localSups = readArr(FILES.suppliers);
    let sup = localSups.find((s: any) => s.id === supplierId);
    if (!sup) {
      try {
        const { data } = await supabaseAdminClient
          .from('platform_suppliers')
          .select('*')
          .eq('id', supplierId)
          .maybeSingle();
        if (data) sup = data;
      } catch {}
    }
    const expectedPin = String(sup?.owner_unlock_pin || '1234');
    if (String(ownerPin).trim() !== expectedPin) {
      return res.status(403).json({ error: 'الرقم السري غير صحيح! تواصل مع مالك النشاط.' });
    }
    return res.json({ success: true });
  });
}

function roundUpPrice(n: number): number {
  return Math.ceil((Number(n) || 0) * 100) / 100;
}

function mapBranch(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    name: r.name,
    code: r.code,
    branchType: r.branch_type || 'shop',
    governorate: r.governorate || '',
    address: r.address || '',
    phone: r.phone || '',
    posEnabled: Boolean(r.pos_enabled ?? true),
    isActive: Boolean(r.is_active ?? true),
    status: r.status || 'active',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapInventoryItem(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    branchId: r.branch_id,
    itemId: r.item_id,
    skuCode: r.sku_code,
    itemName: r.item_name,
    categoryId: r.category_id || '',
    subCategoryId: r.sub_category_id || '',
    purchaseUnit: r.purchase_unit || 'طرد',
    saleUnit: r.sale_unit || 'كيلو',
    conversionFactor: r3(r.conversion_factor ?? 1),
    quantity: r3(r.quantity ?? 0),
    minAlert: r3(r.min_alert ?? 5),
    avgCost: r2(r.avg_cost ?? 0),
    retailPrice: r2(r.retail_price ?? 0),
    wholesalePrice: r2(r.wholesale_price ?? 0),
    updatedAt: r.updated_at,
  };
}

function mapMovement(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    branchId: r.branch_id,
    toBranchId: r.to_branch_id || null,
    itemId: r.item_id,
    skuCode: r.sku_code || '',
    itemName: r.item_name,
    movementType: r.movement_type,
    qtyDelta: r3(r.qty_delta ?? 0),
    balanceAfter: r3(r.balance_after ?? 0),
    unitLabel: r.unit_label || 'كيلو',
    unitCost: r2(r.unit_cost ?? 0),
    referenceNo: r.reference_no || '',
    actorStaffId: r.actor_staff_id || '',
    actorName: r.actor_name || 'المالك',
    notes: r.notes || '',
    createdAt: r.created_at,
  };
}

function mapBranchTreasury(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    branchId: r.branch_id,
    cashBalance: r2(r.cash_balance ?? 0),
    instapayBalance: r2(r.instapay_balance ?? 0),
    walletBalance: r2(r.wallet_balance ?? 0),
    updatedAt: r.updated_at,
  };
}

function mapTreasuryTransfer(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    branchId: r.branch_id,
    branchName: r.branch_name || '',
    shiftId: r.shift_id || null,
    sentByName: r.sent_by_name || '',
    cashAmount: r2(r.cash_amount ?? 0),
    instapayAmount: r2(r.instapay_amount ?? 0),
    walletAmount: r2(r.wallet_amount ?? 0),
    totalAmount: r2(r.total_amount ?? 0),
    status: r.status || 'pending_owner_confirmation',
    confirmedBy: r.confirmed_by || '',
    confirmedAt: r.confirmed_at || null,
    notes: r.notes || '',
    createdAt: r.created_at,
  };
}

function mapShift(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    branchId: r.branch_id,
    staffId: r.staff_id || '',
    staffName: r.staff_name || '',
    openedAt: r.opened_at,
    closedAt: r.closed_at || null,
    closedByName: r.closed_by_name || '',
    openingCash: r2(r.opening_cash ?? 0),
    cashTotal: r2(r.cash_total ?? 0),
    instapayTotal: r2(r.instapay_total ?? 0),
    walletTotal: r2(r.wallet_total ?? 0),
    deferredTotal: r2(r.deferred_total ?? 0),
    ordersCount: Number(r.orders_count || 0),
    status: r.status || 'open',
    settledToBranchAt: r.settled_to_branch_at || null,
  };
}

function mapPosOrder(r: any) {
  return {
    id: r.id,
    orderNumber: r.order_number,
    supplierId: r.supplier_id,
    branchId: r.branch_id,
    shiftId: r.shift_id || null,
    staffId: r.staff_id || '',
    staffName: r.staff_name || '',
    customerId: r.customer_id || '',
    customerName: r.customer_name || 'عميل نقدي',
    customerPhone: r.customer_phone || '',
    salesChannel: r.sales_channel || 'branch_walkin',
    deliveryGovernorate: r.delivery_governorate || '',
    deliveryAddress: r.delivery_address || '',
    shippingFee: r2(r.shipping_fee ?? 0),
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: r2(r.subtotal ?? 0),
    discount: r2(r.discount ?? 0),
    finalTotal: r2(r.final_total ?? 0),
    paidAmount: r2(r.paid_amount ?? 0),
    remainingAmount: r2(r.remaining_amount ?? 0),
    paymentMethod: r.payment_method || 'cash',
    paymentStatus: r.payment_status || 'paid',
    notes: r.notes || '',
    createdAt: r.created_at,
  };
}

function mapVendor(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    name: r.name,
    phone: r.phone || '',
    vendorType: r.vendor_type || 'مصنع خامات',
    address: r.address || '',
    balanceOwed: r2(r.balance_owed ?? 0),
    notes: r.notes || '',
    createdAt: r.created_at,
  };
}

function mapPurchase(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    branchId: r.branch_id,
    vendorId: r.vendor_id || null,
    vendorName: r.vendor_name || '',
    invoiceNo: r.invoice_no,
    items: Array.isArray(r.items) ? r.items : [],
    totalAmount: r2(r.total_amount ?? 0),
    paidAmount: r2(r.paid_amount ?? 0),
    remainingAmount: r2(r.remaining_amount ?? 0),
    treasuryChannel: r.treasury_channel || 'cash',
    actorName: r.actor_name || '',
    notes: r.notes || '',
    createdAt: r.created_at,
  };
}

function mapStaffUser(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    branchId: r.branch_id || null,
    fullName: r.full_name,
    username: r.username,
    role: r.role || 'cashier',
    jobTitle: r.job_title || '',
    phone: r.phone || '',
    baseSalary: r2(r.base_salary ?? 0),
    isActive: r.is_active !== false,
    deviceLockToken: r.device_lock_token || '',
    deviceIp: r.device_ip || '',
    lastLoginAt: r.last_login_at || null,
    createdAt: r.created_at,
  };
}

function mapHrLog(r: any) {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    staffId: r.staff_id,
    branchId: r.branch_id || null,
    logType: r.log_type,
    amount: r2(r.amount ?? 0),
    notes: r.notes || '',
    actorName: r.actor_name || '',
    eventTime: r.event_time,
    createdAt: r.created_at,
  };
}
