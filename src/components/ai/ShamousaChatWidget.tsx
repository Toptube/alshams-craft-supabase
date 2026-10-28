import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * أدوات قاعدة بيانات الورشة لمساعدة البيانات "شموسة" (Function Calling)
 * -------------------------------------------------------------
 * - النموذج لا يرى قاعدة البيانات مباشرة؛ هو فقط "يطلب" أداة باسمها،
 *   والسيرفر هو اللي ينفذ الاستعلام ويرجع النتيجة.
 * - كل استعلام يتنفذ بعميل Supabase يحمل رمز المستخدم نفسه (RLS)
 *   + فلتر صريح workshop_id = ورشة المستخدم => عزل مزدوج بين الورش.
 * - مجاني بالكامل: لا يحتاج Embeddings ولا قاعدة Vector.
 */

const MAX_ROWS = 1000;
const MAX_RESULTS = 15;
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
    .map((t) => t.replace(/^ال/, ''))
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
    description: 'يبحث في خامات الورشة الحالية (خيوط، ريزن، خشب، إكسسوارات...) ويرجع الاسم والنوع والوحدة وسعر الشراء والمورد.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'كلمة البحث في اسم الخامة أو اسمها في السوق. اتركه فارغاً لعرض الكل.' },
        kind: { type: 'string', enum: ['primary', 'extra', 'any'], description: 'primary = خامة أساسية، extra = خامة إضافية' },
      },
    },
  },
  {
    name: 'search_products',
    description: 'يبحث في أرشيف منتجات الورشة الحالية بالاسم أو التصنيف أو الخامة المستخدمة أو حد أقصى للسعر. يرجع ملخصاً سريعاً.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'كلمة في اسم المنتج أو كوده أو وصفه أو ألوانه أو وسومه' },
        category: { type: 'string', description: 'التصنيف مثل رانر، ستائر، كوشن، جدارية' },
        material: { type: 'string', description: 'اسم خامة مستخدمة في المنتج' },
        max_retail_price: { type: 'number', description: 'أقصى سعر قطاعي' },
      },
    },
  },
  {
    name: 'get_product_details',
    description: 'يرجع كل تفاصيل منتج واحد من منتجات الورشة (الأبعاد، الوزن، الخامات بالكميات، الأسعار، الملاحظات).',
    parameters: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'معرف المنتج كما رجع من search_products' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'search_customers',
    description: 'يبحث في أسماء العملاء ورقم الهاتف والمدينة والرصيد الحالي داخل هذه الورشة فقط.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم العميل أو رقم الهاتف أو المدينة أو ملاحظات' },
      },
    },
  },
  {
    name: 'search_suppliers',
    description: 'يبحث في أسماء الموردين واهتماماتهم والرصيد المتبقي داخل الورشة دون الوصول لبيانات أي ورشة أخرى.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم المورد أو الهاتف أو عنوانه أو تخصصه' },
      },
    },
  },
  {
    name: 'search_employees',
    description: 'يبحث في الموظفين والعاملين بالورشة، ويفرجع الوظيفة، الراتب، والمستحقات الحالية.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الموظف أو الوظيفة أو الهاتف' },
      },
    },
  },
  {
    name: 'search_orders',
    description: 'يبحث في طلبات المبيعات والجرود داخل الورشة، ويعرض الحالة، قيمة الطلب، المدفوع والمتبقي.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم العميل، اسم المنتج، رقم الطلب، الحالة أو تاريخ الطلب' },
        status: { type: 'string', description: 'حالة الطلب مثل pending, paid, delivered, cancelled' },
      },
    },
  },
  {
    name: 'search_treasuries',
    description: 'يبحث في الخزن والعهد داخل الورشة، ويعيد اسم الخزنة، النوع، الرصيد، واسم الحامل.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الخزنة أو نوعها أو صاحبها' },
      },
    },
  },
  {
    name: 'search_transactions',
    description: 'يبحث في حركات الخزينة أو المصروفات أو المقبوضات داخل هذه الورشة فقط.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'اسم الحركة أو نوعها أو ملاحظاتها أو تاريخها' },
        type: { type: 'string', description: 'نوع الحركة: expense, deposit, transfer, custody, refund' },
      },
    },
  },
  {
    name: 'workshop_overview',
    description: 'ملخص سريع لبيانات الورشة: عدد المنتجات النشطة، التصنيفات، عدد الخامات، عدد العملاء، عدد الموردين، قيمة الخزينة.',
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
    .select('id, name, kind, supplier_id, unit_id, purchase_price, market_name, market_unit_factor')
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
      unit: unitName.get(m.unit_id) || null,
      purchase_price: HIDE_COSTS ? undefined : Number(m.purchase_price) || 0,
      market_name: m.market_name || null,
      supplier: supplierName.get(m.supplier_id) || null,
    })),
  };
}

