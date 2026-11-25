import type { CustomerRecord, InvoiceRecord, RawMaterialItem, SavedProductRecord, UserProfile } from '../types';
import type { MemberPersonalProfile } from '../types/memberProfile';
import {
  buildFourPartLockedPackageReply,
  buildUserSubscriptionCapabilities,
  getActivePackages,
  getStoredUserSubscription,
  hasFeature,
  type AccountPackageQueryOptions,
  type UserSubscriptionState,
} from '../types/subscriptions';
import { auditPersonalProfileOffline } from './shamousaProfileAdvisor';
import type { ShamousaCopyBlock } from './shamousaProductWizard';
import {
  buildLibraryMarketingCopy,
  understandProductSentence,
} from './shamousaProductUnderstanding';

export type ShamousaRegisteredIntent =
  | 'decision_report'
  | 'new_product_wizard'
  | 'review_products'
  | 'write_post'
  | 'whatsapp_message'
  | 'personal_profile_audit'
  | 'family_table_idea';

export interface ShamousaOpenEventDetail {
  intent?: ShamousaRegisteredIntent;
  prompt?: string;
  autoSend?: boolean;
}

/**
 * بوابة فتح شات شموسة الواحد من أي زر في المنظومة — تفتح نفس الشات وتبعث له النية.
 */
export function dispatchShamousaIntent(detail: ShamousaOpenEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ShamousaOpenEventDetail>('alshams_open_shamousa', { detail }));
}

export interface ProductMarketingReviewItem {
  productId: string;
  productName: string;
  score: number;
  checksPassed: string[];
  improvements: string[];
  skippedCostChecks: boolean;
}

export interface StoreMarketingReviewResult {
  allowed: boolean;
  lockedReply?: string;
  overallScore: number;
  totalProducts: number;
  skippedPriceMarginChecks: boolean;
  items: ProductMarketingReviewItem[];
  summaryMarkdown: string;
}

/**
 * المرحلة 2 (معدّلة): درجة التسويق ومراجعة المتجر والمنتجات أوفلاين.
 * تشتغل لأي حساب عنده متجر أو كتالوج، وتتخطى تلقائياً بنود السعر والهامش والتكلفة
 * لو باقة التكاليف مش مفعّلة أو المنتج بدون تكلفة (costPrice <= 0).
 */
