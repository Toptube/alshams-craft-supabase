// ==============================================================================
// Unified Materials Registry (منظومة الخامات الموحدة - alSHamsawiyah)
// 4-Level Hierarchy: Category (TH) -> Master (TH0001) -> Spec (TH0001.01) -> SKU (TH0001.01#B003)
// + Aliases Table (AL00001+) + Brands Registry (B000..B053+) + Unit Chains (ل1..ل8)
// ==============================================================================

export type UnifiedCategoryPrefix =
  | 'TH'
  | 'BD'
  | 'CL'
  | 'WD'
  | 'LT'
  | 'MT'
  | 'DC'
  | 'AR'
  | 'PK'
  | 'PP'
  | 'GL'
  | 'AX';

export type UnitChainCode = 'ل1' | 'ل2' | 'ل3' | 'ل4' | 'ل5' | 'ل6' | 'ل7' | 'ل8';

export type BridgeFieldKey =
  | 'وزن_متر'
  | 'طول_لفة'
  | 'وزن_عبوة'
  | 'طول_عبوة'
  | 'عدد_في_الجرام'
  | 'عدد_في_العبوة'
  | 'كثافة'
  | 'تغطية'
  | 'وزن_جرامي'
  | 'عرض'
  | 'سمك'
  | 'نسبة_خلط'
  | 'زمن_عمل'
  | 'انكماش'
  | 'سعة'
  | 'قدرة'
  | 'نقاء'
  | 'رقم_تصبن'
  | 'عائد_تنظيف'
  | 'مساحة_لوح'
  | 'عمر_تشغيلي';

export interface UnifiedCategoryDef {
  prefix: UnifiedCategoryPrefix;
  nameAr: string;
  defaultUnitChain: UnitChainCode;
  isAddedForEquations?: boolean;
  description: string;
}

export interface UnitChainDef {
  code: UnitChainCode;
  titleAr: string;
  supplierFlow: string;
  artisanUnits: string[];
  issueUnits: string[];
  defaultPrimaryUnit: string;
  defaultSubUnit: string;
  defaultFactor: number;
}

export interface FixedConversionDef {
  from: string;
  to: string;
  factor: number;
  labelAr: string;
}

export interface UnifiedBrandRecord {
  brandCode: string; // e.g., B000, B001 .. B053+
  brandName: string;
  categoryHint: string;
  needsReview?: boolean;
  reviewNote?: string;
  status: 'active' | 'archived';
}

export interface UnifiedBridgeValues {
  weightPerMeterGrams?: number; // وزن_متر
  rollLengthMeters?: number; // طول_لفة
  packWeightGrams?: number; // وزن_عبوة
  packLengthMeters?: number; // طول_عبوة
  countPerGram?: number; // عدد_في_الجرام
  countPerPack?: number; // عدد_في_العبوة
  density?: number; // كثافة
  coverageM2PerUnit?: number; // تغطية
  gsm?: number; // وزن_جرامي
  widthCm?: number; // عرض
  thicknessMm?: number; // سمك
  mixRatio?: string; // نسبة_خلط
  workingTimeMin?: number; // زمن_عمل
  shrinkagePct?: number; // انكماش
  capacityMl?: number; // سعة
  powerKw?: number; // قدرة
  purityPct?: number; // نقاء
  sapValue?: number; // رقم_تصبن
  yieldPct?: number; // عائد_تنظيف
  operatingLifeMeters?: number; // عمر_تشغيلي
}

