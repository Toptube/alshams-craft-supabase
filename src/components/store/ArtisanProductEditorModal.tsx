import React, { useState } from 'react';
import { SavedProductRecord } from '../../types';
import {
  ProductDiscountConfig,
  ProductSizeVariant,
} from '../../types/artisanStoreBuilder';
import { getCurrencyInfo, toEgpAmount } from '../../lib/currency';
import { compressImageFile, MAX_ITEM_IMAGES } from '../../utils/imageCompressor';
import {
  X,
  ArrowRight,
  Plus,
  Trash2,
  Upload,
  Check,
  Tag,
  Ruler,
  Palette,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  Save,
  Star,
} from 'lucide-react';

interface ArtisanProductEditorModalProps {
  product: SavedProductRecord;
  storeCurrency: string;
  onClose: () => void;
  onSave: (updated: SavedProductRecord) => Promise<void> | void;
}

export const ArtisanProductEditorModal: React.FC<ArtisanProductEditorModalProps> = ({
  product,
  storeCurrency,
  onClose,
  onSave,
}) => {
  const activeCurrency = getCurrencyInfo(product.sourceCurrency || storeCurrency || 'EGP');

  const [productName, setProductName] = useState(product.productName || '');
  const [storeDescription, setStoreDescription] = useState(
    product.storeDescription || (product as any).notes || ''
  );
  const [storePrice, setStorePrice] = useState<number>(
    Number(product.storePrice ?? product.retailPrice ?? 0)
  );
  const [isVisibleInStore, setIsVisibleInStore] = useState<boolean>(
    product.inStore !== false && product.isPublishedInStore !== false
  );
  const [isCustomOrderAvailable, setIsCustomOrderAvailable] = useState<boolean>(
    Boolean(product.isCustomOrderAvailable)
  );

  // Primary & Gallery Images
  const [primaryImage, setPrimaryImage] = useState<string>(
    product.imageUrl || '/alshams_falcon_emblem.png'
  );
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    Array.isArray(product.galleryUrls)
      ? product.galleryUrls.filter(Boolean).slice(0, MAX_ITEM_IMAGES - 1)
      : []
  );
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgLimitNotice, setImgLimitNotice] = useState('');

  // Colors
  const [colors, setColors] = useState<string[]>(
    Array.isArray(product.availableColors) ? product.availableColors : []
  );
  const [colorInput, setColorInput] = useState('');

  // Multi-size pricing variants
  const [sizeVariants, setSizeVariants] = useState<ProductSizeVariant[]>(() => {
    if (Array.isArray(product.sizeVariants) && product.sizeVariants.length > 0) {
      return product.sizeVariants.map((v, i) => ({
        id: v.id || `sz_${i}`,
        label: v.label,
        price: Number(v.price) || Number(product.storePrice ?? product.retailPrice ?? 0),
        egpPrice: v.egpPrice,
      }));
    }
    if (Array.isArray(product.availableSizes) && product.availableSizes.length > 0) {
      return product.availableSizes.map((lbl, i) => ({
        id: `sz_legacy_${i}`,
        label: lbl,
        price: Number(product.storePrice ?? product.retailPrice ?? 0),
      }));
    }
    return [];
  });
  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizePrice, setNewSizePrice] = useState<string>('');

  // Product Discount & Limited Time Offer
  const [discount, setDiscount] = useState<ProductDiscountConfig>(() => ({
    enabled: Boolean(product.productDiscount?.enabled),
    type: product.productDiscount?.type || 'percent',
    value: Number(product.productDiscount?.value ?? 10),
    isLimitedTime: Boolean(product.productDiscount?.isLimitedTime),
    endsAt: product.productDiscount?.endsAt || '',
    badgeText: product.productDiscount?.badgeText || 'عرض لفترة محدودة',
  }));

  const [saving, setSaving] = useState(false);

  const handleAddColor = () => {
    const clean = colorInput.trim();
    if (!clean) return;
    if (!colors.includes(clean)) {
      setColors((prev) => [...prev, clean]);
    }
    setColorInput('');
  };

  const handleAddSizeVariant = () => {
    const label = newSizeLabel.trim();
    if (!label) return;
    const priceNum = Number(newSizePrice) > 0 ? Number(newSizePrice) : storePrice;
    setSizeVariants((prev) => [
      ...prev,
      {
        id: `sz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        price: priceNum,
        egpPrice: toEgpAmount(priceNum, activeCurrency.code),
      },
    ]);
    setNewSizeLabel('');
    setNewSizePrice('');
  };

  const hasCustomPrimary = Boolean(
    primaryImage && primaryImage !== '/alshams_falcon_emblem.png'
  );
  const totalImagesCount = (hasCustomPrimary ? 1 : 0) + galleryUrls.length;
  const remainingImageSlots = Math.max(0, MAX_ITEM_IMAGES - totalImagesCount);

  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (remainingImageSlots <= 0) {
      setImgLimitNotice('الحد الأقصى المسموح به هو ٣ صور فقط لكل منتج لتخفيف مساحة قاعدة البيانات.');
      e.target.value = '';
      return;
    }

    setImgLimitNotice('');
    setUploadingImg(true);
    try {
      let slotsLeft = remainingImageSlots;
      for (const file of selectedFiles.slice(0, slotsLeft)) {
        const compressed = await compressImageFile(file, {
          maxWidth: 800,
          maxHeight: 800,
          targetMaxKb: 95,
          initialQuality: 0.78,
        });
        if (!primaryImage || primaryImage === '/alshams_falcon_emblem.png') {
          setPrimaryImage(compressed);
        } else {
          setGalleryUrls((prev) =>
            prev.length < MAX_ITEM_IMAGES - 1 ? [...prev, compressed] : prev
          );
        }
        slotsLeft -= 1;
      }
      if (selectedFiles.length > remainingImageSlots) {
        setImgLimitNotice('تم إضافة الحد الأقصى المسموح به فقط (٣ صور كحد أقصى لكل منتج).');
      }
    } catch {}
    setUploadingImg(false);
    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    const clean = imageUrlInput.trim();
    if (!clean) return;
    if (remainingImageSlots <= 0) {
      setImgLimitNotice('الحد الأقصى المسموح به هو ٣ صور فقط لكل منتج.');
      return;
    }
    setImgLimitNotice('');
    if (!primaryImage || primaryImage === '/alshams_falcon_emblem.png') {
      setPrimaryImage(clean);
    } else {
      setGalleryUrls((prev) =>
        prev.length < MAX_ITEM_IMAGES - 1 ? [...prev, clean] : prev
      );
    }
    setImageUrlInput('');
  };

  const handleSetAsPrimary = (url: string) => {
    const oldPrimary = primaryImage;
    setPrimaryImage(url);
    setGalleryUrls((prev) => {
      const filtered = prev.filter((u) => u !== url);
      if (oldPrimary && oldPrimary !== '/alshams_falcon_emblem.png' && oldPrimary !== url) {
        return [oldPrimary, ...filtered];
      }
      return filtered;
    });
  };

  const handleRemoveImage = (url: string, isPrimary: boolean) => {
    if (isPrimary) {
      if (galleryUrls.length > 0) {
        const [nextPrimary, ...rest] = galleryUrls;
        setPrimaryImage(nextPrimary);
        setGalleryUrls(rest);
      } else {
        setPrimaryImage('/alshams_falcon_emblem.png');
      }
    } else {
      setGalleryUrls((prev) => prev.filter((u) => u !== url));
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;
    setSaving(true);
    try {
      const normalizedVariants = sizeVariants
        .filter((v) => v.label.trim())
        .map((v) => ({
          ...v,
          label: v.label.trim(),
          price: Number(v.price) || storePrice,
          egpPrice: toEgpAmount(Number(v.price) || storePrice, activeCurrency.code),
        }));

      const updated: SavedProductRecord = {
        ...product,
        productName: productName.trim(),
        storeDescription: storeDescription.trim(),
        storePrice: Number(storePrice) || 0,
        retailPrice: Number(storePrice) || product.retailPrice || 0,
        sourceCurrency: activeCurrency.code,
        inStore: isVisibleInStore,
        isPublishedInStore: isVisibleInStore,
        isCustomOrderAvailable,
        imageUrl: primaryImage,
        galleryUrls,
        availableColors: colors,
        sizeVariants: normalizedVariants,
        availableSizes:
          normalizedVariants.length > 0
            ? normalizedVariants.map((v) => v.label)
            : product.availableSizes || [],
        productDiscount: discount,
        updatedAt: Date.now(),
      };
      await onSave(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const egpEquivalent = toEgpAmount(storePrice, activeCurrency.code);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-[#060B18]/80 backdrop-blur-sm"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSaveSubmit}
        className="w-full max-w-3xl max-h-[92vh] rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border-2 border-[#EA580C]/50 shadow-2xl flex flex-col overflow-hidden text-right text-[#0C1427] dark:text-[#F7F3EA]"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#E9E2D4] dark:bg-[#132040] border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer shrink-0"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm sm:text-base text-[#0C1427] dark:text-amber-300 truncate">
              تعديل بيانات وعرض المنتج: {product.productName}
            </h3>
            <p className="text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1] truncate">
              تحكم كامل بالسعر، المقاسات المتعددة، الخصم، الصور (حتى ٣ صور مضغوطة)، والظهور في متجرك وسوق الشمساوية
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer hover:border-[#EA580C] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Visibility & Custom Order Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsVisibleInStore((v) => !v)}
              className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                isVisibleInStore
                  ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                  : 'bg-[#E9E2D4] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1]'
              }`}
            >
              <span className="flex items-center gap-2 font-black">
                {isVisibleInStore ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{isVisibleInStore ? 'المنتج ظاهر للعملاء في المتجر' : 'المنتج مخفي مؤقتاً عن المتجر'}</span>
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isVisibleInStore ? 'bg-emerald-600 text-white' : 'bg-[#0C1427]/20'}`}>
                {isVisibleInStore ? 'ظاهر' : 'مخفي'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsCustomOrderAvailable((v) => !v)}
              className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                isCustomOrderAvailable
                  ? 'bg-[#FFEDD5] dark:bg-[#EA580C]/20 border-[#EA580C] text-[#9A3412] dark:text-[#FBBF24]'
                  : 'bg-[#E9E2D4] dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#475569] dark:text-[#CBD5E1]'
              }`}
            >
              <span className="flex items-center gap-2 font-black">
                <Sparkles className="w-4 h-4" />
                <span>تنفيذ خاص حسب طلب العميل</span>
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isCustomOrderAvailable ? 'bg-[#EA580C] text-white' : 'bg-[#0C1427]/20'}`}>
                {isCustomOrderAvailable ? 'مفعل' : 'معطل'}
              </span>
            </button>
          </div>

          {/* 1. Name, Description & Base Price */}
          <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-black mb-1">اسم المشغولة في المتجر *</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold outline-none focus:border-[#EA580C]"
                />
              </div>

              <div>
                <label className="block font-black mb-1">
                  السعر الأساسي ({activeCurrency.flag} {activeCurrency.symbol})
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={storePrice}
                  onChange={(e) => setStorePrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black outline-none focus:border-[#EA580C]"
                />
                {activeCurrency.code !== 'EGP' && (
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                    يعادل في سوق الشمساوية: {egpEquivalent.toLocaleString('ar-EG')} ج.م
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block font-black mb-1">وصف وتفاصيل المنتج التسويقية</label>
              <textarea
                rows={3}
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                placeholder="اكتب وصفاً جذاباً يوضح الخامة والملمس وطريقة العناية بالقطعة..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-medium outline-none focus:border-[#EA580C] resize-none"
              />
            </div>
          </div>

          {/* 2. Multi-Size Pricing Variants */}
          <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
                <Ruler className="w-4 h-4" />
                <span>المقاسات المتاحة وسعر كل مقاس</span>
              </h4>
              <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                أضف مقاساً، اثنين، أو ثلاثة وأكثر — يتغير السعر تلقائياً عند اختيار العميل للمقاس
              </span>
            </div>

            {sizeVariants.length > 0 && (
              <div className="space-y-2">
                {sizeVariants.map((sv, idx) => (
                  <div
                    key={sv.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E]"
                  >
                    <span className="w-6 h-6 rounded-lg bg-[#E9E2D4] dark:bg-[#132040] font-mono font-black text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={sv.label}
                      onChange={(e) =>
                        setSizeVariants((prev) =>
                          prev.map((item) => (item.id === sv.id ? { ...item, label: e.target.value } : item))
                        )
                      }
                      placeholder="المقاس (مثال: 60×80 سم)"
                      className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={sv.price}
                        onChange={(e) => {
                          const nextP = parseFloat(e.target.value) || 0;
                          setSizeVariants((prev) =>
                            prev.map((item) =>
                              item.id === sv.id
                                ? { ...item, price: nextP, egpPrice: toEgpAmount(nextP, activeCurrency.code) }
                                : item
                            )
                          );
                        }}
                        className="w-24 px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
                      />
                      <span className="font-bold text-[#475569] dark:text-[#94A3B8]">{activeCurrency.symbol}</span>
                    </div>
                    {activeCurrency.code !== 'EGP' && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                        = {toEgpAmount(sv.price, activeCurrency.code).toLocaleString('ar-EG')} ج.م
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSizeVariants((prev) => prev.filter((item) => item.id !== sv.id))}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
                      title="حذف المقاس"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
              <input
                type="text"
                value={newSizeLabel}
                onChange={(e) => setNewSizeLabel(e.target.value)}
                placeholder="أدخل المقاس الجديد (مثال: كبير 120×180 سم)"
                className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <input
                type="number"
                min={0}
                step="any"
                value={newSizePrice}
                onChange={(e) => setNewSizePrice(e.target.value)}
                placeholder={`السعر (${activeCurrency.symbol})`}
                className="w-32 px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-bold"
              />
              <button
                type="button"
                onClick={handleAddSizeVariant}
                className="px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مقاس</span>
              </button>
            </div>
          </div>

          {/* 3. Product Discount & Limited-Time Offer */}
          <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
                <Tag className="w-4 h-4" />
                <span>خصم وعرض خاص على هذا المنتج</span>
              </h4>
              <button
                type="button"
                onClick={() => setDiscount((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-3 py-1 rounded-xl font-black text-[11px] border cursor-pointer transition ${
                  discount.enabled
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-white dark:bg-[#060B18] border-[#D4CCBC] dark:border-[#22355E]'
                }`}
              >
                {discount.enabled ? 'الخصم مفعل ✓' : 'تفعيل خصم'}
              </button>
            </div>

            {discount.enabled && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-bold mb-1">نوع العرض</label>
                    <select
                      value={discount.type}
                      onChange={(e) => setDiscount((prev) => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    >
                      <option value="percent">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت ({activeCurrency.symbol})</option>
                      <option value="free_shipping">شحن مجاني للمنتج</option>
                    </select>
                  </div>

                  {discount.type !== 'free_shipping' && (
                    <div>
                      <label className="block font-bold mb-1">
                        {discount.type === 'percent' ? 'نسبة الخصم (%)' : `قيمة الخصم (${activeCurrency.symbol})`}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={discount.type === 'percent' ? 90 : undefined}
                        value={discount.value}
                        onChange={(e) =>
                          setDiscount((prev) => ({ ...prev, value: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-mono font-black"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold mb-1">نص الشارة على المنتج</label>
                    <input
                      type="text"
                      value={discount.badgeText || ''}
                      onChange={(e) => setDiscount((prev) => ({ ...prev, badgeText: e.target.value }))}
                      placeholder="عرض لفترة محدودة"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E]">
                  <label className="inline-flex items-center gap-2 font-black cursor-pointer">
                    <input
                      type="checkbox"
                      checked={discount.isLimitedTime}
                      onChange={(e) =>
                        setDiscount((prev) => ({ ...prev, isLimitedTime: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#EA580C]"
                    />
                    <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                    <span>تحديد كعرض لفترة محدودة (يظهر بشارة مميزة في سوق الشمساوية)</span>
                  </label>

                  {discount.isLimitedTime && (
                    <input
                      type="datetime-local"
                      value={discount.endsAt ? discount.endsAt.slice(0, 16) : ''}
                      onChange={(e) =>
                        setDiscount((prev) => ({
                          ...prev,
                          endsAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                        }))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-[11px]"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. Colors Manager */}
          <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
            <h4 className="font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
              <Palette className="w-4 h-4" />
              <span>الألوان المتاحة للعميل</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                >
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() => setColors((prev) => prev.filter((item) => item !== c))}
                    className="text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {colors.length === 0 && (
                <span className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  لم تتم إضافة ألوان محددة بعد (يمكن للعميل الطلب باللون الأصلي)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddColor();
                  }
                }}
                placeholder="أضف لوناً (مثال: بيج أوف وايت، كشمير، زيتي)..."
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <button
                type="button"
                onClick={handleAddColor}
                className="px-3.5 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white font-black cursor-pointer"
              >
                إضافة لون
              </button>
            </div>
          </div>

          {/* 5. Multi-Image Gallery Manager (Max 3 compressed images) */}
          <div className="p-4 rounded-2xl bg-[#F2ECE1] dark:bg-[#132040]/70 border border-[#D4CCBC] dark:border-[#22355E] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-black text-[#C2410C] dark:text-[#FBBF24] flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" />
                  <span>صور المنتج والمعرض ({totalImagesCount} / {MAX_ITEM_IMAGES} صور بحد أقصى)</span>
                </h4>
                <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] mt-0.5">
                  يتم ضغط الصور تلقائياً بصيغة ذكية لتقليل مساحة التخزين والحفاظ على سرعة التحميل
                </p>
              </div>
              {remainingImageSlots > 0 ? (
                <label className="px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-[11px] flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingImg ? 'جاري الضغط والرفع...' : `رفع صور (${remainingImageSlots} متاح)`}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadImageFile}
                    className="hidden"
                  />
                </label>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300/60 text-[10px] font-black">
                  اكتمل الحد الأقصى (٣ صور)
                </span>
              )}
            </div>
            {imgLimitNotice && (
              <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                {imgLimitNotice}
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {/* Primary Image */}
              <div className="relative rounded-xl overflow-hidden border-2 border-[#EA580C] aspect-square bg-white dark:bg-[#060B18]">
                <img src={primaryImage} alt="الرئيسية" className="w-full h-full object-cover" />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-[#EA580C] text-white text-[9px] font-black flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-white" />
                  <span>رئيسية</span>
                </span>
                {primaryImage !== '/alshams_falcon_emblem.png' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(primaryImage, true)}
                    className="absolute top-1 left-1 w-6 h-6 rounded-lg bg-rose-600/90 text-white flex items-center justify-center cursor-pointer"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Additional Gallery Photos */}
              {galleryUrls.map((url, idx) => (
                <div
                  key={`${idx}_${url.slice(0, 16)}`}
                  className="relative rounded-xl overflow-hidden border border-[#D4CCBC] dark:border-[#22355E] aspect-square bg-white dark:bg-[#060B18] group"
                >
                  <img src={url} alt={`صورة ${idx + 2}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleSetAsPrimary(url)}
                    className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-[#0C1427]/85 text-[#FBBF24] text-[9px] font-black cursor-pointer"
                    title="اجعلها الرئيسية"
                  >
                    رئيسية
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(url, false)}
                    className="absolute top-1 left-1 w-6 h-6 rounded-lg bg-rose-600/90 text-white flex items-center justify-center cursor-pointer"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {remainingImageSlots > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="أو الصق رابط صورة مباشر (https://...)"
                  dir="ltr"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#060B18] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-mono text-right"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-1.5 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
                >
                  إضافة رابط
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#E9E2D4] dark:bg-[#132040] border-t border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#475569] dark:text-[#CBD5E1] cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C2410C] via-[#EA580C] to-[#D97706] hover:from-[#9A3412] hover:to-[#EA580C] text-white font-black text-xs flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ والمزامنة...' : 'حفظ تعديلات المنتج ✓'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
