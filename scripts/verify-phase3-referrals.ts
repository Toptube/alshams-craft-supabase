import assert from 'node:assert/strict';

// Minimal in-memory localStorage mock for Node test execution
const memStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
  setItem: (k: string, v: string) => memStorage.set(k, String(v)),
  removeItem: (k: string) => memStorage.delete(k),
  clear: () => memStorage.clear(),
};
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).window = {
  localStorage: mockLocalStorage,
  dispatchEvent: () => true,
  location: { origin: 'https://alshamsaweyya.app', search: '' },
};
(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};

import {
  REFERRAL_MILESTONE_BONUS_POINTS,
  REFERRAL_MILESTONE_TARGET,
  buildLocalAdminReferralsOverview,
  calculateMilestoneProgress,
  claimReferralCodeLocal,
  ensureReferralProfileLocal,
  getWelcomePointsForTrack,
  resolveReferralCodeLocal,
} from '../src/services/referralSystemService';
import { getAccountWalletsLocal } from '../src/services/loyaltyWalletsService';

console.log('=== Verifying Phase 3: Tri-Track Referral System (Artisan / Supplier / Trainer) ===');

// 1. Unique prefixes per track
const artisan = ensureReferralProfileLocal({
  accountId: 'ws_artisan_1',
  displayName: 'ورشة النور للمكرمية',
  track: 'artisan',
});
const supplier = ensureReferralProfileLocal({
  accountId: 'sup_nile_1',
  displayName: 'شركة النيل للخيوط',
  track: 'supplier',
});
const trainer = ensureReferralProfileLocal({
  accountId: 'trn_sara_1',
  displayName: 'المدربة سارة المعتمد',
  track: 'trainer',
});

assert.ok(artisan.code.startsWith('ART-'), 'Artisan code must start with ART-');
assert.ok(supplier.code.startsWith('SUP-'), 'Supplier code must start with SUP-');
assert.ok(trainer.code.startsWith('TRN-'), 'Trainer code must start with TRN-');
console.log(`✅ 1. Track codes generated cleanly: ${artisan.code} | ${supplier.code} | ${trainer.code}`);

// 2. Tiered platform-funded welcome points
assert.equal(getWelcomePointsForTrack(null), 10, 'Direct signup = 10 pts');
assert.equal(getWelcomePointsForTrack('artisan'), 15, 'Artisan invite = 15 pts');
assert.equal(getWelcomePointsForTrack('supplier'), 15, 'Supplier invite = 15 pts');
assert.equal(getWelcomePointsForTrack('trainer'), 25, 'Certified Trainer invite = 25 pts');

// Direct signup claim
const directClaim = claimReferralCodeLocal({
  inviteeAccountId: 'ws_direct_1',
  inviteeName: 'ورشة تسجيل مباشر',
  inviteeTrack: 'artisan',
  inviteeWalletType: 'packages_wallet',
});
assert.equal(directClaim.ok, true);
assert.equal(directClaim.welcomePointsGranted, 10);
assert.equal(getAccountWalletsLocal('ws_direct_1').packagesWalletPoints, 10);
console.log('✅ 2. Direct signup credits 10 platform-funded welcome points');

// 3. Anti-self-referral & Idempotency
const selfTry = claimReferralCodeLocal({
  inviteeAccountId: artisan.accountId,
  inviteeName: artisan.displayName,
  inviteeTrack: 'artisan',
  inviteeWalletType: 'packages_wallet',
  referralCode: artisan.code,
});
assert.equal(selfTry.ok, false, 'Self-referral MUST be rejected');

const duplicateDirectTry = claimReferralCodeLocal({
  inviteeAccountId: 'ws_direct_1',
  inviteeName: 'ورشة تسجيل مباشر',
  inviteeTrack: 'artisan',
  inviteeWalletType: 'packages_wallet',
  referralCode: trainer.code,
});
assert.equal(duplicateDirectTry.ok, false, 'Duplicate welcome claim MUST be blocked (idempotent)');
console.log('✅ 3. Anti-self-referral and one-time claim idempotency enforced');

// 4. Certified Trainer track: 25 pts + permanent badge
const trnPreview = resolveReferralCodeLocal(trainer.code);
assert.equal(trnPreview.valid, true);
assert.equal(trnPreview.welcomePoints, 25);
assert.equal(trnPreview.grantsTrainerBadge, true);

