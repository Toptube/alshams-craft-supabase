import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalculationInput,
  CalculationOutput,
  CraftCategory,
  Shape3DType,
  UserProfile,
  ExtraMaterialRow,
  SavedProductRecord,
  RawMaterialItem,
  EmployeeProfile,
} from '../../types';
import {
  CRAFT_CATEGORIES,
  CORD_TYPES,
  calculateMacrame,
  is3DCategory,
  isLargeItemCategory,
  getGenderArtistTitle,
  getGenderCreatorAdjective,
  FOUNDATIONAL_UNITS,
} from '../../utils/macrameMath';
import { tenantStorage } from '../../db/dexieDB';
import { flushProductSync } from '../../db/productsCloud';
import { markProductDirty, isPending } from '../../db/productSyncQueue';
import { supabase } from '../../lib/supabase';
import {
  MAIN_SECTIONS,
  SUB_CRAFTS_REGISTRY,
  MainSectionId,
  executeCraftCalculation,
} from '../../registry/craftsRegistry';
import { playSuccessSound, playErrorSound } from '../../lib/sounds';
import { useTranslation } from '../../lib/i18n';
import {
  Calculator,
  Scroll,
  Pencil,
  Plus,
  Trash2,
  Save,
  Share2,
  Sparkles,
  Layers,
  Scale,
  DollarSign,
  Package,
  Truck,
  Building,
  Info,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Boxes,
  UserCheck,
  PlusCircle,
  Cloud,
  CloudOff,
  Check,
  AlertCircle,
  HardDrive,
  RefreshCw,
  Search,
  ChevronDown,
  X,
  CheckCircle2,
  FileText,
  Settings,
  Edit2,
} from 'lucide-react';
import {
  generateArtisanQuotationPDF,
  extractQuotationDataFromRecord,
} from '../../services/quotationPdfGenerator';
import { CostBreakdownDonutChart } from './CostBreakdownDonutChart';
import { NumberInput } from '../ui/NumberInput';
import {
  ensureDefaultBasicYarns,
  isBasicMaterial,
  isExtraMaterial,
  stripParentheses,
  adaptMaterialToCordOption,
} from '../../services/materialCalculatorAdapter';
import {
  ensureDefaultMaterialsInSupabase,
  getUnitsFromSupabase,
} from '../../db/supabaseService';

interface ProductionCalculatorProps {
  profile: UserProfile;
  initialRecord?: SavedProductRecord | null;
  onOpenWhatsAppShare: (record: SavedProductRecord) => void;
  onOpenNewMaterialModal: () => void;
  onSavedSuccess?: () => void;
  externalNotesToTransfer?: string | null;
  onNotesTransferredHandled?: () => void;
}

