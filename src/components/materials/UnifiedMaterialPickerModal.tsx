import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Check,
  Plus,
  AlertTriangle,
  Layers,
  Tag,
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
  createUnifiedSpecApi,
  createUnifiedBrandApi,
  getSeededFallbackSnapshot,
} from '../../db/unifiedMaterialsService';

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
  /** Optional already-linked codes in member's list */
  alreadyLinkedCodes?: Set<string>;
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

export const UnifiedMaterialPickerModal: React.FC<UnifiedMaterialPickerModalProps> = ({
  isOpen,
  onClose,
  mode,
  actorId,
  actorName,
  onConfirmSelection,
  alreadyLinkedCodes,
}) => {
  const [snapshot, setSnapshot] = useState<UnifiedMaterialsSnapshot>(() => getSeededFallbackSnapshot());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [prefixFilter, setPrefixFilter] = useState<UnifiedCategoryPrefix | 'all'>('all');
  const [workshopFilter, setWorkshopFilter] = useState<string>('all');

  // Selected state keyed by masterCode
  const [selectedMap, setSelectedMap] = useState<
    Record<
      string,
      {
        specCode: string;
        brandCode: string;
        kind: 'primary' | 'extra';
      }
    >
  >({});
  const [submitting, setSubmitting] = useState(false);

  // Add New Unified Material inline panel
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrefix, setNewPrefix] = useState<UnifiedCategoryPrefix>('TH');
  const [newCanonicalName, setNewCanonicalName] = useState('');
  const [newArtistAlias, setNewArtistAlias] = useState('');
  const [newSupplierAlias, setNewSupplierAlias] = useState('');
  const [newUnitChain, setNewUnitChain] = useState<UnitChainCode>('ل1');
  const [newSpecLabel, setNewSpecLabel] = useState('');
  const [newThicknessMm, setNewThicknessMm] = useState('');
  const [newOrigin, setNewOrigin] = useState('');
  const [creatingMaster, setCreatingMaster] = useState(false);
  const [formMsg, setFormMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Inline add spec to an existing item
  const [addingSpecForCode, setAddingSpecForCode] = useState<string | null>(null);
  const [inlineSpecLabel, setInlineSpecLabel] = useState('');
  const [savingInlineSpec, setSavingInlineSpec] = useState(false);

  // Inline add brand (for supplier SKU builder)
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);

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
    setFormMsg(null);
    setShowAddForm(false);
    setAddingSpecForCode(null);
  }, [isOpen, mode, actorId]);

  const hiddenMasterCodes = useMemo(() => {
    const set = new Set<string>();
    for (const c of snapshot.memberCustomizations || []) {
      if (c.isHidden && c.memberId === actorId) set.add(c.masterCode);
    }
    return set;
  }, [snapshot.memberCustomizations, actorId]);

  const customNamesByCode = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const c of snapshot.memberCustomizations || []) {
      if (c.customName && c.memberId === actorId) rec[c.masterCode] = c.customName;
    }
    return rec;
  }, [snapshot.memberCustomizations, actorId]);

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
      hiddenMasterCodes,
      customNamesByCode,
    });
  }, [searchQuery, snapshot, prefixFilter, workshopFilter, hiddenMasterCodes, customNamesByCode]);

  const visibleMatches = useMemo(() => {
    return searchResult.matches.slice(0, 80);
  }, [searchResult.matches]);

  const [actionToast, setActionToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setActionToast(msg);
  };

  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(null), 2400);
    return () => clearTimeout(t);
  }, [actionToast]);

  const selectedCount = Object.keys(selectedMap).length;

  const allVisibleSelected = useMemo(() => {
    if (visibleMatches.length === 0) return false;
    return visibleMatches.every(({ master }) => Boolean(selectedMap[master.code]));
  }, [visibleMatches, selectedMap]);

  const handleToggleSelectAllVisible = () => {
    if (visibleMatches.length === 0) return;
    if (allVisibleSelected) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        for (const { master } of visibleMatches) {
          delete next[master.code];
        }
        return next;
      });
      triggerToast('تم إلغاء تحديد الخامات المعروضة');
      return;
    }

    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const { master } of visibleMatches) {
        if (!next[master.code]) {
          next[master.code] = {
            specCode: '',
            brandCode: mode === 'supplier' ? 'B000' : '',
            kind: DEFAULT_KIND_FOR_PREFIX[master.prefix] || 'primary',
          };
        }
      }
      return next;
    });
    triggerToast(`✓ تم تحديد الكل (${visibleMatches.length} خامة بكامل سماكاتها)`);
  };

  const toggleSelectMaster = (master: UnifiedMaterialMaster, _specs: UnifiedMaterialSpec[]) => {
    const wasSelected = Boolean(selectedMap[master.code]);
    const displayName = customNamesByCode[master.code] || master.canonicalName;
    setSelectedMap((prev) => {
      if (prev[master.code]) {
        const next = { ...prev };
        delete next[master.code];
        return next;
      }
      // Always default to full material (all thicknesses/specs included) rather than locking into one thickness
      const baseSelection = {
        specCode: '',
        brandCode: mode === 'supplier' ? 'B000' : '',
        kind: DEFAULT_KIND_FOR_PREFIX[master.prefix] || 'primary',
      };
      if (mode === 'supplier') {
        return { [master.code]: baseSelection };
      }
      return { ...prev, [master.code]: baseSelection };
    });

    if (wasSelected) {
      triggerToast(`تم إلغاء اختيار «${displayName}»`);
    } else if (isBundleThicknessThread(master)) {
      const thRange = formatThreadThicknessRangeLabel(getThreadThicknessOptions(master.code, master));
      triggerToast(`✓ تم اختيار «${displayName}» وتشمل تلقائياً كل السماكات (${thRange})`);
    } else {
      triggerToast(`✓ تم اختيار «${displayName}»`);
    }
  };

  const updateSelectedSpec = (masterCode: string, specCode: string) => {
    setSelectedMap((prev) => {
      if (!prev[masterCode]) return prev;
      return { ...prev, [masterCode]: { ...prev[masterCode], specCode } };
    });
  };

  const updateSelectedBrand = (masterCode: string, brandCode: string) => {
    setSelectedMap((prev) => {
      if (!prev[masterCode]) return prev;
      return { ...prev, [masterCode]: { ...prev[masterCode], brandCode } };
    });
  };

  const updateSelectedKind = (masterCode: string, kind: 'primary' | 'extra') => {
    setSelectedMap((prev) => {
      if (!prev[masterCode]) return prev;
      return { ...prev, [masterCode]: { ...prev[masterCode], kind } };
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
    const res = await createUnifiedMasterApi({
      prefix: newPrefix,
      canonicalName: newCanonicalName.trim(),
      unitChain: newUnitChain,
      artistAliases: newArtistAlias
        .split('،')
        .map((s) => s.trim())
        .filter(Boolean),
      supplierAliases: newSupplierAlias
        .split('،')
        .map((s) => s.trim())
        .filter(Boolean),
      initialSpecLabel: newSpecLabel.trim() || undefined,
      initialSpecThicknessMm: newThicknessMm ? Number(newThicknessMm) : undefined,
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
    const createdSpecCode = res.spec?.specCode || '';
    const selectionEntry = {
      specCode: createdSpecCode,
      brandCode: mode === 'supplier' ? 'B000' : '',
      kind: DEFAULT_KIND_FOR_PREFIX[createdMaster.prefix] || 'primary',
    };
    setSelectedMap((prev) =>
      mode === 'supplier'
        ? { [createdMaster.code]: selectionEntry }
        : { ...prev, [createdMaster.code]: selectionEntry }
    );
    setSearchQuery(createdMaster.code);
    setNewCanonicalName('');
    setNewArtistAlias('');
    setNewSupplierAlias('');
    setNewSpecLabel('');
    setNewThicknessMm('');
    setNewOrigin('');
    setShowAddForm(false);
    setFormMsg({
      text: `تم تسجيل الخامة الجديدة بكود (${createdMaster.code}) في المنظومة وإرسال إشعار فوري للإدارة ✅`,
    });
  };

  const handleAddInlineSpec = async (masterCode: string) => {
    if (!inlineSpecLabel.trim()) return;
    setSavingInlineSpec(true);
    const res = await createUnifiedSpecApi({
      masterCode,
      label: inlineSpecLabel.trim(),
      actorRole: mode,
      actorId,
      actorName,
    });
    setSavingInlineSpec(false);
    if (res.success && res.spec) {
      await loadSnapshot();
      updateSelectedSpec(masterCode, res.spec.specCode);
      setAddingSpecForCode(null);
      setInlineSpecLabel('');
    }
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
      // Apply brand to currently selected master in supplier mode
      const firstSelectedCode = Object.keys(selectedMap)[0];
      if (firstSelectedCode) {
        updateSelectedBrand(firstSelectedCode, res.brand.brandCode);
      }
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
        if (!master) continue;
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
          allThicknessesIncluded: isBundledThread || !spec,
        });
      }
      await onConfirmSelection(result);
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
                  ? 'ربط / استيراد من منظومة الخامات الموحدة (SKU + ماركة)'
                  : 'استيراد خامات من المنظومة الموحدة إلى ورشتك'}
              </h2>
              <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                {mode === 'supplier'
                  ? 'ابحث بالاسم الدارج أو اختصار القسم (TH, WD, BD...) واربط الصنف بكود موحد وماركة'
                  : 'علّم على الخامات التي تستخدمها فقط وصنّفها (أساسية / إضافية) أو أضف خامة غير موجودة'}
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
              className="px-3 py-2 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] text-[#FBBF24] border border-[#22355E] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
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
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA]">
                  إضافة خامة جديدة لقاعدة الخامات الموحدة (تأخذ كود أوتوماتيك وتُبلغ الإدارة فوراً)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">القسم والاختصار *</label>
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
                        {c.prefix} — {c.nameAr}
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
                    placeholder="افصل بفاصلة ، مثال: خيط حبل"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المسمى التجاري لدى الموردين</label>
                  <input
                    type="text"
                    value={newSupplierAlias}
                    onChange={(e) => setNewSupplierAlias(e.target.value)}
                    placeholder="افصل بفاصلة ، مثال: خرز على تلاتة"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">سلسلة الوحدات (ل1..ل8)</label>
                  <select
                    value={newUnitChain}
                    onChange={(e) => setNewUnitChain(e.target.value as UnitChainCode)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  >
                    {snapshot.unitChains.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.code} — {u.titleAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">أول مقاس/مواصفة (.01 اختياري)</label>
                  <input
                    type="text"
                    value={newSpecLabel}
                    onChange={(e) => setNewSpecLabel(e.target.value)}
                    placeholder="مثال: 3 مم مجدول"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">السمك بالمم (اختياري)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newThicknessMm}
                    onChange={(e) => setNewThicknessMm(e.target.value)}
                    placeholder="3"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المنشأ / النوع (مثال: دمياطي، تركي)</label>
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
                  {creatingMaster ? 'جاري التوليد والمزامنة...' : 'حفظ وإعطاء كود موحد جديد ✅'}
                </button>
              </div>
            </form>
          )}

          {/* Interactive Selection Toast */}
          {actionToast && (
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-black flex items-center justify-between gap-2 shadow-sm transition-all">
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

            {/* 12 Clean Category Filter Buttons (No Cluttering Prefix Codes) */}
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
                <span>الكل ({snapshot.masters.filter((m) => m.status === 'active').length})</span>
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
                  <span>{cat.nameAr.replace(' ★', '')}</span>
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

          {/* Action Bar: Select All ALWAYS First + Live Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-[#EFE9DC]/80 dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'artisan' && visibleMatches.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAllVisible}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs ${
                    allVisibleSelected
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-[#0C1427] hover:bg-[#1A2B54] text-[#FBBF24]'
                  }`}
                >
                  {allVisibleSelected ? (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      <span>تم اختيار الكل ({visibleMatches.length}) ✓</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      <span>اختيار الكل ({visibleMatches.length})</span>
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
                المعروض: <strong className="font-mono">{visibleMatches.length}</strong> من{' '}
                <strong className="font-mono">{searchResult.matches.length}</strong> صنف
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
              {visibleMatches.map(({ master, specs }) => {
                const isSelected = Boolean(selectedMap[master.code]);
                const selCfg = selectedMap[master.code];
                const isAlready = alreadyLinkedCodes?.has(master.code);
                const chainDef = snapshot.unitChains.find((u) => u.code === master.unitChain);
                const catDef = snapshot.categories.find((c) => c.prefix === master.prefix);
                const isBundledThread = isBundleThicknessThread(master);
                const threadThicknesses = isBundledThread ? getThreadThicknessOptions(master.code, master) : [];

                return (
                  <div
                    key={master.code}
                    className={`rounded-2xl p-3.5 border transition-all duration-150 space-y-2.5 ${
                      isSelected
                        ? 'bg-emerald-50/75 dark:bg-emerald-950/35 border-emerald-500 ring-1 ring-emerald-500/70 shadow-sm'
                        : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSelectMaster(master, specs)}
                        className="flex items-start gap-2.5 text-right flex-1 min-w-0 cursor-pointer group"
                      >
                        <div className="mt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-[#475569] dark:text-[#94A3B8] group-hover:text-[#EA580C]" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
                            {customNamesByCode[master.code] || master.canonicalName}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-[#C2410C] dark:text-amber-300">
                              {catDef?.nameAr.replace(' ★', '')}
                            </span>
                            {isBundledThread && threadThicknesses.length > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-400/40 text-[10px] font-black">
                                السماكات: {formatThreadThicknessRangeLabel(threadThicknesses)}
                              </span>
                            )}
                            {master.reviewStatus === 'new' && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                                جديد
                              </span>
                            )}
                            {isAlready && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                                مضافة لديك
                              </span>
                            )}
                          </div>

                          {(master.artistAliases.length > 0 || master.supplierAliases.length > 0) && (
                            <div className="text-[10px] text-[#475569] dark:text-[#94A3B8] truncate">
                              المسميات: {[...master.artistAliases, ...master.supplierAliases].slice(0, 3).join(' · ')}
                            </div>
                          )}

                          {chainDef && (
                            <div className="text-[10px] text-[#334155] dark:text-[#CBD5E1] font-bold">
                              الوحدة: {chainDef.defaultPrimaryUnit} ⇠ {chainDef.defaultSubUnit}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Clear interactive status button on every card */}
                      <button
                        type="button"
                        onClick={() => toggleSelectMaster(master, specs)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 inline-flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'bg-[#EFE9DC] dark:bg-[#0D162E] hover:bg-[#EA580C] hover:text-white text-[#0C1427] dark:text-[#F7F3EA] border border-[#D4CCBC] dark:border-[#22355E]'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تم الاختيار</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>اختيار</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expanded options when selected */}
                    {isSelected && selCfg && (
                      <div className="pt-2.5 border-t border-emerald-500/30 space-y-2 text-[11px]">
                        {/* Threads automatically include ALL thicknesses (no repetitive per-thickness picking) */}
                        {isBundledThread ? (
                          <div className="p-2.5 rounded-xl bg-emerald-600/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-bold flex flex-wrap items-center justify-between gap-2">
                            <span>
                              ✓ تنزل الخامة كاملة بجميع سماكاتها ({threadThicknesses.map((t) => `${t} مم`).join(' · ')}) — ويُختار السمك داخل حاسبة التكاليف لحساب سحب الخيط فقط.
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="font-bold shrink-0">المواصفة / المقاس:</label>
                            <select
                              value={selCfg.specCode}
                              onChange={(e) => {
                                updateSelectedSpec(master.code, e.target.value);
                                triggerToast('✓ تم تحديث المواصفة المختارة');
                              }}
                              className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                            >
                              <option value="">الكل / الخامة كاملة (الافتراضي)</option>
                              {specs.map((sp) => (
                                <option key={sp.specCode} value={sp.specCode}>
                                  {sp.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingSpecForCode((p) => (p === master.code ? null : master.code));
                                setInlineSpecLabel('');
                              }}
                              className="px-2 py-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-black text-[#C2410C] dark:text-[#FBBF24] cursor-pointer active:scale-95 transition"
                            >
                              + مقاس
                            </button>
                          </div>
                        )}

                        {!isBundledThread && addingSpecForCode === master.code && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={inlineSpecLabel}
                              onChange={(e) => setInlineSpecLabel(e.target.value)}
                              placeholder="وصف المقاس الجديد"
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border border-[#EA580C] font-bold"
                            />
                            <button
                              type="button"
                              disabled={savingInlineSpec || !inlineSpecLabel.trim()}
                              onClick={() => handleAddInlineSpec(master.code)}
                              className="px-3 py-1.5 rounded-lg bg-[#EA580C] text-white font-black cursor-pointer active:scale-95 transition disabled:opacity-50"
                            >
                              {savingInlineSpec ? '...' : 'حفظ'}
                            </button>
                          </div>
                        )}

                        {mode === 'artisan' ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">تصنيفها في ورشتك:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedKind(master.code, 'primary');
                                  triggerToast('✓ تم التصنيف كخامة أساسية');
                                }}
                                className={`px-2.5 py-1 rounded-lg font-black border cursor-pointer transition active:scale-95 inline-flex items-center gap-1 ${
                                  selCfg.kind === 'primary'
                                    ? 'bg-amber-600 text-white border-transparent shadow-xs'
                                    : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                                }`}
                              >
                                {selCfg.kind === 'primary' && <Check className="w-3 h-3" />}
                                <span>خامة أساسية</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedKind(master.code, 'extra');
                                  triggerToast('✓ تم التصنيف كخامة فرعية / إضافية');
                                }}
                                className={`px-2.5 py-1 rounded-lg font-black border cursor-pointer transition active:scale-95 inline-flex items-center gap-1 ${
                                  selCfg.kind === 'extra'
                                    ? 'bg-emerald-600 text-white border-transparent shadow-xs'
                                    : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                                }`}
                              >
                                {selCfg.kind === 'extra' && <Check className="w-3 h-3" />}
                                <span>خامة فرعية / إضافية</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="font-bold shrink-0 inline-flex items-center gap-1">
                              <Tag className="w-3 h-3 text-[#EA580C]" />
                              <span>الماركة / المصنع:</span>
                            </label>
                            <select
                              value={selCfg.brandCode}
                              onChange={(e) => {
                                updateSelectedBrand(master.code, e.target.value);
                                triggerToast('✓ تم اختيار الماركة');
                              }}
                              className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                            >
                              {snapshot.brands.map((b) => (
                                <option key={b.brandCode} value={b.brandCode}>
                                  {b.brandName}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/60 dark:bg-[#132040]/60 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
            المحدد حالياً:{' '}
            <strong className="font-mono text-[#EA580C] dark:text-[#FBBF24]">{selectedCount}</strong> خامة
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || submitting}
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {submitting
                  ? 'جاري الاستيراد...'
                  : mode === 'supplier'
                  ? 'تأكيد ربط الصنف بالكود التجاري SKU'
                  : `إضافة المحدد إلى خامات ورشتي (${selectedCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
