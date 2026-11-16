import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * أدوات قاعدة بيانات الورشة والمورد لمساعدة البيانات "شموسة" (Function Calling)
 * -------------------------------------------------------------
 * - قراءة الأرقام والبيانات الحقيقية فقط من Supabase وملفات التكامل المحلية.
 * - عزل تام (Strict Tenant Isolation) بين الورش (workshop_id) وبين الموردين (supplier_id).
 */

const MAX_ROWS = 1000;
const MAX_RESULTS = 20;
const HIDE_COSTS = process.env.FALCON_HIDE_COSTS === 'true';

function readLocalJsonArray<T = any>(filename: string): T[] {
  try {
    const fp = path.join(process.cwd(), 'data', filename);
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeArabic(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(haystack: string, query?: string): boolean {
  if (!query || !query.trim()) return true;
  const h = normalizeArabic(haystack);
  const tokens = normalizeArabic(query)
    .split(' ')
    .map((t) => t.replace(/^(ال|مع|في|عن|لي|هل)/, ''))
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return true;
  return tokens.every((t) => h.includes(t));
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const workshopToolSchemas: ToolSchema[] = [
  {
    name: 'search_materials',
    description: 'يبحث في خامات الورشة أو مخزون فروع المورد ويرجع الكميات المتبقية والأسعار والنواقص.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الخامة أو الكود SKU أو اسم الفرع أو اتركها فارغة' },
        kind: { type: 'string', enum: ['primary', 'extra', 'any'] },
      },
    },
  },
  {
    name: 'search_products',
    description: 'يبحث في منتجات الورشة أو أصناف كتالوج المورد بالاسم أو الكود أو التصنيف أو السعر.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم المنتج أو كوده' },
        category: { type: 'string' },
      },
    },
  },
  {
    name: 'get_product_details',
    description: 'يرجع تفاصيل منتج محدد بالأبعاد والأسعار والمكونات.',
    parameters: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
    },
  },
  {
    name: 'search_customers',
    description: 'يبحث في بيانات العملاء، أرقام هواتفهم، والديون والآجل المستحق عليهم (لينا بره كام).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'اسم العميل أو هاتفه' } },
    },
  },
  {
    name: 'search_suppliers',
    description: 'يبحث في الموردين والمصانع والمبالغ المستحقة لهم (علينا كام للمصانع) وأرقام هواتفهم.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'اسم المورد أو المصنع أو تخصصه' } },
    },
  },
  {
    name: 'search_employees',
    description: 'يبحث في العاملين والموظفين بالورشة أو فروع المورد ورواتبهم ومستحقاتهم.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'اسم الموظف أو وظيفته أو فرعه' } },
    },
  },
  {
    name: 'search_orders',
    description: 'يبحث في الطلبات وأوردرات البيع وفواتير الكاشير POS، المدفوع، والمتبقي.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم العميل، الصنف، أو رقم الفاتورة' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'search_treasuries',
    description: 'يعرض أرصدة الخزائن والعهد النقدية وخزينة المالك وخزائن الفروع والتوريدات المعلقة بدقة.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الخزنة أو الفرع أو المسئول، أو اتركها فارغة لعرض الكل' },
      },
    },
  },
  {
    name: 'search_transactions',
    description: 'يبحث في المصروفات والتحويلات وصرف العهد وتوريدات الفروع وفواتير الشراء.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'بيان الحركة أو الشخص' },
        type: { type: 'string' },
      },
    },
  },
  {
    name: 'workshop_overview',
    description: 'ملخص مالي وتشغيلي فعلي شامل: إجمالي السيولة، لينا بره كام، علينا كام، المخزون، الفروع، وأوردرات اليوم.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_all_workshops',
    description: 'يستعرض قائمة بكافة الورش المسجلة على المنظومة وتفاصيلها وحالتها (متاح حصرياً للمشرف العام والباشمهندس حسام).',
    parameters: { type: 'object', properties: {} },
  },
];

export interface WorkshopToolContext {
  db: SupabaseClient;
  workshopId: string;
  isSuperAdmin?: boolean;
  accountRole?: 'artisan' | 'supplier';
  supplierId?: string;
}

export function scopeQuery(query: any, ctx: WorkshopToolContext, column: string = 'workshop_id') {
  if (ctx.isSuperAdmin && (!ctx.workshopId || ctx.workshopId === 'ALL_WORKSHOPS' || ctx.workshopId === 'all_workshops')) {
    return query;
  }
  const targetId = column === 'supplier_id' ? (ctx.supplierId || ctx.workshopId) : ctx.workshopId;
  if (!targetId || targetId === 'ALL_WORKSHOPS' || targetId === 'all_workshops') {
    // Fail-closed isolation: never accidentally drop the filter for non-superadmin accounts
    return query.eq(column, '00000000-0000-0000-0000-000000000000');
  }
  return query.eq(column, targetId);
}

type ToolResult = Record<string, unknown>;

