import assert from 'node:assert/strict';
import {
  ALL_PACKAGE_IDS,
  getActivePackages,
  hasFeature,
  detectLockedSubscriptionQuery,
  type UserSubscriptionState,
} from '../src/types/subscriptions';
import {
  isNewProductWizardTrigger,
  startNewProductWizard,
  advanceProductWizard,
} from '../src/services/shamousaProductWizard';
import { auditPersonalProfileOffline } from '../src/services/shamousaProfileAdvisor';
import {
  buildPackageAdaptiveDecisionReportOffline,
  runStoreMarketingReviewOffline,
  buildSafeDiscountOfferFromUserFloor,
  buildWhatsAppTemplatesOffline,
} from '../src/services/shamousaMarketingAndDecision';
import { resolveShamousaLocalChatbot } from '../src/services/shamousaLocalChatbot';
import type { SavedProductRecord, RawMaterialItem, CustomerRecord, InvoiceRecord, UserProfile } from '../src/types';
import type { MemberPersonalProfile } from '../src/types/memberProfile';

// Minimal localStorage shim for Node execution
const memStore = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memStore.set(k, String(v));
    },
    removeItem: (k: string) => {
      memStore.delete(k);
    },
    clear: () => memStore.clear(),
  };
}

const makeSub = (ids: UserSubscriptionState['activePackageIds']): UserSubscriptionState => ({
  activePackageIds: ids,
  hasSelectedPackages: true,
});

const subA_coreOnly = makeSub(['core_free']);
const subB_storeOnly = makeSub(['core_free', 'storefront_catalog']);
const subC_storePlusShamousa = makeSub(['core_free', 'storefront_catalog', 'ai_assistants']);
const subD_allPackages = makeSub([...ALL_PACKAGE_IDS]);

const sampleProfileBase: UserProfile = {
  id: 'acc_test',
  tenantId: 'acc_test',
  workshopId: 'acc_test',
  email: 'artisan@example.com',
  artistName: 'سارة محمد',
  brandName: 'ورشة الشمساوية للتجربة',
  country: 'مصر',
  governorate: 'القاهرة',
  currency: 'EGP',
  currencySymbol: 'ج.م',
  accountRole: 'artisan',
} as UserProfile;

const sampleProductsNoCost: SavedProductRecord[] = [
  {
    id: 'p1',
    tenantId: 'acc_test',
    productName: 'شنطة مكرمية يدوية بيج',
    retailPrice: 350,
    costPrice: 0,
    inStore: true,
    isActive: true,
    imageUrl: 'https://example.com/bag1.jpg',
    storeDescription: 'شنطة مكرمية قطن طبيعي معمولة يدوياً مناسبة للخروج اليومي والهدايا بمقاس عملي مريح.',
  } as any,
  {
    id: 'p2',
    tenantId: 'acc_test',
    productName: 'ميدالية',
    retailPrice: 80,
    costPrice: 0,
    inStore: false,
    isActive: true,
    imageUrl: '',
    storeDescription: '',
  } as any,
];

const sampleProductsWithCost: SavedProductRecord[] = [
  {
    ...sampleProductsNoCost[0],
    costPrice: 180,
    totalCost: 180,
  } as any,
  {
    ...sampleProductsNoCost[1],
    costPrice: 50,
    totalCost: 50,
  } as any,
];

const sampleMaterials: RawMaterialItem[] = [
  { id: 'm1', tenantId: 'acc_test', materialName: 'خيط مكرمية قطن 3 مم', currentStock: 2, minAlertThreshold: 5, isActive: true } as any,
  { id: 'm2', tenantId: 'acc_test', materialName: 'حلقات خشب طبيعي', currentStock: 20, minAlertThreshold: 5, isActive: true } as any,
];

const sampleCustomers: CustomerRecord[] = [
  { id: 'c1', tenantId: 'acc_test', name: 'منى علي', phone: '01000000001' } as any,
];

const sampleOrders: InvoiceRecord[] = [
  { id: 'o1', tenantId: 'acc_test', totalAmount: 350, finalTotal: 350, items: [] } as any,
];

