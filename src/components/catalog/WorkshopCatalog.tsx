import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SavedProductRecord, UserProfile } from '../../types';
import {
  MAIN_SECTIONS,
  SUB_CRAFTS_REGISTRY,
} from '../../registry/craftsRegistry';
import { tenantStorage } from '../../db/dexieDB';
import { useTranslation } from '../../lib/i18n';
import {
  BookOpen,
  Search,
  Filter,
  Download,
  Printer,
  Share2,
  Calculator,
  Layers,
  Boxes,
  CheckCircle,
  RefreshCw,
  ArrowUpDown,
  RotateCcw,
  Check,
  AlertCircle,
  X,
  Edit3,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Facebook,
  ExternalLink,
  Tag,
  Ruler,
  FileText,
  Palette,
  Sparkles,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface WorkshopCatalogProps {
  profile: UserProfile;
  onSelectRecordToLoad: (record: SavedProductRecord) => void;
  onOpenWhatsAppShare: (record: SavedProductRecord) => void;
}

export const WorkshopCatalog: React.FC<WorkshopCatalogProps> = ({
  profile,
  onSelectRecordToLoad,
  onOpenWhatsAppShare,
}) => {
  const { t: tr } = useTranslation();

  // All loaded products stored in memory
  const [allProducts, setAllProducts] = useState<SavedProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>('');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMainSection, setSelectedMainSection] = useState<string>('all');
  const [selectedCraft, setSelectedCraft] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'serial' | 'name' | 'retailPrice' | 'wholesalePrice' | 'costPrice'>('serial');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Specs Editing Modal State
  const [editingRecord, setEditingRecord] = useState<SavedProductRecord | null>(null);
  const [editFormData, setEditFormData] = useState<{
    productName: string;
    productCode: string;
    productType: string;
    category: string;
    retailPrice: number;
    wholesalePrice: number;
    costPrice: number;
    imageUrl: string;
    widthCm: number;
    heightCm: number;
    diameterCm: number;
    fringeLengthCm: number;
    materialsDescription: string;
    colorVariants: string;
    marketingDescription: string;
    careInstructions: string;
    tags: string;
  }>({
    productName: '',
    productCode: '',
    productType: '',
    category: '',
    retailPrice: 0,
    wholesalePrice: 0,
    costPrice: 0,
    imageUrl: '',
    widthCm: 0,
    heightCm: 0,
    diameterCm: 0,
    fringeLengthCm: 0,
    materialsDescription: '',
    colorVariants: '',
    marketingDescription: '',
    careInstructions: '',
    tags: '',
  });

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const printTemplateRef = useRef<HTMLDivElement>(null);

  // Load all products ONCE from database
  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const items = await tenantStorage.getProducts(tenantId);
      setAllProducts(items);
    } catch (err) {
      console.error('Failed to load workshop products for catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, [tenantId]);

  // Crafts selected by the artisan
  const userCrafts = useMemo(() => {
    const craftIds = profile.selectedCrafts && profile.selectedCrafts.length > 0
      ? profile.selectedCrafts
      : ['macrame'];
    return SUB_CRAFTS_REGISTRY.filter((c) => craftIds.includes(c.id));
  }, [profile.selectedCrafts]);

  // Main sections available from selected crafts
  const availableSections = useMemo(() => {
    const secIds = new Set(userCrafts.map((c) => c.mainSectionId));
    return MAIN_SECTIONS.filter((s) => secIds.has(s.id));
  }, [userCrafts]);

  // Sub-crafts options for dropdown
  const subCraftOptions = useMemo(() => {
    if (selectedMainSection === 'all') {
      return userCrafts;
    }
    return userCrafts.filter((c) => c.mainSectionId === selectedMainSection);
  }, [userCrafts, selectedMainSection]);

  // Reset craft filter if it doesn't belong to newly selected main section
  useEffect(() => {
    if (selectedCraft !== 'all') {
      const exists = subCraftOptions.some((c) => c.id === selectedCraft || c.nameAr === selectedCraft);
      if (!exists) {
        setSelectedCraft('all');
      }
    }
  }, [selectedMainSection, subCraftOptions]);

  // Helper functions to get accurate numbers and labels across legacy and current records
  const getCostPrice = (p: SavedProductRecord): number => {
    if (typeof p.costPrice === 'number' && p.costPrice > 0) return p.costPrice;
    if (p.output) {
      return Math.round(
        (p.output.totalDirectMaterialsCost || 0) +
        (p.output.laborWage || 0) +
        (p.output.packagingCost || 0) +
        (p.output.transitFees || 0) +
        (p.output.adminExpensesShare || 0)
      );
    }
    return 0;
  };

  const getRetailPrice = (p: SavedProductRecord): number => {
    if (typeof p.retailPrice === 'number' && p.retailPrice > 0) return p.retailPrice;
    return p.output?.finalSellingPrice || 0;
  };

  const getWholesalePrice = (p: SavedProductRecord): number => {
    if (typeof p.wholesalePrice === 'number' && p.wholesalePrice > 0) return p.wholesalePrice;
    const cost = getCostPrice(p);
    const retail = getRetailPrice(p);
    const discountPercent = profile.defaultWholesaleDiscountPercent ?? 25;
    const marginAmount = p.output?.insulatedProfitAmount || Math.max(0, retail - cost);
    const discount = Math.round(marginAmount * (discountPercent / 100));
    return Math.max(cost, retail - discount);
  };

  const getProductSerialDisplay = (p: SavedProductRecord, index: number): string => {
    if (p.productCode) return p.productCode;
    if (p.productSerialNumber) return `PRD-${String(p.productSerialNumber).padStart(4, '0')}`;
    return `PRD-${String(index + 1).padStart(4, '0')}`;
  };

  const getMainSectionDisplay = (p: SavedProductRecord): string => {
    if (p.mainSectionName) return p.mainSectionName;
    if (p.mainSectionId) {
      const sec = MAIN_SECTIONS.find((s) => s.id === p.mainSectionId);
      if (sec) return sec.nameAr;
    }
    return p.productType || 'مشغولات يدوية';
  };

  const getCraftDisplay = (p: SavedProductRecord): string => {
    if (p.craftName) return p.craftName;
    if (p.craftId) {
      const c = SUB_CRAFTS_REGISTRY.find((sc) => sc.id === p.craftId);
      if (c) return c.nameAr;
    }
    return (p.category as string) || 'مكرمية';
  };

  // Purely in-memory search and filtering
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // 1. Filter by Main Section
    if (selectedMainSection !== 'all') {
      result = result.filter((p) => {
        const secName = getMainSectionDisplay(p);
        return p.mainSectionId === selectedMainSection || secName === selectedMainSection;
      });
    }

    // 2. Filter by Sub Section / Craft
    if (selectedCraft !== 'all') {
      result = result.filter((p) => {
        const craftName = getCraftDisplay(p);
        return (
          p.craftId === selectedCraft ||
          craftName === selectedCraft ||
          p.category === selectedCraft ||
          p.productType === selectedCraft
        );
      });
    }

    // 3. Search by Name or Number
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p, idx) => {
        const nameMatch = p.productName?.toLowerCase().includes(q);
        const codeMatch = p.productCode?.toLowerCase().includes(q);
        const serialStr = p.productSerialNumber ? String(p.productSerialNumber) : '';
        const serialMatch = serialStr.includes(q);
        const displaySerial = getProductSerialDisplay(p, idx).toLowerCase();
        const displayMatch = displaySerial.includes(q);
        const categoryMatch = typeof p.category === 'string' && p.category.toLowerCase().includes(q);
        const typeMatch = p.productType?.toLowerCase().includes(q);
        return Boolean(nameMatch || codeMatch || serialMatch || displayMatch || categoryMatch || typeMatch);
      });
    }

    // 4. Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'serial') {
        const serialA = a.productSerialNumber || 0;
        const serialB = b.productSerialNumber || 0;
        comparison = serialA - serialB;
      } else if (sortBy === 'name') {
        comparison = (a.productName || '').localeCompare(b.productName || '', 'ar');
      } else if (sortBy === 'costPrice') {
        comparison = getCostPrice(a) - getCostPrice(b);
      } else if (sortBy === 'wholesalePrice') {
        comparison = getWholesalePrice(a) - getWholesalePrice(b);
      } else if (sortBy === 'retailPrice') {
        comparison = getRetailPrice(a) - getRetailPrice(b);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [allProducts, selectedMainSection, selectedCraft, searchQuery, sortBy, sortOrder]);

  // Target products for exports/shares (selected products if any are selected, else all filtered)
  const targetProductsForExport = useMemo(() => {
    if (selectedIds.size > 0) {
      return filteredProducts.filter((p) => selectedIds.has(p.id));
    }
    return filteredProducts;
  }, [filteredProducts, selectedIds]);

  // Statistics calculation
  const catalogStats = useMemo(() => {
    const list = targetProductsForExport;
    const totalCount = list.length;
    const totalCost = list.reduce((sum, p) => sum + getCostPrice(p), 0);
    const totalWholesale = list.reduce((sum, p) => sum + getWholesalePrice(p), 0);
    const totalRetail = list.reduce((sum, p) => sum + getRetailPrice(p), 0);

    return {
      totalCount,
      totalCost,
      totalWholesale,
      totalRetail,
      avgRetail: totalCount > 0 ? Math.round(totalRetail / totalCount) : 0,
    };
  }, [targetProductsForExport]);

  // Selection toggle handlers
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const isAllSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;

  // Open Specs Modal
  const handleOpenEditSpecs = (record: SavedProductRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecord(record);
    setEditFormData({
      productName: record.productName || '',
      productCode: record.productCode || (record.productSerialNumber ? `PRD-${record.productSerialNumber}` : ''),
      productType: record.productType || getMainSectionDisplay(record),
      category: (record.category as string) || getCraftDisplay(record),
      retailPrice: getRetailPrice(record),
      wholesalePrice: getWholesalePrice(record),
      costPrice: getCostPrice(record),
      imageUrl: record.imageUrl || record.input?.productImageUrl || '',
      widthCm: record.input?.widthCm || 0,
      heightCm: record.input?.totalLengthCm || record.input?.sideHeightCm || 0,
      diameterCm: record.input?.diameterCm || 0,
      fringeLengthCm: record.input?.fringeLengthCm || 0,
      materialsDescription: (record as any).materialsDescription || (record.input?.cordTypeId ? `خيط ${record.input.cordTypeId} سمك ${record.input.cordThicknessMm || 4} مم` : ''),
      colorVariants: (record as any).colorVariants || '',
      marketingDescription: (record as any).marketingDescription || record.input?.personalNotes || '',
      careInstructions: (record as any).careInstructions || 'تنظيف جاف أو مسح بقطعة قماش ناعمة وباردة',
      tags: Array.isArray((record as any).tags) ? (record as any).tags.join(', ') : ((record as any).tags || ''),
    });
  };

  // Save Specs Modifications to Dexie
  const handleSaveSpecs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      const updated: SavedProductRecord = {
        ...editingRecord,
        productName: editFormData.productName.trim() || editingRecord.productName,
        productCode: editFormData.productCode.trim() || editingRecord.productCode,
        productType: editFormData.productType.trim() || editingRecord.productType,
        category: editFormData.category.trim() || editingRecord.category,
        retailPrice: Number(editFormData.retailPrice) || editingRecord.retailPrice,
        wholesalePrice: Number(editFormData.wholesalePrice) || editingRecord.wholesalePrice,
        costPrice: Number(editFormData.costPrice) || editingRecord.costPrice,
        imageUrl: editFormData.imageUrl.trim() || editingRecord.imageUrl,
        updatedAt: Date.now(),
        input: {
          ...editingRecord.input,
          productName: editFormData.productName.trim() || editingRecord.input?.productName,
          widthCm: Number(editFormData.widthCm) || editingRecord.input?.widthCm,
          totalLengthCm: Number(editFormData.heightCm) || editingRecord.input?.totalLengthCm,
          diameterCm: Number(editFormData.diameterCm) || editingRecord.input?.diameterCm,
          fringeLengthCm: Number(editFormData.fringeLengthCm) || editingRecord.input?.fringeLengthCm,
          personalNotes: editFormData.marketingDescription.trim() || editingRecord.input?.personalNotes,
          productImageUrl: editFormData.imageUrl.trim() || editingRecord.input?.productImageUrl,
        },
      };

      // Attach custom specs fields
      (updated as any).materialsDescription = editFormData.materialsDescription.trim();
      (updated as any).colorVariants = editFormData.colorVariants.trim();
      (updated as any).marketingDescription = editFormData.marketingDescription.trim();
      (updated as any).careInstructions = editFormData.careInstructions.trim();
      (updated as any).tags = editFormData.tags.split(',').map((t) => t.trim()).filter(Boolean);

      await tenantStorage.mutateProduct(updated);

      // Update in memory state immediately
      setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

      setNotice(tr('catalog_save_specs') + ' - ' + updated.productName);
      setTimeout(() => setNotice(''), 3500);
      setEditingRecord(null);
    } catch (err: any) {
      console.error('Failed to update product specs:', err);
      setNotice('حدث خطأ أثناء حفظ التعديل: ' + (err.message || 'خطأ غير معروف'));
      setTimeout(() => setNotice(''), 4000);
    }
  };

  // PDF Export Function
  const handleExportPDF = async () => {
    if (!printTemplateRef.current || targetProductsForExport.length === 0) {
      setNotice('لا توجد منتجات معروضة للتصدير.');
      setTimeout(() => setNotice(''), 3000);
      return;
    }

    setIsExportingPdf(true);
    setNotice('جاري إنشاء ملف PDF للكتالوج بدقة عالية...');

    try {
      const templateEl = printTemplateRef.current;
      templateEl.style.display = 'block';

      const canvas = await html2canvas(templateEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      templateEl.style.display = 'none';

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add remaining pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `كتالوج_${profile.brandName || 'الورشة'}_${selectedIds.size > 0 ? `مختار_${selectedIds.size}` : 'كامل'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      setNotice('تم تصدير كتالوج الورشة بصيغة PDF بنجاح!');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setNotice('حدث خطأ أثناء تصدير ملف PDF: ' + (err.message || ''));
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setIsExportingPdf(false);
      if (printTemplateRef.current) {
        printTemplateRef.current.style.display = 'none';
      }
    }
  };

  // WhatsApp Multi-Item Share
  const handleShareWhatsApp = () => {
    const items = targetProductsForExport;
    if (items.length === 0) return;

    let text = `🌟 *كتالوج منتجات ورشة ${profile.brandName || 'الحرفية'}*\n`;
    text += `👤 *الفنان:* ${profile.artistName || ''}\n`;
    text += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    items.forEach((p, idx) => {
      const wholesale = getWholesalePrice(p);
      const retail = getRetailPrice(p);
      const serial = getProductSerialDisplay(p, idx);
      const type = getMainSectionDisplay(p);
      const category = getCraftDisplay(p);

      text += `📦 *[${idx + 1}] ${p.productName}*\n`;
      text += `▫️ كود الصنف: ${serial}\n`;
      text += `▫️ النوع والتصنيف: ${type} - ${category}\n`;
      if (p.input?.widthCm || p.input?.totalLengthCm) {
        text += `▫️ المقاس: ${p.input.widthCm || 0}×${p.input.totalLengthCm || p.input.sideHeightCm || 0} سم\n`;
      }
      text += `💰 سعر القطاعي: *${retail} ${profile.currencySymbol}*\n`;
      text += `🏷️ سعر الجملة: *${wholesale} ${profile.currencySymbol}*\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📞 للتواصل والطلب: ${profile.phoneNumber || ''}\n`;
    text += `✨ صادر عبر منظومة الشمساوية للبرمجيات الحرفية`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Facebook & Social Share
  const handleShareFacebook = async () => {
    const items = targetProductsForExport;
    if (items.length === 0) return;

    const shareTitle = `كتالوج منتجات ورشة ${profile.brandName || 'الحرفية'}`;
    const shareText = `تفضلوا بالاطلاع على تشكيلة المشغولات اليدوية الحصرية من ورشة ${profile.brandName || ''} (${items.length} منتج)`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch (e) {
        // Fallback to clipboard or dialog
      }
    }

    // Fallback: Copy summary to clipboard & open FB sharer
    try {
      await navigator.clipboard.writeText(shareText + '\n' + window.location.href);
      setNotice('تم نسخ تفاصيل الكتالوج إلى الحافظة وجاري فتح نافذة فيسبوك...');
    } catch {
      setNotice('جاري فتح نافذة المشاركة...');
    }

    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, '_blank', 'width=600,height=500');
    setTimeout(() => setNotice(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300/40 dark:border-amber-800/40 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <BookOpen className="w-4 h-4" />
            <span>{tr('catalog_title')}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            {profile.brandName ? `كتالوج ورشة ${profile.brandName}` : tr('catalog_title')}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {tr('catalog_subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh data */}
          <button
            type="button"
            onClick={loadCatalogData}
            title="تحديث البيانات"
            className="p-2.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>

          {/* WhatsApp Share Button */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={targetProductsForExport.length === 0}
            className="px-3.5 py-2.5 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="مشاركة الأصناف المحددة عبر واتساب"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">{tr('catalog_share_whatsapp')}</span>
          </button>

          {/* Facebook Share Button */}
          <button
            type="button"
            onClick={handleShareFacebook}
            disabled={targetProductsForExport.length === 0}
            className="px-3.5 py-2.5 rounded-2xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="مشاركة الكتالوج على فيسبوك"
          >
            <Facebook className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">{tr('catalog_share_facebook')}</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPdf || targetProductsForExport.length === 0}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs shadow-md shadow-amber-600/20 active:scale-[0.98] transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPdf ? 'جاري تجهيز PDF...' : tr('catalog_export_pdf')}</span>
          </button>
        </div>
      </div>

      {/* Notice Message */}
      {notice && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Selection Control Bar if any items selected */}
      {selectedIds.size > 0 && (
        <div className="p-3.5 px-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-400 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-amber-600 text-white font-black">
              {tr('catalog_selected_badge').replace('{count}', String(selectedIds.size))}
            </span>
            <span className="text-stone-600 dark:text-stone-300 font-bold">
              (من إجمالي {filteredProducts.length} معروض)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>مشاركة واتساب ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير PDF ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold cursor-pointer transition"
            >
              {tr('catalog_deselect_all')}
            </button>
          </div>
        </div>
      )}

      {/* 2. Search & Filters Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="lg:col-span-5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم المنتج، كود الصنف، أو النوع..."
              className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* Filter 1: القسم الأساسي */}
          <div className="lg:col-span-3">
            <div className="relative">
              <select
                value={selectedMainSection}
                onChange={(e) => setSelectedMainSection(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
              >
                <option value="all">كافة الأقسام الأساسية (الكل)</option>
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.nameAr}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: الحرفة الفرعية */}
          <div className="lg:col-span-3">
            <div className="relative">
              <select
                value={selectedCraft}
                onChange={(e) => setSelectedCraft(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
              >
                <option value="all">كافة الحِرف الفرعية (الكل)</option>
                {subCraftOptions.map((craft) => (
                  <option key={craft.id} value={craft.id}>
                    {craft.nameAr}
                  </option>
                ))}
              </select>
              <Layers className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Reset Filters */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedMainSection('all');
                setSelectedCraft('all');
                setSelectedIds(new Set());
              }}
              title="إعادة ضبط الفلاتر"
              className="p-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1 text-xs font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Catalog summary indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
          <div className="flex items-center gap-2 text-stone-500">
            <span>النتائج المعروضة:</span>
            <span className="font-mono font-black text-amber-700 dark:text-amber-400">
              {filteredProducts.length}
            </span>
            <span>من إجمالي {allProducts.length} منتج مسجل بالورشة</span>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400">ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-[11px] font-bold text-stone-700 dark:text-stone-300 outline-none"
            >
              <option value="serial">رقم وكود الصنف</option>
              <option value="name">اسم المنتج</option>
              <option value="retailPrice">سعر القطاعي</option>
              <option value="wholesalePrice">سعر الجملة</option>
              <option value="costPrice">التكلفة</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Catalog Content: Responsive Table on Desktop, Cards on Mobile */}
      {loading ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-600 mb-2" />
          <p className="text-xs font-bold text-stone-500">جاري تحميل سجلات منتجات الكتالوج...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-black text-stone-800 dark:text-stone-200">
            لم يتم العثور على منتجات مطابقة للبحث أو الفلتر
          </h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            تأكد من كتابة الاسم أو الرقم بشكل صحيح، أو صدّر منتجاتك من حاسبة التكاليف لتظهر هنا تلقائياً!
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW - Exact requested column structure */}
          <div className="hidden md:block rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 font-black">
                    {/* Checkbox Select All */}
                    <th className="py-3.5 px-3 text-center w-10">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        title={isAllSelected ? tr('catalog_deselect_all') : tr('catalog_select_all')}
                        className="p-1 text-stone-600 dark:text-stone-300 hover:text-amber-600 transition"
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : selectedIds.size > 0 ? (
                          <div className="w-4 h-4 rounded border-2 border-amber-600 bg-amber-600/20 flex items-center justify-center text-[10px] text-amber-700 font-bold">
                            -
                          </div>
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    {/* 1. نوع المنتج */}
                    <th className="py-3.5 px-4">{tr('catalog_table_type')}</th>
                    {/* 2. تصنيف المنتج */}
                    <th className="py-3.5 px-4">{tr('catalog_table_category')}</th>
                    {/* 3. اسم المنتج */}
                    <th className="py-3.5 px-4">{tr('catalog_table_name')}</th>
                    {/* 4. كود الصنف */}
                    <th className="py-3.5 px-4 text-center font-mono">{tr('catalog_table_code')}</th>
                    {/* 5. صورة المنتج */}
                    <th className="py-3.5 px-4 text-center">{tr('catalog_table_image')}</th>
                    {/* 6. تسعيرة جملة */}
                    <th className="py-3.5 px-4 text-center font-mono text-emerald-700 dark:text-emerald-400">
                      {tr('catalog_table_wholesale')}
                    </th>
                    {/* 7. تسعيرة قطاعي */}
                    <th className="py-3.5 px-4 text-center font-mono text-amber-700 dark:text-amber-400">
                      {tr('catalog_table_retail')}
                    </th>
                    {/* 8. الإجراءات */}
                    <th className="py-3.5 px-4 text-center">{tr('catalog_table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredProducts.map((p, idx) => {
                    const wholesale = getWholesalePrice(p);
                    const retail = getRetailPrice(p);
                    const code = getProductSerialDisplay(p, idx);
                    const mainType = getMainSectionDisplay(p);
                    const category = getCraftDisplay(p);
                    const isSelected = selectedIds.has(p.id);
                    const imgUrl = p.imageUrl || p.input?.productImageUrl;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleOpenEditSpecs(p)}
                        className={`transition cursor-pointer group ${
                          isSelected
                            ? 'bg-amber-500/10 dark:bg-amber-950/30'
                            : 'hover:bg-amber-50/50 dark:hover:bg-stone-800/40'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center" onClick={(e) => handleToggleSelect(p.id, e)}>
                          <button
                            type="button"
                            className="p-1 text-stone-400 hover:text-amber-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* 1. نوع المنتج */}
                        <td className="py-3 px-4 font-bold text-stone-700 dark:text-stone-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-stone-400" />
                            <span>{mainType}</span>
                          </span>
                        </td>

                        {/* 2. تصنيف المنتج */}
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 text-[11px] font-bold">
                            {category}
                          </span>
                        </td>

                        {/* 3. اسم المنتج */}
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-extrabold text-stone-900 dark:text-stone-100 block group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                              {p.productName}
                            </span>
                            {p.input?.widthCm && p.input?.totalLengthCm ? (
                              <span className="text-[10px] text-stone-400">
                                {p.input.widthCm}×{p.input.totalLengthCm} سم
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* 4. كود الصنف */}
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[11px]">
                            {code}
                          </span>
                        </td>

                        {/* 5. صورة المنتج */}
                        <td className="py-3 px-4 text-center">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={p.productName}
                              className="w-10 h-10 rounded-xl object-cover border border-stone-200 dark:border-stone-700 mx-auto shadow-xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 mx-auto border border-dashed border-stone-300 dark:border-stone-700">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* 6. تسعيرة جملة */}
                        <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {wholesale} {profile.currencySymbol}
                        </td>

                        {/* 7. تسعيرة قطاعي */}
                        <td className="py-3 px-4 text-center font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                          {retail} {profile.currencySymbol}
                        </td>

                        {/* 8. الإجراءات */}
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSpecs(p)}
                              title={tr('catalog_edit_specs')}
                              className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectRecordToLoad(p)}
                              title="فتح في الحاسبة للتسعير"
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition cursor-pointer"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenWhatsAppShare(p)}
                              title="مشاركة عرض سعر واتساب"
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Table Footer Totals */}
            <div className="p-4 bg-stone-50 dark:bg-stone-800/70 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-300">
              <div>
                <span>إجمالي الأصناف المعروضة: </span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-black">
                  {catalogStats.totalCount}
                </span>
                {selectedIds.size > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 font-bold mr-2">
                    (المحدد: {selectedIds.size})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-stone-400 text-[11px]">مجموع التكاليف: </span>
                  <span className="font-mono">{catalogStats.totalCost} {profile.currencySymbol}</span>
                </div>
                <div>
                  <span className="text-emerald-600 text-[11px]">مجموع الجملة: </span>
                  <span className="font-mono text-emerald-600">{catalogStats.totalWholesale} {profile.currencySymbol}</span>
                </div>
                <div>
                  <span className="text-amber-600 text-[11px]">مجموع القطاعي: </span>
                  <span className="font-mono text-amber-600">{catalogStats.totalRetail} {profile.currencySymbol}</span>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE CARDS VIEW */}
          <div className="md:hidden space-y-3">
            {filteredProducts.map((p, idx) => {
              const wholesale = getWholesalePrice(p);
              const retail = getRetailPrice(p);
              const code = getProductSerialDisplay(p, idx);
              const mainType = getMainSectionDisplay(p);
              const category = getCraftDisplay(p);
              const isSelected = selectedIds.has(p.id);
              const imgUrl = p.imageUrl || p.input?.productImageUrl;

              return (
                <div
                  key={p.id}
                  onClick={() => handleOpenEditSpecs(p)}
                  className={`p-4 rounded-3xl border shadow-sm space-y-3 transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400 dark:border-amber-700'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {/* Top Bar: Checkbox & Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(p.id, e)}
                      className="flex items-center gap-2 p-1 text-xs font-bold text-stone-700 dark:text-stone-300"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-400" />
                      )}
                      <span className="font-mono text-stone-900 dark:text-stone-100">{code}</span>
                    </button>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                        {mainType}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                        {category}
                      </span>
                    </div>
                  </div>

                  {/* Body: Image & Name */}
                  <div className="flex items-start gap-3 pt-1">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.productName}
                        className="w-14 h-14 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 border border-dashed border-stone-300 dark:border-stone-700 flex-shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-black text-sm text-stone-900 dark:text-stone-100 leading-snug">
                        {p.productName}
                      </h4>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        كود: {code} • {mainType}
                      </p>
                    </div>
                  </div>

                  {/* Pricing 2-Box Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 text-center font-mono">
                    <div className="p-1 border-l border-stone-200 dark:border-stone-700">
                      <span className="text-[9px] text-emerald-600 font-sans block mb-0.5">
                        {tr('catalog_table_wholesale')}
                      </span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {wholesale} <span className="text-[9px]">{profile.currencySymbol}</span>
                      </span>
                    </div>
                    <div className="p-1">
                      <span className="text-[9px] text-amber-600 font-sans block mb-0.5">
                        {tr('catalog_table_retail')}
                      </span>
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                        {retail} <span className="text-[9px]">{profile.currencySymbol}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditSpecs(p)}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{tr('catalog_edit_specs')}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectRecordToLoad(p)}
                        className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold flex items-center gap-1"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>الحاسبة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenWhatsAppShare(p)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 border border-emerald-300/40"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>واتساب</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 4. MODAL: EDIT MISSING PRODUCT SPECIFICATIONS */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                    {tr('catalog_specs_modal_title')}
                  </h3>
                  <p className="text-xs text-stone-500">
                    كتابة وإكمال المواصفات الناقصة وحفظ التعديلات في الكتالوج
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSpecs} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Product Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.productName}
                    onChange={(e) => setEditFormData({ ...editFormData, productName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_code')} (SKU)
                  </label>
                  <input
                    type="text"
                    value={editFormData.productCode}
                    onChange={(e) => setEditFormData({ ...editFormData, productCode: e.target.value })}
                    placeholder="مثال: PRD-0042 أو MAC-RUN-01"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Type and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_type')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.productType}
                    onChange={(e) => setEditFormData({ ...editFormData, productType: e.target.value })}
                    placeholder="مثال: رانر، مرآة، كوشن، ستائر..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    {tr('catalog_table_category')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    placeholder="مثال: مكرمية، كروشيه، تطريز..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Pricing Fields */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-300/40 dark:border-amber-700/40 space-y-3">
                <h4 className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>تعديل التسعير ({profile.currencySymbol})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 font-bold mb-1 text-[11px]">
                      التكلفة المباشرة
                    </label>
                    <input
                      type="number"
                      value={editFormData.costPrice}
                      onChange={(e) => setEditFormData({ ...editFormData, costPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-600 font-bold mb-1 text-[11px]">
                      {tr('catalog_table_wholesale')} *
                    </label>
                    <input
                      type="number"
                      required
                      value={editFormData.wholesalePrice}
                      onChange={(e) => setEditFormData({ ...editFormData, wholesalePrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 font-mono font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-600 font-bold mb-1 text-[11px]">
                      {tr('catalog_table_retail')} *
                    </label>
                    <input
                      type="number"
                      required
                      value={editFormData.retailPrice}
                      onChange={(e) => setEditFormData({ ...editFormData, retailPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-400 font-mono font-black"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Dimensions */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 space-y-3">
                <h4 className="font-black text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-stone-500" />
                  <span>أبعاد ومقاسات القطعة (بالسنتيمتر)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">العرض (سم)</label>
                    <input
                      type="number"
                      value={editFormData.widthCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, widthCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">الارتفاع / الطول</label>
                    <input
                      type="number"
                      value={editFormData.heightCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, heightCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">القطر (سم)</label>
                    <input
                      type="number"
                      value={editFormData.diameterCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, diameterCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-500 text-[11px] mb-1">طول الشراشيب</label>
                    <input
                      type="number"
                      value={editFormData.fringeLengthCm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, fringeLengthCm: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Materials & Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    خامات ومواد التصنيع
                  </label>
                  <input
                    type="text"
                    value={editFormData.materialsDescription}
                    onChange={(e) => setEditFormData({ ...editFormData, materialsDescription: e.target.value })}
                    placeholder="مثال: خيط قطن محلول 4 مم، خشب زان طبيعي، حلقات معدنية"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    الألوان وتدرجات القطعة
                  </label>
                  <input
                    type="text"
                    value={editFormData.colorVariants}
                    onChange={(e) => setEditFormData({ ...editFormData, colorVariants: e.target.value })}
                    placeholder="مثال: أوف وايت، كافيه، مسطردة، أخضر مريمي"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Image URL & Preview */}
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                  رابط صورة المنتج (URL)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={editFormData.imageUrl}
                    onChange={(e) => setEditFormData({ ...editFormData, imageUrl: e.target.value })}
                    placeholder="https://... أو مسار الصورة المعتمدة"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {editFormData.imageUrl && (
                    <img
                      src={editFormData.imageUrl}
                      alt="معاينة"
                      className="w-10 h-10 rounded-xl object-cover border border-stone-300 dark:border-stone-700"
                    />
                  )}
                </div>
              </div>

              {/* Marketing Description & Care Instructions */}
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                  وصف المنتج الترويجي (Marketing Copy)
                </label>
                <textarea
                  rows={2}
                  value={editFormData.marketingDescription}
                  onChange={(e) => setEditFormData({ ...editFormData, marketingDescription: e.target.value })}
                  placeholder="وصف جذاب للمنتج، مميزاته، وطريقة استخدامه في الديكور..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    تعليمات العناية والغسيل
                  </label>
                  <input
                    type="text"
                    value={editFormData.careInstructions}
                    onChange={(e) => setEditFormData({ ...editFormData, careInstructions: e.target.value })}
                    placeholder="مثال: تنظيف جاف فقط، تجنب الغمر في الماء"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1.5">
                    وسوم البحث والتصنيف (Tags - مفصولة بفواصل)
                  </label>
                  <input
                    type="text"
                    value={editFormData.tags}
                    onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                    placeholder="بوهيمي, ديكور_مودرن, هدايا, مكرمية_حائط"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black shadow-md shadow-amber-600/20 active:scale-[0.98] transition cursor-pointer"
                >
                  {tr('catalog_save_specs')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DEDICATED INDEPENDENT PRINT/PDF TEMPLATE (OFFSCREEN) */}
      <div style={{ display: 'none' }}>
        <div
          ref={printTemplateRef}
          style={{
            width: '800px',
            backgroundColor: '#ffffff',
            color: '#1c1917',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            direction: 'rtl',
            padding: '30px',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #d97706',
              paddingBottom: '16px',
              marginBottom: '20px',
            }}
          >
            <div>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 'bold', color: '#78350f' }}>
                كتالوج منتجات الورشة الرسمي
              </h1>
              <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', color: '#1c1917' }}>
                براند: {profile.brandName} | الفنان: {profile.artistName}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#78716c' }}>
                هاتف الورشة: {profile.phoneNumber} • {profile.country}
              </p>
            </div>
            <div style={{ textAlign: 'left', fontSize: '11px', color: '#78716c' }}>
              <p style={{ margin: '0' }}>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</p>
              <p style={{ margin: '4px 0 0 0' }}>عدد المنتجات: {targetProductsForExport.length}</p>
              <p style={{ margin: '4px 0 0 0', color: '#d97706', fontWeight: 'bold' }}>
                العملة: {profile.currencySymbol} ({profile.currency})
              </p>
            </div>
          </div>

          {/* Table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11px',
              textAlign: 'right',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#fef3c7', borderBottom: '2px solid #b45309' }}>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '30px' }}>#</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '80px' }}>كود الصنف</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', width: '100px' }}>نوع المنتج</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', width: '90px' }}>التصنيف</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb' }}>اسم المنتج / الموديل</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '75px' }}>المقاس</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '80px', color: '#047857' }}>سعر الجملة</th>
                <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', width: '80px', color: '#b45309' }}>سعر القطاعي</th>
              </tr>
            </thead>
            <tbody>
              {targetProductsForExport.map((p, idx) => {
                const wholesale = getWholesalePrice(p);
                const retail = getRetailPrice(p);
                const code = getProductSerialDisplay(p, idx);
                const mainType = getMainSectionDisplay(p);
                const category = getCraftDisplay(p);
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={p.id}
                    style={{
                      backgroundColor: isEven ? '#ffffff' : '#fafaf9',
                      borderBottom: '1px solid #e7e5e4',
                    }}
                  >
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#78716c' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                      {code}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb' }}>
                      {mainType}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', color: '#78350f', fontWeight: 'bold' }}>
                      {category}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                      {p.productName}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontSize: '10px' }}>
                      {p.input?.widthCm ? `${p.input.widthCm}×${p.input.totalLengthCm || 0} سم` : '-'}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#047857' }}>
                      {wholesale}
                    </td>
                    <td style={{ padding: '7px 8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#b45309' }}>
                      {retail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#fef3c7', fontWeight: 'bold', borderTop: '2px solid #b45309' }}>
                <td colSpan={6} style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                  الإجمالي العام ({targetProductsForExport.length} منتج)
                </td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#047857' }}>
                  {catalogStats.totalWholesale}
                </td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#b45309' }}>
                  {catalogStats.totalRetail}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer Notes */}
          <div
            style={{
              marginTop: '25px',
              paddingTop: '12px',
              borderTop: '1px solid #e7e5e4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              color: '#78716c',
            }}
          >
            <span>* الأسعار شاملة لكافة نسب الأمان وتكاليف الإنتاج المعتمدة بالورشة.</span>
            <span>صادر من منظومة الشمساوية للبرمجيات الحرفية • AL-SHAMSAWEYA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