export const ProductionCalculator: React.FC<ProductionCalculatorProps> = ({
  profile,
  initialRecord,
  onOpenWhatsAppShare,
  onOpenNewMaterialModal,
  onSavedSuccess,
  externalNotesToTransfer,
  onNotesTransferredHandled,
}) => {
  const { t: tr } = useTranslation();
  // Live Raw Materials & Employees from Database
  const [dbMaterials, setDbMaterials] = useState<RawMaterialItem[]>([]);
  const [dbEmployees, setDbEmployees] = useState<EmployeeProfile[]>([]);

  // 1. Specialized Textile Workshops list for quick switching
  const TEXTILE_WORKSHOPS = useMemo(() => [
    { id: 'macrame', nameAr: 'المكرمية والعقد اليدوي', shortName: 'المكرمية', icon: '🪢', defaultCat: 'جدارية' },
    { id: 'crochet', nameAr: 'كروشيه', shortName: 'كروشيه', icon: '🧶', defaultCat: 'باسكت كروشيه' },
    { id: 'zigzag', nameAr: 'حبال الزجزاج وخياطة الماكينة', shortName: 'الزجزاج', icon: '🧵', defaultCat: 'باسكت حلزوني' },
    { id: 'kilim', nameAr: 'الكليم والنسيج اليدوي', shortName: 'الكليم', icon: '🪡', defaultCat: 'كليم نول أرضي' },
    { id: 'punch_needle', nameAr: 'إبرة النقاش (بانش نيدل)', shortName: 'بانش نيدل', icon: '🎨', defaultCat: 'تابلوه حائطي' },
    { id: 'tufting_gun', nameAr: 'مسدس التافت وصناعة السجاد', shortName: 'التافتنج', icon: '🔫', defaultCat: 'سجادة فنية أرضية' },
  ], []);

  // User selected crafts & sequential dropdowns
  const userCraftIds = useMemo(() => {
    return profile.selectedCrafts && profile.selectedCrafts.length > 0
      ? profile.selectedCrafts
      : ['macrame'];
  }, [profile.selectedCrafts]);

  // Sub-crafts selected by the artisan
  const userSubCrafts = useMemo(() => {
    const list = SUB_CRAFTS_REGISTRY.filter((sc) => userCraftIds.includes(sc.id));
    return list.length > 0 ? list : SUB_CRAFTS_REGISTRY.filter((sc) => sc.id === 'macrame');
  }, [userCraftIds]);

  // Available main sections for the artisan (always includes ropes_textiles)
  const availableMainSections = useMemo(() => {
    return MAIN_SECTIONS;
  }, []);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(() => {
    if (initialRecord?.mainSectionId) return initialRecord.mainSectionId;
    return 'ropes_textiles';
  });

  // Keep selectedSectionId in sync if availableMainSections change
  useEffect(() => {
    if (availableMainSections.length > 0) {
      if (!selectedSectionId || !availableMainSections.some((s) => s.id === selectedSectionId)) {
        setSelectedSectionId(availableMainSections[0].id);
      }
    }
  }, [availableMainSections, selectedSectionId]);

  // Sub-crafts under selected main section (all 6 crafts always available under ropes_textiles)
  const availableSubCrafts = useMemo(() => {
    if (!selectedSectionId) return [];
    if (selectedSectionId === 'ropes_textiles') {
      return SUB_CRAFTS_REGISTRY.filter((sc) => sc.mainSectionId === 'ropes_textiles');
    }
    const filtered = userSubCrafts.filter((sc) => sc.mainSectionId === selectedSectionId);
    return filtered.length > 0 ? filtered : SUB_CRAFTS_REGISTRY.filter((sc) => sc.mainSectionId === selectedSectionId);
  }, [userSubCrafts, selectedSectionId]);

  const [selectedCraftId, setSelectedCraftId] = useState<string>(() => {
    if (initialRecord?.craftId) return initialRecord.craftId;
    return 'macrame';
  });

  // Keep selectedCraftId in sync when availableSubCrafts change
  useEffect(() => {
    if (availableSubCrafts.length > 0) {
      if (!selectedCraftId || !availableSubCrafts.some((c) => c.id === selectedCraftId)) {
        setSelectedCraftId(availableSubCrafts[0].id);
      }
    }
  }, [availableSubCrafts, selectedCraftId]);

  // Specialized State for the 5 New Textile Crafts
  // 1. Crochet
  const [hasSolidBase, setHasSolidBase] = useState<boolean>(
    initialRecord?.input?.hasSolidBase ?? false
  );
  const [crochetDepthCm, setCrochetDepthCm] = useState<number>(
    initialRecord?.input?.crochetDepthCm ?? 0
  );
  const [crochetStitchDistributions, setCrochetStitchDistributions] = useState<
    Array<{ stitchType: 'sc' | 'slst' | 'hdc' | 'dc' | 'tr' | 'puff'; percentage: number }>
  >(
    initialRecord?.input?.crochetStitchDistributions && initialRecord.input.crochetStitchDistributions.length > 0
      ? initialRecord.input.crochetStitchDistributions
      : [{ stitchType: 'sc', percentage: 100 }]
  );
  const [stitchToast, setStitchToast] = useState<string>('');
  const [crochetBaseType, setCrochetBaseType] = useState<'yarn' | 'wooden' | 'leather'>(
    initialRecord?.input?.crochetBaseType || 'wooden'
  );
  const [crochetBaseHolesCount, setCrochetBaseHolesCount] = useState<number>(
    initialRecord?.input?.crochetBaseHolesCount ?? 45
  );
  const [crochetBaseIncreasesRate, setCrochetBaseIncreasesRate] = useState<number>(
    initialRecord?.input?.crochetBaseIncreasesRate ?? 1.5
  );
  const [crochetWoodenBaseCost, setCrochetWoodenBaseCost] = useState<number>(
    initialRecord?.input?.crochetWoodenBaseCost ?? 35
  );

  // 2. Zigzag
  const [zigzagPieceType, setZigzagPieceType] = useState<'flat' | '3d' | 'clutch'>(
    initialRecord?.input?.zigzagPieceType || (initialRecord?.input?.sideHeightCm && initialRecord.input.sideHeightCm > 0 ? '3d' : '3d')
  );
  const [zigzagBaseShape, setZigzagBaseShape] = useState<'circle' | 'oval' | 'rectangle'>(
    initialRecord?.input?.zigzagBaseShape || (initialRecord?.input?.shape3D === 'circle' ? 'circle' : 'circle')
  );
  const [zigzagRopeType, setZigzagRopeType] = useState<'cotton_padded' | 'polyester'>(
    initialRecord?.input?.zigzagRopeType || 'cotton_padded'
  );
  const [zigzagRopeDiameterMm, setZigzagRopeDiameterMm] = useState<number>(
    initialRecord?.input?.zigzagRopeDiameterMm ?? 8
  );
  const [zigzagHandlesCount, setZigzagHandlesCount] = useState<number>(
    initialRecord?.input?.zigzagHandlesCount ?? 2
  );
  const [zigzagHandleLengthCm, setZigzagHandleLengthCm] = useState<number>(
    initialRecord?.input?.zigzagHandleLengthCm ?? 35
  );
  const [zigzagHasLining, setZigzagHasLining] = useState<boolean>(
    initialRecord?.input?.zigzagHasLining ?? false
  );
  const [zigzagHasZipper, setZigzagHasZipper] = useState<boolean>(
    initialRecord?.input?.zigzagHasZipper ?? false
  );
  const [zigzagHasHandles, setZigzagHasHandles] = useState<boolean>(
    initialRecord?.input?.zigzagHasHandles ?? true
  );
  const [zigzagLiningCost, setZigzagLiningCost] = useState<number>(
    initialRecord?.input?.zigzagLiningCost ?? 45
  );
  const [zigzagZipperCost, setZigzagZipperCost] = useState<number>(
    initialRecord?.input?.zigzagZipperCost ?? 20
  );
  const [zigzagAccessoriesCost, setZigzagAccessoriesCost] = useState<number>(
    initialRecord?.input?.zigzagAccessoriesCost ?? 35
  );

  // 3. Kilim
  const [kilimEpiDensity, setKilimEpiDensity] = useState<number>(
    initialRecord?.input?.kilimEpiDensity ?? 4
  );
  const [kilimLoomWasteCm, setKilimLoomWasteCm] = useState<number>(
    initialRecord?.input?.kilimLoomWasteCm ?? 40
  );
  const [kilimShrinkageFactor, setKilimShrinkageFactor] = useState<number>(
    initialRecord?.input?.kilimShrinkageFactor ?? 0.10
  );
  const [kilimWeftWoolKgPerSqM, setKilimWeftWoolKgPerSqM] = useState<number>(
    initialRecord?.input?.kilimWeftWoolKgPerSqM ?? 1.4
  );

  // 4. Punch Needle
  const [punchFabricType, setPunchFabricType] = useState<'cotton_canvas' | 'duck_fabric' | 'linen'>(
    (initialRecord?.input?.punchFabricType as any) || 'cotton_canvas'
  );
  const [punchFabricCost, setPunchFabricCost] = useState<number>(
    initialRecord?.input?.punchFabricCost ?? (initialRecord?.input?.punchMonksClothCost ?? 130)
  );
  const [punchMonksClothMarginCm, setPunchMonksClothMarginCm] = useState<number>(
    initialRecord?.input?.punchMonksClothMarginCm ?? 10
  );
  const [punchLoopHeightMm, setPunchLoopHeightMm] = useState<number>(
    initialRecord?.input?.punchLoopHeightMm ?? 5
  );
  const [punchLatexGramsPerSqM, setPunchLatexGramsPerSqM] = useState<number>(
    initialRecord?.input?.punchLatexGramsPerSqM ?? 250
  );
  const [punchMonksClothCost, setPunchMonksClothCost] = useState<number>(
    initialRecord?.input?.punchMonksClothCost ?? 130
  );

  // 5. Tufting
  const [tuftingPileType, setTuftingPileType] = useState<'cut' | 'loop'>(
    (initialRecord?.input?.tuftingPileType as any) || 'cut'
  );
  const [tuftingPrimaryClothMarginM, setTuftingPrimaryClothMarginM] = useState<number>(
    initialRecord?.input?.tuftingPrimaryClothMarginM ?? 0.20
  );
  const [tuftingLatexGlueKgPerSqM, setTuftingLatexGlueKgPerSqM] = useState<number>(
    initialRecord?.input?.tuftingLatexGlueKgPerSqM ?? 1.1
  );

  // Current craft definition
  const currentCraftDef = useMemo(() => {
    return (
      availableSubCrafts.find((c) => c.id === selectedCraftId) ||
      SUB_CRAFTS_REGISTRY.find((c) => c.id === selectedCraftId)
    );
  }, [availableSubCrafts, selectedCraftId]);

  // Craft customized product categories (persisted in localStorage per craft)
  const [craftCategoriesMap, setCraftCategoriesMap] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem('alshams_all_craft_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      // ignore
    }
    return {};
  });

  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [editingCatOld, setEditingCatOld] = useState<string | null>(null);
  const [editingCatNew, setEditingCatNew] = useState('');

  // Available product types under selected craft
  const availableProductTypes = useMemo(() => {
    if (craftCategoriesMap[selectedCraftId] && craftCategoriesMap[selectedCraftId].length > 0) {
      return craftCategoriesMap[selectedCraftId];
    }
    const baseTypes =
      currentCraftDef?.sampleCategories && currentCraftDef.sampleCategories.length > 0
        ? currentCraftDef.sampleCategories
        : selectedCraftId === 'macrame'
        ? CRAFT_CATEGORIES
        : ['مشغولة عامة'];
    return baseTypes;
  }, [currentCraftDef, selectedCraftId, craftCategoriesMap]);

  const updateCraftCategoriesList = (newList: string[]) => {
    const updated = { ...craftCategoriesMap, [selectedCraftId]: newList };
    setCraftCategoriesMap(updated);
    try {
      localStorage.setItem('alshams_all_craft_categories', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const handleAddCategoryItem = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = [...availableProductTypes];
    if (!current.includes(trimmed)) {
      current.push(trimmed);
      updateCraftCategoriesList(current);
      setCategory(trimmed as any);
    }
    setNewCategoryName('');
    setIsAddingNewCategory(false);
  };

  const handleDeleteCategoryItem = (catToDelete: string) => {
    const current = availableProductTypes.filter((c) => c !== catToDelete);
    const updated = current.length > 0 ? current : ['مشغولة جديدة'];
    updateCraftCategoriesList(updated);
    if (category === catToDelete) {
      setCategory(updated[0] as any);
    }
  };

  const handleRenameCategoryItem = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingCatOld(null);
      return;
    }
    const current = availableProductTypes.map((c) => (c === oldName ? trimmed : c));
    updateCraftCategoriesList(current);
    if (category === oldName) {
      setCategory(trimmed as any);
    }
    setEditingCatOld(null);
  };

  const handleResetCraftCategories = () => {
    const baseTypes =
      currentCraftDef?.sampleCategories && currentCraftDef.sampleCategories.length > 0
        ? currentCraftDef.sampleCategories
        : selectedCraftId === 'macrame'
        ? CRAFT_CATEGORIES
        : [];
    const updated = { ...craftCategoriesMap };
    delete updated[selectedCraftId];
    setCraftCategoriesMap(updated);
    try {
      localStorage.setItem('alshams_all_craft_categories', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
    if (baseTypes.length > 0) {
      setCategory(baseTypes[0] as any);
    }
  };

  // Workflow sequence: Category / Product type
  const [category, setCategory] = useState<CraftCategory>(
    (initialRecord?.category as CraftCategory) || 'جدارية'
  );

  // Keep category in sync with availableProductTypes
  useEffect(() => {
    if (availableProductTypes.length > 0) {
      if (!category || !availableProductTypes.includes(category as any)) {
        if (initialRecord?.category && availableProductTypes.includes(initialRecord.category as any)) {
          setCategory(initialRecord.category as any);
        } else {
          setCategory(availableProductTypes[0] as any);
        }
      }
    }
  }, [availableProductTypes]);

  // Dropdown visibility: "تُخفى القائمة تلقائياً إن كان فيها خيار واحد"
  const showSectionDropdown = availableMainSections.length > 1;
  const showCraftDropdown = availableSubCrafts.length > 1;
  const showProductTypeDropdown = availableProductTypes.length > 1;

  // "لا تظهر حقول الإدخال حتى تكتمل الاختيارات"
  const isSelectionComplete = Boolean(selectedSectionId && selectedCraftId && category);

  const [productName, setProductName] = useState(
    initialRecord?.productName || 'جدارية بوهيمية بالخرز الخشبي'
  );

  const [productImageUrl, setProductImageUrl] = useState(
    initialRecord?.imageUrl || ''
  );

  // 3D Shape
  const [shape3D, setShape3D] = useState<Shape3DType>(
    initialRecord?.input?.shape3D || 'flat'
  );

  // Dimensions
  const [widthCm, setWidthCm] = useState<number>(
    initialRecord?.input?.widthCm ?? 60
  );
  const [diameterCm, setDiameterCm] = useState<number>(
    initialRecord?.input?.diameterCm ?? 35
  );
  const [baseDiameterCm, setBaseDiameterCm] = useState<number>(
    initialRecord?.input?.baseDiameterCm ?? 40
  );
  const [sideHeightCm, setSideHeightCm] = useState<number>(
    initialRecord?.input?.sideHeightCm ?? 45
  );
  const [totalLengthCm, setTotalLengthCm] = useState<number>(
    initialRecord?.input?.totalLengthCm ?? 90
  );
  const [fringeLengthCm, setFringeLengthCm] = useState<number>(
    initialRecord?.input?.fringeLengthCm ?? 15
  );

  // Cord parameters
  const [cordTypeId, setCordTypeId] = useState<string>(
    initialRecord?.input?.cordTypeId || 'cotton_braided'
  );
  const [cordThicknessMm, setCordThicknessMm] = useState<number>(
    initialRecord?.input?.cordThicknessMm ?? 4
  );
  const [pricePerKg, setPricePerKg] = useState<number>(
    initialRecord?.input?.pricePerKg ?? 180
  );

  // Conditional material costs
  const [curtainRodCost, setCurtainRodCost] = useState<number>(
    initialRecord?.input?.curtainRodCost ?? 50
  );
  const [cushionCoverCost, setCushionCoverCost] = useState<number>(
    initialRecord?.input?.cushionCoverCost ?? 60
  );
  const [fiberCost, setFiberCost] = useState<number>(
    initialRecord?.input?.fiberCost ?? 35
  );
  const [bagAccessoriesCost, setBagAccessoriesCost] = useState<number>(
    initialRecord?.input?.bagAccessoriesCost ?? 45
  );

  // Dynamic extra materials rows
  const [extraMaterials, setExtraMaterials] = useState<ExtraMaterialRow[]>(
    initialRecord?.input?.extraMaterials || [
      {
        id: 'mat_1',
        name: 'خرز خشبي طبيعي معالج',
        unit: 'حبة',
        unitPrice: 2.5,
        quantity: 12,
        totalCost: 30,
      },
    ]
  );

  // Labor, Assigned Employee & Overhead Costs
  const [laborWage, setLaborWage] = useState<number>(
    initialRecord?.input?.laborWage ?? 180
  );
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>(
    initialRecord?.input?.assignedEmployeeId || ''
  );

  // Packaging defaults: 20 EGP small items, 150 EGP large items
  const defaultPackaging = isLargeItemCategory(category) ? 150 : 20;
  const [packagingCost, setPackagingCost] = useState<number>(
    initialRecord?.input?.packagingCost ?? defaultPackaging
  );

  const [transitFees, setTransitFees] = useState<number>(
    initialRecord?.input?.transitFees ?? 0
  );
  const [adminExpensesShare, setAdminExpensesShare] = useState<number>(
    initialRecord?.input?.adminExpensesShare ?? 30
  );

  // Insulated profit margin (0 - 500%)
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(
    initialRecord?.input?.profitMarginPercent ?? 80
  );

  // Pencil manual override toggles
  const [overrideStrandsActive, setOverrideStrandsActive] = useState<boolean>(
    Boolean(initialRecord?.input?.manualOverrideStrands)
  );
  const [manualStrands, setManualStrands] = useState<string>(
    initialRecord?.input?.manualOverrideStrands ? String(initialRecord.input.manualOverrideStrands) : ''
  );

  const [overrideLengthActive, setOverrideLengthActive] = useState<boolean>(
    Boolean(initialRecord?.input?.manualOverrideStrandLength)
  );
  const [manualLength, setManualLength] = useState<string>(
    initialRecord?.input?.manualOverrideStrandLength ? String(initialRecord.input.manualOverrideStrandLength) : ''
  );

  const [overrideWeightActive, setOverrideWeightActive] = useState<boolean>(
    Boolean(initialRecord?.input?.manualOverrideTotalWeightKg)
  );
  const [manualWeightKg, setManualWeightKg] = useState<string>(
    initialRecord?.input?.manualOverrideTotalWeightKg ? String(initialRecord.input.manualOverrideTotalWeightKg) : ''
  );

  // Personal notes box
  const [personalNotes, setPersonalNotes] = useState<string>(
    initialRecord?.input?.personalNotes || ''
  );

  // Editing existing record ID (for mutation rather than duplication)
  const [existingRecordId, setExistingRecordId] = useState<string | null>(
    initialRecord?.id || null
  );

  const [saveStatus, setSaveStatus] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'local_only' | 'saving'>(
    initialRecord ? 'synced' : 'local_only'
  );
  const [draftRestoredNotice, setDraftRestoredNotice] = useState<string>('');

  // Auto-restore last unsaved draft from dexieDB on mount if no initialRecord is loaded
  const hasAttemptedRestoreRef = React.useRef(false);
  useEffect(() => {
    if (initialRecord || hasAttemptedRestoreRef.current) return;
    hasAttemptedRestoreRef.current = true;

    let isMounted = true;
    const restoreDraft = async () => {
      try {
        const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
        if (!tenantId) return;

        const draft = await tenantStorage.getOperationDraft(tenantId, 'calculator', `draft_calc_${tenantId}`);
        if (!isMounted || !draft || !draft.data) return;

        const d = draft.data;
        if (d.category) setCategory(d.category);
        if (d.productName) setProductName(d.productName);
        if (d.selectedSectionId) setSelectedSectionId(d.selectedSectionId);
        if (d.selectedCraftId) setSelectedCraftId(d.selectedCraftId);
        if (d.shape3D) setShape3D(d.shape3D);
        if (typeof d.widthCm === 'number') setWidthCm(d.widthCm);
        if (typeof d.diameterCm === 'number') setDiameterCm(d.diameterCm);
        if (typeof d.baseDiameterCm === 'number') setBaseDiameterCm(d.baseDiameterCm);
        if (typeof d.sideHeightCm === 'number') setSideHeightCm(d.sideHeightCm);
        if (typeof d.totalLengthCm === 'number') setTotalLengthCm(d.totalLengthCm);
        if (typeof d.fringeLengthCm === 'number') setFringeLengthCm(d.fringeLengthCm);
        if (d.cordTypeId) setCordTypeId(d.cordTypeId);
        if (typeof d.cordThicknessMm === 'number') setCordThicknessMm(d.cordThicknessMm);
        if (typeof d.pricePerKg === 'number') setPricePerKg(d.pricePerKg);
        if (typeof d.curtainRodCost === 'number') setCurtainRodCost(d.curtainRodCost);
        if (typeof d.cushionCoverCost === 'number') setCushionCoverCost(d.cushionCoverCost);
        if (typeof d.fiberCost === 'number') setFiberCost(d.fiberCost);
        if (typeof d.bagAccessoriesCost === 'number') setBagAccessoriesCost(d.bagAccessoriesCost);
        if (Array.isArray(d.extraMaterials)) setExtraMaterials(d.extraMaterials);
        if (typeof d.laborWage === 'number') setLaborWage(d.laborWage);
        if (d.assignedEmployeeId) setAssignedEmployeeId(d.assignedEmployeeId);
        if (typeof d.packagingCost === 'number') setPackagingCost(d.packagingCost);
        if (typeof d.transitFees === 'number') setTransitFees(d.transitFees);
        if (typeof d.adminExpensesShare === 'number') setAdminExpensesShare(d.adminExpensesShare);
        if (typeof d.profitMarginPercent === 'number') setProfitMarginPercent(d.profitMarginPercent);
        if (d.personalNotes) setPersonalNotes(d.personalNotes);
        if (d.productImageUrl) setProductImageUrl(d.productImageUrl);
        if (d.existingRecordId) setExistingRecordId(d.existingRecordId);

        setSyncStatus(draft.syncedToCloud ? 'synced' : 'local_only');
        setDraftRestoredNotice('تم استرجاع مسودة العمل الأخيرة بأمان لحماية بيانات ورشتك.');
        setTimeout(() => {
          if (isMounted) setDraftRestoredNotice('');
        }, 5000);
      } catch (err) {
        console.warn('Could not restore calculator draft:', err);
      }
    };

    restoreDraft();

    return () => {
      isMounted = false;
    };
  }, [profile.tenantId, profile.workshopId, profile.id, initialRecord]);

  // تحديث الحقول فوراً عند تصدير قطعة هندسية من صقر الشمساوية أو استرجاع منتج
  useEffect(() => {
    if (!initialRecord) return;
    if (initialRecord.input) {
      const inp = initialRecord.input;
      if (inp.category) setCategory(inp.category);
      if (inp.productName) setProductName(inp.productName);
      if (inp.shape3D) setShape3D(inp.shape3D);
      if (typeof inp.widthCm === 'number') setWidthCm(inp.widthCm);
      if (typeof inp.diameterCm === 'number') setDiameterCm(inp.diameterCm);
      if (typeof inp.baseDiameterCm === 'number') setBaseDiameterCm(inp.baseDiameterCm);
      if (typeof inp.sideHeightCm === 'number') setSideHeightCm(inp.sideHeightCm);
      if (typeof inp.totalLengthCm === 'number') setTotalLengthCm(inp.totalLengthCm);
      if (typeof inp.fringeLengthCm === 'number') setFringeLengthCm(inp.fringeLengthCm);
      if (inp.cordTypeId) setCordTypeId(inp.cordTypeId);
      if (typeof inp.cordThicknessMm === 'number') setCordThicknessMm(inp.cordThicknessMm);
      if (typeof inp.pricePerKg === 'number') setPricePerKg(inp.pricePerKg);
      if (Array.isArray(inp.extraMaterials) && inp.extraMaterials.length > 0) setExtraMaterials(inp.extraMaterials);
      if (typeof inp.laborWage === 'number') setLaborWage(inp.laborWage);
      if (typeof inp.packagingCost === 'number') setPackagingCost(inp.packagingCost);
      if (typeof inp.transitFees === 'number') setTransitFees(inp.transitFees);
      if (typeof inp.adminExpensesShare === 'number') setAdminExpensesShare(inp.adminExpensesShare);
      if ((inp as any).notes || inp.personalNotes) setPersonalNotes((inp as any).notes || inp.personalNotes || '');
    }
    if (initialRecord.imageUrl) setProductImageUrl(initialRecord.imageUrl);
    if (initialRecord.id) setExistingRecordId(initialRecord.id);
  }, [initialRecord]);

  // Debounced auto-save draft to dexieDB whenever fields change
  const draftSaveTimeoutRef = React.useRef<any>(null);
  const isInitialMountRef = React.useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    setSyncStatus('saving');

    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
        if (!tenantId) return;

        const draftId = `draft_calc_${tenantId}`;
        await tenantStorage.saveOperationDraft({
          id: draftId,
          tenantId,
          type: 'calculator',
          title: productName.trim() || `مسودة ${category}`,
          data: {
            category,
            productName,
            selectedSectionId,
            selectedCraftId,
            shape3D,
            widthCm,
            diameterCm,
            baseDiameterCm,
            sideHeightCm,
            totalLengthCm,
            fringeLengthCm,
            cordTypeId,
            cordThicknessMm,
            pricePerKg,
            curtainRodCost,
            cushionCoverCost,
            fiberCost,
            bagAccessoriesCost,
            extraMaterials,
            laborWage,
            assignedEmployeeId,
            packagingCost,
            transitFees,
            adminExpensesShare,
            profitMarginPercent,
            manualOverrideStrands: overrideStrandsActive ? Number(manualStrands) : undefined,
            manualOverrideStrandLength: overrideLengthActive ? Number(manualLength) : undefined,
            personalNotes,
            productImageUrl,
            existingRecordId,
          },
          syncedToCloud: false,
          updatedAt: Date.now(),
        });
        setSyncStatus('local_only');
      } catch (err) {
        console.warn('Auto-save draft error:', err);
      }
    }, 800);

    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [
    category,
    productName,
    selectedSectionId,
    selectedCraftId,
    shape3D,
    widthCm,
    diameterCm,
    baseDiameterCm,
    sideHeightCm,
    totalLengthCm,
    fringeLengthCm,
    cordTypeId,
    cordThicknessMm,
    pricePerKg,
    curtainRodCost,
    cushionCoverCost,
    fiberCost,
    bagAccessoriesCost,
    extraMaterials,
    laborWage,
    assignedEmployeeId,
    packagingCost,
    transitFees,
    adminExpensesShare,
    profitMarginPercent,
    overrideStrandsActive,
    manualStrands,
    overrideLengthActive,
    manualLength,
    personalNotes,
    productImageUrl,
    existingRecordId,
  ]);

  // State for searching in materials within calculator
  const [primarySearchQuery, setPrimarySearchQuery] = useState('');
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const primaryDropdownRef = useRef<HTMLDivElement>(null);

  // State for searching in extra materials within calculator
  const [openExtraDropdownRowId, setOpenExtraDropdownRowId] = useState<string | null>(null);
  const [extraDropdownSearch, setExtraDropdownSearch] = useState<string>('');

  // Close dropdowns on outside click
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (primaryDropdownRef.current && !primaryDropdownRef.current.contains(target)) {
        setIsPrimaryDropdownOpen(false);
      }
      if (target && !target.closest?.('[data-extra-dropdown]')) {
        setOpenExtraDropdownRowId(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  // Load database raw materials & employees for dynamic feeding
  const loadDatabaseMaterialsAndStaff = async () => {
    try {
      const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
      if (!tenantId) return;

      const [supMats, untsRes, allLocalMats, emps] = await Promise.all([
        ensureDefaultMaterialsInSupabase(tenantId),
        getUnitsFromSupabase(tenantId),
        ensureDefaultBasicYarns(tenantId),
        tenantStorage.getEmployees(tenantId).catch(() => []),
      ]);

      const unitsMap = new Map<string, any>();
      (untsRes.data || []).forEach((u) => unitsMap.set(u.id, u));

      // Map Supabase materials into RawMaterialItem shape
      const mappedSupabaseMats: RawMaterialItem[] = supMats.map((sm) => {
        const u = unitsMap.get(sm.unit_id);
        const unitName = u?.name || 'كيلو';
        const costPerUnit = Number(sm.purchase_price) || 0;
        const factor = u?.factor && u.factor > 0 ? u.factor : 1000;
        const costPerGram = unitName === 'كيلو' ? costPerUnit / 1000 : costPerUnit / factor;

        return {
          id: sm.id,
          workshopId: tenantId,
          tenantId: tenantId,
          materialName: sm.name,
          category: sm.kind === 'extra' ? 'خامات إضافية' : 'خامات أساسية',
          materialCategory: sm.kind === 'extra' ? 'خامة إضافية' : 'خامة أساسية',
          unit: unitName,
          subUnit: u?.small_unit,
          conversionFactor: factor,
          marketName: sm.market_name || undefined,
          marketUnitRatio: sm.market_unit_factor,
          currentStock: 0,
          costPerUnit,
          costPerGram,
          minAlertThreshold: 5,
          isActive: true,
        };
      });

      // Merge avoiding duplicate names
      const seenNames = new Set<string>();
      const combined: RawMaterialItem[] = [];

      for (const m of mappedSupabaseMats) {
        const norm = m.materialName.trim().toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          combined.push(m);
        }
      }

      for (const m of allLocalMats) {
        const norm = m.materialName.trim().toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          combined.push(m);
        }
      }

      setDbMaterials(combined);
      setDbEmployees(emps);

      const basicMats = combined.filter(isBasicMaterial);

      // If no initial record, sync cordTypeId and pricePerKg from basic materials
      if (!initialRecord) {
        const matchingYarn = basicMats.find((m) => m.id === cordTypeId || m.materialName === cordTypeId);
        if (matchingYarn) {
          const price =
            matchingYarn.unit === 'جرام'
              ? (matchingYarn.costPerUnit || 0.18) * 1000
              : (matchingYarn.costPerUnit || (matchingYarn.costPerGram ? matchingYarn.costPerGram * 1000 : 180));
          setPricePerKg(Math.round(price));
        } else if (basicMats.length > 0) {
          const firstMat = basicMats[0];
          setCordTypeId(firstMat.id);
          const price =
            firstMat.unit === 'جرام'
              ? (firstMat.costPerUnit || 0.18) * 1000
              : (firstMat.costPerUnit || (firstMat.costPerGram ? firstMat.costPerGram * 1000 : 180));
          setPricePerKg(Math.round(price));
          const cordOpt = adaptMaterialToCordOption(firstMat);
          if (cordOpt.defaultThicknessMm) {
            setCordThicknessMm(cordOpt.defaultThicknessMm);
          }
        }
      }
    } catch (err) {
      console.error('Error loading materials:', err);
    }
  };

  useEffect(() => {
    loadDatabaseMaterialsAndStaff();
  }, [profile.tenantId, profile.workshopId, profile.id]);

  // Basic materials for cord dropdown & Extra materials for dynamic rows
  const basicMaterials = useMemo(() => {
    return dbMaterials.filter(isBasicMaterial);
  }, [dbMaterials]);

  const filteredPrimaryMaterials = useMemo(() => {
    if (!primarySearchQuery.trim()) return basicMaterials;
    const q = primarySearchQuery.toLowerCase();
    return basicMaterials.filter(
      (m) =>
        m.materialName.toLowerCase().includes(q) ||
        (m.unit && m.unit.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
    );
  }, [basicMaterials, primarySearchQuery]);

  const extraMaterialsList = useMemo(() => {
    return dbMaterials.filter(isExtraMaterial);
  }, [dbMaterials]);

  const filteredExtraMaterials = useMemo(() => {
    if (!extraDropdownSearch.trim()) return extraMaterialsList;
    const q = extraDropdownSearch.toLowerCase();
    return extraMaterialsList.filter(
      (m) =>
        m.materialName.toLowerCase().includes(q) ||
        (m.unit && m.unit.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
    );
  }, [extraMaterialsList, extraDropdownSearch]);

  // Transfer notes from Falcon AI if requested
  useEffect(() => {
    if (externalNotesToTransfer) {
      setPersonalNotes((prev) =>
        prev
          ? `${prev}\n---\n[ملاحظات صقر الشمساوية AI]:\n${externalNotesToTransfer}`
          : `[ملاحظات صقر الشمساوية AI]:\n${externalNotesToTransfer}`
      );
      if (onNotesTransferredHandled) {
        onNotesTransferredHandled();
      }
    }
  }, [externalNotesToTransfer, onNotesTransferredHandled]);

  // Sync category changes with packaging default & shapes
  useEffect(() => {
    if (isLargeItemCategory(category)) {
      setPackagingCost((prev) => (prev === 20 ? 150 : prev));
    } else {
      setPackagingCost((prev) => (prev === 150 ? 20 : prev));
    }

    if (is3DCategory(category)) {
      if (shape3D === 'flat') {
        setShape3D('cylinder');
      }
    } else {
      setShape3D('flat');
    }
  }, [category]);

  // Handle Cord type selection and default price sync from chosen material
  const handleCordTypeChange = (id: string) => {
    setCordTypeId(id);
    const selectedMat = basicMaterials.find((m) => m.id === id);
    if (selectedMat) {
      const price =
        selectedMat.unit === 'جرام'
          ? (selectedMat.costPerUnit || 0.18) * 1000
          : (selectedMat.costPerUnit || (selectedMat.costPerGram ? selectedMat.costPerGram * 1000 : 180));
      setPricePerKg(Math.round(price));
      const cordOpt = adaptMaterialToCordOption(selectedMat);
      if (cordOpt.defaultThicknessMm) {
        setCordThicknessMm(cordOpt.defaultThicknessMm);
      }
    } else {
      const selected = CORD_TYPES.find((c) => c.id === id);
      if (selected) {
        setPricePerKg(selected.defaultPricePerKg);
        setCordThicknessMm(selected.defaultThicknessMm);
      }
    }
  };

  // Extra materials handlers (pulls from database or adds custom item)
  const handleAddMaterialRow = (fromDbMaterialId?: string) => {
    let name = '';
    let unit = 'قطعة';
    let unitPrice = 0;
    let materialDbId: string | undefined = undefined;

    if (fromDbMaterialId) {
      const dbMat = extraMaterialsList.find((m) => m.id === fromDbMaterialId);
      if (dbMat) {
        materialDbId = dbMat.id;
        name = dbMat.materialName;
        unit = dbMat.unit;
        unitPrice = dbMat.costPerUnit;
      }
    }

    const newRow: ExtraMaterialRow = {
      id: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      materialDbId,
      name,
      unit,
      unitPrice,
      quantity: 1,
      totalCost: unitPrice,
    };
    setExtraMaterials([...extraMaterials, newRow]);
  };

  const handleUpdateMaterialRowMulti = (
    id: string,
    updates: Partial<ExtraMaterialRow>
  ) => {
    setExtraMaterials(
      extraMaterials.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, ...updates };
        updated.totalCost = Math.round(
          (Number(updated.unitPrice) || 0) * (Number(updated.quantity) || 0)
        );
        return updated;
      })
    );
  };

  const handleUpdateMaterialRow = (
    id: string,
    field: keyof ExtraMaterialRow,
    val: any
  ) => {
    setExtraMaterials(
      extraMaterials.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };
        if (field === 'unitPrice' || field === 'quantity') {
          updated.totalCost = Math.round(
            (Number(updated.unitPrice) || 0) * (Number(updated.quantity) || 0)
          );
        }
        return updated;
      })
    );
  };

  const handleRemoveMaterialRow = (id: string) => {
    setExtraMaterials(extraMaterials.filter((r) => r.id !== id));
  };

  // Build current calculation input object
  const calculationInput: CalculationInput = useMemo(() => {
    return {
      category,
      productName,
      shape3D,
      widthCm: Number(widthCm) || 0,
      diameterCm: Number(diameterCm) || 0,
      baseDiameterCm: Number(baseDiameterCm) || 0,
      sideHeightCm: Number(sideHeightCm) || 0,
      totalLengthCm: Number(totalLengthCm) || 0,
      fringeLengthCm: Number(fringeLengthCm) || 0,
      cordTypeId,
      cordThicknessMm: Number(cordThicknessMm) || 4,
      pricePerKg: Number(pricePerKg) || 180,
      curtainRodCost: Number(curtainRodCost) || 0,
      cushionCoverCost: Number(cushionCoverCost) || 0,
      fiberCost: Number(fiberCost) || 0,
      bagAccessoriesCost: Number(bagAccessoriesCost) || 0,
      extraMaterials,
      laborWage: Number(laborWage) || 0,
      assignedEmployeeId: assignedEmployeeId || undefined,
      packagingCost: Number(packagingCost) || 0,
      transitFees: Number(transitFees) || 0,
      adminExpensesShare: Number(adminExpensesShare) || 0,
      profitMarginPercent: Number(profitMarginPercent) || 0,
      manualOverrideStrands:
        overrideStrandsActive && manualStrands ? Number(manualStrands) : undefined,
      manualOverrideStrandLength:
        overrideLengthActive && manualLength ? Number(manualLength) : undefined,
      manualOverrideTotalWeightKg:
        overrideWeightActive && manualWeightKg ? Number(manualWeightKg) : undefined,
      personalNotes,
      productImageUrl,
      // Specialized Textile Inputs
      craftId: selectedCraftId,
      craftType: selectedCraftId,
      hasSolidBase,
      crochetDepthCm,
      crochetStitchDistributions,
      crochetBaseType: hasSolidBase ? crochetBaseType : 'yarn',
      crochetBaseHolesCount,
      crochetBaseIncreasesRate,
      crochetWoodenBaseCost,
      zigzagPieceType,
      zigzagBaseShape,
      zigzagBaseType: zigzagBaseShape,
      zigzagRopeType,
      zigzagRopeDiameterMm,
      zigzagHandlesCount,
      zigzagHandleLengthCm,
      zigzagHasLining,
      zigzagHasZipper,
      zigzagHasHandles,
      zigzagLiningCost,
      zigzagZipperCost,
      zigzagAccessoriesCost,
      kilimEpiDensity,
      kilimLoomWasteCm,
      kilimShrinkageFactor,
      kilimWeftWoolKgPerSqM,
      punchFabricType,
      punchFabricCost,
      punchMonksClothMarginCm,
      punchLoopHeightMm,
      punchLatexGramsPerSqM,
      punchMonksClothCost: punchFabricCost,
      tuftingPileType,
      tuftingPrimaryClothMarginM,
      tuftingLatexGlueKgPerSqM,
    };
  }, [
    category,
    productName,
    shape3D,
    widthCm,
    diameterCm,
    baseDiameterCm,
    sideHeightCm,
    totalLengthCm,
    fringeLengthCm,
    cordTypeId,
    cordThicknessMm,
    pricePerKg,
    curtainRodCost,
    cushionCoverCost,
    fiberCost,
    bagAccessoriesCost,
    extraMaterials,
    laborWage,
    assignedEmployeeId,
    packagingCost,
    transitFees,
    adminExpensesShare,
    profitMarginPercent,
    overrideStrandsActive,
    manualStrands,
    overrideLengthActive,
    manualLength,
    overrideWeightActive,
    manualWeightKg,
    personalNotes,
    productImageUrl,
    selectedCraftId,
    hasSolidBase,
    crochetDepthCm,
    crochetStitchDistributions,
    crochetBaseType,
    crochetBaseHolesCount,
    crochetBaseIncreasesRate,
    crochetWoodenBaseCost,
    zigzagPieceType,
    zigzagBaseShape,
    zigzagRopeType,
    zigzagRopeDiameterMm,
    zigzagHandlesCount,
    zigzagHandleLengthCm,
    zigzagHasLining,
    zigzagHasZipper,
    zigzagHasHandles,
    zigzagLiningCost,
    zigzagZipperCost,
    zigzagAccessoriesCost,
    kilimEpiDensity,
    kilimLoomWasteCm,
    kilimShrinkageFactor,
    kilimWeftWoolKgPerSqM,
    punchFabricType,
    punchFabricCost,
    punchMonksClothMarginCm,
    punchLoopHeightMm,
    punchLatexGramsPerSqM,
    punchMonksClothCost,
    tuftingPileType,
    tuftingPrimaryClothMarginM,
    tuftingLatexGlueKgPerSqM,
  ]);

  // Execute Specialized Math Engine according to active craft
  const output: CalculationOutput = useMemo(() => {
    return executeCraftCalculation(selectedCraftId, calculationInput);
  }, [selectedCraftId, calculationInput]);

  // 1. Cost Price (إجمالي الخامات المباشرة + المصنعية + التغليف + النقل + المصاريف الإدارية)
  const costPrice = useMemo(() => {
    return Math.round(
      (output.totalDirectMaterialsCost || 0) +
      (output.laborWage || 0) +
      (output.packagingCost || 0) +
      (output.transitFees || 0) +
      (output.adminExpensesShare || 0)
    );
  }, [output]);

  // 2. Retail Price (السعر القطاعي)
  const retailPrice = output.finalSellingPrice || 0;

  // 3. Wholesale Price (سعر الجملة = السعر القطاعي بعد خصم نسبة من هامش الربح فقط - افتراضي 25%)
  const wholesaleMarginDiscountPercent = profile.defaultWholesaleDiscountPercent ?? 25;
  const wholesalePrice = useMemo(() => {
    const profitMarginDiscount = Math.round(
      (output.insulatedProfitAmount || 0) * (wholesaleMarginDiscountPercent / 100)
    );
    return Math.max(costPrice, retailPrice - profitMarginDiscount);
  }, [output.insulatedProfitAmount, wholesaleMarginDiscountPercent, costPrice, retailPrice]);

  // Handle Pencil Override toggles
  const handleTogglePencil = (field: 'strands' | 'length' | 'weight') => {
    if (field === 'strands') {
      const nextState = !overrideStrandsActive;
      setOverrideStrandsActive(nextState);
      if (nextState) {
        setManualStrands(String(output.baseStrandsCount));
      } else {
        setManualStrands('');
      }
    } else if (field === 'length') {
      const nextState = !overrideLengthActive;
      setOverrideLengthActive(nextState);
      if (nextState) {
        setManualLength(String(output.singleStrandLengthCm));
      } else {
        setManualLength('');
      }
    } else if (field === 'weight') {
      const nextState = !overrideWeightActive;
      setOverrideWeightActive(nextState);
      if (nextState) {
        setManualWeightKg(String(output.totalWeightKg));
      } else {
        setManualWeightKg('');
      }
    }
  };

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setProductImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save or Mutate Product in Archive (Button relocated to absolute bottom)
  // قفل ضد الضغط المتكرر على "حفظ" (أهم سبب لتكرار المنتجات لما النت يكون ضعيف)
  const savingProductRef = useRef(false);
  const pendingNewIdRef = useRef<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isExportingQuotation, setIsExportingQuotation] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string>('');

  const handleExportQuotation = async () => {
    if (costPrice <= 0 || retailPrice <= 0) {
      setValidationWarning('⚠️ تنبيه أمان: لا يمكن تصدير عرض سعر لمنتج تكلفته أو سعره صفر! يرجى إدخال أبعاد المشغولة وتحديد الخامات أولاً.');
      playErrorSound();
      return;
    }
    setValidationWarning('');
    setIsExportingQuotation(true);
    try {
      const selectedSection = MAIN_SECTIONS.find((s) => s.id === selectedSectionId);
      const selectedCraft = SUB_CRAFTS_REGISTRY.find((c) => c.id === selectedCraftId);
      const record: SavedProductRecord = {
        id: existingRecordId || `prod_${Date.now()}`,
        tenantId: profile.tenantId || '',
        workshopId: profile.tenantId || '',
        productName: productName.trim() || `منتج ${category}`,
        productSerialNumber: initialRecord?.productSerialNumber,
        productCode: initialRecord?.productCode,
        mainSectionId: selectedSectionId,
        mainSectionName: selectedSection?.nameAr || selectedSectionId,
        craftId: selectedCraftId,
        craftName: selectedCraft?.nameAr || selectedCraftId,
        productType: category,
        category,
        costPrice,
        retailPrice,
        wholesalePrice,
        wholesaleMarginDiscountPercent,
        input: calculationInput,
        output,
        imageUrl: productImageUrl,
        isActive: true,
        createdAt: initialRecord?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      const qData = extractQuotationDataFromRecord(record);
      await generateArtisanQuotationPDF(qData, profile);
    } catch (e) {
      console.error('Failed to export quotation:', e);
    } finally {
      setIsExportingQuotation(false);
    }
  };

  const handleSaveProduct = async () => {
    // 1. فحص الأبعاد الأساسية والتحقق المالي الحي
    if (!is3D && (!widthCm || widthCm <= 0)) {
      setValidationWarning('يرجى كتابة أبعاد المشغولة لحساب وزن الخيط');
      playErrorSound();
      return;
    }
    if (shape3D === 'circle' && (!diameterCm || diameterCm <= 0)) {
      setValidationWarning('يرجى إدخال قطر المشغولة الدائرية لحساب المساحة والخيط');
      playErrorSound();
      return;
    }
    if (shape3D === 'cylinder' && ((!baseDiameterCm || baseDiameterCm <= 0) || (!sideHeightCm || sideHeightCm <= 0))) {
      setValidationWarning('يرجى إدخال قطر القاعدة وارتفاع الجدران للمجسم الاسطواني');
      playErrorSound();
      return;
    }
    // 2. منع حفظ منتج ناتج تكلفته أو سعره صفر لحماية هوامش أرباح الفنان
    if (costPrice <= 0 || retailPrice <= 0) {
      setValidationWarning('⚠️ تنبيه أمان: لا يمكن حفظ أو تصدير منتج تكلفته أو سعره صفر! يرجى إدخال أبعاد المشغولة وتحديد خاماتها لضمان حساب أرباحك بدقة.');
      playErrorSound();
      return;
    }

    setValidationWarning('');
    if (savingProductRef.current) return;
    savingProductRef.current = true;
    setIsSavingProduct(true);
    setSaveStatus('جاري الحفظ وتوليد الرقم التسلسلي في قاعدة البيانات...');
    try {
      // معرف ثابت: لو المنتج جديد بنولّده مرة واحدة ونفضل نستخدمه، ومعاه جزء عشوائي عشان جهازين ما يطلعوش نفس الرقم
      const recordId =
        existingRecordId ||
        pendingNewIdRef.current ||
        (pendingNewIdRef.current = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

      // رقم منتج متسلسل تلقائي من قاعدة البيانات المحلية
      let serialNum = initialRecord?.productSerialNumber;
      if (!serialNum) {
        serialNum = await tenantStorage.getNextProductSerialNumber(tenantId);
      }
      const productCode = `PRD-${String(serialNum).padStart(4, '0')}`;

      const selectedSection = MAIN_SECTIONS.find((s) => s.id === selectedSectionId);
      const selectedCraft = SUB_CRAFTS_REGISTRY.find((c) => c.id === selectedCraftId);

      const savedRecord: SavedProductRecord = {
        id: recordId,
        tenantId,
        workshopId: tenantId,
        productName: productName.trim() || `منتج ${category}`,
        productSerialNumber: serialNum,
        productCode,
        mainSectionId: selectedSectionId,
        mainSectionName: selectedSection?.nameAr || selectedSectionId,
        craftId: selectedCraftId,
        craftName: selectedCraft?.nameAr || selectedCraftId,
        productType: category,
        category,
        costPrice,
        retailPrice,
        wholesalePrice,
        wholesaleMarginDiscountPercent,
        input: calculationInput,
        output,
        imageUrl: productImageUrl,
        inStore: initialRecord?.inStore ?? true,
        isPublishedInStore: initialRecord?.isPublishedInStore ?? true,
        storePrice: initialRecord?.storePrice || retailPrice,
        currentStock: initialRecord?.currentStock ?? 0,
        isActive: true,
        createdAt: initialRecord?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      // Mutates / overwrites existing record via Dexie instead of duplicating
      await tenantStorage.mutateProduct(savedRecord);
      // ثبّت المعرف فوراً بعد الحفظ المحلي (قبل أي اتصال بالنت) عشان أي حفظ تاني يعدّل نفس المنتج
      setExistingRecordId(recordId);
      pendingNewIdRef.current = null;
      // اتحفظ على الجهاز واتسجّل في طابور المزامنة (من mutateProduct).
      // لو فيه نت بيترفع حالاً، ولو مفيش بيترفع لوحده أول ما النت يرجع.
      let cloudSynced = false;
      try {
        const primaryName = basicMaterials.find((m) => m.id === cordTypeId)?.materialName;
        if (tenantId) {
          markProductDirty(tenantId, savedRecord.id, primaryName);
          // ما نستناش النت أكتر من 6 ثواني — الحفظ المحلي تم، والرفع يكمل في الخلفية
          const attempt = async () => {
            await flushProductSync(tenantId);
            if (isPending(tenantId, savedRecord.id) && navigator.onLine) await flushProductSync(tenantId);
          };
          await Promise.race([attempt().catch(() => {}), new Promise((r) => setTimeout(r, 6000))]);
          cloudSynced = !isPending(tenantId, savedRecord.id);
        }
      } catch (e) {
        console.warn('Supabase product sync deferred:', e);
        cloudSynced = false;
      }

      setSyncStatus(cloudSynced ? 'synced' : 'local_only');

      // Update operation draft in dexieDB to reflect cloud sync status
      const draftId = `draft_calc_${tenantId}`;
      await tenantStorage.saveOperationDraft({
        id: draftId,
        tenantId,
        type: 'calculator',
        title: savedRecord.productName,
        data: {
          savedRecordId: recordId,
          ...calculationInput,
          output,
        },
        syncedToCloud: cloudSynced,
        updatedAt: Date.now(),
      });

      setExistingRecordId(recordId);

      // If user overrode values, log to local AI knowledge base for continuous learning
      if (calculationInput.manualOverrideStrands) {
        await tenantStorage.logArtisanOverride({
          id: 'ai_kn_' + Math.random().toString(36).substring(2, 9),
          tenantId,
          category,
          overrideField: 'عدد الفتلات الأساسية',
          initialValue: output.baseStrandsCount,
          overriddenValue: calculationInput.manualOverrideStrands,
          reason: 'تعديل قلم الحرفي في ورشة الإنتاج',
          timestamp: Date.now(),
        });
      }

      playSuccessSound();
      setSaveStatus(`تم حفظ وتوثيق المنتج برقم متسلسل #${serialNum} (${productCode}) بنجاح!`);
      setTimeout(() => setSaveStatus(''), 3000);

      if (onSavedSuccess) onSavedSuccess();
    } catch (err: any) {
      playErrorSound();
      setSaveStatus('تعذر الحفظ: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      savingProductRef.current = false;
      setIsSavingProduct(false);
    }
  };

  const is3D = is3DCategory(category);

  return (
    <div className="space-y-6">
      {/* Top Banner - Strictly renamed to "حاسبة تكاليف المنتج" */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300/40 dark:border-amber-800/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <Calculator className="w-4 h-4" />
            <span>نظام التسعير والهندسة الحرفية المتقدم</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            حاسبة تكاليف المنتج: {productName || 'منتج جديد'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* مؤشر بصري لحالة التخزين والمزامنة السحابية */}
          {syncStatus === 'synced' && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold shadow-2xs"
              title={tr('calc_synced_cloud')}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{tr('calc_synced_cloud')}</span>
            </div>
          )}

          {syncStatus === 'local_only' && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-bold shadow-2xs"
              title={tr('calc_local_only')}
            >
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <HardDrive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{tr('calc_local_only')}</span>
            </div>
          )}

          {syncStatus === 'saving' && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-[11px] font-bold"
              title={tr('calc_saving')}
            >
              <RefreshCw className="w-3 h-3 animate-spin text-stone-500" />
              <span>{tr('calc_saving')}</span>
            </div>
          )}

          {existingRecordId ? (
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300/50">
              {tr('calc_editing_record') || 'تعديل مباشر على السجل الحالي'}
            </span>
          ) : (
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300/50">
              {tr('calc_new_draft') || 'مسودة تسعير جديدة'}
            </span>
          )}
        </div>
      </div>

      {draftRestoredNotice && (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{draftRestoredNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDraftRestoredNotice('')}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer text-xs"
          >
            {tr('close') || 'إغلاق'}
          </button>
        </div>
      )}

      {saveStatus && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* 0. Quick Craft Switcher Bar for Ropes & Textiles (ورش قسم الحبال والنسيج الـ 6) */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Scroll className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-black text-amber-300">
              ورش قسم [الحبال والنسيج] — التبديل السريع لمحركات الحساب المتخصصة
            </h3>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            الورشة النشطة: {TEXTILE_WORKSHOPS.find((w) => w.id === selectedCraftId || (selectedCraftId === 'kelim' && w.id === 'kilim'))?.shortName || currentCraftDef?.nameAr || 'المكرمية'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {TEXTILE_WORKSHOPS.map((workshop) => {
            const isSelected = selectedCraftId === workshop.id || (selectedCraftId === 'kelim' && workshop.id === 'kilim');
            return (
              <button
                key={workshop.id}
                type="button"
                onClick={() => {
                  setSelectedSectionId('ropes_textiles');
                  setSelectedCraftId(workshop.id);
                  const craftDef = SUB_CRAFTS_REGISTRY.find((c) => c.id === workshop.id || (workshop.id === 'kilim' && c.id === 'kelim'));
                  if (craftDef?.sampleCategories && craftDef.sampleCategories.length > 0) {
                    setCategory(craftDef.sampleCategories[0] as any);
                  }
                }}
                className={`p-2.5 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-xs font-bold border cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600 text-stone-950 border-amber-300 shadow-md scale-[1.02] ring-2 ring-amber-400/50'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-amber-500/50 hover:text-white'
                }`}
              >
                <span className="text-xl">{workshop.icon}</span>
                <span className="text-center font-black truncate w-full">{workshop.shortName}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-amber-950/30 text-amber-950 font-black' : 'bg-slate-700 text-amber-300/80'}`}>
                  {workshop.nameAr.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Three Sequential Dropdowns: (أ) القسم الرئيسي (ب) الحرفة الفرعية (ج) نوع المنتج */}
      {(showSectionDropdown || showCraftDropdown || showProductTypeDropdown) && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100">
                {tr('calc_craft_path')}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500">
              <span>{tr('calc_craft_path')}:</span>
              <span className="text-amber-600 dark:text-amber-400">
                {currentCraftDef?.nameAr || 'مكرمية'}
              </span>
              <span>•</span>
              <span className="text-stone-700 dark:text-stone-300">{category}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* (أ) القسم الرئيسي - يُخفى إن كان خياراً واحداً */}
            {showSectionDropdown && (
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  1. القسم الرئيسي *
                </label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => {
                    const newSecId = e.target.value;
                    setSelectedSectionId(newSecId);
                    const craftsInSec = userSubCrafts.filter((c) => c.mainSectionId === newSecId);
                    if (craftsInSec.length > 0) {
                      const firstCraft = craftsInSec[0];
                      setSelectedCraftId(firstCraft.id);
                      if (firstCraft.sampleCategories && firstCraft.sampleCategories.length > 0) {
                        setCategory(firstCraft.sampleCategories[0] as any);
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {availableMainSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* (ب) الحرفة الفرعية - تُخفى إن كان خياراً واحداً */}
            {showCraftDropdown && (
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  2. الحرفة الفرعية *
                </label>
                <select
                  value={selectedCraftId}
                  onChange={(e) => {
                    const newCraftId = e.target.value;
                    setSelectedCraftId(newCraftId);
                    const craftDef = SUB_CRAFTS_REGISTRY.find((c) => c.id === newCraftId);
                    if (craftDef?.sampleCategories && craftDef.sampleCategories.length > 0) {
                      setCategory(craftDef.sampleCategories[0] as any);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {availableSubCrafts.map((craft) => (
                    <option key={craft.id} value={craft.id}>
                      {craft.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* (ج) نوع المنتج - يُخفى إن كان خياراً واحداً */}
            {showProductTypeDropdown && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    3. نوع المنتج *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>نوع مخصص</span>
                  </button>
                </div>

                {isAddingNewCategory && (
                  <div className="mb-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="نوع منتج جديد (مثال: رانر، ستائر، كوشن)"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCategoryItem(newCategoryName)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs"
                    >
                      إضافة
                    </button>
                  </div>
                )}

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {availableProductTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. لا تظهر حقول الإدخال حتى تكتمل الاختيارات */}
      {!isSelectionComplete ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
            يرجى استكمال تحديد القسم الرئيسي والحرفة ونوع المنتج
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            حدد الاختيارات من القوائم أعلاه لبدء تشغيل حاسبة التكاليف وعرض كافة مدخلات الأبعاد ومواصفات التشغيل.
          </p>
        </div>
      ) : (
        /* 3. الحاسبة الهندسية والمالية الشاملة لكافة الحِرف والمشغولات اليدوية */
        <>
          {/* Grid: 2 Columns on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Mechanical & Financial Outputs (Sticky Card) */}
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-4 order-2 lg:order-1">
          {/* Mechanical Output Card */}
          <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                المعادلات الميكانيكية الدقيقة
              </span>
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>مخرجات القص والتشغيل</span>
              </h3>
            </div>

            {output.craftMetrics && output.craftMetrics.craftId !== 'macrame' ? (
              /* Specialized Craft Metrics Output */
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                    {output.craftMetrics.craftNameAr}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-stone-950">
                    نسبة الهالك المعتمدة: {output.craftMetrics.wasteFactorPercent}%
                  </span>
                </div>

                {output.craftMetrics.craftId === 'crochet' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">وزن خيط القاعدة (Base Yarn):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.baseWeightGrams || 0} جم</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">وزن خيط الجدران (Walls Yarn):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.wallWeightGrams || 0} جم</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">هالك التشغيل المحسوب (5%):</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">+{output.craftMetrics.wasteAmount || 0} جم</span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex justify-between items-center">
                      <span className="font-bold text-stone-800 dark:text-stone-200">إجمالي وزن الخيط المطلوب:</span>
                      <span className="font-mono font-black text-base text-amber-700 dark:text-amber-300">
                        {output.totalWeightKg} كجم ({output.totalWeightGrams} جم)
                      </span>
                    </div>
                  </div>
                )}

                {output.craftMetrics.craftId === 'zigzag' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">إجمالي المساحة السطحية:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.totalSurfaceAreaCm2 || 0} سم² (قاعدة {output.craftMetrics.baseAreaCm2 || 0} + جدران {output.craftMetrics.wallAreaCm2 || 0})
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">محيط القاعدة الصافي:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.perimeterCm || 0} سم</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">حبل القاعدة المنفرد:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.baseRopeMeters || 0} متر</span>
                    </div>
                    {Boolean(output.craftMetrics.wallRopeMeters || output.craftMetrics.handlesRopeMeters) && (
                      <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                        <span className="text-stone-600 dark:text-stone-400">حبل الجدران والأيادي:</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                          {((output.craftMetrics.wallRopeMeters || 0) + (output.craftMetrics.handlesRopeMeters || 0)).toFixed(1)} متر
                        </span>
                      </div>
                    )}
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">خيط المكوك والخياطة (3.6x):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.sewingThreadMeters || 0} متر ({output.craftMetrics.sewingThreadBobbins || 0} بكرة)
                      </span>
                    </div>
                    {Boolean((output.craftMetrics.liningCost || 0) + (output.craftMetrics.zipperCost || 0) + (output.craftMetrics.accessoriesCost || 0)) && (
                      <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                        <span className="text-stone-600 dark:text-stone-400">تكلفة البطانة والسوست والإكسسوار:</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                          {((output.craftMetrics.liningCost || 0) + (output.craftMetrics.zipperCost || 0) + (output.craftMetrics.accessoriesCost || 0))} ج
                        </span>
                      </div>
                    )}
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex justify-between items-center">
                      <span className="font-bold text-stone-800 dark:text-stone-200">إجمالي الحبل المطلوب ({output.craftMetrics.ropeType || 'حبل زجزاج'}):</span>
                      <span className="font-mono font-black text-base text-amber-700 dark:text-amber-300">
                        {output.craftMetrics.totalRopeMeters} متر ({output.totalWeightKg} كجم)
                      </span>
                    </div>
                  </div>
                )}

                {output.craftMetrics.craftId === 'kilim' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">عدد خيوط السداء المشدودة:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.warpThreadsCount || 0} فتلة سداء</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">طول السداء بفاقد النول 40سم والانكماش:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.totalWarpLengthMeters || 0} متر ({output.craftMetrics.warpWeightKg || 0} كجم)</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">صوف اللحمة (بهالك 15%):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.weftWoolWeightKg || 0} كجم صوف</span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex justify-between items-center">
                      <span className="font-bold text-stone-800 dark:text-stone-200">الوزن الإجمالي للكليم:</span>
                      <span className="font-mono font-black text-base text-amber-700 dark:text-amber-300">
                        {output.totalWeightKg} كجم
                      </span>
                    </div>
                  </div>
                )}

                {output.craftMetrics.craftId === 'punch_needle' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">قماش كانفاه مخرم / دك قطني (+10سم للطارة):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.fabricAreaSqM || output.craftMetrics.monksClothAreaSqM || 0} م² ({output.craftMetrics.fabricCost || output.craftMetrics.monksClothCost || 0} ج)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">أمتار صوف البانش نيدل (بهالك 5%):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.punchYarnLengthMeters || 0} متر ({output.totalWeightKg} كجم)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">غراء اللاتكس السائل لتثبيت الظهر:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.latexGlueKg || 0} كجم ({output.craftMetrics.latexCost || 0} ج)
                      </span>
                    </div>
                  </div>
                )}

                {(output.craftMetrics.craftId === 'tufting_gun' || output.craftMetrics.craftId === 'tufting') && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">قماش التافت الأساسي (+0.20م للفريم):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.primaryClothAreaSqM || 0} م²
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">صوف/أكريليك الوبرة (بهالك نحت 10%):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.tuftingYarnWeightKg || 0} كجم
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex justify-between">
                      <span className="text-stone-600 dark:text-stone-400">غراء اللاتكس السجاد (1.1 كجم/م²):</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {output.craftMetrics.tuftingLatexKg || 0} كجم ({output.craftMetrics.tuftingLatexCost || 0} ج)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Macrame Default Output */
              <>
                {/* 1. Base Strands (With Divider / 2 and Pencil Override) */}
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePencil('strands')}
                      title="تعديل يدوي (تفعيل القلم)"
                      className={`p-1.5 rounded-lg transition ${
                        overrideStrandsActive
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <div className="text-right">
                      <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        عدد الفتلات الأساسية (مضاعفات 4)
                      </p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        يعطي الضعف ({output.workingCordsCount}) خيوطاً شغالة على العصا
                      </p>
                    </div>
                  </div>

                  {overrideStrandsActive ? (
                    <NumberInput
                      value={manualStrands}
                      onChange={(val) => setManualStrands(String(val))}
                      className="w-20 px-2 py-1 text-center rounded-lg border-2 border-amber-500 bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 font-bold text-sm outline-none font-mono"
                    />
                  ) : (
                    <div className="text-left font-mono">
                      <span className="text-lg font-black text-stone-900 dark:text-stone-100">
                        {output.baseStrandsCount}
                      </span>
                      <span className="text-xs text-stone-500 mr-1">فتلة</span>
                    </div>
                  )}
                </div>

                {/* 2. Single Strand Cut Length (With Pencil Override) */}
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePencil('length')}
                      title="تعديل يدوي (تفعيل القلم)"
                      className={`p-1.5 rounded-lg transition ${
                        overrideLengthActive
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <div className="text-right">
                      <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        طول الفتلة الواحدة المقصوصة
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                        بناءً على سمك الخيط ({calculationInput.cordThicknessMm} مم)
                      </p>
                    </div>
                  </div>

                  {overrideLengthActive ? (
                    <NumberInput
                      value={manualLength}
                      onChange={(val) => setManualLength(String(val))}
                      className="w-20 px-2 py-1 text-center rounded-lg border-2 border-amber-500 bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 font-bold text-sm outline-none font-mono"
                    />
                  ) : (
                    <div className="text-left font-mono">
                      <span className="text-lg font-black text-stone-900 dark:text-stone-100">
                        {output.singleStrandLengthCm}
                      </span>
                      <span className="text-xs text-stone-500 mr-1">سم</span>
                    </div>
                  )}
                </div>

                {/* 3. Total Weight in Kilograms (Strictly display in KG) */}
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePencil('weight')}
                      title="تعديل يدوي (تفعيل القلم)"
                      className={`p-1.5 rounded-lg transition ${
                        overrideWeightActive
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <div className="text-right">
                      <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        الوزن الإجمالي بالكيلو جرام
                      </p>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                        يعادل {output.totalWeightGrams} جرام خيط
                      </p>
                    </div>
                  </div>

                  {overrideWeightActive ? (
                    <NumberInput
                      step="0.05"
                      value={manualWeightKg}
                      onChange={(val) => setManualWeightKg(String(val))}
                      className="w-24 px-2 py-1 text-center rounded-lg border-2 border-amber-500 bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 font-bold text-sm outline-none font-mono"
                    />
                  ) : (
                    <div className="text-left font-mono">
                      <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                        {output.totalWeightKg.toFixed(2)}
                      </span>
                      <span className="text-xs text-stone-600 dark:text-stone-400 mr-1 font-bold">
                        كجم
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-stone-500 dark:text-stone-400 px-1 flex items-center justify-between">
                  <span>إجمالي أمتار الخيط:</span>
                  <span className="font-mono font-bold text-stone-700 dark:text-stone-300">
                    {output.totalYarnLengthMeters} متر
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Interactive Cost Breakdown Donut Chart */}
          <CostBreakdownDonutChart
            directMaterialsCost={output.totalDirectMaterialsCost || 0}
            laborWage={output.laborWage || 0}
            profitAmount={output.insulatedProfitAmount || 0}
            indirectCosts={(output.packagingCost || 0) + (output.transitFees || 0) + (output.adminExpensesShare || 0)}
            totalSellingPrice={retailPrice || 0}
            currencySymbol={profile.currencySymbol}
          />

          {/* Insulated Selling Price Breakdown Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <span className="text-xs font-bold text-amber-200">
                منظومة التسعير العادل المعزول
              </span>
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-300" />
                <span>حساب سعر البيع المعزول</span>
              </h3>
            </div>

            {/* Direct Materials Cost */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-amber-100">
                <span>تكلفة الخيط ({output.totalWeightKg.toFixed(2)} كجم):</span>
                <span className="font-mono font-bold text-white">
                  {output.yarnCost} {profile.currencySymbol}
                </span>
              </div>

              {output.extraMaterialsTotalCost > 0 && (
                <div className="flex justify-between items-center text-amber-100">
                  <span>الخامات والملحقات الإضافية:</span>
                  <span className="font-mono font-bold text-white">
                    +{output.extraMaterialsTotalCost} {profile.currencySymbol}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-amber-200/90 pt-1 border-t border-white/10 font-bold">
                <span>إجمالي الخامات المباشرة:</span>
                <span className="font-mono text-amber-200">
                  {output.totalDirectMaterialsCost} {profile.currencySymbol}
                </span>
              </div>
            </div>

            {/* Insulated Profit Highlight */}
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-amber-200">
                  صافي الربح المعزول ({profitMarginPercent}% على الخامات فقط):
                </span>
                <span className="font-mono font-extrabold text-amber-300 text-sm">
                  +{output.insulatedProfitAmount} {profile.currencySymbol}
                </span>
              </div>
              <p className="text-[10px] text-amber-200/70 leading-relaxed">
                * معزول تماماً: لا يتم ضرب نسبة الربح في أجور المصنعية أو التغليف أو المصاريف الإدارية.
              </p>
            </div>

            {/* Other Cost Additions */}
            <div className="space-y-1.5 text-xs text-amber-100/90">
              <div className="flex justify-between items-center">
                <span>أجرة المصنعية لليد العاملة:</span>
                <span className="font-mono font-bold text-white">
                  +{output.laborWage} {profile.currencySymbol}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>التغليف والحماية:</span>
                <span className="font-mono font-bold text-white">
                  +{output.packagingCost} {profile.currencySymbol}
                </span>
              </div>

              {output.transitFees > 0 && (
                <div className="flex justify-between items-center">
                  <span>مصاريف النقل الداخلي:</span>
                  <span className="font-mono font-bold text-white">
                    +{output.transitFees} {profile.currencySymbol}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span>نصيب التكاليف الإدارية للورشة:</span>
                <span className="font-mono font-bold text-white">
                  +{output.adminExpensesShare} {profile.currencySymbol}
                </span>
              </div>
            </div>

            {/* Total Cost of Production */}
            <div className="flex justify-between items-center text-xs text-amber-200/90 pt-1 border-t border-white/10 font-bold">
              <span>إجمالي تكلفة الإنتاج والمصنعية:</span>
              <span className="font-mono text-white">
                {costPrice} {profile.currencySymbol}
              </span>
            </div>

            {/* Final Grand Selling Price (Retail) */}
            <div className="pt-3 border-t border-white/20 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-amber-200 font-bold">سعر البيع المقترح (قطاعي):</span>
                <p className="text-[10px] text-amber-300/80">شامل كافة التكاليف وهوامش الأمان</p>
              </div>
              <div className="text-left font-mono">
                <span className="text-3xl font-black text-white tracking-tight">
                  {retailPrice}
                </span>
                <span className="text-sm font-bold text-amber-200 mr-1.5">
                  {profile.currencySymbol}
                </span>
              </div>
            </div>

            {/* Wholesale Price Box */}
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-emerald-300">سعر البيع بالجملة:</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 font-bold border border-emerald-400/30">
                    خصم {wholesaleMarginDiscountPercent}% من الربح فقط
                  </span>
                </div>
                <p className="text-[10px] text-amber-200/70 mt-0.5">
                  محمي التكاليف بالكامل بدون أي مساس بأجور اليد العاملة
                </p>
              </div>
              <div className="text-left font-mono">
                <span className="text-2xl font-black text-emerald-300">
                  {wholesalePrice}
                </span>
                <span className="text-xs font-bold text-emerald-200 mr-1">
                  {profile.currencySymbol}
                </span>
              </div>
            </div>

            {/* WhatsApp Quote Trigger */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const selectedSection = MAIN_SECTIONS.find((s) => s.id === selectedSectionId);
                  const selectedCraft = SUB_CRAFTS_REGISTRY.find((c) => c.id === selectedCraftId);
                  const record: SavedProductRecord = {
                    id: existingRecordId || `prod_${Date.now()}`,
                    tenantId: profile.tenantId,
                    workshopId: profile.tenantId,
                    productName,
                    productSerialNumber: initialRecord?.productSerialNumber,
                    productCode: initialRecord?.productCode,
                    mainSectionId: selectedSectionId,
                    mainSectionName: selectedSection?.nameAr || selectedSectionId,
                    craftId: selectedCraftId,
                    craftName: selectedCraft?.nameAr || selectedCraftId,
                    productType: category,
                    category,
                    costPrice,
                    retailPrice,
                    wholesalePrice,
                    wholesaleMarginDiscountPercent,
                    input: calculationInput,
                    output,
                    imageUrl: productImageUrl,
                    isActive: true,
                    createdAt: initialRecord?.createdAt || Date.now(),
                    updatedAt: Date.now(),
                  };
                  onOpenWhatsAppShare(record);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>إنشاء عرض سعر واتساب فوري للعميل</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Inputs & 3D Geometry Rules */}
        <div className="lg:col-span-7 space-y-6 order-1 lg:order-2">
          {/* Card: 1. Category & Product Identity */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <span className="text-[11px] font-bold text-stone-500">خطوة 1 من 4</span>
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
                التصنيف وهوية القطعة الفنية
              </h3>
            </div>

            {/* WORKFLOW RULE: Category dropdown MUST appear FIRST strictly BEFORE image upload */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ إضافة تصنيف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManagingCategories(!isManagingCategories)}
                    className="text-xs font-bold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>{isManagingCategories ? 'إغلاق إدارة الأصناف' : 'إدارة الأصناف (تعديل/حذف)'}</span>
                  </button>
                </div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                  التصنيف الفني الأساسي (يحدد مسار الحسابات والشكل) *
                </label>
              </div>

              {isAddingNewCategory && (
                <div className="mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center gap-2 animate-in fade-in">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="اكتب اسم الصنف أو التصنيف الجديد (مثال: منظم أدراج، كلاتش حبال، سبت فاكهة)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategoryItem(newCategoryName);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCategoryItem(newCategoryName)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs cursor-pointer hover:bg-amber-700 transition"
                  >
                    حفظ وإضافة
                  </button>
                </div>
              )}

              {/* Category Management Drawer */}
              {isManagingCategories && (
                <div className="mb-3 p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                    <button
                      type="button"
                      onClick={handleResetCraftCategories}
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>استعادة الأصناف القياسية للورشة</span>
                    </button>
                    <span>أصناف وتصنيفات هذه الورشة (قابلة للتعديل والحذف بالكامل):</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                    {availableProductTypes.map((catItem) => {
                      const isEditing = editingCatOld === catItem;
                      const isSelected = category === catItem;

                      if (isEditing) {
                        return (
                          <div key={catItem} className="flex items-center gap-1 bg-white dark:bg-stone-900 p-1 rounded-xl border border-amber-500 shadow-sm">
                            <input
                              type="text"
                              value={editingCatNew}
                              onChange={(e) => setEditingCatNew(e.target.value)}
                              className="px-2 py-1 text-xs font-bold outline-none rounded bg-transparent w-28"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameCategoryItem(catItem, editingCatNew);
                                if (e.key === 'Escape') setEditingCatOld(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameCategoryItem(catItem, editingCatNew)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer"
                              title="حفظ التعديل"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatOld(null)}
                              className="p-1 text-stone-400 hover:bg-stone-200 rounded cursor-pointer"
                              title="إلغاء"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={catItem}
                          className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                          }`}
                        >
                          <span
                            onClick={() => setCategory(catItem as any)}
                            className="cursor-pointer"
                            title="تحديد هذا الصنف"
                          >
                            {catItem}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatOld(catItem);
                              setEditingCatNew(catItem);
                            }}
                            className={`p-0.5 rounded opacity-60 hover:opacity-100 transition cursor-pointer ${
                              isSelected ? 'text-white hover:bg-amber-700' : 'text-stone-500 hover:text-amber-600'
                            }`}
                            title="تعديل اسم الصنف"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          {availableProductTypes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCategoryItem(catItem)}
                              className={`p-0.5 rounded opacity-60 hover:opacity-100 transition cursor-pointer ${
                                isSelected ? 'text-white hover:bg-amber-700' : 'text-stone-500 hover:text-rose-600'
                              }`}
                              title="حذف هذا الصنف من الورشة"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {availableProductTypes.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                اسم الموديل / القطعة *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="اكتب اسم القطعة الفنية"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Image Upload Box - Placed strictly AFTER Category */}
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-dashed border-stone-300 dark:border-stone-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {productImageUrl ? (
                  <img
                    src={productImageUrl}
                    alt="صورة القطعة"
                    className="w-14 h-14 rounded-xl object-cover border border-amber-500 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-amber-100/70 dark:bg-amber-950/40 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    صورة المنتج الحرفي
                  </p>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400">
                    يمكن إرفاق صورة التصميم للتوثيق والتحليل
                  </p>
                </div>
              </div>
              <label className="cursor-pointer px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 transition">
                <span>تحديد صورة</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* Card: 2. 3D Geometry Overrides & Dimensions */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <span className="text-[11px] font-bold text-stone-500">خطوة 2 من 4</span>
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
                الأبعاد الهندسية والتشكيل الحرفي
              </h3>
            </div>

            {selectedCraftId === 'zigzag' ? (
              <div className="space-y-4">
                {/* 1. طبيعة المشغولة */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                    طبيعة المشغولة ومسار التشغيل *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setZigzagPieceType('flat');
                        setSideHeightCm(0);
                      }}
                      className={`p-3 rounded-2xl border text-right transition cursor-pointer ${
                        zigzagPieceType === 'flat'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                      }`}
                    >
                      <p className="text-xs font-black">مشغولة مسطحة (Flat)</p>
                      <p className={`text-[10px] mt-0.5 ${zigzagPieceType === 'flat' ? 'text-amber-100' : 'text-stone-500'}`}>
                        مفرش، كوستر، سجادة، صينية بدون حواف (الجدران = 0)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setZigzagPieceType('3d');
                        if (!sideHeightCm || sideHeightCm <= 0) setSideHeightCm(12);
                      }}
                      className={`p-3 rounded-2xl border text-right transition cursor-pointer ${
                        zigzagPieceType === '3d'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                      }`}
                    >
                      <p className="text-xs font-black">مشغولة مجسمة 3D</p>
                      <p className={`text-[10px] mt-0.5 ${zigzagPieceType === '3d' ? 'text-amber-100' : 'text-stone-500'}`}>
                        سلة، منظم، شنطة، بوكس (ارتفاع الأجناب إجباري)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setZigzagPieceType('clutch');
                        setSideHeightCm(0);
                        setZigzagHasLining(true);
                        setZigzagHasZipper(true);
                        setZigzagHasHandles(true);
                      }}
                      className={`p-3 rounded-2xl border text-right transition cursor-pointer ${
                        zigzagPieceType === 'clutch'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                      }`}
                    >
                      <p className="text-xs font-black">كلاتش / محفظة مسطحة</p>
                      <p className={`text-[10px] mt-0.5 ${zigzagPieceType === 'clutch' ? 'text-amber-100' : 'text-stone-500'}`}>
                        مسطحة وتدخل البطانة والسوستة والأيدي مباشرة في التكلفة
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. شكل القاعدة والهندسة */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                    شكل القاعدة والهندسة الفيزيائية *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setZigzagBaseShape('circle')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        zigzagBaseShape === 'circle'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                      }`}
                    >
                      دائرية ⭕
                    </button>

                    <button
                      type="button"
                      onClick={() => setZigzagBaseShape('oval')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        zigzagBaseShape === 'oval'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                      }`}
                    >
                      بيضاوية (رامانوجان) 🥚
                    </button>

                    <button
                      type="button"
                      onClick={() => setZigzagBaseShape('rectangle')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        zigzagBaseShape === 'rectangle'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                      }`}
                    >
                      مستطيلة / مربعة 🔲
                    </button>
                  </div>
                </div>

                {/* 3. مدخلات الأبعاد */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {zigzagBaseShape === 'circle' ? (
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                        قطر القاعدة (سم) *
                      </label>
                      <NumberInput
                        value={diameterCm}
                        onChange={(v) => {
                          setDiameterCm(v);
                          setBaseDiameterCm(v);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                          طول القاعدة (سم) *
                        </label>
                        <NumberInput
                          value={totalLengthCm}
                          onChange={setTotalLengthCm}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                          عرض القاعدة (سم) *
                        </label>
                        <NumberInput
                          value={widthCm}
                          onChange={setWidthCm}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                        />
                      </div>
                    </>
                  )}

                  {zigzagPieceType === '3d' ? (
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                        ارتفاع الأجناب/الجدران (سم) *
                      </label>
                      <NumberInput
                        value={sideHeightCm}
                        onChange={setSideHeightCm}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center sm:col-span-1">
                      <div className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium leading-relaxed">
                        ✓ مشغولة مسطحة: مساحة الجدران = 0 سم²، ويتم حساب الحبل بالكامل لتغطية مساحة القاعدة.
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. كارت الحسابات الفيزيائية اللحظية */}
                {output.craftMetrics?.craftId === 'zigzag' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs space-y-1.5 text-stone-800 dark:text-stone-200">
                    <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                      <span>مساحة سطح القاعدة ({zigzagBaseShape === 'oval' ? 'بيضاوية' : zigzagBaseShape === 'circle' ? 'دائرية' : 'مستطيلة'}):</span>
                      <span className="font-mono">{output.craftMetrics.baseAreaCm2 || 0} سم²</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                      <span>محيط القاعدة {zigzagBaseShape === 'oval' ? '(معادلة رامانوجان الدقيقة)': ''}:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.perimeterCm || 0} سم</span>
                    </div>
                    {zigzagPieceType === '3d' && (
                      <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400">
                        <span>مساحة الجدران الرأسية (المحيط × الارتفاع):</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{output.craftMetrics.wallAreaCm2 || 0} سم²</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-amber-300 dark:border-amber-800 font-black text-amber-950 dark:text-amber-100">
                      <span>إجمالي المساحة السطحية للمشغولة:</span>
                      <span className="font-mono text-sm">{output.craftMetrics.totalSurfaceAreaCm2 || 0} سم²</span>
                    </div>
                  </div>
                )}
              </div>
            ) : is3D ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white">
                    نظام المجسمات ثلاثية الأبعاد (3D Activated)
                  </span>
                  <label className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    شكل المجسم *
                  </label>
                </div>

                <select
                  value={shape3D}
                  onChange={(e) => setShape3D(e.target.value as Shape3DType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="cylinder">شغل اسطواني (القاعدة والأجناب)</option>
                  <option value="circle">شغل دائري (المحيط فقط)</option>
                  <option value="square">مربع (أربعة جوانب متساوية)</option>
                  <option value="rectangle">مستطيل (محيط الصندوق)</option>
                </select>

                {/* Specific 3D Inputs: Cylinder (Hide flat entries, request Base Diameter & Side Height) */}
                {shape3D === 'cylinder' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                          قطر القاعدة (سم) *
                        </label>
                        <NumberInput
                          value={baseDiameterCm}
                          onChange={setBaseDiameterCm}
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                          ارتفاع الأجناب (سم) *
                        </label>
                        <NumberInput
                          value={sideHeightCm}
                          onChange={setSideHeightCm}
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none"
                        />
                      </div>
                    </div>

                    {/* Mathematical Plane Calculations */}
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-medium space-y-1.5 text-stone-800 dark:text-stone-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-800 dark:text-amber-300">مساحة دائرة القاعدة (Base Circle Area):</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                          {((baseDiameterCm / 2) ** 2 * 3.14).toFixed(1)} سم²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span>معادلة الحساب:</span>
                        <span className="font-mono">({(baseDiameterCm / 2).toFixed(1)}² × 3.14)</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
                        <span className="font-bold text-amber-800 dark:text-amber-300">محيط الأجناب الرأسي (Sides Vertical Perimeter):</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                          {(baseDiameterCm * 3.14).toFixed(1)} سم
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span>معادلة الحساب:</span>
                        <span className="font-mono">({baseDiameterCm} × 3.14)</span>
                      </div>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 pt-1">
                        * تم حجب المدخلات المسطحة تلقائياً لتوافق هندسة المجسم الاسطواني، وتتدرج أطوال وعدد الفتلات لتغطية السطحين (القاعدة والأجناب) بتناغم وانسيابية كاملة.
                      </p>
                    </div>
                  </div>
                )}

                {shape3D === 'circle' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      القطر (سم) *
                    </label>
                    <NumberInput
                      value={diameterCm}
                      onChange={setDiameterCm}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none"
                    />
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">
                      المحيط المحسوب: {diameterCm} * 3.14 = {(diameterCm * 3.14).toFixed(1)} سم
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Flat Width Input - hidden if 3D category */
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  عرض الشغل المسطح (سم) *
                </label>
                <NumberInput
                  value={widthCm}
                  onChange={setWidthCm}
                  placeholder="مثال: 60"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
                {(!widthCm || widthCm <= 0) && (
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>يرجى كتابة أبعاد المشغولة لحساب وزن الخيط</span>
                  </p>
                )}
              </div>
            )}

            {/* Length Constraints: Hidden if cylinder or zigzag, because cylinder uses Side Height and zigzag has its own dimensions */}
            {shape3D !== 'cylinder' && selectedCraftId !== 'zigzag' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    طول الشغل الكلي (سم) *
                  </label>
                  <NumberInput
                    value={totalLengthCm}
                    onChange={setTotalLengthCm}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    طول الشراشيب (سم) *
                  </label>
                  <NumberInput
                    value={fringeLengthCm}
                    onChange={setFringeLengthCm}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            ) : selectedCraftId !== 'zigzag' ? (
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  طول الشراشيب السفلية إن وجدت (سم) (اختياري)
                </label>
                <NumberInput
                  value={fringeLengthCm}
                  onChange={setFringeLengthCm}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            ) : null}
          </div>

          {/* Card: 2.1 Specialized Craft Parameters for the 5 New Textile Workshops */}
          {selectedCraftId === 'crochet' && (
            <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <h3 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  <span>🧶</span>
                  <span>مواصفات المشغولة</span>
                </h3>
                {stitchToast && (
                  <div className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm animate-fade-in flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{stitchToast}</span>
                  </div>
                )}
              </div>

              {/* 3D Depth Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    عمق / عرض الجانب (سم)
                  </label>
                  <NumberInput
                    value={crochetDepthCm}
                    onChange={setCrochetDepthCm}
                    placeholder="مثال: 10 للشنط والعلب المجسمة، 0 للمسطح"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">
                    يُستخدم لحساب استهلاك أجناب المشغولات ثلاثية الأبعاد (شنط، بوكسات).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    ارتفاع جدار المشغولة (سم)
                  </label>
                  <NumberInput
                    value={sideHeightCm}
                    onChange={setSideHeightCm}
                    placeholder="ارتفاع جوانب الشنطة أو البوكس"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">
                    ارتفاع الأجناب الرأسية للمشغولة.
                  </p>
                </div>
              </div>

              {/* Solid Base Checkbox */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800/80 border border-amber-500/20">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasSolidBase}
                    onChange={(e) => setHasSolidBase(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 dark:border-stone-600 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      المشغولة تحتوي على قاعدة صلبة (خشب / جلد)
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block">
                      في حال عدم التحديد، يتم احتساب كامل المشغولة وقاعدتها كنسيج خيط متصل
                    </span>
                  </div>
                </label>

                {hasSolidBase && (
                  <div className="mt-4 pt-3 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                        نوع القاعدة الصلبة *
                      </label>
                      <select
                        value={crochetBaseType === 'yarn' ? 'wooden' : crochetBaseType}
                        onChange={(e) => setCrochetBaseType(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="wooden">قاعدة خشبية مثقوبة ليزر</option>
                        <option value="leather">قاعدة جلد طبيعي مثقوبة</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                        تكلفة القاعدة الصلبة ({profile.currencySymbol}) *
                      </label>
                      <NumberInput
                        value={crochetWoodenBaseCost}
                        onChange={setCrochetWoodenBaseCost}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                        عدد ثقوب القاعدة
                      </label>
                      <NumberInput
                        value={crochetBaseHolesCount}
                        onChange={setCrochetBaseHolesCount}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                        معدل تزايد السطر الأول
                      </label>
                      <select
                        value={crochetBaseIncreasesRate}
                        onChange={(e) => setCrochetBaseIncreasesRate(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none"
                      >
                        <option value={1}>غرزة واحدة (1x)</option>
                        <option value={1.5}>غرزة ونصف بالتناوب (1x/2x)</option>
                        <option value={2}>غرزتين في كل ثقب (2x)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Multi-Stitch Selector with % Logic */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800/80 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-stone-900 dark:text-stone-100">
                      توزيع أنواع الغرز في المشغولة (نسبة مئوية %)
                    </label>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">
                      تطبيق معامل سحب الخيط لكل غرزة لحساب الوزن بدقة هندسية
                    </span>
                  </div>
                  {(() => {
                    const total = crochetStitchDistributions.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
                    return (
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                          total === 100
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : total > 100
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        المجموع: {total}%
                      </span>
                    );
                  })()}
                </div>

                <div className="space-y-2.5">
                  {crochetStitchDistributions.map((stitchItem, idx) => {
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={stitchItem.stitchType}
                          onChange={(e) => {
                            const next = [...crochetStitchDistributions];
                            next[idx] = { ...next[idx], stitchType: e.target.value as any };
                            setCrochetStitchDistributions(next);
                          }}
                          className="flex-1 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="sc">غرزة حشو (معامل 1.0)</option>
                          <option value="slst">غرزة منزلقة (معامل 0.6)</option>
                          <option value="hdc">نصف عمود (معامل 1.25)</option>
                          <option value="dc">عمود بلفة (معامل 1.5)</option>
                          <option value="tr">عمود بلفتين (معامل 1.85)</option>
                          <option value="puff">غرز منتفخة / باف / بوبل / ياسمين (معامل 2.5)</option>
                        </select>

                        <div className="w-28 relative">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={stitchItem.percentage}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const next = [...crochetStitchDistributions];
                              next[idx] = { ...next[idx], percentage: val };
                              setCrochetStitchDistributions(next);
                              const total = next.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
                              if (total === 100) {
                                setStitchToast('تم اكتمال 100% من توزيع غرز المشغولة بنجاح ✨');
                                setTimeout(() => setStitchToast(''), 2500);
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-mono font-bold text-center outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="absolute left-2.5 top-2 text-xs text-stone-400 font-bold pointer-events-none">
                            %
                          </span>
                        </div>

                        {crochetStitchDistributions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = crochetStitchDistributions.filter((_, i) => i !== idx);
                              setCrochetStitchDistributions(next);
                            }}
                            className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                            title="حذف الغرزة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const total = crochetStitchDistributions.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
                  if (total < 100) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const currentTotal = crochetStitchDistributions.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
                          const remaining = Math.max(0, 100 - currentTotal);
                          if (remaining <= 0) return;
                          const used = crochetStitchDistributions.map((d) => d.stitchType);
                          const candidates: Array<'sc' | 'slst' | 'hdc' | 'dc' | 'tr' | 'puff'> = ['dc', 'hdc', 'tr', 'puff', 'slst', 'sc'];
                          const nextStitch = candidates.find((c) => !used.includes(c)) || 'dc';
                          const next = [...crochetStitchDistributions, { stitchType: nextStitch, percentage: remaining }];
                          setCrochetStitchDistributions(next);
                          const newTotal = next.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
                          if (newTotal === 100) {
                            setStitchToast('تم اكتمال 100% من توزيع غرز المشغولة بنجاح ✨');
                            setTimeout(() => setStitchToast(''), 2500);
                          }
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-500/50 hover:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>إضافة غرزة أخرى (المتبقي: {100 - total}%)</span>
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          {selectedCraftId === 'zigzag' && (
            <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  {zigzagPieceType === 'clutch' ? 'كلاتش حبال ومحفظة' : zigzagPieceType === 'flat' ? 'مشغولة مسطحة' : 'مشغولة مجسمة 3D'}
                </span>
                <h3 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  <span>🧵</span>
                  <span>مواصفات حبال الزجزاج والخامات التكميلية</span>
                </h3>
              </div>

              {/* 1. نوع الحبل والقطر */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    نوع حبل الزجزاج الدارج *
                  </label>
                  <select
                    value={zigzagRopeType}
                    onChange={(e) => {
                      const val = e.target.value as 'cotton_padded' | 'polyester';
                      setZigzagRopeType(val);
                      if (val === 'cotton_padded' && pricePerKg === 140) setPricePerKg(165);
                      if (val === 'polyester' && pricePerKg === 165) setPricePerKg(140);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="cotton_padded">حبل قطن زجزاج محشي (الدارج والأكثر متانة)</option>
                    <option value="polyester">حبل زجزاج بوليستر (خفيف وناعم)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    قطر حبل الزجزاج (مم) *
                  </label>
                  <select
                    value={zigzagRopeDiameterMm}
                    onChange={(e) => setZigzagRopeDiameterMm(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={5}>5 مم (حبل رفيع مرن جداً)</option>
                    <option value={6}>6 مم (حبل رفيع للمفارش والكلاتشات)</option>
                    <option value={8}>8 مم (المعيار القياسي للباسكت والصواني)</option>
                    <option value={10}>10 مم (حبل سميك متين للمنظمات)</option>
                    <option value={12}>12 مم (شغل جامبو كبير وسلال غسيل)</option>
                  </select>
                </div>
              </div>

              {/* 2. أيادي الحبال */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    عدد أيادي الحبال
                  </label>
                  <select
                    value={zigzagHandlesCount}
                    onChange={(e) => setZigzagHandlesCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={0}>بدون أيدي حبال</option>
                    <option value={1}>يد واحدة (علاقة أو يد كلاتش)</option>
                    <option value={2}>يدين جانبيتين (باسكت ومنظم)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    طول اليد الواحدة (سم)
                  </label>
                  <NumberInput
                    value={zigzagHandleLengthCm}
                    onChange={setZigzagHandleLengthCm}
                    disabled={zigzagHandlesCount === 0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 3. الخامات التكميلية (بطانة، سوست، إكسسوارات) */}
              <div className="pt-2 border-t border-amber-500/20 space-y-3">
                <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  الخامات التكميلية والإكسسوارات المباشرة:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Lining */}
                  <div className={`p-3 rounded-2xl border transition ${zigzagHasLining ? 'bg-white dark:bg-stone-900 border-amber-500/50 shadow-xs' : 'bg-stone-50/50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700'}`}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={zigzagHasLining}
                        onChange={(e) => setZigzagHasLining(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">قماش بطانة ستان/سالسا/دك</span>
                    </label>
                    {zigzagHasLining && (
                      <div>
                        <span className="text-[10px] text-stone-500 block mb-1">تكلفة قماش البطانة ({profile.currencySymbol})</span>
                        <NumberInput
                          value={zigzagLiningCost}
                          onChange={setZigzagLiningCost}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Zipper */}
                  <div className={`p-3 rounded-2xl border transition ${zigzagHasZipper ? 'bg-white dark:bg-stone-900 border-amber-500/50 shadow-xs' : 'bg-stone-50/50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700'}`}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={zigzagHasZipper}
                        onChange={(e) => setZigzagHasZipper(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">سوستة وجرار عضم</span>
                    </label>
                    {zigzagHasZipper && (
                      <div>
                        <span className="text-[10px] text-stone-500 block mb-1">تكلفة السوستة والجرار ({profile.currencySymbol})</span>
                        <NumberInput
                          value={zigzagZipperCost}
                          onChange={setZigzagZipperCost}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Handles / Hardware */}
                  <div className={`p-3 rounded-2xl border transition ${zigzagHasHandles ? 'bg-white dark:bg-stone-900 border-amber-500/50 shadow-xs' : 'bg-stone-50/50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700'}`}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={zigzagHasHandles}
                        onChange={(e) => setZigzagHasHandles(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">أيدي جلد وحلقات ميتاليك</span>
                    </label>
                    {zigzagHasHandles && (
                      <div>
                        <span className="text-[10px] text-stone-500 block mb-1">تكلفة الجلد والحلقات ({profile.currencySymbol})</span>
                        <NumberInput
                          value={zigzagAccessoriesCost}
                          onChange={setZigzagAccessoriesCost}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                * يتم آلياً حساب استهلاك خيط المكوك والخياطة بمعدل 3.6 أمتار خيط لكل متر حبل زجزاج.
              </p>
            </div>
          )}

          {(selectedCraftId === 'kilim' || selectedCraftId === 'kelim') && (
            <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <h3 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  <span>🪡</span>
                  <span>مواصفات المشغولة</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    كثافة السداء (خيط لكل سم) *
                  </label>
                  <select
                    value={kilimEpiDensity}
                    onChange={(e) => setKilimEpiDensity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none"
                  >
                    <option value={3}>3 خيوط/سم (كليم ريفي خشن)</option>
                    <option value={4}>4 خيوط/سم (كليم قياسي متوازن)</option>
                    <option value={5}>5 خيوط/سم (نسيج ناعم دقيق)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    فاقد ربط النول (سم)
                  </label>
                  <NumberInput
                    value={kilimLoomWasteCm}
                    onChange={setKilimLoomWasteCm}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    صوف اللحمة (كجم / م²)
                  </label>
                  <NumberInput
                    step="0.1"
                    value={kilimWeftWoolKgPerSqM}
                    onChange={setKilimWeftWoolKgPerSqM}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedCraftId === 'punch_needle' && (
            <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <h3 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  <span>🎨</span>
                  <span>مواصفات قماش وتطريز البانش نيدل</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    نوع قماش التطريز المصري *
                  </label>
                  <select
                    value={punchFabricType}
                    onChange={(e) => {
                      const val = e.target.value as 'cotton_canvas' | 'duck_fabric' | 'linen';
                      setPunchFabricType(val);
                      const p = val === 'duck_fabric' ? 110 : val === 'linen' ? 160 : 130;
                      setPunchFabricCost(p);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="cotton_canvas">قماش كانفاه مخرم عالي الجودة (130 ج.م/م²)</option>
                    <option value="duck_fabric">قماش دك قطن مصري متين (110 ج.م/م²)</option>
                    <option value="linen">قماش كتان مخصص للتطريز (160 ج.م/م²)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    سعر متر قماش التطريز ({profile.currencySymbol}/م²)
                  </label>
                  <NumberInput
                    value={punchFabricCost}
                    onChange={setPunchFabricCost}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    هامش شد الطارة (سم) *
                  </label>
                  <NumberInput
                    value={punchMonksClothMarginCm}
                    onChange={setPunchMonksClothMarginCm}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    ارتفاع غرزة الصوف (مم)
                  </label>
                  <select
                    value={punchLoopHeightMm}
                    onChange={(e) => setPunchLoopHeightMm(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none"
                  >
                    <option value={3}>3 مم (غرزة مسطحة ناعمة)</option>
                    <option value={5}>5 مم (غرزة قياسية)</option>
                    <option value={8}>8 مم (غرزة بارزة)</option>
                    <option value={12}>12 مم (غرزة طويلة منفوشة)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {(selectedCraftId === 'tufting_gun' || selectedCraftId === 'tufting') && (
            <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <h3 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  <span>🔫</span>
                  <span>مواصفات المشغولة</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    نوع الوبرة (Pile Type) *
                  </label>
                  <select
                    value={tuftingPileType}
                    onChange={(e) => setTuftingPileType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none"
                  >
                    <option value="cut">وبرة مقصوصة (Cut Pile - 2.1 كجم/م²)</option>
                    <option value="loop">وبرة ملفوفة (Loop Pile - 1.8 كجم/م²)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    هامش قماش التافت للفريم (متر)
                  </label>
                  <NumberInput
                    step="0.05"
                    value={tuftingPrimaryClothMarginM}
                    onChange={setTuftingPrimaryClothMarginM}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    استهلاك غراء اللاتكس (كجم/م²)
                  </label>
                  <NumberInput
                    step="0.1"
                    value={tuftingLatexGlueKgPerSqM}
                    onChange={setTuftingLatexGlueKgPerSqM}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Card: 3. Cord Specification & Live Raw Materials Feeding */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <span className="text-[11px] font-bold text-stone-500">خطوة 3 من 4</span>
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
                مواصفات الخيط وتكاليف الخامات
              </h3>
            </div>

            {/* Primary Material Selection with Search */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    الخامة الأساسية (الخيوط والحبال وكافة الخامات الرئيسية) *
                  </label>
                  <button
                    type="button"
                    onClick={onOpenNewMaterialModal}
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>إضافة خامة رئيسية جديدة</span>
                  </button>
                </div>

                <div className="relative" ref={primaryDropdownRef}>
                  {/* Trigger Button displaying current selection */}
                  <div
                    onClick={() => {
                      setIsPrimaryDropdownOpen((prev) => !prev);
                      if (!isPrimaryDropdownOpen) setPrimarySearchQuery('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold flex items-center justify-between cursor-pointer hover:border-amber-500 transition shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ChevronDown
                        className={`w-4 h-4 text-stone-400 transition-transform ${
                          isPrimaryDropdownOpen ? 'rotate-180 text-amber-600' : ''
                        }`}
                      />
                      <span className="truncate">
                        {basicMaterials.find((m) => m.id === cordTypeId || m.materialName === cordTypeId)?.materialName ||
                          'اختر الخامة الأساسية...'}
                      </span>
                    </div>
                    {(() => {
                      const sel = basicMaterials.find((m) => m.id === cordTypeId || m.materialName === cordTypeId);
                      return sel ? (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold shrink-0">
                          {sel.costPerUnit} {profile.currencySymbol} / {sel.unit}
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {/* Dropdown Popover with Search Box Inside */}
                  {isPrimaryDropdownOpen && (
                    <div className="absolute z-50 mt-1.5 w-full rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-2xl p-2 space-y-2 animate-in fade-in duration-150">
                      {/* Search box inside the dropdown list */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={primarySearchQuery}
                          onChange={(e) => setPrimarySearchQuery(e.target.value)}
                          placeholder="ابحث في الخامات الأساسية بالاسم أو التصنيف..."
                          className="w-full pr-9 pl-8 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:border-amber-500"
                          autoFocus
                        />
                        {primarySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setPrimarySearchQuery('')}
                            className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-600 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dynamic List */}
                      <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                        {filteredPrimaryMaterials.length === 0 ? (
                          <div className="p-3 text-center text-xs text-stone-400">
                            لا توجد خامات أساسية مطابقة لبحثك
                          </div>
                        ) : (
                          filteredPrimaryMaterials.map((mat, idx) => {
                            const isSelected = mat.id === cordTypeId || mat.materialName === cordTypeId;
                            return (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() => {
                                  handleCordTypeChange(mat.id);
                                  setPrimarySearchQuery('');
                                  setIsPrimaryDropdownOpen(false);
                                }}
                                className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                                    : 'hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-[10px] text-stone-400 font-mono">#{idx + 1}</span>
                                  <span className="font-bold truncate">{stripParentheses(mat.materialName)}</span>
                                </div>
                                <span
                                  className={`text-[10px] font-mono shrink-0 mr-2 ${
                                    isSelected ? 'text-amber-100' : 'text-stone-400'
                                  }`}
                                >
                                  {mat.costPerUnit} {profile.currencySymbol} / {mat.unit}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  سعر الكيلو الافتراضي ({profile.currencySymbol}) *
                </label>
                <NumberInput
                  value={pricePerKg}
                  onChange={setPricePerKg}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-stone-400 block mt-1">
                  * يؤخذ من الخامة المختارة ويمكن تعديله لهذا المنتج فقط
                </span>
              </div>
            </div>

            {/* Thickness */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                سمك الخيط (ملليمتر) *
              </label>
              <div className="flex items-center gap-2">
                {[3, 4, 5, 6].map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setCordThicknessMm(th)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono transition ${
                      cordThicknessMm === th
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    {th} مم
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional Material Costing by Category */}
            {(category === 'ستائر' || category === 'سجاد') && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                  تكلفة ماسورة خشب أو إكسسوارات الستارة / السجادة ({profile.currencySymbol})
                </label>
                <NumberInput
                  value={curtainRodCost}
                  onChange={setCurtainRodCost}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-sm font-bold outline-none"
                />
              </div>
            )}

            {category === 'كوشن' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                    تكلفة كوفر القماش ({profile.currencySymbol})
                  </label>
                  <NumberInput
                    value={cushionCoverCost}
                    onChange={setCushionCoverCost}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                    تكلفة الفايبر ({profile.currencySymbol})
                  </label>
                  <NumberInput
                    value={fiberCost}
                    onChange={setFiberCost}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-sm font-bold outline-none"
                  />
                </div>
              </div>
            )}

            {category === 'شنطة أو كلاتش' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                  تكلفة الإكسسوارات (حلقات، سوستة، بطانة، حزام، قفل) ({profile.currencySymbol})
                </label>
                <NumberInput
                  value={bagAccessoriesCost}
                  onChange={setBagAccessoriesCost}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-sm font-bold outline-none"
                />
              </div>
            )}

            {/* Dynamic Material Rows (+ خامات إضافية) with adjacent shortcut button "إضافة خامة جديدة" */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddMaterialRow()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300/40 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ خامات إضافية</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenNewMaterialModal}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/40 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>إضافة خامة جديدة بالمخزن</span>
                  </button>
                </div>

                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  خامات إضافية مستهلكة بالقطعة (تختار من خامات المخزن أو بند حر)
                </label>
              </div>

              {extraMaterials.map((row) => (
                <div
                  key={row.id}
                  className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 flex flex-wrap items-center gap-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterialRow(row.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                    title="حذف هذا الصف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Dynamic Searchable Dropdown for Extra Materials */}
                  <div className="relative w-full sm:w-52 shrink-0" data-extra-dropdown="true">
                    <button
                      type="button"
                      onClick={() => {
                        if (openExtraDropdownRowId === row.id) {
                          setOpenExtraDropdownRowId(null);
                        } else {
                          setOpenExtraDropdownRowId(row.id);
                          setExtraDropdownSearch('');
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-bold flex items-center justify-between cursor-pointer hover:border-amber-500 transition shadow-xs text-right"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform ${
                            openExtraDropdownRowId === row.id ? 'rotate-180 text-amber-600' : ''
                          }`}
                        />
                        <span className="truncate">
                          {row.materialDbId
                            ? extraMaterialsList.find((m) => m.id === row.materialDbId)?.materialName || row.name || 'خامة مختارة'
                            : '✏️ بند حر (إدخال يدوي)'}
                        </span>
                      </div>
                      {row.materialDbId && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold shrink-0">
                          {extraMaterialsList.find((m) => m.id === row.materialDbId)?.costPerUnit || row.unitPrice} {profile.currencySymbol}
                        </span>
                      )}
                    </button>

                    {/* Popover with search box inside */}
                    {openExtraDropdownRowId === row.id && (
                      <div className="absolute z-50 mt-1 right-0 w-64 sm:w-72 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-2xl p-2 space-y-2 animate-in fade-in duration-150">
                        {/* Search input inside dropdown */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2 pointer-events-none" />
                          <input
                            type="text"
                            value={extraDropdownSearch}
                            onChange={(e) => setExtraDropdownSearch(e.target.value)}
                            placeholder="ابحث في الخامات الإضافية..."
                            className="w-full pr-8 pl-7 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:border-amber-500"
                            autoFocus
                          />
                          {extraDropdownSearch && (
                            <button
                              type="button"
                              onClick={() => setExtraDropdownSearch('')}
                              className="absolute left-2 top-2 text-stone-400 hover:text-stone-600 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* List items */}
                        <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
                          {/* Manual Custom Option */}
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateMaterialRowMulti(row.id, {
                                materialDbId: '',
                              });
                              setOpenExtraDropdownRowId(null);
                            }}
                            className={`w-full text-right px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                              !row.materialDbId
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-bold'
                                : 'hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
                            }`}
                          >
                            <span className="font-bold">✏️ بند حر (إدخال يدوي)</span>
                            <span className="text-[10px] text-stone-400">مخصص</span>
                          </button>

                          {filteredExtraMaterials.length === 0 ? (
                            <div className="p-2 text-center text-xs text-stone-400">
                              لا توجد خامات إضافية مطابقة للبحث
                            </div>
                          ) : (
                            filteredExtraMaterials.map((m) => {
                              const isSelected = row.materialDbId === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    handleUpdateMaterialRowMulti(row.id, {
                                      materialDbId: m.id,
                                      name: m.materialName,
                                      unit: m.unit || 'قطعة',
                                      unitPrice: m.costPerUnit || 0,
                                      quantity: row.quantity || 1,
                                    });
                                    setOpenExtraDropdownRowId(null);
                                  }}
                                  className={`w-full text-right px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                                      : 'hover:bg-amber-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
                                  }`}
                                >
                                  <span className="truncate font-medium">{stripParentheses(m.materialName)}</span>
                                  <span
                                    className={`text-[10px] font-mono shrink-0 mr-2 ${
                                      isSelected ? 'text-amber-100' : 'text-stone-400'
                                    }`}
                                  >
                                    {m.costPerUnit} {profile.currencySymbol} / {m.unit || 'قطعة'}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => handleUpdateMaterialRow(row.id, 'name', e.target.value)}
                    placeholder="اسم الخامة (مثال: خرز، جلد، شاسيه...)"
                    className="flex-1 min-w-[120px] px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-medium outline-none"
                  />

                  <div className="flex items-center gap-1">
                    <NumberInput
                      value={row.quantity}
                      onChange={(val) => handleUpdateMaterialRow(row.id, 'quantity', val)}
                      placeholder="الكمية"
                      className="w-16 px-2 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold font-mono outline-none text-center"
                    />
                    <select
                      value={row.unit}
                      onChange={(e) => handleUpdateMaterialRow(row.id, 'unit', e.target.value)}
                      className="text-xs font-bold px-1.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 outline-none"
                    >
                      {FOUNDATIONAL_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-stone-500">سعر:</span>
                    <NumberInput
                      value={row.unitPrice}
                      onChange={(val) => handleUpdateMaterialRow(row.id, 'unitPrice', val)}
                      placeholder="السعر"
                      className="w-16 px-2 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold font-mono outline-none text-center"
                    />
                  </div>

                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono ml-auto">
                    = {row.totalCost} {profile.currencySymbol}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card: 4. Labor, HR Assignment, Overheads & Margin Slider */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <span className="text-[11px] font-bold text-stone-500">خطوة 4 من 4</span>
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
                أجرة اليد، إسناد الفنان، والتكاليف
              </h3>
            </div>

            {/* Profit Margin Slider (Up to 500%) */}
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-stone-800/60 border border-amber-200 dark:border-stone-700 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="font-mono text-base text-amber-600 dark:text-amber-400">
                  {profitMarginPercent}%
                </span>
                <span className="text-stone-800 dark:text-stone-200">
                  نسبة هامش الربح المعزول (0% إلى 500%)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="5"
                value={profitMarginPercent}
                onChange={(e) => setProfitMarginPercent(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>0% (تكلفة فقط)</span>
                <span>100% (ضعف الخامات)</span>
                <span>250%</span>
                <span>500% (أعلى تصدير)</span>
              </div>
            </div>

            {/* Labor Wage & Employee Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  أجرة المصنعية لليد ({profile.currencySymbol}) *
                </label>
                <NumberInput
                  value={laborWage}
                  onChange={setLaborWage}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  إسناد القطعة لفنان / موظف بالورشة
                </label>
                <select
                  value={assignedEmployeeId}
                  onChange={(e) => setAssignedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                >
                  <option value="">-- اختياري (بدون إسناد) --</option>
                  {dbEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.tier} - {emp.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تكلفة التغليف ({profile.currencySymbol}) *
                </label>
                <NumberInput
                  value={packagingCost}
                  onChange={setPackagingCost}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  مصاريف النقل الداخلي ({profile.currencySymbol})
                </label>
                <NumberInput
                  value={transitFees}
                  onChange={setTransitFees}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  نصيب القطعة من التكاليف الإدارية الموحدة ({profile.currencySymbol})
                </label>
                <NumberInput
                  value={adminExpensesShare}
                  onChange={setAdminExpensesShare}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-bold font-mono outline-none"
                />
              </div>
            </div>

            {/* Wide Notes Box: "ملاحظات شخصية" */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                ملاحظات شخصية (أسرار الصنعة، تفاصيل التنفيذ، توصيات صقر الشمساوية AI)
              </label>
              <textarea
                rows={4}
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                placeholder="سجل هنا أي تفاصيل خاصة بدرجة شد الخيط، لون الصبغة، متطلبات العميل، أو ملاحظات نقلها الذكاء الاصطناعي..."
                className="w-full p-3.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-stone-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Validation & Safety Warning Banner */}
      {validationWarning && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-3 animate-fade-in shadow-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{validationWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationWarning('')}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs font-bold px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 cursor-pointer"
          >
            إغلاق ✕
          </button>
        </div>
      )}

      {/* CORE FUNCTIONAL ACTIONS DIRECTLY AT THE BOTTOM VIEW */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
        <div>
          <h4 className="text-sm font-black text-stone-900 dark:text-stone-100">
            تأكيد واعتماد بطاقة تسعير المنتج
          </h4>
          <p className="text-xs text-stone-500">
            حفظ الحسابات في الأرشيف أو تحديث السجل المفتوح أو تصدير عرض سعر رسمي PDF أو عبر واتساب
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {existingRecordId ? (
            <button
              type="button"
              disabled={isSavingProduct}
              onClick={handleSaveProduct}
              className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSavingProduct ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSavingProduct ? 'جاري الحفظ...' : tr('calc_save_changes_btn')}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isSavingProduct}
              onClick={handleSaveProduct}
              className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-600/20 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSavingProduct ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSavingProduct ? 'جاري الحفظ...' : tr('catalog_export_from_calc')}</span>
            </button>
          )}

          {/* زر تصدير عرض سعر رسمي PDF */}
          <button
            type="button"
            disabled={isExportingQuotation}
            onClick={handleExportQuotation}
            className="flex-1 md:flex-none px-5 py-3 rounded-2xl font-black text-xs text-amber-900 dark:text-amber-100 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 transition flex items-center justify-center gap-2 cursor-pointer border border-amber-300 dark:border-amber-800 shadow-sm disabled:opacity-50"
          >
            {isExportingQuotation ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
            ) : (
              <FileText className="w-4 h-4 text-amber-700" />
            )}
            <span>تصدير عرض سعر رسمي 📄✨</span>
          </button>

          {/* أيقونة الحالة بجوار زر الحفظ مباشرة تعتمد على DexieDB ومزامنة Supabase */}
          <div
            className={`px-3.5 py-2.5 rounded-2xl border flex items-center gap-2 text-xs font-black transition-all ${
              syncStatus === 'synced'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-sm'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 shadow-sm'
            }`}
            title={
              syncStatus === 'synced'
                ? tr('calc_synced_cloud')
                : tr('calc_local_only')
            }
          >
            {syncStatus === 'synced' ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 -mr-1 flex-shrink-0" />
                <span className="text-[11px] font-bold">{tr('calc_synced_cloud')}</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 -mr-1 flex-shrink-0" />
                <span className="text-[11px] font-bold">{tr('calc_local_only')}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const selectedSection = MAIN_SECTIONS.find((s) => s.id === selectedSectionId);
              const selectedCraft = SUB_CRAFTS_REGISTRY.find((c) => c.id === selectedCraftId);
              const record: SavedProductRecord = {
                id: existingRecordId || `prod_${Date.now()}`,
                tenantId: profile.tenantId,
                workshopId: profile.tenantId,
                productName: productName || `منتج ${category}`,
                productSerialNumber: initialRecord?.productSerialNumber,
                productCode: initialRecord?.productCode,
                mainSectionId: selectedSectionId,
                mainSectionName: selectedSection?.nameAr || selectedSectionId,
                craftId: selectedCraftId,
                craftName: selectedCraft?.nameAr || selectedCraftId,
                productType: category,
                category,
                costPrice,
                retailPrice,
                wholesalePrice,
                wholesaleMarginDiscountPercent,
                input: calculationInput,
                output,
                imageUrl: productImageUrl,
                isActive: true,
                createdAt: initialRecord?.createdAt || Date.now(),
                updatedAt: Date.now(),
              };
              onOpenWhatsAppShare(record);
            }}
            className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 transition flex items-center justify-center gap-2 cursor-pointer border border-emerald-300 dark:border-emerald-800"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>{tr('calc_share_quote_whatsapp')}</span>
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
