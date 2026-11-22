import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  ImagePlus,
  Link as LinkIcon,
  Video,
  Store,
  BookOpen,
  Sparkles,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { SavedProductRecord, UserProfile, CraftCategory } from '../../types';
import { MAIN_SECTIONS, SUB_CRAFTS_REGISTRY } from '../../registry/craftsRegistry';
import { tenantStorage } from '../../db/dexieDB';
import { markProductDirty } from '../../db/productSyncQueue';
import { flushProductSync } from '../../db/productsCloud';
import { publishProductToMarketplace } from '../../db/marketplaceCloud';
import { compressImageFile } from '../../utils/imageCompressor';
import { ProductVideoThumbnail } from '../common/ProductVideoThumbnail';
import { isValidHttpVideoUrl } from '../../lib/catalogStatus';

interface DirectCatalogProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  /** Default context: when opened from Storefront, highlight publish-to-store first */
  defaultPublishToStore?: boolean;
  onSaved: (record: SavedProductRecord) => void;
}

export const DirectCatalogProductModal: React.FC<DirectCatalogProductModalProps> = ({
  isOpen,
  onClose,
  profile,
  defaultPublishToStore = false,
  onSaved,
}) => {
  const availableCrafts = useMemo(() => {
    const selected = Array.isArray(profile.selectedCrafts) ? profile.selectedCrafts : [];
    const matched = SUB_CRAFTS_REGISTRY.filter((c) => selected.includes(c.id));
    return matched.length > 0 ? matched : SUB_CRAFTS_REGISTRY.slice(0, 12);
  }, [profile.selectedCrafts]);

  const initialCraft = availableCrafts[0] || SUB_CRAFTS_REGISTRY[0];

  const [productName, setProductName] = useState('');
  const [craftId, setCraftId] = useState(initialCraft?.id || 'macrame');
  const [categoryLabel, setCategoryLabel] = useState<string>(
    initialCraft?.sampleCategories?.[0] || 'منتج يدوي'
  );
  const [storePrice, setStorePrice] = useState<string>('');
  const [wholesalePrice, setWholesalePrice] = useState<string>('');
  const [currentStock, setCurrentStock] = useState<string>('1');
  const [storeDescription, setStoreDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isCustomOrderAvailable, setIsCustomOrderAvailable] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeCraftObj =
    SUB_CRAFTS_REGISTRY.find((c) => c.id === craftId) || initialCraft;
  const activeSectionObj = MAIN_SECTIONS.find(
    (s) => s.id === activeCraftObj?.mainSectionId
  );

  const currencySymbol = profile.currencySymbol || 'ج.م';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, 5 - images.length));
    if (files.length === 0) return;
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const compressed = await Promise.all(
        files.map((f) =>
          compressImageFile(f, {
            maxWidth: 900,
            maxHeight: 900,
            targetMaxKb: 110,
            initialQuality: 0.8,
          })
        )
      );
      setImages((prev) => [...prev, ...compressed].slice(0, 5));
    } catch {
      setErrorMsg('تعذر قراءة الصورة، جرب صورة أخرى أو رابط مباشر.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    const clean = imageUrlInput.trim();
    if (!clean) return;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      setErrorMsg('يرجى إدخال رابط صورة يبدأ بـ https://');
      return;
    }
    setImages((prev) => [...prev, clean].slice(0, 5));
    setImageUrlInput('');
    setErrorMsg(null);
  };

  const handleSave = async (publishToStore: boolean) => {
    const cleanName = productName.trim();
    const numericPrice = Number(storePrice || 0);
    const numericWholesale = Number(wholesalePrice || 0);
    const cleanVideo = videoUrl.trim();

    if (!cleanName) {
      setErrorMsg('يرجى كتابة اسم المنتج أولاً.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setErrorMsg('يرجى إدخال سعر بيع صحيح أكبر من صفر.');
      return;
    }
    if (cleanVideo && !isValidHttpVideoUrl(cleanVideo)) {
      setErrorMsg('رابط الفيديو غير صالح — تأكد أنه يبدأ بـ https:// (يوتيوب، تيك توك، إنستجرام، فيسبوك أو رابط مباشر).');
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
      const serialNum = await tenantStorage.getNextProductSerialNumber(tenantId);
      const productCode = `PRD-${String(serialNum).padStart(4, '0')}`;
      const recordId = `prod_dir_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const mainImage = images[0] || '';
      const safeCategory = (categoryLabel.trim() || activeCraftObj?.sampleCategories?.[0] || 'جدارية') as CraftCategory;

      const record: SavedProductRecord = {
        id: recordId,
        tenantId,
        workshopId: tenantId,
        productName: cleanName,
        productSerialNumber: serialNum,
        productCode,
        mainSectionId: activeCraftObj?.mainSectionId || 'ropes_textiles',
        mainSectionName: activeSectionObj?.nameAr || 'حرف يدوية',
        craftId: activeCraftObj?.id || craftId,
        craftName: activeCraftObj?.nameAr || 'مشغولات يدوية',
        productType: safeCategory,
        category: safeCategory,
        costPrice: 0,
        retailPrice: numericPrice,
        wholesalePrice: numericWholesale > 0 ? numericWholesale : Math.round(numericPrice * 0.8),
        wholesaleMarginDiscountPercent: 20,
        input: {
          category: safeCategory,
          productName: cleanName,
          shape3D: 'flat',
          widthCm: 0,
          diameterCm: 0,
          baseDiameterCm: 0,
          sideHeightCm: 0,
          totalLengthCm: 0,
          fringeLengthCm: 0,
          cordTypeId: 'cotton_braided',
          cordThicknessMm: 0,
          pricePerKg: 0,
          curtainRodCost: 0,
          cushionCoverCost: 0,
          fiberCost: 0,
          bagAccessoriesCost: 0,
          extraMaterials: [],
          laborWage: 0,
          packagingCost: 0,
          transitFees: 0,
          adminExpensesShare: 0,
          profitMarginPercent: 0,
          craftId: activeCraftObj?.id || craftId,
          mainSectionId: activeCraftObj?.mainSectionId || 'ropes_textiles',
          personalNotes: storeDescription.trim(),
          productImageUrl: mainImage,
        },
        output: {
          baseStrandsCount: 0,
          workingCordsCount: 0,
          singleStrandLengthCm: 0,
          totalYarnLengthMeters: 0,
          totalWeightKg: 0,
          totalWeightGrams: 0,
          yarnCost: 0,
          extraMaterialsTotalCost: 0,
          totalDirectMaterialsCost: 0,
          insulatedProfitAmount: 0,
          laborWage: 0,
          packagingCost: 0,
          transitFees: 0,
          adminExpensesShare: 0,
          finalSellingPrice: numericPrice,
          isOverridden: {
            strands: false,
            strandLength: false,
            weight: false,
          },
        },
        imageUrl: mainImage,
        galleryUrls: images,
        videoUrl: cleanVideo || undefined,
        storeDescription: storeDescription.trim(),
        storePrice: numericPrice,
        isCatalogVisible: true,
        inStore: publishToStore,
        isPublishedInStore: publishToStore,
        inMarket: false,
        marketStatus: 'none',
        directCatalogEntry: true,
        isCosted: false,
        currentStock: Math.max(0, Number(currentStock || 0)),
        isCustomOrderAvailable,
        sourceCurrency: profile.currency || 'EGP',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await tenantStorage.mutateProduct(record);

      if (tenantId) {
        markProductDirty(tenantId, record.id);
        flushProductSync(tenantId).catch(() => {});
      }

      if (publishToStore) {
        await publishProductToMarketplace(record, profile).catch(() => {});
      }

      onSaved(record);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ المنتج، حاول مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3 bg-[#EFE9DC]/70 dark:bg-[#0A1124]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-[#EA580C]/15 text-[#EA580C] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-[#0C1427] dark:text-[#F7F3EA] truncate">
                إضافة منتج مباشر للكتالوج والمتجر
              </h3>
              <p className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
                أضف منتجك فوراً وابدأ البيع، ويمكنك حساب تكلفته لاحقاً بضغطة واحدة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-9 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] hover:bg-[#DFD7C6] dark:hover:bg-[#1A2B54] flex items-center justify-center text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-right">
          {/* 3-Color Explanation Mini Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-bold">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span>أحمر: بالكتالوج فقط</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/12 border border-amber-500/30 text-amber-800 dark:text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              <span>أصفر: بالمتجر بدون تكلفة</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>أخضر: مسعّر وبالمتجر</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-black flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Product Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
              اسم المنتج *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="مثال: جدارية مكرمية بوهيمية مقاس 60×90"
              className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
            />
          </div>

          {/* Craft + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                الحرفة / القسم
              </label>
              <select
                value={craftId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setCraftId(nextId);
                  const found = SUB_CRAFTS_REGISTRY.find((c) => c.id === nextId);
                  if (found?.sampleCategories?.[0]) {
                    setCategoryLabel(found.sampleCategories[0]);
                  }
                }}
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              >
                {availableCrafts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                نوع القطعة
              </label>
              <input
                type="text"
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
                list="direct-product-types-list"
                placeholder="جدارية، شنطة، صينية..."
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
              <datalist id="direct-product-types-list">
                {(activeCraftObj?.sampleCategories || []).map((t: string) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Pricing + Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                سعر البيع بالمتجر ({currencySymbol}) *
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={storePrice}
                onChange={(e) => setStorePrice(e.target.value)}
                placeholder="مثال: 450"
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-mono font-black text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                سعر الجملة (اختياري)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                placeholder="تلقائي 80%"
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-mono font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#475569] dark:text-[#94A3B8]">
                الكمية المتاحة (0 = بالطلب)
              </label>
              <input
                type="number"
                min={0}
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-sm font-mono font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
              وصف المنتج للعملاء
            </label>
            <textarea
              rows={2}
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              placeholder="اكتب الخامات والمقاسات ومميزات القطعة..."
              className="w-full p-3 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C] resize-none"
            />
          </div>

          {/* Images Upload + URL */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                  صور المنتج ({images.length} / 5)
                </span>
                <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
                  يتم ضغط الصور تلقائياً لسرعة المتجر وخفة التحميل
                </p>
              </div>
              {images.length < 5 && (
                <label className="px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer transition">
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  <span>رفع صور</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>

            {images.length < 5 && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="أو الصق رابط صورة مباشر (https://...)"
                    className="w-full h-9 pr-8 pl-3 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 h-9 rounded-xl bg-[#E9E2D4] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-[11px] font-black text-[#0C1427] dark:text-[#F7F3EA] hover:border-[#EA580C] cursor-pointer"
                >
                  إضافة
                </button>
              </div>
            )}

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {images.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#D4CCBC] dark:border-[#22355E]"
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[9px] font-black text-center py-0.5">
                        أساسية
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lightweight Video Link Section */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-[#EFE9DC]/65 dark:bg-[#101C38] border border-[#D4CCBC] dark:border-[#22355E]">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-[#EA580C]" />
              <label className="text-xs font-black text-[#0C1427] dark:text-[#F7F3EA]">
                رابط فيديو للمنتج (اختياري — خفيف على قاعدة البيانات)
              </label>
            </div>
            <p className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8]">
              ضع رابط يوتيوب، تيك توك، إنستجرام ريلز أو فيسبوك — سيظهر كصورة مصغرة خفيفة ويشتغل الفيديو عند الضغط عليها فقط.
            </p>
            <input
              type="url"
              dir="ltr"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... أو رابط ريلز / تيك توك"
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] outline-none focus:border-[#EA580C]"
            />
            {isValidHttpVideoUrl(videoUrl) && (
              <div className="pt-1">
                <ProductVideoThumbnail
                  videoUrl={videoUrl}
                  fallbackImage={images[0]}
                  title={productName || 'معاينة فيديو المنتج'}
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-[#0C1427] dark:text-[#F7F3EA] cursor-pointer">
            <input
              type="checkbox"
              checked={isCustomOrderAvailable}
              onChange={(e) => setIsCustomOrderAvailable(e.target.checked)}
              className="w-4 h-4 accent-[#EA580C]"
            />
            <span>متاح للتنفيذ الخاص بألوان ومقاسات حسب طلب العميل</span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC]/80 dark:bg-[#0A1124] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className={`px-4 py-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
              !defaultPublishToStore
                ? 'bg-rose-600/12 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-600/20'
                : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E] text-[#0C1427] dark:text-[#F7F3EA] hover:border-rose-500/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>حفظ بالكتالوج فقط (أحمر)</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(true)}
            className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Store className="w-4 h-4" />
            )}
            <span>حفظ وعرض بالمتجر فوراً (أصفر)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
