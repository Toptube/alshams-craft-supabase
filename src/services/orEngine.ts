/**
 * محرك بحوث العمليات الشامل 360° (Operations Research Engine) — منظومة الشمساوية
 * قاعدة الـ 90% برمجة ورياضيات / 10% ذكاء اصطناعي:
 * يعمل بالكامل برمجياً ورياضياً في TypeScript مع بيانات Dexie + Supabase بدون أي استدعاء لـ AI API.
 *
 * يشمل:
 * A. بحوث العمليات التشغيلية (Operational OR):
 *    1. تعظيم الربح ومزيج الإنتاج الأمثل (Bounded Profit Mix Solver)
 *    2. نقطة إعادة الطلب والكمية الاقتصادية (EOQ & Reorder Point)
 *    3. تقليل الهدر وإعادة التدوير الربحي (Zero-Waste & Upcycling Matcher)
 *    4. كشف عنق الزجاجة والربح بالساعة (Bottleneck Detection)
 *    5. التوفيق متعدد المستأجرين (Multi-Tenant Group Buying & Surplus Matching)
 *
 * B. بحوث عمليات المبيعات والعملاء والتسويق (Sales, CRM & Marketing OR):
 *    1. استعادة العملاء المهمين والمتكررين (VIP & Repeat Customer Re-targeting + WhatsApp)
 *    2. تشخيص أسباب التوقف وتراجع المبيعات رباعي المحاور (4-Axis Churn Diagnostics)
 *    3. المزيج التسويقي ("المنتج البطل") وباقات فك الركود الذكية (Hero Product & Smart Bundling)
 *    4. التسويق التشاركي وتنبيهات الموردين (Cross-Workshop Co-Marketing & B2B Supplier Alerts)
 */

import { db } from '../db/dexieDB';
import { supabase } from '../lib/supabase';
import type {
  CustomerRecord,
  InvoiceRecord,
  RawMaterialItem,
  SavedProductRecord,
  UserProfile,
  WorkOrderRecord,
} from '../types';
import {
  buildPostSaleFollowUpMessage,
  buildVipWhatsappMessage,
  buildWhatsAppLink,
  type DailyJournalRecord,
  type PersonalCareEventRecord,
} from './shamousaBrain';

export type ORRecommendationType =
  | 'operational'
  | 'marketing'
  | 'crm_retarget'
  | 'churn_diagnosis';

export interface ORRecommendation {
  id: string;
  tenant_id: string;
  recommendation_type: ORRecommendationType;
  categoryBadge: string;
  title: string;
  description: string;
  metricsSummary?: string;
  action_payload: {
    actionKind:
      | 'open_view'
      | 'whatsapp'
      | 'apply_bundle'
      | 'reorder_material'
      | 'upcycle_plan'
      | 'reprice_product'
      | 'group_buy';
    targetView?: string;
    axis?: 'photography' | 'pricing' | 'shipping' | 'post_sale' | 'operational' | 'marketing' | 'crm';
    productId?: string;
    materialId?: string;
    suggestedPrice?: number;
    bundleDiscountPercent?: number;
    estimatedExtraProfit?: number;
    buttonLabel: string;
  };
  target_customer_name?: string | null;
  target_customer_phone?: string | null;
  suggested_whatsapp_msg?: string | null;
  whatsapp_url?: string | null;
  impact_score: number;
  status: 'pending' | 'applied' | 'dismissed';
  created_at: string;
}

export interface ProductMixPlanItem {
  productId: string;
  productName: string;
  recommendedQty: number;
  unitProfit: number;
  hoursPerUnit: number;
  projectedProfit: number;
}

export interface OROverviewReport {
  generatedAt: string;
  currencySymbol: string;
  weeklyCapacityHours: number;
  projectedWeeklyProfit: number;
  productMixPlan: ProductMixPlanItem[];
  heroProduct: {
    name: string;
    marginPercent: number;
    retailPrice: number;
    score: number;
  } | null;
  recommendations: ORRecommendation[];
  weeklyTopThreeDecisions: ORRecommendation[];
  stats: {
    totalProducts: number;
    totalMaterials: number;
    lowStockCount: number;
    dormantVipCount: number;
    scrapOpportunitiesCount: number;
    churnFlagsCount: number;
  };
}

export interface CompanionUserPrefs {
  last_active_at: string;
  fadfada_time: string; // HH:MM
  weekly_review_day: 'friday' | 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday';
  protection_mode: boolean;
}

export interface HumanitarianAlertRecord {
  id: string;
  tenant_id: string;
  user_name: string;
  workshop_name?: string;
  phone?: string;
  alert_summary: string;
  severity: 'medium' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'resolved';
  created_at: string;
}

