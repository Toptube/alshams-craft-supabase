/**
 * اختبارات الجزء (ب) — الرسالة رقم 2 من 7:
 * 1) سلامة ملف المكتبة المستقل (الدفعة 1 بنصّها الكامل + قابلية إضافة دفعات جديدة بدون تعديل كود).
 * 2) اختبار 20 جملة متنوعة (فصحى، عامية مصرية، أخطاء إملائية، كلمة واحدة، جمل غامضة).
 * 3) فحص الصور محلياً بالـ Canvas (دقة، نسبة، سطوع، حدة) + صراحة الروابط الخارجية عند CORS.
 * 4) تنويع الصياغة ومنع التكرار لكل حساب على حدة (خصوصية).
 * 5) فلتر القاعدة 6 (منع الادعاءات الطبية/العلاجية/"طبيعي 100%"/"آمن للأطفال"/"مضمون").
 * 6) الرد الأوفلاين الصريح عند إرسال صورة + الرد على اعتراضات العملاء + قوالب الواتساب الـ 3 أساليب.
 */
import assert from 'node:assert/strict';
import {
  HANDMADE_MARKETING_LIBRARY,
  type CraftMarketingSpecialty,
  type HandmadeMarketingLibraryData,
} from '../src/data/shamousaMarketingLibrary';
import {
  buildLibraryMarketingCopy,
  buildOfflineImageUploadResponse,
  matchCustomerObjectionFromLibrary,
  pickVariedPhrase,
  sanitizeForbiddenMarketingClaims,
  understandProductSentence,
} from '../src/services/shamousaProductUnderstanding';
import {
  analyzeImageQualityWithCanvas,
  buildImageReportFromMetrics,
  computeCanvasPixelMetrics,
  inspectProductImagesBatch,
} from '../src/services/shamousaImageQuality';
import {
  extractFieldsFromInitialSentence,
  isNewProductWizardTrigger,
} from '../src/services/shamousaProductWizard';
import {
  buildWhatsAppTemplatesOffline,
  runStoreMarketingReviewOffline,
} from '../src/services/shamousaMarketingAndDecision';
import type { SavedProductRecord } from '../src/types';

