import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkshopProfile } from '../../types';
import {
  SupabaseMaterial,
  SupabaseUnit,
  SupabaseSupplier,
  getMaterialsFromSupabase,
  ensureDefaultMaterialsInSupabase,
  createMaterialInSupabase,
  updateMaterialInSupabase,
  deleteMaterialFromSupabase,
  getUnitsFromSupabase,
  ensureDefaultUnitsInSupabase,
  createUnitInSupabase,
  updateUnitInSupabase,
  deleteUnitFromSupabase,
  getSuppliersFromSupabase,
  createSupplierInSupabase,
} from '../../db/supabaseService';
import { NumberInput } from '../ui/NumberInput';
import JsBarcode from 'jsbarcode';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { tenantStorage } from '../../db/dexieDB';
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  Scale,
  PackagePlus,
  Layers,
  ChevronDown,
  X,
  CheckCircle2,
  AlertTriangle,
  Building,
  Barcode,
  Printer,
  ShieldAlert,
  ArrowUpDown,
  SlidersHorizontal,
  PackageCheck,
  Camera,
  PieChart as ChartPieIcon,
  Tag,
  FolderPlus,
  Folder,
  RefreshCw,
} from 'lucide-react';

export interface MaterialCategoryGroup {
  id: string;
  name: string;
  kind: 'primary' | 'extra';
}

export const DEFAULT_MATERIAL_CATEGORIES: MaterialCategoryGroup[] = [
  { id: 'cat_threads', name: 'خيوط وحبال', kind: 'primary' },
  { id: 'cat_woods', name: 'أخشاب وشاسيهات', kind: 'extra' },
  { id: 'cat_metals', name: 'إكسسوارات ومعادن', kind: 'extra' },
  { id: 'cat_fabrics', name: 'أقمشة وبطانات', kind: 'extra' },
  { id: 'cat_beads', name: 'خرز ومكملات', kind: 'extra' },
  { id: 'cat_packaging', name: 'تغليف وكرتون', kind: 'extra' },
];

const CHART_COLORS = ['#d97706', '#059669', '#2563eb', '#7c3aed', '#dc2626', '#0891b2', '#ea580c', '#4f46e5'];

