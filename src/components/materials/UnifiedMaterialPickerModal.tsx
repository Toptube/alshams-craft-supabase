import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Check,
  Plus,
  AlertTriangle,
  Layers,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';
import {
  UnifiedCategoryPrefix,
  UnitChainCode,
  UnifiedMaterialMaster,
  UnifiedMaterialSpec,
  UnifiedMaterialsSnapshot,
  formatCommercialSkuCode,
  searchUnifiedMaterials,
  getThreadThicknessOptions,
  isBundleThicknessThread,
  formatThreadThicknessRangeLabel,
} from '../../registry/unifiedMaterialsRegistry';
import {
  fetchUnifiedMaterialsSnapshot,
  createUnifiedMasterApi,
  createUnifiedBrandApi,
  getSeededFallbackSnapshot,
  LocalMaterialCodeMapping,
} from '../../db/unifiedMaterialsService';
import { normalizeMaterialKey } from '../../utils/materialsDeduplication';
import {
  UnifiedMaterialAccordionCard,
  MaterialCardSelectionConfig,
} from './UnifiedMaterialAccordionCard';

export interface UnifiedPickerSelectionItem {
  master: UnifiedMaterialMaster;
  spec?: UnifiedMaterialSpec | null;
  specCode?: string;
  brandCode?: string;
  brandName?: string;
  skuCode?: string;
  kind: 'primary' | 'extra';
  recommendedUnitName: string;
  availableThicknessesMm?: number[];
  selectedThicknessesMm?: number[];
  selectedAliases?: string[];
  selectedBrands?: string[];
  selectedUnitEquation?: string;
  personalBasePrice?: number;
  personalBrandPrices?: Record<string, number>;
  allThicknessesIncluded?: boolean;
}

interface UnifiedMaterialPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'artisan' | 'supplier';
  actorId: string;
  actorName: string;
  /** Used in supplier mode when linking a single item, or artisan multi-import */
  onConfirmSelection: (selected: UnifiedPickerSelectionItem[]) => void | Promise<void>;
  /** Already-linked unified master codes in member's list (derived ONLY from live existing materials) */
  alreadyLinkedCodes?: Set<string>;
  /** Existing material names in member's list (used for smart duplicate detection) */
  existingMaterialNames?: string[];
  /** Existing saved member preferences per masterCode (allows returning to customize owned materials anytime) */
  existingPreferencesByCode?: Record<string, LocalMaterialCodeMapping>;
  /** Callback when member updates preferences on an already-owned material */
  onUpdateExistingPreferences?: (masterCode: string, cfg: MaterialCardSelectionConfig) => void;
}

const DEFAULT_KIND_FOR_PREFIX: Record<UnifiedCategoryPrefix, 'primary' | 'extra'> = {
  TH: 'primary',
  BD: 'extra',
  CL: 'primary',
  WD: 'primary',
  LT: 'primary',
  MT: 'primary',
  DC: 'extra',
  AR: 'primary',
  PK: 'extra',
  PP: 'primary',
  GL: 'primary',
  AX: 'extra',
};

type SelectionConfig = MaterialCardSelectionConfig;

