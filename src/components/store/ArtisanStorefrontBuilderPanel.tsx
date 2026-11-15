import React, { useState } from 'react';
import {
  ArtisanStoreConfig,
  ArtisanPortfolioGalleryItem,
} from '../../types/artisanStoreBuilder';
import {
  MARKET_THEME_PRESETS,
  MarketThemePresetId,
  MarketCouponConfig,
  MarketCouponType,
  compressImageFileToDataUrl,
} from '../../types/marketplaceBuilder';
import { getCurrencyInfo } from '../../lib/currency';
import {
  Palette,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Check,
  Tag,
  Megaphone,
  Clock,
  Sparkles,
  Image as ImageIcon,
  Pause,
  Play,
  Copy,
  Save,
  ExternalLink,
  Phone,
  MessageCircle,
  Globe,
  Gift,
} from 'lucide-react';
import { ArtisanContactDisplayMode } from '../../types/artisanStoreBuilder';

interface ArtisanStorefrontBuilderPanelProps {
  mode: 'appearance' | 'promotions';
  config: ArtisanStoreConfig;
  saving: boolean;
  brandName?: string;
  artistName?: string;
  onChange: (next: ArtisanStoreConfig) => void;
  onSaveCloud: (next: ArtisanStoreConfig) => Promise<void> | void;
  onOpenPreview?: () => void;
}