const samplePersonalProfile: MemberPersonalProfile = {
  memberId: 'acc_test',
  displayName: 'سارة محمد',
  brandName: 'ورشة الشمساوية للتجربة',
  accountRole: 'artisan',
  craftsLabels: ['مكرمية', 'كروشيه'],
  governorate: 'القاهرة',
  country: 'مصر',
  bioHeadline: 'فنانة مكرمية وكروشيه',
  storyText: '', // short/empty
  personalAvatar: undefined,
  brandLogo: '',
  showcasePosts: [
    { id: 's1', imageUrl: 'data:image/jpeg;base64,' + 'A'.repeat(200), caption: '', createdAt: new Date().toISOString() },
  ],
  visibility: {
    personalAvatar: { artisans: false, suppliers: false, customers: false }, // hidden from all!
    story: { artisans: true, suppliers: true, customers: false }, // hidden from customers!
    showcase: { artisans: true, suppliers: true, customers: true },
    contact: { artisans: false, suppliers: false, customers: false },
    storeLink: { artisans: true, suppliers: true, customers: true },
    location: { artisans: false, suppliers: false, customers: false }, // hidden from all!
  },
};

const results: string[] = [];
function pass(label: string) {
  results.push(`✅ ${label}`);
}

// 1) Test getActivePackages & hasFeature across all 4 accounts
assert.equal(getActivePackages('acc_a', { role: 'artisan', overrideSub: subA_coreOnly }).length, 1);
assert.equal(hasFeature('core_profile', 'acc_a', { role: 'artisan', overrideSub: subA_coreOnly }), true);
assert.equal(hasFeature('storefront', 'acc_a', { role: 'artisan', overrideSub: subA_coreOnly }), false);
assert.equal(hasFeature('costing', 'acc_a', { role: 'artisan', overrideSub: subA_coreOnly }), false);
assert.equal(hasFeature('inventory', 'acc_a', { role: 'artisan', overrideSub: subA_coreOnly }), false);

assert.equal(getActivePackages('acc_b', { role: 'artisan', overrideSub: subB_storeOnly }).length, 2);
assert.equal(hasFeature('storefront', 'acc_b', { role: 'artisan', overrideSub: subB_storeOnly }), true);
assert.equal(hasFeature('marketing_review', 'acc_b', { role: 'artisan', overrideSub: subB_storeOnly }), true);
assert.equal(hasFeature('costing', 'acc_b', { role: 'artisan', overrideSub: subB_storeOnly }), false);

assert.equal(getActivePackages('acc_c', { role: 'artisan', overrideSub: subC_storePlusShamousa }).length, 3);
assert.equal(hasFeature('shamousa', 'acc_c', { role: 'artisan', overrideSub: subC_storePlusShamousa }), true);
assert.equal(hasFeature('costing', 'acc_c', { role: 'artisan', overrideSub: subC_storePlusShamousa }), false);
assert.equal(hasFeature('inventory', 'acc_c', { role: 'artisan', overrideSub: subC_storePlusShamousa }), false);

assert.equal(getActivePackages('acc_d', { role: 'artisan', overrideSub: subD_allPackages }).length, 7);
assert.equal(hasFeature('costing', 'acc_d', { role: 'artisan', overrideSub: subD_allPackages }), true);
assert.equal(hasFeature('inventory', 'acc_d', { role: 'artisan', overrideSub: subD_allPackages }), true);
assert.equal(hasFeature('finance', 'acc_d', { role: 'artisan', overrideSub: subD_allPackages }), true);
pass('1) getActivePackages & hasFeature verified accurately on accounts (أ), (ب), (ج), (د)');

// 2) Test 4-part locked-package reply & max 1 package suggestion
const lockedCostOnC = detectLockedSubscriptionQuery('احسبيلي هامش الربح في حاسبة التكاليف', subC_storePlusShamousa, 'artisan', false, 'سارة');
assert.ok(lockedCostOnC && lockedCostOnC.blocked, 'Costing query must be blocked on Account (ج)');
assert.equal(lockedCostOnC.suggestedPackages.length, 1, 'Must suggest at most 1 package');
assert.ok(lockedCostOnC.reply.includes('1) **إنت دلوقتي في الباقات دي:**'), 'Part 1 missing');
assert.ok(lockedCostOnC.reply.includes('2) **اللي تقدر تعمله:**'), 'Part 2 missing');
assert.ok(lockedCostOnC.reply.includes('3) **اللي مش متاح في باقاتك:**'), 'Part 3 missing');
assert.ok(lockedCostOnC.reply.includes('4) **لو عايز تضيفه:**') && lockedCostOnC.reply.includes('وهي مجانية دلوقتي'), 'Part 4 missing');
pass('2) Locked feature reply strictly matches 4-part order with max 1 package suggestion');

