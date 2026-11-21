import type { OROverviewReport, ORRecommendationType } from './orEngine';

export interface ShamousaExplainPayload {
  id: string;
  source: 'task' | 'appointment' | 'result' | 'or360';
  category?: string;
  title: string;
  detail: string;
  metricsSummary?: string;
  targetView?: string;
  actionLabel?: string;
}

export interface ShamousaAskedTopicRecord {
  id: string;
  source: ShamousaExplainPayload['source'];
  category: string;
  title: string;
  detail: string;
  askedAt: string;
  count: number;
}

export interface ShamousaOrSnapshot {
  updatedAt: string;
  projectedWeeklyProfit: number;
  currencySymbol: string;
  heroProductName?: string;
  lowStockCount: number;
  dormantVipCount: number;
  scrapOpportunitiesCount: number;
  topDecisions: Array<{
    id: string;
    type: ORRecommendationType;
    title: string;
    metricsSummary?: string;
    impactScore: number;
  }>;
}

export interface ShamousaOrMemoryState {
  readIds: string[];
  dismissedIds: string[];
  askedTopics: ShamousaAskedTopicRecord[];
  /** وزن الاهتمام المكتسب لكل محور بحوث عمليات بناءً على أسئلة المستخدم (?) */
  categoryInterestBoost: Record<string, number>;
  latestOrSnapshot?: ShamousaOrSnapshot;
  learningCycleCount: number;
  updatedAt: string;
}

const MEMORY_KEY = (tenantId: string) =>
  `alshams_shamousa_or_memory_${tenantId || 'default'}`;

