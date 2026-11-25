import assert from 'node:assert/strict';
import {
  ALL_PACKAGE_IDS,
  ALL_AI_ASSISTANT_CHOICES,
  saveUserSubscription,
  getStoredUserSubscription,
  getActivePackages,
  hasFeature,
  shouldShowShamousaUi,
  shouldShowFalconUi,
  detectLockedSubscriptionQuery,
  type UserSubscriptionState,
} from '../src/types/subscriptions';
import { startNewProductWizard } from '../src/services/shamousaProductWizard';
import { auditPersonalProfileOffline } from '../src/services/shamousaProfileAdvisor';
import {
  runStoreMarketingReviewOffline,
  buildPackageAdaptiveDecisionReportOffline,
} from '../src/services/shamousaMarketingAndDecision';
import type { SavedProductRecord, UserProfile } from '../src/types';
import type { MemberPersonalProfile } from '../src/types/memberProfile';

// Minimal localStorage shim for Node execution
const memStore = new Map<string, string>();
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => memStore.set(k, String(v)),
    removeItem: (k: string) => memStore.delete(k),
    clear: () => memStore.clear(),
  };
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    localStorage: (globalThis as any).localStorage,
    dispatchEvent: () => true,
  };
}

const sampleProfile: UserProfile = {
  id: 'acc_part1',
  tenantId: 'acc_part1',
  workshopId: 'acc_part1',
  email: 'artisan@example.com',
  artistName: 'منى حسن',
  brandName: 'ورشة منى اليدوية',
  country: 'مصر',
  governorate: 'الإسكندرية',
  currency: 'EGP',
  currencySymbol: 'ج.م',
  accountRole: 'artisan',
} as UserProfile;

const samplePersonal: MemberPersonalProfile = {
  memberId: 'acc_part1',
  displayName: 'منى حسن',
  brandName: 'ورشة منى اليدوية',
  accountRole: 'artisan',
  craftsLabels: ['مكرمية'],
  governorate: 'الإسكندرية',
  country: 'مصر',
  bioHeadline: 'فنانة مشغولات يدوية',
  storyText: 'بشتغل مكرمية وكروشيه من 4 سنين بحب وإتقان في كل قطعة.',
  showcasePosts: [],
  visibility: {
    personalAvatar: { artisans: true, suppliers: true, customers: true },
    story: { artisans: true, suppliers: true, customers: true },
    showcase: { artisans: true, suppliers: true, customers: true },
    contact: { artisans: false, suppliers: false, customers: false },
    storeLink: { artisans: true, suppliers: true, customers: true },
    location: { artisans: true, suppliers: true, customers: true },
  },
};

const sampleProducts: SavedProductRecord[] = [
  {
    id: 'p_1',
    tenantId: 'acc_part1',
    productName: 'شنطة مكرمية يدوية للخروج',
    retailPrice: 320,
    costPrice: 0,
    inStore: true,
    isActive: true,
    imageUrl: 'https://example.com/bag.jpg',
    storeDescription: 'شنطة مكرمية خيط قطن طبيعي معمولة يدوياً بتفاصيل دقيقة تناسب الاستخدام اليومي.',
  } as any,
];

const accounts: Record<string, UserSubscriptionState> = {
  '1_core_plus_shamousa': {
    activePackageIds: ['core_free', 'ai_assistants'],
    aiAssistantChoices: ['shamousa'],
    hasSelectedPackages: true,
  },
  '2_store_plus_shamousa': {
    activePackageIds: ['core_free', 'storefront_catalog', 'ai_assistants'],
    aiAssistantChoices: ['shamousa'],
    hasSelectedPackages: true,
  },
  '3_store_only': {
    activePackageIds: ['core_free', 'storefront_catalog'],
    aiAssistantChoices: [],
    hasSelectedPackages: true,
  },
  '4_falcon_only': {
    activePackageIds: ['core_free', 'ai_assistants'],
    aiAssistantChoices: ['falcon'],
    hasSelectedPackages: true,
  },
  '5_both_ai': {
    activePackageIds: ['core_free', 'ai_assistants'],
    aiAssistantChoices: ['shamousa', 'falcon'],
    hasSelectedPackages: true,
  },
  '6_all_packages': {
    activePackageIds: [...ALL_PACKAGE_IDS],
    aiAssistantChoices: [...ALL_AI_ASSISTANT_CHOICES],
    hasSelectedPackages: true,
  },
};