async function loadSupplierScopedRows<T = any>(
  ctx: WorkshopToolContext,
  table: string,
  localFile: string,
  supplierIdCol: string = 'supplier_id'
): Promise<T[]> {
  const sid = ctx.supplierId || ctx.workshopId;
  if (!sid && !ctx.isSuperAdmin) return [];
  const merged: any[] = [];
  const seen = new Set<string>();

  try {
    let q = ctx.db.from(table).select('*').limit(MAX_ROWS);
    if (!ctx.isSuperAdmin || (sid && sid !== 'ALL_WORKSHOPS' && sid !== 'all_workshops')) {
      q = q.eq(supplierIdCol, sid);
    }
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        merged.push(row);
        if (row.id) seen.add(String(row.id));
      }
    }
  } catch {}

  const localRows = readLocalJsonArray<any>(localFile);
  for (const r of localRows) {
    const rSid = r.supplier_id || r.supplierId || r.id;
    if (ctx.isSuperAdmin || String(rSid) === String(sid)) {
      if (!r.id || !seen.has(String(r.id))) {
        merged.push(r);
        if (r.id) seen.add(String(r.id));
      }
    }
  }
  return merged;
}

// =========================================================================
// 1. MATERIALS / BRANCH INVENTORY
// =========================================================================
async function searchMaterials(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const [branches, invRows, catRows] = await Promise.all([
      loadSupplierScopedRows(ctx, 'supplier_branches', 'supplier_branches.json'),
      loadSupplierScopedRows(ctx, 'supplier_branch_inventory', 'supplier_branch_inventory.json'),
      loadSupplierScopedRows(ctx, 'supplier_catalog_items', 'supplier_catalog_items.json'),
    ]);
    const branchMap = new Map(branches.map((b: any) => [b.id, b.name]));
    const mappedInv = invRows.map((it: any) => {
      const qty = Number(it.quantity ?? it.stock_qty ?? 0);
      const minA = Number(it.min_alert ?? it.minAlert ?? 5);
      return {
        source: 'branch_warehouse',
        sku: it.sku_code || it.skuCode || null,
        name: it.item_name || it.itemName || 'صنف',
        branch: branchMap.get(it.branch_id || it.branchId) || 'الفرع',
        stock: qty,
        min_limit: minA,
        is_low: qty <= minA,
        sale_unit: it.sale_unit || it.saleUnit || 'وحدة',
        purchase_unit: it.purchase_unit || it.purchaseUnit || 'طرد',
        conversion_factor: Number(it.conversion_factor ?? it.conversionFactor ?? 1),
        retail_price: Number(it.retail_price ?? it.retailPrice ?? 0),
        wholesale_price: Number(it.wholesale_price ?? it.wholesalePrice ?? 0),
        avg_cost: HIDE_COSTS ? undefined : Number(it.avg_cost ?? it.avgCost ?? 0),
      };
    });
    const mappedCat = catRows.map((c: any) => ({
      source: 'supplier_catalog',
      sku: c.sku_code || null,
      name: c.name || 'خامة',
      branch: 'الكتالوج العام',
      stock: Number(c.stock_qty ?? c.stockQty ?? 0),
      min_limit: 5,
      is_low: Number(c.stock_qty ?? c.stockQty ?? 0) <= 5,
      sale_unit: c.unit || 'وحدة',
      retail_price: Number(c.retail_price ?? c.retailPrice ?? 0),
      wholesale_price: Number(c.wholesale_price ?? c.wholesalePrice ?? 0),
    }));
    const all = [...mappedInv, ...mappedCat].filter((m) =>
      matches(`${m.name} ${m.sku || ''} ${m.branch}`, args?.query)
    );
    return {
      total_found: all.length,
      materials: all.slice(0, MAX_RESULTS),
    };
  }

  let query = ctx.db
    .from('materials')
    .select('id, name, kind, supplier_id, unit_id, purchase_price, current_stock, min_limit, market_name');
  query = scopeQuery(query, ctx);
  let { data, error } = await query.limit(MAX_ROWS);
  if (error) {
    let fallbackQuery = ctx.db
      .from('materials')
      .select('id, name, kind, supplier_id, unit_id, purchase_price, market_name');
    fallbackQuery = scopeQuery(fallbackQuery, ctx);
    const fb = await fallbackQuery.limit(MAX_ROWS);
    data = fb.data as any;
    error = fb.error;
  }
  if (error) return { error: 'تعذر قراءة الخامات' };

  const kind = args?.kind && args.kind !== 'any' ? args.kind : null;
  const filtered = (data || [])
    .filter((m: any) => (kind ? m.kind === kind : true))
    .filter((m: any) => matches(`${m.name} ${m.market_name || ''}`, args?.query));

  const [unitsRes, suppliersRes] = await Promise.all([
    scopeQuery(ctx.db.from('units').select('id, name'), ctx),
    scopeQuery(ctx.db.from('suppliers').select('id, name'), ctx),
  ]);
  const unitName = new Map((unitsRes.data || []).map((u: any) => [u.id, u.name]));
  const supplierName = new Map((suppliersRes.data || []).map((s: any) => [s.id, s.name]));

  return {
    total_found: filtered.length,
    materials: filtered.slice(0, MAX_RESULTS).map((m: any) => ({
      name: m.name,
      kind: m.kind === 'primary' ? 'أساسية' : 'إضافية',
      stock: Number(m.current_stock ?? 0),
      min_limit: Number(m.min_limit ?? 0),
      is_low: Number(m.current_stock ?? 0) <= Number(m.min_limit ?? 0),
      unit: unitName.get(m.unit_id) || 'وحدة',
      purchase_price: HIDE_COSTS ? undefined : Number(m.purchase_price) || 0,
      supplier: supplierName.get(m.supplier_id) || null,
    })),
  };
}

