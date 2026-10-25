import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkshopProfile } from '../../types';
import {
  SupabaseTreasuryBalance,
  SupabaseTreasuryTransaction,
  PaymentChannel,
  getTreasuryBalancesFromSupabase,
  getTreasuryTransactionsFromSupabase,
  updateTreasuryDetailsInSupabase,
  updateTreasuryMinBalanceInSupabase,
  rpcCreateTreasury,
  rpcTreasuryDeposit,
  rpcTreasuryTransfer,
  rpcIssueCustody,
  rpcCustodySettle,
  rpcDeleteTreasury,
} from '../../db/supabaseService';
import {
  getTreasuryCategories,
  fetchAndSyncSupabaseCategories,
  saveCustomCategoryWithSupabase,
  deleteCustomCategoryWithSupabase,
  getAllMinBalanceAlerts,
  setMinBalanceAlert,
  TreasuryCategory,
} from '../../lib/treasuryCategories';
import { useTranslation, t } from '../../lib/i18n';
import {
  Wallet,
  ArrowRightLeft,
  Plus,
  ArrowDownRight,
  ArrowUpLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Building,
  CreditCard,
  Banknote,
  Smartphone,
  Search,
  X,
  Printer,
  Edit3,
  Trash2,
  Layers,
  Filter,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FileText,
  Tag,
  ShieldAlert,
  BellRing,
} from 'lucide-react';
import { NumberInput } from '../ui/NumberInput';

interface TreasuriesViewProps {
  workshop: WorkshopProfile;
  onOpenHelp?: (sectionId: string) => void;
}

