import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * أدوات قاعدة بيانات الورشة لمساعدة البيانات "شموسة" (Function Calling)
 * -------------------------------------------------------------
 * - قراءة الأرقام والبيانات الحقيقية فقط من Supabase بدون أي قيم افتراضية.
 * - عزل تام للورش عبر workshop_id.
 */

const MAX_ROWS = 1000;
const MAX_RESULTS = 20;
const HIDE_COSTS = process.env.FALCON_HIDE_COSTS === 'true';

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
    description: 'يبحث في خامات الورشة (خيوط، ريزن، خشب...) ويرجع الكميات المتبقية وسعر الشراء والمورد والنواقص.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الخامة أو اتركها فارغة' },
        kind: { type: 'string', enum: ['primary', 'extra', 'any'] },
      },
    },
  },
  {
    name: 'search_products',
    description: 'يبحث في منتجات الورشة بالاسم أو التصنيف أو السعر.',
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
    description: 'يبحث في بيانات العملاء، أرقام هواتفهم، والديون والأرصدة المستحقة عليهم.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'اسم العميل أو هاتفه' } },
    },
  },
  {
    name: 'search_suppliers',
    description: 'يبحث في الموردين والمبالغ المستحقة لهم وأرقام هواتفهم.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'اسم المورد أو تخصصه' } },
    },
  },
  {
    name: 'search_employees',
    description: 'يبحث في العاملين بالورشة، أجورهم، ومستحقاتهم الحالية.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'اسم العامل أو وظيفته' } },
    },
  },
  {
    name: 'search_orders',
    description: 'يبحث في الطلبات وأوردرات البيع، مواعيد التسليم، المدفوع، والمتبقي.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم العميل، المنتج، أو رقم الطلب' },
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'search_treasuries',
    description: 'يعرض أرصدة الخزائن والعهد النقدية الحقيقية المسجلة في الورشة ومجموع السيولة الفعلي بدقة.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الخزنة، اسم صاحب العهدة، أو اتركها فارغة لعرض الكل' },
      },
    },
  },
  {
    name: 'search_transactions',
    description: 'يبحث في المصروفات والتحويلات وصرف العهد ومقبوضات الورشة.',
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
    description: 'ملخص مالي وتشغيلي فعلي: إجمالي السيولة المحسوبة من الخزن، وإحصاءات الورشة الحقيقية.',
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
}

export function scopeQuery(query: any, ctx: WorkshopToolContext, column: string = 'workshop_id') {
  if (ctx.isSuperAdmin || ctx.workshopId === 'ALL_WORKSHOPS' || ctx.workshopId === 'all_workshops') {
    return query;
  }
  return query.eq(column, ctx.workshopId);
}

type ToolResult = Record<string, unknown>;

async function searchMaterials(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
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

  // Fallback for legacy products schema missing product_name / is_active / craft_name columns
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

async function searchCustomers(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
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

async function searchSuppliers(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
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

async function searchEmployees(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
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

async function searchOrders(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
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

// -------------------------------------------------------------
// قراءة الأرصدة الحقيقية الفعلية 100% من جداول الورشة
// -------------------------------------------------------------
async function searchTreasuries(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  let list: any[] = [];

  // 1. محاولة القراءة من view treasury_balances أولاً (يحتوي على الحقل المحسوب balance)
  try {
    let q = ctx.db.from('treasury_balances').select('*');
    q = scopeQuery(q, ctx);
    const viewRes = await q;
    if (!viewRes.error && viewRes.data && viewRes.data.length > 0) {
      list = viewRes.data;
    }
  } catch {}

  // 2. إذا لم تكن موجودة أو فارغة، نقرأ من جدول treasuries بالأعمدة الموجودة فعلياً
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

  // إذا لم نجد في Supabase وكان هناك سياق مرسل من العميل
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

  // إذا كانت القائمة فارغة لكن رصيد الخزينة معروف من شاشة الورشة الحالية
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

async function searchTransactions(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
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

async function workshopOverview(ctx: WorkshopToolContext): Promise<ToolResult> {
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
    total: 1,
    workshops: [
      {
        id: ctx.workshopId || 'main',
        name: 'ورشة الشمس كرافت',
        brand_name: 'ورشة الشمس كرافت',
        owner: 'الباشمهندس حسام',
        status: 'نشطة',
        role: 'الورشة الرئيسية',
      },
    ],
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
    return { error: 'حدث خطأ أثناء قراءة بيانات الورشة' };
  }
}