// =========================================================================
// 2. PRODUCTS
// =========================================================================
async function loadProducts(ctx: WorkshopToolContext) {
  let query = ctx.db
    .from('products')
    .select('id, product_name, name, product_code, product_type, craft_name, cost_price, retail_price, wholesale_price, materials_used, specs, is_active, updated_at');
  query = scopeQuery(query, ctx);
  const res = await query
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(MAX_ROWS);

  if (!res.error) return res;

  let fallbackQuery = ctx.db
    .from('products')
    .select('id, name, product_type, main_section, cost_price, retail_price, wholesale_price, description, notes, data, updated_at');
  fallbackQuery = scopeQuery(fallbackQuery, ctx);
  const fbRes = await fallbackQuery.order('updated_at', { ascending: false }).limit(MAX_ROWS);
  if (fbRes.data) {
    fbRes.data = fbRes.data
      .filter((p: any) => p.data?.is_active !== false)
      .map((p: any) => ({
        ...p,
        product_name: p.product_name || p.name || p.data?.product_name || 'منتج',
        product_code: p.product_code || p.data?.product_code || null,
        is_active: p.data?.is_active ?? true,
      }));
  }
  return fbRes;
}

async function searchProducts(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    return await searchMaterials(ctx, args);
  }
  const { data, error } = await loadProducts(ctx);
  if (error) return { error: 'تعذر قراءة المنتجات' };

  const maxPrice = Number(args?.max_retail_price);
  const filtered = (data || []).filter((p: any) => {
    const pName = p.product_name || p.name || '';
    const pCategory = p.category || p.specs?.category || p.product_type || '';
    return (
      matches(`${pName} ${p.product_code || ''} ${pCategory}`, args?.query) &&
      (!maxPrice || Number(p.retail_price) <= maxPrice)
    );
  });

  return {
    total_found: filtered.length,
    products: filtered.slice(0, MAX_RESULTS).map((p: any) => ({
      id: p.id,
      name: p.product_name || p.name || 'منتج',
      code: p.product_code || null,
      retail_price: Number(p.retail_price) || 0,
      wholesale_price: Number(p.wholesale_price) || 0,
      cost_price: HIDE_COSTS ? undefined : Number(p.cost_price) || 0,
    })),
  };
}

async function getProductDetails(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    return { error: 'استخدم search_materials للبحث عن أصناف المخزن والكتالوج للمورد' };
  }
  const id = String(args?.product_id || '');
  if (!id) return { error: 'product_id مطلوب' };
  let query = ctx.db.from('products').select('*').eq('id', id);
  query = scopeQuery(query, ctx);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return { error: 'المنتج غير موجود' };
  const { workshop_id, ...rest } = data as any;
  if (HIDE_COSTS) delete rest.cost_price;
  return { product: rest };
}

// =========================================================================
// 3. CUSTOMERS (RECEIVABLES "لينا بره كام")
// =========================================================================
async function searchCustomers(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const rows = await loadSupplierScopedRows(ctx, 'supplier_customers', 'supplier_customers.json');
    const filtered = rows.filter((r: any) =>
      matches(`${r.name || ''} ${r.phone || ''} ${r.governorate || ''} ${r.last_address || r.lastAddress || ''}`, args?.query)
    );
    const totalReceivables = rows.reduce((s: number, r: any) => s + Number(r.balance_due ?? r.balanceDue ?? 0), 0);
    return {
      total_found: filtered.length,
      total_receivables_due: totalReceivables,
      customers: filtered.slice(0, MAX_RESULTS).map((r: any) => ({
        id: r.id,
        name: r.name || 'عميل',
        phone: r.phone || null,
        governorate: r.governorate || null,
        last_address: r.last_address || r.lastAddress || null,
        walkin_orders_count: Number(r.walkin_orders_count ?? r.walkinOrdersCount ?? 0),
        online_orders_count: Number(r.online_orders_count ?? r.onlineOrdersCount ?? 0),
        outstanding_balance: Number(r.balance_due ?? r.balanceDue ?? 0),
        total_purchases: Number(r.total_purchases ?? r.totalPurchases ?? 0),
      })),
    };
  }

  let query = ctx.db
    .from('customers')
    .select('id, name, full_name, phone, phone_number, city, address, outstanding_balance, total_purchases');
  query = scopeQuery(query, ctx);
  let { data, error } = await query.limit(MAX_ROWS);
  if (error) {
    let fbQuery = ctx.db.from('customers').select('id, name, phone, address, notes');
    fbQuery = scopeQuery(fbQuery, ctx);
    const fb = await fbQuery.limit(MAX_ROWS);
    data = fb.data as any;
    error = fb.error;
  }
  if (error) return { error: 'تعذر قراءة العملاء' };

  const filtered = (data || []).filter((row: any) =>
    matches(`${row.name || row.full_name || ''} ${row.phone || row.phone_number || ''}`, args?.query)
  );

  return {
    total_found: filtered.length,
    customers: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.name || row.full_name || 'عميل',
      phone: row.phone || row.phone_number || null,
      outstanding_balance: Number(row.outstanding_balance || 0),
      total_purchases: Number(row.total_purchases || 0),
    })),
  };
}