// 3) Test Decision Report adapts per package and NEVER leaks locked words in (أ), (ب), (ج)
const forbiddenNoCostWords = ['هامش الربح', 'التسعير والتكاليف', 'المخزون والخامات', 'المبيعات والعملاء'];

const repA = buildPackageAdaptiveDecisionReportOffline({
  accountId: 'acc_a',
  firstName: 'سارة',
  profile: sampleProfileBase,
  personalProfile: samplePersonalProfile,
  products: sampleProductsNoCost,
  materials: sampleMaterials,
  customers: sampleCustomers,
  orders: sampleOrders,
  packageOptions: { role: 'artisan', overrideSub: subA_coreOnly },
});
assert.deepEqual(repA.sectionsIncluded, ['personal_profile_family']);
for (const w of [...forbiddenNoCostWords, 'متجرك وعرض منتجاتك']) {
  assert.equal(repA.markdown.includes(w), false, `Account (أ) leaked locked term: ${w}`);
}

const repB = buildPackageAdaptiveDecisionReportOffline({
  accountId: 'acc_b',
  firstName: 'سارة',
  profile: sampleProfileBase,
  personalProfile: samplePersonalProfile,
  products: sampleProductsNoCost,
  materials: sampleMaterials,
  customers: sampleCustomers,
  orders: sampleOrders,
  packageOptions: { role: 'artisan', overrideSub: subB_storeOnly },
});
assert.deepEqual(repB.sectionsIncluded, ['personal_profile_family', 'storefront_catalog']);
for (const w of forbiddenNoCostWords) {
  assert.equal(repB.markdown.includes(w), false, `Account (ب) leaked locked term: ${w}`);
}

const repC = buildPackageAdaptiveDecisionReportOffline({
  accountId: 'acc_c',
  firstName: 'سارة',
  profile: sampleProfileBase,
  personalProfile: samplePersonalProfile,
  products: sampleProductsNoCost,
  materials: sampleMaterials,
  customers: sampleCustomers,
  orders: sampleOrders,
  packageOptions: { role: 'artisan', overrideSub: subC_storePlusShamousa },
});
assert.deepEqual(repC.sectionsIncluded, ['personal_profile_family', 'storefront_catalog']);
for (const w of forbiddenNoCostWords) {
  assert.equal(repC.markdown.includes(w), false, `Account (ج) leaked locked term: ${w}`);
}

const repD = buildPackageAdaptiveDecisionReportOffline({
  accountId: 'acc_d',
  firstName: 'سارة',
  profile: sampleProfileBase,
  personalProfile: samplePersonalProfile,
  products: sampleProductsWithCost,
  materials: sampleMaterials,
  customers: sampleCustomers,
  orders: sampleOrders,
  packageOptions: { role: 'artisan', overrideSub: subD_allPackages },
});
assert.deepEqual(repD.sectionsIncluded, [
  'personal_profile_family',
  'storefront_catalog',
  'costing_production',
  'inventory_materials',
  'finance_crm',
]);
pass('3) Decision Report adapts dynamically across (أ), (ب), (ج), (د) with ZERO locked-feature leaks');

