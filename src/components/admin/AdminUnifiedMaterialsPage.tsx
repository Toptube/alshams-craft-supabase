import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Search,
  Plus,
  CheckCircle2,
  Archive,
  RotateCcw,
  Trash2,
  Edit3,
  Bell,
  Layers,
  Tag,
  Scale,
  AlertTriangle,
  X,
  RefreshCw,
  CloudUpload,
  Banknote,
  TrendingUp,
} from 'lucide-react';
import {
  UnifiedCategoryPrefix,
  UnitChainCode,
  BridgeFieldKey,
  BRIDGE_FIELD_LABELS,
  UnifiedMaterialMaster,
  UnifiedMaterialsSnapshot,
  searchUnifiedMaterials,
} from '../../registry/unifiedMaterialsRegistry';
import {
  fetchUnifiedMaterialsSnapshot,
  createUnifiedMasterApi,
  createUnifiedSpecApi,
  createUnifiedAliasApi,
  createUnifiedBrandApi,
  updateOrProposeUnifiedMasterApi,
  resolveUnifiedMaterialNotificationApi,
  syncUnifiedMaterialsToSupabaseApi,
  recalculateUnifiedMarketPricesApi,
  getSeededFallbackSnapshot,
} from '../../db/unifiedMaterialsService';
import {
  getDefaultMarketBasePrice,
  getDefaultBrandPrices,
  getBrandsAveragePrice,
} from '../../utils/unifiedMarketPricing';