// =========================================================================
// 4. SUPPLIERS / EXTERNAL FACTORY VENDORS ("علينا كام للمصانع")
// =========================================================================
async function searchSuppliers(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const vendors = await loadSupplierScopedRows(ctx, 'supplier_vendors', 'supplier_vendors.json');
    const filtered = vendors.filter((v: any) =>
      matches(`${v.name || ''} ${v.phone || ''} ${v.vendor_type || v.vendorType || ''} ${v.address || ''}`, args?.query)
    );
    const totalPayables = vendors.reduce((s: number, v: any) => s + Number(v.balance_owed ?? v.balanceOwed ?? 0), 0);
    return {
      total_found: filtered.length,
      total_payables_to_factories: totalPayables,
      vendors: filtered.slice(0, MAX_RESULTS).map((v: any) => ({
        id: v.id,
        name: v.name || 'مصنع / مورد',
        phone: v.phone || null,
        type: v.vendor_type || v.vendorType || 'مصنع خامات',
        balance_owed: Number(v.balance_owed ?? v.balanceOwed ?? 0),
      })),
    };
  }

  let query = ctx.db
    .from('suppliers')
    .select('id, name, company_name, phone, phone_number, material_specialty, outstanding_balance');
  query = scopeQuery(query, ctx);
  let { data, error } = await query.limit(MAX_ROWS);
  if (error) {
    let fbQuery = ctx.db.from('suppliers').select('id, name, phone, address, notes');
    fbQuery = scopeQuery(fbQuery, ctx);
    const fb = await fbQuery.limit(MAX_ROWS);
    data = fb.data as any;
    error = fb.error;
  }
  if (error) return { error: 'تعذر قراءة الموردين' };

  const filtered = (data || []).filter((row: any) =>
    matches(`${row.name || ''} ${row.company_name || ''} ${row.phone || ''} ${row.material_specialty || ''} ${row.notes || ''}`, args?.query)
  );

  return {
    total_found: filtered.length,
    suppliers: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.name || row.company_name || 'مورد',
      phone: row.phone || row.phone_number || null,
      specialty: row.material_specialty || row.notes || null,
      outstanding_balance: Number(row.outstanding_balance || 0),
    })),
  };
}

// =========================================================================
// 5. EMPLOYEES / SUPPLIER STAFF HR
// =========================================================================
async function searchEmployees(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const [branches, staff, hrLogs] = await Promise.all([
      loadSupplierScopedRows(ctx, 'supplier_branches', 'supplier_branches.json'),
      loadSupplierScopedRows(ctx, 'supplier_staff_users', 'supplier_staff_users.json'),
      loadSupplierScopedRows(ctx, 'supplier_hr_logs', 'supplier_hr_logs.json'),
    ]);
    const branchMap = new Map(branches.map((b: any) => [b.id, b.name]));
    const filtered = staff.filter((st: any) =>
      matches(`${st.full_name || st.fullName || ''} ${st.role || ''} ${branchMap.get(st.branch_id || st.branchId) || ''}`, args?.query)
    );
    return {
      total_found: filtered.length,
      employees: filtered.slice(0, MAX_RESULTS).map((st: any) => {
        const myLogs = hrLogs.filter((l: any) => (l.staff_id || l.staffId) === st.id);
        const bonus = myLogs.filter((l: any) => (l.log_type || l.logType) === 'bonus').reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
        const penalty = myLogs.filter((l: any) => (l.log_type || l.logType) === 'penalty').reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
        const advance = myLogs.filter((l: any) => (l.log_type || l.logType) === 'advance').reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
        const base = Number(st.base_salary ?? st.baseSalary ?? 0);
        return {
          id: st.id,
          name: st.full_name || st.fullName,
          role: st.role || 'cashier',
          branch: branchMap.get(st.branch_id || st.branchId) || 'كل الفروع',
          base_salary: base,
          net_salary: base + bonus - penalty - advance,
          is_active: st.is_active !== false && st.isActive !== false,
        };
      }),
    };
  }

  let query = ctx.db
    .from('employees')
    .select('id, full_name, role, phone, phone_number, base_wage, current_balance, is_active');
  query = scopeQuery(query, ctx);
  const { data, error } = await query.limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الموظفين', employees: [], total_found: 0 };

  const filtered = (data || []).filter((row: any) => matches(`${row.full_name || ''} ${row.role || ''}`, args?.query));

  return {
    total_found: filtered.length,
    employees: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.full_name,
      role: row.role || null,
      base_wage: Number(row.base_wage || 0),
      current_balance: Number(row.current_balance || 0),
    })),
  };
}