function defaultMemory(): ShamousaOrMemoryState {
  return {
    readIds: [],
    dismissedIds: [],
    askedTopics: [],
    categoryInterestBoost: {},
    learningCycleCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function loadShamousaOrMemory(tenantId: string): ShamousaOrMemoryState {
  if (typeof window === 'undefined') return defaultMemory();
  try {
    const raw = localStorage.getItem(MEMORY_KEY(tenantId));
    if (!raw) return defaultMemory();
    const parsed = JSON.parse(raw) as Partial<ShamousaOrMemoryState>;
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
      dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
      askedTopics: Array.isArray(parsed.askedTopics) ? parsed.askedTopics : [],
      categoryInterestBoost:
        parsed.categoryInterestBoost && typeof parsed.categoryInterestBoost === 'object'
          ? parsed.categoryInterestBoost
          : {},
      latestOrSnapshot: parsed.latestOrSnapshot,
      learningCycleCount: Number(parsed.learningCycleCount || 0),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return defaultMemory();
  }
}

function saveMemory(tenantId: string, state: ShamousaOrMemoryState): ShamousaOrMemoryState {
  const next: ShamousaOrMemoryState = {
    ...state,
    readIds: Array.from(new Set(state.readIds)).slice(-200),
    dismissedIds: Array.from(new Set(state.dismissedIds)).slice(-200),
    askedTopics: state.askedTopics.slice(0, 35),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(MEMORY_KEY(tenantId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('alshams_shamousa_memory_updated', { detail: { tenantId } }));
  } catch {
    // تجاهل صامت لو التخزين ممتلئ
  }
  return next;
}

export function toggleItemReadInMemory(
  tenantId: string,
  itemId: string,
  forceValue?: boolean
): ShamousaOrMemoryState {
  const mem = loadShamousaOrMemory(tenantId);
  const exists = mem.readIds.includes(itemId);
  const shouldBeRead = typeof forceValue === 'boolean' ? forceValue : !exists;
  const readIds = shouldBeRead
    ? [...mem.readIds, itemId]
    : mem.readIds.filter((x) => x !== itemId);
  return saveMemory(tenantId, { ...mem, readIds });
}

export function markManyReadInMemory(
  tenantId: string,
  itemIds: string[]
): ShamousaOrMemoryState {
  const mem = loadShamousaOrMemory(tenantId);
  return saveMemory(tenantId, {
    ...mem,
    readIds: [...mem.readIds, ...itemIds],
  });
}

export function dismissItemInMemory(
  tenantId: string,
  itemId: string
): ShamousaOrMemoryState {
  const mem = loadShamousaOrMemory(tenantId);
  return saveMemory(tenantId, {
    ...mem,
    dismissedIds: [...mem.dismissedIds, itemId],
    readIds: [...mem.readIds, itemId],
  });
}

export function dismissManyInMemory(
  tenantId: string,
  itemIds: string[]
): ShamousaOrMemoryState {
  const mem = loadShamousaOrMemory(tenantId);
  return saveMemory(tenantId, {
    ...mem,
    dismissedIds: [...mem.dismissedIds, ...itemIds],
    readIds: [...mem.readIds, ...itemIds],
  });
}

export function restoreDismissedInMemory(
  tenantId: string,
  itemIds?: string[]
): ShamousaOrMemoryState {
  const mem = loadShamousaOrMemory(tenantId);
  const dismissedIds = itemIds
    ? mem.dismissedIds.filter((id) => !itemIds.includes(id))
    : [];
  return saveMemory(tenantId, { ...mem, dismissedIds });
}

/**
 * تسجيل سؤال المستخدم عبر علامة الاستفهام (؟) في ذاكرة شموسة + رفع أولوية المحور في بحوث العمليات القادمة
 */
export function recordShamousaQuestionFromPanel(
  tenantId: string,
  payload: ShamousaExplainPayload
): ShamousaOrMemoryState {
  const mem = loadShamousaOrMemory(tenantId);
  const category = (payload.category || payload.source || 'general').trim();
  const existingIdx = mem.askedTopics.findIndex((t) => t.id === payload.id);

  let nextAsked: ShamousaAskedTopicRecord[];
  if (existingIdx >= 0) {
    const updated: ShamousaAskedTopicRecord = {
      ...mem.askedTopics[existingIdx],
      count: mem.askedTopics[existingIdx].count + 1,
      askedAt: new Date().toISOString(),
    };
    nextAsked = [updated, ...mem.askedTopics.filter((_, i) => i !== existingIdx)];
  } else {
    nextAsked = [
      {
        id: payload.id,
        source: payload.source,
        category,
        title: payload.title,
        detail: payload.detail,
        askedAt: new Date().toISOString(),
        count: 1,
      },
      ...mem.askedTopics,
    ];
  }

  const prevBoost = Number(mem.categoryInterestBoost[category] || 0);
  const nextBoostMap = {
    ...mem.categoryInterestBoost,
    [category]: Math.min(18, prevBoost + 5),
  };

  return saveMemory(tenantId, {
    ...mem,
    readIds: [...mem.readIds, payload.id],
    askedTopics: nextAsked,
    categoryInterestBoost: nextBoostMap,
    learningCycleCount: mem.learningCycleCount + 1,
  });
}

/**
 * تغذية ذاكرة شموسة أوتوماتيكياً بأحدث مخرجات بحوث العمليات (OR 360)
 */
export function saveLatestOrSnapshotToShamousaMemory(
  tenantId: string,
  report: OROverviewReport
): void {
  const mem = loadShamousaOrMemory(tenantId);
  const snapshot: ShamousaOrSnapshot = {
    updatedAt: report.generatedAt,
    projectedWeeklyProfit: report.projectedWeeklyProfit,
    currencySymbol: report.currencySymbol,
    heroProductName: report.heroProduct?.name,
    lowStockCount: report.stats.lowStockCount,
    dormantVipCount: report.stats.dormantVipCount,
    scrapOpportunitiesCount: report.stats.scrapOpportunitiesCount,
    topDecisions: (report.weeklyTopThreeDecisions || []).slice(0, 4).map((r) => ({
      id: r.id,
      type: r.recommendation_type,
      title: r.title,
      metricsSummary: r.metricsSummary,
      impactScore: r.impact_score,
    })),
  };
  saveMemory(tenantId, {
    ...mem,
    latestOrSnapshot: snapshot,
  });
}

/**
 * بناء ملخص الذاكرة المتبادلة بين شموسة وبحوث العمليات لإرساله في سياق كل محادثة ذكية
 */
export function buildShamousaMemoryPromptContext(tenantId: string): string {
  const mem = loadShamousaOrMemory(tenantId);
  const parts: string[] = [];

  parts.push(
    'تعليمات التعلّم المستمر لشموسة: تعلّمي دائماً من نتائج بحوث العمليات وأسئلة صاحب الورشة/المورد السابقة، وفسّري الأرقام والمصطلحات بلغة مصرية سهلة وعملية مع 2-3 خطوات فورية قابلة للتنفيذ، ولا تكرري التوصيات التي استبعدها.'
  );

  if (mem.latestOrSnapshot) {
    const snap = mem.latestOrSnapshot;
    const decisionsTxt = snap.topDecisions
      .map((d, i) => `${i + 1}) ${d.title}${d.metricsSummary ? ` (${d.metricsSummary})` : ''}`)
      .join(' | ');
    parts.push(
      `[أحدث نتائج بحوث العمليات للورشة] الربح الأسبوعي الأمثل: ${snap.projectedWeeklyProfit} ${snap.currencySymbol} | المنتج البطل: ${snap.heroProductName || 'غير محدد'} | خامات قرب النفاد: ${snap.lowStockCount} | عملاء VIP غائبون: ${snap.dormantVipCount} | فرص استغلال البواقي: ${snap.scrapOpportunitiesCount} | أهم القرارات: ${decisionsTxt || 'لا يوجد'}`
    );
  }

  if (mem.askedTopics.length > 0) {
    const recentAsked = mem.askedTopics
      .slice(0, 5)
      .map((t) => `• ${t.title} (${t.source})`)
      .join(' ');
    parts.push(`[موضوعات استفسر عنها المستخدم سابقاً بعلامة (؟) وتهمّه]: ${recentAsked}`);
  }

  const boostedCats = Object.entries(mem.categoryInterestBoost)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, score]) => `${cat} (+${score})`)
    .join('، ');
  if (boostedCats) {
    parts.push(`[أولويات التعلّم الحالية في ذاكرة شموسة]: ${boostedCats} (دورة تعلّم #${mem.learningCycleCount})`);
  }

  return parts.join('\n');
}