// 4) Test New Product Wizard works in (أ), (ب), (ج), (د) and extracts fields automatically
assert.equal(isNewProductWizardTrigger('عايز أعمل ميدالية مكرمية للأطفال'), true);
for (const [label, sub, expectWhatsapp, expectPrefill] of [
  ['أ (الأساسية فقط)', subA_coreOnly, false, false],
  ['ب (الأساسية + متجر)', subB_storeOnly, true, true],
  ['ج (متجر + شموسة بدون تكاليف)', subC_storePlusShamousa, true, true],
  ['د (كل الباقات)', subD_allPackages, true, true],
] as const) {
  const ctx = {
    accountId: `acc_${label}`,
    firstName: 'سارة',
    brandName: 'ورشة سارة',
    currencySymbol: 'ج.م',
    packageOptions: { role: 'artisan' as const, overrideSub: sub },
    stockMaterialNames: ['خيط مكرمية قطن 3 مم', 'حلقات خشب طبيعي'],
  };
  let turn = startNewProductWizard('عايز أعمل ميدالية مكرمية للأطفال', ctx);
  // Should skip productType, material, audienceOccasion and land on sizeDetails!
  assert.equal(turn.nextState.currentStep, 'sizeDetails', `Account ${label} should skip extracted fields`);
  assert.equal(turn.nextState.data.productType, 'ميدالية');
  assert.equal(turn.nextState.data.material, 'خيط مكرمية قطن');
  assert.ok(turn.nextState.data.audienceOccasion?.includes('للأطفال'));

  turn = advanceProductWizard(turn.nextState, '10 سم', ctx);
  assert.equal(turn.nextState.currentStep, 'features');
  turn = advanceProductWizard(turn.nextState, 'شغل يدوي 100%', ctx);
  assert.equal(turn.nextState.currentStep, 'features');
  turn = advanceProductWizard(turn.nextState, '__DONE_MULTI__', ctx);
  assert.equal(turn.nextState.currentStep, 'price');
  turn = advanceProductWizard(turn.nextState, '75', ctx);
  assert.equal(turn.nextState.currentStep, 'media');
  turn = advanceProductWizard(turn.nextState, '', ctx);
  assert.equal(turn.nextState.completed, true, `Wizard must complete on account ${label}`);
  assert.ok(turn.copyBlocks && turn.copyBlocks.length >= 6);
  const hasWaBlock = turn.copyBlocks.some((b) => b.id === 'cb_whatsapp');
  assert.equal(hasWaBlock, expectWhatsapp, `WhatsApp block mismatch on ${label}`);
  assert.equal(Boolean(turn.prefillDraft), expectPrefill, `Prefill draft mismatch on ${label}`);
  const mapBlock = turn.copyBlocks.find((b) => b.id === 'cb_map');
  assert.ok(mapBlock?.content.includes('اسم المنتج (بالعربية) *'), 'Exact DirectCatalogProductModal label missing');
  assert.ok(mapBlock?.content.includes('وصف المنتج للعملاء (بالعربية)'), 'Exact description label missing');
}

// Verify real stock suggestion in Account (د) when material is NOT pre-mentioned
const wizMatStepD = startNewProductWizard('عايز أعمل شنطة', {
  accountId: 'acc_d',
  firstName: 'سارة',
  packageOptions: { role: 'artisan', overrideSub: subD_allPackages },
  stockMaterialNames: ['خيط مكرمية قطن 3 مم', 'حلقات خشب طبيعي'],
});
assert.equal(wizMatStepD.nextState.currentStep, 'material');
assert.ok(wizMatStepD.choices?.some((c) => c.value === 'خيط مكرمية قطن 3 مم'), 'Account (د) must suggest real stock material');
pass('4) New Product Wizard works across (أ), (ب), (ج), (د) with field extraction, exact field map, and inventory-gated stock suggestions');

// 5) Test Personal Profile Advisor & Privacy Matrix respect
const profAudit = auditPersonalProfileOffline({
  profile: samplePersonalProfile,
  accountId: 'acc_a',
  packageOptions: { role: 'artisan', overrideSub: subA_coreOnly },
});
assert.ok(profAudit.score >= 0 && profAudit.score <= 100);
assert.ok(profAudit.topTwoToday.length <= 2, 'Must show top 2 daily actions (<= 3)');
assert.ok(profAudit.issues.some((i) => i.id.startsWith('img_tiny_')), 'Must detect tiny image locally without AI');
// Location was hidden from ALL audiences -> intro post must NOT leak governorate 'القاهرة'
assert.equal(profAudit.contentIdeas.introPost.includes('القاهرة'), false, 'Privacy violation: leaked hidden governorate!');
// Avatar was hidden from ALL audiences -> logo issue must respect hidden avatar
const logoIss = profAudit.issues.find((i) => i.id === 'missing_logo_avatar');
assert.ok(logoIss && logoIss.detail.includes('تخفي صورتك الشخصية'), 'Must acknowledge hidden avatar respectfully');
// Story was hidden from customers -> story issues/suggestions must NOT target customers, while respectedHiddenSections records it
const storyIssueOrSugText = [
  ...profAudit.issues.filter((i) => i.id.includes('story')).map((i) => i.detail),
  ...profAudit.topTwoToday.filter((s) => s.id.includes('story')).map((s) => s.detail),
].join(' ');
assert.equal(storyIssueOrSugText.includes('العملاء'), false, 'Must not suggest story to hidden audience');
assert.ok(
  profAudit.respectedHiddenSections.some((s) => s.includes('قصة الفنان/الورشة') && s.includes('العملاء')),
  'Must explicitly acknowledge hiding story from customers'
);
// Core-only -> newProductPosts must be empty
assert.equal(profAudit.contentIdeas.newProductPosts.length, 0);
pass('5) Personal Profile Advisor scores locally, checks image weight, caps top-2 suggestions, and strictly obeys Privacy Matrix');

