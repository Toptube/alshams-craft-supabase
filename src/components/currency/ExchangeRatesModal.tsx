import React, { useState, useEffect } from 'react';
import { CurrencyExchangeRate, UserProfile } from '../../types';
import { SUPPORTED_CURRENCIES, getOrInitExchangeRates } from '../../lib/currency';
import { tenantStorage } from '../../db/dexieDB';
import { playSuccessSound } from '../../lib/sounds';
import { useTranslation } from '../../lib/i18n';
import {
  X,
  Coins,
  Save,
  Check,
  TrendingUp,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ExchangeRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

export const ExchangeRatesModal: React.FC<ExchangeRatesModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const { t: tr } = useTranslation();
  const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
  const baseCurrency = profile.currency || 'EGP';

  const [rates, setRates] = useState<CurrencyExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await getOrInitExchangeRates(tenantId, baseCurrency);
      setRates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRates();
      setSuccessNotice(false);
    }
  }, [isOpen, tenantId, baseCurrency]);

  if (!isOpen) return null;

  const handleRateChange = (currencyCode: string, newRate: number) => {
    setRates((prev) =>
      prev.map((r) =>
        r.currency === currencyCode
          ? { ...r, rateAgainstBase: newRate, date: selectedDate, updatedAt: Date.now() }
          : r
      )
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updatedRates = rates.map((r) => ({
        ...r,
        date: selectedDate,
        updatedAt: Date.now(),
      }));
      await tenantStorage.saveMultipleExchangeRates(updatedRates);
      playSuccessSound();
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 2500);
    } catch (err) {
      console.error('Failed to save exchange rates:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100">
                أسعار صرف العملات اليومية (Multi-Currency)
              </h3>
              <p className="text-xs text-stone-500">
                تحديد سعر الصرف اليومي للعملات مقابل العملة الأساسية للورشة ({baseCurrency})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Selector & Notices */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>تاريخ سعر الصرف:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="text-xs font-bold text-stone-500">
            العملة الأساسية للورشة:{' '}
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono">
              {baseCurrency} ({profile.currencySymbol || 'ج.م'})
            </span>
          </div>
        </div>

        {successNotice && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>تم حفظ أسعار الصرف بنجاح وتحديثها في كل شاشات المبيعات والمصروفات!</span>
          </div>
        )}

        {/* Rates Table / List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <span>جاري تحميل أسعار العملات...</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {SUPPORTED_CURRENCIES.map((meta) => {
                const currentRate = rates.find((r) => r.currency === meta.code);
                const isBase = meta.code === baseCurrency;
                const rateVal = isBase ? 1 : currentRate?.rateAgainstBase || meta.defaultRateAgainstEGP;

                return (
                  <div
                    key={meta.code}
                    className={`p-3 sm:p-3.5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isBase
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-stone-50/60 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700/80 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{meta.flag}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100">
                            {meta.nameAr}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 font-bold text-stone-700 dark:text-stone-300">
                            {meta.code} ({meta.symbol})
                          </span>
                          {isBase && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                              الأساسية
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400 block font-medium">
                          {meta.nameEn}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <span className="text-xs text-stone-500 font-bold">
                        1 {meta.code} =
                      </span>
                      <div className="relative w-32 sm:w-36">
                        <input
                          type="number"
                          step="0.01"
                          min="0.001"
                          disabled={isBase}
                          value={rateVal}
                          onChange={(e) =>
                            handleRateChange(meta.code, parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono font-black text-left outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:bg-stone-100 dark:disabled:bg-stone-800"
                        />
                      </div>
                      <span className="text-xs font-bold text-stone-600 dark:text-stone-300 font-mono">
                        {baseCurrency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            يتم تطبيق هذه الأسعار تلقائياً عند تحديد أي عملة في المبيعات والمصروفات.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ أسعار الصرف</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
