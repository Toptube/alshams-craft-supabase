import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Tag,
  Ruler,
  Award,
  Scale,
  MessageSquarePlus,
  Save,
  CheckCircle2,
  RefreshCw,
  Banknote,
  TrendingUp,
  Info,
} from 'lucide-react';
import {
  UnifiedMaterialMaster,
  UnifiedMaterialSpec,
  UnifiedMaterialAlias,
  UnifiedBrandRecord,
  UnitChainDef,
  getThreadThicknessOptions,
  isBundleThicknessThread,
  formatThreadThicknessRangeLabel,
} from '../../registry/unifiedMaterialsRegistry';
import { contributeUnifiedMasterApi } from '../../db/unifiedMaterialsService';
import {
  STANDARD_BASE_UNITS,
  UnitEquationStep,
  evaluateUnitEquationChain,
  parseUnitEquationsFromNote,
} from '../../utils/smartUnitEquations';
import {
  getDefaultMarketBasePrice,
  getBrandsAveragePrice,
  resolveEffectiveBrandPrice,
} from '../../utils/unifiedMarketPricing';

export interface MaterialCardSelectionConfig {
  specCode: string;
  brandCode: string;
  kind: 'primary' | 'extra';
  selectedThicknessesMm: number[];
  selectedAliases: string[];
  selectedBrands: string[];
  selectedUnitEquation?: string;
  personalBasePrice?: number;
  personalBrandPrices?: Record<string, number>;
}

type AccordionSection = 'aliases' | 'thicknesses' | 'brands' | 'pricing' | 'units' | 'suggestions' | null;

interface UnifiedMaterialAccordionCardProps {
  master: UnifiedMaterialMaster;
  specs: UnifiedMaterialSpec[];
  aliases: UnifiedMaterialAlias[];
  allBrands: UnifiedBrandRecord[];
  chainDef?: UnitChainDef;
  categoryLabel: string;
  customDisplayName?: string;
  savedMemberPricing?: {
    personalBasePrice?: number;
    personalBrandPrices?: Record<string, number>;
  };
  mode: 'artisan' | 'supplier';
  actorId: string;
  actorName: string;
  alreadyOwned: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  activeCfg: MaterialCardSelectionConfig;
  onToggleCheckbox: () => void;
  onToggleExpand: () => void;
  onUpdateDraft: (patch: Partial<MaterialCardSelectionConfig>) => void;
  onSaveCardSelection: () => void;
  onSaveExistingOwnedPreferences?: (cfg: MaterialCardSelectionConfig) => void;
  onContributionSaved: () => Promise<void> | void;
  onToast: (msg: string) => void;
}

