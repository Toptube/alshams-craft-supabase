// ============================================================================
// نظام الدعوات الثلاثي لمنظومة الشمساوية — Phase 3 (Tri-Track Referral System)
// - 3 مسارات مستقلة: فنان (ART-) · مورّد (SUP-) · مدرب معتمد (TRN-)
// - نقاط ترحيب متدرجة مموّلة من المنصة 100%:
//     تسجيل مباشر = 10 نقاط
//     دعوة فنان أو مورّد = 15 نقطة
//     دعوة مدرب معتمد = 25 نقطة + شارة دائمة «تحت إشراف مدرب معتمد 🎓»
// - مكافأة الإنجاز التلقائية: كل 5 تفعيلات حقيقية -> +50 نقطة في «محفظة الباقات»
// - ربط تلقائي للمورّد: أي ورشة تسجل بكود مورّد ينزل المورّد فوراً في «مورديني المفضلين»
// - حماية ضد الاحتيال: منع الدعوة الذاتية + عدم تكرار الاستفادة (Idempotent)
// ============================================================================

import {
  WalletType,
  mutateAccountWalletLocal,
  loadLoyaltyConfig,
} from './loyaltyWalletsService';

export type ReferralTrack = 'artisan' | 'supplier' | 'trainer';

export interface CertifiedTrainerBadge {
  trainerAccountId: string;
  trainerName: string;
  trainerCode: string;
  labelAr: string;
  grantedAt: string;
}

export interface PreferredSupplierLink {
  supplierAccountId: string;
  supplierName: string;
  supplierCode: string;
  linkedAt: string;
  source: 'referral_auto_link' | 'manual';
}

export interface ReferralProfile {
  accountId: string;
  displayName: string;
  track: ReferralTrack;
  code: string;
  verifiedActivationsCount: number;
  milestonesPaidCount: number;
  totalBonusPointsEarned: number;
  referredByCode?: string;
  referredByTrack?: ReferralTrack;
  referredByName?: string;
  welcomePointsClaimed?: number;
  certifiedTrainerBadge?: CertifiedTrainerBadge | null;
  preferredSuppliers: PreferredSupplierLink[];
  createdAt: string;
  updatedAt: string;
}

export interface ReferralActivationRecord {
  id: string;
  referrerAccountId: string;
  referrerName: string;
  referrerCode: string;
  track: ReferralTrack;
  inviteeAccountId: string;
  inviteeName: string;
  inviteeWalletType: WalletType;
  welcomePointsGranted: number;
  trainerBadgeGranted: boolean;
  supplierAutoLinked: boolean;
  milestoneBonusTriggeredPoints: number;
  activatedAt: string;
}

export interface ReferralStoreData {
  profilesByAccount: Record<string, ReferralProfile>;
  codeToAccount: Record<string, string>;
  activations: ReferralActivationRecord[];
}

export interface ReferralMilestoneProgress {
  verifiedActivationsCount: number;
  currentInCycle: number;
  targetPerMilestone: number;
  remainingForNextBonus: number;
  milestonesPaidCount: number;
  newMilestonesEarned: number;
  bonusPointsPerMilestone: number;
  percentComplete: number;
}

export interface ReferralResolvePreview {
  valid: boolean;
  code: string;
  track?: ReferralTrack;
  trackLabelAr?: string;
  referrerName?: string;
  welcomePoints: number;
  grantsTrainerBadge: boolean;
  autoLinksSupplier: boolean;
  messageAr: string;
}

export interface ReferralClaimResult {
  ok: boolean;
  error?: string;
  welcomePointsGranted: number;
  inviteeWalletType: WalletType;
  trainerBadge?: CertifiedTrainerBadge | null;
  linkedSupplier?: PreferredSupplierLink | null;
  referrerMilestoneBonusGranted: number;
  inviteeProfile?: ReferralProfile;
  referrerProfile?: ReferralProfile;
}

export interface AdminReferralsOverview {
  totalProfiles: number;
  totalActivations: number;
  byTrack: Record<ReferralTrack, { profiles: number; activations: number }>;
  totalWelcomePointsGranted: number;
  totalMilestoneBonusesPaidCount: number;
  totalMilestoneBonusPoints: number;
  topReferrers: ReferralProfile[];
  recentActivations: ReferralActivationRecord[];
}

