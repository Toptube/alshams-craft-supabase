import React, { useMemo, useState } from 'react';
import {
  DEFAULT_EXPERIENCE_MODE_CONFIG,
  EXPERIENCE_MODE_CATEGORY_LABELS,
  ModeItemAudience,
  ModeItemCategory,
  ModeTermMappingItem,
  normalizeExperienceModeConfig,
  PlatformExperienceModeConfig,
  UserExperienceMode,
} from '../../types/experienceMode';
import {
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';

interface AdminExperienceModePanelProps {
  value?: PlatformExperienceModeConfig;
  onChange: (next: PlatformExperienceModeConfig) => void;
}

const AUDIENCE_LABELS: Record<ModeItemAudience, string> = {
  artisan: 'الفنانين والورش',
  supplier: 'الموردين',
  both: 'مشترك (فنان ومورد)',
};

export const AdminExperienceModePanel: React.FC<AdminExperienceModePanelProps> = ({
  value,
  onChange,
}) => {
  const config = useMemo(() => normalizeExperienceModeConfig(value), [value]);
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'artisan' | 'supplier'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ModeItemCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New custom comparison row state
  const [newAudience, setNewAudience] = useState<ModeItemAudience>('artisan');
  const [newCategory, setNewCategory] = useState<ModeItemCategory>('navigation');
  const [newCraftLabel, setNewCraftLabel] = useState('');
  const [newAccountingLabel, setNewAccountingLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newVisibleInCraft, setNewVisibleInCraft] = useState(true);
  const [newVisibleInAccounting, setNewVisibleInAccounting] = useState(true);

  const allItems = useMemo(() => Object.values(config.items), [config.items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allItems.filter((item) => {
      if (audienceFilter !== 'all' && item.audience !== 'both' && item.audience !== audienceFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.craftLabel.toLowerCase().includes(q) ||
        item.accountingLabel.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [allItems, audienceFilter, categoryFilter, searchTerm]);

  const stats = useMemo(() => {
    const craftVisible = filteredItems.filter((i) => i.visibleInCraft).length;
    const craftHidden = filteredItems.length - craftVisible;
    const accVisible = filteredItems.filter((i) => i.visibleInAccounting).length;
    const accHidden = filteredItems.length - accVisible;
    return {
      total: filteredItems.length,
      craftVisible,
      craftHidden,
      accVisible,
      accHidden,
    };
  }, [filteredItems]);

  const updateItem = (itemId: string, patch: Partial<ModeTermMappingItem>) => {
    const target = config.items[itemId];
    if (!target) return;
    onChange({
      ...config,
      items: {
        ...config.items,
        [itemId]: {
          ...target,
          ...patch,
        },
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const resetSingleItem = (itemId: string) => {
    const def = DEFAULT_EXPERIENCE_MODE_CONFIG.items[itemId];
    if (def) {
      onChange({
        ...config,
        items: {
          ...config.items,
          [itemId]: { ...def },
        },
        updatedAt: new Date().toISOString(),
      });
    } else {
      const nextItems = { ...config.items };
      delete nextItems[itemId];
      onChange({
        ...config,
        items: nextItems,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleResetAll = () => {
    onChange({
      ...normalizeExperienceModeConfig(DEFAULT_EXPERIENCE_MODE_CONFIG),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCraftLabel.trim() || !newAccountingLabel.trim()) return;
    const id = `custom_${Date.now()}`;
    onChange({
      ...config,
      items: {
        ...config.items,
        [id]: {
          id,
          audience: newAudience,
          category: newCategory,
          craftLabel: newCraftLabel.trim(),
          accountingLabel: newAccountingLabel.trim(),
          visibleInCraft: newVisibleInCraft,
          visibleInAccounting: newVisibleInAccounting,
          description: newDescription.trim() || 'عنصر مقارنة مخصص بواسطة السوبر أدمن',
          isCustom: true,
        },
      },
      updatedAt: new Date().toISOString(),
    });
    setNewCraftLabel('');
    setNewAccountingLabel('');
    setNewDescription('');
    setShowAddForm(false);
  };

  const updateDefaultMode = (field: 'defaultArtisanMode' | 'defaultSupplierMode', mode: UserExperienceMode) => {
    onChange({
      ...config,
      [field]: mode,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Top Global Policy & Defaults Bar */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-[#0F172A] dark:text-white">
              لوحة مقارنة وتحكم الوضعين: الوضع الحرفي مقابل الوضع المحاسبي
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-1 max-w-3xl leading-relaxed">
              قارن كل مسمى وإذن وتقرير وبطاقة بين الوضع الحرفي (البسيط) والوضع المحاسبي (المتقدم) للفنانين والموردين، عدّل أي مسمى أو أخفه/أظهره في أي وضع، وسينعكس ذلك فوراً على كل الصفحات وعلى لغة وأزرار «شموسة».
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-3 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة عنصر مقارنة جديد</span>
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] text-xs font-bold text-[#475569] dark:text-[#CBD5E1] hover:border-rose-400 hover:text-rose-600 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي للوضعين</span>
            </button>
          </div>
        </div>

        {/* Default Mode Selectors + Switch Permission */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D4CCBC]/70 dark:border-[#22355E]">
          <div className="p-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2">
            <div className="text-xs font-black text-[#0F172A] dark:text-white">
              الوضع الافتراضي للفنانين والورش
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-[#EFE9DC] dark:bg-[#0D162E] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => updateDefaultMode('defaultArtisanMode', 'craft')}
                className={`py-1.5 px-2 rounded-md text-xs font-black transition-colors cursor-pointer ${
                  config.defaultArtisanMode === 'craft'
                    ? 'bg-emerald-600 text-white'
                    : 'text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                الوضع الحرفي
              </button>
              <button
                type="button"
                onClick={() => updateDefaultMode('defaultArtisanMode', 'accounting')}
                className={`py-1.5 px-2 rounded-md text-xs font-black transition-colors cursor-pointer ${
                  config.defaultArtisanMode === 'accounting'
                    ? 'bg-indigo-600 text-white'
                    : 'text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                الوضع المحاسبي
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2">
            <div className="text-xs font-black text-[#0F172A] dark:text-white">
              الوضع الافتراضي للموردين
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-[#EFE9DC] dark:bg-[#0D162E] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => updateDefaultMode('defaultSupplierMode', 'craft')}
                className={`py-1.5 px-2 rounded-md text-xs font-black transition-colors cursor-pointer ${
                  config.defaultSupplierMode === 'craft'
                    ? 'bg-emerald-600 text-white'
                    : 'text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                الوضع الحرفي
              </button>
              <button
                type="button"
                onClick={() => updateDefaultMode('defaultSupplierMode', 'accounting')}
                className={`py-1.5 px-2 rounded-md text-xs font-black transition-colors cursor-pointer ${
                  config.defaultSupplierMode === 'accounting'
                    ? 'bg-indigo-600 text-white'
                    : 'text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                الوضع المحاسبي
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-[#0F172A] dark:text-white">
                تبديل الوضع من الإعدادات
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                السماح للفنان والمورد بالتنقل بين الوضعين
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  allowUserModeSwitch: !config.allowUserModeSwitch,
                  updatedAt: new Date().toISOString(),
                })
              }
              className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer whitespace-nowrap ${
                config.allowUserModeSwitch
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {config.allowUserModeSwitch ? 'مسموح للجميع' : 'مقفل (افتراضي فقط)'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Custom Comparison Row Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddCustomItem}
          className="rounded-2xl bg-white dark:bg-[#0D162E] border border-[#EA580C]/50 p-4 space-y-3"
        >
          <div className="text-sm font-black text-[#0F172A] dark:text-white">
            إضافة عنصر مقارنة مخصص بين الوضعين
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-300 mb-1">
                الفئة المستهدفة
              </label>
              <select
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value as ModeItemAudience)}
                className="w-full h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                <option value="artisan">الفنانين والورش</option>
                <option value="supplier">الموردين</option>
                <option value="both">مشترك (فنان ومورد)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-300 mb-1">
                القسم
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ModeItemCategory)}
                className="w-full h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
              >
                {Object.entries(EXPERIENCE_MODE_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                الاسم في الوضع الحرفي
              </label>
              <input
                type="text"
                required
                value={newCraftLabel}
                onChange={(e) => setNewCraftLabel(e.target.value)}
                placeholder="مثال: فلوس ليك بره"
                className="w-full h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-emerald-400/60 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                الاسم في الوضع المحاسبي
              </label>
              <input
                type="text"
                required
                value={newAccountingLabel}
                onChange={(e) => setNewAccountingLabel(e.target.value)}
                placeholder="مثال: الذمم المدينة"
                className="w-full h-9 px-2.5 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-indigo-400/60 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="وصف مختصر لوظيفة هذا العنصر..."
              className="flex-1 min-w-[220px] h-9 px-3 rounded-lg bg-[#F7F3EA] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs"
            />
            <div className="flex items-center gap-3 text-xs font-bold">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newVisibleInCraft}
                  onChange={(e) => setNewVisibleInCraft(e.target.checked)}
                />
                <span>ظاهر بالحرفي</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newVisibleInAccounting}
                  onChange={(e) => setNewVisibleInAccounting(e.target.checked)}
                />
                <span>ظاهر بالمحاسبي</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
              >
                إضافة للجدول
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 rounded-xl border border-[#D4CCBC] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Bar + Tabular Summary Stats */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'artisan', label: 'الفنانين والورش' },
                { id: 'supplier', label: 'الموردين' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAudienceFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
                  audienceFilter === opt.id
                    ? 'bg-white dark:bg-[#0D162E] text-[#EA580C] shadow-sm'
                    : 'text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="h-9 px-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
          >
            <option value="all">كل الأقسام</option>
            {Object.entries(EXPERIENCE_MODE_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بأي مسمى..."
              className="w-full h-9 pr-8 pl-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-semibold"
            />
          </div>
        </div>

        {/* Clean Unboxed Tabular Summary */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold tabular-nums text-[#475569] dark:text-[#CBD5E1]">
          <span>إجمالي العناصر: {stats.total}</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-700 dark:text-emerald-400">
            الوضع الحرفي: {stats.craftVisible} ظاهر / {stats.craftHidden} مخفي
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-indigo-700 dark:text-indigo-400">
            الوضع المحاسبي: {stats.accVisible} ظاهر / {stats.accHidden} مخفي
          </span>
        </div>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="rounded-2xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[#EFE9DC] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] text-xs font-black text-[#0F172A] dark:text-white">
                <th className="py-3 px-4 min-w-[220px]">العنصر والوظيفة</th>
                <th className="py-3 px-4 min-w-[280px] text-emerald-800 dark:text-emerald-300">
                  الوضع الحرفي (المسمى + الظهور)
                </th>
                <th className="py-3 px-4 min-w-[280px] text-indigo-800 dark:text-indigo-300">
                  الوضع المحاسبي (المسمى + الظهور)
                </th>
                <th className="py-3 px-3 text-center w-[76px]">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9] dark:divide-[#1E2F54]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-xs text-[#64748B] dark:text-slate-400">
                    لا توجد عناصر مطابقة للبحث الحالي.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const defaultItem = DEFAULT_EXPERIENCE_MODE_CONFIG.items[item.id];
                  const isModified =
                    !defaultItem ||
                    defaultItem.craftLabel !== item.craftLabel ||
                    defaultItem.accountingLabel !== item.accountingLabel ||
                    defaultItem.visibleInCraft !== item.visibleInCraft ||
                    defaultItem.visibleInAccounting !== item.visibleInAccounting;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#FAF7F0] dark:hover:bg-[#111D38] transition-colors align-middle"
                    >
                      {/* Element Info */}
                      <td className="py-3 px-4">
                        <div className="text-xs font-bold text-[#0F172A] dark:text-white leading-snug">
                          {item.description || item.id}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>{AUDIENCE_LABELS[item.audience]}</span>
                          <span aria-hidden="true">·</span>
                          <span>{EXPERIENCE_MODE_CATEGORY_LABELS[item.category]}</span>
                          {isModified && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#EA580C] font-bold">معدّل</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Craft Mode Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.craftLabel}
                            onChange={(e) => updateItem(item.id, { craftLabel: e.target.value })}
                            className={`flex-1 h-9 px-2.5 rounded-lg border text-xs font-bold transition-colors ${
                              item.visibleInCraft
                                ? 'bg-[#F7F3EA] dark:bg-[#132040] border-emerald-300/80 dark:border-emerald-800/70 text-[#0F172A] dark:text-white'
                                : 'bg-slate-100 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 text-slate-400 line-through'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { visibleInCraft: !item.visibleInCraft })}
                            className={`h-9 px-2.5 rounded-lg text-xs font-black inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                              item.visibleInCraft
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-950/50'
                            }`}
                            title={item.visibleInCraft ? 'إخفاء في الوضع الحرفي' : 'إظهار في الوضع الحرفي'}
                          >
                            {item.visibleInCraft ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>ظاهر</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>مخفي</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Accounting Mode Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.accountingLabel}
                            onChange={(e) =>
                              updateItem(item.id, { accountingLabel: e.target.value })
                            }
                            className={`flex-1 h-9 px-2.5 rounded-lg border text-xs font-bold transition-colors ${
                              item.visibleInAccounting
                                ? 'bg-[#F7F3EA] dark:bg-[#132040] border-indigo-300/80 dark:border-indigo-800/70 text-[#0F172A] dark:text-white'
                                : 'bg-slate-100 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 text-slate-400 line-through'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.id, {
                                visibleInAccounting: !item.visibleInAccounting,
                              })
                            }
                            className={`h-9 px-2.5 rounded-lg text-xs font-black inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                              item.visibleInAccounting
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-950/50'
                            }`}
                            title={
                              item.visibleInAccounting
                                ? 'إخفاء في الوضع المحاسبي'
                                : 'إظهار في الوضع المحاسبي'
                            }
                          >
                            {item.visibleInAccounting ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>ظاهر</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>مخفي</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Row Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => resetSingleItem(item.id)}
                          disabled={!isModified && !item.isCustom}
                          title={item.isCustom ? 'حذف العنصر المخصص' : 'استعادة الافتراضي'}
                          className="p-2 rounded-lg border border-[#D4CCBC] dark:border-[#22355E] text-[#64748B] hover:text-rose-600 hover:border-rose-300 disabled:opacity-30 cursor-pointer"
                        >
                          {item.isCustom ? (
                            <Trash2 className="w-3.5 h-3.5" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
