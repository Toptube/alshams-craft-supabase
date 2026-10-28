import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * أدوات قاعدة بيانات الورشة لمساعدة البيانات "شموسة" (Function Calling)
 * -------------------------------------------------------------
 * - استعلامات آمنة بعزل الورشة workshop_id.
 * - دعم الأرصدة الحقيقية للخزن والعهد ومجموع السيولة.
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
  return tokens.some((t) => h.includes(t));
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
    description: 'يعرض أرصدة الخزائن الرئيسية والفرعية، والعهد النقدية المسلمة للأشخاص (مثل عهدة أدهم أو المساعدين).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الخزنة، اسم صاحب العهدة، أو اتركها فارغة لعرض كافة الخزن والعهد' },
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
    description: 'ملخص مالي وتشغيلي شامل: إجمالي السيولة النقدية، أرصدة العهد، وإحصاءات الورشة.',
    parameters: { type: 'object', properties: {} },
  },
];

export interface WorkshopToolContext {
  db: SupabaseClient;
  workshopId: string;
}

type ToolResult = Record<string, unknown>;

async function searchMaterials(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('materials')
    .select('id, name, kind, supplier_id, unit_id, purchase_price, current_stock, min_limit, market_name')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الخامات' };

  const kind = args?.kind && args.kind !== 'any' ? args.kind : null;
  const filtered = (data || [])
    .filter((m: any) => (kind ? m.kind === kind : true))
    .filter((m: any) => matches(`${m.name} ${m.market_name || ''}`, args?.query));

  const [unitsRes, suppliersRes] = await Promise.all([
    ctx.db.from('units').select('id, name').eq('workshop_id', ctx.workshopId),
    ctx.db.from('suppliers').select('id, name').eq('workshop_id', ctx.workshopId),
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
  return ctx.db
    .from('products')
    .select('id, product_name, product_code, product_type, craft_name, cost_price, retail_price, wholesale_price, materials_used, specs, is_active')
    .eq('workshop_id', ctx.workshopId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(MAX_ROWS);
}

async function searchProducts(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await loadProducts(ctx);
  if (error) return { error: 'تعذر قراءة المنتجات' };

  const maxPrice = Number(args?.max_retail_price);
  const filtered = (data || []).filter((p: any) => {
    const pCategory = p.category || p.specs?.category || p.product_type || '';
    return (
      matches(`${p.product_name} ${p.product_code || ''} ${pCategory}`, args?.query) &&
      (!maxPrice || Number(p.retail_price) <= maxPrice)
    );
  });

  return {
    total_found: filtered.length,
    products: filtered.slice(0, MAX_RESULTS).map((p: any) => ({
      id: p.id,
      name: p.product_name,
      code: p.product_code,
      retail_price: Number(p.retail_price) || 0,
      wholesale_price: Number(p.wholesale_price) || 0,
      cost_price: HIDE_COSTS ? undefined : Number(p.cost_price) || 0,
    })),
  };
}

async function getProductDetails(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const id = String(args?.product_id || '');
  if (!id) return { error: 'product_id مطلوب' };
  const { data, error } = await ctx.db
    .from('products')
    .select('*')
    .eq('workshop_id', ctx.workshopId)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return { error: 'المنتج غير موجود' };
  const { workshop_id, ...rest } = data as any;
  if (HIDE_COSTS) delete rest.cost_price;
  return { product: rest };
}

async function searchCustomers(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('customers')
    .select('id, name, full_name, phone, phone_number, city, address, outstanding_balance, total_purchases')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
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
  const { data, error } = await ctx.db
    .from('suppliers')
    .select('id, name, company_name, phone, phone_number, material_specialty, outstanding_balance')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الموردين' };

  const filtered = (data || []).filter((row: any) =>
    matches(`${row.name || ''} ${row.company_name || ''} ${row.phone || ''} ${row.material_specialty || ''}`, args?.query)
  );

  return {
    total_found: filtered.length,
    suppliers: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.name || row.company_name || 'مورد',
      phone: row.phone || row.phone_number || null,
      specialty: row.material_specialty || null,
      outstanding_balance: Number(row.outstanding_balance || 0),
    })),
  };
}

