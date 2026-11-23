import { WorkshopProfile } from '../../types';

export type AdminPageId =
  | 'home'
  | 'workshops'
  | 'customers'
  | 'suppliers'
  | 'marketplace'
  | 'suppliers_market'
  | 'stores'
  | 'catalogs'
  | 'applications'
  | 'product_approvals'
  | 'appeals'
  | 'reports'
  | 'notif_messages'
  | 'notif_workshops'
  | 'notif_store'
  | 'notif_system'
  | 'landing_cms'
  | 'feature_visibility'
  | 'ui_layout_studio'
  | 'packages_manager'
  | 'unified_materials'
  | 'experts_trainers'
  | 'growth_hub'
  | 'pulse_radar';

export type ExecutiveTab =
  | 'materials'
  | 'products'
  | 'contacts'
  | 'treasuries'
  | 'orders'
  | 'appeals'
  | 'messaging'
  | 'marketplace'
  | 'product_approvals'
  | 'applications'
  | AdminPageId;

export type WorkshopSortMode = 'newest' | 'name' | 'status' | 'country' | 'most_active';

export type EnrichedWorkshopProfile = WorkshopProfile & {
  productsCount?: number;
  marketplaceProductsCount?: number;
  ordersCount?: number;
  totalCatalogAndShowcase?: number;
  activityScore?: number;
  lastActiveAt?: number;
};

export function mapExecutiveTabToPage(tab?: ExecutiveTab): { page: AdminPageId; catalogSubTab?: 'materials' | 'products' | 'contacts' | 'treasuries' | 'orders' } {
  switch (tab) {
    case 'home':
    case 'workshops':
    case 'customers':
    case 'suppliers':
    case 'marketplace':
    case 'suppliers_market':
    case 'stores':
    case 'catalogs':
    case 'applications':
    case 'product_approvals':
    case 'appeals':
    case 'reports':
    case 'notif_messages':
    case 'notif_workshops':
    case 'notif_store':
    case 'notif_system':
    case 'landing_cms':
    case 'feature_visibility':
    case 'ui_layout_studio':
    case 'packages_manager':
    case 'unified_materials':
    case 'experts_trainers':
    case 'growth_hub':
    case 'pulse_radar':
      return { page: tab };
    case 'messaging':
      return { page: 'notif_messages' };
    case 'materials':
    case 'products':
    case 'contacts':
    case 'treasuries':
    case 'orders':
      return { page: 'catalogs', catalogSubTab: tab };
    default:
      return { page: 'home' };
  }
}

export function getWorkshopStatusKey(w: WorkshopProfile): 'active' | 'suspended' | 'banned' {
  if (w.status === 'banned') return 'banned';
  if (w.status === 'suspended' || w.isFrozen) return 'suspended';
  return 'active';
}

export function getWorkshopStatusLabel(w: WorkshopProfile): { label: string; badgeClass: string } {
  const s = getWorkshopStatusKey(w);
  if (s === 'banned') {
    return {
      label: 'محظورة',
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    };
  }
  if (s === 'suspended') {
    return {
      label: 'موقوفة مؤقتاً',
      badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    };
  }
  return {
    label: 'نشطة',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  };
}

export function getInactivityDays(ws: EnrichedWorkshopProfile): number {
  const lastActive = ws.lastActiveAt || ws.updatedAt || ws.createdAt || Date.now();
  return Math.max(0, Math.floor((Date.now() - lastActive) / (1000 * 60 * 60 * 24)));
}

export function formatWhatsAppPhone(phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
}

export function getMedalArabic(medal?: string | null): string {
  if (medal === 'diamond') return '💎 الماسية';
  if (medal === 'gold') return '🥇 الذهبية';
  if (medal === 'silver') return '🥈 الفضية';
  if (medal === 'bronze') return '🥉 البرونزية';
  return '🎖️ معتمدة';
}