const traineeClaim = claimReferralCodeLocal({
  inviteeAccountId: 'ws_trainee_1',
  inviteeName: 'ورشة متدربة جديدة',
  inviteeTrack: 'artisan',
  inviteeWalletType: 'packages_wallet',
  referralCode: trainer.code,
});
assert.equal(traineeClaim.ok, true);
assert.equal(traineeClaim.welcomePointsGranted, 25);
assert.ok(
  traineeClaim.trainerBadge?.labelAr.includes('تحت إشراف مدرب معتمد'),
  'Trainer referral MUST grant permanent certified trainer badge'
);
assert.equal(getAccountWalletsLocal('ws_trainee_1').packagesWalletPoints, 25);
console.log('✅ 4. Certified Trainer referral grants 25 pts + permanent «تحت إشراف مدرب معتمد 🎓» badge');

// 5. Supplier track: 15 pts + automatic link into «مورديني المفضلين»
const supClaim = claimReferralCodeLocal({
  inviteeAccountId: 'ws_from_supplier_1',
  inviteeName: 'ورشة عميل المورد',
  inviteeTrack: 'artisan',
  inviteeWalletType: 'packages_wallet',
  referralCode: supplier.code,
});
assert.equal(supClaim.ok, true);
assert.equal(supClaim.welcomePointsGranted, 15);
assert.equal(supClaim.linkedSupplier?.supplierAccountId, supplier.accountId);
assert.equal(supClaim.inviteeProfile?.preferredSuppliers.length, 1);
assert.equal(supClaim.inviteeProfile?.preferredSuppliers[0].supplierName, 'شركة النيل للخيوط');
console.log('✅ 5. Supplier referral grants 15 pts + auto-links supplier into «مورديني المفضلين»');

// 6. 5-Activation Milestone -> Automatic +50 pts into Referrer's packages_wallet (and 10th -> another +50 pts!)
for (let i = 1; i <= 10; i++) {
  const res = claimReferralCodeLocal({
    inviteeAccountId: `ws_art_inv_${i}`,
    inviteeName: `ورشة مدعوة رقم ${i}`,
    inviteeTrack: 'artisan',
    inviteeWalletType: 'packages_wallet',
    referralCode: artisan.code,
  });
  assert.equal(res.ok, true);
  assert.equal(res.welcomePointsGranted, 15);
  if (i === 5 || i === 10) {
    assert.equal(
      res.referrerMilestoneBonusGranted,
      REFERRAL_MILESTONE_BONUS_POINTS,
      `Activation #${i} MUST trigger +50 pts milestone bonus`
    );
  } else {
    assert.equal(res.referrerMilestoneBonusGranted, 0);
  }
}

const artisanWallet = getAccountWalletsLocal(artisan.accountId);
assert.equal(
  artisanWallet.packagesWalletPoints,
  100,
  '10 verified activations must credit exactly 100 pts (2 × 50) into packages_wallet'
);
assert.equal(
  artisanWallet.shoppingWalletPoints,
  0,
  'Referral milestone bonuses MUST stay strictly in packages_wallet (never leak to shopping_wallet)'
);

const prog = calculateMilestoneProgress(7, 1);
assert.equal(prog.currentInCycle, 2);
assert.equal(prog.targetPerMilestone, REFERRAL_MILESTONE_TARGET);
assert.equal(prog.remainingForNextBonus, 3);
console.log('✅ 6. Every 5 real activations automatically credits +50 pts into Referrer packages_wallet (10 -> +100 pts)');

// 7. Super Admin overview aggregates accurately
const overview = buildLocalAdminReferralsOverview();
assert.equal(overview.byTrack.artisan.activations, 10);
assert.equal(overview.byTrack.supplier.activations, 1);
assert.equal(overview.byTrack.trainer.activations, 1);
assert.equal(overview.totalMilestoneBonusesPaidCount, 2);
assert.equal(overview.totalMilestoneBonusPoints, 100);
assert.equal(overview.topReferrers[0].accountId, artisan.accountId);
console.log('✅ 7. Super Admin Tri-Track Referrals overview KPIs & leaderboard verified');

console.log('\n🎉 ALL PHASE 3 TRI-TRACK REFERRAL SYSTEM CHECKS PASSED 100%!');