export const ArtisanStorefrontBuilderPanel: React.FC<ArtisanStorefrontBuilderPanelProps> = ({
  mode,
  config,
  saving,
  brandName = 'متجر الورشة',
  artistName = 'فنان الشمساوية',
  onChange,
  onSaveCloud,
  onOpenPreview,
}) => {
  const activeCurr = getCurrencyInfo(config.storeCurrency);
  const previewTheme =
    MARKET_THEME_PRESETS[config.themePreset || 'shams_sand'] || MARKET_THEME_PRESETS.shams_sand;

  // Portfolio uploader temp state
  const [portTitle, setPortTitle] = useState('');
  const [portCaption, setPortCaption] = useState('');
  const [portAfterUrl, setPortAfterUrl] = useState('');
  const [portBeforeUrl, setPortBeforeUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  // Coupon creator state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<MarketCouponType>('percent');
  const [newCouponVal, setNewCouponVal] = useState('10');
  const [newCouponMin, setNewCouponMin] = useState('0');
  const [newCouponDesc, setNewCouponDesc] = useState('');

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await compressImageFileToDataUrl(file, 1440, 600, 0.8);
      const next = { ...config, coverUrl: url, showCover: true };
      onChange(next);
    } catch {}
    setUploadingCover(false);
    e.target.value = '';
  };

  const handleUploadPortImg = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'after' | 'before'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await compressImageFileToDataUrl(file, 1080, 1080, 0.8);
      if (target === 'after') setPortAfterUrl(url);
      else setPortBeforeUrl(url);
    } catch {}
    e.target.value = '';
  };

  const handleAddPortfolioItem = () => {
    if (!portAfterUrl) return;
    const item: ArtisanPortfolioGalleryItem = {
      id: `port_${Date.now()}`,
      title: portTitle.trim() || 'عمل فني منفذ بالورشة',
      imageUrl: portAfterUrl,
      beforeImageUrl: portBeforeUrl || undefined,
      caption: portCaption.trim() || undefined,
    };
    const next: ArtisanStoreConfig = {
      ...config,
      showPortfolioGallery: true,
      portfolioItems: [...(config.portfolioItems || []), item].slice(0, 8),
    };
    onChange(next);
    setPortTitle('');
    setPortCaption('');
    setPortAfterUrl('');
    setPortBeforeUrl('');
  };

  const handleAddCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCouponCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) return;
    const exists = config.coupons.some((c) => c.code.toUpperCase() === cleanCode);
    if (exists) return;

    const val = newCouponType === 'free_shipping' ? 0 : Math.max(1, Number(newCouponVal) || 10);
    const created: MarketCouponConfig = {
      id: `wcpn_${Date.now()}`,
      code: cleanCode,
      type: newCouponType,
      value: val,
      minOrder: Math.max(0, Number(newCouponMin) || 0),
      active: true,
      visible: true,
      description: newCouponDesc.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next: ArtisanStoreConfig = {
      ...config,
      couponsEnabled: true,
      coupons: [created, ...config.coupons],
    };
    onChange(next);
    onSaveCloud(next);
    setNewCouponCode('');
    setNewCouponDesc('');
  };

  const renderToggleChip = (checked: boolean, onToggle: () => void, onText = 'ظاهر', offText = 'مخفي') => (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer border transition shrink-0 ${
        checked
          ? 'bg-emerald-600 text-white border-emerald-500'
          : 'bg-[#E9E2D4] dark:bg-[#132040] text-[#475569] dark:text-[#94A3B8] border-[#D4CCBC] dark:border-[#22355E]'
      }`}
    >
      {checked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      <span>{checked ? onText : offText}</span>
    </button>
  );

  if (mode === 'appearance') {
    return (
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-5 text-xs">
        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
          <div>
            <h4 className="font-black text-sm text-[#C2410C] dark:text-amber-300">
              استوديو تصميم المتجر والهوية ومعرض الأعمال
            </h4>
            <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">
              اختر الثيم الخفيف، عدّل كل سطر وكلمة وأظهرها أو أخفها بضغطة واحدة
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenPreview && (
              <button
                type="button"
                onClick={onOpenPreview}
                className="px-3.5 py-2 rounded-xl bg-[#0C1427] dark:bg-[#132040] text-[#FBBF24] border border-[#22355E] font-black flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>معاينة المتجر العام</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSaveCloud(config)}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ تصميم المتجر ✓'}</span>
            </button>
          </div>
        </div>

        {/* 0. Instant Live Mini-Preview Card */}
        <div
          className="p-4 rounded-2xl border-2 space-y-3 transition-colors"
          style={{
            backgroundColor: previewTheme.pageBgLight,
            borderColor: previewTheme.borderLight,
            color: previewTheme.inkLight,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-xs flex items-center gap-1.5">
              <Eye className="w-4 h-4" style={{ color: previewTheme.accentBg }} />
              <span>معاينة فورية مصغرة لواجهة متجرك ({previewTheme.nameAr})</span>
            </span>
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-black text-white"
              style={{ backgroundColor: previewTheme.accentBg }}
            >
              تحديث مباشر
            </span>
          </div>

          <div
            className="rounded-xl border overflow-hidden"
            style={{
              backgroundColor: previewTheme.surfaceLight,
              borderColor: previewTheme.borderLight,
            }}
          >
            {config.showCover && config.coverUrl && (
              <div className="h-20 w-full overflow-hidden border-b" style={{ borderColor: previewTheme.borderLight }}>
                <img src={config.coverUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {config.promoBanner.enabled && (
              <div
                className="px-3 py-1 text-[10px] font-black text-white flex items-center justify-between"
                style={{ backgroundColor: config.promoBanner.bgColor || '#C2410C' }}
              >
                <span className="truncate">{config.promoBanner.text}</span>
                {config.promoBanner.showDiscountLabel && config.promoBanner.discountLabel && (
                  <span className="px-1.5 py-0.5 rounded bg-black/25 shrink-0">
                    {config.promoBanner.discountLabel}
                  </span>
                )}
              </div>
            )}
            <div className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-8 space-y-1">
                {config.showArtistSubtitle && (
                  <p className="text-[10px] font-bold" style={{ color: previewTheme.accentTextLight }}>
                    بأنامل: {artistName}
                    {config.showCraftBadge && config.craftBadge ? ` · ${config.craftBadge}` : ''}
                  </p>
                )}
                {config.showBrandTitle && (
                  <h6 className="font-black text-sm">{brandName}</h6>
                )}
                {config.showWelcomeMessage && (
                  <p className="text-[11px] opacity-85 line-clamp-1">{config.welcomeMessage}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                  <span
                    className="px-2 py-0.5 rounded-lg text-white font-bold"
                    style={{ backgroundColor: previewTheme.accentBg }}
                  >
                    {config.socialLinks?.displayMode === 'footer'
                      ? 'أيقونات التواصل بالتذييل'
                      : config.socialLinks?.displayMode === 'floating_bubble'
                      ? `فقاعة عائمة: ${config.socialLinks.bubbleLabel || 'تواصل معي'}`
                      : `التذييل + فقاعة (${config.socialLinks?.bubbleLabel || 'تواصل معي'})`}
                  </span>
                </div>
              </div>
              <div
                className="sm:col-span-4 rounded-xl border p-2 flex items-center justify-between gap-2"
                style={{
                  backgroundColor: previewTheme.pageBgLight,
                  borderColor: previewTheme.borderLight,
                }}
              >
                <div className="min-w-0">
                  <p className="font-black text-[11px] truncate">مشغولة يدوية مميزة</p>
                  <p className="font-mono font-black text-xs" style={{ color: previewTheme.accentTextLight }}>
                    450 {activeCurr.symbol}
                  </p>
                </div>
                <span
                  className="px-2 py-1 rounded-lg text-[10px] font-black text-white shrink-0"
                  style={{ backgroundColor: previewTheme.accentBg }}
                >
                  أضف للسلة
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Lightweight Themes */}
        <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
          <h5 className="font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#EA580C]" />
            <span>الثيمات الخفيفة الجميلة لمتجرك</span>
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(Object.keys(MARKET_THEME_PRESETS) as MarketThemePresetId[]).map((pid) => {
              const preset = MARKET_THEME_PRESETS[pid];
              const active = config.themePreset === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => onChange({ ...config, themePreset: pid })}
                  className={`p-3 rounded-2xl border-2 text-right transition cursor-pointer flex items-center justify-between gap-2.5 ${
                    active
                      ? 'border-[#EA580C] bg-[#FFEDD5]/60 dark:bg-[#EA580C]/15 shadow-sm'
                      : 'border-[#D4CCBC] dark:border-[#22355E] bg-[#F2ECE1] dark:bg-[#0D162E] hover:border-[#EA580C]/50'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-black text-xs text-[#0C1427] dark:text-[#F7F3EA] truncate">
                      {preset.nameAr}
                    </p>
                    <p className="text-[10px] text-[#475569] dark:text-[#94A3B8] line-clamp-1">
                      {preset.subtitleAr}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className="w-5 h-5 rounded-lg border border-black/15"
                      style={{ backgroundColor: preset.pageBgLight }}
                    />
                    <span
                      className="w-5 h-5 rounded-lg border border-black/15"
                      style={{ backgroundColor: preset.accentBg }}
                    />
                    {active && <Check className="w-4 h-4 text-[#EA580C] shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Cover Image Upload */}
        <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="font-black flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#EA580C]" />
              <span>صورة غلاف المتجر (Cover Banner)</span>
            </h5>
            {renderToggleChip(config.showCover, () => onChange({ ...config, showCover: !config.showCover }))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-56 h-24 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] overflow-hidden flex items-center justify-center shrink-0">
              {config.coverUrl ? (
                <img src={config.coverUrl} alt="غلاف المتجر" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] font-bold">بدون صورة غلاف مخصصة</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <label className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingCover ? 'جاري الرفع...' : 'رفع صورة غلاف من جهازك'}</span>
                <input type="file" accept="image/*" onChange={handleUploadCover} className="hidden" />
              </label>
              {config.coverUrl && (
                <button
                  type="button"
                  onClick={() => onChange({ ...config, coverUrl: '' })}
                  className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-bold cursor-pointer"
                >
                  إزالة الغلاف
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Fully Editable & Toggleable Copy / Identity */}
        <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
          <h5 className="font-black flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#EA580C]" />
            <span>نصوص المتجر وقصة الفنان (تحكم كامل في كل كلمة + إظهار/إخفاء)</span>
          </h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-black">رسالة الترحيب بالعملاء</label>
                {renderToggleChip(config.showWelcomeMessage, () =>
                  onChange({ ...config, showWelcomeMessage: !config.showWelcomeMessage })
                )}
              </div>
              <input
                type="text"
                value={config.welcomeMessage}
                onChange={(e) => onChange({ ...config, welcomeMessage: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-black">شارة الحرفة / الجودة</label>
                {renderToggleChip(config.showCraftBadge, () =>
                  onChange({ ...config, showCraftBadge: !config.showCraftBadge })
                )}
              </div>
              <input
                type="text"
                value={config.craftBadge}
                onChange={(e) => onChange({ ...config, craftBadge: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium"
              />
            </div>

            <div className="md:col-span-2 p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-black">قصة الفنان ونبذة عن الورشة</label>
                {renderToggleChip(config.showArtistStory, () =>
                  onChange({ ...config, showArtistStory: !config.showArtistStory })
                )}
              </div>
              <textarea
                rows={2}
                value={config.artistStory}
                onChange={(e) => onChange({ ...config, artistStory: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-black">ساعات عمل الورشة</label>
                {renderToggleChip(config.showWorkingHours, () =>
                  onChange({ ...config, showWorkingHours: !config.showWorkingHours })
                )}
              </div>
              <input
                type="text"
                value={config.workingHours}
                onChange={(e) => onChange({ ...config, workingHours: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-black">مدة التجهيز المعتادة</label>
                {renderToggleChip(config.showProductionTurnaround, () =>
                  onChange({ ...config, showProductionTurnaround: !config.showProductionTurnaround })
                )}
              </div>
              <input
                type="text"
                value={config.productionTurnaround}
                onChange={(e) => onChange({ ...config, productionTurnaround: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-black">جملة التنفيذ الخاص (Custom Order)</label>
                {renderToggleChip(config.showCustomOrderBadge, () =>
                  onChange({ ...config, showCustomOrderBadge: !config.showCustomOrderBadge })
                )}
              </div>
              <input
                type="text"
                value={config.customOrderBadgeText}
                onChange={(e) => onChange({ ...config, customOrderBadgeText: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2">
              <span className="font-black">عناصر الترويسة والتواصل:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...config, showPhoneButtons: !config.showPhoneButtons })}
                  className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${
                    config.showPhoneButtons ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white dark:bg-[#060B18]'
                  }`}
                >
                  أزرار التواصل {config.showPhoneButtons ? '✓' : '✕'}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, showDeliveryBadge: !config.showDeliveryBadge })}
                  className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${
                    config.showDeliveryBadge ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white dark:bg-[#060B18]'
                  }`}
                >
                  جملة التوصيل {config.showDeliveryBadge ? '✓' : '✕'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3.5 Contact Channels, Social Links & Floating "تواصل معي" Bubble Dock */}
        <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h5 className="font-black flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#EA580C]" />
                <span>قنوات التواصل والروابط الاجتماعية + زر "تواصل معي" العائم</span>
              </h5>
              <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                فعّل القنوات التي يظهر بها متجرك، واختر عرضها في تذييل الصفحة أو داخل جعبة عائمة تنبثق أيقوناتها للعميل.
              </p>
            </div>
          </div>

          {/* Display Mode & Floating Pouch Label */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">مكان ظهور قنوات التواصل للعميل</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'both' as ArtisanContactDisplayMode, label: 'التذييل + الجعبة العائمة ✨' },
                  { id: 'floating_bubble' as ArtisanContactDisplayMode, label: 'الجعبة العائمة فقط 🎈' },
                  { id: 'footer' as ArtisanContactDisplayMode, label: 'تذييل الصفحة فقط 📌' },
                ].map((opt) => {
                  const active = (config.socialLinks?.displayMode || 'both') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...config,
                          socialLinks: { ...config.socialLinks, displayMode: opt.id },
                        })
                      }
                      className={`px-2.5 py-2 rounded-xl border text-[11px] font-black cursor-pointer transition text-center ${
                        active
                          ? 'bg-[#EA580C] text-white border-[#C2410C] shadow-xs'
                          : 'bg-[#F2ECE1] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">عنوان الجعبة العائمة</label>
              <input
                type="text"
                value={config.socialLinks?.bubbleLabel ?? 'تواصل معي'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    socialLinks: { ...config.socialLinks, bubbleLabel: e.target.value },
                  })
                }
                placeholder="تواصل معي"
                className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
            </div>
          </div>

          {/* Individual Channel Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                key: 'phone' as const,
                toggleKey: 'showPhone' as const,
                label: 'رقم الهاتف المباشر',
                placeholder: '010XXXXXXXX',
                icon: Phone,
                dir: 'ltr' as const,
              },
              {
                key: 'whatsapp' as const,
                toggleKey: 'showWhatsapp' as const,
                label: 'رقم الواتساب',
                placeholder: '010XXXXXXXX',
                icon: MessageCircle,
                dir: 'ltr' as const,
              },
              {
                key: 'facebook' as const,
                toggleKey: 'showFacebook' as const,
                label: 'فيسبوك (رابط أو اسم الصفحة)',
                placeholder: 'https://facebook.com/...',
                icon: Globe,
                dir: 'ltr' as const,
              },
              {
                key: 'instagram' as const,
                toggleKey: 'showInstagram' as const,
                label: 'إنستجرام (رابط أو @username)',
                placeholder: '@workshop_art',
                icon: Globe,
                dir: 'ltr' as const,
              },
              {
                key: 'tiktok' as const,
                toggleKey: 'showTiktok' as const,
                label: 'تيك توك',
                placeholder: '@workshop_tiktok',
                icon: Globe,
                dir: 'ltr' as const,
              },
              {
                key: 'youtube' as const,
                toggleKey: 'showYoutube' as const,
                label: 'قناة يوتيوب',
                placeholder: 'https://youtube.com/...',
                icon: Globe,
                dir: 'ltr' as const,
              },
              {
                key: 'website' as const,
                toggleKey: 'showWebsite' as const,
                label: 'موقع إلكتروني / معرض خارجي',
                placeholder: 'https://...',
                icon: Globe,
                dir: 'ltr' as const,
              },
            ].map((field) => {
              const IconComp = field.icon;
              const isVisible = config.socialLinks?.[field.toggleKey] !== false;
              const val = config.socialLinks?.[field.key] || '';
              return (
                <div
                  key={field.key}
                  className={`p-2.5 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5 ${
                    field.key === 'website' ? 'sm:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-black flex items-center gap-1.5 text-[11px]">
                      <IconComp className="w-3.5 h-3.5 text-[#EA580C]" />
                      <span>{field.label}</span>
                    </label>
                    {renderToggleChip(isVisible, () =>
                      onChange({
                        ...config,
                        socialLinks: {
                          ...config.socialLinks,
                          [field.toggleKey]: !isVisible,
                        },
                      })
                    )}
                  </div>
                  <input
                    type="text"
                    dir={field.dir}
                    value={val}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        socialLinks: {
                          ...config.socialLinks,
                          [field.key]: e.target.value,
                        },
                      })
                    }
                    placeholder={field.placeholder}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-[11px] text-right"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Before / After Portfolio Gallery */}
        <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="font-black flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#EA580C]" />
              <span>معرض الأعمال السابقة ولمسات التنفيذ (قبل / بعد)</span>
            </h5>
            {renderToggleChip(config.showPortfolioGallery, () =>
              onChange({ ...config, showPortfolioGallery: !config.showPortfolioGallery })
            )}
          </div>

          <input
            type="text"
            value={config.portfolioTitle}
            onChange={(e) => onChange({ ...config, portfolioTitle: e.target.value })}
            placeholder="عنوان قسم معرض الأعمال"
            className="w-full px-3 py-1.5 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
          />

          {config.portfolioItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {config.portfolioItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] space-y-1.5 relative"
                >
                  <div className="grid grid-cols-2 gap-1 h-24 rounded-lg overflow-hidden">
                    {item.beforeImageUrl ? (
                      <img src={item.beforeImageUrl} alt="قبل" className="w-full h-full object-cover" />
                    ) : null}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className={`w-full h-full object-cover ${!item.beforeImageUrl ? 'col-span-2' : ''}`}
                    />
                  </div>
                  <p className="font-black truncate text-[11px]">{item.title}</p>
                  {item.caption && <p className="text-[10px] text-[#475569] dark:text-[#94A3B8] truncate">{item.caption}</p>}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...config,
                        portfolioItems: config.portfolioItems.filter((i) => i.id !== item.id),
                      })
                    }
                    className="absolute top-3 left-3 w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new showcase item */}
          <div className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-dashed border-[#D4CCBC] dark:border-[#22355E] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={portTitle}
                onChange={(e) => setPortTitle(e.target.value)}
                placeholder="اسم العمل (مثال: ستارة مكرمية 3 متر)"
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <input
                type="text"
                value={portCaption}
                onChange={(e) => setPortCaption(e.target.value)}
                placeholder="وصف مختصر (مثال: تم التنفيذ لعميلة بالقاهرة)"
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer">
                {portAfterUrl ? '✓ صورة العمل (بعد)' : '+ صورة العمل (بعد) *'}
                <input type="file" accept="image/*" onChange={(e) => handleUploadPortImg(e, 'after')} className="hidden" />
              </label>
              <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer">
                {portBeforeUrl ? '✓ صورة (قبل) اختياري' : '+ صورة (قبل) اختياري'}
                <input type="file" accept="image/*" onChange={(e) => handleUploadPortImg(e, 'before')} className="hidden" />
              </label>
              <button
                type="button"
                disabled={!portAfterUrl}
                onClick={handleAddPortfolioItem}
                className="px-4 py-1.5 rounded-lg bg-[#EA580C] text-white font-black cursor-pointer disabled:opacity-40"
              >
                إضافة للمعرض
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Promotions & Store Coupons Mode
  return (
    <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D4CCBC] dark:border-[#22355E]">
        <div>
          <h4 className="font-black text-sm text-[#C2410C] dark:text-amber-300">
            البانر الإعلاني للمتجر وأكواد خصم الفنان
          </h4>
          <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">
            أنشئ عروضاً لفترة محدودة أو خصماً عند الوصول لحد شراء معين + أكواد خصم يطبقها العميل في السلة
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSaveCloud(config)}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] text-white font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'جاري الحفظ...' : 'حفظ العروض والأكواد ✓'}</span>
        </button>
      </div>

      {/* 1. Store Promo Banner */}
      <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h5 className="font-black flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#EA580C]" />
            <span>بانر العرض الترويجي داخل متجرك</span>
          </h5>
          {renderToggleChip(
            config.promoBanner.enabled,
            () =>
              onChange({
                ...config,
                promoBanner: { ...config.promoBanner, enabled: !config.promoBanner.enabled },
              }),
            'البانر ظاهر',
            'البانر مخفي'
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block font-bold mb-1">شرط العرض</label>
            <select
              value={config.promoBanner.triggerType}
              onChange={(e) =>
                onChange({
                  ...config,
                  promoBanner: { ...config.promoBanner, triggerType: e.target.value as any },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
            >
              <option value="limited_time">عرض لفترة محدودة ⏳</option>
              <option value="min_order">عند الوصول لحد شراء معين 🛍️</option>
              <option value="always">إعلان مستمر في المتجر ✨</option>
            </select>
          </div>

          {config.promoBanner.triggerType === 'limited_time' && (
            <div>
              <label className="block font-bold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>ينتهي العرض في:</span>
              </label>
              <input
                type="datetime-local"
                value={config.promoBanner.endsAt ? config.promoBanner.endsAt.slice(0, 16) : ''}
                onChange={(e) =>
                  onChange({
                    ...config,
                    promoBanner: {
                      ...config.promoBanner,
                      endsAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-[11px]"
              />
            </div>
          )}

          {config.promoBanner.triggerType === 'min_order' && (
            <div>
              <label className="block font-bold mb-1">حد الشراء ({activeCurr.symbol})</label>
              <input
                type="number"
                min={0}
                value={config.promoBanner.minOrderAmount || 0}
                onChange={(e) =>
                  onChange({
                    ...config,
                    promoBanner: {
                      ...config.promoBanner,
                      minOrderAmount: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
              />
            </div>
          )}

          <div>
            <label className="block font-bold mb-1">لون البانر</label>
            <div className="flex items-center gap-2 pt-1">
              {['#C2410C', '#0C1427', '#065F46', '#7C2D12'].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...config,
                      promoBanner: { ...config.promoBanner, bgColor: hex },
                    })
                  }
                  className={`w-7 h-7 rounded-lg border-2 cursor-pointer ${
                    config.promoBanner.bgColor === hex ? 'border-amber-400 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="block font-bold mb-1">النص التسويقي الرئيسي للبانر</label>
            <input
              type="text"
              value={config.promoBanner.text}
              onChange={(e) =>
                onChange({
                  ...config,
                  promoBanner: { ...config.promoBanner, text: e.target.value },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold">النص الفرعي الإضافي</label>
                {renderToggleChip(config.promoBanner.showSubText, () =>
                  onChange({
                    ...config,
                    promoBanner: {
                      ...config.promoBanner,
                      showSubText: !config.promoBanner.showSubText,
                    },
                  })
                )}
              </div>
              <input
                type="text"
                value={config.promoBanner.subText}
                onChange={(e) =>
                  onChange({
                    ...config,
                    promoBanner: { ...config.promoBanner, subText: e.target.value },
                  })
                }
                className="w-full px-3 py-1.5 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold">وسم الخصم المميز بالبانر</label>
                {renderToggleChip(config.promoBanner.showDiscountLabel, () =>
                  onChange({
                    ...config,
                    promoBanner: {
                      ...config.promoBanner,
                      showDiscountLabel: !config.promoBanner.showDiscountLabel,
                    },
                  })
                )}
              </div>
              <input
                type="text"
                value={config.promoBanner.discountLabel}
                onChange={(e) =>
                  onChange({
                    ...config,
                    promoBanner: { ...config.promoBanner, discountLabel: e.target.value },
                  })
                }
                className="w-full px-3 py-1.5 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-black"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 1.5 Workshop Automatic Bundle Deals ("اشتري X واحصل على خصم") */}
      <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="font-black flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#EA580C]" />
              <span>عروض الباقات التلقائية بالسلة (اشتري أكثر ووفّر)</span>
            </h5>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              عند تفعيل العرض، يُحسب الخصم تلقائياً في سلة العميل بمجرد شراء العدد المحدد من قطع ورشتك.
            </p>
          </div>
          {renderToggleChip(
            config.bundleDeal?.enabled ?? false,
            () =>
              onChange({
                ...config,
                bundleDeal: {
                  ...config.bundleDeal,
                  enabled: !(config.bundleDeal?.enabled ?? false),
                },
              }),
            'عرض الباقة مفعل',
            'عرض الباقة متوقف'
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block font-bold mb-1">الحد الأدنى لعدد القطع</label>
            <input
              type="number"
              min={2}
              max={20}
              value={config.bundleDeal?.minQuantity ?? 2}
              onChange={(e) =>
                onChange({
                  ...config,
                  bundleDeal: {
                    ...config.bundleDeal,
                    minQuantity: Math.max(2, parseInt(e.target.value, 10) || 2),
                  },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">نوع الخصم</label>
            <select
              value={config.bundleDeal?.discountType || 'percent'}
              onChange={(e) =>
                onChange({
                  ...config,
                  bundleDeal: {
                    ...config.bundleDeal,
                    discountType: e.target.value === 'fixed' ? 'fixed' : 'percent',
                  },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
            >
              <option value="percent">نسبة مئوية %</option>
              <option value="fixed">مبلغ ثابت بالجنيه (ج.م)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1">
              قيمة الخصم ({config.bundleDeal?.discountType === 'fixed' ? 'ج.م' : '%'})
            </label>
            <input
              type="number"
              min={0}
              max={config.bundleDeal?.discountType === 'fixed' ? 50000 : 80}
              value={config.bundleDeal?.discountValue ?? 10}
              onChange={(e) =>
                onChange({
                  ...config,
                  bundleDeal: {
                    ...config.bundleDeal,
                    discountValue: Math.max(0, parseFloat(e.target.value) || 0),
                  },
                })
              }
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold mb-1">النص التحفيزي الظاهر فوق المنتجات وداخل السلة</label>
          <input
            type="text"
            value={
              config.bundleDeal?.label ??
              'عرض الباقة: اشترِ قطعتين أو أكثر واحصل على خصم إضافي تلقائي بالسلة'
            }
            onChange={(e) =>
              onChange({
                ...config,
                bundleDeal: {
                  ...config.bundleDeal,
                  label: e.target.value,
                },
              })
            }
            className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
          />
        </div>
      </div>

      {/* 2. Store Coupons */}
      <div className="p-4 rounded-2xl bg-[#F7F3EA] dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h5 className="font-black flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#EA580C]" />
            <span>أكواد خصم متجرك الخاصة</span>
          </h5>
          {renderToggleChip(
            config.couponsEnabled,
            () => onChange({ ...config, couponsEnabled: !config.couponsEnabled }),
            'الأكواد مفعلة',
            'الأكواد موقوفة'
          )}
        </div>

        <form onSubmit={handleAddCoupon} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block font-bold mb-1">الكود *</label>
            <input
              type="text"
              value={newCouponCode}
              onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
              placeholder="ART10"
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black uppercase"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">نوع الخصم</label>
            <select
              value={newCouponType}
              onChange={(e) => setNewCouponType(e.target.value as MarketCouponType)}
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
            >
              <option value="percent">نسبة %</option>
              <option value="fixed">مبلغ بالجنيه (ج.م)</option>
              <option value="free_shipping">شحن مجاني 🚚</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">القيمة</label>
            <input
              type="number"
              min={0}
              disabled={newCouponType === 'free_shipping'}
              value={newCouponType === 'free_shipping' ? '0' : newCouponVal}
              onChange={(e) => setNewCouponVal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">حد أدنى للطلب (ج.م)</label>
            <input
              type="number"
              min={0}
              value={newCouponMin}
              onChange={(e) => setNewCouponMin(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black flex items-center justify-center gap-1 cursor-pointer h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة كود</span>
          </button>
        </form>

        {config.coupons.length === 0 ? (
          <p className="text-center py-4 text-[#475569] dark:text-[#94A3B8] font-bold">
            لا توجد أكواد خصم لمتجرك حتى الآن — أضف أول كود بالأعلى ليستخدمه عملاؤك في السلة.
          </p>
        ) : (
          <div className="space-y-2">
            {config.coupons.map((cpn) => (
              <div
                key={cpn.id}
                className="p-3 rounded-xl bg-[#F2ECE1] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg bg-[#0C1427] text-[#FBBF24] font-mono font-black">
                    {cpn.code}
                  </span>
                  <span className="font-black text-[#C2410C] dark:text-[#FBBF24]">
                    {cpn.type === 'free_shipping'
                      ? 'شحن مجاني'
                      : cpn.type === 'percent'
                      ? `خصم ${cpn.value}%`
                      : `خصم ${cpn.value} ج.م`}
                  </span>
                  {cpn.minOrder && cpn.minOrder > 0 ? (
                    <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] font-bold">
                      (حد أدنى {cpn.minOrder} ج.م)
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(cpn.code)}
                    className="p-1.5 rounded-lg bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] cursor-pointer"
                    title="نسخ الكود"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = {
                        ...config,
                        coupons: config.coupons.map((c) =>
                          c.id === cpn.id ? { ...c, active: !c.active } : c
                        ),
                      };
                      onChange(next);
                      onSaveCloud(next);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-black text-[11px] flex items-center gap-1 cursor-pointer ${
                      cpn.active ? 'bg-amber-100 text-amber-900' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {cpn.active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{cpn.active ? 'إيقاف' : 'تفعيل'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = {
                        ...config,
                        coupons: config.coupons.filter((c) => c.id !== cpn.id),
                      };
                      onChange(next);
                      onSaveCloud(next);
                    }}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                    title="حذف الكود"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