// 6) Test Rule 6.1 (Minimum Price Offer) & Rule 6.3 (Store Marketing Review) & WhatsApp Templates
const floorOffer = buildSafeDiscountOfferFromUserFloor({
  firstName: 'سارة',
  productName: 'شنطة مكرمية يدوية بيج',
  listedPrice: 350,
  userFloorPrice: 280,
});
assert.ok(floorOffer.reply.includes('الحساب ده مبني على أقل سعر إنت حددته بنفسك، مش من حاسبة التكاليف'));

const revA = runStoreMarketingReviewOffline({
  accountId: 'acc_a',
  firstName: 'سارة',
  products: sampleProductsNoCost,
  packageOptions: { role: 'artisan', overrideSub: subA_coreOnly },
});
assert.equal(revA.allowed, false);
assert.ok(revA.lockedReply?.includes('1) **إنت دلوقتي في الباقات دي:**'));

const revC = runStoreMarketingReviewOffline({
  accountId: 'acc_c',
  firstName: 'سارة',
  products: sampleProductsNoCost,
  packageOptions: { role: 'artisan', overrideSub: subC_storePlusShamousa },
});
assert.equal(revC.allowed, true);
assert.equal(revC.skippedPriceMarginChecks, true);
assert.equal(revC.summaryMarkdown.includes('هامش'), false, 'Account (ج) store review must skip margin checks');

const revD = runStoreMarketingReviewOffline({
  accountId: 'acc_d',
  firstName: 'سارة',
  products: sampleProductsWithCost,
  packageOptions: { role: 'artisan', overrideSub: subD_allPackages },
});
assert.equal(revD.allowed, true);
assert.equal(revD.skippedPriceMarginChecks, false);

const waA = buildWhatsAppTemplatesOffline({
  accountId: 'acc_a',
  firstName: 'سارة',
  products: sampleProductsNoCost,
  packageOptions: { role: 'artisan', overrideSub: subA_coreOnly },
});
assert.equal(waA.allowed, false);

const waC = buildWhatsAppTemplatesOffline({
  accountId: 'acc_c',
  firstName: 'سارة',
  products: sampleProductsNoCost,
  packageOptions: { role: 'artisan', overrideSub: subC_storePlusShamousa },
});
assert.equal(waC.allowed, true);
assert.equal(waC.copyBlocks?.length, 3);
pass('6) Rule 6.1 (user floor offer), Rule 6.3 (store review skipping cost checks), and WhatsApp templates verified');

// 7) Test Local Chatbot Fallback on Account (أ) never suggests locked costing/inventory/finance
const fallbackA = resolveShamousaLocalChatbot('كلام غير مفهوم خالص ابجد هوز', {
  firstName: 'سارة',
  isSupplier: false,
  accountId: 'acc_a',
  packageOptions: { role: 'artisan', overrideSub: subA_coreOnly },
});
const fbLabelsA = (fallbackA.options || []).map((o) => o.label).join(' | ');
assert.equal(fbLabelsA.includes('هلخصهالك'), false, 'Fallback on (أ) must not suggest executive brief');
assert.equal(fbLabelsA.includes('تسعير'), false, 'Fallback on (أ) must not suggest costing');
assert.equal(fbLabelsA.includes('الخامات الموحدة'), false, 'Fallback on (أ) must not suggest inventory');
pass('7) Local chatbot fallback strictly adapts to active packages without leaking locked suggestions');

