/**
 * Verification Script — Message 7 of 7 (Part D):
 * التحقق الذاتي قبل الرد (Validator) + التعلّم المحلي للأسلوب (بحصة استكشاف 20%)
 * + تتبع الأثر خلال 7 أيام بصدق + الملخص الأسبوعي وتصفير التعلّم + ثبات المعادلات والحدود الدنيا
 */
import assert from 'node:assert/strict';
import {
  resetAccountLearning,
  loadAccountLearningProfile,
  validateShamousaReplyBeforeSend,
  recordCopyTextFeedback,
  recordBrainRecommendationFeedback,
  selectLearnedToneForAccount,
  getAccountLengthPreference,
  rankTemplatesWithLearning,
  recordPublishedProductShare,
  evaluate7DayPublishedImpacts,
  buildWeeklyLearningSummary,
} from '../src/services/shamousaSelfCheckAndLearning';
import { buildLibraryMarketingCopy } from '../src/services/shamousaProductUnderstanding';
import { runDraftCostCalculationViaExistingEngine } from '../src/services/shamousaMarketingPricingEngine';
import { buildSafeDiscountOfferFromUserFloor } from '../src/services/shamousaMarketingAndDecision';
import type { InvoiceRecord } from '../src/types';
import type { UserSubscriptionState } from '../src/types/subscriptions';

function makeSub(packages: string[]): UserSubscriptionState {
  return {
    activePackageIds: packages as any,
    hasSelectedPackages: true,
    updatedAt: new Date().toISOString(),
  };
}

function makeOrder(id: string, productName: string, qty: number, tsMs: number): InvoiceRecord {
  return {
    id,
    tenantId: 'tenant_part7',
    customerName: 'عميل متجر',
    createdAt: tsMs,
    status: 'completed',
    totalAmount: qty * 300,
    paidAmount: qty * 300,
    items: [{ productName, quantity: qty, unitPrice: 300, totalPrice: qty * 300 }],
  } as unknown as InvoiceRecord;
}