async function loadProducts(ctx: WorkshopToolContext) {
  return ctx.db
    .from('products')
    .select('id, product_name, product_code, category, product_type, craft_name, cost_price, retail_price, wholesale_price, materials_used, specs, is_active')
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
    const materialsText =
      (Array.isArray(p.materials_used) ? p.materials_used : []).map((x: any) => x?.name || '').join(' ') +
      ' ' + (p.specs?.materialsDescription || '');
    const specsText = [p.specs?.marketingDescription, p.specs?.colorVariants, ...(p.specs?.tags || [])].filter(Boolean).join(' ');
    return (
      matches(`${p.product_name} ${p.product_code || ''} ${p.product_type || ''} ${specsText}`, args?.query) &&
      matches(`${p.category || ''} ${p.product_type || ''}`, args?.category) &&
      matches(materialsText, args?.material) &&
      (!maxPrice || Number(p.retail_price) <= maxPrice)
    );
  });

  return {
    total_found: filtered.length,
    products: filtered.slice(0, MAX_RESULTS).map((p: any) => ({
      id: p.id,
      name: p.product_name,
      code: p.product_code,
      category: p.category,
      type: p.product_type,
      craft: p.craft_name,
      retail_price: Number(p.retail_price) || 0,
      wholesale_price: Number(p.wholesale_price) || 0,
      cost_price: HIDE_COSTS ? undefined : Number(p.cost_price) || 0,
      materials: (Array.isArray(p.materials_used) ? p.materials_used : []).map((x: any) => x?.name).filter(Boolean),
      colors: p.specs?.colorVariants || undefined,
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
  if (error || !data) return { error: 'المنتج غير موجود في هذه الورشة' };
  const { workshop_id, ...rest } = data as any;
  if (HIDE_COSTS) delete rest.cost_price;
  return { product: rest };
}

async function searchCustomers(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('customers')
    .select('id, name, full_name, phone, phone_number, city, address, outstanding_balance, total_purchases, notes')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة العملاء' };

  const filtered = (data || []).filter((row: any) => matches(`${row.name || row.full_name || ''} ${row.phone || ''} ${row.city || ''} ${row.address || ''} ${row.notes || ''}`, args?.query));
  return {
    total_found: filtered.length,
    customers: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.name || row.full_name || 'عميل',
      phone: row.phone || row.phone_number || null,
      city: row.city || row.address || null,
      outstanding_balance: Number(row.outstanding_balance || 0),
      total_purchases: Number(row.total_purchases || 0),
    })),
  };
}

async function searchSuppliers(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('suppliers')
    .select('id, name, company_name, phone, phone_number, address, material_specialty, outstanding_balance, total_purchases, notes')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الموردين' };

  const filtered = (data || []).filter((row: any) => matches(`${row.name || ''} ${row.company_name || ''} ${row.phone || ''} ${row.material_specialty || ''} ${row.address || ''} ${row.notes || ''}`, args?.query));
  return {
    total_found: filtered.length,
    suppliers: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.name || row.company_name || 'مورد',
      company: row.company_name || null,
      phone: row.phone || row.phone_number || null,
      specialty: row.material_specialty || null,
      outstanding_balance: Number(row.outstanding_balance || 0),
    })),
  };
}