// =========================================================================
// 6. ORDERS (WORKSHOP + SUPPLIER POS + B2B)
// =========================================================================
async function searchOrders(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const [posOrders, b2bOrders] = await Promise.all([
      loadSupplierScopedRows(ctx, 'supplier_pos_orders', 'supplier_pos_orders.json'),
      loadSupplierScopedRows(ctx, 'supplier_b2b_orders', 'supplier_b2b_orders.json'),
    ]);
    const combined: any[] = [];
    for (const o of posOrders) {
      combined.push({
        id: o.id,
        order_number: o.order_number || o.orderNumber,
        source: o.sales_channel === 'online' || o.salesChannel === 'online' ? 'POS أونلاين' : 'POS فرع مباشر',
        customer: o.customer_name || o.customerName || 'عميل نقدي',
        total: Number(o.final_total ?? o.finalTotal ?? 0),
        paid: Number(o.paid_amount ?? o.paidAmount ?? 0),
        remaining: Number(o.remaining_amount ?? o.remainingAmount ?? 0),
        payment_method: o.payment_method || o.paymentMethod,
        status: o.payment_status || o.paymentStatus || 'paid',
        created_at: o.created_at || o.createdAt,
      });
    }
    for (const o of b2bOrders) {
      combined.push({
        id: o.id,
        order_number: o.order_number || o.orderNumber,
        source: 'طلب توريد B2B / متجر',
        customer: o.external_buyer?.name || o.externalBuyer?.name || 'ورشة / عميل',
        total: Number(o.final_total ?? o.finalTotal ?? 0),
        paid: Number(o.paid_amount ?? o.paidAmount ?? 0),
        remaining: Math.max(0, Number(o.final_total ?? o.finalTotal ?? 0) - Number(o.paid_amount ?? o.paidAmount ?? 0)),
        status: o.status || 'new',
        created_at: o.created_at || o.createdAt,
      });
    }
    const statusFilter = String(args?.status || '').trim();
    const filtered = combined.filter((row) => {
      const mQ = matches(`${row.order_number || ''} ${row.customer || ''} ${row.source || ''} ${row.status || ''}`, args?.query);
      const mS = !statusFilter || row.status === statusFilter;
      return mQ && mS;
    });
    return {
      total_found: filtered.length,
      orders: filtered.slice(0, MAX_RESULTS),
    };
  }

  let ordersRows: any[] = [];
  let hadAnySuccess = false;

  try {
    let query = ctx.db
      .from('orders')
      .select('id, customer_name, product_name, final_total, total_amount, amount_paid, paid_amount, remaining_amount, status, delivery_date');
    query = scopeQuery(query, ctx);
    const { data, error } = await query.limit(MAX_ROWS);
    if (!error && Array.isArray(data)) {
      hadAnySuccess = true;
      ordersRows = data.map((row: any) => {
        const total = Number(row.final_total ?? row.total_amount ?? 0);
        const paid = Number(row.amount_paid ?? row.paid_amount ?? 0);
        return {
          id: row.id,
          customer: row.customer_name || null,
          product: row.product_name || null,
          status: row.status || null,
          total,
          paid,
          remaining: Math.max(0, Number(row.remaining_amount ?? (total - paid))),
          delivery_date: row.delivery_date || null,
        };
      });
    }
  } catch {}

  try {
    let mQuery = ctx.db
      .from('marketplace_orders')
      .select('id, order_number, customer_name, items, total_amount, deposit_paid, remaining_amount, status, created_at');
    mQuery = scopeQuery(mQuery, ctx);
    const { data: mData, error: mErr } = await mQuery.limit(MAX_ROWS);
    if (!mErr && Array.isArray(mData)) {
      hadAnySuccess = true;
      const existingIds = new Set(ordersRows.map((o) => o.id));
      for (const row of mData) {
        if (existingIds.has(row.id)) continue;
        const firstItemName = Array.isArray(row.items) && row.items.length > 0
          ? (row.items[0].productName || row.items[0].name || `${row.items.length} منتجات`)
          : row.order_number;
        const total = Number(row.total_amount ?? 0);
        const paid = Number(row.deposit_paid ?? 0);
        ordersRows.push({
          id: row.id,
          customer: row.customer_name || null,
          product: firstItemName || null,
          status: row.status || null,
          total,
          paid,
          remaining: Math.max(0, Number(row.remaining_amount ?? (total - paid))),
          delivery_date: null,
        });
      }
    }
  } catch {}

  if (!hadAnySuccess) return { error: 'تعذر قراءة الطلبات' };

  const status = String(args?.status || '').trim();
  const filtered = ordersRows.filter((row: any) => {
    const mQuery = matches(`${row.customer || ''} ${row.product || ''} ${row.status || ''}`, args?.query);
    const mStatus = !status || row.status === status;
    return mQuery && mStatus;
  });

  return {
    total_found: filtered.length,
    orders: filtered.slice(0, MAX_RESULTS),
  };
}