export const UnifiedMaterialPickerModal: React.FC<UnifiedMaterialPickerModalProps> = ({
  isOpen,
  onClose,
  mode,
  actorId,
  actorName,
  onConfirmSelection,
  alreadyLinkedCodes,
  existingMaterialNames = [],
  existingPreferencesByCode = {},
  onUpdateExistingPreferences,
}) => {
  const [snapshot, setSnapshot] = useState<UnifiedMaterialsSnapshot>(() => getSeededFallbackSnapshot());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [prefixFilter, setPrefixFilter] = useState<UnifiedCategoryPrefix | 'all'>('all');
  const [workshopFilter, setWorkshopFilter] = useState<string>('all');

  // In-place accordion card expansion (clicking checkmark NEVER closes card!)
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [draftMap, setDraftMap] = useState<Record<string, SelectionConfig>>({});
  const [selectedMap, setSelectedMap] = useState<Record<string, SelectionConfig>>({});
  const [submitting, setSubmitting] = useState(false);

  // Add New Unified Material inline panel
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrefix, setNewPrefix] = useState<UnifiedCategoryPrefix>('TH');
  const [newCanonicalName, setNewCanonicalName] = useState('');
  const [newArtistAlias, setNewArtistAlias] = useState('');
  const [newSupplierAlias, setNewSupplierAlias] = useState('');
  const [newUnitChain, setNewUnitChain] = useState<UnitChainCode>('ل1');
  const [newSpecLabel, setNewSpecLabel] = useState('');
  const [newThicknessesText, setNewThicknessesText] = useState('2, 3, 4, 5, 6');
  const [newBrandsText, setNewBrandsText] = useState('');
  const [newOrigin, setNewOrigin] = useState('');
  const [creatingMaster, setCreatingMaster] = useState(false);
  const [formMsg, setFormMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Inline add brand (for supplier SKU builder)
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);

  const [actionToast, setActionToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => setActionToast(msg);

  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(null), 2600);
    return () => clearTimeout(t);
  }, [actionToast]);

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const snap = await fetchUnifiedMaterialsSnapshot({ role: mode, memberId: actorId });
      setSnapshot(snap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadSnapshot();
    setSelectedMap({});
    setDraftMap({});
    setExpandedCode(null);
    setFormMsg(null);
    setShowAddForm(false);
  }, [isOpen, mode, actorId]);

  // Normalized set of existing names for smart duplicate prevention
  const normalizedExistingNames = useMemo(() => {
    const s = new Set<string>();
    for (const nm of existingMaterialNames) {
      const nk = normalizeMaterialKey(nm);
      if (nk) s.add(nk);
    }
    return s;
  }, [existingMaterialNames]);

  const isAlreadyOwned = (master: UnifiedMaterialMaster): boolean => {
    if (alreadyLinkedCodes?.has(master.code)) return true;
    if (normalizedExistingNames.size === 0) return false;
    const cn = normalizeMaterialKey(master.canonicalName);
    if (cn && normalizedExistingNames.has(cn)) return true;
    return false;
  };

  // CRITICAL: Never hide global unified materials for any artist/supplier!
  // Deleting from "خاماتي" only removes from the artist's private list, NEVER from the Unified Materials System.
  const customNamesByCode = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const c of snapshot.memberCustomizations || []) {
      if (c.customName && c.memberId === actorId) rec[c.masterCode] = c.customName;
    }
    return rec;
  }, [snapshot.memberCustomizations, actorId]);

  // Member's own saved personal price observations (isolated from global baseline)
  const memberPricingByCode = useMemo(() => {
    const rec: Record<string, { personalBasePrice?: number; personalBrandPrices?: Record<string, number> }> = {};
    for (const [code, pref] of Object.entries(existingPreferencesByCode || {})) {
      if (pref?.personalBasePrice || pref?.personalBrandPrices) {
        rec[code] = {
          personalBasePrice: pref.personalBasePrice,
          personalBrandPrices: pref.personalBrandPrices,
        };
      }
    }
    for (const c of snapshot.memberCustomizations || []) {
      if (c.memberId === actorId && c.specCode === '__PRICE_OBS__' && c.bridgeOverrides) {
        const ov = c.bridgeOverrides as Record<string, any>;
        rec[c.masterCode] = {
          personalBasePrice:
            Number(ov.personalBasePrice) > 0
              ? Number(ov.personalBasePrice)
              : rec[c.masterCode]?.personalBasePrice,
          personalBrandPrices: {
            ...(rec[c.masterCode]?.personalBrandPrices || {}),
            ...(ov.personalBrandPrices && typeof ov.personalBrandPrices === 'object'
              ? ov.personalBrandPrices
              : {}),
          },
        };
      }
    }
    return rec;
  }, [snapshot.memberCustomizations, actorId, existingPreferencesByCode]);

  // Exact active count per category prefix (so TH shows 56, CL shows 58, etc.)
  const activeCountByPrefix = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const m of snapshot.masters) {
      if (m.status !== 'active') continue;
      counts[m.prefix] = (counts[m.prefix] || 0) + 1;
      total += 1;
    }
    counts.all = total;
    return counts;
  }, [snapshot.masters]);

  const workshopOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of snapshot.masters) {
      for (const w of m.workshopTags || []) s.add(w);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [snapshot.masters]);

  const searchResult = useMemo(() => {
    return searchUnifiedMaterials(searchQuery, snapshot.masters, snapshot.specs, snapshot.aliases, {
      prefixFilter,
      workshopFilter,
      includeArchived: false,
      customNamesByCode,
    });
  }, [searchQuery, snapshot, prefixFilter, workshopFilter, customNamesByCode]);

  // Show ALL matching items without artificial 80-item truncation
  const visibleMatches = useMemo(() => {
    return searchResult.matches;
  }, [searchResult.matches]);

  const selectableVisibleMatches = useMemo(() => {
    return visibleMatches.filter(({ master }) => !isAlreadyOwned(master));
  }, [visibleMatches, alreadyLinkedCodes, normalizedExistingNames]);

  const alreadyOwnedVisibleCount = visibleMatches.length - selectableVisibleMatches.length;

  const selectedCount = Object.keys(selectedMap).length;

  const allSelectableVisibleSelected = useMemo(() => {
    if (selectableVisibleMatches.length === 0) return false;
    return selectableVisibleMatches.every(({ master }) => Boolean(selectedMap[master.code]));
  }, [selectableVisibleMatches, selectedMap]);

  const getDefaultConfig = (master: UnifiedMaterialMaster): SelectionConfig => {
    const saved = existingPreferencesByCode?.[master.code];
    const savedPrices = memberPricingByCode[master.code];
    const defaultThicknesses = isBundleThicknessThread(master)
      ? getThreadThicknessOptions(master.code, master)
      : [];
    return {
      specCode: saved?.specCode || '',
      brandCode: saved?.brandCode || (mode === 'supplier' ? 'B000' : ''),
      kind: DEFAULT_KIND_FOR_PREFIX[master.prefix] || 'primary',
      selectedThicknessesMm:
        saved?.selectedThicknessesMm && saved.selectedThicknessesMm.length > 0
          ? saved.selectedThicknessesMm
          : defaultThicknesses,
      selectedAliases: saved?.selectedAliases || [],
      selectedBrands: saved?.selectedBrands || [],
      selectedUnitEquation: saved?.selectedUnitEquation,
      personalBasePrice: saved?.personalBasePrice ?? savedPrices?.personalBasePrice,
      personalBrandPrices: saved?.personalBrandPrices ?? savedPrices?.personalBrandPrices,
    };
  };

  const getActiveConfig = (master: UnifiedMaterialMaster): SelectionConfig => {
    return draftMap[master.code] || selectedMap[master.code] || getDefaultConfig(master);
  };

  // Independent Checkbox Toggle: marks/unmarks WITHOUT closing the card!
  const handleToggleCheckbox = (master: UnifiedMaterialMaster) => {
    if (isAlreadyOwned(master)) {
      triggerToast(`«${master.canonicalName}» موجودة بالفعل في خاماتك — يمكنك فتحها لتخصيصها أو إضافة مواصفات`);
      return;
    }
    const displayName = customNamesByCode[master.code] || master.canonicalName;
    if (selectedMap[master.code]) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        delete next[master.code];
        return next;
      });
      triggerToast(`تم إلغاء تحديد «${displayName}»`);
    } else {
      const cfg = getActiveConfig(master);
      setSelectedMap((prev) =>
        mode === 'supplier' ? { [master.code]: cfg } : { ...prev, [master.code]: cfg }
      );
      triggerToast(`✓ تم تحديد «${displayName}» — يمكنك فتح تفاصيلها لتخصيص السماكات والمسميات قبل الحفظ`);
    }
  };

  // Clicking title or "فتح التفاصيل" expands/collapses in-place (works for BOTH new and already-owned items!)
  const handleToggleInspect = (master: UnifiedMaterialMaster) => {
    setExpandedCode((prev) => {
      if (prev === master.code) return null;
      setDraftMap((dPrev) => ({
        ...dPrev,
        [master.code]: dPrev[master.code] || selectedMap[master.code] || getDefaultConfig(master),
      }));
      return master.code;
    });
  };

  // Explicit Save Button inside the expanded card -> saves selections & collapses card cleanly
  const handleConfirmSingleMaster = (master: UnifiedMaterialMaster) => {
    if (isAlreadyOwned(master)) {
      setExpandedCode(null);
      return;
    }
    const cfg = getActiveConfig(master);
    const displayName = customNamesByCode[master.code] || master.canonicalName;

    setSelectedMap((prev) =>
      mode === 'supplier'
        ? { [master.code]: cfg }
        : { ...prev, [master.code]: cfg }
    );

    setExpandedCode(null);

    if (cfg.selectedThicknessesMm && cfg.selectedThicknessesMm.length > 0) {
      const thRange = formatThreadThicknessRangeLabel(cfg.selectedThicknessesMm);
      triggerToast(`✓ تم حفظ اختيارات «${displayName}» (${thRange})`);
    } else {
      triggerToast(`✓ تم حفظ واختيار «${displayName}» لقائمة خاماتك`);
    }
  };

  const handleToggleSelectAllVisible = () => {
    if (selectableVisibleMatches.length === 0) {
      triggerToast('جميع الأصناف المعروضة مضافة بالفعل في خاماتك ✓');
      return;
    }
    if (allSelectableVisibleSelected) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        for (const { master } of selectableVisibleMatches) {
          delete next[master.code];
        }
        return next;
      });
      triggerToast('تم إلغاء تحديد الخامات المعروضة');
      return;
    }

    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const { master } of selectableVisibleMatches) {
        if (!next[master.code]) {
          next[master.code] = draftMap[master.code] || getDefaultConfig(master);
        }
      }
      return next;
    });
    setExpandedCode(null);
    triggerToast(
      alreadyOwnedVisibleCount > 0
        ? `✓ تم اختيار (${selectableVisibleMatches.length}) خامة جديدة فقط — وتجاهل (${alreadyOwnedVisibleCount}) موجودة بالفعل في خاماتك`
        : `✓ تم اختيار الكل (${selectableVisibleMatches.length} خامة بكامل سماكاتها)`
    );
  };

  const updateDraft = (master: UnifiedMaterialMaster, patch: Partial<SelectionConfig>) => {
    setDraftMap((prev) => {
      const base = prev[master.code] || selectedMap[master.code] || getDefaultConfig(master);
      return { ...prev, [master.code]: { ...base, ...patch } };
    });
  };

  const handleCreateNewMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCanonicalName.trim()) {
      setFormMsg({ text: 'يرجى كتابة الاسم المعتمد للخامة.', isError: true });
      return;
    }
    setCreatingMaster(true);
    setFormMsg(null);

    const parsedThicknesses =
      newPrefix === 'TH'
        ? Array.from(
            new Set(
              newThicknessesText
                .split(/[،,\s/]+/)
                .map((v) => Number(v.trim()))
                .filter((n) => Number.isFinite(n) && n > 0 && n <= 100)
            )
          ).sort((a, b) => a - b)
        : undefined;

    const parsedBrands = newBrandsText
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await createUnifiedMasterApi({
      prefix: newPrefix,
      canonicalName: newCanonicalName.trim(),
      unitChain: newUnitChain,
      artistAliases: newArtistAlias
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      supplierAliases: newSupplierAlias
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      defaultBrands: parsedBrands,
      availableThicknessesMm: parsedThicknesses,
      initialSpecLabel: newPrefix !== 'TH' ? newSpecLabel.trim() || undefined : undefined,
      initialSpecOrigin: newOrigin.trim() || undefined,
      actorRole: mode,
      actorId,
      actorName,
    });
    setCreatingMaster(false);

    if (!res.success || !res.master) {
      setFormMsg({ text: res.error || 'تعذر إضافة الخامة الموحدة', isError: true });
      return;
    }

    await loadSnapshot();
    const createdMaster = res.master;
    const selectionEntry: SelectionConfig = {
      specCode: '',
      brandCode: mode === 'supplier' ? 'B000' : '',
      kind: DEFAULT_KIND_FOR_PREFIX[createdMaster.prefix] || 'primary',
      selectedThicknessesMm: parsedThicknesses || [],
      selectedAliases: [],
      selectedBrands: parsedBrands,
    };
    setSelectedMap((prev) =>
      mode === 'supplier'
        ? { [createdMaster.code]: selectionEntry }
        : { ...prev, [createdMaster.code]: selectionEntry }
    );
    setSearchQuery(createdMaster.canonicalName);
    setNewCanonicalName('');
    setNewArtistAlias('');
    setNewSupplierAlias('');
    setNewSpecLabel('');
    setNewBrandsText('');
    setNewOrigin('');
    setShowAddForm(false);
    setFormMsg({
      text: res.alreadyExisted
        ? `الخامة موجودة مسبقاً بكود (${createdMaster.code}) وتم تحديدها لك ✅`
        : `تم تسجيل الخامة الجديدة برقم سيريال (${createdMaster.code}) وتحديدها وإرسال إشعار مراجعة للسوبر أدمن ✅`,
    });
  };

  const handleCreateInlineBrand = async () => {
    if (!newBrandName.trim()) return;
    setSavingBrand(true);
    const res = await createUnifiedBrandApi({ brandName: newBrandName.trim() });
    setSavingBrand(false);
    if (res.success && res.brand) {
      await loadSnapshot();
      setNewBrandName('');
      setShowAddBrand(false);
      triggerToast(`✓ تمت إضافة الماركة «${res.brand.brandName}»`);
    }
  };

  const handleConfirm = async () => {
    const entries = Object.entries(selectedMap);
    if (entries.length === 0) return;

    setSubmitting(true);
    try {
      const result: UnifiedPickerSelectionItem[] = [];
      for (const [masterCode, cfg] of entries) {
        const master = snapshot.masters.find((m) => m.code === masterCode);
        if (!master || isAlreadyOwned(master)) continue;
        const isBundledThread = isBundleThicknessThread(master);
        const threadThicknesses = isBundledThread ? getThreadThicknessOptions(master.code, master) : undefined;
        const spec = !isBundledThread && cfg.specCode
          ? snapshot.specs.find((s) => s.specCode === cfg.specCode) || null
          : null;
        const chainDef = snapshot.unitChains.find((c) => c.code === master.unitChain);
        const brandObj = cfg.brandCode
          ? snapshot.brands.find((b) => b.brandCode === cfg.brandCode)
          : undefined;
        const baseSpecCode = spec?.specCode || master.code;
        const skuCode =
          mode === 'supplier' && cfg.brandCode
            ? formatCommercialSkuCode(baseSpecCode, cfg.brandCode)
            : baseSpecCode;

        result.push({
          master: {
            ...master,
            canonicalName: customNamesByCode[master.code] || master.canonicalName,
          },
          spec,
          specCode: spec?.specCode || undefined,
          brandCode: cfg.brandCode || undefined,
          brandName: brandObj?.brandName,
          skuCode,
          kind: cfg.kind,
          recommendedUnitName: chainDef?.defaultPrimaryUnit || 'كيلو',
          availableThicknessesMm: threadThicknesses,
          selectedThicknessesMm:
            cfg.selectedThicknessesMm && cfg.selectedThicknessesMm.length > 0
              ? cfg.selectedThicknessesMm
              : threadThicknesses,
          selectedAliases: cfg.selectedAliases || [],
          selectedBrands: cfg.selectedBrands || [],
          selectedUnitEquation: cfg.selectedUnitEquation,
          personalBasePrice: cfg.personalBasePrice,
          personalBrandPrices: cfg.personalBrandPrices,
          allThicknessesIncluded: isBundledThread || !spec,
        });
      }
      if (result.length > 0) {
        await onConfirmSelection(result);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      dir="rtl"
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#EA580C]/15 text-[#EA580C] dark:text-[#FBBF24] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA]">
                {mode === 'supplier'
                  ? 'ربط / استيراد من منظومة الخامات الموحدة'
                  : 'استيراد خامات من المنظومة الموحدة إلى «خاماتي»'}
              </h2>
              <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                اضغط على أي خامة لمعاينتها أولاً (أساسية / فرعية وسماكاتها) ثم اضغط «اختيار» لإضافتها — الخامات الموجودة لديك محمية من التكرار تلقائياً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm((p) => !p);
                setFormMsg(null);
              }}
              className="px-3 py-2 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] text-[#FBBF24] border border-[#22355E] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'إغلاق نموذج الإضافة' : 'لم أجد الخامة؟ أضفها فوراً'}</span>
            </button>
            <button
              type="button"
              onClick={loadSnapshot}
              title="تحديث المنظومة"
              className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {formMsg && (
            <div
              className={`p-3 rounded-2xl text-xs font-black border flex items-center justify-between gap-2 ${
                formMsg.isError
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <span>{formMsg.text}</span>
              <button type="button" onClick={() => setFormMsg(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Community Add New Master Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateNewMaster}
              className="p-4 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border-2 border-[#EA580C]/50 space-y-3 text-xs"
            >
              <h3 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA]">
                إضافة خامة جديدة لقاعدة الخامات الموحدة (تأخذ رقم سيريال أوتوماتيك وتُبلغ السوبر أدمن فوراً)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">القسم *</label>
                  <select
                    value={newPrefix}
                    onChange={(e) => {
                      const p = e.target.value as UnifiedCategoryPrefix;
                      setNewPrefix(p);
                      const cat = snapshot.categories.find((c) => c.prefix === p);
                      if (cat) setNewUnitChain(cat.defaultUnitChain);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  >
                    {snapshot.categories.map((c) => (
                      <option key={c.prefix} value={c.prefix}>
                        {c.nameAr.replace(' ★', '')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">الاسم المعتمد للخامة *</label>
                  <input
                    type="text"
                    required
                    value={newCanonicalName}
                    onChange={(e) => setNewCanonicalName(e.target.value)}
                    placeholder="مثال: خيط قطن مجدول مصري أو قفل مغناطيسي للشنط"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">المسمى الدارج لدى الفنانين</label>
                  <input
                    type="text"
                    value={newArtistAlias}
                    onChange={(e) => setNewArtistAlias(e.target.value)}
                    placeholder="افصل بفاصلة ،"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">أسماء الماركات (اختياري)</label>
                  <input
                    type="text"
                    value={newBrandsText}
                    onChange={(e) => setNewBrandsText(e.target.value)}
                    placeholder="افصل بفاصلة ، مثال: أليز، الشمس"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">سلسلة الوحدات</label>
                  <select
                    value={newUnitChain}
                    onChange={(e) => setNewUnitChain(e.target.value as UnitChainCode)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  >
                    {snapshot.unitChains.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.titleAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {newPrefix === 'TH' ? (
                  <div>
                    <label className="block font-bold mb-1">السماكات المتاحة بالمم</label>
                    <input
                      type="text"
                      value={newThicknessesText}
                      onChange={(e) => setNewThicknessesText(e.target.value)}
                      placeholder="2, 3, 4, 5, 6"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold mb-1">المقاس / المواصفة (اختياري)</label>
                    <input
                      type="text"
                      value={newSpecLabel}
                      onChange={(e) => setNewSpecLabel(e.target.value)}
                      placeholder="مثال: مقاس 10 مم"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-bold mb-1">المنشأ / النوع (اختياري)</label>
                  <input
                    type="text"
                    value={newOrigin}
                    onChange={(e) => setNewOrigin(e.target.value)}
                    placeholder="مثال: مصري / تركي / صيني"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingMaster}
                  className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black cursor-pointer disabled:opacity-55"
                >
                  {creatingMaster ? 'جاري التوليد والمزامنة...' : 'حفظ وإعطاء سيريال موحد جديد ✅'}
                </button>
              </div>
            </form>
          )}

          {/* Interactive Selection Toast */}
          {actionToast && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-black flex items-center justify-between gap-2 shadow-sm transition-all">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 shrink-0" />
                <span>{actionToast}</span>
              </span>
              <button type="button" onClick={() => setActionToast(null)} className="opacity-80 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Smart Search & Filters */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الخامة الدارج أو التجاري (مثل: قطن مجدول، بوليستر مصري، كردون الزجزاج، سلب)..."
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none focus:border-[#EA580C]"
                />
              </div>

              <select
                value={workshopFilter}
                onChange={(e) => setWorkshopFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold outline-none"
              >
                <option value="all">تصفية حسب الورشة / الحرفة: الكل</option>
                {workshopOptions.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* 12 Clean Category Filter Buttons with EXACT Active Item Counts */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPrefixFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black border cursor-pointer transition active:scale-95 inline-flex items-center gap-1 ${
                  prefixFilter === 'all'
                    ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent shadow-xs'
                    : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]/60'
                }`}
              >
                {prefixFilter === 'all' && <Check className="w-3 h-3" />}
                <span>الكل ({activeCountByPrefix.all || 0})</span>
              </button>
              {snapshot.categories.map((cat) => (
                <button
                  key={cat.prefix}
                  type="button"
                  onClick={() => setPrefixFilter(cat.prefix)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer transition active:scale-95 inline-flex items-center gap-1 ${
                    prefixFilter === cat.prefix
                      ? 'bg-[#EA580C] text-white border-transparent shadow-xs'
                      : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1] hover:border-[#EA580C]/60'
                  }`}
                >
                  {prefixFilter === cat.prefix && <Check className="w-3 h-3" />}
                  <span>
                    {cat.nameAr.replace(' ★', '')} ({activeCountByPrefix[cat.prefix] || 0})
                  </span>
                </button>
              ))}
            </div>

            {/* Cross-Category Disambiguation Banner */}
            {searchResult.disambiguationMessage && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>{searchResult.disambiguationMessage}</span>
              </div>
            )}
          </div>

          {/* Action Bar: Smart Select All (skips already owned!) */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'artisan' && visibleMatches.length > 0 && (
                <button
                  type="button"
                  disabled={selectableVisibleMatches.length === 0}
                  onClick={handleToggleSelectAllVisible}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed ${
                    selectableVisibleMatches.length === 0
                      ? 'bg-sky-600 text-white'
                      : allSelectableVisibleSelected
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-[#0C1427] hover:bg-[#1A2B54] text-[#FBBF24]'
                  }`}
                >
                  {selectableVisibleMatches.length === 0 ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>كل المعروض موجود بالفعل في خاماتك ✓</span>
                    </>
                  ) : allSelectableVisibleSelected ? (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      <span>تم اختيار كل الجديد ({selectableVisibleMatches.length}) ✓</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      <span>اختيار كل الجديد ({selectableVisibleMatches.length})</span>
                    </>
                  )}
                </button>
              )}

              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMap({});
                    triggerToast('تم إلغاء جميع الاختيارات');
                  }}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 text-rose-600 dark:text-rose-400 text-[11px] font-black transition active:scale-95 cursor-pointer"
                >
                  مسح التحديد ({selectedCount})
                </button>
              )}

              <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                المعروض: <strong className="font-mono">{visibleMatches.length}</strong> صنف
                {alreadyOwnedVisibleCount > 0 && (
                  <span className="text-sky-700 dark:text-sky-300 mr-1.5">
                    ({alreadyOwnedVisibleCount} موجودة لديك محمية من التكرار)
                  </span>
                )}
              </span>
            </div>

            {mode === 'supplier' && (
              <button
                type="button"
                onClick={() => setShowAddBrand((p) => !p)}
                className="text-[#EA580C] hover:underline text-xs font-black cursor-pointer"
              >
                {showAddBrand ? 'إخفاء إضافة ماركة' : '+ إضافة ماركة غير مدرجة'}
              </button>
            )}
          </div>

          {showAddBrand && mode === 'supplier' && (
            <div className="p-3 rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="اكتب اسم الماركة / المصنع الجديد..."
                className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <button
                type="button"
                disabled={savingBrand || !newBrandName.trim()}
                onClick={handleCreateInlineBrand}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer disabled:opacity-55"
              >
                {savingBrand ? 'جاري الإضافة...' : 'إضافة ماركة وتوليد كود'}
              </button>
            </div>
          )}

          {visibleMatches.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-center space-y-2">
              <p className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                لا توجد خامة مطابقة في المنظومة الموحدة
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewCanonicalName(searchQuery.trim());
                  setShowAddForm(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>أضف "{searchQuery.trim() || 'هذه الخامة'}" للمنظومة الموحدة فوراً</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {visibleMatches.map(({ master, specs, aliases }) => {
                const isSelected = Boolean(selectedMap[master.code]);
                const isExpanded = expandedCode === master.code;
                const alreadyOwned = isAlreadyOwned(master);
                const activeCfg = getActiveConfig(master);
                const chainDef = snapshot.unitChains.find((u) => u.code === master.unitChain);
                const catDef = snapshot.categories.find((c) => c.prefix === master.prefix);

                return (
                  <UnifiedMaterialAccordionCard
                    key={master.code}
                    master={master}
                    specs={specs}
                    aliases={aliases}
                    allBrands={snapshot.brands}
                    chainDef={chainDef}
                    categoryLabel={catDef?.nameAr.replace(' ★', '') || master.prefix}
                    customDisplayName={customNamesByCode[master.code]}
                    savedMemberPricing={memberPricingByCode[master.code]}
                    mode={mode}
                    actorId={actorId}
                    actorName={actorName}
                    alreadyOwned={alreadyOwned}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    activeCfg={activeCfg}
                    onToggleCheckbox={() => handleToggleCheckbox(master)}
                    onToggleExpand={() => handleToggleInspect(master)}
                    onUpdateDraft={(patch) => {
                      updateDraft(master, patch);
                      // Keep selectedMap synced if already checked so user never loses customizations
                      if (selectedMap[master.code]) {
                        setSelectedMap((prev) => ({
                          ...prev,
                          [master.code]: { ...prev[master.code], ...patch },
                        }));
                      }
                    }}
                    onSaveCardSelection={() => handleConfirmSingleMaster(master)}
                    onSaveExistingOwnedPreferences={(cfg) => {
                      onUpdateExistingPreferences?.(master.code, cfg);
                      setExpandedCode(null);
                    }}
                    onContributionSaved={loadSnapshot}
                    onToast={triggerToast}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC] dark:bg-[#0A1124] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
            تم اختيار <strong className="font-mono text-[#EA580C] dark:text-[#FBBF24] text-sm">{selectedCount}</strong>{' '}
            خامة جديدة للاستيراد — ستظهر بأكوادها الموحدة فور الحفظ في «خاماتي»
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || submitting}
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {submitting
                  ? 'جاري الحفظ بدون تكرار...'
                  : mode === 'supplier'
                  ? 'تأكيد الربط بالمنظومة الموحدة'
                  : `حفظ وإضافة (${selectedCount}) إلى خاماتي`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