export const REFERRAL_MILESTONE_TARGET = 5;
export const REFERRAL_MILESTONE_BONUS_POINTS = 50;

export const REFERRAL_WELCOME_POINTS = {
  direct: 10,
  artisan: 15,
  supplier: 15,
  trainer: 25,
} as const;

const REFERRALS_STORAGE_KEY = 'alshams_referral_system_store_v1';
const PENDING_REF_CODE_KEY = 'alshams_pending_ref_code_v1';

const hasStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function getReferralTrackLabelAr(track: ReferralTrack): string {
  if (track === 'trainer') return 'مدرب معتمد 🎓';
  if (track === 'supplier') return 'مورّد خامات 📦';
  return 'فنان / ورشة 🎨';
}

export function getWelcomePointsForTrack(track?: ReferralTrack | null): number {
  if (!track) return REFERRAL_WELCOME_POINTS.direct;
  return REFERRAL_WELCOME_POINTS[track] ?? REFERRAL_WELCOME_POINTS.direct;
}

export function normalizeReferralCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 24);
}

export function detectTrackFromCodePrefix(code: string): ReferralTrack | null {
  const c = normalizeReferralCode(code);
  if (c.startsWith('TRN-')) return 'trainer';
  if (c.startsWith('SUP-')) return 'supplier';
  if (c.startsWith('ART-')) return 'artisan';
  return null;
}

// توليد كود دعوة حتمي فريد حسب نوع المسار (ART- / SUP- / TRN-)
export function generateReferralCode(accountId: string, track: ReferralTrack): string {
  const prefix = track === 'trainer' ? 'TRN' : track === 'supplier' ? 'SUP' : 'ART';
  const clean = String(accountId || 'member').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  let val = (hash >>> 0) || 135791;
  for (let i = 0; i < 6; i++) {
    body += alphabet[val % alphabet.length];
    val = Math.floor(val / alphabet.length) ^ ((hash >>> (i * 3)) + 31 * (i + 1));
    val = Math.abs(val);
  }
  return `${prefix}-${body}`;
}

export function calculateMilestoneProgress(
  verifiedActivationsCount: number,
  milestonesPaidCount: number
): ReferralMilestoneProgress {
  const safeCount = Math.max(0, Math.floor(Number(verifiedActivationsCount) || 0));
  const safePaid = Math.max(0, Math.floor(Number(milestonesPaidCount) || 0));
  const totalEarnedMilestones = Math.floor(safeCount / REFERRAL_MILESTONE_TARGET);
  const newMilestonesEarned = Math.max(0, totalEarnedMilestones - safePaid);
  const currentInCycle = safeCount % REFERRAL_MILESTONE_TARGET;
  const remainingForNextBonus =
    currentInCycle === 0 ? REFERRAL_MILESTONE_TARGET : REFERRAL_MILESTONE_TARGET - currentInCycle;
  const percentComplete = Math.round((currentInCycle / REFERRAL_MILESTONE_TARGET) * 100);

  return {
    verifiedActivationsCount: safeCount,
    currentInCycle,
    targetPerMilestone: REFERRAL_MILESTONE_TARGET,
    remainingForNextBonus,
    milestonesPaidCount: safePaid,
    newMilestonesEarned,
    bonusPointsPerMilestone: REFERRAL_MILESTONE_BONUS_POINTS,
    percentComplete,
  };
}

// ============================================================================
// التخزين المحلي والأحداث
// ============================================================================

export function loadReferralStoreLocal(): ReferralStoreData {
  if (!hasStorage()) {
    return { profilesByAccount: {}, codeToAccount: {}, activations: [] };
  }
  try {
    const raw = window.localStorage.getItem(REFERRALS_STORAGE_KEY);
    if (!raw) return { profilesByAccount: {}, codeToAccount: {}, activations: [] };
    const parsed = JSON.parse(raw);
    return {
      profilesByAccount:
        parsed?.profilesByAccount && typeof parsed.profilesByAccount === 'object'
          ? parsed.profilesByAccount
          : {},
      codeToAccount:
        parsed?.codeToAccount && typeof parsed.codeToAccount === 'object'
          ? parsed.codeToAccount
          : {},
      activations: Array.isArray(parsed?.activations) ? parsed.activations : [],
    };
  } catch {
    return { profilesByAccount: {}, codeToAccount: {}, activations: [] };
  }
}