interface MaterialsViewProps {
  workshop: WorkshopProfile;
  initialOpenAddModal?: boolean;
  onResetOpenAddModal?: () => void;
  onOpenHelp?: (sectionId: string) => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  workshop,
  initialOpenAddModal = false,
  onResetOpenAddModal,
}) => {
  const workshopId = workshop.workshopId || workshop.tenantId || workshop.id;

  const [materials, setMaterials] = useState<SupabaseMaterial[]>([]);
  const [units, setUnits] = useState<SupabaseUnit[]>([]);
  const [suppliers, setSuppliers] = useState<SupabaseSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'primary' | 'extra'>('all');
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Material Categories & Groups State
  const [materialCategories, setMaterialCategories] = useState<MaterialCategoryGroup[]>([]);
  const [materialCategoryMap, setMaterialCategoryMap] = useState<Record<string, string>>({});
  const [selectedGroupCategoryFilter, setSelectedGroupCategoryFilter] = useState<string>('all');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategoryGroup | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKind, setNewCategoryKind] = useState<'primary' | 'extra'>('primary');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedMaterialCategory, setSelectedMaterialCategory] = useState<string>('');

  // Low Stock & Sorting State
  const [stockData, setStockData] = useState<Record<string, { currentStock: number; minAlertThreshold: number }>>({});
  const [sortBy, setSortBy] = useState<'default' | 'most_needed' | 'name' | 'price_desc' | 'price_asc'>('default');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [editingStockItem, setEditingStockItem] = useState<{
    id: string;
    name: string;
    currentStock: number;
    minAlertThreshold: number;
    unitName: string;
  } | null>(null);

  // Barcode / Physical Label Modal State
  const [barcodeModalItem, setBarcodeModalItem] = useState<SupabaseMaterial | null>(null);
  const barcodeSvgRef = React.useRef<SVGSVGElement | null>(null);

  // Camera Barcode Scanner State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Recharts Inventory Capital Analytics State
  const [showCapitalAnalytics, setShowCapitalAnalytics] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<'category' | 'supplier'>('category');

  // Material Modal (Add / Edit)
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(initialOpenAddModal);
  const [editingMaterial, setEditingMaterial] = useState<SupabaseMaterial | null>(null);
  const [materialName, setMaterialName] = useState('');
  const [materialKind, setMaterialKind] = useState<'primary' | 'extra'>('primary');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [marketName, setMarketName] = useState('');
  const [marketUnitFactor, setMarketUnitFactor] = useState<number>(200);
  const [savingMaterial, setSavingMaterial] = useState(false);

  // Quick Add Supplier Inline Modal
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierAddress, setQuickSupplierAddress] = useState('');
  const [quickSupplierNotes, setQuickSupplierNotes] = useState('');
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);

  // Quick Add Unit Inline Modal
  const [isQuickUnitOpen, setIsQuickUnitOpen] = useState(false);
  const [quickUnitName, setQuickUnitName] = useState('');
  const [quickSubUnit, setQuickSubUnit] = useState('');
  const [quickConversionFactor, setQuickConversionFactor] = useState<number>(1000);
  const [savingQuickUnit, setSavingQuickUnit] = useState(false);

  // Units Management Drawer/Modal
  const [isUnitsManagerOpen, setIsUnitsManagerOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<SupabaseUnit | null>(null);

  // Delete Confirm Modal
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);

  // Load Data directly from Supabase & Dexie Stock
  const loadData = async () => {
    if (!workshopId) return;
    setLoading(true);
    try {
      const [unts, supsRes, matsRes] = await Promise.all([
        ensureDefaultUnitsInSupabase(workshopId),
        getSuppliersFromSupabase(workshopId),
        ensureDefaultMaterialsInSupabase(workshopId),
      ]);

      setUnits(unts);
      setSuppliers(supsRes.data || []);
      const loadedMats = matsRes || [];
      setMaterials(loadedMats);

      if (unts.length > 0 && !selectedUnitId) {
        setSelectedUnitId(unts[0].id);
      }

      // Load Categories from Local Storage
      try {
        const storedCats = localStorage.getItem('alshams_mat_categories_' + workshopId);
        if (storedCats) {
          setMaterialCategories(JSON.parse(storedCats));
        } else {
          setMaterialCategories(DEFAULT_MATERIAL_CATEGORIES);
          localStorage.setItem(
            'alshams_mat_categories_' + workshopId,
            JSON.stringify(DEFAULT_MATERIAL_CATEGORIES)
          );
        }

        const storedMap = localStorage.getItem('alshams_mat_cat_map_' + workshopId);
        if (storedMap) {
          setMaterialCategoryMap(JSON.parse(storedMap));
        }
      } catch (e) {
        console.warn('Error reading categories from localStorage:', e);
        setMaterialCategories(DEFAULT_MATERIAL_CATEGORIES);
      }

      // Load stock and low-stock reorder thresholds
      let stocks: Record<string, { currentStock: number; minAlertThreshold: number }> = {};
      try {
        const cached = localStorage.getItem('alshams_mat_stock_' + workshopId);
        if (cached) {
          stocks = JSON.parse(cached);
        }
      } catch (e) {
        console.warn('Could not read cached stock:', e);
      }

      try {
        const dexieItems = await tenantStorage.getRawMaterials(workshopId);
        for (const it of dexieItems) {
          if (!stocks[it.id]) {
            stocks[it.id] = {
              currentStock: Number(it.currentStock) || 0,
              minAlertThreshold: Number(it.minAlertThreshold ?? it.reorderLevel) || 5,
            };
          }
        }
      } catch (e) {
        console.warn('Could not read dexie raw materials:', e);
      }

      // Initialize defaults for any materials without stock data
      for (const m of loadedMats) {
        if (!stocks[m.id]) {
          stocks[m.id] = {
            currentStock: 0,
            minAlertThreshold: 5,
          };
        }
      }

      setStockData(stocks);
    } catch (err: any) {
      console.error('Failed to load materials data from Supabase:', err);
      setNotice({ text: 'حدث خطأ أثناء تحميل بيانات الخامات.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workshopId]);

  useEffect(() => {
    if (initialOpenAddModal) {
      handleOpenAddMaterial();
      if (onResetOpenAddModal) onResetOpenAddModal();
    }
  }, [initialOpenAddModal]);

  // Selected Unit Info
  const currentUnitRecord = useMemo(() => {
    return units.find((u) => u.id === selectedUnitId) || units[0] || null;
  }, [units, selectedUnitId]);

  // Lookup Maps
  const unitsMap = useMemo(() => {
    const map = new Map<string, SupabaseUnit>();
    for (const u of units) {
      map.set(u.id, u);
    }
    return map;
  }, [units]);

  const suppliersMap = useMemo(() => {
    const map = new Map<string, SupabaseSupplier>();
    for (const s of suppliers) {
      map.set(s.id, s);
    }
    return map;
  }, [suppliers]);

  const handleOpenAddMaterial = () => {
    setEditingMaterial(null);
    setMaterialName('');
    setMaterialKind('primary');
    setSelectedSupplierId('');
    setSelectedSupplierName('');
    setSupplierSearch('');
    setPurchasePrice(0);
    setSelectedUnitId(units[0]?.id || '');
    setMarketName('');
    setMarketUnitFactor(1);
    const defaultCat = materialCategories.find((c) => c.kind === 'primary')?.id || 'cat_threads';
    setSelectedMaterialCategory(defaultCat);
    setIsMaterialModalOpen(true);
  };

  const handleOpenEditMaterial = (item: SupabaseMaterial) => {
    setEditingMaterial(item);
    setMaterialName(item.name);
    setMaterialKind(item.kind === 'extra' ? 'extra' : 'primary');
    setSelectedSupplierId(item.supplier_id || '');
    const sup = item.supplier_id ? suppliersMap.get(item.supplier_id) : null;
    setSelectedSupplierName(sup?.name || '');
    setSupplierSearch(sup?.name || '');
    setPurchasePrice(Number(item.purchase_price) || 0);
    setSelectedUnitId(item.unit_id || units[0]?.id || '');
    setMarketName(item.market_name || '');
    setMarketUnitFactor(Number(item.market_unit_factor) || 1);
    const existingCat = materialCategoryMap[item.id] || (item.kind === 'extra' ? 'cat_woods' : 'cat_threads');
    setSelectedMaterialCategory(existingCat);
    setIsMaterialModalOpen(true);
  };

  // Save Material (Add or Update)
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim()) {
      setNotice({ text: 'يرجى إدخال اسم الخامة.', isError: true });
      return;
    }
    if (!selectedUnitId) {
      setNotice({ text: 'يرجى اختيار وحدة قياس صالحة.', isError: true });
      return;
    }

    setSavingMaterial(true);
    setNotice(null);

    try {
      const payload = {
        name: materialName.trim(),
        kind: materialKind,
        supplier_id: selectedSupplierId ? selectedSupplierId : null,
        unit_id: selectedUnitId,
        purchase_price: Number(purchasePrice) >= 0 ? Number(purchasePrice) : 0,
        market_name: marketName.trim() ? marketName.trim() : null,
        market_unit_factor: marketName.trim()
          ? Number(marketUnitFactor) > 0
            ? Number(marketUnitFactor)
            : 1
          : 1,
      };

      let savedMaterialId = '';
      if (editingMaterial) {
        const res = await updateMaterialInSupabase(editingMaterial.id, workshopId, payload);
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
          return;
        }
        savedMaterialId = editingMaterial.id;
        setNotice({ text: 'تم تحديث بيانات الخامة بنجاح.', isError: false });
      } else {
        const res = await createMaterialInSupabase(workshopId, payload);
        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
          return;
        }
        savedMaterialId = res.data?.id || '';
        setNotice({ text: 'تمت إضافة الخامة الجديدة بنجاح.', isError: false });
      }

      // Persist Category association
      if (savedMaterialId && selectedMaterialCategory) {
        const updatedMap = {
          ...materialCategoryMap,
          [savedMaterialId]: selectedMaterialCategory,
        };
        setMaterialCategoryMap(updatedMap);
        try {
          localStorage.setItem('alshams_mat_cat_map_' + workshopId, JSON.stringify(updatedMap));
        } catch (e) {
          console.warn('Could not store category map:', e);
        }
      }

      await loadData();
      setIsMaterialModalOpen(false);
    } catch (err: any) {
      console.error('Error saving material:', err);
      setNotice({ text: 'تعذر حفظ بيانات الخامة: ' + (err?.message || ''), isError: true });
    } finally {
      setSavingMaterial(false);
    }
  };

  // Delete Material
  const handleDeleteMaterial = async (materialId: string) => {
    try {
      const res = await deleteMaterialFromSupabase(materialId, workshopId);
      if (res.error) {
        setNotice({ text: res.error.arabicMessage, isError: true });
      } else {
        setMaterials((prev) => prev.filter((m) => m.id !== materialId));
        setNotice({ text: 'تم حذف الخامة بنجاح.', isError: false });
      }
      setDeletingMaterialId(null);
    } catch (err: any) {
      console.error('Failed to delete material:', err);
      setNotice({ text: 'حدث خطأ أثناء حذف الخامة.', isError: true });
      setDeletingMaterialId(null);
    }
  };

  // Category Management Handlers
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const trimmed = newCategoryName.trim();

    let updatedList: MaterialCategoryGroup[];
    if (editingCategory) {
      updatedList = materialCategories.map((c) =>
        c.id === editingCategory.id ? { ...c, name: trimmed, kind: newCategoryKind } : c
      );
      setNotice({ text: `تم تحديث التصنيف "${trimmed}" بنجاح.`, isError: false });
    } else {
      const newCat: MaterialCategoryGroup = {
        id: `cat_${Date.now()}`,
        name: trimmed,
        kind: newCategoryKind,
      };
      updatedList = [...materialCategories, newCat];
      setNotice({ text: `تمت إضافة التصنيف الرئيسي "${trimmed}" بنجاح.`, isError: false });
    }

    setMaterialCategories(updatedList);
    try {
      localStorage.setItem('alshams_mat_categories_' + workshopId, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Could not store categories:', e);
    }

    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryKind('primary');
  };

  const handleDeleteCategory = (catId: string) => {
    const targetCat = materialCategories.find((c) => c.id === catId);
    if (!targetCat) return;

    // Strict validation: cannot delete if category contains any materials!
    const containingCount = materials.filter((m) => {
      const assigned = materialCategoryMap[m.id];
      if (assigned) return assigned === catId;
      if (catId === 'cat_threads' && m.kind === 'primary') return true;
      return false;
    }).length;

    if (containingCount > 0) {
      setNotice({
        text: `لا يمكن حذف هذا التصنيف لأنه يحتوي على خامات مسجلة (${containingCount} خامة). يرجى نقل الخامات إلى تصنيف آخر أو حذفها أولاً.`,
        isError: true,
      });
      return;
    }

    const updated = materialCategories.filter((c) => c.id !== catId);
    setMaterialCategories(updated);
    try {
      localStorage.setItem('alshams_mat_categories_' + workshopId, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not store categories:', e);
    }
    setNotice({ text: `تم حذف التصنيف "${targetCat.name}" بنجاح.`, isError: false });
  };

  // Camera Barcode Scanner Handlers
  const handleStartScanner = () => {
    setCameraError(null);
    setIsCameraScannerOpen(true);
  };

  const handleStopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Scanner stop error:', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraScannerOpen(false);
    setCameraError(null);
  };

  const handleBarcodeScanned = async (decodedText: string) => {
    const code = decodedText.trim();
    await handleStopScanner();

    const cleanScanned = code.replace(/^MAT-/i, '').toLowerCase();

    const matched = materials.find((m) => {
      const cleanId = m.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toLowerCase();
      return (
        m.id.toLowerCase() === code.toLowerCase() ||
        cleanId === cleanScanned ||
        m.name.toLowerCase() === code.toLowerCase() ||
        code.includes(cleanId)
      );
    });

    if (matched) {
      setSearchQuery(matched.name);
      const currentStock = stockData[matched.id]?.currentStock ?? 0;
      const minAlertThreshold = stockData[matched.id]?.minAlertThreshold ?? 5;
      const unt = unitsMap.get(matched.unit_id);

      setEditingStockItem({
        id: matched.id,
        name: matched.name,
        currentStock,
        minAlertThreshold,
        unitName: unt?.name || 'وحدة',
      });

      setNotice({
        text: `تم مسح الباركود بنجاح: تم التعرف على الخامة "${matched.name}". يمكنك الآن تعديل رصيدها المخزني.`,
        isError: false,
      });
    } else {
      setNotice({
        text: `تم مسح الرمز (${code}) ولكن لم يتم العثور على خامة مسجلة مطابقة.`,
        isError: true,
      });
    }
  };

  useEffect(() => {
    if (!isCameraScannerOpen) return;

    let isMounted = true;
    const scannerId = 'camera-barcode-reader-viewport';

    const startCamera = async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 160 },
          },
          (decodedText) => {
            if (!isMounted) return;
            handleBarcodeScanned(decodedText);
          },
          () => {}
        );
      } catch (err: any) {
        console.error('Camera scanner init failed:', err);
        if (isMounted) {
          setCameraError(
            'تعذر تشغيل كاميرا الجهاز. يرجى التأكد من منح الإذن للمتصفح باستخدام الكاميرا أو استخدام هاتف ذكي بكاميرا خلفية.'
          );
        }
      }
    };

    const timer = setTimeout(startCamera, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().catch(() => {});
          html5QrCodeRef.current.clear();
        } catch (e) {}
        html5QrCodeRef.current = null;
      }
    };
  }, [isCameraScannerOpen]);

  // Recharts Capital Metrics calculation
  const capitalMetrics = useMemo(() => {
    let totalCapital = 0;
    let totalStockUnits = 0;
    const byCategoryMap: Record<string, { name: string; value: number; count: number }> = {};
    const bySupplierMap: Record<string, { name: string; value: number; count: number }> = {};

    materials.forEach((m) => {
      const stock = stockData[m.id]?.currentStock ?? 0;
      const price = Number(m.purchase_price) || 0;
      const itemCapital = stock * price;
      totalCapital += itemCapital;
      totalStockUnits += stock;

      // Category lookup
      const catId = materialCategoryMap[m.id];
      const catObj = materialCategories.find((c) => c.id === catId);
      const catName = catObj ? catObj.name : m.kind === 'extra' ? 'خامات إضافية' : 'خيوط وحبال';

      if (!byCategoryMap[catName]) {
        byCategoryMap[catName] = { name: catName, value: 0, count: 0 };
      }
      byCategoryMap[catName].value += itemCapital;
      byCategoryMap[catName].count += 1;

      // Supplier lookup
      const sup = m.supplier_id ? suppliersMap.get(m.supplier_id) : null;
      const supName = sup ? sup.name : 'شراء عام / محلي';

      if (!bySupplierMap[supName]) {
        bySupplierMap[supName] = { name: supName, value: 0, count: 0 };
      }
      bySupplierMap[supName].value += itemCapital;
      bySupplierMap[supName].count += 1;
    });

    const categoryData = Object.values(byCategoryMap).sort((a, b) => b.value - a.value);
    const supplierData = Object.values(bySupplierMap).sort((a, b) => b.value - a.value);

    return {
      totalCapital: Math.round(totalCapital),
      totalStockUnits,
      categoryData,
      supplierData,
    };
  }, [materials, stockData, materialCategoryMap, materialCategories, suppliersMap]);

  // Quick Stock & Reorder Threshold Update
  const handleSaveStock = async (materialId: string, newStock: number, newThreshold: number) => {
    const validStock = Number(newStock) >= 0 ? Number(newStock) : 0;
    const validThreshold = Number(newThreshold) >= 0 ? Number(newThreshold) : 5;
    const updated = {
      ...stockData,
      [materialId]: {
        currentStock: validStock,
        minAlertThreshold: validThreshold,
      },
    };
    setStockData(updated);

    try {
      localStorage.setItem('alshams_mat_stock_' + workshopId, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save stock in localStorage', e);
    }

    try {
      const mat = materials.find((m) => m.id === materialId);
      if (mat) {
        const unt = unitsMap.get(mat.unit_id);
        await tenantStorage.saveRawMaterial({
          id: mat.id,
          tenantId: workshopId,
          workshopId: workshopId,
          materialName: mat.name,
          category: mat.kind === 'extra' ? 'خامة إضافية' : 'خامة أساسية',
          unit: unt?.name || 'وحدة',
          currentStock: validStock,
          costPerUnit: Number(mat.purchase_price) || 0,
          costPerGram: unt?.factor && unt.factor > 0 ? Number(mat.purchase_price) / unt.factor : Number(mat.purchase_price),
          minAlertThreshold: validThreshold,
          isActive: true,
          updatedAt: Date.now(),
        });
      }
    } catch (e) {
      console.warn('Dexie save error:', e);
    }

    setEditingStockItem(null);
    setNotice({ text: 'تم تحديث رصيد المخزن وحد الطلب بنجاح.', isError: false });
  };

  // Render Barcode SVG when Barcode Modal opens
  useEffect(() => {
    if (barcodeModalItem && barcodeSvgRef.current) {
      try {
        const cleanId = barcodeModalItem.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
        const codeValue = `MAT-${cleanId}`;
        JsBarcode(barcodeSvgRef.current, codeValue, {
          format: 'CODE128',
          lineColor: '#1c1917',
          width: 2,
          height: 48,
          displayValue: true,
          font: 'monospace',
          fontSize: 13,
          margin: 6,
          background: '#ffffff',
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [barcodeModalItem]);

  const handlePrintLabel = () => {
    window.print();
  };

  // Quick Supplier Creation
  const handleCreateQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) return;

    setSavingQuickSupplier(true);
    try {
      const supName = quickSupplierName.trim();
      const res = await createSupplierInSupabase(workshopId, {
        name: supName,
        phone: quickSupplierPhone.trim() || undefined,
        address: quickSupplierAddress.trim() || undefined,
        notes: quickSupplierNotes.trim() || undefined,
      });

      if (res.error) {
        setNotice({ text: res.error.arabicMessage, isError: true });
        return;
      }

      if (res.data) {
        setSuppliers((prev) => [...prev, res.data!]);
        setSelectedSupplierId(res.data.id);
        setSelectedSupplierName(res.data.name);
        setSupplierSearch(res.data.name);
        setIsQuickSupplierOpen(false);
        setQuickSupplierName('');
        setQuickSupplierPhone('');
        setQuickSupplierAddress('');
        setQuickSupplierNotes('');
        setNotice({ text: `تمت إضافة المورد "${supName}" واختياره بنجاح.`, isError: false });
      }
    } catch (err: any) {
      console.error('Failed to add quick supplier:', err);
      setNotice({ text: 'تعذر إضافة المورد الجديد.', isError: true });
    } finally {
      setSavingQuickSupplier(false);
    }
  };

  // Quick Unit Creation
  const handleCreateQuickUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUnitName.trim() || !quickSubUnit.trim()) return;

    setSavingQuickUnit(true);
    try {
      const res = await createUnitInSupabase(workshopId, {
        name: quickUnitName.trim(),
        small_unit: quickSubUnit.trim(),
        factor: Number(quickConversionFactor) > 0 ? Number(quickConversionFactor) : 1,
      });

      if (res.error) {
        setNotice({ text: res.error.arabicMessage, isError: true });
        return;
      }

      if (res.data) {
        setUnits((prev) => [...prev, res.data!]);
        setSelectedUnitId(res.data.id);
        setIsQuickUnitOpen(false);
        setQuickUnitName('');
        setQuickSubUnit('');
        setQuickConversionFactor(1000);
        setNotice({ text: `تمت إضافة الوحدة "${res.data.name}" بنجاح.`, isError: false });
      }
    } catch (err: any) {
      console.error('Failed to add quick unit:', err);
      setNotice({ text: 'تعذر إضافة وحدة القياس.', isError: true });
    } finally {
      setSavingQuickUnit(false);
    }
  };

  // Unit Manager Save/Delete
  const handleSaveUnitManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUnitName.trim() || !quickSubUnit.trim()) return;

    setSavingQuickUnit(true);
    try {
      if (editingUnit) {
        const res = await updateUnitInSupabase(editingUnit.id, workshopId, {
          name: quickUnitName.trim(),
          small_unit: quickSubUnit.trim(),
          factor: Number(quickConversionFactor) > 0 ? Number(quickConversionFactor) : 1,
        });

        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
          return;
        }

        setNotice({ text: 'تم تحديث وحدة القياس بنجاح.', isError: false });
      } else {
        const res = await createUnitInSupabase(workshopId, {
          name: quickUnitName.trim(),
          small_unit: quickSubUnit.trim(),
          factor: Number(quickConversionFactor) > 0 ? Number(quickConversionFactor) : 1,
        });

        if (res.error) {
          setNotice({ text: res.error.arabicMessage, isError: true });
          return;
        }

        setNotice({ text: 'تمت إضافة وحدة القياس بنجاح.', isError: false });
      }

      const unts = await getUnitsFromSupabase(workshopId);
      setUnits(unts.data || []);
      setEditingUnit(null);
      setQuickUnitName('');
      setQuickSubUnit('');
      setQuickConversionFactor(1000);
    } catch (err: any) {
      console.error('Failed to save unit in manager:', err);
      setNotice({ text: 'تعذر حفظ وحدة القياس.', isError: true });
    } finally {
      setSavingQuickUnit(false);
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      const res = await deleteUnitFromSupabase(unitId, workshopId);
      if (res.error) {
        setNotice({ text: res.error.arabicMessage, isError: true });
      } else {
        setUnits((prev) => prev.filter((u) => u.id !== unitId));
        setNotice({ text: 'تم حذف وحدة القياس بنجاح.', isError: false });
      }
    } catch (err: any) {
      console.error('Failed to delete unit:', err);
      setNotice({ text: 'تعذر حذف وحدة القياس.', isError: true });
    }
  };

  // Filtered Suppliers for inline search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(supplierSearch))
    );
  }, [suppliers, supplierSearch]);

  // Filtered Materials list
  const lowStockCount = useMemo(() => {
    return materials.filter((m) => {
      const stock = stockData[m.id]?.currentStock ?? 0;
      const threshold = stockData[m.id]?.minAlertThreshold ?? 5;
      return stock <= threshold;
    }).length;
  }, [materials, stockData]);

  const filteredMaterials = useMemo(() => {
    let list = materials.filter((m) => {
      const sup = m.supplier_id ? suppliersMap.get(m.supplier_id) : null;
      const unt = unitsMap.get(m.unit_id);
      const catId = materialCategoryMap[m.id];
      const catObj = materialCategories.find((c) => c.id === catId);
      const stock = stockData[m.id]?.currentStock ?? 0;
      const threshold = stockData[m.id]?.minAlertThreshold ?? 5;
      const isLow = stock <= threshold;

      if (onlyLowStock && !isLow) return false;

      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sup && sup.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (unt && unt.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (catObj && catObj.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.market_name && m.market_name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Primary vs Extra filter
      if (categoryFilter === 'primary' && m.kind !== 'primary') return false;
      if (categoryFilter === 'extra' && m.kind !== 'extra') return false;

      // Group Category filter
      if (selectedGroupCategoryFilter !== 'all') {
        if (catId) {
          if (catId !== selectedGroupCategoryFilter) return false;
        } else {
          // Default association if not explicitly assigned
          if (selectedGroupCategoryFilter === 'cat_threads' && m.kind !== 'primary') return false;
          if (selectedGroupCategoryFilter !== 'cat_threads') return false;
        }
      }

      return true;
    });

    if (sortBy === 'most_needed') {
      list = [...list].sort((a, b) => {
        const stockA = stockData[a.id]?.currentStock ?? 0;
        const thresholdA = stockData[a.id]?.minAlertThreshold ?? 5;
        const diffA = stockA - thresholdA;

        const stockB = stockData[b.id]?.currentStock ?? 0;
        const thresholdB = stockData[b.id]?.minAlertThreshold ?? 5;
        const diffB = stockB - thresholdB;

        if (diffA !== diffB) return diffA - diffB;
        return stockA - stockB;
      });
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => Number(b.purchase_price) - Number(a.purchase_price));
    } else if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => Number(a.purchase_price) - Number(b.purchase_price));
    }

    return list;
  }, [
    materials,
    searchQuery,
    categoryFilter,
    selectedGroupCategoryFilter,
    materialCategoryMap,
    materialCategories,
    suppliersMap,
    unitsMap,
    stockData,
    onlyLowStock,
    sortBy,
  ]);

  // Stats
  const basicMaterialsCount = useMemo(() => {
    return materials.filter((m) => m.kind === 'primary').length;
  }, [materials]);

  const extraMaterialsCount = useMemo(() => {
    return materials.filter((m) => m.kind === 'extra').length;
  }, [materials]);

  return (
    <div className="space-y-5 text-right animate-in fade-in duration-200">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold transition-all ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/50'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.isError ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-stone-400 hover:text-stone-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Action Buttons */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-amber-200 text-xs font-bold mb-2 border border-white/20">
            <Layers className="w-3.5 h-3.5" />
            <span>سجل الخامات ووحدات القياس</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">
            إدارة الخامات ووحدات القياس للورشة
          </h1>
          <p className="text-xs text-amber-100/90 mt-1 max-w-xl">
            سجل الخامات الأساسية والإضافية وربطها بالموردين ووحدات القياس وتنبيهات المخزون المنخفض مع طباعة الباركود والملصقات بدقة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowCapitalAnalytics((prev) => !prev)}
            className={`px-3.5 py-2.5 rounded-2xl backdrop-blur-md border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
              showCapitalAnalytics
                ? 'bg-amber-400 text-amber-950 border-amber-300 font-black'
                : 'bg-white/15 hover:bg-white/25 border-white/30 text-white'
            }`}
          >
            <ChartPieIcon className="w-4 h-4 text-amber-300" />
            <span>تحليل رأس المال 📊</span>
            <span className="px-2 py-0.5 rounded-full bg-black/20 text-[10px] font-mono">
              {capitalMetrics.totalCapital.toLocaleString()} {workshop.currencySymbol}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCategoryManagerOpen(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <Tag className="w-4 h-4 text-amber-300" />
            <span>إدارة التصنيفات ({materialCategories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUnitsManagerOpen(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <Scale className="w-4 h-4 text-amber-300" />
            <span>إدارة وحدات القياس</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddMaterial}
            className="px-4 py-2.5 rounded-2xl bg-white text-amber-900 hover:bg-amber-50 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 text-amber-700" />
            <span>إضافة خامة جديدة</span>
          </button>
        </div>
      </div>

      {/* Stats Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs text-right">
          <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-1">
            إجمالي الخامات المسجلة
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
            {materials.length} <span className="text-xs font-normal text-stone-400">خامة</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs text-right">
          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block mb-1">
            الخامات الأساسية (خيوط، حبال...)
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-200">
            {basicMaterialsCount} <span className="text-xs font-normal text-stone-400">خامة</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs text-right">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
            الخامات الإضافية (إكسسوارات، خرز...)
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300">
            {extraMaterialsCount} <span className="text-xs font-normal text-stone-400">خامة</span>
          </div>
        </div>

        {/* Low Stock Alert Summary Card */}
        <button
          type="button"
          onClick={() => {
            setOnlyLowStock((prev) => !prev);
            if (!onlyLowStock) setSortBy('most_needed');
          }}
          className={`p-4 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
            lowStockCount > 0
              ? onlyLowStock
                ? 'bg-rose-500 text-white border-rose-600 shadow-md ring-2 ring-rose-400'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100'
              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold ${
                onlyLowStock
                  ? 'text-rose-100'
                  : lowStockCount > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              تنبيهات نواقص المخزون
            </span>
            <ShieldAlert
              className={`w-4 h-4 ${
                onlyLowStock ? 'text-white' : lowStockCount > 0 ? 'text-rose-600 animate-pulse' : 'text-stone-400'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div
              className={`text-xl sm:text-2xl font-black font-mono ${
                onlyLowStock
                  ? 'text-white'
                  : lowStockCount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-stone-700 dark:text-stone-300'
              }`}
            >
              {lowStockCount}{' '}
              <span className={`text-xs font-normal ${onlyLowStock ? 'text-rose-200' : 'text-stone-400'}`}>
                صنف يحتاج طلب
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                onlyLowStock
                  ? 'bg-white/20 text-white'
                  : lowStockCount > 0
                  ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
              }`}
            >
              {onlyLowStock ? 'تصفية مفعلة' : 'فلترة النواقص'}
            </span>
          </div>
        </button>
      </div>

      {/* ======================================================== */}
      {/* RECHARTS INVENTORY CAPITAL ANALYTICS DASHBOARD           */}
      {/* ======================================================== */}
      {showCapitalAnalytics && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-800 shadow-md space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ChartPieIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-stone-900 dark:text-stone-100">
                  تحليل رأس المال المرتبط بالمخزون الحالي
                </h3>
                <p className="text-xs text-stone-500">
                  توزيع استثمارات الخامات بناءً على الأرصدة الفعلية وأسعار الشراء المسجلة
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-800">
              <button
                type="button"
                onClick={() => setChartViewMode('category')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  chartViewMode === 'category'
                    ? 'bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-300 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                توزيع حسب الفئات 🥧
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('supplier')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  chartViewMode === 'supplier'
                    ? 'bg-white dark:bg-stone-900 text-amber-900 dark:text-amber-300 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                توزيع حسب الموردين 📊
              </button>
            </div>
          </div>

          {/* Capital Metrics Quick Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block mb-1">
                إجمالي رأس المال بالمخزن
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-100 font-mono">
                {capitalMetrics.totalCapital.toLocaleString()}{' '}
                <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                  {workshop.currencySymbol}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-1">
                الأصناف المتوفرة برصيد
              </span>
              <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
                {materials.filter((m) => (stockData[m.id]?.currentStock ?? 0) > 0).length}{' '}
                <span className="text-xs font-normal text-stone-400">من أصل {materials.length} خامة</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block mb-1">
                أعلى تصنيف استثماراً
              </span>
              <div className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 truncate">
                {capitalMetrics.categoryData[0]?.name || '—'}
              </div>
              <span className="text-[11px] text-stone-400 font-mono">
                {capitalMetrics.categoryData[0]?.value
                  ? `${capitalMetrics.categoryData[0].value.toLocaleString()} ${workshop.currencySymbol}`
                  : '0'}
              </span>
            </div>
          </div>

          {/* Recharts Visualizations */}
          {chartViewMode === 'category' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-6 h-64 sm:h-72 flex items-center justify-center">
                {capitalMetrics.categoryData.length === 0 || capitalMetrics.totalCapital === 0 ? (
                  <div className="text-center text-stone-400 text-xs">
                    لا تتوفر أرصدة مخزنية حالياً لعرض الرسم البياني.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={capitalMetrics.categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {capitalMetrics.categoryData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any) => [
                          `${Number(val).toLocaleString()} ${workshop.currencySymbol}`,
                          'قيمة المخزون',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Category Breakdown Table */}
              <div className="lg:col-span-6 space-y-2 max-h-72 overflow-y-auto">
                <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                  تفاصيل رأس المال حسب الفئات:
                </h4>
                {capitalMetrics.categoryData.map((cat, idx) => {
                  const percent =
                    capitalMetrics.totalCapital > 0
                      ? Math.round((cat.value / capitalMetrics.totalCapital) * 100)
                      : 0;
                  const color = CHART_COLORS[idx % CHART_COLORS.length];
                  return (
                    <div
                      key={cat.name}
                      className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          ({cat.count} خامة)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-extrabold text-stone-900 dark:text-stone-100">
                          {cat.value.toLocaleString()} {workshop.currencySymbol}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-750 text-stone-600 dark:text-stone-300 font-bold">
                          %{percent}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full pt-2">
              {capitalMetrics.supplierData.length === 0 || capitalMetrics.totalCapital === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-stone-400 text-xs">
                  لا تتوفر أرصدة مخزنية حالياً لعرض التوزيع حسب الموردين.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={capitalMetrics.supplierData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip
                      formatter={(val: any) => [
                        `${Number(val).toLocaleString()} ${workshop.currencySymbol}`,
                        'رأس المال المرتبط بالمورد',
                      ]}
                    />
                    <Bar dataKey="value" fill="#d97706" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls Bar (Search & Filter & Sort & Barcode Camera) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search & Camera Barcode Scanner Button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، المورد، الوحدة، التصنيف، أو اسم السوق..."
              className="w-full pr-10 pl-4 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={handleStartScanner}
            className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 shadow-xs"
            title="مسح الباركود باستخدام كاميرا الهاتف أو الحاسوب"
          >
            <Camera className="w-4 h-4 text-amber-600" />
            <span>مسح بالكاميرا 📷</span>
          </button>
        </div>

        {/* Filter and Sorting Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Categories Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setSelectedGroupCategoryFilter('all');
                setOnlyLowStock(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                categoryFilter === 'all' && selectedGroupCategoryFilter === 'all' && !onlyLowStock
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              الكل ({materials.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('primary');
                setOnlyLowStock(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                categoryFilter === 'primary' && !onlyLowStock
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              خامات أساسية ({basicMaterialsCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('extra');
                setOnlyLowStock(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                categoryFilter === 'extra' && !onlyLowStock
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              خامات إضافية ({extraMaterialsCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setOnlyLowStock((prev) => !prev);
                if (!onlyLowStock) setSortBy('most_needed');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                onlyLowStock
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>النواقص فقط ({lowStockCount})</span>
            </button>
          </div>

          {/* Group Category Chips Filter */}
          {materialCategories.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pr-2 border-r border-stone-200 dark:border-stone-800">
              <span className="text-[10px] text-stone-400 font-bold whitespace-nowrap">الفئات:</span>
              {materialCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedGroupCategoryFilter((prev) => (prev === cat.id ? 'all' : cat.id));
                    setOnlyLowStock(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    selectedGroupCategoryFilter === cat.id
                      ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-stone-200 dark:border-stone-800">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2.5 py-1.5 rounded-xl border-none outline-none cursor-pointer"
            >
              <option value="default">الترتيب: الافتراضي</option>
              <option value="most_needed">الأكثر احتياجاً في الأعلى 🚨</option>
              <option value="name">الاسم (أ - ي)</option>
              <option value="price_desc">السعر (الأعلى أولاً)</option>
              <option value="price_asc">السعر (الأقل أولاً)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Materials Table */}
      <div className="rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden text-right">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-stone-500">جاري تحميل سجل الخامات من قاعدة البيانات...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Boxes className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-stone-800 dark:text-stone-200 text-sm">
              لم يتم العثور على أي خامات
            </h3>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              {searchQuery
                ? 'لا توجد خامات مطابقة لبحثك، جرب كتابة كلمة أخرى.'
                : onlyLowStock
                ? 'رائع! لا توجد حالياً أي خامات منخفضة عن حد الطلب.'
                : 'ابدأ الآن بإضافة أول خامة لورشتك وربطها بالوحدة والمورد المناسب.'}
            </p>
            {onlyLowStock ? (
              <button
                type="button"
                onClick={() => setOnlyLowStock(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <span>عرض جميع الخامات</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAddMaterial}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة خامة الآن</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-100/70 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-800">
                  <th className="p-3.5">اسم الخامة</th>
                  <th className="p-3.5">التصنيف</th>
                  <th className="p-3.5">المورد</th>
                  <th className="p-3.5">سعر الشراء</th>
                  <th className="p-3.5">وحدة القياس</th>
                  <th className="p-3.5">رصيد المخزن وحد الطلب</th>
                  <th className="p-3.5">الاسم بالسوق</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                {filteredMaterials.map((m) => {
                  const isExtra = m.kind === 'extra';
                  const sup = m.supplier_id ? suppliersMap.get(m.supplier_id) : null;
                  const unt = unitsMap.get(m.unit_id);
                  const currentStock = stockData[m.id]?.currentStock ?? 0;
                  const minAlertThreshold = stockData[m.id]?.minAlertThreshold ?? 5;
                  const isLowStock = currentStock <= minAlertThreshold;

                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors ${
                        isLowStock
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/40'
                          : 'hover:bg-amber-50/40 dark:hover:bg-stone-800/40'
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                            {m.name}
                          </div>
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>مخزون منخفض ({currentStock} / {minAlertThreshold} {unt?.name || ''})</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isExtra
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {isExtra ? 'خامة إضافية' : 'خامة أساسية'}
                          </span>
                          {(() => {
                            const catId = materialCategoryMap[m.id];
                            const catObj = materialCategories.find((c) => c.id === catId);
                            const label = catObj?.name || (isExtra ? 'مستلزمات عامة' : 'خيوط وحبال');
                            return (
                              <div className="text-[10px] text-stone-500 font-medium flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5 text-stone-400" />
                                <span>{label}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>

                      <td className="p-3.5 text-stone-600 dark:text-stone-400">
                        {sup?.name || '— (شراء عام)'}
                      </td>

                      <td className="p-3.5 font-mono font-bold text-stone-900 dark:text-stone-100">
                        {m.purchase_price} {workshop.currencySymbol}{' '}
                        <span className="text-[10px] text-stone-400 font-normal">
                          / {unt?.name || 'وحدة'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-stone-800 dark:text-stone-200">
                            {unt?.name || '—'}
                          </span>
                          {unt?.small_unit && unt.small_unit !== unt.name && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500">
                              (الصغرى: {unt.small_unit})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock & Reorder Threshold Column */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <div
                              className={`font-mono font-bold text-xs ${
                                isLowStock
                                  ? 'text-rose-600 dark:text-rose-400 font-black'
                                  : 'text-stone-900 dark:text-stone-100'
                              }`}
                            >
                              {currentStock}{' '}
                              <span className="text-[10px] text-stone-500 font-normal">
                                {unt?.name || 'وحدة'}
                              </span>
                            </div>
                            <div className="text-[10px] text-stone-400">
                              حد الطلب: {minAlertThreshold} {unt?.name || ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingStockItem({
                                id: m.id,
                                name: m.name,
                                currentStock,
                                minAlertThreshold,
                                unitName: unt?.name || 'وحدة',
                              })
                            }
                            className="p-1 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                            title="تعديل رصيد المخزن وحد الطلب"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5 text-stone-600 dark:text-stone-400">
                        {m.market_name ? (
                          <div className="text-[11px]">
                            <span className="font-bold text-stone-800 dark:text-stone-200">
                              {m.market_name}
                            </span>{' '}
                            <span className="text-stone-400 text-[10px] font-mono">
                              (الواحدة = {m.market_unit_factor} {unt?.small_unit || unt?.name || ''})
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print Barcode Button */}
                          <button
                            type="button"
                            onClick={() => setBarcodeModalItem(m)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                            title="طباعة باركود / ملصق تعريف"
                          >
                            <Barcode className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditMaterial(m)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                            title="تعديل الخامة"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingMaterialId(m.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title="حذف الخامة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* ======================================================== */}
      {/* 1. ADD / EDIT MATERIAL MODAL                             */}
      {/* ======================================================== */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-right space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                    {editingMaterial ? 'تعديل بيانات الخامة' : 'إضافة خامة جديدة'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    سجل بيانات الخامة والوحدة والتسعير في قاعدة البيانات
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              {/* Material Name */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  اسم الخامة *
                </label>
                <input
                  type="text"
                  required
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  placeholder="مثال: خيط قطن محلول 4 مم، حلقة حديد 20 سم، ريزن إيبوكسي..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              {/* Classification: Basic (primary) vs Extra */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  تصنيف نوع الخامة *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMaterialKind('primary')}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer ${
                      materialKind === 'primary'
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 font-extrabold shadow-xs'
                        : 'border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-medium'
                    }`}
                  >
                    <div className="text-xs font-extrabold">خامة أساسية (primary)</div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                      مثل الخيوط، الحبال، الخشب، النسيج
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMaterialKind('extra')}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer ${
                      materialKind === 'extra'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-extrabold shadow-xs'
                        : 'border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-850 text-stone-600 dark:text-stone-400 font-medium'
                    }`}
                  >
                    <div className="text-xs font-extrabold">خامة إضافية (extra)</div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                      مثل الإكسسوارات، الحديد، الخرز، التغليف
                    </div>
                  </button>
                </div>
              </div>

              {/* Category Group Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <button
                    type="button"
                    onClick={() => setIsCategoryManagerOpen(true)}
                    className="text-amber-600 dark:text-amber-400 hover:text-amber-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إدارة / إضافة تصنيف</span>
                  </button>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    مجموعة التصنيف الرئيسي (Category Group) *
                  </label>
                </div>
                <select
                  value={selectedMaterialCategory}
                  onChange={(e) => setSelectedMaterialCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
                >
                  {materialCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.kind === 'primary' ? 'أساسي' : 'إضافي'})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  تتيح تصنيف الخامات في مجموعات كبرى لتسهيل البحث وتحليل المخزون.
                </span>
              </div>

              {/* Supplier with search and + Add Supplier button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <button
                    type="button"
                    onClick={() => setIsQuickSupplierOpen(true)}
                    className="text-amber-600 dark:text-amber-400 hover:text-amber-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة مورد جديد</span>
                  </button>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    المورد الرئيسي
                  </label>
                </div>

                <div className="relative">
                  <div
                    onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs flex items-center justify-between cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      {selectedSupplierName || 'اختر المورد أو ابحث باسمه...'}
                    </span>
                  </div>

                  {isSupplierDropdownOpen && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 p-2 space-y-1.5 animate-in fade-in">
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        placeholder="ابحث في الموردين المسجلين..."
                        className="w-full px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs outline-none"
                        autoFocus
                      />

                      <div className="max-h-40 overflow-y-auto space-y-0.5">
                        <div
                          onClick={() => {
                            setSelectedSupplierId('');
                            setSelectedSupplierName('');
                            setIsSupplierDropdownOpen(false);
                          }}
                          className="p-2 rounded-xl text-xs hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer text-stone-500"
                        >
                          بدون مورد محدد (شراء عام)
                        </div>
                        {filteredSuppliers.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedSupplierId(s.id);
                              setSelectedSupplierName(s.name);
                              setIsSupplierDropdownOpen(false);
                            }}
                            className={`p-2 rounded-xl text-xs hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between ${
                              selectedSupplierId === s.id
                                ? 'bg-amber-100/60 dark:bg-amber-950/60 font-bold text-amber-900 dark:text-amber-200'
                                : 'text-stone-700 dark:text-stone-300'
                            }`}
                          >
                            <span className="text-[10px] text-stone-400 font-mono">
                              {s.phone || ''}
                            </span>
                            <span>{s.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Units & Purchase Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Unit selector with + button and small unit badge */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={() => setIsQuickUnitOpen(true)}
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>وحدة جديدة</span>
                    </button>
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      وحدة القياس *
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none cursor-pointer"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>

                    {/* SubUnit indicator: shows small_unit name only, as requested */}
                    {currentUnitRecord && currentUnitRecord.small_unit && (
                      <div
                        className="px-2.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-bold whitespace-nowrap"
                        title={`الوحدة الصغرى التابعة لـ ${currentUnitRecord.name}`}
                      >
                        الصغرى: {currentUnitRecord.small_unit}
                      </div>
                    )}
                  </div>
                </div>

                {/* Purchase Price (سعر الشراء) using NumberInput */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    سعر الشراء ({workshop.currencySymbol}) *
                  </label>
                  <div className="relative">
                    <NumberInput
                      required
                      value={purchasePrice}
                      onChange={setPurchasePrice}
                      placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold outline-none focus:border-amber-500"
                    />
                    <span className="absolute left-3 top-2.5 text-[10px] text-stone-400 font-mono">
                      لكل {currentUnitRecord?.name || 'وحدة'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Market Name (الاسم بالسوق) - Optional */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    الاسم بالسوق <span className="text-stone-400 font-normal">(اختياري، مثل شلة أو بكرة)</span>
                  </label>
                  <input
                    type="text"
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    placeholder="مثال: شلة، بكرة، كرتونة، لفة..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                  />
                  <span className="text-[10px] text-stone-400 block mt-0.5">
                    الاسم التجاري الدارج للقطعة كما تشتريها من الموردين في السوق.
                  </span>
                </div>

                {/* If marketName is entered, show conversion factor field (market_unit_factor) measured in small unit */}
                {marketName.trim() && (
                  <div className="animate-in fade-in space-y-1">
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-300">
                      الواحدة منها ({marketName}) تساوي كم من ({currentUnitRecord?.small_unit || currentUnitRecord?.name || 'الوحدة الصغرى'})؟ *
                    </label>
                    <div className="relative">
                      <NumberInput
                        value={marketUnitFactor}
                        onChange={setMarketUnitFactor}
                        placeholder="200"
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 text-xs font-mono font-bold outline-none"
                      />
                      <span className="absolute left-3 top-2 text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                        {currentUnitRecord?.small_unit || currentUnitRecord?.name || 'وحدة'}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 block">
                      فمثلاً لو كان الاسم بالسوق شلة، والوحدة المختارة كيلو، فاكتب هنا 200 لتسجل 200 {currentUnitRecord?.small_unit || 'جرام'}. يُحفظ هذا الرقم في market_unit_factor.
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingMaterial}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {savingMaterial ? 'جاري الحفظ...' : editingMaterial ? 'تحديث الخامة' : 'حفظ الخامة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. QUICK ADD SUPPLIER INLINE MODAL                      */}
      {/* ======================================================== */}
      {isQuickSupplierOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateQuickSupplier}
            className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-sm border border-stone-200 dark:border-stone-800 shadow-2xl p-5 text-right space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsQuickSupplierOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-amber-600" />
                <span>إضافة مورد جديد للورشة</span>
              </h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                اسم المورد أو المحل *
              </label>
              <input
                type="text"
                required
                value={quickSupplierName}
                onChange={(e) => setQuickSupplierName(e.target.value)}
                placeholder="مثال: مغزل المحلة، شركة الأهرام..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                رقم الهاتف / واتساب
              </label>
              <input
                type="tel"
                value={quickSupplierPhone}
                onChange={(e) => setQuickSupplierPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                العنوان
              </label>
              <input
                type="text"
                value={quickSupplierAddress}
                onChange={(e) => setQuickSupplierAddress(e.target.value)}
                placeholder="مثال: درب البرابرة، العتبة، القاهرة"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsQuickSupplierOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingQuickSupplier}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingQuickSupplier ? 'جاري الإضافة...' : 'إضافة المورد واختياره'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. QUICK ADD UNIT INLINE MODAL                          */}
      {/* ======================================================== */}
      {isQuickUnitOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateQuickUnit}
            className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-sm border border-stone-200 dark:border-stone-800 shadow-2xl p-5 text-right space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsQuickUnitOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-600" />
                <span>إضافة وحدة قياس جديدة</span>
              </h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                اسم الوحدة الكبرى (name) *
              </label>
              <input
                type="text"
                required
                value={quickUnitName}
                onChange={(e) => setQuickUnitName(e.target.value)}
                placeholder="مثال: ياردة، كرتونة، دستة، قيراط..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                اسم الوحدة الصغرى (small_unit) *
              </label>
              <input
                type="text"
                required
                value={quickSubUnit}
                onChange={(e) => setQuickSubUnit(e.target.value)}
                placeholder="مثال: بوصة، قطعة، سم، مل..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                معامل التحويل (factor: كم وحدة صغرى في الكبرى؟) *
              </label>
              <NumberInput
                required
                value={quickConversionFactor}
                onChange={setQuickConversionFactor}
                placeholder="1"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold outline-none"
              />
              <span className="text-[10px] text-stone-400 block mt-0.5">
                مثلاً: الكيلو = 1000 جرام، الدستة = 12 قطعة، المتر = 100 سم.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsQuickUnitOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingQuickUnit}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingQuickUnit ? 'جاري الإضافة...' : 'حفظ الوحدة واختيارها'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. UNITS MANAGER FULL MODAL                              */}
      {/* ======================================================== */}
      {isUnitsManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-right space-y-5">
            <div className="flex items-center justify-between border-b pb-4 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => {
                  setIsUnitsManagerOpen(false);
                  setEditingUnit(null);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                    إدارة وحدات القياس (units)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    جدول الوحدات المسجلة للورشة في Supabase ومعاملات التحويل بين الكبرى والصغرى
                  </p>
                </div>
              </div>
            </div>

            {/* Form for adding/editing in manager */}
            <form onSubmit={handleSaveUnitManager} className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-3">
              <h4 className="text-xs font-extrabold text-stone-800 dark:text-stone-200">
                {editingUnit ? `تعديل وحدة: ${editingUnit.name}` : '+ إضافة وحدة قياس مخصصة'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                    الوحدة الكبرى (name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickUnitName}
                    onChange={(e) => setQuickUnitName(e.target.value)}
                    placeholder="مثال: ياردة"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                    الوحدة الصغرى (small_unit) *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickSubUnit}
                    onChange={(e) => setQuickSubUnit(e.target.value)}
                    placeholder="مثال: سم"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
                    معامل التحويل (factor) *
                  </label>
                  <NumberInput
                    required
                    value={quickConversionFactor}
                    onChange={setQuickConversionFactor}
                    placeholder="100"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {editingUnit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUnit(null);
                      setQuickUnitName('');
                      setQuickSubUnit('');
                      setQuickConversionFactor(1000);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-stone-500 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingQuickUnit}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {savingQuickUnit ? 'جاري الحفظ...' : editingUnit ? 'تحديث الوحدة' : 'حفظ الوحدة'}
                </button>
              </div>
            </form>

            {/* Units list */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-stone-700 dark:text-stone-300">
                الوحدات المسجلة حالياً ({units.length}):
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {units.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUnit(u);
                          setQuickUnitName(u.name);
                          setQuickSubUnit(u.small_unit);
                          setQuickConversionFactor(u.factor);
                        }}
                        className="p-1 text-stone-400 hover:text-amber-600 transition"
                        title="تعديل الوحدة"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(u.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 transition"
                        title="حذف الوحدة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-xs text-stone-900 dark:text-stone-100">
                        {u.name}
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono">
                        1 {u.name} = {u.factor} {u.small_unit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. DELETE CONFIRM MODAL                                  */}
      {/* ======================================================== */}
      {deletingMaterialId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-sm border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
              تأكيد حذف الخامة؟
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              هل أنت متأكد من حذف هذه الخامة نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذه الخطوة.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMaterialId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMaterial(deletingMaterialId)}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
              >
                نعم، احذف الخامة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. BARCODE & PHYSICAL LABEL PRINT MODAL                  */}
      {/* ======================================================== */}
      {barcodeModalItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-md border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-right space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800 no-print">
              <button
                type="button"
                onClick={() => setBarcodeModalItem(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Barcode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                    ملصق تعريف صنف مخزني (باركود)
                  </h3>
                  <p className="text-[10px] text-stone-400">
                    جاهز للطباعة واللصق على أرفف وصناديق المخزن المادي
                  </p>
                </div>
              </div>
            </div>

            {/* Printable Label Container */}
            <div
              id="printable-barcode-label"
              className="p-5 rounded-2xl bg-white text-stone-950 border-2 border-stone-800 shadow-sm text-center space-y-3 mx-auto max-w-xs select-none"
            >
              {/* Workshop Header */}
              <div className="border-b border-stone-200 pb-2 flex items-center justify-between text-[11px] font-bold text-stone-600">
                <span className="font-black text-amber-900">{workshop.brandName || 'منظومة الشمساوية'}</span>
                <span className="text-[9px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500 font-mono">
                  {barcodeModalItem.kind === 'extra' ? 'خامة إضافية' : 'خامة أساسية'}
                </span>
              </div>

              {/* Material Name */}
              <div className="pt-1">
                <div className="font-black text-lg text-stone-950 leading-tight">
                  {barcodeModalItem.name}
                </div>
                {barcodeModalItem.market_name && (
                  <div className="text-xs font-bold text-amber-800 mt-0.5">
                    {barcodeModalItem.market_name}{' '}
                    <span className="text-[10px] font-mono text-stone-600">
                      (الواحدة = {barcodeModalItem.market_unit_factor}{' '}
                      {unitsMap.get(barcodeModalItem.unit_id)?.small_unit ||
                        unitsMap.get(barcodeModalItem.unit_id)?.name ||
                        ''})
                    </span>
                  </div>
                )}
              </div>

              {/* Specs & Supplier */}
              <div className="grid grid-cols-2 gap-2 text-right bg-stone-50 p-2.5 rounded-xl border border-stone-100 text-[10px]">
                <div>
                  <span className="text-stone-500 block">المورد:</span>
                  <span className="font-bold text-stone-900 truncate block">
                    {suppliersMap.get(barcodeModalItem.supplier_id || '')?.name || 'شراء عام'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">سعر الشراء:</span>
                  <span className="font-bold font-mono text-stone-900 block">
                    {barcodeModalItem.purchase_price} {workshop.currencySymbol} / {unitsMap.get(barcodeModalItem.unit_id)?.name || 'وحدة'}
                  </span>
                </div>
              </div>

              {/* Barcode Render SVG */}
              <div className="pt-2 pb-1 bg-white flex flex-col items-center justify-center">
                <svg ref={barcodeSvgRef} className="max-w-full h-auto" />
              </div>

              <div className="text-[9px] text-stone-400 border-t border-stone-100 pt-1">
                منظومة الشمساوية لإدارة مخازن الحرف اليدوية
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5 no-print">
              <button
                type="button"
                onClick={() => setBarcodeModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handlePrintLabel}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الملصق (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. QUICK EDIT STOCK & REORDER THRESHOLD MODAL            */}
      {/* ======================================================== */}
      {editingStockItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-sm border border-stone-200 dark:border-stone-800 shadow-2xl p-5 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setEditingStockItem(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                <span>تعديل رصيد وحد الطلب</span>
              </h4>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/60">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                الخامة:
              </span>
              <div className="font-black text-sm text-stone-900 dark:text-stone-100">
                {editingStockItem.name}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  رصيد المخزن الفعلي الحالي ({editingStockItem.unitName}) *
                </label>
                <NumberInput
                  value={editingStockItem.currentStock}
                  onChange={(val) =>
                    setEditingStockItem((prev) => (prev ? { ...prev, currentStock: val } : null))
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  حد الطلب الأدنى للتنبيه ({editingStockItem.unitName}) *
                </label>
                <NumberInput
                  value={editingStockItem.minAlertThreshold}
                  onChange={(val) =>
                    setEditingStockItem((prev) => (prev ? { ...prev, minAlertThreshold: val } : null))
                  }
                  placeholder="5"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-mono font-bold"
                />
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  عند وصول الرصيد إلى هذا الرقم أو أقل يظهر تنبيه فوري باللون الأحمر.
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStockItem(null)}
                className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveStock(
                    editingStockItem.id,
                    editingStockItem.currentStock,
                    editingStockItem.minAlertThreshold
                  )
                }
                className="px-5 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-md active:scale-95"
              >
                حفظ الرصيد وحد الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. CATEGORY MANAGER MODAL                                */}
      {/* ======================================================== */}
      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-right space-y-5">
            <div className="flex items-center justify-between border-b pb-4 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryManagerOpen(false);
                  setEditingCategory(null);
                  setNewCategoryName('');
                }}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                    إدارة تصنيفات ومجموعات الخامات
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    إضافة وتعديل وحذف التصنيفات الرئيسية للورشة (كالخيوط، الأخشاب، الإكسسوارات)
                  </p>
                </div>
              </div>
            </div>

            {/* Form for adding / editing category */}
            <form onSubmit={handleSaveCategory} className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3">
              <h4 className="text-xs font-extrabold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-amber-600" />
                <span>{editingCategory ? `تعديل التصنيف: ${editingCategory.name}` : 'إضافة تصنيف رئيسي جديد'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    اسم التصنيف *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="مثال: خيوط قطن، أخشاب زان، خرز كريستال..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-bold outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نوع المجموعة *
                  </label>
                  <select
                    value={newCategoryKind}
                    onChange={(e) => setNewCategoryKind(e.target.value as 'primary' | 'extra')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-bold outline-none cursor-pointer"
                  >
                    <option value="primary">مجموعة خامات أساسية (خيوط وحبال...)</option>
                    <option value="extra">مجموعة خامات إضافية (أخشاب وإكسسوارات...)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setNewCategoryName('');
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-stone-500 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shadow-sm active:scale-95"
                >
                  {editingCategory ? 'تحديث التصنيف' : 'حفظ التصنيف الجديد'}
                </button>
              </div>
            </form>

            {/* List and Search of Existing Categories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-500">
                  إجمالي التصنيفات: {materialCategories.length}
                </span>
                <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  التصنيفات المسجلة حالياً:
                </h4>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="ابحث في التصنيفات..."
                  className="w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 outline-none"
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {materialCategories
                  .filter((c) => !categorySearch.trim() || c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  .map((cat) => {
                    const count = materials.filter((m) => {
                      const assigned = materialCategoryMap[m.id];
                      if (assigned) return assigned === cat.id;
                      if (cat.id === 'cat_threads' && m.kind === 'primary') return true;
                      return false;
                    }).length;

                    return (
                      <div
                        key={cat.id}
                        className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(cat);
                              setNewCategoryName(cat.name);
                              setNewCategoryKind(cat.kind);
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-stone-200 dark:hover:bg-stone-750 transition cursor-pointer"
                            title="تعديل التصنيف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="حذف التصنيف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              cat.kind === 'primary'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {cat.kind === 'primary' ? 'أساسي' : 'إضافي'}
                          </span>
                          <div>
                            <div className="font-extrabold text-xs text-stone-900 dark:text-stone-100 flex items-center gap-1.5 justify-end">
                              <span>{cat.name}</span>
                              <Folder className="w-3.5 h-3.5 text-amber-600" />
                            </div>
                            <div className="text-[10px] text-stone-400">
                              يحتوي على: {count} خامة مسجلة
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryManagerOpen(false);
                  setEditingCategory(null);
                  setNewCategoryName('');
                }}
                className="px-5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-bold transition cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. CAMERA BARCODE SCANNER MODAL                          */}
      {/* ======================================================== */}
      {isCameraScannerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-md border border-stone-200 dark:border-stone-800 shadow-2xl p-6 text-center space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={handleStopScanner}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                  قارئ الباركود عبر الكاميرا
                </h3>
              </div>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              وجّه كاميرا الهاتف أو الجهاز نحو ملصق الباركود الخاص بالخامة للتعرف الفوري عليها وإدخال حركاتها المخزنية.
            </p>

            {/* Video Viewport Container */}
            <div className="relative overflow-hidden rounded-2xl bg-black border-2 border-amber-500 shadow-inner">
              <div id="camera-barcode-reader-viewport" className="w-full h-64 mx-auto" />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-52 h-32 border-2 border-dashed border-amber-400/80 rounded-xl" />
              </div>
            </div>

            {cameraError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2 text-right">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-stone-400 font-mono">CODE128 / QR Ready</span>
              <button
                type="button"
                onClick={handleStopScanner}
                className="px-5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء وإغلاق الكاميرا
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles for clean label thermal printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-barcode-label,
          #printable-barcode-label * {
            visibility: visible !important;
          }
          #printable-barcode-label {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 320px !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 16px !important;
            z-index: 999999 !important;
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