async function searchEmployees(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('employees')
    .select('id, full_name, role, tier, phone, phone_number, payment_type, base_wage, current_balance, total_earned, total_paid, is_active')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الموظفين' };

  const filtered = (data || []).filter((row: any) => matches(`${row.full_name || ''} ${row.role || ''} ${row.phone || ''} ${row.tier || ''}`, args?.query));
  return {
    total_found: filtered.length,
    employees: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.full_name,
      role: row.role || row.tier || null,
      payment_type: row.payment_type || null,
      base_wage: Number(row.base_wage || 0),
      current_balance: Number(row.current_balance || 0),
      is_active: row.is_active !== false,
    })),
  };
}

async function searchOrders(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('orders')
    .select('id, customer_name, customer_id, product_name, final_total, amount_paid, status, date, delivery_date, created_at')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة المبيعات والطلبات' };

  const status = String(args?.status || '').trim();
  const filtered = (data || []).filter((row: any) => {
    const matchesQuery = matches(`${row.customer_name || ''} ${row.product_name || ''} ${row.status || ''} ${row.id || ''} ${row.date || ''}`, args?.query);
    const matchesStatus = !status || row.status === status;
    return matchesQuery && matchesStatus;
  });

  return {
    total_found: filtered.length,
    orders: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      customer: row.customer_name || null,
      product: row.product_name || null,
      status: row.status || null,
      final_total: Number(row.final_total || 0),
      amount_paid: Number(row.amount_paid || 0),
      date: row.date || row.created_at || null,
      delivery_date: row.delivery_date || null,
    })),
  };
}

async function searchTreasuries(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const { data, error } = await ctx.db
    .from('treasuries')
    .select('id, name, kind, status, holder_name, min_balance, parent_id')
    .eq('workshop_id', ctx.workshopId)
    .limit(MAX_ROWS);
  if (error) return { error: 'تعذر قراءة الخزن' };

  const filtered = (data || []).filter((row: any) => matches(`${row.name || ''} ${row.kind || ''} ${row.holder_name || ''} ${row.status || ''}`, args?.query));
  return {
    total_found: filtered.length,
    treasuries: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      name: row.name,
      kind: row.kind || null,
      status: row.status || null,
      holder: row.holder_name || null,
      min_balance: Number(row.min_balance || 0),
    })),
  };
}

async function searchTransactions(ctx: WorkshopToolContext, args: any): Promise<ToolResult> {
  const type = String(args?.type || '').trim();
  let query = ctx.db.from('safe_transactions').select('*').eq('workshop_id', ctx.workshopId).limit(MAX_ROWS);
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) return { error: 'تعذر قراءة حركات الخزينة' };

  const filtered = (data || []).filter((row: any) => matches(`${row.notes || ''} ${row.type || ''} ${row.safe_type || ''} ${row.treasury_name || ''} ${row.date || ''}`, args?.query));
  return {
    total_found: filtered.length,
    transactions: filtered.slice(0, MAX_RESULTS).map((row: any) => ({
      id: row.id,
      type: row.type || null,
      amount: Number(row.amount || 0),
      balance_after: Number(row.balance_after || 0),
      safe_type: row.safe_type || row.safeType || null,
      note: row.notes || row.note || null,
      date: row.date || null,
    })),
  };
}

async function workshopOverview(ctx: WorkshopToolContext): Promise<ToolResult> {
  const [products, materials, customers, suppliers, employees, treasuries] = await Promise.all([
    loadProducts(ctx),
    ctx.db.from('materials').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('customers').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('suppliers').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('employees').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
    ctx.db.from('treasuries').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
  ]);

  const byCategory: Record<string, number> = {};
  for (const p of products.data || []) {
    const c = (p as any).category || 'غير مصنف';
    byCategory[c] = (byCategory[c] || 0) + 1;
  }

  return {
    active_products: (products.data || []).length,
    products_by_category: byCategory,
    materials_count: materials.count ?? 0,
    customers_count: customers.count ?? 0,
    suppliers_count: suppliers.count ?? 0,
    employees_count: employees.count ?? 0,
    treasuries_count: treasuries.count ?? 0,
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
      default:
        return { error: `أداة غير معروفة: ${name}` };
    }
  } catch (err: any) {
    console.warn(`[workshopTools] ${name} failed:`, err?.message);
    return { error: 'حدث خطأ أثناء قراءة بيانات الورشة' };
  }
}

