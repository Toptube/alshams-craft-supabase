import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../../types';
import {
  STAFF_ROLE_LABELS,
  SupplierBranch,
  SupplierHrLog,
  SupplierStaffRole,
  SupplierStaffUser,
  TerminalModuleKey,
} from '../../types/supplierErp';
import {
  addSupplierHrLog,
  bindDeviceTerminal,
  fetchSupplierErpOverview,
  fetchSupplierStaffAndHr,
  getLockedTerminalConfig,
  saveSupplierStaffUser,
  setLockedTerminalConfig,
} from '../../db/supplierErpService';
import { playErrorSound, playSuccessSound } from '../../lib/sounds';
import {
  ArrowRight,
  Clock,
  Lock,
  MonitorSmartphone,
  Plus,
  UserPlus,
  Users2,
  X,
} from 'lucide-react';

interface SupplierHrTerminalViewProps {
  profile: UserProfile;
  initialBranchId?: string;
  onGoBack: () => void;
  onGoHome: () => void;
  onDeviceLocked?: () => void;
}

export const SupplierHrTerminalView: React.FC<SupplierHrTerminalViewProps> = ({
  profile,
  initialBranchId,
  onGoBack,
  onGoHome,
  onDeviceLocked,
}) => {
  const currency = profile.currencySymbol || 'ج.م';
  const [branches, setBranches] = useState<SupplierBranch[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [staffList, setStaffList] = useState<SupplierStaffUser[]>([]);
  const [hrLogs, setHrLogs] = useState<SupplierHrLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  // Add/Edit staff state
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SupplierStaffRole>('cashier');
  const [branchId, setBranchId] = useState(initialBranchId || '');
  const [phone, setPhone] = useState('');
  const [baseSalary, setBaseSalary] = useState(4000);

  // Selected Employee Card for Attendance / Penalties / Bonuses / Advances
  const [selectedStaff, setSelectedStaff] = useState<SupplierStaffUser | null>(null);
  const [logType, setLogType] = useState<SupplierHrLog['logType']>('attendance_in');
  const [logAmount, setLogAmount] = useState(0);
  const [logNotes, setLogNotes] = useState('');

  // Device Kiosk Lock Wizard state
  const [lockBranchId, setLockBranchId] = useState(initialBranchId || '');
  const [lockModule, setLockModule] = useState<TerminalModuleKey>('pos');
  const [locking, setLocking] = useState(false);
  const currentLocked = getLockedTerminalConfig();

  const loadAll = async () => {
    setLoading(true);
    const [ov, hr] = await Promise.all([fetchSupplierErpOverview(), fetchSupplierStaffAndHr()]);
    if (ov) {
      setSupplierId(ov.supplierId);
      setBranches(ov.branches);
      const firstShop = ov.branches.find((b) => b.branchType === 'shop') || ov.branches[0];
      if (firstShop) {
        setBranchId((p) => p || firstShop.id);
        setLockBranchId((p) => p || firstShop.id);
      }
    }
    setStaffList(hr.staff);
    setHrLogs(hr.hrLogs);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const showMsg = (text: string, isError = false) => {
    setNotice({ text, isError });
    if (isError) playErrorSound();
    else playSuccessSound();
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveSupplierStaffUser({
      fullName,
      username,
      password,
      role,
      branchId: branchId || null,
      phone,
      baseSalary,
    });
    if (res.success) {
      setIsStaffModalOpen(false);
      setFullName('');
      setUsername('');
      setPassword('');
      setPhone('');
      await loadAll();
      showMsg('تم إنشاء بطاقة الموظف وبيانات دخوله على الأجهزة الطرفية.');
    } else {
      showMsg(res.error || 'تعذر حفظ الموظف', true);
    }
  };

  const handleAddHrLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    const res = await addSupplierHrLog({
      staffId: selectedStaff.id,
      branchId: selectedStaff.branchId || null,
      logType,
      amount: logAmount,
      notes: logNotes,
    });
    if (res.success) {
      setLogAmount(0);
      setLogNotes('');
      await loadAll();
      showMsg('تم تسجيل حركة شؤون العاملين في بطاقة الموظف.');
    }
  };

  const handleLockCurrentDevice = async () => {
    if (!supplierId || !lockBranchId) return;
    setLocking(true);
    const bindRes = await bindDeviceTerminal();
    setLocking(false);
    if (bindRes.success && bindRes.deviceToken) {
      const targetBr = branches.find((b) => b.id === lockBranchId);
      setLockedTerminalConfig({
        supplierId,
        supplierBrand: profile.brandName || 'متجر المورد',
        branchId: lockBranchId,
        branchName: targetBr?.name || 'الفرع',
        moduleKey: lockModule,
        deviceToken: bindRes.deviceToken,
        boundIp: bindRes.boundIp,
        activeStaff: null,
        lockedAt: bindRes.lockedAt || new Date().toISOString(),
      });
      playSuccessSound();
      if (onDeviceLocked) onDeviceLocked();
    } else {
      showMsg('تعذر تثبيت هذا الجهاز', true);
    }
  };

  const staffLogsForSelected = useMemo(() => {
    if (!selectedStaff) return [];
    return hrLogs
      .filter((l) => l.staffId === selectedStaff.id)
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
  }, [hrLogs, selectedStaff]);

  const computeNetSalary = (st: SupplierStaffUser) => {
    const logs = hrLogs.filter((l) => l.staffId === st.id);
    const bonus = logs.filter((l) => l.logType === 'bonus').reduce((s, l) => s + Number(l.amount || 0), 0);
    const penalty = logs.filter((l) => l.logType === 'penalty').reduce((s, l) => s + Number(l.amount || 0), 0);
    const advance = logs.filter((l) => l.logType === 'advance').reduce((s, l) => s + Number(l.amount || 0), 0);
    return {
      bonus,
      penalty,
      advance,
      net: st.baseSalary + bonus - penalty - advance,
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5 text-right" dir="rtl">
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] text-xs font-black cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black flex items-center gap-2">
              <Users2 className="w-5 h-5 text-[#EA580C]" />
              <span>شؤون العاملين (HR) وتثبيت شاشات الفروع (Kiosk Lock)</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              بطاقة كاملة لكل موظف (حضور وانصراف · جزاءات · حوافز · سلف) + تثبيت الجهاز لشاشة محددة فقط
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsStaffModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة موظف</span>
          </button>
          <button
            type="button"
            onClick={onGoHome}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl p-3 text-xs font-black border ${
            notice.isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Kiosk Device Lock Section */}
      <section className="rounded-2xl bg-[#0C1427] text-[#F7F3EA] border border-[#22355E] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5" />
              <span>تثبيت هذه الشاشة على هذا الجهاز (Kiosk Lock)</span>
            </h2>
            <p className="text-[11px] text-slate-300">
              عند تفعيل التثبيت على جهاز الكاشير أو أمين المخزن في أي فرع، يفتح المتصفح مباشرة على تلك الشاشة فقط مع طلب يوزر وباسورد الموظف، ولا تُفتح أي شاشات أخرى إلا بالرقم السري للمالك.
            </p>
          </div>
          {currentLocked && (
            <span className="text-xs font-black text-emerald-400">
              الجهاز مثبت حالياً على: {currentLocked.branchName} ({currentLocked.moduleKey})
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <select
            value={lockBranchId}
            onChange={(e) => setLockBranchId(e.target.value)}
            className="h-10 px-3 rounded-xl bg-[#132040] border border-[#22355E] text-white font-bold"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                تثبيت لفرع: {b.name}
              </option>
            ))}
          </select>

          <select
            value={lockModule}
            onChange={(e) => setLockModule(e.target.value as TerminalModuleKey)}
            className="h-10 px-3 rounded-xl bg-[#132040] border border-[#22355E] text-white font-bold"
          >
            <option value="pos">شاشة كاشير المبيعات (POS) فقط</option>
            <option value="warehouse">شاشة أمين المخزن والجرد فقط</option>
            <option value="finance">شاشة محاسب الفرع وتقفيل الخزينة</option>
          </select>

          <button
            type="button"
            disabled={locking || !lockBranchId}
            onClick={handleLockCurrentDevice}
            className="h-10 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>{locking ? 'جاري التثبيت...' : 'تثبيت الشاشة على هذا الجهاز الآن'}</span>
          </button>
        </div>
      </section>

      {/* Staff Profile Cards Grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-black">فريق العمل وبطاقات الموظفين ({staffList.length})</h2>
        {loading ? (
          <div className="py-10 text-center text-xs font-bold">جاري تحميل بيانات الموظفين...</div>
        ) : staffList.length === 0 ? (
          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-8 text-center text-xs text-[#475569]">
            لم يتم تسجيل موظفين بعد. اضغط "إضافة موظف" لإنشاء يوزر وباسورد للكاشير أو أمين المخزن أو المحاسب.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {staffList.map((st) => {
              const br = branches.find((b) => b.id === st.branchId);
              const sal = computeNetSalary(st);
              return (
                <div
                  key={st.id}
                  className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black">{st.fullName}</h3>
                      <p className="text-[11px] font-bold text-[#C2410C] dark:text-amber-300">
                        {STAFF_ROLE_LABELS[st.role]}
                      </p>
                      <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                        {br ? br.name : 'كل الفروع'} · يوزر: <span className="font-mono">{st.username}</span>
                      </p>
                    </div>
                    <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                      صافي: {sal.net.toLocaleString('ar-EG')} {currency}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center font-mono tabular-nums text-[10px]">
                    <div className="rounded-lg bg-[#EFE9DC] dark:bg-[#132040] p-1.5">
                      <span className="block text-[9px] font-sans text-[#475569]">أساسي</span>
                      <span className="font-black">{st.baseSalary}</span>
                    </div>
                    <div className="rounded-lg bg-[#EFE9DC] dark:bg-[#132040] p-1.5">
                      <span className="block text-[9px] font-sans text-emerald-700">حوافز</span>
                      <span className="font-black">+{sal.bonus}</span>
                    </div>
                    <div className="rounded-lg bg-[#EFE9DC] dark:bg-[#132040] p-1.5">
                      <span className="block text-[9px] font-sans text-rose-600">جزاءات</span>
                      <span className="font-black">-{sal.penalty}</span>
                    </div>
                    <div className="rounded-lg bg-[#EFE9DC] dark:bg-[#132040] p-1.5">
                      <span className="block text-[9px] font-sans text-amber-700">سلف</span>
                      <span className="font-black">-{sal.advance}</span>
                    </div>
                  </div>

                  {st.lastLoginAt && (
                    <p className="text-[10px] font-mono text-[#475569] dark:text-[#94A3B8]">
                      آخر دخول: {new Date(st.lastLoginAt).toLocaleString('ar-EG')} {st.deviceIp ? `(${st.deviceIp})` : ''}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedStaff(st)}
                    className="w-full py-2 rounded-xl bg-[#0C1427] dark:bg-[#1A2B54] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    <span>بطاقة الموظف (حضور / جزاء / سلفة / حافز)</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3" dir="rtl">
          <form
            onSubmit={handleSaveStaff}
            className="w-full max-w-md rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">إضافة موظف جديد للفرع</h3>
              <button type="button" onClick={() => setIsStaffModalOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="الاسم الكامل للموظف"
              className="w-full h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] text-xs font-bold"
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم الدخول (مثال: ahmed_pos)"
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as SupplierStaffRole)}
                className="h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
              >
                {Object.entries(STAFF_ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-10 px-2.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-bold"
              >
                <option value="">كل الفروع (مدير عام)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف"
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono"
              />
              <input
                type="number"
                min={0}
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value || 0))}
                placeholder="الراتب الأساسي"
                className="h-10 px-3 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] font-mono font-black"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#EA580C] text-white text-xs font-black cursor-pointer"
            >
              حفظ بطاقة الموظف
            </button>
          </form>
        </div>
      )}

      {/* Employee Card Logs Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3" dir="rtl">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D4CCBC] dark:border-[#22355E] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black">بطاقة الموظف: {selectedStaff.fullName}</h3>
                <p className="text-[11px] text-[#475569]">{STAFF_ROLE_LABELS[selectedStaff.role]}</p>
              </div>
              <button type="button" onClick={() => setSelectedStaff(null)} className="p-1.5 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddHrLog} className="p-4 bg-[#EFE9DC]/60 dark:bg-[#132040] border-b border-[#D4CCBC] grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as any)}
                className="h-9 px-2 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-bold"
              >
                <option value="attendance_in">تسجيل حضور</option>
                <option value="attendance_out">تسجيل انصراف</option>
                <option value="bonus">حافز / مكافأة (+)</option>
                <option value="penalty">جزاء / خصم (-)</option>
                <option value="advance">سلفة مالية (-)</option>
                <option value="salary_paid">صرف راتب</option>
              </select>
              <input
                type="number"
                min={0}
                value={logAmount}
                onChange={(e) => setLogAmount(Number(e.target.value || 0))}
                placeholder="المبلغ (إن وجد)"
                className="h-9 px-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-mono"
              />
              <input
                type="text"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="ملاحظة / سبب"
                className="h-9 px-2.5 rounded-xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] font-bold"
              />
              <button
                type="submit"
                className="h-9 rounded-xl bg-[#EA580C] text-white font-black flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل</span>
              </button>
            </form>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E] text-xs">
              {staffLogsForSelected.length === 0 ? (
                <p className="text-center py-6 text-[#475569]">لا توجد حركات مسجلة في ملف الموظف بعد.</p>
              ) : (
                staffLogsForSelected.map((l) => (
                  <div key={l.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-black">
                        {l.logType === 'attendance_in'
                          ? 'حضور'
                          : l.logType === 'attendance_out'
                          ? 'انصراف'
                          : l.logType === 'bonus'
                          ? 'حافز'
                          : l.logType === 'penalty'
                          ? 'جزاء'
                          : l.logType === 'advance'
                          ? 'سلفة'
                          : 'صرف راتب'}
                      </span>{' '}
                      <span className="text-[11px] text-[#475569]">{l.notes}</span>
                      <div className="text-[10px] font-mono text-[#475569]">
                        {new Date(l.eventTime).toLocaleString('ar-EG')} · {l.actorName}
                      </div>
                    </div>
                    {l.amount > 0 && (
                      <span className="font-mono font-black">
                        {l.amount.toLocaleString('ar-EG')} {currency}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