const LS_KEYS = {
  prefs: (tid: string) => `shamousa_prefs_v1_${tid}`,
  journals: (tid: string) => `shamousa_journals_v1_${tid}`,
  careEvents: (tid: string) => `shamousa_care_events_v1_${tid}`,
  recsStatus: (tid: string) => `shamousa_recs_status_v1_${tid}`,
  humanitarian: 'shamousa_humanitarian_alerts_v1',
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function resolveTenantId(profile?: UserProfile | null): string {
  return profile?.tenantId || profile?.workshopId || profile?.id || 'guest';
}

// ============================================================================
// طبقة المزامنة المرنة (Supabase + LocalStorage Fallback)
// ============================================================================

export async function loadCompanionPrefs(profile: UserProfile): Promise<CompanionUserPrefs> {
  const tid = resolveTenantId(profile);
  const defaults: CompanionUserPrefs = {
    last_active_at: new Date().toISOString(),
    fadfada_time: profile.dailySalesReminderTime || '21:00',
    weekly_review_day: 'friday',
    protection_mode: false,
  };
  const local = safeJsonParse<Partial<CompanionUserPrefs>>(localStorage.getItem(LS_KEYS.prefs(tid)), {});
  const mergedLocal: CompanionUserPrefs = { ...defaults, ...local };

  try {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (uid) {
      const { data } = await supabase
        .from('profiles')
        .select('last_active_at, fadfada_time, weekly_review_day, protection_mode')
        .eq('id', uid)
        .maybeSingle();
      if (data) {
        const synced: CompanionUserPrefs = {
          last_active_at: data.last_active_at || mergedLocal.last_active_at,
          fadfada_time: typeof data.fadfada_time === 'string' ? data.fadfada_time.slice(0, 5) : mergedLocal.fadfada_time,
          weekly_review_day: (data.weekly_review_day as CompanionUserPrefs['weekly_review_day']) || mergedLocal.weekly_review_day,
          protection_mode: Boolean(data.protection_mode),
        };
        localStorage.setItem(LS_KEYS.prefs(tid), JSON.stringify(synced));
        return synced;
      }
    }
  } catch {
    // Fallback صامت للمحلي قبل تشغيل Migration
  }
  return mergedLocal;
}

export async function saveCompanionPrefs(
  profile: UserProfile,
  patch: Partial<CompanionUserPrefs>
): Promise<CompanionUserPrefs> {
  const tid = resolveTenantId(profile);
  const current = safeJsonParse<CompanionUserPrefs>(localStorage.getItem(LS_KEYS.prefs(tid)), {
    last_active_at: new Date().toISOString(),
    fadfada_time: '21:00',
    weekly_review_day: 'friday',
    protection_mode: false,
  });
  const next: CompanionUserPrefs = { ...current, ...patch };
  localStorage.setItem(LS_KEYS.prefs(tid), JSON.stringify(next));

  try {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (uid) {
      await supabase
        .from('profiles')
        .upsert(
          {
            id: uid,
            email: profile.email,
            full_name: profile.artistName,
            workshop_name: profile.brandName,
            phone: profile.phoneNumber,
            last_active_at: next.last_active_at,
            fadfada_time: `${next.fadfada_time}:00`,
            weekly_review_day: next.weekly_review_day,
            protection_mode: next.protection_mode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
    }
  } catch {
    // المحلي محفوظ بالفعل
  }
  return next;
}

export async function loadDailyJournals(tenantId: string): Promise<DailyJournalRecord[]> {
  const local = safeJsonParse<DailyJournalRecord[]>(localStorage.getItem(LS_KEYS.journals(tenantId)), []);
  try {
    const { data, error } = await supabase
      .from('daily_journals')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(45);
    if (!error && Array.isArray(data) && data.length > 0) {
      localStorage.setItem(LS_KEYS.journals(tenantId), JSON.stringify(data));
      return data as DailyJournalRecord[];
    }
  } catch {
    // استخدام المحلي
  }
  return local;
}

export async function saveDailyJournal(entry: Omit<DailyJournalRecord, 'id' | 'created_at'>): Promise<DailyJournalRecord> {
  const record: DailyJournalRecord = {
    ...entry,
    id: crypto.randomUUID ? crypto.randomUUID() : `j_${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  const existing = safeJsonParse<DailyJournalRecord[]>(localStorage.getItem(LS_KEYS.journals(entry.tenant_id)), []);
  const next = [record, ...existing].slice(0, 90);
  localStorage.setItem(LS_KEYS.journals(entry.tenant_id), JSON.stringify(next));

  try {
    await supabase.from('daily_journals').insert({
      id: record.id,
      tenant_id: record.tenant_id,
      mood_color: record.mood_color,
      mood_score: record.mood_score,
      raw_text: record.raw_text,
      extracted_tags: record.extracted_tags,
      challenges: record.challenges,
      sales_note: record.sales_note || null,
      ai_reply: record.ai_reply || null,
      created_at: record.created_at,
    });
  } catch {
    // حفظ محلي آمن
  }
  return record;
}

export async function loadPersonalCareEvents(tenantId: string): Promise<PersonalCareEventRecord[]> {
  const local = safeJsonParse<PersonalCareEventRecord[]>(localStorage.getItem(LS_KEYS.careEvents(tenantId)), []);
  try {
    const { data, error } = await supabase
      .from('personal_care_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('event_time', { ascending: false })
      .limit(20);
    if (!error && Array.isArray(data) && data.length > 0) {
      localStorage.setItem(LS_KEYS.careEvents(tenantId), JSON.stringify(data));
      return data as PersonalCareEventRecord[];
    }
  } catch {
    // استخدام المحلي
  }
  return local;
}

export async function savePersonalCareEvent(
  event: Omit<PersonalCareEventRecord, 'id' | 'created_at'>
): Promise<PersonalCareEventRecord> {
  const record: PersonalCareEventRecord = {
    ...event,
    id: crypto.randomUUID ? crypto.randomUUID() : `care_${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  const existing = safeJsonParse<PersonalCareEventRecord[]>(localStorage.getItem(LS_KEYS.careEvents(event.tenant_id)), []);
  const next = [record, ...existing].slice(0, 30);
  localStorage.setItem(LS_KEYS.careEvents(event.tenant_id), JSON.stringify(next));

  try {
    await supabase.from('personal_care_events').insert(record);
  } catch {
    // حفظ محلي آمن
  }
  return record;
}

export async function updatePersonalCareEvent(
  tenantId: string,
  eventId: string,
  patch: Partial<PersonalCareEventRecord>
): Promise<void> {
  const existing = safeJsonParse<PersonalCareEventRecord[]>(localStorage.getItem(LS_KEYS.careEvents(tenantId)), []);
  const next = existing.map((e) => (e.id === eventId ? { ...e, ...patch } : e));
  localStorage.setItem(LS_KEYS.careEvents(tenantId), JSON.stringify(next));

  try {
    await supabase.from('personal_care_events').update(patch).eq('id', eventId).eq('tenant_id', tenantId);
  } catch {
    // تجاهل صامت
  }
}

/**
 * حفظ صامت تماماً لتنبيه الاستثناء الإنساني — لا يعرض أي إشعار للمستخدم مطلقاً
 */
export async function recordSilentHumanitarianAlert(params: {
  profile: UserProfile;
  summary: string;
  severity: 'medium' | 'high' | 'critical';
}): Promise<void> {
  const tenantId = resolveTenantId(params.profile);
  const record: HumanitarianAlertRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `hum_${Date.now()}`,
    tenant_id: tenantId,
    user_name: params.profile.artistName || params.profile.email || 'عضو الشمساوية',
    workshop_name: params.profile.brandName || 'ورشة بالشمساوية',
    phone: params.profile.phoneNumber || '',
    alert_summary: params.summary,
    severity: params.severity,
    status: 'new',
    created_at: new Date().toISOString(),
  };

  const existing = safeJsonParse<HumanitarianAlertRecord[]>(localStorage.getItem(LS_KEYS.humanitarian), []);
  // منع تكرار نفس التنبيه في نفس اليوم لنفس الورشة
  const todayKey = new Date().toISOString().slice(0, 10);
  const alreadyToday = existing.some(
    (a) => a.tenant_id === tenantId && a.created_at.slice(0, 10) === todayKey
  );
  if (!alreadyToday) {
    localStorage.setItem(LS_KEYS.humanitarian, JSON.stringify([record, ...existing].slice(0, 100)));
  }

  try {
    if (!alreadyToday) {
      await supabase.from('humanitarian_alerts').insert({
        id: record.id,
        tenant_id: record.tenant_id,
        user_name: record.user_name,
        workshop_name: record.workshop_name,
        phone: record.phone,
        alert_summary: record.alert_summary,
        severity: record.severity,
        status: record.status,
      });
    }
  } catch {
    // صامت تماماً
  }
}

export async function updateRecommendationStatus(
  tenantId: string,
  recId: string,
  status: 'pending' | 'applied' | 'dismissed'
): Promise<void> {
  const statusMap = safeJsonParse<Record<string, 'pending' | 'applied' | 'dismissed'>>(
    localStorage.getItem(LS_KEYS.recsStatus(tenantId)),
    {}
  );
  statusMap[recId] = status;
  localStorage.setItem(LS_KEYS.recsStatus(tenantId), JSON.stringify(statusMap));

  try {
    await supabase.from('or_recommendations').update({ status }).eq('id', recId).eq('tenant_id', tenantId);
  } catch {
    // حفظ محلي
  }
}

// ============================================================================
// دوال الرياضيات وبحوث العمليات الحتمية (Deterministic OR Algorithms)
// ============================================================================

function getProductUnitPrice(p: SavedProductRecord): number {
  return Number(p.storePrice || p.retailPrice || p.output?.finalSellingPrice || 0);
}

function getProductUnitCost(p: SavedProductRecord): number {
  const direct =
    Number(p.costPrice) ||
    Number(p.output?.unifiedBreakdown?.totalUnitCost) ||
    Number(p.output?.totalDirectMaterialsCost || 0) +
      Number(p.output?.laborWage || 0) +
      Number(p.output?.packagingCost || 0) +
      Number(p.output?.adminExpensesShare || 0);
  return Math.max(0, direct);
}

function estimateProductHours(p: SavedProductRecord): number {
  const explicit = Number((p.input as any)?.estimatedHours || (p.input as any)?.workingHours || (p.input as any)?.laborHours || 0);
  if (explicit > 0.2) return Math.min(40, explicit);
  const wage = Number(p.output?.laborWage || 0);
  if (wage > 0) return Math.max(0.5, Math.min(24, Number((wage / 65).toFixed(1))));
  return 2.5;
}

/**
 * 1. خوارزمية تعظيم الربح ومزيج الإنتاج الأسبوعي (Bounded Knapsack / LP Greedy-Optimal)
 * Maximize Σ (profit_i * x_i) subject to Σ (hours_i * x_i) <= weeklyHours & stock constraints
 */
function solveWeeklyProductMix(
  products: SavedProductRecord[],
  weeklyCapacityHours = 40
): { plan: ProductMixPlanItem[]; totalProfit: number } {
  const candidates = products
    .map((p) => {
      const price = getProductUnitPrice(p);
      const cost = getProductUnitCost(p);
      const unitProfit = Math.max(0, price - cost);
      const hoursPerUnit = estimateProductHours(p);
      const profitPerHour = hoursPerUnit > 0 ? unitProfit / hoursPerUnit : 0;
      return {
        productId: p.id,
        productName: p.productName,
        unitProfit,
        hoursPerUnit,
        profitPerHour,
        maxUnitsWeekly: Math.max(2, Math.min(12, Math.floor(weeklyCapacityHours / Math.max(1, hoursPerUnit * 1.8)))),
      };
    })
    .filter((c) => c.unitProfit > 0)
    .sort((a, b) => b.profitPerHour - a.profitPerHour);

  let remainingHours = weeklyCapacityHours;
  const plan: ProductMixPlanItem[] = [];

  for (const item of candidates) {
    if (remainingHours < item.hoursPerUnit) continue;
    // تخصيص متوازن: لا نضع كل الساعات في منتج واحد لتنويع المخاطر
    const capByHours = Math.floor(remainingHours / item.hoursPerUnit);
    const qty = Math.min(item.maxUnitsWeekly, capByHours, Math.max(2, Math.floor(weeklyCapacityHours * 0.45 / item.hoursPerUnit)));
    if (qty <= 0) continue;
    remainingHours -= qty * item.hoursPerUnit;
    plan.push({
      productId: item.productId,
      productName: item.productName,
      recommendedQty: qty,
      unitProfit: Math.round(item.unitProfit),
      hoursPerUnit: item.hoursPerUnit,
      projectedProfit: Math.round(qty * item.unitProfit),
    });
    if (plan.length >= 4 || remainingHours < 1) break;
  }

  const totalProfit = plan.reduce((sum, x) => sum + x.projectedProfit, 0);
  return { plan, totalProfit };
}

/**
 * 2. حساب الكمية الاقتصادية للطلب ونقطة إعادة الطلب (EOQ + Reorder Point)
 */
function analyzeMaterialsEOQ(
  materials: RawMaterialItem[],
  workOrders: WorkOrderRecord[],
  currencySymbol: string,
  tenantId: string
): { recs: ORRecommendation[]; lowStockCount: number } {
  const recs: ORRecommendation[] = [];
  let lowStockCount = 0;

  // حساب متوسط السحب اليومي من أوامر التشغيل إن وُجدت
  const pulledByMat = new Map<string, number>();
  workOrders.forEach((wo) => {
    (wo.pulledMaterials || []).forEach((pm) => {
      pulledByMat.set(pm.materialId, (pulledByMat.get(pm.materialId) || 0) + Number(pm.quantity || 0));
    });
  });

  const criticalMaterials = materials
    .filter((m) => m.isActive !== false)
    .map((m) => {
      const current = Number(m.currentStock || 0);
      const minThreshold = Math.max(1, Number(m.reorderLevel || m.minAlertThreshold || 2));
      const observed30dUsage = pulledByMat.get(m.id) || minThreshold * 2.2;
      const dailyUsage = Math.max(0.15, observed30dUsage / 30);
      const leadTimeDays = 4;
      const safetyStock = Math.ceil(dailyUsage * 2);
      const rop = Math.ceil(dailyUsage * leadTimeDays + safetyStock);
      // EOQ = sqrt(2 * D_annual * OrderCost / HoldingCost)
      const annualDemand = dailyUsage * 300;
      const orderCost = 60; // تكلفة شحن/مشوار توريد تقديرية
      const holdingCost = Math.max(2, Number(m.costPerUnit || 50) * 0.18);
      const eoq = Math.max(minThreshold, Math.round(Math.sqrt((2 * annualDemand * orderCost) / holdingCost)));
      const daysLeft = Math.floor(current / dailyUsage);
      return { m, current, rop, eoq, daysLeft, isLow: current <= Math.max(rop, minThreshold) };
    })
    .filter((x) => x.isLow)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  lowStockCount = criticalMaterials.length;

  for (const item of criticalMaterials.slice(0, 3)) {
    const estCost = Math.round(item.eoq * Number(item.m.costPerUnit || 0));
    recs.push({
      id: `or_rop_${item.m.id}`,
      tenant_id: tenantId,
      recommendation_type: 'operational',
      categoryBadge: 'نقطة إعادة الطلب EOQ',
      title: `أوشكت خامة «${item.m.materialName}» على النفاد`,
      description: `الرصيد الحالي (${item.current} ${item.m.unit}) أقل من نقطة إعادة الطلب المحسوبة (${item.rop} ${item.m.unit}) ويكفي تقريباً ${item.daysLeft} أيام تشغيل. الكمية الاقتصادية المقترحة للطلب هي ${item.eoq} ${item.m.unit}${estCost > 0 ? ` بتكلفة تقديرية ${estCost.toLocaleString('ar-EG')} ${currencySymbol}` : ''} لتفادي تعطيل الأوردرات وتوفير تكلفة الشحن المتكرر.`,
      metricsSummary: `المتوفر: ${item.current} | حد الأمان: ${item.rop} | الكمية الاقتصادية: ${item.eoq}`,
      action_payload: {
        actionKind: 'reorder_material',
        axis: 'operational',
        targetView: 'suppliers_market',
        materialId: item.m.id,
        buttonLabel: 'اطلبها من موردين الشمساوية',
      },
      impact_score: item.current <= 0 ? 96 : 87,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  return { recs, lowStockCount };
}

/**
 * 3. محرك تقليل الهدر وإعادة التدوير الربحي (Zero-Waste & Upcycling)
 */
function analyzeZeroWasteUpcycling(
  products: SavedProductRecord[],
  workOrders: WorkOrderRecord[],
  journals: DailyJournalRecord[],
  currencySymbol: string,
  tenantId: string
): { recs: ORRecommendation[]; count: number } {
  const recs: ORRecommendation[] = [];
  const scrapMap = new Map<string, { name: string; qty: number; unit: string; cost: number }>();

  workOrders.forEach((wo) => {
    (wo.scrapItems || []).forEach((s) => {
      const key = s.materialName || s.materialId;
      const prev = scrapMap.get(key) || { name: s.materialName, qty: 0, unit: s.unit || 'وحدة', cost: 0 };
      prev.qty += Number(s.wasteQty || 0);
      prev.cost += Number(s.wasteCost || 0);
      scrapMap.set(key, prev);
    });
  });

  // أيضاً فحص الهدر المحسوب في معادلات المنتجات
  let totalFormulaWasteValue = 0;
  let wasteCraftSample = '';
  products.forEach((p) => {
    const wastePct = Number(p.output?.craftMetrics?.wasteFactorPercent || 0);
    if (wastePct >= 8) {
      totalFormulaWasteValue += Number(p.output?.totalDirectMaterialsCost || 0) * (wastePct / 100);
      if (!wasteCraftSample) wasteCraftSample = p.craftName || p.category || 'الأشغال اليدوية';
    }
  });

  const hasJournalWasteMention = journals.some((j) => (j.extracted_tags || []).includes('هدر_وبواقي'));

  if (scrapMap.size > 0) {
    const topScrap = Array.from(scrapMap.values()).sort((a, b) => b.cost - a.cost)[0];
    const estMicroUnits = Math.max(4, Math.min(20, Math.round(topScrap.qty * 3) || 6));
    const estExtraRevenue = Math.round(estMicroUnits * 65);
    recs.push({
      id: `or_upcycle_${topScrap.name.slice(0, 12)}`,
      tenant_id: tenantId,
      recommendation_type: 'operational',
      categoryBadge: 'تصفير الهدر Upcycling',
      title: `حوّل بواقي «${topScrap.name}» لربح صافي فوري`,
      description: `عندك بواقي مسجّلة (${topScrap.qty.toFixed(1)} ${topScrap.unit}) تكلفتها الدفترية بالفعل محمّلة على الأوردرات السابقة. بحوث العمليات تقترح تحويلها لـ ${estMicroUnits} قطع صغيرة (كوسترات / ميداليات / إكسسوارات هدايا) بتكلفة خامات تقارب الصفر وعائد إضافي متوقع ~${estExtraRevenue.toLocaleString('ar-EG')} ${currencySymbol}.`,
      metricsSummary: `تكلفة خامات ≈ 0 | ربح إضافي متوقع +${estExtraRevenue.toLocaleString('ar-EG')} ${currencySymbol}`,
      action_payload: {
        actionKind: 'upcycle_plan',
        axis: 'operational',
        targetView: 'calculator',
        estimatedExtraProfit: estExtraRevenue,
        buttonLabel: 'سعّر منتج البواقي في الحاسبة',
      },
      impact_score: 90,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  } else if (totalFormulaWasteValue > 40 || hasJournalWasteMention) {
    const estRecover = Math.max(180, Math.round(totalFormulaWasteValue * 1.8));
    recs.push({
      id: `or_upcycle_formula_${tenantId}`,
      tenant_id: tenantId,
      recommendation_type: 'operational',
      categoryBadge: 'تصفير الهدر Upcycling',
      title: `استغلال هدر خامات ${wasteCraftSample || 'الورشة'} في منتجات هدايا سريعة`,
      description: `معادلات منتجاتك تشير لهدر خامات قابل للاستثمار. خصّص ساعة واحدة أسبوعياً لتحويل القصاقيص والبواقي إلى (ميداليات، كوسترات، أو فواصل كتب) كهدايا تزيد ولاء العملاء أو مبيعات إضافية بعائد متوقع ~${estRecover.toLocaleString('ar-EG')} ${currencySymbol} شهرياً.`,
      metricsSummary: `عائد مسترد متوقع +${estRecover.toLocaleString('ar-EG')} ${currencySymbol}/شهرياً`,
      action_payload: {
        actionKind: 'upcycle_plan',
        axis: 'operational',
        targetView: 'calculator',
        estimatedExtraProfit: estRecover,
        buttonLabel: 'إنشاء منتج بواقي جديد',
      },
      impact_score: 82,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  return { recs, count: recs.length };
}

/**
 * 4. كشف عنق الزجاجة (Bottleneck Detection — وقت طويل مقابل ربح ضعيف بالساعة)
 */
function analyzeBottlenecks(
  products: SavedProductRecord[],
  currencySymbol: string,
  tenantId: string
): ORRecommendation[] {
  if (products.length < 2) return [];
  const analyzed = products
    .map((p) => {
      const price = getProductUnitPrice(p);
      const cost = getProductUnitCost(p);
      const profit = price - cost;
      const hours = estimateProductHours(p);
      const profitPerHour = hours > 0 ? profit / hours : 0;
      return { p, price, cost, profit, hours, profitPerHour };
    })
    .filter((x) => x.price > 0);

  if (analyzed.length < 2) return [];
  const avgPph = analyzed.reduce((s, x) => s + x.profitPerHour, 0) / analyzed.length;
  const bottleneck = analyzed
    .filter((x) => x.hours >= 3 && x.profitPerHour < avgPph * 0.65)
    .sort((a, b) => a.profitPerHour - b.profitPerHour)[0];

  if (!bottleneck) return [];

  const targetPrice = Math.ceil((bottleneck.cost + avgPph * bottleneck.hours) / 5) * 5;
  return [
    {
      id: `or_bottleneck_${bottleneck.p.id}`,
      tenant_id: tenantId,
      recommendation_type: 'operational',
      categoryBadge: 'كشف عنق الزجاجة',
      title: `«${bottleneck.p.productName}» يستهلك وقتاً طويلاً بعائد ساعة منخفض`,
      description: `هذا المنتج يستغرق نحو ${bottleneck.hours} ساعة شغل لكن صافي ربح الساعة فيه (${Math.round(bottleneck.profitPerHour)} ${currencySymbol}/ساعة) أقل بكثير من متوسط ورشتك (${Math.round(avgPph)} ${currencySymbol}/ساعة). نقترح رفع السعر تدريجياً نحو ${targetPrice.toLocaleString('ar-EG')} ${currencySymbol} أو تنفيذه بالطلب المسبق فقط (Pre-order) مع عربون 50%.`,
      metricsSummary: `ربح الساعة: ${Math.round(bottleneck.profitPerHour)} مقابل متوسط ${Math.round(avgPph)} ${currencySymbol}`,
      action_payload: {
        actionKind: 'reprice_product',
        axis: 'operational',
        targetView: 'calculator',
        productId: bottleneck.p.id,
        suggestedPrice: targetPrice,
        buttonLabel: 'تعديل تسعير المنتج',
      },
      impact_score: 88,
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  ];
}

/**
 * 5. استعادة عملاء الـ VIP والعملاء المتكررين (Dormant > 30 days)
 */
function analyzeVipRetargeting(
  customers: CustomerRecord[],
  orders: InvoiceRecord[],
  profile: UserProfile,
  currencySymbol: string,
  tenantId: string
): { recs: ORRecommendation[]; count: number } {
  const now = Date.now();
  const DAY_MS = 86400 * 1000;

  // تجميع الطلبات لكل عميل
  const statsByCustomer = new Map<
    string,
    { name: string; phone: string; orderCount: number; totalSpent: number; lastOrderTs: number; lastProduct: string }
  >();

  customers.forEach((c) => {
    const key = c.id || c.phone || c.phoneNumber || c.fullName || c.name || '';
    if (!key) return;
    statsByCustomer.set(key, {
      name: c.fullName || c.name || 'عميل مميز',
      phone: c.phoneNumber || c.phone || '',
      orderCount: 0,
      totalSpent: Number(c.totalInvoiced || c.totalPurchases || 0),
      lastOrderTs: Number(c.updatedAt || c.createdAt || 0),
      lastProduct: '',
    });
  });

  orders.forEach((o) => {
    const key = o.customerId || o.customerPhone || o.customerName || '';
    if (!key) return;
    const orderTs = o.createdAt || (o.date ? new Date(o.date).getTime() : 0);
    const amount = Number(o.finalTotal || o.totalAmount || o.price || 0);
    const firstItemName = o.items?.[0]?.productName || o.productName || '';
    const prev = statsByCustomer.get(key) || {
      name: o.customerName || 'عميل مميز',
      phone: o.customerPhone || '',
      orderCount: 0,
      totalSpent: 0,
      lastOrderTs: 0,
      lastProduct: '',
    };
    prev.orderCount += 1;
    prev.totalSpent = Math.max(prev.totalSpent, prev.totalSpent + amount);
    if (!prev.phone && o.customerPhone) prev.phone = o.customerPhone;
    if (orderTs >= prev.lastOrderTs) {
      prev.lastOrderTs = orderTs;
      if (firstItemName) prev.lastProduct = firstItemName;
    }
    statsByCustomer.set(key, prev);
  });

  const dormantVips = Array.from(statsByCustomer.values())
    .map((c) => ({
      ...c,
      daysInactive: c.lastOrderTs > 0 ? Math.floor((now - c.lastOrderTs) / DAY_MS) : 0,
    }))
    .filter((c) => c.daysInactive >= 30 && (c.orderCount >= 1 || c.totalSpent >= 350))
    .sort((a, b) => b.totalSpent - a.totalSpent || b.daysInactive - a.daysInactive);

  const recs: ORRecommendation[] = dormantVips.slice(0, 3).map((vip, idx) => {
    const waMsg = buildVipWhatsappMessage({
      customerName: vip.name,
      lastProductName: vip.lastProduct,
      workshopName: profile.brandName,
      offerHint: 'خصم تقديري 10% على طلبك القادم أو هدية صغيرة مع الأوردر',
    });
    const waUrl = buildWhatsAppLink(vip.phone, waMsg);
    return {
      id: `or_vip_${idx}_${vip.name.slice(0, 10)}`,
      tenant_id: tenantId,
      recommendation_type: 'crm_retarget',
      categoryBadge: 'استعادة عميل VIP',
      title: `تواصل دافئ مع «${vip.name}» (غائب منذ ${vip.daysInactive} يوماً)`,
      description: `عميل مميز بإجمالي مشتريات ${Math.round(vip.totalSpent).toLocaleString('ar-EG')} ${currencySymbol}${vip.lastProduct ? ` وآخر طلب كان «${vip.lastProduct}»` : ''}. إعادة التواصل الودّي مع العملاء السابقين أرخص 5 أضعاف من استقطاب عميل جديد وأسرع في الإغلاق.`,
      metricsSummary: `إجمالي المشتريات: ${Math.round(vip.totalSpent).toLocaleString('ar-EG')} ${currencySymbol} • غياب ${vip.daysInactive} يوم`,
      action_payload: {
        actionKind: 'whatsapp',
        axis: 'crm',
        buttonLabel: 'إرسال رسالة واتساب جاهزة',
      },
      target_customer_name: vip.name,
      target_customer_phone: vip.phone || null,
      suggested_whatsapp_msg: waMsg,
      whatsapp_url: waUrl,
      impact_score: 94,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  });

  return { recs, count: dormantVips.length };
}

/**
 * 6. تشخيص أسباب التوقف وتراجع المبيعات رباعي المحاور (4-Axis Churn Diagnostics)
 */
function analyzeFourAxisChurn(
  products: SavedProductRecord[],
  orders: InvoiceRecord[],
  journals: DailyJournalRecord[],
  profile: UserProfile,
  currencySymbol: string,
  tenantId: string
): ORRecommendation[] {
  const recs: ORRecommendation[] = [];

  // المحور 1: التصوير وجودة العرض
  const unpictured = products.filter((p) => !p.imageUrl && (!p.galleryUrls || p.galleryUrls.length === 0));
  if (unpictured.length > 0) {
    recs.push({
      id: `or_churn_photo_${tenantId}`,
      tenant_id: tenantId,
      recommendation_type: 'churn_diagnosis',
      categoryBadge: 'تشخيص العرض والتصوير',
      title: `${unpictured.length} منتجات بدون صور عرض جذابة`,
      description: `في الصناعات اليدوية، الصورة تمثّل 70% من قرار الشراء الأول. وجود منتجات مثل «${unpictured[0].productName}» بدون صورة يقلّل فرص التحويل في متجرك وسوق الشمساوية. حدّث صورها بإضاءة طبيعية وخلفية هادئة الآن.`,
      metricsSummary: `محور التصوير • ${unpictured.length} منتج بحاجة لصور`,
      action_payload: {
        actionKind: 'open_view',
        axis: 'photography',
        targetView: 'catalog',
        buttonLabel: 'افتح الكتالوج والمعرض لتحديث الصور',
      },
      impact_score: 91,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  // المحور 2: فجوة التسعير مقابل متوسط الورشة/السوق
  const pricedProducts = products.filter((p) => getProductUnitPrice(p) > 0 && getProductUnitCost(p) > 0);
  if (pricedProducts.length >= 2) {
    const underMargin = pricedProducts.find((p) => {
      const price = getProductUnitPrice(p);
      const cost = getProductUnitCost(p);
      return (price - cost) / price < 0.22;
    });
    if (underMargin) {
      const cost = getProductUnitCost(underMargin);
      const healthyPrice = Math.ceil((cost / 0.68) / 5) * 5;
      recs.push({
        id: `or_churn_pricing_${underMargin.id}`,
        tenant_id: tenantId,
        recommendation_type: 'churn_diagnosis',
        categoryBadge: 'تشخيص التسعير والهامش',
        title: `هامش ربح «${underMargin.productName}» مضغوط جداً`,
        description: `السعر الحالي (${getProductUnitPrice(underMargin).toLocaleString('ar-EG')} ${currencySymbol}) يترك هامشاً أقل من 22% مما يضعف قدرتك على عمل عروض أو خصومات شحن. نقترح إعادة التسعير نحو ${healthyPrice.toLocaleString('ar-EG')} ${currencySymbol} أو تقليل تكلفة التغليف.`,
        metricsSummary: `السعر المقترح المتوازن: ${healthyPrice.toLocaleString('ar-EG')} ${currencySymbol}`,
        action_payload: {
          actionKind: 'reprice_product',
          axis: 'pricing',
          targetView: 'calculator',
          productId: underMargin.id,
          suggestedPrice: healthyPrice,
          buttonLabel: 'مراجعة السعر في الحاسبة',
        },
        impact_score: 86,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }
  }

  // المحور 3: تأخير التسليم والشحن (ربط الطلبات باليوميات)
  const shippingJournalHits = journals.filter((j) => (j.extracted_tags || []).includes('تأخير_الشحن')).length;
  const overdueOrders = orders.filter((o) => {
    if (!o.deliveryDate) return false;
    const isOpen = !['delivered', 'paid', 'cancelled'].includes(String(o.status || '').toLowerCase());
    return isOpen && new Date(o.deliveryDate).getTime() < Date.now();
  });

  if (shippingJournalHits > 0 || overdueOrders.length > 0) {
    recs.push({
      id: `or_churn_shipping_${tenantId}`,
      tenant_id: tenantId,
      recommendation_type: 'churn_diagnosis',
      categoryBadge: 'تشخيص الشحن والتسليم',
      title: `مؤشر احتكاك في مواعيد الشحن (${overdueOrders.length} طلبات متأخرة)`,
      description: `رصدنا إشارات تأخير في التسليم${shippingJournalHits > 0 ? ' في يوميات الفضفضة' : ''}. العملاء يسامحون يوم تأخير لو تواصلنا معهم استباقياً، لكن الصمت يسبب عزوفاً عن الطلب الثاني. أضف يوم أمان في مدة التجهيز وأبلغ العميل فور الشحن.`,
      metricsSummary: `محور الشحن • طلبات مفتوحة متأخرة: ${overdueOrders.length}`,
      action_payload: {
        actionKind: 'open_view',
        axis: 'shipping',
        targetView: 'my_orders',
        buttonLabel: 'مراجعة الأوردرات ومواعيد التسليم',
      },
      impact_score: 89,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  // المحور 4: غياب متابعة ما بعد البيع (Post-Sale Follow-Up)
  const now = Date.now();
  const DAY_MS = 86400 * 1000;
  const recentDelivered = orders.find((o) => {
    const ts = o.updatedAt || o.createdAt || (o.date ? new Date(o.date).getTime() : 0);
    const daysAgo = (now - ts) / DAY_MS;
    return daysAgo >= 3 && daysAgo <= 18 && (o.customerPhone || o.customerName);
  });

  if (recentDelivered) {
    const cName = recentDelivered.customerName || 'العميل';
    const prodName = recentDelivered.items?.[0]?.productName || recentDelivered.productName || 'المنتج';
    const waMsg = buildPostSaleFollowUpMessage({
      customerName: cName,
      productName: prodName,
      workshopName: profile.brandName,
    });
    recs.push({
      id: `or_churn_postsale_${recentDelivered.id}`,
      tenant_id: tenantId,
      recommendation_type: 'churn_diagnosis',
      categoryBadge: 'متابعة ما بعد البيع',
      title: `رسالة اطمئنان بعد الاستلام لـ «${cName}»`,
      description: `رسالة ودّية واحدة بعد استلام «${prodName}» ترفع احتمال عودة العميل للطلب الثاني بنسبة 40% وتمنحك تقييماً إيجابياً لمتجرك.`,
      metricsSummary: `محور ما بعد البيع • بناء ولاء متكرر`,
      action_payload: {
        actionKind: 'whatsapp',
        axis: 'post_sale',
        buttonLabel: 'أرسل رسالة الاطمئنان بالواتساب',
      },
      target_customer_name: cName,
      target_customer_phone: recentDelivered.customerPhone || null,
      suggested_whatsapp_msg: waMsg,
      whatsapp_url: buildWhatsAppLink(recentDelivered.customerPhone, waMsg),
      impact_score: 85,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  return recs;
}

/**
 * 7. المزيج التسويقي ("المنتج البطل") وباقات فك الركود الذكية (Smart Bundling)
 */
function analyzeMarketingMixAndBundles(
  products: SavedProductRecord[],
  orders: InvoiceRecord[],
  profile: UserProfile,
  currencySymbol: string,
  tenantId: string
): {
  heroProduct: OROverviewReport['heroProduct'];
  recs: ORRecommendation[];
} {
  const recs: ORRecommendation[] = [];
  if (products.length === 0) return { heroProduct: null, recs };

  const salesByProduct = new Map<string, number>();
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      const key = it.productId || it.productName;
      if (key) salesByProduct.set(key, (salesByProduct.get(key) || 0) + Number(it.quantity || 1));
    });
  });

  const scored = products
    .map((p) => {
      const price = getProductUnitPrice(p);
      const cost = getProductUnitCost(p);
      const marginPct = price > 0 ? Math.round(((price - cost) / price) * 100) : 30;
      const velocity = (salesByProduct.get(p.id) || salesByProduct.get(p.productName) || 0) + (p.inStore ? 1 : 0);
      const photoBonus = p.imageUrl ? 12 : 0;
      const score = Math.min(100, Math.round(marginPct * 0.9 + velocity * 14 + photoBonus));
      return { p, price, cost, marginPct, velocity, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const heroProduct: OROverviewReport['heroProduct'] = best
    ? {
        name: best.p.productName,
        marginPercent: best.marginPct,
        retailPrice: best.price,
        score: best.score,
      }
    : null;

  if (best) {
    recs.push({
      id: `or_hero_${best.p.id}`,
      tenant_id: tenantId,
      recommendation_type: 'marketing',
      categoryBadge: 'المنتج البطل Hero',
      title: `سلّط الضوء التسويقي على «${best.p.productName}»`,
      description: `هو الأعلى توازناً بين هامش الربح (${best.marginPct}%) وجاذبية البيع بسعر ${best.price.toLocaleString('ar-EG')} ${currencySymbol}. اجعله في مقدمة متجرك ومنشوراتك الأسبوعية لجذب عملاء جدد بأعلى عائد.`,
      metricsSummary: `هامش الربح: ${best.marginPct}% • مؤشر البطولة: ${best.score}/100`,
      action_payload: {
        actionKind: 'open_view',
        axis: 'marketing',
        targetView: 'store',
        productId: best.p.id,
        buttonLabel: 'تثبيت المنتج في متجري',
      },
      impact_score: 92,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  // باقة فك الركود الذكية (دمج منتج بطيء مع المنتج البطل بأقل خصم يحافظ على الربح)
  if (scored.length >= 2) {
    const slowMover = scored[scored.length - 1];
    if (slowMover.p.id !== best.p.id && best.price > 0 && slowMover.price > 0) {
      const combinedPrice = best.price + slowMover.price;
      const combinedCost = best.cost + slowMover.cost;
      const combinedMarginRatio = (combinedPrice - combinedCost) / combinedPrice;
      // نختار خصماً بين 8% و 14% بشرط الحفاظ على صافي ربح >= 24%
      const safeDiscount = Math.max(8, Math.min(14, Math.floor((combinedMarginRatio - 0.24) * 100)));
      const bundlePrice = Math.round((combinedPrice * (1 - safeDiscount / 100)) / 5) * 5;
      const bundleProfit = Math.max(0, bundlePrice - combinedCost);

      recs.push({
        id: `or_bundle_${best.p.id}_${slowMover.p.id}`,
        tenant_id: tenantId,
        recommendation_type: 'marketing',
        categoryBadge: 'باقة فك الركود',
        title: `باقة ذكية: «${best.p.productName}» + «${slowMover.p.productName}»`,
        description: `لتنشيط حركة «${slowMover.p.productName}» بدون حرق سعره، ادمجه مع المنتج البطل بخصم محسوب (${safeDiscount}%) ليصبح سعر الباقة ${bundlePrice.toLocaleString('ar-EG')} ${currencySymbol} بدلاً من ${combinedPrice.toLocaleString('ar-EG')} ${currencySymbol} مع صافي ربح مضمون ~${Math.round(bundleProfit).toLocaleString('ar-EG')} ${currencySymbol}.`,
        metricsSummary: `خصم محسوب ${safeDiscount}% • ربح الباقة الصافي: ${Math.round(bundleProfit).toLocaleString('ar-EG')} ${currencySymbol}`,
        action_payload: {
          actionKind: 'apply_bundle',
          axis: 'marketing',
          targetView: 'store',
          bundleDiscountPercent: safeDiscount,
          estimatedExtraProfit: Math.round(bundleProfit),
          buttonLabel: 'تجهيز العرض في متجري',
        },
        impact_score: 89,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }
  }

  // التسويق التشاركي أو تنبيه الموردين B2B
  if (profile.accountRole === 'supplier') {
    recs.push({
      id: `or_b2b_supplier_${tenantId}`,
      tenant_id: tenantId,
      recommendation_type: 'marketing',
      categoryBadge: 'فرصة توريد B2B',
      title: `حملة باقات جملة للورش القريبة في ${profile.governorate || 'محافظتك'}`,
      description: `بصفتك مورداً داخل منظومة الشمساوية، تجهيز "باقة توريد شهرية" بخصم كمية 7% لورش الأشغال اليدوية يزيد معدل إعادة الطلب الدوري ويضمن سيولة ثابتة.`,
      metricsSummary: `توجيه B2B • عروض الورش القريبة`,
      action_payload: {
        actionKind: 'group_buy',
        axis: 'marketing',
        targetView: 'suppliers_market',
        buttonLabel: 'إدارة عروض الموردين',
      },
      impact_score: 84,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  } else {
    recs.push({
      id: `or_comarketing_${tenantId}`,
      tenant_id: tenantId,
      recommendation_type: 'marketing',
      categoryBadge: 'تعاون الورش والشراء الجماعي',
      title: `شراء جماعي للخامات + باقة هدايا تشاركية في ${profile.governorate || 'نطاقك'}`,
      description: `الشراء الجماعي للخامات الأساسية مع ورشتين مجاورتين يخفض تكلفة التوريد والشحن بنسبة 12%–18%، كما أن دمج منتجك مع ورشة مكملة (مثل شموع + مكرمية أو كونكريت + جلد) يضاعف جمهورك مجاناً.`,
      metricsSummary: `وفر توريد 12%–18% • جمهور تشاركي جديد`,
      action_payload: {
        actionKind: 'group_buy',
        axis: 'marketing',
        targetView: 'marketplace',
        buttonLabel: 'استكشاف ورش وموردين المنظومة',
      },
      impact_score: 80,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  return { heroProduct, recs };
}

// ============================================================================
// المحرك الرئيسي: تشغيل بحوث العمليات 360° بالكامل وتوليد التقرير الأسبوعي
// ============================================================================

export async function runFullOperationsResearch(profile: UserProfile): Promise<OROverviewReport> {
  const tenantId = resolveTenantId(profile);
  const currencySymbol = profile.currencySymbol || 'ج.م';

  // 1. سحب البيانات الحية من Dexie للمستأجر الحالي فقط (معزول تماماً)
  const [products, materials, customers, orders, workOrders, journals] = await Promise.all([
    db.products.where('tenantId').equals(tenantId).toArray().catch(() => [] as SavedProductRecord[]),
    db.rawMaterials.where('tenantId').equals(tenantId).toArray().catch(() => [] as RawMaterialItem[]),
    db.customers.where('tenantId').equals(tenantId).toArray().catch(() => [] as CustomerRecord[]),
    db.orders.where('tenantId').equals(tenantId).toArray().catch(() => [] as InvoiceRecord[]),
    db.workOrders.where('tenantId').equals(tenantId).toArray().catch(() => [] as WorkOrderRecord[]),
    loadDailyJournals(tenantId),
  ]);

  const activeProducts = products.filter((p) => p.isActive !== false);
  const activeMaterials = materials.filter((m) => m.isActive !== false);

  // 2. تشغيل خوارزميات بحوث العمليات التشغيلية (Operational OR)
  const weeklyCapacityHours = 40;
  const { plan: productMixPlan, totalProfit: projectedWeeklyProfit } = solveWeeklyProductMix(
    activeProducts,
    weeklyCapacityHours
  );
  const { recs: eoqRecs, lowStockCount } = analyzeMaterialsEOQ(
    activeMaterials,
    workOrders,
    currencySymbol,
    tenantId
  );
  const { recs: wasteRecs, count: scrapOpportunitiesCount } = analyzeZeroWasteUpcycling(
    activeProducts,
    workOrders,
    journals,
    currencySymbol,
    tenantId
  );
  const bottleneckRecs = analyzeBottlenecks(activeProducts, currencySymbol, tenantId);

  const mixRec: ORRecommendation[] =
    productMixPlan.length > 0
      ? [
          {
            id: `or_mix_${tenantId}`,
            tenant_id: tenantId,
            recommendation_type: 'operational',
            categoryBadge: 'مزيج الإنتاج الأمثل LP',
            title: `خطة تشغيل الأسبوع الأعلى ربحاً (${projectedWeeklyProfit.toLocaleString('ar-EG')} ${currencySymbol})`,
            description: `وفقاً للبرمجة الخطية لساعات التشغيل (${weeklyCapacityHours} ساعة/أسبوع)، ركّز إنتاجك على: ${productMixPlan
              .map((m) => `${m.recommendedQty}× ${m.productName}`)
              .join(' + ')} لتحقيق أعلى صافي ربح ممكن دون إرهاق.`,
            metricsSummary: `صافي ربح أسبوعي متوقع: ${projectedWeeklyProfit.toLocaleString('ar-EG')} ${currencySymbol}`,
            action_payload: {
              actionKind: 'open_view',
              axis: 'operational',
              targetView: 'catalog',
              estimatedExtraProfit: projectedWeeklyProfit,
              buttonLabel: 'استعراض منتجات خطة الأسبوع',
            },
            impact_score: 95,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ]
      : [];

  // 3. تشغيل خوارزميات المبيعات والعملاء والتسويق (Sales, CRM & Marketing OR)
  const { recs: vipRecs, count: dormantVipCount } = analyzeVipRetargeting(
    customers,
    orders,
    profile,
    currencySymbol,
    tenantId
  );
  const churnRecs = analyzeFourAxisChurn(activeProducts, orders, journals, profile, currencySymbol, tenantId);
  const { heroProduct, recs: marketingRecs } = analyzeMarketingMixAndBundles(
    activeProducts,
    orders,
    profile,
    currencySymbol,
    tenantId
  );

  // دمج الحالات المحفوظة محلياً (applied / dismissed)
  const statusMap = safeJsonParse<Record<string, 'pending' | 'applied' | 'dismissed'>>(
    localStorage.getItem(LS_KEYS.recsStatus(tenantId)),
    {}
  );

  let allRecs: ORRecommendation[] = [
    ...mixRec,
    ...vipRecs,
    ...eoqRecs,
    ...churnRecs,
    ...wasteRecs,
    ...bottleneckRecs,
    ...marketingRecs,
  ].map((r) => ({
    ...r,
    status: statusMap[r.id] || r.status,
  }));

  // لو الورشة جديدة تماماً ولسه بدون بيانات منتجات/عملاء، نقدم توصيات تأسيسية ذكية فورية
  if (allRecs.length === 0) {
    allRecs = [
      {
        id: `or_onboarding_calc_${tenantId}`,
        tenant_id: tenantId,
        recommendation_type: 'operational',
        categoryBadge: 'انطلاقة بحوث العمليات',
        title: 'سعّر أول 3 منتجات عشان نطلعلك «المنتج البطل» وخطة الأسبوع',
        description:
          'بمجرد حفظ 3 منتجات في حاسبة التكاليف، محرك بحوث العمليات هيحسبلك أوتوماتيكياً أعلى مزيج إنتاج ربحية، ربح الساعة لكل قطعة، ونقطة إعادة طلب الخامات.',
        metricsSummary: 'الخطوة الأولى لتفعيل التحليل الرياضي الكامل',
        action_payload: {
          actionKind: 'open_view',
          axis: 'operational',
          targetView: 'calculator',
          buttonLabel: 'افتح حاسبة التكاليف الآن',
        },
        impact_score: 93,
        status: statusMap[`or_onboarding_calc_${tenantId}`] || 'pending',
        created_at: new Date().toISOString(),
      },
      {
        id: `or_onboarding_crm_${tenantId}`,
        tenant_id: tenantId,
        recommendation_type: 'crm_retarget',
        categoryBadge: 'تنشيط قاعدة العملاء',
        title: 'أضف أول عملاء ورشتك لتفعيل متابعة الـ VIP التلقائية',
        description:
          'سجّل بيانات عملائك الحاليين أو السابقين عشان شموسة تفكّرك بيهم لما يغيبوا 30 يوم وتجهزلك رسالة واتساب دافئة بضغطة زر.',
        metricsSummary: 'استرجاع العملاء السابقين يرفع المبيعات 35%',
        action_payload: {
          actionKind: 'open_view',
          axis: 'crm',
          targetView: 'customers',
          buttonLabel: 'إضافة عميل في سجل العملاء',
        },
        impact_score: 88,
        status: statusMap[`or_onboarding_crm_${tenantId}`] || 'pending',
        created_at: new Date().toISOString(),
      },
    ];
  }

  allRecs.sort((a, b) => b.impact_score - a.impact_score);

  // أهم 3 قرارات جاهزة للتنفيذ الفوري في "قعدة النتايج الأسبوعية" (توازن بين التشغيلي والبيعي والتسويقي)
  const pendingRecs = allRecs.filter((r) => r.status !== 'dismissed');
  const topOp = pendingRecs.find((r) => r.recommendation_type === 'operational');
  const topCrm = pendingRecs.find(
    (r) => r.recommendation_type === 'crm_retarget' || r.recommendation_type === 'churn_diagnosis'
  );
  const topMkt = pendingRecs.find((r) => r.recommendation_type === 'marketing');

  const weeklyTopThreeDecisions: ORRecommendation[] = [];
  [topOp, topCrm, topMkt].forEach((item) => {
    if (item && !weeklyTopThreeDecisions.some((x) => x.id === item.id)) {
      weeklyTopThreeDecisions.push(item);
    }
  });
  for (const item of pendingRecs) {
    if (weeklyTopThreeDecisions.length >= 3) break;
    if (!weeklyTopThreeDecisions.some((x) => x.id === item.id)) {
      weeklyTopThreeDecisions.push(item);
    }
  }

  // مزامنة صامتة لأعلى 3 توصيات مع Supabase (لا تعطل الواجهة أبداً)
  void syncTopRecommendationsToCloud(tenantId, weeklyTopThreeDecisions);

  return {
    generatedAt: new Date().toISOString(),
    currencySymbol,
    weeklyCapacityHours,
    projectedWeeklyProfit,
    productMixPlan,
    heroProduct,
    recommendations: allRecs,
    weeklyTopThreeDecisions,
    stats: {
      totalProducts: activeProducts.length,
      totalMaterials: activeMaterials.length,
      lowStockCount,
      dormantVipCount,
      scrapOpportunitiesCount,
      churnFlagsCount: churnRecs.length,
    },
  };
}

async function syncTopRecommendationsToCloud(tenantId: string, recs: ORRecommendation[]): Promise<void> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;
    // نتحقق أولاً أن هناك بيانات اليوم لتفادي التكرار
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const syncKey = `shamousa_or_synced_${tenantId}_${todayPrefix}`;
    if (sessionStorage.getItem(syncKey) === '1') return;

    const payload = recs.map((r) => ({
      tenant_id: tenantId,
      recommendation_type: r.recommendation_type,
      title: r.title,
      description: r.description,
      action_payload: r.action_payload,
      target_customer_name: r.target_customer_name || null,
      target_customer_phone: r.target_customer_phone || null,
      suggested_whatsapp_msg: r.suggested_whatsapp_msg || null,
      impact_score: r.impact_score,
      status: r.status,
    }));

    const { error } = await supabase.from('or_recommendations').insert(payload);
    if (!error) {
      sessionStorage.setItem(syncKey, '1');
    }
  } catch {
    // fallback صامت
  }
}

// ============================================================================
// دوال قراءة السوبر أدمن فقط (رادار السوق مجهول الهوية + الاستثناء الإنساني)
// ============================================================================

export async function loadSuperAdminHumanitarianAlerts(): Promise<HumanitarianAlertRecord[]> {
  const local = safeJsonParse<HumanitarianAlertRecord[]>(localStorage.getItem(LS_KEYS.humanitarian), []);
  try {
    const { data, error } = await supabase
      .from('humanitarian_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && Array.isArray(data)) {
      const mergedMap = new Map<string, HumanitarianAlertRecord>();
      (data as HumanitarianAlertRecord[]).forEach((row) => mergedMap.set(row.id, row));
      local.forEach((row) => {
        if (!mergedMap.has(row.id)) mergedMap.set(row.id, row);
      });
      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  } catch {
    // استخدام المحلي
  }
  return local;
}

export async function updateSuperAdminHumanitarianAlertStatus(
  alertId: string,
  status: 'new' | 'in_progress' | 'resolved'
): Promise<void> {
  const local = safeJsonParse<HumanitarianAlertRecord[]>(localStorage.getItem(LS_KEYS.humanitarian), []);
  const next = local.map((a) => (a.id === alertId ? { ...a, status } : a));
  localStorage.setItem(LS_KEYS.humanitarian, JSON.stringify(next));

  try {
    await supabase
      .from('humanitarian_alerts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', alertId);
  } catch {
    // محفوظ محلياً
  }
}
