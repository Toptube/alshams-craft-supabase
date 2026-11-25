import assert from 'node:assert/strict';
import {
  sanitizePublicMarketItem,
  processMarketShamousaMessage,
  runQuickGiftWizardOffline,
  checkTechnicalProblemLeadMagnetOffline,
} from '../src/services/shamousaMarketEngine';
import {
  PublicCompareItem,
  narrowCompareItemsWithShamousa,
  detectSameStoreShippingGroups,
  buildWishlistWhatsAppShareText,
  buildCompareWhatsAppShareText,
  buildWhatsAppShareUrl,
  buildFacebookShareUrl,
  buildSupplierBulkRfqGroups,
} from '../src/services/marketCompareService';
import {
  buildLandingWelcomeReply,
  handleLandingRoleSelected,
  handleLandingLevelSelected,
  processLandingShamousaMessage,
} from '../src/services/shamousaLandingEngine';

console.log('=== Verifying Phase 1: Markets/Storefronts Shamousa + Favorites/Compare + Landing Page Shamousa ===');

// 1. Strict privacy sanitization (zero internal costs/margins leaked)
const rawDirtyItem: any = {
  id: 'prod_1',
  name: 'معلقة مكرمية أوف وايت مودرن',
  description: 'هدية بيت جديد ومناسبة زواج وعروسة',
  craftOrCategory: 'مكرمية',
  priceEgp: 420,
  inStock: true,
  colors: ['أوف وايت', 'بيج'],
  sizes: ['50×70 سم'],
  storeName: 'ورشة النور للمكرمية',
  storeId: 'ws_1',
  // sensitive fields that MUST be stripped:
  materialCost: 110,
  unitCost: 150,
  profitMargin: 64,
  netProfit: 270,
  privateNotes: 'سر الورشة',
};

const cleanItem = sanitizePublicMarketItem(rawDirtyItem);
assert.equal((cleanItem as any).materialCost, undefined, 'materialCost must be stripped');
assert.equal((cleanItem as any).unitCost, undefined, 'unitCost must be stripped');
assert.equal((cleanItem as any).profitMargin, undefined, 'profitMargin must be stripped');
assert.equal((cleanItem as any).netProfit, undefined, 'netProfit must be stripped');
assert.equal((cleanItem as any).privateNotes, undefined, 'privateNotes must be stripped');
assert.equal(cleanItem.priceEgp, 420);
console.log('✅ 1. Public privacy sanitizer strips all internal costs & private fields');

// 2. Real grid filtering + Save-Shipping hint + Store privacy respect
const sampleCatalog = [
  cleanItem,
  sanitizePublicMarketItem({
    id: 'prod_2',
    name: 'كوشن مكرمية بيج قطن',
    description: 'هدية ديكور بيت جديد',
    craftOrCategory: 'مكرمية',
    priceEgp: 350,
    inStock: true,
    colors: ['بيج'],
    storeName: 'ورشة النور للمكرمية',
    storeId: 'ws_1',
  }),
  sanitizePublicMarketItem({
    id: 'prod_3',
    name: 'صينية ريزن إيبوكسي ذهبي',
    description: 'هدية خطوبة فخمة',
    craftOrCategory: 'ريزن',
    priceEgp: 980,
    inStock: false,
    colors: ['ذهبي', 'أبيض'],
    storeName: 'جاليري الفن',
    storeId: 'ws_2',
  }),
];

const budgetReply = processMarketShamousaMessage({
  rawQuery: 'عايز هدية مكرمية في حدود 500 جنيه',
  mode: 'alshams_market',
  catalog: sampleCatalog,
  isAuthenticated: false,
});
assert.ok(budgetReply.filterToApply, 'Should return real grid filter');
assert.deepEqual(
  budgetReply.filterToApply!.matchedIds.sort(),
  ['prod_1', 'prod_2'],
  'Should filter to Macrame items <= 500 EGP'
);
assert.ok(
  budgetReply.shippingSaveHintAr && budgetReply.shippingSaveHintAr.includes('ورشة النور للمكرمية'),
  'Should detect same-store shipping saving group'
);

