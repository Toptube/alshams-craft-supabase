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
} from 'lucide-react';
import { AlShamsSunIcon, shamousaSearchIconImg, ShamousaMascotAvatar, ShamousaMascotFull } from '../brand/BrandAssets';
import { authedFetch } from '../../lib/apiClient';
import type { UserProfile } from '../../types';
import { DraggableShamosa } from './DraggableShamosa';
import { tenantStorage } from '../../db/dexieDB';
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

  const welcomeMessage = isSupplierAccount
    ? isCraftMode
      ? `أهلاً بيك يا **${firstName}**! ☀️ نوّرت بوابة الموردين (**الوضع الحرفي البسيط**).\nأنا **شموسة** — هكلّمك بلغة المحل السهلة من غير تعقيد دائن ومدين، وهتابع معاك الفلوس والمخازن والبيع فوراً. ولو حابب أدوّرلك في السوق أونلاين اضغط على **صورتي جنب خانة الكتابة عشان تنوّر أخضر 🟢**.`
      : `أهلاً بيك يا **${firstName}**! ☀️ نوّرت بوابة الموردين (**الوضع المحاسبي المتقدم**).\nأنا **شموسة** — جاهزة معاك بكل التفاصيل الرسمية: **${getModeLabel('sup_finance_title')}**، دفتر الأستاذ، تسويات الفروع، وتقييم المخزون. ولو حابب تفتحلي البحث المباشر على الإنترنت اضغط على **صورتي جنب خانة الكتابة 🟢**.`
    : isCraftMode
    ? `أهلاً بيك يا **${firstName}**! ☀️ نوّرت الشمساوية (**الوضع الحرفي البسيط**).\nأنا **شموسة** — هكلمك بلغة الورشة السهلة من غير كلام المحاسبين المعقّد، وهساعدك في التسعير، **${getModeLabel('wo_page_title')}**، بواقي الخامات، و**${getModeLabel('rep_page_title')}**. وللبحث المباشر على الإنترنت اضغط على **صورتي جنب خانة الكتابة 🟢**.`
    : `أهلاً بيك يا **${firstName}**! ☀️ نوّرت الشمساوية (**الوضع المحاسبي المتقدم**).\nأنا **شموسة** — جاهزة معاك بكل المسميات والأذونات المحاسبية الكاملة (**${getModeLabel('wo_issue_voucher')}**، **${getModeLabel('rep_trial_balance')}**، المدين والدائن، والرسوم المتقدمة). وللبحث المباشر على الإنترنت اضغط على **صورتي جنب خانة الكتابة 🟢**.`;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'daily' | 'tasks_agenda' | 'results' | 'or360'>('chat');
  const conversationStateRef = useRef<ShamousaConversationState>({});
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

  const snoozeStorageKey = `shamousa_snooze_until_${workshopId}`;
  const dailyDoneStorageKey = `shamousa_daily_done_${workshopId}`;
  const dailyRemindedStorageKey = `shamousa_daily_reminded_${workshopId}`;

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

  const triggerShamousaAttention = (followupText: string) => {
    playShamousaReminderChime();
    if (isOpenRef.current) {
      setActiveTab('daily');
      setInjectedDailyFollowup({ id: `fu_${Date.now()}`, text: followupText });
      return;
    }
    pendingFollowupAfterOrbitRef.current = followupText;
    setIsGlowingAlert(true);
    setOrbitTriggerNonce((n) => n + 1);
  };

  const handleOrbitComplete = () => {
    setIsGlowingAlert(false);
    const pendingMsg = pendingFollowupAfterOrbitRef.current;
    pendingFollowupAfterOrbitRef.current = null;
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
      setOrbitTriggerNonce((n) => n + 1);
    }, 260);
  };

  // المجدول الذكي الخلفي: يتابع ميعاد الـ 8 مساءً اليومي + أي تأجيل ("استني ساعة")
  useEffect(() => {
    if (!workshopId) return;
    const checkReminders = () => {
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

      // 2) فحص ميعاد الطمأنة اليومي (الافتراضي 20:00 — 8 مساءً)
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

    const initialTimer = window.setTimeout(checkReminders, 4500);
    const intervalId = window.setInterval(checkReminders, 15000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
    };
  }, [
    workshopId,
    dailyCheckinTime,
    aiCfg.shamousaDailyDefaultTime,
    aiCfg.shamousaSnoozeFollowupText,
    firstName,
    isSupplierAccount,
    snoozeStorageKey,
    dailyDoneStorageKey,
    dailyRemindedStorageKey,
  ]);

  // الاستماع لحدث فتح شموسة من أي مكان في المنظومة
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Modern Chat UX additions: Auto-expanding, Voice, Attachments
  const [pendingAttachment, setPendingAttachment] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);

  const adjustTextareaHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 44), 140) + 'px';
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setVoiceNotice('المتصفح لا يدعم التسجيل الصوتي المباشر.');
        setTimeout(() => setVoiceNotice(null), 3000);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingVoice(false);

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        setIsTranscribingVoice(true);
        setVoiceNotice('⏳ جاري تفريغ الصوت وتحويله لكلام مكتوب...');

        const reader = new FileReader();
        reader.onload = async (event) => {
          const rawBase64 = event.target?.result as string;
          try {
            const res = await authedFetch('/api/ai/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: rawBase64, mimeType }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text && data.text.trim()) {
                setInput((prev) => {
                  const cleanPrev = prev.trim();
                  const newText = data.text.trim();
                  const merged = cleanPrev ? `${cleanPrev} ${newText}` : newText;
                  setTimeout(() => adjustTextareaHeight(inputRef.current), 50);
                  return merged;
                });
                setVoiceNotice('✓ تم تفريغ الصوت بنجاح');
                setTimeout(() => setVoiceNotice(null), 2000);
              } else {
                setVoiceNotice(null);
              }
            } else {
              setVoiceNotice(null);
            }
          } catch (err) {
            console.warn('Transcription error:', err);
            setVoiceNotice(null);
          } finally {
            setIsTranscribingVoice(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecordingVoice(true);
      setVoiceNotice('🔴 جاري التسجيل الصوتي... تحدث بحرية ثم انقر على الميكروفون للإيقاف والتفريغ');
    } catch (err: any) {
      console.warn('Microphone error in Shamousa:', err);
      setIsRecordingVoice(false);
      setVoiceNotice('يرجى السماح بالوصول للميكروفون للتسجيل.');
      setTimeout(() => setVoiceNotice(null), 3000);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecordingVoice(false);
  };

  const toggleVoiceRecording = () => {
    if (isRecordingVoice) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

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

  // Load real workshop data to generate smart daily tasks
  const loadDailyTasks = async () => {
    if (!workshopId) return;
    try {
      const tasks: ShamousaDailyTask[] = [];

      // 1. Raw materials low stock
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
          actionLabel: 'طلب توريد خامات 🚚',
          view: 'suppliers',
        });
      });

      // 2. Open work orders
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

      // Routine task
      if (tasks.length === 0) {
        tasks.push({
          id: 'task_routine_check',
          title: 'مطابقة حركة الخزائن وجرد اليوم',
          detail: 'تأكد من تسجيل فواتير اليوم ومطابقة رصيد النقدية في الخزينة الرئيسية لضمان دقة الأرباح.',
          urgency: 'normal',
          actionLabel: 'فتح الخزائن 💰',
          view: 'treasuries',
        });
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
  }, [workshopId, agendaStorageKey]);

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

    checkStoreOrdersDelivery();
    checkLowMaterialsStock();
  }, [profile.tenantId, profile.workshopId, profile.id]);

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

    // Level 1 & Level 2 Guided Menus (توضيح بدون إحراج + اختيارات بأزرار واضحة)
    if (intentKey === 'root_ambiguous') {
      return {
        content: `حاضر يا **${firstName}** ☀️ تقصد إيه بالظبط من دول عشان أجيب لك الأرقام المظبوطة؟ اختار من الأزرار دي:`,
        disambiguationChoices: [
          { id: 'c_wh_menu', label: 'ملخص المخزن 📦', intentKey: 'wh_menu' },
          { id: 'c_tr_menu', label: 'ملخص الخزنة والفلوس 💰', intentKey: 'tr_menu' },
          { id: 'c_full', label: 'الخلاصة كلها في (هلخصهالك) 📋', intentKey: 'full_brief' },
        ],
      };
    }

    if (intentKey === 'wh_menu') {
      return {
        content: `من عيوني يا **${firstName}** 📦 تحب أراجع لك أي مخزن فيهم؟`,
        disambiguationChoices: [
          { id: 'c_wh_mat', label: 'مخزن الخامات 🧶', intentKey: 'wh_materials' },
          { id: 'c_wh_prod', label: 'مخزن المنتجات النهائية 🛍️', intentKey: 'wh_products' },
          { id: 'c_wh_full', label: 'الاثنين في هلخصهالك 📋', intentKey: 'full_brief' },
        ],
      };
    }

    if (intentKey === 'tr_menu') {
      return {
        content: `أهلاً بيك يا **${firstName}** 💰 عاوز تعرف إيه بالظبط في الفلوس والحسابات؟`,
        disambiguationChoices: [
          { id: 'c_tr_cash', label: 'معانا كام وفين (السيولة) 💵', intentKey: 'tr_cash' },
          { id: 'c_tr_rec', label: 'لينا كام بره وعند مين 📥', intentKey: 'tr_receivables' },
          { id: 'c_tr_pay', label: 'علينا كام ولمين (للموردين) 📤', intentKey: 'tr_payables' },
          { id: 'c_tr_full', label: 'الموقف المالي كله 📋', intentKey: 'full_brief' },
        ],
      };
    }

    if (intentKey === 'sup_root_ambiguous') {
      return {
        content: `تحت أمرك يا **${firstName}** ☀️ تقصد تراجع إيه في فروع المورد دلوقتي؟`,
        disambiguationChoices: [
          { id: 'c_sup_tr', label: 'ملخص خزائن الفروع والكاشير 💰', intentKey: 'sup_tr_menu' },
          { id: 'c_sup_wh', label: 'ملخص مخزون الفروع وكارت الصنف 🏭', intentKey: 'sup_stock' },
          { id: 'c_sup_full', label: 'الخلاصة كلها في (هلخصهالك للموردين) 📋', intentKey: 'sup_full_brief' },
        ],
      };
    }

    if (intentKey === 'sup_tr_menu') {
      return {
        content: `اختار التفاصيل المالية اللي تحب تراجعها يا **${firstName}** 💰:`,
        disambiguationChoices: [
          { id: 'c_sup_cash', label: 'معانا كام في الفروع والمالك 💵', intentKey: 'sup_cash' },
          { id: 'c_sup_rec', label: 'لينا كام عند الورش والعملاء 📥', intentKey: 'sup_receivables' },
          { id: 'c_sup_pay', label: 'علينا كام للمصانع 📤', intentKey: 'sup_payables' },
          { id: 'c_sup_tr_full', label: 'الخلاصة كلها في هلخصهالك 📋', intentKey: 'sup_full_brief' },
        ],
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
      await send(queryForAI, { forceAI: true });
      return;
    }
    if (opt.queryText) {
      await send(opt.queryText);
    }
  };

  const send = async (
    text: string,
    sendOptions?: { forceAI?: boolean; explainPayload?: ShamousaExplainPayload }
  ) => {
    if (isRecordingVoice) {
      stopVoiceRecording();
    }
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

    // 0. فحص هل السؤال ملتبس/عام أو طلب مباشر لفرع من "هلخصهالك" (بدون صور مرفقة أو طلب AI صريح)
    const preIntent =
      !currentAttachment && !sendOptions?.forceAI
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

    // فحص طلبات التأجيل ("استني ساعة" / "كلميني الساعة 10") حتى داخل المحادثة الرئيسية
    if (!currentAttachment && message) {
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

    if (preIntent) {
      try {
        const directReply = await resolveDisambiguationIntent(preIntent);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            isLocalChatbot: true,
            ...directReply,
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
        });
        if (localRes.nextState) {
          conversationStateRef.current = localRes.nextState;
        }
        if (localRes.isUnanswered && message.trim().length >= 2) {
          authedFetch('/api/shamousa/unanswered', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: message.trim(),
              accountRole: isSupplierAccount ? 'supplier' : 'artisan',
            }),
          }).catch(() => {});
        }
        if (localRes.handled && localRes.reply) {
          const replyChips = detectKeywordActionChips(message, isSupplierAccount, experienceMode).filter(
            (c) => !localRes.actionLink || c.view !== localRes.actionLink.view
          );
          setMessages((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              isLocalChatbot: true,
              content: localRes.reply,
              actionLink: localRes.actionLink,
              actionChips: replyChips.length > 0 ? replyChips : undefined,
              chatbotOptions: localRes.options,
              handoffToFalcon: localRes.handoffToFalcon,
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

      // جمع سياق الورشة الفعلي المباشر: الخامات الناقصة، أوامر التشغيل، الطلبيات، وملخص هلخصهالك
      let lowMaterialsList: string[] = [];
      let openWorkOrdersList: string[] = [];
      let pendingOrdersCount = 0;
      let supplierErpOverviewData: any = null;
      let executiveBriefPayload: any = null;

      try {
        if (isSupplierAccount) {
          supplierErpOverviewData = await fetchSupplierErpOverview().catch(() => null);
          if (supplierErpOverviewData?.kpis) {
            currentTreasury = Number(supplierErpOverviewData.kpis.totalCashOnHand ?? currentTreasury);
          }
        } else {
          const [mats, wOrders, ords, fullBrief] = await Promise.all([
            tenantStorage.getRawMaterials(workshopId).catch(() => []),
            tenantStorage.getWorkOrders(workshopId).catch(() => []),
            tenantStorage.getOrders(workshopId).catch(() => []),
            buildArtisanExecutiveBrief(workshopId, profile.currencySymbol || 'ج.م').catch(() => null),
          ]);

          if (fullBrief) {
            executiveBriefPayload = {
              cashTotal: fullBrief.financial.liquidity.cashTotal,
              instapayBankTotal: fullBrief.financial.liquidity.instapayBankTotal,
              walletsCustodyTotal: fullBrief.financial.liquidity.walletsCustodyTotal,
              receivablesTotal: fullBrief.financial.receivablesTotal,
              debtors: fullBrief.financial.debtors.slice(0, 8),
              payablesTotal: fullBrief.financial.payablesTotal,
              creditors: fullBrief.financial.creditors.slice(0, 8),
              netWorkingPosition: fullBrief.financial.netWorkingPosition,
              materialsTotalValue: fullBrief.warehouse.materialsTotalValue,
              materialsCount: fullBrief.warehouse.materialsCount,
              fastMovingMaterials: fullBrief.warehouse.fastMovingMaterials,
              slowMovingMaterials: fullBrief.warehouse.slowMovingMaterials,
              productsCount: fullBrief.warehouse.productsCount,
              productsCostValue: fullBrief.warehouse.productsCostValue,
              productsRetailValue: fullBrief.warehouse.productsRetailValue,
              bestSellingProducts: fullBrief.warehouse.bestSellingProducts,
              slowestProducts: fullBrief.warehouse.slowestProducts,
            };
          }

          const lowMats = (mats || []).filter(
            (m) => (Number(m.currentStock) || 0) <= (Number(m.minAlertThreshold) || 5)
          );
          lowMaterialsList = lowMats.map(
            (m) => `${m.materialName} (الرصيد: ${m.currentStock} ${m.unit || 'وحدة'} - حد الأمان: ${m.minAlertThreshold || 5})`
          );

          const openOrders = (wOrders || []).filter(
            (w) => w.status === 'open' || w.status === 'in_progress'
          );
          openWorkOrdersList = openOrders.map(
            (w) => `#${w.orderNumber}: "${w.productName}" (${w.status === 'in_progress' ? 'قيد التصنيع' : 'بانتظار الصرف'} - الصانع: ${w.assignedEmployeeName || 'حرفي'})`
          );

          pendingOrdersCount = (ords || []).filter(
            (o) => o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled'
          ).length;
        }
      } catch (ctxErr) {
        console.warn('Live context fetch warning:', ctxErr);
      }

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
          useSearch: useGoogleSearch,
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
            shamousaOrLearningContext: buildShamousaMemoryPromptContext(workshopId),
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
            treasuryBalance: currentTreasury,
            treasuriesDetail: treasuriesList,
            lowMaterialsCount: lowMaterialsList.length,
            lowMaterialsList,
            openWorkOrdersCount: openWorkOrdersList.length,
            openWorkOrdersList,
            pendingOrdersCount,
            ...(executiveBriefPayload ? { executiveBrief: executiveBriefPayload } : {}),
            ...(supplierErpOverviewData ? { supplierErpOverview: supplierErpOverviewData } : {}),
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'حصل خطأ في الاتصال، حاولي تاني.');

      if (typeof data.remaining === 'number') setRemaining(data.remaining);

      const isInternalData = /هلخصهالك|خزن|خزينة|خزينه|سيول|سيولة|رصيد|عهدة|عهده|فلوس|خامات|مخزن|أوردر|اوردر|طلب|مبيعات|عميل|عملاء|مورد|موردين|موظف|عمال|دفاتر|حسابات|صفحتي|عيلة|شرائح/i.test(message + ' ' + (data.reply || ''));
      const isFalconExplicitlyRequested = /صقر|تحليل صوره|تحليل صورة|حلل الصورة|دراسة سوق|دراسة السوق|المنافسين/i.test(message);
      const shouldHandoff = !isInternalData && (Boolean(data.handoffToFalcon) || isFalconExplicitlyRequested);

      const dynamicLink = data.actionLink || detectNavigationIntent(message, isSupplierAccount);
      const replyChips = detectKeywordActionChips(message, isSupplierAccount, experienceMode).filter(
        (c) => !dynamicLink || c.view !== dynamicLink.view
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

  return (
    <>
      {/* Floating compact launcher mascot — ONLY ONE Shamousa on screen */}
      {!isOpen && (
        <DraggableShamosa
          onClick={() => {
            playButtonClickSound();
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
              <span className="absolute top-0.5 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#091533] shadow-sm z-10" />

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
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#EAE0CE] dark:border-[#0C1D47]" />
            </button>

            {/* 3 Raised 3D Buttons: مهام / نتائج / بحوث */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-1 min-w-0">
              {renderRaisedSilverBtn('tasks_agenda', aiCfg.shamousaBtnTasks, totalPendingBadge)}
              {renderRaisedSilverBtn('results', aiCfg.shamousaBtnResults)}
              {renderRaisedSilverBtn('or360', aiCfg.shamousaBtnOR)}
            </div>

            {/* Clean Close Button */}
            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setIsOpen(false);
              }}
              aria-label="إغلاق"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FBF7F0] dark:bg-[#132960] hover:bg-[#E1D4BE] dark:hover:bg-[#1B377D] border border-[#D5C7B0] dark:border-[#2C488D] text-[#1C2434] dark:text-[#E2E8F0] flex items-center justify-center shrink-0 transition cursor-pointer active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
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
                      {(isSupplierAccount
                        ? isCraftMode
                          ? [
                              { id: 'w_sb', label: `${getModeLabel('sup_exec_brief_card')} 💰`, intentKey: 'sup_full_brief' },
                              { id: 'w_sfin', label: `${getModeLabel('sup_finance_title')} 🏦`, view: 'supplier_finance' },
                              { id: 'w_smode', label: 'الوضع الحرفي والمحاسبي ⚖️', queryText: 'الوضع الحرفي والوضع المحاسبي' },
                              { id: 'w_sum', label: 'الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' },
                            ]
                          : [
                              { id: 'w_sb', label: `${getModeLabel('sup_exec_brief_card')} 💰`, intentKey: 'sup_full_brief' },
                              { id: 'w_sfin', label: `${getModeLabel('sup_finance_title')} 📊`, view: 'supplier_finance' },
                              { id: 'w_swh', label: `${getModeLabel('sup_warehouse_card')} 🏭`, view: 'supplier_warehouse_erp' },
                              { id: 'w_sdc', label: 'شرح المدين والدائن 📘', queryText: 'يعني ايه دائن ومدين' },
                            ]
                        : isCraftMode
                        ? [
                            { id: 'w_ab', label: 'هلخصهالك (الفلوس والمخزن) 💰', intentKey: 'full_brief' },
                            { id: 'w_left', label: 'إرجاع بواقي الخامات 🧶', queryText: 'بواقي الخامات بعد أمر التشغيل' },
                            { id: 'w_rep', label: `${getModeLabel('rep_page_title')} 📊`, view: 'reports' },
                            { id: 'w_mode', label: 'الفرق بين الوضعين ⚖️', queryText: 'الوضع الحرفي والوضع المحاسبي' },
                          ]
                        : [
                            { id: 'w_ab', label: 'هلخصهالك (الفلوس والمخزن) 💰', intentKey: 'full_brief' },
                            { id: 'w_wo', label: `${getModeLabel('wo_page_title')} 📋`, view: 'work_orders' },
                            { id: 'w_rep', label: `${getModeLabel('rep_trial_balance')} ⚖️`, view: 'reports' },
                            { id: 'w_vch', label: 'دليل الأذونات والقيود 📘', queryText: 'وظيفة الأذونات' },
                          ]
                      ).map((wOpt) => (
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
                        {(m.searchUsed || (m.sources && m.sources.length > 0)) && (
                          <div className="mt-2 pt-2 border-t border-[#E3D8C5] dark:border-[#243C78] space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                              <Globe className="w-3 h-3" />
                              <span>مدعوم ببحث جوجل الحي</span>
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

              {/* شريط حالة التسجيل الصوتي والتفريغ */}
              {(isRecordingVoice || isTranscribingVoice || voiceNotice) && (
                <div
                  className={`px-4 py-1.5 border-t flex items-center justify-between text-xs shrink-0 transition-all ${
                    isRecordingVoice
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 animate-pulse'
                      : isTranscribingVoice
                      ? 'bg-[#EAE0CE] dark:bg-[#152B62] border-[#CDBEA3] dark:border-[#31509B] text-[#142A5C] dark:text-[#E2E8F0]'
                      : 'bg-[#EAE0CE] dark:bg-[#0F204D] border-[#D5C7B0] dark:border-[#243C78] text-[#1C2434] dark:text-[#CBD5E1]'
                  }`}
                >
                  <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isRecordingVoice && <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />}
                      <span className="font-bold">
                        {voiceNotice ||
                          (isRecordingVoice ? 'شموسة تسجل صوتك.. اضغط الميكروفون للإيقاف' : '')}
                      </span>
                    </div>
                    {isRecordingVoice && (
                      <button
                        type="button"
                        onClick={stopVoiceRecording}
                        className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-rose-600 text-white cursor-pointer hover:bg-rose-700"
                      >
                        إيقاف وتفريغ
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Input Form — Comfortable, Unclipped, Royal Blue / Sandy Beige */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="px-3 sm:px-5 py-2.5 sm:py-3 border-t border-[#D5C7B0] dark:border-[#223B78] bg-[#EAE0CE] dark:bg-[#0C1D47] shrink-0"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf"
                  onChange={handleAttachmentSelected}
                  className="hidden"
                />

                <div className="max-w-3xl mx-auto flex items-end gap-1.5 sm:gap-2">
                  {/* زر المرفقات */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="إرفاق فاتورة أو صورة"
                    className="w-10 h-10 rounded-xl bg-[#FBF7F0] dark:bg-[#122657] border border-[#D5C7B0] dark:border-[#2A468B] text-[#475569] dark:text-[#CBD5E1] hover:text-[#142A5C] dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                  >
                    <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* زر التسجيل الصوتي */}
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    title={isRecordingVoice ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                      isRecordingVoice
                        ? 'bg-rose-600 border-rose-500 text-white shadow-md animate-pulse'
                        : isTranscribingVoice
                        ? 'bg-[#142A5C] border-[#2C4B94] text-white animate-spin'
                        : 'bg-[#FBF7F0] dark:bg-[#122657] border-[#D5C7B0] dark:border-[#2A468B] text-[#475569] dark:text-[#CBD5E1] hover:text-[#142A5C] dark:hover:text-white'
                    }`}
                  >
                    {isRecordingVoice ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>

                  {/* زر بحث جوجل الحي بأيقونة شموسة */}
                  <button
                    type="button"
                    onClick={() => setUseGoogleSearch((v) => !v)}
                    title={useGoogleSearch ? 'بحث جوجل الحي مُفعّل' : 'تفعيل بحث جوجل الحي'}
                    aria-pressed={useGoogleSearch}
                    className={`w-10 h-10 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                      useGoogleSearch
                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_14px_rgba(16,185,129,0.65)]'
                        : 'bg-[#FBF7F0] dark:bg-[#122657] border-[#D5C7B0] dark:border-[#2A468B] hover:border-[#142A5C]'
                    }`}
                  >
                    <img
                      src={shamousaSearchIconImg}
                      alt="بحث شموسة"
                      draggable={false}
                      className="w-6 h-6 sm:w-7 sm:h-7 object-contain select-none pointer-events-none"
                    />
                  </button>

                  {/* مربع النص المتمدد بدون قص للنص أو Placeholder */}
                  <div className="flex-1 min-w-0">
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
                          send(input);
                        }
                      }}
                      rows={1}
                      maxLength={1000}
                      placeholder={
                        useGoogleSearch
                          ? 'البحث الحي شغّال 🟢 اسأل عن أي أسعار أو موردين...'
                          : aiCfg.shamousaChatPlaceholder
                      }
                      className="w-full min-h-[42px] resize-none max-h-36 overflow-y-auto px-3.5 py-2.5 rounded-xl border border-[#CDBEA3] dark:border-[#2E4C94] bg-[#FBF7F0] dark:bg-[#091533] text-[#1C2434] dark:text-[#F1F5F9] placeholder:text-[#64748B] dark:placeholder:text-[#94A3B8] text-sm outline-none focus:ring-2 focus:ring-[#1E3F8A] dark:focus:ring-[#60A5FA] leading-normal block"
                    />
                  </div>

                  {/* زر الإرسال */}
                  <button
                    type="submit"
                    disabled={(!input.trim() && !pendingAttachment) || isLoading}
                    aria-label="إرسال"
                    title="إرسال (Ctrl+Enter)"
                    className="w-10 h-10 shrink-0 rounded-xl bg-[#142A5C] hover:bg-[#1E3F8A] dark:bg-[#24489C] dark:hover:bg-[#2F59BD] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-md active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                  </button>
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