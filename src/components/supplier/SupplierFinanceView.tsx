import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import {
  SupplierTreasury,
  SupplierTreasuryTransaction,
  SupplierExpense,
  SUPPLIER_EXPENSE_CATEGORIES,
} from '../../types/supplier';
import {
  fetchSupplierFinance,
  createSupplierTreasury,
  recordSupplierTreasuryTx,
  addSupplierExpense,
  deleteSupplierExpense,
} from '../../db/supplierService';
import {
  ArrowRight,
  X,
  Wallet,
  Plus,
  Trash2,
  Coins,
  Receipt,
  ArrowLeftRight,
} from 'lucide-react';
import { useExperienceMode } from '../../types/experienceMode';

interface SupplierFinanceViewProps {
  profile: UserProfile;
  onGoBack: () => void;
  onGoHome: () => void;
}

const CHANNEL_LABELS: Record<SupplierTreasury['channelType'], string> = {
  cash: 'نقدي / كاش',
  instapay: 'إنستا باي',
  vodafone_cash: 'محفظة إلكترونية',
  bank: 'حساب بنكي',
  other: 'أخرى',
};

export const SupplierFinanceView: React.FC<SupplierFinanceViewProps> = ({
  profile,
  onGoBack,
  onGoHome,
}) => {
  const currencySymbol = profile.currencySymbol || 'ج.م';
  const {
    mode: expMode,
    setMode: setExpMode,
    isCraft,
    allowSwitch: allowExpSwitch,
    getLabel: getModeLabel,
    isVisible: isModeVisible,
  } = useExperienceMode('supplier', profile);
  const showLedgerTab = isModeVisible('sup_ledger_tab');
  const [tab, setTab] = useState<'treasuries' | 'expenses' | 'ledger'>('treasuries');

  useEffect(() => {
    if (!showLedgerTab && tab === 'ledger') {
      setTab('treasuries');
    }
  }, [showLedgerTab, tab]);
  const [treasuries, setTreasuries] = useState<SupplierTreasury[]>([]);
  const [transactions, setTransactions] = useState<SupplierTreasuryTransaction[]>([]);
  const [expenses, setExpenses] = useState<SupplierExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // New Treasury form
  const [trName, setTrName] = useState('');
  const [trChannel, setTrChannel] = useState<SupplierTreasury['channelType']>('cash');
  const [trBalance, setTrBalance] = useState(0);

  // Manual deposit/withdrawal form
  const [txTreasuryId, setTxTreasuryId] = useState('');
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState(0);
  const [txDesc, setTxDesc] = useState('');

  // New Expense form
  const [exCategory, setExCategory] = useState(SUPPLIER_EXPENSE_CATEGORIES[0]);
  const [exAmount, setExAmount] = useState(0);
  const [exTreasuryId, setExTreasuryId] = useState('');
  const [exDate, setExDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exNotes, setExNotes] = useState('');

  const loadFinance = async () => {
    setLoading(true);
    const data = await fetchSupplierFinance();
    setTreasuries(data.treasuries);
    setTransactions(data.transactions);
    setExpenses(data.expenses);
    if (data.treasuries[0]) {
      setTxTreasuryId((prev) => prev || data.treasuries[0].id);
      setExTreasuryId((prev) => prev || data.treasuries[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const handleAddTreasury = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trName.trim()) return;
    const res = await createSupplierTreasury({
      name: trName.trim(),
      channelType: trChannel,
      balance: Number(trBalance || 0),
      currency: profile.currency || 'EGP',
    });
    if (res.success) {
      setTrName('');
      setTrBalance(0);
      await loadFinance();
    }
  };

  const handleManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTreasuryId || txAmount <= 0) return;
    const res = await recordSupplierTreasuryTx({
      treasuryId: txTreasuryId,
      txType,
      amount: Number(txAmount),
      description: txDesc.trim() || (txType === 'deposit' ? 'إيداع يدوي' : 'سحب يدوي'),
    });
    if (res.success) {
      setTxAmount(0);
      setTxDesc('');
      await loadFinance();
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exAmount <= 0) return;
    const res = await addSupplierExpense({
      category: exCategory,
      amount: Number(exAmount),
      treasuryId: exTreasuryId || null,
      expenseDate: exDate,
      notes: exNotes.trim(),
    });
    if (res.success) {
      setExAmount(0);
      setExNotes('');
      await loadFinance();
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const ok = await deleteSupplierExpense(id);
    if (ok) {
      await loadFinance();
    }
  };

  const totalBalance = treasuries.reduce((s, t) => s + Number(t.balance || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5 text-right" dir="rtl">
      {/* Header with Back & Close */}
      <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-[#EA580C] text-xs font-black cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>رجوع</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0C1427] dark:text-[#F7F3EA] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#EA580C]" />
              <span>{getModeLabel('sup_finance_title', 'خزائن المورد والمصروفات والحسابات')}</span>
            </h1>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              {isCraft ? 'الفلوس اللي في خزنتك دلوقتي:' : 'الرصيد المتاح:'}{' '}
              <strong className="font-mono tabular-nums">{totalBalance.toLocaleString()} {currencySymbol}</strong> •{' '}
              {isCraft ? 'إجمالي اللي صرفته:' : 'إجمالي المصروفات:'}{' '}
              <strong className="font-mono tabular-nums text-rose-600 dark:text-rose-400">
                {totalExpenses.toLocaleString()} {currencySymbol}
              </strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {allowExpSwitch && (
            <div className="inline-flex items-center p-0.5 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E]">
              <button
                type="button"
                onClick={() => setExpMode('craft')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                  isCraft ? 'bg-emerald-600 text-white' : 'text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                الوضع الحرفي
              </button>
              <button
                type="button"
                onClick={() => setExpMode('accounting')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                  !isCraft ? 'bg-indigo-600 text-white' : 'text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                الوضع المحاسبي
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onGoHome}
            aria-label="إغلاق"
            title="إغلاق"
            className="w-8 h-8 rounded-xl bg-[#EFE9DC] dark:bg-[#132040] border border-[#D4CCBC] dark:border-[#22355E] hover:border-rose-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'treasuries' as const, label: isCraft ? 'الخزنة والفلوس' : 'الخزائن والأرصدة', icon: Wallet, visible: true },
          { id: 'expenses' as const, label: isCraft ? 'مصاريف المحل' : 'المصروفات التشغيلية', icon: Coins, visible: true },
          {
            id: 'ledger' as const,
            label: getModeLabel('sup_ledger_tab', 'سجل الحركات المالية'),
            icon: ArrowLeftRight,
            visible: showLedgerTab,
          },
        ]
          .filter((t) => t.visible)
          .map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border flex items-center gap-1.5 cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#0C1427] dark:bg-[#EA580C] text-white border-transparent'
                    : 'bg-[#F7F3EA] dark:bg-[#0D162E] border-[#D4CCBC] dark:border-[#22355E] text-[#334155] dark:text-[#CBD5E1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-[#475569] dark:text-[#94A3B8]">
          جاري تحميل البيانات المالية...
        </div>
      ) : tab === 'treasuries' ? (
        <div className="space-y-5">
          {/* Treasuries Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {treasuries.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-2"
              >
                <div className="text-[11px] font-bold text-[#C2410C] dark:text-amber-300">
                  {CHANNEL_LABELS[t.channelType] || t.channelType}
                </div>
                <div className="text-sm font-black text-[#0C1427] dark:text-[#F7F3EA]">{t.name}</div>
                <div className="text-lg font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  {Number(t.balance).toLocaleString()} {currencySymbol}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Add Treasury */}
            <form
              onSubmit={handleAddTreasury}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3 text-xs"
            >
              <div className="font-black text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#EA580C]" />
                <span>إضافة خزينة / محفظة جديدة</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={trName}
                  onChange={(e) => setTrName(e.target.value)}
                  placeholder="الاسم (مثال: إنستا باي)"
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
                <select
                  value={trChannel}
                  onChange={(e) => setTrChannel(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                >
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={trBalance}
                  onChange={(e) => setTrBalance(Number(e.target.value))}
                  placeholder="رصيد افتتاحي"
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0C1427] dark:bg-[#EA580C] text-white font-black cursor-pointer"
              >
                حفظ الخزينة
              </button>
            </form>

            {/* Manual Deposit / Withdraw */}
            <form
              onSubmit={handleManualTx}
              className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 space-y-3 text-xs"
            >
              <div className="font-black text-sm flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-[#EA580C]" />
                <span>إيداع أو سحب يدوي</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={txTreasuryId}
                  onChange={(e) => setTxTreasuryId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                >
                  {treasuries.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                >
                  <option value="deposit">{getModeLabel('sup_debit', 'إيداع (+)')}</option>
                  <option value="withdrawal">{getModeLabel('sup_credit', 'سحب (-)')}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={txAmount}
                  onChange={(e) => setTxAmount(Number(e.target.value))}
                  placeholder="المبلغ"
                  className="px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="البيان / سبب الحركة"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer"
                >
                  تنفيذ الحركة
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : tab === 'expenses' ? (
        <div className="space-y-4 text-xs">
          <form
            onSubmit={handleAddExpense}
            className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] p-4 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end"
          >
            <div>
              <label className="block font-bold mb-1">بند المصروف</label>
              <select
                value={exCategory}
                onChange={(e) => setExCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              >
                {SUPPLIER_EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">المبلغ ({currencySymbol})</label>
              <input
                type="number"
                min={1}
                required
                value={exAmount}
                onChange={(e) => setExAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">الخزينة</label>
              <select
                value={exTreasuryId}
                onChange={(e) => setExTreasuryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              >
                {treasuries.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">التاريخ وملاحظات</label>
              <input
                type="text"
                value={exNotes}
                onChange={(e) => setExNotes(e.target.value)}
                placeholder="ملاحظة مختصرة..."
                className="w-full px-3 py-2 rounded-xl border border-[#D4CCBC] dark:border-[#22355E] bg-white dark:bg-[#132040] font-bold"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#EA580C] text-white font-black cursor-pointer h-[38px]"
            >
              تسجيل المصروف
            </button>
          </form>

          <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E]">
            {expenses.length === 0 ? (
              <p className="p-8 text-center text-[#475569] dark:text-[#94A3B8]">لا توجد مصروفات مسجلة بعد.</p>
            ) : (
              expenses.map((ex) => (
                <div key={ex.id} className="p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-black text-[#0C1427] dark:text-[#F7F3EA]">{ex.category}</div>
                    <div className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      {ex.expenseDate} {ex.notes ? `• ${ex.notes}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                      {Number(ex.amount).toLocaleString()} {currencySymbol}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(ex.id)}
                      className="text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#F7F3EA] dark:bg-[#0D162E] border border-[#D4CCBC] dark:border-[#22355E] divide-y divide-[#D4CCBC]/60 dark:divide-[#22355E] text-xs">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-[#475569] dark:text-[#94A3B8] flex flex-col items-center gap-2">
              <Receipt className="w-5 h-5 text-[#EA580C]" />
              <span>لا توجد حركات مالية مسجلة حتى الآن.</span>
            </div>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.txType === 'income' || tx.txType === 'deposit';
              return (
                <div key={tx.id} className="p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-black text-[#0C1427] dark:text-[#F7F3EA]">{tx.description}</div>
                    <div className="text-[10px] text-[#475569] dark:text-[#94A3B8] font-mono">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString('ar-EG') : ''}
                    </div>
                  </div>
                  <div
                    className={`font-mono tabular-nums font-black ${
                      isCredit
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isCredit ? '+' : '-'}
                    {Number(tx.amount).toLocaleString()} {currencySymbol}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
