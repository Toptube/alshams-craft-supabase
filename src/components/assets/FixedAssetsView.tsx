import React, { useState, useEffect, useMemo } from 'react';
import { FixedAsset, FixedAssetCategory, UserProfile } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { playSuccessSound, playButtonClickSound, playErrorSound } from '../../lib/sounds';
import { useTranslation } from '../../lib/i18n';
import {
  Hammer,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Calendar,
  DollarSign,
  TrendingDown,
  Building,
  CheckCircle2,
  AlertCircle,
  Archive,
  Layers,
  Printer,
  X,
  Check,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export interface FixedAssetsViewProps {
  profile?: UserProfile;
  workshop?: UserProfile;
  onGoBack?: () => void;
  onOpenHelp?: (section: any) => void;
}

const ASSET_CATEGORIES: Array<{ key: FixedAssetCategory; labelAr: string; labelEn: string }> = [
  { key: 'machinery', labelAr: 'آلات وماكينات تشغيل', labelEn: 'Machinery' },
  { key: 'equipment', labelAr: 'معدات وأدوات ورشة', labelEn: 'Workshop Equipment' },
  { key: 'electronics', labelAr: 'أجهزة إلكترونية وكمبيوتر', labelEn: 'Electronics & IT' },
  { key: 'furniture', labelAr: 'أثاث وتجهيزات معرض', labelEn: 'Furniture & Fixtures' },
  { key: 'vehicles', labelAr: 'سيارات ووسائل نقل', labelEn: 'Vehicles & Transport' },
  { key: 'tools', labelAr: 'عدد وقوالب يدوية', labelEn: 'Hand Tools & Molds' },
  { key: 'other', labelAr: 'أصول أخرى', labelEn: 'Other Assets' },
];

export const FixedAssetsView: React.FC<FixedAssetsViewProps> = ({ profile: propProfile, workshop, onGoBack, onOpenHelp: _onOpenHelp }) => {
  const profile = propProfile || workshop || ({} as UserProfile);
  const { t: tr, lang } = useTranslation();
  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const baseCurrency = profile.currency || 'EGP';

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  // Form Fields
  const [assetCode, setAssetCode] = useState('');
  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState<FixedAssetCategory>('machinery');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [purchaseCost, setPurchaseCost] = useState<number>(5000);
  const [scrapValue, setScrapValue] = useState<number>(500);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number>(5);
  const [depreciationMethod, setDepreciationMethod] = useState<'straight_line' | 'declining_balance'>('straight_line');
  const [location, setLocation] = useState('عنبر الإنتاج الرئيسي');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [status, setStatus] = useState<'active' | 'maintenance' | 'scrapped' | 'sold'>('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await tenantStorage.getFixedAssets(tenantId);
      // Recalculate dynamic accumulated depreciation based on current date
      const updated = data.map((a) => calculateAssetCurrentValues(a));
      setAssets(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();

    const handleUpdate = () => loadAssets();
    window.addEventListener('alshams_fixed_assets_changed', handleUpdate);
    return () => {
      window.removeEventListener('alshams_fixed_assets_changed', handleUpdate);
    };
  }, [tenantId]);

  // Dynamic depreciation computation
  const calculateAssetCurrentValues = (asset: FixedAsset): FixedAsset => {
    const cost = Number(asset.purchaseCost) || 0;
    const scrap = Number(asset.scrapValue) || 0;
    const lifeYears = Math.max(Number(asset.usefulLifeYears) || 1, 0.5);

    // Annual Straight-Line Depreciation
    const annualDep = Math.max((cost - scrap) / lifeYears, 0);

    // Elapsed time from purchase date
    const pDate = new Date(asset.purchaseDate || Date.now());
    const now = new Date();
    const diffMonths = Math.max((now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth()), 0);
    const elapsedYears = diffMonths / 12;

    const maxDepreciable = Math.max(cost - scrap, 0);
    const accumDep = Math.min(annualDep * elapsedYears, maxDepreciable);
    const bookVal = Math.max(cost - accumDep, scrap);

    return {
      ...asset,
      annualDepreciation: Math.round(annualDep * 100) / 100,
      accumulatedDepreciation: Math.round(accumDep * 100) / 100,
      currentBookValue: Math.round(bookVal * 100) / 100,
    };
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const activeAssets = assets.filter((a) => a.status === 'active');
    const totalCost = activeAssets.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0);
    const totalAccumDep = activeAssets.reduce((sum, a) => sum + (Number(a.accumulatedDepreciation) || 0), 0);
    const totalBookValue = activeAssets.reduce((sum, a) => sum + (Number(a.currentBookValue) || 0), 0);
    const totalAnnualDep = activeAssets.reduce((sum, a) => sum + (Number(a.annualDepreciation) || 0), 0);
    return {
      totalCost,
      totalAccumDep,
      totalBookValue,
      totalAnnualDep,
      count: assets.length,
    };
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        asset.assetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.assetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.location || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchCat = selectedCategory === 'all' || asset.category === selectedCategory;
      const matchStatus = statusFilter === 'all' || asset.status === statusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }, [assets, searchQuery, selectedCategory, statusFilter]);

  const handleOpenNewModal = () => {
    const nextCode = `AST-${String(assets.length + 1).padStart(3, '0')}`;
    setEditingAssetId(null);
    setAssetCode(nextCode);
    setAssetName('');
    setCategory('machinery');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseCost(10000);
    setScrapValue(1000);
    setUsefulLifeYears(5);
    setDepreciationMethod('straight_line');
    setLocation('عنبر الإنتاج الرئيسي');
    setResponsiblePerson(profile.artistName || '');
    setStatus('active');
    setNotes('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleEditAsset = (asset: FixedAsset) => {
    setEditingAssetId(asset.id);
    setAssetCode(asset.assetCode);
    setAssetName(asset.assetName);
    setCategory(asset.category as FixedAssetCategory);
    setPurchaseDate(asset.purchaseDate);
    setPurchaseCost(asset.purchaseCost);
    setScrapValue(asset.scrapValue);
    setUsefulLifeYears(asset.usefulLifeYears);
    setDepreciationMethod(asset.depreciationMethod);
    setLocation(asset.location || '');
    setResponsiblePerson(asset.responsiblePerson || '');
    setStatus(asset.status);
    setNotes(asset.notes || '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!assetName.trim()) {
      setErrorMsg('يرجى إدخال اسم الأصل.');
      return;
    }
    if (purchaseCost <= 0) {
      setErrorMsg('تكلفة الشراء يجب أن تكون أكبر من الصفر.');
      return;
    }
    if (scrapValue >= purchaseCost) {
      setErrorMsg('قيمة التخريد يجب أن تكون أقل من تكلفة الشراء.');
      return;
    }
    if (usefulLifeYears <= 0) {
      setErrorMsg('العمر الإنتاجي بالسنوات يجب أن يكون أكبر من الصفر.');
      return;
    }

    setSaving(true);
    try {
      const annualDep = Math.max((purchaseCost - scrapValue) / usefulLifeYears, 0);

      const pDate = new Date(purchaseDate);
      const now = new Date();
      const diffMonths = Math.max((now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth()), 0);
      const elapsedYears = diffMonths / 12;
      const maxDepreciable = Math.max(purchaseCost - scrapValue, 0);
      const accumDep = Math.min(annualDep * elapsedYears, maxDepreciable);
      const bookVal = Math.max(purchaseCost - accumDep, scrapValue);

      const assetPayload: FixedAsset = {
        id: editingAssetId || `asset_${Date.now()}`,
        tenantId,
        assetCode: assetCode.trim() || `AST-${Date.now().toString().slice(-4)}`,
        assetName: assetName.trim(),
        category,
        purchaseDate,
        purchaseCost,
        scrapValue,
        usefulLifeYears,
        annualDepreciation: Math.round(annualDep * 100) / 100,
        accumulatedDepreciation: Math.round(accumDep * 100) / 100,
        currentBookValue: Math.round(bookVal * 100) / 100,
        depreciationMethod,
        location: location.trim(),
        responsiblePerson: responsiblePerson.trim(),
        status,
        notes: notes.trim(),
        createdAt: editingAssetId ? (assets.find((a) => a.id === editingAssetId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
      };

      await tenantStorage.saveFixedAsset(assetPayload);
      playSuccessSound();
      setIsModalOpen(false);
      setSuccessNotice('تم حفظ بيانات الأصل الثابت بنجاح!');
      setTimeout(() => setSuccessNotice(''), 3000);
      loadAssets();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ الأصل');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الأصل "${name}"؟`)) return;
    try {
      await tenantStorage.deleteFixedAsset(tenantId, id);
      playSuccessSound();
      loadAssets();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300/40 dark:border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
            <Hammer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-100">
                إدارة الأصول الثابتة للورشة (Fixed Assets)
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono">
                ERP
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              تسجيل الماكينات والمعدات، تتبع الإهلاك السنوي، والقيمة الدفترية المربوطة بالتقارير المالية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل أصل جديد</span>
          </button>
        </div>
      </div>

      {successNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-[11px] font-bold text-stone-400 block mb-1">
            إجمالي تكلفة الأصول
          </span>
          <span className="text-base sm:text-lg font-black font-mono text-stone-900 dark:text-stone-100">
            {metrics.totalCost.toLocaleString()} <span className="text-xs font-sans font-bold text-stone-500">{baseCurrency}</span>
          </span>
          <span className="text-[10px] text-stone-400 block mt-1">
            {metrics.count} أصل مسجل
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-[11px] font-bold text-rose-500 block mb-1">
            مجمع الإهلاك المتراكم
          </span>
          <span className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-400">
            {metrics.totalAccumDep.toLocaleString()} <span className="text-xs font-sans font-bold text-stone-500">{baseCurrency}</span>
          </span>
          <span className="text-[10px] text-stone-400 block mt-1">
            مستهلك حتى اليوم
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-stone-900 border border-emerald-300/60 dark:border-emerald-800/60 shadow-xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
            صافي القيمة الدفترية
          </span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-300">
            {metrics.totalBookValue.toLocaleString()} <span className="text-xs font-sans font-bold text-stone-500">{baseCurrency}</span>
          </span>
          <span className="text-[10px] text-stone-400 block mt-1">
            صافي قيمة أصول الورشة
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block mb-1">
            قسط الإهلاك السنوي
          </span>
          <span className="text-base sm:text-lg font-black font-mono text-amber-700 dark:text-amber-400">
            {metrics.totalAnnualDep.toLocaleString()} <span className="text-xs font-sans font-bold text-stone-500">{baseCurrency}</span>
          </span>
          <span className="text-[10px] text-stone-400 block mt-1">
            يُحمل سنوياً على الأرباح والخسائر
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الأصل أو الكود أو الموقع..."
            className="w-full px-3.5 py-2 pr-9 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
          />
          <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
          >
            <option value="all">كل الفئات والتصنيفات</option>
            {ASSET_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.labelAr}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
          >
            <option value="all">كل الحالات</option>
            <option value="active">يعمل بالخدمة</option>
            <option value="maintenance">تحت الصيانة</option>
            <option value="scrapped">تم التخريد</option>
            <option value="sold">تم البيع</option>
          </select>
        </div>
      </div>

      {/* Assets Table / List */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-stone-400">
            جاري تحميل سجل الأصول الثابتة...
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Archive className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-xs font-bold text-stone-500">لا توجد أصول ثابتة مسجلة تطابق البحث.</p>
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="text-xs font-black text-amber-600 hover:underline cursor-pointer"
            >
              + إضافة أصل جديد الآن
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 text-stone-500 font-bold">
                <tr>
                  <th className="p-3.5">الكود والأصل</th>
                  <th className="p-3.5">التصنيف</th>
                  <th className="p-3.5">تاريخ الشراء</th>
                  <th className="p-3.5">تكلفة الشراء</th>
                  <th className="p-3.5">قيمة التخريد</th>
                  <th className="p-3.5">الإهلاك السنوي</th>
                  <th className="p-3.5">مجمع الإهلاك</th>
                  <th className="p-3.5">القيمة الدفترية</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                    <td className="p-3.5">
                      <div className="font-black text-stone-900 dark:text-stone-100">
                        {asset.assetName}
                      </div>
                      <div className="text-[10px] font-mono text-stone-400">
                        {asset.assetCode} {asset.location ? `• ${asset.location}` : ''}
                      </div>
                    </td>
                    <td className="p-3.5 text-stone-600 dark:text-stone-300 font-bold">
                      {ASSET_CATEGORIES.find((c) => c.key === asset.category)?.labelAr || asset.category}
                    </td>
                    <td className="p-3.5 font-mono text-stone-500">
                      {asset.purchaseDate}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-stone-800 dark:text-stone-200">
                      {asset.purchaseCost.toLocaleString()} {baseCurrency}
                    </td>
                    <td className="p-3.5 font-mono text-stone-500">
                      {asset.scrapValue.toLocaleString()} {baseCurrency}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-amber-700 dark:text-amber-400">
                      {asset.annualDepreciation.toLocaleString()} {baseCurrency}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {asset.accumulatedDepreciation.toLocaleString()} {baseCurrency}
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-700 dark:text-emerald-400">
                      {asset.currentBookValue.toLocaleString()} {baseCurrency}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                          asset.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : asset.status === 'maintenance'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {asset.status === 'active'
                          ? 'يعمل'
                          : asset.status === 'maintenance'
                          ? 'صيانة'
                          : asset.status === 'scrapped'
                          ? 'تخريد'
                          : 'مباع'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditAsset(asset)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                          title="تعديل الأصل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset.id, asset.assetName)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="حذف الأصل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: New / Edit Asset */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 space-y-4 text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Hammer className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-sm sm:text-base text-stone-900 dark:text-stone-100">
                  {editingAssetId ? 'تعديل بيانات الأصل الثابت' : 'تسجيل أصل ثابت جديد للورشة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveAsset} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    كود الأصل *
                  </label>
                  <input
                    type="text"
                    required
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    placeholder="مثال: AST-001"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    تصنيف الأصل *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FixedAssetCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
                  >
                    {ASSET_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.labelAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  اسم الأصل ووصفه *
                </label>
                <input
                  type="text"
                  required
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="مثال: ماكينة خياطة جوكي صناعية / نول خشب زان 2 متر"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    تاريخ الشراء *
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    تكلفة الشراء ({baseCurrency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    قيمة التخريد ({baseCurrency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={scrapValue}
                    onChange={(e) => setScrapValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    العمر الإنتاجي (بالسنوات) *
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={usefulLifeYears}
                    onChange={(e) => setUsefulLifeYears(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
                  />
                  <span className="text-[10px] text-stone-400 block mt-0.5">
                    الإهلاك السنوي المتوقع: {usefulLifeYears > 0 ? Math.round(((purchaseCost - scrapValue) / usefulLifeYears) * 100) / 100 : 0} {baseCurrency}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    طريقة الإهلاك
                  </label>
                  <select
                    value={depreciationMethod}
                    onChange={(e) => setDepreciationMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="straight_line">القسط الثابت (Straight-Line) - موصى به</option>
                    <option value="declining_balance">القسط المتناقص (Declining Balance)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    الموقع / القسم بالورشة
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثال: ورشة النجارة، خط التجميع..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                    حالة الأصل
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="active">يعمل بالخدمة</option>
                    <option value="maintenance">تحت الصيانة والإصلاح</option>
                    <option value="scrapped">تم التخريد</option>
                    <option value="sold">تم البيع والتنازل</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="رقم السيريال، المورد، الضمان، أي مواصفات خاصة..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none resize-none"
                />
              </div>

              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingAssetId ? 'تحديث بيانات الأصل' : 'حفظ وتسجيل الأصل'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