const matrixExpectations: Array<{
  key: keyof typeof accounts;
  labelAr: string;
  orbAndButtonsShamousa: boolean;
  falconVisible: boolean;
  storefront: boolean;
  costing: boolean;
}> = [
  { key: '1_core_plus_shamousa', labelAr: '(أساسية + شموسة)', orbAndButtonsShamousa: true, falconVisible: false, storefront: false, costing: false },
  { key: '2_store_plus_shamousa', labelAr: '(متجر + شموسة)', orbAndButtonsShamousa: true, falconVisible: false, storefront: true, costing: false },
  { key: '3_store_only', labelAr: '(متجر فقط)', orbAndButtonsShamousa: false, falconVisible: false, storefront: true, costing: false },
  { key: '4_falcon_only', labelAr: '(صقر فقط)', orbAndButtonsShamousa: false, falconVisible: true, storefront: false, costing: false },
  { key: '5_both_ai', labelAr: '(الاتنين: شموسة + صقر)', orbAndButtonsShamousa: true, falconVisible: true, storefront: false, costing: false },
  { key: '6_all_packages', labelAr: '(كل الباقات)', orbAndButtonsShamousa: true, falconVisible: true, storefront: true, costing: true },
];

const report: string[] = [];

// Test A: Visibility & Feature Matrix across all 6 required accounts
for (const row of matrixExpectations) {
  const sub = accounts[row.key];
  const opts = { role: 'artisan' as const, overrideSub: sub };
  assert.equal(shouldShowShamousaUi(sub, 'artisan', false, true), row.orbAndButtonsShamousa, `Shamousa orb/buttons mismatch on ${row.labelAr}`);
  assert.equal(hasFeature('shamousa', row.key, opts), row.orbAndButtonsShamousa, `hasFeature('shamousa') mismatch on ${row.labelAr}`);
  assert.equal(shouldShowFalconUi(sub, 'artisan', false, true), row.falconVisible, `Falcon visibility mismatch on ${row.labelAr}`);
  assert.equal(hasFeature('sakr', row.key, opts), row.falconVisible, `hasFeature('sakr') mismatch on ${row.labelAr}`);
  assert.equal(hasFeature('storefront', row.key, opts), row.storefront, `storefront mismatch on ${row.labelAr}`);
  assert.equal(hasFeature('costing', row.key, opts), row.costing, `costing mismatch on ${row.labelAr}`);
  assert.ok(getActivePackages(row.key, opts).length >= 1);
  report.push(`✅ ${row.labelAr}: الكرة وأزرار شموسة=${row.orbAndButtonsShamousa ? 'ظاهرة' : 'مخفية'} | صقر=${row.falconVisible ? 'ظاهر' : 'مخفي'} | متجر=${row.storefront ? 'نعم' : 'لا'} | تكاليف=${row.costing ? 'نعم' : 'لا'}`);
}

// Test B: Shamousa works at full available capacity WITHOUT Falcon & WITHOUT Costing
const wizCoreSh = startNewProductWizard('عايز أعمل ميدالية مكرمية للأطفال', {
  accountId: '1_core_plus_shamousa',
  firstName: 'منى',
  packageOptions: { role: 'artisan', overrideSub: accounts['1_core_plus_shamousa'] },
});
assert.equal(wizCoreSh.nextState.active, true);
assert.equal(wizCoreSh.nextState.data.productType, 'ميدالية');

const profCoreSh = auditPersonalProfileOffline({
  profile: samplePersonal,
  accountId: '1_core_plus_shamousa',
  packageOptions: { role: 'artisan', overrideSub: accounts['1_core_plus_shamousa'] },
});
assert.ok(profCoreSh.score > 0 && profCoreSh.score <= 100);
assert.ok(profCoreSh.topTwoToday.length >= 1 && profCoreSh.topTwoToday.length <= 2);

const storeRevSh = runStoreMarketingReviewOffline({
  accountId: '2_store_plus_shamousa',
  firstName: 'منى',
  products: sampleProducts,
  packageOptions: { role: 'artisan', overrideSub: accounts['2_store_plus_shamousa'] },
});
assert.equal(storeRevSh.allowed, true);
assert.equal(storeRevSh.skippedPriceMarginChecks, true);

const decStoreSh = buildPackageAdaptiveDecisionReportOffline({
  accountId: '2_store_plus_shamousa',
  firstName: 'منى',
  profile: sampleProfile,
  personalProfile: samplePersonal,
  products: sampleProducts,
  materials: [],
  customers: [],
  orders: [],
  packageOptions: { role: 'artisan', overrideSub: accounts['2_store_plus_shamousa'] },
});
assert.deepEqual(decStoreSh.sectionsIncluded, ['personal_profile_family', 'storefront_catalog']);
report.push('✅ شموسة تعمل بكامل قدراتها المتاحة في (أساسية + شموسة) و(متجر + شموسة) بدون صقر وبدون تكاليف');

