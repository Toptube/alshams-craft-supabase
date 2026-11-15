import React from 'react';
import {
  X,
  Edit3,
  Key,
  Eye,
  EyeOff,
  Check,
  Copy,
  Snowflake,
  Ban,
  Trash2,
  PlusCircle,
  Award,
  Activity,
  XCircle,
} from 'lucide-react';
import { WorkshopProfile } from '../../types';
import { COUNTRIES_CONFIG } from '../../utils/macrameMath';
import { CloudMarketplaceProduct } from '../../db/marketplaceCloud';
import { getMedalArabic } from './adminTypes';

interface AdminWorkshopModalsProps {
  // Edit + Credentials
  editingWorkshop: WorkshopProfile | null;
  setEditingWorkshop: React.Dispatch<React.SetStateAction<WorkshopProfile | null>>;
  isSuspendingModalOpen: boolean;
  setIsSuspendingModalOpen: (v: boolean) => void;
  isBanningModalOpen: boolean;
  setIsBanningModalOpen: (v: boolean) => void;
  onSaveEditedWorkshop: (e: React.FormEvent) => Promise<void>;
  editNewPassword: string;
  setEditNewPassword: (v: string) => void;
  showPasswordPlain: boolean;
  setShowPasswordPlain: React.Dispatch<React.SetStateAction<boolean>>;
  onGenerateRandomPassword: () => void;
  onCredentialOverride: (ws: WorkshopProfile) => Promise<void>;
  overridingCredentials: boolean;
  savingAction: boolean;

  // Credential Success Popup
  credentialSuccessModal: {
    brandName: string;
    artistName: string;
    email: string;
    password: string;
    phone: string;
  } | null;
  setCredentialSuccessModal: (v: null) => void;
  copiedNotice: boolean;
  setCopiedNotice: (v: boolean) => void;

  // Suspend & Ban
  suspensionDurationChoice: string;
  setSuspensionDurationChoice: (v: string) => void;
  suspensionReasonInput: string;
  setSuspensionReasonInput: (v: string) => void;
  onExecuteSuspension: () => Promise<void>;
  banReasonInput: string;
  setBanReasonInput: (v: string) => void;
  onExecuteBan: () => Promise<void>;

  // Reject Appeal
  rejectingAppealWorkshop: any | null;
  setRejectingAppealWorkshop: (v: any | null) => void;
  rejectionReasonInput: string;
  setRejectionReasonInput: (v: string) => void;
  onConfirmRejectAppeal: () => Promise<void>;

  // Reject Product
  cloudRejectingProduct: CloudMarketplaceProduct | null;
  setCloudRejectingProduct: (v: CloudMarketplaceProduct | null) => void;
  cloudRejectReason: string;
  setCloudRejectReason: (v: string) => void;
  onConfirmRejectProduct: () => Promise<void>;

  // Selective Delete
  deletingWorkshop: WorkshopProfile | null;
  setDeletingWorkshop: (v: WorkshopProfile | null) => void;
  selectiveDeleteMode: 'cascade' | 'catalog_inventory' | 'finance_orders';
  setSelectiveDeleteMode: (v: 'cascade' | 'catalog_inventory' | 'finance_orders') => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  onConfirmSelectiveDelete: () => Promise<void>;

  // Edit Material Price
  editingMaterial: any | null;
  setEditingMaterial: (v: any | null) => void;
  newMaterialPrice: string;
  setNewMaterialPrice: (v: string) => void;
  onSaveMaterialPrice: () => Promise<void>;

  // New Workshop
  isNewWorkshopModalOpen: boolean;
  setIsNewWorkshopModalOpen: (v: boolean) => void;
  newBrandName: string;
  setNewBrandName: (v: string) => void;
  newArtistName: string;
  setNewArtistName: (v: string) => void;
  newEmail: string;
  setNewEmail: (v: string) => void;
  newPhone: string;
  setNewPhone: (v: string) => void;
  newCountry: string;
  setNewCountry: (v: string) => void;
  newRole: 'artisan' | 'manager' | 'admin';
  setNewRole: (v: 'artisan' | 'manager' | 'admin') => void;
  onCreateNewWorkshop: (e: React.FormEvent) => Promise<void>;

  // Gamification Award
  awardingWorkshop: WorkshopProfile | null;
  setAwardingWorkshop: (v: WorkshopProfile | null) => void;
  selectedStars: number;
  setSelectedStars: (v: number) => void;
  selectedMedal: 'bronze' | 'silver' | 'gold' | 'diamond';
  setSelectedMedal: (v: 'bronze' | 'silver' | 'gold' | 'diamond') => void;
  awardCustomNote: string;
  setAwardCustomNote: (v: string) => void;
  savingAward: boolean;
  onSaveAward: () => Promise<void>;