/**
 * شرح فوري ذكي باللهجة المصرية لو المستخدم ضغط (؟) وحصل تأخير أو انقطاع في الاتصال بالذكاء الاصطناعي
 */
export function buildInstantFallbackExplanation(
  payload: ShamousaExplainPayload,
  firstName: string,
  isSupplier: boolean
): string {
  const sourceAr =
    payload.source === 'or360'
      ? 'بحوث العمليات'
      : payload.source === 'result'
      ? 'نتائج الأسبوع'
      : payload.source === 'appointment'
      ? 'أجندة المواعيد'
      : 'مهام اليوم';

  return [
    `من عيوني يا **${firstName}** ☀️ خليني أبسطلك النقطة دي من **${sourceAr}** بكلمتين واضحين:`,
    '',
    `📌 **معنى التنبيه:** ${payload.title}`,
    `🔍 **اللي بيحصل فعلياً:** ${payload.detail}`,
    payload.metricsSummary ? `📊 **المؤشر الرقمي:** ${payload.metricsSummary}` : '',
    '',
    `✅ **تعمل إيه دلوقتي خطوة بخطوة:**`,
    `1) راجع النقطة دي في ${isSupplier ? 'شاشة المتجر أو المخازن' : 'شاشة الورشة المختصة'} وتأكد من الأرقام الفعلية.`,
    `2) نفّذ الخطوة المقترحة ولو محتاج نعدّلها حسب ظروفك الحالية احكيلي التفاصيل هنا في الشات.`,
    `3) أنا سجّلت اهتمامك بالموضوع ده في ذاكرتي عشان التحليلات الجاية تطلعلك أدق وأعلى كمان! ✨`,
  ]
    .filter(Boolean)
    .join('\n');
}