async function run() {
  console.log('=== Verify Part 7 (Message 7 of 7): Self-Check Validator & Per-Account Style Learning ===');

  resetAccountLearning('acc_alpha');
  resetAccountLearning('acc_beta');

  // ---------------------------------------------------------------------------
  // Test 1: Self-Check Validator (Package, Privacy, Unverified Numbers, Forbidden Claims, Repetition, Options)
  // ---------------------------------------------------------------------------
  const freePkgOpts = { role: 'artisan' as const, overrideSub: makeSub(['core_free']), isAdmin: false };

  // 1a) Package leakage blocked when costing is locked
  const pkgCheck = validateShamousaReplyBeforeSend({
    accountId: 'acc_alpha',
    packageOptions: freePkgOpts,
    replyText: 'تكلفة القطعة: 180 ج.م وهامش الربح: 42% من الإنتاج.',
    firstName: 'أحمد',
  });
  assert.equal(pkgCheck.passed, false);
  assert(pkgCheck.failedChecks.includes('package_costing_locked'));
  assert(!pkgCheck.sanitizedReply.includes('180 ج.م'), 'Locked costing numbers must be replaced safely');
  assert(pkgCheck.options.length >= 3 && pkgCheck.options.length <= 4, 'Validator must ensure 3-4 options');

  // 1b) Forbidden claims + fake scarcity + fake testimonial + PII stripped + unverified price removed
  const claimsCheck = validateShamousaReplyBeforeSend({
    accountId: 'acc_alpha',
    packageOptions: freePkgOpts,
    replyText:
      'المنتج ده طبيعي 100% وعلاجي وآمن للأطفال! آخر قطعتين في المخزن فقط، أكتر من 500 عميل اشتروا، السعر 999 ج.م، تواصل على secret@other.com أو 01012345678.',
    allowedFactNumbers: [250, 300],
    firstName: 'أحمد',
  });
  assert.equal(claimsCheck.passed, false);
  assert(!claimsCheck.sanitizedReply.includes('طبيعي 100%'));
  assert(!claimsCheck.sanitizedReply.includes('علاجي'));
  assert(!claimsCheck.sanitizedReply.includes('آمن للأطفال'));
  assert(!claimsCheck.sanitizedReply.includes('آخر قطعتين'));
  assert(!claimsCheck.sanitizedReply.includes('secret@other.com'));
  assert(!claimsCheck.sanitizedReply.includes('01012345678'));
  assert(!claimsCheck.sanitizedReply.includes('999 ج.م'), 'Unverified price not in account facts must be replaced');

  // 1c) Consecutive repetition detected & varied
  const firstReply = validateShamousaReplyBeforeSend({
    accountId: 'acc_alpha',
    replyText: 'نقدر نبدأ بتصوير القطعة في ضوء طبيعي قريب من الشباك.',
    options: [
      { id: 'o1', label: 'أفكار تصوير', queryText: 'أفكار تصوير' },
      { id: 'o2', label: 'بوست جاهز', queryText: 'بوست جاهز' },
      { id: 'o3', label: 'هاشتاجات', queryText: 'هاشتاجات' },
    ],
  });
  const secondIdenticalReply = validateShamousaReplyBeforeSend({
    accountId: 'acc_alpha',
    replyText: 'نقدر نبدأ بتصوير القطعة في ضوء طبيعي قريب من الشباك.',
    options: [
      { id: 'o1', label: 'أفكار تصوير', queryText: 'أفكار تصوير' },
      { id: 'o2', label: 'بوست جاهز', queryText: 'بوست جاهز' },
      { id: 'o3', label: 'هاشتاجات', queryText: 'هاشتاجات' },
    ],
  });
  assert(secondIdenticalReply.failedChecks.includes('consecutive_repetition'));
  assert.notEqual(secondIdenticalReply.sanitizedReply, firstReply.sanitizedReply);

  // Local self-check audit log stored for acc_alpha ONLY
  assert(loadAccountLearningProfile('acc_alpha').selfCheckLog.length >= 3);
  assert.equal(loadAccountLearningProfile('acc_beta').selfCheckLog.length, 0, 'Audit log must NOT leak to acc_beta');
  console.log('✅ Test 1 PASSED: Self-Check Validator caught package/privacy/claims/numbers/repetition/options & logged locally.');

  // ---------------------------------------------------------------------------
  // Test 2: Repeated Rejection of Formal Tone Changes Style + 20% Exploration Quota
  // ---------------------------------------------------------------------------
  resetAccountLearning('acc_alpha');
  resetAccountLearning('acc_beta');

  // Reject formal tone 3 times with "too_formal" + "too_long" on acc_alpha
  for (let i = 0; i < 3; i++) {
    recordCopyTextFeedback('acc_alpha', {
      blockId: `blk_formal_${i}`,
      templateId: 'tpl_formal_1',
      tone: 'formal',
      rating: 'not_suitable',
      reason: 'too_formal',
    });
  }
  recordCopyTextFeedback('acc_alpha', {
    blockId: 'blk_long_1',
    templateId: 'tpl_friendly_short',
    tone: 'light',
    rating: 'used',
  });
  recordCopyTextFeedback('acc_alpha', {
    blockId: 'blk_long_2',
    templateId: 'tpl_friendly_short',
    tone: 'light',
    rating: 'edited',
    reason: 'too_long',
  });

  const alphaProf = loadAccountLearningProfile('acc_alpha');
  assert(
    alphaProf.toneWeights.formal < alphaProf.toneWeights.light &&
      alphaProf.toneWeights.formal < alphaProf.toneWeights.friendly,
    'Repeated rejection of formal tone must lower formal weight below light/friendly'
  );
  assert.equal(getAccountLengthPreference('acc_alpha'), 'short', 'too_long feedback must enable short preference');

  // Verify 20% exploration across 100 selections (exactly 20 explorations via deterministic 1-in-5 counter)
  let explorationCount = 0;
  let formalCount = 0;
  let lightCount = 0;
  for (let i = 0; i < 100; i++) {
    const pick = selectLearnedToneForAccount('acc_alpha');
    if (pick.isExploration) explorationCount++;
    if (pick.tone === 'formal') formalCount++;
    if (pick.tone === 'light') lightCount++;
  }
  assert.equal(explorationCount, 20, 'Exploration quota must be 20% (20 out of 100)');
  assert(lightCount >= 75, 'Dominant learned tone (light) must dominate non-exploration picks');
  assert(formalCount <= 20, 'Rejected formal tone must drop sharply');

  // Verify actual generated marketing copy adapts to acc_alpha's learned style
  const copyAlpha = buildLibraryMarketingCopy({
    accountId: 'acc_alpha',
    productName: 'شنطة مكرمية يدوي',
    material: 'خيط قطن',
    priceText: '450 ج.م',
  });
  assert(copyAlpha.shortPostSale.length <= 170, 'Learned short preference must keep generated post concise');
  assert(copyAlpha.selectedTone !== 'formal' || copyAlpha.usedExploration === true);
  console.log('✅ Test 2 PASSED: Repeated formal rejection shifted style to light/short with exact 20% exploration quota.');

  // ---------------------------------------------------------------------------
  // Test 3: Strict Zero Cross-Account Isolation (acc_alpha vs acc_beta)
  // ---------------------------------------------------------------------------
  const betaProf = loadAccountLearningProfile('acc_beta');
  assert.equal(betaProf.toneWeights.formal, 1.0, 'acc_beta must NOT inherit acc_alpha rejections');
  assert.equal(betaProf.toneWeights.light, 1.0);
  assert.equal(betaProf.copyFeedbackHistory.length, 0);
  assert.equal(getAccountLengthPreference('acc_beta'), 'balanced');

  // Train acc_beta to LOVE formal tone
  recordCopyTextFeedback('acc_beta', {
    blockId: 'b_f1',
    templateId: 'tpl_formal_1',
    tone: 'formal',
    rating: 'used',
  });
  recordCopyTextFeedback('acc_beta', {
    blockId: 'b_f2',
    templateId: 'tpl_formal_1',
    tone: 'formal',
    rating: 'used',
  });
  assert.equal(selectLearnedToneForAccount('acc_beta', { rng: () => 0.9 }).tone, 'formal');
  assert.equal(selectLearnedToneForAccount('acc_alpha', { rng: () => 0.9 }).tone, 'light');
  console.log('✅ Test 3 PASSED: Two accounts maintain 100% isolated learning profiles (alpha=light vs beta=formal).');

  // ---------------------------------------------------------------------------
  // Test 4: 7-Day Store/Orders Impact Tracking (Honest Association Without Causality Claims)
  // ---------------------------------------------------------------------------
  const storePkgOpts = {
    role: 'artisan' as const,
    overrideSub: makeSub(['core_free', 'storefront_catalog', 'finance_crm']),
    isAdmin: false,
  };
  const dayMs = 86400_000;
  const pubTime = Date.now() - 10 * dayMs;

  const ordersTimeline: InvoiceRecord[] = [
    // Product 1 (مكرمية): 1 order before publish, 4 orders in 7 days after publish -> associated increase!
    makeOrder('ord_1', 'جدارية مكرمية بوهو', 1, pubTime - 3 * dayMs),
    makeOrder('ord_2', 'جدارية مكرمية بوهو', 2, pubTime + 2 * dayMs),
    makeOrder('ord_3', 'جدارية مكرمية بوهو', 2, pubTime + 5 * dayMs),
    // Product 2 (شمعة): 2 orders before publish, 1 order after -> no clear change
    makeOrder('ord_4', 'شمعة صويا فانيليا', 2, pubTime - 2 * dayMs),
    makeOrder('ord_5', 'شمعة صويا فانيليا', 1, pubTime + 4 * dayMs),
  ];

  const pub1 = recordPublishedProductShare({
    accountId: 'acc_alpha',
    packageOptions: storePkgOpts,
    productName: 'جدارية مكرمية بوهو',
    templateId: 'tpl_winner',
    tone: 'light',
    orders: ordersTimeline,
    nowMs: pubTime,
  });
  assert.equal(pub1.recorded, true);
  assert.equal(pub1.item?.baselineOrders7dBefore, 1);

  const pub2 = recordPublishedProductShare({
    accountId: 'acc_alpha',
    packageOptions: storePkgOpts,
    productName: 'شمعة صويا فانيليا',
    templateId: 'tpl_flat',
    tone: 'formal',
    orders: ordersTimeline,
    nowMs: pubTime,
  });
  assert.equal(pub2.recorded, true);
  assert.equal(pub2.item?.baselineOrders7dBefore, 2);

  // Evaluate 8 days later
  const impacts = evaluate7DayPublishedImpacts({
    accountId: 'acc_alpha',
    packageOptions: storePkgOpts,
    orders: ordersTimeline,
    nowMs: pubTime + 8 * dayMs,
  });
  assert.equal(impacts.length, 2);
  const incItem = impacts.find((x) => x.productName === 'جدارية مكرمية بوهو')!;
  const flatItem = impacts.find((x) => x.productName === 'شمعة صويا فانيليا')!;

  assert.equal(incItem.outcome, 'associated_increase');
  assert(incItem.summaryAr?.includes('ارتبط بزيادة') && incItem.summaryAr?.includes('بدون ادعاء سببية مؤكدة'));
  assert.equal(flatItem.outcome, 'no_clear_change');
  assert(flatItem.summaryAr?.includes('ما ظهرش معاه تغيير واضح'));

  // Impact must rank tpl_winner above tpl_flat on future suggestions
  const ranked = rankTemplatesWithLearning('acc_alpha', [{ id: 'tpl_flat' }, { id: 'tpl_winner' }], () => 0.9);
  assert.equal(ranked.ordered[0].id, 'tpl_winner');
  console.log('✅ Test 4 PASSED: 7-day honest impact tracking (associated increase vs no clear change) & template re-ranking verified.');

  // ---------------------------------------------------------------------------
  // Test 5: Weekly Summary («اللي اتعلمته منك») + Reset («صفّر تعلّمي») Isolated Per Account
  // ---------------------------------------------------------------------------
  recordBrainRecommendationFeedback('acc_alpha', { recId: 'rec_1', brain: 'strategic', decision: 'will_do' });
  const weekly = buildWeeklyLearningSummary({
    accountId: 'acc_alpha',
    packageOptions: storePkgOpts,
    orders: ordersTimeline,
    firstName: 'أحمد',
  });
  assert(weekly.shortSummaryAr.includes('اللي اتعلمته منك'));
  assert(weekly.feedbackCount >= 5);
  assert.equal(weekly.evaluatedImpacts.length, 2);

  // Reset acc_alpha ONLY -> acc_beta stays completely untouched!
  resetAccountLearning('acc_alpha');
  assert.equal(loadAccountLearningProfile('acc_alpha').copyFeedbackHistory.length, 0);
  assert.equal(loadAccountLearningProfile('acc_alpha').toneWeights.formal, 1.0);
  assert.equal(loadAccountLearningProfile('acc_beta').copyFeedbackHistory.length, 2, 'Resetting acc_alpha must NEVER affect acc_beta');
  console.log('✅ Test 5 PASSED: Weekly summary & isolated per-account reset verified.');

  // ---------------------------------------------------------------------------
  // Test 6: Invariance — Costing Equations & Minimum Profit Floors Untouched by Learning!
  // ---------------------------------------------------------------------------
  const costingPkgOpts = {
    role: 'artisan' as const,
    overrideSub: makeSub(['core_free', 'production_pricing']),
    isAdmin: false,
  };
  const calcBefore = runDraftCostCalculationViaExistingEngine({
    accountId: 'acc_alpha',
    packageOptions: costingPkgOpts,
    firstName: 'أحمد',
    productName: 'مفرش مكرمية',
    explicitMaterials: [{ name: 'خيط قطن', unit: 'كيلو', unitPrice: 180, quantity: 0.5 }],
    laborWage: 80,
    packagingCost: 15,
    profitMarginPercent: 30,
  });

  // Hammer acc_alpha with 5 "too_expensive" rejections -> must NEVER alter costing output or minimum floor!
  for (let i = 0; i < 5; i++) {
    recordCopyTextFeedback('acc_alpha', {
      blockId: `exp_${i}`,
      templateId: 'tpl_price',
      tone: 'friendly',
      rating: 'not_suitable',
      reason: 'too_expensive',
    });
  }

  const calcAfter = runDraftCostCalculationViaExistingEngine({
    accountId: 'acc_alpha',
    packageOptions: costingPkgOpts,
    firstName: 'أحمد',
    productName: 'مفرش مكرمية',
    explicitMaterials: [{ name: 'خيط قطن', unit: 'كيلو', unitPrice: 180, quantity: 0.5 }],
    laborWage: 80,
    packagingCost: 15,
    profitMarginPercent: 30,
  });
  assert.equal(
    calcAfter.calculatorOutput?.finalSellingPrice,
    calcBefore.calculatorOutput?.finalSellingPrice,
    'Costing equation finalSellingPrice must be 100% invariant to user learning'
  );
  assert.equal(
    calcAfter.calculatorOutput?.totalDirectMaterialsCost,
    calcBefore.calculatorOutput?.totalDirectMaterialsCost,
    'Costing equation totalDirectMaterialsCost must be 100% invariant to user learning'
  );

  // Verify minimum price floor offer respects exact user floor (e.g., 400 EGP) without going below it
  const floorOffer = buildSafeDiscountOfferFromUserFloor({
    productName: 'جدارية مكرمية',
    listedPrice: 500,
    userFloorPrice: 400,
    currencySymbol: 'ج.م',
    firstName: 'أحمد',
  });
  assert(
    floorOffer.reply.includes('400') || floorOffer.reply.includes('٤٠٠'),
    'Minimum acceptable floor price must remain strictly respected'
  );
  assert(!floorOffer.reply.includes('350'), 'Learning must NEVER lower the minimum floor price');
  console.log('✅ Test 6 PASSED: Costing equations and minimum profit floors are 100% untouched by learning.');

  console.log('\n🎉 ALL PART 7 (MESSAGE 7 OF 7) VERIFICATION TESTS PASSED 100%!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