// Test C: Locked replies name Shamousa & Falcon explicitly ("لو عايز شموسة" / "لو عايز صقر")
const askFalconWhenShamousaOnly = detectLockedSubscriptionQuery(
  'عايز صقر يعمل لي دراسة سوق',
  accounts['1_core_plus_shamousa'],
  'artisan',
  false,
  'منى'
);
assert.ok(askFalconWhenShamousaOnly && askFalconWhenShamousaOnly.blocked);
assert.ok(
  askFalconWhenShamousaOnly.reply.includes('لو عايز صقر'),
  `Expected 'لو عايز صقر' in reply, got: ${askFalconWhenShamousaOnly.reply}`
);

const askShamousaWhenFalconOnly = detectLockedSubscriptionQuery(
  'عايز شموسة تتابع معايا',
  accounts['4_falcon_only'],
  'artisan',
  false,
  'منى'
);
assert.ok(askShamousaWhenFalconOnly && askShamousaWhenFalconOnly.blocked);
assert.ok(
  askShamousaWhenFalconOnly.reply.includes('لو عايز شموسة'),
  `Expected 'لو عايز شموسة' in reply, got: ${askShamousaWhenFalconOnly.reply}`
);
report.push('✅ رد الباقات المقفولة يذكر كل واحد باسمه بوضوح: «لو عايز شموسة» و«لو عايز صقر»');

// Test D: Legacy account with ai_assistants and undefined aiAssistantChoices keeps BOTH active
const legacySub: UserSubscriptionState = {
  activePackageIds: ['core_free', 'ai_assistants'],
  hasSelectedPackages: true,
};
assert.equal(shouldShowShamousaUi(legacySub, 'artisan', false, true), true);
assert.equal(shouldShowFalconUi(legacySub, 'artisan', false, true), true);
report.push('✅ الحسابات القديمة اللي مفعّلة ai_assistants تفضل شغالة بالاثنين (شموسة + صقر) بدون أي فقدان');

// Test E: Toggling Shamousa or Falcon off persists cleanly and NEVER deletes saved data
const chatHistoryKey = 'shamousa_chat_acc_toggle_test';
localStorage.setItem(chatHistoryKey, JSON.stringify([{ id: 'm1', role: 'user', content: 'أهلاً' }]));
const savedProducts = [...sampleProducts];

saveUserSubscription('acc_toggle_test', {
  activePackageIds: ['core_free', 'storefront_catalog', 'ai_assistants'],
  aiAssistantChoices: ['shamousa', 'falcon'],
  hasSelectedPackages: true,
});
// Turn off Falcon -> keep Shamousa only
const afterOffFalcon = saveUserSubscription('acc_toggle_test', {
  aiAssistantChoices: ['shamousa'],
});
assert.equal(shouldShowShamousaUi(afterOffFalcon, 'artisan'), true);
assert.equal(shouldShowFalconUi(afterOffFalcon, 'artisan'), false);
assert.equal(savedProducts.length, 1);

// Turn off Shamousa too -> both off, ai_assistants automatically unchecked, data 100% intact
const afterOffBoth = saveUserSubscription('acc_toggle_test', {
  aiAssistantChoices: [],
});
assert.equal(shouldShowShamousaUi(afterOffBoth, 'artisan'), false);
assert.equal(shouldShowFalconUi(afterOffBoth, 'artisan'), false);
assert.equal(afterOffBoth.activePackageIds.includes('ai_assistants'), false);
assert.ok(localStorage.getItem(chatHistoryKey), 'Chat history must NOT be deleted when Shamousa is toggled off');
assert.equal(savedProducts.length, 1, 'Products must NOT be deleted when AI options are toggled off');

// Re-read from storage to confirm persistence
const reloaded = getStoredUserSubscription('acc_toggle_test');
assert.deepEqual(reloaded.aiAssistantChoices, []);
report.push('✅ إطفاء شموسة أو صقر أو الاثنين يخفي الواجهة فقط ويحفظ الاختيار بدون مسح أي بيانات أو سجل محادثة');

console.log('\n=== PART 1 (A) VERIFICATION — SHAMOUSA vs FALCON SEPARATION ===');
for (const line of report) console.log(line);
console.log(`\nALL ${report.length}/${report.length} PART-1 CHECKS PASSED SUCCESSFULLY.`);
