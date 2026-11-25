import { SubscriptionPackageId } from '../../types/subscriptions';

export interface PackageCopyEn {
  title: string;
  tagline: string;
  highlights: string[];
}

export function getLandingPackageCopyEn(
  pkgId: SubscriptionPackageId | string,
  themesCount: number
): PackageCopyEn | null {
  switch (pkgId) {
    case 'core_free':
      return {
        title: 'Core Starter Package + Personal Profile',
        tagline:
          'Free forever — unlocks your complete Personal Profile (skill level, bio, showcase portfolio & expert lessons) plus the Al-Shamsawiya community and account settings.',
        highlights: [
          'Full Personal Profile: skill level, craft story, portfolio gallery & training highlights',
          'Access to the Al-Shamsawiya Community to connect with artisans and experts',
          'Workshop & account settings plus flexible subscription upgrades anytime',
        ],
      };
    case 'storefront_catalog':
      return {
        title: 'Global Storefront & Smart Catalog',
        tagline: `Unlocks your catalog, quick direct product entry, independent storefront with ${themesCount} global themes (growing automatically), order tracking & Marketplace listing.`,
        highlights: [
          `All ${themesCount} architectural storefront themes (automatically updated with every new theme)`,
          'Smart catalog + direct product entry with colors, sizes & drag-and-drop sorting',
          'Animated promo banners, multi-type discount coupons, before/after offers & Orders hub',
        ],
      };
    case 'production_pricing':
      return {
        title: 'Smart Manufacturing & Costing',
        tagline:
          'Accurate cost calculator with waste & labor hours, production work orders, and automatic raw-material deduction from stock.',
        highlights: [
          'Precision pricing calculator covering materials, waste %, labor & profit margin',
          'Production work orders with automatic stock issue and finished-goods receipt',
          'Cost archive and profitability comparison across your handmade collections',
        ],
      };
    case 'inventory_purchases':
      return {
        title: 'Inventory, Purchases & Starter Treasury',
        tagline:
          'Track raw materials, finished products, supplier purchase invoices, physical stock counts & low-stock alerts.',
        highlights: [
          'Raw materials & finished products warehouses with smart reorder alerts',
          'Supplier directory, purchase invoices & direct access to the B2B Suppliers Market',
          'Full inventory audits and instant stock adjustment logs',
        ],
      };
    case 'finance_crm':
      return {
        title: 'Complete Finance & Customers (FCA + CRM)',
        tagline:
          'Separate workshop cash from personal spending: multi-channel treasuries, sales invoices, customer ledgers, fixed assets & profit reports.',
        highlights: [
          'Multi-channel treasuries (Cash, InstaPay, Mobile Wallets & Bank Accounts)',
          'Sales invoices, returns, customer CRM statements & multi-currency rates',
          'Operating expenses, fixed assets & real-time net profit analytics',
        ],
      };
    case 'hr_pos_branches':
      return {
        title: 'Team, Payroll (HR) & Fast POS Branches',
        tagline:
          'Manage workshop artisans, daily wages, piece-rate commissions & advances — or run multi-branch fast barcode POS terminals for suppliers.',
        highlights: [
          'Full employee & artisan team directory with salaries, daily wages & commissions',
          'Direct salary & advance payouts synced automatically with workshop treasuries',
          'For suppliers: lightning-fast barcode POS, multi-branch stock transfers & device locks',
        ],
      };
    case 'ai_assistants':
      return {
        title: 'AI Business Partners (Saqr & Shamousa AI)',
        tagline:
          'Your dedicated AI engineering & business advisors: smart pricing audits, waste reduction, automated product copy & instant workshop answers.',
        highlights: [
          'Saqr AI: engineering advisor for pricing reviews, margins & growth strategy',
          'Shamousa AI: daily business manager for instant Q&A, smart search & task execution',
          'One-click marketing descriptions and multilingual product translation',
        ],
      };
    default:
      return null;
  }
}