interface AdminUnifiedMaterialsPageProps {
  userEmail: string;
  onBack: () => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

export const AdminUnifiedMaterialsPage: React.FC<AdminUnifiedMaterialsPageProps> = ({
  userEmail,
  onBack,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [snapshot, setSnapshot] = useState<UnifiedMaterialsSnapshot>(() => getSeededFallbackSnapshot());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'directory' | 'notifications' | 'brands_units'>('directory');

  // Directory filters
  const [selectedPrefix, setSelectedPrefix] = useState<UnifiedCategoryPrefix | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'new_only' | 'archived' | 'added_equations' | 'all'>('active');
  const [workshopFilter, setWorkshopFilter] = useState<string>('all');

  // Selected master detail / specs modal
  const [inspectMaster, setInspectMaster] = useState<UnifiedMaterialMaster | null>(null);
  const [newSpecLabel, setNewSpecLabel] = useState('');
  const [newSpecThickness, setNewSpecThickness] = useState('');
  const [newSpecPlies, setNewSpecPlies] = useState('');
  const [newSpecOrigin, setNewSpecOrigin] = useState('');
  const [newSpecWeightPerMeter, setNewSpecWeightPerMeter] = useState('');
  const [newSpecPackWeight, setNewSpecPackWeight] = useState('');
  const [newSpecPackLength, setNewSpecPackLength] = useState('');
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasType, setNewAliasType] = useState<'artisan' | 'supplier' | 'common'>('artisan');
  const [newAliasContext, setNewAliasContext] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  // Add / Edit Master Modal
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<UnifiedMaterialMaster | null>(null);
  const [formPrefix, setFormPrefix] = useState<UnifiedCategoryPrefix>('TH');
  const [formName, setFormName] = useState('');
  const [formUnitChain, setFormUnitChain] = useState<UnitChainCode>('ل1');
  const [formBridgeFields, setFormBridgeFields] = useState<BridgeFieldKey[]>(['وزن_متر']);
  const [formArtistAliasesText, setFormArtistAliasesText] = useState('');
  const [formSupplierAliasesText, setFormSupplierAliasesText] = useState('');
  const [formWorkshopsText, setFormWorkshopsText] = useState('');
  const [formSafetyNote, setFormSafetyNote] = useState('');
  const [formMarketBasePrice, setFormMarketBasePrice] = useState('');
  const [formBrandPrices, setFormBrandPrices] = useState<Record<string, string>>({});
  const [formNewBrandName, setFormNewBrandName] = useState('');
  const [formNewBrandPrice, setFormNewBrandPrice] = useState('');
  const [savingMaster, setSavingMaster] = useState(false);

  // Add Brand form
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCategory, setNewBrandCategory] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);

  // Confirm archive/delete reason modal
  const [archiveTarget, setArchiveTarget] = useState<{
    master: UnifiedMaterialMaster;
    mode: 'archive' | 'delete_unused';
  } | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [recalculatingPrices, setRecalculatingPrices] = useState(false);
  const [storageSource, setStorageSource] = useState<'supabase' | 'local_fallback'>('supabase');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const reloadData = async () => {
    setLoading(true);
    const data = (await fetchUnifiedMaterialsSnapshot({ role: 'super_admin' })) as UnifiedMaterialsSnapshot & {
      storageSource?: 'supabase' | 'local_fallback';
    };
    setSnapshot(data);
    if (data.storageSource) setStorageSource(data.storageSource);
    setLoading(false);
  };

  const handleSyncToSupabase = async () => {
    setSyncingSupabase(true);
    const res = await syncUnifiedMaterialsToSupabaseApi();
    setSyncingSupabase(false);
    if (res.success && res.verifiedCounts) {
      setStorageSource('supabase');
      setLastSyncedAt(new Date().toLocaleTimeString('ar-EG'));
      onNotifySuccess(
        `تم الترحيل والمزامنة المباشرة مع قاعدة بيانات Supabase بنجاح ✅ (خامات: ${res.verifiedCounts.masters} · ماركات: ${res.verifiedCounts.brands} · أقسام: ${res.verifiedCounts.categories} · مواصفات: ${res.verifiedCounts.specs} · مسميات: ${res.verifiedCounts.aliases}).`
      );
      await reloadData();
    } else {
      onNotifyError(
        res.error || 'تعذر المزامنة مع قاعدة بيانات Supabase — يرجى التحقق من الاتصال.'
      );
    }
  };

  const handleRecalculateMarketPrices = async () => {
    setRecalculatingPrices(true);
    const res = await recalculateUnifiedMarketPricesApi(2);
    setRecalculatingPrices(false);
    if (res.success) {
      if ((res.updatedMastersCount || 0) > 0) {
        onNotifySuccess(
          `تم تحديث متوسطات السوق تلقائياً ✅ (أصناف محدثة: ${res.updatedMastersCount} · أسعار ماركات محدثة: ${res.updatedBrandsCount || 0} · إجمالي أرصاد مفحوصة: ${res.totalObservationsScanned || 0}).`
        );
      } else {
        onNotifySuccess(
          `تم فحص أرصاد الأسعار (${res.totalObservationsScanned || 0} رصد) — يتطلب التحديث التلقائي رصدين مستقلين على الأقل من عضوين مختلفين لنفس الصنف أو الماركة حتى لا يغيّر عضو واحد متوسط السوق.`
        );
      }
      await reloadData();
    } else {
      onNotifyError(res.error || 'تعذر تحديث متوسطات السوق تلقائياً');
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const allWorkshops = useMemo(() => {
    const set = new Set<string>();
    snapshot.masters.forEach((m) => m.workshopTags.forEach((w) => set.add(w)));
    return Array.from(set).sort();
  }, [snapshot.masters]);

  const pendingNotifications = useMemo(
    () => snapshot.notifications.filter((n) => n.status === 'pending'),
    [snapshot.notifications]
  );

  const searchOutcome = useMemo(() => {
    const base = searchUnifiedMaterials(searchQuery, snapshot.masters, snapshot.specs, snapshot.aliases, {
      prefixFilter: selectedPrefix,
      workshopFilter,
      includeArchived: statusFilter === 'archived' || statusFilter === 'all',
    });

    const filtered = base.matches.filter(({ master }) => {
      if (statusFilter === 'active') return master.status === 'active';
      if (statusFilter === 'archived') return master.status === 'archived';
      if (statusFilter === 'new_only') return master.reviewStatus === 'new';
      if (statusFilter === 'added_equations') return Boolean(master.isAddedForEquations);
      return master.status !== 'reserved_deleted';
    });

    return { ...base, matches: filtered };
  }, [searchQuery, snapshot, selectedPrefix, workshopFilter, statusFilter]);

  const counts = useMemo(() => {
    const activeMasters = snapshot.masters.filter((m) => m.status === 'active').length;
    const archivedMasters = snapshot.masters.filter((m) => m.status === 'archived').length;
    const newMasters = snapshot.masters.filter((m) => m.reviewStatus === 'new' && m.status === 'active').length;
    return {
      activeMasters,
      archivedMasters,
      newMasters,
      specsCount: snapshot.specs.length,
      aliasesCount: snapshot.aliases.length,
      brandsCount: snapshot.brands.length,
      pendingNotifs: pendingNotifications.length,
    };
  }, [snapshot, pendingNotifications]);

  const openAddMasterModal = () => {
    setEditingMaster(null);
    setFormPrefix(selectedPrefix === 'all' ? 'TH' : selectedPrefix);
    setFormName('');
    const cat = snapshot.categories.find((c) => c.prefix === (selectedPrefix === 'all' ? 'TH' : selectedPrefix));
    setFormUnitChain(cat?.defaultUnitChain || 'ل1');
    setFormBridgeFields(['وزن_متر']);
    setFormArtistAliasesText('');
    setFormSupplierAliasesText('');
    setFormWorkshopsText('');
    setFormSafetyNote('');
    setFormMarketBasePrice('');
    setFormBrandPrices({});
    setFormNewBrandName('');
    setFormNewBrandPrice('');
    setIsMasterModalOpen(true);
  };

  const openEditMasterModal = (m: UnifiedMaterialMaster) => {
    setEditingMaster(m);
    setFormPrefix(m.prefix);
    setFormName(m.canonicalName);
    setFormUnitChain(m.unitChain);
    setFormBridgeFields(m.bridgeFields || []);
    setFormArtistAliasesText((m.artistAliases || []).join('، '));
    setFormSupplierAliasesText((m.supplierAliases || []).join('، '));
    setFormWorkshopsText((m.workshopTags || []).join('، '));
    setFormSafetyNote(m.safetyNote || '');
    const baseVal = Number(m.marketBasePrice) > 0 ? Number(m.marketBasePrice) : getDefaultMarketBasePrice(m);
    setFormMarketBasePrice(String(baseVal));
    const mergedBrandPrices = {
      ...getDefaultBrandPrices(m, baseVal),
      ...(m.brandPrices || {}),
    };
    const asStrings: Record<string, string> = {};
    for (const br of m.defaultBrands || []) {
      const clean = String(br || '').trim();
      if (clean) asStrings[clean] = mergedBrandPrices[clean] ? String(mergedBrandPrices[clean]) : '';
    }
    for (const [br, pr] of Object.entries(mergedBrandPrices)) {
      asStrings[br] = String(pr);
    }
    setFormBrandPrices(asStrings);
    setFormNewBrandName('');
    setFormNewBrandPrice('');
    setIsMasterModalOpen(true);
  };

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSavingMaster(true);

    const artistAliases = formArtistAliasesText
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const supplierAliases = formSupplierAliasesText
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const workshopTags = formWorkshopsText
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingMaster) {
      const parsedMarketBase = Number(formMarketBasePrice.replace(',', '.').trim());
      const parsedBrandPrices: Record<string, number> = {};
      for (const [br, rawPr] of Object.entries(formBrandPrices)) {
        const cleanBr = br.trim();
        const num = Number(String(rawPr || '').replace(',', '.').trim());
        if (cleanBr && Number.isFinite(num) && num > 0) {
          parsedBrandPrices[cleanBr] = num;
        }
      }

      const res = await updateOrProposeUnifiedMasterApi(editingMaster.code, {
        action: 'update',
        canonicalName: formName.trim(),
        unitChain: formUnitChain,
        bridgeFields: formBridgeFields,
        artistAliases,
        supplierAliases,
        workshopTags,
        safetyNote: formSafetyNote.trim(),
        marketBasePrice: Number.isFinite(parsedMarketBase) && parsedMarketBase > 0 ? parsedMarketBase : undefined,
        brandPrices: parsedBrandPrices,
        actorRole: 'super_admin',
        actorId: 'super_admin',
        actorName: userEmail,
      });
      setSavingMaster(false);
      if (!res.success) {
        onNotifyError(res.error || 'تعذر تحديث الخامة');
        return;
      }
      onNotifySuccess(`تم تحديث الصنف والأسعار المرجعية [${editingMaster.code}] وترحيلها مباشرة لقاعدة بيانات Supabase ✅`);
    } else {
      const res = await createUnifiedMasterApi({
        prefix: formPrefix,
        canonicalName: formName.trim(),
        unitChain: formUnitChain,
        bridgeFields: formBridgeFields,
        artistAliases,
        supplierAliases,
        workshopTags,
        safetyNote: formSafetyNote.trim(),
        actorRole: 'super_admin',
        actorId: 'super_admin',
        actorName: userEmail,
      });
      setSavingMaster(false);
      if (!res.success) {
        onNotifyError(res.error || 'تعذر إنشاء الصنف');
        return;
      }
      onNotifySuccess(`تمت إضافة الصنف الجديد بالكود [${res.master?.code}] ونشره فوراً.`);
    }

    setIsMasterModalOpen(false);
    await reloadData();
  };

  const handleConfirmArchiveOrDelete = async () => {
    if (!archiveTarget) return;
    const res = await updateOrProposeUnifiedMasterApi(archiveTarget.master.code, {
      action: archiveTarget.mode,
      reason: archiveReason.trim() || (archiveTarget.mode === 'archive' ? 'أرشفة إدارية' : 'حذف صنف غير مستخدم'),
      actorRole: 'super_admin',
      actorId: 'super_admin',
      actorName: userEmail,
    });
    if (!res.success) {
      onNotifyError(res.error || 'تعذر تنفيذ الإجراء');
      return;
    }
    onNotifySuccess(
      archiveTarget.mode === 'archive'
        ? `تمت أرشفة الصنف [${archiveTarget.master.code}] لحفظ ارتباطاته السابقة.`
        : `تم حذف الصنف [${archiveTarget.master.code}] مع حجز الكود نهائياً لعدم تكراره.`
    );
    setArchiveTarget(null);
    setArchiveReason('');
    await reloadData();
  };

  const handleAddSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectMaster || !newSpecLabel.trim()) return;
    setSavingDetail(true);
    const bridgeValues: Record<string, any> = {};
    if (newSpecWeightPerMeter) bridgeValues.weightPerMeterGrams = Number(newSpecWeightPerMeter);
    if (newSpecPackWeight) bridgeValues.packWeightGrams = Number(newSpecPackWeight);
    if (newSpecPackLength) bridgeValues.packLengthMeters = Number(newSpecPackLength);

    const res = await createUnifiedSpecApi({
      masterCode: inspectMaster.code,
      label: newSpecLabel.trim(),
      thicknessMm: newSpecThickness ? Number(newSpecThickness) : undefined,
      plies: newSpecPlies ? Number(newSpecPlies) : undefined,
      origin: newSpecOrigin.trim() || undefined,
      bridgeValues,
      actorRole: 'super_admin',
      actorId: 'super_admin',
      actorName: userEmail,
    });
    setSavingDetail(false);
    if (!res.success) {
      onNotifyError(res.error || 'تعذر إضافة المواصفة');
      return;
    }
    setNewSpecLabel('');
    setNewSpecThickness('');
    setNewSpecPlies('');
    setNewSpecOrigin('');
    setNewSpecWeightPerMeter('');
    setNewSpecPackWeight('');
    setNewSpecPackLength('');
    onNotifySuccess(`تمت إضافة المواصفة [${res.spec?.specCode}] بنجاح.`);
    await reloadData();
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectMaster || !newAliasName.trim()) return;
    setSavingDetail(true);
    const res = await createUnifiedAliasApi({
      targetCode: inspectMaster.code,
      aliasName: newAliasName.trim(),
      aliasType: newAliasType,
      contextHint: newAliasContext.trim() || undefined,
      actorRole: 'super_admin',
      actorId: 'super_admin',
      actorName: userEmail,
    });
    setSavingDetail(false);
    if (!res.success) {
      onNotifyError(res.error || 'تعذر إضافة الاسم الدارج');
      return;
    }
    setNewAliasName('');
    setNewAliasContext('');
    onNotifySuccess(`تم ربط الاسم [${res.alias?.aliasCode}] بالكود [${inspectMaster.code}].`);
    await reloadData();
  };

  const handleResolveNotification = async (
    notifId: string,
    decision: 'accept_global' | 'keep_local' | 'archive' | 'dismiss'
  ) => {
    const res = await resolveUnifiedMaterialNotificationApi(notifId, decision);
    if (!res.success) {
      onNotifyError(res.error || 'تعذر معالجة الإشعار');
      return;
    }
    onNotifySuccess('تم تنفيذ القرار وتحديث منظومة الخامات بنجاح.');
    await reloadData();
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    setSavingBrand(true);
    const res = await createUnifiedBrandApi({
      brandName: newBrandName.trim(),
      categoryHint: newBrandCategory.trim() || 'عام',
    });
    setSavingBrand(false);
    if (!res.success) {
      onNotifyError(res.error || 'تعذر إضافة الماركة');
      return;
    }
    setNewBrandName('');
    setNewBrandCategory('');
    onNotifySuccess(`تمت إضافة الماركة [${res.brand?.brandCode}] ${res.brand?.brandName}.`);
    await reloadData();
  };

  const inspectedSpecs = useMemo(() => {
    if (!inspectMaster) return [];
    return snapshot.specs.filter((s) => s.masterCode === inspectMaster.code);
  }, [inspectMaster, snapshot.specs]);

  const inspectedAliases = useMemo(() => {
    if (!inspectMaster) return [];
    return snapshot.aliases.filter((a) => a.targetCode === inspectMaster.code);
  }, [inspectMaster, snapshot.aliases]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5" dir="rtl">
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-xs font-black inline-flex items-center gap-1.5 hover:border-[#EA580C] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            <span>الرئيسية</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
              منظومة الخامات الموحدة (4 مستويات)
            </h1>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              القسم · الصنف الأم · المواصفة وحقول الجسر · الـ SKU التجاري للموردين والأسماء المرتبطة
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRecalculateMarketPrices}
            disabled={recalculatingPrices}
            title="إعادة حساب متوسطات أسعار السوق وأسعار الماركات تلقائياً من أرصاد الأعضاء المشاركين (يتطلب رصدين مستقلين على الأقل)"
            className="px-3 py-2 rounded-xl border border-amber-500/50 bg-amber-500/12 hover:bg-amber-600 hover:text-white text-amber-900 dark:text-amber-300 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition disabled:opacity-60"
          >
            <TrendingUp className={`w-3.5 h-3.5 ${recalculatingPrices ? 'animate-pulse' : ''}`} />
            <span>{recalculatingPrices ? 'جاري احتساب المتوسطات...' : 'تحديث متوسطات السوق تلقائياً'}</span>
          </button>
          <button
            type="button"
            onClick={handleSyncToSupabase}
            disabled={syncingSupabase}
            className="px-3 py-2 rounded-xl border border-emerald-600/40 bg-emerald-600/10 hover:bg-emerald-600 hover:text-white text-emerald-800 dark:text-emerald-300 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition disabled:opacity-60"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${syncingSupabase ? 'animate-bounce' : ''}`} />
            <span>{syncingSupabase ? 'جاري الترحيل لـ Supabase...' : 'مزامنة وترحيل لـ Supabase'}</span>
          </button>
          <button
            type="button"
            onClick={reloadData}
            className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          <button
            type="button"
            onClick={openAddMasterModal}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف أم جديد</span>
          </button>
        </div>
      </header>

      {/* شريط حالة الترحيل والحفظ المباشر مع قاعدة بيانات Supabase */}
      <section
        className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
          storageSource === 'supabase'
            ? 'bg-emerald-500/8 dark:bg-emerald-950/30 border-emerald-500/35'
            : 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500/40'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2
            className={`w-5 h-5 shrink-0 ${
              storageSource === 'supabase'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">
              {storageSource === 'supabase'
                ? 'متصل ومربوط مباشرة بقاعدة بيانات Supabase (الحفظ والترحيل تلقائي وفوري)'
                : 'وضع الاحتياطي المحلي — اضغط زر الترحيل لإتمام المزامنة مع قاعدة البيانات'}
            </div>
            <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
              أي خامة أو مواصفة أو ماركة أو اعتماد تضيفه أو تعدله هنا يُحفَظ مباشرة داخل جداول Supabase دون الحاجة لفتح قاعدة البيانات يدوياً
              {lastSyncedAt ? ` · آخر مزامنة: ${lastSyncedAt}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSyncToSupabase}
          disabled={syncingSupabase}
          className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition disabled:opacity-60"
        >
          <CloudUpload className={`w-3.5 h-3.5 ${syncingSupabase ? 'animate-bounce' : ''}`} />
          <span>{syncingSupabase ? 'جاري الترحيل...' : 'ترحيل ومزامنة فورية مع قاعدة البيانات'}</span>
        </button>
      </section>

      {/* Metrics Summary Strip (Tabular Numerals) */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
          <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">الأصناف النشطة</div>
          <div className="text-lg font-black font-mono tabular-nums mt-0.5">{counts.activeMasters}</div>
        </div>
        <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
          <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">الأقسام الرئيسية</div>
          <div className="text-lg font-black font-mono tabular-nums mt-0.5">{snapshot.categories.length}</div>
        </div>
        <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
          <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">المواصفات (.01)</div>
          <div className="text-lg font-black font-mono tabular-nums mt-0.5">{counts.specsCount}</div>
        </div>
        <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
          <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">الماركات (B000+)</div>
          <div className="text-lg font-black font-mono tabular-nums mt-0.5">{counts.brandsCount}</div>
        </div>
        <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]">
          <div className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">المؤرشف</div>
          <div className="text-lg font-black font-mono tabular-nums mt-0.5">{counts.archivedMasters}</div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 text-right cursor-pointer"
        >
          <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">إشعارات المراجعة</div>
          <div className="text-lg font-black font-mono tabular-nums text-[#EA580C] dark:text-[#FBBF24] mt-0.5">
            {counts.pendingNotifs}
          </div>
        </button>
      </section>

      {/* Primary Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
            activeTab === 'directory'
              ? 'bg-white dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] shadow-xs'
              : 'text-[#475569] dark:text-[#CBD5E1]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>دليل الخامات الموحد ({counts.activeMasters})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
            activeTab === 'notifications'
              ? 'bg-white dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] shadow-xs'
              : 'text-[#475569] dark:text-[#CBD5E1]'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>إشعارات ومراجعات الخامات ({counts.pendingNotifs})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('brands_units')}
          className={`px-3.5 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
            activeTab === 'brands_units'
              ? 'bg-white dark:bg-[#0D162E] text-[#0C1427] dark:text-[#F7F3EA] shadow-xs'
              : 'text-[#475569] dark:text-[#CBD5E1]'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>الماركات والوحدات وحقول الجسر</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: UNIFIED MATERIALS DIRECTORY                                */}
      {/* ================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Category Prefix Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedPrefix('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black border cursor-pointer whitespace-nowrap shrink-0 ${
                selectedPrefix === 'all'
                  ? 'bg-[#0C1427] text-white dark:bg-[#FBBF24] dark:text-[#0C1427] border-transparent'
                  : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1]'
              }`}
            >
              كل الأقسام (12)
            </button>
            {snapshot.categories.map((cat) => (
              <button
                key={cat.prefix}
                type="button"
                onClick={() => setSelectedPrefix(cat.prefix)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  selectedPrefix === cat.prefix
                    ? 'bg-[#EA580C] text-white border-transparent'
                    : 'bg-white dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA]'
                }`}
                title={cat.description}
              >
                <span className="font-mono font-black">{cat.prefix}</span>
                <span>{cat.nameAr.replace(' ★', '')}</span>
              </button>
            ))}
          </div>

          {/* Search & Filters Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-[#F7F3EA] dark:bg-[#0D162E] p-3 rounded-2xl border border-[#D4CCBC] dark:border-[#22355E]">
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-[#64748B] absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث ذكي: اكتب الاسم، اسم السوق، الاختصار (مثل th أو wd)، أو الكود (TH0001)..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] text-xs font-bold outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={workshopFilter}
                onChange={(e) => setWorkshopFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] text-xs font-bold outline-none"
              >
                <option value="all">كل الورش ({allWorkshops.length})</option>
                {allWorkshops.map((w) => (
                  <option key={w} value={w}>
                    ورشة: {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] text-xs font-bold outline-none"
              >
                <option value="active">الأصناف النشطة ({counts.activeMasters})</option>
                <option value="new_only">إضافات جديدة للمراجعة ({counts.newMasters})</option>
                <option value="added_equations">مضاف للمعادلات ★</option>
                <option value="archived">الأرشيف ({counts.archivedMasters})</option>
                <option value="all">الكل</option>
              </select>
            </div>
          </div>

          {/* Disambiguation Guidance */}
          {searchOutcome.disambiguationMessage && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-[#EA580C] shrink-0" />
              <span>{searchOutcome.disambiguationMessage}</span>
            </div>
          )}

          {/* Results Table */}
          <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#EFE9DC]/60 dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between text-xs font-bold">
              <span>النتائج المطابقة: {searchOutcome.matches.length} صنف أم</span>
              <span className="text-[#475569] dark:text-[#94A3B8]">الأكواد المحذوفة لا يُعاد استخدامها مطلقاً</span>
            </div>

            {searchOutcome.matches.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm font-bold text-[#475569] dark:text-[#94A3B8]">
                  لا توجد خامات مطابقة لمعايير البحث الحالية.
                </p>
                <button
                  type="button"
                  onClick={openAddMasterModal}
                  className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
                >
                  + إضافة صنف أم جديد
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#F7F3EA] dark:bg-[#132040]/70 border-b border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1]">
                    <tr>
                      <th className="py-2.5 px-3 font-black whitespace-nowrap">الكود</th>
                      <th className="py-2.5 px-3 font-black">الاسم المعتمد والأسماء الدارجة</th>
                      <th className="py-2.5 px-3 font-black whitespace-nowrap">متوسط السوق والماركات</th>
                      <th className="py-2.5 px-3 font-black whitespace-nowrap">الوحدات والجسور</th>
                      <th className="py-2.5 px-3 font-black">الورش المرتبطة</th>
                      <th className="py-2.5 px-3 font-black whitespace-nowrap">الحالة</th>
                      <th className="py-2.5 px-3 font-black text-left whitespace-nowrap">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE9DC] dark:divide-[#1E2E52]">
                    {searchOutcome.matches.map(({ master, specs }) => {
                      const isNew = master.reviewStatus === 'new';
                      const isArchived = master.status === 'archived';
                      return (
                        <tr
                          key={master.code}
                          className="hover:bg-[#F7F3EA]/60 dark:hover:bg-[#132040]/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setInspectMaster(master)}
                              className="font-mono tabular-nums font-black text-xs text-[#C2410C] dark:text-[#FBBF24] hover:underline cursor-pointer"
                            >
                              {master.code}
                            </button>
                            <div className="text-[11px] text-[#64748B] font-mono tabular-nums">
                              {specs.length} مواصفة
                            </div>
                          </td>

                          <td className="py-2.5 px-3 align-top max-w-md">
                            <div className="font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-1.5">
                              <span>{master.canonicalName}</span>
                              {master.isAddedForEquations && (
                                <span className="text-[#EA580C]" title="مضاف للمعادلات الهندسية">★</span>
                              )}
                            </div>
                            {(master.artistAliases.length > 0 || master.supplierAliases.length > 0) && (
                              <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                                {master.artistAliases.length > 0 && (
                                  <span>فنان: {master.artistAliases.join(' · ')}</span>
                                )}
                                {master.artistAliases.length > 0 && master.supplierAliases.length > 0 && (
                                  <span className="mx-1.5">/</span>
                                )}
                                {master.supplierAliases.length > 0 && (
                                  <span>مورد: {master.supplierAliases.join(' · ')}</span>
                                )}
                              </div>
                            )}
                            {master.safetyNote && (
                              <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 font-bold">
                                تنبيه: {master.safetyNote}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            {(() => {
                              const basePr =
                                Number(master.marketBasePrice) > 0
                                  ? Number(master.marketBasePrice)
                                  : getDefaultMarketBasePrice(master);
                              const pricedBrandsCount = Object.keys(master.brandPrices || {}).length;
                              const avgBrands = getBrandsAveragePrice(master);
                              const srcBadge =
                                master.priceSource === 'super_admin'
                                  ? { text: 'اعتماد أدمن', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' }
                                  : master.priceSource === 'auto_average'
                                  ? {
                                      text: `متوسط تلقائي (${master.priceObservationsCount || 2}+)`,
                                      cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
                                    }
                                  : { text: 'مبدئي بالسوق', cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' };
                              return (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono tabular-nums font-black text-xs text-emerald-700 dark:text-emerald-300">
                                      {basePr} ج.م
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${srcBadge.cls}`}>
                                      {srcBadge.text}
                                    </span>
                                  </div>
                                  {pricedBrandsCount > 0 && (
                                    <div className="text-[10px] text-[#64748B] font-bold">
                                      {pricedBrandsCount} ماركة · متوسط {avgBrands} ج.م
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            <div className="font-bold text-[#0C1427] dark:text-[#F7F3EA]">
                              سلسلة {master.unitChain}
                            </div>
                            <div className="text-[11px] text-[#64748B] mt-0.5">
                              {master.bridgeFields.length > 0 ? master.bridgeFields.join(' · ') : 'بدون حقول جسر'}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 align-top">
                            <div className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                              {master.workshopTags.length > 0 ? master.workshopTags.join(' · ') : 'عام لكل الورش'}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 align-top whitespace-nowrap text-[11px] font-bold">
                            {isArchived ? (
                              <span className="text-amber-700 dark:text-amber-300">مؤرشف</span>
                            ) : isNew ? (
                              <span className="text-[#EA580C] dark:text-[#FBBF24]">جديد · بانتظار الاعتماد</span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400">معتمد</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 align-top text-left whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {isNew && !isArchived && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateOrProposeUnifiedMasterApi(master.code, {
                                      action: 'approve',
                                      actorRole: 'super_admin',
                                      actorId: 'super_admin',
                                      actorName: userEmail,
                                    });
                                    onNotifySuccess(`تم اعتماد الصنف [${master.code}] رسمياً.`);
                                    reloadData();
                                  }}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  اعتماد
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setInspectMaster(master)}
                                className="px-2 py-1 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold hover:border-[#EA580C] cursor-pointer"
                              >
                                المواصفات والأسماء
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditMasterModal(master)}
                                className="p-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] cursor-pointer"
                                title="تعديل الصنف الأم"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {isArchived ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateOrProposeUnifiedMasterApi(master.code, {
                                      action: 'restore',
                                      actorRole: 'super_admin',
                                      actorId: 'super_admin',
                                      actorName: userEmail,
                                    });
                                    onNotifySuccess(`تمت استعادة الصنف [${master.code}] للنشط.`);
                                    reloadData();
                                  }}
                                  className="p-1.5 rounded-lg border border-emerald-400 text-emerald-700 cursor-pointer"
                                  title="استعادة من الأرشيف"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setArchiveTarget({ master, mode: 'archive' });
                                      setArchiveReason('');
                                    }}
                                    className="p-1.5 rounded-lg border border-amber-300 text-amber-700 cursor-pointer"
                                    title="أرشفة (للمستخدم سابقاً)"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setArchiveTarget({ master, mode: 'delete_unused' });
                                      setArchiveReason('');
                                    }}
                                    className="p-1.5 rounded-lg border border-rose-300 text-rose-600 cursor-pointer"
                                    title="حذف (غير مستخدم — مع حجز الكود)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: MATERIALS NOTIFICATIONS & CONTRIBUTIONS REVIEW             */}
      {/* ================================================================= */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black">
                  سجل إضافات وتعديلات ومقترحات الفنانين والموردين ({snapshot.notifications.filter((n) => n.eventType !== 'member_local_remove').length})
                </h2>
                <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8] mt-0.5">
                  ممنوع حذف أي خامة إلا بواسطة السوبر أدمن — هذا السجل يعرض الإضافات الجديدة والتعديلات ومقترحات الفنانين والموردين فقط.
                </p>
              </div>
            </div>

            {snapshot.notifications.filter((n) => n.eventType !== 'member_local_remove').length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-[#64748B]">
                لا توجد إشعارات أو مقترحات حالياً. أي خامة جديدة أو سماكات أو مسميات أو ماركات أو معادلات قياس يضيفها فنان أو مورد ستظهر هنا بالتفصيل مع رسالته المقترحة.
              </div>
            ) : (
              <div className="divide-y divide-[#EFE9DC] dark:divide-[#1E2E52]">
                {snapshot.notifications
                  .filter((n) => n.eventType !== 'member_local_remove')
                  .map((n) => {
                    const p = (n.payload || {}) as Record<string, any>;
                    const isContribution = p.kind === 'direct_contribution';
                    const addedAliases: string[] = Array.isArray(p.addedAliases) ? p.addedAliases : [];
                    const addedThicknesses: number[] = Array.isArray(p.addedThicknessesMm) ? p.addedThicknessesMm : [];
                    const addedSpecs: string[] = Array.isArray(p.addedSpecLabels) ? p.addedSpecLabels : [];
                    const addedBrands: string[] = Array.isArray(p.addedBrands) ? p.addedBrands : [];
                    const addedUnitEquations: string[] = Array.isArray(p.addedUnitEquations) ? p.addedUnitEquations : [];
                    const submittedBasePrice = Number(p.submittedBasePrice) > 0 ? Number(p.submittedBasePrice) : null;
                    const submittedBrandPrices: Record<string, number> =
                      p.submittedBrandPrices && typeof p.submittedBrandPrices === 'object'
                        ? p.submittedBrandPrices
                        : {};
                    const submittedBrandEntries = Object.entries(submittedBrandPrices).filter(([, v]) => Number(v) > 0);
                    const hasSubmittedPrices = submittedBasePrice !== null || submittedBrandEntries.length > 0;
                    const suggestionNote = typeof p.suggestionNote === 'string' ? p.suggestionNote.trim() : '';
                    const targetMaster = snapshot.masters.find((m) => m.code === n.targetCode);

                    const statusLabelAr: Record<string, string> = {
                      accepted_global: 'تم الاعتماد النهائي في المنظومة ✓',
                      kept_local: 'تمت المراجعة بدون تغيير',
                      archived: 'تمت الأرشفة من قِبل السوبر أدمن',
                      dismissed: 'تمت المراجعة وإغلاق الإشعار ✓',
                    };

                    return (
                      <div key={n.id} className="py-3.5 space-y-2.5">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                              <span className="font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-[#C2410C] dark:text-[#FBBF24]">
                                {n.targetCode}
                              </span>
                              <span className="text-[#0C1427] dark:text-[#F7F3EA]">{n.targetName}</span>
                              <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-800 dark:text-sky-200 text-[10px] font-black">
                                {hasSubmittedPrices && !addedAliases.length && !addedThicknesses.length && !addedBrands.length
                                  ? 'رصد وتحديث سعر عضو (للمراجعة)'
                                  : isContribution
                                  ? 'إضافة/تحديث مباشر على الصنف'
                                  : n.eventType === 'new_master'
                                  ? 'إضافة صنف خامة جديد'
                                  : n.eventType === 'new_spec'
                                  ? 'إضافة مقاس / مواصفة جديدة'
                                  : n.eventType === 'new_alias'
                                  ? 'إضافة مسمى دارج جديد'
                                  : 'مقترح تعديل على الصنف'}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                              بواسطة: <strong className="text-[#0C1427] dark:text-white">{n.actorName}</strong> (
                              {n.actorRole === 'supplier' ? 'مورد' : n.actorRole === 'super_admin' ? 'سوبر أدمن' : 'فنان'})
                              {n.createdAt && (
                                <span className="mr-2 text-[#64748B]">
                                  · {new Date(n.createdAt).toLocaleString('ar-EG')}
                                </span>
                              )}
                            </div>

                            {/* Structured summary of exact DB additions & price observations */}
                            {isContribution ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                                {addedAliases.length > 0 && (
                                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-900 dark:text-emerald-200">
                                    مسميات أُضيفت للقاعدة: {addedAliases.join(' · ')}
                                  </div>
                                )}
                                {addedThicknesses.length > 0 && (
                                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-900 dark:text-emerald-200">
                                    سماكات أُضيفت للقاعدة: {addedThicknesses.map((t) => `${t} مم`).join(' · ')}
                                  </div>
                                )}
                                {addedSpecs.length > 0 && (
                                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-900 dark:text-emerald-200">
                                    مواصفات أُضيفت للقاعدة: {addedSpecs.join(' · ')}
                                  </div>
                                )}
                                {addedBrands.length > 0 && (
                                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-900 dark:text-emerald-200">
                                    ماركات أُضيفت للقاعدة: {addedBrands.join(' · ')}
                                  </div>
                                )}
                                {addedUnitEquations.length > 0 && (
                                  <div className="sm:col-span-2 p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 font-bold text-sky-900 dark:text-sky-200">
                                    معادلات قياس أُضيفت للقاعدة: {addedUnitEquations.join('  |  ')}
                                  </div>
                                )}
                                {submittedBasePrice !== null && (
                                  <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 font-black text-amber-950 dark:text-amber-200">
                                    رصد سعر مبدئي مقترح: <span className="font-mono">{submittedBasePrice} ج.م</span>{' '}
                                    <span className="text-[10px] font-bold">(محفوظ للعضو فقط ولم يُغيّر السعر العام)</span>
                                  </div>
                                )}
                                {submittedBrandEntries.length > 0 && (
                                  <div className="sm:col-span-2 p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 font-bold text-amber-950 dark:text-amber-200">
                                    أسعار ماركات مرصودة:{' '}
                                    {submittedBrandEntries.map(([br, pr]) => `${br}: ${pr} ج.م`).join(' · ')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              n.reason && (
                                <div className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] bg-[#F7F3EA] dark:bg-[#132040] px-2.5 py-1.5 rounded-xl">
                                  التفاصيل: {n.reason}
                                </div>
                              )
                            )}

                            {/* Separate Advisory Suggestion Message Box (NOT written to DB fields) */}
                            {suggestionNote && (
                              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-400/60 text-xs space-y-1">
                                <div className="text-[10px] font-black text-[#C2410C] dark:text-[#FBBF24]">
                                  رسالة ومقترح العضو للسوبر أدمن (للعلم والمراجعة فقط — غير مضافة لحقول الخامة):
                                </div>
                                <p className="font-bold text-[#0C1427] dark:text-[#F7F3EA] leading-relaxed whitespace-pre-wrap">
                                  «{suggestionNote}»
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Crystal-Clear Action Buttons */}
                          {n.status === 'pending' ? (
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleResolveNotification(n.id, 'accept_global')}
                                title={
                                  hasSubmittedPrices
                                    ? 'اعتماد الأسعار المرصودة والإضافات كسعر مرجعي رسمي على مستوى المنظومة وإغلاق الإشعار'
                                    : 'تأكيد أن الإضافة/التعديل سليم ومعتمد رسمياً في منظومة الخامات وإغلاق الإشعار'
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer whitespace-nowrap transition"
                              >
                                {hasSubmittedPrices ? 'اعتماد السعر للمنظومة وإغلاق' : 'اعتماد الإضافة وإغلاق الإشعار'}
                              </button>
                              {targetMaster && (
                                <button
                                  type="button"
                                  onClick={() => openEditMasterModal(targetMaster)}
                                  title="فتح شاشة تعديل هذا الصنف لتطبيق مقترحات إضافية أو مراجعة بياناته"
                                  className="px-3 py-1.5 rounded-lg bg-[#0C1427] hover:bg-[#1A2B54] text-[#FBBF24] text-[11px] font-black cursor-pointer whitespace-nowrap transition"
                                >
                                  فتح وتعديل الصنف
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleResolveNotification(n.id, 'dismiss')}
                                title="تم الاطلاع على الإشعار بدون إجراء تغييرات إضافية"
                                className="px-3 py-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] text-[#0C1427] dark:text-[#F7F3EA] text-[11px] font-bold border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer whitespace-nowrap transition"
                              >
                                تم الاطلاع (إغلاق)
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                              {statusLabelAr[n.status] || 'تمت المراجعة ✓'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: BRANDS, UNIT CHAINS & BRIDGE FIELDS                        */}
      {/* ================================================================= */}
      {activeTab === 'brands_units' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Brands Registry */}
          <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] p-4 space-y-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#EA580C]" />
              <span>سجل الماركات المعتمد (B000..B053+)</span>
            </h2>

            <form onSubmit={handleAddBrand} className="flex flex-wrap gap-2">
              <input
                type="text"
                required
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="اسم الماركة الجديدة (تسلسل B054+)"
                className="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] text-xs font-bold outline-none"
              />
              <input
                type="text"
                value={newBrandCategory}
                onChange={(e) => setNewBrandCategory(e.target.value)}
                placeholder="التصنيف (اختياري)"
                className="w-36 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] text-xs font-bold outline-none"
              />
              <button
                type="submit"
                disabled={savingBrand}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
              >
                {savingBrand ? 'جاري...' : '+ إضافة ماركة'}
              </button>
            </form>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-[#EFE9DC] dark:divide-[#1E2E52] text-xs">
              {snapshot.brands.map((b) => (
                <div key={b.brandCode} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-black text-[#EA580C] dark:text-[#FBBF24] ml-2">
                      {b.brandCode}
                    </span>
                    <span className="font-bold">{b.brandName}</span>
                    {b.needsReview && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300 mr-2">
                        · للمراجعة ({b.reviewNote})
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#64748B]">{b.categoryHint}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unit Chains & Fixed Conversions */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] p-4 space-y-2.5">
              <h2 className="text-sm font-black">سلاسل الوحدات الجاهزة (ل1..ل8)</h2>
              <div className="divide-y divide-[#EFE9DC] dark:divide-[#1E2E52] text-xs">
                {snapshot.unitChains.map((u) => (
                  <div key={u.code} className="py-2 space-y-0.5">
                    <div className="font-black">
                      <span className="font-mono text-[#EA580C] dark:text-[#FBBF24] ml-1.5">{u.code}</span>
                      {u.titleAr}
                    </div>
                    <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      المورد: {u.supplierFlow} · الصرف: {u.issueUnits.join(' / ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] p-4 space-y-2">
              <h2 className="text-sm font-black">التحويلات الثابتة المعتمدة</h2>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono tabular-nums">
                {snapshot.fixedConversions.map((fc, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  >
                    {fc.labelAr}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: INSPECT MASTER SPECS (.01) & ALIASES (AL00001)             */}
      {/* ================================================================= */}
      {inspectMaster && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <div>
                <div className="font-mono text-xs font-black text-[#EA580C] dark:text-[#FBBF24]">
                  {inspectMaster.code} · سلسلة {inspectMaster.unitChain}
                </div>
                <h3 className="text-base font-black">{inspectMaster.canonicalName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectMaster(null)}
                className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Specs List & Add Spec */}
            <div className="space-y-3">
              <h4 className="text-xs font-black">المواصفات الفرعية (مستوى مخزن الفنان والوصفات: {inspectMaster.code}.xx)</h4>
              <div className="divide-y divide-[#EFE9DC] dark:divide-[#1E2E52] border border-[#D4CCBC] dark:border-[#22355E] rounded-xl px-3">
                {inspectedSpecs.length === 0 ? (
                  <div className="py-3 text-xs text-[#64748B]">لا توجد مواصفات مسجلة بعد لهذا الصنف.</div>
                ) : (
                  inspectedSpecs.map((s) => (
                    <div key={s.specCode} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-mono font-black text-[#EA580C] dark:text-[#FBBF24] ml-2">
                          {s.specCode}
                        </span>
                        <span className="font-bold">{s.label}</span>
                        {s.origin && <span className="text-[11px] text-[#64748B] mr-2">· المنشأ: {s.origin}</span>}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[#475569] dark:text-[#94A3B8]">
                        {s.bridgeValues?.weightPerMeterGrams ? `وزن_متر: ${s.bridgeValues.weightPerMeterGrams}جم ` : ''}
                        {s.bridgeValues?.packWeightGrams ? `عبوة: ${s.bridgeValues.packWeightGrams}جم ` : ''}
                        {s.bridgeValues?.packLengthMeters ? `طول: ${s.bridgeValues.packLengthMeters}م` : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddSpec} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#132040] text-xs">
                <input
                  type="text"
                  required
                  value={newSpecLabel}
                  onChange={(e) => setNewSpecLabel(e.target.value)}
                  placeholder="وصف المواصفة (مثلاً: قطن مجدول 6 مم)"
                  className="col-span-2 px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-bold outline-none"
                />
                <input
                  type="number"
                  step="0.1"
                  value={newSpecThickness}
                  onChange={(e) => setNewSpecThickness(e.target.value)}
                  placeholder="السُمك (مم)"
                  className="px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono outline-none"
                />
                <input
                  type="text"
                  value={newSpecOrigin}
                  onChange={(e) => setNewSpecOrigin(e.target.value)}
                  placeholder="المنشأ (مثل دمياطي)"
                  className="px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  value={newSpecWeightPerMeter}
                  onChange={(e) => setNewSpecWeightPerMeter(e.target.value)}
                  placeholder="جسر: وزن المتر (جم)"
                  className="px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono outline-none"
                />
                <input
                  type="number"
                  step="0.1"
                  value={newSpecPackWeight}
                  onChange={(e) => setNewSpecPackWeight(e.target.value)}
                  placeholder="جسر: وزن العبوة (جم)"
                  className="px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono outline-none"
                />
                <input
                  type="number"
                  step="0.1"
                  value={newSpecPackLength}
                  onChange={(e) => setNewSpecPackLength(e.target.value)}
                  placeholder="جسر: طول العبوة (م)"
                  className="px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono outline-none"
                />
                <button
                  type="submit"
                  disabled={savingDetail}
                  className="px-3 py-2 rounded-lg bg-[#EA580C] text-white font-black cursor-pointer"
                >
                  + إضافة مواصفة
                </button>
              </form>
            </div>

            {/* Aliases List & Add Alias */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black">جدول الأسماء المرتبطة (AL00001+)</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {inspectedAliases.map((a) => (
                  <span
                    key={a.aliasCode}
                    className="px-2.5 py-1 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  >
                    <span className="font-mono text-[#EA580C] ml-1">{a.aliasCode}</span>
                    {a.aliasName}
                    {a.contextHint ? ` (${a.contextHint})` : ''}
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddAlias} className="flex flex-wrap gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={newAliasName}
                  onChange={(e) => setNewAliasName(e.target.value)}
                  placeholder="اسم دارج جديد للفنان أو المورد..."
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] font-bold outline-none"
                />
                <select
                  value={newAliasType}
                  onChange={(e) => setNewAliasType(e.target.value as any)}
                  className="px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] font-bold outline-none"
                >
                  <option value="artisan">اسم فنان</option>
                  <option value="supplier">اسم مورد</option>
                  <option value="common">دارج عام</option>
                </select>
                <input
                  type="text"
                  value={newAliasContext}
                  onChange={(e) => setNewAliasContext(e.target.value)}
                  placeholder="السياق (مثل: خيط)"
                  className="w-32 px-3 py-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] outline-none"
                />
                <button
                  type="submit"
                  disabled={savingDetail}
                  className="px-4 py-2 rounded-lg bg-[#0C1427] dark:bg-[#FBBF24] text-white dark:text-[#0C1427] font-black cursor-pointer"
                >
                  + ربط اسم
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ADD / EDIT MASTER ITEM                                     */}
      {/* ================================================================= */}
      {isMasterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSaveMaster}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <h3 className="text-sm font-black">
                {editingMaster ? `تعديل الصنف الأم [${editingMaster.code}]` : 'إضافة صنف أم جديد بالكود التلقائي'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMasterModalOpen(false)}
                className="p-1.5 rounded-lg bg-[#EFE9DC] dark:bg-[#132040] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">القسم (البادئة)</label>
                <select
                  disabled={Boolean(editingMaster)}
                  value={formPrefix}
                  onChange={(e) => setFormPrefix(e.target.value as UnifiedCategoryPrefix)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] font-bold outline-none disabled:opacity-60"
                >
                  {snapshot.categories.map((c) => (
                    <option key={c.prefix} value={c.prefix}>
                      {c.prefix} — {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">سلسلة الوحدات</label>
                <select
                  value={formUnitChain}
                  onChange={(e) => setFormUnitChain(e.target.value as UnitChainCode)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] font-bold outline-none"
                >
                  {snapshot.unitChains.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code} — {u.titleAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">الاسم المعتمد (Canonical Name) *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثال: قطن مجدول"
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] font-bold outline-none"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">أسماء الفنانين (مفصولة بفاصلة)</label>
              <input
                type="text"
                value={formArtistAliasesText}
                onChange={(e) => setFormArtistAliasesText(e.target.value)}
                placeholder="مثال: خيط مكرمية، خيط سلب"
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">أسماء الموردين (مفصولة بفاصلة)</label>
              <input
                type="text"
                value={formSupplierAliasesText}
                onChange={(e) => setFormSupplierAliasesText(e.target.value)}
                placeholder="مثال: قطن مبروم، خرز على اتنين"
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">الورش المرتبطة (مفصولة بفاصلة)</label>
              <input
                type="text"
                value={formWorkshopsText}
                onChange={(e) => setFormWorkshopsText(e.target.value)}
                placeholder="مثال: مكرمية، زجزاج وحبال"
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">حقول الجسر المطلوبة</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(BRIDGE_FIELD_LABELS) as BridgeFieldKey[]).map((key) => {
                  const active = formBridgeFields.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setFormBridgeFields((prev) =>
                          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        active
                          ? 'bg-[#EA580C] text-white border-transparent'
                          : 'bg-[#F7F3EA] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                      }`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </div>

            {editingMaster && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-xs text-emerald-900 dark:text-emerald-200 inline-flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>التسعير المرجعي (سعر السوق العام وأسعار الماركات — ج.م)</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#64748B]">يُعتمد رسمياً على مستوى المنظومة</span>
                </div>

                <div>
                  <label className="block font-bold mb-1">متوسط سعر السوق العام للخامة (ج.م)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={formMarketBasePrice}
                    onChange={(e) => setFormMarketBasePrice(e.target.value)}
                    placeholder="مثال: 185"
                    className="w-full px-3 py-2 rounded-xl border border-emerald-500/40 bg-white dark:bg-[#132040] font-mono font-black outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold">أسعار الماركات المسجلة للصنف (ج.م)</label>
                  {Object.keys(formBrandPrices).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(formBrandPrices).map(([brName, prVal]) => (
                        <div
                          key={brName}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]"
                        >
                          <span className="font-bold text-[11px] truncate flex-1">{brName}</span>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={prVal}
                            onChange={(e) =>
                              setFormBrandPrices((prev) => ({ ...prev, [brName]: e.target.value }))
                            }
                            placeholder="اعتباري"
                            className="w-20 px-2 py-1 rounded-md border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#0D162E] font-mono font-black text-center outline-none"
                          />
                          <span className="text-[10px] font-bold text-[#64748B]">ج.م</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#64748B]">
                      لا توجد ماركات مسعّرة بعد لهذا الصنف — يمكنك إضافة ماركة وسعرها بالأسفل.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={formNewBrandName}
                      onChange={(e) => setFormNewBrandName(e.target.value)}
                      placeholder="اسم ماركة جديدة..."
                      className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={formNewBrandPrice}
                      onChange={(e) => setFormNewBrandPrice(e.target.value)}
                      placeholder="السعر (ج.م)"
                      className="w-24 px-2.5 py-1.5 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const br = formNewBrandName.trim();
                        if (!br) return;
                        setFormBrandPrices((prev) => ({
                          ...prev,
                          [br]: formNewBrandPrice.trim() || formMarketBasePrice || '',
                        }));
                        setFormNewBrandName('');
                        setFormNewBrandPrice('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0C1427] text-[#FBBF24] font-black cursor-pointer"
                    >
                      + إضافة سعر ماركة
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D4CCBC] dark:border-[#22355E]">
              <button
                type="button"
                onClick={() => setIsMasterModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingMaster}
                className="px-5 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer"
              >
                {savingMaster ? 'جاري الحفظ...' : 'حفظ ونشر'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ARCHIVE / DELETE UNUSED WITH REASON                        */}
      {/* ================================================================= */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4 text-xs">
            <h3 className="text-sm font-black">
              {archiveTarget.mode === 'archive'
                ? `أرشفة الصنف [${archiveTarget.master.code}]`
                : `حذف الصنف [${archiveTarget.master.code}] (حجز الكود)`}
            </h3>
            <p className="text-[#475569] dark:text-[#94A3B8]">
              {archiveTarget.mode === 'archive'
                ? 'إذا استخدم هذا الصنف من قبل في وصفات أو فواتير، تضمن الأرشفة عدم كسر أي سجلات سابقة.'
                : 'سيتم حذف الصنف من القائمة مع حجز الكود نهائياً بحيث لا يُعاد استخدامه لصنف آخر.'}
            </p>
            <input
              type="text"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="اكتب السبب (اختياري)..."
              className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-[#F7F3EA] dark:bg-[#132040] font-bold outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmArchiveOrDelete}
                className={`px-4 py-2 rounded-xl text-white font-black cursor-pointer ${
                  archiveTarget.mode === 'archive' ? 'bg-amber-600' : 'bg-rose-600'
                }`}
              >
                تأكيد التنفيذ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
