import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Layers,
  Tag,
  Check,
  Sparkles,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Ruler,
} from 'lucide-react';
import {
  UnifiedCategoryPrefix,
  UnitChainCode,
  UnifiedMaterialsSnapshot,
  generateNextMasterCode,
} from '../../registry/unifiedMaterialsRegistry';
import {
  fetchUnifiedMaterialsSnapshot,
  createUnifiedMasterApi,
  getSeededFallbackSnapshot,
  saveLocalMaterialCodeMapping,
} from '../../db/unifiedMaterialsService';
import {
  createMaterialInSupabase,
  ensureDefaultUnitsInSupabase,
  getMaterialsFromSupabase,
  getSuppliersFromSupabase,
  SupabaseSupplier,
  SupabaseUnit,
} from '../../db/supabaseService';
import { tenantStorage } from '../../db/dexieDB';
import { normalizeMaterialKey } from '../../utils/materialsDeduplication';

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

const PREFIX_TO_GROUP_CAT: Record<string, string> = {
  TH: 'cat_threads',
  WD: 'cat_woods',
  MT: 'cat_metals',
  BD: 'cat_beads',
  PK: 'cat_packaging',
  LT: 'cat_fabrics',
};

const THICKNESS_PRESETS = [
  { id: '2_6', label: 'من 2 إلى 6 مم', values: [2, 3, 4, 5, 6] },
  { id: '4_6', label: '4 و 6 مم (زجزاج)', values: [4, 6] },
  { id: '8_12', label: '8، 10، 12 مم (سلب)', values: [8, 10, 12] },
  { id: 'custom', label: 'سماكات مخصصة', values: [] },
];

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface UnifiedNewMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  workshopId: string;
  actorName: string;
  currencySymbol?: string;
  suppliers?: SupabaseSupplier[];
  units?: SupabaseUnit[];
  initialName?: string;
  onCreated?: (info: {
    materialId: string;
    masterCode: string;
    canonicalName: string;
    alreadyExisted?: boolean;
  }) => void | Promise<void>;
}