  // Activity Audit
  auditingWorkshop: WorkshopProfile | null;
  setAuditingWorkshop: (v: WorkshopProfile | null) => void;
  auditData: any | null;
  setAuditData: (v: any | null) => void;
  loadingAudit: boolean;
}

export const AdminWorkshopModals: React.FC<AdminWorkshopModalsProps> = ({
  editingWorkshop,
  setEditingWorkshop,
  isSuspendingModalOpen,
  setIsSuspendingModalOpen,
  isBanningModalOpen,
  setIsBanningModalOpen,
  onSaveEditedWorkshop,
  editNewPassword,
  setEditNewPassword,
  showPasswordPlain,
  setShowPasswordPlain,
  onGenerateRandomPassword,
  onCredentialOverride,
  overridingCredentials,
  savingAction,
  credentialSuccessModal,
  setCredentialSuccessModal,
  copiedNotice,
  setCopiedNotice,
  suspensionDurationChoice,
  setSuspensionDurationChoice,
  suspensionReasonInput,
  setSuspensionReasonInput,
  onExecuteSuspension,
  banReasonInput,
  setBanReasonInput,
  onExecuteBan,
  rejectingAppealWorkshop,
  setRejectingAppealWorkshop,
  rejectionReasonInput,
  setRejectionReasonInput,
  onConfirmRejectAppeal,
  cloudRejectingProduct,
  setCloudRejectingProduct,
  cloudRejectReason,
  setCloudRejectReason,
  onConfirmRejectProduct,
  deletingWorkshop,
  setDeletingWorkshop,
  selectiveDeleteMode,
  setSelectiveDeleteMode,
  deleteConfirmText,
  setDeleteConfirmText,
  onConfirmSelectiveDelete,
  editingMaterial,
  setEditingMaterial,
  newMaterialPrice,
  setNewMaterialPrice,
  onSaveMaterialPrice,
  isNewWorkshopModalOpen,
  setIsNewWorkshopModalOpen,
  newBrandName,
  setNewBrandName,
  newArtistName,
  setNewArtistName,
  newEmail,
  setNewEmail,
  newPhone,
  setNewPhone,
  newCountry,
  setNewCountry,
  newRole,
  setNewRole,
  onCreateNewWorkshop,
  awardingWorkshop,
  setAwardingWorkshop,
  selectedStars,
  setSelectedStars,
  selectedMedal,
  setSelectedMedal,
  awardCustomNote,
  setAwardCustomNote,
  savingAward,
  onSaveAward,
  auditingWorkshop,
  setAuditingWorkshop,
  auditData,
  setAuditData,
  loadingAudit,
}) => {
  return (
    <>
      {/* 1. Edit Workshop Modal + Credential Override */}
      {editingWorkshop && !isSuspendingModalOpen && !isBanningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <h3 className="text-base font-black flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#EA580C]" />
                <span>تعديل بيانات الورشة وبيانات الدخول</span>
              </h3>
              <button type="button" onClick={() => setEditingWorkshop(null)} className="p-1.5 rounded-xl cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSaveEditedWorkshop} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">اسم البراند</label>
                  <input
                    type="text"
                    required
                    value={editingWorkshop.brandName}
                    onChange={(e) => setEditingWorkshop({ ...editingWorkshop, brandName: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">اسم الفنان</label>
                  <input
                    type="text"
                    required
                    value={editingWorkshop.artistName}
                    onChange={(e) => setEditingWorkshop({ ...editingWorkshop, artistName: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={editingWorkshop.email || ''}
                    onChange={(e) => setEditingWorkshop({ ...editingWorkshop, email: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editingWorkshop.phoneNumber || ''}
                    onChange={(e) => setEditingWorkshop({ ...editingWorkshop, phoneNumber: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-black flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#EA580C]" />
                    تحديث كلمة المرور والصلاحية (Override)
                  </span>
                  <button
                    type="button"
                    onClick={onGenerateRandomPassword}
                    className="text-[11px] font-black text-[#C2410C] dark:text-[#FBBF24] cursor-pointer"
                  >
                    توليد كلمة سر قوية
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPasswordPlain ? 'text' : 'password'}
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    placeholder="كلمة مرور جديدة (اختياري)..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] font-mono text-xs"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordPlain((p) => !p)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {showPasswordPlain ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={overridingCredentials}
                  onClick={() => onCredentialOverride(editingWorkshop)}
                  className="w-full py-2 rounded-xl bg-[#0C1427] text-[#FBBF24] font-black cursor-pointer"
                >
                  {overridingCredentials ? 'جاري التحديث...' : 'حفظ بيانات الدخول وتصدير بطاقة التسليم'}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWorkshop(null)}
                  className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-5 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer"
                >
                  {savingAction ? 'جاري الحفظ...' : 'حفظ بيانات الورشة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credential Success Popup */}
      {credentialSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span>تم تحديث بيانات الدخول بنجاح</span>
            </h3>
            <div className="p-3.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] space-y-1 text-xs font-mono">
              <div className="font-sans font-black">{credentialSuccessModal.brandName} ({credentialSuccessModal.artistName})</div>
              <div>Email: {credentialSuccessModal.email}</div>
              <div>Password: {credentialSuccessModal.password}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `بيانات دخول ورشة ${credentialSuccessModal.brandName}\nالبريد: ${credentialSuccessModal.email}\nكلمة المرور: ${credentialSuccessModal.password}`;
                  navigator.clipboard.writeText(text);
                  setCopiedNotice(true);
                  setTimeout(() => setCopiedNotice(false), 2500);
                }}
                className="flex-1 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedNotice ? 'تم النسخ!' : 'نسخ البيانات'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCredentialSuccessModal(null)}
                className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Suspend Modal */}
      {isSuspendingModalOpen && editingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Snowflake className="w-5 h-5" />
              <span>إيقاف مؤقت لورشة "{editingWorkshop.brandName}"</span>
            </h3>
            <div className="space-y-2 text-xs">
              <label className="font-bold block">مدة الإيقاف</label>
              <select
                value={suspensionDurationChoice}
                onChange={(e) => setSuspensionDurationChoice(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                <option value="24 ساعة">24 ساعة</option>
                <option value="3 أيام">3 أيام</option>
                <option value="أسبوع">أسبوع</option>
                <option value="أسبوعين">أسبوعين</option>
                <option value="شهر">شهر</option>
              </select>
              <label className="font-bold block pt-1">سبب الإيقاف (إجباري)</label>
              <textarea
                rows={3}
                value={suspensionReasonInput}
                onChange={(e) => setSuspensionReasonInput(e.target.value)}
                placeholder="اكتب سبب الإيقاف بوضوح لصاحب الورشة..."
                className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSuspendingModalOpen(false);
                  setEditingWorkshop(null);
                }}
                className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={onExecuteSuspension}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-black cursor-pointer"
              >
                تنفيذ الإيقاف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Ban Modal */}
      {isBanningModalOpen && editingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              <span>حظر دائم لورشة "{editingWorkshop.brandName}"</span>
            </h3>
            <textarea
              rows={3}
              value={banReasonInput}
              onChange={(e) => setBanReasonInput(e.target.value)}
              placeholder="سبب الحظر القانوني والرقابي (إجباري)..."
              className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsBanningModalOpen(false);
                  setEditingWorkshop(null);
                }}
                className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={onExecuteBan}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer"
              >
                تأكيد الحظر الدائم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Reject Appeal Modal */}
      {rejectingAppealWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-rose-600">رفض الطعن: {rejectingAppealWorkshop.brand_name || 'الورشة'}</h3>
            <textarea
              rows={3}
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="سبب رفض الطعن..."
              className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectingAppealWorkshop(null)} className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer">
                إلغاء
              </button>
              <button type="button" onClick={onConfirmRejectAppeal} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer">
                تأكيد رفض الطعن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Reject Cloud Product Modal */}
      {cloudRejectingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>ملاحظات رفض "{cloudRejectingProduct.product_name}"</span>
            </h3>
            <textarea
              rows={3}
              value={cloudRejectReason}
              onChange={(e) => setCloudRejectReason(e.target.value)}
              placeholder="اكتب ملاحظات التحسين أو سبب عدم النشر للفنان..."
              className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCloudRejectingProduct(null)} className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer">
                إلغاء
              </button>
              <button type="button" onClick={onConfirmRejectProduct} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer">
                إرسال الملاحظات ورفض النشر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Selective Delete Modal */}
      {deletingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>حذف أو تصفير بيانات "{deletingWorkshop.brandName}"</span>
            </h3>
            <select
              value={selectiveDeleteMode}
              onChange={(e) => setSelectiveDeleteMode(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            >
              <option value="catalog_inventory">تصفير الكتالوج والمخزون فقط</option>
              <option value="finance_orders">تصفير الدورة المالية والطلبيات فقط</option>
              <option value="cascade">حذف الورشة بالكامل من المنظومة</option>
            </select>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`اكتب "${deletingWorkshop.brandName}" للتأكيد`}
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingWorkshop(null)} className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={onConfirmSelectiveDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer"
              >
                تنفيذ الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Edit Material Price Modal */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black">تعديل سعر خامة: {editingMaterial.name}</h3>
            <input
              type="number"
              value={newMaterialPrice}
              onChange={(e) => setNewMaterialPrice(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-mono font-bold"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingMaterial(null)} className="px-3 py-1.5 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs cursor-pointer">
                إلغاء
              </button>
              <button type="button" onClick={onSaveMaterialPrice} className="px-4 py-1.5 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer">
                حفظ السعر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Register New Workshop Modal */}
      {isNewWorkshopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#EA580C]" />
                <span>تسجيل ورشة جديدة في المنظومة</span>
              </h3>
              <button type="button" onClick={() => setIsNewWorkshopModalOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onCreateNewWorkshop} className="space-y-3 text-xs">
              <input
                type="text"
                required
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="اسم البراند / الورشة *"
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <input
                type="text"
                required
                value={newArtistName}
                onChange={(e) => setNewArtistName(e.target.value)}
                placeholder="اسم الفنان المسؤول *"
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="البريد الإلكتروني"
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono"
                dir="ltr"
              />
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-mono"
                dir="ltr"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                >
                  {COUNTRIES_CONFIG.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
                >
                  <option value="artisan">ورشة فنان</option>
                  <option value="manager">مشرف</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsNewWorkshopModalOpen(false)} className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer">
                  إلغاء
                </button>
                <button type="submit" disabled={savingAction} className="px-5 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer">
                  {savingAction ? 'جاري التسجيل...' : 'إنشاء الورشة الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Gamification Award Modal */}
      {awardingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-black flex items-center gap-2">
              <Award className="w-5 h-5 text-[#EA580C]" />
              <span>تكريم ومنح وسام لورشة "{awardingWorkshop.brandName}"</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <select
                value={selectedMedal}
                onChange={(e) => setSelectedMedal(e.target.value as any)}
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                <option value="diamond">💎 القلادة الماسية</option>
                <option value="gold">🥇 القلادة الذهبية</option>
                <option value="silver">🥈 القلادة الفضية</option>
                <option value="bronze">🥉 القلادة البرونزية</option>
              </select>
              <select
                value={selectedStars}
                onChange={(e) => setSelectedStars(Number(e.target.value))}
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] font-bold"
              >
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>
                    {s} نجوم
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={2}
              value={awardCustomNote}
              onChange={(e) => setAwardCustomNote(e.target.value)}
              placeholder="رسالة تهنئة للورشة (اختياري)..."
              className="w-full p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAwardingWorkshop(null)} className="px-4 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] text-xs font-bold cursor-pointer">
                إلغاء
              </button>
              <button
                type="button"
                disabled={savingAward}
                onClick={onSaveAward}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
              >
                {savingAward ? 'جاري الحفظ...' : 'منح الوسام وإرسال التهنئة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Activity Audit Modal */}
      {auditingWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060B18]/75 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <h3 className="text-base font-black flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#EA580C]" />
                <span>فحص نشاط: {auditingWorkshop.brandName}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAuditingWorkshop(null);
                  setAuditData(null);
                }}
                className="p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingAudit ? (
              <div className="py-10 text-center text-xs font-bold">جاري سحب مؤشرات الأداء...</div>
            ) : auditData ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono tabular-nums">
                  <div className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">المنتجات</span>
                    <strong className="text-base">{auditData.productsCount ?? 0}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">السوق</span>
                    <strong className="text-base text-[#C2410C] dark:text-[#FBBF24]">{auditData.marketplaceProductsCount ?? 0}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">الخامات</span>
                    <strong className="text-base">{auditData.materialsCount ?? 0}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040]">
                    <span className="block text-[10px] font-sans text-[#475569] dark:text-[#94A3B8]">الطلبيات</span>
                    <strong className="text-base">{auditData.ordersCount ?? 0}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-between">
                  <span>التقييم الحالي: <strong>{getMedalArabic(auditData.medal)}</strong></span>
                  <span className="font-mono font-black">★ {auditData.rating_stars || 5}/5</span>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAuditingWorkshop(null);
                      setAuditData(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0C1427] text-[#FBBF24] font-black cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};
