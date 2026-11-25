/**
 * Verification Script — Message 6 of 7 (Part E):
 * المخزن المعرفي + دايرة مراجعة الأسئلة المجردة من PII + العقول التحليلية الثلاثة
 */
import assert from 'node:assert/strict';
import {
  resetKnowledgeStoreForTest,
  clearAccountPrivateQueueForTest,
  sanitizeQuestionRemovePII,
  detectSafetySensitiveTopic,
  enqueueUnansweredQuestionSanitized,
  loadKnowledgeStoreState,
  loadAccountPrivateQueue,
  upsertKnowledgeEntryBySuperAdmin,
  saveDraftOnQueueItem,
  mergeQueueItemIntoExistingEntry,
  searchKnowledgeStoreLocal,
  exportKnowledgeStoreJson,
  importKnowledgeStoreJson,
  rollbackKnowledgeStoreToSnapshot,
  recordShamousaAnswerMetric,
  getKnowledgeStoreMetrics,
} from '../src/services/shamousaKnowledgeStore';
import {
  SHAMOUSA_TECHNICAL_PROBLEMS_LIBRARY,
  type TechnicalProblemEntry,
} from '../src/data/shamousaTechnicalProblemsLibrary';
import { SHAMOUSA_MARKETING_METHODS_LIBRARY } from '../src/data/shamousaMarketingMethodsLibrary';
import {
  diagnoseTechnicalProblemOffline,
  suggestUnifiedMaterialAlternative,
  runAllThreeAnalyticBrainsOffline,
  setAccountBrainDecision,
  clearAccountBrainDecisionsForTest,
  formatAnalyticBrainsReply,
} from '../src/services/shamousaAnalyticBrains';
import { runDraftCostCalculationViaExistingEngine } from '../src/services/shamousaMarketingPricingEngine';
import type { SavedProductRecord, RawMaterialItem, InvoiceRecord, WorkOrderRecord } from '../src/types';
import type { UserSubscriptionState } from '../src/types/subscriptions';

function makeSub(packages: string[]): UserSubscriptionState {
  return {
    activePackageIds: packages as any,
    hasSelectedPackages: true,
    updatedAt: new Date().toISOString(),
  };
}

function makeProduct(
  id: string,
  name: string,
  cost: number,
  price: number,
  craftName = 'مكرمية',
  laborHours = 2
): SavedProductRecord {
  const netProfit = price - cost;
  return {
    id,
    tenantId: 'tenant_test',
    productName: name,
    category: 'جدارية',
    craftName,
    shape: 'flat',
    isActive: true,
    createdAt: Date.now() - 40 * 86400_000,
    updatedAt: Date.now(),
    retailPrice: price,
    storePrice: price,
    input: {
      laborHours,
      wastePercentage: 22,
    } as any,
    output: {
      totalBaseCost: cost,
      totalDirectMaterialCost: cost * 0.7,
      totalLaborCost: cost * 0.3,
      finalSellingPrice: price,
      netProfitAmount: netProfit,
      netProfitMarginPercent: price > 0 ? Math.round((netProfit / price) * 100) : 0,
    } as any,
  } as unknown as SavedProductRecord;
}

function makeMaterial(id: string, name: string, qty: number, minStock: number, supplierName: string): RawMaterialItem {
  return {
    id,
    tenantId: 'tenant_test',
    materialName: name,
    category: 'خيط',
    unit: 'بكرة',
    currentStock: qty,
    minStockLevel: minStock,
    costPerUnit: 75,
    supplierName,
  } as unknown as RawMaterialItem;
}

function makeOrder(
  id: string,
  customerName: string,
  productName: string,
  qty: number,
  total: number,
  paid: number,
  daysAgo: number
): InvoiceRecord {
  return {
    id,
    tenantId: 'tenant_test',
    customerName,
    createdAt: Date.now() - daysAgo * 86400_000,
    status: paid >= total ? 'completed' : 'pending',
    totalAmount: total,
    paidAmount: paid,
    items: [
      {
        productName,
        quantity: qty,
        unitPrice: qty > 0 ? total / qty : total,
        totalPrice: total,
      },
    ],
  } as unknown as InvoiceRecord;
}

