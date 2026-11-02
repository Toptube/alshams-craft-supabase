import React, { useState, useEffect, useMemo } from 'react';
import {
  Banknote,
  Smartphone,
  Wallet,
  Plus,
  Building,
  UserCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Coins,
  ChevronDown,
} from 'lucide-react';
import {
  SupabaseTreasuryBalance,
  PaymentChannel,
  getTreasuryBalancesFromSupabase,
  rpcCreateTreasury,
  rpcIssueCustody,
} from '../../db/supabaseService';
import { tenantStorage } from '../../db/dexieDB';
import { NumberInput } from '../ui/NumberInput';

export interface SelectedDisbursementSource {
  id: string;
  name: string;
  kind: 'main' | 'sub' | 'custody';
  holderName?: string;
  availableCash: number;
  availableWallet: number;
  availableInstapay: number;
  totalBalance: number;
}

interface DisbursementSourceSelectorProps {
  workshopId: string;
  currencySymbol?: string;
  selectedSourceId: string;
  onSourceChange: (source: SelectedDisbursementSource) => void;
  selectedChannel: 'cash' | 'instapay' | 'wallet';
  onChannelChange: (channel: 'cash' | 'instapay' | 'wallet') => void;
  disbursedAmount?: number;
  label?: string;
  required?: boolean;
}

