import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import {
  LockedTerminalConfig,
  round2,
  STAFF_ROLE_LABELS,
  SupplierBranchTreasury,
  SupplierPosShift,
  SupplierTreasuryTransfer,
} from '../../types/supplierErp';
import {
  addSupplierHrLog,
  clearLockedTerminalConfig,
  closePosShift,
  fetchBranchShifts,
  fetchSupplierErpOverview,
  openPosShift,
  setLockedTerminalConfig,
  setStaffTerminalToken,
  staffTerminalLogin,
  submitBranchTreasuryTransfer,
  unlockDeviceTerminal,
} from '../../db/supplierErpService';
import { SupplierPosView } from './SupplierPosView';
import { SupplierBranchesWarehouseView } from './SupplierBranchesWarehouseView';
import { playErrorSound, playSuccessSound } from '../../lib/sounds';
import {
  Building2,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  LogOut,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  Unlock,
  Wallet,
  X,
} from 'lucide-react';

interface LockedTerminalShellProps {
  config: LockedTerminalConfig;
  onUnlocked?: () => void;
}

const MODULE_LABELS: Record<LockedTerminalConfig['moduleKey'], string> = {
  pos: 'شاشة كاشير نقاط البيع (POS)',
  warehouse: 'شاشة أمين المخزن والجرد والتحويلات',
  finance: 'شاشة محاسب الفرع وتقفيل الخزينة',
};