export const UnifiedMaterialAccordionCard: React.FC<UnifiedMaterialAccordionCardProps> = ({
  master,
  specs,
  aliases,
  allBrands,
  chainDef,
  categoryLabel,
  customDisplayName,
  savedMemberPricing,
  mode,
  actorId,
  actorName,
  alreadyOwned,
  isSelected,
  isExpanded,
  activeCfg,
  onToggleCheckbox,
  onToggleExpand,
  onUpdateDraft,
  onSaveCardSelection,
  onSaveExistingOwnedPreferences,
  onContributionSaved,
  onToast,
}) => {
  const [openSection, setOpenSection] = useState<AccordionSection>('aliases');

  // Pending direct additions to the global Unified Materials DB
  const [pendingAliases, setPendingAliases] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');

  const [pendingThicknesses, setPendingThicknesses] = useState<number[]>([]);
  const [newThicknessInput, setNewThicknessInput] = useState('');

  const [pendingSpecLabels, setPendingSpecLabels] = useState<string[]>([]);
  const [newSpecLabelInput, setNewSpecLabelInput] = useState('');

  const [pendingBrands, setPendingBrands] = useState<string[]>([]);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [newBrandPriceInput, setNewBrandPriceInput] = useState('');

  // Track if user actively edited or cleared personal market/brand prices in this session
  const [dirtyPriceObservation, setDirtyPriceObservation] = useState(false);
  const [clearedBasePrice, setClearedBasePrice] = useState(false);

  // Smart Multi-Step Unit Conversion Equation Builder
  const [unitSteps, setUnitSteps] = useState<UnitEquationStep[]>([
    { fromUnit: '', multiplier: 1, toUnit: '' },
  ]);
  const [pendingUnitEquations, setPendingUnitEquations] = useState<
    Array<{ formulaAr: string; topUnit: string; baseUnitAr: string; totalInBaseUnit: number }>
  >([]);

  // Advisory suggestion note (ONLY sent to Super Admin, never written into master DB fields)
  const [suggestionNote, setSuggestionNote] = useState('');
  const [savingContribution, setSavingContribution] = useState(false);
  const [contributionSavedBanner, setContributionSavedBanner] = useState<string | null>(null);

  const isBundledThread = isBundleThicknessThread(master);

  // Merge seeded/master thicknesses + any specs with thicknessMm + pending additions
  const allAvailableThicknesses = useMemo(() => {
    const base = isBundledThread ? getThreadThicknessOptions(master.code, master) : [];
    const fromSpecs = specs
      .map((s) => Number(s.thicknessMm))
      .filter((n) => Number.isFinite(n) && n > 0);
    return Array.from(new Set([...base, ...fromSpecs, ...pendingThicknesses])).sort((a, b) => a - b);
  }, [isBundledThread, master, specs, pendingThicknesses]);

  // All aliases (canonical aliases + table aliases + pending new aliases)
  const allAvailableAliases = useMemo(() => {
    const raw = [
      ...(master.artistAliases || []),
      ...(master.supplierAliases || []),
      ...aliases.map((a) => a.aliasName),
      ...pendingAliases,
    ]
      .map((s) => String(s || '').trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
      const k = item.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(item);
      }
    }
    return out;
  }, [master.artistAliases, master.supplierAliases, aliases, pendingAliases]);

  // All brands associated with this material + pending new brands
  const allAvailableBrands = useMemo(() => {
    const raw = [...(master.defaultBrands || []), ...pendingBrands]
      .map((s) => String(s || '').trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of raw) {
      const k = b.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(b);
      }
    }
    return out;
  }, [master.defaultBrands, pendingBrands]);

  // Saved unit conversion equations from master.unitNote + pending new equations
  const allUnitEquations = useMemo(() => {
    const existing = parseUnitEquationsFromNote(master.unitNote);
    const pendingStrs = pendingUnitEquations.map((e) => e.formulaAr);
    return Array.from(new Set([...existing, ...pendingStrs]));
  }, [master.unitNote, pendingUnitEquations]);

  // Market & Brand Pricing Computations
  const primaryUnitLabel = chainDef?.defaultPrimaryUnit || 'وحدة';
  const officialMarketBasePrice = useMemo(
    () => (Number(master.marketBasePrice) > 0 ? Number(master.marketBasePrice) : getDefaultMarketBasePrice(master)),
    [master]
  );
  const brandsAvgPrice = useMemo(() => getBrandsAveragePrice(master), [master]);
  const effectivePersonalBrandPrices = useMemo<Record<string, number>>(
    () => ({
      ...(savedMemberPricing?.personalBrandPrices || {}),
      ...(activeCfg.personalBrandPrices || {}),
    }),
    [savedMemberPricing?.personalBrandPrices, activeCfg.personalBrandPrices]
  );
  const effectivePersonalBasePrice = clearedBasePrice
    ? undefined
    : activeCfg.personalBasePrice !== undefined
    ? activeCfg.personalBasePrice
    : savedMemberPricing?.personalBasePrice;

  // Live effective starting price that will be used in "خاماتي" / catalog (zero ambiguity!)
  const headerEffectivePriceInfo = useMemo(() => {
    if (effectivePersonalBasePrice && effectivePersonalBasePrice > 0) {
      return { price: effectivePersonalBasePrice, label: 'سعرك', isPersonal: true };
    }
    const firstSelectedBrand = (activeCfg.selectedBrands || [])[0];
    if (firstSelectedBrand) {
      const resolved = resolveEffectiveBrandPrice(
        master,
        firstSelectedBrand,
        effectivePersonalBrandPrices,
        effectivePersonalBasePrice
      );
      return {
        price: resolved.price,
        label: resolved.source === 'personal' ? `سعرك (${firstSelectedBrand})` : firstSelectedBrand,
        isPersonal: resolved.source === 'personal',
      };
    }
    return { price: officialMarketBasePrice, label: 'متوسط السوق', isPersonal: false };
  }, [effectivePersonalBasePrice, activeCfg.selectedBrands, master, effectivePersonalBrandPrices, officialMarketBasePrice]);

  const priceSourceLabelAr =
    master.priceSource === 'super_admin'
      ? 'اعتماد السوبر أدمن'
      : master.priceSource === 'auto_average'
      ? `متوسط تلقائي (${master.priceObservationsCount || 2}+ عضو)`
      : 'متوسط السوق المبدئي';

  // Live evaluation of the smart multi-step unit chain builder
  const evaluatedChain = useMemo(() => evaluateUnitEquationChain(unitSteps), [unitSteps]);

  // Does the user have any unsaved DB contributions, typed inputs, price observations, or suggestion notes?
  const hasPendingContributions =
    pendingAliases.length > 0 ||
    pendingThicknesses.length > 0 ||
    pendingSpecLabels.length > 0 ||
    pendingBrands.length > 0 ||
    pendingUnitEquations.length > 0 ||
    newAliasInput.trim().length > 0 ||
    newThicknessInput.trim().length > 0 ||
    newSpecLabelInput.trim().length > 0 ||
    newBrandInput.trim().length > 0 ||
    dirtyPriceObservation ||
    suggestionNote.trim().length > 0;

  const toggleAccordion = (sec: AccordionSection) => {
    setOpenSection((prev) => (prev === sec ? null : sec));
  };

  // Toggle selection of a single alias
  const toggleSelectAlias = (al: string) => {
    const current = activeCfg.selectedAliases || [];
    const next = current.includes(al) ? current.filter((x) => x !== al) : [...current, al];
    onUpdateDraft({ selectedAliases: next });
  };

  const handleQueueNewAlias = () => {
    const clean = newAliasInput.trim();
    if (!clean) return;
    if (!allAvailableAliases.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      setPendingAliases((prev) => [...prev, clean]);
    }
    if (!(activeCfg.selectedAliases || []).includes(clean)) {
      onUpdateDraft({ selectedAliases: [...(activeCfg.selectedAliases || []), clean] });
    }
    setNewAliasInput('');
    setContributionSavedBanner(null);
  };

  // Toggle selection of a single thickness
  const toggleSelectThickness = (th: number) => {
    const current =
      activeCfg.selectedThicknessesMm && activeCfg.selectedThicknessesMm.length > 0
        ? activeCfg.selectedThicknessesMm
        : allAvailableThicknesses;
    const exists = current.includes(th);
    const next = exists ? current.filter((x) => x !== th) : [...current, th].sort((a, b) => a - b);
    onUpdateDraft({ selectedThicknessesMm: next });
  };

  const handleQueueNewThickness = () => {
    const num = Number(newThicknessInput.replace(',', '.').trim());
    if (!Number.isFinite(num) || num <= 0 || num > 200) {
      onToast('أدخل رقم سمك صحيح بالمللي (مثل: 1.5 أو 7 أو 9)');
      return;
    }
    if (!allAvailableThicknesses.includes(num)) {
      setPendingThicknesses((prev) => [...prev, num]);
    }
    const baseSelected =
      activeCfg.selectedThicknessesMm && activeCfg.selectedThicknessesMm.length > 0
        ? activeCfg.selectedThicknessesMm
        : allAvailableThicknesses;
    if (!baseSelected.includes(num)) {
      onUpdateDraft({ selectedThicknessesMm: [...baseSelected, num].sort((a, b) => a - b) });
    }
    setNewThicknessInput('');
    setContributionSavedBanner(null);
  };

  const handleQueueNewSpecLabel = () => {
    const clean = newSpecLabelInput.trim();
    if (!clean) return;
    if (!pendingSpecLabels.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setPendingSpecLabels((prev) => [...prev, clean]);
    }
    setNewSpecLabelInput('');
    setContributionSavedBanner(null);
  };

  // Toggle selection of a brand
  const toggleSelectBrand = (br: string) => {
    const current = activeCfg.selectedBrands || [];
    const next = current.includes(br) ? current.filter((x) => x !== br) : [...current, br];
    onUpdateDraft({ selectedBrands: next });
  };

  const handleQueueNewBrand = () => {
    const clean = newBrandInput.trim();
    if (!clean) return;
    if (!allAvailableBrands.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      setPendingBrands((prev) => [...prev, clean]);
    }
    const nextBrands = (activeCfg.selectedBrands || []).includes(clean)
      ? activeCfg.selectedBrands || []
      : [...(activeCfg.selectedBrands || []), clean];
    const parsedPrice = Number(newBrandPriceInput.replace(',', '.').trim());
    const nextPersonalBrandPrices = { ...effectivePersonalBrandPrices };
    if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
      nextPersonalBrandPrices[clean] = parsedPrice;
      setDirtyPriceObservation(true);
    }
    onUpdateDraft({
      selectedBrands: nextBrands,
      personalBrandPrices: nextPersonalBrandPrices,
    });
    setNewBrandInput('');
    setNewBrandPriceInput('');
    setContributionSavedBanner(null);
  };

  const handleUpdatePersonalBrandPrice = (brandName: string, rawVal: string) => {
    const cleaned = rawVal.replace(',', '.').trim();
    const nextMap = { ...effectivePersonalBrandPrices };
    let addedPrice = false;
    if (!cleaned) {
      delete nextMap[brandName];
    } else {
      const n = Number(cleaned);
      if (Number.isFinite(n) && n > 0) {
        nextMap[brandName] = n;
        addedPrice = true;
      }
    }
    // Automatically check this brand when the user enters a personal price for it
    const currBrands = activeCfg.selectedBrands || [];
    const nextSelectedBrands =
      addedPrice && !currBrands.includes(brandName) ? [...currBrands, brandName] : currBrands;

    onUpdateDraft({
      personalBrandPrices: nextMap,
      selectedBrands: nextSelectedBrands,
    });
    setDirtyPriceObservation(true);
    setContributionSavedBanner(null);
  };

  const handleUpdatePersonalBasePrice = (rawVal: string) => {
    const cleaned = rawVal.replace(',', '.').trim();
    if (!cleaned) {
      setClearedBasePrice(true);
      onUpdateDraft({ personalBasePrice: undefined });
      return;
    }
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) {
      setClearedBasePrice(false);
      onUpdateDraft({ personalBasePrice: n });
      setDirtyPriceObservation(true);
      setContributionSavedBanner(null);
    }
  };

  // Smart Unit Chain Step Handlers
  const updateUnitStep = (idx: number, patch: Partial<UnitEquationStep>) => {
    setUnitSteps((prev) => {
      const next = prev.map((st, i) => (i === idx ? { ...st, ...patch } : st));
      // Sync next step's fromUnit automatically whenever toUnit changes
      if (patch.toUnit !== undefined && next[idx + 1]) {
        next[idx + 1] = { ...next[idx + 1], fromUnit: patch.toUnit };
      }
      // If the updated step now ends in a recognized standard unit, trim any extra trailing steps
      const partialEval = evaluateUnitEquationChain(next.slice(0, idx + 1));
      if (partialEval.isComplete) {
        return next.slice(0, idx + 1);
      }
      // If this is the last step, has valid multiplier & toUnit, and toUnit is NOT standard -> auto-append next step!
      const curr = next[idx];
      if (
        idx === next.length - 1 &&
        curr.fromUnit.trim() &&
        curr.toUnit.trim() &&
        Number(curr.multiplier) > 0 &&
        partialEval.needsDefinitionForUnit &&
        next.length < 5
      ) {
        return [
          ...next,
          { fromUnit: curr.toUnit.trim(), multiplier: 1, toUnit: '' },
        ];
      }
      return next;
    });
  };

  const handleQueueSmartUnitEquation = () => {
    if (!evaluatedChain.isComplete || !evaluatedChain.formulaAr) {
      onToast('أكمل السلسلة حتى تصل لوحدة قياس قياسية معروفة (مثل: كيلو أو جرام أو متر أو قطعة)');
      return;
    }
    const newEq = {
      formulaAr: evaluatedChain.formulaAr,
      topUnit: evaluatedChain.topUnit,
      baseUnitAr: evaluatedChain.baseUnitAr || 'وحدة',
      totalInBaseUnit: evaluatedChain.totalInBaseUnit || 1,
    };
    setPendingUnitEquations((prev) =>
      prev.some((x) => x.formulaAr === newEq.formulaAr) ? prev : [...prev, newEq]
    );
    onUpdateDraft({ selectedUnitEquation: newEq.formulaAr });
    setUnitSteps([{ fromUnit: '', multiplier: 1, toUnit: '' }]);
    setContributionSavedBanner(null);
    onToast(`✓ تمت إضافة معادلة القياس: ${newEq.formulaAr}`);
  };

  // Direct Save to Global Unified Materials Database + Isolated Personal Price Observations + Super Admin Notification
  // Auto-flushes any text typed in add-inputs even if the user didn't click the small "+ إضافة" button first!
  const handleSaveContributionsToDb = async () => {
    if (!hasPendingContributions) return;

    const finalAliases = [...pendingAliases];
    const typedAlias = newAliasInput.trim();
    if (typedAlias && !allAvailableAliases.some((a) => a.toLowerCase() === typedAlias.toLowerCase())) {
      finalAliases.push(typedAlias);
    }

    const finalThicknesses = [...pendingThicknesses];
    const typedTh = Number(newThicknessInput.replace(',', '.').trim());
    if (
      newThicknessInput.trim() &&
      Number.isFinite(typedTh) &&
      typedTh > 0 &&
      typedTh <= 200 &&
      !allAvailableThicknesses.includes(typedTh)
    ) {
      finalThicknesses.push(typedTh);
    }

    const finalSpecLabels = [...pendingSpecLabels];
    const typedSpec = newSpecLabelInput.trim();
    if (typedSpec && !finalSpecLabels.some((s) => s.toLowerCase() === typedSpec.toLowerCase())) {
      finalSpecLabels.push(typedSpec);
    }

    const finalBrands = [...pendingBrands];
    const finalPersonalBrandPrices = { ...effectivePersonalBrandPrices };
    let hasBrandPriceAddition = dirtyPriceObservation;
    const typedBrand = newBrandInput.trim();
    if (typedBrand) {
      if (!allAvailableBrands.some((b) => b.toLowerCase() === typedBrand.toLowerCase())) {
        finalBrands.push(typedBrand);
      }
      const typedBrandPrice = Number(newBrandPriceInput.replace(',', '.').trim());
      if (Number.isFinite(typedBrandPrice) && typedBrandPrice > 0) {
        finalPersonalBrandPrices[typedBrand] = typedBrandPrice;
        hasBrandPriceAddition = true;
      }
    }

    setSavingContribution(true);
    setContributionSavedBanner(null);
    try {
      const res = await contributeUnifiedMasterApi(master.code, {
        newAliases: finalAliases,
        newThicknessesMm: finalThicknesses,
        newSpecLabels: finalSpecLabels,
        newBrands: finalBrands,
        newUnitEquations: pendingUnitEquations,
        personalBasePrice: hasBrandPriceAddition ? effectivePersonalBasePrice : undefined,
        personalBrandPrices:
          hasBrandPriceAddition && Object.keys(finalPersonalBrandPrices).length > 0
            ? finalPersonalBrandPrices
            : undefined,
        suggestionNote: suggestionNote.trim() || undefined,
        actorRole: mode,
        actorId,
        actorName,
      });

      if (!res.success) {
        onToast(res.error || 'تعذر حفظ التعديلات في قاعدة البيانات');
        return;
      }

      const savedPricesToo = hasBrandPriceAddition;
      setPendingAliases([]);
      setNewAliasInput('');
      setPendingThicknesses([]);
      setNewThicknessInput('');
      setPendingSpecLabels([]);
      setNewSpecLabelInput('');
      setPendingBrands([]);
      setNewBrandInput('');
      setNewBrandPriceInput('');
      setPendingUnitEquations([]);
      setDirtyPriceObservation(false);
      setSuggestionNote('');
      setContributionSavedBanner(
        savedPricesToo
          ? '✓ تم حفظ التعديلات وتسجيل سعرك الخاص لورشتك فقط وإرسال رصد السعر والإشعار للسوبر أدمن (دون تغيير السعر العام تلقائياً)'
          : '✓ تم حفظ التعديلات مباشرة في قاعدة بيانات منظومة الخامات وإرسال إشعار للسوبر أدمن'
      );
      onToast(`✓ تم حفظ تعديلات «${customDisplayName || master.canonicalName}» وإبلاغ السوبر أدمن بنجاح`);
      await onContributionSaved();
    } finally {
      setSavingContribution(false);
    }
  };

  const effectiveSelectedThicknesses =
    activeCfg.selectedThicknessesMm && activeCfg.selectedThicknessesMm.length > 0
      ? activeCfg.selectedThicknessesMm
      : allAvailableThicknesses;

  const displayName = customDisplayName || master.canonicalName;

  return (
    <div
      className={`rounded-2xl p-3.5 border transition-all duration-150 space-y-2.5 ${
        isExpanded
          ? 'md:col-span-2 bg-amber-50/60 dark:bg-[#162547] border-[#EA580C] ring-1 ring-[#EA580C]/50 shadow-md'
          : alreadyOwned
          ? 'bg-sky-50/70 dark:bg-sky-950/25 border-sky-300/80 dark:border-sky-800/70'
          : isSelected
          ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-500 ring-1 ring-emerald-500/70 shadow-sm'
          : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]/60'
      }`}
    >
      {/* Card Header: Checkbox NEVER auto-closes; Expand button ALWAYS opens card cleanly */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Independent Checkmark Toggle (NEVER closes the card!) */}
          <button
            type="button"
            disabled={alreadyOwned}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheckbox();
            }}
            title={
              alreadyOwned
                ? 'موجودة بالفعل في خاماتك — يمكنك فتح الكارت لتخصيصها أو إضافة مواصفات جديدة'
                : isSelected
                ? 'إلغاء تحديد الخامة'
                : 'تحديد الخامة (بدون إغلاق الكارت حتى تختار تفاصيلها براحتك)'
            }
            className={`mt-0.5 w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition cursor-pointer ${
              alreadyOwned
                ? 'bg-sky-600 text-white cursor-default'
                : isSelected
                ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                : 'border-2 border-[#CBD5E1] dark:border-[#475569] hover:border-[#EA580C] bg-white dark:bg-[#0D162E]'
            }`}
          >
            {(alreadyOwned || isSelected) && <Check className="w-3.5 h-3.5" />}
          </button>

          {/* Clicking Title Expands/Collapses In-Place */}
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-right flex-1 min-w-0 cursor-pointer group space-y-1"
          >
            <div className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA] group-hover:text-[#EA580C] dark:group-hover:text-[#FBBF24] transition">
              {displayName}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#C2410C] dark:text-amber-300">
                {categoryLabel}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                  activeCfg.kind === 'extra'
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                }`}
              >
                {activeCfg.kind === 'extra' ? 'فرعية / إضافية' : 'أساسية'}
              </span>
              {allAvailableThicknesses.length > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-400/40 text-[10px] font-black">
                  السماكات: {formatThreadThicknessRangeLabel(allAvailableThicknesses)}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-black font-mono tabular-nums ${
                  headerEffectivePriceInfo.isPersonal
                    ? 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40'
                    : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                }`}
              >
                {headerEffectivePriceInfo.label}: {headerEffectivePriceInfo.price} ج.م / {primaryUnitLabel}
              </span>
              {alreadyOwned && (
                <span className="px-1.5 py-0.5 rounded bg-sky-600/15 text-sky-800 dark:text-sky-200 text-[10px] font-black">
                  موجودة بخاماتي ✓
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Expand / Collapse Trigger */}
        <button
          type="button"
          onClick={onToggleExpand}
          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black shrink-0 inline-flex items-center gap-1 transition active:scale-95 cursor-pointer border ${
            isExpanded
              ? 'bg-[#0C1427] text-[#FBBF24] border-[#0C1427]'
              : 'bg-[#EFE9DC] dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
          }`}
        >
          <span>{isExpanded ? 'طيّ الكارت' : alreadyOwned ? 'تعديل / تفاصيل' : 'فتح التفاصيل'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ================================================================= */}
      {/* EXPANDED INTERACTIVE ACCORDION PANEL (IN-PLACE, ZERO NAVIGATION!) */}
      {/* ================================================================= */}
      {isExpanded && (
        <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] space-y-2 text-[11px] animate-in fade-in duration-150">
          {/* Success banner after saving direct contributions to DB */}
          {contributionSavedBanner && (
            <div className="p-2.5 rounded-xl bg-emerald-600/15 border border-emerald-500/50 text-emerald-900 dark:text-emerald-200 font-black flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{contributionSavedBanner}</span>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* ACCORDION 1: المسميات الدارجة والتجارية (أول بند بعد اسم الخامة) */}
          {/* --------------------------------------------------------------- */}
          <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('aliases')}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-right font-black text-xs hover:bg-[#F7F3EA] dark:hover:bg-[#132040] transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                <Tag className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>المسميات الدارجة والتجارية للصنف</span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#EFE9DC] dark:bg-[#1B2B50] text-[10px] font-mono">
                  {allAvailableAliases.length}
                </span>
                {pendingAliases.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                    +{pendingAliases.length} جديد
                  </span>
                )}
              </span>
              {openSection === 'aliases' ? <ChevronUp className="w-4 h-4 text-[#EA580C]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
            </button>

            {openSection === 'aliases' && (
              <div className="p-3 pt-1 border-t border-[#EFE9DC] dark:border-[#1E2E52] space-y-2.5">
                <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  علّم على المسميات التي تعمل بها في ورشتك أو سوقك، أو أضف مسمى جديداً يُضاف مباشرة لمنظومة الخامات:
                </p>
                {allAvailableAliases.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {allAvailableAliases.map((al) => {
                      const checked = (activeCfg.selectedAliases || []).includes(al);
                      const isNew = pendingAliases.includes(al);
                      return (
                        <button
                          key={al}
                          type="button"
                          onClick={() => toggleSelectAlias(al)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                            checked
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-[#F7F3EA] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                              checked ? 'border-white bg-white/20' : 'border-[#94A3B8]'
                            }`}
                          >
                            {checked && <Check className="w-2.5 h-2.5" />}
                          </span>
                          <span>{al}</span>
                          {isNew && <span className="text-[9px] px-1 rounded bg-amber-400 text-[#0C1427] font-black">جديد</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-[#64748B] font-bold">
                    لا توجد مسميات إضافية مسجلة بعد — يمكنك إضافة مسمى دارج جديد بالأسفل.
                  </div>
                )}

                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newAliasInput}
                    onChange={(e) => setNewAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQueueNewAlias();
                      }
                    }}
                    placeholder="أضف مسمى دارج أو تجاري جديد لهذا الصنف..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-bold text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleQueueNewAlias}
                    disabled={!newAliasInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* ACCORDION 2: السماكات والمقاسات المتاحة                          */}
          {/* --------------------------------------------------------------- */}
          <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('thicknesses')}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-right font-black text-xs hover:bg-[#F7F3EA] dark:hover:bg-[#132040] transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                <Ruler className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>{allAvailableThicknesses.length > 0 ? 'السماكات المتاحة للصنف (مم)' : 'المقاسات والمواصفات الفرعية'}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#EFE9DC] dark:bg-[#1B2B50] text-[10px] font-mono">
                  {allAvailableThicknesses.length > 0 ? allAvailableThicknesses.length : specs.length + pendingSpecLabels.length}
                </span>
                {(pendingThicknesses.length > 0 || pendingSpecLabels.length > 0) && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                    +{pendingThicknesses.length + pendingSpecLabels.length} جديد
                  </span>
                )}
              </span>
              {openSection === 'thicknesses' ? <ChevronUp className="w-4 h-4 text-[#EA580C]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
            </button>

            {openSection === 'thicknesses' && (
              <div className="p-3 pt-1 border-t border-[#EFE9DC] dark:border-[#1E2E52] space-y-2.5">
                {allAvailableThicknesses.length > 0 || master.prefix === 'TH' ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                        علّم على السماكات التي تستخدمها فقط (أو اختر الكل)، وأضف أي سمك ناقص ليُحفظ في منظومة الخامات:
                      </p>
                      {allAvailableThicknesses.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateDraft({
                              selectedThicknessesMm:
                                effectiveSelectedThicknesses.length === allAvailableThicknesses.length
                                  ? [allAvailableThicknesses[0]]
                                  : [...allAvailableThicknesses],
                            })
                          }
                          className="text-[10px] font-black text-[#EA580C] hover:underline cursor-pointer"
                        >
                          {effectiveSelectedThicknesses.length === allAvailableThicknesses.length
                            ? 'تحديد واحد فقط'
                            : `تحديد كل السماكات (${allAvailableThicknesses.length})`}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {allAvailableThicknesses.map((th) => {
                        const checked = effectiveSelectedThicknesses.includes(th);
                        const isNew = pendingThicknesses.includes(th);
                        return (
                          <button
                            key={th}
                            type="button"
                            onClick={() => toggleSelectThickness(th)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-black font-mono inline-flex items-center gap-1.5 cursor-pointer transition ${
                              checked
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-[#F7F3EA] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                                checked ? 'border-white bg-white/20' : 'border-[#94A3B8]'
                              }`}
                            >
                              {checked && <Check className="w-2.5 h-2.5" />}
                            </span>
                            <span>{th} مم</span>
                            {isNew && <span className="text-[9px] px-1 rounded bg-amber-400 text-[#0C1427]">جديد</span>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="200"
                        value={newThicknessInput}
                        onChange={(e) => setNewThicknessInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQueueNewThickness();
                          }
                        }}
                        placeholder="أضف سمك جديد بالمللي (مثل: 1.5 أو 7 أو 14)..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-bold text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={handleQueueNewThickness}
                        disabled={!newThicknessInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة سمك</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="font-bold shrink-0">المواصفة المختارة:</label>
                      <select
                        value={activeCfg.specCode}
                        onChange={(e) => onUpdateDraft({ specCode: e.target.value })}
                        className="flex-1 min-w-[150px] px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                      >
                        <option value="">الكل / الخامة كاملة (الافتراضي)</option>
                        {specs.map((sp) => (
                          <option key={sp.specCode} value={sp.specCode}>
                            {sp.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {pendingSpecLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pendingSpecLabels.map((lbl) => (
                          <span
                            key={lbl}
                            className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 font-bold"
                          >
                            + {lbl} (سيُحفظ للمنظومة)
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newSpecLabelInput}
                        onChange={(e) => setNewSpecLabelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQueueNewSpecLabel();
                          }
                        }}
                        placeholder="أضف مقاس أو مواصفة جديدة للصنف..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-bold text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={handleQueueNewSpecLabel}
                        disabled={!newSpecLabelInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* ACCORDION 3: الماركات والشركات المنتجة وأسعارها                 */}
          {/* --------------------------------------------------------------- */}
          <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('brands')}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-right font-black text-xs hover:bg-[#F7F3EA] dark:hover:bg-[#132040] transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                <Award className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>الماركات والشركات المنتجة وأسعارها</span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#EFE9DC] dark:bg-[#1B2B50] text-[10px] font-mono">
                  {allAvailableBrands.length}
                </span>
                {pendingBrands.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                    +{pendingBrands.length} جديد
                  </span>
                )}
              </span>
              {openSection === 'brands' ? <ChevronUp className="w-4 h-4 text-[#EA580C]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
            </button>

            {openSection === 'brands' && (
              <div className="p-3 pt-1 border-t border-[#EFE9DC] dark:border-[#1E2E52] space-y-2.5">
                <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                  الماركة تتحكم في السعر حتى لنفس الخامة — أي ماركة بدون سعر مسجّل تأخذ تلقائياً <strong className="text-[#0C1427] dark:text-white">سعراً اعتبارياً</strong> (متوسط الماركات الأخرى لنفس الخامة أو متوسط السوق). تعديلك للسعر يُحفظ لورشتك فقط ويُرسل كرصد للسوبر أدمن.
                </p>

                {mode === 'supplier' && (
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <label className="font-bold shrink-0">ماركة الكود التجاري (SKU):</label>
                    <select
                      value={activeCfg.brandCode}
                      onChange={(e) => onUpdateDraft({ brandCode: e.target.value })}
                      className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      {allBrands.map((b) => (
                        <option key={b.brandCode} value={b.brandCode}>
                          {b.brandName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {allAvailableBrands.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {allAvailableBrands.map((br) => {
                      const checked = (activeCfg.selectedBrands || []).includes(br);
                      const isNew = pendingBrands.includes(br);
                      const resolved = resolveEffectiveBrandPrice(
                        master,
                        br,
                        effectivePersonalBrandPrices,
                        effectivePersonalBasePrice
                      );
                      const isFallback =
                        resolved.source === 'brands_average_fallback' ||
                        resolved.source === 'market_base_fallback';
                      const personalVal = effectivePersonalBrandPrices[br];

                      return (
                        <div
                          key={br}
                          className={`p-2 rounded-xl border transition flex items-center justify-between gap-2 ${
                            checked
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/70'
                              : 'bg-[#F7F3EA] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSelectBrand(br)}
                            className="flex items-start gap-1.5 text-right flex-1 min-w-0 cursor-pointer"
                          >
                            <span
                              className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                                checked
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-[#94A3B8] bg-white dark:bg-[#0D162E]'
                              }`}
                            >
                              {checked && <Check className="w-2.5 h-2.5" />}
                            </span>
                            <div className="min-w-0">
                              <div className="font-black text-[11px] text-[#0C1427] dark:text-[#F7F3EA] truncate flex items-center gap-1">
                                <span>{br}</span>
                                {isNew && (
                                  <span className="text-[9px] px-1 rounded bg-amber-400 text-[#0C1427] font-black">
                                    جديد
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span
                                  className={`text-[10px] font-mono font-black ${
                                    resolved.source === 'personal'
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : isFallback
                                      ? 'text-amber-700 dark:text-amber-300'
                                      : 'text-[#0C1427] dark:text-[#F7F3EA]'
                                  }`}
                                >
                                  {resolved.price} ج.م
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                    resolved.source === 'personal'
                                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                                      : isFallback
                                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                                      : 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
                                  }`}
                                >
                                  {resolved.sourceLabelAr}
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={personalVal ?? ''}
                              onChange={(e) => handleUpdatePersonalBrandPrice(br, e.target.value)}
                              placeholder={String(resolved.price)}
                              title={`أدخل سعرك الخاص لماركة ${br} (ج.م / ${primaryUnitLabel})`}
                              className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-mono font-black text-[11px] text-center"
                            />
                            <span className="text-[9px] font-bold text-[#64748B]">ج.م</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-[#64748B] font-bold">
                    لا توجد ماركات مسجلة لهذا الصنف بعد — أضف ماركة جديدة بالأسفل مع سعرها لتُحفظ في المنظومة.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newBrandInput}
                    onChange={(e) => setNewBrandInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQueueNewBrand();
                      }
                    }}
                    placeholder="أضف اسم ماركة أو مصنع جديد (مثل: أليز، ناكو، مصنع السلام)..."
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-bold text-[11px]"
                  />
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={newBrandPriceInput}
                    onChange={(e) => setNewBrandPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQueueNewBrand();
                      }
                    }}
                    placeholder={`السعر (ج.م)`}
                    className="w-24 px-2 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-mono font-bold text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleQueueNewBrand}
                    disabled={!newBrandInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-45 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة ماركة</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* ACCORDION 4: السعر المبدئي ومتوسط السوق (سعرك الخاص منفصل)       */}
          {/* --------------------------------------------------------------- */}
          <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('pricing')}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-right font-black text-xs hover:bg-[#F7F3EA] dark:hover:bg-[#132040] transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>السعر المبدئي ومتوسط السوق</span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono">
                  {officialMarketBasePrice} ج.م / {primaryUnitLabel}
                </span>
                {dirtyPriceObservation && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px]">
                    تعديل سعر جاهز للحفظ
                  </span>
                )}
              </span>
              {openSection === 'pricing' ? <ChevronUp className="w-4 h-4 text-[#EA580C]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
            </button>

            {openSection === 'pricing' && (
              <div className="p-3 pt-2 border-t border-[#EFE9DC] dark:border-[#1E2E52] space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                    <div className="text-[10px] font-bold text-[#64748B] flex items-center justify-between">
                      <span>سعر السوق العام (المرجعي)</span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-800 dark:text-sky-200 text-[9px] font-black">
                        {priceSourceLabelAr}
                      </span>
                    </div>
                    <div className="text-sm font-black font-mono tabular-nums text-[#0C1427] dark:text-[#F7F3EA] mt-1">
                      {officialMarketBasePrice} <span className="text-[10px] font-bold">ج.م / {primaryUnitLabel}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                    <div className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-[#EA580C]" />
                      <span>متوسط أسعار الماركات (السعر الاعتباري)</span>
                    </div>
                    <div className="text-sm font-black font-mono tabular-nums text-[#C2410C] dark:text-[#FBBF24] mt-1">
                      {brandsAvgPrice} <span className="text-[10px] font-bold">ج.م / {primaryUnitLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-500/40 space-y-1.5">
                  <label className="block text-[11px] font-black text-emerald-950 dark:text-emerald-200">
                    سعرك الخاص المبدئي في «{mode === 'supplier' ? 'كتالوجك' : 'خاماتك'}» (ج.م / {primaryUnitLabel}):
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={effectivePersonalBasePrice ?? ''}
                      onChange={(e) => handleUpdatePersonalBasePrice(e.target.value)}
                      placeholder={`السعر الافتراضي: ${officialMarketBasePrice} ج.م`}
                      className="flex-1 min-w-[150px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border border-emerald-500/50 focus:border-[#EA580C] outline-none font-mono font-black text-xs"
                    />
                    {effectivePersonalBasePrice !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearedBasePrice(true);
                          onUpdateDraft({ personalBasePrice: undefined });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[10px] font-bold cursor-pointer hover:border-[#EA580C]"
                      >
                        استخدام متوسط السوق
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/25 border border-amber-400/40 text-[10px] font-bold text-amber-950 dark:text-amber-200 flex items-start gap-1.5 leading-relaxed">
                  <Info className="w-3.5 h-3.5 text-[#EA580C] shrink-0 mt-0.5" />
                  <span>
                    تعديلك للسعر يُحفظ لك وحدك لأن الأسعار تختلف بين الجملة والمصنع والأونلاين والمناطق، ولا يغيّر السعر المرجعي العام للمنظومة إلا باعتماد السوبر أدمن أو عبر التحديث الدوري التلقائي لمتوسط أسعار الأعضاء المشاركين.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* ACCORDION 4: وحدات القياس ودوال التحويل الذكية                   */}
          {/* --------------------------------------------------------------- */}
          <div className="rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion('units')}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-right font-black text-xs hover:bg-[#F7F3EA] dark:hover:bg-[#132040] transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                <Scale className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>وحدات القياس ودوال التحويل الذكية</span>
                {chainDef && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#EFE9DC] dark:bg-[#1B2B50] text-[10px] font-bold">
                    {chainDef.defaultPrimaryUnit} ⇠ {chainDef.defaultSubUnit}
                  </span>
                )}
                {pendingUnitEquations.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                    +{pendingUnitEquations.length} معادلة
                  </span>
                )}
              </span>
              {openSection === 'units' ? <ChevronUp className="w-4 h-4 text-[#EA580C]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
            </button>

            {openSection === 'units' && (
              <div className="p-3 pt-2 border-t border-[#EFE9DC] dark:border-[#1E2E52] space-y-2.5">
                {chainDef && (
                  <div className="p-2 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC]/70 dark:border-[#22355E] text-[10px] font-bold text-[#334155] dark:text-[#CBD5E1]">
                    السلسلة القياسية المعتمدة: <strong className="text-[#0C1427] dark:text-white">{chainDef.titleAr}</strong> ({chainDef.supplierFlow})
                  </div>
                )}

                {allUnitEquations.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-[#475569] dark:text-[#94A3B8]">
                      معادلات القياس المسجلة لهذا الصنف:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allUnitEquations.map((eq) => {
                        const selected = activeCfg.selectedUnitEquation === eq;
                        return (
                          <button
                            key={eq}
                            type="button"
                            onClick={() =>
                              onUpdateDraft({ selectedUnitEquation: selected ? undefined : eq })
                            }
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-black cursor-pointer transition ${
                              selected
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                            }`}
                          >
                            {eq}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Smart Interactive Equation Builder */}
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-[#132040] border border-amber-400/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>بناء دالة قياس ذكية (مثال: 1 طرد = 5 ربطة ⇠ 1 ربطة = 5 كيلو = 25,000 جرام)</span>
                  </div>

                  <div className="space-y-2">
                    {unitSteps.map((step, idx) => (
                      <div key={idx} className="space-y-1">
                        {idx > 0 && (
                          <div className="text-[10px] font-black text-amber-800 dark:text-amber-300">
                            البرنامج يحتاج تعريف «{step.fromUnit}» بوحدة قياس قياسية معروفة (مثل كيلو، جرام، متر، قطعة):
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-1.5 rounded-lg bg-[#0C1427] text-[#FBBF24] font-mono font-black text-[11px]">
                            1
                          </span>
                          <input
                            type="text"
                            value={step.fromUnit}
                            readOnly={idx > 0}
                            onChange={(e) => updateUnitStep(idx, { fromUnit: e.target.value })}
                            placeholder={idx === 0 ? 'الوحدة الكبيرة (مثل: طرد)' : step.fromUnit}
                            className={`w-28 sm:w-32 px-2 py-1.5 rounded-lg border text-[11px] font-bold outline-none ${
                              idx > 0
                                ? 'bg-[#EFE9DC] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1]'
                                : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C]'
                            }`}
                          />
                          <span className="font-black text-sm text-[#EA580C]">=</span>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={step.multiplier || ''}
                            onChange={(e) => updateUnitStep(idx, { multiplier: Number(e.target.value) })}
                            placeholder="العدد"
                            className="w-20 px-2 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-mono font-black text-[11px]"
                          />
                          <input
                            type="text"
                            list={`std-units-list-${master.code}-${idx}`}
                            value={step.toUnit}
                            onChange={(e) => updateUnitStep(idx, { toUnit: e.target.value })}
                            placeholder={idx === 0 ? 'مثل: ربطة أو كيلو' : 'اختر: كيلو / جرام / متر...'}
                            className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-bold text-[11px]"
                          />
                          <datalist id={`std-units-list-${master.code}-${idx}`}>
                            {STANDARD_BASE_UNITS.map((u) => (
                              <option key={u.id} value={u.labelAr} />
                            ))}
                          </datalist>
                        </div>

                        {/* Quick-pick international standard units on the active last row */}
                        {idx === unitSteps.length - 1 && !evaluatedChain.isComplete && (
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            <span className="text-[9px] font-bold text-[#64748B]">وحدات قياسية سريعة:</span>
                            {['كيلو', 'جرام', 'متر', 'سم', 'لتر', 'ملليلتر', 'قطعة', 'دستة'].map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => updateUnitStep(idx, { toUnit: u })}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-[10px] font-bold cursor-pointer"
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Live Computed Chain Result */}
                  {evaluatedChain.formulaAr && (
                    <div
                      className={`p-2 rounded-lg border text-[11px] font-black flex flex-wrap items-center justify-between gap-2 ${
                        evaluatedChain.isComplete
                          ? 'bg-emerald-600/15 border-emerald-500/50 text-emerald-900 dark:text-emerald-200'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-200'
                      }`}
                    >
                      <span>
                        {evaluatedChain.isComplete ? '✓ المعادلة مكتملة: ' : '⏳ قيد الاستكمال: '}
                        <span className="font-mono">{evaluatedChain.formulaAr}</span>
                      </span>
                      {evaluatedChain.isComplete && (
                        <button
                          type="button"
                          onClick={handleQueueSmartUnitEquation}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer transition"
                        >
                          + إضافة المعادلة للصنف
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* ACCORDION 5: مقترحات ورسالة للسوبر أدمن (تظهر بوضوح مع أي تعديل)  */}
          {/* --------------------------------------------------------------- */}
          <div
            className={`rounded-xl border overflow-hidden ${
              hasPendingContributions
                ? 'border-[#EA580C] bg-amber-50/80 dark:bg-amber-950/25'
                : 'border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E]'
            }`}
          >
            <button
              type="button"
              onClick={() => toggleAccordion('suggestions')}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-right font-black text-xs hover:bg-[#F7F3EA] dark:hover:bg-[#132040] transition cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 text-[#0C1427] dark:text-[#F7F3EA]">
                <MessageSquarePlus className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>مقترحات ورسالة للسوبر أدمن</span>
                {hasPendingContributions && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[#EA580C] text-white text-[9px] font-black">
                    لديك تعديلات جاهزة للحفظ
                  </span>
                )}
              </span>
              {openSection === 'suggestions' || hasPendingContributions ? (
                <ChevronUp className="w-4 h-4 text-[#EA580C]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#64748B]" />
              )}
            </button>

            {(openSection === 'suggestions' || hasPendingContributions) && (
              <div className="p-3 pt-1 border-t border-[#EFE9DC] dark:border-[#1E2E52] space-y-2">
                <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  اكتب هنا أي توضيح أو مقترح للسوبر أدمن حول تعديلاتك — تصل كرسالة مباشرة له مع الإشعار فقط ولا تُضاف لحقول قاعدة البيانات:
                </p>
                <textarea
                  rows={2}
                  value={suggestionNote}
                  onChange={(e) => setSuggestionNote(e.target.value)}
                  placeholder="مثال: أضفت سمك 7 مم ومسمى خيط حبل مكرمية لأنه منتشر في سوق العتبة، وأقترح أيضاً إضافة..."
                  className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] focus:border-[#EA580C] outline-none font-bold text-[11px] resize-none"
                />

                {hasPendingContributions && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[10px] font-bold text-[#C2410C] dark:text-[#FBBF24]">
                      سيتم الحفظ المباشر في منظومة الخامات وإرسال إشعار بالتعديلات والمقترح للسوبر أدمن
                    </div>
                    <button
                      type="button"
                      disabled={savingContribution}
                      onClick={handleSaveContributionsToDb}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0C1427] hover:bg-[#1A2B54] text-[#FBBF24] font-black text-[11px] inline-flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {savingContribution ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{savingContribution ? 'جاري الحفظ بالمنظومة...' : 'حفظ التعديلات في المنظومة'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Workshop Role (Primary / Extra) + Explicit Save Button (NO auto-close on checkmark!) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
            {mode === 'artisan' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-[10px]">تصنيفها بورشتك:</span>
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ kind: 'primary' })}
                  className={`px-2.5 py-1 rounded-lg font-black border cursor-pointer transition ${
                    activeCfg.kind === 'primary'
                      ? 'bg-[#EA580C] text-white border-[#EA580C]'
                      : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  أساسية
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ kind: 'extra' })}
                  className={`px-2.5 py-1 rounded-lg font-black border cursor-pointer transition ${
                    activeCfg.kind === 'extra'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  فرعية / إضافية
                </button>
              </div>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleExpand}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
              >
                إغلاق
              </button>

              {alreadyOwned ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (hasPendingContributions) {
                      await handleSaveContributionsToDb();
                    }
                    onSaveExistingOwnedPreferences?.(activeCfg);
                    onToast(`✓ تم حفظ اختياراتك وتحديثاتك على «${displayName}»`);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black inline-flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>حفظ تحديث اختياراتي</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (hasPendingContributions) {
                      await handleSaveContributionsToDb();
                    }
                    onSaveCardSelection();
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black inline-flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'حفظ تعديلات الخامة' : 'حفظ واختيار لخاماتي'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
