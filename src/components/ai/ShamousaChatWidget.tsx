import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  ArrowUp,
  Paperclip,
  Mic,
  MicOff,
  Database, 
  Trash2, 
  ArrowLeftRight, 
  PhoneCall, 
  ExternalLink,
  Calendar,
  Clock,
  Check,
  CheckCheck,
  CheckCircle2,
  Download,
  Plus,
  AlertCircle,
  FileText,
  User,
  Phone,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  Globe,
  HelpCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  BookPlus,
} from 'lucide-react';
import { AlShamsSunIcon, shamousaSearchIconImg, ShamousaMascotAvatar, ShamousaMascotFull } from '../brand/BrandAssets';
import { authedFetch } from '../../lib/apiClient';
import type { UserProfile } from '../../types';
import { DraggableShamosa } from './DraggableShamosa';
import { db, tenantStorage } from '../../db/dexieDB';
import { fetchMemberPersonalProfile, getCachedMemberPersonalProfile } from '../../db/memberProfileService';
import { getWorkOrdersFromSupabase } from '../../db/workshopInvoicesCloud';
import { playTaskDoneSound, playButtonClickSound, playSuccessSound } from '../../lib/sounds';
import { dispatchArtisanNotification } from '../../lib/pushNotifications';
import { getTreasuryBalancesFromSupabase } from '../../db/supabaseService';
import { fetchSupplierErpOverview } from '../../db/supplierErpService';
import { buildArtisanExecutiveBrief, buildSupplierExecutiveBrief } from '../../services/executiveBriefService';
import {
  resolveShamousaLocalChatbot,
  isCrossTenantOrSecretPrivacyQuery,
  setServerShamousaRules,
  ShamousaChatbotOption,
  ShamousaConversationState,
} from '../../services/shamousaLocalChatbot';
import { buildShamousaModePromptContext } from '../../services/shamousaBrain';
import {
  useExperienceMode,
  getPlatformExperienceModeConfig,
  getExperienceLabelFromConfig,
  type UserExperienceMode,
} from '../../types/experienceMode';
import {
  useUiLayoutConfig,
  DEFAULT_AI_ASSISTANTS_UI_CONFIG,
} from '../../types/uiLayoutConfig';
import {
  ShamousaUnifiedPanels,
  playShamousaReminderChime,
  parseArabicSnoozeRequest,
} from '../shamousa/ShamousaUnifiedPanels';
import { loadCompanionPrefs } from '../../services/orEngine';
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight';
import {
  loadShamousaOrMemory,
  dismissItemInMemory,
  dismissManyInMemory,
  restoreDismissedInMemory,
  markManyReadInMemory,
  recordShamousaQuestionFromPanel,
  buildShamousaMemoryPromptContext,
  buildInstantFallbackExplanation,
  type ShamousaExplainPayload,
} from '../../services/shamousaOrMemory';
import { useInstantVoiceDictation } from '../../hooks/useInstantVoiceDictation';
import { usePersonaSpeech } from '../../hooks/usePersonaSpeech';
import { useLiveConnectionStatus } from '../../hooks/useLiveConnectionStatus';
import {
  useUserSubscription,
  buildUserSubscriptionCapabilities,
  detectLockedSubscriptionQuery,
  buildAiSubscriptionPromptContext,
  isModuleUnlockedBySubscription,
  hasFeature,
  buildFourPartLockedPackageReply,
} from '../../types/subscriptions';
import {
  isNewProductWizardTrigger,
  startNewProductWizard,
  advanceProductWizard,
  saveProductWizardPrefillDraft,
  type ProductWizardState,
  type ProductWizardChoice,
  type ShamousaCopyBlock,
  type ProductWizardPrefillDraft,
} from '../../services/shamousaProductWizard';
import { analyzeImageQualityWithCanvas } from '../../services/shamousaImageQuality';
import {
  buildLibraryMarketingCopy,
  buildOfflineImageUploadResponse,
  matchCustomerObjectionFromLibrary,
  understandProductSentence,
} from '../../services/shamousaProductUnderstanding';
import {
  ADMIN_LIBRARY_CATEGORIES,
  INITIAL_ADMIN_REVIEW_SESSION,
  advanceSuperAdminReviewDialogue,
  buildSuperAdminLibraryGuide,
  countCustomLibraryItems,
  deleteCustomLibraryItemById,
  getEffectiveMarketingLibrary,
  hydrateCustomLibrariesFromServer,
  isSuperAdminGuideQuery,
  isSuperAdminReviewPendingQuery,
  loadCustomLibrariesStore,
  matchCustomKnowledgeNote,
  parseAndSaveAdminLibraryEntry,
  queueUnansweredQuestionForAdmin,
  recordAccountMarketingInsight,
  type AdminLibraryCategoryId,
  type SuperAdminReviewSessionState,
} from '../../services/shamousaCustomLibrariesStore';
import {
  analyzeAccountProductPricing,
  buildArtisanStorePostsAndWhatsapp,
  buildHeroSlowBundleOffer,
  buildProactiveTop3MarketingSuggestions,
  buildSupplierSlowStockVolumeTiers,
  buildSupplierStarterKitsFromStock,
  buildSupplierWorkshopPosts,
  computeProductionCapacityFromStock,
  formatEgyptianSeasonsReply,
  formatProactiveTop3Reply,
  formatUnifiedMaterialReply,
  parseExplicitDraftCostFromMessage,
  runDraftCostCalculationViaExistingEngine,
  runNewProductStockRadar,
  saveAccountSeasonDateOverride,
  tryParseSeasonDateOverrideCommand,
} from '../../services/shamousaMarketingPricingEngine';
import { auditPersonalProfileOffline } from '../../services/shamousaProfileAdvisor';
import {
  buildPackageAdaptiveDecisionReportOffline,
  runStoreMarketingReviewOffline,
  buildSafeDiscountOfferFromUserFloor,
  buildWhatsAppTemplatesOffline,
  type MinimumPriceOfferState,
  type ShamousaOpenEventDetail,
} from '../../services/shamousaMarketingAndDecision';
import {
  hydrateKnowledgeStoreFromServer,
  searchKnowledgeStoreLocal,
  enqueueUnansweredQuestionSanitized,
  recordShamousaAnswerMetric,
  sanitizeQuestionRemovePII,
} from '../../services/shamousaKnowledgeStore';
import {
  diagnoseTechnicalProblemOffline,
  matchMarketingMethodOffline,
  runAllThreeAnalyticBrainsOffline,
  formatAnalyticBrainsReply,
  type AnalyticBrainType,
} from '../../services/shamousaAnalyticBrains';
import {
  validateShamousaReplyBeforeSend,
  recordCopyTextFeedback,
  recordPublishedProductShare,
  buildWeeklyLearningSummary,
  resetAccountLearning,
  COPY_FEEDBACK_REASON_LABELS,
  type CopyFeedbackRating,
  type CopyFeedbackReason,
  type LearnedToneStyle,
} from '../../services/shamousaSelfCheckAndLearning';

export interface ShamousaActionLink {
  label: string;
  view: string;
}

export interface ShamousaContactAction {
  name: string;
  phone: string;
  type: 'customer' | 'supplier';
}

export interface SmartActionChip {
  id: string;
  label: string;
  view?: string;
  action?: 'open_agenda' | 'new_appointment' | 'open_expenses' | 'open_sales' | 'open_materials' | 'quick_purchase';
  materialPayload?: {
    materialId: string;
    materialName: string;
    unitCost?: number;
    unitName?: string;
  };
}

export type DisambiguationIntentKey =
  | 'root_ambiguous'
  | 'wh_menu'
  | 'wh_materials'
  | 'wh_products'
  | 'tr_menu'
  | 'tr_cash'
  | 'tr_receivables'
  | 'tr_payables'
  | 'full_brief'
  | 'sup_root_ambiguous'
  | 'sup_wh_menu'
  | 'sup_tr_menu'
  | 'sup_cash'
  | 'sup_receivables'
  | 'sup_payables'
  | 'sup_stock'
  | 'sup_full_brief';

export interface DisambiguationChoice {
  id: string;
  label: string;
  intentKey: DisambiguationIntentKey;
}

export interface ShamousaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  handoffToFalcon?: boolean;
  actionLink?: ShamousaActionLink;
  contactAction?: ShamousaContactAction;
  actionChips?: SmartActionChip[];
  disambiguationChoices?: DisambiguationChoice[];
  chatbotOptions?: ShamousaChatbotOption[];
  isLocalChatbot?: boolean;
  attachmentPreview?: string;
  sources?: Array<{ title: string; url: string }>;
  searchUsed?: boolean;
  copyBlocks?: ShamousaCopyBlock[];
  wizardChoices?: ProductWizardChoice[];
  wizardMultiSelected?: string[];
  productPrefillDraft?: ProductWizardPrefillDraft;
}

export interface WorkshopAppointment {
  id: string;
  title: string;
  type: 'delivery' | 'meeting' | 'supplies';
  clientName?: string;
  clientPhone?: string;
  orderNumber?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  notes?: string;
  status: 'upcoming' | 'completed';
  createdAt: number;
}

export interface ShamousaDailyTask {
  id: string;
  title: string;
  detail: string;
  urgency: 'high' | 'normal';
  actionLabel: string;
  view?: string;
}

export interface ShamousaChatWidgetProps {
  profile: UserProfile;
  onOpenFalcon: () => void;
  onNavigateView?: (view: string) => void;
  liftUp?: boolean;
  isAnyModalOpen?: boolean;
  hideFloatingLauncher?: boolean;
}

// استخراج الاسم الأول المباشر دون ألقاب رسمية
export function extractUserFirstName(rawName?: string): string {
  if (!rawName) return '';
  const cleaned = String(rawName)
    .trim()
    .replace(/^(المهندس|المهندسة|الفنان|الفنانة|الأستاذ|الأستاذة|المعلم|المدير|كابتن|دكتور|دكتورة|أ|م)\s+/gi, '');
  const first = cleaned.split(/\s+/)[0];
  return first || cleaned;
}