export function saveReferralStoreLocal(store: ReferralStoreData): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(REFERRALS_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('alshams_referrals_updated'));
  } catch {}
}

export function ensureReferralProfileLocal(params: {
  accountId: string;
  displayName: string;
  track: ReferralTrack;
}): ReferralProfile {
  const key = String(params.accountId || '').trim().toLowerCase();
  const store = loadReferralStoreLocal();
  const existing = store.profilesByAccount[key];
  if (existing) {
    if (params.displayName && existing.displayName !== params.displayName) {
      existing.displayName = params.displayName;
      existing.updatedAt = new Date().toISOString();
      saveReferralStoreLocal(store);
    }
    return existing;
  }

  let code = generateReferralCode(key, params.track);
  let suffix = 1;
  while (store.codeToAccount[code] && store.codeToAccount[code] !== key) {
    code = `${generateReferralCode(`${key}_${suffix}`, params.track)}`;
    suffix++;
  }

  const now = new Date().toISOString();
  const created: ReferralProfile = {
    accountId: key,
    displayName: params.displayName || 'عضو الشمساوية',
    track: params.track,
    code,
    verifiedActivationsCount: 0,
    milestonesPaidCount: 0,
    totalBonusPointsEarned: 0,
    certifiedTrainerBadge: null,
    preferredSuppliers: [],
    createdAt: now,
    updatedAt: now,
  };

  store.profilesByAccount[key] = created;
  store.codeToAccount[code] = key;
  saveReferralStoreLocal(store);
  return created;
}

export function resolveReferralCodeLocal(rawCode: string): ReferralResolvePreview {
  const code = normalizeReferralCode(rawCode);
  if (!code) {
    return {
      valid: false,
      code: '',
      welcomePoints: REFERRAL_WELCOME_POINTS.direct,
      grantsTrainerBadge: false,
      autoLinksSupplier: false,
      messageAr: `التسجيل المباشر يمنحك ${REFERRAL_WELCOME_POINTS.direct} نقاط ترحيبية مموّلة من المنصة.`,
    };
  }

  const store = loadReferralStoreLocal();
  const ownerKey = store.codeToAccount[code];
  const owner = ownerKey ? store.profilesByAccount[ownerKey] : null;
  if (owner) {
    const pts = getWelcomePointsForTrack(owner.track);
    return {
      valid: true,
      code,
      track: owner.track,
      trackLabelAr: getReferralTrackLabelAr(owner.track),
      referrerName: owner.displayName,
      welcomePoints: pts,
      grantsTrainerBadge: owner.track === 'trainer',
      autoLinksSupplier: owner.track === 'supplier',
      messageAr:
        owner.track === 'trainer'
          ? `كود مدرب معتمد (${owner.displayName}) — هتاخد ${pts} نقطة ترحيبية + شارة «تحت إشراف مدرب معتمد 🎓»!`
          : owner.track === 'supplier'
          ? `كود مورّد خامات (${owner.displayName}) — هتاخد ${pts} نقطة ترحيبية وهينزل تلقائياً في «مورديني المفضلين 📦»!`
          : `كود فنان/ورشة (${owner.displayName}) — هتاخد ${pts} نقطة ترحيبية مموّلة من المنصة!`,
    };
  }

  // Fallback تعرّف على البادئة في حالة الأوفلاين التام
  const inferredTrack = detectTrackFromCodePrefix(code);
  if (inferredTrack && code.length >= 8) {
    const pts = getWelcomePointsForTrack(inferredTrack);
    return {
      valid: true,
      code,
      track: inferredTrack,
      trackLabelAr: getReferralTrackLabelAr(inferredTrack),
      welcomePoints: pts,
      grantsTrainerBadge: inferredTrack === 'trainer',
      autoLinksSupplier: inferredTrack === 'supplier',
      messageAr:
        inferredTrack === 'trainer'
          ? `كود مدرب معتمد — هتاخد ${pts} نقطة ترحيبية + شارة «تحت إشراف مدرب معتمد 🎓»!`
          : inferredTrack === 'supplier'
          ? `كود مورّد — هتاخد ${pts} نقطة ترحيبية وربط تلقائي في «مورديني المفضلين 📦»!`
          : `كود دعوة فنان — هتاخد ${pts} نقطة ترحيبية مموّلة من المنصة!`,
    };
  }

  return {
    valid: false,
    code,
    welcomePoints: REFERRAL_WELCOME_POINTS.direct,
    grantsTrainerBadge: false,
    autoLinksSupplier: false,
    messageAr: 'كود الدعوة غير معروف. تأكد من كتابته بشكل صحيح (مثلاً ART- أو SUP- أو TRN-).',
  };
}