// =========================================================================
// 7. TREASURIES (WORKSHOP + SUPPLIER OWNER & BRANCH TREASURIES)
// =========================================================================
async function searchTreasuries(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const [ownerTreasuries, branchTreasuries, branches, transfers] = await Promise.all([
      loadSupplierScopedRows(ctx, 'supplier_treasuries', 'supplier_treasuries.json'),
      loadSupplierScopedRows(ctx, 'supplier_branch_treasuries', 'supplier_branch_treasuries.json'),
      loadSupplierScopedRows(ctx, 'supplier_branches', 'supplier_branches.json'),
      loadSupplierScopedRows(ctx, 'supplier_treasury_transfers', 'supplier_treasury_transfers.json'),
    ]);
    const branchMap = new Map(branches.map((b: any) => [b.id, b.name]));

    const mapped: any[] = [];
    for (const t of ownerTreasuries) {
      mapped.push({
        id: t.id,
        name: t.name || 'خزينة المالك الرئيسية',
        kind: 'خزينة المالك المعتمدة',
        holder: 'المالك',
        balance: Number(t.balance || 0),
        status: 'نشطة',
      });
    }
    for (const bt of branchTreasuries) {
      const cash = Number(bt.cash_balance ?? bt.cashBalance ?? 0);
      const insta = Number(bt.instapay_balance ?? bt.instapayBalance ?? 0);
      const wallet = Number(bt.wallet_balance ?? bt.walletBalance ?? 0);
      const bTotal = cash + insta + wallet;
      mapped.push({
        id: bt.id || bt.branch_id,
        name: `خزينة فرع: ${branchMap.get(bt.branch_id || bt.branchId) || 'الفرع'}`,
        kind: 'خزينة فرع (بانتظار التوريد)',
        holder: `كاش ${cash} | إنستاباي ${insta} | محفظة ${wallet}`,
        balance: bTotal,
        status: 'نشطة بالفرع',
      });
    }

    const filtered = args?.query && String(args.query).trim()
      ? mapped.filter((row) => matches(`${row.name} ${row.kind} ${row.holder || ''}`, args.query))
      : mapped;

    const totalLiquidity = filtered.reduce((s, r) => s + Number(r.balance || 0), 0);
    const pendingTransfers = transfers.filter((tr: any) => tr.status === 'pending_owner_confirmation');

    return {
      total_found: filtered.length,
      total_liquidity: totalLiquidity,
      pending_transfers_count: pendingTransfers.length,
      pending_transfers_amount: pendingTransfers.reduce((s: number, tr: any) => s + Number(tr.total_amount ?? tr.totalAmount ?? 0), 0),
      treasuries: filtered,
    };
  }

  let list: any[] = [];

  try {
    let q = ctx.db.from('treasury_balances').select('*');
    q = scopeQuery(q, ctx);
    const viewRes = await q;
    if (!viewRes.error && viewRes.data && viewRes.data.length > 0) {
      list = viewRes.data;
    }
  } catch {}

  if (list.length === 0) {
    try {
      let q = ctx.db
        .from('treasuries')
        .select('id, name, kind, status, holder_name, is_main');
      q = scopeQuery(q, ctx);
      const { data, error } = await q.limit(MAX_ROWS);

      if (!error && data && data.length > 0) {
        list = data;
      }
    } catch {}
  }

  const clientTreasury = (ctx as any).clientContext?.treasuryBalance;
  const clientTreasuriesDetail = (ctx as any).clientContext?.treasuriesDetail;

  if (list.length === 0 && Array.isArray(clientTreasuriesDetail) && clientTreasuriesDetail.length > 0) {
    list = clientTreasuriesDetail;
  }

  if (args?.query && String(args.query).trim()) {
    list = list.filter((row: any) =>
      matches(`${row.name || ''} ${row.kind || ''} ${row.holder_name || row.holder || ''} ${row.status || ''}`, args.query)
    );
  }

  let totalWorkshopLiquidity = 0;
  const treasuriesMapped = list.map((row: any) => {
    const rawVal = row.balance ?? row.current_balance ?? row.initial_balance ?? row.amount;
    const realBalance = rawVal !== null && rawVal !== undefined ? Number(rawVal) : 0;
    totalWorkshopLiquidity += realBalance;

    return {
      id: row.id,
      name: row.name || 'خزينة الورشة',
      kind: row.kind === 'custody' ? 'عهدة نقدية' : (row.kind || 'خزينة رئيسية'),
      holder: row.holder_name || row.holder || null,
      balance: realBalance,
      status: row.status || 'نشطة',
    };
  });

  if (treasuriesMapped.length === 0 && typeof clientTreasury === 'number') {
    totalWorkshopLiquidity = clientTreasury;
    treasuriesMapped.push({
      id: 'main_safe',
      name: 'الخزينة النقدية الرئيسية',
      kind: 'خزينة رئيسية',
      holder: null,
      balance: clientTreasury,
      status: 'نشطة',
    });
  }

  return {
    total_found: treasuriesMapped.length,
    total_liquidity: totalWorkshopLiquidity,
    treasuries: treasuriesMapped,
  };
}