export const TreasuriesView: React.FC<TreasuriesViewProps> = ({
  workshop,
  onOpenHelp,
}) => {
  const workshopId = workshop.id || workshop.workshopId || workshop.tenantId || '';
  const currency = workshop.currency || 'ج.م';
  const { lang: currentLang, t: tr } = useTranslation();

  // Treasuries state from treasury_balances view
  const [treasuryBalances, setTreasuryBalances] = useState<SupabaseTreasuryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Search filter for treasuries tree
  const [treeSearchTerm, setTreeSearchTerm] = useState('');

  // Minimum Balance Alerts Thresholds state: map of treasury_id -> threshold number
  const [minAlerts, setMinAlerts] = useState<Record<string, number>>({});
  const [minAlertModalOpen, setMinAlertModalOpen] = useState(false);
  const [targetTreasuryForAlert, setTargetTreasuryForAlert] = useState<SupabaseTreasuryBalance | null>(null);
  const [newAlertThreshold, setNewAlertThreshold] = useState<number>(0);

  // Categories state
  const [categories, setCategories] = useState<TreasuryCategory[]>([]);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'in' | 'out'>('in');
  const [newCatNotes, setNewCatNotes] = useState('');

  // Modals state: Deposit
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [targetTreasuryForDeposit, setTargetTreasuryForDeposit] = useState<SupabaseTreasuryBalance | null>(null);
  const [depositChannel, setDepositChannel] = useState<PaymentChannel>('cash');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositCategory, setDepositCategory] = useState('رصيد افتتاحي');
  const [depositNote, setDepositNote] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [fromTreasuryId, setFromTreasuryId] = useState('');
  const [fromChannel, setFromChannel] = useState<PaymentChannel>('cash');
  const [toTreasuryId, setToTreasuryId] = useState('');
  const [toChannel, setToChannel] = useState<PaymentChannel>('cash');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferNote, setTransferNote] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Issue Custody Modal
  const [issueCustodyModalOpen, setIssueCustodyModalOpen] = useState(false);
  const [custodySourceId, setCustodySourceId] = useState('');
  const [custodyChannel, setCustodyChannel] = useState<PaymentChannel>('cash');
  const [custodyHolderName, setCustodyHolderName] = useState('');
  const [custodyName, setCustodyName] = useState('');
  const [custodyCategory, setCustodyCategory] = useState('مشتريات خامات ومستلزمات');
  const [custodyAmount, setCustodyAmount] = useState<number>(0);
  const [custodyNote, setCustodyNote] = useState('');
  const [issueCustodySubmitting, setIssueCustodySubmitting] = useState(false);

  // Top Up Custody Modal
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpCustody, setTopUpCustody] = useState<SupabaseTreasuryBalance | null>(null);
  const [topUpSourceId, setTopUpSourceId] = useState('');
  const [topUpChannel, setTopUpChannel] = useState<PaymentChannel>('cash');
  const [topUpAmount, setTopUpAmount] = useState<number>(0);
  const [topUpNote, setTopUpNote] = useState('');
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);

  // Return from Custody Modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnCustody, setReturnCustody] = useState<SupabaseTreasuryBalance | null>(null);
  const [returnTargetId, setReturnTargetId] = useState('');
  const [returnChannel, setReturnChannel] = useState<PaymentChannel>('cash');
  const [returnAmount, setReturnAmount] = useState<number>(0);
  const [returnNote, setReturnNote] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Settle Custody Modal
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleCustody, setSettleCustody] = useState<SupabaseTreasuryBalance | null>(null);
  const [settleReturnToId, setSettleReturnToId] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  // Create Sub-Treasury Modal
  const [createSubModalOpen, setCreateSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubParentId, setNewSubParentId] = useState('');
  const [createSubSubmitting, setCreateSubSubmitting] = useState(false);

  // Edit Treasury Details Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTreasury, setEditingTreasury] = useState<SupabaseTreasuryBalance | null>(null);
  const [editName, setEditName] = useState('');
  const [editHolderName, setEditHolderName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Account Statement Modal & state
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementTreasury, setStatementTreasury] = useState<SupabaseTreasuryBalance | null>(null);
  const [statementTransactions, setStatementTransactions] = useState<SupabaseTreasuryTransaction[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [statementChannelFilter, setStatementChannelFilter] = useState<'all' | PaymentChannel>('all');
  const [statementCategoryFilter, setStatementCategoryFilter] = useState<'all' | string>('all');
  const [statementSearch, setStatementSearch] = useState('');

  // Info banner expand
  const [isHelpGuideOpen, setIsHelpGuideOpen] = useState(false);

  // Load balances from Supabase & local alerts/categories
  const loadTreasuryData = async (isManualRefresh = false) => {
    if (!workshopId) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorNotice(null);

    try {
      const { data, error } = await getTreasuryBalancesFromSupabase(workshopId);
      if (error) {
        setErrorNotice(error.arabicMessage);
      } else {
        setTreasuryBalances(data || []);
        // Populate minAlerts from min_balance if present in database
        if (data && data.length > 0) {
          const dbAlerts: Record<string, number> = {};
          data.forEach((b) => {
            if (b.min_balance && Number(b.min_balance) > 0) {
              dbAlerts[b.id] = Number(b.min_balance);
            }
          });
          setMinAlerts((prev) => ({ ...prev, ...dbAlerts }));
        }
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'تعذر تحميل بيانات الخزن');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLocalSettings = async () => {
    if (!workshopId) return;
    setMinAlerts(getAllMinBalanceAlerts(workshopId));
    setCategories(getTreasuryCategories(workshopId));
    try {
      const synced = await fetchAndSyncSupabaseCategories(workshopId);
      if (synced && synced.length > 0) {
        setCategories(synced);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadTreasuryData();
    loadLocalSettings();

    const handleCatsUpdated = () => setCategories(getTreasuryCategories(workshopId));
    const handleAlertsUpdated = () => setMinAlerts(getAllMinBalanceAlerts(workshopId));

    window.addEventListener('alshams_treasury_categories_updated', handleCatsUpdated);
    window.addEventListener('alshams_treasury_alerts_updated', handleAlertsUpdated);

    return () => {
      window.removeEventListener('alshams_treasury_categories_updated', handleCatsUpdated);
      window.removeEventListener('alshams_treasury_alerts_updated', handleAlertsUpdated);
    };
  }, [workshopId]);

  // Notice helper with timeout
  const showNotice = (msg: string, isError = false) => {
    if (isError) {
      setErrorNotice(msg);
      setSuccessNotice(null);
    } else {
      setSuccessNotice(msg);
      setErrorNotice(null);
      setTimeout(() => setSuccessNotice(null), 5000);
    }
  };

  // Group treasuries:
  const mainTreasury = useMemo(() => {
    return treasuryBalances.find((t) => t.is_main || t.kind === 'main') || null;
  }, [treasuryBalances]);

  const subTreasuries = useMemo(() => {
    return treasuryBalances.filter((t) => t.kind === 'sub');
  }, [treasuryBalances]);

  const custodies = useMemo(() => {
    return treasuryBalances.filter((t) => t.kind === 'custody');
  }, [treasuryBalances]);

  const custodiesByParent = useMemo(() => {
    const map: Record<string, SupabaseTreasuryBalance[]> = {};
    for (const c of custodies) {
      const pid = c.parent_id || 'unassigned';
      if (!map[pid]) map[pid] = [];
      map[pid].push(c);
    }
    return map;
  }, [custodies]);

  // Overall totals across all treasuries
  const overallTotals = useMemo(() => {
    let total = 0;
    let cash = 0;
    let wallet = 0;
    let instapay = 0;

    for (const t of treasuryBalances) {
      total += Number(t.balance) || 0;
      cash += Number(t.cash) || 0;
      wallet += Number(t.wallet) || 0;
      instapay += Number(t.instapay) || 0;
    }

    return { total, cash, wallet, instapay };
  }, [treasuryBalances]);

  // Treasuries below minimum alert threshold (for global red alert indicator)
  const lowLiquidityTreasuries = useMemo(() => {
    return treasuryBalances.filter((t) => {
      const threshold = minAlerts[t.id] || t.min_balance || 0;
      return threshold > 0 && Number(t.balance) <= threshold && t.status === 'open';
    });
  }, [treasuryBalances, minAlerts]);

  // Channels helper
  const channelLabel = (ch: string) => {
    switch (ch) {
      case 'cash':
        return 'كاش';
      case 'wallet':
        return 'محفظة';
      case 'instapay':
        return 'إنستاباي';
      default:
        return ch;
    }
  };

  const channelIcon = (ch: string) => {
    switch (ch) {
      case 'cash':
        return <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'wallet':
        return <Wallet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'instapay':
        return <Smartphone className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />;
      default:
        return <CreditCard className="w-3.5 h-3.5 text-stone-500" />;
    }
  };

  // -------------------------------------------------------------
  // Category Management Handlers
  // -------------------------------------------------------------
  const handleOpenCategoriesModal = () => {
    setNewCatName('');
    setNewCatType('in');
    setNewCatNotes('');
    setCategoriesModalOpen(true);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      showNotice('يرجى كتابة اسم التصنيف', true);
      return;
    }
    const created = await saveCustomCategoryWithSupabase(workshopId, {
      name: newCatName.trim(),
      type: newCatType,
      notes: newCatNotes.trim(),
    });
    setCategories(getTreasuryCategories(workshopId));
    setNewCatName('');
    setNewCatNotes('');
    showNotice(`تم إضافة التصنيف "${created.name}" بنجاح في قاعدة البيانات.`);
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    await deleteCustomCategoryWithSupabase(workshopId, catId);
    setCategories(getTreasuryCategories(workshopId));
    showNotice(`تم حذف التصنيف "${catName}".`);
  };

  // -------------------------------------------------------------
  // Minimum Balance Alert Handlers
  // -------------------------------------------------------------
  const handleOpenSetAlert = (t: SupabaseTreasuryBalance) => {
    setTargetTreasuryForAlert(t);
    setNewAlertThreshold(minAlerts[t.id] || t.min_balance || 0);
    setMinAlertModalOpen(true);
  };

  const handleSaveAlertThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTreasuryForAlert) return;

    // Persist to Supabase treasuries table (min_balance)
    try {
      await updateTreasuryMinBalanceInSupabase(workshopId, targetTreasuryForAlert.id, newAlertThreshold);
    } catch (e) {}

    setMinBalanceAlert(workshopId, targetTreasuryForAlert.id, newAlertThreshold);
    setMinAlerts(getAllMinBalanceAlerts(workshopId));
    setMinAlertModalOpen(false);

    // Refresh data to reflect updated min_balance
    await loadTreasuryData();

    if (newAlertThreshold > 0) {
      showNotice(
        `تم حفظ الحد الأدنى للرصيد للخزنة "${targetTreasuryForAlert.name}" بمبلغ ${newAlertThreshold.toFixed(2)} ${currency} في قاعدة البيانات.`
      );
    } else {
      showNotice(`تم إلغاء تنبيه حد الأمان للخزنة "${targetTreasuryForAlert.name}".`);
    }
  };

  // -------------------------------------------------------------
  // Action Handlers
  // -------------------------------------------------------------

  // 1. Open Deposit
  const handleOpenDeposit = (t: SupabaseTreasuryBalance) => {
    setTargetTreasuryForDeposit(t);
    setDepositAmount(0);
    setDepositChannel('cash');
    const firstInflowCat = categories.find((c) => c.type === 'in' || c.type === 'both');
    setDepositCategory(firstInflowCat ? firstInflowCat.name : 'رصيد افتتاحي');
    setDepositNote('');
    setDepositModalOpen(true);
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTreasuryForDeposit) return;
    if (depositAmount <= 0) {
      showNotice('يرجى إدخال مبلغ إيداع أكبر من الصفر', true);
      return;
    }

    setDepositSubmitting(true);
    try {
      const { error } = await rpcTreasuryDeposit(
        workshopId,
        targetTreasuryForDeposit.id,
        depositChannel,
        depositAmount,
        depositCategory,
        depositNote
      );

      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تم إيداع ${depositAmount.toFixed(2)} ${currency} في "${targetTreasuryForDeposit.name}" بنجاح.`);
        setDepositModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشلت عملية الإيداع', true);
    } finally {
      setDepositSubmitting(false);
    }
  };

  // 2. Open Transfer
  const handleOpenTransfer = (source?: SupabaseTreasuryBalance) => {
    const defaultFrom = source ? source.id : (mainTreasury?.id || '');
    setFromTreasuryId(defaultFrom);
    setFromChannel('cash');

    const possibleTo = treasuryBalances.find((t) => t.id !== defaultFrom && t.status === 'open');
    setToTreasuryId(possibleTo ? possibleTo.id : '');
    setToChannel('cash');

    setTransferAmount(0);
    setTransferNote('');
    setTransferModalOpen(true);
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromTreasuryId || !toTreasuryId) {
      showNotice('يرجى تحديد الخزنة المصدر والخزنة الهدف', true);
      return;
    }
    if (fromTreasuryId === toTreasuryId && fromChannel === toChannel) {
      showNotice('لا يمكن التحويل لنفس الخزنة وبنفس طريقة الدفع', true);
      return;
    }
    if (transferAmount <= 0) {
      showNotice('يرجى إدخال مبلغ تحويل أكبر من الصفر', true);
      return;
    }

    setTransferSubmitting(true);
    try {
      const { error } = await rpcTreasuryTransfer(
        workshopId,
        fromTreasuryId,
        fromChannel,
        toTreasuryId,
        toChannel,
        transferAmount,
        'تحويل بين الخزن',
        transferNote
      );

      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تم تحويل ${transferAmount.toFixed(2)} ${currency} بنجاح.`);
        setTransferModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشل تنفيذ التحويل', true);
    } finally {
      setTransferSubmitting(false);
    }
  };

  // 3. Issue Custody
  const handleOpenIssueCustody = (source?: SupabaseTreasuryBalance) => {
    setCustodySourceId(source ? source.id : (mainTreasury?.id || ''));
    setCustodyChannel('cash');
    setCustodyHolderName('');
    setCustodyName('');
    const firstOutflowCat = categories.find((c) => c.type === 'out' || c.type === 'both');
    setCustodyCategory(firstOutflowCat ? firstOutflowCat.name : 'مشتريات خامات ومستلزمات');
    setCustodyAmount(0);
    setCustodyNote('');
    setIssueCustodyModalOpen(true);
  };

  const handleSubmitIssueCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custodySourceId) {
      showNotice('يرجى اختيار الخزنة المصدر للعهدة', true);
      return;
    }
    if (!custodyHolderName.trim()) {
      showNotice('يرجى إدخال اسم صاحب العهدة (المستلم)', true);
      return;
    }
    if (custodyAmount <= 0) {
      showNotice('يرجى إدخال مبلغ عهدة صحيح أكبر من الصفر', true);
      return;
    }

    setIssueCustodySubmitting(true);
    try {
      const effectiveName = custodyName.trim() || `عهدة ${custodyHolderName.trim()}`;
      const effectiveNote = custodyNote.trim()
        ? `[${custodyCategory}] ${custodyNote.trim()}`
        : `[${custodyCategory}]`;

      const { error } = await rpcIssueCustody(
        workshopId,
        custodySourceId,
        custodyChannel,
        custodyHolderName,
        effectiveName,
        custodyAmount,
        effectiveNote
      );

      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تم صرف العهدة (${effectiveName}) بمبلغ ${custodyAmount.toFixed(2)} ${currency} بنجاح.`);
        setIssueCustodyModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشل صرف العهدة', true);
    } finally {
      setIssueCustodySubmitting(false);
    }
  };

  // 4. Top Up Custody
  const handleOpenTopUp = (c: SupabaseTreasuryBalance) => {
    setTopUpCustody(c);
    setTopUpSourceId(c.parent_id || mainTreasury?.id || '');
    setTopUpChannel('cash');
    setTopUpAmount(0);
    setTopUpNote('');
    setTopUpModalOpen(true);
  };

  const handleSubmitTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpCustody || !topUpSourceId) return;
    if (topUpAmount <= 0) {
      showNotice('يرجى إدخال مبلغ إضافة أكبر من الصفر', true);
      return;
    }

    setTopUpSubmitting(true);
    try {
      const { error } = await rpcTreasuryTransfer(
        workshopId,
        topUpSourceId,
        topUpChannel,
        topUpCustody.id,
        topUpChannel,
        topUpAmount,
        'عهدة',
        topUpNote || `إضافة للعهدة (${topUpCustody.name})`
      );

      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تمت إضافة ${topUpAmount.toFixed(2)} ${currency} للعهدة بنجاح.`);
        setTopUpModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشلت إضافة العهدة', true);
    } finally {
      setTopUpSubmitting(false);
    }
  };

  // 5. Return from Custody
  const handleOpenReturn = (c: SupabaseTreasuryBalance) => {
    setReturnCustody(c);
    setReturnTargetId(c.parent_id || mainTreasury?.id || '');
    setReturnChannel('cash');
    setReturnAmount(0);
    setReturnNote('');
    setReturnModalOpen(true);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnCustody || !returnTargetId) return;
    if (returnAmount <= 0) {
      showNotice('يرجى إدخال مبلغ رد أكبر من الصفر', true);
      return;
    }
    if (returnAmount > (Number(returnCustody.balance) || 0)) {
      showNotice('المبلغ المطلوب رده أكبر من رصيد العهدة المتوفر', true);
      return;
    }

    setReturnSubmitting(true);
    try {
      const { error } = await rpcTreasuryTransfer(
        workshopId,
        returnCustody.id,
        returnChannel,
        returnTargetId,
        returnChannel,
        returnAmount,
        'رد عهدة',
        returnNote || `رد من العهدة (${returnCustody.name})`
      );

      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تم رد ${returnAmount.toFixed(2)} ${currency} من العهدة بنجاح.`);
        setReturnModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشل رد العهدة', true);
    } finally {
      setReturnSubmitting(false);
    }
  };

  // 6. Settle Custody
  const handleOpenSettle = (c: SupabaseTreasuryBalance) => {
    setSettleCustody(c);
    setSettleReturnToId(c.parent_id || mainTreasury?.id || '');
    setSettleNote('');
    setSettleModalOpen(true);
  };

  const handleSubmitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleCustody || !settleReturnToId) return;

    setSettleSubmitting(true);
    try {
      const { error } = await rpcCustodySettle(
        workshopId,
        settleCustody.id,
        settleReturnToId,
        settleNote || 'تسوية وإقفال العهدة'
      );

      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تمت تسوية وإقفال العهدة "${settleCustody.name}" وإرجاع الرصيد المتبقي بنجاح.`);
        setSettleModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشلت تسوية العهدة', true);
    } finally {
      setSettleSubmitting(false);
    }
  };

  // 7. Create Sub-Treasury
  const handleOpenCreateSub = (parent?: SupabaseTreasuryBalance) => {
    setNewSubName('');
    setNewSubParentId(parent ? parent.id : (mainTreasury?.id || ''));
    setCreateSubModalOpen(true);
  };

  const handleSubmitCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) {
      showNotice('يرجى إدخال اسم الخزنة الفرعية', true);
      return;
    }

    setCreateSubSubmitting(true);
    try {
      const { error } = await rpcCreateTreasury(workshopId, newSubName, newSubParentId || null);
      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تم إنشاء الخزنة الفرعية "${newSubName}" بنجاح.`);
        setCreateSubModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشل إنشاء الخزنة الفرعية', true);
    } finally {
      setCreateSubSubmitting(false);
    }
  };

  // 8. Edit Treasury Details
  const handleOpenEdit = (t: SupabaseTreasuryBalance) => {
    setEditingTreasury(t);
    setEditName(t.name || '');
    setEditHolderName(t.holder_name || '');
    setEditNotes('');
    setEditModalOpen(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTreasury) return;
    if (!editName.trim()) {
      showNotice('اسم الخزنة مطلوب', true);
      return;
    }

    setEditSubmitting(true);
    try {
      const updates: { name: string; holder_name?: string; notes?: string } = {
        name: editName.trim(),
      };
      if (editingTreasury.kind === 'custody') {
        updates.holder_name = editHolderName.trim();
      }
      if (editNotes.trim()) {
        updates.notes = editNotes.trim();
      }

      const { error } = await updateTreasuryDetailsInSupabase(editingTreasury.id, workshopId, updates);
      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice('تم تحديث بيانات الخزنة بنجاح.');
        setEditModalOpen(false);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشل تحديث بيانات الخزنة', true);
    } finally {
      setEditSubmitting(false);
    }
  };

  // 9. Delete Treasury
  const handleDeleteTreasury = async (t: SupabaseTreasuryBalance) => {
    if (t.is_main || t.kind === 'main') {
      showNotice('لا يمكن حذف الخزنة الرئيسية للورشة', true);
      return;
    }
    const confirmed = window.confirm(
      `هل أنت متأكد من رغبتك في حذف الخزنة "${t.name}"؟\nملاحظة: يشترط أن تكون الخزنة فارغة الرصيد ولم يُسجل عليها حركات مالية.`
    );
    if (!confirmed) return;

    try {
      const { error } = await rpcDeleteTreasury(workshopId, t.id);
      if (error) {
        showNotice(error.arabicMessage, true);
      } else {
        showNotice(`تم حذف الخزنة "${t.name}" بنجاح.`);
        await loadTreasuryData();
      }
    } catch (err: any) {
      showNotice(err?.message || 'فشل حذف الخزنة', true);
    }
  };

  // 10. Account Statement Modal
  const handleOpenStatement = async (t: SupabaseTreasuryBalance) => {
    setStatementTreasury(t);
    setStatementPeriod('all');
    setStatementStartDate('');
    setStatementEndDate('');
    setStatementChannelFilter('all');
    setStatementCategoryFilter('all');
    setStatementSearch('');
    setStatementModalOpen(true);
    setStatementLoading(true);

    try {
      const { data, error } = await getTreasuryTransactionsFromSupabase(t.id, 300);
      if (error) {
        showNotice(error.arabicMessage, true);
        setStatementTransactions([]);
      } else {
        setStatementTransactions(data || []);
      }
    } catch (err: any) {
      showNotice(err?.message || 'تعذر تحميل كشف حساب الخزنة', true);
      setStatementTransactions([]);
    } finally {
      setStatementLoading(false);
    }
  };

  // Filtered Statement Transactions with Running Balance
  const filteredStatementData = useMemo(() => {
    if (!statementTransactions.length) return [];

    let filtered = [...statementTransactions];

    // Period filter
    const now = new Date();
    if (statementPeriod === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      filtered = filtered.filter((tx) => new Date(tx.occurred_at).getTime() >= startOfDay);
    } else if (statementPeriod === 'week') {
      const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((tx) => new Date(tx.occurred_at).getTime() >= weekAgo);
    } else if (statementPeriod === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      filtered = filtered.filter((tx) => new Date(tx.occurred_at).getTime() >= startOfMonth);
    } else if (statementPeriod === 'custom') {
      if (statementStartDate) {
        const sTime = new Date(statementStartDate).getTime();
        filtered = filtered.filter((tx) => new Date(tx.occurred_at).getTime() >= sTime);
      }
      if (statementEndDate) {
        const eTime = new Date(statementEndDate).getTime() + 24 * 60 * 60 * 1000;
        filtered = filtered.filter((tx) => new Date(tx.occurred_at).getTime() <= eTime);
      }
    }

    // Channel filter
    if (statementChannelFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.channel === statementChannelFilter);
    }

    // Category filter
    if (statementCategoryFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.category === statementCategoryFilter);
    }

    // Search filter
    if (statementSearch.trim()) {
      const q = statementSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          (tx.category && tx.category.toLowerCase().includes(q)) ||
          (tx.note && tx.note.toLowerCase().includes(q)) ||
          (tx.channel && channelLabel(tx.channel).toLowerCase().includes(q))
      );
    }

    // Sort chronologically (oldest first) to compute running balance, then reverse for display
    const chronological = [...filtered].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

    let running = 0;
    const withBalance = chronological.map((tx) => {
      const isIn = tx.kind === 'in' || tx.kind === 'transfer_in';
      const amt = Number(tx.amount) || 0;
      if (isIn) {
        running += amt;
      } else {
        running -= amt;
      }
      return {
        ...tx,
        isIn,
        runningBalance: running,
      };
    });

    return withBalance.reverse();
  }, [
    statementTransactions,
    statementPeriod,
    statementStartDate,
    statementEndDate,
    statementChannelFilter,
    statementCategoryFilter,
    statementSearch,
  ]);

  // Statement totals
  const statementTotals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const item of filteredStatementData) {
      const amt = Number(item.amount) || 0;
      if (item.isIn) {
        totalIn += amt;
      } else {
        totalOut += amt;
      }
    }
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filteredStatementData]);

  // Print statement
  const handlePrintStatement = () => {
    window.print();
  };

  // Filter treasuries in tree view by search term
  const filteredTree = useMemo(() => {
    if (!treeSearchTerm.trim()) {
      return {
        main: mainTreasury,
        subs: subTreasuries,
        custodiesMap: custodiesByParent,
      };
    }
    const q = treeSearchTerm.trim().toLowerCase();
    const matchedSubs = subTreasuries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.holder_name && s.holder_name.toLowerCase().includes(q))
    );
    const matchedCustodies = custodies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.holder_name && c.holder_name.toLowerCase().includes(q))
    );

    const newMap: Record<string, SupabaseTreasuryBalance[]> = {};
    for (const c of matchedCustodies) {
      const pid = c.parent_id || 'unassigned';
      if (!newMap[pid]) newMap[pid] = [];
      newMap[pid].push(c);
    }

    return {
      main:
        mainTreasury &&
        (mainTreasury.name.toLowerCase().includes(q) ||
          (mainTreasury.holder_name && mainTreasury.holder_name.toLowerCase().includes(q)))
          ? mainTreasury
          : null,
      subs: matchedSubs,
      custodiesMap: newMap,
    };
  }, [treeSearchTerm, mainTreasury, subTreasuries, custodies, custodiesByParent]);

  // Filtered categories for inputs
  const inflowCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'in' || c.type === 'both');
  }, [categories]);

  const outflowCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'out' || c.type === 'both');
  }, [categories]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 text-right font-sans text-stone-900 dark:text-stone-100">
      {/* Notifications */}
      {errorNotice && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{errorNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs sm:text-sm font-black">
            <Building className="w-4 h-4" />
            <span>السيولة النقدية والخزائن</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 dark:text-stone-50 mt-1">
            {t('treasuries_title', currentLang)}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            تتبع الأرصدة الحية، صرف العهد، التحويلات، حدود الأمان، وتخصيص تصنيفات المصروفات والواردات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          {/* Button: Manage Categories */}
          <button
            type="button"
            onClick={handleOpenCategoriesModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 text-xs font-black text-amber-800 dark:text-amber-300 transition cursor-pointer shadow-2xs"
            title="تخصيص تصنيفات المصروفات والواردات"
          >
            <Tag className="w-4 h-4 text-amber-600" />
            <span>{t('manage_categories', currentLang)}</span>
          </button>

          {/* Button: Help Guide */}
          <button
            type="button"
            onClick={() => setIsHelpGuideOpen(!isHelpGuideOpen)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 transition cursor-pointer"
            title="دليل المصطلحات والتعليمات"
          >
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>دليل المفاهيم</span>
          </button>

          {/* Button: Refresh */}
          <button
            type="button"
            onClick={() => loadTreasuryData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition cursor-pointer disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
          </button>

          {/* Button: Transfer */}
          <button
            type="button"
            onClick={() => handleOpenTransfer()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 dark:hover:bg-stone-600 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
            <span>تحويل بين الخزن</span>
          </button>

          {/* Button: Issue Custody */}
          <button
            type="button"
            onClick={() => handleOpenIssueCustody()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>صرف عهدة جديدة</span>
          </button>

          {/* Button: New Sub Treasury */}
          <button
            type="button"
            onClick={() => handleOpenCreateSub()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 text-xs font-bold border border-stone-300 dark:border-stone-700 transition cursor-pointer"
          >
            <Building className="w-4 h-4 text-amber-600" />
            <span>خزنة فرعية جديدة</span>
          </button>
        </div>
      </div>

      {/* GLOBAL RED ALERT INDICATOR BANNER IF ANY TREASURY BELOW MINIMUM */}
      {lowLiquidityTreasuries.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 text-white shadow-lg border border-rose-500 animate-in fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 animate-bounce">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-rose-200">
                تنبيه انخفاض السيولة النقدية (Minimum Balance Alert)
              </div>
              <h3 className="text-sm sm:text-base font-black">
                يوجد {lowLiquidityTreasuries.length} خزينة انخفض رصيدها عن حد الأمان المحدد!
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">
                الخزن المتأثرة:{' '}
                {lowLiquidityTreasuries
                  .map(
                    (t) =>
                      `"${t.name}" (الرصيد: ${Number(t.balance).toFixed(2)} ${currency} - حد الأمان: ${(
                        minAlerts[t.id] || 0
                      ).toFixed(2)})`
                  )
                  .join(' ، ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenTransfer()}
            className="px-4 py-2 rounded-xl bg-white text-rose-800 hover:bg-rose-50 font-black text-xs shadow-md transition cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            تحويل وتغذية السيولة الآن
          </button>
        </div>
      )}

      {/* Explanatory Help Guide Box (Collapsible / Toggleable) */}
      {isHelpGuideOpen && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-stone-700 dark:text-stone-300 space-y-3 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between font-black text-amber-900 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-sm">دليل مفاهيم العمليات المالية والخزن في المنظومة</span>
            </div>
            <button
              type="button"
              onClick={() => setIsHelpGuideOpen(false)}
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
            <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-100 dark:border-stone-800">
              <div className="font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px]">
                  العهدة المالية
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                مبلغ نقدي يُصرف لموظف، مندوب، أو مسؤول مشتريات لأداء مهمة محددة، ويظل ديناً في ذمته المالية حتى إثبات الصرف أو رد المتبقي.
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-100 dark:border-stone-800">
              <div className="font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 text-[11px]">
                  رد من العهدة
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                إرجاع جزء من المبلغ المسلّم في العهدة نقداً إلى الخزنة الأصلية دون إقفال العهدة، لتقليل الرصيد المتبقي بذمة المستلم.
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-100 dark:border-stone-800">
              <div className="font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px]">
                  تسوية وإقفال العهدة
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                الإجراء النهائي لإنهاء العهدة: يتم تحويل أي رصيد متبقي فيها تلقائياً إلى الخزنة الأصلية، وتتحول حالة العهدة إلى "مسوّاة".
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-100 dark:border-stone-800">
              <div className="font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 text-[11px]">
                  حد الأمان (Minimum Alert)
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                مبلغ مالي تحدده لكل خزنة؛ في حال نزل الرصيد عنه ينبثق مؤشر أحمر تحذيري لحماية استمرارية الشراء والسيولة التشغيلية.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Metric Summary Banner: "إجمالي كل الخزن" */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white shadow-xl border border-stone-700/60">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{t('total_liquidity', currentLang)}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
                {overallTotals.total.toFixed(2)}
              </span>
              <span className="text-base sm:text-lg font-bold text-stone-300">{currency}</span>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              مجموع الأرصدة الحالية في الخزنة الرئيسية والخزن الفرعية والعهد المفتوحة.
            </p>
          </div>

          {/* Sub-balances breakdown by channel */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-stone-950/60 p-3 sm:p-4 rounded-2xl border border-stone-800">
            <div className="text-center px-2 sm:px-3 py-1.5 bg-stone-900/80 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-stone-400 mb-0.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                <span>كاش</span>
              </div>
              <div className="text-sm sm:text-base font-black text-emerald-400">
                {overallTotals.cash.toFixed(2)}
              </div>
            </div>

            <div className="text-center px-2 sm:px-3 py-1.5 bg-stone-900/80 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-stone-400 mb-0.5">
                <Wallet className="w-3.5 h-3.5 text-blue-400" />
                <span>محفظة</span>
              </div>
              <div className="text-sm sm:text-base font-black text-blue-400">
                {overallTotals.wallet.toFixed(2)}
              </div>
            </div>

            <div className="text-center px-2 sm:px-3 py-1.5 bg-stone-900/80 rounded-xl">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-stone-400 mb-0.5">
                <Smartphone className="w-3.5 h-3.5 text-violet-400" />
                <span>إنستاباي</span>
              </div>
              <div className="text-sm sm:text-base font-black text-violet-400">
                {overallTotals.instapay.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-stone-900 p-3 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={treeSearchTerm}
            onChange={(e) => setTreeSearchTerm(e.target.value)}
            placeholder="ابحث في أسماء الخزن أو أصحاب العهد..."
            className="w-full pr-9 pl-3 py-1.5 text-xs rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        {treeSearchTerm && (
          <button
            type="button"
            onClick={() => setTreeSearchTerm('')}
            className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
          >
            مسح البحث
          </button>
        )}
      </div>

      {/* MAIN CONTENT: SIMPLE TREE VIEW */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="inline-block w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-stone-500">جاري تحميل شجرة الخزن والعهد من الخادم...</p>
        </div>
      ) : treasuryBalances.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-800 space-y-4">
          <Building className="w-12 h-12 text-amber-500 mx-auto opacity-70" />
          <h3 className="text-base font-black text-stone-800 dark:text-stone-200">
            لم يتم العثور على خزن مسجلة بعد
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            يمكنك إنشاء الخزنة الرئيسية للورشة والبدء في تسجيل الإيداعات النقدية وصرف العهد للموظفين.
          </p>
          <button
            type="button"
            onClick={() => handleOpenCreateSub()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء أول خزنة الآن</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* LEVEL 1: MAIN TREASURY (الخزنة الرئيسية في الأعلى) */}
          {filteredTree.main && (
            (() => {
              const mainAlertThreshold = minAlerts[filteredTree.main.id] || 0;
              const isMainLow = mainAlertThreshold > 0 && Number(filteredTree.main.balance) <= mainAlertThreshold;

              return (
                <div
                  className={`p-5 sm:p-6 rounded-3xl transition-all shadow-md hover:shadow-lg space-y-4 ${
                    isMainLow
                      ? 'border-2 border-rose-500 bg-rose-50/40 dark:bg-stone-900/90 shadow-rose-500/10'
                      : 'bg-amber-50/50 dark:bg-stone-900/90 border-2 border-amber-400/80 dark:border-amber-600/50'
                  }`}
                >
                  {/* RED VISUAL INDICATOR BANNER IF BALANCE LOW */}
                  {isMainLow && (
                    <div className="p-3 rounded-2xl bg-rose-600 text-white flex items-center justify-between text-xs font-bold animate-pulse">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-white shrink-0" />
                        <span>
                          تنبيه سيولة حرجة: رصيد الخزنة ({Number(filteredTree.main.balance).toFixed(2)} {currency}) أقل من حد الأمان المحدد ({mainAlertThreshold.toFixed(2)} {currency})!
                        </span>
                      </div>
                      <span className="bg-white/20 px-2 py-0.5 rounded-md text-[11px] font-mono">
                        العجز: {(mainAlertThreshold - Number(filteredTree.main.balance)).toFixed(2)} {currency}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200 dark:border-stone-800">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md text-white ${
                          isMainLow ? 'bg-rose-600' : 'bg-amber-500'
                        }`}
                      >
                        <Building className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-50">
                            {filteredTree.main.name}
                          </h2>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-white text-[10px] font-black tracking-wide ${
                              isMainLow ? 'bg-rose-600' : 'bg-amber-500'
                            }`}
                          >
                            الخزنة الرئيسية
                          </span>
                          {mainAlertThreshold > 0 && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                isMainLow
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600'
                              }`}
                            >
                              حد الأمان: {mainAlertThreshold.toFixed(2)} {currency}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          الخزنة المركزية التي تتفرع منها الخزن الفرعية وتصدر منها العهد
                        </p>
                      </div>
                    </div>

                    {/* Total Balance */}
                    <div className="text-left sm:text-right bg-white dark:bg-stone-800/80 px-4 py-2 rounded-2xl border border-amber-200 dark:border-stone-700">
                      <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400">الرصيد الكلي</div>
                      <div
                        className={`text-xl sm:text-2xl font-black ${
                          isMainLow
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {Number(filteredTree.main.balance).toFixed(2)}{' '}
                        <span className="text-xs font-bold text-stone-600 dark:text-stone-400">{currency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Channels sub-balances & Actions */}
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-1">
                    {/* 3 Channels */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-stone-500">كاش:</span>
                        <span className="font-black text-stone-800 dark:text-stone-200">
                          {Number(filteredTree.main.cash).toFixed(2)}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
                        <Wallet className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-stone-500">محفظة:</span>
                        <span className="font-black text-stone-800 dark:text-stone-200">
                          {Number(filteredTree.main.wallet).toFixed(2)}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs">
                        <Smartphone className="w-3.5 h-3.5 text-violet-600" />
                        <span className="text-stone-500">إنستاباي:</span>
                        <span className="font-black text-stone-800 dark:text-stone-200">
                          {Number(filteredTree.main.instapay).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenDeposit(filteredTree.main!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        title="إيداع رصيد أو مبيعات في الخزنة"
                      >
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>إيداع</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenTransfer(filteredTree.main!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-700 hover:bg-stone-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        title="تحويل لخزنة أخرى"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>تحويل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenIssueCustody(filteredTree.main!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        title="صرف عهدة مالية لموظف أو مندوب"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>صرف عهدة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenSetAlert(filteredTree.main!)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          isMainLow
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                            : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                        }`}
                        title="تحديد حد الأمان والتنبيهات المرئية"
                      >
                        <BellRing className={`w-3.5 h-3.5 ${isMainLow ? 'text-rose-600 animate-spin' : 'text-stone-500'}`} />
                        <span>حد الأمان</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenStatement(filteredTree.main!)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 text-xs font-bold transition cursor-pointer"
                        title="كشف حساب الحركات المالية"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>كشف حساب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(filteredTree.main!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 text-xs font-bold transition cursor-pointer"
                        title="تعديل اسم الخزنة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                    </div>
                  </div>

                  {/* Custodies directly under main treasury */}
                  {filteredTree.custodiesMap[filteredTree.main.id] &&
                    filteredTree.custodiesMap[filteredTree.main.id].length > 0 && (
                      <div className="mt-4 pt-4 border-t border-amber-200/60 dark:border-stone-800 space-y-2">
                        <div className="text-xs font-black text-amber-900 dark:text-amber-400 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          <span>العهد التابعة للخزنة الرئيسية ({filteredTree.custodiesMap[filteredTree.main.id].length})</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {filteredTree.custodiesMap[filteredTree.main.id].map((c) => (
                            <CustodyCard
                              key={c.id}
                              custody={c}
                              currency={currency}
                              minAlert={minAlerts[c.id] || 0}
                              onSetAlert={() => handleOpenSetAlert(c)}
                              onTopUp={() => handleOpenTopUp(c)}
                              onReturn={() => handleOpenReturn(c)}
                              onSettle={() => handleOpenSettle(c)}
                              onStatement={() => handleOpenStatement(c)}
                              onEdit={() => handleOpenEdit(c)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              );
            })()
          )}

          {/* LEVEL 2: SUB-TREASURIES (الخزن الفرعية تحت الرئيسية) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-stone-500" />
                <h3 className="text-base font-black text-stone-800 dark:text-stone-200">
                  الخزن الفرعية ({filteredTree.subs.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleOpenCreateSub()}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خزنة فرعية</span>
              </button>
            </div>

            {filteredTree.subs.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                لا توجد خزن فرعية مسجلة حالياً. يمكنك إنشاء خزنة للمعرض أو المشتريات لتنظيم السيولة.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTree.subs.map((sub) => {
                  const subCustodies = filteredTree.custodiesMap[sub.id] || [];
                  const subAlertThreshold = minAlerts[sub.id] || 0;
                  const isSubLow = subAlertThreshold > 0 && Number(sub.balance) <= subAlertThreshold;

                  return (
                    <div
                      key={sub.id}
                      className={`p-5 rounded-3xl transition-all shadow-sm hover:shadow-md space-y-4 mr-0 sm:mr-6 relative before:hidden sm:before:block before:absolute before:-right-4 before:top-8 before:w-4 before:h-0.5 before:bg-amber-300 dark:before:bg-stone-700 ${
                        isSubLow
                          ? 'border-2 border-rose-500 bg-rose-50/30 dark:bg-stone-900 shadow-rose-500/10'
                          : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      {/* RED VISUAL INDICATOR BANNER IF LOW */}
                      {isSubLow && (
                        <div className="p-2.5 rounded-xl bg-rose-600 text-white flex items-center justify-between text-xs font-bold animate-pulse">
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-white shrink-0" />
                            <span>
                              تنبيه: رصيد الخزنة ({Number(sub.balance).toFixed(2)}) أقل من حد الأمان المطلوب ({subAlertThreshold.toFixed(2)} {currency})!
                            </span>
                          </div>
                          <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-mono">
                            العجز: {(subAlertThreshold - Number(sub.balance)).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                              isSubLow
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                            }`}
                          >
                            <Building className={`w-5 h-5 ${isSubLow ? 'text-rose-600' : 'text-amber-600'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-black text-stone-900 dark:text-stone-100">
                                {sub.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] font-bold">
                                خزنة فرعية
                              </span>
                              {subAlertThreshold > 0 && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                    isSubLow
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600'
                                  }`}
                                >
                                  حد الأمان: {subAlertThreshold.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {sub.holder_name && (
                              <p className="text-xs text-stone-500 mt-0.5">المسؤول: {sub.holder_name}</p>
                            )}
                          </div>
                        </div>

                        {/* Balance */}
                        <div className="text-left sm:text-right bg-stone-50 dark:bg-stone-800 px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
                          <div className="text-[10px] font-bold text-stone-500">الرصيد الكلي</div>
                          <div
                            className={`text-lg font-black ${
                              isSubLow ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'
                            }`}
                          >
                            {Number(sub.balance).toFixed(2)}{' '}
                            <span className="text-xs font-bold text-stone-500">{currency}</span>
                          </div>
                        </div>
                      </div>

                      {/* Channels & Actions */}
                      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-stone-800 text-xs border border-stone-200 dark:border-stone-700">
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-stone-500">كاش:</span>
                            <span className="font-black text-stone-800 dark:text-stone-200">
                              {Number(sub.cash).toFixed(2)}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-stone-800 text-xs border border-stone-200 dark:border-stone-700">
                            <Wallet className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-stone-500">محفظة:</span>
                            <span className="font-black text-stone-800 dark:text-stone-200">
                              {Number(sub.wallet).toFixed(2)}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-stone-800 text-xs border border-stone-200 dark:border-stone-700">
                            <Smartphone className="w-3.5 h-3.5 text-violet-600" />
                            <span className="text-stone-500">إنستاباي:</span>
                            <span className="font-black text-stone-800 dark:text-stone-200">
                              {Number(sub.instapay).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Actions for Sub-Treasury */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDeposit(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            <span>إيداع</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenTransfer(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>تحويل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenIssueCustody(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>صرف عهدة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenSetAlert(sub)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              isSubLow
                                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                                : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                            }`}
                            title="تحديد حد الأمان والتنبيهات"
                          >
                            <BellRing className={`w-3.5 h-3.5 ${isSubLow ? 'text-rose-600' : 'text-stone-500'}`} />
                            <span>حد الأمان</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenStatement(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 text-xs font-bold transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-600" />
                            <span>كشف حساب</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sub)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 text-xs font-bold transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTreasury(sub)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition cursor-pointer"
                            title="حذف الخزنة (يشترط أن تكون فارغة)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>

                      {/* Sub-treasury custodies */}
                      {subCustodies.length > 0 && (
                        <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
                          <div className="text-xs font-black text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-600" />
                            <span>العهد التابعة لهذه الخزنة ({subCustodies.length})</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {subCustodies.map((c) => (
                              <CustodyCard
                                key={c.id}
                                custody={c}
                                currency={currency}
                                minAlert={minAlerts[c.id] || 0}
                                onSetAlert={() => handleOpenSetAlert(c)}
                                onTopUp={() => handleOpenTopUp(c)}
                                onReturn={() => handleOpenReturn(c)}
                                onSettle={() => handleOpenSettle(c)}
                                onStatement={() => handleOpenStatement(c)}
                                onEdit={() => handleOpenEdit(c)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: إدارة تصنيفات المصروفات والواردات (Categories) */}
      {/* ========================================================= */}
      {categoriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setCategoriesModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  <span>إدارة تصنيفات المصروفات والواردات</span>
                </h3>
                <p className="text-xs text-stone-500">
                  تخصيص بنود الحركات المالية (مشتريات خامات، صيانة، إيجار، إيرادات)
                </p>
              </div>
            </div>

            {/* Add New Category Form */}
            <form
              onSubmit={handleAddCategory}
              className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-3"
            >
              <div className="text-xs font-black text-stone-800 dark:text-stone-200">
                إضافة تصنيف جديد
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="اسم التصنيف (مثال: صيانة معدات، إيجار ورشة...)"
                    className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                    required
                  />
                </div>
                <div>
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as any)}
                    className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                  >
                    <option value="in">وارد (إيداع / إيراد)</option>
                    <option value="out">صادر (مصروف / عهدة)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCatNotes}
                  onChange={(e) => setNewCatNotes(e.target.value)}
                  placeholder="ملاحظات أو وصف اختياري..."
                  className="flex-1 p-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm cursor-pointer whitespace-nowrap"
                >
                  إضافة التصنيف
                </button>
              </div>
            </form>

            {/* List of Existing Categories */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div>
                <div className="text-xs font-black text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>تصنيفات الواردات والإيداعات ({inflowCategories.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {inflowCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-bold text-stone-800 dark:text-stone-200">{cat.name}</span>
                        {cat.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-400">
                            افتراضي
                          </span>
                        )}
                      </div>
                      {!cat.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="حذف التصنيف المخصص"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-black text-rose-700 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                  <span>تصنيفات المصروفات والعهد ({outflowCategories.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {outflowCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="font-bold text-stone-800 dark:text-stone-200">{cat.name}</span>
                        {cat.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-400">
                            افتراضي
                          </span>
                        )}
                      </div>
                      {!cat.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="حذف التصنيف المخصص"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setCategoriesModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ضبط حد الأمان للسيولة (Minimum Balance Alert) */}
      {/* ========================================================= */}
      {minAlertModalOpen && targetTreasuryForAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setMinAlertModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-rose-600" />
                  <span>ضبط حد الأمان والتنبيهات المرئية</span>
                </h3>
                <p className="text-xs text-stone-500">
                  الخزنة: {targetTreasuryForAlert.name} (الرصيد: {Number(targetTreasuryForAlert.balance).toFixed(2)} {currency})
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAlertThreshold} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold">كيف يعمل نظام التنبيهات المرئية؟</div>
                <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                  عند تحديد مبلغ كحد أدنى (مثلاً 5000 ج.م)، ستتحول بطاقة الخزنة فوراً إلى اللون الأحمر التحذيري مع وميض وعرض للعجز المالي عندما يقل الرصيد الفعلي عن هذا الحد.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  الحد الأدنى المطلوب لسيولة الخزنة ({currency})
                </label>
                <NumberInput
                  value={newAlertThreshold}
                  onChange={(val) => setNewAlertThreshold(val)}
                  min={0}
                  placeholder="0.00"
                  className="w-full text-lg font-black text-rose-600 dark:text-rose-400"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  أدخل 0 لإلغاء التنبيه المرئي لهذه الخزنة.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition cursor-pointer"
                >
                  حفظ حد الأمان
                </button>
                <button
                  type="button"
                  onClick={() => setMinAlertModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: إيداع نقدية مع التصنيفات الديناميكية */}
      {/* ========================================================= */}
      {depositModalOpen && targetTreasuryForDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setDepositModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  إيداع في: {targetTreasuryForDeposit.name}
                </h3>
                <p className="text-xs text-stone-500">تسجيل رصيد افتتاحي أو مبيعات أو تحصيلات نقدية</p>
              </div>
            </div>

            <form onSubmit={handleSubmitDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  طريقة الإيداع / القناة المالية *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'wallet', 'instapay'] as PaymentChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setDepositChannel(ch)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        depositChannel === ch
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {channelIcon(ch)}
                      <span>{channelLabel(ch)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  المبلغ المراد إيداعه ({currency}) *
                </label>
                <NumberInput
                  value={depositAmount}
                  onChange={(val) => setDepositAmount(val)}
                  min={0.01}
                  placeholder="0.00"
                  className="w-full text-lg font-black"
                  required
                />
              </div>

              {/* Dynamic Category Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    بند الإيداع / التصنيف *
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenCategoriesModal}
                    className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    + إضافة تصنيف جديد
                  </button>
                </div>
                <select
                  value={depositCategory}
                  onChange={(e) => setDepositCategory(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-bold"
                >
                  {inflowCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات أو بيان إضافي
                </label>
                <textarea
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  rows={2}
                  placeholder="أي تفاصيل خاصة بعملية الإيداع..."
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={depositSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {depositSubmitting ? 'جاري الإيداع...' : 'تأكيد الإيداع'}
                </button>
                <button
                  type="button"
                  onClick={() => setDepositModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: تحويل بين الخزن */}
      {/* ========================================================= */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  تحويل مالي بين الخزن
                </h3>
                <p className="text-xs text-stone-500">نقل أموال بين الخزينة المركزية أو الخزن الفرعية وقنواتها</p>
              </div>
            </div>

            <form onSubmit={handleSubmitTransfer} className="space-y-4">
              {/* From Treasury & Channel */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
                <span className="text-xs font-black text-rose-700 dark:text-rose-400 block">
                  من الخزنة (المرسلة / خصم):
                </span>
                <select
                  value={fromTreasuryId}
                  onChange={(e) => setFromTreasuryId(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  {treasuryBalances
                    .filter((t) => t.status === 'open')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.kind === 'main' ? 'رئيسية' : t.kind === 'sub' ? 'فرعية' : 'عهدة'} - رصيد:{' '}
                        {Number(t.balance).toFixed(2)})
                      </option>
                    ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-stone-500">من قناة:</span>
                  {(['cash', 'wallet', 'instapay'] as PaymentChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setFromChannel(ch)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        fromChannel === ch
                          ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600'
                      }`}
                    >
                      {channelLabel(ch)}
                    </button>
                  ))}
                </div>
              </div>

              {/* To Treasury & Channel */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 block">
                  إلى الخزنة (المستلمة / إضافة):
                </span>
                <select
                  value={toTreasuryId}
                  onChange={(e) => setToTreasuryId(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  {treasuryBalances
                    .filter((t) => t.status === 'open')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.kind === 'main' ? 'رئيسية' : t.kind === 'sub' ? 'فرعية' : 'عهدة'})
                      </option>
                    ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-stone-500">إلى قناة:</span>
                  {(['cash', 'wallet', 'instapay'] as PaymentChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setToChannel(ch)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        toChannel === ch
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600'
                      }`}
                    >
                      {channelLabel(ch)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  المبلغ المراد تحويله ({currency}) *
                </label>
                <NumberInput
                  value={transferAmount}
                  onChange={(val) => setTransferAmount(val)}
                  min={0.01}
                  placeholder="0.00"
                  className="w-full text-lg font-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات أو سبب التحويل
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="مثال: تغذية خزنة المعرض، تسوية نقدية"
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {transferSubmitting ? 'جاري التحويل...' : 'تأكيد التحويل'}
                </button>
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: صرف عهدة جديدة مع التصنيفات */}
      {/* ========================================================= */}
      {issueCustodyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIssueCustodyModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  صرف عهدة مالية جديدة
                </h3>
                <p className="text-xs text-stone-500">تسليم مبلغ مالي لموظف أو مندوب مشتريات لأداء مهام محددة</p>
              </div>
            </div>

            <form onSubmit={handleSubmitIssueCustody} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  مصدر صرف العهدة (الخزنة المنصرف منها) *
                </label>
                <select
                  value={custodySourceId}
                  onChange={(e) => setCustodySourceId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                >
                  {treasuryBalances
                    .filter((t) => (t.kind === 'main' || t.kind === 'sub') && t.status === 'open')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (الرصيد المتوفر: {Number(t.balance).toFixed(2)} {currency})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  طريقة الصرف (القناة المالية) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'wallet', 'instapay'] as PaymentChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setCustodyChannel(ch)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        custodyChannel === ch
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {channelIcon(ch)}
                      <span>{channelLabel(ch)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    اسم المستلم (صاحب العهدة) *
                  </label>
                  <input
                    type="text"
                    value={custodyHolderName}
                    onChange={(e) => setCustodyHolderName(e.target.value)}
                    placeholder="مثال: أحمد عبد الله (مندوب)"
                    className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    مسمى العهدة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={custodyName}
                    onChange={(e) => setCustodyName(e.target.value)}
                    placeholder="مثال: عهدة مشتريات خامات"
                    className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  />
                </div>
              </div>

              {/* Custody Category */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تصنيف الغرض من العهدة
                </label>
                <select
                  value={custodyCategory}
                  onChange={(e) => setCustodyCategory(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 font-bold"
                >
                  {outflowCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  مبلغ العهدة المنصرف ({currency}) *
                </label>
                <NumberInput
                  value={custodyAmount}
                  onChange={(val) => setCustodyAmount(val)}
                  min={0.01}
                  placeholder="0.00"
                  className="w-full text-lg font-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  بيان تفصيلي
                </label>
                <textarea
                  value={custodyNote}
                  onChange={(e) => setCustodyNote(e.target.value)}
                  rows={2}
                  placeholder="تحديد الغرض من العهدة وأي تعليمات خاصة بالتسوية..."
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={issueCustodySubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {issueCustodySubmitting ? 'جاري تسجيل وصرف العهدة...' : 'صرف العهدة الآن'}
                </button>
                <button
                  type="button"
                  onClick={() => setIssueCustodyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: إضافة لعهدة قائمة (Top Up) */}
      {/* ========================================================= */}
      {topUpModalOpen && topUpCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setTopUpModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  إضافة مبلغ للعهدة: {topUpCustody.name}
                </h3>
                <p className="text-xs text-stone-500">صاحب العهدة: {topUpCustody.holder_name || 'غير محدد'}</p>
              </div>
            </div>

            <form onSubmit={handleSubmitTopUp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  الخزنة المنصرف منها التعزيز *
                </label>
                <select
                  value={topUpSourceId}
                  onChange={(e) => setTopUpSourceId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                >
                  {treasuryBalances
                    .filter((t) => (t.kind === 'main' || t.kind === 'sub') && t.status === 'open')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (رصيد: {Number(t.balance).toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  القناة المالية *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'wallet', 'instapay'] as PaymentChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setTopUpChannel(ch)}
                      className={`flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                        topUpChannel === ch
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600'
                      }`}
                    >
                      {channelIcon(ch)}
                      <span>{channelLabel(ch)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  المبلغ المضاف ({currency}) *
                </label>
                <NumberInput
                  value={topUpAmount}
                  onChange={(val) => setTopUpAmount(val)}
                  min={0.01}
                  placeholder="0.00"
                  className="w-full text-lg font-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  البيان / ملاحظات
                </label>
                <input
                  type="text"
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                  placeholder="تعزيز رصيد العهدة لاستكمال المشتريات..."
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={topUpSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {topUpSubmitting ? 'جاري الإضافة...' : 'تأكيد إضافة المبلغ'}
                </button>
                <button
                  type="button"
                  onClick={() => setTopUpModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: رد من العهدة */}
      {/* ========================================================= */}
      {returnModalOpen && returnCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  رد مالي من العهدة: {returnCustody.name}
                </h3>
                <p className="text-xs text-stone-500">
                  الرصيد المتاح بالعهدة: {Number(returnCustody.balance).toFixed(2)} {currency}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  إرجاع المبلغ إلى الخزنة *
                </label>
                <select
                  value={returnTargetId}
                  onChange={(e) => setReturnTargetId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                >
                  {treasuryBalances
                    .filter((t) => (t.kind === 'main' || t.kind === 'sub') && t.status === 'open')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.kind === 'main' ? 'رئيسية' : 'فرعية'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  طريقة الرد (القناة المالية) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'wallet', 'instapay'] as PaymentChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setReturnChannel(ch)}
                      className={`flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                        returnChannel === ch
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600'
                      }`}
                    >
                      {channelIcon(ch)}
                      <span>{channelLabel(ch)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  المبلغ المردود ({currency}) *
                </label>
                <NumberInput
                  value={returnAmount}
                  onChange={(val) => setReturnAmount(val)}
                  min={0.01}
                  max={Number(returnCustody.balance) || undefined}
                  placeholder="0.00"
                  className="w-full text-lg font-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  بيان الرد
                </label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="رد متبقي نقدية من شراء الخامات..."
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={returnSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {returnSubmitting ? 'جاري رد المبلغ...' : 'تأكيد الرد إلى الخزنة'}
                </button>
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: تسوية وإقفال العهدة */}
      {/* ========================================================= */}
      {settleModalOpen && settleCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  تسوية وإقفال العهدة نهائياً
                </h3>
                <p className="text-xs text-stone-500">
                  العهدة: {settleCustody.name} ({settleCustody.holder_name})
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitSettle} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>الرصيد المتبقي بذمة العهدة:</span>
                  <span className="text-base font-black text-amber-700 dark:text-amber-400">
                    {Number(settleCustody.balance).toFixed(2)} {currency}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                  عند تأكيد التسوية، سيتم تحويل أي رصيد متبقي تلقائياً إلى الخزنة المختارة أدناه، وستتحول حالة العهدة إلى "مسوّاة" نهائياً.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  إرجاع المتبقي إلى الخزنة *
                </label>
                <select
                  value={settleReturnToId}
                  onChange={(e) => setSettleReturnToId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                >
                  {treasuryBalances
                    .filter((t) => (t.kind === 'main' || t.kind === 'sub') && t.status === 'open')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.kind === 'main' ? 'رئيسية' : 'فرعية'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات أو بيان التسوية
                </label>
                <textarea
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  rows={2}
                  placeholder="تم فحص الفواتير وإرجاع المتبقي نقداً..."
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={settleSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {settleSubmitting ? 'جاري إقفال وتسوية العهدة...' : 'تأكيد التسوية والإقفال'}
                </button>
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: خزنة فرعية جديدة */}
      {/* ========================================================= */}
      {createSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setCreateSubModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  إنشاء خزنة فرعية جديدة
                </h3>
                <p className="text-xs text-stone-500">تنظيم سيولة منفصلة (المعرض، المشتريات، الفرع، إلخ)</p>
              </div>
            </div>

            <form onSubmit={handleSubmitCreateSub} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  اسم الخزنة الفرعية *
                </label>
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="مثال: خزنة المعرض، خزنة المشتريات، خزنة الورشة 2"
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تتفرع من الخزنة
                </label>
                <select
                  value={newSubParentId}
                  onChange={(e) => setNewSubParentId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                >
                  {treasuryBalances
                    .filter((t) => t.kind === 'main' || t.kind === 'sub')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.is_main ? 'الخزنة المركزية الرئيسية' : 'خزنة فرعية'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={createSubSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {createSubSubmitting ? 'جاري الإنشاء...' : 'إنشاء الخزنة الفرعية'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateSubModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 8: تعديل بيانات الخزنة */}
      {/* ========================================================= */}
      {editModalOpen && editingTreasury && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  تعديل بيانات الخزنة
                </h3>
                <p className="text-xs text-stone-500">تحديث الاسم أو الملاحظات أو اسم صاحب العهدة</p>
              </div>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  اسم الخزنة / العهدة *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  required
                />
              </div>

              {editingTreasury.kind === 'custody' && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    اسم صاحب العهدة (المستلم)
                  </label>
                  <input
                    type="text"
                    value={editHolderName}
                    onChange={(e) => setEditHolderName(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات توضيحية..."
                  className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {editSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 9: كشف حساب الخزنة مع الطباعة وفلتر التصنيفات */}
      {/* ========================================================= */}
      {statementModalOpen && statementTreasury && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 text-right overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>طباعة الكشف</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementModalOpen(false)}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">
                    كشف حساب: {statementTreasury.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                    {statementTreasury.kind === 'main'
                      ? 'رئيسية'
                      : statementTreasury.kind === 'sub'
                      ? 'فرعية'
                      : 'عهدة'}
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  {statementTreasury.holder_name ? `صاحب الحساب: ${statementTreasury.holder_name} • ` : ''}
                  الرصيد الكلي: {Number(statementTreasury.balance).toFixed(2)} {currency}
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3 sm:p-4 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Period buttons */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-stone-400 ml-1">الفترة:</span>
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'today', label: 'اليوم' },
                    { id: 'week', label: 'آخر 7 أيام' },
                    { id: 'month', label: 'هذا الشهر' },
                    { id: 'custom', label: 'مخصص' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setStatementPeriod(p.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        statementPeriod === p.id
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Channel filter */}
                <div className="flex items-center gap-1">
                  <span className="text-stone-400 ml-1">القناة:</span>
                  {(['all', 'cash', 'wallet', 'instapay'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setStatementChannelFilter(ch)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        statementChannelFilter === ch
                          ? 'bg-stone-800 text-white dark:bg-stone-700'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                      }`}
                    >
                      {ch === 'all' ? 'جميع القنوات' : channelLabel(ch)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom dates, Category filter and search */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {statementPeriod === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={statementStartDate}
                      onChange={(e) => setStatementStartDate(e.target.value)}
                      className="p-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    />
                    <span className="text-stone-400">إلى</span>
                    <input
                      type="date"
                      value={statementEndDate}
                      onChange={(e) => setStatementEndDate(e.target.value)}
                      className="p-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    />
                  </div>
                )}

                {/* Category filter */}
                <select
                  value={statementCategoryFilter}
                  onChange={(e) => setStatementCategoryFilter(e.target.value)}
                  className="p-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                >
                  <option value="all">كل التصنيفات</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={statementSearch}
                    onChange={(e) => setStatementSearch(e.target.value)}
                    placeholder="بحث في البيان أو الملاحظة..."
                    className="w-full pr-8 pl-2 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  />
                </div>
              </div>

              {/* Movement Totals Summary */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-bold">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                  <div className="text-[10px] text-stone-500">إجمالي الوارد (مدين)</div>
                  <div className="text-sm font-black">+{statementTotals.totalIn.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                  <div className="text-[10px] text-stone-500">إجمالي الصادر (دائن)</div>
                  <div className="text-sm font-black">-{statementTotals.totalOut.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300">
                  <div className="text-[10px] text-stone-500">صافي الحركة في الفترة</div>
                  <div className="text-sm font-black">
                    {statementTotals.net >= 0 ? '+' : ''}
                    {statementTotals.net.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions Table Body */}
            <div className="flex-1 overflow-y-auto p-4 print:p-0">
              {statementLoading ? (
                <div className="py-12 text-center text-xs text-stone-500">جاري تحميل حركات الخزنة...</div>
              ) : filteredStatementData.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  لا توجد حركات مسجلة مطابقة للفترة أو شروط البحث المحددة.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400">
                        <th className="py-2.5 px-3 font-bold">التاريخ والوقت</th>
                        <th className="py-2.5 px-3 font-bold">البيان / التصنيف</th>
                        <th className="py-2.5 px-3 font-bold">القناة</th>
                        <th className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                          وارد (+)
                        </th>
                        <th className="py-2.5 px-3 font-bold text-rose-700 dark:text-rose-400">
                          صادر (-)
                        </th>
                        <th className="py-2.5 px-3 font-bold text-stone-800 dark:text-stone-200">
                          الرصيد التراكمي
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {filteredStatementData.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition"
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                            {new Date(item.occurred_at).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-stone-800 dark:text-stone-200">
                            <div>{item.category || 'حركة مالية'}</div>
                            {item.note && (
                              <div className="text-[10px] font-normal text-stone-400 mt-0.5">{item.note}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[10px] font-bold">
                              {channelIcon(item.channel)}
                              <span>{channelLabel(item.channel)}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-black text-emerald-600 dark:text-emerald-400">
                            {item.isIn ? `+${Number(item.amount).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-black text-rose-600 dark:text-rose-400">
                            {!item.isIn ? `-${Number(item.amount).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-black text-stone-900 dark:text-stone-100">
                            {item.runningBalance.toFixed(2)} {currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Print Footer / Modal Footer */}
            <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex items-center justify-between text-xs">
              <span className="text-stone-500">
                منظومة الشمساوية • {workshop.brandName || 'الورشة الحرفية'}
              </span>
              <button
                type="button"
                onClick={() => setStatementModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================
// SUB-COMPONENT: CustodyCard (بطاقة العهدة التابعة)
// =========================================================
interface CustodyCardProps {
  custody: SupabaseTreasuryBalance;
  currency: string;
  minAlert: number;
  onSetAlert: () => void;
  onTopUp: () => void;
  onReturn: () => void;
  onSettle: () => void;
  onStatement: () => void;
  onEdit: () => void;
}

const CustodyCard: React.FC<CustodyCardProps> = ({
  custody,
  currency,
  minAlert,
  onSetAlert,
  onTopUp,
  onReturn,
  onSettle,
  onStatement,
  onEdit,
}) => {
  const isOpen = custody.status === 'open';
  const isLow = minAlert > 0 && Number(custody.balance) <= minAlert && isOpen;

  return (
    <div
      className={`p-3.5 rounded-2xl border transition shadow-sm ${
        isLow
          ? 'bg-rose-50/50 dark:bg-stone-800/90 border-2 border-rose-500 shadow-rose-500/10'
          : isOpen
          ? 'bg-amber-50/40 dark:bg-stone-800/80 border-amber-200 dark:border-stone-700'
          : 'bg-stone-100/60 dark:bg-stone-800/30 border-stone-200 dark:border-stone-800 opacity-80'
      }`}
    >
      {/* RED ALERT FOR CUSTODY IF BELOW MINIMUM */}
      {isLow && (
        <div className="mb-2 p-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-black flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 shrink-0" />
            <span>سيولة العهدة أقل من حد الأمان ({minAlert.toFixed(2)})!</span>
          </div>
          <span>العجز: {(minAlert - Number(custody.balance)).toFixed(2)}</span>
        </div>
      )}

      <div className="flex items-center justify-between pb-2 border-b border-stone-200/60 dark:border-stone-700/60">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-md text-white text-[10px] font-black ${
                isLow ? 'bg-rose-600' : 'bg-amber-500'
              }`}
            >
              عهدة
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isOpen
                  ? isLow
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
              }`}
            >
              {isOpen ? (isLow ? 'سيولة منخفضة' : 'مفتوحة') : 'مسوّاة'}
            </span>
            <h5 className="text-xs font-black text-stone-900 dark:text-stone-100">{custody.name}</h5>
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5 font-bold">
            المستلم: {custody.holder_name || 'غير محدد'}
          </div>
        </div>

        <div
          className={`text-left font-black text-sm ${
            isLow ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          {Number(custody.balance).toFixed(2)}{' '}
          <span className="text-[10px] font-bold text-stone-500">{currency}</span>
        </div>
      </div>

      {/* Sub-balances */}
      <div className="flex items-center gap-2 py-1.5 text-[10px] text-stone-600 dark:text-stone-400">
        <span>كاش: {Number(custody.cash).toFixed(2)}</span>
        <span>•</span>
        <span>محفظة: {Number(custody.wallet).toFixed(2)}</span>
        <span>•</span>
        <span>إنستاباي: {Number(custody.instapay).toFixed(2)}</span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-stone-200/60 dark:border-stone-700/60">
        {isOpen ? (
          <>
            <button
              type="button"
              onClick={onTopUp}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold cursor-pointer"
              title="إضافة مبلغ للعهدة"
            >
              <Plus className="w-3 h-3" />
              <span>إضافة</span>
            </button>

            <button
              type="button"
              onClick={onReturn}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer"
              title="رد جزء من العهدة للخزنة"
            >
              <ArrowUpLeft className="w-3 h-3" />
              <span>رد</span>
            </button>

            <button
              type="button"
              onClick={onSettle}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold cursor-pointer"
              title="تسوية وإقفال العهدة نهائياً"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>تسوية</span>
            </button>

            <button
              type="button"
              onClick={onSetAlert}
              className={`p-1 rounded-lg border text-[10px] cursor-pointer ${
                isLow
                  ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                  : 'bg-white dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-600'
              }`}
              title="حد الأمان والتنبيه"
            >
              <BellRing className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={onStatement}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-200 text-[10px] font-bold cursor-pointer"
            >
              <FileText className="w-3 h-3 text-amber-500" />
              <span>كشف حساب</span>
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="p-1 rounded-lg text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
              title="تعديل"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <span className="text-[10px] text-stone-400 font-bold ml-auto">تم إقفال العهدة وتسويتها</span>
            <button
              type="button"
              onClick={onStatement}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-200 text-[10px] font-bold cursor-pointer"
            >
              <FileText className="w-3 h-3 text-amber-500" />
              <span>كشف حساب</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