export const LockedTerminalShell: React.FC<LockedTerminalShellProps> = ({
  config,
  onUnlocked,
}) => {
  const [username, setUsername] = useState(config.rememberUsername || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(Boolean(config.rememberUsername));
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Unlock modal state
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Finance-only terminal state
  const [branchTreasury, setBranchTreasury] = useState<SupplierBranchTreasury | null>(null);
  const [shifts, setShifts] = useState<SupplierPosShift[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<SupplierTreasuryTransfer[]>([]);
  const [finLoading, setFinLoading] = useState(false);
  const [transferCash, setTransferCash] = useState(0);
  const [transferInstapay, setTransferInstapay] = useState(0);
  const [transferWallet, setTransferWallet] = useState(0);
  const [transferNotes, setTransferNotes] = useState('');
  const [finNotice, setFinNotice] = useState<string | null>(null);

  const synthProfile: UserProfile = {
    id: config.supplierId,
    tenantId: config.supplierId,
    workshopId: config.supplierId,
    ownerUid: config.supplierId,
    email: '',
    artistName: config.activeStaff?.fullName || 'موظف الفرع',
    brandName: config.supplierBrand || 'متجر المورد',
    gender: 'male',
    phoneNumber: '',
    country: 'مصر',
    currency: 'EGP',
    currencySymbol: 'ج.م',
    selectedCrafts: [],
    defaultVatPercent: 0,
    showTaxInfoOnInvoice: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'kiosk',
    accountRole: 'supplier',
  };

  const loadFinanceData = async () => {
    if (!config.activeStaff || config.moduleKey !== 'finance') return;
    setFinLoading(true);
    const [ov, sh] = await Promise.all([
      fetchSupplierErpOverview(),
      fetchBranchShifts(config.branchId),
    ]);
    if (ov) {
      const tr =
        ov.branchTreasuries.find((t) => t.branchId === config.branchId) || {
          id: `tr_${config.branchId}`,
          supplierId: config.supplierId,
          branchId: config.branchId,
          branchName: config.branchName,
          cashBalance: 0,
          instapayBalance: 0,
          walletBalance: 0,
        };
      setBranchTreasury(tr);
      setTransferCash(round2(tr.cashBalance));
      setTransferInstapay(round2(tr.instapayBalance));
      setTransferWallet(round2(tr.walletBalance));
      setPendingTransfers(
        ov.pendingTransfers.filter((t) => t.branchId === config.branchId)
      );
    }
    setShifts(sh);
    setFinLoading(false);
  };

  useEffect(() => {
    loadFinanceData();
  }, [config.activeStaff?.id, config.moduleKey, config.branchId]);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError('يرجى كتابة اسم المستخدم وكلمة المرور');
      return;
    }
    setLoggingIn(true);
    setLoginError(null);
    const res = await staffTerminalLogin({
      supplierId: config.supplierId,
      branchId: config.branchId,
      username: username.trim(),
      password,
      deviceToken: config.deviceToken,
    });
    setLoggingIn(false);

    if (!res.success || !res.staffToken || !res.staff) {
      playErrorSound();
      setLoginError(res.error || 'بيانات الدخول غير صحيحة');
      return;
    }

    setStaffTerminalToken(res.staffToken);
    const updatedCfg: LockedTerminalConfig = {
      ...config,
      boundIp: res.clientIp || config.boundIp,
      rememberStaffId: rememberMe ? res.staff.id : undefined,
      rememberUsername: rememberMe ? res.staff.username : undefined,
      activeStaff: {
        id: res.staff.id,
        fullName: res.staff.fullName,
        username: res.staff.username,
        role: res.staff.role,
      },
    };
    setLockedTerminalConfig(updatedCfg);
    playSuccessSound();
    setPassword('');
    addSupplierHrLog({
      staffId: res.staff.id,
      branchId: config.branchId,
      logType: 'attendance_in',
      notes: `دخول محطة ${MODULE_LABELS[config.moduleKey]}`,
    }).catch(() => {});
  };

  const handleStaffLogout = () => {
    const stId = config.activeStaff?.id;
    if (stId) {
      addSupplierHrLog({
        staffId: stId,
        branchId: config.branchId,
        logType: 'attendance_out',
        notes: 'تسجيل خروج من محطة الفرع',
      }).catch(() => {});
    }
    setStaffTerminalToken('');
    setLockedTerminalConfig({
      ...config,
      activeStaff: null,
    });
  };

  const handleUnlockTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPin.trim()) {
      setUnlockError('يرجى إدخال الرقم السري للمالك (PIN)');
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    const res = await unlockDeviceTerminal(config.supplierId, ownerPin.trim());
    setUnlocking(false);
    if (!res.success) {
      playErrorSound();
      setUnlockError(res.error || 'الرقم السري غير صحيح');
      return;
    }
    clearLockedTerminalConfig();
    playSuccessSound();
    setIsUnlockModalOpen(false);
    if (onUnlocked) onUnlocked();
  };

  const openShift = shifts.find((s) => s.status === 'open');

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-[#F2ECE1] dark:bg-[#060B18] text-[#0C1427] dark:text-[#F7F3EA] font-sans"
      dir="rtl"
    >
      {/* Top Locked Kiosk Governance Strip */}
      <header className="sticky top-0 z-40 bg-[#0C1427] text-[#F7F3EA] border-b border-[#22355E] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EA580C]/20 border border-[#EA580C]/50 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-[#FDBA74]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-black truncate">
              {config.supplierBrand} · {config.branchName}
            </div>
            <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
              <span>{MODULE_LABELS[config.moduleKey]}</span>
              {config.activeStaff && (
                <span>
                  · الموظف: <strong className="text-amber-300">{config.activeStaff.fullName}</strong> (
                  {STAFF_ROLE_LABELS[config.activeStaff.role] || config.activeStaff.role})
                </span>
              )}
              {config.boundIp && (
                <span className="font-mono text-[10px] text-slate-400">IP: {config.boundIp}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {config.activeStaff && (
            <button
              type="button"
              onClick={handleStaffLogout}
              className="h-9 px-3 rounded-xl bg-[#132040] hover:bg-[#1E3261] border border-[#22355E] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-300" />
              <span>تبديل / خروج الموظف</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setUnlockError(null);
              setOwnerPin('');
              setIsUnlockModalOpen(true);
            }}
            className="h-9 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>فك تثبيت الجهاز (PIN المالك)</span>
          </button>
        </div>
      </header>

      {/* Body: Either Staff Terminal Login or Locked Module */}
      {!config.activeStaff ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-6 space-y-5 shadow-xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0C1427] dark:bg-[#EA580C] text-white flex items-center justify-center">
                <MonitorSmartphone className="w-7 h-7" />
              </div>
              <h1 className="text-lg font-black text-[#0C1427] dark:text-[#F7F3EA]">
                دخول موظف الفرع
              </h1>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                هذا الجهاز مثبّت حصرياً على{' '}
                <strong className="text-[#C2410C] dark:text-amber-300">
                  {MODULE_LABELS[config.moduleKey]}
                </strong>{' '}
                لفرع <strong>{config.branchName}</strong>.
              </p>
            </div>

            {loginError && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-400 p-3 text-xs font-black text-rose-800 dark:text-rose-200">
                {loginError}
              </div>
            )}

            <form onSubmit={handleStaffLogin} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">اسم المستخدم (Username)</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: ahmed_cashier"
                  className="w-full h-11 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-left font-bold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">كلمة المرور (Password)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-left font-bold"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-[#EA580C]"
                />
                <span className="font-bold text-[#334155] dark:text-[#CBD5E1]">
                  تذكر اسم المستخدم على هذا الجهاز
                </span>
              </label>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full h-11 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{loggingIn ? 'جاري التحقق والدخول...' : 'دخول وبدء الشغل'}</span>
              </button>
            </form>
          </div>
        </main>
      ) : (
        <main className="flex-1 w-full">
          {config.moduleKey === 'pos' && (
            <SupplierPosView
              profile={synthProfile}
              initialBranchId={config.branchId}
              isKioskLocked
              lockedBranchId={config.branchId}
              kioskStaffName={config.activeStaff.fullName}
              onGoBack={() => {}}
              onGoHome={() => {}}
            />
          )}

          {config.moduleKey === 'warehouse' && (
            <SupplierBranchesWarehouseView
              profile={synthProfile}
              initialBranchId={config.branchId}
              isKioskLocked
              lockedBranchId={config.branchId}
              onGoBack={() => {}}
              onGoHome={() => {}}
            />
          )}

          {config.moduleKey === 'finance' && (
            <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-5">
              {finNotice && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 p-3 text-xs font-black text-emerald-800 dark:text-emerald-200">
                  {finNotice}
                </div>
              )}

              {/* Branch Treasury Balances */}
              <section className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-[#EA580C]" />
                      <span>خزينة فرع: {config.branchName}</span>
                    </h2>
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                      الرصيد الفعلي المتبقي بالفرع قبل توريده واعتماده لدى المالك
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {openShift ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await closePosShift(openShift.id);
                          if (r.success) {
                            setFinNotice('تم إغلاق الوردية بنجاح وتحويل حصيلتها لخزينة الفرع.');
                            playSuccessSound();
                            loadFinanceData();
                          }
                        }}
                        className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
                      >
                        تقفيل الوردية المفتوحة
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await openPosShift(config.branchId, 0);
                          if (r.success) {
                            setFinNotice('تم فتح وردية جديدة للفرع.');
                            playSuccessSound();
                            loadFinanceData();
                          }
                        }}
                        className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
                      >
                        فتح وردية جديدة
                      </button>
                    )}
                  </div>
                </div>

                {finLoading ? (
                  <p className="text-xs font-bold py-4 text-center">جاري تحميل أرصدة الخزينة...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4">
                      <p className="font-bold text-[#475569] dark:text-[#94A3B8]">نقدي (كاش)</p>
                      <p className="text-lg font-black font-mono tabular-nums mt-1">
                        {Number(branchTreasury?.cashBalance || 0).toLocaleString()} ج.م
                      </p>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4">
                      <p className="font-bold text-[#475569] dark:text-[#94A3B8]">إنستا باي (InstaPay)</p>
                      <p className="text-lg font-black font-mono tabular-nums mt-1">
                        {Number(branchTreasury?.instapayBalance || 0).toLocaleString()} ج.م
                      </p>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4">
                      <p className="font-bold text-[#475569] dark:text-[#94A3B8]">محفظة إلكترونية</p>
                      <p className="text-lg font-black font-mono tabular-nums mt-1">
                        {Number(branchTreasury?.walletBalance || 0).toLocaleString()} ج.م
                      </p>
                    </div>
                  </div>
                )}

                {/* Send Treasury Transfer to Owner */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await submitBranchTreasuryTransfer({
                      branchId: config.branchId,
                      cashAmount: transferCash,
                      instapayAmount: transferInstapay,
                      walletAmount: transferWallet,
                      notes: transferNotes,
                    });
                    if (res.success) {
                      playSuccessSound();
                      setFinNotice('تم إرسال طلب توريد الخزينة للمالك (بانتظار ضغطه على تأكيد استلام الفلوس).');
                      setTransferNotes('');
                      loadFinanceData();
                    } else {
                      playErrorSound();
                      setFinNotice(res.error || 'تعذر إرسال التوريد');
                    }
                  }}
                  className="rounded-2xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3 text-xs"
                >
                  <h3 className="font-black text-sm flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-[#EA580C]" />
                    <span>توريد حصيلة الخزينة إلى المالك (توريد نهاية اليوم)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-bold mb-1">كاش مُسلَّم</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={transferCash}
                        onChange={(e) => setTransferCash(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">إنستا باي</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={transferInstapay}
                        onChange={(e) => setTransferInstapay(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">محفظة إلكترونية</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={transferWallet}
                        onChange={(e) => setTransferWallet(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="ملاحظات التوريد (اختياري)..."
                      className="flex-1 min-w-[200px] h-10 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#0D162E] font-bold"
                    />
                    <button
                      type="submit"
                      className="h-10 px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black cursor-pointer"
                    >
                      إرسال التوريد للمالك
                    </button>
                  </div>
                </form>

                {pendingTransfers.length > 0 && (
                  <div className="space-y-2 text-xs">
                    <h4 className="font-black text-[#C2410C] dark:text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>توريدات بانتظار تأكيد المالك ({pendingTransfers.length})</span>
                    </h4>
                    <div className="divide-y divide-[#D4CCBC] dark:divide-[#22355E] rounded-xl bg-white dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
                      {pendingTransfers.map((tr) => (
                        <div key={tr.id} className="p-3 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-black">
                              إجمالي: {Number(tr.totalAmount).toLocaleString()} ج.م
                            </div>
                            <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                              كاش {tr.cashAmount} · إنستاباي {tr.instapayAmount} · محفظة {tr.walletAmount}
                            </div>
                          </div>
                          <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            بانتظار استلام المالك
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      )}

      {/* Owner PIN Unlock Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-5 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-[#D4CCBC] dark:border-[#22355E] pb-3">
              <h3 className="text-sm font-black flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#EA580C]" />
                <span>فك تثبيت الجهاز برقم المالك (PIN)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {unlockError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-400 p-2.5 text-xs font-black text-rose-800 dark:text-rose-200">
                {unlockError}
              </div>
            )}

            <form onSubmit={handleUnlockTerminal} className="space-y-3 text-xs">
              <p className="text-[#475569] dark:text-[#94A3B8]">
                أدخل رمز فك القفل الخاص بالمالك (الافتراضي 1234 ما لم يتم تغييره من لوحة قيادة الفروع):
              </p>
              <input
                type="password"
                required
                autoFocus
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value)}
                placeholder="PIN المالك"
                className="w-full h-11 px-3 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono text-center text-base font-black tracking-widest"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsUnlockModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={unlocking}
                  className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black cursor-pointer"
                >
                  {unlocking ? 'جاري التحقق...' : 'فك التثبيت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