// الكشف الذكي عن روابط التنقل السريع عند طلب المستخدم صراحة
function detectNavigationIntent(text: string, isSupplier = false): ShamousaActionLink | undefined {
  const lower = text.toLowerCase();
  if (!isSupplier && (lower.includes('هلخصهالك') || lower.includes('بطاقة الملخص'))) {
    return { label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' };
  }
  if (isSupplier && (lower.includes('هلخصهالك') || lower.includes('بطاقة الملخص'))) {
    return { label: 'فتح هلخصهالك للموردين 📋', view: 'supplier_executive_brief' };
  }
  if (lower.includes('صفحتي الشخصية') || lower.includes('الصفحة الشخصية') || lower.includes('بروفايل') || lower.includes('معرض أعمال')) {
    return { label: 'فتح صفحتي الشخصية 👤', view: 'personal_profile' };
  }
  if (lower.includes('عيلة الشمساوية') || lower.includes('طبلية العيلة') || lower.includes('فتح المنتدى') || lower.includes('الشات العائلي')) {
    return { label: 'فتح مجتمع عيلة الشمساوية 👨‍👩‍👧‍👦', view: 'family' };
  }
  if (isSupplier && (lower.includes('مركز القيادة') || lower.includes('الفروع') || lower.includes('شجرة الفروع') || lower.includes('توريدات'))) {
    return { label: 'فتح مركز قيادة الفروع والخزينة 🌿', view: 'supplier_erp_hub' };
  }
  if (isSupplier && (lower.includes('كاشير') || lower.includes('نقاط البيع') || lower.includes('pos') || lower.includes('وردية') || lower.includes('شفت'))) {
    return { label: 'فتح كاشير نقاط البيع (POS) 🛒', view: 'supplier_pos' };
  }
  if (isSupplier && (lower.includes('كارت الصنف') || lower.includes('مصانع') || lower.includes('تحويل مخزن') || lower.includes('جرد الفروع'))) {
    return { label: 'فتح المخازن وكارت الصنف والمصانع 🏭', view: 'supplier_warehouse_erp' };
  }
  if (isSupplier && (lower.includes('تثبيت') || lower.includes('موظف') || lower.includes('حضور') || lower.includes('hr') || lower.includes('kiosk'))) {
    return { label: 'فتح شؤون العاملين وتثبيت الأجهزة 🖥️', view: 'supplier_hr_terminal' };
  }
  if (isSupplier && (lower.includes('كتالوج الخامات') || lower.includes('شرائح الكميات') || lower.includes('تنبيه عروض'))) {
    return { label: 'فتح كتالوج الخامات والشرائح 📦', view: 'supplier_catalog' };
  }
  if (isSupplier && (lower.includes('أوردرات') || lower.includes('طلبات التوريد'))) {
    return { label: 'فتح أوردرات المورد 🧾', view: 'supplier_orders' };
  }
  if (!isSupplier && (lower.includes('سوق الموردين') || lower.includes('مقارنة الأسعار') || lower.includes('مقارنة الموردين') || lower.includes('عروض الموردين'))) {
    return { label: 'فتح سوق موردين الشمساوية 🚚', view: 'suppliers_market' };
  }
  if (lower.includes('سوق الشمساوية')) {
    return { label: 'فتح سوق الشمساوية المركزي 🛍️', view: 'marketplace' };
  }
  if (lower.includes('متجري')) {
    return { label: isSupplier ? 'فتح متجر المورد 🏪' : 'فتح متجري الخاص 🏪', view: isSupplier ? 'supplier_store' : 'store' };
  }
  if (lower.includes('الحاسبة') || lower.includes('حاسبة التكاليف')) {
    return { label: 'فتح حاسبة التكاليف 🧮', view: 'calculator' };
  }
  if (lower.includes('فتح الخزن') || lower.includes('شاشة الخزينة') || lower.includes('صفحة الخزائن')) {
    return { label: 'فتح الخزائن والأرصدة', view: isSupplier ? 'supplier_erp_hub' : 'treasuries' };
  }
  if (lower.includes('فتح المخزن') || lower.includes('شاشة الخامات')) {
    return { label: 'فتح سجل الخامات والمخزون', view: isSupplier ? 'supplier_warehouse_erp' : 'materials' };
  }
  if (lower.includes('فتح المنتجات') || lower.includes('كتالوج المنتجات')) {
    return { label: 'فتح كتالوج المنتجات', view: 'catalog' };
  }
  if (lower.includes('فتح المبيعات') || lower.includes('شاشة الطلبات')) {
    return { label: 'فتح سجل المبيعات والطلبات', view: isSupplier ? 'supplier_pos' : 'sales' };
  }
  if (lower.includes('سجل العملاء') || lower.includes('شاشة العملاء')) {
    return { label: 'فتح قائمة العملاء', view: isSupplier ? 'supplier_customers' : 'customers' };
  }
  if (lower.includes('سجل الموردين') || lower.includes('شاشة الموردين')) {
    return { label: 'فتح قائمة الموردين', view: 'suppliers' };
  }
  if (lower.includes('التقارير المالية') || lower.includes('شاشة التقارير')) {
    return { label: 'فتح التقارير المالية', view: 'reports' };
  }
  return undefined;
}

// كشف الاستفسارات الغامضة أو الملتبسة (مثل "المخزينه" أو "تلخيص" عام) لتقديم أزرار توضيح ذكية
export function detectSummaryOrAmbiguousIntent(
  text: string,
  isSupplier = false
): DisambiguationIntentKey | null {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  // حماية الخصوصية أولاً: أي سؤال عن بيانات ورشة أو مورد آخر يُحال مباشرة لحارس الخصوصية
  if (isCrossTenantOrSecretPrivacyQuery(text)) return null;

  // استبعاد الأسئلة عن الصور أو الألوان أو بحث السوق أو المساعدة العامة الطويلة جداً غير المرتبطة بالملخص
  if (/صقر|منافسين|دراسة سوق|تعديل صوره|تعديل صورة/i.test(clean)) return null;

  // 1) كلمات ملتبسة حرفياً (مثل "المخزينه" أو خلط الخزنة مع المخزن)
  const hasHybridTypo = /مخزين|المخزين|الخزن[هة]\s*(ولا|و|أو)\s*المخزن|المخزن\s*(ولا|و|أو)\s*الخزن/i.test(clean);
  if (hasHybridTypo) {
    return isSupplier ? 'sup_root_ambiguous' : 'root_ambiguous';
  }

  // 2) طلب صريح ومحدد لفرع من فروع هلخصهالك / الملخص
  if (!isSupplier) {
    if (/هلخصهالك|بطاق[هة]\s*الملخص|ملخص\s*شامل|لخصي?لي\s*كل\s*حاج[هة]/i.test(clean)) {
      return 'full_brief';
    }
    if (/معانا\s*كام|معايا\s*كام|الفلوس\s*فين|كاش\s*وانستا|السيول[هة]\s*فين/i.test(clean)) {
      return 'tr_cash';
    }
    if (/لينا\s*(كام\s*)?بره|فلوس(نا)?\s*عند\s*(مين|العملا)|مين\s*عليه\s*فلوس|متأخر(ين)?\s*في\s*السداد/i.test(clean)) {
      return 'tr_receivables';
    }
    if (/علينا\s*(كام\s*)?(للموردين|لمين|بره)?|مستحقات\s*الموردين/i.test(clean)) {
      return 'tr_payables';
    }
    if (/مخزن\s*الخامات|أكتر\s*خام|سحب\s*الخامات|خامات\s*ناقص/i.test(clean)) {
      return 'wh_materials';
    }
    if (/مخزن\s*المنتج|أكتر\s*منتج\s*(ماشي|شغال|مبيع)|أقل\s*منتج\s*شغال/i.test(clean)) {
      return 'wh_products';
    }
  } else {
    if (/هلخصهالك|بطاق[هة]\s*الملخص|ملخص\s*شامل|لخصي?لي\s*كل\s*حاج[هة]/i.test(clean)) {
      return 'sup_full_brief';
    }
    if (/معانا\s*كام|حصيل[هة]\s*الفروع|خزين[هة]\s*المالك/i.test(clean)) {
      return 'sup_cash';
    }
    if (/لينا\s*(كام\s*)?بره|آجل\s*العملاء|فلوس\s*الورش/i.test(clean)) {
      return 'sup_receivables';
    }
    if (/علينا\s*(كام\s*)?(للمصانع|لمين)?|مستحقات\s*المصانع/i.test(clean)) {
      return 'sup_payables';
    }
    if (/قيم[هة]\s*المخزون|مخزون\s*الفروع/i.test(clean)) {
      return 'sup_stock';
    }
  }

  // 3) أسئلة عامة/غائمة تحتاج تفصيل باختيار واضح دون إحراج
  const hasWarehouseWord = /مخزن|المخزن|مخازن|بضاع[هة]/i.test(clean);
  const hasTreasuryWord = /خزن[هة]|الخزن[هة]|خزائن|حسابات|الفلوس|النقدية|سيول[هة]/i.test(clean);
  const isSummaryAsk = /تلخيص|ملخص|لخص|مختصر|وضع(نا)?\s*(ايه|إيه)|الدنيا\s*(ايه|إيه|فيها)/i.test(clean);

  if (hasWarehouseWord && hasTreasuryWord) {
    return isSupplier ? 'sup_root_ambiguous' : 'root_ambiguous';
  }
  if (isSummaryAsk && hasWarehouseWord) {
    return isSupplier ? 'sup_wh_menu' : 'wh_menu';
  }
  if (isSummaryAsk && hasTreasuryWord) {
    return isSupplier ? 'sup_tr_menu' : 'tr_menu';
  }
  if (isSummaryAsk && !/شرائح|مقارن|سوق|صقر|موعد|ميعاد/i.test(clean)) {
    return isSupplier ? 'sup_root_ambiguous' : 'root_ambiguous';
  }
  if (/^(المخزن|مخزن|ملخص المخزن)$/i.test(clean)) {
    return isSupplier ? 'sup_wh_menu' : 'wh_menu';
  }
  if (/^(الخزنة|الخزنه|خزنة|ملخص الخزنة|الحسابات)$/i.test(clean)) {
    return isSupplier ? 'sup_tr_menu' : 'tr_menu';
  }

  return null;
}

// الكشف الذكي بالكلمات الدلالية وتوليد أزرار إجراء مرتبطة فقط بموضوع السؤال الفعلي
export function detectKeywordActionChips(
  userQuery: string,
  isSupplier = false,
  experienceMode: UserExperienceMode = 'craft'
): SmartActionChip[] {
  const chips: SmartActionChip[] = [];
  const lower = userQuery.toLowerCase();
  const expCfg = getPlatformExperienceModeConfig();

  // 0. هلخصهالك والملخص للورش والموردين
  if (!isSupplier && /هلخصهالك|ملخص|تلخيص|لخص|معانا كام|لينا بره|علينا كام|موقف مالي/i.test(lower)) {
    chips.push({ id: 'chip_exec_brief', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' });
  }
  if (isSupplier && /هلخصهالك|ملخص|تلخيص|لخص|معانا كام|لينا بره|علينا كام|موقف مالي/i.test(lower)) {
    chips.push({
      id: 'chip_sup_exec_brief',
      label: `${getExperienceLabelFromConfig(expCfg, 'sup_exec_brief_card', experienceMode)} 📋`,
      view: 'supplier_executive_brief',
    });
  }

  // 1. الصفحة الشخصية ومعرض الأعمال + مجتمع العيلة
  if (/صفحتي|شخصي|بروفايل|معرض أعمال|6 صور|صور أعمال|خصوصي|معاينة/i.test(lower)) {
    chips.push({ id: 'chip_personal_profile', label: 'فتح صفحتي الشخصية 👤', view: 'personal_profile' });
  }
  if (/عيلة|العيلة|منتدى|طبلية|منشور|شات|تعارف/i.test(lower)) {
    chips.push({ id: 'chip_family', label: 'طبلية عيلة الشمساوية 👨‍👩‍👧‍👦', view: 'family' });
  }

  // 2. إدارة الفروع وتثبيت الأجهزة والـ POS للمورد
  if (isSupplier && /فرع|فروع|شجرة|مركزي|توريد|استلام الفلوس|اعتماد|خزن|معانا كام/i.test(lower)) {
    chips.push({
      id: 'chip_sup_erp_hub',
      label: `${getExperienceLabelFromConfig(expCfg, 'sup_erp_hub_card', experienceMode)} 🌿`,
      view: 'supplier_erp_hub',
    });
  }
  if (isSupplier && /دائن|مدين|خزينة|خزائن|أستاذ|قيود|حسابات/i.test(lower)) {
    chips.push({
      id: 'chip_sup_fin',
      label: `${getExperienceLabelFromConfig(expCfg, 'sup_finance_title', experienceMode)} 🏦`,
      view: 'supplier_finance',
    });
  }
  if (isSupplier && /كاشير|pos|نقطة بيع|وردية|شفت|انستاباي|إنستاباي|محفظة|بيع مباشر|كسر|وزن/i.test(lower)) {
    chips.push({ id: 'chip_sup_pos', label: 'كاشير نقاط البيع (POS) 🛒', view: 'supplier_pos' });
  }
  if (isSupplier && /كارت الصنف|مصنع|مصانع|علينا كام|طرد|تحويل|جرد/i.test(lower)) {
    chips.push({
      id: 'chip_sup_wh',
      label: `${getExperienceLabelFromConfig(expCfg, 'sup_warehouse_card', experienceMode)} 🏭`,
      view: 'supplier_warehouse_erp',
    });
  }
  if (isSupplier && /تثبيت|kiosk|جهاز|موظف|حضور|انصراف|سلف|جزاء|حافز|باسورد|pin/i.test(lower)) {
    chips.push({
      id: 'chip_sup_hr',
      label: `${getExperienceLabelFromConfig(expCfg, 'sup_hr_card', experienceMode)} 🖥️`,
      view: 'supplier_hr_terminal',
    });
  }

  // 3. الخزينة / الفلوس / السيولة / الكاش / المصروف
  if (!isSupplier && /خزن|خزنة|خزينة|سيول|سيولة|كاش|انستاباي|إنستاباي|محفظة|نقدية|معانا كام|دائن|مدين/i.test(lower)) {
    chips.push({
      id: 'chip_treasuries',
      label: `${getExperienceLabelFromConfig(expCfg, 'fin_treasury_title', experienceMode)} 💰`,
      view: 'treasuries',
    });
  }

  // 3.5 التقارير وميزان المراجعة
  if (!isSupplier && /تقرير|تقارير|رسوم|ميزان|أرباح|ارباح|خلاصة/i.test(lower)) {
    chips.push({
      id: 'chip_reports',
      label: `${getExperienceLabelFromConfig(expCfg, 'rep_page_title', experienceMode)} 📊`,
      view: 'reports',
    });
  }

  // 4. الخامات / المشتريات / الموردين
  if (!isSupplier && /خام|خامات|نواقص|سحب/i.test(lower)) {
    chips.push({ id: 'chip_mats', label: 'مخزن الخامات 🧶', view: 'materials' });
  }
  if (!isSupplier && /علينا كام|مورد|موردين|فواتير شراء|سوق الموردين/i.test(lower)) {
    chips.push({ id: 'chip_sups', label: 'الموردين والمشتريات 🚚', view: 'suppliers' });
  }

  // 5. العملاء / لينا بره / المبيعات / المنتجات
  if (!isSupplier && /لينا بره|عميل|عملاء|متأخر|تحصيل|آجل/i.test(lower)) {
    chips.push({ id: 'chip_custs', label: 'عملائي وكشف الحساب 👥', view: 'customers' });
  } else if (!isSupplier && /مبيعات|أوردر|طلبية|بيع/i.test(lower)) {
    chips.push({ id: 'chip_sales', label: 'سجل المبيعات والطلبات 🧾', view: 'sales' });
  }
  if (!isSupplier && /منتج ماشي|أكتر منتج|كتالوج|منتجات جاهزة/i.test(lower)) {
    chips.push({ id: 'chip_cat', label: 'كتالوج المنتجات 🛍️', view: 'catalog' });
  }

  // 6. الحاسبة والتسعير (للورش)
  if (!isSupplier && /حاسبة|تسعير|سعر بيع|هامش|تكلفة/i.test(lower)) {
    chips.push({ id: 'chip_calc', label: 'فتح حاسبة التكاليف 🧮', view: 'calculator' });
  }

  // 7. المواعيد / الأجندة / التقويم / التسليم
  if (/موعد|مواعيد|أجندة|اجندة|تقويم|تسليم|ميعاد/i.test(lower)) {
    chips.push({ id: 'chip_agenda', label: 'عرض مواعيد وأجندة الورشة 📅', action: 'open_agenda' });
    chips.push({ id: 'chip_new_appt', label: 'تسجيل موعد جديد ➕', action: 'new_appointment' });
  }

  // 8. أوامر التشغيل / التصنيع / الصنايعية / بواقي الخامات
  if (!isSupplier && /تشغيل|أمر تشغيل|تصنيع|صنايعي|حرفي|عمال|أجور|بواقي|اتفضل|إذن|اذن/i.test(lower)) {
    chips.push({
      id: 'chip_wo',
      label: `${getExperienceLabelFromConfig(expCfg, 'wo_page_title', experienceMode)} 🔨`,
      view: 'work_orders',
    });
  }

  return chips.slice(0, 3);
}

// دالة إنشاء رابط تقويم جوجل بنقرة واحدة
export function createGoogleCalendarUrl(appointment: {
  title: string;
  date: string;
  time?: string;
  notes?: string;
  clientName?: string;
  clientPhone?: string;
  brandName?: string;
}): string {
  const [year, month, day] = appointment.date.split('-').map(Number);
  let startHour = 10;
  let startMinute = 0;
  if (appointment.time) {
    const [h, m] = appointment.time.split(':').map(Number);
    if (!isNaN(h)) startHour = h;
    if (!isNaN(m)) startMinute = m;
  }
  const startDate = new Date(year, (month || 1) - 1, day || 1, startHour, startMinute);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatGCalDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const text = encodeURIComponent(appointment.title || 'موعد تسليم ورشة الشمساوية');
  const dates = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;
  const details = encodeURIComponent(
    `موعد في ${appointment.brandName || 'ورشة الشمساوية'}\n` +
    (appointment.clientName ? `العميل: ${appointment.clientName}\n` : '') +
    (appointment.clientPhone ? `الهاتف: ${appointment.clientPhone}\n` : '') +
    (appointment.notes ? `ملاحظات: ${appointment.notes}\n` : '')
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}

// دالة تنزيل ملف التقويم .ics
export function downloadIcsFile(appointment: {
  id: string;
  title: string;
  date: string;
  time?: string;
  notes?: string;
  clientName?: string;
  brandName?: string;
}) {
  const [year, month, day] = appointment.date.split('-').map(Number);
  let startHour = 10;
  let startMinute = 0;
  if (appointment.time) {
    const [h, m] = appointment.time.split(':').map(Number);
    if (!isNaN(h)) startHour = h;
    if (!isNaN(m)) startMinute = m;
  }
  const startDate = new Date(year, (month || 1) - 1, day || 1, startHour, startMinute);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatIcsDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AlShams Handmade Workshop//AR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${appointment.id || Date.now()}@alshams.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${appointment.title}`,
    `DESCRIPTION:${(appointment.notes || '') + (appointment.clientName ? ' - العميل: ' + appointment.clientName : '')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${appointment.title || 'موعد_الشمساوية'}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-extrabold text-[#142A5C] dark:text-[#CBD5E1]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export const ShamousaChatWidget: React.FC<ShamousaChatWidgetProps> = ({
  profile,
  onOpenFalcon,
  onNavigateView,
  liftUp = false,
  isAnyModalOpen = false,
  hideFloatingLauncher = false,
}) => {
  const uiLayout = useUiLayoutConfig();
  const aiCfg = uiLayout.aiAssistantsConfig || DEFAULT_AI_ASSISTANTS_UI_CONFIG;
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  const storageKey = `shamousa_chat_${workshopId}`;
  const agendaStorageKey = `alshams_agenda_${workshopId || 'default'}`;
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tasksDoneStorageKey = `alshams_shamousa_tasks_done_${workshopId}_${todayDateStr}`;

  const isSupplierAccount = profile?.accountRole === 'supplier';
  const {
    mode: experienceMode,
    setMode: setExperienceMode,
    config: experienceModeConfig,
    getLabel: getModeLabel,
    allowSwitch: allowModeSwitch,
  } = useExperienceMode(isSupplierAccount ? 'supplier' : 'artisan', profile);
  const isCraftMode = experienceMode === 'craft';
  const firstName = extractUserFirstName((profile as any).fullName || (profile as any).name || profile.artistName || (profile as any).artisanName) || 'صديقي';
  const brandTitle = profile.brandName
    ? `${isSupplierAccount ? 'متجر' : 'ورشة'} ${profile.brandName}`
    : isSupplierAccount
    ? 'بوابة الموردين'
    : 'الورشة الحرفية';

  const isSuperAdminAccount =
    /hmb\.top\.tu[bp]e/i.test(String(profile.email || '').trim());

  // وضع إضافة المكتبات الحصري للسوبر أدمن داخل شات شموسة
  const [adminLibMenuOpen, setAdminLibMenuOpen] = useState(false);
  const [activeAdminLibCategory, setActiveAdminLibCategory] = useState<AdminLibraryCategoryId | null>(null);
  const [showAdminLibSavedList, setShowAdminLibSavedList] = useState(false);
  const [customLibVersion, setCustomLibVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authedFetch('/api/shamousa/custom-libraries')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.store) {
          hydrateCustomLibrariesFromServer(d.store);
          setCustomLibVersion((v) => v + 1);
        }
      })
      .catch(() => {
        // يعمل أوفلاين بالكامل من localStorage بدون أي تعطّل
      });
    authedFetch('/api/shamousa/knowledge')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.store) {
          hydrateKnowledgeStoreFromServer(d.store);
        }
      })
      .catch(() => {
        // المخزن المعرفي يعمل أوفلاين بالكامل حتى بدون اتصال
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userSub = useUserSubscription(profile);
  const subRole: 'artisan' | 'supplier' = isSupplierAccount ? 'supplier' : 'artisan';
  const subCaps = useMemo(
    () => buildUserSubscriptionCapabilities(userSub, subRole, isSuperAdminAccount),
    [userSub, subRole, isSuperAdminAccount]
  );
  const accountIdForPkg = profile.id || workshopId;
  const pkgQueryOptions = useMemo(
    () => ({ role: subRole, isAdmin: isSuperAdminAccount, overrideSub: userSub }),
    [subRole, isSuperAdminAccount, userSub]
  );

  const isViewUnlocked = (view?: string): boolean => {
    if (!view || view === 'home' || view === 'my_subscriptions' || view === 'personal_profile' || view === 'settings' || view === 'family') {
      return true;
    }
    if (view === 'direct_product_prefill') {
      return hasFeature('storefront', accountIdForPkg, pkgQueryOptions) || hasFeature('catalog', accountIdForPkg, pkgQueryOptions);
    }
    return isModuleUnlockedBySubscription(view, userSub, subRole, isSuperAdminAccount);
  };

  const welcomeMessage = useMemo(() => {
    if (!subCaps.isFullAccess) {
      const unlockedList: string[] = ['صفحتك الشخصية وطبلية العيلة', 'معالج منتج جديد'];
      if (subCaps.canStorefront || subCaps.canCatalog) unlockedList.push('متجرك ومراجعة منتجاتك ورسائل الواتساب');
      if (subCaps.canOrders) unlockedList.push('أوردراتك');
      if (subCaps.canProduction) unlockedList.push('التسعير والتصنيع');
      if (subCaps.canInventory) unlockedList.push('المخزون والخامات');
      if (subCaps.canFinance) unlockedList.push('الخزائن والحسابات');
      if (subCaps.canSalesCrm) unlockedList.push(isSupplierAccount ? 'الكاشير والعملاء' : 'المبيعات والعملاء');
      if (subCaps.canHr) unlockedList.push('فريق العمل');
      const scopeSummary = unlockedList.join('، ');
      return `أهلاً بيك يا **${firstName}**! ☀️\nأنا **شموسة** — معاك على قد باقاتك المفعّلة دلوقتي (${subCaps.activePackageTitles.join(' + ')}).\nأقدر أساعدك فوراً في: **${scopeSummary}**.`;
    }
    return isSupplierAccount
      ? isCraftMode
        ? `أهلاً بيك يا **${firstName}**! ☀️ نوّرت بوابة الموردين (**الوضع الحرفي البسيط**).\nأنا **شموسة** — هكلّمك بلغة المحل السهلة من غير تعقيد، وهساعدك في تجهيز منتجاتك، التحليل والحلول الذكية، ومتابعة الفلوس والمخازن والبيع فوراً.`
        : `أهلاً بيك يا **${firstName}**! ☀️ نوّرت بوابة الموردين (**الوضع المحاسبي المتقدم**).\nأنا **شموسة** — جاهزة معاك بكل التفاصيل: **${getModeLabel('sup_finance_title')}**، التحليل والحلول الذكية، وتسويات الفروع والمخزون.`
      : isCraftMode
      ? `أهلاً بيك يا **${firstName}**! ☀️ نوّرت الشمساوية (**الوضع الحرفي البسيط**).\nأنا **شموسة** — هساعدك في تجهيز منتج جديد، مراجعة صفحتك ومنتجاتك، التحليل والحلول الذكية، والتسعير و**${getModeLabel('wo_page_title')}**.`
      : `أهلاً بيك يا **${firstName}**! ☀️ نوّرت الشمساوية (**الوضع المحاسبي المتقدم**).\nأنا **شموسة** — جاهزة معاك بكل الأدوات: معالج منتج جديد، التحليل والحلول الذكية، **${getModeLabel('wo_issue_voucher')}**، و**${getModeLabel('rep_trial_balance')}**.`;
  }, [subCaps, firstName, isSupplierAccount, isCraftMode, getModeLabel]);

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'daily' | 'tasks_agenda' | 'results' | 'or360'>('chat');
  const conversationStateRef = useRef<ShamousaConversationState>({});
  const productWizardRef = useRef<ProductWizardState>({
    active: false,
    currentStep: null,
    awaitingCustomInput: false,
    data: { features: [] },
  });
  const minPriceOfferRef = useRef<MinimumPriceOfferState>({ awaitingFloorPrice: false });
  const adminReviewSessionRef = useRef<SuperAdminReviewSessionState>(INITIAL_ADMIN_REVIEW_SESSION);
  const sendLatestRef = useRef<((text: string, opts?: any) => Promise<void>) | null>(null);
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const [copyFeedbackByKey, setCopyFeedbackByKey] = useState<
    Record<
      string,
      {
        rating?: CopyFeedbackRating;
        reason?: CopyFeedbackReason;
        awaitingReason?: boolean;
        published?: boolean;
      }
    >
  >({});
  const customRulesLoadedRef = useRef(false);

  // تثبيت الهيدر العلوي بذكاء عند فتح كيبورد الموبايل (VisualViewport)
  const vp = useVisualViewportHeight(isOpen, { lockBodyScroll: true });

  // رسالة تلميح خفيفة من سطر واحد تظهر لثانيتين عند فتح مهام / نتائج / بحوث
  const [showQuestionHint, setShowQuestionHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);
  const triggerTopQuestionHint = () => {
    setShowQuestionHint(true);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      setShowQuestionHint(false);
    }, 2800);
  };
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    };
  }, []);

  // حالة الذاكرة المتبادلة (المقروء + المستبعد + العناصر الموسّعة) لقسم مهام وأجندة
  const [taskMemory, setTaskMemory] = useState(() => loadShamousaOrMemory(workshopId));
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setTaskMemory(loadShamousaOrMemory(workshopId));
  }, [workshopId, isOpen]);

  // Orbit & 8:00 PM Daily Auto-Check-in + Snooze state
  const [orbitTriggerNonce, setOrbitTriggerNonce] = useState(0);
  const [isGlowingAlert, setIsGlowingAlert] = useState(false);
  const [dailyCheckinTime, setDailyCheckinTime] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`shamousa_daily_time_${workshopId}`);
      if (saved && /^\d{2}:\d{2}$/.test(saved)) return saved;
    } catch {}
    return aiCfg.shamousaDailyDefaultTime || '20:00';
  });
  const [injectedDailyFollowup, setInjectedDailyFollowup] = useState<{ id: string; text: string } | null>(null);
  const pendingFollowupAfterOrbitRef = useRef<string | null>(null);
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const isAnyModalOpenRef = useRef(Boolean(isAnyModalOpen));
  useEffect(() => {
    isAnyModalOpenRef.current = Boolean(isAnyModalOpen);
  }, [isAnyModalOpen]);

  const snoozeStorageKey = `shamousa_snooze_until_${workshopId}`;
  const dailyDoneStorageKey = `shamousa_daily_done_${workshopId}`;
  const dailyRemindedStorageKey = `shamousa_daily_reminded_${workshopId}`;
  const sessionOrbitDoneKey = `shamousa_orbit_done_session_${workshopId}`;
  const hasAutoOrbitedThisSessionRef = useRef<boolean>(false);

  // مزامنة وقت الفضفضة اليومي من إعدادات المستخدم
  useEffect(() => {
    if (!profile) return;
    loadCompanionPrefs(profile)
      .then((p) => {
        if (p?.fadfada_time && /^\d{2}:\d{2}$/.test(p.fadfada_time)) {
          setDailyCheckinTime(p.fadfada_time);
          try {
            localStorage.setItem(`shamousa_daily_time_${workshopId}`, p.fadfada_time);
          } catch {}
        }
      })
      .catch(() => {});
  }, [profile, workshopId]);

  const handleScheduleSnooze = (wakeAtMs: number, labelAr: string, durationSummary: string) => {
    try {
      localStorage.setItem(
        snoozeStorageKey,
        JSON.stringify({ wakeAtMs, labelAr, durationSummary })
      );
    } catch {}
  };

  const triggerShamousaAttention = (followupText: string, isManualDemo = false) => {
    // لا تقاطع المستخدم أبداً لو فيه أي نافذة أو شاشة تفعيل/إعداد مفتوحة
    if (!isManualDemo && isAnyModalOpenRef.current) return;

    // اللفة التلقائية مرة واحدة فقط في الجلسة كلها بعد الدخول الكامل — مستحيل تتكرر!
    if (!isManualDemo) {
      let alreadyOrbited = hasAutoOrbitedThisSessionRef.current;
      try {
        if (sessionStorage.getItem(sessionOrbitDoneKey) === '1') alreadyOrbited = true;
      } catch {}
      if (alreadyOrbited) return;
      hasAutoOrbitedThisSessionRef.current = true;
      try {
        sessionStorage.setItem(sessionOrbitDoneKey, '1');
      } catch {}
    }

    playShamousaReminderChime();
    if (isOpenRef.current) {
      setActiveTab('daily');
      setInjectedDailyFollowup({ id: `fu_${Date.now()}`, text: followupText });
      return;
    }
    pendingFollowupAfterOrbitRef.current = followupText;
    setIsGlowingAlert(true);
    setOrbitTriggerNonce(Date.now());
  };

  const handleOrbitComplete = () => {
    // تصفير النونص فوراً حتى لا تعيد شموسة اللفة أبداً عند إغلاق الشات!
    setOrbitTriggerNonce(0);
    setIsGlowingAlert(false);
    const pendingMsg = pendingFollowupAfterOrbitRef.current;
    pendingFollowupAfterOrbitRef.current = null;
    if (isAnyModalOpenRef.current) return;
    setIsOpen(true);
    setActiveTab('daily');
    if (pendingMsg) {
      setInjectedDailyFollowup({ id: `fu_${Date.now()}`, text: pendingMsg });
    }
  };

  const handleTestOrbitDemo = () => {
    const demoText = (aiCfg.shamousaSnoozeFollowupText || DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaSnoozeFollowupText).replace(
      /\{name\}/g,
      firstName
    );
    setIsOpen(false);
    setTimeout(() => {
      pendingFollowupAfterOrbitRef.current = demoText;
      playShamousaReminderChime();
      setIsGlowingAlert(true);
      setOrbitTriggerNonce(Date.now());
    }, 260);
  };

  // المجدول الذكي الخلفي: يعمل بعد استقرار الدخول بالكامل، وبحد أقصى لفة واحدة فقط بدون أي تكرار
  useEffect(() => {
    if (!profile?.id || !workshopId) return;
    const checkReminders = () => {
      // لا تبدأ أي حركة أثناء فتح نافذة/مودال أو إذا كانت الصفحة في الخلفية أو الشات مفتوح بالفعل
      if (isAnyModalOpenRef.current || isOpenRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      // لو شموسة لفت لفتها الوحيدة في الجلسة خلاص -> اخرج فوراً
      try {
        if (hasAutoOrbitedThisSessionRef.current || sessionStorage.getItem(sessionOrbitDoneKey) === '1') {
          return;
        }
      } catch {}

      const nowMs = Date.now();
      const todayIso = new Date().toISOString().slice(0, 10);

      // 1) فحص التأجيل المجدول ("استني ساعة" أو ميعاد مخصص)
      try {
        const rawSnooze = localStorage.getItem(snoozeStorageKey);
        if (rawSnooze) {
          const parsed = JSON.parse(rawSnooze) as {
            wakeAtMs?: number;
            labelAr?: string;
            durationSummary?: string;
          };
          if (parsed?.wakeAtMs && nowMs >= parsed.wakeAtMs) {
            localStorage.removeItem(snoozeStorageKey);
            const template =
              aiCfg.shamousaSnoozeFollowupText ||
              DEFAULT_AI_ASSISTANTS_UI_CONFIG.shamousaSnoozeFollowupText;
            const comebackMsg = template.replace(/\{name\}/g, firstName);
            triggerShamousaAttention(comebackMsg);
            return;
          }
          // يوجد تأجيل نشط لم يحن موعده بعد -> لا تقطع شغل المستخدم بالتنبيه اليومي
          if (parsed?.wakeAtMs && nowMs < parsed.wakeAtMs) {
            return;
          }
        }
      } catch {}

      // 2) فحص ميعاد الطمأنة اليومي (الافتراضي 20:00 — 8 مساءً) — مرة واحدة فقط في اليوم
      try {
        const doneDate = localStorage.getItem(dailyDoneStorageKey);
        const remindedDate = localStorage.getItem(dailyRemindedStorageKey);
        if (doneDate === todayIso || remindedDate === todayIso) return;

        const targetHHmm = dailyCheckinTime || aiCfg.shamousaDailyDefaultTime || '20:00';
        const [th, tm] = targetHHmm.split(':').map(Number);
        if (!Number.isFinite(th) || !Number.isFinite(tm)) return;

        const nowDate = new Date();
        const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
        const targetMinutes = th * 60 + tm;

        if (currentMinutes >= targetMinutes) {
          localStorage.setItem(dailyRemindedStorageKey, todayIso);
          const eveningGreeting = `مساء الخير يا ${firstName} 🌙✨ جه ميعادنا اليومي سوا! احكيلي يومك في ${
            isSupplierAccount ? 'المحل والتوريدات' : 'الورشة والشغل'
          } كان ماشي إزاي؟ ولو مشغول دلوقتي قولي "استني ساعة" وهلفلك وأرجعلك تاني ☀️`;
          triggerShamousaAttention(eveningGreeting);
        }
      } catch {}
    };

    // ننتظر 10 ثوانٍ بعد استقرار الدخول الكامل في المنظومة قبل أول فحص
    const initialTimer = window.setTimeout(checkReminders, 10000);
    const intervalId = window.setInterval(checkReminders, 30000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
    };
  }, [
    profile?.id,
    workshopId,
    dailyCheckinTime,
    aiCfg.shamousaDailyDefaultTime,
    aiCfg.shamousaSnoozeFollowupText,
    firstName,
    isSupplierAccount,
    snoozeStorageKey,
    dailyDoneStorageKey,
    dailyRemindedStorageKey,
    sessionOrbitDoneKey,
  ]);

  // الاستماع لحدث فتح شات شموسة الواحد من أي زر في المنظومة وتنفيذ النية داخل نفس المحادثة
  useEffect(() => {
    const handleOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<ShamousaOpenEventDetail | undefined>)?.detail;
      setIsOpen(true);
      setActiveTab('chat');
      if (detail?.prompt && detail.autoSend) {
        window.setTimeout(() => {
          void sendLatestRef.current?.(detail.prompt!);
        }, 120);
      } else if (detail?.intent) {
        const intentPromptMap: Record<string, string> = {
          decision_report: 'التحليل والحلول الذكية',
          new_product_wizard: 'منتج جديد',
          review_products: 'راجع منتجاتي',
          write_post: 'اكتب لي بوست',
          whatsapp_message: 'رسالة واتساب',
          personal_profile_audit: 'راجع صفحتي الشخصية',
          family_table_idea: 'فكرة بوست لطبلية عيلة الشمساوية',
        };
        const mapped = intentPromptMap[detail.intent];
        if (mapped) {
          window.setTimeout(() => {
            void sendLatestRef.current?.(mapped);
          }, 120);
        }
      }
    };
    window.addEventListener('alshams_open_shamousa', handleOpen);
    return () => window.removeEventListener('alshams_open_shamousa', handleOpen);
  }, []);

  // مزامنة قواعد القاموس المضافة من السوبر أدمن تلقائياً عند فتح شموسة
  useEffect(() => {
    if (!isOpen || customRulesLoadedRef.current) return;
    customRulesLoadedRef.current = true;
    authedFetch('/api/shamousa/custom-rules')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.rules)) {
          setServerShamousaRules(data.rules);
        }
      })
      .catch(() => {});
  }, [isOpen]);
  
  // Chat messages
  const [messages, setMessages] = useState<ShamousaMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputLatestRef = useRef(input);
  inputLatestRef.current = input;

  // Modern Chat UX additions: Auto-expanding, Instant Voice, Free TTS, Attachments
  const [pendingAttachment, setPendingAttachment] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const shamousaConn = useLiveConnectionStatus(useGoogleSearch, isOpen);

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 52), 132) + 'px';
  };

  // Instant zero-cost keyboard-speed voice dictation (live into textarea, no scary red banner)
  const {
    isListening: isRecordingVoice,
    isFallbackProcessing: isTranscribingVoice,
    toggleListening: toggleVoiceRecording,
    stopListening: stopVoiceRecording,
  } = useInstantVoiceDictation({
    getCurrentValue: () => inputLatestRef.current,
    onTextChange: (nextValue) => {
      setInput(nextValue);
      setTimeout(() => adjustTextareaHeight(inputRef.current), 15);
    },
    lang: 'ar-EG',
  });

  // Free built-in Egyptian/Arabic voice speaker (ON by default, toggleable from header)
  const shamousaSpeech = usePersonaSpeech('shamousa');
  const lastSpokenMsgIdRef = useRef<string | null>(
    messages.length > 0 ? messages[messages.length - 1].id : null
  );

  // Auto-read every new Shamousa reply when speaker is ON
  useEffect(() => {
    if (!isOpen || activeTab !== 'chat') {
      shamousaSpeech.stop();
      if (!isOpen) stopVoiceRecording();
      return;
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (lastSpokenMsgIdRef.current === last.id) return;
    lastSpokenMsgIdRef.current = last.id;
    if (shamousaSpeech.isEnabled) {
      shamousaSpeech.speak(last.content);
    }
  }, [messages, isOpen, activeTab, shamousaSpeech.isEnabled]);

  const handleAttachmentSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPendingAttachment({ base64, mimeType: file.type || 'image/jpeg', name: file.name });
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Daily Tasks state
  const [dailyTasks, setDailyTasks] = useState<ShamousaDailyTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(tasksDoneStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Agenda Appointments state
  const [appointments, setAppointments] = useState<WorkshopAppointment[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(agendaStorageKey);
      if (raw) return JSON.parse(raw);
    } catch {}

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return [
      {
        id: 'appt_1',
        title: 'تسليم طقم معلقات مكرمية بوهيمي',
        type: 'delivery',
        clientName: 'أ. سارة عبد الرحمن',
        clientPhone: '01012345678',
        orderNumber: 'ORD-2026-14',
        date: tomorrow.toISOString().slice(0, 10),
        time: '17:00',
        notes: 'تغليف هدايا فاخر مع كارت إهداء خاص بالورشة',
        status: 'upcoming',
        createdAt: Date.now() - 86400000,
      },
    ];
  });

  // New appointment quick modal form state
  const [isNewApptFormOpen, setIsNewApptFormOpen] = useState(false);
  const [apptFormTitle, setApptFormTitle] = useState('');
  const [apptFormClient, setApptFormClient] = useState('');
  const [apptFormPhone, setApptFormPhone] = useState('');
  const [apptFormDate, setApptFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [apptFormTime, setApptFormTime] = useState('16:00');
  const [apptFormNotes, setApptFormNotes] = useState('');

  // Save appointments to storage
  const saveAppointments = (list: WorkshopAppointment[]) => {
    setAppointments(list);
    try {
      localStorage.setItem(agendaStorageKey, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('alshams_agenda_updated', { detail: list }));
    } catch {}
  };

  // Load real workshop data to generate smart daily tasks (strictly scoped to user's active subscription)
  const loadDailyTasks = async () => {
    if (!workshopId) return;
    try {
      const tasks: ShamousaDailyTask[] = [];

      // 1. Raw materials low stock (فقط لو باقة المخازن والخامات مفعّلة)
      if (subCaps.canInventory) {
        const rawMaterials = await tenantStorage.getRawMaterials(workshopId).catch(() => []);
        const depleting = rawMaterials.filter(
          (m: any) => (m.currentStock || 0) <= (m.minAlertThreshold || 5) && m.isActive !== false
        );
        depleting.slice(0, 2).forEach((mat: any) => {
          tasks.push({
            id: `task_mat_${mat.id}`,
            title: `الخامة "${mat.materialName}" قربت تخلص`,
            detail: `المتبقي في المخزن ${mat.currentStock || 0} ${mat.unit || 'وحدة'} فقط (حد الأمان: ${mat.minAlertThreshold || 5}). محتاجين نطلب منها توريد.`,
            urgency: 'high',
            actionLabel: 'فتح مخزن الخامات 🧶',
            view: isSupplierAccount ? 'supplier_warehouse_erp' : 'materials',
          });
        });
      }

      // 2. Open work orders (فقط لو باقة التصنيع وأوامر التشغيل مفعّلة)
      if (subCaps.canProduction && !isSupplierAccount) {
        const [dexieWo, fsWo] = await Promise.all([
          tenantStorage.getWorkOrders(workshopId).catch(() => []),
          getWorkOrdersFromSupabase(workshopId).catch(() => []),
        ]);
        const woMap = new Map<string, any>();
        for (const w of fsWo || []) woMap.set(w.id, w);
        for (const w of dexieWo || []) woMap.set(w.id, w);
        const workOrders = Array.from(woMap.values());
        const openOrders = workOrders.filter(
          (wo: any) => wo.status !== 'completed' && wo.status !== 'delivered' && wo.status !== 'cancelled'
        );
        openOrders.slice(0, 2).forEach((wo: any) => {
          tasks.push({
            id: `task_wo_${wo.id || wo.orderNumber}`,
            title: `أمر تشغيل مفتوح: ${wo.productName || wo.orderNumber || 'مشغولة حرفية'}`,
            detail: `الكمية: ${wo.quantity || 1} · الحرفي المسؤول: ${wo.assignedArtisanName || 'قيد التعيين'} · متابعة الإنجاز والتشطيب.`,
            urgency: 'normal',
            actionLabel: 'سجل أوامر التشغيل 🔨',
            view: 'work_orders',
          });
        });
      }

      // Routine task tailored to active packages (بدون أي تسريب للخزائن لو مش مشترك فيها)
      if (tasks.length === 0) {
        if (subCaps.canFinance) {
          tasks.push({
            id: 'task_routine_check',
            title: 'مطابقة حركة الخزائن وجرد اليوم',
            detail: 'تأكد من تسجيل فواتير اليوم ومطابقة رصيد النقدية في الخزينة الرئيسية لضمان دقة الأرباح.',
            urgency: 'normal',
            actionLabel: 'فتح الخزائن 💰',
            view: isSupplierAccount ? 'supplier_finance' : 'treasuries',
          });
        } else if (subCaps.canStorefront || subCaps.canCatalog) {
          tasks.push({
            id: 'task_routine_store',
            title: 'متابعة منتجات المتجر وأوردرات اليوم',
            detail: 'راجع صور وأسعار منتجاتك في المتجر والكتالوج وتابع أي أوردرات جديدة من عملائك.',
            urgency: 'normal',
            actionLabel: 'فتح متجري 🏪',
            view: isSupplierAccount ? 'supplier_store' : 'store',
          });
        } else {
          tasks.push({
            id: 'task_routine_profile',
            title: 'تحديث صفحتك الشخصية ومعرض أعمالك',
            detail: 'أضف أحدث صور أعمالك أو مشاركاتك لتقوية حضورك أمام العملاء وعيلة الشمساوية.',
            urgency: 'normal',
            actionLabel: 'فتح صفحتي الشخصية 👤',
            view: 'personal_profile',
          });
        }
      }

      setDailyTasks(tasks);
    } catch (err) {
      console.warn('Failed to generate Shamousa daily tasks:', err);
    }
  };

  useEffect(() => {
    loadDailyTasks();
    const handleAgendaSync = () => {
      try {
        const raw = localStorage.getItem(agendaStorageKey);
        if (raw) setAppointments(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('alshams_agenda_updated', handleAgendaSync);
    return () => window.removeEventListener('alshams_agenda_updated', handleAgendaSync);
  }, [workshopId, agendaStorageKey, subCaps.canInventory, subCaps.canProduction, subCaps.canFinance, subCaps.canStorefront]);

  // Count of pending tasks & upcoming appointments (excluding dismissed)
  const visibleDailyTasks = useMemo(
    () => dailyTasks.filter((t) => !taskMemory.dismissedIds.includes(t.id)),
    [dailyTasks, taskMemory.dismissedIds]
  );

  const visibleAppointments = useMemo(
    () => appointments.filter((a) => !taskMemory.dismissedIds.includes(a.id)),
    [appointments, taskMemory.dismissedIds]
  );

  const pendingTasksCount = useMemo(() => {
    return visibleDailyTasks.filter(
      (t) => !completedTaskIds.includes(t.id) && !taskMemory.readIds.includes(t.id)
    ).length;
  }, [visibleDailyTasks, completedTaskIds, taskMemory.readIds]);

  const upcomingApptsCount = useMemo(() => {
    return visibleAppointments.filter(
      (a) => a.status === 'upcoming' && !taskMemory.readIds.includes(a.id)
    ).length;
  }, [visibleAppointments, taskMemory.readIds]);

  const totalPendingBadge = pendingTasksCount + upcomingApptsCount;

  // Toggle task completion
  const handleToggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const isDone = prev.includes(taskId);
      let next: string[];
      if (isDone) {
        next = prev.filter((id) => id !== taskId);
      } else {
        next = [...prev, taskId];
        playTaskDoneSound();
      }
      try {
        localStorage.setItem(tasksDoneStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Toggle appointment status
  const handleToggleAppointment = (id: string) => {
    const updated = appointments.map((a) => {
      if (a.id === id) {
        const nextStatus = a.status === 'upcoming' ? 'completed' : 'upcoming';
        if (nextStatus === 'completed') playSuccessSound();
        return { ...a, status: nextStatus as 'upcoming' | 'completed' };
      }
      return a;
    });
    saveAppointments(updated);
  };

  // Handle new appointment submission
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptFormTitle.trim()) return;

    const newAppt: WorkshopAppointment = {
      id: `appt_${Date.now()}`,
      title: apptFormTitle.trim(),
      type: 'delivery',
      clientName: apptFormClient.trim() || undefined,
      clientPhone: apptFormPhone.trim() || undefined,
      date: apptFormDate || todayDateStr,
      time: apptFormTime || '16:00',
      notes: apptFormNotes.trim() || undefined,
      status: 'upcoming',
      createdAt: Date.now(),
    };

    saveAppointments([newAppt, ...appointments]);
    playSuccessSound();

    // Reset form
    setApptFormTitle('');
    setApptFormClient('');
    setApptFormPhone('');
    setApptFormNotes('');
    setIsNewApptFormOpen(false);
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages, storageKey]);

  // فحص استباقي لمواعيد تسليم أوردرات المتجر (تنبيه قبل التسليم بيوم)
  const orderCheckDoneRef = useRef(false);
  useEffect(() => {
    if (orderCheckDoneRef.current) return;
    orderCheckDoneRef.current = true;

    const checkStoreOrdersDelivery = async () => {
      try {
        const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
        if (!tenantId) return;

        const allOrders = (await tenantStorage.getOrders(tenantId)) as any[];
        const now = Date.now();
        const oneDayMs = 86400000;

        for (const ord of allOrders) {
          if (ord.status === 'in_progress' || ord.status === 'pending') {
            const dueDateTs = (ord.dueDate || ord.deliveryDate) ? new Date(ord.dueDate || ord.deliveryDate).getTime() : 0;
            // إذا كان موعد التسليم خلال 24 ساعة أو اليوم أو متأخراً
            if (dueDateTs > 0 && (dueDateTs - now <= oneDayMs)) {
              const itemSummary = ord.items?.map((i: any) => i.productName || i.name).join(' + ') || 'مشغولات يدوية';
              const alertMsg: ShamousaMessage = {
                id: `alert_delivery_${ord.id}`,
                role: 'assistant',
                content: `🔔 تنبيه تشغيلي: معاد تسليم الأوردر رقم #${ord.orderNumber || ord.invoiceNumber || ''} باسم (${ord.customerName || 'العميل'}) قرب.. مطلوب ${itemSummary}.. جهز حالك للتسليم!`,
                actionLink: {
                  label: 'فتح تفاصيل الأوردر في متجري 🏪',
                  view: 'store',
                },
                actionChips: [
                  { id: 'chip_store', label: 'فتح أوردرات المتجر 🏪', view: 'store' },
                ],
              };

              setMessages((prev) => {
                if (prev.some((m) => m.id === alertMsg.id)) return prev;
                return [alertMsg, ...prev];
              });

              dispatchArtisanNotification(`تنبيه تشغيلي: أوردر #${ord.invoiceNumber}`, {
                body: `معاد تسليم أوردر ${ord.customerName || 'العميل'} قرب، جهز المشغولة للتسليم!`,
                tag: `delivery-${ord.id}`,
              });
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Error checking orders delivery in Shamousa:', err);
      }
    };

    // فحص استباقي لنواقص الخامات في المخزن
    const checkLowMaterialsStock = async () => {
      try {
        const tenantId = profile.tenantId || profile.workshopId || profile.id || '';
        if (!tenantId) return;

        const rawMaterials = (await tenantStorage.getRawMaterials(tenantId).catch(() => [])) as any[];
        let stockMap: Record<
          string,
          { currentStock?: number; minAlertThreshold?: number; warehouseTracked?: boolean }
        > = {};
        try {
          const cached = localStorage.getItem('alshams_mat_stock_' + tenantId);
          if (cached) stockMap = JSON.parse(cached);
        } catch {}

        const depleting = rawMaterials.filter((m: any) => {
          if (m.isActive === false) return false;
          const entry = stockMap[m.id];
          const isTracked = Boolean(entry?.warehouseTracked === true || m.warehouseTracked === true);
          if (!isTracked) return false;
          const stock = entry ? Number(entry.currentStock ?? 0) : Number(m.currentStock ?? m.quantity ?? 0);
          const minThreshold = entry
            ? Number(entry.minAlertThreshold ?? 0)
            : Number(m.minAlertThreshold ?? m.min_quantity ?? m.minimumStock ?? 0);
          return minThreshold > 0 && stock <= minThreshold;
        });

        if (depleting.length > 0) {
          const target = depleting[0];
          const stock = Number(target.currentStock ?? target.quantity ?? 0);
          const matName = target.materialName || target.name || 'خامة أساسية';
          const unit = target.unit || 'وحدة';
          const alertId = `alert_low_stock_${target.id || matName}`;

          const alertMsg: ShamousaMessage = {
            id: alertId,
            role: 'assistant',
            content: `⚠️ يا فنان، رصيد خامة [${matName}] قرب يخلص ومتبقي منه [${stock} ${unit}] بس!`,
            actionChips: [
              {
                id: `chip_buy_${target.id}`,
                label: 'طلب توريد سريع 🛒',
                action: 'quick_purchase',
                materialPayload: {
                  materialId: target.id,
                  materialName: matName,
                  unitCost: Number(target.costPrice || target.unitPrice || 0),
                  unitName: unit,
                },
              },
              { id: 'chip_mats', label: 'المخزن وإدارة الخامات 🧶', view: 'materials' },
            ],
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === alertId)) return prev;
            return [alertMsg, ...prev];
          });
        }
      } catch (err) {
        console.warn('Error checking materials stock in Shamousa:', err);
      }
    };

    if (subCaps.canOrders || subCaps.canStorefront) {
      checkStoreOrdersDelivery();
    }
    if (subCaps.canInventory) {
      checkLowMaterialsStock();
    }
  }, [profile.tenantId, profile.workshopId, profile.id, subCaps.canOrders, subCaps.canStorefront, subCaps.canInventory]);

  useEffect(() => {
    if (isOpen) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, isLoading, activeTab]);

  const openScreen = (view: string) => {
    if (onNavigateView) {
      onNavigateView(view);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alshams_open_view', { detail: { view } }));
    }
    setIsOpen(false);
  };

  const handleActionChipClick = (chip: SmartActionChip) => {
    if (chip.action === 'quick_purchase' && chip.materialPayload) {
      window.dispatchEvent(new CustomEvent('alshams_quick_purchase', { detail: chip.materialPayload }));
      setIsOpen(false);
      return;
    }
    if (chip.action === 'open_agenda') {
      setActiveTab('tasks_agenda');
      return;
    }
    if (chip.action === 'new_appointment') {
      setActiveTab('tasks_agenda');
      setIsNewApptFormOpen(true);
      return;
    }
    if (chip.view) {
      openScreen(chip.view);
    }
  };

  const resolveDisambiguationIntent = async (
    intentKey: DisambiguationIntentKey
  ): Promise<Omit<ShamousaMessage, 'id' | 'role'>> => {
    const currency = profile.currencySymbol || 'ج.م';
    const fmt = (n: number) => Math.round(n || 0).toLocaleString('ar-EG');

    const buildLockedIntentReply = (domainLabel: string, actionKeys: string[]): Omit<ShamousaMessage, 'id' | 'role'> => {
      const pkgs = subCaps.findUnlockingPackagesForActions(actionKeys).map((p) => {
        const title = isSupplierAccount && p.supplierTitleAr ? p.supplierTitleAr : p.titleAr;
        return p.promoFreeLimitedTime ? `«${title}» (مجانية حالياً لفترة محدودة)` : `«${title}»`;
      });
      return {
        content:
          `يا **${firstName}** ☀️ قسم **${domainLabel}** مش مفتوح حالياً في باقاتك المفعّلة (${subCaps.activePackageTitles.join(' + ')}).\n` +
          (pkgs.length > 0
            ? `تقدر تفعّل ${pkgs.join(' أو ')} من صفحة «اشتراكاتي» بضغطة واحدة عشان أجيبهولك فوراً!`
            : `تقدر تفعّل الباقة المناسبة من صفحة «اشتراكاتي» عشان أفتح لك الملخص ده.`),
        actionLink: { label: 'فتح صفحة اشتراكاتي 👑', view: 'my_subscriptions' },
      };
    };

    // فحص الصلاحيات الصارم لكل نية قبل قراءة أي أرقام
    if (
      (intentKey === 'tr_menu' || intentKey === 'tr_cash' || intentKey === 'tr_receivables' || intentKey === 'tr_payables') &&
      !subCaps.canFinance
    ) {
      return buildLockedIntentReply('الخزائن والسيولة والحسابات', ['nav_treasuries', 'nav_accounts']);
    }
    if ((intentKey === 'sup_tr_menu' || intentKey === 'sup_cash' || intentKey === 'sup_receivables' || intentKey === 'sup_payables') && !subCaps.canFinance) {
      return buildLockedIntentReply('خزائن الفروع والحسابات المالية للمورد', ['sup_finance', 'sup_erp_hub']);
    }
    if ((intentKey === 'wh_menu' || intentKey === 'wh_materials') && !subCaps.canInventory) {
      return buildLockedIntentReply('مخزن الخامات والجرد', ['nav_materials', 'modal_inv_materials']);
    }
    if (intentKey === 'sup_stock' && !subCaps.canInventory) {
      return buildLockedIntentReply('مخزون الفروع وكارت الصنف', ['sup_warehouse_erp']);
    }
    if (intentKey === 'wh_products' && !subCaps.canCatalog && !subCaps.canInventory) {
      return buildLockedIntentReply('مخزن المنتجات والكتالوج', ['nav_catalog', 'modal_inv_products']);
    }
    if ((intentKey === 'full_brief' || intentKey === 'sup_full_brief') && !subCaps.canExecutiveBrief) {
      return buildLockedIntentReply(
        'ملخص «هلخصهالك» الشامل',
        isSupplierAccount ? ['sup_executive_brief'] : ['open_executive_brief']
      );
    }

    // Level 1 & Level 2 Guided Menus — مفلترة على قد باقات المشترك فقط!
    if (intentKey === 'root_ambiguous') {
      const choices: DisambiguationChoice[] = [];
      if (subCaps.canInventory) choices.push({ id: 'c_wh_menu', label: 'ملخص المخزن 📦', intentKey: 'wh_menu' });
      if (subCaps.canFinance) choices.push({ id: 'c_tr_menu', label: 'ملخص الخزنة والفلوس 💰', intentKey: 'tr_menu' });
      if (subCaps.canExecutiveBrief) choices.push({ id: 'c_full', label: 'الخلاصة كلها في (هلخصهالك) 📋', intentKey: 'full_brief' });
      if (choices.length === 0) {
        const chips: SmartActionChip[] = [];
        if (subCaps.canStorefront) chips.push({ id: 'chip_st', label: 'فتح متجري 🏪', view: 'store' });
        if (subCaps.canCatalog) chips.push({ id: 'chip_ct', label: 'فتح الكتالوج 📖', view: 'catalog' });
        if (subCaps.canOrders) chips.push({ id: 'chip_od', label: 'فتح أوردراتي 🛍️', view: 'my_orders' });
        chips.push({ id: 'chip_subs', label: 'إدارة اشتراكاتي 👑', view: 'my_subscriptions' });
        return {
          content: `يا **${firstName}** ☀️ باقاتك الحالية (${subCaps.activePackageTitles.join(' + ')}) مش شاملة تقارير الخزينة أو المخازن لسه. أقدر أساعدك في الأقسام المفتوحة عندك دلوقتي أو تقدر ترقّي باقتك من «اشتراكاتي» مجاناً لفترة محدودة:`,
          actionChips: chips,
        };
      }
      return {
        content: `حاضر يا **${firstName}** ☀️ تقصد إيه بالظبط من الأقسام المفتوحة عندك عشان أجيب لك الأرقام المظبوطة؟ اختار من الأزرار دي:`,
        disambiguationChoices: choices,
      };
    }

    if (intentKey === 'wh_menu') {
      const choices: DisambiguationChoice[] = [];
      if (subCaps.canInventory) choices.push({ id: 'c_wh_mat', label: 'مخزن الخامات 🧶', intentKey: 'wh_materials' });
      if (subCaps.canCatalog || subCaps.canInventory) choices.push({ id: 'c_wh_prod', label: 'مخزن المنتجات النهائية 🛍️', intentKey: 'wh_products' });
      if (subCaps.canExecutiveBrief) choices.push({ id: 'c_wh_full', label: 'الاثنين في هلخصهالك 📋', intentKey: 'full_brief' });
      return {
        content: `من عيوني يا **${firstName}** 📦 تحب أراجع لك أي مخزن فيهم؟`,
        disambiguationChoices: choices,
      };
    }

    if (intentKey === 'tr_menu') {
      const choices: DisambiguationChoice[] = [
        { id: 'c_tr_cash', label: 'معانا كام وفين (السيولة) 💵', intentKey: 'tr_cash' },
        { id: 'c_tr_rec', label: 'لينا كام بره وعند مين 📥', intentKey: 'tr_receivables' },
        { id: 'c_tr_pay', label: 'علينا كام ولمين (للموردين) 📤', intentKey: 'tr_payables' },
      ];
      if (subCaps.canExecutiveBrief) {
        choices.push({ id: 'c_tr_full', label: 'الموقف المالي كله 📋', intentKey: 'full_brief' });
      }
      return {
        content: `أهلاً بيك يا **${firstName}** 💰 عاوز تعرف إيه بالظبط في الفلوس والحسابات؟`,
        disambiguationChoices: choices,
      };
    }

    if (intentKey === 'sup_root_ambiguous') {
      const choices: DisambiguationChoice[] = [];
      if (subCaps.canFinance) choices.push({ id: 'c_sup_tr', label: 'ملخص خزائن الفروع والكاشير 💰', intentKey: 'sup_tr_menu' });
      if (subCaps.canInventory) choices.push({ id: 'c_sup_wh', label: 'ملخص مخزون الفروع وكارت الصنف 🏭', intentKey: 'sup_stock' });
      if (subCaps.canExecutiveBrief) choices.push({ id: 'c_sup_full', label: 'الخلاصة كلها في (هلخصهالك للموردين) 📋', intentKey: 'sup_full_brief' });
      if (choices.length === 0) {
        return {
          content: `يا **${firstName}** ☀️ باقاتك الحالية (${subCaps.activePackageTitles.join(' + ')}) مش شاملة تقارير خزائن الفروع أو المخازن لسه. أقدر أساعدك في الأقسام المفتوحة عندك أو تقدر تفعّل الباقة المناسبة من «اشتراكاتي»!`,
          actionLink: { label: 'فتح صفحة اشتراكاتي 👑', view: 'my_subscriptions' },
        };
      }
      return {
        content: `تحت أمرك يا **${firstName}** ☀️ تقصد تراجع إيه في فروع المورد دلوقتي؟`,
        disambiguationChoices: choices,
      };
    }

    if (intentKey === 'sup_tr_menu') {
      const choices: DisambiguationChoice[] = [
        { id: 'c_sup_cash', label: 'معانا كام في الفروع والمالك 💵', intentKey: 'sup_cash' },
        { id: 'c_sup_rec', label: 'لينا كام عند الورش والعملاء 📥', intentKey: 'sup_receivables' },
        { id: 'c_sup_pay', label: 'علينا كام للمصانع 📤', intentKey: 'sup_payables' },
      ];
      if (subCaps.canExecutiveBrief) {
        choices.push({ id: 'c_sup_tr_full', label: 'الخلاصة كلها في هلخصهالك 📋', intentKey: 'sup_full_brief' });
      }
      return {
        content: `اختار التفاصيل المالية اللي تحب تراجعها يا **${firstName}** 💰:`,
        disambiguationChoices: choices,
      };
    }

    // Supplier live leaf briefs (عزل تام لحساب المورد)
    if (isSupplierAccount) {
      if (intentKey === 'sup_full_brief') {
        const sb = await buildSupplierExecutiveBrief(currency, profile.brandName || 'متجر المورد');
        const sf = sb.financial;
        const sw = sb.warehouse;
        const topDebtor = sf.debtors[0];
        return {
          content:
            `📋 **ملخص هلخصهالك للموردين يا ${firstName}:**\n` +
            `• **معانا كام:** **${fmt(sf.totalCashOnHand)} ${currency}** (خزينة المالك المعتمدة ${fmt(sf.ownerMainTreasuryTotal)} + عُهد الفروع ${fmt(sf.branchesPendingTreasuryTotal)} ${currency}).\n` +
            `• **لينا بره عند الورش والعملاء:** **${fmt(sf.receivablesTotal)} ${currency}** (${sf.debtors.length} عميل${topDebtor ? ` — أكبرهم ${topDebtor.name}: ${fmt(topDebtor.totalOwed)} ${currency}` : ''}).\n` +
            `• **علينا للمصانع:** **${fmt(sf.payablesTotal)} ${currency}**.\n` +
            `• **قيمة مخزون الفروع (${sw.branchesCount} فرع):** **${fmt(sw.totalStockValuation)} ${currency}** (${sw.lowStockItems.length} صنف قريب من حد الأمان).\n` +
            `• **مبيعات الكاشير اليوم:** **${sf.todayPosOrdersCount}** فاتورة بإجمالي **${fmt(sf.todayPosSales)} ${currency}**.\n` +
            `💡 تقدر تبعت رسالة **تذكير لطيف بالواتساب** لأي عميل عليه مديونية مباشرة من شاشة هلخصهالك.`,
          actionChips: [
            { id: 'chip_sup_eb_open', label: 'فتح هلخصهالك للموردين كاملة 📋', view: 'supplier_executive_brief' },
            { id: 'chip_erp_hub', label: 'مركز قيادة الفروع 🌿', view: 'supplier_erp_hub' },
          ],
        };
      }

      const ov = await fetchSupplierErpOverview().catch(() => null);
      const k: Partial<NonNullable<typeof ov>['kpis']> = ov?.kpis || {};
      if (intentKey === 'sup_cash') {
        return {
          content:
            `💵 **موقف الخزائن معاك يا ${firstName}:**\n` +
            `• إجمالي السيولة المتاحة: **${fmt(k.totalCashOnHand || 0)} ${currency}**\n` +
            `• خزينة المالك المعتمدة: **${fmt(k.ownerMainTreasuryTotal || 0)} ${currency}**\n` +
            `• عهد وخزائن الفروع قبل التوريد: **${fmt(k.branchesPendingTreasuryTotal || 0)} ${currency}**\n` +
            `• توريدات معلقة بانتظار تأكيد استلامك: **${ov?.pendingTransfers?.length || 0}** توريد.`,
          actionChips: [
            { id: 'chip_erp', label: 'فتح مركز قيادة الفروع والخزينة 🌿', view: 'supplier_erp_hub' },
            { id: 'chip_sup_eb', label: 'فتح هلخصهالك للموردين 📋', view: 'supplier_executive_brief' },
          ],
        };
      }
      if (intentKey === 'sup_receivables') {
        return {
          content:
            `📥 **اللي لينا بره عند الورش والعملاء يا ${firstName}:**\n` +
            `• إجمالي المديونيات الآجلة بره: **${fmt(k.receivablesFromCustomers || 0)} ${currency}**.\n` +
            `تقدر تشوف تفاصيل كل عميل وتبعت له **تذكير لطيف بالواتساب** بضغطة زر من هلخصهالك أو شاشة العملاء.`,
          actionChips: [
            { id: 'chip_sup_eb', label: 'هلخصهالك + تذكير واتساب 📋', view: 'supplier_executive_brief' },
            { id: 'chip_scust', label: 'فتح عملائي (الورش والأفراد) 👥', view: 'supplier_customers' },
          ],
        };
      }
      if (intentKey === 'sup_payables') {
        return {
          content:
            `📤 **اللي علينا للمصانع والموردين الكبار يا ${firstName}:**\n` +
            `• إجمالي المستحق للمصانع: **${fmt(k.payablesToVendors || 0)} ${currency}**.`,
          actionChips: [
            { id: 'chip_swh', label: 'فتح المخازن والمصانع 🏭', view: 'supplier_warehouse_erp' },
            { id: 'chip_sup_eb', label: 'فتح هلخصهالك للموردين 📋', view: 'supplier_executive_brief' },
          ],
        };
      }
      return {
        content:
          `🏭 **ملخص مخزون الفروع يا ${firstName}:**\n` +
          `• عدد الفروع النشطة: **${ov?.branches?.length || 1}** فرع.\n` +
          `• قيمة المخزون الإجمالية: **${fmt(k.totalStockValuation || 0)} ${currency}**.\n` +
          `• مبيعات الكاشير اليوم: **${k.todayPosOrdersCount || 0}** فاتورة بإجمالي **${fmt(k.todayPosSales || 0)} ${currency}**.`,
        actionChips: [
          { id: 'chip_swh', label: 'المخازن وكارت الصنف 🏭', view: 'supplier_warehouse_erp' },
          { id: 'chip_spos', label: 'كاشير نقاط البيع (POS) 🛒', view: 'supplier_pos' },
          { id: 'chip_sup_eb', label: 'هلخصهالك للموردين 📋', view: 'supplier_executive_brief' },
        ],
      };
    }

    // Artisan Live Leaf Briefs (هلخصهالك الحية بالبلدي)
    const brief = await buildArtisanExecutiveBrief(workshopId, currency);

    if (intentKey === 'tr_cash') {
      const liq = brief.financial.liquidity;
      const lines = liq.treasuries
        .map((t) => `• ${t.name} (${t.kindLabel}): **${fmt(t.balance)} ${currency}**`)
        .join('\n');
      return {
        content:
          `💵 **معانا كام وفين دلوقتي يا ${firstName}:**\n` +
          `• إجمالي الفلوس اللي في إيدنا: **${fmt(liq.totalLiquidity)} ${currency}**\n` +
          `• متقسمين: **${fmt(liq.cashTotal)} ${currency}** كاش، و **${fmt(liq.instapayBankTotal)} ${currency}** في إنستاباي/البنك، و **${fmt(liq.walletsCustodyTotal)} ${currency}** في المحافظ والعُهد.\n` +
          (lines ? `\n**تفاصيل الخزائن:**\n${lines}` : ''),
        actionChips: [
          { id: 'chip_tr', label: 'فتح الخزائن والعُهد 💰', view: 'treasuries' },
          { id: 'chip_eb', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' },
        ],
      };
    }

    if (intentKey === 'tr_receivables') {
      const debtors = brief.financial.debtors;
      if (debtors.length === 0) {
        return {
          content: `📥 يا **${firstName}**، مفيش فلوس لينا بره عند أي عميل دلوقتي — كل الفواتير متحصّلة تمام ✅`,
          actionChips: [
            { id: 'chip_eb', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' },
          ],
        };
      }
      const firstOverdueWithPhone = debtors.find((d) => d.isOverdue && d.phone) || debtors.find((d) => d.phone);
      const listLines = debtors
        .slice(0, 6)
        .map((d) =>
          `• إنت ليك عند **${d.name}**: **${fmt(d.totalOwed)} ${currency}**` +
          (d.isOverdue
            ? `\n  ⚠️ *تحذير: ده عدّى ميعاد السداد بقاله ${d.daysOverdue} يوم — ياريت تطالبه وبلاش تتعامل آجل معاه تاني غير لما يصفّي القديم!*`
            : '')
        )
        .join('\n');

      return {
        content:
          `📥 **اللي لينا بره عند العملاء يا ${firstName} (الإجمالي ${fmt(brief.financial.receivablesTotal)} ${currency}):**\n${listLines}`,
        contactAction: firstOverdueWithPhone?.phone
          ? { name: firstOverdueWithPhone.name, phone: firstOverdueWithPhone.phone, type: 'customer' }
          : undefined,
        actionChips: [
          { id: 'chip_cust', label: 'فتح كشف حساب العملاء 👥', view: 'customers' },
          { id: 'chip_eb', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' },
        ],
      };
    }

    if (intentKey === 'tr_payables') {
      const creds = brief.financial.creditors;
      if (creds.length === 0) {
        return {
          content: `📤 يا **${firstName}**، مفيش علينا أي مبالغ مستحقة للموردين دلوقتي — دفاترنا معاهم خالصة ✅`,
          actionChips: [
            { id: 'chip_eb', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' },
          ],
        };
      }
      const listLines = creds
        .slice(0, 6)
        .map((c) => `• علينا لـ **${c.name}**: **${fmt(c.totalOwed)} ${currency}**`)
        .join('\n');

      return {
        content:
          `📤 **اللي علينا للموردين يا ${firstName} (الإجمالي ${fmt(brief.financial.payablesTotal)} ${currency}):**\n${listLines}`,
        actionChips: [
          { id: 'chip_sup', label: 'فتح حسابات الموردين 🚚', view: 'suppliers' },
          { id: 'chip_eb', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' },
        ],
      };
    }

    if (intentKey === 'wh_materials') {
      const w = brief.warehouse;
      const fastText =
        w.fastMovingMaterials.length > 0
          ? w.fastMovingMaterials.map((m) => `${m.name} (اتسحب ${m.consumedQty} ${m.unit})`).join('، ')
          : 'لسه مفيش صرف تشغيل مسجل';
      const slowText =
        w.slowMovingMaterials.length > 0
          ? w.slowMovingMaterials.map((m) => `${m.name} (رصيد ${m.currentStock} ${m.unit})`).join('، ')
          : 'كل الخامات شغالة كويس';
      const lowText =
        w.lowStockMaterials.length > 0
          ? `\n⚠️ **خامات قربت تخلص:** ${w.lowStockMaterials.slice(0, 3).map((m) => `${m.name} (${m.currentStock} ${m.unit})`).join('، ')}`
          : '\n✅ كل الخامات فوق حد الأمان.';

      return {
        content:
          `🧶 **تقرير مدير المخزن عن الخامات يا ${firstName}:**\n` +
          `• عندك **${w.materialsCount}** خامة بقيمة إجمالية **${fmt(w.materialsTotalValue)} ${currency}**.\n` +
          `• **أكتر خامات بتتسحب:** ${fastText}.\n` +
          `• **خامات سحبها قليل:** ${slowText}.${lowText}`,
        actionChips: [
          { id: 'chip_mat', label: 'فتح مخزن الخامات 🧶', view: 'materials' },
          { id: 'chip_eb', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' },
        ],
      };
    }

    if (intentKey === 'wh_products') {
      const w = brief.warehouse;
      const bestText =
        w.bestSellingProducts.length > 0
          ? w.bestSellingProducts.map((p) => `${p.name} (مباع ${p.soldQty} قطعة)`).join('، ')
          : 'لسه مفيش مبيعات مسجلة لقياس الأكثر مبيعاً';
      const slowText =
        w.slowestProducts.length > 0
          ? w.slowestProducts.map((p) => `${p.name} (مباع ${p.soldQty})`).join('، ')
          : 'كل المنتجات ماشية تمام';

      return {
        content:
          `🛍️ **تقرير مخزن المنتجات يا ${firstName}:**\n` +
          `• عندك **${w.productsCount}** منتج بتكلفة **${fmt(w.productsCostValue)} ${currency}** (وقيمة بيع **${fmt(w.productsRetailValue)} ${currency}**).\n` +
          `• **أكتر منتج ماشي معانا:** ${bestText}.\n` +
          `• **أقل منتج شغال:** ${slowText}.`,
        actionChips: [
          { id: 'chip_cat', label: 'فتح كتالوج المنتجات 🛍️', view: 'catalog' },
          { id: 'chip_eb', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' },
        ],
      };
    }

    // full_brief ("هلخصهالك" كاملة)
    const f = brief.financial;
    const w = brief.warehouse;
    const topDebtor = f.debtors[0];
    const overdueNote =
      f.overdueDebtorsCount > 0 && topDebtor
        ? `\n⚠️ **تنبيه مهم:** عندك ${f.overdueDebtorsCount} عميل عدّى ميعاد السداد (أولهم **${topDebtor.name}** بـ ${fmt(topDebtor.totalOwed)} ${currency}) — ياريت تطالبه وبلاش آجل معاه غير لما يصفّي!`
        : '';

    return {
      content:
        `📋 **ملخص هلخصهالك السريع لورشتك يا ${firstName}:**\n` +
        `• **معانا كام:** **${fmt(f.liquidity.totalLiquidity)} ${currency}** (كاش ${fmt(f.liquidity.cashTotal)} + إنستاباي/بنك ${fmt(f.liquidity.instapayBankTotal)} + محافظ/عُهد ${fmt(f.liquidity.walletsCustodyTotal)}).\n` +
        `• **لينا بره:** **${fmt(f.receivablesTotal)} ${currency}** عند ${f.debtors.length} عميل.${overdueNote}\n` +
        `• **علينا للموردين:** **${fmt(f.payablesTotal)} ${currency}**.\n` +
        `• **المخزن:** خامات بـ **${fmt(w.materialsTotalValue)} ${currency}** ومنتجات بسعر بيع **${fmt(w.productsRetailValue)} ${currency}**` +
        (w.bestSellingProducts[0] ? ` (الأكثر مبيعاً: **${w.bestSellingProducts[0].name}**)` : '') +
        `.`,
      actionChips: [
        { id: 'chip_eb_open', label: 'فتح بطاقة هلخصهالك كاملة 📋', view: 'executive_brief' },
      ],
    };
  };

  const handleDisambiguationChoiceClick = async (choice: DisambiguationChoice) => {
    if (isLoading) return;
    playButtonClickSound();
    const userChoiceMsg: ShamousaMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: choice.label,
    };
    setMessages((prev) => [...prev, userChoiceMsg]);
    setIsLoading(true);
    try {
      const responseMsg = await resolveDisambiguationIntent(choice.intentKey);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          ...responseMsg,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err?.message || 'حصل خطأ بسيط، جربي تاني.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatbotOptionClick = async (opt: ShamousaChatbotOption, messageIdx: number) => {
    if (isLoading) return;
    playButtonClickSound();
    if (opt.triggerFalcon) {
      setIsOpen(false);
      onOpenFalcon();
      return;
    }
    if (opt.action === 'open_agenda') {
      setActiveTab('tasks_agenda');
      return;
    }
    if (opt.action === 'new_appointment') {
      setActiveTab('tasks_agenda');
      setIsNewApptFormOpen(true);
      return;
    }
    if (opt.view) {
      openScreen(opt.view);
      return;
    }
    if (opt.intentKey) {
      await handleDisambiguationChoiceClick({
        id: opt.id,
        label: opt.label,
        intentKey: opt.intentKey as DisambiguationIntentKey,
      });
      return;
    }
    if (opt.triggerAI) {
      setUseGoogleSearch(true);
      const prevUserMsg = [...messages.slice(0, messageIdx)].reverse().find((m) => m.role === 'user');
      const queryForAI = prevUserMsg?.content || 'ساعديني في آخر استفسار';
      await send(queryForAI, { forceAI: true, forceSearch: true });
      return;
    }
    if (opt.queryText) {
      if (opt.queryText.startsWith('__FORCE_AI__:')) {
        const aiQ = opt.queryText.replace('__FORCE_AI__:', '').trim() || 'ساعديني في آخر استفسار';
        setUseGoogleSearch(true);
        await send(aiQ, { forceAI: true, forceSearch: true });
        return;
      }
      if (isSuperAdminAccount && opt.queryText.startsWith('__OPEN_ADMIN_LIB__:')) {
        const catId = opt.queryText.replace('__OPEN_ADMIN_LIB__:', '') as AdminLibraryCategoryId;
        setActiveAdminLibCategory(catId);
        setShowAdminLibSavedList(false);
        setAdminLibMenuOpen(false);
        inputRef.current?.focus();
        return;
      }
      if (isSuperAdminAccount && opt.queryText === '__OPEN_ADMIN_SAVED__') {
        setShowAdminLibSavedList(true);
        setAdminLibMenuOpen(false);
        return;
      }
      await send(opt.queryText);
    }
  };

  const send = async (
    text: string,
    sendOptions?: { forceAI?: boolean; forceSearch?: boolean; explainPayload?: ShamousaExplainPayload }
  ) => {
    if (isRecordingVoice) {
      stopVoiceRecording();
    }
    shamousaSpeech.unlock();
    let message = text.trim();
    const currentAttachment = pendingAttachment;
    if (pendingAttachment) {
      setPendingAttachment(null);
    }
    if (!message && !currentAttachment) return;
    if (isLoading) return;

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const shouldUseLocalFirst = !currentAttachment && !useGoogleSearch && !sendOptions?.forceAI;

    // 0. فحص هل السؤال ملتبس/عام أو طلب مباشر لفرع من "هلخصهالك" — يُتجاوز تماماً عند تفعيل البحث الحي (الأخضر)
    const preIntent =
      !currentAttachment && !useGoogleSearch && !sendOptions?.forceAI
        ? detectSummaryOrAmbiguousIntent(message, isSupplierAccount)
        : null;

    const userMsg: ShamousaMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: message || (currentAttachment ? `📸 [صورة مرفقة: ${currentAttachment.name}]` : ''),
      attachmentPreview: currentAttachment ? currentAttachment.base64 : undefined,
    };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // فحص طلبات التأجيل ("استني ساعة" / "كلميني الساعة 10") — لا يتداخل مع وضع البحث الحي
    if (!currentAttachment && !useGoogleSearch && message) {
      const snoozeParsed = parseArabicSnoozeRequest(message);
      if (snoozeParsed) {
        handleScheduleSnooze(
          snoozeParsed.wakeAtMs,
          snoozeParsed.labelAr,
          snoozeParsed.durationSummary
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `a_snooze_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: `على عيني يا **${firstName}** 🌙✨ هسيبك تكمّل شغلك براحتك، وهلفلك وأرجعلك **${snoozeParsed.labelAr}** برنّة خفيفة نطمن سوا على اليوم!`,
          },
        ]);
        window.setTimeout(() => setIsOpen(false), 1600);
        return;
      }
    }

    setIsLoading(true);

    // 0.08 دليل السوبر أدمن الشخصي: لو نسي إزاي يبرمج شموسة أو يضيف/يحفظ في المكتبات -> تشرحله الخطوات وتفتحله الأزرار فوراً
    if (isSuperAdminAccount && message && !currentAttachment && isSuperAdminGuideQuery(message)) {
      try {
        const guide = buildSuperAdminLibraryGuide(firstName);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_admin_guide_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: guide.reply,
            chatbotOptions: guide.options,
          },
        ]);
        setIsLoading(false);
        return;
      } catch (guideErr) {
        console.warn('[Shamousa] Super Admin guide recovered safely:', guideErr);
      }
    }

    // 0.09 حوار مراجعة الأسئلة المعلقة والغريبة للسوبر أدمن (يعرض السؤال والمقترح، يعدّله تفاعلياً بـ «عدل»، ويحفظه بـ «احفظ»)
    if (
      isSuperAdminAccount &&
      message &&
      !currentAttachment &&
      (adminReviewSessionRef.current.active || isSuperAdminReviewPendingQuery(message))
    ) {
      try {
        const rev = advanceSuperAdminReviewDialogue(adminReviewSessionRef.current, message, firstName);
        adminReviewSessionRef.current = rev.nextSession;
        if (rev.savedToStore && rev.storeSnapshot) {
          setCustomLibVersion((v) => v + 1);
          authedFetch('/api/admin/shamousa/custom-libraries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store: rev.storeSnapshot }),
          }).catch(() => {});
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a_admin_rev_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: rev.reply,
            chatbotOptions: rev.options,
          },
        ]);
        setIsLoading(false);
        return;
      } catch (revErr) {
        console.warn('[Shamousa] Super Admin review loop recovered safely:', revErr);
        adminReviewSessionRef.current = INITIAL_ADMIN_REVIEW_SESSION;
      }
    }

    // 0.10 وضع السوبر أدمن «إضافة للمكتبات»: يقبل الصيغة المنظمة أو كلام عربي بسيط ويحفظ فوراً أوفلاين + يزامن السيرفر
    if (isSuperAdminAccount && activeAdminLibCategory && message) {
      try {
        const res = parseAndSaveAdminLibraryEntry(activeAdminLibCategory, message);
        setCustomLibVersion((v) => v + 1);
        if (res.ok) {
          authedFetch('/api/admin/shamousa/custom-libraries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store: res.storeSnapshot }),
          }).catch(() => {
            // محفوظ محلياً أوفلاين حتى لو السيرفر غير متاح حالياً
          });
        }
        const catMeta = ADMIN_LIBRARY_CATEGORIES.find((c) => c.id === activeAdminLibCategory);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_admin_lib_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content:
              `${res.summaryAr}\n\n` +
              `📂 **القسم المختار:** ${catMeta?.labelAr || activeAdminLibCategory}` +
              (res.ok ? `\n💡 تقدر تبعت إضافة تانية في نفس القسم، أو تضغط «إلغاء» في الشريط تحت عشان ترجع للشات العادي.` : ''),
          },
        ]);
        setIsLoading(false);
        return;
      } catch (adminLibErr) {
        console.warn('[Shamousa] Admin library save recovered safely:', adminLibErr);
      }
    }

    // 0.12 لو المستخدم بعت صورة أوفلاين (بدون بحث حي وبدون ضغط زر AI): نفحص جودتها محلياً بالـ Canvas ونصارحه ونوجّهه بـ 3 أسئلة سريعة
    if (currentAttachment && !useGoogleSearch && !sendOptions?.forceAI) {
      try {
        const qualityReport = await analyzeImageQualityWithCanvas(
          currentAttachment.base64,
          currentAttachment.name || 'الصورة المرفقة'
        );
        const imgResp = buildOfflineImageUploadResponse({
          firstName,
          imageName: currentAttachment.name,
          qualityReport,
        });
        let extraSpecHint = '';
        if (message) {
          const captionUnderstanding = understandProductSentence(message);
          if (captionUnderstanding.specialty) {
            extraSpecHint = `\n\n✨ لاحظت من كلامك إن الشغل تبع **${captionUnderstanding.specialty.nameAr}** — تقدر تضغط على أول اختيار تحت ونكمّل فوراً!`;
          }
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a_img_offline_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: `${imgResp.reply}${extraSpecHint}`,
            chatbotOptions: imgResp.options.map((o) => ({
              id: o.id,
              label: o.label,
              queryText: o.queryText,
            })),
          },
        ]);
        setIsLoading(false);
        return;
      } catch (imgErr) {
        console.warn('[Shamousa] Offline image inspector recovered safely:', imgErr);
      }
    }

    // 0.15 النوايا الأوفلاين المسجّلة داخل شات شموسة الواحد (داخل try/catch لحماية باقي شموسة لو وقع أي موديول)
    if (message && !currentAttachment) {
      try {
      const normIntent = message
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        .trim();

      const buildWizardCtx = async () => {
        const canInv = hasFeature('inventory', accountIdForPkg, pkgQueryOptions);
        let stockMaterialNames: string[] = [];
        if (canInv && workshopId) {
          const mats = await db.rawMaterials
            .where('tenantId')
            .equals(workshopId)
            .toArray()
            .catch(() => []);
          stockMaterialNames = mats
            .filter((m) => m.isActive !== false && m.materialName)
            .slice(0, 4)
            .map((m) => m.materialName);
        }
        return {
          accountId: accountIdForPkg,
          firstName,
          brandName: profile.brandName,
          currencySymbol: profile.currencySymbol || 'ج.م',
          packageOptions: pkgQueryOptions,
          stockMaterialNames,
        };
      };

      // (أ) استكمال خطوة في معالج «منتج جديد» النشط حالياً
      if (productWizardRef.current.active) {
        const wCtx = await buildWizardCtx();
        const turn = advanceProductWizard(productWizardRef.current, message, wCtx);
        productWizardRef.current = turn.nextState;
        setMessages((prev) => [
          ...prev,
          {
            id: `a_pw_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: turn.reply,
            wizardChoices: turn.choices,
            wizardMultiSelected: turn.selectedMultiValues,
            copyBlocks: turn.copyBlocks,
            productPrefillDraft: turn.prefillDraft,
            actionLink: turn.actionLink,
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (ب) استكمال سؤال «أقل سعر تقبل تبيع بيه كام؟» (قاعدة 6.1 بدون تكاليف)
      if (minPriceOfferRef.current.awaitingFloorPrice) {
        const num = Number(message.replace(/[^\d.]/g, ''));
        if (Number.isFinite(num) && num > 0) {
          const offerRes = buildSafeDiscountOfferFromUserFloor({
            firstName,
            productName: minPriceOfferRef.current.productName || 'المنتج',
            listedPrice: minPriceOfferRef.current.listedPrice,
            userFloorPrice: num,
            currencySymbol: profile.currencySymbol || 'ج.م',
          });
          minPriceOfferRef.current = { awaitingFloorPrice: false };
          setMessages((prev) => [
            ...prev,
            {
              id: `a_floor_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: offerRes.reply,
              copyBlocks: offerRes.copyBlocks,
            },
          ]);
          setIsLoading(false);
          return;
        }
        // لو المستخدم كتب جملة غير رقمية نلغي الانتظار ونكمّل طبيعي
        minPriceOfferRef.current = { awaitingFloorPrice: false };
      }

      // (ج) طلب عرض أو خصم بدون باقة تكاليف أو بدون تكلفة مسجّلة (قاعدة 6.1)
      if (/(اعمل خصم|عايز خصم|عرض خصم|باقه خصم|خصم علي|نسبه خصم|تخفيض)/.test(normIntent)) {
        const canCosting = hasFeature('costing', accountIdForPkg, pkgQueryOptions);
        const canStore = hasFeature('marketing_review', accountIdForPkg, pkgQueryOptions);
        const prods = canStore && workshopId
          ? await db.products.where('tenantId').equals(workshopId).toArray().catch(() => [])
          : [];
        const targetProd = prods.find((p) => p.isActive !== false);
        const hasRealCost =
          canCosting &&
          targetProd &&
          Number(targetProd.costPrice || targetProd.output?.unifiedBreakdown?.totalUnitCost || 0) > 0;
        if (!hasRealCost) {
          minPriceOfferRef.current = {
            awaitingFloorPrice: true,
            productName: targetProd?.productName || 'القطعة بتاعتك',
            listedPrice: Number(targetProd?.retailPrice || 0) || undefined,
          };
          setMessages((prev) => [
            ...prev,
            {
              id: `a_ask_floor_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content:
                `عشان أجهّزلك عرض آمن من غير ما أخترع نسبة خصم تضرّك يا **${firstName}** ☀️:\n` +
                `**أقل سعر تقبل تبيع بيه كام (${profile.currencySymbol || 'ج.م'})؟**\n` +
                `اكتبلي الرقم وهبني العرض على رقْمك إنت فوراً.`,
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // (د) بدء معالج «منتج جديد» — يعمل في كل الباقات حتى الأساسية فقط!
      if (isNewProductWizardTrigger(message)) {
        const wCtx = await buildWizardCtx();
        const turn = startNewProductWizard(message, wCtx);
        productWizardRef.current = turn.nextState;
        setMessages((prev) => [
          ...prev,
          {
            id: `a_pw_start_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: turn.reply,
            wizardChoices: turn.choices,
            wizardMultiSelected: turn.selectedMultiValues,
            copyBlocks: turn.copyBlocks,
            productPrefillDraft: turn.prefillDraft,
            actionLink: turn.actionLink,
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (هـ) تقرير القرارات المتكيّف مع الباقات («التحليل والحلول الذكية»)
      if (/(التحليل والحلول الذكيه|تقرير القرارات|تحليل ذكي|حلول ذكيه|ملخص القرارات)/.test(normIntent)) {
        const canStore = hasFeature('marketing_review', accountIdForPkg, pkgQueryOptions);
        const canCost = hasFeature('costing', accountIdForPkg, pkgQueryOptions);
        const canInv = hasFeature('inventory', accountIdForPkg, pkgQueryOptions);
        const canFinOrCrm =
          hasFeature('finance', accountIdForPkg, pkgQueryOptions) ||
          hasFeature('sales_crm', accountIdForPkg, pkgQueryOptions);

        const [prods, mats, custs, ords, profRes] = await Promise.all([
          canStore || canCost
            ? db.products.where('tenantId').equals(workshopId).toArray().catch(() => [])
            : Promise.resolve([]),
          canInv
            ? db.rawMaterials.where('tenantId').equals(workshopId).toArray().catch(() => [])
            : Promise.resolve([]),
          canFinOrCrm
            ? db.customers.where('tenantId').equals(workshopId).toArray().catch(() => [])
            : Promise.resolve([]),
          canFinOrCrm
            ? db.orders.where('tenantId').equals(workshopId).toArray().catch(() => [])
            : Promise.resolve([]),
          (async () => {
            const cached = getCachedMemberPersonalProfile(profile.id, 'owner');
            if (cached?.profile) return cached.profile;
            const fetched = await fetchMemberPersonalProfile(profile.id, 'owner').catch(() => null);
            return fetched?.profile || null;
          })(),
        ]);

        const decision = buildPackageAdaptiveDecisionReportOffline({
          accountId: accountIdForPkg,
          firstName,
          profile,
          personalProfile: profRes,
          products: prods,
          materials: mats,
          customers: custs,
          orders: ords,
          packageOptions: pkgQueryOptions,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `a_dec_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: decision.markdown,
            chatbotOptions: decision.actionChips.map((c) => ({
              id: c.id,
              label: c.label,
              queryText: c.queryText,
              view: c.view,
            })),
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (و) مراجعة المتجر والمنتجات ودرجة التسويق («راجع منتجاتي»)
      if (/(راجع منتجاتي|مراجعه منتجاتي|مراجعه المتجر|درجه التسويق|تقييم منتجاتي|تقييم المتجر)/.test(normIntent)) {
        const canStore = hasFeature('marketing_review', accountIdForPkg, pkgQueryOptions);
        const prods = canStore && workshopId
          ? await db.products.where('tenantId').equals(workshopId).toArray().catch(() => [])
          : [];
        const review = runStoreMarketingReviewOffline({
          accountId: accountIdForPkg,
          firstName,
          products: prods,
          packageOptions: pkgQueryOptions,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `a_rev_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: review.summaryMarkdown,
            actionLink: review.allowed
              ? { label: 'فتح كتالوج المنتجات 🛍️', view: 'catalog' }
              : { label: 'فتح صفحة اشتراكاتي 👑', view: 'my_subscriptions' },
            chatbotOptions: review.allowed
              ? [
                  { id: 'rev_opt_new', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
                  { id: 'rev_opt_wa', label: 'رسالة واتساب جاهزة 💬', queryText: 'رسالة واتساب' },
                ]
              : undefined,
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (ز) رسائل الواتساب الجاهزة («رسالة واتساب»)
      if (/(رساله واتساب|رسائل واتساب|واتساب لعميل|اكتبيلي واتساب|اكتب لي واتساب)/.test(normIntent)) {
        const canWa = hasFeature('whatsapp_messages', accountIdForPkg, pkgQueryOptions);
        const prods = canWa && workshopId
          ? await db.products.where('tenantId').equals(workshopId).toArray().catch(() => [])
          : [];
        const waRes = buildWhatsAppTemplatesOffline({
          accountId: accountIdForPkg,
          firstName,
          brandName: profile.brandName,
          currencySymbol: profile.currencySymbol || 'ج.م',
          products: prods,
          packageOptions: pkgQueryOptions,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `a_wa_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: waRes.reply,
            copyBlocks: waRes.copyBlocks,
            actionLink: waRes.actionLink,
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (ح) تقييم الصفحة الشخصية + بوست تعريفي + بوست طبلية العيلة (تعمل في الباقة الأساسية دائماً!)
      if (
        /(راجع صفحتي|مراجعه صفحتي|تقييم صفحتي|صفحتي الشخصيه|اكتب لي بوست|اكتبيلي بوست|بوست تعريفي|فكره بوست|طبليه العيله|طبلية العيلة|فكره للطبلية|فكرة للطبلية)/.test(
          normIntent
        )
      ) {
        const canStore = hasFeature('marketing_review', accountIdForPkg, pkgQueryOptions);
        const [prods, fetchedProf] = await Promise.all([
          canStore && workshopId
            ? db.products.where('tenantId').equals(workshopId).toArray().catch(() => [])
            : Promise.resolve([]),
          (async () => {
            const cached = getCachedMemberPersonalProfile(profile.id, 'owner');
            if (cached?.profile) return cached.profile;
            const res = await fetchMemberPersonalProfile(profile.id, 'owner').catch(() => null);
            return res?.profile || null;
          })(),
        ]);

        const fallbackProf = fetchedProf || {
          memberId: profile.id,
          displayName: profile.artistName || firstName,
          brandName: profile.brandName || '',
          accountRole: isSupplierAccount ? ('supplier' as const) : ('artisan' as const),
          craftsLabels: [],
          governorate: profile.governorate || '',
          country: profile.country || 'مصر',
          bioHeadline: '',
          storyText: '',
          showcasePosts: [],
          visibility: {
            personalAvatar: { artisans: true, suppliers: true, customers: true },
            story: { artisans: true, suppliers: true, customers: true },
            showcase: { artisans: true, suppliers: true, customers: true },
            contact: { artisans: false, suppliers: false, customers: false },
            storeLink: { artisans: true, suppliers: true, customers: true },
            location: { artisans: true, suppliers: true, customers: true },
          },
        };

        const audit = auditPersonalProfileOffline({
          profile: fallbackProf,
          accountId: accountIdForPkg,
          products: prods,
          packageOptions: pkgQueryOptions,
        });

        const copyBlocks: ShamousaCopyBlock[] = [
          {
            id: 'prof_intro_post',
            title: '✍️ بوست تعريفي جاهز لصفحتك الشخصية',
            content: audit.contentIdeas.introPost,
          },
          {
            id: 'prof_family_post',
            title: '👨‍👩‍👧‍👦 بوست أسبوعي لطبلية عيلة الشمساوية',
            content: audit.contentIdeas.weeklyFamilyTablePost,
          },
        ];

        audit.contentIdeas.newProductPosts.slice(0, 2).forEach((pp, idx) => {
          copyBlocks.push({
            id: `prof_prod_post_${idx}`,
            title: `🛍️ بوست لمنتجك «${pp.productName}»`,
            content: pp.postText,
          });
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `a_prof_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: audit.summaryMarkdown,
            copyBlocks,
            actionLink: { label: 'فتح صفحتي الشخصية 👤', view: 'personal_profile' },
            chatbotOptions: [
              { id: 'prof_opt_new', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
              { id: 'prof_opt_fam', label: 'افتح طبلية العيلة 👨‍👩‍👧‍👦', view: 'family' },
            ],
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (ط) الرد على اعتراضات العملاء من المكتبة التسويقية (غالي / خصم / تأخير / جودة / لون أو مقاس تاني)
      const matchedObjection = matchCustomerObjectionFromLibrary(message);
      if (matchedObjection && !useGoogleSearch && !sendOptions?.forceAI) {
        const canCosting = hasFeature('costing', accountIdForPkg, pkgQueryOptions);
        const canStore = hasFeature('marketing_review', accountIdForPkg, pkgQueryOptions);
        let floorExtra = '';
        if (matchedObjection.id === 'obj_discount') {
          const prods =
            canStore && workshopId
              ? await db.products.where('tenantId').equals(workshopId).toArray().catch(() => [])
              : [];
          const targetProd = prods.find((p) => p.isActive !== false);
          const hasRealCost =
            canCosting &&
            targetProd &&
            Number(targetProd.costPrice || targetProd.output?.unifiedBreakdown?.totalUnitCost || 0) > 0;
          if (!hasRealCost) {
            minPriceOfferRef.current = {
              awaitingFloorPrice: true,
              productName: targetProd?.productName || 'القطعة بتاعتك',
              listedPrice: Number(targetProd?.storePrice || targetProd?.retailPrice || 0) || undefined,
            };
            floorExtra = `\n\n💡 ولو حابب أجهّزلك عرض بديل آمن من غير ما نخسر: **أقل سعر تقبل تبيع بيه كام (${profile.currencySymbol || 'ج.م'})؟**`;
          }
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a_obj_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content:
              `🤝 **إزاي ترد على اعتراض «${matchedObjection.objectionAr}» يا ${firstName}:**\n` +
              `${matchedObjection.guidanceAr}${floorExtra}`,
            chatbotOptions: [
              { id: 'obj_opt_wa', label: 'قوالب واتساب جاهزة 💬', queryText: 'رسالة واتساب' },
              { id: 'obj_opt_new', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
              { id: 'obj_opt_rev', label: 'راجع منتجاتي 🔍', queryText: 'راجع منتجاتي' },
            ],
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (ط-2) البحث في مكتبة أساليب التسويق والمشاكل الفنية المضافة من السوبر أدمن
      const matchedCustomNote = !useGoogleSearch && !sendOptions?.forceAI ? matchCustomKnowledgeNote(message) : null;
      if (matchedCustomNote) {
        recordShamousaAnswerMetric('local');
        setMessages((prev) => [
          ...prev,
          {
            id: `a_knote_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: `📘 **${matchedCustomNote.titleAr}:**\n${matchedCustomNote.contentAr}`,
            chatbotOptions: [
              { id: 'kn_opt_new', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
              { id: 'kn_opt_rev', label: 'راجع منتجاتي 🔍', queryText: 'راجع منتجاتي' },
            ],
          },
        ]);
        setIsLoading(false);
        return;
      }

      // (ط-3) Part D: ملخص أسبوعي «اللي اتعلمته منك» + زر «صفّر تعلّمي» (محلي للحساب فقط)
      if (!useGoogleSearch && !sendOptions?.forceAI) {
        if (/(صفر تعلمي|صفّر تعلّمي|امسح تعلمي|اعاده ضبط تعلمي|تصفير التعلم)/.test(normIntent)) {
          resetAccountLearning(accountIdForPkg);
          recordShamousaAnswerMetric('local');
          setMessages((prev) => [
            ...prev,
            {
              id: `a_learn_reset_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: `✅ تمام يا ${firstName} ☀️ صفّرت تعلّم أسلوبك لحسابك ده بس ورجعنا للبداية المتوازنة — تقدر تقيّم أي نص جديد في أي وقت وأتعلم أسلوبك من أول وجديد!`,
              chatbotOptions: [
                { id: 'lr_opt_1', label: 'التحليل الشامل لحسابي 🧠', queryText: 'العقول التحليلية لحسابي' },
                { id: 'lr_opt_2', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
                { id: 'lr_opt_3', label: 'اللي اتعلمته منك 📋', queryText: 'اللي اتعلمته منك' },
              ],
            },
          ]);
          setIsLoading(false);
          return;
        }

        if (/(اللي اتعلمته منك|ملخص تعلمي|اتعلمتي مني ايه|اسلوبي المفضل|تقييمات شموسه)/.test(normIntent)) {
          const ords = workshopId
            ? await db.orders.where('tenantId').equals(workshopId).toArray().catch(() => [])
            : [];
          const summary = buildWeeklyLearningSummary({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            orders: ords,
            firstName,
          });
          recordShamousaAnswerMetric('local');
          setMessages((prev) => [
            ...prev,
            {
              id: `a_learn_sum_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: summary.shortSummaryAr,
              chatbotOptions: [
                { id: 'ls_opt_reset', label: 'صفّر تعلّمي 🔄', queryText: 'صفّر تعلّمي' },
                { id: 'ls_opt_brains', label: 'التحليل الشامل لحسابي 🧠', queryText: 'العقول التحليلية لحسابي' },
                { id: 'ls_opt_new', label: 'جهّز منتج جديد ✨', queryText: 'منتج جديد' },
              ],
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // (ط-3) Part E: متابعة سؤال تشخيص فني أو فحص مكتبة المشاكل الفنية (ريزن، مكرمية، وأي حرفة مستقبلية)
      if (!useGoogleSearch && !sendOptions?.forceAI) {
        if (message.trim().startsWith('تشخيص ')) {
          const tipMatch = message.match(/\(([^)]+)\)\s*$/);
          const focusedTip = tipMatch?.[1]?.trim();
          if (focusedTip) {
            recordShamousaAnswerMetric('local');
            setMessages((prev) => [
              ...prev,
              {
                id: `a_tech_diag_follow_${Date.now()}`,
                role: 'assistant',
                isLocalChatbot: true,
                content: `🔧 **التشخيص المحدد لحالتك يا ${firstName}:**\n${focusedTip}\n\nلو المشكلة لسه مستمرة قولي النتيجة بعد التجربة وهكمّل معاك خطوة بخطوة ☀️`,
                chatbotOptions: [
                  { id: 'td_f_1', label: 'التحليل الشامل لحسابي 🧠', queryText: 'العقول التحليلية لحسابي' },
                  { id: 'td_f_2', label: 'خامات التخصص الموحدة 🧶', queryText: 'منظومة الخامات الموحدة' },
                ],
              },
            ]);
            setIsLoading(false);
            return;
          }
        }

        const techDiag = diagnoseTechnicalProblemOffline(message, firstName);
        if (techDiag.matched && techDiag.reply) {
          recordShamousaAnswerMetric('local');
          authedFetch('/api/shamousa/knowledge/metrics-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'local' }),
          }).catch(() => {});
          setMessages((prev) => [
            ...prev,
            {
              id: `a_tech_diag_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: techDiag.reply,
              chatbotOptions: techDiag.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // (ط-3.5) مكتبة أساليب التسويق (14 أسلوب عملي للحرفيين والموردين — أوفلاين بالكامل)
        const mktMethod = matchMarketingMethodOffline(message, isSupplierAccount, firstName);
        if (mktMethod.matched && mktMethod.reply) {
          const validatedMkt = validateShamousaReplyBeforeSend({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            replyText: mktMethod.reply,
            options: mktMethod.options,
            realProductFactsText: message,
            firstName,
          });
          recordShamousaAnswerMetric('local');
          authedFetch('/api/shamousa/knowledge/metrics-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'local' }),
          }).catch(() => {});
          setMessages((prev) => [
            ...prev,
            {
              id: `a_mkt_method_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: validatedMkt.sanitizedReply,
              chatbotOptions: validatedMkt.options as ShamousaChatbotOption[],
            },
          ]);
          setIsLoading(false);
          return;
        }

        // (ط-4) Part E: العقول التحليلية الثلاثة أوفلاين (الاستراتيجي + الفني + التسويقي) مقيدة بباقات الحساب
        const asksAnalyticBrains =
          /(العقول التحليليه|التحليل الاستراتيجي|التحليل الفني|تحليل شامل لحسابي|حلل حسابي|محفظه منتجاتي|تحليل المخاطر|تركز الايراد|هالك الخامات)/.test(
            normIntent
          );
        if (asksAnalyticBrains) {
          const canInv = hasFeature('inventory', accountIdForPkg, pkgQueryOptions);
          const [prods, mats, ords, wOrders] = await Promise.all([
            workshopId ? db.products.where('tenantId').equals(workshopId).toArray().catch(() => []) : Promise.resolve([]),
            canInv && workshopId
              ? db.rawMaterials.where('tenantId').equals(workshopId).toArray().catch(() => [])
              : Promise.resolve([]),
            workshopId ? db.orders.where('tenantId').equals(workshopId).toArray().catch(() => []) : Promise.resolve([]),
            workshopId ? db.workOrders.where('tenantId').equals(workshopId).toArray().catch(() => []) : Promise.resolve([]),
          ]);
          const focusBrain: AnalyticBrainType | undefined = /استراتيجي|محفظه|تركز/.test(normIntent)
            ? 'strategic'
            : /فني|هالك/.test(normIntent)
            ? 'technical'
            : undefined;
          const report = runAllThreeAnalyticBrainsOffline({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            isSupplier: isSupplierAccount,
            firstName,
            brandName: profile.brandName,
            currency: profile.currencySymbol || 'ج.م',
            products: prods,
            rawMaterials: mats,
            orders: ords,
            workOrders: wOrders,
          });
          const formatted = formatAnalyticBrainsReply(firstName, report, focusBrain);
          recordShamousaAnswerMetric('local');
          authedFetch('/api/shamousa/knowledge/metrics-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'local' }),
          }).catch(() => {});
          setMessages((prev) => [
            ...prev,
            {
              id: `a_brains_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: formatted.reply,
              chatbotOptions: formatted.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // (ط-5) Part E: المخزن المعرفي العام المعتمد (BM25 + Levenshtein + Trigram للأخطاء الإملائية)
        const kbSearch = searchKnowledgeStoreLocal(message);
        if (kbSearch.tier === 'confident' && kbSearch.bestMatch) {
          const hit = kbSearch.bestMatch.entry;
          recordShamousaAnswerMetric('local');
          authedFetch('/api/shamousa/knowledge/metrics-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'local' }),
          }).catch(() => {});
          const safetyLine = hit.safetyWarningAr ? `\n\n${hit.safetyWarningAr}` : '';
          setMessages((prev) => [
            ...prev,
            {
              id: `a_kb_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: `☀️ **${hit.topic}:**\n${hit.reply}${safetyLine}`,
              chatbotOptions:
                hit.options && hit.options.length > 0
                  ? hit.options.slice(0, 4).map((o) => ({
                      id: o.id,
                      label: o.label,
                      queryText: o.queryText,
                    }))
                  : [
                      { id: 'kb_opt_1', label: 'التحليل الشامل لحسابي 🧠', queryText: 'العقول التحليلية لحسابي' },
                      { id: 'kb_opt_2', label: 'تقويم المواسم المصري 🗓️', queryText: 'إيه المواسم الجاية؟' },
                    ],
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // (ي) محرك فهم المنتج والمكتبة التسويقية (كلمة واحدة / تخصص / عامية / أخطاء إملائية / أفكار فيديو وتصوير وباقات وهاشتاجات)
      const isErpOrSystemQuery =
        /(مبيعات|خامات|مخزون|عملاء|فواتير|خزنه|ارباح|مصروفات|باقات|اشتراك|صقر|كلمه السر|حاسبه|اوردر|مواعيد|تنبيه)/.test(
          normIntent
        );
      if (!isErpOrSystemQuery && !useGoogleSearch && !sendOptions?.forceAI) {
        const understood = understandProductSentence(message);
        const asksMarketingIntent =
          /(اسوق|تسويق|بوست|عنوان|وصف|فيديو|ريلز|تصوير|صوره|هاشتاج|وسوم|باقه|باقات|هديه|هدايا|موسم|عيد|رمضان|شغل يدوي|هاندميد)/.test(
            normIntent
          );

        // 1) الجملة غامضة وتحتاج سؤال توضيحي من 3-4 اختيارات
        if (understood.isAmbiguous && understood.clarifyingOptions && understood.clarifyingOptions.length > 0 && asksMarketingIntent) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a_amb_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: `☀️ ${understood.clarifyingQuestion}`,
              chatbotOptions: understood.clarifyingOptions!.map((o) => ({
                id: o.id,
                label: o.label,
                queryText: o.value,
              })),
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 2) كلمة واحدة واضحة التخصص (مثل "مكرمية" أو "كروشيه" أو "تافتنج") بدون طلب تفصيلي محدد
        if (
          understood.specialty &&
          !understood.productType &&
          !asksMarketingIntent &&
          understood.clarifyingOptions &&
          understood.clarifyingOptions.length > 0
        ) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a_spec_quick_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: `☀️ ${understood.clarifyingQuestion}`,
              chatbotOptions: understood.clarifyingOptions!.map((o) => ({
                id: o.id,
                label: o.label,
                queryText: o.value,
              })),
            },
          ]);
          setIsLoading(false);
          return;
        }

        // (ح) نوايا محرك التسويق والتسعير والإنتاج (الرسالة 5 من 7 — أوفلاين 100% + باقات مستقلة)
        const loadPartCData = async () => {
          const canInv = hasFeature('inventory', accountIdForPkg, pkgQueryOptions);
          const [prods, mats, ords] = await Promise.all([
            workshopId ? db.products.where('tenantId').equals(workshopId).toArray().catch(() => []) : Promise.resolve([]),
            canInv && workshopId
              ? db.rawMaterials.where('tenantId').equals(workshopId).toArray().catch(() => [])
              : Promise.resolve([]),
            workshopId ? db.orders.where('tenantId').equals(workshopId).toArray().catch(() => []) : Promise.resolve([]),
          ]);
          return { prods, mats, ords };
        };

        // 1) تعديل تاريخ موسم مصري محلياً لهذا الحساب فقط
        const seasonOverrideCmd = tryParseSeasonDateOverrideCommand(message);
        if (seasonOverrideCmd) {
          saveAccountSeasonDateOverride(accountIdForPkg, seasonOverrideCmd.seasonId, seasonOverrideCmd.isoDate);
          const calReply = formatEgyptianSeasonsReply({ firstName, accountId: accountIdForPkg });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_seas_ov_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content:
                `✅ **تم تعديل تاريخ موسم «${seasonOverrideCmd.seasonNameAr}» محلياً لحسابك إلى ${seasonOverrideCmd.isoDate}!**\n\n` +
                calReply.reply,
              chatbotOptions: calReply.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 2) تقويم المواسم المصري + تنبيه 3 أسابيع
        if (/(المواسم الجايه|تقويم المواسم|مواسم البيع|الموسم الجاي|امتي رمضان|امتي عيد الام|مواسم مصر)/.test(normIntent)) {
          const calReply = formatEgyptianSeasonsReply({ firstName, accountId: accountIdForPkg });
          recordAccountMarketingInsight(accountIdForPkg, {
            kind: 'season_interest',
            titleAr: 'متابعة تقويم المواسم المصري',
            detailAr: 'راجعت خطة المواسم الجاية — تقدر تطلب بوستات أو باقات للموسم القادم في أي وقت.',
            queryText: 'إيه المواسم الجاية؟',
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_seas_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: calReply.reply,
              chatbotOptions: calReply.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 3) قراءة منظومة الخامات الموحدة (مفتوحة لجميع الحسابات بغض النظر عن الباقة)
        if (/(منظومه الخامات|الخامات الموحده|خامات نموذجيه|كود خامه|وحدات قياس|خامه\s+\S+)/.test(normIntent)) {
          const umReply = formatUnifiedMaterialReply(firstName, message);
          recordAccountMarketingInsight(accountIdForPkg, {
            kind: 'material_query',
            titleAr: `بحث خامات موحدة: ${message.slice(0, 32)}`,
            detailAr: 'تمت مطابقة الخامات مع منظومة الخامات الموحدة وسلاسل الوحدات.',
            queryText: message,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_um_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: umReply.reply,
              chatbotOptions: umReply.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 4) أهم 3 توصيات تسويقية وإنتاجية استباقية (بحد أقصى 3 مرتبة حسب الأثر)
        if (/(اهم 3 توصيات|اهم توصيات|التوصيات التسويقيه|اعمل ايه عشان ابيع|ازود مبيعاتي ازاي|خطه تسويق النهارده)/.test(normIntent)) {
          const { prods, mats, ords } = await loadPartCData();
          const top3 = buildProactiveTop3MarketingSuggestions({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            isSupplier: isSupplierAccount,
            brandName: profile.brandName,
            products: prods,
            rawMaterials: mats,
            orders: ords,
            currency: profile.currencySymbol || 'ج.م',
          });
          const top3Reply = formatProactiveTop3Reply({ firstName, suggestions: top3 });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_top3_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: top3Reply.reply,
              chatbotOptions: top3Reply.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 5) تحليل أسعار منتجات الحساب مقارنة ببعضها فقط (costing-gated)
        if (/(تحليل اسعاري|مقارنه اسعار منتجاتي|راجع اسعاري|اسعار منتجاتي|هامش منتجاتي|في منتج بيخسر)/.test(normIntent)) {
          const { prods } = await loadPartCData();
          const pa = analyzeAccountProductPricing({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            firstName,
            products: prods,
            currency: profile.currencySymbol || 'ج.م',
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_price_an_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: pa.reply,
              chatbotOptions: pa.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 6) مسودة حساب تكلفة لمنتج عبر دالة الحاسبة الموجودة نفسها (costing-gated)
        if (/(بيتكلف كام|تكلفته كام|احسبيلي تكلفه|احسبي تكلفه|مسوده حساب|حساب تكلفه منتج)/.test(normIntent)) {
          const { prods, mats } = await loadPartCData();
          const parsedDraft = parseExplicitDraftCostFromMessage(message, mats);
          const draftRes = runDraftCostCalculationViaExistingEngine({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            firstName,
            currency: profile.currencySymbol || 'ج.م',
            productName: parsedDraft.productName,
            savedProducts: prods,
            explicitMaterials: parsedDraft.materials,
            laborWage: parsedDraft.laborWage,
            packagingCost: parsedDraft.packagingCost,
            profitMarginPercent: parsedDraft.profitMarginPercent,
            rawMaterialsInventory: mats,
          });
          if (draftRes.awaitingFloorPriceFor) {
            minPriceOfferRef.current = {
              awaitingFloorPrice: true,
              productName: draftRes.awaitingFloorPriceFor.productName,
              listedPrice: draftRes.awaitingFloorPriceFor.listedPrice,
            };
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `a_draft_cost_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: draftRes.reply,
              chatbotOptions: draftRes.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 7) طاقة الإنتاج وأول خامة هتخلص وأولويات التشغيل (inventory-gated)
        if (/(اقدر اصنع كام|اصنع كام قطعه|طاقه الانتاج|اول خامه هتخلص|اولويات الانتاج|اصنع ايه الاول)/.test(normIntent)) {
          const { prods, mats, ords } = await loadPartCData();
          const capRes = computeProductionCapacityFromStock({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            firstName,
            products: prods,
            rawMaterials: mats,
            orders: ords,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_cap_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: capRes.reply,
              chatbotOptions: capRes.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 8) للموردين: باقات خامات Starter Kits / خصم كميات للراكد / بوستين للورش
        if (/(باقات خامات|starter kit|ستارتر كيت|باقه خامات للمورد)/.test(normIntent)) {
          const { mats } = await loadPartCData();
          const kitsRes = buildSupplierStarterKitsFromStock({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            firstName,
            brandName: profile.brandName,
            rawMaterials: mats,
            currency: profile.currencySymbol || 'ج.م',
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_sup_kits_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: kitsRes.reply,
              chatbotOptions: kitsRes.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        if (/(خصم كميات|الخامات الراكده|مخزون راكد للمورد|احرك الخامات الراكده)/.test(normIntent)) {
          const { mats, ords } = await loadPartCData();
          const volRes = buildSupplierSlowStockVolumeTiers({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            firstName,
            rawMaterials: mats,
            orders: ords,
            currency: profile.currencySymbol || 'ج.م',
          });
          if (volRes.awaitingFloorPriceFor) {
            minPriceOfferRef.current = {
              awaitingFloorPrice: true,
              productName: volRes.awaitingFloorPriceFor.productName,
            };
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `a_sup_vol_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: volRes.reply,
              chatbotOptions: volRes.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        if (/(بوستين للمورد|بوستات للمورد|بوستات لاصحاب الورش|اعلان مورد خامات)/.test(normIntent)) {
          const { mats } = await loadPartCData();
          const sp = buildSupplierWorkshopPosts({
            firstName,
            brandName: profile.brandName,
            rawMaterials: mats,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_sup_posts_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: sp.reply,
              copyBlocks: sp.copyBlocks,
              chatbotOptions: sp.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 9) للورش: معادلة التجميع (بطل + راكد)
        if (/(معادله التجميع|عرض تجميع|منتج راكد|باقه تجميع|احرك الراكد|بطل وراكد)/.test(normIntent)) {
          const { prods, ords } = await loadPartCData();
          const bunRes = buildHeroSlowBundleOffer({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            firstName,
            brandName: profile.brandName,
            products: prods,
            orders: ords,
            currency: profile.currencySymbol || 'ج.م',
          });
          if (bunRes.awaitingFloorPriceFor) {
            minPriceOfferRef.current = {
              awaitingFloorPrice: true,
              productName: bunRes.awaitingFloorPriceFor.productName,
              listedPrice: bunRes.awaitingFloorPriceFor.listedPrice,
            };
          }
          recordAccountMarketingInsight(accountIdForPkg, {
            kind: 'stagnant_note',
            titleAr: 'تفعيل عرض تجميع (بطل + راكد)',
            detailAr: 'جهّزنا فكرة باقة تجميع لتحريك المنتج الأقل طلباً مع المنتج الأكثر مبيعاً.',
            queryText: 'اقترحيلي عرض تجميع لمنتج راكد',
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_bundle_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: bunRes.reply,
              copyBlocks: bunRes.copyBlocks,
              chatbotOptions: bunRes.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 10) للورش: رادار أفكار منتجات جديدة من خامات المخزون
        if (/(افكار منتجات من خاماتي|رادار افكار|افكار منتجات جديده|اصنع ايه من خاماتي|منتج جديد من المخزون)/.test(normIntent)) {
          const { prods, mats } = await loadPartCData();
          const radRes = runNewProductStockRadar({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            firstName,
            specialtyHint: message,
            products: prods,
            rawMaterials: mats,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_radar_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: radRes.reply,
              chatbotOptions: radRes.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 11) للورش: بوستين جاهزين باسم المتجر + رسالة واتساب بـ 3 أساليب
        if (/(بوستين للمتجر|بوست عرض وبوست|ورا الكواليس|رساله واتساب لمنتج|رساله واتساب ب3 اساليب)/.test(normIntent)) {
          const { prods } = await loadPartCData();
          const chosenProd =
            prods.find((p) => p.productName && normIntent.includes(p.productName.toLowerCase())) ||
            prods[0];
          const prodName =
            chosenProd?.productName ||
            message.replace(/(اكتبيلي|اكتبلي|بوستين للمتجر|عن|رساله واتساب لمنتج|رساله واتساب)/gi, '').trim() ||
            'منتجنا المميز';
          const artPosts = buildArtisanStorePostsAndWhatsapp({
            firstName,
            brandName: profile.brandName,
            productName: prodName,
            productDescription: chosenProd?.storeDescription,
            price: chosenProd?.storePrice || chosenProd?.retailPrice || chosenProd?.output?.finalSellingPrice,
            currency: profile.currencySymbol || 'ج.م',
            specialtyHint: `${chosenProd?.craftName || ''} ${message}`,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a_art_posts_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: artPosts.reply,
              copyBlocks: artPosts.copyBlocks,
              chatbotOptions: artPosts.options,
            },
          ]);
          setIsLoading(false);
          return;
        }

        // 3) تخصص واضح + طلب تسويقي/تصوير/فيديو/باقات/هاشتاجات أو منتج محدد
        if (understood.specialty && (asksMarketingIntent || understood.productType || understood.occasion)) {
          const spec = understood.specialty;
          const prodLabel = understood.productType || `قطعة ${spec.nameAr}`;
          recordAccountMarketingInsight(accountIdForPkg, {
            kind: 'specialty_focus',
            titleAr: `تركيز تسويقي على «${spec.nameAr}»`,
            detailAr: `نقدر نجهزلك باقات هدايا أو أفكار تصوير سريعة لـ ${prodLabel}.`,
            queryText: `أفكار فيديو وتصوير ${spec.nameAr}`,
          });
          const libPack = buildLibraryMarketingCopy({
            accountId: accountIdForPkg,
            productName: prodLabel,
            material: understood.material,
            occasion: understood.occasion || understood.audience,
            colorOrStyle: understood.colorOrStyle,
            sizeDetails: understood.sizeDetails,
            priceText: understood.numericPrice
              ? `${understood.numericPrice.toLocaleString('ar-EG')} ${profile.currencySymbol || 'ج.م'}`
              : undefined,
            specialty: spec,
            realProductFactsText: message,
          });

          let replyBody = '';
          let copyBlocks: ShamousaCopyBlock[] | undefined;

          if (/(فيديو|ريلز|شورتس|تصوير|صوره)/.test(normIntent)) {
            replyBody =
              `🎬 **أفكار تصوير وفيديو لتخصص «${spec.nameAr}» يا ${firstName}:**\n\n` +
              `📸 **نصيحة التصوير:**\n${libPack.photoTips}\n\n` +
              `🎥 **أفكار فيديو قصير (15–30 ثانية):**\n` +
              libPack.videoIdeas.slice(0, 4).map((v, i) => `${i + 1}. ${v}`).join('\n');
          } else if (/(باقه|باقات|هدايا|طقم)/.test(normIntent)) {
            replyBody =
              `🎁 **أفكار باقات وهدايا رائجة في «${spec.nameAr}» يا ${firstName}:**\n` +
              libPack.bundles.map((b, i) => `${i + 1}. ${b}`).join('\n') +
              `\n\n✨ **أقوى نقاط البيع للتخصص ده:**\n` +
              spec.sellingPoints.slice(0, 3).map((s) => `• ${s}`).join('\n');
          } else if (/(هاشتاج|وسوم|تاج)/.test(normIntent)) {
            replyBody =
              `#️⃣ **أفضل وسوم وهاشتاجات «${spec.nameAr}» يا ${firstName}:**\n` +
              `${libPack.hashtags.join(' ')}\n\n` +
              `💡 استخدم منهم 5 إلى 8 وسوم مرتبطين بالقطعة نفسها في آخر الوصف أو البوست.`;
            copyBlocks = [
              {
                id: `lib_tags_${Date.now()}`,
                title: `#️⃣ هاشتاجات ${spec.nameAr} جاهزة للنسخ`,
                content: libPack.hashtags.join(' '),
              },
            ];
          } else {
            const seasonLine = understood.matchedSeason
              ? `\n🗓️ **موسم ${understood.matchedSeason.seasonAr}:** الأنسب له (${understood.matchedSeason.suitableProductsAr})`
              : '';
            const extraNoteLine = spec.noteAr ? `\nℹ️ **ملحوظة:** ${spec.noteAr}` : '';
            const supplierExtras =
              spec.id === 'suppliers_materials' ? getEffectiveMarketingLibrary().suppliers : undefined;

            if (supplierExtras) {
              replyBody =
                `🏪 **دليل التسويق للموردين (بائعي الخامات) يا ${firstName}:**\n` +
                `• **نقط البيع لأصحاب الورش:** ${supplierExtras.sellingPointsForWorkshops.join(' • ')}\n` +
                `• **مواسم تجهيز الورش:** ${supplierExtras.seasonsAr}\n` +
                `• **أفكار باقات خامات (Starter Kits):**\n` +
                supplierExtras.starterKits.slice(0, 4).map((k) => `  - **${k.titleAr}:** ${k.contentsAr}`).join('\n') +
                `\n\nجهّزتلك تحت قوالب بوستات ورسالة جاهزة لأصحاب الورش والوسوم للنسخ فوراً 👇`;
              copyBlocks = [
                {
                  id: `sup_posts_${Date.now()}`,
                  title: '📣 قوالب بوستات للموردين',
                  content: supplierExtras.postTemplates.map((p, i) => `${i + 1}) ${p}`).join('\n\n'),
                },
                {
                  id: `sup_msg_${Date.now()}`,
                  title: '💬 رسالة جاهزة لأصحاب الورش',
                  content: `${supplierExtras.workshopMessageTemplate}\n\n${supplierExtras.hashtags.join(' ')}`,
                },
              ];
            } else {
              replyBody =
                `☀️ **جهّزتلك بداية تسويقية لتخصص «${spec.nameAr}» (${prodLabel}) يا ${firstName}:**${seasonLine}${extraNoteLine}\n` +
                `• **عناوين مقترحة:** ${libPack.titles[0]}\n` +
                `• **بداية بوست تشدّ العين:** ${libPack.hook}\n` +
                `• **نصيحة تصوير سريعة:** ${spec.photoTips}\n\n` +
                `انسخ أي قالب جاهز تحت أو نكمّل بمعالج المنتج خطوة بخطوة 👇`;
              copyBlocks = [
                {
                  id: `lib_titles_${Date.now()}`,
                  title: `🏷️ 3 عناوين متنوعة لـ ${prodLabel}`,
                  content: libPack.titles.map((t, i) => `${i + 1}) ${t}`).join('\n'),
                  templateId: `titles_${spec.id}`,
                  tone: libPack.selectedTone || 'friendly',
                  productName: prodLabel,
                },
                {
                  id: `lib_post_${Date.now()}`,
                  title: `✍️ بوست جاهز للنشر (${spec.nameAr})`,
                  content: `${libPack.shortPostSale}\n\n${libPack.engagementQuestion}\n${libPack.hashtags.slice(0, 6).join(' ')}`,
                  templateId: `post_${spec.id}`,
                  tone: libPack.selectedTone || 'friendly',
                  productName: prodLabel,
                },
              ];
            }
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `a_lib_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: replyBody,
              copyBlocks,
              chatbotOptions: [
                { id: 'lib_opt_wiz', label: `جهّز منتج ${spec.nameAr} كامل ✨`, queryText: `عايز أعمل منتج ${spec.nameAr}` },
                { id: 'lib_opt_vid', label: 'أفكار تصوير وفيديو 🎬', queryText: `أفكار فيديو وتصوير ${spec.nameAr}` },
                { id: 'lib_opt_bun', label: 'أفكار باقات وهدايا 🎁', queryText: `باقات ${spec.nameAr}` },
                { id: 'lib_opt_tag', label: 'الهاشتاجات الجاهزة #️⃣', queryText: `هاشتاجات ${spec.nameAr}` },
              ],
            },
          ]);
          setIsLoading(false);
          return;
        }
      }
      } catch (offlineModuleErr) {
        console.warn('[Shamousa] Offline intent module recovered safely:', offlineModuleErr);
      }
    }

    // 0.25 فحص فوري لنطاق الباقات والاشتراكات (يعمل أوفلاين وأونلاين قبل أي ملخص أو شات بوت أو AI!)
    if (message && !currentAttachment) {
      const normSubAsk = message
        .toLowerCase()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىي]/g, 'ي');
      if (/(مشترك في ايه|باقاتي ايه|مفتوحلي ايه|ايه الباقات اللي عندي|اشتراكاتي ايه)/.test(normSubAsk)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_sub_info_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content:
              `يا **${firstName}** ☀️ باقاتك المفعّلة حالياً هي:\n` +
              subCaps.activePackageTitles.map((t) => `• ✅ **${t}**`).join('\n') +
              (subCaps.lockedPackages.length > 0
                ? `\n\nوتقدر تضيف أي باقة تانية في أي وقت من صفحة «اشتراكاتي» (والباقات مجانية دلوقتي!).`
                : `\n\nكل باقات المنظومة مفتوحة معاك بالكامل! 🎉`),
            actionLink: { label: 'فتح صفحة اشتراكاتي 👑', view: 'my_subscriptions' },
          },
        ]);
        setIsLoading(false);
        return;
      }

      const lockedHit = detectLockedSubscriptionQuery(
        message,
        userSub,
        subRole,
        isSuperAdminAccount,
        firstName
      );
      if (lockedHit) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_locked_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            content: lockedHit.reply,
            actionLink: lockedHit.actionLink,
          },
        ]);
        setIsLoading(false);
        return;
      }
    }

    if (preIntent) {
      try {
        const directReply = await resolveDisambiguationIntent(preIntent);
        const safeChips = directReply.actionChips?.filter((c) => isViewUnlocked(c.view));
        const safeLink =
          directReply.actionLink && isViewUnlocked(directReply.actionLink.view)
            ? directReply.actionLink
            : undefined;
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            ...directReply,
            actionLink: safeLink,
            actionChips: safeChips && safeChips.length > 0 ? safeChips : undefined,
          },
        ]);
        return;
      } catch (err) {
        console.warn('Disambiguation/Brief direct resolution fallback:', err);
      } finally {
        setIsLoading(false);
      }
    }

    // 1. محرك شموسة الذكي المحلي أولاً مع تتبع سياق المحادثة الكامل (يعمل فوراً بدون انتظار)
    if (shouldUseLocalFirst) {
      try {
        const localRes = resolveShamousaLocalChatbot(message, {
          firstName,
          isSupplier: isSupplierAccount,
          experienceMode,
          state: conversationStateRef.current,
          history,
          accountId: accountIdForPkg,
          packageOptions: pkgQueryOptions,
        });
        if (localRes.nextState) {
          conversationStateRef.current = localRes.nextState;
        }
        if (localRes.isUnanswered && message.trim().length >= 2) {
          // 1) فحص عتبة الثقة الوسطى في المخزن المعرفي: عرض أقرب 3 مواضيع محتملة قبل التسجيل كغير مُجاب
          const kbCandidates = searchKnowledgeStoreLocal(message);
          if (kbCandidates.tier === 'candidates' && kbCandidates.topCandidates.length > 0) {
            recordShamousaAnswerMetric('local');
            setMessages((prev) => [
              ...prev,
              {
                id: `a_kb_cand_${Date.now()}`,
                role: 'assistant',
                isLocalChatbot: true,
                content: `يا ${firstName} ☀️ مش متأكدة 100% تقصد أي موضوع بالظبط — دي أقرب مواضيع لقيتها في مكتبتنا:`,
                chatbotOptions: [
                  ...kbCandidates.topCandidates.slice(0, 3).map((c, idx) => ({
                    id: `kb_c_${idx}_${c.entry.id}`,
                    label: `📌 ${c.entry.topic.slice(0, 34)}`,
                    queryText: c.entry.topic,
                  })),
                  {
                    id: `kb_c_ai_${Date.now()}`,
                    label: 'أسأل المساعد الذكي (لو متاح) ✨',
                    triggerAI: true,
                  },
                ],
              },
            ]);
            setIsLoading(false);
            return;
          }

          // 2) تسجيل السؤال مجرّداً تماماً من البيانات الشخصية (بريد/هاتف/رابط/حساب) في الطابور العام + نسخة خاصة للحساب
          const sanitizedQ = sanitizeQuestionRemovePII(message.trim());
          try {
            enqueueUnansweredQuestionSanitized(message.trim(), accountIdForPkg);
            queueUnansweredQuestionForAdmin(sanitizedQ);
          } catch {}
          authedFetch('/api/shamousa/knowledge/unanswered', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: sanitizedQ }),
          }).catch(() => {});

          const nearestTopicOption = kbCandidates.topCandidates[0]?.entry.topic || 'العقول التحليلية لحسابي';
          setMessages((prev) => [
            ...prev,
            {
              id: `a_unans_3opt_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content:
                `ما لقيتش إجابة مؤكدة. سجّلت سؤالك عشان نضيفه. تحب:\n` +
                `1) أجرّب أقرب موضوع\n` +
                `2) أسأل المساعد الذكي (لو متاح)\n` +
                `3) أحوّلك للدعم`,
              chatbotOptions: [
                { id: 'unans_opt_1', label: '1) أجرّب أقرب موضوع 🔎', queryText: nearestTopicOption },
                { id: 'unans_opt_2', label: '2) أسأل المساعد الذكي (لو متاح) ✨', triggerAI: true },
                { id: 'unans_opt_3', label: '3) أحوّلك للدعم 🛟', queryText: 'التواصل مع الدعم الفني' },
              ],
            },
          ]);
          setIsLoading(false);
          return;
        }
        if (localRes.handled && localRes.reply) {
          recordShamousaAnswerMetric('local');
          authedFetch('/api/shamousa/knowledge/metrics-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'local' }),
          }).catch(() => {});
          // لو الرد المحلي بيوجه لصفحة مقفولة في باقة المشترك، نستخدم الرد الرباعي القياسي وبحد أقصى باقة واحدة
          if (localRes.actionLink?.view && !isViewUnlocked(localRes.actionLink.view)) {
            const viewToActionMap: Record<string, string[]> = {
              calculator: ['nav_calculator'],
              work_orders: ['nav_work_orders'],
              materials: ['nav_materials'],
              purchases: ['nav_purchases'],
              suppliers: ['nav_suppliers'],
              treasuries: ['nav_treasuries'],
              reports: ['nav_reports'],
              sales: ['nav_sales'],
              customers: ['nav_customers'],
              catalog: ['nav_catalog'],
              store: ['open_artisan_store_products'],
              hr: ['nav_hr'],
              executive_brief: ['open_executive_brief'],
            };
            const unlockPkgs = subCaps.findUnlockingPackagesForActions(
              viewToActionMap[localRes.actionLink.view] || []
            );
            const fourPart = buildFourPartLockedPackageReply({
              firstName,
              sub: userSub,
              role: subRole,
              isAdmin: isSuperAdminAccount,
              lockedFeatureLabel: localRes.actionLink.label.replace(/^فتح\s*/, ''),
              unlockingPackages: unlockPkgs,
            });
            setMessages((prev) => [
              ...prev,
              {
                id: `a_sub_gate_${Date.now()}`,
                role: 'assistant',
                isLocalChatbot: true,
                content: fourPart.reply,
                actionLink: { label: 'فتح صفحة اشتراكاتي 👑', view: 'my_subscriptions' },
              },
            ]);
            setIsLoading(false);
            return;
          }

          const safeLocalOptions = localRes.options?.filter(
            (opt) =>
              (!opt.view || isViewUnlocked(opt.view)) &&
              (!opt.triggerFalcon || subCaps.canSakr)
          );
          const validatedLocal = validateShamousaReplyBeforeSend({
            accountId: accountIdForPkg,
            packageOptions: pkgQueryOptions,
            replyText: localRes.reply,
            options: safeLocalOptions,
            realProductFactsText: message,
            firstName,
          });
          const replyChips = detectKeywordActionChips(message, isSupplierAccount, experienceMode).filter(
            (c) =>
              isViewUnlocked(c.view) &&
              (!localRes.actionLink || c.view !== localRes.actionLink.view)
          );
          setMessages((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: validatedLocal.sanitizedReply,
              actionLink: localRes.actionLink,
              actionChips: replyChips.length > 0 ? replyChips : undefined,
              chatbotOptions:
                validatedLocal.options && validatedLocal.options.length > 0
                  ? (validatedLocal.options as ShamousaChatbotOption[])
                  : undefined,
              handoffToFalcon: subCaps.canSakr ? localRes.handoffToFalcon : false,
            },
          ]);
          setIsLoading(false);
          return;
        }
      } catch (localErr) {
        console.warn('Local engine notice:', localErr);
      }
    }

    try {
      let currentTreasury = 0;
      let treasuriesList: any[] = [];
      if (subCaps.canFinance) {
        try {
          const { data: supaTreasuries } = await getTreasuryBalancesFromSupabase(workshopId);
          if (supaTreasuries && supaTreasuries.length > 0) {
            treasuriesList = supaTreasuries;
            currentTreasury = supaTreasuries.reduce((sum: number, t: any) => sum + (Number(t.balance) || 0), 0);
          } else {
            const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
            currentTreasury = (safe.mainSafe || 0) + (safe.subSafe || 0);
            treasuriesList = [
              { name: 'الخزينة الرئيسية', balance: safe.mainSafe || 0, kind: 'خزينة' },
              { name: 'الخزينة الفرعية/العهد', balance: safe.subSafe || 0, kind: 'عهدة' },
            ];
          }
        } catch {
          const safe = await tenantStorage.getSafeBalances(workshopId).catch(() => ({ mainSafe: 0, subSafe: 0 }));
          currentTreasury = (safe.mainSafe || 0) + (safe.subSafe || 0);
        }
      }

      // جمع سياق الورشة الفعلي المباشر حصرياً للأقسام المفتوحة في باقة المشترك فقط!
      let lowMaterialsList: string[] = [];
      let openWorkOrdersList: string[] = [];
      let pendingOrdersCount = 0;
      let supplierErpOverviewData: any = null;
      let executiveBriefPayload: any = null;

      try {
        if (isSupplierAccount) {
          if (subCaps.canFinance || subCaps.canInventory) {
            supplierErpOverviewData = await fetchSupplierErpOverview().catch(() => null);
            if (subCaps.canFinance && supplierErpOverviewData?.kpis) {
              currentTreasury = Number(supplierErpOverviewData.kpis.totalCashOnHand ?? currentTreasury);
            }
          }
        } else {
          const [mats, wOrders, ords, fullBrief] = await Promise.all([
            subCaps.canInventory ? tenantStorage.getRawMaterials(workshopId).catch(() => []) : Promise.resolve([]),
            subCaps.canProduction ? tenantStorage.getWorkOrders(workshopId).catch(() => []) : Promise.resolve([]),
            subCaps.canOrders || subCaps.canStorefront || subCaps.canSalesCrm
              ? tenantStorage.getOrders(workshopId).catch(() => [])
              : Promise.resolve([]),
            subCaps.canExecutiveBrief
              ? buildArtisanExecutiveBrief(workshopId, profile.currencySymbol || 'ج.م').catch(() => null)
              : Promise.resolve(null),
          ]);

          if (fullBrief && subCaps.canExecutiveBrief) {
            executiveBriefPayload = {
              ...(subCaps.canFinance
                ? {
                    cashTotal: fullBrief.financial.liquidity.cashTotal,
                    instapayBankTotal: fullBrief.financial.liquidity.instapayBankTotal,
                    walletsCustodyTotal: fullBrief.financial.liquidity.walletsCustodyTotal,
                    receivablesTotal: fullBrief.financial.receivablesTotal,
                    debtors: fullBrief.financial.debtors.slice(0, 8),
                    payablesTotal: fullBrief.financial.payablesTotal,
                    creditors: fullBrief.financial.creditors.slice(0, 8),
                    netWorkingPosition: fullBrief.financial.netWorkingPosition,
                  }
                : {}),
              ...(subCaps.canInventory
                ? {
                    materialsTotalValue: fullBrief.warehouse.materialsTotalValue,
                    materialsCount: fullBrief.warehouse.materialsCount,
                    fastMovingMaterials: fullBrief.warehouse.fastMovingMaterials,
                    slowMovingMaterials: fullBrief.warehouse.slowMovingMaterials,
                  }
                : {}),
              ...(subCaps.canCatalog || subCaps.canInventory
                ? {
                    productsCount: fullBrief.warehouse.productsCount,
                    productsCostValue: fullBrief.warehouse.productsCostValue,
                    productsRetailValue: fullBrief.warehouse.productsRetailValue,
                    bestSellingProducts: fullBrief.warehouse.bestSellingProducts,
                    slowestProducts: fullBrief.warehouse.slowestProducts,
                  }
                : {}),
            };
          }

          if (subCaps.canInventory) {
            const lowMats = (mats || []).filter(
              (m) => (Number(m.currentStock) || 0) <= (Number(m.minAlertThreshold) || 5)
            );
            lowMaterialsList = lowMats.map(
              (m) => `${m.materialName} (الرصيد: ${m.currentStock} ${m.unit || 'وحدة'} - حد الأمان: ${m.minAlertThreshold || 5})`
            );
          }

          if (subCaps.canProduction) {
            const openOrders = (wOrders || []).filter(
              (w) => w.status === 'open' || w.status === 'in_progress'
            );
            openWorkOrdersList = openOrders.map(
              (w) => `#${w.orderNumber}: "${w.productName}" (${w.status === 'in_progress' ? 'قيد التصنيع' : 'بانتظار الصرف'} - الصانع: ${w.assignedEmployeeName || 'حرفي'})`
            );
          }

          if (subCaps.canOrders || subCaps.canStorefront || subCaps.canSalesCrm) {
            pendingOrdersCount = (ords || []).filter(
              (o) => o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled'
            ).length;
          }
        }
      } catch (ctxErr) {
        console.warn('Live context fetch warning:', ctxErr);
      }

      const subPromptInfo = buildAiSubscriptionPromptContext(userSub, subRole, isSuperAdminAccount);

      recordShamousaAnswerMetric('ai');
      authedFetch('/api/shamousa/knowledge/metrics-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'ai' }),
      }).catch(() => {});
      const res = await authedFetch('/api/shamousa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || 'يرجى فحص وتحليل الصورة المرفقة واستخراج تفاصيلها',
          images: currentAttachment ? [{
            base64: currentAttachment.base64,
            mimeType: currentAttachment.mimeType,
            name: currentAttachment.name,
          }] : [],
          history,
          useSearch: useGoogleSearch || Boolean(sendOptions?.forceSearch),
          artistName: firstName,
          brandName: profile.brandName || (isSupplierAccount ? 'بوابة المورد' : 'الورشة الحرفية'),
          workshopId,
          userEmail: profile.email || '',
          accountRole: isSupplierAccount ? 'supplier' : 'artisan',
          clientWorkshopState: {
            experienceMode,
            experienceModePromptContext: buildShamousaModePromptContext(
              experienceMode,
              isSupplierAccount ? 'supplier' : 'artisan',
              experienceModeConfig
            ),
            subscriptionPromptContext: subPromptInfo.promptText,
            subscriptionScope: subPromptInfo.scopeFlags,
            shamousaOrLearningContext: subCaps.isFullAccess || subCaps.canInventory || subCaps.canFinance
              ? buildShamousaMemoryPromptContext(workshopId)
              : '',
            ...(sendOptions?.explainPayload
              ? {
                  explainItemContext: {
                    source: sendOptions.explainPayload.source,
                    title: sendOptions.explainPayload.title,
                    detail: sendOptions.explainPayload.detail,
                    metricsSummary: sendOptions.explainPayload.metricsSummary,
                    instruction:
                      'اشرحي هذه النقطة بلغة مصرية سهلة وعملية مع خطوات واضحة، وخزّني في سياقك إن صاحب الورشة/المورد مهتم بالموضوع ده لتقديم نصائح أذكى مستقبلاً.',
                  },
                }
              : {}),
            ...(subCaps.canFinance ? { treasuryBalance: currentTreasury, treasuriesDetail: treasuriesList } : {}),
            ...(subCaps.canInventory ? { lowMaterialsCount: lowMaterialsList.length, lowMaterialsList } : {}),
            ...(subCaps.canProduction ? { openWorkOrdersCount: openWorkOrdersList.length, openWorkOrdersList } : {}),
            ...(subCaps.canOrders || subCaps.canStorefront || subCaps.canSalesCrm ? { pendingOrdersCount } : {}),
            ...(executiveBriefPayload ? { executiveBrief: executiveBriefPayload } : {}),
            ...(supplierErpOverviewData ? { supplierErpOverview: supplierErpOverviewData } : {}),
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'حصل خطأ في الاتصال، حاولي تاني.');

      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (useGoogleSearch || Boolean(sendOptions?.forceSearch)) {
        shamousaConn.reportSearchOutcome(!data.searchFailed);
      }

      const isInternalData = /هلخصهالك|خزن|خزينة|خزينه|سيول|سيولة|رصيد|عهدة|عهده|فلوس|خامات|مخزن|أوردر|اوردر|طلب|مبيعات|عميل|عملاء|مورد|موردين|موظف|عمال|دفاتر|حسابات|صفحتي|عيلة|شرائح/i.test(message + ' ' + (data.reply || ''));
      const isFalconExplicitlyRequested = /صقر|تحليل صوره|تحليل صورة|حلل الصورة|دراسة سوق|دراسة السوق|المنافسين/i.test(message);
      const shouldHandoff = subCaps.canSakr && !isInternalData && (Boolean(data.handoffToFalcon) || isFalconExplicitlyRequested);

      const rawLink = data.actionLink || detectNavigationIntent(message, isSupplierAccount);
      const dynamicLink = rawLink && isViewUnlocked(rawLink.view) ? rawLink : undefined;
      const replyChips = detectKeywordActionChips(message, isSupplierAccount, experienceMode).filter(
        (c) => isViewUnlocked(c.view) && (!dynamicLink || c.view !== dynamicLink.view)
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          handoffToFalcon: shouldHandoff,
          actionLink: dynamicLink,
          contactAction: data.contactAction,
          actionChips: replyChips.length > 0 ? replyChips : undefined,
          sources: Array.isArray(data.sources) ? data.sources : undefined,
          searchUsed: Boolean(data.searchUsed),
        },
      ]);
    } catch (err: any) {
      if (useGoogleSearch || Boolean(sendOptions?.forceSearch)) {
        shamousaConn.reportSearchOutcome(false, typeof navigator !== 'undefined' && navigator.onLine === false);
        void shamousaConn.refreshSearchHealth();
      }
      const diplomaticFallback = sendOptions?.explainPayload
        ? buildInstantFallbackExplanation(sendOptions.explainPayload, firstName, isSupplierAccount)
        : `معلش يا **${firstName}**، في زحمة بسيطة على خط البحث الحي دلوقتي.. جرّب تاني بعد لحظة، أو اكتبلي سؤالك عن ورشتك وخاماتك وأنا هرد عليك فوراً ☀️`;
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content:
            sendOptions?.explainPayload || !isSuperAdminAccount
              ? diplomaticFallback
              : `⚠️ ${err?.message || diplomaticFallback}`,
          actionLink: sendOptions?.explainPayload?.targetView
            ? {
                label: sendOptions.explainPayload.actionLabel || 'فتح الشاشة المختصة الآن',
                view: sendOptions.explainPayload.targetView,
              }
            : undefined,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // مفتاح اللعبة (?): إرسال أي مهمة/نتيجة/توصية بحوث عمليات مباشرة لشموسة للشرح + التعلّم المتبادل
  const handleAskShamousaAboutItem = (payload: ShamousaExplainPayload) => {
    playButtonClickSound();
    const updatedMem = recordShamousaQuestionFromPanel(workshopId, payload);
    setTaskMemory(updatedMem);
    setActiveTab('chat');
    const sourceLabel =
      payload.source === 'or360'
        ? 'بحوث العمليات'
        : payload.source === 'result'
        ? 'النتائج الأسبوعية'
        : payload.source === 'appointment'
        ? 'الأجندة والمواعيد'
        : 'مهام اليوم';
    const userQuestion = `يا شموسة، عايزك تشرحيلي النقطة دي من (${sourceLabel}) ببساطة وتقوليلي أعمل إيه بالظبط:\n«${payload.title}»\n${payload.detail}`;
    window.setTimeout(() => {
      void send(userQuestion, { forceAI: true, explainPayload: payload });
    }, 60);
  };

  const handleMarkAllTasksRead = () => {
    playTaskDoneSound();
    const allTaskIds = visibleDailyTasks.map((t) => t.id);
    const allApptIds = visibleAppointments.map((a) => a.id);
    const nextCompleted = Array.from(new Set([...completedTaskIds, ...allTaskIds]));
    setCompletedTaskIds(nextCompleted);
    try {
      localStorage.setItem(tasksDoneStorageKey, JSON.stringify(nextCompleted));
    } catch {}
    setTaskMemory(markManyReadInMemory(workshopId, [...allTaskIds, ...allApptIds]));
  };

  const handleDismissAllTasks = () => {
    playButtonClickSound();
    const allIds = [...visibleDailyTasks.map((t) => t.id), ...visibleAppointments.map((a) => a.id)];
    setTaskMemory(dismissManyInMemory(workshopId, allIds));
  };

  const handleDismissSingleTaskOrAppt = (id: string) => {
    playButtonClickSound();
    setTaskMemory(dismissItemInMemory(workshopId, id));
  };

  const handleRestoreTasksAndAppts = () => {
    playButtonClickSound();
    const allIds = [...dailyTasks.map((t) => t.id), ...appointments.map((a) => a.id)];
    setTaskMemory(restoreDismissedInMemory(workshopId, allIds));
  };

  const toggleHeaderSection = (target: 'tasks_agenda' | 'results' | 'or360') => {
    playButtonClickSound();
    setActiveTab((prev) => {
      const next = prev === target ? 'chat' : target;
      if (next !== 'chat') {
        triggerTopQuestionHint();
      } else {
        setShowQuestionHint(false);
      }
      return next;
    });
  };

  const renderRaisedSilverBtn = (
    id: 'tasks_agenda' | 'results' | 'or360',
    label: string,
    badgeCount?: number
  ) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => toggleHeaderSection(id)}
        aria-pressed={isActive}
        className={`relative px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black tracking-tight transition-all duration-200 cursor-pointer select-none border ${
          isActive
            ? 'bg-gradient-to-b from-[#FFFFFF] via-[#E6ECF5] to-[#BDC9DB] text-[#091533] border-white shadow-[0_0_18px_rgba(235,242,255,0.88),inset_0_1px_2px_rgba(255,255,255,0.98),0_2px_0_#94A3B8] translate-y-[1px]'
            : 'bg-gradient-to-b from-[#FBF7F0] to-[#E5D8C1] dark:from-[#1A3575] dark:to-[#102350] text-[#1C2434] dark:text-[#E5EDF8] border-[#CDBEA3] dark:border-[#314E96] shadow-[0_3px_0_#C4B395,0_4px_8px_rgba(28,36,52,0.12)] dark:shadow-[0_3px_0_#060E24,0_4px_10px_rgba(0,0,0,0.45)] hover:brightness-105 active:translate-y-[1px]'
        }`}
      >
        <span>{label}</span>
        {typeof badgeCount === 'number' && badgeCount > 0 && (
          <span
            className={`absolute -top-1.5 -left-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-mono font-black flex items-center justify-center shadow-sm border ${
              isActive
                ? 'bg-[#142A5C] text-white border-white'
                : 'bg-rose-600 text-white border-[#F4ECE0] dark:border-[#091533]'
            }`}
          >
            {badgeCount}
          </span>
        )}
      </button>
    );
  };

  sendLatestRef.current = send;

  const handleCopyBlock = (blockId: string, content: string) => {
    try {
      navigator.clipboard?.writeText(content);
      setCopiedBlockId(blockId);
      playButtonClickSound();
      window.setTimeout(() => {
        setCopiedBlockId((curr) => (curr === blockId ? null : curr));
      }, 2200);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <>
      {/* Floating compact launcher mascot — ONLY ONE Shamousa on screen */}
      {!isOpen && !hideFloatingLauncher && (
        <DraggableShamosa
          onClick={() => {
            playButtonClickSound();
            setOrbitTriggerNonce(0);
            setIsGlowingAlert(false);
            setIsOpen(true);
            setActiveTab('chat');
          }}
          orbitTriggerNonce={orbitTriggerNonce}
          onOrbitComplete={handleOrbitComplete}
          isGlowingAlert={isGlowingAlert}
        >
          <div
            aria-label={`افتح ${aiCfg.shamousaLauncherName}`}
            title={`${aiCfg.shamousaLauncherName} — اسحبني في أي مكان على الشاشة`}
            className={`group relative flex flex-col items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 select-none ${
              isAnyModalOpen ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 scale-100'
            }`}
          >
            <div className="relative w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center">
              <ShamousaMascotFull
                height="100%"
                alt={aiCfg.shamousaLauncherName}
                className={`w-full h-full object-contain filter select-none pointer-events-none transition-all ${
                  isGlowingAlert
                    ? 'drop-shadow-[0_0_22px_rgba(255,220,120,0.95)] brightness-110'
                    : 'drop-shadow-[0_6px_12px_rgba(9,21,51,0.45)] group-hover:brightness-105'
                }`}
              />
              <span
                title={shamousaConn.isInternetOnline ? 'متصل بالإنترنت' : 'لا يوجد اتصال بالإنترنت'}
                className={`absolute top-0.5 right-1 w-2.5 h-2.5 rounded-full border-2 border-[#091533] shadow-sm z-10 transition-colors ${
                  shamousaConn.isInternetOnline ? 'bg-emerald-400' : 'bg-slate-400'
                }`}
              />

              {totalPendingBadge > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 border-[1.5px] border-white text-white font-mono text-[10px] font-black flex items-center justify-center shadow-md z-20">
                  {totalPendingBadge}
                </span>
              )}
            </div>

            {/* اسم شموسة صغير ومرتب أسفل الأيقونة */}
            <span className="-mt-1 px-2 py-0.5 rounded-full bg-[#091533]/92 text-[#F8E7B9] border border-[#3B5998]/70 text-[9px] leading-none font-black shadow-md backdrop-blur-xs select-none">
              {aiCfg.shamousaLauncherName}
            </span>
          </div>
        </DraggableShamosa>
      )}

      {/* Full-Screen Unified Shamousa Workspace — VisualViewport Pinned (Header Never Disappears on Keyboard!) */}
      {isOpen && (
        <div
          dir="rtl"
          role="dialog"
          aria-label={aiCfg.shamousaLauncherName}
          style={
            vp.height > 200
              ? {
                  top: `${vp.offsetTop}px`,
                  height: `${vp.height}px`,
                }
              : undefined
          }
          className="fixed inset-x-0 top-0 z-[70] w-screen h-[100dvh] flex flex-col overflow-hidden bg-[#F4ECE0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9] animate-in fade-in duration-200"
        >
          {/* Ultra-Clean Header: Shamousa Logo + 3 Raised 3D Silver Moon-Glow Buttons + Close */}
          <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-[#EAE0CE] dark:bg-[#0C1D47] border-b border-[#D5C7B0] dark:border-[#223B78] shrink-0 shadow-xs z-20">
            {/* Shamousa Luminous Mascot Logo */}
            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setActiveTab('chat');
              }}
              aria-label={aiCfg.shamousaLauncherName}
              title={aiCfg.shamousaLauncherName}
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#FBF7F0] dark:bg-[#132960] border-2 border-[#D4C3A3] dark:border-[#395AA8] flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(251,191,36,0.35)] cursor-pointer transition-transform active:scale-95 p-0.5"
            >
              <ShamousaMascotAvatar size="md" statusDot={false} className="w-full h-full" />
              <span
                title={shamousaConn.isInternetOnline ? 'متصل بالإنترنت' : 'لا يوجد اتصال بالإنترنت'}
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#EAE0CE] dark:border-[#0C1D47] transition-colors ${
                  shamousaConn.isInternetOnline ? 'bg-emerald-400' : 'bg-slate-400'
                }`}
              />
            </button>

            {/* Raised 3D Buttons: مهام / نتائج / بحوث — تظهر فقط على قد باقات المشترك */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-1 min-w-0">
              {renderRaisedSilverBtn('tasks_agenda', aiCfg.shamousaBtnTasks, totalPendingBadge)}
              {(subCaps.isFullAccess || subCaps.canFinance || subCaps.canSalesCrm || subCaps.canExecutiveBrief) &&
                renderRaisedSilverBtn('results', aiCfg.shamousaBtnResults)}
              {(subCaps.isFullAccess || subCaps.canInventory || subCaps.canProduction || subCaps.canFinance) &&
                renderRaisedSilverBtn('or360', aiCfg.shamousaBtnOR)}
            </div>

            {/* Free Speaker Toggle (Always Visible, Default ON) + Clean Close Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  shamousaSpeech.toggleEnabled();
                }}
                aria-label={shamousaSpeech.isEnabled ? 'إيقاف صوت شموسة' : 'تشغيل صوت شموسة'}
                aria-pressed={shamousaSpeech.isEnabled}
                title={shamousaSpeech.isEnabled ? 'صوت شموسة شغّال — اضغط لكتمه' : 'صوت شموسة مكتوم — اضغط لتشغيله'}
                className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center shrink-0 transition cursor-pointer active:scale-95 ${
                  shamousaSpeech.isEnabled
                    ? shamousaSpeech.isSpeaking
                      ? 'bg-[#142A5C] dark:bg-[#24489C] border-[#60A5FA] text-white shadow-[0_0_12px_rgba(96,165,250,0.75)] animate-pulse'
                      : 'bg-[#142A5C] dark:bg-[#1E3F8A] border-[#38BDF8]/70 text-white shadow-[0_0_8px_rgba(56,189,248,0.35)]'
                    : 'bg-[#FBF7F0]/80 dark:bg-[#102350] border-[#D5C7B0] dark:border-[#243C78] text-[#94A3B8] dark:text-[#64748B]'
                }`}
              >
                {shamousaSpeech.isEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0C1D47]" />
                  </>
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  playButtonClickSound();
                  shamousaSpeech.stop();
                  stopVoiceRecording();
                  setIsOpen(false);
                }}
                aria-label="إغلاق"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] hover:bg-[#E1D4BE] dark:hover:bg-[#1B377D] border border-[#D5C7B0] dark:border-[#2C488D] text-[#1C2434] dark:text-[#E2E8F0] flex items-center justify-center shrink-0 transition cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </header>

          {/* شريط تلميح رفيع من سطر واحد يظهر لثانيتين فقط بدون حجب الشاشة */}
          {showQuestionHint && (
            <div className="px-3 py-1 bg-[#142A5C] dark:bg-[#DCE4F0] text-white dark:text-[#091533] text-[11px] font-black text-center truncate shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
              💡 أي حاجة مش واضحة؟ اضغط على علامة (؟) وشموسة هتشرحهالك فوراً
            </div>
          )}

          {/* 2-Way Split Bar Under Header: المحادثة الذكية | يومي كان ماشي إزاي */}
          <div className="px-3 sm:px-5 py-2 bg-[#EFE6D7] dark:bg-[#0B1A3F] border-b border-[#D5C7B0] dark:border-[#1E356B] shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <div className="grid grid-cols-2 gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setActiveTab('chat');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    activeTab === 'chat'
                      ? 'bg-[#142A5C] dark:bg-[#1E3F8A] text-white border-[#142A5C] dark:border-[#4C73C9] shadow-sm'
                      : 'bg-[#FBF7F0] dark:bg-[#102350] text-[#334155] dark:text-[#CBD5E1] border-[#D5C7B0] dark:border-[#243C78] hover:border-[#142A5C]/40 dark:hover:border-[#4C73C9]/60'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{aiCfg.shamousaTabChat}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playButtonClickSound();
                    setActiveTab('daily');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    activeTab === 'daily'
                      ? 'bg-[#142A5C] dark:bg-[#1E3F8A] text-white border-[#142A5C] dark:border-[#4C73C9] shadow-sm'
                      : 'bg-[#FBF7F0] dark:bg-[#102350] text-[#334155] dark:text-[#CBD5E1] border-[#D5C7B0] dark:border-[#243C78] hover:border-[#142A5C]/40 dark:hover:border-[#4C73C9]/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{aiCfg.shamousaTabDaily}</span>
                </button>
              </div>

              {messages.length > 0 && activeTab === 'chat' && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    conversationStateRef.current = {};
                  }}
                  aria-label="مسح المحادثة"
                  title="مسح المحادثة"
                  className="p-2 rounded-xl bg-[#FBF7F0] dark:bg-[#102350] border border-[#D5C7B0] dark:border-[#243C78] text-[#64748B] dark:text-[#94A3B8] hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* VIEW 1: Smart Chat View (Default) */}
          {activeTab === 'chat' && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Messages Container — generous top padding so first bubble is NEVER clipped */}
              <div
                ref={listRef}
                className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 pt-5 pb-6 bg-[#F4ECE0] dark:bg-[#091533]"
              >
                <div className="max-w-3xl mx-auto space-y-4">
                  <Bubble role="assistant">
                    {renderText(welcomeMessage)}
                    <div className="flex flex-wrap gap-1.5 pt-3 mt-2.5 border-t border-[#E3D8C5] dark:border-[#233B75]">
                      {(() => {
                        const chips: ShamousaChatbotOption[] = [
                          { id: 'w_new_prod', label: 'منتج جديد ✨', queryText: 'منتج جديد' },
                          { id: 'w_dec_rep', label: 'التحليل والحلول الذكية 📊', queryText: 'التحليل والحلول الذكية' },
                          { id: 'w_write_post', label: 'اكتب لي بوست ✍️', queryText: 'اكتب لي بوست' },
                          { id: 'w_prof_aud', label: 'راجع صفحتي الشخصية 👤', queryText: 'راجع صفحتي الشخصية' },
                        ];
                        if (hasFeature('marketing_review', accountIdForPkg, pkgQueryOptions)) {
                          chips.splice(2, 0, { id: 'w_rev_prods', label: 'راجع منتجاتي 🔍', queryText: 'راجع منتجاتي' });
                        }
                        if (hasFeature('whatsapp_messages', accountIdForPkg, pkgQueryOptions)) {
                          chips.push({ id: 'w_wa_msg', label: 'رسالة واتساب 💬', queryText: 'رسالة واتساب' });
                        }
                        if (hasFeature('executive_brief', accountIdForPkg, pkgQueryOptions)) {
                          chips.push({
                            id: 'w_brief',
                            label: isSupplierAccount ? `${getModeLabel('sup_exec_brief_card')} 💰` : 'هلخصهالك (الفلوس والمخزن) 💰',
                            intentKey: isSupplierAccount ? 'sup_full_brief' : 'full_brief',
                          });
                        }
                        return chips;
                      })().map((wOpt) => (
                        <button
                          key={wOpt.id}
                          type="button"
                          onClick={() => handleChatbotOptionClick(wOpt, 0)}
                          className="text-[11px] sm:text-xs font-black px-3 py-1.5 rounded-xl bg-[#EFE6D7] hover:bg-[#142A5C] text-[#142A5C] hover:text-white dark:bg-[#152B62] dark:text-[#E2E8F0] dark:hover:bg-[#244594] border border-[#D5C7B0] dark:border-[#2C4A91] transition cursor-pointer"
                        >
                          {wOpt.label}
                        </button>
                      ))}
                    </div>
                  </Bubble>

                  {messages.map((m, mIdx) => (
                    <div key={m.id} className="space-y-1.5">
                      <Bubble role={m.role}>
                        {m.attachmentPreview && (
                          <div className="mb-2 overflow-hidden rounded-xl border border-[#D5C7B0] dark:border-[#32519E] max-w-[240px] shadow-xs">
                            <img src={m.attachmentPreview} alt="مرفق" className="w-full h-auto max-h-48 object-cover" />
                          </div>
                        )}
                        {renderText(m.content)}
                        {m.role === 'assistant' && shamousaSpeech.isSupported && (
                          <div className="mt-1.5 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                shamousaSpeech.unlock();
                                if (shamousaSpeech.isSpeaking) {
                                  shamousaSpeech.stop();
                                } else {
                                  if (!shamousaSpeech.isEnabled) shamousaSpeech.toggleEnabled();
                                  shamousaSpeech.speak(m.content);
                                }
                              }}
                              title={shamousaSpeech.isSpeaking ? 'إيقاف القراءة' : 'اسمع الرد بصوت شموسة'}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#142A5C] dark:hover:text-[#DCE8FF] hover:bg-[#EFE6D7] dark:hover:bg-[#13285C] transition cursor-pointer"
                            >
                              {shamousaSpeech.isSpeaking ? (
                                <VolumeX className="w-3 h-3" />
                              ) : (
                                <Volume2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                        {isSuperAdminAccount && (m.searchUsed || (m.sources && m.sources.length > 0)) && (
                          <div className="mt-2 pt-2 border-t border-[#E3D8C5] dark:border-[#243C78] space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                              <Globe className="w-3 h-3" />
                              <span>بحث حي مباشر (عرض السوبر أدمن فقط)</span>
                            </span>
                            {m.sources && m.sources.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {m.sources.map((src, idx) => (
                                  <a
                                    key={idx}
                                    href={src.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-[#EFE6D7] dark:bg-[#13285C] text-[#1C2434] dark:text-[#CBD5E1] border border-[#D5C7B0] dark:border-[#2B478C] hover:border-[#142A5C]"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                    <span className="truncate max-w-[160px]">{src.title || src.url}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Bubble>

                      {m.copyBlocks && m.copyBlocks.length > 0 && (
                        <div className="space-y-2 pr-2 pt-1 max-w-2xl">
                          {m.copyBlocks.map((block) => {
                            const fbKey = `${m.id}_${block.id}`;
                            const isCopied = copiedBlockId === fbKey;
                            const fbState = copyFeedbackByKey[fbKey];
                            const canTrackPublish =
                              hasFeature('storefront', accountIdForPkg, pkgQueryOptions) ||
                              hasFeature('sales_crm', accountIdForPkg, pkgQueryOptions);
                            const handleRateCopy = (rating: CopyFeedbackRating) => {
                              recordCopyTextFeedback(accountIdForPkg, {
                                blockId: block.id,
                                templateId: block.templateId || block.id,
                                tone: (block.tone as LearnedToneStyle) || 'friendly',
                                productName: block.productName,
                                rating,
                              });
                              setCopyFeedbackByKey((prev) => ({
                                ...prev,
                                [fbKey]: {
                                  ...prev[fbKey],
                                  rating,
                                  awaitingReason: rating === 'edited' || rating === 'not_suitable',
                                },
                              }));
                            };
                            const handleReasonChip = (reason: CopyFeedbackReason) => {
                              recordCopyTextFeedback(accountIdForPkg, {
                                blockId: block.id,
                                templateId: block.templateId || block.id,
                                tone: (block.tone as LearnedToneStyle) || 'friendly',
                                productName: block.productName,
                                rating: fbState?.rating || 'not_suitable',
                                reason,
                              });
                              setCopyFeedbackByKey((prev) => ({
                                ...prev,
                                [fbKey]: {
                                  ...prev[fbKey],
                                  reason,
                                  awaitingReason: false,
                                },
                              }));
                            };
                            const handleMarkPublished = async () => {
                              const ords = workshopId
                                ? await db.orders.where('tenantId').equals(workshopId).toArray().catch(() => [])
                                : [];
                              recordPublishedProductShare({
                                accountId: accountIdForPkg,
                                packageOptions: pkgQueryOptions,
                                productName: block.productName || block.title,
                                templateId: block.templateId || block.id,
                                tone: (block.tone as LearnedToneStyle) || 'friendly',
                                channel: 'published',
                                orders: ords,
                              });
                              setCopyFeedbackByKey((prev) => ({
                                ...prev,
                                [fbKey]: { ...prev[fbKey], published: true },
                              }));
                            };
                            return (
                              <div
                                key={block.id}
                                className="rounded-xl bg-[#FBF7F0] dark:bg-[#0F214C] border border-[#D5C7B0] dark:border-[#2A4585] p-3 space-y-2 shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] sm:text-xs font-black text-[#142A5C] dark:text-[#FBBF24]">
                                    {block.title}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyBlock(fbKey, block.content)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EAE0CE] hover:bg-[#142A5C] text-[#142A5C] hover:text-white dark:bg-[#1A3573] dark:text-[#E2E8F0] text-[10px] font-black transition cursor-pointer shrink-0"
                                  >
                                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                                  </button>
                                </div>
                                <div className="text-xs text-[#1C2434] dark:text-[#E2E8F0] whitespace-pre-wrap leading-relaxed">
                                  {renderText(block.content)}
                                </div>
                                {/* أزرار تقييم النص الجاهز وتعلّم الأسلوب المحلي للحساب */}
                                <div className="pt-1.5 border-t border-[#E5DAC6] dark:border-[#243E7D] flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRateCopy('used')}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                      fbState?.rating === 'used'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-[#EFE6D5] hover:bg-emerald-600/20 text-[#142A5C] dark:bg-[#162E66] dark:text-[#CBD5E1]'
                                    }`}
                                  >
                                    استخدمته ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRateCopy('edited')}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                      fbState?.rating === 'edited'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-[#EFE6D5] hover:bg-amber-500/20 text-[#142A5C] dark:bg-[#162E66] dark:text-[#CBD5E1]'
                                    }`}
                                  >
                                    عدّلته ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRateCopy('not_suitable')}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                      fbState?.rating === 'not_suitable'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-[#EFE6D5] hover:bg-rose-500/20 text-[#142A5C] dark:bg-[#162E66] dark:text-[#CBD5E1]'
                                    }`}
                                  >
                                    مش مناسب ✕
                                  </button>
                                  {canTrackPublish && (
                                    <button
                                      type="button"
                                      onClick={() => void handleMarkPublished()}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                        fbState?.published
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-[#EAE0CE] hover:bg-indigo-600/20 text-[#142A5C] dark:bg-[#1A3573] dark:text-[#E2E8F0]'
                                      }`}
                                    >
                                      {fbState?.published ? 'تم تسجيل النشر (متابعة 7 أيام) ✓' : 'نشرت / شاركت 📣'}
                                    </button>
                                  )}
                                  {fbState?.reason && (
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                      • اتعلمت: ({COPY_FEEDBACK_REASON_LABELS[fbState.reason]})
                                    </span>
                                  )}
                                </div>
                                {fbState?.awaitingReason && (
                                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                    <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                                      السبب السريع:
                                    </span>
                                    {(
                                      ['too_long', 'too_formal', 'too_expensive', 'not_my_style'] as CopyFeedbackReason[]
                                    ).map((rk) => (
                                      <button
                                        key={rk}
                                        type="button"
                                        onClick={() => handleReasonChip(rk)}
                                        className="px-2 py-0.5 rounded-md bg-white dark:bg-[#142A5C] border border-[#D4C6AD] dark:border-[#3555A1] hover:border-amber-500 text-[10px] font-bold text-[#142A5C] dark:text-[#E2E8F0] cursor-pointer transition"
                                      >
                                        {COPY_FEEDBACK_REASON_LABELS[rk]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {m.productPrefillDraft && (
                        <div className="flex justify-start pr-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              playButtonClickSound();
                              saveProductWizardPrefillDraft(m.productPrefillDraft!);
                              openScreen('direct_product_prefill');
                            }}
                            className="inline-flex items-center gap-2 text-xs sm:text-sm font-black px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                            <span>ضيف المنتج بالبيانات دي</span>
                          </button>
                        </div>
                      )}

                      {m.wizardChoices && m.wizardChoices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                          {m.wizardChoices.map((wc) => {
                            const isSelected = Boolean(m.wizardMultiSelected?.includes(wc.value));
                            return (
                              <button
                                key={wc.id}
                                type="button"
                                onClick={() => {
                                  playButtonClickSound();
                                  void send(wc.value);
                                }}
                                className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black px-3 py-1.5 rounded-xl border transition shadow-xs cursor-pointer active:scale-95 ${
                                  wc.isDoneMulti
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                                    : isSelected
                                    ? 'bg-[#EA580C] text-white border-[#EA580C]'
                                    : wc.isCustom
                                    ? 'bg-[#FBF7F0] hover:bg-[#EAE0CE] text-[#142A5C] dark:bg-[#122657] dark:text-[#E2E8F0] border-[#CDBEA3] dark:border-[#3454A1]'
                                    : 'bg-[#142A5C] hover:bg-[#1E3F8A] text-white dark:bg-[#1B377B] dark:hover:bg-[#2549A0] border-[#1E3F8A] dark:border-[#3D60B5]'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                                <span>{wc.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {m.chatbotOptions && m.chatbotOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                          {m.chatbotOptions.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleChatbotOptionClick(opt, mIdx)}
                              className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black px-3 py-1.5 rounded-xl border transition shadow-xs cursor-pointer active:scale-95 ${
                                opt.triggerAI
                                  ? 'bg-[#FBF7F0] hover:bg-[#EAE0CE] text-[#142A5C] dark:bg-[#122657] dark:text-[#E2E8F0] border-[#CDBEA3] dark:border-[#3454A1]'
                                  : 'bg-[#142A5C] hover:bg-[#1E3F8A] text-white dark:bg-[#1B377B] dark:hover:bg-[#2549A0] border-[#1E3F8A] dark:border-[#3D60B5]'
                              }`}
                            >
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {m.disambiguationChoices && m.disambiguationChoices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                          {m.disambiguationChoices.map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => handleDisambiguationChoiceClick(choice)}
                              className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black px-3 py-1.5 rounded-xl bg-[#142A5C] hover:bg-[#1E3F8A] text-white dark:bg-[#1B377B] dark:hover:bg-[#2549A0] border border-[#244594] transition shadow-xs cursor-pointer active:scale-95"
                            >
                              <span>{choice.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {m.actionChips && m.actionChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                          {m.actionChips.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => handleActionChipClick(chip)}
                              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-xl bg-[#EAE0CE] hover:bg-[#DFD2BA] text-[#142A5C] dark:bg-[#132960] dark:text-[#DCE6F7] border border-[#CDBEA3] dark:border-[#2E4C94] transition shadow-2xs cursor-pointer active:scale-95"
                            >
                              <span>{chip.label}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {m.actionLink && (
                        <div className="flex justify-start pr-2">
                          <button
                            type="button"
                            onClick={() => openScreen(m.actionLink!.view)}
                            className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-xl bg-[#EAE0CE] hover:bg-[#142A5C] text-[#142A5C] hover:text-white dark:bg-[#152B62] dark:text-[#E2E8F0] dark:hover:bg-[#234491] border border-[#CDBEA3] dark:border-[#31509B] transition shadow-2xs cursor-pointer active:scale-95"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{m.actionLink.label}</span>
                          </button>
                        </div>
                      )}

                      {m.contactAction && (
                        <div className="flex justify-start pr-2">
                          <a
                            href={`tel:${m.contactAction.phone}`}
                            className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>اتصال بـ {m.contactAction.name} ({m.contactAction.phone})</span>
                          </a>
                        </div>
                      )}

                      {m.handoffToFalcon && (
                        <div className="flex justify-start pr-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onOpenFalcon();
                            }}
                            className="inline-flex items-center gap-2 text-xs font-black px-3.5 py-1.5 rounded-xl bg-[#0C1D47] text-[#E2E8F0] border border-[#3B5998] hover:bg-[#142E6B] transition shadow-sm cursor-pointer active:scale-95"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-[#CBD5E1]" />
                            <span>{aiCfg.falconHandoffBtnLabel}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <Bubble role="assistant">
                      <span className="inline-flex gap-1.5 items-center py-1" aria-label="شموسة تبحث وتراجع">
                        <span className="w-2 h-2 rounded-full bg-[#142A5C] dark:bg-[#93C5FD] animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-[#142A5C] dark:bg-[#93C5FD] animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-[#142A5C] dark:bg-[#93C5FD] animate-bounce [animation-delay:300ms]" />
                        <span className="text-xs text-[#475569] dark:text-[#CBD5E1] mr-2 font-bold">
                          شموسة تراجع دفاتر وسجلات الورشة...
                        </span>
                      </span>
                    </Bubble>
                  )}
                </div>
              </div>

              {/* معاينة المرفق قيد الإرسال */}
              {pendingAttachment && (
                <div className="px-4 py-2 bg-[#EAE0CE] dark:bg-[#0F204D] border-t border-[#D5C7B0] dark:border-[#243C78] flex items-center justify-between gap-2 shrink-0">
                  <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={pendingAttachment.base64}
                        alt="مرفق"
                        className="w-9 h-9 rounded-xl object-cover border border-[#CDBEA3] dark:border-[#3655A2] shrink-0"
                      />
                      <div className="min-w-0 text-right">
                        <span className="text-xs font-bold text-[#1C2434] dark:text-[#F1F5F9] block truncate max-w-[200px]">
                          {pendingAttachment.name || 'مستند / صورة'}
                        </span>
                        <span className="text-[10px] text-[#475569] dark:text-[#94A3B8] block font-bold">
                          مرفق جاهز للإرسال
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingAttachment(null)}
                      className="p-1.5 rounded-full hover:bg-[#DFD2BA] dark:hover:bg-[#19326E] text-[#475569] hover:text-rose-600 transition cursor-pointer"
                      title="حذف المرفق"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Spacious 2-Tier Chat Composer — Clear Multi-Line Writing Area Above Action Icons */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  stopVoiceRecording();
                  shamousaSpeech.unlock();
                  send(input);
                }}
                className="px-3 sm:px-5 py-2 sm:py-2.5 border-t border-[#D5C7B0] dark:border-[#223B78] bg-[#EAE0CE] dark:bg-[#0C1D47] shrink-0"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf"
                  onChange={handleAttachmentSelected}
                  className="hidden"
                />

                {/* شريط وضع «إضافة للمكتبات» الحصري للسوبر أدمن + قائمة المحفوظات */}
                {isSuperAdminAccount && activeAdminLibCategory && (() => {
                  const activeCat = ADMIN_LIBRARY_CATEGORIES.find((c) => c.id === activeAdminLibCategory);
                  return (
                    <div className="max-w-3xl mx-auto mb-2 px-3 py-2 rounded-xl bg-amber-100/95 dark:bg-amber-950/60 border border-amber-400/70 dark:border-amber-600/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-black text-amber-950 dark:text-amber-200">
                        <BookPlus className="w-4 h-4 shrink-0" />
                        <span>إضافة إلى: {activeCat?.labelAr}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeCat?.exampleAr) {
                              setInput(activeCat.exampleAr);
                              inputRef.current?.focus();
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-white/80 dark:bg-[#132960] border border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-950 dark:text-amber-100 hover:brightness-95 cursor-pointer"
                        >
                          حطلي مثال جاهز ✨
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAdminLibCategory(null)}
                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                        >
                          إلغاء ×
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {isSuperAdminAccount && showAdminLibSavedList && (() => {
                  void customLibVersion;
                  const storeSnap = loadCustomLibrariesStore();
                  const totalSaved = countCustomLibraryItems(storeSnap);
                  const handleDeleteItem = (id: string) => {
                    const next = deleteCustomLibraryItemById(id);
                    setCustomLibVersion((v) => v + 1);
                    authedFetch('/api/admin/shamousa/custom-libraries', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ store: next }),
                    }).catch(() => {});
                  };
                  return (
                    <div className="max-w-3xl mx-auto mb-2 p-3 rounded-xl bg-[#FBF7F0] dark:bg-[#0F204D] border border-[#CDBEA3] dark:border-[#2E4C94] max-h-48 overflow-y-auto space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-[#E3D8C5] dark:border-[#223B78] pb-1.5">
                        <span className="font-black text-[#142A5C] dark:text-[#E2E8F0]">
                          📚 إضافات السوبر أدمن المحفوظة ({totalSaved})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAdminLibSavedList(false)}
                          className="text-[#64748B] hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {totalSaved === 0 ? (
                        <p className="text-[#64748B] dark:text-[#94A3B8] text-[11px]">
                          لسه مفيش إضافات يدوية — اختار أي قسم من قائمة «إضافة للمكتبات» وابعت اللي تحبه.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {storeSnap.customSpecialties.map((s) => (
                            <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#EFE6D7] dark:bg-[#132960]">
                              <span className="font-bold truncate">📣 تخصص: {s.nameAr} ({s.keywords.length} كلمات)</span>
                              <button type="button" onClick={() => handleDeleteItem(s.id)} className="text-rose-600 hover:underline text-[11px] font-bold shrink-0 cursor-pointer">حذف</button>
                            </div>
                          ))}
                          {storeSnap.specialtyPatches.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#EFE6D7] dark:bg-[#132960]">
                              <span className="font-bold truncate">✍️ تحديث على: {p.targetSpecialtyNameAr}</span>
                              <button type="button" onClick={() => handleDeleteItem(p.id)} className="text-rose-600 hover:underline text-[11px] font-bold shrink-0 cursor-pointer">حذف</button>
                            </div>
                          ))}
                          {storeSnap.knowledgeNotes.map((n) => (
                            <div key={n.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#EFE6D7] dark:bg-[#132960]">
                              <span className="font-bold truncate">🧠 {n.titleAr}</span>
                              <button type="button" onClick={() => handleDeleteItem(n.id)} className="text-rose-600 hover:underline text-[11px] font-bold shrink-0 cursor-pointer">حذف</button>
                            </div>
                          ))}
                          {storeSnap.generalAdditions.hooks.length + storeSnap.generalAdditions.titleTemplates.length + storeSnap.generalAdditions.objectionReplies.length > 0 && (
                            <div className="text-[11px] text-[#475569] dark:text-[#CBD5E1] px-2">
                              • قوالب عامة مضافة: {storeSnap.generalAdditions.titleTemplates.length} عنوان، {storeSnap.generalAdditions.hooks.length} بداية بوست، {storeSnap.generalAdditions.objectionReplies.length} رد اعتراض.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="max-w-3xl mx-auto rounded-2xl border border-[#CDBEA3] dark:border-[#2E4C94] bg-[#FBF7F0] dark:bg-[#091533] focus-within:ring-2 focus-within:ring-[#1E3F8A] dark:focus-within:ring-[#60A5FA] transition shadow-xs relative">
                  {/* Top Tier: Full-Width 2-Line Clear Textarea */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      adjustTextareaHeight(e.target);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        stopVoiceRecording();
                        send(input);
                      }
                    }}
                    rows={2}
                    maxLength={isSuperAdminAccount && activeAdminLibCategory ? 12000 : 1000}
                    placeholder={
                      isSuperAdminAccount && activeAdminLibCategory
                        ? ADMIN_LIBRARY_CATEGORIES.find((c) => c.id === activeAdminLibCategory)?.placeholderAr || 'اكتب أو الصق الإضافة هنا...'
                        : useGoogleSearch
                        ? 'اسأل شموسة عن أحدث أسعار السوق والخامات...'
                        : aiCfg.shamousaChatPlaceholder
                    }
                    className="w-full min-h-[52px] max-h-32 resize-none overflow-y-auto px-3.5 pt-2.5 pb-1 bg-transparent text-[#1C2434] dark:text-[#F1F5F9] placeholder:text-[#64748B] dark:placeholder:text-[#94A3B8] text-[13px] sm:text-sm leading-relaxed outline-none block"
                  />

                  {/* Bottom Tier: Clean Compact Action Bar */}
                  <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* زر المرفقات */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="إرفاق فاتورة أو صورة"
                        className="w-8 h-8 rounded-xl bg-[#EFE6D7] dark:bg-[#122657] border border-[#D5C7B0] dark:border-[#2A468B] text-[#475569] dark:text-[#CBD5E1] hover:text-[#142A5C] dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {/* زر التسجيل الصوتي الفوري — ينوّر أحمر بهدوء أثناء الكلام ويكتب فوراً */}
                      <button
                        type="button"
                        onClick={toggleVoiceRecording}
                        aria-pressed={isRecordingVoice}
                        title={isRecordingVoice ? 'إيقاف الميكروفون' : 'تحدث بصوتك ليتحول لكتابة فوراً'}
                        className={`relative w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          isRecordingVoice
                            ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_12px_rgba(225,29,72,0.55)] ring-2 ring-rose-400/40'
                            : isTranscribingVoice
                            ? 'bg-[#142A5C] border-[#2C4B94] text-white animate-pulse'
                            : 'bg-[#EFE6D7] dark:bg-[#122657] border-[#D5C7B0] dark:border-[#2A468B] text-[#475569] dark:text-[#CBD5E1] hover:text-[#142A5C] dark:hover:text-white'
                        }`}
                      >
                        {isRecordingVoice && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-300 animate-ping pointer-events-none" />
                        )}
                        {isRecordingVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>

                      {/* زر البحث الذكي المباشر بأيقونة شموسة — 3 حالات حقيقية (مغلق / متصل أخضر / منقطع رصاصي) */}
                      <button
                        type="button"
                        onClick={() => {
                          setUseGoogleSearch((prev) => {
                            const next = !prev;
                            if (next) void shamousaConn.refreshSearchHealth();
                            return next;
                          });
                        }}
                        title={
                          shamousaConn.searchButtonState === 'live'
                            ? 'البحث الذكي المباشر مُفعّل ومتصل الآن'
                            : shamousaConn.searchButtonState === 'disconnected'
                            ? 'البحث المباشر مُفعّل لكن الخدمة غير متصلة حالياً'
                            : 'تفعيل البحث الذكي المباشر للأسعار والسوق'
                        }
                        aria-pressed={useGoogleSearch}
                        className={`relative w-8 h-8 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                          shamousaConn.searchButtonState === 'live'
                            ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.65)]'
                            : shamousaConn.searchButtonState === 'disconnected'
                            ? 'bg-slate-500/85 border-slate-400 text-white grayscale opacity-90 shadow-none'
                            : 'bg-[#EFE6D7] dark:bg-[#122657] border-[#D5C7B0] dark:border-[#2A468B] hover:border-[#142A5C]'
                        }`}
                      >
                        <img
                          src={shamousaSearchIconImg}
                          alt="البحث المباشر"
                          draggable={false}
                          className="w-5 h-5 object-contain select-none pointer-events-none"
                        />
                        {shamousaConn.searchButtonState !== 'off' && (
                          <span
                            aria-hidden="true"
                            className={`absolute -top-0.5 -right-0.5 z-20 w-2 h-2 rounded-full border border-white dark:border-[#0C1D47] shadow-sm pointer-events-none ${
                              shamousaConn.searchButtonState === 'live' ? 'bg-emerald-300' : 'bg-slate-300'
                            }`}
                          />
                        )}
                      </button>

                      {/* زر «إضافة للمكتبات ▾» الحصري للسوبر أدمن — قائمة منسدلة تضيف مباشرة لمكتبات شموسة بدون كود */}
                      {isSuperAdminAccount && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              playButtonClickSound();
                              setAdminLibMenuOpen((prev) => !prev);
                            }}
                            title="إضافة للمكتبات (سوبر أدمن فقط)"
                            className={`h-8 px-2.5 rounded-xl border text-[11px] font-black flex items-center gap-1 transition cursor-pointer shrink-0 ${
                              activeAdminLibCategory
                                ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                                : 'bg-[#EFE6D7] dark:bg-[#122657] border-[#D5C7B0] dark:border-[#2A468B] text-[#142A5C] dark:text-[#E2E8F0] hover:border-amber-500'
                            }`}
                          >
                            <BookPlus className="w-3.5 h-3.5 shrink-0" />
                            <span>إضافة للمكتبات</span>
                            <ChevronDown className="w-3 h-3 shrink-0" />
                          </button>

                          {adminLibMenuOpen && (
                            <div className="absolute bottom-10 right-0 z-50 w-72 rounded-2xl bg-[#FBF7F0] dark:bg-[#0F204D] border border-[#CDBEA3] dark:border-[#3454A1] shadow-xl p-1.5 space-y-1 text-right">
                              <div className="px-2.5 py-1 text-[10px] font-black text-[#64748B] dark:text-[#94A3B8] border-b border-[#E3D8C5] dark:border-[#223B78]">
                                اختار المكتبة اللي عايز تضيف فيها (سوبر أدمن)
                              </div>
                              {ADMIN_LIBRARY_CATEGORIES.map((cat) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => {
                                    playButtonClickSound();
                                    setActiveAdminLibCategory(cat.id);
                                    setAdminLibMenuOpen(false);
                                    setShowAdminLibSavedList(false);
                                    inputRef.current?.focus();
                                  }}
                                  className={`w-full text-right px-2.5 py-2 rounded-xl transition cursor-pointer ${
                                    activeAdminLibCategory === cat.id
                                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100'
                                      : 'hover:bg-[#EFE6D7] dark:hover:bg-[#17306F] text-[#1C2434] dark:text-[#F1F5F9]'
                                  }`}
                                >
                                  <div className="text-xs font-black">{cat.labelAr}</div>
                                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] leading-snug">
                                    {cat.descriptionAr}
                                  </div>
                                </button>
                              ))}
                              <div className="border-t border-[#E3D8C5] dark:border-[#223B78] pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAdminLibSavedList((v) => !v);
                                    setAdminLibMenuOpen(false);
                                  }}
                                  className="w-full text-right px-2.5 py-1.5 rounded-xl text-[11px] font-black text-[#142A5C] dark:text-[#93C5FD] hover:bg-[#EFE6D7] dark:hover:bg-[#17306F] cursor-pointer"
                                >
                                  📋 عرض / إدارة الإضافات المحفوظة ({countCustomLibraryItems()})
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* زر الإرسال */}
                    <button
                      type="submit"
                      disabled={(!input.trim() && !pendingAttachment) || isLoading}
                      aria-label="إرسال"
                      title="إرسال (Ctrl+Enter)"
                      className="w-9 h-8 shrink-0 rounded-xl bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#24489C] dark:hover:bg-[#2F59BD] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-sm active:scale-95 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {remaining !== null && (
                  <p className="text-[10px] text-center text-[#64748B] dark:text-[#94A3B8] pt-1 font-bold">
                    باقي {remaining} استفسار اليوم
                  </p>
                )}
              </form>
            </div>
          )}

          {/* VIEW 2, 3, 4: Daily Check-in / Results / OR 360 Unified Panels */}
          {(activeTab === 'daily' || activeTab === 'results' || activeTab === 'or360') && (
            <div className="flex-1 min-h-0 flex flex-col">
              <ShamousaUnifiedPanels
                profile={profile}
                mode={activeTab}
                onSwitchToOR={() => setActiveTab('or360')}
                onNavigateView={(view) => openScreen(view)}
                onCloseShamousa={() => setIsOpen(false)}
                onScheduleSnooze={handleScheduleSnooze}
                onDailyTimeChanged={(hhmm) => {
                  setDailyCheckinTime(hhmm);
                  try {
                    localStorage.setItem(`shamousa_daily_time_${workshopId}`, hhmm);
                  } catch {}
                }}
                onTestOrbitDemo={handleTestOrbitDemo}
                onAskShamousaAboutItem={handleAskShamousaAboutItem}
                injectedFollowupMessage={injectedDailyFollowup}
              />
            </div>
          )}

          {/* VIEW 5: Daily Tasks & Delivery Agenda View (Royal Blue / Sandy Beige — Unified ?, ✓✓, ✕ Controls) */}
          {activeTab === 'tasks_agenda' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#F4ECE0] dark:bg-[#091533]">
              <div className="max-w-3xl mx-auto space-y-4">
                {/* شريط الإجراءات الجماعية لقسم المهام والأجندة */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="text-[11px] font-black text-[#475569] dark:text-[#94A3B8]">
                    {visibleDailyTasks.length + visibleAppointments.length} عنصر ظاهر
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {visibleDailyTasks.length + visibleAppointments.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={handleMarkAllTasksRead}
                          className="px-2.5 py-1 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] border border-[#D5C7B0] dark:border-[#2C4A91] text-[#142A5C] dark:text-[#E2E8F0] hover:border-emerald-500 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>الكل مقروء</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDismissAllTasks}
                          className="px-2.5 py-1 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] border border-[#D5C7B0] dark:border-[#2C4A91] text-rose-700 dark:text-rose-300 hover:border-rose-400 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>مسح الكل</span>
                        </button>
                      </>
                    )}
                    {dailyTasks.length - visibleDailyTasks.length + (appointments.length - visibleAppointments.length) > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreTasksAndAppts}
                        className="px-2.5 py-1 rounded-xl bg-[#EAE0CE] dark:bg-[#19326E] text-[#142A5C] dark:text-[#CBD5E1] text-[11px] font-black inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>
                          استعادة (
                          {dailyTasks.length - visibleDailyTasks.length + (appointments.length - visibleAppointments.length)})
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* قسم 1: توجيهات ومهام اليوم من شموسة */}
                <div className="p-4 rounded-2xl bg-[#FBF7F0] dark:bg-[#0F204D] border border-[#D5C7B0] dark:border-[#243C78] shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E3D8C5] dark:border-[#1E356B] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">☀️</span>
                      <h3 className="text-xs sm:text-sm font-black text-[#1C2434] dark:text-[#F1F5F9]">
                        توجيهات ومهام اليوم من شموسة
                      </h3>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#EAE0CE] dark:bg-[#19326E] text-[#142A5C] dark:text-[#CBD5E1] font-black">
                      {completedTaskIds.filter((id) => visibleDailyTasks.some((t) => t.id === id)).length} / {visibleDailyTasks.length} مقروء
                    </span>
                  </div>

                  {visibleDailyTasks.length === 0 ? (
                    <div className="text-center py-4 text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
                      تمت مراجعة وتفريغ مهام اليوم بنجاح ✨
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {visibleDailyTasks.map((task) => {
                        const isDone =
                          completedTaskIds.includes(task.id) || taskMemory.readIds.includes(task.id);
                        const isExpanded = Boolean(expandedTaskIds[task.id]);
                        return (
                          <div
                            key={task.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                              isDone
                                ? 'bg-emerald-500/10 border-emerald-500/35 opacity-75'
                                : task.urgency === 'high'
                                ? 'bg-[#EFE6D7] dark:bg-[#152B62] border-[#B8A586] dark:border-[#395AA8]'
                                : 'bg-[#F4ECE0] dark:bg-[#102250] border-[#D5C7B0] dark:border-[#243C78]'
                            }`}
                          >
                            {/* رأس البطاقة مع أزرار (؟) و (✓✓) و (✕) */}
                            <div className="flex items-start justify-between gap-2">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  if (task.view && isExpanded) {
                                    openScreen(task.view);
                                  } else {
                                    setExpandedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setExpandedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }));
                                  }
                                }}
                                className="min-w-0 flex-1 cursor-pointer group"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-xs sm:text-sm font-black transition-all group-hover:underline ${
                                      isDone
                                        ? 'line-through text-[#64748B]'
                                        : 'text-[#1C2434] dark:text-[#F1F5F9]'
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                  {task.urgency === 'high' && !isDone && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 font-black">
                                      عاجل
                                    </span>
                                  )}
                                  {isDone && (
                                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                                      مقروء
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={`text-xs mt-1 leading-relaxed transition-all ${
                                    isDone
                                      ? 'line-through text-[#64748B]'
                                      : 'text-[#475569] dark:text-[#CBD5E1]'
                                  }`}
                                >
                                  {task.detail}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAskShamousaAboutItem({
                                      id: task.id,
                                      source: 'task',
                                      category: task.urgency === 'high' ? 'operational' : 'task',
                                      title: task.title,
                                      detail: task.detail,
                                      targetView: task.view,
                                      actionLabel: task.actionLabel,
                                    });
                                  }}
                                  title="اسأل شموسة تشرحلي المهمة دي"
                                  aria-label="اسأل شموسة"
                                  className="w-7 h-7 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#091533] flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer"
                                >
                                  <HelpCircle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleTask(task.id);
                                  }}
                                  title={isDone ? 'مقروء ومنجز' : 'تحديد كمقروء ومنجز (✓✓)'}
                                  aria-label="تحديد كمقروء"
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all cursor-pointer active:scale-90 ${
                                    isDone
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-[#FBF7F0] dark:bg-[#091533] text-[#475569] dark:text-[#CBD5E1] hover:text-emerald-600 border-[#C4B395] dark:border-[#35539E] hover:border-emerald-500'
                                  }`}
                                >
                                  <CheckCheck className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismissSingleTaskOrAppt(task.id);
                                  }}
                                  title="عرفت خلاص — إزالة"
                                  aria-label="إزالة المهمة"
                                  className="w-7 h-7 rounded-lg bg-[#FBF7F0] dark:bg-[#091533] border border-[#C4B395] dark:border-[#35539E] text-[#64748B] hover:text-rose-600 hover:border-rose-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-2.5 rounded-lg bg-[#FBF7F0] dark:bg-[#091533]/70 border border-[#D5C7B0] dark:border-[#243C78] text-[11px] text-[#334155] dark:text-[#CBD5E1] flex flex-wrap items-center justify-between gap-2">
                                <span>💡 محتاج تفاصيل أكتر أو خطة تنفيذ؟ ابعتها لشموسة بعلامة (؟) أو افتح الشاشة مباشرة.</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAskShamousaAboutItem({
                                      id: task.id,
                                      source: 'task',
                                      category: 'operational',
                                      title: task.title,
                                      detail: task.detail,
                                      targetView: task.view,
                                      actionLabel: task.actionLabel,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#142A5C] text-white font-black cursor-pointer"
                                >
                                  اسأل شموسة
                                </button>
                              </div>
                            )}

                            {task.view && !isDone && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => openScreen(task.view!)}
                                  className="px-3 py-1 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] text-white text-[11px] font-black transition cursor-pointer flex items-center gap-1 active:scale-95"
                                >
                                  <span>{task.actionLabel}</span>
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* قسم 2: مواعيد وأجندة تسليم الطلبيات والربط مع تقويم جوجل */}
                <div className="p-4 rounded-2xl bg-[#FBF7F0] dark:bg-[#0F204D] border border-[#D5C7B0] dark:border-[#243C78] shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E3D8C5] dark:border-[#1E356B] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#142A5C] dark:text-[#93C5FD]" />
                      <h3 className="text-xs sm:text-sm font-black text-[#1C2434] dark:text-[#F1F5F9]">
                        مواعيد وأجندة الورشة
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playButtonClickSound();
                        setIsNewApptFormOpen(!isNewApptFormOpen);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#24489C] dark:hover:bg-[#2F59BD] text-white text-xs font-black transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>موعد جديد</span>
                    </button>
                  </div>

                  {isNewApptFormOpen && (
                    <form
                      onSubmit={handleCreateAppointment}
                      className="p-3.5 rounded-xl bg-[#EFE6D7] dark:bg-[#132960] border border-[#CDBEA3] dark:border-[#32519E] space-y-2.5 animate-in fade-in duration-200"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#D5C7B0] dark:border-[#243C78]">
                        <span className="text-xs font-black text-[#142A5C] dark:text-[#E2E8F0]">
                          تسجيل موعد أو تسليم جديد 📅
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsNewApptFormOpen(false)}
                          className="text-[#64748B] hover:text-[#1C2434] dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          value={apptFormTitle}
                          onChange={(e) => setApptFormTitle(e.target.value)}
                          placeholder="عنوان الموعد أو المشغولة (مثلاً: تسليم طقم صواني رخام)"
                          required
                          className="w-full text-xs p-2.5 rounded-lg border border-[#CDBEA3] dark:border-[#32519E] bg-[#FBF7F0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9] font-bold"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={apptFormClient}
                            onChange={(e) => setApptFormClient(e.target.value)}
                            placeholder="اسم العميل (اختياري)"
                            className="w-full text-xs p-2.5 rounded-lg border border-[#CDBEA3] dark:border-[#32519E] bg-[#FBF7F0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9] font-bold"
                          />
                          <input
                            type="tel"
                            value={apptFormPhone}
                            onChange={(e) => setApptFormPhone(e.target.value)}
                            placeholder="هاتف العميل"
                            className="w-full text-xs p-2.5 rounded-lg border border-[#CDBEA3] dark:border-[#32519E] bg-[#FBF7F0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9] font-bold font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-0.5">
                              التاريخ
                            </label>
                            <input
                              type="date"
                              value={apptFormDate}
                              onChange={(e) => setApptFormDate(e.target.value)}
                              required
                              className="w-full text-xs p-2 rounded-lg border border-[#CDBEA3] dark:border-[#32519E] bg-[#FBF7F0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9] font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#475569] dark:text-[#94A3B8] block mb-0.5">
                              الساعة
                            </label>
                            <input
                              type="time"
                              value={apptFormTime}
                              onChange={(e) => setApptFormTime(e.target.value)}
                              className="w-full text-xs p-2 rounded-lg border border-[#CDBEA3] dark:border-[#32519E] bg-[#FBF7F0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9] font-mono"
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          value={apptFormNotes}
                          onChange={(e) => setApptFormNotes(e.target.value)}
                          placeholder="ملاحظات التسليم (مثال: تغليف هدايا)"
                          className="w-full text-xs p-2.5 rounded-lg border border-[#CDBEA3] dark:border-[#32519E] bg-[#FBF7F0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9]"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsNewApptFormOpen(false)}
                          className="px-3 py-1.5 rounded-lg border border-[#CDBEA3] dark:border-[#32519E] text-[#475569] dark:text-[#CBD5E1] text-xs font-bold cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] text-white text-xs font-black shadow-xs cursor-pointer active:scale-95"
                        >
                          حفظ الموعد
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2.5">
                    {visibleAppointments.length === 0 ? (
                      <div className="text-center py-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        لا توجد مواعيد تسليم ظاهرة حالياً. اضغط "موعد جديد" لتسجيل موعد تسليم للعميل.
                      </div>
                    ) : (
                      visibleAppointments.map((appt) => {
                        const isDone =
                          appt.status === 'completed' || taskMemory.readIds.includes(appt.id);
                        const gcalUrl = createGoogleCalendarUrl({
                          title: appt.title,
                          date: appt.date,
                          time: appt.time,
                          notes: appt.notes,
                          clientName: appt.clientName,
                          clientPhone: appt.clientPhone,
                          brandName: profile.brandName,
                        });

                        return (
                          <div
                            key={appt.id}
                            className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                              isDone
                                ? 'bg-[#EFE6D7]/50 dark:bg-[#0C1D47]/50 border-emerald-500/35 opacity-75'
                                : 'bg-[#F4ECE0] dark:bg-[#102350] border-[#D5C7B0] dark:border-[#243C78] shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  openScreen(
                                    appt.orderNumber
                                      ? isSupplierAccount
                                        ? 'supplier_orders'
                                        : 'my_orders'
                                      : appt.clientName
                                      ? isSupplierAccount
                                        ? 'supplier_customers'
                                        : 'customers'
                                      : 'work_orders'
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    openScreen(appt.orderNumber ? 'my_orders' : 'customers');
                                  }
                                }}
                                title="اضغط للانتقال مباشرة للأوردر أو صفحة العميل"
                                className="min-w-0 flex-1 cursor-pointer group"
                              >
                                <h4
                                  className={`text-xs sm:text-sm font-black group-hover:underline ${
                                    isDone
                                      ? 'line-through text-[#64748B]'
                                      : 'text-[#1C2434] dark:text-[#F1F5F9]'
                                  }`}
                                >
                                  {appt.title}
                                </h4>
                                {appt.clientName && (
                                  <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] flex items-center gap-1 mt-0.5">
                                    <User className="w-3 h-3 opacity-70" />
                                    <span>{appt.clientName}</span>
                                    {appt.clientPhone && (
                                      <span className="font-mono opacity-80 mr-1">({appt.clientPhone})</span>
                                    )}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="text-left ml-1">
                                  <span className="text-[11px] font-mono font-black text-[#142A5C] dark:text-[#93C5FD] block">
                                    {appt.date}
                                  </span>
                                  {appt.time && (
                                    <span className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] block">
                                      {appt.time}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAskShamousaAboutItem({
                                      id: appt.id,
                                      source: 'appointment',
                                      category: 'crm_retarget',
                                      title: appt.title,
                                      detail: `موعد تسليم بتاريخ ${appt.date}${appt.time ? ` الساعة ${appt.time}` : ''}${appt.clientName ? ` للعميل ${appt.clientName}` : ''}${appt.notes ? ` — ملاحظات: ${appt.notes}` : ''}`,
                                      targetView: appt.orderNumber ? 'my_orders' : 'customers',
                                      actionLabel: appt.orderNumber ? 'فتح الأوردر' : 'فتح صفحة العميل',
                                    });
                                  }}
                                  title="اسأل شموسة عن الموعد ده"
                                  aria-label="اسأل شموسة عن الموعد"
                                  className="w-7 h-7 rounded-lg bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#DCE4F0] dark:hover:bg-white text-white dark:text-[#091533] flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer"
                                >
                                  <HelpCircle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleAppointment(appt.id);
                                  }}
                                  title={isDone ? 'تم التسليم والقراءة' : 'تأكيد التسليم والقراءة (✓✓)'}
                                  aria-label="تأكيد التسليم"
                                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition active:scale-90 cursor-pointer ${
                                    isDone
                                      ? 'bg-emerald-600 border-emerald-500 text-white'
                                      : 'bg-[#FBF7F0] dark:bg-[#091533] border-[#C4B395] dark:border-[#35539E] text-[#475569] dark:text-[#CBD5E1] hover:text-emerald-600'
                                  }`}
                                >
                                  <CheckCheck className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismissSingleTaskOrAppt(appt.id);
                                  }}
                                  title="عرفت خلاص — إزالة"
                                  aria-label="إزالة الموعد"
                                  className="w-7 h-7 rounded-lg bg-[#FBF7F0] dark:bg-[#091533] border border-[#C4B395] dark:border-[#35539E] text-[#64748B] hover:text-rose-600 hover:border-rose-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {appt.notes && (
                              <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] bg-[#FBF7F0] dark:bg-[#091533]/60 p-2 rounded-lg border border-[#E3D8C5] dark:border-[#1E356B]">
                                {appt.notes}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[#E3D8C5] dark:border-[#1E356B]">
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={gcalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-[#EAE0CE] dark:bg-[#17306B] text-[#142A5C] dark:text-[#DBEAFE] border border-[#CDBEA3] dark:border-[#31509B] hover:brightness-95 transition cursor-pointer"
                                  title="حفظ الموعد في تقويم جوجل"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>تقويم جوجل 📅</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadIcsFile({
                                      id: appt.id,
                                      title: appt.title,
                                      date: appt.date,
                                      time: appt.time,
                                      notes: appt.notes,
                                      clientName: appt.clientName,
                                      brandName: profile.brandName,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#FBF7F0] dark:bg-[#0C1D47] text-[#334155] dark:text-[#CBD5E1] border border-[#D5C7B0] dark:border-[#243C78] hover:border-[#142A5C] transition cursor-pointer"
                                  title="تحميل ملف التقويم للأجهزة والهواتف (.ics)"
                                >
                                  <Download className="w-3 h-3 opacity-70" />
                                  <span>ملف .ics</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleAppointment(appt.id)}
                                className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition cursor-pointer active:scale-95 ${
                                  isDone
                                    ? 'bg-[#DFD2BA] dark:bg-[#152B62] text-[#475569] dark:text-[#94A3B8]'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                }`}
                              >
                                {isDone ? 'تم التسليم ✓✓' : 'تأكيد التسليم'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

const Bubble: React.FC<{ role: 'user' | 'assistant'; children: React.ReactNode }> = ({
  role,
  children,
}) => (
  <div className={`flex items-end gap-2.5 ${role === 'user' ? 'justify-start' : 'justify-end'}`}>
    {role === 'assistant' && (
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border-2 border-[#D4C3A3] dark:border-[#395AA8] bg-[#FBF7F0] dark:bg-[#132960] shadow-[0_0_12px_rgba(251,191,36,0.3)] flex items-center justify-center p-0.5">
        <ShamousaMascotAvatar size="xs" statusDot={false} className="w-full h-full" />
      </div>
    )}
    <div
      className={`max-w-[86%] sm:max-w-[78%] whitespace-pre-wrap break-words text-sm leading-relaxed px-4 py-3 rounded-2xl shadow-2xs ${
        role === 'user'
          ? 'bg-[#142A5C] dark:bg-[#1E3F8A] text-white rounded-br-xs'
          : 'bg-[#FBF7F0] dark:bg-[#102350] text-[#1C2434] dark:text-[#F1F5F9] border border-[#D5C7B0] dark:border-[#243C78] rounded-bl-xs'
      }`}
    >
      {children}
    </div>
  </div>
);

export default ShamousaChatWidget;