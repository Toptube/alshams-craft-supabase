import React, { useState, useEffect } from 'react';
import { AdminCostRecord, UserProfile } from '../../types';
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

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [expenses, setExpenses] = useState<AdminCostRecord[]>([]);

  // Multi-currency state
  const [currency, setCurrency] = useState<string>(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [dailyRates, setDailyRates] = useState<Record<string, number>>({});
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'rent' | 'electricity' | 'water' | 'internet_office' | 'other'>('rent');
  const [amount, setAmount] = useState<number>(500);
  const [notes, setNotes] = useState('');

  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';

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

  useEffect(() => {
    loadData();
  }, [tenantId, selectedMonth]);

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) return;

    const rate = currency === baseCurrency ? 1.0 : (Number(exchangeRate) || dailyRates[currency] || 1.0);
    const baseCurrencyAmount = currency === baseCurrency
      ? amount
      : Math.round(amount * rate * 100) / 100;

    const newCost: AdminCostRecord = {
      id: 'adm_' + Date.now(),
      tenantId,
      title: title.trim(),
      category,
      amount,
      currency,
      exchangeRate: rate,
      baseCurrencyAmount,
      safeType: 'main',
      month: selectedMonth,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: notes.trim(),
    };

    await tenantStorage.addAdminCost(newCost);
    setTitle('');
    setAmount(100);
    setNotes('');
    setCurrency(baseCurrency);
    setExchangeRate(1.0);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await tenantStorage.deleteAdminCost(tenantId, id);
    loadData();
  };

  // Grouped breakdown (aggregated in base currency)
  const totalMonthExpenses = expenses.reduce((sum, e) => sum + (e.baseCurrencyAmount || e.amount || 0), 0);

  // Suggested per-piece allocation assuming an artisan produces ~25 pieces/month
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
      default:
        return <Building className="w-4 h-4 text-stone-500" />;
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
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              <span>دفتر التكاليف الإدارية الموحدة (جنيه)</span>
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              تجميع الإيجار، الكهرباء، المياه، ومصاريف الاستوديو مع تدقيق كامل لكل حركة
            </p>
          </div>
        </div>

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
              {totalMonthExpenses} {profile.currencySymbol}
            </span>
          </div>
        </div>

        {/* Suggested per-piece allocation notice */}
        <div className="mt-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
            <TrendingDown className="w-4 h-4 text-amber-600" />
            <span>نصيب القطعة المقترح بحاسبة الإنتاج (معدل 25 قطعة/شهر):</span>
          </div>
          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
            ~ {suggestedSharePerPiece} {profile.currencySymbol} / قطعة
          </span>
        </div>

        {/* Add cost form */}
        <form onSubmit={handleAddCost} className="mt-5 p-4 rounded-2xl bg-amber-50/50 dark:bg-stone-800/40 border border-amber-200/60 dark:border-stone-700 space-y-3">
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
              <label className="block text-[10px] text-stone-500 font-bold mb-1">العملة</label>
              <select
                value={currency}
                onChange={(e) => {
                  const cur = e.target.value;
                  setCurrency(cur);
                  const curMetadata = SUPPORTED_CURRENCIES.find((c) => c.code === cur);
                  const rate = cur === baseCurrency ? 1.0 : (dailyRates[cur] || curMetadata?.defaultRateAgainstEGP || curMetadata?.defaultRateToBase || 1.0);
                  setExchangeRate(rate);
                }}
                className="w-full px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold outline-none"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.nameAr})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-stone-500 font-bold mb-1">
                المبلغ بالـ ({currency})
              </label>
              <NumberInput
                required
                min={1}
                value={amount}
                onChange={setAmount}
                placeholder={`المبلغ (${currency})`}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-xs font-bold outline-none"
              />
            </div>

            <div>
              {currency !== baseCurrency ? (
                <div>
                  <label className="block text-[10px] text-stone-500 font-bold mb-1">
                    سعر الصرف (1 {currency} = كم {baseCurrency})
                  </label>
                  <NumberInput
                    min={0.0001}
                    step={0.01}
                    value={exchangeRate}
                    onChange={(val) => setExchangeRate(Number(val) || 1.0)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-xs font-bold outline-none text-left"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-stone-500 font-bold mb-1">ملاحظات / إيصال</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات أو رقم الإيصال"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {currency !== baseCurrency && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-800 text-xs">
              <div className="flex-1 w-full">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات أو رقم الإيصال"
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs outline-none"
                />
              </div>
              <div className="text-left font-mono font-bold text-amber-900 dark:text-amber-200 shrink-0">
                <span>المعادل بالعملة الأساسية ({baseCurrency}): </span>
                <span className="font-black text-sm">
                  {Math.round(amount * (Number(exchangeRate) || 1) * 100) / 100} {baseCurrency}
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer"
          >
            إضافة المصروف للدورة المالية
          </button>
        </form>

        {/* Expenses List */}
        <div className="mt-5 space-y-2">
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
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
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    className="p-1 text-stone-400 hover:text-rose-600 transition cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
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