async function main() {
  console.log('=== اختبار الجزء (ب) — المكتبة (دفعة 1) + فهم المنتج + فحص الصور ===\n');

  // ------------------------------------------------------------------
  // 1) التحقق من ملف المكتبة المستقل وبنود الدفعة 1 كاملة
  // ------------------------------------------------------------------
  assert.equal(HANDMADE_MARKETING_LIBRARY.loadedBatches.includes(1), true);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.titleTemplates.length, 7);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.hooks.length, 12);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.descriptionStructures.length, 3);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.postTemplates.length, 10);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.ctas.length, 6);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.engagementQuestions.length, 6);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.shortVideoIdeas.length, 8);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.objectionReplies.length, 5);
  assert.equal(HANDMADE_MARKETING_LIBRARY.general.seasonsAndOccasions.length, 10);
  assert.ok(HANDMADE_MARKETING_LIBRARY.specialties.length >= 4);
  const specIds = HANDMADE_MARKETING_LIBRARY.specialties.map((s) => s.id);
  for (const b1Id of ['macrame', 'crochet_knitting', 'embroidery_loom', 'punch_needle_tufting']) {
    assert.ok(specIds.includes(b1Id), `Batch 1 specialty ${b1Id} must remain intact`);
  }
  console.log(`✅ [1] ملف المكتبة المستقل يحتوي على القسم العام + التخصصات الأربعة من الدفعة 1 كاملة (الإجمالي الحالي: ${HANDMADE_MARKETING_LIBRARY.specialties.length} تخصص).`);

  // ------------------------------------------------------------------
  // 2) اختبار التوسع التلقائي بدون تعديل كود (محاكاة إضافة دفعة 2)
  // ------------------------------------------------------------------
  const mockFutureSpecialty: CraftMarketingSpecialty = {
    id: 'mock_origami_future',
    nameAr: 'فن الأوريجامي والورق اليدوي',
    batch: 9,
    keywords: ['أوريجامي', 'طوي الورق', 'كروت ورقية يدوية', 'ورق مجسم'],
    popularItems: ['كارت معايدة أوريجامي ثلاثي الأبعاد'],
    typicalMaterials: ['ورق كرافت', 'ورق كانسون'],
    sellingPoints: ['تفاصيل دقيقة وطي يدوي مبتكر'],
    occasions: ['هدايا', 'رمضان'],
    photoTips: 'صوّر الكارت مفتوح بزاوية مائلة لإظهار التجسيم.',
    customerFaqs: [{ questionAr: 'ممكن كتابة إهداء؟', answerGuidanceAr: 'حسب طلب العميل' }],
    videoIdeas: ['طي الورق بالتسريع'],
    bundles: ['طقم 5 كروت معايدة'],
    hashtags: ['#أوريجامي', '#كروت_يدوية'],
  };
  const extendedLib: HandmadeMarketingLibraryData = {
    ...HANDMADE_MARKETING_LIBRARY,
    loadedBatches: [...HANDMADE_MARKETING_LIBRARY.loadedBatches, 9],
    specialties: [...HANDMADE_MARKETING_LIBRARY.specialties, mockFutureSpecialty],
  };
  const extRes = understandProductSentence('عايز أسوّق كروت ورقية يدوية وأوريجامي هدية لرمضان', extendedLib);
  assert.equal(extRes.specialty?.id, 'mock_origami_future');
  assert.equal(extRes.matchedSeason?.id, 'ramadan');
  console.log('✅ [2] إضافة تخصص جديد (دفعة مستقبلية) يعمل تلقائياً في المحرك بدون أي تعديل كود.');

  // ------------------------------------------------------------------
  // 3) اختبار 20 جملة متنوعة (فصحى، عامية مصرية، أخطاء إملائية، كلمة واحدة، غامض)
  // ------------------------------------------------------------------
  interface SentenceTestCase {
    id: number;
    category: string;
    input: string;
    expectSpecialtyId: string | null; // null => expect ambiguous / clarifying options
    expectAmbiguous?: boolean;
    expectClarifyingOptions?: boolean;
    expectProductType?: string;
    expectSeasonId?: string;
  }

  const twentyCases: SentenceTestCase[] = [
    // فصحى واضحة (5)
    { id: 1, category: 'فصحى', input: 'أرغب في تسويق تعليقة حائط مكرمية من حبل قطن مجدول لتجهيز بيت جديد', expectSpecialtyId: 'macrame', expectProductType: 'تعليقة حائط' },
    { id: 2, category: 'فصحى', input: 'أصنع دمى أميجورومي وبطانية أطفال بالكروشيه لهدايا المواليد', expectSpecialtyId: 'crochet_knitting', expectProductType: 'دمى أميجورومي' },
    { id: 3, category: 'فصحى', input: 'تطريز يدوي لبرواز أسماء على قماش كانافاه لهدايا الزفاف', expectSpecialtyId: 'embroidery_loom', expectSeasonId: 'weddings' },
    { id: 4, category: 'فصحى', input: 'سجاد تافتنج وبانش نيدل بتصميم شخصي لغرف الشباب', expectSpecialtyId: 'punch_needle_tufting' },
    { id: 5, category: 'فصحى', input: 'حامل نباتات مكرمية بستايل بوهو مقاس 80 سم بسعر 220 جنيه', expectSpecialtyId: 'macrame', expectProductType: 'حامل نباتات' },

    // عامية مصرية (5)
    { id: 6, category: 'عامية مصرية', input: 'بعمل دريم كاتشر وميداليات بحبل قطن بيج لعرايس وعيد الأم', expectSpecialtyId: 'macrame', expectSeasonId: 'mothers_day' },
    { id: 7, category: 'عامية مصرية', input: 'بشتغل شال صوف وايس كاب تريكو للشتا عايزة أكتبلهم بوست', expectSpecialtyId: 'crochet_knitting', expectSeasonId: 'winter' },
    { id: 8, category: 'عامية مصرية', input: 'شغالة طارة خطوبة ومنديل كتب كتاب بتطريز فلاحي وخيمي', expectSpecialtyId: 'embroidery_loom' },
    { id: 9, category: 'عامية مصرية', input: 'بعمل مراية بإطار فرو وكوشن صوف بالإبرة المثقبة لغرفة أطفال', expectSpecialtyId: 'punch_needle_tufting' },
    { id: 10, category: 'عامية مصرية', input: 'عندي كوسترات ومفرش سفرة مكرمية لرمضان عايز أفكار فيديو', expectSpecialtyId: 'macrame', expectSeasonId: 'ramadan' },

    // أخطاء إملائية (4)
    { id: 11, category: 'أخطاء إملائية', input: 'ماكرميه تعلقه حيطه بوهو', expectSpecialtyId: 'macrame' },
    { id: 12, category: 'أخطاء إملائية', input: 'كروشيا اميجرومي دبدوب للبيبي', expectSpecialtyId: 'crochet_knitting' },
    { id: 13, category: 'أخطاء إملائية', input: 'تطريس علي قماش كنفاه برواز اسم', expectSpecialtyId: 'embroidery_loom' },
    { id: 14, category: 'أخطاء إملائية', input: 'تافتيج و بنش نيدل سجاد حيطه', expectSpecialtyId: 'punch_needle_tufting' },

    // كلمة واحدة (4)
    { id: 15, category: 'كلمة واحدة', input: 'مكرمية', expectSpecialtyId: 'macrame', expectClarifyingOptions: true },
    { id: 16, category: 'كلمة واحدة', input: 'كروشيه', expectSpecialtyId: 'crochet_knitting', expectClarifyingOptions: true },
    { id: 17, category: 'كلمة واحدة', input: 'تطريز', expectSpecialtyId: 'embroidery_loom', expectClarifyingOptions: true },
    { id: 18, category: 'كلمة واحدة', input: 'تافتنج', expectSpecialtyId: 'punch_needle_tufting', expectClarifyingOptions: true },

    // جمل غامضة تحتاج اختيارات توضيحية (2)
    { id: 19, category: 'غامض', input: 'عايز أسوّق شغلي اليدوي ومش عارف أبدأ إزاي', expectSpecialtyId: null, expectAmbiguous: true, expectClarifyingOptions: true },
    { id: 20, category: 'غامض', input: 'عندي هدية حلوة لعيد الأم عايز أكتبلها وصف', expectSpecialtyId: null, expectAmbiguous: true, expectClarifyingOptions: true, expectSeasonId: 'mothers_day' },
  ];

  let passedCount = 0;
  for (const tc of twentyCases) {
    const res = understandProductSentence(tc.input);
    if (tc.expectSpecialtyId === null) {
      assert.equal(res.specialty, null, `Case #${tc.id} (${tc.input}) should not guess a specialty`);
    } else {
      assert.equal(
        res.specialty?.id,
        tc.expectSpecialtyId,
        `Case #${tc.id} (${tc.input}) expected ${tc.expectSpecialtyId}, got ${res.specialty?.id}`
      );
    }
    if (tc.expectAmbiguous) {
      assert.equal(res.isAmbiguous, true, `Case #${tc.id} should be ambiguous`);
    }
    if (tc.expectClarifyingOptions) {
      assert.ok(
        res.clarifyingOptions && res.clarifyingOptions.length >= 3 && res.clarifyingOptions.length <= 4,
        `Case #${tc.id} should return 3-4 clarifying options`
      );
    }
    if (tc.expectProductType) {
      assert.ok(res.productType, `Case #${tc.id} should extract productType`);
    }
    if (tc.expectSeasonId) {
      assert.equal(res.matchedSeason?.id, tc.expectSeasonId, `Case #${tc.id} should match season ${tc.expectSeasonId}`);
    }
    passedCount += 1;
  }
  assert.equal(passedCount, 20);
  console.log(`✅ [3] نجاح اختبار الـ 20 جملة بالكامل (${passedCount}/20: فصحى + عامية مصرية + أخطاء إملائية + كلمة واحدة + غامض).`);

  // تحقق إضافي: معالج منتج جديد يستفيد من فهم الأخطاء الإملائية
  assert.equal(isNewProductWizardTrigger('عايز أعمل تافتيج'), true);
  const typoExtracted = extractFieldsFromInitialSentence('عايز أعمل تعلقه ماكرميه مقاس 40 سم بسعر 250 جنيه');
  assert.equal(typoExtracted.sizeDetails, '40 سم');
  assert.equal(typoExtracted.numericPrice, 250);
  console.log('✅ [4] معالج «منتج جديد» متكامل مع محرك فهم الأخطاء الإملائية والمقاسات والأسعار.');

  // ------------------------------------------------------------------
  // 4) فحص الصور محلياً بالـ Canvas (دقة + نسبة + سطوع + حدة) + صراحة CORS
  // ------------------------------------------------------------------
  const makeSolidRgba = (w: number, h: number, v: number) => {
    const arr = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      arr[i * 4] = v;
      arr[i * 4 + 1] = v;
      arr[i * 4 + 2] = v;
      arr[i * 4 + 3] = 255;
    }
    return arr;
  };
  const makeSharpCheckerRgba = (w: number, h: number) => {
    const arr = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = (x + y) % 2 === 0 ? 70 : 185;
        const idx = (y * w + x) * 4;
        arr[idx] = v;
        arr[idx + 1] = v;
        arr[idx + 2] = v;
        arr[idx + 3] = 255;
      }
    }
    return arr;
  };

  // أ) صورة غامقة + مهزوزة + دقة منخفضة
  const darkBlurry = computeCanvasPixelMetrics(makeSolidRgba(300, 300, 30), 300, 300);
  assert.equal(darkBlurry.brightnessStatus, 'dark');
  assert.equal(darkBlurry.sharpnessStatus, 'blurry');
  assert.equal(darkBlurry.resolutionStatus, 'low');
  const darkReport = buildImageReportFromMetrics(darkBlurry, 'base64', 'صورة تجريبية');
  assert.ok(darkReport.issues.length >= 3);

  // ب) صورة ساطعة زيادة (overexposed) + نسبة غير متوازنة
  const brightWide = computeCanvasPixelMetrics(makeSolidRgba(900, 200, 240), 900, 200);
  assert.equal(brightWide.brightnessStatus, 'bright');
  assert.ok(brightWide.aspectLabelAr.includes('غير متوازنة'));

  // ج) صورة متوازنة + حادة + دقة عالية
  const sharpGood = computeCanvasPixelMetrics(makeSharpCheckerRgba(900, 900), 900, 900);
  assert.equal(sharpGood.brightnessStatus, 'good');
  assert.equal(sharpGood.sharpnessStatus, 'sharp');
  assert.equal(sharpGood.resolutionStatus, 'good');

  // د) رابط خارجي (CORS) -> يقول بصراحة إنه ما قدرش يفحص الجودة التقنية ويفحص العدد والتكرار والوصف
  const extUrlReport = await analyzeImageQualityWithCanvas('https://example.com/macrame.jpg', 'صورة المتجر');
  assert.equal(extUrlReport.corsBlocked, true);
  assert.equal(extUrlReport.inspectedWithCanvas, false);
  assert.ok(extUrlReport.honestNoticeAr && extUrlReport.honestNoticeAr.includes('CORS'));

  const batchInspection = await inspectProductImagesBatch({
    images: [
      { url: 'https://example.com/a.jpg', caption: 'زاوية أمامية' },
      { url: 'https://example.com/a.jpg', caption: '' }, // مكررة + بدون وصف
    ],
  });
  assert.equal(batchInspection.totalImages, 2);
  assert.equal(batchInspection.duplicateCount, 1);
  assert.equal(batchInspection.missingDescriptionCount, 1);
  assert.ok(batchInspection.summaryMarkdown.includes('CORS'));
  console.log('✅ [5] فحص الصور بالـ Canvas (الدقة/النسبة/السطوع/الحدة) + صراحة الروابط الخارجية عند CORS تعمل بدقة.');

  // ------------------------------------------------------------------
  // 5) الرد الأوفلاين الصريح عند إرسال صورة في الشات
  // ------------------------------------------------------------------
  const offlineImgResp = buildOfflineImageUploadResponse({
    firstName: 'حسام',
    imageName: 'macrame.jpg',
    qualityReport: darkReport,
  });
  assert.ok(offlineImgResp.reply.includes('بصراحة') && offlineImgResp.reply.includes('أوفلاين'));
  assert.equal(offlineImgResp.options.length, 4);
  console.log('✅ [6] الرد الأوفلاين عند إرسال صورة يصرح بصراحة بحدود الأوفلاين + يعرض الفحص الفني + 4 اختيارات سريعة.');

  // ------------------------------------------------------------------
  // 6) تنويع الصياغة ومنع التكرار لكل حساب على حدة (خصوصية)
  // ------------------------------------------------------------------
  const phrases = ['صياغة 1', 'صياغة 2', 'صياغة 3'];
  const accA_1 = pickVariedPhrase('acc_A', 'test_slot', phrases);
  const accA_2 = pickVariedPhrase('acc_A', 'test_slot', phrases);
  const accA_3 = pickVariedPhrase('acc_A', 'test_slot', phrases);
  assert.notEqual(accA_1, accA_2, 'لا يجب تكرار نفس الصياغة ورا بعض لنفس الحساب');
  assert.notEqual(accA_2, accA_3, 'لا يجب تكرار نفس الصياغة ورا بعض لنفس الحساب');
  const accB_1 = pickVariedPhrase('acc_B', 'test_slot', phrases);
  assert.equal(accB_1, accA_1, 'كل حساب له ذاكرة تنويع مستقلة تماماً');

  const copy1 = buildLibraryMarketingCopy({ accountId: 'acc_copy_test', productName: 'تعليقة حائط مكرمية', material: 'حبل قطن' });
  const copy2 = buildLibraryMarketingCopy({ accountId: 'acc_copy_test', productName: 'تعليقة حائط مكرمية', material: 'حبل قطن' });
  assert.notEqual(copy1.hook, copy2.hook, 'البداية الترويجية (hook) تتنوّع بين المرة والتانية');
  assert.notEqual(copy1.titles[0], copy2.titles[0], 'العنوان الأول يتنوّع بين المرة والتانية');
  console.log('✅ [7] تنويع الصياغة ومنع التكرار يعمل محلياً ومستقلاً لكل حساب.');

  // ------------------------------------------------------------------
  // 7) فلتر القاعدة 6 (منع الادعاءات الطبية/العلاجية/طبيعي 100%/آمن للأطفال/مضمون)
  // ------------------------------------------------------------------
  const riskyText = 'منتج علاجي طبي طبيعي 100% آمن للأطفال ومضمون';
  const cleanedWithoutFacts = sanitizeForbiddenMarketingClaims(riskyText, 'تعليقة حائط مكرمية من حبل قطن');
  assert.equal(/علاجي|طبي(?!عي)|طبيعي 100%|آمن للأطفال|مضمون/.test(cleanedWithoutFacts), false);

  const keptWhenRealFact = sanitizeForbiddenMarketingClaims(
    'حبل طبيعي 100% وآمن للأطفال',
    'حبل قطن طبيعي 100% آمن للأطفال'
  );
  assert.ok(keptWhenRealFact.includes('طبيعي 100%') && keptWhenRealFact.includes('آمن للأطفال'));
  console.log('✅ [8] فلتر القاعدة 6 يمنع الادعاءات المخترعة ويسمح بها فقط لو مكتوبة فعلاً في بيانات المنتج.');

  // ------------------------------------------------------------------
  // 8) اعتراضات العملاء + قوالب الواتساب بـ 3 أساليب + مراجعة المتجر بالتخصص والـ CORS
  // ------------------------------------------------------------------
  const objPrice = matchCustomerObjectionFromLibrary('العميل بيقول السعر غالي أرد عليه إزاي؟');
  assert.equal(objPrice?.id, 'obj_expensive');
  const objDelay = matchCustomerObjectionFromLibrary('الزبون خايف هتتأخر عليه');
  assert.equal(objDelay?.id, 'obj_delay');
  const objCustom = matchCustomerObjectionFromLibrary('عميلة بتسأل ممكن لون تاني ومقاس تاني');
  assert.equal(objCustom?.id, 'obj_custom');

  const sampleProduct: SavedProductRecord = {
    id: 'p_mac_1',
    tenantId: 'w_1',
    productName: 'تعليقة حائط مكرمية بوهو',
    storePrice: 350,
    retailPrice: 350,
    costPrice: 0,
    inStore: true,
    isActive: true,
    imageUrl: 'https://example.com/macrame1.jpg',
    storeDescription: 'تعليقة حائط مكرمية معمولة يدوياً من حبل قطن مجدول بستايل بوهو أنيق.',
  } as unknown as SavedProductRecord;

  const storeOnlySub = {
    activePlanIds: ['core_free', 'storefront_catalog'],
    aiAssistantChoices: ['shamousa'] as Array<'shamousa' | 'falcon'>,
    status: 'active' as const,
  };
  const waRes = buildWhatsAppTemplatesOffline({
    accountId: 'acc_wa_lib',
    firstName: 'حسام',
    brandName: 'ورشة الشمس',
    products: [sampleProduct],
    packageOptions: { role: 'artisan', overrideSub: storeOnlySub as any },
  });
  assert.equal(waRes.allowed, true);
  assert.equal(waRes.copyBlocks?.length, 3);
  assert.ok(waRes.copyBlocks![0].content.includes('سريع:') && waRes.copyBlocks![0].content.includes('ودود:') && waRes.copyBlocks![0].content.includes('رسمي'));

  const revRes = runStoreMarketingReviewOffline({
    accountId: 'acc_wa_lib',
    firstName: 'حسام',
    products: [sampleProduct],
    packageOptions: { role: 'artisan', overrideSub: storeOnlySub as any },
  });
  assert.equal(revRes.allowed, true);
  assert.ok(revRes.summaryMarkdown.includes('CORS'));
  assert.ok(revRes.items[0].improvements.some((im) => im.includes('مكرمية')));
  console.log('✅ [9] اعتراضات العملاء + قوالب الواتساب بـ 3 أساليب + مراجعة المتجر بنصائح التخصص والـ CORS تعمل بنجاح.');

  console.log('\n🎉 جميع اختبارات الجزء (ب) نجحت بنسبة 100% (9/9 مجموعات + 20/20 جملة)!');
}

main().catch((err) => {
  console.error('❌ فشل اختبار الجزء (ب):', err);
  process.exit(1);
});
