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

// 4. Full Offline Technical Problem Diagnosis (NO 3-line lock!) + Contextual Registration CTA for Guests
const guestTech = checkTechnicalProblemLeadMagnetOffline('عندي فقاعات هواء في الريزن ومش بتروح', false);
assert.ok(guestTech, 'Guest technical question should match problem library');
assert.equal(guestTech!.isLeadMagnetLocked, false, 'Guest MUST receive full unlocked offline solution (no 3-line lock)');
assert.ok(guestTech!.text.includes('سجّل دلوقتي'), 'Guest reply must include contextual registration invitation');
assert.ok(guestTech!.options.some((o) => o.action === 'open_register'), 'Guest reply must include register CTA button');

const memberTech = checkTechnicalProblemLeadMagnetOffline('عندي فقاعات هواء في الريزن ومش بتروح', true);
assert.ok(memberTech);
assert.equal(memberTech!.isLeadMagnetLocked, false, 'Authenticated member receives full solution unlocked');
assert.ok(!memberTech!.options.some((o) => o.action === 'open_register'), 'Authenticated member should not see guest register CTA');
console.log('✅ 4. Technical Problem Library is 100% unlocked offline for all users + contextual register CTA for guests');

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

// Full Offline Technical Diagnosis on Landing Page (NO 3-line lock + contextual register CTA)
const landingTech = processLandingShamousaMessage({ rawQuery: 'الريزن عندي طلع فيه فقاعات هواء اعمل ايه؟' });
assert.equal(landingTech.isLeadMagnetLocked, false, 'Landing page technical answer must be fully unlocked offline');
assert.ok(landingTech.text.includes('سجّل دلوقتي'), 'Landing page technical answer must include contextual register CTA');

// Out-of-scope honesty (ZERO hallucination + NO auto-trapping next question in awaitingVisitorSuggestionFor!)
const outOfScope = processLandingShamousaMessage({ rawQuery: 'هل عندكم حجز تذاكر طيران دولية وفنادق؟' });
assert.equal(outOfScope.awaitingVisitorSuggestionFor, undefined, 'Out-of-scope MUST NOT auto-trap next question as a suggestion');
assert.ok(outOfScope.options.some((o) => o.action === 'not_what_i_meant'), 'Out-of-scope must offer explicit clickable suggestion button');
assert.ok(outOfScope.options.some((o) => o.action === 'navigate'), 'Out-of-scope reply should still provide gentle register CTA');

const cheeseQuery = processLandingShamousaMessage({ rawQuery: 'بتبيعوا لب وسوداني وجبنة؟' });
assert.equal(cheeseQuery.awaitingVisitorSuggestionFor, undefined);
assert.ok(cheeseQuery.text.includes('خارج تخصص'), 'Unrelated grocery question MUST honestly say it is outside specialization');
assert.ok(!cheeseQuery.filterToApply, 'Must not fabricate a fake section filter for unrelated items');

const capturedExplicit = processLandingShamousaMessage({
  rawQuery: 'أقترح إضافة شحن دولي مباشر لدول الخليج من داخل المنصة',
});
assert.ok(capturedExplicit.capturedSuggestionText, 'Explicit suggestion phrasing should capture visitor suggestion for Super Admin inbox');

// 7. Regression tests for Eng. Hossam's exact Landing Page queries!
const qCosting = processLandingShamousaMessage({ rawQuery: 'أنتم عندكم تكاليف؟' });
assert.equal(qCosting.capturedSuggestionText, undefined, 'Costing query MUST NEVER be captured as suggestion');
assert.ok(qCosting.text.includes('حاسبة التكاليف') && qCosting.text.includes('55'), 'Must clearly explain Costing Calculator & workshops');

const qMarketing = processLandingShamousaMessage({ rawQuery: 'طب أنت تقدري تساعديني على التسويق؟' });
assert.equal(qMarketing.capturedSuggestionText, undefined);
assert.ok(qMarketing.text.includes('التسويق') && qMarketing.text.includes('35'), 'Must clearly explain Marketing Engine & 35 specialties');