export const DisbursementSourceSelector: React.FC<DisbursementSourceSelectorProps> = ({
  workshopId,
  currencySymbol = 'ج.م',
  selectedSourceId,
  onSourceChange,
  selectedChannel,
  onChannelChange,
  disbursedAmount = 0,
  label = 'من أي خزينة أو عهدة تم الصرف؟ *',
  required = true,
}) => {
  const [treasuries, setTreasuries] = useState<SupabaseTreasuryBalance[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick Modal State (+ Button)
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickTab, setQuickTab] = useState<'sub' | 'custody'>('sub');

  // Form: Quick Sub-Treasury
  const [newSubName, setNewSubName] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);

  // Form: Quick Custody
  const [custodyHolder, setCustodyHolder] = useState('');
  const [custodyName, setCustodyName] = useState('');
  const [custodyAmount, setCustodyAmount] = useState<number>(500);
  const [custodyChannel, setCustodyChannel] = useState<PaymentChannel>('cash');
  const [custodySourceId, setCustodySourceId] = useState('');
  const [custodySubmitting, setCustodySubmitting] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  const loadTreasuries = async () => {
    if (!workshopId) return;
    setLoading(true);
    try {
      const res = await getTreasuryBalancesFromSupabase(workshopId);
      let list = res.data || [];

      // Fallback: If no balances from Supabase or empty, ensure Main Safe from Dexie
      if (list.length === 0) {
        const safe = await tenantStorage.getSafeBalances(workshopId);
        list = [
          {
            id: 'main',
            workshop_id: workshopId,
            name: 'الخزينة الرئيسية (النقدية)',
            kind: 'main',
            status: 'open',
            is_main: true,
            cash: safe.mainSafe || 0,
            wallet: 0,
            instapay: 0,
            balance: safe.mainSafe || 0,
          },
        ];
      }

      setTreasuries(list);

      // Auto-select initial if none selected or selected not in list
      if (!selectedSourceId || !list.find((t) => t.id === selectedSourceId)) {
        const defaultSource = list.find((t) => t.is_main || t.kind === 'main') || list[0];
        if (defaultSource) {
          onSourceChange({
            id: defaultSource.id,
            name: defaultSource.name,
            kind: defaultSource.kind === 'custody' ? 'custody' : defaultSource.is_main || defaultSource.kind === 'main' ? 'main' : 'sub',
            holderName: defaultSource.holder_name || undefined,
            availableCash: Number(defaultSource.cash) || 0,
            availableWallet: Number(defaultSource.wallet) || 0,
            availableInstapay: Number(defaultSource.instapay) || 0,
            totalBalance: Number(defaultSource.balance) || 0,
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load treasuries in DisbursementSourceSelector:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTreasuries();
  }, [workshopId]);

  // Listen to external treasury updates
  useEffect(() => {
    const handleUpdate = () => {
      loadTreasuries();
    };
    window.addEventListener('alshams_treasury_updated', handleUpdate);
    return () => window.removeEventListener('alshams_treasury_updated', handleUpdate);
  }, [workshopId]);

  // Grouped lists
  const mainTreasury = useMemo(() => {
    return treasuries.find((t) => t.is_main || t.kind === 'main') || treasuries[0];
  }, [treasuries]);

  const subTreasuries = useMemo(() => {
    return treasuries.filter(
      (t) => !(t.is_main || t.kind === 'main') && t.kind !== 'custody' && t.status === 'open'
    );
  }, [treasuries]);

  const openCustodies = useMemo(() => {
    return treasuries.filter(
      (t) => t.kind === 'custody' && t.status === 'open'
    );
  }, [treasuries]);

  // Currently selected item details
  const activeItem = useMemo(() => {
    return treasuries.find((t) => t.id === selectedSourceId) || mainTreasury;
  }, [treasuries, selectedSourceId, mainTreasury]);

  const currentChannelBalance = useMemo(() => {
    if (!activeItem) return 0;
    if (selectedChannel === 'cash') return Number(activeItem.cash) || 0;
    if (selectedChannel === 'wallet') return Number(activeItem.wallet) || 0;
    if (selectedChannel === 'instapay') return Number(activeItem.instapay) || 0;
    return Number(activeItem.balance) || 0;
  }, [activeItem, selectedChannel]);

  const hasInsufficientFunds = disbursedAmount > 0 && currentChannelBalance < disbursedAmount;

  const handleSelectTreasuryById = (id: string) => {
    const item = treasuries.find((t) => t.id === id);
    if (!item) return;
    const kind: 'main' | 'sub' | 'custody' = item.kind === 'custody'
      ? 'custody'
      : item.is_main || item.kind === 'main'
      ? 'main'
      : 'sub';

    onSourceChange({
      id: item.id,
      name: item.name,
      kind,
      holderName: item.holder_name || undefined,
      availableCash: Number(item.cash) || 0,
      availableWallet: Number(item.wallet) || 0,
      availableInstapay: Number(item.instapay) || 0,
      totalBalance: Number(item.balance) || 0,
    });
  };

  // Quick Action 1: Create Sub-Treasury
  const handleCreateQuickSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    setSubSubmitting(true);
    try {
      const res = await rpcCreateTreasury(workshopId, newSubName.trim(), mainTreasury?.id || null);
      if (res.error) {
        setNotice(res.error.arabicMessage);
      } else {
        await loadTreasuries();
        setIsQuickModalOpen(false);
        setNewSubName('');
        // Find and select
        setTimeout(() => {
          handleSelectTreasuryById(res.data?.id || 'sub');
        }, 300);
      }
    } catch (err: any) {
      setNotice(err?.message || 'فشل إنشاء الخزينة الفرعية');
    } finally {
      setSubSubmitting(false);
    }
  };

  // Quick Action 2: Issue Custody
  const handleIssueQuickCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custodyHolder.trim() || custodyAmount <= 0) return;
    setCustodySubmitting(true);
    try {
      const sourceId = custodySourceId || mainTreasury?.id || 'main';
      const effName = custodyName.trim() || `عهدة ${custodyHolder.trim()}`;
      const res = await rpcIssueCustody(
        workshopId,
        sourceId,
        custodyChannel,
        custodyHolder.trim(),
        effName,
        custodyAmount,
        'صرف عهدة تشغيلية سريعة'
      );
      if (res.error) {
        setNotice(res.error.arabicMessage);
      } else {
        await loadTreasuries();
        setIsQuickModalOpen(false);
        setCustodyHolder('');
        setCustodyName('');
        setCustodyAmount(500);
        if (res.data) {
          setTimeout(() => {
            handleSelectTreasuryById(res.data!);
          }, 300);
        }
      }
    } catch (err: any) {
      setNotice(err?.message || 'فشل صرف العهدة');
    } finally {
      setCustodySubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-3.5 rounded-2xl bg-amber-50/60 dark:bg-stone-800/50 border border-amber-200/80 dark:border-stone-700 text-right">
      {/* 1. Header & Source Dropdown with Quick (+) Button */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-amber-600" />
            <span>{label}</span>
          </label>
          <span className="text-[11px] font-bold text-stone-500">
            الرصيد الكلي المتاح:{' '}
            <span className="font-mono text-amber-700 dark:text-amber-400 font-black">
              {Number(activeItem?.balance || 0).toLocaleString()} {currencySymbol}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Dropdown */}
          <div className="relative flex-1">
            <select
              value={selectedSourceId}
              onChange={(e) => handleSelectTreasuryById(e.target.value)}
              className="w-full appearance-none pr-3 pl-8 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold text-stone-900 dark:text-stone-100 shadow-2xs focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
            >
              {mainTreasury && (
                <optgroup label="الخزينة النقدية الرئيسية">
                  <option value={mainTreasury.id}>
                    💵 {mainTreasury.name} (رصيدها: {Number(mainTreasury.balance || 0).toLocaleString()} {currencySymbol})
                  </option>
                </optgroup>
              )}

              {subTreasuries.length > 0 && (
                <optgroup label="الخزن الفرعية المتاحة">
                  {subTreasuries.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      🏛️ {sub.name} (رصيدها: {Number(sub.balance || 0).toLocaleString()} {currencySymbol})
                    </option>
                  ))}
                </optgroup>
              )}

              {openCustodies.length > 0 && (
                <optgroup label="العهد المالية المفتوحة">
                  {openCustodies.map((c) => (
                    <option key={c.id} value={c.id}>
                      💼 {c.name} — المستلم: {c.holder_name || 'مسؤول'} (متبقي: {Number(c.balance || 0).toLocaleString()} {currencySymbol})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick (+) Button */}
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setCustodySourceId(mainTreasury?.id || '');
              setIsQuickModalOpen(true);
            }}
            className="px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition cursor-pointer shrink-0"
            title="إنشاء خزينة فرعية سريعة أو صرف عهدة جديدة"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">خزينة / عهدة سريعة</span>
          </button>
        </div>
      </div>

      {/* 2. Payment Vessel / Channel Selector (وعاء الدفع الحقيقي) */}
      <div className="space-y-1.5 pt-1 border-t border-amber-200/60 dark:border-stone-700/80">
        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
          اختر وعاء الدفع الحقيقي (طريقة الخروج من الخزينة): *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {/* Cash */}
          <button
            type="button"
            onClick={() => onChannelChange('cash')}
            className={`p-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
              selectedChannel === 'cash'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
            }`}
          >
            <div className="flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5" />
              <span>نقدي (كاش) 💵</span>
            </div>
            <span className="text-[10px] opacity-85 font-mono">
              ({Number(activeItem?.cash || 0).toLocaleString()} {currencySymbol})
            </span>
          </button>

          {/* InstaPay / Bank */}
          <button
            type="button"
            onClick={() => onChannelChange('instapay')}
            className={`p-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
              selectedChannel === 'instapay'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
            }`}
          >
            <div className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              <span>إنستاباي / بنك 📱</span>
            </div>
            <span className="text-[10px] opacity-85 font-mono">
              ({Number(activeItem?.instapay || 0).toLocaleString()} {currencySymbol})
            </span>
          </button>

          {/* Wallet */}
          <button
            type="button"
            onClick={() => onChannelChange('wallet')}
            className={`p-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
              selectedChannel === 'wallet'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
            }`}
          >
            <div className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              <span>محفظة إلكترونية 👛</span>
            </div>
            <span className="text-[10px] opacity-85 font-mono">
              ({Number(activeItem?.wallet || 0).toLocaleString()} {currencySymbol})
            </span>
          </button>
        </div>
      </div>

      {/* Warning if insufficient funds in selected channel */}
      {hasInsufficientFunds && (
        <div className="p-2 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            تنبيه: المبلغ المطلوب صرفه ({disbursedAmount} {currencySymbol}) أكبر من الرصيد المتوفر في وعاء{' '}
            {selectedChannel === 'cash' ? 'الكاش' : selectedChannel === 'instapay' ? 'إنستاباي' : 'المحفظة'}{' '}
            ({currentChannelBalance} {currencySymbol}). سيتم إثبات الحركة وسحب المبلغ.
          </span>
        </div>
      )}

      {/* QUICK MODAL FOR CREATING SUB-TREASURY OR ISSUING CUSTODY */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-amber-300 dark:border-stone-700 w-full max-w-sm space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b pb-2">
              <button
                type="button"
                onClick={() => setIsQuickModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
              <h4 className="font-black text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>إضافة سريعة لمصدر الصرف</span>
              </h4>
            </div>

            {notice && (
              <div className="p-2 bg-rose-50 border border-rose-300 text-rose-700 text-xs rounded-xl font-bold">
                {notice}
              </div>
            )}

            {/* Tab switch */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setQuickTab('sub')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  quickTab === 'sub'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                خزينة فرعية جديدة
              </button>
              <button
                type="button"
                onClick={() => setQuickTab('custody')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  quickTab === 'custody'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                صرف عهدة جديدة
              </button>
            </div>

            {quickTab === 'sub' ? (
              <form onSubmit={handleCreateQuickSub} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">اسم الخزينة الفرعية *</label>
                  <input
                    type="text"
                    required
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="مثال: خزينة المعرض، خزينة المشتريات اليومية"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setIsQuickModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-bold text-stone-500 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={subSubmitting}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {subSubmitting ? 'جاري الإنشاء...' : 'إنشاء وتحديد الآن'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleIssueQuickCustody} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">اسم صاحب العهدة (المستلم) *</label>
                  <input
                    type="text"
                    required
                    value={custodyHolder}
                    onChange={(e) => setCustodyHolder(e.target.value)}
                    placeholder="مثال: أحمد عبد الله (مسؤول المشتريات)"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold outline-none"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold mb-1">المبلغ المسلم ({currencySymbol}) *</label>
                    <NumberInput
                      min={1}
                      required
                      value={custodyAmount}
                      onChange={setCustodyAmount}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">طريقة التسليم *</label>
                    <select
                      value={custodyChannel}
                      onChange={(e) => setCustodyChannel(e.target.value as PaymentChannel)}
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold"
                    >
                      <option value="cash">نقدي (كاش) 💵</option>
                      <option value="instapay">إنستاباي / بنك 📱</option>
                      <option value="wallet">محفظة إلكترونية 👛</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setIsQuickModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-bold text-stone-500 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={custodySubmitting}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {custodySubmitting ? 'جاري الصرف...' : 'صرف واختيار العهدة'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * دالة مساعدة مركزية لتسجيل قيد حركة الخروج المؤكدة ببيانات كاملة
 * وسيريال فريد مع الخصم الفوري وإطلاق إشارات التحديث
 */
export async function recordDisbursementExitTransaction(params: {
  tenantId: string;
  sourceId: string;
  sourceName: string;
  sourceKind: 'main' | 'sub' | 'custody';
  holderName?: string;
  channel: 'cash' | 'instapay' | 'wallet';
  amount: number;
  recipientName: string;
  category: string;
  title: string;
  notes?: string;
  date?: string;
  referenceType?: string;
  referenceId?: string;
  userEmail?: string;
}): Promise<string> {
  const serial = `TX-${Date.now().toString().slice(-6)}`;
  const dateStr = params.date || new Date().toISOString().split('T')[0];
  const channelAr =
    params.channel === 'cash' ? 'نقدي (كاش)' : params.channel === 'instapay' ? 'إنستاباي / بنك' : 'محفظة إلكترونية';

  const exitTag = `[سيريال: ${serial}] [تاريخ: ${dateStr}] [المستلم: ${params.recipientName || 'مسؤول الصرف'}] [وعاء الدفع: ${channelAr}] [الخزينة/العهدة: ${params.sourceName}]`;

  const safeType: 'main' | 'sub' =
    params.sourceKind === 'main' ? 'main' : 'sub';

  await tenantStorage.recordSafeTransaction({
    id: serial,
    tenantId: params.tenantId,
    workshopId: params.tenantId,
    safeType,
    treasuryId: params.sourceId,
    treasuryName: params.sourceName,
    type: 'expense',
    channel: params.channel,
    amount: -Math.abs(params.amount),
    balanceAfter: 0,
    description: `${params.title} (${params.category})`,
    notes: `${params.title} — ${exitTag} ${params.notes || ''}`.trim(),
    recipient: params.recipientName,
    referenceType: params.referenceType || 'expense',
    referenceId: params.referenceId || serial,
    date: dateStr,
    createdAt: Date.now(),
    createdBy: params.userEmail || 'system',
  });

  // Notify the app of the treasury and financials updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alshams_treasury_updated'));
    window.dispatchEvent(new CustomEvent('alshams_financials_updated'));
  }

  return serial;
}
