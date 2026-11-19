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
import { resolveShamousaLocalChatbot, ShamousaChatbotOption } from '../../services/shamousaLocalChatbot';

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
export function detectKeywordActionChips(userQuery: string, isSupplier = false): SmartActionChip[] {
  const chips: SmartActionChip[] = [];
  const lower = userQuery.toLowerCase();

  // 0. هلخصهالك والملخص للورش والموردين
  if (!isSupplier && /هلخصهالك|ملخص|تلخيص|لخص|معانا كام|لينا بره|علينا كام|موقف مالي/i.test(lower)) {
    chips.push({ id: 'chip_exec_brief', label: 'فتح بطاقة هلخصهالك 📋', view: 'executive_brief' });
  }
  if (isSupplier && /هلخصهالك|ملخص|تلخيص|لخص|معانا كام|لينا بره|علينا كام|موقف مالي/i.test(lower)) {
    chips.push({ id: 'chip_sup_exec_brief', label: 'هلخصهالك للموردين 📋', view: 'supplier_executive_brief' });
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
    chips.push({ id: 'chip_sup_erp_hub', label: 'مركز قيادة الفروع والخزينة 🌿', view: 'supplier_erp_hub' });
  }
  if (isSupplier && /كاشير|pos|نقطة بيع|وردية|شفت|انستاباي|إنستاباي|محفظة|بيع مباشر|كسر|وزن/i.test(lower)) {
    chips.push({ id: 'chip_sup_pos', label: 'كاشير نقاط البيع (POS) 🛒', view: 'supplier_pos' });
  }
  if (isSupplier && /كارت الصنف|مصنع|مصانع|علينا كام|طرد|تحويل|جرد/i.test(lower)) {
    chips.push({ id: 'chip_sup_wh', label: 'المخازن وكارت الصنف والمصانع 🏭', view: 'supplier_warehouse_erp' });
  }
  if (isSupplier && /تثبيت|kiosk|جهاز|موظف|حضور|انصراف|سلف|جزاء|حافز|باسورد|pin/i.test(lower)) {
    chips.push({ id: 'chip_sup_hr', label: 'شؤون العاملين وتثبيت الأجهزة 🖥️', view: 'supplier_hr_terminal' });
  }

  // 3. الخزينة / الفلوس / السيولة / الكاش / المصروف
  if (!isSupplier && /خزن|خزنة|خزينة|سيول|سيولة|كاش|انستاباي|إنستاباي|محفظة|نقدية|معانا كام/i.test(lower)) {
    chips.push({ id: 'chip_treasuries', label: 'فتح الخزائن والأرصدة 💰', view: 'treasuries' });
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

  // 8. أوامر التشغيل / التصنيع / الصنايعية
  if (!isSupplier && /تشغيل|أمر تشغيل|تصنيع|صنايعي|حرفي|عمال|أجور/i.test(lower)) {
    chips.push({ id: 'chip_wo', label: 'سجل أوامر التشغيل 🔨', view: 'work_orders' });
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
      <strong key={i} className="font-extrabold text-amber-950 dark:text-amber-200">
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
  liftUp = false,
  isAnyModalOpen = false,
}) => {
  const workshopId = profile.tenantId || profile.workshopId || profile.id || '';
  const storageKey = `shamousa_chat_${workshopId}`;
  const agendaStorageKey = `alshams_agenda_${workshopId || 'default'}`;
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tasksDoneStorageKey = `alshams_shamousa_tasks_done_${workshopId}_${todayDateStr}`;

  const isSupplierAccount = profile?.accountRole === 'supplier';
  const firstName = extractUserFirstName((profile as any).fullName || (profile as any).name || profile.artistName || (profile as any).artisanName) || 'صديقي';
  const brandTitle = profile.brandName
    ? `${isSupplierAccount ? 'متجر' : 'ورشة'} ${profile.brandName}`
    : isSupplierAccount
    ? 'بوابة الموردين'
    : 'الورشة الحرفية';

  const welcomeMessage = isSupplierAccount
    ? `أهلاً بيك يا ${firstName}! ☀️ منور بوابة الموردين..\nطمني حابب تراجع خزائن الفروع والكاشير (POS) ولا المخازن ومستحقات المصانع والعملاء؟`
    : `أهلاً بيك يا ${firstName}! ☀️ منورة ورشتنا..\nطمني حابب تتابع أوردراتك ولا تراجع الخزينة والمخزن؟`;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks_agenda'>('chat');

  // الاستماع لحدث فتح شموسة من أي مكان في المنظومة
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('alshams_open_shamousa', handleOpen);
    return () => window.removeEventListener('alshams_open_shamousa', handleOpen);
  }, []);
  
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

  // Count of pending tasks & upcoming appointments
  const pendingTasksCount = useMemo(() => {
    return dailyTasks.filter((t) => !completedTaskIds.includes(t.id)).length;
  }, [dailyTasks, completedTaskIds]);

  const upcomingApptsCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'upcoming').length;
  }, [appointments]);

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
    if (typeof window !== 'undefined') {
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
      const prevUserMsg = [...messages.slice(0, messageIdx)].reverse().find((m) => m.role === 'user');
      const queryForAI = prevUserMsg?.content || 'ساعديني في آخر استفسار';
      await send(queryForAI, { forceAI: true });
      return;
    }
    if (opt.queryText) {
      await send(opt.queryText);
    }
  };

  const send = async (text: string, sendOptions?: { forceAI?: boolean }) => {
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

    // 1. محرك الشات بوت المحلي أولاً (يعمل فوراً بدون نت أو ذكاء اصطناعي)
    if (shouldUseLocalFirst) {
      try {
        const localRes = resolveShamousaLocalChatbot(message, {
          firstName,
          isSupplier: isSupplierAccount,
        });
        if (localRes.handled && localRes.reply) {
          const replyChips = detectKeywordActionChips(message, isSupplierAccount).filter(
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
        console.warn('Local chatbot engine notice:', localErr);
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
      const replyChips = detectKeywordActionChips(message, isSupplierAccount).filter(
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
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err?.message || 'حصل خطأ، حاولي تاني.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating launcher mascot with transparent PNG silhouette */}
      {!isOpen && (
        <DraggableShamosa onClick={() => setIsOpen(true)}>
          <div
            aria-label="افتح شموسة — مديرة أعمال الورشة"
            title="شموسة — مديرة أعمال الورشة (اسحبي في أي مكان على الشاشة)"
            className={`group relative flex flex-col items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 select-none ${
              isAnyModalOpen ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 scale-100'
            }`}
          >
            {/* Mascot Image - Transparent PNG without any background container box */}
            <div className="relative w-16 h-20 sm:w-20 sm:h-24 flex items-center justify-center">
              <ShamousaMascotFull
                height="100%"
                alt="شموسة — مديرة أعمال الورشة"
                className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] select-none pointer-events-none group-hover:brightness-105 transition-all"
              />
              {/* نقطة الاتصال والنشاط الأخضر */}
              <span className="absolute top-1 right-2 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#060B18] shadow-md z-10" />

              {/* شارة رقمية (Badge) توضح عدد التوجيهات أو المواعيد المستحقة */}
              {totalPendingBadge > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-600 border-2 border-white text-white font-mono text-[11px] font-black flex items-center justify-center shadow-md animate-pulse z-20">
                  {totalPendingBadge}
                </span>
              )}
            </div>

            {/* الاسم اللطيف أسفل الشخصية مباشرة بدون حجب التفاصيل */}
            <span className="-mt-1 px-2.5 py-0.5 rounded-full bg-[#060B18]/90 text-amber-300 border border-amber-500/40 text-[10px] font-black shadow-lg backdrop-blur-xs select-none">
              شموسة
            </span>
          </div>
        </DraggableShamosa>
      )}

      {/* Main Shamousa Popup Window */}
      {isOpen && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="شموسة مديرة أعمال الورشة"
          className="fixed bottom-4 left-4 z-[60] w-[min(440px,calc(100vw-2rem))] h-[min(650px,calc(100vh-5rem))] flex flex-col rounded-3xl overflow-hidden bg-white dark:bg-stone-900 border border-amber-300 dark:border-stone-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-l from-amber-500 via-orange-500 to-amber-600 text-white flex-shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/80 bg-gradient-to-tr from-amber-400 to-orange-400 flex-shrink-0 flex items-center justify-center shadow-xs p-0.5">
                <ShamousaMascotAvatar size="md" statusDot={false} className="w-full h-full" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-extrabold text-sm leading-tight">شموسة</p>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-medium">
                    شات بوت • مديرة الأعمال
                  </span>
                </div>
                <p className="text-[11px] text-amber-50/90 flex items-center gap-1 truncate">
                  <Database className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{brandTitle} • {firstName}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {messages.length > 0 && activeTab === 'chat' && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  aria-label="مسح المحادثة"
                  title="مسح المحادثة"
                  className="p-1.5 rounded-full hover:bg-white/20 text-white/90 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق"
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs Header: شات شموسة + المهام والأجندة */}
          <div className="flex items-center border-b border-stone-200 dark:border-stone-800 bg-amber-50/50 dark:bg-stone-850 px-3 py-1.5 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setActiveTab('chat');
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 shadow-2xs border border-amber-300/80 dark:border-amber-800'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>المحادثة الذكية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playButtonClickSound();
                setActiveTab('tasks_agenda');
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 relative ${
                activeTab === 'tasks_agenda'
                  ? 'bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 shadow-2xs border border-amber-300/80 dark:border-amber-800'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>المهام والأجندة</span>
              {totalPendingBadge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold leading-none">
                  {totalPendingBadge}
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Chat View */}
          {activeTab === 'chat' && (
            <>
              {/* Messages Container */}
              <div
                ref={listRef}
                className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 bg-stone-50 dark:bg-stone-950"
              >
                <Bubble role="assistant">
                  {renderText(welcomeMessage)}
                  <div className="flex flex-wrap gap-1.5 pt-2.5 mt-2 border-t border-stone-200/70 dark:border-stone-700/60">
                    {(isSupplierAccount
                      ? [
                          { id: 'w_sb', label: 'هلخصهالك للموردين 💰', intentKey: 'sup_full_brief' },
                          { id: 'w_sum', label: 'الخامات الموحدة 🏷️', queryText: 'منظومة الخامات الموحدة' },
                          { id: 'w_scat', label: 'كتالوجي وأسعاري 📦', view: 'supplier_catalog' },
                        ]
                      : [
                          { id: 'w_ab', label: 'هلخصهالك (الفلوس والمخزن) 💰', intentKey: 'full_brief' },
                          { id: 'w_um', label: 'الخامات الموحدة (TH/BD) 🏷️', queryText: 'منظومة الخامات الموحدة' },
                          { id: 'w_cr', label: 'الورش ومعادلات التسعير 🧮', queryText: 'معادلات الورش والتسعير' },
                          { id: 'w_fl', label: 'الأرشيف والكتالوج 🛍️', queryText: 'دورة المنتج والأرشيف' },
                        ]
                    ).map((wOpt) => (
                      <button
                        key={wOpt.id}
                        type="button"
                        onClick={() => handleChatbotOptionClick(wOpt, 0)}
                        className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-amber-100/90 hover:bg-[#EA580C] text-[#0C1427] hover:text-white dark:bg-[#1A2B54] dark:text-[#FBBF24] dark:hover:bg-[#EA580C] border border-amber-400/70 dark:border-[#EA580C]/50 transition cursor-pointer"
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
                        <div className="mb-2 overflow-hidden rounded-xl border border-amber-300/60 max-w-[220px] shadow-xs">
                          <img src={m.attachmentPreview} alt="مرفق" className="w-full h-auto max-h-44 object-cover" />
                        </div>
                      )}
                      {renderText(m.content)}
                      {(m.searchUsed || (m.sources && m.sources.length > 0)) && (
                        <div className="mt-2 pt-2 border-t border-stone-200 dark:border-stone-700 space-y-1">
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
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                >
                                  <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                                  <span className="truncate max-w-[140px]">{src.title || src.url}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Bubble>

                    {/* اختيارات الشات بوت التفاعلية المحلية (نظام أقرب كلمة وسؤال وجواب) */}
                    {m.chatbotOptions && m.chatbotOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                        {m.chatbotOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleChatbotOptionClick(opt, mIdx)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-xl border transition shadow-xs cursor-pointer active:scale-95 ${
                              opt.triggerAI
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 dark:bg-stone-800 dark:text-amber-300 border-amber-400/70'
                                : 'bg-[#0C1427] hover:bg-[#EA580C] text-[#FBBF24] hover:text-white dark:bg-[#1A2B54] dark:hover:bg-[#EA580C] border-[#EA580C]/60'
                            }`}
                          >
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* أزرار التوضيح التفاعلية عند وجود استفسار غائم أو متشعب */}
                    {m.disambiguationChoices && m.disambiguationChoices.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                        {m.disambiguationChoices.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => handleDisambiguationChoiceClick(choice)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-xl bg-[#0C1427] hover:bg-[#EA580C] text-[#FBBF24] hover:text-white dark:bg-[#1A2B54] dark:hover:bg-[#EA580C] border border-[#EA580C]/60 transition shadow-xs cursor-pointer active:scale-95"
                          >
                            <span>{choice.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* أزرار الإجراءات السريعة بالكلمات الدلالية */}
                    {m.actionChips && m.actionChips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pr-2 pt-1">
                        {m.actionChips.map((chip) => (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => handleActionChipClick(chip)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-100/80 hover:bg-amber-200 text-amber-950 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800 transition shadow-2xs cursor-pointer active:scale-95"
                          >
                            <span>{chip.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* زر التنقل المباشر يظهر فقط عند طلب شاشة بعينها */}
                    {m.actionLink && (
                      <div className="flex justify-start pr-2">
                        <button
                          type="button"
                          onClick={() => openScreen(m.actionLink!.view)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700 transition shadow-2xs cursor-pointer active:scale-95"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{m.actionLink.label}</span>
                        </button>
                      </div>
                    )}

                    {/* زر الاتصال السريع بالعميل أو المورد */}
                    {m.contactAction && (
                      <div className="flex justify-start pr-2">
                        <a
                          href={`tel:${m.contactAction.phone}`}
                          className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>اتصال بـ {m.contactAction.name} ({m.contactAction.phone})</span>
                        </a>
                      </div>
                    )}

                    {/* زر الإحالة لـ "صقر" في المهام الخارجية وفحص الصور ودراسة السوق فقط */}
                    {m.handoffToFalcon && (
                      <div className="flex justify-start pr-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onOpenFalcon();
                          }}
                          className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-900 text-amber-300 border border-amber-500/40 hover:bg-stone-800 transition shadow-sm cursor-pointer active:scale-95"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                          <span>استشر صقر الشمساوية 🦅</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <Bubble role="assistant">
                    <span className="inline-flex gap-1.5 items-center py-1" aria-label="شموسة تبحث وتراجع">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:300ms]" />
                      <span className="text-xs text-stone-500 mr-2 font-bold">شموسة تراجع دفاتر وسجلات الورشة...</span>
                    </span>
                  </Bubble>
                )}
              </div>

              {/* معاينة المرفق قيد الإرسال */}
              {pendingAttachment && (
                <div className="px-3 py-2 bg-amber-500/10 dark:bg-amber-950/40 border-t border-amber-300/60 dark:border-amber-700/40 flex items-center justify-between gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={pendingAttachment.base64}
                      alt="مرفق"
                      className="w-9 h-9 rounded-xl object-cover border border-amber-400 shrink-0"
                    />
                    <div className="min-w-0 text-right">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block truncate max-w-[180px]">
                        {pendingAttachment.name || 'مستند / صورة'}
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold">
                        مرفق لسؤال أو معاملة الخزينة
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className="p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-red-500 transition cursor-pointer"
                    title="حذف المرفق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* شريط حالة التسجيل الصوتي والتفريغ في شموسة */}
              {(isRecordingVoice || isTranscribingVoice || voiceNotice) && (
                <div className={`px-3 py-1.5 border-t flex items-center justify-between text-xs flex-shrink-0 transition-all ${
                  isRecordingVoice
                    ? 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300 animate-pulse'
                    : isTranscribingVoice
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {isRecordingVoice && <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />}
                    <span className="font-bold">{voiceNotice || (isRecordingVoice ? 'شموسة تسجل صوتك.. تحدثي بحرية ثم انقري الميكروفون للإيقاف' : '')}</span>
                  </div>
                  {isRecordingVoice && (
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="text-[11px] font-black px-2 py-0.5 rounded-md bg-red-600 text-white cursor-pointer hover:bg-red-700 shadow-xs"
                    >
                      إيقاف وتفريغ
                    </button>
                  )}
                </div>
              )}

              {/* Chat Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="p-2.5 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex-shrink-0"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf"
                  onChange={handleAttachmentSelected}
                  className="hidden"
                />

                <div className="flex items-end gap-1.5">
                  {/* زر المرفقات 📎 */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="إرفاق فاتورة، إيصال، أو صورة خامة"
                    className="p-2.5 rounded-2xl text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer shrink-0"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* زر التسجيل الصوتي 🎙️ */}
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    title={isRecordingVoice ? 'إيقاف التسجيل الصوتي وتفريغه' : 'تسجيل سؤال بصوتك'}
                    className={`p-2.5 rounded-2xl transition cursor-pointer shrink-0 ${
                      isRecordingVoice
                        ? 'bg-red-500 text-white shadow-md animate-pulse ring-2 ring-red-300'
                        : isTranscribingVoice
                        ? 'bg-amber-500 text-white animate-spin'
                        : 'text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {isRecordingVoice ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* زر بحث جوجل الحي بأيقونة شموسة */}
                  <button
                    type="button"
                    onClick={() => setUseGoogleSearch((v) => !v)}
                    title={useGoogleSearch ? 'بحث جوجل الحي مُفعّل لشموسة' : 'تفعيل بحث جوجل الحي للأسعار والموردين'}
                    aria-pressed={useGoogleSearch}
                    className={`p-1.5 rounded-2xl transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                      useGoogleSearch
                        ? 'bg-emerald-500 text-white shadow-[0_0_14px_rgba(16,185,129,0.7)] ring-2 ring-emerald-400/70'
                        : 'bg-transparent hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <img
                      src={shamousaSearchIconImg}
                      alt="بحث شموسة"
                      draggable={false}
                      className="w-7 h-7 object-contain select-none pointer-events-none"
                    />
                  </button>

                  {/* مربع النص المتمدد تلقائياً للأعلى مع دعم Scroll و Enter لسطر جديد */}
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        adjustTextareaHeight(e.target);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            send(input);
                          }
                          // الضغط العادي على Enter ينزل سطراً جديداً لكتابة أفكار جديدة
                        }
                      }}
                      rows={1}
                      maxLength={1000}
                      placeholder="اسألي شموسة عن الخزنة، النواقص، الأوردرات... (Enter لسطر جديد)"
                      className="w-full resize-none max-h-36 overflow-y-auto px-3.5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                    />
                  </div>

                  {/* زر الإرسال مع سهم متجه للأعلى ⬆️ */}
                  <button
                    type="submit"
                    disabled={(!input.trim() && !pendingAttachment) || isLoading}
                    aria-label="إرسال"
                    title="إرسال (Ctrl+Enter)"
                    className="w-10 h-10 flex-shrink-0 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-md active:scale-95 cursor-pointer"
                  >
                    <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {remaining !== null && (
                  <p className="text-[10px] text-center text-stone-500 dark:text-stone-400 pt-1.5 font-bold">
                    باقي {remaining} استفسار اليوم
                  </p>
                )}
              </form>
            </>
          )}

          {/* Tab 2: Daily Tasks & Delivery Agenda View */}
          {activeTab === 'tasks_agenda' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50 dark:bg-stone-950">
              {/* قسم 1: توجيهات ومهام اليوم من شموسة 🌞 */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-amber-200/90 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌞</span>
                    <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100">
                      توجيهات ومهام اليوم من شموسة
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold">
                    {completedTaskIds.filter((id) => dailyTasks.some((t) => t.id === id)).length} / {dailyTasks.length} منجز
                  </span>
                </div>

                <div className="space-y-2">
                  {dailyTasks.map((task) => {
                    const isDone = completedTaskIds.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                          isDone
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40 opacity-70'
                            : task.urgency === 'high'
                            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                            : 'bg-stone-50/80 dark:bg-stone-850 border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all cursor-pointer mt-0.5 active:scale-90 ${
                              isDone
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                                : 'bg-white dark:bg-stone-800 text-stone-300 hover:text-emerald-600 border-stone-300 dark:border-stone-700 hover:border-emerald-500'
                            }`}
                            title={isDone ? 'إلغاء الإنجاز' : 'تم الإنجاز بنجاح (✔️)'}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-xs font-black transition-all ${
                                  isDone
                                    ? 'line-through text-stone-400 dark:text-stone-500'
                                    : 'text-stone-900 dark:text-stone-100'
                                }`}
                              >
                                {task.title}
                              </span>
                              {task.urgency === 'high' && !isDone && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                                  عاجل
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11px] mt-0.5 transition-all ${
                                isDone
                                  ? 'line-through text-stone-400 dark:text-stone-600'
                                  : 'text-stone-600 dark:text-stone-400'
                              }`}
                            >
                              {task.detail}
                            </p>
                          </div>
                        </div>

                        {task.view && !isDone && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => openScreen(task.view!)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800 text-[11px] font-black transition cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <span>{task.actionLabel}</span>
                              <ChevronLeft className="w-3 h-3 text-amber-600" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* قسم 2: مواعيد وأجندة تسليم الطلبيات والربط مع تقويم جوجل 📅 */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100">
                      مواعيد وأجندة الورشة
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playButtonClickSound();
                      setIsNewApptFormOpen(!isNewApptFormOpen);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>موعد جديد</span>
                  </button>
                </div>

                {/* New Appointment inline form */}
                {isNewApptFormOpen && (
                  <form
                    onSubmit={handleCreateAppointment}
                    className="p-3 rounded-xl bg-amber-50/60 dark:bg-stone-850 border border-amber-300/80 dark:border-amber-800/80 space-y-2.5 animate-in fade-in duration-200"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-amber-200/50 dark:border-stone-800">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                        تسجيل موعد أو تسليم جديد 📅
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNewApptFormOpen(false)}
                        className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={apptFormTitle}
                        onChange={(e) => setApptFormTitle(e.target.value)}
                        placeholder="عنوان الموعد أو المشغولة (مثلاً: تسليم طقم صواني رخام)"
                        required
                        className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-bold"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={apptFormClient}
                          onChange={(e) => setApptFormClient(e.target.value)}
                          placeholder="اسم العميل (اختياري)"
                          className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-bold"
                        />
                        <input
                          type="tel"
                          value={apptFormPhone}
                          onChange={(e) => setApptFormPhone(e.target.value)}
                          placeholder="هاتف العميل"
                          className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-bold font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-stone-500 block mb-0.5">التاريخ</label>
                          <input
                            type="date"
                            value={apptFormDate}
                            onChange={(e) => setApptFormDate(e.target.value)}
                            required
                            className="w-full text-xs p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-stone-500 block mb-0.5">الساعة</label>
                          <input
                            type="time"
                            value={apptFormTime}
                            onChange={(e) => setApptFormTime(e.target.value)}
                            className="w-full text-xs p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono"
                          />
                        </div>
                      </div>

                      <input
                        type="text"
                        value={apptFormNotes}
                        onChange={(e) => setApptFormNotes(e.target.value)}
                        placeholder="ملاحظات التسليم (مثال: تغليف هدايا)"
                        className="w-full text-xs p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsNewApptFormOpen(false)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 dark:text-stone-400 text-xs font-bold"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95"
                      >
                        حفظ الموعد
                      </button>
                    </div>
                  </form>
                )}

                {/* Appointments List */}
                <div className="space-y-2.5">
                  {appointments.length === 0 ? (
                    <div className="text-center py-4 text-xs text-stone-500 dark:text-stone-400">
                      لا توجد مواعيد تسليم مسجلة حالياً. اضغط "موعد جديد" لتسجيل موعد تسليم للعميل.
                    </div>
                  ) : (
                    appointments.map((appt) => {
                      const isDone = appt.status === 'completed';
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
                          className={`p-3 rounded-2xl border transition-all space-y-2 ${
                            isDone
                              ? 'bg-stone-100/50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 opacity-70'
                              : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4
                                className={`text-xs font-black ${
                                  isDone
                                    ? 'line-through text-stone-400 dark:text-stone-500'
                                    : 'text-stone-900 dark:text-stone-100'
                                }`}
                              >
                                {appt.title}
                              </h4>
                              {appt.clientName && (
                                <p className="text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                                  <User className="w-3 h-3 text-stone-400" />
                                  <span>{appt.clientName}</span>
                                  {appt.clientPhone && (
                                    <span className="font-mono text-stone-500 mr-1">({appt.clientPhone})</span>
                                  )}
                                </p>
                              )}
                            </div>

                            <div className="text-left shrink-0">
                              <span className="text-[11px] font-mono font-black text-amber-700 dark:text-amber-400 block">
                                {appt.date}
                              </span>
                              {appt.time && (
                                <span className="text-[10px] font-mono text-stone-500 block">
                                  {appt.time}
                                </span>
                              )}
                            </div>
                          </div>

                          {appt.notes && (
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-900/60 p-1.5 rounded-lg border border-stone-200/50 dark:border-stone-800">
                              {appt.notes}
                            </p>
                          )}

                          {/* أزرار تقويم جوجل وتنزيل .ics والإنجاز */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-stone-100 dark:border-stone-800">
                            <div className="flex items-center gap-1.5">
                              {/* حفظ في تقويم جوجل 📅 */}
                              <a
                                href={gcalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition cursor-pointer"
                                title="حفظ الموعد في تقويم جوجل"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>تقويم جوجل 📅</span>
                              </a>

                              {/* تحميل ملف التقويم .ics */}
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
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 transition cursor-pointer"
                                title="تحميل ملف التقويم للأجهزة والهواتف (.ics)"
                              >
                                <Download className="w-3 h-3 text-stone-500" />
                                <span>ملف .ics</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleAppointment(appt.id)}
                              className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition cursor-pointer active:scale-95 ${
                                isDone
                                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                              }`}
                            >
                              {isDone ? 'تم التسليم ✔️' : 'تأكيد التسليم'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
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
  <div className={`flex items-end gap-2 ${role === 'user' ? 'justify-start' : 'justify-end'}`}>
    {role === 'assistant' && (
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-amber-400 bg-amber-500/20 shadow-2xs flex items-center justify-center p-0.5">
        <ShamousaMascotAvatar size="xs" statusDot={false} className="w-full h-full" />
      </div>
    )}
    <div
      className={`max-w-[85%] whitespace-pre-wrap break-words text-sm leading-relaxed px-4 py-2.5 rounded-2xl shadow-2xs ${
        role === 'user'
          ? 'bg-amber-600 text-white rounded-br-xs'
          : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 rounded-bl-xs'
      }`}
    >
      {children}
    </div>
  </div>
);

export default ShamousaChatWidget;