// =========================================================================
// 8. TRANSACTIONS
// =========================================================================
async function searchTransactions(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const [transfers, purchases] = await Promise.all([
      loadSupplierScopedRows(ctx, 'supplier_treasury_transfers', 'supplier_treasury_transfers.json'),
      loadSupplierScopedRows(ctx, 'supplier_purchases', 'supplier_purchases.json'),
    ]);
    const tx: any[] = [
      ...transfers.map((tr: any) => ({
        id: tr.id,
        type: tr.status === 'confirmed' ? 'توريد فرع مؤكد' : 'توريد فرع معلق',
        amount: Number(tr.total_amount ?? tr.totalAmount ?? 0),
        note: `توريد من ${tr.branch_name || tr.branchName || 'فرع'} بواسطة ${tr.sent_by_name || tr.sentByName || 'موظف'}`,
        date: tr.created_at || tr.createdAt || null,
      })),
      ...purchases.map((p: any) => ({
        id: p.id,
        type: 'فاتورة شراء من مصنع',
        amount: Number(p.total_amount ?? p.totalAmount ?? 0),
        note: `${p.invoice_no || p.invoiceNo || ''} - ${p.vendor_name || p.vendorName || 'مصنع'} (مدفوع ${p.paid_amount ?? p.paidAmount ?? 0})`,
        date: p.created_at || p.createdAt || null,
      })),
    ];
    const filtered = tx.filter((row) => matches(`${row.type} ${row.note}`, args?.query));
    return {
      total_found: filtered.length,
      transactions: filtered.slice(0, MAX_RESULTS),
    };
  }

  const type = String(args?.type || '').trim();
  let data: any[] | null = null;
  let error: any = null;

  try {
    let query = ctx.db.from('treasury_transactions').select('*').order('occurred_at', { ascending: false }).limit(MAX_ROWS);
    query = scopeQuery(query, ctx);
    if (type) query = query.eq('kind', type);
    const res = await query;
    if (!res.error && res.data) data = res.data;
  } catch {}

  if (!data || data.length === 0) {
    try {
      let query = ctx.db.from('safe_transactions').select('*').limit(MAX_ROWS);
      query = scopeQuery(query, ctx);
      if (type) query = query.eq('type', type);
      const res = await query;
      if (!res.error && res.data) data = res.data;
      else error = res.error;
    } catch {}
  }

  if (error && !data) return { total_found: 0, transactions: [] };

  const filtered = (data || []).filter((row: any) =>
    matches(`${row.note || row.notes || ''} ${row.kind || row.type || ''} ${row.category || ''}`, args?.query)
  );

  return {
    total_found: filtered.length,
    transactions: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      type: row.kind || row.type || null,
      amount: Number(row.amount || 0),
      note: row.note || row.notes || null,
      date: row.occurred_at || row.date || null,
    })),
  };
}