const qMarkets = processLandingShamousaMessage({ rawQuery: 'طب أنا سمعت أن عندكم أسواق' });
assert.equal(qMarkets.capturedSuggestionText, undefined);
assert.ok(qMarkets.text.includes('سوق الشمساوية') && qMarkets.text.includes('سوق الموردين'), 'Must mention سوق الشمساوية & سوق الموردين');
assert.ok(!qMarkets.text.includes('سوق الشمسية'), 'Must NEVER use old misspelled name سوق الشمسية');

const qMulti = processLandingShamousaMessage({ rawQuery: 'عندكم تكاليف وتسويق؟' });
assert.ok(
  (qMulti.text.includes('التكاليف') || qMulti.text.includes('تسعير')) && qMulti.text.includes('التسويق'),
  'Multi-topic query should synthesize BOTH costing and marketing'
);

const qCraft = processLandingShamousaMessage({ rawQuery: 'عندكم شغل مكرمية؟' });
assert.ok(qCraft.text.includes('مكرمية'), 'Should recognize Macrame craft directly');

console.log('✅ 6 & 7. Landing Page Shamousa Encyclopedia (Costing, Marketing, سوق الشمساوية, Multi-Topic, 35 Crafts, Honest Anti-Hallucination) verified 100%!');

// 8. Screenshot Regression Fixes: Concept-Pair Creator Detection, Classy Tone (NO يجبر بخاطرك), Anti-Hijack Suggestion Guard, 65+ Crafts & Full System Features
const qCreatorScreenshot1 = processLandingShamousaMessage({ rawQuery: 'مين صمم الشغل ده' });
assert.ok(
  qCreatorScreenshot1.text.includes('حسام بسيوني') &&
    qCreatorScreenshot1.text.includes('الشمس كرافت') &&
    qCreatorScreenshot1.text.includes('تايجوس'),
  'Screenshot 1 fix: "مين صمم الشغل ده" MUST credit Eng. Hossam Bassiouny, Al-Shams Craft & Tygos'
);

// Even if awaitingSuggestionFor is armed, asking a real question MUST NEVER be swallowed as a suggestion!
const qCreatorScreenshot2 = processLandingShamousaMessage({
  rawQuery: 'مين المهندس اللي عمل المنظومه',
  awaitingSuggestionFor: 'سؤال سابق',
});
assert.equal(qCreatorScreenshot2.capturedSuggestionText, undefined, 'Screenshot 2 fix: MUST NOT swallow question as a suggestion!');
assert.ok(
  qCreatorScreenshot2.text.includes('حسام بسيوني') && qCreatorScreenshot2.text.includes('تايجوس'),
  'Screenshot 2 fix: "مين المهندس اللي عمل المنظومه" MUST answer with Eng. Hossam Bassiouny & Tygos'
);

const qCreatorCombined = processLandingShamousaMessage({ rawQuery: 'انتي هايله مين اللي صممك' });
assert.ok(qCreatorCombined.text.includes('حسام بسيوني') && qCreatorCombined.text.includes('ذوق'));
assert.ok(!qCreatorCombined.text.includes('يجبر بخاطرك'), 'MUST NEVER contain banned local phrase');

const qOrigin = processLandingShamousaMessage({ rawQuery: 'أنتِ منين وتبع مين؟' });
assert.ok(qOrigin.text.includes('الشمس كرافت') && qOrigin.text.includes('تايجوس') && qOrigin.text.includes('حسام بسيوني'));

const qNotShamsawy = processLandingShamousaMessage({ rawQuery: 'أنا مش شمساوية' });
assert.ok(qNotShamsawy.text.includes('البيت بيتك') && qNotShamsawy.text.includes('الشمساوية'));

// Classy tone check (Screenshot 3 fix: NO يجبر بخاطرك!)
for (const praise of ['تحفه بجد', 'تسلمي', 'ما شاء الله انتي جميلة قوي']) {
  const res = processLandingShamousaMessage({ rawQuery: praise });
  assert.ok(!res.text.includes('يجبر بخاطرك'), `"${praise}" MUST NOT use banned phrase يجبر بخاطرك`);
  assert.ok(
    res.text.includes('ذوق') || res.text.includes('أعتز') || res.text.includes('يسعدني') || res.text.includes('واجبي'),
    `"${praise}" must reply with classy confident Egyptian warmth`
  );
}