// التنفيذ المحلي الكامل والموحّد لمنطق التفعيل (قابل للاختبار الذاتي 100%)
export function claimReferralCodeLocal(params: {
  inviteeAccountId: string;
  inviteeName: string;
  inviteeTrack: ReferralTrack;
  inviteeWalletType: WalletType;
  referralCode?: string;
}): ReferralClaimResult {
  const inviteeKey = String(params.inviteeAccountId || '').trim().toLowerCase();
  if (!inviteeKey) {
    return {
      ok: false,
      error: 'معرّف الحساب غير صالح.',
      welcomePointsGranted: 0,
      inviteeWalletType: params.inviteeWalletType,
      referrerMilestoneBonusGranted: 0,
    };
  }

  const invitee = ensureReferralProfileLocal({
    accountId: inviteeKey,
    displayName: params.inviteeName || 'عضو جديد',
    track: params.inviteeTrack,
  });

  // منع تكرار الاستفادة الترحيبية لنفس الحساب (Idempotency)
  if (typeof invitee.welcomePointsClaimed === 'number' && invitee.welcomePointsClaimed > 0) {
    return {
      ok: false,
      error: 'تم صرف النقاط الترحيبية أو تسجيل كود الدعوة لهذا الحساب مسبقاً.',
      welcomePointsGranted: 0,
      inviteeWalletType: params.inviteeWalletType,
      referrerMilestoneBonusGranted: 0,
      inviteeProfile: invitee,
    };
  }

  const store = loadReferralStoreLocal();
  const normalizedCode = normalizeReferralCode(params.referralCode || '');

  // حالة 1: تسجيل مباشر بدون كود -> 10 نقاط ترحيبية مموّلة من المنصة
  if (!normalizedCode) {
    const directPts = getWelcomePointsForTrack(null);
    mutateAccountWalletLocal({
      accountId: inviteeKey,
      walletType: params.inviteeWalletType,
      type: 'credit',
      points: directPts,
      reasonAr: 'نقاط ترحيبية (تسجيل مباشر — مموّلة من المنصة)',
      referenceId: 'referral_welcome_direct',
      config: loadLoyaltyConfig(),
    });
    const updatedInvitee: ReferralProfile = {
      ...invitee,
      welcomePointsClaimed: directPts,
      updatedAt: new Date().toISOString(),
    };
    store.profilesByAccount[inviteeKey] = updatedInvitee;
    saveReferralStoreLocal(store);
    return {
      ok: true,
      welcomePointsGranted: directPts,
      inviteeWalletType: params.inviteeWalletType,
      referrerMilestoneBonusGranted: 0,
      inviteeProfile: updatedInvitee,
    };
  }

  const referrerKey = store.codeToAccount[normalizedCode];
  const referrer = referrerKey ? store.profilesByAccount[referrerKey] : null;
  if (!referrer) {
    return {
      ok: false,
      error: 'كود الدعوة غير موجود. تأكد من الكود أو اتركه فارغاً للتسجيل المباشر.',
      welcomePointsGranted: 0,
      inviteeWalletType: params.inviteeWalletType,
      referrerMilestoneBonusGranted: 0,
    };
  }

  // منع الدعوة الذاتية (Anti-Self-Referral)
  if (referrer.accountId === inviteeKey) {
    return {
      ok: false,
      error: 'لا يمكنك استخدام كود الدعوة الخاص بك لتفعيل حسابك.',
      welcomePointsGranted: 0,
      inviteeWalletType: params.inviteeWalletType,
      referrerMilestoneBonusGranted: 0,
    };
  }

  const now = new Date().toISOString();
  const welcomePts = getWelcomePointsForTrack(referrer.track);

  // 1) إضافة النقاط الترحيبية المتدرجة لحساب المدعو (مموّلة من المنصة)
  mutateAccountWalletLocal({
    accountId: inviteeKey,
    walletType: params.inviteeWalletType,
    type: 'credit',
    points: welcomePts,
    reasonAr:
      referrer.track === 'trainer'
        ? `نقاط ترحيبية بدعوة مدرب معتمد (${referrer.displayName}) — مموّلة من المنصة`
        : referrer.track === 'supplier'
        ? `نقاط ترحيبية بدعوة مورّد (${referrer.displayName}) — مموّلة من المنصة`
        : `نقاط ترحيبية بدعوة فنان (${referrer.displayName}) — مموّلة من المنصة`,
    referenceId: `referral_welcome_${referrer.code}`,
    config: loadLoyaltyConfig(),
  });

  // 2) شارة المدرب المعتمد الدائمة لو المسار trainer
  let trainerBadge: CertifiedTrainerBadge | null = invitee.certifiedTrainerBadge || null;
  if (referrer.track === 'trainer') {
    trainerBadge = {
      trainerAccountId: referrer.accountId,
      trainerName: referrer.displayName,
      trainerCode: referrer.code,
      labelAr: 'تحت إشراف مدرب معتمد 🎓',
      grantedAt: now,
    };
  }

  // 3) ربط المورّد تلقائياً في «مورديني المفضلين» لو المسار supplier
  let linkedSupplier: PreferredSupplierLink | null = null;
  const preferredSuppliers = [...(invitee.preferredSuppliers || [])];
  if (referrer.track === 'supplier') {
    linkedSupplier = {
      supplierAccountId: referrer.accountId,
      supplierName: referrer.displayName,
      supplierCode: referrer.code,
      linkedAt: now,
      source: 'referral_auto_link',
    };
    if (!preferredSuppliers.some((s) => s.supplierAccountId === referrer.accountId)) {
      preferredSuppliers.unshift(linkedSupplier);
    }
  }

  const updatedInvitee: ReferralProfile = {
    ...invitee,
    referredByCode: referrer.code,
    referredByTrack: referrer.track,
    referredByName: referrer.displayName,
    welcomePointsClaimed: welcomePts,
    certifiedTrainerBadge: trainerBadge,
    preferredSuppliers,
    updatedAt: now,
  };

  // 4) زيادة عداد التفعيلات الحقيقية للداعي + صرف +50 نقطة تلقائياً في «محفظة الباقات» عند كل 5 تفعيلات
  const nextCount = referrer.verifiedActivationsCount + 1;
  const progress = calculateMilestoneProgress(nextCount, referrer.milestonesPaidCount);
  let milestoneBonusGranted = 0;

  if (progress.newMilestonesEarned > 0) {
    milestoneBonusGranted = progress.newMilestonesEarned * REFERRAL_MILESTONE_BONUS_POINTS;
    mutateAccountWalletLocal({
      accountId: referrer.accountId,
      walletType: 'packages_wallet',
      type: 'credit',
      points: milestoneBonusGranted,
      reasonAr: `مكافأة إنجاز ${nextCount} تفعيلات حقيقية (نظام الدعوات الثلاثي — محفظة الباقات)`,
      referenceId: `referral_milestone_${nextCount}`,
      config: loadLoyaltyConfig(),
    });
  }

  const updatedReferrer: ReferralProfile = {
    ...referrer,
    verifiedActivationsCount: nextCount,
    milestonesPaidCount: referrer.milestonesPaidCount + progress.newMilestonesEarned,
    totalBonusPointsEarned: referrer.totalBonusPointsEarned + milestoneBonusGranted,
    updatedAt: now,
  };

  const record: ReferralActivationRecord = {
    id: `refact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    referrerAccountId: referrer.accountId,
    referrerName: referrer.displayName,
    referrerCode: referrer.code,
    track: referrer.track,
    inviteeAccountId: inviteeKey,
    inviteeName: updatedInvitee.displayName,
    inviteeWalletType: params.inviteeWalletType,
    welcomePointsGranted: welcomePts,
    trainerBadgeGranted: referrer.track === 'trainer',
    supplierAutoLinked: referrer.track === 'supplier',
    milestoneBonusTriggeredPoints: milestoneBonusGranted,
    activatedAt: now,
  };

  store.profilesByAccount[inviteeKey] = updatedInvitee;
  store.profilesByAccount[referrer.accountId] = updatedReferrer;
  store.activations = [record, ...store.activations].slice(0, 500);
  saveReferralStoreLocal(store);

  return {
    ok: true,
    welcomePointsGranted: welcomePts,
    inviteeWalletType: params.inviteeWalletType,
    trainerBadge,
    linkedSupplier,
    referrerMilestoneBonusGranted: milestoneBonusGranted,
    inviteeProfile: updatedInvitee,
    referrerProfile: updatedReferrer,
  };
}

export function buildLocalAdminReferralsOverview(): AdminReferralsOverview {
  const store = loadReferralStoreLocal();
  const profiles = Object.values(store.profilesByAccount);
  const byTrack: Record<ReferralTrack, { profiles: number; activations: number }> = {
    artisan: { profiles: 0, activations: 0 },
    supplier: { profiles: 0, activations: 0 },
    trainer: { profiles: 0, activations: 0 },
  };

  let totalMilestoneBonusesPaidCount = 0;
  let totalMilestoneBonusPoints = 0;

  for (const p of profiles) {
    if (byTrack[p.track]) {
      byTrack[p.track].profiles += 1;
      byTrack[p.track].activations += p.verifiedActivationsCount;
    }
    totalMilestoneBonusesPaidCount += p.milestonesPaidCount;
    totalMilestoneBonusPoints += p.totalBonusPointsEarned;
  }

  const totalWelcomePointsGranted = store.activations.reduce(
    (sum, a) => sum + (Number(a.welcomePointsGranted) || 0),
    0
  );

  const topReferrers = [...profiles]
    .sort((a, b) => b.verifiedActivationsCount - a.verifiedActivationsCount)
    .slice(0, 20);

  return {
    totalProfiles: profiles.length,
    totalActivations: store.activations.length,
    byTrack,
    totalWelcomePointsGranted,
    totalMilestoneBonusesPaidCount,
    totalMilestoneBonusPoints,
    topReferrers,
    recentActivations: store.activations.slice(0, 40),
  };
}

// ============================================================================
// التقاط كود الدعوة من الرابط (?ref=CODE) + بناء روابط المشاركة
// ============================================================================

export function capturePendingReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = normalizeReferralCode(params.get('ref') || '');
    if (ref && ref.length >= 4) {
      window.localStorage.setItem(PENDING_REF_CODE_KEY, ref);
      return ref;
    }
  } catch {}
  return getPendingReferralCode();
}

export function getPendingReferralCode(): string {
  if (!hasStorage()) return '';
  try {
    return normalizeReferralCode(window.localStorage.getItem(PENDING_REF_CODE_KEY) || '');
  } catch {
    return '';
  }
}

export function setPendingReferralCode(code: string): void {
  if (!hasStorage()) return;
  try {
    const norm = normalizeReferralCode(code);
    if (norm) window.localStorage.setItem(PENDING_REF_CODE_KEY, norm);
    else window.localStorage.removeItem(PENDING_REF_CODE_KEY);
  } catch {}
}

export function clearPendingReferralCode(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(PENDING_REF_CODE_KEY);
  } catch {}
}

export function buildReferralShareUrl(code: string): string {
  const norm = normalizeReferralCode(code);
  if (typeof window === 'undefined') return `https://alshamsaweyya.app/?ref=${encodeURIComponent(norm)}`;
  const origin = window.location.origin;
  return `${origin}/?ref=${encodeURIComponent(norm)}`;
}

export function buildReferralWhatsAppText(profile: ReferralProfile): string {
  const shareUrl = buildReferralShareUrl(profile.code);
  const welcomePts = getWelcomePointsForTrack(profile.track);
  if (profile.track === 'trainer') {
    return `أهلاً بك ☀️ أدعوك للتسجيل في منظومة الشمساوية بكودي كمدرب معتمد (${profile.code}) لتستفيد بـ ${welcomePts} نقطة ترحيبية مموّلة من المنصة + شارة «تحت إشراف مدرب معتمد 🎓»!\nسجّل من هنا: ${shareUrl}`;
  }
  if (profile.track === 'supplier') {
    return `أهلاً بيك ☀️ سجّل ورشتك في منظومة الشمساوية بكود الدعوة الخاص بنا (${profile.code}) لتحصل على ${welcomePts} نقطة ترحيبية مموّلة من المنصة وتنزل خاماتنا مباشرة في «مورديني المفضلين»!\nرابط التسجيل: ${shareUrl}`;
  }
  return `أهلاً بيك ☀️ جرّب منظومة الشمساوية لحساب التكاليف وسوق الشمساوية! سجّل بكود الدعوة (${profile.code}) وهتاخد ${welcomePts} نقطة ترحيبية هدية من المنصة!\nرابط التسجيل: ${shareUrl}`;
}

// ============================================================================
// المزامنة الآمنة مع السيرفر (Fallback أوفلاين سلس 100%)
// ============================================================================

export async function fetchMyReferralProfileFromServer(
  accessToken: string | undefined,
  fallback: { accountId: string; displayName: string; track: ReferralTrack }
): Promise<{ profile: ReferralProfile; progress: ReferralMilestoneProgress }> {
  const localProfile = ensureReferralProfileLocal(fallback);
  if (!accessToken) {
    return {
      profile: localProfile,
      progress: calculateMilestoneProgress(
        localProfile.verifiedActivationsCount,
        localProfile.milestonesPaidCount
      ),
    };
  }
  try {
    const query = new URLSearchParams({
      track: fallback.track,
      displayName: fallback.displayName || '',
    });
    const res = await fetch(`/api/referrals/my?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('server_failed');
    const json = await res.json();
    if (json?.ok && json.profile) {
      const store = loadReferralStoreLocal();
      const srvProfile = json.profile as ReferralProfile;
      store.profilesByAccount[srvProfile.accountId] = srvProfile;
      store.codeToAccount[srvProfile.code] = srvProfile.accountId;
      saveReferralStoreLocal(store);
      return {
        profile: srvProfile,
        progress: calculateMilestoneProgress(
          srvProfile.verifiedActivationsCount,
          srvProfile.milestonesPaidCount
        ),
      };
    }
  } catch {}
  return {
    profile: localProfile,
    progress: calculateMilestoneProgress(
      localProfile.verifiedActivationsCount,
      localProfile.milestonesPaidCount
    ),
  };
}

export async function resolveReferralCodeServer(code: string): Promise<ReferralResolvePreview> {
  const norm = normalizeReferralCode(code);
  if (!norm) return resolveReferralCodeLocal('');
  try {
    const res = await fetch('/api/public/referrals/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: norm }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.ok && json.preview) {
        return json.preview as ReferralResolvePreview;
      }
    }
  } catch {}
  return resolveReferralCodeLocal(norm);
}

export async function claimReferralCodeServer(
  accessToken: string | undefined,
  params: {
    inviteeAccountId: string;
    inviteeName: string;
    inviteeTrack: ReferralTrack;
    inviteeWalletType: WalletType;
    referralCode?: string;
  }
): Promise<ReferralClaimResult> {
  if (accessToken) {
    try {
      const res = await fetch('/api/referrals/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          referralCode: normalizeReferralCode(params.referralCode || ''),
          inviteeName: params.inviteeName,
          inviteeTrack: params.inviteeTrack,
          inviteeWalletType: params.inviteeWalletType,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        clearPendingReferralCode();
        // مزامنة النتيجة مع الكاش المحلي
        if (json.inviteeProfile) {
          const store = loadReferralStoreLocal();
          store.profilesByAccount[json.inviteeProfile.accountId] = json.inviteeProfile;
          store.codeToAccount[json.inviteeProfile.code] = json.inviteeProfile.accountId;
          saveReferralStoreLocal(store);
        }
        return json as ReferralClaimResult;
      }
      if (json?.error) {
        return {
          ok: false,
          error: json.error,
          welcomePointsGranted: 0,
          inviteeWalletType: params.inviteeWalletType,
          referrerMilestoneBonusGranted: 0,
        };
      }
    } catch {}
  }

  const localRes = claimReferralCodeLocal(params);
  if (localRes.ok) clearPendingReferralCode();
  return localRes;
}

export async function fetchAdminReferralsOverviewServer(
  accessToken: string | undefined
): Promise<AdminReferralsOverview> {
  if (accessToken) {
    try {
      const res = await fetch('/api/admin/referrals/overview', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json.overview) {
          return json.overview as AdminReferralsOverview;
        }
      }
    } catch {}
  }
  return buildLocalAdminReferralsOverview();
}