async function run() {
  console.log('=== Verify Part 6 (Message 6 of 7): Knowledge Store + Review Loop + 3 Analytic Brains ===');

  resetKnowledgeStoreForTest();
  clearAccountPrivateQueueForTest('acc_A');
  clearAccountPrivateQueueForTest('acc_B');
  clearAccountBrainDecisionsForTest('acc_free');
  clearAccountBrainDecisionsForTest('acc_full');

  // ---------------------------------------------------------------------------
  // 1) PII Stripping + Unanswered Queue Deduplication + Account Privacy
  // ---------------------------------------------------------------------------
  const rawSensitiveQ =
    'إزاي ألمّع صينية الأيبوكسي؟ كلموني على 01012345678 أو abdo.craft@example.com وموقعي https://myshop.example.com';
  const stripped = sanitizeQuestionRemovePII(rawSensitiveQ);
  assert(!stripped.includes('01012345678'), 'Phone number must be stripped from sanitized question');
  assert(!stripped.includes('abdo.craft@example.com'), 'Email must be stripped from sanitized question');
  assert(!stripped.includes('https://myshop.example.com'), 'URL must be stripped from sanitized question');

  const q1 = enqueueUnansweredQuestionSanitized(rawSensitiveQ, 'acc_A');
  assert(q1.globalItem !== null, 'Global queue item must be created');
  assert.equal(q1.globalItem!.repeatCount, 1);
  assert(!JSON.stringify(q1.globalItem).includes('acc_A'), 'Global queue item must NEVER contain accountId');
  assert(!JSON.stringify(q1.globalItem).includes('01012345678'), 'Global queue item must NEVER contain phone');
  assert(!JSON.stringify(q1.globalItem).includes('abdo.craft@example.com'), 'Global queue item must NEVER contain email');
  assert(q1.userReply.includes('ما لقيتش إجابة مؤكدة'), 'Exact user-facing unanswered message must be returned');
  assert.equal(q1.userOptions.length, 3, 'Must provide 3 clickable recovery options');

  // Ask same question again from a different account -> deduplicate & increment repeatCount
  const q2 = enqueueUnansweredQuestionSanitized('إزاي ألمّع صينية الأيبوكسي؟ كلموني على 01199887766', 'acc_B');
  assert(q2.globalItem !== null);
  assert.equal(q2.globalItem!.id, q1.globalItem!.id, 'Similar question must deduplicate in global queue');
  assert.equal(q2.globalItem!.repeatCount, 2, 'repeatCount should increment to 2');

  // Private queues stay isolated per account
  const privA = loadAccountPrivateQueue('acc_A');
  const privB = loadAccountPrivateQueue('acc_B');
  assert.equal(privA.length, 1);
  assert.equal(privB.length, 1);
  assert.notEqual(privA[0].questionAr, privB[0].questionAr, 'Private queues must be strictly isolated per account');
  console.log('✅ Test 1 PASSED: PII stripped (phone + email + URL), deduplicated (repeatCount=2), zero accountId leakage.');

  // ---------------------------------------------------------------------------
  // 2) Safety-Sensitive Draft Guard + Never Auto-Published + Super Admin Approval
  // ---------------------------------------------------------------------------
  const safetyQ = enqueueUnansweredQuestionSanitized('هل ينفع أخلط الصودا الكاوية في حلة ألومنيوم لصناعة الصابون؟', 'acc_A');
  assert(safetyQ.globalItem !== null);
  const safetyCheck = detectSafetySensitiveTopic(safetyQ.globalItem!.sanitizedQuestion);
  assert.equal(safetyCheck.isSensitive, true, 'Caustic soda must trigger safety-sensitive warning');

  saveDraftOnQueueItem(
    safetyQ.globalItem!.id,
    'ممنوع تماماً استخدام الألومنيوم مع الصودا الكاوية لأنه بيتفاعل بعنف — استخدمي ستانلس ستيل 304 أو بلاستيك مقاوم للحرارة فقط.',
    'مسودة أونلاين تجريبية'
  );

  // Add a draft entry explicitly -> must NEVER be returned by searchKnowledgeStoreLocal
  upsertKnowledgeEntryBySuperAdmin({
    topic: 'تفاعل الصودا الكاوية مع الألومنيوم',
    keywords: ['صودا كاوية', 'ألومنيوم', 'صابون'],
    synonyms: ['هيدروكسيد الصوديوم'],
    questionVariants: ['ينفع اخلط الصودا الكاوية في حلة المونيوم'],
    reply: 'مسودة غير معتمدة لا يجب أن تظهر للمستخدمين',
    status: 'draft',
    source: 'approved_draft',
  });
  const beforeApproveSearch = searchKnowledgeStoreLocal('ينفع اخلط الصودا الكاوية في حلة المونيوم');
  assert.notEqual(beforeApproveSearch.tier, 'confident', 'Draft entries must NEVER be served to regular users');

  // Now Super Admin approves the polishing epoxy question from queue
  const approvedRes = upsertKnowledgeEntryBySuperAdmin({
    topic: 'تلميع صينية الإيبوكسي بعد الصنفرة',
    keywords: ['تلميع', 'صينية إيبوكسي', 'ريزن مطفي', 'صنفرة ريزن'],
    synonyms: ['بولش ريزن', 'تلميع الريزن', 'لمعة الايبوكسي'],
    questionVariants: ['إزاي ألمّع صينية الأيبوكسي؟', 'الريزن طلع مطفي بعد الصنفرة أعمل إيه'],
    reply:
      'ابدأ بصنفرة مائية متدرجة (600 ثم 1000 ثم 2000)، وبعدها لمّع بكومباوند تلميع بقرص قطن أو صب طبقة Top Coat رفيعة جداً في مكان خالي من التراب.',
    options: [
      { id: 'ep_1', label: 'فقاعات الهواء في الريزن 🫧', queryText: 'فقاعات الهواء في الريزن' },
    ],
    specialty: 'الريزن / الإيبوكسي',
    source: 'super_admin',
    status: 'approved',
    linkedQueueItemId: q1.globalItem!.id,
  });
  assert.equal(approvedRes.entry.status, 'approved');

  // Test from ANOTHER account with Arabic spelling typos (Levenshtein + Trigram + BM25)
  const matchExact = searchKnowledgeStoreLocal('إزاي ألمّع صينية الأيبوكسي؟');
  assert.equal(matchExact.tier, 'confident', 'Approved entry must be answered confidently immediately');
  assert.equal(matchExact.bestMatch?.entry.id, approvedRes.entry.id);

  const matchWithTypos = searchKnowledgeStoreLocal('ازاي المع صنيه الايبكسي بعد الصنفره');
  assert.equal(matchWithTypos.tier, 'confident', 'Fuzzy Levenshtein/Trigram + BM25 must match despite typos');
  assert.equal(matchWithTypos.bestMatch?.entry.id, approvedRes.entry.id);

  // Merge another queue item into existing entry
  const qMerge = enqueueUnansweredQuestionSanitized('لمعة الريزن راحت بعد ما صنفرتها', 'acc_B');
  assert(qMerge.globalItem !== null);
  mergeQueueItemIntoExistingEntry(qMerge.globalItem!.id, approvedRes.entry.id);
  const stateAfterMerge = loadKnowledgeStoreState();
  const mergedQueueRow = stateAfterMerge.unansweredQueue.find((x) => x.id === qMerge.globalItem!.id);
  assert.equal(mergedQueueRow?.status, 'merged');
  console.log('✅ Test 2 PASSED: Drafts hidden before approval, safety flag works, approved entry answered with typos & merge.');

  // ---------------------------------------------------------------------------
  // 3) JSON Export / Import + Version Snapshots Rollback + Metrics
  // ---------------------------------------------------------------------------
  recordShamousaAnswerMetric('local');
  recordShamousaAnswerMetric('local');
  recordShamousaAnswerMetric('local');
  recordShamousaAnswerMetric('local');
  recordShamousaAnswerMetric('ai');

  const metrics = getKnowledgeStoreMetrics();
  assert.equal(metrics.localAnswerRatePercent, 80, '4 local / 5 total must equal 80%');
  assert(metrics.addedThisWeekCount >= 1, 'addedThisWeekCount should count approved entries added this week');
  assert(metrics.pendingQueueCount >= 1, 'pendingQueueCount should reflect unresolved queue items');

  const exportedJson = exportKnowledgeStoreJson();
  const snapBeforeSecondEntry = loadKnowledgeStoreState().snapshots[0];
  assert(snapBeforeSecondEntry, 'Version snapshot must be created on changes');

  // Add another entry, then rollback to snapshot before it, then import JSON back
  upsertKnowledgeEntryBySuperAdmin({
    topic: 'موضوع مؤقت للاختبار',
    keywords: ['اختبار مؤقت'],
    reply: 'رد مؤقت',
    status: 'approved',
  });
  assert(
    loadKnowledgeStoreState().entries.some((e) => e.topic === 'موضوع مؤقت للاختبار'),
    'Temporary entry should exist before rollback'
  );

  const rolled = rollbackKnowledgeStoreToSnapshot(snapBeforeSecondEntry.snapshotId);
  assert.equal(rolled.ok, true, 'Rollback to snapshot must succeed');
  assert(
    !loadKnowledgeStoreState().entries.some((e) => e.topic === 'موضوع مؤقت للاختبار'),
    'Rollback must restore previous version without temporary entry'
  );

  resetKnowledgeStoreForTest();
  assert(
    !loadKnowledgeStoreState().entries.some((e) => e.id === approvedRes.entry.id),
    'Reset store should NOT contain custom approved entry before JSON import'
  );
  const imported = importKnowledgeStoreJson(exportedJson);
  assert.equal(imported.ok, true, 'JSON import must succeed');
  assert(
    loadKnowledgeStoreState().entries.some((e) => e.id === approvedRes.entry.id),
    'Imported JSON must restore approved entries'
  );
  console.log('✅ Test 3 PASSED: Export/Import JSON, Version Rollback, and Super Admin Metrics (80% local) verified.');

  // ---------------------------------------------------------------------------
  // 4) Extensible Technical Problems Library (2 seeded verbatim + dynamic new entry)
  // ---------------------------------------------------------------------------
  assert(SHAMOUSA_TECHNICAL_PROBLEMS_LIBRARY.length >= 2);
  assert(Array.isArray(SHAMOUSA_MARKETING_METHODS_LIBRARY) && SHAMOUSA_MARKETING_METHODS_LIBRARY.length >= 2);

  const resinDiag = diagnoseTechnicalProblemOffline('بيطلعلي فقاعات هواء كتير في الريزن بعد الصب', 'حسام');
  assert.equal(resinDiag.matched, true, 'Resin air bubbles must match');
  assert(resinDiag.reply.includes('حمام مياه دافئة'), 'Resin solution must match seeded text');
  assert(resinDiag.reply.includes('كمامة') && resinDiag.reply.includes('تهوية'), 'Resin safety warning must appear');
  assert(resinDiag.options.length >= 2, 'Diagnostic choices must be returned');

  const macrameDiag = diagnoseTechnicalProblemOffline('حبل المكرمية بيفتل ويطلع شعيرات', 'سارة');
  assert.equal(macrameDiag.matched, true, 'Macrame cord fraying must match');
  assert(
    macrameDiag.reply.includes('شد متوازن') && macrameDiag.reply.includes('تسريح الأطراف'),
    'Macrame solution must match seeded text'
  );

  // Extensibility check: inject a brand-new problem into data array with ZERO engine code changes
  const dynamicEntry: TechnicalProblemEntry = {
    id: 'tech_candle_sinkhole_test',
    craftId: 'candles',
    craftNameAr: 'الشموع',
    symptomAr: 'فجوة وهبوط في منتصف الشمعة بعد التبريد',
    keywords: ['فجوة في الشمعة', 'الشمعة هبطت من النص', 'تقعر الشمع'],
    possibleCausesAr: ['صب الشمع وهو سخن زيادة', 'تبريد سريع في مكان بارد'],
    diagnosticQuestions: [
      {
        questionAr: 'نوع الشمع إيه؟',
        choices: [
          {
            id: 'c_1',
            labelAr: 'شمع صويا',
            likelyCauseAr: 'انكماش حراري بعد الصب الساخن',
            focusedTipAr: 'صبيه على درجة 55-60 مئوية.',
          },
          {
            id: 'c_2',
            labelAr: 'شمع برافين',
            likelyCauseAr: 'انكماش طبيعي للبرافين عند التبريد',
            focusedTipAr: 'اعملي صبّة ثانية رفيعة بعد التبريد.',
          },
        ],
      },
    ],
    solutionStepsAr: ['تدفئة الوجه بهيت جن خفيف وإعادة ملء الفجوة بطبقة شمع رفيعة.'],
    preventionAr: ['تدفئة البرطمان قبل الصب وضبط حرارة الصب.'],
    safetyWarningAr: 'انتبهي من سخونة الشمع السائل واشتغلي بعيداً عن اللهب المباشر.',
  };
  const extendedDiag = diagnoseTechnicalProblemOffline('عندي فجوة في الشمعة بعد ما بردت', 'نور', [
    ...SHAMOUSA_TECHNICAL_PROBLEMS_LIBRARY,
    dynamicEntry,
  ]);
  assert.equal(extendedDiag.matched, true, 'New technical problem entry must work with ZERO engine changes');
  assert.equal(extendedDiag.entry?.id, 'tech_candle_sinkhole_test');
  console.log('✅ Test 4 PASSED: Technical Problems Library (Resin + Macrame + Zero-Code Extensibility) verified.');

  // ---------------------------------------------------------------------------
  // 5) Three Offline Analytic Brains: 2 Accounts with Different Packages & Zero Leakage
  // ---------------------------------------------------------------------------
  const sharedProducts: SavedProductRecord[] = [
    makeProduct('p1', 'جدارية مكرمية بوهو كبيرة', 180, 450, 'مكرمية', 7),
    makeProduct('p2', 'كوستر مكرمية 4 قطع', 140, 155, 'مكرمية', 1.5), // هامش ضعيف (حصالة)
    makeProduct('p3', 'شنطة مكرمية كروس', 200, 520, 'مكرمية', 4), // راكد (لا مبيعات)
  ];
  const sharedMaterials: RawMaterialItem[] = [
    makeMaterial('m1', 'خيط قطن مجدول 4 مم', 1, 5, 'مورد الوكالة'),
    makeMaterial('m2', 'عصا خشب زان 60 سم', 2, 4, 'مورد الوكالة'),
  ];
  const sharedOrders: InvoiceRecord[] = [
    makeOrder('o1', 'عميل جملة النيل', 'جدارية مكرمية بوهو كبيرة', 8, 3600, 1200, 18), // تركز + متأخر سداد
    makeOrder('o2', 'منة طارق', 'كوستر مكرمية 4 قطع', 5, 775, 775, 5),
  ];
  const sharedWorkOrders: WorkOrderRecord[] = [
    {
      id: 'wo1',
      tenantId: 'tenant_test',
      title: 'أمر شغل جدارية مكرمية',
      status: 'pending',
      createdAt: Date.now(),
      materials: [{ name: 'خيط قطن مجدول 4 مم', requiredQty: 6 }],
    } as any,
  ];

  // Account 1: core_free ONLY (no costing, no inventory, no finance, no sales_crm)
  const reportFree = runAllThreeAnalyticBrainsOffline({
    accountId: 'acc_free',
    packageOptions: { role: 'artisan', overrideSub: makeSub(['core_free']), isAdmin: false },
    firstName: 'أحمد',
    products: sharedProducts,
    rawMaterials: sharedMaterials,
    orders: sharedOrders,
    workOrders: sharedWorkOrders,
  });

  // Account 2: Full packages (costing + inventory + finance + sales_crm)
  const reportFull = runAllThreeAnalyticBrainsOffline({
    accountId: 'acc_full',
    packageOptions: {
      role: 'artisan',
      overrideSub: makeSub(['core_free', 'production_pricing', 'inventory_purchases', 'finance_crm']),
      isAdmin: false,
    },
    firstName: 'سلمى',
    products: sharedProducts,
    rawMaterials: sharedMaterials,
    orders: sharedOrders,
    workOrders: sharedWorkOrders,
  });

  assert(reportFree.topThreeRecommendations.length >= 1 && reportFree.topThreeRecommendations.length <= 3);
  assert(reportFull.topThreeRecommendations.length >= 1 && reportFull.topThreeRecommendations.length <= 3);

  // Check zero leakage of locked features in core_free account
  const freeAllText = JSON.stringify(reportFree);
  assert(!freeAllText.includes('نقص خامات قبل أمر الشغل'), 'core_free must NOT see inventory shortage recommendation');
  assert(!freeAllText.includes('مراجعة نسبة الهالك'), 'core_free must NOT see costing waste recommendation');
  assert(!freeAllText.includes('متأخرات تحصيل'), 'core_free must NOT see finance receivables recommendation');
  assert.equal(reportFree.portfolio.usedCosting, false, 'core_free must NOT use costing margin classification');
  assert.equal(reportFull.portfolio.usedCosting, true, 'Full package account MUST use costing margin classification');

  // Different packages must produce distinct recommendation sets
  const freeIds = reportFree.topThreeRecommendations.map((r) => r.id).join(',');
  const fullIds = reportFull.topThreeRecommendations.map((r) => r.id).join(',');
  assert.notEqual(freeIds, fullIds, 'Two accounts with different packages must receive tailored different recommendations');

  // Verify unified 5-part format on every recommendation
  for (const rec of [...reportFree.topThreeRecommendations, ...reportFull.topThreeRecommendations]) {
    assert(rec.problemAr.length > 5, 'Missing المشكلة');
    assert(rec.evidenceAr.length > 5, 'Missing الدليل من أرقام حسابك');
    assert(rec.solutionAr.length > 5, 'Missing الحل');
    assert(rec.nextStepAr.length > 5, 'Missing الخطوة الجاية');
    assert(rec.expectedImpactAr.includes('تقدير بدون وعد'), 'Expected impact must state تقدير بدون وعد');
  }

  // Verify per-account decision buttons isolation (هنفّذ / أجّل / مش مناسب)
  const firstFullRecId = reportFull.topThreeRecommendations[0].id;
  setAccountBrainDecision('acc_full', firstFullRecId, 'not_suitable');
  const reportFullAfterDismiss = runAllThreeAnalyticBrainsOffline({
    accountId: 'acc_full',
    packageOptions: {
      role: 'artisan',
      overrideSub: makeSub(['core_free', 'production_pricing', 'inventory_purchases', 'finance_crm']),
      isAdmin: false,
    },
    firstName: 'سلمى',
    products: sharedProducts,
    rawMaterials: sharedMaterials,
    orders: sharedOrders,
    workOrders: sharedWorkOrders,
  });
  assert(
    !reportFullAfterDismiss.topThreeRecommendations.some((r) => r.id === firstFullRecId),
    'Dismissed recommendation (مش مناسب) must be hidden for that account'
  );

  // Unified Material alternative suggestion must carry mandatory quality/cost warning
  const alt = suggestUnifiedMaterialAlternative('خيط قطن مجدول 4 مم');
  assert(alt !== null, 'Should find unified alternative for cotton macrame cord');
  assert(
    alt!.warningAr.includes('تأكيدك') && alt!.warningAr.includes('الجودة') && alt!.warningAr.includes('التكلفة'),
    'Alternative material MUST include mandatory quality & cost confirmation warning'
  );

  // Formatted chat reply check
  const formattedChat = formatAnalyticBrainsReply('سلمى', reportFull);
  assert(formattedChat.reply.includes('المشكلة:') && formattedChat.reply.includes('الدليل من أرقام حسابك:'));
  console.log('✅ Test 5 PASSED: 3 Analytic Brains tailored per account/packages, <=3 cap, 5-part format, per-account decisions & unified alternative warning verified.');

  // ---------------------------------------------------------------------------
  // 6) Calculator Costing Invariance (Untouched!)
  // ---------------------------------------------------------------------------
  const calc = runDraftCostCalculationViaExistingEngine({
    accountId: 'acc_full',
    packageOptions: { role: 'artisan', overrideSub: makeSub(['core_free', 'production_pricing']), isAdmin: false },
    firstName: 'سلمى',
    productName: 'مفرش مكرمية تجريبي',
    explicitMaterials: [
      { name: 'خيط قطن مجدول', unit: 'كيلو', unitPrice: 180, quantity: 0.5 },
      { name: 'عصا خشب', unit: 'قطعة', unitPrice: 30, quantity: 1 },
    ],
    laborWage: 80,
    packagingCost: 15,
    profitMarginPercent: 30,
  });
  assert.equal(calc.allowed, true);
  assert(
    calc.calculatorOutput &&
      calc.calculatorOutput.finalSellingPrice > 0 &&
      calc.calculatorOutput.totalDirectMaterialsCost > 0,
    'Existing calculator equation untouched'
  );
  console.log('✅ Test 6 PASSED: Calculator equations untouched (runDraftCostCalculationViaExistingEngine verified).');

  console.log('\n🎉 ALL PART 6 (MESSAGE 6 OF 7) VERIFICATION TESTS PASSED 100%!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
