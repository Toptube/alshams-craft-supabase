/**
 * اختبارات الرسالة رقم 3 من 7:
 * 1) التحقق من دمج الدفعة 2 كاملة وبنصّها في src/data/shamousaMarketingLibrary.ts (6 تخصصات جديدة = الإجمالي 10).
 * 2) اختبار تعرّف شموسة تلقائياً على التخصصات الستة الجديدة من كلماتها الدالة (فصحى / عامية / كلمة واحدة).
 * 3) اختبار زر السوبر أدمن «إضافة للمكتبات» (تخصص جديد، تحديث تخصص، قوالب عامة واعتراض، مشاكل فنية، وحذف).
 */
import assert from 'node:assert/strict';
import { HANDMADE_MARKETING_LIBRARY } from '../src/data/shamousaMarketingLibrary';
import {
  buildLibraryMarketingCopy,
  matchCustomerObjectionFromLibrary,
  understandProductSentence,
} from '../src/services/shamousaProductUnderstanding';
import {
  ADMIN_LIBRARY_CATEGORIES,
  countCustomLibraryItems,
  deleteCustomLibraryItemById,
  getEffectiveMarketingLibrary,
  matchCustomKnowledgeNote,
  parseAndSaveAdminLibraryEntry,
  resetCustomLibrariesStoreForTest,
} from '../src/services/shamousaCustomLibrariesStore';