export interface UnifiedMaterialMaster {
  code: string; // e.g., TH0001
  prefix: UnifiedCategoryPrefix;
  seqNum: number;
  canonicalName: string;
  unitChain: UnitChainCode;
  unitNote?: string;
  bridgeFields: BridgeFieldKey[];
  specFields: string[];
  artistAliases: string[];
  supplierAliases: string[];
  defaultBrands: string[]; // brand names or codes
  workshopTags: string[]; // workshop names/ids
  safetyNote?: string;
  isAssetOnly?: boolean;
  isAddedForEquations?: boolean;
  /** Standard thickness range in mm (for threads/cords where thickness changes consumption, not per-kg price) */
  availableThicknessesMm?: number[];
  status: 'active' | 'archived' | 'reserved_deleted';
  reviewStatus: 'approved' | 'new' | 'edited';
  createdByRole: 'system' | 'super_admin' | 'artisan' | 'supplier';
  createdById?: string;
  createdByName?: string;
  archiveReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedMaterialSpec {
  specCode: string; // e.g., TH0001.01
  masterCode: string; // e.g., TH0001
  specIndex: number;
  label: string;
  thicknessMm?: number;
  plies?: number;
  sizeLabel?: string;
  color?: string;
  origin?: string; // e.g., دمياطي (property, never synonym)
  bridgeValues: UnifiedBridgeValues;
  status: 'active' | 'archived';
  reviewStatus: 'approved' | 'new' | 'edited';
  createdByRole: 'system' | 'super_admin' | 'artisan' | 'supplier';
  createdById?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface UnifiedMaterialAlias {
  aliasCode: string; // e.g., AL00001
  targetCode: string; // Master code (TH0001) or Spec code (TH0001.01)
  aliasName: string;
  aliasType: 'artisan' | 'supplier' | 'common';
  contextHint?: string; // e.g., 'خيط' to distinguish from decorative beads
  isAmbiguous?: boolean;
  createdByRole?: 'system' | 'super_admin' | 'artisan' | 'supplier';
  createdById?: string;
}

export interface UnifiedMaterialNotification {
  id: string;
  eventType:
    | 'new_master'
    | 'new_spec'
    | 'new_alias'
    | 'member_edit_proposal'
    | 'member_local_remove';
  targetCode: string;
  targetName: string;
  actorRole: 'artisan' | 'supplier' | 'super_admin';
  actorId: string;
  actorName: string;
  reason?: string;
  payload?: Record<string, any>;
  status: 'pending' | 'accepted_global' | 'kept_local' | 'archived' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface MemberMaterialCustomization {
  memberRole: 'artisan' | 'supplier';
  memberId: string;
  masterCode: string;
  specCode?: string;
  customName?: string;
  isHidden?: boolean;
  hideReason?: string;
  bridgeOverrides?: UnifiedBridgeValues;
  updatedAt?: string;
}

export interface UnifiedMaterialsSnapshot {
  categories: UnifiedCategoryDef[];
  unitChains: UnitChainDef[];
  fixedConversions: FixedConversionDef[];
  brands: UnifiedBrandRecord[];
  masters: UnifiedMaterialMaster[];
  specs: UnifiedMaterialSpec[];
  aliases: UnifiedMaterialAlias[];
  notifications: UnifiedMaterialNotification[];
  memberCustomizations: MemberMaterialCustomization[];
  reservedMasterSeqs: Record<string, number>;
}

// ------------------------------------------------------------------------------
// 1. Categories (12 Prefixes)
// ------------------------------------------------------------------------------
export const UNIFIED_CATEGORIES: UnifiedCategoryDef[] = [
  { prefix: 'TH', nameAr: 'الحبال والخيوط والنسيج', defaultUnitChain: 'ل1', description: 'خيوط المكرمية، الكروشيه، التطريز، والأقمشة والشرائط' },
  { prefix: 'BD', nameAr: 'الخرز والتطريز والحلي والإكسسوارات', defaultUnitChain: 'ل4', description: 'الخرز، اللولي، الفصوص، الأحجار الطبيعية، ومكونات الحلي والشنط' },
  { prefix: 'CL', nameAr: 'الريزن والطين والمركبات والجبس والشموع والصابون', defaultUnitChain: 'ل3', description: 'الإيبوكسي، البوليستر، الصلصال، الخزف، الجبس، الخرسانة، الشموع، والصابون' },
  { prefix: 'WD', nameAr: 'الأخشاب والبامبو والخوص', defaultUnitChain: 'ل5', description: 'الألواح، المسطحات، البامبو، الراتان، الخوص، والأصداف' },
  { prefix: 'LT', nameAr: 'الجلود', defaultUnitChain: 'ل6', description: 'الجلد الطبيعي والصناعي، الخيوط المشمعة، التشطيب، وإكسسوار الجلد' },
  { prefix: 'MT', nameAr: 'المعادن والأسلاك', defaultUnitChain: 'ل1', description: 'قطاعات الحديد، المعادن، أسلاك التشكيل، السلاسل، ودهانات المعادن' },
  { prefix: 'DC', nameAr: 'الديكور والإضاءة والزهور', defaultUnitChain: 'ل4', description: 'الزهور، الإضاءة وملحقاتها، الألواح الديكورية، والديكوباج' },
  { prefix: 'AR', nameAr: 'الفنون والطباعة والخط', defaultUnitChain: 'ل3', description: 'الألوان الفنية، الأحبار، ورق الرسم، السكرين، التسامي، والتذهيب' },
  { prefix: 'PK', nameAr: 'التغليف والعرض', defaultUnitChain: 'ل4', description: 'الكرتون، الأكياس، العلب، الكروت، الشرائط، وحوامل العرض' },
  { prefix: 'PP', nameAr: 'الورق والتجليد ★', defaultUnitChain: 'ل7', isAddedForEquations: true, description: 'الورق الجرامي، كرتون وقماش التجليد، السبايرال، الأوريجامي والكويلينج' },
  { prefix: 'GL', nameAr: 'الزجاج والموزاييك ★', defaultUnitChain: 'ل2', isAddedForEquations: true, description: 'الموزاييك، الزجاج المعشق، شريط النحاس والرصاص، والجراوت والباتينا' },
  { prefix: 'AX', nameAr: 'الخامات المساعدة ومستهلكات التشغيل', defaultUnitChain: 'ل3', description: 'الغراء واللواصق، الحشو، الصنفرة، الدهانات، الصبغات، والأدوات التشغيلية' },
];

// ------------------------------------------------------------------------------
// 2. Unit Chains (ل1..ل8) & Fixed Conversions
// ------------------------------------------------------------------------------
export const UNIT_CHAINS: UnitChainDef[] = [
  {
    code: 'ل1',
    titleAr: 'سلسلة خطية (أطوال وحبال)',
    supplierFlow: 'طرد / كرتونة ← ربطة / بكرة / لفة ← متر وكجم',
    artisanUnits: ['متر', 'لفة', 'بكرة', 'كجم', 'جرام'],
    issueUnits: ['متر', 'جرام'],
    defaultPrimaryUnit: 'كيلو',
    defaultSubUnit: 'جرام',
    defaultFactor: 1000,
  },
  {
    code: 'ل2',
    titleAr: 'سلسلة وزن (مساحيق وصلب)',
    supplierFlow: 'طن / شيكارة / شوال / طرد ← كجم',
    artisanUnits: ['كجم', 'جرام', 'شيكارة'],
    issueUnits: ['جرام', 'كجم'],
    defaultPrimaryUnit: 'كيلو',
    defaultSubUnit: 'جرام',
    defaultFactor: 1000,
  },
  {
    code: 'ل3',
    titleAr: 'سلسلة سوائل وعبوات',
    supplierFlow: 'برميل / جركن / كرتونة ← عبوة ← لتر ← مل',
    artisanUnits: ['عبوة', 'مل', 'لتر', 'جرام'],
    issueUnits: ['مل', 'جرام'],
    defaultPrimaryUnit: 'لتر',
    defaultSubUnit: 'مل',
    defaultFactor: 1000,
  },
  {
    code: 'ل4',
    titleAr: 'سلسلة قطع وعدّ',
    supplierFlow: 'كرتونة ← دستة / جروس / كيس ← قطعة',
    artisanUnits: ['قطعة', 'دستة', 'طقم', 'زوج'],
    issueUnits: ['قطعة'],
    defaultPrimaryUnit: 'دستة',
    defaultSubUnit: 'قطعة',
    defaultFactor: 12,
  },
  {
    code: 'ل5',
    titleAr: 'سلسلة ألواح ومسطحات',
    supplierFlow: 'متر مكعب / رزمة / طرد ← لوح ← م²',
    artisanUnits: ['لوح', 'م²', 'قطعة'],
    issueUnits: ['سم²', 'قطعة'],
    defaultPrimaryUnit: 'متر مربع',
    defaultSubUnit: 'سم²',
    defaultFactor: 10000,
  },
  {
    code: 'ل6',
    titleAr: 'سلسلة رولات مساحية (أقمشة وجلود)',
    supplierFlow: 'رول / طاقة / بالة ← متر (حسب العرض) ← م²',
    artisanUnits: ['متر', 'نصف متر', 'قطعة'],
    issueUnits: ['متر', 'سم²'],
    defaultPrimaryUnit: 'متر',
    defaultSubUnit: 'سم',
    defaultFactor: 100,
  },
  {
    code: 'ل7',
    titleAr: 'سلسلة أوراق وشيتات',
    supplierFlow: 'كرتونة ← رزمة / باكو ← شيت / ورقة',
    artisanUnits: ['ورقة', 'شيت', 'باكو'],
    issueUnits: ['ورقة', 'سم²'],
    defaultPrimaryUnit: 'باكو',
    defaultSubUnit: 'ورقة',
    defaultFactor: 100,
  },
  {
    code: 'ل8',
    titleAr: 'سلسلة شلل (خيوط حياكة)',
    supplierFlow: 'كرتونة ← دستة ← شلة ← جرام / متر',
    artisanUnits: ['شلة', 'جرام', 'متر'],
    issueUnits: ['جرام', 'متر'],
    defaultPrimaryUnit: 'كيلو',
    defaultSubUnit: 'جرام',
    defaultFactor: 1000,
  },
];

export const FIXED_UNIT_CONVERSIONS: FixedConversionDef[] = [
  { from: 'كجم', to: 'جم', factor: 1000, labelAr: '1 كجم = 1000 جم' },
  { from: 'طن', to: 'كجم', factor: 1000, labelAr: '1 طن = 1000 كجم' },
  { from: 'م', to: 'سم', factor: 100, labelAr: '1 م = 100 سم' },
  { from: 'سم', to: 'مم', factor: 10, labelAr: '1 سم = 10 مم' },
  { from: 'لتر', to: 'مل', factor: 1000, labelAr: '1 لتر = 1000 مل' },
  { from: 'دستة', to: 'قطعة', factor: 12, labelAr: '1 دستة = 12 قطعة' },
  { from: 'جروس', to: 'قطعة', factor: 144, labelAr: '1 جروس = 144 قطعة' },
  { from: 'م²', to: 'سم²', factor: 10000, labelAr: '1 م² = 10000 سم²' },
  { from: 'قدم مربع', to: 'سم²', factor: 929.03, labelAr: '1 قدم مربع ≈ 929.03 سم²' },
  { from: 'ألف', to: 'قطعة', factor: 1000, labelAr: '1 ألف = 1000 قطعة' },
];

export const BRIDGE_FIELD_LABELS: Record<BridgeFieldKey, string> = {
  وزن_متر: 'وزن المتر (جم/م)',
  طول_لفة: 'طول اللفة (م)',
  وزن_عبوة: 'وزن العبوة/الشلة (جم)',
  طول_عبوة: 'طول العبوة/البكرة (م)',
  عدد_في_الجرام: 'العدد في الجرام',
  عدد_في_العبوة: 'العدد في العبوة/الخيط',
  كثافة: 'الكثافة (جم/سم³)',
  تغطية: 'معدل التغطية (م²/لتر أو كجم)',
  وزن_جرامي: 'الوزن الجرامي (GSM)',
  عرض: 'العرض (سم)',
  سمك: 'السمك (مم)',
  نسبة_خلط: 'نسبة الخلط / الإضافة',
  زمن_عمل: 'زمن العمل والتصلب (دقيقة)',
  انكماش: 'نسبة الانكماش (%)',
  سعة: 'السعة (مل)',
  قدرة: 'القدرة (كيلووات)',
  نقاء: 'درجة النقاء (%)',
  رقم_تصبن: 'رقم التصبن (SAP)',
  عائد_تنظيف: 'العائد بعد التنظيف/الفرز (%)',
  مساحة_لوح: 'مساحة القطعة/اللوح (سم²)',
  عمر_تشغيلي: 'العمر التشغيلي (متر قطع)',
};

// ------------------------------------------------------------------------------
// 3. Seeded Brands Registry (B000..B053)
// ------------------------------------------------------------------------------
export const SEEDED_BRANDS: UnifiedBrandRecord[] = [
  { brandCode: 'B000', brandName: 'بدون ماركة / محلي', categoryHint: 'عام', status: 'active' },
  { brandCode: 'B001', brandName: 'Alize', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B002', brandName: 'Himalaya', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B003', brandName: 'YarnArt', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B004', brandName: 'Nako', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B005', brandName: 'Kartopu', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B006', brandName: 'Madame Tricote Paris', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B007', brandName: 'Red Heart', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B008', brandName: 'Schachenmayr', categoryHint: 'خيوط حياكة', status: 'active' },
  { brandCode: 'B009', brandName: 'Diva', categoryHint: 'خيوط حياكة', needsReview: true, reviewNote: 'وردت في البيانات الأصلية وتُراجع قبل الاعتماد النهائي', status: 'active' },
  { brandCode: 'B010', brandName: 'ZAIN', categoryHint: 'خيوط حياكة', needsReview: true, reviewNote: 'وردت في البيانات الأصلية وتُراجع قبل الاعتماد النهائي', status: 'active' },
  { brandCode: 'B011', brandName: 'MQR', categoryHint: 'خيوط حياكة', needsReview: true, reviewNote: 'وردت في البيانات الأصلية وتُراجع قبل الاعتماد النهائي', status: 'active' },
  { brandCode: 'B012', brandName: 'DMC', categoryHint: 'خيوط خياطة وتطريز', status: 'active' },
  { brandCode: 'B013', brandName: 'Anchor', categoryHint: 'خيوط خياطة وتطريز', status: 'active' },
  { brandCode: 'B014', brandName: 'Madeira', categoryHint: 'خيوط خياطة وتطريز', status: 'active' },
  { brandCode: 'B015', brandName: 'Gütermann', categoryHint: 'خيوط خياطة وتطريز', status: 'active' },
  { brandCode: 'B016', brandName: 'Coats', categoryHint: 'خيوط خياطة وتطريز', status: 'active' },
  { brandCode: 'B017', brandName: 'Preciosa', categoryHint: 'فصوص وكريستال', status: 'active' },
  { brandCode: 'B018', brandName: 'Swarovski', categoryHint: 'فصوص وكريستال', needsReview: true, reviewNote: 'تُراجع إتاحتها التجارية للهواة والورش', status: 'active' },
  { brandCode: 'B019', brandName: 'FIMO', categoryHint: 'صلصال حراري', status: 'active' },
  { brandCode: 'B020', brandName: 'Sculpey', categoryHint: 'صلصال حراري', status: 'active' },
  { brandCode: 'B021', brandName: 'Cernit', categoryHint: 'صلصال حراري', status: 'active' },
  { brandCode: 'B022', brandName: 'DAS', categoryHint: 'صلصال هوائي', status: 'active' },
  { brandCode: 'B023', brandName: 'Liquitex', categoryHint: 'فنون وألوان', status: 'active' },
  { brandCode: 'B024', brandName: 'Talens (Amsterdam)', categoryHint: 'فنون وألوان', status: 'active' },
  { brandCode: 'B025', brandName: 'Pebeo', categoryHint: 'فنون وألوان', status: 'active' },
  { brandCode: 'B026', brandName: 'Daler-Rowney', categoryHint: 'فنون وألوان', status: 'active' },
  { brandCode: 'B027', brandName: 'Winsor & Newton', categoryHint: 'فنون وألوان', status: 'active' },
  { brandCode: 'B028', brandName: 'Faber-Castell', categoryHint: 'فنون وألوان', status: 'active' },
  { brandCode: 'B029', brandName: 'Marabu', categoryHint: 'فنون وألوان', status: 'active' },
  { brandCode: 'B030', brandName: 'Sakura', categoryHint: 'أحبار وخط', status: 'active' },
  { brandCode: 'B031', brandName: 'Canson', categoryHint: 'ورق رسم', status: 'active' },
  { brandCode: 'B032', brandName: 'Fabriano', categoryHint: 'ورق رسم', status: 'active' },
  { brandCode: 'B033', brandName: 'Strathmore', categoryHint: 'ورق رسم', status: 'active' },
  { brandCode: 'B034', brandName: 'Jotun', categoryHint: 'دهانات', status: 'active' },
  { brandCode: 'B035', brandName: 'Sipes', categoryHint: 'دهانات', status: 'active' },
  { brandCode: 'B036', brandName: 'GLC', categoryHint: 'دهانات', status: 'active' },
  { brandCode: 'B037', brandName: 'Dulux', categoryHint: 'دهانات', status: 'active' },
  { brandCode: 'B038', brandName: 'Philips', categoryHint: 'إضاءة', status: 'active' },
  { brandCode: 'B039', brandName: 'Osram', categoryHint: 'إضاءة', status: 'active' },
  { brandCode: 'B040', brandName: 'LEDVANCE', categoryHint: 'إضاءة', status: 'active' },
  { brandCode: 'B041', brandName: 'Bostik', categoryHint: 'لواصق وغراء', status: 'active' },
  { brandCode: 'B042', brandName: 'UHU', categoryHint: 'لواصق وغراء', status: 'active' },
  { brandCode: 'B043', brandName: 'Loctite', categoryHint: 'لواصق وغراء', status: 'active' },
  { brandCode: 'B044', brandName: 'Soudal', categoryHint: 'لواصق وغراء', status: 'active' },
  { brandCode: 'B045', brandName: '3M (Scotch)', categoryHint: 'لواصق وشرائط وصنفرة', status: 'active' },
  { brandCode: 'B046', brandName: 'Tesa', categoryHint: 'شرائط تغليف', status: 'active' },
  { brandCode: 'B047', brandName: 'Norton', categoryHint: 'صنفرة', status: 'active' },
  { brandCode: 'B048', brandName: 'Bosch', categoryHint: 'صنفرة وعدد', status: 'active' },
  { brandCode: 'B049', brandName: 'Prym', categoryHint: 'إبر وخردوات', status: 'active' },
  { brandCode: 'B050', brandName: 'Clover', categoryHint: 'إبر وخردوات', status: 'active' },
  { brandCode: 'B051', brandName: 'OLFA', categoryHint: 'شفرات قطع', status: 'active' },
  { brandCode: 'B052', brandName: 'NT Cutter', categoryHint: 'شفرات قطع', status: 'active' },
  { brandCode: 'B053', brandName: 'Stanley', categoryHint: 'شفرات وعدد', status: 'active' },
];

// ------------------------------------------------------------------------------
// 4. Compact Block Builder for All 395 Master Items
// ------------------------------------------------------------------------------
interface MasterSeedInput {
  code: string;
  canonicalName: string;
  added?: boolean;
  assetOnly?: boolean;
  safetyNote?: string;
  unitChain?: UnitChainCode;
  unitNote?: string;
  bridgeFields?: BridgeFieldKey[];
  specFields?: string[];
  artistAliases?: string[];
  supplierAliases?: string[];
  defaultBrands?: string[];
  workshops?: string[];
  availableThicknessesMm?: number[];
}

interface MasterBlockInput {
  prefix: UnifiedCategoryPrefix;
  unitChain: UnitChainCode;
  unitNote?: string;
  bridgeFields: BridgeFieldKey[];
  specFields: string[];
  artistAliases?: string[];
  supplierAliases?: string[];
  defaultBrands?: string[];
  workshops: string[];
  items: MasterSeedInput[];
}

function expandBlocks(blocks: MasterBlockInput[]): UnifiedMaterialMaster[] {
  const out: UnifiedMaterialMaster[] = [];
  for (const blk of blocks) {
    for (const it of blk.items) {
      const seqNum = parseInt(it.code.slice(2), 10) || 1;
      out.push({
        code: it.code,
        prefix: blk.prefix,
        seqNum,
        canonicalName: it.canonicalName,
        unitChain: it.unitChain || blk.unitChain,
        unitNote: it.unitNote || blk.unitNote,
        bridgeFields: it.bridgeFields || blk.bridgeFields,
        specFields: it.specFields || blk.specFields,
        artistAliases: it.artistAliases || blk.artistAliases || [],
        supplierAliases: it.supplierAliases || blk.supplierAliases || [],
        defaultBrands: it.defaultBrands || blk.defaultBrands || [],
        workshopTags: it.workshops || blk.workshops,
        safetyNote: it.safetyNote,
        isAssetOnly: Boolean(it.assetOnly),
        isAddedForEquations: Boolean(it.added),
        availableThicknessesMm: it.availableThicknessesMm,
        status: 'active',
        reviewStatus: 'approved',
        createdByRole: 'system',
        createdByName: 'منظومة الشمساوية',
      });
    }
  }
  return out;
}

const RAW_MASTER_BLOCKS: MasterBlockInput[] = [
  // ==================== TH: الحبال والخيوط والنسيج (50) ====================
  {
    prefix: 'TH',
    unitChain: 'ل1',
    bridgeFields: ['وزن_متر', 'طول_لفة', 'وزن_عبوة'],
    specFields: ['سمك مم', 'عدد الفتلات (2/3/4)', 'مفرد/مجدول/مبروم/مضفور', 'لون', 'المنشأ'],
    workshops: ['مكرمية', 'زجزاج وحبال'],
    items: [
      {
        code: 'TH0001',
        canonicalName: 'قطن مجدول',
        availableThicknessesMm: [2, 3, 4, 5, 6],
        artistAliases: ['خيط مكرمية', 'خيط خرز', 'خيط قطن مجدول', 'قطن مجدول 2-6 مم'],
        supplierAliases: ['خيط قطن مجدول', 'خيط مكرمية', 'خرز على اتنين', 'خرز على تلاتة', 'مجدول دمياطي'],
      },
      {
        code: 'TH0002',
        canonicalName: 'حبل قطن',
        availableThicknessesMm: [2, 3, 4, 5, 6],
        artistAliases: ['حبل مكرمية', 'حبل شنط', 'حبل ديكور', 'حبل مضفور'],
        supplierAliases: ['حبل قطن', 'حبل قطن مجدول', 'حبل قطن مضفور'],
        bridgeFields: ['وزن_متر', 'طول_لفة'],
        specFields: ['قطر مم', 'مجدول/مبروم/مضفور/مبطن', 'عدد الفتلات'],
      },
      {
        code: 'TH0003',
        canonicalName: 'كردون مبطن',
        availableThicknessesMm: [2, 3, 4, 5, 6],
        artistAliases: ['كردون مبطن', 'كردون قطن مبطن', 'كردون محشي', 'كردون أمريكي'],
        supplierAliases: ['كردون مبطن', 'كردون محشو قطن', 'كردون محشو بوليستر'],
        bridgeFields: ['وزن_متر', 'طول_لفة'],
        specFields: ['نوع الحشو (قطن/بوليستر)', 'سمك مم (2 إلى 6 مم)'],
      },
      {
        code: 'TH0051',
        canonicalName: 'قطن مبروم',
        added: true,
        availableThicknessesMm: [2, 3, 4, 5, 6],
        artistAliases: ['خيط قطن مبروم', 'خيط مبروم 3 فتلات', 'خيط مكرمية مبروم'],
        supplierAliases: ['قطن مبروم', 'خيط مبروم مصري', 'قطن مبروم دمياطي'],
      },
      {
        code: 'TH0052',
        canonicalName: 'بوليستر مصري',
        added: true,
        availableThicknessesMm: [2, 3, 4, 5, 6],
        artistAliases: ['خيط بوليستر مصري', 'بوليستر مكرمية', 'بوليستر شنط'],
        supplierAliases: ['خيط بوليستر مصري', 'بوليستر مجدول مصري'],
      },
      {
        code: 'TH0053',
        canonicalName: 'كردون فاضي',
        added: true,
        availableThicknessesMm: [2, 3, 4, 5, 6],
        artistAliases: ['كردون فاضي', 'كردون مجوف', 'كردون مبطط بدون حشو'],
        supplierAliases: ['كردون مجوف', 'كردون فاضي', 'كردون بدون حشو'],
        bridgeFields: ['وزن_متر', 'طول_لفة'],
      },
      {
        code: 'TH0054',
        canonicalName: 'قطن محلول',
        added: true,
        availableThicknessesMm: [2, 3, 4, 5, 6],
        artistAliases: ['خيط قطن محلول', 'قطن فتلة واحدة', 'خيط شراشيب', 'خيط ممشط'],
        supplierAliases: ['قطن محلول', 'قطن أحادي الفتلة', 'خيط مكرمية محلول'],
      },
      {
        code: 'TH0055',
        canonicalName: 'كردون الزجزاج',
        added: true,
        availableThicknessesMm: [4, 6],
        artistAliases: ['كردون زجزاج', 'حبل زجزاج', 'كردون خياطة زجزاج'],
        supplierAliases: ['كردون زجزاج 4 و 6 مم', 'حبل قطن زجزاج'],
        bridgeFields: ['وزن_متر', 'طول_لفة'],
        workshops: ['زجزاج وحبال', 'مكرمية'],
      },
      {
        code: 'TH0056',
        canonicalName: 'قطن مجدول أو مبروم سلب',
        added: true,
        availableThicknessesMm: [8, 10, 12],
        artistAliases: ['خيط سلب', 'قطن سلب', 'حبل سلب سميك', 'قطن مجدول سلب', 'قطن مبروم سلب'],
        supplierAliases: ['خيط سلب 8-12 مم', 'قطن سلب مبروم', 'حبل قطن سلب'],
        bridgeFields: ['وزن_متر', 'طول_لفة'],
        workshops: ['مكرمية', 'زجزاج وحبال'],
      },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل1',
    unitNote: 'ل1 مع الشوال ← كجم',
    bridgeFields: ['وزن_متر'],
    specFields: ['مفرد/مجدول/مبروم/حبل', 'قطر مم'],
    artistAliases: ['خيط جوت', 'حبل جوت', 'خيط خيش', 'حبل قنب'],
    supplierAliases: ['خيط جوت', 'حبل جوت', 'خيط قنب', 'ألياف جوت'],
    workshops: ['مكرمية'],
    items: [
      { code: 'TH0004', canonicalName: 'جوت' },
      { code: 'TH0005', canonicalName: 'قنب' },
      { code: 'TH0006', canonicalName: 'خيش (خيط/حبل)' },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل8',
    bridgeFields: ['وزن_عبوة', 'طول_عبوة'],
    specFields: ['وزن الشلة جم', 'طول الشلة م', 'سمك الخيط (عدد الطيات/نمرة)', 'لون', 'ألياف مخلوطة'],
    artistAliases: ['صوف', 'خيط كروشيه', 'خيط تريكو', 'أميجرومي', 'تيشيرت', 'ماكسي'],
    supplierAliases: ['شلة صوف', 'شلة أكريليك', 'خيط قطن', 'خيط تريكو', 'خيط كروشيه', 'خيط مخملي'],
    defaultBrands: ['Alize', 'Himalaya', 'YarnArt', 'Nako', 'Kartopu', 'Madame Tricote Paris', 'Red Heart', 'Schachenmayr'],
    workshops: ['كروشيه وتريكو', 'إبرة النقاش والتافت', 'كليم وغزل ولباد'],
    items: [
      { code: 'TH0007', canonicalName: 'صوف' },
      { code: 'TH0008', canonicalName: 'أكريليك' },
      { code: 'TH0009', canonicalName: 'قطن حياكة' },
      { code: 'TH0010', canonicalName: 'خيط تيشيرت وماكسي' },
      { code: 'TH0011', canonicalName: 'خيط مخملي' },
      { code: 'TH0012', canonicalName: 'خيط فرو وبوكلية' },
      { code: 'TH0013', canonicalName: 'خيط معدني ولامع' },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل1',
    unitNote: 'كرتونة ← علبة/دستة ← بكرة أو شلة ← متر',
    bridgeFields: ['طول_عبوة', 'عدد_في_العبوة'],
    specFields: ['الخامة (قطن/بوليستر/نايلون/حرير/معدني/مشمع)', 'النمرة', 'طول البكرة أو الشلة'],
    artistAliases: ['خيط ماكينة', 'خيط يدوي', 'مولينيه', 'حرير', 'خيط لامع'],
    supplierAliases: ['خيط بوليستر', 'خيط قطن', 'خيط تطريز', 'خيط ماكينة', 'خيط حرير'],
    defaultBrands: ['DMC', 'Anchor', 'Madeira', 'Gütermann', 'Coats'],
    workshops: ['تطريز', 'زجزاج وحبال'],
    items: [
      { code: 'TH0014', canonicalName: 'خيط خياطة' },
      { code: 'TH0015', canonicalName: 'خيط تطريز (مولينيه)' },
      { code: 'TH0016', canonicalName: 'خيط سيرما وقصب' },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل1',
    bridgeFields: ['طول_عبوة'],
    specFields: ['قطر مم', 'أحادي الشعيرة', 'طول البكرة'],
    workshops: ['خرز وحلي'],
    items: [
      {
        code: 'TH0017',
        canonicalName: 'نايلون شفاف (خيط صيد)',
        artistAliases: ['خيط صيد', 'خيط شفاف', 'خيط خرز شفاف'],
        supplierAliases: ['خيط صيد نايلون', 'خيط نايلون شفاف'],
      },
      {
        code: 'TH0018',
        canonicalName: 'أستك وخيط مطاطي',
        artistAliases: ['أستك', 'أستك دائري', 'أستك مسطح', 'خيط مطاط خرز'],
        supplierAliases: ['أستك ملابس', 'أستك دائري', 'أستك مسطح', 'خيط مطاط'],
        specFields: ['دائري/مسطح/مكسو', 'القطر أو العرض'],
        workshops: ['خرز وحلي', 'كروشيه وتريكو'],
      },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل6',
    unitNote: 'ل6 مع البالة ← قطع أو أمتار',
    bridgeFields: ['عرض', 'وزن_جرامي'],
    specFields: ['العرض سم', 'النسيج', 'مطبوع/سادة', 'مطاط'],
    artistAliases: ['قماش قطن', 'قماش كانفاس', 'قماش تنجيد'],
    supplierAliases: ['قماش بالة', 'طاقة قماش', 'قماش أمتار'],
    workshops: ['خياطة وتنجيد'],
    items: [
      { code: 'TH0019', canonicalName: 'قماش قطن' },
      { code: 'TH0020', canonicalName: 'كتان' },
      { code: 'TH0021', canonicalName: 'جينز' },
      { code: 'TH0022', canonicalName: 'جوخ' },
      { code: 'TH0023', canonicalName: 'لباد' },
      { code: 'TH0024', canonicalName: 'كانفاس' },
      { code: 'TH0025', canonicalName: 'تويل' },
      { code: 'TH0026', canonicalName: 'قطيفة' },
      { code: 'TH0027', canonicalName: 'مخمل' },
      { code: 'TH0028', canonicalName: 'ساتان' },
      { code: 'TH0029', canonicalName: 'أورجانزا' },
      { code: 'TH0030', canonicalName: 'تول' },
      { code: 'TH0031', canonicalName: 'شيفون' },
      { code: 'TH0032', canonicalName: 'دانتيل' },
      { code: 'TH0033', canonicalName: 'شبك' },
      { code: 'TH0034', canonicalName: 'بطانة' },
      { code: 'TH0035', canonicalName: 'غير منسوج' },
      { code: 'TH0036', canonicalName: 'قماش خيش' },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل1',
    unitNote: 'كرتونة ← دستة ← بكرة ← متر',
    bridgeFields: ['طول_عبوة'],
    specFields: ['العرض مم', 'طول اللفة', 'لون'],
    artistAliases: ['شريط ساتان', 'شريط أورجانزا', 'دانتيل', 'بييه', 'فيلكرو'],
    supplierAliases: ['شريط ساتان', 'شريط هدايا', 'شريط أورجانزا', 'شريط دانتيل', 'بييه', 'شريط فيلكرو'],
    workshops: ['خياطة وتنجيد'],
    items: [
      { code: 'TH0037', canonicalName: 'شريط ساتان' },
      { code: 'TH0038', canonicalName: 'شريط أورجانزا' },
      { code: 'TH0039', canonicalName: 'شريط دانتيل' },
      { code: 'TH0040', canonicalName: 'بييه' },
      { code: 'TH0041', canonicalName: 'فيلكرو' },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل6',
    unitNote: 'ل6 مع اللوح ← م²',
    bridgeFields: ['عرض', 'وزن_جرامي'],
    specFields: ['لاصق/غير لاصق', 'خفيف/ثقيل', 'العرض', 'السمك'],
    artistAliases: ['فازلين', 'فازلين لاصق', 'بطانة لاصقة', 'شبك تطريز', 'شبك شنط'],
    supplierAliases: ['فازلين لاصق', 'فازلين عادي', 'خامة تدعيم', 'شبك تطريز', 'شبك شنط'],
    workshops: ['خياطة وتنجيد', 'تطريز'],
    items: [
      { code: 'TH0042', canonicalName: 'فازلين لاصق' },
      { code: 'TH0043', canonicalName: 'فازلين عادي' },
      { code: 'TH0044', canonicalName: 'شبك تطريز' },
      { code: 'TH0045', canonicalName: 'شبك شنط' },
    ],
  },
  {
    prefix: 'TH',
    unitChain: 'ل2',
    bridgeFields: ['عائد_تنظيف'],
    specFields: ['نوع الألياف', 'النظافة', 'طول الألياف'],
    workshops: ['كليم وغزل ولباد'],
    items: [
      {
        code: 'TH0046',
        canonicalName: 'ألياف خام للغزل (صوف/قطن/كتان خام)',
        added: true,
        artistAliases: ['صوف خام', 'روفينج', 'فليس', 'ألياف غزل'],
        supplierAliases: ['صوف خام', 'ألياف غزل', 'روفينج'],
      },
      {
        code: 'TH0047',
        canonicalName: 'قماش تافت وبانش نيدل (مونكس/كانفاه شد)',
        added: true,
        unitChain: 'ل6',
        bridgeFields: ['عرض'],
        specFields: ['العرض', 'كثافة النسج'],
        artistAliases: ['قماش التافت', 'قماش النقاش', 'مونكس', 'كانفاه تافت'],
        supplierAliases: ['قماش بانش نيدل', 'قماش تافت'],
        workshops: ['إبرة النقاش والتافت'],
      },
      {
        code: 'TH0048',
        canonicalName: 'شاش خلفي للتافت',
        added: true,
        unitChain: 'ل6',
        bridgeFields: ['عرض'],
        specFields: ['العرض', 'الوزن الجرامي'],
        artistAliases: ['الشاش', 'شاش تافت', 'مانع انزلاق'],
        supplierAliases: ['شاش تافت', 'قماش خلفي للتافت'],
        workshops: ['إبرة النقاش والتافت'],
      },
      {
        code: 'TH0049',
        canonicalName: 'خيط سداء (نول)',
        added: true,
        unitChain: 'ل1',
        bridgeFields: ['وزن_متر'],
        specFields: ['سمك الخيط', 'النوع (قطن 100% مبروم)'],
        artistAliases: ['خيط السداء', 'سلسلة نول', 'warp cotton'],
        supplierAliases: ['خيط نول', 'خيط سداء'],
        workshops: ['كليم وغزل ولباد'],
      },
      {
        code: 'TH0050',
        canonicalName: 'صوف لباد (فلتنج)',
        added: true,
        unitChain: 'ل2',
        bridgeFields: ['انكماش'],
        specFields: ['النوع', 'اللون', 'نسبة الانكماش'],
        artistAliases: ['صوف فلتنج', 'روفينج فلتنج', 'صوف تلبيد'],
        supplierAliases: ['روفينج فلتنج', 'صوف لباد'],
        workshops: ['كليم وغزل ولباد'],
      },
    ],
  },

  // ==================== BD: الخرز والتطريز والحلي (39) ====================
  {
    prefix: 'BD',
    unitChain: 'ل4',
    unitNote: 'ل4 مع الكيلو والكيس ← جرام',
    bridgeFields: ['عدد_في_الجرام'],
    specFields: ['القطر مم', 'فتحة الخرز', 'الشكل', 'شفاف/معتم/مطفي/لامع', 'مصمت/مجوف', 'مطلي/محفور'],
    artistAliases: ['خرز زجاج', 'خرز شفاف', 'خرز ملون', 'خرز مطفي', 'خرز أكريليك', 'خرز خشب', 'خرز فخار'],
    supplierAliases: ['خرز زجاج', 'خرز صيني', 'خرز تطريز', 'خرز أكريليك', 'خرز بلاستيك', 'خرز خشبي مثقوب', 'خرز معدن', 'خرز سيراميك'],
    workshops: ['خرز وحلي', 'مكرمية'],
    items: [
      { code: 'BD0001', canonicalName: 'خرز زجاج' },
      { code: 'BD0002', canonicalName: 'خرز أكريليك' },
      { code: 'BD0003', canonicalName: 'خرز بلاستيك' },
      { code: 'BD0004', canonicalName: 'خرز خشب', workshops: ['خرز وحلي', 'مكرمية'] },
      { code: 'BD0005', canonicalName: 'خرز معدني' },
      { code: 'BD0006', canonicalName: 'خرز سيراميك' },
    ],
  },
  {
    prefix: 'BD',
    unitChain: 'ل4',
    unitNote: 'كرتونة ← كيس/خيط ← حبة',
    bridgeFields: ['عدد_في_الجرام', 'عدد_في_العبوة'],
    specFields: ['الخامة (بلاستيك/أكريليك/زجاج/طبيعي)', 'المقاس', 'الشكل', 'فتحة الخرز'],
    artistAliases: ['لولي', 'لؤلؤ صناعي', 'لؤلؤ تطريز', 'لؤلؤ طبيعي'],
    supplierAliases: ['لولي', 'لؤلؤ بلاستيك', 'لؤلؤ زجاج', 'لؤلؤ طبيعي', 'لؤلؤ مستزرع'],
    workshops: ['خرز وحلي'],
    items: [
      { code: 'BD0007', canonicalName: 'لؤلؤ صناعي' },
      { code: 'BD0008', canonicalName: 'لؤلؤ طبيعي ومستزرع' },
    ],
  },
  {
    prefix: 'BD',
    unitChain: 'ل4',
    unitNote: 'كرتونة ← جروس/شيت/شريط/علبة ← قطعة',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['المقاس (SS)', 'اللون', 'عدد الأوجه', 'زجاج/أكريليك'],
    artistAliases: ['كريستال', 'فص', 'فصوص', 'فصوص لاصقة', 'فصوص خياطة'],
    supplierAliases: ['فصوص', 'كريستال', 'فصوص ظهر مسطح', 'فصوص خياطة', 'فصوص حراري'],
    defaultBrands: ['Preciosa', 'Swarovski'],
    workshops: ['خرز وحلي'],
    items: [
      { code: 'BD0009', canonicalName: 'كريستال زجاجي' },
      { code: 'BD0010', canonicalName: 'فصوص زينة (ظهر مسطح/خياطة/حراري)' },
    ],
  },
  {
    prefix: 'BD',
    unitChain: 'ل4',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['عربي/إنجليزي/أرقام/أشكال', 'المادة', 'المقاس', 'فتحة الخرز'],
    artistAliases: ['خرز حروف', 'خرز أسماء', 'خرز أرقام', 'فواصل'],
    supplierAliases: ['خرز حروف', 'أبجدية', 'أرقام', 'فواصل خرز'],
    workshops: ['خرز وحلي'],
    items: [
      { code: 'BD0011', canonicalName: 'خرز حروف وأرقام' },
      { code: 'BD0012', canonicalName: 'فواصل خرز' },
    ],
  },
  {
    prefix: 'BD',
    unitChain: 'ل4',
    unitNote: 'ل7 للشيتات، ل1 للسلاسل والشريط، ل4 للرقع',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['بلاستيك/معدني', 'لاصق/خياطة/حراري', 'المقاس', 'الطول والعرض'],
    artistAliases: ['ترتر', 'استراس', 'فصوص تطريز', 'سلاسل تطريز', 'رقعة', 'أبليك', 'باتش', 'شارة'],
    supplierAliases: ['ترتر', 'استراس', 'فصوص ملابس', 'سلاسل ترصيع', 'رقع تطريز', 'أبليك قماش', 'باتش حراري'],
    workshops: ['تطريز', 'خرز وحلي'],
    items: [
      { code: 'BD0013', canonicalName: 'ترتر', unitChain: 'ل2' },
      { code: 'BD0014', canonicalName: 'استراس وفصوص تطريز', unitChain: 'ل7' },
      { code: 'BD0015', canonicalName: 'سلاسل ترصيع', unitChain: 'ل1' },
      { code: 'BD0016', canonicalName: 'رقع وأبليك' },
      { code: 'BD0017', canonicalName: 'شارات وباتش' },
    ],
  },
  {
    prefix: 'BD',
    unitChain: 'ل2',
    unitNote: 'ل2 ثم خيط ← حبة',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['خام/مصقول/مثقوب/رقائق', 'المقاس والشكل', 'الوزن'],
    supplierAliases: ['خرز أحجار طبيعية', 'أحجار كريمة وشبه كريمة'],
    workshops: ['خرز وحلي'],
    items: [
      { code: 'BD0018', canonicalName: 'عقيق', artistAliases: ['عقيق'] },
      { code: 'BD0019', canonicalName: 'كوارتز', artistAliases: ['كوارتز'] },
      { code: 'BD0020', canonicalName: 'أماتيست', artistAliases: ['أماتيست'] },
      { code: 'BD0021', canonicalName: 'يشم', artistAliases: ['يشم'] },
      { code: 'BD0022', canonicalName: 'تركواز / فيروز', artistAliases: ['تركواز', 'فيروز'] },
      { code: 'BD0023', canonicalName: 'عين النمر', artistAliases: ['عين النمر'] },
      { code: 'BD0024', canonicalName: 'لافا', artistAliases: ['لافا', 'حجر بركاني'] },
      { code: 'BD0025', canonicalName: 'أونيكس', artistAliases: ['أونيكس'] },
      { code: 'BD0026', canonicalName: 'حجر القمر', artistAliases: ['حجر القمر'] },
    ],
  },
  {
    prefix: 'BD',
    unitChain: 'ل4',
    unitNote: 'الجروس 144 والدستة 12',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['المعدن', 'الطلاء', 'المقاس', 'مفتوح/مغلق'],
    artistAliases: ['حلقات وصل', 'دلايات', 'أقفال', 'قواعد', 'فواصل', 'مشابك'],
    supplierAliases: ['مستلزمات إكسسوارات', 'مكونات حلي', 'حلقات', 'أقفال', 'دلايات', 'قواعد'],
    workshops: ['خرز وحلي', 'ريزن وقوالب'],
    items: [
      { code: 'BD0027', canonicalName: 'حلقات وصل' },
      { code: 'BD0028', canonicalName: 'دلايات' },
      { code: 'BD0029', canonicalName: 'أقفال' },
      { code: 'BD0030', canonicalName: 'قواعد حلقان' },
      { code: 'BD0031', canonicalName: 'قواعد خواتم' },
      { code: 'BD0032', canonicalName: 'قواعد أساور' },
      { code: 'BD0033', canonicalName: 'مشابك وأطراف تثبيت' },
      { code: 'BD0034', canonicalName: 'حامل ريزن (بيزل/صينية دلاية)', added: true },
    ],
  },
  {
    prefix: 'BD',
    unitChain: 'ل4',
    unitNote: 'كرتونة ← دستة/طقم ← قطعة',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['الأبعاد', 'المعدن', 'اللون'],
    artistAliases: ['إطار شنطة', 'قاعدة شنطة', 'قفل شنطة', 'يد شنطة', 'سلسلة شنطة'],
    supplierAliases: ['إكسسوارات شنط', 'إطارات', 'قواعد', 'أقفال', 'مقابض وسلاسل'],
    workshops: ['خرز وحلي', 'جلود'],
    items: [
      { code: 'BD0035', canonicalName: 'إطار شنطة' },
      { code: 'BD0036', canonicalName: 'قاعدة شنطة' },
      { code: 'BD0037', canonicalName: 'سلسلة شنطة' },
      { code: 'BD0038', canonicalName: 'يد/مقبض شنطة' },
      { code: 'BD0039', canonicalName: 'قفل شنطة' },
    ],
  },

  // ==================== CL: الريزن والطين والجبس والشموع والصابون (58) ====================
  {
    prefix: 'CL',
    unitChain: 'ل3',
    unitNote: 'ل3 مع الطقم (راتنج + مصلب)',
    bridgeFields: ['كثافة', 'نسبة_خلط', 'زمن_عمل'],
    specFields: ['صب/طلاء/فني', 'نسبة الخلط (وزن أو حجم)', 'زمن العمل والتصلب', 'اللزوجة'],
    artistAliases: ['ريزن', 'ريزن شفاف', 'ريزن صب', 'ريزن طلاء', 'ريزن بوليستر', 'ريزن يو في'],
    supplierAliases: ['إيبوكسي', 'ريزن إيبوكسي', 'راتنج ومصلب', 'بوليستر شفاف', 'UV Resin'],
    workshops: ['ريزن وقوالب'],
    items: [
      { code: 'CL0001', canonicalName: 'راتنج إيبوكسي' },
      { code: 'CL0002', canonicalName: 'راتنج بوليستر' },
      { code: 'CL0003', canonicalName: 'راتنج UV' },
      { code: 'CL0004', canonicalName: 'مصلب ومسرّع بوليستر', added: true, bridgeFields: ['نسبة_خلط'], specFields: ['النظام المتوافق', 'النسبة الموصى بها', 'الحرارة'], supplierAliases: ['مصلب بوليستر', 'مسرّع'] },
    ],
  },
  {
    prefix: 'CL',
    unitChain: 'ل3',
    bridgeFields: ['نسبة_خلط'],
    specFields: ['سائل/بودرة', 'شفاف/معتم', 'اللون', 'نسبة الإضافة المسموحة'],
    artistAliases: ['لون ريزن', 'ميكا', 'جليتر', 'بودرة لون', 'حبر كحولي'],
    supplierAliases: ['ألوان ريزن سائلة', 'صبغات ريزن', 'بودرة ميكا', 'جليتر', 'أحبار كحولية'],
    workshops: ['ريزن وقوالب'],
    items: [
      { code: 'CL0005', canonicalName: 'ألوان ريزن سائلة' },
      { code: 'CL0006', canonicalName: 'ميكا بودرة', unitChain: 'ل2' },
      { code: 'CL0007', canonicalName: 'جليتر', unitChain: 'ل2' },
      { code: 'CL0008', canonicalName: 'حبر كحولي' },
      { code: 'CL0009', canonicalName: 'مادة فصل قوالب', bridgeFields: [], specFields: ['النوع', 'الحجم'], artistAliases: ['مادة فصل'], supplierAliases: ['مادة فصل قوالب'] },
      { code: 'CL0010', canonicalName: 'مزيل فقاعات ومعالجات', bridgeFields: [], specFields: ['النوع', 'الحجم'], artistAliases: ['مزيل فقاعات'], supplierAliases: ['مزيل فقاعات'] },
    ],
  },
  {
    prefix: 'CL',
    unitChain: 'ل2',
    bridgeFields: ['كثافة', 'نسبة_خلط'],
    specFields: ['الصلابة', 'نسبة الخلط بالوزن', 'زمن التصلب', 'المقاس'],
    artistAliases: ['سيليكون قوالب', 'لاتكس', 'قالب'],
    supplierAliases: ['سيليكون صب RTV', 'لاتكس سائل', 'قوالب سيليكون', 'قوالب بلاستيك'],
    workshops: ['ريزن وقوالب', 'خرسانة وجبس وجيسمونايت'],
    items: [
      { code: 'CL0011', canonicalName: 'سيليكون قوالب', added: true },
      { code: 'CL0012', canonicalName: 'لاتكس قوالب', added: true },
      { code: 'CL0013', canonicalName: 'قوالب جاهزة (ريزن/شموع/صابون)', added: true, assetOnly: true, unitChain: 'ل4', bridgeFields: [], safetyNote: 'القالب القابل للتكرار أصل تشغيلي يُحمّل بنصيبه على القطع، وليس خامة مستهلكة بالكامل.' },
    ],
  },
  {
    prefix: 'CL',
    unitChain: 'ل3',
    unitNote: 'ل3 بالعبوة ← جرام',
    bridgeFields: ['وزن_عبوة', 'كثافة'],
    specFields: ['الوزن', 'اللون', 'حراري/هوائي/مرن'],
    artistAliases: ['صلصال', 'طين حراري', 'طين هوائي', 'بوليمر', 'سيراميك بارد', 'عجينة ورق', 'فليكسي'],
    supplierAliases: ['طين بوليمر', 'صلصال حراري', 'طين يجف بالهواء', 'عجينة سيراميك بارد', 'عجينة ورق'],
    defaultBrands: ['FIMO', 'Sculpey', 'Cernit', 'DAS'],
    workshops: ['صلصال وخزف'],
    items: [
      { code: 'CL0014', canonicalName: 'صلصال بوليمر (حراري)' },
      { code: 'CL0015', canonicalName: 'صلصال هوائي' },
      { code: 'CL0016', canonicalName: 'سيراميك بارد' },
      { code: 'CL0017', canonicalName: 'عجينة ورق جاهزة' },
    ],
  },
  {
    prefix: 'CL',
    unitChain: 'ل2',
    bridgeFields: ['انكماش', 'وزن_عبوة', 'تغطية'],
    specFields: ['درجة الحرق', 'لون الطينة بعد الحرق', 'نسبة الانكماش (من عينة)', 'المنشأ'],
    artistAliases: ['طينة', 'طين خزف', 'جليز', 'صب'],
    supplierAliases: ['طين خزف', 'طين فخار', 'مادة صب', 'جليز', 'أكاسيد'],
    workshops: ['صلصال وخزف'],
    items: [
      { code: 'CL0018', canonicalName: 'طين خزف وفخار (أرثنوير/ستونوير/بورسلين)', added: true },
      { code: 'CL0019', canonicalName: 'سليب (طين سائل للصب)', added: true, unitChain: 'ل3' },
      { code: 'CL0020', canonicalName: 'جليز', added: true, unitChain: 'ل3' },
      { code: 'CL0021', canonicalName: 'أكاسيد وألوان تحت الزجاج', added: true },
    ],
  },
  {
    prefix: 'CL',
    unitChain: 'ل2',
    bridgeFields: ['نسبة_خلط', 'كثافة'],
    specFields: ['النعومة', 'زمن الشك', 'النظام'],
    workshops: ['خرسانة وجبس وجيسمونايت'],
    items: [
      { code: 'CL0022', canonicalName: 'جبس باريس', artistAliases: ['جبس', 'جبس باريس'], supplierAliases: ['جبس أبيض', 'جبس ناعم'] },
      { code: 'CL0023', canonicalName: 'جبس فني وديكوري', artistAliases: ['جبس فني', 'جبس ديكوري'], supplierAliases: ['جبس فني'] },
      { code: 'CL0024', canonicalName: 'جيسمونايت – بودرة', artistAliases: ['جيسمونايت'], supplierAliases: ['Jesmonite AC100'] },
      { code: 'CL0025', canonicalName: 'جيسمونايت – سائل', added: true, unitChain: 'ل3', artistAliases: ['سائل جيسمونايت'], supplierAliases: ['سائل جيسمونايت'] },
      { code: 'CL0026', canonicalName: 'أسمنت أبيض', bridgeFields: ['كثافة'], artistAliases: ['أسمنت أبيض'], supplierAliases: ['أسمنت أبيض'] },
      { code: 'CL0027', canonicalName: 'أسمنت رمادي', bridgeFields: ['كثافة'], artistAliases: ['أسمنت رمادي'], supplierAliases: ['أسمنت رمادي'] },
      { code: 'CL0028', canonicalName: 'خليط خرسانة/تيرازو', bridgeFields: ['كثافة'], artistAliases: ['كونكريت', 'خرسانة فنية'], supplierAliases: ['خليط خرسانة', 'خليط تيرازو'] },
      { code: 'CL0029', canonicalName: 'بودرة رخام', bridgeFields: [], specFields: ['درجة النعومة', 'اللون'] },
      { code: 'CL0030', canonicalName: 'بودرة حجر', bridgeFields: [], specFields: ['درجة النعومة', 'اللون'] },
      { code: 'CL0031', canonicalName: 'رمل سيليكا/رمل ناعم', bridgeFields: [], specFields: ['حجم الحبيبات', 'اللون'] },
      { code: 'CL0032', canonicalName: 'حبيبات رخام وتيرازو', bridgeFields: [], specFields: ['حجم الحبيبات', 'اللون'] },
      { code: 'CL0033', canonicalName: 'ملدن وإضافات خرسانة', unitChain: 'ل3', bridgeFields: ['نسبة_خلط'] },
      { code: 'CL0034', canonicalName: 'مادة تقوية', unitChain: 'ل3', bridgeFields: ['نسبة_خلط'] },
      { code: 'CL0035', canonicalName: 'سيلر مائي ومذيب', added: true, unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'CL0036', canonicalName: 'ألياف تقوية (فايبر جلاس)', added: true, unitChain: 'ل6', bridgeFields: ['وزن_جرامي'] },
    ],
  },
  {
    prefix: 'CL',
    unitChain: 'ل2',
    bridgeFields: ['كثافة'],
    specFields: ['درجة الانصهار', 'مخلوط/ميكروكريستالين', 'الوزن'],
    workshops: ['شموع وصابون'],
    items: [
      { code: 'CL0037', canonicalName: 'شمع بارافين', artistAliases: ['بارافين'] },
      { code: 'CL0038', canonicalName: 'شمع صويا', artistAliases: ['صويا'] },
      { code: 'CL0039', canonicalName: 'شمع نحل', artistAliases: ['شمع نحل'] },
      { code: 'CL0040', canonicalName: 'جل شمع', artistAliases: ['جل شمع'] },
      { code: 'CL0041', canonicalName: 'شمع نخيل', artistAliases: ['شمع نخيل'] },
      { code: 'CL0042', canonicalName: 'فتيل قطني', unitChain: 'ل1', bridgeFields: ['طول_عبوة'], specFields: ['المقاس حسب قطر الوعاء', 'مغطى/بقلب داعم'] },
      { code: 'CL0043', canonicalName: 'فتيل خشبي', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'], specFields: ['العرض', 'الطول'] },
      { code: 'CL0044', canonicalName: 'لون شمع', unitChain: 'ل3', bridgeFields: ['نسبة_خلط'], specFields: ['صلب/سائل', 'النسبة المسموحة'] },
      { code: 'CL0045', canonicalName: 'عطر شموع (زيت عطري)', unitChain: 'ل3', bridgeFields: ['نسبة_خلط'], specFields: ['النسبة المسموحة'] },
      { code: 'CL0046', canonicalName: 'وعاء شموع', added: true, unitChain: 'ل4', bridgeFields: ['سعة'], specFields: ['السعة مل', 'القطر', 'المادة (زجاج/ألومنيوم/سيراميك)'], artistAliases: ['برطمان شموع', 'كوب شموع'] },
      { code: 'CL0047', canonicalName: 'غطاء وعاء', added: true, unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'CL0048', canonicalName: 'قاعدة تثبيت فتيل', added: true, unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'], artistAliases: ['ستيكر فتيل'] },
      { code: 'CL0049', canonicalName: 'قاعدة صابون جلسرين', unitChain: 'ل2', unitNote: 'ل2 مع القالب (قطعة) ← جرام', bridgeFields: ['كثافة'], artistAliases: ['قاعدة شفافة', 'قاعدة بيضاء', 'قاعدة حليبي', 'قاعدة نباتية'] },
      { code: 'CL0050', canonicalName: 'زيت زيتون', unitChain: 'ل3', bridgeFields: ['كثافة', 'رقم_تصبن'] },
      { code: 'CL0051', canonicalName: 'زيت جوز هند', unitChain: 'ل3', bridgeFields: ['كثافة', 'رقم_تصبن'] },
      { code: 'CL0052', canonicalName: 'زيت خروع', unitChain: 'ل3', bridgeFields: ['كثافة', 'رقم_تصبن'] },
      { code: 'CL0053', canonicalName: 'زبدة شيا', unitChain: 'ل2', bridgeFields: ['كثافة', 'رقم_تصبن'] },
      { code: 'CL0054', canonicalName: 'زبدة كاكاو', unitChain: 'ل2', bridgeFields: ['كثافة', 'رقم_تصبن'] },
      { code: 'CL0055', canonicalName: 'صودا كاوية (هيدروكسيد الصوديوم NaOH)', added: true, unitChain: 'ل2', bridgeFields: ['نقاء'], specFields: ['نسبة النقاء'], artistAliases: ['صودا كاوية', 'كاوستيك'], supplierAliases: ['صودا كاوية قشور', 'حبيبات NaOH'], safetyNote: 'تحذير أمان: مادة حارقة؛ يلزم ارتداء القفازات والنظارة الواقية.' },
      { code: 'CL0056', canonicalName: 'لون صابون', unitChain: 'ل3', bridgeFields: ['نسبة_خلط'] },
      { code: 'CL0057', canonicalName: 'عطر صابون', unitChain: 'ل3', bridgeFields: ['نسبة_خلط'] },
      { code: 'CL0058', canonicalName: 'مقشرات وإضافات تجميلية', unitChain: 'ل2', bridgeFields: ['نسبة_خلط'] },
    ],
  },

  // ==================== WD: الأخشاب والبامبو والخوص (24) ====================
  {
    prefix: 'WD',
    unitChain: 'ل5',
    bridgeFields: ['كثافة'],
    specFields: ['لوح/عرق/شريحة', 'السمك', 'العرض', 'الطول'],
    workshops: ['نجارة وأركت وأرابيسك'],
    items: [
      { code: 'WD0001', canonicalName: 'خشب زان', artistAliases: ['زان'] },
      { code: 'WD0002', canonicalName: 'خشب موسكي', artistAliases: ['موسكي'] },
      { code: 'WD0003', canonicalName: 'خشب سويدي', artistAliases: ['سويدي'] },
      { code: 'WD0004', canonicalName: 'أخشاب صلبة أخرى (جوز/ساج/ماهوجني)', added: true },
      { code: 'WD0005', canonicalName: 'أبلكاش', artistAliases: ['خشب طبقات'] },
      { code: 'WD0006', canonicalName: 'MDF', artistAliases: ['إم دي إف', 'خشب مضغوط'] },
      { code: 'WD0007', canonicalName: 'HDF', artistAliases: ['إتش دي إف'] },
      { code: 'WD0008', canonicalName: 'كونتر', artistAliases: ['كونتر'] },
      { code: 'WD0009', canonicalName: 'قشرة خشب', unitChain: 'ل6', artistAliases: ['رول قشرة'] },
      { code: 'WD0010', canonicalName: 'بالسا', unitChain: 'ل5' },
      { code: 'WD0011', canonicalName: 'شرائح وعيدان خشب', unitChain: 'ل4' },
      { code: 'WD0012', canonicalName: 'حلقات وقواعد خشب', unitChain: 'ل4', artistAliases: ['حلقات مكرمية خشب', 'قواعد حفر'], workshops: ['نجارة وأركت وأرابيسك', 'مكرمية'] },
      { code: 'WD0013', canonicalName: 'بامبو وخيزران (عيدان)', unitChain: 'ل1', bridgeFields: ['وزن_متر'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0014', canonicalName: 'شرائح بامبو', unitChain: 'ل1', bridgeFields: ['وزن_متر'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0015', canonicalName: 'راتان (طبيعي/صناعي)', added: true, unitChain: 'ل1', bridgeFields: ['وزن_متر'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0016', canonicalName: 'خوص', unitChain: 'ل2', bridgeFields: ['عائد_تنظيف'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0017', canonicalName: 'سعف نخيل', unitChain: 'ل2', bridgeFields: ['عائد_تنظيف'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0018', canonicalName: 'جريد', unitChain: 'ل1', bridgeFields: ['عائد_تنظيف'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0019', canonicalName: 'ليف نخيل', unitChain: 'ل2', bridgeFields: ['عائد_تنظيف'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0020', canonicalName: 'ألياف نباتية', unitChain: 'ل2', bridgeFields: ['عائد_تنظيف'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0021', canonicalName: 'قش', unitChain: 'ل2', bridgeFields: ['عائد_تنظيف'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0022', canonicalName: 'تبن', unitChain: 'ل2', bridgeFields: ['عائد_تنظيف'], workshops: ['بامبو وخوص وراتان'] },
      { code: 'WD0023', canonicalName: 'أصداف وقواقع', unitChain: 'ل4', bridgeFields: ['تغطية'], artistAliases: ['صدف', 'قواقع بحر'] },
      { code: 'WD0024', canonicalName: 'صدف الترصيع', added: true, unitChain: 'ل2', bridgeFields: ['تغطية'], artistAliases: ['صدف أرابيسك', 'عرق لؤلؤ'] },
    ],
  },

  // ==================== LT: الجلود (21) ====================
  {
    prefix: 'LT',
    unitChain: 'ل6',
    unitNote: 'بالقدم المربع أو م²',
    bridgeFields: ['عرض', 'سمك'],
    specFields: ['مدبوغ نباتياً/كيميائياً', 'السمك', 'المساحة', 'درجة التشطيب'],
    workshops: ['جلود'],
    items: [
      { code: 'LT0001', canonicalName: 'جلد بقري', artistAliases: ['جلد بقري طبيعي'] },
      { code: 'LT0002', canonicalName: 'جلد جاموسي', artistAliases: ['جلد جاموسي'] },
      { code: 'LT0003', canonicalName: 'جلد ماعز', artistAliases: ['جلد ماعز'] },
      { code: 'LT0004', canonicalName: 'جلد غنم', artistAliases: ['جلد غنم'] },
      { code: 'LT0005', canonicalName: 'سويدي ومقلوب (شمواه)', artistAliases: ['سويدي', 'مقلوب', 'شمواه'] },
      { code: 'LT0006', canonicalName: 'جلد صناعي PU', artistAliases: ['جلد صناعي', 'جلد شنط'] },
      { code: 'LT0007', canonicalName: 'جلد صناعي PVC', artistAliases: ['جلد PVC'] },
      { code: 'LT0008', canonicalName: 'خيط جلد مشمع (بوليستر)', unitChain: 'ل1', bridgeFields: ['طول_عبوة', 'وزن_متر'], artistAliases: ['خيط مشمع', 'خيط جلد'], workshops: ['جلود', 'خرز وحلي'] },
      { code: 'LT0009', canonicalName: 'خيط جلد مشمع (نايلون)', unitChain: 'ل1', bridgeFields: ['طول_عبوة', 'وزن_متر'] },
      { code: 'LT0010', canonicalName: 'دهان حواف', unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'LT0011', canonicalName: 'صبغة جلد', unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'LT0012', canonicalName: 'شمع جلد', unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'LT0013', canonicalName: 'ملمع جلد', unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'LT0014', canonicalName: 'فوم تقوية', unitChain: 'ل6', bridgeFields: ['عرض'] },
      { code: 'LT0015', canonicalName: 'بطانة شنط', unitChain: 'ل6', bridgeFields: ['عرض'] },
      { code: 'LT0016', canonicalName: 'كرتون تقوية', unitChain: 'ل5', bridgeFields: ['عرض'] },
      { code: 'LT0017', canonicalName: 'سحاب', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'LT0018', canonicalName: 'كبسونة', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'LT0019', canonicalName: 'أبزيم', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'LT0020', canonicalName: 'حلقة جلدية/معدنية', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'LT0021', canonicalName: 'مسمار وبرشام', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
    ],
  },

  // ==================== MT: المعادن والأسلاك (32) ====================
  {
    prefix: 'MT',
    unitChain: 'ل1',
    bridgeFields: ['وزن_متر', 'كثافة'],
    specFields: ['القطر/الضلع/العرض/السمك مم', 'الطول'],
    workshops: ['حدادة وأسلاك'],
    items: [
      { code: 'MT0001', canonicalName: 'سيخ حديد دائري', workshops: ['حدادة وأسلاك', 'مكرمية'] },
      { code: 'MT0002', canonicalName: 'حديد مربع', workshops: ['حدادة وأسلاك', 'مكرمية'] },
      { code: 'MT0003', canonicalName: 'حديد مسطح', workshops: ['حدادة وأسلاك', 'مكرمية'] },
      { code: 'MT0004', canonicalName: 'ماسورة حديد', workshops: ['حدادة وأسلاك', 'مكرمية'] },
      { code: 'MT0005', canonicalName: 'علبة/قطاع مجوف', workshops: ['حدادة وأسلاك', 'مكرمية'] },
      { code: 'MT0006', canonicalName: 'صاج', unitChain: 'ل5', workshops: ['حدادة وأسلاك', 'مكرمية'] },
      { code: 'MT0007', canonicalName: 'ستانلس ستيل', unitChain: 'ل2' },
      { code: 'MT0008', canonicalName: 'ألومنيوم', unitChain: 'ل2' },
      { code: 'MT0009', canonicalName: 'نحاس', unitChain: 'ل2' },
      { code: 'MT0010', canonicalName: 'نحاس أصفر', unitChain: 'ل2' },
      { code: 'MT0011', canonicalName: 'زنك', unitChain: 'ل2' },
      { code: 'MT0012', canonicalName: 'قصدير', unitChain: 'ل2' },
      { code: 'MT0013', canonicalName: 'فضة', added: true, unitChain: 'ل2', safetyNote: 'سعر المعادن الثمينة يتحدد يومياً؛ يُدخل السعر بتاريخه.' },
      { code: 'MT0014', canonicalName: 'سلك نحاس', workshops: ['حدادة وأسلاك', 'خرز وحلي'] },
      { code: 'MT0015', canonicalName: 'سلك ألومنيوم', workshops: ['حدادة وأسلاك', 'خرز وحلي'] },
      { code: 'MT0016', canonicalName: 'سلك حديد', workshops: ['حدادة وأسلاك', 'خرز وحلي'] },
      { code: 'MT0017', canonicalName: 'سلك مجلفن', workshops: ['حدادة وأسلاك', 'خرز وحلي'] },
      { code: 'MT0018', canonicalName: 'سلك ستانلس', workshops: ['حدادة وأسلاك', 'خرز وحلي'] },
      { code: 'MT0019', canonicalName: 'سلك ذاكرة (مجوهرات)', added: true, workshops: ['حدادة وأسلاك', 'خرز وحلي'] },
      { code: 'MT0020', canonicalName: 'سلاسل معدنية', unitChain: 'ل1', bridgeFields: ['وزن_متر'] },
      { code: 'MT0021', canonicalName: 'حلقات وخطافات', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'MT0022', canonicalName: 'مفصلات', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'MT0023', canonicalName: 'مسامير', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'MT0024', canonicalName: 'صواميل وورد', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'MT0025', canonicalName: 'قواعد تعليق', unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'MT0026', canonicalName: 'برايمر معادن', unitChain: 'ل3', bridgeFields: ['تغطية'], defaultBrands: ['Jotun', 'Sipes', 'GLC'] },
      { code: 'MT0027', canonicalName: 'دهان معدن', unitChain: 'ل3', bridgeFields: ['تغطية'], defaultBrands: ['Jotun', 'Sipes', 'GLC'] },
      { code: 'MT0028', canonicalName: 'بودرة إلكتروستاتيك', unitChain: 'ل2', bridgeFields: ['تغطية'] },
      { code: 'MT0029', canonicalName: 'مزيل صدأ', unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'MT0030', canonicalName: 'ملمع معادن', unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'MT0031', canonicalName: 'سلك لحام وأقطاب', added: true, unitChain: 'ل2', bridgeFields: ['وزن_متر'] },
      { code: 'MT0032', canonicalName: 'قصدير لحام وفضة لحام', added: true, unitChain: 'ل2', bridgeFields: ['وزن_متر'] },
    ],
  },

  // ==================== DC: الديكور والإضاءة والزهور (41) ====================
  {
    prefix: 'DC',
    unitChain: 'ل4',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['المقاس', 'اللون', 'الخامة'],
    workshops: ['زهور وإضاءة وديكور'],
    items: [
      { code: 'DC0001', canonicalName: 'ورق كريب', unitChain: 'ل7', bridgeFields: ['وزن_جرامي', 'عرض'] },
      { code: 'DC0002', canonicalName: 'ورق بتلات (كوري)', unitChain: 'ل7', bridgeFields: ['وزن_جرامي', 'عرض'] },
      { code: 'DC0003', canonicalName: 'قماش زهور', unitChain: 'ل6', bridgeFields: ['وزن_جرامي', 'عرض'] },
      { code: 'DC0004', canonicalName: 'بتلات جاهزة', unitChain: 'ل4' },
      { code: 'DC0005', canonicalName: 'سلك زهور مكسو', unitChain: 'ل1', bridgeFields: ['طول_عبوة'], artistAliases: ['سلك ورد', 'سلك ساق'] },
      { code: 'DC0006', canonicalName: 'شريط فلورال', unitChain: 'ل1', bridgeFields: ['طول_عبوة'], artistAliases: ['تيب فلورال', 'شريط ساق ورد'] },
      { code: 'DC0007', canonicalName: 'إسفنج زهور', added: true, unitChain: 'ل5' },
      { code: 'DC0008', canonicalName: 'زهور صناعية' },
      { code: 'DC0009', canonicalName: 'أوراق صناعية' },
      { code: 'DC0010', canonicalName: 'زهور مجففة' },
      { code: 'DC0011', canonicalName: 'أوراق وفروع مجففة' },
      { code: 'DC0012', canonicalName: 'سيقان' },
      { code: 'DC0013', canonicalName: 'سلك كهرباء', unitChain: 'ل1', bridgeFields: ['قدرة'], defaultBrands: ['Philips', 'Osram', 'LEDVANCE'], workshops: ['زهور وإضاءة وديكور', 'مكرمية'] },
      { code: 'DC0014', canonicalName: 'شريط LED', unitChain: 'ل1', bridgeFields: ['قدرة'], defaultBrands: ['Philips', 'Osram', 'LEDVANCE'], workshops: ['زهور وإضاءة وديكور', 'مكرمية'] },
      { code: 'DC0015', canonicalName: 'وحدات LED', bridgeFields: ['قدرة'], defaultBrands: ['Philips', 'Osram', 'LEDVANCE'] },
      { code: 'DC0016', canonicalName: 'لمبة', bridgeFields: ['قدرة'], defaultBrands: ['Philips', 'Osram', 'LEDVANCE'], workshops: ['زهور وإضاءة وديكور', 'مكرمية'] },
      { code: 'DC0017', canonicalName: 'سوكيت (دواية)', bridgeFields: ['قدرة'], artistAliases: ['دواية'], workshops: ['زهور وإضاءة وديكور', 'مكرمية'] },
      { code: 'DC0018', canonicalName: 'مفتاح كهرباء', bridgeFields: ['قدرة'], workshops: ['زهور وإضاءة وديكور', 'مكرمية'] },
      { code: 'DC0019', canonicalName: 'فيشة', bridgeFields: ['قدرة'], workshops: ['زهور وإضاءة وديكور', 'مكرمية'] },
      { code: 'DC0020', canonicalName: 'محول كهرباء', bridgeFields: ['قدرة'], workshops: ['زهور وإضاءة وديكور', 'مكرمية'] },
      { code: 'DC0021', canonicalName: 'بطارية', bridgeFields: ['قدرة'] },
      { code: 'DC0022', canonicalName: 'هيكل إضاءة' },
      { code: 'DC0023', canonicalName: 'قاعدة أباجورة' },
      { code: 'DC0024', canonicalName: 'قاعدة نجفة' },
      { code: 'DC0025', canonicalName: 'كوبايات وأغطية سقف', added: true },
      { code: 'DC0026', canonicalName: 'قماش شابوه', unitChain: 'ل6' },
      { code: 'DC0027', canonicalName: 'ورق إضاءة', unitChain: 'ل7' },
      { code: 'DC0028', canonicalName: 'زجاج شفاف وملون', unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'DC0029', canonicalName: 'مرايا', unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'DC0030', canonicalName: 'أكريليك (ألواح)', unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'DC0031', canonicalName: 'PVC وفوم بورد', unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'DC0032', canonicalName: 'فوم EVA', unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'DC0033', canonicalName: 'فوم جليتر وحراري', unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'DC0034', canonicalName: 'ورق ديكوباج', unitChain: 'ل7' },
      { code: 'DC0035', canonicalName: 'مناديل ديكوباج', unitChain: 'ل7' },
      { code: 'DC0036', canonicalName: 'استيكر حائط' },
      { code: 'DC0037', canonicalName: 'حروف ديكور' },
      { code: 'DC0038', canonicalName: 'عناصر زخرفية' },
      { code: 'DC0039', canonicalName: 'رمل ديكور', unitChain: 'ل2' },
      { code: 'DC0040', canonicalName: 'حصى زينة', unitChain: 'ل2' },
      { code: 'DC0041', canonicalName: 'بذور ونوى', unitChain: 'ل2' },
    ],
  },

  // ==================== AR: الفنون والطباعة والخط (39) ====================
  {
    prefix: 'AR',
    unitChain: 'ل3',
    bridgeFields: ['تغطية'],
    specFields: ['الحجم مل', 'اللون', 'الدرجة / الجودة'],
    workshops: ['رسم وطباعة وخط'],
    items: [
      { code: 'AR0001', canonicalName: 'ألوان أكريليك', defaultBrands: ['Liquitex', 'Talens (Amsterdam)', 'Pebeo', 'Daler-Rowney', 'Winsor & Newton', 'Faber-Castell'] },
      { code: 'AR0002', canonicalName: 'ألوان زيت', defaultBrands: ['Talens (Amsterdam)', 'Winsor & Newton', 'Daler-Rowney'] },
      { code: 'AR0003', canonicalName: 'ألوان مائية', defaultBrands: ['Winsor & Newton', 'Daler-Rowney', 'Faber-Castell'] },
      { code: 'AR0004', canonicalName: 'جواش', defaultBrands: ['Talens (Amsterdam)', 'Winsor & Newton'] },
      { code: 'AR0005', canonicalName: 'ألوان قماش', defaultBrands: ['Pebeo', 'Marabu', 'Talens (Amsterdam)'] },
      { code: 'AR0006', canonicalName: 'ألوان زجاج', defaultBrands: ['Pebeo', 'Marabu'] },
      { code: 'AR0007', canonicalName: 'ألوان سيراميك', defaultBrands: ['Pebeo', 'Marabu'] },
      { code: 'AR0008', canonicalName: 'ألوان خشب', defaultBrands: ['Faber-Castell', 'Marabu'] },
      { code: 'AR0009', canonicalName: 'ألوان جلد', defaultBrands: ['Pebeo', 'Talens (Amsterdam)'] },
      { code: 'AR0010', canonicalName: 'حبر طباعة', defaultBrands: ['Sakura', 'Winsor & Newton', 'Pebeo'] },
      { code: 'AR0011', canonicalName: 'حبر خط', defaultBrands: ['Sakura', 'Winsor & Newton'] },
      { code: 'AR0012', canonicalName: 'حبر فني', defaultBrands: ['Winsor & Newton', 'Sakura'] },
      { code: 'AR0013', canonicalName: 'صبغة معدنية', defaultBrands: ['Pebeo'] },
      { code: 'AR0014', canonicalName: 'ورق رسم', unitChain: 'ل7', bridgeFields: ['وزن_جرامي'], defaultBrands: ['Canson', 'Fabriano', 'Strathmore'] },
      { code: 'AR0015', canonicalName: 'ورق ألوان مائية', unitChain: 'ل7', bridgeFields: ['وزن_جرامي'], defaultBrands: ['Canson', 'Fabriano', 'Strathmore'] },
      { code: 'AR0016', canonicalName: 'ورق كرافت للرسم', unitChain: 'ل7', bridgeFields: ['وزن_جرامي'], defaultBrands: ['Canson', 'Fabriano'] },
      { code: 'AR0017', canonicalName: 'كانفاس رول', unitChain: 'ل6', bridgeFields: ['عرض', 'وزن_جرامي'] },
      { code: 'AR0018', canonicalName: 'لوحة كانفاس مشدودة', unitChain: 'ل4', bridgeFields: ['مساحة_لوح'] },
      { code: 'AR0019', canonicalName: 'لوح رسم (خشب/MDF)', unitChain: 'ل4', bridgeFields: ['مساحة_لوح'] },
      { code: 'AR0020', canonicalName: 'جيسو', defaultBrands: ['Liquitex', 'Talens (Amsterdam)', 'Pebeo', 'Winsor & Newton'] },
      { code: 'AR0021', canonicalName: 'معجون تشكيل', defaultBrands: ['Liquitex', 'Talens (Amsterdam)', 'Pebeo'] },
      { code: 'AR0022', canonicalName: 'ورنيش فني', defaultBrands: ['Liquitex', 'Winsor & Newton'] },
      { code: 'AR0023', canonicalName: 'مثبت ألوان', defaultBrands: ['Winsor & Newton', 'Talens (Amsterdam)'] },
      { code: 'AR0024', canonicalName: 'تنر', bridgeFields: [] },
      { code: 'AR0025', canonicalName: 'تربنتين', bridgeFields: [] },
      { code: 'AR0026', canonicalName: 'زيت بذر الكتان', bridgeFields: [] },
      { code: 'AR0027', canonicalName: 'وسيط رسم', added: true, bridgeFields: [] },
      { code: 'AR0028', canonicalName: 'حبر شبلونة' },
      { code: 'AR0029', canonicalName: 'شبك سلك سكرين', unitChain: 'ل6', specFields: ['عدد الخيوط (Mesh)', 'المقاس'] },
      { code: 'AR0030', canonicalName: 'مستحلب الشاشة', added: true },
      { code: 'AR0031', canonicalName: 'فيلم طباعة', unitChain: 'ل7' },
      { code: 'AR0032', canonicalName: 'ورق ترانسفير ونقل', unitChain: 'ل7', bridgeFields: ['عرض'] },
      { code: 'AR0033', canonicalName: 'فينيل حراري', unitChain: 'ل6', bridgeFields: ['عرض'] },
      { code: 'AR0034', canonicalName: 'فينيل لاصق واستيكر', unitChain: 'ل6', bridgeFields: ['عرض'] },
      { code: 'AR0035', canonicalName: 'حبر وورق التسامي (Sublimation)', added: true, unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'AR0036', canonicalName: 'لينوليوم وألواح حفر', unitChain: 'ل5', bridgeFields: ['مساحة_لوح'] },
      { code: 'AR0037', canonicalName: 'ورق خط', unitChain: 'ل7', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'AR0038', canonicalName: 'ورق ذهب وتذهيب', unitChain: 'ل7', bridgeFields: ['عدد_في_العبوة', 'مساحة_لوح'] },
      { code: 'AR0039', canonicalName: 'لاصق تذهيب (ماء ذهب)' },
    ],
  },

  // ==================== PK: التغليف والعرض (32) ====================
  {
    prefix: 'PK',
    unitChain: 'ل4',
    bridgeFields: ['عدد_في_العبوة'],
    specFields: ['المقاس', 'الخامة', 'الطباعة'],
    workshops: ['تغليف'],
    items: [
      { code: 'PK0001', canonicalName: 'ورق كرافت تغليف', unitChain: 'ل6', bridgeFields: ['وزن_جرامي'] },
      { code: 'PK0002', canonicalName: 'ورق تغليف', unitChain: 'ل7', bridgeFields: ['وزن_جرامي'] },
      { code: 'PK0003', canonicalName: 'ورق حرير', unitChain: 'ل7', bridgeFields: ['وزن_جرامي'] },
      { code: 'PK0004', canonicalName: 'ورق زبدة', unitChain: 'ل7', bridgeFields: ['وزن_جرامي'] },
      { code: 'PK0005', canonicalName: 'كرتون مضلع', unitChain: 'ل5', bridgeFields: ['وزن_جرامي'] },
      { code: 'PK0006', canonicalName: 'كرتون دوبلكس', unitChain: 'ل5', bridgeFields: ['وزن_جرامي'] },
      { code: 'PK0007', canonicalName: 'كرتون رمادي ومقوى', unitChain: 'ل5', bridgeFields: ['وزن_جرامي'] },
      { code: 'PK0008', canonicalName: 'أكياس ورق' },
      { code: 'PK0009', canonicalName: 'أكياس بلاستيك' },
      { code: 'PK0010', canonicalName: 'أكياس شفافة' },
      { code: 'PK0011', canonicalName: 'أكياس قماش' },
      { code: 'PK0012', canonicalName: 'رول فقاعات', unitChain: 'ل6', bridgeFields: ['عرض', 'طول_لفة'] },
      { code: 'PK0013', canonicalName: 'فوم تغليف', unitChain: 'ل6', bridgeFields: ['عرض', 'طول_لفة'] },
      { code: 'PK0014', canonicalName: 'شرنك', unitChain: 'ل6', bridgeFields: ['عرض', 'طول_لفة'] },
      { code: 'PK0015', canonicalName: 'استرتش', unitChain: 'ل6', bridgeFields: ['عرض', 'طول_لفة'] },
      { code: 'PK0016', canonicalName: 'شريط تغليف', unitChain: 'ل1', bridgeFields: ['طول_عبوة'], defaultBrands: ['3M (Scotch)', 'Tesa'] },
      { code: 'PK0017', canonicalName: 'دبل فيس', unitChain: 'ل1', bridgeFields: ['طول_عبوة'], defaultBrands: ['3M (Scotch)', 'Tesa'] },
      { code: 'PK0018', canonicalName: 'شريط ورقي', unitChain: 'ل1', bridgeFields: ['طول_عبوة'], defaultBrands: ['3M (Scotch)', 'Tesa'] },
      { code: 'PK0019', canonicalName: 'علبة هدايا' },
      { code: 'PK0020', canonicalName: 'علبة منتج مغناطيسية' },
      { code: 'PK0021', canonicalName: 'علبة شفافة' },
      { code: 'PK0022', canonicalName: 'كارت شكر' },
      { code: 'PK0023', canonicalName: 'كارت عناية' },
      { code: 'PK0024', canonicalName: 'كارت سعر' },
      { code: 'PK0025', canonicalName: 'استيكر شعار' },
      { code: 'PK0026', canonicalName: 'شريط هدايا', unitChain: 'ل1' },
      { code: 'PK0027', canonicalName: 'فيونكة جاهزة' },
      { code: 'PK0028', canonicalName: 'ختم', assetOnly: true },
      { code: 'PK0029', canonicalName: 'حبل تغليف', unitChain: 'ل1' },
      { code: 'PK0030', canonicalName: 'قاعدة عرض', assetOnly: true, safetyNote: 'أداة عرض دائمة تُوزع على مرات الاستخدام وليست مستهلكاً.' },
      { code: 'PK0031', canonicalName: 'حامل منتج', assetOnly: true },
      { code: 'PK0032', canonicalName: 'كيس تسوق' },
    ],
  },

  // ==================== PP: الورق والتجليد ★ (10) ====================
  {
    prefix: 'PP',
    unitChain: 'ل7',
    bridgeFields: ['وزن_جرامي'],
    specFields: ['الوزن الجرامي', 'المقاس (A4..)', 'اللون'],
    workshops: ['ورق وتجليد'],
    items: [
      { code: 'PP0001', canonicalName: 'ورق بوزن جرامي (مطبوعات/دفاتر)', added: true },
      { code: 'PP0002', canonicalName: 'ورق كوشيه', added: true },
      { code: 'PP0003', canonicalName: 'كرتون تجليد', added: true, unitChain: 'ل5', bridgeFields: ['سمك', 'مساحة_لوح'] },
      { code: 'PP0004', canonicalName: 'قماش تجليد', added: true, unitChain: 'ل6', bridgeFields: ['عرض'] },
      { code: 'PP0005', canonicalName: 'خيط تجليد', added: true, unitChain: 'ل1', bridgeFields: ['طول_عبوة'] },
      { code: 'PP0006', canonicalName: 'سلك وحلقات سبايرال', added: true, unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'] },
      { code: 'PP0007', canonicalName: 'شريط كعب الكتاب', added: true, unitChain: 'ل1', bridgeFields: ['طول_عبوة'] },
      { code: 'PP0008', canonicalName: 'غراء تجليد', added: true, unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'PP0009', canonicalName: 'ورق أوريجامي', added: true, bridgeFields: ['عدد_في_العبوة'] },
      { code: 'PP0010', canonicalName: 'شرائط كويلينج', added: true, bridgeFields: ['عرض', 'عدد_في_العبوة'] },
    ],
  },

  // ==================== GL: الزجاج والموزاييك ★ (11) ====================
  {
    prefix: 'GL',
    unitChain: 'ل2',
    bridgeFields: ['مساحة_لوح', 'وزن_عبوة'],
    specFields: ['مقاس القطعة', 'السمك', 'اللون', 'الشكل'],
    workshops: ['زجاج وموزاييك'],
    items: [
      { code: 'GL0001', canonicalName: 'موزاييك زجاج', added: true },
      { code: 'GL0002', canonicalName: 'موزاييك سيراميك', added: true },
      { code: 'GL0003', canonicalName: 'موزاييك حجر', added: true },
      { code: 'GL0004', canonicalName: 'زجاج ملون (ألواح)', added: true, unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'GL0005', canonicalName: 'زجاج معشق (Cathedral)', added: true, unitChain: 'ل5', bridgeFields: ['كثافة'] },
      { code: 'GL0006', canonicalName: 'شريط نحاس (كوبر فويل)', added: true, unitChain: 'ل1', bridgeFields: ['وزن_متر', 'عرض'] },
      { code: 'GL0007', canonicalName: 'شرائط رصاص (Lead Came)', added: true, unitChain: 'ل1', bridgeFields: ['وزن_متر', 'عرض'] },
      { code: 'GL0008', canonicalName: 'لاصق موزاييك', added: true, unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'GL0009', canonicalName: 'حشو فواصل (جراوت)', added: true, unitChain: 'ل2', bridgeFields: ['تغطية'] },
      { code: 'GL0010', canonicalName: 'معجون لحام زجاج (فلاكس)', added: true, unitChain: 'ل3', bridgeFields: ['تغطية'] },
      { code: 'GL0011', canonicalName: 'باتينا', added: true, unitChain: 'ل3', bridgeFields: ['تغطية'] },
    ],
  },

  // ==================== AX: الخامات المساعدة ومستهلكات التشغيل (38) ====================
  {
    prefix: 'AX',
    unitChain: 'ل3',
    bridgeFields: ['تغطية'],
    specFields: ['سريع/بطيء الجفاف', 'الحجم'],
    workshops: ['خياطة وتنجيد', 'نجارة وأركت وأرابيسك', 'ورق وتجليد', 'جلود'],
    items: [
      { code: 'AX0001', canonicalName: 'غراء أبيض', workshops: ['ورق وتجليد', 'جلود', 'نجارة وأركت وأرابيسك'] },
      { code: 'AX0002', canonicalName: 'غراء خشب', workshops: ['نجارة وأركت وأرابيسك', 'جلود'] },
      { code: 'AX0003', canonicalName: 'غراء قماش', workshops: ['خياطة وتنجيد', 'جلود'] },
      { code: 'AX0004', canonicalName: 'غراء جلد', workshops: ['جلود'] },
      { code: 'AX0005', canonicalName: 'غراء متعدد الأغراض' },
      { code: 'AX0006', canonicalName: 'أعواد غراء حراري', unitChain: 'ل2', bridgeFields: ['عدد_في_العبوة'], artistAliases: ['شمع مسدس', 'أعواد شمع', 'غراء حراري'], supplierAliases: ['أعواد شمع حراري', 'شمع مسدس'] },
      { code: 'AX0007', canonicalName: 'سيليكون لاصق', defaultBrands: ['Bostik', 'UHU', 'Loctite', 'Soudal'] },
      { code: 'AX0008', canonicalName: 'لاصق سريع (سيانوأكريلات)', defaultBrands: ['Bostik', 'UHU', 'Loctite', 'Soudal'] },
      { code: 'AX0009', canonicalName: 'إيبوكسي لاصق', defaultBrands: ['Bostik', 'UHU', 'Loctite', 'Soudal'] },
      { code: 'AX0010', canonicalName: 'لاتكس وغراء سجاد', added: true, defaultBrands: ['Bostik', 'Soudal'], workshops: ['إبرة النقاش والتافت'] },
      { code: 'AX0011', canonicalName: 'قطن حشو', unitChain: 'ل2', bridgeFields: ['كثافة'], workshops: ['كروشيه وتريكو', 'خياطة وتنجيد'] },
      { code: 'AX0012', canonicalName: 'فايبر حشو', unitChain: 'ل2', bridgeFields: ['كثافة'], workshops: ['كروشيه وتريكو', 'خياطة وتنجيد'] },
      { code: 'AX0013', canonicalName: 'إسفنج وفوم تنجيد', unitChain: 'ل5', bridgeFields: ['كثافة'], workshops: ['خياطة وتنجيد'] },
      { code: 'AX0014', canonicalName: 'ورنيش شفاف', workshops: ['صلصال وخزف', 'نجارة وأركت وأرابيسك'] },
      { code: 'AX0015', canonicalName: 'ملمع' },
      { code: 'AX0016', canonicalName: 'عازل وحماية' },
      { code: 'AX0017', canonicalName: 'ورق صنفرة', unitChain: 'ل7', defaultBrands: ['3M (Scotch)', 'Norton', 'Bosch'], specFields: ['رقم الحبيبات', 'المقاس'] },
      { code: 'AX0018', canonicalName: 'قرص صنفرة', unitChain: 'ل4', defaultBrands: ['3M (Scotch)', 'Norton', 'Bosch'] },
      { code: 'AX0019', canonicalName: 'منظف', bridgeFields: [] },
      { code: 'AX0020', canonicalName: 'مزيل لاصق', bridgeFields: [] },
      { code: 'AX0021', canonicalName: 'كحول تنظيف', bridgeFields: [] },
      { code: 'AX0022', canonicalName: 'دهان خشب', defaultBrands: ['Jotun', 'Sipes', 'GLC', 'Dulux'], workshops: ['نجارة وأركت وأرابيسك'] },
      { code: 'AX0023', canonicalName: 'دهان معدن', defaultBrands: ['Jotun', 'Sipes', 'GLC', 'Dulux'] },
      { code: 'AX0024', canonicalName: 'برايمر', defaultBrands: ['Jotun', 'Sipes', 'GLC', 'Dulux'] },
      { code: 'AX0025', canonicalName: 'بخاخ دهان', defaultBrands: ['Jotun', 'Sipes', 'GLC', 'Dulux'] },
      { code: 'AX0026', canonicalName: 'دهان أكريليك', defaultBrands: ['Jotun', 'Sipes', 'GLC', 'Dulux'] },
      { code: 'AX0027', canonicalName: 'إبر خياطة', unitChain: 'ل4', assetOnly: true, defaultBrands: ['Prym', 'Clover', 'DMC'] },
      { code: 'AX0028', canonicalName: 'إبر تطريز', unitChain: 'ل4', assetOnly: true, defaultBrands: ['Prym', 'Clover', 'DMC'] },
      { code: 'AX0029', canonicalName: 'إبر جلد', unitChain: 'ل4', assetOnly: true, defaultBrands: ['Prym', 'Clover', 'DMC'] },
      { code: 'AX0030', canonicalName: 'دبابيس', unitChain: 'ل4', assetOnly: true, defaultBrands: ['Prym', 'Clover'] },
      { code: 'AX0031', canonicalName: 'شفرة كتر', unitChain: 'ل4', assetOnly: true, defaultBrands: ['OLFA', 'NT Cutter', 'Stanley'] },
      { code: 'AX0032', canonicalName: 'شفرة مشرط', unitChain: 'ل4', assetOnly: true, defaultBrands: ['OLFA', 'NT Cutter', 'Stanley'] },
      { code: 'AX0033', canonicalName: 'قفازات حماية', unitChain: 'ل4', bridgeFields: [] },
      { code: 'AX0034', canonicalName: 'كمامات', unitChain: 'ل4', bridgeFields: [] },
      { code: 'AX0035', canonicalName: 'صبغات أقمشة وخيوط', added: true, unitChain: 'ل3', bridgeFields: ['نسبة_خلط'] },
      { code: 'AX0036', canonicalName: 'مثبت صبغة', added: true, unitChain: 'ل3', bridgeFields: ['نسبة_خلط'] },
      { code: 'AX0037', canonicalName: 'سنون أركت (ريش القطع)', added: true, unitChain: 'ل4', bridgeFields: ['عمر_تشغيلي'], workshops: ['نجارة وأركت وأرابيسك'] },
      { code: 'AX0038', canonicalName: 'مستلزمات تثبيت التنجيد (دبابيس/مسامير تنجيد)', added: true, unitChain: 'ل4', bridgeFields: ['عدد_في_العبوة'], workshops: ['خياطة وتنجيد'] },
    ],
  },
];

export const SEEDED_UNIFIED_MASTERS: UnifiedMaterialMaster[] = expandBlocks(RAW_MASTER_BLOCKS);

function buildThreadThicknessSpecs(
  masterCode: string,
  titlePrefix: string,
  thicknesses: number[],
  densityMultiplier = 1.0,
  origin = 'مصري'
): UnifiedMaterialSpec[] {
  return thicknesses.map((mm, idx) => {
    const weightPerMeterGrams = Number((Math.pow(mm, 2) * 0.38 * densityMultiplier).toFixed(1));
    const rollLengthMeters = Math.max(8, Math.round(1000 / Math.max(1, weightPerMeterGrams)));
    const specIndex = idx + 1;
    const specCode = `${masterCode}.${String(specIndex).padStart(2, '0')}`;
    return {
      specCode,
      masterCode,
      specIndex,
      label: `${titlePrefix} ${mm} مم`,
      thicknessMm: mm,
      origin,
      bridgeValues: { weightPerMeterGrams, rollLengthMeters, packWeightGrams: 1000 },
      status: 'active',
      reviewStatus: 'approved',
      createdByRole: 'system',
    };
  });
}

// ------------------------------------------------------------------------------
// 5. Initial Reference Specs (Level 3: Master.01, Master.02..)
// ------------------------------------------------------------------------------
export const SEEDED_UNIFIED_SPECS: UnifiedMaterialSpec[] = [
  ...buildThreadThicknessSpecs('TH0001', 'قطن مجدول', [2, 3, 4, 5, 6], 1.0, 'دمياطي'),
  ...buildThreadThicknessSpecs('TH0002', 'حبل قطن', [2, 3, 4, 5, 6], 1.15, 'مصري'),
  ...buildThreadThicknessSpecs('TH0003', 'كردون مبطن', [2, 3, 4, 5, 6], 0.95, 'مصري'),
  ...buildThreadThicknessSpecs('TH0051', 'قطن مبروم', [2, 3, 4, 5, 6], 1.08, 'دمياطي'),
  ...buildThreadThicknessSpecs('TH0052', 'بوليستر مصري', [2, 3, 4, 5, 6], 0.92, 'مصري'),
  ...buildThreadThicknessSpecs('TH0053', 'كردون فاضي', [2, 3, 4, 5, 6], 0.78, 'مصري'),
  ...buildThreadThicknessSpecs('TH0054', 'قطن محلول', [2, 3, 4, 5, 6], 0.98, 'مصري'),
  ...buildThreadThicknessSpecs('TH0055', 'كردون الزجزاج', [4, 6], 1.05, 'مصري'),
  ...buildThreadThicknessSpecs('TH0056', 'قطن مجدول أو مبروم سلب', [8, 10, 12], 1.12, 'مصري'),
  {
    specCode: 'TH0008.01',
    masterCode: 'TH0008',
    specIndex: 1,
    label: 'أكريليك متوسط السُمك (شلة 100 جم / 250 م)',
    thicknessMm: 3,
    bridgeValues: { packWeightGrams: 100, packLengthMeters: 250 },
    status: 'active',
    reviewStatus: 'approved',
    createdByRole: 'system',
  },
  {
    specCode: 'TH0008.02',
    masterCode: 'TH0008',
    specIndex: 2,
    label: 'أكريليك سميك (شلة 100 جم / 170 م)',
    thicknessMm: 4,
    bridgeValues: { packWeightGrams: 100, packLengthMeters: 170 },
    status: 'active',
    reviewStatus: 'approved',
    createdByRole: 'system',
  },
  {
    specCode: 'BD0001.01',
    masterCode: 'BD0001',
    specIndex: 1,
    label: 'خرز زجاج تفسيرة مقاس 2 مم (11/0)',
    thicknessMm: 2,
    sizeLabel: '11/0',
    bridgeValues: { countPerGram: 85 },
    status: 'active',
    reviewStatus: 'approved',
    createdByRole: 'system',
  },
  {
    specCode: 'BD0007.01',
    masterCode: 'BD0007',
    specIndex: 1,
    label: 'لولي أكريليك مقاس 8 مم (خيط 100 حبة)',
    thicknessMm: 8,
    sizeLabel: '8 مم',
    bridgeValues: { countPerGram: 3.6, countPerPack: 100 },
    status: 'active',
    reviewStatus: 'approved',
    createdByRole: 'system',
  },
  {
    specCode: 'CL0001.01',
    masterCode: 'CL0001',
    specIndex: 1,
    label: 'راتنج إيبوكسي فني صب (نسبة خلط 2:1 أو 3:1 حسب الصنف)',
    bridgeValues: { density: 1.12, mixRatio: '3:1 بالوزن', workingTimeMin: 40 },
    status: 'active',
    reviewStatus: 'approved',
    createdByRole: 'system',
  },
  {
    specCode: 'WD0005.01',
    masterCode: 'WD0005',
    specIndex: 1,
    label: 'لوح أبلكاش زان/حور 4 مم (122×244 سم)',
    thicknessMm: 4,
    sizeLabel: '122×244 سم',
    bridgeValues: { thicknessMm: 4, density: 0.6 },
    status: 'active',
    reviewStatus: 'approved',
    createdByRole: 'system',
  },
];

// ------------------------------------------------------------------------------
// 6. Seeded Aliases Registry (AL00001+) with Context Disambiguation
// ------------------------------------------------------------------------------
export const SEEDED_UNIFIED_ALIASES: UnifiedMaterialAlias[] = [
  { aliasCode: 'AL00001', targetCode: 'TH0001', aliasName: 'خيط مكرمية', aliasType: 'common', contextHint: 'خيط' },
  { aliasCode: 'AL00002', targetCode: 'TH0001', aliasName: 'خرز على اتنين', aliasType: 'supplier', contextHint: 'خيط (وليس خرز زينة)', isAmbiguous: true },
  { aliasCode: 'AL00003', targetCode: 'TH0001', aliasName: 'خرز على تلاتة', aliasType: 'supplier', contextHint: 'خيط (وليس خرز زينة)', isAmbiguous: true },
  { aliasCode: 'AL00004', targetCode: 'TH0001', aliasName: 'خيط سلب', aliasType: 'artisan', contextHint: 'خيط' },
  { aliasCode: 'AL00005', targetCode: 'TH0001', aliasName: 'قطن مبروم', aliasType: 'supplier', contextHint: 'خيط' },
  { aliasCode: 'AL00006', targetCode: 'BD0001', aliasName: 'خرز تفسيرة', aliasType: 'artisan', contextHint: 'خرز زينة', isAmbiguous: true },
  { aliasCode: 'AL00007', targetCode: 'BD0007', aliasName: 'لولي شنط', aliasType: 'artisan', contextHint: 'خرز ولؤلؤ' },
  { aliasCode: 'AL00008', targetCode: 'AX0006', aliasName: 'أعواد شمع مسدس', aliasType: 'artisan', contextHint: 'غراء حراري (وليس شمع إضاءة)', isAmbiguous: true },
  { aliasCode: 'AL00009', targetCode: 'TH0047', aliasName: 'مونكس تافتنج', aliasType: 'artisan', contextHint: 'قماش تافت' },
  { aliasCode: 'AL00010', targetCode: 'CL0028', aliasName: 'كونكريت فني', aliasType: 'artisan', contextHint: 'خرسانة وتيرازو' },
  { aliasCode: 'AL00011', targetCode: 'CL0055', aliasName: 'كاوستيك صودا', aliasType: 'artisan', contextHint: 'صناعة الصابون' },
  { aliasCode: 'AL00012', targetCode: 'TH0017', aliasName: 'خيط سنارة شفاف', aliasType: 'artisan', contextHint: 'خيط خرز' },
];

// ------------------------------------------------------------------------------
// 7. Pure Helpers: Normalization, Smart Search, Disambiguation, Code Generators
// ------------------------------------------------------------------------------
export function normalizeArabicText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatMasterCode(prefix: UnifiedCategoryPrefix, seq: number): string {
  return `${prefix}${String(Math.max(1, seq)).padStart(4, '0')}`;
}

export function formatSpecCode(masterCode: string, specIndex: number): string {
  return `${masterCode.toUpperCase()}.${String(Math.max(1, specIndex)).padStart(2, '0')}`;
}

export function formatCommercialSkuCode(specCode: string, brandCode: string = 'B000'): string {
  return `${specCode.toUpperCase()}#${brandCode.toUpperCase()}`;
}

export function generateNextMasterCode(
  prefix: UnifiedCategoryPrefix,
  masters: UnifiedMaterialMaster[],
  reservedSeqs?: Record<string, number>
): { code: string; seqNum: number } {
  const maxFromItems = masters
    .filter((m) => m.prefix === prefix)
    .reduce((max, m) => Math.max(max, Number(m.seqNum) || parseInt(m.code.slice(2), 10) || 0), 0);
  const reservedMax = Number(reservedSeqs?.[prefix] || 0);
  const nextSeq = Math.max(maxFromItems, reservedMax) + 1;
  return {
    code: formatMasterCode(prefix, nextSeq),
    seqNum: nextSeq,
  };
}

export function generateNextSpecCode(
  masterCode: string,
  specs: UnifiedMaterialSpec[]
): { specCode: string; specIndex: number } {
  const upperMaster = masterCode.toUpperCase();
  const maxIdx = specs
    .filter((s) => s.masterCode.toUpperCase() === upperMaster)
    .reduce((max, s) => Math.max(max, Number(s.specIndex) || 0), 0);
  const nextIdx = maxIdx + 1;
  return {
    specCode: formatSpecCode(upperMaster, nextIdx),
    specIndex: nextIdx,
  };
}

export function generateNextAliasCode(aliases: UnifiedMaterialAlias[]): string {
  const maxNum = aliases.reduce((max, a) => {
    const n = parseInt(String(a.aliasCode || '').replace(/\D+/g, ''), 10) || 0;
    return Math.max(max, n);
  }, 0);
  return `AL${String(maxNum + 1).padStart(5, '0')}`;
}

export function generateNextBrandCode(brands: UnifiedBrandRecord[]): string {
  const maxNum = brands.reduce((max, b) => {
    const n = parseInt(String(b.brandCode || '').replace(/\D+/g, ''), 10) || 0;
    return Math.max(max, n);
  }, 53);
  return `B${String(maxNum + 1).padStart(3, '0')}`;
}

export interface UnifiedSearchMatch {
  master: UnifiedMaterialMaster;
  specs: UnifiedMaterialSpec[];
  aliases: UnifiedMaterialAlias[];
  score: number;
  matchedVia: 'code' | 'prefix' | 'canonical' | 'alias' | 'workshop';
}

export interface UnifiedSearchResult {
  matches: UnifiedSearchMatch[];
  ambiguousCategoriesDetected: UnifiedCategoryPrefix[];
  disambiguationMessage?: string;
}

/**
 * Smart Search across Master Items, Specs, Aliases, Prefixes (e.g., "th", "wd"), and Codes ("TH0001")
 * Automatically detects cross-category ambiguity (e.g. "خرز" appearing in both TH and BD).
 */
export function searchUnifiedMaterials(
  query: string,
  masters: UnifiedMaterialMaster[],
  specs: UnifiedMaterialSpec[],
  aliases: UnifiedMaterialAlias[],
  options: {
    prefixFilter?: UnifiedCategoryPrefix | 'all';
    workshopFilter?: string;
    includeArchived?: boolean;
    hiddenMasterCodes?: Set<string>;
    customNamesByCode?: Record<string, string>;
  } = {}
): UnifiedSearchResult {
  const raw = String(query || '').trim();
  const upperRaw = raw.toUpperCase();
  const normQuery = normalizeArabicText(raw);

  // Extract 2-letter prefix if typed directly like "th" or "TH0001"
  const prefixTokenMatch = upperRaw.match(/^(TH|BD|CL|WD|LT|MT|DC|AR|PK|PP|GL|AX)$/);
  const exactCodePrefixMatch = upperRaw.match(/^(TH|BD|CL|WD|LT|MT|DC|AR|PK|PP|GL|AX)\d*/);

  const specsByMaster = new Map<string, UnifiedMaterialSpec[]>();
  for (const s of specs) {
    const arr = specsByMaster.get(s.masterCode) || [];
    arr.push(s);
    specsByMaster.set(s.masterCode, arr);
  }

  const aliasesByTarget = new Map<string, UnifiedMaterialAlias[]>();
  for (const a of aliases) {
    const arr = aliasesByTarget.get(a.targetCode) || [];
    arr.push(a);
    aliasesByTarget.set(a.targetCode, arr);
  }

  const results: UnifiedSearchMatch[] = [];

  for (const m of masters) {
    if (m.status === 'reserved_deleted') continue;
    if (!options.includeArchived && m.status === 'archived') continue;
    if (options.hiddenMasterCodes?.has(m.code)) continue;
    if (options.prefixFilter && options.prefixFilter !== 'all' && m.prefix !== options.prefixFilter) {
      continue;
    }
    if (options.workshopFilter && options.workshopFilter !== 'all') {
      const wf = normalizeArabicText(options.workshopFilter);
      const matchesWs = m.workshopTags.some((w) => normalizeArabicText(w).includes(wf) || wf.includes(normalizeArabicText(w)));
      if (!matchesWs) continue;
    }

    const itemSpecs = specsByMaster.get(m.code) || [];
    const itemAliases = aliasesByTarget.get(m.code) || [];
    const displayCanonical = options.customNamesByCode?.[m.code] || m.canonicalName;

    if (!raw) {
      results.push({ master: m, specs: itemSpecs, aliases: itemAliases, score: 1, matchedVia: 'canonical' });
      continue;
    }

    let score = 0;
    let matchedVia: UnifiedSearchMatch['matchedVia'] = 'canonical';

    if (m.code.toUpperCase() === upperRaw || itemSpecs.some((s) => s.specCode.toUpperCase() === upperRaw)) {
      score = 100;
      matchedVia = 'code';
    } else if (prefixTokenMatch && m.prefix === prefixTokenMatch[1]) {
      score = 85;
      matchedVia = 'prefix';
    } else if (exactCodePrefixMatch && m.code.toUpperCase().startsWith(upperRaw)) {
      score = 80;
      matchedVia = 'code';
    } else if (normalizeArabicText(displayCanonical) === normQuery) {
      score = 95;
      matchedVia = 'canonical';
    } else if (normalizeArabicText(displayCanonical).includes(normQuery)) {
      score = 75;
      matchedVia = 'canonical';
    } else {
      const allAliasStrings = [
        ...m.artistAliases,
        ...m.supplierAliases,
        ...itemAliases.map((a) => `${a.aliasName} ${a.aliasCode}`),
        ...itemSpecs.map((s) => `${s.label} ${s.origin || ''}`),
      ];
      const aliasHit = allAliasStrings.some((al) => normalizeArabicText(al).includes(normQuery));
      if (aliasHit) {
        score = 65;
        matchedVia = 'alias';
      } else if (m.workshopTags.some((w) => normalizeArabicText(w).includes(normQuery))) {
        score = 40;
        matchedVia = 'workshop';
      }
    }

    if (score > 0) {
      results.push({ master: m, specs: itemSpecs, aliases: itemAliases, score, matchedVia });
    }
  }

  results.sort((a, b) => b.score - a.score || a.master.code.localeCompare(b.master.code));

  // Cross-category disambiguation check (e.g., "خرز" matches both TH0001 and BD0001)
  const cats = Array.from(new Set(results.map((r) => r.master.prefix)));
  let disambiguationMessage: string | undefined;
  if (normQuery && cats.length > 1 && (normQuery.includes('خرز') || normQuery.includes('شمع') || normQuery.includes('غراء'))) {
    if (normQuery.includes('خرز')) {
      disambiguationMessage =
        'تنبيه فك الالتباس: كلمة «خرز» مشتركة بين قسم الخيوط [TH0001 قطن مجدول - خرز على اتنين/تلاتة] وقسم خرز الزينة [BD0001..BD0006]؛ اختر القسم المقصود من الكود.';
    } else if (normQuery.includes('شمع')) {
      disambiguationMessage =
        'تنبيه فك الالتباس: كلمة «شمع» مشتركة بين الشموع الخام [CL0037..CL0041] وأعواد الغراء الحراري [AX0006] وخيط الجلد المشمع [LT0008]؛ راجع الكود قبل الاختيار.';
    }
  }

  return {
    matches: results,
    ambiguousCategoriesDetected: cats,
    disambiguationMessage,
  };
}

// ------------------------------------------------------------------------------
// 8. Thread / Cord Thickness Rules (Single Source of Truth for Materials & Calculator)
//    - Cotton braided/twisted/combed, Egyptian polyester, filled & hollow cordons: 2..6 mm
//    - Zigzag cordon: 4 & 6 mm
//    - Salab braided/twisted cotton cord: 8, 10, 12 mm
//    Note: Thickness changes yarn draw/consumption in the calculator, NOT price/kg.
// ------------------------------------------------------------------------------
const THREAD_CODE_THICKNESS_MAP: Record<string, number[]> = {
  TH0001: [2, 3, 4, 5, 6], // قطن مجدول
  TH0002: [2, 3, 4, 5, 6], // حبل قطن
  TH0003: [2, 3, 4, 5, 6], // كردون مبطن
  TH0051: [2, 3, 4, 5, 6], // قطن مبروم
  TH0052: [2, 3, 4, 5, 6], // بوليستر مصري
  TH0053: [2, 3, 4, 5, 6], // كردون فاضي
  TH0054: [2, 3, 4, 5, 6], // قطن محلول
  TH0055: [4, 6],          // كردون الزجزاج
  TH0056: [8, 10, 12],     // قطن مجدول أو مبروم سلب
};

export function getThreadThicknessOptions(
  nameOrCode?: string | null,
  master?: UnifiedMaterialMaster | null
): number[] {
  if (master?.availableThicknessesMm && master.availableThicknessesMm.length > 0) {
    return [...master.availableThicknessesMm];
  }
  const upperCode = String(master?.code || nameOrCode || '').trim().toUpperCase().split('.')[0];
  if (THREAD_CODE_THICKNESS_MAP[upperCode]) {
    return [...THREAD_CODE_THICKNESS_MAP[upperCode]];
  }

  const norm = normalizeArabicText(
    [master?.canonicalName, ...(master?.artistAliases || []), ...(master?.supplierAliases || []), nameOrCode]
      .filter(Boolean)
      .join(' ')
  );

  // 1. خيط القطن المجدول أو المبروم السلب -> 8, 10, 12 مم
  if (norm.includes('سلب') || norm.includes('salab')) {
    return [8, 10, 12];
  }

  // 2. كردون الزجزاج -> 4, 6 مم
  if (norm.includes('زجزاج') || norm.includes('zigzag')) {
    return [4, 6];
  }

  // 3. القطن المجدول / المبروم / المحلول / البوليستر المصري / الكردون المبطن / الكردون الفاضي -> 2..6 مم
  if (
    norm.includes('مجدول') ||
    norm.includes('مبروم') ||
    norm.includes('محلول') ||
    norm.includes('بوليستر') ||
    norm.includes('كردون') ||
    norm.includes('كوردون') ||
    norm.includes('قيطان') ||
    norm.includes('مكرمي') ||
    norm.includes('حبل قطن') ||
    norm.includes('قطن') ||
    norm.includes('خيش') ||
    norm.includes('جوت')
  ) {
    return [2, 3, 4, 5, 6];
  }

  return [2, 3, 4, 5, 6];
}

export function isBundleThicknessThread(master?: UnifiedMaterialMaster | null): boolean {
  if (!master) return false;
  if (master.availableThicknessesMm && master.availableThicknessesMm.length > 0) return true;
  if (THREAD_CODE_THICKNESS_MAP[master.code.toUpperCase()]) return true;
  if (master.prefix !== 'TH') return false;
  const norm = normalizeArabicText(master.canonicalName);
  return (
    norm.includes('مجدول') ||
    norm.includes('مبروم') ||
    norm.includes('محلول') ||
    norm.includes('بوليستر') ||
    norm.includes('كردون') ||
    norm.includes('سلب') ||
    norm.includes('حبل')
  );
}

export function formatThreadThicknessRangeLabel(thicknesses: number[]): string {
  if (!thicknesses || thicknesses.length === 0) return '';
  if (thicknesses.length === 2) return `${thicknesses[0]} و ${thicknesses[1]} مم`;
  if (thicknesses.length >= 3) {
    const isSequential = thicknesses.every((v, i) => i === 0 || v === thicknesses[i - 1] + 1);
    if (isSequential) {
      return `من ${thicknesses[0]} إلى ${thicknesses[thicknesses.length - 1]} مم`;
    }
    return `${thicknesses.join('، ')} مم`;
  }
  return `${thicknesses[0]} مم`;
}

