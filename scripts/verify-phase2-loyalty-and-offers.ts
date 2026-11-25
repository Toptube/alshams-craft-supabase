import assert from 'node:assert/strict';
import {
  DEFAULT_LOYALTY_CONFIG,
  calculatePackagesWalletRedemption,
  calculateShoppingWalletRedemption,
  evaluateStoreOfferMarginSafety,
  pointsToEgp,
  sanitizeLoyaltyConfig,
} from '../src/services/loyaltyWalletsService';
import {
  processMarketShamousaMessage,
  sanitizePublicMarketItem,
} from '../src/services/shamousaMarketEngine';
import { processLandingShamousaMessage } from '../src/services/shamousaLandingEngine';

console.log('=== Verifying Phase 2: Separate Loyalty Wallets, Super Admin Point Value, Margin Guard & Offers ===');

// 1. Default & Flexible Super Admin Point Pricing
assert.equal(DEFAULT_LOYALTY_CONFIG.pointValueEgp, 0.5, 'Default point value must be 0.50 EGP');
assert.equal(pointsToEgp(100, DEFAULT_LOYALTY_CONFIG), 50, '100 pts * 0.50 EGP = 50 EGP');

const customCfg = sanitizeLoyaltyConfig({
  pointValueEgp: 0.75,
  customerMaxDiscountPercent: 12,
  workshopMinMarginGuardPercent: 20,
});
assert.equal(customCfg.pointValueEgp, 0.75, 'Super Admin custom point value must apply cleanly');
assert.equal(pointsToEgp(100, customCfg), 75, '100 pts * 0.75 EGP = 75 EGP');
assert.equal(customCfg.customerMaxDiscountPercent, 12);
console.log('✅ 1. Flexible Super Admin point pricing (0.50 EGP default + custom rates) verified');

// 2. Strict Wallet Separation (Zero Cross-Spending!)
const blockedPackagesInCart = calculateShoppingWalletRedemption({
  cartSubtotalEgp: 1000,
  walletPoints: 200,
  walletType: 'packages_wallet',
  config: DEFAULT_LOYALTY_CONFIG,
});
assert.equal(blockedPackagesInCart.allowed, false, 'packages_wallet MUST be blocked in shopping cart');
assert.equal(blockedPackagesInCart.discountEgp, 0);

const blockedShoppingInPackages = calculatePackagesWalletRedemption({
  subscriptionTotalEgp: 300,
  walletPoints: 200,
  walletType: 'shopping_wallet',
  config: DEFAULT_LOYALTY_CONFIG,
});
assert.equal(blockedShoppingInPackages.allowed, false, 'shopping_wallet MUST be blocked in subscriptions');
assert.equal(blockedShoppingInPackages.coverageEgp, 0);
console.log('✅ 2. Strict separation between packages_wallet and shopping_wallet enforced');

// 3. Customer Shopping Cap (10–15%) + Platform-Funded Margin Protection
const validShopRedeem = calculateShoppingWalletRedemption({
  cartSubtotalEgp: 1000,
  walletPoints: 1000, // 500 EGP worth, but MUST be capped at 15% = 150 EGP!
  walletType: 'shopping_wallet',
  config: DEFAULT_LOYALTY_CONFIG,
});
assert.equal(validShopRedeem.allowed, true);
assert.equal(validShopRedeem.discountEgp, 150, 'Discount must cap strictly at 15% of 1000 EGP = 150 EGP');
assert.equal(validShopRedeem.maxRedeemablePoints, 300, '300 pts * 0.50 EGP = 150 EGP');
assert.equal(validShopRedeem.platformFunded, true, 'Discount MUST be platform-funded (zero hit to artisan margin)');
assert.ok(validShopRedeem.marginProtectedNoteAr.includes('لا يُخصم'));

const validPkgRedeem = calculatePackagesWalletRedemption({
  subscriptionTotalEgp: 200,
  walletPoints: 500, // 250 EGP worth -> covers 200 EGP with 100 pts remaining
  walletType: 'packages_wallet',
  config: DEFAULT_LOYALTY_CONFIG,
});
assert.equal(validPkgRedeem.allowed, true);
assert.equal(validPkgRedeem.coverageEgp, 200);
assert.equal(validPkgRedeem.remainingDueEgp, 0);
assert.equal(validPkgRedeem.remainingPoints, 100);
console.log('✅ 3. Shopping cap (15%), platform-funded margin protection & Packages wallet coverage verified');

// 4. Store Offer Margin Safety Guard
const safeOffer = evaluateStoreOfferMarginSafety({
  regularPriceEgp: 500,
  unitCostEgp: 300,
  discountPercent: 10, // discounted = 450, profit = 150, margin = 33.3% >= 15%
  minMarginGuardPercent: 15,
});
assert.equal(safeOffer.isSafe, true);
assert.equal(safeOffer.netProfitEgp, 150);

const unsafeOffer = evaluateStoreOfferMarginSafety({
  regularPriceEgp: 500,
  unitCostEgp: 380,
  discountPercent: 20, // discounted = 400, profit = 20, margin = 5% < 15%
  minMarginGuardPercent: 15,
});
assert.equal(unsafeOffer.isSafe, false, 'Offer dropping margin to 5% must trigger margin protection warning');
assert.ok(unsafeOffer.warningAr.includes('تنبيه حماية الهامش'));
console.log('✅ 4. Store Offer Margin Safety Guard detects safe vs margin-eroding discounts accurately');

// 5. Shamousa Offline Market + Landing Q&A on Offers, Point Pricing & Contextual Guest CTA
const sampleCatalog = [
  sanitizePublicMarketItem({
    id: 'p1',
    name: 'معلقة مكرمية بيج',
    priceEgp: 400,
    storeName: 'ورشة الشمس',
  }),
];

const guestOffersReply = processMarketShamousaMessage({
  rawQuery: 'فيه عروض إيه والنقطة بكام؟',
  mode: 'alshams_market',
  catalog: sampleCatalog,
  isAuthenticated: false,
});
assert.ok(guestOffersReply.text.includes('0.5 ج.م'), 'Shamousa must report live point value offline');
assert.ok(guestOffersReply.text.includes('15%'), 'Shamousa must report live customer cap offline');
assert.ok(guestOffersReply.text.includes('سجّل دلوقتي'), 'Guest offers reply must include contextual register CTA');
assert.ok(guestOffersReply.options.some((o) => o.action === 'open_register'));

const landingLoyaltyReply = processLandingShamousaMessage({
  rawQuery: 'قوليلي نظام النقاط والمحافظ والعروض شغال إزاي؟',
});
assert.ok(landingLoyaltyReply.text.includes('محفظة الباقات') && landingLoyaltyReply.text.includes('محفظة التسوق'));
assert.ok(landingLoyaltyReply.text.includes('0.5 ج.م'));
console.log('✅ 5. Offline Shamousa (Markets + Landing Page) answers active offers & point pricing accurately');

console.log('\n🎉 ALL PHASE 2 LOYALTY WALLETS, POINT PRICING, MARGIN GUARD & OFFERS CHECKS PASSED 100%!');
