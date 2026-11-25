/**
 * اختبارات الرسالة رقم 4 من 7:
 * 1) التحقق من دمج الدفعة 3 كاملة وبنصّها (جلود + خشب ونجارة + ليزر و CNC + طباعة 3D + دمج الحِرف + الموردين).
 * 2) اختبار تعرّف شموسة على التخصصات الجديدة والموردين من كلماتهم الدالة (12 جملة متنوعة).
 * 3) اختبار دليل السوبر أدمن الشخصي الأوفلاين ("هبرمجك إزاي" / "مش فاكر أضيف في المكتبات إزاي").
 */
import assert from 'node:assert/strict';
import { HANDMADE_MARKETING_LIBRARY } from '../src/data/shamousaMarketingLibrary';
import {
  buildLibraryMarketingCopy,
  understandProductSentence,
} from '../src/services/shamousaProductUnderstanding';
import {
  buildSuperAdminLibraryGuide,
  isSuperAdminGuideQuery,
  resetCustomLibrariesStoreForTest,
} from '../src/services/shamousaCustomLibrariesStore';

async function main() {
  resetCustomLibrariesStoreForTest();
  console.log('=== اختبار الرسالة رقم 4 — الدفعة 3 + الموردين + دليل السوبر أدمن الشخصي ===\n');

  // 1) التحقق من بنية الدفعة 3 الكاملة في نفس ملف المكتبة
  assert.deepEqual(HANDMADE_MARKETING_LIBRARY.loadedBatches, [1, 2, 3]);
  assert.equal(HANDMADE_MARKETING_LIBRARY.specialties.length, 16);

  const batch3Ids = [
    'leather',
    'wood_carpentry',
    'laser_cnc',
    'printing_3d',
    'craft_fusion',
    'suppliers_materials',
  ];
  for (const id of batch3Ids) {
    const spec = HANDMADE_MARKETING_LIBRARY.specialties.find((s) => s.id === id);
    assert.ok(spec, `التخصص ${id} يجب أن يكون مدموجاً في المكتبة`);
    assert.equal(spec!.batch, 3);
  }

  const fusionSpec = HANDMADE_MARKETING_LIBRARY.specialties.find((s) => s.id === 'craft_fusion');
  assert.ok(fusionSpec?.ideaAr?.includes('دمج حرفتين'));
  assert.ok(fusionSpec?.noteAr?.includes('ورشة دمج الحِرف في الحاسبة بدون تعديل معادلاتها'));

  const sup = HANDMADE_MARKETING_LIBRARY.suppliers;
  assert.ok(sup, 'قسم الموردين يجب أن يكون موجوداً ومكتمل البيانات');
  assert.equal(sup!.typesAr.length, 12);
  assert.equal(sup!.sellingPointsForWorkshops.length, 5);
  assert.equal(sup!.starterKits.length, 7);
  assert.equal(sup!.postTemplates.length, 2);
  assert.ok(sup!.workshopMessageTemplate.includes('{الباقة}'));
  assert.equal(sup!.customerFaqs.length, 3);
  assert.deepEqual(sup!.hashtags, ['#خامات_هاندميد', '#مستلزمات_الحرف', '#موردين']);
  console.log('✅ [1] الدفعة 3 مدموجة كاملة وبنصّها (6 أقسام جديدة، الإجمالي 16 مع الدفعتين 1 و2 + قسم الموردين كامل بـ 7 باقات Starter Kits).');

  // 2) اختبار تعرّف شموسة على التخصصات الجديدة والموردين من كلماتهم الدالة (12 جملة)
  const batch3Tests: Array<{ input: string; expectId: string }> = [
    { input: 'عايز أسوّق محفظة جلد وحزام بحفر الاسم هدية رجالي', expectId: 'leather' },
    { input: 'مشغولات جلدية وشنطة جلد طبيعي خياطة يدوية', expectId: 'leather' },
    { input: 'بشتغل نجارة وديكور خشب وصواني تقديم خشب زان', expectId: 'wood_carpentry' },
    { input: 'أرفف حائط وحفر خشب طبيعي لتجهيز بيت', expectId: 'wood_carpentry' },
    { input: 'قص ليزر وحفر ليزر على MDF وأكريليك توزيعات أفراح', expectId: 'laser_cnc' },
    { input: 'شغل CNC ولافتات وأسماء مقصوصة لرمضان', expectId: 'laser_cnc' },
    { input: 'طباعة 3D مجسمات وميداليات بفيلامنت PLA', expectId: 'printing_3d' },
    { input: 'تصميم ثلاثي الأبعاد وتجسيم ثري دي هدايا شباب', expectId: 'printing_3d' },
    { input: 'بعمل دمج الحرف مكرمية وخشب قطعة مدمجة مفيش منها نسخة', expectId: 'craft_fusion' },
    { input: 'شغل craft fusion ريزن وخشب وجلد وتطريز', expectId: 'craft_fusion' },
    { input: 'أنا مورد وبائع خامات هاندميد وعندي باقة مبتدئ بشرائح جملة', expectId: 'suppliers_materials' },
    { input: 'ببيع مستلزمات الحرف و starter kits وتوريد خامات للورش', expectId: 'suppliers_materials' },
  ];

  for (const tc of batch3Tests) {
    const res = understandProductSentence(tc.input);
    assert.equal(
      res.specialty?.id,
      tc.expectId,
      `جملة "${tc.input}" توقّعنا ${tc.expectId} لكن طلع ${res.specialty?.id}`
    );
  }

  const laserCopy = buildLibraryMarketingCopy({
    accountId: 'acc_laser_test',
    productName: 'توزيعات أفراح قص ليزر',
    material: 'MDF وأكريليك',
  });
  assert.equal(laserCopy.specialtyNameAr, 'ليزر و CNC');
  assert.ok(laserCopy.hashtags.includes('#قص_ليزر'));
  console.log('✅ [2] تعرّف شموسة على التخصصات الجديدة والموردين نجح بنسبة 100% (12/12 جملة).');

  // 3) اختبار دليل السوبر أدمن الشخصي ("هبرمجك إزاي" / "مش فاكر أضيف في المكتبات إزاي")
  const adminGuidePhrases = [
    'أنا عايز أعرف هبرمجك إزاي',
    'أنا مش فاكر أضيف في المكتبات إزاي',
    'إزاي أحفظ جواكي حاجة جديدة؟',
    'ازاي أغذيك يا شموسة؟',
    'ساعديني كسوبر أدمن أضيف تخصص',
  ];
  for (const q of adminGuidePhrases) {
    assert.equal(isSuperAdminGuideQuery(q), true, `يجب التقاط سؤال السوبر أدمن: "${q}"`);
  }
  assert.equal(isSuperAdminGuideQuery('عايز أسوّق شنطة جلد'), false);

  const guide = buildSuperAdminLibraryGuide('حسام');
  assert.ok(guide.reply.includes('إضافة للمكتبات') && guide.reply.includes('حطلي مثال جاهز'));
  assert.equal(guide.options.length, 4);
  assert.ok(guide.options[0].queryText.startsWith('__OPEN_ADMIN_LIB__:'));
  console.log('✅ [3] دليل السوبر أدمن الشخصي يلتقط كل صيغ النسيان ويشرح الخطوات مع 4 أزرار فتح فوري.');

  console.log('\n🎉 جميع اختبارات الرسالة رقم 4 نجحت بنسبة 100%!');
}

main().catch((err) => {
  console.error('❌ فشل اختبار الرسالة رقم 4:', err);
  process.exit(1);
});