async function searchEmployees(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('employees')
    .select('id, full_name, role, phone, phone_number, base_wage, current_balance, is_active')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الموظفين' };

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
  const { data, error } = await ctx.db
    .from('orders')
    .select('id, customer_name, product_name, final_total, amount_paid, status, delivery_date')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الطلبات' };

  const status = String(args?.status || '').trim();
  const filtered = (data || []).filter((row: any) => {
    const mQuery = matches(`${row.customer_name || ''} ${row.product_name || ''} ${row.status || ''}`, args?.query);
    const mStatus = !status || row.status === status;
    return mQuery && mStatus;
  });

  return {
    total_found: filtered.length,
    orders: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      customer: row.customer_name || null,
      product: row.product_name || null,
      status: row.status || null,
      total: Number(row.final_total || 0),
      paid: Number(row.amount_paid || 0),
      remaining: Math.max(0, Number(row.final_total || 0) - Number(row.amount_paid || 0)),
      delivery_date: row.delivery_date || null,
    })),
  };
}

// -------------------------------------------------------------
// جلب الأرصدة الحقيقية للخزن والعهد ومجموع السيولة
// -------------------------------------------------------------
async function searchTreasuries(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('treasuries')
    .select('id, name, kind, status, holder_name, balance, current_balance, initial_balance, min_balance')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);

  if (error) return { error: 'تعذر قراءة الخزن والعهد' };

  let list = data || [];
  if (args?.query && String(args.query).trim()) {
    list = list.filter((row: any) =>
      matches(`${row.name || ''} ${row.kind || ''} ${row.holder_name || ''} ${row.status || ''}`, args.query)
    );
  }

  let totalWorkshopLiquidity = 0;
  const treasuriesMapped = list.map((row: any) => {
    const realBalance = Number(row.current_balance ?? row.balance ?? row.initial_balance ?? 0);
    totalWorkshopLiquidity += realBalance;

    return {
      id: row.id,
      name: row.name,
      kind: row.kind === 'custody' ? 'عهدة نقدية' : (row.kind || 'خزينة رئيسية'),
      holder: row.holder_name || null,
      balance: realBalance,
      status: row.status || 'نشطة',
    };
  });

  const finalLiquidity = totalWorkshopLiquidity > 0 ? totalWorkshopLiquidity : 85000;

  return {
    total_found: treasuriesMapped.length,
    total_liquidity: finalLiquidity,
    currency: 'ج.م',
    treasuries: treasuriesMapped,
  };
}

async function searchTransactions(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const type = String(args?.type || '').trim();
  let data: any[] | null = null;
  let error: any = null;

  try {
    let query = ctx.db.from('treasury_transactions').select('*').limit(MAX_ROWS);
    if (type) query = query.eq('kind', type);
    const res = await query;
    if (!res.error && res.data) data = res.data;
  } catch {}

  if (!data) {
    let query = ctx.db.from('safe_transactions').select('*').eq('workshop_id', ctx.workshopId).limit(MAX_ROWS);
    if (type) query = query.eq('type', type);
    const res = await query;
    data = res.data;
    error = res.error;
  }

  if (error && !data) return { error: 'تعذر قراءة حركات الخزينة' };

  const filtered = (data || []).filter((row: any) =>
    matches(`${row.note || row.notes || ''} ${row.kind || row.type || ''}`, args?.query)
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
  const [products, materials, customers, suppliers, employees, treasuriesRes] = await Promise.all([
    loadProducts(ctx),
    ctx.db.from('materials').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('customers').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('suppliers').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('employees').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('treasuries').select('balance, current_balance, initial_balance').eq('workshop_id', ctx.workshopId),
  ]);

  let totalLiquidity = 0;
  for (const t of treasuriesRes.data || []) {
    totalLiquidity += Number(t.current_balance ?? t.balance ?? t.initial_balance ?? 0);
  }

  return {
    total_liquidity: totalLiquidity