const privateStoreReply = processMarketShamousaMessage({
  rawQuery: 'بكام المعلقة المكرمية في حدود 500؟',
  mode: 'artisan_storefront',
  catalog: sampleCatalog,
  storeName: 'ورشة النور',
  privacy: { hidePrices: true, disableDirectOrders: true },
  isAuthenticated: false,
});
assert.ok(
  privateStoreReply.text.includes('إخفاء الأسعار') || privateStoreReply.text.includes('الأسعار'),
  'Should respect store hidePrices privacy setting'
);
assert.ok(!privateStoreReply.text.includes('420 ج.م'), 'Must not leak hidden price in reply text');
console.log('✅ 2. Offline market engine filters grid, hints same-store shipping, and enforces store privacy');

// 3. Quick Gift Wizard (2-click Occasion -> Budget)
const giftRes = runQuickGiftWizardOffline('wedding_house', 'mid_300_700', sampleCatalog);
assert.ok(giftRes.filterToApply, 'Quick Gift wizard must produce grid filter');
assert.ok(giftRes.filterToApply!.matchedIds.includes('prod_1'), 'Should match house/wedding gift within 300-700 EGP');
console.log('✅ 3. Quick Gift Wizard (2-click) works offline accurately');

// 4. Technical Problem Lead Magnet (Guest locked after 3 lines vs Authenticated unlocked)
const guestLead = checkTechnicalProblemLeadMagnetOffline('عندي فقاعات هواء في الريزن ومش بتروح', false);
assert.ok(guestLead, 'Guest technical question should match problem library');
assert.equal(guestLead!.isLeadMagnetLocked, true, 'Guest response must be locked after 3 free lines');
assert.ok(guestLead!.text.includes('تسجيل') || guestLead!.options.some((o) => o.action === 'open_register'));

const memberLead = checkTechnicalProblemLeadMagnetOffline('عندي فقاعات هواء في الريزن ومش بتروح', true);
assert.ok(memberLead);
assert.ok(!memberLead!.isLeadMagnetLocked, 'Authenticated member must get full solution unlocked');
console.log('✅ 4. Technical Problem Lead Magnet locks for guests (3 free lines) and unlocks for members');

// 5. Compare Service (separate from cart, Shamousa narrowing, WhatsApp/FB share, B2B RFQ)
const compareList: PublicCompareItem[] = [
  {
    id: 'sup_1',
    scope: 'supplier',
    name: 'خيط مكرمية قطن 3 مم',
    priceEgp: 95,
    wholesalePriceEgp: 78,
    minWholesaleQty: 10,
    unitLabel: 'بكرة',
    inStock: true,
    storeName: 'شركة النيل للخيوط',
    storeId: 's_nile',
    publicWhatsapp: '201000111222',
    addedAt: Date.now(),
  },
  {
    id: 'sup_2',
    scope: 'supplier',
    name: 'خيط مكرمية قطن 4 مم',
    priceEgp: 110,
    wholesalePriceEgp: 90,
    minWholesaleQty: 10,
    unitLabel: 'بكرة',
    inStock: true,
    storeName: 'شركة النيل للخيوط',
    storeId: 's_nile',
    publicWhatsapp: '201000111222',
    addedAt: Date.now(),
  },
  {
    id: 'sup_3',
    scope: 'supplier',
    name: 'ريزن شفاف إيطالي 1 كجم',
    priceEgp: 650,
    wholesalePriceEgp: 580,
    minWholesaleQty: 5,
    unitLabel: 'كجم',
    inStock: false,
    storeName: 'بيت الكيماويات',
    storeId: 's_chem',
    publicWhatsapp: '201000333444',
    addedAt: Date.now(),
  },
];

const sameGroups = detectSameStoreShippingGroups(compareList);
assert.equal(sameGroups.length, 1);
assert.equal(sameGroups[0].count, 2);