// =========================================================================
// 9. OVERVIEW (WORKSHOP + SUPPLIER ERP MULTI-BRANCH)
// =========================================================================
async function workshopOverview(ctx: WorkshopToolContext): Promise<ToolResult> {
  if (ctx.accountRole === 'supplier') {
    const [branches, invRows, customers, vendors, staff, posOrders, ownerTreasuries, branchTreasuries, transfers] =
      await Promise.all([
        loadSupplierScopedRows(ctx, 'supplier_branches', 'supplier_branches.json'),
        loadSupplierScopedRows(ctx, 'supplier_branch_inventory', 'supplier_branch_inventory.json'),
        loadSupplierScopedRows(ctx, 'supplier_customers', 'supplier_customers.json'),
        loadSupplierScopedRows(ctx, 'supplier_vendors', 'supplier_vendors.json'),
        loadSupplierScopedRows(ctx, 'supplier_staff_users', 'supplier_staff_users.json'),
        loadSupplierScopedRows(ctx, 'supplier_pos_orders', 'supplier_pos_orders.json'),
        loadSupplierScopedRows(ctx, 'supplier_treasuries', 'supplier_treasuries.json'),
        loadSupplierScopedRows(ctx, 'supplier_branch_treasuries', 'supplier_branch_treasuries.json'),
        loadSupplierScopedRows(ctx, 'supplier_treasury_transfers', 'supplier_treasury_transfers.json'),
      ]);

    const ownerMainTotal = ownerTreasuries.reduce((s: number, t: any) => s + Number(t.balance || 0), 0);
    const branchTotal = branchTreasuries.reduce(
      (s: number, b: any) =>
        s + Number(b.cash_balance ?? b.cashBalance ?? 0) + Number(b.instapay_balance ?? b.instapayBalance ?? 0) + Number(b.wallet_balance ?? b.walletBalance ?? 0),
      0
    );
    const receivables = customers.reduce((s: number, c: any) => s + Number(c.balance_due ?? c.balanceDue ?? 0), 0);
    const payables = vendors.reduce((s: number, v: any) => s + Number(v.balance_owed ?? v.balanceOwed ?? 0), 0);
    const stockValuation = invRows.reduce(
      (s: number, i: any) => s + Number(i.quantity ?? 0) * Number(i.avg_cost ?? i.avgCost ?? 0),
      0
    );
    const lowStockItems = invRows.filter(
      (i: any) => Number(i.quantity ?? 0) <= Number(i.min_alert ?? i.minAlert ?? 5)
    );
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todayOrders = posOrders.filter((o: any) => String(o.created_at || o.createdAt || '').startsWith(todayPrefix));
    const pendingTransfers = transfers.filter((tr: any) => tr.status === 'pending_owner_confirmation');

    return {
      role: 'supplier',
      branches_count: branches.length || 1,
      total_liquidity: ownerMainTotal + branchTotal,
      owner_main_treasury: ownerMainTotal,
      branches_treasury: branchTotal,
      pending_transfers_count: pendingTransfers.length,
      receivables_from_customers: receivables,
      payables_to_vendors: payables,
      stock_valuation: stockValuation,
      inventory_items_count: invRows.length,
      low_stock_count: lowStockItems.length,
      customers_count: customers.length,
      vendors_count: vendors.length,
      employees_count: staff.length,
      today_pos_orders_count: todayOrders.length,
      today_pos_sales: todayOrders.reduce((s: number, o: any) => s + Number(o.final_total ?? o.finalTotal ?? 0), 0),
    };
  }

  const [products, materials, customers, suppliers, employees, treasBalancesRes, treasuriesCountRes] = await Promise.all([
    loadProducts(ctx),
    scopeQuery(ctx.db.from('materials').select('id', { count: 'exact', head: true }), ctx),
    scopeQuery(ctx.db.from('customers').select('id', { count: 'exact', head: true }), ctx),
    scopeQuery(ctx.db.from('suppliers').select('id', { count: 'exact', head: true }), ctx),
    scopeQuery(ctx.db.from('employees').select('id', { count: 'exact', head: true }), ctx),
    scopeQuery(ctx.db.from('treasury_balances').select('id, balance'), ctx),
    scopeQuery(ctx.db.from('treasuries').select('id', { count: 'exact', head: true }), ctx),
  ]);

  let totalLiquidity = 0;
  for (const t of treasBalancesRes.data || []) {
    totalLiquidity += Number(t.balance || 0);
  }

  return {
    role: 'artisan',
    total_liquidity: totalLiquidity,
    active_products: (products.data || []).length,
    materials_count: materials.count ?? 0,
    customers_count: customers.count ?? 0,
    suppliers_count: suppliers.count ?? 0,
    employees_count: employees.count ?? 0,
    treasuries_count: treasBalancesRes.data?.length ?? treasuriesCountRes.count ?? 0,
  };
}

async function listAllWorkshops(ctx: WorkshopToolContext): Promise<ToolResult> {
  if (!ctx.isSuperAdmin) {
    return {
      error: 'هذه الأداة مخصصة حصرياً لإدارة المنظومة (السوبر أدمن) لضمان خصوصية وعزل كل ورشة ومورد.',
    };
  }
  try {
    const { data, error } = await ctx.db
      .from('workshops')
      .select('id, brand_name, artist_name, email, phone, country, status, created_at')
      .limit(MAX_ROWS);
    if (!error && Array.isArray(data) && data.length > 0) {
      return {
        total: data.length,
        workshops: data.map((w: any) => ({
          id: w.id,
          name: w.brand_name,
          brand_name: w.brand_name,
          owner: w.artist_name,
          email: w.email,
          phone: w.phone,
          country: w.country,
          status: w.status || 'active',
          created_at: w.created_at,
        })),
      };
    }
  } catch {}
  return {
    total: 0,
    workshops: [],
  };
}

export async function runWorkshopTool(name: string, args: any, ctx: WorkshopToolContext): Promise<ToolResult> {
  try {
    switch (name) {
      case 'search_materials':
        return await searchMaterials(ctx, args);
      case 'search_products':
        return await searchProducts(ctx, args);
      case 'get_product_details':
        return await getProductDetails(ctx, args);
      case 'search_customers':
        return await searchCustomers(ctx, args);
      case 'search_suppliers':
        return await searchSuppliers(ctx, args);
      case 'search_employees':
        return await searchEmployees(ctx, args);
      case 'search_orders':
        return await searchOrders(ctx, args);
      case 'search_treasuries':
        return await searchTreasuries(ctx, args);
      case 'search_transactions':
        return await searchTransactions(ctx, args);
      case 'workshop_overview':
        return await workshopOverview(ctx);
      case 'list_all_workshops':
        return await listAllWorkshops(ctx);
      default:
        return { error: `أداة غير معروفة: ${name}` };
    }
  } catch (err: any) {
    console.warn(`[workshopTools] ${name} failed:`, err?.message);
    return { error: 'حدث خطأ أثناء قراءة بيانات الحساب' };
  }
}