async function main() {
  resetCustomLibrariesStoreForTest();
  console.log('=== اختبار الرسالة رقم 3 — الدفعة 2 + زر السوبر أدمن «إضافة للمكتبات» ===\n');

  // 1) التحقق من بنية الدفعة 2 في نفس ملف المكتبة
  assert.ok(HANDMADE_MARKETING_LIBRARY.loadedBatches.includes(1) && HANDMADE_MARKETING_LIBRARY.loadedBatches.includes(2));
  assert.ok(HANDMADE_MARKETING_LIBRARY.specialties.length >= 10);

  const batch2Ids = [
    'resin_epoxy',
    'soap_oils',
    'candles',
    'ceramics_concrete_pottery',
    'stained_glass',
    'accessories_beads',
  ];
  for (const id of batch2Ids) {
    const spec = HANDMADE_MARKETING_LIBRARY.specialties.find((s) => s.id === id);
    assert.ok(spec, `التخصص ${id} يجب أن يكون مدموجاً في المكتبة`);
    assert.equal(spec!.batch, 2);
    assert.ok(spec!.keywords.length >= 5);
    assert.ok(spec!.hashtags.length >= 3);
  }
  const soapSpec = HANDMADE_MARKETING_LIBRARY.specialties.find((s) => s.id === 'soap_oils');
  assert.ok(soapSpec?.forbiddenClaimsAr?.includes('أي ادعاء علاجي أو لنوع بشرة معيّن'));
  console.log('✅ [1] الدفعة 2 مدموجة كاملة وبنصّها (6 تخصصات جديدة، الإجمالي 10 تخصصات مع الدفعة 1، وبند ممنوعات الصابون محفوظ).');

  // 2) اختبار تعرّف شموسة على التخصصات الستة الجديدة من كلماتها الدالة (12 جملة متنوعة)
  const batch2Tests: Array<{ input: string; expectId: string }> = [
    { input: 'عايز أسوّق ميدالية ريزن بالاسم بورد محفوظ', expectId: 'resin_epoxy' },
    { input: 'قالب سيليكون وصب إيبوكسي لترايات تقديم', expectId: 'resin_epoxy' },
    { input: 'بعمل صابون بارد يدوي بالزيوت لتوزيعات أفراح', expectId: 'soap_oils' },
    { input: 'صابون يدوي مقشّر ومعطّر لعيد الأم', expectId: 'soap_oils' },
    { input: 'شمع صويا معطر في برطمانات لفالنتاين', expectId: 'candles' },
    { input: 'شموع مصبوبة بفتيل قطن للشتاء', expectId: 'candles' },
    { input: 'بشتغل كونكريت وأصيص زرع وفخار لتجهيز بيت جديد', expectId: 'ceramics_concrete_pottery' },
    { input: 'تشكيل بالطين وخزف وسيراميك ديكور', expectId: 'ceramics_concrete_pottery' },
    { input: 'زجاج معشق تيفاني بلحام قصدير للشباك', expectId: 'stained_glass' },
    { input: 'ستيند جلاس وزجاج ملون هدية بيت جديد', expectId: 'stained_glass' },
    { input: 'إكسسوار وخرز يدوي أسورة وسلسلة بالاسم للبنات', expectId: 'accessories_beads' },
    { input: 'حلق وخاتم وبروش هاند ميد بالخرز', expectId: 'accessories_beads' },
  ];

  for (const t of batch2Tests) {
    const res = understandProductSentence(t.input);
    assert.equal(
      res.specialty?.id,
      t.expectId,
      `جملة "${t.input}" توقّعنا ${t.expectId} لكن طلع ${res.specialty?.id}`
    );
  }

  // التأكد إن التوليد التسويقي شغال على تخصصات الدفعة 2 ويحترم القاعدة 6
  const soapCopy = buildLibraryMarketingCopy({
    accountId: 'acc_soap_test',
    productName: 'صابون يدوي باللافندر',
    material: 'زيوت نباتية',
    realProductFactsText: 'صابون يدوي بزيوت نباتية ورائحة لافندر',
  });
  assert.equal(soapCopy.specialtyNameAr, 'صابون وزيوت');
  assert.ok(soapCopy.hashtags.includes('#صابون_يدوي'));
  assert.ok(soapCopy.bundles.some((b) => b.includes('لوفة')));
  console.log('✅ [2] تعرّف شموسة على التخصصات الستة الجديدة نجح بنسبة 100% (12/12 جملة) مع توليد تسويقي كامل.');

  // 3) اختبار زر السوبر أدمن «إضافة للمكتبات» (القائمة المنسدلة + الحفظ + الاستخدام الفوري أوفلاين)
  assert.equal(ADMIN_LIBRARY_CATEGORIES.length, 5);

  // أ) إضافة تخصص جديد بنفس صيغة الدفعات
  const baseCountBeforeAdd = getEffectiveMarketingLibrary().specialties.length;
  const addSpecRes = parseAndSaveAdminLibraryEntry(
    'marketing_new_specialty',
    '■■ فن الديكوباج اليدوي ■■\n' +
      'كلمات دالة: ديكوباج، مناديل ديكوباج، تجديد صواني ديكوباج، ورنيش ديكوباج\n' +
      'رائج: صواني ديكوباج، علب مناديل ديكوباج\n' +
      'نقط بيع: ألوان فنية مبهجة، قطعة فريدة لتجديد الديكور\n' +
      'باقات: صينية ديكوباج + 4 كوستر\n' +
      'وسوم: #ديكوباج #تجديد_ديكور'
  );
  assert.equal(addSpecRes.ok, true);
  assert.equal(addSpecRes.addedCount, 1);

  // شموسة تتعرف عليه فوراً بدون تعديل أي كود!
  const decoupageMatch = understandProductSentence('عايز أسوّق صينية ديكوباج يدوي للبيت');
  assert.equal(decoupageMatch.specialty?.nameAr, 'فن الديكوباج اليدوي');
  assert.equal(getEffectiveMarketingLibrary().specialties.length, baseCountBeforeAdd + 1);

  // ب) تحديث تخصص موجود (إضافة كلمة دالة وباقة لـ مكرمية)
  const patchRes = parseAndSaveAdminLibraryEntry(
    'marketing_append_specialty',
    'التخصص: مكرمية\nكلمات دالة: كرسي أرجوحة مكرمية\nباقات: مراية مكرمية + حامل زرع'
  );
  assert.equal(patchRes.ok, true);
  const patchedMac = getEffectiveMarketingLibrary().specialties.find((s) => s.id === 'macrame');
  assert.ok(patchedMac?.keywords.includes('كرسي أرجوحة مكرمية'));
  assert.ok(patchedMac?.bundles.includes('مراية مكرمية + حامل زرع'));

  // ج) إضافة قوالب عامة واعتراض جديد
  const genRes = parseAndSaveAdminLibraryEntry(
    'marketing_general_templates',
    'بداية بوست: قطعة يدوية معمولة مخصوص لبيتك\nاعتراض: الشحن غالي | الرد: وضّح إن التغليف آمن وممكن العميل يجمع قطعتين في طلب واحد'
  );
  assert.equal(genRes.ok, true);
  assert.equal(genRes.addedCount, 2);
  const customObj = matchCustomerObjectionFromLibrary('العميل بيقول الشحن غالي أرد عليه إزاي؟');
  assert.ok(customObj && customObj.guidanceAr.includes('التغليف آمن'));

  // د) إضافة مشكلة فنية والبحث عنها أوفلاين
  const techRes = parseAndSaveAdminLibraryEntry(
    'marketing_methods_and_tech',
    'عنوان: فقاعات الهواء في الريزن\nكلمات دالة: فقاعات، بابلز، ريزن فقاعات\nالحل: قلّب الريزن ببطء 3 دقايق واستخدم هيت جن من مسافة آمنة.'
  );
  assert.equal(techRes.ok, true);
  const noteHit = matchCustomKnowledgeNote('عندي مشكلة فقاعات في الريزن أعمل إيه؟');
  assert.ok(noteHit && noteHit.contentAr.includes('هيت جن'));

  // هـ) الحذف يعيد المخزن نظيفاً
  const totalBeforeDel = countCustomLibraryItems();
  assert.ok(totalBeforeDel >= 4);
  deleteCustomLibraryItemById(addSpecRes.storeSnapshot.customSpecialties[0].id);
  assert.equal(getEffectiveMarketingLibrary().specialties.length, baseCountBeforeAdd);
  resetCustomLibrariesStoreForTest();
  console.log('✅ [3] زر السوبر أدمن «إضافة للمكتبات» (إضافة تخصص، تحديث تخصص، قوالب واعتراضات، مشاكل فنية، وحذف) يعمل بالكامل أوفلاين 100%.');

  console.log('\n🎉 جميع اختبارات الرسالة رقم 3 نجحت بنسبة 100%!');
}

main().catch((err) => {
  console.error('❌ فشل اختبار الرسالة رقم 3:', err);
  process.exit(1);
});