const narrowed = narrowCompareItemsWithShamousa(compareList, { maxBudgetEgp: 150 });
assert.equal(narrowed.topPicks.length, 2, 'Should narrow to top items under 150 EGP');
assert.equal(narrowed.topPicks[0].item.id, 'sup_1', 'Cheapest in-stock item should rank first');

const waCompareTxt = buildCompareWhatsAppShareText(compareList, 'https://alshams.app');
assert.ok(
  waCompareTxt.includes('خيط مكرمية قطن 3 مم') &&
    (waCompareTxt.includes('95') || waCompareTxt.includes('٩٥')),
  'Compare WhatsApp share text should include product name and localized price'
);
const waWishTxt = buildWishlistWhatsAppShareText(
  [{ id: 'p1', productName: 'شنطة كروشيه', egpPrice: 300, addedAt: Date.now() }],
  'https://alshams.app'
);
assert.ok(waWishTxt.includes('شنطة كروشيه'));
assert.ok(buildFacebookShareUrl('https://alshams.app', 'مفضلتي في الشمساوية').includes('facebook.com/sharer'));

const rfqGroups = buildSupplierBulkRfqGroups(
  compareList,
  { sup_1: 20, sup_2: 15, sup_3: 5 },
  { name: 'حسام', workshop: 'ورشة الشمس' }
);
assert.equal(rfqGroups.length, 2, 'Should group RFQ by 2 distinct suppliers');
assert.ok(rfqGroups[0].messageText.includes('ورشة الشمس'));
assert.ok(buildWhatsAppShareUrl(rfqGroups[0].messageText, rfqGroups[0].publicWhatsapp).includes('wa.me/'));
console.log('✅ 5. Separate Compare ⚖️, Shamousa narrowing, WhatsApp/FB share & Supplier B2B RFQ verified');

// 6. Landing Page Interactive Offline Shamousa
const welcome = buildLandingWelcomeReply();
assert.equal(welcome.options.length, 4, 'Welcome should ask role with 4 options');

const roleArtisan = handleLandingRoleSelected('artisan');
assert.equal(roleArtisan.options.length, 3, 'Artisan role should ask level with 3 options');

const levelBeginner = handleLandingLevelSelected('artisan', 'beginner');
assert.ok(levelBeginner.filterToApply, 'Selecting role + level must return LandingSectionFilter');
assert.ok(levelBeginner.filterToApply!.visibleSectionIds.includes('landing-systems'));

// Typo-tolerant Q&A on Landing Page
const typoQa = processLandingShamousaMessage({ rawQuery: 'الباقت والاسعر مجنى ولا بكام' });
assert.ok(typoQa.text.includes('الباقة الأساسية') || typoQa.text.includes('0 ج.م'), 'Should match packages topic despite typos');
assert.ok(typoQa.filterToApply?.scrollToSectionId === 'landing-packages');

// Lead Magnet on Landing Page
const landingLead = processLandingShamousaMessage({ rawQuery: 'الريزن عندي طلع فيه فقاعات هواء اعمل ايه؟' });
assert.equal(landingLead.isLeadMagnetLocked, true, 'Landing page technical question triggers Lead Magnet');

// Out-of-scope visitor suggestion flow
const outOfScope = processLandingShamousaMessage({ rawQuery: 'هل عندكم حجز تذاكر طيران دولية وفنادق؟' });
assert.ok(outOfScope.awaitingVisitorSuggestionFor, 'Out-of-scope question should prompt for visitor suggestion');
const captured = processLandingShamousaMessage({
  rawQuery: 'أقترح إضافة شحن دولي مباشر لدول الخليج من داخل المنصة',
  awaitingSuggestionFor: outOfScope.awaitingVisitorSuggestionFor,
});
assert.ok(captured.capturedSuggestionText, 'Should capture visitor suggestion for Super Admin inbox');
console.log('✅ 6. Landing Page Interactive Offline Shamousa (Role/Level Filter, Typo Q&A, Lead Magnet, Admin Suggestions) verified');

console.log('\n🎉 ALL PHASE 1 + LANDING PAGE SHAMOUSA CHECKS PASSED 100%!');
