import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Check, AlertTriangle, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import type { SupabaseMaterial } from '../../db/supabaseService';
import type { ProductLegacyIssue } from '../../utils/materialsDeduplication';
import { tenantStorage } from '../../db/dexieDB';
import { markProductDirty } from '../../db/productSyncQueue';
import { flushProductSync } from '../../db/productsCloud';

interface ProductLegacyMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workshopId: string;
  issues: ProductLegacyIssue[];
  materials: SupabaseMaterial[];
  localUnifiedMap: Record<string, { masterCode: string; specCode?: string }>;
  onMigrated: () => void | Promise<void>;
}

export const ProductLegacyMigrationModal: React.FC<ProductLegacyMigrationModalProps> = ({
  isOpen,
  onClose,
  workshopId,
  issues,
  materials,
  localUnifiedMap,
  onMigrated,
}) => {
  // Map productId -> { cordMatId, extraMap: Record<index, matId> }
  const [selections, setSelections] = useState<
    Record<string, { cordMatId: string; extraMap: Record<number, string> }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const primaryMaterials = materials.filter((m) => m.kind !== 'extra');
  const allMaterials = materials;

  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, { cordMatId: string; extraMap: Record<number, string> }> = {};
    for (const iss of issues) {
      const extraMap: Record<number, string> = {};
      for (const ex of iss.legacyExtras) {
        if (ex.suggestedMaterial) extraMap[ex.index] = ex.suggestedMaterial.id;
      }
      init[iss.product.id] = {
        cordMatId: iss.suggestedCordMaterial?.id || primaryMaterials[0]?.id || '',
        extraMap,
      };
    }
    setSelections(init);
    setDoneIds(new Set());
    setMsg(null);
  }, [isOpen, issues]);

  const applyMigrationForIssue = async (issue: ProductLegacyIssue) => {
    const sel = selections[issue.product.id];
    if (!sel) return false;

    const updatedInput: any = { ...issue.product.input };
    let changed = false;

    if (issue.legacyCordName && sel.cordMatId) {
      const targetMat = allMaterials.find((m) => m.id === sel.cordMatId);
      if (targetMat) {
        updatedInput.cordTypeId = targetMat.id;
        updatedInput.cordTypeName = targetMat.name;
        if (Number(targetMat.purchase_price) > 0) {
          updatedInput.pricePerKg = Number(targetMat.purchase_price);
        }
        changed = true;
      }
    }

    if (issue.legacyExtras.length > 0 && Array.isArray(updatedInput.extraMaterials)) {
      updatedInput.extraMaterials = updatedInput.extraMaterials.map((ex: any, idx: number) => {
        const mappedId = sel.extraMap[idx];
        if (!mappedId) return ex;
        const targetMat = allMaterials.find((m) => m.id === mappedId);
        if (!targetMat) return ex;
        changed = true;
        return {
          ...ex,
          materialId: targetMat.id,
          name: targetMat.name,
          unitPrice: Number(targetMat.purchase_price) > 0 ? Number(targetMat.purchase_price) : ex.unitPrice,
        };
      });
    }

    if (!changed) return false;

    const updatedRecord = {
      ...issue.product,
      input: updatedInput,
      updatedAt: Date.now(),
    };

    await tenantStorage.mutateProduct(updatedRecord as any);
    try {
      markProductDirty(workshopId, updatedRecord.id);
      await flushProductSync(workshopId);
    } catch {}
    return true;
  };

  const handleSaveSingle = async (issue: ProductLegacyIssue) => {
    setSavingId(issue.product.id);
    setMsg(null);
    try {
      const ok = await applyMigrationForIssue(issue);
      if (ok) {
        setDoneIds((prev) => new Set(prev).add(issue.product.id));
        setMsg({ text: `✓ تم تبديل خامات «${issue.product.input?.productName || 'المنتج'}» للمنظومة الجديدة وحفظه بنجاح` });
        await onMigrated();
      }
    } catch (err: any) {
      setMsg({ text: err?.message || 'تعذر حفظ تحديث المنتج', isError: true });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    setMsg(null);
    let updatedCount = 0;
    try {
      for (const issue of issues) {
        if (doneIds.has(issue.product.id)) continue;
        const ok = await applyMigrationForIssue(issue);
        if (ok) {
          updatedCount += 1;
          setDoneIds((prev) => new Set(prev).add(issue.product.id));
        }
      }
      await onMigrated();
      setMsg({
        text: `✓ تم تبديل خامات (${updatedCount}) منتج بنجاح وربطها بالمنظومة الموحدة وحفظها في الأرشيف والسحابة!`,
      });
    } catch (err: any) {
      setMsg({ text: err?.message || 'حدث خطأ أثناء تحديث المنتجات', isError: true });
    } finally {
      setSavingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      dir="rtl"
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#F7F3EA] dark:bg-[#0D162E] rounded-3xl border border-[#D4CCBC] dark:border-[#22355E] shadow-2xl flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between gap-3 bg-gradient-to-l from-amber-600 to-amber-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black">
                تحديث خامات المنتجات القديمة وربطها بالمنظومة الموحدة
              </h2>
              <p className="text-[11px] text-amber-100 font-bold">
                اختر الخامة البديلة من «خاماتي» لكل منتج ثم اضغط حفظ لتحديث الأرشيف وحاسبة التكاليف فوراً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 text-xs">
          {msg && (
            <div
              className={`p-3 rounded-2xl font-black border flex items-center gap-2 ${
                msg.isError
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              {msg.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {issues.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="font-black text-sm text-[#0C1427] dark:text-white">
                رائع! جميع منتجاتك مرتبطة بالكامل بخامات المنظومة الموحدة الجديدة.
              </p>
            </div>
          ) : (
            issues.map((issue) => {
              const isDone = doneIds.has(issue.product.id);
              const sel = selections[issue.product.id] || { cordMatId: '', extraMap: {} };
              return (
                <div
                  key={issue.product.id}
                  className={`p-4 rounded-2xl border space-y-3 transition ${
                    isDone
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/50'
                      : 'bg-white dark:bg-[#132040] border-[#D4CCBC] dark:border-[#22355E]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-black text-sm text-[#0C1427] dark:text-[#F7F3EA]">
                        {issue.product.input?.productName || 'منتج بدون اسم'}
                      </h3>
                      <span className="text-[10px] font-bold text-[#64748B]">
                        {issue.product.input?.category || 'منتج محفوظ'}
                      </span>
                    </div>
                    {isDone ? (
                      <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-black inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>تم التبديل والحفظ ✓</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={savingId === issue.product.id}
                        onClick={() => handleSaveSingle(issue)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{savingId === issue.product.id ? 'جاري الحفظ...' : 'تبديل وحفظ المنتج'}</span>
                      </button>
                    )}
                  </div>

                  {issue.legacyCordName && (
                    <div className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC]/70 dark:border-[#22355E] flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold">
                          القديمة: {issue.legacyCordName}
                        </span>
                        <ArrowLeft className="w-3.5 h-3.5 text-[#EA580C]" />
                      </div>
                      <select
                        value={sel.cordMatId}
                        disabled={isDone}
                        onChange={(e) =>
                          setSelections((prev) => ({
                            ...prev,
                            [issue.product.id]: { ...sel, cordMatId: e.target.value },
                          }))
                        }
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                      >
                        <option value="">— اختر الخامة الموحدة البديلة —</option>
                        {allMaterials.map((m) => {
                          const code = localUnifiedMap[m.id]?.masterCode;
                          return (
                            <option key={m.id} value={m.id}>
                              {m.name} {code ? `(${code})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {issue.legacyExtras.map((ex) => (
                    <div
                      key={ex.index}
                      className="p-3 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC]/70 dark:border-[#22355E] flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-200 font-bold">
                          خامة إضافية قديمة: {ex.oldName}
                        </span>
                        <ArrowLeft className="w-3.5 h-3.5 text-[#EA580C]" />
                      </div>
                      <select
                        value={sel.extraMap[ex.index] || ''}
                        disabled={isDone}
                        onChange={(e) =>
                          setSelections((prev) => ({
                            ...prev,
                            [issue.product.id]: {
                              ...sel,
                              extraMap: { ...sel.extraMap, [ex.index]: e.target.value },
                            },
                          }))
                        }
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                      >
                        <option value="">— اختر الخامة الموحدة البديلة —</option>
                        {allMaterials.map((m) => {
                          const code = localUnifiedMap[m.id]?.masterCode;
                          return (
                            <option key={m.id} value={m.id}>
                              {m.name} {code ? `(${code})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#D4CCBC] dark:border-[#22355E] bg-[#EFE9DC] dark:bg-[#0A1124] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[#475569] dark:text-[#94A3B8]">
            يتم تحديث الأرشيف والمزامنة السحابية فوراً عند الحفظ
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
            {issues.length > 0 && (
              <button
                type="button"
                disabled={savingAll || doneIds.size === issues.length}
                onClick={handleSaveAll}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{savingAll ? 'جاري تحديث الكل...' : `تبديل وحفظ جميع المنتجات (${issues.length})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
