import React, { useState, useEffect } from 'react';
import {
  WorkOrderRecord,
  RawMaterialItem,
  EmployeeProfile,
  WorkshopProfile,
  WorkOrderStatus,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import { supabase } from '../../lib/supabase';
import {
  Hammer,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Boxes,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  X,
  Trash2,
  PackageCheck,
  Percent,
  Sparkles,
  BookOpen,
  ClipboardCheck,
  Award,
  DollarSign,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';

interface WorkOrdersViewProps {
  workshop: WorkshopProfile;
  onOpenHelp: (sectionId: string) => void;
  initialStage?: 'create' | 'issue' | 'receive';
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  workshop,
  onOpenHelp,
  initialStage,
}) => {
  const workshopId = workshop.tenantId || workshop.workshopId || workshop.id || '';
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [materials, setMaterials] = useState<RawMaterialItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'open' | 'in_progress' | 'completed'>('all');

  // Stage 1: New Work Order Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [productName, setProductName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState(1);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [assignedEmployeeWage, setAssignedEmployeeWage] = useState<number>(150);
  const [pulledMaterials, setPulledMaterials] = useState<
    Array<{ materialId: string; materialName: string; quantity: number; unitCost: number; unit: string }>
  >([]);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Stage 2: Material Issue Modal (إذن صرف خامات للتصنيع)
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedIssueOrderId, setSelectedIssueOrderId] = useState<string>('');
  const [issuingMaterials, setIssuingMaterials] = useState(false);

  // Stage 3: Finished Goods Receipt & Close Modal (إذن استلام وتوريد منتج تام)
  const [closingOrder, setClosingOrder] = useState<WorkOrderRecord | null>(null);
  const [producedQuantity, setProducedQuantity] = useState(1);
  const [returnedMaterials, setReturnedMaterials] = useState<
    Array<{ materialId: string; materialName: string; quantity: number; unitCost: number; unit: string }>
  >([]);
  const [laborCost, setLaborCost] = useState('150');
  const [closingNotes, setClosingNotes] = useState('');
  const [savingClose, setSavingClose] = useState(false);

  // Global Notice Toast
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [localWo, matList, empList, prods] = await Promise.all([
        tenantStorage.getWorkOrders(workshopId).catch(() => []),
        tenantStorage.getRawMaterials(workshopId).catch(() => []),
        tenantStorage.getEmployees(workshopId).catch(() => []),
        tenantStorage.getProducts(workshopId).catch(() => []),
      ]);

      let finalWo = localWo;

      // مزامنة سحابية هادئة في الخلفية من جدول work_orders في Supabase
      try {
        const { data: supaWo } = await supabase
          .from('work_orders')
          .select('*')
          .eq('workshop_id', workshopId);
        if (Array.isArray(supaWo) && supaWo.length > 0) {
          const map = new Map<string, WorkOrderRecord>();
          localWo.forEach((w) => map.set(w.id, w));
          supaWo.forEach((sw: any) => {
            const mapped: WorkOrderRecord = {
              id: sw.id,
              workshopId: sw.workshop_id || workshopId,
              orderNumber: sw.order_number || 'WO-0001',
              productName: sw.product_name || 'مشغولة',
              craftId: sw.craft_id || 'macrame',
              category: sw.category || 'مشغولات يدوية',
              targetQuantity: sw.target_quantity || 1,
              assignedEmployeeId: sw.assigned_employee_id,
              assignedEmployeeName: sw.assigned_employee_name,
              assignedEmployeeWage: sw.assigned_employee_wage || 150,
              status: (sw.status as WorkOrderStatus) || 'open',
              pulledMaterials: sw.pulled_materials || [],
              returnedMaterials: sw.returned_materials || [],
              finishedProductsProduced: sw.finished_products_produced || 0,
              scrapItems: sw.scrap_items || [],
              totalConsumedMaterialsCost: sw.total_consumed_materials_cost || 0,
              totalLaborCost: sw.total_labor_cost || 0,
              totalProductionCost: sw.total_production_cost || 0,
              unitCostCalculated: sw.unit_cost_calculated || 0,
              startDate: sw.start_date || new Date().toISOString().split('T')[0],
              createdAt: sw.created_at ? new Date(sw.created_at).getTime() : Date.now(),
              updatedAt: sw.updated_at ? new Date(sw.updated_at).getTime() : Date.now(),
              createdBy: sw.created_by || workshop.email,
            };
            map.set(sw.id, mapped);
            tenantStorage.saveWorkOrder(mapped).catch(() => {});
          });
          finalWo = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
        }
      } catch (cloudErr) {
        console.warn('Silent cloud sync notice for work orders:', cloudErr);
      }

      setWorkOrders(finalWo);
      setMaterials(matList);
      setEmployees(empList);
      setArchivedProducts(prods);

      if (empList.length > 0 && !assignedEmployeeId) {
        setAssignedEmployeeId(empList[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setNotice({ text: err.message || 'فشل تحميل أوامر التشغيل', isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workshopId]);

  useEffect(() => {
    if (initialStage === 'create') {
      handleOpenCreate();
    } else if (initialStage === 'issue') {
      setIsIssueModalOpen(true);
    }
  }, [initialStage]);

  // Listen to updates from other tabs
  useEffect(() => {
    const handleRemoteUpdate = () => loadData();
    window.addEventListener('alshams_materials_updated', handleRemoteUpdate);
    window.addEventListener('alshams_workorders_updated', handleRemoteUpdate);
    return () => {
      window.removeEventListener('alshams_materials_updated', handleRemoteUpdate);
      window.removeEventListener('alshams_workorders_updated', handleRemoteUpdate);
    };
  }, []);

  // Stage 1: New Work Order
  const handleOpenCreate = () => {
    setProductName('');
    setTargetQuantity(1);
    const defaultMat = materials[0];
    if (defaultMat) {
      setPulledMaterials([
        {
          materialId: defaultMat.id,
          materialName: defaultMat.materialName,
          quantity: 1,
          unit: defaultMat.unit || 'كيلو',
          unitCost: defaultMat.costPerUnit || 100,
        },
      ]);
    } else {
      setPulledMaterials([]);
    }
    setIsCreateModalOpen(true);
  };

  const handleAddMaterialRow = () => {
    const defaultMat = materials[0];
    setPulledMaterials([
      ...pulledMaterials,
      {
        materialId: defaultMat?.id || '',
        materialName: defaultMat?.materialName || '',
        quantity: 1,
        unit: defaultMat?.unit || 'كيلو',
        unitCost: defaultMat?.costPerUnit || 100,
      },
    ]);
  };

  // استدعاء من الأرشيف
  const handleSelectArchivedProduct = (productId: string) => {
    const prod = archivedProducts.find((p) => p.id === productId);
    if (!prod) return;

    setProductName(prod.productName || 'مشغولة يدوية');
    if (prod.output?.laborCost) {
      setAssignedEmployeeWage(prod.output.laborCost);
      setLaborCost(String(prod.output.laborCost));
    }

    const autoPulled: Array<{ materialId: string; materialName: string; quantity: number; unitCost: number; unit: string }> = [];
    if (Array.isArray(prod.materialsSnapshot) && prod.materialsSnapshot.length > 0) {
      prod.materialsSnapshot.forEach((snap: any) => {
        const match = materials.find((m) => m.id === snap.id || m.materialName === snap.name);
        autoPulled.push({
          materialId: match?.id || snap.id || '',
          materialName: snap.name || match?.materialName || 'خامة',
          quantity: Number(snap.quantity) || 1,
          unitCost: Number(snap.unitCost) || match?.costPerUnit || 100,
          unit: snap.unit || match?.unit || 'وحدة',
        });
      });
    } else if (materials.length > 0) {
      const defaultMat = materials[0];
      const weight = prod.output?.totalWeightKg ? Math.round(prod.output.totalWeightKg * 100) / 100 : 1;
      autoPulled.push({
        materialId: defaultMat.id,
        materialName: defaultMat.materialName,
        quantity: weight,
        unitCost: defaultMat.costPerUnit,
        unit: defaultMat.unit || 'كيلو',
      });
    }

    if (autoPulled.length > 0) {
      setPulledMaterials(autoPulled);
    }
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || pulledMaterials.length === 0) {
      setNotice({ text: 'يرجى كتابة اسم المشغولة وتحديد خامة واحدة على الأقل', isError: true });
      return;
    }

    setCreatingOrder(true);
    try {
      let orderNumber = `WO-${Date.now().toString().slice(-4)}`;
      try {
        orderNumber = await tenantStorage.getNextWorkOrderNumber(workshopId);
      } catch {}

      const assignedEmp = employees.find((e) => e.id === assignedEmployeeId);

      const consumedMaterialsCost = pulledMaterials.reduce(
        (sum, m) => sum + (Number(m.quantity) || 0) * (Number(m.unitCost) || 0),
        0
      );

      const newOrder: WorkOrderRecord = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'wo_' + Date.now(),
        workshopId,
        orderNumber,
        productName: productName.trim(),
        craftId: 'macrame',
        category: 'مشغولات يدوية',
        targetQuantity: Number(targetQuantity) || 1,
        assignedEmployeeId: assignedEmp?.id,
        assignedEmployeeName: assignedEmp?.fullName,
        assignedEmployeeWage: Number(assignedEmployeeWage) || 150,
        status: 'open', // جاهز بانتظار صرف الخامات للتصنيع
        pulledMaterials,
        returnedMaterials: [],
        finishedProductsProduced: 0,
        scrapItems: [],
        totalConsumedMaterialsCost: consumedMaterialsCost,
        totalLaborCost: Number(assignedEmployeeWage) || 150,
        totalProductionCost: consumedMaterialsCost + (Number(assignedEmployeeWage) || 150),
        unitCostCalculated: 0,
        startDate: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: workshop.email,
      };

      await tenantStorage.saveWorkOrder(newOrder);

      // مزامنة سحابية هادئة
      try {
        await supabase.from('work_orders').upsert({
          id: newOrder.id,
          workshop_id: workshopId,
          order_number: newOrder.orderNumber,
          product_name: newOrder.productName,
          craft_id: newOrder.craftId,
          category: newOrder.category,
          target_quantity: newOrder.targetQuantity,
          assigned_employee_id: newOrder.assignedEmployeeId,
          assigned_employee_name: newOrder.assignedEmployeeName,
          assigned_employee_wage: newOrder.assignedEmployeeWage,
          status: 'open',
          pulled_materials: newOrder.pulledMaterials,
          returned_materials: [],
          finished_products_produced: 0,
          scrap_items: [],
          total_consumed_materials_cost: newOrder.totalConsumedMaterialsCost,
          total_labor_cost: newOrder.totalLaborCost,
          total_production_cost: newOrder.totalProductionCost,
          start_date: newOrder.startDate,
          created_by: workshop.email,
          created_at: new Date(newOrder.createdAt).toISOString(),
        });
      } catch (cloudErr) {
        console.warn('Cloud sync for work order notice:', cloudErr);
      }

      window.dispatchEvent(new CustomEvent('alshams_workorders_updated'));
      setNotice({ text: `تم إنشاء أمر التشغيل #${orderNumber} بنجاح! انتقل للخطوة 2 لصرف الخامات ونقلها لقيد التشغيل.` });
      setIsCreateModalOpen(false);
      await loadData();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل إنشاء أمر التشغيل', isError: true });
    } finally {
      setCreatingOrder(false);
    }
  };

  // Fast-Track: مسار التنفيذ والترحيل الفوري للمشغولات السريعة والجاهزة للتسليم
  const handleExecuteFastTrackCreate = async () => {
    if (!productName.trim() || pulledMaterials.length === 0) {
      setNotice({ text: 'يرجى كتابة اسم المشغولة وتحديد خامة واحدة على الأقل للترحيل الفوري', isError: true });
      return;
    }

    setCreatingOrder(true);
    try {
      let orderNumber = `WO-${Date.now().toString().slice(-4)}`;
      try {
        orderNumber = await tenantStorage.getNextWorkOrderNumber(workshopId);
      } catch {}

      const assignedEmp = employees.find((e) => e.id === assignedEmployeeId);
      const finishedQty = Number(targetQuantity) || 1;
      const actualLaborCost = Number(assignedEmployeeWage) || 0;

      // 1. خصم الخامات المحددة من مخزن الخامات فورياً
      for (const mat of pulledMaterials) {
        try {
          const raw = materials.find((m) => m.id === mat.materialId);
          if (raw) {
            raw.currentStock = Math.max(0, Math.round(((raw.currentStock || 0) - mat.quantity) * 1000) / 1000);
            await tenantStorage.saveRawMaterial(raw);
          }
        } catch (stockErr) {
          console.warn('Material deduction notice:', stockErr);
        }
      }

      // 2. احتساب التكاليف الإجمالية وتكلفة الوحدة
      const consumedMaterialsCost = pulledMaterials.reduce(
        (sum, m) => sum + (Number(m.quantity) || 0) * (Number(m.unitCost) || 0),
        0
      );
      const totalProductionCost = consumedMaterialsCost + actualLaborCost;
      const unitCostCalculated = Math.round((totalProductionCost / finishedQty) * 100) / 100;

      // 3. زيادة رصيد المنتج التام في مخزن المنتجات الجاهزة
      try {
        const prods = await tenantStorage.getProducts(workshopId);
        const match = prods.find((p) => p.productName.trim().toLowerCase() === productName.trim().toLowerCase());
        if (match) {
          match.currentStock = (match.currentStock || 0) + finishedQty;
          match.costPrice = unitCostCalculated;
          await tenantStorage.mutateProduct(match);
        } else {
          await tenantStorage.mutateProduct({
            id: 'prod_' + Date.now(),
            tenantId: workshopId,
            productName: productName.trim(),
            currentStock: finishedQty,
            costPrice: unitCostCalculated,
            retailPrice: Math.round(unitCostCalculated * 1.4),
            category: 'مشغولات يدوية',
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          } as any);
        }
      } catch (prodErr) {
        console.warn('Finished product stock increase error:', prodErr);
      }

      // 4. قيد استحقاق الصانع في حسابه وسجله بالموارد البشرية
      if (assignedEmp && actualLaborCost > 0) {
        try {
          const emp = await tenantStorage.getEmployee(assignedEmp.id);
          if (emp) {
            emp.totalEarned = (emp.totalEarned || 0) + actualLaborCost;
            emp.currentBalance = (emp.totalEarned || 0) - (emp.totalPaid || 0);
            await tenantStorage.saveEmployee(emp);
          }
        } catch (empErr) {
          console.warn('Employee balance credit notice:', empErr);
        }
      }

      // 5. حفظ أمر التشغيل بحالة مكتمل "completed"
      const completedOrder: WorkOrderRecord = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'wo_' + Date.now(),
        workshopId,
        orderNumber,
        productName: productName.trim(),
        craftId: 'macrame',
        category: 'مشغولات يدوية',
        targetQuantity: finishedQty,
        assignedEmployeeId: assignedEmp?.id,
        assignedEmployeeName: assignedEmp?.fullName,
        assignedEmployeeWage: actualLaborCost,
        status: 'completed',
        pulledMaterials,
        returnedMaterials: [],
        finishedProductsProduced: finishedQty,
        scrapItems: [],
        totalConsumedMaterialsCost: consumedMaterialsCost,
        totalLaborCost: actualLaborCost,
        totalProductionCost,
        unitCostCalculated,
        closingNotes: 'تم التنفيذ والترحيل الفوري بنجاح',
        startDate: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: workshop.email,
      };

      await tenantStorage.saveWorkOrder(completedOrder);

      // مزامنة سحابية هادئة
      try {
        await supabase.from('work_orders').upsert({
          id: completedOrder.id,
          workshop_id: workshopId,
          order_number: completedOrder.orderNumber,
          product_name: completedOrder.productName,
          status: 'completed',
          finished_products_produced: finishedQty,
          total_consumed_materials_cost: consumedMaterialsCost,
          total_labor_cost: actualLaborCost,
          total_production_cost: totalProductionCost,
          unit_cost_calculated: unitCostCalculated,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      window.dispatchEvent(new CustomEvent('alshams_products_updated'));
      window.dispatchEvent(new CustomEvent('alshams_materials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_financials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_workorders_updated'));
      window.dispatchEvent(new CustomEvent('alshams_employees_changed'));

      setNotice({
        text: `⚡ تم التنفيذ والترحيل الفوري بنجاح! تم خصم الخامات، وإيداع ${finishedQty} قطعة تامة بالمخزن، وقيد استحقاق الصانع (${actualLaborCost.toLocaleString()} ${workshop.currencySymbol}).`,
      });
      setIsCreateModalOpen(false);
      await loadData();
      setTimeout(() => setNotice(null), 4500);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل الترحيل الفوري', isError: true });
    } finally {
      setCreatingOrder(false);
    }
  };

  // ترحيل فوري لأمر تشغيل قائم ومفتوح
  const handleExecuteFastTrackForExisting = async (order: WorkOrderRecord) => {
    if (!window.confirm(`هل تريد تنفيذ وترحيل أمر التشغيل #${order.orderNumber} فورياً إلى مخزن المنتجات التامة وإثبات استحقاق الصانع؟`)) return;

    setLoading(true);
    try {
      const finishedQty = order.targetQuantity || 1;
      const actualLaborCost = order.assignedEmployeeWage || 0;

      // 1. خصم الخامات إذا كان الأمر لا يزال open
      if (order.status === 'open') {
        for (const mat of order.pulledMaterials) {
          try {
            const raw = materials.find((m) => m.id === mat.materialId);
            if (raw) {
              raw.currentStock = Math.max(0, Math.round(((raw.currentStock || 0) - mat.quantity) * 1000) / 1000);
              await tenantStorage.saveRawMaterial(raw);
            }
          } catch {}
        }
      }

      // 2. احتساب التكاليف
      const consumedMaterialsCost = order.pulledMaterials.reduce(
        (sum, m) => sum + (Number(m.quantity) || 0) * (Number(m.unitCost) || 0),
        0
      );
      const totalProductionCost = consumedMaterialsCost + actualLaborCost;
      const unitCostCalculated = Math.round((totalProductionCost / finishedQty) * 100) / 100;

      // 3. توريد للمنتجات الجاهزة
      try {
        const prods = await tenantStorage.getProducts(workshopId);
        const match = prods.find((p) => p.productName.trim().toLowerCase() === order.productName.trim().toLowerCase());
        if (match) {
          match.currentStock = (match.currentStock || 0) + finishedQty;
          match.costPrice = unitCostCalculated;
          await tenantStorage.mutateProduct(match);
        } else {
          await tenantStorage.mutateProduct({
            id: 'prod_' + Date.now(),
            tenantId: workshopId,
            productName: order.productName.trim(),
            currentStock: finishedQty,
            costPrice: unitCostCalculated,
            retailPrice: Math.round(unitCostCalculated * 1.4),
            category: order.category || 'مشغولات يدوية',
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          } as any);
        }
      } catch {}

      // 4. قيد استحقاق الصانع
      if (order.assignedEmployeeId && actualLaborCost > 0) {
        try {
          const emp = await tenantStorage.getEmployee(order.assignedEmployeeId);
          if (emp) {
            emp.totalEarned = (emp.totalEarned || 0) + actualLaborCost;
            emp.currentBalance = (emp.totalEarned || 0) - (emp.totalPaid || 0);
            await tenantStorage.saveEmployee(emp);
          }
        } catch {}
      }

      // 5. حفظ أمر التشغيل بحالة مكتمل
      const updated: WorkOrderRecord = {
        ...order,
        status: 'completed',
        finishedProductsProduced: finishedQty,
        totalConsumedMaterialsCost: consumedMaterialsCost,
        totalLaborCost: actualLaborCost,
        totalProductionCost,
        unitCostCalculated,
        closingNotes: 'تم الترحيل والإنجاز الفوري',
        updatedAt: Date.now(),
      };
      await tenantStorage.saveWorkOrder(updated);

      window.dispatchEvent(new CustomEvent('alshams_products_updated'));
      window.dispatchEvent(new CustomEvent('alshams_materials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_financials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_workorders_updated'));
      window.dispatchEvent(new CustomEvent('alshams_employees_changed'));

      setNotice({
        text: `⚡ تم ترحيل أمر التشغيل #${order.orderNumber} بنجاح إلى مخزن المنتجات التامة وإثبات استحقاق الصانع!`,
      });
      await loadData();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل الترحيل الفوري', isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Material Issue (إذن صرف خامات للتصنيع)
  const handleExecuteIssueMaterials = async (orderId: string) => {
    const order = workOrders.find((w) => w.id === orderId);
    if (!order) return;

    setIssuingMaterials(true);
    try {
      // 1. خصم الخامات المحددة من مخزن الخامات وتسجيل حركة المخزن
      for (const mat of order.pulledMaterials) {
        try {
          const raw = materials.find((m) => m.id === mat.materialId);
          if (raw) {
            raw.currentStock = Math.max(0, Math.round(((raw.currentStock || 0) - mat.quantity) * 1000) / 1000);
            await tenantStorage.saveRawMaterial(raw);
          }
        } catch (stockErr) {
          console.warn('Material deduction notice:', stockErr);
        }
      }

      // 2. تحديث حالة أمر التشغيل إلى in_progress (خامات قيد التشغيل)
      const updatedOrder: WorkOrderRecord = {
        ...order,
        status: 'in_progress',
        updatedAt: Date.now(),
      };
      await tenantStorage.saveWorkOrder(updatedOrder);

      // 3. تحديث سحابي في Supabase
      try {
        await supabase
          .from('work_orders')
          .update({
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);
      } catch (cloudErr) {
        console.warn('Cloud sync error on issue:', cloudErr);
      }

      window.dispatchEvent(new CustomEvent('alshams_materials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_workorders_updated'));
      setNotice({
        text: `تم إصدار إذن الصرف لأمر التشغيل #${order.orderNumber}! تم خصم الخامات من المخزن ونقلها إلى خانة "خامات قيد التشغيل (WIP)".`,
      });
      setIsIssueModalOpen(false);
      setSelectedIssueOrderId('');
      await loadData();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل صرف الخامات', isError: true });
    } finally {
      setIssuingMaterials(false);
    }
  };

  // Stage 3: Finished Goods Receipt & Close Wizard
  const handleOpenCloseWizard = (wo: WorkOrderRecord) => {
    setClosingOrder(wo);
    setProducedQuantity(wo.targetQuantity || 1);
    setReturnedMaterials(
      wo.pulledMaterials.map((m) => ({
        materialId: m.materialId,
        materialName: m.materialName,
        quantity: 0,
        unitCost: m.unitCost,
        unit: m.unit,
      }))
    );
    setLaborCost(String(wo.assignedEmployeeWage || 150));
    setClosingNotes('');
  };

  const handleExecuteClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingOrder) return;

    setSavingClose(true);
    try {
      // 1. حساب الهالك الفعلي بدقة
      const scrapItems = closingOrder.pulledMaterials.map((pulled) => {
        const returned = returnedMaterials.find((r) => r.materialId === pulled.materialId)?.quantity || 0;
        const actualConsumed = Math.max(0, pulled.quantity - returned);
        // نسبة الهالك التقديرية الحرفية
        const scrapQty = Math.round(actualConsumed * 0.08 * 1000) / 1000;
        return {
          materialId: pulled.materialId,
          materialName: pulled.materialName,
          wasteQty: scrapQty,
          wasteCost: Math.round(scrapQty * pulled.unitCost * 100) / 100,
          unit: pulled.unit,
        };
      });

      // 2. إعادة الخامات المتبقية لمخزن الخامات
      for (const ret of returnedMaterials) {
        if (ret.quantity > 0) {
          try {
            const raw = materials.find((m) => m.id === ret.materialId);
            if (raw) {
              raw.currentStock = Math.round(((raw.currentStock || 0) + ret.quantity) * 1000) / 1000;
              await tenantStorage.saveRawMaterial(raw);
            }
          } catch (retErr) {
            console.warn('Returning material notice:', retErr);
          }
        }
      }

      // 3. احتساب التكاليف النهائية
      const totalConsumedCost = closingOrder.pulledMaterials.reduce((sum, p) => {
        const returned = returnedMaterials.find((r) => r.materialId === p.materialId)?.quantity || 0;
        const netConsumed = Math.max(0, p.quantity - returned);
        return sum + netConsumed * p.unitCost;
      }, 0);

      const actualLaborCost = Number(laborCost) || 0;
      const totalProdCost = totalConsumedCost + actualLaborCost;
      const finishedQty = Number(producedQuantity) || 1;
      const calculatedUnitCost = Math.round((totalProdCost / finishedQty) * 100) / 100;

      const completedOrder: WorkOrderRecord = {
        ...closingOrder,
        status: 'completed',
        returnedMaterials,
        finishedProductsProduced: finishedQty,
        scrapItems,
        totalConsumedMaterialsCost: totalConsumedCost,
        totalLaborCost: actualLaborCost,
        totalProductionCost: totalProdCost,
        unitCostCalculated: calculatedUnitCost,
        closingNotes: closingNotes.trim(),
        updatedAt: Date.now(),
      };

      // 4. حفظ أمر التشغيل في Dexie
      await tenantStorage.saveWorkOrder(completedOrder);

      // 5. زيادة رصيد المنتج التام في مخزن المنتجات الجاهزة (products inventory)
      try {
        const prods = await tenantStorage.getProducts(workshopId);
        const match = prods.find((p) => p.productName.trim().toLowerCase() === completedOrder.productName.trim().toLowerCase());
        if (match) {
          match.currentStock = (match.currentStock || 0) + finishedQty;
          match.costPrice = calculatedUnitCost;
          await tenantStorage.mutateProduct(match);
        } else {
          // إنشاء صنف جديد في مخزن المنتجات التامة
          await tenantStorage.mutateProduct({
            id: 'prod_' + Date.now(),
            tenantId: workshopId,
            productName: completedOrder.productName,
            currentStock: finishedQty,
            costPrice: calculatedUnitCost,
            retailPrice: Math.round(calculatedUnitCost * 1.4),
            category: completedOrder.category || 'مشغولات يدوية',
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            input: {} as any,
            output: {} as any,
          } as any);
        }
      } catch (prodErr) {
        console.warn('Finished product stock increase error:', prodErr);
      }

      // 6. تحويل مستحقات الصانع آلياً إلى حسابه وسجله في الموارد البشرية
      if (completedOrder.assignedEmployeeId && actualLaborCost > 0) {
        try {
          const emp = await tenantStorage.getEmployee(completedOrder.assignedEmployeeId);
          if (emp) {
            emp.totalEarned = (emp.totalEarned || 0) + actualLaborCost;
            emp.currentBalance = (emp.totalEarned || 0) - (emp.totalPaid || 0);
            await tenantStorage.saveEmployee(emp);
          }
        } catch (creditErr) {
          console.warn('Could not credit artisan piece-rate wage:', creditErr);
        }
      }

      // 7. مزامنة سحابية هادئة في Supabase
      try {
        await supabase.from('work_orders').upsert({
          id: completedOrder.id,
          workshop_id: workshopId,
          order_number: completedOrder.orderNumber,
          status: 'completed',
          finished_products_produced: finishedQty,
          scrap_items: scrapItems,
          total_consumed_materials_cost: totalConsumedCost,
          total_labor_cost: actualLaborCost,
          total_production_cost: totalProdCost,
          unit_cost_calculated: calculatedUnitCost,
          updated_at: new Date().toISOString(),
        });
      } catch (cloudErr) {
        console.warn('Cloud sync error for closing work order:', cloudErr);
      }

      window.dispatchEvent(new CustomEvent('alshams_products_updated'));
      window.dispatchEvent(new CustomEvent('alshams_materials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_financials_updated'));
      window.dispatchEvent(new CustomEvent('alshams_workorders_updated'));

      setNotice({
        text: `تم استلام ${finishedQty} قطعة تامة من المشغولة "${completedOrder.productName}" وتوريدها للمخزن بنجاح! تم قيد أجر المصنعية (${actualLaborCost.toLocaleString()} ${workshop.currencySymbol}) لحساب الصانع.`,
      });
      setClosingOrder(null);
      await loadData();
      setTimeout(() => setNotice(null), 4500);
    } catch (err: any) {
      setNotice({ text: err.message || 'فشل إغلاق أمر التشغيل', isError: true });
    } finally {
      setSavingClose(false);
    }
  };

  // Orders Filtered by Tab & Search
  const openOrders = workOrders.filter((wo) => wo.status === 'open');
  const inProgressOrders = workOrders.filter((wo) => wo.status === 'in_progress');
  const completedOrders = workOrders.filter((wo) => wo.status === 'completed');

  const filteredOrders = workOrders
    .filter((wo) => {
      if (activeTabFilter === 'open') return wo.status === 'open';
      if (activeTabFilter === 'in_progress') return wo.status === 'in_progress';
      if (activeTabFilter === 'completed') return wo.status === 'completed';
      return true;
    })
    .filter((wo) => {
      const q = searchQuery.trim().toLowerCase();
      return (
        !q ||
        wo.orderNumber.toLowerCase().includes(q) ||
        wo.productName.toLowerCase().includes(q) ||
        wo.assignedEmployeeName?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6 text-right">
      {/* 1. المسار الصناعي الثلاثي الموحد (The 3 Industrial Stages Bar) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
              <Hammer className="w-4 h-4 text-amber-600" />
              <span>دورة الإنتاج والتصنيع الحرفي المتكاملة</span>
              <button
                type="button"
                onClick={() => onOpenHelp('work_orders')}
                className="text-stone-400 hover:text-amber-600 cursor-pointer"
                title="ما معنى هذا؟"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
              أوامر التشغيل ومسار التصنيع الصناعي
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              مسار تشغيلي منضبط: فتح أمر التشغيل ⬅️ صرف الخامات ونقلها لقيد التشغيل ⬅️ استلام المشغولة التامة وقيد أجر الصانع.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-500">
            <span className="px-3 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
              إجمالي الأوامر: {workOrders.length}
            </span>
          </div>
        </div>

        {/* The 4 Ordered Industrial Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Step 1 Button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-800/80 hover:border-amber-500 hover:bg-amber-500/15 transition-all text-right group cursor-pointer shadow-xs active:scale-98"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-7 h-7 rounded-xl bg-amber-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-xs">
                1
              </span>
              <Hammer className="w-5 h-5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
              أمر تشغيل وتصنيع جديد
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              استدعاء المشغولة من الأرشيف وتحديد الخامات والصانع المسؤول.
            </p>
          </button>

          {/* Step 2 Button */}
          <button
            type="button"
            onClick={() => {
              if (openOrders.length === 0) {
                setNotice({ text: 'لا توجد أوامر تشغيل مفتوحة بانتظار صرف الخامات حالياً. افتح أمر تشغيل أولاً.', isError: true });
                setTimeout(() => setNotice(null), 3500);
                return;
              }
              setSelectedIssueOrderId(openOrders[0].id);
              setIsIssueModalOpen(true);
            }}
            className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-300 dark:border-cyan-800/80 hover:border-cyan-500 hover:bg-cyan-500/15 transition-all text-right group cursor-pointer shadow-xs active:scale-98"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-7 h-7 rounded-xl bg-cyan-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-xs">
                2
              </span>
              <Boxes className="w-5 h-5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors">
                إذن صرف خامات للتصنيع
              </h3>
              {openOrders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300">
                  {openOrders.length} بانتظار الصرف
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              خصم الخامات من المخزن ونقلها إلى خانة "خامات قيد التشغيل (WIP)".
            </p>
          </button>

          {/* Step 3 Button */}
          <button
            type="button"
            onClick={() => {
              const readyToClose = inProgressOrders.length > 0 ? inProgressOrders[0] : openOrders[0];
              if (!readyToClose) {
                setNotice({ text: 'لا توجد أوامر قيد التشغيل حالياً لاستلامها. اصرف خامات أمر تشغيل أولاً.', isError: true });
                setTimeout(() => setNotice(null), 3500);
                return;
              }
              handleOpenCloseWizard(readyToClose);
            }}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-300 dark:border-emerald-800/80 hover:border-emerald-500 hover:bg-emerald-500/15 transition-all text-right group cursor-pointer shadow-xs active:scale-98"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-xs">
                3
              </span>
              <PackageCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                إذن استلام وتوريد منتج تام
              </h3>
              {inProgressOrders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {inProgressOrders.length} قيد التشغيل
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              إثبات المنتج بالمخزن، احتساب الهالك، وقيد مستحقات الصانع آلياً بالـ HR.
            </p>
          </button>

          {/* Fast-Track Option */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border-2 border-dashed border-amber-400 dark:border-amber-600/60 hover:border-amber-500 hover:bg-amber-500/20 transition-all text-right group cursor-pointer shadow-xs active:scale-98"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-stone-950 font-mono font-black text-xs flex items-center justify-center shadow-xs">
                ⚡
              </span>
              <Sparkles className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-200 group-hover:text-amber-700 transition-colors">
                تنفيذ وترحيل فوري
              </h3>
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-400 text-amber-950">
                سريع
              </span>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-1">
              خصم الخامات + توريد للمخزن + قيد أجر الصانع بضغطة زر واحدة للمشغولات الجاهزة.
            </p>
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {notice.isError ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 2. Filter Tabs & Search */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTabFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTabFilter === 'all'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              الكل ({workOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter('open')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'open'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>بانتظار صرف الخامات ({openOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter('in_progress')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'in_progress'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 hover:bg-cyan-100'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>خامات قيد التشغيل ({inProgressOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter('completed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTabFilter === 'completed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم التوريد للمخزن ({completedOrders.length})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-64 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الأمر أو الصانع أو المشغولة..."
              className="w-full px-3.5 py-1.5 pr-8 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
            />
            <Search className="w-4 h-4 text-stone-400 absolute right-2.5 top-2 pointer-events-none" />
          </div>
        </div>

        {/* Work Orders List */}
        {loading ? (
          <div className="py-12 text-center text-stone-400 text-xs">جاري فحص وتحديث أوامر التشغيل...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-xs font-bold">
            لا توجد أوامر تشغيل مطابقة في هذا التصنيف.
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredOrders.map((wo) => {
              const isOpen = wo.status === 'open';
              const isInProgress = wo.status === 'in_progress';
              const isCompleted = wo.status === 'completed';

              return (
                <div
                  key={wo.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition space-y-3 ${
                    isOpen
                      ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-300/80 dark:border-amber-800/60 shadow-xs'
                      : isInProgress
                      ? 'bg-cyan-50/40 dark:bg-cyan-950/15 border-cyan-300/80 dark:border-cyan-800/60 shadow-xs'
                      : 'bg-stone-50/70 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="font-mono font-black text-sm text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900">
                        #{wo.orderNumber}
                      </span>
                      <h3 className="font-black text-sm sm:text-base text-stone-900 dark:text-stone-100">
                        {wo.productName}
                      </h3>

                      {/* Status Badges */}
                      {isOpen && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>بانتظار إذن الصرف</span>
                        </span>
                      )}
                      {isInProgress && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 flex items-center gap-1 animate-pulse">
                          <Boxes className="w-3 h-3" />
                          <span>خامات قيد التشغيل (جاري التصنيع)</span>
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تم الإنتاج والتوريد للمخزن</span>
                        </span>
                      )}
                    </div>

                    {/* Operational Action Buttons per Order */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isOpen && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIssueOrderId(wo.id);
                              setIsIssueModalOpen(true);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            <span>إذن صرف الخامات</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExecuteFastTrackForExisting(wo)}
                            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/40 text-xs font-black flex items-center gap-1 cursor-pointer transition active:scale-95"
                            title="خصم الخامات وإيداع المشغولة التامة بالمخزن وقيد أجر الصانع فورياً"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>ترحيل فوري ⚡</span>
                          </button>
                        </>
                      )}

                      {isInProgress && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenCloseWizard(wo)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>إذن استلام وتوريد</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExecuteFastTrackForExisting(wo)}
                            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/40 text-xs font-black flex items-center gap-1 cursor-pointer transition active:scale-95"
                            title="إيداع المشغولة التامة بالمخزن وقيد أجر الصانع فورياً"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>ترحيل فوري ⚡</span>
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <div className="text-left font-mono">
                          <span className="text-[11px] text-stone-500 block">تكلفة الوحدة:</span>
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                            {wo.unitCostCalculated.toLocaleString()} {workshop.currencySymbol}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Materials & Artisan Execution Details */}
                  <div className="pt-2.5 border-t border-stone-200/70 dark:border-stone-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <span className="text-stone-500 font-bold block mb-1">
                        الخامات المحددة لأمر التشغيل:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {wo.pulledMaterials.map((m, idx) => (
                          <span
                            key={idx}
                            className="bg-white dark:bg-stone-900 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 font-mono text-[11px] text-stone-800 dark:text-stone-200"
                          >
                            {m.materialName}: {m.quantity} {m.unit}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] text-stone-600 dark:text-stone-400">
                        الصانع المسؤول:{' '}
                        <strong className="text-stone-900 dark:text-stone-100">
                          {wo.assignedEmployeeName || 'حرفي الورشة'}
                        </strong>
                      </p>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400">
                        الكمية المستهدفة:{' '}
                        <strong className="text-stone-900 dark:text-stone-100">{wo.targetQuantity} قطعة</strong>
                        {wo.finishedProductsProduced > 0 && (
                          <span className="text-emerald-600 mr-2">
                            (تم إنتاج {wo.finishedProductsProduced} قطعة)
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400">
                        أجر المصنعية المقدر:{' '}
                        <strong className="text-stone-900 dark:text-stone-100 font-mono">
                          {wo.assignedEmployeeWage} {workshop.currencySymbol}
                        </strong>
                      </p>
                      {wo.scrapItems && wo.scrapItems.length > 0 && (
                        <p className="text-[10px] text-rose-600 font-bold">
                          الهالك: {wo.scrapItems.map((s) => `${s.materialName} (${s.wasteQty} ${s.unit})`).join('، ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Create Work Order (أمر تشغيل وتصنيع جديد) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleCreateWorkOrder}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-amber-300 dark:border-stone-700 w-full max-w-2xl max-h-[92vh] overflow-y-auto space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Hammer className="w-4 h-4 text-amber-600" />
                <span>الخطوة 1: أمر تشغيل وتصنيع جديد</span>
              </h3>
            </div>

            {/* 1. استدعاء المشغولة من الأرشيف */}
            {archivedProducts.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>استدعاء مشغولة من الأرشيف (تعبئة تلقائية للخامات والمصنعية):</span>
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleSelectArchivedProduct(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 text-xs font-bold text-stone-800 dark:text-stone-200 outline-none"
                >
                  <option value="">-- اختر مشغولة من الأرشيف للتعبئة التلقائية --</option>
                  {archivedProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName} ({p.category || 'مشغولات'}) - مصنعية: {p.output?.laborCost || 150} {workshop.currencySymbol}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  اسم المنتج المراد تصنيعه *
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="مثال: رانر قطن بوهيمي 40*160 سم"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  الكمية المستهدفة (عدد القطع) *
                </label>
                <NumberInput
                  min={1}
                  required
                  value={targetQuantity}
                  onChange={setTargetQuantity}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono font-bold text-xs text-center"
                />
              </div>
            </div>

            {/* الصانع المسؤول وأجر المصنعية */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  الصانع أو الحرفي المسؤول
                </label>
                <select
                  value={assignedEmployeeId}
                  onChange={(e) => setAssignedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                >
                  <option value="">-- اختر الصانع من فريق الورشة --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.role || 'حرفي'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                  أجر اليد والمصنعية المقدرة للقطعة ({workshop.currencySymbol})
                </label>
                <NumberInput
                  min={0}
                  value={assignedEmployeeWage}
                  onChange={(v) => setAssignedEmployeeWage(Number(v) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono font-bold text-xs text-center"
                />
              </div>
            </div>

            {/* الخامات المطلوبة للتصنيع */}
            <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  الخامات ومستلزمات الإنتاج المطلوبة:
                </span>
                <button
                  type="button"
                  onClick={handleAddMaterialRow}
                  className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة خامة</span>
                </button>
              </div>

              {pulledMaterials.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 grid grid-cols-12 gap-2 items-center text-xs"
                >
                  <div className="col-span-7">
                    <select
                      value={item.materialId}
                      onChange={(e) => {
                        const m = materials.find((mat) => mat.id === e.target.value);
                        if (m) {
                          const updated = [...pulledMaterials];
                          updated[idx] = {
                            materialId: m.id,
                            materialName: m.materialName,
                            quantity: updated[idx].quantity,
                            unit: m.unit,
                            unitCost: m.costPerUnit,
                          };
                          setPulledMaterials(updated);
                        }
                      }}
                      className="w-full px-2 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.materialName} (متاح بالمخزن: {m.currentStock} {m.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <NumberInput
                      min={0.1}
                      step={0.1}
                      required
                      value={item.quantity}
                      onChange={(val) => {
                        const updated = [...pulledMaterials];
                        updated[idx].quantity = val;
                        setPulledMaterials(updated);
                      }}
                      placeholder="الكمية المطلوبة"
                      className="w-full px-2 py-1.5 text-center rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => setPulledMaterials(pulledMaterials.filter((_, i) => i !== idx))}
                      disabled={pulledMaterials.length === 1}
                      className="p-1 text-rose-500 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-700 cursor-pointer"
              >
                إلغاء
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={creatingOrder}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-black cursor-pointer disabled:opacity-50 transition"
                  title="حفظ أمر التشغيل في المرحلة 1 بانتظار إذن الصرف لاحقاً"
                >
                  {creatingOrder ? 'جاري الحفظ...' : 'حفظ (المسار المتتابع)'}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteFastTrackCreate}
                  disabled={creatingOrder}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 transition active:scale-95"
                  title="خصم الخامات فورياً وإيداع المنتج التام بالمخزن وقيد أجر الصانع بالـ HR"
                >
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>{creatingOrder ? 'جاري الترحيل الفوري...' : '⚡ تنفيذ وترحيل فوري'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Issue Materials Modal (إذن صرف خامات للتصنيع) */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-cyan-300 dark:border-stone-700 w-full max-w-xl max-h-[92vh] overflow-y-auto space-y-4 text-right shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-cyan-900 dark:text-cyan-300 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-cyan-600" />
                <span>الخطوة 2: إذن صرف خامات للتصنيع (WIP)</span>
              </h3>
            </div>

            {/* Select open order */}
            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                اختر أمر التشغيل المراد صرف خاماته *
              </label>
              <select
                value={selectedIssueOrderId}
                onChange={(e) => setSelectedIssueOrderId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
              >
                <option value="">-- اختر أمر تشغيل مفتوح --</option>
                {openOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    #{wo.orderNumber} - {wo.productName} ({wo.targetQuantity} قطعة) - الصانع: {wo.assignedEmployeeName || 'حرفي'}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview order materials */}
            {(() => {
              const orderToIssue = workOrders.find((w) => w.id === selectedIssueOrderId);
              if (!orderToIssue) return null;

              return (
                <div className="space-y-3 p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/60">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-900 dark:text-cyan-200 border-b border-cyan-200 dark:border-cyan-800 pb-2">
                    <span>بيان الخامات التي ستُخصم فورياً من المخزن:</span>
                    <span>الصانع المستلم: {orderToIssue.assignedEmployeeName || 'صانع الورشة'}</span>
                  </div>

                  <div className="space-y-1.5">
                    {orderToIssue.pulledMaterials.map((m, idx) => {
                      const stockAvailable = materials.find((mat) => mat.id === m.materialId)?.currentStock || 0;
                      const hasEnough = stockAvailable >= m.quantity;

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-stone-900 border text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-900 dark:text-stone-100">{m.materialName}</span>
                            <span className="text-[10px] text-stone-400 block font-mono">
                              الرصيد المتاح بالمخزن: {stockAvailable} {m.unit}
                            </span>
                          </div>

                          <div className="text-left font-mono">
                            <span className="font-black text-cyan-700 dark:text-cyan-400">
                              {m.quantity} {m.unit}
                            </span>
                            {!hasEnough && (
                              <span className="text-[10px] text-rose-500 font-bold block">
                                (تنبيه: الرصيد أقل من المطلوب)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300">
                    💡 بالضغط على زر الاعتماد، سيتم خصم هذه الكميات فورياً من أرصدة مخزن الخامات، وتنتقل حالة أمر التشغيل إلى <strong>"خامات قيد التشغيل في يد الصانع"</strong>.
                  </div>
                </div>
              );
            })()}

            <div className="pt-3 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!selectedIssueOrderId || issuingMaterials}
                onClick={() => handleExecuteIssueMaterials(selectedIssueOrderId)}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {issuingMaterials ? 'جاري الصرف والخصم...' : 'تأكيد صرف الخامات ونقلها لقيد التشغيل (WIP)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Close Wizard & Finished Goods Receipt (إذن استلام وتوريد منتج تام) */}
      {closingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteClose}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-emerald-300 dark:border-stone-700 w-full max-w-xl max-h-[92vh] overflow-y-auto space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setClosingOrder(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
                <span>الخطوة 3: إذن استلام وتوريد منتج تام #{closingOrder.orderNumber}</span>
              </h3>
            </div>

            {/* (أ) الكمية التامة المنتجة */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                (أ) الكمية التامة المصنعة (تُضاف فورياً لمخزن المنتجات الجاهزة):
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex-1">
                  {closingOrder.productName}
                </span>
                <div className="w-32">
                  <NumberInput
                    min={1}
                    required
                    value={producedQuantity}
                    onChange={setProducedQuantity}
                    className="w-full px-3 py-1.5 text-center rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-900 font-mono font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* (ب) الخامات المتبقية/المرتجعة للمخزن */}
            <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-2 text-xs">
              <span className="font-bold text-blue-900 dark:text-blue-200 block">
                (ب) خامات متبقية وسليمة مرتجعة للمخزن (إن وُجدت):
              </span>
              {returnedMaterials.map((ret, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <span className="text-stone-700 dark:text-stone-300">
                    {ret.materialName} ({ret.unit}):
                  </span>
                  <NumberInput
                    min={0}
                    step={0.1}
                    value={ret.quantity}
                    onChange={(val) => {
                      const updated = [...returnedMaterials];
                      updated[idx].quantity = val;
                      setReturnedMaterials(updated);
                    }}
                    className="w-28 px-2 py-1 text-center rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-stone-900 font-mono font-bold"
                  />
                </div>
              ))}
            </div>

            {/* (ج) أجر يد الصانع والمصنعية المستحقة (تُقيد بالـ HR) */}
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-200 block flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                <span>(ج) أجر يد الصانع ومستحقات القطعة (يُقيد آلياً في كشف حساب الحرفي بالـ HR):</span>
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">
                    الصانع المستحق:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={closingOrder.assignedEmployeeName || 'حرفي الورشة'}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">
                    المبلغ المستحق ({workshop.currencySymbol}):
                  </label>
                  <NumberInput
                    min={0}
                    value={laborCost}
                    onChange={(val) => setLaborCost(String(val))}
                    className="w-full px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 font-mono font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-700 dark:text-stone-300">
                ملاحظات الفنش والتسليم
              </label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="مثال: تم الفنش والتغليف بدرجة ممتازة..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setClosingOrder(null)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingClose}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {savingClose ? 'جاري التوريد والقيد...' : 'اعتماد التوريد وقيد مستحقات الصانع'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