export const UnifiedNewMaterialModal: React.FC<UnifiedNewMaterialModalProps> = ({
  isOpen,
  onClose,
  workshopId,
  actorName,
  currencySymbol = 'ج.م',
  suppliers: propSuppliers,
  units: propUnits,
  initialName = '',
  onCreated,
}) => {
  const [snapshot, setSnapshot] = useState<UnifiedMaterialsSnapshot>(() => getSeededFallbackSnapshot());
  const [suppliers, setSuppliers] = useState<SupabaseSupplier[]>(propSuppliers || []);
  const [units, setUnits] = useState<SupabaseUnit[]>(propUnits || []);

  // Unified fields
  const [prefix, setPrefix] = useState<UnifiedCategoryPrefix>('TH');
  const [canonicalName, setCanonicalName] = useState(initialName);
  const [kind, setKind] = useState<'primary' | 'extra'>('primary');
  const [unitChain, setUnitChain] = useState<UnitChainCode>('ل1');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [artistAlias, setArtistAlias] = useState('');
  const [supplierAlias, setSupplierAlias] = useState('');

  // Thicknesses / Specs
  const [thicknessPreset, setThicknessPreset] = useState<string>('2_6');
  const [customThicknessInput, setCustomThicknessInput] = useState('2, 3, 4, 5, 6');
  const [specLabel, setSpecLabel] = useState('');
  const [origin, setOrigin] = useState('');

  // Brands (multiple brand names)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [brandInput, setBrandInput] = useState('');

  // Optional Supplier Link
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [customSupplierText, setCustomSupplierText] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setCanonicalName(initialName || '');
    setPrefix('TH');
    setKind('primary');
    setUnitChain('ل1');
    setPurchasePrice('');
    setArtistAlias('');
    setSupplierAlias('');
    setThicknessPreset('2_6');
    setCustomThicknessInput('2, 3, 4, 5, 6');
    setSpecLabel('');
    setOrigin('');
    setSelectedBrands([]);
    setBrandInput('');
    setSelectedSupplierId('');
    setCustomSupplierText('');

    let active = true;
    (async () => {
      try {
        const [snap, loadedUnits, supRes] = await Promise.all([
          fetchUnifiedMaterialsSnapshot({ role: 'artisan', memberId: workshopId }),
          propUnits && propUnits.length > 0
            ? Promise.resolve(propUnits)
            : ensureDefaultUnitsInSupabase(workshopId),
          propSuppliers && propSuppliers.length > 0
            ? Promise.resolve({ data: propSuppliers })
            : getSuppliersFromSupabase(workshopId),
        ]);
        if (!active) return;
        setSnapshot(snap);
        setUnits(loadedUnits || []);
        setSuppliers(supRes.data || []);
      } catch {}
    })();

    return () => {
      active = false;
    };
  }, [isOpen, workshopId, initialName]);

  const previewSerialCode = useMemo(() => {
    try {
      const next = generateNextMasterCode(prefix, snapshot.masters, {});
      return next.code;
    } catch {
      return `${prefix}0001`;
    }
  }, [prefix, snapshot.masters]);

  const parsedThicknesses = useMemo(() => {
    if (prefix !== 'TH' && !customThicknessInput.trim()) return [];
    if (thicknessPreset !== 'custom') {
      const preset = THICKNESS_PRESETS.find((p) => p.id === thicknessPreset);
      if (preset && preset.values.length > 0) return preset.values;
    }
    return Array.from(
      new Set(
        customThicknessInput
          .split(/[،,\s/]+/)
          .map((x) => Number(x.trim()))
          .filter((n) => Number.isFinite(n) && n > 0 && n <= 100)
      )
    ).sort((a, b) => a - b);
  }, [prefix, thicknessPreset, customThicknessInput]);

  const handleAddBrandChip = () => {
    const clean = brandInput.trim();
    if (!clean) return;
    if (!selectedBrands.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      setSelectedBrands((prev) => [...prev, clean]);
    }
    setBrandInput('');
  };

  const toggleSuggestedBrand = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName) ? prev.filter((b) => b !== brandName) : [...prev, brandName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = canonicalName.trim();
    if (!cleanName) {
      setErrorMsg('يرجى إدخال اسم الخامة المعتمد.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Collect brands (including any typed text not yet clicked "+")
      const finalBrands = [...selectedBrands];
      if (brandInput.trim() && !finalBrands.includes(brandInput.trim())) {
        finalBrands.push(brandInput.trim());
      }

      const selectedSupObj = selectedSupplierId
        ? suppliers.find((s) => s.id === selectedSupplierId)
        : null;
      const optionalSupplierName = selectedSupObj?.name || customSupplierText.trim() || undefined;

      // 2. Register in Unified Materials System (auto serial code + Supabase + Super Admin notification)
      const apiRes = await createUnifiedMasterApi({
        prefix,
        canonicalName: cleanName,
        unitChain,
        artistAliases: artistAlias
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        supplierAliases: supplierAlias
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        defaultBrands: finalBrands,
        availableThicknessesMm: prefix === 'TH' ? parsedThicknesses : undefined,
        initialSpecLabel: prefix !== 'TH' ? specLabel.trim() || undefined : undefined,
        initialSpecOrigin: origin.trim() || undefined,
        optionalSupplierName,
        actorRole: 'artisan',
        actorId: workshopId,
        actorName,
      });

      if (!apiRes.success || !apiRes.master) {
        setErrorMsg(apiRes.error || 'تعذر تسجيل الخامة في منظومة الخامات الموحدة.');
        setSaving(false);
        return;
      }

      const master = apiRes.master;

      // 3. Check if already in workshop's "خاماتي" (prevent duplicate!)
      let currentUnits = units;
      if (currentUnits.length === 0) {
        currentUnits = await ensureDefaultUnitsInSupabase(workshopId);
        setUnits(currentUnits);
      }
      const chainDef = snapshot.unitChains.find((c) => c.code === master.unitChain);
      const recUnitName = chainDef?.defaultPrimaryUnit || 'كيلو';
      const matchingUnit =
        currentUnits.find((u) => u.name.includes(recUnitName)) || currentUnits[0];

      const existingMatsRes = await getMaterialsFromSupabase(workshopId);
      const existingMats = existingMatsRes.data || [];
      const existingMatch = existingMats.find(
        (m) => normalizeMaterialKey(m.name) === normalizeMaterialKey(master.canonicalName)
      );

      let savedMaterialId = existingMatch?.id || '';
      const numericPrice = Math.max(0, Number(purchasePrice) || 0);

      if (!existingMatch && matchingUnit) {
        const newMatId = generateUuid();
        const payload = {
          id: newMatId,
          name: master.canonicalName,
          kind,
          supplier_id: selectedSupplierId || null,
          unit_id: matchingUnit.id,
          purchase_price: numericPrice,
          market_name:
            finalBrands.length > 0
              ? `ماركات: ${finalBrands.join(' · ')}`
              : supplierAlias.trim() || null,
          market_unit_factor: 1,
        };
        const matRes = await createMaterialInSupabase(workshopId, payload);
        if (!matRes.error) {
          savedMaterialId = matRes.data?.id || newMatId;
          try {
            await tenantStorage.saveRawMaterial(
              {
                id: savedMaterialId,
                tenantId: workshopId,
                workshopId,
                materialName: master.canonicalName,
                category: (kind === 'extra' ? 'خامة إضافية' : 'خامة أساسية') as any,
                unit: (matchingUnit.name || 'كيلو') as any,
                unitId: matchingUnit.id,
                currentStock: 0,
                minAlertThreshold: 0,
                costPerUnit: numericPrice,
                costPerGram:
                  matchingUnit.factor && matchingUnit.factor > 0
                    ? numericPrice / matchingUnit.factor
                    : numericPrice,
                supplierId: selectedSupplierId || undefined,
                supplierName: optionalSupplierName,
                isActive: true,
                updatedAt: Date.now(),
              } as any,
              { skipCloudQueue: true }
            );
          } catch {}
        }
      }

      // 4. Persist Unified Serial Code mapping & Category group (WITHOUT forcing warehouse low-stock alarm!)
      if (savedMaterialId) {
        saveLocalMaterialCodeMapping('artisan', workshopId, savedMaterialId, {
          masterCode: master.code,
          specCode: apiRes.spec?.specCode,
          unitChain: master.unitChain,
        });

        try {
          const catMapKey = 'alshams_mat_cat_map_' + workshopId;
          const catMap = JSON.parse(localStorage.getItem(catMapKey) || '{}');
          catMap[savedMaterialId] =
            PREFIX_TO_GROUP_CAT[master.prefix] || (kind === 'extra' ? 'cat_woods' : 'cat_threads');
          localStorage.setItem(catMapKey, JSON.stringify(catMap));
        } catch {}

        // Save brand metadata locally for quick display in "خاماتي"
        if (finalBrands.length > 0) {
          try {
            const brandsKey = 'alshams_mat_brands_' + workshopId;
            const bMap = JSON.parse(localStorage.getItem(brandsKey) || '{}');
            bMap[savedMaterialId] = finalBrands;
            localStorage.setItem(brandsKey, JSON.stringify(bMap));
          } catch {}
        }

        // Ensure stock defaults to untracked (so it does NOT spam "الحق دي صفر!")
        try {
          const stockKey = 'alshams_mat_stock_' + workshopId;
          const stocks = JSON.parse(localStorage.getItem(stockKey) || '{}');
          if (!stocks[savedMaterialId]) {
            stocks[savedMaterialId] = {
              currentStock: 0,
              minAlertThreshold: 0,
              warehouseTracked: false,
            };
            localStorage.setItem(stockKey, JSON.stringify(stocks));
          }
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('alshams_materials_changed'));
      setSuccessMsg(
        apiRes.alreadyExisted
          ? `الخامة مسجلة مسبقاً في المنظومة بكود (${master.code}) وتم ربطها وإضافتها لخاماتك بنجاح ✅`
          : `تم تسجيل الخامة وإصدار الرقم السيريال الموحد (${master.code}) وإضافتها فوراً لخاماتك وإرسالها لمراجعة السوبر أدمن ✅`
      );

      if (onCreated) {
        await onCreated({
          materialId: savedMaterialId,
          masterCode: master.code,
          canonicalName: master.canonicalName,
          alreadyExisted: apiRes.alreadyExisted,
        });
      }

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ الخامة الجديدة.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      dir="rtl"
    >
      <div className="w-full max-w-2xl max-h-[92vh] bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3 bg-gradient-to-l from-[#0C1427] to-[#1A2B54] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black">
                إضافة خامة جديدة لخاماتي ومنظومة الخامات الموحدة
              </h2>
              <p className="text-[11px] text-amber-200/90 font-bold">
                تأخذ رقم سيريال موحد أوتوماتيك وتنزل فوراً في «خاماتي» وتُعرض للمراجعة على السوبر أدمن
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-500/80 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-200 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 font-black flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Auto Serial Preview Banner */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/35 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#EA580C]" />
              <span className="font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                الرقم السيريال الموحد الذي سيصدر تلقائياً لهذه الخامة:
              </span>
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#0C1427] text-[#FBBF24] font-mono font-black text-xs tracking-wider">
              {previewSerialCode}
            </span>
          </div>

          {/* Row 1: Category + Canonical Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                القسم / التصنيف *
              </label>
              <select
                value={prefix}
                onChange={(e) => {
                  const p = e.target.value as UnifiedCategoryPrefix;
                  setPrefix(p);
                  setKind(DEFAULT_KIND_FOR_PREFIX[p] || 'primary');
                  const cat = snapshot.categories.find((c) => c.prefix === p);
                  if (cat) setUnitChain(cat.defaultUnitChain);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                {snapshot.categories.map((c) => (
                  <option key={c.prefix} value={c.prefix}>
                    {c.nameAr.replace(' ★', '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                اسم الخامة المعتمد *
              </label>
              <input
                type="text"
                required
                value={canonicalName}
                onChange={(e) => setCanonicalName(e.target.value)}
                placeholder="مثال: خيط قطن مجدول مصري، قفل مغناطيسي، خشب زان..."
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold outline-none focus:border-[#EA580C]"
              />
            </div>
          </div>

          {/* Row 2: Kind + Unit Chain + Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                تصنيف الخامة في ورشتك
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setKind('primary')}
                  className={`py-2 rounded-xl font-black border transition cursor-pointer ${
                    kind === 'primary'
                      ? 'bg-[#EA580C] text-white border-[#EA580C]'
                      : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  أساسية
                </button>
                <button
                  type="button"
                  onClick={() => setKind('extra')}
                  className={`py-2 rounded-xl font-black border transition cursor-pointer ${
                    kind === 'extra'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  فرعية / إضافية
                </button>
              </div>
            </div>

            <div>
              <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                وحدة القياس وسلسلة التحويل
              </label>
              <select
                value={unitChain}
                onChange={(e) => setUnitChain(e.target.value as UnitChainCode)}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                {snapshot.unitChains.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.titleAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                سعر الشراء ({currencySymbol}) (اختياري)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="مثال: 185"
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
              />
            </div>
          </div>

          {/* Row 3: Thicknesses (for Threads) OR Specs (for non-threads) */}
          {prefix === 'TH' ? (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
              <div className="flex items-center gap-1.5 font-black text-[#0C1427] dark:text-[#F7F3EA]">
                <Ruler className="w-4 h-4 text-[#EA580C]" />
                <span>السماكات المتاحة لهذا الخيط (تنزل كلها مع الخامة وتُختار في الحاسبة)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {THICKNESS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setThicknessPreset(preset.id);
                      if (preset.values.length > 0) {
                        setCustomThicknessInput(preset.values.join(', '));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-black border text-[11px] transition cursor-pointer ${
                      thicknessPreset === preset.id
                        ? 'bg-[#0C1427] dark:bg-[#EA580C] text-[#FBBF24] dark:text-white border-transparent'
                        : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {thicknessPreset === 'custom' && (
                <input
                  type="text"
                  value={customThicknessInput}
                  onChange={(e) => setCustomThicknessInput(e.target.value)}
                  placeholder="اكتب السماكات بالمم مفصولة بفاصلة، مثال: 2, 3, 4, 5, 6"
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
                />
              )}
              {parsedThicknesses.length > 0 && (
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  ✓ السماكات المعتمدة التي ستُسجل تلقائياً: {parsedThicknesses.map((t) => `${t} مم`).join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                  المقاس / المواصفة الفنية (اختياري)
                </label>
                <input
                  type="text"
                  value={specLabel}
                  onChange={(e) => setSpecLabel(e.target.value)}
                  placeholder="مثال: مقاس 10 مم، سمك 12 مم، لوح 122×244..."
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                />
              </div>
              <div>
                <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                  المنشأ / النوع (اختياري)
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="مثال: مصري / تركي / دمياطي / صيني"
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                />
              </div>
            </div>
          )}

          {/* Row 4: Brands (Multiple Brand Names) */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
            <div className="flex items-center gap-1.5 font-black text-[#0C1427] dark:text-[#F7F3EA]">
              <Tag className="w-4 h-4 text-[#EA580C]" />
              <span>أسماء الماركات / المصانع لهذه الخامة (اختياري — يمكنك إضافة أكثر من ماركة)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBrandChip();
                  }
                }}
                placeholder="اكتب اسم الماركة (مثال: أليز، يارن آرت، مصنع الشمس) واضغط إضافة..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <button
                type="button"
                onClick={handleAddBrandChip}
                className="px-3.5 py-2 rounded-xl bg-[#0C1427] text-[#FBBF24] font-black inline-flex items-center gap-1 cursor-pointer active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>

            {selectedBrands.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedBrands.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-black"
                  >
                    <Check className="w-3 h-3" />
                    <span>{b}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedBrands((prev) => prev.filter((x) => x !== b))}
                      className="hover:text-rose-200 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {snapshot.brands.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  ماركات مسجلة:
                </span>
                {snapshot.brands
                  .filter((b) => b.brandCode !== 'B000')
                  .slice(0, 10)
                  .map((b) => {
                    const active = selectedBrands.includes(b.brandName);
                    return (
                      <button
                        key={b.brandCode}
                        type="button"
                        onClick={() => toggleSuggestedBrand(b.brandName)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C]'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {b.brandName}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Row 5: Optional Supplier Link + Aliases */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                <Building2 className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>ربط اسم مورد (اختياري)</span>
              </label>
              {suppliers.length > 0 ? (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                >
                  <option value="">بدون مورد محدد (شراء عام)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={customSupplierText}
                  onChange={(e) => setCustomSupplierText(e.target.value)}
                  placeholder="اختياري: اكتب اسم المورد إن وجد"
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                />
              )}
            </div>

            <div>
              <label className="block font-black mb-1 text-[#0C1427] dark:text-[#F7F3EA]">
                مسميات دارجة في السوق (اختياري)
              </label>
              <input
                type="text"
                value={artistAlias}
                onChange={(e) => setArtistAlias(e.target.value)}
                placeholder="افصل بفاصلة ، مثال: قيطان مجدول، حبل قطن"
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black inline-flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-55"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'جاري الحفظ وإصدار الكود...' : 'حفظ وإصدار رقم سيريال وإضافة لخاماتي'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
