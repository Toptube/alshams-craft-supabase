import React, { useState, useEffect } from 'react';
import {
  EmployeeProfile,
  EmployeePayoutRecord,
  UserProfile,
  EmployeeTier,
  EmployeePaymentType,
  SafeType,
  PaymentMethod,
} from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  Users2,
  UserPlus,
  DollarSign,
  Phone,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Wallet,
  TrendingDown,
  Building,
  Search,
  X,
  Edit2,
  Trash2,
  BadgePercent,
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';

interface HRWorkforceModuleProps {
  profile: UserProfile;
  onOpenNewEmployeeModal: () => void;
}

export const HRWorkforceModule: React.FC<HRWorkforceModuleProps> = ({
  profile,
  onOpenNewEmployeeModal,
}) => {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [payouts, setPayouts] = useState<EmployeePayoutRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Payout / Advance settlement state
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [payoutType, setPayoutType] = useState<'wage_payout' | 'advance' | 'bonus' | 'salary'>('wage_payout');
  const [payoutAmount, setPayoutAmount] = useState<number>(300);
  const [safeType, setSafeType] = useState<SafeType>('main');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [payoutNotes, setPayoutNotes] = useState<string>('تسوية مستحقات مصنعية القطع المشغولة');

  // Edit employee modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editTier, setEditTier] = useState<EmployeeTier>('خبير');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editPaymentType, setEditPaymentType] = useState<EmployeePaymentType>('piece_rate');
  const [editBaseSalary, setEditBaseSalary] = useState(3000);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [notice, setNotice] = useState<string>('');

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

  const loadData = async () => {
    try {
      const emps = await tenantStorage.getEmployees(tenantId);
      const payRecs = await tenantStorage.getEmployeePayouts(tenantId);
      setEmployees(emps);
      setPayouts(payRecs);
      if (emps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(emps[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  // Listen to external employee updates
  useEffect(() => {
    const handleEmployeeChange = () => {
      loadData();
    };
    window.addEventListener('alshams_employees_changed', handleEmployeeChange);
    return () => window.removeEventListener('alshams_employees_changed', handleEmployeeChange);
  }, [tenantId]);

  // Delete employee
  const handleDeleteEmployee = async (emp: EmployeeProfile) => {
    if (!window.confirm(`هل أنت متأكد من حذف الموظف "${emp.fullName}" نهائياً من سجلات الورشة؟`)) {
      return;
    }
    setDeletingId(emp.id);
    try {
      await tenantStorage.deleteEmployee(tenantId, emp.id);
      await loadData();
      setNotice(`تم حذف الموظف "${emp.fullName}" بنجاح.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setNotice(err.message || 'فشل حذف الموظف');
    } finally {
      setDeletingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (emp: EmployeeProfile) => {
    setEditingEmployee(emp);
    setEditFullName(emp.fullName);
    setEditSpecialty(emp.specialty || emp.role || '');
    setEditTier(emp.tier || 'متوسط');
    setEditPhoneNumber(emp.phoneNumber || emp.phone || '');
    setEditPaymentType(emp.paymentType || 'piece_rate');
    setEditBaseSalary(emp.baseSalary || 3000);
    setIsEditModalOpen(true);
  };

  // Save Edit Employee
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !editFullName.trim()) return;

    setSavingEdit(true);
    try {
      const updated: EmployeeProfile = {
        ...editingEmployee,
        fullName: editFullName.trim(),
        specialty: editSpecialty.trim(),
        role: editSpecialty.trim(),
        tier: editTier,
        phoneNumber: editPhoneNumber.trim(),
        phone: editPhoneNumber.trim(),
        paymentType: editPaymentType,
        baseSalary: editPaymentType === 'fixed_salary' ? editBaseSalary : undefined,
      };

      await tenantStorage.saveEmployee(updated);
      await loadData();
      setIsEditModalOpen(false);
      setEditingEmployee(null);
      setNotice(`تم تحديث بيانات الموظف "${updated.fullName}" بنجاح.`);
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      setNotice(err.message || 'فشل حفظ التعديلات');
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Payout directly for employee
  const handleOpenPayoutForEmployee = (emp: EmployeeProfile) => {
    setSelectedEmployeeId(emp.id);
    setPayoutAmount(emp.currentBalance && emp.currentBalance > 0 ? emp.currentBalance : 300);
    setPayoutNotes(`تسوية مستحقات الفنان ${emp.fullName}`);
    setIsPayoutModalOpen(true);
  };

  // Record payout or advance with automatic operating expense binding & safe deduction
  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || payoutAmount <= 0) return;

    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) return;

    try {
      const payoutRecord: EmployeePayoutRecord = {
        id: 'pay_' + Date.now(),
        tenantId,
        employeeId: emp.id,
        employeeName: emp.fullName,
        type: payoutType,
        amount: payoutAmount,
        safeType,
        paymentMethod,
        date: new Date().toISOString().split('T')[0],
        notes: payoutNotes,
        registeredAsOperatingExpense: true,
        createdAt: Date.now(),
      };

      await tenantStorage.recordEmployeePayout(payoutRecord);
      await loadData();
      setIsPayoutModalOpen(false);
      setPayoutNotes('');
      setNotice(`تم سداد ${payoutAmount} ${profile.currencySymbol} للموظف ${emp.fullName} وترحيلها كمصروفات تشغيلية وخصمها من الخزينة!`);
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      setNotice(err.message || 'فشل تسجيل الصرف');
    }
  };

  const totalPersonnelWagesSettled = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);

  const getTierBadge = (tier: EmployeeTier) => {
    switch (tier) {
      case 'مدرب':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300';
      case 'خبير':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300';
      case 'متوسط':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300';
      default:
        return 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300 border-stone-300';
    }
  };

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      emp.fullName.toLowerCase().includes(q) ||
      (emp.specialty && emp.specialty.toLowerCase().includes(q)) ||
      (emp.phoneNumber && emp.phoneNumber.toLowerCase().includes(q)) ||
      (emp.phone && emp.phone.toLowerCase().includes(q)) ||
      (emp.tier && emp.tier.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-right">
      {/* 1. TOP BANNER WITH ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-transparent border border-purple-300/40 dark:border-purple-800/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-400">
            <Users2 className="w-4 h-4" />
            <span>إدارة الموارد البشرية وكادرات الحرفيين (HR & Payroll Finance)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            منظومة كادرات العمالة ومصروفات التشغيل
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            سجل الفنانين والصناع، احتساب الأجور بالقطعة أو المرتبات الثابتة، مع إمكانية التعديل والحذف المباشر.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPayoutModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
          >
            <DollarSign className="w-4 h-4" />
            <span>صرف مصنعية / سلفة</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewEmployeeModal}
            className="px-4 py-2.5 rounded-2xl text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 transition flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ تعيين موظف / فنان</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 2. SEARCH BAR & QUICK FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الفنان، التخصص، الكادر، أو رقم الهاتف..."
            className="w-full pr-9 pl-4 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold text-stone-900 dark:text-stone-100 outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-stone-500 px-2 shrink-0">
          <Users2 className="w-4 h-4 text-purple-600" />
          <span>إجمالي الفنانين:</span>
          <span className="font-mono text-stone-900 dark:text-stone-100 font-extrabold">
            {employees.length}
          </span>
          {searchQuery && (
            <span className="text-[11px] text-stone-400">
              (مطابق: {filteredEmployees.length})
            </span>
          )}
        </div>
      </div>

      {/* 3. EMPLOYEES ROSTER LIST (CARDS WITH EDIT & DELETE) */}
      <div className="space-y-4">
        {filteredEmployees.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 mx-auto flex items-center justify-center">
              <Users2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-extrabold text-stone-800 dark:text-stone-200">
              {searchQuery ? 'لا يوجد فنانين يطابقون عبارة البحث' : 'لا يوجد فنانين أو موظفين مسجلين حالياً'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {searchQuery
                ? 'جرب البحث باسم آخر أو كادر مختلف.'
                : 'ابدأ بتعيين أول فنان أو صانع لتسجيل مصنعيات الإنتاج والمصروفات التشغيلية.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onOpenNewEmployeeModal}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>تعيين أول فنان الآن</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between gap-4 text-right hover:border-purple-300/80 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getTierBadge(
                        emp.tier || ''
                      )}`}
                    >
                      كادر {emp.tier || 'عادي'}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {emp.paymentType === 'piece_rate' ? 'مصنعية بالقطعة' : 'راتب شهري ثابت'}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-stone-900 dark:text-stone-100">
                    {emp.fullName}
                  </h4>
                  <p className="text-xs text-purple-700 dark:text-purple-400 font-medium mt-0.5">
                    التخصص: {emp.specialty || emp.role || 'صانع حرفي'}
                  </p>
                  <p className="text-xs text-stone-500 font-mono mt-1" dir="ltr">
                    {emp.phoneNumber || emp.phone || '—'}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-stone-400 block">إجمالي المستحق:</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      {emp.totalEarned || 0} {profile.currencySymbol}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">الرصيد القائم للصرف:</span>
                    <span
                      className={`font-black ${
                        (emp.currentBalance || 0) > 0 ? 'text-amber-600' : 'text-stone-400'
                      }`}
                    >
                      {emp.currentBalance || 0} {profile.currencySymbol}
                    </span>
                  </div>
                </div>

                {/* Card Actions: Edit, Delete, Settle Payout */}
                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleOpenPayoutForEmployee(emp)}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                    title="صرف مستحقات أو سلفة"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>صرف أجر</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(emp)}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-600 dark:text-stone-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-stone-200 dark:border-stone-700 transition cursor-pointer flex items-center gap-1"
                      title="تعديل بيانات الفنان"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteEmployee(emp)}
                      disabled={deletingId === emp.id}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer disabled:opacity-50"
                      title="حذف الموظف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-200 dark:border-stone-800">
        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 block">إجمالي كادر العمالة النشط</span>
            <span className="text-2xl font-black font-mono text-stone-900 dark:text-stone-100">
              {employees.length} فنانين
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
            <Users2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 block">إجمالي المصروفات التشغيلية للأجور المسددة</span>
            <span className="text-2xl font-black font-mono text-emerald-600">
              {totalPersonnelWagesSettled} {profile.currencySymbol}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 block">أرصدة مستحقات الحرفيين المعلقة</span>
            <span className="text-2xl font-black font-mono text-amber-600">
              {employees.reduce((s, e) => s + (e.currentBalance || 0), 0)} {profile.currencySymbol}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 5. EDIT EMPLOYEE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-purple-300 dark:border-stone-700 w-full max-w-md space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-extrabold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-purple-600" />
                <span>تعديل بيانات الفنان / الموظف</span>
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">اسم الفنان / الموظف *</label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="الاسم الكامل"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">الكادر الحرفي *</label>
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value as EmployeeTier)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="عادي">عادي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="خبير">خبير</option>
                  <option value="مدرب">مدرب</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  placeholder="01000000000"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">التخصص الحرفي / الدور</label>
              <input
                type="text"
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
                placeholder="مثال: حياكة مكرمية جداريات، عقد بوهيمية"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">نظام المحاسبة *</label>
                <select
                  value={editPaymentType}
                  onChange={(e) => setEditPaymentType(e.target.value as EmployeePaymentType)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="piece_rate">مصنعية بالقطعة</option>
                  <option value="fixed_salary">راتب شهري ثابت</option>
                </select>
              </div>

              {editPaymentType === 'fixed_salary' && (
                <div>
                  <label className="block text-xs font-bold mb-1">الراتب الشهري ({profile.currencySymbol})</label>
                  <NumberInput
                    value={editBaseSalary}
                    onChange={setEditBaseSalary}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. PAYOUT MODAL WITH OPERATING EXPENSE BINDING */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleRecordPayout}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-purple-300 dark:border-stone-700 w-full max-w-lg space-y-4 text-right shadow-2xl"
          >
            <div className="border-b pb-3">
              <h3 className="text-sm font-extrabold text-purple-900 dark:text-purple-300">
                تسوية أجر أو صرف سلفة للموظف (تسجيل مصروف تشغيلي)
              </h3>
              <p className="text-[11px] text-stone-500">
                يتم قيد المبلغ تلقائياً في قائمة الأرباح والخسائر كمصروف تشغيلي وخصمه من رصيد الخزينة المحددة
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">الموظف / الفنان *</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} (كادر {e.tier} — رصيده المستحق: {e.currentBalance} {profile.currencySymbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">نوع الحركة *</label>
                <select
                  value={payoutType}
                  onChange={(e) => setPayoutType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="wage_payout">صرف مصنعية إنتاج</option>
                  <option value="advance">سلفة موظف (تخصم لاحقاً)</option>
                  <option value="bonus">مكافأة تميز وإتقان</option>
                  <option value="salary">راتب شهري</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">المبلغ المنصرف ({profile.currencySymbol}) *</label>
                <NumberInput
                  min={1}
                  required
                  value={payoutAmount}
                  onChange={setPayoutAmount}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">الخزينة المسحوب منها *</label>
                <select
                  value={safeType}
                  onChange={(e) => setSafeType(e.target.value as SafeType)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="main">الخزينة الرئيسية</option>
                  <option value="sub">الخزينة الفرعية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">طريقة السداد *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                >
                  <option value="cash">نقدي (كاش في اليد)</option>
                  <option value="wallet">محفظة إلكترونية (إنستاباي / كاش)</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">بيان الصرف والملاحظات</label>
              <input
                type="text"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="مثال: تسوية مصنعية جداريات فندق الغردقة"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs"
              />
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPayoutModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
              >
                اعتماد الصرف وتخفيض الخزينة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
