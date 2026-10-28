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

const MAX_ROWS = 1000; // سقف القراءة لكل ورشة
const MAX_RESULTS = 15; // أقصى عدد نتائج يرجع للنموذج (لتوفير التوكنز)
const HIDE_COSTS = process.env.FALCON_HIDE_COSTS === 'true'; // لإخفاء سعر التكلفة عن النموذج

// -------------------------------------------------------------
// توحيد الحروف العربية للبحث (أ/إ/آ => ا ، ة => ه ، ى => ي ، حذف التشكيل)
// -------------------------------------------------------------
export function normalizeArabic(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '') // تشكيل + تطويل
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
    .map((t) => t.replace(/^ال/, '')) // تجاهل "ال" التعريف
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return true;
  // يكفي تطابق كل الكلمات (AND) — بحث منطقي لأسماء المنتجات والخامات
  return tokens.every((t) => h.includes(t));
}

// -------------------------------------------------------------
// تعريف الأدوات للنموذج
// -------------------------------------------------------------
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema — يشتغل مع Groq (OpenAI) و Gemini
}

export const workshopToolSchemas: ToolSchema[] = [
  {
    name: 'search_materials',
    description:
      'يبحث في خامات الورشة الحالية (خيوط، ريزن، خشب، إكسسوارات...) ويرجع الاسم والنوع والوحدة وسعر الشراء والمورد. استخدمه لأي سؤال عن الخامات المتاحة أو أسعارها أو مورديها.',
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
    description:
      'يبحث في أرشيف منتجات الورشة الحالية بالاسم أو التصنيف أو الخامة المستخدمة أو حد أقصى للسعر. يرجع ملخصاً لكل منتج (الاسم، الكود، التصنيف، سعر القطاعي والجملة، الخامات).',
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
    name: 'workshop_overview',
    description: 'ملخص سريع لبيانات الورشة: عدد المنتجات النشطة، التصنيفات، عدد الخامات. استخدمه لأسئلة عامة مثل "عندي كام منتج".',
    parameters: { type: 'object', properties: {} },
  },
];

// -------------------------------------------------------------
// تنفيذ الأدوات
// -------------------------------------------------------------
export interface WorkshopToolContext {
  db: SupabaseClient; // عميل بصلاحيات المستخدم (RLS)
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

  // أسماء الوحدات والموردين (استعلامين صغيرين بدل join لتفادي اعتماد على علاقات FK)
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
    .eq('workshop_id', ctx.workshopId) // حتى لو النموذج خمّن id من ورشة تانية، الفلتر يمنعه
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return { error: 'المنتج غير موجود في هذه الورشة' };
  const { workshop_id, ...rest } = data as any;
  if (HIDE_COSTS) delete rest.cost_price;
  return { product: rest };
}

async function workshopOverview(ctx: WorkshopToolContext): Promise<ToolResult> {
  const [products, materials] = await Promise.all([
    loadProducts(ctx),
    ctx.db.from('materials').select('id', { count: 'exact', head: true }).eq('workshop_id', ctx.workshopId),
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
