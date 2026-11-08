import React, { useState, useEffect } from 'react';
import { AdminCostRecord, UserProfile, RecurringExpenseItem } from '../../types';
import { tenantStorage } from '../../db/dexieDB';
import {
  X,
  Building,
  Plus,
  Trash2,
  Calendar,
  Zap,
  Droplet,
  Home,
  Wifi,
  DollarSign,
  TrendingDown,
  Coins,
  ArrowRightLeft,
  Repeat,
  CheckCircle2,
  AlertCircle,
  Clock,
  Power,
  BellRing,
  Check,
  CreditCard,
  Layers,
  Wrench,
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';
import {
  SUPPORTED_CURRENCIES,
  getOrInitExchangeRates,
  convertToBaseCurrency,
  formatCurrencyAmount,
} from '../../lib/currency';
import { ExchangeRatesModal } from '../currency/ExchangeRatesModal';
import { useTranslation } from '../../lib/i18n';
import {
  DisbursementSourceSelector,
  SelectedDisbursementSource,
  recordDisbursementExitTransaction,
} from '../treasuries/DisbursementSourceSelector';
import { isMonthClosed } from '../../lib/monthClosure';
import {
  getRecurringExpenses,
  saveRecurringExpense,
  deleteRecurringExpense,
  toggleRecurringExpenseActive,
  payRecurringExpense,
  checkUpcomingRecurringExpenses,
  DueRecurringExpenseStatus,
} from '../../services/recurringExpensesService';

interface AdminExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

export const AdminExpensesModal: React.FC<AdminExpensesModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  const { t: tr, lang } = useTranslation();
  const baseCurrency = profile.currencySymbol || 'EGP';

  // Navigation tab: actual vs recurring
  const [activeTab, setActiveTab] = useState<'actual' | 'recurring'>('actual');

  // Actual Expenses state
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [expenses, setExpenses] = useState<AdminCostRecord[]>([]);

  // Multi-currency state
  const [currency, setCurrency] = useState<string>(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [dailyRates, setDailyRates] = useState<Record<string, number>>({});
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);

  // Form for actual expense
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'rent' | 'electricity' | 'water' | 'internet_office' | 'other'>('rent');
  const [amount, setAmount] = useState<number>(500);
  const [notes, setNotes] = useState('');
  const [selectedSource, setSelectedSource] = useState<SelectedDisbursementSource>({
    id: 'main',
    name: 'الخزينة الرئيسية (النقدية)',
    kind: 'main',
    availableCash: 0,
    availableWallet: 0,
    availableInstapay: 0,
    totalBalance: 0,
  });
  const [paymentChannel, setPaymentChannel] = useState<'cash' | 'instapay' | 'wallet'>('cash');

  // Recurring Expenses state
  const [recurringItems, setRecurringItems] = useState<DueRecurringExpenseStatus[]>([]);
  const [recurringSummary, setRecurringSummary] = useState<{ urgentCount: number; totalUrgentAmount: number }>({
    urgentCount: 0,
    totalUrgentAmount: 0,
  });
  const [isAddingRecurring, setIsAddingRecurring] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recCategory, setRecCategory] = useState<'rent' | 'electricity' | 'water' | 'internet_office' | 'maintenance' | 'other'>('rent');
  const [recAmount, setRecAmount] = useState<number>(500);
  const [recFrequency, setRecFrequency] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [recDueDay, setRecDueDay] = useState<number>(1);
  const [recPaymentChannel, setRecPaymentChannel] = useState<'cash' | 'instapay' | 'wallet'>('cash');
  const [recNotes, setRecNotes] = useState('');
  const [payingItemId, setPayingItemId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 4000);
  };

  const loadData = async () => {
    try {
      const [records, rates] = await Promise.all([
        tenantStorage.getAdminCosts(tenantId, selectedMonth),
        getOrInitExchangeRates(tenantId),
      ]);
      setExpenses(records);
      const ratesMap: Record<string, number> = {};
      rates.forEach((r) => {
        ratesMap[r.currency] = r.rateAgainstBase || r.rateToBase || 1;
      });
      setDailyRates(ratesMap);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecurringData = async () => {
    try {
      const summary = await checkUpcomingRecurringExpenses(tenantId);
      setRecurringItems(summary.dueItems);
      setRecurringSummary({
        urgentCount: summary.urgentCount,
        totalUrgentAmount: summary.totalUrgentAmount,
      });
    } catch (err) {
      console.warn('Load recurring expenses error:', err);
    }
  };

  const isLocked = isMonthClosed(tenantId, selectedMonth);

  useEffect(() => {
    loadData();
    loadRecurringData();
  }, [tenantId, selectedMonth]);

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      alert('لا يمكن إضافة مصروف في شهر مالي معتمد ومقفل رقابياً.');
      return;
    }
    if (!title.trim() || amount <= 0) return;

    const rate = currency === baseCurrency ? 1.0 : (Number(exchangeRate) || dailyRates[currency] || 1.0);
    const baseCurrencyAmount = currency === baseCurrency
      ? amount
      : Math.round(amount * rate * 100) / 100;

    let serial = 'TX-' + Date.now().toString().slice(-6);
    try {
      serial = await recordDisbursementExitTransaction({
        tenantId,
        sourceId: selectedSource.id,
        sourceName: selectedSource.name,
        sourceKind: selectedSource.kind,
        holderName: selectedSource.holderName,
        channel: paymentChannel,
        amount: baseCurrencyAmount,
        recipientName: title.trim(),
        category,
        title: `صرف مصروف: ${title.trim()}`,
        notes: notes.trim(),
        userEmail: profile.email || 'system',
      });
    } catch (safeErr) {
      console.warn('Safe transaction record notice:', safeErr);
    }

    const channelLabel = paymentChannel === 'cash' ? 'نقدي (كاش)' : paymentChannel === 'instapay' ? 'إنستاباي / بنك' : 'محفظة إلكترونية';
    const sourceTag = `[سيريال: ${serial}] [المصدر: ${selectedSource.name}] [وعاء الدفع: ${channelLabel}]`;

    const newCost: AdminCostRecord = {
      id: 'adm_' + Date.now(),
      tenantId,
      title: title.trim(),
      category,
      amount,
      currency,
      exchangeRate: rate,
      baseCurrencyAmount,
      safeType: selectedSource.kind === 'main' ? 'main' : 'sub',
      month: selectedMonth,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: `${notes.trim()} ${sourceTag}`.trim(),
    };

    await tenantStorage.addAdminCost(newCost);

    setTitle('');
    setAmount(100);
    setNotes('');
    setCurrency(baseCurrency);
    setExchangeRate(1.0);
    loadData();
    showToast('تم تسجيل المصروف الإداري وترحيله بنجاح! ✅');
  };

  const handleDelete = async (id: string) => {
    if (isLocked) {
      alert('لا يمكن حذف مصروف من شهر مالي معتمد ومقفل رقابياً.');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    await tenantStorage.deleteAdminCost(tenantId, id);
    loadData();
  };

  // Recurring Handlers
  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim() || recAmount <= 0) return;

    try {
      await saveRecurringExpense(tenantId, {
        title: recTitle.trim(),
        category: recCategory,
        amount: recAmount,
        frequency: recFrequency,
        dueDayOfMonth: recDueDay,
        preferredPaymentChannel: recPaymentChannel,
        notes: recNotes.trim(),
        isActive: true,
      });

      setRecTitle('');
      setRecAmount(500);
      setRecNotes('');
      setIsAddingRecurring(false);
      await loadRecurringData();
      showToast('تمت إضافة بند المصروف الدوري بنجاح! 🔁');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ المصروف الدوري');
    }
  };

  const handleToggleRecurringActive = async (id: string) => {
    try {
      await toggleRecurringExpenseActive(tenantId, id);
      await loadRecurringData();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleDeleteRecurringItem = async (id: string) => {
    if (!window.confirm('هل تريد بالتأكيد حذف هذا المصروف الدوري من المتتبع؟')) return;
    try {
      await deleteRecurringExpense(tenantId, id);
      await loadRecurringData();
      showToast('تم حذف البند من المتتبع الدوري.');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const handlePayRecurringItem = async (item: DueRecurringExpenseStatus) => {
    if (isLocked) {
      alert('لا يمكن ترحيل سداد في شهر مالي معتمد ومقفل رقابياً.');
      return;
    }
    setPayingItemId(item.id);
    try {
      const res = await payRecurringExpense(tenantId, item.id, {
        sourceId: selectedSource.id,
        sourceName: selectedSource.name,
        sourceKind: selectedSource.kind,
        holderName: selectedSource.holderName,
        channel: item.preferredPaymentChannel || paymentChannel,
        userEmail: profile.email || 'system',
      });

      showToast(`تم سداد "${res.title}" بقيمة ${res.amount} ج.م وترحيله للخزينة بنجاح! 💸✅`);
      await Promise.all([loadData(), loadRecurringData()]);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء سداد البند');
    } finally {
      setPayingItemId(null);
    }
  };

  // Grouped breakdown (aggregated in base currency)
  const totalMonthExpenses = expenses.reduce((sum, e) => sum + (e.baseCurrencyAmount || e.amount || 0), 0);
  const estimatedPiecesPerMonth = 25;
  const suggestedSharePerPiece = Math.round(totalMonthExpenses / estimatedPiecesPerMonth);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'rent':
        return <Home className="w-4 h-4 text-amber-600" />;
      case 'electricity':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'water':
        return <Droplet className="w-4 h-4 text-blue-500" />;
      case 'internet_office':
        return <Wifi className="w-4 h-4 text-emerald-500" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-purple-500" />;
      default:
        return <Building className="w-4 h-4 text-stone-500" />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'rent': return 'إيجار الورشة';
      case 'electricity': return 'كهرباء وإنارة';
      case 'water': return 'مياه ومرافق';
      case 'internet_office': return 'إنترنت واتصالات';
      case 'maintenance': return 'صيانة دورية';
      default: return 'مصروفات أخرى';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-amber-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 p-5 sm:p-7 relative text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              <span>دفتر التكاليف والمصروفات الإدارية الموحدة</span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              إدارة الإيجار، المرافق، وتتبع الالتزامات الدورية مع تنبيهات السيولة الذكية
            </p>
          </div>
        </div>

        {/* Action Toast Feedback */}
        {toastNotice && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastNotice}</span>
          </div>
        )}

        {/* Tab Toggle Navigation */}
        <div className="mt-4 flex items-center p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
          <button
            type="button"
            onClick={() => setActiveTab('actual')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'actual'
                ? 'bg-white dark:bg-stone-900 text-amber-800 dark:text-amber-300 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>المصروفات الفعلية المسجلة 📋</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'recurring'
                ? 'bg-white dark:bg-stone-900 text-amber-800 dark:text-amber-300 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>متتبع المصروفات الدورية والتنبيهات 🔁🔔</span>
            {recurringSummary.urgentCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                {recurringSummary.urgentCount}
              </span>
            )}
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: ACTUAL RECORDED EXPENSES */}
        {/* ======================================================== */}
        {activeTab === 'actual' && (
          <div className="space-y-4">
            {/* Month Selector & Summary Bar */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-md">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white/20 border border-white/25 text-white font-mono text-xs font-bold outline-none"
                />
              </div>
              <div className="text-left font-mono">
                <span className="text-xs text-amber-200 block">إجمالي تكاليف الشهر الإدارية:</span>
                <span className="text-2xl font-black">
                  {totalMonthExpenses.toLocaleString('ar-EG')} {profile.currencySymbol}
                </span>
              </div>
            </div>

            {/* Suggested per-piece allocation notice */}
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span>نصيب القطعة المقترح بحاسبة الإنتاج (معدل 25 قطعة/شهر):</span>
              </div>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                ~ {suggestedSharePerPiece} {profile.currencySymbol} / قطعة
              </span>
            </div>

            {/* Locked Month Notice */}
            {isLocked && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <span>🔒 تنبيه رقابي: هذا الشهر المالي معتمد ومقفل رقابياً - السجلات للقراءة والمراجعة فقط ولا يمكن إضافة أو حذف مصروفات.</span>
              </div>
            )}

            {/* Add cost form */}
            <form onSubmit={handleAddCost} className="p-4 rounded-2xl bg-amber-50/50 dark:bg-stone-800/40 border border-amber-200/60 dark:border-stone-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل مصروف إداري جديد للشهر المختار:</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsRatesModalOpen(true)}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>أسعار الصرف اليومية</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="بيان المصروف (مثال: إيجار ورشة، فاتورة نور، إنترنت)"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs outline-none"
                  />
                </div>
                <div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                  >
                    <option value="rent">إيجار الورشة</option>
                    <option value="electricity">كهرباء وإنارة</option>
                    <option value="water">مياه ومرافق</option>
                    <option value="internet_office">إنترنت ومكتب</option>
                    <option value="other">مصاريف أخرى</option>
                  </select>
                </div>
              </div>

              {/* Currency selection & Amount row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 mb-1">العملة:</label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      const c = e.target.value;
                      setCurrency(c);
                      setExchangeRate(c === baseCurrency ? 1.0 : (dailyRates[c] || 1.0));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.nameAr} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-500 mb-1">المبلغ:</label>
                  <NumberInput
                    min={0}
                    step={1}
                    value={amount}
                    onChange={(v) => setAmount(Number(v))}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold font-mono outline-none"
                  />
                </div>

                <div>
                  {currency !== baseCurrency ? (
                    <>
                      <label className="block text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1">سعر الصرف:</label>
                      <NumberInput
                        min={0.0001}
                        step={0.01}
                        value={exchangeRate}
                        onChange={(v) => setExchangeRate(Number(v))}
                        className="w-full px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-stone-850 text-xs font-bold font-mono outline-none"
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-[11px] font-bold text-stone-500 mb-1">طريقة الدفع:</label>
                      <select
                        value={paymentChannel}
                        onChange={(e) => setPaymentChannel(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                      >
                        <option value="cash">نقدي (كاش)</option>
                        <option value="instapay">إنستاباي / بنكي</option>
                        <option value="wallet">محفظة ذكية</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Disbursement Source Selector */}
              <DisbursementSourceSelector
                workshopId={tenantId}
                currencySymbol={baseCurrency}
                selectedSourceId={selectedSource.id}
                onSourceChange={setSelectedSource}
                selectedChannel={paymentChannel}
                onChannelChange={setPaymentChannel}
                disbursedAmount={currency === baseCurrency ? amount : Math.round(amount * (Number(exchangeRate) || 1) * 100) / 100}
                label="من أي خزينة أو عهدة تم الصرف؟ *"
              />

              <button
                type="submit"
                disabled={isLocked}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-stone-400 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {isLocked ? 'الشهر المالي مقفل رقابياً (للقراءة فقط)' : 'إضافة المصروف للدورة المالية'}
              </button>
            </form>

            {/* Expenses List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-stone-500 flex items-center justify-between">
                <span>سجل المصروفات الفعلية لشهر {selectedMonth}:</span>
                <span>({expenses.length} حركة)</span>
              </h3>
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs bg-stone-50 dark:bg-stone-800/30 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
                  لا توجد مصاريف إدارية مسجلة لشهر {selectedMonth}.
                </div>
              ) : (
                expenses.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-100/70 dark:bg-amber-950/60">
                        {getCategoryIcon(e.category)}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 dark:text-stone-100">{e.title}</h4>
                        <p className="text-[10px] text-stone-400">
                          {e.paymentDate} {e.notes && `• ${e.notes}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left font-mono">
                        <span className="font-bold text-stone-800 dark:text-stone-200 text-sm block">
                          {e.amount} {e.currency || baseCurrency}
                        </span>
                        {e.currency && e.currency !== baseCurrency && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">
                            (~ {e.baseCurrencyAmount || e.amount} {baseCurrency})
                          </span>
                        )}
                      </div>
                      {!isLocked ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 transition cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-stone-400 font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800">
                          مقفل
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: RECURRING EXPENSES TRACKER & 3-DAY ALERTS */}
        {/* ======================================================== */}
        {activeTab === 'recurring' && (
          <div className="space-y-4">
            {/* Proactive 3-Day Alert Banner */}
            {recurringSummary.urgentCount > 0 ? (
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white shadow-lg border border-rose-500/50 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white/20 text-rose-200 shrink-0">
                    <BellRing className="w-5 h-5 animate-bounce" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-sm text-rose-100 flex items-center gap-2">
                      <span>⚠️ تنبيه استباقي للسيولة ومواعيد الاستحقاق (أقل من 3 أيام)</span>
                    </h4>
                    <p className="text-xs text-rose-100/90 mt-1 leading-relaxed">
                      لديك <span className="font-black underline">{recurringSummary.urgentCount}</span> التزامات دورية مستحقة اليوم أو خلال الـ 3 أيام القادمة بإجمالي مطلوب تدبيره:
                      <span className="font-mono font-black text-amber-300 text-sm mr-1">
                        {recurringSummary.totalUrgentAmount.toLocaleString('ar-EG')} {baseCurrency}
                      </span>
                    </p>
                    <p className="text-[11px] text-rose-200/80 mt-1">
                      💡 يرجى التأكد من توفر رصيد كافٍ بالخزينة لتفادي تعطل خدمات المشغل أو فرض غرامات تأخير.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>جميع الالتزامات الدورية مستقرة ومسددة، ولا توجد استحقاقات حرجة خلال الـ 3 أيام القادمة.</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 font-black">
                  سيولة آمنة ✅
                </span>
              </div>
            )}

            {/* Quick Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-stone-850 border border-amber-200/70 dark:border-stone-800">
                <span className="text-[10px] text-stone-500 font-bold block">إجمالي الالتزامات الدورية:</span>
                <span className="font-mono font-black text-amber-900 dark:text-amber-300 text-base">
                  {recurringItems.reduce((s, it) => s + (it.isActive ? it.amount : 0), 0).toLocaleString('ar-EG')} {baseCurrency}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-stone-850 border border-rose-200/70 dark:border-stone-800">
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">المستحق خلال 3 أيام أو متأخر:</span>
                <span className="font-mono font-black text-rose-700 dark:text-rose-300 text-base">
                  {recurringSummary.totalUrgentAmount.toLocaleString('ar-EG')} {baseCurrency}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-emerald-50/70 dark:bg-stone-850 border border-emerald-200/70 dark:border-stone-800">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">المسدد لهذا الشهر:</span>
                <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-base">
                  {recurringItems.filter(it => it.isPaidThisMonth).reduce((s, it) => s + it.amount, 0).toLocaleString('ar-EG')} {baseCurrency}
                </span>
              </div>
            </div>

            {/* Add Recurring Button / Collapsible Form */}
            {!isAddingRecurring ? (
              <button
                type="button"
                onClick={() => setIsAddingRecurring(true)}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة التزام دوري جديد للمتتبع (إيجار / مرافق / صيانة)</span>
              </button>
            ) : (
              <form onSubmit={handleCreateRecurring} className="p-4 rounded-2xl bg-amber-50/60 dark:bg-stone-800/40 border border-amber-300/70 dark:border-stone-700 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/70 dark:border-stone-700">
                  <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>تسجيل التزام دوري متكرر:</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingRecurring(false)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">اسم الالتزام الدوري *</label>
                    <input
                      type="text"
                      required
                      value={recTitle}
                      onChange={(e) => setRecTitle(e.target.value)}
                      placeholder="مثال: إيجار ورشة المعادي، اشتراك باقة فودافون..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">التصنيف</label>
                    <select
                      value={recCategory}
                      onChange={(e) => setRecCategory(e.target.value as any)}
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                    >
                      <option value="rent">إيجار الورشة</option>
                      <option value="electricity">كهرباء وإنارة</option>
                      <option value="water">مياه ومرافق</option>
                      <option value="internet_office">إنترنت واتصالات</option>
                      <option value="maintenance">صيانة دورية</option>
                      <option value="other">مصروف آخر</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">القيمة (ج.م) *</label>
                    <NumberInput
                      min={1}
                      value={recAmount}
                      onChange={(v) => setRecAmount(Number(v))}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">دورية السداد</label>
                    <select
                      value={recFrequency}
                      onChange={(e) => setRecFrequency(e.target.value as any)}
                      className="w-full px-2 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                    >
                      <option value="monthly">شهرياً</option>
                      <option value="quarterly">كل 3 شهور</option>
                      <option value="annual">سنوياً</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">يوم الاستحقاق</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-stone-400 font-bold">يوم</span>
                      <NumberInput
                        min={1}
                        max={31}
                        value={recDueDay}
                        onChange={(v) => setRecDueDay(Number(v))}
                        className="w-full px-2 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold font-mono outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">قناة السداد المفضلة</label>
                    <select
                      value={recPaymentChannel}
                      onChange={(e) => setRecPaymentChannel(e.target.value as any)}
                      className="w-full px-2 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
                    >
                      <option value="cash">كاش (نقدي)</option>
                      <option value="instapay">إنستاباي / بنكي</option>
                      <option value="wallet">محفظة ذكية</option>
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={recNotes}
                    onChange={(e) => setRecNotes(e.target.value)}
                    placeholder="ملاحظات إضافية (كود السداد، اسم المالك، رقم الحساب...)"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingRecurring(false)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 dark:hover:bg-stone-800 transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition cursor-pointer"
                  >
                    حفظ الالتزام الدوري 💾
                  </button>
                </div>
              </form>
            )}

            {/* Recurring Items List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-stone-500 flex items-center justify-between">
                <span>جدول الالتزامات الدورية ومواعيد الاستحقاق:</span>
                <span>({recurringItems.length} بنود مسجلة)</span>
              </h4>

              {recurringItems.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs bg-stone-50 dark:bg-stone-800/30 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
                  لا توجد التزامات دورية مسجلة حالياً.
                </div>
              ) : (
                recurringItems.map((item) => {
                  const isUrgent = !item.isPaidThisMonth && (item.daysRemaining <= 3 || item.isOverdue);
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        !item.isActive
                          ? 'opacity-60 bg-stone-50/50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800'
                          : item.isPaidThisMonth
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                          : isUrgent
                          ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 shadow-xs'
                          : 'bg-white dark:bg-stone-800/60 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Title & Info */}
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            item.isPaidThisMonth
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : isUrgent
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 animate-pulse'
                              : 'bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {getCategoryIcon(item.category)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-xs text-stone-900 dark:text-stone-100">
                                {item.title}
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                                {getCategoryLabel(item.category)}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                {item.frequency === 'monthly' ? 'شهري' : item.frequency === 'quarterly' ? 'ربع سنوي' : 'سنوي'}
                              </span>
                              {!item.isActive && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                                  موقوف مؤقتاً
                                </span>
                              )}
                            </div>

                            {/* Due date notice & status badge */}
                            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="text-stone-500 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-stone-400" />
                                <span>استحقاق يوم {item.dueDayOfMonth} من كل شهر</span>
                              </span>
                              <span>•</span>
                              <span className={`font-black ${
                                item.isPaidThisMonth
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : isUrgent
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}>
                                {item.urgentNoticeText}
                              </span>
                            </div>

                            {item.notes && (
                              <p className="text-[10px] text-stone-400 mt-0.5">{item.notes}</p>
                            )}
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
                          <div className="text-right sm:text-left font-mono">
                            <span className="font-black text-stone-900 dark:text-stone-100 text-sm block">
                              {item.amount.toLocaleString('ar-EG')} {baseCurrency}
                            </span>
                            <span className="text-[10px] text-stone-400 block">
                              {item.preferredPaymentChannel === 'instapay'
                                ? 'إنستاباي'
                                : item.preferredPaymentChannel === 'wallet'
                                ? 'محفظة'
                                : 'نقدي'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Quick Pay Button */}
                            {!item.isPaidThisMonth && item.isActive && (
                              <button
                                type="button"
                                disabled={payingItemId === item.id || isLocked}
                                onClick={() => handlePayRecurringItem(item)}
                                className="px-3 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-sm flex items-center gap-1 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                title="سداد فوري وترحيل للخزينة"
                              >
                                {payingItemId === item.id ? (
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <CreditCard className="w-3.5 h-3.5" />
                                )}
                                <span>سداد وترحيل 💸</span>
                              </button>
                            )}

                            {/* Toggle Active Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleRecurringActive(item.id)}
                              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                                item.isActive
                                  ? 'text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 border-stone-200 dark:border-stone-700'
                                  : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                              }`}
                              title={item.isActive ? 'إيقاف مؤقت' : 'تفعيل'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteRecurringItem(item.id)}
                              className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-stone-200 dark:border-stone-700 transition cursor-pointer"
                              title="حذف نهائي"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <ExchangeRatesModal
        isOpen={isRatesModalOpen}
        onClose={() => {
          setIsRatesModalOpen(false);
          loadData();
        }}
        profile={profile}
      />
    </div>
  );
};