const qBanterLanding = processLandingShamousaMessage({ rawQuery: 'عندك مايوه؟' });
assert.ok(qBanterLanding.text.includes('ههههه'), 'Playful banter should get warm witty Egyptian reply');

const qWhatHaveLanding = processLandingShamousaMessage({ rawQuery: 'عندك إيه؟' });
assert.ok(qWhatHaveLanding.text.includes('65+') && qWhatHaveLanding.text.includes('سوق الشمساوية'));

// Full 65+ Crafts Registry & All System Features from Day 1 until today
const qJesmonite = processLandingShamousaMessage({ rawQuery: 'عندكم جيسمونايت؟' });
assert.ok(qJesmonite.text.includes('جيسمونايت') || qJesmonite.text.includes('Jesmonite'), 'Must recognize Jesmonite from craftsRegistry');

const q3D = processLandingShamousaMessage({ rawQuery: 'عندكم طباعة ثلاثية الأبعاد؟' });
assert.ok(q3D.text.includes('3D') || q3D.text.includes('ثلاثية الأبعاد'), 'Must recognize 3D Printing from craftsRegistry');

const qAllCrafts = processLandingShamousaMessage({ rawQuery: 'إيه هي كل الحرف المدعومة؟' });
assert.ok(qAllCrafts.text.includes('14 قسماً'), 'Must list all 14 craft main sections');

const qFixedAssets = processLandingShamousaMessage({ rawQuery: 'عندكم أصول ثابتة وإهلاك معدات؟' });
assert.ok(qFixedAssets.text.includes('الأصول الثابتة') && qFixedAssets.text.includes('الإهلاك'));

const qBackup = processLandingShamousaMessage({ rawQuery: 'فيه نسخ احتياطي JSON؟' });
assert.ok(qBackup.text.includes('JSON Export'));

const qPrintA4 = processLandingShamousaMessage({ rawQuery: 'فيه طباعة A4 وتصدير PDF؟' });
assert.ok(qPrintA4.text.includes('A4') && qPrintA4.text.includes('PDF'));

const qChangelog = processLandingShamousaMessage({ rawQuery: 'إيه آخر تحديثات المنظومة؟' });
assert.ok(qChangelog.text.includes('4.1.0') && qChangelog.text.includes('سوق الشمساوية'));

const qGlossary = processLandingShamousaMessage({ rawQuery: 'يعني إيه متوسط التكلفة المرجح؟' });
assert.ok(qGlossary.text.includes('Weighted Average Cost') || qGlossary.text.includes('متوسط'));

const qGuide = processLandingShamousaMessage({ rawQuery: 'إيه شاشة هلخصهالك؟' });
assert.ok(qGuide.text.includes('هلخصهالك') && qGuide.text.includes('واتساب'));

const qGuidePos = processLandingShamousaMessage({ rawQuery: 'إزاي أطبع ريسيت 80 مم؟' });
assert.ok(qGuidePos.text.includes('80 مم') || qGuidePos.text.includes('POS'));

// Strict Surface Separation check: Market Shamousa answers creator concisely & pivots to سوق الشمساوية (no ERP dump!)
const qCreatorMarket = processMarketShamousaMessage({
  rawQuery: 'مين صمم الشغل ده',
  mode: 'alshams_market',
  catalog: sampleCatalog,
  isAuthenticated: false,
});
assert.ok(
  qCreatorMarket.text.includes('حسام بسيوني') &&
    qCreatorMarket.text.includes('الشمس كرافت') &&
    qCreatorMarket.text.includes('تايجوس'),
  'Market Shamousa must know full creator lineage'
);
assert.ok(qCreatorMarket.text.includes('سوق الشمساوية'), 'Market Shamousa must pivot back cleanly to سوق الشمساوية');
assert.ok(!qCreatorMarket.text.includes('العقول التحليلية الثلاثة'), 'Market Shamousa must stay concise & shopper-focused (separated from Landing!)');

console.log('✅ 8. Concept-Pair Creator Lore, Classy Tone, Anti-Hijack Suggestion Guard, 65+ Crafts Registry, All System Features & Strict Surface Separation verified 100%!');

console.log('\n🎉 ALL PHASE 1 + LANDING PAGE SHAMOUSA CHECKS PASSED 100%!');