// 8) Test disabling a package hides only and preserves data intact (re-enabling restores access + allows adding cost later)
const simulatedDbProducts = [...sampleProductsNoCost];
// Disable storefront_catalog -> review is hidden/locked, but simulatedDbProducts stays untouched
const revAfterDisable = runStoreMarketingReviewOffline({
  accountId: 'acc_toggle',
  firstName: 'سارة',
  products: simulatedDbProducts,
  packageOptions: { role: 'artisan', overrideSub: subA_coreOnly },
});
assert.equal(revAfterDisable.allowed, false);
assert.equal(simulatedDbProducts.length, 2, 'Disabling package must NEVER delete product data');
// Re-enable storefront + costing later and add cost to existing product
simulatedDbProducts[0] = { ...simulatedDbProducts[0], costPrice: 170 };
const revAfterReenable = runStoreMarketingReviewOffline({
  accountId: 'acc_toggle',
  firstName: 'سارة',
  products: simulatedDbProducts,
  packageOptions: { role: 'artisan', overrideSub: subD_allPackages },
});
assert.equal(revAfterReenable.allowed, true);
assert.equal(revAfterReenable.totalProducts, 2, 'Old data intact after re-enabling package');
assert.equal(revAfterReenable.items[0].skippedCostChecks, false, 'Added cost is picked up after enabling costing');
pass('8) Disabling/re-enabling packages hides features only without deleting data, and products without cost accept cost later');

// 9) Test independent Shamousa / Falcon sub-selection inside the single ai_assistants package
const subShamousaOnly: UserSubscriptionState = {
  activePackageIds: ['core_free', 'ai_assistants'],
  aiAssistantChoices: ['shamousa'],
  hasSelectedPackages: true,
};
assert.equal(hasFeature('shamousa', 'acc_sh_only', { role: 'artisan', overrideSub: subShamousaOnly }), true);
assert.equal(hasFeature('sakr', 'acc_sh_only', { role: 'artisan', overrideSub: subShamousaOnly }), false);

const subFalconOnly: UserSubscriptionState = {
  activePackageIds: ['core_free', 'ai_assistants'],
  aiAssistantChoices: ['falcon'],
  hasSelectedPackages: true,
};
assert.equal(hasFeature('shamousa', 'acc_fl_only', { role: 'artisan', overrideSub: subFalconOnly }), false);
assert.equal(hasFeature('sakr', 'acc_fl_only', { role: 'artisan', overrideSub: subFalconOnly }), true);

const subBothAi: UserSubscriptionState = {
  activePackageIds: ['core_free', 'ai_assistants'],
  aiAssistantChoices: ['shamousa', 'falcon'],
  hasSelectedPackages: true,
};
assert.equal(hasFeature('shamousa', 'acc_both_ai', { role: 'artisan', overrideSub: subBothAi }), true);
assert.equal(hasFeature('sakr', 'acc_both_ai', { role: 'artisan', overrideSub: subBothAi }), true);

const subLegacyAi: UserSubscriptionState = {
  activePackageIds: ['core_free', 'ai_assistants'],
  hasSelectedPackages: true,
};
assert.equal(hasFeature('shamousa', 'acc_leg_ai', { role: 'artisan', overrideSub: subLegacyAi }), true);
assert.equal(hasFeature('sakr', 'acc_leg_ai', { role: 'artisan', overrideSub: subLegacyAi }), true);

const lockedFalconOnShamousaOnly = detectLockedSubscriptionQuery(
  'حوليني لصقر',
  subShamousaOnly,
  'artisan',
  false,
  'سارة'
);
assert.ok(lockedFalconOnShamousaOnly && lockedFalconOnShamousaOnly.blocked, 'Falcon must be blocked when only Shamousa is checked');
pass('9) Independent Shamousa-only / Falcon-only / Both / Legacy selection inside ai_assistants verified');

console.log('\n=== PHASE 0 AUTOMATED VERIFICATION SUMMARY ===');
for (const line of results) console.log(line);
console.log(`\nALL ${results.length}/${results.length} CHECKS PASSED SUCCESSFULLY.`);