export function runStoreMarketingReviewOffline(params: {
  accountId: string;
  firstName: string;
  products: SavedProductRecord[];
  packageOptions?: AccountPackageQueryOptions;
}): StoreMarketingReviewResult {
  const { accountId, firstName, products, packageOptions } = params;
  const role = packageOptions?.role || 'artisan';
  const isAdmin = Boolean(packageOptions?.isAdmin);
  const sub: UserSubscriptionState =
    packageOptions?.overrideSub || getStoredUserSubscription(accountId || undefined);

  const canReview = hasFeature('marketing_review', accountId, packageOptions);
  if (!canReview) {
    const caps = buildUserSubscriptionCapabilities(sub, role, isAdmin);
    const unlockPkgs = caps.findUnlockingPackagesForActions(
      role === 'supplier' ? ['sup_storefront', 'sup_catalog'] : ['open_artisan_store_products', 'nav_catalog']
    );
    const fourPart = buildFourPartLockedPackageReply({
      firstName,
      sub,
      role,
      isAdmin,
      lockedFeatureLabel: 'مراجعة المتجر والمنتجات والكتالوج',
      unlockingPackages: unlockPkgs,
    });
    return {
      allowed: false,
      lockedReply: fourPart.reply,
      overallScore: 0,
      totalProducts: 0,
      skippedPriceMarginChecks: true,
      items: [],
      summaryMarkdown: fourPart.reply,
    };
  }

  const canCosting = hasFeature('costing', accountId, packageOptions);
  const activeProducts = products.filter((p) => p.isActive !== false);

  if (activeProducts.length === 0) {
    return {
      allowed: true,
      overallScore: 0,
      totalProducts: 0,
      skippedPriceMarginChecks: !canCosting,
      items: [],
      summaryMarkdown:
        `🔍 **مراجعة منتجاتك يا ${firstName}:**\n` +
        `لسه مفيش منتجات متسجّلة في الكتالوج أو المتجر دلوقتي.\n` +
        `تحب نجهّز أول منتج مع بعض بـ «معالج منتج جديد» ونكتبله عنوان ووصف وقصة جاهزين؟`,
    };
  }

  let anySkippedCost = !canCosting;
  const items: ProductMarketingReviewItem[] = activeProducts.slice(0, 20).map((p) => {
    const checksPassed: string[] = [];
    const improvements: string[] = [];
    let earned = 0;
    let maxPts = 0;

    // 1) Title clarity (25 pts)
    maxPts += 25;
    const nameLen = (p.productName || '').trim().length;
    if (nameLen >= 10) {
      earned += 25;
      checksPassed.push('اسم المنتج واضح ومعبّر');
    } else {
      earned += 10;
      improvements.push('طوّل اسم المنتج شوية واذكر الخامة أو الاستخدام عشان يبان في البحث');
    }

    // 2) Description quality (25 pts)
    maxPts += 25;
    const descLen = ((p.storeDescription || p.input?.personalNotes || '') as string).trim().length;
    if (descLen >= 55) {
      earned += 25;
      checksPassed.push('الوصف مكتوب بوضوح');
    } else if (descLen >= 20) {
      earned += 14;
      improvements.push('زوّد سطرين في وصف المنتج (الخامة + المقاس + لمين ينفع)');
    } else {
      improvements.push('أضف وصف للعملاء يشرح الخامة والمميزات عشان يطمنوا ويشتروا');
    }

    // 3) Photos & gallery (30 pts) + نصيحة تصوير متخصصة من المكتبة
    maxPts += 30;
    const allImgs = [
      p.imageUrl,
      ...(Array.isArray(p.galleryUrls) ? p.galleryUrls : []),
    ]
      .map((u) => String(u || '').trim())
      .filter(Boolean);
    const galleryCount = allImgs.length;
    const uniqueImgCount = new Set(allImgs).size;
    let specPhotoHint = '';
    try {
      const understoodProd = understandProductSentence(
        `${p.productName || ''} ${p.storeDescription || ''} ${p.input?.personalNotes || ''}`
      );
      if (understoodProd.specialty?.photoTips) {
        specPhotoHint = ` — نصيحة لتخصص ${understoodProd.specialty.nameAr}: ${understoodProd.specialty.photoTips}`;
      }
    } catch {
      specPhotoHint = '';
    }
    if (galleryCount >= 3 && uniqueImgCount === galleryCount) {
      earned += 30;
      checksPassed.push(`${galleryCount} صور واضحة للمنتج`);
    } else if (galleryCount >= 1) {
      earned += 18;
      if (uniqueImgCount < galleryCount) {
        improvements.push(`في صور مكررة للمنتج — بدّل المكرر بصورة زاوية مختلفة أو أثناء الاستخدام${specPhotoHint}`);
      } else {
        improvements.push(`ارفع صورتين إضافيتين (زاوية قريبة للتفاصيل + صورة أثناء الاستخدام)${specPhotoHint}`);
      }
    } else {
      improvements.push(`ارفع صورة أساسية واضحة للمنتج في إضاءة طبيعية${specPhotoHint}`);
    }

    // 4) Retail price presence + inStore status (20 pts)
    maxPts += 20;
    const price = Number(p.storePrice || p.retailPrice || p.output?.finalSellingPrice || 0);
    if (price > 0) {
      earned += 12;
      checksPassed.push('السعر محدد للعميل');
    } else {
      improvements.push('حدّد سعر البيع عشان العميل ما يترددش');
    }
    if (p.inStore) {
      earned += 8;
      checksPassed.push('معروض في المتجر');
    } else {
      improvements.push('فعّل عرضه في المتجر لو جاهز للبيع');
    }

    // 5) Cost/Margin check ONLY if costing package is active AND product has real cost > 0
    const realCost = Number(p.costPrice || p.output?.unifiedBreakdown?.totalUnitCost || 0);
    const shouldCheckCost = canCosting && realCost > 0 && price > 0;
    if (!shouldCheckCost) {
      anySkippedCost = true;
    } else {
      maxPts += 15;
      const marginPct = Math.round(((price - realCost) / price) * 100);
      if (marginPct >= 20) {
        earned += 15;
        checksPassed.push(`هامش ربح متوازن (${marginPct}%)`);
      } else {
        earned += 5;
        improvements.push(`راجع السعر مقابل التكلفة المسجّلة لأن الهامش الحالي ${marginPct}%`);
      }
    }

    const score = maxPts > 0 ? Math.round((earned / maxPts) * 100) : 0;
    return {
      productId: p.id,
      productName: p.productName,
      score,
      checksPassed,
      improvements,
      skippedCostChecks: !shouldCheckCost,
    };
  });

  const overallScore = Math.round(items.reduce((acc, it) => acc + it.score, 0) / items.length);
  const topNeedWork = [...items].sort((a, b) => a.score - b.score).slice(0, 3);

  const lines = topNeedWork.map((it, i) => {
    const tip = it.improvements[0] || 'جاهز ومظبوط!';
    return `${i + 1}. **${it.productName}** (${it.score}/100): ${tip}`;
  });

  const externalUrlCount = activeProducts.slice(0, 20).reduce((acc, p) => {
    const urls = [p.imageUrl, ...(Array.isArray(p.galleryUrls) ? p.galleryUrls : [])].filter(Boolean) as string[];
    return acc + urls.filter((u) => /^https?:\/\//i.test(u.trim())).length;
  }, 0);
  const corsHonestLine =
    externalUrlCount > 0
      ? `\nℹ️ *ملحوظة بصراحة عن الصور:* في ${externalUrlCount} صورة بروابط خارجية المتصفح بيحجب فحص جودتها التقنية (الدقة/السطوع/الحدة) بسبب قيود CORS، فراجعت لك العدد والتكرار والوصف بس — ولو بعتّلي أي صورة مباشرة هنا في الشات هفحصلك جودتها محلياً بالـ Canvas فوراً.\n`
      : '';

  const summaryMarkdown =
    `🔍 **مراجعة منتجاتك ودرجة جاهزية العرض يا ${firstName}: ${overallScore}/100**\n` +
    `• إجمالي المنتجات التي تمت مراجعتها: **${activeProducts.length}** منتج.\n` +
    `• المنتجات المعروضة في المتجر: **${activeProducts.filter((p) => p.inStore).length}** منتج.\n\n` +
    `**أولويات التحسين السريع:**\n${lines.join('\n')}\n` +
    corsHonestLine +
    `\nلو عايز أكتبلك وصف أو بوست أو رسالة واتساب لأي منتج فيهم، قولي اسمه فوراً ☀️`;

  return {
    allowed: true,
    overallScore,
    totalProducts: activeProducts.length,
    skippedPriceMarginChecks: anySkippedCost,
    items,
    summaryMarkdown,
  };
}

export interface MinimumPriceOfferState {
  awaitingFloorPrice: boolean;
  productName?: string;
  listedPrice?: number;
}

/**
 * قاعدة 6.1: الحد الأدنى للخصم/العرض.
 * لو باقة التكاليف مش مفعّلة أو المنتج بدون تكلفة، شموسة ما تخترعش نسب خصم،
 * وتسأل المستخدم: «أقل سعر تقبل تبيع بيه كام؟» وتبني العرض على رقمه وتوضح إن الحساب من رقمه مش من الحاسبة.
 */
export function buildSafeDiscountOfferFromUserFloor(params: {
  firstName: string;
  productName: string;
  listedPrice?: number;
  userFloorPrice: number;
  currencySymbol?: string;
}): { reply: string; copyBlocks: ShamousaCopyBlock[] } {
  const currency = params.currencySymbol || 'ج.م';
  const floor = Math.max(1, Math.round(params.userFloorPrice));
  const listed = params.listedPrice && params.listedPrice > floor ? Math.round(params.listedPrice) : 0;

  let offerPrice = floor;
  let savingsLine = '';
  if (listed > floor) {
    // نختار سعر عرض فوق الحد الأدنى بهامش أمان بسيط لو فيه مساحة، أو عند الحد الأدنى
    const gap = listed - floor;
    offerPrice = gap >= 20 ? Math.round(floor + gap * 0.25) : floor;
    const saved = listed - offerPrice;
    savingsLine = `بدلاً من ${listed.toLocaleString('ar-EG')} ${currency} (توفير ${saved.toLocaleString('ar-EG')} ${currency})`;
  }

  const promoCopy =
    `✨ عرض خاص على **${params.productName}**!\n` +
    `السعر في العرض: **${offerPrice.toLocaleString('ar-EG')} ${currency}** ${savingsLine}\n` +
    `الكمية محدودة — ابعتلنا رسالة دلوقتي لحجز قطعتك 🤍`;

  const reply =
    `تمام يا **${params.firstName}** 👍 جهّزتلك عرض آمن على **«${params.productName}»** بناءً على الرقم اللي حددته:\n` +
    `• **أقل سعر إنت حددته:** ${floor.toLocaleString('ar-EG')} ${currency}\n` +
    `• **سعر العرض المقترح:** **${offerPrice.toLocaleString('ar-EG')} ${currency}** ${savingsLine}\n\n` +
    `ℹ️ *ملحوظة مهمة: الحساب ده مبني على أقل سعر إنت حددته بنفسك، مش من حاسبة التكاليف.*`;

  return {
    reply,
    copyBlocks: [
      {
        id: `offer_copy_${Date.now()}`,
        title: '🏷️ نص العرض الجاهز للنشر أو الواتساب',
        content: promoCopy,
      },
    ],
  };
}

export interface AdaptiveDecisionReportResult {
  activePackageIds: string[];
  sectionsIncluded: string[];
  markdown: string;
  actionChips: Array<{ id: string; label: string; queryText?: string; view?: string }>;
}

/**
 * المرحلة 1 (معدّلة): «تقرير القرارات» — التحليل والحلول الذكية
 * يركّب أقسامه ديناميكياً 100% حسب الباقات المفعّلة للحساب، وما يذكرش أي مصطلح لباقة مش مفعّلة!
 */
export function buildPackageAdaptiveDecisionReportOffline(params: {
  accountId: string;
  firstName: string;
  profile: UserProfile;
  personalProfile?: MemberPersonalProfile | null;
  products: SavedProductRecord[];
  materials: RawMaterialItem[];
  customers: CustomerRecord[];
  orders: InvoiceRecord[];
  packageOptions?: AccountPackageQueryOptions;
}): AdaptiveDecisionReportResult {
  const { accountId, firstName, profile, personalProfile, products, materials, customers, orders, packageOptions } =
    params;

  const activePkgs = getActivePackages(accountId, packageOptions);
  const canStorefront = hasFeature('marketing_review', accountId, packageOptions);
  const canCosting = hasFeature('costing', accountId, packageOptions);
  const canInventory = hasFeature('inventory', accountId, packageOptions);
  const canFinance = hasFeature('finance', accountId, packageOptions);
  const canSalesCrm = hasFeature('sales_crm', accountId, packageOptions);
  const currency = profile.currencySymbol || 'ج.م';

  const sections: string[] = [];
  const sectionsIncluded: string[] = [];
  const actionChips: Array<{ id: string; label: string; queryText?: string; view?: string }> = [];

  // القسم 1: الصفحة الشخصية وطبلية العيلة (مفعّل في الباقة الأساسية دائماً)
  sectionsIncluded.push('personal_profile_family');
  if (personalProfile) {
    const audit = auditPersonalProfileOffline({
      profile: personalProfile,
      accountId,
      products: canStorefront ? products : [],
      packageOptions,
    });
    sections.push(
      `### 1) صفحتك الشخصية وطبلية العيلة\n` +
        `• جاهزية صفحتك الحالية: **${audit.score}/100** (معرض الأعمال: ${audit.showcaseCount}/${audit.maxShowcase}).\n` +
        audit.topTwoToday.map((t) => `• **خطوة اليوم:** ${t.title}`).join('\n')
    );
  } else {
    sections.push(
      `### 1) صفحتك الشخصية وطبلية العيلة\n` +
        `• راجع قصتك التعريفية وصور معرض أعمالك وشارك بوست أسبوعي خفيف على طبلية عيلة الشمساوية.`
    );
  }
  actionChips.push({ id: 'dr_profile', label: 'راجع صفحتي الشخصية 👤', queryText: 'راجع صفحتي الشخصية' });

  // القسم 2: المتجر والكتالوج ومراجعة العرض (فقط لو باقة المتجر/الكتالوج مفعّلة)
  if (canStorefront) {
    sectionsIncluded.push('storefront_catalog');
    const review = runStoreMarketingReviewOffline({
      accountId,
      firstName,
      products,
      packageOptions,
    });
    const inStoreCount = products.filter((p) => p.isActive !== false && p.inStore).length;
    sections.push(
      `### 2) متجرك وعرض منتجاتك\n` +
        `• عندك **${review.totalProducts}** منتج (${inStoreCount} معروضين في المتجر) — درجة جاهزية العرض: **${review.overallScore}/100**.\n` +
        (review.items[0] && review.items.sort((a, b) => a.score - b.score)[0]?.improvements[0]
          ? `• **أهم تحسين فوري:** في منتج «${review.items[0].productName}»: ${review.items[0].improvements[0]}.`
          : `• جهّز منتج جديد أو بوست ترويجي لزيادة تفاعل العملاء مع متجرك.`)
    );
    actionChips.push({ id: 'dr_review', label: 'راجع منتجاتي بالتفصيل 🔍', queryText: 'راجع منتجاتي' });
    actionChips.push({ id: 'dr_wa', label: 'رسالة واتساب جاهزة 💬', queryText: 'رسالة واتساب' });
  }

  // القسم 3: التكاليف والتسعير والإنتاج (فقط لو باقة التصنيع والتسعير مفعّلة)
  if (canCosting) {
    sectionsIncluded.push('costing_production');
    const getProdCost = (p: SavedProductRecord) =>
      Number(p.costPrice || p.output?.unifiedBreakdown?.totalUnitCost || 0);
    const getProdPrice = (p: SavedProductRecord) =>
      Number(p.storePrice || p.retailPrice || p.output?.finalSellingPrice || 0);
    const costed = products.filter(
      (p) => p.isActive !== false && getProdCost(p) > 0 && getProdPrice(p) > 0
    );
    if (costed.length > 0) {
      const sortedByMargin = [...costed].sort((a, b) => {
        const ma = (getProdPrice(a) - getProdCost(a)) / Math.max(1, getProdPrice(a));
        const mb = (getProdPrice(b) - getProdCost(b)) / Math.max(1, getProdPrice(b));
        return mb - ma;
      });
      const best = sortedByMargin[0];
      const bestMargin = Math.round(
        ((getProdPrice(best) - getProdCost(best)) / Math.max(1, getProdPrice(best))) * 100
      );
      sections.push(
        `### 3) التسعير والتكاليف\n` +
          `• عندك **${costed.length}** منتج متسعّر بتكلفة فعلية.\n` +
          `• أعلى قطعة في هامش الربح حالياً: **«${best.productName}»** (هامش ~${bestMargin}%).`
      );
    } else {
      sections.push(
        `### 3) التسعير والتكاليف\n` +
          `• سجّل تكلفة أول 3 منتجات في حاسبة التكاليف عشان نطلعلك مقارنة دقيقة لهامش الربح.`
      );
    }
  }

  // القسم 4: المخازن والخامات (فقط لو باقة المخازن والمشتريات مفعّلة)
  if (canInventory) {
    sectionsIncluded.push('inventory_materials');
    const activeMats = materials.filter((m) => m.isActive !== false);
    const lowMats = activeMats.filter((m) => Number(m.currentStock || 0) <= Math.max(1, Number(m.minAlertThreshold || 3)));
    sections.push(
      `### 4) المخزون والخامات\n` +
        `• عندك **${activeMats.length}** خامة مسجّلة، منها **${lowMats.length}** قرب حد الأمان` +
        (lowMats.length > 0 ? ` (${lowMats.slice(0, 3).map((m) => m.materialName).join('، ')}).` : '.')
    );
  }

  // القسم 5: المبيعات والعملاء والمالية (فقط لو باقة المالية والعملاء مفعّلة)
  if (canFinance || canSalesCrm) {
    sectionsIncluded.push('finance_crm');
    const totalSales = orders.reduce((acc, o) => acc + Number(o.totalAmount || o.finalTotal || 0), 0);
    sections.push(
      `### 5) المبيعات والعملاء\n` +
        `• عندك **${customers.length}** عميل مسجّل و**${orders.length}** فاتورة/طلب بإجمالي **${Math.round(totalSales).toLocaleString('ar-EG')} ${currency}**.`
    );
  }

  actionChips.unshift({ id: 'dr_new_prod', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' });

  const markdown =
    `📊 **التحليل والحلول الذكية (على قد باقاتك المفعّلة) يا ${firstName}:**\n` +
    `باقاتك الحالية: ${activePkgs.map((p) => `«${p.titleAr}»`).join(' + ')}.\n\n` +
    sections.join('\n\n');

  return {
    activePackageIds: activePkgs.map((p) => p.id),
    sectionsIncluded,
    markdown,
    actionChips,
  };
}

/**
 * توليد رسائل واتساب جاهزة للنسخ أوفلاين (يشتغل فقط لما باقة المتجر/الكتالوج أو العملاء مفعّلة).
 */
export function buildWhatsAppTemplatesOffline(params: {
  accountId: string;
  firstName: string;
  brandName?: string;
  currencySymbol?: string;
  products: SavedProductRecord[];
  packageOptions?: AccountPackageQueryOptions;
}): { allowed: boolean; reply: string; copyBlocks?: ShamousaCopyBlock[]; actionLink?: { label: string; view: string } } {
  const { accountId, firstName, products, packageOptions } = params;
  const role = packageOptions?.role || 'artisan';
  const isAdmin = Boolean(packageOptions?.isAdmin);
  const sub = packageOptions?.overrideSub || getStoredUserSubscription(accountId || undefined);

  if (!hasFeature('whatsapp_messages', accountId, packageOptions)) {
    const caps = buildUserSubscriptionCapabilities(sub, role, isAdmin);
    const unlockPkgs = caps.findUnlockingPackagesForActions(
      role === 'supplier' ? ['sup_storefront', 'sup_catalog'] : ['open_artisan_store_products', 'nav_catalog']
    );
    const fourPart = buildFourPartLockedPackageReply({
      firstName,
      sub,
      role,
      isAdmin,
      lockedFeatureLabel: 'رسائل الواتساب للعملاء وعروض المتجر',
      unlockingPackages: unlockPkgs,
    });
    return {
      allowed: false,
      reply: fourPart.reply,
      actionLink: { label: 'فتح صفحة اشتراكاتي 👑', view: 'my_subscriptions' },
    };
  }

  const brand = (params.brandName || '').trim() || `ورشة ${firstName}`;
  const currency = params.currencySymbol || 'ج.م';
  const featured = products.find((p) => p.isActive !== false && p.inStore) || products.find((p) => p.isActive !== false);
  const prodName = featured?.productName || 'القطعة اليدوية الجديدة';
  const prodPrice = Number(featured?.storePrice || featured?.retailPrice || featured?.output?.finalSellingPrice || 0);
  const priceText =
    prodPrice > 0 ? `${prodPrice.toLocaleString('ar-EG')} ${currency}` : 'حسب المقاس واللون';

  let libPack: ReturnType<typeof buildLibraryMarketingCopy> | null = null;
  try {
    libPack = buildLibraryMarketingCopy({
      accountId,
      productName: prodName,
      priceText,
      realProductFactsText: `${prodName} ${featured?.storeDescription || ''}`,
    });
  } catch {
    libPack = null;
  }

  const copyBlocks: ShamousaCopyBlock[] = [
    {
      id: 'wa_new_product',
      title: '🛍️ عرض منتج للعملاء (سريع / ودود / رسمي)',
      content: libPack
        ? `• سريع:\n${libPack.whatsappStyles.offerFast}\n\n` +
          `• ودود:\n${libPack.whatsappStyles.offerFriendly}\n\n` +
          `• رسمي (${brand}):\n${libPack.whatsappStyles.offerFormal}`
        : `أهلاً بيك من ${brand} ☀️\n` +
          `جهّزنا ليك قطعة جديدة: *${prodName}*\n` +
          `شغل يدوي متقن وتقدر تختار اللون اللي يناسبك.\n` +
          `السعر: *${priceText}*\n` +
          `ابعتلي كلمة «تفاصيل» وهبعتلك الصور فوراً 🤍`,
    },
    {
      id: 'wa_inquiry_reply',
      title: '💬 ترحيب ورد على استفسار عميل (سريع / ودود / رسمي)',
      content: libPack
        ? `• سريع:\n${libPack.whatsappStyles.welcomeFast}\n\n` +
          `• ودود:\n${libPack.whatsappStyles.welcomeFriendly}\n\n` +
          `• رسمي (${brand}):\n${libPack.whatsappStyles.welcomeFormal}`
        : `منورنا يا فندم في ${brand} 🤍\n` +
          `متاح تنفيذ *${prodName}* مخصوص لحضرتك، السعر *${priceText}*.\n` +
          `تحب نجهّزها بأي لون؟ وهقولك ميعاد التسليم بالظبط فوراً.`,
    },
    {
      id: 'wa_followup',
      title: '🌿 متابعة عميل + اطمئنان بعد الاستلام',
      content: libPack
        ? `• متابعة:\n${libPack.whatsappStyles.followUp}\n\n` +
          `• بعد الاستلام:\n${libPack.whatsappStyles.afterDelivery}`
        : `أهلاً بيك يا فندم من ${brand} ☀️\n` +
          `حبينا نطمن إن طلبك وصل على خير وعجبك!\n` +
          `رأيك يفرق معانا جداً ولو احتجت أي قطعة تانية في أي وقت إحنا تحت أمرك 🤍`,
    },
  ];

  return {
    allowed: true,
    reply: `💬 **جهّزتلك 3 قوالب واتساب جاهزة للنسخ يا ${firstName}** (عرض المنتج بـ 3 أساليب، الرد والترحيب بـ 3 أساليب، والمتابعة وما بعد الاستلام):`,
    copyBlocks,
  };
}
